'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Filter,
  RefreshCw,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import type { DecisionType } from '@/lib/decisions/decision-gate';

interface ScannerItem {
  symbol: string;
  price: number;
  flowState: string;
  proxyScore: number;
  calibratedProb: number | null;
  ci95: [number, number] | null;
  setupType: string;
  entryZone: [number, number];
  invalidation: number;
  netRrr: number;
  decision: DecisionType;
  freshness: string;
  turnoverBillion: number;
}

// Initial realistic institutional scanner seeds
const SAMPLE_SCANNER_DATA: ScannerItem[] = [
  {
    symbol: 'BBCA',
    price: 9850,
    flowState: 'accumulation_like',
    proxyScore: 84.5,
    calibratedProb: 0.685,
    ci95: [0.552, 0.795],
    setupType: 'PULLBACK_VWAP_SUPPORT',
    entryZone: [9800, 9875],
    invalidation: 9650,
    netRrr: 2.15,
    decision: 'ENTER_NOW',
    freshness: 'LIVE (30s)',
    turnoverBillion: 345.8,
  },
  {
    symbol: 'TLKM',
    price: 3650,
    flowState: 'accumulation_like',
    proxyScore: 78.0,
    calibratedProb: 0.620,
    ci95: [0.485, 0.742],
    setupType: 'RECLAIM_FLOW_VWAP',
    entryZone: [3630, 3660],
    invalidation: 3560,
    netRrr: 1.85,
    decision: 'BUY_CONDITIONAL',
    freshness: 'LIVE (45s)',
    turnoverBillion: 182.4,
  },
  {
    symbol: 'ASII',
    price: 5350,
    flowState: 'accumulation_like',
    proxyScore: 72.5,
    calibratedProb: 0.585,
    ci95: [0.445, 0.712],
    setupType: 'BREAKOUT_RETEST',
    entryZone: [5300, 5375],
    invalidation: 5200,
    netRrr: 1.65,
    decision: 'WAIT_BREAKOUT_RETEST',
    freshness: 'LIVE (60s)',
    turnoverBillion: 115.6,
  },
  {
    symbol: 'BRIS',
    price: 2950,
    flowState: 'accumulation_like',
    proxyScore: 88.0,
    calibratedProb: 0.710,
    ci95: [0.575, 0.815],
    setupType: 'PULLBACK_VWAP_SUPPORT',
    entryZone: [2880, 2920],
    invalidation: 2800,
    netRrr: 2.45,
    decision: 'WAIT_PULLBACK',
    freshness: 'LIVE (25s)',
    turnoverBillion: 148.2,
  },
  {
    symbol: 'GOTO',
    price: 64,
    flowState: 'distribution_like',
    proxyScore: 32.0,
    calibratedProb: null,
    ci95: null,
    setupType: 'PULLBACK_VWAP_SUPPORT',
    entryZone: [63, 65],
    invalidation: 61,
    netRrr: 0.95,
    decision: 'NO_TRADE',
    freshness: 'LIVE (50s)',
    turnoverBillion: 42.1,
  },
  {
    symbol: 'BBNI',
    price: 5475,
    flowState: 'accumulation_like',
    proxyScore: 79.5,
    calibratedProb: 0.645,
    ci95: [0.510, 0.760],
    setupType: 'CONTINUATION_HIGHER_LOW',
    entryZone: [5450, 5500],
    invalidation: 5350,
    netRrr: 1.95,
    decision: 'ENTER_NOW',
    freshness: 'LIVE (15s)',
    turnoverBillion: 210.5,
  },
];

export default function LiveScanner() {
  const [filter, setFilter] = useState<'ALL' | 'ACTIONABLE' | 'WAIT' | 'NO_TRADE'>('ALL');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ScannerItem[]>(SAMPLE_SCANNER_DATA);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const filteredItems = items.filter((item) => {
    if (search && !item.symbol.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filter === 'ACTIONABLE') {
      return item.decision === 'ENTER_NOW' || item.decision === 'BUY_CONDITIONAL';
    }
    if (filter === 'WAIT') {
      return item.decision === 'WAIT_PULLBACK' || item.decision === 'WAIT_BREAKOUT_RETEST' || item.decision === 'WATCH';
    }
    if (filter === 'NO_TRADE') {
      return item.decision === 'NO_TRADE';
    }
    return true;
  });

  const getDecisionBadge = (d: DecisionType) => {
    switch (d) {
      case 'ENTER_NOW':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.5)', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
            <Zap size={12} /> ENTER NOW
          </span>
        );
      case 'BUY_CONDITIONAL':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.5)', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
            <CheckCircle size={12} /> CONDITIONAL
          </span>
        );
      case 'WAIT_PULLBACK':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.5)', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
            <Clock size={12} /> WAIT PULLBACK
          </span>
        );
      case 'WAIT_BREAKOUT_RETEST':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.5)', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
            <Clock size={12} /> WAIT RETEST
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.5)', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
            <ShieldAlert size={12} /> NO TRADE
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Market Regime Overview Banner */}
      <div
        className="glass-card"
        style={{
          padding: '1.25rem 1.5rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🧭</span>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
              Market Regime: <span style={{ color: '#10b981' }}>BULLISH MOMENTUM</span>
            </h2>
            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              IHSG: 7,542.8 (+0.65%)
            </span>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
            Broad institutional net inflow across Financials and Energy. Selective day-trading permitted with strict net RRR $\ge 1.5x$.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={handleRefresh}
            className="solid-btn"
            style={{
              padding: '0.5rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} /> Refresh Scanner
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilter('ALL')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: filter === 'ALL' ? 600 : 400,
              background: filter === 'ALL' ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: filter === 'ALL' ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
            }}
          >
            All Candidates ({items.length})
          </button>
          <button
            onClick={() => setFilter('ACTIONABLE')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: filter === 'ACTIONABLE' ? 600 : 400,
              background: filter === 'ACTIONABLE' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-card)',
              color: filter === 'ACTIONABLE' ? '#10b981' : 'var(--text-secondary)',
              border: filter === 'ACTIONABLE' ? '1px solid #10b981' : '1px solid var(--border-color)',
              cursor: 'pointer',
            }}
          >
            Actionable (Enter/Conditional)
          </button>
          <button
            onClick={() => setFilter('WAIT')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: filter === 'WAIT' ? 600 : 400,
              background: filter === 'WAIT' ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-card)',
              color: filter === 'WAIT' ? '#fbbf24' : 'var(--text-secondary)',
              border: filter === 'WAIT' ? '1px solid #fbbf24' : '1px solid var(--border-color)',
              cursor: 'pointer',
            }}
          >
            Pending Retest/Pullback
          </button>
          <button
            onClick={() => setFilter('NO_TRADE')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: filter === 'NO_TRADE' ? 600 : 400,
              background: filter === 'NO_TRADE' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-card)',
              color: filter === 'NO_TRADE' ? '#f87171' : 'var(--text-secondary)',
              border: filter === 'NO_TRADE' ? '1px solid #f87171' : '1px solid var(--border-color)',
              cursor: 'pointer',
            }}
          >
            Gated / No Trade
          </button>
        </div>

        <input
          type="text"
          placeholder="Filter emiten (e.g. BBCA)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            width: '220px',
          }}
        />
      </div>

      {/* Live Screener Table */}
      <div className="glass-card" style={{ borderRadius: '16px', overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Emiten</th>
                <th style={{ padding: '12px 16px' }}>Harga</th>
                <th style={{ padding: '12px 16px' }}>Flow State</th>
                <th style={{ padding: '12px 16px' }}>Proxy Score</th>
                <th style={{ padding: '12px 16px' }}>P(Target) Terkalibrasi</th>
                <th style={{ padding: '12px 16px' }}>Setup Type</th>
                <th style={{ padding: '12px 16px' }}>Entry Zone</th>
                <th style={{ padding: '12px 16px' }}>Invalidation</th>
                <th style={{ padding: '12px 16px' }}>Net RRR</th>
                <th style={{ padding: '12px 16px' }}>Decision</th>
                <th style={{ padding: '12px 16px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr
                  key={item.symbol}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background 0.2s',
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{item.symbol}</span>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}>
                        {item.freshness}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                    Rp {item.price.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background:
                          item.flowState === 'accumulation_like'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        color:
                          item.flowState === 'accumulation_like' ? '#10b981' : '#f87171',
                      }}
                    >
                      {item.flowState}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.proxyScore} / 100
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {item.calibratedProb !== null ? (
                      <div>
                        <span style={{ fontWeight: 700, color: '#10b981' }}>
                          {(item.calibratedProb * 100).toFixed(1)}%
                        </span>
                        {item.ci95 && (
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            95% CI [{(item.ci95[0] * 100).toFixed(0)}% - {(item.ci95[1] * 100).toFixed(0)}%]
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        N &lt; 30 (Uncalibrated)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {item.setupType.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                    {item.entryZone[0]} - {item.entryZone[1]}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#ef4444', fontWeight: 500 }}>
                    {item.invalidation}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: item.netRrr >= 1.5 ? '#10b981' : '#ef4444' }}>
                    {item.netRrr}x
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {getDecisionBadge(item.decision)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link
                      href={`/?symbol=${item.symbol}`}
                      className="solid-btn"
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        textDecoration: 'none',
                      }}
                    >
                      Detail <ArrowUpRight size={12} />
                    </Link>
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
