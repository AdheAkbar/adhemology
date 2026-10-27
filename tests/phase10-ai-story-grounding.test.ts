import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGroundedStoryPrompt } from '../lib/ai-story/grounding-engine';
import type { TargetLadder } from '../lib/targets/types';
import type { CalibratedProbability } from '../lib/calibration/types';
import type { LiquidityAssessment } from '../lib/execution/types';
import type { HybridFlowMetrics } from '../lib/broker-flow/types';

test('Phase 10 - AI Story Grounding: Embeds target ladder and invalidation into prompt', () => {
  const targetLadder: TargetLadder = {
    t1_realistic: 10500,
    t2_stretch: 11000,
    t_max: 11500,
    invalidation_price: 9750,
    legacy_adimology_target: 10400,
    legacy_adimology_max: 11200,
    risk_reward_ratio: 2.0,
    is_rrr_acceptable: true,
    fraksi: 25,
    effective_atr: 250,
    risk_amount: 250,
    reward_amount: 500,
    rationale: 'Valid setup',
  };

  const flowMetrics: HybridFlowMetrics = {
    regime: 'STRONG_ACCUMULATION',
    eod_broker_net_value: 45_000_000_000,
    top_accumulators: ['BK', 'ZP', 'CC'],
    top_distributors: ['YP', 'PD'],
    orderbook_imbalance_ratio: 1.65,
    large_block_active_buyer: true,
    composite_flow_score: 85,
    summary_text: 'Big institutional accumulation',
  };

  const liquidity: LiquidityAssessment = {
    emiten: 'BBCA',
    current_price: 10000,
    average_daily_turnover_idr: 500_000_000_000,
    max_position_size_idr: 10_000_000_000,
    max_position_lots: 10000,
    spread_ticks: 1,
    spread_pct: 0.25,
    estimated_slippage_pct: 0.12,
    liquidity_rating: 'HIGH_LIQUIDITY',
    is_tradable: true,
    gate_reason: 'Institutional',
  };

  const promptObj = buildGroundedStoryPrompt({
    emiten: 'BBCA',
    current_price: 10000,
    targetLadder,
    flowMetrics,
    liquidityAssessment: liquidity,
  });

  // Prompt must explicitly mention T1 and Invalidation prices
  assert.ok(promptObj.userPrompt.includes('Target Realistis (T1): Rp 10500'));
  assert.ok(promptObj.userPrompt.includes('Invalidation Barrier (Stop Loss): Rp 9750'));
  assert.ok(promptObj.userPrompt.includes('STRONG_ACCUMULATION'));
  assert.ok(promptObj.userPrompt.includes('HIGH_LIQUIDITY'));

  // System prompt must forbid hallucinating prices
  assert.ok(promptObj.systemPrompt.includes('DILARANG KERAS berhalusinasi'));
});

test('Phase 10 - AI Story Grounding: Graceful handling when optional metrics are omitted', () => {
  const promptObj = buildGroundedStoryPrompt({
    emiten: 'TLKM',
    current_price: 2800,
  });

  assert.ok(promptObj.userPrompt.includes('Current Price: Rp 2800'));
  assert.ok(promptObj.userPrompt.includes('TLKM'));
  assert.ok(promptObj.systemPrompt.length > 50);
});
