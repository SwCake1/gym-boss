import assert from 'node:assert/strict';
import {
  GYMS, RIVALS, SHOP, HERO_FORMS, physiquePower, heroStage, heroEvolution, createState, sanitizeState, power, nextRival,
  train, trainingDifficulty, liftQuality, rest, work, workPayout, buy, gearCost, MAX_GEAR_LEVEL,
  beginFight, fightTurn, forfeitFight, defeatPenalty, fightTimingWindow,
  fightMovePreview, fightMaxHp, fightMaxStamina, fightStartingStamina, migrateBattle,
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
    assert.ok(battle.playerHp >= 0 && battle.playerHp <= battle.playerMaxHp && battle.enemyHp >= 0);
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
assert.ok(SHOP.every(item => item.cost > 0 && ['food', 'boost', 'prep', 'gear'].includes(item.type)));
const trainingStart = createState();
const trainingBase = trainingDifficulty(trainingStart);
assert.deepEqual(trainingDifficulty({ ...trainingStart, gym: 3, workouts: 1000 }), trainingBase,
  'Gym and completed workouts must not affect training difficulty');
const trainingLevels = [8, 20, 40, 80, 500].map(value => trainingDifficulty({ ...trainingStart, strength: value }));
for (let level = 1; level < trainingLevels.length; level++) {
  const before = trainingLevels[level - 1], current = trainingLevels[level];
  assert.ok(current.liftSpeed > before.liftSpeed && current.liftZone < before.liftZone);
  assert.equal(current.gripLimit, trainingBase.gripLimit);
  assert.equal(current.cardioDecay, trainingBase.cardioDecay);
}
const gripLevels = [6, 18, 38, 78, 500].map(value => trainingDifficulty({ ...trainingStart, technique: value }));
for (let level = 1; level < gripLevels.length; level++) {
  const before = gripLevels[level - 1], current = gripLevels[level];
  assert.ok(current.gripLimit < before.gripLimit);
  assert.equal(current.liftZone, trainingBase.liftZone);
  assert.equal(current.cardioDecay, trainingBase.cardioDecay);
}
const cardioLevels = [8, 20, 40, 80, 500].map(value => trainingDifficulty({ ...trainingStart, endurance: value }));
for (let level = 1; level < cardioLevels.length; level++) {
  const before = cardioLevels[level - 1], current = cardioLevels[level];
  assert.ok(current.cardioHigh - current.cardioLow < before.cardioHigh - before.cardioLow);
  assert.ok(current.cardioDecay > before.cardioDecay);
  assert.equal(current.liftZone, trainingBase.liftZone);
  assert.equal(current.gripLimit, trainingBase.gripLimit);
  assert.ok(current.cardioHigh - current.cardioLow >= 11, 'Cardio zone must remain reachable after one step');
}
assert.equal(liftQuality(75, trainingLevels[0].liftZone), 1);
assert.equal(liftQuality(99, trainingLevels[0].liftZone), 0);
assert.ok(liftQuality(90, trainingLevels.at(-1).liftZone) < liftQuality(90, trainingLevels[0].liftZone));
assert.ok(trainingLevels.at(-1).liftZone > 8 && gripLevels.at(-1).gripLimit > 1450,
  'Even at the stat cap the lifting target and reaction timer stay playable');

const initial = freeze(createState());
assert.equal(power(initial), 9);

// Physique depends on lasting power, independently of gyms, wins and workouts.
assert.equal(HERO_FORMS.length, 12);
assert.equal(heroStage(initial), 0);
assert.equal(heroStage({ ...initial, gym: 3, wins: 12, won: true, workouts: 1000 }), 0);
const atPower = value => {
  const stat = (value - 4.5) / 0.62;
  return { ...initial, strength: stat, technique: stat, endurance: stat };
};
for (const [stage, form] of HERO_FORMS.entries()) {
  const character = atPower(form.power);
  assert.equal(physiquePower(character), form.power);
  assert.equal(heroStage(character), stage);
  if (stage) assert.equal(heroStage(atPower(form.power - 1)), stage - 1);
  for (const fightPrep of ['serum', 'trenbolone']) {
    assert.equal(heroStage({ ...character, fightPrep }), stage);
    assert.equal(heroEvolution(character, { ...character, fightPrep }), null);
  }
}
assert.equal(heroStage(atPower(1)), 0);
assert.equal(heroStage(atPower(300)), 11);
assert.equal(heroEvolution(initial, atPower(11)), null, 'power gain within a form has no popup');
assert.deepEqual(heroEvolution(initial, atPower(31)), { from: 0, to: 5, beforePower: 9, afterPower: 31 }, 'multiple thresholds yield one before/after comparison');
assert.equal(heroEvolution(atPower(31), atPower(16)), null, 'loss does not announce a strength gain');
assert.equal(heroEvolution(atPower(31), atPower(31)), null, 'rendering unchanged state does not repeat a milestone');
assert.ok(heroEvolution(atPower(11), train(atPower(11), 'strength', 1).state), 'training crossing a threshold evolves');
assert.ok(heroEvolution(atPower(11), buy({ ...atPower(11), money: 1000 }, 'belt').state), 'lasting gear stat gain evolves');

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
assert.equal(work(tired, 0).earned, 20);
assert.equal(work(tired, 1).earned, 45);
assert.equal(work(tired, 3).earned, 95);
assert.equal(work(tired, 5).earned, 95);
assert.equal(work(tired, 9).earned, 95, 'hits are capped at three throws');
assert.equal(work(tired, 2.7).hits, 2, 'partial hits do not round up');
assert.equal(work(tired, NaN).earned, 20);
assert.equal(work(freeze({ ...tired, gym: 3 }), 0).earned, 20, 'the minimum stays 20 in every gym');
assert.equal(work(freeze({ ...tired, gym: 3 }), 3).earned, 155);
assert.equal(work(tired, 2).message, 'Полотенец в корзине: 2 из 3. Заработал 70 ₽ (20 ₽ за смену + 2 × 25 ₽).');
assert.equal(work(tired, 0).message, 'Полотенец в корзине: 0 из 3. Заработал 20 ₽ — только минимальная ставка.');
assert.deepEqual(GYMS.map((_, gym) => workPayout(gym).perHit), [25, 30, 40, 45]);
assert.deepEqual(GYMS.map((_, gym) => workPayout(gym).max), [95, 110, 140, 155]);
assert.ok(initial.money + work(tired, 3).earned * 2 >= SHOP.find(item => item.id === 'wraps').cost,
  'Two perfect shifts plus starting cash buy the first permanent upgrade');
for (let gym = 0; gym < 4; gym++) {
  const pay = workPayout(gym);
  for (let hits = 0; hits <= 3; hits++) assert.equal(work(freeze({ ...tired, gym }), hits).earned, pay.base + hits * pay.perHit);
  assert.equal(work(freeze({ ...tired, gym }), 3).earned, pay.max);
}

const malformed = sanitizeState({
  ...initial, name: '<>\u0000  ', wins: 99, gym: -8, won: false, strength: Infinity, technique: NaN,
  endurance: -100, energy: Infinity, money: -50, workouts: NaN, totalWork: -1,
  playSeconds: Infinity, startedAt: Infinity,
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
assert.equal(malformed.gearLevels.belt, 1);
assert.deepEqual(malformed.log, ['one']);
assert.ok(!malformed.achievements.includes('hacked'));
assert.equal(sanitizeState({ ...initial, version: 999 }).wins, 0);
assert.equal(sanitizeState(null).name, 'Дрищ');
assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(initial))), initial);

assert.equal(RANDOM_EVENTS.length, 30);
assert.equal(new Set(RANDOM_EVENTS.map(event => event.id)).size, 30);
let eventState = initial;
let occurred = [];
for (let action = 1; action <= 5; action++) {
  const result = advanceRandomEvent(freeze(eventState), () => 0);
  eventState = result.state;
  if (result.event) occurred.push({ action, id: result.event.id });
}
assert.deepEqual(occurred, [{ action: 5, id: 'E01' }]);
assert.equal(eventState.eventCountdown, 5);
assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(eventState))).seenEvents, ['E01']);
for (let action = 6; action <= 150; action++) {
  const result = advanceRandomEvent(freeze(eventState), () => 0);
  eventState = result.state;
  if (result.event) occurred.push({ action, id: result.event.id });
}
assert.equal(occurred.length, 30);
assert.deepEqual(occurred.map(entry => entry.action), Array.from({ length: 30 }, (_, i) => (i + 1) * 5));
assert.equal(new Set(occurred.map(entry => entry.id)).size, 30);
assert.equal(eventState.eventCountdown, null);
assert.equal(advanceRandomEvent(eventState, () => 0).state, eventState);
assert.equal(advanceRandomEvent(initial, () => 0.999).state.eventCountdown, 11);
let slowEventState = initial;
for (let action = 1; action <= 12; action++) {
  const result = advanceRandomEvent(slowEventState, () => 0.999);
  assert.equal(Boolean(result.event), action === 12);
  slowEventState = result.state;
}
assert.equal(slowEventState.eventCountdown, 12);
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
assert.equal(sanitizeState({ ...initial, eventCountdown: 30 }).eventCountdown, 12);

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
assert.equal(cookies.state.energy, 40);
assert.equal(cookies.state.money, 945);
assert.equal(cookies.state.fightPrep, 'cookies');
assert.equal(sanitizeState({ ...initial, buff: { id: 'trenbolone', charges: 1 } }).fightPrep, 'trenbolone');
assert.equal(buy(freeze(cookies.state), 'chalk').state, cookies.state, 'Only one fight preparation can be held');
assert.ok(buy(freeze({ ...cookies.state, money: 1000 }), 'protein').state.buff, 'Training protein is independent of fight preparation');

// Each gear level adds the same stat gain; higher levels unlock in later gyms.
let geared = { ...initial, money: 2000 };
for (let level = 0; level < MAX_GEAR_LEVEL; level++) {
  assert.equal(gearCost(geared, 'wraps'), 140 + level * 80);
  if (level > geared.gym) assert.ok(buy(freeze(geared), 'wraps').error.includes('зале'));
  geared = { ...geared, gym: level, wins: level * 3 };
  geared = buy(freeze(geared), 'wraps').state;
  assert.equal(geared.gearLevels.wraps, level + 1);
  assert.equal(geared.technique, initial.technique + (level + 1) * 5);
}
assert.ok(buy(freeze(geared), 'wraps').error.includes('максимума'));
assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(geared))), geared);

// Endurance extends both ways a fighter can survive a long exchange.
assert.equal(fightMaxHp(initial), 100);
assert.equal(fightMaxHp({ ...initial, endurance: 20 }), 124);
assert.equal(fightMaxHp({ ...initial, endurance: 80 }), 244);
assert.equal(fightMaxStamina(initial), 86);
assert.equal(fightMaxStamina({ ...initial, endurance: 80 }), 230);
assert.ok(fightMaxStamina({ ...initial, endurance: 20 }) > 100);
assert.equal(fightStartingStamina(initial), 86);
assert.ok(fightStartingStamina({ ...initial, energy: 20 }) < fightStartingStamina(initial));
for (const energy of [20, 40, 60, 80, 100]) {
  const started = beginFight(freeze({ ...initial, energy }));
  assert.equal(started.battle.playerMaxHp, 100);
  assert.equal(started.battle.maxStamina, 86);
  assert.equal(started.battle.playerStamina, fightStartingStamina({ ...initial, energy }));
  assert.equal(started.state.energy, Math.max(0, energy - 80));
}
const serum = buy(freeze({ ...initial, money: 1000 }), 'serum').state;
const serumFight = beginFight(freeze(serum));
assert.equal(serumFight.state.buff, null);
assert.equal(serumFight.state.fightPrep, null);
assert.equal(serumFight.battle.attackStrength, initial.strength + 10);
assert.equal(serumFight.battle.playerStamina, fightStartingStamina(serum));
assert.equal(serumFight.state.energy, 5);
assert.ok(fightMovePreview(serumFight.state, serumFight.battle, 'attack').maxDamage > fightMovePreview(initial, beginFight(initial).battle, 'attack').maxDamage);
const trenbolone = buy(freeze({ ...initial, money: 1000 }), 'trenbolone').state;
assert.equal(trenbolone.fightPrep, 'trenbolone');
assert.ok(beginFight({ ...trenbolone, energy: 44 }).error.includes('45'));
const trenFight = beginFight(freeze(trenbolone));
assert.equal(trenFight.battle.attackStrength, initial.strength + 20);
assert.equal(trenFight.battle.playerStamina, fightStartingStamina(trenbolone));
assert.equal(trenFight.state.energy, 0);
assert.equal(trenFight.state.buff, null);
const foodFight = beginFight(freeze(cookies.state));
assert.equal(foodFight.battle.maxStamina, 103);
assert.equal(foodFight.battle.playerStamina, fightStartingStamina(cookies.state));
assert.equal(foodFight.state.fightPrep, null);
assert.equal(migrateBattle(sanitizeState(JSON.parse(JSON.stringify(foodFight.state))), JSON.parse(JSON.stringify(foodFight.battle))).maxStamina, foodFight.battle.maxStamina);
for (const [itemId, fullStamina, tiredStamina, highStamina] of [
  ['shawarma', 95, 59, 1177],
  ['cookies', 103, 64, 1284],
]) {
  for (const energy of [0, 19, 40, 100]) {
    const prepared = buy(freeze({ ...initial, energy, money: 1000 }), itemId).state;
    assert.equal(prepared.energy, energy, 'Food never restores energy');
    assert.equal(fightMaxStamina(prepared), fullStamina);
    if (energy < 20) assert.ok(beginFight(prepared).error, 'Food does not bypass the energy requirement');
    if (energy === 40) assert.equal(fightStartingStamina(prepared), tiredStamina);
    if (energy === 100) assert.equal(fightStartingStamina(prepared), fullStamina);
  }
  const prepared = buy(freeze({ ...initial, endurance: 500, money: 1000 }), itemId).state;
  const started = beginFight(freeze(sanitizeState(JSON.parse(JSON.stringify(prepared)))));
  assert.equal(started.battle.maxStamina, highStamina, 'Food scales with endurance');
  assert.equal(started.battle.playerStamina, highStamina);
  assert.equal(started.state.energy, 20);
  assert.equal(started.state.fightPrep, null);
  assert.equal(fightMaxStamina(started.state), 1070, 'The bonus only applies to one fight');
  const resumed = migrateBattle(started.state, JSON.parse(JSON.stringify(started.battle)));
  assert.equal(resumed.maxStamina, highStamina, 'Saved fights retain percentage bonuses at maximum endurance');
  assert.equal(resumed.playerStamina, highStamina);
}
const chalk = buy(freeze({ ...initial, money: 1000 }), 'chalk').state;
const chalkFight = beginFight(freeze(chalk));
assert.equal(chalkFight.state.fightPrep, null);
assert.ok(fightTimingWindow(chalkFight.state, chalkFight.battle) > fightTimingWindow(initial, beginFight(initial).battle));
assert.equal(migrateBattle(chalkFight.state, JSON.parse(JSON.stringify(chalkFight.battle))).timingBonus, 0.018);

const basic = beginFight(initial);
assert.equal(basic.battle.enemyMaxHp, 100);
assert.equal(fightMovePreview(basic.state, basic.battle, 'attack').staminaCost, 8);
assert.equal(fightMovePreview(basic.state, basic.battle, 'attack').minDamage, 0);
assert.equal(fightMovePreview(basic.state, basic.battle, 'attack').counterDamage, 9);
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
assert.equal(perfect.turn.enemyDamage, good.turn.enemyDamage, 'A clean hit does not weaken the counter');
assert.equal(perfect.turn.enemyDamage, miss.turn.enemyDamage, 'A miss receives the same counter');
assert.equal(perfect.turn.enemyDamage, fightMovePreview(basic.state, basic.battle, 'attack').counterDamage);
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
assert.equal(lastBlow.turn.enemyDamage, 0, 'A defeated rival cannot counter');
assert.equal(migrateBattle(basic.state, { ...basic.battle, playerStamina: 0 }), null);

// Strength changes attack damage with diminishing returns. Technique changes timing width.
const stronger = beginFight({ ...initial, strength: 80 }).battle;
const technical = beginFight({ ...initial, technique: 80 }).battle;
const durable = beginFight({ ...initial, endurance: 80 }).battle;
assert.ok(fightMovePreview(initial, stronger, 'attack').maxDamage > fightMovePreview(initial, basic.battle, 'attack').maxDamage);
assert.equal(fightMovePreview(initial, technical, 'attack').maxDamage, fightMovePreview(initial, basic.battle, 'attack').maxDamage);
assert.equal(fightMovePreview({ ...initial, endurance: 80 }, durable, 'attack').maxDamage, fightMovePreview(initial, basic.battle, 'attack').maxDamage);
assert.ok(fightTimingWindow({ ...initial, technique: 80 }, basic.battle) > fightTimingWindow(initial, basic.battle));
assert.ok(fightTimingWindow(initial, { ...basic.battle, rivalId: RIVALS[5].id }) < fightTimingWindow(initial, { ...basic.battle, rivalId: RIVALS[2].id }));
assert.ok(fightTimingWindow(initial, basic.battle) < 0.1, 'Initial timing zone is substantially narrower than the old one');

// Late technique must improve actual hit grades, including against rivals whose
// original zone capped early. Keep the early game and the chalk advantage intact.
const lateTechniqueLevels = [60, 61, 80, 100, 150, 300, 500];
for (const rival of RIVALS) {
  for (const timingBonus of [0, 0.018]) {
    const widths = lateTechniqueLevels.map(technique => fightTimingWindow({ ...initial, technique }, { rivalId: rival.id, timingBonus }));
    assert.ok(widths.every((width, index) => index === 0 || width > widths[index - 1]), `${rival.name}: technique stays useful after 60`);
    assert.ok(widths.at(-1) < 0.125 + timingBonus + 0.025, 'Late technique adds less than five percentage points to the full zone');
  }
  const highTechnique = { ...initial, technique: 500 };
  const plain = fightTimingWindow(highTechnique, { rivalId: rival.id, timingBonus: 0 });
  const chalked = fightTimingWindow(highTechnique, { rivalId: rival.id, timingBonus: 0.018 });
  assert.ok(Math.abs(chalked - plain - 0.018) < 0.000002, 'Chalk retains its full bonus at high technique');
}
const finalRivalId = RIVALS.at(-1).id;
assert.equal(fightTimingWindow({ ...initial, technique: 6 }, { rivalId: finalRivalId }), 0.066);
assert.equal(fightTimingWindow({ ...initial, technique: 60 }, { rivalId: finalRivalId }), 0.115);
const lateWidths = [60, 100, 150].map(technique => fightTimingWindow({ ...initial, technique }, { rivalId: finalRivalId }));
assert.ok((lateWidths[2] - lateWidths[1]) / 50 < (lateWidths[1] - lateWidths[0]) / 40, 'Late technique has diminishing returns');
const beforeTechnique = { ...initial, wins: 11, gym: 3, strength: 80, technique: 60, endurance: 80 };
const afterTechnique = { ...beforeTechnique, technique: 150 };
const beforeTechniqueFight = beginFight(beforeTechnique), afterTechniqueFight = beginFight(afterTechnique);
assert.equal(fightTurn(beforeTechniqueFight.state, beforeTechniqueFight.battle, 'attack', 0.541).turn.timingGrade, 'good');
assert.equal(fightTurn(afterTechniqueFight.state, afterTechniqueFight.battle, 'attack', 0.541).turn.timingGrade, 'perfect', 'Extra technique turns a marginal hit into a perfect hit');
assert.equal(fightMovePreview(beforeTechniqueFight.state, beforeTechniqueFight.battle, 'attack').maxDamage, fightMovePreview(afterTechniqueFight.state, afterTechniqueFight.battle, 'attack').maxDamage);
assert.equal(afterTechniqueFight.battle.playerMaxHp, beforeTechniqueFight.battle.playerMaxHp);
assert.equal(afterTechniqueFight.battle.maxStamina, beforeTechniqueFight.battle.maxStamina);
assert.equal(fightMovePreview({ ...initial, endurance: 80 }, durable, 'attack').staminaDelta, -8, 'Endurance does not change per-turn stamina economics');
assert.equal(durable.playerMaxHp, 244);
const finalState = { ...initial, wins: 11, gym: 3, strength: 80, endurance: 8 };
assert.equal(fight({ ...finalState, strength: 120 }).battle.result, 'loss', 'Strength alone cannot bypass the final rival with perfect timing');
assert.equal(fight({ ...finalState, endurance: 20 }).battle.result, 'loss', 'The x2 health bonus requires more endurance against the final rival');
assert.equal(fight({ ...finalState, endurance: 70 }).battle.result, 'win', 'Training endurance opens a viable path');
assert.ok(fightMovePreview({ ...initial, strength: 120 }, beginFight({ ...initial, strength: 120 }).battle, 'attack').maxDamage < 50,
  'High strength gains taper off');

// HP growth accelerates across the campaign and survives save restoration above 300 HP.
const rivalHp = RIVALS.map((rival, wins) => beginFight({ ...initial, wins, gym: rival.gym }).battle.enemyMaxHp);
assert.equal(rivalHp[0], 100);
assert.equal(rivalHp.at(-1), 381, 'The final rival has 50% more HP than the previous 254');
const hpSteps = rivalHp.slice(1).map((hp, index) => hp - rivalHp[index]);
assert.ok(hpSteps.every((step, index) => index === 0 || step >= hpSteps[index - 1]), 'HP increases faster at later levels');
const finalFight = beginFight(finalState);
const restoredFinal = migrateBattle(finalFight.state, { ...finalFight.battle, enemyHp: 350 });
assert.equal(restoredFinal.enemyMaxHp, 381);
assert.equal(restoredFinal.enemyHp, 350);
assert.ok(!fightTurn(finalFight.state, restoredFinal, 'attack', 0.5).error, 'A rival above 300 HP remains playable after loading');

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
assert.equal(migrated.playerMaxHp, 100);
assert.equal(migrated.maxStamina, 86);
const fortifiedMigration = migrateBattle({ ...initial, endurance: 20 }, oldSavedBattle);
assert.equal(fortifiedMigration.playerMaxHp, 124);
assert.equal(fortifiedMigration.playerHp, 101, 'An active old fight retains damage already taken when endurance adds health');
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
assert.equal(lost.state.money, impossible.money - defeatPenalty(impossible));
assert.ok(lost.battle.finished);
assert.ok(rest(lost.state).state.energy >= 20);
const broke = fight({ ...impossible, money: 0 });
assert.equal(broke.state.money, 0, 'Losing with no money never creates debt');
assert.ok(beginFight({ ...rest(broke.state).state, energy: 100 }).battle, 'A broke player can retry for free');
const surrender = forfeitFight(basic.state, basic.battle);
assert.equal(surrender.penalty, 20);
assert.equal(surrender.state.money, basic.state.money - 20);
assert.equal(surrender.state.energy, basic.state.energy, 'Surrender does not restore energy');
assert.ok(forfeitFight(initial, null).error);

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
assert.ok(capable.attempts >= 18 && capable.attempts <= 55, `75% accuracy should mean a substantial but manageable campaign: ${JSON.stringify({attempts:capable.attempts,workouts:capable.state.workouts})}`);
assert.ok(capable.state.workouts >= 25 && capable.state.workouts <= 86);
assert.ok(novice.attempts > capable.attempts && novice.attempts < 80, '50% accuracy is harder, not a dead end');
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
