/**
 * lib/data-truth/point-in-time.ts
 * Point-in-Time Data Store, Fact<T> Schema, and L1 Data Integrity Gates (PRD v2.0).
 * 
 * Strict Quant Protocol:
 * - No naked values. Every value is wrapped in Fact<T> with stable fact_id, unit, provenance, and hash.
 * - Point-in-time isolation: event_time vs knowledge_time to prevent look-ahead bias.
 * - Quality gates: freshness, tick validity, price bounds vs ARA/ARB, and order book integrity.
 */

import { createHash } from 'crypto';
import { getTickSize, getAutoRejectionBounds } from '../config/market-rulebook';

export type FactUnit = 'IDR' | 'PCT' | 'LOT' | 'SHARES' | 'RATIO' | 'COUNT' | 'SECONDS' | 'ENUM' | 'BOOLEAN';
export type FactSource = 'EXCHANGE_FEED' | 'DERIVED' | 'FILING' | 'NEWS' | 'MODEL';

export interface Fact<T = any> {
  fact_id: string;        // e.g., "L1.price.last", "L4.absorption_p" (used as token by narrative layer)
  value: T;
  unit: FactUnit;
  source: FactSource;
  observed_at: string;    // ISO8601 string
  ingested_at: string;    // ISO8601 string
  age_sec: number;
  provenance: string[];   // Parent fact_ids that derived this value
  confidence: number;     // 1.0 for authentic direct exchange feed
  hash: string;           // SHA-256 (value + observed_at + source)
}

export interface PointInTimeRecord<T = any> {
  id: string;
  ticker: string;
  event_time: string;     // Kapan kejadian ini terjadi di bursa
  knowledge_time: string; // Kapan sistem mengetahui/mencatat kejadian ini
  fact: Fact<T>;
}

/**
 * Membuat Fact<T> dengan hashing kriptografis dan metadata lengkap.
 */
export function createFact<T>(
  factId: string,
  value: T,
  unit: FactUnit,
  source: FactSource,
  options?: {
    observedAt?: string | Date;
    ingestedAt?: string | Date;
    provenance?: string[];
    confidence?: number;
  }
): Fact<T> {
  const now = new Date();
  const obsDate = options?.observedAt ? new Date(options.observedAt) : now;
  const ingDate = options?.ingestedAt ? new Date(options.ingestedAt) : now;

  const observedAtStr = obsDate.toISOString();
  const ingestedAtStr = ingDate.toISOString();
  const ageSec = Math.max(0, (now.getTime() - obsDate.getTime()) / 1000);

  const hashInput = `${factId}:${JSON.stringify(value)}:${observedAtStr}:${source}`;
  const hash = createHash('sha256').update(hashInput).digest('hex').slice(0, 16);

  return {
    fact_id: factId,
    value,
    unit,
    source,
    observed_at: observedAtStr,
    ingested_at: ingestedAtStr,
    age_sec: Number(ageSec.toFixed(2)),
    provenance: options?.provenance || [],
    confidence: options?.confidence ?? (source === 'EXCHANGE_FEED' ? 1.0 : 0.9),
    hash,
  };
}

export interface DataQualityCheckResult {
  passed: boolean;
  code: 'OK' | 'DATA_STALE' | 'TICK_INVALID' | 'PRICE_ANOMALY' | 'ORDERBOOK_INVERTED' | 'OHLCV_INCONSISTENT';
  message: string;
  fact_id: string;
}

/**
 * Gerbang Kualitas Data L1 (Quality Gate).
 */
export function validateFactQuality(
  fact: Fact<any>,
  context: {
    mode?: 'SCALP' | 'SWING' | 'INVEST';
    prevClose?: number;
    orderbook?: { bestBid: number; bestAsk: number };
    ohlcv?: { open: number; high: number; low: number; close: number; volume: number };
  }
): DataQualityCheckResult {
  const mode = context.mode || 'SCALP';

  // 1. Freshness check
  const maxAge = mode === 'SCALP' ? 5 : mode === 'SWING' ? 60 : 86400;
  if (fact.age_sec > maxAge) {
    return {
      passed: false,
      code: 'DATA_STALE',
      message: `Fact ${fact.fact_id} age (${fact.age_sec}s) exceeds max freshness (${maxAge}s) for mode ${mode}`,
      fact_id: fact.fact_id,
    };
  }

  // 2. Price Tick Validity (for price facts)
  if (fact.unit === 'IDR' && typeof fact.value === 'number' && fact.value > 0) {
    const tick = getTickSize(fact.value);
    if (fact.value % tick !== 0) {
      return {
        passed: false,
        code: 'TICK_INVALID',
        message: `Price ${fact.value} is not a valid multiple of IDX tick size ${tick}`,
        fact_id: fact.fact_id,
      };
    }

    // 3. Price bounds check against ARA/ARB limits
    if (context.prevClose && context.prevClose > 0) {
      const bounds = getAutoRejectionBounds(context.prevClose);
      if (fact.value > bounds.araPrice * 1.005 || fact.value < bounds.arbPrice * 0.995) {
        return {
          passed: false,
          code: 'PRICE_ANOMALY',
          message: `Price ${fact.value} breaches official auto-rejection bounds [${bounds.arbPrice}, ${bounds.araPrice}]`,
          fact_id: fact.fact_id,
        };
      }
    }
  }

  // 4. Order book integrity check
  if (context.orderbook) {
    if (context.orderbook.bestBid >= context.orderbook.bestAsk && context.orderbook.bestAsk > 0) {
      return {
        passed: false,
        code: 'ORDERBOOK_INVERTED',
        message: `Order book crossed/inverted: Best Bid ${context.orderbook.bestBid} >= Best Ask ${context.orderbook.bestAsk}`,
        fact_id: fact.fact_id,
      };
    }
  }

  // 5. OHLCV consistency check
  if (context.ohlcv) {
    const { open, high, low, close, volume } = context.ohlcv;
    if (low > open || low > close || high < open || high < close || volume < 0) {
      return {
        passed: false,
        code: 'OHLCV_INCONSISTENT',
        message: `OHLCV bar geometry invalid: low=${low}, high=${high}, open=${open}, close=${close}`,
        fact_id: fact.fact_id,
      };
    }
  }

  return {
    passed: true,
    code: 'OK',
    message: 'Data quality verification passed',
    fact_id: fact.fact_id,
  };
}

/**
 * Point-in-Time Store InMemory & Query Filter (Anti Look-Ahead).
 */
export class PointInTimeStore {
  private records: PointInTimeRecord[] = [];

  public append(record: PointInTimeRecord): void {
    this.records.push(record);
  }

  /**
   * Mengambil semua fakta yang sudah diketahui pada waktu asOfKnowledgeTime (TIDAK ADA LOOK-AHEAD).
   */
  public queryPointInTime(ticker: string, asOfKnowledgeTime: string | Date): Fact[] {
    const cutoff = new Date(asOfKnowledgeTime).getTime();
    return this.records
      .filter((r) => r.ticker === ticker && new Date(r.knowledge_time).getTime() <= cutoff)
      .map((r) => r.fact);
  }

  /**
   * Mengambil fakta paling mutakhir yang diketahui sebelum batas waktu.
   */
  public getLatestFact(ticker: string, factId: string, asOfKnowledgeTime: string | Date): Fact | null {
    const cutoff = new Date(asOfKnowledgeTime).getTime();
    const matched = this.records
      .filter((r) => r.ticker === ticker && r.fact.fact_id === factId && new Date(r.knowledge_time).getTime() <= cutoff)
      .sort((a, b) => new Date(b.knowledge_time).getTime() - new Date(a.knowledge_time).getTime());

    return matched.length > 0 ? matched[0].fact : null;
  }
}
