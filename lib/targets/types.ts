/**
 * lib/targets/types.ts - Dynamic Target & Invalidation Engine V2 Types (Adimology V6)
 * PRD V6 Phase 6: Multi-Target Ladder, Volatility-Grounded Invalidation, and RRR Validation.
 */

export interface TargetLadder {
  /** Conservative base target (approx 1.5x risk) */
  t1_realistic: number;
  /** Moderate stretch target (approx 2.5x risk) */
  t2_stretch: number;
  /** Structural ceiling / maximum resistance */
  t_max: number;
  /** Objective market-microstructure invalidation / stop loss */
  invalidation_price: number;
  /** Preserved baseline control from original Adimology formula */
  legacy_adimology_target: number;
  /** Legacy max target */
  legacy_adimology_max: number;
  /** Risk-Reward Ratio based on T1 vs Invalidation */
  risk_reward_ratio: number;
  /** True if RRR >= 1.5 (minimum institutional viability threshold) */
  is_rrr_acceptable: boolean;
  /** IDX Fraksi (price step size) applied */
  fraksi: number;
  /** Effective ATR used */
  effective_atr: number;
  /** Risk per share (currentPrice - invalidation) */
  risk_amount: number;
  /** Reward per share at T1 (T1 - currentPrice) */
  reward_amount: number;
  /** Audit explanation of barrier placements */
  rationale: string;
}

export interface TargetEngineInput {
  emiten?: string;
  current_price: number;
  bandar_vwap?: number | null;
  recent_swing_low?: number | null;
  recent_swing_high?: number | null;
  atr?: number | null;
  ara?: number | null;
  arb?: number | null;
  barang_bandar?: number | null;
  total_bid?: number | null;
  total_offer?: number | null;
  rata_rata_bandar?: number | null;
}
