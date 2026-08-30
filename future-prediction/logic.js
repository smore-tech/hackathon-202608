/**
 * 「10秒先を当てる」の戦闘シミュレータ（DOM非依存）。
 *
 * 設計の芯は「乱数を1つも使わない」こと。
 * プレイヤーは数字と並び順だけを見て結果を推理できる必要があるので、
 * 攻撃順・攻撃対象・ダメージの決め方はすべて決定的にする。
 *
 *   ・行動間隔 = 1000 / SPD（小さいほど速い）
 *   ・同時なら SPD が高い方、それも同じなら並び順が先の方
 *   ・ダメージ = ATK - 相手のARMOR（最低1）
 */

export const MAX_EVENTS = 600;

/** 攻撃対象の決め方。プレイヤーに説明できる単純さを保つ。 */
export const RULES = {
  right:     { label:'右どなり', desc:'自分のひとつ右の生存者（右端は左端へ）' },
  left:      { label:'左どなり', desc:'自分のひとつ左の生存者（左端は右端へ）' },
  weakest:   { label:'弱い者いじめ', desc:'残りHPが最も少ない生存者' },
  strongest: { label:'脅威優先', desc:'ATKが最も高い生存者（同値なら並び順が先）' },
  tank:      { label:'壁から狙う', desc:'残りHPが最も多い生存者' },
};

/** 特性。効果は1行で説明できるものだけにする。 */
export const TRAITS = {
  thorns: { label:'とげ',   desc:n => `攻撃を受けると相手に ${n} 反射`, face:'🌵' },
  armor:  { label:'よろい', desc:n => `受けるダメージ -${n}（最低1）`,  face:'🛡' },
  heal:   { label:'回復',   desc:n => `自分の番に味方1体を ${n} 回復（全員満タンなら攻撃）`, face:'✚' },
  rage:   { label:'激昂',   desc:n => `HPが半分以下で ATK +${n}`,       face:'🔥' },
  double: { label:'二連撃', desc:n => `1回の番に ${n} 回攻撃`,          face:'⚡' },
};

export function traitText(trait){
  if (!trait) return '';
  const t = TRAITS[trait.type];
  return t ? `${t.face} ${t.label}：${t.desc(trait.value)}` : '';
}

const isAlive = u => u.hp > 0;

/** 次に行動するユニット（時刻→SPD→並び順） */
function nextActor(state){
  let best = null;
  for (const u of state){
    if (!isAlive(u)) continue;
    if (!best) { best = u; continue; }
    if (u.next < best.next) best = u;
    else if (u.next === best.next && u.spd > best.spd) best = u;
  }
  return best;
}

export function pickTarget(rule, state, actor){
  const others = state.filter(u => isAlive(u) && u.i !== actor.i);
  if (!others.length) return null;
  if (rule === 'right' || rule === 'left'){
    const step = rule === 'right' ? 1 : state.length - 1;
    for (let k = 1; k < state.length; k++){
      const cand = state[(actor.i + step * k) % state.length];
      if (isAlive(cand) && cand.i !== actor.i) return cand;
    }
    return null;
  }
  const score = {
    weakest: u => -u.hp,
    strongest: u => u.atk,
    tank: u => u.hp,
  }[rule] || (u => -u.hp);
  return others.reduce((best, u) => (score(u) > score(best) ? u : best), others[0]);
}

/** 回復対象：HPの割合が最も低い味方（同率なら並び順が先） */
function pickHealTarget(state, actor){
  const hurt = state.filter(u => isAlive(u) && u.i !== actor.i && u.hp < u.max);
  if (!hurt.length) return null;
  return hurt.reduce((best, u) => (u.hp / u.max < best.hp / best.max ? u : best), hurt[0]);
}

const traitValue = (unit, type) => (unit.trait && unit.trait.type === type ? unit.trait.value : 0);

/**
 * 戦闘を最後までシミュレートする。
 * 返り値の events を順に再生すれば、そのまま画面の演出になる。
 */
export function simulateBattle(battle){
  const rule = battle.rule || 'right';
  const state = battle.units.map((u, i) => ({
    i, name: u.name, hp: u.hp, max: u.hp, atk: u.atk, spd: u.spd, trait: u.trait || null,
    next: 1000 / u.spd,
  }));
  const events = [];
  const aliveCount = () => state.filter(isAlive).length;

  const damage = (from, to, amount, time) => {
    const dealt = Math.max(1, amount - traitValue(to, 'armor'));
    to.hp = Math.max(0, to.hp - dealt);
    events.push({
      time, kind: 'attack', actor: from.i, target: to.i,
      amount: dealt, hpAfter: to.hp, ko: to.hp === 0,
    });
    return dealt;
  };

  while (aliveCount() > 1 && events.length < MAX_EVENTS){
    const actor = nextActor(state);
    if (!actor) break;
    const time = actor.next;

    const healAmount = traitValue(actor, 'heal');
    const healTarget = healAmount ? pickHealTarget(state, actor) : null;

    if (healTarget){
      const before = healTarget.hp;
      healTarget.hp = Math.min(healTarget.max, healTarget.hp + healAmount);
      events.push({
        time, kind: 'heal', actor: actor.i, target: healTarget.i,
        amount: healTarget.hp - before, hpAfter: healTarget.hp, ko: false,
      });
    } else {
      const hits = Math.max(1, traitValue(actor, 'double') || 1);
      for (let h = 0; h < hits; h++){
        if (!isAlive(actor)) break;
        const target = pickTarget(rule, state, actor);
        if (!target) break;
        const raged = traitValue(actor, 'rage') && actor.hp * 2 <= actor.max;
        damage(actor, target, actor.atk + (raged ? traitValue(actor, 'rage') : 0), time);

        const thorns = traitValue(target, 'thorns');
        if (thorns && isAlive(target)){
          actor.hp = Math.max(0, actor.hp - thorns);
          events.push({
            time, kind: 'thorns', actor: target.i, target: actor.i,
            amount: thorns, hpAfter: actor.hp, ko: actor.hp === 0,
          });
        }
      }
    }
    actor.next += 1000 / actor.spd;
  }

  const alive = state.filter(isAlive);
  const reason = alive.length === 1 ? 'ko' : events.length >= MAX_EVENTS ? 'timeout' : 'wipeout';
  return {
    events,
    winner: alive.length === 1 ? alive[0].i : -1,
    reason,
    finalHp: state.map(u => u.hp),
  };
}

/** カード表示用に「いま誰を狙っているか」を返す */
export function currentTargets(battle, hps){
  const state = battle.units.map((u, i) => ({
    i, hp: hps[i], max: u.hp, atk: u.atk, spd: u.spd, trait: u.trait || null,
  }));
  return state.map(u => {
    if (!isAlive(u)) return -1;
    if (traitValue(u, 'heal') && pickHealTarget(state, u)) return -2;   // -2 = 回復に回る
    const t = pickTarget(battle.rule || 'right', state, u);
    return t ? t.i : -1;
  });
}

/* ---------- 検証 ---------- */

export function validateBattle(b){
  if (!b || typeof b !== 'object') return '編成データが不正です';
  if (!Array.isArray(b.units) || b.units.length < 2 || b.units.length > 6) return 'ユニットは2〜6体です';
  if (!RULES[b.rule || 'right']) return '知らないターゲットルールです';
  for (const u of b.units){
    if (typeof u.name !== 'string' || !u.name) return '名前がありません';
    if (![u.hp, u.atk, u.spd].every(v => Number.isFinite(v) && v > 0)) return 'HP / ATK / SPD が不正です';
    if (u.trait && !TRAITS[u.trait.type]) return '知らない特性です';
  }
  return null;
}

/* ---------- 乱数編成（seedから再現できる） ---------- */

export function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANDOM_POOL = [
  ['スライム','🟢'], ['ドラゴン','🐲'], ['スケルトン','💀'], ['ゴースト','👻'],
  ['ロボット','🤖'], ['クマ','🐻'], ['タコ','🐙'], ['ハチ','🐝'], ['サボテン','🌵'],
  ['カニ','🦀'], ['ペンギン','🐧'], ['オオカミ','🐺'], ['ユニコーン','🦄'], ['カエル','🐸'],
];
const RANDOM_RULES = ['right', 'left', 'weakest', 'strongest', 'tank'];
const RANDOM_TRAITS = [
  null, null, null,
  { type:'thorns', value:3 }, { type:'armor', value:3 }, { type:'heal', value:12 },
  { type:'rage', value:8 }, { type:'double', value:2 },
];

/**
 * seed から編成を作る。
 * 「決着がつく」「短すぎず長すぎない」ものが出るまで seed を進めるので、
 * 同じ seed からは必ず同じ編成が出る＝URLで共有できる。
 */
export function randomBattle(seed){
  for (let attempt = 0; attempt < 40; attempt++){
    const s = (seed + attempt * 7919) >>> 0;
    const rand = mulberry32(s);
    const pool = RANDOM_POOL.slice();
    for (let i = pool.length - 1; i > 0; i--){
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const size = 3 + Math.floor(rand() * 3);          // 3〜5体
    const pick = (min, max, step = 1) => min + Math.floor(rand() * ((max - min) / step + 1)) * step;
    const units = pool.slice(0, size).map(([name, face]) => ({
      name, face, hp: pick(35, 150, 5), atk: pick(5, 20), spd: pick(2, 12),
      trait: RANDOM_TRAITS[Math.floor(rand() * RANDOM_TRAITS.length)],
    }));
    const battle = {
      id: 'random-' + s, name: 'ランダム編成', level: 'random',
      rule: RANDOM_RULES[Math.floor(rand() * RANDOM_RULES.length)], units, seed: s,
    };
    if (validateBattle(battle)) continue;
    const { winner, events } = simulateBattle(battle);
    if (winner >= 0 && events.length >= 6 && events.length <= 90) return battle;
  }
  return null;
}
