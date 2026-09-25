import assert from 'node:assert/strict';
import { GYMS, RIVALS, SHOP, createState, sanitizeState, power, nextRival, train, rest, work, buy, beginFight, fightTurn } from '../dist/engine.mjs';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const response = { push: 'counter', counter: 'grip', grip: 'push' };
function fight(input, timing = 0.5, readTells = true) {
  const started = beginFight(freeze(input));
  assert.ok(!started.error, started.error);
  let state = started.state;
  let battle = started.battle;
  while (!battle.finished) {
    const result = fightTurn(freeze(state), freeze(battle), readTells ? response[battle.telegraph] : battle.telegraph, timing);
    assert.ok(!result.error, result.error);
    state = result.state;
    battle = result.battle;
    assert.ok(battle.round <= 10, 'Fights cannot continue forever');
    assert.ok(battle.playerHp >= 0 && battle.enemyHp >= 0);
    assert.ok(battle.playerStamina >= 0 && battle.playerStamina <= 100);
  }
  assert.ok(battle.round >= 6 && battle.round <= 10, 'Fight resolves in 6–10 turns');
  return { state, battle };
}

assert.equal(GYMS.length, 4);
assert.equal(RIVALS.length, 12);
assert.equal(new Set(RIVALS.map(r => r.id)).size, 12);
assert.deepEqual(RIVALS.map(r => r.power), [9, 12, 16, 20, 25, 31, 38, 45, 53, 61, 71, 84]);
assert.ok(RIVALS.every(r => r.gym >= 0 && r.gym <= 3 && r.portrait >= 0 && r.portrait <= 3));
assert.ok(SHOP.every(item => item.cost > 0 && ['food', 'boost', 'gear'].includes(item.type)));

const initial = freeze(createState());
assert.equal(power(initial), 9);
assert.equal(nextRival(initial).id, 'rival-01');
const poorPurchase = buy(initial, 'belt');
assert.equal(poorPurchase.state, initial);
assert.ok(poorPurchase.error);
assert.equal(buy(initial, 'missing-item').state, initial);
assert.equal(train(freeze({ ...initial, energy: 0 }), 'strength', 1).error.includes('18'), true);
assert.equal(beginFight(freeze({ ...initial, energy: 19 })).error.includes('20'), true);
assert.equal(work(freeze({ ...initial, energy: 11 })).error.includes('12'), true);
assert.equal(rest(initial).state, initial);

const malformed = sanitizeState({
  ...initial, name: '<>\u0000  ', wins: 99, gym: -8, won: false, strength: Infinity, technique: NaN,
  endurance: -100, energy: Infinity, money: -50, workouts: NaN, totalWork: -1,
  respect: '900', playSeconds: Infinity, startedAt: Infinity,
  equipment: ['belt', 'belt', 'bad-id', '__proto__', null],
  buff: { id: 'protein', charges: Infinity }, log: [null, 5, 'one'], achievements: ['hacked'],
});
assert.equal(malformed.name, 'Дрищ');
assert.equal(malformed.wins, 12);
assert.equal(malformed.gym, 3);
assert.equal(malformed.won, true);
assert.equal(malformed.endurance, 1);
assert.equal(malformed.buff, null);
assert.deepEqual(malformed.equipment, ['belt']);
assert.deepEqual(malformed.log, ['one']);
assert.ok(!malformed.achievements.includes('hacked'));
for (const value of Object.values(malformed)) if (typeof value === 'number') assert.ok(Number.isFinite(value));
assert.equal(sanitizeState({ ...initial, version: 999 }).wins, 0);
assert.equal(sanitizeState(null).name, 'Дрищ');
assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(initial))), initial);

let supplemented = buy(freeze({ ...initial, money: 1000 }), 'protein').state;
for (let charge = 3; charge >= 1; charge--) {
  const result = train(freeze(supplemented), 'technique', 1);
  assert.equal(result.gains.technique, 8);
  assert.equal(result.gains.strength, 1);
  supplemented = result.state;
  assert.equal(supplemented.buff?.charges ?? 0, charge - 1);
}
const boughtGear = buy(freeze(supplemented), 'belt');
assert.ok(boughtGear.state.achievements.includes('first-gear'));
assert.equal(boughtGear.state.strength, supplemented.strength + 9);
assert.equal(buy(freeze(boughtGear.state), 'belt').state, boughtGear.state);
const serum = buy(freeze({ ...initial, money: 1000 }), 'serum').state;
assert.equal(power(serum), power(initial) + 10);
const serumFight = beginFight(freeze(serum));
assert.equal(serumFight.state.buff, null);
assert.equal(serumFight.battle.playerPower, power(initial) + 10);
const serumResult = fight(serum);
assert.equal(serumResult.state.energy, 85, 'Serum costs 15 energy after the fight');

const firstWin = fight(initial);
assert.equal(firstWin.battle.result, 'win');
assert.equal(firstWin.state.wins, 1);
assert.equal(firstWin.state.money, initial.money + RIVALS[0].reward);
assert.equal(fightTurn(freeze(firstWin.state), freeze(firstWin.battle), 'push').state, firstWin.state);
assert.equal(firstWin.state.achievements.includes('first-win'), true);
assert.ok(fight(initial, 0.5, false).battle.playerHp < firstWin.battle.playerHp, 'Reading the telegraph leaves more HP in an equal-power fight');
const staleFight = beginFight(initial);
assert.equal(fightTurn(freeze(firstWin.state), freeze(staleFight.battle), 'counter').state, firstWin.state, 'An old battle cannot award the same boss twice');
const impossible = freeze({ ...initial, wins: 11, gym: 3 });
const lost = fight(impossible);
assert.equal(lost.battle.result, 'loss');
assert.equal(lost.state.wins, 11);
assert.equal(lost.state.money, impossible.money);
assert.ok(rest(freeze(lost.state)).state.energy >= 20, 'A loss never prevents retry after resting');

const breathing = beginFight(initial);
const afterBreath = fightTurn(freeze(breathing.state), freeze({ ...breathing.battle, playerStamina: 10 }), 'breathe');
assert.equal(afterBreath.battle.playerStamina, 42);
assert.equal(afterBreath.battle.enemyHp, 100);
assert.ok(afterBreath.battle.playerHp < 100, 'Breathing exposes the player to damage');

// Play the whole campaign with average training timing, no purchases, and learned tells.
// On defeat the player trains once, rests as needed, then tries again.
let campaign = createState();
let losses = 0;
let rests = 0;
let attempts = 0;
const winsAt = [];
while (!campaign.won && attempts < 200) {
  while (campaign.energy < 20) { campaign = rest(freeze(campaign)).state; rests++; }
  const result = fight(campaign, 0.5);
  campaign = result.state;
  attempts++;
  if (result.battle.result === 'win') winsAt.push({ rival: campaign.wins, workouts: campaign.workouts, power: power(campaign), rounds: result.battle.round });
  else {
    losses++;
    while (campaign.energy < 18) { campaign = rest(freeze(campaign)).state; rests++; }
    const kind = ['strength', 'technique', 'endurance'][campaign.workouts % 3];
    campaign = train(freeze(campaign), kind, 0.65).state;
  }
}
assert.equal(campaign.won, true, 'All 12 bosses are reachable without purchases or random luck');
assert.equal(campaign.wins, 12);
assert.equal(campaign.gym, 3);
assert.equal(nextRival(campaign), null);
assert.ok(campaign.workouts >= 35 && campaign.workouts <= 65, 'Average timing campaign stays near training budget');
assert.deepEqual(campaign.achievements, ['first-workout', 'first-win', 'gym-two', 'legend']);
assert.equal(beginFight(campaign).state, campaign);
assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(campaign))), campaign);

// A player who prepares before challenging bosses needs only the 12 campaign fights.
// 87% is a useful UI readiness threshold; the remaining advantage comes from reading tells.
let prepared = createState();
let preparedFights = 0;
while (!prepared.won && preparedFights < 12) {
  const targetPower = Math.ceil(nextRival(prepared).power * 0.87);
  while (power(prepared) < targetPower) {
    if (prepared.energy < 18) prepared = rest(freeze(prepared)).state;
    prepared = train(freeze(prepared), ['strength', 'technique', 'endurance'][prepared.workouts % 3], 0.65).state;
  }
  if (prepared.energy < 20) prepared = rest(freeze(prepared)).state;
  const result = fight(prepared);
  assert.equal(result.battle.result, 'win', `Preparation should suffice for boss ${prepared.wins + 1}`);
  prepared = result.state;
  preparedFights++;
}
assert.equal(prepared.won, true);
assert.equal(preparedFights, 12);
assert.ok(prepared.workouts >= 45 && prepared.workouts <= 60, 'Prepared campaign meets the 45–60 workout budget');
console.log(JSON.stringify({
  ok: true,
  preparedCampaign: { workouts: prepared.workouts, fights: preparedFights, losses: 0, finalPower: power(prepared) },
  trialAndErrorCampaign: { workouts: campaign.workouts, losses, attempts, rests, finalPower: power(campaign) },
  winsAt,
}, null, 2));
