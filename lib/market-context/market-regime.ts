/**
 * lib/market-context/market-regime.ts
 * Market Context & Section K Canonical Output Formatter (SmartMoney AI)
 */

import type { DecisionGateOutput } from '../decisions/decision-gate';
import type { TechnicalIndicatorsBundle } from '../indicators/types';
import type { AccumulationProxyResult } from '../accumulation/types';

export type MarketRegimeLabel =
  | 'bullish'
  | 'bearish'
  | 'range'
  | 'high_volatility'
  | 'uncertain';

export type MarketRegimeV2 =
  | 'TREND_UP'
  | 'TREND_DOWN'
  | 'RANGE_LOW_VOL'
  | 'RANGE_HIGH_VOL'
  | 'SHOCK';

export type SessionPhase =
  | 'PRE_OPEN'
  | 'INITIAL_BALANCE'
  | 'MID_SESSION'
  | 'REST'
  | 'LAST_30M'
  | 'PRE_CLOSE';

export interface RegimeMultipliers {
  thresholdBuyAdjustmentPct: number; // e.g., -5% in TREND_UP, +10% in RANGE_HIGH_VOL
  targetMultiplier: number;           // e.g., 1.2x in TREND_UP, 0.8x in RANGE_LOW_VOL
  positionSizeMultiplier: number;     // e.g., 1.0x in TREND_UP, 0.5x in RANGE_HIGH_VOL, 0 in SHOCK
  minRrrRequired: number;             // e.g., 1.8x base, 2.2x in high vol
}

export interface MarketRegimeContext {
  label: MarketRegimeLabel;
  regimeV2: MarketRegimeV2;
  evidence: string[];
  ihsg_return_1d_pct: number;
  ihsg_return_5d_pct: number;
  ihsg_return_20d_pct: number;
  sector_return_1d_pct?: number;
  usd_idr_rate?: number;
  regime_multiplier: number; // Used to adjust risk sizing
  multipliers: RegimeMultipliers;
}

export interface SectionKCandidateOutput {
  symbol: string;
  decision: string;
  rank_score: number | null;
  p_accumulation_like: number | null;
  p_target_before_stop: number | null;
  confidence: {
    label: 'low' | 'medium' | 'high';
    sample_size: number | null;
    calibration_status: string | null;
    confidence_interval: [number, number] | null;
  };
  setup_type: string | null;
  technical_evidence: string[];
  flow_evidence: string[];
  market_context: string[];
  supporting_evidence: string[];
  contradictory_evidence: string[];
  unknowns: string[];
  entry: {
    zone: [number, number] | null;
    trigger: string | null;
    entry_price: number | null;
  };
  risk_plan: {
    invalidation: number | null;
    stop_loss: number | null;
    target_1: number | null;
    target_2: number | null;
    time_stop: string | null;
    net_rrr: number | null;
    estimated_slippage: number | null;
    position_size_formula: string | null;
  };
  news: Array<{
    title: string;
    source: string;
    link?: string;
    published_at: string;
    materiality: string;
    sentiment: string;
  }>;
  sources: string[];
  model_version: string | null;
}

export interface SectionKOutput {
  as_of: string;
  data_status: 'fresh' | 'delayed' | 'stale' | 'incomplete';
  market_regime: {
    label: MarketRegimeLabel;
    evidence: string[];
  };
  candidates: SectionKCandidateOutput[];
  no_trade_reasons: string[];
}

/**
 * Evaluates broader IDX market regime based on IHSG (COMPOSITE) index performance.
 */
export function evaluateMarketRegime(
  ihsgClose: number,
  ihsgPrev1: number,
  ihsgPrev5: number,
  ihsgPrev20: number,
  ihsgEma50?: number
): MarketRegimeContext {
  const ret1d = Number((((ihsgClose - ihsgPrev1) / ihsgPrev1) * 100).toFixed(2));
  const ret5d = Number((((ihsgClose - ihsgPrev5) / ihsgPrev5) * 100).toFixed(2));
  const ret20d = Number((((ihsgClose - ihsgPrev20) / ihsgPrev20) * 100).toFixed(2));

  const evidence: string[] = [];
  evidence.push(`IHSG 1D: ${ret1d >= 0 ? '+' : ''}${ret1d}%, 5D: ${ret5d >= 0 ? '+' : ''}${ret5d}%, 20D: ${ret20d >= 0 ? '+' : ''}${ret20d}%`);

  let label: MarketRegimeLabel = 'range';
  let regimeV2: MarketRegimeV2 = 'RANGE_LOW_VOL';
  let multiplier = 1.0;
  let multipliers: RegimeMultipliers = {
    thresholdBuyAdjustmentPct: 0,
    targetMultiplier: 1.0,
    positionSizeMultiplier: 1.0,
    minRrrRequired: 1.8,
  };

  if (ret1d <= -3.0 || Math.abs(ret1d) >= 4.0) {
    label = 'high_volatility';
    regimeV2 = 'SHOCK';
    evidence.push('SHOCK REGIME: IHSG anjlok >3% atau volatilitas ekstrem. Seluruh sinyal SCALP baru DIBEKUKAN.');
    multiplier = 0;
    multipliers = {
      thresholdBuyAdjustmentPct: 50,
      targetMultiplier: 0.5,
      positionSizeMultiplier: 0, // STANDBY
      minRrrRequired: 3.0,
    };
  } else if (ret5d > 1.5 && (ihsgEma50 ? ihsgClose > ihsgEma50 : true)) {
    label = 'bullish';
    regimeV2 = 'TREND_UP';
    evidence.push('TREND UP: IHSG tren naik dengan momentum 5D di atas MA50.');
    multiplier = 1.0;
    multipliers = {
      thresholdBuyAdjustmentPct: -5, // Sedikit lebih longgar
      targetMultiplier: 1.2,
      positionSizeMultiplier: 1.0,
      minRrrRequired: 1.8,
    };
  } else if (ret5d < -1.5) {
    label = 'bearish';
    regimeV2 = 'TREND_DOWN';
    evidence.push('TREND DOWN: IHSG tekanan jual tinggi. Hanya setup reversal kuat yang diizinkan.');
    multiplier = 0.6;
    multipliers = {
      thresholdBuyAdjustmentPct: 15,
      targetMultiplier: 0.9,
      positionSizeMultiplier: 0.6,
      minRrrRequired: 2.0,
    };
  } else if (Math.abs(ret1d) > 1.5) {
    label = 'high_volatility';
    regimeV2 = 'RANGE_HIGH_VOL';
    evidence.push('RANGE HIGH VOL: Volatilitas intraday tinggi. Wajib RRR lebih lebar.');
    multiplier = 0.5;
    multipliers = {
      thresholdBuyAdjustmentPct: 10,
      targetMultiplier: 1.0,
      positionSizeMultiplier: 0.5,
      minRrrRequired: 2.2,
    };
  } else {
    label = 'range';
    regimeV2 = 'RANGE_LOW_VOL';
    evidence.push('RANGE LOW VOL: IHSG konsolidasi tenang. Target diperketat ke area mean-reversion.');
    multiplier = 0.85;
    multipliers = {
      thresholdBuyAdjustmentPct: 0,
      targetMultiplier: 0.8,
      positionSizeMultiplier: 0.85,
      minRrrRequired: 1.8,
    };
  }

  return {
    label,
    regimeV2,
    evidence,
    ihsg_return_1d_pct: ret1d,
    ihsg_return_5d_pct: ret5d,
    ihsg_return_20d_pct: ret20d,
    regime_multiplier: multiplier,
    multipliers,
  };
}

/**
 * Mengidentifikasi fase sesi perdagangan BEI secara intraday.
 * Jam bursa reguler (WIB):
 * - Sesi I: 09:00 - 12:00 (Jumat 09:00 - 11:30)
 * - Sesi II: 13:30 - 15:49 (Jumat 14:00 - 15:49)
 * - Pra-penutupan: 15:50 - 16:00
 */
export function classifySessionPhase(asOfDate?: Date | string): { phase: SessionPhase; canEnterScalp: boolean; message: string } {
  const d = asOfDate ? new Date(asOfDate) : new Date();
  
  // Format ke jam dan menit WIB (+7)
  const utcHours = d.getUTCHours();
  const utcMinutes = d.getUTCMinutes();
  const wibHours = (utcHours + 7) % 24;
  const timeInMinutes = wibHours * 60 + utcMinutes;

  // 08:45 - 08:59 WIB: Pra-pembukaan
  if (timeInMinutes >= 525 && timeInMinutes < 540) {
    return {
      phase: 'PRE_OPEN',
      canEnterScalp: false,
      message: 'Pra-pembukaan: Order book rentan manipulasi; hanya observasi.',
    };
  }

  // 09:00 - 09:30 WIB: Initial Balance (30m pertama)
  if (timeInMinutes >= 540 && timeInMinutes < 570) {
    return {
      phase: 'INITIAL_BALANCE',
      canEnterScalp: false,
      message: '30 menit pertama: Pembentukan Initial Balance. Dilarang entry SCALP sampai rentang harga stabil.',
    };
  }

  // 09:30 - 11:45 WIB: Mid-Session I
  if (timeInMinutes >= 570 && timeInMinutes < 705) {
    return {
      phase: 'MID_SESSION',
      canEnterScalp: true,
      message: 'Kondisi operasi normal sesi I.',
    };
  }

  // 11:45 - 13:30 WIB: Rest / Istirahat
  if (timeInMinutes >= 705 && timeInMinutes < 810) {
    return {
      phase: 'REST',
      canEnterScalp: false,
      message: 'Istirahat sesi bursa. Likuiditas minim.',
    };
  }

  // 13:30 - 15:20 WIB: Mid-Session II
  if (timeInMinutes >= 810 && timeInMinutes < 920) {
    return {
      phase: 'MID_SESSION',
      canEnterScalp: true,
      message: 'Kondisi operasi normal sesi II.',
    };
  }

  // 15:20 - 15:49 WIB: Last 30m
  if (timeInMinutes >= 920 && timeInMinutes < 950) {
    return {
      phase: 'LAST_30M',
      canEnterScalp: false,
      message: '30 menit terakhir sesi: Dilarang entry SCALP baru; hanya kelola posisi/exit.',
    };
  }

  // 15:50 - 16:00 WIB: Pra-penutupan
  if (timeInMinutes >= 950 && timeInMinutes <= 960) {
    return {
      phase: 'PRE_CLOSE',
      canEnterScalp: false,
      message: 'Pra-penutupan: Sinyal dibekukan.',
    };
  }

  // Di luar jam bursa
  return {
    phase: 'REST',
    canEnterScalp: false,
    message: 'Di luar jam perdagangan aktif BEI.',
  };
}

/**
 * Formats canonical Section K JSON output.
 */
export function formatSectionKOutput(
  regime: MarketRegimeContext,
  decisionOutputs: Array<{
    decisionGate: DecisionGateOutput;
    tech: TechnicalIndicatorsBundle;
    accProxy: AccumulationProxyResult;
    verifiedNews?: Array<{
      title: string;
      source: string;
      published_at: string;
      materiality: string;
      sentiment: string;
    }>;
  }>,
  overallDataStatus: 'fresh' | 'delayed' | 'stale' | 'incomplete' = 'fresh'
): SectionKOutput {
  const asOf = new Date().toISOString();
  const globalNoTradeReasons: string[] = [];

  const candidates: SectionKCandidateOutput[] = decisionOutputs.map((item) => {
    const d = item.decisionGate;
    const c = d.selected_candidate;
    const candNews = item.verifiedNews || [];

    if (d.decision === 'NO_TRADE') {
      globalNoTradeReasons.push(...d.no_trade_reasons);
    }

    const technicalEvidence: string[] = [
      `Trend Regime: ${item.tech.trend.regime}, Slope EMA20: ${item.tech.trend.slope_ema20}%`,
      `Price vs Session VWAP: ${item.tech.vwap.price_distance_to_vwap_atr} ATR (Rp ${item.tech.vwap.session_vwap.toLocaleString()})`,
      `RVOL: ${item.tech.volume.rvol}x, Dollar Volume: Rp ${(item.tech.volume.dollar_volume / 1e9).toFixed(2)}B`,
      `RSI 14: ${item.tech.momentum.rsi14} (${item.tech.momentum.rsi_regime})`,
    ];

    const flowEvidence: string[] = [
      `Flow State: ${item.accProxy.flow_state}`,
      `Net Flow: Rp ${(item.accProxy.net_flow_value / 1e9).toFixed(2)}B (Ratio: ${(item.accProxy.net_flow_ratio * 100).toFixed(1)}%)`,
      `Concentration HHI: ${item.accProxy.flow_concentration_hhi} (CR3: ${item.accProxy.top_buyer_concentration_cr3}%)`,
      `Flow VWAP Proxy: Rp ${item.accProxy.flow_vwap_proxy.toLocaleString()}`,
    ];

    return {
      symbol: d.symbol,
      decision: d.decision,
      rank_score: d.rank_score,
      p_accumulation_like: item.accProxy.p_accumulation_like,
      p_target_before_stop: d.calibrated_probability,
      confidence: {
        label: d.confidence.label.toLowerCase() as any,
        sample_size: d.confidence.sample_size,
        calibration_status: d.confidence.calibration_status,
        confidence_interval: d.confidence.confidence_interval,
      },
      setup_type: c ? c.setup_type : null,
      technical_evidence: technicalEvidence,
      flow_evidence: flowEvidence,
      market_context: regime.evidence,
      supporting_evidence: d.passed_checks,
      contradictory_evidence: d.failed_checks,
      unknowns: item.accProxy.missing_data,
      entry: {
        zone: c ? c.entry_zone : null,
        trigger: c ? c.trigger_condition : null,
        entry_price: c ? c.recommended_entry_price : null,
      },
      risk_plan: {
        invalidation: c ? c.invalidation_price : null,
        stop_loss: c ? c.invalidation_price : null,
        target_1: c ? c.target_1 : null,
        target_2: c ? c.target_2 : null,
        time_stop: 'End of current trading session (16:00 WIB)',
        net_rrr: c ? c.net_rrr : null,
        estimated_slippage: c ? c.estimated_slippage : null,
        position_size_formula: 'Max 2% total equity risk / Stop distance per share',
      },
      news: candNews,
      sources: ['IDX Keterbukaan Informasi', 'Stockbit Exodus Feed', 'TradingView IDX Widget'],
      model_version: item.accProxy.model_version,
    };
  });

  return {
    as_of: asOf,
    data_status: overallDataStatus,
    market_regime: {
      label: regime.label,
      evidence: regime.evidence,
    },
    candidates,
    no_trade_reasons: Array.from(new Set(globalNoTradeReasons)),
  };
}
