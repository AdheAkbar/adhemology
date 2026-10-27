import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCapabilityMatrix } from '../lib/data-truth/capability-matrix';
import { validateHorizonGating } from '../lib/data-truth/horizon-gating';

test('Phase 8 - Horizon Gating: Blocks intraday scalp on EOD_STATIC data', () => {
  const matrix = buildCapabilityMatrix({ hasStockbitToken: true, hasGeminiKey: true });
  const result = validateHorizonGating('INTRADAY_5M', 'EOD_STATIC', matrix);

  assert.equal(result.is_allowed, false);
  assert.equal(result.effective_confidence_multiplier, 0.0);
  assert.ok(result.violations.some((v) => v.includes('Intraday trading requires real-time quotes')));
});

test('Phase 8 - Horizon Gating: Allows swing trading on EOD data when daily bars & broker summary exist', () => {
  const matrix = buildCapabilityMatrix({ hasStockbitToken: true, hasGeminiKey: true });
  const result = validateHorizonGating('DAILY_SWING', 'EOD_HISTORICAL', matrix);

  assert.equal(result.is_allowed, true);
  assert.equal(result.effective_confidence_multiplier, 1.0);
  assert.equal(result.violations.length, 0);
});

test('Phase 8 - Horizon Gating: Live Authentic allows INTRADAY_5M with full confidence', () => {
  const matrix = buildCapabilityMatrix({ hasStockbitToken: true, hasGeminiKey: true });
  const result = validateHorizonGating('INTRADAY_5M', 'LIVE_AUTHENTIC', matrix);

  assert.equal(result.is_allowed, true);
  assert.equal(result.effective_confidence_multiplier, 1.0);
});

test('Phase 8 - Horizon Gating: Degraded intraday bars penalize confidence to 75%', () => {
  const matrix = buildCapabilityMatrix({ hasStockbitToken: true, hasGeminiKey: true });
  // INTRADAY_60M requires ohlcv_daily which is READY, but if we check degraded capability:
  matrix.ohlcv_daily.state = 'DEGRADED';
  const result = validateHorizonGating('DAILY_SWING', 'LIVE_HYBRID', matrix);

  assert.equal(result.is_allowed, true);
  assert.equal(result.effective_confidence_multiplier, 0.75);
  assert.ok(result.gate_reason.includes('penalized') || result.gate_reason.includes('degraded'));
});

test('Phase 8 - Horizon Gating: Hard gate when token is missing and quote/orderbook is UNAVAILABLE', () => {
  const unauthenticatedMatrix = buildCapabilityMatrix({ hasStockbitToken: false });
  const result = validateHorizonGating('INTRADAY_5M', 'LIVE_AUTHENTIC', unauthenticatedMatrix);

  assert.equal(result.is_allowed, false);
  assert.equal(result.effective_confidence_multiplier, 0.0);
  assert.ok(result.violations.some((v) => v.includes('unavailable')));
});
