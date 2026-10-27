/**
 * lib/ai-story/grounding-engine.ts - Gemini AI Story Grounding Engine (Adimology V6)
 * PRD V6 Phase 10: Strict Quantitative Grounding & Source Verification for Gemini Analysis.
 */

import type { TargetLadder } from '../targets/types';
import type { CalibratedProbability } from '../calibration/types';
import type { LiquidityAssessment } from '../execution/types';
import type { HybridFlowMetrics } from '../broker-flow/types';

export interface QuantitativeGroundingContext {
  emiten: string;
  current_price: number;
  targetLadder?: TargetLadder | null;
  calibratedProbability?: CalibratedProbability | null;
  liquidityAssessment?: LiquidityAssessment | null;
  flowMetrics?: HybridFlowMetrics | null;
  keyStats?: any;
}

export interface GroundedStoryPrompt {
  systemPrompt: string;
  userPrompt: string;
  groundingContextSummary: string;
}

/**
 * Builds a strictly-grounded prompt ensuring Gemini references authentic quantitative metrics
 * and factual news sources without hallucinating price targets or unfounded claims.
 */
export function buildGroundedStoryPrompt(context: QuantitativeGroundingContext): GroundedStoryPrompt {
  const { emiten, current_price, targetLadder, calibratedProbability, liquidityAssessment, flowMetrics, keyStats } = context;
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  // Compile Verified Quantitative Envelope
  let quantEnvelope = `VERIFIED QUANTITATIVE ENVELOPE (ADIMOLOGY V6) UNTUK ${emiten}:\n`;
  quantEnvelope += `- Current Price: Rp ${current_price}\n`;

  if (targetLadder) {
    quantEnvelope += `- Target Realistis (T1): Rp ${targetLadder.t1_realistic} (+${(((targetLadder.t1_realistic - current_price) / current_price) * 100).toFixed(1)}%)\n`;
    quantEnvelope += `- Target Stretch (T2): Rp ${targetLadder.t2_stretch}\n`;
    quantEnvelope += `- Structural Ceiling (Tmax): Rp ${targetLadder.t_max}\n`;
    quantEnvelope += `- Invalidation Barrier (Stop Loss): Rp ${targetLadder.invalidation_price} (-${(((current_price - targetLadder.invalidation_price) / current_price) * 100).toFixed(1)}%)\n`;
    quantEnvelope += `- Risk-Reward Ratio: 1 : ${targetLadder.risk_reward_ratio} (${targetLadder.is_rrr_acceptable ? 'Valid' : 'Gated'})\n`;
  }

  if (calibratedProbability) {
    quantEnvelope += `- Calibrated Win Probability: ${calibratedProbability.calibrated_p || (calibratedProbability.probability ? (calibratedProbability.probability * 100).toFixed(1) : 'Uncalibrated')}%\n`;
    quantEnvelope += `- Calibration Decile: ${calibratedProbability.calibration_decile || 'N/A'} (Brier Score: ${calibratedProbability.brier_score || 'N/A'})\n`;
  }

  if (flowMetrics) {
    quantEnvelope += `- Hybrid Broker Flow Regime: ${flowMetrics.regime}\n`;
    quantEnvelope += `- Top Net Accumulator: ${flowMetrics.top_accumulators.join(', ') || 'None'}\n`;
    quantEnvelope += `- Multi-Day Net Broker Value: Rp ${(flowMetrics.eod_broker_net_value / 1e9).toFixed(2)} Miliar\n`;
  }

  if (liquidityAssessment) {
    quantEnvelope += `- Liquidity Rating: ${liquidityAssessment.liquidity_rating}\n`;
    quantEnvelope += `- Average Daily Turnover: Rp ${(liquidityAssessment.average_daily_turnover_idr / 1e9).toFixed(1)} Miliar\n`;
    quantEnvelope += `- Max Safe Position Size: ${liquidityAssessment.max_position_lots.toLocaleString()} lots (Rp ${(liquidityAssessment.max_position_size_idr / 1e6).toFixed(0)} Juta)\n`;
    quantEnvelope += `- Spread: ${liquidityAssessment.spread_ticks} ticks (${liquidityAssessment.spread_pct}%)\n`;
  }

  if (keyStats) {
    quantEnvelope += `\nKEY STATISTICS DATA:\n` + JSON.stringify(keyStats, null, 2) + `\n`;
  }

  const systemPrompt = `Kamu adalah Senior Quantitative Equity Analyst & Market Microstructure Specialist untuk Bursa Efek Indonesia (IDX).
Tugasmu adalah menganalisis katalis bisnis, story industri, dan keterbukaan informasi emiten secara objektif dan berlandaskan data konkret.
DILARANG KERAS berhalusinasi atau mengarang data, berita, atau angka target.
Seluruh rekomendasi strategi trading WAJIB merujuk langsung ke angka Target Ladder dan Invalidation yang telah dihitung oleh engine kuantitatif.

HIERARKI SUMBER YANG WAJIB DIGUNAKAN:
1. Pengumuman & Keterbukaan Informasi Bursa Efek Indonesia (IDX).
2. Otoritas Jasa Keuangan (OJK).
3. Laporan Keuangan dan Keterbukaan Resmi Emiten.
4. Media Finansial Kredibel (Bisnis Indonesia, Kontan, Investor Daily, Bloomberg Technoz, CNBC Indonesia).
5. Media sosial hanya boleh dirujuk sebagai sinyal sentimen ritel, BUKAN bukti fakta materiil.

ATURAN STRICT ZERO-HALLUCINATION:
Jika tidak menemukan berita atau keterbukaan materiil yang terverifikasi pada rentang waktu analisis, WAJIB tulis persis:
"TIDAK ADA BERITA MATERIAL YANG TERVERIFIKASI PADA WAKTU ANALISIS."
Jangan pernah menciptakan berita, rumor, atau katalis palsu.`;

  const userPrompt = `Hari ini adalah ${today}.
Cari dan analisis berita serta keterbukaan informasi TERKINI mengenai emiten saham IDX: ${emiten} menggunakan Google Search grounding.

${quantEnvelope}

ATURAN ANALISIS & VERIFIKASI GROUNDING:
1. HIERARKI BUKTI: Prioritaskan keterbukaan informasi IDX dan laporan keuangan resmi.
2. WAJIB KUTIP TANGGAL & SUMBER: Setiap katalis harus mencantumkan tanggal publikasi dan media/sumber resminya.
3. HARMONISASI KUANTITATIF: Hubungkan story bisnis dengan 'VERIFIED QUANTITATIVE ENVELOPE' di atas:
   - Bagaimana katalis mendukung tercapainya Target T1 (Rp ${targetLadder?.t1_realistic || 'N/A'})?
   - Mengapa level Invalidation (Rp ${targetLadder?.invalidation_price || 'N/A'}) menjadi batas risiko kritis?
   - Apakah institutional flow proxy (${flowMetrics?.regime || 'NEUTRAL'}) selaras dengan narasi berita?
4. JIKA TIDAK ADA BERITA TERVERIFIKASI: Isi matriks_story dengan entri berisi 'TIDAK ADA BERITA MATERIAL YANG TERVERIFIKASI PADA WAKTU ANALISIS'.
5. OUTPUT WAJIB: Hasilkan respon HANYA dalam format JSON valid berikut (tanpa blok markdown):
{
  "matriks_story": [
    {
      "kategori_story": "Transformasi Bisnis | Aksi Korporasi | Pemulihan Fundamental | Kondisi Makro",
      "deskripsi_katalis": "deskripsi singkat katalis beserta tanggal dan sumber berita (atau 'TIDAK ADA BERITA MATERIAL YANG TERVERIFIKASI PADA WAKTU ANALISIS')",
      "logika_ekonomi_pasar": "analisis transmisi dampak katalis ke kinerja laba/arus kas",
      "potensi_dampak_harga": "positif/netral/negatif beserta alasannya"
    }
  ],
  "swot_analysis": {
    "strengths": ["kekuatan utama perusahaan"],
    "weaknesses": ["kelemahan mendasar perusahaan"],
    "opportunities": ["peluang ekspansi/katalis mendatang"],
    "threats": ["risiko regulasi, persaingan, atau makro"]
  },
  "checklist_katalis": [
    {
      "item": "peristiwa konkret yang harus dipantau",
      "dampak_instan": "efek jika skenario terjadi"
    }
  ],
  "strategi_trading": {
    "tipe_saham": "growth / value / cyclical / turnaround / institutional-flow momentum",
    "target_entry": "area harga masuk optimal (LOWEST-RISK CANDIDATE UNDER CURRENT DATA)",
    "exit_strategy": {
      "take_profit": "Target T1 Rp ${targetLadder?.t1_realistic || 'N/A'} & T2 Rp ${targetLadder?.t2_stretch || 'N/A'}",
      "stop_loss": "Invalidation Rp ${targetLadder?.invalidation_price || 'N/A'}"
    }
  },
  "verified_quantitative_grounding": {
    "flow_regime": "${flowMetrics?.regime || 'NEUTRAL'}",
    "calibrated_win_rate": "${calibratedProbability?.calibrated_p || 'Uncalibrated'}%",
    "liquidity_status": "${liquidityAssessment?.liquidity_rating || 'MODERATE_LIQUIDITY'}"
  },
  "keystat_signal": "interpretasi rasio fundamental (PER, PBV, ROE, DER) dan sinyal investasinya",
  "kesimpulan": "sintesis 2-3 kalimat menyimpulkan konsistensi antara story bisnis dan data kuantitatif"
}`;

  return {
    systemPrompt,
    userPrompt,
    groundingContextSummary: quantEnvelope,
  };
}
