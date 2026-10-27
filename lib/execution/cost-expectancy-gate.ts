/**
 * lib/execution/cost-expectancy-gate.ts
 * L7 — Cost, Friction & Expectancy Gate (PRD v2.0).
 * 
 * Strict Quant Protocol:
 * - Mengatasi T-04: Model biaya transaksi lengkap (fee beli 0.15%, fee jual 0.25%, spread, dan slippage).
 * - Simulasi Order Book Walk: Menelusuri level buku order nyata untuk masuk DAN keluar.
 * - Gerbang Ekspektansi Bersih: E = p * TP1_net - (1 - p) * SL_net >= 0.35 * SL_net.
 * - Syarat Mutlak SCALP: TP1_net >= 3.0% dan RR_net >= 1.8x.
 */

import { ACTIVE_MARKET_RULEBOOK } from '../config/market-rulebook';

export interface OrderBookLevel {
  price: number;
  qtyLots: number;
  flaggedSpoof?: boolean;
}

export interface ExecutionSimulationResult {
  status: 'OK' | 'INSUFFICIENT_DEPTH';
  avgPrice: number;
  slippagePct: number;
  fillRatio: number;
  totalCostIdr: number;
}

export interface FrictionBreakdown {
  brokerFeeBuyPct: number;
  brokerFeeSellPct: number;
  roundTripFeePct: number;
  spreadCostPct: number;
  slippageInPct: number;
  slippageOutPct: number;
  totalFrictionPct: number;
}

export interface ExpectancyEvaluation {
  passed: boolean;
  rejectReasons: string[];
  grossMetrics: {
    tp1GrossPct: number;
    slGrossPct: number;
    rrGross: number;
  };
  friction: FrictionBreakdown;
  netMetrics: {
    tp1NetPct: number;
    slNetPct: number;
    rrNet: number;
    netExpectancy: number; // E
    expectancyRatio: number; // E / SL_net
  };
  thresholds: {
    minNetTp1Pct: number; // 3.0% for SCALP
    minNetRrr: number;    // 1.8x
    minExpectancyRatio: number; // 0.35
  };
}

/**
 * Simulasi Order Book Walk menelusuri level kedalaman riil.
 */
export function simulateOrderBookWalk(
  bookLevels: OrderBookLevel[],
  targetSizeIdr: number,
  side: 'BUY' | 'SELL'
): ExecutionSimulationResult {
  if (bookLevels.length === 0 || targetSizeIdr <= 0) {
    return {
      status: 'INSUFFICIENT_DEPTH',
      avgPrice: 0,
      slippagePct: 100,
      fillRatio: 0,
      totalCostIdr: 0,
    };
  }

  const bestPrice = bookLevels[0].price;
  let remainingIdr = targetSizeIdr;
  let accumulatedCost = 0;
  let accumulatedShares = 0;

  for (const level of bookLevels) {
    if (level.flaggedSpoof) continue; // Abaikan level order fiktif

    const availableIdr = level.price * level.qtyLots * 100;
    const takeIdr = Math.min(remainingIdr, availableIdr);
    const takeShares = takeIdr / level.price;

    accumulatedCost += takeIdr;
    accumulatedShares += takeShares;
    remainingIdr -= takeIdr;

    if (remainingIdr <= 0) break;
  }

  const fillRatio = targetSizeIdr > 0 ? Number(((targetSizeIdr - remainingIdr) / targetSizeIdr).toFixed(3)) : 0;

  if (remainingIdr > 0.01) {
    return {
      status: 'INSUFFICIENT_DEPTH',
      avgPrice: accumulatedShares > 0 ? accumulatedCost / accumulatedShares : 0,
      slippagePct: 100,
      fillRatio,
      totalCostIdr: accumulatedCost,
    };
  }

  const avgPrice = Number((accumulatedCost / accumulatedShares).toFixed(2));
  const slippagePct = Number((Math.abs(avgPrice - bestPrice) / bestPrice * 100).toFixed(3));

  return {
    status: 'OK',
    avgPrice,
    slippagePct,
    fillRatio: 1.0,
    totalCostIdr: accumulatedCost,
  };
}

/**
 * Evaluasi Gerbang Biaya & Ekspektansi Bersih (Cost & Expectancy Gate).
 */
export function evaluateCostAndExpectancyGate(params: {
  entryPrice: number;
  slPrice: number;
  tp1Price: number;
  calibratedProbabilityP: number; // p in [0, 1]
  mode?: 'SCALP' | 'SWING' | 'INVEST';
  orderbookLevelsAsk?: OrderBookLevel[];
  orderbookLevelsBid?: OrderBookLevel[];
  plannedPositionSizeIdr?: number;
  bestBid?: number;
  bestAsk?: number;
  isLimitOrderPassive?: boolean;
}): ExpectancyEvaluation {
  const mode = params.mode || 'SCALP';
  const rejectReasons: string[] = [];

  // Ambang batas per mode
  const minNetTp1Pct = mode === 'SCALP' ? 3.0 : mode === 'SWING' ? 5.0 : 10.0;
  const minNetRrr = mode === 'SCALP' ? 1.8 : mode === 'SWING' ? 2.0 : 3.0;
  const minExpectancyRatio = 0.35;

  // 1. Biaya Broker & Pajak Resmi
  const brokerFeeBuyPct = ACTIVE_MARKET_RULEBOOK.costs.brokerFeeBuyPct;
  const brokerFeeSellPct = ACTIVE_MARKET_RULEBOOK.costs.brokerFeeSellPct;
  const roundTripFeePct = ACTIVE_MARKET_RULEBOOK.costs.roundTripPct;

  // 2. Biaya Spread
  const bestBid = params.bestBid || params.entryPrice;
  const bestAsk = params.bestAsk || params.entryPrice;
  const midPrice = (bestBid + bestAsk) / 2 || params.entryPrice;
  const rawSpreadPct = midPrice > 0 ? ((bestAsk - bestBid) / midPrice) * 100 : 0;
  const spreadMultiplier = params.isLimitOrderPassive ? 0.5 : 1.0;
  const spreadCostPct = Number((rawSpreadPct * spreadMultiplier).toFixed(3));

  // 3. Simulasi Slippage Masuk & Keluar
  const positionSize = params.plannedPositionSizeIdr || 10_000_000;
  let slippageInPct = 0.10;
  let slippageOutPct = 0.15;

  if (params.orderbookLevelsAsk && params.orderbookLevelsAsk.length > 0) {
    const simIn = simulateOrderBookWalk(params.orderbookLevelsAsk, positionSize, 'BUY');
    if (simIn.status === 'INSUFFICIENT_DEPTH') {
      rejectReasons.push(`Kedalaman offer tidak memadai untuk ukuran posisi Rp ${(positionSize / 1e6).toFixed(0)} jt`);
    } else {
      slippageInPct = simIn.slippagePct;
    }
  }

  if (params.orderbookLevelsBid && params.orderbookLevelsBid.length > 0) {
    const simOut = simulateOrderBookWalk(params.orderbookLevelsBid, positionSize, 'SELL');
    if (simOut.status === 'INSUFFICIENT_DEPTH') {
      rejectReasons.push(`Kedalaman bid tidak memadai untuk likuiditas keluar posisi Rp ${(positionSize / 1e6).toFixed(0)} jt`);
    } else {
      slippageOutPct = simOut.slippagePct;
    }
  }

  const totalFrictionPct = Number(
    (roundTripFeePct + spreadCostPct + slippageInPct + slippageOutPct).toFixed(3)
  );

  // 4. Kalkulasi Metrik Kotor
  const tp1GrossPct = Number((((params.tp1Price - params.entryPrice) / params.entryPrice) * 100).toFixed(2));
  const slGrossPct = Number((((params.entryPrice - params.slPrice) / params.entryPrice) * 100).toFixed(2));
  const rrGross = slGrossPct > 0 ? Number((tp1GrossPct / slGrossPct).toFixed(2)) : 0;

  // 5. Kalkulasi Metrik Bersih
  const tp1NetPct = Number((tp1GrossPct - totalFrictionPct).toFixed(2));
  const slNetPct = Number((slGrossPct + totalFrictionPct).toFixed(2));
  const rrNet = slNetPct > 0 ? Number((tp1NetPct / slNetPct).toFixed(2)) : 0;

  // 6. Ekspektansi Bersih E = p * TP1_net - (1 - p) * SL_net
  const p = params.calibratedProbabilityP;
  const netExpectancy = Number((p * tp1NetPct - (1 - p) * slNetPct).toFixed(3));
  const expectancyRatio = slNetPct > 0 ? Number((netExpectancy / slNetPct).toFixed(3)) : 0;

  // 7. Evaluasi Aturan Keras
  if (tp1NetPct < minNetTp1Pct) {
    rejectReasons.push(
      `TP1 bersih (${tp1NetPct}%) di bawah batas minimum ${minNetTp1Pct}% setelah memperhitungkan friksi total ${totalFrictionPct}%`
    );
  }

  if (rrNet < minNetRrr) {
    rejectReasons.push(`R:R bersih (${rrNet}x) di bawah ambang batas minimum ${minNetRrr}x`);
  }

  if (netExpectancy <= 0 || expectancyRatio < minExpectancyRatio) {
    rejectReasons.push(
      `Ekspektansi bersih E=${netExpectancy}% (rasio ${expectancyRatio}x) di bawah syarat minimum 0.35x SL_bersih`
    );
  }

  const passed = rejectReasons.length === 0;

  return {
    passed,
    rejectReasons,
    grossMetrics: {
      tp1GrossPct,
      slGrossPct,
      rrGross,
    },
    friction: {
      brokerFeeBuyPct,
      brokerFeeSellPct,
      roundTripFeePct,
      spreadCostPct,
      slippageInPct,
      slippageOutPct,
      totalFrictionPct,
    },
    netMetrics: {
      tp1NetPct,
      slNetPct,
      rrNet,
      netExpectancy,
      expectancyRatio,
    },
    thresholds: {
      minNetTp1Pct,
      minNetRrr,
      minExpectancyRatio,
    },
  };
}
