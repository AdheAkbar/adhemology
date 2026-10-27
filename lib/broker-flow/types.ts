/**
 * lib/broker-flow/types.ts - Hybrid Broker Flow Engine Types (Adimology V6)
 * PRD V6 Phase 5: IDX Post-Dec 2021 Regulation, Multi-Window ADI, and Bandar Cost Basis.
 */

import type { DataMode } from '../data-truth/types';

export type FlowRegime =
  | 'STRONG_ACCUMULATION'
  | 'MILD_ACCUMULATION'
  | 'NEUTRAL'
  | 'MILD_DISTRIBUTION'
  | 'STRONG_DISTRIBUTION';

export interface ConcentrationRatio {
  buyer_cr1: number; // % of total buy value from top 1 buyer
  buyer_cr3: number; // % of total buy value from top 3 buyers
  buyer_cr5: number; // % of total buy value from top 5 buyers
  seller_cr1: number; // % of total sell value from top 1 seller
  seller_cr3: number; // % of total sell value from top 3 sellers
  seller_cr5: number; // % of total sell value from top 5 sellers
  net_cr3_spread: number; // buyer_cr3 - seller_cr3
}

export interface BandarCostBasis {
  bandar_vwap: number;
  market_price: number;
  deviation_pct: number; // ((market_price - bandar_vwap) / bandar_vwap) * 100
  retail_positioning: 'BELOW_BANDAR_COST' | 'NEAR_BANDAR_COST' | 'ABOVE_BANDAR_COST';
}

export interface IntradayFlowProxy {
  bid_offer_imbalance: number; // -1.0 (all offer) to +1.0 (all bid)
  total_bid_lot: number;
  total_offer_lot: number;
  large_block_ratio?: number; // 0.0 to 1.0 (ratio of volume executed in large blocks)
  proxy_regime: FlowRegime;
}

export interface WindowFlowMetric {
  window: '1D' | '7D' | '14D' | '21D';
  net_value: number;
  accumulation_intensity: number; // -1.0 to +1.0
  flow_regime: FlowRegime;
  top_buyer_codes: string[];
  top_seller_codes: string[];
}

export interface HybridFlowReport {
  emiten: string;
  as_of: string;
  data_mode: DataMode;
  current_price: number;
  overall_regime: FlowRegime;
  accumulation_intensity: number; // -1.0 (extreme distribution) to +1.0 (extreme accumulation)
  concentration: ConcentrationRatio;
  cost_basis: BandarCostBasis;
  intraday_proxy?: IntradayFlowProxy | null;
  windows?: Partial<Record<'1D' | '7D' | '14D' | '21D', WindowFlowMetric>>;
}

export interface HybridFlowMetrics {
  regime: FlowRegime;
  eod_broker_net_value: number;
  top_accumulators: string[];
  top_distributors: string[];
  orderbook_imbalance_ratio?: number;
  large_block_active_buyer?: boolean;
  composite_flow_score?: number;
  summary_text?: string;
}

