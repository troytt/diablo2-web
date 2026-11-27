/**
 * Issue #1352 — Objects.txt OperateFn coverage: one-shot shrines with Shrines.txt
 * state effects, door collision, stash button, wells, locked containers and the
 * explicit generic mode fallback.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { OBJECTS_TXT_113C } from '../../src/common/world/objects-txt-113c.ts'
import { classifyObjectOperate113c } from '../../src/common/world/object-operate-113c.ts'

function connect(game: GameInstance): number {
  return game.connectPlayer({ charClass: 'sor', name: 'Operator', x: 50, y: 50, areaId: 1 })
}

function objectRecord(game: GameInstance, id: number): { mode: number; shrineType: number } {
  return (game as unknown as {
    objects: Map<number, { mode: number; shrineType: number }>
  }).objects.get(id)!
}

function playerRecord(game: GameInstance, id: number): {
  mana: number
  manaFixed: number
  maxManaFixed: number
  states: Set<number>
  items: unknown[]
} {
  return (game as unknown as {
    players: Map<number, {
      mana: number
      manaFixed: number
      maxManaFixed: number
      states: Set<number>
      items: unknown[]
    }>
  }).players.get(id)!
}

describe('issue #1352 object OperateFn', () => {
  it('classifies every Objects.txt row and leaves no implicit no-op', () => {
    const kinds = new Set<string>()
    const operateFns = new Set<number>()
    for (let classId = 0; classId < OBJECTS_TXT_113C.length; classId++) {
      const kind = classifyObjectOperate113c(classId)
      expect(kind, `class ${classId} (${OBJECTS_TXT_113C[classId]!.name})`).toBeTruthy()
      kinds.add(kind)
      operateFns.add(OBJECTS_TXT_113C[classId]!.operateFn)
    }
    expect(kinds).toEqual(
      new Set(['shrine', 'door', 'portal', 'stash', 'well', 'trap', 'destructible', 'container', 'mode']),
    )
    expect(operateFns.size).toBeGreaterThan(20)
  })

  it('uses a shrine once, broadcasts mode 1 → 2 and applies Shrines.txt state 128', () => {
    const game = new GameInstance({ seed: 1352, areaId: 1 })
    const playerId = connect(game)
    const shrineId = game.spawnObject({
      classId: 2,
      x: 50,
      y: 50,
      areaId: 1,
      isShrine: true,
      shrineType: 6, // Armor Shrine -> State 128
    })
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1)
    expect(objectRecord(game, shrineId).mode).toBe(2)
    expect(playerRecord(game, playerId).states.has(128)).toBe(true)
    const first = game.drainEvents(playerId)
    expect(first.filter((e) => e.type === 'UnitMode').map((e) => (e as { mode?: number }).mode)).toEqual([1, 2])
    expect(first.some((e) => e.type === 'Chat' && e.text.includes('Armor Shrine'))).toBe(true)

    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1)
    expect(game.drainEvents(playerId).filter((e) => e.type === 'Chat')).toHaveLength(0)
  })

  it('refills mana at a Mana Shrine', () => {
    const game = new GameInstance({ seed: 1353, areaId: 1 })
    const playerId = connect(game)
    const player = playerRecord(game, playerId)
    player.manaFixed = 0
    player.mana = 0
    const shrineId = game.spawnObject({
      classId: 2,
      x: 50,
      y: 50,
      areaId: 1,
      isShrine: true,
      shrineType: 3,
    })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1)
    expect(player.manaFixed).toBe(player.maxManaFixed)
  })

  it('toggles door collision with the door mode', () => {
    const game = new GameInstance({ seed: 1354, areaId: 1 })
    const playerId = connect(game)
    const doorId = game.spawnObject({ classId: 13, x: 52, y: 50, areaId: 1 })
    const closedAt = (game as unknown as {
      isClosedDoorAt: (area: number, x: number, y: number) => boolean
    }).isClosedDoorAt(1, 52, 50)
    expect(closedAt).toBe(true)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: doorId })
    game.stepFrames(1)
    expect(objectRecord(game, doorId).mode).toBe(2)
    expect((game as unknown as {
      isClosedDoorAt: (area: number, x: number, y: number) => boolean
    }).isClosedDoorAt(1, 52, 50)).toBe(false)
  })

  it('opens the stash panel through Trade action 0x10', () => {
    const game = new GameInstance({ seed: 1355, areaId: 1 })
    const playerId = connect(game)
    const stashId = game.spawnObject({ classId: 267, x: 50, y: 50, areaId: 1 })
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: stashId })
    game.stepFrames(1)
    expect(
      game.drainEvents(playerId).some(
        (e) => e.type === 'Trade' && (e as { action?: number }).action === 0x10,
      ),
    ).toBe(true)
    expect(objectRecord(game, stashId).mode).toBe(0)
    // The stash stays re-usable, unlike one-shot containers.
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: stashId })
    game.stepFrames(1)
    expect(
      game.drainEvents(playerId).some(
        (e) => e.type === 'Trade' && (e as { action?: number }).action === 0x10,
      ),
    ).toBe(true)
  })

  it('requires and consumes a key for locked containers', () => {
    const game = new GameInstance({ seed: 1356, areaId: 1 })
    const playerId = connect(game)
    const chestId = game.spawnObject({ classId: 5, x: 50, y: 50, areaId: 1, isLocked: true })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: chestId })
    game.stepFrames(1)
    expect(objectRecord(game, chestId).mode).toBe(0)
    expect(
      game.drainEvents(playerId).some((e) => e.type === 'Chat' && e.text.includes('Locked')),
    ).toBe(true)

    playerRecord(game, playerId).items.push({
      unitId: 9001,
      code: 'key',
      quantity: 1,
      location: 'inventory',
    })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: chestId })
    game.stepFrames(1)
    expect(objectRecord(game, chestId).mode).toBe(2)
    expect(playerRecord(game, playerId).items).not.toContainEqual(
      expect.objectContaining({ code: 'key' }),
    )
  })
})