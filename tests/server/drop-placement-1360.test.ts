/**
 * Issue #1360 — 1.13c drop placement, container origin, per-monster death-animation
 * drop timing (`{MonCode}DTHTH`), and client airborne flippy (`mode = 5`) on groundSpawn/drop.
 */
import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface GroundEntry {
  unitId: number
  code: string
  x: number
  y: number
}
interface MonsterRecord {
  hcIdx: number
  pendingDropItems?: readonly unknown[]
  pendingDropFrame: number
}

describe('issue #1360 drop placement, timing, and flippy animation', () => {
  it('delays monster drops until each monster class death-animation frame ({MonCode}DTHTH)', () => {
    const game = new GameInstance({ seed: 1360, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Farmer', x: 10, y: 10, areaId: 1 })

    // Andariel (hcIdx 156, ANDTHTH: 23 frames @ speed 152 -> floor(23 * 256 / 152) = 38 ticks)
    const andyId = game.spawnMonster({
      defId: 'andariel',
      x: 11,
      y: 10,
      areaId: 1,
      hp: 1,
      maxHp: 1,
    })
    game.applyDamageToMonster(andyId, 1000, playerId)
    const andy = (game as unknown as { monsters: Map<number, MonsterRecord> }).monsters.get(andyId)!
    expect(andy.pendingDropItems).toBeDefined()
    expect(andy.pendingDropFrame).toBe(38)

    const before = game.getGroundItems().length
    // Still airborne/dying at frame 37 (well past the old 10-frame constant)
    game.stepFrames(37)
    expect(game.getGroundItems().length).toBe(before)

    // Drops land on frame 38
    game.stepFrames(1)
    expect(game.getGroundItems().length).toBeGreaterThan(before)

    // Fallen (hcIdx 19, FADTHTH: 20 frames @ speed 256 -> 20 ticks) vs Diablo (hcIdx 243, DIDTHTH: 142 @ 176 -> 206 ticks)
    const g = game as unknown as {
      monsterDeathDropDelayFrames: (m: { hcIdx: number }) => number
    }
    expect(g.monsterDeathDropDelayFrames({ hcIdx: 19 })).toBe(20)
    expect(g.monsterDeathDropDelayFrames({ hcIdx: 0 })).toBe(23)
    expect(g.monsterDeathDropDelayFrames({ hcIdx: 156 })).toBe(38)
    expect(g.monsterDeathDropDelayFrames({ hcIdx: 243 })).toBe(206)
  })

  it('honors AnimData.d2 non-zero event action frame when present in registry', () => {
    const game = new GameInstance({ seed: 13601, areaId: 1 })
    const g = game as unknown as {
      registry: {
        getAnimDataRecord: (name: string) => {
          framesPerDirection: number
          animationSpeed: number
          hasSpeed: boolean
          events: readonly { frame: number; code: number }[]
        } | undefined
      }
      monsterDeathDropDelayFrames: (m: { hcIdx: number }) => number
    }
    const origGet = g.registry.getAnimDataRecord.bind(g.registry)
    g.registry.getAnimDataRecord = (name: string) => {
      if (name === 'FADTHTH') {
        return {
          framesPerDirection: 20,
          animationSpeed: 128,
          hasSpeed: true,
          events: [{ frame: 6, code: 1 }],
        }
      }
      return origGet(name)
    }
    // event at frame index 6 -> (6 + 1) * 256 / 128 = 14 frames
    expect(g.monsterDeathDropDelayFrames({ hcIdx: 19 })).toBe(14)
  })

  it('only places monster and container drops on walkable cells, even when origin is unwalkable', () => {
    const game = new GameInstance({ seed: 1361, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'WallFarmer', x: 9, y: 9, areaId: 1 })
    // Only [8..10, 8..10] is walkable; (12, 12) is inside a wall/void
    game.setWalkabilityCallback((x: number, y: number) => x >= 8 && x <= 10 && y >= 8 && y <= 10)
    const monsterId = game.spawnMonster({
      defId: 'andariel',
      x: 12,
      y: 12,
      areaId: 1,
      hp: 1,
      maxHp: 1,
    })
    game.applyDamageToMonster(monsterId, 1000, playerId)
    game.stepFrames(40)
    const drops = game.getGroundItems() as unknown as GroundEntry[]
    expect(drops.length).toBeGreaterThan(0)
    for (const item of drops) {
      expect(item.x >= 8 && item.x <= 10 && item.y >= 8 && item.y <= 10).toBe(true)
    }
  })

  it('spiral search gives >9 drops distinct free walkable cells without stacking', () => {
    const game = new GameInstance({ seed: 1362, areaId: 1 })
    const used = new Set<string>()
    const positions: string[] = []
    for (let i = 0; i < 16; i++) {
      const position = (game as unknown as {
        findDropPosition: (
          area: number,
          x: number,
          y: number,
          used: ReadonlySet<string>,
        ) => { x: number; y: number }
      }).findDropPosition(1, 50, 50, used)
      const key = `${position.x}:${position.y}`
      expect(used.has(key)).toBe(false)
      used.add(key)
      positions.push(key)
    }
    expect(new Set(positions).size).toBe(16)
    // First item lands directly on the walkable origin (50, 50)
    expect(positions[0]).toBe('50:50')
  })

  it('chest and sparkling chest drops start at (obj.x, obj.y) and avoid unwalkable/occupied cells', () => {
    const game = new GameInstance({ seed: 1363, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'ChestOpener', x: 20, y: 20, areaId: 2 })
    // Make (21, 21) unwalkable so a hardcoded (obj.x + 1, obj.y + 1) would land in a wall
    game.setWalkabilityCallback((x: number, y: number) => !(x === 21 && y === 21))

    const chestId = game.spawnObject({
      classId: 397, // Sparkling Chest
      x: 20,
      y: 20,
      areaId: 2,
      isSparkling: true,
    })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: chestId })
    game.stepFrames(1)

    const items = game.getGroundItems() as unknown as GroundEntry[]
    expect(items.length).toBeGreaterThan(1)
    const coords = items.map((item) => `${item.x}:${item.y}`)
    // First drop originates at chest position (20, 20), never at unwalkable (21, 21), and no two items overlap
    expect(coords[0]).toBe('20:20')
    expect(coords).not.toContain('21:21')
    expect(new Set(coords).size).toBe(coords.length)
  })

  it('emits groundSpawn with IFLAG_NEWITEM (0x2000) so ClientWorld plays mode=5 flippy, while room snapshots stay mode=3', () => {
    const game = new GameInstance({ seed: 1364, areaId: 2, mode: 'multiplayer' })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'FlippyTester', x: 10, y: 10, areaId: 2 })
    game.drainEvents(playerId)

    const chestId = game.spawnObject({
      classId: 397,
      x: 11,
      y: 10,
      areaId: 2,
      isSparkling: true,
    })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: chestId })
    game.stepFrames(1)

    const events = game.drainEvents(playerId)
    const groundSpawns = events.filter(
      (ev): ev is Extract<ServerEvent, { type: 'ItemEvent' }> =>
        ev.type === 'ItemEvent' && ev.action === 'groundSpawn',
    )
    expect(groundSpawns.length).toBeGreaterThan(0)

    const world = new ClientWorld()
    const startMs = 10_000
    for (const ev of groundSpawns) {
      expect(ev.item).toBeDefined()
      expect((ev.item!.flags & 0x2000) !== 0).toBe(true)
      expect(ev.item!.newItem).toBe(true)
      world.apply(ev, startMs)
      const groundItem = world.getUnit('item', ev.itemId)
      expect(groundItem).toBeDefined()
      expect(groundItem!.mode).toBe(5)
      expect(groundItem!.animStartedAtMs).toBe(startMs)
      expect(groundItem!.modeUntilMs).toBeGreaterThan(startMs)
    }

    // A second player joining the area receives existing ground items without IFLAG_NEWITEM (static mode = 3)
    const latePlayerId = game.connectPlayer({ charClass: 'sor', name: 'LateJoiner', x: 10, y: 10, areaId: 2 })
    const snapshotEvents = game.drainEvents(latePlayerId).filter(
      (ev): ev is Extract<ServerEvent, { type: 'ItemEvent' }> =>
        ev.type === 'ItemEvent' && ev.action === 'groundSpawn',
    )
    expect(snapshotEvents.length).toBe(groundSpawns.length)
    const lateWorld = new ClientWorld()
    for (const ev of snapshotEvents) {
      expect((ev.item!.flags & 0x2000) !== 0).toBe(false)
      expect(ev.item!.newItem).toBe(false)
      lateWorld.apply(ev, startMs)
      const groundItem = lateWorld.getUnit('item', ev.itemId)
      expect(groundItem).toBeDefined()
      expect(groundItem!.mode).toBe(3)
      expect(groundItem!.animStartedAtMs).toBeUndefined()
      expect(groundItem!.modeUntilMs).toBeUndefined()
    }
  })
})
