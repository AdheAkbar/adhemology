'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Sliders,
  Shield,
  Clock,
} from 'lucide-react';

interface JournalRow {
  id: string;
  symbol: string;
  generatedAt: string;
  setup: string;
  entry: number;
  stop: number;
  target1: number;
  outcome: string;
  realizedR: number | null;
  mfe: number;
  mae: number;
  rootCause: string;
  modelVersion: string;
}

const SAMPLE_JOURNAL_DATA: JournalRow[] = [
  {
    id: 'SIG-20260908-01',
    symbol: 'BBCA',
    generatedAt: '2026-09-08 09:35',
    setup: 'Pullback to Session VWAP',
    entry: 9800,
    stop: 9650,
    target1: 10050,
    outcome: 'TARGET_1_HIT',
    realizedR: +1.67,
    mfe: 2.85,
    mae: 0.45,
    rootCause: 'none',
    modelVersion: 'v1.2.0-champion',
  },
  {
    id: 'SIG-20260908-02',
    symbol: 'TLKM',
    generatedAt: '2026-09-08 10:15',
    setup: 'Reclaim Flow VWAP Proxy',
    entry: 3620,
    stop: 3550,
    target1: 3740,
    outcome: 'TARGET_1_HIT',
    realizedR: +1.71,
    mfe: 3.40,
    mae: 0.80,
    rootCause: 'none',
    modelVersion: 'v1.2.0-champion',
  },
  {
    id: 'SIG-20260907-03',
    symbol: 'ASII',
    generatedAt: '2026-09-07 11:20',
    setup: 'Breakout Retest',
    entry: 5350,
    stop: 5225,
    target1: 5550,
    outcome: 'STOP_HIT',
    realizedR: -1.0,
    mfe: 0.95,
    mae: 2.45,
    rootCause: 'entry_too_far_from_vwap',
    modelVersion: 'v1.2.0-champion',
  },
  {
    id: 'SIG-20260907-04',
    symbol: 'BRIS',
    generatedAt: '2026-09-07 13:45',
    setup: 'Liquidity Sweep Recovery',
    entry: 2880,
    stop: 2800,
    target1: 3020,
    outcome: 'TARGET_1_HIT',
    realizedR: +1.75,
    mfe: 5.10,
    mae: 0.65,
    rootCause: 'none',
    modelVersion: 'v1.2.0-champion',
  },
  {
    id: 'SIG-20260906-05',
    symbol: 'GOTO',
    generatedAt: '2026-09-06 10:00',
    setup: 'Continuation Higher Low',
    entry: 66,
    stop: 63,
    target1: 71,
    outcome: 'AMBIGUOUS_BAR',
    realizedR: null,
    mfe: 7.5,
    mae: 4.5,
    rootCause: 'spread_too_wide',
    modelVersion: 'v1.2.0-champion',
  },
];

export default function SignalJournalView() {
  const [selectedCause, setSelectedCause] = useState<string>('ALL');

  const filtered = SAMPLE_JOURNAL_DATA.filter((row) => {
    if (selectedCause === 'ALL') return true;
    if (selectedCause === 'ERRORS') return row.outcome === 'STOP_HIT';
    return row.rootCause === selectedCause;
  });

  const getOutcomeBadge = (outcome: string) => {
    if (outcome === 'TARGET_1_HIT' || outcome === 'TARGET_2_HIT') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
          <CheckCircle2 size={12} /> {outcome}
        </span>
      );
    }
    if (outcome === 'STOP_HIT') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
          <XCircle size={12} /> STOP HIT
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
        <AlertCircle size={12} /> {outcome}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Win Rate (Resolved)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
            75.0%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            3 Wins / 1 Loss / 1 Ambiguous
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Average Realized R</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
            +1.03 R
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Net of IDX commissions &amp; tax
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Profit Factor</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#a855f7', marginTop: '0.25rem' }}>
            5.13
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Gross Win R / Gross Loss R
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ambiguous Collision Rate</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.25rem' }}>
            20.0%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Isolated as AMBIGUOUS_BAR
          </div>
        </div>
      </div>

      {/* Weekly Post-Mortem Governance Card */}
      <div
        className="glass-card"
        style={{
          padding: '1.5rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.75))',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
              🔬 Weekly Post-Mortem &amp; Learning Governance
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Analisis retrospektif otomatis terhadap kesalahan trading untuk mencegah over-fitting dan reaktifitas berlebih.
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '9999px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
            Period: Week 36 - 2026
          </span>
        </div>

        <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
              Faktor Utama Penyebab Kerugian:
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
              <li><strong>Entry Too Far From VWAP:</strong> Harga masuk pada ASII berada &gt; 2.2 ATR dari Session VWAP tanpa konfirmasi retest.</li>
              <li><strong>Spread Volatility:</strong> GOTO mengalami lonjakan spread bid-ask yang memicu ambiguitas bar eksekusi.</li>
            </ul>
          </div>

          <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
              Proposal Parameter (Anti-Reactionary Gate):
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                <strong>Usulan:</strong> Batasi jarak maksimum entry ke 1.8 ATR dari Session VWAP.
              </p>
              <div style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'inline-block', fontSize: '0.75rem' }}>
                STATUS: REJECTED_INSUFFICIENT_EVIDENCE (N = 4, butuh minimal N = 30 sampel terbukti)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Journal Table Section */}
      <div className="glass-card" style={{ borderRadius: '16px', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Daftar Sinyal &amp; Eksekusi Audit
          </h2>
          <select
            value={selectedCause}
            onChange={(e) => setSelectedCause(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
            }}
          >
            <option value="ALL">Semua Outcome</option>
            <option value="ERRORS">Hanya Stop Hit (Evaluasi Error)</option>
            <option value="entry_too_far_from_vwap">Penyebab: Entry Too Far From VWAP</option>
            <option value="spread_too_wide">Penyebab: Spread Too Wide</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Signal ID / Waktu</th>
                <th style={{ padding: '12px 16px' }}>Emiten</th>
                <th style={{ padding: '12px 16px' }}>Setup</th>
                <th style={{ padding: '12px 16px' }}>Entry</th>
                <th style={{ padding: '12px 16px' }}>Stop Loss</th>
                <th style={{ padding: '12px 16px' }}>Target 1</th>
                <th style={{ padding: '12px 16px' }}>Outcome</th>
                <th style={{ padding: '12px 16px' }}>Realized R</th>
                <th style={{ padding: '12px 16px' }}>MFE / MAE</th>
                <th style={{ padding: '12px 16px' }}>Root Cause</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.id}</div>
                    <div style={{ fontSize: '0.75rem' }}>{r.generatedAt}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {r.symbol}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {r.setup}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                    Rp {r.entry.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#ef4444' }}>
                    Rp {r.stop.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#10b981' }}>
                    Rp {r.target1.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {getOutcomeBadge(r.outcome)}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: (r.realizedR || 0) > 0 ? '#10b981' : (r.realizedR || 0) < 0 ? '#ef4444' : '#94a3b8' }}>
                    {r.realizedR !== null ? `${r.realizedR >= 0 ? '+' : ''}${r.realizedR} R` : '-'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#10b981' }}>+{r.mfe}%</span> / <span style={{ color: '#ef4444' }}>-{r.mae}%</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                      {r.rootCause}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
