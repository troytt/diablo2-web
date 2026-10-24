/**
 * Diablo II: Lord of Destruction v1.13c — Aura Target & Visual Parity Test Suite
 *
 * Ground Truth Invariants (Issue #397):
 * 1. Town vs Wilderness Filtering:
 *    - Friendly auras (Defiance #104, Might #98, Prayer #99, etc.) buff ONLY self in town.
 *    - In wilderness, they broadcast to self, player mercenary, party members, party mercenaries, and summons.
 * 2. Conviction Asymmetry:
 *    - Caster receives ground ring visual only (convictionback), ZERO resistance or defense reduction on self!
 *    - In wilderness, hostile enemies in range receive -Def% and -Res% debuffs AND display convictionback ring under feet.
 *    - In town, enemy debuffs and enemy ground rings are completely suspended.
 * 3. Holy Freeze Parity:
 *    - Caster displays cyan frost ground ring (holyfreeze).
 *    - In wilderness, hostile enemies in range receive cold pulse damage, slow (aurastat velocitypercent/attackrate/other_animrate), and blue chill tint (chillTicks).
 *    - Authentic D2 Invariant: Holy Freeze NEVER displays an aura ring under enemy feet!
 *    - In town, enemy damage pulses and slow are completely suspended.
 * 4. Complete Paladin Aura Coverage:
 *    - All 20 Paladin auras are recognized by isAuraSkill() and mapped to canonical 1.13c overlays.
 *    - Activating an aura spawns a looping player overlay that follows the player and wraps animation frames.
 *    - Deactivating/switching an aura cleanly disposes old aura overlays and enemy conviction rings.
 * 5. Spell Cast Overlay Immunity:
 *    - Transient spell cast overlays (e.g. Fire Bolt, Teleport) do NOT expire or interrupt active aura overlays.
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { WorldArena } from '../../src/server/engine/world-arena.ts'
import { AuraScanner } from '../../src/server/engine/aura-scanner.ts'
import { UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import type { CombatUnitContext } from '../../src/server/engine/combat-pipeline.ts'
import { GameEngine } from '../../src/server/engine/game-engine.ts'
import { DEMO_EXPERIENCE, DEMO_SKILLS, DEMO_QUESTS } from '../../src/common/data/demo-data.ts'
import {
  PALADIN_AURA_OVERLAYS,
  PALADIN_AURA_OVERLAY_PARTS,
  PALADIN_AURA_SKILL_IDS,
  isAuraSkill,
  getAuraOverlayName,
  getAuraOverlayNames,
} from '../../src/server/skills/skills.ts'
import { castSkill as castSceneSkill } from '../../src/server/skills/skills.ts'
import { executeNormalAttack } from '../../src/server/engine/combat-pipeline.ts'

function createMockTerrain() {
  return {
    widthPx: 2000,
    heightPx: 2000,
    overlap: () => 0,
  }
}

const DEFAULT_COMBAT_OPTIONS = {
  playerSpeed: 100,
  playerReach: 40,
  playerCooldownTicks: 12,
  playerDamage: 5,
  playerManaPerAttack: 1,
  respawnTicks: 50,
  disableMonsterAggro: false,
}

const DEFAULT_ENGINE_OPTIONS = {
  talkRadius: 50,
  pickupRadius: 30,
  inventoryCols: 10,
  inventoryRows: 4,
}

function makeMonsterStats(id: string, hp = 50) {
  return {
    id,
    name: id,
    hp,
    damage: 2,
    cooldownTicks: 25,
    reach: 40,
    aggroRadius: 200,
    speed: 60,
    xp: 10,
  }
}

describe('Issue #397 — Diablo II v1.13c Aura Target & Visual Parity', () => {
  it('1. Verifies all 20 Paladin auras are mapped to authentic 1.13c overlays', () => {
    expect(PALADIN_AURA_SKILL_IDS.size).toBe(20)
    for (const skillId of PALADIN_AURA_SKILL_IDS) {
      expect(isAuraSkill(skillId)).toBe(true)
      const overlay = getAuraOverlayName(skillId)
      expect(overlay).toBeDefined()
      expect(typeof overlay).toBe('string')
      expect(overlay!.length).toBeGreaterThan(0)
    }

    // Verify canonical names (Skills.txt aurastate -> States.txt overlay1 -> Overlay.txt row; Issue #1069)
    expect(getAuraOverlayName(98)).toBe('aura_might_front')
    expect(getAuraOverlayName(99)).toBe('aura_prayer_front')
    expect(getAuraOverlayName(100)).toBe('aura_resistfire')
    expect(getAuraOverlayName(102)).toBe('aura_holyfire_front')
    expect(getAuraOverlayName(103)).toBe('aura_thorns_front')
    expect(getAuraOverlayName(104)).toBe('aura_defiance_front')
    expect(getAuraOverlayName(105)).toBe('aura_resistcold')
    expect(getAuraOverlayName(108)).toBe('blessedaimfront')
    expect(getAuraOverlayName(109)).toBe('cleansingfront')
    expect(getAuraOverlayName(110)).toBe('aura_resistlight')
    expect(getAuraOverlayName(113)).toBe('concentrationfront')
    expect(getAuraOverlayName(114)).toBe('holyfreeze')
    expect(getAuraOverlayName(115)).toBe('staminafront')
    expect(getAuraOverlayName(118)).toBe('holyshockfront')
    expect(getAuraOverlayName(119)).toBe('sanctuaryfront')
    expect(getAuraOverlayName(120)).toBe('meditationfront')
    expect(getAuraOverlayName(122)).toBe('fanaticismfront')
    expect(getAuraOverlayName(123)).toBe('convictionback')
    expect(getAuraOverlayName(124)).toBe('redemptionback')
    expect(getAuraOverlayName(125)).toBe('aura_resistall_front')

    // Verify 13 two-part auras have [front, back] parts
    const twoPartAuraIds = [98, 99, 102, 103, 104, 108, 109, 113, 115, 118, 119, 122, 125]
    for (const id of twoPartAuraIds) {
      const parts = getAuraOverlayNames(id)
      expect(parts.length).toBe(2)
      expect(parts[0]).toMatch(/front$/)
      expect(parts[1]).toMatch(/back$/)
    }

    // Verify 7 full-ring auras have exactly 1 part
    const fullRingAuraIds = [100, 105, 110, 114, 120, 123, 124]
    for (const id of fullRingAuraIds) {
      const parts = getAuraOverlayNames(id)
      expect(parts.length).toBe(1)
    }
  })

  it('2. Defiance (#104): Only buffs self in town; broadcasts to allies/mercs/summons in wilderness', async () => {
    const registry = await getSharedDataRegistry()

    // --- Scenario A: In Town (isTown: true) ---
    const townArena = new WorldArena({
      registry,
      classCode: 'pal',
      skillId: 104,
      slvl: 20,
      isTown: true,
    })
    const mercInTown = townArena.addDummyAlly('mercenary', 'Desert Mercenary')
    const summonInTown = townArena.addDummyAlly('minion', 'Clay Golem')
    const partyInTown = townArena.addDummyAlly('party', 'Sorceress Ally')

    townArena.triggerCast()
    townArena.stepTicks(15)

    // Player MUST receive defiance aura state and armor bonus
    expect(townArena.player.stateBus.hasState('defiance')).toBe(true)
    expect(townArena.player.statList.getAccruedStat('skill_armor_percent')).toBeGreaterThan(0)

    // Allies in town must NOT receive defiance state or stat bonus!
    expect(mercInTown.stateBus.hasState('defiance')).toBe(false)
    expect(summonInTown.stateBus.hasState('defiance')).toBe(false)
    expect(partyInTown.stateBus.hasState('defiance')).toBe(false)
    expect(mercInTown.statList.getAccruedStat('skill_armor_percent')).toBe(0)
    expect(summonInTown.statList.getAccruedStat('skill_armor_percent')).toBe(0)
    expect(partyInTown.statList.getAccruedStat('skill_armor_percent')).toBe(0)

    // --- Scenario B: In Wilderness (isTown: false) ---
    const wildArena = new WorldArena({
      registry,
      classCode: 'pal',
      skillId: 104,
      slvl: 20,
      isTown: false,
    })
    const mercWild = wildArena.addDummyAlly('mercenary', 'Desert Mercenary')
    const summonWild = wildArena.addDummyAlly('minion', 'Clay Golem')
    const partyWild = wildArena.addDummyAlly('party', 'Sorceress Ally')

    wildArena.triggerCast()
    wildArena.stepTicks(15)

    // Player and ALL allies in wilderness receive defiance aura state!
    expect(wildArena.player.stateBus.hasState('defiance')).toBe(true)
    expect(mercWild.stateBus.hasState('defiance')).toBe(true)
    expect(summonWild.stateBus.hasState('defiance')).toBe(true)
    expect(partyWild.stateBus.hasState('defiance')).toBe(true)

    // Stat bonuses propagated
    expect(mercWild.statList.getAccruedStat('skill_armor_percent')).toBeGreaterThan(0)
    expect(summonWild.statList.getAccruedStat('skill_armor_percent')).toBeGreaterThan(0)
    expect(partyWild.statList.getAccruedStat('skill_armor_percent')).toBeGreaterThan(0)
  })

  it('3. Conviction (#123) Asymmetry: Caster has ground ring visual only with 0 debuffs; wilderness enemies get debuffs and foot rings', async () => {
    const registry = await getSharedDataRegistry()

    // --- Arena verification for stat asymmetry ---
    const wildArena = new WorldArena({
      registry,
      classCode: 'pal',
      skillId: 123,
      slvl: 20,
      isTown: false,
    })

    const initialPlayerDef = wildArena.player.statList.getAccruedStat('armorclass')
    const initialTargetDef = wildArena.targets[0]!.statList.getAccruedStat('armorclass')

    wildArena.triggerCast()
    wildArena.stepTicks(15)

    // Caster has conviction state for visual overlay...
    expect(wildArena.player.stateBus.hasState('conviction')).toBe(true)
    // BUT ZERO defense or resistance penalty on caster!
    expect(wildArena.player.statList.getAccruedStat('item_armor_percent')).toBe(0)
    expect(wildArena.player.statList.getAccruedStat('armorclass')).toBe(initialPlayerDef)

    // Enemy in wilderness receives defense penalty and pierce debuff
    expect(wildArena.targets[0]!.stateBus.hasState('conviction')).toBe(true)
    expect(wildArena.targets[0]!.statList.getAccruedStat('item_armor_percent')).toBeLessThan(0)
    expect(wildArena.targets[0]!.statList.getAccruedStat('armorclass')).toBeLessThan(initialTargetDef)

    // --- GameEngine verification for visual overlays ---
    const engineWild = new GameEngine(createMockTerrain(), {
      ...DEFAULT_ENGINE_OPTIONS,
      spawn: { x: 500, y: 500 },
      isTown: false,
      levelId: 2, // Blood Moor (wilderness)
      stats: [makeMonsterStats('zombie', 50)],
      monsterCount: 3,
      monsterSpread: 100, // close to player
      combatOptions: DEFAULT_COMBAT_OPTIONS,
      xpTable: DEMO_EXPERIENCE,
      skills: DEMO_SKILLS,
      npcDefs: [],
      questDefs: DEMO_QUESTS,
    })

    // Activate Conviction on player
    engineWild.updateActiveAura(123, 20)
    expect(engineWild.activeAuraSkillId).toBe(123)
    expect(engineWild.activeAuraOverlay).toBeDefined()
    expect(engineWild.activeAuraOverlay!.overlayName).toBe('convictionback')
    expect(engineWild.activeAuraOverlay!.loop).toBe(true)

    // Step engine ticks to allow conviction aura to acquire monsters
    engineWild.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      digits: [],
      saving: false,
      loading: false,
    })

    // Alive monsters in range MUST have convictionback foot ring
    const monsterRings = engineWild.overlays.filter(
      ov => ov.isAura && ov.auraSkillId === 123 && ov.targetMonsterIndex !== undefined && !ov.expired,
    )
    expect(monsterRings.length).toBeGreaterThan(0)
    expect(monsterRings[0]!.overlayName).toBe('convictionback')
    expect(monsterRings[0]!.loop).toBe(true)

    // --- In Town: Verify enemy debuffs & overlays are completely suspended ---
    const engineTown = new GameEngine(createMockTerrain(), {
      ...DEFAULT_ENGINE_OPTIONS,
      spawn: { x: 500, y: 500 },
      isTown: true,
      levelId: 1, // Rogue Encampment (town)
      stats: [makeMonsterStats('zombie', 50)],
      monsterCount: 3,
      monsterSpread: 100,
      combatOptions: DEFAULT_COMBAT_OPTIONS,
      xpTable: DEMO_EXPERIENCE,
      skills: DEMO_SKILLS,
      npcDefs: [],
      questDefs: DEMO_QUESTS,
    })

    engineTown.updateActiveAura(123, 20)
    engineTown.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      digits: [],
      saving: false,
      loading: false,
    })

    // In town, caster has aura ring, but NO monsters receive conviction foot rings
    const townMonsterRings = engineTown.overlays.filter(
      ov => ov.isAura && ov.auraSkillId === 123 && ov.targetMonsterIndex !== undefined && !ov.expired,
    )
    expect(townMonsterRings.length).toBe(0)
  })

  it('4. Holy Freeze (#114) Parity: Caster has cyan ring, enemies get cold damage & chill, but NEVER an enemy foot ring', async () => {
    const engineWild = new GameEngine(createMockTerrain(), {
      ...DEFAULT_ENGINE_OPTIONS,
      spawn: { x: 500, y: 500 },
      isTown: false,
      levelId: 2,
      stats: [makeMonsterStats('fallenshaman', 60)],
      monsterCount: 2,
      monsterSpread: 80,
      combatOptions: DEFAULT_COMBAT_OPTIONS,
      xpTable: DEMO_EXPERIENCE,
      skills: DEMO_SKILLS,
      npcDefs: [],
      questDefs: DEMO_QUESTS,
    })

    engineWild.updateActiveAura(114, 20)
    expect(engineWild.activeAuraSkillId).toBe(114)
    expect(engineWild.activeAuraOverlay!.overlayName).toBe('holyfreeze')
    expect(engineWild.activeAuraOverlay!.loop).toBe(true)

    const initialHp = engineWild.world.monsters[0]!.hp

    // Step 50 ticks to trigger a pulse
    for (let t = 0; t < 50; t++) {
      engineWild.tick({
        movement: { x: 0, y: 0 },
        attacking: false,
        pickingUp: false,
        talking: false,
        digits: [],
        saving: false,
        loading: false,
      })
    }

    // Monster must have taken cold damage and have chillTicks > 0
    expect(engineWild.world.monsters[0]!.hp).toBeLessThan(initialHp)
    expect(engineWild.world.monsters[0]!.chillTicks).toBeGreaterThan(0)

    // Invariant: ZERO overlays on the monster! Holy Freeze does not spawn enemy foot rings
    const monsterOverlays = engineWild.overlays.filter(
      ov => ov.targetMonsterIndex !== undefined && !ov.expired,
    )
    expect(monsterOverlays.length).toBe(0)
  })

  it('5. Overlay lifecycle: Looping overlays wrap frames, follow player, and survive transient spell casts', () => {
    const engine = new GameEngine(createMockTerrain(), {
      ...DEFAULT_ENGINE_OPTIONS,
      spawn: { x: 300, y: 300 },
      isTown: false,
      stats: [],
      monsterCount: 0,
      combatOptions: DEFAULT_COMBAT_OPTIONS,
      xpTable: DEMO_EXPERIENCE,
      skills: DEMO_SKILLS,
      npcDefs: [],
      questDefs: DEMO_QUESTS,
    })

    // Activate Defiance aura (#104) -> authentic 1.13c spawns BOTH front and back overlays
    engine.updateActiveAura(104, 20)
    expect(engine.overlays.length).toBe(2)
    const frontOv = engine.overlays.find(o => o.overlayName === 'aura_defiance_front')!
    const backOv = engine.overlays.find(o => o.overlayName === 'aura_defiance_back')!
    expect(frontOv).toBeDefined()
    expect(backOv).toBeDefined()
    expect(frontOv.preDraw).toBe(false)
    expect(backOv.preDraw).toBe(true)
    expect(frontOv.isAura).toBe(true)
    expect(frontOv.loop).toBe(true)
    expect(backOv.isAura).toBe(true)
    expect(backOv.loop).toBe(true)

    // Simulate 100 ticks (animation frames should wrap without expiring)
    for (let i = 0; i < 100; i++) {
      engine.tick({
        movement: { x: 1, y: 0 }, // Player moving
        attacking: false,
        pickingUp: false,
        talking: false,
        digits: [],
        saving: false,
        loading: false,
      })
    }

    expect(frontOv.expired).toBe(false)
    expect(backOv.expired).toBe(false)
    expect(frontOv.x).toBe(engine.world.player.x)
    expect(frontOv.y).toBe(engine.world.player.y)
    expect(backOv.x).toBe(engine.world.player.x)
    expect(backOv.y).toBe(engine.world.player.y)

    // Spawn a transient spell cast overlay (e.g. Fire Bolt cast overlay)
    const castOv = engine.spawnOverlay('fire_cast_1', { x: engine.world.player.x, y: engine.world.player.y }, 'player')
    expect(castOv).toBeDefined()
    expect(castOv.isAura).toBeFalsy()

    // The active aura overlays MUST NOT be expired by the spell cast!
    expect(frontOv.expired).toBe(false)
    expect(backOv.expired).toBe(false)
    expect(engine.overlays).toContain(frontOv)
    expect(engine.overlays).toContain(backOv)
    expect(engine.overlays).toContain(castOv)

    // Switching aura to Fanaticism (#122) cleanly replaces the aura overlays
    engine.updateActiveAura(122, 20)
    expect(frontOv.expired).toBe(true)
    expect(backOv.expired).toBe(true)
    expect(engine.activeAuraSkillId).toBe(122)
    expect(engine.activeAuraOverlays.length).toBe(2)
    expect(engine.activeAuraOverlays.map(o => o.overlayName).sort()).toEqual(['fanaticismback', 'fanaticismfront'])

    // Deactivating aura completely clears the aura overlays
    engine.updateActiveAura(null)
    expect(engine.activeAuraSkillId).toBeNull()
    expect(engine.activeAuraOverlay).toBeNull()
    expect(engine.activeAuraOverlays.length).toBe(0)
    expect(engine.overlays.filter(ov => ov.isAura && !ov.expired).length).toBe(0)
  })

  it('6. Redemption (#124): Redeems corpses in wilderness, suspended in town', () => {
    // --- Wilderness ---
    const engineWild = new GameEngine(createMockTerrain(), {
      ...DEFAULT_ENGINE_OPTIONS,
      spawn: { x: 500, y: 500 },
      isTown: false,
      levelId: 2,
      stats: [makeMonsterStats('zombie', 20)],
      monsterCount: 1,
      monsterSpread: 20,
      combatOptions: DEFAULT_COMBAT_OPTIONS,
      xpTable: DEMO_EXPERIENCE,
      skills: DEMO_SKILLS,
      npcDefs: [],
      questDefs: DEMO_QUESTS,
    })

    // Kill monster to create a fresh corpse
    const mon = engineWild.world.monsters[0]!
    mon.state = 'dead'
    mon.corpseTicks = 100

    // Set player health/mana lower to verify healing
    engineWild.world.player.hp = 100
    engineWild.world.player.maxHp = 500
    engineWild.world.player.mana = 100
    engineWild.world.player.maxMana = 500

    engineWild.updateActiveAura(124, 20)

    // Step 50 ticks to trigger pulse
    for (let t = 0; t < 50; t++) {
      engineWild.tick({
        movement: { x: 0, y: 0 },
        attacking: false,
        pickingUp: false,
        talking: false,
        digits: [],
        saving: false,
        loading: false,
      })
    }

    // Corpse consumed, player restored
    expect(mon.corpseTicks).toBe(0)
    expect(engineWild.world.player.hp).toBeGreaterThan(100)
    expect(engineWild.world.player.mana).toBeGreaterThan(100)

    // --- Town ---
    const engineTown = new GameEngine(createMockTerrain(), {
      ...DEFAULT_ENGINE_OPTIONS,
      spawn: { x: 500, y: 500 },
      isTown: true,
      levelId: 1,
      stats: [makeMonsterStats('zombie', 20)],
      monsterCount: 1,
      monsterSpread: 20,
      combatOptions: DEFAULT_COMBAT_OPTIONS,
      xpTable: DEMO_EXPERIENCE,
      skills: DEMO_SKILLS,
      npcDefs: [],
      questDefs: DEMO_QUESTS,
    })

    const townMon = engineTown.world.monsters[0]!
    townMon.state = 'dead'
    townMon.corpseTicks = 100
    engineTown.world.player.hp = 100
    engineTown.world.player.maxHp = 500

    engineTown.updateActiveAura(124, 20)
    for (let t = 0; t < 50; t++) {
      engineTown.tick({
        movement: { x: 0, y: 0 },
        attacking: false,
        pickingUp: false,
        talking: false,
        digits: [],
        saving: false,
        loading: false,
      })
    }

    // In town, corpse consumption is suspended (corpse natural decay is 1/tick so 100 - 50 = 50, not consumed to 0)
    expect(townMon.corpseTicks).toBe(50)
    expect(engineTown.world.player.hp).toBe(100)
  })

  it('7. 3D Isometric Aura Ring Sandwich: Two-part auras spawn front (depth +0.1) and back (depth -0.1)', () => {
    const engine = new GameEngine(createMockTerrain(), {
      ...DEFAULT_ENGINE_OPTIONS,
      spawn: { x: 500, y: 500 },
      isTown: false,
      stats: [],
      monsterCount: 0,
      combatOptions: DEFAULT_COMBAT_OPTIONS,
      xpTable: DEMO_EXPERIENCE,
      skills: DEMO_SKILLS,
      npcDefs: [],
      questDefs: DEMO_QUESTS,
    })

    // Test a two-part aura: Holy Fire (102)
    engine.updateActiveAura(102, 20)
    expect(engine.overlays.length).toBe(2)
    const holyFireFront = engine.overlays.find(o => o.overlayName === 'aura_holyfire_front')!
    const holyFireBack = engine.overlays.find(o => o.overlayName === 'aura_holyfire_back')!
    expect(holyFireFront).toBeDefined()
    expect(holyFireBack).toBeDefined()
    expect(holyFireFront.preDraw).toBe(false)
    expect(holyFireBack.preDraw).toBe(true)

    // Test a full-ring aura: Holy Freeze (114)
    engine.updateActiveAura(114, 20)
    expect(engine.overlays.length).toBe(1)
    const holyFreeze = engine.overlays[0]!
    expect(holyFreeze.overlayName).toBe('holyfreeze')
    expect(holyFreeze.preDraw).toBe(true)

    // Test another two-part aura: Might (98)
    engine.updateActiveAura(98, 20)
    expect(engine.overlays.length).toBe(2)
    const mightFront = engine.overlays.find(o => o.overlayName === 'aura_might_front')!
    const mightBack = engine.overlays.find(o => o.overlayName === 'aura_might_back')!
    expect(mightFront.preDraw).toBe(false)
    expect(mightBack.preDraw).toBe(true)
  })

  it('8. Layer 3 Wiring: SkillCaster aura activation & Blessed Hammer Concentration, WeaponCombat aura bonuses, and Sanctuary/Cleansing tick pulses', () => {
    const engine = new GameEngine(createMockTerrain(), {
      ...DEFAULT_ENGINE_OPTIONS,
      spawn: { x: 500, y: 500 },
      isTown: false,
      levelId: 2,
      stats: [{ ...makeMonsterStats('zombie', 1000), isUndead: true }],
      monsterCount: 1,
      monsterSpread: 20,
      combatOptions: DEFAULT_COMBAT_OPTIONS,
      xpTable: DEMO_EXPERIENCE,
      skills: DEMO_SKILLS,
      npcDefs: [],
      questDefs: DEMO_QUESTS,
    })

    const status = { textContent: '' } as any
    const hudManager = {
      lang: 'ENG',
      skillLevels: { 108: 10, 112: 20, 113: 20, 115: 10 },
      rightSkill: 113,
    } as any

    // 1. Casting Concentration (#113) via SkillCaster activates activeAuraSkillId
    const castRes = castSceneSkill(113, 520, 500, {
      engine,
      hudManager,
      status,
      collisionGrid: undefined,
    } as any)
    expect(castRes).toBe(true)
    expect(engine.activeAuraSkillId).toBe(113)
    expect(engine.activeAuraLevel).toBe(20)

    // 2. Casting Blessed Hammer (#112) applies Blessed Aim (10) + Vigor (10) synergies and Concentration (20) at 50% efficiency
    const bhCast = castSceneSkill(112, 520, 500, {
      engine,
      hudManager,
      status,
      collisionGrid: undefined,
    } as any)
    expect(bhCast).toBe(true)
    const bhProj = engine.projectiles.find(p => p.missileType === 'blessedhammer')
    expect(bhProj).toBeDefined()
    // Base slvl 20 BH without synergies/conc is ~198; with 20 synergy points (+280%) + slvl 20 Conc (+172.5%) it exceeds 1000
    expect(bhProj!.damage).toBeGreaterThan(1000)

    // 3. WeaponCombat normal attack with Fanaticism (#122, slvl 20: +373% caster ED, +35% IAS)
    const mon = engine.world.monsters[0]!
    mon.x = engine.world.player.x + 15
    mon.y = engine.world.player.y
    mon.hp = 1000
    engine.updateActiveAura(122, 20)
    const atkRes = executeNormalAttack(mon.x, mon.y, {
      engine,
      hudLike: hudManager,
      equippedWeapon: { code: 'lsd', name: 'Long Sword', damageMin: 20, damageMax: 20 } as any,
    })
    expect(atkRes.casted).toBe(true)
    // Long Sword (lsd: 3-19 base, avg 11) with slvl 20 Fanaticism (+373% ED) deals floor(3*4.73)=14 .. floor(19*4.73)=89 -> avg 52
    expect(1000 - mon.hp).toBe(52)

    // 4. Sanctuary (#119) periodic pulse in GameEngine.tick damages and knocks back Undead
    engine.projectiles.length = 0
    mon.hp = 1000
    mon.state = 'idle'
    mon.x = engine.world.player.x + 40
    mon.y = engine.world.player.y
    const beforeDist = Math.hypot(mon.x - engine.world.player.x, mon.y - engine.world.player.y)
    engine.updateActiveAura(119, 20)
    engine.world.tick = 49
    engine.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      digits: [],
      saving: false,
      loading: false,
    })
    expect(mon.hp).toBeLessThan(1000)
    const afterDist = Math.hypot(mon.x - engine.world.player.x, mon.y - engine.world.player.y)
    expect(afterDist).toBeGreaterThan(beforeDist)
  })
})
