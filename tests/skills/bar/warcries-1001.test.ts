/**
 * Diablo II: Lord of Destruction v1.13c — Barbarian Warcries (#130-#155) 4-Layer Full-Stack Parity Suite
 * Gitea Tracking Issue: #1001
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import {
  CANONICAL_113C_MISSILES,
  CANONICAL_113C_OVERLAYS,
  getSkillCooldownTicks,
  getSkillManaCost,
} from '../../../src/common/skills/missiles-data.ts'
import { aggregateUnit } from '../../../src/client/ui-model/stat-engine.ts'
import { StatList } from '../../../src/client/world/stat-list.ts'
import { spawnMissilesForSkillImpl } from '../../../src/client/world/world-skill-missiles.ts'
import { UnitStatList, FIXED_ONE } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { GameEngine } from '../../../src/server/engine/game-engine.ts'
import { DEMO_EXPERIENCE, DEMO_SKILLS, DEMO_QUESTS } from '../../../src/common/data/demo-data.ts'
import {
  calculateHowlStats,
  calculateFindPotionStats,
  calculateTauntStats,
  calculateShoutStats,
  calculateFindItemStats,
  calculateBattleCryStats,
  calculateBattleOrdersStats,
  calculateGrimWardStats,
  calculateWarCryStats,
  calculateBattleCommandStats,
  rollFindPotionDrop113c,
  validateBarbarianCorpseTarget,
} from '../../../src/server/skills/barbarian-warcries.ts'
import { executeSkill } from '../../../src/server/skills/skills.ts'
import { evaluateSkillCore113c, executeSkillCore113c } from '../../../src/server/skills/registry.ts'
import { castSkill as castSceneSkill } from '../../../src/server/skills/skills.ts'

describe('[Issue #1001] Barbarian Warcries (#130-#155) 4-Layer 1.13c Parity', () => {
  it('Layer 1: verifies Missiles.txt entries, Overlays.txt entries, mana costs, and zero casting delays', () => {
    // Missiles.txt #148 howl, #149 shout, #219 battlecry, #235 warcry, #236 battlecommand, #237 battleorders
    // (1.13c Missiles.txt columns, Issue #1060: [Vel, MaxVel, Accel, Range, LevRange])
    const rows: Record<string, [number, number, number, number, number]> = {
      howl: [12, 12, -1000, 12, 0],
      shout: [30, 30, -500, 15, 0],
      battlecommand: [30, 30, -500, 15, 0],
      battleorders: [30, 30, -500, 15, 0],
      battlecry: [12, 12, -1000, 12, 0],
      warcry: [12, 12, -600, 16, 0],
    }
    for (const [key, [vel, maxVel, accel, range, levRange]] of Object.entries(rows)) {
      const m = CANONICAL_113C_MISSILES[key]!
      expect([m.vel, m.maxVel, m.accel, m.range, m.levRange], key).toEqual([vel, maxVel, accel, range, levRange])
      expect(m.nextDelay).toBe(4)
    }

    // Overlays (1.13c Overlay.txt & States.txt castoverlay: shoutstart, battleorderscast, battlecommandcast)
    for (const ov of ['shoutstart', 'battleorderscast', 'battlecommandcast', 'taunt', 'battlecry', 'warcry']) {
      expect(CANONICAL_113C_OVERLAYS[ov]).toBeDefined()
    }

    // Mana costs & zero cooldowns
    expect(getSkillManaCost(130, 1)).toBe(4)
    expect(getSkillManaCost(131, 1)).toBe(2)
    expect(getSkillManaCost(137, 1)).toBe(3)
    expect(getSkillManaCost(138, 1)).toBe(6)
    expect(getSkillManaCost(142, 1)).toBe(7)
    expect(getSkillManaCost(146, 1)).toBe(5)
    expect(getSkillManaCost(149, 1)).toBe(7)
    expect(getSkillManaCost(150, 1)).toBe(4)
    expect(getSkillManaCost(154, 1)).toBe(10)
    expect(getSkillManaCost(154, 20)).toBe(29)
    expect(getSkillManaCost(155, 1)).toBe(11)

    for (const id of [130, 131, 137, 138, 142, 146, 149, 150, 154, 155]) {
      expect(getSkillCooldownTicks(id)).toBe(0)
    }
  })

  it('Layer 1: stat-engine synthesizes Battle Command (state 51) +1 allskills before passives & Shout/Battle Orders', () => {
    const stats = new StatList()
    stats.set(12, 30) // level 30
    const emptyContainers = {
      equipmentBySlot: new Map(),
      mercBySlot: new Map(),
      inventory: new Map(),
      socketedByHost: new Map(),
      byId: new Map(),
    } as any
    const hardLevels = new Map<number, number>([
      [138, 10], // Shout
      [145, 5],  // Iron Skin
      [149, 10], // Battle Orders
      [155, 1],  // Battle Command
    ])

    const withoutBc = aggregateUnit({
      kind: 'player',
      classId: 4, // Barbarian
      level: 30,
      stats,
      containers: emptyContainers,
      activeStates: new Set([26, 32]), // Shout + Battle Orders
      hardSkillLevels: hardLevels,
    })

    const withBc = aggregateUnit({
      kind: 'player',
      classId: 4, // Barbarian
      level: 30,
      stats,
      containers: emptyContainers,
      activeStates: new Set([26, 32, 51]), // Shout + Battle Orders + Battle Command
      hardSkillLevels: hardLevels,
    })

    // Battle Command adds +1 to item_allskills (127) and boosts effective skill levels by +1
    expect(withBc.total(127, 0)).toBe(withoutBc.total(127, 0) + 1)
    expect(withBc.effectiveSkillLevel(138).effective).toBe(11)
    expect(withBc.effectiveSkillLevel(145).effective).toBe(6)
    expect(withBc.effectiveSkillLevel(149).effective).toBe(11)
    // Shout + Iron Skin % defense (stat 171): +10% from Shout +1 slvl and +10% from Iron Skin +1 slvl = +20%
    expect(withBc.total(171, 0)).toBe(withoutBc.total(171, 0) + 20)
    // Battle Orders % max HP/Mana (stats 76/77): +3% from +1 slvl
    expect(withBc.total(76, 0)).toBe(withoutBc.total(76, 0) + 3)
    expect(withBc.total(77, 0)).toBe(withoutBc.total(77, 0) + 3)
  })

  it('Layer 1: state-bus enforces curseType=1 mutual exclusion on Taunt/BattleCry/Terror and anti-downgrade on Shout/BO/BC', async () => {
    const registry = await getSharedDataRegistry()
    const monsterStats = new UnitStatList()
    const monsterBus = new StateBus(monsterStats, registry)

    monsterBus.applyState({ stateNameOrId: 'amplifydamage', slvl: 5, durationFrames: 200 })
    expect(monsterBus.hasState('amplifydamage')).toBe(true)

    monsterBus.applyState({ stateNameOrId: 'taunt', slvl: 1, durationFrames: 0 })
    expect(monsterBus.hasState('amplifydamage')).toBe(false)
    expect(monsterBus.hasState('taunt')).toBe(true)

    monsterBus.applyState({ stateNameOrId: 'battlecry', slvl: 3, durationFrames: 300 })
    expect(monsterBus.hasState('taunt')).toBe(false)
    expect(monsterBus.hasState('battlecry')).toBe(true)

    // Anti-downgrade on Shout / Battle Orders / Battle Command
    const playerStats = new UnitStatList()
    const playerBus = new StateBus(playerStats, registry)
    const highBo = playerBus.applyState({
      stateNameOrId: 'battleorders',
      slvl: 20,
      durationFrames: 5500,
      stats: { item_maxhp_percent: 92 },
    })
    expect(highBo.applied).toBe(true)

    const lowBo = playerBus.applyState({
      stateNameOrId: 'battleorders',
      slvl: 5,
      durationFrames: 1750,
      stats: { item_maxhp_percent: 47 },
    })
    expect(lowBo.applied).toBe(false)
    expect(lowBo.activeSlvl).toBe(20)
    expect(playerStats.getModifierBonus('item_maxhp_percent')).toBe(92)
  })

  it('Layer 2: verifies barbarian-warcries.ts 1.13c formulas, AICurse difficulty scaling, corpse rules, and Find Potion table', () => {
    // #130 Howl: ln56 (75 + 25*(slvl-1)) with AICurse 1/2/4, ln34 (24 + 5*(slvl-1))
    const howlNorm = calculateHowlStats(1, 'normal')
    const howlNm = calculateHowlStats(1, 'nightmare')
    const howlHell = calculateHowlStats(1, 'hell')
    expect(howlNorm.fleeDurationFrames).toBe(75)
    expect(howlNm.fleeDurationFrames).toBe(37)
    expect(howlHell.fleeDurationFrames).toBe(18)
    expect(howlNorm.fleeRangeSubtiles).toBe(24)

    // #131 Find Potion & gdwPotionsTable
    expect(calculateFindPotionStats(1).successChancePct).toBe(15)
    expect(rollFindPotionDrop113c(1, 0, 0, 10, 30)).toEqual({
      dropped: true,
      chancePct: 15,
      potionCode: 'hp1',
      potionKind: 'healing',
    })
    expect(rollFindPotionDrop113c(1, 4, 2, 10, 75)).toEqual({
      dropped: true,
      chancePct: 15,
      potionCode: 'mp5',
      potionKind: 'mana',
    })
    expect(rollFindPotionDrop113c(1, 4, 2, 10, 95)).toEqual({
      dropped: true,
      chancePct: 15,
      potionCode: 'rvl',
      potionKind: 'rejuvenation',
    })

    // #137 Taunt
    expect(calculateTauntStats(10).targetAttackRatingReductionPct).toBe(23)
    expect(calculateTauntStats(10).targetDamageReductionPct).toBe(23)

    // #138 Shout, #149 Battle Orders, #155 Battle Command mutual duration synergy (+125 frames / blvl) & 10.67 radius
    const shout = calculateShoutStats(20, 20, 1)
    expect(shout.defenseBonusPct).toBe(290)
    expect(shout.durationFrames).toBe(5250 + 21 * 125)
    expect(shout.radiusSubtiles).toBe(10.67)
    expect(
      (executeSkill(138, { caster: { x: 0, y: 0, mana: 100, cooldown: 0 } as any, target: { x: 0, y: 0 }, skillLevel: 1 }) as any)
        .durationSeconds,
    ).toBe(20)
    expect(
      (executeSkill(138, { caster: { x: 0, y: 0, mana: 100, cooldown: 0 } as any, target: { x: 0, y: 0 }, skillLevel: 5 }) as any)
        .durationSeconds,
    ).toBe(60)

    const bo = calculateBattleOrdersStats(20, 20, 1)
    expect(bo.maxLifeBonusPct).toBe(92)
    expect(bo.durationFrames).toBe(5500 + 21 * 125)
    expect(bo.radiusSubtiles).toBe(10.67)

    const bc = calculateBattleCommandStats(1, 20, 20)
    expect(bc.allSkillsBonus).toBe(1)
    expect(bc.durationFrames).toBe(125 + 40 * 125)
    expect(bc.radiusSubtiles).toBe(10.67)

    // #146 Battle Cry AICurse divisor & 5.33 radius
    expect(calculateBattleCryStats(1, 'normal').durationFrames).toBe(300)
    expect(calculateBattleCryStats(1, 'nightmare').durationFrames).toBe(150)
    expect(calculateBattleCryStats(1, 'hell').durationFrames).toBe(75)
    expect(calculateBattleCryStats(1).radiusSubtiles).toBe(5.33)

    // #150 Grim Ward AICurse divisor & 1000-frame totem life
    expect(calculateGrimWardStats(1, 'normal').fleeDurationFrames).toBe(60)
    expect(calculateGrimWardStats(1, 'nightmare').fleeDurationFrames).toBe(30)
    expect(calculateGrimWardStats(1, 'hell').fleeDurationFrames).toBe(15)
    expect(calculateGrimWardStats(1).totemDurationFrames).toBe(1000)

    // #154 War Cry stun cap at 250 frames & 5.33 radius
    expect(calculateWarCryStats(20, 20, 20, 20).synergyBonusPct).toBe(360)
    expect(calculateWarCryStats(50).stunDurationFrames).toBe(250)
    expect(calculateWarCryStats(20).radiusSubtiles).toBe(5.33)

    // Corpse target validation: #131 & #150 reject non-soft (skeleton) corpses; #142 allows skeleton corpses
    expect(validateBarbarianCorpseTarget(131, { isSoft: false })).toEqual({
      valid: false,
      reason: 'corpse_not_soft',
    })
    expect(validateBarbarianCorpseTarget(150, { isSoft: false })).toEqual({
      valid: false,
      reason: 'corpse_not_soft',
    })
    expect(validateBarbarianCorpseTarget(142, { isSoft: false }).valid).toBe(true)
    expect(validateBarbarianCorpseTarget(142, { stateId: 118 })).toEqual({
      valid: false,
      reason: 'already_consumed',
    })
  })

  it('Layer 2: registry.ts executes Howl mlvl gate, Taunt single-target walk_melee, Battle Orders current vitals scaling, and War Cry boss stun immunity', async () => {
    const registry = await getSharedDataRegistry()

    // 1. Howl (#130): clvl + slvl + 1 > mlvl gate
    const howlSkill = registry.getSkillById(130)!
    const casterStats = new UnitStatList()
    casterStats.setBaseStat('level', 10)
    casterStats.setBaseSkillLevel(130, 1)
    const caster = {
      id: 'barb',
      name: 'barb',
      unitType: 'player' as const,
      statList: casterStats,
      stateBus: new StateBus(casterStats, registry),
    }

    const lowMlvlStats = new UnitStatList()
    lowMlvlStats.setBaseStat('hitpoints', 100 * FIXED_ONE)
    lowMlvlStats.setBaseStat('maxhp', 100 * FIXED_ONE)
    lowMlvlStats.setBaseStat('level', 10)
    const lowMon = {
      id: 'mon-low',
      name: 'mon-low',
      unitType: 'monster' as const,
      statList: lowMlvlStats,
      stateBus: new StateBus(lowMlvlStats, registry),
    }

    const highMlvlStats = new UnitStatList()
    highMlvlStats.setBaseStat('hitpoints', 100 * FIXED_ONE)
    highMlvlStats.setBaseStat('maxhp', 100 * FIXED_ONE)
    highMlvlStats.setBaseStat('level', 25)
    const highMon = {
      id: 'mon-high',
      name: 'mon-high',
      unitType: 'monster' as const,
      statList: highMlvlStats,
      stateBus: new StateBus(highMlvlStats, registry),
    }

    const howlEval = evaluateSkillCore113c({
      registry,
      skill: howlSkill,
      slvl: 1,
      blvl: 1,
      statList: casterStats,
    })
    const howlOut = executeSkillCore113c({
      registry,
      skill: howlSkill,
      evalResult: howlEval,
      caster,
      targets: [lowMon, highMon],
      corpses: [],
      targetX: 0,
      targetY: 0,
    } as any)
    expect(lowMon.stateBus.hasState('terror')).toBe(true)
    expect(highMon.stateBus.hasState('terror')).toBe(false)
    expect(howlOut.notes).toContain('howl_mlvl_immune:mon-high')

    // 2. Battle Orders (#149): scales current HP/Mana proportionally with Max HP/Mana increase
    const boSkill = registry.getSkillById(149)!
    casterStats.setBaseStat('maxhp', 1000 * FIXED_ONE)
    casterStats.setBaseStat('hitpoints', 500 * FIXED_ONE)
    casterStats.setBaseStat('maxmana', 200 * FIXED_ONE)
    casterStats.setBaseStat('mana', 100 * FIXED_ONE)
    casterStats.setBaseSkillLevel(149, 1) // +35%
    const boEval = evaluateSkillCore113c({
      registry,
      skill: boSkill,
      slvl: 1,
      blvl: 1,
      statList: casterStats,
    })
    executeSkillCore113c({
      registry,
      skill: boSkill,
      evalResult: boEval,
      caster,
      targets: [],
      corpses: [],
      targetX: 0,
      targetY: 0,
    } as any)
    expect(casterStats.getMaxHp256()).toBe(1350 * FIXED_ONE)
    expect(casterStats.getHp256()).toBe(675 * FIXED_ONE)
    expect(casterStats.getMaxMana256()).toBe(270 * FIXED_ONE)
    expect(casterStats.getMana256()).toBe(135 * FIXED_ONE)

    // 3. War Cry (#154): damages both normal and boss monsters, but stuns ONLY non-boss
    const wcSkill = registry.getSkillById(154)!
    casterStats.setBaseSkillLevel(154, 10)
    const wcEval = evaluateSkillCore113c({
      registry,
      skill: wcSkill,
      slvl: 10,
      blvl: 10,
      statList: casterStats,
    })
    const bossStats = new UnitStatList()
    bossStats.setBaseStat('hitpoints', 1000 * FIXED_ONE)
    bossStats.setBaseStat('maxhp', 1000 * FIXED_ONE)
    const bossMon = {
      id: 'boss-mon',
      name: 'boss-mon',
      unitType: 'monster' as const,
      isBoss: true,
      statList: bossStats,
      stateBus: new StateBus(bossStats, registry),
    }
    executeSkillCore113c({
      registry,
      skill: wcSkill,
      evalResult: wcEval,
      caster,
      targets: [lowMon, bossMon],
      corpses: [],
      targetX: 0,
      targetY: 0,
    } as any)
    expect(lowMon.stateBus.hasState('stunned')).toBe(true)
    expect(bossMon.stateBus.hasState('stunned')).toBe(false)
    expect(bossStats.getHp256()).toBeLessThan(1000 * FIXED_ONE)
  })

  it('Layer 3 & Layer 4: skill-caster.ts and world-skill-missiles.ts spawn 64 radial warcry missiles, enforce corpse rules, and apply State #21 stunned (#1047)', () => {
    const engine = new GameEngine(
      { widthPx: 2000, heightPx: 2000, overlap: () => 0 },
      {
        talkRadius: 50,
        pickupRadius: 30,
        inventoryCols: 10,
        inventoryRows: 4,
        spawn: { x: 500, y: 500 },
        isTown: false,
        levelId: 2,
        stats: [
          {
            id: 'zombie',
            name: 'zombie',
            hp: 500,
            damage: 2,
            cooldownTicks: 25,
            reach: 40,
            aggroRadius: 200,
            speed: 60,
            xp: 10,
          },
        ],
        monsterCount: 2,
        monsterSpread: 30,
        combatOptions: {
          playerSpeed: 100,
          playerReach: 40,
          playerCooldownTicks: 12,
          playerDamage: 5,
          playerManaPerAttack: 1,
          respawnTicks: 50,
          disableMonsterAggro: false,
        },
        xpTable: DEMO_EXPERIENCE,
        skills: DEMO_SKILLS,
        npcDefs: [],
        questDefs: DEMO_QUESTS,
      }
    )
    engine.world.player.mana = 500
    engine.world.player.maxMana = 500
    const status = { textContent: '' } as any
    const hudManager = {
      lang: 'ENG',
      mana: 500,
      skillLevels: { 130: 10, 131: 10, 137: 10, 138: 10, 142: 10, 146: 10, 149: 10, 150: 10, 154: 10, 155: 10 },
    } as any

    // 1. Shout (#138) spawns 64 'shout' projectiles (sub_6FD14170) and sets player.cooldown = 0
    expect(castSceneSkill(138, 520, 500, { engine, hudManager, status } as any)).toBe(true)
    expect(engine.world.player.cooldown).toBe(0)
    expect(engine.projectiles.filter(p => p.missileType === 'shout')).toHaveLength(64)

    // 2. War Cry (#154) spawns 64 'warcry' projectiles (sub_6FD14170) and stuns non-boss monsters
    engine.projectiles.length = 0
    expect(castSceneSkill(154, 520, 500, { engine, hudManager, status } as any)).toBe(true)
    expect(engine.projectiles.filter(p => p.missileType === 'warcry')).toHaveLength(64)
    expect((engine.world.monsters[0] as any).stunTicks).toBe(70)

    // 3. Find Potion (#131) fails on skeleton corpse (isSoft = false) without spending mana, Find Item (#142) succeeds on skeleton corpse
    const corpseMon = engine.world.monsters[0]!
    corpseMon.hp = 0
    corpseMon.state = 'dead'
    corpseMon.corpseTicks = 200
    ;(corpseMon as any).isSoft = false
    const manaBefore = hudManager.mana
    expect(castSceneSkill(131, corpseMon.x, corpseMon.y, { engine, hudManager, status } as any)).toBe(false)
    expect(hudManager.mana).toBe(manaBefore)
    expect(castSceneSkill(142, corpseMon.x, corpseMon.y, { engine, hudManager, status } as any)).toBe(true)
    expect((corpseMon as any).corpseStateId).toBe(118)

    // 4. Layer 4 ClientWorld spawnCastMissilesImpl: CltDoFunc 25 64-ray ring for Shout/WarCry and States.txt #21 stunned (28 is conviction, Issue #1047)
    const spawnedMissiles: Array<{ key: string; maxTicks?: number }> = []
    const attachedOverlays: Array<{ target: any; key: string }> = []
    const monsterUnit = {
      unitType: 'monster',
      id: 201,
      x: 102,
      y: 100,
      dead: false,
      states: new Set<number>(),
    }
    const casterUnit = {
      unitType: 'player',
      id: 1,
      x: 100,
      y: 100,
      dead: false,
      states: new Set<number>(),
    }
    const mockClientWorld: any = {
      frameCount: 0,
      _units: new Map([[1, casterUnit], [201, monsterUnit]]),
      _monsters: new Map([[201, monsterUnit]]),
      getUnit: () => casterUnit,
      spawnMissileByKey: (key: string, _sx: number, _sy: number, _dx: number, _dy: number, opts?: any) => {
        spawnedMissiles.push({ key, maxTicks: opts?.maxTicks })
        return { vx: 0, vy: 0 }
      },
      attachUnitOverlay: (target: any, key: string) => {
        attachedOverlays.push({ target, key })
      },
      ensureUnit: () => ({ states: new Set<number>() }),
    }

    spawnMissilesForSkillImpl.call(mockClientWorld, casterUnit as any, 154, 102, 100, 10)
    expect(spawnedMissiles.filter(m => m.key === 'warcry')).toHaveLength(64)
    expect(spawnedMissiles.filter(m => m.key === 'warcryshockwave')).toHaveLength(0)
    expect(monsterUnit.states.has(21)).toBe(true)
    expect(monsterUnit.states.has(28)).toBe(false)
    expect(attachedOverlays.some(o => o.target === monsterUnit && o.key === 'stun')).toBe(false)
  })
})
