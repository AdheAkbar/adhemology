'use client';

import React from 'react';
import { Database, CheckCircle, AlertTriangle, XCircle, ShieldAlert, Clock, RefreshCw } from 'lucide-react';
import { buildCapabilityMatrix } from '@/lib/data-truth/capability-matrix';

export default function DataHealthView() {
  const matrix = buildCapabilityMatrix({
    hasStockbitToken: true,
    hasGeminiKey: true,
    lastStockbitSuccess: new Date().toISOString(),
    tokenFreshnessSec: 45,
  });

  const capabilities = Object.values(matrix);

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'READY':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
            <CheckCircle size={12} /> READY
          </span>
        );
      case 'DEGRADED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
            <AlertTriangle size={12} /> DEGRADED
          </span>
        );
      case 'DISABLED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
            <Clock size={12} /> DISABLED (REGULATION)
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '3px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
            <XCircle size={12} /> UNAVAILABLE
          </span>
        );
    }
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
          <span style={{ fontSize: '1.5rem' }}>🛡️</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
              Data Truth &amp; Provenance Matrix
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Transparansi status 14 kapabilitas data pasar, latensi feed, dan penegakan batas regulasi bursa (closed session broker summary).
            </p>
          </div>
        </div>
      </div>

      {/* Regulatory Notice Card */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderRadius: '14px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <ShieldAlert size={20} color="#60a5fa" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#93c5fd' }}>
              Prinsip Kepatuhan Regulasi IDX (Penutupan Kode Broker Intraday)
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              Sejak Desember 2021, PT Bursa Efek Indonesia menutup kode broker selama jam perdagangan berlangsung (closed session).
              Oleh karena itu, sistem SmartMoney AI <strong>secara tegas menolak mengklaim data broker flow sebagai real-time tick by tick</strong> selama sesi bursa. Data broker flow dihitung berdasarkan running trade chart harian dan snapshot pasca-penutupan sesi dengan label status <code>EOD</code> / <code>DELAYED</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Capability Matrix Table */}
      <div className="glass-card" style={{ borderRadius: '16px', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            14 Market Capabilities Status
          </h2>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Kapabilitas</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Sumber Data</th>
                <th style={{ padding: '12px 16px' }}>Freshness (Detik)</th>
                <th style={{ padding: '12px 16px' }}>Horizon yang Didukung</th>
                <th style={{ padding: '12px 16px' }}>Catatan / Alasan</th>
              </tr>
            </thead>
            <tbody>
              {capabilities.map((c) => (
                <tr key={c.name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.name}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {getStatusBadge(c.state)}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {c.source}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                    {c.freshness_sec !== null ? `${c.freshness_sec}s` : '-'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#94a3b8' }}>
                    {c.usable_horizons.join(', ') || 'None'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {c.reason_code}
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
