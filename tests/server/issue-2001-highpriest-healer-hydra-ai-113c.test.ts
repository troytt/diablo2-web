import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface TestMonsterRecord {
  readonly unitId: number
  readonly hcIdx: number
  readonly areaId: number
  readonly ai: string
  readonly skills: readonly { skillId?: number; level: number }[]
  x: number
  y: number
  hp: number
  maxHp: number
  cooldown: number
  skillCooldown: number
  nextAiFrame: number
}

interface TestPlayerRecord {
  readonly unitId: number
  x: number
  y: number
  targetX: number
  hp: number
  maxHp: number
}

function getMonsters(game: GameInstance): Map<number, TestMonsterRecord> {
  return (game as unknown as { monsters: Map<number, TestMonsterRecord> }).monsters
}

function getPlayers(game: GameInstance): Map<number, TestPlayerRecord> {
  return (game as unknown as { players: Map<number, TestPlayerRecord> }).players
}

describe('Issue #2001: 1.13c monster healer AI (#179/#182) fallback guard, HP% & turret filters, and HighPriest #62 Hydra gates', () => {
  it('never triggers an unconditional #179 ZakarumHeal / #182 Bestow fallback from tryCastMonsterSkill or while in melee range (0x6FC390BB)', () => {
    for (const spec of [
      { hcIdx: 345, defId: 'councilmember1' },
      { hcIdx: 557, defId: 'baalhighpriest' },
    ]) {
      const game = new GameInstance({ seed: 200101 + spec.hcIdx, areaId: 83 })
      const pid = game.connectPlayer({
        charClass: 'bar',
        name: 'MeleeBrawler',
        x: 11.5, // in melee range (1.5 subtiles <= meleeRange + 1.5)
        y: 10,
        areaId: 83,
        hp: 8000,
        maxHp: 8000,
      })
      const casterId = game.spawnMonster({
        hcIdx: spec.hcIdx,
        defId: spec.defId,
        x: 10,
        y: 10,
        areaId: 83,
        hp: 600,
        maxHp: 600,
      })
      const allyId = game.spawnMonster({
        hcIdx: 346,
        defId: 'councilmember2',
        x: 28,
        y: 10,
        areaId: 83,
        hp: 100, // 10% HP
        maxHp: 1000,
      })
      const monsters = getMonsters(game)
      const caster = monsters.get(casterId)!
      const ally = monsters.get(allyId)!
      // Freeze ally AI so it stays at 10% HP without acting
      ally.cooldown = 9999
      ally.skillCooldown = 9999
      ally.nextAiFrame = 99999
      game.drainEvents(pid)

      // 1) Direct non-heal fallback call (`healOrWhipOnly = false`) must NEVER fire #179 ZakarumHeal
      const fallbackFired = (
        game as unknown as {
          tryCastMonsterUtilitySkill: (
            m: TestMonsterRecord,
            t: { x: number; y: number },
            d: number,
            healOrWhipOnly?: boolean,
          ) => boolean
        }
      ).tryCastMonsterUtilitySkill(caster, { x: 11.5, y: 10 }, 1.5, false)
      expect(fallbackFired).toBe(false)
      expect(ally.hp).toBe(100)

      // 2) Over 60 frames with a hostile standing in melee range (`bInMeleeRange != 0`), HighPriest
      //    must NEVER cast #179 ZakarumHeal OR #62 Hydra (`0x6FC390BB`)
      for (let f = 0; f < 60; f += 1) {
        getPlayers(game).get(pid)!.x = caster.x + 1.5
        getPlayers(game).get(pid)!.y = caster.y
        game.stepFrames(1)
      }
      const events = game.drainEvents(pid)
      expect(
        events.some(
          (e) =>
            e.type === 'SkillCast' &&
            ((e as { skillId?: number }).skillId === 179 ||
              (e as { skillId?: number }).skillId === 62),
        ),
      ).toBe(false)
    }
  })

  it('enforces 1.13c per-AI D2Common.#11027 HP% thresholds and excludes summoned Hydra / construct units from healing', () => {
    const game = new GameInstance({ seed: 200120, areaId: 83 })
    game.connectPlayer({ charClass: 'sor', name: 'Observer', x: 40, y: 10, areaId: 83 })

    const priestId = game.spawnMonster({ hcIdx: 345, defId: 'councilmember1', x: 10, y: 10, areaId: 83 })
    const cantorId = game.spawnMonster({ hcIdx: 238, defId: 'cantor1', x: 10, y: 12, areaId: 83 })
    const okId = game.spawnMonster({ hcIdx: 312, defId: 'doomknight3', x: 10, y: 14, areaId: 83 })
    const overseerId = game.spawnMonster({ hcIdx: 479, defId: 'overseer1', x: 40, y: 40, areaId: 83 })

    // Spawn a wounded Hydra turret (`hcIdx 351`) and Bone Prison (`hcIdx 340`) at 10% HP right next to both healer groups: must NEVER be healed or whipped!
    const hydraTurretId = game.spawnMonster({
      hcIdx: 351,
      defId: 'hydra1',
      x: 12,
      y: 10,
      areaId: 83,
      hp: 10,
      maxHp: 200,
    })
    const overseerHydraId = game.spawnMonster({
      hcIdx: 351,
      defId: 'hydra1',
      x: 42,
      y: 40,
      areaId: 83,
      hp: 10,
      maxHp: 200,
    })
    const prisonId = game.spawnMonster({
      hcIdx: 340,
      defId: 'boneprison1',
      x: 12,
      y: 12,
      areaId: 83,
      hp: 10,
      maxHp: 200,
    })
    // Spawn a combatant ally near the 3 priests (`d <= 6`) starting at 80% HP (`800 / 1000`),
    // and an ally 16 subtiles from Overseer (> 14 whip range, <= 20 Healing Vortex range).
    const allyId = game.spawnMonster({
      hcIdx: 346,
      defId: 'councilmember2',
      x: 14,
      y: 10,
      areaId: 83,
      hp: 800,
      maxHp: 1000,
    })
    const overseerAllyId = game.spawnMonster({
      hcIdx: 436,
      defId: 'deathmauler1',
      x: 56,
      y: 40,
      areaId: 83,
      hp: 750,
      maxHp: 1000,
    })

    const monsters = getMonsters(game)
    const callHeal = (casterUnitId: number, healOnly: boolean): boolean => {
      const m = monsters.get(casterUnitId)!
      m.cooldown = 0
      m.skillCooldown = 0
      return (
        game as unknown as {
          tryCastMonsterUtilitySkill: (
            mon: TestMonsterRecord,
            t: { x: number; y: number },
            d: number,
            healOrWhipOnly?: boolean,
          ) => boolean
        }
      ).tryCastMonsterUtilitySkill(m, { x: 40, y: 10 }, 30, healOnly)
    }

    // At 75% HP (`750 / 1000`), HighPriest (`< 75%` per `0x6FC391D5`/`0x6FC356AB`), ZakarumPriest (`<= 60%`),
    // OblivionKnight (`< 40%`), and Overseer (`<= 50%`) must ALL refuse to heal, and must ignore 10% HP hydra1 & boneprison1!
    const ally = monsters.get(allyId)!
    const overseerAlly = monsters.get(overseerAllyId)!
    for (const id of [priestId, cantorId, okId, overseerId]) {
      const h = monsters.get(id)!
      h.hp = h.maxHp
    }
    ally.hp = 750
    overseerAlly.hp = 750
    expect(callHeal(priestId, true)).toBe(false)
    expect(callHeal(cantorId, true)).toBe(false)
    expect(callHeal(okId, true)).toBe(false)
    expect(callHeal(overseerId, true)).toBe(false)
    expect(monsters.get(hydraTurretId)!.hp).toBe(10)
    expect(monsters.get(overseerHydraId)!.hp).toBe(10)
    expect(monsters.get(prisonId)!.hp).toBe(10)

    // At 74% HP (`740 / 1000`), HighPriest heals (`< 75%`), while ZakarumPriest (`<= 60%`) and OblivionKnight (`< 40%`) refuse
    ally.hp = 740
    expect(callHeal(cantorId, true)).toBe(false)
    expect(callHeal(okId, true)).toBe(false)
    expect(callHeal(priestId, true)).toBe(true)
    expect(ally.hp).toBeGreaterThan(740)

    // At 60% HP (`600 / 1000`), ZakarumPriest heals (`<= 60%`), while OblivionKnight (`< 40%`) still refuses
    ally.hp = 600
    expect(callHeal(okId, true)).toBe(false)
    expect(callHeal(cantorId, true)).toBe(true)
    expect(ally.hp).toBeGreaterThan(600)

    // At 39% HP (`390 / 1000`), OblivionKnight heals (`< 40%`)
    ally.hp = 390
    expect(callHeal(okId, true)).toBe(true)
    expect(ally.hp).toBeGreaterThan(390)
  })

  it('enforces HighPriest #62 Hydra aip8=30 range, aip4 roll, 100-frame spell timer, and Skills.txt HitShift=7 bolt damage', () => {
    const game = new GameInstance({ seed: 200130, areaId: 83, difficulty: 0 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'Kiter',
      x: 42, // 32 subtiles away (>= councilmember1 aip8 = 30 per 0x6FC39255) -> out of Hydra cast range!
      y: 10,
      areaId: 83,
      hp: 5000,
      maxHp: 5000,
    })
    const councilId = game.spawnMonster({
      hcIdx: 345, // Sk1lvl = 2, aip4 = 40, aip8 = 30
      defId: 'councilmember1',
      x: 10,
      y: 10,
      areaId: 83,
      hp: 2000,
      maxHp: 2000,
      velocity: 0,
      runSpeed: 0,
    })
    const monsters = getMonsters(game)
    const council = monsters.get(councilId)!

    // 1) Pin councilmember1 at (10, 10) -> distance 32 (>= aip8 = 30): must NOT summon Hydra
    for (let f = 0; f < 45; f += 1) {
      council.x = 10
      council.y = 10
      game.stepFrames(1)
    }
    expect([...monsters.values()].filter((m) => m.hcIdx === 351)).toHaveLength(0)

    // 2) Step player into distance 10 (< aip8 = 30, > meleeCutoff): councilmember1 casts #62 Hydra
    //    with 100-frame (`0x64`) spell cooldown and `hydra1` inherits base `Sk1lvl = 2` (NOT stuck at 1)
    const kiter = getPlayers(game).get(pid)!
    kiter.x = 20
    kiter.targetX = 20
    let castCooldownObserved = 0
    for (let f = 0; f < 120; f += 1) {
      council.x = 10
      council.y = 10
      game.stepFrames(1)
      if ([...monsters.values()].some((m) => m.hcIdx === 351)) {
        castCooldownObserved = council.skillCooldown
        break
      }
    }
    const hydras = [...monsters.values()].filter((m) => m.hcIdx === 351)
    expect(hydras).toHaveLength(1)
    expect(castCooldownObserved).toBe(100)
    expect(hydras[0]!.skills[0]?.level).toBe(2)

    // 3) Verify #337 HydraMissile firebolt damage uses Skills.txt #62 HitShift=7 (slvl 2 = 19..26 base fire,
    //    or +extraFirePct if MonProp applies), never inflated by fake +12*difficulty
    game.drainEvents(pid)
    const hpBefore = getPlayers(game).get(pid)!.hp
    game.stepFrames(35)
    const hpLost = hpBefore - getPlayers(game).get(pid)!.hp
    expect(hpLost).toBeGreaterThan(0)
    expect(hpLost).toBeLessThanOrEqual(80)
  })
})
