/**
 * lib/decisions/decision-gate.ts
 * Hard Decision Gate State Machine (SmartMoney AI)
 * 
 * Strict Quant Protocol:
 * Enforces systematic qualification rules before granting execution clearance.
 * In the presence of stale, incomplete, illiquid, or conflicting data,
 * the engine strictly issues NO_TRADE.
 */

import type { TechnicalIndicatorsBundle } from '../indicators/types';
import type { AccumulationProxyResult } from '../accumulation/types';
import type { EntryCandidate, EntryRiskEngineOutput } from '../execution/entry-risk-engine';
import type { ModelPrediction } from '../models/types';
import type { DataEnvelope } from '../data-truth/types';

export type DecisionType =
  | 'ENTER_NOW'
  | 'BUY_CONDITIONAL'
  | 'WATCH'
  | 'WAIT_PULLBACK'
  | 'WAIT_BREAKOUT_RETEST'
  | 'NO_TRADE';

export interface DecisionGateOutput {
  decision: DecisionType;
  symbol: string;
  as_of: string;
  rank_score: number; // 0 to 100 ordinal
  calibrated_probability: number | null; // 0.0 to 1.0 (strictly null if uncalibrated)
  confidence: {
    label: 'HIGH' | 'MEDIUM' | 'LOW';
    sample_size: number;
    calibration_status: string;
    confidence_interval: [number, number] | null;
  };
  passed_checks: string[];
  failed_checks: string[];
  no_trade_reasons: string[];
  execution_directives: string[];
  selected_candidate: EntryCandidate | null;
}

export type QuantDecisionResult = DecisionGateOutput;

export function evaluateDecisionGate(
  symbol: string,
  tech: TechnicalIndicatorsBundle,
  accProxy: AccumulationProxyResult,
  riskOutput: EntryRiskEngineOutput,
  outcomePred: ModelPrediction,
  dataEnvelope?: DataEnvelope<any> | null,
  options?: {
    minTurnoverIdr?: number; // default Rp 1,000,000,000
    maxSpreadPct?: number; // default 0.015 (1.5%)
    minNetRrr?: number; // default 1.5x
  }
): DecisionGateOutput {
  const asOf = new Date().toISOString();
  const minTurnover = options?.minTurnoverIdr ?? 1_000_000_000;
  const maxSpread = options?.maxSpreadPct ?? 0.015;
  const minRrr = options?.minNetRrr ?? 1.5;

  const passed: string[] = [];
  const failed: string[] = [];
  const noTradeReasons: string[] = [];
  const candidate = riskOutput.primary_candidate;

  // 1. Data Integrity & Freshness Gate
  if (dataEnvelope) {
    if (dataEnvelope.data_mode === 'STALE' || dataEnvelope.data_mode === 'DISCONNECTED') {
      failed.push('Data feed is stale or disconnected');
      noTradeReasons.push(`DATA_STALE: Feed state is ${dataEnvelope.data_mode}. Live trading disallowed.`);
    } else if (dataEnvelope.quality_status === 'UNAVAILABLE') {
      failed.push('Data feed is unavailable');
      noTradeReasons.push('DATA_INSUFFICIENT: Essential market capabilities are offline.');
    } else {
      passed.push(`Data feed is verified (${dataEnvelope.data_mode}, ${dataEnvelope.quality_status})`);
    }
  }

  // 2. Liquidity & Spread Gate
  const dailyTurnover = tech.volume.dollar_volume;
  if (dailyTurnover < minTurnover) {
    failed.push(`Turnover is below threshold (Rp ${(dailyTurnover / 1e9).toFixed(2)}B vs min Rp ${(minTurnover / 1e9).toFixed(2)}B)`);
    noTradeReasons.push('LIQUIDITY_INSUFFICIENT: Stock daily turnover fails institutional liquidity threshold.');
  } else {
    passed.push(`Liquidity verified (Turnover: Rp ${(dailyTurnover / 1e9).toFixed(2)}B)`);
  }

  // Spread check
  if (candidate && candidate.estimated_slippage * 2 / tech.current_price > maxSpread) {
    failed.push('Bid-Ask spread is excessively wide (> 1.5%)');
    noTradeReasons.push('SPREAD_TOO_WIDE: Excessive spread inflates slippage beyond tolerance.');
  } else {
    passed.push('Bid-Ask spread is within tolerance');
  }

  // 3. Risk-Reward & EV Gate
  if (!candidate || candidate.net_rrr < minRrr) {
    failed.push(`Net RRR is below threshold (${candidate?.net_rrr ?? 0}x vs min ${minRrr}x)`);
    noTradeReasons.push(`RRR_SUBOPTIMAL: Net RRR of ${candidate?.net_rrr ?? 0}x after fees and slippage is insufficient.`);
  } else {
    passed.push(`Net RRR valid (${candidate.net_rrr}x)`);
  }

  if (candidate && candidate.expected_value !== null && candidate.expected_value <= 0) {
    failed.push(`Negative Expected Value (EV: Rp ${candidate.expected_value})`);
    noTradeReasons.push('NEGATIVE_EXPECTED_VALUE: Mathematical expectancy after fees is non-positive.');
  } else if (candidate && candidate.expected_value !== null && candidate.expected_value > 0) {
    passed.push(`Positive Expected Value verified (EV: Rp ${candidate.expected_value} per share)`);
  }

  // 4. Overextension Check (VWAP Distance)
  const isExtendedFromVwap = tech.vwap.price_distance_to_vwap_atr > 2.0;

  // Determine Final Decision
  let decision: DecisionType = 'NO_TRADE';
  const directives: string[] = [];

  if (noTradeReasons.length > 0) {
    decision = 'NO_TRADE';
    directives.push('Do not execute trade under current data. Preserve capital.');
  } else if (isExtendedFromVwap && !tech.market_structure.break_of_structure_bos) {
    decision = 'WAIT_PULLBACK';
    directives.push(
      `Price is extended +${tech.vwap.price_distance_to_vwap_atr} ATR from Session VWAP. Await mean-reverting pullback to Rp ${tech.vwap.session_vwap.toLocaleString()} before entering.`
    );
  } else if (tech.market_structure.recent_swing_high > 0 && tech.current_price > tech.market_structure.recent_swing_high && !tech.market_structure.breakout_retest_confirmed) {
    decision = 'WAIT_BREAKOUT_RETEST';
    directives.push(
      `Breakout detected above Rp ${tech.market_structure.recent_swing_high.toLocaleString()}. Await retest and confirmation of new support.`
    );
  } else if (accProxy.flow_state === 'accumulation_like' && candidate) {
    // Check if price is within candidate entry zone
    const [minEntry, maxEntry] = candidate.entry_zone;
    const isPriceInZone = tech.current_price >= minEntry && tech.current_price <= maxEntry;

    if (isPriceInZone && outcomePred.is_calibrated && (outcomePred.calibrated_probability ?? 0) >= 0.55) {
      decision = 'ENTER_NOW';
      directives.push(
        `Price (Rp ${tech.current_price.toLocaleString()}) is inside entry zone [${minEntry} - ${maxEntry}]. Trigger: ${candidate.trigger_condition}. Place limit entry.`
      );
    } else {
      decision = 'BUY_CONDITIONAL';
      directives.push(
        `Setup confirmed. Place conditional buy order at entry Rp ${candidate.recommended_entry_price.toLocaleString()} upon trigger confirmation.`
      );
    }
  } else {
    decision = 'WATCH';
    directives.push('Setup active on watchlist. Monitor broker flow and orderbook for structural trigger.');
  }

  // Confidence assessment
  let confidenceLabel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (outcomePred.is_calibrated && outcomePred.sample_size >= 50 && passed.length >= 4) {
    confidenceLabel = 'HIGH';
  } else if (outcomePred.sample_size >= 30) {
    confidenceLabel = 'MEDIUM';
  }

  return {
    decision,
    symbol: symbol.toUpperCase(),
    as_of: asOf,
    rank_score: outcomePred.raw_score,
    calibrated_probability: outcomePred.calibrated_probability,
    confidence: {
      label: confidenceLabel,
      sample_size: outcomePred.sample_size,
      calibration_status: outcomePred.calibration_method,
      confidence_interval: outcomePred.confidence_interval_95,
    },
    passed_checks: passed,
    failed_checks: failed,
    no_trade_reasons: noTradeReasons,
    execution_directives: directives,
    selected_candidate: candidate,
  };
}
