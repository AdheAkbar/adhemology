import { runAdimologyV2Pipeline } from '../lib/orchestrator/v2-pipeline';

async function test() {
  try {
    const res = await runAdimologyV2Pipeline({
      ticker: 'BBCA',
      price: 6450,
      openPrice: 6500,
      araPrice: 7800,
      arbPrice: 5525,
      bestBid: 6450,
      bestOffer: 6475,
      totalBidLots: 548623,
      totalOfferLots: 648106,
      brokerSummary: {
        topBuyers: [{ broker: 'YU', volume: 386979, price: 6408 }],
        topSellers: [{ broker: 'TP', volume: 386979, price: 6420 }],
        detector: { average: 6414, volume: 456220, value: 292600000000, number_broker_buysell: 20000 }
      },
      brokerData: {
        bandar: 'YU',
        barangBandar: 386979,
        rataRataBandar: 6408
      },
      sector: 'Financials',
      mode: 'SCALP'
    });
    console.log('res.decision keys:', Object.keys(res.decision));
    console.log('res.decision:', res.decision);
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
