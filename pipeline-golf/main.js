/** PIPELINE GOLF の画面。ゲームロジックは logic.js / ops.js 側。 */
import { OPS, OP_BY_ID, sortOps } from './ops.js';
import {
  TYPE, MAX_PIPE, runPipeline, solvePipeline, rateStars, validateChallenge, clone,
} from './logic.js';
import { buildStages } from './stages.js';
import * as Share from '../shared/url-codec.js';
import { Progress } from '../shared/storage.js';
import { $, wait, starGlyphs, setResult, showNotice, makeTabs, isTypingTarget, debounce } from '../shared/ui.js';

const STAGES = buildStages();
const progress = new Progress('pipeline');
const LEVEL_LABEL = { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD' };
/** CREATE で探索する深さ。深くしすぎるとブラウザが固まる。 */
const CREATE_SEARCH_DEPTH = 6;

let stage = null;
let challenge = null;
let optimal = 0;
let pipeline = [];
let running = false;
let lastResult = null;

/* ==================== PLAY ==================== */

function renderChallenge(source){
  $('ioInput').innerHTML = Share.quote(challenge.input);
  $('ioTarget').innerHTML = Share.quote(challenge.target);
  $('chNo').textContent = stage ? `STAGE ${stage.no}` : 'CUSTOM';
  $('chNo').className = 'badge ' + (stage ? stage.level : 'violet');
  $('chName').textContent = stage ? stage.name : '共有された Challenge';
  $('chPar').textContent = `PAR ${challenge.par}`;
  $('chSource').textContent = source === 'url' ? 'FROM URL' : 'STAGE';
  $('prevStage').disabled = !stage || stage.no <= 1;
  $('nextStage').disabled = !stage || stage.no >= STAGES.length;

  $('available').innerHTML = '';
  challenge.ops.forEach(id => {
    const op = OP_BY_ID[id];
    const b = document.createElement('button');
    b.innerHTML = `<span>${op.label}</span><span class="d">${op.desc}</span>`;
    b.addEventListener('click', () => addOp(id));
    $('available').appendChild(b);
  });
  refreshBest();
}

function refreshBest(){
  if (!stage){ $('chBest').textContent = ''; return; }
  const rec = progress.get(stage.id);
  $('chBest').innerHTML = rec
    ? `BEST <b style="color:var(--text)">${rec.best}</b> <span class="stars">${starGlyphs(rec.stars)}</span>`
    : 'BEST —';
}

function renderPipeline(activeIndex = -1){
  const box = $('pipe');
  $('pipeLen').textContent = pipeline.length;
  if (!pipeline.length){
    box.innerHTML = '<div class="empty">// 左の operation を押して並べる</div>';
    return;
  }
  box.innerHTML = '';
  pipeline.forEach((id, i) => {
    const div = document.createElement('div');
    div.className = 'step' + (i === activeIndex ? ' now' : '');
    div.innerHTML = `<span class="n">${i + 1}</span><span class="name">${OP_BY_ID[id].label}</span>`;
    [['↑', () => swap(i, i - 1)], ['↓', () => swap(i, i + 1)], ['✕', () => removeAt(i)]]
      .forEach(([label, action]) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.addEventListener('click', action);
        div.appendChild(b);
      });
    box.appendChild(div);
  });
}

function addOp(id){
  if (running || pipeline.length >= MAX_PIPE) return;
  pipeline.push(id);
  renderPipeline();
  resetOutput();
}
function removeAt(i){ if (running) return; pipeline.splice(i, 1); renderPipeline(); resetOutput(); }
function swap(i, j){
  if (running || j < 0 || j >= pipeline.length) return;
  [pipeline[i], pipeline[j]] = [pipeline[j], pipeline[i]];
  renderPipeline(); resetOutput();
}

function resetOutput(){
  $('trace').innerHTML = '<span class="hint">// RUN すると各ステップの途中結果が出ます</span>';
  setResult($('result'), 'idle', 'READY');
  $('copyResult').disabled = true;
  lastResult = null;
}

async function run(){
  if (running) return;
  if (!pipeline.length){ setResult($('result'), 'idle', '// パイプラインが空です'); return; }
  running = true;
  $('run').disabled = true;

  const { steps, output } = runPipeline(challenge.input, pipeline);
  const trace = $('trace');
  trace.innerHTML = `<div><span class="arrow">INPUT</span> <span class="val">${Share.quote(challenge.input)}</span></div>`;

  const pace = steps.length > 6 ? 220 : 360;
  for (let i = 0; i < steps.length; i++){
    renderPipeline(i);
    await wait(pace);
    const s = steps[i];
    const isLast = i === steps.length - 1;
    const cls = isLast ? (output === challenge.target ? 'hit' : 'miss') : '';
    trace.insertAdjacentHTML('beforeend',
      `<div><span class="arrow">↓ ${s.label}</span></div>
       <div><span class="val ${cls}">${Share.quote(s.value)}</span></div>`);
  }
  renderPipeline(-1);
  await wait(180);

  if (output === challenge.target){
    const used = pipeline.length;
    const par = Share.parLabel(used, challenge.par);
    const stars = rateStars(used, optimal);
    lastResult = { used, par: challenge.par, label: par.text, stars };

    let record = '';
    if (stage){
      const { isBest, prevBest } = progress.record(stage.id, used, stars);
      record = isBest
        ? (prevBest === null ? '<div class="hint">🆕 初クリア！記録を保存しました</div>'
                             : `<div class="hint">🏆 ベスト更新！ ${prevBest} → ${used}</div>`)
        : `<div class="hint">BEST ${progress.get(stage.id).best} operations</div>`;
      renderStageList(); updateHud(); refreshBest();
    }
    setResult($('result'), 'clear', `✅ <b>CLEAR!</b> <span class="stars">${starGlyphs(stars)}</span><div class="score">
      <span>Operations: <b>${used}</b></span>
      <span>PAR: <b>${challenge.par}</b></span>
      <span>最短: <b>${optimal}</b></span>
      <span class="par ${par.tone}">${par.text}</span></div>${record}`);
    $('copyResult').disabled = false;
  } else {
    setResult($('result'), 'fail', `❌ TARGET と一致しません<div class="score">
      <span>got: <b>${Share.quote(output)}</b></span>
      <span>want: <b>${Share.quote(challenge.target)}</b></span></div>`);
  }
  running = false;
  $('run').disabled = false;
}

$('run').addEventListener('click', run);
$('undo').addEventListener('click', () => { if (running) return; pipeline.pop(); renderPipeline(); resetOutput(); });
$('clearPipe').addEventListener('click', () => { if (running) return; pipeline = []; renderPipeline(); resetOutput(); });
$('prevStage').addEventListener('click', () => stage && openStage(stage.no - 1));
$('nextStage').addEventListener('click', () => stage && openStage(stage.no + 1));
window.addEventListener('keydown', e => {
  if (isTypingTarget(e.target) || $('playView').hidden) return;
  if (e.key === 'Enter'){ e.preventDefault(); run(); }
  if (e.key === 'Backspace'){ e.preventDefault(); if (!running){ pipeline.pop(); renderPipeline(); resetOutput(); } }
});

/* ==================== Challenge 読み込み ==================== */

function loadChallenge(ch, opts = {}){
  challenge = clone(ch);
  stage = opts.stage || null;
  // 内蔵ステージは最短手数を知っているので探索し直さない
  optimal = stage ? stage.optimal
                  : (solvePipeline(ch.input, ch.target, ch.ops, CREATE_SEARCH_DEPTH) || { length: ch.par }).length;
  pipeline = [];
  renderChallenge(opts.source);
  renderPipeline();
  resetOutput();
  renderStageList();
  $('shareOut').hidden = true;
  $('copyStatus').textContent = '';
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
      card.innerHTML = `
        <span class="no">STAGE ${String(s.no).padStart(2, '0')} · ${s.challenge.ops.length} ops</span>
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

$('resetProgress').addEventListener('click', () => {
  if (!confirm('PIPELINE GOLF のクリア記録をすべて消します。よろしいですか？')) return;
  progress.reset();
  renderStageList(); updateHud(); refreshBest();
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
    `PIPELINE GOLF — ${stage ? `STAGE ${stage.no} ${stage.name}` : 'CUSTOM'}`, '',
    `✅ CLEAR ${'★'.repeat(lastResult.stars)}`,
    `🧠 ${lastResult.used} operations`,
    `🎯 PAR ${lastResult.par}（${lastResult.label}）`,
    '', 'Challenge:',
    Share.challengeUrl(TYPE, challenge),   // 解答は含めない
  ].join('\n');
  Share.copyText(text, $('shareOut'), $('copyStatus'));
});

/* ==================== CREATE MODE ==================== */

let draft = null;
let recipe = [];

function renderEdOps(){
  $('edOps').innerHTML = '';
  OPS.forEach(op => {
    const on = draft.ops.includes(op.id);
    const label = document.createElement('label');
    label.className = on ? 'on' : '';
    label.innerHTML = `<input type="checkbox" ${on ? 'checked' : ''}> ${op.label}`;
    label.querySelector('input').addEventListener('change', e => {
      if (e.target.checked) draft.ops = sortOps([...draft.ops, op.id]);
      else {
        draft.ops = draft.ops.filter(id => id !== op.id);
        recipe = recipe.filter(id => id !== op.id);
        applyRecipe();
      }
      renderEdOps(); renderRecipeOps(); renderRecipe(); updateDraftStatus();
    });
    $('edOps').appendChild(label);
  });
}

function renderRecipeOps(){
  $('edRecipeOps').innerHTML = '';
  draft.ops.forEach(id => {
    const op = OP_BY_ID[id];
    const b = document.createElement('button');
    b.innerHTML = `<span>${op.label}</span><span class="d">${op.desc}</span>`;
    b.addEventListener('click', () => {
      if (recipe.length >= MAX_PIPE) return;
      recipe.push(id);
      applyRecipe(); renderRecipe(); updateDraftStatus();
    });
    $('edRecipeOps').appendChild(b);
  });
}

function renderRecipe(){
  const box = $('edRecipe');
  $('edRecipeLen').textContent = recipe.length;
  if (!recipe.length){
    box.innerHTML = '<div class="empty">// 関数を押すと TARGET が組み上がる</div>';
    return;
  }
  box.innerHTML = '';
  recipe.forEach((id, i) => {
    const div = document.createElement('div');
    div.className = 'step';
    const value = runPipeline(draft.input, recipe.slice(0, i + 1)).output;
    div.innerHTML = `<span class="n">${i + 1}</span><span class="name">${OP_BY_ID[id].label}</span>
                     <span class="hint" style="max-width:45%; overflow:hidden; text-overflow:ellipsis">${Share.quote(value)}</span>`;
    box.appendChild(div);
  });
}

/** Recipe の結果を TARGET 欄に反映する */
function applyRecipe(){
  if (!recipe.length) return;
  const out = runPipeline(draft.input, recipe).output;
  $('edTarget').value = out;
  draft.target = out;
}

function syncDraftFromInputs(){
  draft.input = $('edInput').value;
  draft.target = $('edTarget').value;
  draft.par = Math.max(1, Math.min(MAX_PIPE, +$('edPar').value || 1));
}

function updateDraftStatus(){
  syncDraftFromInputs();
  const fail = html => {
    setResult($('edStatus'), 'fail', html);
    $('edShare').disabled = true; $('edTest').disabled = true;
  };
  const problem = validateChallenge(draft);
  if (problem) return fail('⚠️ ' + problem);

  const solution = solvePipeline(draft.input, draft.target, draft.ops, CREATE_SEARCH_DEPTH);
  if (!solution) return fail(`🚫 UNSOLVABLE — この関数の組み合わせでは ${CREATE_SEARCH_DEPTH}手以内に TARGET へ到達できません`);

  setResult($('edStatus'), 'clear', `✅ SOLVABLE<div class="score">
    <span>最短: <b>${solution.length}</b> operations</span>
    <span>PAR: <b>${draft.par}</b></span>
    <span class="hint">${draft.par > solution.length ? `PAR ${solution.length - draft.par} まで縮められる` : 'PARが最短以下＝縮める余地なし'}</span></div>`);
  $('edShare').disabled = false; $('edTest').disabled = false;
}

function openCreate(base){
  draft = clone(base);
  recipe = [];
  $('edInput').value = draft.input;
  $('edTarget').value = draft.target;
  $('edPar').value = draft.par;
  renderEdOps(); renderRecipeOps(); renderRecipe();
  updateDraftStatus();
  $('edShareOut').hidden = true;
  $('edCopyStatus').textContent = '';
}

// 探索は最悪1秒近くかかるので、1文字ごとには走らせない
const updateDraftStatusSoon = debounce(updateDraftStatus, 300);
const searching = () => {
  // 探索が終わるまでは共有させない（未検証の Challenge を配らないため）
  setResult($('edStatus'), 'idle', '🔍 最短解を探索中…');
  $('edShare').disabled = true; $('edTest').disabled = true;
};

$('edInput').addEventListener('input', () => {
  syncDraftFromInputs(); applyRecipe(); renderRecipe(); searching(); updateDraftStatusSoon();
});
$('edTarget').addEventListener('input', () => {
  recipe = []; renderRecipe(); searching(); updateDraftStatusSoon();
});
$('edPar').addEventListener('input', updateDraftStatus);
$('edRecipeUndo').addEventListener('click', () => {
  recipe.pop();
  if (!recipe.length) $('edTarget').value = draft.input;
  applyRecipe(); renderRecipe(); updateDraftStatus();
});
$('edRecipeClear').addEventListener('click', () => {
  recipe = [];
  renderRecipe(); updateDraftStatus();
});
$('autoPar').addEventListener('click', () => {
  syncDraftFromInputs();
  const solution = solvePipeline(draft.input, draft.target, draft.ops, CREATE_SEARCH_DEPTH);
  if (!solution) return;
  $('edPar').value = solution.length + 1;
  updateDraftStatus();
});
$('edShare').addEventListener('click', () => {
  updateDraftStatus();
  if (validateChallenge(draft)) return;
  Share.copyText(Share.challengeUrl(TYPE, draft), $('edShareOut'), $('edCopyStatus'));
});
$('edTest').addEventListener('click', () => {
  updateDraftStatus();
  if (validateChallenge(draft)) return;
  Share.setHash(TYPE, draft);
  loadChallenge(draft, { source: 'url' });
  switchTab('play');
});

/* ==================== タブ ==================== */

const switchTab = makeTabs(
  { stages: $('stagesView'), play: $('playView'), create: $('createView') },
  { stages: $('tabStages'), play: $('tabPlay'), create: $('tabCreate') },
  name => {
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
  const next = STAGES.find(s => !progress.cleared(s.id)) || STAGES[0];
  loadChallenge(next.challenge, { stage: next, source: 'stage' });
  if (loaded.source === 'invalid'){
    showNotice($('notice'), '', `⚠️ Invalid Challenge: ${loaded.error} — STAGE ${next.no} を読み込みました`);
  }
}
updateHud();
renderStageList();
