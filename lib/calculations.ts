import { getIdxTickSize, snapToIdxTick } from './config/idx-fraksi-config';

/**
 * Calculate Fraksi based on stock price using the active IDX regulation.
 * Maintained as an alias for full backward compatibility.
 */
export function getFraksi(harga: number, asOfDate?: string | Date): number {
  return getIdxTickSize(harga, asOfDate);
}

/**
 * Calculate heuristic baseline target prices based on legacy Adimology methodology (Adi Sucipto).
 * NOTE: These are empirical heuristic targets used as baseline benchmarks,
 * NOT guaranteed distribution levels or certainty claims.
 */
export function calculateTargets(
  rataRataBandar: number,
  barangBandar: number,
  ara: number,
  arb: number,
  totalBid: number,
  totalOffer: number,
  harga: number,
  asOfDate?: string | Date
) {
  // Calculate Fraksi
  const fraksi = getFraksi(harga, asOfDate);

  // Total Papan = (ARA - ARB) / Fraksi
  const totalPapan = Math.max(1, (ara - arb) / fraksi);

  // Rata rata Bid Ofer = (Total Bid + Total Offer) / Total Papan
  const rataRataBidOfer = Math.max(1, (totalBid + totalOffer) / totalPapan);

  // a = Rata rata bandar × 5% (heuristic minimum profit margin proxy)
  const a = rataRataBandar * 0.05;

  // p = Barang Bandar / Rata rata Bid Ofer (heuristic depth absorption proxy)
  const p = barangBandar / rataRataBidOfer;

  // Target Realistis = Rata rata bandar + a + (p/2 × Fraksi)
  const targetRealistis1 = snapToIdxTick(rataRataBandar + a + ((p / 2) * fraksi), 'NEAREST', asOfDate);

  // Target Max = Rata rata bandar + a + (p × Fraksi)
  const targetMax = snapToIdxTick(rataRataBandar + a + (p * fraksi), 'NEAREST', asOfDate);

  return {
    fraksi,
    totalPapan: Math.round(totalPapan),
    rataRataBidOfer: Math.round(rataRataBidOfer),
    a: Math.round(a),
    p: Math.round(p),
    targetRealistis1: Math.round(targetRealistis1),
    targetMax: Math.round(targetMax),
  };
}
