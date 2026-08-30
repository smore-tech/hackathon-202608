/**
 * PIPELINE GOLF のステージ定義。
 *
 * TARGET は手で書かず、「模範解答（solution）を input に適用した結果」として計算する。
 * こうすると「到達できない TARGET」を作ってしまう事故が構造的に起きない。
 * extras は引っかけ用に混ぜる関数で、solution と合わせて選択肢になる。
 * PAR は探索で求めた最短手数 + 1。
 */
import { runPipeline, solvePipeline } from './logic.js';
import { sortOps } from './ops.js';

const DEFS = [
  /* ---------------- EASY ---------------- */
  { id:'e1', name:'まずは3手', level:'easy',
    input:'  Hello WORLD  ', solution:['trim','lower','dash'], extras:['upper','reverse','nospace'] },

  { id:'e2', name:'くっつける', level:'easy',
    input:'Pipeline Golf', solution:['lower','nospace'], extras:['trim','dash','reverse','upper','under'] },

  { id:'e3', name:'数字を落とす', level:'easy',
    input:'abc123def456', solution:['nodigit','upper'], extras:['digits','reverse','lower','sort'] },

  { id:'e4', name:'裏返す', level:'easy',
    input:'racecar level', solution:['nospace','reverse'], extras:['trim','sort','upper','uniq'] },

  { id:'e5', name:'入れ替える', level:'easy',
    input:'GitHub Pages', solution:['swapcase','revwords'], extras:['lower','upper','reverse','cap'] },

  /* ---------------- MEDIUM ---------------- */
  { id:'m1', name:'ハッカソン', level:'medium',
    input:'  HACK a THON 2026 ', solution:['nodigit','squeeze','trim','lower','dash'], extras:['upper','reverse','under'] },

  { id:'m2', name:'頭文字だけ', level:'medium',
    input:'gamma alpha beta', solution:['sortwords','initials','upper'], extras:['revwords','reverse','sort','nospace'] },

  { id:'m3', name:'13ずらし', level:'medium',
    input:'Hello World', solution:['rot13','lower','nospace'], extras:['upper','reverse','swapcase','uniq'] },

  { id:'m4', name:'伝票の数字', level:'medium',
    input:'Order #12 / Item #345', solution:['digits','dupe'], extras:['nodigit','reverse','sort','uniq','nopunct'] },

  { id:'m5', name:'重複を潰す', level:'medium',
    input:'Mississippi River', solution:['lower','nospace','uniq','sort'], extras:['reverse','digits','novowel','upper'] },

  { id:'m6', name:'母音ぬき', level:'medium',
    input:'  Data Science 2026  ', solution:['nodigit','trim','lower','novowel','under'], extras:['upper','reverse','squeeze','dash'] },

  /* ---------------- HARD ---------------- */
  { id:'h1', name:'並べ替えて逆に', level:'hard',
    input:'banana bandana', solution:['nospace','uniq','sort','reverse'], extras:['lower','upper','digits','novowel','revwords'] },

  { id:'h2', name:'複製してから削る', level:'hard',
    input:'a1b2c3', solution:['dupe','nodigit','upper','droplast'], extras:['digits','reverse','sort','uniq','dropfirst'] },

  { id:'h3', name:'長い文を削る', level:'hard',
    input:'The Quick Brown Fox Jumps', solution:['lower','novowel','nospace','last5','reverse'], extras:['upper','sort','initials','first5','dropfirst'] },

  { id:'h4', name:'かぞえる', level:'hard',
    input:'  Deploy to GitHub Pages  ', solution:['trim','nospace','count'], extras:['reverse','sort','uniq','upper','digits','shift'] },

  { id:'h5', name:'最終問題', level:'hard',
    input:'  RE-USE the Code 2026  ', solution:['nodigit','dedash','squeeze','trim','lower','initials','upper'],
    extras:['reverse','sort','nospace','dash','under'] },
];

/** ステージ一覧を作る（TARGET と PAR を計算して埋める） */
export function buildStages(){
  return DEFS.map((def, i) => {
    const target = runPipeline(def.input, def.solution).output;
    const ops = sortOps([...new Set([...def.solution, ...def.extras])]);
    const best = solvePipeline(def.input, target, ops, def.solution.length);
    if (!best) throw new Error(`ステージ ${def.id} の TARGET に到達できません`);
    return {
      ...def, no: i + 1, optimal: best.length,
      challenge: { input: def.input, target, ops, par: best.length + 1 },
    };
  });
}

export const STAGE_DEFS = DEFS;
