import test from 'node:test';
import assert from 'node:assert/strict';
import { OPS, OP_BY_ID, OP_IDS, sortOps } from '../pipeline-golf/ops.js';
import { runPipeline, solvePipeline, validateChallenge, rateStars, MAX_PIPE } from '../pipeline-golf/logic.js';
import { buildStages } from '../pipeline-golf/stages.js';

const STAGES = buildStages();

test('operation の id は重複せず、すべて文字列を返す純粋関数', () => {
  assert.equal(new Set(OP_IDS).size, OP_IDS.length);
  for (const op of OPS){
    for (const input of ['', 'a', '  Hello World 42  ', 'ABC-def_ghi']){
      const once = op.fn(input);
      assert.equal(typeof once, 'string', `${op.id} が文字列を返さない`);
      assert.equal(op.fn(input), once, `${op.id} が決定的でない`);
      assert.equal(input, input, '入力が書き換えられていないこと');
    }
  }
});

test('operation は説明とラベルを持つ', () => {
  for (const op of OPS){
    assert.ok(op.label && op.desc, `${op.id} に label / desc がない`);
  }
});

test('内蔵ステージはすべて到達可能で、PAR = 最短 + 1', () => {
  assert.ok(STAGES.length >= 16, 'ステージ数が減っている');
  for (const s of STAGES){
    assert.equal(validateChallenge(s.challenge), null, `${s.id}: ${validateChallenge(s.challenge)}`);
    assert.equal(s.challenge.par, s.optimal + 1, `${s.id} の PAR がズレている`);
    assert.ok(s.optimal >= 1 && s.optimal <= MAX_PIPE, `${s.id} の最短手数が異常`);
  }
});

test('内蔵ステージは「模範解答を流すと TARGET に一致する」', () => {
  for (const s of STAGES){
    assert.equal(runPipeline(s.input, s.solution).output, s.challenge.target, `${s.id} の模範解答が合わない`);
  }
});

test('探索が返した解は実際に TARGET へ到達する', () => {
  for (const s of STAGES){
    const found = solvePipeline(s.challenge.input, s.challenge.target, s.challenge.ops, s.optimal);
    assert.ok(found, `${s.id} の解が見つからない`);
    assert.equal(runPipeline(s.challenge.input, found).output, s.challenge.target);
    assert.equal(found.length, s.optimal);
  }
});

test('選べる operation はすべて実在し、順番が安定している', () => {
  for (const s of STAGES){
    for (const id of s.challenge.ops) assert.ok(OP_BY_ID[id], `${s.id} に未知の op: ${id}`);
    assert.deepEqual(s.challenge.ops, sortOps(s.challenge.ops), `${s.id} の ops の順番が不安定`);
  }
});

test('到達できない Challenge には null が返る', () => {
  assert.equal(solvePipeline('abc', 'zzz', ['lower', 'upper', 'reverse'], 4), null);
});

test('validateChallenge は壊れたデータを弾く', () => {
  const ok = { input: 'a', target: 'A', ops: ['upper'], par: 1 };
  assert.equal(validateChallenge(ok), null);
  assert.ok(validateChallenge({ ...ok, ops: ['nope'] }));
  assert.ok(validateChallenge({ ...ok, ops: ['upper', 'upper'] }));
  assert.ok(validateChallenge({ ...ok, par: 0 }));
  assert.ok(validateChallenge({ ...ok, target: '' }));
  assert.ok(validateChallenge({ ...ok, input: 'x'.repeat(200) }));
});

test('★評価は最短でのみ3つ', () => {
  assert.equal(rateStars(3, 3), 3);
  assert.equal(rateStars(4, 3), 2);
  assert.equal(rateStars(5, 3), 1);
});
