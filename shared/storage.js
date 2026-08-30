/**
 * 進捗・ベストスコアの保存（localStorage のみ / サーバーレス）。
 *
 * サーバーを持たないので「記録」はブラウザローカルにしか残らない。
 * localStorage が使えない環境（プライベートモード等）でもゲームは動く必要があるため、
 * 読み書きの失敗はすべて握りつぶし、メモリ上のフォールバックで動かす。
 */

const PREFIX = 'arcade202608:';
const memory = new Map();

function available(){
  try {
    const k = PREFIX + '__probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const HAS_LS = typeof localStorage !== 'undefined' && available();

export function loadJSON(key, fallback){
  const full = PREFIX + key;
  try {
    const raw = HAS_LS ? localStorage.getItem(full) : memory.get(full);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value){
  const full = PREFIX + key;
  const raw = JSON.stringify(value);
  try {
    if (HAS_LS) localStorage.setItem(full, raw);
    else memory.set(full, raw);
  } catch {
    memory.set(full, raw);
  }
}

export function removeKey(key){
  const full = PREFIX + key;
  try { if (HAS_LS) localStorage.removeItem(full); } catch { /* noop */ }
  memory.delete(full);
}

/* ---------- スコア記録 ---------- */

/**
 * ステージ制ゲームの記録。
 *   record[stageId] = { best, stars, clears, at }
 * best は「小さいほど良い」スコア（手数・秒数など）を想定している。
 */
export class Progress {
  constructor(gameId){
    this.gameId = gameId;
    this.key = 'progress:' + gameId;
    this.data = loadJSON(this.key, {});
    if (typeof this.data !== 'object' || Array.isArray(this.data)) this.data = {};
  }

  get(stageId){
    return this.data[stageId] || null;
  }

  cleared(stageId){
    return Boolean(this.data[stageId]);
  }

  clearedCount(){
    return Object.keys(this.data).length;
  }

  totalStars(){
    return Object.values(this.data).reduce((sum, r) => sum + (r.stars || 0), 0);
  }

  /** クリア結果を記録する。ベスト更新なら isBest:true を返す。 */
  record(stageId, score, stars = 0){
    const prev = this.data[stageId];
    const isBest = !prev || score < prev.best;
    this.data[stageId] = {
      best: isBest ? score : prev.best,
      stars: Math.max(stars, prev ? prev.stars || 0 : 0),
      clears: (prev ? prev.clears || 0 : 0) + 1,
      at: new Date().toISOString(),
    };
    saveJSON(this.key, this.data);
    return { isBest, prevBest: prev ? prev.best : null };
  }

  reset(){
    this.data = {};
    removeKey(this.key);
  }
}

/** ステージを持たないゲーム（予想ゲームなど）の通算成績 */
export class Stats {
  constructor(gameId, initial){
    this.key = 'stats:' + gameId;
    this.initial = initial;
    this.data = { ...initial, ...loadJSON(this.key, {}) };
  }
  update(patch){
    this.data = { ...this.data, ...patch };
    saveJSON(this.key, this.data);
    return this.data;
  }
  reset(){
    this.data = { ...this.initial };
    removeKey(this.key);
  }
}

/** ポータル表示用に、各ゲームの進捗サマリを取り出す */
export function progressSummary(gameId){
  const data = loadJSON('progress:' + gameId, {});
  const entries = Object.values(data || {});
  return {
    cleared: entries.length,
    stars: entries.reduce((s, r) => s + (r.stars || 0), 0),
  };
}
