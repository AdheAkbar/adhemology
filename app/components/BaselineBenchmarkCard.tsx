'use client';

import React from 'react';
import type { TargetLadder } from '@/lib/targets/types';
import type { CalibratedProbability } from '@/lib/calibration/types';

interface BaselineBenchmarkCardProps {
  emiten: string;
  currentPrice: number;
  targetLadder?: TargetLadder | null;
  calibratedProbability?: CalibratedProbability | null;
}

export default function BaselineBenchmarkCard({
  emiten,
  currentPrice,
  targetLadder,
  calibratedProbability,
}: BaselineBenchmarkCardProps) {
  if (!targetLadder) return null;

  const legacyT1 = targetLadder.legacy_adimology_target;
  const legacyTMax = targetLadder.legacy_adimology_max;
  const v6T1 = targetLadder.t1_realistic;
  const v6T2 = targetLadder.t2_stretch;
  const v6Invalidation = targetLadder.invalidation_price;
  const rrr = targetLadder.risk_reward_ratio;
  const isAcceptable = targetLadder.is_rrr_acceptable;

  const legacyGainPct = Number((((legacyT1 - currentPrice) / currentPrice) * 100).toFixed(2));
  const v6T1GainPct = Number((((v6T1 - currentPrice) / currentPrice) * 100).toFixed(2));
  const v6RiskPct = Number((((currentPrice - v6Invalidation) / currentPrice) * 100).toFixed(2));

  return (
    <div
      className="glass-card"
      style={{
        marginTop: '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.75), rgba(30, 41, 59, 0.75))',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
            ⚖️ Baseline Benchmark: Legacy vs Verified V6
          </h3>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Direct statistical comparison between original Adimology formula and V6 Barrier Engine
          </div>
        </div>
        <span
          style={{
            fontSize: '0.7rem',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontWeight: 600,
            background: isAcceptable ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: isAcceptable ? '#10b981' : '#ef4444',
            border: `1px solid ${isAcceptable ? '#10b981' : '#ef4444'}`,
          }}
        >
          {isAcceptable ? `RRR Valid (${rrr}x)` : `RRR Sub-optimal (${rrr}x)`}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>Parameter</th>
              <th style={{ padding: '8px 12px' }}>Legacy Model (Control)</th>
              <th style={{ padding: '8px 12px' }}>Verified V6 Engine</th>
              <th style={{ padding: '8px 12px' }}>Variance / Edge</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '10px 12px', fontWeight: 500, color: '#e2e8f0' }}>Target Realistis (T1)</td>
              <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>
                Rp {legacyT1} ({legacyGainPct >= 0 ? `+${legacyGainPct}` : legacyGainPct}%)
              </td>
              <td style={{ padding: '10px 12px', color: '#38ef7d', fontWeight: 600 }}>
                Rp {v6T1} (+{v6T1GainPct}%)
              </td>
              <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                {v6T1 - legacyT1 > 0 ? `+${v6T1 - legacyT1} pts` : `${v6T1 - legacyT1} pts`} (Fraksi aligned)
              </td>
            </tr>

            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '10px 12px', fontWeight: 500, color: '#e2e8f0' }}>Target Max / Stretch (T2)</td>
              <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>Rp {legacyTMax}</td>
              <td style={{ padding: '10px 12px', color: '#f5576c', fontWeight: 600 }}>
                Rp {v6T2} (Max: Rp {targetLadder.t_max})
              </td>
              <td style={{ padding: '10px 12px', color: '#94a3b8' }}>Structure & ARA capped</td>
            </tr>

            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '10px 12px', fontWeight: 500, color: '#e2e8f0' }}>Invalidation (Stop Loss)</td>
              <td style={{ padding: '10px 12px', color: '#f87171' }}>None (Unbounded)</td>
              <td style={{ padding: '10px 12px', color: '#fb7185', fontWeight: 600 }}>
                Rp {v6Invalidation} (-{v6RiskPct}%)
              </td>
              <td style={{ padding: '10px 12px', color: '#34d399' }}>ATR & Swing Low protection</td>
            </tr>

            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '10px 12px', fontWeight: 500, color: '#e2e8f0' }}>Risk-Reward Ratio</td>
              <td style={{ padding: '10px 12px', color: '#94a3b8' }}>N/A (No risk anchor)</td>
              <td style={{ padding: '10px 12px', color: isAcceptable ? '#38ef7d' : '#f87171', fontWeight: 600 }}>
                1 : {rrr}
              </td>
              <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                {isAcceptable ? '≥ 1.5x Required Threshold' : '< 1.5x Gated Warning'}
              </td>
            </tr>

            {calibratedProbability && (
              <tr>
                <td style={{ padding: '10px 12px', fontWeight: 500, color: '#e2e8f0' }}>Empirical Calibration</td>
                <td style={{ padding: '10px 12px', color: '#94a3b8' }}>Heuristic score (0-100)</td>
                <td style={{ padding: '10px 12px', color: '#60a5fa', fontWeight: 600 }}>
                  {calibratedProbability.calibrated_p}% probability (Decile {calibratedProbability.calibration_decile})
                </td>
                <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                  Brier Score {calibratedProbability.brier_score}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: '1rem',
          padding: '0.75rem',
          borderRadius: '8px',
          background: 'rgba(255, 255, 255, 0.03)',
          fontSize: '0.75rem',
          color: '#94a3b8',
          lineHeight: 1.5,
        }}
      >
        <strong>Analytical Rationale:</strong> {targetLadder.rationale}
      </div>
    </div>
  );
}
