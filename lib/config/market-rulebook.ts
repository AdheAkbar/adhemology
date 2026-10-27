/**
 * lib/config/market-rulebook.ts
 * Market Rulebook Berversi & Ter-audit untuk Bursa Efek Indonesia (IDX/BEI).
 * 
 * PRD v2.0 Mandat:
 * Aturan bursa TIDAK BOLEH di-hardcode acak. Rulebook adalah artefak berversi,
 * bertanggal, dan membawa masa berlaku (expires_at).
 * Pelanggaran expires_at memicu Staleness Veto (mode SCALP dibekukan).
 */

export interface TickScheduleTier {
  priceLt: number | null; // null represents Infinity
  tick: number;
}

export interface AraTier {
  minPrice: number;
  maxPrice: number;
  limitPct: number;
}

export interface MarketCosts {
  brokerFeeBuyPct: number;
  brokerFeeSellPct: number;
  roundTripPct: number;
}

export interface MarketRulebook {
  version: string;
  verifiedBy: string;
  verifiedAt: string;
  sourceOfTruth: string;
  expiresAt: string;
  lotSize: number;
  tickSchedule: TickScheduleTier[];
  autoRejection: {
    regime: 'ASYMMETRIC' | 'SYMMETRIC';
    araTiers: AraTier[];
    arbLimitPct: number;
  };
  specialMonitoringBoard: {
    mechanism: 'FULL_CALL_AUCTION';
    tradableByEngine: {
      SCALP: boolean;
      SWING: boolean;
      INVEST: boolean;
    };
  };
  costs: MarketCosts;
  checksum: string;
}

/**
 * Konfigurasi aktif resmi pasar BEI (v2.0 - Efektif 15 September 2026).
 */
export const ACTIVE_MARKET_RULEBOOK: MarketRulebook = {
  version: '2026-09-15',
  verifiedBy: 'Adimology Engineering & Market Microstructure Lead',
  verifiedAt: '2026-09-15T08:00:00+07:00',
  sourceOfTruth: 'https://www.idx.co.id — SK Direksi & Pengumuman Bursa (Kep-00023/BEI/04-2016 dsb)',
  expiresAt: '2026-10-15T23:59:59+07:00',
  lotSize: 100, // 1 lot = 100 lembar
  tickSchedule: [
    { priceLt: 200, tick: 1 },
    { priceLt: 500, tick: 2 },
    { priceLt: 2000, tick: 5 },
    { priceLt: 5000, tick: 10 },
    { priceLt: null, tick: 25 },
  ],
  autoRejection: {
    regime: 'ASYMMETRIC',
    araTiers: [
      { minPrice: 50, maxPrice: 200, limitPct: 35 },
      { minPrice: 200, maxPrice: 5000, limitPct: 25 },
      { minPrice: 5000, maxPrice: Infinity, limitPct: 20 },
    ],
    arbLimitPct: 15, // ARB Simetris bertahap / Asimetris 15%
  },
  specialMonitoringBoard: {
    mechanism: 'FULL_CALL_AUCTION',
    tradableByEngine: {
      SCALP: false, // DILARANG KERAS: tidak ada orderbook kontinu
      SWING: false, // DILARANG KERAS
      INVEST: true, // Hanya observasi fundamental dengan banner risiko
    },
  },
  costs: {
    brokerFeeBuyPct: 0.15,
    brokerFeeSellPct: 0.25, // Termasuk PPh final 0.1% + PPN bursa
    roundTripPct: 0.40,
  },
  checksum: 'sha256-rulebook-idx-20260915-v2',
};

/**
 * Memeriksa apakah Market Rulebook sudah melewati masa kedaluwarsa (Staleness Veto).
 */
export function isRulebookStale(asOf?: Date | string, rulebook: MarketRulebook = ACTIVE_MARKET_RULEBOOK): boolean {
  const checkTime = asOf ? new Date(asOf).getTime() : Date.now();
  const expiryTime = new Date(rulebook.expiresAt).getTime();
  return checkTime > expiryTime;
}

/**
 * Mengambil ukuran fraksi (tick size) harga berdasarkan jadwal resmi BEI.
 */
export function getTickSize(price: number, rulebook: MarketRulebook = ACTIVE_MARKET_RULEBOOK): number {
  if (price <= 0) return 1;
  for (const tier of rulebook.tickSchedule) {
    if (tier.priceLt === null || price < tier.priceLt) {
      return tier.tick;
    }
  }
  return 25;
}

/**
 * Membulatkan harga ke batas tick resmi BEI (Fraksi).
 */
export function roundToValidTick(
  price: number,
  direction: 'UP' | 'DOWN' | 'NEAREST' = 'NEAREST',
  rulebook: MarketRulebook = ACTIVE_MARKET_RULEBOOK
): number {
  if (price <= 0) return 0;
  const tick = getTickSize(price, rulebook);
  if (direction === 'DOWN') {
    return Math.floor(price / tick) * tick;
  }
  if (direction === 'UP') {
    return Math.ceil(price / tick) * tick;
  }
  return Math.round(price / tick) * tick;
}

/**
 * Menghitung batas fisik Auto Rejection Atas (ARA) dan Bawah (ARB).
 */
export function getAutoRejectionBounds(
  refPrice: number,
  rulebook: MarketRulebook = ACTIVE_MARKET_RULEBOOK
): { araPrice: number; arbPrice: number; araPct: number; arbPct: number } {
  if (refPrice <= 0) {
    return { araPrice: 0, arbPrice: 0, araPct: 0, arbPct: 0 };
  }

  // Tentukan batas ARA
  let araPct = 25;
  for (const tier of rulebook.autoRejection.araTiers) {
    if (refPrice >= tier.minPrice && refPrice <= tier.maxPrice) {
      araPct = tier.limitPct;
      break;
    }
  }

  const arbPct = rulebook.autoRejection.arbLimitPct;

  const rawAra = refPrice * (1 + araPct / 100);
  const rawArb = refPrice * (1 - arbPct / 100);

  // ARA dibulatkan ke bawah ke tick valid agar tidak menembus batas persentase
  const araPrice = roundToValidTick(rawAra, 'DOWN', rulebook);
  // ARB dibulatkan ke atas ke tick valid agar tidak melanggar batas lantai
  const arbPrice = Math.max(50, roundToValidTick(rawArb, 'UP', rulebook));

  return {
    araPrice,
    arbPrice,
    araPct,
    arbPct,
  };
}

/**
 * Menghitung Headroom ARA dan ARB (ruang gerak sebelum mentok batas fisik bursa).
 */
export function calculateHeadroom(
  currentPrice: number,
  araPrice: number,
  arbPrice: number
): { headroomAraPct: number; headroomArbPct: number } {
  if (currentPrice <= 0) return { headroomAraPct: 0, headroomArbPct: 0 };

  const headroomAraPct = Number((((araPrice - currentPrice) / currentPrice) * 100).toFixed(2));
  const headroomArbPct = Number((((currentPrice - arbPrice) / currentPrice) * 100).toFixed(2));

  return {
    headroomAraPct: Math.max(0, headroomAraPct),
    headroomArbPct: Math.max(0, headroomArbPct),
  };
}

/**
 * Mengecek apakah saham layak diperdagangkan oleh engine berdasarkan status Papan FCA.
 */
export function isFcaTradable(
  mode: 'SCALP' | 'SWING' | 'INVEST',
  isFca: boolean,
  rulebook: MarketRulebook = ACTIVE_MARKET_RULEBOOK
): boolean {
  if (!isFca) return true;
  return rulebook.specialMonitoringBoard.tradableByEngine[mode];
}
