/**
 * lib/indicators/types.ts
 * Types for Deterministic Technical Indicator Engine (SmartMoney AI)
 */

export interface OHLCVBar {
  timestamp: string; // ISO string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  traded_value?: number; // In IDR
  timeframe?: string;
  is_complete?: boolean;
}

export type TrendRegime = 'STRONG_UPTREND' | 'UPTREND' | 'NEUTRAL_RANGE' | 'DOWNTREND' | 'STRONG_DOWNTREND';
export type VolatilityRegime = 'COMPRESSED' | 'NORMAL' | 'EXPANDED' | 'EXTREME_VOLATILITY';
export type RsiRegime = 'OVERSOLD' | 'BEARISH_MOMENTUM' | 'NEUTRAL' | 'BULLISH_MOMENTUM' | 'OVERBOUGHT';

export interface TrendIndicators {
  ema20: number;
  ema50: number;
  sma200: number | null; // Null if insufficient history (< 200 bars)
  slope_ema20: number; // In degrees or % per bar
  price_vs_ema20_pct: number;
  price_vs_ema50_pct: number;
  price_vs_sma200_pct: number | null;
  is_golden_cross: boolean; // 50 crossed above 200 recently
  is_death_cross: boolean; // 50 crossed below 200 recently
  regime: TrendRegime;
}

export interface VwapIndicators {
  session_vwap: number;
  weekly_vwap: number | null;
  anchored_vwap_swing_low: number | null;
  anchored_vwap_accumulation_start: number | null;
  price_distance_to_vwap: number; // In price units
  price_distance_to_vwap_atr: number; // In multiples of ATR
  is_above_session_vwap: boolean;
}

export interface VolumeIndicators {
  current_volume: number;
  avg_volume_20: number;
  rvol: number; // Relative Volume vs 20-period average
  rvol_time_of_day: number | null; // Relative to same time in prior sessions
  dollar_volume: number; // In IDR
  is_volume_spike: boolean; // Volume > 2.0x avg
  is_volume_contraction: boolean; // Volume < 0.6x avg
  is_breakout_volume_expansion: boolean;
}

export interface VolumeProfileIndicators {
  poc: number; // Point of Control (Highest volume price)
  vah: number; // Value Area High (70% boundary)
  val: number; // Value Area Low (70% boundary)
  hvn: number[]; // High Volume Nodes (peaks)
  lvn: number[]; // Low Volume Nodes (valleys)
  price_location: 'ABOVE_VALUE_AREA' | 'INSIDE_VALUE_AREA' | 'BELOW_VALUE_AREA';
}

export interface MomentumIndicators {
  rsi14: number;
  rsi_regime: RsiRegime;
  bullish_divergence: boolean;
  bearish_divergence: boolean;
  macd_line: number;
  signal_line: number;
  histogram: number;
  histogram_slope: number;
  disclaimer: string; // "RSI and MACD are descriptive momentum indicators, never standalone buy triggers."
}

export interface VolatilityIndicators {
  atr14: number;
  atr_percentage: number; // (ATR / Close) * 100
  historical_volatility_20: number; // Annualized %
  gap_percentage: number;
  volatility_regime: VolatilityRegime;
}

export interface MarketStructureIndicators {
  recent_swing_high: number;
  recent_swing_low: number;
  structure_state: 'HIGHER_HIGH' | 'HIGHER_LOW' | 'LOWER_HIGH' | 'LOWER_LOW' | 'EQUILIBRIUM';
  break_of_structure_bos: boolean; // Bullish BOS
  change_of_character_choch: boolean; // Bullish CHoCH
  liquidity_sweep: boolean; // Swept below recent low and closed back inside
  breakout_retest_confirmed: boolean;
  failed_breakout: boolean;
}

export interface RelativeStrengthIndicators {
  stock_vs_ihsg_1d_pct: number;
  stock_vs_ihsg_5d_pct: number;
  stock_vs_ihsg_20d_pct: number;
  stock_vs_sector_1d_pct: number | null;
  stock_vs_sector_5d_pct: number | null;
  relative_strength_percentile: number; // 0 to 100
}

export interface TechnicalIndicatorsBundle {
  as_of: string;
  symbol: string;
  current_price: number;
  trend: TrendIndicators;
  vwap: VwapIndicators;
  volume: VolumeIndicators;
  volume_profile: VolumeProfileIndicators;
  momentum: MomentumIndicators;
  volatility: VolatilityIndicators;
  market_structure: MarketStructureIndicators;
  relative_strength: RelativeStrengthIndicators;
}
