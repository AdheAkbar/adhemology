/**
 * lib/broker-flow/hybrid-flow-engine.ts - Hybrid Broker Flow Engine (Adimology V6)
 * PRD V6 Phase 5: IDX Post-Dec 2021 Market Microstructure, Multi-Window ADI, and Cost Basis.
 */

import type {
  FlowRegime,
  ConcentrationRatio,
  BandarCostBasis,
  IntradayFlowProxy,
  HybridFlowReport,
  WindowFlowMetric,
} from './types';
import type { DataMode } from '../data-truth/types';

export interface BrokerEntry {
  broker_code?: string;
  netbs_broker_code?: string;
  bval?: number | string;
  sval?: number | string;
  blot?: number | string;
  slot?: number | string;
  bavg?: number | string;
  savg?: number | string;
}

/**
 * Calculates Top 1, 3, and 5 Concentration Ratios (CR1, CR3, CR5) for buyers and sellers.
 */
export function calculateConcentrationRatios(
  buyers: BrokerEntry[],
  sellers: BrokerEntry[]
): ConcentrationRatio {
  const getVal = (v: number | string | undefined) => Number(v) || 0;

  const buyVals = buyers.map((b) => getVal(b.bval)).sort((a, b) => b - a);
  const sellVals = sellers.map((s) => getVal(s.sval)).sort((a, b) => b - a);

  const totalBuy = buyVals.reduce((acc, v) => acc + v, 0) || 1;
  const totalSell = sellVals.reduce((acc, v) => acc + v, 0) || 1;

  const sumTop = (arr: number[], count: number) =>
    arr.slice(0, count).reduce((acc, v) => acc + v, 0);

  const buyerCr1 = Number((sumTop(buyVals, 1) / totalBuy).toFixed(4));
  const buyerCr3 = Number((sumTop(buyVals, 3) / totalBuy).toFixed(4));
  const buyerCr5 = Number((sumTop(buyVals, 5) / totalBuy).toFixed(4));

  const sellerCr1 = Number((sumTop(sellVals, 1) / totalSell).toFixed(4));
  const sellerCr3 = Number((sumTop(sellVals, 3) / totalSell).toFixed(4));
  const sellerCr5 = Number((sumTop(sellVals, 5) / totalSell).toFixed(4));

  const netCr3Spread = Number((buyerCr3 - sellerCr3).toFixed(4));

  return {
    buyer_cr1: buyerCr1,
    buyer_cr3: buyerCr3,
    buyer_cr5: buyerCr5,
    seller_cr1: sellerCr1,
    seller_cr3: sellerCr3,
    seller_cr5: sellerCr5,
    net_cr3_spread: netCr3Spread,
  };
}

/**
 * Calculates bounded Accumulation / Distribution Intensity (ADI) between -1.0 and +1.0.
 * ADI blends:
 * 1. Net Turnover Share (60% weight): (BuyVal - SellVal) / (BuyVal + SellVal)
 * 2. Top-3 Concentration Spread (40% weight): CR3_buy - CR3_sell
 */
export function calculateAccumulationIntensity(
  buyers: BrokerEntry[],
  sellers: BrokerEntry[]
): number {
  const getVal = (v: number | string | undefined) => Number(v) || 0;
  const totalBuy = buyers.reduce((acc, b) => acc + getVal(b.bval), 0);
  const totalSell = sellers.reduce((acc, s) => acc + getVal(s.sval), 0);
  const totalTurnover = totalBuy + totalSell;

  if (totalTurnover === 0) return 0;

  const netRatio = (totalBuy - totalSell) / totalTurnover;
  const cr = calculateConcentrationRatios(buyers, sellers);
  const crSpread = cr.net_cr3_spread;

  const rawAdi = 0.6 * netRatio + 0.4 * crSpread;
  const clamped = Math.max(-1.0, Math.min(1.0, rawAdi));
  return Number(clamped.toFixed(4));
}

/**
 * Maps an Accumulation/Distribution Intensity (ADI) value to a discrete Flow Regime.
 */
export function determineFlowRegime(adi: number): FlowRegime {
  if (adi >= 0.35) return 'STRONG_ACCUMULATION';
  if (adi >= 0.1) return 'MILD_ACCUMULATION';
  if (adi <= -0.35) return 'STRONG_DISTRIBUTION';
  if (adi <= -0.1) return 'MILD_DISTRIBUTION';
  return 'NEUTRAL';
}

/**
 * Calculates volume-weighted average price of accumulating smart money (Bandar VWAP)
 * and evaluates retail positioning relative to cost basis.
 */
export function calculateBandarCostBasis(
  buyers: BrokerEntry[],
  currentPrice: number
): BandarCostBasis {
  let totalWeightedValue = 0;
  let totalVolume = 0;

  for (const b of buyers) {
    const val = Number(b.bval) || 0;
    const avg = Number(b.bavg) || 0;
    const lot = Number(b.blot) || 0;

    if (val > 0 && avg > 0) {
      // If average price exists, weight by value / avg
      const shares = val / avg;
      totalWeightedValue += val;
      totalVolume += shares;
    } else if (val > 0 && lot > 0) {
      // 1 lot = 100 shares in IDX
      const shares = lot * 100;
      totalWeightedValue += val;
      totalVolume += shares;
    }
  }

  const bandarVwap =
    totalVolume > 0 ? Math.round(totalWeightedValue / totalVolume) : currentPrice;

  const deviationPct =
    bandarVwap > 0
      ? Number((((currentPrice - bandarVwap) / bandarVwap) * 100).toFixed(2))
      : 0;

  let retailPositioning: BandarCostBasis['retail_positioning'] = 'NEAR_BANDAR_COST';
  if (deviationPct < -2.5) {
    retailPositioning = 'BELOW_BANDAR_COST';
  } else if (deviationPct > 3.5) {
    retailPositioning = 'ABOVE_BANDAR_COST';
  }

  return {
    bandar_vwap: bandarVwap,
    market_price: currentPrice,
    deviation_pct: deviationPct,
    retail_positioning: retailPositioning,
  };
}

/**
 * Evaluates Intraday Flow Proxy from Orderbook Depth Imbalance.
 * Complies with IDX Dec 2021 regulation: broker codes are masked intraday,
 * so orderbook imbalance serves as the real-time liquidity flow proxy.
 */
export function computeIntradayProxy(
  totalBidLot: number,
  totalOfferLot: number,
  largeBlockRatio?: number
): IntradayFlowProxy {
  const total = totalBidLot + totalOfferLot;
  let imbalance = 0;
  if (total > 0) {
    imbalance = Number(((totalBidLot - totalOfferLot) / total).toFixed(4));
  }

  let proxyRegime: FlowRegime = 'NEUTRAL';
  if (imbalance >= 0.3) proxyRegime = 'STRONG_ACCUMULATION';
  else if (imbalance >= 0.1) proxyRegime = 'MILD_ACCUMULATION';
  else if (imbalance <= -0.3) proxyRegime = 'STRONG_DISTRIBUTION';
  else if (imbalance <= -0.1) proxyRegime = 'MILD_DISTRIBUTION';

  return {
    bid_offer_imbalance: imbalance,
    total_bid_lot: totalBidLot,
    total_offer_lot: totalOfferLot,
    large_block_ratio: largeBlockRatio,
    proxy_regime: proxyRegime,
  };
}

/**
 * Synthesize a comprehensive Hybrid Flow Report combining multi-day EOD broker summary
 * with intraday orderbook proxy when applicable.
 */
export function synthesizeHybridFlowReport(params: {
  emiten: string;
  currentPrice: number;
  buyers: BrokerEntry[];
  sellers: BrokerEntry[];
  orderbook?: { total_bid_lot: number; total_offer_lot: number } | null;
  dataMode?: DataMode;
  asOf?: string;
  windows?: Partial<Record<'1D' | '7D' | '14D' | '21D', WindowFlowMetric>>;
}): HybridFlowReport {
  const {
    emiten,
    currentPrice,
    buyers,
    sellers,
    orderbook,
    dataMode = 'EOD',
    asOf = new Date().toISOString(),
    windows,
  } = params;

  const concentration = calculateConcentrationRatios(buyers, sellers);
  const intensity = calculateAccumulationIntensity(buyers, sellers);
  const regime = determineFlowRegime(intensity);
  const costBasis = calculateBandarCostBasis(buyers, currentPrice);

  let intradayProxy: IntradayFlowProxy | null = null;
  if (orderbook && (orderbook.total_bid_lot > 0 || orderbook.total_offer_lot > 0)) {
    intradayProxy = computeIntradayProxy(
      orderbook.total_bid_lot,
      orderbook.total_offer_lot
    );
  }

  return {
    emiten: emiten.toUpperCase(),
    as_of: asOf,
    data_mode: dataMode,
    current_price: currentPrice,
    overall_regime: regime,
    accumulation_intensity: intensity,
    concentration,
    cost_basis: costBasis,
    intraday_proxy: intradayProxy,
    windows: windows || {},
  };
}
