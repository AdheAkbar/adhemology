import { createSessionToken } from '../lib/auth';

async function main() {
  const sessionToken = await createSessionToken({ role: 'admin', user: 'tester' });
  const res = await fetch('http://localhost:3000/api/stock', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `adimology_session=${sessionToken}`,
    },
    body: JSON.stringify({
      emiten: 'BBCA',
      fromDate: '2026-09-09',
      toDate: '2026-09-09',
    }),
  });

  const text = await res.text();
  console.log('STATUS:', res.status);
  console.log('BODY:', text.slice(0, 500));
  try {
    const json = JSON.parse(text);
    console.log('Success:', json.success);
    console.log('Emiten:', json.data?.input?.emiten);
    console.log('Price:', json.data?.marketData?.harga);
    console.log('Flow State:', json.data?.accumulationProxy?.flow_state);
    console.log('Rank Score:', json.data?.accumulationProxy?.accumulation_proxy_score);
    console.log('P(Accumulation):', json.data?.accumulationProxy?.p_accumulation_like);
    console.log('P Status:', json.data?.accumulationProxy?.p_accumulation_like_status);
    console.log('Weighted Net-Buy Price:', json.data?.accumulationProxy?.flow_vwap_proxy);
    console.log('Setup:', json.data?.entryRiskPlan?.setup_type);
    console.log('Invalidation:', json.data?.entryRiskPlan?.invalidation_price);
    console.log('Target 1:', json.data?.entryRiskPlan?.target_1);
    console.log('Net RRR:', json.data?.entryRiskPlan?.net_rrr);
    console.log('Quant Decision:', json.data?.quantDecision?.decision);
    console.log('Decision Reasons:', json.data?.quantDecision?.reasons);
  } catch (e) {
    // not json
  }
}

main().catch(console.error);
