import type { TradingHorizon } from '../data-truth/types';
export type { TradingHorizon };

export interface RankScore {
  /** Ordinal ranking score relative to other setups (0 to 100) */
  value: number;
  /** Relative rank tier */
  tier: 'TOP_TIER' | 'ABOVE_AVERAGE' | 'NEUTRAL' | 'BELOW_AVERAGE';
  /** Optional percentile rank among current universe (0 - 100) */
  percentile?: number;
}

export interface CalibratedProbability {
  /** True empirical probability of reaching target before invalidation (0.0 to 1.0) */
  probability: number | null;
  /** True if backed by sufficient historical sample size (N >= threshold) */
  is_calibrated: boolean;
  /** Number of historical resolved setups in this calibration pool */
  sample_size: number;
  /** Historical Brier Score for this model/pool (0.0 = perfect, 0.25 = uninformative coin toss) */
  brier_score: number | null;
  /** 95% Wilson score confidence interval [lower, upper] */
  confidence_interval?: [number, number] | null;
  /** Reason code if uncalibrated or degraded */
  reason_code?: string;
  /** Calibrated percentage, e.g. 72.0 */
  calibrated_p?: number;
  /** Calibration decile (1 to 10) */
  calibration_decile?: number;
}

export interface PredictionOutcomePair {
  /** Predicted probability between 0.0 and 1.0 */
  predicted_prob: number;
  /** Binary outcome: 1 if TARGET_FIRST, 0 if INVALIDATION_FIRST or TIME_STOP */
  actual_outcome: 0 | 1;
}

export interface BrierScoreResult {
  /** Mean squared error between predicted probabilities and binary outcomes */
  brier_score: number;
  /** Sample size used to calculate the score */
  sample_size: number;
  /** Qualitative interpretation of calibration accuracy */
  quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  /** Baseline comparison against naive climatological base-rate predictor */
  skill_score?: number;
}

export interface DecileBin {
  bin_index: number;
  range_min: number;
  range_max: number;
  count: number;
  mean_predicted_prob: number;
  observed_win_rate: number;
  calibration_gap: number;
}

export interface EceResult {
  /** Expected Calibration Error (weighted average gap between predicted and empirical) */
  ece: number;
  /** Calibration bins */
  bins: DecileBin[];
}

export interface FormattedScoreProb {
  rank_score_display: string;
  probability_display: string;
  status_label: string;
  badge_variant: 'success' | 'info' | 'warning' | 'neutral';
  tooltip: string;
  is_calibrated: boolean;
}

export interface CalibrationDecileRecord {
  id?: string;
  calibration_id?: string;
  decile_index: number; // 1 to 10
  bin_min: number;
  bin_max: number;
  mean_predicted_prob: number;
  observed_win_rate: number;
  sample_count: number;
  calibration_gap: number;
}

export interface ModelCalibrationRecord {
  id: string;
  model_name: string;
  horizon: TradingHorizon;
  computed_at: string;
  sample_size: number;
  brier_score: number;
  brier_skill_score: number | null;
  ece: number; // Expected Calibration Error
  log_loss: number | null;
  is_active: boolean;
  deciles: CalibrationDecileRecord[];
  metadata?: Record<string, any>;
}

export interface DriftAssessment {
  has_drift: boolean;
  delta_ece: number;
  delta_brier: number;
  severity: 'NONE' | 'LOW' | 'HIGH';
  description: string;
}
