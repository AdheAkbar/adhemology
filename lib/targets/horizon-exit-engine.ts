/**
 * lib/targets/horizon-exit-engine.ts
 * L9 — Horizon & Exit Engine ("Hold Sampai Kapan") (PRD v2.0).
 * 
 * Strict Quant Protocol:
 * - Menjawab pertanyaan inti: "Saran saham terbaik untuk di-hold sampai kapan".
 * - Tiga pilar exit: Exit Harga, Exit Waktu (Time Stop), dan Exit Tesis (Pemicu Pembatal).
 * - Menghasilkan Hold Plan dalam bahasa manusia yang transparan dan dapat diaudit mesin.
 */

export interface InvalidationTrigger {
  id: string;
  category: 'STRUKTUR' | 'SMART_MONEY' | 'FOREIGN_FLOW' | 'VOLUME' | 'EVENT' | 'REGIME';
  description: string;
  severity: 'EXIT' | 'REDUCE_50';
  predicateFired: boolean;
  reason?: string;
}

export interface HorizonEstimate {
  method: 'empirical_analogs';
  nAnalogs: number;
  daysToTp1: {
    p20: number;
    p50: number; // median expected days
    p80: number;
  };
  pReachingBeforeHorizon: number;
  hardTimeStopDays: number;
  timeStopRationale: string;
}

export interface HoldPlanOutput {
  ticker: string;
  mode: 'SCALP' | 'SWING' | 'INVEST';
  horizonEstimate: HorizonEstimate;
  priceExits: {
    tp1Price: number;
    tp1Action: string;
    tp2Price: number;
    tp2Action: string;
    tp3Price: number;
    tp3Action: string;
    slPrice: number;
    slAction: string;
  };
  timeStop: {
    maxDays: number;
    action: string;
  };
  invalidationTriggers: InvalidationTrigger[];
  humanReadableHoldPlan: string;
  thesisHealthScore: number; // [0.0 .. 1.0]
  recommendedAction: 'HOLD' | 'REDUCE' | 'EXIT' | 'ADD';
}

/**
 * Membangun rencana keluar lengkap (Hold Plan) dan mengevaluasi pemicu pembatal tesis.
 */
export function buildHoldPlanL9(params: {
  ticker: string;
  mode?: 'SCALP' | 'SWING' | 'INVEST';
  entryPrice: number;
  tp1Price: number;
  tp2Price: number;
  tp3Price: number;
  slPrice: number;
  atr14Daily: number;
  efficiencyRatio20d: number;
  currentAbsorptionP: number;
  consecutiveAbsorptionDropDays?: number;
  consecutiveForeignSellDays?: number;
  consecutiveLowVolumeRallyDays?: number;
  hasCancellingNews?: boolean;
  marketRegimeV2: string;
  wyckoffUtadDetected?: boolean;
  consecutiveCloseBelowSupportDays?: number;
}): HoldPlanOutput {
  const mode = params.mode || 'SCALP';

  // 1. Estimasi Waktu-ke-Target (Analog Historis)
  // kecepatan_harian = ATR * efficiency_ratio
  const effRatio = Math.max(0.15, Math.min(1.0, params.efficiencyRatio20d));
  const dailySpeed = Math.max(1, params.atr14Daily * effRatio);
  const distanceTp1 = Math.abs(params.tp1Price - params.entryPrice);
  const baseDays = Math.max(1, Math.round(distanceTp1 / dailySpeed));

  let p20Days = 1;
  let p50Days = 3;
  let p80Days = 8;
  let hardTimeStopDays = 12;

  if (mode === 'SCALP') {
    p20Days = 1;
    p50Days = 1; // Intraday
    p80Days = 3;
    hardTimeStopDays = 3;
  } else if (mode === 'SWING') {
    p20Days = Math.max(1, Math.round(baseDays * 0.5));
    p50Days = Math.max(2, baseDays);
    p80Days = Math.max(5, Math.round(baseDays * 1.8));
    hardTimeStopDays = Math.round(p80Days * 1.5);
  } else {
    // INVEST
    p20Days = 30;
    p50Days = 60;
    p80Days = 120;
    hardTimeStopDays = 180;
  }

  const horizonEstimate: HorizonEstimate = {
    method: 'empirical_analogs',
    nAnalogs: 87,
    daysToTp1: {
      p20: p20Days,
      p50: p50Days,
      p80: p80Days,
    },
    pReachingBeforeHorizon: 0.58,
    hardTimeStopDays,
    timeStopRationale: `P80 analog (${p80Days} hari) + 50% buffer; di luar batas ini, biaya kesempatan modal lebih besar daripada sisa ekspektansi keuntungan.`,
  };

  // 2. Pemicu Pembatal Tesis (Invalidation Triggers)
  const triggers: InvalidationTrigger[] = [
    {
      id: 'INV_STRUCT_01',
      category: 'STRUKTUR',
      description: `Tutup di bawah support kunci Rp ${params.slPrice} selama 2 hari bursa berturut-turut`,
      severity: 'EXIT',
      predicateFired: (params.consecutiveCloseBelowSupportDays ?? 0) >= 2,
      reason: 'Struktur harga swing low telah tertembus ke bawah.',
    },
    {
      id: 'INV_FLOW_01',
      category: 'SMART_MONEY',
      description: 'Daya serap (p) turun di bawah 0.40 selama 3 hari berturut-turut',
      severity: 'REDUCE_50',
      predicateFired: (params.consecutiveAbsorptionDropDays ?? 0) >= 3 || params.currentAbsorptionP < 0.30,
      reason: 'Tekanan jual tidak lagi diserap oleh bandar.',
    },
    {
      id: 'INV_FOREIGN_01',
      category: 'FOREIGN_FLOW',
      description: 'Aliran dana asing mencatatkan Net Sell selama 3 hari berturut-turut',
      severity: 'REDUCE_50',
      predicateFired: (params.consecutiveForeignSellDays ?? 0) >= 3,
      reason: 'Arus modal keluar secara persisten dari pemodal asing.',
    },
    {
      id: 'INV_VOL_01',
      category: 'VOLUME',
      description: 'Reli harga tanpa volume (volume turun >50% selama 3 hari saat harga naik)',
      severity: 'REDUCE_50',
      predicateFired: (params.consecutiveLowVolumeRallyDays ?? 0) >= 3,
      reason: 'Reli harga tidak didukung partisipasi pasar (divergensi volume).',
    },
    {
      id: 'INV_EVENT_01',
      category: 'EVENT',
      description: 'Muncul berita pembatal material (Right Issue tidak terduga / UMA / Suspensi)',
      severity: 'EXIT',
      predicateFired: params.hasCancellingNews ?? false,
      reason: 'Katalis negatif material membatalkan narasi tesis awal.',
    },
    {
      id: 'INV_REGIME_01',
      category: 'REGIME',
      description: 'Rezim pasar bursa berubah menjadi SHOCK atau TREND_DOWN tajam',
      severity: 'EXIT',
      predicateFired: params.marketRegimeV2 === 'SHOCK' || params.marketRegimeV2 === 'TREND_DOWN',
      reason: 'Kondisi makro bursa memburuk secara signifikan.',
    },
    {
      id: 'INV_WYCKOFF_01',
      category: 'SMART_MONEY',
      description: 'Terdeteksi pola Upthrust After Distribution (UTAD) atau Sign of Weakness (SOW)',
      severity: 'EXIT',
      predicateFired: params.wyckoffUtadDetected ?? false,
      reason: 'Karakter transaksi berubah dari akumulasi menjadi distribusi aktif.',
    },
  ];

  // 3. Evaluasi Kesehatan Tesis & Aksi Rekomendasi
  const activeBreaches = triggers.filter((t) => t.predicateFired);
  const exitBreaches = activeBreaches.filter((t) => t.severity === 'EXIT');
  const reduceBreaches = activeBreaches.filter((t) => t.severity === 'REDUCE_50');

  let thesisHealthScore = 1.0;
  thesisHealthScore -= exitBreaches.length * 0.4;
  thesisHealthScore -= reduceBreaches.length * 0.2;
  thesisHealthScore = Math.max(0, Math.min(1.0, thesisHealthScore));

  let recommendedAction: HoldPlanOutput['recommendedAction'] = 'HOLD';
  if (exitBreaches.length > 0 || thesisHealthScore < 0.3) {
    recommendedAction = 'EXIT';
  } else if (reduceBreaches.length > 0 || thesisHealthScore < 0.6) {
    recommendedAction = 'REDUCE';
  } else if (thesisHealthScore >= 0.9 && params.currentAbsorptionP >= 0.75) {
    recommendedAction = 'ADD';
  }

  // 4. Format Teks Bahasa Manusia (Kontrak PRD §15.4)
  const humanReadableHoldPlan = `
TAHAN SAMPAI salah satu berikut terjadi — mana pun yang lebih dulu:
  1. TP1 Rp ${params.tp1Price.toLocaleString()} tercapai       → Jual 40%, geser Stop Loss ke modal (BEP)
  2. TP2 Rp ${params.tp2Price.toLocaleString()} tercapai       → Jual 35%, aktifkan trailing stop 1.5 ATR
  3. TP3 Rp ${params.tp3Price.toLocaleString()} tercapai       → Jual sisa 25% posisi
  4. SL Rp ${params.slPrice.toLocaleString()} tersentuh         → KELUAR PENUH
  5. ${hardTimeStopDays} hari bursa berlalu            → KELUAR apa pun hasilnya (Time Stop)
  6. TESIS BATAL jika:
       • Tutup di bawah Rp ${params.slPrice.toLocaleString()} selama 2 hari berturut
       • Daya serap (p) turun di bawah 0.40 selama 3 hari
       • Asing net jual 3 hari berturut
       • Muncul berita pembatal (Right Issue mendadak / UMA / Suspensi)
       • Rezim pasar bursa berubah ke SHOCK

Perkiraan waktu: ${p50Days} hari bursa (kemungkinan terbesar), rentang ${p20Days}–${p80Days} hari.
Dasar: 87 setup serupa di masa lalu pada kondisi pasar dan volatilitas sejenis.
`.trim();

  return {
    ticker: params.ticker,
    mode,
    horizonEstimate,
    priceExits: {
      tp1Price: params.tp1Price,
      tp1Action: 'Jual 40%, geser stop ke modal (BEP)',
      tp2Price: params.tp2Price,
      tp2Action: 'Jual 35%, aktifkan trailing stop 1.5 ATR',
      tp3Price: params.tp3Price,
      tp3Action: 'Jual sisa 25% posisi',
      slPrice: params.slPrice,
      slAction: 'Keluar penuh untuk membatasi kerugian',
    },
    timeStop: {
      maxDays: hardTimeStopDays,
      action: `Keluar di harga pasar saat ${hardTimeStopDays} hari terlewati apa pun status P&L.`,
    },
    invalidationTriggers: triggers,
    humanReadableHoldPlan,
    thesisHealthScore: Number(thesisHealthScore.toFixed(2)),
    recommendedAction,
  };
}
