import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateBattle, validateBattle, randomBattle, pickTarget, RULES, currentTargets } from '../future-prediction/logic.js';
import { BATTLES } from '../future-prediction/battles.js';

test('内蔵の編成はすべて妥当', () => {
  assert.ok(BATTLES.length >= 12, '編成が減っている');
  assert.equal(new Set(BATTLES.map(b => b.id)).size, BATTLES.length, 'id が重複している');
  for (const b of BATTLES){
    assert.equal(validateBattle(b), null, `${b.id}: ${validateBattle(b)}`);
    assert.ok(RULES[b.rule], `${b.id} のルールが未知`);
  }
});

test('内蔵の編成はすべて決着がつく（膠着・全滅で終わらない）', () => {
  for (const b of BATTLES){
    const { winner, reason, events } = simulateBattle(b);
    assert.ok(winner >= 0, `${b.id} は決着がつかない（${reason}）`);
    assert.ok(events.length > 0 && events.length < 300, `${b.id} のイベント数が異常: ${events.length}`);
  }
});

test('同じ編成なら結果は必ず同じ（乱数を使っていない）', () => {
  for (const b of BATTLES){
    const a = simulateBattle(b);
    const c = simulateBattle(b);
    assert.deepEqual(a.events, c.events, `${b.id} の再現性がない`);
    assert.equal(a.winner, c.winner);
  }
});

test('シミュレーションは元データを書き換えない', () => {
  const before = JSON.stringify(BATTLES[0]);
  simulateBattle(BATTLES[0]);
  assert.equal(JSON.stringify(BATTLES[0]), before);
});

test('ARMOR はダメージを減らすが最低1は通る', () => {
  const battle = { rule: 'right', units: [
    { name: 'A', face: '', hp: 100, atk: 3, spd: 1 },
    { name: 'B', face: '', hp: 10, atk: 1, spd: 1, trait: { type: 'armor', value: 99 } },
  ]};
  const { events } = simulateBattle(battle);
  const hit = events.find(e => e.target === 1);
  assert.equal(hit.amount, 1);
});

test('THORNS は攻撃者に反射する', () => {
  const battle = { rule: 'right', units: [
    { name: 'A', face: '', hp: 50, atk: 5, spd: 2 },
    { name: 'B', face: '', hp: 50, atk: 5, spd: 1, trait: { type: 'thorns', value: 4 } },
  ]};
  const { events } = simulateBattle(battle);
  const thorns = events.find(e => e.kind === 'thorns');
  assert.ok(thorns, '反射イベントがない');
  assert.equal(thorns.amount, 4);
  assert.equal(thorns.target, 0);
});

test('HEAL は減っている味方だけを回復する', () => {
  const battle = { rule: 'right', units: [
    { name: 'ヒーラー', face: '', hp: 60, atk: 5, spd: 3, trait: { type: 'heal', value: 10 } },
    { name: 'タンク', face: '', hp: 80, atk: 6, spd: 2 },
    { name: 'アタッカー', face: '', hp: 40, atk: 9, spd: 4 },
  ]};
  const { events } = simulateBattle(battle);
  const heals = events.filter(e => e.kind === 'heal');
  assert.ok(heals.length > 0, '回復が一度も起きない');
  for (const h of heals) assert.ok(h.amount > 0, '0回復のイベントが混ざっている');
});

test('ターゲット規則は説明どおりに選ぶ', () => {
  const state = [
    { i: 0, hp: 50, max: 50, atk: 5, spd: 1 },
    { i: 1, hp: 10, max: 50, atk: 20, spd: 1 },
    { i: 2, hp: 90, max: 90, atk: 8, spd: 1 },
  ];
  assert.equal(pickTarget('right', state, state[0]).i, 1);
  assert.equal(pickTarget('left', state, state[0]).i, 2);
  assert.equal(pickTarget('weakest', state, state[0]).i, 1);
  assert.equal(pickTarget('strongest', state, state[0]).i, 1);
  assert.equal(pickTarget('tank', state, state[0]).i, 2);
});

test('currentTargets は生存者だけを指す', () => {
  const b = BATTLES[0];
  const hps = b.units.map((u, i) => (i === 0 ? 0 : u.hp));
  const targets = currentTargets(b, hps);
  assert.equal(targets[0], -1, '死んだユニットは誰も狙わない');
  for (let i = 1; i < targets.length; i++) assert.notEqual(targets[i], 0, '死んだユニットは狙われない');
});

test('ランダム編成は seed から再現でき、必ず決着する', () => {
  for (const seed of [1, 42, 12345, 999999]){
    const a = randomBattle(seed);
    const b = randomBattle(seed);
    assert.ok(a, `seed ${seed} で編成が作れない`);
    assert.deepEqual(a, b, `seed ${seed} が再現しない`);
    assert.equal(validateBattle(a), null);
    assert.ok(simulateBattle(a).winner >= 0, `seed ${seed} で決着がつかない`);
  }
});
