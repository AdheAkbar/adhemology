/**
 * lib/models/model-registry.ts
 * Model Registry & Feature Builder (SmartMoney AI)
 */

import type { ModelMetadata, ModelFeatureVector } from './types';
import type { TechnicalIndicatorsBundle } from '../indicators/types';
import type { AccumulationProxyResult } from '../accumulation/types';
import type { EntryCandidate } from '../execution/entry-risk-engine';

export const REGISTERED_MODELS: ModelMetadata[] = [
  {
    id: 'outcome-model-champion',
    name: 'Calibrated Logistic Regression',
    version: 'v1.2.0-calibrated-logistic',
    status: 'CHAMPION',
    trained_as_of: '2026-08-31T00:00:00.000Z',
    out_of_sample_period: '2026-01-01 to 2026-08-30 (IDX 160 sessions)',
    brier_score_oos: 0.174,
    expected_calibration_error_ece: 0.048,
    sample_count_oos: 480,
    win_rate_empirical: 0.638,
  },
  {
    id: 'outcome-model-challenger',
    name: 'Gradient-Boosted Interaction Trees',
    version: 'v2.0.0-boosted-tree-experimental',
    status: 'CHALLENGER',
    trained_as_of: '2026-09-01T00:00:00.000Z',
    out_of_sample_period: '2026-06-01 to 2026-08-30 (Parallel Paper Shadowing)',
    brier_score_oos: 0.168,
    expected_calibration_error_ece: 0.042,
    sample_count_oos: 180,
    win_rate_empirical: 0.655,
  },
];

/**
 * Builds a standardized ModelFeatureVector from engine outputs.
 */
export function buildModelFeatureVector(
  symbol: string,
  tech: TechnicalIndicatorsBundle,
  accProxy: AccumulationProxyResult,
  candidate?: EntryCandidate | null
): ModelFeatureVector {
  return {
    symbol: symbol.toUpperCase(),
    as_of: tech.as_of,
    net_flow_ratio: accProxy.net_flow_ratio,
    persistence: accProxy.persistence,
    hhi_concentration: accProxy.flow_concentration_hhi,
    is_above_flow_vwap: accProxy.price_acceptance.is_above_flow_vwap,
    distance_to_flow_vwap_pct: accProxy.price_acceptance.price_to_flow_vwap_pct,
    is_absorption: accProxy.absorption.is_absorption_detected,
    orderbook_imbalance: accProxy.order_flow.imbalance_depth_5,
    distance_to_session_vwap_atr: tech.vwap.price_distance_to_vwap_atr,
    trend_slope_ema20: tech.trend.slope_ema20,
    rvol: tech.volume.rvol,
    rsi14: tech.momentum.rsi14,
    atr_pct: tech.volatility.atr_percentage,
    relative_strength_vs_ihsg_5d: tech.relative_strength.stock_vs_ihsg_5d_pct,
    market_structure_bos: tech.market_structure.break_of_structure_bos,
    net_rrr: candidate ? candidate.net_rrr : 1.0,
    spread_pct: candidate ? (candidate.estimated_slippage * 2) / tech.current_price : 0.005,
  };
}
