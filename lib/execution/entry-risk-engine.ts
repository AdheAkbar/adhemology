/**
 * lib/execution/entry-risk-engine.ts
 * Lowest-Risk Entry Candidate & Execution Cost Engine (SmartMoney AI)
 * 
 * Strict Quant Protocol:
 * - Identifies "LOWEST-RISK CANDIDATE UNDER CURRENT DATA" across 6 structural setups.
 * - Enforces realistic execution frictions: IDX broker commission, exchange levy, 0.1% sales tax, and slippage.
 * - Computes Net Reward, Net Risk, Net RRR, and Expected Value (EV).
 * - Snaps all invalidation barriers strictly DOWN to valid IDX tick boundaries.
 */

import { snapToIdxTick, getIdxTickSize } from '../config/idx-fraksi-config';
import type { TechnicalIndicatorsBundle } from '../indicators/types';
import type { AccumulationProxyResult } from '../accumulation/types';

export type SetupType =
  | 'PULLBACK_VWAP_SUPPORT'
  | 'BREAKOUT_RETEST'
  | 'RECLAIM_FLOW_VWAP'
  | 'ABSORPTION_REVERSAL'
  | 'CONTINUATION_HIGHER_LOW'
  | 'LIQUIDITY_SWEEP_RECOVERY';

export interface FeeStructure {
  buyFeePct: number; // e.g., 0.0015 (0.15%)
  sellFeePct: number; // e.g., 0.0025 (0.25% including 0.1% withholding tax)
}

export const DEFAULT_IDX_FEES: FeeStructure = {
  buyFeePct: 0.0015,
  sellFeePct: 0.0025,
};

export interface EntryCandidate {
  setup_type: SetupType;
  setup_title: string;
  entry_zone: [number, number]; // [minEntry, maxEntry]
  recommended_entry_price: number;
  trigger_condition: string;
  invalidation_price: number;
  stop_distance: number;
  stop_distance_atr: number;
  target_1: number;
  target_2: number;
  target_max: number;
  legacy_adimology_target: number;
  
  // Friction & Cost Breakdown
  estimated_slippage: number; // In price units
  buy_cost: number; // In IDR per share
  sell_cost: number; // In IDR per share
  total_friction_cost: number; // Total roundtrip cost per share
  
  // Net Risk-Reward Metrics
  gross_reward: number;
  gross_risk: number;
  net_reward: number;
  net_risk: number;
  net_rrr: number;
  is_net_rrr_acceptable: boolean; // Evaluated against threshold (typically >= 1.5x)
  expected_value: number | null; // Net EV per share if calibrated probability is available
  
  rationale: string;
}

export type EntryRiskPlan = EntryCandidate;

export interface EntryRiskEngineOutput {
  as_of: string;
  symbol: string;
  current_price: number;
  primary_candidate: EntryCandidate | null;
  all_candidates: EntryCandidate[];
  summary_label: 'LOWEST-RISK CANDIDATE UNDER CURRENT DATA' | 'NO_SUITABLE_CANDIDATE';
}

/**
 * Computes roundtrip execution friction for IDX trading.
 */
export function calculateExecutionFriction(
  entryPrice: number,
  targetPrice: number,
  spreadPct: number = 0.005,
  fees: FeeStructure = DEFAULT_IDX_FEES
): {
  buyCost: number;
  sellCost: number;
  slippageCost: number;
  totalCost: number;
} {
  const buyCost = Number((entryPrice * fees.buyFeePct).toFixed(2));
  const sellCost = Number((targetPrice * fees.sellFeePct).toFixed(2));
  
  // Slippage proxy: half the spread plus a tick fraction
  const tick = getIdxTickSize(entryPrice);
  const slippageCost = Math.max(tick, Math.round(entryPrice * (spreadPct / 2)));
  const totalCost = Number((buyCost + sellCost + slippageCost).toFixed(2));

  return { buyCost, sellCost, slippageCost, totalCost };
}

/**
 * Builds candidate metrics for a specific structural setup.
 */
export function buildCandidateSetup(
  setupType: SetupType,
  currentPrice: number,
  proposedEntry: number,
  rawInvalidation: number,
  tech: TechnicalIndicatorsBundle,
  accProxy: AccumulationProxyResult,
  fees: FeeStructure = DEFAULT_IDX_FEES,
  spreadPct: number = 0.005,
  calibratedProb?: number | null
): EntryCandidate {
  const tick = getIdxTickSize(currentPrice);
  const entryPrice = snapToIdxTick(proposedEntry, 'NEAREST');

  // Hard Invalidation: strictly snapped DOWN to tick boundary and strictly below entry
  const maxAllowableInvalidation = entryPrice - tick;
  const invalidationPrice = snapToIdxTick(
    Math.min(maxAllowableInvalidation, rawInvalidation),
    'DOWN'
  );

  const stopDistance = entryPrice - invalidationPrice;
  const stopDistanceAtr = Number((stopDistance / (tech.volatility.atr14 || 1)).toFixed(2));

  // Heuristic Targets
  // T1: 1.5x risk above entry
  const rawT1 = entryPrice + Math.max(tick, Math.round(stopDistance * 1.5));
  const target1 = snapToIdxTick(rawT1, 'UP');

  // T2: 2.5x risk above entry
  const rawT2 = entryPrice + Math.max(2 * tick, Math.round(stopDistance * 2.5));
  const target2 = snapToIdxTick(rawT2, 'UP');

  // T_max: Recent swing high or 3.5x risk
  const rawTMax = Math.max(target2 + tick, tech.market_structure.recent_swing_high);
  const targetMax = snapToIdxTick(rawTMax, 'UP');

  // Legacy Adimology baseline target control
  const legacyTarget = snapToIdxTick(
    accProxy.flow_vwap_proxy + accProxy.flow_vwap_proxy * 0.05 + tick * 2,
    'NEAREST'
  );

  // Execution Costs
  const friction = calculateExecutionFriction(entryPrice, target1, spreadPct, fees);

  const grossReward = target1 - entryPrice;
  const grossRisk = entryPrice - invalidationPrice;

  // NET FORMULA:
  // net_reward = target_price - entry_price - total_cost
  // net_risk = entry_price - invalidation_price + total_cost
  const netReward = Number((grossReward - friction.totalCost).toFixed(2));
  const netRisk = Number((grossRisk + friction.totalCost).toFixed(2));
  const netRrr = netRisk > 0 ? Number((netReward / netRisk).toFixed(2)) : 0;
  const isNetRrrAcceptable = netRrr >= 1.5;

  // Expected Value (EV) = (p * net_reward) - ((1 - p) * net_risk)
  let expectedValue: number | null = null;
  if (calibratedProb != null && calibratedProb > 0) {
    expectedValue = Number(
      (calibratedProb * netReward - (1 - calibratedProb) * netRisk).toFixed(2)
    );
  }

  // Setup descriptions & trigger conditions
  let setupTitle = 'Pullback to Support';
  let trigger = 'Price touches entry zone with contracting sell volume';
  let rationale = `Entry anchored to support at Rp ${entryPrice.toLocaleString()} with Stop Loss at Rp ${invalidationPrice.toLocaleString()}. Net RRR: ${netRrr}x after transaction frictions.`;

  switch (setupType) {
    case 'PULLBACK_VWAP_SUPPORT':
      setupTitle = 'Pullback to Session VWAP / Support';
      trigger = 'Pullback to Session VWAP with drying volume, followed by 1m/5m bullish confirmation candle';
      rationale = `Pullback to Session VWAP (Rp ${tech.vwap.session_vwap.toLocaleString()}) offering tight risk to invalidation (Rp ${invalidationPrice.toLocaleString()}).`;
      break;
    case 'BREAKOUT_RETEST':
      setupTitle = 'Breakout & Retest';
      trigger = `Retest of broken resistance (Rp ${tech.market_structure.recent_swing_high.toLocaleString()}) holding as new support`;
      rationale = `Breakout retest confirmed. Prior resistance flipped to support; invalidation placed below retest low.`;
      break;
    case 'RECLAIM_FLOW_VWAP':
      setupTitle = 'Reclaim of Flow VWAP Proxy';
      trigger = `Price crosses back above Flow VWAP Proxy (Rp ${accProxy.flow_vwap_proxy.toLocaleString()}) with volume spike`;
      rationale = `Price reclaiming Flow VWAP Proxy indicates institutional net-buying support absorbing selling pressure.`;
      break;
    case 'ABSORPTION_REVERSAL':
      setupTitle = 'Absorption Reversal';
      trigger = 'Heavy volume spike at support without lower price progression, followed by bounce';
      rationale = `Significant sell orders absorbed at key level. Invalidation anchored just below absorption floor.`;
      break;
    case 'CONTINUATION_HIGHER_LOW':
      setupTitle = 'Trend Continuation after Higher Low';
      trigger = 'Formation of higher low above EMA 20 with expanding buyer momentum';
      rationale = `Trend continuation structure (HL). Invalidation placed below recent structural swing low.`;
      break;
    case 'LIQUIDITY_SWEEP_RECOVERY':
      setupTitle = 'Liquidity Sweep Recovery';
      trigger = `False breakdown below swing low (Rp ${tech.market_structure.recent_swing_low.toLocaleString()}) followed by swift close back inside range`;
      rationale = `Liquidity sweep captured stop orders below key low; tight invalidation below sweep wick.`;
      break;
  }

  const entryZone: [number, number] = [
    snapToIdxTick(entryPrice - tick, 'DOWN'),
    snapToIdxTick(entryPrice + tick, 'UP'),
  ];

  return {
    setup_type: setupType,
    setup_title: setupTitle,
    entry_zone: entryZone,
    recommended_entry_price: entryPrice,
    trigger_condition: trigger,
    invalidation_price: invalidationPrice,
    stop_distance: stopDistance,
    stop_distance_atr: stopDistanceAtr,
    target_1: target1,
    target_2: target2,
    target_max: targetMax,
    legacy_adimology_target: legacyTarget,
    estimated_slippage: friction.slippageCost,
    buy_cost: friction.buyCost,
    sell_cost: friction.sellCost,
    total_friction_cost: friction.totalCost,
    gross_reward: grossReward,
    gross_risk: grossRisk,
    net_reward: netReward,
    net_risk: netRisk,
    net_rrr: netRrr,
    is_net_rrr_acceptable: isNetRrrAcceptable,
    expected_value: expectedValue,
    rationale,
  };
}

/**
 * Evaluates market condition and generates lowest-risk candidate setups.
 */
export function evaluateEntryCandidates(
  symbol: string,
  tech: TechnicalIndicatorsBundle,
  accProxy: AccumulationProxyResult,
  fees: FeeStructure = DEFAULT_IDX_FEES,
  spreadPct: number = 0.005
): EntryRiskEngineOutput {
  const p0 = tech.current_price;
  const tick = getIdxTickSize(p0);
  const candidates: EntryCandidate[] = [];

  // Setup 1: Pullback to Session VWAP
  if (tech.vwap.session_vwap > 0 && p0 >= tech.vwap.session_vwap * 0.98) {
    const entry = tech.vwap.session_vwap;
    const invalidation = entry - 1.5 * tech.volatility.atr14;
    candidates.push(
      buildCandidateSetup(
        'PULLBACK_VWAP_SUPPORT',
        p0,
        entry,
        invalidation,
        tech,
        accProxy,
        fees,
        spreadPct,
        accProxy.p_accumulation_like
      )
    );
  }

  // Setup 2: Reclaim of Flow VWAP Proxy
  if (accProxy.flow_vwap_proxy > 0) {
    const entry = accProxy.flow_vwap_proxy;
    const invalidation = entry - Math.max(2 * tick, tech.volatility.atr14);
    candidates.push(
      buildCandidateSetup(
        'RECLAIM_FLOW_VWAP',
        p0,
        entry,
        invalidation,
        tech,
        accProxy,
        fees,
        spreadPct,
        accProxy.p_accumulation_like
      )
    );
  }

  // Setup 3: Breakout Retest (if near or above swing high)
  if (tech.market_structure.recent_swing_high > 0) {
    const entry = tech.market_structure.recent_swing_high;
    const invalidation = entry - Math.max(2 * tick, tech.volatility.atr14);
    candidates.push(
      buildCandidateSetup(
        'BREAKOUT_RETEST',
        p0,
        entry,
        invalidation,
        tech,
        accProxy,
        fees,
        spreadPct,
        accProxy.p_accumulation_like
      )
    );
  }

  // Setup 4: Liquidity Sweep Recovery
  if (tech.market_structure.liquidity_sweep) {
    const entry = p0;
    const invalidation = tech.market_structure.recent_swing_low - tick;
    candidates.push(
      buildCandidateSetup(
        'LIQUIDITY_SWEEP_RECOVERY',
        p0,
        entry,
        invalidation,
        tech,
        accProxy,
        fees,
        spreadPct,
        accProxy.p_accumulation_like
      )
    );
  }

  // Setup 5: Trend Continuation after Higher Low
  if (tech.market_structure.structure_state === 'HIGHER_LOW' || tech.trend.regime === 'UPTREND') {
    const entry = p0;
    const invalidation = tech.market_structure.recent_swing_low - tick;
    candidates.push(
      buildCandidateSetup(
        'CONTINUATION_HIGHER_LOW',
        p0,
        entry,
        invalidation,
        tech,
        accProxy,
        fees,
        spreadPct,
        accProxy.p_accumulation_like
      )
    );
  }

  // Select Primary Candidate:
  // Rank by: acceptable net RRR (>= 1.5x) > positive EV > highest net RRR
  const validCandidates = candidates.filter((c) => c.is_net_rrr_acceptable);
  let primaryCandidate: EntryCandidate | null = null;

  if (validCandidates.length > 0) {
    validCandidates.sort((a, b) => {
      if (a.expected_value !== null && b.expected_value !== null) {
        return b.expected_value - a.expected_value;
      }
      return b.net_rrr - a.net_rrr;
    });
    primaryCandidate = validCandidates[0];
  } else if (candidates.length > 0) {
    // If none met 1.5x net RRR threshold, pick the highest net RRR candidate as non-actionable reference
    candidates.sort((a, b) => b.net_rrr - a.net_rrr);
    primaryCandidate = candidates[0];
  }

  return {
    as_of: new Date().toISOString(),
    symbol: symbol.toUpperCase(),
    current_price: p0,
    primary_candidate: primaryCandidate,
    all_candidates: candidates,
    summary_label:
      primaryCandidate && primaryCandidate.is_net_rrr_acceptable
        ? 'LOWEST-RISK CANDIDATE UNDER CURRENT DATA'
        : 'NO_SUITABLE_CANDIDATE',
  };
}
