'use client';

import React from 'react';
import type { RankScore, CalibratedProbability } from '@/lib/calibration/types';
import { formatScoreVsProbability } from '@/lib/calibration/probability-engine';

interface ScoreProbabilityBadgeProps {
  rankScore?: number | RankScore | null;
  calibratedProbability?: CalibratedProbability | null;
  compact?: boolean;
  className?: string;
}

export default function ScoreProbabilityBadge({
  rankScore,
  calibratedProbability,
  compact = false,
  className = '',
}: ScoreProbabilityBadgeProps) {
  const formatted = formatScoreVsProbability(rankScore, calibratedProbability);

  const getVariantStyles = (variant: string) => {
    switch (variant) {
      case 'success':
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          border: 'rgba(16, 185, 129, 0.4)',
          text: '#10b981',
        };
      case 'warning':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          border: 'rgba(245, 158, 11, 0.4)',
          text: '#f59e0b',
        };
      case 'info':
        return {
          bg: 'rgba(59, 130, 246, 0.15)',
          border: 'rgba(59, 130, 246, 0.4)',
          text: '#3b82f6',
        };
      default:
        return {
          bg: 'rgba(148, 163, 184, 0.12)',
          border: 'rgba(148, 163, 184, 0.3)',
          text: '#94a3b8',
        };
    }
  };

  const probStyles = getVariantStyles(formatted.badge_variant);

  if (compact) {
    return (
      <div
        className={`score-prob-badge-compact ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.75rem',
          fontWeight: '600',
        }}
        title={formatted.tooltip}
      >
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '6px',
            background: 'rgba(139, 92, 246, 0.15)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            color: '#a78bfa',
          }}
        >
          Rank: {formatted.rank_score_display}
        </span>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '6px',
            background: probStyles.bg,
            border: `1px solid ${probStyles.border}`,
            color: probStyles.text,
          }}
        >
          Win Prob: {formatted.probability_display}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`score-prob-container ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '0.85rem 1rem',
        marginTop: '0.75rem',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {/* Metric 1: Ordinal Rank Score */}
        <div
          style={{
            background: 'rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            borderRadius: '8px',
            padding: '0.6rem 0.85rem',
          }}
        >
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#c4b5fd',
              marginBottom: '0.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Rank Score</span>
            <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Relative Priority</span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#a78bfa' }}>
            {formatted.rank_score_display}
          </div>
        </div>

        {/* Metric 2: Calibrated Win Probability */}
        <div
          style={{
            background: probStyles.bg,
            border: `1px solid ${probStyles.border}`,
            borderRadius: '8px',
            padding: '0.6rem 0.85rem',
          }}
        >
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: probStyles.text,
              marginBottom: '0.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Calibrated Win Prob</span>
            <span style={{ fontSize: '0.65rem', opacity: 0.9 }}>
              {formatted.is_calibrated ? 'Empirical' : 'Gated'}
            </span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: probStyles.text }}>
            {formatted.probability_display}
          </div>
        </div>
      </div>

      {/* Educational Micro-Footnote */}
      <div
        style={{
          marginTop: '0.5rem',
          fontSize: '0.7rem',
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.4rem',
          lineHeight: '1.35',
        }}
      >
        <span style={{ color: '#38bdf8' }}>ℹ️</span>
        <span>{formatted.tooltip}</span>
      </div>
    </div>
  );
}
