/**
 * tests/quant-smartmoney-ai.test.ts
 * Comprehensive Institutional Verification Suite for SmartMoney AI
 */

import { getIdxTickSize, snapToIdxTick, getTickDistance } from '../lib/config/idx-fraksi-config';
import {
  computeTechnicalIndicators,
  calculateEMA,
  calculateSMA,
  calculateRSI,
  calculateVWAP,
  calculateVolumeProfile,
  detectMarketStructure,
} from '../lib/indicators/technical-engine';
import type { OHLCVBar } from '../lib/indicators/types';
import {
  calculateNetFlow,
  calculateFlowConcentration,
  calculateFlowVwapProxy,
  calculatePersistence,
  calculateOrderBookImbalance,
  analyzeAccumulationProxy,
} from '../lib/accumulation/accumulation-proxy-engine';
import {
  calculateExecutionFriction,
  buildCandidateSetup,
  evaluateEntryCandidates,
} from '../lib/execution/entry-risk-engine';
import { predictAccumulationState } from '../lib/models/accumulation-state-model';
import {
  predictTradeOutcomeChampion,
  predictTradeOutcomeChallenger,
} from '../lib/models/trade-outcome-model';
import { buildModelFeatureVector } from '../lib/models/model-registry';
import { evaluateDecisionGate } from '../lib/decisions/decision-gate';
import {
  logSignalToJournal,
  resolveSignalOutcome,
  getAllJournalSignals,
} from '../lib/journal/signal-journal';
import { generateWeeklyPostMortem } from '../lib/journal/post-mortem-engine';
import { evaluateMarketRegime, formatSectionKOutput } from '../lib/market-context/market-regime';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${msg}`);
  }
}

console.log('=== Starting SmartMoney AI Quantitative Verification Suite ===\n');

// 1. Test IDX Fraksi Rules
console.log('1. Testing IDX Fraksi Engine...');
assert(getIdxTickSize(150) === 1, 'Tick for price 150 must be 1');
assert(getIdxTickSize(350) === 2, 'Tick for price 350 must be 2');
assert(getIdxTickSize(1200) === 5, 'Tick for price 1200 must be 5');
assert(getIdxTickSize(3200) === 10, 'Tick for price 3200 must be 10');
assert(getIdxTickSize(8500) === 25, 'Tick for price 8500 must be 25');

// Down snapping for stop loss
assert(snapToIdxTick(1234, 'DOWN') === 1230, 'Down snap for 1234 (fraksi 5) must be 1230');
// Up snapping for target
assert(snapToIdxTick(1234, 'UP') === 1235, 'Up snap for 1234 (fraksi 5) must be 1235');
console.log('   ✓ IDX Fraksi rules and boundary snapping passed.');

// 2. Test Deterministic Technical Indicators
console.log('2. Testing Deterministic Technical Indicator Engine...');
const mockBars: OHLCVBar[] = [];
let basePrice = 5000;
for (let i = 0; i < 50; i++) {
  const trend = i * 20;
  const o = basePrice + trend;
  const h = o + 50;
  const l = o - 25;
  const c = o + 25;
  const v = 10000 + (i % 5) * 2000;
  mockBars.push({
    timestamp: new Date(Date.now() - (50 - i) * 86400000).toISOString(),
    open: o,
    high: h,
    low: l,
    close: c,
    volume: v,
  });
}

const tech = computeTechnicalIndicators('BBCA', mockBars);
assert(tech.trend.ema20 > 0, 'EMA 20 must be calculated');
assert(tech.trend.regime === 'STRONG_UPTREND' || tech.trend.regime === 'UPTREND', 'Uptrend should be identified');
assert(tech.vwap.session_vwap > 0, 'Session VWAP must be calculated');
assert(tech.volume_profile.poc > 0, 'Volume Profile POC must be positive');
assert(tech.volume_profile.vah >= tech.volume_profile.val, 'VAH must be >= VAL');
assert(tech.momentum.rsi14 >= 0 && tech.momentum.rsi14 <= 100, 'RSI must be in [0, 100]');
assert(tech.momentum.disclaimer.includes('never standalone buy triggers'), 'RSI must have non-trigger disclaimer');
console.log('   ✓ Technical indicator engine passed.');

// 3. Test Accumulation Proxy Engine
console.log('3. Testing Accumulation Proxy Engine...');
const mockTransactions = [
  {
    broker_code: 'AK',
    buy_volume: 50000,
    sell_volume: 5000,
    buy_value: 5000000000,
    sell_value: 500000000,
    average_buy_price: 5200,
    average_sell_price: 5210,
    net_buy_value: 4500000000,
    net_buy_volume: 45000,
  },
  {
    broker_code: 'BK',
    buy_volume: 30000,
    sell_volume: 2000,
    buy_value: 3000000000,
    sell_value: 200000000,
    average_buy_price: 5205,
    average_sell_price: 5215,
    net_buy_value: 2800000000,
    net_buy_volume: 28000,
  },
  {
    broker_code: 'YP',
    buy_volume: 1000,
    sell_volume: 40000,
    buy_value: 100000000,
    sell_value: 4000000000,
    average_buy_price: 5220,
    average_sell_price: 5190,
    net_buy_value: -3900000000,
    net_buy_volume: -39000,
  },
];

const net = calculateNetFlow(mockTransactions);
assert(net.netFlowValue > 0, 'Net flow must be positive');
assert(net.netFlowRatio > 0, 'Net flow ratio must be positive');

const conc = calculateFlowConcentration(mockTransactions);
assert(conc.hhi > 2000, 'Concentrated institutional buyers must produce elevated HHI');
assert(conc.cr3 >= 80, 'Top 2 buyers account for majority share');

const flowVwap = calculateFlowVwapProxy(mockTransactions, 5200);
assert(flowVwap >= 5200, 'Flow VWAP proxy must reflect weighted buyer average');

const currentSnap = { date: '2026-09-09', close_price: 5250, transactions: mockTransactions };
const accResult = analyzeAccumulationProxy('BBCA', 5250, currentSnap, [currentSnap]);
assert(accResult.flow_state === 'accumulation_like', 'Flow state must be accumulation_like');
assert(accResult.order_flow.type === 'PROXY_NOT_TRUE_DELTA', 'Must be tagged PROXY_NOT_TRUE_DELTA');
assert(accResult.p_accumulation_like === null, 'Without N >= 30 historical samples, calibrated prob must be null');
console.log('   ✓ Accumulation proxy engine passed.');

// 4. Test Execution Cost, Invalidation & Net RRR
console.log('4. Testing Execution Cost & Net RRR Engine...');
const friction = calculateExecutionFriction(5200, 5500, 0.005);
assert(friction.buyCost > 0 && friction.sellCost > 0, 'Costs must be positive');
assert(friction.totalCost > friction.buyCost + friction.sellCost, 'Total cost must include slippage');

const riskEval = evaluateEntryCandidates('BBCA', tech, accResult);
assert(riskEval.primary_candidate !== null, 'Candidate must be identified');
assert(riskEval.primary_candidate!.invalidation_price < riskEval.primary_candidate!.recommended_entry_price, 'Invalidation must be below entry');
assert(riskEval.primary_candidate!.net_rrr > 0, 'Net RRR must be positive');
console.log('   ✓ Execution risk and net RRR engine passed.');

// 5. Test Two-Model Probability Architecture & Sample Gating
console.log('5. Testing Two-Model Probability Architecture...');
const fVec = buildModelFeatureVector('BBCA', tech, accResult, riskEval.primary_candidate);

// Case A: Insufficient samples (< 30) -> Probability strictly null
const uncalibPred = predictTradeOutcomeChampion(fVec, []);
assert(uncalibPred.calibrated_probability === null, 'Must output null probability when N < 30');
assert(uncalibPred.reason_code === 'INSUFFICIENT_HISTORY', 'Must state INSUFFICIENT_HISTORY');
assert(uncalibPred.raw_score >= 0 && uncalibPred.raw_score <= 100, 'Raw score must remain accessible as ranking score');

// Case B: Sufficient samples (N = 40) -> Calibrated probability with Wilson CI
const mockResolved = Array(40).fill(null).map((_, i) => ({
  outcome_status: i < 26 ? 'TARGET_FIRST' : 'STOP_HIT',
}));
const calibPred = predictTradeOutcomeChampion(fVec, mockResolved);
assert(calibPred.calibrated_probability !== null, 'Calibrated probability must be present when N >= 30');
assert(calibPred.confidence_interval_95 !== null, 'Wilson CI must be computed');
assert(calibPred.brier_score !== null, 'Brier score must be computed');
console.log('   ✓ Probability architecture and N >= 30 gating passed.');

// 6. Test Decision Gate State Machine
console.log('6. Testing Decision Gate...');
const gateOutput = evaluateDecisionGate('BBCA', tech, accResult, riskEval, calibPred);
assert(
  gateOutput.decision === 'ENTER_NOW' ||
  gateOutput.decision === 'BUY_CONDITIONAL' ||
  gateOutput.decision === 'WATCH' ||
  gateOutput.decision === 'WAIT_PULLBACK' ||
  gateOutput.decision === 'NO_TRADE',
  'Decision must be valid enum'
);

// Stale feed test
const staleEnvelope = {
  value: {},
  source_id: 'stockbit',
  source_type: 'broker_summary',
  as_of: new Date().toISOString(),
  ingested_at: new Date().toISOString(),
  freshness_sec: 9999,
  data_mode: 'STALE' as const,
  quality_status: 'DEGRADED' as const,
};
const staleGate = evaluateDecisionGate('BBCA', tech, accResult, riskEval, calibPred, staleEnvelope);
assert(staleGate.decision === 'NO_TRADE', 'Stale data MUST strictly output NO_TRADE');
assert(staleGate.no_trade_reasons.some((r) => r.includes('DATA_STALE')), 'Reason must state DATA_STALE');
console.log('   ✓ Decision gate and anti-stale gating passed.');

// 7. Test AI Signal Journal & Ambiguous Bar Handling
console.log('7. Testing AI Signal Journal & Ambiguous Bar Collision...');
const journalSignal = logSignalToJournal({
  signal_id: 'SIG-TEST-001',
  symbol: 'BBCA',
  generated_at: new Date().toISOString(),
  data_as_of: new Date().toISOString(),
  timeframe: 'DAILY_SWING',
  setup_type: 'PULLBACK_VWAP_SUPPORT',
  feature_snapshot: {},
  accumulation_proxy_score: 82,
  p_accumulation_like: 0.65,
  p_target_before_stop: 0.62,
  rank_score: 75,
  model_version: 'v1.2.0-champion',
  entry_zone: [5200, 5250],
  recommended_entry: 5225,
  actual_fill: 5225,
  stop: 5100,
  target_1: 5400,
  target_2: 5600,
  slippage: 15,
  transaction_cost: 25,
  outcome: 'TIMEOUT',
  mfe: 0,
  mae: 0,
  realized_r: null,
  time_to_target_bars: null,
  time_to_stop_bars: null,
  news_at_signal_time: null,
  user_override: false,
  data_quality_status: 'CONFIRMED',
});

// Candle that pierces both Target (5400) and Stop (5100) on the same bar
const ambiguousBar: OHLCVBar = {
  timestamp: new Date().toISOString(),
  open: 5225,
  high: 5450, // >= 5400 Target
  low: 5050,  // <= 5100 Stop
  close: 5300,
  volume: 50000,
};

const resolution = resolveSignalOutcome(journalSignal, [ambiguousBar], false);
assert(
  resolution.outcome === 'AMBIGUOUS_BAR',
  'Same-bar target and stop collision without tick data MUST resolve as AMBIGUOUS_BAR'
);
assert(resolution.realizedR === null, 'Ambiguous bar must not record forced win or loss R');

// Post-Mortem Report Generation
const postMortem = generateWeeklyPostMortem(
  getAllJournalSignals(),
  new Date(Date.now() - 7 * 86400000).toISOString(),
  new Date().toISOString()
);
assert(postMortem.report_id.startsWith('postmortem-'), 'Post-mortem report must be generated');
assert(postMortem.parameter_change_proposals.length > 0, 'Parameter proposals must be created');
console.log('   ✓ AI Signal Journal and Ambiguous Bar resolution passed.');

// 8. Test Section K Output Format
console.log('8. Testing Section K Canonical Output...');
const regime = evaluateMarketRegime(7500, 7480, 7420, 7300, 7400);
const sectionK = formatSectionKOutput(regime, [
  { decisionGate: gateOutput, tech, accProxy: accResult },
]);
assert(sectionK.as_of !== '', 'Section K as_of must be populated');
assert(sectionK.candidates.length === 1, 'Candidate must be present');
assert(sectionK.candidates[0].symbol === 'BBCA', 'Symbol must be BBCA');
console.log('   ✓ Section K canonical output passed.');

console.log('\n======================================================');
console.log('ALL SMARTMONEY AI QUANTITATIVE TESTS PASSED (8/8)!');
console.log('======================================================\n');
