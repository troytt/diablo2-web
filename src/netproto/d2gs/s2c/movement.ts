/**
 * D2GS S->C Player and NPC Movement / Reassignment Packet Decoders (1.13c).
 * Verified against D2Client.dll 0x6fb5f590 (0x0D), 0x6fb5f510 (0x0F), 0x6fb5f4c0 (0x10),
 * 0x6fb5f640 (0x15), 0x6fb5f460 (0x67), 0x6fb5f3f0 (0x68), 0x6fb5f2b0 (0x6D), 0x6fb5d950 (0x96).
 */

import { BitReader } from '../../core/bit-reader.ts'
import { ByteReader } from '../../core/byte-reader.ts'
import { unitTypeToId } from '../../domain/ids.ts'
import type { ServerEvent } from '../../domain/server-event.ts'
import { requirePacketLength } from './packet-length.ts'

function resolveMoveMode(rawMoveType: number): 'walk' | 'run' | 'knockback' | 'stop' {
  // In D2Client.dll 0x6fac9830 (player) & 0x6fb82e68 (monster):
  // - 0x17 (0x0F/0x67 run) / 0x18 (0x10/0x68 run) / 0x02 = run
  // - 0x13/0x14 (player KB), 0x0e/0x0f (monster KB), 0x20/0x09 = knockback
  if (
    rawMoveType === 0x20 ||
    rawMoveType === 0x09 ||
    rawMoveType === 0x0e ||
    rawMoveType === 0x0f ||
    rawMoveType === 0x13 ||
    rawMoveType === 0x14
  ) {
    return 'knockback'
  }
  if (
    rawMoveType === 0x17 ||
    rawMoveType === 0x18 ||
    rawMoveType === 0x02 ||
    (rawMoveType & 0x02) !== 0
  ) {
    return 'run'
  }
  return 'walk'
}

/**
 * Map `0x0D PlayerStop` network command code (`pkt[6]`) to 1.13c `PlrMode` (`0..19`).
 *
 * Verified against `D2Game.dll 0x6fd22ce0` (`stru_6FD30708`) and `D2Client.dll 0x6fac9830`
 * (jump table `0x6fac9d18` / index table `0x6fac9d58`):
 * - `0x00`: Walk to Target Unit (`d3 = 0x00` for `PLRMODE_WALK` / `PLRMODE_TOWNWALK`); on `0x0D`
 *   stop (`0x6fac9963 -> 0x6fac98fa`), transitions to Neutral (`5` TN in town, `1` NU outside).
 * - `0x01`: Walk to Location (`d2 = 0x01`), stops into Neutral (`5` / `1`).
 * - `0x07`: Neutral / TownNeutral (`5` / `1`, `0x6fac9c39`).
 * - `0x08`: `PLRMODE_DEATH` (`0`, DT, `0x6fac9b8d`) — the ONLY command code that enters mode `0`.
 * - `0x09`: `PLRMODE_DEAD` (`17`, DD, `0x6fac9c1b`) — the ONLY command code that enters mode `17`.
 * - `0x06`: `PLRMODE_GETHIT` (`4`, GH, `0x6fac99d1`).
 * - `0x12`: `PLRMODE_BLOCK` (`9`, BL, `0x6fac9b5c`).
 * - `0x13` / `0x14`: `PLRMODE_KNOCKBACK` (`19`, KB, `0x6fac9a0d` / `0x6fac9b0d`).
 * - `0x15`..`0x18`: Cast / Run stop fallbacks (`0x6fac98fa` -> Neutral `5` / `1`).
 * - `0x19`: `PLRMODE_SKILL1` (`13`, S1, `0x6fac9cc6`).
 */
export function map0x0DCodeToPlrMode(rawCode: number, inTown = false): number {
  const neutralMode = inTown ? 5 : 1
  switch (rawCode) {
    case 0x00:
    case 0x01:
    case 0x02:
    case 0x07:
    case 0x15:
    case 0x16:
    case 0x17:
    case 0x18:
      return neutralMode
    case 0x08:
      return 0 // DT (Death)
    case 0x09:
      return 17 // DD (Dead)
    case 0x06:
      return 4 // GH (Get Hit)
    case 0x12:
      return 9 // BL (Block)
    case 0x13:
    case 0x14:
      return 19 // KB (Knockback)
    case 0x19:
      return 13 // S1 (Skill 1)
    default:
      return neutralMode
  }
}

/** 0x0D PlayerStop (13B, D2Client.dll 0x6fb5f590, D2MOO PlrMsg.cpp:85-107 stru_6FD30708) */
export function decode0x0DPlayerStop(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x0D
  const unitType = unitTypeToId(r.u8())
  const id = r.u32LE()
  const rawCode = r.u8()
  const x = r.u16LE()
  const y = r.u16LE()
  const hitClass = r.u8()
  const lifePct = r.u8()
  const mode = map0x0DCodeToPlrMode(rawCode)
  return {
    type: 'UnitMode',
    unitType,
    id,
    mode,
    at: { x, y },
    ...(hitClass > 0 ? { hitClass } : {}),
    lifePct,
  }
}

/** 0x0F PlayerMove (16B, D2Client.dll 0x6fb5f510) */
export function decode0x0FPlayerMove(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x0F
  const unitType = unitTypeToId(r.u8())
  const id = r.u32LE()
  const moveType = r.u8()
  const targetX = r.u16LE()
  const targetY = r.u16LE()
  r.u8() // 0
  const currentX = r.u16LE()
  const currentY = r.u16LE()
  return {
    type: 'UnitMove',
    unitType,
    id,
    mode: resolveMoveMode(moveType),
    from: { x: currentX, y: currentY },
    to: { x: targetX, y: targetY },
  }
}

/** 0x10 PlayerMoveToTarget (16B, D2Client.dll 0x6fb5f4c0) */
export function decode0x10PlayerMoveToTarget(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x10
  const unitType = unitTypeToId(r.u8())
  const id = r.u32LE()
  const moveType = r.u8()
  const targetType = unitTypeToId(r.u8())
  const targetId = r.u32LE()
  const currentX = r.u16LE()
  const currentY = r.u16LE()
  return {
    type: 'UnitMove',
    unitType,
    id,
    mode: resolveMoveMode(moveType),
    from: { x: currentX, y: currentY },
    to: { x: currentX, y: currentY },
    target: { unitType: targetType, id: targetId },
  }
}

/** 0x15 ReassignPlayer (11B, D2Client.dll 0x6fb5f640) */
export function decode0x15ReassignPlayer(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x15
  const unitType = unitTypeToId(r.u8())
  const id = r.u32LE()
  const x = r.u16LE()
  const y = r.u16LE()
  const snap = r.u8() !== 0
  return {
    type: 'UnitReassign',
    unitType,
    id,
    at: { x, y },
    snap,
  }
}

/**
 * 0x67 NPCMove (16B, D2Client.dll 0x6FB5F460 → 0x6FADA750 → monster command 0x6FAFDC70; no drift
 * check). Builds `s = {x @06, y @08, u8 @0A, path type @0C, i16 velocity % @0D, u8 @0F, u8 @0B}`
 * with the command byte @05 (0x6FB5F467..0x6FB5F4A5). @0A and @0B are two separate bytes.
 */
export function decode0x67NpcMove(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x67 NPCMove', 16)
  const r = new ByteReader(pkt)
  r.u8() // 0x67
  const id = r.u32LE()
  const cmd = r.u8()
  const x = r.u16LE()
  const y = r.u16LE()
  const b0A = r.u8()
  const b0B = r.u8()
  const pathType = r.u8()
  const velocityPercent = r.i16LE()
  const b0F = r.u8()
  return {
    type: 'UnitMove',
    unitType: 1,
    id,
    mode: resolveMoveMode(cmd),
    to: { x, y },
    pathType,
    velocityPercent,
    npc: { opcode: 0x67, cmd, s: [x, y, b0A, pathType, velocityPercent, b0F, b0B] },
  }
}

/**
 * 0x68 NPCMoveToTarget (21B, D2Client.dll 0x6FB5F3F0). The u16 pair @06/@08 is the server's current
 * position and only feeds the drift check 0x6FADA1B0 (0x6FB5F441); the path follows the target
 * unit. `s = {target type @0A, target id @0B, u8 @0F, path type @11, i16 velocity % @12, u8 @14,
 * u8 @10}`.
 */
export function decode0x68NpcMoveToTarget(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x68 NPCMoveToTarget', 21)
  const r = new ByteReader(pkt)
  r.u8() // 0x68
  const id = r.u32LE()
  const cmd = r.u8()
  const x = r.u16LE()
  const y = r.u16LE()
  const rawTargetType = r.u8()
  const targetId = r.u32LE()
  const b0F = r.u8()
  const b10 = r.u8()
  const pathType = r.u8()
  const velocityPercent = r.i16LE()
  const b14 = r.u8()
  return {
    type: 'UnitMove',
    unitType: 1,
    id,
    mode: resolveMoveMode(cmd),
    from: { x, y },
    to: { x, y },
    target: { unitType: unitTypeToId(rawTargetType), id: targetId },
    pathType,
    velocityPercent,
    npc: {
      opcode: 0x68,
      cmd,
      s: [rawTargetType, targetId, b0F, pathType, velocityPercent, b14, b10],
      driftCheckAt: { x, y },
    },
  }
}

/**
 * 0x6D NPCStop (10B, D2Client.dll 0x6FB5F2B0): drift check at (x, y) (0x6FB5F304), then monster
 * command 7 with `s = {x @05, y @07, life @09, 2, 0, 4, 0}` (0x6FB5F2BE..0x6FB5F32E).
 */
export function decode0x6DNpcStop(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x6D NPCStop', 10)
  const r = new ByteReader(pkt)
  r.u8() // 0x6D
  const id = r.u32LE()
  const x = r.u16LE()
  const y = r.u16LE()
  const life = r.u8()
  return {
    type: 'UnitMove',
    unitType: 1,
    id,
    mode: 'stop',
    to: { x, y },
    npc: { opcode: 0x6d, cmd: 7, s: [x, y, life, 2, 0, 4, 0], driftCheckAt: { x, y } },
  }
}

/** 0x96 WalkVerify (9B, D2Client.dll 0x6fb5d950 -> 0x6fb5c140) */
export function decode0x96WalkVerify(pkt: Uint8Array): ServerEvent {
  const br = new BitReader(pkt)
  br.readBits(8) // 0x96
  const stamina = br.readBits(15)
  const x = br.readBits(16)
  const y = br.readBits(16)
  const vx = br.readSignedBits(8)
  const vy = br.readSignedBits(8)
  return {
    type: 'LifeMana',
    life: -1,
    mana: -1,
    stamina,
    at: { x, y },
    vx,
    vy,
  }
}
