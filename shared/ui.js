/** DOM まわりの小物。ゲームロジックからは import しない（ロジックはDOM非依存に保つ）。 */

export const $ = id => document.getElementById(id);

export const wait = ms => new Promise(r => setTimeout(r, ms));

/** ★★☆ のような表示を作る */
export function starGlyphs(count, max = 3){
  let out = '';
  for (let i = 0; i < max; i++) out += i < count ? '★' : '<span class="off">★</span>';
  return out;
}

export function setText(id, text){
  const el = $(id);
  if (el) el.textContent = text;
}

export function setResult(el, kind, html){
  el.className = 'result ' + kind;
  el.innerHTML = html;
}

export function setBanner(el, kind, text){
  el.className = 'banner ' + (kind || '');
  el.textContent = text;
}

export function showNotice(el, kind, text){
  el.hidden = false;
  el.className = 'notice ' + (kind || '');
  el.textContent = text;
}

/** タブ切り替えの共通処理。views は { name: element }、buttons は { name: element }。 */
export function makeTabs(views, buttons, onSwitch){
  function switchTo(name){
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; });
    Object.entries(buttons).forEach(([k, el]) => el.classList.toggle('on', k === name));
    if (onSwitch) onSwitch(name);
  }
  Object.entries(buttons).forEach(([k, el]) => el.addEventListener('click', () => switchTo(k)));
  return switchTo;
}

/** 数値を 12.3 のような固定小数で */
export function fixed(n, digits = 1){
  return Number(n).toFixed(digits);
}

/** 重い処理（探索など）を入力のたびに走らせないための遅延実行 */
export function debounce(fn, ms = 250){
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** 入力欄にフォーカスしている間はゲームのキー操作を無効化したい */
export function isTypingTarget(target){
  return Boolean(target && target.matches && target.matches('input, textarea, select'));
}
