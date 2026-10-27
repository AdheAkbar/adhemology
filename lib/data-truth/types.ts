/**
 * lib/data-truth/types.ts - Canonical Data Truth & Provenance Layer (Adimology V6)
 * PRD V6 Phase 1: Explicit Data Envelope and Capability Matrix Types.
 */

export type DataMode =
  | 'LIVE'
  | 'LIVE_AUTHENTIC'
  | 'LIVE_HYBRID'
  | 'DELAYED'
  | 'EOD'
  | 'EOD_STATIC'
  | 'EOD_HISTORICAL'
  | 'STALE'
  | 'UNAVAILABLE'
  | 'DISCONNECTED';

export type QualityStatus =
  | 'CONFIRMED'
  | 'DEGRADED'
  | 'PROVISIONAL'
  | 'SYNTHETIC'
  | 'UNAVAILABLE';

export type ReasonCode =
  | 'OK'
  | 'SOURCE_FIELD_MISSING'
  | 'FEED_DISCONNECTED'
  | 'TOKEN_EXPIRED'
  | 'STALE_THRESHOLD_EXCEEDED'
  | 'SESSION_CLOSED'
  | 'LIMIT_EXCEEDED'
  | 'INSUFFICIENT_HISTORY'
  | 'UNSUPPORTED_HORIZON'
  | 'SYNTHETIC_FALLBACK';

export interface DataEnvelope<T> {
  value: T | null;
  source_id: string;
  source_type: string;
  as_of: string;
  ingested_at: string;
  freshness_sec: number | null;
  data_mode: DataMode;
  quality_status: QualityStatus;
  reason_code?: ReasonCode | string;
}

export type CapabilityName =
  | 'quote'
  | 'ohlcv_daily'
  | 'ohlcv_intraday'
  | 'broker_summary'
  | 'broker_running_trade'
  | 'broker_flow_intraday'
  | 'orderbook'
  | 'trade_tape'
  | 'index'
  | 'market_breadth'
  | 'sector'
  | 'fundamental'
  | 'news'
  | 'corporate_action';

export type CapabilityState =
  | 'READY'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'DISABLED';

export type TradingHorizon =
  | 'INTRADAY_5M'
  | 'INTRADAY_15M'
  | 'INTRADAY_60M'
  | 'DAILY_SWING'
  | 'WEEKLY';

export interface CapabilityEntry {
  name: CapabilityName;
  state: CapabilityState;
  source: string;
  last_success_at: string | null;
  freshness_sec: number | null;
  usable_horizons: TradingHorizon[];
  reason_code: ReasonCode | string;
}

export type DataCapabilityMatrix = Record<CapabilityName, CapabilityEntry>;
