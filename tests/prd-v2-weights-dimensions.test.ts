import { CLUSTER_WEIGHTS, validateClusterWeights } from '../lib/indicators/feature-engine';
import { constructTradePlanL8 } from '../lib/execution/trade-construction';

function testWeightsAndDimensions() {
  console.log('--- TEST: Weights & Position Sizing Dimensions (PRD v2.0) ---');

  // 1. Validator Bobot Cluster (T-01 & T-02)
  for (const mode of ['SCALP', 'SWING', 'INVEST'] as const) {
    const weights = CLUSTER_WEIGHTS[mode];
    const validation = validateClusterWeights(weights);

    if (!validation.valid) {
      throw new Error(`Mode ${mode} weights invalid: sum=${validation.sum}, max=${validation.maxWeight}`);
    }

    if (Math.abs(validation.sum - 1.0) > 1e-6) {
      throw new Error(`Mode ${mode} sum must be exactly 1.00, got ${validation.sum}`);
    }

    if (validation.maxWeight > 0.30) {
      throw new Error(`Mode ${mode} max cluster weight must be <= 0.30, got ${validation.maxWeight}`);
    }

    console.log(`✓ Mode ${mode} cluster weights verified: sum=${validation.sum}, max=${validation.maxWeight}`);
  }

  // 2. Validator Dimensi Fisik Position Sizing (T-05)
  // Uji kasus saham harga Rp 1.500, SL Rp 1.400, Ekuitas Rp 100.000.000, Risiko 0.75%
  const plan = constructTradePlanL8({
    ticker: 'TEST',
    setupType: 'BREAKOUT_CONFIRMED',
    currentPrice: 1500,
    structuralSupportPrice: 1400,
    structuralResistancePrice: 1510,
    atr14Daily: 40,
    mode: 'SCALP',
    equityIdr: 100_000_000,
    riskPerTradePct: 0.75, // Rp 750.000 modal berisiko
    advLot20d: 50_000,
    headroomAraPct: 25,
    headroomArbPct: 15,
    araPrice: 1875,
    arbPrice: 1275,
  });

  // Verifikasi sizing
  const sizing = plan.sizing;
  console.log('Sizing output:', sizing);
  if (!sizing.isValid) throw new Error(`Sizing should be valid: ${sizing.rejectReason}`);

  // Modal berisiko = 0.75% x 100.000.000 = Rp 750.000
  // Entry = 1515, SL = 1455 (karena SL volatil 1.4 ATR = 1455 lebih ketat dari 1395)
  // Jarak SL = 1515 - 1455 = 60 + fee beli (1515 * 0.0015) + fee jual (1455 * 0.0025) = ~65.9 Rp/lembar
  // Lembar mentah = 750.000 / 65.9 = ~11.380 lembar
  // Lot = floor(11.380 / 100) = 113 lot
  if (sizing.lot < 100 || sizing.lot > 125) {
    throw new Error(`Sizing lot expected ~113 lot, got ${sizing.lot} lot`);
  }

  // Pastikan nilai risiko per trade mendekati toleransi risiko rencana (~Rp 750.000)
  if (sizing.riskAmountIdr > 750_000 * 1.05) {
    throw new Error(`Risk amount IDR (${sizing.riskAmountIdr}) exceeds risk tolerance limit significantly`);
  }

  console.log(`✓ Position sizing dimension test passed: ${sizing.lot} lot, value Rp ${sizing.positionValueIdr.toLocaleString()}, risk Rp ${sizing.riskAmountIdr.toLocaleString()}`);

  console.log('ALL WEIGHTS & DIMENSION TESTS PASSED!\n');
}

testWeightsAndDimensions();
