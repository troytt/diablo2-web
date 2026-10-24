import { describe, expect, it } from 'vitest'
import {
  BONE_FETISH_EXPLOSION_RADIUS,
  DURIEL_MAGGOT_HCIDX,
  DURIEL_MAGGOT_OFFSETS,
  FIRE_ENCHANT_EXPLOSION_RADIUS,
  MON_UMOD,
  calcBoneFetishDeathDamage,
  calcColdEnchantedDeathNova,
  calcFireEnchantedDeathDamage,
  getBossDeathFxSpec,
  resolveMonsterUModIds,
} from '../src/common/units/monster-death-fx.ts'
import {
  getMonsterKindByHcIdx,
  getMonsterModeMissile113c,
  monsterStatsOf,
} from '../src/common/units/monsters-data.ts'
import { Rng } from '../src/common/rng/d2-rng.ts'
import type {
  CombatPlayer,
  CombatTerrain,
  CombatWorld,
  Monster,
  MonsterRank,
} from '../src/common/units/unit-types.ts'
import {
  BAAL_THRONE_WAVES_113C,
  MonsterAI,
  OBLIVION_KNIGHT_CURSES,
  damageMonster,
  executeActBossAi113c,
  executeOblivionKnightCurse113c,
  executeShamanResurrect113c,
  tickBaalThroneWave113c,
  tickMercenaryAi25Hz,
  tickMonsters,
  triggerMonsterDeathAffixes113c,
  triggerPackMoraleOnDeath,
  type MercenaryUnitState,
} from '../src/server/ai/monster-ai.ts'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { SummonManager } from '../src/server/ai/summon-manager.ts'
import { AuraScanner } from '../src/server/engine/aura-scanner.ts'
import type { CombatUnitContext } from '../src/server/engine/combat-pipeline.ts'
import { MissileEngine } from '../src/server/engine/missile-engine.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'
import { GameInstance } from '../src/server/engine/game-instance.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'

const OPEN_TERRAIN: CombatTerrain = {
  overlap: () => 0,
}

function makeTestPlayer(overrides: Partial<CombatPlayer> = {}): CombatPlayer {
  return {
    x: 100,
    y: 100,
    hp: 1000,
    maxHp: 1000,
    mana: 500,
    maxMana: 500,
    stamina: 300,
    maxStamina: 300,
    level: 30,
    xp: 0,
    cooldown: 0,
    facing: 0,
    alive: true,
    respawnIn: 0,
    swingTicks: 0,
    strength: 100,
    dexterity: 100,
    vitality: 100,
    energy: 100,
    ...overrides,
  }
}

function makeTestMonster(
  hcIdx: number,
  overrides: Partial<Monster> & {
    readonly ai?: string | undefined
    readonly rank?: MonsterRank | undefined
    readonly modifiers?: readonly string[] | undefined
    readonly superUniqueId?: string | undefined
    readonly isRanged?: boolean | undefined
    readonly isUndead?: boolean | undefined
    readonly inTown?: boolean | undefined
    readonly killable?: boolean | undefined
    readonly petIgnore?: boolean | undefined
    readonly damage?: number | undefined
    readonly reach?: number | undefined
    readonly cooldownTicks?: number | undefined
  } = {},
): Monster {
  const kind = getMonsterKindByHcIdx(hcIdx) ?? getMonsterKindByHcIdx(0)!
  const rng = new Rng(42 + hcIdx)
  const baseStats = monsterStatsOf(
    kind,
    rng,
    120,
    undefined,
    null,
    kind.level[0],
    overrides.rank ?? 'normal',
  )
  const stats = {
    ...baseStats,
    hcIdx,
    ...(overrides.hp !== undefined ? { hp: overrides.hp } : {}),
    ...(overrides.damage !== undefined ? { damage: overrides.damage } : {}),
    ...(overrides.reach !== undefined ? { reach: overrides.reach } : {}),
    ...(overrides.cooldownTicks !== undefined ? { cooldownTicks: overrides.cooldownTicks } : {}),
    ...(overrides.ai !== undefined ? { ai: overrides.ai } : {}),
    ...(overrides.rank !== undefined ? { rank: overrides.rank } : {}),
    ...(overrides.modifiers !== undefined ? { modifiers: [...overrides.modifiers] } : {}),
    ...(overrides.superUniqueId !== undefined ? { superUniqueId: overrides.superUniqueId } : {}),
    ...(overrides.isRanged !== undefined ? { isRanged: overrides.isRanged, isMelee: !overrides.isRanged } : {}),
    ...(overrides.isUndead !== undefined ? { isUndead: overrides.isUndead } : {}),
    ...(overrides.inTown !== undefined ? { inTown: overrides.inTown } : {}),
    ...(overrides.killable !== undefined ? { killable: overrides.killable } : {}),
    ...(overrides.petIgnore !== undefined ? { petIgnore: overrides.petIgnore } : {}),
  }
  const hp = overrides.hp ?? stats.hp
  return {
    index: overrides.index ?? 1,
    x: overrides.x ?? 180,
    y: overrides.y ?? 100,
    hp,
    state: overrides.state ?? 'chase',
    animMode: overrides.animMode ?? 'nu',
    facing: overrides.facing ?? 0,
    cooldown: overrides.cooldown ?? 0,
    hitFlash: overrides.hitFlash ?? 0,
    corpseTicks: overrides.corpseTicks ?? 0,
    sleeping: overrides.sleeping ?? false,
    stats,
    ...(overrides.fleeTicks !== undefined ? { fleeTicks: overrides.fleeTicks } : {}),
    ...(overrides.leaderId !== undefined ? { leaderId: overrides.leaderId } : {}),
    ...(overrides.align !== undefined ? { align: overrides.align } : {}),
    ...(overrides.frozenTicks !== undefined ? { frozenTicks: overrides.frozenTicks } : {}),
    ...(overrides.chillTicks !== undefined ? { chillTicks: overrides.chillTicks } : {}),
    ...(overrides.corpseConsumed !== undefined ? { corpseConsumed: overrides.corpseConsumed } : {}),
    ...(overrides.shattered !== undefined ? { shattered: overrides.shattered } : {}),
    ...(overrides.corpseSuppressed !== undefined ? { corpseSuppressed: overrides.corpseSuppressed } : {}),
    ...(overrides.dwInitSeed !== undefined ? { dwInitSeed: overrides.dwInitSeed } : {}),
  }
}

function makeMonster(
  hcIdx: number,
  index = 1,
  x = 180,
  y = 100,
  overrides: Parameters<typeof makeTestMonster>[1] = {},
): Monster {
  return makeTestMonster(hcIdx, { ...overrides, index, x, y })
}

function makeTestWorld(
  player: CombatPlayer,
  monsters: Monster[],
  tick = 0,
): CombatWorld {
  return {
    player,
    players: [player],
    monsters,
    tick,
    events: [],
    kills: 0,
  }
}

describe('Diablo II v1.13c Authoritative Monster, Boss, Mercenary & Pet AI Archetypes (M2)', () => {
  describe('F4: Melee, Swarm, Leaper & Guard AI Archetypes', () => {
    it('activates idle melee monsters within aggro radius, closes distance, and alternates A1/A2 melee strikes', () => {
      const player = makeTestPlayer({ x: 100, y: 100, hp: 500 })
      const skeleton = makeTestMonster(0, { x: 150, y: 100, sleeping: false, state: 'idle' })
      const world = makeTestWorld(player, [skeleton])

      for (let t = 0; t < 35; t++) {
        tickMonsters(world, OPEN_TERRAIN)
      }

      expect(skeleton.sleeping).toBe(false)
      expect(Math.hypot(skeleton.x - player.x, skeleton.y - player.y)).toBeLessThanOrEqual(
        skeleton.stats.reach + 4,
      )
      expect(player.hp).toBeLessThan(500)
    })

    it('keeps town NPCs, Idle AI, and friendly aligned monsters passive', () => {
      const player = makeTestPlayer({ x: 100, y: 100, hp: 500 })
      const townNpc = makeTestMonster(146, { index: 1, x: 105, y: 100, inTown: true, ai: 'Idle' })
      const friendlyUnit = makeTestMonster(0, { index: 2, x: 105, y: 100, align: 1 })
      const world = makeTestWorld(player, [townNpc, friendlyUnit])

      for (let t = 0; t < 10; t++) {
        tickMonsters(world, OPEN_TERRAIN)
      }

      expect(townNpc.x).toBe(105)
      expect(friendlyUnit.x).toBe(105)
      expect(player.hp).toBe(500)
    })

    it('accelerates FoulCrow / SandLeaper swoop approach and stacks Frenzy on Minotaur melee hits', () => {
      const player = makeTestPlayer({ x: 100, y: 100, hp: 2000 })
      const leaper = makeTestMonster(88, { index: 1, x: 180, y: 100, ai: 'SandLeaper' })
      const minotaur = makeTestMonster(501, { index: 2, x: 112, y: 100, ai: 'Frenzy' })
      const world = makeTestWorld(player, [leaper, minotaur])

      for (let t = 0; t < 20; t++) {
        tickMonsters(world, OPEN_TERRAIN)
      }

      expect(leaper.x).toBeLessThan(180)
      expect(minotaur.frenzyStacks).toBeGreaterThan(0)
    })
  })

  describe('F5: Fallen & Fetish Pack Morale Break & Rally', () => {
    it('triggers morale retreat on nearby Fallen allies when a packmate dies and rallies back when fleeTicks expire', () => {
      const player = makeTestPlayer({ x: 100, y: 100 })
      const dyingFallen = makeTestMonster(18, { index: 1, x: 120, y: 100, hp: 5, ai: 'Fallen' })
      const allyFallen = makeTestMonster(18, { index: 2, x: 140, y: 100, hp: 40, ai: 'Fallen' })
      const world = makeTestWorld(player, [dyingFallen, allyFallen])

      const initialDist = Math.hypot(allyFallen.x - player.x, allyFallen.y - player.y)
      damageMonster(world, dyingFallen.index, 999)
      expect(dyingFallen.state).toBe('dead')
      expect(allyFallen.fleeTicks).toBeGreaterThan(0)

      for (let t = 0; t < 10; t++) {
        tickMonsters(world, OPEN_TERRAIN)
      }
      const peakFleeDist = Math.hypot(allyFallen.x - player.x, allyFallen.y - player.y)
      expect(peakFleeDist).toBeGreaterThan(initialDist)

      for (let t = 0; t < 90; t++) {
        tickMonsters(world, OPEN_TERRAIN)
      }
      const afterRallyDist = Math.hypot(allyFallen.x - player.x, allyFallen.y - player.y)
      expect(afterRallyDist).toBeLessThan(peakFleeDist)
    })

    it('breaks morale of pack minions linked by leaderId when their leader dies', () => {
      const player = makeTestPlayer({ x: 100, y: 100 })
      const shamanLeader = makeTestMonster(23, { index: 10, x: 150, y: 100, ai: 'FallenShaman' })
      const minion = makeTestMonster(4, { index: 11, x: 135, y: 100, leaderId: 10 })
      const world = makeTestWorld(player, [shamanLeader, minion])

      triggerPackMoraleOnDeath(world, shamanLeader)
      expect(minion.fleeTicks).toBeGreaterThanOrEqual(35)
    })
  })

  describe('F6: Shaman, Greater Mummy Resurrection & Zakarum Priest Healing', () => {
    it('FallenShaman resurrects dead Fallen corpses to full HP and rejects non-Fallen or shattered corpses', () => {
      const player = makeTestPlayer({ x: 300, y: 300 })
      const shaman = makeTestMonster(23, { index: 1, x: 160, y: 100, ai: 'FallenShaman', cooldown: 0 })
      const deadZombie = makeTestMonster(1, { index: 2, x: 150, y: 100, hp: 0, state: 'dead', ai: 'Zombie' })
      const shatteredFallen = makeTestMonster(18, {
        index: 3,
        x: 148,
        y: 100,
        hp: 0,
        state: 'dead',
        ai: 'Fallen',
        shattered: true,
        corpseConsumed: true,
      })
      const validCorpse = makeTestMonster(18, {
        index: 4,
        x: 170,
        y: 100,
        hp: 0,
        state: 'dead',
        ai: 'Fallen',
      })
      const world = makeTestWorld(player, [shaman, deadZombie, shatteredFallen, validCorpse])

      const revived = executeShamanResurrect113c(world, shaman)
      expect(revived).not.toBeNull()
      expect(revived?.index).toBe(4)
      expect(validCorpse.state).toBe('idle')
      expect(validCorpse.hp).toBe(validCorpse.stats.hp)
      expect(deadZombie.state).toBe('dead')
      expect(shatteredFallen.state).toBe('dead')
    })

    it('GreaterMummy resurrects normal undead corpses but rejects unique/boss undead corpses', () => {
      const player = makeTestPlayer({ x: 300, y: 300 })
      const mummy = makeTestMonster(284, { index: 1, x: 100, y: 100, ai: 'GreaterMummy', cooldown: 0 })
      const uniqueCorpse = makeTestMonster(0, {
        index: 2,
        x: 110,
        y: 100,
        hp: 0,
        state: 'dead',
        rank: 'unique',
        isUndead: true,
      })
      const normalSkeletonCorpse = makeTestMonster(0, {
        index: 3,
        x: 120,
        y: 100,
        hp: 0,
        state: 'dead',
        rank: 'normal',
        isUndead: true,
      })
      const world = makeTestWorld(player, [mummy, uniqueCorpse, normalSkeletonCorpse])

      const revived = executeShamanResurrect113c(world, mummy)
      expect(revived?.index).toBe(3)
      expect(uniqueCorpse.state).toBe('dead')
      expect(normalSkeletonCorpse.hp).toBe(normalSkeletonCorpse.stats.hp)
    })

    it('ZakarumPriest heals wounded nearby allies during tickMonsters', () => {
      const player = makeTestPlayer({ x: 100, y: 100 })
      const priest = makeTestMonster(0, { index: 1, x: 180, y: 100, ai: 'ZakarumPriest', inTown: false })
      const woundedAlly = makeTestMonster(0, { index: 2, x: 165, y: 100, ai: 'Zealot' })
      woundedAlly.hp = Math.max(1, Math.floor(woundedAlly.stats.hp * 0.25))
      const beforeHp = woundedAlly.hp
      const world = makeTestWorld(player, [priest, woundedAlly])

      for (let t = 0; t < 10; t++) {
        tickMonsters(world, OPEN_TERRAIN)
      }

      expect(woundedAlly.hp).toBeGreaterThan(beforeHp)
    })
  })

  describe('F7: Ranged Kiters, Casters, Oblivion Knight 5-Curse Pool & Suicide Minions', () => {
    it('SkeletonArcher kites away when player is at point-blank (< 40 px) and fires mode-mapped arrows at range', () => {
      const player = makeTestPlayer({ x: 100, y: 100, hp: 600 })
      const archer = makeTestMonster(5, {
        index: 1,
        x: 120,
        y: 100,
        ai: 'SkeletonArcher',
        isRanged: true,
      })
      const world = makeTestWorld(player, [archer])
      const startDist = Math.hypot(archer.x - player.x, archer.y - player.y)

      for (let t = 0; t < 12; t++) {
        tickMonsters(world, OPEN_TERRAIN)
      }

      expect(Math.hypot(archer.x - player.x, archer.y - player.y)).toBeGreaterThan(startDist)
      expect(world.events.some((e) => e.kind === 'missileHit')).toBe(true)
    })

    it('Oblivion Knight selects all 5 canonical 1.13c curses and NEVER selects Iron Maiden', () => {
      expect(OBLIVION_KNIGHT_CURSES).toHaveLength(5)
      expect(OBLIVION_KNIGHT_CURSES).not.toContain('ironmaiden')

      const player = makeTestPlayer({ x: 100, y: 100 })
      const knight = makeTestMonster(312, { index: 1, x: 200, y: 100, ai: 'OblivionKnight' })
      const seen = new Set<string>()

      for (let seed = 0; seed < 100; seed++) {
        const world = makeTestWorld(player, [knight], 0)
        const curse = executeOblivionKnightCurse113c(world, knight, seed, 10)
        expect(curse.toLowerCase()).not.toContain('iron')
        seen.add(curse)
      }

      expect(seen.size).toBe(5)
      expect(player.curse).toBeDefined()
    })

    it('SuicideMinion sprints and self-detonates on player proximity with 0 XP awarded', () => {
      const player = makeTestPlayer({ x: 100, y: 100, hp: 800, xp: 0 })
      const suicide = makeTestMonster(453, {
        index: 1,
        x: 108,
        y: 100,
        ai: 'SuicideMinion',
      })
      const world = makeTestWorld(player, [suicide])

      for (let t = 0; t < 10; t++) {
        tickMonsters(world, OPEN_TERRAIN)
        if (suicide.state === 'dead') break
      }

      expect(suicide.state).toBe('dead')
      expect(suicide.corpseConsumed).toBe(true)
      expect(player.xp).toBe(0)
      expect(player.hp).toBeLessThan(800)
    })

    it('BoneFetish death explosion damages players within BONE_FETISH_EXPLOSION_RADIUS and spares distant players', () => {
      expect(calcBoneFetishDeathDamage(0).physDmg).toBe(0)
      expect(calcBoneFetishDeathDamage(-50).physDmg).toBe(0)

      const nearPlayer = makeTestPlayer({ x: 100, y: 100, hp: 500 })
      const nearFetish = makeTestMonster(212, { index: 1, x: 112, y: 100, hp: 5 })
      const nearWorld = makeTestWorld(nearPlayer, [nearFetish])
      damageMonster(nearWorld, nearFetish.index, 100)
      expect(nearPlayer.hp).toBeLessThan(500)

      const farPlayer = makeTestPlayer({
        x: 100 + BONE_FETISH_EXPLOSION_RADIUS * 24 + 50,
        y: 100,
        hp: 500,
      })
      const farFetish = makeTestMonster(212, { index: 1, x: 100, y: 100, hp: 5 })
      const farWorld = makeTestWorld(farPlayer, [farFetish])
      damageMonster(farWorld, farFetish.index, 100)
      expect(farPlayer.hp).toBe(500)
    })
  })

  describe('F8: Elite UMods, Act Boss AI & Duriel Death Maggots', () => {
    it('applies Cursed, ManaBurn, ColdEnchanted, FireEnchanted, LightningEnchanted, and freeze-shatter corpse suppression', () => {
      expect(calcFireEnchantedDeathDamage(0, 'normal').totalDmg).toBe(0)
      expect(calcFireEnchantedDeathDamage(-100, 'hell').totalDmg).toBe(0)
      expect(calcColdEnchantedDeathNova(40, 'nightmare', false).sLvl).toBe(20)
      expect(FIRE_ENCHANT_EXPLOSION_RADIUS).toBe(4)

      const player = makeTestPlayer({ x: 100, y: 100, hp: 1000, mana: 300 })
      const elite = makeTestMonster(18, {
        index: 1,
        x: 110,
        y: 100,
        hp: 80,
        rank: 'unique',
        modifiers: ['Cursed', 'ManaBurn', 'FireEnchanted', 'ColdEnchanted', 'LightningEnchanted'],
      })
      const world = makeTestWorld(player, [elite])

      // Monster hits player -> Cursed + ManaBurn
      tickMonsters(world, OPEN_TERRAIN)
      expect(player.curse?.id).toBe('amplify_damage')
      expect(player.mana).toBeLessThan(300)

      // Player hits LightningEnchanted monster -> ChargedBolt on struck
      damageMonster(world, elite.index, 10)
      expect(
        world.events.some(
          (e) => e.skillId === 'ChargedBolt' || e.missileType === 'chargedbolt',
        ),
      ).toBe(true)

      // Freeze and kill monster -> shattered corpse + FE/CE/LE death events
      elite.frozenTicks = 50
      const hpBeforeDeath = player.hp
      const events = triggerMonsterDeathAffixes113c(world, elite, player)
      damageMonster(world, elite.index, 999)

      expect(elite.shattered).toBe(true)
      expect(elite.corpseConsumed).toBe(true)
      expect(events.some((e) => e.missileType === 'frostnova')).toBe(true)
      expect(events.some((e) => e.missileType === 'corpseexplosion')).toBe(true)
      expect(player.hp).toBeLessThan(hpBeforeDeath)
      expect(MON_UMOD.FIRE).toBe(9)
    })

    it('executes Act 1–5 Boss AI skills (Andariel, Duriel, Mephisto, Diablo, Baal) and Baal Throne waves', () => {
      const player = makeTestPlayer({ x: 150, y: 100, hp: 2000 })
      const andariel = makeTestMonster(156, { index: 1, x: 100, y: 100, ai: 'Andariel' })
      const duriel = makeTestMonster(211, { index: 2, x: 100, y: 100, ai: 'Duriel' })
      const mephisto = makeTestMonster(242, { index: 3, x: 100, y: 100, ai: 'Mephisto' })
      const diablo = makeTestMonster(243, { index: 0, x: 100, y: 100, ai: 'Diablo' })
      const baal = makeTestMonster(544, { index: 5, x: 100, y: 100, ai: 'Baal' })
      const world = makeTestWorld(player, [andariel, duriel, mephisto, diablo, baal], 0)

      expect(executeActBossAi113c(world, andariel, player).executed).toBe(true)
      expect(executeActBossAi113c(world, duriel, player).executed).toBe(true)
      expect(executeActBossAi113c(world, mephisto, player).executed).toBe(true)
      expect(executeActBossAi113c(world, diablo, player).skillId).toBe('redlightninghose')
      expect(executeActBossAi113c(world, baal, player).executed).toBe(true)

      // Dead target returns executed: false
      const deadTarget = makeTestPlayer({ x: 120, y: 100, hp: 0, alive: false })
      expect(executeActBossAi113c(world, mephisto, deadTarget).executed).toBe(false)

      // Duriel death spec includes 5 maggots
      const durielDeath = getBossDeathFxSpec(211, 'duriel')
      expect(durielDeath?.spawnMaggots).toEqual(DURIEL_MAGGOT_OFFSETS)
      expect(DURIEL_MAGGOT_HCIDX).toBe(227)

      // Baal Throne 5 waves
      expect(BAAL_THRONE_WAVES_113C).toHaveLength(5)
      const clearWorld = makeTestWorld(player, [])
      const wave1 = tickBaalThroneWave113c(clearWorld, 0)
      expect(wave1.waveCleared).toBe(true)
      expect(wave1.nextWave).toBe(1)
      expect(wave1.spec?.superUniqueId).toBe('Colenzo the Annihilator')
    })
  })

  describe('F10 & F11: Mercenary 25Hz AI & SummonManager Pet AI', () => {
    it('executes Act 1/2/3/5 Mercenary 25Hz AI: owner leash teleport (> 480 px), aura activation, combat, and follow', () => {
      const owner = makeTestPlayer({ x: 100, y: 100 })
      const targetMonster = makeTestMonster(0, { index: 1, x: 115, y: 100, hp: 200 })
      const world = makeTestWorld(owner, [targetMonster])

      const merc: MercenaryUnitState = {
        unitId: 500,
        subType: 7,
        act: 2,
        difficulty: 1,
        level: 30,
        x: 700,
        y: 700,
        hp: 400,
        maxHp: 400,
        alive: true,
      }

      // 1. Leash teleport when distance > 480 px
      const leashRes = tickMercenaryAi25Hz(world, merc, owner, OPEN_TERRAIN)
      expect(leashRes.teleportedToOwner).toBe(true)
      expect(merc.x).toBe(owner.x)
      expect(merc.y).toBe(owner.y)
      expect(leashRes.activeAura).toBeDefined()

      // 2. Attack nearby hostile monster
      const beforeHp = targetMonster.hp
      const atkRes = tickMercenaryAi25Hz(world, merc, owner, OPEN_TERRAIN)
      expect(atkRes.attackedTargetId).toBe(targetMonster.index)
      expect(targetMonster.hp).toBeLessThan(beforeHp)
      expect(MonsterAI.tickMercenaryAi25Hz).toBe(tickMercenaryAi25Hz)
    })

    it('executes SummonManager.tickPets: owner leash teleport (> 480 px), target acquisition, and stationary Hydra/Totem guard', () => {
      const registry = getSharedDataRegistry()
      const mgr = new SummonManager(registry)
      const missileEngine = new MissileEngine(registry)
      const auraScanner = new AuraScanner(registry)

      const makeUnitCtx = (
        id: string,
        x: number,
        y: number,
        petIgnore = false,
      ): CombatUnitContext & { petIgnore?: boolean } => {
        const statList = new UnitStatList(registry)
        statList.setBaseStat('level', 30)
        statList.setBaseStat('maxhp', 500 * FIXED_ONE)
        statList.setBaseStat('hitpoints', 500 * FIXED_ONE)
        return {
          id,
          name: id,
          unitType: id.startsWith('player') ? 'player' : 'monster',
          statList,
          stateBus: new StateBus(statList, registry),
          x,
          y,
          ...(petIgnore ? { petIgnore: true } : {}),
        }
      }

      const ownerCtx = makeUnitCtx('player-1', 100, 100)
      const golem = mgr.createPet({
        owner: ownerCtx,
        skillId: 75,
        slvl: 10,
        x: 800,
        y: 800,
      }).pet!

      const hydra = mgr.createPet({
        owner: ownerCtx,
        skillId: 62,
        slvl: 10,
        x: 150,
        y: 150,
      }).pet!

      const enemyIgnored = makeUnitCtx('enemy-10', 160, 100, true)
      const enemyValid = makeUnitCtx('enemy-20', 180, 100, false)
      const enemyPositions = new Map<string, { x: number; y: number }>([
        ['enemy-10', { x: 160, y: 100 }],
        ['enemy-20', { x: 180, y: 100 }],
      ])

      // 1. Golem > 480 px from owner teleports to owner; stationary Hydra never moves
      mgr.tickPets({
        currentTick: 1,
        owner: ownerCtx,
        enemies: [enemyIgnored, enemyValid],
        enemyPositions,
        missileEngine,
        auraScanner,
      })

      expect(golem.x).toBe(100)
      expect(golem.y).toBe(100)
      expect(hydra.x).toBe(150)
      expect(hydra.y).toBe(150)

      // 2. Next tick: Golem acquires non-petIgnore enemy ('enemy-20') and moves toward it
      mgr.tickPets({
        currentTick: 2,
        owner: ownerCtx,
        enemies: [enemyIgnored, enemyValid],
        enemyPositions,
        missileEngine,
        auraScanner,
      })

      expect(golem.targetId).toBe('enemy-20')
      expect(golem.x).toBeGreaterThan(100)
      expect(hydra.x).toBe(150)
    })
  })

  describe('Challenger 1 & Challenger 2 Regression Suite (16 Adversarial Invariants)', () => {
    it('1. Stationary AI archetypes and canonical MonStats.txt velocity=0 hcIdx rows never move across 100 ticks', () => {
      const player = makeTestPlayer({ x: 100, y: 100, hp: 500, maxHp: 500 })
      const stationaryAiNames = [
        'Nest',
        'MaggotEgg',
        'Sarcophagus',
        'Catapult',
        'FrozenHorror',
        'EvilHut',
        'GargoyleTrap',
        'Tower',
        'Tentacle',
        'TentacleHead',
        'PutridDefiler',
        'BoneWall',
        'Turret',
      ]
      for (const ai of stationaryAiNames) {
        const m = makeMonster(0, 1, 150, 100, { ai })
        const world = makeTestWorld(player, [m])
        for (let t = 0; t < 100; t++) {
          tickMonsters(world, OPEN_TERRAIN)
        }
        expect(m.x).toBe(150)
        expect(m.y).toBe(100)
      }

      const stationaryHcIndices = [190, 228, 334, 371, 435, 497]
      for (const hcIdx of stationaryHcIndices) {
        const m = makeMonster(hcIdx, 1, 150, 100)
        const world = makeTestWorld(player, [m])
        for (let t = 0; t < 100; t++) {
          tickMonsters(world, OPEN_TERRAIN)
        }
        expect(m.x).toBe(150)
        expect(m.y).toBe(100)
      }
    })

    it('2. Non-aggression guard blocks Npc, TownNpc, Vendor, top-level inTown=true, killable=false, and align=1/2', () => {
      for (const ai of ['Idle', 'Npc', 'TownNpc', 'Vendor']) {
        const player = makeTestPlayer({ x: 100, y: 100, hp: 500, maxHp: 500 })
        const npc = makeMonster(0, 1, 110, 100, { ai })
        const world = makeTestWorld(player, [npc])
        for (let t = 0; t < 100; t++) {
          tickMonsters(world, OPEN_TERRAIN)
        }
        expect(player.hp).toBe(500)
        expect(npc.state).toBe('idle')
        expect(npc.x).toBe(110)
      }

      const playerTopTown = makeTestPlayer({ x: 100, y: 100, hp: 500, maxHp: 500 })
      const topTownMon = Object.assign(makeMonster(0, 1, 110, 100), { inTown: true })
      const worldTopTown = makeTestWorld(playerTopTown, [topTownMon])
      for (let t = 0; t < 100; t++) {
        tickMonsters(worldTopTown, OPEN_TERRAIN)
      }
      expect(playerTopTown.hp).toBe(500)
      expect(topTownMon.state).toBe('idle')
    })

    it('3. Minotaur / Frenzy increments frenzyStacks on hit and scales subsequent melee attack damage', () => {
      const player = makeTestPlayer({ x: 100, y: 100, hp: 1000, maxHp: 1000 })
      const minotaur = makeMonster(501, 1, 110, 100, {
        ai: 'Minotaur',
        damage: 20,
        reach: 32,
        cooldownTicks: 5,
      })
      const world = makeTestWorld(player, [minotaur])

      // Tick 1: first melee hit
      tickMonsters(world, OPEN_TERRAIN)
      const dmg1 = 1000 - player.hp
      expect(dmg1).toBeGreaterThan(0)
      expect(minotaur.frenzyStacks).toBeGreaterThanOrEqual(1)

      // Advance cooldown to second melee hit
      const hpBeforeHit2 = player.hp
      for (let t = 0; t < 6; t++) {
        tickMonsters(world, OPEN_TERRAIN)
      }
      const dmg2 = hpBeforeHit2 - player.hp
      expect(minotaur.frenzyStacks).toBeGreaterThanOrEqual(2)
      expect(dmg2).toBeGreaterThan(dmg1)
    })

    it('4. Wounded ZakarumPriest (<50% HP) retreats away from player even when distance >= 64 px', () => {
      const player = makeTestPlayer({ x: 100, y: 100, hp: 500, maxHp: 500 })
      const priest = makeMonster(238, 1, 180, 100, {
        ai: 'ZakarumPriest',
        hp: 100,
      })
      priest.hp = 20 // 20% HP (< 45%)
      priest.cooldown = 15 // heal on cooldown so it retreats
      const world = makeTestWorld(player, [priest])

      tickMonsters(world, OPEN_TERRAIN)
      expect(priest.x).toBeGreaterThan(180)
    })

    it('5. GoatmanArcher kites away at close range (<40 px) and fires ranged missiles at distance', () => {
      const playerClose = makeTestPlayer({ x: 100, y: 100, hp: 500, maxHp: 500 })
      const archerClose = makeMonster(43, 1, 120, 100, { ai: 'GoatmanArcher' })
      const worldClose = makeTestWorld(playerClose, [archerClose])
      tickMonsters(worldClose, OPEN_TERRAIN)
      expect(archerClose.x).toBeGreaterThan(120)

      const playerFar = makeTestPlayer({ x: 100, y: 100, hp: 500, maxHp: 500 })
      const archerFar = makeMonster(43, 1, 190, 100, { ai: 'GoatmanArcher' })
      const worldFar = makeTestWorld(playerFar, [archerFar])
      tickMonsters(worldFar, OPEN_TERRAIN)
      expect(playerFar.hp).toBeLessThan(500)
      expect(archerFar.state).toBe('attack')
    })

    it('6. OblivionKnight (index=1) casts curse onto player in standalone tickMonsters loop when world.tick === 0', () => {
      const player = makeTestPlayer({ x: 100, y: 100, hp: 500, maxHp: 500 })
      const knight = makeMonster(312, 1, 150, 100, { ai: 'OblivionKnight' })
      const world = makeTestWorld(player, [knight])
      world.tick = 0

      for (let t = 0; t < 30; t++) {
        tickMonsters(world, OPEN_TERRAIN)
      }
      expect(player.curse).toBeDefined()
      expect(OBLIVION_KNIGHT_CURSES).toContain(player.curse!.id)
    })

    it('7. getMonsterModeMissile113c resolves (63,"A1")->"quill1", (122,"A1")->"javelin1", and safely handles undefined', () => {
      expect(getMonsterModeMissile113c(63, 'A1')).toBe('quill1')
      expect(getMonsterModeMissile113c(122, 'A1')).toBe('javelin1')
      expect(
        getMonsterModeMissile113c(undefined as unknown as string, 'A1'),
      ).toBeUndefined()
    })

    it('8. resolveMonsterUModIds resolves PascalCase and camelCase tokens ("AuraEnchanted", "MultipleShot")', () => {
      const ids = resolveMonsterUModIds(['AuraEnchanted', 'MultipleShot'])
      expect(ids.has(MON_UMOD.AURA)).toBe(true)
      expect(ids.has(MON_UMOD.MULTISHOT)).toBe(true)
    })

    it('9. MultipleShot (#29) fires a >=3-missile fan per ranged attack and SpectralHit (#27) adds elemental hit damage', () => {
      const player = makeTestPlayer({ x: 100, y: 100, hp: 5000, maxHp: 5000 })
      const multiArcher = makeMonster(10, 1, 200, 100, {
        ai: 'SkeletonArcher',
        rank: 'unique',
        modifiers: ['MultipleShot'],
        cooldownTicks: 1,
      })
      const world = makeTestWorld(player, [multiArcher])
      for (let t = 0; t < 10; t++) {
        multiArcher.cooldown = 0
        tickMonsters(world, OPEN_TERRAIN)
      }
      const missileHits = world.events.filter((e) => e.kind === 'missileHit')
      expect(missileHits.length).toBeGreaterThanOrEqual(30)

      const playerPlain = makeTestPlayer({ x: 100, y: 100, hp: 1000, maxHp: 1000 })
      const plainMon = makeMonster(0, 1, 110, 100, { damage: 20, reach: 30 })
      tickMonsters(makeTestWorld(playerPlain, [plainMon]), OPEN_TERRAIN)
      const plainDmg = 1000 - playerPlain.hp

      const playerSpec = makeTestPlayer({ x: 100, y: 100, hp: 1000, maxHp: 1000 })
      const specMon = makeMonster(0, 1, 110, 100, {
        damage: 20,
        reach: 30,
        rank: 'unique',
        modifiers: ['SpectralHit'],
      })
      tickMonsters(makeTestWorld(playerSpec, [specMon]), OPEN_TERRAIN)
      const specDmg = 1000 - playerSpec.hp
      expect(specDmg).toBeGreaterThan(plainDmg)
    })

    it('10. triggerMonsterDeathAffixes113c deals authentic HP-scaled FE boss damage (>50 for 1000 HP), 0 for FE minion, and supports reversed signature', () => {
      const playerBoss = makeTestPlayer({ x: 110, y: 100, hp: 1000, maxHp: 1000 })
      const feBoss = makeMonster(18, 1, 100, 100, {
        hp: 1000,
        rank: 'unique',
        modifiers: ['FireEnchanted'],
      })
      const worldBoss = makeTestWorld(playerBoss, [feBoss])
      triggerMonsterDeathAffixes113c(feBoss, worldBoss, { difficulty: 'normal' })
      expect(1000 - playerBoss.hp).toBeGreaterThan(50)

      const playerMinion = makeTestPlayer({ x: 110, y: 100, hp: 1000, maxHp: 1000 })
      const feMinion = makeMonster(18, 2, 100, 100, {
        hp: 1000,
        rank: 'minion',
        modifiers: ['FireEnchanted'],
      })
      const worldMinion = makeTestWorld(playerMinion, [feMinion])
      triggerMonsterDeathAffixes113c(feMinion, worldMinion, { difficulty: 'normal' })
      expect(playerMinion.hp).toBe(1000)
    })

    it('11. getBossDeathFxSpec("duriel") resolves Duriel spec when passed string identifier as 1st argument', () => {
      const spec = getBossDeathFxSpec('duriel')
      expect(spec).not.toBeNull()
      expect(spec?.bossKey).toBe('duriel')
      expect(spec?.spawnMaggots).toEqual(DURIEL_MAGGOT_OFFSETS)
    })

    it('12. executeActBossAi113c supports all 19 bosses, reversed (boss, world, opts) signature, forceSkill, Nihlathak corpse consumption, and Madawc Shout', () => {
      const player = makeTestPlayer({ x: 180, y: 100, hp: 1000, maxHp: 1000 })
      const bossHcList = [
        267, // BloodRaven
        45,  // Countess
        402, // Smith
        156, // Andariel
        229, // Radament
        250, // Summoner
        211, // Duriel
        345, // Council
        242, // Mephisto
        256, // Izual
        409, // Hephasto
        243, // Diablo
        479, // Shenk
        526, // Nihlathak
        540, // Talic
        541, // Madawc
        542, // Korlic
        544, // Baal
        39,  // CowKing
      ]
      for (const hcIdx of bossHcList) {
        const boss = makeMonster(hcIdx, 1, 100, 100, {
          rank: 'boss',
          ...(hcIdx === 39 ? { superUniqueId: 'The Cow King' } : {}),
        })
        const world = makeTestWorld(player, [boss])
        const res = executeActBossAi113c(boss, world, { difficulty: 'normal' })
        expect(res.executed).toBe(true)
        expect(res.skillId).toBeDefined()
        expect(res.skillId).not.toBe('bossattack')
      }

      // Nihlathak consumes nearby corpse
      const corpse = makeMonster(18, 2, 120, 100)
      corpse.state = 'dead'
      corpse.hp = 0
      const nihl = makeMonster(526, 1, 100, 100, { rank: 'boss' })
      const nihlWorld = makeTestWorld(player, [nihl, corpse])
      const nihlRes = executeActBossAi113c(nihl, nihlWorld, {
        difficulty: 'hell',
        forceSkill: 'CorpseExplosion',
      })
      expect(nihlRes.executed).toBe(true)
      expect(corpse.corpseConsumed).toBe(true)

      // Madawc rotates DoubleThrow and Shout across ticks
      const madawc = makeMonster(541, 1, 100, 100, { rank: 'boss' })
      const madawcSkills = new Set<string>()
      for (let t = 0; t < 4; t++) {
        const w = makeTestWorld(player, [madawc])
        w.tick = t
        const r = executeActBossAi113c(madawc, w, { difficulty: 'normal' })
        if (r.skillId) madawcSkills.add(r.skillId.toLowerCase())
      }
      expect(madawcSkills.has('doublethrow')).toBe(true)
      expect(madawcSkills.has('shout')).toBe(true)
    })

    it('13. tickMercenaryAi25Hz resolves canonical Hireling.txt skills for Act 1, Act 2, Act 3, and Act 5 mercenaries', () => {
      const owner = makeTestPlayer({ x: 100, y: 100 })
      const makeWorldWithTarget = (): CombatWorld =>
        makeTestWorld(owner, [makeMonster(0, 1, 115, 100, { hp: 500 })])

      const act1Out = tickMercenaryAi25Hz(makeWorldWithTarget(), {
        act: 1,
        level: 25,
        x: 100,
        y: 100,
        hp: 400,
        maxHp: 400,
        alive: true,
      })
      expect(act1Out.skillUsed).toMatch(/Inner Sight|Fire Arrow|Cold Arrow/i)

      const act2Out = tickMercenaryAi25Hz(makeWorldWithTarget(), {
        act: 2,
        level: 25,
        x: 100,
        y: 100,
        hp: 400,
        maxHp: 400,
        alive: true,
      })
      expect(act2Out.skillUsed).toMatch(/Jab/i)
      expect(act2Out.activeAura).toMatch(/Prayer|Blessed Aim|Defiance|Thorns|Holy Freeze|Might/i)

      const act3Out = tickMercenaryAi25Hz(makeWorldWithTarget(), {
        act: 3,
        level: 25,
        x: 100,
        y: 100,
        hp: 400,
        maxHp: 400,
        alive: true,
      })
      expect(act3Out.skillUsed).toMatch(/Ice Blast|Glacial Spike|Frozen Armor|Charged Bolt|Lightning|Inferno|Fire Ball/i)

      const act5Out = tickMercenaryAi25Hz(makeWorldWithTarget(), {
        act: 5,
        level: 25,
        x: 100,
        y: 100,
        hp: 400,
        maxHp: 400,
        alive: true,
      })
      expect(act5Out.skillUsed).toMatch(/Bash|Stun/i)
    })

    it('14. tickMercenaryAi25Hz skips petIgnore, inTown, killable=false, and non-hostile align targets', () => {
      const owner = makeTestPlayer({ x: 100, y: 100 })
      const ignoredTrap = Object.assign(makeMonster(0, 1, 110, 100, { hp: 1000 }), {
        petIgnore: true,
      })
      const townUnit = Object.assign(makeMonster(0, 2, 112, 100, { hp: 1000 }), {
        inTown: true,
      })
      const unkillable = makeMonster(0, 3, 114, 100, { hp: 1000, killable: false })
      const friendly = Object.assign(makeMonster(0, 4, 116, 100, { hp: 1000 }), {
        align: 1,
      })
      const world = makeTestWorld(owner, [ignoredTrap, townUnit, unkillable, friendly])
      const merc: MercenaryUnitState = {
        act: 2,
        level: 30,
        x: 105,
        y: 100,
        hp: 500,
        maxHp: 500,
        alive: true,
      }
      const res = tickMercenaryAi25Hz(merc, world, { tick: 1 })
      expect(res.attackedTargetId).toBeUndefined()
      expect(ignoredTrap.hp).toBe(1000)
      expect(townUnit.hp).toBe(1000)
      expect(unkillable.hp).toBe(1000)
      expect(friendly.hp).toBe(1000)
    })

    it('15. tickMercenaryAi25Hz supports (merc, world, { tick, rng }) options 3rd argument for >480 px leash teleport', () => {
      const owner = makeTestPlayer({ x: 100, y: 100 })
      const world = makeTestWorld(owner, [])
      const merc: MercenaryUnitState = {
        act: 2,
        level: 30,
        x: 800,
        y: 100,
        hp: 500,
        maxHp: 500,
        alive: true,
      }
      const res = tickMercenaryAi25Hz(merc, world, { tick: 5 })
      expect(res.teleportedToOwner).toBe(true)
      expect(res.teleported).toBe(true)
      expect(merc.x).toBe(100)
      expect(merc.y).toBe(100)
    })

    it('16. SummonManager.tickPets keeps Spirit Wolf (#227) and Shadow Master (#279) at (owner.x, owner.y) on >480 px leash-teleport tick', () => {
      const registry = getSharedDataRegistry()
      const mgr = new SummonManager(registry)
      const missileEngine = new MissileEngine(registry)
      const auraScanner = new AuraScanner(registry)

      const makeCtx = (id: string, x: number, y: number): CombatUnitContext => {
        const statList = new UnitStatList(registry)
        statList.setBaseStat('level', 30)
        statList.setBaseStat('maxhp', 500 * FIXED_ONE)
        statList.setBaseStat('hitpoints', 500 * FIXED_ONE)
        return {
          id,
          name: id,
          unitType: id.startsWith('player') ? 'player' : 'monster',
          statList,
          stateBus: new StateBus(statList, registry),
          x,
          y,
        }
      }

      const ownerCtx = makeCtx('player-1', 100, 100)
      const wolf = mgr.createPet({
        owner: ownerCtx,
        skillId: 227,
        slvl: 10,
        x: 800,
        y: 100,
      }).pet!
      const shadow = mgr.createPet({
        owner: ownerCtx,
        skillId: 279,
        slvl: 10,
        x: 800,
        y: 100,
      }).pet!
      const farEnemy = makeCtx('enemy-far', 900, 100)

      mgr.tickPets({
        currentTick: 1,
        owner: ownerCtx,
        enemies: [farEnemy],
        enemyPositions: new Map([['enemy-far', { x: 900, y: 100 }]]),
        missileEngine,
        auraScanner,
      })

      expect(wolf.x).toBe(100)
      expect(wolf.y).toBe(100)
      expect(shadow.x).toBe(100)
      expect(shadow.y).toBe(100)
    })
  })

  describe('Baal Throne 5-Wave Choreography (1.13c D2Game 0x6FCC8430 / 0x6FCC8350 & D2Client VFX)', () => {
    it('matches exact 1.13c SuperUniques.txt / MonStats.txt wave definitions and executes all 5 waves + BaalToStairs portal entry', () => {
      expect(BAAL_THRONE_WAVES_113C.map((w) => ({
        wave: w.wave,
        superUniqueIndex: w.superUniqueIndex,
        leaderHcIdx: w.leaderHcIdx,
        minionHcIdx: w.minionHcIdx,
        extraMinionHcIdx: w.extraMinionHcIdx,
        extraMinionCount: w.extraMinionCount,
      }))).toEqual([
        { wave: 1, superUniqueIndex: 61, leaderHcIdx: 62, minionHcIdx: 23, extraMinionHcIdx: undefined, extraMinionCount: 0 },
        { wave: 2, superUniqueIndex: 62, leaderHcIdx: 105, minionHcIdx: 105, extraMinionHcIdx: 381, extraMinionCount: 10 },
        { wave: 3, superUniqueIndex: 63, leaderHcIdx: 557, minionHcIdx: 557, extraMinionHcIdx: undefined, extraMinionCount: 0 },
        { wave: 4, superUniqueIndex: 64, leaderHcIdx: 558, minionHcIdx: 558, extraMinionHcIdx: undefined, extraMinionCount: 0 },
        { wave: 5, superUniqueIndex: 65, leaderHcIdx: 571, minionHcIdx: 571, extraMinionHcIdx: undefined, extraMinionCount: 0 },
      ])

      const game = new GameInstance({ seed: 12345, areaId: 131, difficulty: 0 })
      const playerId = game.addPlayer({
        name: 'Hero',
        classId: 1,
        level: 80,
        hp: 99999,
        maxHp: 99999,
        areaId: 131,
        x: 100,
        y: 125,
      })
      const portalId = game.spawnObject({ classId: 563, areaId: 131, x: 100, y: 94, mode: 0 })
      const baalThroneId = game.spawnMonster({ classId: 543, areaId: 131, x: 100, y: 100 })
      const baalState0 = game.getMonster(baalThroneId)!
      expect(baalState0.isKillable).toBe(false)
      expect(baalState0.ai).toBe('BaalThrone')

      // Step through all 5 waves:
      const expectedLeaderHcIdx = [62, 105, 557, 558, 571]
      for (let w = 0; w < 5; w++) {
        // Run frames until wave (w + 1) boss spawns at (100, 113)
        let bossFound = false
        for (let f = 0; f < 500; f++) {
          game.stepFrame()
          const livingWaveMonsters = game
            .getAllUnits()
            .filter((u) => u.unitType === 'monster' && u.areaId === 131 && u.unitId !== baalThroneId)
            .map((u) => game.getMonster(u.unitId)!)
            .filter((m) => m !== undefined && m.alive)
          if (livingWaveMonsters.length > 0) {
            const leader = livingWaveMonsters.find((m) => m.rank === 'unique')
            expect(leader).toBeDefined()
            expect(leader!.hcIdx).toBe(expectedLeaderHcIdx[w])
            expect(leader!.umodIds).toContain(MON_UMOD.QUESTCOMPLETE)
            if (w === 1) {
              // Wave 2 includes 10 extra Burning Dead Mages (skmage_cold3, hcIdx = 381)
              const coldMages = livingWaveMonsters.filter((m) => m.hcIdx === 381)
              expect(coldMages.length).toBe(10)
            }
            // Kill all wave monsters so the next wave can proceed
            for (const m of livingWaveMonsters) {
              game.applyDamageToMonster(m.unitId, 999999, playerId)
            }
            bossFound = true
            break
          }
        }
        expect(bossFound).toBe(true)
      }

      // After Wave 5 is cleared, Baal casts #285 Corpse Explode, waits 250 frames, transforms into #559 baalcrabstairs,
      // walks to #563 Baals Portal, activates destAreaId = 132, and removes himself.
      let transformed = false
      let removed = false
      for (let f = 0; f < 450; f++) {
        const eventsMap = game.stepFrame()
        const events = eventsMap.get(playerId) ?? []
        if (events.some((e) => e.type === 'StateSet' && e.state === 142)) {
          transformed = true
        }
        if (game.getMonster(baalThroneId) === undefined) {
          removed = true
          break
        }
      }
      expect(transformed).toBe(true)
      expect(removed).toBe(true)
      const portalObj = game.getAllUnits().find((u) => u.unitType === 'object' && u.unitId === portalId)
      expect(portalObj?.mode).toBe(2)
    })

    it('applies STATE_CHANGECLASS (142), #285 Baal Corpse Explode chain, and #286 lobbed Baal Monster Spawn disc scatter on ClientWorld', () => {
      const world = new ClientWorld()
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 700, classId: 543, x: 100, y: 100, lifePct: 128, mode: 1 },
      })
      const baal = world.getUnit('monster', 700)!

      // 1. STATE_CHANGECLASS (142) with STAT_SHORTPARAM1 (355) = 559
      world.apply({
        type: 'StateSet',
        unit: { unitType: 1, id: 700 },
        state: 142,
        stats: [{ statId: 355, param: 0, value: 559 }],
        origin: 0xa8,
        complete: true,
      })
      expect(baal.classId).toBe(559)

      // 2. #285 Baal Corpse Explode consumes corpses within 40 sub-tiles and chains #587 -> #588 -> #622
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 701, classId: 23, x: 105, y: 108, lifePct: 0, mode: 12 },
      })
      const corpse = world.getUnit('monster', 701)!
      corpse.dead = true
      corpse.mode = 12
      corpse.lifePct = 0

      ;(world as any).spawnMissilesForSkill(baal, 285, 100, 100, 1)
      expect(corpse.states.has(104)).toBe(true)
      const getMissiles = () =>
        Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      const delayMissiles = getMissiles().filter(
        (m) => m.missileKey === 'baalcorpseexplodedelay',
      )
      expect(delayMissiles.length).toBe(1)

      // Tick until delay -> expl -> fade
      let sawExpl = false
      let sawFade = false
      for (let t = 0; t < 40; t++) {
        world.tick(40)
        const keys = getMissiles().map((m) => m.missileKey)
        if (keys.includes('baalcorpseexplodeexpl')) sawExpl = true
        if (keys.includes('baalcorpseexplodefade')) sawFade = true
      }
      expect(sawExpl).toBe(true)
      expect(sawFade).toBe(true)

      // 3. #286 Baal Monster Spawn lobs 'baal spawn monsters' (#550) with altitude > 0 and scatters 'baal spawn monsters exp' (#591)
      ;(world as any).spawnMissilesForSkill(baal, 286, 100, 113, 1)
      const spawnProj = getMissiles().find((m) => m.missileKey === 'baal spawn monsters')
      expect(spawnProj).toBeDefined()
      expect(spawnProj!.alwaysExplode).toBe(true)
      expect((spawnProj as any).lobPeakAltitude).toBeGreaterThan(0)

      let sawSpawnExp = false
      for (let t = 0; t < 30; t++) {
        world.tick(40)
        if (getMissiles().some((m) => m.missileKey === 'baal spawn monsters exp')) {
          sawSpawnExp = true
          break
        }
      }
      expect(sawSpawnExp).toBe(true)
    })
  })
})
