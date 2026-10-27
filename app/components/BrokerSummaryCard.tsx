'use client';

import type { BrokerSummaryData } from '@/lib/types';

interface BrokerSummaryCardProps {
  emiten: string;
  dateRange: string;
  brokerSummary: BrokerSummaryData;
  sector?: string;
}

export default function BrokerSummaryCard({ emiten, dateRange, brokerSummary, sector }: BrokerSummaryCardProps) {
  const { detector, topBuyers, topSellers } = brokerSummary;

  // Helper to format numbers
  const formatNumber = (num: number | string | undefined) => {
    if (num === undefined || num === null) return '-';
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return '-';
    return n.toLocaleString();
  };

  // Format value in Billions
  const formatBillions = (num: number) => {
    if (!num) return '-';
    const billions = num / 1_000_000_000;
    return billions.toFixed(1);
  };

  // Format value with K/M/B suffix
  const formatCompact = (valueStr: string) => {
    const num = parseFloat(valueStr);
    if (isNaN(num)) return '-';
    const absNum = Math.abs(num);
    if (absNum >= 1_000_000_000) {
      return (num / 1_000_000_000).toFixed(1) + 'B';
    } else if (absNum >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + 'M';
    } else if (absNum >= 1_000) {
      return (num / 1_000).toFixed(1) + 'K';
    }
    return num.toFixed(0);
  };

  // Get badge class for Acc/Dist status
  const getAccDistClass = (status: string) => {
    if (!status) return 'badge-neutral';
    const lower = status.toLowerCase();
    if (lower.includes('acc') && !lower.includes('small')) return 'badge-acc';
    if (lower.includes('neutral')) return 'badge-neutral';
    if (lower.includes('small dist')) return 'badge-small-dist';
    if (lower.includes('dist')) return 'badge-dist';
    return 'badge-neutral';
  };

  return (
    <div className="broker-summary-card">
      {/* Header */}
      <div className="compact-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="compact-ticker">+ {emiten.toUpperCase()}</div>
          {sector && (
            <div style={{ 
              fontSize: '0.7rem', 
              color: 'var(--text-muted)', 
              marginTop: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {sector}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ 
            fontSize: '0.85rem', 
            fontWeight: 800, 
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '4px',
            opacity: 0.8
          }}>
            Broker Summary
          </div>
          <div className="compact-date">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            {dateRange}
          </div>
        </div>
      </div>



      {/* Top Broker Summary Table */}
      <div className="compact-section">
        <table className="broker-table">
          <thead>
            <tr>
              <th></th>
              <th>Volume</th>
              <th>%</th>
              <th>Rp(B)</th>
              <th>Acc/Dist</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="row-label">Top 1</td>
              <td className="num">{formatNumber(detector.top1?.vol)}</td>
              <td className="num">{detector.top1?.percent?.toFixed(1)}</td>
              <td className="num">{formatBillions(detector.top1?.amount)}</td>
              <td><span className={`badge ${getAccDistClass(detector.top1?.accdist)}`}>{detector.top1?.accdist}</span></td>
            </tr>
            <tr>
              <td className="row-label">Top 3</td>
              <td className="num">{formatNumber(detector.top3?.vol)}</td>
              <td className="num">{detector.top3?.percent?.toFixed(1)}</td>
              <td className="num">{formatBillions(detector.top3?.amount)}</td>
              <td><span className={`badge ${getAccDistClass(detector.top3?.accdist)}`}>{detector.top3?.accdist}</span></td>
            </tr>
            <tr>
              <td className="row-label">Top 5</td>
              <td className="num">{formatNumber(detector.top5?.vol)}</td>
              <td className="num">{detector.top5?.percent?.toFixed(1)}</td>
              <td className="num">{formatBillions(detector.top5?.amount)}</td>
              <td><span className={`badge ${getAccDistClass(detector.top5?.accdist)}`}>{detector.top5?.accdist}</span></td>
            </tr>
            <tr>
              <td className="row-label">Average</td>
              <td className="num">{formatNumber(detector.avg?.vol)}</td>
              <td className="num">{detector.avg?.percent?.toFixed(1)}</td>
              <td className="num">{formatBillions(detector.avg?.amount)}</td>
              <td><span className={`badge ${getAccDistClass(detector.avg?.accdist)}`}>{detector.avg?.accdist}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Broker Statistics */}
      <div className="compact-section">
        <table className="broker-table broker-stats-table">
          <thead>
            <tr>
              <th></th>
              <th>Buyer</th>
              <th>Seller</th>
              <th>#</th>
              <th>Acc/Dist</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="row-label">Broker</td>
              <td className="num">{detector.total_buyer}</td>
              <td className="num">{detector.total_seller}</td>
              <td className="num">{detector.number_broker_buysell}</td>
              <td><span className={`badge ${getAccDistClass(detector.broker_accdist)}`}>{detector.broker_accdist}</span></td>
            </tr>
            <tr>
              <td className="row-label">Net Volume</td>
              <td colSpan={3} className="num-wide">{formatNumber(detector.volume)}</td>
              <td></td>
            </tr>
            <tr>
              <td className="row-label">Net Value</td>
              <td colSpan={3} className="num-wide">{formatBillions(detector.value)}B</td>
              <td></td>
            </tr>
            <tr>
              <td className="row-label">Average (Rp)</td>
              <td colSpan={3} className="num-wide">{detector.average ? Math.round(detector.average).toLocaleString() : '-'}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Top Brokers Detail */}
      <div className="compact-section">
        <table className="broker-table broker-detail-table">
          <thead>
            <tr>
              <th>BY</th>
              <th>B.val</th>
              <th>B.lot</th>
              <th>B.avg</th>
              <th>SL</th>
              <th>S.val</th>
              <th>S.lot</th>
              <th>S.avg</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map((i) => {
              const buyer = topBuyers[i];
              const seller = topSellers[i];
              return (
                <tr key={i}>
                  <td className="broker-code buyer">{buyer?.netbs_broker_code || '-'}</td>
                  <td className="num">{buyer ? formatCompact(buyer.bval) : '-'}</td>
                  <td className="num">{buyer ? formatCompact(buyer.blot) : '-'}</td>
                  <td className="num">{buyer ? Math.round(parseFloat(buyer.netbs_buy_avg_price)) : '-'}</td>
                  <td className="broker-code seller">{seller?.netbs_broker_code || '-'}</td>
                  <td className="num">{seller ? formatCompact(seller.sval.replace('-', '')) : '-'}</td>
                  <td className="num">{seller ? formatCompact(seller.slot.replace('-', '')) : '-'}</td>
                  <td className="num">{seller ? Math.round(parseFloat(seller.netbs_sell_avg_price)) : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
