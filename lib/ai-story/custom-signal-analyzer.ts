/**
 * lib/ai-story/custom-signal-analyzer.ts - Custom Signal & News Intelligence Lab (Adimology V6)
 * Enables users to input custom signals, news articles, or chat tips for automated quantitative fact-checking.
 */

import { fetchMarketDetector, fetchOrderbook, getTopBroker, getBrokerSummary, parseLot } from '../stockbit';
import { calculateDynamicTargetsV2 } from '../targets/target-engine';
import { calculateConcentrationRatios, calculateAccumulationIntensity, determineFlowRegime, calculateBandarCostBasis } from '../broker-flow/hybrid-flow-engine';
import { assessLiquidityAndExecution } from '../execution/liquidity-gate';
import { calibrateScore } from '../calibration/probability-engine';
import { GoogleGenAI } from '@google/genai';

export type SignalType = 'SIGNAL' | 'NEWS' | 'RUMOR';

export type SignalVerdict =
  | 'CONFIRMED_ACCUMULATION' // Positive signal backed by smart money accumulation
  | 'RETAIL_TRAP_DISTRIBUTION' // Warning: Bullish news/signal while smart money is distributing
  | 'HIGH_RISK_MOMENTUM' // Fast momentum but wide spread / high volatility
  | 'NEUTRAL_WATCH';

export interface CustomSignalAnalysisResult {
  emiten: string;
  signal_type: SignalType;
  submitted_text: string;
  verdict: SignalVerdict;
  verdict_label: string;
  verdict_color: 'success' | 'danger' | 'warning' | 'info';
  verdict_score: number; // 0 to 100
  summary_reason: string;
  reality_check: {
    market_price: number;
    bandar_code: string;
    bandar_lots: number;
    bandar_avg_cost: number;
    price_vs_bandar_pct: number;
    retail_position: string;
    flow_regime: string;
    adi: number;
    cr3_spread_pct: number;
    liquidity_rating: string;
  };
  target_ladder: {
    t1_realistic: number;
    t1_gain_pct: number;
    t2_stretch: number;
    t2_gain_pct: number;
    invalidation: number;
    risk_pct: number;
    rrr: number;
    is_rrr_valid: boolean;
    calibrated_win_prob: number;
  };
  ai_insights: {
    catalysts_identified: string[];
    hidden_risks: string[];
    flow_alignment_analysis: string;
    recommended_action: {
      action: 'BUY_ACCUMULATE' | 'SELL_AVOID' | 'WAIT_PULLBACK' | 'SPECULATIVE_BUY';
      entry_range: string;
      take_profit: string;
      stop_loss: string;
      tactical_advice: string;
    };
  };
  timestamp: string;
}

const COMMON_IDX_TICKERS = [
  'BBCA', 'BBRI', 'BMRI', 'BBNI', 'ASII', 'TLKM', 'BRIS', 'ANTM', 'ADRO', 'MDKA',
  'ACES', 'PTBA', 'AMMN', 'BREN', 'ICBP', 'INDF', 'MEDC', 'PGAS', 'GOTO', 'ARTO',
  'UNVR', 'KLBF', 'CPIN', 'SMGR', 'INCO', 'HRUM', 'ITMG', 'AKRA', 'BUKA', 'EMTK',
  'TPIA', 'BRPT', 'INKP', 'TKIM', 'TOWR', 'TBIG', 'EXCL', 'ISAT', 'MYOR', 'MAPA'
];

/**
 * Automatically extracts the primary stock ticker from text or returns user override.
 */
export function extractEmitenFromText(text: string, manualOverride?: string): string {
  if (manualOverride && manualOverride.trim()) {
    return manualOverride.trim().toUpperCase();
  }

  const cleanText = text.toUpperCase();

  // 1. First check against known high-volume IDX tickers
  for (const ticker of COMMON_IDX_TICKERS) {
    const regex = new RegExp(`\\b${ticker}\\b`, 'i');
    if (regex.test(cleanText)) {
      return ticker;
    }
  }

  // 2. Generic 4 uppercase letters pattern
  const matches = cleanText.match(/\b([A-Z]{4})\b/g);
  if (matches && matches.length > 0) {
    // Filter out common Indonesian/English words of 4 letters
    const filtered = matches.filter(
      (m) => !['DARI', 'PADA', 'AKAN', 'BISA', 'YANG', 'DENG', 'SAAT', 'JUGA', 'KITA', 'NEWS', 'BUY', 'SELL', 'HOLD', 'POST', 'USER'].includes(m)
    );
    if (filtered.length > 0) {
      return filtered[0];
    }
  }

  return 'BBCA'; // Safe default
}

/**
 * Analyzes a custom trading signal, news clipping, or rumor against Adimology V6 quantitative truth.
 */
export async function analyzeCustomSignal(payload: {
  rawText: string;
  emiten?: string;
  signalType?: SignalType;
  fromDate?: string;
  toDate?: string;
}): Promise<CustomSignalAnalysisResult> {
  const { rawText, signalType = 'SIGNAL' } = payload;
  const emiten = extractEmitenFromText(rawText, payload.emiten);

  // If today is morning before market or toDate omitted, use latest completed trading day
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const toDate = payload.toDate || yesterday.toISOString().split('T')[0];
  
  // Default lookback: 7 days ago
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const fromDate = payload.fromDate || d.toISOString().split('T')[0];

  // 1. Fetch live Market Data & Broker Detector
  const [md, ob] = await Promise.all([
    fetchMarketDetector(emiten, fromDate, toDate).catch(() => null),
    fetchOrderbook(emiten).catch(() => null),
  ]);

  const topBroker = md ? getTopBroker(md) : null;
  const summary = md ? getBrokerSummary(md) : null;
  const obData = (ob as any)?.data || ob || {};
  const currentPrice = Number(obData.close || obData.last_price || (topBroker ? topBroker.rataRataBandar : 1000));

  const totalBid = parseLot(obData.total_bid_offer?.bid?.lot || 10000);
  const totalOffer = parseLot(obData.total_bid_offer?.offer?.lot || 10000);

  // 2. V6 Target Ladder & Invalidation
  const ladder = calculateDynamicTargetsV2({
    emiten,
    current_price: currentPrice,
    rata_rata_bandar: topBroker?.rataRataBandar || currentPrice,
    barang_bandar: topBroker?.barangBandar || 10000,
    ara: Number(obData.high || currentPrice * 1.25),
    arb: Number(obData.low || currentPrice * 0.75),
    total_bid: totalBid / 100,
    total_offer: totalOffer / 100,
  });

  // 3. Broker Flow Metrics
  const topBuyers = summary?.topBuyers || [];
  const topSellers = summary?.topSellers || [];
  const cr = calculateConcentrationRatios(topBuyers, topSellers);
  const adi = calculateAccumulationIntensity(topBuyers, topSellers);
  const flowRegime = determineFlowRegime(adi);

  const bandarCost = calculateBandarCostBasis(topBuyers, currentPrice);
  const bandarAvg = topBroker?.rataRataBandar || bandarCost.bandar_vwap;
  const priceVsBandarPct = bandarAvg > 0 ? Number((((currentPrice - bandarAvg) / bandarAvg) * 100).toFixed(1)) : 0;

  // 4. Liquidity & Calibration
  const liq = assessLiquidityAndExecution({
    emiten,
    current_price: currentPrice,
    average_daily_turnover_idr: Math.max(1_000_000_000, (totalBid + totalOffer) * currentPrice),
    best_bid: currentPrice,
    best_offer: currentPrice + ladder.fraksi,
  });

  const pRatio = (topBroker?.barangBandar || 10000) / Math.max(1, (totalBid + totalOffer) / 80);
  const score = Math.min(100, Math.max(10, Math.round(pRatio * 10)));
  const calibrated = calibrateScore(score);

  // 5. Synthesize Quantitative Reality Check & Verdict
  const isAccumulation = flowRegime === 'STRONG_ACCUMULATION' || flowRegime === 'MILD_ACCUMULATION';
  const isDistribution = flowRegime === 'STRONG_DISTRIBUTION' || flowRegime === 'MILD_DISTRIBUTION';
  const isDiscount = priceVsBandarPct <= 1.0; // Near or below bandar cost

  let verdict: SignalVerdict = 'NEUTRAL_WATCH';
  let verdictLabel = '🟡 NETRAL: Perlu Konfirmasi Volume Lebih Lanjut';
  let verdictColor: CustomSignalAnalysisResult['verdict_color'] = 'info';
  let verdictScore = 50;
  let summaryReason = '';

  if (isAccumulation && isDiscount && ladder.is_rrr_acceptable) {
    verdict = 'CONFIRMED_ACCUMULATION';
    verdictLabel = '🟢 SINYAL TERKONFIRMASI: Didukung Akumulasi Smart Money';
    verdictColor = 'success';
    verdictScore = Math.min(95, Math.round(70 + adi * 25));
    summaryReason = `Sinyal/berita ini SEJAJAR dengan aksi broker institusi (${topBroker?.bandar || 'Smart Money'}). Harga pasar (Rp ${currentPrice}) berada di area modal bandar (Rp ${bandarAvg}), dengan Risk-Reward Ratio unggul (${ladder.risk_reward_ratio}x).`;
  } else if (isDistribution) {
    verdict = 'RETAIL_TRAP_DISTRIBUTION';
    verdictLabel = '🔴 PERINGATAN: Potensi Retail Trap (Bandar Sedang Distribusi)';
    verdictColor = 'danger';
    verdictScore = Math.max(15, Math.round(40 + adi * 25));
    summaryReason = `WASPADA: Meskipun sinyal/berita terlihat menjanjikan, data broker flow menunjukkan fase ${flowRegime} (ADI: ${adi.toFixed(2)}). Smart money terpantau melepas barang ke retail saat berita beredar.`;
  } else if (liq.liquidity_rating === 'LOW_LIQUIDITY_WARNING' || liq.liquidity_rating === 'ILLIQUID_GATED') {
    verdict = 'HIGH_RISK_MOMENTUM';
    verdictLabel = '🟠 RISIKO TINGGI: Likuiditas Tipis / Rawan Volatilitas Ekstrem';
    verdictColor = 'warning';
    verdictScore = 45;
    summaryReason = `Saham ini memiliki likuiditas terbatas (${liq.spread_ticks} tick spread). Batasi ukuran posisi maksimal ${liq.max_position_lots} lot untuk mencegah dampak harga merugikan.`;
  } else {
    verdict = 'NEUTRAL_WATCH';
    verdictLabel = '🔵 PANTAU DULU: Tunggu Konfirmasi Aliran Uang Masuk';
    verdictColor = 'info';
    verdictScore = 55;
    summaryReason = `Aliran dana saat ini berimbang (Netral). Perhatikan penembusan level Invalidation Rp ${ladder.invalidation_price} atau Target Rp ${ladder.t1_realistic} sebelum entri agresif.`;
  }

  // 6. Gemini Intelligence Integration (if key configured)
  let catalysts = ['Aksi korporasi dan katalis berita spesifik dari teks yang dikirim'];
  let risks = [`Penurunan menembus batas Invalidation Rp ${ladder.invalidation_price}`];
  let aiFlowAnalysis = summaryReason;
  let recommendedAction = {
    action: isAccumulation ? ('BUY_ACCUMULATE' as const) : isDistribution ? ('SELL_AVOID' as const) : ('WAIT_PULLBACK' as const),
    entry_range: `Rp ${ladder.invalidation_price + ladder.fraksi} - Rp ${currentPrice}`,
    take_profit: `Target T1: Rp ${ladder.t1_realistic} | T2: Rp ${ladder.t2_stretch}`,
    stop_loss: `Invalidation: Rp ${ladder.invalidation_price}`,
    tactical_advice: summaryReason,
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Kamu adalah Chief Quantitative Investment Officer.
Berikut adalah teks berita/sinyal yang dikirim pengguna:
"""
${rawText}
"""

DATA RIIL MIKROSTRUKTUR BURSA UNTUK EMITEN ${emiten}:
- Harga Saat Ini: Rp ${currentPrice}
- Bandar Utama: ${topBroker?.bandar || 'N/A'} (Akumulasi: ${topBroker?.barangBandar || 0} lot)
- Harga Modal Bandar: Rp ${bandarAvg} (Selisih dari harga sekarang: ${priceVsBandarPct}%)
- Rezim Broker Flow: ${flowRegime} (ADI Intensity: ${adi.toFixed(2)}, CR3 Spread: ${(cr.net_cr3_spread * 100).toFixed(1)}%)
- Target Ladder: T1 Rp ${ladder.t1_realistic} (+${(((ladder.t1_realistic - currentPrice) / currentPrice) * 100).toFixed(1)}%), T2 Rp ${ladder.t2_stretch}, Invalidation Rp ${ladder.invalidation_price}
- Likuiditas: ${liq.liquidity_rating} (Maksimal lot aman: ${liq.max_position_lots} lot)

TUGAS:
1. Bedah teks di atas: apakah ini sinyal valid atau pom-pom retail trap?
2. Ekstrak 2-3 katalis kunci dan 2 risiko tersembunyi.
3. Berikan saran taktis trading yang sangat disiplin merujuk ke angka di atas.

Kembalikan HANYA format JSON berikut:
{
  "catalysts": ["katalis 1", "katalis 2"],
  "risks": ["risiko 1", "risiko 2"],
  "flow_alignment": "penjelasan 2 kalimat apakah berita ini sinkron atau bertentangan dengan aksi bandar",
  "tactical_advice": "saran eksekusi 2 kalimat"
}`;

      const geminiPromise = ai.models.generateContent({
        model: process.env.GEMINI_STORY_MODEL || 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const timerPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini call timed out')), 5000)
      );

      const response = await Promise.race([geminiPromise, timerPromise]);

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.catalysts) catalysts = parsed.catalysts;
        if (parsed.risks) risks = parsed.risks;
        if (parsed.flow_alignment) aiFlowAnalysis = parsed.flow_alignment;
        if (parsed.tactical_advice) recommendedAction.tactical_advice = parsed.tactical_advice;
      }
    } catch (err: any) {
      console.warn('[CustomSignalLab] Gemini reasoning note:', err.message);
    }
  }

  return {
    emiten,
    signal_type: signalType,
    submitted_text: rawText,
    verdict,
    verdict_label: verdictLabel,
    verdict_color: verdictColor,
    verdict_score: verdictScore,
    summary_reason: summaryReason,
    reality_check: {
      market_price: currentPrice,
      bandar_code: topBroker?.bandar || 'Smart Money',
      bandar_lots: topBroker?.barangBandar || 0,
      bandar_avg_cost: bandarAvg,
      price_vs_bandar_pct: priceVsBandarPct,
      retail_position: bandarCost.retail_positioning,
      flow_regime: flowRegime,
      adi: Number(adi.toFixed(2)),
      cr3_spread_pct: Number((cr.net_cr3_spread * 100).toFixed(1)),
      liquidity_rating: liq.liquidity_rating,
    },
    target_ladder: {
      t1_realistic: ladder.t1_realistic,
      t1_gain_pct: Number((((ladder.t1_realistic - currentPrice) / currentPrice) * 100).toFixed(1)),
      t2_stretch: ladder.t2_stretch,
      t2_gain_pct: Number((((ladder.t2_stretch - currentPrice) / currentPrice) * 100).toFixed(1)),
      invalidation: ladder.invalidation_price,
      risk_pct: Number((((currentPrice - ladder.invalidation_price) / currentPrice) * 100).toFixed(1)),
      rrr: ladder.risk_reward_ratio,
      is_rrr_valid: ladder.is_rrr_acceptable,
      calibrated_win_prob: calibrated.calibrated_p,
    },
    ai_insights: {
      catalysts_identified: catalysts,
      hidden_risks: risks,
      flow_alignment_analysis: aiFlowAnalysis,
      recommended_action: recommendedAction,
    },
    timestamp: new Date().toISOString(),
  };
}
