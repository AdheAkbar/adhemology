/**
 * tests/phase2-prediction-ledger.test.ts
 * Acceptance test suite for Phase 2: Prediction Ledger & Barrier Precedence Engine.
 */

import {
  recordPrediction,
  resolveOutcome,
  getPrediction,
  listPredictions,
  updatePrediction,
  evaluateBarrierPrecedence,
  clearInMemoryLedger,
} from '../lib/ledger/prediction-ledger';
import type { CandleBar, LedgerInsertPayload } from '../lib/ledger/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runAcceptanceTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING PHASE 2 PREDICTION LEDGER ACCEPTANCE TESTS');
  console.log('====================================================\n');

  clearInMemoryLedger();

  // ----------------------------------------------------
  // Test 1: Record prediction creates valid immutable snapshot
  // ----------------------------------------------------
  console.log('Test 1: Record prediction creates valid immutable snapshot...');
  const payload1: LedgerInsertPayload = {
    ticker: 'BBCA',
    as_of_date: '2026-09-01T02:00:00.000Z',
    horizon: 'DAILY_SWING',
    price_at_prediction: 10000,
    target_price: 10600,
    invalidation_price: 9700,
    legacy_adimology_target: 10550, // Preserved baseline
    time_stop_date: '2026-09-08T09:00:00.000Z',
    score_raw: 82.5,
    prob_calibrated: 0.73,
    quality_status: 'CONFIRMED',
    capability_snapshot: { quote: 'READY', orderbook: 'READY' },
    metadata: { catalyst: 'Q3 Earnings Beat', bandar_flow: 'ACCUMULATION' },
  };

  const pred1 = await recordPrediction(payload1);

  assert(Boolean(pred1.id), 'Prediction must have a generated UUID');
  assert(pred1.ticker === 'BBCA', 'Ticker must be capitalized');
  assert(pred1.price_at_prediction === 10000, 'Price at prediction must match');
  assert(pred1.target_price === 10600, 'Target price must match');
  assert(pred1.invalidation_price === 9700, 'Invalidation price must match');
  assert(pred1.legacy_adimology_target === 10550, 'Legacy target must be preserved as baseline');
  assert(pred1.prob_calibrated === 0.73, 'Calibrated probability must be stored');
  console.log('✅ Test 1 Passed: Prediction record created with full provenance and baseline.');

  // ----------------------------------------------------
  // Test 2: Immutability enforcement (updates rejected)
  // ----------------------------------------------------
  console.log('\nTest 2: Immutability enforcement...');
  let updateBlocked = false;
  try {
    await updatePrediction(pred1.id, { target_price: 12000 });
  } catch (err: any) {
    if (err.message.includes('immutable')) {
      updateBlocked = true;
    }
  }
  assert(updateBlocked, 'Direct update to prediction must be rejected with ImmutabilityViolation');
  console.log('✅ Test 2 Passed: Immutability guard strictly blocked in-place modification.');

  // ----------------------------------------------------
  // Test 3: Barrier Precedence Scenario A (TARGET_FIRST)
  // ----------------------------------------------------
  console.log('\nTest 3: Barrier Precedence Scenario A (TARGET_FIRST)...');
  const barsTargetFirst: CandleBar[] = [
    {
      date: '2026-09-02T09:00:00.000Z',
      open: 10000,
      high: 10250,
      low: 9950,
      close: 10200,
    },
    {
      date: '2026-09-03T09:00:00.000Z',
      open: 10200,
      high: 10700, // Reaches target (10600)
      low: 10150,
      close: 10650,
    },
  ];

  const evalA = evaluateBarrierPrecedence(pred1, barsTargetFirst);
  assert(evalA.outcome_status === 'TARGET_FIRST', `Expected TARGET_FIRST, got ${evalA.outcome_status}`);
  assert(evalA.outcome_price === 10600, `Expected outcome_price 10600, got ${evalA.outcome_price}`);
  assert(evalA.return_pct === 6.0, `Expected return_pct 6.0, got ${evalA.return_pct}`);
  assert(evalA.mfe === 7.0, `Expected MFE 7.0 (10700 reached), got ${evalA.mfe}`);
  assert(evalA.mae === -0.5, `Expected MAE -0.5 (9950 reached), got ${evalA.mae}`);
  assert(evalA.bars_to_outcome === 2, `Expected 2 bars to outcome, got ${evalA.bars_to_outcome}`);
  console.log('✅ Test 3 Passed: TARGET_FIRST evaluated correctly with exact MFE/MAE.');

  // ----------------------------------------------------
  // Test 4: Barrier Precedence Scenario B (INVALIDATION_FIRST)
  // ----------------------------------------------------
  console.log('\nTest 4: Barrier Precedence Scenario B (INVALIDATION_FIRST)...');
  const barsInvalidationFirst: CandleBar[] = [
    {
      date: '2026-09-02T09:00:00.000Z',
      open: 10000,
      high: 10100,
      low: 9800,
      close: 9850,
    },
    {
      date: '2026-09-03T09:00:00.000Z',
      open: 9850,
      high: 9900,
      low: 9650, // Breaches invalidation (9700)
      close: 9680,
    },
  ];

  const evalB = evaluateBarrierPrecedence(pred1, barsInvalidationFirst);
  assert(
    evalB.outcome_status === 'INVALIDATION_FIRST',
    `Expected INVALIDATION_FIRST, got ${evalB.outcome_status}`
  );
  assert(evalB.outcome_price === 9700, `Expected outcome_price 9700, got ${evalB.outcome_price}`);
  assert(evalB.return_pct === -3.0, `Expected return_pct -3.0, got ${evalB.return_pct}`);
  assert(evalB.mfe === 1.0, `Expected MFE 1.0 (10100 reached), got ${evalB.mfe}`);
  assert(evalB.mae === -3.5, `Expected MAE -3.5 (9650 reached), got ${evalB.mae}`);
  assert(evalB.bars_to_outcome === 2, `Expected 2 bars to outcome, got ${evalB.bars_to_outcome}`);
  console.log('✅ Test 4 Passed: INVALIDATION_FIRST evaluated correctly with exact MFE/MAE.');

  // ----------------------------------------------------
  // Test 5: Barrier Precedence Scenario C (TIME_STOP)
  // ----------------------------------------------------
  console.log('\nTest 5: Barrier Precedence Scenario C (TIME_STOP)...');
  const barsTimeStop: CandleBar[] = [
    {
      date: '2026-09-02T09:00:00.000Z',
      open: 10000,
      high: 10150,
      low: 9900,
      close: 10050,
    },
    {
      date: '2026-09-05T09:00:00.000Z',
      open: 10050,
      high: 10200,
      low: 9950,
      close: 10100,
    },
    {
      date: '2026-09-08T09:30:00.000Z', // >= time_stop_date (2026-09-08T09:00:00Z)
      open: 10100,
      high: 10300,
      low: 10050,
      close: 10250, // Exit at close
    },
  ];

  const evalC = evaluateBarrierPrecedence(pred1, barsTimeStop);
  assert(evalC.outcome_status === 'TIME_STOP', `Expected TIME_STOP, got ${evalC.outcome_status}`);
  assert(evalC.outcome_price === 10250, `Expected exit at close 10250, got ${evalC.outcome_price}`);
  assert(evalC.return_pct === 2.5, `Expected return_pct 2.5, got ${evalC.return_pct}`);
  assert(evalC.bars_to_outcome === 3, `Expected 3 bars to outcome, got ${evalC.bars_to_outcome}`);
  console.log('✅ Test 5 Passed: TIME_STOP evaluated correctly when horizon expires.');

  // ----------------------------------------------------
  // Test 6: Same-bar Conflict Conservative Tie-Breaker
  // ----------------------------------------------------
  console.log('\nTest 6: Same-bar Conflict Conservative Tie-Breaker...');
  const barsConflict: CandleBar[] = [
    {
      date: '2026-09-02T09:00:00.000Z',
      open: 9900,
      high: 10800, // Touches target (10600)
      low: 9600, // Touches invalidation (9700)
      close: 10100,
    },
  ];

  const evalConflict = evaluateBarrierPrecedence(pred1, barsConflict, {
    conservativeTieBreaker: true,
  });
  assert(
    evalConflict.outcome_status === 'INVALIDATION_FIRST',
    `Expected conservative tie-breaker to pick INVALIDATION_FIRST, got ${evalConflict.outcome_status}`
  );
  assert(
    evalConflict.resolution_reason.includes('Conservative tie-breaker'),
    'Reason must state conservative tie-breaker was applied'
  );
  console.log('✅ Test 6 Passed: Conservative tie-breaker prioritized Invalidation on same-bar clash.');

  // ----------------------------------------------------
  // Test 7: Detached Outcome Resolution & Ledger Retrieval
  // ----------------------------------------------------
  console.log('\nTest 7: Detached Outcome Resolution & Ledger Retrieval...');
  const outcomeA = await resolveOutcome(pred1.id, {
    outcome_status: evalA.outcome_status,
    outcome_price: evalA.outcome_price,
    return_pct: evalA.return_pct,
    mfe: evalA.mfe,
    mae: evalA.mae,
    bars_to_outcome: evalA.bars_to_outcome,
    audit_log: { test: true },
  });

  assert(outcomeA.prediction_id === pred1.id, 'Outcome must link back to prediction_id');
  assert(outcomeA.outcome_status === 'TARGET_FIRST', 'Outcome status must match');

  const retrieved = await getPrediction(pred1.id);
  assert(Boolean(retrieved), 'Should retrieve stored prediction');
  assert(retrieved?.prediction.id === pred1.id, 'Retrieved prediction ID matches');
  assert(retrieved?.prediction.target_price === 10600, 'Original prediction remains completely intact');
  assert(retrieved?.outcome?.outcome_status === 'TARGET_FIRST', 'Retrieved attached outcome matches');
  console.log('✅ Test 7 Passed: Outcome cleanly detached and linked by prediction_id.');

  // ----------------------------------------------------
  // Test 8: Filtered Listing & Baseline Comparison
  // ----------------------------------------------------
  console.log('\nTest 8: Filtered Listing & Baseline Comparison...');
  // Record another prediction for ASII
  const pred2 = await recordPrediction({
    ticker: 'ASII',
    as_of_date: '2026-09-02T02:00:00.000Z',
    horizon: 'DAILY_SWING',
    price_at_prediction: 5000,
    target_price: 5400,
    invalidation_price: 4800,
    legacy_adimology_target: 5350,
    time_stop_date: '2026-09-09T09:00:00.000Z',
    quality_status: 'DEGRADED',
  });

  const listAll = await listPredictions();
  assert(listAll.total === 2, `Expected total 2, got ${listAll.total}`);

  const listBBCA = await listPredictions({ ticker: 'BBCA' });
  assert(listBBCA.total === 1, `Expected 1 for BBCA, got ${listBBCA.total}`);
  assert(listBBCA.items[0].prediction.ticker === 'BBCA', 'Must be BBCA');
  assert(Boolean(listBBCA.items[0].outcome), 'BBCA has outcome');

  const listResolved = await listPredictions({ hasOutcome: true });
  assert(listResolved.total === 1, `Expected 1 resolved, got ${listResolved.total}`);

  const listUnresolved = await listPredictions({ hasOutcome: false });
  assert(listUnresolved.total === 1, `Expected 1 unresolved (ASII), got ${listUnresolved.total}`);
  assert(listUnresolved.items[0].prediction.ticker === 'ASII', 'Must be ASII');

  console.log('✅ Test 8 Passed: Filtered queries and baseline tracking verified.');

  console.log('\n====================================================');
  console.log('🎉 ALL 8 PHASE 2 ACCEPTANCE TESTS PASSED (100%)');
  console.log('====================================================');
}

runAcceptanceTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
