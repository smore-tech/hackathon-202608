import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toBase64Url, fromBase64Url, encodeChallenge, decodeChallenge, parLabel, quote, escapeHtml,
} from '../shared/url-codec.js';

test('Base64URL は日本語や記号を往復できる', () => {
  for (const s of ['hello', '日本語テキスト', 'a+b/c=d', '  空白  ', '🤖★🏁']){
    assert.equal(fromBase64Url(toBase64Url(s)), s);
  }
});

test('Base64URL に + / = は現れない（URLに載せられる）', () => {
  const encoded = toBase64Url('?'.repeat(50) + '日本語');
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
});

test('Challenge はエンコード→デコードで元に戻る', () => {
  const data = { w: 5, h: 5, walls: [1, 2], par: 7 };
  const decoded = decodeChallenge(encodeChallenge('route', data), 'route');
  assert.equal(decoded.ok, true);
  assert.deepEqual(decoded.data, data);
});

test('壊れたURL・別ゲームのURLは例外ではなく ok:false になる', () => {
  assert.equal(decodeChallenge('!!!not-base64!!!', 'route').ok, false);
  assert.equal(decodeChallenge(toBase64Url('{"nope":1}'), 'route').ok, false);
  assert.equal(decodeChallenge(encodeChallenge('pipeline', { a: 1 }), 'route').ok, false);
  assert.equal(decodeChallenge(toBase64Url(JSON.stringify({ version: 99, type: 'route', data: {} })), 'route').ok, false);
});

test('parLabel は PAR との差を表す', () => {
  assert.deepEqual(parLabel(5, 5), { text: 'PAR', tone: 'even' });
  assert.equal(parLabel(4, 5).text, 'PAR -1');
  assert.equal(parLabel(7, 5).text, 'PAR +2');
});

test('表示用の文字列はエスケープされる', () => {
  assert.equal(escapeHtml('<b>&"'), '&lt;b&gt;&amp;&quot;');
  assert.equal(quote(' a '), '"·a·"');
});
