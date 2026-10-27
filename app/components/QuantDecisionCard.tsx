'use client';

import React from 'react';
import type { AccumulationProxyResult } from '@/lib/accumulation/types';
import type { EntryRiskPlan } from '@/lib/execution/entry-risk-engine';
import type { QuantDecisionResult } from '@/lib/decisions/decision-gate';

interface QuantDecisionCardProps {
  emiten: string;
  currentPrice: number;
  accumulationProxy?: AccumulationProxyResult;
  entryRiskPlan?: EntryRiskPlan | any;
  quantDecision?: {
    decision?: string;
    reasons?: string[];
    supporting_evidence?: string[];
    contradictory_evidence?: string[];
    passed_checks?: string[];
    failed_checks?: string[];
    no_trade_reasons?: string[];
    calibrated_probability?: number | null;
    confidence?: {
      label?: string;
    };
  };
}

export default function QuantDecisionCard({
  emiten,
  currentPrice,
  accumulationProxy,
  entryRiskPlan,
  quantDecision,
}: QuantDecisionCardProps) {
  if (!accumulationProxy && !entryRiskPlan && !quantDecision) {
    return null;
  }

  const decision = quantDecision?.decision || 'NO_TRADE';

  const getDecisionBadge = (dec: string) => {
    switch (dec) {
      case 'ENTER_NOW':
        return { bg: 'rgba(34, 197, 94, 0.2)', border: '#22c55e', text: '#4ade80', label: 'ENTER NOW (VERIFIED)' };
      case 'BUY_CONDITIONAL':
        return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#34d399', label: 'BUY CONDITIONAL' };
      case 'WAIT_PULLBACK':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fbbf24', label: 'WAIT FOR PULLBACK' };
      case 'WAIT_BREAKOUT_RETEST':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fbbf24', label: 'WAIT BREAKOUT RETEST' };
      case 'WATCH':
        return { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#60a5fa', label: 'ACCUMULATION WATCH' };
      case 'NO_TRADE':
      default:
        return { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#f87171', label: 'NO TRADE / GATED' };
    }
  };

  const badge = getDecisionBadge(decision);

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))',
      borderRadius: '16px',
      border: `1px solid ${badge.border}44`,
      padding: '1.5rem',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      color: '#f8fafc',
      fontFamily: 'inherit',
      marginTop: '1.5rem',
    }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '1rem',
        marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1rem',
          }}>
            ⚡
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.02em' }}>
                SmartMoney AI Quant Engine
              </h2>
              <span style={{
                background: 'rgba(255, 255, 255, 0.08)',
                fontSize: '0.7rem',
                padding: '2px 8px',
                borderRadius: '6px',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}>
                v2.0-Quant
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
              As-of {accumulationProxy?.as_of || new Date().toISOString()} • Institutional-Flow Proxy
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            padding: '6px 14px',
            borderRadius: '8px',
            background: badge.bg,
            border: `1px solid ${badge.border}`,
            color: badge.text,
            fontWeight: 700,
            fontSize: '0.85rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {badge.label}
          </div>
        </div>
      </div>

      {/* Top 4 Quant Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.25rem',
      }}>
        {/* Metric 1: Decoupled Rank Score */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '1rem',
        }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>
            Ordinal Rank Score
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8' }}>
            {accumulationProxy?.accumulation_proxy_score ?? '-'}
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}> / 100</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
            Relative cross-sectional ranking (NOT a win probability)
          </div>
        </div>

        {/* Metric 2: Flow State */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '1rem',
        }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>
            Flow State Proxy
          </div>
          <div style={{
            fontSize: '1.2rem',
            fontWeight: 700,
            color: accumulationProxy?.flow_state === 'accumulation_like' ? '#4ade80' : '#fbbf24',
            textTransform: 'uppercase',
          }}>
            {accumulationProxy?.flow_state?.replace('_', ' ') || 'NEUTRAL'}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
            Concentration CR3: {accumulationProxy ? `${accumulationProxy.top_buyer_concentration_cr3.toFixed(1)}%` : '-'}
          </div>
        </div>

        {/* Metric 3: Calibrated Win Probability */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '1rem',
        }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>
            Calibrated P(Target &gt; Stop)
          </div>
          {accumulationProxy?.p_accumulation_like !== null && accumulationProxy?.p_accumulation_like !== undefined ? (
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4ade80' }}>
                {(accumulationProxy.p_accumulation_like * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                Wilson 95% CI: [{accumulationProxy.confidence_interval_95 ? (accumulationProxy.confidence_interval_95[0] * 100).toFixed(0) : '-'}% - {accumulationProxy.confidence_interval_95 ? (accumulationProxy.confidence_interval_95[1] * 100).toFixed(0) : '-'}%]
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0' }}>
                Provisional (N &lt; 30)
              </div>
              <div style={{ fontSize: '0.7rem', color: '#fbbf24' }}>
                Gated: Insufficient OOS sample size for calibrated reading
              </div>
            </div>
          )}
        </div>

        {/* Metric 4: Net Flow VWAP Proxy */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '1rem',
        }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>
            Weighted Net-Buy Price Proxy
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#a78bfa' }}>
            Rp {accumulationProxy?.flow_vwap_proxy ? Math.round(accumulationProxy.flow_vwap_proxy).toLocaleString('id-ID') : currentPrice.toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
            Proxy only; does not infer operator's actual inventory
          </div>
        </div>
      </div>

      {/* Entry Risk Plan Bar (Lowest-Risk Candidate) */}
      {entryRiskPlan && (
        <div style={{
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            paddingBottom: '0.5rem',
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>
              🎯 LOWEST-RISK CANDIDATE UNDER CURRENT DATA
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Setup: <span style={{ color: '#f8fafc', fontWeight: 600 }}>{entryRiskPlan.setup_type.replace(/_/g, ' ').toUpperCase()}</span>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.75rem',
            textAlign: 'center',
          }}>
            <div style={{ padding: '0.5rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>ENTRY ZONE</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                Rp {Array.isArray(entryRiskPlan.entry_zone) ? `${entryRiskPlan.entry_zone[0]} - ${entryRiskPlan.entry_zone[1]}` : `${(entryRiskPlan.entry_zone as any)?.lower ?? '-'} - ${(entryRiskPlan.entry_zone as any)?.upper ?? '-'}`}
              </div>
            </div>

            <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ fontSize: '0.7rem', color: '#f87171' }}>INVALIDATION (DOWN)</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ef4444' }}>
                Rp {entryRiskPlan.invalidation_price}
              </div>
            </div>

            <div style={{ padding: '0.5rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
              <div style={{ fontSize: '0.7rem', color: '#4ade80' }}>TARGET 1</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#22c55e' }}>
                Rp {entryRiskPlan.target_1}
              </div>
            </div>

            <div style={{ padding: '0.5rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>NET RRR</div>
              <div style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: entryRiskPlan.net_rrr >= 1.5 ? '#4ade80' : '#fbbf24',
              }}>
                {entryRiskPlan.net_rrr.toFixed(2)}x
              </div>
            </div>

            <div style={{ padding: '0.5rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>FEES &amp; SLIPPAGE</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#94a3b8' }}>
                Rp {Math.round((entryRiskPlan as any).total_cost ?? entryRiskPlan.total_friction_cost ?? 0)} ({((((entryRiskPlan as any).total_cost ?? entryRiskPlan.total_friction_cost ?? 0) / ((entryRiskPlan as any).entry_price ?? entryRiskPlan.recommended_entry_price ?? 1)) * 100).toFixed(2)}%)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decision Gate Evidence & Reasons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1rem',
      }}>
        {/* Supporting Evidence */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: '10px',
          padding: '0.75rem 1rem',
          borderLeft: '3px solid #22c55e',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.5rem' }}>
            ✓ SUPPORTING EVIDENCE
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: '#cbd5e1', lineHeight: '1.5' }}>
            {(quantDecision?.supporting_evidence || accumulationProxy?.supporting_evidence || []).map((ev: string, i: number) => (
              <li key={i}>{ev}</li>
            ))}
            {(quantDecision?.supporting_evidence?.length === 0 && (!accumulationProxy?.supporting_evidence || accumulationProxy.supporting_evidence.length === 0)) && (
              <li style={{ color: '#64748b' }}>No strong positive structural confirmation yet.</li>
            )}
          </ul>
        </div>

        {/* Contradictory Evidence / Gate Reasons */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: '10px',
          padding: '0.75rem 1rem',
          borderLeft: '3px solid #ef4444',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f87171', marginBottom: '0.5rem' }}>
            ⚠️ CONTRADICTORY EVIDENCE / GATE REASONS
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: '#cbd5e1', lineHeight: '1.5' }}>
            {(quantDecision?.reasons || quantDecision?.contradictory_evidence || accumulationProxy?.contradictory_evidence || []).map((ev: string, i: number) => (
              <li key={i}>{ev}</li>
            ))}
            {(!quantDecision?.reasons || quantDecision.reasons.length === 0) && (
              <li style={{ color: '#4ade80' }}>All quantitative decision gates cleared.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Regulatory Institutional Disclaimer */}
      <div style={{
        marginTop: '1rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        fontSize: '0.68rem',
        color: '#64748b',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <span>
          IDX Fee Deductions: 0.15% Buy + 0.25% Sell/Tax. Slippage calibrated. Manual paper confirmation mandatory.
        </span>
        <span>
          Model: {accumulationProxy?.model_version || 'v2.0-quant'}
        </span>
      </div>
    </div>
  );
}
