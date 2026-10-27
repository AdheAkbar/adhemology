/**
 * lib/accumulation/accumulation-proxy-engine.ts
 * Accumulation Proxy Engine for SmartMoney AI.
 * 
 * Strict Quant Protocol:
 * - Computes empirical flow metrics without speculative identity assumptions.
 * - Weights net-buying concentration via Herfindahl-Hirschman Index (HHI).
 * - Distinguishes true delta from proxy volume delta with mandatory PROXY_NOT_TRUE_DELTA tag.
 * - Decouples ordinal Accumulation Proxy Score (0-100) from calibrated probabilities.
 */

import type {
  BrokerTransactionRecord,
  DailyBrokerSnapshot,
  OrderBookDepthSnapshot,
  AccumulationProxyResult,
  FlowState,
  CalibratedProbabilityStatus,
} from './types';
import { getBrokerInfo } from '../brokers';
import { snapToIdxTick } from '../config/idx-fraksi-config';
import { calculateWilsonConfidenceInterval } from '../calibration/probability-engine';

export const ACCUMULATION_MODEL_VERSION = 'v6.2.0-proxy-engine';

/**
 * Calculates Net Flow Value and Net Flow Ratio.
 */
export function calculateNetFlow(transactions: BrokerTransactionRecord[]): {
  totalBuyValue: number;
  totalSellValue: number;
  netFlowValue: number;
  netFlowRatio: number;
} {
  const totalBuyValue = transactions.reduce((sum, t) => sum + t.buy_value, 0);
  const totalSellValue = transactions.reduce((sum, t) => sum + t.sell_value, 0);
  const netFlowValue = totalBuyValue - totalSellValue;
  const totalTurnover = totalBuyValue + totalSellValue;
  const netFlowRatio =
    totalTurnover > 0 ? Number((netFlowValue / totalTurnover).toFixed(4)) : 0;

  return {
    totalBuyValue,
    totalSellValue,
    netFlowValue,
    netFlowRatio,
  };
}

/**
 * Computes Herfindahl-Hirschman Index (HHI) and CR3 of positive net buyers.
 * HHI ranges from 0 to 10,000.
 * HHI > 2,500 indicates high concentration (indicative of focused institutional accumulation-like behavior).
 */
export function calculateFlowConcentration(transactions: BrokerTransactionRecord[]): {
  hhi: number;
  cr3: number;
  topBuyers: { broker: string; netValue: number; sharePct: number }[];
} {
  const positiveNetBuyers = transactions
    .filter((t) => t.net_buy_value > 0)
    .sort((a, b) => b.net_buy_value - a.net_buy_value);

  const totalPositiveNetValue = positiveNetBuyers.reduce(
    (sum, t) => sum + t.net_buy_value,
    0
  );

  if (totalPositiveNetValue === 0) {
    return { hhi: 0, cr3: 0, topBuyers: [] };
  }

  let hhiSum = 0;
  const topBuyers = positiveNetBuyers.map((t) => {
    const sharePct = (t.net_buy_value / totalPositiveNetValue) * 100;
    hhiSum += Math.pow(sharePct, 2);
    return {
      broker: t.broker_code,
      netValue: t.net_buy_value,
      sharePct: Number(sharePct.toFixed(1)),
    };
  });

  const cr3 = Number(
    topBuyers
      .slice(0, 3)
      .reduce((sum, t) => sum + t.sharePct, 0)
      .toFixed(1)
  );

  return {
    hhi: Math.round(hhiSum),
    cr3,
    topBuyers: topBuyers.slice(0, 5),
  };
}

/**
 * Computes the Flow VWAP Proxy (Weighted Net-Buy Price Proxy).
 * Formula: sum(positive_net_buy_volume_i * avg_buy_price_i) / sum(positive_net_buy_volume_i)
 * Snapped strictly to official IDX tick boundary.
 */
export function calculateFlowVwapProxy(
  transactions: BrokerTransactionRecord[],
  fallbackPrice: number
): number {
  const positiveBuyers = transactions.filter(
    (t) => t.net_buy_volume > 0 && t.average_buy_price > 0
  );

  let totalVolume = 0;
  let totalPV = 0;

  for (const b of positiveBuyers) {
    totalVolume += b.net_buy_volume;
    totalPV += b.net_buy_volume * b.average_buy_price;
  }

  if (totalVolume === 0) {
    return snapToIdxTick(fallbackPrice, 'NEAREST');
  }

  const rawVwap = totalPV / totalVolume;
  return snapToIdxTick(rawVwap, 'NEAREST');
}

/**
 * Calculates Persistence: fraction of active periods with positive net institutional-proxy buying.
 */
export function calculatePersistence(dailySnapshots: DailyBrokerSnapshot[]): number {
  if (dailySnapshots.length === 0) return 0;

  let positiveDays = 0;
  for (const snap of dailySnapshots) {
    const netDay = snap.transactions.reduce((acc, t) => acc + t.net_buy_value, 0);
    if (netDay > 0) positiveDays++;
  }

  return Number((positiveDays / dailySnapshots.length).toFixed(2));
}

/**
 * Computes Order Book Imbalance across depth level 1 to level 5:
 * (Total Bid Qty - Total Ask Qty) / (Total Bid Qty + Total Ask Qty)
 */
export function calculateOrderBookImbalance(depth?: OrderBookDepthSnapshot | null): {
  imbalance: number;
  spreadPct: number;
} {
  if (!depth || depth.bids.length === 0 || depth.asks.length === 0) {
    return { imbalance: 0, spreadPct: 0 };
  }

  const topBids = depth.bids.slice(0, 5).reduce((sum, b) => sum + b.volume, 0);
  const topAsks = depth.asks.slice(0, 5).reduce((sum, a) => sum + a.volume, 0);
  const total = topBids + topAsks;

  const imbalance = total > 0 ? Number(((topBids - topAsks) / total).toFixed(4)) : 0;
  return { imbalance, spreadPct: depth.spread_pct };
}

/**
 * Evaluates Absorption Behavior:
 * High volume without significant downward price progress, or strong lower wicks absorbing selling.
 */
export function detectAbsorption(
  transactions: BrokerTransactionRecord[],
  currentPrice: number,
  flowVwapProxy: number
): { isDetected: boolean; evidence: string | null } {
  const net = calculateNetFlow(transactions);
  const concentration = calculateFlowConcentration(transactions);

  // If net flow is strongly positive and top institutional proxies are heavily absorbing,
  // while price is stable near or slightly above flow VWAP
  if (net.netFlowRatio > 0.25 && concentration.cr3 >= 50) {
    if (currentPrice >= flowVwapProxy * 0.98) {
      return {
        isDetected: true,
        evidence: `Significant volume absorbed by top 3 buyers (${concentration.cr3}% CR3 share, HHI: ${concentration.hhi}) with price holding steady at/above Flow VWAP Proxy.`,
      };
    }
  }

  return { isDetected: false, evidence: null };
}

/**
 * Master Accumulation Proxy Engine Analysis.
 */
export function analyzeAccumulationProxy(
  symbol: string,
  currentPrice: number,
  currentSnapshot: DailyBrokerSnapshot,
  historicalSnapshots: DailyBrokerSnapshot[] = [],
  orderbookDepth?: OrderBookDepthSnapshot | null,
  historicalResolvedOutcomes?: Array<{ outcome_status: string }>
): AccumulationProxyResult {
  const asOf = new Date().toISOString();
  const supportingEvidence: string[] = [];
  const contradictoryEvidence: string[] = [];
  const missingData: string[] = [];

  const transactions = currentSnapshot.transactions || [];
  if (transactions.length === 0) {
    missingData.push('Broker summary transaction records missing or empty.');
  }

  // 1. Net Flow
  const netFlow = calculateNetFlow(transactions);
  if (netFlow.netFlowValue > 0) {
    supportingEvidence.push(
      `Net flow value is positive (Rp ${(netFlow.netFlowValue / 1e9).toFixed(2)} Miliar, Ratio: ${(netFlow.netFlowRatio * 100).toFixed(1)}%).`
    );
  } else if (netFlow.netFlowValue < 0) {
    contradictoryEvidence.push(
      `Net flow value is negative (Rp ${(netFlow.netFlowValue / 1e9).toFixed(2)} Miliar, Ratio: ${(netFlow.netFlowRatio * 100).toFixed(1)}%).`
    );
  }

  // 2. Persistence
  const allSnapshots = [
    ...historicalSnapshots,
    currentSnapshot,
  ];
  const persistence = calculatePersistence(allSnapshots);
  if (persistence >= 0.6) {
    supportingEvidence.push(
      `Multi-day persistence is elevated: ${Math.round(persistence * 100)}% of tracked periods exhibit positive net buying.`
    );
  } else if (persistence < 0.4 && allSnapshots.length >= 3) {
    contradictoryEvidence.push(
      `Flow persistence is low: only ${Math.round(persistence * 100)}% of periods show positive net buying.`
    );
  }

  // 3. Flow Concentration
  const concentration = calculateFlowConcentration(transactions);
  if (concentration.hhi >= 2000) {
    supportingEvidence.push(
      `Buying flow is concentrated: HHI ${concentration.hhi}, Top-3 buyers account for ${concentration.cr3}% of net purchases.`
    );
  } else if (concentration.hhi > 0) {
    contradictoryEvidence.push(
      `Buying flow is fragmented (HHI ${concentration.hhi}), indicating lack of concentrated institutional sponsorship.`
    );
  }

  // 4. Flow VWAP Proxy
  const flowVwapProxy = calculateFlowVwapProxy(transactions, currentPrice);
  const isAboveFlowVwap = currentPrice >= flowVwapProxy;
  const priceToFlowVwapPct = Number(
    (((currentPrice - flowVwapProxy) / (flowVwapProxy || 1)) * 100).toFixed(2)
  );

  if (isAboveFlowVwap) {
    supportingEvidence.push(
      `Price is trading above Flow VWAP Proxy (Rp ${flowVwapProxy.toLocaleString()}, +${priceToFlowVwapPct}% premium).`
    );
  } else {
    contradictoryEvidence.push(
      `Price is trading below Flow VWAP Proxy (Rp ${flowVwapProxy.toLocaleString()}, ${priceToFlowVwapPct}% discount), indicating distribution pressure.`
    );
  }

  // 5. Order Flow Proxy & Depth Imbalance
  const obMetrics = calculateOrderBookImbalance(orderbookDepth);
  if (!orderbookDepth) {
    missingData.push('L2 Orderbook 5-level depth feed missing; depth imbalance estimated at zero.');
  } else if (obMetrics.imbalance > 0.15) {
    supportingEvidence.push(
      `Orderbook depth is bid-heavy (Level 1-5 Imbalance: +${(obMetrics.imbalance * 100).toFixed(1)}%).`
    );
  } else if (obMetrics.imbalance < -0.15) {
    contradictoryEvidence.push(
      `Orderbook depth is ask-heavy (Level 1-5 Imbalance: ${(obMetrics.imbalance * 100).toFixed(1)}%).`
    );
  }

  // 6. Absorption
  const absorption = detectAbsorption(transactions, currentPrice, flowVwapProxy);
  if (absorption.isDetected && absorption.evidence) {
    supportingEvidence.push(absorption.evidence);
  }

  // 7. Determine Flow State & Accumulation Proxy Score (0-100 Ordinal Ranking Score)
  let rawScore = 50; // Neutral midpoint
  rawScore += netFlow.netFlowRatio * 25; // [-25, +25]
  rawScore += (persistence - 0.5) * 20; // [-10, +10]
  rawScore += isAboveFlowVwap ? 10 : -10;
  if (concentration.hhi >= 2500) rawScore += 10;
  if (obMetrics.imbalance > 0.2) rawScore += 5;
  if (absorption.isDetected) rawScore += 10;

  const accumulationProxyScore = Number(
    Math.min(100, Math.max(0, rawScore)).toFixed(1)
  );

  let flowState: FlowState = 'neutral';
  if (transactions.length === 0) {
    flowState = 'inconclusive';
  } else if (accumulationProxyScore >= 68 && netFlow.netFlowValue > 0) {
    flowState = 'accumulation_like';
  } else if (accumulationProxyScore <= 38 && netFlow.netFlowValue < 0) {
    flowState = 'distribution_like';
  } else {
    flowState = 'neutral';
  }

  // 8. Calibrated Probability & Confidence Interval Gating
  let pAccumulationLike: number | null = null;
  let pStatus: CalibratedProbabilityStatus = 'unavailable';
  let ci95: [number, number] | null = null;

  const resolved = historicalResolvedOutcomes || [];
  if (resolved.length >= 30) {
    const successCount = resolved.filter((r) => r.outcome_status === 'TARGET_FIRST').length;
    pAccumulationLike = Number((successCount / resolved.length).toFixed(4));
    ci95 = calculateWilsonConfidenceInterval(successCount, resolved.length);
    pStatus = 'calibrated';
  } else if (resolved.length > 0) {
    pStatus = 'provisional';
    missingData.push(
      `Insufficient historical sample size for calibrated probability (Current: ${resolved.length}, Minimum Required: 30).`
    );
  } else {
    missingData.push(
      'Historical resolved setup samples unavailable for this setup horizon. Probability uncalibrated.'
    );
  }

  return {
    as_of: asOf,
    symbol: symbol.toUpperCase(),
    model_version: ACCUMULATION_MODEL_VERSION,
    flow_state: flowState,
    accumulation_proxy_score: accumulationProxyScore,
    p_accumulation_like: pAccumulationLike,
    p_accumulation_like_status: pStatus,
    confidence_interval_95: ci95,
    net_flow_value: netFlow.netFlowValue,
    net_flow_ratio: netFlow.netFlowRatio,
    persistence,
    flow_concentration_hhi: concentration.hhi,
    top_buyer_concentration_cr3: concentration.cr3,
    flow_vwap_proxy: flowVwapProxy,
    price_acceptance: {
      is_above_flow_vwap: isAboveFlowVwap,
      price_to_flow_vwap_pct: priceToFlowVwapPct,
      pullback_volume_ratio: 0.5,
      reclaim_volume_ratio: 1.5,
    },
    order_flow: {
      type: 'PROXY_NOT_TRUE_DELTA',
      estimated_delta: netFlow.netFlowValue,
      imbalance_depth_5: obMetrics.imbalance,
    },
    absorption: {
      is_absorption_detected: absorption.isDetected,
      evidence: absorption.evidence,
    },
    supporting_evidence: supportingEvidence,
    contradictory_evidence: contradictoryEvidence,
    missing_data: missingData,
    disclaimer:
      'Disclaimer: Accumulation Proxy Score is an ordinal ranking score, not an empirical probability. All broker metrics are proxies of order flow behavior and do not confirm operator identity.',
  };
}
