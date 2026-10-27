/**
 * lib/execution/portfolio-risk-governor.ts
 * L10 — Portfolio Risk Governor (PRD v2.0).
 * 
 * Strict Quant Protocol:
 * - Mengatasi T-22: Menghilangkan ilusi diversifikasi dengan membatasi korelasi antarsaham (>0.7)
 *   dan batas konsentrasi sektor (max 30%).
 * - Batas total risiko terbuka <= 4% ekuitas.
 * - Circuit breaker harian (-2.5% kunci sistem sampai besok), mingguan (-5%), dan drawdown maksimum (-12%).
 */

export interface PositionRiskState {
  ticker: string;
  sector: string;
  mode: 'SCALP' | 'SWING' | 'INVEST';
  positionValueIdr: number;
  riskAmountIdr: number;
  riskPctEquity: number;
  correlationWithCandidate?: number;
}

export interface PortfolioRiskGovernorInput {
  totalEquityIdr: number;
  availableBuyingPowerIdr: number;
  activePositions: PositionRiskState[];
  candidateTicker: string;
  candidateSector: string;
  candidateMode: 'SCALP' | 'SWING' | 'INVEST';
  candidateRiskAmountIdr: number;
  candidatePositionValueIdr: number;
  dailyRealizedPnlPct: number; // e.g., -1.2%
  weeklyRealizedPnlPct: number;
  peakToTroughDrawdownPct: number;
  consecutiveLossCount: number;
  correlationWithCandidateMap?: Record<string, number>;
}

export interface PortfolioGovernorDecision {
  allowed: boolean;
  rejectReasons: string[];
  warnings: string[];
  maxAllowedLotMultiplier: number; // 1.0 = normal, 0.5 = derisking, 0 = blocked
  portfolioMetrics: {
    totalOpenRiskPct: number;
    afterCandidateOpenRiskPct: number;
    sectorExposurePct: number;
    concurrentPositionsCount: number;
  };
}

/**
 * Mengevaluasi kelayakan posisi baru berdasarkan batas risiko portofolio agregat.
 */
export function evaluatePortfolioRiskL10(input: PortfolioRiskGovernorInput): PortfolioGovernorDecision {
  const rejectReasons: string[] = [];
  const warnings: string[] = [];
  let sizeMultiplier = 1.0;

  const mode = input.candidateMode;

  // 1. CIRCUIT BREAKER HARIAN (-2.5% kunci sistem sampai besok)
  if (input.dailyRealizedPnlPct <= -2.5) {
    rejectReasons.push(
      `Daily Loss Circuit Breaker: Kerugian hari ini (${input.dailyRealizedPnlPct}%) telah menyentuh batas -2.5%. Sistem dikunci hingga sesi bursa esok.`
    );
  }

  // 2. CIRCUIT BREAKER MINGGUAN (-5.0% de-risking ukuran x0.5)
  if (input.weeklyRealizedPnlPct <= -5.0) {
    warnings.push(`Weekly Loss Alert: Kerugian mingguan (${input.weeklyRealizedPnlPct}%) memicu de-risking ukuran posisi 50%.`);
    sizeMultiplier = Math.min(sizeMultiplier, 0.5);
  }

  // 3. DRAWDOWN MAKSIMUM DARI PUNCAK (-12% paksa paper trading)
  if (input.peakToTroughDrawdownPct >= 12.0) {
    rejectReasons.push(
      `Drawdown Breaker: Penurunan portofolio (${input.peakToTroughDrawdownPct}%) telah menyentuh batas -12%. Rekomendasi dialihkan ke Paper Trading sampai evaluasi model selesai.`
    );
  }

  // 4. BATAS RUGI BERUNTUN (5 kali beruntun -> jeda 1 hari)
  if (input.consecutiveLossCount >= 5) {
    rejectReasons.push(
      `Consecutive Loss Limit: Terdeteksi 5 kekalahan beruntun. Sinyal dijeda untuk mencegah tilt dan meninjau kalibrasi model.`
    );
  }

  // 5. BATAS POSISI BERSAMAAN
  const maxPositions = mode === 'SCALP' ? 6 : 8;
  if (input.activePositions.length >= maxPositions) {
    rejectReasons.push(
      `Batas posisi aktif untuk mode ${mode} (${maxPositions} saham) telah tercapai. Harap tutup atau kurangi posisi yang ada terlebih dahulu.`
    );
  }

  // 6. BATAS TOTAL RISIKO TERBUKA (Maksimum 4% dari total ekuitas)
  const currentTotalOpenRiskIdr = input.activePositions.reduce((sum, p) => sum + p.riskAmountIdr, 0);
  const candidateRiskIdr = input.candidateRiskAmountIdr;
  const afterCandidateRiskIdr = currentTotalOpenRiskIdr + candidateRiskIdr;

  const currentOpenRiskPct = input.totalEquityIdr > 0 ? (currentTotalOpenRiskIdr / input.totalEquityIdr) * 100 : 0;
  const afterCandidateOpenRiskPct = input.totalEquityIdr > 0 ? (afterCandidateRiskIdr / input.totalEquityIdr) * 100 : 0;

  if (afterCandidateOpenRiskPct > 4.0) {
    rejectReasons.push(
      `Total risiko terbuka portofolio (${afterCandidateOpenRiskPct.toFixed(2)}%) melebihi batas aman maksimum 4.0% dari ekuitas.`
    );
  }

  // 7. BATAS EKSPOSUR SATU SEKTOR (Maksimum 30% nilai portofolio)
  const currentSectorValue = input.activePositions
    .filter((p) => p.sector === input.candidateSector)
    .reduce((sum, p) => sum + p.positionValueIdr, 0);
  const afterSectorValue = currentSectorValue + input.candidatePositionValueIdr;
  const sectorExposurePct = input.totalEquityIdr > 0 ? (afterSectorValue / input.totalEquityIdr) * 100 : 0;

  if (sectorExposurePct > 30.0) {
    rejectReasons.push(
      `Eksposur sektor ${input.candidateSector} (${sectorExposurePct.toFixed(1)}%) melebihi batas konsentrasi 30.0% dari portofolio.`
    );
  }

  // 8. BATAS KORELASI TINGGI (ρ > 0.7 diperlakukan sebagai satu taruhan)
  if (input.correlationWithCandidateMap) {
    for (const pos of input.activePositions) {
      const rho = input.correlationWithCandidateMap[pos.ticker] ?? 0;
      if (rho > 0.70) {
        warnings.push(
          `Korelasi tinggi terdeteksi dengan posisi aktif ${pos.ticker} (ρ=${rho.toFixed(2)}). Diversifikasi semu: kedua posisi diperlakukan sebagai satu eksposur risiko tunggal.`
        );
        sizeMultiplier = Math.min(sizeMultiplier, 0.7);
        break;
      }
    }
  }

  // 9. CEK BUYING POWER (Siklus Penyelesaian Bursa T+2)
  if (input.candidatePositionValueIdr > input.availableBuyingPowerIdr) {
    rejectReasons.push(
      `Buying power kas tersedia (Rp ${(input.availableBuyingPowerIdr / 1e6).toFixed(1)} jt) tidak mencukupi nilai posisi yang direncanakan (Rp ${(input.candidatePositionValueIdr / 1e6).toFixed(1)} jt).`
    );
  }

  const allowed = rejectReasons.length === 0;

  return {
    allowed,
    rejectReasons,
    warnings,
    maxAllowedLotMultiplier: allowed ? sizeMultiplier : 0,
    portfolioMetrics: {
      totalOpenRiskPct: Number(currentOpenRiskPct.toFixed(2)),
      afterCandidateOpenRiskPct: Number(afterCandidateOpenRiskPct.toFixed(2)),
      sectorExposurePct: Number(sectorExposurePct.toFixed(1)),
      concurrentPositionsCount: input.activePositions.length,
    },
  };
}
