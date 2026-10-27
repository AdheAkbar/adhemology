/**
 * lib/data-truth/capability-matrix.ts - Data Capability Matrix (Adimology V6)
 * PRD V6 Phase 1: Explicit tracking of 14 market capabilities, providers, and horizon constraints.
 */

import type {
  CapabilityName,
  CapabilityEntry,
  DataCapabilityMatrix,
  TradingHorizon,
  CapabilityState,
} from './types';

/**
 * Builds the current capability matrix based on runtime provider availability.
 */
export function buildCapabilityMatrix(options?: {
  hasStockbitToken?: boolean;
  hasGeminiKey?: boolean;
  lastStockbitSuccess?: string | null;
  tokenFreshnessSec?: number | null;
}): DataCapabilityMatrix {
  const hasToken = options?.hasStockbitToken ?? false;
  const hasGemini = options?.hasGeminiKey ?? false;
  const tokenState: CapabilityState = hasToken ? 'READY' : 'UNAVAILABLE';
  const tokenReason = hasToken ? 'OK' : 'TOKEN_EXPIRED';
  const lastSuccess = options?.lastStockbitSuccess ?? (hasToken ? new Date().toISOString() : null);
  const freshness = options?.tokenFreshnessSec ?? (hasToken ? 30 : null);

  return {
    // 1. Live Quote / Current Price
    quote: {
      name: 'quote',
      state: tokenState,
      source: 'STOCKBIT_ORDERBOOK',
      last_success_at: lastSuccess,
      freshness_sec: freshness,
      usable_horizons: ['INTRADAY_5M', 'INTRADAY_15M', 'INTRADAY_60M', 'DAILY_SWING'],
      reason_code: tokenReason,
    },

    // 2. Daily OHLCV Bars
    ohlcv_daily: {
      name: 'ohlcv_daily',
      state: 'READY',
      source: 'TRADINGVIEW_WIDGET_FEED',
      last_success_at: new Date().toISOString(),
      freshness_sec: 60,
      usable_horizons: ['DAILY_SWING', 'WEEKLY'],
      reason_code: 'OK',
    },

    // 3. Intraday OHLCV Bars (5m, 15m, 60m)
    ohlcv_intraday: {
      name: 'ohlcv_intraday',
      state: 'DEGRADED',
      source: 'TRADINGVIEW_WIDGET_FEED',
      last_success_at: new Date().toISOString(),
      freshness_sec: 120,
      usable_horizons: ['INTRADAY_15M', 'INTRADAY_60M'],
      reason_code: 'DEGRADED: Limited programmatic tick access via public widget',
    },

    // 4. Broker Summary (Top Buyers/Sellers by Net Value)
    broker_summary: {
      name: 'broker_summary',
      state: tokenState,
      source: 'STOCKBIT_EXODUS_MARKETDETECTOR',
      last_success_at: lastSuccess,
      freshness_sec: freshness,
      usable_horizons: ['DAILY_SWING', 'WEEKLY'],
      reason_code: tokenReason,
    },

    // 5. Broker Running Trade (Completed Daily Heatmap)
    broker_running_trade: {
      name: 'broker_running_trade',
      state: tokenState,
      source: 'STOCKBIT_EXODUS_RUNNING_TRADE_CHART',
      last_success_at: lastSuccess,
      freshness_sec: freshness,
      usable_horizons: ['DAILY_SWING'],
      reason_code: hasToken ? 'OK' : 'TOKEN_EXPIRED',
    },

    // 6. Broker Flow Intraday (Tick-by-tick broker attribution during session)
    broker_flow_intraday: {
      name: 'broker_flow_intraday',
      state: 'DISABLED',
      source: 'IDX_CLOSED_SESSION_REGULATION',
      last_success_at: null,
      freshness_sec: null,
      usable_horizons: [],
      reason_code: 'DISABLED: Broker codes are closed by IDX during market hours since Dec 2021',
    },

    // 7. Order Book Depth (L2 Bids/Offers)
    orderbook: {
      name: 'orderbook',
      state: tokenState,
      source: 'STOCKBIT_EXODUS_ORDERBOOK',
      last_success_at: lastSuccess,
      freshness_sec: freshness,
      usable_horizons: ['INTRADAY_5M', 'INTRADAY_15M', 'INTRADAY_60M'],
      reason_code: tokenReason,
    },

    // 8. Trade Tape / Running Trade Prints
    trade_tape: {
      name: 'trade_tape',
      state: 'DEGRADED',
      source: 'STOCKBIT_TRADE_FEED',
      last_success_at: lastSuccess,
      freshness_sec: freshness,
      usable_horizons: ['INTRADAY_5M'],
      reason_code: 'DEGRADED: Snapshot stream rather than websocket tick stream',
    },

    // 9. Benchmark Index (IHSG / COMPOSITE)
    index: {
      name: 'index',
      state: 'READY',
      source: 'TRADINGVIEW_IDX_COMPOSITE',
      last_success_at: new Date().toISOString(),
      freshness_sec: 60,
      usable_horizons: ['INTRADAY_60M', 'DAILY_SWING'],
      reason_code: 'OK',
    },

    // 10. Market Breadth (% advancing, declining, unch)
    market_breadth: {
      name: 'market_breadth',
      state: 'DEGRADED',
      source: 'DERIVED_WATCHLIST_AGGREGATE',
      last_success_at: lastSuccess,
      freshness_sec: freshness,
      usable_horizons: ['DAILY_SWING'],
      reason_code: 'DEGRADED: Derived from sampled watchlist rather than 900+ emiten full tape',
    },

    // 11. Sectoral Relative Strength
    sector: {
      name: 'sector',
      state: tokenState,
      source: 'STOCKBIT_COMPANY_PROFILE',
      last_success_at: lastSuccess,
      freshness_sec: freshness,
      usable_horizons: ['DAILY_SWING', 'WEEKLY'],
      reason_code: tokenReason,
    },

    // 12. Company Fundamentals & Valuation
    fundamental: {
      name: 'fundamental',
      state: tokenState,
      source: 'STOCKBIT_KEY_STATS',
      last_success_at: lastSuccess,
      freshness_sec: freshness,
      usable_horizons: ['DAILY_SWING', 'WEEKLY'],
      reason_code: tokenReason,
    },

    // 13. News & Real-Time Intelligence
    news: {
      name: 'news',
      state: hasGemini ? 'READY' : 'DEGRADED',
      source: hasGemini ? 'GEMINI_SEARCH_GROUNDING' : 'STOCKBIT_NEWS_FEED',
      last_success_at: new Date().toISOString(),
      freshness_sec: 300,
      usable_horizons: ['DAILY_SWING', 'WEEKLY'],
      reason_code: hasGemini ? 'OK' : 'DEGRADED: Gemini API key missing, relying on raw feed',
    },

    // 14. Corporate Actions (Dividends, Rights Issue, RUPS)
    corporate_action: {
      name: 'corporate_action',
      state: tokenState,
      source: 'STOCKBIT_COMPANY_PROFILE',
      last_success_at: lastSuccess,
      freshness_sec: freshness,
      usable_horizons: ['DAILY_SWING', 'WEEKLY'],
      reason_code: tokenReason,
    },
  };
}

/**
 * Checks if a specific capability is actionable for a requested trading horizon.
 */
export function isCapabilityActionable(
  matrix: DataCapabilityMatrix,
  capability: CapabilityName,
  requiredHorizon?: TradingHorizon
): boolean {
  const cap = matrix[capability];
  if (!cap) return false;
  if (cap.state !== 'READY' && cap.state !== 'DEGRADED') return false;

  if (requiredHorizon) {
    return cap.usable_horizons.includes(requiredHorizon);
  }

  return true;
}

/**
 * Hard Gate Validation: ensures all required capabilities are satisfied before triggering an actionable trade signal.
 */
export function validateCapabilityGating(
  matrix: DataCapabilityMatrix,
  requiredCapabilities: CapabilityName[],
  requiredHorizon?: TradingHorizon
): {
  isActionable: boolean;
  missingCapabilities: CapabilityName[];
  reasons: string[];
} {
  const missing: CapabilityName[] = [];
  const reasons: string[] = [];

  for (const capName of requiredCapabilities) {
    const entry = matrix[capName];
    if (!entry) {
      missing.push(capName);
      reasons.push(`Capability '${capName}' is not defined in matrix.`);
      continue;
    }

    if (entry.state === 'UNAVAILABLE' || entry.state === 'DISABLED') {
      missing.push(capName);
      reasons.push(`Capability '${capName}' is ${entry.state}: ${entry.reason_code}`);
      continue;
    }

    if (requiredHorizon && !entry.usable_horizons.includes(requiredHorizon)) {
      missing.push(capName);
      reasons.push(
        `Capability '${capName}' does not support horizon '${requiredHorizon}'. Supported: [${entry.usable_horizons.join(', ')}]`
      );
    }
  }

  return {
    isActionable: missing.length === 0,
    missingCapabilities: missing,
    reasons,
  };
}
