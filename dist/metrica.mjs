// Set the counter number in index.html after creating a Yandex Metrica counter.
const counterId = typeof document === 'undefined'
  ? null
  : document.querySelector('meta[name="yandex-metrica-id"]')?.content.trim();

if (/^\d+$/.test(counterId ?? '') && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = Date.now();
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://mc.yandex.ru/metrika/tag.js?id=${counterId}`;
  document.head.append(script);
  window.ym(Number(counterId), 'init', {});
}

export function progressGoals(previousWins, currentWins) {
  const goals = [];
  for (let wins = previousWins + 1; wins <= Math.min(currentWins, 12); wins++) {
    if (wins === 12) {
      goals.push('game_completed');
    } else {
      goals.push(`rival_${String(wins + 1).padStart(2, '0')}_reached`);
      if (wins % 3 === 0) goals.push(`gym_${wins / 3 + 1}_reached`);
    }
  }
  return goals;
}

function reachGoal(goal) {
  if (/^\d+$/.test(counterId ?? '') && typeof window.ym === 'function') {
    window.ym(Number(counterId), 'reachGoal', goal);
  }
}

export function trackNewGame() {
  reachGoal('rival_01_reached');
  reachGoal('gym_1_reached');
}

export function trackProgress(previousWins, currentWins) {
  for (const goal of progressGoals(previousWins, currentWins)) reachGoal(goal);
}
