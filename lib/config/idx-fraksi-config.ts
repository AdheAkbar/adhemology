/**
 * lib/config/idx-fraksi-config.ts
 * Versioned Indonesia Stock Exchange (BEI / IDX) Price Tick (Fraksi Harga) Rules.
 * 
 * Complies with IDX Regulation No. II-A on Trading of Equity Securities.
 * Allows configuration versioning in case IDX updates tick brackets in the future.
 */

export interface IdxFraksiRule {
  minPrice: number;
  maxPrice: number; // Infinity for the highest tier
  tickSize: number;
  maxPriceStep: number; // Maximum tick step per order in auto-rejection rules
}

export interface IdxFraksiConfigVersion {
  version: string;
  effectiveDate: string; // ISO date string YYYY-MM-DD
  description: string;
  rules: IdxFraksiRule[];
}

/**
 * Historical and current IDX Fraksi configurations.
 */
export const IDX_FRAKSI_CONFIG_HISTORY: IdxFraksiConfigVersion[] = [
  {
    version: '2016-CURRENT',
    effectiveDate: '2016-05-02',
    description: 'Current 5-tier IDX price fraction schedule pursuant to Keputusan Direksi PT BEI No. Kep-00023/BEI/04-2016',
    rules: [
      { minPrice: 0, maxPrice: 200, tickSize: 1, maxPriceStep: 10 },
      { minPrice: 200, maxPrice: 500, tickSize: 2, maxPriceStep: 20 },
      { minPrice: 500, maxPrice: 2000, tickSize: 5, maxPriceStep: 50 },
      { minPrice: 2000, maxPrice: 5000, tickSize: 10, maxPriceStep: 100 },
      { minPrice: 5000, maxPrice: Infinity, tickSize: 25, maxPriceStep: 250 },
    ],
  },
];

/**
 * Returns the active IDX fraksi configuration as of a given date (defaulting to today).
 */
export function getActiveIdxFraksiConfig(asOfDate?: string | Date): IdxFraksiConfigVersion {
  const targetDate = asOfDate
    ? typeof asOfDate === 'string'
      ? asOfDate
      : asOfDate.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Sort descending by effective date
  const sorted = [...IDX_FRAKSI_CONFIG_HISTORY].sort((a, b) =>
    b.effectiveDate.localeCompare(a.effectiveDate)
  );

  const matched = sorted.find((c) => c.effectiveDate <= targetDate);
  return matched || sorted[sorted.length - 1];
}

/**
 * Get tick size for a given price under active rules.
 */
export function getIdxTickSize(price: number, asOfDate?: string | Date): number {
  if (price <= 0) return 1;
  const config = getActiveIdxFraksiConfig(asOfDate);
  const matchedRule = config.rules.find(
    (r) => price >= r.minPrice && price < r.maxPrice
  );
  return matchedRule ? matchedRule.tickSize : 25;
}

/**
 * Rounds a price to the nearest official IDX tick boundary.
 * Direction:
 * - 'DOWN': Strict floor to tick boundary (vital for Stop Loss/Invalidation to prevent premature exit or invalid orders)
 * - 'UP': Strict ceiling to tick boundary (useful for Targets)
 * - 'NEAREST': Mathematical nearest tick
 */
export function snapToIdxTick(
  price: number,
  direction: 'UP' | 'DOWN' | 'NEAREST' = 'NEAREST',
  asOfDate?: string | Date
): number {
  if (price <= 0) return 0;
  const tick = getIdxTickSize(price, asOfDate);

  if (direction === 'DOWN') {
    return Math.floor(price / tick) * tick;
  }
  if (direction === 'UP') {
    return Math.ceil(price / tick) * tick;
  }
  return Math.round(price / tick) * tick;
}

/**
 * Computes price distance in tick units.
 */
export function getTickDistance(fromPrice: number, toPrice: number, asOfDate?: string | Date): number {
  const avgPrice = (fromPrice + toPrice) / 2;
  const tick = getIdxTickSize(avgPrice, asOfDate);
  return Math.round(Math.abs(toPrice - fromPrice) / tick);
}
