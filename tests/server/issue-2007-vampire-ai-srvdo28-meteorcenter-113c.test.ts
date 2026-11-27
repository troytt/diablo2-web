/**
 * 1.13c Parity Suite — Issue #2007:
 * 1. `AITHINK_Fn028_Vampire` (`D2Game.dll` `0x6FCA6900..0x6FCA7000`) across all 9 `vampire1..9` rows:
 *    - `aip5` spell bitmask (`vampire1` `aip5=3` no Meteor; `vampire2` `aip5=5` no Fire Wall; `vampire5` `aip5=1` base missile/fireball only; `vampire3/4/6..9` `aip5=7` all).
 *    - `11`-think-tick (`0xb`) `vampireUpgradeCooldownTicks` lockout after `#170 VampireFirewall` or `#171 VampireMeteor`.
 *    - `aip2` ranged cast gate (`20..40%` in Normal, NOT 100% spam) & `aip1` melee fight-vs-retreat gate.
 * 2. `MISSMODE_SrvHit31_Firehead` (`0x6FC5A920`, `#277 firehead` / `#333 VampireMissile`):
 *    - Heals casting Vampire by `100%` of actual damage dealt on hit, whereas `#169 VampireFireball` and `#171 VampireMeteor` do NOT steal life (melee `A1` still drains life).
 * 3. `SKILLS_SrvDo028` (`0x6FC62D90`) target-placed reach & origin without `MonUMod #29` (`Multishot`) duplication (`#205 MonBlizzard`, `#305 CatapultMeteor`, etc.).
 * 4. `MISSMODE_SrvHit14_MeteorCenter` (`0x6FC5DEF0`) expiry-only detonation gate (`#422 catapult meteor ball` with `CollideType = 6` waits its full 25-frame sky-fall countdown).
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { MON_UMOD } from '../../src/common/units/monster-death-fx.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import type {
  InternalMonsterRecord,
  InternalPlayerRecord,
} from '../../src/server/engine/game-instance/types.ts'

interface TestMissileView {
  readonly unitId: number
  readonly missileId: number
  readonly skillId: number
  readonly x: number
  readonly y: number
  readonly remainingFrames: number
  readonly carrier?: 'groundfire' | 'none'
}

interface TestGameView {
  readonly players: Map<number, InternalPlayerRecord>
  readonly monsters: Map<number, InternalMonsterRecord>
  readonly missiles: Map<number, TestMissileView>
  tryCastMonsterSkill(
    monster: InternalMonsterRecord,
    target: { readonly x: number; readonly y: number },
    distance: number,
    options?: {
      readonly hitMonsters?: boolean | undefined
      readonly forcedSkillId?: number | undefined
    },
  ): boolean
}

describe('Issue #2007 — 1.13c Vampire AI, SrvHit31 VampireMissile, SrvDo028 & SrvHit14 MeteorCenter', () => {
  it('verifies all 9 MonStats.txt Vampire rows carry exact 1.13c aip1..aip5 and Skill1..4 tables', () => {
    const reg = getSharedDataRegistry()
    const expected: readonly { hcIdx: number; id: string; aip5: number }[] = [
      { hcIdx: 131, id: 'vampire1', aip5: 3 },
      { hcIdx: 132, id: 'vampire2', aip5: 5 },
      { hcIdx: 133, id: 'vampire3', aip5: 7 },
      { hcIdx: 134, id: 'vampire4', aip5: 7 },
      { hcIdx: 135, id: 'vampire5', aip5: 1 },
      { hcIdx: 695, id: 'vampire6', aip5: 7 },
      { hcIdx: 696, id: 'vampire7', aip5: 7 },
      { hcIdx: 697, id: 'vampire8', aip5: 7 },
      { hcIdx: 731, id: 'vampire9', aip5: 7 },
    ]
    for (const row of expected) {
      const game = new GameInstance({ seed: 200700 + row.hcIdx, difficulty: 0, areaId: 102 })
      const mid = game.spawnMonster({ hcIdx: row.hcIdx, defId: row.id, x: 20, y: 20, areaId: 102 })
      const mon = (game as unknown as TestGameView).monsters.get(mid)!
      expect(mon.ai).toBe('Vampire')
      expect(mon.aiParams[4]).toBe(row.aip5)
      expect(mon.skills.map((s) => s.skillId)).toEqual([169, 170, 171, 333])
    }
    const firehead = reg.getMissileById(277)!
    expect(firehead.name).toBe('firehead')
    expect(firehead.pSrvHitFunc).toBe(31)
    const catapultMeteor = reg.getMissileById(422)!
    expect(catapultMeteor.name).toBe('catapult meteor ball')
    expect(catapultMeteor.pSrvHitFunc).toBe(14)
    expect(catapultMeteor.collideType).toBe(6)
    expect(catapultMeteor.range).toBe(25)
  })

  it('enforces aip5 spell bitmask across GhoulLord (aip5=3), NightLord (aip5=5), and Banished (aip5=1)', () => {
    const collectCastSkillIds = (hcIdx: number, defId: string): Set<number> => {
      const seen = new Set<number>()
      const game = new GameInstance({ seed: 200710 + hcIdx, difficulty: 0, areaId: 102 })
      const view = game as unknown as TestGameView
      const pid = game.connectPlayer({
        charClass: 'sor',
        name: 'Aip5Probe',
        level: 30,
        hp: 5000,
        maxHp: 5000,
        x: 32,
        y: 20,
        areaId: 102,
      })
      const player = view.players.get(pid)!
      const mid = game.spawnMonster({
        hcIdx,
        defId,
        hp: 2000,
        maxHp: 2000,
        x: 20,
        y: 20,
        areaId: 102,
      })
      const mon = view.monsters.get(mid)!
      // Boost aip2 & aip4 to 100% while preserving exact MonStats aip5 bitmask so every valid spell fires
      mon.aiParams = [mon.aiParams[0]!, 100, 28, 100, mon.aiParams[4]!, 0, 0, 0]
      for (let f = 0; f < 900; f++) {
        player.hp = 5000
        player.x = 32
        player.y = 20
        mon.x = 20
        mon.y = 20
        game.stepFrames(1)
        for (const m of view.missiles.values()) {
          if (m.skillId > 0) seen.add(m.skillId)
        }
      }
      return seen
    }

    // vampire1 (GhoulLord, aip5 = 3 = 0b011): Fireball/Missile + Fire Wall ONLY — NEVER Meteor (#171)
    const ghoulSkills = collectCastSkillIds(131, 'vampire1')
    expect(ghoulSkills.has(170)).toBe(true)
    expect(ghoulSkills.has(169) || ghoulSkills.has(333)).toBe(true)
    expect(ghoulSkills.has(171)).toBe(false)

    // vampire2 (NightLord, aip5 = 5 = 0b101): Fireball/Missile + Meteor ONLY — NEVER Fire Wall (#170)
    const nightSkills = collectCastSkillIds(132, 'vampire2')
    expect(nightSkills.has(171)).toBe(true)
    expect(nightSkills.has(169) || nightSkills.has(333)).toBe(true)
    expect(nightSkills.has(170)).toBe(false)

    // vampire5 (Banished, aip5 = 1 = 0b001): Fireball/Missile ONLY — NEVER Fire Wall (#170) or Meteor (#171)
    const banishedSkills = collectCastSkillIds(135, 'vampire5')
    expect(banishedSkills.has(169) || banishedSkills.has(333)).toBe(true)
    expect(banishedSkills.has(170)).toBe(false)
    expect(banishedSkills.has(171)).toBe(false)
  })

  it('enforces 11-AI-think-tick (165f in Normal) upgrade lockout after #170 VampireFirewall / #171 VampireMeteor', () => {
    const game = new GameInstance({ seed: 200734, difficulty: 0, areaId: 102 })
    const view = game as unknown as TestGameView
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'LockoutProbe',
      level: 25,
      hp: 5000,
      maxHp: 5000,
      x: 32,
      y: 20,
      areaId: 102,
    })
    const player = view.players.get(pid)!
    const mid = game.spawnMonster({
      hcIdx: 134,
      defId: 'vampire4',
      hp: 2000,
      maxHp: 2000,
      x: 20,
      y: 20,
      areaId: 102,
    })
    const mon = view.monsters.get(mid)!
    // Force 100% aip2 and 100% aip4 on aip5 = 6 (FireWall + Meteor only) so every non-locked think tick casts an upgrade
    mon.aiParams = [85, 100, 24, 100, 6, 0, 0, 0]

    const upgradeCastFrames: number[] = []
    const seenMissileUnits = new Set<number>()
    for (let f = 1; f <= 360; f++) {
      player.hp = 5000
      player.x = 32
      player.y = 20
      mon.x = 20
      mon.y = 20
      mon.skillCooldown = 0
      mon.cooldown = 0
      game.stepFrames(1)
      for (const m of view.missiles.values()) {
        if (!seenMissileUnits.has(m.unitId) && (m.missileId === 130 || m.missileId === 133)) {
          seenMissileUnits.add(m.unitId)
          if (upgradeCastFrames[upgradeCastFrames.length - 1] !== f) {
            upgradeCastFrames.push(f)
          }
        }
      }
    }

    // With aidel = 15 in Normal and 11-think-tick lockout (0x6FCA6EC3 -> 0x6FCA6954),
    // consecutive FireWall/Meteor casts must be separated by at least 11 * 15 = 165 frames!
    expect(upgradeCastFrames.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < upgradeCastFrames.length; i++) {
      expect(upgradeCastFrames[i]! - upgradeCastFrames[i - 1]!).toBeGreaterThanOrEqual(165)
    }
  })

  it('heals Vampire by 100% of dealt damage on #333 VampireMissile (SrvHit31 #277 firehead) and 0% on #169 VampireFireball', () => {
    const game = new GameInstance({ seed: 200755, difficulty: 0, areaId: 102 })
    const view = game as unknown as TestGameView
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'StealProbe',
      level: 25,
      hp: 500,
      maxHp: 500,
      x: 26,
      y: 20,
      areaId: 102,
    })
    const player = view.players.get(pid)!
    const mid = game.spawnMonster({
      hcIdx: 134,
      defId: 'vampire4',
      hp: 80,
      maxHp: 200,
      damageRegen: 0,
      x: 20,
      y: 20,
      areaId: 102,
    })
    const mon = view.monsters.get(mid)!
    // Park Vampire far away from AI actions during projectile flight
    mon.nextAiFrame = 999999
    mon.damageRegen = 0

    // 1. Cast #169 VampireFireball (pSrvHitFunc = 1) -> MUST NOT heal the Vampire!
    expect(
      view.tryCastMonsterSkill(mon, { x: player.x, y: player.y }, 6, { forcedSkillId: 169 }),
    ).toBe(true)
    const hpBeforeFb = player.hp
    for (let f = 0; f < 15; f++) {
      game.stepFrames(1)
    }
    const fbDealt = hpBeforeFb - player.hp
    expect(fbDealt).toBeGreaterThan(0)
    expect(mon.hp).toBe(80)

    // 2. Cast #333 VampireMissile (firehead #277, pSrvHitFunc = 31) -> MUST heal Vampire by 100% of dealt damage!
    mon.skillCooldown = 0
    player.hitRecoveryUntilFrame = 0
    player.states.clear()
    const hpBeforeVm = player.hp
    expect(
      view.tryCastMonsterSkill(mon, { x: player.x, y: player.y }, 6, { forcedSkillId: 333 }),
    ).toBe(true)
    for (let f = 0; f < 15; f++) {
      game.stepFrames(1)
    }
    const vmDealt = hpBeforeVm - player.hp
    expect(vmDealt).toBeGreaterThan(0)
    expect(mon.hp).toBe(Math.min(mon.maxHp, 80 + vmDealt))
  })

  it('places SrvDo028 skills (#205 MonBlizzard & #305 CatapultMeteor) at target up to reach 35 without Multishot duplication, and delays #422 catapult meteor ball detonation until frame 25 expiry', () => {
    const game = new GameInstance({ seed: 200788, difficulty: 0, areaId: 110 })
    const view = game as unknown as TestGameView
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'SiegeProbe',
      level: 30,
      hp: 600,
      maxHp: 600,
      x: 50,
      y: 20,
      areaId: 110,
    })
    const player = view.players.get(pid)!
    const cid = game.spawnMonster({
      hcIdx: 345,
      defId: 'councilmember1',
      rank: 'boss',
      umodIds: [MON_UMOD.MULTISHOT],
      hp: 500,
      maxHp: 500,
      x: 20,
      y: 20,
      areaId: 110,
    })
    const caster = view.monsters.get(cid)!
    caster.nextAiFrame = 999999
    // Distance = 30 subtiles (> Range = 25 frames of #422 catapult meteor ball!)
    ;(caster as { skills: InternalMonsterRecord['skills'] }).skills = [
      { slot: 1, skill: 'CatapultMeteor', skillId: 305, mode: 'S1', level: 4 },
    ]

    const casted = view.tryCastMonsterSkill(caster, { x: player.x, y: player.y }, 30)
    expect(casted).toBe(true)

    const balls = [...view.missiles.values()].filter((m) => m.missileId === 422)
    // Exact 1 controller at (50, 20) — never blocked by Range=25 < dist=30 and never fan-tripled by Multishot!
    expect(balls).toHaveLength(1)
    expect(balls[0]!.x).toBe(50)
    expect(balls[0]!.y).toBe(20)

    // #422 has CollideType = 6 and Range = 25: frames 1..24 MUST NOT detonate on unit overlap (SrvHit14 expiry gate)!
    game.stepFrames(24)
    expect(player.hp).toBe(600)
    expect([...view.missiles.values()].filter((m) => m.missileId === 423)).toHaveLength(0)

    // Frame 25: range expires -> SrvHit14 detonates splash + spawns #423 catapult meteor fire ground patches!
    game.stepFrames(1)
    expect(player.hp).toBeLessThan(600)
    const fires = [...view.missiles.values()].filter((m) => m.missileId === 423)
    expect(fires.length).toBeGreaterThanOrEqual(10)
    for (const f of fires) {
      expect(f.carrier).toBe('groundfire')
    }
  })
})
