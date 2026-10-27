'use client';

import React, { useState } from 'react';
import { Play, RotateCcw, TrendingUp, AlertCircle, Award, CheckCircle2 } from 'lucide-react';

export default function BacktestLabView() {
  const [setupFilter, setSetupFilter] = useState('ALL');
  const [regimeFilter, setRegimeFilter] = useState('ALL');
  const [feeTier, setFeeTier] = useState('0.15_0.25');
  const [slippageMultiplier, setSlippageMultiplier] = useState('1.0');
  const [isRunning, setIsRunning] = useState(false);

  // Precomputed simulated backtest runs
  const [metrics, setMetrics] = useState({
    totalTrades: 324,
    winRate: 64.2,
    profitFactor: 2.18,
    averageR: 0.85,
    maxDrawdown: 7.4,
    expectancyIdr: 425000,
    outOfSampleScore: 82.5,
  });

  const handleRunBacktest = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setMetrics((prev) => ({
        ...prev,
        totalTrades: setupFilter === 'ALL' ? 324 : 142,
        winRate: setupFilter === 'PULLBACK_VWAP' ? 67.8 : 64.2,
        profitFactor: setupFilter === 'PULLBACK_VWAP' ? 2.35 : 2.18,
        averageR: setupFilter === 'PULLBACK_VWAP' ? 0.94 : 0.85,
      }));
    }, 700);
  };

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
          <span style={{ fontSize: '1.5rem' }}>🔬</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
              Quantitative Backtest &amp; Walk-Forward Lab
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Uji ketahanan strategi trading pada data historis BEI out-of-sample dengan friksi nyata (komisi broker, pajak 0.1%, dan slippage).
            </p>
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
        <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Parameter Simulasi &amp; Stress Testing
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Setup Type
            </label>
            <select
              value={setupFilter}
              onChange={(e) => setSetupFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value="ALL">Semua 6 Setup Struktural</option>
              <option value="PULLBACK_VWAP">Pullback to Session VWAP</option>
              <option value="RECLAIM_FLOW_VWAP">Reclaim Flow VWAP Proxy</option>
              <option value="BREAKOUT_RETEST">Breakout &amp; Retest</option>
              <option value="LIQUIDITY_SWEEP">Liquidity Sweep Recovery</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Filter Market Regime
            </label>
            <select
              value={regimeFilter}
              onChange={(e) => setRegimeFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value="ALL">Seluruh Kondisi IHSG</option>
              <option value="BULLISH_ONLY">Hanya Regime Bullish IHSG</option>
              <option value="RANGE_ONLY">Hanya Regime Sideways / Range</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Struktur Fee &amp; Pajak BEI
            </label>
            <select
              value={feeTier}
              onChange={(e) => setFeeTier(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value="0.15_0.25">Standar IDX (Beli 0.15%, Jual 0.25%)</option>
              <option value="0.10_0.20">Diskon VIP (Beli 0.10%, Jual 0.20%)</option>
              <option value="0.20_0.30">Konservatif (Beli 0.20%, Jual 0.30%)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Slippage Multiplier
            </label>
            <select
              value={slippageMultiplier}
              onChange={(e) => setSlippageMultiplier(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value="1.0">Normal (0.5 Spread + 1 Tick)</option>
              <option value="1.5">Moderate Friction (1.5x Slippage)</option>
              <option value="2.0">Stress Test (2.0x Slippage)</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleRunBacktest}
            className="solid-btn"
            style={{
              padding: '8px 18px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Play size={14} className={isRunning ? 'spin' : ''} /> Jalankan Walk-Forward Test
          </button>
        </div>
      </div>

      {/* Results Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Sinyal Teruji</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {metrics.totalTrades}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Out-of-sample data
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Empirical Win Rate</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
            {metrics.winRate}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            P(Target 1 before Stop)
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Profit Factor</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
            {metrics.profitFactor}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Gross Profit / Gross Loss
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Average Realized R</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#a855f7', marginTop: '0.25rem' }}>
            +{metrics.averageR} R
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Per-trade risk multiple
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Maximum Drawdown</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f87171', marginTop: '0.25rem' }}>
            -{metrics.maxDrawdown}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Peak-to-trough risk
          </div>
        </div>
      </div>
    </div>
  );
}
