/**
 * PIPELINE GOLF で使える「安全な文字列操作」の一覧。
 *
 * ユーザー入力を関数として解釈することは絶対にしない（eval / new Function は不使用）。
 * id は URL に載るので、一度公開したら変えない。増やすのは自由。
 */

const words = s => s.split(' ');

export const OPS = [
  /* --- 空白まわり --- */
  { id:'trim',     label:'trim',            desc:'前後の空白を削除',        fn:s => s.trim() },
  { id:'squeeze',  label:'dedupeSpaces',    desc:'連続する空白を1つに',     fn:s => s.replace(/ {2,}/g, ' ') },
  { id:'nospace',  label:'removeSpaces',    desc:'空白を全部削除',          fn:s => words(s).join('') },
  { id:'dash',     label:'spacesToDash',    desc:'空白を - に置換',         fn:s => words(s).join('-') },
  { id:'under',    label:'spacesToUnder',   desc:'空白を _ に置換',         fn:s => words(s).join('_') },
  { id:'dedash',   label:'dashToSpace',     desc:'- を空白に置換',          fn:s => s.split('-').join(' ') },

  /* --- 大文字小文字 --- */
  { id:'lower',    label:'lowercase',       desc:'小文字に',                fn:s => s.toLowerCase() },
  { id:'upper',    label:'uppercase',       desc:'大文字に',                fn:s => s.toUpperCase() },
  { id:'cap',      label:'capitalize',      desc:'先頭だけ大文字',          fn:s => s.charAt(0).toUpperCase() + s.slice(1) },
  { id:'title',    label:'titleCase',       desc:'各単語の先頭を大文字',    fn:s => words(s).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') },
  { id:'swapcase', label:'swapCase',        desc:'大文字と小文字を反転',    fn:s => [...s].map(ch => ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase()).join('') },

  /* --- 抽出・除去 --- */
  { id:'nodigit',  label:'removeDigits',    desc:'数字を削除',              fn:s => s.replace(/[0-9]/g, '') },
  { id:'digits',   label:'keepDigits',      desc:'数字だけ残す',            fn:s => s.replace(/[^0-9]/g, '') },
  { id:'letters',  label:'keepLetters',     desc:'英字だけ残す',            fn:s => s.replace(/[^A-Za-z]/g, '') },
  { id:'nopunct',  label:'removePunct',     desc:'英数字と空白以外を削除',  fn:s => s.replace(/[^A-Za-z0-9 ]/g, '') },
  { id:'novowel',  label:'removeVowels',    desc:'母音 aeiou を削除',       fn:s => s.replace(/[aeiouAEIOU]/g, '') },

  /* --- 切り出し --- */
  { id:'first5',   label:'first5',          desc:'先頭5文字',               fn:s => s.slice(0, 5) },
  { id:'last5',    label:'last5',           desc:'末尾5文字',               fn:s => s.slice(-5) },
  { id:'dropfirst',label:'dropFirst',       desc:'先頭1文字を削除',         fn:s => s.slice(1) },
  { id:'droplast', label:'dropLast',        desc:'末尾1文字を削除',         fn:s => s.slice(0, -1) },
  { id:'shift',    label:'rotateLeft',      desc:'先頭1文字を末尾へ',       fn:s => s.length < 2 ? s : s.slice(1) + s[0] },

  /* --- 並べ替え・複製 --- */
  { id:'reverse',  label:'reverse',         desc:'文字を逆順に',            fn:s => [...s].reverse().join('') },
  { id:'sort',     label:'sortChars',       desc:'文字を昇順に並べ替え',    fn:s => [...s].sort().join('') },
  { id:'rsort',    label:'sortCharsDesc',   desc:'文字を降順に並べ替え',    fn:s => [...s].sort().reverse().join('') },
  { id:'uniq',     label:'uniqueChars',     desc:'重複文字を削除',          fn:s => [...new Set([...s])].join('') },
  { id:'revwords', label:'reverseWords',    desc:'単語の順序を逆に',        fn:s => words(s).reverse().join(' ') },
  { id:'sortwords',label:'sortWords',       desc:'単語を辞書順に',          fn:s => words(s).sort().join(' ') },
  { id:'initials', label:'initials',        desc:'各単語の頭文字だけ',      fn:s => words(s).filter(Boolean).map(w => w[0]).join('') },
  { id:'dupe',     label:'duplicate',       desc:'同じ文字列を2回並べる',   fn:s => s + s },
  { id:'rot13',    label:'rot13',           desc:'アルファベットを13ずらす', fn:s => s.replace(/[a-zA-Z]/g, ch => {
      const base = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode((ch.charCodeAt(0) - base + 13) % 26 + base);
    }) },
  { id:'count',    label:'charCount',       desc:'文字数（数字）に置き換え', fn:s => String(s.length) },
];

export const OP_BY_ID = Object.fromEntries(OPS.map(o => [o.id, o]));
export const OP_IDS = OPS.map(o => o.id);

/** 定義順に並べ直す（URLに入れる ops の順番を安定させる） */
export function sortOps(ids){
  return OP_IDS.filter(id => ids.includes(id));
}
