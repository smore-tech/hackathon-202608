/** 「見えない迷路」の画面。迷路の生成・判定は logic.js 側。 */
import {
  STAGES, MODES, stageById, modeOf, findMaze, tryMove, requiredSteps, keyCell,
  randomSeed, scoreOf, rateStars,
} from './logic.js';
import * as Share from '../shared/url-codec.js';
import { Progress } from '../shared/storage.js';
import { $, starGlyphs, setBanner, showNotice, makeTabs, isTypingTarget } from '../shared/ui.js';

const progress = new Progress('maze');
const LEVEL_LABEL = { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD' };

let stage = STAGES[0];
let mode = modeOf(stage);
let maze = null;
let need = 0;
let key = null;
let hasKey = false;
let pos = { r: 0, c: 0 };
let phase = 'ready';                  // ready | peek | play | clear | over
let stats = { steps: 0, miss: 0 };
let timerId = null, startedAt = 0, peekTimers = [];

const cellAt = (r, c) => document.getElementById(`m${r}-${c}`);

/* ==================== 迷路の描画 ==================== */

function buildMaze(){
  const { rows, cols } = maze;
  $('maze').style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;
  $('maze').innerHTML = '';
  for (let r = 0; r < rows; r++){
    for (let c = 0; c < cols; c++){
      const d = document.createElement('div');
      d.className = 'cell';
      d.id = `m${r}-${c}`;
      $('maze').appendChild(d);
    }
  }
  paintItems();
  movePlayerTo(0, 0, true);
}

function paintItems(){
  const goal = cellAt(maze.rows - 1, maze.cols - 1);
  goal.textContent = mode.key && !hasKey ? '🔒' : '🏁';
  if (mode.key && key){
    const k = cellAt(key.r, key.c);
    if (k) k.textContent = hasKey ? '' : '🔑';
  }
}

function showWalls(on){
  const { rows, cols, v, h } = maze;
  for (let r = 0; r < rows; r++){
    for (let c = 0; c < cols; c++){
      const d = cellAt(r, c);
      d.classList.toggle('wr', on && c < cols - 1 && v[r][c]);
      d.classList.toggle('wb', on && r < rows - 1 && h[r][c]);
    }
  }
}

function clearRevealed(){
  $('maze').querySelectorAll('.hr,.hb,.visited').forEach(d => d.classList.remove('hr', 'hb', 'visited'));
}

function movePlayerTo(r, c, instant){
  pos = { r, c };
  const cell = cellAt(r, c);
  if (!cell) return;
  $('player').style.transition = instant ? 'none' : '';
  $('player').style.transform = `translate(${cell.offsetLeft}px, ${cell.offsetTop}px)`;
  if (instant) requestAnimationFrame(() => { $('player').style.transition = ''; });
}

/* ==================== ステージ ==================== */

function renderStageHeader(){
  const no = STAGES.indexOf(stage) + 1;
  $('chNo').textContent = `STAGE ${no}`;
  $('chNo').className = 'badge ' + stage.level;
  $('chName').textContent = stage.name;
  $('chMode').textContent = `${mode.label}｜${mode.desc}`;
  $('prevStage').disabled = no <= 1;
  $('nextStage').disabled = no >= STAGES.length;
  $('livesWrap').hidden = !mode.lives;
}

function loadStage(next, seed){
  stage = next;
  mode = modeOf(stage);
  maze = findMaze(stage, Number.isInteger(seed) && seed > 0 ? seed : randomSeed());
  need = requiredSteps(maze, mode);
  key = mode.key ? keyCell(maze) : null;
  hasKey = false;
  $('seed').textContent = maze.seed;
  $('need').textContent = need;
  renderStageHeader();
  buildMaze();
  resetRun();
  renderStageList();
  $('shareOut').hidden = true;
  $('copyStatus').textContent = '';
}

function openStage(no, seed){
  const next = STAGES[no - 1];
  if (!next) return;
  Share.clearHash();
  $('notice').hidden = true;
  loadStage(next, seed);
  switchTab('play');
}

/* ==================== 進行 ==================== */

function clearTimers(){
  peekTimers.forEach(clearTimeout);
  peekTimers = [];
  clearInterval(timerId);
  timerId = null;
}

function resetRun(){
  clearTimers();
  phase = 'ready';
  stats = { steps: 0, miss: 0 };
  hasKey = false;
  $('steps').textContent = '0';
  $('miss').textContent = '0';
  $('time').textContent = '0.0';
  $('lives').textContent = '♥'.repeat(mode.lives);
  $('countdown').textContent = '';
  clearRevealed();
  showWalls(false);   // STARTを押すまで壁は見せない（見放題だと記憶ゲームにならない）
  paintItems();
  movePlayerTo(0, 0, true);
  $('start').disabled = false;
  setBanner($('banner'), '',
    mode.key ? 'STARTで数秒だけ壁が見える。🔑 を拾って 🏁 へ。' : 'STARTで数秒だけ壁が見える。覚えて 🏁 まで進め。');
}

function startRun(){
  if (phase === 'peek' || phase === 'play') return;
  resetRun();
  phase = 'peek';
  $('start').disabled = true;
  showWalls(true);
  setBanner($('banner'), '', '👀 覚えろ！');

  const total = Math.round(stage.peek / 1000);
  for (let i = 0; i < total; i++){
    peekTimers.push(setTimeout(() => { $('countdown').textContent = String(total - i); }, i * 1000));
  }
  $('countdown').textContent = String(total);

  peekTimers.push(setTimeout(() => {
    $('countdown').textContent = '';
    showWalls(false);
    phase = 'play';
    startedAt = Date.now();
    timerId = setInterval(() => {
      $('time').textContent = ((Date.now() - startedAt) / 1000).toFixed(1);
    }, 100);
    setBanner($('banner'), '', '🚶 GO! 記憶を頼りに進め。');
  }, stage.peek));
}

function move(dir){
  if (phase !== 'play') return;
  const res = tryMove(maze, pos.r, pos.c, dir);
  const here = cellAt(pos.r, pos.c);

  if (!res.ok){
    stats.miss++;
    $('miss').textContent = stats.miss;
    here.classList.add('bump');
    setTimeout(() => here.classList.remove('bump'), 200);
    // ぶつかった壁だけは以後ずっと見えるようにする（当たった記憶を可視化）
    if (res.wall){
      const w = cellAt(res.wall.r, res.wall.c);
      w.classList.add(res.wall.type === 'v' ? 'hr' : 'hb');
    }
    if (mode.lives){
      const left = mode.lives - stats.miss;
      $('lives').textContent = '♥'.repeat(Math.max(0, left));
      if (left <= 0) return gameOver();
      setBanner($('banner'), 'ng', `🧱 壁！ 残りライフ ${left}`);
    } else {
      setBanner($('banner'), 'ng', '🧱 壁！ そっちじゃない。');
    }
    return;
  }

  here.classList.add('visited');
  stats.steps++;
  $('steps').textContent = stats.steps;
  movePlayerTo(res.r, res.c, false);

  if (mode.key && !hasKey && key && res.r === key.r && res.c === key.c){
    hasKey = true;
    paintItems();
    setBanner($('banner'), 'ok', '🔑 鍵を手に入れた！ 🏁 へ向かえ。');
    return;
  }
  if (res.r === maze.rows - 1 && res.c === maze.cols - 1){
    if (mode.key && !hasKey){
      setBanner($('banner'), 'ng', '🔒 鍵がない。先に 🔑 を拾ってくること。');
      return;
    }
    return finish();
  }
  if ($('banner').classList.contains('ng')) setBanner($('banner'), '', '🚶 GO! 記憶を頼りに進め。');
}

function finish(){
  phase = 'clear';
  clearTimers();
  const sec = ((Date.now() - startedAt) / 1000).toFixed(1);
  $('time').textContent = sec;
  showWalls(true);   // 答え合わせ

  const score = scoreOf(stats.steps, stats.miss);
  const stars = rateStars(stats.steps, stats.miss, need);
  const { isBest, prevBest } = progress.record(stage.id, score, stars);
  const note = isBest
    ? (prevBest === null ? '🆕 初クリア！' : `🏆 ベスト更新！ ${prevBest} → ${score}`)
    : `BEST ${progress.get(stage.id).best}`;

  setBanner($('banner'), 'ok',
    `🏁 CLEAR! ${'★'.repeat(stars)}  移動 ${stats.steps}（最短 ${need}）／壁ドン ${stats.miss}／${sec} 秒 ／ SCORE ${score} — ${note}`);
  $('start').disabled = false;
  renderStageList(); updateHud();
}

function gameOver(){
  phase = 'over';
  clearTimers();
  showWalls(true);
  setBanner($('banner'), 'ng', `💥 GAME OVER — 壁ドン ${stats.miss} 回。もう一度どうぞ。`);
  $('start').disabled = false;
}

/* ==================== ステージ一覧 ==================== */

function renderStageList(){
  const list = $('stageList');
  list.innerHTML = '';
  ['easy', 'medium', 'hard'].forEach(level => {
    const inLevel = STAGES.filter(s => s.level === level);
    if (!inLevel.length) return;
    const head = document.createElement('div');
    head.className = 'levelhead';
    head.textContent = `// ${LEVEL_LABEL[level]}`;
    list.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'stagegrid';
    inLevel.forEach(s => {
      const rec = progress.get(s.id);
      const no = STAGES.indexOf(s) + 1;
      const card = document.createElement('button');
      card.className = 'stagecard' + (rec ? ' cleared' : '') + (stage.id === s.id ? ' on' : '');
      card.innerHTML = `
        <span class="no">STAGE ${String(no).padStart(2, '0')} · ${MODES[s.mode].label}</span>
        <span class="nm">${s.name}</span>
        <span class="st stars">${rec ? starGlyphs(rec.stars) : '<span class="off">★★★</span>'}</span>
        <span class="bs">${rec ? `BEST ${rec.best}` : `${s.rows}×${s.cols} / ${Math.round(s.peek / 1000)}秒`}</span>`;
      card.addEventListener('click', () => openStage(no));
      grid.appendChild(card);
    });
    list.appendChild(grid);
  });
}

function updateHud(){
  $('hudCleared').textContent = progress.clearedCount();
  $('hudTotal').textContent = STAGES.length;
  $('hudStars').textContent = progress.totalStars();
  $('hudStarMax').textContent = STAGES.length * 3;
}

/* ==================== 入力 ==================== */

['up', 'down', 'left', 'right'].forEach(id => $(id).addEventListener('click', () => move(id)));

const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};
window.addEventListener('keydown', e => {
  if (isTypingTarget(e.target) || $('playView').hidden) return;
  const dir = KEYS[e.key] || KEYS[e.key.toLowerCase()];
  if (dir){ e.preventDefault(); move(dir); }
  if (e.key === ' '){ e.preventDefault(); startRun(); }
});

let touch = null;
$('maze').addEventListener('touchstart', e => {
  touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
$('maze').addEventListener('touchend', e => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  touch = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
}, { passive: true });

$('start').addEventListener('click', startRun);
$('retry').addEventListener('click', () => { resetRun(); startRun(); });        // 同じ迷路（seedは変えない）
$('newMaze').addEventListener('click', () => loadStage(stage));                 // 新しい seed
$('prevStage').addEventListener('click', () => openStage(STAGES.indexOf(stage)));
$('nextStage').addEventListener('click', () => openStage(STAGES.indexOf(stage) + 2));
$('share').addEventListener('click', () => {
  Share.setParamsHash({ m: stage.id, seed: maze.seed });
  Share.copyText(Share.paramsUrl({ m: stage.id, seed: maze.seed }), $('shareOut'), $('copyStatus'));
});
$('resetProgress').addEventListener('click', () => {
  if (!confirm('見えない迷路のクリア記録をすべて消します。よろしいですか？')) return;
  progress.reset();
  renderStageList(); updateHud();
});
window.addEventListener('resize', () => movePlayerTo(pos.r, pos.c, true));

/* ==================== タブ ==================== */

const switchTab = makeTabs(
  { stages: $('stagesView'), play: $('playView') },
  { stages: $('tabStages'), play: $('tabPlay') },
  name => {
    if (name === 'stages'){ renderStageList(); updateHud(); }
    if (name === 'play') movePlayerTo(pos.r, pos.c, true);
  },
);

/* ==================== 起動 ==================== */

const params = Share.hashParams();
const sharedStage = stageById(params.get('m'));
const sharedSeed = Number(params.get('seed'));

if (sharedStage && Number.isInteger(sharedSeed) && sharedSeed > 0){
  loadStage(sharedStage, sharedSeed);
  showNotice($('notice'), 'info', `🔗 共有された迷路（${sharedStage.name} / seed ${sharedSeed}）を読み込みました`);
} else {
  const next = STAGES.find(s => !progress.cleared(s.id)) || STAGES[0];
  loadStage(next);
  if (params.get('m') || params.get('seed')){
    showNotice($('notice'), '', '⚠️ 共有URLを解釈できませんでした。通常のステージを読み込みます');
  }
}
updateHud();
renderStageList();
