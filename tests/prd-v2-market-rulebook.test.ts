import {
  ACTIVE_MARKET_RULEBOOK,
  isRulebookStale,
  getTickSize,
  roundToValidTick,
  getAutoRejectionBounds,
  calculateHeadroom,
  isFcaTradable,
} from '../lib/config/market-rulebook';

function testMarketRulebook() {
  console.log('--- TEST: Market Rulebook BEI v2.0 ---');

  // 1. Tick size schedule verification
  if (getTickSize(150) !== 1) throw new Error('Tick size for 150 must be 1');
  if (getTickSize(350) !== 2) throw new Error('Tick size for 350 must be 2');
  if (getTickSize(800) !== 5) throw new Error('Tick size for 800 must be 5');
  if (getTickSize(3000) !== 10) throw new Error('Tick size for 3000 must be 10');
  if (getTickSize(8000) !== 25) throw new Error('Tick size for 8000 must be 25');
  console.log('✓ Tick sizes match IDX regulations');

  // 2. Tick rounding
  if (roundToValidTick(150.4, 'DOWN') !== 150) throw new Error('Round down failed');
  if (roundToValidTick(150.1, 'UP') !== 151) throw new Error('Round up failed');
  if (roundToValidTick(3003, 'NEAREST') !== 3000) throw new Error('Round nearest failed');
  if (roundToValidTick(3006, 'NEAREST') !== 3010) throw new Error('Round nearest failed');
  console.log('✓ Tick rounding logic verified');

  // 3. Auto Rejection bounds (Asymmetric)
  // Price 100: ARA 35% -> 135, ARB 15% -> 85
  const bounds100 = getAutoRejectionBounds(100);
  if (bounds100.araPrice !== 135) throw new Error(`Expected ARA 135, got ${bounds100.araPrice}`);
  if (bounds100.arbPrice !== 85) throw new Error(`Expected ARB 85, got ${bounds100.arbPrice}`);

  // Price 1000: ARA 25% -> 1250, ARB 15% -> 850
  const bounds1000 = getAutoRejectionBounds(1000);
  if (bounds1000.araPrice !== 1250) throw new Error(`Expected ARA 1250, got ${bounds1000.araPrice}`);
  if (bounds1000.arbPrice !== 850) throw new Error(`Expected ARB 850, got ${bounds1000.arbPrice}`);
  console.log('✓ Asymmetric ARA/ARB bounds verified');

  // 4. Headroom calculation
  const headroom = calculateHeadroom(1000, 1250, 850);
  if (headroom.headroomAraPct !== 25) throw new Error('Headroom ARA should be 25%');
  if (headroom.headroomArbPct !== 15) throw new Error('Headroom ARB should be 15%');
  console.log('✓ Headroom calculation verified');

  // 5. FCA Tradability
  if (isFcaTradable('SCALP', true) !== false) throw new Error('SCALP on FCA must be forbidden');
  if (isFcaTradable('SWING', true) !== false) throw new Error('SWING on FCA must be forbidden');
  if (isFcaTradable('INVEST', true) !== true) throw new Error('INVEST on FCA allowed for thesis review');
  console.log('✓ FCA board trading restriction verified');

  // 6. Staleness Veto
  if (isRulebookStale('2026-09-20T00:00:00+07:00')) throw new Error('Should not be stale on 2026-09-20');
  if (!isRulebookStale('2026-10-16T00:00:00+07:00')) throw new Error('Must be stale on 2026-10-16');
  console.log('✓ Rulebook staleness veto verified');

  console.log('ALL MARKET RULEBOOK TESTS PASSED!\n');
}

testMarketRulebook();
