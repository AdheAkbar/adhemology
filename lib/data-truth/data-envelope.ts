/**
 * lib/data-truth/data-envelope.ts - Canonical Envelope Factory & Utilities (Adimology V6)
 * PRD V6 Phase 1: No implicit ?? 0 coercion. Every metric carries verifiable truth state.
 */

import type { DataEnvelope, DataMode, QualityStatus, ReasonCode } from './types';

/**
 * Creates a confirmed, high-quality data envelope.
 */
export function createConfirmedEnvelope<T>(
  value: T,
  sourceId: string,
  sourceType: string,
  options?: {
    asOf?: Date | string;
    ingestedAt?: Date | string;
    freshnessSec?: number | null;
    dataMode?: DataMode;
  }
): DataEnvelope<T> {
  const now = new Date();
  const asOfStr = options?.asOf
    ? (options.asOf instanceof Date ? options.asOf.toISOString() : options.asOf)
    : now.toISOString();
  const ingestedAtStr = options?.ingestedAt
    ? (options.ingestedAt instanceof Date ? options.ingestedAt.toISOString() : options.ingestedAt)
    : now.toISOString();

  return {
    value,
    source_id: sourceId,
    source_type: sourceType,
    as_of: asOfStr,
    ingested_at: ingestedAtStr,
    freshness_sec: options?.freshnessSec ?? 0,
    data_mode: options?.dataMode ?? 'LIVE',
    quality_status: 'CONFIRMED',
    reason_code: 'OK',
  };
}

/**
 * Creates an unavailable envelope when a data source or field is missing.
 * Explicitly carries null value without converting to 0.
 */
export function createUnavailableEnvelope<T>(
  sourceId: string,
  sourceType: string,
  reasonCode: ReasonCode | string = 'SOURCE_FIELD_MISSING'
): DataEnvelope<T> {
  const now = new Date().toISOString();
  return {
    value: null,
    source_id: sourceId,
    source_type: sourceType,
    as_of: now,
    ingested_at: now,
    freshness_sec: null,
    data_mode: 'UNAVAILABLE',
    quality_status: 'UNAVAILABLE',
    reason_code: reasonCode,
  };
}

/**
 * Creates a degraded envelope (e.g. stale data or partial fallback).
 */
export function createDegradedEnvelope<T>(
  value: T,
  sourceId: string,
  sourceType: string,
  reasonCode: ReasonCode | string = 'STALE_THRESHOLD_EXCEEDED',
  options?: {
    asOf?: Date | string;
    freshnessSec?: number | null;
    dataMode?: DataMode;
  }
): DataEnvelope<T> {
  const now = new Date();
  const asOfStr = options?.asOf
    ? (options.asOf instanceof Date ? options.asOf.toISOString() : options.asOf)
    : now.toISOString();

  return {
    value,
    source_id: sourceId,
    source_type: sourceType,
    as_of: asOfStr,
    ingested_at: now.toISOString(),
    freshness_sec: options?.freshnessSec ?? null,
    data_mode: options?.dataMode ?? 'DELAYED',
    quality_status: 'DEGRADED',
    reason_code: reasonCode,
  };
}

/**
 * Creates a synthetic / simulated envelope (must be labeled explicitly).
 */
export function createSyntheticEnvelope<T>(
  value: T,
  sourceId: string,
  sourceType: string,
  reasonCode: ReasonCode | string = 'SYNTHETIC_FALLBACK'
): DataEnvelope<T> {
  const now = new Date().toISOString();
  return {
    value,
    source_id: sourceId,
    source_type: sourceType,
    as_of: now,
    ingested_at: now,
    freshness_sec: null,
    data_mode: 'DELAYED',
    quality_status: 'SYNTHETIC',
    reason_code: reasonCode,
  };
}

/**
 * Checks whether an envelope is confirmed and usable.
 */
export function isConfirmed<T>(envelope?: DataEnvelope<T> | null): boolean {
  return !!envelope && envelope.value !== null && envelope.quality_status === 'CONFIRMED';
}

/**
 * Safe unwrapper that ensures missing fields are never silently converted to 0.
 */
export function unwrapEnvelope<T>(
  envelope: DataEnvelope<T> | null | undefined,
  fallback: T | null = null
): T | null {
  if (!envelope || envelope.value === null) {
    return fallback;
  }
  return envelope.value;
}
