import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { SummonManager } from '../../src/server/ai/summon-manager.ts'
import { AuraScanner } from '../../src/server/engine/aura-scanner.ts'
import {
  executeSUnitDmg,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { MissileEngine } from '../../src/server/engine/missile-engine.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import { evaluateSkill113c, executeSkillCore113c } from '../../src/server/skills/registry.ts'

describe('Issue #1415 — Player/summon RollToHit and monster ToBlock parity (1.13c)', () => {
  const registry = getSharedDataRegistry()

  it('rolls 1.13c RollToHit (D2Game.dll 0x6FCFE2B0) for player normal attacks: AR=100 vs DEF=1000 hits ~9%, vs DEF=0 clamps to 95%', () => {
    const game = new GameInstance({ seed: 141501, difficulty: 0, areaId: 1 })
    const playerId = game.connectPlayer({
      name: 'TestAma',
      classId: 'ama',
      level: 10,
      ar: 100,
      x: 100,
      y: 100,
      areaId: 1,
    })

    // Defender level 10, AC=1000, ToBlock=0 -> floor(100*100/(100+1000)) = 9 -> 2*9*10/20 = 9%
    const highDefMonsterId = game.spawnMonster({
      defId: 'zombie1',
      level: 10,
      ac: 1000,
      toBlock: 0,
      hp: 1_000_000,
      maxHp: 1_000_000,
      x: 101,
      y: 100,
      areaId: 1,
      aiDisabled: true,
    })

    let hitsHighDef = 0
    const trials = 10_000
    for (let i = 0; i < trials; i++) {
      if (game.applyDamageToMonster(highDefMonsterId, 10, playerId, 0)) {
        hitsHighDef++
      }
    }
    const hitRateHighDef = hitsHighDef / trials
    expect(hitRateHighDef).toBeGreaterThanOrEqual(0.08)
    expect(hitRateHighDef).toBeLessThanOrEqual(0.10)

    // Defender level 10, AC=0, ToBlock=0 -> floor(100*100/100) = 100 -> clamped to 95%
    const zeroDefMonsterId = game.spawnMonster({
      defId: 'zombie1',
      level: 10,
      ac: 0,
      toBlock: 0,
      hp: 1_000_000,
      maxHp: 1_000_000,
      x: 102,
      y: 100,
      areaId: 1,
      aiDisabled: true,
    })

    let hitsZeroDef = 0
    for (let i = 0; i < trials; i++) {
      if (game.applyDamageToMonster(zeroDefMonsterId, 10, playerId, 0)) {
        hitsZeroDef++
      }
    }
    const hitRateZeroDef = hitsZeroDef / trials
    expect(hitRateZeroDef).toBeGreaterThanOrEqual(0.94)
    expect(hitRateZeroDef).toBeLessThanOrEqual(0.96)
  })

  it('computes player base AR from Dexterity * 5 - 35 + CharStats.ToHitFactor + equipped STAT_TOHIT(19) (D2Common.dll 0x6FD5D960)', () => {
    const game = new GameInstance({ seed: 141502, difficulty: 0, areaId: 1 })
    // Amazon: base Dex=25, ToHitFactor=5 -> base AR = 25*5 - 35 + 5 = 95
    const playerId = game.connectPlayer({
      name: 'DexAma',
      classId: 'ama',
      level: 10,
      dexterity: 25,
      x: 100,
      y: 100,
      areaId: 1,
    })
    const player = (game as unknown as { players: Map<number, unknown> }).players.get(playerId) as {
      items: Array<{ location: string; stats: Map<number, number> }>
    }
    const baseAr = (
      game as unknown as { computePlayerBaseToHit113c(p: unknown): number }
    ).computePlayerBaseToHit113c(player)
    expect(baseAr).toBe(95)

    // Equip an item with +105 Attack Rating (STAT_TOHIT = 19) -> total AR = 200
    player.items.push({
      location: 'equipped',
      stats: new Map([[19, 105]]),
    } as never)
    const boostedAr = (
      game as unknown as { computePlayerBaseToHit113c(p: unknown): number }
    ).computePlayerBaseToHit113c(player)
    expect(boostedAr).toBe(200)
  })

  it('rolls monster blocking from MonStats.txt ToBlock without requiring hasShield (D2Common.dll #10212 0x6FD81D20)', () => {
    const rng = new D2Rng(141503)
    const attackerStats = new UnitStatList(registry)
    attackerStats.setBaseStat('level', 20)
    attackerStats.setBaseStat('tohit', 10_000)
    attackerStats.setBaseStat('maxhp', 500 * FIXED_ONE)
    attackerStats.setHp256(500 * FIXED_ONE)
    const attacker: CombatUnitContext = {
      id: 'player_1',
      name: 'Paladin',
      unitType: 'player',
      statList: attackerStats,
      stateBus: new StateBus(attackerStats, registry),
    }

    const makeMonsterDefender = (toBlock: number): CombatUnitContext => {
      const st = new UnitStatList(registry)
      st.setBaseStat('level', 20)
      st.setBaseStat('armorclass', 0)
      st.setBaseStat('toblock', toBlock)
      st.setBaseStat('maxhp', 100_000 * FIXED_ONE)
      st.setHp256(100_000 * FIXED_ONE)
      return {
        id: 'monster_skeleton',
        name: 'Skeleton',
        unitType: 'monster',
        statList: st,
        stateBus: new StateBus(st, registry),
        hasShield: false,
      }
    }

    const trials = 10_000
    const defenderBlock30 = makeMonsterDefender(30)
    let blocks30 = 0
    let hits30 = 0
    for (let i = 0; i < trials; i++) {
      const out = executeSUnitDmg(
        attacker,
        defenderBlock30,
        {
          skillId: 0,
          attackKind: 'melee',
          srcDam: 0,
          flatPhysMin256: 10 * FIXED_ONE,
          flatPhysMax256: 10 * FIXED_ONE,
          autoHit: false,
          unblockable: false,
        },
        rng,
      )
      if (out.avoidedReason === 'block') blocks30++
      if (out.hit) hits30++
    }
    // 95% pass RollToHit, then 30% of those are blocked (~28.5% blocked, ~66.5% hit)
    expect(blocks30).toBeGreaterThan(2500)
    expect(blocks30).toBeLessThan(3200)
    expect(hits30 / trials).toBeGreaterThanOrEqual(0.64)
    expect(hits30 / trials).toBeLessThanOrEqual(0.69)

    const defenderBlock0 = makeMonsterDefender(0)
    let blocks0 = 0
    for (let i = 0; i < trials; i++) {
      const out = executeSUnitDmg(
        attacker,
        defenderBlock0,
        {
          skillId: 0,
          attackKind: 'melee',
          srcDam: 0,
          flatPhysMin256: 10 * FIXED_ONE,
          flatPhysMax256: 10 * FIXED_ONE,
          autoHit: false,
          unblockable: false,
        },
        rng,
      )
      if (out.avoidedReason === 'block') blocks0++
    }
    expect(blocks0).toBe(0)

    // Verify end-to-end in GameInstance against a spawned skeleton with ToBlock=30
    const game = new GameInstance({ seed: 141504, difficulty: 0, areaId: 1 })
    const playerId = game.connectPlayer({
      name: 'Tester',
      classId: 'bar',
      level: 20,
      ar: 10_000,
      x: 100,
      y: 100,
      areaId: 1,
    })
    const skelId = game.spawnMonster({
      defId: 'skeleton1',
      level: 20,
      ac: 0,
      toBlock: 30,
      hp: 1_000_000,
      maxHp: 1_000_000,
      x: 101,
      y: 100,
      areaId: 1,
      aiDisabled: true,
    })
    let gameLanded = 0
    for (let i = 0; i < trials; i++) {
      if (game.applyDamageToMonster(skelId, 10, playerId, 0)) {
        gameLanded++
      }
    }
    // 95% * (1 - 0.30) = 66.5% landed (significantly below 95% due to 30% monster block)
    expect(gameLanded / trials).toBeGreaterThanOrEqual(0.64)
    expect(gameLanded / trials).toBeLessThanOrEqual(0.69)
  })

  it('rolls RollToHit for summoned pets using the pet own tohit and level instead of autoHit=true', () => {
    const rng = new D2Rng(141505)
    const mgr = new SummonManager(registry)
    const ownerStats = new UnitStatList(registry)
    ownerStats.setBaseStat('level', 30)
    ownerStats.setBaseStat('tohit', 50_000)
    const owner: CombatUnitContext = {
      id: 'owner_1',
      name: 'Necro',
      unitType: 'player',
      statList: ownerStats,
      stateBus: new StateBus(ownerStats, registry),
      x: 100,
      y: 100,
    }

    const created = mgr.createPet({
      owner,
      skillId: 227, // Summon Spirit Wolf
      slvl: 1,
      x: 100,
      y: 100,
    })
    expect(created.pet).not.toBeNull()
    const pet = created.pet!
    pet.statList.setBaseStat('level', 10)
    pet.statList.setBaseStat('tohit', 100)
    pet.statList.setBaseStat('item_tohit_percent', 0)

    const enemyStats = new UnitStatList(registry)
    enemyStats.setBaseStat('level', 10)
    enemyStats.setBaseStat('armorclass', 1000)
    enemyStats.setBaseStat('toblock', 0)
    enemyStats.setBaseStat('maxhp', 1_000_000 * FIXED_ONE)
    enemyStats.setHp256(1_000_000 * FIXED_ONE)
    const enemy: CombatUnitContext = {
      id: 'enemy_1',
      name: 'Zombie',
      unitType: 'monster',
      statList: enemyStats,
      stateBus: new StateBus(enemyStats, registry),
      x: 101,
      y: 100,
    }
    const enemyPositions = new Map([[enemy.id, { x: 101, y: 100 }]])
    const missileEngine = new MissileEngine(registry)
    const auraScanner = new AuraScanner(registry)

    let petHits = 0
    const swings = 2000
    for (let i = 0; i < swings; i++) {
      const res = mgr.tickPets({
        currentTick: (i + 1) * 10,
        owner,
        enemies: [enemy],
        enemyPositions,
        corpses: [],
        missileEngine,
        auraScanner,
      })
      if (res.damageDealt > 0) {
        petHits++
      }
    }
    const petHitRate = petHits / swings
    expect(petHitRate).toBeGreaterThanOrEqual(0.07)
    expect(petHitRate).toBeLessThanOrEqual(0.11)
  })

  it('determines skill/missile autoHit and unblockable from Skills.txt and Missiles.txt', () => {
    const rng = new D2Rng(141506)
    const casterStats = new UnitStatList(registry)
    casterStats.setBaseStat('level', 30)
    casterStats.setBaseStat('tohit', 50)
    casterStats.setBaseStat('maxhp', 500 * FIXED_ONE)
    casterStats.setHp256(500 * FIXED_ONE)
    casterStats.setBaseStat('maxmana', 500 * FIXED_ONE)
    casterStats.setMana256(500 * FIXED_ONE)
    const caster: CombatUnitContext = {
      id: 'caster_1',
      name: 'Ama',
      unitType: 'player',
      statList: casterStats,
      stateBus: new StateBus(casterStats, registry),
      weaponMinPhys: 10,
      weaponMaxPhys: 20,
      weaponItemType: 'bow',
      isRanged: true,
      ammoQuantity: 100,
    }

    // Guided Arrow (skillId 22 -> Missiles.txt guidedarrow ToHit=0) -> autoHit: true
    const gaMissileEngine = new MissileEngine(registry)
    const gaSkill = registry.getSkillById(22)!
    casterStats.setBaseSkillLevel(22, 5)
    executeSkillCore113c({
      skill: gaSkill,
      evalResult: evaluateSkill113c({
        registry,
        skill: gaSkill,
        slvl: 5,
        blvl: 5,
        statList: casterStats,
      }),
      caster,
      targets: [],
      targetPositions: new Map(),
      corpses: [],
      registry,
      rng,
      missileEngine: gaMissileEngine,
      auraScanner: new AuraScanner(registry),
      summonManager: new SummonManager(registry),
      currentTick: 1,
      targetX: 110,
      targetY: 100,
    })
    expect(gaMissileEngine.getActiveMissiles()[0]?.dmgPacket.autoHit).toBe(true)

    // Magic Arrow (skillId 6 -> Missiles.txt magicarrow ToHit=1) -> autoHit: false
    const maMissileEngine = new MissileEngine(registry)
    const maSkill = registry.getSkillById(6)!
    casterStats.setBaseSkillLevel(6, 5)
    executeSkillCore113c({
      skill: maSkill,
      evalResult: evaluateSkill113c({
        registry,
        skill: maSkill,
        slvl: 5,
        blvl: 5,
        statList: casterStats,
      }),
      caster,
      targets: [],
      targetPositions: new Map(),
      corpses: [],
      registry,
      rng,
      missileEngine: maMissileEngine,
      auraScanner: new AuraScanner(registry),
      summonManager: new SummonManager(registry),
      currentTick: 2,
      targetX: 110,
      targetY: 100,
    })
    expect(maMissileEngine.getActiveMissiles()[0]?.dmgPacket.autoHit).toBe(false)

    // Smite (skillId 97, srvdofunc 150) is always autoHit=true & unblockable=true even at AR=1 vs DEF=10000, ToBlock=75
    const game = new GameInstance({ seed: 141507, difficulty: 0, areaId: 1 })
    const pId = game.connectPlayer({
      name: 'Smiter',
      classId: 'pal',
      level: 10,
      ar: 1,
      x: 100,
      y: 100,
      areaId: 1,
    })
    const mId = game.spawnMonster({
      defId: 'skeleton1',
      level: 90,
      ac: 10_000,
      toBlock: 75,
      hp: 100_000,
      maxHp: 100_000,
      x: 101,
      y: 100,
      areaId: 1,
      aiDisabled: true,
    })
    let smiteHits = 0
    for (let i = 0; i < 200; i++) {
      if (game.applyDamageToMonster(mId, 25, pId, 97)) smiteHits++
    }
    expect(smiteHits).toBe(200)

    // Elemental melee skill (Vengeance skillId 111, range='h2h') must roll ToHit (not autoHit)
    let vengeanceHits = 0
    for (let i = 0; i < 200; i++) {
      if (game.applyDamageToMonster(mId, 25, pId, 111, 'fire')) vengeanceHits++
    }
    expect(vengeanceHits).toBeLessThan(30)
  })
})
