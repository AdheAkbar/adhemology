/**
 * tests/phase6-dynamic-targets.test.ts
 * Acceptance test suite for Phase 6: Dynamic Target & Invalidation Engine V2.
 */

import {
  roundToFraksi,
  calculateDynamicTargetsV2,
  calculateLegacyAdimologyBaseline,
} from '../lib/targets/target-engine';
import { getFraksi } from '../lib/calculations';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runAcceptanceTests() {
  console.log('===========================================================');
  console.log('🧪 RUNNING PHASE 6 DYNAMIC TARGET & INVALIDATION TESTS');
  console.log('===========================================================\n');

  // ----------------------------------------------------
  // Test 1: IDX Fraksi Rounding Consistency
  // ----------------------------------------------------
  console.log('Test 1: Official IDX Fraksi Rounding Consistency...');
  assert(roundToFraksi(185.3, 'NEAREST') === 185, 'Fraksi 1 check');
  assert(roundToFraksi(253, 'DOWN') === 252, 'Fraksi 2 DOWN check');
  assert(roundToFraksi(253, 'UP') === 254, 'Fraksi 2 UP check');
  assert(roundToFraksi(642, 'DOWN') === 640, 'Fraksi 5 DOWN check');
  assert(roundToFraksi(642, 'UP') === 645, 'Fraksi 5 UP check');
  assert(roundToFraksi(3456, 'NEAREST') === 3460, 'Fraksi 10 check');
  assert(roundToFraksi(9830, 'DOWN') === 9825, 'Fraksi 25 DOWN check');
  assert(roundToFraksi(9830, 'UP') === 9850, 'Fraksi 25 UP check');
  console.log('✅ Test 1 Passed: All 5 official IDX price tiers round correctly to tick boundaries.');

  // ----------------------------------------------------
  // Test 2: Barrier Hierarchy & Fraksi Compliance
  // ----------------------------------------------------
  console.log('\nTest 2: Multi-Target Ladder Hierarchy & Fraksi Compliance...');
  const setup = calculateDynamicTargetsV2({
    current_price: 640, // Fraksi 5 (e.g. SOCI)
    bandar_vwap: 620,
    recent_swing_low: 615,
    recent_swing_high: 700,
    atr: 20,
    ara: 800,
    arb: 545,
  });

  assert(setup.fraksi === 5, 'Fraksi must be 5 for price 640');
  assert(setup.invalidation_price < 640, `Invalidation must be < 640, got ${setup.invalidation_price}`);
  assert(setup.t1_realistic > 640, `T1 must be > 640, got ${setup.t1_realistic}`);
  assert(setup.t2_stretch > setup.t1_realistic, `T2 must be > T1, got ${setup.t2_stretch}`);
  assert(setup.t_max >= setup.t2_stretch, `T_max must be >= T2, got ${setup.t_max}`);

  // Every barrier must sit on valid fraksi
  assert(setup.invalidation_price % 5 === 0, 'Invalidation must align with fraksi');
  assert(setup.t1_realistic % 5 === 0, 'T1 must align with fraksi');
  assert(setup.t2_stretch % 5 === 0, 'T2 must align with fraksi');
  assert(setup.t_max % 5 === 0, 'T_max must align with fraksi');
  console.log(`✅ Test 2 Passed: Invalidation=${setup.invalidation_price} < P0=640 < T1=${setup.t1_realistic} < T2=${setup.t2_stretch} <= T_max=${setup.t_max}.`);

  // ----------------------------------------------------
  // Test 3: RRR (Risk-Reward Ratio) Validation
  // ----------------------------------------------------
  console.log('\nTest 3: Risk-Reward Ratio (RRR) Validation...');
  assert(setup.risk_amount > 0, 'Risk amount must be positive');
  assert(setup.reward_amount > 0, 'Reward amount must be positive');
  assert(setup.risk_reward_ratio >= 1.5, `RRR expected >= 1.5, got ${setup.risk_reward_ratio}`);
  assert(setup.is_rrr_acceptable === true, 'is_rrr_acceptable must be true for viable setup');
  console.log(`✅ Test 3 Passed: Risk=${setup.risk_amount}, Reward=${setup.reward_amount}, RRR=${setup.risk_reward_ratio}x.`);

  // ----------------------------------------------------
  // Test 4: Baseline Control Preservation
  // ----------------------------------------------------
  console.log('\nTest 4: Legacy Adimology Target Preservation as Baseline Control...');
  assert(setup.legacy_adimology_target > 0, 'Legacy target realistis must be preserved');
  assert(setup.legacy_adimology_max > 0, 'Legacy target max must be preserved');
  assert(setup.legacy_adimology_target % 5 === 0, 'Legacy target must be rounded to fraksi');
  console.log(`✅ Test 4 Passed: Baseline legacy target=${setup.legacy_adimology_target}, max=${setup.legacy_adimology_max}.`);

  // ----------------------------------------------------
  // Test 5: Invalidation Bounded by ARB and Swing Low
  // ----------------------------------------------------
  console.log('\nTest 5: Invalidation Bounded by ARB and Support...');
  const arbBoundSetup = calculateDynamicTargetsV2({
    current_price: 1000,
    arb: 950,
    atr: 80, // 1000 - 1.5*80 = 880, but ARB is 950!
  });
  assert(
    arbBoundSetup.invalidation_price >= 950,
    `Invalidation must not breach ARB 950, got ${arbBoundSetup.invalidation_price}`
  );
  console.log('✅ Test 5 Passed: Invalidation respects exchange price limit floor (ARB).');

  console.log('\n===========================================================');
  console.log('🎉 ALL 5 PHASE 6 ACCEPTANCE TESTS PASSED (100%)');
  console.log('===========================================================');
}

runAcceptanceTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
