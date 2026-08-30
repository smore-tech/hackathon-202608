/** ポータルに書いてあるステージ数と、実際のステージ数がズレていないか。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStages as routeStages } from '../route-golf/stages.js';
import { buildStages as pipelineStages } from '../pipeline-golf/stages.js';
import { BATTLES } from '../future-prediction/battles.js';
import { STAGES as MAZE_STAGES } from '../memory-maze/logic.js';
import { OPS } from '../pipeline-golf/ops.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('ポータルの total は実際の数と一致する', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const totals = Object.fromEntries(
    [...html.matchAll(/id:'(\w+)'[\s\S]*?total:\s*(\d+)/g)].map(m => [m[1], Number(m[2])]));

  assert.equal(totals.route, routeStages().length);
  assert.equal(totals.pipeline, pipelineStages().length);
  assert.equal(totals.future, BATTLES.length);
  assert.equal(totals.maze, MAZE_STAGES.length);
});

test('ポータルとREADMEに書いた関数の数が実際と一致する', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  assert.ok(html.includes(`${OPS.length}種類の関数`), `ポータルの関数の数が ${OPS.length} ではない`);
  assert.ok(readme.includes(`${OPS.length}種類の関数`), `README の関数の数が ${OPS.length} ではない`);
});
