/** PIPELINE GOLF のゲームロジック（DOM非依存）。 */
import { OPS, OP_BY_ID } from './ops.js';

export const TYPE = 'pipeline';
export const MAX_PIPE = 12;
export const MAX_TEXT = 120;
/** 探索中に文字列が無限に伸びないよう、この長さを超えた中間結果は捨てる */
export const MAX_INTERMEDIATE = 200;

/** パイプラインを実行し、各ステップの途中結果を返す */
export function runPipeline(input, ids){
  const steps = [];
  let value = input;
  for (const id of ids){
    const op = OP_BY_ID[id];
    if (!op) throw new Error('未知の operation: ' + id);
    value = op.fn(value);
    steps.push({ id, label: op.label, value });
  }
  return { steps, output: value };
}

/**
 * 最短で TARGET に到達するパイプラインを幅優先で探す。見つからなければ null。
 * 分岐は ops の数だけなので、1つの Challenge で使える ops を絞ることで探索量を抑える。
 */
export function solvePipeline(input, target, ids, maxDepth = 6, maxNodes = 120000){
  if (input === target) return [];
  const seen = new Set([input]);
  let frontier = [{ value: input, path: [] }];
  for (let depth = 1; depth <= maxDepth; depth++){
    const next = [];
    for (const node of frontier){
      for (const id of ids){
        const op = OP_BY_ID[id];
        if (!op) continue;
        const value = op.fn(node.value);
        if (value === target) return [...node.path, id];
        if (value.length > MAX_INTERMEDIATE) continue;
        if (seen.has(value) || seen.size > maxNodes) continue;
        seen.add(value);
        next.push({ value, path: [...node.path, id] });
      }
    }
    if (!next.length) break;
    frontier = next;
  }
  return null;
}

/** 使った関数の数から★評価（3★=最短、2★=最短+1、1★=それ以外） */
export function rateStars(used, optimal){
  if (used <= optimal) return 3;
  if (used <= optimal + 1) return 2;
  return 1;
}

export function validateChallenge(d){
  if (!d || typeof d !== 'object') return 'Challenge がオブジェクトではありません';
  if (typeof d.input !== 'string' || typeof d.target !== 'string') return 'input / target が文字列ではありません';
  if (d.input.length > MAX_TEXT || d.target.length > MAX_TEXT) return `input / target が長すぎます（${MAX_TEXT}文字まで）`;
  if (!d.target.length) return 'target が空です';
  if (!Array.isArray(d.ops) || d.ops.length < 1 || d.ops.length > OPS.length) return '使用可能な operation が不正です';
  if (d.ops.some(id => !OP_BY_ID[id])) return '知らない operation が含まれています';
  if (new Set(d.ops).size !== d.ops.length) return 'operation が重複しています';
  if (!Number.isInteger(d.par) || d.par < 1 || d.par > MAX_PIPE) return 'PAR が不正です';
  return null;
}

export const clone = obj => JSON.parse(JSON.stringify(obj));
