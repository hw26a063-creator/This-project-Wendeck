import { Card, Enemy, Relic, MapNode, GameEvent, GameState, CardEffect } from './types';

// Unique card template definitions
export const CARD_TEMPLATES: Omit<Card, 'id'>[] = [
  // --- ATTACKS (攻撃) ---
  {
    originalId: 'strike',
    name: 'ストライク',
    description: '敵に6のダメージを与える。',
    type: 'attack',
    cost: 1,
    rarity: 'common',
    isUpgraded: false,
    effects: [{ type: 'damage', value: 6, target: 'enemy' }]
  },
  {
    originalId: 'heavy_blow',
    name: '渾身の撃',
    description: '敵に12のダメージを与える。重量感ある一撃。',
    type: 'attack',
    cost: 2,
    rarity: 'uncommon',
    isUpgraded: false,
    effects: [{ type: 'damage', value: 12, target: 'enemy' }]
  },
  {
    originalId: 'fury_slash',
    name: '怒気の斬撃',
    description: '敵に7のダメージ。怒気(Fury)を15獲得する。',
    type: 'attack',
    cost: 1,
    rarity: 'common',
    isUpgraded: false,
    effects: [
      { type: 'damage', value: 7, target: 'enemy' },
      { type: 'fury', value: 15, target: 'player' }
    ]
  },
  {
    originalId: 'double_strike',
    name: '連続突き',
    description: '敵に4のダメージを2回与える。手の込んだ双撃。',
    type: 'attack',
    cost: 1,
    rarity: 'uncommon',
    isUpgraded: false,
    effects: [
      { type: 'damage', value: 4, target: 'enemy' },
      { type: 'damage', value: 4, target: 'enemy' }
    ]
  },
  {
    originalId: 'shield_slam',
    name: '盾撃 (シールドバッシュ)',
    description: '敵に5のダメージ。さらに現在のブロック(Block)分の追加ダメージを与える。',
    type: 'attack',
    cost: 1,
    rarity: 'uncommon',
    isUpgraded: false,
    effects: [
      { type: 'damage', value: 5, target: 'enemy' },
      { type: 'random_damage', value: 0, target: 'enemy' } // Special block-dependent rule handled in evaluation
    ]
  },
  {
    originalId: 'reapers_sweep',
    name: '死神の薙ぎ払い',
    description: 'すべての敵に9のダメージを与える。与えたダメージの50%分、体力を回復する。',
    type: 'attack',
    cost: 2,
    rarity: 'rare',
    isUpgraded: false,
    effects: [
      { type: 'damage', value: 9, target: 'all_enemies' },
      { type: 'heal', value: 5, target: 'player' } // special evaluation for damage-ratio heal
    ]
  },
  {
    originalId: 'cleave',
    name: '薙ぎ払い',
    description: 'すべての敵に6のダメージを与える。',
    type: 'attack',
    cost: 1,
    rarity: 'common',
    isUpgraded: false,
    effects: [{ type: 'damage', value: 6, target: 'all_enemies' }]
  },

  // --- DEFENSE (防御) ---
  {
    originalId: 'defend',
    name: '防御',
    description: 'ブロックを5獲得する。次の受けるダメージを防ぐ。',
    type: 'defense',
    cost: 1,
    rarity: 'common',
    isUpgraded: false,
    effects: [{ type: 'block', value: 5, target: 'player' }]
  },
  {
    originalId: 'iron_wall',
    name: '鉄壁の備え',
    description: 'ブロックを11獲得する。強固な守りを固める。',
    type: 'defense',
    cost: 2,
    rarity: 'uncommon',
    isUpgraded: false,
    effects: [{ type: 'block', value: 11, target: 'player' }]
  },
  {
    originalId: 'parry_counter',
    name: '受け流しと反撃',
    description: 'ブロックを4獲得する。同時に敵に4のダメージを与える。',
    type: 'defense',
    cost: 1,
    rarity: 'common',
    isUpgraded: false,
    effects: [
      { type: 'block', value: 4, target: 'player' },
      { type: 'damage', value: 4, target: 'enemy' }
    ]
  },
  {
    originalId: 'shadow_step',
    name: '幻影の歩法',
    description: 'ブロックを6獲得する。敵に脱力(Weak:攻撃力25%低下)を1与える。',
    type: 'defense',
    cost: 1,
    rarity: 'uncommon',
    isUpgraded: false,
    effects: [
      { type: 'block', value: 6, target: 'player' },
      { type: 'weak', value: 1, target: 'enemy' }
    ]
  },
  {
    originalId: 'fortress',
    name: '不落の城塞',
    description: 'ブロックを16獲得し、強制的に「防御の構え」に変更する。',
    type: 'defense',
    cost: 2,
    rarity: 'rare',
    isUpgraded: false,
    effects: [
      { type: 'block', value: 16, target: 'player' },
      { type: 'stance', value: 0, target: 'player', stanceValue: 'defensive' }
    ]
  },

  // --- SKILLS (スキル) ---
  {
    originalId: 'battle_cry',
    name: '雄叫び',
    description: '怒気を25獲得する。カードを1枚引く。手札を循環。',
    type: 'skill',
    cost: 0,
    rarity: 'common',
    isUpgraded: false,
    effects: [
      { type: 'fury', value: 25, target: 'player' },
      { type: 'draw', value: 1, target: 'player' }
    ]
  },
  {
    originalId: 'stance_shift',
    name: '戦闘の構え',
    description: '「劇撃の構え」(与ダメ+25%, 被ダメ+25%)に変更する。カードを1枚引く。',
    type: 'skill',
    cost: 0,
    rarity: 'common',
    isUpgraded: false,
    effects: [
      { type: 'stance', value: 0, target: 'player', stanceValue: 'assault' },
      { type: 'draw', value: 1, target: 'player' }
    ]
  },
  {
    originalId: 'defensive_stance_shift',
    name: '防御の構え',
    description: '「防御の構え」(得ブロック+30%)に変更する。カードを1枚引く。',
    type: 'skill',
    cost: 0,
    rarity: 'common',
    isUpgraded: false,
    effects: [
      { type: 'stance', value: 0, target: 'player', stanceValue: 'defensive' },
      { type: 'draw', value: 1, target: 'player' }
    ]
  },
  {
    originalId: 'focus_mind',
    name: '明鏡止水',
    description: '体力を6回復し、筋力(Strength)を1獲得する。戦闘中の安定力を高める。',
    type: 'skill',
    cost: 1,
    rarity: 'uncommon',
    isUpgraded: false,
    effects: [
      { type: 'heal', value: 6, target: 'player' },
      { type: 'strength', value: 1, target: 'player' }
    ]
  },
  {
    originalId: 'piercing_roar',
    name: '威圧の咆哮',
    description: 'すべての敵に脱力(Weak)を2、被ダメージが50%増加する脆弱(Vulnerable)を2与える。',
    type: 'skill',
    cost: 1,
    rarity: 'uncommon',
    isUpgraded: false,
    effects: [
      { type: 'weak', value: 2, target: 'all_enemies' },
      { type: 'vulnerable', value: 2, target: 'all_enemies' }
    ]
  },
  {
    originalId: 'adrenaline',
    name: '限界突破',
    description: '怒気(Fury)を50獲得する。筋力を2増やすが、脆弱を1受ける。',
    type: 'skill',
    cost: 1,
    rarity: 'rare',
    isUpgraded: false,
    effects: [
      { type: 'fury', value: 50, target: 'player' },
      { type: 'strength', value: 2, target: 'player' },
      { type: 'vulnerable', value: 1, target: 'player' } // self de-buff
    ]
  },
  {
    originalId: 'rage_release',
    name: '狂乱放出',
    description: '現在の怒気(Fury)をすべて消費し、消費した怒気の 1/5 に等しい筋力(Strength)をその戦闘中獲得する。',
    type: 'skill',
    cost: 1,
    rarity: 'rare',
    isUpgraded: false,
    effects: [
      { type: 'strength', value: 0, target: 'player' } // rule: fury consumes inside evaluation
    ]
  },
  {
    originalId: 'fury_strike',
    name: '爆裂怒気斬',
    description: '敵に6のダメージ。自分の怒気(Fury)が50以上なら、追加で6のボーナスダメージを与える。',
    type: 'attack',
    cost: 1,
    rarity: 'uncommon',
    isUpgraded: false,
    effects: [
      { type: 'damage', value: 6, target: 'enemy' }
    ]
  },
  {
    originalId: 'blood_drinker',
    name: '黒鉄の吸血刃',
    description: '敵に7のダメージ。自分の体力を3回復する。',
    type: 'attack',
    cost: 1,
    rarity: 'rare',
    isUpgraded: false,
    effects: [
      { type: 'damage', value: 7, target: 'enemy' },
      { type: 'heal', value: 3, target: 'player' }
    ]
  },
  {
    originalId: 'sweeping_fury',
    name: '旋風烈波',
    description: 'すべての敵に4のダメージ。相手全員に脱力(Weak)を1付与する。',
    type: 'attack',
    cost: 1,
    rarity: 'uncommon',
    isUpgraded: false,
    effects: [
      { type: 'damage', value: 4, target: 'all_enemies' },
      { type: 'weak', value: 1, target: 'all_enemies' }
    ]
  },
  {
    originalId: 'vanguard_shield',
    name: '先陣の剛盾',
    description: 'ブロックを7獲得する。さらに怒気(Fury)を10獲得する。',
    type: 'defense',
    cost: 1,
    rarity: 'common',
    isUpgraded: false,
    effects: [
      { type: 'block', value: 7, target: 'player' },
      { type: 'fury', value: 10, target: 'player' }
    ]
  },
  {
    originalId: 'divine_protection',
    name: '戦神の加護',
    description: 'ブロックを14獲得。自身を「防御の構え」に変更する。カードを1枚引く。',
    type: 'defense',
    cost: 2,
    rarity: 'uncommon',
    isUpgraded: false,
    effects: [
      { type: 'block', value: 14, target: 'player' },
      { type: 'stance', value: 0, target: 'player', stanceValue: 'defensive' },
      { type: 'draw', value: 1, target: 'player' }
    ]
  },
  {
    originalId: 'adrenaline_rush',
    name: 'ブラッドラッシュ',
    description: 'カードを2枚引く。さらに怒気を15獲得する（ただしターン終了時まで）。',
    type: 'skill',
    cost: 0,
    rarity: 'uncommon',
    isUpgraded: false,
    effects: [
      { type: 'draw', value: 2, target: 'player' },
      { type: 'fury', value: 15, target: 'player' }
    ]
  },
  {
    originalId: 'overpower',
    name: '威圧',
    description: '敵全体に脱力(Weak)を1付与し、怒気(Fury)を15獲得する。',
    type: 'skill',
    cost: 1,
    rarity: 'uncommon',
    isUpgraded: false,
    effects: [
      { type: 'weak', value: 1, target: 'all_enemies' },
      { type: 'fury', value: 15, target: 'player' }
    ]
  },
  {
    originalId: 'shield_spike',
    name: 'スパイクシールド',
    description: 'ブロックを8獲得する。敵単体に4のダメージを2回与える。',
    type: 'defense',
    cost: 1,
    rarity: 'uncommon',
    isUpgraded: false,
    effects: [
      { type: 'block', value: 8, target: 'player' },
      { type: 'damage', value: 4, target: 'enemy' },
      { type: 'damage', value: 4, target: 'enemy' }
    ]
  },
  {
    originalId: 'furious_charge',
    name: 'フューリアスチャージ',
    description: '敵単体に14のダメージを与える。構えが「劇撃の構え」なら、追加で怒気(Fury)を20獲得する。',
    type: 'attack',
    cost: 2,
    rarity: 'uncommon',
    isUpgraded: false,
    effects: [
      { type: 'damage', value: 14, target: 'enemy' }
    ]
  },
  {
    originalId: 'vanguard_will',
    name: '先陣の意志',
    description: 'エネルギーを1回復する。怒気(Fury)を15獲得し、カードを1枚引く。',
    type: 'skill',
    cost: 0,
    rarity: 'rare',
    isUpgraded: false,
    effects: [
      { type: 'fury', value: 15, target: 'player' },
      { type: 'draw', value: 1, target: 'player' }
    ]
  },
  {
    originalId: 'blood_bath',
    name: '血の饗宴',
    description: 'すべての敵に15のダメージを与える。怒気(Fury)を25獲得する。',
    type: 'attack',
    cost: 3,
    rarity: 'rare',
    isUpgraded: false,
    effects: [
      { type: 'damage', value: 15, target: 'all_enemies' },
      { type: 'fury', value: 25, target: 'player' }
    ]
  },
  {
    originalId: 'fury_barrier',
    name: 'フューリーバリア',
    description: 'ブロックを6獲得する。怒気(Fury)が50以上なら、獲得するブロックが2倍(12)になる。',
    type: 'defense',
    cost: 1,
    rarity: 'common',
    isUpgraded: false,
    effects: [
      { type: 'block', value: 6, target: 'player' }
    ]
  }
];

// Generate an individual unique instance of a card with a random UID suffix
export function createCardInstance(template: Omit<Card, 'id'>): Card {
  const uniqPart = Math.random().toString(36).substr(2, 6);
  return {
    ...template,
    id: `${template.originalId}_${uniqPart}`
  };
}

// Relic definitions
export const RELIC_LIST: Relic[] = [
  {
    id: 'blood_ember',
    name: '血の残り火',
    description: '戦闘に勝利した時、体力を4回復する。',
    icon: 'Flame'
  },
  {
    id: 'buckler',
    name: '盤石のバックラー',
    description: '戦闘開始時、ブロックを6獲得する。',
    icon: 'ShieldAlert',
    price: 110
  },
  {
    id: 'pendant',
    name: '戦士のペンダント',
    description: '戦闘開始時、筋力(Strength)を1獲得する。',
    icon: 'Award',
    price: 130
  },
  {
    id: 'ring_fury',
    name: '憤怒の指輪',
    description: '戦闘開始時、怒気(Fury)を20獲得する。',
    icon: 'Orbit',
    price: 100
  },
  {
    id: 'golden_coin',
    name: '黄金の印章',
    description: '入手時、ゴールドを100獲得する。ショップでの割引率が常時15%適用される。',
    icon: 'Coins',
    price: 140
  },
  {
    id: 'magic_feather',
    name: '飛翔の羽',
    description: 'ターン開始時に15%の確率でエネルギーが1追加で回復する。',
    icon: 'Feather',
    price: 120
  },
  {
    id: 'lucky_charm',
    name: '招き猫のチャーム',
    description: '戦闘開始時、追加で25ゴールドを獲得する。さらに戦利品ゴールド獲得量が25%増加する。',
    icon: 'Sparkles',
    price: 110
  },
  {
    id: 'fury_pact',
    name: '戦神の鋭刃',
    description: 'ターン中、最初にプレイする攻撃カードのダメージが+4される。',
    icon: 'Sword',
    price: 145
  },
  {
    id: 'fabled_chalice',
    name: '聖騎士の杯',
    description: '入手時、プレイヤーの最大HPを15増やし、体力を15回復する。',
    icon: 'Heart',
    price: 130
  },
  {
    id: 'dragons_core',
    name: '竜の心臓',
    description: '戦闘開始時、自身の最大HPを10増やし、体力を10回復する。さらに基礎筋力を+1する。',
    icon: 'Activity',
    price: 140
  },
  {
    id: 'obsidian_mirror',
    name: '黒曜石の鏡',
    description: '自分のターン開始時、手札をさらに1枚多く引く。（※毎ターン開始時のドローが6枚になる）',
    icon: 'Layers',
    price: 120
  },
  {
    id: 'crimson_amulet',
    name: '真紅のアミュレット',
    description: '戦闘開始時、強力な防壁（ブロック12）を獲得する。',
    icon: 'Shield',
    price: 130
  },
  {
    id: 'vanguard_insignia',
    name: 'ヴァンガードの勲章',
    description: '戦闘勝利時に獲得できるゴールドが50%増加する。ショップでのすべての購入費用をさらに10%割引する。',
    icon: 'Award',
    price: 150
  }
];

// Enemy intentions dictionary
const INTENT_DEFEND = { type: 'defend' as const, description: '防御体制を整えている。' };
const INTENT_BUFF = { type: 'buff' as const, description: '次の猛攻のために魔力を溜めている。(攻撃力増加)' };
const INTENT_DEBUFF = { type: 'debuff' as const, description: '怪しげなオーラでこちらの弱体化を狙っている。' };

export const ENEMY_TEMPLATES = {
  // Floor 1-3 normal
  slime: {
    name: 'アシッドスライム',
    maxHp: 28,
    visualType: 'slime' as const,
    intents: [
      { type: 'attack' as const, value: 5, description: '体当たり！ (5ダメージ)' },
      INTENT_DEFEND,
      { type: 'attack' as const, value: 7, description: '酸の吐息！ (7ダメージ + プレイヤーに脆弱1付与)' }
    ]
  },
  skeleton: {
    name: '骸骨兵士',
    maxHp: 38,
    visualType: 'skeleton' as const,
    intents: [
      { type: 'attack' as const, value: 6, description: '錆びた剣で切りつける！ (6ダメージ)' },
      { type: 'defend' as const, value: 8, description: '骨の盾を構える！ (8ブロック)' },
      { type: 'attack' as const, value: 9, description: '兜割り！ (9ダメージ)' }
    ]
  },
  goblin: {
    name: 'ゴブリンスカウト',
    maxHp: 32,
    visualType: 'goblin' as const,
    intents: [
      { type: 'attack' as const, value: 4, description: '急襲突き！ (4ダメージ)' },
      INTENT_DEBUFF,
      { type: 'attack' as const, value: 8, description: '毒ナイフ！ (8ダメージ)' }
    ]
  },
  // Elite
  golem: {
    name: '激震の石像 (エリート)',
    maxHp: 65,
    visualType: 'golem' as const,
    intents: [
      { type: 'attack' as const, value: 10, description: '大地の踏み荒らし！ (10ダメージ)' },
      { type: 'defend' as const, value: 12, description: '岩の甲羅！ (12ブロック)' },
      { type: 'attack' as const, value: 14, description: '必殺破砕拳！ (14ダメージ)' },
      INTENT_BUFF
    ]
  },
  lich: {
    name: '死霊王リッチ (エリート)',
    maxHp: 58,
    visualType: 'lich' as const,
    intents: [
      { type: 'attack' as const, value: 8, description: '闇の魔弾！ (8ダメージ)' },
      INTENT_DEBUFF,
      { type: 'attack' as const, value: 12, description: '魂の吸収！ (12ダメージ + 体力回復)' },
      INTENT_BUFF
    ]
  },
  // Boss
  dragon: {
    name: '煉獄の混沌竜 (ラスボス)',
    maxHp: 150,
    visualType: 'dragon' as const,
    intents: [
      { type: 'attack' as const, value: 12, description: '漆黒の火炎放射！ (12ダメージ)' },
      { type: 'defend' as const, value: 16, description: '巨鱗の守り！ (16ブロック)' },
      { type: 'attack' as const, value: 18, description: '混沌の爪撃！ (18ダメージ)' },
      INTENT_BUFF,
      { type: 'attack' as const, value: 24, description: '【メテオ・ストライク】 (破滅 of 24 ダメージ！)' }
    ]
  },
  cultist: {
    name: '混沌の狂信者',
    maxHp: 34,
    visualType: 'skeleton' as const,
    intents: [
      { type: 'attack' as const, value: 5, description: 'ダークスパイク！ (5ダメージ)' },
      { type: 'buff' as const, description: '闇の祈祷！(儀式：筋力を1獲得する)' },
      { type: 'attack' as const, value: 7, description: 'ダークスラッシュ！ (7ダメージ)' }
    ]
  },
  fire_elemental: {
    name: 'ラーヴァエレメンタル',
    maxHp: 42,
    visualType: 'slime' as const,
    intents: [
      { type: 'attack' as const, value: 6, description: 'マグマショット！ (6ダメージ)' },
      { type: 'attack' as const, value: 8, description: 'ファイアブレイス！ (8ダメージ + プレイヤーに脆弱1付与)' },
      { type: 'defend' as const, value: 6, description: 'マグマの繭！ (6ブロック)' }
    ]
  },
  mimic: {
    name: 'お宝に擬態せしミミック (エリート)',
    maxHp: 58,
    visualType: 'goblin' as const,
    intents: [
      { type: 'attack' as const, value: 9, description: '噛みつき！ (9ダメージ)' },
      { type: 'defend' as const, value: 14, description: '硬化鉄皮！ (14ブロック)' },
      { type: 'attack' as const, value: 13, description: '不意の強襲！ (13ダメージ)' }
    ]
  },
  death_knight: {
    name: '死界の黒騎士 (エリート)',
    maxHp: 72,
    visualType: 'golem' as const,
    intents: [
      { type: 'attack' as const, value: 8, description: '冷気斬！ (8ダメージ)' },
      { type: 'defend' as const, value: 10, description: '盾構成！ (10ブロック)' },
      { type: 'attack' as const, value: 12, description: '滅殺の一撃！ (12ダメージ + プレイヤーに脱力1付与)' },
      INTENT_BUFF
    ]
  },
  demon: {
    name: '深淵の真紅魔デモン (ボス)',
    maxHp: 110,
    visualType: 'demon' as const,
    intents: [
      { type: 'attack' as const, value: 10, description: 'アビスファング！ (10ダメージ)' },
      { type: 'defend' as const, value: 15, description: '獄炎の盾！ (15ブロック)' },
      { type: 'attack' as const, value: 15, description: '滅びの烈火！ (15ダメージ)' },
      INTENT_BUFF,
      { type: 'attack' as const, value: 20, description: '【ギガ・クラッシュ】 (破滅の20ダメージ！)' }
    ]
  }
};

// Generate connections & coordinates in a procedural visual layout
export function generateMap(act: number = 1): MapNode[] {
  const nodes: MapNode[] = [];
  
  // Each Act has 12 floors (0 to 11)
  // Floor 0: Choice (Battle / Event)
  // Floor 1: Choice (Battle / Event)
  // Floor 2: Choice (Battle / Shop)
  // Floor 3: Rest (Camp)
  // Floor 4: Choice (Battle / Event)
  // Floor 5: Choice (Elite / Event)
  // Floor 6: Choice (Battle / Shop)
  // Floor 7: Rest (Camp)
  // Floor 8: Choice (Elite / Battle)
  // Floor 9: Choice (Battle / Event)
  // Floor 10: Rest before Boss (Camp)
  // Floor 11: Boss Node (Boss Battle)
  const structure: { type: 'battle' | 'elite' | 'event' | 'shop' | 'camp' | 'boss', cols: number }[] = [
    { type: 'battle', cols: 3 },        // 0: Start choices
    { type: 'battle', cols: 3 },        // 1: Floor 1 choices
    { type: 'battle', cols: 3 },        // 2: Floor 2 choices
    { type: 'camp', cols: 1 },          // 3: Rest
    { type: 'battle', cols: 3 },        // 4: Floor 4 choices
    { type: 'elite', cols: 2 },         // 5: Choice (Elite / Event)
    { type: 'battle', cols: 3 },        // 6: Floor 6 choices 
    { type: 'camp', cols: 1 },          // 7: Rest
    { type: 'elite', cols: 2 },         // 8: Choice (Elite / Battle)
    { type: 'battle', cols: 3 },        // 9: Floor 9 choices
    { type: 'camp', cols: 1 },          // 10: Rest before Boss
    { type: 'boss', cols: 1 }           // 11: Boss Fight!
  ];

  // Pass 1: Create nodes
  for (let floorIdx = 0; floorIdx < structure.length; floorIdx++) {
    const f = structure[floorIdx];
    for (let c = 0; c < f.cols; c++) {
      let specificType = f.type;
      
      // Fine-tune branching choices
      if (f.cols === 3) {
        if (floorIdx === 0) {
          specificType = c === 2 ? 'event' : 'battle';
        } else if (floorIdx === 1) {
          specificType = c === 1 ? 'event' : 'battle';
        } else if (floorIdx === 2) {
          specificType = c === 1 ? 'shop' : 'battle';
        } else if (floorIdx === 4) {
          specificType = c === 1 ? 'event' : 'battle';
        } else if (floorIdx === 6) {
          specificType = c === 1 ? 'shop' : 'battle';
        } else if (floorIdx === 9) {
          specificType = c === 1 ? 'event' : 'battle';
        }
      } else if (f.cols === 2) {
        if (floorIdx === 5) {
          specificType = c === 0 ? 'elite' : 'event';
        } else if (floorIdx === 8) {
          specificType = c === 0 ? 'elite' : 'battle';
        }
      }

      // Act specific modifications (e.g. higher acts have more danger or elite instead of battle)
      if (act > 1 && specificType === 'battle' && Math.random() < 0.2) {
        // High layers could naturally spawn harder nodes
      }

      nodes.push({
        id: `node_f${floorIdx}_c${c}`,
        floor: floorIdx,
        column: c,
        type: specificType,
        isConnectedTo: [],
        isCompleted: false,
        isCurrent: false
      });
    }
  }

  // Pass 2: Connect nodes from floor `j` to floor `j+1`
  for (let floorIdx = 0; floorIdx < structure.length - 1; floorIdx++) {
    const currentFloorNodes = nodes.filter(n => n.floor === floorIdx);
    const nextFloorNodes = nodes.filter(n => n.floor === floorIdx + 1);

    for (const cNode of currentFloorNodes) {
      for (const nNode of nextFloorNodes) {
        // Connect if column difference is close, or if either floor has only 1 node, connect everything
        if (currentFloorNodes.length === 1 || nextFloorNodes.length === 1) {
          cNode.isConnectedTo.push(nNode.id);
        } else {
          // grid connection: connect column C to columns C, C+1, C-1 of the next floor
          if (Math.abs(cNode.column - nNode.column) <= 1) {
            cNode.isConnectedTo.push(nNode.id);
          }
        }
      }
    }
  }

  return nodes;
}

// Random event templates
export const EVENT_LIST: GameEvent[] = [
  {
    id: 'crimson_fountain',
    title: '赤き真紅の泉',
    description: '鬱蒼とした岩の裂け目から、怪しく脈打つ真紅の液体が湧き出ている。吸い込まれそうな甘い香りが立ち込めている。ドリンクとして嗜むか、傷口を洗うか？',
    dialogueText: '「血の魔泉。ただの飲み物ではない、恐るべき変化を促すだろう…」',
    imageTheme: 'liquid_blood_altar',
    options: [
      {
        text: '豪快に飲む (体力を20回復するが、最大HPが5減少する)',
        outcomeText: '喉を潤すたび、体中を痛烈な熱波が走り去った。全身の傷が癒え、感覚が鋭敏になったが、少し体が軽くなりもろくなった気がする。',
        effectId: 'crimson_drink'
      },
      {
        text: '剣と防具を洗う (「怒気の斬撃」を1枚獲得する)',
        outcomeText: '剣を真紅の泉に浸すと、刃が赤褐色の光をまとい始めた。戦意を高める呪いが込められたようだ。',
        effectId: 'crimson_wash'
      },
      {
        text: '警戒を緩めず通り過ぎる (HPを5回復する)',
        outcomeText: 'ただならぬ魔力を感じ、あなたは慎重に泉を立ち去った。道中の休憩で少し気力が戻った。',
        effectId: 'leave_heal'
      }
    ]
  },
  {
    id: 'forgotten_tomb',
    title: '忘れ去られた戦士の墓',
    description: '崩れかけた石棺に、かつて多くの戦場を駆け抜けたであろう古の将軍が眠っている。石碑には「魂を捧げし者に、戦火の祝福を与えん」と刻まれている。',
    dialogueText: '古びた鉄製の盾と、何やら不気味なお守りが収めてある。',
    imageTheme: 'dark_cavern_crypt',
    options: [
      {
        text: '石棺を強引に暴く (ゴールドを100手に入れるが、体力が12減少する)',
        outcomeText: '棺の蓋をこじ開けた瞬間、死霊の祟り（冷気）があなたを激しく蝕んだ！しかし、そこから燦然と輝く古代の金貨を掴み出す。',
        effectId: 'tomb_rob'
      },
      {
        text: '静かに拝礼する (レリック「盾のバックラー」か「戦士のペンダント」をランダムに獲得)',
        outcomeText: 'あなたが静かに敬意を払い、片膝をつくと、冷たかった石碑がほのかに温もりを帯び、古の将軍が遺した英霊の守護があなたに宿った。',
        effectId: 'tomb_pray'
      },
      {
        text: 'そのまま遺品だけ預かる (手札スターターの「防御」を1枚「防御+」に強化する)',
        outcomeText: 'あなたは余計な破壊や儀式を避け、実用的な戦闘知識だけを深めることにした。既存の盾の技術が洗練された。',
        effectId: 'tomb_upgrade'
      }
    ]
  },
  {
    id: 'cursed_blacksmith',
    title: '歪んだ鍛冶屋の炉',
    description: '人影のない廃墟の中に、煌々と青い炎を吹き上げる奇妙な炉がある。炭の代わりに魔石が燃えており、その手前に文字が踊っている。「対価を差し出せ。肉体か、金か、あるいは運命か」',
    dialogueText: '「極上の鋼、呪わしき熱風。一瞬であなたの武装を鍛え上げましょう」',
    imageTheme: 'infernal_forge_anvil',
    options: [
      {
        text: '自らの血をふいごに注ぐ (デッキ内のランダムなカードを2枚強化する。体力を15失う)',
        outcomeText: 'あなたが手を切り、炉の炎に血を滲ませると、超自然の青炎が爆発的に燃え上がり、所持していた武器と技術が強力に変貌した。',
        effectId: 'forge_blood'
      },
      {
        text: '金を支払って技術を学ぶ (50ゴールドを支払い、任意のカード1枚を強化する)',
        outcomeText: '炉の横にある貯金穴に金貨を落とすと、炉が魔法の投影機となり、効率的な急所攻撃の手順を脳裏に直接教えた。',
        effectId: 'forge_gold'
      },
      {
        text: '立ち去る',
        outcomeText: 'これ以上の呪いを警戒し、あなたは鍛冶場をあとにした。安全が最良の戦略となることもある。',
        effectId: 'leave'
      }
    ]
  },
  {
    id: 'card_trader',
    title: '闇の契約商人',
    description: '角と奇妙な仮面をつけた怪しい行商人が、あなたを待ち受けていた。「お前さん。つまらない攻撃カードを、もっと魅惑的で狂暴な【レアカード】と交換してやろうじゃないか？ほんの少しの幸運を貰うだけでいいんだ。」',
    dialogueText: '「要らないカードをお寄こしなさい。極上品を約束します…ふふっ」',
    imageTheme: 'creepy_hooded_shopkeep',
    options: [
      {
        text: 'ストライク(初期)を1枚渡し、ランダムな【レアカード】に交換する',
        outcomeText: '商人はあなたが差し出した安物の戦士剣を舐めるように受け取り、代わりに漆黒の魔法のルーンが染み込んだ至高の呪文カードを手渡した！',
        effectId: 'trade_slash_rare'
      },
      {
        text: '防御(初期)を1枚渡し、ランダムな【アンコモンカード】に交換する',
        outcomeText: '商人は満足げに古い木製の丸盾を受け取ると、手品のように空中に輝くカードを実体化させて手渡してくれた。',
        effectId: 'trade_defend_uncommon'
      },
      {
        text: '警戒して取引を断る',
        outcomeText: '「無知なる者は堅実を求める、か。つまらぬ」商人は歪んだため息をつき、闇の霧のなかへ消え去った。',
        effectId: 'leave'
      }
    ]
  },
  {
    id: 'shining_obelisk',
    title: '神々しき輝きの石碑',
    description: '行く手に、目も眩むような黄金色の光を放つ巨大なオベリスクがそびえ立っている。石碑に刻まれた古代文字が、あなたの生命とデッキに直接語りかけてくる。どのような恩恵を望むか？',
    dialogueText: '「汝、力、生命、あるいは秘宝を求めるか？ 望むものを選ぶが良い…」',
    imageTheme: 'liquid_blood_altar',
    options: [
      {
        text: '健康の祝福を受ける (最大HPが15増加し、さらに体力を20回復する)',
        outcomeText: '石碑から暖かい光の奔流が体内に流れ込み、生気に満ち溢れ、心身ともに最大級の生命力が蓄えられた！',
        effectId: 'obelisk_hp'
      },
      {
        text: '神聖なる急所の教えを受ける (ランダムなカードを2枚「+」に強化する)',
        outcomeText: '脳内に高次元の戦闘指南が直接流れ込み、眠っていた真の武術センスが研ぎ澄まされてカードが強力に鍛え上げられた！',
        effectId: 'obelisk_upgrade'
      },
      {
        text: '神聖な対価としてお守りを発現する (75ゴールドを支払い、お守りレリック「招き猫のチャーム」を獲得する)',
        outcomeText: 'お布施として金貨を捧げると、石碑の頂部から黄金色の愛らしい「招き猫のチャーム」が姿を現した。運気が天を衝く。',
        effectId: 'obelisk_relic_charm'
      }
    ]
  },
  {
    id: 'initial_blessing',
    title: '精霊の旅立ちの祝福',
    description: 'ダンジョンの重苦しい扉の前に立つと、次元の裂け目から青白く輝くクジラに似た幻影「太古の精霊ネオ」が現れた。「若きヴァンガードよ。深淵を退け、混沌の竜を討つため、汝の旅立ちを祝福しよう。望む恩恵を一つ選ぶが良い。」',
    dialogueText: '「どれを求めるか？汝に最も相応しい祝福を選ぶが良い…」',
    imageTheme: 'liquid_blood_altar',
    options: [
      {
        text: '頑強なる生命力 (最大HPが15増加し、体力を15回復する)',
        outcomeText: '精霊の温かな超常光線が全身を巡り、あなたの肉体の許容限界値と治癒生命力が飛躍的に高まった！',
        effectId: 'blessing_hp'
      },
      {
        text: '初期武具の鋭刃化 (ランダムな初期カードを2枚「+」に強化する)',
        outcomeText: '目の前でカードが鋭い火花を散らして眩しく輝き、初期装備がより強靭に生まれ変わった！',
        effectId: 'blessing_upgrade'
      },
      {
        text: '旅のお守り遺品 (ランダムなレリックを1つ獲得する)',
        outcomeText: '精霊の手のひらから未知の光を放つお守りレリックが零れ落ち、あなたに新たな常時パッシブ効果をもたらした！',
        effectId: 'blessing_relic'
      },
      {
        text: '軍用黄金袋 (100ゴールドを獲得する)',
        outcomeText: '精霊が優しく微笑むと、チャリンと心地よい音を立てて金袋があなたの手元に具現化した。これで最初のショップでの買い物も有利になる。',
        effectId: 'blessing_gold'
      }
    ]
  }
];

export function getStarterDeck(): Card[] {
  const deck: Card[] = [];
  
  // 4x Strike
  const strikeTemplate = CARD_TEMPLATES.find(c => c.originalId === 'strike')!;
  for (let i = 0; i < 4; i++) {
    deck.push(createCardInstance(strikeTemplate));
  }
  
  // 4x Defend
  const defendTemplate = CARD_TEMPLATES.find(c => c.originalId === 'defend')!;
  for (let i = 0; i < 4; i++) {
    deck.push(createCardInstance(defendTemplate));
  }
  
  // 1x Fury Slash
  const furySlashTemplate = CARD_TEMPLATES.find(c => c.originalId === 'fury_slash')!;
  deck.push(createCardInstance(furySlashTemplate));

  // 1x Battle Cry
  const battleCryTemplate = CARD_TEMPLATES.find(c => c.originalId === 'battle_cry')!;
  deck.push(createCardInstance(battleCryTemplate));

  return deck;
}

export function initializeGame(): GameState {
  const nodes = generateMap(1);
  const deck = getStarterDeck();
  
  // Give starter relic 'blood_ember'
  const starterRelic = RELIC_LIST.find(r => r.id === 'blood_ember')!;

  return {
    playerClass: 'Vanguard (ヴァンガード)',
    hp: 80,
    maxHp: 80,
    gold: 99, // default pocket money
    block: 0,
    energy: 3,
    maxEnergy: 3,
    floor: 1,
    deck: deck,
    hand: [],
    discard: [],
    drawPile: [],
    relics: [starterRelic],
    fury: 0,
    stance: 'balanced',
    enemies: [],
    activeBattleNodeId: null,
    mapNodes: nodes,
    currentNodeId: null,
    gameStateType: 'title',
    currentEvent: null,
    eventOutcome: null,
    battleLog: ['ダンジョンが展開された。冒険の準備を整えよ。'],
    vulnerable: 0,
    weak: 0,
    strength: 0,
    round: 1,
    selectedCardId: null,
    cardDrawnThisTurnCount: 0,
    isShopTutorialSeen: false,
    act: 1
  };
}
