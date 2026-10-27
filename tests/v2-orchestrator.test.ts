import { runAdimologyV2Pipeline } from '../lib/orchestrator/v2-pipeline';

async function testV2Orchestrator() {
  console.log('--- TEST: Orchestrator runAdimologyV2Pipeline ---');

  const result = await runAdimologyV2Pipeline({
    ticker: 'BBCA',
    price: 6500,
    openPrice: 6475,
    highPrice: 6550,
    lowPrice: 6450,
    araPrice: 7800,
    arbPrice: 5525,
    bestBid: 6500,
    bestOffer: 6525,
    totalBidLots: 85000,
    totalOfferLots: 62000,
    sector: 'Keuangan',
    mode: 'SCALP',
    equityIdr: 100_000_000,
  });

  if (!result.decision) throw new Error('Result must contain decision');
  if (!result.decision.verdict) throw new Error('Decision must have a verdict');
  if (!result.screener) throw new Error('Result must contain screener');
  if (!result.ledgerHash) throw new Error('Result must contain ledger hash');
  if (!result.narrative) throw new Error('Result must contain narrative');

  console.log(`✓ Orchestrator executed successfully:`);
  console.log(`  Verdict: ${result.decision.verdict} (${result.decision.convictionBucket})`);
  console.log(`  Tier: ${result.screener.tier} (${result.screener.tierLabel})`);
  console.log(`  Smart Money: State=${result.smartMoney.state}, p=${result.smartMoney.absorptionRatioP}, a=${result.smartMoney.controlIndexA}`);
  console.log(`  Ledger Hash: ${result.ledgerHash}`);
  console.log(`  Red Team Objections: ${result.decision.redTeamObjections.length}`);
  console.log(`  Slot-Filling Hallucination Rate: ${result.narrative.ungroundedNumericRate}%`);

  console.log('\n✓ All checks passed in v2-orchestrator.test.ts!\n');
}

testV2Orchestrator().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
