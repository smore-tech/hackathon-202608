/**
 * 画面まわりの静的チェック。
 * ブラウザを立ち上げずに「よくある壊れ方」だけを潰す：
 *   - main.js が触っている id が HTML にない
 *   - HTML の id が重複している
 *   - link / script / a href が指すファイルが存在しない
 *   - import しているモジュールが存在しない
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = [
  { dir: 'route-golf' },
  { dir: 'pipeline-golf' },
  { dir: 'future-prediction' },
  { dir: 'memory-maze' },
];

const read = p => readFileSync(join(ROOT, p), 'utf8');
const matchAll = (re, text) => [...text.matchAll(re)].map(m => m[1]);

test('HTML の id は重複していない', () => {
  for (const { dir } of [...PAGES, { dir: '.' }]){
    const html = read(join(dir, 'index.html'));
    const ids = matchAll(/\sid="([^"]+)"/g, html);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(dup, [], `${dir}/index.html に重複した id: ${dup.join(', ')}`);
  }
});

test('main.js が触っている id はすべて HTML に存在する', () => {
  for (const { dir } of PAGES){
    const html = read(join(dir, 'index.html'));
    const js = read(join(dir, 'main.js'));
    const ids = new Set(matchAll(/\sid="([^"]+)"/g, html));
    const used = new Set([
      ...matchAll(/\$\('([^']+)'\)/g, js),
      ...matchAll(/getElementById\('([^']+)'\)/g, js),
    ]);
    const missing = [...used].filter(id => !ids.has(id));
    assert.deepEqual(missing, [], `${dir}/main.js が存在しない id を参照: ${missing.join(', ')}`);
  }
});

test('HTML が参照するローカルファイルは実在する', () => {
  for (const { dir } of [...PAGES, { dir: '.' }]){
    const page = join(dir, 'index.html');
    const html = read(page);
    const refs = [
      ...matchAll(/<link[^>]+href="([^"]+)"/g, html),
      ...matchAll(/<script[^>]+src="([^"]+)"/g, html),
      ...matchAll(/<a[^>]+href="([^"]+)"/g, html),
    ].filter(href => !/^(https?:|mailto:|#)/.test(href) && !href.includes('${'));   // テンプレートリテラル内は対象外
    for (const ref of refs){
      const target = resolve(ROOT, dirname(page), ref);
      assert.ok(existsSync(target), `${page} から参照している ${ref} が存在しない`);
    }
  }
});

test('JS の import 先はすべて実在する', () => {
  const files = [
    ...PAGES.map(p => join(p.dir, 'main.js')),
    ...PAGES.map(p => join(p.dir, 'logic.js')),
    'route-golf/stages.js', 'pipeline-golf/stages.js', 'pipeline-golf/ops.js',
    'future-prediction/battles.js', 'memory-maze/logic.js',
  ];
  for (const file of files){
    const js = read(file);
    for (const spec of matchAll(/from\s+'([^']+)'/g, js)){
      assert.ok(spec.startsWith('.'), `${file}: 外部パッケージへの import は使わない (${spec})`);
      const target = resolve(ROOT, dirname(file), spec);
      assert.ok(existsSync(target), `${file} の import 先 ${spec} が存在しない`);
    }
  }
});

test('各ページは共通CSSと自分の main.js を読み込んでいる', () => {
  for (const { dir } of PAGES){
    const html = read(join(dir, 'index.html'));
    assert.match(html, /href="\.\.\/shared\/base\.css"/, `${dir} が共通CSSを読んでいない`);
    assert.match(html, /<script type="module" src="\.\/main\.js">/, `${dir} が main.js を module として読んでいない`);
    assert.match(html, /href="\.\.\/index\.html"/, `${dir} にポータルへ戻る導線がない`);
  }
});

test('ポータルの4本へのリンクが揃っている', () => {
  const html = read('index.html');
  for (const { dir } of PAGES){
    assert.ok(html.includes(`${dir}/index.html`), `ポータルに ${dir} へのリンクがない`);
  }
});

test('eval / new Function は使っていない（URLのデータからコードを作らない）', () => {
  const files = [
    'shared/url-codec.js', 'shared/storage.js', 'shared/ui.js',
    ...PAGES.flatMap(p => [join(p.dir, 'main.js'), join(p.dir, 'logic.js')]),
  ];
  for (const file of files){
    const js = read(file);
    assert.doesNotMatch(js, /\beval\s*\(/, `${file} で eval を使っている`);
    assert.doesNotMatch(js, /new\s+Function\s*\(/, `${file} で new Function を使っている`);
  }
});
