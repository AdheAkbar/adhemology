/**
 * lib/journal/types.ts
 * Types for AI Signal Journal & Post-Mortem Learning Lab (SmartMoney AI)
 */

export type SignalOutcome =
  | 'TARGET_1_HIT'
  | 'TARGET_2_HIT'
  | 'STOP_HIT'
  | 'TIMEOUT'
  | 'NO_FILL'
  | 'AMBIGUOUS_BAR'
  | 'DATA_ERROR'
  | 'NEWS_SHOCK'
  | 'TRADING_HALTED';

export type MistakeRootCause =
  | 'false_accumulation'
  | 'late_entry'
  | 'entry_too_far_from_vwap'
  | 'breakout_failure'
  | 'stop_too_tight'
  | 'target_too_optimistic'
  | 'slippage_high'
  | 'spread_too_wide'
  | 'liquidity_failure'
  | 'news_shock'
  | 'wrong_market_regime'
  | 'stale_data'
  | 'broker_flow_misinterpretation'
  | 'model_overconfidence'
  | 'none';

export interface SignalJournalEntry {
  signal_id: string;
  symbol: string;
  generated_at: string;
  data_as_of: string;
  timeframe: string;
  setup_type: string;
  feature_snapshot: Record<string, any>;
  accumulation_proxy_score: number;
  p_accumulation_like: number | null;
  p_target_before_stop: number | null;
  rank_score: number;
  model_version: string;
  entry_zone: [number, number];
  recommended_entry: number;
  actual_fill: number | null;
  stop: number;
  target_1: number;
  target_2: number;
  slippage: number;
  transaction_cost: number;
  outcome: SignalOutcome;
  mfe: number; // Maximum Favorable Excursion (% or points)
  mae: number; // Maximum Adverse Excursion (% or points)
  realized_r: number | null; // Realized Risk multiple
  time_to_target_bars: number | null;
  time_to_stop_bars: number | null;
  news_at_signal_time: string | null;
  user_override: boolean;
  data_quality_status: string;
  mistake_classification?: MistakeRootCause;
  post_mortem_notes?: string;
}

export interface WeeklyPostMortemReport {
  report_id: string;
  period_start: string;
  period_end: string;
  total_signals_generated: number;
  total_trades_taken: number;
  win_rate: number;
  profit_factor: number;
  average_realized_r: number;
  max_drawdown_pct: number;
  brier_score_period: number;
  expected_calibration_error: number;
  champion_vs_challenger: {
    champion_win_rate: number;
    challenger_win_rate: number;
    delta_expectancy: number;
    recommendation: string;
  };
  mistake_breakdown: Record<MistakeRootCause, number>;
  top_misleading_features: string[];
  parameter_change_proposals: {
    parameter: string;
    proposed_change: string;
    sample_evidence_count: number;
    statistical_significance_p: number;
    risks_if_applied: string;
    status: 'REJECTED_INSUFFICIENT_EVIDENCE' | 'QUEUED_FOR_PAPER_TEST' | 'APPROVED';
  }[];
}
