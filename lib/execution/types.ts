/**
 * lib/execution/types.ts - Execution & Liquidity Gate V2 Types (Adimology V6)
 * PRD V6 Phase 7: Turnover Sizing, Spread/Slippage Modeling, and Liquidity Gating.
 */

export type LiquidityRating =
  | 'HIGH_LIQUIDITY'
  | 'MODERATE_LIQUIDITY'
  | 'LOW_LIQUIDITY_WARNING'
  | 'ILLIQUID_GATED';

export interface OrderbookQueueLevel {
  price: number;
  lot: number;
  val?: number;
}

export interface LiquidityAssessment {
  emiten: string;
  current_price: number;
  average_daily_turnover_idr: number;
  max_position_size_idr: number; // 2% participation limit
  max_position_lots: number;
  spread_ticks: number;
  spread_pct: number;
  estimated_slippage_pct: number;
  liquidity_rating: LiquidityRating;
  is_tradable: boolean;
  gate_reason: string;
}

export interface LiquidityEngineInput {
  emiten: string;
  current_price: number;
  average_daily_turnover_idr?: number | null;
  best_bid?: number | null;
  best_offer?: number | null;
  bid_depth_lots?: number | null;
  offer_depth_lots?: number | null;
  desired_order_size_idr?: number | null;
}
