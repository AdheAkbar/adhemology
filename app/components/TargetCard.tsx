'use client';

import ScoreProbabilityBadge from './ScoreProbabilityBadge';
import type { CalibratedProbability } from '@/lib/calibration/types';

interface TargetCardProps {
  emiten: string;
  sector?: string;
  currentPrice: number;
  targetRealistis: number;
  targetMax: number;
  rankScore?: number | null;
  calibratedProbability?: CalibratedProbability | null;
}

export default function TargetCard({
  emiten,
  sector,
  currentPrice,
  targetRealistis,
  targetMax,
  rankScore,
  calibratedProbability,
}: TargetCardProps) {
  const calculateGain = (target: number) => {
    const gain = ((target - currentPrice) / currentPrice) * 100;
    return `${gain >= 0 ? '+' : ''}${gain.toFixed(2)}`;
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>🎯 Heuristic Target Ladder (T1 &amp; T_max)</h3>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}>
          EMPIRICAL BENCHMARK
        </span>
      </div>
      <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--accent-primary)' }}>
          {emiten}
        </div>
        {sector && (
          <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
            {sector}
          </div>
        )}
      </div>
      
      <div className="grid grid-2" style={{ marginTop: '1rem' }}>
        {/* Target Realistis */}
        <div style={{
          background: 'var(--gradient-success)',
          borderRadius: '16px',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(56, 239, 125, 0.3)'
        }}>
          <div style={{ 
            fontSize: '0.875rem', 
            fontWeight: '600',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Target Realistis
          </div>
          <div style={{ 
            fontSize: '3rem', 
            fontWeight: '700',
            marginBottom: '0.5rem'
          }}>
            {targetRealistis}
          </div>
          <div style={{ 
            fontSize: '1rem',
            opacity: 0.9
          }}>
            {calculateGain(targetRealistis)}% gain
          </div>
        </div>

        {/* Target Max */}
        <div style={{
          background: 'var(--gradient-warning)',
          borderRadius: '16px',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(245, 87, 108, 0.3)'
        }}>
          <div style={{ 
            fontSize: '0.875rem', 
            fontWeight: '600',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Target Max
          </div>
          <div style={{ 
            fontSize: '3rem', 
            fontWeight: '700',
            marginBottom: '0.5rem'
          }}>
            {targetMax}
          </div>
          <div style={{ 
            fontSize: '1rem',
            opacity: 0.9
          }}>
            {calculateGain(targetMax)}% gain
          </div>
        </div>
      </div>

      <ScoreProbabilityBadge
        rankScore={rankScore}
        calibratedProbability={calibratedProbability}
      />
    </div>
  );
}
