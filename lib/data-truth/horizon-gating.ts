/**
 * lib/data-truth/horizon-gating.ts - Horizon-Specific Gating Engine (Adimology V6)
 * PRD V6 Phase 8: Horizon-Specific Gating against Market Microstructure & Data Modes.
 */

import type { CapabilityName, DataCapabilityMatrix, DataMode, TradingHorizon } from './types';

export interface HorizonGatingResult {
  horizon: TradingHorizon;
  data_mode: DataMode;
  is_allowed: boolean;
  effective_confidence_multiplier: number; // 1.0 (full), 0.75 (degraded), 0.0 (gated)
  gate_reason: string;
  violations: string[];
}

const HORIZON_REQUIREMENTS: Record<TradingHorizon, CapabilityName[]> = {
  INTRADAY_5M: ['quote', 'orderbook'],
  INTRADAY_15M: ['quote', 'orderbook'],
  INTRADAY_60M: ['quote', 'ohlcv_daily'],
  DAILY_SWING: ['ohlcv_daily', 'broker_summary'],
  WEEKLY: ['ohlcv_daily'],
};

/**
 * Validates whether a requested trading horizon is permissible given the active data mode
 * and capability matrix. Prevents generating intraday scalp predictions on static EOD feeds.
 */
export function validateHorizonGating(
  horizon: TradingHorizon,
  dataMode: DataMode,
  matrix: DataCapabilityMatrix
): HorizonGatingResult {
  const violations: string[] = [];

  // Rule 1: Static EOD data mode is strictly barred from intraday horizons
  if (dataMode === 'EOD_STATIC' || dataMode === 'EOD_HISTORICAL') {
    if (horizon === 'INTRADAY_5M' || horizon === 'INTRADAY_15M' || horizon === 'INTRADAY_60M') {
      violations.push(
        `Data mode '${dataMode}' does not support '${horizon}'. Intraday trading requires real-time quotes and live orderbook depth.`
      );
    }
  }

  // Rule 2: Verify required capabilities for the horizon
  const requiredCaps = HORIZON_REQUIREMENTS[horizon] || [];
  let hasDegraded = false;

  for (const capName of requiredCaps) {
    const entry = matrix[capName];
    if (!entry) {
      violations.push(`Required capability '${capName}' is missing from system matrix.`);
      continue;
    }

    if (entry.state === 'UNAVAILABLE' || entry.state === 'DISABLED') {
      violations.push(`Capability '${capName}' is unavailable: ${entry.reason_code}`);
    } else if (entry.state === 'DEGRADED') {
      hasDegraded = true;
    }

    if (!entry.usable_horizons.includes(horizon)) {
      violations.push(
        `Capability '${capName}' does not support horizon '${horizon}'. Supported: [${entry.usable_horizons.join(', ')}]`
      );
    }
  }

  if (violations.length > 0) {
    return {
      horizon,
      data_mode: dataMode,
      is_allowed: false,
      effective_confidence_multiplier: 0.0,
      gate_reason: `Horizon Gated: ${violations[0]}`,
      violations,
    };
  }

  if (hasDegraded) {
    return {
      horizon,
      data_mode: dataMode,
      is_allowed: true,
      effective_confidence_multiplier: 0.75,
      gate_reason: `Permitted with penalty: One or more data capabilities for '${horizon}' are degraded. Confidence scaled to 75%.`,
      violations: [],
    };
  }

  return {
    horizon,
    data_mode: dataMode,
    is_allowed: true,
    effective_confidence_multiplier: 1.0,
    gate_reason: `Fully validated: All required data capabilities for '${horizon}' are active and fresh in '${dataMode}' mode.`,
    violations: [],
  };
}
