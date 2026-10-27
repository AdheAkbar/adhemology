/**
 * lib/ledger/types.ts - Canonical Prediction Ledger Types (Adimology V6)
 * PRD V6 Phase 2: Immutable Prediction Snapshots, Detached Outcomes & Barrier Precedence.
 */

import type { TradingHorizon, QualityStatus } from '../data-truth/types';
export type { TradingHorizon, QualityStatus };

export type OutcomeStatus =
  | 'TARGET_FIRST'
  | 'INVALIDATION_FIRST'
  | 'TIME_STOP'
  | 'NO_FILL'
  | 'CANCELLED';

export interface PredictionRecord {
  id: string;
  created_at: string;
  ticker: string;
  as_of_date: string;
  horizon: TradingHorizon;
  price_at_prediction: number;
  target_price: number;
  invalidation_price: number;
  legacy_adimology_target?: number | null;
  time_stop_date: string;
  score_raw?: number | null;
  prob_calibrated?: number | null;
  quality_status: QualityStatus;
  capability_snapshot?: Record<string, any>;
  metadata?: Record<string, any>;
  prev_ledger_hash?: string; // SHA-256 of the previous ledger record for audit chain
  record_hash?: string;      // SHA-256 of this record
}

export interface OutcomeRecord {
  id: string;
  prediction_id: string;
  resolved_at: string;
  outcome_status: OutcomeStatus;
  outcome_price: number;
  return_pct: number;
  mfe: number; // Maximum Favorable Excursion (%)
  mae: number; // Maximum Adverse Excursion (%)
  bars_to_outcome: number;
  audit_log?: Record<string, any>;
}

export interface CandleBar {
  date: string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface LedgerInsertPayload {
  id?: string;
  ticker: string;
  as_of_date: string | Date;
  horizon: TradingHorizon;
  price_at_prediction: number;
  target_price: number;
  invalidation_price: number;
  legacy_adimology_target?: number | null;
  time_stop_date: string | Date;
  score_raw?: number | null;
  prob_calibrated?: number | null;
  quality_status?: QualityStatus;
  capability_snapshot?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ResolutionPayload {
  outcome_status: OutcomeStatus;
  outcome_price: number;
  return_pct?: number;
  mfe: number;
  mae: number;
  bars_to_outcome: number;
  audit_log?: Record<string, any>;
}

export interface BarrierPrecedenceOptions {
  /**
   * When both target and invalidation are crossed within the same bar,
   * conservative tie-breaker treats it as INVALIDATION_FIRST to avoid optimistic backtest bias.
   * Default: true.
   */
  conservativeTieBreaker?: boolean;
  /**
   * Optional entry trigger requirement (e.g. limit order).
   * If omitted, assumes immediate market fill at price_at_prediction.
   */
  entryCondition?: 'MARKET' | 'LIMIT';
  limitPrice?: number;
}

export interface BarrierPrecedenceResult {
  outcome_status: OutcomeStatus;
  outcome_price: number;
  return_pct: number;
  mfe: number;
  mae: number;
  bars_to_outcome: number;
  highest_price: number;
  lowest_price: number;
  resolved_bar_date: string;
  resolution_reason: string;
}

export interface LedgerFilterOptions {
  ticker?: string;
  horizon?: TradingHorizon;
  quality_status?: QualityStatus;
  outcome_status?: OutcomeStatus;
  hasOutcome?: boolean;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}
