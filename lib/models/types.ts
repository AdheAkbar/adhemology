/**
 * lib/models/types.ts
 * Types for Two-Model Probability Architecture (SmartMoney AI)
 */

export interface ModelFeatureVector {
  symbol: string;
  as_of: string;
  // Flow features
  net_flow_ratio: number;
  persistence: number;
  hhi_concentration: number;
  is_above_flow_vwap: boolean;
  distance_to_flow_vwap_pct: number;
  is_absorption: boolean;
  orderbook_imbalance: number;
  
  // Technical features
  distance_to_session_vwap_atr: number;
  trend_slope_ema20: number;
  rvol: number;
  rsi14: number;
  atr_pct: number;
  relative_strength_vs_ihsg_5d: number;
  market_structure_bos: boolean;
  
  // Risk & Cost features
  net_rrr: number;
  spread_pct: number;
}

export interface ModelPrediction {
  model_id: string;
  model_version: string;
  model_type: 'BASELINE_LOGISTIC' | 'CHALLENGER_TREE_BOOSTED';
  target_name: 'ACCUMULATION_STATE' | 'TARGET_BEFORE_STOP';
  raw_score: number; // 0 to 100 ordinal score
  calibrated_probability: number | null; // 0.0 to 1.0, strictly null if N < 30
  is_calibrated: boolean;
  calibration_method: 'SIGMOID_PLATT' | 'ISOTONIC' | 'EMPIRICAL_BINNED' | 'NONE';
  confidence_interval_95: [number, number] | null;
  sample_size: number;
  brier_score: number | null;
  reason_code: 'OK' | 'INSUFFICIENT_HISTORY' | 'DATA_UNAVAILABLE' | 'PROVISIONAL';
}

export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  status: 'CHAMPION' | 'CHALLENGER' | 'ARCHIVED';
  trained_as_of: string;
  out_of_sample_period: string;
  brier_score_oos: number;
  expected_calibration_error_ece: number;
  sample_count_oos: number;
  win_rate_empirical: number;
}
