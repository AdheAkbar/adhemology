/**
 * lib/ledger/prediction-ledger.ts - Prediction Ledger Service (Adimology V6)
 * PRD V6 Phase 2: Immutable Prediction Snapshots, Detached Outcomes & Barrier Precedence Engine.
 */

import { createHash } from 'crypto';
import { supabase } from '../supabase';
import type {
  PredictionRecord,
  OutcomeRecord,
  CandleBar,
  LedgerInsertPayload,
  ResolutionPayload,
  BarrierPrecedenceOptions,
  BarrierPrecedenceResult,
  LedgerFilterOptions,
} from './types';

// In-Memory Storage for zero-latency lookups, tests, and offline/fallback execution
const inMemoryPredictions = new Map<string, PredictionRecord>();
const inMemoryOutcomes = new Map<string, OutcomeRecord>();
let lastLedgerHash = 'genesis-hash-00000000000000000000000000000000';

/**
 * Check whether Supabase is configured with real credentials (not placeholder)
 */
function isSupabaseLive(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && !url.includes('placeholder.supabase.co'));
}

/**
 * Record a new prediction snapshot.
 * IMMUTABLE: Once recorded, core parameters cannot be altered.
 * HASH-CHAINED: Links to previous ledger entry via SHA-256 for cryptographic auditability.
 */
export async function recordPrediction(payload: LedgerInsertPayload): Promise<PredictionRecord> {
  const id = payload.id || crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const asOfDateStr =
    payload.as_of_date instanceof Date
      ? payload.as_of_date.toISOString()
      : new Date(payload.as_of_date).toISOString();
  const timeStopStr =
    payload.time_stop_date instanceof Date
      ? payload.time_stop_date.toISOString()
      : new Date(payload.time_stop_date).toISOString();

  const prevHash = lastLedgerHash;
  const hashRaw = `${id}:${payload.ticker}:${asOfDateStr}:${payload.price_at_prediction}:${payload.target_price}:${prevHash}`;
  const recordHash = createHash('sha256').update(hashRaw).digest('hex');
  lastLedgerHash = recordHash;

  const record: PredictionRecord = {
    id,
    created_at: createdAt,
    ticker: payload.ticker.toUpperCase(),
    as_of_date: asOfDateStr,
    horizon: payload.horizon,
    price_at_prediction: Number(payload.price_at_prediction),
    target_price: Number(payload.target_price),
    invalidation_price: Number(payload.invalidation_price),
    legacy_adimology_target:
      payload.legacy_adimology_target != null ? Number(payload.legacy_adimology_target) : null,
    time_stop_date: timeStopStr,
    score_raw: payload.score_raw != null ? Number(payload.score_raw) : null,
    prob_calibrated: payload.prob_calibrated != null ? Number(payload.prob_calibrated) : null,
    quality_status: payload.quality_status || 'CONFIRMED',
    capability_snapshot: payload.capability_snapshot || {},
    metadata: payload.metadata || {},
    prev_ledger_hash: prevHash,
    record_hash: recordHash,
  };

  // Always store in in-memory ledger
  inMemoryPredictions.set(id, Object.freeze({ ...record }));

  // Persist to Supabase if live
  if (isSupabaseLive()) {
    try {
      const { error } = await supabase.from('predictions').insert([record]);
      if (error) {
        console.warn('[PredictionLedger] Supabase insert warning, fallback to memory:', error.message);
      }
    } catch (err: any) {
      console.warn('[PredictionLedger] Supabase connection failed:', err.message);
    }
  }

  return record;
}

/**
 * Enforce Immutability Guard in code.
 * Directly rejects any attempt to mutate a prediction record.
 */
export async function updatePrediction(id: string, _updates: Partial<PredictionRecord>): Promise<never> {
  throw new Error(
    `[PredictionLedger:ImmutabilityViolation] Prediction "${id}" is immutable. Updates to prediction records are strictly prohibited.`
  );
}

/**
 * Resolve an outcome for an existing prediction.
 * Outcoms are stored in a detached table linked by prediction_id.
 */
export async function resolveOutcome(
  predictionId: string,
  payload: ResolutionPayload
): Promise<OutcomeRecord> {
  const prediction = inMemoryPredictions.get(predictionId);
  if (!prediction && !isSupabaseLive()) {
    throw new Error(`[PredictionLedger] Prediction "${predictionId}" not found for resolution.`);
  }

  const id = crypto.randomUUID();
  const resolvedAt = new Date().toISOString();

  const returnPct =
    payload.return_pct != null
      ? payload.return_pct
      : prediction
      ? Number((((payload.outcome_price - prediction.price_at_prediction) / prediction.price_at_prediction) * 100).toFixed(2))
      : 0;

  const outcomeRecord: OutcomeRecord = {
    id,
    prediction_id: predictionId,
    resolved_at: resolvedAt,
    outcome_status: payload.outcome_status,
    outcome_price: Number(payload.outcome_price),
    return_pct: Number(returnPct),
    mfe: Number(payload.mfe.toFixed(2)),
    mae: Number(payload.mae.toFixed(2)),
    bars_to_outcome: payload.bars_to_outcome,
    audit_log: payload.audit_log || {},
  };

  inMemoryOutcomes.set(predictionId, Object.freeze({ ...outcomeRecord }));

  if (isSupabaseLive()) {
    try {
      const { error } = await supabase.from('prediction_outcomes').insert([outcomeRecord]);
      if (error) {
        console.warn('[PredictionLedger] Supabase outcome insert warning:', error.message);
      }
    } catch (err: any) {
      console.warn('[PredictionLedger] Supabase outcome failed:', err.message);
    }
  }

  return outcomeRecord;
}

/**
 * Evaluate Barrier Precedence against a series of chronological candle bars.
 * Evaluates:
 * 1. TARGET_FIRST (high >= target_price)
 * 2. INVALIDATION_FIRST (low <= invalidation_price)
 * 3. TIME_STOP (bar date reaches or passes time_stop_date)
 * 4. Same-bar collision: Uses conservative tie-breaker (INVALIDATION_FIRST) to eliminate optimistic bias.
 * Tracks accurate running MFE and MAE.
 */
export function evaluateBarrierPrecedence(
  prediction: PredictionRecord,
  bars: CandleBar[],
  options: BarrierPrecedenceOptions = {}
): BarrierPrecedenceResult {
  const conservativeTieBreaker = options.conservativeTieBreaker ?? true;
  const p0 = prediction.price_at_prediction;
  const target = prediction.target_price;
  const invalidation = prediction.invalidation_price;
  const timeStopTs = new Date(prediction.time_stop_date).getTime();

  if (!bars || bars.length === 0) {
    return {
      outcome_status: 'NO_FILL',
      outcome_price: p0,
      return_pct: 0,
      mfe: 0,
      mae: 0,
      bars_to_outcome: 0,
      highest_price: p0,
      lowest_price: p0,
      resolved_bar_date: prediction.as_of_date,
      resolution_reason: 'No price bars provided for evaluation.',
    };
  }

  let highestPrice = p0;
  let lowestPrice = p0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const barDateTs = new Date(bar.date).getTime();

    // Update running extremes
    highestPrice = Math.max(highestPrice, bar.high);
    lowestPrice = Math.min(lowestPrice, bar.low);

    const currentMfe = Number((((highestPrice - p0) / p0) * 100).toFixed(2));
    const currentMae = Number((((lowestPrice - p0) / p0) * 100).toFixed(2));

    const hitsTarget = bar.high >= target;
    const hitsInvalidation = bar.low <= invalidation;
    const hitsTimeStop = barDateTs >= timeStopTs;

    // Case 1: Same bar collision (both target and invalidation touched)
    if (hitsTarget && hitsInvalidation) {
      if (conservativeTieBreaker) {
        const exitPrice = bar.open <= invalidation ? bar.open : invalidation;
        const returnPct = Number((((exitPrice - p0) / p0) * 100).toFixed(2));
        return {
          outcome_status: 'INVALIDATION_FIRST',
          outcome_price: exitPrice,
          return_pct: returnPct,
          mfe: currentMfe,
          mae: currentMae,
          bars_to_outcome: i + 1,
          highest_price: highestPrice,
          lowest_price: lowestPrice,
          resolved_bar_date: new Date(bar.date).toISOString(),
          resolution_reason:
            'Same-bar collision: Conservative tie-breaker prioritized Invalidation to prevent optimistic bias.',
        };
      } else {
        // Optimistic / tick-based fallback if configured
        const exitPrice = bar.open >= target ? bar.open : target;
        const returnPct = Number((((exitPrice - p0) / p0) * 100).toFixed(2));
        return {
          outcome_status: 'TARGET_FIRST',
          outcome_price: exitPrice,
          return_pct: returnPct,
          mfe: currentMfe,
          mae: currentMae,
          bars_to_outcome: i + 1,
          highest_price: highestPrice,
          lowest_price: lowestPrice,
          resolved_bar_date: new Date(bar.date).toISOString(),
          resolution_reason: 'Same-bar collision: Non-conservative option evaluated target first.',
        };
      }
    }

    // Case 2: Invalidation reached first
    if (hitsInvalidation) {
      const exitPrice = bar.open <= invalidation ? bar.open : invalidation;
      const returnPct = Number((((exitPrice - p0) / p0) * 100).toFixed(2));
      return {
        outcome_status: 'INVALIDATION_FIRST',
        outcome_price: exitPrice,
        return_pct: returnPct,
        mfe: currentMfe,
        mae: currentMae,
        bars_to_outcome: i + 1,
        highest_price: highestPrice,
        lowest_price: lowestPrice,
        resolved_bar_date: new Date(bar.date).toISOString(),
        resolution_reason: `Invalidation barrier breached at ${exitPrice}.`,
      };
    }

    // Case 3: Target reached first
    if (hitsTarget) {
      const exitPrice = bar.open >= target ? bar.open : target;
      const returnPct = Number((((exitPrice - p0) / p0) * 100).toFixed(2));
      return {
        outcome_status: 'TARGET_FIRST',
        outcome_price: exitPrice,
        return_pct: returnPct,
        mfe: currentMfe,
        mae: currentMae,
        bars_to_outcome: i + 1,
        highest_price: highestPrice,
        lowest_price: lowestPrice,
        resolved_bar_date: new Date(bar.date).toISOString(),
        resolution_reason: `Target barrier reached at ${exitPrice}.`,
      };
    }

    // Case 4: Time stop reached without hitting target or invalidation
    if (hitsTimeStop) {
      const exitPrice = bar.close;
      const returnPct = Number((((exitPrice - p0) / p0) * 100).toFixed(2));
      return {
        outcome_status: 'TIME_STOP',
        outcome_price: exitPrice,
        return_pct: returnPct,
        mfe: currentMfe,
        mae: currentMae,
        bars_to_outcome: i + 1,
        highest_price: highestPrice,
        lowest_price: lowestPrice,
        resolved_bar_date: new Date(bar.date).toISOString(),
        resolution_reason: `Time stop horizon reached on ${new Date(bar.date).toISOString()}. Exited at close.`,
      };
    }
  }

  // If bars finished without reaching any terminal barrier, exit at latest close
  const lastBar = bars[bars.length - 1];
  const exitPrice = lastBar.close;
  const returnPct = Number((((exitPrice - p0) / p0) * 100).toFixed(2));
  const finalMfe = Number((((highestPrice - p0) / p0) * 100).toFixed(2));
  const finalMae = Number((((lowestPrice - p0) / p0) * 100).toFixed(2));

  return {
    outcome_status: 'TIME_STOP',
    outcome_price: exitPrice,
    return_pct: returnPct,
    mfe: finalMfe,
    mae: finalMae,
    bars_to_outcome: bars.length,
    highest_price: highestPrice,
    lowest_price: lowestPrice,
    resolved_bar_date: new Date(lastBar.date).toISOString(),
    resolution_reason: 'End of available candle bars reached prior to barrier hits. Exited at latest close.',
  };
}

/**
 * Retrieve a prediction by ID with its detached outcome if resolved.
 */
export async function getPrediction(
  id: string
): Promise<{ prediction: PredictionRecord; outcome?: OutcomeRecord } | null> {
  // Check in-memory store
  const memPred = inMemoryPredictions.get(id);
  const memOutcome = inMemoryOutcomes.get(id);

  if (memPred) {
    return { prediction: memPred, outcome: memOutcome };
  }

  if (isSupabaseLive()) {
    try {
      const { data: predData } = await supabase.from('predictions').select('*').eq('id', id).single();
      if (!predData) return null;

      const { data: outcomeData } = await supabase
        .from('prediction_outcomes')
        .select('*')
        .eq('prediction_id', id)
        .single();

      return {
        prediction: predData as PredictionRecord,
        outcome: (outcomeData as OutcomeRecord) || undefined,
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * List predictions with filtering and pagination.
 */
export async function listPredictions(
  filters: LedgerFilterOptions = {}
): Promise<{ items: Array<{ prediction: PredictionRecord; outcome?: OutcomeRecord }>; total: number }> {
  // Use in-memory data
  let all = Array.from(inMemoryPredictions.values());

  if (filters.ticker) {
    const t = filters.ticker.toUpperCase();
    all = all.filter((p) => p.ticker === t);
  }
  if (filters.horizon) {
    all = all.filter((p) => p.horizon === filters.horizon);
  }
  if (filters.quality_status) {
    all = all.filter((p) => p.quality_status === filters.quality_status);
  }
  if (filters.fromDate) {
    all = all.filter((p) => new Date(p.as_of_date) >= new Date(filters.fromDate!));
  }
  if (filters.toDate) {
    all = all.filter((p) => new Date(p.as_of_date) <= new Date(filters.toDate!));
  }

  let mapped = all.map((p) => ({
    prediction: p,
    outcome: inMemoryOutcomes.get(p.id),
  }));

  if (filters.outcome_status) {
    mapped = mapped.filter((item) => item.outcome?.outcome_status === filters.outcome_status);
  }
  if (filters.hasOutcome !== undefined) {
    mapped = mapped.filter((item) => Boolean(item.outcome) === filters.hasOutcome);
  }

  // Sort descending by as_of_date
  mapped.sort((a, b) => new Date(b.prediction.as_of_date).getTime() - new Date(a.prediction.as_of_date).getTime());

  const total = mapped.length;
  const offset = filters.offset || 0;
  const limit = filters.limit || 50;
  const paged = mapped.slice(offset, offset + limit);

  return { items: paged, total };
}

/**
 * Utility for test suites to reset memory
 */
export function clearInMemoryLedger(): void {
  inMemoryPredictions.clear;
  inMemoryPredictions.clear();
  inMemoryOutcomes.clear();
}
