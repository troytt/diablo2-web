/**
 * Issue #1474 — 1.13c Water Wells (`InitFn 16` @ `0x6fc4e760`, `OperateFn 22` @ `0x6fc8cee0`,
 * `0x6fc8a560`, `0x6fc89de0`, `0x6fcdc920`, `Event 2` @ `0x6fc89ca0`) and Object Traps
 * (`OperateFn 30` @ `0x6fc8e0e0`, `Event 9` @ `0x6fc8e150`, `OperateFn 7` @ `0x6fc8d740`,
 * `0x6fd142d0` & `0x6fd14260`).
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'
import {
  WELL_CURABLE_STATE_IDS_113C,
  computeWellHealDeltaFixed113c,
  computeWellInitialCharges113c,
  computeWellModeForCharges113c,
  computeWellRegenFrame113c,
  rollObjectTrapDamage256_113c,
} from '../../src/common/world/object-operate-113c.ts'

const WELL_CLASS_IDS_113C = [
  111, 113, 115, 118, 130, 132, 137, 138, 322, 426, 493, 498, 513, 519,
] as const

interface TestObjectView {
  mode: number
  wellCharges: number
  wellRegenFrames: number[]
}

interface TestPlayerView {
  hp: number
  maxHp: number
  hpFixed: number
  maxHpFixed: number
  mana: number
  maxMana: number
  manaFixed: number
  maxManaFixed: number
  stamina: number
  maxStamina: number
  staminaFixed: number
  maxStaminaFixed: number
  staminaExhausted: boolean
  states: Set<number>
  stateTimers: Map<number, number>
}

function getObj(game: GameInstance, id: number): TestObjectView {
  return (game as unknown as { objects: Map<number, TestObjectView> }).objects.get(id)!
}

function getPlayer(game: GameInstance, id: number): TestPlayerView {
  return (game as unknown as { players: Map<number, TestPlayerView> }).players.get(id)!
}

describe('issue #1474 water wells (InitFn 16 / OperateFn 22 / Event 2)', () => {
  it('initializes all 14 Objects.txt wells with bInteractType = Parm2 << 1 = 2 charges (0x6fc4e760)', () => {
    expect(computeWellInitialCharges113c(1)).toBe(2)
    expect(computeWellModeForCharges113c(2, 1)).toBe(0)
    expect(computeWellModeForCharges113c(1, 1)).toBe(1)
    expect(computeWellModeForCharges113c(0, 1)).toBe(2)
    expect(computeWellRegenFrame113c(100, 750)).toBe(851)

    const game = new GameInstance({ seed: 1474, areaId: 2 })
    for (const classId of WELL_CLASS_IDS_113C) {
      const objId = game.spawnObject({ classId, x: 50, y: 50, areaId: 2 })
      const obj = getObj(game, objId)
      expect(obj.wellCharges, `well classId ${classId}`).toBe(2)
      expect(obj.mode, `well classId ${classId}`).toBe(0)
      expect(obj.wellRegenFrames, `well classId ${classId}`).toEqual([])
    }
  })

  it('restores 50% max HP/Mana/Stamina per charge, transitions mode 0 -> 1 -> 2, blocks when empty, and regenerates after Parm0 + 1 = 751 frames (0x6fc8cee0 / 0x6fc8a560 / 0x6fc89ca0)', () => {
    const game = new GameInstance({ seed: 147401, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'WellUser', x: 50, y: 50, areaId: 2 })
    const player = getPlayer(game, playerId)

    player.maxHp = 200
    player.maxHpFixed = 200 * FIXED_ONE
    player.hp = 20
    player.hpFixed = 20 * FIXED_ONE

    player.maxMana = 160
    player.maxManaFixed = 160 * FIXED_ONE
    player.mana = 10
    player.manaFixed = 10 * FIXED_ONE

    player.maxStamina = 120
    player.maxStaminaFixed = 120 * FIXED_ONE
    player.stamina = 0
    player.staminaFixed = 0
    player.staminaExhausted = true

    const wellId = game.spawnObject({ classId: 111, x: 50, y: 50, areaId: 2 })
    const well = getObj(game, wellId)
    expect(well.wellCharges).toBe(2)
    expect(well.mode).toBe(0)

    // First drink: +50% of max (Parm1 = 128 -> 128/256), charges 2 -> 1, mode 0 -> 1
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: wellId })
    game.stepFrames(1)
    const firstEvents = game.drainEvents(playerId)
    const statUpdates = new Map(
      firstEvents
        .filter((e): e is { type: 'UnitStatUpdate'; unitType: 'player'; unitId: number; statId: number; value: number } => e.type === 'UnitStatUpdate')
        .map((e) => [e.statId, e.value]),
    )
    expect(statUpdates.get(6)).toBe(20 * FIXED_ONE + computeWellHealDeltaFixed113c(200 * FIXED_ONE, 128))
    expect(statUpdates.get(8)).toBe(10 * FIXED_ONE + computeWellHealDeltaFixed113c(160 * FIXED_ONE, 128))
    expect(statUpdates.get(10)).toBe(computeWellHealDeltaFixed113c(120 * FIXED_ONE, 128))
    expect(player.hp).toBe(120)
    expect(player.mana).toBe(90)
    expect(player.stamina).toBe(60)
    expect(player.staminaExhausted).toBe(false)
    expect(well.wellCharges).toBe(1)
    expect(well.mode).toBe(1)
    expect(well.wellRegenFrames).toHaveLength(1)
    const firstRegenFrame = well.wellRegenFrames[0]!

    // Second drink: +50% of max capped at 100%, charges 1 -> 0, mode 1 -> 2
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: wellId })
    game.stepFrames(1)
    expect(player.hpFixed).toBe(200 * FIXED_ONE)
    expect(player.hp).toBe(200)
    expect(player.manaFixed).toBe(160 * FIXED_ONE)
    expect(player.mana).toBe(160)
    expect(player.staminaFixed).toBe(120 * FIXED_ONE)
    expect(player.stamina).toBe(120)
    expect(well.wellCharges).toBe(0)
    expect(well.mode).toBe(2)
    expect(well.wellRegenFrames).toEqual([firstRegenFrame, firstRegenFrame + 1])

    // Third drink while empty (wellCharges == 0, mode == 2): no-op (0x6fc8cef9)
    player.hp = 50
    player.hpFixed = 50 * FIXED_ONE
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: wellId })
    game.stepFrames(1)
    expect(player.hp).toBe(50)
    expect(well.wellCharges).toBe(0)
    expect(well.mode).toBe(2)

    // Advance to 1 frame before firstRegenFrame: still 0 charges
    const currentFrame = (game as unknown as { currentFrame: number }).currentFrame
    game.stepFrames(firstRegenFrame - currentFrame - 1)
    expect(well.wellCharges).toBe(0)
    expect(well.mode).toBe(2)

    // Step 1 frame to reach firstRegenFrame (751 frames after first drink): 0 -> 1 charge, mode 2 -> 1
    game.stepFrames(1)
    expect(well.wellCharges).toBe(1)
    expect(well.mode).toBe(1)

    // Step 1 more frame to reach second regen frame (751 frames after second drink): 1 -> 2 charges, mode 1 -> 0
    game.stepFrames(1)
    expect(well.wellCharges).toBe(2)
    expect(well.mode).toBe(0)
    expect(well.wellRegenFrames).toEqual([])
  })

  it('does not consume a charge or schedule a timer when player and allies are already full and uncursed (bUsed == 0 @ 0x6fc8cefc)', () => {
    const game = new GameInstance({ seed: 147402, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'FullHero', x: 50, y: 50, areaId: 2 })
    const wellId = game.spawnObject({ classId: 111, x: 50, y: 50, areaId: 2 })
    const well = getObj(game, wellId)

    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: wellId })
    game.stepFrames(1)

    expect(well.wellCharges).toBe(2)
    expect(well.mode).toBe(0)
    expect(well.wellRegenFrames).toEqual([])
  })

  it('cures freeze (1), poison (2), and curable curses (9, 19, 55, 60, 61, 113, 114) while preserving shrine buffs, and heals mercenaries/pets to 100% (0x6fc8a646 / 0x6fcdc920 / 0x6fc89de0)', () => {
    const game = new GameInstance({ seed: 147403, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'nec', name: 'CursedHero', x: 50, y: 50, areaId: 2 })
    const player = getPlayer(game, playerId)
    const wellId = game.spawnObject({ classId: 138, x: 50, y: 50, areaId: 2 })
    const well = getObj(game, wellId)

    // Apply all curable states + non-curable Armor Shrine (128) on full-HP player
    for (const stateId of WELL_CURABLE_STATE_IDS_113C) {
      player.states.add(stateId)
      player.stateTimers.set(stateId, 500)
    }
    player.states.add(128)
    player.stateTimers.set(128, 1000)

    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: wellId })
    game.stepFrames(1)

    for (const stateId of WELL_CURABLE_STATE_IDS_113C) {
      expect(player.states.has(stateId), `state ${stateId} should be cured`).toBe(false)
    }
    expect(player.states.has(128)).toBe(true)
    expect(well.wellCharges).toBe(1)
    expect(well.mode).toBe(1)

    // Now player is full and uncursed, but mercenary is at 30/100 HP: well heals merc to 100% and consumes remaining charge
    const mercs = (game as unknown as {
      mercenaries: Map<number, { unitId: number; ownerPlayerId: number; areaId: number; hp: number; maxHp: number; alive: boolean }>
    }).mercenaries
    mercs.set(7001, {
      unitId: 7001,
      ownerPlayerId: playerId,
      areaId: 2,
      hp: 30,
      maxHp: 100,
      alive: true,
    })

    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: wellId })
    game.stepFrames(1)

    expect(mercs.get(7001)!.hp).toBe(100)
    expect(well.wellCharges).toBe(0)
    expect(well.mode).toBe(2)
  })
})

describe('issue #1474 object traps (OperateFn 30 / OperateFn 7 / 0x6fd142d0)', () => {
  it('rolls 0x6fd142d0 trap damage in [hp >> 5, hp >> 3] scaled by monLvl / 100', () => {
    const hpFixed = 320 * FIXED_ONE
    const minRoll = rollObjectTrapDamage256_113c(hpFixed, 50, { rand: () => 0 })
    const maxRoll = rollObjectTrapDamage256_113c(hpFixed, 50, { rand: (max) => max - 1 })
    // minDmg256 = 320*256 >> 5 = 10*256; scaled by 50/100 = 5*256
    expect(minRoll).toBe(5 * FIXED_ONE)
    // maxDmg256 = 320*256 >> 3 = 40*256; scaled by 50/100 = 20*256 (plus 255/2 sub-unit)
    expect(Math.floor(maxRoll / FIXED_ONE)).toBe(20)
  })

  it('OperateFn 30 (250 a trap & 454 explodingchest) applies physical + fire 0x6fd142d0 damage and drops chest loot for 454 (Event 9 @ 0x6fc8e150)', () => {
    const game = new GameInstance({ seed: 147404, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'bar', name: 'TrapTester', x: 50, y: 50, areaId: 2 })
    const player = getPlayer(game, playerId)
    player.maxHp = 400
    player.maxHpFixed = 400 * FIXED_ONE
    player.hp = 400
    player.hpFixed = 400 * FIXED_ONE

    const trapId = game.spawnObject({ classId: 250, x: 50, y: 50, areaId: 2 })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: trapId })
    game.stepFrames(1)
    expect(getObj(game, trapId).mode).toBe(2)
    expect(player.hp).toBeLessThan(400)

    // Exploding chest (454) deals trap damage AND rolls container drop (0x6fc8b570)
    const groundItems = (game as unknown as { groundItems: Map<number, unknown> }).groundItems
    let droppedCount = 0
    for (let i = 0; i < 8; i++) {
      player.hp = 400
      player.hpFixed = 400 * FIXED_ONE
      const chestId = game.spawnObject({ classId: 454, x: 50, y: 50, areaId: 2 })
      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: chestId })
      game.stepFrames(1)
      expect(getObj(game, chestId).mode).toBe(2)
      expect(player.hp).toBeLessThan(400)
      droppedCount = groundItems.size
      if (droppedCount > 0) break
    }
    expect(droppedCount).toBeGreaterThan(0)
  })

  it('OperateFn 7 (11 BarrelExploding) deals radius-3 physical trap damage to players/monsters and chain-detonates adjacent exploding barrels within distance 2 (0x6fc8d740 / 0x6fc8ad60 / 0x6fc8ae60)', () => {
    const game = new GameInstance({ seed: 147405, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'ama', name: 'BarrelUser', x: 50, y: 50, areaId: 2 })
    const player = getPlayer(game, playerId)
    player.maxHp = 320
    player.maxHpFixed = 320 * FIXED_ONE
    player.hp = 320
    player.hpFixed = 320 * FIXED_ONE

    const monsterId = game.spawnMonster({
      defId: 'zombie1',
      x: 52,
      y: 50,
      areaId: 2,
      hp: 200,
      maxHp: 200,
    })
    const monster = (game as unknown as { monsters: Map<number, { hp: number }> }).monsters.get(monsterId)!

    const barrel1 = game.spawnObject({ classId: 11, x: 51, y: 50, areaId: 2 })
    const barrel2 = game.spawnObject({ classId: 11, x: 53, y: 50, areaId: 2 }) // distance 2 -> chain detonates
    const barrelFar = game.spawnObject({ classId: 11, x: 56, y: 50, areaId: 2 }) // distance 3 from barrel2 -> untouched

    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: barrel1 })
    game.stepFrames(1)

    expect(getObj(game, barrel1).mode).toBe(2)
    expect(getObj(game, barrel2).mode).toBe(2)
    expect(getObj(game, barrelFar).mode).toBe(0)
    expect(player.hp).toBeLessThan(320)
    expect(monster.hp).toBeLessThan(200)
  })
})
