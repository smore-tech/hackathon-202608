import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fromGrid, runProgram, optimalCommands, optimalProgram, validateChallenge, rateStars, applyCommand, initialState,
} from '../route-golf/logic.js';
import { buildStages } from '../route-golf/stages.js';

const STAGES = buildStages();

test('内蔵ステージはすべてクリア可能で、PAR = 最短 + 1', () => {
  assert.ok(STAGES.length >= 16, 'ステージ数が減っている');
  for (const s of STAGES){
    assert.equal(validateChallenge(s.challenge), null, `${s.id}: ${validateChallenge(s.challenge)}`);
    assert.ok(s.optimal > 0, `${s.id} の最短手数が求まらない`);
    assert.equal(s.challenge.par, s.optimal + 1, `${s.id} の PAR がズレている`);
  }
});

test('最短プログラムを実際に走らせるとクリアになる', () => {
  for (const s of STAGES){
    const program = optimalProgram(s.challenge);
    assert.ok(program, `${s.id} の最短解が見つからない`);
    const result = runProgram(s.challenge, program);
    assert.equal(result.status, 'clear', `${s.id} の最短解でクリアできない`);
    assert.equal(result.used, s.optimal, `${s.id} の手数が最短と一致しない`);
  }
});

test('★を拾わずにゴールへ入ってもクリアにならない', () => {
  const ch = fromGrid(['S..', '...', '*.G'], 1, 10);
  // 上の辺を通ってゴールに着くが、左下の ★ を踏んでいない
  const straight = runProgram(ch, ['F', 'F', 'R', 'F', 'F']);
  assert.notEqual(straight.status, 'clear');
  const withStar = optimalProgram(ch);
  assert.equal(runProgram(ch, withStar).status, 'clear');
});

test('壁に前進すると CRASH になる', () => {
  const ch = fromGrid(['S#.', '...', '..G'], 1, 5);
  assert.equal(runProgram(ch, ['F']).status, 'crash');
});

test('回転は位置を変えず、4回で元の向きに戻る', () => {
  const ch = fromGrid(['S..', '...', '..G'], 0, 5);
  let s = initialState(ch);
  for (let i = 0; i < 4; i++) s = applyCommand(ch, s, 'R').state;
  assert.deepEqual({ r: s.r, c: s.c, d: s.d }, { r: 0, c: 0, d: 0 });
});

test('validateChallenge は壊れたデータを弾く', () => {
  const base = fromGrid(['S..', '...', '..G'], 1, 5);
  assert.equal(validateChallenge({ ...base, w: 99 }) !== null, true);
  assert.equal(validateChallenge({ ...base, sd: 9 }) !== null, true);
  assert.equal(validateChallenge({ ...base, walls: [999] }) !== null, true);
  assert.equal(validateChallenge({ ...base, par: 0 }) !== null, true);
  assert.equal(validateChallenge({ ...base, gr: 0, gc: 0 }) !== null, true);
  assert.equal(validateChallenge({ ...base, stars: [8] }) !== null, true, 'ゴール上の★は不正');
});

test('到達できない盤面は null を返す', () => {
  const ch = fromGrid(['S#.', '##.', '..G'], 1, 5);
  assert.equal(optimalCommands(ch), null);
});

test('★評価は最短でのみ3つ', () => {
  assert.equal(rateStars(10, 10), 3);
  assert.equal(rateStars(12, 10), 2);
  assert.equal(rateStars(13, 10), 1);
});
