/**
 * Challenge / Seed を URL fragment に載せるための共通ユーティリティ（ESM）。
 *
 *   JSON  →  UTF-8  →  Base64 URL Safe  →  #c=xxxxx
 *
 * サーバーもDBも使わないので、URLそのものがゲームデータになる。
 * 復元するのは「データ」だけで、コードは絶対に復元しない（eval / Function は使わない）。
 */

export const VERSION = 1;
export const MAX_ENCODED = 4000;   // 現実的にコピペできるURL長の上限

/* ---------- Base64 URL Safe ---------- */

export function toBase64Url(text){
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(encoded){
  let s = String(encoded).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const binary = atob(s);
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/* ---------- Challenge のエンコード / デコード ---------- */

export function encodeChallenge(type, data){
  const encoded = toBase64Url(JSON.stringify({ version: VERSION, type, data }));
  if (encoded.length > MAX_ENCODED) throw new Error('Challenge が大きすぎます');
  return encoded;
}

/** 壊れたURLは例外ではなく ok:false を返し、呼び出し側で Invalid Challenge を出す */
export function decodeChallenge(encoded, expectedType){
  let parsed;
  try {
    parsed = JSON.parse(fromBase64Url(encoded));
  } catch {
    return { ok: false, error: 'URLを復元できませんでした' };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: '中身が Challenge の形をしていません' };
  if (parsed.version !== VERSION) return { ok: false, error: `未対応のバージョンです (v${parsed.version})` };
  if (parsed.type !== expectedType) return { ok: false, error: `別のゲームの Challenge です (type: ${parsed.type})` };
  if (!parsed.data || typeof parsed.data !== 'object') return { ok: false, error: 'data がありません' };
  return { ok: true, data: parsed.data };
}

/* ---------- location とのやり取り ---------- */

export function hashParams(){
  return new URLSearchParams(location.hash.replace(/^#/, ''));
}

/**
 * 現在のURLから Challenge を読む。
 * 読めなければ fallback を返し、source で理由を伝える。
 */
export function readChallenge({ type, validate, fallback }){
  const encoded = hashParams().get('c');
  if (!encoded) return { data: fallback(), source: 'default' };

  const decoded = decodeChallenge(encoded, type);
  if (!decoded.ok) return { data: fallback(), source: 'invalid', error: decoded.error };

  const problem = validate(decoded.data);
  if (problem) return { data: fallback(), source: 'invalid', error: problem };

  return { data: decoded.data, source: 'url' };
}

export function challengeUrl(type, data){
  return location.href.split('#')[0] + '#c=' + encodeChallenge(type, data);
}

/** URLを書き換えるが履歴は汚さない */
export function setHash(type, data){
  history.replaceState(null, '', '#c=' + encodeChallenge(type, data));
}

/** #a=1&b=2 形式の軽い共有（迷路の seed など、JSONを使うほどでもないもの） */
export function paramsUrl(obj){
  const q = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => q.set(k, String(v)));
  return location.href.split('#')[0] + '#' + q.toString();
}

export function setParamsHash(obj){
  const q = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => q.set(k, String(v)));
  history.replaceState(null, '', '#' + q.toString());
}

export function clearHash(){
  history.replaceState(null, '', location.pathname + location.search);
}

/* ---------- コピー ---------- */

/**
 * navigator.clipboard が使えない環境（file:// や古いブラウザ）でも詰まないよう、
 * 失敗したら必ずテキスト欄に出して手動コピーできるようにする。
 */
export function copyText(text, outputEl, statusEl){
  if (outputEl){ outputEl.value = text; outputEl.hidden = false; }
  const done = (msg, ok) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'copy-status ' + (ok ? 'ok' : 'warn');
  };
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text)
      .then(() => done('✅ コピーしました', true))
      .catch(() => done('⚠️ 自動コピーできません。下のテキストを手動でコピーしてください', false));
  } else {
    done('⚠️ このブラウザでは自動コピーできません。下のテキストを手動でコピーしてください', false);
    if (outputEl){ outputEl.focus(); outputEl.select(); }
  }
}

/* ---------- 小物 ---------- */

export function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** " Hello " のように、前後の空白が見えるように表示する */
export function quote(s){
  return '"' + escapeHtml(s).replace(/ /g, '·') + '"';
}

/** PAR との差を "PAR -1" / "PAR" / "PAR +2" の形にする */
export function parLabel(used, par){
  const diff = used - par;
  if (diff === 0) return { text: 'PAR', tone: 'even' };
  if (diff < 0) return { text: `PAR ${diff}`, tone: 'under' };
  return { text: `PAR +${diff}`, tone: 'over' };
}
