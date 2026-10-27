/**
 * tests/phase3-probability-calibration.test.ts
 * Acceptance test suite for Phase 3: Calibrated Probability vs Rank Score.
 */

import {
  createRankScore,
  assessCalibration,
  calculateBrierScore,
  calculateExpectedCalibrationError,
  calculateWilsonConfidenceInterval,
  formatScoreVsProbability,
  MINIMUM_CALIBRATION_SAMPLE_SIZE,
} from '../lib/calibration/probability-engine';
import type { PredictionOutcomePair } from '../lib/calibration/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runAcceptanceTests() {
  console.log('===========================================================');
  console.log('🧪 RUNNING PHASE 3 CALIBRATION & RANK SCORE ACCEPTANCE TESTS');
  console.log('===========================================================\n');

  // ----------------------------------------------------
  // Test 1: Decoupling of Rank Score and Calibrated Probability
  // ----------------------------------------------------
  console.log('Test 1: Decoupling of Rank Score (0-100) and Calibrated Probability (0.0-1.0)...');
  const rankHigh = createRankScore(87.5);
  assert(rankHigh.value === 87.5, `Expected rank 87.5, got ${rankHigh.value}`);
  assert(rankHigh.tier === 'TOP_TIER', `Expected TOP_TIER, got ${rankHigh.tier}`);

  const rankModerate = createRankScore(55.0);
  assert(rankModerate.tier === 'NEUTRAL', `Expected NEUTRAL, got ${rankModerate.tier}`);

  const rankLow = createRankScore(25.0);
  assert(rankLow.tier === 'BELOW_AVERAGE', `Expected BELOW_AVERAGE, got ${rankLow.tier}`);

  // Rank score must be between 0 and 100
  const clamped = createRankScore(125.0);
  assert(clamped.value === 100, 'Score above 100 must be clamped to 100');
  console.log('✅ Test 1 Passed: Rank score creates strictly ordinal ranking metrics.');

  // ----------------------------------------------------
  // Test 2: Calibration Gating with N < 30
  // ----------------------------------------------------
  console.log('\nTest 2: Calibration Gating with N < 30 (INSUFFICIENT_HISTORY)...');
  const smallSample = Array.from({ length: 14 }, (_, i) => ({
    outcome_status: i % 2 === 0 ? 'TARGET_FIRST' : 'INVALIDATION_FIRST',
  }));

  const gatedResult = assessCalibration(smallSample, 0.75);
  assert(gatedResult.is_calibrated === false, 'Must be marked as uncalibrated');
  assert(gatedResult.probability === null, 'Probability must be null when uncalibrated');
  assert(gatedResult.sample_size === 14, 'Sample size must be accurately reported');
  assert(
    gatedResult.reason_code === 'INSUFFICIENT_HISTORY',
    `Expected reason INSUFFICIENT_HISTORY, got ${gatedResult.reason_code}`
  );
  console.log('✅ Test 2 Passed: Gating strictly prevents pseudo-probabilities when N < 30.');

  // ----------------------------------------------------
  // Test 3: Calibration with Mature Sample (N >= 30)
  // ----------------------------------------------------
  console.log('\nTest 3: Calibration with Mature Sample (N >= 30)...');
  // 40 samples: 26 wins, 14 losses -> win rate = 26/40 = 0.65 (65%)
  const matureSample = [
    ...Array.from({ length: 26 }, () => ({ outcome_status: 'TARGET_FIRST' })),
    ...Array.from({ length: 14 }, () => ({ outcome_status: 'INVALIDATION_FIRST' })),
  ];

  const matureResult = assessCalibration(matureSample, 0.65);
  assert(matureResult.is_calibrated === true, 'Must be marked as calibrated');
  assert(matureResult.probability === 0.65, `Expected 0.65 probability, got ${matureResult.probability}`);
  assert(matureResult.sample_size === 40, 'Sample size must be 40');
  assert(Boolean(matureResult.confidence_interval), 'Confidence interval must be calculated');

  const [ciLower, ciUpper] = matureResult.confidence_interval!;
  assert(ciLower < 0.65 && ciUpper > 0.65, `Confidence interval [${ciLower}, ${ciUpper}] must bracket 0.65`);
  assert(ciLower > 0.45 && ciUpper < 0.85, 'Wilson CI must be reasonably tight for N=40');
  console.log(`✅ Test 3 Passed: Empirical calibration computed: ${(matureResult.probability! * 100).toFixed(1)}% [95% CI: ${(ciLower * 100).toFixed(1)}% - ${(ciUpper * 100).toFixed(1)}%].`);

  // ----------------------------------------------------
  // Test 4: Brier Score Calculation
  // ----------------------------------------------------
  console.log('\nTest 4: Brier Score Calculation...');
  // Scenario 4A: Perfect predictions (Brier = 0.0)
  const perfectPairs: PredictionOutcomePair[] = [
    { predicted_prob: 1.0, actual_outcome: 1 },
    { predicted_prob: 1.0, actual_outcome: 1 },
    { predicted_prob: 0.0, actual_outcome: 0 },
    { predicted_prob: 0.0, actual_outcome: 0 },
  ];
  const brierPerfect = calculateBrierScore(perfectPairs);
  assert(brierPerfect.brier_score === 0.0, `Expected Brier 0.0, got ${brierPerfect.brier_score}`);
  assert(brierPerfect.quality === 'EXCELLENT', 'Perfect Brier must be EXCELLENT');

  // Scenario 4B: Random coin-flip predictions (0.5 on 50/50 outcomes -> Brier = 0.25)
  const coinFlipPairs: PredictionOutcomePair[] = [
    { predicted_prob: 0.5, actual_outcome: 1 },
    { predicted_prob: 0.5, actual_outcome: 0 },
    { predicted_prob: 0.5, actual_outcome: 1 },
    { predicted_prob: 0.5, actual_outcome: 0 },
  ];
  const brierCoin = calculateBrierScore(coinFlipPairs);
  assert(brierCoin.brier_score === 0.25, `Expected Brier 0.25, got ${brierCoin.brier_score}`);
  assert(brierCoin.quality === 'FAIR', 'Coin flip Brier must be FAIR');

  // Scenario 4C: Completely inverted / worst predictions (Brier = 1.0)
  const invertedPairs: PredictionOutcomePair[] = [
    { predicted_prob: 1.0, actual_outcome: 0 },
    { predicted_prob: 0.0, actual_outcome: 1 },
  ];
  const brierInverted = calculateBrierScore(invertedPairs);
  assert(brierInverted.brier_score === 1.0, `Expected Brier 1.0, got ${brierInverted.brier_score}`);
  assert(brierInverted.quality === 'POOR', 'Inverted Brier must be POOR');
  console.log('✅ Test 4 Passed: Brier Score properly penalizes calibration errors.');

  // ----------------------------------------------------
  // Test 5: Expected Calibration Error (ECE)
  // ----------------------------------------------------
  console.log('\nTest 5: Expected Calibration Error (ECE)...');
  const ecePairs: PredictionOutcomePair[] = [
    { predicted_prob: 0.85, actual_outcome: 1 },
    { predicted_prob: 0.82, actual_outcome: 1 },
    { predicted_prob: 0.75, actual_outcome: 1 },
    { predicted_prob: 0.78, actual_outcome: 0 },
    { predicted_prob: 0.20, actual_outcome: 0 },
    { predicted_prob: 0.15, actual_outcome: 0 },
  ];
  const eceResult = calculateExpectedCalibrationError(ecePairs, 5);
  assert(eceResult.bins.length === 5, 'Must have 5 bins');
  assert(eceResult.ece >= 0 && eceResult.ece <= 1, `ECE must be between 0 and 1, got ${eceResult.ece}`);
  console.log(`✅ Test 5 Passed: ECE computed across bins (ECE = ${eceResult.ece}).`);

  // ----------------------------------------------------
  // Test 6: UI Formatter and Educational Disambiguation
  // ----------------------------------------------------
  console.log('\nTest 6: UI Formatter and Educational Disambiguation...');
  // Case A: Uncalibrated state
  const formattedUncalibrated = formatScoreVsProbability(85, gatedResult);
  assert(formattedUncalibrated.rank_score_display === '85 / 100', 'Rank score must be shown');
  assert(
    formattedUncalibrated.probability_display === 'Uncalibrated',
    'Probability must state Uncalibrated'
  );
  assert(formattedUncalibrated.is_calibrated === false, 'is_calibrated must be false');
  assert(
    formattedUncalibrated.tooltip.includes(`${MINIMUM_CALIBRATION_SAMPLE_SIZE} resolved historical setups`),
    'Tooltip must educate about sample size threshold'
  );

  // Case B: Calibrated state
  const formattedCalibrated = formatScoreVsProbability(85, matureResult);
  assert(formattedCalibrated.rank_score_display === '85 / 100', 'Rank score must be shown');
  assert(formattedCalibrated.probability_display === '65.0%', 'Calibrated win prob must be 65.0%');
  assert(formattedCalibrated.is_calibrated === true, 'is_calibrated must be true');
  assert(formattedCalibrated.badge_variant === 'success', '65% prob should have success variant');
  console.log('✅ Test 6 Passed: UI formatting correctly differentiates ranking from probability.');

  console.log('\n===========================================================');
  console.log('🎉 ALL 6 PHASE 3 ACCEPTANCE TESTS PASSED (100%)');
  console.log('===========================================================');
}

runAcceptanceTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
