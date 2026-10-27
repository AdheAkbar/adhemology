/**
 * lib/targets/target-engine.ts - Dynamic Target & Invalidation Engine V2 (Adimology V6)
 * PRD V6 Phase 6: Multi-Target Ladder, Volatility-Grounded Invalidation, and RRR Validation.
 */

import { getFraksi } from '../calculations';
import type { TargetLadder, TargetEngineInput } from './types';

/**
 * Rounds a price to a valid IDX tick boundary according to official price fraction rules.
 */
export function roundToFraksi(
  price: number,
  direction: 'UP' | 'DOWN' | 'NEAREST' = 'NEAREST'
): number {
  if (price <= 0) return 0;
  const fraksi = getFraksi(price);

  if (direction === 'DOWN') {
    return Math.floor(price / fraksi) * fraksi;
  }
  if (direction === 'UP') {
    return Math.ceil(price / fraksi) * fraksi;
  }
  return Math.round(price / fraksi) * fraksi;
}

/**
 * Calculates legacy Adimology targets for baseline benchmarking.
 */
export function calculateLegacyAdimologyBaseline(input: TargetEngineInput): {
  targetRealistis: number;
  targetMax: number;
} {
  const harga = input.current_price;
  const rataRataBandar = input.rata_rata_bandar || input.bandar_vwap || harga;
  const barangBandar = input.barang_bandar || 10000;
  const ara = input.ara || Math.round(harga * 1.25);
  const arb = input.arb || Math.round(harga * 0.75);
  const totalBid = input.total_bid || 50000;
  const totalOffer = input.total_offer || 50000;

  const fraksi = getFraksi(harga);
  const totalPapan = Math.max(1, (ara - arb) / fraksi);
  const rataRataBidOfer = Math.max(1, (totalBid + totalOffer) / totalPapan);
  const a = rataRataBandar * 0.05;
  const p = barangBandar / rataRataBidOfer;

  const targetRealistis1 = roundToFraksi(rataRataBandar + a + (p / 2) * fraksi, 'NEAREST');
  const targetMax = roundToFraksi(rataRataBandar + a + p * fraksi, 'NEAREST');

  return { targetRealistis: targetRealistis1, targetMax };
}

/**
 * Dynamic Target & Invalidation Engine V2.
 * Calculates an objective multi-target ladder (T1, T2, T_max) and volatility-anchored Invalidation level.
 * Guarantees every barrier sits on an authentic IDX fraksi tick boundary.
 */
export function calculateDynamicTargetsV2(input: TargetEngineInput): TargetLadder {
  const p0 = input.current_price;
  const fraksi = getFraksi(p0);

  // Compute legacy baseline control
  const legacy = calculateLegacyAdimologyBaseline(input);

  // Effective ATR: if omitted, default to 2.5% of current price
  const effectiveAtr = input.atr && input.atr > 0 ? input.atr : Math.max(fraksi, Math.round(p0 * 0.025));

  // Determine Invalidation Barrier (Stop Loss)
  // Structural support candidates:
  // 1. Swing Low (if provided)
  // 2. Bandar VWAP support (modal bandar minus 1 fraksi)
  // 3. Volatility buffer (p0 - 1.5 * ATR)
  const vwapSupport = input.bandar_vwap ? input.bandar_vwap - fraksi : null;
  const atrSupport = p0 - 1.5 * effectiveAtr;

  let rawInvalidation = atrSupport;
  if (input.recent_swing_low && input.recent_swing_low < p0) {
    // Position slightly below swing low
    rawInvalidation = Math.min(input.recent_swing_low - fraksi, atrSupport);
  } else if (vwapSupport && vwapSupport < p0) {
    rawInvalidation = Math.min(vwapSupport, atrSupport);
  }

  // Bound invalidation by ARB if provided
  if (input.arb && input.arb > 0) {
    rawInvalidation = Math.max(input.arb, rawInvalidation);
  }

  // Ensure invalidation is strictly below entry price by at least 1 fraksi
  const maxAllowableInvalidation = p0 - fraksi;
  const invalidationPrice = roundToFraksi(
    Math.min(maxAllowableInvalidation, Math.max(1, rawInvalidation)),
    'DOWN'
  );

  const riskAmount = p0 - invalidationPrice;

  // Determine Target Ladder
  // T1 (Realistic / Base Target): 1.5x Risk, rounded UP to fraksi
  const rawT1 = p0 + Math.max(fraksi, Math.round(riskAmount * 1.5));
  const t1Realistic = roundToFraksi(rawT1, 'UP');

  // T2 (Stretch Target): 2.5x Risk
  const rawT2 = p0 + Math.max(2 * fraksi, Math.round(riskAmount * 2.5));
  let t2Stretch = roundToFraksi(rawT2, 'UP');

  // T_max: Structural ceiling (Recent Swing High, ARA, or Legacy Max)
  let rawTMax = legacy.targetMax;
  if (input.recent_swing_high && input.recent_swing_high > p0) {
    rawTMax = Math.max(rawTMax, input.recent_swing_high);
  }
  if (input.ara && input.ara > p0) {
    rawTMax = Math.min(input.ara, Math.max(t2Stretch + fraksi, rawTMax));
  }
  const tMax = roundToFraksi(Math.max(t2Stretch + fraksi, rawTMax), 'UP');

  // If ARA is active, clamp all targets to not exceed ARA
  if (input.ara && input.ara > p0) {
    t2Stretch = Math.min(input.ara, t2Stretch);
  }

  const rewardAmount = t1Realistic - p0;
  const rrr = riskAmount > 0 ? Number((rewardAmount / riskAmount).toFixed(2)) : 0;
  const isRrrAcceptable = rrr >= 1.5;

  const rationale = `Invalidation at ${invalidationPrice} (${((riskAmount / p0) * 100).toFixed(1)}% risk) anchored to ATR/support. T1 at ${t1Realistic} offers ${rrr}x RRR. Legacy Adimology baseline: ${legacy.targetRealistis}.`;

  return {
    t1_realistic: t1Realistic,
    t2_stretch: t2Stretch,
    t_max: tMax,
    invalidation_price: invalidationPrice,
    legacy_adimology_target: legacy.targetRealistis,
    legacy_adimology_max: legacy.targetMax,
    risk_reward_ratio: rrr,
    is_rrr_acceptable: isRrrAcceptable,
    fraksi,
    effective_atr: effectiveAtr,
    risk_amount: riskAmount,
    reward_amount: rewardAmount,
    rationale,
  };
}
