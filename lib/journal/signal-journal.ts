/**
 * lib/journal/signal-journal.ts
 * AI Signal Journal Repository & Execution Resolution (SmartMoney AI)
 */

import type { SignalJournalEntry, SignalOutcome, MistakeRootCause } from './types';
import type { OHLCVBar } from '../indicators/types';

// In-Memory Journal store for offline/local resilience
const inMemoryJournal = new Map<string, SignalJournalEntry>();

/**
 * Records a new trade signal in the immutable Signal Journal.
 */
export function logSignalToJournal(entry: SignalJournalEntry): SignalJournalEntry {
  const frozen = Object.freeze({ ...entry });
  inMemoryJournal.set(entry.signal_id, frozen);
  return frozen;
}

/**
 * Retrieves all signals from the journal, sorted descending by generation time.
 */
export function getAllJournalSignals(): SignalJournalEntry[] {
  return Array.from(inMemoryJournal.values()).sort((a, b) =>
    b.generated_at.localeCompare(a.generated_at)
  );
}

/**
 * Resolves a signal outcome against chronological forward candle bars.
 * Enforces Ambiguous Bar Resolution:
 * If High >= Target and Low <= Stop within the same candle, check if lower timeframe exists.
 * If not, mark strictly as AMBIGUOUS_BAR (never force arbitrary win or loss).
 */
export function resolveSignalOutcome(
  signal: SignalJournalEntry,
  forwardBars: OHLCVBar[],
  hasSubCandleTicks: boolean = false,
  subCandleTargetFirst?: boolean
): {
  outcome: SignalOutcome;
  mfe: number;
  mae: number;
  realizedR: number | null;
  barsToOutcome: number;
  mistakeCause?: MistakeRootCause;
} {
  const entryPrice = signal.actual_fill || signal.recommended_entry;
  const target = signal.target_1;
  const stop = signal.stop;
  const initialRisk = entryPrice - stop;

  let maxPrice = entryPrice;
  let minPrice = entryPrice;

  for (let i = 0; i < forwardBars.length; i++) {
    const bar = forwardBars[i];
    if (bar.high > maxPrice) maxPrice = bar.high;
    if (bar.low < minPrice) minPrice = bar.low;

    const hitTarget = bar.high >= target;
    const hitStop = bar.low <= stop;

    // Ambiguous Bar Check
    if (hitTarget && hitStop) {
      if (hasSubCandleTicks && subCandleTargetFirst !== undefined) {
        const outcome: SignalOutcome = subCandleTargetFirst ? 'TARGET_1_HIT' : 'STOP_HIT';
        const realizedR = subCandleTargetFirst ? Number(((target - entryPrice) / initialRisk).toFixed(2)) : -1.0;
        return {
          outcome,
          mfe: Number((((maxPrice - entryPrice) / entryPrice) * 100).toFixed(2)),
          mae: Number((((entryPrice - minPrice) / entryPrice) * 100).toFixed(2)),
          realizedR,
          barsToOutcome: i + 1,
        };
      }

      // Mandatory quant rule: Mark AMBIGUOUS_BAR
      return {
        outcome: 'AMBIGUOUS_BAR',
        mfe: Number((((maxPrice - entryPrice) / entryPrice) * 100).toFixed(2)),
        mae: Number((((entryPrice - minPrice) / entryPrice) * 100).toFixed(2)),
        realizedR: null,
        barsToOutcome: i + 1,
        mistakeCause: 'none',
      };
    }

    if (hitTarget) {
      const realizedR = initialRisk > 0 ? Number(((target - entryPrice) / initialRisk).toFixed(2)) : 1.5;
      return {
        outcome: 'TARGET_1_HIT',
        mfe: Number((((maxPrice - entryPrice) / entryPrice) * 100).toFixed(2)),
        mae: Number((((entryPrice - minPrice) / entryPrice) * 100).toFixed(2)),
        realizedR,
        barsToOutcome: i + 1,
      };
    }

    if (hitStop) {
      // Classify error root cause
      let cause: MistakeRootCause = 'breakout_failure';
      if (signal.feature_snapshot?.distance_to_session_vwap_atr > 2.0) {
        cause = 'entry_too_far_from_vwap';
      } else if (signal.stop_distance < (signal.feature_snapshot?.atr14 || 10) * 0.8) {
        cause = 'stop_too_tight';
      } else if (signal.feature_snapshot?.net_flow_ratio < 0) {
        cause = 'false_accumulation';
      }

      return {
        outcome: 'STOP_HIT',
        mfe: Number((((maxPrice - entryPrice) / entryPrice) * 100).toFixed(2)),
        mae: Number((((entryPrice - minPrice) / entryPrice) * 100).toFixed(2)),
        realizedR: -1.0,
        barsToOutcome: i + 1,
        mistakeCause: cause,
      };
    }
  }

  // Timeout reached
  return {
    outcome: 'TIMEOUT',
    mfe: Number((((maxPrice - entryPrice) / entryPrice) * 100).toFixed(2)),
    mae: Number((((entryPrice - minPrice) / entryPrice) * 100).toFixed(2)),
    realizedR: 0,
    barsToOutcome: forwardBars.length,
  };
}
