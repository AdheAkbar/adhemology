import { fetchMarketDetector, fetchOrderbook, getTopBroker, parseLot, getBrokerSummary, fetchEmitenInfo } from '../lib/stockbit';
import { calculateTargets } from '../lib/calculations';
import { calculateDynamicTargetsV2 } from '../lib/targets/target-engine';
import { analyzeAccumulationProxy } from '../lib/accumulation/accumulation-proxy-engine';
import { evaluateEntryCandidates } from '../lib/execution/entry-risk-engine';
import { evaluateDecisionGate } from '../lib/decisions/decision-gate';
import { computeTechnicalIndicators } from '../lib/indicators/technical-engine';
import { predictTradeOutcomeChampion } from '../lib/models/trade-outcome-model';
import type { OHLCVBar } from '../lib/indicators/types';
import type { BrokerTransactionRecord, OrderBookDepthSnapshot } from '../lib/accumulation/types';

const STOCKS = ['PSAB', 'ARCI', 'BNGA', 'TUGU', 'ESSA'];
const FROM_DATE = '2026-09-09';
const TO_DATE = '2026-09-09';

async function analyzeStock(emiten: string) {
  try {
    const [marketDetectorData, orderbookData, emitenInfoData] = await Promise.all([
      fetchMarketDetector(emiten, FROM_DATE, TO_DATE),
      fetchOrderbook(emiten),
      fetchEmitenInfo(emiten).catch(() => null),
    ]);

    const brokerData = getTopBroker(marketDetectorData);
    const brokerSummary = getBrokerSummary(marketDetectorData);
    const obData = orderbookData.data || (orderbookData as any);

    if (!obData || obData.close === undefined) {
      console.log(`[${emiten}] No orderbook data`);
      return null;
    }

    const price = Number(obData.close);
    const ara = Number(obData.ara?.value || obData.high || price * 1.25);
    const arb = Number(obData.arb?.value || price * 0.8);
    const totalBidLots = Number(obData.total_bid_offer?.bid?.lot?.replace(/,/g, '') || 0);
    const totalOfferLots = Number(obData.total_bid_offer?.offer?.lot?.replace(/,/g, '') || 0);

    const calculated = calculateTargets(
      brokerData?.rataRataBandar || price,
      brokerData?.barangBandar || 10000,
      ara,
      arb,
      totalBidLots,
      totalOfferLots,
      price
    );

    const targetLadder = calculateDynamicTargetsV2({
      emiten,
      current_price: price,
      rata_rata_bandar: brokerData?.rataRataBandar || price,
      barang_bandar: brokerData?.barangBandar || 10000,
      ara,
      arb,
      total_bid: totalBidLots,
      total_offer: totalOfferLots,
    });

    const detectorVal = Number(brokerSummary?.detector?.value || 0);
    const detectorVol = Number(brokerSummary?.detector?.volume || 0);
    const dailyTurnover = detectorVal > 0 ? detectorVal : (totalBidLots + totalOfferLots) * 100 * price;

    // Broker transactions
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
      spread: Math.max(0, (Number(obData.offer?.[0]?.price) || price) - (Number(obData.bid?.[0]?.price) || price)),
      spread_pct: 0,
    };

    const accumulationProxy = analyzeAccumulationProxy(
      emiten,
      price,
      { date: TO_DATE, close_price: price, transactions },
      [],
      orderBookSnapshot
    );

    const baseBar: OHLCVBar = {
      timestamp: TO_DATE,
      open: price,
      high: ara > price ? ara : price + calculated.fraksi * 2,
      low: arb < price && arb > 0 ? arb : price - calculated.fraksi * 2,
      close: price,
      volume: detectorVol > 0 ? detectorVol : totalBidLots + totalOfferLots,
      traded_value: dailyTurnover,
      timeframe: '1D',
      is_complete: true,
      source: 'IDX_ORDERBOOK',
    };
    const bars: OHLCVBar[] = Array.from({ length: 25 }).map((_, i) => ({
      ...baseBar,
      close: price - (24 - i) * (calculated.fraksi * 0.1),
    }));

    const techIndicators = computeTechnicalIndicators(emiten, bars);
    const riskOutput = evaluateEntryCandidates(emiten, techIndicators, accumulationProxy);
    const lowestRiskCandidate = riskOutput.primary_candidate;

    const outcomePred = predictTradeOutcomeChampion({
      symbol: emiten,
      rank_score: accumulationProxy.accumulation_proxy_score,
      rvol: techIndicators.volume.rvol,
      distance_to_session_vwap_atr: techIndicators.vwap.price_distance_to_vwap_atr,
      relative_strength_vs_ihsg_5d: techIndicators.relative_strength.stock_vs_ihsg_5d_pct || 0,
      net_rrr: lowestRiskCandidate?.net_rrr || 1.5,
      is_above_flow_vwap: price >= accumulationProxy.flow_vwap_proxy,
      market_structure_bos: techIndicators.market_structure.break_of_structure,
      spread_pct: orderBookSnapshot.spread / (price || 1),
    });

    const quantDecision = evaluateDecisionGate(
      emiten,
      techIndicators,
      accumulationProxy,
      riskOutput,
      outcomePred
    );

    return {
      emiten,
      price,
      fraksi: calculated.fraksi,
      daily_turnover_idr: dailyTurnover,
      detector_accdist: brokerSummary?.detector?.broker_accdist,
      top1_accdist: brokerSummary?.detector?.top1?.accdist,
      top1_net_val: brokerSummary?.detector?.top1?.amount,
      top3_net_val: brokerSummary?.detector?.top3?.amount,
      top5_net_val: brokerSummary?.detector?.top5?.amount,
      topBuyer: brokerSummary?.topBuyers?.[0]?.netbs_broker_code,
      topBuyerLot: brokerSummary?.topBuyers?.[0]?.blot,
      topBuyerAvg: brokerSummary?.topBuyers?.[0]?.netbs_buy_avg_price,
      topSeller: brokerSummary?.topSellers?.[0]?.netbs_broker_code,
      topSellerLot: brokerSummary?.topSellers?.[0]?.slot,
      topSellerAvg: brokerSummary?.topSellers?.[0]?.netbs_sell_avg_price,
      flow_state: accumulationProxy.flow_state,
      rank_score: accumulationProxy.accumulation_proxy_score,
      flow_vwap_proxy: Math.round(accumulationProxy.flow_vwap_proxy),
      concentration_cr3: accumulationProxy.top_buyer_concentration_cr3,
      hhi: accumulationProxy.flow_concentration_hhi,
      setup_type: lowestRiskCandidate?.setup_type,
      entry_zone: lowestRiskCandidate?.entry_zone,
      invalidation: lowestRiskCandidate?.invalidation_price,
      target_1: lowestRiskCandidate?.target_1,
      target_2: lowestRiskCandidate?.target_2,
      net_rrr: lowestRiskCandidate?.net_rrr,
      decision: quantDecision.decision,
      passed_checks: quantDecision.passed_checks,
      reasons: quantDecision.no_trade_reasons,
    };
  } catch (err: any) {
    console.error(`Error analyzing ${emiten}:`, err.message);
    return null;
  }
}

async function main() {
  console.log('Fetching live analysis for 5 stocks as of 2026-09-09 / 2026-09-10...');
  for (const s of STOCKS) {
    const res = await analyzeStock(s);
    console.log(`\n================== ${s} ==================`);
    console.log(JSON.stringify(res, null, 2));
  }
}

main().catch(console.error);
