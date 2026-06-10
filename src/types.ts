export type CardType = 'attack' | 'defense' | 'skill';
export type CardRarity = 'common' | 'uncommon' | 'rare' | 'curse';

export interface CardEffect {
  type: 'damage' | 'block' | 'fury' | 'draw' | 'strength' | 'vulnerable' | 'weak' | 'heal' | 'stance' | 'exhaust' | 'random_damage';
  value: number;
  target?: 'enemy' | 'player' | 'all_enemies' | 'random';
  stanceValue?: 'balanced' | 'defensive' | 'assault';
}

export interface Card {
  id: string;
  originalId: string;
  name: string;
  description: string;
  type: CardType;
  cost: number;
  rarity: CardRarity;
  isUpgraded: boolean;
  effects: CardEffect[];
}

export interface Enemy {
  id: string;
  name: string;
  maxHp: number;
  hp: number;
  block: number;
  strength: number;
  vulnerable: number; // rounds left
  weak: number; // rounds left
  intent: EnemyIntent;
  visualType: 'slime' | 'goblin' | 'golem' | 'skeleton' | 'demon' | 'lich' | 'dragon';
  templateId?: string;
}

export interface EnemyIntent {
  type: 'attack' | 'defend' | 'buff' | 'debuff' | 'special';
  value?: number;
  description: string;
}

export interface Relic {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  price?: number;
}

export type GameStateType = 
  | 'title' 
  | 'map' 
  | 'battle' 
  | 'shop' 
  | 'event' 
  | 'camp' 
  | 'gameover' 
  | 'victory' 
  | 'tutorial'
  | 'credits';

export type StanceType = 'balanced' | 'defensive' | 'assault';

export interface MapNode {
  id: string;
  floor: number;
  column: number; // visual placement
  type: 'battle' | 'elite' | 'event' | 'shop' | 'camp' | 'boss';
  isConnectedTo: string[]; // parents of next floor
  isCompleted: boolean;
  isCurrent: boolean;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  dialogueText: string;
  imageTheme: string;
  options: GameEventOption[];
}

export interface GameEventOption {
  text: string;
  requirement?: string;
  hasRequirement?: boolean;
  outcomeText: string;
  effectId: string; // Evaluated by state reducer (e.g. 'fountain_drink')
}

export interface GameState {
  playerClass: string;
  hp: number;
  maxHp: number;
  gold: number;
  block: number;
  energy: number;
  maxEnergy: number;
  floor: number;
  deck: Card[];
  hand: Card[];
  discard: Card[];
  drawPile: Card[];
  relics: Relic[];
  fury: number; // 0 to 100
  stance: StanceType;
  enemies: Enemy[];
  activeBattleNodeId: string | null;
  mapNodes: MapNode[];
  currentNodeId: string | null;
  gameStateType: GameStateType;
  currentEvent: GameEvent | null;
  eventOutcome: string | null;
  battleLog: string[];
  vulnerable: number; // player vulnerable status
  weak: number; // player weak status
  strength: number; // player bonus damage
  round: number; // battle round
  selectedCardId: string | null;
  cardDrawnThisTurnCount: number;
  isShopTutorialSeen: boolean;
  firstAttackPlayedThisTurn?: boolean;
  act: number;
}
