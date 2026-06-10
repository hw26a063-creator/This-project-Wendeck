import React, { useState, useEffect } from 'react';
import { 
  Coins, Shield, Flame, Sword, Heart, Sparkles, RotateCcw, Play, Skull, 
  Crown, BookOpen, ShoppingBag, Shuffle, Info, X, Check, Zap, 
  TrendingUp, Feather, Award, Orbit, ChevronRight, MessageSquareCode,
  Compass, ShieldAlert
} from 'lucide-react';
import { Card, Enemy, Relic, MapNode, GameEvent, GameState, StanceType, CardRarity } from './types';
import { CARD_TEMPLATES, RELIC_LIST, ENEMY_TEMPLATES, generateMap, initializeGame, createCardInstance, EVENT_LIST } from './gameData';

export default function App() {
  // Load initial game state or resume from localStorage
  const [state, setState] = useState<GameState>(() => {
    const saved = localStorage.getItem('rogue_vanguard_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved session", e);
      }
    }
    return initializeGame();
  });

  // UI States
  const [isDeckViewerOpen, setIsDeckViewerOpen] = useState(false);
  const [aiNarration, setAiNarration] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState<{ id: string; target: 'player' | string; text: string; type: 'damage' | 'block' | 'heal' | 'info' }[]>([]);
  const [shakeTargetId, setShakeTargetId] = useState<string | null>(null);
  const [rewardCards, setRewardCards] = useState<Card[]>([]);
  const [selectedShopCard, setSelectedShopCard] = useState<Card | null>(null);
  const [selectedShopCardPrice, setSelectedShopCardPrice] = useState<number>(0);
  const [selectedUpgradeCard, setSelectedUpgradeCard] = useState<Card | null>(null);
  const [activeTab, setActiveTab] = useState<'battle' | 'narrative'>('battle');

  // Sync state to localStorage on modification
  useEffect(() => {
    localStorage.setItem('rogue_vanguard_session', JSON.stringify(state));
  }, [state]);

  // Helper: Trigger floating text
  const addFloatingText = (target: 'player' | string, text: string, type: 'damage' | 'block' | 'heal' | 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setFloatingTexts(prev => [...prev, { id, target, text, type }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(t => t.id !== id));
    }, 1200);
  };

  // Helper: Trigger shake animation on target (enemy ID or 'player')
  const triggerShake = (targetId: string) => {
    setShakeTargetId(targetId);
    setTimeout(() => setShakeTargetId(null), 300);
  };

  // --- GEMINI PROXIES ---
  const fetchEventNarration = async (event: GameEvent, optionText: string, outcomeText: string) => {
    setIsAiLoading(true);
    setAiNarration('（ゲームマスターが運命の理を書き綴っています...）');
    try {
      const response = await fetch('/api/gemini/event-narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: event.title,
          description: event.description,
          choiceText: optionText,
          outcomeOriginal: outcomeText
        })
      });
      const data = await response.json();
      if (data.text) {
        setAiNarration(data.text);
      } else {
        setAiNarration(outcomeText);
      }
    } catch (e) {
      console.error(e);
      setAiNarration(outcomeText);
    } finally {
      setIsAiLoading(false);
    }
  };

  const fetchBattleNarration = async (latestLog: string) => {
    if (state.enemies.length === 0) return;
    setIsAiLoading(true);
    try {
      const enemy = state.enemies[0];
      const response = await fetch('/api/gemini/battle-narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turn: state.round,
          enemyName: enemy.name,
          enemyAction: enemy.intent.description,
          playerHp: state.hp,
          playerFury: state.fury,
          playerStance: state.stance,
          logText: latestLog
        })
      });
      const data = await response.json();
      if (data.text) {
        setAiNarration(data.text);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- SYSTEM LOGS ---
  const addLog = (message: string) => {
    setState(prev => ({
      ...prev,
      battleLog: [message, ...prev.battleLog.slice(0, 40)]
    }));
  };

  // --- MAP NODE TRANSITIONS ---
  const handleSelectNode = (node: MapNode) => {
    if (!node.isConnectedTo && node.floor !== 0) return;
    
    // Validate if path is unlocked
    const currentActiveNode = state.mapNodes.find(n => n.id === state.currentNodeId);
    let canProgress = !state.currentNodeId || (currentActiveNode && currentActiveNode.isConnectedTo.includes(node.id));
    
    // If starting from scratch, they must pick a floor 0 node
    if (!state.currentNodeId && node.floor !== 0) {
      canProgress = false;
    }
    
    if (!canProgress && !node.isCurrent) {
      return;
    }

    // Set map nodes isCurrent status
    const updatedNodes = state.mapNodes.map(n => {
      if (n.id === node.id) {
        return { ...n, isCurrent: true, isCompleted: false };
      }
      return { ...n, isCurrent: false, isCompleted: n.id === state.currentNodeId ? true : n.isCompleted };
    });

    let newStateType: typeof state.gameStateType = 'map';
    let enemiesToSpawn: Enemy[] = [];
    let currentEvent: GameEvent | null = null;

    if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
      newStateType = 'battle';
      enemiesToSpawn = spawnEnemies(node.type, node.floor);
      addLog(`戦闘開始: 床 ${node.floor + 1} - 宿敵が立ち塞がる！`);
    } else if (node.type === 'shop') {
      newStateType = 'shop';
      addLog(`商人に出会った。ゴールドを支払って戦力を強化しよう。`);
    } else if (node.type === 'event') {
      newStateType = 'event';
      currentEvent = getRandomEvent();
      setAiNarration('');
      addLog(`奇妙な気配を感じる... イベント発生。`);
    } else if (node.type === 'camp') {
      newStateType = 'camp';
      addLog(`キャンプ。焚き火で傷を癒やすか、装備を鍛えよ。`);
    }

    // Prepare piles for combat
    let drawPile: Card[] = [];
    let hand: Card[] = [];
    let discardPile: Card[] = [];
    
    if (newStateType === 'battle') {
      // Shuffle Deck to DrawPile
      drawPile = shuffleCards([...state.deck]);
      // Draw 5 starting cards
      hand = drawPile.slice(0, 5);
      drawPile = drawPile.slice(5);
      
      // Relics triggers
      let initialBlock = 0;
      let initialStrength = 0;
      let initialFury = 0;
      let startGoldBonus = 0;

      if (hasRelic('buckler')) initialBlock += 6;
      if (hasRelic('pendant')) initialStrength += 1;
      if (hasRelic('ring_fury')) initialFury += 20;
      if (hasRelic('dragons_core')) initialStrength += 1;
      if (hasRelic('crimson_amulet')) initialBlock += 12;
      if (hasRelic('lucky_charm')) {
        startGoldBonus = 25;
      }

      setState(prev => ({
        ...prev,
        gameStateType: newStateType,
        mapNodes: updatedNodes,
        currentNodeId: node.id,
        activeBattleNodeId: node.id,
        enemies: enemiesToSpawn,
        hand,
        drawPile,
        discard: discardPile,
        energy: prev.maxEnergy,
        gold: prev.gold + startGoldBonus,
        block: initialBlock,
        strength: prev.strength + initialStrength,
        fury: Math.min(100, prev.fury + initialFury),
        round: 1,
        vulnerable: 0,
        weak: 0,
        selectedCardId: null,
        cardDrawnThisTurnCount: 5,
        currentEvent: null,
        eventOutcome: null,
        firstAttackPlayedThisTurn: false
      }));

      if (startGoldBonus > 0) {
        addLog(`「招き猫のチャーム」の効果で、戦闘開始時に25ゴールドを獲得！`);
      }

      // Queue initial narration
      setTimeout(() => {
        fetchBattleNarration(`戦闘開始。対峙するのは「${enemiesToSpawn[0]?.name}」`);
      }, 500);

    } else {
      setState(prev => ({
        ...prev,
        gameStateType: newStateType,
        mapNodes: updatedNodes,
        currentNodeId: node.id,
        enemies: [],
        currentEvent,
        eventOutcome: null
      }));
    }
  };

  // Helper functions
  const hasRelic = (id: string): boolean => {
    return state.relics.some(r => r.id === id);
  };

  const spawnEnemies = (type: 'battle' | 'elite' | 'boss', floor: number): Enemy[] => {
    const list: Enemy[] = [];
    const act = state.act || 1;
    let hpMultiplier = 1.0;
    let damageAdd = 0;
    if (act === 2) {
      hpMultiplier = 1.35;
      damageAdd = 2;
    } else if (act === 3) {
      hpMultiplier = 1.75;
      damageAdd = 5;
    }

    if (type === 'boss') {
      let boss: any = ENEMY_TEMPLATES.golem;
      let templateKey = 'golem';
      
      if (act === 1) {
        if (Math.random() < 0.5) {
          boss = ENEMY_TEMPLATES.golem;
          templateKey = 'golem';
        } else {
          boss = ENEMY_TEMPLATES.lich;
          templateKey = 'lich';
        }
      } else if (act === 2) {
        boss = ENEMY_TEMPLATES.demon;
        templateKey = 'demon';
      } else {
        boss = ENEMY_TEMPLATES.dragon;
        templateKey = 'dragon';
      }

      const calculatedHp = Math.floor(boss.maxHp * hpMultiplier);
      const scaledIntents = boss.intents.map((i: any) => {
        if (i.type === 'attack' && i.value !== undefined) {
          const val = i.value + damageAdd;
          return {
            ...i,
            value: val,
            description: i.description.replace(/\d+ダメージ/, `${val}ダメージ`)
          };
        }
        return i;
      });

      list.push({
        id: 'enemy_boss',
        name: boss.name,
        maxHp: calculatedHp,
        hp: calculatedHp,
        block: 0,
        strength: 0,
        vulnerable: 0,
        weak: 0,
        intent: { ...scaledIntents[0] },
        visualType: boss.visualType,
        templateId: templateKey
      });
    } else if (type === 'elite') {
      const templates: any[] = [
        { key: 'golem', data: ENEMY_TEMPLATES.golem },
        { key: 'lich', data: ENEMY_TEMPLATES.lich },
        { key: 'mimic', data: ENEMY_TEMPLATES.mimic },
        { key: 'death_knight', data: ENEMY_TEMPLATES.death_knight }
      ];
      const selected = templates[Math.floor(Math.random() * templates.length)];
      
      const calculatedHp = Math.floor(selected.data.maxHp * hpMultiplier);
      const scaledIntents = selected.data.intents.map((i: any) => {
        if (i.type === 'attack' && i.value !== undefined) {
          const val = i.value + damageAdd;
          return {
            ...i,
            value: val,
            description: i.description.replace(/\d+ダメージ/, `${val}ダメージ`)
          };
        }
        return i;
      });

      list.push({
        id: `enemy_elite_${Math.floor(Math.random() * 100)}`,
        name: selected.data.name,
        maxHp: calculatedHp,
        hp: calculatedHp,
        block: 0,
        strength: 0,
        vulnerable: 0,
        weak: 0,
        intent: { ...scaledIntents[0] },
        visualType: selected.data.visualType,
        templateId: selected.key
      });
    } else { // Normal battles
      const templates: any[] = [
        { key: 'slime', data: ENEMY_TEMPLATES.slime },
        { key: 'goblin', data: ENEMY_TEMPLATES.goblin },
        { key: 'cultist', data: ENEMY_TEMPLATES.cultist },
        { key: 'fire_elemental', data: ENEMY_TEMPLATES.fire_elemental }
      ];
      if (floor > 2) {
        templates.push({ key: 'skeleton', data: ENEMY_TEMPLATES.skeleton });
      }
      const selected = templates[Math.floor(Math.random() * templates.length)];
      
      const calculatedHp = Math.floor(selected.data.maxHp * hpMultiplier);
      const scaledIntents = selected.data.intents.map((i: any) => {
        if (i.type === 'attack' && i.value !== undefined) {
          const val = i.value + damageAdd;
          return {
            ...i,
            value: val,
            description: i.description.replace(/\d+ダメージ/, `${val}ダメージ`)
          };
        }
        return i;
      });

      list.push({
        id: `enemy_normal_${Math.floor(Math.random() * 100)}`,
        name: selected.data.name,
        maxHp: calculatedHp,
        hp: calculatedHp,
        block: 0,
        strength: 0,
        vulnerable: 0,
        weak: 0,
        intent: { ...scaledIntents[0] },
        visualType: selected.data.visualType,
        templateId: selected.key
      });
    }
    return list;
  };

  const getRandomEvent = (): GameEvent => {
    const randomIdx = Math.floor(Math.random() * EVENT_LIST.length);
    return EVENT_LIST[randomIdx] || EVENT_LIST[0];
  };

  const shuffleCards = (array: Card[]): Card[] => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // --- ACTIONS: BATTLE TURN PLAY ---
  const handlePlayCard = (card: Card, targetEnemyId: string) => {
    if (state.energy < card.cost) {
      addFloatingText('player', 'エネルギー不足', 'info');
      return;
    }

    const enemy = state.enemies.find(e => e.id === targetEnemyId);
    if (!enemy && card.effects.some(e => e.target === 'enemy' || e.target === 'random')) {
      return;
    }

    // Play card logic
    let updatedEnemies = [...state.enemies];
    let damageLogAdditions = '';
    let updatedPlayerHp = state.hp;
    let updatedPlayerMaxHp = state.maxHp;
    let updatedPlayerFury = state.fury;
    let updatedPlayerBlock = state.block;
    let updatedPlayerStrength = state.strength;
    let updatedStance = state.stance;
    let appliedVulnerableValue = 0;
    let appliedWeakValue = 0;

    // Fury Frenzy Check (50+ Fury deals double Attack card base damage!)
    const isFrenzy = state.fury >= 50 && card.type === 'attack';
    const furyPactBonus = (card.type === 'attack' && hasRelic('fury_pact') && !state.firstAttackPlayedThisTurn) ? 4 : 0;

    card.effects.forEach(eff => {
      if (eff.type === 'damage') {
        let baseDamage = eff.value;
        if (isFrenzy) baseDamage *= 2; // Fury multipliers
        baseDamage += furyPactBonus;

        // Custom bonus for Fury Strike
        if (card.originalId === 'fury_strike' && state.fury >= 50) {
          baseDamage += 6;
        }

        // Apply Strength directly to damage multiplier
        let calcDamage = baseDamage + updatedPlayerStrength;

        // Balance postures
        if (updatedStance === 'assault') {
          calcDamage = Math.floor(calcDamage * 1.25); // Assault Stance gives +25% damage dealt
        }

        // Apply enemy states
        if (eff.target === 'enemy' && enemy) {
          let finalDamage = calcDamage;
          if (enemy.vulnerable > 0) finalDamage = Math.floor(finalDamage * 1.5); // Vulnerable +50%
          if (state.weak > 0) finalDamage = Math.floor(finalDamage * 0.75); // Player Weakened -25%

          // Apply Block first
          updatedEnemies = updatedEnemies.map(e => {
            if (e.id === enemy.id) {
              const shieldLeft = Math.max(0, e.block - finalDamage);
              const hpDeduct = Math.max(0, finalDamage - e.block);
              const actualHpLeft = Math.max(0, e.hp - hpDeduct);
              
              triggerShake(e.id);
              addFloatingText(e.id, `-${finalDamage} HP`, 'damage');
              damageLogAdditions += `「${card.name}」により ${e.name} に ${finalDamage} ダメージ。 `;

              return {
                ...e,
                block: shieldLeft,
                hp: actualHpLeft
              };
            }
            return e;
          });
        } else if (eff.target === 'all_enemies') {
          updatedEnemies = updatedEnemies.map(e => {
            let finalDamage = calcDamage;
            if (e.vulnerable > 0) finalDamage = Math.floor(finalDamage * 1.5);
            if (state.weak > 0) finalDamage = Math.floor(finalDamage * 0.75);

            const shieldLeft = Math.max(0, e.block - finalDamage);
            const hpDeduct = Math.max(0, finalDamage - e.block);
            const actualHpLeft = Math.max(0, e.hp - hpDeduct);
            
            triggerShake(e.id);
            addFloatingText(e.id, `-${finalDamage} `, 'damage');
            return {
              ...e,
              block: shieldLeft,
              hp: actualHpLeft
            };
          });
          damageLogAdditions += `「${card.name}」によりすべての敵に ${calcDamage} ダメージ。 `;
        }
      }

      if (eff.type === 'block') {
        let multiplier = 1.0;
        if (updatedStance === 'defensive') multiplier = 1.3; // Defensive Stance gives +30% Block
        let blockBaseValue = eff.value;
        if (card.originalId === 'fury_barrier' && state.fury >= 50) {
          blockBaseValue = card.isUpgraded ? 18 : 12; // double base block (6 -> 12, or 9 -> 18 if upgraded)
        }
        const addedBlock = Math.floor(blockBaseValue * multiplier);

        updatedPlayerBlock += addedBlock;
        addFloatingText('player', `+${addedBlock} 防御`, 'block');
        damageLogAdditions += `「${card.name}」によりシールド +${addedBlock}。 `;
      }

      if (eff.type === 'fury') {
        updatedPlayerFury = Math.min(100, updatedPlayerFury + eff.value);
        addFloatingText('player', `+${eff.value} 怒気`, 'info');
        damageLogAdditions += `闘志蓄積: 怒気+${eff.value}。 `;
      }

      if (eff.type === 'heal') {
        const addedHP = eff.value;
        updatedPlayerHp = Math.min(updatedPlayerMaxHp, updatedPlayerHp + addedHP);
        addFloatingText('player', `+${addedHP} HP`, 'heal');
        damageLogAdditions += `体力回復: HP+${addedHP}。 `;
      }

      if (eff.type === 'stance' && eff.stanceValue) {
        updatedStance = eff.stanceValue;
        const stanceLabel = updatedStance === 'assault' ? '劇撃の構え' : updatedStance === 'defensive' ? '防御の構え' : '基本の構え';
        addFloatingText('player', stanceLabel, 'info');
        damageLogAdditions += `構え変更: 【${stanceLabel}】。 `;
      }

      if (eff.type === 'strength') {
        updatedPlayerStrength += eff.value;
        addFloatingText('player', `+${eff.value} 筋力`, 'info');
        damageLogAdditions += `筋力加算: 攻撃力+${eff.value}。 `;
      }

      if (eff.type === 'weak') {
        if (eff.target === 'all_enemies') {
          updatedEnemies = updatedEnemies.map(e => ({ ...e, weak: e.weak + eff.value }));
          addLog(`すべての敵が脱力状態になった (${eff.value}ターン)。`);
        } else if (enemy) {
          updatedEnemies = updatedEnemies.map(e => {
            if (e.id === enemy.id) return { ...e, weak: e.weak + eff.value };
            return e;
          });
          addLog(`敵 ${enemy.name} は脱力状態になった (${eff.value}ターン)。`);
        }
      }

      if (eff.type === 'vulnerable') {
        if (eff.target === 'all_enemies') {
          updatedEnemies = updatedEnemies.map(e => ({ ...e, vulnerable: e.vulnerable + eff.value }));
          addLog(`すべての敵が脆弱状態になった (${eff.value}ターン)。`);
        } else if (enemy) {
          updatedEnemies = updatedEnemies.map(e => {
            if (e.id === enemy.id) return { ...e, vulnerable: e.vulnerable + eff.value };
            return e;
          });
          addLog(`敵 ${enemy.name} は脆弱状態になった (${eff.value}ターン)。`);
        }
      }

      // Special evaluation: shield_slam
      if (eff.type === 'random_damage' && enemy) {
        // Shield Slam deals extra damage equal to shield block
        const bonusDmg = state.block;
        const totalSlam = 5 + bonusDmg + updatedPlayerStrength + furyPactBonus;
        let finalDamage = totalSlam;
        if (enemy.vulnerable > 0) finalDamage = Math.floor(finalDamage * 1.5);
        if (state.weak > 0) finalDamage = Math.floor(finalDamage * 0.75);

        updatedEnemies = updatedEnemies.map(e => {
          if (e.id === enemy.id) {
            const shieldLeft = Math.max(0, e.block - finalDamage);
            const hpDeduct = Math.max(0, finalDamage - e.block);
            const actualHpLeft = Math.max(0, e.hp - hpDeduct);
            
            triggerShake(e.id);
            addFloatingText(e.id, `-${finalDamage} HP`, 'damage');
            return {
              ...e,
              block: shieldLeft,
              hp: actualHpLeft
            };
          }
          return e;
        });
        damageLogAdditions += `シールドバッシュ発動、${finalDamage}ダメージ！ `;
      }
    });

    // Special Rage Release logic (consumes all Fury points to grant permanent Strength points)
    if (card.originalId === 'rage_release') {
      const consumedFury = state.fury;
      const strengthGained = Math.floor(consumedFury / 5);
      updatedPlayerFury = 0;
      updatedPlayerStrength += strengthGained;
      addFloatingText('player', `怒気消費/筋力+${strengthGained}`, 'info');
      damageLogAdditions += `怒気 ${consumedFury} を全消費。筋力+${strengthGained}獲得！ `;
    }

    // Special Furious Charge logic (grants extra Fury if posture is assault)
    if (card.originalId === 'furious_charge' && state.stance === 'assault') {
      const extraFury = card.isUpgraded ? 30 : 20;
      updatedPlayerFury = Math.min(100, updatedPlayerFury + extraFury);
      addFloatingText('player', `+${extraFury} 怒気（連携）`, 'info');
      damageLogAdditions += `「劇撃の構え」の連携により、怒気+${extraFury}！ `;
    }

    // Special Vanguard's Will logic (restores energy)
    let customEnergyAdd = 0;
    if (card.originalId === 'vanguard_will') {
      customEnergyAdd = card.isUpgraded ? 2 : 1;
      addFloatingText('player', `+${customEnergyAdd} エネルギー`, 'info');
      damageLogAdditions += `「先陣の意志」により、エネルギーが${customEnergyAdd}回復した！ `;
    }

    // Check draws trigger inside effects
    let finalHand = state.hand.filter(h => h.id !== card.id);
    let finalDiscard = [...state.discard, card];
    let finalDrawPile = [...state.drawPile];

    const drawEff = card.effects.find(e => e.type === 'draw');
    if (drawEff) {
      const cardsToDraw = drawEff.value;
      for (let d = 0; d < cardsToDraw; d++) {
        if (finalDrawPile.length === 0) {
          // Shuffle discard back
          finalDrawPile = shuffleCards(finalDiscard);
          finalDiscard = [];
        }
        if (finalDrawPile.length > 0) {
          const drawn = finalDrawPile[0];
          finalDrawPile = finalDrawPile.slice(1);
          finalHand.push(drawn);
        }
      }
    }

    // Deduct cost from played + add custom energy
    const finalEnergy = Math.min(state.maxEnergy, Math.max(0, state.energy - card.cost + customEnergyAdd));

    setState(prev => ({
      ...prev,
      hand: finalHand,
      discard: finalDiscard,
      drawPile: finalDrawPile,
      energy: finalEnergy,
      enemies: updatedEnemies,
      hp: updatedPlayerHp,
      maxHp: updatedPlayerMaxHp,
      fury: updatedPlayerFury,
      block: updatedPlayerBlock,
      strength: updatedPlayerStrength,
      stance: updatedStance,
      firstAttackPlayedThisTurn: prev.firstAttackPlayedThisTurn || card.type === 'attack'
    }));

    addLog(damageLogAdditions);

    // Call Gemini asynchronously for commentator feedback on the play
    setTimeout(() => {
      fetchBattleNarration(damageLogAdditions);
    }, 400);

    // Turn winner evaluation instantly
    const allDead = updatedEnemies.every(e => e.hp <= 0);
    if (allDead) {
      setTimeout(() => {
        handleVictoryCombat(updatedEnemies[0]);
      }, 1000);
    }
  };

  // --- END PLAYER TURN (ENEMY COMES ON OUT) ---
  const handleEndTurn = () => {
    if (state.enemies.length === 0) return;
    
    // Disable interaction momentarily
    addLog(`ターン終了。敵の猛攻が始まる...`);

    let updatedPlayerHp = state.hp;
    let updatedPlayerBlock = state.block;
    let updatedPlayerFury = state.fury;
    let updatedEnemies = [...state.enemies];
    let logsAccumulator = '［敵ターン］ ';

    const enemy = state.enemies[0]; // Simple single enemy rules
    if (enemy && enemy.hp > 0) {
      const intent = enemy.intent;
      
      if (intent.type === 'attack' && intent.value) {
        let baseDamage = intent.value + enemy.strength;
        if (enemy.weak > 0) baseDamage = Math.floor(baseDamage * 0.75); // Enemy Weakened
        if (state.vulnerable > 0) baseDamage = Math.floor(baseDamage * 1.5); // Player Vulnerable

        // Adjust postures
        if (state.stance === 'assault') {
          baseDamage = Math.floor(baseDamage * 1.25); // Assault Stance takes 25% MORE damage
        }

        const remainingBlock = Math.max(0, updatedPlayerBlock - baseDamage);
        const actualHpDeducted = Math.max(0, baseDamage - updatedPlayerBlock);
        updatedPlayerHp = Math.max(0, updatedPlayerHp - actualHpDeducted);

        // Gain Fury when receiving damage
        if (actualHpDeducted > 0) {
          updatedPlayerFury = Math.min(100, updatedPlayerFury + Math.floor(actualHpDeducted * 0.6));
        }

        updatedPlayerBlock = remainingBlock;
        triggerShake('player');
        addFloatingText('player', `-${baseDamage} HP`, 'damage');
        logsAccumulator += `${enemy.name} の「${intent.description}」により ${baseDamage} 被弾。 `;

      } else if (intent.type === 'defend' && intent.value) {
        const addedBlock = intent.value;
        updatedEnemies = updatedEnemies.map(e => {
          if (e.id === enemy.id) return { ...e, block: e.block + addedBlock };
          return e;
        });
        addFloatingText(enemy.id, `+${addedBlock} 防御`, 'block');
        logsAccumulator += `${enemy.name} は防壁を展開、ブロック+${addedBlock}。 `;

      } else if (intent.type === 'buff') {
        updatedEnemies = updatedEnemies.map(e => {
          if (e.id === enemy.id) return { ...e, strength: e.strength + 2 };
          return e;
        });
        logsAccumulator += `${enemy.name} は雄叫びを上げ、筋力+2 (永続)。 `;

      } else if (intent.type === 'debuff') {
        setState(prev => ({
          ...prev,
          vulnerable: prev.vulnerable + 2,
          weak: prev.weak + 1
        }));
        logsAccumulator += `${enemy.name} の怪しげなデバフ。プレイヤー脆弱2、脱力1付与。 `;
      }
    }

    // Tick status durations down for next player turn
    const nextPlayerVulnerable = Math.max(0, state.vulnerable - 1);
    const nextPlayerWeak = Math.max(0, state.weak - 1);
    
    updatedEnemies = updatedEnemies.map(e => {
      return {
        ...e,
        vulnerable: Math.max(0, e.vulnerable - 1),
        weak: Math.max(0, e.weak - 1),
        block: 0, // Enemy block decays on new round
        // Roll new dynamic intent
        intent: getNextIntent(e, state.round)
      };
    });

    // Start player turn: decay block to 0 (default)
    const nextPlayerBlock = 0; 

    let featherEnergyBonus = 0;
    if (hasRelic('magic_feather') && Math.random() < 0.15) {
      featherEnergyBonus = 1;
      logsAccumulator += `「飛翔の羽」の効果でエネルギーが1追加で回復した！ `;
    }
    
    // Draw 5 new cards (or 6 if own obsidian_mirror), move remaining hand to discard
    let nextDiscard = [...state.discard, ...state.hand];
    let nextDrawPile = [...state.drawPile];
    let nextHand: Card[] = [];

    const baseDrawCount = hasRelic('obsidian_mirror') ? 6 : 5;
    if (hasRelic('obsidian_mirror')) {
      logsAccumulator += `「黒曜石の鏡」の魔力により、ターン開始時のドローが6枚になった！ `;
    }

    for (let i = 0; i < baseDrawCount; i++) {
      if (nextDrawPile.length === 0) {
        nextDrawPile = shuffleCards(nextDiscard);
        nextDiscard = [];
      }
      if (nextDrawPile.length > 0) {
        nextHand.push(nextDrawPile[0]);
        nextDrawPile = nextDrawPile.slice(1);
      }
    }

    addLog(logsAccumulator);

    setState(prev => ({
      ...prev,
      hp: updatedPlayerHp,
      block: nextPlayerBlock,
      fury: updatedPlayerFury,
      enemies: updatedEnemies,
      hand: nextHand,
      drawPile: nextDrawPile,
      discard: nextDiscard,
      energy: prev.maxEnergy + featherEnergyBonus,
      vulnerable: nextPlayerVulnerable,
      weak: nextPlayerWeak,
      round: prev.round + 1,
      selectedCardId: null,
      firstAttackPlayedThisTurn: false
    }));

    // Trigger AI commentator narration on new enemy moves
    setTimeout(() => {
      fetchBattleNarration(logsAccumulator);
    }, 450);

    // Validate player dead check
    if (updatedPlayerHp <= 0) {
      setTimeout(() => {
        setState(prev => ({ ...prev, gameStateType: 'gameover' }));
      }, 1000);
    }
  };

  const getNextIntent = (enemy: Enemy, round: number): { type: 'attack' | 'defend' | 'buff' | 'debuff' | 'special', value?: number, description: string } => {
    const templateKey = enemy.templateId || enemy.visualType;
    const list = ENEMY_TEMPLATES[templateKey as keyof typeof ENEMY_TEMPLATES]?.intents || [
      { type: 'attack', value: 5, description: '通常攻撃 (5ダメージ)' }
    ];
    // Dynamic index based on rounds
    const idx = (round + Math.floor(Math.random() * 2)) % list.length;
    const originalIntent = list[idx];

    // Scale damage dynamically on later Acts
    const act = state.act || 1;
    let damageAdd = 0;
    if (act === 2) damageAdd = 2;
    else if (act === 3) damageAdd = 5;

    if (originalIntent.type === 'attack' && originalIntent.value !== undefined) {
      const val = originalIntent.value + damageAdd;
      return {
        ...originalIntent,
        value: val,
        description: originalIntent.description.replace(/\d+ダメージ/, `${val}ダメージ`)
      };
    }
    return originalIntent;
  };

  // --- VICTORY COMBAT FLOW ---
  const handleVictoryCombat = (defeatedEnemy: Enemy) => {
    // Earn Gold
    let goldMultiplier = 1.0;
    if (hasRelic('lucky_charm')) goldMultiplier += 0.25;
    if (hasRelic('vanguard_insignia')) goldMultiplier += 0.50;

    let goldBase = defeatedEnemy.visualType === 'dragon' ? 300 : defeatedEnemy.visualType === 'lich' || defeatedEnemy.visualType === 'golem' ? 120 : 45;
    let goldEarned = Math.round(goldBase * goldMultiplier);
    
    // Filter relics e.g., blood_ember heals 4 hp after wins
    let hpRecoverAmount = 0;
    if (hasRelic('blood_ember')) {
      hpRecoverAmount = 4;
    }

    // Generate 3 random cards for rewards selection drafting
    const startTemplates = [...CARD_TEMPLATES];
    const shuffledTemplates = shuffleCards(startTemplates as Card[]);
    const selection = shuffledTemplates.slice(0, 3).map(c => createCardInstance(c));
    setRewardCards(selection);

    addLog(`戦闘に大勝利。敵の手を逃れた！ +${goldEarned} ゴールド。`);
    
    setState(prev => {
      const nextHp = Math.min(prev.maxHp, prev.hp + hpRecoverAmount);
      const updatedNodes = prev.mapNodes.map(n => {
        if (n.id === prev.currentNodeId) {
          return { ...n, isCompleted: true };
        }
        return n;
      });
      return {
        ...prev,
        gold: prev.gold + goldEarned,
        hp: nextHp,
        strength: prev.strength, // retain base player strength points
        activeBattleNodeId: null,
        mapNodes: updatedNodes
      };
    });

    if (defeatedEnemy.visualType === 'dragon' || (defeatedEnemy.id === 'enemy_boss' && state.act === 3)) {
      // Game Cleared!
      setState(prev => ({ ...prev, gameStateType: 'victory' }));
    }
  };

  const handleAdvanceToNextAct = () => {
    const nextAct = state.act + 1;
    setState(prev => {
      const nextMap = generateMap(nextAct);
      // Recover 30% of max HP as act transition bonus
      const recovery = Math.floor(prev.maxHp * 0.3);
      const nextHp = Math.min(prev.maxHp, prev.hp + recovery);
      
      return {
        ...prev,
        act: nextAct,
        mapNodes: nextMap,
        currentNodeId: null,
        hp: nextHp,
        gameStateType: 'map',
        floor: 1
      };
    });
    addLog(`✨ 次元を超えた！ 第 ${nextAct} 階層へ突入。敵がより強大になる...！`);
  };

  const selectRewardCard = (card: Card) => {
    setState(prev => ({
      ...prev,
      deck: [...prev.deck, card],
      gameStateType: 'map',
      currentNodeId: prev.currentNodeId // returns to coordinates map
    }));
    setRewardCards([]);
    addLog(`カード「${card.name}」をデッキへ追加した。`);
  };

  const skipRewardCard = () => {
    setState(prev => ({
      ...prev,
      gameStateType: 'map'
    }));
    setRewardCards([]);
    addLog(`報酬カードをパスした。`);
  };

  // --- ACTIONS: SHOP TRANSATIONS ---
  const purchaseCard = (cardTemplate: Omit<Card, 'id'>, price: number) => {
    if (state.gold < price) {
      addFloatingText('player', 'ゴールド不足', 'info');
      return;
    }

    const newInst = createCardInstance(cardTemplate);
    setState(prev => ({
      ...prev,
      gold: prev.gold - price,
      deck: [...prev.deck, newInst]
    }));
    addLog(`ショップで「${cardTemplate.name}」を購入した。`);
    addFloatingText('player', `-${price}G`, 'damage');
    setSelectedShopCard(null);
  };

  const purchaseRelic = (relic: Relic, price: number) => {
    if (state.gold < price) {
      addFloatingText('player', 'ゴールド不足', 'info');
      return;
    }

    setState(prev => {
      let nextMaxHp = prev.maxHp;
      let nextHp = prev.hp;
      let nextGold = prev.gold - price;
      
      // Special logic for earning golden seal
      if (relic.id === 'golden_coin') {
        nextGold += 100; // instant rebate
      }

      // Fabled Chalice (+15 max HP & recover 15 HP)
      if (relic.id === 'fabled_chalice') {
        nextMaxHp += 4;
        nextHp = Math.min(nextMaxHp, prev.hp + 4);
      }

      // Dragons Core (+10 max HP & recover 10 HP)
      if (relic.id === 'dragons_core') {
        nextMaxHp += 10;
        nextHp = Math.min(nextMaxHp, prev.hp + 10);
      }

      return {
        ...prev,
        gold: nextGold,
        maxHp: nextMaxHp,
        hp: nextHp,
        relics: [...prev.relics, relic]
      };
    });

    addLog(`レリック「${relic.name}」を実体化させた！ ${relic.description}`);
    addFloatingText('player', `-${price}G`, 'damage');
  };

  const upgradeCardInDeck = (cardId: string, upgradeCost: number) => {
    if (state.gold < upgradeCost) {
      addFloatingText('player', 'ゴールド不足', 'info');
      return;
    }

    setState(prev => {
      const nextDeck = prev.deck.map(c => {
        if (c.id === cardId) {
          const upgradedEffects = c.effects.map(eff => {
            const upV = eff.type === 'damage' ? eff.value + 3 : eff.type === 'block' ? eff.value + 3 : eff.type === 'fury' ? eff.value + 10 : eff.value;
            return { ...eff, value: upV };
          });
          return {
            ...c,
            name: `${c.name}+`,
            isUpgraded: true,
            description: c.description.replace(/\d+/, (m) => (parseInt(m) + 3).toString()),
            effects: upgradedEffects
          };
        }
        return c;
      });

      return {
        ...prev,
        gold: prev.gold - upgradeCost,
        deck: nextDeck
      };
    });

    addLog(`カードを強化完了しました。`);
    addFloatingText('player', `-${upgradeCost}G`, 'damage');
    setSelectedUpgradeCard(null);
  };

  const removeCardInDeck = (cardId: string, removalCost: number) => {
    if (state.gold < removalCost) {
      addFloatingText('player', 'ゴールド不足', 'info');
      return;
    }

    setState(prev => {
      const nextDeck = prev.deck.filter(c => c.id !== cardId);
      return {
        ...prev,
        gold: prev.gold - removalCost,
        deck: nextDeck
      };
    });

    addLog(`カードをデッキから綺麗に燃やし尽くしました。`);
    addFloatingText('player', `-${removalCost}G`, 'damage');
  };

  // --- CAMP CHOICES ---
  const handleCampOption = (type: 'rest' | 'forge', selectedCardId?: string) => {
    if (type === 'rest') {
      const healAmount = Math.floor(state.maxHp * 0.3); // 30% HP Recov
      setState(prev => ({
        ...prev,
        hp: Math.min(prev.maxHp, prev.hp + healAmount),
        gameStateType: 'map'
      }));
      addLog(`焚き火のそばで温かく休息した。残りHPが ${healAmount} 回復しました。`);
    } else if (type === 'forge' && selectedCardId) {
      setState(prev => {
        const nextDeck = prev.deck.map(c => {
          if (c.id === selectedCardId) {
            const upgradedEffects = c.effects.map(eff => {
              const upV = eff.type === 'damage' ? eff.value + 3 : eff.type === 'block' ? eff.value + 3 : eff.type === 'fury' ? eff.value + 10 : eff.value;
              return { ...eff, value: upV };
            });
            return {
              ...c,
              name: `${c.name}+`,
              isUpgraded: true,
              description: c.description.replace(/\d+/, (m) => (parseInt(m) + 3).toString()),
              effects: upgradedEffects
            };
          }
          return c;
        });

        return {
          ...prev,
          deck: nextDeck,
          gameStateType: 'map'
        };
      });
      addLog(`鍛冶の余熱を用いてお気に入りのカードを「+」仕様に強化した。`);
    }
  };

  // --- ACTIONS: NARRATIVE GAME EVENTS ---
  const conductEventOption = (option: any) => {
    let outcomeDescription = option.outcomeText;
    let effectId = option.effectId;
    
    let updatedHp = state.hp;
    let updatedMaxHp = state.maxHp;
    let updatedGold = state.gold;
    let updatedDeck = [...state.deck];
    let updatedRelics = [...state.relics];

    if (effectId === 'crimson_drink') {
      updatedHp = Math.min(state.maxHp, state.hp + 20);
      updatedMaxHp = Math.max(10, state.maxHp - 5);
      if (updatedHp > updatedMaxHp) updatedHp = updatedMaxHp;
    } else if (effectId === 'crimson_wash') {
      const cardInst = createCardInstance(CARD_TEMPLATES.find(c => c.originalId === 'fury_slash')!);
      updatedDeck.push(cardInst);
    } else if (effectId === 'leave_heal') {
      updatedHp = Math.min(state.maxHp, state.hp + 5);
    } else if (effectId === 'tomb_rob') {
      updatedGold += 100;
      updatedHp = Math.max(1, state.hp - 12);
    } else if (effectId === 'tomb_pray') {
      // Pick random relics from buckler or pendant, but make sure they are unowned
      const candidates = [RELIC_LIST[1], RELIC_LIST[2]]; // buckler and pendant
      const unownedCandidates = candidates.filter(c => !state.relics.some(ur => ur.id === c.id));
      if (unownedCandidates.length > 0) {
        const chosenRelic = unownedCandidates[Math.floor(Math.random() * unownedCandidates.length)];
        updatedRelics.push(chosenRelic);
      } else {
        // If both are owned, award ANY unowned relic
        const anyUnowned = RELIC_LIST.filter(r => !state.relics.some(ur => ur.id === r.id));
        if (anyUnowned.length > 0) {
          const chosenRelic = anyUnowned[Math.floor(Math.random() * anyUnowned.length)];
          updatedRelics.push(chosenRelic);
          if (chosenRelic.id === 'golden_coin') {
            updatedGold += 100;
          }
          if (chosenRelic.id === 'fabled_chalice') {
            updatedMaxHp += 4;
            updatedHp = Math.min(updatedMaxHp, state.hp + 4);
          }
          if (chosenRelic.id === 'dragons_core') {
            updatedMaxHp += 10;
            updatedHp = Math.min(updatedMaxHp, state.hp + 10);
          }
        } else {
          updatedGold += 50; // duplicate compensation if everything is owned
        }
      }
    } else if (effectId === 'tomb_upgrade') {
      // Upgrade first starter defend
      const starterDefIdx = updatedDeck.findIndex(c => c.originalId === 'defend' && !c.isUpgraded);
      if (starterDefIdx !== -1) {
        updatedDeck[starterDefIdx] = {
          ...updatedDeck[starterDefIdx],
          name: '防御+',
          isUpgraded: true,
          effects: [{ type: 'block', value: 8, target: 'player' }]
        };
      }
    } else if (effectId === 'forge_blood') {
      updatedHp = Math.max(1, state.hp - 15);
      // Upgrade random 2 cards
      let counts = 0;
      updatedDeck = updatedDeck.map(c => {
        if (!c.isUpgraded && counts < 2) {
          counts++;
          const upgradedEffects = c.effects.map(eff => {
            const upV = eff.type === 'damage' ? eff.value + 3 : eff.type === 'block' ? eff.value + 3 : eff.value;
            return { ...eff, value: upV };
          });
          return {
            ...c,
            name: `${c.name}+`,
            isUpgraded: true,
            effects: upgradedEffects
          };
        }
        return c;
      });
    } else if (effectId === 'forge_gold') {
      updatedGold = Math.max(0, state.gold - 50);
      // Upgrade first starter strike
      const starterStrIdx = updatedDeck.findIndex(c => c.originalId === 'strike' && !c.isUpgraded);
      if (starterStrIdx !== -1) {
        updatedDeck[starterStrIdx] = {
          ...updatedDeck[starterStrIdx],
          name: 'ストライク+',
          isUpgraded: true,
          effects: [{ type: 'damage', value: 9, target: 'enemy' }]
        };
      }
    } else if (effectId === 'trade_slash_rare') {
      const index = updatedDeck.findIndex(c => c.originalId === 'strike');
      if (index !== -1) {
        updatedDeck.splice(index, 1);
        // Find rare templates
        const rareTemplates = CARD_TEMPLATES.filter(c => c.rarity === 'rare');
        const chosenRare = rareTemplates[Math.floor(Math.random() * rareTemplates.length)];
        updatedDeck.push(createCardInstance(chosenRare));
      }
    } else if (effectId === 'trade_defend_uncommon') {
      const index = updatedDeck.findIndex(c => c.originalId === 'defend');
      if (index !== -1) {
        updatedDeck.splice(index, 1);
        // Find uncommon templates
        const uncomTemplates = CARD_TEMPLATES.filter(c => c.rarity === 'uncommon');
        const chosenUncom = uncomTemplates[Math.floor(Math.random() * uncomTemplates.length)];
        updatedDeck.push(createCardInstance(chosenUncom));
      }
    } else if (effectId === 'obelisk_hp') {
      updatedMaxHp += 15;
      updatedHp = Math.min(updatedMaxHp, state.hp + 20);
    } else if (effectId === 'obelisk_upgrade') {
      let counts = 0;
      updatedDeck = updatedDeck.map(c => {
        if (!c.isUpgraded && counts < 2) {
          counts++;
          const upgradedEffects = c.effects.map(eff => {
            const upV = eff.type === 'damage' ? eff.value + 3 : eff.type === 'block' ? eff.value + 3 : eff.value;
            return { ...eff, value: upV };
          });
          return {
            ...c,
            name: `${c.name}+`,
            isUpgraded: true,
            effects: upgradedEffects
          };
        }
        return c;
      });
    } else if (effectId === 'obelisk_relic_charm') {
      if (state.gold >= 75) {
        updatedGold -= 75;
      } else {
        updatedGold = 0;
      }
      const charm = RELIC_LIST.find(r => r.id === 'lucky_charm');
      if (charm && !updatedRelics.some(r => r.id === 'lucky_charm')) {
        updatedRelics.push(charm);
      } else {
        // charm is already owned, give any other unowned non-starter relic
        const unowned = RELIC_LIST.filter(r => r.id !== 'blood_ember' && !updatedRelics.some(ur => ur.id === r.id));
        if (unowned.length > 0) {
          const chosen = unowned[Math.floor(Math.random() * unowned.length)];
          updatedRelics.push(chosen);
          if (chosen.id === 'golden_coin') {
            updatedGold += 100;
          }
          if (chosen.id === 'fabled_chalice') {
            updatedMaxHp += 4;
            updatedHp = Math.min(updatedMaxHp, state.hp + 4);
          }
          if (chosen.id === 'dragons_core') {
            updatedMaxHp += 10;
            updatedHp = Math.min(updatedMaxHp, state.hp + 10);
          }
        } else {
          // Refund some money if player already has literally every single relic
          updatedGold += 100;
        }
      }
    } else if (effectId === 'blessing_hp') {
      updatedMaxHp += 15;
      updatedHp = updatedMaxHp;
    } else if (effectId === 'blessing_upgrade') {
      let counts = 0;
      updatedDeck = updatedDeck.map(c => {
        if (!c.isUpgraded && counts < 2) {
          counts++;
          const upgradedEffects = c.effects.map(eff => {
            const upV = eff.type === 'damage' ? eff.value + 3 : eff.type === 'block' ? eff.value + 3 : eff.value;
            return { ...eff, value: upV };
          });
          return {
            ...c,
            name: `${c.name}+`,
            isUpgraded: true,
            effects: upgradedEffects
          };
        }
        return c;
      });
    } else if (effectId === 'blessing_relic') {
      const unownedRelics = RELIC_LIST.filter(r => !updatedRelics.some(ur => ur.id === r.id));
      if (unownedRelics.length > 0) {
        const randomRelic = unownedRelics[Math.floor(Math.random() * unownedRelics.length)];
        updatedRelics.push(randomRelic);
        if (randomRelic.id === 'golden_coin') {
          updatedGold += 100;
        }
        if (randomRelic.id === 'fabled_chalice') {
          updatedMaxHp += 15;
          updatedHp = Math.min(updatedMaxHp, state.hp + 15);
        }
        if (randomRelic.id === 'dragons_core') {
          updatedMaxHp += 10;
          updatedHp = Math.min(updatedMaxHp, state.hp + 10);
        }
      }
    } else if (effectId === 'blessing_gold') {
      updatedGold += 100;
    }

    setState(prev => ({
      ...prev,
      hp: updatedHp,
      maxHp: updatedMaxHp,
      gold: updatedGold,
      deck: updatedDeck,
      relics: updatedRelics,
      eventOutcome: outcomeDescription
    }));

    // Narration
    if (state.currentEvent) {
      fetchEventNarration(state.currentEvent, option.text, outcomeDescription);
    }
  };

  const closeCompletedEvent = () => {
    setState(prev => ({
      ...prev,
      gameStateType: 'map',
      currentEvent: null,
      eventOutcome: null
    }));
  };

  // Reset/Restart Game completely
  const handleRestart = () => {
    localStorage.removeItem('rogue_vanguard_session');
    setState(initializeGame());
    setAiNarration('');
  };

  // Helper formatting stance labels
  const getStanceInfo = (stance: StanceType) => {
    switch (stance) {
      case 'defensive':
        return { label: '防御の構え', color: 'border-blue-500 text-blue-400 bg-blue-950/40', desc: '盾カードによるブロック獲得量 +30%' };
      case 'assault':
        return { label: '劇撃の構え', color: 'border-red-500 text-red-500 bg-red-950/40', desc: '与える・受ける全ダメージ +25%' };
      default:
        return { label: '基本姿勢', color: 'border-neutral-500 text-neutral-400 bg-neutral-900', desc: '攻守が拮抗した安全な基本構え' };
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-red-900 selection:text-white flex flex-col antialiased">
      {/* GLOBAL HUD BAR */}
      <header className="bg-neutral-900/90 border-b border-neutral-800 backdrop-blur-md px-4 py-3 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="cursor-pointer" onClick={() => setState(prev => ({ ...prev, gameStateType: 'title' }))}>
            <span className="font-sans font-bold text-lg tracking-wider text-glow-gold text-yellow-500 uppercase flex items-center font-mono">
              <Sword className="w-5 h-5 mr-1.5 text-yellow-500" />
              Wendeck
            </span>
          </div>
          <span className="text-neutral-500 text-xs">|</span>
          <div className="flex items-center space-x-1.5 text-neutral-400 text-sm">
            <span>クラス:</span>
            <span className="text-yellow-500 font-semibold">{state.playerClass}</span>
          </div>
        </div>

        {state.gameStateType !== 'title' && (
          <div className="flex items-center space-x-6 text-sm">
            {/* HP STATUS Bar */}
            <div className="flex items-center space-x-2">
              <Heart className="w-4 h-5 text-red-500 fill-red-500/35" />
              <div className="w-24 bg-neutral-800 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-red-500 h-full transition-all duration-300" 
                  style={{ width: `${Math.max(0, Math.min(100, (state.hp / state.maxHp) * 100))}%` }} 
                />
              </div>
              <span className="font-mono text-xs text-red-400 font-medium">{state.hp}/{state.maxHp}</span>
            </div>

            {/* GOLD COINS */}
            <div className="flex items-center space-x-1.5 text-yellow-400">
              <Coins className="w-4.5 h-4.5 text-yellow-500" />
              <span className="font-mono font-bold text-yellow-300">{state.gold} G</span>
            </div>

            {/* FLOOR Counter - Slay progress */}
            <div className="bg-neutral-800 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-300">
              階層: <span className="font-mono font-bold text-white text-sm">{Math.min(12, state.mapNodes.filter(n => n.isCompleted).length + 1)}</span> / 12 (Boss)
            </div>

            {/* DECK DELETION & MANAGER MODAL TRIGGER */}
            <button 
              onClick={() => setIsDeckViewerOpen(true)}
              className="bg-neutral-800 hover:bg-neutral-700/80 active:bg-neutral-800 transition border border-neutral-700 rounded px-3 py-1 text-xs text-neutral-200 flex items-center space-x-1"
            >
              <BookOpen className="w-3.5 h-3.5 mr-1" />
              デッキを見る ({state.deck.length})
            </button>

            {/* RESTART */}
            <button 
              onClick={handleRestart}
              className="text-neutral-500 hover:text-red-400 text-xs flex items-center transition"
              title="データを破棄して最初から"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              リセット
            </button>
          </div>
        )}
      </header>

      {/* RENDER CURRENT RELICS BAR */}
      {state.gameStateType !== 'title' && state.relics.length > 0 && (
        <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-neutral-400 text-xs font-semibold uppercase tracking-wider flex items-center shrink-0">
            <Sparkles className="w-3 h-3 mr-1 text-yellow-500" />
            遺品 (レリック):
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {state.relics.map(r => (
              <div 
                key={r.id} 
                className="group relative bg-neutral-800 border border-neutral-700 rounded px-2.5 py-0.5 text-xs text-neutral-300 cursor-help transition hover:bg-neutral-700 hover:border-yellow-600 flex items-center"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1.5 animate-pulse shrink-0" />
                <span className="font-medium text-xs text-white">{r.name}</span>
                {/* TOOLTIP */}
                <div className="absolute left-0 top-full mt-2 hidden group-hover:block transition z-50 bg-neutral-900 border border-neutral-700 p-2.5 rounded shadow-2xl w-56 text-xs text-neutral-300 pointer-events-none">
                  <h4 className="font-bold text-yellow-400 text-xs mb-1">{r.name}</h4>
                  <p className="leading-relaxed font-sans">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FLOATING TARGET PARTICLES (Damage text indicator engine) */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingTexts.map(t => {
          let alignStyle = "top-[40%] left-[25%]"; // Default player float
          if (t.target !== 'player') {
            alignStyle = "top-[35%] right-[25%]"; // Default enemy float
          }
          const colStyle = t.type === 'damage' ? 'text-red-500 text-3xl font-extrabold tracking-tight scale-105' : t.type === 'block' ? 'text-blue-400 text-2xl font-bold' : t.type === 'heal' ? 'text-green-400 text-2xl font-bold' : 'text-yellow-400 text-xl font-bold';
          return (
            <div key={t.id} className={`absolute ${alignStyle} ${colStyle} animate-float-damage pointer-events-none font-mono text-center w-40 drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]`}>
              {t.text}
            </div>
          );
        })}
      </div>

      <main className="flex-1 flex flex-col">
        {/* TITLE PAGE VIEW */}
        {state.gameStateType === 'title' && (
          <div className="flex-1 flex flex-col justify-center items-center py-20 px-4 select-none relative max-w-4xl mx-auto w-full">
            {/* Ambient Red glow element */}
            <div className="absolute top-[30%] left-[50%] -translate-x-[50%] -translate-y-[50%] w-96 h-96 bg-red-950/20 rounded-full blur-[100px] pointer-events-none" />

            <div className="text-center space-y-2 mb-12 z-10 transition-all">
              <span className="text-yellow-500 text-xs font-semibold tracking-widest uppercase border border-yellow-500/25 px-3 py-1 rounded bg-yellow-950/15">
                新感覚ダークファンタジー・カードデッキバトル
              </span>
              <h1 className="text-5xl font-sans font-extrabold tracking-tight text-white mb-2 uppercase drop-shadow-md">
                Wendeck <span className="text-red-600 glow-red px-2 py-0.5 text-3xl font-medium tracking-normal rounded-md lowercase ml-2 font-mono">ヴェンデック</span>
              </h1>
              <p className="text-neutral-400 max-w-lg mx-auto text-sm">
                「防御・強襲」の構えを自在に操り、闘志(Fury)の猛火を解き放て。カードの購入・強化、ランダムイベントを経て、最深部の混沌竜を討て。
              </p>
            </div>

            {/* CLASS SELECTOR (Only 1 playable class client requirement, others preview) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mb-12 z-10">
              <div className="border border-yellow-600 bg-neutral-900/60 rounded-xl p-5 shadow-xl transition relative group overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-yellow-500 border border-yellow-500/25 px-2 py-0.5 rounded font-mono uppercase font-semibold bg-yellow-900/25">使用可能</span>
                    <Heart className="w-5 h-5 text-red-500" />
                  </div>
                  <h3 className="text-lg font-sans font-extrabold text-white mb-1.5 flex items-center">
                    <Flame className="w-5 h-5 text-red-500 mr-1.5 animate-pulse" />
                    先陣の勇士: ヴァンガード
                  </h3>
                  <p className="text-neutral-400 text-xs leading-relaxed mb-4">
                    独自の「怒気(Fury)」と「戦闘姿勢(Stance)」を持つ武士。蓄積した怒気が臨界（50点以上）に達すると、攻撃力が2倍（Frenzy状態）に変化する武勇の鬼。
                  </p>
                </div>
                <div className="border-t border-neutral-800/85 pt-3 mt-4 text-xs space-y-1.5 text-neutral-400 font-mono">
                  <div className="flex justify-between"><span>初期HP:</span> <span className="text-red-400 font-semibold">80 / 80</span></div>
                  <div className="flex justify-between"><span>初期遺品:</span> <span className="text-yellow-400 font-semibold">血の残り火</span></div>
                  <div className="flex justify-between"><span>初期ゴールド:</span> <span className="text-yellow-400 font-semibold">99 G</span></div>
                </div>
              </div>

              {/* LOCKED EXTRA CLASSES PREVIEWS */}
              <div className="border border-neutral-800 bg-neutral-900/35 rounded-xl p-5 transition opacity-60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3 text-xs text-neutral-500">
                    <span className="font-mono bg-neutral-800 px-2 py-0.5 rounded">未解放</span>
                    <Skull className="w-4 h-4 text-neutral-600" />
                  </div>
                  <h3 className="text-md font-sans font-bold text-neutral-400 mb-1.5">
                    蒼穹の占術師: メイジ
                  </h3>
                  <p className="text-neutral-500 text-xs leading-relaxed">
                    「マナ・チャージ」を蓄えて連鎖魔法（Chain）を詠唱する。物理を凌駕する呪文書デッキで戦域を支配する。
                  </p>
                </div>
                <span className="text-xs text-neutral-500 font-medium italic mt-4">深層第5フロア突破で解放...</span>
              </div>

              <div className="border border-neutral-800 bg-neutral-900/35 rounded-xl p-5 transition opacity-60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3 text-xs text-neutral-500">
                    <span className="font-mono bg-neutral-800 px-2 py-0.5 rounded">未解放</span>
                    <Crown className="w-4 h-4 text-neutral-600" />
                  </div>
                  <h3 className="text-md font-sans font-bold text-neutral-400 mb-1.5">
                    影縫の暗殺者: アサシン
                  </h3>
                  <p className="text-neutral-500 text-xs leading-relaxed">
                    「毒(Poison)」や「クリティカル・コンボ」を重ね、敵を行動不能に陥れる。1ターンに数十回の短剣撃を紡ぐ神速クラス。
                  </p>
                </div>
                <span className="text-xs text-neutral-500 font-medium italic mt-4">ゴールド累積500獲得で解放...</span>
              </div>
            </div>

            {/* ACTION TRIGGERS */}
            <div className="z-10 text-center">
              <button 
                onClick={() => {
                  const initialEvent = EVENT_LIST.find(e => e.id === 'initial_blessing');
                  setState(prev => ({
                    ...prev,
                    gameStateType: 'event',
                    currentEvent: initialEvent || null,
                    eventOutcome: null
                  }));
                }}
                className="bg-red-600 hover:bg-red-500 hover:scale-105 active:bg-red-700 transition duration-200 border-2 border-red-500 rounded-lg px-8 py-3.5 font-sans font-bold text-lg text-white glow-red shadow-xl tracking-wider inline-flex items-center cursor-pointer"
              >
                見捨てられたダンジョンへ挑む
                <ChevronRight className="w-5 h-5 ml-2 text-white animate-pulse" />
              </button>
              <p className="text-neutral-500 text-xs mt-3 leading-relaxed">
                ※ゲーム進行は自動で保存され、リロードしても同一階層から同じデッキ・ゴールドで再開可能です。
              </p>
            </div>
          </div>
        )}

        {/* --- MAP PROGRESSION BOARD VIEW --- */}
        {state.gameStateType === 'map' && (() => {
          const maxFloor = state.mapNodes.length > 0 ? Math.max(...state.mapNodes.map(n => n.floor)) : 11;
          const isActFinished = state.mapNodes.some(n => n.floor === maxFloor && n.isCompleted);
          return (
            <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 py-8 select-none">
              
              {/* ACT TRANSITION INTERFACE BUTTON */}
              {isActFinished && state.act < 3 && (
                <div className="bg-gradient-to-r from-red-950/40 via-neutral-900 to-red-950/40 border-2 border-red-500 rounded-xl p-8 mb-8 text-center animate-pulse shadow-xl shadow-red-950/50">
                  <h3 className="text-2xl font-sans font-black text-red-500 text-glow-gold tracking-wider mb-2">
                    👑 第 {state.act} 階層を制覇した！ 👑
                  </h3>
                  <p className="text-neutral-300 text-sm mb-6 max-w-lg mx-auto">
                    次元の裂け目が口を開いた... さらに強力な闇が渦巻く次なる領域へと道が続いています。
                    一時休息として体力を最大値の 30% 回復し、いざ次なる試練へと昇りましょう。
                  </p>
                  <button 
                    id="btn_advance_act"
                    onClick={handleAdvanceToNextAct}
                    className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg uppercase tracking-widest text-sm shadow-md transition transform hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    第 {state.act + 1} 階層へ昇る (Advance to Act {state.act + 1})
                  </button>
                </div>
              )}

              <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-neutral-800 pb-4">
                <div>
                  <h2 className="text-2xl font-sans font-extrabold text-white tracking-wide uppercase flex items-center mb-1">
                    <Compass className="w-6 h-6 mr-1.5 text-red-500" />
                    混沌の深淵地図 [Act {state.act}]
                  </h2>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    目的地を選択してください。各マスは個別の戦闘、ショップ、または運命の選択（イベント）です。輝いているルートが進めます。
                  </p>
                </div>
                <div className="mt-3 md:mt-0 flex gap-2">
                  <div className="bg-neutral-900 border border-neutral-800 rounded px-3 py-1.5 text-xs text-neutral-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-red-600 border border-red-400 block" /> 戦闘
                  </div>
                  <div className="bg-neutral-900 border border-neutral-800 rounded px-3 py-1.5 text-xs text-neutral-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-yellow-500 border border-yellow-300 block" /> ショップ
                  </div>
                  <div className="bg-neutral-900 border border-neutral-800 rounded px-3 py-1.5 text-xs text-neutral-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-purple-500 border border-purple-300 block" /> イベント
                  </div>
                  <div className="bg-neutral-900 border border-neutral-800 rounded px-3 py-1.5 text-xs text-neutral-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-600 border border-emerald-400 block" /> キャンプ
                  </div>
                </div>
              </div>

              {/* PROCEDURAL CONNECT-THE-DOTS MAP VIEW */}
              <div className="flex-1 bg-neutral-900/40 border border-neutral-800 p-6 rounded-xl relative overflow-y-auto max-h-[640px] flex flex-col-reverse justify-between space-y-reverse space-y-6">
                {/* Generate columns visual representations dynamically */}
                {Array.from({ length: Math.max(...state.mapNodes.map(n => n.floor)) + 1 }).map((_, floorIdx) => {
                  const floorNodes = state.mapNodes.filter(n => n.floor === floorIdx);
                  const currentNode = state.mapNodes.find(n => n.id === state.currentNodeId);
                  const nextUnlocks = currentNode ? currentNode.isConnectedTo : ['node_f0_c0', 'node_f0_c1', 'node_f0_c2'];

                  return (
                    <div key={floorIdx} className="relative flex justify-around items-center border-b border-neutral-800/40 pb-6 pt-6">
                      {/* Floor index label */}
                      <span className="absolute left-2 font-mono text-neutral-500 text-xs font-semibold uppercase tracking-wider">
                        Floor {floorIdx + 1}
                      </span>

                      {floorNodes.map(node => {
                        const isCompleted = node.isCompleted;
                        const isCurrent = node.id === state.currentNodeId;
                        // Path logic: Can click this node if either:
                        // 1. You are on floor idx - 1 and this node's id is connected to your current node.
                        // 2. You have never started (floorIdx === 0).
                        const isSelectable = (state.currentNodeId === null && floorIdx === 0) || 
                                             (currentNode && currentNode.floor === floorIdx - 1 && nextUnlocks.includes(node.id));
                        
                        let colorClass = "border-neutral-700 text-neutral-500 bg-neutral-800/45 cursor-not-allowed";
                        let typeLabel = "戦闘";
                        let nodeIcon = <Sword className="w-4.5 h-4.5" />;

                        if (node.type === 'shop') {
                          typeLabel = "商人";
                          nodeIcon = <ShoppingBag className="w-4.5 h-4.5" />;
                          if (isSelectable) colorClass = "border-yellow-600 text-yellow-400 bg-yellow-950/20 shadow-yellow-950/50 hover:bg-yellow-950/40 hover:scale-105 active:scale-95 glow-gold cursor-pointer";
                          else if (isCurrent) colorClass = "border-yellow-500 text-white bg-yellow-600 ring-2 ring-yellow-400";
                          else if (isCompleted) colorClass = "border-neutral-800 text-neutral-700 bg-neutral-900/70";
                        } else if (node.type === 'event') {
                          typeLabel = "イベント";
                          nodeIcon = <Shuffle className="w-4.5 h-4.5" />;
                          if (isSelectable) colorClass = "border-purple-600 text-purple-400 bg-purple-950/20 hover:bg-purple-950/45 hover:scale-105 cursor-pointer glow-blue";
                          else if (isCurrent) colorClass = "border-purple-500 text-white bg-purple-600 ring-2 ring-purple-400";
                          else if (isCompleted) colorClass = "border-neutral-800 text-neutral-700 bg-neutral-900/70";
                        } else if (node.type === 'camp') {
                          typeLabel = "キャンプ";
                          nodeIcon = <Flame className="w-4.5 h-4.5" />;
                          if (isSelectable) colorClass = "border-emerald-600 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/45 hover:scale-105 cursor-pointer glow-blue";
                          else if (isCurrent) colorClass = "border-emerald-500 text-white bg-emerald-600 ring-2 ring-emerald-400";
                          else if (isCompleted) colorClass = "border-neutral-800 text-neutral-700 bg-neutral-900/70";
                        } else if (node.type === 'elite') {
                          typeLabel = "強敵";
                          nodeIcon = <Skull className="w-4.5 h-4.5 text-red-400" />;
                          if (isSelectable) colorClass = "border-red-800 text-red-500 bg-red-950/25 hover:bg-red-950/50 hover:scale-105 cursor-pointer glow-red";
                          else if (isCurrent) colorClass = "border-red-500 text-white bg-red-800 ring-2 ring-red-400";
                          else if (isCompleted) colorClass = "border-neutral-800 text-neutral-700 bg-neutral-900/70";
                        } else if (node.type === 'boss') {
                          typeLabel = state.act === 1 ? "階層守護者 (BOSS)" : state.act === 2 ? "深淵支配者 (BOSS)" : "煉獄混沌竜 (BOSS)";
                          nodeIcon = <Crown className="w-5.5 h-5.5 text-yellow-500" />;
                          if (isSelectable) colorClass = "border-red-600 text-yellow-500 bg-neutral-900 border-2 hover:bg-neutral-850 hover:scale-105 cursor-pointer text-glow-gold glow-red shadow-lg";
                          else if (isCurrent) colorClass = "border-neutral-700 text-neutral-400 bg-neutral-800";
                          else if (isCompleted) colorClass = "border-neutral-800 text-neutral-700 bg-neutral-900/70";
                        } else {
                          // Battle normal
                          if (isSelectable) colorClass = "border-red-700 text-red-400 bg-red-950/15 hover:bg-red-950/30 hover:scale-105 cursor-pointer glow-red";
                          else if (isCurrent) colorClass = "border-red-500 text-white bg-red-600 ring-2 ring-red-400";
                          else if (isCompleted) colorClass = "border-neutral-800 text-neutral-700 bg-neutral-900/70";
                        }

                        return (
                          <div 
                            key={node.id} 
                            onClick={() => { if (isSelectable) handleSelectNode(node); }}
                            className={`flex flex-col items-center p-3 rounded-lg border w-28 text-center transition duration-200 uppercase tracking-wide px-3 py-2.5 relative select-none ${colorClass}`}
                          >
                            <div className="mb-1 text-center flex justify-center items-center">
                              {nodeIcon}
                            </div>
                            <span className="font-sans text-xs font-bold text-center leading-none tracking-normal">
                              {typeLabel}
                            </span>
                            {isSelectable && !isActFinished && (
                              <span className="absolute -top-1 bg-red-500 text-white text-[9px] font-bold px-1 rounded-sm animate-bounce tracking-tight font-mono">
                                選択可能
                              </span>
                            )}
                            {isCurrent && (
                              <span className="absolute -bottom-2 bg-yellow-500 text-neutral-950 text-[10px] font-extrabold px-1.5 rounded uppercase tracking-wider shadow-md">
                                現在地
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* --- MAIN COMBAT INTERFACE --- */}
        {state.gameStateType === 'battle' && state.enemies.length > 0 && (
          <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full p-4 gap-4 select-none">
            
            {/* SIDE BAR: GAME LOGS & GEMINI AI NARRATIONS */}
            <div className="w-full md:w-80 border border-neutral-800 rounded-xl p-4 bg-neutral-900/40 flex flex-col justify-between max-h-[600px] select-none">
              <div className="flex flex-col space-y-3 flex-1 overflow-hidden select-none">
                {/* Visual tabs to toggle between system logs and AI commentator */}
                <div className="flex bg-neutral-950 rounded p-0.5 border border-neutral-800">
                  <button 
                    onClick={() => setActiveTab('battle')}
                    className={`flex-1 text-xs py-1.5 rounded text-center transition font-semibold ${activeTab === 'battle' ? 'bg-neutral-800 text-glow-gold text-white shadow' : 'text-neutral-500'}`}
                  >
                    戦況ログ
                  </button>
                  <button 
                    onClick={() => setActiveTab('narrative')}
                    className={`flex-1 text-xs py-1.5 rounded text-center transition font-semibold flex items-center justify-center space-x-1 ${activeTab === 'narrative' ? 'bg-neutral-800 text-glow-gold text-yellow-400 shadow' : 'text-neutral-500'}`}
                  >
                    <MessageSquareCode className="w-3 h-3 text-yellow-500 animate-pulse" />
                    <span>AI実況</span>
                  </button>
                </div>

                {activeTab === 'battle' ? (
                  /* SYSTEM BATTLE LOGS */
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs leading-relaxed select-none">
                    {state.battleLog.map((log, idx) => (
                      <div key={idx} className={`p-1.5 rounded ${idx === 0 ? 'bg-neutral-800/40 text-neutral-100 border-l-2 border-red-500' : 'text-neutral-500'}`}>
                        {log}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* GEMINI GM GRAPHICS & DIALOGUE */
                  <div className="flex-1 overflow-y-auto flex flex-col space-y-3.5 pr-1 text-xs leading-relaxed select-none">
                    <div className="border border-neutral-800 bg-neutral-950/60 p-3 rounded-lg relative overflow-hidden flex flex-col justify-between min-h-32">
                      <div className="absolute top-1 right-2 inline-flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" fill="none" />
                        <span className="text-[9px] text-yellow-500 font-mono font-bold tracking-tight">Gemini 3.5</span>
                      </div>

                      <div className="space-y-2 mt-2 select-none">
                        <p className="text-[10px] text-neutral-500 font-mono tracking-wider uppercase font-semibold">ゲームマスターの囁記:</p>
                        {isAiLoading ? (
                          <p className="text-yellow-500 font-medium italic animate-pulse">（思考展開中...）</p>
                        ) : aiNarration ? (
                          <blockquote className="text-neutral-300 italic pl-2 border-l-2 border-yellow-500 font-medium text-xs leading-5">
                            「{aiNarration}」
                          </blockquote>
                        ) : (
                          <p className="text-neutral-600 italic">
                            （あなたがカードをプレイするかアクションを起こすと、Geminiによる叙情的な戦況実況がリアルタイムに語られます。）
                          </p>
                        )}
                      </div>

                      {/* Manual trigger button */}
                      <button 
                        onClick={() => fetchBattleNarration(state.battleLog[0] || '攻防継続。')}
                        disabled={isAiLoading}
                        className="mt-4 bg-neutral-900 border border-neutral-800 hover:border-yellow-600/50 hover:bg-neutral-850 py-1 rounded text-[10px] text-yellow-400 disabled:opacity-40 select-none cursor-pointer"
                      >
                        AIに実況分析をリクエストする
                      </button>
                    </div>

                    <div className="p-2 bg-neutral-900/60 rounded border border-neutral-800 text-[10px] text-neutral-500 select-none">
                      <p className="font-semibold text-neutral-400 mb-1">実況トリガー:</p>
                      ・攻撃/回復を行う<br />
                      ・戦闘の「構え」を切り替える<br />
                      ・怒気が極限を突破する
                    </div>
                  </div>
                )}
              </div>

              {/* RETREAT */}
              <button 
                onClick={() => setState(prev => ({ ...prev, gameStateType: 'map', activeBattleNodeId: null }))}
                className="mt-3 text-neutral-500 hover:text-red-400 text-xs transition p-2 text-center border border-neutral-800 hover:border-red-950 rounded select-none cursor-pointer"
              >
                逃走してマップへ戻る
              </button>
            </div>

            {/* COMBAT FIELD: CARD FIGHTERS SPACE */}
            <div className="flex-1 border border-neutral-800 rounded-xl p-6 bg-neutral-900/25 flex flex-col justify-between relative overflow-hidden select-none">
              
              {/* STANCE INDICATORS HUD BAR */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-neutral-800 pb-4 mb-4 select-none">
                <div className="flex items-center space-x-3 select-none">
                  <div className="text-neutral-400 text-xs text-left">
                    <p className="text-[10px] uppercase font-mono tracking-wider font-semibold text-neutral-500">現在の戦闘姿勢 (Stance)</p>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <span className={`px-2 py-0.5 border rounded-full text-xs font-bold leading-normal ${getStanceInfo(state.stance).color}`}>
                        {getStanceInfo(state.stance).label}
                      </span>
                      <span className="text-neutral-400 text-[11px] font-sans">
                        {getStanceInfo(state.stance).desc}
                      </span>
                    </div>
                  </div>
                </div>

                {/* FURY Flame BAR */}
                <div className="mt-3 md:mt-0 flex items-center space-x-3 bg-neutral-950 p-2 border border-neutral-800 rounded-lg select-none">
                  <div className="text-right">
                    <span className="text-[9px] font-mono tracking-wider text-neutral-500 uppercase font-semibold block">怒気蓄積 (Fury Pool)</span>
                    <span className={`font-mono text-xs font-black ${state.fury >= 50 ? 'text-red-500 animate-pulse mr-1 font-extrabold text-sm' : 'text-neutral-400'}`}>
                      {state.fury >= 50 ? '★ FRENZY X2 DAMAGE!' : `${state.fury}/100`}
                    </span>
                  </div>
                  <div className="w-24 bg-neutral-900 rounded-full h-3 overflow-hidden border border-neutral-800 relative">
                    <div 
                      className={`h-full transition-all duration-300 ${state.fury >= 50 ? 'bg-gradient-to-r from-red-600 to-yellow-500 animate-pulse' : 'bg-red-500'}`}
                      style={{ width: `${state.fury}%` }} 
                    />
                  </div>
                </div>
              </div>

              {/* ADVERSARIES SHOWDOWN: USER VS MONSTER */}
              <div className="flex-1 flex flex-col md:flex-row items-center justify-around py-8 select-none">
                
                {/* 1. PLAYER HERO GRAPHIC CARD */}
                <div className={`flex flex-col items-center transition relative ${shakeTargetId === 'player' ? 'animate-shake' : ''}`}>
                  <span className="text-xs text-neutral-500 font-mono font-bold tracking-tight mb-1">【あなた】先陣の勇士</span>
                  <div className={`w-32 h-32 rounded-2xl bg-neutral-950 border-2 flex flex-col justify-center items-center relative transition shadow-2xl ${state.stance === 'assault' ? 'border-red-600 glow-red' : state.stance === 'defensive' ? 'border-blue-600 glow-blue' : 'border-neutral-700'}`}>
                    <Sword className={`w-12 h-12 ${state.stance === 'assault' ? 'text-red-500' : state.stance === 'defensive' ? 'text-blue-400' : 'text-neutral-400'}`} />
                    
                    {/* Floating current Block protection overlay */}
                    {state.block > 0 && (
                      <div className="absolute -bottom-3 bg-blue-600/95 ring-2 ring-blue-400 text-white rounded px-2 py-0.5 text-xs font-mono font-bold shadow flex items-center space-x-1">
                        <Shield className="w-3.5 h-3.5" />
                        <span>{state.block}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-col items-center select-none">
                    <span className="font-mono text-sm text-neutral-300 font-bold">HP {state.hp}/{state.maxHp}</span>
                    
                    {/* Active buffs list */}
                    <div className="flex space-x-1.5 mt-2">
                      {state.strength > 0 && (
                        <span className="bg-orange-950/45 border border-orange-500/35 text-orange-400 text-[10px] font-bold px-1.5 rounded flex items-center">
                          <TrendingUp className="w-3 h-3 mr-0.5" /> 筋力:{state.strength}
                        </span>
                      )}
                      {state.vulnerable > 0 && (
                        <span className="bg-red-950/45 border border-red-500/35 text-red-400 text-[10px] font-bold px-1.5 rounded">脆弱:{state.vulnerable}t</span>
                      )}
                      {state.weak > 0 && (
                        <span className="bg-indigo-950/45 border border-indigo-500/35 text-indigo-400 text-[10px] font-bold px-1.5 rounded">脱力:{state.weak}t</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* VS BAR LINE */}
                <div className="font-mono text-neutral-700 text-xl font-bold select-none py-4 md:py-0">VS</div>

                {/* 2. ENEMY DUNGEON CRITTER GRAPHIC */}
                {state.enemies.map(en => {
                  return (
                    <div key={en.id} className={`flex flex-col items-center transition relative ${shakeTargetId === en.id ? 'animate-shake' : ''}`}>
                      {/* INTENT INDICATOR BUDGET PREVIEW BUBBLE */}
                      <div className="absolute -top-12 z-10 bg-neutral-900 border border-neutral-700 rounded-lg p-2 flex items-center space-x-1.5 text-xs text-neutral-200">
                        <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full block animate-ping mr-1" />
                        <span className="text-xs font-sans text-neutral-300 leading-tight">
                          予測: <span className="text-white font-bold">{en.intent.description}</span>
                        </span>
                      </div>

                      <span className="text-xs text-neutral-500 font-mono font-bold tracking-tight mb-1">敵ユニット</span>
                      <div className="w-32 h-32 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col justify-center items-center shadow-2xl relative">
                        {en.visualType === 'dragon' ? (
                          <div className="w-24 h-24 rounded-full bg-red-950/45 outline outline-red-900 flex justify-center items-center"><Crown className="w-14 h-14 text-yellow-500 animate-bounce" /></div>
                        ) : en.visualType === 'slime' ? (
                          <Orbit className="w-12 h-12 text-emerald-400" />
                        ) : en.visualType === 'golem' ? (
                          <Shield className="w-12 h-12 text-teal-400 animate-pulse" />
                        ) : en.visualType === 'skeleton' ? (
                          <Skull className="w-12 h-12 text-orange-400" />
                        ) : (
                          <Award className="w-12 h-12 text-purple-400" />
                        )}

                        {/* Enemy Shield Block */}
                        {en.block > 0 && (
                          <div className="absolute -bottom-3 bg-teal-600 ring-2 ring-teal-400 text-white rounded px-2 py-0.5 text-xs font-mono font-bold shadow flex items-center space-x-1">
                            <Shield className="w-3.5 h-3.5" />
                            <span>{en.block}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-col items-center text-center select-none">
                        <span className="font-sans text-xs text-white font-bold block mb-1">{en.name}</span>
                        <div className="w-32 bg-neutral-800 rounded-full h-2 overflow-hidden mb-1">
                          <div className="bg-red-600 h-full transition-all duration-300" style={{ width: `${(en.hp / en.maxHp) * 100}%` }} />
                        </div>
                        <span className="font-mono text-xs text-red-400 font-medium">{en.hp}/{en.maxHp} HP</span>

                        {/* Status elements */}
                        <div className="flex space-x-1 mt-2">
                          {en.strength > 0 && (
                            <span className="bg-neutral-800 border border-neutral-700 text-orange-400 text-[9px] px-1 rounded font-mono">筋力:{en.strength}</span>
                          )}
                          {en.vulnerable > 0 && (
                            <span className="bg-red-950/50 border border-red-500/25 text-red-400 text-[9px] px-1 rounded font-mono">脆弱:{en.vulnerable}t</span>
                          )}
                          {en.weak > 0 && (
                            <span className="bg-indigo-950/50 border border-indigo-500/25 text-indigo-400 text-[9px] px-1 rounded font-mono">脱力:{en.weak}t</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CARD DECK BOARD ACTION ZONE PER TURNS */}
              <div className="border-t border-neutral-800 pt-6 flex flex-col select-none">
                <div className="flex justify-between items-center mb-4 text-xs font-mono select-none">
                  {/* Energy display */}
                  <div className="flex items-center space-x-2">
                    <span className="text-neutral-400 text-[10px] uppercase font-mono tracking-wider font-semibold">使用可能魔気 (Energy):</span>
                    <div className="bg-neutral-950 border border-neutral-700 px-3 py-1.5 rounded-full flex items-center space-x-1.5 text-yellow-400 font-bold font-mono">
                      <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500 animate-pulse" />
                      <span className="text-sm font-black">{state.energy} / {state.maxEnergy}</span>
                    </div>
                  </div>

                  {/* Draw and Discard numbers */}
                  <div className="flex space-x-4 text-neutral-500 text-xs">
                    <span>山札 (Draw): <strong className="text-neutral-300 font-bold">{state.drawPile.length}</strong></span>
                    <span>捨札 (Discard): <strong className="text-neutral-300 font-bold">{state.discard.length}</strong></span>
                  </div>

                  <button 
                    onClick={handleEndTurn}
                    className="bg-neutral-800 hover:bg-neutral-700/80 hover:scale-103 text-white border border-neutral-700 active:scale-95 transition px-5 py-2 rounded-lg font-sans font-bold text-xs shadow-md cursor-pointer uppercase tracking-wider"
                  >
                    ターン終了 (End Turn)
                  </button>
                </div>

                {/* VISUAL CARDS HAND CONTAINER */}
                <div className="flex justify-center items-center flex-wrap gap-4 select-none">
                  {state.hand.map((card, idx) => {
                    const canAfford = state.energy >= card.cost;
                    // Frenzy glow for attacks if Fury >= 50
                    const isFrenzyGlow = state.fury >= 50 && card.type === 'attack';
                    
                    let cardBorder = "border-neutral-800";
                    let cardHeaderStyle = "bg-neutral-900 border-b border-neutral-800 text-neutral-400";
                    if (card.type === 'attack') {
                      cardBorder = "border-red-950 hover:border-red-800";
                      cardHeaderStyle = "bg-red-950/20 text-red-400";
                    } else if (card.type === 'defense') {
                      cardBorder = "border-blue-950 hover:border-blue-800";
                      cardHeaderStyle = "bg-blue-950/20 text-blue-400";
                    } else if (card.type === 'skill') {
                      cardBorder = "border-purple-950 hover:border-purple-850";
                      cardHeaderStyle = "bg-purple-950/20 text-purple-400";
                    }

                    return (
                      <div 
                        key={card.id}
                        onClick={() => {
                          if (canAfford) {
                            // Automatically target enemy 0 for simple battles
                            const targetId = state.enemies[0]?.id;
                            if (targetId) handlePlayCard(card, targetId);
                          }
                        }}
                        style={{ animationDelay: `${idx * 0.05}s` }}
                        className={`w-40 h-56 bg-neutral-950 border rounded-xl flex flex-col justify-between overflow-hidden shadow-xl animate-draw select-none transition-all duration-250 cursor-pointer ${cardBorder} ${canAfford ? 'hover:-translate-y-4 hover:shadow-2xl' : 'opacity-40 hover:translate-y-0 cursor-not-allowed'} ${isFrenzyGlow ? 'glow-red ring-2 ring-red-500 animate-pulse' : ''}`}
                      >
                        {/* Cost & Title Header */}
                        <div className={`px-2.5 py-1.5 flex justify-between items-center uppercase ${cardHeaderStyle}`}>
                          <span className="font-mono text-sm font-bold text-white bg-neutral-950 border border-neutral-800 w-5.5 h-5.5 rounded-full flex items-center justify-center">
                            {card.cost}
                          </span>
                          <span className="text-[10px] uppercase font-mono font-extrabold tracking-tight">
                            {card.type === 'attack' ? '攻撃' : card.type === 'defense' ? '防御' : 'スキル'}
                          </span>
                        </div>

                        {/* Card Graphic/Symbol Placeholders */}
                        <div className="flex-1 p-3 flex flex-col justify-between items-center select-none text-center">
                          <div className="mb-1 text-center">
                            {card.type === 'attack' ? (
                              <Sword className={`w-6 h-6 mx-auto ${isFrenzyGlow ? 'text-red-500 animate-bounce' : 'text-red-600'}`} />
                            ) : card.type === 'defense' ? (
                              <Shield className="w-6 h-6 text-blue-500 mx-auto" />
                            ) : (
                              <Zap className="w-6 h-6 text-purple-500 mx-auto" />
                            )}
                          </div>
                          
                          <span className="font-sans text-xs font-extrabold text-white leading-normal leading-none my-1 tracking-normal">
                            {card.name}
                          </span>
                          
                          <p className="text-[10px] text-neutral-400 leading-normal font-sans">
                            {card.description}
                          </p>
                        </div>

                        {/* Cost visual feedback */}
                        <div className="bg-neutral-900 border-t border-neutral-800 text-[10px] font-mono text-center py-1 text-neutral-500 select-none">
                          {canAfford ? 'クリックで発動' : '魔気不足'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- DRAFT CARD REWARD DOCK AFTER VICTORIES --- */}
        {rewardCards.length > 0 && (
          <div className="fixed inset-0 bg-neutral-950/90 flex flex-col items-center justify-center p-4 z-50 select-none">
            <span className="absolute top-[20%] left-[50%] -translate-x-[50%] w-96 h-96 bg-red-950/25 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="text-center space-y-2 mb-8 z-10">
              <span className="text-yellow-500 text-xs font-semibold tracking-widest uppercase border border-yellow-500/25 px-3 py-1 rounded bg-yellow-950/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 mr-1 text-yellow-500 animate-spin" /> Battle Winner Rewards!
              </span>
              <h2 className="text-3xl font-sans font-extrabold text-white">デッキに編入するカードを選択せよ</h2>
              <p className="text-neutral-400 max-w-sm mx-auto text-xs">
                以下の3枚のうち、あなたの戦闘スタンスに最もフィットする1枚を選んでデッキを強化してください。パスも可能です。
              </p>
            </div>

            <div className="flex gap-6 mb-8 select-none z-10 flex-wrap justify-center">
              {rewardCards.map(card => {
                let cardColor = "border-neutral-800 hover:border-yellow-600";
                if (card.type === 'attack') cardColor = "border-red-900 hover:border-red-500 hover:glow-red";
                else if (card.type === 'defense') cardColor = "border-blue-900 hover:border-blue-500 hover:glow-blue";
                else if (card.type === 'skill') cardColor = "border-purple-900 hover:border-purple-500 hover:glow-blue";

                return (
                  <div 
                    key={card.id}
                    onClick={() => selectRewardCard(card)}
                    className={`w-44 h-64 bg-neutral-900 border rounded-xl flex flex-col justify-between overflow-hidden shadow-2xl scale-105 hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer p-0.5 ${cardColor}`}
                  >
                    <div className="px-3 py-2 bg-neutral-950 flex justify-between items-center">
                      <span className="font-mono text-xs font-bold text-white bg-neutral-900 border border-neutral-800 w-5 h-5 rounded-full flex items-center justify-center">
                        {card.cost}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider font-mono text-neutral-400">
                        {card.rarity === 'rare' ? '【RARE】' : card.rarity === 'uncommon' ? '【UNCOMMON】' : '【COMMON】'}
                      </span>
                    </div>

                    <div className="flex-1 p-3 flex flex-col justify-between items-center text-center">
                      <div className="mb-2">
                        {card.type === 'attack' ? <Sword className="w-8 h-8 text-red-500 mx-auto" /> : card.type === 'defense' ? <Shield className="w-8 h-8 text-blue-500 mx-auto" /> : <Zap className="w-8 h-8 text-purple-500 mx-auto" />}
                      </div>
                      <h4 className="font-sans font-bold text-white text-sm my-1">{card.name}</h4>
                      <p className="text-[10px] text-neutral-400 leading-relaxed font-sans">{card.description}</p>
                    </div>

                    <div className="bg-neutral-950 font-mono text-[10px] text-zinc-500 text-center py-2 border-t border-neutral-800">
                      編入を決定する
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              onClick={skipRewardCard}
              className="text-neutral-500 hover:text-white border border-neutral-800 hover:border-neutral-600 px-6 py-2 rounded-lg text-xs font-sans transition z-10 cursor-pointer"
            >
              カードを獲得せずにパスする (Decline Reward)
            </button>
          </div>
        )}

        {/* --- NARRATIVE EVENTS SCREEN --- */}
        {state.gameStateType === 'event' && state.currentEvent && (
          <div className="flex-1 flex justify-center items-center p-4 select-none relative max-w-4xl mx-auto w-full">
            <div className="absolute top-[30%] right-[30%] w-96 h-96 bg-purple-950/20 rounded-full blur-[100px] pointer-events-none" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border border-neutral-800 p-8 rounded-2xl bg-neutral-900/65 shadow-2xl relative overflow-hidden select-none">
              
              {/* Event story illustrations representation */}
              <div className="flex flex-col justify-between border-b md:border-b-0 md:border-r border-neutral-800 pb-6 md:pb-0 md:pr-8">
                <div className="space-y-4">
                  <span className="text-purple-400 text-xs font-semibold tracking-wider uppercase border border-purple-800/35 px-2.5 py-1 rounded bg-purple-950/20 inline-block">
                    運命の転換イベント
                  </span>
                  <h3 className="text-2xl font-sans font-extrabold text-white leading-tight uppercase">
                    {state.currentEvent.title}
                  </h3>
                  <p className="text-zinc-300 text-xs leading-6 font-sans">
                    {state.currentEvent.description}
                  </p>
                </div>

                <div className="border border-neutral-800 bg-neutral-950 p-4 rounded-lg mt-6 relative overflow-hidden">
                  <p className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider font-semibold mb-1">儀式・代償ナレーション:</p>
                  {isAiLoading ? (
                    <p className="text-purple-400 font-medium italic animate-pulse">（ゲームマスターが代償の結末を編集中...）</p>
                  ) : aiNarration ? (
                    <p className="text-zinc-300 italic text-xs leading-relaxed font-semibold">
                      「{aiNarration}」
                    </p>
                  ) : (
                    <p className="text-zinc-600 italic text-xs">
                      {state.currentEvent.dialogueText}
                    </p>
                  )}
                </div>
              </div>

              {/* Event outcome options list */}
              <div className="flex flex-col justify-center space-y-4">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold mb-2">選択可能な理:</span>
                
                {state.eventOutcome ? (
                  <div className="space-y-4 text-center p-4 border border-emerald-900 bg-emerald-950/15 rounded-xl">
                    <Check className="w-8 h-8 text-emerald-400 mx-auto animate-bounce" />
                    <p className="text-zinc-300 text-xs leading-6">{state.eventOutcome}</p>
                    <button 
                      onClick={closeCompletedEvent}
                      className="bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 font-sans font-bold text-xs text-white px-6 py-2.5 rounded shadow-lg transition select-none cursor-pointer"
                    >
                      結果を受け入れて冒険を再開する
                    </button>
                  </div>
                ) : (
                  state.currentEvent.options.map((opt, oIdx) => (
                    <button 
                      key={oIdx}
                      onClick={() => conductEventOption(opt)}
                      className="text-left w-full border border-neutral-800 hover:border-purple-600 hover:bg-purple-950/10 active:border-purple-500 transition-all p-4 rounded-xl flex flex-col justify-between align-start text-xs select-none cursor-pointer"
                    >
                      <span className="font-bold text-white text-xs mb-1.5 leading-normal">{opt.text}</span>
                      <span className="text-purple-400 block text-[10px] uppercase tracking-normal">決定時の効果</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- MERCHANT UPGRADE SHOP SCREEN --- */}
        {state.gameStateType === 'shop' && (
          <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 py-8 select-none">
            
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-neutral-800 pb-4">
              <div>
                <h2 className="text-2xl font-sans font-extrabold text-white tracking-wide uppercase flex items-center mb-1">
                  <ShoppingBag className="w-6 h-6 mr-1.5 text-yellow-500" />
                  邪教の闇市 (Black Merchant)
                </h2>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  道中で集めたゴールドを支払い、強力なスペルカードの獲得、初期カードの強化、または不要なカードの破棄、レリックの獲得が可能です。
                </p>
              </div>

              {/* Dynamic shop stats */}
              <div className="mt-3 md:mt-0 flex gap-4 text-xs font-mono">
                {(() => {
                  let discount = 1.0;
                  if (state.relics.some(r => r.id === 'golden_coin')) discount -= 0.15;
                  if (state.relics.some(r => r.id === 'vanguard_insignia')) discount -= 0.10;
                  const upgradeCost = Math.round(50 * discount);
                  const removeCost = Math.round(60 * discount);
                  return (
                    <>
                      <span className="bg-neutral-900 border border-neutral-850 px-3 py-1.5 rounded text-neutral-300">初期費用：カード強化 <strong className="text-yellow-400">{upgradeCost}G</strong></span>
                      <span className="bg-neutral-900 border border-neutral-850 px-3 py-1.5 rounded text-neutral-300">初期費用：カード削除 <strong className="text-yellow-400">{removeCost}G</strong></span>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 select-none">
              {/* PANEL 1: CARDS FOR SALES */}
              <div className="border border-neutral-800 rounded-xl p-5 bg-neutral-900/15 flex flex-col">
                <h3 className="text-sm font-sans font-black text-white uppercase tracking-wider mb-4 border-b border-neutral-800 pb-2 flex items-center">
                  <Sparkles className="w-4 h-4 mr-1 text-yellow-500" />
                  カード売り場
                </h3>
                
                {/* 3 statically priced selectables cards with discount support */}
                <div className="space-y-4 flex-1">
                  {(() => {
                    let discount = 1.0;
                    if (state.relics.some(r => r.id === 'golden_coin')) discount -= 0.15;
                    if (state.relics.some(r => r.id === 'vanguard_insignia')) discount -= 0.10;
                    const cardList = [
                      { template: CARD_TEMPLATES.find(c => c.originalId === 'heavy_blow') || CARD_TEMPLATES[1], basePrice: 70 },
                      { template: CARD_TEMPLATES.find(c => c.originalId === 'shield_slam') || CARD_TEMPLATES[4], basePrice: 85 },
                      { template: CARD_TEMPLATES.find(c => c.originalId === 'cleave') || CARD_TEMPLATES[18] || CARD_TEMPLATES[10] || CARD_TEMPLATES[2], basePrice: 60 }
                    ];

                    return cardList.map((item, idx) => {
                      const temp = item.template || CARD_TEMPLATES[2];
                      const price = Math.round(item.basePrice * discount);
                      const unafford = state.gold < price;
                      const alreadyOwned = state.deck.some(d => d.originalId === temp.originalId);

                      return (
                        <div 
                          key={idx} 
                          onClick={() => {
                            if (alreadyOwned) {
                              setSelectedShopCard(null);
                              setSelectedShopCardPrice(0);
                            } else {
                              setSelectedShopCard(temp as Card);
                              setSelectedShopCardPrice(price);
                            }
                          }}
                          className={`p-3 border border-neutral-800 hover:border-yellow-600 rounded-lg bg-neutral-950/70 transition flex items-center justify-between cursor-pointer ${unafford && !alreadyOwned ? 'opacity-55' : ''} ${alreadyOwned ? 'border-neutral-800 bg-neutral-900/50 opacity-50' : ''}`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="bg-yellow-950/30 border border-yellow-800/40 text-yellow-500 font-mono text-[10px] w-6 h-6 rounded-full flex items-center justify-center font-bold">
                              {temp.cost}
                            </span>
                            <div>
                              <span className="font-bold text-white text-xs block">{temp.name}</span>
                              <span className="text-[9px] text-neutral-500 uppercase tracking-tight">{temp.type === 'attack' ? '攻撃' : '防御・スキル'}</span>
                            </div>
                          </div>
                          {alreadyOwned ? (
                            <span className="text-[9px] bg-neutral-800 text-zinc-500 border border-neutral-700 font-bold px-1.5 py-0.5 rounded-sm uppercase">所持済</span>
                          ) : (
                            <span className="font-mono text-xs font-semibold text-yellow-400">{price} G</span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Selected shop card detailed display block */}
                {selectedShopCard && (
                  <div className="mt-4 p-4 border border-yellow-800/45 bg-yellow-950/20 rounded-lg animate-fadeIn">
                    <span className="font-bold text-white text-xs block mb-1">{selectedShopCard.name}</span>
                    <p className="text-[10px] text-neutral-400 leading-relaxed mb-3">{selectedShopCard.description}</p>
                    <button 
                      onClick={() => purchaseCard(selectedShopCard, selectedShopCardPrice)}
                      disabled={state.gold < selectedShopCardPrice}
                      className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 font-sans font-bold text-xs py-1.5 rounded select-none cursor-pointer uppercase transition-colors"
                    >
                      購入を決定 (費: {selectedShopCardPrice}G)
                    </button>
                  </div>
                )}
              </div>

              {/* PANEL 2: RELICS/PASSIVES */}
              <div className="border border-neutral-800 rounded-xl p-5 bg-neutral-900/15 flex flex-col">
                <h3 className="text-sm font-sans font-black text-white uppercase tracking-wider mb-4 border-b border-neutral-800 pb-2 flex items-center">
                  <Award className="w-4 h-4 mr-1 text-yellow-500 animate-pulse" />
                  極上遺品 (Relics)
                </h3>
                
                <div className="space-y-4 flex-1">
                  {(() => {
                    // Filter out already owned relics (excluding initial blood_ember)
                    const availableRelics = RELIC_LIST.filter(r => r.id !== 'blood_ember' && !state.relics.some(ur => ur.id === r.id));
                    const displayRelics = availableRelics.slice(0, 3);
                    let discount = 1.0;
                    if (state.relics.some(r => r.id === 'golden_coin')) discount -= 0.15;
                    if (state.relics.some(r => r.id === 'vanguard_insignia')) discount -= 0.10;

                    if (displayRelics.length === 0) {
                      return (
                        <div className="text-center py-12 text-neutral-500 text-xs border border-dashed border-neutral-800 rounded-lg p-4 bg-neutral-950/20">
                          すべてのレリックを獲得済みです！
                        </div>
                      );
                    }

                    return displayRelics.map(relic => {
                      const basePrice = relic.price || 120;
                      const price = Math.round(basePrice * discount);
                      const unafford = state.gold < price;

                      return (
                        <div 
                          key={relic.id}
                          className={`p-3 border border-neutral-800 rounded-lg bg-neutral-950/70 transition flex flex-col justify-between ${unafford ? 'opacity-60' : ''}`}
                        >
                          <div className="flex justify-between items-start mb-1.5">
                            <div>
                              <span className="font-bold text-white text-xs block">{relic.name}</span>
                              <p className="text-[10px] text-neutral-400 leading-normal mt-0.5 font-sans">{relic.description}</p>
                            </div>
                            <span className="font-mono text-xs font-semibold text-yellow-400">{price} G</span>
                          </div>
                          <button 
                            onClick={() => purchaseRelic(relic, price)}
                            disabled={unafford}
                            className="mt-2 w-full bg-neutral-900 hover:border-yellow-600 hover:bg-neutral-850/85 text-xs text-yellow-400 border border-neutral-800 py-1 rounded select-none disabled:opacity-40 cursor-pointer transition-colors"
                          >
                            遺品を発現
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* PANEL 3: CARD MAINTENANCE (UPGRADES & DELETIONS) */}
              <div className="border border-neutral-800 rounded-xl p-5 bg-neutral-900/15 flex flex-col">
                <h3 className="text-sm font-sans font-black text-white uppercase tracking-wider mb-4 border-b border-neutral-800 pb-2 flex items-center">
                  <ShieldAlert className="w-4 h-4 mr-1 text-yellow-500" />
                  デッキ強化・不要処理
                </h3>

                <div className="space-y-4 flex-1 select-none">
                  {/* Select card in deck to upgrade */}
                  {(() => {
                    let discount = 1.0;
                    if (state.relics.some(r => r.id === 'golden_coin')) discount -= 0.15;
                    if (state.relics.some(r => r.id === 'vanguard_insignia')) discount -= 0.10;
                    const upgradeCost = Math.round(50 * discount);
                    const removeCost = Math.round(60 * discount);

                    return (
                      <>
                        <div>
                          <label className="text-[10px] font-mono uppercase text-neutral-500 font-bold block mb-1">カード強化 (強化コスト: {upgradeCost}G):</label>
                          <select 
                            onChange={(e) => {
                              const targetCardId = e.target.value;
                              const card = state.deck.find(c => c.id === targetCardId);
                              setSelectedUpgradeCard(card || null);
                            }}
                            className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs rounded text-neutral-300 focus:outline-none focus:border-yellow-600"
                          >
                            <option value="">-- 対象カードを選ぶ --</option>
                            {state.deck.filter(c => !c.isUpgraded).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>

                          {selectedUpgradeCard && (
                            <div className="mt-3 p-3 border border-yellow-850/35 bg-yellow-950/10 rounded-lg text-xs">
                              <p className="text-[10px] text-zinc-500 font-mono mb-1">プレビュー:</p>
                              <p className="text-white font-bold leading-normal">{selectedUpgradeCard.name} → <span className="text-yellow-400 font-black">{selectedUpgradeCard.name}+</span></p>
                              <p className="text-[10px] text-neutral-400 leading-relaxed mt-1">※基礎攻撃・防御力が3点直接加算されます。</p>
                              <button 
                                onClick={() => upgradeCardInDeck(selectedUpgradeCard.id, upgradeCost)}
                                disabled={state.gold < upgradeCost}
                                className="mt-3 w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-neutral-950 font-sans font-bold text-xs py-1.5 rounded select-none cursor-pointer uppercase transition-colors"
                              >
                                強化を執行
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Card removals service */}
                        <div className="pt-4 border-t border-neutral-800/80">
                          <label className="text-[10px] font-mono uppercase text-neutral-500 font-bold block mb-1">不要なカードを永久削除 ({removeCost}G):</label>
                          <p className="text-[9px] text-zinc-500 mb-2 font-sans">※デッキ内のスターター攻撃（ストライク）や呪いを消し、デッキ比率を洗練化します。</p>
                          <div className="max-h-36 overflow-y-auto space-y-1.5 border border-neutral-800 bg-neutral-950/40 p-2.5 rounded-lg select-none">
                            {state.deck.map(c => (
                              <div key={c.id} className="flex justify-between items-center text-xs py-0.5 border-b border-neutral-900/60 last:border-0">
                                <span className="text-zinc-200">{c.name}</span>
                                <button 
                                  onClick={() => removeCardInDeck(c.id, removeCost)}
                                  disabled={state.gold < removeCost}
                                  className="text-[9px] bg-neutral-900 border border-neutral-850 hover:border-red-900 disabled:opacity-30 disabled:hover:border-neutral-850 text-red-400 px-2 py-0.5 rounded select-none transition cursor-pointer"
                                >
                                  削除
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* RETURN TO MAP */}
                <button 
                  onClick={() => setState(prev => ({ ...prev, gameStateType: 'map' }))}
                  className="mt-4 bg-neutral-800 hover:bg-neutral-700/80 text-white font-sans font-bold text-xs py-2 rounded-lg transition text-glow-gold select-none cursor-pointer uppercase border border-neutral-700"
                >
                  冒険を再開する (マップへ戻る)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- CAMP (REST SITE) VIEW --- */}
        {state.gameStateType === 'camp' && (
          <div className="flex-1 flex justify-center items-center p-4 select-none relative max-w-4xl mx-auto w-full">
            <div className="absolute top-[30%] left-[30%] w-96 h-96 bg-emerald-950/15 rounded-full blur-[100px] pointer-events-none" />

            <div className="border border-neutral-850 p-8 rounded-2xl bg-neutral-900/75 shadow-2xl relative overflow-hidden flex flex-col justify-between text-center select-none w-full max-w-2xl">
              <span className="text-emerald-400 text-xs font-semibold tracking-wider uppercase border border-emerald-800/35 px-2.5 py-1 rounded bg-emerald-950/20 inline-block mx-auto mb-4">
                聖なる焚き火 (Sacred Campfire)
              </span>
              
              <h3 className="text-3xl font-sans font-extrabold text-white leading-tight uppercase mb-2">
                ひとときの平穏
              </h3>
              <p className="text-neutral-400 max-w-md mx-auto text-xs leading-relaxed mb-8 font-sans">
                安全が確保されたキャンプ場に到着しました。焚き火のそばで英気を養い、傷口を閉じるか、お気に入りの武器を研ぐことができます。
              </p>

              {/* REST site active selections layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-lg mx-auto w-full mb-6 z-10">
                <button 
                  onClick={() => handleCampOption('rest')}
                  className="border border-neutral-800 hover:border-emerald-500 hover:bg-emerald-950/10 transition-all p-6 rounded-xl flex flex-col items-center justify-center text-center select-none cursor-pointer"
                >
                  <Heart className="w-10 h-10 text-emerald-500 mb-2.5 animate-pulse" />
                  <span className="font-bold text-white text-sm mb-1">休息を取る (REST)</span>
                  <p className="text-[10px] text-neutral-400 font-sans leading-normal">
                    最大HPの30% ({Math.floor(state.maxHp * 0.3)} HP) を安全に回復する
                  </p>
                </button>

                <div className="border border-neutral-800 p-6 rounded-xl flex flex-col justify-between align-center items-center text-center bg-neutral-950/30">
                  <Flame className="w-10 h-10 text-orange-500 mb-2.5" />
                  <span className="font-bold text-white text-sm mb-1.5">カード研磨 (FORGE)</span>
                  <p className="text-[10px] text-neutral-400 font-sans leading-normal mb-3">
                    所持している未強化カード1枚を、+強化版へ昇格させる。
                  </p>
                  
                  {/* Upgrade selection inside camp */}
                  <select 
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id) {
                        handleCampOption('forge', id);
                      }
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs rounded text-neutral-300 focus:outline-none focus:border-yellow-600"
                  >
                    <option value="">-- 強化するカードを選ぶ --</option>
                    {state.deck.filter(c => !c.isUpgraded).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-zinc-500 text-[10px] italic leading-normal">
                安全を確保し、次の部屋の敵に全力で挑みましょう。
              </div>
            </div>
          </div>
        )}

        {/* --- SUMMARY GAMEOVER & VICTORY PAGE --- */}
        {(state.gameStateType === 'gameover' || state.gameStateType === 'victory') && (
          <div className="flex-1 flex flex-col justify-center items-center py-20 px-4 select-none relative max-w-4xl mx-auto w-full">
            <span className="absolute top-[25%] left-[50%] -translate-x-[50%] w-96 h-96 bg-red-950/25 rounded-full blur-[100px] pointer-events-none" />

            <div className="text-center space-y-4 mb-8 z-10">
              {state.gameStateType === 'gameover' ? (
                <>
                  <Skull className="w-20 h-20 text-red-600 mx-auto animate-bounce glow-red" />
                  <h1 className="text-5xl font-sans font-black text-red-500 uppercase tracking-wider drop-shadow-lg">
                    戦士の敗北 (You Died)
                  </h1>
                  <p className="text-neutral-400 max-w-md mx-auto text-sm">
                    あなたの闘志（Fury）は尽き、力尽き果てました。しかし、得られた教訓が次の周回での強固な守りへと繋がるでしょう。
                  </p>
                </>
              ) : (
                <>
                  <Crown className="w-20 h-20 text-yellow-500 mx-auto animate-bounce text-glow-gold" />
                  <h1 className="text-5xl font-sans font-black text-yellow-400 uppercase tracking-widest drop-shadow-lg">
                    大いなる完全勝利
                  </h1>
                  <p className="text-neutral-400 max-w-md mx-auto text-sm">
                    おめでとうございます！煉獄の混沌竜を見事に屠り、呪われし最深部マップをすべて制覇、ヴァンガードの伝説を築き上げました。
                  </p>
                </>
              )}
            </div>

            {/* Run summary statistics panels */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-2xl w-full mb-8 z-10 text-center font-mono text-xs">
              <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
                <span className="text-neutral-500 uppercase block mb-1">達成階層</span>
                <strong className="text-2xl text-white font-extrabold">{Math.min(12, state.mapNodes.filter(n => n.isCompleted).length + 1)} / 12</strong>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
                <span className="text-neutral-500 uppercase block mb-1">所持ゴールド</span>
                <strong className="text-2xl text-yellow-400 font-extrabold">{state.gold} G</strong>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
                <span className="text-neutral-500 uppercase block mb-1">最終HP / MAX</span>
                <strong className="text-2xl text-red-400 font-extrabold">{state.hp} / {state.maxHp}</strong>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
                <span className="text-neutral-500 uppercase block mb-1">デッキサイズ</span>
                <strong className="text-2xl text-blue-400 font-extrabold">{state.deck.length} 枚</strong>
              </div>
            </div>

            {/* Deck view log Summary */}
            <div className="bg-neutral-900/60 border border-neutral-850 p-5 rounded-xl max-w-xl w-full mb-8 z-10">
              <h4 className="font-sans font-bold text-white text-xs mb-3 border-b border-neutral-800 pb-1.5 flex items-center justify-between">
                <span>最終デッキ構成 (Deck Composition):</span>
                <span className="text-neutral-400 font-mono text-[10px]">{state.deck.length} cards total</span>
              </h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {state.deck.map((c, i) => (
                  <span key={i} className={`px-2.5 py-1 border rounded-lg ${c.type === 'attack' ? 'border-red-950/60 bg-red-950/20 text-red-300' : c.type === 'defense' ? 'border-blue-950/60 bg-blue-950/20 text-blue-300' : 'border-purple-950/60 bg-purple-950/20 text-purple-300'}`}>
                    {c.name}
                  </span>
                ))}
              </div>
            </div>

            <button 
              onClick={handleRestart}
              className="bg-red-600 hover:bg-red-500 hover:scale-105 active:bg-red-700 transition duration-200 border-2 border-red-500 rounded-lg px-8 py-3.5 font-bold font-sans text-white text-md shadow-xl tracking-wider inline-flex items-center cursor-pointer uppercase z-10"
            >
              新しい周回を始める (Rogue Restart)
              <RotateCcw className="w-4 h-4 ml-2 text-white animate-spin" />
            </button>
          </div>
        )}
      </main>

      {/* --- POPUP MODAL: DECK VIEWER INTERACTIVE --- */}
      {isDeckViewerOpen && (
        <div className="fixed inset-0 bg-neutral-950/95 flex flex-col justify-center items-center p-6 z-50 select-none">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col justify-between overflow-hidden relative select-none">
            
            {/* Close */}
            <button 
              onClick={() => setIsDeckViewerOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white transition cursor-pointer p-1"
            >
              <X className="w-6 h-6 border border-neutral-700 hover:border-neutral-500 rounded bg-neutral-950" />
            </button>

            {/* Title Header */}
            <div className="p-6 border-b border-neutral-800">
              <h3 className="text-xl font-sans font-extrabold text-white uppercase tracking-wider flex items-center">
                <BookOpen className="w-5.5 h-5.5 mr-2 text-yellow-500 animate-pulse" />
                所持カードデッキ一覧 (Player Deck)
              </h3>
              <p className="text-zinc-400 text-xs mt-1">
                現在所有しているスペルカード（合計: <strong className="text-yellow-400">{state.deck.length}</strong> 枚）の一覧です。ショップ機能で不要なものを燃やし、強い比率を引き当てましょう。
              </p>
            </div>

            {/* List scrollable content */}
            <div className="p-6 flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 gap-4 select-none">
              {state.deck.map((card, idx) => {
                let colC = "border-neutral-800";
                let capType = "スキル";
                if (card.type === 'attack') { colC = "border-red-950/50 bg-red-950/10"; capType = "攻撃"; }
                else if (card.type === 'defense') { colC = "border-blue-950/50 bg-blue-950/10"; capType = "防御"; }
                
                return (
                  <div key={idx} className={`border rounded-lg p-2.5 flex flex-col justify-between hover:scale-102 transition ${colC}`}>
                    <div className="flex justify-between items-center mb-1 bg-neutral-950/80 p-1 rounded">
                      <span className="font-mono text-[9px] text-yellow-500 border border-yellow-500/25 px-1.5 rounded bg-yellow-950/10 font-bold uppercase">{capType}</span>
                      <span className="font-mono text-xs text-white font-bold bg-neutral-900 w-4 h-4 rounded-full flex items-center justify-center border border-neutral-700">{card.cost}</span>
                    </div>
                    <span className="font-bold text-white text-xs block truncate mb-1">{card.name}</span>
                    <p className="text-[9px] text-neutral-400 leading-normal font-sans">{card.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-neutral-950 border-t border-neutral-800 text-center text-xs text-neutral-500">
              「閉じる」または枠外をクリックして戦闘・MAPへ戻ります。
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-neutral-950 border-t border-neutral-900 py-3 px-4 text-center text-[10px] text-neutral-600 font-mono">
        Wendeck v1.0.0 © 2026. Built with Express, Vite & Google Gemini AI.
      </footer>
    </div>
  );
}
