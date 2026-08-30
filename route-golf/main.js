/** ROUTE GOLF の画面。ゲームロジックは logic.js 側にあり、ここはDOM操作だけを持つ。 */
import {
  TYPE, DIR_GLYPH, MAX_PROGRAM, MAX_STARS, MIN_SIZE, MAX_SIZE,
  applyCommand, initialState, isGoalState, starList, optimalCommands,
  rateStars, validateChallenge, clone,
} from './logic.js';
import { buildStages } from './stages.js';
import * as Share from '../shared/url-codec.js';
import { Progress } from '../shared/storage.js';
import { $, wait, starGlyphs, setResult, showNotice, makeTabs, isTypingTarget } from '../shared/ui.js';

const STAGES = buildStages();
const progress = new Progress('route');
const LEVEL_LABEL = { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD' };

/* ==================== 状態 ==================== */

let stage = null;          // 内蔵ステージ（URL共有の Challenge を遊んでいるときは null）
let challenge = null;
let optimal = 0;
let program = [];
let state = null;
let execIndex = 0;
let finished = false;
let running = false;
let lastResult = null;

/* ==================== 盤面 ==================== */

function paintBoard(container, ch, opts = {}){
  container.style.gridTemplateColumns = `repeat(${ch.w}, var(--cell))`;
  const robotEl = container.querySelector('#robot');
  container.innerHTML = '';
  if (robotEl) container.appendChild(robotEl);
  const stars = starList(ch);
  for (let r = 0; r < ch.h; r++){
    for (let c = 0; c < ch.w; c++){
      const i = r * ch.w + c;
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r; cell.dataset.c = c; cell.dataset.i = i;
      if (ch.walls.includes(i)) cell.classList.add('wall');
      if (stars.includes(i)){ cell.classList.add('star'); cell.textContent = '★'; }
      if (r === ch.gr && c === ch.gc){ cell.classList.add('goal'); cell.textContent = '🏁'; }
      if (r === ch.sr && c === ch.sc){
        cell.classList.add('startmark');
        if (opts.showStartGlyph) cell.textContent = DIR_GLYPH[ch.sd];
      }
      container.appendChild(cell);
    }
  }
}

const cellIn = (container, r, c) => container.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);

function paintStars(){
  const stars = starList(challenge);
  stars.forEach((idx, bit) => {
    const cell = $('board').querySelector(`.cell[data-i="${idx}"]`);
    if (cell) cell.classList.toggle('taken', Boolean(state.mask & (1 << bit)));
  });
}

function placeRobot(instant){
  const cell = cellIn($('board'), state.r, state.c);
  if (!cell) return;
  const el = $('robot');
  el.style.transition = instant ? 'none' : '';
  el.style.transform = `translate(${cell.offsetLeft}px, ${cell.offsetTop}px) rotate(${state.d * 90}deg)`;
  if (instant) requestAnimationFrame(() => { el.style.transition = ''; });
}

/* ==================== プログラム表示 ==================== */

function renderProgram(){
  const box = $('prog');
  $('progLen').textContent = program.length;
  if (!program.length){
    box.innerHTML = '<span class="empty">// F / L / R を押して命令を並べる</span>';
    return;
  }
  box.innerHTML = program.map((cmd, i) => {
    const cls = i === execIndex && !finished && execIndex < program.length ? 'now'
              : i < execIndex ? 'done' : '';
    return `<span class="tok ${cls}">${cmd}</span>`;
  }).join('');
}

/* ==================== 実行 ==================== */

function resetRun(){
  running = false;
  finished = false;
  execIndex = 0;
  state = initialState(challenge);
  lastResult = null;
  $('robot').classList.remove('crash');
  $('board').querySelectorAll('.trail').forEach(n => n.classList.remove('trail'));
  paintStars();
  placeRobot(true);
  renderProgram();
  setResult($('result'), 'idle', 'READY — RUN で実行');
  $('copyResult').disabled = true;
}

/** 1命令だけ進める。'running' | 'clear' | 'crash' | 'nogoal' | 'empty' | 'done' */
function stepOnce(){
  if (finished) return 'done';
  if (!program.length) return 'empty';
  if (execIndex >= program.length){ finished = true; return 'nogoal'; }

  const cmd = program[execIndex];
  const res = applyCommand(challenge, state, cmd);
  execIndex++;

  if (!res.ok){
    finished = true;
    $('robot').classList.add('crash');
    renderProgram();
    return 'crash';
  }
  cellIn($('board'), state.r, state.c).classList.add('trail');
  state = res.state;
  paintStars();
  placeRobot(false);
  renderProgram();

  if (isGoalState(challenge, state)){ finished = true; return 'clear'; }
  if (execIndex >= program.length){ finished = true; return 'nogoal'; }
  return 'running';
}

function reportStatus(status){
  const remaining = starList(challenge).length
    - starList(challenge).filter((_, bit) => state.mask & (1 << bit)).length;

  if (status === 'empty'){ setResult($('result'), 'idle', '// プログラムが空です'); return; }
  if (status === 'crash'){
    setResult($('result'), 'fail', `💥 CRASH — ${execIndex}命令目の F で壁にぶつかった`);
    return;
  }
  if (status === 'nogoal'){
    const why = remaining > 0
      ? `★があと ${remaining} 個 残っている`
      : '命令を使い切ったがゴールに届かなかった';
    setResult($('result'), 'fail', `🚫 NO GOAL — ${why}`);
    return;
  }
  if (status !== 'clear') return;

  const used = execIndex;
  const par = Share.parLabel(used, challenge.par);
  const stars = rateStars(used, optimal);
  lastResult = { used, par: challenge.par, label: par.text, stars };

  let record = '';
  if (stage){
    const { isBest, prevBest } = progress.record(stage.id, used, stars);
    record = isBest
      ? (prevBest === null ? '<div class="hint">🆕 初クリア！記録を保存しました</div>'
                           : `<div class="hint">🏆 ベスト更新！ ${prevBest} → ${used}</div>`)
      : `<div class="hint">BEST ${progress.get(stage.id).best} 命令</div>`;
    renderStageList();
    updateHud();
    refreshBest();
  }

  setResult($('result'), 'clear',
    `🏁 <b>CLEAR!</b> <span class="stars">${starGlyphs(stars)}</span><div class="score">
      <span>Commands: <b>${used}</b></span>
      <span>PAR: <b>${challenge.par}</b></span>
      <span>最短: <b>${optimal}</b></span>
      <span class="par ${par.tone}">${par.text}</span>
    </div>${record}`);
  $('copyResult').disabled = false;
}

async function run(){
  if (running) return;
  if (finished || execIndex > 0) resetRun();
  running = true;
  $('run').disabled = true; $('step').disabled = true;
  let status = 'running';
  const pace = program.length > 40 ? 90 : 200;
  while (status === 'running'){
    status = stepOnce();
    if (status === 'running') await wait(pace);
  }
  running = false;
  $('run').disabled = false; $('step').disabled = false;
  reportStatus(status);
}

function step(){
  if (running) return;
  if (finished) resetRun();
  const status = stepOnce();
  if (status === 'running') setResult($('result'), 'idle', `▶ ${execIndex} / ${program.length} 実行済み`);
  else reportStatus(status);
}

function pushCommand(cmd){
  if (running || program.length >= MAX_PROGRAM) return;
  if (execIndex > 0 || finished) resetRun();
  program.push(cmd);
  renderProgram();
}

function undo(){
  if (running) return;
  resetRun();
  program.pop();
  renderProgram();
}

/* ==================== Challenge の読み込み ==================== */

function loadChallenge(ch, opts = {}){
  challenge = clone(ch);
  stage = opts.stage || null;
  optimal = optimalCommands(challenge) ?? challenge.par;
  program = [];
  paintBoard($('board'), challenge);

  const stars = starList(challenge).length;
  $('chNo').textContent = stage ? `STAGE ${stage.no}` : 'CUSTOM';
  $('chNo').className = 'badge ' + (stage ? (stage.level === 'easy' ? 'easy' : stage.level === 'medium' ? 'medium' : 'hard') : 'violet');
  $('chName').textContent = stage ? stage.name : '共有された Challenge';
  $('chSize').textContent = `${challenge.w}×${challenge.h}`;
  $('chPar').textContent = `PAR ${challenge.par}`;
  $('chStarCount').hidden = stars === 0;
  $('chStarCount').textContent = `★ ×${stars}`;
  $('chSource').textContent = opts.source === 'url' ? 'FROM URL' : 'STAGE';
  $('prevStage').disabled = !stage || stage.no <= 1;
  $('nextStage').disabled = !stage || stage.no >= STAGES.length;
  $('shareOut').hidden = true;
  $('copyStatus').textContent = '';
  refreshBest();
  resetRun();
  renderStageList();
}

function refreshBest(){
  if (!stage){ $('chBest').textContent = ''; return; }
  const rec = progress.get(stage.id);
  $('chBest').innerHTML = rec
    ? `BEST <b style="color:var(--text)">${rec.best}</b> <span class="stars">${starGlyphs(rec.stars)}</span>`
    : 'BEST —';
}

function openStage(no){
  const s = STAGES[no - 1];
  if (!s) return;
  Share.clearHash();
  $('notice').hidden = true;
  loadChallenge(s.challenge, { stage: s, source: 'stage' });
  switchTab('play');
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
      const card = document.createElement('button');
      card.className = 'stagecard' + (rec ? ' cleared' : '') + (stage && stage.id === s.id ? ' on' : '');
      const starCount = s.challenge.stars.length;
      card.innerHTML = `
        <span class="no">STAGE ${String(s.no).padStart(2, '0')} · ${s.challenge.w}×${s.challenge.h}${starCount ? ' · ★×' + starCount : ''}</span>
        <span class="nm">${s.name}</span>
        <span class="st stars">${rec ? starGlyphs(rec.stars) : '<span class="off">★★★</span>'}</span>
        <span class="bs">PAR ${s.challenge.par}${rec ? ` / BEST ${rec.best}` : ''}</span>`;
      card.addEventListener('click', () => openStage(s.no));
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

document.querySelectorAll('[data-cmd]').forEach(b =>
  b.addEventListener('click', () => pushCommand(b.dataset.cmd)));
$('run').addEventListener('click', run);
$('step').addEventListener('click', step);
$('reset').addEventListener('click', resetRun);
$('undo').addEventListener('click', undo);
$('clearProg').addEventListener('click', () => { if (running) return; program = []; resetRun(); });
$('prevStage').addEventListener('click', () => stage && openStage(stage.no - 1));
$('nextStage').addEventListener('click', () => stage && openStage(stage.no + 1));
$('resetProgress').addEventListener('click', () => {
  if (!confirm('ROUTE GOLF のクリア記録をすべて消します。よろしいですか？')) return;
  progress.reset();
  renderStageList(); updateHud(); refreshBest();
});

window.addEventListener('keydown', e => {
  if (isTypingTarget(e.target)) return;
  if ($('playView').hidden) return;
  const k = e.key.toLowerCase();
  if (k === 'f' || k === 'l' || k === 'r') pushCommand(k.toUpperCase());
  else if (e.key === 'Enter'){ e.preventDefault(); run(); }
  else if (e.key === 'Backspace'){ e.preventDefault(); undo(); }
});

/* ==================== Share / Result ==================== */

$('share').addEventListener('click', () => {
  Share.setHash(TYPE, challenge);
  Share.copyText(Share.challengeUrl(TYPE, challenge), $('shareOut'), $('copyStatus'));
  $('chSource').textContent = 'FROM URL';
});

$('remix').addEventListener('click', () => switchTab('create'));

$('copyResult').addEventListener('click', () => {
  if (!lastResult) return;
  const text = [
    `ROUTE GOLF — ${stage ? `STAGE ${stage.no} ${stage.name}` : 'CUSTOM'}`,
    '',
    `✅ CLEAR ${'★'.repeat(lastResult.stars)}`,
    `🧠 ${lastResult.used} commands`,
    `🎯 PAR ${lastResult.par}（${lastResult.label}）`,
    '',
    'Challenge:',
    Share.challengeUrl(TYPE, challenge),   // 解答は含めない
  ].join('\n');
  Share.copyText(text, $('shareOut'), $('copyStatus'));
});

/* ==================== CREATE MODE ==================== */

let draft = null;
let tool = 'WALL';
const TOOLS = ['EMPTY', 'WALL', 'STAR', 'START', 'GOAL'];

function renderPalette(){
  $('palette').innerHTML = '';
  TOOLS.forEach(t => {
    const b = document.createElement('button');
    b.textContent = t;
    b.className = t === tool ? 'on' : '';
    b.addEventListener('click', () => { tool = t; renderPalette(); });
    $('palette').appendChild(b);
  });
}

function renderSizeSel(){
  $('sizeSel').innerHTML = '';
  for (let n = MIN_SIZE + 1; n <= MAX_SIZE - 1; n++){
    const b = document.createElement('button');
    b.textContent = `${n}×${n}`;
    b.className = draft.w === n ? 'on' : '';
    b.addEventListener('click', () => resizeDraft(n));
    $('sizeSel').appendChild(b);
  }
}

function renderDirSel(){
  $('dirSel').innerHTML = '';
  DIR_GLYPH.forEach((g, i) => {
    const b = document.createElement('button');
    b.textContent = g;
    b.className = draft.sd === i ? 'on' : '';
    b.addEventListener('click', () => { draft.sd = i; renderDirSel(); renderDraft(); });
    $('dirSel').appendChild(b);
  });
}

function resizeDraft(n){
  draft.w = n; draft.h = n;
  draft.walls = [];
  draft.stars = [];
  draft.sr = 0; draft.sc = 0;
  draft.gr = n - 1; draft.gc = n - 1;
  renderSizeSel(); renderDraft();
}

function renderDraft(){
  paintBoard($('edBoard'), draft, { showStartGlyph: true });
  $('edBoard').querySelectorAll('.cell').forEach(cell => {
    cell.addEventListener('click', () => editCell(+cell.dataset.r, +cell.dataset.c));
  });
  updateDraftStatus();
}

function editCell(r, c){
  const idx = r * draft.w + c;
  const isStart = r === draft.sr && c === draft.sc;
  const isGoal = r === draft.gr && c === draft.gc;
  const drop = arr => arr.filter(i => i !== idx);
  const hint = msg => { $('edHint').textContent = msg; };

  if (tool === 'WALL'){
    if (isStart || isGoal) return hint('⚠️ スタート/ゴールの上には壁を置けません');
    draft.stars = drop(draft.stars);
    draft.walls = draft.walls.includes(idx) ? drop(draft.walls) : [...draft.walls, idx];
  } else if (tool === 'STAR'){
    if (isGoal) return hint('⚠️ ゴールの上には★を置けません');
    if (draft.stars.includes(idx)) draft.stars = drop(draft.stars);
    else {
      if (draft.stars.length >= MAX_STARS) return hint(`⚠️ ★は ${MAX_STARS} 個までです`);
      draft.walls = drop(draft.walls);
      draft.stars = [...draft.stars, idx];
    }
  } else if (tool === 'EMPTY'){
    draft.walls = drop(draft.walls);
    draft.stars = drop(draft.stars);
  } else if (tool === 'START'){
    if (isGoal) return hint('⚠️ ゴールと同じマスには置けません');
    draft.walls = drop(draft.walls);
    draft.sr = r; draft.sc = c;
  } else if (tool === 'GOAL'){
    if (isStart) return hint('⚠️ スタートと同じマスには置けません');
    draft.walls = drop(draft.walls);
    draft.stars = drop(draft.stars);
    draft.gr = r; draft.gc = c;
  }
  hint('');
  renderDraft();
}

function updateDraftStatus(){
  draft.par = Math.max(1, Math.min(99, +$('parInput').value || 1));
  const problem = validateChallenge(draft);
  const fail = msg => {
    setResult($('edStatus'), 'fail', msg);
    $('edShare').disabled = true; $('edTest').disabled = true;
  };
  if (problem) return fail('⚠️ ' + problem);

  const best = optimalCommands(draft);
  if (best === null) return fail('🚫 UNSOLVABLE — ゴールに到達できません（★を全部拾えますか？）');

  setResult($('edStatus'), 'clear',
    `✅ SOLVABLE<div class="score"><span>最短: <b>${best}</b> commands</span><span>PAR: <b>${draft.par}</b></span>
     <span class="hint">${draft.par > best ? `PAR ${best - draft.par} まで縮められる` : 'PARが最短以下＝縮める余地なし'}</span></div>`);
  $('edShare').disabled = false; $('edTest').disabled = false;
}

function openCreate(base){
  draft = clone(base);
  if (!Array.isArray(draft.stars)) draft.stars = [];
  $('parInput').value = draft.par;
  tool = 'WALL';
  renderPalette(); renderSizeSel(); renderDirSel(); renderDraft();
  $('edHint').textContent = '';
  $('edShareOut').hidden = true;
  $('edCopyStatus').textContent = '';
}

$('parInput').addEventListener('input', updateDraftStatus);
$('autoPar').addEventListener('click', () => {
  const best = optimalCommands(draft);
  if (best === null) return;
  $('parInput').value = best + 1;      // 最短+1 にして「PAR -1」を狙えるようにする
  updateDraftStatus();
});
$('edShare').addEventListener('click', () => {
  updateDraftStatus();
  if (validateChallenge(draft)) return;
  Share.copyText(Share.challengeUrl(TYPE, draft), $('edShareOut'), $('edCopyStatus'));
});
$('edTest').addEventListener('click', () => {
  Share.setHash(TYPE, draft);
  loadChallenge(draft, { source: 'url' });
  switchTab('play');
});

/* ==================== タブ ==================== */

const switchTab = makeTabs(
  { stages: $('stagesView'), play: $('playView'), create: $('createView') },
  { stages: $('tabStages'), play: $('tabPlay'), create: $('tabCreate') },
  name => {
    if (name === 'play') placeRobot(true);
    if (name === 'create') openCreate(challenge);
    if (name === 'stages'){ renderStageList(); updateHud(); }
  },
);

/* ==================== 起動 ==================== */

const loaded = Share.readChallenge({
  type: TYPE,
  validate: validateChallenge,
  fallback: () => STAGES[0].challenge,
});

if (loaded.source === 'url'){
  loadChallenge(loaded.data, { source: 'url' });
  showNotice($('notice'), 'info', '🔗 URLから Challenge を読み込みました');
} else {
  // 未クリアの最初のステージから始める
  const next = STAGES.find(s => !progress.cleared(s.id)) || STAGES[0];
  loadChallenge(next.challenge, { stage: next, source: 'stage' });
  if (loaded.source === 'invalid'){
    showNotice($('notice'), '', `⚠️ Invalid Challenge: ${loaded.error} — STAGE ${next.no} を読み込みました`);
  }
}
updateHud();
renderStageList();
window.addEventListener('resize', () => placeRobot(true));
