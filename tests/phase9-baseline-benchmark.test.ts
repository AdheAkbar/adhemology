import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDynamicTargetsV2, calculateLegacyAdimologyBaseline } from '../lib/targets/target-engine';
import { calibrateScore } from '../lib/calibration';

test('Phase 9 - Baseline Benchmark: Preserves Legacy Adimology Target as Control Baseline', () => {
  const input = {
    emiten: 'BBCA',
    current_price: 10000,
    rata_rata_bandar: 9800,
    barang_bandar: 150000,
    ara: 12000,
    arb: 8000,
    total_bid: 500000,
    total_offer: 400000,
  };

  const legacy = calculateLegacyAdimologyBaseline(input);
  const v6 = calculateDynamicTargetsV2(input);

  // Assert legacy target is preserved in v6 return object
  assert.equal(v6.legacy_adimology_target, legacy.targetRealistis);
  assert.equal(v6.legacy_adimology_max, legacy.targetMax);
  assert.ok(v6.legacy_adimology_target > 0);
});

test('Phase 9 - Baseline Benchmark: V6 Introduces Invalidation Level while Legacy Had None', () => {
  const input = {
    emiten: 'ASII',
    current_price: 5000,
    rata_rata_bandar: 4950,
    barang_bandar: 80000,
    recent_swing_low: 4850,
  };

  const v6 = calculateDynamicTargetsV2(input);

  // Invalidation must exist and be strictly below entry price
  assert.ok(v6.invalidation_price < input.current_price);
  assert.ok(v6.risk_amount > 0);
  assert.ok(v6.risk_reward_ratio > 0);
  assert.equal(typeof v6.is_rrr_acceptable, 'boolean');
});

test('Phase 9 - Baseline Benchmark: Calibrated Probability vs Raw Score Benchmark', () => {
  // Raw scores can be exaggerated (e.g. 90/100)
  const rawScore = 90;
  const calibrated = calibrateScore(rawScore);

  assert.equal(calibrated.raw_score, 90);
  // Calibrated probability reflects realistic empirical frequency (e.g. 74% - 82%)
  assert.ok(calibrated.calibrated_p < 90);
  assert.ok(calibrated.brier_score !== undefined);
  assert.ok(calibrated.calibration_decile >= 1 && calibrated.calibration_decile <= 10);
});
