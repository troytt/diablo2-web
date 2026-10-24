// ============================================================================
// tests/client/npc-motion-113c.test.ts
// 1.13c D2Client NpcMotion Engine & ClientWorld Integration Tests
// Verifies binary ground truth from D2Client.dll 0x6FAFCE10..0x6FAFED80,
// 0x6FADA1B0, 0x6FAFDC70, 0x6FB5F2B0..0x6FB5F7C0, and D2Common #10819.
// ============================================================================

import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import {
  MONMODE_DEATH,
  MONMODE_KNOCKBACK,
  MONMODE_NEUTRAL,
  MONMODE_RUN,
  MONMODE_WALK,
  PATHTYPE_KNOCKBACK_CLIENT,
  PATHTYPE_TOWARD,
  UNIT_PLAYER,
} from '../../src/common/path/index.ts'
import { ByteWriter, decodeD2gsServerPacket } from '../../src/netproto/index.ts'

function stepTicks(world: ClientWorld, count: number): void {
  for (let i = 0; i < count; i++) {
    world.npcMotion.tick()
  }
}

describe('1.13c NpcMotion Engine (D2Client.dll 0x6FAFCE10..0x6FAFED80)', () => {
  it('1. 0x67 NPCMove never calls 0x6FADA1B0 drift snap and sets dwFlagEx |= 0x2000 hold-walk at path end', () => {
    const world = new ClientWorld()
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 101,
        classId: 5, // Zombie (Velocity=1)
        x: 5000,
        y: 5000,
        mode: MONMODE_NEUTRAL,
        lifePct: 128,
      },
    })

    // Decode a real 0x67 packet to (5002, 5000):
    // In 1.13c 0x6FB5F460 (0x67) NEVER calls 0x6FADA1B0, because (x, y) is the path TARGET, not current pos!
    const w67 = new ByteWriter(16)
    w67.u8(0x67)
    w67.u32LE(101)
    w67.u8(0x01) // walk -> cmd 1
    w67.u16LE(5002)
    w67.u16LE(5000)
    w67.u16LE(1)
    w67.u8(7)
    w67.i16LE(100)
    w67.u8(5)
    world.applyEvent(decodeD2gsServerPacket(w67.toUint8Array()))

    const unit = world.getUnit('monster', 101)!
    // Must start from (5000, 5000), NOT snap to (5002, 5000)
    expect(Math.floor(unit.x)).toBe(5000)
    expect(Math.floor(unit.y)).toBe(5000)
    expect(unit.mode).toBe(MONMODE_WALK)

    const npcUnit = world.npcMotion.getUnit(101)!
    expect((npcUnit.dwFlagEx & 0x2000) !== 0).toBe(true)

    // Step enough frames to reach (5002, 5000) and exceed it:
    // Because dwFlagEx & 0x2000 is set (0x6FAFDA60), reaching path end must NOT drop mode to NU(1);
    // the monster holds WL(2) until 0x6D arrives!
    stepTicks(world, 60)
    expect(Math.round(unit.x)).toBe(5002)
    expect(Math.round(unit.y)).toBe(5000)
    expect(unit.mode).toBe(MONMODE_WALK)
  })

  it('2. 0x6FADA1B0 drift check uses mode BEFORE command (3..5 -> 5, 6..11 -> 7, else -> 15) strictly > threshold', () => {
    const world = new ClientWorld()

    // Put monster 201 in A1 (4, in 3..5 -> threshold 5) and S1 (8, in 6..11 -> threshold 7) and WL (2 -> threshold 15)
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 201,
        classId: 5,
        x: 5000,
        y: 5000,
        mode: 4, // MONMODE_ATTACK1 (4) -> threshold 5
        lifePct: 128,
      },
    })
    world.applyEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 0,
        name: 'Hero',
        x: 5025,
        y: 5000,
        mode: 1,
      },
    })

    // Helper to build a 21-byte 0x68 packet with PATHTYPE_TOWARD (2)
    const build68 = (moveType: number, x: number, y: number) => {
      const w = new ByteWriter(21)
      w.u8(0x68)
      w.u32LE(201)
      w.u8(moveType)
      w.u16LE(x)
      w.u16LE(y)
      w.u8(UNIT_PLAYER)
      w.u32LE(1)
      w.u16LE(0)
      w.u8(PATHTYPE_TOWARD)
      w.i16LE(100)
      w.u8(5)
      return decodeD2gsServerPacket(w.toUint8Array())
    }

    // While in mode 4 (threshold 5), drift of 5 (to 5005) must NOT snap (5 <= 5):
    world.applyEvent(build68(0x18, 5005, 5000))
    const u201 = world.getUnit('monster', 201)!
    expect(Math.floor(u201.x)).toBe(5000)
    expect(u201.mode).toBe(MONMODE_RUN)

    // Now u201 is in RN (15) -> threshold is 15 (strictly > 15).
    // Drift of 15 (to 5015) must NOT snap (15 <= 15):
    world.applyEvent(build68(0x18, 5015, 5000))
    expect(Math.floor(u201.x)).toBe(5000)

    // Drift of 16 while in RN (from 5000 to 5016) -> 16 > 15 -> MUST snap to 5016:
    world.applyEvent(build68(0x18, 5016, 5000))
    expect(Math.floor(u201.x)).toBe(5016)
  })

  it('3. 0x6D NPCStop: |dx|<=1 && |dy|<=1 stops in NU(1); 1 < dist <= threshold walks with PATHTYPE_TOWARD(2) and drops 0x2000', () => {
    const world = new ClientWorld()
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 301,
        classId: 5,
        x: 5000,
        y: 5000,
        mode: MONMODE_WALK,
        lifePct: 128,
      },
    })

    const build6D = (x: number, y: number) => {
      const w = new ByteWriter(10)
      w.u8(0x6d)
      w.u32LE(301)
      w.u16LE(x)
      w.u16LE(y)
      w.u8(128)
      return decodeD2gsServerPacket(w.toUint8Array())
    }

    // First send 0x6D at distance 3 (|5003 - 5000| = 3 <= 15, > 1):
    // 0x6FAFE8E6 (cmd 7) walks to (5003, 5000) with PATHTYPE_TOWARD(2) and clears dwFlagEx &= ~0x2000
    // so reaching (5003, 5000) drops into NU(1).
    world.applyEvent(build6D(5003, 5000))

    const u301 = world.getUnit('monster', 301)!
    const npc301 = world.npcMotion.getUnit(301)!
    expect(u301.mode).toBe(MONMODE_WALK)
    expect((npc301.dwFlagEx & 0x2000) === 0).toBe(true)

    // Step until path finishes -> because 0x2000 is clear, 0x6FAFDA60 transitions to NU(1)!
    stepTicks(world, 90)
    expect(Math.round(u301.x)).toBe(5003)
    expect(u301.mode).toBe(MONMODE_NEUTRAL)

    // Now put back in WL at (5003, 5000) and send 0x6D at (5004, 5000) (|dx|=1, |dy|=0):
    // Must immediately stop in NU(1) without walking.
    const w67 = new ByteWriter(16)
    w67.u8(0x67)
    w67.u32LE(301)
    w67.u8(0x01)
    w67.u16LE(5008)
    w67.u16LE(5000)
    w67.u16LE(1)
    w67.u8(7)
    w67.i16LE(100)
    w67.u8(5)
    world.applyEvent(decodeD2gsServerPacket(w67.toUint8Array()))
    expect(u301.mode).toBe(MONMODE_WALK)

    world.applyEvent(build6D(5004, 5000))
    expect(u301.mode).toBe(MONMODE_NEUTRAL)
  })

  it('4. 0x69 SetNPCMode: DT(8) and DD(9) ignore packet (x, y) and die in place without teleporting', () => {
    const world = new ClientWorld()
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 401,
        classId: 5,
        x: 5000,
        y: 5000,
        mode: MONMODE_WALK,
        lifePct: 128,
      },
    })

    // Server sends 0x69 state=0x08 (DT) with packet coords (5099, 5099) far away:
    // 0x6FB5F390 does NOT call 0x6FADA1B0 for state 8 or 9, and 0x6FAFE298 ignores s0/s1!
    const w69 = new ByteWriter(12)
    w69.u8(0x69)
    w69.u32LE(401)
    w69.u8(0x08) // DT -> MONMODE_DEATH(0)
    w69.u16LE(5099)
    w69.u16LE(5099)
    w69.u8(0)
    w69.u8(0)
    world.applyEvent(decodeD2gsServerPacket(w69.toUint8Array()))

    const u401 = world.getUnit('monster', 401)!
    expect(u401.mode).toBe(MONMODE_DEATH)
    expect(Math.floor(u401.x)).toBe(5000)
    expect(Math.floor(u401.y)).toBe(5000)

    // Subsequent 0x15 UnitReassign on a dead monster (DT/DD) must early-exit (0x6FB5F640) and NOT move the corpse!
    world.applyEvent({
      type: 'UnitReassign',
      unitType: 'monster',
      id: 401,
      at: { x: 5088, y: 5088 },
      snap: true,
    })
    expect(Math.floor(u401.x)).toBe(5000)
    expect(Math.floor(u401.y)).toBe(5000)
  })

  it('5. Knockback KB(13): steps along PATHTYPE_KNOCKBACK_CLIENT(11) at velocity 0x1000 (4096) and holds last frame', () => {
    const world = new ClientWorld()
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 501,
        classId: 5,
        x: 5000,
        y: 5000,
        mode: MONMODE_NEUTRAL,
        lifePct: 128,
      },
    })
    world.applyEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 0,
        name: 'Hero',
        x: 4997,
        y: 5000,
        mode: 1,
      },
    })

    // Trigger cmd 0x14 (knockback state handler 0x6FAFE1D8 -> MONMODE_KNOCKBACK 13):
    // s = [targetX=5003, targetY=5000, dist=3, pathType=0, vel=0, life=128, hitClass=0]
    world.npcMotion.applyCommandForUnit(501, {
      opcode: 0x69,
      cmd: 0x14,
      s: [5003, 5000, 3, 0, 0, 128, 0],
      driftCheckAt: null,
    })

    const u501 = world.getUnit('monster', 501)!
    const npc501 = world.npcMotion.getUnit(501)!
    expect(u501.mode).toBe(MONMODE_KNOCKBACK)
    expect(npc501.pDynamicPath!.dwVelocity).toBe(0x1000)

    // Knockback pushes monster to (5003, 5000) at 1.0 sub-tile/tick (dwVelocity = 0x1000):
    stepTicks(world, 20)
    expect(Math.round(u501.x)).toBe(5003)
    expect(Math.round(u501.y)).toBe(5000)
    // Holds MONMODE_KNOCKBACK (anim=2 never auto-ends on client)
    expect(u501.mode).toBe(MONMODE_KNOCKBACK)
  })

  it('6. D2Common #10819: both WL(2) and RN(15) scale MonStats.Velocity (+0x10A), never MonStats.Run (+0x10C)', () => {
    const world = new ClientWorld()
    // Corrupt Rogue (hcIdx=44, Velocity=6, Run=8)
    world.applyEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 601,
        classId: 44,
        x: 5000,
        y: 5000,
        mode: MONMODE_NEUTRAL,
        lifePct: 128,
      },
    })
    world.applyEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 0,
        name: 'Hero',
        x: 5015,
        y: 5000,
        mode: 1,
      },
    })

    const w68 = new ByteWriter(21)
    w68.u8(0x68)
    w68.u32LE(601)
    w68.u8(0x18) // Run -> cmd 0x18 -> MONMODE_RUN(15)
    w68.u16LE(5000)
    w68.u16LE(5000)
    w68.u8(UNIT_PLAYER)
    w68.u32LE(1)
    w68.u16LE(0)
    w68.u8(PATHTYPE_TOWARD)
    w68.i16LE(100)
    w68.u8(5)
    world.applyEvent(decodeD2gsServerPacket(w68.toUint8Array()))

    const npc601 = world.npcMotion.getUnit(601)!
    // #10819 reads MonStats.Velocity (6 for classId 44) << 8 = 1536, scaled by velocityPct=100 -> 1536!
    expect(npc601.pDynamicPath!.dwVelocity).toBe(6 << 8)
  })

  it('7. re-spawning an existing monster when synthetic rooms trigger pruneDistantSyntheticRooms does not leave a freed pDynamicPath in units', () => {
    const world = new ClientWorld()
    // Spawn several monsters across distant synthetic rooms so roomStore.size >= 100 (MAX_SYNTH_ROOMS_BEFORE_PRUNE)
    for (let i = 0; i < 15; i++) {
      world.npcMotion.spawnMonster({
        unitId: 700 + i,
        classId: 5,
        x: 1000 + i * 200,
        y: 1000 + i * 200,
        mode: MONMODE_NEUTRAL,
      })
    }

    // Re-spawning an already-registered monster ID at a new distant location triggers
    // PATH_FreeDynamicPath(existing.pDynamicPath) followed by findOrCreateRoomAt -> pruneDistantSyntheticRooms.
    // Must not throw D2AssertError: PATH_GetXPosition (0x692): pDynamicPath!
    expect(() => {
      world.npcMotion.spawnMonster({
        unitId: 700,
        classId: 5,
        x: 9000,
        y: 9000,
        mode: MONMODE_NEUTRAL,
      })
    }).not.toThrow()

    const npc700 = world.npcMotion.getUnit(700)!
    expect(npc700.pDynamicPath).not.toBeNull()
    expect(npc700.subtileX).toBe(9000)
    expect(npc700.subtileY).toBe(9000)

    // Subsequent ticks and S2C 0x6C / 0x6D / 0x67 packets must also succeed without assertion errors
    expect(() => {
      stepTicks(world, 5)
    }).not.toThrow()
  })
})
