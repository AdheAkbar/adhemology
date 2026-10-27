import { fetchMarketDetector, parseLot, getBrokerSummary } from '../lib/stockbit';

const STOCKS = ['PSAB', 'ARCI', 'BNGA', 'TUGU', 'ESSA'];

async function inspectMultiDay(emiten: string) {
  // 1D (2026-09-09)
  const d1 = await fetchMarketDetector(emiten, '2026-09-09', '2026-09-09');
  const s1 = getBrokerSummary(d1);

  // 3D (2026-09-05 to 2026-09-09)
  const d3 = await fetchMarketDetector(emiten, '2026-09-05', '2026-09-09');
  const s3 = getBrokerSummary(d3);

  // 7D (2026-09-01 to 2026-09-09)
  const d7 = await fetchMarketDetector(emiten, '2026-09-01', '2026-09-09');
  const s7 = getBrokerSummary(d7);

  return {
    emiten,
    '1D': {
      status: s1?.detector?.broker_accdist,
      top1_status: s1?.detector?.top1?.accdist,
      top1_amount: s1?.detector?.top1?.amount,
      top3_amount: s1?.detector?.top3?.amount,
      topBuyer: s1?.topBuyers?.[0]?.netbs_broker_code,
      topBuyerAvg: Math.round(Number(s1?.topBuyers?.[0]?.netbs_buy_avg_price || 0)),
      totalValue: s1?.detector?.value,
    },
    '3D': {
      status: s3?.detector?.broker_accdist,
      top1_status: s3?.detector?.top1?.accdist,
      top1_amount: s3?.detector?.top1?.amount,
      top3_amount: s3?.detector?.top3?.amount,
      topBuyer: s3?.topBuyers?.[0]?.netbs_broker_code,
      topBuyerAvg: Math.round(Number(s3?.topBuyers?.[0]?.netbs_buy_avg_price || 0)),
      totalValue: s3?.detector?.value,
    },
    '7D': {
      status: s7?.detector?.broker_accdist,
      top1_status: s7?.detector?.top1?.accdist,
      top1_amount: s7?.detector?.top1?.amount,
      top3_amount: s7?.detector?.top3?.amount,
      topBuyer: s7?.topBuyers?.[0]?.netbs_broker_code,
      topBuyerAvg: Math.round(Number(s7?.topBuyers?.[0]?.netbs_buy_avg_price || 0)),
      totalValue: s7?.detector?.value,
    },
  };
}

async function main() {
  for (const s of STOCKS) {
    const res = await inspectMultiDay(s);
    console.log(`\n================== ${s} MULTI-DAY FLOW ==================`);
    console.log(JSON.stringify(res, null, 2));
  }
}

main().catch(console.error);
