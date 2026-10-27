/**
 * lib/news-intelligence/event-engine.ts
 * L5 — News & Event Intelligence Layer (PRD v2.0).
 * 
 * Strict Quant Protocol:
 * - Mengatasi T-07: Mengintegrasikan lapisan berita/event yang hilang di v1.0.
 * - Aturan Asimetri Rumor: Sumber T3/T4 HANYA boleh menurunkan keyakinan atau memicu WATCH,
 *   tidak pernah menaikkan probabilitas.
 * - Gerbang Konfirmasi Aliran Dana: Berita positif TIDAK PERNAH memicu BUY tanpa konfirmasi
 *   volume z >= 1.5, aggressive buy ratio > 0.55, dan harga > VWAP.
 * - Deteksi Priced-in untuk mencegah jebakan "Buy the News, Sell the Fact".
 */

export type SourceTier = 'T1' | 'T2' | 'T3' | 'T4';

export type EventGroup =
  | 'KINERJA'
  | 'AKSI_KORPORASI'
  | 'STRUKTURAL'
  | 'BISNIS'
  | 'RISIKO'
  | 'BURSA'
  | 'KEPEMILIKAN'
  | 'MAKRO_SEKTOR';

export type EventType =
  // Kinerja
  | 'EARNINGS_BEAT'
  | 'EARNINGS_MISS'
  | 'GUIDANCE_RAISE'
  | 'MONTHLY_OPERATIONAL_BEAT'
  // Aksi Korporasi
  | 'DIVIDEND_ANNOUNCEMENT'
  | 'STOCK_SPLIT'
  | 'BUYBACK_PLAN'
  | 'RIGHTS_ISSUE'
  | 'PRIVATE_PLACEMENT'
  | 'WARRANT_EXERCISE'
  // Struktural
  | 'ACQUISITION_MERGER'
  | 'DIVESTMENT'
  | 'TENDER_OFFER'
  | 'CONTROLLER_CHANGE'
  // Bisnis
  | 'CONTRACT_WIN'
  | 'CAPACITY_EXPANSION'
  | 'CONCESSION_PERMIT'
  | 'STRATEGIC_PARTNERSHIP'
  // Risiko
  | 'LEGAL_LAWSUIT'
  | 'PKPU_BANKRUPTCY_FILING'
  | 'DEBT_DEFAULT'
  | 'AUDIT_DISCLAIMER'
  | 'MANAGEMENT_DISMISSAL'
  // Bursa
  | 'UMA_ANNOUNCEMENT'
  | 'SUSPENSION'
  | 'FCA_INCLUSION'
  | 'INDEX_REBALANCING'
  // Kepemilikan & Makro
  | 'INSIDER_BUYING'
  | 'INSIDER_SELLING'
  | 'COMMODITY_SPIKE'
  | 'REGULATION_FAVORABLE';

export type PricedInStatus = 'FRESH' | 'PARTIAL' | 'PRICED_IN' | 'OVEREXTENDED';

export interface EventPriorCAR {
  eventType: EventType;
  group: EventGroup;
  medianCarT5Pct: number;
  nObservations: number;
  pValue: number;
  usable: boolean;
}

/**
 * Tabel Prior CAR (Cumulative Abnormal Return) Historis BEI.
 */
export const EVENT_PRIORS_CATALOG: Record<EventType, EventPriorCAR> = {
  CONTRACT_WIN: { eventType: 'CONTRACT_WIN', group: 'BISNIS', medianCarT5Pct: 2.8, nObservations: 143, pValue: 0.004, usable: true },
  EARNINGS_BEAT: { eventType: 'EARNINGS_BEAT', group: 'KINERJA', medianCarT5Pct: 3.5, nObservations: 210, pValue: 0.001, usable: true },
  EARNINGS_MISS: { eventType: 'EARNINGS_MISS', group: 'KINERJA', medianCarT5Pct: -4.2, nObservations: 195, pValue: 0.001, usable: true },
  GUIDANCE_RAISE: { eventType: 'GUIDANCE_RAISE', group: 'KINERJA', medianCarT5Pct: 2.5, nObservations: 45, pValue: 0.02, usable: true },
  MONTHLY_OPERATIONAL_BEAT: { eventType: 'MONTHLY_OPERATIONAL_BEAT', group: 'KINERJA', medianCarT5Pct: 1.8, nObservations: 60, pValue: 0.03, usable: true },
  DIVIDEND_ANNOUNCEMENT: { eventType: 'DIVIDEND_ANNOUNCEMENT', group: 'AKSI_KORPORASI', medianCarT5Pct: 2.0, nObservations: 310, pValue: 0.002, usable: true },
  STOCK_SPLIT: { eventType: 'STOCK_SPLIT', group: 'AKSI_KORPORASI', medianCarT5Pct: 3.0, nObservations: 55, pValue: 0.015, usable: true },
  BUYBACK_PLAN: { eventType: 'BUYBACK_PLAN', group: 'AKSI_KORPORASI', medianCarT5Pct: 4.1, nObservations: 72, pValue: 0.003, usable: true },
  RIGHTS_ISSUE: { eventType: 'RIGHTS_ISSUE', group: 'AKSI_KORPORASI', medianCarT5Pct: -3.8, nObservations: 88, pValue: 0.005, usable: true },
  PRIVATE_PLACEMENT: { eventType: 'PRIVATE_PLACEMENT', group: 'AKSI_KORPORASI', medianCarT5Pct: 1.2, nObservations: 95, pValue: 0.08, usable: false }, // p > 0.05 not usable
  WARRANT_EXERCISE: { eventType: 'WARRANT_EXERCISE', group: 'AKSI_KORPORASI', medianCarT5Pct: -1.5, nObservations: 40, pValue: 0.04, usable: true },
  ACQUISITION_MERGER: { eventType: 'ACQUISITION_MERGER', group: 'STRUKTURAL', medianCarT5Pct: 5.4, nObservations: 62, pValue: 0.001, usable: true },
  DIVESTMENT: { eventType: 'DIVESTMENT', group: 'STRUKTURAL', medianCarT5Pct: 1.5, nObservations: 38, pValue: 0.045, usable: true },
  TENDER_OFFER: { eventType: 'TENDER_OFFER', group: 'STRUKTURAL', medianCarT5Pct: 6.2, nObservations: 31, pValue: 0.001, usable: true },
  CONTROLLER_CHANGE: { eventType: 'CONTROLLER_CHANGE', group: 'STRUKTURAL', medianCarT5Pct: 4.5, nObservations: 44, pValue: 0.01, usable: true },
  CAPACITY_EXPANSION: { eventType: 'CAPACITY_EXPANSION', group: 'BISNIS', medianCarT5Pct: 2.1, nObservations: 50, pValue: 0.03, usable: true },
  CONCESSION_PERMIT: { eventType: 'CONCESSION_PERMIT', group: 'BISNIS', medianCarT5Pct: 3.2, nObservations: 35, pValue: 0.02, usable: true },
  STRATEGIC_PARTNERSHIP: { eventType: 'STRATEGIC_PARTNERSHIP', group: 'BISNIS', medianCarT5Pct: 1.9, nObservations: 75, pValue: 0.025, usable: true },
  LEGAL_LAWSUIT: { eventType: 'LEGAL_LAWSUIT', group: 'RISIKO', medianCarT5Pct: -5.1, nObservations: 42, pValue: 0.002, usable: true },
  PKPU_BANKRUPTCY_FILING: { eventType: 'PKPU_BANKRUPTCY_FILING', group: 'RISIKO', medianCarT5Pct: -12.0, nObservations: 65, pValue: 0.0001, usable: true },
  DEBT_DEFAULT: { eventType: 'DEBT_DEFAULT', group: 'RISIKO', medianCarT5Pct: -15.0, nObservations: 30, pValue: 0.0001, usable: true },
  AUDIT_DISCLAIMER: { eventType: 'AUDIT_DISCLAIMER', group: 'RISIKO', medianCarT5Pct: -18.0, nObservations: 25, pValue: 0.0001, usable: true },
  MANAGEMENT_DISMISSAL: { eventType: 'MANAGEMENT_DISMISSAL', group: 'RISIKO', medianCarT5Pct: -3.5, nObservations: 33, pValue: 0.03, usable: true },
  UMA_ANNOUNCEMENT: { eventType: 'UMA_ANNOUNCEMENT', group: 'BURSA', medianCarT5Pct: -4.8, nObservations: 180, pValue: 0.0001, usable: true },
  SUSPENSION: { eventType: 'SUSPENSION', group: 'BURSA', medianCarT5Pct: -8.5, nObservations: 110, pValue: 0.0001, usable: true },
  FCA_INCLUSION: { eventType: 'FCA_INCLUSION', group: 'BURSA', medianCarT5Pct: -14.2, nObservations: 140, pValue: 0.0001, usable: true },
  INDEX_REBALANCING: { eventType: 'INDEX_REBALANCING', group: 'BURSA', medianCarT5Pct: 1.1, nObservations: 90, pValue: 0.06, usable: false },
  INSIDER_BUYING: { eventType: 'INSIDER_BUYING', group: 'KEPEMILIKAN', medianCarT5Pct: 2.2, nObservations: 115, pValue: 0.015, usable: true },
  INSIDER_SELLING: { eventType: 'INSIDER_SELLING', group: 'KEPEMILIKAN', medianCarT5Pct: -2.0, nObservations: 105, pValue: 0.02, usable: true },
  COMMODITY_SPIKE: { eventType: 'COMMODITY_SPIKE', group: 'MAKRO_SEKTOR', medianCarT5Pct: 3.4, nObservations: 85, pValue: 0.005, usable: true },
  REGULATION_FAVORABLE: { eventType: 'REGULATION_FAVORABLE', group: 'MAKRO_SEKTOR', medianCarT5Pct: 2.7, nObservations: 48, pValue: 0.02, usable: true },
};

export interface NewsItemInput {
  id: string;
  ticker: string;
  headline: string;
  sourceUrl: string;
  sourceTier: SourceTier;
  publishedAt: string | Date;
  eventType: EventType;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  verifiedInDocument: boolean;
}

export interface EvaluatedEventOutput {
  id: string;
  factId: string;
  headline: string;
  sourceTier: SourceTier;
  sourceTierWeight: number;
  eventType: EventType;
  priorCarT5Pct: number;
  pricedInRatio: number;
  pricedInStatus: PricedInStatus;
  flowConfirmed: boolean;
  effectiveWeight: number;
  statusNote: string;
}

export interface NewsIntelligenceSummary {
  ticker: string;
  events: EvaluatedEventOutput[];
  netNewsScore: number;       // [-1.0 .. +1.0]
  isBlackoutActive: boolean;
  blackoutReason?: string;
  flowConfirmationPassed: boolean;
  headlineVerdict: string;
}

/**
 * Menghitung rasio priced-in berita.
 */
export function calculatePricedInRatio(
  currentPrice: number,
  priceAtPublish: number,
  expectedCarPct: number
): { ratio: number; status: PricedInStatus } {
  if (priceAtPublish <= 0) return { ratio: 1.0, status: 'PRICED_IN' };

  const moveSincePct = ((currentPrice - priceAtPublish) / priceAtPublish) * 100;
  const safeExpected = Math.max(Math.abs(expectedCarPct), 0.5);
  const ratio = Number((moveSincePct / safeExpected).toFixed(2));

  let status: PricedInStatus = 'FRESH';
  if (ratio < 0.3) status = 'FRESH';
  else if (ratio <= 0.7) status = 'PARTIAL';
  else if (ratio <= 1.2) status = 'PRICED_IN';
  else status = 'OVEREXTENDED';

  return { ratio, status };
}

/**
 * Memeriksa Gerbang Konfirmasi Aliran Dana (Flow Confirmation Gate).
 * Berita positif TIDAK BOLEH memicu BUY tanpa konfirmasi transaksi bursa.
 */
export function checkFlowConfirmation(params: {
  volumeZScore: number;
  aggressiveBuyRatio: number;
  currentPrice: number;
  sessionVwap: number;
}): boolean {
  return (
    params.volumeZScore >= 1.5 &&
    params.aggressiveBuyRatio > 0.55 &&
    params.currentPrice > params.sessionVwap
  );
}

/**
 * Evaluasi Lapisan L5 Berita & Event Intelligence.
 */
export function evaluateNewsIntelligenceL5(
  ticker: string,
  newsItems: NewsItemInput[],
  marketContext: {
    currentPrice: number;
    priceAtPublishMap?: Record<string, number>;
    volumeZScore: number;
    aggressiveBuyRatio: number;
    sessionVwap: number;
    isScheduledEarningsToday?: boolean;
    isRupsToday?: boolean;
  }
): NewsIntelligenceSummary {
  // Cek blackout window
  if (marketContext.isScheduledEarningsToday) {
    return {
      ticker,
      events: [],
      netNewsScore: 0,
      isBlackoutActive: true,
      blackoutReason: 'Blackout: Jadwal rilis laporan keuangan resmi hari ini. Sinyal trading dibekukan.',
      flowConfirmationPassed: false,
      headlineVerdict: 'BLACKOUT_ACTIVE',
    };
  }

  if (marketContext.isRupsToday) {
    return {
      ticker,
      events: [],
      netNewsScore: 0,
      isBlackoutActive: true,
      blackoutReason: 'Blackout: RUPS terjadwal dengan potensi agenda material.',
      flowConfirmationPassed: false,
      headlineVerdict: 'BLACKOUT_ACTIVE',
    };
  }

  const flowConfirmed = checkFlowConfirmation({
    volumeZScore: marketContext.volumeZScore,
    aggressiveBuyRatio: marketContext.aggressiveBuyRatio,
    currentPrice: marketContext.currentPrice,
    sessionVwap: marketContext.sessionVwap,
  });

  const evaluatedEvents: EvaluatedEventOutput[] = [];
  let weightedScoreSum = 0;
  let totalWeight = 0;

  for (const item of newsItems) {
    const prior = EVENT_PRIORS_CATALOG[item.eventType] || {
      medianCarT5Pct: item.sentiment === 'POSITIVE' ? 2.0 : -2.0,
      usable: true,
    };

    if (!prior.usable) continue;

    // Bobot tier sumber (T1 = 1.0, T2 = 0.75, T3 = 0.45, T4 = 0.10)
    let tierWeight = item.sourceTier === 'T1' ? 1.0 : item.sourceTier === 'T2' ? 0.75 : item.sourceTier === 'T3' ? 0.45 : 0.10;

    // ATURAN ASIMETRI RUMOR (PRD §11.2):
    // T3 / T4 TIDAK PERNAH boleh menaikkan probabilitas ke arah positif!
    if ((item.sourceTier === 'T3' || item.sourceTier === 'T4') && item.sentiment === 'POSITIVE') {
      tierWeight = 0; // Didiskon total dari kontribusi positif
    }

    const priceAtPublish = marketContext.priceAtPublishMap?.[item.id] || marketContext.currentPrice;
    const { ratio: pricedInRatio, status: pricedInStatus } = calculatePricedInRatio(
      marketContext.currentPrice,
      priceAtPublish,
      prior.medianCarT5Pct
    );

    let pricedInMultiplier = 1.0;
    if (pricedInStatus === 'FRESH') pricedInMultiplier = 1.0;
    else if (pricedInStatus === 'PARTIAL') pricedInMultiplier = 1.0 - pricedInRatio;
    else if (pricedInStatus === 'PRICED_IN') pricedInMultiplier = 0.1;
    else if (pricedInStatus === 'OVEREXTENDED') pricedInMultiplier = -0.5; // Resiko Sell The News!

    const effectiveWeight = Number((tierWeight * Math.abs(pricedInMultiplier)).toFixed(3));
    const directionSign = item.sentiment === 'POSITIVE' ? (pricedInMultiplier < 0 ? -1 : 1) : -1;

    let statusNote = 'Normal';
    if (!flowConfirmed && item.sentiment === 'POSITIVE') {
      statusNote = 'Berita positif tanpa konfirmasi aliran dana — smart money belum masuk.';
    } else if (pricedInStatus === 'OVEREXTENDED') {
      statusNote = 'Overextended: Harga sudah melonjak jauh melebihi rata-rata dampak berita; risiko koreksi.';
    }

    evaluatedEvents.push({
      id: item.id,
      factId: `L5.event.${item.id.slice(0, 8)}`,
      headline: item.headline,
      sourceTier: item.sourceTier,
      sourceTierWeight: tierWeight,
      eventType: item.eventType,
      priorCarT5Pct: prior.medianCarT5Pct,
      pricedInRatio,
      pricedInStatus,
      flowConfirmed,
      effectiveWeight,
      statusNote,
    });

    weightedScoreSum += directionSign * effectiveWeight;
    totalWeight += Math.abs(effectiveWeight);
  }

  const netScore = totalWeight > 0 ? Number((weightedScoreSum / totalWeight).toFixed(3)) : 0;

  let headlineVerdict = 'NEUTRAL';
  if (netScore > 0.4 && flowConfirmed) {
    headlineVerdict = 'FRESH_FLOW_CONFIRMED';
  } else if (netScore > 0.4 && !flowConfirmed) {
    headlineVerdict = 'POSITIVE_UNCONFIRMED_FLOW';
  } else if (netScore < -0.3) {
    headlineVerdict = 'NEGATIVE_CATALYST';
  }

  return {
    ticker,
    events: evaluatedEvents,
    netNewsScore: netScore,
    isBlackoutActive: false,
    flowConfirmationPassed: flowConfirmed,
    headlineVerdict,
  };
}
