/**
 * Unit facing & 25Hz turn transition (`src/common/units/direction.ts`, `D2Common.dll` `0x6FDE41C8`).
 *
 * Diablo II 1.13c sets a unit's target facing (`targetDir64`) when it starts a movement segment,
 * skill cast, or interaction (`D2Common.#10425` with `bInstant = 0`), and steps `dir64` toward
 * `targetDir64` on each 25Hz (`40ms`) tick via `TURN_STEP_TABLE_113C` (`D2Common.#10603`),
 * drawing the current intermediate `dir64` through `D2CMP.#10020`.
 */

import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import type { MapService } from '../../src/client/map/map-service.ts'
import {
  RemoteEntityInterpolator,
  resolveRemoteMoveSpeed,
} from '../../src/client/motion/interpolate.ts'
import type { SubTileWalkabilityGrid } from '../../src/client/motion/pathfind.ts'
import { D2_TICK_MS, LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { buildSceneDrawables } from '../../src/client/view/unit-drawables.ts'
import { ClientUnit } from '../../src/client/world/client-unit.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import {
  TURN_STEP_TABLE_113C,
  advanceUnitTurnByDtMs,
  createUnitTurnState,
  dir64FromPoints,
  dir64ToClipDirection,
  setUnitTargetDirection,
  stepUnitTurnTick,
} from '../../src/common/units/direction.ts'
import { MONSTER_HCIDX_VELOCITIES } from '../../src/common/units/monster-mapping.ts'
import { getMonsterKindByClassId } from '../../src/common/units/monsters-data.ts'
import { ByteWriter, decodeD2gsServerPacket } from '../../src/netproto/index.ts'
import type { ClientCommand } from '../../src/netproto/domain/client-command.ts'

const FRAME_MS = 1000 / 60

/** dir64 for the 16 screen headings (0 = screen south, clockwise), as the engine quantises them. */
const HEADING_DIR64 = [0, 4, 7, 11, 15, 20, 23, 27, 32, 36, 40, 43, 47, 52, 56, 59] as const

/** World unit vector of screen heading `k`: screen south is world (+1, +1), 22.5° per step. */
function headingVector(k: number): readonly [number, number] {
  const radians = ((45 + k * 22.5) * Math.PI) / 180
  return [Math.cos(radians), Math.sin(radians)]
}

/** Expected 25Hz turn trajectory from `startDir64` to `targetDir64` using `D2Common.#10603`. */
function expectedTurnSequence(startDir64: number, targetDir64: number): number[] {
  const state = createUnitTurnState(startDir64)
  setUnitTargetDirection(state, targetDir64, false)
  const seq: number[] = [state.dir64]
  while (state.dir64 !== targetDir64) {
    seq.push(stepUnitTurnTick(state))
  }
  return seq
}

/** A walkable world sub-tile grid with its origin at (`originX`, `originY`). */
function makeGrid(
  originX: number,
  originY: number,
  size: number,
  blocked: (x: number, y: number) => boolean = () => false,
): SubTileWalkabilityGrid {
  const walkable = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      walkable[y * size + x] = blocked(originX + x, originY + y) ? 0 : 1
    }
  }
  return { subWidth: size, subHeight: size, walkable, subOriginX: originX, subOriginY: originY }
}

/**
 * The production input path: `CommandMapper` re-paths from the player's cell on every frame the
 * left button is held (`triggerPrimaryWorldAction` → `startLocalPathPrediction`).
 */
function makeMapper(
  grid: SubTileWalkabilityGrid,
  predictor: LocalMovementPredictor,
  world = new ClientWorld(),
): CommandMapper {
  const hudManager = new HudManager()
  hudManager.resize(800, 600)
  const mapService = { getActiveLevelView: () => grid } as unknown as MapService
  const sent: ClientCommand[] = []
  return new CommandMapper({
    world,
    hudManager,
    predictor,
    mapService,
    sendCommand: cmd => sent.push(cmd),
  })
}

describe('local player facing & 25Hz turn transition (LocalMovementPredictor)', () => {
  it('sets targetDir64 for each of the 16 screen headings and steps dir64 at 25Hz to the matching clip direction', () => {
    for (let k = 0; k < 16; k++) {
      const predictor = new LocalMovementPredictor({ initialX: 1000, initialY: 1000 })
      const [dx, dy] = headingVector(k)
      predictor.setPath([{ x: 1000 + 20 * dx, y: 1000 + 20 * dy }], true)

      const targetDir = HEADING_DIR64[k]!
      const expectedSeq = expectedTurnSequence(0, targetDir)

      const initialSnap = predictor.getSnapshot()
      expect(initialSnap.targetDir64, `heading ${k} targetDir64`).toBe(targetDir)
      expect(initialSnap.dir64, `heading ${k} initial dir64`).toBe(0)

      const actualSeq: number[] = [initialSnap.dir64]
      for (let tick = 1; tick < expectedSeq.length; tick++) {
        const snap = predictor.update(D2_TICK_MS)
        actualSeq.push(snap.dir64)
      }
      expect(actualSeq, `heading ${k} turn sequence`).toEqual(expectedSeq)

      const finalSnap = predictor.getSnapshot()
      expect(finalSnap.dir64, `heading ${k}`).toBe(targetDir)
      expect(dir64ToClipDirection(finalSnap.dir64, 16), `heading ${k}`).toBe(k)
      if (k % 2 === 0) expect(dir64ToClipDirection(finalSnap.dir64, 8), `heading ${k}`).toBe(k / 2)
    }
  })

  it('preserves turn momentum and converges smoothly while the mouse is held (60Hz re-pathing)', () => {
    const grid = makeGrid(4900, 4900, 200)
    for (let k = 0; k < 16; k++) {
      const predictor = new LocalMovementPredictor({ initialX: 5000, initialY: 5000 })
      const mapper = makeMapper(grid, predictor)
      const [dx, dy] = headingVector(k)
      const goalX = 5000 + Math.round(30 * dx)
      const goalY = 5000 + Math.round(30 * dy)
      const expectedDir64 = dir64FromPoints(5000, 5000, goalX, goalY, 0)
      const allowedDirs = new Set(expectedTurnSequence(0, expectedDir64))

      let previousDistance = Number.POSITIVE_INFINITY
      let frames = 0
      let convergedFrame = -1
      for (; frames < 600; frames++) {
        mapper.triggerPrimaryWorldAction(goalX, goalY, null, frames * FRAME_MS)
        const snap = predictor.update(FRAME_MS)
        expect(snap.targetDir64, `heading ${k} frame ${frames} targetDir64`).toBe(expectedDir64)
        expect(allowedDirs.has(snap.dir64), `heading ${k} frame ${frames} dir64=${snap.dir64}`).toBe(true)
        if (snap.dir64 === expectedDir64 && convergedFrame === -1) {
          convergedFrame = frames
        }
        if (convergedFrame !== -1) {
          expect(snap.dir64, `heading ${k} frame ${frames} post-convergence`).toBe(expectedDir64)
        }
        if (!snap.moving) break
        const distance = Math.hypot(goalX - snap.logicalX, goalY - snap.logicalY)
        expect(distance, `heading ${k} frame ${frames}`).toBeLessThan(previousDistance)
        previousDistance = distance
      }
      expect(frames, `heading ${k}`).toBeLessThan(600)
      // Max turn takes 8 ticks = 320ms ≈ 20 frames at 60Hz
      expect(convergedFrame, `heading ${k} converged frame`).toBeGreaterThanOrEqual(0)
      expect(convergedFrame, `heading ${k} converged frame`).toBeLessThanOrEqual(21)

      const stopped = predictor.getSnapshot()
      expect(Math.round(stopped.logicalX)).toBe(goalX)
      expect(Math.round(stopped.logicalY)).toBe(goalY)
      expect(stopped.dir64).toBe(expectedDir64)

      // Holding the button at the goal changes nothing.
      for (let i = 0; i < 10; i++) {
        mapper.triggerPrimaryWorldAction(goalX, goalY, null, (frames + i) * FRAME_MS)
        const idle = predictor.update(FRAME_MS)
        expect(idle).toMatchObject({ moving: false, dir64: expectedDir64, targetDir64: expectedDir64 })
        expect(idle.logicalX).toBe(stopped.logicalX)
        expect(idle.logicalY).toBe(stopped.logicalY)
      }
    }
  })

  it('never steps back to the cell centre when a new click arrives mid-cell', () => {
    const grid = makeGrid(4900, 4900, 200)
    const cases = [
      { runTo: { x: 5030, y: 5000 }, travelled: 4.3, clickAt: { x: 5020, y: 5010 } },
      { runTo: { x: 5030, y: 5000 }, travelled: 4.7, clickAt: { x: 5025, y: 4990 } },
      { runTo: { x: 4970, y: 5000 }, travelled: 4.3, clickAt: { x: 4980, y: 5010 } },
      { runTo: { x: 5000, y: 5030 }, travelled: 2.2, clickAt: { x: 4990, y: 5020 } },
    ]
    for (const { runTo, travelled, clickAt } of cases) {
      const predictor = new LocalMovementPredictor({ initialX: 5000, initialY: 5000 })
      const mapper = makeMapper(grid, predictor)
      mapper.triggerPrimaryWorldAction(runTo.x, runTo.y, null, 0)
      const speed = predictor.getEffectiveSpeedSubTilesPerSec()
      const before = predictor.update((travelled / speed) * 1000)
      expect(Math.hypot(before.logicalX - 5000, before.logicalY - 5000)).toBeCloseTo(travelled, 6)

      mapper.triggerPrimaryWorldAction(clickAt.x, clickAt.y, null, 1000)
      const turned = predictor.getSnapshot()
      const expectedTargetDir = dir64FromPoints(
        before.logicalX,
        before.logicalY,
        clickAt.x,
        clickAt.y,
        before.dir64,
      )
      expect(turned.targetDir64).toBe(expectedTargetDir)
      const after = predictor.update(FRAME_MS)
      const toGoalX = clickAt.x - before.logicalX
      const toGoalY = clickAt.y - before.logicalY
      const stepX = after.logicalX - before.logicalX
      const stepY = after.logicalY - before.logicalY
      // The first step heads straight for the new goal, not back to the cell the path started in.
      const cosine = (stepX * toGoalX + stepY * toGoalY) / (Math.hypot(stepX, stepY) * Math.hypot(toGoalX, toGoalY))
      expect(cosine).toBeCloseTo(1, 9)

      // Stepping 8 ticks converges dir64 to expectedTargetDir
      predictor.stepTicks(8)
      expect(predictor.getSnapshot().dir64).toBe(expectedTargetDir)
    }
  })

  it('updates targetDir64 when each segment starts and transitions dir64 across segments at 25Hz', () => {
    const predictor = new LocalMovementPredictor({ initialX: 100, initialY: 100, initialDir64: 56 })
    predictor.setPath(
      [
        { x: 110, y: 100 },
        { x: 110, y: 110 },
      ],
      true,
    )
    expect(predictor.getSnapshot()).toMatchObject({ dir64: 56, targetDir64: 56 })

    const secondSegSeq = expectedTurnSequence(56, 7)
    const secondSegDirs: number[] = []
    for (let tick = 0; tick < 100; tick++) {
      const snap = predictor.update(D2_TICK_MS)
      if (snap.currentWaypoint && snap.currentWaypoint.y === 110) {
        expect(snap.targetDir64).toBe(7)
        secondSegDirs.push(snap.dir64)
      }
      if (!snap.moving) break
    }
    expect(secondSegDirs.length).toBeGreaterThan(3)
    // On the tick that reaches waypoint 1 and starts segment 2, targetDir64 becomes 7 while dir64 is 56,
    // and subsequent ticks step through secondSegSeq (56 -> 60 -> 62 -> 0 -> 2 -> 4 -> 5 -> 6 -> 7).
    expect(secondSegDirs[0]).toBe(secondSegSeq[0])
    expect(secondSegDirs[1]).toBe(secondSegSeq[1])
    expect(predictor.getSnapshot()).toMatchObject({
      moving: false,
      logicalX: 110,
      logicalY: 110,
      dir64: 7,
      targetDir64: 7,
    })
  })

  it('continues turning at 25Hz while standing after a short step finishes', () => {
    const predictor = new LocalMovementPredictor({ initialX: 100, initialY: 100, initialDir64: 0 })
    // 1-subtile move to (99, 100) (world -X -> screen NW, targetDir64 = 23, stepDir = 3 -> 8 ticks = 320ms,
    // whereas running 1 sub-tile at 13.5 sub-tiles/s finishes in 2 ticks = 80ms)
    predictor.setPath([{ x: 99, y: 100 }], true)
    const expectedSeq = expectedTurnSequence(0, 23)
    expect(predictor.getSnapshot()).toMatchObject({ dir64: 0, targetDir64: 23, moving: true })

    // Tick 1 (40ms): moving = true, dir64 = 3
    const after1 = predictor.update(D2_TICK_MS)
    expect(after1.moving).toBe(true)
    expect(after1.dir64).toBe(expectedSeq[1])

    // Tick 2 (80ms): reaches (99, 100) so moving = false, dir64 = 6 (still turning while standing!)
    const after2 = predictor.update(D2_TICK_MS)
    expect(after2.moving).toBe(false)
    expect(after2.dir64).toBe(expectedSeq[2])

    for (let tick = 3; tick < expectedSeq.length; tick++) {
      const snap = predictor.update(D2_TICK_MS)
      expect(snap.moving).toBe(false)
      expect(snap.dir64).toBe(expectedSeq[tick])
    }
    expect(predictor.getSnapshot()).toMatchObject({ moving: false, dir64: 23, targetDir64: 23 })
  })

  it('keeps the facing while idle, on an empty path and on a 0x15 reposition, and snaps on setDirection', () => {
    const predictor = new LocalMovementPredictor({ initialX: 100, initialY: 100 })
    predictor.setPath([{ x: 90, y: 100 }], false)
    expect(predictor.getSnapshot().targetDir64).toBe(23) // world −X is screen north-west
    predictor.update(5000)
    expect(predictor.getSnapshot()).toMatchObject({ moving: false, dir64: 23, targetDir64: 23 })

    predictor.update(1000)
    predictor.setPath([], true)
    predictor.setPath([{ x: 90, y: 100 }], true) // only the player's own cell
    expect(predictor.getSnapshot()).toMatchObject({ moving: false, logicalX: 90, dir64: 23, targetDir64: 23 })

    predictor.setPosition(300, 400)
    expect(predictor.getSnapshot()).toMatchObject({
      logicalX: 300,
      logicalY: 400,
      moving: false,
      dir64: 23,
      targetDir64: 23,
    })

    predictor.setDirection(40)
    expect(predictor.getSnapshot()).toMatchObject({ dir64: 40, targetDir64: 40 })
    expect(() => predictor.setDirection(64)).toThrow(RangeError)
    expect(() => predictor.setDirection(-1)).toThrow(RangeError)
  })

  it('paths from the player cell in moveToWorldSubTile, like CommandMapper', () => {
    const grid = makeGrid(4900, 4900, 200)
    const predictor = new LocalMovementPredictor({ initialX: 5000, initialY: 5000 })
    predictor.setPath([{ x: 5030, y: 5000 }], true)
    const at = predictor.update((4.7 / predictor.getEffectiveSpeedSubTilesPerSec()) * 1000)
    expect(at.logicalX).toBeCloseTo(5004.7, 6)
    expect(at.dir64).toBe(56)

    // findPathWorld floors its start (cell 5004); the predictor must path from cell 5005.
    const remaining = predictor.moveToWorldSubTile(grid, 5030, 5000)
    expect(remaining).toEqual([{ x: 5030, y: 5000 }])
    const next = predictor.update(FRAME_MS)
    expect(next.logicalX).toBeGreaterThan(at.logicalX)
    expect(next.dir64).toBe(56)
  })
})

describe('remote unit facing & 25Hz turn transition (RemoteEntityInterpolator)', () => {
  it('sets targetDir64 for the 16 screen headings when a move starts and steps dir64 at 25Hz to the end', () => {
    const interp = new RemoteEntityInterpolator()
    for (let k = 0; k < 16; k++) {
      interp.spawnOrSnap({ unitType: 1, unitId: k, x: 5000, y: 5000 })
      const [dx, dy] = headingVector(k)
      const started = interp.startMove({
        unitType: 1,
        unitId: k,
        currentX: 5000,
        currentY: 5000,
        targetX: 5000 + 10 * dx,
        targetY: 5000 + 10 * dy,
        running: true,
      })
      expect(started.targetDir64, `heading ${k} targetDir64`).toBe(HEADING_DIR64[k])
      expect(started.dir64, `heading ${k} initial dir64`).toBe(0)
    }

    const expectedSeqs = HEADING_DIR64.map(target => expectedTurnSequence(0, target))
    for (let tick = 1; tick <= 8; tick++) {
      interp.update(D2_TICK_MS)
      for (let k = 0; k < 16; k++) {
        const seq = expectedSeqs[k]!
        const expectedDir = seq[Math.min(tick, seq.length - 1)]!
        expect(interp.getEntityState(1, k)!.dir64, `heading ${k} tick ${tick}`).toBe(expectedDir)
      }
    }

    for (let frame = 0; frame < 120; frame++) {
      interp.update(FRAME_MS)
      for (let k = 0; k < 16; k++) {
        expect(interp.getEntityState(1, k)!.dir64, `heading ${k} frame ${frame}`).toBe(HEADING_DIR64[k])
      }
    }
    expect(interp.getAllStates().every(s => !s.moving)).toBe(true)
  })

  it('keeps the facing on a reassign without a direction and snaps when dir64 is explicitly provided', () => {
    const interp = new RemoteEntityInterpolator()
    interp.spawnOrSnap({ unitType: 0, unitId: 7, x: 100, y: 100, dir64: 40 })
    expect(interp.spawnOrSnap({ unitType: 0, unitId: 7, x: 120, y: 130 })).toMatchObject({
      dir64: 40,
      targetDir64: 40,
    })
    expect(interp.spawnOrSnap({ unitType: 0, unitId: 7, x: 120, y: 130, dir64: 12 })).toMatchObject({
      dir64: 12,
      targetDir64: 12,
    })
    expect(interp.spawnOrSnap({ unitType: 0, unitId: 8, x: 100, y: 100 })).toMatchObject({
      dir64: 0,
      targetDir64: 0,
    })
    expect(() => interp.spawnOrSnap({ unitType: 0, unitId: 9, x: 1, y: 1, dir64: 64 })).toThrow(RangeError)
  })

  it('turns toward the stop point while gliding to it and keeps the facing on a hard stop', () => {
    const interp = new RemoteEntityInterpolator()
    interp.spawnOrSnap({ unitType: 1, unitId: 1, x: 5000, y: 5000 })
    expect(interp.startMove({ unitType: 1, unitId: 1, targetX: 5010, targetY: 5000 }).targetDir64).toBe(56)
    // 8 ticks = 320ms completes the turn from 0 -> 56 (diff = 56, stepDir = -1)
    interp.update(320)
    const mid = interp.getEntityState(1, 1)!
    expect(mid.dir64).toBe(56)

    const glide = interp.stopEntity({ unitType: 1, unitId: 1, x: 5003, y: 5002 })
    const expectedGlideTargetDir = dir64FromPoints(mid.x, mid.y, 5003, 5002, 56)
    expect(glide.moving).toBe(true)
    expect(glide.targetDir64).toBe(expectedGlideTargetDir)
    interp.update(1000)
    expect(interp.getEntityState(1, 1)).toMatchObject({
      x: 5003,
      y: 5002,
      moving: false,
      dir64: expectedGlideTargetDir,
      targetDir64: expectedGlideTargetDir,
    })

    // Within 0.15 sub-tiles the unit snaps and keeps its facing.
    const snapped = interp.stopEntity({ unitType: 1, unitId: 1, x: 5003.1, y: 5002 })
    expect(snapped).toMatchObject({ x: 5003.1, moving: false, dir64: expectedGlideTargetDir })
  })
})

describe('skill-cast & interaction 25Hz facing (ClientWorld & buildSceneDrawables)', () => {
  it('sets targetDirection on SkillCast / CastAtCoord / Interact and steps direction at 25Hz without instant snap', () => {
    const world = new ClientWorld()
    world.apply({ type: 'UnitAssign', unit: { unitType: 1, id: 40, classId: 5, x: 5000, y: 5000 } })
    const monster = world.getUnit('monster', 40)!
    expect(monster.direction).toBe(0)
    expect(monster.targetDirection).toBe(0)

    // Cast toward world +X (screen south-east: targetDir64 = 56, diff = 56, stepDir = -1 -> 8 ticks)
    world.apply({
      type: 'SkillCast',
      caster: { unitType: 1, id: 40 },
      skill: 0,
      level: 1,
      target: { x: 5010, y: 5000 },
    })
    expect(monster.targetDirection).toBe(56)
    expect(monster.direction).toBe(0) // Not instantly snapped before tick

    // Verify intermediate directions over 8 ticks (40ms each)
    const expectedTo56 = expectedTurnSequence(0, 56)
    for (let tick = 1; tick < expectedTo56.length; tick++) {
      world.tick(D2_TICK_MS)
      expect(monster.direction).toBe(expectedTo56[tick])
      // Position must not drift while casting in place
      expect(monster.x).toBe(5000)
      expect(monster.y).toBe(5000)
    }
    expect(monster.direction).toBe(56)

    // Target underfoot keeps facing
    world.apply({
      type: 'SkillCast',
      caster: { unitType: 1, id: 40 },
      skill: 0,
      level: 1,
      target: { x: 5000, y: 5000 },
    })
    expect(monster.direction).toBe(56)
    expect(monster.targetDirection).toBe(56)

    // Cast toward world -X-Y (screen north: targetDir64 = 32, diff = (32 - 56) & 63 = 40, stepDir = -3 -> 8 ticks)
    world.apply({
      type: 'CastAtCoord',
      caster: { unitType: 1, id: 40 },
      skill: 36,
      targetX: 4990,
      targetY: 4990,
    })
    expect(monster.targetDirection).toBe(32)
    expect(monster.direction).toBe(56)
    const expectedTo32 = expectedTurnSequence(56, 32)
    for (let tick = 1; tick < expectedTo32.length; tick++) {
      world.tick(D2_TICK_MS)
      expect(monster.direction).toBe(expectedTo32[tick])
    }
    expect(monster.direction).toBe(32)

    // Interact turns gradually toward target unit
    world.apply({ type: 'UnitAssign', unit: { unitType: 2, id: 99, classId: 1, x: 5000, y: 5010 } })
    world.apply({
      type: 'Interact',
      actor: { unitType: 1, id: 40 },
      target: { unitType: 2, id: 99 },
    })
    expect(monster.targetDirection).toBe(7) // world +Y: screen south-west
    expect(monster.direction).toBe(32)
    for (let tick = 0; tick < 8; tick++) {
      world.tick(D2_TICK_MS)
    }
    expect(monster.direction).toBe(7)
  })

  it('preserves intermediate unit.direction in buildSceneDrawables even when targetX/targetY are present', () => {
    // Unit is at (5000, 5000) moving/casting toward (5010, 5000) (targetDir64 = 56),
    // currently at intermediate facing dir64 = 61 during its 25Hz turn transition.
    const result = buildSceneDrawables([
      {
        id: 1,
        kind: 'player',
        classId: 1,
        x: 5000,
        y: 5000,
        targetX: 5010,
        targetY: 5000,
        direction: 61,
        mode: 2,
      },
      {
        id: 2,
        kind: 'monster',
        classId: 5,
        x: 5000,
        y: 5000,
        // Omit direction: fallback to dir64FromPoints(5000, 5000, 5010, 5000, 0) = 56
        targetX: 5010,
        targetY: 5000,
        mode: 2,
      },
    ])

    const playerDrawable = result.unitDrawables.find(d => d.id === 1)!
    const monsterDrawable = result.unitDrawables.find(d => d.id === 2)!
    expect(playerDrawable.direction).toBe(61)
    expect(monsterDrawable.direction).toBe(56)
    expect(TURN_STEP_TABLE_113C[56]).toBe(-1)
  })

  it('handles speed <= 0 without teleporting to waypoints, still advancing turn state at 25Hz', () => {
    const predictor = new LocalMovementPredictor({
      initialX: 100,
      initialY: 100,
      initialDir64: 0,
      walkSpeedSubTilesPerSec: 0,
      runSpeedSubTilesPerSec: 0,
    })
    predictor.setRunning(false)
    predictor.setPath([{ x: 110, y: 100 }, { x: 120, y: 100 }], false)
    expect(predictor.getSnapshot()).toMatchObject({
      logicalX: 100,
      logicalY: 100,
      moving: true,
      dir64: 0,
      targetDir64: 56, // world +X -> screen SE (dir64 = 56)
    })

    // Advance 320ms (8 ticks) with speed = 0: must NOT teleport, position stays at (100, 100)
    const snap = predictor.update(320)
    expect(snap.logicalX).toBe(100)
    expect(snap.logicalY).toBe(100)
    expect(snap.moving).toBe(true)
    expect(snap.dir64).toBe(56) // Turn still converged smoothly at 25Hz!
    expect(snap.targetDir64).toBe(56)
  })

  it('fails fast on non-finite dtMs in LocalMovementPredictor.update', () => {
    const predictor = new LocalMovementPredictor({ initialX: 100, initialY: 100 })
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => predictor.update(bad)).toThrow(RangeError)
    }
  })

  it('halts movement and turns toward cast target when local player casts a skill while moving', () => {
    const grid = makeGrid(4900, 4900, 200)
    const predictor = new LocalMovementPredictor({ initialX: 5000, initialY: 5000, initialDir64: 0 })
    const world = new ClientWorld()
    const mapper = makeMapper(grid, predictor, world)

    // Start moving south-east toward (5050, 5000) (targetDir64 = 56)
    mapper.triggerPrimaryWorldAction(5050, 5000, null, 0)
    const movingSnap = predictor.update(40)
    expect(movingSnap.moving).toBe(true)
    expect(movingSnap.targetDir64).toBe(56)

    // Mid-motion, player right-clicks secondary skill toward north (targetDir64 = 32)
    // (Equip ranged spell Fire Bolt #36 so empty-ground right click casts in place per 1.13c)
    world.self.rightSkill = 36
    const [nx, ny] = headingVector(8)
    const goalX = movingSnap.logicalX + 30 * nx
    const goalY = movingSnap.logicalY + 30 * ny
    mapper.triggerSecondaryWorldAction(goalX, goalY, null, 50)
    const castSnap = predictor.getSnapshot()
    expect(castSnap.moving).toBe(false) // Predictor movement halted for stationary cast
    expect(castSnap.targetDir64).toBe(32) // Retargeted to cast angle

    // Turn steps toward 32 from current facing over subsequent ticks
    const initialFacing = castSnap.dir64
    const expectedSeq = expectedTurnSequence(initialFacing, 32)
    for (let i = 1; i < expectedSeq.length; i++) {
      const snap = predictor.update(D2_TICK_MS)
      expect(snap.dir64).toBe(expectedSeq[i])
      expect(snap.moving).toBe(false)
    }
    expect(predictor.getSnapshot().dir64).toBe(32)
  })

  it('handles rapid mid-turn retargeting with fractional accumulator remainder without oscillation', () => {
    const state = createUnitTurnState(0)
    // Target 32 (North): stepDir = -8
    setUnitTargetDirection(state, 32, false)
    expect(state.stepDir).toBe(-8)

    // Accumulate 20ms (< 40ms): no tick stepped yet
    advanceUnitTurnByDtMs(state, 20)
    expect(state.dir64).toBe(0)
    expect(state.turnTickRemainderMs).toBe(20)

    // Rapidly change target to 48 (East, diff = 48, stepDir = -4): remainder is preserved
    setUnitTargetDirection(state, 48, false)
    expect(state.targetDir64).toBe(48)
    expect(state.stepDir).toBe(-4)
    expect(state.turnTickRemainderMs).toBe(20)

    // Adding 20ms triggers a tick at the 40ms boundary: 0 + (-4) = 60
    advanceUnitTurnByDtMs(state, 20)
    expect(state.dir64).toBe(60)
    expect(state.turnTickRemainderMs).toBe(0)

    // Advance 3 more ticks (120ms): 60 -> 56 -> 52 -> 48
    advanceUnitTurnByDtMs(state, 120)
    expect(state.dir64).toBe(48)
    expect(state.stepDir).toBe(0)
  })
})

describe('adversarial reviewer r2 regressions & edge cases', () => {
  it('synchronizes ClientUnit.direction and targetDirection setters with internal turn state', () => {
    const unit = new ClientUnit({ unitType: 0, id: 1, classId: 0, x: 100, y: 100, direction: 0 })
    expect(unit.direction).toBe(0)
    expect(unit.targetDirection).toBe(0)

    // Direct property assignment snaps direction and targetDirection
    unit.direction = 25
    expect(unit.direction).toBe(25)
    expect(unit.targetDirection).toBe(25)
    expect(unit.turnStepDir).toBe(0)

    // Subsequent advanceTurn does not reset to old direction or step
    unit.advanceTurn(40)
    expect(unit.direction).toBe(25)
    expect(unit.targetDirection).toBe(25)

    // Setting targetDirection initiates smooth stepping toward new target
    unit.targetDirection = 35
    expect(unit.targetDirection).toBe(35)
    expect(unit.direction).toBe(25)
    expect(unit.turnStepDir).toBe(4) // diff = 10 -> TURN_STEP_TABLE[10] = +4

    // Advance 40ms: 25 + 4 = 29
    unit.advanceTurn(40)
    expect(unit.direction).toBe(29)

    // Advance 40ms: 29 + 4 = 33
    unit.advanceTurn(40)
    expect(unit.direction).toBe(33)

    // Advance 40ms: clamps to 35, stepDir clears to 0
    unit.advanceTurn(40)
    expect(unit.direction).toBe(35)
    expect(unit.turnStepDir).toBe(0)

    // dir alias behaves identically
    unit.dir = 10
    expect(unit.direction).toBe(10)
    expect(unit.targetDirection).toBe(10)

    // Invalid directions fail fast
    expect(() => {
      unit.direction = 64
    }).toThrow(RangeError)
    expect(() => {
      unit.direction = -1
    }).toThrow(RangeError)
    expect(() => {
      unit.targetDirection = 64
    }).toThrow(RangeError)
    expect(() => {
      unit.targetDirection = -1
    }).toThrow(RangeError)
  })

  it('validates stepDir in ClientUnit.syncTurnState', () => {
    const unit = new ClientUnit({ unitType: 0, id: 1, classId: 0, x: 100, y: 100 })
    expect(() => unit.syncTurnState(0, 10, 1.5)).toThrow(RangeError)
    expect(() => unit.syncTurnState(0, 10, Number.NaN)).toThrow(RangeError)
    unit.syncTurnState(0, 10, 4)
    expect(unit.direction).toBe(0)
    expect(unit.targetDirection).toBe(10)
    expect(unit.turnStepDir).toBe(4)
  })

  it('fails fast on non-finite dtMs even when entity/unit containers are empty', () => {
    const interp = new RemoteEntityInterpolator()
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => interp.update(bad)).toThrow(RangeError)
    }

    const world = new ClientWorld()
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => world.stepUnitTurns(bad)).toThrow(RangeError)
      expect(() => world.tick(bad)).toThrow(RangeError)
    }
  })

  it('fails fast on corrupted turnTickRemainderMs in direction.ts', () => {
    const state = createUnitTurnState(0)
    state.turnTickRemainderMs = Number.NaN
    expect(() => advanceUnitTurnByDtMs(state, 40)).toThrow(RangeError)
    expect(() => setUnitTargetDirection(state, 10)).toThrow(RangeError)

    state.turnTickRemainderMs = -5
    expect(() => advanceUnitTurnByDtMs(state, 40)).toThrow(RangeError)
    expect(() => setUnitTargetDirection(state, 10)).toThrow(RangeError)
  })

  it('unconditionally stops movement predictor on stationary actions even if target unit is missing', () => {
    const grid = makeGrid(4900, 4900, 200)
    const predictor = new LocalMovementPredictor({ initialX: 5000, initialY: 5000 })
    const mapper = makeMapper(grid, predictor)

    // Start moving
    predictor.setPath([{ x: 5020, y: 5000 }], true)
    expect(predictor.getSnapshot().moving).toBe(true)

    // Dispatch stationary action with non-existent target unit
    mapper.dispatchRateLimited(
      {
        type: 'CastLeftSkillOnTarget',
        unitKind: 1, // monster
        unitId: 99999, // non-existent
      },
      100,
    )
    expect(predictor.getSnapshot().moving).toBe(false)

    // Again with SkillOn (after skill cooldown: 100 + 200 = 300ms)
    predictor.setPath([{ x: 5020, y: 5000 }], true)
    expect(predictor.getSnapshot().moving).toBe(true)
    mapper.dispatchRateLimited(
      {
        type: 'SkillOn',
        hand: 'right',
        target: { unitType: 'monster', id: 99999 },
        shift: false,
        hold: false,
      },
      300,
    )
    expect(predictor.getSnapshot().moving).toBe(false)

    // Again with OperateObject (after cooldown: 300 + 200 = 500ms)
    predictor.setPath([{ x: 5020, y: 5000 }], true)
    expect(predictor.getSnapshot().moving).toBe(true)
    mapper.dispatchRateLimited(
      {
        type: 'OperateObject',
        objectId: 88888,
      },
      500,
    )
    expect(predictor.getSnapshot().moving).toBe(false)
  })
})

describe('adversarial reviewer r3 deep regression & online session integration', () => {
  it('validates ticks in LocalMovementPredictor.stepTicks', () => {
    const predictor = new LocalMovementPredictor({ initialX: 100, initialY: 100 })
    for (const badTicks of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => predictor.stepTicks(badTicks)).toThrow(RangeError)
    }
    expect(predictor.stepTicks(0)).toMatchObject({ logicalX: 100, logicalY: 100 })
    expect(predictor.stepTicks(1)).toMatchObject({ logicalX: 100, logicalY: 100 })
  })

  it('exposes stepDir on PredictorSnapshot and RemoteEntityMotionState', () => {
    const predictor = new LocalMovementPredictor({ initialX: 1000, initialY: 1000, initialDir64: 0 })
    expect(predictor.getSnapshot().stepDir).toBe(0)
    predictor.setTargetDirection(32, false)
    expect(predictor.getSnapshot().stepDir).toBe(-8)
    predictor.stepTicks(1)
    expect(predictor.getSnapshot().dir64).toBe(56)
    expect(predictor.getSnapshot().stepDir).toBe(-8)

    const interp = new RemoteEntityInterpolator()
    interp.spawnOrSnap({ unitType: 1, unitId: 5, x: 200, y: 200, dir64: 0 })
    expect(interp.getEntityState(1, 5)!.stepDir).toBe(0)
    interp.setEntityTargetDirection(1, 5, 20, false)
    expect(interp.getEntityState(1, 5)!.stepDir).toBe(8)
  })

  it('validates directions and coordinates in RemoteEntityInterpolator even for non-existent entities', () => {
    const interp = new RemoteEntityInterpolator()
    for (const badDir of [-1, 64, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => interp.setEntityTargetDirection(1, 99999, badDir)).toThrow(RangeError)
    }
    for (const badCoord of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => interp.faceEntityToward(1, 99999, badCoord, 100)).toThrow(RangeError)
      expect(() => interp.faceEntityToward(1, 99999, 100, badCoord)).toThrow(RangeError)
    }
    expect(interp.setEntityTargetDirection(1, 99999, 32)).toBeNull()
    expect(interp.faceEntityToward(1, 99999, 100, 100)).toBeNull()
  })

  it('protects ClientUnit.turnState from external mutation via defensive copy', () => {
    const unit = new ClientUnit({ unitType: 0, id: 1, classId: 0, x: 100, y: 100, direction: 0 })
    const state = unit.turnState as any
    state.dir64 = 45
    state.targetDir64 = 55
    state.stepDir = 99
    state.turnTickRemainderMs = -500

    expect(unit.direction).toBe(0)
    expect(unit.targetDirection).toBe(0)
    expect(unit.turnStepDir).toBe(0)
    expect(unit.turnState.turnTickRemainderMs).toBe(0)
  })

  it('provides single-tick stepTurnTick() on ClientUnit', () => {
    const unit = new ClientUnit({ unitType: 0, id: 1, classId: 0, x: 100, y: 100, direction: 0 })
    unit.targetDirection = 16
    expect(unit.turnStepDir).toBe(4)
    expect(unit.stepTurnTick()).toBe(4)
    expect(unit.direction).toBe(4)
    expect(unit.stepTurnTick()).toBe(8)
    expect(unit.direction).toBe(8)
  })

  it('validates 1.13c turn step domain in ClientUnit.syncTurnState', () => {
    const unit = new ClientUnit({ unitType: 0, id: 1, classId: 0, x: 100, y: 100 })
    for (const badStep of [2, 3, 5, 99, -2, -3, 1.5, Number.NaN]) {
      expect(() => unit.syncTurnState(0, 16, badStep)).toThrow(RangeError)
    }
    for (const validStep of [0, 1, -1, 4, -4, 8, -8]) {
      expect(() => unit.syncTurnState(0, 16, validStep)).not.toThrow()
    }
  })

  it('integrates 25Hz turn transitions into OnlineSession, synchronizing world, predictor, interpolator and drawables', () => {
    const clientWorld = new ClientWorld()
    const session = new OnlineSession({ world: clientWorld })

    // Non-finite dtMs or nowMs fail fast with RangeError
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => session.tick(bad)).toThrow(RangeError)
      expect(() => session.tick(40, bad)).toThrow(RangeError)
    }

    // Assign self player at (5000, 5000) with dir64 = 0
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 0,
        id: 1,
        classId: 1, // Sorceress
        x: 5000,
        y: 5000,
        direction: 0,
      },
    })
    expect(clientWorld.selfId).toBe(1)
    const selfUnit = clientWorld.getUnit('player', 1)!
    expect(selfUnit.direction).toBe(0)
    expect(selfUnit.targetDirection).toBe(0)

    // Player casts skill toward North (4970, 4970) -> targetDir64 = 32
    session.dispatchCommand(
      {
        type: 'SkillAt',
        hand: 'right',
        at: { x: 4970, y: 4970 },
        hold: false,
      },
      1000,
    )

    expect(selfUnit.targetDirection).toBe(32)
    expect(selfUnit.direction).toBe(0)
    expect(selfUnit.turnStepDir).toBe(-8)

    // Step session at 25Hz (40ms ticks): 0 -> 56 -> 48 -> 40 -> 32
    session.tick(40, 1040)
    expect(selfUnit.direction).toBe(56)

    let drawables = session.buildRenderableUnits()
    let playerDrawable = drawables.find(d => d.id === 1)!
    expect(playerDrawable.direction).toBe(56)

    session.tick(40, 1080)
    expect(selfUnit.direction).toBe(48)
    drawables = session.buildRenderableUnits()
    playerDrawable = drawables.find(d => d.id === 1)!
    expect(playerDrawable.direction).toBe(48)

    session.tick(80, 1160)
    expect(selfUnit.direction).toBe(32)
    expect(selfUnit.turnStepDir).toBe(0)
    drawables = session.buildRenderableUnits()
    playerDrawable = drawables.find(d => d.id === 1)!
    expect(playerDrawable.direction).toBe(32)

    // Assign remote monster at (5020, 5000) facing 0
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 50,
        classId: 5,
        x: 5020,
        y: 5000,
        direction: 0,
      },
    })
    const monster = clientWorld.getUnit('monster', 50)!
    expect(monster.direction).toBe(0)

    // Remote monster moves toward (5030, 5000) (targetDir64 = 56, diff = 56, stepDir = -1)
    session.handleServerEvent({
      type: 'UnitMove',
      unitType: 1,
      unitId: 50,
      mode: 'walk',
      from: { x: 5020, y: 5000 },
      to: { x: 5030, y: 5000 },
    } as any)
    expect(monster.targetDirection).toBe(56)
    expect(monster.direction).toBe(0)

    // 5 ticks (200ms) steps monster: 0 -> 63 -> 62 -> 61 -> 60 -> 59
    session.tick(200, 1360)
    expect(monster.direction).toBe(59)
    drawables = session.buildRenderableUnits()
    const monsterDrawable = drawables.find(d => d.id === 50)!
    expect(monsterDrawable.direction).toBe(59)

    // Complete turn: +120ms (3 ticks) -> 56
    session.tick(120, 1480)
    expect(monster.direction).toBe(56)

    // Remote monster interaction event triggers immediate targetDirection update
    session.handleServerEvent({
      type: 'Interact',
      actor: { unitType: 1, id: 50 },
      target: { unitType: 0, id: 1 }, // Local player at (5000, 5000): screen NW (targetDir64 = 23)
    } as any)
    expect(monster.targetDirection).toBe(23)
    expect(monster.direction).toBe(56)
  })
})

describe('1.13c monster movement velocity & anti-rubber-banding (MonStats.txt + D2Common #10819)', () => {
  it('populates all 734 MonStats.txt [Velocity, Run] pairs and computes exact 1.13c sub-tile/sec speeds', () => {
    expect(MONSTER_HCIDX_VELOCITIES.length).toBe(734)

    // Zombies (zombie1..zombie5, hcIdx = 5..9): Velocity = 1 in MonStats.txt ([1,3], [1,4], [1,4], [1,5], [1,5])
    const expectedZombieRun = [3, 4, 4, 5, 5] as const
    for (let hcIdx = 5; hcIdx <= 9; hcIdx++) {
      expect(MONSTER_HCIDX_VELOCITIES[hcIdx]).toEqual([1, expectedZombieRun[hcIdx - 5]])
      const kind = getMonsterKindByClassId(hcIdx)
      expect(kind).toBeDefined()
      expect(kind?.velocity).toBe(1)
      expect(kind?.runVelocity).toBe(expectedZombieRun[hcIdx - 5])
      // dwVelocity = floor((75 * 256) / 100) = 192 => 192 * 25 / 4096 = 1.171875 sub-tiles/s
      expect(resolveRemoteMoveSpeed({ unitType: 1, classId: hcIdx, running: false, velocityPercent: 75 }).speedSubTilesPerSec).toBe(1.171875)
      expect(resolveRemoteMoveSpeed({ unitType: 1, classId: hcIdx, running: false }).speedSubTilesPerSec).toBe(1.171875)
    }

    // Skeleton (skeleton1, hcIdx = 0): Velocity = 3, Run = 3
    // dwVelocity = floor((75 * 768) / 100) = 576 => 576 * 25 / 4096 = 3.515625 sub-tiles/s
    expect(resolveRemoteMoveSpeed({ unitType: 1, classId: 0, running: false, velocityPercent: 75 }).speedSubTilesPerSec).toBe(3.515625)

    // Fallen (fallen1, hcIdx = 19): Velocity = 5, Run = 5
    // Walk (nVelocity = 75): dwVelocity = floor((75 * 1280) / 100) = 960 => 960 * 25 / 4096 = 5.859375 sub-tiles/s
    expect(resolveRemoteMoveSpeed({ unitType: 1, classId: 19, running: false, velocityPercent: 75 }).speedSubTilesPerSec).toBe(5.859375)
    // With explicit run velocityPercent = 155: dwVelocity = floor((155 * 1280) / 100) = 1984 => 12.109375 sub-tiles/s
    expect(resolveRemoteMoveSpeed({ unitType: 1, classId: 19, running: true, velocityPercent: 155 }).speedSubTilesPerSec).toBe(12.109375)

    // Corrupt Rogue (corruptrogue2, hcIdx = 44): Velocity = 6, Run = 8
    // Per D2Common.#10819 (0x6FDAA2F0), base is ALWAYS MonStats.Velocity << 8 = 1536; with default 75% => 1152 => 1152 * 25 / 4096 = 7.03125
    expect(resolveRemoteMoveSpeed({ unitType: 1, classId: 44, running: true }).speedSubTilesPerSec).toBeCloseTo((25 * 1152) / 4096, 8)

    // Akara (hcIdx = 148, Velocity = 1) and Kashya (hcIdx = 150, Velocity = 3) from 04-d2gs-idle-60s.d2cap
    expect(resolveRemoteMoveSpeed({ unitType: 1, classId: 148, running: false, velocityPercent: 75 }).speedSubTilesPerSec).toBe(1.171875)
    expect(resolveRemoteMoveSpeed({ unitType: 1, classId: 150, running: false, velocityPercent: 75 }).speedSubTilesPerSec).toBe(3.515625)
  })

  it('steps Zombie (hcIdx=5) 0x67 NPCMove and 0x68 NPCMoveToTarget at 1.171875 sub-tiles/s without rubber-banding', () => {
    const session = new OnlineSession()

    // 1. Spawn local player at (5010, 5000) and Zombie (classId=5) at (5000, 5000)
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 1, classId: 1, name: 'Hero', x: 5010, y: 5000, mode: 1, lifePct: 128 },
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 200, classId: 5, x: 5000, y: 5000, mode: 1, lifePct: 128 },
    })

    // 2. Server sends 0x67 NPCMove for Zombie to walk 3 sub-tiles to (5003, 5000) with nVelocity = 75 (takes 64 ticks = 2560ms)
    const w67 = new ByteWriter(16)
    w67.u8(0x67)
    w67.u32LE(200)
    w67.u8(0x01) // walk
    w67.u16LE(5003)
    w67.u16LE(5000)
    w67.u16LE(0)
    w67.u8(2)
    w67.i16LE(75)
    w67.u8(0)
    session.handleServerEvent(decodeD2gsServerPacket(w67.toUint8Array()))

    // Immediately after packet ingestion, Zombie must still be at (5000, 5000), NOT teleported to 5003
    expect(session.world.getUnit('monster', 200)?.x).toBe(5000)

    // 3. Advance 32 ticks (1280ms = half of 2560ms): Zombie must be at 5001.5 (NOT prematurely snapped to 5003 as with old 9 sub-tiles/s!)
    for (let i = 0; i < 32; i++) {
      session.tick(40, 1000 + (i + 1) * 40)
    }
    expect(session.world.getUnit('monster', 200)?.x).toBeCloseTo(5001.5, 5)
    expect(session.world.getUnit('monster', 200)?.mode).toBe(2) // still walking (WL)

    // 4. Advance remaining 32 ticks (total 2560ms): Zombie reaches (5003, 5000) exactly when server 0x6D NPCStop arrives
    for (let i = 32; i < 64; i++) {
      session.tick(40, 1000 + (i + 1) * 40)
    }
    expect(session.world.getUnit('monster', 200)?.x).toBeCloseTo(5003, 5)

    // Server sends 0x6D NPCStop at (5003, 5000) -> zero rubber-band jump!
    session.handleServerEvent({
      type: 'UnitMove',
      unitType: 'monster',
      id: 200,
      mode: 'stop',
      to: { x: 5003, y: 5000 },
    })
    expect(session.world.getUnit('monster', 200)?.x).toBeCloseTo(5003, 5)

    // 5. Server sends 0x68 NPCMoveToTarget chasing local player (id=1 at 5010, 5000) from current (5003, 5000) with nVelocity=75
    const w68 = new ByteWriter(21)
    w68.u8(0x68)
    w68.u32LE(200)
    w68.u8(0x00) // walk in 0x68
    w68.u16LE(5003)
    w68.u16LE(5000)
    w68.u8(0) // targetType = player
    w68.u32LE(1) // targetId = 1
    w68.u16LE(0)
    w68.u8(2)
    w68.i16LE(75)
    w68.u8(0)
    session.handleServerEvent(decodeD2gsServerPacket(w68.toUint8Array()))

    // Step 25 ticks (1000ms): Zombie advances monotonically by 1.171875 sub-tiles to 5004.171875
    let prevX = session.world.getUnit('monster', 200)!.x
    for (let i = 0; i < 25; i++) {
      session.tick(40, 4000 + (i + 1) * 40)
      const curX = session.world.getUnit('monster', 200)!.x
      expect(curX).toBeGreaterThanOrEqual(prevX)
      prevX = curX
    }
    expect(prevX).toBeCloseTo(5003 + 1.171875, 4)

    // Server sends next 0x68 re-sync after ~21 ticks (from X = 5004, Y = 5000): Zombie must NOT jump backward or teleport!
    const w68Next = new ByteWriter(21)
    w68Next.u8(0x68)
    w68Next.u32LE(200)
    w68Next.u8(0x00)
    w68Next.u16LE(5004)
    w68Next.u16LE(5000)
    w68Next.u8(0)
    w68Next.u32LE(1)
    w68Next.u16LE(0)
    w68Next.u8(2)
    w68Next.i16LE(75)
    w68Next.u8(0)
    const xBeforeResync = session.world.getUnit('monster', 200)!.x
    session.handleServerEvent(decodeD2gsServerPacket(w68Next.toUint8Array()))
    const xAfterResync = session.world.getUnit('monster', 200)!.x
    // Drift is ~0.17 sub-tiles (< 5 WL drift threshold in 0x6FADA1B0), so visual position stays at xBeforeResync without rubber-banding!
    expect(xAfterResync).toBeCloseTo(xBeforeResync, 5)

    session.destroy()
  })
})
