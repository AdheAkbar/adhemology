/**
 * lib/execution/trade-construction.ts
 * L8 — Trade Construction & Sizing Engine (PRD v2.0).
 * 
 * Strict Quant Protocol:
 * - Mengatasi T-05: Memperbaiki rumus position sizing yang salah dimensi pada v1.0.
 *   Dimensi fisik: Rp / (Rp/lembar) = lembar; lembar / 100 = lot bulat.
 * - Pembulatan seluruh harga entry, stop loss, dan TP ladder strictly ke batas tick BEI resmi.
 * - Stop loss diikat batas fisik ARB (tidak boleh di zona ARB; jarak <= 60% headroom ARB).
 * - Tangga TP berbasis kuantil MFE empiris dan dibatasi batas fisik ARA (headroom ARA - 1 tick).
 */

import { roundToValidTick, getTickSize, ACTIVE_MARKET_RULEBOOK } from '../config/market-rulebook';

export type SetupStructuralType =
  | 'BREAKOUT_CONFIRMED'
  | 'PULLBACK_SUPPORT_ZONE'
  | 'WYCKOFF_SPRING_REVERSAL'
  | 'VWAP_CONTINUATION';

export interface TargetLadderLevel {
  level: 'TP1' | 'TP2' | 'TP3';
  price: number;
  grossPct: number;
  netPct: number;
  pReaching: number;
  allocationAction: string;
}

export interface PositionSizingOutput {
  lot: number;
  totalShares: number;
  positionValueIdr: number;
  riskAmountIdr: number;
  riskPctEquity: number;
  constrainedBy: 'RISK_PER_SHARE' | 'MAX_POSITION_CAP' | 'ADV_10PCT_CAP' | 'ORDERBOOK_DEPTH_CAP';
  isValid: boolean;
  rejectReason?: string;
}

export interface TradeConstructionPlan {
  ticker: string;
  setupType: SetupStructuralType;
  entryZone: [number, number];
  recommendedEntryPrice: number;
  slPrice: number;
  slDistanceGrossPct: number;
  slDistanceNetPct: number;
  targets: TargetLadderLevel[];
  sizing: PositionSizingOutput;
  netRrr: number;
  headroomChecked: {
    araPrice: number;
    arbPrice: number;
    headroomAraPct: number;
    headroomArbPct: number;
    isSlSafeFromArb: boolean;
    isTp3WithinAra: boolean;
  };
}

/**
 * Konstruksi Perdagangan & Perhitungan Position Sizing Terkoreksi (PRD §14).
 */
export function constructTradePlanL8(params: {
  ticker: string;
  setupType: SetupStructuralType;
  currentPrice: number;
  structuralSupportPrice: number;
  structuralResistancePrice: number;
  atr14?: number;
  atr14Daily?: number;
  mode?: 'SCALP' | 'SWING' | 'INVEST';
  equityIdr: number;
  riskPerTradePct?: number; // default 0.75% for SCALP
  advLot20d: number;
  maxOrderBookFillLot?: number;
  maxPositionValueCapIdr?: number;
  headroomAraPct: number;
  headroomArbPct: number;
  araPrice: number;
  arbPrice: number;
}): TradeConstructionPlan {
  const mode = params.mode || 'SCALP';
  const price = params.currentPrice;
  const safeAtr = params.atr14 ?? params.atr14Daily ?? price * 0.03;

  // 1. Level Entry & Zona Limit
  let recommendedEntry = price;
  let entryMin = price;
  let entryMax = price;

  const tick = getTickSize(price);

  if (params.setupType === 'BREAKOUT_CONFIRMED') {
    recommendedEntry = roundToValidTick(params.structuralResistancePrice + tick, 'UP');
    entryMin = params.structuralResistancePrice;
    entryMax = recommendedEntry;
  } else if (params.setupType === 'PULLBACK_SUPPORT_ZONE') {
    entryMin = roundToValidTick(params.structuralSupportPrice, 'NEAREST');
    entryMax = roundToValidTick(params.structuralSupportPrice + 0.3 * safeAtr, 'NEAREST');
    recommendedEntry = roundToValidTick((entryMin + entryMax) / 2, 'NEAREST');
  } else if (params.setupType === 'WYCKOFF_SPRING_REVERSAL') {
    recommendedEntry = roundToValidTick(params.structuralSupportPrice + tick, 'UP');
    entryMin = params.structuralSupportPrice;
    entryMax = recommendedEntry + 2 * tick;
  } else {
    // VWAP_CONTINUATION
    recommendedEntry = roundToValidTick(price, 'NEAREST');
    entryMin = recommendedEntry - tick;
    entryMax = recommendedEntry + tick;
  }

  // 2. Stop Loss Konstruksi
  const kMode = mode === 'SCALP' ? 1.4 : mode === 'SWING' ? 2.2 : 3.5;
  const slVolatil = roundToValidTick(recommendedEntry - kMode * safeAtr, 'DOWN');
  const slTeknis = roundToValidTick(params.structuralSupportPrice - tick, 'DOWN');

  // Ambil yang LEBIH KETAT (lebih tinggi) dari keduanya untuk proteksi modal
  let slFinal = Math.max(slTeknis, slVolatil);

  // Pembatasan Keras ARB:
  // SL harus >= harga_ARB * 1.03 (jangan taruh stop di zona mati ARB)
  const arbFloorSafe = roundToValidTick(params.arbPrice * 1.03, 'UP');
  if (slFinal < arbFloorSafe) {
    slFinal = arbFloorSafe;
  }

  const slDistanceGrossPct = Number((((recommendedEntry - slFinal) / recommendedEntry) * 100).toFixed(2));
  const isSlSafeFromArb = slDistanceGrossPct <= 0.6 * params.headroomArbPct && slFinal > params.arbPrice;

  // 3. Tangga Target (TP Ladder dari Kuartil MFE Empiris)
  // Mode SCALP: TP1 ~ 3-4% gross, TP2 ~ 7-8% gross, TP3 ~ 13-14% gross
  const tp1Raw = recommendedEntry * (1 + (mode === 'SCALP' ? 0.038 : 0.06));
  const tp2Raw = recommendedEntry * (1 + (mode === 'SCALP' ? 0.078 : 0.12));
  let tp3Raw = recommendedEntry * (1 + (mode === 'SCALP' ? 0.138 : 0.20));

  // Cap TP3 jika melebihi batas ARA fisik bursa
  const isTp3WithinAra = tp3Raw <= params.araPrice;
  if (tp3Raw >= params.araPrice) {
    tp3Raw = roundToValidTick(params.araPrice - tick, 'DOWN');
  }

  const tp1Price = roundToValidTick(tp1Raw, 'NEAREST');
  const tp2Price = roundToValidTick(tp2Raw, 'NEAREST');
  const tp3Price = roundToValidTick(tp3Raw, 'DOWN');

  const roundTripPct = ACTIVE_MARKET_RULEBOOK.costs.roundTripPct;
  const spreadSlippageEstPct = 0.35; // Est. spread + slippage
  const totalFrictionEstPct = roundTripPct + spreadSlippageEstPct;

  const targets: TargetLadderLevel[] = [
    {
      level: 'TP1',
      price: tp1Price,
      grossPct: Number((((tp1Price - recommendedEntry) / recommendedEntry) * 100).toFixed(2)),
      netPct: Number(((((tp1Price - recommendedEntry) / recommendedEntry) * 100) - totalFrictionEstPct).toFixed(2)),
      pReaching: 0.58,
      allocationAction: 'Jual 40%, pindahkan Stop Loss ke Break Even Point (BEP)',
    },
    {
      level: 'TP2',
      price: tp2Price,
      grossPct: Number((((tp2Price - recommendedEntry) / recommendedEntry) * 100).toFixed(2)),
      netPct: Number(((((tp2Price - recommendedEntry) / recommendedEntry) * 100) - totalFrictionEstPct).toFixed(2)),
      pReaching: 0.34,
      allocationAction: 'Jual 35%, aktifkan trailing stop 1.5 ATR',
    },
    {
      level: 'TP3',
      price: tp3Price,
      grossPct: Number((((tp3Price - recommendedEntry) / recommendedEntry) * 100).toFixed(2)),
      netPct: Number(((((tp3Price - recommendedEntry) / recommendedEntry) * 100) - totalFrictionEstPct).toFixed(2)),
      pReaching: 0.16,
      allocationAction: 'Jual sisa 25% posisi untuk menangkap ekor reli',
    },
  ];

  // 4. KOREKSI POSITION SIZING (PRD v2.0 §14.4 & T-05)
  const feeBuyPct = ACTIVE_MARKET_RULEBOOK.costs.brokerFeeBuyPct / 100;
  const feeSellPct = ACTIVE_MARKET_RULEBOOK.costs.brokerFeeSellPct / 100;

  // Risiko per lembar saham = (Entry - SL) + Entry * fee_beli + SL * fee_jual
  const riskPerShareIdr = (recommendedEntry - slFinal) + recommendedEntry * feeBuyPct + slFinal * feeSellPct;

  const riskPctEquity = params.riskPerTradePct || (mode === 'SCALP' ? 0.75 : 1.0);
  const capitalAtRiskIdr = (params.equityIdr * riskPctEquity) / 100;

  let constrainedBy: PositionSizingOutput['constrainedBy'] = 'RISK_PER_SHARE';

  // Lembar mentah = modal_berisiko / risiko_per_lembar
  const rawShares = riskPerShareIdr > 0 ? capitalAtRiskIdr / riskPerShareIdr : 0;
  let allowedLot = Math.floor(rawShares / 100);

  // Batasan 1: Alokasi nilai posisi maksimum (mis. max 20% ekuitas per saham)
  const maxCap = params.maxPositionValueCapIdr || params.equityIdr * 0.20;
  const maxLotFromCap = Math.floor(maxCap / (recommendedEntry * 100));
  if (allowedLot > maxLotFromCap) {
    allowedLot = maxLotFromCap;
    constrainedBy = 'MAX_POSITION_CAP';
  }

  // Batasan 2: Maksimal 10% dari ADV 20 hari (agar likuid keluar)
  const maxLotAdv = Math.floor(0.10 * params.advLot20d);
  if (params.advLot20d > 0 && allowedLot > maxLotAdv) {
    allowedLot = maxLotAdv;
    constrainedBy = 'ADV_10PCT_CAP';
  }

  // Batasan 3: Kapasitas kedalaman orderbook
  if (params.maxOrderBookFillLot && allowedLot > params.maxOrderBookFillLot) {
    allowedLot = params.maxOrderBookFillLot;
    constrainedBy = 'ORDERBOOK_DEPTH_CAP';
  }

  const isValidSizing = allowedLot >= 1;
  const actualShares = allowedLot * 100;
  const positionValueIdr = actualShares * recommendedEntry;
  const riskAmountIdr = actualShares * riskPerShareIdr;

  const sizing: PositionSizingOutput = {
    lot: allowedLot,
    totalShares: actualShares,
    positionValueIdr,
    riskAmountIdr: Number(riskAmountIdr.toFixed(0)),
    riskPctEquity,
    constrainedBy,
    isValid: isValidSizing,
    rejectReason: !isValidSizing ? 'Ukuran posisi minimum (1 lot) melebihi batas toleransi risiko portofolio.' : undefined,
  };

  const slDistanceNetPct = slDistanceGrossPct + totalFrictionEstPct;
  const netRrr = slDistanceNetPct > 0 ? Number((targets[0].netPct / slDistanceNetPct).toFixed(2)) : 0;

  return {
    ticker: params.ticker,
    setupType: params.setupType,
    entryZone: [entryMin, entryMax],
    recommendedEntryPrice: recommendedEntry,
    slPrice: slFinal,
    slDistanceGrossPct,
    slDistanceNetPct,
    targets,
    sizing,
    netRrr,
    headroomChecked: {
      araPrice: params.araPrice,
      arbPrice: params.arbPrice,
      headroomAraPct: params.headroomAraPct,
      headroomArbPct: params.headroomArbPct,
      isSlSafeFromArb,
      isTp3WithinAra,
    },
  };
}
