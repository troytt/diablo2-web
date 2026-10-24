/**
 * Issue #1350 follow-up — interaction line-of-sight for objects, warps, NPCs
 * and corpses, plus closed-door LOS, pending interaction reach, and preset object 574..582 resolution.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { buildAreaBootstrap, resolvePresetObject113c } from '../../src/server/world/area-bootstrap.ts'

function connect(game: GameInstance, x: number, y: number): number {
  return game.connectPlayer({ charClass: 'sor', name: 'Actor', x, y, areaId: 1 })
}

function record(game: GameInstance, id: number): {
  x: number
  y: number
  activeNpcId: number | undefined
  corpseId: number | undefined
  corpseX: number
  corpseY: number
} {
  return (game as unknown as { players: Map<number, never> }).players.get(id) as never
}

function objectMode(game: GameInstance, unitId: number): number | undefined {
  return (game as unknown as { objects: Map<number, { mode: number }> }).objects.get(unitId)?.mode
}

describe('issue #1350 interaction line of sight', () => {
  it('rejects a waypoint behind a wall and accepts it once the ray is clear', () => {
    const game = new GameInstance({ seed: 1350, areaId: 1 })
    const playerId = connect(game, 50, 10)
    const p = record(game, playerId)
    const wpId = game.spawnObject({ classId: 119, x: 53, y: 10, areaId: 1, isWaypoint: true })
    game.setTerrainWalkableCheck((_areaId, x) => Math.round(x) !== 52)
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: wpId })
    game.stepFrames(1)
    expect(game.drainEvents(playerId).some((e) => e.type === 'WaypointMenu')).toBe(false)
    p.x = 53
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: wpId })
    game.stepFrames(1)
    expect(game.drainEvents(playerId).some((e) => e.type === 'WaypointMenu')).toBe(true)
  })

  it('blocks corpse recovery through a wall', () => {
    const game = new GameInstance({ seed: 1351, areaId: 1 })
    const playerId = connect(game, 50, 10)
    const p = record(game, playerId)
    p.corpseId = 777
    p.corpseX = 53
    p.corpseY = 10
    game.setTerrainWalkableCheck((_areaId, x) => Math.round(x) !== 52)
    game.enqueueCommand(playerId, { type: 'Interact', target: { unitType: 0, id: 777 } } as never)
    game.stepFrames(1)
    expect(p.corpseId).toBe(777)
    p.x = 53
    game.enqueueCommand(playerId, { type: 'Interact', target: { unitType: 0, id: 777 } } as never)
    game.stepFrames(1)
    expect(p.corpseId).toBeUndefined()
  })

  it('blocks NPC interaction through a wall', () => {
    const game = new GameInstance({ seed: 1352, areaId: 1 })
    const playerId = connect(game, 50, 10)
    const p = record(game, playerId)
    const npcId = game.spawnMonster({ defId: 'fallen1', x: 52, y: 10, areaId: 1, isNpc: true })
    game.setTerrainWalkableCheck((_areaId, x) => Math.round(x) !== 51)
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: npcId } })
    game.stepFrames(1)
    expect(p.activeNpcId).toBeUndefined()
    p.x = 52
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: npcId } })
    game.stepFrames(1)
    expect(p.activeNpcId).toBe(npcId)
  })

  it('opens a closed door when terrainWalkableCheck is active, and unblocks LOS to objects behind it', () => {
    const g = new GameInstance()
    g.setTerrainWalkableCheck(() => true)
    const pid = g.connectPlayer({ name: 'Hero', classId: 0, areaId: 1, x: 100, y: 100 })
    // Objects.txt 13 = Door (isDoor=1, sizeX=3, sizeY=2, operateFn=3)
    const doorId = g.spawnObject({ classId: 13, areaId: 1, x: 102, y: 100, mode: 0 })
    // Chest (classId=5) right behind the closed door at (103, 100)
    const chestId = g.spawnObject({ classId: 5, areaId: 1, x: 103, y: 100, mode: 0 })

    // While the door is closed (mode 0), it blocks LOS to the chest behind it
    g.enqueueCommand(pid, { type: 'OperateObject', objectId: chestId })
    g.stepFrames(1)
    expect(objectMode(g, chestId)).toBe(0)

    // Interacting with the closed door itself must succeed (a door does not block LOS to itself)
    g.enqueueCommand(pid, { type: 'OperateObject', objectId: doorId })
    g.stepFrames(1)
    expect(objectMode(g, doorId)).toBe(2)

    // Now that the door is open (mode 2), the chest behind it has clear LOS and opens
    g.enqueueCommand(pid, { type: 'OperateObject', objectId: chestId })
    g.stepFrames(1)
    expect(objectMode(g, chestId)).toBe(2)
  })

  it('closed door blocks LOS to objects/NPCs even without a terrainWalkableCheck callback', () => {
    const g = new GameInstance()
    const pid = g.connectPlayer({ name: 'Hero', classId: 0, areaId: 1, x: 100, y: 100 })
    const doorId = g.spawnObject({ classId: 13, areaId: 1, x: 101, y: 100, mode: 0 })
    const chestId = g.spawnObject({ classId: 5, areaId: 1, x: 102, y: 100, mode: 0 })

    g.enqueueCommand(pid, { type: 'OperateObject', objectId: chestId })
    g.stepFrames(1)
    expect(objectMode(g, chestId)).toBe(0)

    g.enqueueCommand(pid, { type: 'OperateObject', objectId: doorId })
    g.stepFrames(1)
    expect(objectMode(g, doorId)).toBe(2)

    g.enqueueCommand(pid, { type: 'OperateObject', objectId: chestId })
    g.stepFrames(1)
    expect(objectMode(g, chestId)).toBe(2)
  })

  it('approaches a sizeX=1 town NPC from far away and completes both NpcInit and NpcOpenGamble', () => {
    const g = new GameInstance()
    const pid = g.connectPlayer({ name: 'Hero', classId: 0, areaId: 1, x: 100, y: 100, hp: 10, maxHp: 100 })
    // Akara (hcIdx 148, sizeX = 1) at (110, 100) — dist = 10 sub-tiles
    const akaraId = g.spawnMonster({
      classId: 148,
      name: 'Akara',
      areaId: 1,
      x: 110,
      y: 100,
      isNpc: true,
      isVendor: true,
    })

    g.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: akaraId } })
    g.stepFrames(1)
    expect(g.getPlayerState(pid)?.activeNpcId).toBeUndefined()

    // Stepping enough frames walks all the way into D2Common #10407 <= 2 (dist <= 2.0 for sizeX=1)
    g.stepFrames(25)
    expect(g.getPlayerState(pid)?.activeNpcId).toBe(akaraId)
    expect(g.getPlayerState(pid)?.hp).toBe(100)

    // Move player away and test NpcOpenGamble (handleNpcAction) via pendingInteraction
    g.enqueueCommand(pid, { type: 'NpcCancel', npcId: akaraId })
    g.stepFrames(1)
    g.movePlayer(pid, 100, 100)
    // Gheed (hcIdx 147, sizeX = 1, canGamble = true) at (110, 100)
    const gheedId = g.spawnMonster({
      classId: 147,
      name: 'Gheed',
      areaId: 1,
      x: 110,
      y: 100,
      isNpc: true,
      isVendor: true,
    })
    g.enqueueCommand(pid, { type: 'NpcOpenGamble', npcId: gheedId })
    g.stepFrames(1)
    expect(g.getPlayerState(pid)?.activeNpcId).toBeUndefined()

    g.stepFrames(25)
    expect(g.getPlayerState(pid)?.activeNpcId).toBe(gheedId)
  })

  it('queues corpse interaction from far away, walks into range, and blocks walk-over corpse recovery through walls', () => {
    const g = new GameInstance()
    const pid = g.connectPlayer({ name: 'Hero', classId: 0, areaId: 3, x: 100, y: 100, hp: 50, maxHp: 50 })
    g.applyDamageToPlayer(pid, 100)
    const deadState = g.getPlayerState(pid)!
    expect(deadState.dead).toBe(true)
    const corpseId = deadState.corpseId!
    expect(corpseId).toBeDefined()

    g.enqueueCommand(pid, { type: 'Respawn' })
    g.stepFrames(1)
    // Move player back to area 3 at (110, 100), 10 sub-tiles from corpse at (100, 100)
    ;(g as unknown as { players: Map<number, { areaId: number }> }).players.get(pid)!.areaId = 3
    g.movePlayer(pid, 110, 100)

    g.enqueueCommand(pid, { type: 'Interact', target: { unitType: 0, id: corpseId } })
    g.stepFrames(1)
    expect(g.getPlayerState(pid)?.corpseId).toBe(corpseId)

    g.stepFrames(25)
    expect(g.getPlayerState(pid)?.corpseId).toBeUndefined()
  })

  it('cancels pendingInteraction when the player issues an explicit ground Move/WalkToLocation/RunToLocation', () => {
    const g = new GameInstance()
    const pid = g.connectPlayer({ name: 'Hero', classId: 0, areaId: 1, x: 100, y: 100 })
    const chestId = g.spawnObject({ classId: 5, areaId: 1, x: 120, y: 100, mode: 0 })

    g.enqueueCommand(pid, { type: 'OperateObject', objectId: chestId })
    g.stepFrames(1)
    const internalPlayer = (g as unknown as { players: Map<number, { pendingInteraction: unknown }> }).players.get(pid)!
    expect(internalPlayer.pendingInteraction).toEqual({ kind: 'object', id: chestId })

    g.enqueueCommand(pid, { type: 'WalkToLocation', x: 90, y: 100 })
    g.stepFrames(1)
    expect(internalPlayer.pendingInteraction).toBeUndefined()
  })

  it('resolves DRLG preset pseudo-objects 573..582 per D2Game.dll 0x6fc4e830 without throwing RangeError', () => {
    expect(resolvePresetObject113c(573, 1, 10, 10)).toBeNull()
    expect(resolvePresetObject113c(574, 1, 10, 10)).toEqual({ classId: 136 })
    expect(resolvePresetObject113c(579, 1, 10, 10)).toEqual({ classId: 136 })
    expect(resolvePresetObject113c(580, 25, 10, 10)).toEqual({ classId: 371, isSparkling: true })
    const superChestAct1 = resolvePresetObject113c(580, 2, 15, 20)
    expect(superChestAct1).not.toBeNull()
    expect(superChestAct1!.classId).toBeGreaterThanOrEqual(0)
    expect(superChestAct1!.classId).toBeLessThanOrEqual(572)
    expect(superChestAct1!.isSparkling).toBe(true)

    const presetChestArcane = resolvePresetObject113c(581, 74, 15, 20)
    expect([387, 389, 390, 391]).toContain(presetChestArcane?.classId)
    expect(presetChestArcane?.isSparkling).toBeUndefined()

    expect(resolvePresetObject113c(582, 74, 10, 10)).toEqual({ classId: 307 })

    const b = buildAreaBootstrap({
      areaId: 2,
      originX: 0,
      originY: 0,
      subWidth: 20,
      subHeight: 20,
      blocked: new Uint8Array(400),
      spawnTileX: 2,
      spawnTileY: 2,
      rooms: [{ areaId: 2, tileX: 0, tileY: 0 }],
      roomRects: [{ index: 0, x: 0, y: 0, w: 20, h: 20, seed: 1 }],
      presetUnits: [
        { type: 2, index: 573, mode: 0, subX: 5, subY: 5 },
        { type: 2, index: 580, mode: 0, subX: 6, subY: 6 },
        { type: 2, index: 581, mode: 0, subX: 7, subY: 7 },
        { type: 2, index: 582, mode: 0, subX: 8, subY: 8 },
      ],
      warps: [],
    })
    expect(b.objects).toHaveLength(3)
    expect(b.objects[0]!.isSparkling).toBe(true)
    expect(b.objects[2]!.classId).toBe(307)
  })
})
