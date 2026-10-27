/**
 * lib/indicators/feature-engine.ts
 * L2 — Feature Engine: Continuous Normalization, 7-Cluster Decorrelation & MTF Alignment (PRD v2.0).
 * 
 * Strict Quant Protocol:
 * - Mengatasi T-01: Bobot cluster dipaksa berjumlah 1.00 (sum === 1.00).
 * - Mengatasi T-02: Fitur dikelompokkan ke 7 cluster independen; tidak ada penghitungan ganda.
 * - Mengatasi T-03: Normalisasi kontinu s_i = tanh(z_i / 2) menjaga magnitudo, bukan {-1,0,+1}.
 * - Bobot maksimum satu cluster <= 0.30.
 */

export type FeatureClusterName =
  | 'LOCATION'
  | 'FLOW'
  | 'VOLUME'
  | 'TREND'
  | 'MOMENTUM'
  | 'VOLATILITY'
  | 'FUNDAMENTAL';

export type TradingMode = 'SCALP' | 'SWING' | 'INVEST';

export interface RawFeatureInput {
  name: string;
  cluster: FeatureClusterName;
  rawValue: number;
  medianRegime: number;
  iqrRegime: number;
  internalWeight: number; // Bobot di dalam cluster
}

export interface NormalizedFeature {
  name: string;
  cluster: FeatureClusterName;
  rawValue: number;
  zScore: number;
  score: number; // [-1.0 .. +1.0] kontinu
  internalWeight: number;
}

export interface ClusterScore {
  cluster: FeatureClusterName;
  score: number; // [-1.0 .. +1.0]
  weight: number;
  featureCount: number;
}

export interface FeatureEngineResult {
  mode: TradingMode;
  clusterScores: Record<FeatureClusterName, ClusterScore>;
  rawConfluenceScore: number; // [-1.0 .. +1.0]
  scaledScore: number;         // [0 .. 100]
  mtfAlignment: number;       // 1 = fully aligned, 0 = neutral, -1 = conflicting
  mtfPenaltyApplied: boolean;
  finalScore: number;         // Adjusted for MTF conflict
}

/**
 * Bobot Prior per Cluster (Tabel PRD v2.0 §8.2).
 * Dipaksa tepat berjumlah 1.00 dan tidak ada yang > 0.30.
 */
export const CLUSTER_WEIGHTS: Record<TradingMode, Record<FeatureClusterName, number>> = {
  SCALP: {
    LOCATION: 0.26,
    FLOW: 0.24,
    VOLUME: 0.18,
    TREND: 0.14,
    MOMENTUM: 0.12,
    VOLATILITY: 0.06,
    FUNDAMENTAL: 0.00,
  },
  SWING: {
    TREND: 0.26,
    VOLUME: 0.20,
    LOCATION: 0.18,
    MOMENTUM: 0.14,
    FLOW: 0.12,
    VOLATILITY: 0.10,
    FUNDAMENTAL: 0.00,
  },
  INVEST: {
    TREND: 0.28,
    FUNDAMENTAL: 0.20,
    VOLUME: 0.18,
    LOCATION: 0.10,
    MOMENTUM: 0.10,
    VOLATILITY: 0.10,
    FLOW: 0.04,
  },
};

/**
 * Memvalidasi apakah bobot cluster valid sesuai PRD.
 */
export function validateClusterWeights(weights: Record<FeatureClusterName, number>): { valid: boolean; sum: number; maxWeight: number } {
  const sum = Object.values(weights).reduce((acc, w) => acc + w, 0);
  const maxWeight = Math.max(...Object.values(weights));
  const isSumValid = Math.abs(sum - 1.0) < 1e-6;
  const isMaxValid = maxWeight <= 0.30 + 1e-6;

  return {
    valid: isSumValid && isMaxValid,
    sum: Number(sum.toFixed(6)),
    maxWeight: Number(maxWeight.toFixed(4)),
  };
}

/**
 * Menghitung skor kontinu ter-normalisasi:
 * z_i = (x_i - median) / IQR
 * s_i = tanh(z_i / 2)  --> range [-1, +1]
 */
export function normalizeContinuous(rawValue: number, median: number, iqr: number): { zScore: number; score: number } {
  const safeIqr = iqr > 0 ? iqr : 1;
  const z = (rawValue - median) / safeIqr;
  const s = Math.tanh(z / 2);
  return {
    zScore: Number(z.toFixed(4)),
    score: Number(s.toFixed(4)),
  };
}

/**
 * Engine evaluasi fitur dan dekorelasi agregasi PRD v2.0.
 */
export function evaluateFeatureEngine(
  features: RawFeatureInput[],
  mode: TradingMode,
  mtfInputs?: {
    scoreExecutionTF: number; // e.g. 1m
    scoreContextTF: number;   // e.g. 15m
    scoreBiasTF: number;      // e.g. Daily
  }
): FeatureEngineResult {
  const weights = CLUSTER_WEIGHTS[mode];
  const weightValidation = validateClusterWeights(weights);
  if (!weightValidation.valid) {
    throw new Error(`Cluster weights configuration invalid for mode ${mode}: sum=${weightValidation.sum}, max=${weightValidation.maxWeight}`);
  }

  // 1. Normalisasi setiap fitur secara kontinu
  const normalizedMap: Record<FeatureClusterName, NormalizedFeature[]> = {
    LOCATION: [],
    FLOW: [],
    VOLUME: [],
    TREND: [],
    MOMENTUM: [],
    VOLATILITY: [],
    FUNDAMENTAL: [],
  };

  for (const f of features) {
    const { zScore, score } = normalizeContinuous(f.rawValue, f.medianRegime, f.iqrRegime);
    normalizedMap[f.cluster].push({
      name: f.name,
      cluster: f.cluster,
      rawValue: f.rawValue,
      zScore,
      score,
      internalWeight: f.internalWeight > 0 ? f.internalWeight : 1,
    });
  }

  // 2. Agregasi di dalam masing-masing cluster
  const clusterScores: Record<FeatureClusterName, ClusterScore> = {} as any;
  let rawConfluence = 0;

  for (const clusterKey of Object.keys(weights) as FeatureClusterName[]) {
    const clusterFeatures = normalizedMap[clusterKey];
    let clusterScoreVal = 0;

    if (clusterFeatures.length > 0) {
      const totalInternalWeight = clusterFeatures.reduce((acc, cf) => acc + cf.internalWeight, 0);
      const weightedSum = clusterFeatures.reduce((acc, cf) => acc + cf.score * cf.internalWeight, 0);
      clusterScoreVal = totalInternalWeight > 0 ? weightedSum / totalInternalWeight : 0;
    }

    const clusterWeight = weights[clusterKey];
    clusterScores[clusterKey] = {
      cluster: clusterKey,
      score: Number(clusterScoreVal.toFixed(4)),
      weight: clusterWeight,
      featureCount: clusterFeatures.length,
    };

    rawConfluence += clusterScoreVal * clusterWeight;
  }

  // 3. Konversi ke skala 0 - 100
  // rawConfluence berada di [-1.0 .. +1.0] -> dipetakan ke [0 .. 100]
  const scaledScore = Number((((rawConfluence + 1) / 2) * 100).toFixed(1));

  // 4. Multi-Timeframe Alignment
  let mtfAlignment = 1;
  let mtfPenaltyApplied = false;
  let finalScore = scaledScore;

  if (mtfInputs) {
    const signExec = Math.sign(mtfInputs.scoreExecutionTF);
    const signContext = Math.sign(mtfInputs.scoreContextTF);
    const signBias = Math.sign(mtfInputs.scoreBiasTF);

    if (signExec === signContext && signContext === signBias && signExec !== 0) {
      mtfAlignment = 1; // Fully aligned
    } else if (signExec !== 0 && signBias !== 0 && signExec !== signBias) {
      // Konflik keras: Eksekusi berlawanan arah dengan Bias timeframe harian
      mtfAlignment = -1;
      mtfPenaltyApplied = true;
      finalScore = Number((finalScore * 0.7).toFixed(1)); // Diskon 30%
    } else {
      mtfAlignment = 0; // Mixed
    }
  }

  return {
    mode,
    clusterScores,
    rawConfluenceScore: Number(rawConfluence.toFixed(4)),
    scaledScore,
    mtfAlignment,
    mtfPenaltyApplied,
    finalScore,
  };
}
