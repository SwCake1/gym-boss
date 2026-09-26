import {GYMS,RIVALS,SHOP,createState,sanitizeState,power,nextRival,train,rest,work,buy,beginFight,fightTurn,fightTimingWindow,fightMovePreview,fightMaxStamina,fightStartingStamina,migrateBattle} from './engine.mjs';

const $=id=>document.getElementById(id);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SAVE_KEY='gymboss:iron-king:v1';
const stats={strength:'Сила',technique:'Техника',endurance:'Выносливость'};
const statHints={strength:'Определяет урон твоей атаки. Больше силы — сильнее каждый удар.',technique:'Расширяет зелёную зону тайминга в борьбе. С высокой техникой проще попасть точно.',endurance:'Увеличивает максимальный запас сил в борьбе. Он может быть больше 100.'};
const exercises={strength:{name:'Качаться',icon:'↥',call:'КАЧАЙСЯ. НЕ ДУМАЙ.',cue:'Выжимай, когда маркер в зелёной зоне.'},technique:{name:'Школа захвата',icon:'⌁',call:'МЯГКО СТЕЛЕШЬ.',cue:'Лови момент. Техника сильнее понтов.'},endurance:{name:'Кардио',icon:'↟',call:'ДЫШИ. НЕ СДАВАЙСЯ.',cue:'Держи ритм. Лестница завтра тебя вспомнит.'}};
const ranks=[{name:'ПОКА ЕЩЁ<br>ДРИЩ',desc:'Гриф тяжелее твоих аргументов.',headline:'ТВОЙ ПЕРВЫЙ<br><em>ПОДХОД.</em>',quote:'«В этом зале тебя пока зовут “эй”.»'},{name:'УЖЕ<br>НЕ СМЕШНО',desc:'Футболка начала задавать вопросы.',headline:'МАССА ЕСТЬ.<br><em>ВОПРОСЫ?</em>',quote:'«Бро, ты случайно не стал шире двери?»'},{name:'ЖИВАЯ<br>МАШИНА',desc:'Штанга просит тебя о страховке.',headline:'СВЯТОЙ<br><em>ПАМП.</em>',quote:'«Твои трапеции видны из космоса.»'},{name:'БОЛЬШОЙ<br>МАЛЬЧИК',desc:'Сила есть. Осталось забрать трон.',headline:'BOSS OF<br><em>THIS GYM.</em>',quote:'«Ты не занимаешь место. Ты его создаёшь.»'}];
const achievements=[['first-workout','Первый памп','Завершить первую тренировку'],['first-win','Коврик теперь твой','Победить первого соперника'],['first-gear','Приоделся, красавчик','Купить экипировку'],['gym-two','Вырос из подвала','Открыть второй зал'],['legend','BOSS OF THIS GYM','Забрать все 12 побед']];
const coachLines=['Штанга сама себя не поднимет. Хотя тебя, может, и поднимет.','Кто пропускает день ног, тот пропускает жизнь.','Три сотни баксов? У нас пока тридцать пять рублей.','Два подхода назад ты был другим человеком.','Правило зала: блины после себя убери. Эго можешь оставить.','Пот — это слёзы твоей лени. Вытри скамейку.','Ну что, fucking strong или пока just fucking tired?'];
const position=p=>`${p%2===0?'0%':'100%'} ${p<2?'0%':'100%'}`;
const rivalSpriteStyle=p=>`background-image:url('./assets/rivals-${Math.floor(p/4)}.png?v=unique');background-position:${position(p%4)};background-size:200% ${p<2?'208%':p<4?'193%':'200%'}`;
const fightSpriteStyle=p=>`background-image:url('./assets/rivals-${Math.floor(p/4)}.png?v=unique');background-position:${position(p%4)};background-size:200% 200%`;
const rivalPortraitButton=r=>`<button type="button" class="rival-portrait portrait-trigger" data-rival-image="${r.id}" style="${rivalSpriteStyle(r.portrait)}" aria-label="Увеличить фото ${esc(r.name)}"></button>`;
const shopSpriteStyle=id=>{const art={cookies:'shop-cookies.png',trenbolone:'shop-trenbolone.png'}[id];if(art)return `background-image:url('./assets/${art}');background-position:center;background-size:cover`;const p=['shawarma','protein','serum','wraps','shoes','belt'].indexOf(id);return `background-position:${p%3*50}% ${p<3?'0%':'100%'}`;};
const heroStage=s=>s.won?3:Math.min(3,Math.max(s.gym,Math.floor(s.workouts/15)));
const heroPath=s=>`./assets/hero-${heroStage(s)}.png?v=fullbody`;
const statKeys=Object.keys(stats);
const shopById=new Map(SHOP.map(item=>[item.id,item]));
function loadoutNames(character){
  const names=character.equipment.map(id=>shopById.get(id)?.name).filter(Boolean);
  if(character.buff)names.push(`${shopById.get(character.buff.id)?.name} ×${character.buff.charges}`);
  return names;
}
let state=createState(),battle=null,tab='gym',sound=false,audio=null,modalKind=null,cleanup=null,working=false,saveFailed=false,tickFrame=0,roundLock=false,saved=false,recentGains=null,gainsTimer=0;
try{const raw=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(raw?.state){state=sanitizeState(raw.state);saved=true;sound=!!raw.sound;battle=migrateBattle(state,raw.battle);}}catch{saved=false;}

function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({state,battle:battle&&!battle.finished?battle:null,sound}));saveFailed=false;}catch{saveFailed=true;}const el=$('save-status');if(el){el.textContent=saveFailed?'Сохранение недоступно в этом браузере':'Прогресс сохранён в этом браузере';el.classList.toggle('save-warning',saveFailed);}}
function tone(kind='tap'){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')void audio.resume();const freqs=kind==='win'?[220,330,440,660]:kind==='perfect'?[440,660]:kind==='hit'?[85,55]:kind==='error'?[160,120]:[260];freqs.forEach((f,i)=>{const osc=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.085;osc.type=kind==='hit'?'triangle':'sine';osc.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.055,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+.17);osc.connect(g);g.connect(audio.destination);osc.start(t);osc.stop(t+.2);});}catch{sound=false;}}
function toast(message,error=false){const el=document.createElement('div');el.className=`toast${error?' error':''}`;el.textContent=message;$('toasts').append(el);setTimeout(()=>el.remove(),4400);if(error)tone('error');}
function apply(result,{quiet=false}={}){if(result.error){toast(result.error,true);return false;}const oldAchievements=new Set(state.achievements),before=state;state=result.state;const gains=Object.fromEntries([...statKeys,'energy'].map(k=>[k,Math.max(0,state[k]-before[k])]).filter(([,gain])=>gain>0));persist();if(Object.keys(gains).length)gainsPop(gains);else render();if(!quiet&&result.message)toast(result.message);for(const id of state.achievements){if(!oldAchievements.has(id)){const a=achievements.find(x=>x[0]===id);setTimeout(()=>toast(`Достижение: ${a?.[1]??id}`),500);}}return true;}
function gainsPop(gains){
  recentGains=gains;
  render();
  clearTimeout(gainsTimer);
  gainsTimer=setTimeout(()=>{recentGains=null;renderStats();renderEnergy();},6000);
}

function gymMarkup(){return `<div class="training-heading"><h2>ВЫБЕРИ ТРЕНИРОВКУ</h2></div><div class="training-list">${Object.entries(exercises).map(([k,e])=>`<button class="training-card" data-train="${k}" ${state.energy<18?'disabled':''}><span class="exercise-icon" aria-hidden="true">${e.icon}</span><span><strong>${e.name}</strong><small>${{strength:'Сила',technique:'Техника',endurance:'Выносливость'}[k]}</small></span><span class="action-price">18 ⚡</span></button>`).join('')}</div><div class="support-group"><span class="group-title">МЕЖДУ ПОДХОДАМИ</span><div class="utility-actions"><button id="rest-button" ${state.energy===100?'disabled':''}><span aria-hidden="true">☾</span><strong>Отдых</strong><small>+40 энергии · 6 сек.</small></button><button id="work-button" ${state.energy<12?'disabled':''}><span aria-hidden="true">₽</span><strong>Подработка</strong><small>+${35+state.gym*15} ₽ · −12 энергии</small></button></div></div>`;}
function fightMarkup(){
  const rival=nextRival(state);
  if(!rival)return `<div class="fight-panel"><span class="group-title">ФИНАЛ</span><h2>ТРЕНАЖЁРЫ ТЕПЕРЬ СЛУШАЮТСЯ ТЕБЯ.</h2><p class="dialog-copy">Все 12 соперников побеждены. Трон твой.</p><button id="victory-button" class="primary-button">МОЙ ТРИУМФ <span>♛</span></button></div>`;
  const boostCost=state.buff?.id==='serum'?15:state.buff?.id==='trenbolone'?25:0;
  const required=20+boostCost,converted=Math.min(80,Math.max(0,state.energy-boostCost));
  const remaining=state.energy-converted-boostCost;
  const maxStamina=fightMaxStamina(state),startingStamina=fightStartingStamina(state);
  return `<div class="fight-panel"><div class="section-heading"><span class="group-title">СОПЕРНИК ${String(state.wins+1).padStart(2,'0')} / 12</span><span class="fight-stage-label">${state.wins%3===2?'БОСС ЗАЛА':GYMS[state.gym].name.toUpperCase()}</span></div><div class="featured-rival">${rivalPortraitButton(rival)}<div><span class="tiny-label">${esc(rival.title)}</span><h2>${esc(rival.name)}</h2><p>«${esc(rival.quote)}»</p></div></div><div class="fight-readiness"><div><span>ТВОЯ МОЩЬ</span><strong>${power(state)}</strong></div><span class="readiness-vs">VS</span><div><span>ЕГО МОЩЬ</span><strong>${rival.power}</strong></div></div><p class="readiness-hint">Атакуй по таймингу: сила даёт урон, техника расширяет зону, выносливость увеличивает запас сил.</p><p class="fight-energy-preview">${state.energy>=required?`${state.energy} энергии → ${startingStamina} / ${maxStamina} сил на старте · останется ${remaining} энергии${boostCost?` · усилитель стоит ${boostCost} энергии`:''}`:`Для выхода нужно ${required} энергии${boostCost?' с активным усилителем':''}.`}</p><button class="primary-button" id="fight-button" ${state.energy<required?'disabled':''}>ВЫЙТИ НА КОВЁР <span>↗</span></button><div class="fight-footnote"><span>Выносливость повышает максимум сил</span><span>Награда: ${rival.reward} ₽</span></div></div>`;
}
function shopMarkup(){const equipped=loadoutNames(state);const itemMarkup=item=>{const owned=state.equipment.includes(item.id);const disabled=owned||state.money<item.cost||(item.type==='boost'&&state.buff)||(item.type==='food'&&state.energy===100);return `<article class="shop-item"><div class="shop-art" style="${shopSpriteStyle(item.id)}" role="img" aria-label="${esc(item.name)}"></div><div class="shop-details"><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><span class="shop-effect">${esc(item.effect)}</span></div><button class="shop-buy" data-buy="${item.id}" ${disabled?'disabled':''}>${owned?'КУПЛЕНО':item.type==='boost'&&state.buff?'БУСТ АКТИВЕН':`${item.cost} ₽`}</button></article>`;};const groups=[['Перекус',SHOP.filter(item=>item.type==='food')],['Усилители',SHOP.filter(item=>item.type==='boost')],['Экипировка',SHOP.filter(item=>item.type==='gear')]];return `<div class="training-heading"><h2>ЛАВКА</h2></div>${equipped.length?`<p class="loadout">Сейчас на тебе: ${esc(equipped.join(' · '))}</p>`:''}${groups.map(([title,items])=>`<section class="shop-group"><h3 class="shop-group-title">${title}</h3><div class="shop-list">${items.map(itemMarkup).join('')}</div></section>`).join('')}`;}
function roadRivalMarkup(r){
  const i=RIVALS.indexOf(r);
  if(i>state.wins)return `<div class="road-item locked" aria-label="Закрытый соперник ${i+1}"><span class="rival-hidden-mark" aria-hidden="true">?</span><div><h3>Неизвестный соперник</h3><p>Откроется после предыдущей победы</p></div><span class="road-state">ЗАКРЫТО</span></div>`;
  return `<div class="road-item">${rivalPortraitButton(r)}<div><h3>${esc(r.name)}</h3><p>Мощь ${r.power} · ${esc(r.title)}</p></div><span class="road-state">${i<state.wins?'✓':'ТВОЙ ХОД'}</span></div>`;
}
function roadMarkup(){return `<div class="training-heading"><h2>ПУТЬ К ТРОНУ</h2></div><div class="gym-panorama" style="--gym-position:${position(state.gym)}" role="img" aria-label="${esc(GYMS[state.gym].name)}"></div><p class="muted" style="margin:15px 0">${esc(GYMS[state.gym].description)}</p>${GYMS.map((gym,index)=>{const wins=Math.max(0,Math.min(3,state.wins-index*3));return `<details class="road-group" ${index===state.gym?'open':''}><summary><strong>${index+1}. ${esc(gym.name)}</strong><span>${index>state.gym?'Закрыто':`${wins} / 3 победы`}</span></summary>${RIVALS.filter(r=>r.gym===index).map(roadRivalMarkup).join('')}</details>`;}).join('')}`;}
function renderHeader(rank,rival){
  $('chapter-label').textContent=`ГЛАВА ${String(state.gym+1).padStart(2,'0')} / 04`;
  $('gym-name').textContent=state.won?'Твоя империя железа':state.gym===0?'Подвал потных надежд':GYMS[state.gym].name;
  $('money').innerHTML=`${state.money.toLocaleString('ru-RU')} <span>₽</span>`;
  $('respect').innerHTML=`${state.respect} <span>REP</span>`;
  $('player-rank').textContent=state.won?'БОСС КАЧАЛКИ':rank.name.replace('<br>',' ');
  $('rank-description').textContent=state.won?'Ты пришёл. Поднял. Возглавил.':rank.desc;
  $('power-value').textContent=power(state);
  $('power-next').textContent=rival?`/ ${rival.power} у соперника`:'/ ЛЕГЕНДА';
  $('achievement-count').textContent=`${state.achievements.length} / ${achievements.length}`;
}
function renderStats(){
  $('stats').innerHTML=statKeys.map(k=>{
    const gain=recentGains?.[k]||0;
    const before=Math.min(100,Math.max(0,state[k]-gain));
    const after=Math.min(100,state[k]);
    return `<div class="stat ${gain?'gained':''}"><div><span class="stat-name">${stats[k]} <button type="button" class="stat-help" aria-label="${stats[k]}: ${statHints[k]}">?<span class="stat-tooltip" role="tooltip">${statHints[k]}</span></button></span><strong>${state[k]}${gain?` (+${gain})`:''}</strong></div><div class="stat-track"><i style="width:${after}%"></i>${gain&&after>before?`<b class="stat-gain-segment" style="left:${before}%;width:${after-before}%"></b>`:''}</div></div>`;
  }).join('');
}
function renderEnergy(){
  $('energy-value').textContent=`${state.energy} / 100${recentGains?.energy?` (+${recentGains.energy})`:''}`;
  $('energy-value').closest('.energy-box').classList.toggle('gained',!!recentGains?.energy);
  $('energy-bar').style.width=`${state.energy}%`;
  $('energy-bar').style.background=state.energy<20?'var(--orange)':'var(--cyan)';
  $('energy-hint').textContent=state.energy<20?'Без сил? Отдых бесплатный. Батя разрешил.':state.energy<50?'Ещё подход — и пора на скамейку.':'Полон сил. Почти как настоящий качок.';
}
function renderLoadout(){
  const equipped=loadoutNames(state);
  $('equipment').textContent=equipped.length?equipped.join(' · '):'Потёртые шорты. Чистая вера.';
}
function renderHero(stage,rank){
  const hero=$('hero-image');
  if(!hero.src.endsWith(`hero-${stage}.png?v=fullbody`)){
    hero.src=heroPath(state);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)hero.animate([{opacity:.3},{opacity:1}],{duration:700});
  }
  hero.alt=['Худой новичок в качалке','Подтянутый атлет','Огромный мускулистый спортсмен','Гипертрофированный чемпион качалки'][stage];
  $('hero-name').innerHTML=state.won?'ТЫ — БОСС.<br><em>БЕЗ БАЗАРА.</em>':rank.headline;
  $('hero-quote').textContent=rank.quote;
  $('evolution-strip').innerHTML=['ДРИЩ','АТЛЕТ','МАШИНА','БОСС'].map((name,i)=>`${i?'<i></i>':''}<span class="${i<=stage?'active':''}">${name}</span>`).join('');
}
const tabMarkup={gym:gymMarkup,fight:fightMarkup,shop:shopMarkup,road:roadMarkup};
function renderActions(){
  $('action-content').innerHTML=tabMarkup[tab]();
  $('action-content').setAttribute('aria-labelledby',`tab-${tab}`);
  document.querySelectorAll('[data-tab]').forEach(el=>{
    const active=el.dataset.tab===tab;
    el.classList.toggle('active',active);
    el.setAttribute('aria-selected',String(active));
    el.tabIndex=active?0:-1;
  });
}
function renderCampaign(){
  $('campaign-strip').innerHTML=`<div class="campaign-progress"><span>ПУТЬ К ТРОНУ</span><div class="campaign-route"><div class="campaign-track"><i style="width:${state.wins/12*100}%"></i>${GYMS.map((g,i)=>{const mark=(i+1)*3;return `<span class="campaign-stop ${state.wins>=mark?'done':state.wins>=mark-3?'next':''} ${i===state.gym?'current':''}" style="left:${mark/12*100}%" title="${esc(g.name)} · ${mark} побед"><span class="campaign-milestone" aria-hidden="true"></span><span class="campaign-stop-name">${esc(g.name)}</span></span>`;}).join('')}</div></div><strong>${state.wins} / 12 побед</strong></div>`;
}
function renderFooter(){
  $('log-line').innerHTML=`<span>ТРЕНЕР</span> ${esc(state.log.at(-1)||coachLines[0])}`;
  $('sound-toggle').classList.toggle('enabled',sound);
  $('sound-toggle').setAttribute('aria-label',sound?'Выключить звуковые сигналы':'Включить звуковые сигналы');
  $('sound-toggle').title=sound?'Выключить короткие звуковые сигналы':'Включить короткие звуковые сигналы (без музыки)';
  $('sound-toggle').textContent=sound?'♫':'♪';
}
function render(){
  const stage=heroStage(state),rank=ranks[stage],rival=nextRival(state);
  renderHeader(rank,rival);
  renderStats();
  renderEnergy();
  renderLoadout();
  renderHero(stage,rank);
  renderActions();
  renderCampaign();
  renderFooter();
}

function showRivalPortrait(id){const r=RIVALS.find(x=>x.id===id);if(!r||RIVALS.indexOf(r)>state.wins)return;const dialog=document.createElement('dialog');dialog.className='portrait-dialog';dialog.setAttribute('aria-label',`Фото ${r.name}`);dialog.innerHTML=`<div class="portrait-dialog-body"><button type="button" class="close-button portrait-close" aria-label="Закрыть фото">×</button><div class="portrait-art" style="${rivalSpriteStyle(r.portrait)}" role="img" aria-label="${esc(r.name)}"></div><h2>${esc(r.name)}</h2><p>${esc(r.title)}</p></div>`;document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.querySelector('.portrait-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});dialog.showModal();}
function closeModal(){if(modalKind==='fight'&&battle&&!battle.finished){toast('Заверши схватку или нажми «Сдаться».');return;}cleanup?.();cleanup=null;modalKind=null;working=false;$('game-dialog').close();document.querySelector('.arena-scene').classList.remove('scene-training');}
function modal(html,kind='info'){cleanup?.();cleanup=null;modalKind=kind;$('dialog-content').innerHTML=html;if(!$('game-dialog').open)$('game-dialog').showModal();}
function modalTop(eyebrow,closable=true){return `<div class="dialog-top"><span class="tiny-label">${eyebrow}</span>${closable?'<button class="close-button" data-close aria-label="Закрыть">×</button>':''}</div>`;}
function help(){modal(`<div class="dialog-body">${modalTop('ПРАВИЛА ПОДВАЛА')}<h2 id="dialog-title">СЛУШАЙ СЮДА, НОВЕНЬКИЙ.</h2><ol class="help-list"><li><strong>Качайся.</strong> В каждом подходе 6 повторений. Жми кнопку или пробел, когда бегунок в зелёной зоне. Точность даёт больше роста. В новых залах зона уже, а техника расширяет её.</li><li><strong>Восстанавливайся.</strong> Отдых бесплатный. На шаурму и экипировку заработай подработкой или победами.</li><li><strong>Атакуй в ритм.</strong> На ковре одна кнопка — «Атаковать». Нажми её или пробел, когда бегунок в зелёной зоне. Сила определяет урон, техника расширяет зону, выносливость увеличивает запас сил. Промах ослабляет удар и даёт сопернику шанс ответить.</li><li><strong>Готовься к бою.</strong> Часть энергии перед схваткой становится запасом сил. У поздних соперников зона тайминга уже и удары сильнее. Тренируй все три характеристики: одной только мощи для победы мало.</li><li><strong>Забери трон.</strong> Четыре зала, 12 соперников, финальный Гигабатя. Прохождение рассчитано примерно на 20–30 минут.</li></ol><p class="dialog-copy">Прогресс автоматически остаётся в этом браузере. Кнопка ♪ включает короткие сигналы действий и побед. Музыки нет. Схватку можно продолжить после перезагрузки.</p><button class="primary-button" data-close>ПОНЯЛ. ПОШЁЛ КАЧАТЬСЯ. <span>↗</span></button></div>`);}
function showAchievements(){modal(`<div class="dialog-body">${modalTop('ТВОЙ ШКАФ С КУБКАМИ')}<h2 id="dialog-title">ЗАСЛУГИ ПЕРЕД ЖЕЛЕЗОМ.</h2><div class="achievement-list">${achievements.map(([id,name,desc])=>`<div class="achievement-item ${state.achievements.includes(id)?'':'locked'}">${state.achievements.includes(id)?'✓':'○'} ${name}<small>${desc}</small></div>`).join('')}</div></div>`);}

function startTraining(kind){
  if(working||battle)return;
  if(state.energy<18){toast('Сначала восстанови энергию.',true);return;}
  const exercise=exercises[kind];
  if(!exercise)return;
  working=true;
  const duration=Math.max(1500,1800-state.gym*75-Math.min(120,state.workouts*2.5)+Math.min(100,Math.max(0,state.technique-6)*2));
  const zoneWidth=Math.max(20,Math.min(34,32-state.gym*2.5-Math.min(5,state.workouts*.1)+Math.min(6,Math.max(0,state.technique-6)*.15)));
  const total=6;
  let count=0,sum=0,repStart=performance.now(),raf=0,nextRepTimer=0,stopped=false,pressed=false;
  modal(`<div class="dialog-body">${modalTop('ТРЕНИРОВКА · −18 ЭНЕРГИИ')}<h2 id="dialog-title">${exercise.call}</h2><p class="dialog-copy">${exercise.cue} Шесть повторений. Один шаг к легенде.</p><div class="workout-stage"><img class="workout-photo training-gif" src="./assets/training-${kind}.gif" alt="${exercise.name}: анимированный мем с тренировкой"><div><div class="rep-count"><span id="rep-number">1</span><small> / 6</small></div><span class="tiny-label">ПОВТОРЕНИЕ</span><div class="timing-track" aria-label="Лови маркер в центральной зелёной зоне"><div class="timing-zone" style="left:${(100-zoneWidth)/2}%;width:${zoneWidth}%"></div><i class="timing-marker" id="rep-marker"></i></div><div class="timing-result" id="rep-result">Лови момент.</div><button class="primary-button" id="rep-button">${kind==='strength'?'ЖМИ!':kind==='technique'?'ЛОВИ!':'ПРИСЕДАЙ!'} <span>SPACE</span></button><div class="workout-score" id="rep-score">${Array(total).fill('<i></i>').join('')}</div><p class="training-instructions" style="margin-top:13px">Кнопка или пробел · зелёная зона = больше роста</p></div></div></div>`,'training');
  document.querySelector('.arena-scene').classList.add('scene-training');

  const progress=()=>Math.min(1,(performance.now()-repStart)/duration);
  const hit=()=>{
    if(stopped||pressed)return;
    pressed=true;
    const p=progress(),quality=Math.max(.2,1-Math.abs(p-.5)*70/zoneWidth);
    sum+=quality;
    const dot=$('rep-score')?.children[count];
    if(dot)dot.className=quality>=.65?'hit':'miss';
    const out=$('rep-result');
    if(out)out.textContent=quality>=.86?'ЧИСТО! БАТЯ ГОРДИТСЯ.':quality>=.6?'Хороший повтор.':'Засчитано. Но можешь лучше.';
    $('rep-button').disabled=true;
    tone(quality>=.86?'perfect':'hit');
    cancelAnimationFrame(raf);
    nextRepTimer=setTimeout(()=>{advance();if(!stopped)raf=requestAnimationFrame(frame);},200);
  };
  const finish=()=>{
    stopped=true;
    clearTimeout(nextRepTimer);
    cancelAnimationFrame(raf);
    const result=train(state,kind,sum/total);
    cleanup=null;
    document.removeEventListener('keydown',onKey);
    modalKind=null;
    closeModal();
    if(apply(result)){
      tone('win');
      if(state.workouts%7===0)setTimeout(()=>toast(coachLines[Math.floor(state.workouts/7)%coachLines.length]),1600);
    }
  };
  const advance=()=>{
    if(stopped)return;
    count++;
    if(count===total){finish();return;}
    repStart=performance.now();
    pressed=false;
    $('rep-number').textContent=count+1;
    $('rep-button').disabled=false;
    $('rep-result').textContent='Следующий повтор. Держи ритм.';
  };
  const frame=()=>{
    if(stopped)return;
    const p=progress(),marker=$('rep-marker');
    if(marker)marker.style.left=`${p*100}%`;
    if(p>=1){
      if(!pressed){const dot=$('rep-score')?.children[count];if(dot)dot.className='miss';}
      advance();
      if(stopped)return;
    }
    raf=requestAnimationFrame(frame);
  };
  const onKey=ev=>{
    if(ev.code==='Space'&&modalKind==='training'){
      ev.preventDefault();
      if(!ev.repeat)hit();
    }
  };
  document.addEventListener('keydown',onKey);
  $('rep-button').onclick=hit;
  cleanup=()=>{
    stopped=true;
    clearTimeout(nextRepTimer);
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown',onKey);
  };
  raf=requestAnimationFrame(frame);
}
function timedAction(kind){
  if(working||battle)return;
  if(kind==='rest'&&state.energy===100){toast('Ты уже полон сил.');return;}
  if(kind==='work'&&state.energy<12){toast('Сначала передохни: для работы нужно 12 энергии.',true);return;}
  working=true;
  const seconds=kind==='rest'?6:8;
  const lines=kind==='rest'
    ? ['Сел на скамью. Выглядишь занятой.','Глубокий вдох. Неглубокие мысли.','Силы возвращаются. Понты тоже.']
    : ['Переносишь блины. Не те, что со сметаной.','Сорок килограммов чужих амбиций.','Тренер готовит наличку. Без премии.'];
  modal(`<div class="dialog-body">${modalTop(kind==='rest'?'ВОССТАНОВЛЕНИЕ':'ПОДРАБОТКА')}<h2 id="dialog-title">${kind==='rest'?'ПОСИДИ КРАСИВО.':'ЖЕЛЕЗО ЛЮБИТ ПОРЯДОК.'}</h2><p class="work-description" id="work-description">${lines[0]}</p><div class="timer-ring"><i id="work-progress"></i></div><p class="dialog-copy">${kind==='rest'?'+40 энергии · бесплатно':`+${35+state.gym*15} ₽ · −12 энергии`} <span id="work-timer">${seconds} сек.</span></p></div>`,'timed');
  const started=performance.now();
  let raf=0,stop=false;
  const frame=()=>{
    if(stop)return;
    const p=Math.min(1,(performance.now()-started)/(seconds*1000));
    $('work-progress').style.width=`${p*100}%`;
    $('work-timer').textContent=`${Math.ceil(seconds*(1-p))} сек.`;
    $('work-description').textContent=lines[Math.min(2,Math.floor(p*3))];
    if(p===1){
      cleanup=null;
      closeModal();
      apply(kind==='rest'?rest(state):work(state));
      tone('tap');
      return;
    }
    raf=requestAnimationFrame(frame);
  };
  cleanup=()=>{stop=true;cancelAnimationFrame(raf);};
  raf=requestAnimationFrame(frame);
}
function startFight(){if(working||battle)return;const result=beginFight(state);if(result.error){toast(result.error,true);return;}battle=result.battle;state=result.state;persist();render();roundLock=false;fightView();tone('hit');}
function fightLogMarkup(current,message=''){
  const last=current.history.at(-1);
  if(!last)return `<div class="fight-log-placeholder">${esc(message||'Лови бегунок в узкой зелёной зоне и атакуй.')}</div>`;
  if(last.move!=='attack')return '<div class="fight-log-placeholder">Бой продолжен по новым правилам. Теперь на ковре одна атака — лови зелёную зону.</div>';
  const damage=value=>Math.max(0,Number.isFinite(value)?Math.round(value):0);
  const dealt=damage(last.playerDamage),received=damage(last.enemyDamage);
  const outcome=last.winded?'ВЫДОХСЯ':last.timingGrade==='perfect'?'ИДЕАЛЬНЫЙ ТАЙМИНГ':last.timingGrade==='good'?'ПОПАДАНИЕ':'МИМО ЗОНЫ';
  const timing=last.winded?'Сил не хватило на удар: ход восстановил запас, соперник ответил.':last.timingGrade==='perfect'?'Прямо в центр: атака прошла, ответ слабее.':last.timingGrade==='good'?'Бегунок был в зоне: атака прошла.':'Бегунок был вне зоны: атака не прошла, соперник ответил.';
  const stamina=Number.isFinite(last.staminaDelta)?` · ${last.staminaDelta>=0?'+':'−'}${Math.abs(Math.round(last.staminaDelta))} сил`:'';
  return `<div class="fight-log-summary"><span>РАУНД ${damage(last.round)} · АТАКА</span><strong>${outcome}</strong></div><div class="fight-log-stats"><div class="fight-log-stat dealt"><span>СОПЕРНИК ПОТЕРЯЛ</span><strong>${dealt?'−':''}${dealt}</strong><small>здоровья</small></div><div class="fight-log-stat received"><span>ТЫ ПОТЕРЯЛ</span><strong>${received?'−':''}${received}</strong><small>здоровья</small></div></div><div class="fight-log-note">${timing}${stamina}</div>`;
}
function fightView(message=''){
  if(!battle)return;
  const r=RIVALS.find(x=>x.id===battle.rivalId);
  if(!r)return;
  const timingWindow=fightTimingWindow(state,battle),preview=fightMovePreview(state,battle,'attack');
  const maxStamina=battle.maxStamina||fightMaxStamina(state),enemyMaxHp=battle.enemyMaxHp||100;
  const staminaPct=Math.max(0,Math.min(100,battle.playerStamina/maxStamina*100));
  const enemyHpPct=Math.max(0,Math.min(100,battle.enemyHp/enemyMaxHp*100));
  modal(`<div class="dialog-body">${modalTop(`КОВЁР · РАУНД ${Math.min(10,battle.round+1)} / 10`,false)}<h2 id="dialog-title">${esc(r.name.toUpperCase())}</h2><p class="muted">«${esc(r.quote)}»</p><div class="fight-stage"><div><div class="fighter-image player" id="player-fighter" style="background-image:url('${heroPath(state)}')"><span>ТЫ</span></div><div class="hp-label"><span>ЗДОРОВЬЕ</span><strong>${battle.playerHp} / 100</strong></div><div class="hp-track"><i style="width:${battle.playerHp}%"></i></div></div><span class="vs">VS</span><div><button type="button" class="fighter-image enemy portrait-trigger" id="enemy-fighter" data-rival-image="${r.id}" style="${fightSpriteStyle(r.portrait)}" aria-label="Увеличить фото ${esc(r.name)}"><span>${esc(r.name)}</span></button><div class="hp-label"><span>ЗДОРОВЬЕ СОПЕРНИКА</span><strong>${battle.enemyHp} / ${enemyMaxHp}</strong></div><div class="hp-track enemy-bar"><i style="width:${enemyHpPct}%"></i></div></div></div><div class="fight-tip"><strong>Сила ${state.strength}</strong> бьёт · <strong>Техника ${state.technique}</strong> расширяет зону · <strong>Выносливость ${state.endurance}</strong> даёт запас сил.</div><div class="stamina-meter" role="progressbar" aria-label="Запас сил" aria-valuemin="0" aria-valuemax="${maxStamina}" aria-valuenow="${battle.playerStamina}"><div class="stamina-label"><span>ЗАПАС СИЛ</span><strong>${battle.playerStamina} / ${maxStamina}</strong></div><div class="stamina-track ${staminaPct<25?'low':''}"><i style="width:${staminaPct}%"></i></div></div><div class="timing-caption">ПОПАДИ В ЗЕЛЁНУЮ ЗОНУ · ${Math.round(timingWindow*200)}% ШКАЛЫ</div><div class="timing-track" style="height:20px;margin:10px 0 15px"><div class="timing-zone" style="left:${(0.5-timingWindow)*100}%;width:${timingWindow*200}%"></div><i class="timing-marker" id="fight-marker"></i></div><button class="primary-button attack-button" data-move="attack" ${roundLock?'disabled':''}><span><strong>АТАКОВАТЬ</strong><small>${preview?.winded?`Выдохся: +${preview.staminaDelta} сил, без урона`:`Точное попадание: ${preview?.maxDamage??0} урона · −${preview?.staminaCost??18} сил`}</small></span><kbd>ПРОБЕЛ</kbd></button><div class="fight-log" id="fight-log" aria-live="polite">${fightLogMarkup(battle,message)}</div><div class="battle-hint">${battle.playerStamina<18?'Сил меньше 18: следующая атака восстановит запас, но не нанесёт урон.':'На 10-м раунде побеждает тот, у кого осталось больше здоровья.'}</div><button class="text-button" id="surrender-button" style="margin-top:15px">Сдаться и вернуться к железу</button></div>`,'fight');
  $('dialog-content').querySelector('[data-move="attack"]')?.focus({preventScroll:true});
  const started=performance.now(),period=Math.max(390,610-state.gym*42-(state.wins%3===2?30:0)-battle.round*5);
  let stop=false;
  const frame=()=>{if(stop)return;const marker=$('fight-marker');if(marker)marker.style.left=`${(1-Math.cos((performance.now()-started)/period))*50}%`;tickFrame=requestAnimationFrame(frame);};
  cleanup=()=>{stop=true;cancelAnimationFrame(tickFrame);};tickFrame=requestAnimationFrame(frame);
}
function makeMove(move){if(!battle||battle.finished||roundLock)return;const timing=Number.parseFloat($('fight-marker')?.style.left||'50')/100,oldGym=state.gym,r=RIVALS.find(x=>x.id===battle.rivalId),result=fightTurn(state,battle,move,timing);if(result.error){toast(result.error,true);return;}roundLock=true;battle=result.battle;state=result.state;persist();document.querySelectorAll('[data-move]').forEach(b=>b.disabled=true);$('enemy-fighter')?.classList.add('hit-flash');$('player-fighter')?.classList.add('hit-flash');$('fight-log').innerHTML=fightLogMarkup(battle,result.message);tone('hit');setTimeout(()=>{roundLock=false;if(battle?.finished){const win=battle.result==='win';battle=null;persist();render();showFightResult(win,r,oldGym,result.message);}else if(battle)fightView(result.message);},950);}
function showFightResult(win,r,oldGym,message){if(state.won){showVictory();return;}modal(`<div class="dialog-body">${modalTop(win?'АВТОРИТЕТ ПОЛУЧЕН':'ПРОСТО РАЗМИНКА',false)}<h2 id="dialog-title" class="victory-heading" style="color:${win?'var(--gold)':'var(--muted)'}">${win?'ТВОЯ ВЗЯЛА.':'ЕЩЁ ВСТРЕТИМСЯ.'}</h2><p class="dialog-copy" style="text-align:center">${esc(win?r.winQuote:'Тебя положили на лопатки. Самооценку поднимешь жимом.')}<br>${esc(message)}</p>${win?`<div class="result-stats"><div><strong>+${r.reward} ₽</strong><span>в кассу</span></div><div><strong>${state.wins} / 12</strong><span>соперников позади</span></div><div><strong>${power(state)}</strong><span>твоя мощь</span></div></div>`:''}${state.gym>oldGym?`<div class="gym-panorama travel-panorama" style="--gym-position:${position(state.gym)}" role="img" aria-label="${esc(GYMS[state.gym].name)}"></div><div class="telegraph"><strong>НОВЫЙ ЗАЛ: ${esc(GYMS[state.gym].name.toUpperCase())}</strong><br>${esc(GYMS[state.gym].description)}</div>`:''}<button class="primary-button" data-close>${win?'ДАЛЬШЕ — БОЛЬШЕ':'ПОЙДУ ПОДКАЧАЮСЬ'} <span>↗</span></button></div>`,'result');if(win){tone('win');confetti(28);}}
function showVictory(){modal(`<div class="dialog-body">${modalTop('ВСЕ 12 СОПЕРНИКОВ ПОБЕЖДЕНЫ')}<h2 id="dialog-title" class="victory-heading">BOSS OF THIS GYM.</h2><img class="victory-photo" src="./assets/hero-3.png?v=fullbody" alt="Ты стал огромным чемпионом качалки"><p class="dialog-copy" style="text-align:center">Ты пришёл сюда мешать воздух. Теперь воздух спрашивает у тебя разрешения.<br><strong>Гигабатя отдаёт тебе трон. И ключ от раздевалки.</strong></p><div class="result-stats"><div><strong>${state.workouts}</strong><span>подходов</span></div><div><strong>${Math.max(1,Math.round(state.playSeconds/60))} мин</strong><span>до легенды</span></div><div><strong>${state.respect}</strong><span>уважения</span></div></div><button class="primary-button" data-close>ОСТАТЬСЯ В СВОЁМ ЗАЛЕ <span>♛</span></button><p class="muted" style="text-align:center;margin-top:16px">Блины после себя всё равно убери.</p></div>`,'victory');tone('win');confetti(70);}
function confetti(count){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;for(let i=0;i<count;i++){const el=document.createElement('i');el.className='celebration-spark';el.style.left=`${Math.random()*100}%`;el.style.background=['#ff653b','#8ddbcc','#e4b56d','#f0f1e8'][i%4];el.style.animationDelay=`${Math.random()*.6}s`;el.style.setProperty('--drift',`${(Math.random()-.5)*260}px`);document.body.append(el);setTimeout(()=>el.remove(),3600);}}
function resetPrompt(){modal(`<div class="dialog-body">${modalTop('СНОВА В ПОДВАЛ')}<h2 id="dialog-title">СБРОСИТЬ ВЕСЬ ПРОГРЕСС?</h2><p class="dialog-copy">Победы, мышцы и покупки исчезнут. Снова останутся только шорты и надежда.</p><div class="dialog-actions"><button class="secondary-button" data-close>Сохранить мышцы</button><button class="primary-button" id="confirm-reset">НАЧАТЬ ЗАНОВО</button></div></div>`);}

document.addEventListener('keydown',ev=>{if(ev.code!=='Space'||modalKind!=='fight'||ev.repeat)return;if(document.activeElement?.closest?.('#surrender-button, #enemy-fighter'))return;ev.preventDefault();makeMove('attack');});
function resetGame(){
  cleanup?.();
  battle=null;
  clearTimeout(gainsTimer);
  recentGains=null;
  state=createState();
  tab='gym';
  modalKind=null;
  closeModal();
  persist();
  render();
  toast('Новая жизнь. Старые шорты. Погнали.');
}
function surrenderFight(){
  if(roundLock)return;
  state={...state,energy:Math.max(0,state.energy-(battle?.serum&&!battle.serumPaidAtStart?15:0))};
  battle=null;
  modalKind=null;
  closeModal();
  persist();
  render();
  toast('Сегодня железо полезнее ковра. Возвращайся сильнее.');
}
function handleClick(ev){
  const b=ev.target.closest('button');
  if(!b||b.disabled)return;
  if(b.dataset.rivalImage){showRivalPortrait(b.dataset.rivalImage);return;}
  if(b.hasAttribute('data-close')){closeModal();return;}
  if(b.dataset.tab){tab=b.dataset.tab;render();tone();return;}
  if(b.dataset.train){startTraining(b.dataset.train);return;}
  if(b.dataset.buy){if(apply(buy(state,b.dataset.buy)))tone('perfect');return;}
  if(b.dataset.move){makeMove(b.dataset.move);return;}
  switch(b.id){
    case 'rest-button': timedAction('rest');break;
    case 'work-button': timedAction('work');break;
    case 'fight-button': startFight();break;
    case 'victory-button': showVictory();break;
    case 'help-button': help();break;
    case 'achievements-button': showAchievements();break;
    case 'sound-toggle': sound=!sound;persist();render();tone('perfect');break;
    case 'reset-button': resetPrompt();break;
    case 'confirm-reset': resetGame();break;
    case 'surrender-button': surrenderFight();break;
  }
}
document.addEventListener('click',handleClick);
$('game-dialog').addEventListener('cancel',ev=>{ev.preventDefault();closeModal();});
document.querySelector('.tabbar').addEventListener('keydown',ev=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;ev.preventDefault();const tabs=['gym','fight','shop','road'];let i=tabs.indexOf(tab);i=ev.key==='Home'?0:ev.key==='End'?3:(i+(ev.key==='ArrowRight'?1:3))%4;tab=tabs[i];render();$(`tab-${tab}`).focus();});
let lastTick=Date.now();setInterval(()=>{const now=Date.now();if(!document.hidden&&!state.won){state={...state,playSeconds:state.playSeconds+Math.min(10,Math.round((now-lastTick)/1000))};persist();}lastTick=now;},5000);
document.addEventListener('visibilitychange',()=>{lastTick=Date.now();persist();});window.addEventListener('pagehide',persist);
render();persist();if(battle)fightView('Схватка продолжается. Соперник дождался.');else if(!saved)setTimeout(()=>toast('Начни с тренировки «Качаться». Лови зелёную зону — и расти.'),900);
setTimeout(()=>{const img=new Image();img.src=`./assets/hero-${Math.min(3,heroStage(state)+1)}.png?v=fullbody`;},2500);

const context=document.modelContext;
if(context?.registerTool){const controller=new AbortController();const tools=[{name:'get_gym_progress',title:'Прогресс в GYM BOSS',description:'Read the current character stats, resources, next opponent and campaign progress.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async input=>{if(input&&Object.keys(input).length)throw new Error('No arguments expected');return {gym:GYMS[state.gym].name,wins:state.wins,power:power(state),energy:state.energy,money:state.money,stats:Object.fromEntries(Object.keys(stats).map(k=>[k,state[k]])),nextRival:nextRival(state)?.name??null,won:state.won};}},{name:'open_gym_section',title:'Открыть раздел игры',description:'Open training, wrestling, equipment shop or opponent progression without completing an action.',inputSchema:{type:'object',properties:{section:{type:'string',enum:['gym','fight','shop','road']}},required:['section'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{if(!input||Object.keys(input).some(k=>k!=='section')||!['gym','fight','shop','road'].includes(input.section))throw new Error('Expected section: gym, fight, shop, or road');if(modalKind)throw new Error('Close the current activity first');tab=input.section;render();return {section:tab};}}];for(const tool of tools){try{void Promise.resolve(context.registerTool(tool,{signal:controller.signal})).catch(()=>{});}catch{}}window.addEventListener('pagehide',()=>controller.abort(),{once:true});}
