import { evaluateCostAndExpectancyGate, simulateOrderBookWalk } from '../lib/execution/cost-expectancy-gate';

function testCostAndExpectancy() {
  console.log('--- TEST: Cost, Friction & Expectancy Gate (PRD v2.0 §13) ---');

  // 1. Order Book Walk Simulation Test
  const mockLevels = [
    { price: 1500, qtyLots: 10 }, // 10 lot = 1,000 lembar = Rp 1.500.000
    { price: 1505, qtyLots: 20 }, // 20 lot = 2,000 lembar = Rp 3.010.000
    { price: 1510, qtyLots: 30 }, // 30 lot = 3,000 lembar = Rp 4.530.000
  ];

  // Requesting Rp 4.000.000 size (fills 10 lots @ 1500 and ~16.6 lots @ 1505)
  const sim = simulateOrderBookWalk(mockLevels, 4_000_000, 'BUY');
  if (sim.status !== 'OK') throw new Error('Order book walk should be OK');
  if (sim.slippagePct <= 0 || sim.avgPrice <= 1500) throw new Error('Slippage must be positive');
  console.log(`✓ Order book walk simulated: avgPrice=${sim.avgPrice}, slippage=${sim.slippagePct}%`);

  // Requesting Rp 20.000.000 size (exceeds available depth ~Rp 9M)
  const simDeep = simulateOrderBookWalk(mockLevels, 20_000_000, 'BUY');
  if (simDeep.status !== 'INSUFFICIENT_DEPTH') throw new Error('Expected INSUFFICIENT_DEPTH');
  console.log('✓ Insufficient depth guard verified');

  // 2. Setup with TP1 gross 3.5% but net TP1 < 3.0% after friction (Round-trip 0.40% + spread 0.20% + slippage 0.20% = 0.80%)
  // TP1_net = 3.5% - 0.80% = 2.70% (< 3.0% threshold)
  const failNetTp = evaluateCostAndExpectancyGate({
    entryPrice: 1500,
    slPrice: 1450,
    tp1Price: 1550, // +3.33% gross
    calibratedProbabilityP: 0.58,
    mode: 'SCALP',
    bestBid: 1495,
    bestAsk: 1500,
  });

  if (failNetTp.passed) throw new Error('Setup with net TP1 < 3.0% must be rejected');
  console.log('✓ Low net TP1 setup rejected as expected:', failNetTp.rejectReasons[0]);

  // 3. Setup with poor R:R net (< 1.8x)
  // Entry 1500, SL 1400 (-6.67%), TP1 1560 (+4.0%) -> R:R net ~ 0.45x
  const failRr = evaluateCostAndExpectancyGate({
    entryPrice: 1500,
    slPrice: 1400,
    tp1Price: 1560,
    calibratedProbabilityP: 0.58,
    mode: 'SCALP',
  });

  if (failRr.passed) throw new Error('Setup with net R:R < 1.8x must be rejected');
  console.log('✓ Low net R:R setup rejected as expected');

  // 4. Setup with High Quality Metrics that PASSES
  // Entry 1500, SL 1465 (-2.33% gross), TP1 1590 (+6.0% gross), p=0.60
  // Net TP1 ~ 5.2%, Net SL ~ 3.1%, Net RR ~ 1.68x -> let's make SL tighter or TP1 higher to get Net RR >= 1.8x
  // Entry 1500, SL 1475 (-1.67% gross, ~2.4% net), TP1 1600 (+6.67% gross, ~5.9% net) -> Net RR ~ 2.45x
  const passSetup = evaluateCostAndExpectancyGate({
    entryPrice: 1500,
    slPrice: 1475,
    tp1Price: 1600,
    calibratedProbabilityP: 0.60,
    mode: 'SCALP',
    bestBid: 1500,
    bestAsk: 1505,
  });

  if (!passSetup.passed) {
    throw new Error(`Pass setup unexpectedly failed: ${passSetup.rejectReasons.join(', ')}`);
  }

  console.log(`✓ High-quality setup passed: Net TP1=+${passSetup.netMetrics.tp1NetPct}%, Net RR=${passSetup.netMetrics.rrNet}x, E=${passSetup.netMetrics.netExpectancy}%`);

  console.log('ALL COST & EXPECTANCY TESTS PASSED!\n');
}

testCostAndExpectancy();
