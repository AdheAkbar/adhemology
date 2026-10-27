/**
 * lib/broker-flow/smart-money-engine.ts
 * L4 — Smart Money & Order Flow Engine: Bandarmologi 2.0 (PRD v2.0).
 * 
 * Strict Quant Protocol:
 * - Mengatasi T-09: Definisi matematis formal untuk Daya Serap (p) dan Margin/Kendali Bandar (a).
 * - Menjelaskan bahwa 'a' adalah indeks kendali, BUKAN otomatis bullish.
 * - State machine Wyckoff deterministik dengan predikat berbasis aturan yang dapat diaudit.
 * - Deteksi manipulasi orderbook (spoofing, fake walls, pump thin-book, iceberg).
 */

export type SmartMoneyState =
  | 'AKUMULASI_KUAT'
  | 'AKUMULASI_AWAL'
  | 'NETRAL'
  | 'DISTRIBUSI_AWAL'
  | 'DISTRIBUSI_KUAT';

export type WyckoffEvent = 'SC' | 'AR' | 'ST' | 'SPRING' | 'SOS' | 'LPS' | 'UT_UTAD' | 'SOW';

export interface WyckoffClassification {
  phase: string;
  detectedEvents: Array<{ event: WyckoffEvent; barIndex: number; description: string }>;
  wyckoffScore: number; // [-1.0 .. +1.0]
  confidence: number;
}

export interface OrderBookManipulationAlert {
  type: 'SPOOFING_LAYERING' | 'ICEBERG_DETECTED' | 'PUMP_THIN_BOOK' | 'FAKE_WALL';
  severity: 'WARNING' | 'CRITICAL' | 'POSITIVE_SIGNAL';
  detail: string;
  penaltyScore: number;
}

export interface SmartMoneyMetrics {
  absorptionRatioP: number;      // p in [0, 1]
  controlIndexA: number;         // a in [0, 1]
  state: SmartMoneyState;
  stateDescription: string;
  netForeignFlow5dIdr: number;
  hhiBuyerConcentration: number; // 0 to 10,000
  wyckoff: WyckoffClassification;
  manipulationAlerts: OrderBookManipulationAlert[];
  smartMoneyCompositeScore: number; // [-1.0 .. +1.0]
  freshnessWarning?: string;
}

/**
 * Menghitung Daya Serap (Absorption Ratio, p):
 * Mengukur berapa besar tekanan jual agresif yang diserap tanpa harga jebol turun.
 * p = 1 - (max(0, -ΔP%) / max(expected_drop%, ε))
 */
export function calculateAbsorptionRatioP(
  openPrice: number,
  closePrice: number,
  sellAggressiveVolumeLots: number,
  advPerMinuteLots: number,
  elasticityK: number = 1.2
): number {
  if (openPrice <= 0 || advPerMinuteLots <= 0) return 0.5;

  const deltaPPct = ((closePrice - openPrice) / openPrice) * 100;
  const expectedDropPct = (sellAggressiveVolumeLots / advPerMinuteLots) * elasticityK;
  const safeExpectedDrop = Math.max(expectedDropPct, 0.2); // minimum epsilon 0.2%

  const dropActual = Math.max(0, -deltaPPct);
  const ratio = 1 - dropActual / safeExpectedDrop;

  // Clamp to [0, 1]
  return Number(Math.max(0, Math.min(1, ratio)).toFixed(3));
}

/**
 * Menghitung Margin / Kendali Bandar (Control Index, a):
 * Mengukur konsentrasi dan kegigihan satu pihak mengontrol saham.
 * PERHATIAN: 'a' tinggi BUKAN sinyal bullish; 'a' mengukur kendali, bukan arah!
 */
export function calculateControlIndexA(
  buyerSharesPct: number[], // e.g., [0.40, 0.25, 0.15] -> 40%, 25%, 15%
  brokerRankPersistence: number, // [0, 1]
  supportDefenseRatio: number,   // [0, 1]
  icebergFrequencyRatio: number  // [0, 1]
): { controlIndexA: number; hhiBuy: number } {
  // Hitung HHI dari pembeli (0 to 10,000)
  const hhiBuy = buyerSharesPct.reduce((acc, s) => acc + Math.pow(s * 100, 2), 0);
  const normHhi = Math.min(1, hhiBuy / 5000); // 5000+ adalah konsentrasi ekstrem

  const a =
    0.35 * normHhi +
    0.30 * Math.min(1, Math.max(0, brokerRankPersistence)) +
    0.20 * Math.min(1, Math.max(0, supportDefenseRatio)) +
    0.15 * Math.min(1, Math.max(0, icebergFrequencyRatio));

  return {
    controlIndexA: Number(Math.max(0, Math.min(1, a)).toFixed(3)),
    hhiBuy: Math.round(hhiBuy),
  };
}

/**
 * Klasifikasi Fase Wyckoff Berbasis Aturan Deterministik.
 */
export function classifyWyckoffPhase(bars: Array<{ open: number; high: number; low: number; close: number; volume: number }>): WyckoffClassification {
  if (bars.length < 15) {
    return {
      phase: 'INSUFFICIENT_DATA',
      detectedEvents: [],
      wyckoffScore: 0,
      confidence: 0.2,
    };
  }

  const detectedEvents: Array<{ event: WyckoffEvent; barIndex: number; description: string }> = [];

  // Hitung rata-rata volume
  const avgVol = bars.reduce((acc, b) => acc + b.volume, 0) / bars.length;

  for (let i = 5; i < bars.length; i++) {
    const bar = bars[i];
    const prev = bars[i - 1];
    const range = bar.high - bar.low;
    const body = Math.abs(bar.close - bar.open);
    const volZ = avgVol > 0 ? (bar.volume - avgVol) / avgVol : 0;

    // Selling Climax (SC)
    if (volZ > 2.0 && bar.close > bar.low + range * 0.4 && bar.close < prev.close) {
      detectedEvents.push({
        event: 'SC',
        barIndex: i,
        description: 'Selling Climax: Volume tinggi dengan absorpsi di bagian bawah rentang candle.',
      });
    }

    // Spring
    if (bar.low < prev.low && bar.close > prev.close && volZ > 1.2) {
      detectedEvents.push({
        event: 'SPRING',
        barIndex: i,
        description: 'Spring / Shakeout: Menembus support sebelumnya lalu ditutup kembali ke atas dengan volume aktif.',
      });
    }

    // Sign of Strength (SOS)
    if (bar.close > prev.high && volZ > 1.5 && body > range * 0.6) {
      detectedEvents.push({
        event: 'SOS',
        barIndex: i,
        description: 'Sign of Strength: Breakout candle bullish penuh dengan konfirmasi ekspansi volume.',
      });
    }

    // Upthrust / UTAD (Peringatan Distribusi)
    if (bar.high > prev.high && bar.close < bar.open && volZ > 1.8) {
      detectedEvents.push({
        event: 'UT_UTAD',
        barIndex: i,
        description: 'Upthrust After Distribution: False breakout ke atas lalu dibanting turun tajam.',
      });
    }
  }

  // Tentukan skor Wyckoff
  const hasUtad = detectedEvents.some((e) => e.event === 'UT_UTAD');
  const hasSos = detectedEvents.some((e) => e.event === 'SOS');
  const hasSpring = detectedEvents.some((e) => e.event === 'SPRING');

  let phase = 'CONSOLIDATION';
  let wyckoffScore = 0;

  if (hasUtad) {
    phase = 'DISTRIBUTION_PHASE';
    wyckoffScore = -0.7;
  } else if (hasSos && hasSpring) {
    phase = 'ACCUMULATION_PHASE_D';
    wyckoffScore = 0.85;
  } else if (hasSpring) {
    phase = 'ACCUMULATION_PHASE_C';
    wyckoffScore = 0.65;
  } else {
    phase = 'ACCUMULATION_PHASE_B';
    wyckoffScore = 0.2;
  }

  return {
    phase,
    detectedEvents,
    wyckoffScore,
    confidence: detectedEvents.length > 0 ? 0.75 : 0.4,
  };
}

/**
 * Deteksi Manipulasi Orderbook.
 */
export function detectOrderBookManipulations(params: {
  fiveLevelsBidValueIdr: number;
  fiveLevelsOfferValueIdr: number;
  plannedPositionSizeIdr: number;
  canceledToExecutedRatio?: number;
  replenishedBidCount?: number;
  priceGain5dPct?: number;
}): OrderBookManipulationAlert[] {
  const alerts: OrderBookManipulationAlert[] = [];

  // 1. Thin Depth Guard
  if (params.fiveLevelsBidValueIdr < params.plannedPositionSizeIdr * 3) {
    alerts.push({
      type: 'PUMP_THIN_BOOK',
      severity: 'CRITICAL',
      detail: `Kedalaman 5 level bid (Rp ${(params.fiveLevelsBidValueIdr / 1e6).toFixed(0)} jt) kurang dari 3x ukuran posisi rencana. Risiko likuiditas keluar sangat tinggi.`,
      penaltyScore: 0.35,
    });
  }

  // 2. Spoofing / Layering
  if ((params.canceledToExecutedRatio ?? 0) > 8) {
    alerts.push({
      type: 'SPOOFING_LAYERING',
      severity: 'WARNING',
      detail: `Rasio pembatalan order sangat tinggi (>8:1). Terindikasi fake bids/offers untuk ilusi likuiditas.`,
      penaltyScore: 0.2,
    });
  }

  // 3. Iceberg Order (Positif)
  if ((params.replenishedBidCount ?? 0) >= 4) {
    alerts.push({
      type: 'ICEBERG_DETECTED',
      severity: 'POSITIVE_SIGNAL',
      detail: `Level bid terisi ulang berkali-kali setelah dimakan. Indikasi pembeli sabar institusional berskala besar.`,
      penaltyScore: 0,
    });
  }

  return alerts;
}

/**
 * Engine Evaluasi Smart Money & Bandarmologi 2.0 Lengkap.
 */
export function evaluateSmartMoneyL4(input: {
  openPrice: number;
  closePrice: number;
  sellAggressiveVolumeLots: number;
  advPerMinuteLots: number;
  buyerSharesPct: number[];
  brokerRankPersistence: number;
  supportDefenseRatio: number;
  icebergFrequencyRatio: number;
  netForeignFlow5dIdr: number;
  bars: Array<{ open: number; high: number; low: number; close: number; volume: number }>;
  orderbookParams: {
    fiveLevelsBidValueIdr: number;
    fiveLevelsOfferValueIdr: number;
    plannedPositionSizeIdr: number;
  };
  offerDepthVsBidDepthRatio: number;
  offerHeavyDaysCount: number;
}): SmartMoneyMetrics {
  const p = calculateAbsorptionRatioP(
    input.openPrice,
    input.closePrice,
    input.sellAggressiveVolumeLots,
    input.advPerMinuteLots
  );

  const { controlIndexA: a, hhiBuy } = calculateControlIndexA(
    input.buyerSharesPct,
    input.brokerRankPersistence,
    input.supportDefenseRatio,
    input.icebergFrequencyRatio
  );

  const wyckoff = classifyWyckoffPhase(input.bars);
  const manipulationAlerts = detectOrderBookManipulations({
    ...input.orderbookParams,
    priceGain5dPct: 0,
  });

  // Tentukan status Bandarmologi
  let state: SmartMoneyState = 'NETRAL';
  let stateDescription = 'Aktivitas transaksi berada pada dinamika pasar wajar.';

  if (p >= 0.70 && a >= 0.60 && input.netForeignFlow5dIdr > 0) {
    state = 'AKUMULASI_KUAT';
    stateDescription = 'Akumulasi dominan: Tekanan jual terserap tinggi, kendali bandar kuat, dan didukung net buy asing.';
  } else if (p >= 0.55 && a >= 0.45) {
    state = 'AKUMULASI_AWAL';
    stateDescription = 'Akumulasi awal: Terdapat penyerapan bertahap pada level-level support kunci.';
  } else if (p <= 0.30 && a >= 0.55) {
    state = 'DISTRIBUSI_KUAT';
    stateDescription = 'Distribusi aktif: Pihak berposisi besar melepas barang ke antrean beli retail.';
  } else if (p <= 0.40 && input.offerHeavyDaysCount >= 3) {
    state = 'DISTRIBUSI_AWAL';
    stateDescription = 'Distribusi bertahap: Tembok offer tebal menekan harga secara konsisten.';
  }

  // Hitung Skor Smart Money Gabungan:
  // Bobot PRD §10.5: 0.28 p + 0.22 conc + 0.18 foreign + 0.16 wyckoff + 0.16 absorption - penalty
  const normForeign = Math.max(-1, Math.min(1, input.netForeignFlow5dIdr / 10_000_000_000));
  const normConc = Math.min(1, hhiBuy / 4000);
  const totalPenalty = manipulationAlerts.reduce((acc, alert) => acc + alert.penaltyScore, 0);

  const composite =
    0.28 * (p * 2 - 1) +
    0.22 * normConc +
    0.18 * normForeign +
    0.16 * wyckoff.wyckoffScore +
    0.16 * (p > 0.6 ? 0.8 : -0.2) -
    Math.min(0.5, totalPenalty);

  return {
    absorptionRatioP: p,
    controlIndexA: a,
    state,
    stateDescription,
    netForeignFlow5dIdr: input.netForeignFlow5dIdr,
    hhiBuyerConcentration: hhiBuy,
    wyckoff,
    manipulationAlerts,
    smartMoneyCompositeScore: Number(Math.max(-1, Math.min(1, composite)).toFixed(3)),
    freshnessWarning: 'Data broker summary resmi IDX adalah posisi penutupan bursa (EOD H-1).',
  };
}
