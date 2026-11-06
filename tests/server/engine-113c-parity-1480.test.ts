/**
 * Diablo II: Lord of Destruction v1.13c — GameEngine / skills.ts / demo-data 1.13c Parity (#1480).
 *
 * Verifies:
 * 1. `src/server/skills/skills.ts` no longer contains `skillDamageAt` single-slope `damagePerLevel`
 *    interpolation or `castSkillDef` export; `castSkill` evaluates `SkillDef` via `evaluateSkill113c`
 *    (`Skills.txt` 5-band scaling: `MinLevDam1..5`, `MaxLevDam1..5`, `EMinLev1..5`, `EMaxLev1..5`, `HitShift`)
 *    and resolves `missileType` from `Skills.txt` `srvmissile` / `srvmissilea`.
 * 2. `DEMO_SKILLS` (`src/common/data/demo-data.ts`) is derived from `Skills.txt` + `Missiles.txt`
 *    (#0 Attack, #36 Fire Bolt: `minmana=2, manashift=7 -> 2.5`, `delay=0`, `emin=3, emax=6`, `vel=20 -> 500 px/s`, `range=40 -> 800 px`).
 * 3. `GameEngine` and `scaleMonsterStatsForDifficulty` use 1.13c `CharStats.txt` `WalkVelocity = 6`
 *    (`6 * 24 = 144` px/s = `9.0` sub-tiles/s) instead of invented `playerSpeed = 170`, and `monster-ai.ts`
 *    uses `Skills.txt` #46 Blaze `dm12` (`par1=18, par2=70`) velocitypercent instead of `1.3`.
 * 4. `tickPlayer` (`src/server/ai/monster-ai.ts`) uses 1.13c `PLAYER_UpdateStamina` (`0x6FC95DC0` / `0x6FC95E90`):
 *    running drains `CharStats.RunDrain / 256` per frame (`20/256` for Sorceress/Barbarian, `15/256` for Assassin),
 *    standing still recovers `maxStamina / 256` per frame, walking outdoors recovers `0`, with 25% hysteresis.
 * 5. `GameEngine` mana regeneration (`0x6FC95DF0`) scales by `CharStats.ManaRegen` (`120s`) and `(100 + manaregen) / 100`.
 * 6. `GameEngine` (`grantExperience`, `damageMonster`, `allocateStat`) and `monster-ai.ts` preserve fractional
 *    `LifePerLevel` / `ManaPerLevel` / `StaminaPerLevel` (`ValShift = 8`, fourths in `CharStats.txt`) so a
 *    Necromancer (`1.5` life/level) gaining 2 levels gains `+3` life (`45 -> 48`), never truncated to `+2`.
 * 7. `GameEngine.grantExperience` falls back to `D2_EXPERIENCE_TABLE_99` (`Experience.txt`) instead of `oldLevel * 100`.
 */
import { describe, expect, it } from 'vitest'
import { DEMO_SKILLS } from '../../src/common/data/demo-data.ts'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { D2_EXPERIENCE_TABLE_99 } from '../../src/common/skills/formulas.ts'
import { CANONICAL_CHARSTATS } from '../../src/common/units/classes.ts'
import { createWorld, tickCombat } from '../../src/server/ai/monster-ai.ts'
import { GameEngine } from '../../src/server/engine/game-engine.ts'
import { UnitStatList } from '../../src/server/engine/stat-list.ts'
import * as ServerIndex from '../../src/server/index.ts'
import { evaluateSkill113c } from '../../src/server/skills/registry.ts'
import { castSkill, type SkillDef } from '../../src/server/skills/skills.ts'

describe('Issue #1480 — GameEngine / skills.ts / demo-data 1.13c parity', () => {
  const registry = getSharedDataRegistry()

  it('removes castSkillDef from src/server/index.ts exports and derives DEMO_SKILLS from Skills.txt + Missiles.txt', () => {
    expect('castSkillDef' in ServerIndex).toBe(false)

    const attack = DEMO_SKILLS.find((s) => s.id === 'attack')!
    const firebolt = DEMO_SKILLS.find((s) => s.id === 'firebolt')!
    expect(attack).toBeDefined()
    expect(firebolt).toBeDefined()
    expect('damagePerLevel' in attack).toBe(false)
    expect('damagePerLevel' in firebolt).toBe(false)

    // Skills.txt #36 Fire Bolt: minmana=2, manashift=7 -> 2 * 128 / 256 = 2.5; delay=0; EMin=3, EMax=6; Missiles.txt firebolt Vel=20 (500 px/s), Range=50 (1000 px)
    expect(firebolt.manaCost).toBe(2.5)
    expect(firebolt.cooldownTicks).toBe(0)
    expect(firebolt.baseMinDamage).toBe(3)
    expect(firebolt.baseMaxDamage).toBe(6)
    expect(firebolt.speed).toBe(500)
    expect(firebolt.range).toBe(1000)
    expect(firebolt.castOverlay).toBe('fire_cast_1')
  })

  it('evaluates Fire Bolt damage via evaluateSkill113c 5-band scaling across levels 1..30 and resolves srvmissile for any Skills.txt projectile', () => {
    const fireBoltSkill = DEMO_SKILLS.find((s) => s.id === 'firebolt')!
    const fireBoltRecord = registry.getSkill(36)!
    const caster = { x: 100, y: 100, facing: 0 }

    for (const slvl of [1, 2, 8, 9, 16, 17, 22, 23, 28, 29, 30]) {
      const statList = new UnitStatList(registry)
      statList.setBaseSkillLevel(36, slvl)
      const expected = evaluateSkill113c({
        registry,
        skill: fireBoltRecord,
        slvl,
        blvl: slvl,
        statList,
        difficulty: 0,
      })

      // Sample across RNG seeds to verify exact [minElemDmg, maxElemDmg] bounds
      let obsMin = Number.POSITIVE_INFINITY
      let obsMax = Number.NEGATIVE_INFINITY
      for (let seed = 1; seed <= 64; seed++) {
        const out = castSkill(fireBoltSkill, caster, slvl, new D2Rng(seed), 0, 100, { x: 200, y: 100 })
        expect(out.kind).toBe('projectile')
        if (out.kind === 'projectile') {
          expect(out.projectile.missileType).toBe('firebolt')
          obsMin = Math.min(obsMin, out.projectile.damage)
          obsMax = Math.max(obsMax, out.projectile.damage)
        }
      }
      expect(obsMin).toBeGreaterThanOrEqual(expected.minElemDmg)
      expect(obsMax).toBeLessThanOrEqual(expected.maxElemDmg)
      if (slvl >= 17) {
        // Band-1 single-slope min (3 + 1.5*(slvl-1)) is strictly lower than 5-band scaling at slvl >= 17
        const band1SingleSlopeMin = Math.floor(3 + 1.5 * (slvl - 1))
        expect(obsMin).toBeGreaterThan(band1SingleSlopeMin)
      }
    }

    // Verify non-Fire-Bolt projectile skills resolve missileType from Skills.txt srvmissile (#47 Fire Ball -> fireball, #39 Ice Bolt -> icebolt)
    const fireBallDef: SkillDef = {
      id: '47',
      name: 'Fire Ball',
      manaCost: 5,
      cooldownTicks: 0,
      range: 800,
      projectile: true,
      speed: 400,
      baseMinDamage: 6,
      baseMaxDamage: 14,
      radius: 20,
    }
    const fbOut = castSkill(fireBallDef, caster, 5, new D2Rng(7), 0, 100, { x: 200, y: 100 })
    expect(fbOut.kind).toBe('projectile')
    if (fbOut.kind === 'projectile') {
      expect(fbOut.projectile.missileType).toBe('fireball')
    }
  })

  it('uses 1.13c CharStats.txt WalkVelocity = 6 (144 px/s) and Skills.txt #46 Blaze dm12 velocitypercent', () => {
    const engine = new GameEngine('sor')
    expect(engine.opts.combatOptions.playerSpeed).toBe(CANONICAL_CHARSTATS.sor.walkVelocity * 24)
    expect(engine.opts.combatOptions.playerSpeed).toBe(144)

    const world = createWorld(100, 100, undefined, undefined, 'sor')
    world.player.blazeTicks = 10
    ;(world.player as { blazeSlvl?: number }).blazeSlvl = 1
    // Skills.txt #46 Blaze slvl=1: dm12(18, 70) = floor(52 * 1 / 7) + 18 = 25% -> 1.25x (not 1.3x)
    const openTerrain = { overlap: () => 0 }
    tickCombat(
      world,
      { movement: { x: 1, y: 0 }, attack: false },
      {
        playerSpeed: 100,
        playerReach: 48,
        playerCooldownTicks: 10,
        playerDamage: 5,
        playerManaPerAttack: 0,
        respawnTicks: 50,
      },
      openTerrain,
      D2_EXPERIENCE_TABLE_99,
    )
    expect(world.player.x).toBeCloseTo(100 + (100 / 25) * 1.25, 5)
  })

  it('applies 1.13c PLAYER_UpdateStamina (0x6FC95DC0 / 0x6FC95E90) RunDrain (20/256 vs 15/256 for Assassin) and standing recovery', () => {
    const openTerrain = { overlap: () => 0 }
    const combatOpts = {
      playerSpeed: 144,
      playerReach: 48,
      playerCooldownTicks: 10,
      playerDamage: 5,
      playerManaPerAttack: 0,
      respawnTicks: 50,
    }

    const sorWorld = createWorld(100, 100, undefined, undefined, 'sor')
    const assWorld = createWorld(100, 100, undefined, undefined, 'ass')
    const sorStartStam = sorWorld.player.stamina!
    const assStartStam = assWorld.player.stamina!

    // 1 tick running while moving: Sorceress drains 20/256, Assassin drains 15/256
    tickCombat(sorWorld, { movement: { x: 1, y: 0 }, attack: false }, combatOpts, openTerrain, D2_EXPERIENCE_TABLE_99)
    tickCombat(assWorld, { movement: { x: 1, y: 0 }, attack: false }, combatOpts, openTerrain, D2_EXPERIENCE_TABLE_99)
    expect(sorStartStam - sorWorld.player.stamina!).toBeCloseTo(20 / 256, 6)
    expect(assStartStam - assWorld.player.stamina!).toBeCloseTo(15 / 256, 6)

    // Walking outdoors (isRunning = false, moving) recovers 0 stamina
    sorWorld.player.stamina = 50
    sorWorld.player.isRunning = false
    tickCombat(sorWorld, { movement: { x: 1, y: 0 }, attack: false }, combatOpts, openTerrain, D2_EXPERIENCE_TABLE_99)
    expect(sorWorld.player.stamina!).toBeCloseTo(50, 6)

    // Standing still recovers maxStamina / 256 per frame
    tickCombat(sorWorld, { movement: { x: 0, y: 0 }, attack: false }, combatOpts, openTerrain, D2_EXPERIENCE_TABLE_99)
    expect(sorWorld.player.stamina!).toBeCloseTo(50 + sorWorld.player.maxStamina! / 256, 6)
  })

  it('preserves 1.13c fractional LifePerLevel (1.5 for Necromancer/Druid) and uses D2_EXPERIENCE_TABLE_99 in grantExperience', () => {
    const necEngine = new GameEngine('nec')
    expect(necEngine.world.player.maxHp).toBe(45)

    // 150 XP is below level 2 threshold (500 XP in Experience.txt), so must NOT level up (no oldLevel * 100 fallback)
    const subLv2 = necEngine.grantExperience(150)
    expect(subLv2.leveledUp).toBe(false)
    expect(necEngine.world.player.level).toBe(1)

    // Grant remaining 1350 XP -> total 1500 XP = level 3 (gaining 2 levels from level 1 -> 3)
    // Necromancer LifePerLevel = 6 fourths = 1.5 -> 2 levels must grant +3 life (45 -> 48), not floor(1.5)*2 = +2
    const lv3 = necEngine.grantExperience(1350)
    expect(lv3.leveledUp).toBe(true)
    expect(lv3.levelsGained).toBe(2)
    expect(necEngine.world.player.level).toBe(3)
    expect(necEngine.world.player.maxHp).toBe(48)

    // Also verify single-level stepping (1 -> 2 -> 3) yields the exact same 48 maxHp
    const necStep = new GameEngine('nec')
    necStep.grantExperience(500) // level 2 -> +1 (46)
    expect(necStep.world.player.maxHp).toBe(46)
    necStep.grantExperience(1000) // level 3 -> +2 (48)
    expect(necStep.world.player.maxHp).toBe(48)
  })

  it('scales GameEngine mana regeneration by CharStats.ManaRegen (120s) and manaregen % bonus', () => {
    const engine = new GameEngine('sor')
    engine.world.player.maxMana = 300
    engine.world.player.mana = 100
    ;(engine.world.player as { manaRegenPct?: number }).manaRegenPct = 100 // +100% mana regen -> 2x rate (full 300 pool over 1500 ticks = 1 mana per 5 ticks)

    const idleInput = {
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      digits: [],
      saving: false,
      loading: false,
    }
    for (let i = 0; i < 5; i++) {
      engine.tick(idleInput)
    }
    expect(engine.world.player.mana).toBe(101)
  })
})
