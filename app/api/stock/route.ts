import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketDetector, fetchOrderbook, getTopBroker, parseLot, getBrokerSummary, fetchEmitenInfo } from '@/lib/stockbit';
import { calculateTargets } from '@/lib/calculations';
import { calculateDynamicTargetsV2 } from '@/lib/targets/target-engine';
import { calibrateScore } from '@/lib/calibration';
import { assessLiquidityAndExecution } from '@/lib/execution/liquidity-gate';
import { analyzeAccumulationProxy } from '@/lib/accumulation/accumulation-proxy-engine';
import { evaluateEntryCandidates } from '@/lib/execution/entry-risk-engine';
import { evaluateDecisionGate } from '@/lib/decisions/decision-gate';
import { computeTechnicalIndicators } from '@/lib/indicators/technical-engine';
import { predictTradeOutcomeChampion } from '@/lib/models/trade-outcome-model';
import type { OHLCVBar } from '@/lib/indicators/types';
import type { BrokerTransactionRecord, OrderBookDepthSnapshot } from '@/lib/accumulation/types';
import { saveStockQuery, getLatestStockQuery, getSpecificStockQuery, getStockPriceByDate } from '@/lib/supabase';
import { runAdimologyV2Pipeline } from '@/lib/orchestrator/v2-pipeline';
import type { StockInput, ApiResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: StockInput = await request.json();
    const { emiten, fromDate, toDate } = body;

    // Validate input
    if (!emiten || !fromDate || !toDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: emiten, fromDate, toDate' },
        { status: 400 }
      );
    }

    const isSingleDate = fromDate === toDate;
    const todayWib = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const todayUtc = new Date().toISOString().split('T')[0];
    const isToday = toDate === todayWib || toDate === todayUtc || fromDate === todayWib || fromDate === todayUtc;

    // 2. Fetch data from both Stockbit APIs and emiten info
    const [marketDetectorData, orderbookData, emitenInfoData] = await Promise.all([
      fetchMarketDetector(emiten, fromDate, toDate),
      fetchOrderbook(emiten),
      fetchEmitenInfo(emiten).catch(() => null),
    ]);

    // Extract top broker data
    let activeMarketDetector = marketDetectorData;
    let brokerData = getTopBroker(activeMarketDetector);
    let isFromHistory = false;
    let historyDate: string | undefined = undefined;

    // If broker data is not yet available for today (due to BEI Broker Code Masking during market hours 09:00-16:00 WIB),
    // automatically retrieve the most recent published broker summary from previous trading sessions
    if (!brokerData && isToday) {
      const now = new Date();
      for (let offset = 1; offset <= 5; offset++) {
        const d = new Date(now);
        d.setDate(now.getDate() - offset);
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        const testDate = d.toISOString().split('T')[0];
        try {
          const pastDetector = await fetchMarketDetector(emiten, testDate, testDate);
          const pastBroker = getTopBroker(pastDetector);
          if (pastBroker && pastBroker.barangBandar > 0) {
            activeMarketDetector = pastDetector;
            brokerData = pastBroker;
            isFromHistory = true;
            historyDate = testDate;
            break;
          }
        } catch (err) {
          // continue checking earlier days
        }
      }
    }

    if (!brokerData) {
       // Attempt to fetch latest historical data
       const historyData = await getLatestStockQuery(emiten);
       
       if (historyData) {
         return NextResponse.json({
           success: true,
           data: {
             input: { emiten, fromDate: historyData.from_date, toDate: historyData.to_date },
             stockbitData: {
               bandar: historyData.bandar,
               barangBandar: historyData.barang_bandar,
               rata_rata_bandar: historyData.rata_rata_bandar
             },
             marketData: {
                harga: historyData.harga,
                offerTeratas: historyData.ara,
                bidTerbawah: historyData.arb,
                totalBid: historyData.total_bid,
                totalOffer: historyData.total_offer,
                fraksi: historyData.fraksi
             },
             calculated: {
                totalPapan: historyData.total_papan,
                rata_rata_bid_ofer: historyData.rata_rata_bid_ofer,
                a: historyData.a,
                p: historyData.p,
                target_realistis: historyData.target_realistis,
                target_max: historyData.target_max
             },
             brokerSummary: null,
             isFromHistory: historyData.from_date !== fromDate || historyData.to_date !== toDate,
             historyDate: historyData.from_date
           }
         });
       }

      return NextResponse.json(
        {
          success: false,
          error: 'Data broker tidak tersedia untuk periode ini (Market belum buka atau saham tidak aktif)'
        },
        { status: 404 }
      );
    }

    // Extract broker summary for the new card
    const brokerSummary = getBrokerSummary(activeMarketDetector);

    // Extract sector from emiten info
    const sector = emitenInfoData?.data?.sector || undefined;

    // Extract market data
    const obData = orderbookData.data || (orderbookData as any);

    if (!obData.total_bid_offer || obData.close === undefined) {
      throw new Error('Invalid Orderbook API response structure');
    }

    // Realtime intraday attributes from Orderbook API
    const realtimeAvgPrice = Number(obData.average) || Number(obData.close);
    const realtimeVolumeLots = Math.round(Number(obData.volume) / 100) || brokerSummary.detector.volume;
    const realtimeValueIdr = Number(obData.value) || brokerSummary.detector.value;
    const realtimeFreq = Number(obData.frequency) || brokerSummary.detector.number_broker_buysell;

    // When query is for today, inject 100% REALTIME intraday market execution
    if (isToday) {
      brokerSummary.detector.average = realtimeAvgPrice;
      if (realtimeVolumeLots > 0) brokerSummary.detector.volume = realtimeVolumeLots;
      if (realtimeValueIdr > 0) brokerSummary.detector.value = realtimeValueIdr;
      if (realtimeFreq > 0) brokerSummary.detector.number_broker_buysell = realtimeFreq;

      if (brokerData && (!brokerData.rataRataBandar || brokerData.rataRataBandar === 0)) {
        brokerData.rataRataBandar = Math.round(realtimeAvgPrice);
      }
    }

    // Default market data from orderbook (live)
    let marketData = {
      harga: Number(obData.close),
      offerTeratas: 0,
      bidTerbawah: 0,
      totalBid: parseLot(obData.total_bid_offer.bid.lot),
      totalOffer: parseLot(obData.total_bid_offer.offer.lot),
    };

    const araPrice = Number(String(obData?.ara?.value || '').replace(/,/g, ''));
    const arbPrice = Number(String(obData?.arb?.value || '').replace(/,/g, ''));
    const offerPrices = (obData.offer || []).map((o: { price: string }) => Number(o.price));
    const bidPrices = (obData.bid || []).map((b: { price: string }) => Number(b.price));

    marketData.offerTeratas = araPrice > 0 ? araPrice : (offerPrices.length > 0 ? Math.max(...offerPrices) : Number(obData.high || 0));
    marketData.bidTerbawah = arbPrice > 0 ? arbPrice : (bidPrices.length > 0 ? Math.min(...bidPrices) : 0);

    // 3. For any non-today queries (past single dates or ranges), Override Price from Database (if available)
    if (!isToday) {
      const histPrice = await getStockPriceByDate(emiten, toDate);
      if (histPrice) {
        marketData = {
          harga: Number(histPrice.harga),
          offerTeratas: Number(histPrice.ara),
          bidTerbawah: Number(histPrice.arb),
          totalBid: Number(histPrice.total_bid),
          totalOffer: Number(histPrice.total_offer),
        };
      }
    }

    // Calculate targets (Legacy Adimology Baseline)
    const calculated = calculateTargets(
      brokerData.rataRataBandar,
      brokerData.barangBandar,
      marketData.offerTeratas,
      marketData.bidTerbawah,
      marketData.totalBid / 100,
      marketData.totalOffer / 100,
      marketData.harga
    );

    // Calculate V6 Dynamic Target Ladder & Invalidation
    const targetLadder = calculateDynamicTargetsV2({
      emiten,
      current_price: marketData.harga,
      rata_rata_bandar: brokerData.rataRataBandar,
      barang_bandar: brokerData.barangBandar,
      ara: marketData.offerTeratas,
      arb: marketData.bidTerbawah,
      total_bid: marketData.totalBid / 100,
      total_offer: marketData.totalOffer / 100,
    });

    // Calibrated probability based on structural power
    const rankScore = Math.min(100, Math.max(10, Math.round((calculated.p || 5) * 10)));
    const calibratedProbability = calibrateScore(rankScore);

    // Liquidity & Execution Assessment
    const totalOrderbookValue = (marketData.totalBid + marketData.totalOffer) * marketData.harga;
    const liquidityAssessment = assessLiquidityAndExecution({
      emiten,
      current_price: marketData.harga,
      average_daily_turnover_idr: Math.max(1_000_000_000, totalOrderbookValue),
      best_bid: marketData.harga,
      best_offer: marketData.offerTeratas > marketData.harga ? marketData.offerTeratas : marketData.harga + calculated.fraksi,
      offer_depth_lots: marketData.totalOffer / 100,
    });

    // Quant Engine 1: Accumulation Proxy Analysis
    const transactions: BrokerTransactionRecord[] = [];
    if (brokerSummary) {
      for (const b of brokerSummary.topBuyers || []) {
        transactions.push({
          broker_code: b.netbs_broker_code,
          buy_volume: parseLot(b.blot),
          sell_volume: 0,
          buy_value: Number(b.bval) || 0,
          sell_value: 0,
          average_buy_price: Number(b.netbs_buy_avg_price) || 0,
          average_sell_price: 0,
          net_buy_value: Number(b.bval) || 0,
          net_buy_volume: parseLot(b.blot),
        });
      }
      for (const s of brokerSummary.topSellers || []) {
        transactions.push({
          broker_code: s.netbs_broker_code,
          buy_volume: 0,
          sell_volume: parseLot(s.slot),
          buy_value: 0,
          sell_value: Number(s.sval) || 0,
          average_buy_price: 0,
          average_sell_price: Number(s.netbs_sell_avg_price) || 0,
          net_buy_value: -(Number(s.sval) || 0),
          net_buy_volume: -parseLot(s.slot),
        });
      }
    }

    const orderBookSnapshot: OrderBookDepthSnapshot = {
      timestamp: new Date().toISOString(),
      bids: (obData.bid || []).slice(0, 5).map((b: any) => ({ price: Number(b.price) || 0, volume: Number(b.volume) || 0 })),
      asks: (obData.offer || []).slice(0, 5).map((a: any) => ({ price: Number(a.price) || 0, volume: Number(a.volume) || 0 })),
      spread: Math.max(0, (Number(obData.offer?.[0]?.price) || marketData.harga) - (Number(obData.bid?.[0]?.price) || marketData.harga)),
      spread_pct: 0,
    };

    const accumulationProxy = analyzeAccumulationProxy(
      emiten,
      marketData.harga,
      { date: toDate, close_price: marketData.harga, transactions },
      [],
      orderBookSnapshot
    );

    // Quant Engine 2: Deterministic Technical Engine
    const baseBar: OHLCVBar = {
      timestamp: toDate,
      open: marketData.harga,
      high: marketData.offerTeratas > marketData.harga ? marketData.offerTeratas : marketData.harga + calculated.fraksi * 2,
      low: marketData.bidTerbawah < marketData.harga && marketData.bidTerbawah > 0 ? marketData.bidTerbawah : marketData.harga - calculated.fraksi * 2,
      close: marketData.harga,
      volume: (marketData.totalBid + marketData.totalOffer) / 100,
      traded_value: totalOrderbookValue,
      timeframe: '1D',
      is_complete: true,
    };
    const bars: OHLCVBar[] = Array.from({ length: 25 }).map((_, i) => ({
      ...baseBar,
      close: marketData.harga - (24 - i) * (calculated.fraksi * 0.1),
    }));

    const techIndicators = computeTechnicalIndicators(emiten, bars);

    // Quant Engine 3: Lowest-Risk Candidate Entry & Cost Model
    const riskOutput = evaluateEntryCandidates(emiten, techIndicators, accumulationProxy);
    const lowestRiskCandidate = riskOutput.primary_candidate;

    // Quant Engine 4: Trade Outcome Probability Model
    const outcomePred = predictTradeOutcomeChampion({
      symbol: emiten,
      as_of: new Date().toISOString(),
      net_flow_ratio: accumulationProxy.net_flow_ratio,
      persistence: accumulationProxy.persistence,
      hhi_concentration: accumulationProxy.flow_concentration_hhi / 10000,
      is_above_flow_vwap: accumulationProxy.price_acceptance.is_above_flow_vwap,
      distance_to_flow_vwap_pct: accumulationProxy.price_acceptance.price_to_flow_vwap_pct,
      is_absorption: accumulationProxy.absorption.is_absorption_detected,
      orderbook_imbalance: accumulationProxy.order_flow.imbalance_depth_5,
      distance_to_session_vwap_atr: techIndicators.vwap.price_distance_to_vwap_atr,
      trend_slope_ema20: techIndicators.trend.slope_ema20,
      rvol: techIndicators.volume.rvol,
      rsi14: techIndicators.momentum.rsi14,
      atr_pct: techIndicators.volatility.atr_percentage,
      relative_strength_vs_ihsg_5d: techIndicators.relative_strength.stock_vs_ihsg_5d_pct || 0,
      market_structure_bos: techIndicators.market_structure.break_of_structure_bos,
      net_rrr: lowestRiskCandidate?.net_rrr || 1.5,
      spread_pct: orderBookSnapshot.spread / (marketData.harga || 1),
    });

    // Quant Engine 5: Decoupled Decision Gate
    const quantDecision = evaluateDecisionGate(
      emiten,
      techIndicators,
      accumulationProxy,
      riskOutput,
      outcomePred
    );

    // PRD v2.0 Unified Smart Money Grounded Engine Orchestration (L0 - L12)
    let decisionGateV2 = undefined;
    try {
      const v2Result = await runAdimologyV2Pipeline({
        ticker: emiten,
        price: marketData.harga,
        openPrice: Number(obData?.open) || marketData.harga,
        araPrice: Number(String(obData?.ara?.value || '').replace(/,/g, '')) || marketData.offerTeratas,
        arbPrice: Number(String(obData?.arb?.value || '').replace(/,/g, '')) || marketData.bidTerbawah,
        bestBid: Number(obData?.bid?.[0]?.price) || marketData.harga,
        bestOffer: Number(obData?.offer?.[0]?.price) || (marketData.harga + calculated.fraksi),
        totalBidLots: marketData.totalBid / 100,
        totalOfferLots: marketData.totalOffer / 100,
        brokerSummary,
        brokerData,
        sector,
        mode: 'SCALP',
      });
      decisionGateV2 = v2Result.decision;
    } catch (v2Err) {
      console.error('V2 Pipeline Orchestration Warning:', v2Err);
    }

    // Prepare response
    const result: ApiResponse = {
      success: true,
      data: {
        input: { emiten, fromDate, toDate },
        stockbitData: brokerData,
        marketData: {
          ...marketData,
          fraksi: calculated.fraksi,
        },
        calculated: {
          totalPapan: calculated.totalPapan,
          rataRataBidOfer: calculated.rataRataBidOfer,
          a: calculated.a,
          p: calculated.p,
          targetRealistis1: calculated.targetRealistis1,
          targetMax: calculated.targetMax,
        },
        brokerSummary,
        sector,
        targetLadder,
        calibratedProbability,
        liquidityAssessment,
        accumulationProxy,
        entryRiskPlan: lowestRiskCandidate as any,
        quantDecision: {
          decision: quantDecision.decision,
          reasons: quantDecision.no_trade_reasons.length > 0 ? quantDecision.no_trade_reasons : quantDecision.passed_checks,
          supporting_evidence: quantDecision.passed_checks,
          contradictory_evidence: quantDecision.failed_checks,
        } as any,
        decisionGateV2,
        isFromHistory: !isToday && isFromHistory,
        historyDate,
      },
    };

    // 4. Save to Supabase ONLY if Single Date Query
    if (isSingleDate) {
      saveStockQuery({
        emiten,
        sector,
        from_date: fromDate,
        to_date: toDate,
        bandar: brokerData.bandar,
        barang_bandar: brokerData.barangBandar,
        rata_rata_bandar: brokerData.rataRataBandar,
        harga: marketData.harga,
        ara: marketData.offerTeratas,
        arb: marketData.bidTerbawah,
        fraksi: calculated.fraksi,
        total_bid: marketData.totalBid,
        total_offer: marketData.totalOffer,
        total_papan: calculated.totalPapan,
        rata_rata_bid_ofer: calculated.rataRataBidOfer,
        a: calculated.a,
        p: calculated.p,
        target_realistis: calculated.targetRealistis1,
        target_max: calculated.targetMax,
      }).catch((err) => console.error('Failed to save to Supabase:', err));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
