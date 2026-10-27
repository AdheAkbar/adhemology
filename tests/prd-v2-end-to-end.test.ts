import { evaluateEligibilityL0 } from '../lib/screener/eligibility-screener';
import { createFact, validateFactQuality } from '../lib/data-truth/point-in-time';
import { evaluateFeatureEngine } from '../lib/indicators/feature-engine';
import { evaluateMarketRegime, classifySessionPhase } from '../lib/market-context/market-regime';
import { evaluateSmartMoneyL4 } from '../lib/broker-flow/smart-money-engine';
import { evaluateNewsIntelligenceL5 } from '../lib/news-intelligence/event-engine';
import { evaluateCostAndExpectancyGate } from '../lib/execution/cost-expectancy-gate';
import { constructTradePlanL8 } from '../lib/execution/trade-construction';
import { buildHoldPlanL9 } from '../lib/targets/horizon-exit-engine';
import { evaluatePortfolioRiskL10 } from '../lib/execution/portfolio-risk-governor';
import { evaluateDecisionGateV2 } from '../lib/decisions/decision-gate-v2';
import { recordPrediction } from '../lib/ledger/prediction-ledger';
import { renderSlotFillingNarrative } from '../lib/ai-story/narrative-engine';

async function testEndToEndV2() {
  console.log('--- TEST: End-to-End Orchestration Adimology Pro v2.0 (L0 - L12) ---');

  const ticker = 'BBCA';
  const price = 6500;

  // 1. L0 Screener
  const screener = evaluateEligibilityL0({
    ticker,
    price,
    adtvIdr: 120_000_000_000,
    dailyFrequency: 15_000,
    listingAgeDays: 5000,
    freeFloatPct: 45.0,
    isFca: false,
    isSuspended: false,
    isUma: false,
    isPkpuOrBankruptcy: false,
    auditOpinionBad: false,
    atrDaily14: 180,
    pMove3Pct: 0.55,
    pMove7Pct: 0.15,
  });

  // BBCA dengan ATR 2.77% secara tepat masuk ke Tier B (Scalp Viable), membuktikan resolusi T-06 PRD v2.0
  if (screener.tier !== 'B') throw new Error(`Expected Tier B for BBCA (ATR% ~2.8%), got Tier ${screener.tier}`);
  console.log(`✓ L0 Screener evaluated: Tier ${screener.tier} (${screener.tierLabel}) — membuktikan validitas resolusi T-06`);

  // 2. L1 Data Integrity
  const priceFact = createFact('L1.price.last', price, 'IDR', 'EXCHANGE_FEED');
  const dataQuality = validateFactQuality(priceFact, {
    mode: 'SCALP',
    prevClose: 6475,
    orderbook: { bestBid: 6500, bestAsk: 6525 },
  });
  if (!dataQuality.passed) throw new Error('Data quality should pass');
  console.log('✓ L1 Data Quality Gate passed');

  // 3. L2 Feature Engine (Continuous & Decorrelated)
  const features = evaluateFeatureEngine(
    [
      { name: 'vwap_dev', cluster: 'LOCATION', rawValue: 0.5, medianRegime: 0, iqrRegime: 1, internalWeight: 1 },
      { name: 'ofi', cluster: 'FLOW', rawValue: 1.2, medianRegime: 0, iqrRegime: 0.8, internalWeight: 1 },
      { name: 'rvol', cluster: 'VOLUME', rawValue: 1.8, medianRegime: 1, iqrRegime: 0.5, internalWeight: 1 },
      { name: 'ema_slope', cluster: 'TREND', rawValue: 0.8, medianRegime: 0, iqrRegime: 0.4, internalWeight: 1 },
      { name: 'rsi', cluster: 'MOMENTUM', rawValue: 56, medianRegime: 50, iqrRegime: 15, internalWeight: 1 },
      { name: 'atr_pct', cluster: 'VOLATILITY', rawValue: 2.8, medianRegime: 2.5, iqrRegime: 0.8, internalWeight: 1 },
    ],
    'SCALP',
    { scoreExecutionTF: 1, scoreContextTF: 1, scoreBiasTF: 1 }
  );
  if (features.finalScore <= 50) throw new Error('Features should indicate bullish alignment');
  console.log(`✓ L2 Feature Engine evaluated: Score ${features.finalScore}/100, MTF Aligned=${features.mtfAlignment === 1}`);

  // 4. L3 Market Regime & Session
  const regime = evaluateMarketRegime(7500, 7480, 7420, 7300, 7350);
  const sessionPhase = classifySessionPhase(new Date('2026-09-15T03:30:00Z')); // 10:30 WIB (Mid Session)
  console.log(`✓ L3 Market Regime evaluated: ${regime.regimeV2}, Session: ${sessionPhase.phase}`);

  // 5. L4 Smart Money (Bandarmologi 2.0)
  const dummyBars = Array.from({ length: 20 }, (_, i) => ({
    open: 6400 + i * 5,
    high: 6420 + i * 5,
    low: 6390 + i * 5,
    close: 6415 + i * 5,
    volume: 100000 + i * 1000,
  }));
  const smartMoney = evaluateSmartMoneyL4({
    openPrice: 6475,
    closePrice: 6500,
    sellAggressiveVolumeLots: 5000,
    advPerMinuteLots: 10000,
    buyerSharesPct: [0.35, 0.25, 0.15],
    brokerRankPersistence: 0.85,
    supportDefenseRatio: 0.90,
    icebergFrequencyRatio: 0.70,
    netForeignFlow5dIdr: 45_000_000_000,
    bars: dummyBars,
    orderbookParams: {
      fiveLevelsBidValueIdr: 80_000_000_000,
      fiveLevelsOfferValueIdr: 60_000_000_000,
      plannedPositionSizeIdr: 100_000_000,
    },
    offerDepthVsBidDepthRatio: 0.75,
    offerHeavyDaysCount: 0,
  });
  console.log(`✓ L4 Smart Money evaluated: State=${smartMoney.state}, p=${smartMoney.absorptionRatioP}, a=${smartMoney.controlIndexA}`);

  // 6. L5 News Intelligence
  const news = evaluateNewsIntelligenceL5(
    ticker,
    [
      {
        id: 'news-1',
        ticker,
        headline: 'BBCA Cetak Pertumbuhan Laba Bersih Q3 Ditopang Pertumbuhan Kredit Korporasi',
        sourceUrl: 'https://idx.co.id',
        sourceTier: 'T1',
        publishedAt: new Date(),
        eventType: 'EARNINGS_BEAT',
        sentiment: 'POSITIVE',
        verifiedInDocument: true,
      },
    ],
    {
      currentPrice: price,
      volumeZScore: 1.8,
      aggressiveBuyRatio: 0.62,
      sessionVwap: 6480,
    }
  );
  console.log(`✓ L5 News Intelligence evaluated: Score=${news.netNewsScore}, Verdict=${news.headlineVerdict}`);

  // 7. L8 Trade Construction & Position Sizing
  const tradePlan = constructTradePlanL8({
    ticker,
    setupType: 'BREAKOUT_CONFIRMED',
    currentPrice: price,
    structuralSupportPrice: 6375,
    structuralResistancePrice: 6525,
    atr14Daily: 180,
    mode: 'SCALP',
    equityIdr: 100_000_000,
    riskPerTradePct: 0.75,
    advLot20d: 80_000,
    headroomAraPct: 20,
    headroomArbPct: 15,
    araPrice: 7800,
    arbPrice: 5525,
  });
  console.log(`✓ L8 Trade Construction: Entry Rp ${tradePlan.recommendedEntryPrice}, SL Rp ${tradePlan.slPrice}, Sizing ${tradePlan.sizing.lot} Lot`);

  // 8. L7 Cost & Expectancy Gate
  const expectancy = evaluateCostAndExpectancyGate({
    entryPrice: tradePlan.recommendedEntryPrice,
    slPrice: tradePlan.slPrice,
    tp1Price: tradePlan.targets[0].price,
    calibratedProbabilityP: 0.58,
    mode: 'SCALP',
    bestBid: 6500,
    bestAsk: 6525,
    plannedPositionSizeIdr: tradePlan.sizing.positionValueIdr,
  });
  console.log(`✓ L7 Cost & Expectancy Gate evaluated: Passed=${expectancy.passed}, Net TP1=+${expectancy.netMetrics.tp1NetPct}%, Net RR=${expectancy.netMetrics.rrNet}x`);

  // 9. L9 Horizon & Exit Engine
  const holdPlan = buildHoldPlanL9({
    ticker,
    mode: 'SCALP',
    entryPrice: tradePlan.recommendedEntryPrice,
    tp1Price: tradePlan.targets[0].price,
    tp2Price: tradePlan.targets[1].price,
    tp3Price: tradePlan.targets[2].price,
    slPrice: tradePlan.slPrice,
    atr14Daily: 180,
    efficiencyRatio20d: 0.45,
    currentAbsorptionP: smartMoney.absorptionRatioP,
    marketRegimeV2: regime.regimeV2,
  });
  console.log(`✓ L9 Horizon & Exit Engine: Time Stop ${holdPlan.timeStop.maxDays} days, Action=${holdPlan.recommendedAction}`);

  // 10. L10 Portfolio Risk Governor
  const portfolio = evaluatePortfolioRiskL10({
    totalEquityIdr: 100_000_000,
    availableBuyingPowerIdr: 80_000_000,
    activePositions: [],
    candidateTicker: ticker,
    candidateSector: 'Keuangan',
    candidateMode: 'SCALP',
    candidateRiskAmountIdr: tradePlan.sizing.riskAmountIdr,
    candidatePositionValueIdr: tradePlan.sizing.positionValueIdr,
    dailyRealizedPnlPct: 0,
    weeklyRealizedPnlPct: 0,
    peakToTroughDrawdownPct: 1.5,
    consecutiveLossCount: 0,
  });
  console.log(`✓ L10 Portfolio Risk Governor: Allowed=${portfolio.allowed}`);

  // 11. L12 Hard Decision Gate
  const decision = evaluateDecisionGateV2({
    ticker,
    mode: 'SCALP',
    screener,
    dataQuality,
    features,
    regime,
    sessionPhase,
    smartMoney,
    news,
    expectancy,
    tradePlan,
    holdPlan,
    portfolio,
    calibratedP: 0.58,
  });
  console.log(`✓ L12 Decision Gate Final Verdict: ${decision.verdict} (Conviction: ${decision.convictionBucket})`);

  // 12. Prediction Ledger Cryptographic Hash-Chain Test
  const pred1 = await recordPrediction({
    ticker,
    as_of_date: new Date(),
    horizon: 'DAILY_SWING',
    price_at_prediction: price,
    target_price: tradePlan.targets[0].price,
    invalidation_price: tradePlan.slPrice,
    time_stop_date: new Date(Date.now() + 86400000 * 3),
    score_raw: 75,
    prob_calibrated: 0.58,
  });

  const pred2 = await recordPrediction({
    ticker: 'BMRI',
    as_of_date: new Date(),
    horizon: 'DAILY_SWING',
    price_at_prediction: 7000,
    target_price: 7250,
    invalidation_price: 6850,
    time_stop_date: new Date(Date.now() + 86400000 * 3),
    score_raw: 70,
    prob_calibrated: 0.56,
  });

  if (!pred1.record_hash || !pred2.prev_ledger_hash) {
    throw new Error('Hash-chaining missing in prediction ledger');
  }
  if (pred2.prev_ledger_hash !== pred1.record_hash) {
    throw new Error('Cryptographic audit chain broken between pred1 and pred2');
  }
  console.log(`✓ Ledger Hash-Chain verified: ${pred1.record_hash.slice(0, 8)} -> ${pred2.record_hash?.slice(0, 8)}`);

  // 13. L11 Narrative Slot-Filling Test
  const rawNarrativeTemplate = `
Harga saat ini {{L1.price.last}} berada di fase {{L4.wyckoff_phase}} [claim:WYCKOFF_ACCUMULATION], dengan daya serap {{L4.absorption_p}} [claim:ABSORPTION_HIGH]. Target pertama {{L8.tp1}} dengan proteksi di {{L8.sl}}.
`.trim();

  const renderedNarrative = renderSlotFillingNarrative(rawNarrativeTemplate, decision.factSheet, decision.redTeamObjections);
  if (renderedNarrative.ungroundedNumericRate !== 0) throw new Error('Ungrounded numeric rate must be 0');
  console.log('✓ L11 Narrative Slot-Filling rendered successfully without hallucinated numbers');

  console.log('\n======================================================');
  console.log('ALL ADIMOLOGY PRO V2.0 END-TO-END TESTS PASSED!');
  console.log('======================================================\n');
}

testEndToEndV2().catch((err) => {
  console.error('End-to-End Test Failed:', err);
  process.exit(1);
});
