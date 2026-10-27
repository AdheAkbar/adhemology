import { renderSlotFillingNarrative, CLOSED_CLAIM_CATALOG } from '../lib/ai-story/narrative-engine';
import { createFact } from '../lib/data-truth/point-in-time';

function testNarrativeZeroHallucination() {
  console.log('--- TEST: Narrative Layer & Zero Number Generation (PRD v2.0 §17 & §18) ---');

  // Siapkan fact sheet terotentikasi
  const factSheet = {
    'L1.price.last': createFact('L1.price.last', 1500, 'IDR', 'EXCHANGE_FEED'),
    'L4.absorption_p': createFact('L4.absorption_p', 0.72, 'RATIO', 'DERIVED'),
    'L4.wyckoff_phase': createFact('L4.wyckoff_phase', 'ACCUMULATION_PHASE_C', 'ENUM', 'DERIVED'),
    'L6.p_tp1': createFact('L6.p_tp1', 58.0, 'PCT', 'MODEL'),
    'L8.entry': createFact('L8.entry', 1500, 'IDR', 'DERIVED'),
    'L8.sl': createFact('L8.sl', 1400, 'IDR', 'DERIVED'),
    'L8.tp1': createFact('L8.tp1', 1560, 'IDR', 'DERIVED'),
    'L7.rr_net': createFact('L7.rr_net', 1.95, 'RATIO', 'DERIVED'),
  };

  const redTeamObjections = [
    {
      objection: 'Volume harian 3 hari terakhir sedikit menurun dibanding pekan lalu.',
      factIds: ['L2.volume_z_3d'],
      severity: 'MINOR' as const,
    },
  ];

  // 1. Uji Kasus Sukses: Seluruh token valid & klaim terbukti
  const validTemplate = `
Harga saat ini {{L1.price.last}} berada di fase {{L4.wyckoff_phase}} [claim:WYCKOFF_ACCUMULATION], dengan daya serap {{L4.absorption_p}} [claim:ABSORPTION_HIGH]. Target pertama {{L8.tp1}} dengan stop loss di {{L8.sl}}. Probabilitas terkalibrasi {{L6.p_tp1}} dengan rasio R:R {{L7.rr_net}} [claim:RR_FAVORABLE].
`.trim();

  const successResult = renderSlotFillingNarrative(validTemplate, factSheet, redTeamObjections);

  if (successResult.fallbackUsed) throw new Error('Valid template should not trigger fallback');
  if (successResult.ungroundedNumericRate !== 0) throw new Error('Ungrounded numeric rate must strictly be 0');
  if (successResult.tokensSubstitutedCount < 5) throw new Error('Expected at least 5 tokens substituted');
  console.log('Rendered text output:', successResult.renderedText);
  if (!successResult.renderedText.includes('1,500') && !successResult.renderedText.includes('1.500')) {
    throw new Error('Rendered text does not contain properly formatted prices');
  }
  console.log('✓ Slot-filling substitution succeeded without hallucinated numbers');

  // 2. Uji Penolakan Token Halusinasi (Unknown Token e.g., {{L8.tp_maksimal}})
  const hallucinatedTokenTemplate = `
Harga {{L1.price.last}} berpotensi to the moon ke {{L8.tp_maksimal_karangan_ai}}.
`.trim();

  const tokenFailResult = renderSlotFillingNarrative(hallucinatedTokenTemplate, factSheet, redTeamObjections);
  if (!tokenFailResult.fallbackUsed) {
    throw new Error('Template with hallucinated/unknown fact tokens must trigger deterministic fallback');
  }
  console.log('✓ Hallucinated token detected -> Successfully reverted to deterministic template');

  // 3. Uji Klaim Palsu / Predikat Gagal (e.g. claim:NEWS_FRESH_CONFIRMED padahal berita belum terkonfirmasi)
  const falseClaimTemplate = `
Setup didukung berita [claim:NEWS_FRESH_CONFIRMED] dan aliran asing [claim:FOREIGN_ACCUMULATING].
`.trim();

  const claimFailResult = renderSlotFillingNarrative(falseClaimTemplate, factSheet, redTeamObjections);
  if (claimFailResult.unsupportedClaimsRemoved.length === 0) {
    throw new Error('Unsupported claims should be detected and stripped');
  }
  console.log('✓ Unsupported qualitative claims automatically detected and stripped');

  // 4. Verifikasi Keberadaan Red Team (Kenapa Tidak)
  if (!successResult.redTeamSection || successResult.redTeamSection.objections.length === 0) {
    throw new Error('Red Team section is mandatory and must not be empty');
  }
  console.log('✓ Mandatory Red Team objections section verified');

  console.log('ALL NARRATIVE ZERO-HALLUCINATION TESTS PASSED!\n');
}

testNarrativeZeroHallucination();
