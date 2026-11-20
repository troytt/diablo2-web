/**
 * Issue #1992 — 1.13c Corpse Resurrection AI Parity (`D2Game.dll` `0x6FCA8380` `GreaterMummy`,
 * `0x6FCA90A0` `FallenShaman`, `0x6FCA7BB0` `FetishShaman`, callbacks `0x6FC9B8E0`/`0x6FC9BD50`/`0x6FC9BB90`).
 */
import { describe, expect, it } from 'vitest'
import { monaiProfile113c } from '../../src/common/units/monai-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface InternalMonsterView {
  unitId: number
  hcIdx: number
  defId: string
  x: number
  y: number
  hp: number
  maxHp: number
  dead: boolean
  shattered: boolean
  corpseConsumed: boolean
  cooldown: number
  cooldownTicks: number
  aiDelay: number
  skillCooldown: number
  mode: number
  states: Set<number>
  pendingResurrection?: { corpseUnitId: number; frame: number } | undefined
}

function getMonsters(game: GameInstance): Map<number, InternalMonsterView> {
  return (game as unknown as { monsters: Map<number, InternalMonsterView> }).monsters
}

describe('issue #1992: 1.13c corpse resurrection AI parity (D2Game.dll)', () => {
  it('binds canonical aip slots for FallenShaman, GreaterMummy, and FetishShaman in monai-113c.ts', () => {
    const fallen = monaiProfile113c('FallenShaman')
    expect(fallen.resurrect).toBe(true)
    expect(fallen.resurrectChanceParam).toBe(0)
    expect(fallen.resurrectRangeParam).toBe(3)

    const mummy = monaiProfile113c('GreaterMummy')
    expect(mummy.resurrect).toBe(true)
    expect(mummy.resurrectChanceParam).toBe(1)
    expect(mummy.resurrectRangeParam).toBe(4)
    expect(mummy.healRangeParam).toBe(4)

    const fetish = monaiProfile113c('FetishShaman')
    expect(fetish.resurrect).toBe(true)
    expect(fetish.resurrectChanceParam).toBe(0)
    expect(fetish.resurrectCastRangeParam).toBe(2)
    expect(fetish.resurrectRangeParam).toBe(4)
    expect(fetish.healRangeParam).toBeUndefined()
  })

  it('gates GreaterMummy (unraveler1) resurrection on aip2 (30%), honors explicit 0%, and uses normal cast cooldown instead of aip1 (70)', () => {
    let casts = 0
    const trials = 200
    for (let i = 0; i < trials; i++) {
      const game = new GameInstance({ seed: 199200 + i, areaId: 56 })
      game.connectPlayer({ charClass: 'sor', name: 'Hero', x: 8, y: 20, areaId: 56 })
      const mummyId = game.spawnMonster({
        hcIdx: 101,
        defId: 'unraveler1',
        x: 20,
        y: 20,
        areaId: 56,
        aiParams: [70, 30, 40, 60, 24],
      })
      const skelId = game.spawnMonster({
        hcIdx: 11,
        defId: 'skeleton1',
        x: 23,
        y: 20,
        areaId: 56,
      })
      const monsters = getMonsters(game)
      const skel = monsters.get(skelId)!
      skel.dead = true
      skel.hp = 0

      game.stepFrames(1)
      const mummy = monsters.get(mummyId)!
      if (mummy.pendingResurrection !== undefined) {
        casts += 1
        // Cooldown must be normal cast/think cadence, never aip1 (70)!
        expect(mummy.cooldown).toBeLessThan(40)
      }
    }
    expect(casts).toBeGreaterThanOrEqual(36)
    expect(casts).toBeLessThanOrEqual(84)

    // Explicit aip2 = 0 must never resurrect
    for (let i = 0; i < 30; i++) {
      const game = new GameInstance({ seed: 199500 + i, areaId: 56 })
      game.connectPlayer({ charClass: 'sor', name: 'Hero', x: 8, y: 20, areaId: 56 })
      const mummyId = game.spawnMonster({
        hcIdx: 101,
        defId: 'unraveler1',
        x: 20,
        y: 20,
        areaId: 56,
        aiParams: [70, 0, 40, 60, 24],
      })
      const skelId = game.spawnMonster({ hcIdx: 11, defId: 'skeleton1', x: 22, y: 20, areaId: 56 })
      const skel = getMonsters(game).get(skelId)!
      skel.dead = true
      skel.hp = 0
      game.stepFrames(1)
      expect(getMonsters(game).get(mummyId)!.pendingResurrection).toBeUndefined()
    }
  })

  it('blocks non-Radament GreaterMummy resurrection through solid walls while Radament (#229) bypasses LOS and gains +10 scan radius', () => {
    const wallAtX25 = (_areaId: number, x: number, _y: number): boolean => Math.round(x) !== 25

    // 1. Non-Radament unraveler1 (#101) cannot raise through a wall at x = 25 (0x6FC9B97D)
    const wallGame = new GameInstance({ seed: 199210, areaId: 56 })
    wallGame.setTerrainWalkableCheck(wallAtX25)
    wallGame.connectPlayer({ charClass: 'sor', name: 'Hero', x: 8, y: 20, areaId: 56 })
    const mummyId = wallGame.spawnMonster({
      hcIdx: 101,
      defId: 'unraveler1',
      x: 20,
      y: 20,
      areaId: 56,
      aiParams: [70, 100, 40, 60, 24],
    })
    const blockedCorpseId = wallGame.spawnMonster({
      hcIdx: 11,
      defId: 'skeleton1',
      x: 30,
      y: 20,
      areaId: 56,
    })
    const blockedCorpse = getMonsters(wallGame).get(blockedCorpseId)!
    blockedCorpse.dead = true
    blockedCorpse.hp = 0
    for (let f = 0; f < 30; f++) {
      getMonsters(wallGame).get(mummyId)!.cooldown = 0
      wallGame.stepFrames(1)
    }
    expect(blockedCorpse.dead).toBe(true)

    // 2. Radament (#229) bypasses wall LOS (0x6FCA8581) AND gains +10 radius (24 + 10 = 34, 0x6FCA856E)
    const radGame = new GameInstance({ seed: 199211, areaId: 49 })
    radGame.setTerrainWalkableCheck(wallAtX25)
    radGame.connectPlayer({ charClass: 'sor', name: 'Hero', x: 8, y: 20, areaId: 49 })
    const radId = radGame.spawnMonster({
      hcIdx: 229,
      defId: 'radament',
      x: 20,
      y: 20,
      areaId: 49,
      aiParams: [85, 100, 55, 85, 24],
    })
    // Corpse at x = 52 -> distance 32 (> base 24, <= 34 for Radament) AND behind wall x = 25
    const farCorpseId = radGame.spawnMonster({
      hcIdx: 11,
      defId: 'skeleton1',
      x: 52,
      y: 20,
      areaId: 49,
    })
    const farCorpse = getMonsters(radGame).get(farCorpseId)!
    farCorpse.dead = true
    farCorpse.hp = 0
    for (let f = 0; f < 20 && farCorpse.dead; f++) {
      getMonsters(radGame).get(radId)!.cooldown = 0
      radGame.stepFrames(1)
    }
    expect(farCorpse.dead).toBe(false)
  })

  it('suppresses corpse resurrection when a hostile player is in melee range of GreaterMummy or FallenShaman', () => {
    const game = new GameInstance({ seed: 199220, areaId: 56 })
    game.connectPlayer({
      charClass: 'bar',
      name: 'Brawler',
      x: 21,
      y: 20,
      areaId: 56,
      hp: 5000,
      maxHp: 5000,
    })
    const mummyId = game.spawnMonster({
      hcIdx: 101,
      defId: 'unraveler1',
      x: 20,
      y: 20,
      areaId: 56,
      aiParams: [100, 100, 40, 60, 24],
    })
    const corpseId = game.spawnMonster({
      hcIdx: 11,
      defId: 'skeleton1',
      x: 26,
      y: 20,
      areaId: 56,
    })
    const corpse = getMonsters(game).get(corpseId)!
    corpse.dead = true
    corpse.hp = 0
    game.stepFrames(12)
    expect(getMonsters(game).get(mummyId)!.pendingResurrection).toBeUndefined()
    expect(corpse.dead).toBe(true)
  })

  it('gates FallenShaman resurrection on aip1 (45%) and blocks resurrection through walls', () => {
    let casts = 0
    const trials = 200
    for (let i = 0; i < trials; i++) {
      const game = new GameInstance({ seed: 199300 + i, areaId: 2 })
      game.connectPlayer({ charClass: 'sor', name: 'Hero', x: 8, y: 20, areaId: 2 })
      const shamanId = game.spawnMonster({
        hcIdx: 58,
        defId: 'fallenshaman1',
        x: 20,
        y: 20,
        areaId: 2,
        aiParams: [45, 60, 100, 24, 15],
      })
      const fallenId = game.spawnMonster({
        hcIdx: 18,
        defId: 'fallen1',
        x: 22,
        y: 20,
        areaId: 2,
      })
      const fallen = getMonsters(game).get(fallenId)!
      fallen.dead = true
      fallen.hp = 0
      game.stepFrames(1)
      if (getMonsters(game).get(shamanId)!.pendingResurrection !== undefined) {
        casts += 1
      }
    }
    expect(casts).toBeGreaterThanOrEqual(60)
    expect(casts).toBeLessThanOrEqual(120)

    const wallGame = new GameInstance({ seed: 199399, areaId: 2 })
    wallGame.setTerrainWalkableCheck((_a: number, x: number, _y: number) => Math.round(x) !== 25)
    wallGame.connectPlayer({ charClass: 'sor', name: 'Hero', x: 8, y: 20, areaId: 2 })
    const shamanId = wallGame.spawnMonster({
      hcIdx: 58,
      defId: 'fallenshaman1',
      x: 20,
      y: 20,
      areaId: 2,
      aiParams: [100, 60, 100, 24, 15],
    })
    const fallenId = wallGame.spawnMonster({ hcIdx: 18, defId: 'fallen1', x: 30, y: 20, areaId: 2 })
    const fallen = getMonsters(wallGame).get(fallenId)!
    fallen.dead = true
    fallen.hp = 0
    for (let f = 0; f < 25; f++) {
      getMonsters(wallGame).get(shamanId)!.cooldown = 0
      wallGame.stepFrames(1)
    }
    expect(fallen.dead).toBe(true)
  })

  it('makes FetishShaman walk closer when corpseDist > aip3 (15) before casting #327 Resurrect2, and honors aip2 >= 3 LOS rule', () => {
    const game = new GameInstance({ seed: 199401, areaId: 78 })
    game.connectPlayer({ charClass: 'sor', name: 'Hero', x: 25, y: 8, areaId: 78 })
    const shamanId = game.spawnMonster({
      hcIdx: 278,
      defId: 'fetishshaman1',
      x: 20,
      y: 20,
      areaId: 78,
      aiParams: [100, 0, 15, 66, 50],
    })
    // Corpse at x = 45 -> dist = 25 (> aip3 = 15, <= aip5 = 50)
    const fetishId = game.spawnMonster({
      hcIdx: 273,
      defId: 'fetish1',
      x: 45,
      y: 20,
      areaId: 78,
    })
    const fetish = getMonsters(game).get(fetishId)!
    fetish.dead = true
    fetish.hp = 0

    // On initial think frame, shaman must walk closer instead of casting from 25 subtiles away
    game.stepFrames(1)
    const shaman = getMonsters(game).get(shamanId)!
    expect(shaman.pendingResurrection).toBeUndefined()
    expect(shaman.x).toBeGreaterThan(20)
    expect(fetish.dead).toBe(true)

    // Keep stepping until shaman walks within <= 15 subtiles and completes resurrection
    for (let f = 0; f < 160 && fetish.dead; f++) {
      game.stepFrames(1)
    }
    expect(shaman.x).toBeGreaterThanOrEqual(29)
    expect(fetish.dead).toBe(false)

    // Wall LOS blocks Normal FetishShaman (aip2 = 0 < 3), but Hell tier (aip2 = 3) bypasses wall LOS (0x6FC9BC17)
    const wallCheck = (_a: number, x: number, _y: number): boolean => Math.round(x) !== 25
    const normalWallGame = new GameInstance({ seed: 199402, areaId: 78 })
    normalWallGame.setTerrainWalkableCheck(wallCheck)
    normalWallGame.connectPlayer({ charClass: 'sor', name: 'Hero', x: 8, y: 20, areaId: 78 })
    normalWallGame.spawnMonster({
      hcIdx: 278,
      defId: 'fetishshaman1',
      x: 20,
      y: 20,
      areaId: 78,
      aiParams: [100, 0, 15, 66, 50],
    })
    const blockedFetishId = normalWallGame.spawnMonster({
      hcIdx: 273,
      defId: 'fetish1',
      x: 30,
      y: 20,
      areaId: 78,
    })
    const blockedFetish = getMonsters(normalWallGame).get(blockedFetishId)!
    blockedFetish.dead = true
    blockedFetish.hp = 0
    normalWallGame.stepFrames(30)
    expect(blockedFetish.dead).toBe(true)

    const hellWallGame = new GameInstance({ seed: 199403, areaId: 78 })
    hellWallGame.setTerrainWalkableCheck(wallCheck)
    hellWallGame.connectPlayer({ charClass: 'sor', name: 'Hero', x: 8, y: 20, areaId: 78 })
    hellWallGame.spawnMonster({
      hcIdx: 281,
      defId: 'fetishshaman4',
      x: 20,
      y: 20,
      areaId: 78,
      aiParams: [100, 3, 20, 66, 50],
    })
    const hellFetishId = hellWallGame.spawnMonster({
      hcIdx: 273,
      defId: 'fetish1',
      x: 30,
      y: 20,
      areaId: 78,
    })
    const hellFetish = getMonsters(hellWallGame).get(hellFetishId)!
    hellFetish.dead = true
    hellFetish.hp = 0
    hellWallGame.stepFrames(25)
    expect(hellFetish.dead).toBe(false)
  })

  it('aborts pendingResurrection at the action frame if the corpse was consumed during windup', () => {
    const game = new GameInstance({ seed: 199450, areaId: 56 })
    game.connectPlayer({ charClass: 'sor', name: 'Hero', x: 8, y: 20, areaId: 56 })
    const mummyId = game.spawnMonster({
      hcIdx: 101,
      defId: 'unraveler1',
      x: 20,
      y: 20,
      areaId: 56,
      aiParams: [70, 100, 40, 60, 24],
    })
    const skelId = game.spawnMonster({ hcIdx: 11, defId: 'skeleton1', x: 22, y: 20, areaId: 56 })
    const skel = getMonsters(game).get(skelId)!
    skel.dead = true
    skel.hp = 0

    game.stepFrames(1)
    expect(getMonsters(game).get(mummyId)!.pendingResurrection?.corpseUnitId).toBe(skelId)

    // Consume corpse during the 6-frame cast windup
    skel.corpseConsumed = true
    skel.states.add(104)
    game.stepFrames(10)
    expect(skel.dead).toBe(true)
  })
})
