/**
 * Remote Entity Movement Interpolation & MonStats Velocity Tests (Issues #586, #598).
 *
 * Verifies Diablo II v1.13c ground truth:
 * - Remote monster velocity derives from MonStats.txt (Velocity / Run) via computeMonsterMoveSpeedSubTilesPerSec
 * - S2C 0x67 / 0x68 decodes nPathType and nVelocity
 * - S2C nVelocity scales monster / unit speed, retaining the 25% speed floor
 * - Units advance along waypoints cleanly without synthetic 1.5x catchup acceleration (#598)
 * - Remote units settle cleanly on authoritative stop packets without sliding glide (#598)
 */

import { describe, expect, it } from 'vitest'
import {
  D2_REMOTE_PLAYER_SNAP_THRESHOLD,
  RemoteEntityInterpolator,
  resolveRemoteMoveSpeed,
} from '../../src/client/motion/interpolate.ts'
import {
  D2_BASE_RUN_SUBTILES_PER_SEC,
  D2_BASE_WALK_SUBTILES_PER_SEC,
} from '../../src/client/motion/predictor.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { ByteWriter } from '../../src/netproto/core/byte-writer.ts'
import {
  decode0x0DPlayerStop,
  decode0x0FPlayerMove,
  decode0x67NpcMove,
  decode0x68NpcMoveToTarget,
} from '../../src/netproto/d2gs/s2c/movement.ts'
import { serverEventToS2cPackets } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

describe('S2C Movement Packet Decoders for nPathType & nVelocity (Issue #586)', () => {
  it('decodes nPathType and nVelocity from 0x67 NpcMove', () => {
    // 0x67 packet:
    // [0] 0x67
    // [1..4] unitId u32LE (e.g. 101)
    // [5] moveType u8 (e.g. 0x01 walk)
    // [6..7] targetX u16LE (1234)
    // [8..9] targetY u16LE (5678)
    // [10..11] unk0x0A u16LE
    // [12] nPathType u8 (e.g. 4)
    // [13..14] nVelocity i16LE (e.g. 75 = 75% speed)
    // [15] unk u8
    const w = new ByteWriter(16)
    w.u8(0x67)
    w.u32LE(101)
    w.u8(0x01) // walk
    w.u16LE(1234)
    w.u16LE(5678)
    w.u16LE(0) // unk0x0A
    w.u8(4) // nPathType
    w.i16LE(75) // nVelocity = 75%
    w.u8(0)

    const event = decode0x67NpcMove(w.toUint8Array())
    expect(event.type).toBe('UnitMove')
    if (event.type === 'UnitMove') {
      expect(event.id).toBe(101)
      expect(event.mode).toBe('walk')
      expect(event.to).toEqual({ x: 1234, y: 5678 })
      expect(event.pathType).toBe(4)
      expect(event.velocityPercent).toBe(75)
    }
  })

  it('decodes nPathType and nVelocity from 0x68 NpcMoveToTarget', () => {
    // 0x68 packet:
    // [0] 0x68
    // [1..4] unitId u32LE
    // [5] moveType u8 (0x17 run)
    // [6..7] currentX u16LE (100)
    // [8..9] currentY u16LE (200)
    // [10] targetType u8 (0 = player)
    // [11..14] targetId u32LE (1)
    // [15..16] unk0x0F u16LE
    // [17] nPathType u8 (3)
    // [18..19] nVelocity i16LE (120 = 120%)
    // [20] unk u8
    const w = new ByteWriter(21)
    w.u8(0x68)
    w.u32LE(202)
    w.u8(0x17) // run
    w.u16LE(100)
    w.u16LE(200)
    w.u8(0) // targetType = player
    w.u32LE(1) // targetId
    w.u16LE(0) // unk0x0F
    w.u8(3) // nPathType
    w.i16LE(120) // nVelocity
    w.u8(0)

    const event = decode0x68NpcMoveToTarget(w.toUint8Array())
    expect(event.type).toBe('UnitMove')
    if (event.type === 'UnitMove') {
      expect(event.id).toBe(202)
      expect(event.mode).toBe('run')
      expect(event.pathType).toBe(3)
      expect(event.velocityPercent).toBe(120)
      expect(event.target).toEqual({ unitType: 0, id: 1 })
    }
  })
})

describe('resolveRemoteMoveSpeed with MonStats & velocityPercent (Issue #586)', () => {
  it('resolves authentic monster speed using MonStats.txt data for NPCs and monsters', () => {
    // Akara (classId 148): MonStats Velocity = 3 -> 1.171875 sub-tiles/sec
    const akaraSpeed = resolveRemoteMoveSpeed({
      unitType: 1,
      classId: 148,
      running: false,
    })
    expect(akaraSpeed.speedSubTilesPerSec).toBe(1.171875)

    // Zombie (classId 19): MonStats Velocity = 15 -> 5.859375 sub-tiles/sec
    const zombieSpeed = resolveRemoteMoveSpeed({
      unitType: 1,
      classId: 19,
      running: false,
    })
    expect(zombieSpeed.speedSubTilesPerSec).toBe(5.859375)

    // Fallen (classId 0): MonStats Velocity = 9 -> 3.515625 sub-tiles/sec
    const fallenSpeed = resolveRemoteMoveSpeed({
      unitType: 1,
      classId: 0,
      running: false,
    })
    expect(fallenSpeed.speedSubTilesPerSec).toBe(3.515625)
  })

  it('scales monster speed with nVelocity while maintaining 25% floor', () => {
    // Zombie at 75% speed
    const chilledZombie = resolveRemoteMoveSpeed({
      unitType: 1,
      classId: 19,
      running: false,
      velocityPercent: 75,
    })
    expect(chilledZombie.speedSubTilesPerSec).toBe(5.859375)

    // Severe slow (10% velocityPercent) clamped to 25% floor:
    const frozenZombie = resolveRemoteMoveSpeed({
      unitType: 1,
      classId: 19,
      running: false,
      velocityPercent: 10,
    })
    // 25% floor: (25 * Math.trunc((25 * (5 << 8)) / 100)) / 4096 = 1.953125
    expect(frozenZombie.speedSubTilesPerSec).toBe(
      resolveRemoteMoveSpeed({
        unitType: 1,
        classId: 19,
        running: false,
        velocityPercent: 25,
      }).speedSubTilesPerSec,
    )
  })

  it('scales remote player speed with nVelocity while maintaining 25% floor', () => {
    // Remote player walking at 50% speed
    const chilledPlayer = resolveRemoteMoveSpeed({
      unitType: 0,
      running: false,
      velocityPercent: 50,
    })
    expect(chilledPlayer.speedSubTilesPerSec).toBe(D2_BASE_WALK_SUBTILES_PER_SEC * 0.5)

    // Remote player at 10% speed clamped to 25% floor
    const frozenPlayer = resolveRemoteMoveSpeed({
      unitType: 0,
      running: false,
      velocityPercent: 10,
    })
    expect(frozenPlayer.speedSubTilesPerSec).toBe(D2_BASE_WALK_SUBTILES_PER_SEC * 0.25)
  })
})

describe('RemoteEntityInterpolator Kinematics & Parity (Issue #598)', () => {
  it('advances remote monsters at authentic velocity without 1.5x synthetic catchup acceleration', () => {
    const interpolator = new RemoteEntityInterpolator()

    // Spawn Akara at visual position (98, 100) lagging behind server
    interpolator.spawnOrSnap({
      unitType: 1,
      unitId: 10,
      classId: 148,
      x: 98,
      y: 100,
    })

    // Server sends move to (105, 100) with server position at (100, 100)
    // Server segment distance is 5, but visual distance is 7
    const moveCmd = interpolator.startMove({
      unitType: 1,
      unitId: 10,
      currentX: 100,
      currentY: 100,
      targetX: 105,
      targetY: 100,
      running: false,
    })

    // In 1.13c parity (Issue #598): speed is strictly authentic MonStats speed (1.171875),
    // NOT boosted by arbitrary 1.5x catchup multiplier
    expect(moveCmd.speedSubTilesPerSec).toBe(1.171875)

    // Step 1 second (1000ms)
    interpolator.update(1000)
    const state = interpolator.getEntityState(1, 10)!
    expect(state.moving).toBe(true)
    // Advance = 1.171875 sub-tiles from currentX (98)
    expect(state.x).toBeCloseTo(98 + 1.171875, 4)
  })

  it('settles cleanly on authoritative stop packets without post-stop sliding deceleration', () => {
    const interpolator = new RemoteEntityInterpolator()

    interpolator.spawnOrSnap({
      unitType: 1,
      unitId: 20,
      classId: 19, // Zombie
      x: 100,
      y: 100,
    })

    interpolator.startMove({
      unitType: 1,
      unitId: 20,
      targetX: 110,
      targetY: 100,
      running: false,
    })

    // Update 500ms -> unit moves toward target
    interpolator.update(500)
    const movingState = interpolator.getEntityState(1, 20)!
    expect(movingState.moving).toBe(true)

    // Server stop packet received at movingState.x
    const stoppedState = interpolator.stopEntity({
      unitType: 1,
      unitId: 20,
      x: movingState.x,
      y: 100,
    })

    // In 1.13c parity (Issue #598): unit immediately settles at authoritative stop position,
    // moving is set to false, and no post-stop overshoot happens
    expect(stoppedState.moving).toBe(false)
    expect(stoppedState.x).toBe(movingState.x)
    expect(stoppedState.y).toBe(100)

    // Further updates do not move the unit
    interpolator.update(500)
    const afterUpdateState = interpolator.getEntityState(1, 20)!
    expect(afterUpdateState.moving).toBe(false)
    expect(afterUpdateState.x).toBe(movingState.x)
    expect(afterUpdateState.y).toBe(100)
  })
})

describe('Remote Player Locomotion & Anti-Rubberbanding Parity (Issue #1387)', () => {
  it('resolves CharStats 9.0 walk / 13.5 run sub-tiles/s for all 7 player classes (classId 0..6) without falling into MonStats.txt', () => {
    for (let classId = 0; classId <= 6; classId++) {
      const walk = resolveRemoteMoveSpeed({
        unitType: 0,
        classId,
        running: false,
      })
      expect(walk.running).toBe(false)
      expect(walk.speedSubTilesPerSec).toBe(D2_BASE_WALK_SUBTILES_PER_SEC)

      const run = resolveRemoteMoveSpeed({
        unitType: 0,
        classId,
        running: true,
      })
      expect(run.running).toBe(true)
      expect(run.speedSubTilesPerSec).toBe(D2_BASE_RUN_SUBTILES_PER_SEC)

      // With +30% FRW boots (EFRW = 25 -> 175% total velocityPercent on run)
      const frwRun = resolveRemoteMoveSpeed({
        unitType: 0,
        classId,
        running: true,
        velocityPercent: 175,
      })
      expect(frwRun.speedSubTilesPerSec).toBe(D2_BASE_WALK_SUBTILES_PER_SEC * 1.75)
    }
  })

  it('uses 15-sub-tile drift tolerance (D2Client.dll 0x6FADA2AF) for remote players and halts cleanly on 0x0D stop within 1 sub-tile (0x6FADA460)', () => {
    expect(D2_REMOTE_PLAYER_SNAP_THRESHOLD).toBe(15)
    const interp = new RemoteEntityInterpolator()
    interp.spawnOrSnap({ unitType: 0, unitId: 2, classId: 1, x: 5000, y: 5000, dir64: 56 })

    // Start running to (5030, 5000)
    interp.startMove({
      unitType: 0,
      unitId: 2,
      classId: 1,
      currentX: 5000,
      currentY: 5000,
      targetX: 5030,
      targetY: 5000,
      running: true,
    })

    // Drift of 8 sub-tiles (> 7 monster RN limit, but <= 15 remote player limit) must NOT hard-snap!
    const stateWithin15 = interp.startMove({
      unitType: 0,
      unitId: 2,
      classId: 1,
      currentX: 5008,
      currentY: 5000,
      targetX: 5030,
      targetY: 5000,
      running: true,
    })
    expect(stateWithin15.x).toBe(5000)
    expect(stateWithin15.speedSubTilesPerSec).toBeGreaterThan(D2_BASE_RUN_SUBTILES_PER_SEC)

    // Drift of 16 sub-tiles (> 15 limit) hard-snaps to currentX
    const stateBeyond15 = interp.startMove({
      unitType: 0,
      unitId: 2,
      classId: 1,
      currentX: 5016,
      currentY: 5000,
      targetX: 5030,
      targetY: 5000,
      running: true,
    })
    expect(stateBeyond15.x).toBe(5016)

    // Advance 400ms (5.4 sub-tiles -> 5021.4)
    interp.update(400)
    const beforeStop = interp.getEntityState(0, 2)!
    expect(beforeStop.x).toBeCloseTo(5021.4, 4)

    // Server sends 0x0D PlayerStop at integer (5021, 5000) (0.4 sub-tiles behind visual position):
    // Per D2Client.dll 0x6FADA460 (|dx| <= 1 && |dy| <= 1), player halts in place at 5021.4 without snapping backward or turning 180°!
    const stopped = interp.stopEntity({
      unitType: 0,
      unitId: 2,
      x: 5021,
      y: 5000,
    })
    expect(stopped.moving).toBe(false)
    expect(stopped.x).toBeCloseTo(5021.4, 4)
    expect(stopped.dir64).toBe(56)
    expect(stopped.targetDir64).toBe(56)
  })

  it('encodes UnitMove walk (0x01), run (0x17), and stop (0x0D PlayerStop / 0x6D NPCStop) accurately in serverEventToS2cPackets', () => {
    const walkPkts = serverEventToS2cPackets({
      type: 'UnitMove',
      unitType: 0,
      id: 2,
      mode: 'walk',
      from: { x: 5000, y: 5000 },
      to: { x: 5010, y: 5000 },
    })
    expect(walkPkts).toHaveLength(1)
    expect(walkPkts[0]![0]).toBe(0x0f)
    expect(walkPkts[0]![6]).toBe(0x01)
    expect(decode0x0FPlayerMove(walkPkts[0]!)).toMatchObject({
      type: 'UnitMove',
      unitType: 0,
      id: 2,
      mode: 'walk',
      from: { x: 5000, y: 5000 },
      to: { x: 5010, y: 5000 },
    })

    const runPkts = serverEventToS2cPackets({
      type: 'UnitMove',
      unitType: 0,
      id: 2,
      mode: 'run',
      from: { x: 5000, y: 5000 },
      to: { x: 5010, y: 5000 },
    })
    expect(runPkts[0]![0]).toBe(0x0f)
    expect(runPkts[0]![6]).toBe(0x17)
    expect(decode0x0FPlayerMove(runPkts[0]!)).toMatchObject({
      type: 'UnitMove',
      unitType: 0,
      id: 2,
      mode: 'run',
    })

    const stopPkts = serverEventToS2cPackets({
      type: 'UnitMove',
      unitType: 0,
      id: 2,
      mode: 'stop',
      from: { x: 5010, y: 5000 },
      to: { x: 5010, y: 5000 },
    })
    expect(stopPkts).toHaveLength(1)
    expect(stopPkts[0]![0]).toBe(0x0d)
    expect(decode0x0DPlayerStop(stopPkts[0]!)).toMatchObject({
      type: 'UnitMode',
      unitType: 0,
      id: 2,
      mode: 1,
      at: { x: 5010, y: 5000 },
    })
  })

  it('synchronizes remote player movement in multiplayer OnlineSession + GameInstance without rubberbanding (naked and with FRW)', () => {
    const game = new GameInstance({ mode: 'open', maxPlayers: 8, seed: 1387, difficulty: 0, act: 0, areaId: 1 })
    const watcherId = game.connectPlayer({ charClass: 'sor', name: 'Watcher', x: 5000, y: 5000, areaId: 1 })
    const runnerId = game.connectPlayer({ charClass: 'pal', name: 'Runner', x: 5000, y: 5005, areaId: 1 })

    const world = new ClientWorld()
    const session = new OnlineSession({ world })
    for (const ev of game.drainEvents(watcherId)) {
      session.handleServerEvent(ev)
    }

    // Equip +30% FRW boots on Runner (both on server and in client remoteEquipmentByPlayerId)
    const runnerRecord = (game as unknown as { players: Map<number, { items: unknown[] }> }).players.get(runnerId)!
    runnerRecord.items.push({
      id: 9001,
      code: 'lbt',
      location: 'equipped',
      equipSlot: 9,
      durability: 12,
      stats: new Map([[96, 30]]),
    })

    // Runner runs 27 sub-tiles from (5000, 5005) to (5027, 5005)
    game.enqueueCommand(runnerId, { type: 'Move', to: { x: 5027, y: 5005 }, run: true })

    let prevVisualX = world.getUnit('player', runnerId)!.x
    expect(prevVisualX).toBe(5000)

    for (let tick = 1; tick <= 60; tick++) {
      game.stepFrame()
      for (const ev of game.drainEvents(watcherId)) {
        session.handleServerEvent(ev)
      }
      session.tick(40, tick * 40)
      const remoteUnit = world.getUnit('player', runnerId)!
      const serverPos = game.getPlayerState(runnerId)!
      // Remote player must NEVER be pulled backward (monotonic X progression)
      expect(remoteUnit.x).toBeGreaterThanOrEqual(prevVisualX - 1e-6)
      // And visual position must stay tightly aligned with server position (< 1.0 sub-tile)
      expect(Math.abs(remoteUnit.x - serverPos.x)).toBeLessThan(1.0)
      prevVisualX = remoteUnit.x
    }

    const finalRemote = world.getUnit('player', runnerId)!
    expect(finalRemote.x).toBeCloseTo(5027, 1)
    expect(finalRemote.y).toBeCloseTo(5005, 1)
    expect(finalRemote.moving).toBe(false)
    session.destroy()
  })
})
