/**
 * 「見えない迷路」のロジック（DOM非依存）。
 *
 * 迷路は seed から完全に再現できる。
 * URL に seed を載せれば「同じ迷路」を他人に渡せる＝サーバーなしで勝負が成立する。
 */

/** 再現できる乱数（同じ seed なら同じ迷路） */
export function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DIRS = ['up', 'down', 'left', 'right'];

/**
 * 穴掘り法（DFS）で完全迷路を作る。
 * v[r][c] = (r,c) と (r,c+1) の間の壁 / h[r][c] = (r,c) と (r+1,c) の間の壁
 */
export function generateMaze(rows, cols, seed){
  const rand = mulberry32(seed);
  const v = Array.from({ length: rows }, () => Array(cols).fill(true));
  const h = Array.from({ length: rows }, () => Array(cols).fill(true));
  const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack = [[0, 0]];
  seen[0][0] = true;

  while (stack.length){
    const [r, c] = stack[stack.length - 1];
    const nexts = [];
    if (r > 0 && !seen[r-1][c]) nexts.push(['up', r-1, c]);
    if (r < rows-1 && !seen[r+1][c]) nexts.push(['down', r+1, c]);
    if (c > 0 && !seen[r][c-1]) nexts.push(['left', r, c-1]);
    if (c < cols-1 && !seen[r][c+1]) nexts.push(['right', r, c+1]);

    if (!nexts.length){ stack.pop(); continue; }
    const [dir, nr, nc] = nexts[Math.floor(rand() * nexts.length)];
    if (dir === 'up') h[nr][nc] = false;
    if (dir === 'down') h[r][c] = false;
    if (dir === 'left') v[nr][nc] = false;
    if (dir === 'right') v[r][c] = false;
    seen[nr][nc] = true;
    stack.push([nr, nc]);
  }
  return { rows, cols, v, h, seed };
}

/**
 * 移動の可否を返す。
 * ok:true なら進める。ok:false のとき wall は「ぶつかった壁」（外周なら null）。
 */
export function tryMove(maze, r, c, dir){
  const { rows, cols, v, h } = maze;
  if (dir === 'up')    return r === 0      ? { ok:false, wall:null }
                       : h[r-1][c] ? { ok:false, wall:{ type:'h', r:r-1, c } } : { ok:true, r:r-1, c };
  if (dir === 'down')  return r === rows-1 ? { ok:false, wall:null }
                       : h[r][c]   ? { ok:false, wall:{ type:'h', r, c } }     : { ok:true, r:r+1, c };
  if (dir === 'left')  return c === 0      ? { ok:false, wall:null }
                       : v[r][c-1] ? { ok:false, wall:{ type:'v', r, c:c-1 } } : { ok:true, r, c:c-1 };
  if (dir === 'right') return c === cols-1 ? { ok:false, wall:null }
                       : v[r][c]   ? { ok:false, wall:{ type:'v', r, c } }     : { ok:true, r, c:c+1 };
  return { ok:false, wall:null };
}

/** (sr,sc) から全マスへの距離 */
export function distancesFrom(maze, sr, sc){
  const { rows, cols } = maze;
  const dist = Array.from({ length: rows }, () => Array(cols).fill(-1));
  dist[sr][sc] = 0;
  const queue = [[sr, sc]];
  let head = 0;
  while (head < queue.length){
    const [r, c] = queue[head++];
    for (const dir of DIRS){
      const t = tryMove(maze, r, c, dir);
      if (t.ok && dist[t.r][t.c] < 0){ dist[t.r][t.c] = dist[r][c] + 1; queue.push([t.r, t.c]); }
    }
  }
  return dist;
}

/** スタート(0,0) からゴール(右下) までの最短手数 */
export function shortestPath(maze){
  return distancesFrom(maze, 0, 0)[maze.rows - 1][maze.cols - 1];
}

/**
 * 鍵を置くマス。「スタートからもゴールからも遠い」маスを選ぶ（決定的）。
 * 迷路の端っこの行き止まりに置かれるので、寄り道の記憶が試される。
 */
export function keyCell(maze){
  const fromStart = distancesFrom(maze, 0, 0);
  const fromGoal = distancesFrom(maze, maze.rows - 1, maze.cols - 1);
  let best = null;
  for (let r = 0; r < maze.rows; r++){
    for (let c = 0; c < maze.cols; c++){
      if ((r === 0 && c === 0) || (r === maze.rows - 1 && c === maze.cols - 1)) continue;
      const score = Math.min(fromStart[r][c], fromGoal[r][c]) * 100 + fromStart[r][c] + fromGoal[r][c];
      if (!best || score > best.score) best = { r, c, score };
    }
  }
  return best ? { r: best.r, c: best.c } : { r: 0, c: 0 };
}

/** そのステージをクリアするのに最低何歩必要か */
export function requiredSteps(maze, mode){
  if (!mode.key) return shortestPath(maze);
  const key = keyCell(maze);
  const fromStart = distancesFrom(maze, 0, 0);
  const fromKey = distancesFrom(maze, key.r, key.c);
  return fromStart[key.r][key.c] + fromKey[maze.rows - 1][maze.cols - 1];
}

/* ---------- モードとステージ ---------- */

export const MODES = {
  normal: { id:'normal', label:'ふつう',   desc:'覚えて 🏁 まで進む',                 key:false, lives:0 },
  key:    { id:'key',    label:'鍵あり',   desc:'🔑 を拾ってから 🏁 へ',              key:true,  lives:0 },
  life:   { id:'life',   label:'ライフ制', desc:'壁ドン3回でゲームオーバー',          key:false, lives:3 },
  keylife:{ id:'keylife',label:'鍵＋ライフ', desc:'🔑 を拾ってから 🏁 へ／壁ドン4回まで', key:true, lives:4 },
};

/**
 * ステージ一覧。
 * peek = 壁が見えている時間(ms)、maxPath = 「これ以上曲がりくねった迷路は出さない」上限。
 */
export const STAGES = [
  { id:'s1',  name:'まずは4×4',     level:'easy',   rows:4, cols:4, peek:3000, mode:'normal', maxPath:8 },
  { id:'s2',  name:'5×5',           level:'easy',   rows:5, cols:5, peek:3000, mode:'normal', maxPath:12 },
  { id:'s3',  name:'5×5・鍵あり',   level:'easy',   rows:5, cols:5, peek:3500, mode:'key',    maxPath:18 },
  { id:'s4',  name:'6×6',           level:'medium', rows:6, cols:6, peek:3000, mode:'normal', maxPath:16 },
  { id:'s5',  name:'6×6・ライフ制', level:'medium', rows:6, cols:6, peek:3000, mode:'life',   maxPath:16 },
  { id:'s6',  name:'6×6・鍵あり',   level:'medium', rows:6, cols:6, peek:3500, mode:'key',    maxPath:24 },
  { id:'s7',  name:'7×7',           level:'medium', rows:7, cols:7, peek:3500, mode:'normal', maxPath:20 },
  { id:'s8',  name:'7×7・鍵あり',   level:'hard',   rows:7, cols:7, peek:4000, mode:'key',    maxPath:28 },
  { id:'s9',  name:'8×8',           level:'hard',   rows:8, cols:8, peek:4000, mode:'normal', maxPath:26 },
  { id:'s10', name:'8×8・ライフ制', level:'hard',   rows:8, cols:8, peek:4000, mode:'life',   maxPath:26 },
  { id:'s11', name:'9×9',           level:'hard',   rows:9, cols:9, peek:4500, mode:'normal', maxPath:28 },
  { id:'s12', name:'9×9・鍵＋ライフ', level:'hard', rows:9, cols:9, peek:5000, mode:'keylife', maxPath:46 },
];

export const stageById = id => STAGES.find(s => s.id === id) || null;
export const modeOf = stage => MODES[stage.mode];

/**
 * ステージ条件（曲がりくねりすぎない）を満たす迷路を探す。
 * startSeed から順に seed を進めるだけなので、結果は seed から再現できる。
 */
export function findMaze(stage, startSeed){
  const mode = modeOf(stage);
  let fallback = null;
  for (let i = 0; i < 200; i++){
    const seed = ((startSeed + i) >>> 0) || 1;
    const maze = generateMaze(stage.rows, stage.cols, seed);
    const need = requiredSteps(maze, mode);
    if (need <= stage.maxPath) return maze;
    if (!fallback || need < requiredSteps(fallback, mode)) fallback = maze;
  }
  return fallback;
}

export function randomSeed(){
  return Math.floor(Math.random() * 900000) + 1000;
}

/** スコア（小さいほど良い）。歩数に壁ドンのペナルティを足す。 */
export function scoreOf(steps, miss){
  return steps + miss * 3;
}

/** ★評価：最短歩数＆ノーミスで3★ */
export function rateStars(steps, miss, need){
  if (steps <= need && miss === 0) return 3;
  if (miss <= 2 && steps <= need + 4) return 2;
  return 1;
}
