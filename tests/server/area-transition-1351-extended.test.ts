/**
 * Issue #1351 follow-up — 1.13c NPC cross-act travel quest gates (including Act 4 -> Act 5 Tyrael `a4q3`),
 * same-act `ClientWorld.areaId` synchronization without `LoadAct`, and DRLG special preset object `573..582` translation.
 */
import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  setQuestFlag113c,
} from '../../src/server/engine/quests-113c.ts'
import {
  buildAreaBootstrap,
  resolvePresetObject113c,
} from '../../src/server/world/area-bootstrap.ts'

function connect(game: GameInstance, areaId = 1): number {
  return game.connectPlayer({ charClass: 'sor', name: 'Traveler', x: 20, y: 20, areaId })
}

describe('issue #1351 NPC travel quest gating & act validation', () => {
  it('rejects Warriv east travel before Andariel and accepts it after a1q6', () => {
    const game = new GameInstance({ seed: 1351, areaId: 1 })
    const playerId = connect(game, 1)
    const player = (game as unknown as {
      players: Map<number, { areaId: number; questFlags: Uint16Array }>
    }).players.get(playerId)!
    const npcId = game.spawnMonster({ defId: 'warriv1', x: 21, y: 20, areaId: 1, isNpc: true })

    game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 40 })
    game.stepFrames(1)
    expect(player.areaId).toBe(1)

    setQuestFlag113c(player.questFlags, 'a1q6', QUEST_FLAG_COMPLETED_113C)
    game.enqueueCommand(playerId, { type: 'NpcEntityAction', npcId, action: 0, complement: 40 })
    game.stepFrames(1)
    expect(player.areaId).toBe(40)
  })

  it('gates Tyrael (hcIdx 367) Act 4 -> Act 5 Harrogath travel on a4q3 (Diablo / Terror\'s End)', () => {
    const game = new GameInstance({ seed: 1351, areaId: 103 })
    const playerId = connect(game, 103)
    const player = (game as unknown as {
      players: Map<number, { areaId: number; act: number; questFlags: Uint16Array }>
    }).players.get(playerId)!
    const tyraelId = game.spawnMonster({ classId: 367, x: 21, y: 20, areaId: 103, isNpc: true })

    // Before Diablo (a4q3) is completed, NpcInit must not emit CanGoToAct(4) and travel must be rejected.
    game.enqueueCommand(playerId, {
      type: 'NpcInit',
      target: { unitType: 'monster', id: tyraelId },
    })
    const beforeInitEvents = game.stepFrame().get(playerId) ?? []
    expect(beforeInitEvents.some((e) => e.type === 'CanGoToAct' && e.act === 4)).toBe(false)

    game.enqueueCommand(playerId, {
      type: 'NpcEntityAction',
      npcId: tyraelId,
      action: 0,
      complement: 109,
    })
    game.stepFrames(1)
    expect(player.areaId).toBe(103)

    // Complete a4q3 (word 26, bit 0): NpcInit emits CanGoToAct(4) and travel moves player to Harrogath (109).
    setQuestFlag113c(player.questFlags, 'a4q3', QUEST_FLAG_COMPLETED_113C)
    game.enqueueCommand(playerId, {
      type: 'NpcInit',
      target: { unitType: 'monster', id: tyraelId },
    })
    const afterInitEvents = game.stepFrame().get(playerId) ?? []
    expect(afterInitEvents.some((e) => e.type === 'CanGoToAct' && e.act === 4)).toBe(true)

    game.enqueueCommand(playerId, {
      type: 'NpcEntityAction',
      npcId: tyraelId,
      action: 0,
      complement: 109,
    })
    const travelEvents = game.stepFrame().get(playerId) ?? []
    expect(player.areaId).toBe(109)
    expect(player.act).toBe(4)
    expect(travelEvents.some((e) => e.type === 'LoadAct' && e.act === 4 && e.areaId === 109)).toBe(
      true,
    )
  })

  it('prevents travel NPCs from initiating travel when spawned outside their canonical act', () => {
    const game = new GameInstance({ seed: 1351, areaId: 1 })
    const playerId = connect(game, 1)
    const player = (game as unknown as {
      players: Map<number, { areaId: number; questFlags: Uint16Array }>
    }).players.get(playerId)!
    // Spawn Act 2 Meshif (hcIdx 210, actIndex 1) in Act 1 (areaId 1, actIndex 0).
    const wrongActMeshif = game.spawnMonster({ classId: 210, x: 21, y: 20, areaId: 1, isNpc: true })
    setQuestFlag113c(player.questFlags, 'a1q6', QUEST_FLAG_COMPLETED_113C)
    setQuestFlag113c(player.questFlags, 'a2q6', QUEST_FLAG_COMPLETED_113C)

    game.enqueueCommand(playerId, {
      type: 'NpcEntityAction',
      npcId: wrongActMeshif,
      action: 0,
      complement: 40,
    })
    game.stepFrames(1)
    expect(player.areaId).toBe(1)
  })
})

describe('issue #1351 same-act transition ClientWorld.areaId sync without LoadAct', () => {
  it('updates ClientWorld.areaId on same-act warp transitions without LoadAct', () => {
    const game = new GameInstance({
      seed: 1351,
      areaId: 1,
      resolveAreaBootstrap: ({ areaId }) => ({
        areaId,
        spawnX: 100,
        spawnY: 100,
        rooms: [{ areaId, tileX: 16, tileY: 16 }],
        roomRects: [{ index: 0, x: 80, y: 80, w: 60, h: 60, seed: 0x1234 }],
        objects: [],
        monsters: [],
        warps:
          areaId === 1
            ? [{ lvlWarpId: 0, x: 102, y: 100, destAreaId: 2 }]
            : [{ lvlWarpId: 1, x: 100, y: 100, destAreaId: 1 }],
        isWalkable: () => true,
      }),
    })
    const world = new ClientWorld()
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'Runner', areaId: 1 })
    for (const ev of game.drainEvents(playerId)) {
      world.applyEvent(ev)
    }
    expect(world.areaId).toBe(1)

    const warpEvent = [...(game as unknown as {
      warpTiles: Map<number, { unitId: number; areaId: number; destAreaId: number }>
    }).warpTiles.values()].find((w) => w.areaId === 1 && w.destAreaId === 2)!
    game.enqueueCommand(playerId, {
      type: 'Interact',
      target: { unitType: 'tile', id: warpEvent.unitId },
    })
    game.stepFrames(1)
    const stepEvents = game.drainEvents(playerId)
    expect(stepEvents.some((e) => e.type === 'LoadAct')).toBe(false)
    for (const ev of stepEvents) {
      world.applyEvent(ev)
    }
    expect(world.areaId).toBe(2)
  })
})

describe('issue #1351 1.13c DRLG special preset object 573..582 translation', () => {
  it('translates 574..582 into valid 0..572 Objects.txt classIds and skips 573 / >582', () => {
    expect(resolvePresetObject113c(573, 2, 10, 10)).toBeNull()
    expect(resolvePresetObject113c(583, 2, 10, 10)).toBeNull()
    expect(resolvePresetObject113c(574, 41, 10, 10)).toEqual({ classId: 136 })
    expect(resolvePresetObject113c(580, 25, 10, 10)).toEqual({ classId: 371, isSparkling: true })
    const bloodMoorSparkly = resolvePresetObject113c(580, 2, 10, 10)
    expect(bloodMoorSparkly?.isSparkling).toBe(true)
    expect(bloodMoorSparkly?.classId).toBeGreaterThanOrEqual(0)
    expect(bloodMoorSparkly?.classId).toBeLessThanOrEqual(572)
    expect(resolvePresetObject113c(582, 66, 10, 10)).toEqual({ classId: 307 })

    const bootstrap = buildAreaBootstrap({
      areaId: 2,
      originX: 0,
      originY: 0,
      subWidth: 20,
      subHeight: 20,
      blocked: new Uint8Array(400),
      spawnTileX: 2,
      spawnTileY: 2,
      rooms: [{ areaId: 2, tileX: 0, tileY: 0 }],
      roomRects: [],
      presetUnits: [
        { type: 2, index: 573, mode: 0, subX: 5, subY: 5 },
        { type: 2, index: 580, mode: 0, subX: 6, subY: 6 },
        { type: 2, index: 581, mode: 0, subX: 7, subY: 7 },
        { type: 2, index: 582, mode: 0, subX: 8, subY: 8 },
      ],
      warps: [],
    })
    expect(bootstrap.objects).toHaveLength(3)
    expect(bootstrap.objects.every((o) => o.classId >= 0 && o.classId <= 572)).toBe(true)
    expect(bootstrap.objects[0]?.isSparkling).toBe(true)
    expect(bootstrap.objects[2]?.classId).toBe(307)
  })
})
