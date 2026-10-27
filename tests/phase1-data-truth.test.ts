/**
 * tests/phase1-data-truth.test.ts - Acceptance Tests for Phase 1: Data Truth Layer
 * Validates canonical envelopes, no-zero-coercion rule, and capability gating.
 */

import assert from 'node:assert/strict';
import {
  createConfirmedEnvelope,
  createUnavailableEnvelope,
  createDegradedEnvelope,
  createSyntheticEnvelope,
  isConfirmed,
  unwrapEnvelope,
} from '../lib/data-truth/data-envelope';
import {
  buildCapabilityMatrix,
  isCapabilityActionable,
  validateCapabilityGating,
} from '../lib/data-truth/capability-matrix';

console.log('🧪 Running Phase 1 Acceptance Tests: Data Truth Layer...\n');

let totalTests = 0;
let passedTests = 0;

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// ============================================================================
// TEST 1: Canonical Data Envelope Invariants
// ============================================================================
test('1. Confirmed envelope carries required provenance metadata', () => {
  const env = createConfirmedEnvelope(7050, 'STOCKBIT_ORDERBOOK', 'REST_API', {
    freshnessSec: 15,
    dataMode: 'LIVE',
  });

  assert.equal(env.value, 7050);
  assert.equal(env.quality_status, 'CONFIRMED');
  assert.equal(env.data_mode, 'LIVE');
  assert.equal(env.source_id, 'STOCKBIT_ORDERBOOK');
  assert.equal(env.source_type, 'REST_API');
  assert.equal(env.freshness_sec, 15);
  assert.equal(env.reason_code, 'OK');
  assert.equal(isConfirmed(env), true);
});

// ============================================================================
// TEST 2: Missing Data != 0 Rule (No Zero-Coercion)
// ============================================================================
test('2. Missing market field produces null value with explicit reason code, NOT zero', () => {
  const env = createUnavailableEnvelope<number>('STOCKBIT_ORDERBOOK', 'REST_API', 'SOURCE_FIELD_MISSING');

  assert.equal(env.value, null, 'Value must be explicitly null, not 0');
  assert.notEqual(env.value, 0, 'Value must NEVER be coerced to 0 when missing');
  assert.equal(env.quality_status, 'UNAVAILABLE');
  assert.equal(env.data_mode, 'UNAVAILABLE');
  assert.equal(env.reason_code, 'SOURCE_FIELD_MISSING');
  assert.equal(isConfirmed(env), false);

  // Unwrapping without fallback must preserve null
  const unwrapped = unwrapEnvelope(env);
  assert.equal(unwrapped, null);
});

// ============================================================================
// TEST 3: Legitimate Zero Value is Preserved
// ============================================================================
test('3. Legitimate zero values (e.g. net delta = 0) are correctly preserved as number 0', () => {
  const env = createConfirmedEnvelope(0, 'BROKER_DELTA', 'CALCULATION');
  assert.equal(env.value, 0);
  assert.equal(env.quality_status, 'CONFIRMED');
  assert.equal(isConfirmed(env), true);
});

// ============================================================================
// TEST 4: Capability Matrix Has All 14 Mandatory Capabilities
// ============================================================================
test('4. Capability matrix defines all 14 required capabilities without omission', () => {
  const matrix = buildCapabilityMatrix({ hasStockbitToken: true, hasGeminiKey: true });
  const required = [
    'quote',
    'ohlcv_daily',
    'ohlcv_intraday',
    'broker_summary',
    'broker_running_trade',
    'broker_flow_intraday',
    'orderbook',
    'trade_tape',
    'index',
    'market_breadth',
    'sector',
    'fundamental',
    'news',
    'corporate_action',
  ] as const;

  for (const cap of required) {
    assert.ok(matrix[cap], `Missing capability '${cap}' in matrix`);
    assert.equal(matrix[cap].name, cap);
    assert.ok(Array.isArray(matrix[cap].usable_horizons));
  }
});

// ============================================================================
// TEST 5: Intraday Broker Flow is Formally Gated / Disabled
// ============================================================================
test('5. broker_flow_intraday is marked DISABLED due to IDX Dec 2021 regulation', () => {
  const matrix = buildCapabilityMatrix({ hasStockbitToken: true });
  const cap = matrix.broker_flow_intraday;

  assert.equal(cap.state, 'DISABLED');
  assert.match(cap.reason_code, /IDX/);
  assert.equal(isCapabilityActionable(matrix, 'broker_flow_intraday', 'INTRADAY_5M'), false);
});

// ============================================================================
// TEST 6: Token State Down-ranks Capabilities Automatically
// ============================================================================
test('6. Missing/expired token marks quote, orderbook, and broker_summary as UNAVAILABLE', () => {
  const matrix = buildCapabilityMatrix({ hasStockbitToken: false });

  assert.equal(matrix.quote.state, 'UNAVAILABLE');
  assert.equal(matrix.orderbook.state, 'UNAVAILABLE');
  assert.equal(matrix.broker_summary.state, 'UNAVAILABLE');

  const check = validateCapabilityGating(matrix, ['quote', 'orderbook'], 'INTRADAY_15M');
  assert.equal(check.isActionable, false);
  assert.ok(check.missingCapabilities.includes('quote'));
  assert.ok(check.missingCapabilities.includes('orderbook'));
});

// ============================================================================
// TEST 7: Horizon Constraint Validation
// ============================================================================
test('7. ohlcv_daily rejects INTRADAY_5M horizon gating', () => {
  const matrix = buildCapabilityMatrix({ hasStockbitToken: true });
  assert.equal(isCapabilityActionable(matrix, 'ohlcv_daily', 'DAILY_SWING'), true);
  assert.equal(isCapabilityActionable(matrix, 'ohlcv_daily', 'INTRADAY_5M'), false);
});

console.log(`\n------------------------------------------------------------`);
console.log(`Phase 1 Test Summary: ${passedTests}/${totalTests} Passed.`);
if (passedTests === totalTests) {
  console.log('🎉 ALL ACCEPTANCE TESTS PASSED!\n');
  process.exit(0);
} else {
  console.error('💥 SOME TESTS FAILED!\n');
  process.exit(1);
}
