/**
 * lib/ledger/auto-resolution.ts - Real-Price Tracking & Auto-Resolution Engine (Adimology V6)
 * PRD V6 Phase 11: Background Resolution of Open Predictions against Market Data.
 */

import { listPredictions, evaluateBarrierPrecedence, resolveOutcome } from './prediction-ledger';
import type { CandleBar, PredictionRecord, OutcomeRecord } from './types';

export interface ResolvedSummaryItem {
  prediction_id: string;
  ticker: string;
  outcome_status: string;
  outcome_price: number;
  return_pct: number;
  bars_to_outcome: number;
  resolution_reason: string;
}

export interface AutoResolutionSummary {
  timestamp: string;
  total_scanned: number;
  resolved_count: number;
  pending_count: number;
  resolved_items: ResolvedSummaryItem[];
}

/**
 * Automatically evaluates open predictions against latest market candle bars
 * and records detached outcomes into the immutable ledger.
 */
export async function runAutoResolution(
  feedByTicker: Record<string, CandleBar[]> = {}
): Promise<AutoResolutionSummary> {
  // 1. Fetch all open predictions without outcomes
  const { items: openItems } = await listPredictions({ hasOutcome: false, limit: 200 });

  const resolvedItems: ResolvedSummaryItem[] = [];
  let pendingCount = 0;

  for (const item of openItems) {
    const pred = item.prediction;
    const tickerBars = feedByTicker[pred.ticker] || [];

    if (tickerBars.length === 0) {
      pendingCount++;
      continue;
    }

    // Evaluate barrier precedence
    const result = evaluateBarrierPrecedence(pred, tickerBars, {
      conservativeTieBreaker: true,
    });

    // Check if a terminal outcome was triggered
    const lastBar = tickerBars[tickerBars.length - 1];
    const isPastTimeStop = new Date(lastBar.date).getTime() >= new Date(pred.time_stop_date).getTime();

    const isTerminal =
      result.outcome_status === 'TARGET_FIRST' ||
      result.outcome_status === 'INVALIDATION_FIRST' ||
      (result.outcome_status === 'TIME_STOP' && isPastTimeStop);

    if (isTerminal) {
      await resolveOutcome(pred.id, {
        outcome_status: result.outcome_status,
        outcome_price: result.outcome_price,
        return_pct: result.return_pct,
        mfe: result.mfe,
        mae: result.mae,
        bars_to_outcome: result.bars_to_outcome,
        audit_log: {
          resolution_reason: result.resolution_reason,
          resolved_bar_date: result.resolved_bar_date,
          auto_resolved_at: new Date().toISOString(),
        },
      });

      resolvedItems.push({
        prediction_id: pred.id,
        ticker: pred.ticker,
        outcome_status: result.outcome_status,
        outcome_price: result.outcome_price,
        return_pct: result.return_pct,
        bars_to_outcome: result.bars_to_outcome,
        resolution_reason: result.resolution_reason,
      });
    } else {
      pendingCount++;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    total_scanned: openItems.length,
    resolved_count: resolvedItems.length,
    pending_count: pendingCount,
    resolved_items: resolvedItems,
  };
}
