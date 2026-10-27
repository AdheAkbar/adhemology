/**
 * lib/calibration/calibration-storage.ts - Persistent Calibration & Decile Tracking (Adimology V6)
 * PRD V6 Phase 4: Model Calibrations, 10-Decile Reliability Curves, and Drift Detection.
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import {
  calculateBrierScore,
  calculateExpectedCalibrationError,
} from './probability-engine';
import type {
  ModelCalibrationRecord,
  CalibrationDecileRecord,
  PredictionOutcomePair,
  DriftAssessment,
  TradingHorizon,
} from './types';

// In-Memory Storage for zero-latency lookups, tests, and offline resilience
const inMemoryCalibrations = new Map<string, ModelCalibrationRecord>();
const activeCalibrationsByHorizon = new Map<TradingHorizon, ModelCalibrationRecord>();

/**
 * Computes binary cross-entropy (log loss) with epsilon clipping.
 */
export function calculateLogLoss(pairs: PredictionOutcomePair[], eps: number = 1e-15): number | null {
  if (!pairs || pairs.length === 0) return null;
  const n = pairs.length;
  let totalLoss = 0;

  for (const pair of pairs) {
    const p = Math.max(eps, Math.min(1 - eps, pair.predicted_prob));
    const y = pair.actual_outcome;
    const loss = -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
    totalLoss += loss;
  }

  return Number((totalLoss / n).toFixed(4));
}

/**
 * Computes complete model calibration metrics and 10 deciles from prediction-outcome pairs.
 */
export function computeModelCalibration(
  horizon: TradingHorizon,
  pairs: PredictionOutcomePair[],
  options?: { modelName?: string; metadata?: Record<string, any> }
): ModelCalibrationRecord {
  const modelName = options?.modelName || 'ADIMOLOGY_CALIBRATED_V6';
  const id = crypto.randomUUID();
  const computedAt = new Date().toISOString();
  const sampleSize = pairs.length;

  const brierResult = calculateBrierScore(pairs);
  const eceResult = calculateExpectedCalibrationError(pairs, 10);
  const logLoss = calculateLogLoss(pairs);

  const deciles: CalibrationDecileRecord[] = eceResult.bins.map((bin) => ({
    id: crypto.randomUUID(),
    calibration_id: id,
    decile_index: bin.bin_index + 1, // 1 to 10
    bin_min: bin.range_min,
    bin_max: bin.range_max,
    mean_predicted_prob: bin.mean_predicted_prob,
    observed_win_rate: bin.observed_win_rate,
    sample_count: bin.count,
    calibration_gap: bin.calibration_gap,
  }));

  const record: ModelCalibrationRecord = {
    id,
    model_name: modelName,
    horizon,
    computed_at: computedAt,
    sample_size: sampleSize,
    brier_score: brierResult.brier_score,
    brier_skill_score: brierResult.skill_score != null ? brierResult.skill_score : null,
    ece: eceResult.ece,
    log_loss: logLoss,
    is_active: true,
    deciles,
    metadata: options?.metadata || {},
  };

  return record;
}

/**
 * Persist calibration snapshot to memory and Supabase.
 */
export async function saveCalibrationSnapshot(
  record: ModelCalibrationRecord
): Promise<ModelCalibrationRecord> {
  // Store in memory
  inMemoryCalibrations.set(record.id, Object.freeze({ ...record }));
  activeCalibrationsByHorizon.set(record.horizon, Object.freeze({ ...record }));

  if (isSupabaseConfigured()) {
    try {
      // 1. Mark previous calibrations for this horizon as inactive
      await supabase
        .from('model_calibrations')
        .update({ is_active: false })
        .eq('horizon', record.horizon);

      // 2. Insert parent record
      const parentPayload = {
        id: record.id,
        model_name: record.model_name,
        horizon: record.horizon,
        computed_at: record.computed_at,
        sample_size: record.sample_size,
        brier_score: record.brier_score,
        brier_skill_score: record.brier_skill_score,
        ece: record.ece,
        log_loss: record.log_loss,
        is_active: true,
        metadata: record.metadata || {},
      };

      const { error: parentError } = await supabase
        .from('model_calibrations')
        .insert([parentPayload]);

      if (parentError) {
        console.warn('[CalibrationStorage] Supabase insert warning:', parentError.message);
      } else {
        // 3. Insert deciles
        const decilesPayload = record.deciles.map((d) => ({
          id: d.id,
          calibration_id: record.id,
          decile_index: d.decile_index,
          bin_min: d.bin_min,
          bin_max: d.bin_max,
          mean_predicted_prob: d.mean_predicted_prob,
          observed_win_rate: d.observed_win_rate,
          sample_count: d.sample_count,
          calibration_gap: d.calibration_gap,
        }));

        await supabase.from('calibration_deciles').insert(decilesPayload);
      }
    } catch (err: any) {
      console.warn('[CalibrationStorage] Supabase error, retained in memory:', err.message);
    }
  }

  return record;
}

/**
 * Retrieve the latest active calibration curve for a given horizon.
 */
export async function getLatestCalibration(
  horizon: TradingHorizon
): Promise<ModelCalibrationRecord | null> {
  const mem = activeCalibrationsByHorizon.get(horizon);
  if (mem) return mem;

  if (isSupabaseConfigured()) {
    try {
      const { data: parent } = await supabase
        .from('model_calibrations')
        .select('*')
        .eq('horizon', horizon)
        .eq('is_active', true)
        .order('computed_at', { ascending: false })
        .limit(1)
        .single();

      if (!parent) return null;

      const { data: deciles } = await supabase
        .from('calibration_deciles')
        .select('*')
        .eq('calibration_id', parent.id)
        .order('decile_index', { ascending: true });

      return {
        ...parent,
        deciles: deciles || [],
      } as ModelCalibrationRecord;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * List all historical calibration snapshots.
 */
export async function listCalibrationSnapshots(
  horizon?: TradingHorizon
): Promise<ModelCalibrationRecord[]> {
  let list = Array.from(inMemoryCalibrations.values());
  if (horizon) {
    list = list.filter((c) => c.horizon === horizon);
  }
  list.sort((a, b) => new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime());
  return list;
}

/**
 * Detects calibration drift between a current evaluation and an established baseline.
 */
export function detectCalibrationDrift(
  current: ModelCalibrationRecord,
  baseline: ModelCalibrationRecord,
  options?: { eceThreshold?: number; brierThreshold?: number }
): DriftAssessment {
  const eceThreshold = options?.eceThreshold ?? 0.05;
  const brierThreshold = options?.brierThreshold ?? 0.05;

  const deltaEce = Number((current.ece - baseline.ece).toFixed(4));
  const deltaBrier = Number((current.brier_score - baseline.brier_score).toFixed(4));

  let hasDrift = false;
  let severity: DriftAssessment['severity'] = 'NONE';
  let description = 'Calibration is stable within baseline thresholds.';

  if (deltaEce >= eceThreshold || deltaBrier >= brierThreshold) {
    hasDrift = true;
    severity = 'HIGH';
    description = `Severe calibration drift detected (ΔECE: +${deltaEce}, ΔBrier: +${deltaBrier}). Recalibration recommended.`;
  } else if (deltaEce >= eceThreshold / 2 || deltaBrier >= brierThreshold / 2) {
    hasDrift = true;
    severity = 'LOW';
    description = `Mild calibration drift observed (ΔECE: +${deltaEce}, ΔBrier: +${deltaBrier}).`;
  }

  return {
    has_drift: hasDrift,
    delta_ece: deltaEce,
    delta_brier: deltaBrier,
    severity,
    description,
  };
}

/**
 * Clear in-memory calibrations for tests.
 */
export function clearInMemoryCalibrations(): void {
  inMemoryCalibrations.clear();
  activeCalibrationsByHorizon.clear();
}
