import test from 'node:test';
import assert from 'node:assert/strict';
import { extractEmitenFromText, analyzeCustomSignal } from '../lib/ai-story/custom-signal-analyzer';

test('Custom Signal Lab: Extracts emiten correctly from raw text', () => {
  const t1 = extractEmitenFromText('Sinyal beli BMRI target 4500 ada akumulasi asing.');
  assert.equal(t1, 'BMRI');

  const t2 = extractEmitenFromText('Breaking news: Laba bersih BBCA tembus rekor.');
  assert.equal(t2, 'BBCA');

  const t3 = extractEmitenFromText('Isu merger tanpa menyebut kode', 'BBRI');
  assert.equal(t3, 'BBRI');
});

test('Custom Signal Lab: Analyzes signal and generates reality check', async () => {
  const result = await analyzeCustomSignal({
    rawText: 'Sinyal beli BMRI di 4390 target 4420 ada akumulasi asing broker ZP.',
    emiten: 'BMRI',
    signalType: 'SIGNAL',
    fromDate: '2026-09-01',
    toDate: '2026-09-07',
  });

  assert.equal(result.emiten, 'BMRI');
  assert.ok(result.verdict !== undefined);
  assert.ok(result.verdict_score >= 0 && result.verdict_score <= 100);
  assert.ok(result.reality_check.market_price > 0);
  assert.ok(result.target_ladder.t1_realistic > 0);
  assert.ok(result.ai_insights.recommended_action !== undefined);
});
