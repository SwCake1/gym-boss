/** Gym Boss game rules. Pure actions: input state and battle are never mutated. */
export const GYMS = Object.freeze([
  { id: 'basement', name: 'Подвал', subtitle: 'Сырость. Ржавчина. Характер.', description: 'Здесь блины старше тренера, а абонемент оплачивается уважением.', color: '#beff4f' },
  { id: 'yard', name: 'Железный двор', subtitle: 'Район смотрит на тебя.', description: 'Турники знают всё. Три местных легенды проверят, чего стоит твой памп.', color: '#5ddcff' },
  { id: 'temple', name: 'Храм пампа', subtitle: 'Святые мощи — твои плечи.', description: 'Вместо благовоний — магнезия. Вместо проповедей — ещё один подход.', color: '#ba8cff' },
  { id: 'olympus', name: 'Олимп', subtitle: 'Вершина пищевой пирамиды.', description: 'Здесь даже гантели ходят с охраной. Осталось стать тем самым боссом.', color: '#ffbd59' },
]);

export const RIVALS = Object.freeze([
  { id: 'rival-01', name: 'Толик Пустой Гриф', title: 'Смотрящий за ковриком', quote: 'Я пока только разминаюсь. Уже восемь лет.', winQuote: 'Ладно. Коврик теперь твой.', power: 9, gym: 0, portrait: 0, reward: 60, timingPeriod: 610, timingBaseWindow: 0.073 },
  { id: 'rival-02', name: 'Боря Полблина', title: 'Мастер маленьких весов', quote: 'Маленький вес? Это огромный блин в перспективе.', winQuote: 'Чёрт. Придётся докинуть ещё полблина.', power: 12, gym: 0, portrait: 1, reward: 75, timingPeriod: 660, timingBaseWindow: 0.066 },
  { id: 'rival-03', name: 'Дядя Гена', title: 'Хозяин подвала', quote: 'При мне этот подвал ещё был котлованом.', winQuote: 'Ключи оставь вахтёру. Ты вырос из подвала.', power: 16, gym: 0, portrait: 2, reward: 100, timingPeriod: 480, timingBaseWindow: 0.090 },
  { id: 'rival-04', name: 'Турникмен', title: 'Гроза детской площадки', quote: 'Земля — для тех, кто не умеет подтягиваться.', winQuote: 'Ну всё, сегодня домой пешком. По земле.', power: 20, gym: 1, portrait: 3, reward: 110, timingPeriod: 530, timingBaseWindow: 0.078 },
  { id: 'rival-05', name: 'Вадик Безног', title: 'Пропустил день ног', quote: 'Ноги? Брат, я на них в зал пришёл. Уже тренировка.', winQuote: 'Ладно. В понедельник — ноги. Точно.', power: 25, gym: 1, portrait: 4, reward: 130, timingPeriod: 650, timingBaseWindow: 0.064 },
  { id: 'rival-06', name: 'Батя Района', title: 'Последний аргумент двора', quote: 'Поясница ноет, район уважает. Баланс.', winQuote: 'Мужик. За двор теперь спокоен.', power: 31, gym: 1, portrait: 5, reward: 160, timingPeriod: 720, timingBaseWindow: 0.055 },
  { id: 'rival-07', name: 'Брат Магнезий', title: 'Послушник железа', quote: 'Да пребудет с тобой страховка.', winQuote: 'Брат, твой подход услышан.', power: 38, gym: 2, portrait: 6, reward: 180, timingPeriod: 510, timingBaseWindow: 0.084 },
  { id: 'rival-08', name: 'Памп Палыч', title: 'Проповедник объёма', quote: 'Рукав не порвался? Значит, не молился.', winQuote: 'Вот это, мать его, проповедь.', power: 45, gym: 2, portrait: 7, reward: 210, timingPeriod: 610, timingBaseWindow: 0.065 },
  { id: 'rival-09', name: 'Архижим', title: 'Верховный хранитель блинов', quote: 'Во имя жима, тяги и святого приседа.', winQuote: 'Храм признаёт тебя. Полотенце сдай.', power: 53, gym: 2, portrait: 8, reward: 250, timingPeriod: 500, timingBaseWindow: 0.076 },
  { id: 'rival-10', name: 'Атлант На Массе', title: 'Держит небо на трапециях', quote: 'Небо лёгкое. Просто повторений много.', winQuote: 'Подержи секунду небо. Я попью.', power: 61, gym: 3, portrait: 9, reward: 300, timingPeriod: 620, timingBaseWindow: 0.064 },
  { id: 'rival-11', name: 'Зевс Протеинович', title: 'Гром среди ясного жима', quote: 'Это не молния. Это предтрен пошёл.', winQuote: 'Даже гром сегодня жмёт тише.', power: 71, gym: 3, portrait: 10, reward: 350, timingPeriod: 470, timingBaseWindow: 0.086 },
  { id: 'rival-12', name: 'ГИГАБАТЯ', title: 'Финальный босс качалки', quote: 'Я не занимаю тренажёр. Я и есть тренажёр.', winQuote: 'Теперь ты — босс. Только за собой блины убери.', power: 84, gym: 3, portrait: 11, reward: 500, timingPeriod: 570, timingBaseWindow: 0.061 },
]);

export const SHOP = Object.freeze([
  { id: 'shawarma', name: 'Шаурма чемпиона', description: 'Курица, соус и немного веры в лучшее.', cost: 35, type: 'food', effect: '+30 энергии' },
  { id: 'cookies', name: 'Печеньки с молочком', description: 'Домашний уют в раздевалке. Только кружку не оставляй.', cost: 55, type: 'food', effect: '+50 энергии' },
  { id: 'protein', name: 'Протеин «Батин»', description: 'Вкус печенья. Послевкусие победы.', cost: 90, type: 'boost', effect: '+2 к основному навыку на 3 тренировки' },
  { id: 'serum', name: 'Жидкий кураж', description: 'Концентрат силы. После боя захочется прилечь.', cost: 120, type: 'boost', effect: '+10 силы на 1 бой, −15 энергии при выходе на ковёр' },
  { id: 'trenbolone', name: 'Тренболон «Кольнуть в очко»', description: 'Суровая этикетка для совершенно абсурдного сюжетного буста.', cost: 250, type: 'boost', effect: '+20 силы на 1 бой, −25 энергии при выходе на ковёр' },
  { id: 'wraps', name: 'Бинты авторитета', description: 'Теперь запястья выглядят так, будто у них есть связи.', cost: 140, type: 'gear', effect: '+5 техники навсегда' },
  { id: 'shoes', name: 'Кеды «Неубиваемые»', description: 'Пережили физру, стройку и двух тренеров.', cost: 220, type: 'gear', effect: '+7 выносливости навсегда' },
  { id: 'belt', name: 'Пояс «Батя одобрил»', description: 'Держит спину и самооценку.', cost: 340, type: 'gear', effect: '+9 силы навсегда' },
]);

const STATS = ['strength', 'technique', 'endurance'];
export const RANDOM_EVENTS = [
  { id: 'E01', text: 'Огромный качок подстраховал твой жим: «Давай, ещё один!»', stat: 'strength', amount: 8 },
  { id: 'E02', text: 'Мужик у стойки заметил кривой хват и показал, как держать гриф.', stat: 'technique', amount: 7 },
  { id: 'E03', text: 'В раздевалке включили гачи-ремикс, и кардио внезапно стало танцем.', stat: 'endurance', amount: 9 },
  { id: 'E04', text: 'Свет в зале погас посреди подхода. Доделал его на ощупь и неожиданно поймал правильную технику.', stat: 'technique', amount: 5 },
  { id: 'E05', text: 'Тренер назвал твой рабочий вес «разминочным». Ты из принципа добавил блинов и потянул мышцу.', stat: 'strength', amount: -10 },
  { id: 'E06', text: 'Консьержка сказала: «Какой бодрый молодой человек!»', stat: 'endurance', amount: 3 },
  { id: 'E07', text: 'Дрищ хотел подробно рассказать о своём курсе на массу. Ты убегал от него три круга вокруг зала.', stat: 'endurance', amount: 6 },
  { id: 'E08', text: 'Дрищ попросил показать присед. Пока объяснял, сам освоил движение.', stat: 'technique', amount: 6 },
  { id: 'E09', text: 'Нашёл в сумке забытую шаурму чемпиона. Она ещё тёплая. Вопросов нет.', stat: 'energy', amount: 30 },
  { id: 'E10', text: 'Тренер сказал «ещё одно повторение», и ты случайно установил личный рекорд.', stat: 'strength', amount: 7 },
  { id: 'E11', text: 'Зеркало в качалке одобрительно кивнуло. Возможно, это был сквозняк.', stat: 'endurance', amount: 4 },
  { id: 'E12', text: 'Парень с магнезией назвал тебя «братом по железу» и показал правильную тягу.', stat: 'technique', amount: 8 },
  { id: 'E13', text: 'Кто-то повесил плакат «ASS WE CAN». Мотивация сработала.', stat: 'endurance', amount: 5 },
  { id: 'E14', text: 'В буфете перепутали заказы и выдали тебе двойной обед качка.', stat: 'energy', amount: 40 },
  { id: 'E15', text: 'Помог качку спустить диван с пятого этажа. Качок держал дверь.', stat: 'strength', amount: 9 },
  { id: 'E16', text: 'Скамья для отдыха оказалась массажной. Ты понял это только через полчаса.', stat: 'energy', amount: 25 },
  { id: 'E17', text: 'Дрищ уронил тебе на ногу блин, а потом спросил: «Подход закончил?»', stat: 'strength', amount: -5 },
  { id: 'E18', text: 'Сосед по раздевалке кашлянул прямо в твою бутылку.', stat: 'endurance', amount: -6 },
  { id: 'E19', text: 'Бургер из «Вкус очка» победил тебя техническим нокаутом.', stat: 'energy', amount: 0, setToZero: true },
  { id: 'E20', text: 'Перепутал магнезию с сахарной пудрой. Хват был запоминающимся.', stat: 'technique', amount: -7 },
  { id: 'E21', text: 'На гачи-ремиксе пропустили бит — и ты пропустил идеальный момент для жима.', stat: 'technique', amount: -3 },
  { id: 'E22', text: 'В сауне тебя задержали долгой лекцией о жиме. Вышел как варёная сосиска.', stat: 'endurance', amount: -9 },
  { id: 'E23', text: 'Выпил «протеин» из пакета без этикетки. Просрался знатно.', stat: 'strength', amount: -6 },
  { id: 'E24', text: 'Решил эффектно выйти из раздевалки под гачи-ремикс, но поскользнулся на сланце.', stat: 'endurance', amount: -8 },
  { id: 'E25', text: 'Подписался на челлендж «один подход до отказа». Отказ пришёл раньше конца подхода.', stat: 'energy', amount: -35 },
  { id: 'E26', text: 'Учил новичка правильному жиму. Он снял видео, и на нём выяснилось, что сам ты делаешь всё наоборот.', stat: 'technique', amount: -10 },
  { id: 'E27', text: 'Наступил на рассыпанную магнезию и исполнил шпагат без подготовки.', stat: 'endurance', amount: -10 },
  { id: 'E28', text: 'Тренер объявил «пять минут растяжки». Через час тебя развязывали с коврика.', stat: 'energy', amount: -30 },
  { id: 'E29', text: 'На подработке изображал качка для рекламы спортпита. Позу «двойной бицепс» пришлось держать весь день.', stat: 'energy', amount: -25 },
  { id: 'E30', text: 'Сосед попросил засечь минуту планки, но забыл включить секундомер. Ты узнал об этом через двадцать минут.', stat: 'energy', amount: -20 },
];
const EVENT_IDS = new Set(RANDOM_EVENTS.map(event => event.id));
const LABELS = { strength: 'сила', technique: 'техника', endurance: 'выносливость' };
const GEAR_GAINS = { wraps: { technique: 5 }, shoes: { endurance: 7 }, belt: { strength: 9 } };
const ACHIEVEMENTS = ['first-workout', 'first-win', 'first-gear', 'gym-two', 'legend'];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback, min, max, integer = true) => {
  const result = typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
  return integer ? Math.floor(result) : result;
};

export function createState() {
  return {
    version: 1, name: 'Дрищ', gym: 0, wins: 0, strength: 8, technique: 6, endurance: 8,
    energy: 100, money: 60, respect: 0, workouts: 0, totalWork: 0, equipment: [],
    buff: null, log: [], achievements: [], eventCountdown: null, seenEvents: [], startedAt: Date.now(), playSeconds: 0, won: false,
  };
}

function award(state) {
  const earned = new Set(state.achievements);
  if (state.workouts > 0) earned.add('first-workout');
  if (state.wins > 0) earned.add('first-win');
  if (state.equipment.length) earned.add('first-gear');
  if (state.gym >= 1) earned.add('gym-two');
  if (state.won) earned.add('legend');
  return { ...state, achievements: ACHIEVEMENTS.filter(id => earned.has(id)) };
}

export function sanitizeState(input) {
  const clean = createState();
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1) return clean;
  if (typeof input.name === 'string') clean.name = input.name.replace(/[<>\x00-\x1f\x7f]/g, '').trim().slice(0, 24) || 'Дрищ';
  clean.wins = finite(input.wins, 0, 0, 12);
  clean.gym = Math.min(3, Math.floor(clean.wins / 3));
  clean.won = clean.wins === 12;
  for (const key of STATS) clean[key] = finite(input[key], clean[key], 1, 500);
  for (const key of ['money', 'respect', 'workouts', 'totalWork']) clean[key] = finite(input[key], clean[key], 0, 10000000);
  clean.energy = finite(input.energy, 100, 0, 100);
  clean.playSeconds = finite(input.playSeconds, 0, 0, 100000000);
  clean.startedAt = finite(input.startedAt, clean.startedAt, 1, 8640000000000000);
  clean.equipment = [...new Set(Array.isArray(input.equipment) ? input.equipment.filter(id => Object.hasOwn(GEAR_GAINS, id)) : [])];
  if (input.buff && typeof input.buff === 'object' && ['protein', 'serum', 'trenbolone'].includes(input.buff.id)) {
    const charges = finite(input.buff.charges, 0, 0, input.buff.id === 'protein' ? 3 : 1);
    if (charges > 0) clean.buff = { id: input.buff.id, charges };
  }
  clean.log = Array.isArray(input.log) ? input.log.filter(item => typeof item === 'string').slice(-16).map(item => item.slice(0, 240)) : [];
  clean.seenEvents = [...new Set(Array.isArray(input.seenEvents) ? input.seenEvents.filter(id => EVENT_IDS.has(id)) : [])];
  clean.eventCountdown = clean.seenEvents.length === RANDOM_EVENTS.length || typeof input.eventCountdown !== 'number' ? null : finite(input.eventCountdown, null, 1, 30);
  // Achievements are derived from actual progress, rather than trusted save flags.
  return award(clean);
}

export function power(state) {
  const core = (state.strength * 0.46 + state.technique * 0.32 + state.endurance * 0.22) * 0.62 + 4.5;
  return Math.max(1, Math.round(core + (state.buff?.id === 'serum' ? 10 : state.buff?.id === 'trenbolone' ? 20 : 0)));
}

export function nextRival(state) {
  return RIVALS[state.wins] ?? null;
}

function commit(state, message) {
  return award({ ...state, log: [...state.log, message].slice(-16) });
}

const randomIndex = (length, random) => Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
const nextEventInterval = random => 10 + randomIndex(21, random);

// Called once after a successful training, rest, or work action.
export function advanceRandomEvent(state, random = Math.random) {
  if (state.seenEvents.length === RANDOM_EVENTS.length) return { state, event: null };
  const countdown = (state.eventCountdown ?? nextEventInterval(random)) - 1;
  if (countdown > 0) return { state: { ...state, eventCountdown: countdown }, event: null };
  const seen = new Set(state.seenEvents);
  const remaining = RANDOM_EVENTS.filter(event => !seen.has(event.id));
  const event = remaining[randomIndex(remaining.length, random)];
  const before = state[event.stat];
  const after = event.setToZero ? 0 : clamp(before + event.amount, event.stat === 'energy' ? 0 : 1, event.stat === 'energy' ? 100 : 500);
  const next = { ...state, [event.stat]: after, seenEvents: [...state.seenEvents, event.id], eventCountdown: remaining.length === 1 ? null : nextEventInterval(random) };
  return { state: commit(next, event.text), event, change: after - before };
}

const failure = (state, error) => ({ state, error });

export function trainingDifficulty(gym, workouts = 0) {
  const level = Math.min(3, Math.max(0, Math.trunc(gym) || 0));
  const practice = Math.max(0, Math.trunc(workouts) || 0);
  return {
    liftSpeed: 72 + level * 12,
    liftZone: 20 - level * 4,
    gripLimit: Math.max(1200, 2200 - level * 250 - Math.min(120, practice * 1.5)),
    cardioLow: 54 + level * 2,
    cardioHigh: 78 - level * 2,
    cardioDecay: 7.5 + level * 3.5,
  };
}

export function liftQuality(charge, zoneWidth) {
  if (charge >= 98) return 0;
  const distance = Math.abs(charge - 75);
  const halfZone = zoneWidth / 2;
  return distance <= halfZone
    ? 0.85 + 0.15 * (1 - distance / halfZone)
    : Math.max(0, 0.85 - (distance - halfZone) / 24);
}

export function train(state, kind, quality = 0.5) {
  if (!STATS.includes(kind)) return failure(state, 'Такого упражнения пока не придумали.');
  if (state.energy < 18) return failure(state, 'Нужно 18 энергии. Переведи дух или перекуси.');
  const safeQuality = finite(quality, 0.5, 0, 1, false);
  const protein = state.buff?.id === 'protein';
  const gains = { strength: 0, technique: 0, endurance: 0 };
  gains[kind] = Math.round(safeQuality * 6) + (protein ? 2 : 0);
  const next = { ...state, energy: state.energy - 18, workouts: state.workouts + 1, respect: state.respect + 1 };
  for (const key of STATS) {
    next[key] = Math.min(500, state[key] + gains[key]);
    gains[key] = next[key] - state[key];
  }
  if (protein) next.buff = state.buff.charges > 1 ? { ...state.buff, charges: state.buff.charges - 1 } : null;
  const message = `${safeQuality >= 0.85 ? 'Чистый памп!' : safeQuality >= 0.45 ? 'Крепкий подход.' : 'Главное — пришёл.'} ${LABELS[kind]} +${gains[kind]}${protein ? '. Батин протеин сработал' : ''}.`;
  return { state: commit(next, message), message, gains };
}

export function rest(state) {
  if (state.energy >= 100) return failure(state, 'Ты уже бодр как батя перед шашлыками.');
  const restored = Math.min(40, 100 - state.energy);
  const message = `Пожмякал антистресс и перевёл дух. +${restored} энергии.`;
  return { state: commit({ ...state, energy: state.energy + restored }, message), message, restored };
}

// Towel toss pay: a small fixed minimum, the rest only for towels in the basket.
export const WORK_THROWS = 3;
export function workPayout(gym = 0) {
  const level = finite(gym, 0, 0, GYMS.length - 1);
  const base = 10, perHit = 8 + level * 5;
  return { base, perHit, max: base + perHit * WORK_THROWS };
}

export function work(state, hits = 0) {
  if (state.energy < 12) return failure(state, 'Для подработки нужно 12 энергии. Сначала отдохни.');
  const scored = finite(hits, 0, 0, WORK_THROWS);
  const { base, perHit } = workPayout(state.gym);
  const earned = base + scored * perHit;
  const message = `Полотенец в корзине: ${scored} из ${WORK_THROWS}. Заработал ${earned} ₽${scored ? ` (${base} ₽ за смену + ${scored} × ${perHit} ₽)` : ' — только минимальная ставка'}.`;
  return { state: commit({ ...state, money: state.money + earned, energy: state.energy - 12, totalWork: state.totalWork + 1 }, message), message, earned, hits: scored };
}

export function buy(state, itemId) {
  const item = SHOP.find(entry => entry.id === itemId);
  if (!item) return failure(state, 'Товар исчез. Видимо, его съел тренер.');
  if (item.type === 'gear' && state.equipment.includes(item.id)) return failure(state, 'Эта экипировка уже твоя.');
  if (item.type === 'boost' && state.buff) return failure(state, 'Сначала используй текущий усилитель.');
  if (item.type === 'food' && state.energy >= 100) return failure(state, 'Энергии уже полный бак. Прибереги перекус.');
  if (state.money < item.cost) return failure(state, `Не хватает ${item.cost - state.money} ₽. Подработка ждёт.`);
  const next = { ...state, money: state.money - item.cost };
  if (item.type === 'food') next.energy = Math.min(100, state.energy + (item.id === 'cookies' ? 50 : 30));
  if (item.id === 'protein') next.buff = { id: 'protein', charges: 3 };
  if (item.id === 'serum') next.buff = { id: 'serum', charges: 1 };
  if (item.id === 'trenbolone') next.buff = { id: 'trenbolone', charges: 1 };
  if (item.type === 'gear') {
    next.equipment = [...state.equipment, item.id];
    for (const [stat, gain] of Object.entries(GEAR_GAINS[item.id])) next[stat] = Math.min(500, state[stat] + gain);
  }
  const message = `${item.name}: ${item.effect}.`;
  return { state: commit(next, message), message, item };
}

// Endurance is the only character stat used to size the stamina reservoir.
// The pool can grow beyond 100; the cost of each attack does not scale with it.
export function fightMaxStamina(state) {
  const endurance = finite(state?.endurance, 8, 1, 500);
  return 70 + endurance * 2;
}

function energyCommitted(state) {
  return Math.min(80, Math.max(0, state.energy - fightBoost(state).energyCost));
}

function fightBoost(state) {
  if (state.buff?.id === 'serum') return { strength: 10, energyCost: 15, name: 'Жидким куражом' };
  if (state.buff?.id === 'trenbolone') return { strength: 20, energyCost: 25, name: 'Тренболоном' };
  return { strength: 0, energyCost: 0, name: '' };
}

export function fightStartingStamina(state) {
  return Math.round(fightMaxStamina(state) * (0.25 + 0.75 * energyCommitted(state) / 80));
}

export function fightTimingWindow(state, battle) {
  const rival = RIVALS.find(entry => entry.id === battle?.rivalId);
  if (!rival) return 0.078;
  const technique = finite(state?.technique, 6, 1, 500);
  // Rival profiles trade speed against width; technique always widens the zone.
  return Math.round(clamp(
    rival.timingBaseWindow + Math.min(0.055, technique * 0.0009),
    0.06, 0.125,
  ) * 1000) / 1000;
}

function attackDamage(strength) {
  return Math.round(clamp(9 + strength * 0.34, 1, 80));
}

// Previous saves contain the old three-move fight shape. Preserve their HP and
// round, but start applying the single-attack rules from the next action.
export function migrateBattle(state, input) {
  if (!input || typeof input !== 'object' || input.finished) return null;
  const rival = RIVALS.find(entry => entry.id === input.rivalId);
  if (!rival || nextRival(state)?.id !== rival.id) return null;
  if (![input.playerHp, input.enemyHp, input.playerStamina, input.round].every(Number.isFinite)) return null;
  if (input.playerHp <= 0 || input.playerHp > 100 || input.enemyHp <= 0 || !Number.isSafeInteger(input.round) || input.round < 0 || !Array.isArray(input.history)) return null;
  const maxStamina = fightMaxStamina(state);
  const newFormat = Number.isFinite(input.enemyMaxHp) && input.enemyMaxHp >= 100;
  const enemyMaxHp = newFormat ? finite(input.enemyMaxHp, 100, 100, 300) : 100;
  if (input.enemyHp > enemyMaxHp || input.playerStamina <= 0 || input.playerStamina > Math.max(100, maxStamina)) return null;
  return {
    rivalId: rival.id,
    playerHp: Math.floor(input.playerHp),
    enemyHp: Math.floor(input.enemyHp),
    enemyMaxHp,
    maxStamina,
    playerStamina: Math.min(maxStamina, Math.floor(input.playerStamina)),
    round: input.round,
    history: input.history.slice(-10),
    finished: false,
    result: null,
    attackStrength: finite(input.attackStrength, state.strength + (input.serum ? 10 : 0), 1, 520),
    serum: !!input.serum,
    serumPaidAtStart: !!input.serumPaidAtStart,
  };
}

export function fightMovePreview(state, battle, move) {
  if (move !== 'attack') return null;
  const current = migrateBattle(state, battle);
  if (!current) return null;
  return {
    staminaCost: Math.min(8, current.playerStamina),
    staminaDelta: -Math.min(8, current.playerStamina),
    minDamage: 0,
    maxDamage: attackDamage(current.attackStrength),
    timingWindow: fightTimingWindow(state, current),
  };
}

export function beginFight(state) {
  const rival = nextRival(state);
  if (!rival) return failure(state, 'Ты уже босс всех качалок. Легенда не обязана доказывать.');
  const boost = fightBoost(state);
  const serum = state.buff?.id === 'serum';
  const required = 20 + boost.energyCost;
  if (state.energy < required) return failure(state, boost.energyCost ? `С «${boost.name}» нужно минимум ${required} энергии. Отдохни перед боем.` : 'Для вызова нужно 20 энергии. Отдохни перед боем.');
  const convertedEnergy = energyCommitted(state);
  const enemyMaxHp = 100 + RIVALS.indexOf(rival) * 14;
  const battle = {
    rivalId: rival.id, playerHp: 100, enemyHp: enemyMaxHp, enemyMaxHp,
    maxStamina: fightMaxStamina(state), playerStamina: fightStartingStamina(state),
    round: 0, history: [], finished: false, result: null,
    attackStrength: state.strength + boost.strength, serum, serumPaidAtStart: serum,
  };
  const message = `${rival.name} принимает вызов. ${convertedEnergy} энергии дают ${battle.playerStamina} запаса сил из ${battle.maxStamina}.`;
  return { state: commit({ ...state, energy: state.energy - convertedEnergy - boost.energyCost, buff: boost.strength ? null : state.buff }, message), battle, message };
}

export function fightTurn(state, battle, move, timing = 0.5) {
  const fail = error => ({ state, battle, error, message: error });
  if (!battle || typeof battle !== 'object') return fail('Сначала вызови соперника.');
  if (battle.finished) return fail('Этот бой уже завершён.');
  if (move !== 'attack') return fail('Теперь на ковре один приём — атаковать.');
  const current = migrateBattle(state, battle);
  if (!current) return fail('Состояние боя повреждено или соперник уже пройден. Начни бой заново.');
  const rival = RIVALS.find(entry => entry.id === current.rivalId);
  const window = fightTimingWindow(state, current);
  const distance = Math.abs(finite(timing, 0.5, 0, 1, false) - 0.5);
  const timingGrade = distance <= window / 3 ? 'perfect' : distance <= window * 2 / 3 ? 'good' : distance <= window ? 'weak' : 'miss';
  const damageMultiplier = { perfect: 1, good: 2 / 3, weak: 1 / 3 }[timingGrade] ?? 0;
  const playerDamage = Math.round(attackDamage(current.attackStrength) * damageMultiplier);
  const enemyHp = Math.max(0, current.enemyHp - playerDamage);
  const enemyBase = 8 + rival.power * 0.14;
  const enemyDamage = enemyHp <= 0 ? 0 : Math.round(enemyBase * (
    timingGrade === 'perfect' ? 0.28 : timingGrade === 'good' || timingGrade === 'weak' ? 0.50 : 0.70
  ));
  const playerHp = Math.max(0, current.playerHp - enemyDamage);
  const staminaCost = timingGrade === 'perfect' ? 8 : timingGrade === 'miss' ? 13 : 10;
  const playerStamina = Math.max(0, current.playerStamina - staminaCost);
  const round = current.round + 1;
  const finished = enemyHp <= 0 || playerHp <= 0 || playerStamina <= 0;
  // A finishing blow wins even if it spends the last of the fighter's stamina.
  const result = !finished ? null : enemyHp <= 0 ? 'win' : 'loss';
  const message = timingGrade === 'miss'
    ? `Мимо зоны: атака не прошла, −${current.playerStamina - playerStamina} сил, получено ${enemyDamage} урона.`
    : `${timingGrade === 'perfect' ? 'В яблочко!' : timingGrade === 'good' ? 'Средняя зона.' : 'Слабая зона.'} Атака нанесла ${playerDamage} урона; получено ${enemyDamage}, запас сил ${playerStamina - current.playerStamina}.`;
  const turnRecord = {
    round, move: 'attack', playerDamage, enemyDamage, playerStamina,
    staminaDelta: playerStamina - current.playerStamina,
    staminaCost: Math.min(staminaCost, current.playerStamina),
    timingGrade, timingWindow: window, damageMultiplier, message,
  };
  const nextBattle = {
    ...current, playerHp, enemyHp, playerStamina, round, finished, result,
    history: [...current.history, turnRecord].slice(-10),
  };
  if (!finished) return { state, battle: nextBattle, message, turn: turnRecord };
  // Battles saved before energy conversion still owe the old deferred serum cost.
  const drain = current.serum && !current.serumPaidAtStart ? 15 : 0;
  if (result === 'win') {
    const wins = state.wins + 1;
    const gym = Math.min(3, Math.floor(wins / 3));
    const respect = 10 + rival.gym * 5;
    const finalMessage = `${rival.name} побеждён! +${rival.reward} ₽, +${respect} уважения.${gym > state.gym ? ` Открыт зал «${GYMS[gym].name}».` : ''}${wins === 12 ? ' Ты — БОСС КАЧАЛКИ.' : ''}`;
    const next = { ...state, wins, gym, won: wins === 12, money: state.money + rival.reward, respect: state.respect + respect, energy: Math.min(100, Math.max(0, state.energy + 10 - drain)) };
    return { state: commit(next, finalMessage), battle: nextBattle, message: finalMessage, reward: rival.reward, turn: turnRecord };
  }
  const finalMessage = playerStamina <= 0 && playerHp > 0
    ? 'Силы закончились. Деньги на месте, характер крепче. Отдохни, потренируйся и возвращайся.'
    : 'Этот раунд за соперником. Деньги на месте, характер крепче. Отдохни, потренируйся и возвращайся.';
  return { state: commit({ ...state, energy: Math.min(100, Math.max(0, state.energy + 5 - drain)) }, finalMessage), battle: nextBattle, message: finalMessage, turn: turnRecord };
}
