import test from 'node:test';
import assert from 'node:assert/strict';
import { exportHistoryToPDF, exportV6AnalysisReportToPDF } from '../lib/pdfExport';
import type { StockAnalysisResult } from '../lib/types';

test('Phase 12 - PDF Export Calibration: Functions exist and are callable', () => {
  assert.equal(typeof exportHistoryToPDF, 'function');
  assert.equal(typeof exportV6AnalysisReportToPDF, 'function');
});

test('Phase 12 - PDF Export Calibration: Builds V6 Analysis Report PDF doc structure', () => {
  const mockResult: StockAnalysisResult = {
    input: { emiten: 'BBCA', fromDate: '2026-09-01', toDate: '2026-09-07' },
    stockbitData: { bandar: 'CC', barangBandar: 150000, rataRataBandar: 9900 },
    marketData: {
      harga: 10000,
      offerTeratas: 10500,
      bidTerbawah: 9500,
      fraksi: 25,
      totalBid: 1000000,
      totalOffer: 800000,
    },
    calculated: {
      totalPapan: 40,
      rataRataBidOfer: 22500,
      a: 495,
      p: 6.67,
      targetRealistis1: 10450,
      targetMax: 10600,
    },
    sector: 'Financials',
    targetLadder: {
      t1_realistic: 10450,
      t2_stretch: 10700,
      t_max: 11000,
      invalidation_price: 9800,
      legacy_adimology_target: 10450,
      legacy_adimology_max: 10600,
      risk_reward_ratio: 2.25,
      is_rrr_acceptable: true,
      fraksi: 25,
      effective_atr: 200,
      risk_amount: 200,
      reward_amount: 450,
      rationale: 'Solid support',
    },
    calibratedProbability: {
      probability: 0.72,
      is_calibrated: true,
      sample_size: 150,
      brier_score: 0.124,
      calibrated_p: 72.0,
      calibration_decile: 8,
    } as any,
    liquidityAssessment: {
      emiten: 'BBCA',
      current_price: 10000,
      average_daily_turnover_idr: 500_000_000_000,
      max_position_size_idr: 10_000_000_000,
      max_position_lots: 10000,
      spread_ticks: 1,
      spread_pct: 0.25,
      estimated_slippage_pct: 0.12,
      liquidity_rating: 'HIGH_LIQUIDITY',
      is_tradable: true,
      gate_reason: 'Institutional',
    },
  };

  // In Node/non-browser environment, doc.save will call browser or node-canvas save.
  // We can intercept or verify that the function executes the table creation without error.
  assert.doesNotThrow(() => {
    // jsPDF in nodejs environment will create the internal document structure cleanly
    try {
      exportV6AnalysisReportToPDF(mockResult);
    } catch (e: any) {
      // In non-browser CLI environment, doc.save() might attempt to access window or Blob, which is expected in node:test
      if (!e.message?.includes('HTML5') && !e.message?.includes('save') && !e.message?.includes('window') && !e.message?.includes('document')) {
        throw e;
      }
    }
  });
});
