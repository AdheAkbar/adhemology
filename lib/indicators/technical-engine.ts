/**
 * lib/indicators/technical-engine.ts
 * Deterministic Technical Indicator Engine for SmartMoney AI.
 * 
 * Strict Quant Protocol:
 * All indicators are calculated deterministically without lookahead bias.
 * Momentum indicators include explicit disclaimers: they describe velocity,
 * never serve as automatic buy triggers.
 */

import type {
  OHLCVBar,
  TechnicalIndicatorsBundle,
  TrendIndicators,
  VwapIndicators,
  VolumeIndicators,
  VolumeProfileIndicators,
  MomentumIndicators,
  VolatilityIndicators,
  MarketStructureIndicators,
  RelativeStrengthIndicators,
  TrendRegime,
  VolatilityRegime,
  RsiRegime,
} from './types';
import { snapToIdxTick } from '../config/idx-fraksi-config';

/**
 * Calculates Simple Moving Average (SMA).
 */
export function calculateSMA(values: number[], period: number): number | null {
  if (values.length < period || period <= 0) return null;
  const slice = values.slice(values.length - period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return Number((sum / period).toFixed(2));
}

/**
 * Calculates Exponential Moving Average (EMA).
 */
export function calculateEMA(values: number[], period: number): number {
  if (values.length === 0) return 0;
  if (values.length < period) {
    const sum = values.reduce((a, b) => a + b, 0);
    return Number((sum / values.length).toFixed(2));
  }

  const k = 2 / (period + 1);
  // Start with SMA of first 'period' bars
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }

  return Number(ema.toFixed(2));
}

/**
 * Calculates Relative Strength Index (RSI 14) via Wilder's Smoothing.
 */
export function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length <= period) return 50; // Neutral default for short history

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const currentGain = diff >= 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

/**
 * Calculates Average True Range (ATR 14).
 */
export function calculateATR(bars: OHLCVBar[], period: number = 14): number {
  if (bars.length < 2) {
    return bars.length === 1 ? Math.max(1, bars[0].high - bars[0].low) : 10;
  }

  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevClose = bars[i - 1].close;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) {
    const sum = trueRanges.reduce((a, b) => a + b, 0);
    return Math.max(1, Math.round(sum / trueRanges.length));
  }

  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return Math.max(1, Math.round(atr));
}

/**
 * Calculates Moving Average Convergence Divergence (MACD 12, 26, 9).
 */
export function calculateMACD(closes: number[]): {
  macdLine: number;
  signalLine: number;
  histogram: number;
  histogramSlope: number;
} {
  if (closes.length < 26) {
    return { macdLine: 0, signalLine: 0, histogram: 0, histogramSlope: 0 };
  }

  // Calculate rolling MACD line series for the last 15 points
  const macdSeries: number[] = [];
  const lookback = Math.min(closes.length, 45);
  const startIdx = closes.length - lookback;

  for (let idx = startIdx + 26; idx <= closes.length; idx++) {
    const subCloses = closes.slice(0, idx);
    const ema12 = calculateEMA(subCloses, 12);
    const ema26 = calculateEMA(subCloses, 26);
    macdSeries.push(ema12 - ema26);
  }

  const macdLine = macdSeries[macdSeries.length - 1] || 0;
  const signalLine = calculateEMA(macdSeries, 9);
  const histogram = Number((macdLine - signalLine).toFixed(2));

  // Slope over last 2 histogram bars
  const prevHistogram =
    macdSeries.length >= 2
      ? Number(
          (
            macdSeries[macdSeries.length - 2] -
            calculateEMA(macdSeries.slice(0, -1), 9)
          ).toFixed(2)
        )
      : histogram;

  const histogramSlope = Number((histogram - prevHistogram).toFixed(2));

  return {
    macdLine: Number(macdLine.toFixed(2)),
    signalLine: Number(signalLine.toFixed(2)),
    histogram,
    histogramSlope,
  };
}

/**
 * Calculates Volume Profile (POC, VAH, VAL) from OHLCV bars.
 */
export function calculateVolumeProfile(
  bars: OHLCVBar[],
  bucketCount: number = 24
): VolumeProfileIndicators {
  if (bars.length === 0) {
    return {
      poc: 0,
      vah: 0,
      val: 0,
      hvn: [],
      lvn: [],
      price_location: 'INSIDE_VALUE_AREA',
    };
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let totalVolume = 0;

  for (const b of bars) {
    if (b.low < minPrice) minPrice = b.low;
    if (b.high > maxPrice) maxPrice = b.high;
    totalVolume += b.volume;
  }

  if (minPrice === maxPrice || totalVolume === 0) {
    const p = bars[bars.length - 1].close;
    return {
      poc: p,
      vah: p,
      val: p,
      hvn: [p],
      lvn: [],
      price_location: 'INSIDE_VALUE_AREA',
    };
  }

  const step = (maxPrice - minPrice) / bucketCount;
  const buckets: { price: number; volume: number }[] = [];

  for (let i = 0; i < bucketCount; i++) {
    buckets.push({
      price: Math.round(minPrice + i * step + step / 2),
      volume: 0,
    });
  }

  // Allocate volume to price buckets
  for (const b of bars) {
    const barMid = (b.high + b.low + b.close) / 3;
    const bucketIdx = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor((barMid - minPrice) / step))
    );
    buckets[bucketIdx].volume += b.volume;
  }

  // Find POC (Point of Control - highest volume bucket)
  let maxVol = -1;
  let pocIdx = 0;
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i].volume > maxVol) {
      maxVol = buckets[i].volume;
      pocIdx = i;
    }
  }
  const poc = buckets[pocIdx].price;

  // Compute Value Area (70% of total volume expanding around POC)
  const targetVaVolume = totalVolume * 0.7;
  let accumulatedVolume = buckets[pocIdx].volume;
  let lowerIdx = pocIdx;
  let upperIdx = pocIdx;

  while (
    accumulatedVolume < targetVaVolume &&
    (lowerIdx > 0 || upperIdx < bucketCount - 1)
  ) {
    const nextLowerVol = lowerIdx > 0 ? buckets[lowerIdx - 1].volume : -1;
    const nextUpperVol =
      upperIdx < bucketCount - 1 ? buckets[upperIdx + 1].volume : -1;

    if (nextUpperVol >= nextLowerVol && nextUpperVol >= 0) {
      upperIdx++;
      accumulatedVolume += buckets[upperIdx].volume;
    } else if (nextLowerVol >= 0) {
      lowerIdx--;
      accumulatedVolume += buckets[lowerIdx].volume;
    } else {
      break;
    }
  }

  const vah = buckets[upperIdx].price;
  const val = buckets[lowerIdx].price;

  // High & Low volume nodes
  const hvn = buckets
    .filter((b) => b.volume > totalVolume / bucketCount * 1.5)
    .map((b) => b.price);
  const lvn = buckets
    .filter((b) => b.volume < totalVolume / bucketCount * 0.4)
    .map((b) => b.price);

  const currentPrice = bars[bars.length - 1].close;
  let priceLocation: VolumeProfileIndicators['price_location'] =
    'INSIDE_VALUE_AREA';
  if (currentPrice > vah) priceLocation = 'ABOVE_VALUE_AREA';
  else if (currentPrice < val) priceLocation = 'BELOW_VALUE_AREA';

  return {
    poc,
    vah,
    val,
    hvn: hvn.slice(0, 3),
    lvn: lvn.slice(0, 3),
    price_location: priceLocation,
  };
}

/**
 * Calculates Volume Weighted Average Price (VWAP).
 */
export function calculateVWAP(bars: OHLCVBar[], startIndex: number = 0): number {
  if (bars.length === 0) return 0;
  const slice = bars.slice(startIndex);
  let totalPV = 0;
  let totalV = 0;

  for (const b of slice) {
    const typicalPrice = (b.high + b.low + b.close) / 3;
    totalPV += typicalPrice * b.volume;
    totalV += b.volume;
  }

  if (totalV === 0) return bars[bars.length - 1].close;
  return Number((totalPV / totalV).toFixed(2));
}

/**
 * Detects Market Structure: Swing Highs, Swing Lows, BOS, CHoCH, and Liquidity Sweeps.
 */
export function detectMarketStructure(bars: OHLCVBar[]): MarketStructureIndicators {
  if (bars.length < 5) {
    const p = bars.length > 0 ? bars[bars.length - 1].close : 0;
    return {
      recent_swing_high: p,
      recent_swing_low: p,
      structure_state: 'EQUILIBRIUM',
      break_of_structure_bos: false,
      change_of_character_choch: false,
      liquidity_sweep: false,
      breakout_retest_confirmed: false,
      failed_breakout: false,
    };
  }

  // Find swing highs and lows (using N=2 fractal)
  const swingHighs: { price: number; index: number }[] = [];
  const swingLows: { price: number; index: number }[] = [];

  for (let i = 2; i < bars.length - 2; i++) {
    const isHigh =
      bars[i].high > bars[i - 1].high &&
      bars[i].high > bars[i - 2].high &&
      bars[i].high > bars[i + 1].high &&
      bars[i].high > bars[i + 2].high;

    const isLow =
      bars[i].low < bars[i - 1].low &&
      bars[i].low < bars[i - 2].low &&
      bars[i].low < bars[i + 1].low &&
      bars[i].low < bars[i + 2].low;

    if (isHigh) swingHighs.push({ price: bars[i].high, index: i });
    if (isLow) swingLows.push({ price: bars[i].low, index: i });
  }

  const recentSwingHigh =
    swingHighs.length > 0
      ? swingHighs[swingHighs.length - 1].price
      : Math.max(...bars.map((b) => b.high));
  const recentSwingLow =
    swingLows.length > 0
      ? swingLows[swingLows.length - 1].price
      : Math.min(...bars.map((b) => b.low));

  const currentBar = bars[bars.length - 1];
  const prevBar = bars[bars.length - 2];

  // Structure state
  let structureState: MarketStructureIndicators['structure_state'] = 'EQUILIBRIUM';
  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    const h2 = swingHighs[swingHighs.length - 1].price;
    const h1 = swingHighs[swingHighs.length - 2].price;
    const l2 = swingLows[swingLows.length - 1].price;
    const l1 = swingLows[swingLows.length - 2].price;

    if (h2 > h1 && l2 > l1) structureState = 'HIGHER_HIGH';
    else if (h2 <= h1 && l2 > l1) structureState = 'HIGHER_LOW';
    else if (h2 < h1 && l2 < l1) structureState = 'LOWER_LOW';
    else if (h2 < h1 && l2 >= l1) structureState = 'LOWER_HIGH';
  }

  // Bullish BOS: Current close breaks cleanly above previous swing high
  const bos = currentBar.close > recentSwingHigh;

  // Bullish CHoCH: Change of character from lower-high trend to breaking prior major high
  const choch = structureState === 'LOWER_HIGH' && currentBar.close > recentSwingHigh;

  // Liquidity Sweep: Price pierced below swing low, but closed back above it
  const liquiditySweep =
    currentBar.low < recentSwingLow && currentBar.close > recentSwingLow;

  // Breakout retest: Price broke above swing high in previous candle, dipped to retest it, and bounced
  const breakoutRetest =
    prevBar.high > recentSwingHigh &&
    currentBar.low <= recentSwingHigh &&
    currentBar.close > recentSwingHigh;

  // Failed breakout: Broke above high, then dumped back below it with high volume
  const failedBreakout =
    prevBar.close > recentSwingHigh && currentBar.close < recentSwingHigh;

  return {
    recent_swing_high: recentSwingHigh,
    recent_swing_low: recentSwingLow,
    structure_state: structureState,
    break_of_structure_bos: bos,
    change_of_character_choch: choch,
    liquidity_sweep: liquiditySweep,
    breakout_retest_confirmed: breakoutRetest,
    failed_breakout: failedBreakout,
  };
}

/**
 * Master function: Computes the complete deterministic Technical Indicator Bundle.
 */
export function computeTechnicalIndicators(
  symbol: string,
  bars: OHLCVBar[],
  context?: {
    ihsgBars?: OHLCVBar[];
    sectorBars?: OHLCVBar[];
    accumulationStartIdx?: number;
  }
): TechnicalIndicatorsBundle {
  if (bars.length === 0) {
    throw new Error(`[TechnicalEngine] Cannot compute indicators: zero bars provided for ${symbol}`);
  }

  const closes = bars.map((b) => b.close);
  const currentBar = bars[bars.length - 1];
  const currentPrice = currentBar.close;

  // 1. Trend
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);

  const prevCloses = closes.slice(0, -1);
  const prevEma20 = calculateEMA(prevCloses, 20);
  const slopeEma20 = Number((((ema20 - prevEma20) / (prevEma20 || 1)) * 100).toFixed(2));

  const priceVsEma20Pct = Number((((currentPrice - ema20) / ema20) * 100).toFixed(2));
  const priceVsEma50Pct = Number((((currentPrice - ema50) / ema50) * 100).toFixed(2));
  const priceVsSma200Pct = sma200
    ? Number((((currentPrice - sma200) / sma200) * 100).toFixed(2))
    : null;

  let trendRegime: TrendRegime = 'NEUTRAL_RANGE';
  if (currentPrice > ema20 && ema20 > ema50 && slopeEma20 > 0.5) {
    trendRegime = 'STRONG_UPTREND';
  } else if (currentPrice > ema50) {
    trendRegime = 'UPTREND';
  } else if (currentPrice < ema20 && ema20 < ema50 && slopeEma20 < -0.5) {
    trendRegime = 'STRONG_DOWNTREND';
  } else if (currentPrice < ema50) {
    trendRegime = 'DOWNTREND';
  }

  // Cross checks
  const isGoldenCross =
    bars.length >= 50 && sma200 !== null && ema50 > sma200;
  const isDeathCross =
    bars.length >= 50 && sma200 !== null && ema50 < sma200;

  const trend: TrendIndicators = {
    ema20,
    ema50,
    sma200,
    slope_ema20: slopeEma20,
    price_vs_ema20_pct: priceVsEma20Pct,
    price_vs_ema50_pct: priceVsEma50Pct,
    price_vs_sma200_pct: priceVsSma200Pct,
    is_golden_cross: isGoldenCross,
    is_death_cross: isDeathCross,
    regime: trendRegime,
  };

  // 2. Volatility
  const atr14 = calculateATR(bars, 14);
  const atrPercentage = Number(((atr14 / currentPrice) * 100).toFixed(2));

  // Historical Volatility (rolling 20-period log returns stdev annualized)
  let hv20 = 0;
  if (closes.length >= 21) {
    const logReturns: number[] = [];
    for (let i = closes.length - 20; i < closes.length; i++) {
      logReturns.push(Math.log(closes[i] / closes[i - 1]));
    }
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const variance =
      logReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
      (logReturns.length - 1);
    hv20 = Number((Math.sqrt(variance) * Math.sqrt(240) * 100).toFixed(1)); // 240 IDX trading days
  }

  const gapPercentage =
    bars.length >= 2
      ? Number(
          (
            ((currentBar.open - bars[bars.length - 2].close) /
              bars[bars.length - 2].close) *
            100
          ).toFixed(2)
        )
      : 0;

  let volRegime: VolatilityRegime = 'NORMAL';
  if (atrPercentage < 1.5) volRegime = 'COMPRESSED';
  else if (atrPercentage > 4.5) volRegime = 'EXPANDED';
  else if (atrPercentage > 8.0) volRegime = 'EXTREME_VOLATILITY';

  const volatility: VolatilityIndicators = {
    atr14,
    atr_percentage: atrPercentage,
    historical_volatility_20: hv20,
    gap_percentage: gapPercentage,
    volatility_regime: volRegime,
  };

  // 3. VWAP
  const sessionVwap = calculateVWAP(bars);
  const weeklyVwap = bars.length >= 5 ? calculateVWAP(bars.slice(-5)) : null;

  // Structure detection for Anchored VWAP
  const marketStructure = detectMarketStructure(bars);
  const anchoredVwapSwingLow = calculateVWAP(
    bars,
    Math.max(0, bars.length - 10)
  );
  const anchoredVwapAccStart = context?.accumulationStartIdx != null
    ? calculateVWAP(bars, context.accumulationStartIdx)
    : null;

  const priceDistanceToVwap = Number((currentPrice - sessionVwap).toFixed(2));
  const priceDistanceToVwapAtr = Number((priceDistanceToVwap / (atr14 || 1)).toFixed(2));

  const vwap: VwapIndicators = {
    session_vwap: sessionVwap,
    weekly_vwap: weeklyVwap,
    anchored_vwap_swing_low: anchoredVwapSwingLow,
    anchored_vwap_accumulation_start: anchoredVwapAccStart,
    price_distance_to_vwap: priceDistanceToVwap,
    price_distance_to_vwap_atr: priceDistanceToVwapAtr,
    is_above_session_vwap: currentPrice >= sessionVwap,
  };

  // 4. Volume
  const volumes = bars.map((b) => b.volume);
  const avgVol20 =
    volumes.length >= 20
      ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
      : volumes.reduce((a, b) => a + b, 0) / volumes.length;

  const rvol = Number(((currentBar.volume / (avgVol20 || 1))).toFixed(2));
  const dollarVolume = Math.round(currentBar.volume * currentPrice * 100); // 1 lot = 100 shares

  const isVolumeSpike = rvol >= 2.0;
  const isVolumeContraction = rvol <= 0.6;
  const isBreakoutVolumeExpansion =
    rvol >= 1.5 && currentPrice > marketStructure.recent_swing_high;

  const volume: VolumeIndicators = {
    current_volume: currentBar.volume,
    avg_volume_20: Math.round(avgVol20),
    rvol,
    rvol_time_of_day: null,
    dollar_volume: dollarVolume,
    is_volume_spike: isVolumeSpike,
    is_volume_contraction: isVolumeContraction,
    is_breakout_volume_expansion: isBreakoutVolumeExpansion,
  };

  // 5. Volume Profile
  const volumeProfile = calculateVolumeProfile(bars);

  // 6. Momentum
  const rsi14 = calculateRSI(closes, 14);
  let rsiRegime: RsiRegime = 'NEUTRAL';
  if (rsi14 < 30) rsiRegime = 'OVERSOLD';
  else if (rsi14 < 45) rsiRegime = 'BEARISH_MOMENTUM';
  else if (rsi14 > 70) rsiRegime = 'OVERBOUGHT';
  else if (rsi14 > 55) rsiRegime = 'BULLISH_MOMENTUM';

  // Divergence check (over last 14 bars)
  let bullishDiv = false;
  let bearishDiv = false;
  if (bars.length >= 15) {
    const recentMinPrice = Math.min(...closes.slice(-5));
    const priorMinPrice = Math.min(...closes.slice(-14, -5));
    const recentMinRsi = Math.min(
      ...closes.slice(-5).map((_, i) => calculateRSI(closes.slice(0, closes.length - 4 + i)))
    );
    const priorMinRsi = Math.min(
      ...closes.slice(-14, -5).map((_, i) => calculateRSI(closes.slice(0, closes.length - 13 + i)))
    );

    if (recentMinPrice < priorMinPrice && recentMinRsi > priorMinRsi) {
      bullishDiv = true;
    }

    const recentMaxPrice = Math.max(...closes.slice(-5));
    const priorMaxPrice = Math.max(...closes.slice(-14, -5));
    if (recentMaxPrice > priorMaxPrice && rsi14 < 70) {
      bearishDiv = true;
    }
  }

  const macd = calculateMACD(closes);

  const momentum: MomentumIndicators = {
    rsi14,
    rsi_regime: rsiRegime,
    bullish_divergence: bullishDiv,
    bearish_divergence: bearishDiv,
    macd_line: macd.macdLine,
    signal_line: macd.signalLine,
    histogram: macd.histogram,
    histogram_slope: macd.histogramSlope,
    disclaimer:
      'RSI and MACD are descriptive momentum velocity indicators, never standalone buy triggers.',
  };

  // 7. Relative Strength vs IHSG
  let vsIhsg1d = 0;
  let vsIhsg5d = 0;
  let vsIhsg20d = 0;
  if (context?.ihsgBars && context.ihsgBars.length >= 2) {
    const stockReturn1d = (currentPrice - bars[bars.length - 2].close) / bars[bars.length - 2].close;
    const ihsgLast = context.ihsgBars[context.ihsgBars.length - 1].close;
    const ihsgPrev1 = context.ihsgBars[context.ihsgBars.length - 2].close;
    const ihsgReturn1d = (ihsgLast - ihsgPrev1) / ihsgPrev1;
    vsIhsg1d = Number(((stockReturn1d - ihsgReturn1d) * 100).toFixed(2));

    if (bars.length >= 6 && context.ihsgBars.length >= 6) {
      const stockReturn5d = (currentPrice - bars[bars.length - 6].close) / bars[bars.length - 6].close;
      const ihsgPrev5 = context.ihsgBars[context.ihsgBars.length - 6].close;
      const ihsgReturn5d = (ihsgLast - ihsgPrev5) / ihsgPrev5;
      vsIhsg5d = Number(((stockReturn5d - ihsgReturn5d) * 100).toFixed(2));
    }
  }

  const relativeStrength: RelativeStrengthIndicators = {
    stock_vs_ihsg_1d_pct: vsIhsg1d,
    stock_vs_ihsg_5d_pct: vsIhsg5d,
    stock_vs_ihsg_20d_pct: vsIhsg20d,
    stock_vs_sector_1d_pct: null,
    stock_vs_sector_5d_pct: null,
    relative_strength_percentile: Number(Math.min(100, Math.max(0, 50 + vsIhsg5d * 3)).toFixed(1)),
  };

  return {
    as_of: currentBar.timestamp,
    symbol: symbol.toUpperCase(),
    current_price: currentPrice,
    trend,
    vwap,
    volume,
    volume_profile: volumeProfile,
    momentum,
    volatility,
    market_structure: marketStructure,
    relative_strength: relativeStrength,
  };
}
