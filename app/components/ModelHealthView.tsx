'use client';

import React from 'react';
import { ShieldCheck, Cpu, GitCompare, BarChart3, HelpCircle } from 'lucide-react';
import { REGISTERED_MODELS } from '@/lib/models/model-registry';

export default function ModelHealthView() {
  const champion = REGISTERED_MODELS.find((m) => m.status === 'CHAMPION')!;
  const challenger = REGISTERED_MODELS.find((m) => m.status === 'CHALLENGER')!;

  // Simulated decile calibration points
  const deciles = [
    { decile: 1, predicted: 0.15, observed: 0.14, count: 48 },
    { decile: 2, predicted: 0.28, observed: 0.29, count: 52 },
    { decile: 3, predicted: 0.39, observed: 0.38, count: 45 },
    { decile: 4, predicted: 0.48, observed: 0.49, count: 55 },
    { decile: 5, predicted: 0.58, observed: 0.60, count: 62 },
    { decile: 6, predicted: 0.67, observed: 0.65, count: 58 },
    { decile: 7, predicted: 0.76, observed: 0.78, count: 50 },
    { decile: 8, predicted: 0.85, observed: 0.83, count: 42 },
  ];

  const featureImportance = [
    { name: 'Net Flow Ratio (Institutional Proxy)', importance: 28.5 },
    { name: 'Distance to Session VWAP (in ATR)', importance: 22.0 },
    { name: 'Multi-Day Flow Persistence', importance: 18.2 },
    { name: 'Concentration HHI (CR3)', importance: 12.4 },
    { name: 'Relative Strength vs IHSG (5D)', importance: 9.6 },
    { name: 'Relative Volume (RVOL)', importance: 5.8 },
    { name: 'Orderbook Imbalance (Depth 5)', importance: 3.5 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Banner */}
      <div
        className="glass-card"
        style={{
          padding: '1.5rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>📊</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
              Model Health &amp; Calibration Dashboard
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Memastikan seluruh probabilitas yang dikeluarkan sistem telah diuji out-of-sample dan terkalibrasi secara empiris (tanpa overconfidence).
            </p>
          </div>
        </div>
      </div>

      {/* Champion vs Challenger Card */}
      <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
          <GitCompare size={20} color="#38bdf8" />
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Champion vs Challenger Protocol
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {/* Champion */}
          <div style={{ padding: '1.25rem', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                CURRENT PRODUCTION CHAMPION
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{champion.version}</span>
            </div>
            <h4 style={{ margin: '0.75rem 0 0.25rem 0', fontSize: '1.1rem', color: '#f8fafc' }}>
              {champion.name}
            </h4>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Out-of-Sample: {champion.out_of_sample_period}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#94a3b8' }}>Brier Score:</span>
                <div style={{ fontWeight: 700, color: '#f8fafc' }}>{champion.brier_score_oos}</div>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Calib. Error (ECE):</span>
                <div style={{ fontWeight: 700, color: '#f8fafc' }}>{(champion.expected_calibration_error_ece * 100).toFixed(1)}%</div>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Win Rate OOS:</span>
                <div style={{ fontWeight: 700, color: '#10b981' }}>{(champion.win_rate_empirical * 100).toFixed(1)}%</div>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Samples (N):</span>
                <div style={{ fontWeight: 700, color: '#f8fafc' }}>{champion.sample_count_oos}</div>
              </div>
            </div>
          </div>

          {/* Challenger */}
          <div style={{ padding: '1.25rem', borderRadius: '14px', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                SHADOW EXPERIMENTAL CHALLENGER
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{challenger.version}</span>
            </div>
            <h4 style={{ margin: '0.75rem 0 0.25rem 0', fontSize: '1.1rem', color: '#f8fafc' }}>
              {challenger.name}
            </h4>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Out-of-Sample: {challenger.out_of_sample_period}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#94a3b8' }}>Brier Score:</span>
                <div style={{ fontWeight: 700, color: '#38bdf8' }}>{challenger.brier_score_oos}</div>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Calib. Error (ECE):</span>
                <div style={{ fontWeight: 700, color: '#38bdf8' }}>{(challenger.expected_calibration_error_ece * 100).toFixed(1)}%</div>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Win Rate OOS:</span>
                <div style={{ fontWeight: 700, color: '#10b981' }}>{(challenger.win_rate_empirical * 100).toFixed(1)}%</div>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Samples (N):</span>
                <div style={{ fontWeight: 700, color: '#f8fafc' }}>{challenger.sample_count_oos}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calibration Curve & Feature Importance Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Calibration Deciles */}
        <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Calibration Curve (Decile Reliability)
          </h2>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
            Membandingkan mean probabilitas prediksi model terhadap win rate riil yang teramati. Garis diagonal sempurna menunjukkan kalibrasi ideal.
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '6px' }}>Decile</th>
                  <th style={{ padding: '6px' }}>P(Prediksi)</th>
                  <th style={{ padding: '6px' }}>Win Rate Riil</th>
                  <th style={{ padding: '6px' }}>Sampel (N)</th>
                  <th style={{ padding: '6px' }}>Deviasi</th>
                </tr>
              </thead>
              <tbody>
                {deciles.map((d) => {
                  const dev = Math.abs(d.predicted - d.observed);
                  return (
                    <tr key={d.decile} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px', fontWeight: 600 }}>D{d.decile}</td>
                      <td style={{ padding: '6px', color: '#38bdf8' }}>{(d.predicted * 100).toFixed(1)}%</td>
                      <td style={{ padding: '6px', color: '#10b981', fontWeight: 700 }}>{(d.observed * 100).toFixed(1)}%</td>
                      <td style={{ padding: '6px', color: '#94a3b8' }}>{d.count}</td>
                      <td style={{ padding: '6px', color: dev < 0.03 ? '#10b981' : '#fbbf24' }}>
                        {(dev * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feature Importance */}
        <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Feature Importance (Permutation Impact)
          </h2>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
            Bobot pengaruh relatif masing-masing fitur kuantitatif terhadap akurasi prediksi model outcome.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {featureImportance.map((f) => (
              <div key={f.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '3px' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{f.name}</span>
                  <span style={{ fontWeight: 600, color: '#38bdf8' }}>{f.importance}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', borderRadius: '9999px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{ width: `${f.importance * 3.2}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', borderRadius: '9999px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
