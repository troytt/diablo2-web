import { describe, expect, it } from 'vitest'
import { CANONICAL_113C_OBJECTS } from '../../src/common/world/objects-meta.ts'
import { OBJECTS_TXT_113C } from '../../src/common/world/objects-txt-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { computeObjectApproachSearchRadius113c } from '../../src/server/engine/game-instance/constants-and-helpers.ts'
import { QUEST_FLAG_STARTED_113C, questWordIndex113c } from '../../src/server/engine/quests-113c.ts'
import { createAreaBootstrapResolver } from '../../src/server/world/area-bootstrap.ts'
import type { LocalAreaLevelGeometry } from '../../src/netproto/index.ts'

function buildGridLevel(params: {
  readonly areaId: number
  readonly size: number
  readonly cellMask: (x: number, y: number) => { readonly collision: number; readonly blocked: number }
  readonly presetObjects?: readonly { readonly index: number; readonly x: number; readonly y: number; readonly mode?: number }[]
  readonly presetWarps?: readonly { readonly lvlWarpId: number; readonly subX: number; readonly subY: number; readonly toLevelId: number }[]
}): LocalAreaLevelGeometry {
  const { areaId, size, cellMask, presetObjects = [], presetWarps = [] } = params
  const blocked = new Uint8Array(size * size)
  const collision = new Uint16Array(size * size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const m = cellMask(x, y)
      blocked[y * size + x] = m.blocked
      collision[y * size + x] = m.collision
    }
  }
  return {
    areaId,
    originX: 0,
    originY: 0,
    subWidth: size,
    subHeight: size,
    blocked,
    collision,
    spawnTileX: 2,
    spawnTileY: 2,
    rooms: [{ areaId, tileX: 0, tileY: 0 }],
    roomRects: [{ index: 0, x: 0, y: 0, w: size, h: size, seed: 1986 }],
    presetUnits: presetObjects.map((o) => ({
      type: 2,
      index: o.index,
      mode: o.mode ?? 0,
      subX: o.x,
      subY: o.y,
    })),
    warps: [...presetWarps],
  }
}

describe('issue #1986 — 1.13c 0x0804 interaction LOS & large-footprint object approach', () => {
  it('operates 5x5 Tree of Inifuss (Id=30) with 0x0001 trunk collision via MoveToUnit + OperateObject and drops Scroll of Inifuss (bks)', () => {
    const cx = 30
    const cy = 30
    const level = buildGridLevel({
      areaId: 5,
      size: 60,
      cellMask: (x, y) => {
        if (Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 2) {
          // Exact Inifuss.ds1 collision: 0x0001 (COLLIDE_WALL only), blocked = 1
          return { collision: 0x0001, blocked: 1 }
        }
        return { collision: 0x0010, blocked: 0 }
      },
      presetObjects: [{ index: 30, x: cx, y: cy, mode: 0 }],
    })

    const game = new GameInstance({
      seed: 198601,
      areaId: 5,
      resolveAreaBootstrap: createAreaBootstrapResolver((req) =>
        req.areaId === 5 ? level : null,
      ),
    })

    const qf = new Uint16Array(48)
    qf[questWordIndex113c('a1q3')!] = QUEST_FLAG_STARTED_113C
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'Sorc',
      level: 8,
      areaId: 5,
      x: cx + 10,
      y: cy,
      questFlags: qf,
    })
    game.movePlayer(pid, cx + 10, cy)

    const objectsMap = (
      game as unknown as {
        objects: Map<number, { unitId: number; classId: number; x: number; y: number; mode: number }>
      }
    ).objects
    const tree = [...objectsMap.values()].find((o) => o.classId === 30)
    expect(tree).toBeDefined()

    // 1. MoveToUnit must snap targetX onto standable perimeter outside [-2..2] and keep it across frames
    game.enqueueCommand(pid, {
      type: 'MoveToUnit',
      run: true,
      target: { unitType: 'object', id: tree!.unitId },
    })
    game.stepFrames(25)

    const pAfterMove = game.getPlayerState(pid)!
    expect(Math.abs(pAfterMove.x - cx)).toBeGreaterThanOrEqual(3)
    expect(Math.abs(pAfterMove.x - cx)).toBeLessThanOrEqual(5)

    // 2. OperateObject from far / diagonal / standable perimeter must operate Tree of Inifuss and drop 'bks'
    game.movePlayer(pid, cx - 8, cy - 3)
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: tree!.unitId })
    game.stepFrames(15)

    expect(tree!.mode).toBe(2)

    const groundItems = (
      game as unknown as {
        groundItems: Map<number, { unitId: number; code: string; x: number; y: number; areaId: number }>
      }
    ).groundItems
    const bks = [...groundItems.values()].find((it) => it.code === 'bks')
    expect(bks).toBeDefined()

    // Move within pickup reach if needed and pick up 'bks'
    const pBeforePick = game.getPlayerState(pid)!
    if (Math.hypot(pBeforePick.x - bks!.x, pBeforePick.y - bks!.y) > 5) {
      game.movePlayer(pid, bks!.x, bks!.y)
    }
    game.enqueueCommand(pid, { type: 'PickUpItem', itemId: bks!.unitId })
    game.stepFrames(1)
    expect(groundItems.has(bks!.unitId)).toBe(false)
  })

  it('allows operating wall-embedded 5x8 Ancients Door (Id=547, 0x0007 anchor) from adjacent floor while blocking rays through intervening 0x0804 walls', () => {
    const doorX = 25
    const doorY = 15
    const level547 = buildGridLevel({
      areaId: 120,
      size: 50,
      cellMask: (x, y) => {
        if (y < doorY) return { collision: 0x0001, blocked: 1 }
        if (y === doorY) return { collision: 0x0007, blocked: 1 }
        // Extra 0x0804 pillar blocking players standing at y >= 22
        if (y === 20 && x >= 20 && x <= 30) return { collision: 0x0005, blocked: 1 }
        return { collision: 0x0000, blocked: 0 }
      },
      presetObjects: [{ index: 547, x: doorX, y: doorY, mode: 0 }],
    })
    const level128 = buildGridLevel({
      areaId: 128,
      size: 40,
      cellMask: () => ({ collision: 0x0000, blocked: 0 }),
      presetWarps: [{ lvlWarpId: 73, subX: 20, subY: 20, toLevelId: 120 }],
    })

    const game = new GameInstance({
      seed: 198602,
      areaId: 120,
      resolveAreaBootstrap: createAreaBootstrapResolver((req) => {
        if (req.areaId === 120) return level547
        if (req.areaId === 128) return level128
        return null
      }),
    })

    const qf = new Uint16Array(48)
    // Mark a5q5 completed so Ancients' Way Stairs (547) is unlocked
    qf[questWordIndex113c('a5q5')!] = 0x0001
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'Sorc',
      level: 25,
      areaId: 120,
      x: doorX,
      y: 22,
      questFlags: qf,
    })

    const objectsMap = (
      game as unknown as {
        objects: Map<number, { unitId: number; classId: number; mode: number }>
      }
    ).objects
    const stairs = [...objectsMap.values()].find((o) => o.classId === 547)!
    expect(stairs).toBeDefined()

    // Standing at (doorX, 22) behind the y=20 0x0005 missile barrier: LOS must be blocked!
    const host = game as unknown as {
      hasInteractionLineOfSight: (
        areaId: number,
        fx: number,
        fy: number,
        tx: number,
        ty: number,
        objId?: number,
      ) => boolean
    }
    expect(host.hasInteractionLineOfSight(120, doorX, 22, doorX, doorY, stairs.unitId)).toBe(false)

    // Standing on standable open floor right in front of the stairs at (doorX, 17): LOS must pass and operate 547!
    game.movePlayer(pid, doorX, 17)
    expect(host.hasInteractionLineOfSight(120, doorX, 17, doorX, doorY, stairs.unitId)).toBe(true)

    game.enqueueCommand(pid, { type: 'OperateObject', objectId: stairs.unitId })
    game.stepFrames(1)
    expect(stairs.mode).toBe(1)
    game.stepFrames(80)
    expect(stairs.mode).toBe(2)

    game.enqueueCommand(pid, { type: 'OperateObject', objectId: stairs.unitId })
    game.stepFrames(1)
    expect(game.getPlayerState(pid)?.areaId).toBe(128)
  })

  it('covers approach search radius for all large selectable Objects.txt footprints up to 10x6', () => {
    let checked = 0
    for (let id = 0; id < OBJECTS_TXT_113C.length; id += 1) {
      const meta = CANONICAL_113C_OBJECTS[id]
      if (!meta) continue
      const isSelectable = meta.selectableMask !== 0
      const maxDim = Math.max(meta.sizeX ?? 0, meta.sizeY ?? 0)
      if (!isSelectable || maxDim <= 3) continue
      checked += 1
      const radius = computeObjectApproachSearchRadius113c(id)
      // Standable floor around a blocked [SizeX x SizeY] box starts at ceil(maxDim / 2) + 1
      expect(radius).toBeGreaterThanOrEqual(Math.ceil(maxDim / 2) + 2)
    }
    expect(checked).toBeGreaterThanOrEqual(40)
  })
})
