/**
 * tests/phase4-decile-metrics.test.ts
 * Acceptance test suite for Phase 4: Model Calibrations & Decile Reliability Metrics.
 */

import {
  computeModelCalibration,
  saveCalibrationSnapshot,
  getLatestCalibration,
  listCalibrationSnapshots,
  detectCalibrationDrift,
  calculateLogLoss,
  clearInMemoryCalibrations,
} from '../lib/calibration/calibration-storage';
import type { PredictionOutcomePair } from '../lib/calibration/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runAcceptanceTests() {
  console.log('===========================================================');
  console.log('🧪 RUNNING PHASE 4 DECILE METRICS & CALIBRATION TESTS');
  console.log('===========================================================\n');

  clearInMemoryCalibrations();

  // Synthetic distribution of 100 historical setups across various probability levels
  const testPairs: PredictionOutcomePair[] = [
    // 0.8 - 0.9: 20 setups, 17 wins
    ...Array.from({ length: 17 }, () => ({ predicted_prob: 0.85, actual_outcome: 1 as const })),
    ...Array.from({ length: 3 }, () => ({ predicted_prob: 0.85, actual_outcome: 0 as const })),
    // 0.7 - 0.8: 25 setups, 18 wins
    ...Array.from({ length: 18 }, () => ({ predicted_prob: 0.72, actual_outcome: 1 as const })),
    ...Array.from({ length: 7 }, () => ({ predicted_prob: 0.75, actual_outcome: 0 as const })),
    // 0.6 - 0.7: 25 setups, 16 wins
    ...Array.from({ length: 16 }, () => ({ predicted_prob: 0.64, actual_outcome: 1 as const })),
    ...Array.from({ length: 9 }, () => ({ predicted_prob: 0.68, actual_outcome: 0 as const })),
    // 0.4 - 0.5: 15 setups, 7 wins
    ...Array.from({ length: 7 }, () => ({ predicted_prob: 0.45, actual_outcome: 1 as const })),
    ...Array.from({ length: 8 }, () => ({ predicted_prob: 0.48, actual_outcome: 0 as const })),
    // 0.2 - 0.3: 15 setups, 3 wins
    ...Array.from({ length: 3 }, () => ({ predicted_prob: 0.25, actual_outcome: 1 as const })),
    ...Array.from({ length: 12 }, () => ({ predicted_prob: 0.22, actual_outcome: 0 as const })),
  ];

  // ----------------------------------------------------
  // Test 1: Generate 10 deciles and verify bin structure
  // ----------------------------------------------------
  console.log('Test 1: Generate 10 deciles and verify monotonic bin edges [0.0, 1.0]...');
  const calib = computeModelCalibration('DAILY_SWING', testPairs, {
    modelName: 'ADIMOLOGY_V6_TEST',
  });

  assert(Boolean(calib.id), 'Calibration must have a UUID');
  assert(calib.sample_size === 100, `Expected sample size 100, got ${calib.sample_size}`);
  assert(calib.deciles.length === 10, `Expected 10 decile bins, got ${calib.deciles.length}`);

  // Verify decile bin ranges
  for (let i = 0; i < 10; i++) {
    const d = calib.deciles[i];
    assert(d.decile_index === i + 1, `Decile index should be ${i + 1}`);
    assert(d.bin_min === Number((i * 0.1).toFixed(2)), `Decile ${i} bin_min mismatch`);
    assert(d.bin_max === Number(((i + 1) * 0.1).toFixed(2)), `Decile ${i} bin_max mismatch`);
  }
  console.log('✅ Test 1 Passed: 10 monotonic decile bins created covering [0.0, 1.0].');

  // ----------------------------------------------------
  // Test 2: Calculate ECE, Brier Score, and Log Loss
  // ----------------------------------------------------
  console.log('\nTest 2: Calculate ECE, Brier Score, and Log Loss...');
  assert(calib.brier_score > 0 && calib.brier_score < 0.25, `Brier score must be reasonable, got ${calib.brier_score}`);
  assert(calib.ece > 0 && calib.ece < 0.15, `ECE must be reasonable, got ${calib.ece}`);
  assert(calib.log_loss !== null && calib.log_loss > 0, `Log loss must be valid, got ${calib.log_loss}`);

  // Verify specific decile metric (Decile 9: 0.8 - 0.9)
  const decile9 = calib.deciles[8];
  assert(decile9.sample_count === 20, `Decile 9 count expected 20, got ${decile9.sample_count}`);
  assert(decile9.mean_predicted_prob === 0.85, `Decile 9 mean pred expected 0.85, got ${decile9.mean_predicted_prob}`);
  assert(decile9.observed_win_rate === 0.85, `Decile 9 observed win rate expected 0.85 (17/20), got ${decile9.observed_win_rate}`);
  assert(decile9.calibration_gap === 0, `Decile 9 calibration gap expected 0, got ${decile9.calibration_gap}`);
  console.log(`✅ Test 2 Passed: Brier=${calib.brier_score}, ECE=${calib.ece}, LogLoss=${calib.log_loss}.`);

  // ----------------------------------------------------
  // Test 3: Persist and Retrieve Calibration Snapshot
  // ----------------------------------------------------
  console.log('\nTest 3: Persist and Retrieve Calibration Snapshot...');
  await saveCalibrationSnapshot(calib);

  const retrieved = await getLatestCalibration('DAILY_SWING');
  assert(Boolean(retrieved), 'Should retrieve latest calibration for DAILY_SWING');
  assert(retrieved?.id === calib.id, 'Retrieved ID must match saved calibration');
  assert(retrieved?.deciles.length === 10, 'Retrieved deciles must have all 10 bins');

  const history = await listCalibrationSnapshots('DAILY_SWING');
  assert(history.length === 1, 'History count must be 1');
  console.log('✅ Test 3 Passed: Calibration snapshot with 10 deciles persisted and retrieved.');

  // ----------------------------------------------------
  // Test 4: Calibration Drift Detection
  // ----------------------------------------------------
  console.log('\nTest 4: Calibration Drift Detection...');
  // Case 4A: Stable / no drift
  const stableAssessment = detectCalibrationDrift(calib, calib);
  assert(stableAssessment.has_drift === false, 'Identical calibration should have no drift');
  assert(stableAssessment.severity === 'NONE', 'Severity should be NONE');

  // Case 4B: Degraded calibration (drift scenario)
  const degradedCalib = {
    ...calib,
    id: crypto.randomUUID(),
    computed_at: new Date().toISOString(),
    brier_score: calib.brier_score + 0.08,
    ece: calib.ece + 0.07,
  };
  await saveCalibrationSnapshot(degradedCalib);

  const driftAssessment = detectCalibrationDrift(degradedCalib, calib);
  assert(driftAssessment.has_drift === true, 'Should detect significant drift');
  assert(driftAssessment.severity === 'HIGH', 'Severity should be HIGH');
  assert(driftAssessment.delta_ece === 0.07, 'Delta ECE should be 0.07');
  console.log(`✅ Test 4 Passed: Calibration drift detected: ${driftAssessment.description}`);

  // ----------------------------------------------------
  // Test 5: Log Loss Calculation Bounds
  // ----------------------------------------------------
  console.log('\nTest 5: Log Loss Calculation Bounds...');
  const perfectLoss = calculateLogLoss([
    { predicted_prob: 0.9999, actual_outcome: 1 },
    { predicted_prob: 0.0001, actual_outcome: 0 },
  ]);
  assert(perfectLoss !== null && perfectLoss < 0.01, `Near-perfect loss should be near 0, got ${perfectLoss}`);

  const badLoss = calculateLogLoss([
    { predicted_prob: 0.01, actual_outcome: 1 },
    { predicted_prob: 0.99, actual_outcome: 0 },
  ]);
  assert(badLoss !== null && badLoss > 4.0, `Severe misprediction loss should be high, got ${badLoss}`);
  console.log('✅ Test 5 Passed: Log loss bounds mathematically confirmed.');

  console.log('\n===========================================================');
  console.log('🎉 ALL 5 PHASE 4 ACCEPTANCE TESTS PASSED (100%)');
  console.log('===========================================================');
}

runAcceptanceTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
