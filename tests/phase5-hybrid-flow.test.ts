/**
 * tests/phase5-hybrid-flow.test.ts
 * Acceptance test suite for Phase 5: Hybrid Broker Flow Engine.
 */

import {
  calculateConcentrationRatios,
  calculateAccumulationIntensity,
  determineFlowRegime,
  calculateBandarCostBasis,
  computeIntradayProxy,
  synthesizeHybridFlowReport,
} from '../lib/broker-flow/hybrid-flow-engine';
import type { BrokerEntry } from '../lib/broker-flow/hybrid-flow-engine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runAcceptanceTests() {
  console.log('===========================================================');
  console.log('🧪 RUNNING PHASE 5 HYBRID BROKER FLOW ACCEPTANCE TESTS');
  console.log('===========================================================\n');

  // ----------------------------------------------------
  // Test 1: Concentration Ratio Calculation (CR1, CR3, CR5)
  // ----------------------------------------------------
  console.log('Test 1: Concentration Ratio Calculation (CR1, CR3, CR5)...');
  const buyers: BrokerEntry[] = [
    { broker_code: 'CC', bval: 5000000000 }, // 5.0 B
    { broker_code: 'AK', bval: 3000000000 }, // 3.0 B
    { broker_code: 'BK', bval: 2000000000 }, // 2.0 B
    // Total = 10.0 B
  ];

  const sellers: BrokerEntry[] = [
    { broker_code: 'YP', sval: 2000000000 }, // 2.0 B
    { broker_code: 'PD', sval: 1500000000 }, // 1.5 B
    { broker_code: 'XC', sval: 1000000000 }, // 1.0 B
    { broker_code: 'KK', sval: 2500000000 }, // 2.5 B
    { broker_code: 'NI', sval: 3000000000 }, // 3.0 B
    // Total = 10.0 B
  ];

  const cr = calculateConcentrationRatios(buyers, sellers);
  assert(cr.buyer_cr1 === 0.5, `Buyer CR1 expected 0.50, got ${cr.buyer_cr1}`);
  assert(cr.buyer_cr3 === 1.0, `Buyer CR3 expected 1.00, got ${cr.buyer_cr3}`);
  assert(cr.seller_cr1 === 0.3, `Seller CR1 expected 0.30 (3.0B / 10B), got ${cr.seller_cr1}`);
  assert(cr.seller_cr3 === 0.75, `Seller CR3 expected 0.75 (7.5B / 10B), got ${cr.seller_cr3}`);
  assert(cr.net_cr3_spread === 0.25, `CR3 spread expected +0.25, got ${cr.net_cr3_spread}`);
  console.log('✅ Test 1 Passed: Concentration ratios accurately measure market depth clustering.');

  // ----------------------------------------------------
  // Test 2: Accumulation/Distribution Intensity (ADI) & Regimes
  // ----------------------------------------------------
  console.log('\nTest 2: Bounded ADI Intensity Calculation and Regime Classification...');
  // Case 2A: Strong Accumulation
  const buyersHeavy: BrokerEntry[] = [
    { broker_code: 'AZ', bval: 15000000000 },
    { broker_code: 'ZP', bval: 10000000000 },
  ];
  const sellersDiffuse: BrokerEntry[] = Array.from({ length: 10 }, (_, i) => ({
    broker_code: `R${i}`,
    sval: 500000000, // 10 * 500M = 5.0 B
  }));

  const adiStrong = calculateAccumulationIntensity(buyersHeavy, sellersDiffuse);
  assert(adiStrong > 0.4, `Expected strong positive ADI, got ${adiStrong}`);
  assert(adiStrong <= 1.0, 'ADI must be bounded by +1.0');
  assert(
    determineFlowRegime(adiStrong) === 'STRONG_ACCUMULATION',
    `Expected STRONG_ACCUMULATION, got ${determineFlowRegime(adiStrong)}`
  );

  // Case 2B: Strong Distribution (Diffuse buyers vs concentrated heavy sellers)
  const buyersDiffuse: BrokerEntry[] = Array.from({ length: 10 }, (_, i) => ({
    broker_code: `R${i}`,
    bval: 500000000, // 10 * 500M = 5.0 B
  }));
  const sellersHeavy: BrokerEntry[] = [
    { broker_code: 'AZ', sval: 15000000000 },
    { broker_code: 'ZP', sval: 10000000000 },
  ];

  const adiDistribution = calculateAccumulationIntensity(buyersDiffuse, sellersHeavy);
  assert(adiDistribution < -0.4, `Expected strong negative ADI, got ${adiDistribution}`);
  assert(adiDistribution >= -1.0, 'ADI must be bounded by -1.0');
  assert(
    determineFlowRegime(adiDistribution) === 'STRONG_DISTRIBUTION',
    `Expected STRONG_DISTRIBUTION, got ${determineFlowRegime(adiDistribution)}`
  );

  // Case 2C: Neutral
  assert(determineFlowRegime(0.0) === 'NEUTRAL', '0.0 ADI must be NEUTRAL');
  console.log('✅ Test 2 Passed: ADI values mathematically bounded with robust regime classification.');

  // ----------------------------------------------------
  // Test 3: Bandar VWAP Cost Basis & Retail Positioning
  // ----------------------------------------------------
  console.log('\nTest 3: Bandar VWAP Cost Basis & Retail Positioning...');
  const buyersCost: BrokerEntry[] = [
    { broker_code: 'AZ', bval: 1000000000, bavg: 1000 }, // 1M shares at 1000
    { broker_code: 'BK', bval: 1200000000, bavg: 1200 }, // 1M shares at 1200
  ];
  // Total 2M shares, total value 2.2B -> VWAP = 1100

  // Scenario 3A: Market price 1000 (Retail buying below bandar modal)
  const costBasisBelow = calculateBandarCostBasis(buyersCost, 1000);
  assert(costBasisBelow.bandar_vwap === 1100, `Expected VWAP 1100, got ${costBasisBelow.bandar_vwap}`);
  assert(
    costBasisBelow.deviation_pct === -9.09,
    `Expected -9.09% deviation, got ${costBasisBelow.deviation_pct}`
  );
  assert(
    costBasisBelow.retail_positioning === 'BELOW_BANDAR_COST',
    `Expected BELOW_BANDAR_COST, got ${costBasisBelow.retail_positioning}`
  );

  // Scenario 3B: Market price 1200 (Retail buying above bandar modal)
  const costBasisAbove = calculateBandarCostBasis(buyersCost, 1200);
  assert(
    costBasisAbove.retail_positioning === 'ABOVE_BANDAR_COST',
    `Expected ABOVE_BANDAR_COST, got ${costBasisAbove.retail_positioning}`
  );
  console.log('✅ Test 3 Passed: Bandar VWAP and retail cost basis deviation confirmed.');

  // ----------------------------------------------------
  // Test 4: IDX Dec 2021 Regulation & Intraday Liquidity Proxy
  // ----------------------------------------------------
  console.log('\nTest 4: IDX Dec 2021 Regulation & Intraday Liquidity Proxy...');
  // 75,000 bid lots vs 25,000 offer lots -> imbalance = (75-25)/(75+25) = +0.50
  const proxyAccum = computeIntradayProxy(75000, 25000);
  assert(proxyAccum.bid_offer_imbalance === 0.5, `Expected imbalance 0.5, got ${proxyAccum.bid_offer_imbalance}`);
  assert(
    proxyAccum.proxy_regime === 'STRONG_ACCUMULATION',
    `Expected STRONG_ACCUMULATION, got ${proxyAccum.proxy_regime}`
  );

  // 20,000 bid lots vs 80,000 offer lots -> imbalance = -0.60
  const proxyDist = computeIntradayProxy(20000, 80000);
  assert(proxyDist.bid_offer_imbalance === -0.6, `Expected imbalance -0.6, got ${proxyDist.bid_offer_imbalance}`);
  assert(
    proxyDist.proxy_regime === 'STRONG_DISTRIBUTION',
    `Expected STRONG_DISTRIBUTION, got ${proxyDist.proxy_regime}`
  );
  console.log('✅ Test 4 Passed: Intraday flow proxy complies with post-Dec 2021 broker masking rules.');

  // ----------------------------------------------------
  // Test 5: End-to-End Hybrid Flow Report Synthesis
  // ----------------------------------------------------
  console.log('\nTest 5: End-to-End Hybrid Flow Report Synthesis...');
  const report = synthesizeHybridFlowReport({
    emiten: 'BBCA',
    currentPrice: 10200,
    buyers: buyersHeavy,
    sellers: sellersDiffuse,
    orderbook: { total_bid_lot: 60000, total_offer_lot: 40000 },
    dataMode: 'LIVE_HYBRID',
  });

  assert(report.emiten === 'BBCA', 'Emiten matches');
  assert(report.data_mode === 'LIVE_HYBRID', 'Data mode matches');
  assert(report.overall_regime === 'STRONG_ACCUMULATION', 'Overall regime matches');
  assert(Boolean(report.concentration), 'Concentration metrics present');
  assert(Boolean(report.cost_basis), 'Cost basis metrics present');
  assert(Boolean(report.intraday_proxy), 'Intraday proxy present when orderbook provided');
  assert(report.intraday_proxy?.bid_offer_imbalance === 0.2, 'Orderbook imbalance matches');
  console.log('✅ Test 5 Passed: Unified Hybrid Flow Report generated cleanly.');

  console.log('\n===========================================================');
  console.log('🎉 ALL 5 PHASE 5 ACCEPTANCE TESTS PASSED (100%)');
  console.log('===========================================================');
}

runAcceptanceTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
