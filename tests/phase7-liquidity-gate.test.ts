import test from 'node:test';
import assert from 'node:assert/strict';
import { assessLiquidityAndExecution, PARTICIPATION_RATE_LIMIT } from '../lib/execution/liquidity-gate';

test('Phase 7 - Liquidity Gate: Institutional High Liquidity (e.g. BBCA)', () => {
  const assessment = assessLiquidityAndExecution({
    emiten: 'BBCA',
    current_price: 10000,
    average_daily_turnover_idr: 500_000_000_000, // 500 Miliar IDR
    best_bid: 10000,
    best_offer: 10025, // 1 fraksi tick (25 IDR)
    offer_depth_lots: 50000,
  });

  assert.equal(assessment.liquidity_rating, 'HIGH_LIQUIDITY');
  assert.equal(assessment.is_tradable, true);
  assert.equal(assessment.spread_ticks, 1);
  assert.ok(assessment.spread_pct <= 0.3);
  assert.equal(assessment.max_position_size_idr, 500_000_000_000 * PARTICIPATION_RATE_LIMIT);
  // pricePerLot = 10000 * 100 = 1,000,000 IDR
  // max_position_lots = 10,000,000,000 / 1,000,000 = 10,000 lots
  assert.equal(assessment.max_position_lots, 10000);
});

test('Phase 7 - Liquidity Gate: Moderate Liquidity Mid-Cap', () => {
  const assessment = assessLiquidityAndExecution({
    emiten: 'ACES',
    current_price: 800,
    average_daily_turnover_idr: 5_000_000_000, // 5 Miliar IDR
    best_bid: 800,
    best_offer: 810, // 2 ticks (5 IDR fraksi)
    offer_depth_lots: 5000,
  });

  assert.equal(assessment.liquidity_rating, 'MODERATE_LIQUIDITY');
  assert.equal(assessment.is_tradable, true);
  assert.equal(assessment.spread_ticks, 2);
  assert.ok(assessment.max_position_size_idr === 100_000_000);
});

test('Phase 7 - Liquidity Gate: Low Liquidity Warning with Wide Spread', () => {
  const assessment = assessLiquidityAndExecution({
    emiten: 'SMALL',
    current_price: 150,
    average_daily_turnover_idr: 400_000_000, // 400 Juta IDR
    best_bid: 150,
    best_offer: 156, // 6 ticks (1 IDR fraksi) -> 4% spread
  });

  assert.equal(assessment.liquidity_rating, 'LOW_LIQUIDITY_WARNING');
  assert.equal(assessment.is_tradable, true);
  assert.ok(assessment.gate_reason.includes('Caution: Thin liquidity'));
});

test('Phase 7 - Liquidity Gate: Illiquid Gated Stocks (ADT < 200M or Extreme Spread)', () => {
  const assessment = assessLiquidityAndExecution({
    emiten: 'SLEEP',
    current_price: 50,
    average_daily_turnover_idr: 50_000_000, // 50 Juta IDR (Illiquid)
    best_bid: 50,
    best_offer: 55, // 10% spread
  });

  assert.equal(assessment.liquidity_rating, 'ILLIQUID_GATED');
  assert.equal(assessment.is_tradable, false);
  assert.ok(assessment.gate_reason.includes('Execution Gated'));
});

test('Phase 7 - Liquidity Gate: Order Sweep Slippage Penalty', () => {
  // Normal small order
  const smallOrder = assessLiquidityAndExecution({
    emiten: 'TEST',
    current_price: 1000,
    average_daily_turnover_idr: 2_000_000_000,
    best_bid: 1000,
    best_offer: 1005, // 1 tick
    offer_depth_lots: 500,
    desired_order_size_idr: 10_000_000, // 100 lots <= 500 lots
  });

  // Large aggressive sweep order exceeding depth
  const largeOrder = assessLiquidityAndExecution({
    emiten: 'TEST',
    current_price: 1000,
    average_daily_turnover_idr: 2_000_000_000,
    best_bid: 1000,
    best_offer: 1005, // 1 tick
    offer_depth_lots: 100,
    desired_order_size_idr: 50_000_000, // 500 lots > 100 lots (5x sweep)
  });

  assert.ok(largeOrder.estimated_slippage_pct > smallOrder.estimated_slippage_pct);
});
