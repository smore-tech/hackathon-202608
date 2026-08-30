/** 「10秒先を当てる」の画面。戦闘の計算は logic.js が持ち、ここは再生と記録だけ。 */
import { RULES, simulateBattle, currentTargets, traitText, randomBattle, validateBattle } from './logic.js';
import { BATTLES } from './battles.js';
import * as Share from '../shared/url-codec.js';
import { Progress, Stats } from '../shared/storage.js';
import { $, wait, starGlyphs, setBanner, showNotice, makeTabs } from '../shared/ui.js';

const progress = new Progress('future');           // 編成ごとの「何回目で当てたか」
const stats = new Stats('future', { plays: 0, hits: 0, streak: 0, best: 0 });
const LEVEL_LABEL = { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD' };

let battleIndex = 0;         // BATTLES の位置（ランダム編成のときは -1）
let battle = BATTLES[0];
let pick = -1;
let running = false;
let scored = false;
let attempts = 0;            // この編成に何回予想したか
let speed = 1;

/* ==================== 描画 ==================== */

function renderRoster(hps){
  const targets = currentTargets(battle, hps);
  $('roster').innerHTML = '';
  battle.units.forEach((u, i) => {
    const hp = hps[i];
    const ratio = Math.max(0, hp / u.hp);
    const card = document.createElement('div');
    card.className = 'card' + (i === pick ? ' picked' : '') + (hp <= 0 ? ' dead' : '');
    card.id = 'u' + i;
    const t = targets[i];
    const targetText = hp <= 0 ? '' : t === -2 ? '✚ 味方を回復' : t >= 0 ? '🎯 ' + battle.units[t].name : '';
    card.innerHTML = `
      <div class="face">${hp <= 0 ? '💀' : u.face}</div>
      <div class="nm">${u.name}</div>
      <div class="hpbar"><div class="hpfill${ratio <= .3 ? ' low' : ''}" style="width:${ratio * 100}%"></div></div>
      <div class="hpnum"><span class="cur">${Math.max(0, hp)}</span> / ${u.hp}</div>
      <div class="stats"><span>ATK <b>${u.atk}</b></span><span>SPD <b>${u.spd}</b></span></div>
      <div class="trait">${traitText(u.trait)}</div>
      <div class="tgt">${targetText}</div>`;
    card.addEventListener('click', () => choose(i));
    $('roster').appendChild(card);
  });
}

function refreshTargets(hps){
  const targets = currentTargets(battle, hps);
  battle.units.forEach((_, i) => {
    const node = document.getElementById('u' + i);
    if (!node) return;
    const t = targets[i];
    node.querySelector('.tgt').textContent =
      hps[i] <= 0 ? '' : t === -2 ? '✚ 味方を回復' : t >= 0 ? '🎯 ' + battle.units[t].name : '';
  });
}

function renderHud(){
  $('hudName').textContent = battle.name;
  $('hudPick').textContent = pick < 0 ? '—' : battle.units[pick].name;
  $('hudScore').textContent = `${stats.data.hits} / ${stats.data.plays}`;
  $('hudStreak').textContent = stats.data.streak;
  $('hudBest').textContent = stats.data.best;
  const rule = RULES[battle.rule || 'right'];
  $('ruleName').textContent = rule.label;
  $('ruleDesc').textContent = rule.desc;
  $('battleHint').textContent = battle.hint || '';
}

function addLog(html, cls = ''){
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.innerHTML = html;
  $('log').appendChild(line);
  $('log').scrollTop = $('log').scrollHeight;
}

/* ==================== 選択・読み込み ==================== */

function choose(i){
  if (running) return;
  pick = i;
  renderRoster(battle.units.map(u => u.hp));
  renderHud();
  setBanner($('banner'), '', `「${battle.units[i].name}」が最後まで残ると予想。STARTで確かめる。`);
}

function loadBattle(b, index){
  if (running) return;
  battle = b;
  battleIndex = index;
  pick = -1;
  scored = false;
  attempts = 0;
  $('log').innerHTML = '';
  $('shareOut').hidden = true;
  $('copyStatus').textContent = '';
  renderRoster(battle.units.map(u => u.hp));
  renderHud();
  renderBattleList();
  setBanner($('banner'), '', '生き残ると思うキャラをタップして、STARTを押す。');
  $('start').disabled = false;
}

function openBattle(index){
  Share.clearHash();
  $('notice').hidden = true;
  loadBattle(BATTLES[index], index);
  switchTab('play');
}

function loadRandom(seed){
  const s = Number.isInteger(seed) ? seed : Math.floor(Math.random() * 1e9);
  const b = randomBattle(s);
  if (!b){ setBanner($('banner'), 'ng', '編成の生成に失敗しました。もう一度お試しください。'); return; }
  loadBattle(b, -1);
  Share.setParamsHash({ b: b.seed });
  switchTab('play');
}

/* ==================== 再生 ==================== */

async function runBattle(){
  if (running) return;
  if (pick < 0){ setBanner($('banner'), 'ng', 'まず1体を選んでください。'); return; }
  running = true;
  $('start').disabled = true;
  $('log').innerHTML = '';
  attempts++;
  setBanner($('banner'), '', '⚔️ 戦闘開始 — もう手は出せない。');

  const hps = battle.units.map(u => u.hp);
  renderRoster(hps);

  const { events, winner, reason } = simulateBattle(battle);
  // 何手あっても全体が5〜6秒で終わるようにテンポを決める
  const base = Math.max(70, Math.min(300, Math.round(5200 / Math.max(1, events.length))));
  const step = Math.max(12, Math.round(base / speed));

  for (const ev of events){
    hps[ev.target] = ev.hpAfter;
    const A = battle.units[ev.actor], T = battle.units[ev.target];
    const aCard = document.getElementById('u' + ev.actor);
    const tCard = document.getElementById('u' + ev.target);

    if (ev.kind === 'attack'){
      aCard.classList.remove('attacking'); void aCard.offsetWidth; aCard.classList.add('attacking');
    }
    tCard.classList.remove('hurt'); void tCard.offsetWidth;
    if (ev.kind !== 'heal') tCard.classList.add('hurt');

    const fill = tCard.querySelector('.hpfill');
    const ratio = ev.hpAfter / T.hp;
    fill.style.width = (ratio * 100) + '%';
    fill.classList.toggle('low', ratio <= .3);
    tCard.querySelector('.cur').textContent = ev.hpAfter;

    const pop = document.createElement('div');
    pop.className = 'pop' + (ev.kind === 'heal' ? ' heal' : ev.kind === 'thorns' ? ' thorns' : '');
    pop.textContent = (ev.kind === 'heal' ? '+' : '-') + ev.amount;
    tCard.appendChild(pop);
    setTimeout(() => pop.remove(), 700);

    if (ev.kind === 'heal'){
      addLog(`✚ ${A.face} ${A.name} → ${T.face} ${T.name} を <b>${ev.amount}</b> 回復（${ev.hpAfter}）`, 'heal');
    } else if (ev.kind === 'thorns'){
      addLog(`🌵 ${A.face} ${A.name} のとげ → ${T.face} ${T.name} に <b>${ev.amount}</b> 反射（残り ${ev.hpAfter}）`);
    } else {
      addLog(`${A.face} ${A.name} → ${T.face} ${T.name} に <b>${ev.amount}</b> ダメージ（残り ${ev.hpAfter}）`);
    }

    if (ev.ko){
      tCard.classList.add('dead');
      tCard.querySelector('.face').textContent = '💀';
      addLog(`💀 <b>${T.name}</b> 脱落！`, 'ko');
      refreshTargets(hps);
      await wait(step + Math.round(220 / speed));
    } else {
      refreshTargets(hps);
      await wait(step);
    }
  }

  await wait(250);
  const win = winner >= 0 ? battle.units[winner] : null;
  if (win){
    const winCard = document.getElementById('u' + winner);
    if (winCard){
      const crown = document.createElement('div');
      crown.className = 'crown';
      crown.textContent = '👑';
      winCard.appendChild(crown);
    }
    addLog(`👑 <b>${win.name}</b> が生き残った`, 'ko');
  } else {
    addLog(reason === 'timeout' ? '⏳ 決着つかず（膠着）' : '☠️ 全滅', 'ko');
  }

  const hit = winner === pick;
  if (!scored){
    const s = stats.data;
    const streak = hit ? s.streak + 1 : 0;
    stats.update({
      plays: s.plays + 1,
      hits: s.hits + (hit ? 1 : 0),
      streak,
      best: Math.max(s.best, streak),
    });
    if (hit && battle.id){
      // 「何回目で当てたか」を記録。1回目で当てるほど★が多い。
      progress.record(battle.id, attempts, attempts === 1 ? 3 : attempts === 2 ? 2 : 1);
    }
    scored = true;
    renderBattleList();
  }

  setBanner($('banner'), hit ? 'ok' : 'ng',
    hit ? `🎯 的中！ ${win.name} が最後まで残った。`
        : win ? `❌ はずれ。生き残ったのは ${win.name}。なぜ ${battle.units[pick].name} は落ちた？`
              : '❌ はずれ。誰も生き残らなかった。');

  renderHud();
  running = false;
  $('start').disabled = true;
}

/* ==================== 編成一覧 ==================== */

function renderBattleList(){
  const list = $('battleList');
  list.innerHTML = '';
  ['easy', 'medium', 'hard'].forEach(level => {
    const inLevel = BATTLES.filter(b => b.level === level);
    if (!inLevel.length) return;
    const head = document.createElement('div');
    head.className = 'levelhead';
    head.textContent = `// ${LEVEL_LABEL[level]}`;
    list.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'stagegrid';
    inLevel.forEach(b => {
      const rec = progress.get(b.id);
      const no = BATTLES.indexOf(b);
      const card = document.createElement('button');
      card.className = 'stagecard' + (rec ? ' cleared' : '') + (battle.id === b.id ? ' on' : '');
      card.innerHTML = `
        <span class="no">${b.units.length}体 · ${RULES[b.rule || 'right'].label}</span>
        <span class="nm">${b.name}</span>
        <span class="st stars">${rec ? starGlyphs(rec.stars) : '<span class="off">★★★</span>'}</span>
        <span class="bs">${rec ? `${rec.best}回目で的中` : '未的中'}</span>`;
      card.addEventListener('click', () => openBattle(no));
      grid.appendChild(card);
    });
    list.appendChild(grid);
  });
}

function updateListHud(){
  $('hudHit2').textContent = stats.data.hits;
  $('hudTotal2').textContent = stats.data.plays;
  $('hudCleared').textContent = progress.clearedCount();
  $('hudBattles').textContent = BATTLES.length;
}

/* ==================== 操作 ==================== */

$('start').addEventListener('click', runBattle);
$('replay').addEventListener('click', () => {
  if (running || pick < 0){
    if (pick < 0) setBanner($('banner'), 'ng', 'まず1体を選んでください。');
    return;
  }
  renderRoster(battle.units.map(u => u.hp));
  runBattle();
});
$('nextBattle').addEventListener('click', () => {
  if (running) return;
  const next = battleIndex < 0 ? 0 : (battleIndex + 1) % BATTLES.length;
  openBattle(next);
});
$('randomBattle').addEventListener('click', () => { if (!running) loadRandom(); });
$('shareBattle').addEventListener('click', () => {
  const url = battle.seed !== undefined
    ? Share.paramsUrl({ b: battle.seed })
    : Share.paramsUrl({ s: battle.id });
  Share.copyText(url, $('shareOut'), $('copyStatus'));
});
document.querySelectorAll('.speed').forEach(b => b.addEventListener('click', () => {
  speed = Number(b.dataset.speed);
  document.querySelectorAll('.speed').forEach(x => x.classList.toggle('on', x === b));
}));
$('resetProgress').addEventListener('click', () => {
  if (!confirm('予想の記録をすべて消します。よろしいですか？')) return;
  progress.reset(); stats.reset();
  renderBattleList(); updateListHud(); renderHud();
});

/* ==================== タブ ==================== */

const switchTab = makeTabs(
  { list: $('listView'), play: $('playView') },
  { list: $('tabList'), play: $('tabPlay') },
  name => { if (name === 'list'){ renderBattleList(); updateListHud(); } },
);

/* ==================== 起動 ==================== */

const params = Share.hashParams();
const seedParam = Number(params.get('b'));
const idParam = params.get('s');

if (params.get('b') !== null && Number.isInteger(seedParam)){
  const b = randomBattle(seedParam);
  if (b && !validateBattle(b)){
    loadBattle(b, -1);
    showNotice($('notice'), 'info', `🔗 共有された編成（seed ${b.seed}）を読み込みました`);
  } else {
    loadBattle(BATTLES[0], 0);
    showNotice($('notice'), '', '⚠️ 共有された編成を復元できませんでした');
  }
} else if (idParam){
  const at = BATTLES.findIndex(b => b.id === idParam);
  if (at >= 0){
    loadBattle(BATTLES[at], at);
    showNotice($('notice'), 'info', '🔗 共有された編成を読み込みました');
  } else {
    loadBattle(BATTLES[0], 0);
    showNotice($('notice'), '', '⚠️ その編成は見つかりませんでした');
  }
} else {
  // まだ的中していない編成から始める
  const at = BATTLES.findIndex(b => !progress.cleared(b.id));
  loadBattle(BATTLES[at < 0 ? 0 : at], at < 0 ? 0 : at);
}
updateListHud();
renderBattleList();
