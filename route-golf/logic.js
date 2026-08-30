/**
 * ROUTE GOLF のゲームロジック（DOM非依存 / ここだけで完結してテストできる）。
 *
 * ルール
 *   - ロボットは F(前進) / L(左回転) / R(右回転) の3命令だけで動く
 *   - ★（スター）を全部拾ってから 🏁 に入るとクリア
 *   - 壁 / 盤外に前進しようとすると CRASH
 *   - スコアは「使った命令数」。少ないほど良い。
 */

export const TYPE = 'route';

export const DR = [-1, 0, 1, 0];          // 0:↑ 1:→ 2:↓ 3:←
export const DC = [0, 1, 0, -1];
export const DIR_GLYPH = ['↑', '→', '↓', '←'];
export const COMMANDS = ['F', 'L', 'R'];

export const MAX_PROGRAM = 100;
export const MAX_STARS = 6;
export const MIN_SIZE = 4;
export const MAX_SIZE = 9;

/* ---------- 盤面ヘルパ ---------- */

export const index = (ch, r, c) => r * ch.w + c;

export function isWall(ch, r, c){
  if (r < 0 || c < 0 || r >= ch.h || c >= ch.w) return true;
  return ch.walls.includes(r * ch.w + c);
}

export function starList(ch){
  return Array.isArray(ch.stars) ? ch.stars : [];
}

export function fullMask(ch){
  return (1 << starList(ch).length) - 1;
}

/** (r,c) にスターがあれば mask に取り込む */
export function collect(ch, mask, r, c){
  const at = starList(ch).indexOf(r * ch.w + c);
  return at < 0 ? mask : (mask | (1 << at));
}

export function initialState(ch){
  return { r: ch.sr, c: ch.sc, d: ch.sd, mask: collect(ch, 0, ch.sr, ch.sc) };
}

export function isGoalState(ch, s){
  return s.r === ch.gr && s.c === ch.gc && s.mask === fullMask(ch);
}

/**
 * 1命令を適用する。前進できなければ ok:false（CRASH）。
 * 状態は書き換えず、新しいオブジェクトを返す。
 */
export function applyCommand(ch, state, cmd){
  if (cmd === 'L') return { ok: true, state: { ...state, d: (state.d + 3) % 4 } };
  if (cmd === 'R') return { ok: true, state: { ...state, d: (state.d + 1) % 4 } };
  if (cmd !== 'F') return { ok: false, state };
  const nr = state.r + DR[state.d], nc = state.c + DC[state.d];
  if (isWall(ch, nr, nc)) return { ok: false, state };
  return { ok: true, state: { r: nr, c: nc, d: state.d, mask: collect(ch, state.mask, nr, nc) } };
}

/**
 * プログラムを最後まで走らせる。
 * status: 'clear' | 'crash' | 'nogoal' | 'empty'
 */
export function runProgram(ch, program){
  if (!program.length) return { status: 'empty', steps: [], used: 0 };
  let state = initialState(ch);
  const steps = [];
  for (let i = 0; i < program.length; i++){
    const res = applyCommand(ch, state, program[i]);
    if (!res.ok) return { status: 'crash', steps, used: i + 1, state };
    state = res.state;
    steps.push({ cmd: program[i], state });
    if (isGoalState(ch, state)) return { status: 'clear', steps, used: i + 1, state };
  }
  return { status: 'nogoal', steps, used: program.length, state };
}

/** 最短命令数を幅優先で求める。到達不能なら null。 */
export function optimalCommands(ch){
  const start = initialState(ch);
  if (isGoalState(ch, start)) return 0;
  const key = s => ((s.r * ch.w + s.c) * 4 + s.d) * (1 << starList(ch).length) + s.mask;
  const dist = new Map([[key(start), 0]]);
  const queue = [start];
  let head = 0;
  while (head < queue.length){
    const cur = queue[head++];
    const cost = dist.get(key(cur));
    for (const cmd of COMMANDS){
      const res = applyCommand(ch, cur, cmd);
      if (!res.ok) continue;
      const next = res.state;
      if (isGoalState(ch, next)) return cost + 1;
      const k = key(next);
      if (!dist.has(k)){ dist.set(k, cost + 1); queue.push(next); }
    }
  }
  return null;
}

/** 最短のプログラム（命令列）そのものを返す。到達不能なら null。 */
export function optimalProgram(ch){
  const start = initialState(ch);
  if (isGoalState(ch, start)) return [];
  const key = s => ((s.r * ch.w + s.c) * 4 + s.d) * (1 << starList(ch).length) + s.mask;
  const prev = new Map([[key(start), null]]);
  const queue = [start];
  let head = 0;
  const rebuild = (state, cmd) => {
    const out = [cmd];
    let at = prev.get(key(state));
    while (at){ out.push(at.cmd); at = prev.get(key(at.from)); }
    return out.reverse();
  };
  while (head < queue.length){
    const cur = queue[head++];
    for (const cmd of COMMANDS){
      const res = applyCommand(ch, cur, cmd);
      if (!res.ok) continue;
      const next = res.state;
      if (isGoalState(ch, next)) return rebuild(cur, cmd);
      const k = key(next);
      if (!prev.has(k)){ prev.set(k, { from: cur, cmd }); queue.push(next); }
    }
  }
  return null;
}

/** 使った命令数から★評価（3★=最短、2★=最短+2まで、1★=それ以外） */
export function rateStars(used, optimal){
  if (used <= optimal) return 3;
  if (used <= optimal + 2) return 2;
  return 1;
}

/** URLから来たデータが Challenge として成立しているか。問題があれば理由を返す。 */
export function validateChallenge(d){
  const int = v => Number.isInteger(v);
  if (!d || typeof d !== 'object') return 'Challenge がオブジェクトではありません';
  if (![d.w, d.h].every(v => int(v) && v >= MIN_SIZE && v <= MAX_SIZE)) return `グリッドサイズは ${MIN_SIZE}〜${MAX_SIZE} です`;
  const cells = d.w * d.h;
  if (!Array.isArray(d.walls) || d.walls.length > cells) return 'walls が不正です';
  if (d.walls.some(i => !int(i) || i < 0 || i >= cells)) return 'walls に範囲外の値があります';
  if (d.stars !== undefined){
    if (!Array.isArray(d.stars) || d.stars.length > MAX_STARS) return `スターは ${MAX_STARS} 個までです`;
    if (d.stars.some(i => !int(i) || i < 0 || i >= cells)) return 'stars に範囲外の値があります';
    if (new Set(d.stars).size !== d.stars.length) return 'stars が重複しています';
  }
  const inside = (r, c) => int(r) && int(c) && r >= 0 && c >= 0 && r < d.h && c < d.w;
  if (!inside(d.sr, d.sc)) return 'スタート位置が盤外です';
  if (!inside(d.gr, d.gc)) return 'ゴール位置が盤外です';
  if (!int(d.sd) || d.sd < 0 || d.sd > 3) return '向きが不正です';
  if (d.sr === d.gr && d.sc === d.gc) return 'スタートとゴールが同じです';
  const si = d.sr * d.w + d.sc, gi = d.gr * d.w + d.gc;
  if (d.walls.includes(si) || d.walls.includes(gi)) return '壁とスタート/ゴールが重なっています';
  const stars = Array.isArray(d.stars) ? d.stars : [];
  if (stars.some(i => d.walls.includes(i))) return '壁とスターが重なっています';
  if (stars.includes(gi)) return 'ゴールの上にスターは置けません';
  if (!int(d.par) || d.par < 1 || d.par > 99) return 'PAR が不正です';
  return null;
}

/**
 * 文字グリッドから Challenge を作る（ステージ定義用）。
 *   '#'=壁  'S'=スタート  'G'=ゴール  '*'=スター  '.'=床
 */
export function fromGrid(rows, sd, par = 1){
  const h = rows.length, w = rows[0].length;
  const walls = [], stars = [];
  let sr = 0, sc = 0, gr = 0, gc = 0;
  rows.forEach((row, r) => {
    if (row.length !== w) throw new Error('グリッドの行の長さが揃っていません');
    [...row].forEach((chx, c) => {
      const i = r * w + c;
      if (chx === '#') walls.push(i);
      if (chx === '*') stars.push(i);
      if (chx === 'S'){ sr = r; sc = c; }
      if (chx === 'G'){ gr = r; gc = c; }
    });
  });
  return { w, h, walls, stars, sr, sc, sd, gr, gc, par };
}

export const clone = obj => JSON.parse(JSON.stringify(obj));
