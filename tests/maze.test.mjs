import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMaze, tryMove, distancesFrom, shortestPath, keyCell, requiredSteps,
  STAGES, MODES, modeOf, findMaze, scoreOf, rateStars, DIRS,
} from '../memory-maze/logic.js';

const SEEDS = [1, 7, 1234, 55555, 987654];

test('生成した迷路は「全マスに行ける・閉路がない」完全迷路', () => {
  for (const seed of SEEDS){
    for (const size of [4, 6, 9]){
      const maze = generateMaze(size, size, seed);
      const dist = distancesFrom(maze, 0, 0);
      let reachable = 0, passages = 0;
      for (let r = 0; r < size; r++){
        for (let c = 0; c < size; c++){
          if (dist[r][c] >= 0) reachable++;
          if (c < size - 1 && !maze.v[r][c]) passages++;
          if (r < size - 1 && !maze.h[r][c]) passages++;
        }
      }
      assert.equal(reachable, size * size, '行けないマスがある');
      assert.equal(passages, size * size - 1, '閉路がある（完全迷路でない）');
    }
  }
});

test('同じ seed からは同じ迷路が出る', () => {
  assert.deepEqual(generateMaze(6, 6, 42), generateMaze(6, 6, 42));
  assert.notDeepEqual(generateMaze(6, 6, 42), generateMaze(6, 6, 43));
});

test('壁は両側から見て同じ（行って戻れる）', () => {
  const maze = generateMaze(7, 7, 314);
  const back = { up: 'down', down: 'up', left: 'right', right: 'left' };
  for (let r = 0; r < 7; r++){
    for (let c = 0; c < 7; c++){
      for (const dir of DIRS){
        const t = tryMove(maze, r, c, dir);
        if (!t.ok) continue;
        const rev = tryMove(maze, t.r, t.c, back[dir]);
        assert.ok(rev.ok && rev.r === r && rev.c === c, `${r},${c} ${dir} から戻れない`);
      }
    }
  }
});

test('外周の外へは出られず、壁情報は null になる', () => {
  const maze = generateMaze(5, 5, 9);
  assert.deepEqual(tryMove(maze, 0, 0, 'up'), { ok: false, wall: null });
  assert.deepEqual(tryMove(maze, 0, 0, 'left'), { ok: false, wall: null });
  assert.deepEqual(tryMove(maze, 4, 4, 'down'), { ok: false, wall: null });
});

test('鍵はスタートともゴールとも別のマスで、必ず到達できる', () => {
  for (const seed of SEEDS){
    const maze = generateMaze(6, 6, seed);
    const key = keyCell(maze);
    assert.ok(!(key.r === 0 && key.c === 0), '鍵がスタートにある');
    assert.ok(!(key.r === 5 && key.c === 5), '鍵がゴールにある');
    assert.ok(distancesFrom(maze, 0, 0)[key.r][key.c] > 0, '鍵に到達できない');
  }
});

test('鍵ありモードの必要歩数は「鍵経由」で、ふつうより長い', () => {
  for (const seed of SEEDS){
    const maze = generateMaze(7, 7, seed);
    const plain = requiredSteps(maze, MODES.normal);
    const withKey = requiredSteps(maze, MODES.key);
    assert.equal(plain, shortestPath(maze));
    assert.ok(withKey >= plain, '鍵ありのほうが短いのはおかしい');
  }
});

test('全ステージが遊べる迷路を返す（seed を変えても）', () => {
  for (const stage of STAGES){
    for (const seed of SEEDS){
      const maze = findMaze(stage, seed);
      assert.ok(maze, `${stage.id} で迷路が作れない`);
      assert.equal(maze.rows, stage.rows);
      assert.equal(maze.cols, stage.cols);
      const need = requiredSteps(maze, modeOf(stage));
      assert.ok(need > 0, `${stage.id} でゴールに行けない`);
    }
  }
});

test('findMaze は seed から再現できる', () => {
  const a = findMaze(STAGES[5], 20260830);
  const b = findMaze(STAGES[5], 20260830);
  assert.deepEqual(a, b);
});

test('ステージ定義は一意で、モードが実在する', () => {
  assert.ok(STAGES.length >= 12, 'ステージが減っている');
  assert.equal(new Set(STAGES.map(s => s.id)).size, STAGES.length);
  for (const s of STAGES){
    assert.ok(MODES[s.mode], `${s.id} のモードが未知: ${s.mode}`);
    assert.ok(s.peek >= 2000 && s.peek <= 8000, `${s.id} の peek が極端`);
  }
});

test('スコアと★評価', () => {
  assert.equal(scoreOf(20, 0), 20);
  assert.equal(scoreOf(20, 2), 26);
  assert.equal(rateStars(12, 0, 12), 3);
  assert.equal(rateStars(14, 1, 12), 2);
  assert.equal(rateStars(30, 9, 12), 1);
});
