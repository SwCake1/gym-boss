import assert from 'node:assert/strict';
import {
  GYMS, RIVALS, SHOP, createState, sanitizeState, power, nextRival,
  train, trainingDifficulty, liftQuality, rest, work, workPayout, buy, beginFight, fightTurn, fightTimingWindow,
  fightMovePreview, fightMaxStamina, fightStartingStamina, migrateBattle,
  RANDOM_EVENTS, advanceRandomEvent,
} from '../dist/engine.mjs';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function fight(input, timings = [0.5]) {
  const started = beginFight(freeze(input));
  assert.ok(!started.error, started.error);
  let state = started.state;
  let battle = started.battle;
  while (!battle.finished) {
    const result = fightTurn(freeze(state), freeze(battle), 'attack', timings[battle.round % timings.length]);
    assert.ok(!result.error, result.error);
    state = result.state;
    battle = result.battle;
    assert.ok(battle.round < 1000, 'A fight must eventually end through health or stamina');
    assert.ok(battle.playerHp >= 0 && battle.enemyHp >= 0);
    assert.ok(battle.playerStamina >= 0 && battle.playerStamina <= battle.maxStamina);
  }
  return { state, battle };
}

assert.equal(GYMS.length, 4);
assert.equal(RIVALS.length, 12);
assert.equal(new Set(RIVALS.map(r => r.id)).size, 12);
assert.ok(RIVALS.every(r => r.gym >= 0 && r.gym <= 3));
assert.deepEqual(RIVALS.map(r => r.portrait), Array.from({ length: 12 }, (_, i) => i));
assert.ok(RIVALS.every(r => r.timingPeriod > 0 && r.timingBaseWindow > 0));
assert.ok(RIVALS[2].timingPeriod < RIVALS[5].timingPeriod && RIVALS[2].timingBaseWindow > RIVALS[5].timingBaseWindow,
  'Fast wide and slow narrow bosses should have distinct profiles');
assert.ok(SHOP.every(item => item.cost > 0 && ['food', 'boost', 'gear'].includes(item.type)));
const trainingLevels = GYMS.map((_, gym) => trainingDifficulty(gym, gym * 15));
for (let gym = 1; gym < trainingLevels.length; gym++) {
  const before = trainingLevels[gym - 1], current = trainingLevels[gym];
  assert.ok(current.liftSpeed > before.liftSpeed && current.liftZone < before.liftZone);
  assert.ok(current.gripLimit < before.gripLimit);
  assert.ok(current.cardioHigh - current.cardioLow < before.cardioHigh - before.cardioLow);
  assert.ok(current.cardioDecay > before.cardioDecay);
  assert.ok(current.cardioHigh - current.cardioLow >= 11, 'Cardio zone must remain reachable after one step');
}
assert.equal(liftQuality(75, trainingLevels[0].liftZone), 1);
assert.equal(liftQuality(99, trainingLevels[0].liftZone), 0);
assert.ok(liftQuality(90, trainingLevels[3].liftZone) < liftQuality(90, trainingLevels[0].liftZone));

const initial = freeze(createState());
assert.equal(power(initial), 9);
assert.equal(nextRival(initial).id, 'rival-01');
assert.equal(buy(initial, 'belt').state, initial);
assert.equal(buy(initial, 'missing-item').state, initial);
assert.ok(train(freeze({ ...initial, energy: 0 }), 'strength', 1).error.includes('18'));
for (const [kind, otherStats] of [
  ['strength', ['technique', 'endurance']],
  ['technique', ['strength', 'endurance']],
  ['endurance', ['strength', 'technique']],
]) {
  for (const [quality, gain] of [[0, 0], [0.5, 3], [1, 6]]) {
    const result = train(initial, kind, quality);
    assert.equal(result.gains[kind], gain);
    assert.ok(otherStats.every(stat => result.gains[stat] === 0));
    assert.equal(result.state.energy, initial.energy - 18);
  }
}
assert.ok(beginFight(freeze({ ...initial, energy: 19 })).error.includes('20'));
assert.ok(work(freeze({ ...initial, energy: 11 })).error.includes('12'));
assert.equal(rest(initial).state, initial);
const tired = freeze({ ...initial, energy: 20 });
assert.equal(rest(tired).restored, 40);
assert.equal(rest(freeze({ ...initial, energy: 90 })).restored, 10);
assert.equal(work(tired, 0).earned, 10);
assert.equal(work(tired, 1).earned, 18);
assert.equal(work(tired, 3).earned, 34);
assert.equal(work(tired, 9).earned, 34, 'hits are capped at three throws');
assert.equal(work(tired, 2.7).hits, 2, 'partial hits do not round up');
assert.equal(work(tired, NaN).earned, 10);
assert.equal(work(freeze({ ...tired, gym: 3 }), 0).earned, 10, 'the minimum stays 10 in every gym');
assert.equal(work(freeze({ ...tired, gym: 3 }), 3).earned, 79);
assert.equal(work(tired, 2).message, 'Полотенец в корзине: 2 из 3. Заработал 26 ₽ (10 ₽ за смену + 2 × 8 ₽).');
assert.equal(work(tired, 0).message, 'Полотенец в корзине: 0 из 3. Заработал 10 ₽ — только минимальная ставка.');
for (let gym = 0; gym < 4; gym++) {
  const pay = workPayout(gym);
  for (let hits = 0; hits <= 3; hits++) assert.equal(work(freeze({ ...tired, gym }), hits).earned, pay.base + hits * pay.perHit);
  assert.equal(work(freeze({ ...tired, gym }), 3).earned, pay.max);
}

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
assert.equal(sanitizeState({ ...initial, version: 999 }).wins, 0);
assert.equal(sanitizeState(null).name, 'Дрищ');
assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(initial))), initial);

assert.equal(RANDOM_EVENTS.length, 30);
assert.equal(new Set(RANDOM_EVENTS.map(event => event.id)).size, 30);
let eventState = initial;
let occurred = [];
for (let action = 1; action <= 10; action++) {
  const result = advanceRandomEvent(freeze(eventState), () => 0);
  eventState = result.state;
  if (result.event) occurred.push({ action, id: result.event.id });
}
assert.deepEqual(occurred, [{ action: 10, id: 'E01' }]);
assert.equal(eventState.eventCountdown, 10);
assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(eventState))).seenEvents, ['E01']);
for (let action = 11; action <= 300; action++) {
  const result = advanceRandomEvent(freeze(eventState), () => 0);
  eventState = result.state;
  if (result.event) occurred.push({ action, id: result.event.id });
}
assert.equal(occurred.length, 30);
assert.deepEqual(occurred.map(entry => entry.action), Array.from({ length: 30 }, (_, i) => (i + 1) * 10));
assert.equal(new Set(occurred.map(entry => entry.id)).size, 30);
assert.equal(eventState.eventCountdown, null);
assert.equal(advanceRandomEvent(eventState, () => 0).state, eventState);
assert.equal(advanceRandomEvent(initial, () => 0.999).state.eventCountdown, 29);
const fifthEvent = advanceRandomEvent({ ...initial, eventCountdown: 1 }, () => 0.15);
assert.equal(fifthEvent.event.id, 'E05');
assert.equal(fifthEvent.state.strength, 1);
assert.equal(fifthEvent.change, -7);
const burger = advanceRandomEvent({ ...initial, eventCountdown: 1, energy: 75 }, () => 18.5 / 30);
assert.equal(burger.event.id, 'E19');
assert.equal(burger.state.energy, 0);
assert.equal(burger.change, -75);
const restoredEvents = sanitizeState({ ...initial, seenEvents: ['E01', 'E01', 'bad'], eventCountdown: 12 });
assert.deepEqual(restoredEvents.seenEvents, ['E01']);
assert.equal(restoredEvents.eventCountdown, 12);

let supplemented = buy(freeze({ ...initial, money: 1000 }), 'protein').state;
for (let charge = 3; charge >= 1; charge--) {
  const result = train(freeze(supplemented), 'technique', 1);
  assert.equal(result.gains.technique, 8);
  assert.equal(result.gains.strength, 0);
  supplemented = result.state;
  assert.equal(supplemented.buff?.charges ?? 0, charge - 1);
}
assert.equal(buy(freeze(supplemented), 'belt').state.strength, supplemented.strength + 9);
const cookies = buy(freeze({ ...initial, energy: 40, money: 1000 }), 'cookies');
assert.equal(cookies.state.energy, 90);
assert.equal(cookies.state.money, 945);
assert.equal(sanitizeState({ ...initial, buff: { id: 'trenbolone', charges: 1 } }).buff.id, 'trenbolone');

// Endurance sizes the reservoir; it cannot change damage, timing, or recovery.
assert.equal(fightMaxStamina(initial), 86);
assert.equal(fightMaxStamina({ ...initial, endurance: 80 }), 230);
assert.ok(fightMaxStamina({ ...initial, endurance: 20 }) > 100);
assert.equal(fightStartingStamina(initial), 86);
assert.ok(fightStartingStamina({ ...initial, energy: 20 }) < fightStartingStamina(initial));
for (const energy of [20, 40, 60, 80, 100]) {
  const started = beginFight(freeze({ ...initial, energy }));
  assert.equal(started.battle.maxStamina, 86);
  assert.equal(started.battle.playerStamina, fightStartingStamina({ ...initial, energy }));
  assert.equal(started.state.energy, Math.max(0, energy - 80));
}
const serum = buy(freeze({ ...initial, money: 1000 }), 'serum').state;
const serumFight = beginFight(freeze(serum));
assert.equal(serumFight.state.buff, null);
assert.equal(serumFight.battle.attackStrength, initial.strength + 10);
assert.equal(serumFight.battle.playerStamina, fightStartingStamina(serum));
assert.equal(serumFight.state.energy, 5);
assert.ok(fightMovePreview(serumFight.state, serumFight.battle, 'attack').maxDamage > fightMovePreview(initial, beginFight(initial).battle, 'attack').maxDamage);
const trenbolone = buy(freeze({ ...initial, money: 1000 }), 'trenbolone').state;
assert.equal(trenbolone.buff.id, 'trenbolone');
assert.ok(beginFight({ ...trenbolone, energy: 44 }).error.includes('45'));
const trenFight = beginFight(freeze(trenbolone));
assert.equal(trenFight.battle.attackStrength, initial.strength + 20);
assert.equal(trenFight.battle.playerStamina, fightStartingStamina(trenbolone));
assert.equal(trenFight.state.energy, 0);
assert.equal(trenFight.state.buff, null);

const basic = beginFight(initial);
assert.equal(basic.battle.enemyMaxHp, 100);
assert.equal(fightMovePreview(basic.state, basic.battle, 'attack').staminaCost, 8);
assert.equal(fightMovePreview(basic.state, basic.battle, 'attack').minDamage, 0);
assert.equal(fightMovePreview(basic.state, basic.battle, 'push'), null);
assert.ok(fightTurn(basic.state, basic.battle, 'push').error);
const perfect = fightTurn(freeze(basic.state), freeze(basic.battle), 'attack', 0.5);
const timingWindow = fightTimingWindow(initial, basic.battle);
const good = fightTurn(basic.state, basic.battle, 'attack', 0.5 + timingWindow * 0.5);
const weak = fightTurn(basic.state, basic.battle, 'attack', 0.5 + timingWindow * 0.85);
const miss = fightTurn(basic.state, basic.battle, 'attack', 0);
assert.equal(perfect.turn.timingGrade, 'perfect');
assert.equal(good.turn.timingGrade, 'good');
assert.equal(weak.turn.timingGrade, 'weak');
assert.equal(miss.turn.timingGrade, 'miss');
assert.equal(good.turn.playerDamage, Math.round(perfect.turn.playerDamage * 2 / 3));
assert.equal(weak.turn.playerDamage, Math.round(perfect.turn.playerDamage / 3));
assert.equal(miss.turn.playerDamage, 0);
for (const offset of [-1, 1]) {
  assert.equal(fightTurn(basic.state, basic.battle, 'attack', 0.5 + offset * timingWindow * 0.32).turn.timingGrade, 'perfect');
  assert.equal(fightTurn(basic.state, basic.battle, 'attack', 0.5 + offset * timingWindow * 0.65).turn.timingGrade, 'good');
  assert.equal(fightTurn(basic.state, basic.battle, 'attack', 0.5 + offset * timingWindow * 0.99).turn.timingGrade, 'weak');
  assert.equal(fightTurn(basic.state, basic.battle, 'attack', 0.5 + offset * (timingWindow + 0.001)).turn.timingGrade, 'miss');
}
assert.ok(perfect.turn.enemyDamage < good.turn.enemyDamage && good.turn.enemyDamage < miss.turn.enemyDamage);
assert.deepEqual(perfect.turn, perfect.battle.history.at(-1));
assert.equal(perfect.turn.staminaCost, 8);
assert.equal(perfect.battle.playerStamina, 78);
assert.equal(good.turn.staminaCost, 10);
assert.equal(miss.turn.staminaCost, 13);
const exhausted = fightTurn(basic.state, { ...basic.battle, playerStamina: 8 }, 'attack', 0.5);
assert.equal(exhausted.turn.playerDamage, perfect.turn.playerDamage);
assert.equal(exhausted.battle.playerStamina, 0);
assert.equal(exhausted.battle.result, 'loss');
const lastBlow = fightTurn(basic.state, { ...basic.battle, enemyHp: perfect.turn.playerDamage, playerStamina: 8 }, 'attack', 0.5);
assert.equal(lastBlow.battle.playerStamina, 0);
assert.equal(lastBlow.battle.result, 'win', 'A finishing blow wins even when stamina reaches zero');
assert.equal(migrateBattle(basic.state, { ...basic.battle, playerStamina: 0 }), null);

// Strength alone changes attack damage. Technique only changes timing width.
const stronger = beginFight({ ...initial, strength: 80 }).battle;
const technical = beginFight({ ...initial, technique: 80 }).battle;
const durable = beginFight({ ...initial, endurance: 80 }).battle;
assert.ok(fightMovePreview(initial, stronger, 'attack').maxDamage > fightMovePreview(initial, basic.battle, 'attack').maxDamage);
assert.equal(fightMovePreview(initial, technical, 'attack').maxDamage, fightMovePreview(initial, basic.battle, 'attack').maxDamage);
assert.equal(fightMovePreview({ ...initial, endurance: 80 }, durable, 'attack').maxDamage, fightMovePreview(initial, basic.battle, 'attack').maxDamage);
assert.ok(fightTimingWindow({ ...initial, technique: 80 }, basic.battle) > fightTimingWindow(initial, basic.battle));
assert.ok(fightTimingWindow(initial, { ...basic.battle, rivalId: RIVALS[5].id }) < fightTimingWindow(initial, { ...basic.battle, rivalId: RIVALS[2].id }));
assert.ok(fightTimingWindow(initial, basic.battle) < 0.1, 'Initial timing zone is substantially narrower than the old one');
assert.equal(fightMovePreview({ ...initial, endurance: 80 }, durable, 'attack').staminaDelta, -8, 'Endurance does not change per-turn stamina economics');

// A long fight remains active after ten attacks and can be restored from a save.
const longState = { ...initial, wins: 11, gym: 3, strength: 1, endurance: 80 };
let longFight = beginFight(longState);
for (let turn = 0; turn < 11; turn++) {
  longFight = fightTurn(longFight.state, longFight.battle, 'attack', 0.5);
  assert.ok(!longFight.error);
  if (turn === 9) {
    assert.equal(longFight.battle.round, 10);
    assert.equal(longFight.battle.finished, false);
    assert.equal(migrateBattle(longFight.state, longFight.battle).round, 10);
  }
}
assert.equal(longFight.battle.round, 11);

// A pre-update active battle is migrated without resetting progress.
const oldSavedBattle = {
  rivalId: RIVALS[0].id, playerHp: 77, enemyHp: 62, playerStamina: 67,
  round: 3, playerPower: 14, telegraph: 'push', combo: 2, history: [], serum: false,
};
const migrated = migrateBattle(initial, oldSavedBattle);
assert.equal(migrated.round, 3);
assert.equal(migrated.enemyHp, 62);
assert.equal(migrated.enemyMaxHp, 100);
assert.equal(migrated.maxStamina, 86);
assert.equal(fightTurn(initial, oldSavedBattle, 'attack', 0.5).battle.round, 4);
assert.equal(migrateBattle(initial, { ...oldSavedBattle, rivalId: 'nobody' }), null);

const firstWin = fight(initial);
assert.equal(firstWin.battle.result, 'win');
assert.equal(firstWin.state.wins, 1);
assert.equal(firstWin.state.money, initial.money + RIVALS[0].reward);
assert.equal(fightTurn(firstWin.state, firstWin.battle, 'attack').state, firstWin.state);
const staleFight = beginFight(initial);
assert.equal(fightTurn(firstWin.state, staleFight.battle, 'attack').state, firstWin.state);
const impossible = freeze({ ...initial, wins: 11, gym: 3 });
const lost = fight(impossible);
assert.equal(lost.battle.result, 'loss');
assert.equal(lost.state.wins, 11);
assert.ok(rest(lost.state).state.energy >= 20);

// On a failed challenge, a deliberate player completes two balanced workouts
// before retrying. Stable hit patterns make the length and skill gradient clear.
function runCampaign(timings) {
  let state = createState();
  let losses = 0;
  let attempts = 0;
  while (!state.won && attempts < 100) {
    while (state.energy < 20) state = rest(freeze(state)).state;
    const result = fight(state, timings);
    state = result.state;
    attempts++;
    if (result.battle.result === 'loss') {
      losses++;
      for (let i = 0; i < 2; i++) {
        while (state.energy < 18) state = rest(freeze(state)).state;
        state = train(freeze(state), ['strength', 'technique', 'endurance'][state.workouts % 3], 0.65).state;
      }
    }
  }
  assert.equal(state.wins, 12, 'All 12 bosses remain reachable with skill and training');
  return { state, losses, attempts };
}
const novice = runCampaign([0.5, 0]);
const capable = runCampaign([0.5, 0.5, 0.5, 0]);
const expert = runCampaign([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0]);
assert.ok(capable.attempts >= 18 && capable.attempts <= 34, `75% accuracy should mean a substantial but manageable campaign: ${JSON.stringify({attempts:capable.attempts,workouts:capable.state.workouts})}`);
assert.ok(capable.state.workouts >= 25 && capable.state.workouts <= 44);
assert.ok(novice.attempts > capable.attempts && novice.attempts < 60, '50% accuracy is harder, not a dead end');
assert.ok(novice.state.workouts > capable.state.workouts);
assert.ok(expert.attempts < capable.attempts && expert.state.workouts < capable.state.workouts);
assert.ok(fightMaxStamina(capable.state) > 100);
assert.deepEqual(capable.state.achievements, ['first-workout', 'first-win', 'gym-two', 'legend']);
assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(capable.state))), capable.state);
console.log(JSON.stringify({
  ok: true,
  campaigns: Object.fromEntries([['50%', novice], ['75%', capable], ['90%', expert]].map(([accuracy, result]) => [accuracy, {
    fights: result.attempts, losses: result.losses, workouts: result.state.workouts,
    strength: result.state.strength, technique: result.state.technique, endurance: result.state.endurance,
  }])),
}, null, 2));
