'use client';

import React from 'react';
import type { ModelCalibrationRecord } from '@/lib/calibration/types';

interface CalibrationCurveCardProps {
  calibration: ModelCalibrationRecord | null;
  className?: string;
}

export default function CalibrationCurveCard({
  calibration,
  className = '',
}: CalibrationCurveCardProps) {
  if (!calibration) {
    return (
      <div
        className={`glass-card ${className}`}
        style={{
          padding: '1.5rem',
          borderRadius: '16px',
          textAlign: 'center',
          color: '#94a3b8',
        }}
      >
        <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📊</div>
        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#f1f5f9' }}>
          Calibration Curve
        </div>
        <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
          No active calibration snapshot found for this horizon. Run calibration after resolving at least 30 historical setups.
        </p>
      </div>
    );
  }

  // SVG Chart dimensions
  const svgWidth = 320;
  const svgHeight = 220;
  const padding = 35;
  const plotWidth = svgWidth - 2 * padding;
  const plotHeight = svgHeight - 2 * padding;

  // Scale [0, 1] to SVG coordinates
  const scaleX = (val: number) => padding + val * plotWidth;
  const scaleY = (val: number) => svgHeight - padding - val * plotHeight;

  // Points for deciles
  const points = calibration.deciles
    .filter((d) => d.sample_count > 0)
    .map((d) => ({
      x: scaleX(d.mean_predicted_prob),
      y: scaleY(d.observed_win_rate),
      pred: (d.mean_predicted_prob * 100).toFixed(1),
      obs: (d.observed_win_rate * 100).toFixed(1),
      count: d.sample_count,
      decile: d.decile_index,
    }));

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div
      className={`glass-card ${className}`}
      style={{
        borderRadius: '16px',
        padding: '1.5rem',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>
            📊 Calibration Reliability Curve
          </h3>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Horizon: <strong style={{ color: '#38bdf8' }}>{calibration.horizon}</strong> • Model: {calibration.model_name}
          </div>
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            padding: '3px 8px',
            borderRadius: '6px',
            background: 'rgba(56, 189, 248, 0.12)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.3)',
          }}
        >
          N = {calibration.sample_size} Setups
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '0.6rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>
            Brier Score
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: '700', color: '#10b981' }}>
            {calibration.brier_score.toFixed(3)}
          </div>
          <div style={{ fontSize: '0.6rem', color: '#10b981' }}>Lower is better</div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '0.6rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>
            ECE (Error)
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: '700', color: '#38bdf8' }}>
            {(calibration.ece * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.6rem', color: '#38bdf8' }}>Calibration gap</div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '0.6rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>
            Log Loss
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: '700', color: '#a78bfa' }}>
            {calibration.log_loss != null ? calibration.log_loss.toFixed(3) : '-'}
          </div>
          <div style={{ fontSize: '0.6rem', color: '#a78bfa' }}>Cross-entropy</div>
        </div>
      </div>

      {/* SVG Reliability Diagram */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          {/* Grid lines */}
          <line
            x1={padding}
            y1={scaleY(0.5)}
            x2={svgWidth - padding}
            y2={scaleY(0.5)}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="3 3"
          />
          <line
            x1={scaleX(0.5)}
            y1={padding}
            x2={scaleX(0.5)}
            y2={svgHeight - padding}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="3 3"
          />

          {/* Diagonal Reference: Perfect Calibration (y = x) */}
          <line
            x1={scaleX(0)}
            y1={scaleY(0)}
            x2={scaleX(1)}
            y2={scaleY(1)}
            stroke="#64748b"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Model Curve Line */}
          {points.length > 1 && (
            <polyline
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              points={polylineStr}
            />
          )}

          {/* Data Points */}
          {points.map((p, idx) => (
            <g key={idx}>
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="#10b981"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
            </g>
          ))}

          {/* Axes */}
          <line
            x1={padding}
            y1={svgHeight - padding}
            x2={svgWidth - padding}
            y2={svgHeight - padding}
            stroke="#94a3b8"
            strokeWidth="1"
          />
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={svgHeight - padding}
            stroke="#94a3b8"
            strokeWidth="1"
          />

          {/* Axis Labels */}
          <text
            x={padding}
            y={svgHeight - 12}
            fontSize="9"
            fill="#94a3b8"
          >
            0%
          </text>
          <text
            x={svgWidth - padding - 15}
            y={svgHeight - 12}
            fontSize="9"
            fill="#94a3b8"
          >
            100%
          </text>
          <text
            x={svgWidth / 2}
            y={svgHeight - 8}
            fontSize="9"
            fill="#64748b"
            textAnchor="middle"
          >
            Predicted Win Probability →
          </text>

          <text
            x={10}
            y={padding + 5}
            fontSize="9"
            fill="#94a3b8"
          >
            100%
          </text>
          <text
            x={15}
            y={svgHeight - padding}
            fontSize="9"
            fill="#94a3b8"
          >
            0%
          </text>
        </svg>
      </div>

      {/* Legend & Note */}
      <div
        style={{
          marginTop: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          fontSize: '0.7rem',
          color: '#94a3b8',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '12px', height: '2px', background: '#64748b', display: 'inline-block' }} />
          <span>Perfect Calibration (Diagonal)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span>Observed Win Rate</span>
        </div>
      </div>
    </div>
  );
}
