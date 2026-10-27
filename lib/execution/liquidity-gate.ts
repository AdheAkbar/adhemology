/**
 * lib/execution/liquidity-gate.ts - Execution & Liquidity Gate V2 (Adimology V6)
 * PRD V6 Phase 7: Turnover Sizing, Spread/Slippage Modeling, and Liquidity Gating.
 */

import { getFraksi } from '../calculations';
import type { LiquidityAssessment, LiquidityEngineInput, LiquidityRating } from './types';

export const PARTICIPATION_RATE_LIMIT = 0.02; // 2% of Average Daily Turnover (ADT)
export const MIN_ADT_TRADABLE_IDR = 200_000_000; // 200 Juta IDR minimum ADT to be tradable
export const HIGH_LIQUIDITY_ADT_IDR = 10_000_000_000; // 10 Miliar IDR
export const MODERATE_LIQUIDITY_ADT_IDR = 1_000_000_000; // 1 Miliar IDR

/**
 * Evaluates liquidity, turnover sizing, bid-ask spread, and estimated slippage
 * for an IDX emiten based on authentic market microstructure rules.
 */
export function assessLiquidityAndExecution(input: LiquidityEngineInput): LiquidityAssessment {
  const price = Math.max(1, input.current_price);
  const fraksi = getFraksi(price);

  // ADT in IDR (default to 1 Miliar if omitted)
  const adt = input.average_daily_turnover_idr !== undefined && input.average_daily_turnover_idr !== null
    ? input.average_daily_turnover_idr
    : 1_000_000_000;

  // Turnover-based capacity (2% participation rate cap)
  const maxPositionSizeIdr = Math.round(adt * PARTICIPATION_RATE_LIMIT);
  const pricePerLot = price * 100;
  const maxPositionLots = Math.max(0, Math.floor(maxPositionSizeIdr / pricePerLot));

  // Determine Bid-Ask Spread
  let bestBid = input.best_bid && input.best_bid > 0 ? input.best_bid : price;
  let bestOffer = input.best_offer && input.best_offer > 0 ? input.best_offer : price + fraksi;

  if (bestOffer <= bestBid) {
    bestOffer = bestBid + fraksi;
  }

  const spreadIdr = bestOffer - bestBid;
  const spreadTicks = Math.max(1, Math.round(spreadIdr / fraksi));
  const spreadPct = Number(((spreadIdr / bestBid) * 100).toFixed(2));

  // Slippage Modeling:
  // Base slippage is half the spread in percentage
  let baseSlippagePct = spreadPct / 2;

  // Impact penalty if desired order size is provided and exceeds available top-of-book depth
  let impactPenaltyPct = 0;
  if (input.desired_order_size_idr && input.desired_order_size_idr > 0) {
    const desiredLots = Math.ceil(input.desired_order_size_idr / pricePerLot);
    const availableOfferLots = input.offer_depth_lots && input.offer_depth_lots > 0 ? input.offer_depth_lots : 1000;
    
    if (desiredLots > availableOfferLots) {
      // Order sweeps multiple levels: penalty proportional to queue excess
      const sweepRatio = desiredLots / availableOfferLots;
      impactPenaltyPct = Math.min(5.0, (sweepRatio - 1) * (fraksi / price) * 100);
    }
  }

  const estimatedSlippagePct = Number((baseSlippagePct + impactPenaltyPct).toFixed(2));

  // Determine Liquidity Rating & Gating
  let liquidityRating: LiquidityRating = 'MODERATE_LIQUIDITY';
  let isTradable = true;
  let gateReason = 'Liquid and tradable within normal risk limits.';

  if (adt < MIN_ADT_TRADABLE_IDR || spreadTicks > 8 || spreadPct > 5.0) {
    liquidityRating = 'ILLIQUID_GATED';
    isTradable = false;
    gateReason = `Execution Gated: ADT Rp ${(adt / 1e6).toFixed(0)}M or spread (${spreadTicks} ticks / ${spreadPct}%) exceeds safety thresholds.`;
  } else if (adt < MODERATE_LIQUIDITY_ADT_IDR || spreadTicks > 4 || spreadPct > 2.5) {
    liquidityRating = 'LOW_LIQUIDITY_WARNING';
    isTradable = true;
    gateReason = `Caution: Thin liquidity. ADT Rp ${(adt / 1e6).toFixed(0)}M. Cap position to max ${maxPositionLots} lots to prevent adverse price impact.`;
  } else if (adt >= HIGH_LIQUIDITY_ADT_IDR && spreadTicks <= 2 && spreadPct <= 1.0) {
    liquidityRating = 'HIGH_LIQUIDITY';
    isTradable = true;
    gateReason = `Institutional Liquidity: ADT Rp ${(adt / 1e9).toFixed(1)}B with tight ${spreadTicks} tick spread. Highly tradable.`;
  } else {
    liquidityRating = 'MODERATE_LIQUIDITY';
    isTradable = true;
    gateReason = `Moderate Liquidity: ADT Rp ${(adt / 1e9).toFixed(2)}B, spread ${spreadTicks} ticks (${spreadPct}%). Max safe position: ${maxPositionLots} lots.`;
  }

  return {
    emiten: input.emiten,
    current_price: price,
    average_daily_turnover_idr: adt,
    max_position_size_idr: maxPositionSizeIdr,
    max_position_lots: maxPositionLots,
    spread_ticks: spreadTicks,
    spread_pct: spreadPct,
    estimated_slippage_pct: estimatedSlippagePct,
    liquidity_rating: liquidityRating,
    is_tradable: isTradable,
    gate_reason: gateReason,
  };
}
