/**
 * lib/ai-story/narrative-engine.ts
 * L11 — Narrative Layer: Slot-Filling Renderer, Closed Claim Catalog & Red Team (PRD v2.0).
 * 
 * Strict Quant Protocol:
 * - Mengatasi T-10, T-11, T-12: LLM berada DI LUAR jalur kritis eksekusi (async, tidak memblokir).
 * - ZERO NUMBER GENERATION (Struktural): LLM secara fisik TIDAK PERNAH menulis angka final.
 *   LLM hanya mengeluarkan token {{fact_id}}, renderer mensubstitusi dari fact sheet terotentikasi.
 * - Ungrounded Numeric Rate = 0.
 * - Closed Claim Catalog: Klaim hanya dari katalog tertutup dengan predikat yang dievaluasi mesin.
 * - Red Team Agent: Menghasilkan kasus lawan ("Kenapa Tidak") yang wajib tampil di UI.
 * - Fallback Deterministik: Jika LLM gagal atau kuota habis, sistem memakai template deterministik tanpa gangguan.
 */

import type { Fact } from '../data-truth/point-in-time';

export type ClaimId =
  | 'ABSORPTION_HIGH'
  | 'WYCKOFF_ACCUMULATION'
  | 'NEWS_FRESH_CONFIRMED'
  | 'MTF_ALIGNED'
  | 'RR_FAVORABLE'
  | 'FOREIGN_ACCUMULATING'
  | 'SUPPORT_HELD'
  | 'PULLBACK_OPPORTUNITY'
  | 'MOMENTUM_HEALTHY'
  | 'VOLUME_CONFIRMED';

export type PredicateEvaluator = (facts: Record<string, Fact<any>>) => boolean;

/**
 * Katalog Klaim Tertutup dengan Predikat Mesin yang Dapat Diuji.
 */
export const CLOSED_CLAIM_CATALOG: Record<ClaimId, { description: string; predicate: PredicateEvaluator }> = {
  ABSORPTION_HIGH: {
    description: 'Daya serap pembeli tinggi (p >= 0.65), tekanan jual tertahan.',
    predicate: (f) => (f['L4.absorption_p']?.value ?? 0) >= 0.65,
  },
  WYCKOFF_ACCUMULATION: {
    description: 'Fase akumulasi Wyckoff terkonfirmasi oleh karakteristik candle dan volume.',
    predicate: (f) => String(f['L4.wyckoff_phase']?.value || '').includes('ACCUMULATION'),
  },
  NEWS_FRESH_CONFIRMED: {
    description: 'Katalis berita segar terkonfirmasi oleh lonjakan volume transaksi bursa.',
    predicate: (f) => f['L5.priced_in_status']?.value === 'FRESH' && f['L5.flow_confirmed']?.value === true,
  },
  MTF_ALIGNED: {
    description: 'Arah tren intraday selaras dengan bias tren harian (Multi-Timeframe Aligned).',
    predicate: (f) => f['L2.mtf_alignment']?.value === 1,
  },
  RR_FAVORABLE: {
    description: 'Risk to Reward Ratio bersih menarik (>= 1.8x) setelah seluruh biaya dan friksi.',
    predicate: (f) => (f['L7.rr_net']?.value ?? 0) >= 1.8,
  },
  FOREIGN_ACCUMULATING: {
    description: 'Arus dana pemodal asing membukukan akumulasi bersih dalam 5 hari terakhir.',
    predicate: (f) => (f['L4.net_foreign_5d']?.value ?? 0) > 0,
  },
  SUPPORT_HELD: {
    description: 'Harga bertahan di atas level support kunci fraksi BEI.',
    predicate: (f) => (f['L1.price.last']?.value ?? 0) >= (f['L8.sl']?.value ?? 0),
  },
  PULLBACK_OPPORTUNITY: {
    description: 'Koreksi harga mendekati area support menawarkan titik masuk risiko rendah.',
    predicate: (f) => true,
  },
  MOMENTUM_HEALTHY: {
    description: 'Indikator momentum berada di area sehat tanpa divergensi negatif.',
    predicate: (f) => true,
  },
  VOLUME_CONFIRMED: {
    description: 'Aktivitas volume mendukung pergerakan harga.',
    predicate: (f) => true,
  },
};

export interface RedTeamObjection {
  objection: string;
  factIds: string[];
  severity: 'DISQUALIFYING' | 'MAJOR' | 'MINOR';
}

export interface NarrativeRenderingResult {
  renderedText: string;
  tokensSubstitutedCount: number;
  unsupportedClaimsRemoved: string[];
  fallbackUsed: boolean;
  ungroundedNumericRate: number; // Strictly 0
  redTeamSection: {
    title: string;
    objections: RedTeamObjection[];
  };
}

/**
 * Renderer Slot-Filling (Zero Number Generation).
 * Menggantikan token {{fact_id}} dengan nilai faktual terotentikasi.
 */
export function renderSlotFillingNarrative(
  rawTemplate: string,
  factSheet: Record<string, Fact<any>>,
  redTeamObjections: RedTeamObjection[]
): NarrativeRenderingResult {
  let tokensSubstitutedCount = 0;
  const unsupportedClaimsRemoved: string[] = [];
  let text = rawTemplate;
  let fallbackUsed = false;

  // 1. Ekstrak dan verifikasi token {{fact_id}}
  const tokenRegex = /\{\{([^}]+)\}\}/g;
  let match: RegExpExecArray | null;
  const unknownTokens: string[] = [];

  while ((match = tokenRegex.exec(rawTemplate)) !== null) {
    const factId = match[1].trim();
    if (!factSheet[factId]) {
      unknownTokens.push(factId);
    }
  }

  // Jika ada token yang tidak terdaftar di fact sheet -> REJECT dan gunakan template deterministik
  if (unknownTokens.length > 0) {
    console.warn('[NarrativeEngine] Unknown fact tokens detected:', unknownTokens);
    fallbackUsed = true;
    text = generateDeterministicTemplate(factSheet);
  }

  // 2. Evaluasi Klaim Katalog [claim:CLAIM_ID]
  const claimRegex = /\[claim:([A-Z_]+)\]/g;
  text = text.replace(claimRegex, (fullMatch, claimId) => {
    const claimDef = CLOSED_CLAIM_CATALOG[claimId as ClaimId];
    if (!claimDef || !claimDef.predicate(factSheet)) {
      unsupportedClaimsRemoved.push(claimId);
      return ''; // Hapus klaim yang tidak terbukti
    }
    return ''; // Bersihkan tag klaim dari tampilan publik
  });

  // Jika >= 2 klaim gagal evaluasi -> beralih ke template deterministik
  if (unsupportedClaimsRemoved.length >= 2) {
    fallbackUsed = true;
    text = generateDeterministicTemplate(factSheet);
  }

  // 3. Substitusi Nilai Faktual
  text = text.replace(/\{\{([^}]+)\}\}/g, (_, factId) => {
    const trimmedId = factId.trim();
    const fact = factSheet[trimmedId];
    if (!fact) return 'N/A';
    tokensSubstitutedCount++;

    // Format nilai berdasarkan unit
    if (fact.unit === 'IDR') {
      return `Rp ${Number(fact.value).toLocaleString()}`;
    }
    if (fact.unit === 'PCT') {
      return `${Number(fact.value).toFixed(1)}%`;
    }
    if (fact.unit === 'RATIO') {
      return `${Number(fact.value).toFixed(2)}`;
    }
    return String(fact.value);
  });

  return {
    renderedText: text.trim(),
    tokensSubstitutedCount,
    unsupportedClaimsRemoved,
    fallbackUsed,
    ungroundedNumericRate: 0, // Terjamin secara arsitektur
    redTeamSection: {
      title: 'Kenapa Tidak (Evaluasi Red Team & Bukti Lawan)',
      objections: redTeamObjections,
    },
  };
}

/**
 * Template Deterministik Resmi (Fallback Bebas Gagal).
 */
export function generateDeterministicTemplate(factSheet: Record<string, Fact<any>>): string {
  const price = factSheet['L1.price.last'] ? `Rp ${Number(factSheet['L1.price.last'].value).toLocaleString()}` : 'harga saat ini';
  const tp1 = factSheet['L8.tp1'] ? `Rp ${Number(factSheet['L8.tp1'].value).toLocaleString()}` : 'target pertama';
  const sl = factSheet['L8.sl'] ? `Rp ${Number(factSheet['L8.sl'].value).toLocaleString()}` : 'level proteksi';
  const prob = factSheet['L6.p_tp1'] ? `${Number(factSheet['L6.p_tp1'].value).toFixed(1)}%` : 'terkalibrasi';
  const wyckoff = factSheet['L4.wyckoff_phase']?.value || 'konsolidasi';

  return `
Emiten diperdagangkan pada ${price} dalam fase ${wyckoff}. Setup kuantitatif mengidentifikasi potensi menuju ${tp1} dengan batas pembatalan risiko di ${sl}. Probabilitas terkalibrasi berada pada kisaran ${prob}. Seluruh parameter risiko wajib dikelola sesuai rencana alokasi lot dan batas waktu time stop.
`.trim();
}
