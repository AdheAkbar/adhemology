/**
 * lib/screener/eligibility-screener.ts
 * L0 — Universe & Eligibility Screener (PRD v2.0).
 * 
 * Strict Quant Protocol:
 * Memilih saham yang secara statistik SANGGUP bergerak 3-15% bersih.
 * Mengeliminasi saham tidak likuid, FCA, berisiko ekor ekstrem, atau manipulatif.
 */

import { getTickSize } from '../config/market-rulebook';

export type UniverseTier = 'A' | 'B' | 'C' | 'D' | 'X';

export type ManipulationFlag =
  | 'GORENGAN_RISK'
  | 'CROSSING_SUSPECT'
  | 'MARKING_THE_CLOSE'
  | 'THIN_DEPTH'
  | 'PUMP_SEQUENCE';

export interface StockCandidateStats {
  ticker: string;
  price: number;
  adtvIdr: number;            // 20-day Average Daily Turnover in IDR
  dailyFrequency: number;     // Average daily trades count
  listingAgeDays: number;
  freeFloatPct: number;
  isFca: boolean;
  isSuspended: boolean;
  isUma: boolean;
  isPkpuOrBankruptcy: boolean;
  auditOpinionBad: boolean;   // true if disclaimer or adverse
  
  // Volatility metrics (60-day window)
  atrDaily14: number;
  pMove3Pct: number;          // Proportion of days with (high - low) / open >= 3%
  pMove7Pct: number;          // Proportion of days with (high - low) / open >= 7%
  
  // Manipulation indicators
  consecutiveAraDays?: number;
  volumeSurgeRatio?: number;
  topBrokerCrossingShare?: number;
  markingCloseVolumeShare?: number;
  gain5DaysPct?: number;
  hasVerifiedNews?: boolean;
}

export interface ScreenerEvaluation {
  ticker: string;
  tier: UniverseTier;
  tierLabel: string;
  passedHardFilters: boolean;
  failedFilters: string[];
  flags: ManipulationFlag[];
  atrPct: number;
  tickFrictionPct: number;
  allowedModes: ('SCALP' | 'SWING' | 'INVEST')[];
  maxTpPct: number;
  maxAllocationPct: number;
  recommendationNote: string;
}

/**
 * Mengevaluasi kelayakan saham masuk ke dalam Universe L0.
 */
export function evaluateEligibilityL0(stats: StockCandidateStats): ScreenerEvaluation {
  const failedFilters: string[] = [];
  const flags: ManipulationFlag[] = [];

  const tick = getTickSize(stats.price);
  const tickFrictionPct = stats.price > 0 ? Number(((tick / stats.price) * 100).toFixed(3)) : 100;
  const atrPct = stats.price > 0 ? Number(((stats.atrDaily14 / stats.price) * 100).toFixed(2)) : 0;

  // --- 1. HARD FILTERS (H1 - H9) ---
  if (stats.isFca) failedFilters.push('H1_FCA_BOARD');
  if (stats.isSuspended || stats.isUma) failedFilters.push('H2_SUSPEND_OR_UMA');
  if (stats.isPkpuOrBankruptcy || stats.auditOpinionBad) failedFilters.push('H3_LEGAL_OR_AUDIT_RISK');
  if (stats.adtvIdr < 15_000_000_000) failedFilters.push('H4_ADTV_BELOW_15BN');
  if (stats.dailyFrequency < 3_000) failedFilters.push('H5_FREQUENCY_BELOW_3000');
  if (stats.price < 100 || stats.price > 20_000) failedFilters.push('H6_PRICE_OUT_OF_BOUNDS');
  if (tickFrictionPct > 0.6) failedFilters.push('H7_TICK_FRICTION_TOO_HIGH');
  if (stats.listingAgeDays < 60) failedFilters.push('H8_LISTING_AGE_UNDER_60D');
  if (stats.freeFloatPct < 7.5) failedFilters.push('H9_FREE_FLOAT_UNDER_7.5PCT');

  const passedHardFilters = failedFilters.length === 0;

  // --- 2. MANIPULATION FLAGS ---
  if ((stats.consecutiveAraDays ?? 0) >= 3 && (stats.volumeSurgeRatio ?? 0) > 10 && stats.freeFloatPct < 15 && !stats.hasVerifiedNews) {
    flags.push('GORENGAN_RISK');
  }
  if ((stats.topBrokerCrossingShare ?? 0) > 0.35) {
    flags.push('CROSSING_SUSPECT');
  }
  if ((stats.markingCloseVolumeShare ?? 0) > 0.25) {
    flags.push('MARKING_THE_CLOSE');
  }
  if ((stats.gain5DaysPct ?? 0) > 40 && !stats.hasVerifiedNews) {
    flags.push('PUMP_SEQUENCE');
  }

  // --- 3. VOLATILITY TIERING ---
  let tier: UniverseTier = 'X';
  let tierLabel = 'Excluded (Fails Hard Filters)';
  let allowedModes: ('SCALP' | 'SWING' | 'INVEST')[] = [];
  let maxTpPct = 0;
  let maxAllocationPct = 0;

  if (!passedHardFilters) {
    tier = 'X';
    tierLabel = 'Excluded';
    allowedModes = [];
    maxTpPct = 0;
    maxAllocationPct = 0;
  } else {
    // Check Tier A: Scalp Prime
    if (atrPct >= 4.0 && stats.pMove3Pct >= 0.50 && stats.adtvIdr >= 50_000_000_000 && !flags.includes('PUMP_SEQUENCE')) {
      tier = 'A';
      tierLabel = 'Tier A — Scalp Prime';
      allowedModes = ['SCALP', 'SWING', 'INVEST'];
      maxTpPct = 15.0; // TP1 3%, TP2 7%, TP3 12-15%
      maxAllocationPct = 100;
    }
    // Check Tier B: Scalp Viable
    else if (atrPct >= 2.5 && stats.pMove3Pct >= 0.30 && stats.adtvIdr >= 15_000_000_000 && !flags.includes('PUMP_SEQUENCE')) {
      tier = 'B';
      tierLabel = 'Tier B — Scalp Viable';
      allowedModes = ['SCALP', 'SWING', 'INVEST'];
      maxTpPct = 8.0; // TP1 3%, TP2 5%, TP3 8%
      maxAllocationPct = 60;
    }
    // Check Tier C: Swing Only
    else if (atrPct >= 1.5) {
      tier = 'C';
      tierLabel = 'Tier C — Swing Only';
      allowedModes = ['SWING', 'INVEST'];
      maxTpPct = 20.0; // Structural swing targets
      maxAllocationPct = 40;
    }
    // Tier D: Invest Only
    else {
      tier = 'D';
      tierLabel = 'Tier D — Invest Only';
      allowedModes = ['INVEST'];
      maxTpPct = 50.0; // Milestone-based valuation targets
      maxAllocationPct = 30;
    }

    // Penalty: If flags exist, downgrade tier
    if (flags.includes('GORENGAN_RISK') || flags.includes('CROSSING_SUSPECT')) {
      if (tier === 'A') tier = 'B';
      else if (tier === 'B') tier = 'C';
      maxAllocationPct = Math.round(maxAllocationPct * 0.6);
    }
  }

  const recommendationNote =
    tier === 'A'
      ? 'Likuiditas dan volatilitas prima untuk target bersih 3-15%.'
      : tier === 'B'
      ? 'Layak untuk scalping terkendali hingga target TP2 5-8%.'
      : tier === 'C'
      ? 'Volatilitas harian tidak memadai untuk scalping; dialokasikan ke strategi swing berhari-hari.'
      : tier === 'D'
      ? 'Pergerakan stabil; hanya diizinkan untuk analisis fundamental jangka panjang.'
      : `Ditolak oleh filter gerbang: ${failedFilters.join(', ')}`;

  return {
    ticker: stats.ticker,
    tier,
    tierLabel,
    passedHardFilters,
    failedFilters,
    flags,
    atrPct,
    tickFrictionPct,
    allowedModes,
    maxTpPct,
    maxAllocationPct,
    recommendationNote,
  };
}
