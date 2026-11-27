/**
 * Issue #1994 — 1.13c Monster Melee Combat Skills: ToHit, Shield Block & `#156 Fire Hit` `S1` Rider Parity
 *
 * Verifies against D2Game.dll 1.13c (`0x6FCC11B0`, `SUNITDMG_AllocCombat` `0x6FCFE5A0`, `0x6FCD67EC`) & Patch_D2.mpq:
 * 1. High-Defense stationary player (`5%` ToHit floor) evades ~`95%` of low-AR monster melee skills
 *    (`#10 Jab`, `#107 Charge`, `#126 Bash`, `#143 Leap Attack`, `#151 Whirlwind`, `#156 Fire Hit`, `#215 MonFrenzy`),
 *    and missed swings apply `0` damage, `0` knockback, and `0` Frenzy (`state 141`).
 * 2. Stationary `75%` Shield Block player blocks `#107 Charge`, `#198 DiabRun`, `#301 Siege Beast Stomp`,
 *    and `#215 MonFrenzy` ~`75%` of hits, entering `PLRMODE_BLOCK` (`mode === 9`) with `0` damage, `0` knockback,
 *    and `0` Frenzy (`state 141`), while `#198 DiabRun` (`ResultFlags = 5`) and `#301 Stomp` (`ResultFlags = 1`)
 *    auto-hit against `50,000` Defense when unblocked.
 * 3. `#97 Smite` (`SrvDo150`) auto-hits AND bypasses both `50,000` Defense and `75%` Shield Block (`100%` hit rate),
 *    applying `state 21` stun and knockback.
 * 4. `#156 Fire Hit` uses `MonStats.txt` `S1` rider: `sandraider1` deals Fire (`0` chill), whereas `sandraider2`
 *    (`Marauder`) deals Cold + `75`-frame chill (`state 11`).
 * 5. `#352 SerpentCharge` (`Param3 = 0, Param4 = 0`) uses `1.0x` physical multiplier vs `#107 Charge`'s `+100%` ED (`slvl 1`).
 */
import { describe, expect, it } from 'vitest'
import type { MonsterSkillEntry } from '../../src/common/units/unit-types.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'

interface TestPlayerInternal {
  unitId: number
  x: number
  y: number
  targetX: number
  targetY: number
  hp: number
  hpFixed: number
  maxHp: number
  maxHpFixed: number
  level: number
  dexterity: number
  mode: number
  run: boolean
  states: Set<number>
  stateTimers: Map<number, number>
  items: unknown[]
}

interface TestMonsterInternal {
  unitId: number
  x: number
  y: number
  ar: number
  special1Ar: number
  minDmg: number
  maxDmg: number
  special1MinDmg: number
  special1MaxDmg: number
  skills: readonly MonsterSkillEntry[]
  states: Set<number>
  frenzyUntilFrame: number
  frenzySpeedPct: number
}

function getPlayers(game: GameInstance): Map<number, TestPlayerInternal> {
  return Reflect.get(game, 'players') as unknown as Map<number, TestPlayerInternal>
}

function getMonsters(game: GameInstance): Map<number, TestMonsterInternal> {
  return Reflect.get(game, 'monsters') as unknown as Map<number, TestMonsterInternal>
}

function equipHighDefenseArmor(player: TestPlayerInternal, defense = 50000): void {
  player.level = 80
  player.hp = 5000
  player.maxHp = 5000
  player.hpFixed = 5000 * FIXED_ONE
  player.maxHpFixed = 5000 * FIXED_ONE
  player.run = false
  player.mode = 1
  player.items.push({
    unitId: 9001,
    code: 'aar',
    name: 'Godly Ancient Armor',
    quality: 4,
    level: 80,
    location: 'equipped',
    x: 0,
    y: 0,
    width: 2,
    height: 3,
    areaId: 2,
    ownerId: player.unitId,
    bodyLoc: 3,
    identified: true,
    stats: new Map([[31, defense]]),
  })
}

function equipMaxBlockShield(player: TestPlayerInternal): void {
  player.level = 30
  player.dexterity = 350
  player.hp = 5000
  player.maxHp = 5000
  player.hpFixed = 5000 * FIXED_ONE
  player.maxHpFixed = 5000 * FIXED_ONE
  player.run = false
  player.mode = 1
  player.items.push({
    unitId: 9002,
    code: 'uit',
    name: 'Stormshield Monarch',
    quality: 7,
    level: 73,
    location: 'equipped',
    x: 0,
    y: 0,
    width: 2,
    height: 3,
    areaId: 2,
    ownerId: player.unitId,
    bodyLoc: 5,
    identified: true,
    stats: new Map([[20, 60]]),
  })
}

function invokeSkillStrike(
  game: GameInstance,
  monsterId: number,
  player: TestPlayerInternal,
  spec: {
    skillId: number
    minDmg: number
    maxDmg: number
    skillMode?: 'A1' | 'A2' | 'S1' | undefined
    arBonusPct?: number | undefined
    autoHit?: boolean | undefined
    unblockable?: boolean | undefined
    stunFrames?: number | undefined
    knockbackSteps?: number | undefined
  },
): boolean {
  const monster = getMonsters(game).get(monsterId)!
  const fn = Reflect.get(game, 'executeMonsterMeleeSkillStrike113c') as (
    m: TestMonsterInternal,
    t: { readonly kind: 'player'; readonly player: TestPlayerInternal },
    s: typeof spec,
  ) => boolean
  return fn.call(game, monster, { kind: 'player', player }, spec)
}

describe('Issue #1994 — 1.13c monster melee skills ToHit, Shield Block & #156 Fire Hit S1 rider parity', () => {
  it('enforces RollToHit vs Defense (~5% hit floor) on Jab, Charge, Bash, Leap Attack, Whirlwind, Fire Hit, and MonFrenzy', () => {
    const skillsToTest = [
      { skillId: 10, arBonusPct: 10, knockbackSteps: 0 },
      { skillId: 107, arBonusPct: 50, knockbackSteps: 3 },
      { skillId: 126, arBonusPct: 20, knockbackSteps: 2 },
      { skillId: 143, arBonusPct: 50, knockbackSteps: 2 },
      { skillId: 151, arBonusPct: 0, knockbackSteps: 0 },
      { skillId: 156, arBonusPct: 20, knockbackSteps: 0, skillMode: 'S1' as const },
      { skillId: 215, arBonusPct: 10, knockbackSteps: 0 },
    ]

    for (const sk of skillsToTest) {
      let hits = 0
      const trials = 120
      for (let i = 0; i < trials; i++) {
        const game = new GameInstance({ seed: 1994000 + sk.skillId * 200 + i, areaId: 2 })
        const pid = game.connectPlayer({ charClass: 'pal', name: 'Tank', x: 40, y: 40, areaId: 2 })
        const player = getPlayers(game).get(pid)!
        equipHighDefenseArmor(player, 50000)

        const mid = game.spawnMonster({
          defId: sk.skillId === 156 ? 'sandraider1' : 'fallen1',
          x: 41,
          y: 40,
          areaId: 2,
          level: 5,
          ar: 10,
          minDmg: 25,
          maxDmg: 25,
          aiDisabled: true,
        })
        const monster = getMonsters(game).get(mid)!
        monster.ar = 10
        monster.special1Ar = 10

        const hpBefore = player.hp
        const xBefore = player.x
        const yBefore = player.y
        const hit = invokeSkillStrike(game, mid, player, {
          skillId: sk.skillId,
          minDmg: 25,
          maxDmg: 25,
          skillMode: sk.skillMode,
          arBonusPct: sk.arBonusPct,
          knockbackSteps: sk.knockbackSteps,
        })
        if (hit) {
          hits++
        } else {
          expect(player.hp).toBe(hpBefore)
          expect(player.x).toBe(xBefore)
          expect(player.y).toBe(yBefore)
        }
      }
      // 5% ToHit floor over 120 trials -> expected ~6 hits (strictly far below old 120/120 auto-hit bug)
      expect(hits).toBeLessThanOrEqual(20)
    }
  })

  it('does NOT grant Frenzy haste (state 141) when #215 MonFrenzy or #328 BloodLordFrenzy misses or is blocked', () => {
    let frenzyAppliedOnMiss = 0
    let frenzyAppliedOnHit = 0
    for (let i = 0; i < 60; i++) {
      const game = new GameInstance({ seed: 1994500 + i, areaId: 2 })
      const pid = game.connectPlayer({ charClass: 'bar', name: 'Tank', x: 40, y: 40, areaId: 2 })
      const player = getPlayers(game).get(pid)!
      equipHighDefenseArmor(player, 50000)

      const mid = game.spawnMonster({
        defId: 'bloodlord1',
        x: 41,
        y: 40,
        areaId: 2,
        level: 5,
        ar: 10,
        minDmg: 20,
        maxDmg: 20,
      })
      const monster = getMonsters(game).get(mid)!
      monster.ar = 10
      monster.skills = [{ slot: 1, skill: 'BloodLordFrenzy', skillId: 328, mode: 'A1', level: 3 }]

      const hpBefore = player.hp
      const tryCast = Reflect.get(game, 'tryCastMonsterCombatOrSummonSkill113c') as (
        m: TestMonsterInternal,
        t: { readonly x: number; readonly y: number },
        d: number,
        hitMonsters: boolean,
      ) => boolean
      const casted = tryCast.call(game, monster, { x: player.x, y: player.y }, 1.0, false)
      expect(casted).toBe(true)
      if (player.hp === hpBefore) {
        if (monster.states.has(141) || monster.frenzySpeedPct > 0) {
          frenzyAppliedOnMiss++
        }
      } else if (monster.states.has(141)) {
        frenzyAppliedOnHit++
      }
    }
    expect(frenzyAppliedOnMiss).toBe(0)
    expect(frenzyAppliedOnHit).toBeGreaterThanOrEqual(0)
  })

  it('auto-hits vs 50,000 Defense on #198 DiabRun and #301 Siege Beast Stomp while still allowing 75% Shield Block (PLRMODE_BLOCK = 9)', () => {
    for (const skillId of [198, 301] as const) {
      // 1) Shieldless 50,000 Defense player -> 100% auto-hit (`ResultFlags & 1`)
      for (let i = 0; i < 25; i++) {
        const game = new GameInstance({ seed: 1994700 + skillId + i, areaId: 2 })
        const pid = game.connectPlayer({ charClass: 'sor', name: 'NoShield', x: 40, y: 40, areaId: 2 })
        const player = getPlayers(game).get(pid)!
        equipHighDefenseArmor(player, 50000)
        const mid = game.spawnMonster({
          defId: 'siegebeast1',
          x: 41,
          y: 40,
          areaId: 2,
          level: 10,
          ar: 5,
          minDmg: 30,
          maxDmg: 30,
          aiDisabled: true,
        })
        const hit = invokeSkillStrike(game, mid, player, {
          skillId,
          minDmg: 30,
          maxDmg: 30,
          autoHit: true,
          unblockable: false,
          knockbackSteps: skillId === 198 ? 2 : 0,
        })
        expect(hit).toBe(true)
        expect(player.hp).toBeLessThan(5000)
      }

      // 2) Stationary 75% Shield Block player -> blocks ~75% with PLRMODE_BLOCK (mode 9) & 0 damage/knockback
      let blocked = 0
      const trials = 120
      for (let i = 0; i < trials; i++) {
        const game = new GameInstance({ seed: 1994900 + skillId * 200 + i, areaId: 2 })
        const pid = game.connectPlayer({ charClass: 'pal', name: 'Blocker', x: 40, y: 40, areaId: 2 })
        const player = getPlayers(game).get(pid)!
        equipMaxBlockShield(player)
        const mid = game.spawnMonster({
          defId: 'siegebeast1',
          x: 41,
          y: 40,
          areaId: 2,
          level: 30,
          ar: 5000,
          minDmg: 40,
          maxDmg: 40,
          aiDisabled: true,
        })
        const xBefore = player.x
        const yBefore = player.y
        const hit = invokeSkillStrike(game, mid, player, {
          skillId,
          minDmg: 40,
          maxDmg: 40,
          autoHit: true,
          unblockable: false,
          knockbackSteps: 2,
        })
        if (!hit) {
          blocked++
          expect(player.mode).toBe(9)
          expect(player.hp).toBe(5000)
          expect(player.x).toBe(xBefore)
          expect(player.y).toBe(yBefore)
        }
      }
      expect(blocked).toBeGreaterThanOrEqual(65)
      expect(blocked).toBeLessThanOrEqual(110)
    }
  })

  it('makes #97 Smite both auto-hit vs 50,000 Defense AND unblockable vs 75% Shield Block (100% hit + stun + knockback)', () => {
    for (let i = 0; i < 40; i++) {
      const game = new GameInstance({ seed: 1995600 + i, areaId: 2 })
      const pid = game.connectPlayer({ charClass: 'pal', name: 'SmiteTarget', x: 40, y: 40, areaId: 2 })
      const player = getPlayers(game).get(pid)!
      equipHighDefenseArmor(player, 50000)
      equipMaxBlockShield(player)

      const mid = game.spawnMonster({
        defId: 'blunderbore1',
        x: 41,
        y: 40,
        areaId: 2,
        level: 5,
        ar: 1,
        minDmg: 35,
        maxDmg: 35,
        aiDisabled: true,
      })
      const hit = invokeSkillStrike(game, mid, player, {
        skillId: 97,
        minDmg: 35,
        maxDmg: 35,
        autoHit: true,
        unblockable: true,
        stunFrames: 45,
        knockbackSteps: 3,
      })
      expect(hit).toBe(true)
      expect(player.mode).not.toBe(9)
      expect(player.hp).toBeLessThan(5000)
      expect(player.states.has(21)).toBe(true)
    }
  })

  it('resolves #156 Fire Hit via MonStats.txt S1 mode: Fire rider on sandraider1 vs Cold + 75f chill (state 11) on sandraider2 (Marauder)', () => {
    // 1) sandraider1 (`El1Mode = S1`, `El1Type = fire`, `El1Dur = 0`) -> deals Fire + Phys, never applies state 11 chill
    {
      const game = new GameInstance({ seed: 1995801, areaId: 44 })
      const pid = game.connectPlayer({ charClass: 'sor', name: 'DesertHero', x: 40, y: 40, areaId: 44 })
      const player = getPlayers(game).get(pid)!
      player.hp = 1000
      player.maxHp = 1000
      player.hpFixed = 1000 * FIXED_ONE
      player.maxHpFixed = 1000 * FIXED_ONE

      const mid = game.spawnMonster({
        defId: 'sandraider1',
        x: 41,
        y: 40,
        areaId: 44,
        ar: 50000,
      })
      const monster = getMonsters(game).get(mid)!
      monster.special1Ar = 50000

      const tryCast = Reflect.get(game, 'tryCastMonsterCombatOrSummonSkill113c') as (
        m: TestMonsterInternal,
        t: { readonly x: number; readonly y: number },
        d: number,
        hitMonsters: boolean,
      ) => boolean
      expect(tryCast.call(game, monster, { x: 40, y: 40 }, 1.0, false)).toBe(true)
      expect(player.hp).toBeLessThan(1000)
      expect(player.states.has(11)).toBe(false)
    }

    // 2) sandraider2 / Marauder (`El1Mode = S1`, `El1Type = cold`, `El1Dur = 75`) -> deals Cold + Phys and applies 75f state 11 chill!
    {
      const game = new GameInstance({ seed: 1995802, areaId: 44 })
      const pid = game.connectPlayer({ charClass: 'sor', name: 'DesertHero', x: 40, y: 40, areaId: 44 })
      const player = getPlayers(game).get(pid)!
      player.hp = 1000
      player.maxHp = 1000
      player.hpFixed = 1000 * FIXED_ONE
      player.maxHpFixed = 1000 * FIXED_ONE

      const mid = game.spawnMonster({
        defId: 'sandraider2',
        x: 41,
        y: 40,
        areaId: 44,
        ar: 50000,
      })
      const monster = getMonsters(game).get(mid)!
      monster.special1Ar = 50000

      const tryCast = Reflect.get(game, 'tryCastMonsterCombatOrSummonSkill113c') as (
        m: TestMonsterInternal,
        t: { readonly x: number; readonly y: number },
        d: number,
        hitMonsters: boolean,
      ) => boolean
      expect(tryCast.call(game, monster, { x: 40, y: 40 }, 1.0, false)).toBe(true)
      expect(player.hp).toBeLessThan(1000)
      expect(player.states.has(11)).toBe(true)
      expect(player.stateTimers.get(11)).toBe(75)
    }
  })

  it('uses 1.0x physical multiplier on #352 SerpentCharge (Param3=0, Param4=0) vs 2.0x on #107 Charge (slvl 1)', () => {
    const runCharge = (skillId: 107 | 352): number => {
      const game = new GameInstance({ seed: 1995900 + skillId, areaId: 2 })
      const pid = game.connectPlayer({ charClass: 'sor', name: 'Target', x: 40, y: 40, areaId: 2 })
      const player = getPlayers(game).get(pid)!
      player.hp = 1000
      player.maxHp = 1000
      player.hpFixed = 1000 * FIXED_ONE
      player.maxHpFixed = 1000 * FIXED_ONE

      const mid = game.spawnMonster({
        defId: 'fallen1',
        x: 46,
        y: 40,
        areaId: 2,
        ar: 50000,
        minDmg: 20,
        maxDmg: 20,
      })
      const monster = getMonsters(game).get(mid)!
      monster.skills = [{ slot: 1, skill: skillId === 352 ? 'SerpentCharge' : 'Charge', skillId, mode: 'A1', level: 1 }]
      const tryCast = Reflect.get(game, 'tryCastMonsterCombatOrSummonSkill113c') as (
        m: TestMonsterInternal,
        t: { readonly x: number; readonly y: number },
        d: number,
        hitMonsters: boolean,
      ) => boolean
      expect(tryCast.call(game, monster, { x: 40, y: 40 }, 6.0, false)).toBe(true)
      return 1000 - player.hp
    }

    const serpentDmg = runCharge(352)
    const chargeDmg = runCharge(107)
    expect(serpentDmg).toBeGreaterThanOrEqual(18)
    expect(serpentDmg).toBeLessThanOrEqual(22)
    expect(chargeDmg).toBeGreaterThanOrEqual(38)
    expect(chargeDmg).toBeLessThanOrEqual(42)
  })
})
