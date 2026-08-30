/**
 * 「10秒先を当てる」の編成一覧。
 *
 * 数字と特性は全部見えている。乱数もない。
 * 「見えているのに読み切れない」ラインを狙って組んである。
 */

export const BATTLES = [
  /* ---------------- EASY：ルールを覚える ---------------- */
  { id:'b1', name:'素の殴り合い', level:'easy', rule:'right',
    hint:'ATK×SPD が実質の火力。HPが多いだけでは勝てない。',
    units:[
      { name:'ガーディアン', face:'🛡️', hp:120, atk:8,  spd:3 },
      { name:'アサシン',     face:'🗡️', hp:40,  atk:14, spd:9 },
      { name:'レンジャー',   face:'🏹', hp:70,  atk:10, spd:5 },
    ]},

  { id:'b2', name:'四つ巴', level:'easy', rule:'right',
    hint:'誰が誰を殴るかは並び順で決まる。輪の中で最初に落ちるのは？',
    units:[
      { name:'ゴーレム',     face:'🗿', hp:150, atk:6,  spd:2 },
      { name:'ウィザード',   face:'🔮', hp:55,  atk:18, spd:4 },
      { name:'ナイフ使い',   face:'🔪', hp:45,  atk:7,  spd:10 },
      { name:'ソルジャー',   face:'⚔️', hp:90,  atk:9,  spd:5 },
    ]},

  { id:'b3', name:'弱い者いじめ', level:'easy', rule:'weakest',
    hint:'全員が「残りHP最小」を狙う。最初に削られた者は集中砲火を浴びる。',
    units:[
      { name:'バーサーカー', face:'🔥', hp:60,  atk:20, spd:6 },
      { name:'シーフ',       face:'💨', hp:35,  atk:9,  spd:12 },
      { name:'ランサー',     face:'🔱', hp:80,  atk:11, spd:5 },
      { name:'ガードマン',   face:'🧱', hp:130, atk:7,  spd:3 },
    ]},

  { id:'b4', name:'よろいの壁', level:'easy', rule:'right',
    hint:'ARMOR 5 は ATK 6 をほぼ無効化する。小さな攻撃は通らない。',
    units:[
      { name:'重装兵',       face:'🛡️', hp:100, atk:6,  spd:4, trait:{ type:'armor', value:5 } },
      { name:'こばん虫',     face:'🐞', hp:50,  atk:6,  spd:9 },
      { name:'大剣士',       face:'⚔️', hp:70,  atk:16, spd:3 },
    ]},

  /* ---------------- MEDIUM：特性が絡む ---------------- */
  { id:'b5', name:'とげの反射', level:'medium', rule:'right',
    hint:'速い攻撃ほど、反射も多く受ける。',
    units:[
      { name:'サボテン',     face:'🌵', hp:90,  atk:5,  spd:3, trait:{ type:'thorns', value:6 } },
      { name:'連撃士',       face:'💨', hp:55,  atk:8,  spd:11 },
      { name:'重騎士',       face:'🐴', hp:85,  atk:12, spd:4 },
    ]},

  { id:'b6', name:'回復役は生き残るか', level:'medium', rule:'weakest',
    hint:'回復は「HP割合が一番低い味方」に飛ぶ。自分は回復できない。',
    units:[
      { name:'クレリック',   face:'✨', hp:80,  atk:6,  spd:5, trait:{ type:'heal', value:14 } },
      { name:'戦士',         face:'⚔️', hp:110, atk:11, spd:4 },
      { name:'弓兵',         face:'🏹', hp:60,  atk:13, spd:6 },
      { name:'狂戦士',       face:'🔥', hp:70,  atk:15, spd:5 },
    ]},

  { id:'b7', name:'追い詰めると強い', level:'medium', rule:'strongest',
    hint:'全員が「ATK最大」を狙う。激昂で ATK が上がると、狙われ方も変わる。',
    units:[
      { name:'暴走ロボ',     face:'🤖', hp:80,  atk:9,  spd:5, trait:{ type:'rage', value:10 } },
      { name:'狙撃手',       face:'🎯', hp:55,  atk:14, spd:5 },
      { name:'僧兵',         face:'🪷', hp:95,  atk:8,  spd:4 },
      { name:'かげ',         face:'👤', hp:45,  atk:11, spd:8 },
    ]},

  { id:'b8', name:'二連撃', level:'medium', rule:'left',
    hint:'狙う方向が逆になるだけで、輪の回り方は反対になる。',
    units:[
      { name:'双剣士',       face:'⚔️', hp:65,  atk:7,  spd:6, trait:{ type:'double', value:2 } },
      { name:'岩男',         face:'🗿', hp:140, atk:9,  spd:3 },
      { name:'術師',         face:'🔮', hp:50,  atk:17, spd:4 },
      { name:'狼',           face:'🐺', hp:70,  atk:10, spd:7 },
    ]},

  /* ---------------- HARD：噛み合わせを読む ---------------- */
  { id:'b9', name:'とげ＋よろい', level:'hard', rule:'weakest',
    hint:'反射ダメージは ARMOR を無視しない。誰が反射で沈む？',
    units:[
      { name:'棘の亀',       face:'🐢', hp:110, atk:4,  spd:3, trait:{ type:'thorns', value:7 } },
      { name:'鉄仮面',       face:'🛡️', hp:90,  atk:8,  spd:5, trait:{ type:'armor', value:4 } },
      { name:'速攻兵',       face:'💨', hp:50,  atk:9,  spd:10 },
      { name:'大砲',         face:'💣', hp:60,  atk:19, spd:2 },
    ]},

  { id:'b10', name:'壁から崩す', level:'hard', rule:'tank',
    hint:'全員が「残りHP最大」を狙う。HPが多い＝最初の的。',
    units:[
      { name:'巨人',         face:'🗿', hp:160, atk:10, spd:3 },
      { name:'衛兵',         face:'🛡️', hp:100, atk:7,  spd:5, trait:{ type:'armor', value:3 } },
      { name:'呪術師',       face:'🔮', hp:70,  atk:15, spd:4 },
      { name:'子鬼',         face:'👹', hp:45,  atk:6,  spd:9 },
      { name:'旅人',         face:'🎒', hp:55,  atk:9,  spd:6 },
    ]},

  { id:'b11', name:'五体乱戦', level:'hard', rule:'right',
    hint:'1体落ちるたびに攻撃先が繋ぎ変わる。輪が縮む順番まで読めるか。',
    units:[
      { name:'剣聖',         face:'⚔️', hp:85,  atk:12, spd:5 },
      { name:'盾兵',         face:'🛡️', hp:120, atk:6,  spd:4, trait:{ type:'armor', value:2 } },
      { name:'魔女',         face:'🧙', hp:55,  atk:16, spd:4 },
      { name:'疾風',         face:'💨', hp:48,  atk:8,  spd:11 },
      { name:'鉄球',         face:'🔨', hp:100, atk:14, spd:2 },
    ]},

  { id:'b12', name:'総力戦', level:'hard', rule:'strongest',
    hint:'回復・激昂・とげ・二連撃が全部入り。最後に立つのは誰だ。',
    units:[
      { name:'聖女',         face:'✨', hp:75,  atk:5,  spd:6, trait:{ type:'heal', value:16 } },
      { name:'狂戦士',       face:'🔥', hp:90,  atk:11, spd:5, trait:{ type:'rage', value:9 } },
      { name:'棘鎧',         face:'🌵', hp:105, atk:7,  spd:4, trait:{ type:'thorns', value:5 } },
      { name:'双刃',         face:'⚔️', hp:60,  atk:6,  spd:7, trait:{ type:'double', value:2 } },
      { name:'砲台',         face:'💣', hp:80,  atk:17, spd:3 },
    ]},
];
