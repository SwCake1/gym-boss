// Towel toss side job: a small 3D cloth simulation drawn in an oblique side view.
// The simulation part has no DOM dependencies so tests can run it in Node.

export const WORLD = { width: 960, height: 540, floor: 440, depth: 92, anchor: { x: 170, y: 318 }, maxPull: 150, launchScale: 10.4 };
const COLS = 12, ROWS = 7, SPACING = 10.5, RADIUS = 3.2, GRAVITY = 1100, DT = 1 / 240, ITERATIONS = 6;
const DRAG_NORMAL = 0.000018, DRAG_FORM = 0.0000085, DAMPING = 0.9995;
const RIM_TUBE = 4.5, WALL = 2.5;
export const PROJECT_Z = 0.32;
export const TOWEL = { cols: COLS, rows: ROWS, spacing: SPACING };

export function seededRandom(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LAYOUT_NAMES = { warmup: 'Разминка', bench: 'Через скамью', bag: 'Груша на пути', lockers: 'На шкафчик' };
const WIND_LIMITS = [60, 105, 145, 185];

// One shift is three throws: an easy warm-up and two distinct obstacles.
export function planShift(gym = 0, random = Math.random) {
  const pool = ['bench', 'bag', 'lockers'];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return ['warmup', pool[0], pool[1]].map((kind, index) => createLayout(kind, gym, random, index));
}

export function createLayout(kind, gym = 0, random = Math.random, index = 1) {
  const level = Math.max(0, Math.min(3, Math.floor(gym) || 0));
  const floor = WORLD.floor, jitter = (random() - 0.5) * 50;
  const limit = WIND_LIMITS[level] * (index === 0 ? 0.45 : 1);
  // Headwind is capped lower: it eats range the player cannot win back with power.
  const wind = Math.round((random() < 0.5 ? -0.7 : 1) * limit * (0.35 + random() * 0.65));
  const layout = { kind, name: LAYOUT_NAMES[kind], wind, boxes: [], bag: null };
  if (kind === 'warmup') layout.basket = basket(575 + jitter, floor);
  if (kind === 'bench') {
    layout.boxes.push({ type: 'bench', x0: 455 + jitter * 0.4, x1: 580 + jitter * 0.4, y0: floor - 48, y1: floor, z0: -34, z1: 34 });
    layout.basket = basket(675 + jitter, floor);
  }
  if (kind === 'lockers') {
    const x = 680 + jitter * 0.6;
    layout.boxes.push({ type: 'lockers', x0: x - 78, x1: x + 78, y0: floor - 112, y1: floor, z0: -58, z1: 58 });
    layout.basket = basket(x, floor - 112);
  }
  if (kind === 'bag') {
    layout.bag = { pivotX: 470 + jitter * 0.4, pivotY: -30, rope: 250, length: 118, radius: 30, angle: (random() < 0.5 ? -1 : 1) * (0.2 + random() * 0.14), velocity: 0 };
    layout.basket = basket(672 + jitter, floor);
  }
  return layout;
}

function basket(x, bottom) { return { x, z: 0, radius: 56, bottom, rim: bottom - 58 }; }

export function createTowelSim(layout, { random = Math.random } = {}) {
  const count = COLS * ROWS;
  const pos = new Float64Array(count * 3), prev = new Float64Array(count * 3), force = new Float64Array(count * 3);
  const free = new Uint8Array(count).fill(1);
  const links = [];
  const index = (c, r) => r * COLS + c;
  const link = (a, b, stiffness) => links.push(a, b, stiffness);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (c + 1 < COLS) link(index(c, r), index(c + 1, r), 1);
    if (r + 1 < ROWS) link(index(c, r), index(c, r + 1), 1);
    if (c + 1 < COLS && r + 1 < ROWS) { link(index(c, r), index(c + 1, r + 1), 0.9); link(index(c + 1, r), index(c, r + 1), 0.9); }
    // Terry cloth is thick: skip-one links resist sharp creases without making it stiff.
    if (c + 2 < COLS) link(index(c, r), index(c + 2, r), 0.2);
    if (r + 2 < ROWS) link(index(c, r), index(c, r + 2), 0.2);
    if (c + 2 < COLS && r + 2 < ROWS) { link(index(c, r), index(c + 2, r + 2), 0.08); link(index(c + 2, r), index(c, r + 2), 0.08); }
  }
  const linkA = new Int32Array(links.length / 3), linkB = new Int32Array(links.length / 3), stiff = new Float64Array(links.length / 3), rest = new Float64Array(links.length / 3);
  const triangles = [];
  for (let r = 0; r + 1 < ROWS; r++) for (let c = 0; c + 1 < COLS; c++) {
    const a = index(c, r), b = index(c + 1, r), d = index(c, r + 1), e = index(c + 1, r + 1);
    triangles.push(a, b, d, b, e, d);
  }
  const tris = new Int32Array(triangles);

  // The towel starts hanging from its corner, slightly crumpled out of plane.
  const hand = { x: WORLD.anchor.x, y: WORLD.anchor.y };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = index(c, r) * 3;
    pos[i] = hand.x + c * SPACING * 0.72 - r * SPACING * 0.3;
    pos[i + 1] = hand.y + c * SPACING * 0.62 + r * SPACING * 0.82;
    pos[i + 2] = (random() - 0.5) * 3 + r * SPACING * 0.25;
  }
  prev.set(pos);
  for (let k = 0; k < linkA.length; k++) {
    linkA[k] = links[k * 3]; linkB[k] = links[k * 3 + 1]; stiff[k] = links[k * 3 + 2];
    const a = linkA[k], b = linkB[k];
    const ca = a % COLS, ra = Math.floor(a / COLS), cb = b % COLS, rb = Math.floor(b / COLS);
    rest[k] = Math.hypot(ca - cb, ra - rb) * SPACING;
  }

  const sim = {
    layout, pos, prev, tris, count, time: 0, phase: 'holding', windNow: layout.wind,
    touched: { rim: false, wall: false, bag: false, box: false, floor: false }, impacts: [],
    bagPoint: null, flightTime: 0, calm: 0, result: null,
  };
  free[0] = 0;

  const bag = layout.bag;
  const bagEnds = () => {
    const s = Math.sin(bag.angle), c = Math.cos(bag.angle);
    return { ax: bag.pivotX + s * bag.rope, ay: bag.pivotY + c * bag.rope, bx: bag.pivotX + s * (bag.rope + bag.length), by: bag.pivotY + c * (bag.rope + bag.length) };
  };
  if (bag) sim.bagPoint = bagEnds();

  function impact(kind, i, speed) {
    if (speed < 140 || sim.phase !== 'flying') return;
    sim.impacts.push({ kind, x: pos[i], y: pos[i + 1], z: pos[i + 2], speed });
  }

  function friction(i, amount) {
    prev[i] = pos[i] - (pos[i] - prev[i]) * amount;
    prev[i + 1] = pos[i + 1] - (pos[i + 1] - prev[i + 1]) * amount;
    prev[i + 2] = pos[i + 2] - (pos[i + 2] - prev[i + 2]) * amount;
  }

  function collide(p) {
    const i = p * 3;
    let x = pos[i], y = pos[i + 1], z = pos[i + 2];
    const speed = () => Math.hypot(x - prev[i], y - prev[i + 1], z - prev[i + 2]) / DT;
    if (y > WORLD.floor - RADIUS) {
      if (!sim.touched.floor) impact('floor', i, speed());
      sim.touched.floor = sim.phase === 'flying' || sim.touched.floor;
      pos[i + 1] = y = WORLD.floor - RADIUS;
      prev[i + 1] = y;
      friction(i, 0.25);
    }
    if (z < -WORLD.depth) pos[i + 2] = z = -WORLD.depth;
    if (z > WORLD.depth) pos[i + 2] = z = WORLD.depth;
    for (const box of layout.boxes) {
      const x0 = box.x0 - RADIUS, x1 = box.x1 + RADIUS, y0 = box.y0 - RADIUS, z0 = box.z0 - RADIUS, z1 = box.z1 + RADIUS;
      if (x <= x0 || x >= x1 || y <= y0 || z <= z0 || z >= z1) continue;
      const px = prev[i], py = prev[i + 1], pz = prev[i + 2];
      const options = [];
      if (py <= y0) options.push([0, y - y0, 1, y0]);
      if (px <= x0) options.push([0, x - x0, 0, x0]);
      if (px >= x1) options.push([0, x1 - x, 0, x1]);
      if (pz <= z0) options.push([0, z - z0, 2, z0]);
      if (pz >= z1) options.push([0, z1 - z, 2, z1]);
      if (!options.length) options.push([0, y - y0, 1, y0], [0, x - x0, 0, x0], [0, x1 - x, 0, x1]);
      options.sort((a, b) => a[1] - b[1]);
      const [, , axis, value] = options[0];
      if (!sim.touched.box) impact(box.type, i, speed());
      if (sim.phase === 'flying') sim.touched.box = true;
      pos[i + axis] = value;
      prev[i + axis] = value;
      friction(i, 0.35);
      x = pos[i]; y = pos[i + 1]; z = pos[i + 2];
    }
    const b = layout.basket;
    let dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz) || 0.0001;
    // Rim: a torus the towel can snag on and drape over.
    const qy = b.rim, rx = dx - dx / d * b.radius, rz = dz - dz / d * b.radius, ry = y - qy;
    const rimDistance = Math.hypot(rx, ry, rz);
    if (rimDistance < RIM_TUBE + RADIUS) {
      const scale = (RIM_TUBE + RADIUS) / (rimDistance || 0.0001);
      if (!sim.touched.rim) impact('rim', i, speed());
      if (sim.phase === 'flying') sim.touched.rim = true;
      pos[i] = x = b.x + dx / d * b.radius + rx * scale;
      pos[i + 1] = y = qy + ry * scale;
      pos[i + 2] = z = b.z + dz / d * b.radius + rz * scale;
      friction(i, 0.55);
      dx = x - b.x; dz = z - b.z; d = Math.hypot(dx, dz) || 0.0001;
    }
    if (y > b.rim && y < b.bottom + RADIUS) {
      const pd = Math.hypot(prev[i] - b.x, prev[i + 2] - b.z);
      const inner = b.radius - WALL - RADIUS, outer = b.radius + WALL + RADIUS;
      if (pd < b.radius && d > inner) {
        pos[i] = x = b.x + dx / d * inner; pos[i + 2] = z = b.z + dz / d * inner;
        friction(i, 0.6);
      } else if (pd >= b.radius && d < outer) {
        if (!sim.touched.wall) impact('wall', i, speed());
        if (sim.phase === 'flying') sim.touched.wall = true;
        pos[i] = x = b.x + dx / d * outer; pos[i + 2] = z = b.z + dz / d * outer;
        friction(i, 0.6);
      }
      if (d < b.radius && y > b.bottom - RADIUS - WALL) {
        pos[i + 1] = y = b.bottom - RADIUS - WALL;
        prev[i + 1] = y;
        friction(i, 0.3);
      }
    }
    if (bag) {
      const e = sim.bagPoint, ex = e.bx - e.ax, ey = e.by - e.ay;
      const t = Math.max(0, Math.min(1, ((x - e.ax) * ex + (y - e.ay) * ey) / (ex * ex + ey * ey)));
      const cx = e.ax + ex * t, cy = e.ay + ey * t, ox = x - cx, oy = y - cy, oz = z;
      const distance = Math.hypot(ox, oy, oz), limit = bag.radius + RADIUS;
      if (distance < limit) {
        const s = limit / (distance || 0.0001);
        if (!sim.touched.bag) impact('bag', i, speed());
        if (sim.phase === 'flying') sim.touched.bag = true;
        pos[i] = cx + ox * s; pos[i + 1] = cy + oy * s; pos[i + 2] = oz * s;
        // The swinging bag hands its own surface velocity to the cloth.
        const r = bag.rope + bag.length * t, vx = Math.cos(bag.angle) * bag.velocity * r, vy = -Math.sin(bag.angle) * bag.velocity * r;
        prev[i] = pos[i] - vx * DT * 0.8 - (pos[i] - prev[i]) * 0.2;
        prev[i + 1] = pos[i + 1] - vy * DT * 0.8 - (pos[i + 1] - prev[i + 1]) * 0.2;
        prev[i + 2] = pos[i + 2] - (pos[i + 2] - prev[i + 2]) * 0.4;
      }
    }
  }

  function step() {
    sim.time += DT;
    const gust = 1 + 0.2 * Math.sin(sim.time * 1.7) + 0.12 * Math.sin(sim.time * 4.1 + 1.3);
    sim.windNow = layout.wind * gust;
    if (bag) {
      // Real pendulum: θ'' = −(g / L)·sin θ, semi-implicit Euler.
      const length = bag.rope + bag.length * 0.5;
      bag.velocity += -(GRAVITY / length) * Math.sin(bag.angle) * DT;
      bag.angle += bag.velocity * DT;
      sim.bagPoint = bagEnds();
    }
    force.fill(0);
    const inv = 1 / DT;
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t] * 3, b = tris[t + 1] * 3, c = tris[t + 2] * 3;
      const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
      const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const doubled = Math.hypot(nx, ny, nz);
      if (doubled < 1e-6) continue;
      nx /= doubled; ny /= doubled; nz /= doubled;
      const area = doubled / 2;
      const vx = ((pos[a] - prev[a]) + (pos[b] - prev[b]) + (pos[c] - prev[c])) * inv / 3 - sim.windNow;
      const vy = ((pos[a + 1] - prev[a + 1]) + (pos[b + 1] - prev[b + 1]) + (pos[c + 1] - prev[c + 1])) * inv / 3;
      const vz = ((pos[a + 2] - prev[a + 2]) + (pos[b + 2] - prev[b + 2]) + (pos[c + 2] - prev[c + 2])) * inv / 3;
      const speed = Math.hypot(vx, vy, vz), vn = vx * nx + vy * ny + vz * nz;
      // Pressure drag on the face gives the flutter; form drag keeps flights readable.
      const fn = -DRAG_NORMAL * area * vn * speed, ft = -DRAG_FORM * area * speed;
      // Depth lift is damped so throws stay near the plane the player aims in.
      const fx = (fn * nx + ft * vx) / 3, fy = (fn * ny + ft * vy) / 3, fz = (fn * nz * 0.2 + ft * vz * 4) / 3;
      force[a] += fx; force[a + 1] += fy; force[a + 2] += fz;
      force[b] += fx; force[b + 1] += fy; force[b + 2] += fz;
      force[c] += fx; force[c + 1] += fy; force[c + 2] += fz;
    }
    const dt2 = DT * DT;
    for (let p = 0; p < count; p++) {
      const i = p * 3;
      if (!free[p]) continue;
      const vx = (pos[i] - prev[i]) * DAMPING, vy = (pos[i + 1] - prev[i + 1]) * DAMPING, vz = (pos[i + 2] - prev[i + 2]) * DAMPING;
      prev[i] = pos[i]; prev[i + 1] = pos[i + 1]; prev[i + 2] = pos[i + 2];
      pos[i] += vx + force[i] * dt2;
      pos[i + 1] += vy + (GRAVITY + force[i + 1]) * dt2;
      pos[i + 2] += vz + force[i + 2] * dt2;
    }
    if (!free[0]) {
      prev[0] = pos[0]; prev[1] = pos[1]; prev[2] = pos[2];
      pos[0] = hand.x; pos[1] = hand.y; pos[2] = 0;
      // The grip keeps the towel roughly facing the camera instead of edge-on.
      for (let p = 1; p < count; p++) pos[p * 3 + 2] *= 0.985;
    }
    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
      for (let k = 0; k < linkA.length; k++) {
        const a = linkA[k], b = linkB[k], ia = a * 3, ib = b * 3;
        const dx = pos[ib] - pos[ia], dy = pos[ib + 1] - pos[ia + 1], dz = pos[ib + 2] - pos[ia + 2];
        const length = Math.hypot(dx, dy, dz);
        if (length < 1e-6) continue;
        const wa = free[a], wb = free[b], w = wa + wb;
        if (!w) continue;
        const diff = (length - rest[k]) / length * stiff[k] / w;
        pos[ia] += dx * diff * wa; pos[ia + 1] += dy * diff * wa; pos[ia + 2] += dz * diff * wa;
        pos[ib] -= dx * diff * wb; pos[ib + 1] -= dy * diff * wb; pos[ib + 2] -= dz * diff * wb;
      }
      for (let p = 0; p < count; p++) if (free[p]) collide(p);
    }
    if (sim.phase === 'flying') { sim.flightTime += DT; judge(); }
  }

  function inside() {
    const b = layout.basket;
    let n = 0;
    for (let p = 0; p < count; p++) {
      const i = p * 3;
      if (Math.hypot(pos[i] - b.x, pos[i + 2] - b.z) < b.radius && pos[i + 1] > b.rim - 6 && pos[i + 1] < b.bottom + 2) n++;
    }
    return n / count;
  }

  function judge() {
    let maxSpeed = 0, cx = 0, cy = 0, vx = 0, vy = 0, vz = 0;
    for (let p = 0; p < count; p++) {
      const i = p * 3, dx = pos[i] - prev[i], dy = pos[i + 1] - prev[i + 1], dz = pos[i + 2] - prev[i + 2];
      maxSpeed = Math.max(maxSpeed, Math.hypot(dx, dy, dz) / DT);
      cx += pos[i]; cy += pos[i + 1]; vx += dx; vy += dy; vz += dz;
    }
    cx /= count; cy /= count;
    const comSpeed = Math.hypot(vx, vy, vz) / count / DT;
    const share = inside();
    sim.share = share;
    // Settled once the towel as a whole stops moving; single particles may still twitch.
    sim.calm = comSpeed < 40 && maxSpeed < 260 ? sim.calm + DT : 0;
    const early = sim.flightTime > 0.35 && (share > 0.8 && comSpeed < 90 || share === 0 && cy > WORLD.floor - 36 && comSpeed < 60);
    if (early || sim.calm > 0.3 || sim.flightTime > 6 || cx > WORLD.width + 80 || cx < -80) {
      const hit = share >= 0.6;
      const kind = hit ? 'in' : share > 0.12 ? 'rim' : sim.touched.bag ? 'bag' : cx > WORLD.width + 40 || cx < -40 ? 'out' : 'floor';
      sim.result = { hit, kind, share, clean: hit && !sim.touched.rim && !sim.touched.wall && !sim.touched.bag && !sim.touched.box, time: sim.flightTime };
      sim.phase = 'done';
    }
  }

  sim.setHand = (x, y) => {
    if (sim.phase !== 'holding') return;
    hand.x = x; hand.y = y;
  };
  // Whip: the gripped corner leaves fastest and the far end trails, so the towel unfurls in flight.
  const whips = () => {
    let reach = 1;
    for (let p = 0; p < count; p++) reach = Math.max(reach, Math.hypot(pos[p * 3] - pos[0], pos[p * 3 + 1] - pos[1]));
    return Array.from({ length: count }, (_, p) => 1.18 - 0.36 * Math.hypot(pos[p * 3] - pos[0], pos[p * 3 + 1] - pos[1]) / reach);
  };
  // Where the towel's centre of mass starts and how fast it leaves for a given launch.
  sim.launchState = (vx, vy) => {
    const whip = whips();
    let cx = 0, cy = 0, w = 0;
    for (let p = 0; p < count; p++) { cx += pos[p * 3]; cy += pos[p * 3 + 1]; w += whip[p]; }
    return { x: cx / count, y: cy / count, vx: vx * w / count, vy: vy * w / count };
  };
  sim.release = (vx, vy, spin = 5) => {
    if (sim.phase !== 'holding') return false;
    free[0] = 1;
    const whip = whips();
    let cx = 0, cy = 0;
    for (let p = 0; p < count; p++) { cx += pos[p * 3]; cy += pos[p * 3 + 1]; }
    cx /= count; cy /= count;
    const tumble = (random() - 0.5) * 1.2;
    for (let p = 0; p < count; p++) {
      const i = p * 3, rx = pos[i] - cx, ry = pos[i + 1] - cy, rz = pos[i + 2];
      const ux = vx * whip[p] - spin * ry, uy = vy * whip[p] + spin * rx - tumble * rz, uz = tumble * ry - rz * 1.5 + (random() - 0.5) * 4;
      prev[i] = pos[i] - ux * DT; prev[i + 1] = pos[i + 1] - uy * DT; prev[i + 2] = pos[i + 2] - uz * DT;
    }
    sim.phase = 'flying';
    return true;
  };
  sim.advance = seconds => {
    const steps = Math.min(40, Math.round(seconds / DT));
    for (let s = 0; s < steps; s++) step();
    return steps * DT;
  };
  sim.step = step;
  // Let the towel settle into a natural hang before the player sees it.
  for (let s = 0; s < 360; s++) step();
  return sim;
}

// Aim helpers shared by the renderer and tests. The hand travels less than the
// drag so a full wind-up keeps the towel off the floor.
export function handFromPull(pullX, pullY) {
  return { x: WORLD.anchor.x + pullX * 0.62, y: WORLD.anchor.y + pullY * 0.42 };
}

export function launchFromPull(pullX, pullY) {
  const length = Math.hypot(pullX, pullY), max = WORLD.maxPull;
  const scale = length > max ? max / length : 1;
  return { x: -pullX * scale * WORLD.launchScale, y: -pullY * scale * WORLD.launchScale, pullX: pullX * scale, pullY: pullY * scale, power: Math.min(1, length / max) };
}

// Point-mass forecast of the towel's centre of mass: gravity, the same air drag
// the cloth feels on average, and the fan. Used for the aiming hint.
export const FLIGHT_DRAG = 0.0011;
export function predictFlight(start, wind = 0, duration = 0.5, every = 0.026) {
  const points = [];
  let { x, y, vx, vy } = start, t = 0, next = every;
  const dt = DT;
  while (t < duration) {
    const rx = vx - wind, speed = Math.hypot(rx, vy);
    vx = vx * DAMPING - FLIGHT_DRAG * speed * rx * dt;
    vy = vy * DAMPING + (GRAVITY - FLIGHT_DRAG * speed * vy) * dt;
    x += vx * dt; y += vy * dt; t += dt;
    if (t >= next) { points.push({ x, y, t }); next += every; }
  }
  return points;
}

export function simulateThrow(layout, pullX, pullY, { random = seededRandom(7), holdTime = 0 } = {}) {
  const sim = createTowelSim(structuredClone(layout), { random });
  const launch = launchFromPull(pullX, pullY);
  const hand = handFromPull(launch.pullX, launch.pullY);
  sim.setHand(hand.x, hand.y);
  for (let s = 0; s < 60 + Math.round(holdTime * 240); s++) sim.step();
  sim.release(launch.x, launch.y);
  while (sim.phase !== 'done') sim.step();
  return sim.result;
}

// ---------------------------------------------------------------------------
// Renderer and input. Everything below touches the DOM only when mounted.

const FONT = '"Roboto Condensed","Arial Narrow",sans-serif';
const TOWEL_BASE = [244, 239, 227], TOWEL_STRIPE = [255, 101, 59], TOWEL_HEM = [226, 216, 198];
const LIGHT = (() => { const v = [-0.32, -0.82, 0.48], l = Math.hypot(...v); return v.map(n => n / l); })();
const VIEW = (() => { const l = Math.hypot(0.32, 1); return [0, -0.32 / l, 1 / l]; })();
const HINT_TIME = [0.46, 0.38, 0.3, 0.24];
const OUTCOMES = {
  in: [['В КОРЗИНУ!', 'Завхоз одобрительно кивнул.'], ['ЕСТЬ!', 'Стирка сама себя не соберёт.'], ['ПРИНЯТО!', 'Мягко, как в рекламе кондиционера.']],
  clean: [['ЧИСТЫЙ БРОСОК!', 'Даже край корзины не задел.'], ['СВИШ!', 'Полотенце легло, как в замедленной съёмке.']],
  rim: [['НА КРАЮ…', 'Повисло на бортике. Не засчитано.'], ['ПОЧТИ!', 'Полотенце задумалось на бортике.']],
  bag: [['ГРУША ОТБИЛА', 'Она сегодня в форме.'], ['БЛОК!', 'Груша не пропускает ни удары, ни полотенца.']],
  floor: [['МИМО', 'Уборщица запомнила тебя в лицо.'], ['НА ПОЛ', 'Пол теперь тоже чистый. Почти.'], ['НЕДОЛЁТ', 'Корзина ждала тебя чуть дальше.']],
  out: [['ПЕРЕЛЁТ', 'Полотенце ушло в соседний зал.'], ['В АУТ', 'Кто-то в раздевалке получил подарок.']],
};
const pick = list => list[Math.floor(Math.random() * list.length)];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const shade = (color, k) => `rgb(${Math.round(clamp(color[0] * k, 0, 255))},${Math.round(clamp(color[1] * k, 0, 255))},${Math.round(clamp(color[2] * k, 0, 255))})`;

export function outcomeText(result) {
  const [title, line] = pick(result.clean ? OUTCOMES.clean : OUTCOMES[result.kind] || OUTCOMES.floor);
  return { title, line };
}

export function mountTowelGame(canvas, { gym = 0, throws = 3, perHit = 0, payFor = () => 0, sound = () => {}, onThrow = () => {}, onShot = () => {}, onDone = () => {}, reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const W = WORLD.width, H = WORLD.height, anchor = WORLD.anchor, level = clamp(Math.floor(gym) || 0, 0, 3);
  const layouts = planShift(level);
  const project = (x, y, z) => [x, y + z * PROJECT_Z];
  let scale = 1, ui = 1, bg = null, fg = null, vignette = null;
  let index = -1, layout = null, sim = null, phase = 'aim', active = true, raf = 0, last = performance.now(), accumulator = 0;
  let pull = { x: 0, y: 0 }, drag = null, hits = 0, banner = null, fade = 0, fadeTarget = 0, pendingNext = 0;
  let particles = [], shake = 0, slowUntil = 0, slowUsed = false, lastSound = 0, flicker = 0, now = performance.now();
  const arm = { x: anchor.x, y: anchor.y, follow: 0 };
  const streaks = Array.from({ length: 34 }, () => ({ x: Math.random() * W, y: 40 + Math.random() * 380, z: (Math.random() - 0.5) * 120, length: 30 + Math.random() * 70, speed: 0.6 + Math.random() * 0.8 }));

  const layer = draw => {
    const node = document.createElement('canvas');
    node.width = canvas.width; node.height = canvas.height;
    const g = node.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    draw(g);
    return node;
  };
  const rebuild = () => {
    if (!layout) return;
    bg = layer(g => { drawRoom(g); drawProps(g); drawBasketBack(g, layout.basket); });
    fg = layer(g => drawBasketFront(g, layout.basket));
    vignette = layer(g => {
      const v = g.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.5, W * 0.62);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(2,8,10,.62)');
      g.fillStyle = v; g.fillRect(0, 0, W, H);
    });
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(320, Math.round((rect.width || W) * dpr));
    if (canvas.width === width && bg) return;
    canvas.width = width; canvas.height = Math.round(width * H / W);
    scale = canvas.width / W;
    // Canvas labels are authored for ~960px; enlarge them when the stage is phone-sized.
    ui = clamp(720 / (rect.width || W), 1, 2.3);
    rebuild();
  };

  // --- Static scene -------------------------------------------------------
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function drawRoom(g) {
    const floorBack = project(0, WORLD.floor, -WORLD.depth)[1];
    const wall = g.createLinearGradient(0, 0, 0, floorBack);
    wall.addColorStop(0, '#0a1316'); wall.addColorStop(0.55, '#10242a'); wall.addColorStop(1, '#16323a');
    g.fillStyle = wall; g.fillRect(0, 0, W, floorBack);
    const speck = seededRandom(11);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = speck() < 0.5 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.07)';
      g.fillRect(speck() * W, speck() * 290, 1 + speck() * 2, 1 + speck() * 2);
    }
    // Tiled lower wall with a trim, like a locker-room wainscot.
    g.fillStyle = '#17333a'; g.fillRect(0, 292, W, floorBack - 292);
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1.4;
    for (let y = 292; y < floorBack; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let row = 0, y = 292; y < floorBack; row++, y += 20) for (let x = row % 2 * 20; x < W; x += 40) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, Math.min(floorBack, y + 20)); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.035)';
    for (let y = 293; y < floorBack; y += 20) g.fillRect(0, y, W, 1);
    g.fillStyle = '#23454d'; g.fillRect(0, 284, W, 9);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 284, W, 1.5);
    // Neon sign.
    g.save();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 46px ${FONT}`;
    g.shadowColor = '#ff653b'; g.shadowBlur = 26;
    g.strokeStyle = '#ff7a52'; g.lineWidth = 3; g.strokeText('СТИРКА', 470, 72);
    g.shadowBlur = 10; g.fillStyle = '#ffd2bf'; g.fillText('СТИРКА', 470, 72);
    g.font = `800 15px ${FONT}`; g.shadowColor = '#8ddbcc'; g.shadowBlur = 14; g.fillStyle = '#c9fff3';
    g.fillText('ПРИЁМ ПОЛОТЕНЕЦ · 24/7', 470, 112);
    g.strokeStyle = '#8ddbcc'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(570, 104); g.quadraticCurveTo(640, 104, 668, 150); g.moveTo(668, 150); g.lineTo(652, 146); g.moveTo(668, 150); g.lineTo(670, 134); g.stroke();
    g.restore();
    // Hooks with spare towels.
    g.fillStyle = '#2b4a51'; roundRect(g, 262, 150, 150, 7, 3); g.fill();
    [[285, '#8ddbcc'], [335, '#e4b56d'], [385, '#ff653b']].forEach(([x, stripe], i) => {
      g.fillStyle = '#9fb2ae'; g.beginPath(); g.arc(x, 158, 3, 0, Math.PI * 2); g.fill();
      const length = 58 + i * 9;
      const grad = g.createLinearGradient(x - 16, 0, x + 16, 0);
      grad.addColorStop(0, '#9a988e'); grad.addColorStop(0.45, '#d9d4c7'); grad.addColorStop(1, '#8c897f');
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(x - 4, 158); g.quadraticCurveTo(x - 18, 170, x - 16, 158 + length); g.quadraticCurveTo(x, 164 + length, x + 16, 156 + length); g.quadraticCurveTo(x + 17, 170, x + 4, 158); g.closePath(); g.fill();
      g.fillStyle = stripe; g.globalAlpha = 0.85;
      g.beginPath(); g.moveTo(x - 16.5, 146 + length); g.lineTo(x + 16.5, 144 + length); g.lineTo(x + 16.3, 150 + length); g.lineTo(x - 16.2, 152 + length); g.fill();
      g.globalAlpha = 1;
    });
    // Lamps and light cones.
    for (const lx of [300, 720]) {
      g.strokeStyle = '#0b1518'; g.lineWidth = 2; g.beginPath(); g.moveTo(lx, 0); g.lineTo(lx, 34); g.stroke();
      g.save(); g.globalCompositeOperation = 'lighter';
      const cone = g.createLinearGradient(0, 50, 0, 460);
      cone.addColorStop(0, 'rgba(255,214,150,.17)'); cone.addColorStop(1, 'rgba(255,214,150,0)');
      g.fillStyle = cone; g.beginPath(); g.moveTo(lx - 20, 52); g.lineTo(lx + 20, 52); g.lineTo(lx + 210, 470); g.lineTo(lx - 210, 470); g.closePath(); g.fill();
      g.restore();
      const shadeGrad = g.createLinearGradient(lx - 26, 0, lx + 26, 0);
      shadeGrad.addColorStop(0, '#16272c'); shadeGrad.addColorStop(0.5, '#3b5a60'); shadeGrad.addColorStop(1, '#122126');
      g.fillStyle = shadeGrad; g.beginPath(); g.moveTo(lx - 9, 32); g.lineTo(lx + 9, 32); g.lineTo(lx + 27, 54); g.lineTo(lx - 27, 54); g.closePath(); g.fill();
      const bulb = g.createRadialGradient(lx, 54, 1, lx, 54, 26);
      bulb.addColorStop(0, 'rgba(255,244,214,1)'); bulb.addColorStop(0.3, 'rgba(255,212,150,.55)'); bulb.addColorStop(1, 'rgba(255,212,150,0)');
      g.fillStyle = bulb; g.beginPath(); g.arc(lx, 54, 26, 0, Math.PI * 2); g.fill();
    }
    // Floor: rubber tiles in the same oblique projection as the simulation.
    const floor = g.createLinearGradient(0, floorBack, 0, H);
    floor.addColorStop(0, '#1d2a2d'); floor.addColorStop(0.5, '#141e21'); floor.addColorStop(1, '#0c1315');
    g.fillStyle = floor; g.fillRect(0, floorBack, W, H - floorBack);
    g.strokeStyle = 'rgba(0,0,0,.38)'; g.lineWidth = 1.5;
    for (let z = -WORLD.depth + 46; z < 400; z += 46) { const y = project(0, WORLD.floor, z)[1]; if (y > H) break; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let x = 48; x < W; x += 96) { g.beginPath(); g.moveTo(x, floorBack); g.lineTo(x, H); g.stroke(); }
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const lx of [300, 720]) {
      const pool = g.createRadialGradient(lx, 452, 10, lx, 452, 230);
      pool.addColorStop(0, 'rgba(255,205,140,.16)'); pool.addColorStop(1, 'rgba(255,205,140,0)');
      g.fillStyle = pool; g.save(); g.translate(lx, 452); g.scale(1, 0.26); g.translate(-lx, -452); g.beginPath(); g.arc(lx, 452, 230, 0, Math.PI * 2); g.fill(); g.restore();
    }
    g.restore();
    g.fillStyle = '#0b171a'; g.fillRect(0, floorBack - 7, W, 8);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, floorBack - 7, W, 1);
    // Throw line.
    g.fillStyle = 'rgba(255,101,59,.55)';
    for (let y = floorBack + 4; y < H; y += 18) g.fillRect(262, y, 5, 10);
  }

  function box3d(g, box, { top, front, side, inset = 0 }) {
    const [x0, y0f] = project(box.x0, box.y0, box.z1), [x1] = project(box.x1, box.y0, box.z1);
    const yBack = project(0, box.y0, box.z0)[1], yBottom = project(0, box.y1, box.z1)[1];
    g.fillStyle = top; g.beginPath(); g.moveTo(x0, yBack); g.lineTo(x1, yBack); g.lineTo(x1, y0f); g.lineTo(x0, y0f); g.closePath(); g.fill();
    g.fillStyle = front; g.fillRect(x0 + inset, y0f, x1 - x0 - inset * 2, yBottom - y0f);
    if (side) { g.fillStyle = side; g.fillRect(x1 - 4, y0f, 4, yBottom - y0f); }
    return { x0, x1, yTop: y0f, yBack, yBottom };
  }

  function drawProps(g) {
    for (const box of layout.boxes) {
      const floorShadow = project(0, WORLD.floor, box.z1)[1];
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse((box.x0 + box.x1) / 2, floorShadow - 8, (box.x1 - box.x0) / 2 + 18, 18, 0, 0, Math.PI * 2); g.fill();
      if (box.type === 'bench') drawBench(g, box);
      if (box.type === 'lockers') drawLockers(g, box);
    }
  }

  function drawBench(g, box) {
    const legY = project(0, box.y0 + 12, box.z1)[1], floorY = project(0, WORLD.floor, box.z1)[1];
    const backLegY = project(0, WORLD.floor, box.z0)[1];
    g.strokeStyle = '#27373b'; g.lineWidth = 7; g.lineCap = 'round';
    for (const x of [box.x0 + 18, box.x1 - 18]) { g.beginPath(); g.moveTo(x, project(0, box.y0 + 12, box.z0)[1]); g.lineTo(x + 3, backLegY - 2); g.stroke(); }
    const steel = g.createLinearGradient(0, legY, 0, floorY);
    steel.addColorStop(0, '#8fa3a3'); steel.addColorStop(1, '#3a4b4e');
    g.strokeStyle = steel; g.lineWidth = 8;
    for (const x of [box.x0 + 18, box.x1 - 18]) { g.beginPath(); g.moveTo(x, legY); g.lineTo(x - 4, floorY - 3); g.stroke(); g.beginPath(); g.moveTo(x - 16, floorY - 3); g.lineTo(x + 12, floorY - 3); g.stroke(); }
    const pad = { ...box, y1: box.y0 + 13 };
    const r = box3d(g, pad, { top: '#3a4449', front: '#1d2427' });
    const shine = g.createLinearGradient(0, r.yBack, 0, r.yTop);
    shine.addColorStop(0, 'rgba(255,255,255,.05)'); shine.addColorStop(1, 'rgba(255,255,255,.16)');
    g.fillStyle = shine; g.fillRect(r.x0, r.yBack, r.x1 - r.x0, r.yTop - r.yBack);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.setLineDash([3, 4]);
    g.beginPath(); g.moveTo(r.x0 + 6, r.yTop + 6); g.lineTo(r.x1 - 6, r.yTop + 6); g.stroke(); g.setLineDash([]);
  }

  function drawLockers(g, box) {
    const r = box3d(g, box, { top: '#3f6068', front: '#28464e' });
    const doors = 3, width = (r.x1 - r.x0) / doors;
    for (let i = 0; i < doors; i++) {
      const x = r.x0 + i * width;
      const door = g.createLinearGradient(x, 0, x + width, 0);
      door.addColorStop(0, '#2f555e'); door.addColorStop(0.55, '#386670'); door.addColorStop(1, '#274851');
      g.fillStyle = door; g.fillRect(x + 2, r.yTop + 3, width - 4, r.yBottom - r.yTop - 6);
      g.fillStyle = 'rgba(0,0,0,.4)';
      for (let v = 0; v < 5; v++) roundRect(g, x + 10, r.yTop + 12 + v * 6, width - 20, 2.5, 1.2), g.fill();
      g.fillStyle = '#c8d6d0'; roundRect(g, x + width - 13, r.yTop + 62, 4, 16, 2); g.fill();
      g.fillStyle = 'rgba(228,181,109,.9)'; g.font = `800 10px ${FONT}`; g.textAlign = 'center';
      g.fillText(String([7, 13, 21][i]).padStart(2, '0'), x + width / 2, r.yTop + 56);
    }
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(r.x0, r.yTop, r.x1 - r.x0, 1.5);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(r.x0, r.yBottom - 5, r.x1 - r.x0, 5);
  }

  const basketSize = (b, y) => b.radius * (1 - (y - b.rim) / (b.bottom - b.rim) * 0.1);
  function drawBasketBack(g, b) {
    const [cx, rimY] = project(b.x, b.rim, b.z), bottomY = project(b.x, b.bottom, b.z)[1];
    const ry = b.radius * PROJECT_Z;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(cx + 8, bottomY + 2, b.radius * 1.12, ry * 1.25, 0, 0, Math.PI * 2); g.fill();
    // Inside of the basket seen through the opening.
    const inner = g.createLinearGradient(0, rimY - ry, 0, rimY + ry);
    inner.addColorStop(0, '#5b3d22'); inner.addColorStop(1, '#1e130a');
    g.fillStyle = inner; g.beginPath(); g.ellipse(cx, rimY, b.radius - 2, ry - 1, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
    for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(cx, rimY + k * 5, b.radius - 3 - k, ry - 2, 0, Math.PI, Math.PI * 2); g.stroke(); }
    g.strokeStyle = '#7c5530'; g.lineWidth = 8; g.beginPath(); g.ellipse(cx, rimY, b.radius, ry, 0, Math.PI, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,220,160,.35)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, rimY - 2.5, b.radius, ry, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  }
  function drawBasketFront(g, b) {
    const [cx, rimY] = project(b.x, b.rim, b.z), bottomY = project(b.x, b.bottom, b.z)[1];
    const ry = b.radius * PROJECT_Z, rb = basketSize(b, b.bottom);
    const body = new Path2D();
    body.ellipse(cx, rimY, b.radius, ry, 0, 0, Math.PI);
    body.lineTo(cx - rb, bottomY);
    body.ellipse(cx, bottomY, rb, rb * PROJECT_Z, 0, Math.PI, 0, true);
    body.closePath();
    const wicker = g.createLinearGradient(cx - b.radius, 0, cx + b.radius, 0);
    wicker.addColorStop(0, '#5e3f20'); wicker.addColorStop(0.3, '#c99456'); wicker.addColorStop(0.55, '#b27c43'); wicker.addColorStop(1, '#4a3019');
    g.save();
    g.fillStyle = wicker; g.fill(body); g.clip(body);
    // Woven bands follow the curvature of the basket.
    for (let k = 0, y = b.rim + 6; y < b.bottom; k++, y += 8) {
      const r = basketSize(b, y), sy = project(0, y, 0)[1];
      g.strokeStyle = k % 2 ? 'rgba(60,34,12,.45)' : 'rgba(255,214,150,.22)'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(cx, sy, r, r * PROJECT_Z, 0, 0, Math.PI); g.stroke();
    }
    g.strokeStyle = 'rgba(50,28,10,.55)'; g.lineWidth = 2;
    for (let a = 0.12; a < Math.PI; a += Math.PI / 11) {
      g.beginPath();
      for (let y = b.rim; y <= b.bottom; y += 6) {
        const r = basketSize(b, y), x = cx + Math.cos(a) * r, sy = project(0, y, 0)[1] + Math.sin(a) * r * PROJECT_Z;
        y === b.rim ? g.moveTo(x, sy) : g.lineTo(x, sy);
      }
      g.stroke();
    }
    const occlusion = g.createLinearGradient(0, rimY, 0, bottomY + ry);
    occlusion.addColorStop(0, 'rgba(0,0,0,0)'); occlusion.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = occlusion; g.fillRect(cx - b.radius, rimY, b.radius * 2, bottomY - rimY + ry + 4);
    g.restore();
    g.strokeStyle = '#8f6234'; g.lineWidth = 9; g.beginPath(); g.ellipse(cx, rimY, b.radius, ry, 0, 0, Math.PI); g.stroke();
    g.strokeStyle = 'rgba(255,226,170,.55)'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, rimY + 1, b.radius - 2, ry, 0, 0.25, Math.PI - 0.6); g.stroke();
    // Paper tag.
    const tx = cx + b.radius * 0.35, ty = rimY + ry + 16;
    g.strokeStyle = 'rgba(30,20,10,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(tx, rimY + ry - 2); g.lineTo(tx + 3, ty); g.stroke();
    g.save(); g.translate(tx + 3, ty); g.rotate(0.12);
    g.fillStyle = '#efe6cf'; roundRect(g, -20, 0, 40, 15, 2); g.fill();
    g.fillStyle = '#b53d22'; g.font = `900 8.5px ${FONT}`; g.textAlign = 'center'; g.fillText('ГРЯЗНОЕ', 0, 10.5);
    g.restore();
  }

  // --- Dynamic scene ------------------------------------------------------
  function drawFan(g, t) {
    if (Math.abs(layout.wind) < 8) return;
    const left = layout.wind > 0, x = left ? 62 : W - 62, y = 190;
    g.save();
    g.strokeStyle = '#223a40'; g.lineWidth = 6; g.beginPath(); g.moveTo(left ? 0 : W, y - 4); g.lineTo(x, y); g.stroke();
    g.translate(x, y);
    g.fillStyle = 'rgba(8,18,21,.8)'; g.beginPath(); g.arc(0, 0, 36, 0, Math.PI * 2); g.fill();
    const spin = t * Math.abs(layout.wind) * 0.12 * (left ? 1 : -1);
    for (let trail = 0; trail < 3; trail++) {
      g.globalAlpha = trail ? 0.18 : 0.85;
      for (let blade = 0; blade < 3; blade++) {
        g.save(); g.rotate(spin - trail * 0.25 + blade * Math.PI * 2 / 3);
        g.fillStyle = '#b8c9c4'; g.beginPath(); g.ellipse(0, -17, 8, 17, 0.35, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
    g.globalAlpha = 1;
    g.fillStyle = '#ff653b'; g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(200,220,215,.55)'; g.lineWidth = 1.4;
    for (const r of [14, 25, 35]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
    for (let a = 0; a < 12; a++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a * Math.PI / 6) * 35, Math.sin(a * Math.PI / 6) * 35); g.stroke(); }
    g.restore();
  }

  function drawClock(g) {
    const date = new Date(), x = 800, y = 78;
    g.save();
    g.fillStyle = '#0b1518'; g.beginPath(); g.arc(x, y, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8e6da'; g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1a2a2e'; g.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.lineWidth = i % 3 ? 1 : 2.2; g.beginPath(); g.moveTo(x + Math.cos(a) * 21, y + Math.sin(a) * 21); g.lineTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24); g.stroke(); }
    const hand = (value, length, width, color) => { const a = value * Math.PI * 2 - Math.PI / 2; g.strokeStyle = color; g.lineWidth = width; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * length, y + Math.sin(a) * length); g.stroke(); };
    hand((date.getHours() % 12 + date.getMinutes() / 60) / 12, 12, 3, '#1a2a2e');
    hand((date.getMinutes() + date.getSeconds() / 60) / 60, 18, 2, '#1a2a2e');
    hand((date.getSeconds() + date.getMilliseconds() / 1000) / 60, 20, 1, '#ff653b');
    g.restore();
  }

  function drawBag(g) {
    const bag = layout.bag, e = sim.bagPoint;
    const [px, py] = project(bag.pivotX, bag.pivotY, 0);
    g.save();
    g.strokeStyle = '#6f7f80'; g.lineWidth = 2.5; g.setLineDash([5, 3]);
    g.beginPath(); g.moveTo(px, py); g.lineTo(e.ax, e.ay - 6); g.stroke(); g.setLineDash([]);
    const floorY = project(0, WORLD.floor, 0)[1];
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse((e.ax + e.bx) / 2, floorY, 42, 8, 0, 0, Math.PI * 2); g.fill();
    g.translate(e.ax, e.ay); g.rotate(-bag.angle);
    const leather = g.createLinearGradient(-bag.radius, 0, bag.radius, 0);
    leather.addColorStop(0, '#3c0d0b'); leather.addColorStop(0.35, '#b33a2a'); leather.addColorStop(0.55, '#8e2a1f'); leather.addColorStop(1, '#2b0807');
    g.fillStyle = leather; roundRect(g, -bag.radius, 0, bag.radius * 2, bag.length, [12, 12, 24, 24]); g.fill();
    g.fillStyle = '#1c1c1c'; for (const y of [10, bag.length - 18]) g.fillRect(-bag.radius, y, bag.radius * 2, 7);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `900 15px ${FONT}`; g.textAlign = 'center'; g.fillText('BOSS', 0, bag.length / 2 + 6);
    g.fillStyle = 'rgba(255,255,255,.12)'; roundRect(g, -bag.radius + 7, 6, 6, bag.length - 16, 3); g.fill();
    g.strokeStyle = '#a7b3b1'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-bag.radius + 6, 0); g.lineTo(0, -8); g.lineTo(bag.radius - 6, 0); g.stroke();
    g.restore();
  }

  const vertexNormals = new Float64Array(TOWEL.cols * TOWEL.rows * 3);
  // Border edges per triangle, so each depth group can outline its own part of the hem.
  const borders = [];
  for (let r = 0; r + 1 < TOWEL.rows; r++) for (let c = 0; c + 1 < TOWEL.cols; c++) {
    const at = (cc, rr) => (rr * TOWEL.cols + cc) * 3;
    const first = [], second = [];
    if (r === 0) first.push([at(c, r), at(c + 1, r)]);
    if (c === 0) first.push([at(c, r), at(c, r + 1)]);
    if (c + 2 === TOWEL.cols) second.push([at(c + 1, r), at(c + 1, r + 1)]);
    if (r + 2 === TOWEL.rows) second.push([at(c + 1, r + 1), at(c, r + 1)]);
    borders.push(first, second);
  }
  function towelFaces() {
    const { pos, tris } = sim, b = layout.basket, front = [], back = [], normals = vertexNormals;
    normals.fill(0);
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t] * 3, c = tris[t + 1] * 3, d = tris[t + 2] * 3;
      const e1x = pos[c] - pos[a], e1y = pos[c + 1] - pos[a + 1], e1z = pos[c + 2] - pos[a + 2];
      const e2x = pos[d] - pos[a], e2y = pos[d + 1] - pos[a + 1], e2z = pos[d + 2] - pos[a + 2];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      for (const k of [a, c, d]) { normals[k] += nx; normals[k + 1] += ny; normals[k + 2] += nz; }
    }
    for (let t = 0, cell = 0; t < tris.length; t += 3, cell++) {
      const a = tris[t] * 3, c = tris[t + 1] * 3, d = tris[t + 2] * 3;
      // Smoothed normal: average of the vertex normals hides the mesh facets.
      let nx = normals[a] + normals[c] + normals[d], ny = normals[a + 1] + normals[c + 1] + normals[d + 1], nz = normals[a + 2] + normals[c + 2] + normals[d + 2];
      const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
      const cx = (pos[a] + pos[c] + pos[d]) / 3, cy = (pos[a + 1] + pos[c + 1] + pos[d + 1]) / 3, cz = (pos[a + 2] + pos[c + 2] + pos[d + 2]) / 3;
      const column = Math.floor(cell / 2) % (TOWEL.cols - 1);
      const base = column === 1 || column === TOWEL.cols - 3 ? TOWEL_STRIPE : column === 0 || column === TOWEL.cols - 2 ? TOWEL_HEM : TOWEL_BASE;
      const facing = nx * VIEW[0] + ny * VIEW[1] + nz * VIEW[2];
      const light = Math.abs(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const d2 = Math.hypot(cx - b.x, cz - b.z);
      const inBasket = d2 < b.radius && cy > b.rim + 4 ? 0.55 + 0.45 * clamp(1 - (cy - b.rim) / 60, 0, 1) : 1;
      const k = (0.52 + 0.5 * light) * (facing < 0 ? 0.9 : 1) * inBasket;
      const face = { a, c, d, depth: cz - cy * PROJECT_Z, color: shade(base, k), border: borders[cell] };
      (cy < b.rim - 2 || (d2 > b.radius && cz > b.z) ? front : back).push(face);
    }
    front.sort((p, q) => p.depth - q.depth); back.sort((p, q) => p.depth - q.depth);
    return { front, back };
  }
  function drawFaces(g, faces) {
    const pos = sim.pos;
    g.lineJoin = 'round'; g.lineWidth = 0.7;
    for (const f of faces) {
      g.fillStyle = f.color; g.strokeStyle = f.color;
      g.beginPath();
      g.moveTo(pos[f.a], pos[f.a + 1] + pos[f.a + 2] * PROJECT_Z);
      g.lineTo(pos[f.c], pos[f.c + 1] + pos[f.c + 2] * PROJECT_Z);
      g.lineTo(pos[f.d], pos[f.d + 1] + pos[f.d + 2] * PROJECT_Z);
      g.closePath(); g.fill(); g.stroke();
    }
    g.strokeStyle = 'rgba(70,52,40,.45)'; g.lineWidth = 1.1; g.lineCap = 'round';
    g.beginPath();
    for (const f of faces) for (const [i, j] of f.border) {
      g.moveTo(pos[i], pos[i + 1] + pos[i + 2] * PROJECT_Z);
      g.lineTo(pos[j], pos[j + 1] + pos[j + 2] * PROJECT_Z);
    }
    g.stroke();
  }
  function surfaceBelow(x, y, z) {
    const b = layout.basket;
    if (Math.hypot(x - b.x, z - b.z) < b.radius && y < b.bottom) return y > b.rim ? b.bottom : null;
    for (const box of layout.boxes) if (x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1 && y <= box.y0 + 1) return box.y0;
    return WORLD.floor;
  }
  function drawShadow(g) {
    const { pos, tris } = sim;
    let cy = 0, cx = 0, cz = 0;
    for (let p = 0; p < sim.count; p++) { cx += pos[p * 3]; cy += pos[p * 3 + 1]; cz += pos[p * 3 + 2]; }
    cx /= sim.count; cy /= sim.count; cz /= sim.count;
    const surface = surfaceBelow(cx, cy, cz);
    if (surface === null) return;
    const height = Math.max(0, surface - cy);
    g.save();
    g.fillStyle = `rgba(0,0,0,${0.34 * clamp(1 - height / 320, 0.15, 1)})`;
    g.beginPath();
    const spread = 1 + height / 500;
    for (let t = 0; t < tris.length; t += 3) {
      for (let k = 0; k < 3; k++) {
        const i = tris[t + k] * 3, x = cx + (pos[i] - cx) * spread, z = cz + (pos[i + 2] - cz) * spread * 0.6;
        const y = surface + z * PROJECT_Z + 1;
        k ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    }
    g.fill();
    g.restore();
  }

  function armPose() {
    const shoulder = { x: -64, y: 350 }, upper = 150, fore = 142;
    const dx = arm.x - shoulder.x, dy = arm.y - shoulder.y;
    const distance = clamp(Math.hypot(dx, dy), 40, upper + fore - 2);
    const angle = Math.atan2(dy, dx);
    const bend = Math.acos(clamp((upper * upper + distance * distance - fore * fore) / (2 * upper * distance), -1, 1));
    const elbow = { x: shoulder.x + Math.cos(angle + bend) * upper, y: shoulder.y + Math.sin(angle + bend) * upper };
    const hand = { x: shoulder.x + Math.cos(angle) * distance, y: shoulder.y + Math.sin(angle) * distance };
    return { shoulder, elbow, hand, wrist: Math.atan2(hand.y - elbow.y, hand.x - elbow.x) };
  }
  function limb(g, from, to, w0, w1, bulge, light, dark) {
    const a = Math.atan2(to.y - from.y, to.x - from.x), nx = -Math.sin(a), ny = Math.cos(a);
    const grad = g.createLinearGradient(from.x - nx * w0, from.y - ny * w0, from.x + nx * w0, from.y + ny * w0);
    grad.addColorStop(0, light); grad.addColorStop(0.45, light); grad.addColorStop(1, dark);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(from.x - nx * w0, from.y - ny * w0);
    g.quadraticCurveTo((from.x + to.x) / 2 - nx * w0 * bulge, (from.y + to.y) / 2 - ny * w0 * bulge, to.x - nx * w1, to.y - ny * w1);
    g.arc(to.x, to.y, w1, a - Math.PI / 2, a + Math.PI / 2);
    g.quadraticCurveTo((from.x + to.x) / 2 + nx * w0 * 1.05, (from.y + to.y) / 2 + ny * w0 * 1.05, from.x + nx * w0, from.y + ny * w0);
    g.arc(from.x, from.y, w0, a + Math.PI / 2, a - Math.PI / 2);
    g.closePath(); g.fill();
  }
  // The arm sits behind the towel; only the fist is drawn over the corner it grips.
  function drawArm(g) {
    const { shoulder, elbow, hand, wrist } = armPose();
    g.save();
    limb(g, shoulder, elbow, 30, 21, 1.45, '#dca27b', '#8b5236');
    limb(g, elbow, hand, 21, 14, 1.2, '#e6b08a', '#96603f');
    // Rim light along the top of the arm and a hint of the bicep line.
    const rim = (from, to, w0, w1, bulge) => {
      const a = Math.atan2(to.y - from.y, to.x - from.x), nx = -Math.sin(a), ny = Math.cos(a);
      g.beginPath();
      g.moveTo(from.x - nx * (w0 - 3), from.y - ny * (w0 - 3));
      g.quadraticCurveTo((from.x + to.x) / 2 - nx * (w0 * bulge - 3), (from.y + to.y) / 2 - ny * (w0 * bulge - 3), to.x - nx * (w1 - 3), to.y - ny * (w1 - 3));
      g.stroke();
    };
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,228,196,.55)'; g.lineWidth = 2.5; rim(shoulder, elbow, 30, 21, 1.45); rim(elbow, hand, 21, 14, 1.2);
    g.strokeStyle = 'rgba(110,60,36,.35)'; g.lineWidth = 2;
    const mid = { x: (shoulder.x + elbow.x) / 2, y: (shoulder.y + elbow.y) / 2 };
    g.beginPath(); g.moveTo(mid.x - 18, mid.y + 6); g.quadraticCurveTo(mid.x, mid.y + 12, mid.x + 22, mid.y + 4); g.stroke();
    g.fillStyle = '#ff653b';
    g.translate(hand.x - Math.cos(wrist) * 26, hand.y - Math.sin(wrist) * 26); g.rotate(wrist);
    roundRect(g, -8, -16, 16, 32, 5); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(-1.5, -16, 3, 32);
    g.restore();
  }
  function drawFist(g) {
    const { hand, wrist } = armPose();
    g.save();
    g.translate(hand.x, hand.y); g.rotate(wrist);
    const fist = g.createRadialGradient(-2, -8, 2, 0, 0, 22);
    fist.addColorStop(0, '#f2c29c'); fist.addColorStop(1, '#a4664a');
    g.fillStyle = fist; roundRect(g, -13, -15, 28, 29, 11); g.fill();
    g.strokeStyle = 'rgba(90,45,25,.55)'; g.lineWidth = 1.4;
    for (const y of [-6, 1, 8]) { g.beginPath(); g.moveTo(8, y); g.lineTo(15, y + 1); g.stroke(); }
    g.fillStyle = '#e8b48f'; roundRect(g, -8, -17, 17, 9, 4); g.fill();
    g.restore();
  }

  function drawAim(g, t) {
    const launch = launchFromPull(pull.x, pull.y);
    if (launch.power < 0.05) {
      if (drag) return;
      const pulse = (Math.sin(t * 4) + 1) / 2;
      g.save();
      g.globalAlpha = 0.45 + pulse * 0.45;
      g.strokeStyle = '#baf7cb'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(anchor.x, anchor.y, 24 + pulse * 6, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = '#baf7cb'; g.font = `900 ${Math.round(14 * ui)}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.lineWidth = 4; g.strokeStyle = 'rgba(4,12,14,.8)';
      g.strokeText('ЗАЖМИ И ТЯНИ НАЗАД', anchor.x + 36, anchor.y - 30); g.fillText('ЗАЖМИ И ТЯНИ НАЗАД', anchor.x + 36, anchor.y - 30);
      g.restore();
      return;
    }
    g.save();
    // The hint follows the towel's centre of mass with drag and the current wind, not a bare parabola.
    const limit = HINT_TIME[level];
    for (const { x, y, t: s } of predictFlight(sim.launchState(launch.x, launch.y), sim.windNow, limit)) {
      if (s < 0.05) continue;
      g.globalAlpha = 0.95 * (1 - s / limit);
      g.fillStyle = '#f4efe3';
      g.beginPath(); g.arc(x, y, 4.2 - s * 5, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    const color = launch.power > 0.85 ? '#ff653b' : launch.power > 0.5 ? '#e4b56d' : '#8ddbcc';
    g.translate(anchor.x, anchor.y - 62 - 16 * ui); g.scale(ui, ui);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 20, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = color; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(0, 0, 20, -Math.PI / 2, -Math.PI / 2 + launch.power * Math.PI * 2); g.stroke();
    g.fillStyle = '#f4efe3'; g.font = `900 13px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`${Math.round(launch.power * 100)}`, 0, 0);
    const angle = Math.round(Math.atan2(-launch.y, launch.x) * 180 / Math.PI);
    g.font = `800 11px ${FONT}`; g.fillStyle = 'rgba(244,239,227,.75)'; g.fillText(`${angle}°`, 0, 31);
    g.restore();
  }

  function pill(g, x, y, text, { color = '#f0f1e8', accent = null, align = 'left' } = {}) {
    g.font = `800 13px ${FONT}`;
    const width = g.measureText(text).width + (accent ? 34 : 22);
    const left = align === 'right' ? x - width : x;
    g.fillStyle = 'rgba(6,16,19,.72)'; roundRect(g, left, y, width, 28, 14); g.fill();
    g.strokeStyle = 'rgba(141,219,204,.22)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(text, left + (accent ? 24 : 11), y + 14.5);
    if (accent) accent(left + 13, y + 14);
  }
  function drawHud(g, t) {
    g.save(); g.translate(12, 12); g.scale(ui, ui);
    pill(g, 0, 0, ui > 1.4 ? `${index + 1} / ${throws}` : `БРОСОК ${index + 1} / ${throws} · ${layout.name.toUpperCase()}`, { color: '#f0f1e8', accent: (x, y) => { g.fillStyle = '#e4b56d'; g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2); g.fill(); } });
    g.restore();
    const speed = Math.abs(layout.wind) / 110;
    const direction = layout.wind > 0 ? 1 : -1;
    g.save(); g.translate(W - 12, 12); g.scale(ui, ui);
    pill(g, 0, 0, speed < 0.08 ? 'ШТИЛЬ' : `${ui > 1.4 ? '' : 'ВЕТЕР '}${speed.toFixed(1).replace('.', ',')} М/С`, {
      align: 'right', color: '#c9fff3',
      accent: (x, y) => {
        g.save(); g.translate(x, y); g.scale(direction, 1);
        const wobble = Math.sin(t * 6) * 1.5;
        g.strokeStyle = '#8ddbcc'; g.lineWidth = 2.2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-7, 0); g.lineTo(6 + wobble, 0); g.moveTo(1 + wobble, -4); g.lineTo(6 + wobble, 0); g.lineTo(1 + wobble, 4); g.stroke();
        g.restore();
      },
    });
    g.restore();
  }
  function drawStreaks(g, dt) {
    const strength = clamp(Math.abs(sim.windNow) / 185, 0, 1.2);
    if (strength < 0.05) return;
    g.save(); g.lineCap = 'round';
    for (const s of streaks) {
      s.x += sim.windNow * s.speed * dt * 1.6;
      if (s.x > W + 100) s.x = -100; if (s.x < -100) s.x = W + 100;
      const [x, y] = project(s.x, s.y, s.z);
      const grad = g.createLinearGradient(x, 0, x - Math.sign(sim.windNow) * s.length, 0);
      grad.addColorStop(0, `rgba(220,245,240,${0.2 * strength})`); grad.addColorStop(1, 'rgba(220,245,240,0)');
      g.strokeStyle = grad; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.sign(sim.windNow) * s.length, y + Math.sin(s.x * 0.02) * 2); g.stroke();
    }
    g.restore();
  }
  function drawBanner(g, t) {
    if (!banner) return;
    const age = t - banner.at, pop = age < 0.18 ? 0.6 + age / 0.18 * 0.55 : age < 0.3 ? 1.15 - (age - 0.18) / 0.12 * 0.15 : 1;
    const alpha = clamp((banner.until - t) / 0.25, 0, 1);
    g.save(); g.globalAlpha = alpha;
    g.translate(W / 2, 176); g.scale(pop, pop);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${banner.big ? 64 : 58}px ${FONT}`;
    g.lineWidth = 9; g.strokeStyle = 'rgba(4,12,14,.85)'; g.lineJoin = 'round';
    g.strokeText(banner.title, 0, 0);
    g.fillStyle = banner.color; g.shadowColor = banner.color; g.shadowBlur = 18; g.fillText(banner.title, 0, 0);
    g.shadowBlur = 0;
    g.font = `700 ${Math.round(18 * Math.min(ui, 1.6))}px ${FONT}`; g.lineWidth = 5; g.strokeText(banner.line, 0, 46); g.fillStyle = '#f0f1e8'; g.fillText(banner.line, 0, 46);
    g.restore();
  }

  // --- Particles ----------------------------------------------------------
  function puff(x, y, z, count, color = '200,210,205') {
    const [sx, sy] = project(x, y, z);
    for (let i = 0; i < count; i++) particles.push({ type: 'dust', x: sx, y: sy, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 40, r: 4 + Math.random() * 6, grow: 26 + Math.random() * 20, life: 0, max: 0.55 + Math.random() * 0.4, color });
  }
  function confetti(x, y) {
    const colors = ['#ff653b', '#e4b56d', '#8ddbcc', '#f4efe3', '#baf7cb'];
    const count = reducedMotion ? 14 : 46;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9, speed = 260 + Math.random() * 380;
      particles.push({ type: 'confetti', x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18, w: 5 + Math.random() * 5, h: 3 + Math.random() * 3, color: colors[i % colors.length], life: 0, max: 1.3 + Math.random() * 0.6 });
    }
  }
  function floatText(x, y, text, color) { particles.push({ type: 'text', x, y, vy: -60, text, color, life: 0, max: 1.3 }); }
  function drawParticles(g, dt) {
    particles = particles.filter(p => (p.life += dt) < p.max);
    for (const p of particles) {
      const k = p.life / p.max;
      if (p.type === 'dust') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94;
        const r = p.r + p.grow * k;
        const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        grad.addColorStop(0, `rgba(${p.color},${0.28 * (1 - k)})`); grad.addColorStop(1, `rgba(${p.color},0)`);
        g.fillStyle = grad; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
      } else if (p.type === 'confetti') {
        p.vy += 900 * dt; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.cos(p.rot * 1.7));
        g.globalAlpha = clamp((1 - k) * 2, 0, 1); g.fillStyle = p.color; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      } else {
        p.y += p.vy * dt;
        g.save(); g.globalAlpha = clamp((1 - k) * 2, 0, 1);
        g.font = `900 24px ${FONT}`; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(4,12,14,.8)';
        g.strokeText(p.text, p.x, p.y); g.fillStyle = p.color; g.fillText(p.text, p.x, p.y);
        g.restore();
      }
    }
  }

  // --- Flow ---------------------------------------------------------------
  function startThrow(next) {
    index = next;
    layout = layouts[index];
    sim = createTowelSim(layout);
    phase = 'aim'; pull = { x: 0, y: 0 }; drag = null; slowUsed = false; banner = null;
    arm.x = anchor.x; arm.y = anchor.y; arm.follow = 0;
    rebuild();
    onThrow(index, layout);
  }
  function release() {
    if (phase !== 'aim' || !active) return false;
    if (launchFromPull(pull.x, pull.y).power < 0.12) { pull = { x: 0, y: 0 }; return false; }
    const launch = launchFromPull(pull.x, pull.y), hand = handFromPull(pull.x, pull.y);
    sim.setHand(hand.x, hand.y);
    sim.release(launch.x, launch.y, 3 + launch.power * 4);
    arm.follow = 1;
    drag = null; phase = 'flight';
    sound('tap');
    return true;
  }
  function resolve(result) {
    phase = 'result';
    if (result.hit) hits++;
    const text = outcomeText(result);
    const b = layout.basket, [bx, by] = project(b.x, b.rim, b.z);
    banner = { ...text, at: now / 1000, until: now / 1000 + 1.55, color: result.hit ? (result.clean ? '#e4b56d' : '#baf7cb') : result.kind === 'rim' ? '#f8db99' : '#ffb59a', big: result.clean };
    if (result.hit) {
      confetti(bx, by - 6);
      floatText(bx, by - 40, `+${perHit} ₽`, '#e4b56d');
      shake = reducedMotion ? 0 : 7;
      sound('perfect');
    } else sound('error');
    onShot(result, index, text);
    pendingNext = now + 1650;
  }
  function world(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
  }
  function setPull(x, y) {
    let px = clamp(x, -WORLD.maxPull, 24), py = clamp(y, -80, WORLD.maxPull);
    const length = Math.hypot(px, py);
    if (length > WORLD.maxPull) { px *= WORLD.maxPull / length; py *= WORLD.maxPull / length; }
    pull = { x: px, y: py };
  }
  const onDown = event => {
    if (phase !== 'aim' || !active) return;
    event.preventDefault();
    try { canvas.setPointerCapture(event.pointerId); } catch {}
    const p = world(event);
    drag = { x: p.x - pull.x, y: p.y - pull.y, id: event.pointerId };
  };
  const onMove = event => {
    if (!drag || drag.id !== event.pointerId) return;
    const p = world(event);
    setPull(p.x - drag.x, p.y - drag.y);
  };
  const onUp = event => {
    if (!drag || drag.id !== event.pointerId) return;
    try { canvas.releasePointerCapture(event.pointerId); } catch {}
    drag = null;
    release();
  };
  const onCancel = () => { drag = null; };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(canvas);

  function handleImpacts() {
    for (const hit of sim.impacts) {
      if (hit.kind === 'floor') puff(hit.x, WORLD.floor, hit.z, 7);
      else if (hit.kind === 'rim' || hit.kind === 'wall') puff(hit.x, hit.y, hit.z, 3, '214,170,110');
      else if (hit.kind === 'bag') { shake = reducedMotion ? 0 : 5; puff(hit.x, hit.y, hit.z, 4, '220,120,100'); }
      else puff(hit.x, hit.y, hit.z, 4);
      if (now - lastSound > 120) { sound('hit'); lastSound = now; }
    }
    sim.impacts.length = 0;
  }
  function slowMotion() {
    if (reducedMotion || slowUsed || phase !== 'flight') return;
    const b = layout.basket;
    let cx = 0, cy = 0, vy = 0;
    for (let p = 0; p < sim.count; p++) { cx += sim.pos[p * 3]; cy += sim.pos[p * 3 + 1]; vy += sim.pos[p * 3 + 1] - sim.prev[p * 3 + 1]; }
    cx /= sim.count; cy /= sim.count;
    if (vy > 0 && Math.abs(cx - b.x) < b.radius * 1.3 && cy > b.rim - 90 && cy < b.rim + 10) { slowUsed = true; slowUntil = now + 520; }
  }

  function frame(time) {
    if (!active) return;
    const dt = Math.min(0.05, (time - last) / 1000); last = time; now = time;
    const t = time / 1000;
    const timeScale = now < slowUntil ? 0.38 : 1;
    if (phase === 'aim') {
      const hand = handFromPull(pull.x, pull.y);
      sim.setHand(hand.x, hand.y);
      arm.x = hand.x; arm.y = hand.y;
    } else {
      const target = arm.follow > 0 ? { x: anchor.x + 70, y: anchor.y - 60 } : anchor;
      arm.follow = Math.max(0, arm.follow - dt * 4);
      arm.x += (target.x - arm.x) * Math.min(1, dt * 12); arm.y += (target.y - arm.y) * Math.min(1, dt * 12);
    }
    accumulator += dt * timeScale;
    const steps = Math.floor(accumulator * 240);
    if (steps) { sim.advance(steps / 240); accumulator -= steps / 240; }
    handleImpacts();
    slowMotion();
    if (phase === 'flight' && sim.phase === 'done') resolve(sim.result);
    if (phase === 'result' && now >= pendingNext) {
      if (index + 1 < throws) { fadeTarget = 1; phase = 'fade'; }
      else {
        phase = 'done';
        banner = { title: `${hits} ИЗ ${throws}`, line: `${hits === throws ? 'Идеальная смена!' : hits ? 'Смена закрыта.' : 'Ни одного попадания.'} К выплате ${payFor(hits)} ₽`, at: t, until: t + 1.6, color: hits ? '#e4b56d' : '#ffb59a', big: true };
        pendingNext = now + 1500;
        if (hits === throws) confetti(W / 2, 220);
      }
    }
    if (phase === 'fade') {
      fade = Math.min(1, fade + dt * 5);
      if (fade >= 1) { startThrow(index + 1); fadeTarget = 0; }
    } else if (fade > 0 && fadeTarget === 0) fade = Math.max(0, fade - dt * 4);
    if (phase === 'done' && now >= pendingNext) { active = false; onDone(hits); return; }

    // Draw.
    shake *= Math.pow(0.02, dt);
    const sx = shake > 0.2 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0.2 ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, sx * scale, sy * scale);
    ctx.drawImage(bg, 0, 0, W, H);
    if (Math.random() < 0.006) flicker = 0.14;
    if (flicker > 0) { ctx.fillStyle = `rgba(8,18,21,${flicker > 0.07 ? 0.75 : 0.35})`; ctx.fillRect(360, 40, 220, 90); flicker -= dt; }
    drawClock(ctx);
    drawFan(ctx, t);
    drawShadow(ctx);
    if (layout.bag) drawBag(ctx);
    drawArm(ctx);
    const faces = towelFaces();
    drawFaces(ctx, faces.back);
    ctx.drawImage(fg, 0, 0, W, H);
    drawFaces(ctx, faces.front);
    drawFist(ctx);
    drawStreaks(ctx, dt);
    if (phase === 'aim') drawAim(ctx, t);
    drawParticles(ctx, dt);
    if (now < slowUntil) { ctx.fillStyle = 'rgba(141,219,204,.06)'; ctx.fillRect(0, 0, W, H); }
    ctx.drawImage(vignette, 0, 0, W, H);
    drawHud(ctx, t);
    drawBanner(ctx, t);
    if (fade > 0) { ctx.fillStyle = `rgba(6,14,16,${fade})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
    raf = requestAnimationFrame(frame);
  }

  resize();
  startThrow(0);
  raf = requestAnimationFrame(frame);
  return {
    aim(dx, dy) {
      if (phase !== 'aim') return;
      const base = launchFromPull(pull.x, pull.y).power < 0.05 ? { x: -70, y: 62 } : pull;
      setPull(base.x + dx, base.y + dy);
    },
    release() {
      if (phase === 'aim' && launchFromPull(pull.x, pull.y).power < 0.12) setPull(-70, 62);
      return release();
    },
    get ready() { return phase === 'aim'; },
    destroy() {
      active = false;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
    },
  };
}
