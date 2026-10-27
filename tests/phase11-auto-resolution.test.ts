import test from 'node:test';
import assert from 'node:assert/strict';
import { recordPrediction, clearInMemoryLedger, getPrediction } from '../lib/ledger/prediction-ledger';
import { runAutoResolution } from '../lib/ledger/auto-resolution';
import type { CandleBar } from '../lib/ledger/types';

test('Phase 11 - Auto-Resolution Cron: Automatically resolves TARGET_FIRST and INVALIDATION_FIRST', async () => {
  clearInMemoryLedger();

  // 1. Setup Prediction A (Will hit target)
  const predA = await recordPrediction({
    ticker: 'BBCA',
    as_of_date: '2026-09-01T00:00:00Z',
    horizon: 'DAILY_SWING',
    price_at_prediction: 10000,
    target_price: 10500,
    invalidation_price: 9700,
    time_stop_date: '2026-09-10T00:00:00Z',
  });

  // 2. Setup Prediction B (Will hit invalidation)
  const predB = await recordPrediction({
    ticker: 'GOTO',
    as_of_date: '2026-09-01T00:00:00Z',
    horizon: 'DAILY_SWING',
    price_at_prediction: 50,
    target_price: 55,
    invalidation_price: 47,
    time_stop_date: '2026-09-10T00:00:00Z',
  });

  // 3. Setup Prediction C (Will stay pending)
  const predC = await recordPrediction({
    ticker: 'TLKM',
    as_of_date: '2026-09-01T00:00:00Z',
    horizon: 'DAILY_SWING',
    price_at_prediction: 2800,
    target_price: 3100,
    invalidation_price: 2600,
    time_stop_date: '2026-09-10T00:00:00Z',
  });

  // Simulated candle bars
  const bbcaBars: CandleBar[] = [
    { date: '2026-09-02', open: 10000, high: 10200, low: 9950, close: 10150, volume: 10000 },
    { date: '2026-09-03', open: 10150, high: 10550, low: 10100, close: 10500, volume: 15000 }, // Hits 10550 >= 10500!
  ];

  const gotoBars: CandleBar[] = [
    { date: '2026-09-02', open: 50, high: 51, low: 46, close: 47, volume: 50000 }, // Hits 46 <= 47!
  ];

  const tlkmBars: CandleBar[] = [
    { date: '2026-09-02', open: 2800, high: 2850, low: 2780, close: 2820, volume: 20000 }, // Still within range
  ];

  const summary = await runAutoResolution({
    BBCA: bbcaBars,
    GOTO: gotoBars,
    TLKM: tlkmBars,
  });

  assert.equal(summary.total_scanned, 3);
  assert.equal(summary.resolved_count, 2);
  assert.equal(summary.pending_count, 1);

  // Verify Prediction A outcome
  const resolvedA = await getPrediction(predA.id);
  assert.ok(resolvedA?.outcome);
  assert.equal(resolvedA?.outcome?.outcome_status, 'TARGET_FIRST');
  assert.equal(resolvedA?.outcome?.outcome_price, 10500);

  // Verify Prediction B outcome
  const resolvedB = await getPrediction(predB.id);
  assert.ok(resolvedB?.outcome);
  assert.equal(resolvedB?.outcome?.outcome_status, 'INVALIDATION_FIRST');
  assert.equal(resolvedB?.outcome?.outcome_price, 47);

  // Verify Prediction C remains pending
  const pendingC = await getPrediction(predC.id);
  assert.equal(pendingC?.outcome, undefined);
});
