import assert from 'node:assert/strict';
import { WORLD, TOWEL, planShift, createLayout, createTowelSim, launchFromPull, handFromPull, simulateThrow, seededRandom, predictFlight } from '../dist/towel.mjs';

const aim = (degrees, power) => {
  const radians = degrees * Math.PI / 180;
  return [-Math.cos(radians) * power, Math.sin(radians) * power];
};
const calmLayout = kind => {
  const layout = createLayout(kind, 1, seededRandom(3), 1);
  layout.wind = 0;
  if (layout.bag) layout.bag.angle = 0.25;
  return layout;
};
const finite = sim => sim.pos.every(Number.isFinite);

// Every shift includes the two new layouts; wind grows with the gym.
for (let seed = 1; seed <= 40; seed++) {
  const shift = planShift(seed % 4, seededRandom(seed));
  assert.equal(shift.length, 5);
  assert.equal(shift[0].kind, 'warmup');
  assert.notEqual(shift[1].kind, shift[2].kind);
  assert.deepEqual(shift.slice(3).map(layout => layout.kind), ['distance', 'gauntlet']);
  assert.ok(shift.every(layout => layout.basket && layout.name));
  assert.ok(Math.abs(shift[0].wind) <= 60 * 0.45 + 1 || seed % 4 > 0);
}
const windiest = level => Math.max(...Array.from({ length: 60 }, (_, seed) => Math.abs(createLayout('bench', level, seededRandom(seed), 1).wind)));
assert.ok(windiest(0) < windiest(3), 'later gyms should have stronger fans');
assert.ok(Array.from({ length: 60 }, (_, seed) => createLayout('bench', 3, seededRandom(seed), 1).wind).every(wind => wind >= -185 * 0.7 && wind <= 185));

// Aiming clamps to the maximum wind-up and keeps the hand above the floor.
const full = launchFromPull(-600, 600);
assert.equal(full.power, 1);
assert.ok(Math.abs(Math.hypot(full.pullX, full.pullY) - WORLD.maxPull) < 1e-9);
assert.ok(handFromPull(full.pullX, full.pullY).y < WORLD.floor - 40);
assert.equal(launchFromPull(0, 0).power, 0);

// The towel settles into a hang below the grip instead of drifting or exploding.
{
  const sim = createTowelSim(calmLayout('warmup'), { random: seededRandom(5) });
  assert.ok(finite(sim));
  assert.equal(sim.phase, 'holding');
  let lowest = -Infinity;
  for (let p = 0; p < sim.count; p++) lowest = Math.max(lowest, sim.pos[p * 3 + 1]);
  assert.ok(lowest > WORLD.anchor.y + 40 && lowest < WORLD.floor, `hanging towel should drape below the hand: ${lowest}`);
  assert.equal(sim.pos[0], WORLD.anchor.x);
}

// Every layout can be solved with a sensible throw, and a limp toss lands on the floor.
const solutions = { warmup: aim(35, 90), bench: aim(45, 100), bag: aim(60, 110), lockers: aim(55, 120), distance: aim(35, 140), gauntlet: aim(70, 130) };
for (const [kind, [x, y]] of Object.entries(solutions)) {
  const result = simulateThrow(calmLayout(kind), x, y);
  assert.equal(result.kind, 'in', `${kind} should have a reachable basket: ${JSON.stringify(result)}`);
  assert.ok(result.hit && result.share >= 0.6);
}
const limp = simulateThrow(calmLayout('warmup'), ...aim(30, 25));
assert.equal(limp.hit, false);
assert.equal(limp.kind, 'floor');

// Distance grows with power, so the wind-up is learnable.
const landing = power => {
  const layout = calmLayout('warmup');
  layout.basket.x = 5000;
  const sim = createTowelSim(layout, { random: seededRandom(7) });
  const launch = launchFromPull(...aim(45, power)), hand = handFromPull(launch.pullX, launch.pullY);
  sim.setHand(hand.x, hand.y);
  for (let s = 0; s < 60; s++) sim.step();
  sim.release(launch.x, launch.y);
  let previous = 0;
  for (let s = 0; s < 2400; s++) {
    sim.step();
    let x = 0, y = 0;
    for (let p = 0; p < sim.count; p++) { x += sim.pos[p * 3]; y += sim.pos[p * 3 + 1]; }
    if (y / sim.count > 400 && previous <= 400 && s > 10) return x / sim.count;
    previous = y / sim.count;
  }
  return Infinity;
};
const distances = [50, 80, 110, 140].map(landing);
assert.ok(distances.every((d, i) => i === 0 || d > distances[i - 1]), `landing should move further with power: ${distances}`);

// Wind pushes the towel: a tailwind carries the same throw further than a headwind.
const windy = wind => {
  const layout = calmLayout('warmup');
  layout.basket.x = 5000; layout.wind = wind;
  const sim = createTowelSim(layout, { random: seededRandom(7) });
  const launch = launchFromPull(...aim(45, 100)), hand = handFromPull(launch.pullX, launch.pullY);
  sim.setHand(hand.x, hand.y);
  for (let s = 0; s < 60; s++) sim.step();
  sim.release(launch.x, launch.y);
  for (let s = 0; s < 240; s++) sim.step();
  let x = 0;
  for (let p = 0; p < sim.count; p++) x += sim.pos[p * 3];
  return x / sim.count;
};
assert.ok(windy(180) > windy(0) + 20 && windy(0) > windy(-130) + 20, 'fan wind should visibly carry the towel');

// The aiming hint follows the real towel: its forecast of the centre of mass stays close to the cloth.
for (const [degrees, power, wind] of [[30, 120, 0], [50, 90, -120], [65, 140, 180]]) {
  const layout = calmLayout('warmup');
  layout.basket.x = 5000; layout.wind = wind;
  const sim = createTowelSim(layout, { random: seededRandom(degrees) });
  const launch = launchFromPull(...aim(degrees, power)), hand = handFromPull(launch.pullX, launch.pullY);
  sim.setHand(hand.x, hand.y);
  for (let s = 0; s < 90; s++) sim.step();
  const forecast = predictFlight(sim.launchState(launch.x, launch.y), sim.windNow, 0.46, 0.05);
  sim.release(launch.x, launch.y, 3 + launch.power * 4);
  let steps = 0, error = 0;
  for (const point of forecast) {
    while (steps < Math.round(point.t * 240)) { sim.step(); steps++; }
    let x = 0, y = 0;
    for (let p = 0; p < sim.count; p++) { x += sim.pos[p * 3]; y += sim.pos[p * 3 + 1]; }
    error = Math.max(error, Math.hypot(point.x - x / sim.count, point.y - y / sim.count));
  }
  assert.ok(error < 25, `aim hint drifted ${error.toFixed(1)}px from the towel at ${degrees}°/${power}/${wind}`);
}

// A hard throw into the rim stays physically sane: finite, inside the room, and not overstretched.
{
  const sim = createTowelSim(calmLayout('bench'), { random: seededRandom(9) });
  const launch = launchFromPull(...aim(20, 150));
  sim.release(launch.x, launch.y, 7);
  let worst = 0;
  for (let s = 0; s < 1500 && sim.phase !== 'done'; s++) {
    sim.step();
    for (let r = 0; r < TOWEL.rows; r++) for (let c = 0; c + 1 < TOWEL.cols; c++) {
      const a = (r * TOWEL.cols + c) * 3, b = a + 3;
      worst = Math.max(worst, Math.hypot(sim.pos[a] - sim.pos[b], sim.pos[a + 1] - sim.pos[b + 1], sim.pos[a + 2] - sim.pos[b + 2]) / TOWEL.spacing);
    }
  }
  assert.ok(finite(sim));
  assert.ok(worst < 1.35, `cloth should not stretch like rubber: ${worst.toFixed(2)}`);
  for (let p = 0; p < sim.count; p++) {
    assert.ok(sim.pos[p * 3 + 1] <= WORLD.floor, 'towel stays above the floor');
    assert.ok(Math.abs(sim.pos[p * 3 + 2]) <= WORLD.depth + 1e-9, 'towel stays inside the room depth');
  }
  assert.ok(sim.result, 'a throw always gets a verdict');
}

console.log('towel tests passed');
