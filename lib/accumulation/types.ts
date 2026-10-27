/**
 * lib/accumulation/types.ts
 * Types for Accumulation Proxy Engine (SmartMoney AI)
 * 
 * DISCLAIMER & REGULATORY MANDATE:
 * This module does not determine the true identity or intention of market operators.
 * It strictly estimates whether current market activity exhibits statistical patterns
 * resembling institutional accumulation or distribution behaviors observed historically.
 */

export type FlowState =
  | 'accumulation_like'
  | 'distribution_like'
  | 'neutral'
  | 'inconclusive';

export type CalibratedProbabilityStatus =
  | 'calibrated'
  | 'provisional'
  | 'unavailable';

export interface BrokerTransactionRecord {
  broker_code: string;
  buy_volume: number; // in shares or lots
  sell_volume: number;
  buy_value: number; // in IDR
  sell_value: number; // in IDR
  average_buy_price: number;
  average_sell_price: number;
  net_buy_value: number; // buy_value - sell_value
  net_buy_volume: number; // buy_volume - sell_volume
}

export interface DailyBrokerSnapshot {
  date: string; // YYYY-MM-DD
  close_price: number;
  transactions: BrokerTransactionRecord[];
}

export interface OrderBookDepthItem {
  price: number;
  volume: number;
}

export interface OrderBookDepthSnapshot {
  timestamp: string;
  bids: OrderBookDepthItem[];
  asks: OrderBookDepthItem[];
  spread: number;
  spread_pct: number;
}

export interface AccumulationProxyResult {
  as_of: string;
  symbol: string;
  model_version: string;
  flow_state: FlowState;
  accumulation_proxy_score: number; // 0 to 100 (Ordinal Ranking Score)
  p_accumulation_like: number | null; // Calibrated probability (0 to 1) or null
  p_accumulation_like_status: CalibratedProbabilityStatus;
  confidence_interval_95: [number, number] | null;
  
  // Core Quantitative Metrics
  net_flow_value: number; // IDR net flow
  net_flow_ratio: number; // -1.0 to +1.0
  persistence: number; // 0.0 to 1.0 (fraction of net-positive buy days)
  flow_concentration_hhi: number; // 0 to 10000 (Herfindahl-Hirschman Index)
  top_buyer_concentration_cr3: number; // 0 to 100%
  flow_vwap_proxy: number; // Weighted Net-Buy Price Proxy (DO NOT call 'modal bandar')
  
  // Microstructure Indicators
  price_acceptance: {
    is_above_flow_vwap: boolean;
    price_to_flow_vwap_pct: number;
    pullback_volume_ratio: number;
    reclaim_volume_ratio: number;
  };
  order_flow: {
    type: 'TRUE_DELTA' | 'PROXY_NOT_TRUE_DELTA';
    estimated_delta: number;
    imbalance_depth_5: number; // -1.0 to +1.0
  };
  absorption: {
    is_absorption_detected: boolean;
    evidence: string | null;
  };
  
  // Evidence & Auditability
  supporting_evidence: string[];
  contradictory_evidence: string[];
  missing_data: string[];
  disclaimer: string;
}
