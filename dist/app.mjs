import {GYMS,RIVALS,SHOP,createState,sanitizeState,power,nextRival,train,trainingDifficulty,liftQuality,rest,work,buy,beginFight,fightTurn,fightTimingWindow,fightMovePreview,fightMaxStamina,fightStartingStamina,migrateBattle} from './engine.mjs';

const $=id=>document.getElementById(id);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SAVE_KEY='gymboss:iron-king:v1';
const stats={strength:'Сила',technique:'Техника',endurance:'Выносливость'};
const statHints={strength:'Определяет урон твоей атаки. Больше силы — сильнее каждый удар.',technique:'Расширяет зелёную зону тайминга в борьбе. С высокой техникой проще попасть точно.',endurance:'Увеличивает максимальный запас сил в борьбе. Он может быть больше 100.'};
const exercises={strength:{name:'Качаться',icon:'↥',call:'КАЧАЙСЯ. НЕ ДУМАЙ.',cue:'Держи вес и отпускай его в зелёной зоне.',tag:'удержание'},technique:{name:'Школа захвата',icon:'⌁',call:'МЯГКО СТЕЛЕШЬ.',cue:'Смотри, откуда идёт захват, и выбирай уход.',tag:'выбор приёма'},endurance:{name:'Кардио',icon:'↟',call:'ДЫШИ. НЕ СДАВАЙСЯ.',cue:'Поддерживай пульс в зелёной зоне, не перегревайся.',tag:'держи темп'}};
const ranks=[{name:'ПОКА ЕЩЁ<br>ДРИЩ',desc:'Гриф тяжелее твоих аргументов.',headline:'ТВОЙ ПЕРВЫЙ<br><em>ПОДХОД.</em>',quote:'«В этом зале тебя пока зовут “эй”.»'},{name:'УЖЕ<br>НЕ СМЕШНО',desc:'Футболка начала задавать вопросы.',headline:'МАССА ЕСТЬ.<br><em>ВОПРОСЫ?</em>',quote:'«Бро, ты случайно не стал шире двери?»'},{name:'ЖИВАЯ<br>МАШИНА',desc:'Штанга просит тебя о страховке.',headline:'СВЯТОЙ<br><em>ПАМП.</em>',quote:'«Твои трапеции видны из космоса.»'},{name:'БОЛЬШОЙ<br>МАЛЬЧИК',desc:'Сила есть. Осталось забрать трон.',headline:'BOSS OF<br><em>THIS GYM.</em>',quote:'«Ты не занимаешь место. Ты его создаёшь.»'}];
const achievements=[['first-workout','Первый памп','Завершить первую тренировку'],['first-win','Коврик теперь твой','Победить первого соперника'],['first-gear','Приоделся, красавчик','Купить экипировку'],['gym-two','Вырос из подвала','Открыть второй зал'],['legend','BOSS OF THIS GYM','Забрать все 12 побед']];
const coachLines=['Штанга сама себя не поднимет. Хотя тебя, может, и поднимет.','Кто пропускает день ног, тот пропускает жизнь.','Три сотни баксов? У нас пока тридцать пять рублей.','Два подхода назад ты был другим человеком.','Правило зала: блины после себя убери. Эго можешь оставить.','Пот — это слёзы твоей лени. Вытри скамейку.','Ну что, fucking strong или пока just fucking tired?'];
const position=p=>`${p%2===0?'0%':'100%'} ${p<2?'0%':'100%'}`;
const rivalSpriteStyle=p=>`background-image:url('./assets/rivals-${Math.floor(p/4)}.jpg?v=unique');background-position:${position(p%4)};background-size:200% ${p<2?'208%':p<4?'193%':'200%'}`;
const fightSpriteStyle=p=>`background-image:url('./assets/rivals-${Math.floor(p/4)}.jpg?v=unique');background-position:${position(p%4)};background-size:200% 200%`;
const rivalPortraitButton=r=>`<button type="button" class="rival-portrait portrait-trigger" data-rival-image="${r.id}" style="${rivalSpriteStyle(r.portrait)}" aria-label="Увеличить фото ${esc(r.name)}"></button>`;
const shopSpriteStyle=id=>{const art={cookies:'shop-cookies.jpg',trenbolone:'shop-trenbolone.jpg'}[id];if(art)return `background-image:url('./assets/${art}');background-position:center;background-size:cover`;const p=['shawarma','protein','serum','wraps','shoes','belt'].indexOf(id);return `background-position:${p%3*50}% ${p<3?'0%':'100%'}`;};
const heroStage=s=>s.won?3:Math.min(3,Math.max(s.gym,Math.floor(s.workouts/15)));
const heroPath=s=>`./assets/hero-${heroStage(s)}.jpg?v=fullbody`;
const statKeys=Object.keys(stats);
const shopById=new Map(SHOP.map(item=>[item.id,item]));
function loadoutNames(character){
  const names=character.equipment.map(id=>shopById.get(id)?.name).filter(Boolean);
  if(character.buff)names.push(`${shopById.get(character.buff.id)?.name} ×${character.buff.charges}`);
  return names;
}
let state=createState(),battle=null,tab='gym',sound=false,audio=null,modalKind=null,cleanup=null,working=false,saveFailed=false,tickFrame=0,roundLock=false,saved=false,recentGains=null,recentTrainingKind=null,gainsTimer=0,heroGainsTimer=0;
try{const raw=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(raw?.state){state=sanitizeState(raw.state);saved=true;sound=!!raw.sound;battle=migrateBattle(state,raw.battle);}}catch{saved=false;}

function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({state,battle:battle&&!battle.finished?battle:null,sound}));saveFailed=false;}catch{saveFailed=true;}const el=$('save-status');if(el){el.textContent=saveFailed?'Сохранение недоступно в этом браузере':'Прогресс сохранён в этом браузере';el.classList.toggle('save-warning',saveFailed);}}
function tone(kind='tap'){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')void audio.resume();const freqs=kind==='win'?[220,330,440,660]:kind==='perfect'?[440,660]:kind==='hit'?[85,55]:kind==='error'?[160,120]:[260];freqs.forEach((f,i)=>{const osc=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.085;osc.type=kind==='hit'?'triangle':'sine';osc.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.055,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+.17);osc.connect(g);g.connect(audio.destination);osc.start(t);osc.stop(t+.2);});}catch{sound=false;}}
function toast(message,error=false){const el=document.createElement('div');el.className=`toast${error?' error':''}`;el.textContent=message;$('toasts').append(el);setTimeout(()=>el.remove(),4400);if(error)tone('error');}
function apply(result,{quiet=false,heroGains=false,trainingKind=null}={}){if(result.error){toast(result.error,true);return false;}const oldAchievements=new Set(state.achievements),before=state;state=result.state;const gains=Object.fromEntries([...statKeys,'energy'].map(k=>[k,state[k]-before[k]]).filter(([,gain])=>gain!==0));persist();if(Object.keys(gains).length)gainsPop(gains,heroGains,trainingKind);else render();if(!quiet&&result.message)toast(result.message);for(const id of state.achievements){if(!oldAchievements.has(id)){const a=achievements.find(x=>x[0]===id);setTimeout(()=>toast(`Достижение: ${a?.[1]??id}`),500);}}return true;}
function gainsPop(gains,heroGains=false,trainingKind=null){
  recentGains=gains;
  recentTrainingKind=trainingKind;
  render();
  if(heroGains){
    const el=$('floating-gains');
    el.textContent=(trainingKind?[trainingKind]:statKeys.filter(k=>gains[k]>0)).map(k=>`${stats[k].toUpperCase()} +${gains[k]||0}`).join('\n');
    el.classList.remove('gain-pop');
    void el.offsetWidth;
    el.classList.add('gain-pop');
    clearTimeout(heroGainsTimer);
    heroGainsTimer=setTimeout(()=>{el.textContent='';el.classList.remove('gain-pop');},2600);
  }
  clearTimeout(gainsTimer);
  gainsTimer=setTimeout(()=>{recentGains=null;recentTrainingKind=null;renderStats();renderEnergy();},6000);
}

function gymMarkup(){return `<div class="training-heading"><h2>ВЫБЕРИ ТРЕНИРОВКУ</h2></div><div class="training-list">${Object.entries(exercises).map(([k,e])=>`<button class="training-card" data-train="${k}" ${state.energy<18?'disabled':''}><span class="exercise-icon" aria-hidden="true">${e.icon}</span><span><strong>${e.name}</strong><small>${stats[k]} +0–6 · ${e.tag}</small></span><span class="action-price">18 ⚡</span></button>`).join('')}</div><div class="support-group"><span class="group-title">МЕЖДУ ПОДХОДАМИ</span><div class="utility-actions"><button id="rest-button" ${state.energy===100?'disabled':''}><span aria-hidden="true">☾</span><strong>Отдых</strong><small>Антистресс · +40 энергии</small></button><button id="work-button" ${state.energy<12?'disabled':''}><span aria-hidden="true">₽</span><strong>Подработка</strong><small>Разложи блины · ${20+state.gym*15}–${35+state.gym*15} ₽ · −12 энергии</small></button></div></div>`;}
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
    return `<div class="stat ${gain?'gained':''}"><div><span class="stat-name">${stats[k]} <button type="button" class="stat-help" aria-label="${stats[k]}: ${statHints[k]}">?<span class="stat-tooltip" role="tooltip">${statHints[k]}</span></button></span><strong>${state[k]}${gain||recentTrainingKind===k?` (+${gain})`:''}</strong></div><div class="stat-track"><i style="width:${after}%"></i>${gain&&after>before?`<b class="stat-gain-segment" style="left:${before}%;width:${after-before}%"></b>`:''}</div></div>`;
  }).join('');
}
function renderEnergy(){
  const change=recentGains?.energy||0;
  $('energy-value').textContent=`${state.energy} / 100${change?` (${change>0?'+':''}${change})`:''}`;
  const box=$('energy-value').closest('.energy-box');
  box.classList.toggle('gained',change>0);
  box.classList.toggle('spent',change<0);
  $('energy-bar').style.width=`${state.energy}%`;
  $('energy-bar').style.background=state.energy<20?'var(--orange)':'var(--cyan)';
  const segment=$('energy-change-segment');
  segment.className=change<0?'energy-spent-segment':change>0?'energy-gain-segment':'';
  segment.style.left=`${change<0?state.energy:state.energy-change}%`;
  segment.style.width=`${Math.abs(change)}%`;
  $('energy-hint').textContent=state.energy<20?'Без сил? Отдых бесплатный. Батя разрешил.':state.energy<50?'Ещё подход — и пора на скамейку.':'Полон сил. Почти как настоящий качок.';
}
function renderLoadout(){
  const equipped=loadoutNames(state);
  $('equipment').textContent=equipped.length?equipped.join(' · '):'Потёртые шорты. Чистая вера.';
}
function renderHero(stage,rank){
  const hero=$('hero-image');
  if(!hero.src.endsWith(`hero-${stage}.jpg?v=fullbody`)){
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
function closeModal(){if(modalKind==='fight'&&roundLock){toast('Дождись конца обмена ударами.');return;}if(modalKind==='fight'&&battle&&!battle.finished){toast('Заверши схватку или нажми «Сдаться».');return;}cleanup?.();cleanup=null;modalKind=null;working=false;$('game-dialog').close();document.querySelector('.arena-scene').classList.remove('scene-training');}
function modal(html,kind='info'){cleanup?.();cleanup=null;modalKind=kind;$('dialog-content').innerHTML=html;if(!$('game-dialog').open)$('game-dialog').showModal();}
function modalTop(eyebrow,closable=true){return `<div class="dialog-top"><span class="tiny-label">${eyebrow}</span>${closable?'<button class="close-button" data-close aria-label="Закрыть">×</button>':''}</div>`;}
function help(){modal(`<div class="dialog-body">${modalTop('ПРАВИЛА ПОДВАЛА')}<h2 id="dialog-title">СЛУШАЙ СЮДА, НОВЕНЬКИЙ.</h2><ol class="help-list"><li><strong>Тренируйся.</strong> В «Качаться» удерживай вес и отпускай в зелёной зоне. В школе захвата нажимай показанную стрелку. В кардио поддерживай пульс, нажимая в своём темпе. Чем лучше сыграешь, тем больше прирост.</li><li><strong>Восстанавливайся и зарабатывай.</strong> На отдыхе нажимай в любом месте антистресса: шарики пружинят, энергия возвращается без штрафов. На подработке раскладывай блины от лёгкого к тяжёлому: ошибки уменьшают оплату.</li><li><strong>Атакуй в ритм.</strong> На ковре одна кнопка — «Атаковать». Нажми её или пробел, когда бегунок в зелёной зоне. Сила определяет урон, техника расширяет зону, выносливость увеличивает запас сил. Центр зоны даёт 100% урона, средняя часть — ⅔, края — ⅓. Вне зоны атака не наносит урон.</li><li><strong>Готовься к бою.</strong> Часть энергии перед схваткой становится запасом сил. У поздних соперников зона тайминга уже и удары сильнее. Тренируй все три характеристики: одной только мощи для победы мало.</li><li><strong>Забери трон.</strong> Четыре зала, 12 соперников, финальный Гигабатя. Прохождение рассчитано примерно на 20–30 минут.</li></ol><p class="dialog-copy">Прогресс автоматически остаётся в этом браузере. Кнопка ♪ включает короткие сигналы действий и побед. Схватку можно продолжить после перезагрузки.</p><button class="primary-button" data-close>ПОНЯЛ. ПОШЁЛ КАЧАТЬСЯ. <span>↗</span></button></div>`);}
function showAchievements(){modal(`<div class="dialog-body">${modalTop('ТВОЙ ШКАФ С КУБКАМИ')}<h2 id="dialog-title">ЗАСЛУГИ ПЕРЕД ЖЕЛЕЗОМ.</h2><div class="achievement-list">${achievements.map(([id,name,desc])=>`<div class="achievement-item ${state.achievements.includes(id)?'':'locked'}">${state.achievements.includes(id)?'✓':'○'} ${name}<small>${desc}</small></div>`).join('')}</div></div>`);}

function trainingShell(kind,game){
  const exercise=exercises[kind];
  modal(`<div class="dialog-body training-dialog ${kind}-training">${modalTop('ТРЕНИРОВКА · −18 ЭНЕРГИИ')}<h2 id="dialog-title">${exercise.call}</h2><p class="dialog-copy">${exercise.cue}</p><p class="training-reward">НАГРАДА: ${stats[kind].toUpperCase()} +0–6${state.buff?.id==='protein'?' · ПРОТЕИН: ЕЩЁ +2':''}</p><div class="workout-stage"><img class="workout-photo training-gif" src="./assets/training-${kind}.gif" alt="${exercise.name}: анимированный мем с тренировкой"><div class="minigame-content">${game}</div></div></div>`,'training');
  document.querySelector('.arena-scene').classList.add('scene-training');
}
function finishTraining(kind,quality){
  cleanup?.();cleanup=null;
  modalKind=null;
  closeModal();
  if(apply(train(state,kind,quality),{heroGains:true,trainingKind:kind})){
    tone('win');
    if(state.workouts%7===0)setTimeout(()=>toast(coachLines[Math.floor(state.workouts/7)%coachLines.length]),1600);
  }
}
function strengthTraining(){
  const total=3;
  const difficulty=trainingDifficulty(state.gym,state.workouts);
  trainingShell('strength',`<div class="minigame-heading"><span class="tiny-label">ЖИМ · ${total} ПОДХОДА</span><strong id="lift-count">1 / ${total}</strong></div><div class="lift-game"><div class="lift-track" id="lift-track" aria-label="Высота штанги: отпусти в зелёной зоне"><div class="lift-target" style="bottom:${75-difficulty.liftZone/2}%;height:${difficulty.liftZone}%"></div><div class="lift-fill" id="lift-fill"></div><div class="lift-weight" id="lift-weight" aria-hidden="true"><i></i><b></b><i></i></div></div><div class="lift-readout"><strong id="lift-percent">0%</strong><span>ЗЕЛЁНАЯ ЗОНА = ЧИСТЫЙ ЖИМ</span></div></div><button class="primary-button lift-button" id="lift-button">ДЕРЖИ И ОТПУСТИ <kbd>ПРОБЕЛ</kbd></button><div class="workout-score" id="lift-score">${Array(total).fill('<i></i>').join('')}</div><p class="timing-result" id="lift-result" role="status">Зажми кнопку или пробел. Отпусти, когда штанга в зелёной зоне.</p>`);
  let rep=0,sum=0,charge=0,holding=false,active=true,last=performance.now(),raf=0,nextTimer=0;
  const button=$('lift-button');
  const paint=()=>{
    $('lift-fill').style.height=`${charge}%`;
    $('lift-weight').style.bottom=`${charge}%`;
    $('lift-percent').textContent=`${Math.round(charge)}%`;
    $('lift-track').classList.toggle('overloaded',charge>90);
  };
  const hold=()=>{if(active&&!holding&&!button.disabled){holding=true;last=performance.now();button.classList.add('holding');$('lift-result').textContent='Держи... и отпускай в зелёной зоне!';}};
  const release=()=>{
    if(!active||!holding)return;
    holding=false;button.classList.remove('holding');button.disabled=true;
    const quality=liftQuality(charge,difficulty.liftZone);
    sum+=quality;
    $('lift-score').children[rep].className=quality>=.65?'hit':'miss';
    $('lift-result').textContent=quality>=.85?'ЧИСТЫЙ ЖИМ! ШТАНГА В ШОКЕ.':quality>=.55?'Засчитано. Ещё подход.':'Слишком рано или перегруз. Держи ровнее.';
    tone(quality>=.85?'perfect':'hit');
    nextTimer=setTimeout(()=>{
      if(!active)return;
      rep++;
      if(rep===total){finishTraining('strength',sum/total);return;}
      charge=0;paint();button.disabled=false;
      $('lift-count').textContent=`${rep+1} / ${total}`;
      $('lift-result').textContent='Следующий жим. Подними вес до зелёной зоны.';
    },420);
  };
  const frame=now=>{
    if(!active)return;
    const delta=Math.min(60,now-last);last=now;
    if(holding){charge=Math.min(100,charge+delta*difficulty.liftSpeed/1000);paint();if(charge>=100)release();}
    raf=requestAnimationFrame(frame);
  };
  const onKeyDown=event=>{if(event.code==='Space'&&modalKind==='training'){event.preventDefault();if(!event.repeat)hold();}};
  const onKeyUp=event=>{if(event.code==='Space'&&modalKind==='training'){event.preventDefault();release();}};
  const onPointerUp=()=>release();
  button.addEventListener('pointerdown',event=>{event.preventDefault();hold();});
  window.addEventListener('pointerup',onPointerUp);
  document.addEventListener('keydown',onKeyDown);
  document.addEventListener('keyup',onKeyUp);
  cleanup=()=>{active=false;holding=false;cancelAnimationFrame(raf);clearTimeout(nextTimer);window.removeEventListener('pointerup',onPointerUp);document.removeEventListener('keydown',onKeyDown);document.removeEventListener('keyup',onKeyUp);};
  raf=requestAnimationFrame(frame);
}
function techniqueTraining(){
  const prompts=[{sign:'→',name:'ЗАХВАТ СЛЕВА · УХОДИ ВПРАВО',answer:2},{sign:'↓',name:'ДАВИТ СВЕРХУ · НЫРЯЙ',answer:1},{sign:'←',name:'ЗАХВАТ СПРАВА · УХОДИ ВЛЕВО',answer:0}];
  const choices=[['←','УЙТИ ВЛЕВО'],['↓','НЫРОК'],['→','УЙТИ ВПРАВО']];
  const total=4,limit=trainingDifficulty(state.gym,state.workouts).gripLimit;
  trainingShell('technique',`<div class="minigame-heading"><span class="tiny-label">ЧИТАЙ СОПЕРНИКА · ${total} ПРИЁМА</span><strong id="grip-count">0 / ${total}</strong></div><div class="grip-cue" id="grip-cue" role="status"><span id="grip-sign">?</span><strong id="grip-name">ПРИГОТОВЬСЯ К ЗАХВАТУ</strong></div><div class="grip-clock"><i id="grip-clock"></i></div><p class="grip-rule">Большая стрелка показывает нужный уход: нажми такую же стрелку на клавиатуре.</p><div class="grip-choices">${choices.map(([icon,label],index)=>`<button type="button" class="grip-choice" data-counter="${index}" disabled><span>${icon}</span><strong>${label}</strong><small><b>${index+1}</b> · ${icon}</small></button>`).join('')}</div><button type="button" class="primary-button training-start" id="grip-start">НАЧАТЬ ТРЕНИРОВКУ <kbd>ПРОБЕЛ</kbd></button><div class="workout-score" id="grip-score">${Array(total).fill('<i></i>').join('')}</div><p class="timing-result" id="grip-result" role="status">Сначала изучи приёмы. Затем нажми «Начать» или пробел; отвечай стрелками ← ↓ → либо цифрами 1–3.</p>`);
  let step=0,sum=0,current=Math.floor(Math.random()*3),started=0,active=true,running=false,answered=false,cueTimer=0,nextTimer=0;
  const buttons=[...document.querySelectorAll('.grip-choice')];
  const cue=()=>{
    if(!active)return;
    answered=false;
    const prompt=prompts[current];
    $('grip-sign').textContent=prompt.sign;
    $('grip-name').textContent=prompt.name;
    $('grip-count').textContent=`${step+1} / ${total}`;
    $('grip-cue').classList.remove('correct','wrong');
    buttons.forEach(button=>button.disabled=false);
    const clock=$('grip-clock');clock.style.animation='none';void clock.offsetWidth;clock.style.animation=`grip-countdown ${limit}ms linear both`;
    const choices=$('grip-cue').parentElement.querySelector('.grip-choices');choices.classList.remove('cue-active');void choices.offsetWidth;choices.classList.add('cue-active');
    started=performance.now();
    cueTimer=setTimeout(()=>answer(-1),limit);
  };
  const answer=choice=>{
    if(!active||!running||answered)return;
    answered=true;clearTimeout(cueTimer);
    const correct=choice===prompts[current].answer;
    const quality=correct?Math.max(0,1-(performance.now()-started)/limit):0;
    sum+=quality;
    $('grip-score').children[step].className=correct?'hit':'miss';
    $('grip-cue').classList.add(correct?'correct':'wrong');
    $('grip-result').textContent=correct?'ЧИСТЫЙ УХОД!':choice<0?`Задумался — нужен был уход ${prompts[current].sign}.`:`Нажал ${choices[choice][0]}, нужен был уход ${prompts[current].sign}.`;
    buttons.forEach(button=>button.disabled=true);
    tone(correct?'perfect':'error');
    nextTimer=setTimeout(()=>{
      if(!active)return;
      step++;
      if(step===total){finishTraining('technique',sum/total);return;}
      current=(current+1+Math.floor(Math.random()*2))%3;
      $('grip-result').textContent='Новый захват — реагируй!';
      cue();
    },430);
  };
  const start=()=>{if(!active||running)return;running=true;$('grip-start').remove();cue();};
  const keyChoices={ArrowLeft:0,ArrowDown:1,ArrowRight:2,Digit1:0,Digit2:1,Digit3:2,Numpad1:0,Numpad2:1,Numpad3:2};
  const onKey=event=>{
    if(modalKind!=='training')return;
    if(!running&&event.code==='Space'){event.preventDefault();if(!event.repeat)start();return;}
    if(!(event.code in keyChoices))return;
    event.preventDefault();if(!event.repeat)answer(keyChoices[event.code]);
  };
  $('grip-start').onclick=start;
  buttons.forEach((button,index)=>button.onclick=()=>answer(index));
  document.addEventListener('keydown',onKey);
  cleanup=()=>{active=false;clearTimeout(cueTimer);clearTimeout(nextTimer);document.removeEventListener('keydown',onKey);};
}
function cardioTraining(){
  const difficulty=trainingDifficulty(state.gym,state.workouts),low=difficulty.cardioLow,high=difficulty.cardioHigh,duration=6500;
  trainingShell('endurance',`<div class="minigame-heading"><span class="tiny-label">КАРДИО · ДЕРЖИ ТЕМП</span><strong id="cardio-time">7 сек.</strong></div><div class="cardio-heart" id="cardio-heart" aria-hidden="true">♥</div><div class="cardio-readout"><strong id="cardio-pulse">36</strong><span>УСЛОВНЫЙ ПУЛЬС</span></div><div class="cardio-gauge" role="img" aria-label="Держи пульс в зелёной зоне"><span class="cardio-zone" style="left:${low}%;width:${high-low}%"></span><i id="cardio-fill"></i></div><div class="cardio-scale"><span>МЕДЛЕННО</span><span>ТВОЙ ТЕМП</span><span>ПЕРЕГРЕВ</span></div><button class="primary-button cardio-button" id="cardio-button">НАЧАТЬ КАРДИО <kbd>ПРОБЕЛ</kbd></button><p class="timing-result" id="cardio-result" role="status">Изучи шкалу. Нажми кнопку или пробел, чтобы начать; затем держи пульс в зелёной зоне.</p>`);
  let pulse=36,inZone=0,active=true,running=false,raf=0,started=0,previous=0,lastMessage='';
  const start=()=>{if(!active||running)return;running=true;started=performance.now();previous=started;$('cardio-button').firstChild.textContent='СДЕЛАТЬ ШАГ ';$('cardio-result').textContent='Нажимай, чтобы разогнаться. В зелёной зоне держи ровный темп.';raf=requestAnimationFrame(frame);};
  const pump=()=>{
    if(!active||!running)return;
    pulse=Math.min(100,pulse+11);
    const heart=$('cardio-heart');heart.classList.remove('beat');void heart.offsetWidth;heart.classList.add('beat');
    tone(pulse>=low&&pulse<=high?'perfect':'tap');
  };
  const frame=now=>{
    if(!active)return;
    const delta=Math.min(80,now-previous);previous=now;
    const elapsed=Math.min(duration,now-started);
    pulse=Math.max(25,pulse-delta*difficulty.cardioDecay/1000);
    if(elapsed>600&&pulse>=low&&pulse<=high)inZone+=delta;
    $('cardio-pulse').textContent=String(Math.round(pulse));
    $('cardio-fill').style.width=`${pulse}%`;
    $('cardio-time').textContent=`${Math.max(0,Math.ceil((duration-elapsed)/1000))} сек.`;
    const message=pulse<low?'Добавь шагов — темп низкий.':pulse>high?'Сбавь обороты — перегрев!':'Вот он, чемпионский ритм. Держи!';
    if(message!==lastMessage){$('cardio-result').textContent=message;lastMessage=message;}
    $('cardio-heart').classList.toggle('in-zone',pulse>=low&&pulse<=high);
    $('cardio-heart').classList.toggle('overheated',pulse>high);
    if(elapsed>=duration){finishTraining('endurance',Math.max(0,Math.min(1,inZone/(duration-600))));return;}
    raf=requestAnimationFrame(frame);
  };
  const onKey=event=>{if(event.code==='Space'&&modalKind==='training'){event.preventDefault();if(!event.repeat){if(running)pump();else start();}}};
  $('cardio-button').onclick=()=>{if(running)pump();else start();};
  document.addEventListener('keydown',onKey);
  cleanup=()=>{active=false;cancelAnimationFrame(raf);document.removeEventListener('keydown',onKey);};
}
function startTraining(kind){
  if(working||battle)return;
  if(state.energy<18){toast('Сначала восстанови энергию.',true);return;}
  if(!exercises[kind])return;
  working=true;
  if(kind==='strength')strengthTraining();
  else if(kind==='technique')techniqueTraining();
  else cardioTraining();
}
function shuffled(items){
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
function startRestGame(){
  if(working||battle)return;
  if(state.energy===100){toast('Ты уже полон сил.');return;}
  working=true;
  modal(`<div class="dialog-body utility-game rest-game">${modalTop('ОТДЫХ · БЕСПЛАТНО')}<h2 id="dialog-title">ПОЖМЯКАЙ. ВЫДОХНИ.</h2><p class="dialog-copy">Тапай в любом месте. Смотри, как пружинят пузыри. Здесь невозможно ошибиться.</p><p class="training-reward">ЭНЕРГИЯ +40 · БЕЗ ТАЙМЕРА И ШТРАФОВ</p><button type="button" class="rest-playfield" id="rest-playfield" aria-label="Нажимай в любом месте поля шесть раз, чтобы восстановить энергию"><span class="rest-field-prompt" aria-hidden="true">ЖМЯКНИ ЗДЕСЬ <b>✦</b></span></button><div class="rest-pips" id="rest-pips" aria-hidden="true">${'<i></i>'.repeat(6)}</div><div class="utility-game-status" id="utility-status" role="status">0 / 6 жмяков · просто расслабься</div></div>`,'utility');
  const field=$('rest-playfield');
  const orbs=Array.from({length:7},(_,i)=>{
    const node=document.createElement('span');node.className=`rest-orb orb-${i%3}`;node.setAttribute('aria-hidden','true');field.append(node);
    return {node,x:25+Math.random()*Math.max(1,field.clientWidth-90),y:25+Math.random()*Math.max(1,field.clientHeight-90),vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3};
  });
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reducedMotion)for(const orb of orbs)orb.node.style.transform=`translate3d(${orb.x}px,${orb.y}px,0)`;
  let active=true,complete=false,pops=0,frameId=0,timer=0,last=performance.now();
  const frame=now=>{
    if(!active)return;
    const step=Math.min(2,(now-last)/16.67);last=now;
    const width=field.clientWidth-54,height=field.clientHeight-54;
    for(const orb of orbs){
      orb.vy+=.17*step;orb.x+=orb.vx*step;orb.y+=orb.vy*step;
    }
    // Equal-mass elastic collisions: separate overlapping balls, then exchange
    // the component of their velocity along the impact axis.
    for(let pass=0;pass<2;pass++)for(let i=0;i<orbs.length;i++)for(let j=i+1;j<orbs.length;j++){
      const a=orbs[i],b=orbs[j],dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy);
      if(distance>=54)continue;
      const nx=distance?dx/distance:1,ny=distance?dy/distance:0,overlap=(54-distance)/2;
      a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
      const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
      if(relative<0){const impulse=-(1+.9)*relative/2;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;}
    }
    for(const orb of orbs){
      if(orb.x<0||orb.x>width){orb.x=Math.max(0,Math.min(width,orb.x));orb.vx*=-.82;}
      if(orb.y<0||orb.y>height){orb.y=Math.max(0,Math.min(height,orb.y));orb.vy*=-.78;orb.vx*=.97;}
      orb.node.style.transform=`translate3d(${orb.x}px,${orb.y}px,0)`;
    }
    frameId=requestAnimationFrame(frame);
  };
  if(!reducedMotion)frameId=requestAnimationFrame(frame);
  field.addEventListener('click',event=>{
    if(!active||complete)return;
    const rect=field.getBoundingClientRect();
    const x=event.detail?event.clientX-rect.left:rect.width/2,y=event.detail?event.clientY-rect.top:rect.height/2;
    const burst=document.createElement('span');burst.className='rest-ripple';burst.style.left=`${x}px`;burst.style.top=`${y}px`;field.append(burst);burst.addEventListener('animationend',()=>burst.remove(),{once:true});
    for(let i=0;i<9;i++){
      const spark=document.createElement('span');spark.className='rest-spark';spark.style.left=`${x}px`;spark.style.top=`${y}px`;
      spark.style.setProperty('--dx',`${(Math.random()-.5)*180}px`);spark.style.setProperty('--dy',`${(Math.random()-.7)*145}px`);
      field.append(spark);spark.addEventListener('animationend',()=>spark.remove(),{once:true});
    }
    for(const orb of orbs){const dx=orb.x+27-x,dy=orb.y+27-y,distance=Math.max(28,Math.hypot(dx,dy));const force=4+100/(distance+20);orb.vx+=dx/distance*force+(Math.random()-.5)*2;orb.vy+=dy/distance*force-9;}
    pops++;$('rest-pips').children[pops-1].classList.add('filled');$('utility-status').textContent=`${pops} / 6 жмяков · ${pops===6?'силы вернулись!':'никаких ошибок'}`;
    tone(pops===6?'perfect':'tap');
    if(pops===6){complete=true;field.disabled=true;timer=setTimeout(()=>{if(!active)return;active=false;closeModal();apply(rest(state),{eventEligible:true});},850);}
  });
  cleanup=()=>{active=false;cancelAnimationFrame(frameId);clearTimeout(timer);};
}
function startWorkGame(){
  if(working||battle)return;
  if(state.energy<12){toast('Сначала передохни: для работы нужно 12 энергии.',true);return;}
  working=true;
  const weights=[5,10,15,20,25];
  const plates=shuffled(weights);
  const minimum=20+state.gym*15,maximum=35+state.gym*15;
  modal(`<div class="dialog-body utility-game work-game">${modalTop('ПОДРАБОТКА · −12 ЭНЕРГИИ')}<h2 id="dialog-title">РАЗЛОЖИ БЛИНЫ, БРАТ.</h2><p class="dialog-copy">Нажимай на блины от лёгкого к тяжёлому. За ошибки тренер урежет премию.</p><p class="training-reward">ОПЛАТА ${minimum}–${maximum} ₽ · ПОСЛЕ ЗАВЕРШЕНИЯ</p><div class="plate-rack">${plates.map(weight=>`<button type="button" class="work-plate" data-weight="${weight}" aria-label="Блин ${weight} килограммов"><span>${weight}</span><small>кг</small></button>`).join('')}</div><div class="utility-game-status" id="utility-status" role="status">Следующий: 5 кг · ошибок: 0</div></div>`,'utility');
  let next=0,errors=0,active=true,timer=0;
  const finish=()=>{if(!active)return;active=false;closeModal();apply(work(state,Math.max(0,1-errors*.2)),{eventEligible:true});tone('perfect');};
  document.querySelectorAll('.work-plate').forEach(button=>button.addEventListener('click',()=>{
    if(!active||button.disabled)return;
    if(Number(button.dataset.weight)!==weights[next]){
      errors++;tone('error');button.classList.remove('wrong');void button.offsetWidth;button.classList.add('wrong');
      $('utility-status').textContent=`Ищи ${weights[next]} кг · ошибок: ${errors}`;
      return;
    }
    button.classList.add('stacked');button.disabled=true;next++;tone();
    $('utility-status').textContent=next===weights.length?`Все блины на месте · ошибок: ${errors}`:`Следующий: ${weights[next]} кг · ошибок: ${errors}`;
    if(next===weights.length)timer=setTimeout(finish,420);
  }));
  cleanup=()=>{active=false;clearTimeout(timer);};
}
function startFight(){if(working||battle)return;const result=beginFight(state);if(result.error){toast(result.error,true);return;}battle=result.battle;state=result.state;persist();render();roundLock=false;fightView();tone('hit');}
function fightLogMarkup(current,message=''){
  const last=current.history.at(-1);
  if(!last)return `<div class="fight-log-placeholder">${esc(message||'Лови бегунок в узкой зелёной зоне и атакуй.')}</div>`;
  if(last.move!=='attack')return '<div class="fight-log-placeholder">Бой продолжен по новым правилам. Теперь на ковре одна атака — лови зелёную зону.</div>';
  const damage=value=>Math.max(0,Number.isFinite(value)?Math.round(value):0);
  const dealt=damage(last.playerDamage),received=damage(last.enemyDamage);
  const outcome=last.winded?'ВЫДОХСЯ':last.timingGrade==='perfect'?'ИДЕАЛЬНЫЙ ТАЙМИНГ':last.timingGrade==='good'?(last.damageMultiplier===undefined?'ПОПАДАНИЕ':'СРЕДНЯЯ СИЛА'):last.timingGrade==='weak'?'СЛАБАЯ СИЛА':'МИМО ЗОНЫ';
  const timing=last.winded?'Сил не хватило на удар: ход восстановил запас, соперник ответил.':last.timingGrade==='perfect'?'В яблочко: 100% урона, ответ слабее.':last.timingGrade==='good'?(last.damageMultiplier===undefined?'Бегунок был в зоне: атака прошла.':'Средняя зона: ⅔ урона.'):last.timingGrade==='weak'?'Край зоны: ⅓ урона.':'Вне зоны: атака не нанесла урон, соперник ответил.';
  const stamina=Number.isFinite(last.staminaDelta)?` · ${last.staminaDelta>=0?'+':'−'}${Math.abs(Math.round(last.staminaDelta))} сил`:'';
  return `<div class="fight-log-summary"><span>РАУНД ${damage(last.round)} · АТАКА</span><strong>${outcome}</strong></div><div class="fight-log-stats"><div class="fight-log-stat dealt"><span>СОПЕРНИК ПОТЕРЯЛ</span><strong>${dealt?'−':''}${dealt}</strong><small>здоровья</small></div><div class="fight-log-stat received"><span>ТЫ ПОТЕРЯЛ</span><strong>${received?'−':''}${received}</strong><small>здоровья</small></div></div><div class="fight-log-note">${timing}${stamina}</div>`;
}
function exchangeLine(side,damage,note){
  const label=side==='player'?'ТВОЯ АТАКА':'ОТВЕТ СОПЕРНИКА';
  return `<div class="exchange-line ${side}"><span>${label}</span><strong>${damage>0?`−${damage}`:'0'} урона</strong><small>${esc(note)}</small></div>`;
}
function floatDamage(side,damage,note){
  const popup=$(`${side}-damage`);
  if(!popup)return;
  popup.textContent=`${damage>0?`−${damage}`:'0'} · ${note}`;
  popup.className=`damage-float visible ${damage>0?'landed':'zero'}`;
  void popup.offsetWidth;
  popup.classList.add('rise');
}
function updateFightMeter(side,hp,max){
  $(`${side}-hp-value`).textContent=`${hp} / ${max}`;
  $(`${side}-hp-bar`).style.width=`${Math.max(0,Math.min(100,hp/max*100))}%`;
}
function fightView(message=''){
  if(!battle)return;
  const r=RIVALS.find(x=>x.id===battle.rivalId);
  if(!r)return;
  const timingWindow=fightTimingWindow(state,battle),preview=fightMovePreview(state,battle,'attack');
  const maxStamina=battle.maxStamina||fightMaxStamina(state),enemyMaxHp=battle.enemyMaxHp||100;
  const staminaPct=Math.max(0,Math.min(100,battle.playerStamina/maxStamina*100));
  const enemyHpPct=Math.max(0,Math.min(100,battle.enemyHp/enemyMaxHp*100));
  modal(`<div class="dialog-body">${modalTop(`КОВЁР · РАУНД ${Math.min(10,battle.round+1)} / 10`,false)}<h2 id="dialog-title">${esc(r.name.toUpperCase())}</h2><p class="muted">«${esc(r.quote)}»</p><div class="fight-stage"><div><div class="fighter-image player" id="player-fighter" style="background-image:url('${heroPath(state)}')"><span>ТЫ</span></div><div class="hp-meter"><span class="damage-float" id="player-damage" aria-hidden="true"></span><div class="hp-label"><span>ЗДОРОВЬЕ</span><strong id="player-hp-value">${battle.playerHp} / 100</strong></div><div class="hp-track"><i id="player-hp-bar" style="width:${battle.playerHp}%"></i></div></div></div><span class="vs">VS</span><div><button type="button" class="fighter-image enemy portrait-trigger" id="enemy-fighter" data-rival-image="${r.id}" style="${fightSpriteStyle(r.portrait)}" aria-label="Увеличить фото ${esc(r.name)}"><span>${esc(r.name)}</span></button><div class="hp-meter"><span class="damage-float" id="enemy-damage" aria-hidden="true"></span><div class="hp-label"><span>ЗДОРОВЬЕ СОПЕРНИКА</span><strong id="enemy-hp-value">${battle.enemyHp} / ${enemyMaxHp}</strong></div><div class="hp-track enemy-bar"><i id="enemy-hp-bar" style="width:${enemyHpPct}%"></i></div></div></div></div><div class="fight-tip"><strong>Сила ${state.strength}</strong> бьёт · <strong>Техника ${state.technique}</strong> расширяет зону · <strong>Выносливость ${state.endurance}</strong> даёт запас сил.</div><div class="stamina-meter" id="fight-stamina" role="progressbar" aria-label="Запас сил" aria-valuemin="0" aria-valuemax="${maxStamina}" aria-valuenow="${battle.playerStamina}"><div class="stamina-label"><span>ЗАПАС СИЛ</span><strong id="fight-stamina-value">${battle.playerStamina} / ${maxStamina}</strong></div><div class="stamina-track ${staminaPct<25?'low':''}"><i id="fight-stamina-bar" style="width:${staminaPct}%"></i></div></div><div class="timing-caption fight-timing-caption">ЦЕНТР 100% · СЕРЕДИНА ⅔ · КРАЙ ⅓ · МИМО 0</div><div class="timing-track fight-timing-track" role="img" aria-label="Зона атаки: яркий центр — 100 процентов урона, средние части — две трети, блеклые края — одна треть, вне зоны — промах" style="height:20px;margin:10px 0 15px"><div class="timing-zone fight-timing-zone" style="left:${(0.5-timingWindow)*100}%;width:${timingWindow*200}%"></div><i class="timing-marker" id="fight-marker"></i></div><button class="primary-button attack-button" data-move="attack" ${roundLock?'disabled':''}><span><strong>АТАКОВАТЬ</strong><small>${preview?.winded?`Выдохся: +${preview.staminaDelta} сил, без урона`:`В центр: ${preview?.maxDamage??0} урона · −${preview?.staminaCost??18} сил`}</small></span><kbd>ПРОБЕЛ</kbd></button><div class="fight-log" id="fight-log" aria-live="polite">${fightLogMarkup(battle,message)}</div><div class="battle-hint">${battle.playerStamina<18?'Сил меньше 18: следующая атака восстановит запас, но не нанесёт урон.':'На 10-м раунде побеждает тот, у кого осталось больше здоровья.'}</div><button class="text-button" id="surrender-button" style="margin-top:15px">Сдаться и вернуться к железу</button></div>`,'fight');
  $('dialog-content').querySelector('[data-move="attack"]')?.focus({preventScroll:true});
  const started=performance.now(),period=Math.max(390,610-state.gym*42-(state.wins%3===2?30:0)-battle.round*5);
  let stop=false;
  const frame=()=>{if(stop)return;const marker=$('fight-marker');if(marker)marker.style.left=`${(1-Math.cos((performance.now()-started)/period))*50}%`;tickFrame=requestAnimationFrame(frame);};
  cleanup=()=>{stop=true;cancelAnimationFrame(tickFrame);};tickFrame=requestAnimationFrame(frame);
}
function makeMove(move){
  if(!battle||battle.finished||roundLock)return;
  const timing=Number.parseFloat($('fight-marker')?.style.left||'50')/100;
  const previous=battle,oldGym=state.gym,r=RIVALS.find(x=>x.id===battle.rivalId);
  const result=fightTurn(state,battle,move,timing);
  if(result.error){toast(result.error,true);return;}
  roundLock=true;
  cleanup?.();cleanup=null;
  battle=result.battle;state=result.state;persist();
  document.querySelectorAll('[data-move]').forEach(button=>button.disabled=true);
  $('surrender-button').disabled=true;
  const turn=result.turn,maxStamina=battle.maxStamina||fightMaxStamina(state);
  const timingNotes={perfect:'В яблочко · 100%',good:'Средняя зона · ⅔',weak:'Край зоны · ⅓',miss:'Мимо зоны',winded:'Сил не хватило'};
  const staminaNote=`${turn.staminaDelta>=0?'+':'−'}${Math.abs(turn.staminaDelta)} сил`;
  $('fight-log').innerHTML=exchangeLine('player',turn.playerDamage,`${timingNotes[turn.timingGrade]||'Атака'} · ${staminaNote}`);
  $('player-fighter').classList.add('strike-forward');
  $('enemy-fighter').classList.add(turn.playerDamage>0?'take-hit':'evade-hit');
  floatDamage('enemy',turn.playerDamage,turn.winded?'НЕТ СИЛ':turn.playerDamage?'УРОН':'МИМО');
  updateFightMeter('enemy',battle.enemyHp,battle.enemyMaxHp||100);
  $('fight-stamina-value').textContent=`${battle.playerStamina} / ${maxStamina} (${staminaNote})`;
  $('fight-stamina').setAttribute('aria-valuenow',String(battle.playerStamina));
  $('fight-stamina-bar').style.width=`${Math.max(0,Math.min(100,battle.playerStamina/maxStamina*100))}%`;
  $('fight-stamina-bar').parentElement.classList.toggle('low',battle.playerStamina/maxStamina<.25);
  tone(turn.playerDamage>0?'perfect':'tap');
  setTimeout(()=>{
    if(modalKind!=='fight')return;
    $('player-fighter').classList.remove('strike-forward');
    $('enemy-fighter').classList.remove('take-hit','evade-hit');
    if(turn.enemyDamage>0){
      $('enemy-fighter').classList.add('strike-back');
      $('player-fighter').classList.add('take-hit');
      tone('hit');
    }
    floatDamage('player',turn.enemyDamage,turn.enemyDamage?'УРОН':'НЕ ОТВЕТИЛ');
    updateFightMeter('player',battle.playerHp,100);
    $('fight-log').insertAdjacentHTML('beforeend',exchangeLine('enemy',turn.enemyDamage,turn.enemyDamage?'Соперник атаковал':'Соперник повержен и не ответил'));
  },800);
  setTimeout(()=>{
    roundLock=false;
    if(battle?.finished){
      const win=battle.result==='win';battle=null;persist();render();showFightResult(win,r,oldGym,result.message);
    }else if(battle)fightView(result.message);
  },1900);
}
function showFightResult(win,r,oldGym,message){if(state.won){showVictory();return;}modal(`<div class="dialog-body">${modalTop(win?'АВТОРИТЕТ ПОЛУЧЕН':'ПРОСТО РАЗМИНКА',false)}<h2 id="dialog-title" class="victory-heading" style="color:${win?'var(--gold)':'var(--muted)'}">${win?'ТВОЯ ВЗЯЛА.':'ЕЩЁ ВСТРЕТИМСЯ.'}</h2><p class="dialog-copy" style="text-align:center">${esc(win?r.winQuote:'Тебя положили на лопатки. Самооценку поднимешь жимом.')}<br>${esc(message)}</p>${win?`<div class="result-stats"><div><strong>+${r.reward} ₽</strong><span>в кассу</span></div><div><strong>${state.wins} / 12</strong><span>соперников позади</span></div><div><strong>${power(state)}</strong><span>твоя мощь</span></div></div>`:''}${state.gym>oldGym?`<div class="gym-panorama travel-panorama" style="--gym-position:${position(state.gym)}" role="img" aria-label="${esc(GYMS[state.gym].name)}"></div><div class="telegraph"><strong>НОВЫЙ ЗАЛ: ${esc(GYMS[state.gym].name.toUpperCase())}</strong><br>${esc(GYMS[state.gym].description)}</div>`:''}<button class="primary-button" data-close>${win?'ДАЛЬШЕ — БОЛЬШЕ':'ПОЙДУ ПОДКАЧАЮСЬ'} <span>↗</span></button></div>`,'result');if(win){tone('win');confetti(28);}}
const victoryTrack=new Audio('./assets/victory-theme.mp3');
victoryTrack.preload='none';
victoryTrack.volume=.8;
function updateVictoryMusic(message){
  if(modalKind!=='victory')return;
  const button=$('victory-music-toggle'),status=$('victory-music-status');
  if(!button||!status)return;
  const playing=!victoryTrack.paused&&!victoryTrack.ended;
  button.textContent=playing?'❚❚ ПАУЗА':victoryTrack.ended?'♫ СЫГРАТЬ ЕЩЁ РАЗ':'♫ ВКЛЮЧИТЬ ПЕСНЮ';
  button.setAttribute('aria-pressed',String(playing));
  status.textContent=message??(playing?'Играет: bo Pistolet — «Удели 40–45 минут»':victoryTrack.ended?'Трек закончился. Можно включить ещё раз.':'Песня на паузе.');
}
function playVictoryMusic(restart=false){
  if(restart||victoryTrack.ended)victoryTrack.currentTime=0;
  updateVictoryMusic('Включаем саундтрек победы…');
  void victoryTrack.play().catch(()=>updateVictoryMusic('Браузер ждёт нажатия. Включи песню кнопкой.'));
}
for(const event of ['play','pause','ended'])victoryTrack.addEventListener(event,()=>updateVictoryMusic());
victoryTrack.addEventListener('error',()=>updateVictoryMusic('Не удалось загрузить песню.'));
function showVictory(){
  modal(`<div class="dialog-body victory-screen">${modalTop('ВСЕ 12 СОПЕРНИКОВ ПОБЕЖДЕНЫ')}<h2 id="dialog-title" class="victory-heading">BOSS OF THIS GYM.</h2><div class="victory-music"><button type="button" id="victory-music-toggle" class="victory-music-button" aria-pressed="false">♫ ВКЛЮЧИТЬ ПЕСНЮ</button><p id="victory-music-status" role="status">Саундтрек победы</p></div><div class="victory-scene"><img class="victory-photo" src="./assets/victory-scene.jpg" alt="Ты стоишь перед золотым троном; качки вокруг восхищаются, кланяются и завидуют"></div><p class="dialog-copy" style="text-align:center">Ты пришёл сюда мешать воздух. Теперь воздух спрашивает у тебя разрешения.<br><strong>Гигабатя отдаёт тебе трон. И ключ от раздевалки.</strong></p><div class="result-stats"><div><strong>${state.workouts}</strong><span>подходов</span></div><div><strong>${Math.max(1,Math.round(state.playSeconds/60))} мин</strong><span>до легенды</span></div><div><strong>${state.respect}</strong><span>уважения</span></div></div><button class="primary-button" data-close>ОСТАТЬСЯ В СВОЁМ ЗАЛЕ <span>♛</span></button><p class="muted" style="text-align:center;margin-top:16px">Блины после себя всё равно убери.</p></div>`,'victory');
  tone('win');
  confetti(70,true);
  const celebrationTimer=matchMedia('(prefers-reduced-motion: reduce)').matches?0:setInterval(()=>confetti(16,true),1800);
  cleanup=()=>{
    clearInterval(celebrationTimer);
    document.querySelectorAll('.victory-spark').forEach(spark=>spark.remove());
    victoryTrack.pause();
    victoryTrack.currentTime=0;
  };
  playVictoryMusic(true);
}
function confetti(count,victory=false){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;for(let i=0;i<count;i++){const el=document.createElement('i');el.className=`celebration-spark${victory?' victory-spark':''}`;el.style.left=`${Math.random()*100}%`;el.style.background=['#ff653b','#8ddbcc','#e4b56d','#f0f1e8'][i%4];el.style.animationDelay=`${Math.random()*.6}s`;el.style.setProperty('--drift',`${(Math.random()-.5)*260}px`);($('game-dialog').open?$('game-dialog'):document.body).append(el);setTimeout(()=>el.remove(),3600);}}
function resetPrompt(){modal(`<div class="dialog-body">${modalTop('СНОВА В ПОДВАЛ')}<h2 id="dialog-title">СБРОСИТЬ ВЕСЬ ПРОГРЕСС?</h2><p class="dialog-copy">Победы, мышцы и покупки исчезнут. Снова останутся только шорты и надежда.</p><div class="dialog-actions"><button class="secondary-button" data-close>Сохранить мышцы</button><button class="primary-button" id="confirm-reset">НАЧАТЬ ЗАНОВО</button></div></div>`);}

document.addEventListener('keydown',ev=>{if(ev.code!=='Space'||modalKind!=='fight'||ev.repeat)return;if(document.activeElement?.closest?.('#surrender-button, #enemy-fighter'))return;ev.preventDefault();makeMove('attack');});
function resetGame(){
  cleanup?.();
  battle=null;
  clearTimeout(gainsTimer);
  clearTimeout(heroGainsTimer);
  $('floating-gains').textContent='';
  $('floating-gains').classList.remove('gain-pop');
  recentGains=null;
  recentTrainingKind=null;
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
    case 'rest-button': startRestGame();break;
    case 'work-button': startWorkGame();break;
    case 'fight-button': startFight();break;
    case 'victory-button': showVictory();break;
    case 'victory-music-toggle': if(victoryTrack.paused)playVictoryMusic();else victoryTrack.pause();break;
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
setTimeout(()=>{const img=new Image();img.src=`./assets/hero-${Math.min(3,heroStage(state)+1)}.jpg?v=fullbody`;},2500);

const context=document.modelContext;
if(context?.registerTool){const controller=new AbortController();const tools=[{name:'get_gym_progress',title:'Прогресс в GYM BOSS',description:'Read the current character stats, resources, next opponent and campaign progress.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async input=>{if(input&&Object.keys(input).length)throw new Error('No arguments expected');return {gym:GYMS[state.gym].name,wins:state.wins,power:power(state),energy:state.energy,money:state.money,stats:Object.fromEntries(Object.keys(stats).map(k=>[k,state[k]])),nextRival:nextRival(state)?.name??null,won:state.won};}},{name:'open_gym_section',title:'Открыть раздел игры',description:'Open training, wrestling, equipment shop or opponent progression without completing an action.',inputSchema:{type:'object',properties:{section:{type:'string',enum:['gym','fight','shop','road']}},required:['section'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{if(!input||Object.keys(input).some(k=>k!=='section')||!['gym','fight','shop','road'].includes(input.section))throw new Error('Expected section: gym, fight, shop, or road');if(modalKind)throw new Error('Close the current activity first');tab=input.section;render();return {section:tab};}}];for(const tool of tools){try{void Promise.resolve(context.registerTool(tool,{signal:controller.signal})).catch(()=>{});}catch{}}window.addEventListener('pagehide',()=>controller.abort(),{once:true});}
