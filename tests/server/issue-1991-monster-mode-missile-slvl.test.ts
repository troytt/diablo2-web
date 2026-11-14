/**
 * Issue #1991:
 * 1. `D2Game.dll` `MONMODE_SpawnModeMissile` (`0x6FC95C60..0x6FC95CD7`): non-hireling monster mode
 *    projectiles (`MissA1/A2/S1..S4/C/SQ`) evaluate at `slvl = MonsterSkillBonus + 1` (`1 / 4 / 8`),
 *    never `monster.level` (`mlvl`), preventing 11x damage inflation on Act 2 `slinger5`/`slinger6`.
 * 2. `D2Game.dll` `MONSTER_InitSkills` (`0x6FCD019B..0x6FCD0215`): explicit `MonStats.txt` `Skill1..8`
 *    active skills add `Difficultylevels.txt` `MonsterSkillBonus` (`0 / 3 / 7`).
 * 3. `gpMissileSrvHitFnTable` (`0x6FD2DA48`) online dispatch for `SrvHit02` (`gasring16`),
 *    `SrvHit03`/`13`/`44` (`aurasplash`), `SrvHit24` (`pantherpotorange`), `SrvHit25` (`pantherpotgreen`
 *    8-dir `rancidgascloud`), monster `pSrvHitFunc` unit-contact & merc/pet splash, and player lobbed
 *    throwing potions (`SKILLS_SpawnLobbedMissile` `0x6FCC1880`, `#44..#49`).
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'
import {
  MONSTER_SKILL_BONUS_BY_DIFFICULTY_113C,
  evaluateMonsterMissileDamage113c,
  resolveMonsterModeMissileSlvl113c,
  resolveMonsterRegisteredSkillSlvl113c,
} from '../../src/server/ai/monster-missile-damage-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'
import { writeD2sSave113c } from '../../src/server/save/d2s-writer.ts'
import { createSampleD2sCharacterData } from '../e2e/server-reuse/helpers.ts'

const registry = getSharedDataRegistry()

type AnyEvent = ServerEvent & Record<string, unknown>

function setupRoom(seed: number, difficulty: 0 | 1 | 2 = 0, skills: Readonly<Record<number, number>> = {}) {
  const game = new GameInstance({ seed, difficulty, areaId: 41 })
  const playerId = game.connectPlayer({
    d2sBytes: writeD2sSave113c(
      createSampleD2sCharacterData({
        name: 'PotTester',
        charClass: 1,
        level: 20,
        skillLevels: new Uint8Array(30),
        attributesOverrides: {
          maxHpFixed: 500 * FIXED_ONE,
          hitpointsFixed: 500 * FIXED_ONE,
          maxManaFixed: 500 * FIXED_ONE,
          manaFixed: 500 * FIXED_ONE,
        },
      }),
    ),
    x: 100,
    y: 100,
    areaId: 41,
    skills,
  })
  game.drainEvents(playerId)
  return { game, playerId }
}

function equipThrowPotionInRightArm(game: GameInstance, playerId: number, code: string): void {
  const itemId = game.spawnGroundItem({
    code,
    x: 100,
    y: 100,
    areaId: 41,
    quantity: 20,
    stats: [{ statId: 70, value: 20 }],
  })
  const internals = game as unknown as {
    groundItems: Map<number, { unitId: number; code: string; location: string; bodyLoc: number }>
    players: Map<number, { items: Array<Record<string, unknown>> }>
  }
  const groundEntry = internals.groundItems.get(itemId)!
  internals.groundItems.delete(itemId)
  groundEntry.location = 'equipped'
  groundEntry.bodyLoc = 4
  internals.players.get(playerId)!.items.push(groundEntry as unknown as Record<string, unknown>)
}

describe('#1991 MONMODE_SpawnModeMissile (0x6FC95C60) & MONSTER_InitSkills (0x6FCD019B) slvl', () => {
  it('resolves mode missile slvl = MonsterSkillBonus + 1 (1 / 4 / 8) and registered skill bonus (+0 / +3 / +7)', () => {
    expect(MONSTER_SKILL_BONUS_BY_DIFFICULTY_113C).toEqual([0, 3, 7])
    expect(resolveMonsterModeMissileSlvl113c(0)).toBe(1)
    expect(resolveMonsterModeMissileSlvl113c(1)).toBe(4)
    expect(resolveMonsterModeMissileSlvl113c(2)).toBe(8)

    expect(resolveMonsterRegisteredSkillSlvl113c(0, 2)).toBe(0)
    expect(resolveMonsterRegisteredSkillSlvl113c(4, 0)).toBe(4)
    expect(resolveMonsterRegisteredSkillSlvl113c(4, 1)).toBe(7)
    expect(resolveMonsterRegisteredSkillSlvl113c(4, 2)).toBe(11)
  })

  it('evaluates slinger5 pantherpotorange (#238) and slinger6 pantherpotgreen (#239) at mode slvl 1/4/8 instead of mlvl 15', () => {
    const orange = registry.getMissileByName('pantherpotorange')!
    const green = registry.getMissileByName('pantherpotgreen')!
    const rng = new D2Rng(0x1991)

    const normOrange = evaluateMonsterMissileDamage113c({
      registry,
      missile: orange,
      slvl: resolveMonsterModeMissileSlvl113c(0),
      difficulty: 0,
      monsterMinPhys: 4,
      monsterMaxPhys: 9,
      rng,
    })
    expect(normOrange.physDamage).toBeGreaterThanOrEqual(3)
    expect(normOrange.physDamage).toBeLessThanOrEqual(5)
    expect(normOrange.elemDamage).toBeGreaterThanOrEqual(2)
    expect(normOrange.elemDamage).toBeLessThanOrEqual(5)
    expect(normOrange.totalDamage).toBeGreaterThanOrEqual(5)
    expect(normOrange.totalDamage).toBeLessThanOrEqual(10)

    const nmOrange = evaluateMonsterMissileDamage113c({
      registry,
      missile: orange,
      slvl: resolveMonsterModeMissileSlvl113c(1),
      difficulty: 1,
      monsterMinPhys: 20,
      monsterMaxPhys: 40,
      rng,
    })
    expect(nmOrange.physDamage).toBeGreaterThanOrEqual(18)
    expect(nmOrange.physDamage).toBeLessThanOrEqual(20)
    expect(nmOrange.elemDamage).toBeGreaterThanOrEqual(23)
    expect(nmOrange.elemDamage).toBeLessThanOrEqual(26)
    expect(nmOrange.totalDamage).toBeGreaterThanOrEqual(41)
    expect(nmOrange.totalDamage).toBeLessThanOrEqual(46)

    const hellOrange = evaluateMonsterMissileDamage113c({
      registry,
      missile: orange,
      slvl: resolveMonsterModeMissileSlvl113c(2),
      difficulty: 2,
      monsterMinPhys: 50,
      monsterMaxPhys: 90,
      rng,
    })
    expect(hellOrange.physDamage).toBeGreaterThanOrEqual(38)
    expect(hellOrange.physDamage).toBeLessThanOrEqual(40)
    expect(hellOrange.elemDamage).toBeGreaterThanOrEqual(51)
    expect(hellOrange.elemDamage).toBeLessThanOrEqual(54)
    expect(hellOrange.totalDamage).toBeGreaterThanOrEqual(89)
    expect(hellOrange.totalDamage).toBeLessThanOrEqual(94)

    const normGreen = evaluateMonsterMissileDamage113c({
      registry,
      missile: green,
      slvl: resolveMonsterModeMissileSlvl113c(0),
      difficulty: 0,
      monsterMinPhys: 5,
      monsterMaxPhys: 7,
      rng,
    })
    expect(normGreen.physDamage).toBe(0)
    expect(normGreen.element).toBe('pois')
    expect(normGreen.elemDurationFrames).toBe(400)
    expect(normGreen.elemDamage).toBeGreaterThanOrEqual(28)
    expect(normGreen.elemDamage).toBeLessThanOrEqual(38)
  })

  it('Normal slinger5 throws pantherpotorange for <= 25 HP per hit (never 100+ one-shot) and splashes nearby merc', () => {
    const { game, playerId } = setupRoom(0x1992, 0)
    const mercId = game.hireMercenary(playerId, {
      act: 1,
      subType: 0,
      level: 15,
      hp: 300,
      maxHp: 300,
    })
    const internals = game as unknown as {
      players: Map<number, { hp: number; x: number; y: number }>
      mercenaries: Map<number, { hp: number; x: number; y: number }>
    }
    const merc = internals.mercenaries.get(mercId)!
    const slingerId = game.spawnMonster({
      defId: 'slinger5',
      x: 108,
      y: 100,
      areaId: 41,
      level: 15,
      hp: 500,
      maxHp: 500,
    })
    expect(slingerId).toBeGreaterThan(0)
    const pBefore = internals.players.get(playerId)!.hp
    const mBefore = merc.hp

    for (let i = 0; i < 90; i++) {
      // Pin merc 0.6 sub-tiles behind player (within SrvHit24's 1.0 sub-tile splash radius) so player is struck first.
      merc.x = 99.4
      merc.y = 100
      game.stepFrames(1)
      game.drainEvents(playerId)
      if (internals.players.get(playerId)!.hp < pBefore) break
    }
    const pDrop = pBefore - internals.players.get(playerId)!.hp
    expect(pDrop).toBeGreaterThan(0)
    expect(pDrop).toBeLessThanOrEqual(25)
    expect(merc.hp).toBeLessThan(mBefore)
  })

  it('Normal slinger6 pantherpotgreen (SrvHit25) spawns 8 rancidgascloud (#222) poison clouds on impact', () => {
    const { game, playerId } = setupRoom(0x1993, 0)
    game.spawnMonster({
      defId: 'slinger6',
      x: 108,
      y: 100,
      areaId: 41,
      level: 16,
    })
    const createdCloudEvents: AnyEvent[] = []
    const rancidCloudId = registry.getMissileByName('rancidgascloud')!.id
    for (let i = 0; i < 50; i++) {
      game.stepFrames(1)
      for (const ev of game.drainEvents(playerId) as AnyEvent[]) {
        if (ev.type === 'CreateMissile' && ev.missileClassId === rancidCloudId) {
          createdCloudEvents.push(ev)
        }
      }
      if (createdCloudEvents.length >= 8) break
    }
    expect(createdCloudEvents.length).toBe(8)
  })
})

describe('#1991 Player lobbed throwing potions (SrvHit02 / SrvHit03) & SrvHit13 Glacial Spike splash', () => {
  it('lobbed Exploding Potion (opm -> #45 SrvHit03) lands at target (tx, ty) and deals radial fire + phys splash', () => {
    const { game, playerId } = setupRoom(0x1994, 0, { 2: 1 })
    equipThrowPotionInRightArm(game, playerId, 'opm')
    const internals = game as unknown as {
      monsters: Map<number, { hp: number }>
    }
    const mCenter = game.spawnMonster({ defId: 'fallen1', x: 106, y: 100, areaId: 41, hp: 500, maxHp: 500, aiDisabled: true })
    const mNear = game.spawnMonster({ defId: 'fallen1', x: 108, y: 100, areaId: 41, hp: 500, maxHp: 500, aiDisabled: true })
    const mFar = game.spawnMonster({ defId: 'fallen1', x: 120, y: 100, areaId: 41, hp: 500, maxHp: 500, aiDisabled: true })
    for (const id of [mCenter, mNear, mFar]) {
      ;(internals.monsters.get(id) as unknown as { damageRegen?: number }).damageRegen = 0
    }
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 2, x: 106, y: 100, hand: 'right' })
    for (let i = 0; i < 25; i++) {
      game.stepFrames(1)
      game.drainEvents(playerId)
    }
    const dropCenter = 500 - internals.monsters.get(mCenter)!.hp
    const dropNear = 500 - internals.monsters.get(mNear)!.hp
    expect(dropCenter).toBeGreaterThanOrEqual(16)
    expect(dropCenter).toBeLessThanOrEqual(30)
    expect(dropNear).toBeGreaterThanOrEqual(16)
    expect(dropNear).toBeLessThanOrEqual(30)
    expect(internals.monsters.get(mFar)!.hp).toBe(500)
  })

  it('lobbed Gas Potion (gps -> #49 SrvHit02) shatters at (tx, ty) into stranglinggascloud (#224) poison clouds', () => {
    const { game, playerId } = setupRoom(0x1995, 0, { 2: 1 })
    equipThrowPotionInRightArm(game, playerId, 'gps')
    const internals = game as unknown as {
      monsters: Map<number, { states: Set<number> }>
    }
    const mTarget = game.spawnMonster({ defId: 'fallen1', x: 106, y: 100, areaId: 41, hp: 500, maxHp: 500, aiDisabled: true })
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 2, x: 106, y: 100, hand: 'right' })
    const cloudId = registry.getMissileByName('stranglinggascloud')!.id
    let cloudSpawns = 0
    for (let i = 0; i < 25; i++) {
      game.stepFrames(1)
      for (const ev of game.drainEvents(playerId) as AnyEvent[]) {
        if (ev.type === 'CreateMissile' && ev.missileClassId === cloudId) cloudSpawns++
      }
    }
    // sHitPar2 = 2 -> 8 outer clouds + sHitPar1 = 1 -> 15 inner clouds = 23 clouds
    expect(cloudSpawns).toBe(23)
    expect(internals.monsters.get(mTarget)!.states.has(2)).toBe(true)
  })

  it('Glacial Spike (#55 -> glacialspike #96 SrvHit13) splashes nearby hostiles within auraRangeCalc = 4 sub-tiles', () => {
    const { game, playerId } = setupRoom(0x1996, 0, { 55: 5 })
    const internals = game as unknown as {
      monsters: Map<number, { hp: number }>
    }
    const mPrimary = game.spawnMonster({ defId: 'fallen1', x: 108, y: 100, areaId: 41, hp: 500, maxHp: 500, aiDisabled: true })
    const mSplash = game.spawnMonster({ defId: 'fallen1', x: 110, y: 102, areaId: 41, hp: 500, maxHp: 500, aiDisabled: true })
    const mOut = game.spawnMonster({ defId: 'fallen1', x: 118, y: 100, areaId: 41, hp: 500, maxHp: 500, aiDisabled: true })
    for (const id of [mPrimary, mSplash, mOut]) {
      ;(internals.monsters.get(id) as unknown as { damageRegen?: number }).damageRegen = 0
    }
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 55, x: 108, y: 100, hand: 'right' })
    for (let i = 0; i < 25; i++) {
      game.stepFrames(1)
      game.drainEvents(playerId)
    }
    expect(internals.monsters.get(mPrimary)!.hp).toBeLessThan(500)
    expect(internals.monsters.get(mSplash)!.hp).toBeLessThan(500)
    expect(internals.monsters.get(mOut)!.hp).toBe(500)
  })
})
