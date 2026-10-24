/**
 * D2GS S->C Unit Assign, Remove, and Mode Decoders (1.13c).
 * Verified against D2Client.dll 0x6fb5df70 (0x09), 0x6fb5ca40 (0x0A), 0x6fb5f5f0 (0x0C),
 * 0x6fb5f560 (0x0E), 0x6fb5daa0 (0x11), 0x6fb5df40 (0x51), 0x6fb5df20 (0x59),
 * 0x6fb5f390 (0x69), and 0x6fb5e420 (0xAC).
 */

import { BitReader } from '../../core/bit-reader.ts'
import { ByteReader } from '../../core/byte-reader.ts'
import { ByteWriter } from '../../core/byte-writer.ts'
import { unitTypeToId } from '../../domain/ids.ts'
import type { ServerEvent } from '../../domain/server-event.ts'
import { getMonsterAnimCompBitWidths } from './monstats2-comp-bits.ts'
import { requirePacketLength } from './packet-length.ts'

/** 0x09 AssignWarp (11B, D2Client.dll 0x6fb5df70) */
export function decode0x09AssignWarp(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x09
  const unitType = unitTypeToId(r.u8())
  const id = r.u32LE()
  const warpId = r.u8()
  const x = r.u16LE()
  const y = r.u16LE()
  return {
    type: 'UnitAssign',
    classId: warpId,
    unit: {
      unitType,
      id,
      classId: warpId,
      warpId,
      x,
      y,
    },
  }
}

/** 0x0A RemoveGroundUnit (6B, D2Client.dll 0x6fb5ca40) */
export function decode0x0ARemoveUnit(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x0A
  const unitType = unitTypeToId(r.u8())
  const id = r.u32LE()
  return {
    type: 'UnitRemove',
    unitType,
    id,
  }
}

/** 0x0C NPCGetHit (9B, D2Client.dll 0x6fb5f5f0, D2MOO SCmd.cpp:190-202 & MonsterMsg.cpp:94) */
export function decode0x0CNpcGetHit(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x0C
  const unitType = unitTypeToId(r.u8())
  const id = r.u32LE()
  r.u8() // unk0x06 (19)
  const hitClass = r.u8()
  const rawLife = r.u8()
  const lifePct = rawLife & 0x7f
  return {
    type: 'UnitMode',
    unitType,
    id,
    hitClass,
    lifePct,
  }
}

/**
 * 0x0E SetObjectState (12B, D2Client.dll 0x6fb5f560): `[1]` unit type, `[2..5]` id, `[6]` event code, `[7]` flag,
 * `[8..11]` u32 mode.
 *
 * D2Client 0x6fb5f560 passes `pkt[6]` as the event and `{pkt[7], mode}` to 0x6fada750, which sends objects to
 * ObjectEvent 0x6fad5ce0: event 3 = set mode (0x6fad59f0, the only path that also sets the object light),
 * event 0x15 = operate fx (0x6fad4b90, `pkt[7]` = player id; mode untouched), any other event is fatal (0x6fad5ced).
 * The flag is the door path argument of DoorSetMode 0x6fad5040 for doors.
 */
export function decode0x0ESetObjectState(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x0E
  const unitType = unitTypeToId(r.u8())
  const id = r.u32LE()
  const eventCode = r.u8()
  const eventFlag = r.u8()
  const mode = r.u32LE()
  return {
    type: 'UnitMode',
    unitType,
    id,
    mode,
    eventCode,
    eventFlag,
  }
}

/**
 * 0x11 UnitOverlay (8B, D2Client.dll 0x6fb5daa0; generic handler, table entry 0x6FB8DF2C, not queued per unit).
 *
 * Server side: D2MOO `STAT_UNIT_DOOVERLAY` (`SUnitMsg.cpp:396-411`), sent whenever an Overlay.txt overlay is
 * put on a unit (e.g. every successful hit of a skill with `SrvOverlay`, `Skills.cpp:2118`).
 * Client side: find the unit by (type, id) (`0x6fb5dab8`), bounds-check the u16 against the Overlay.txt record
 * count (`0x6fb5dad9`) and create the overlay (`0x6fb5daed` → `0x6fb1b300`). It never changes mode, HP,
 * ISDEAD or position. The raw unit type is kept (the server uses type 6 / id 0xFFFFFFFF when it has no unit,
 * which makes the client's lookup fail).
 */
export function decode0x11UnitOverlay(pkt: Uint8Array): ServerEvent {
  if (pkt.byteLength !== 8) {
    throw new Error(`0x11 UnitOverlay: expected 8 bytes, got ${String(pkt.byteLength)}`)
  }
  const r = new ByteReader(pkt)
  r.u8() // 0x11
  const rawUnitType = r.u8()
  const id = r.u32LE()
  const overlayIndex = r.u16LE()
  return {
    type: 'UnitOverlay',
    rawUnitType,
    id,
    overlayIndex,
  }
}

/**
 * Encode S2C 0x11 UnitOverlay (8B, D2Game `STAT_UNIT_DOOVERLAY` / `D2GAME_STATES_SendEventS2C_6FC91B20`).
 * Layout:
 * - [0] u8 = 0x11
 * - [1] u8 = rawUnitType (0=player, 1=monster, etc.)
 * - [2..5] u32LE = unit GUID (`id`)
 * - [6..7] u16LE = `Overlay.txt` row index (`overlayIndex`)
 */
export function encode0x11UnitOverlay(params: {
  readonly rawUnitType: number
  readonly id: number
  readonly overlayIndex: number
}): Uint8Array {
  const w = new ByteWriter(8)
  w.u8(0x11)
  w.u8(params.rawUnitType & 0xff)
  w.u32LE(params.id >>> 0)
  w.u16LE(params.overlayIndex & 0xffff)
  return w.toUint8Array()
}

/** 0x51 AssignObject (14B, D2Client.dll 0x6fb5df40) */
export function decode0x51AssignObject(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x51
  const unitType = unitTypeToId(r.u8())
  const id = r.u32LE()
  const classId = r.u16LE()
  const x = r.u16LE()
  const y = r.u16LE()
  const mode = r.u8()
  const flags = r.u8()
  return {
    type: 'UnitAssign',
    classId,
    unit: {
      unitType,
      id,
      classId,
      x,
      y,
      mode,
      flags,
    },
  }
}

/**
 * 1.13c D2Client.dll `0x6fb82e68` (`30` entries) mapping monster state-command byte (`pkt[5]` in
 * `0x67`, `0x68`, `0x69`, `0x6A`, `0x6B`) to canonical `MonMode.txt` ID (`0..16`).
 * Inverse of D2Game.dll `0x6fd1a718` (`g_aMonModePacketTable`).
 */
export const MONSTER_CMD_TO_MODE: readonly number[] = [
  2, // 0x00: WL (0x68 walk)
  2, // 0x01: WL (0x67 walk)
  16, // 0x02: special
  16, // 0x03: special
  7, // 0x04: SC (SkillCast no target)
  7, // 0x05: SC (SkillCast with target)
  3, // 0x06: GH (Get Hit)
  1, // 0x07: NU (Neutral / 0x6D stop)
  0, // 0x08: DT (Death animation)
  12, // 0x09: DD (Dead corpse)
  4, // 0x0A: A1 (Attack 1 with target)
  4, // 0x0B: A1 (Attack 1 no target)
  8, // 0x0C: S1 (Skill 1 no target)
  8, // 0x0D: S1 (Skill 1 with target)
  9, // 0x0E: S2 (Skill 2 no target)
  9, // 0x0F: S2 (Skill 2 with target)
  5, // 0x10: A2 (Attack 2 with target)
  5, // 0x11: A2 (Attack 2 no target)
  6, // 0x12: BL (Block)
  16, // 0x13: special
  13, // 0x14: KB (Knockback)
  14, // 0x15: XX (Sequence)
  14, // 0x16: XX (Sequence)
  15, // 0x17: RN (0x67 run)
  15, // 0x18: RN (0x68 run)
  8, // 0x19: S1 (Skill 1)
  10, // 0x1A: S3 (Skill 3 no target)
  10, // 0x1B: S3 (Skill 3 with target)
  11, // 0x1C: S4 (Skill 4 no target)
  11, // 0x1D: S4 (Skill 4 with target)
]

export function resolveMonsterCmdMode(rawCmd: number): number {
  const mapped = MONSTER_CMD_TO_MODE[rawCmd]
  return mapped !== undefined ? mapped : rawCmd
}

/**
 * In 1.13c (`D2Game.dll 0x6fd13620` & `D2Client.dll 0x6fafdc70`):
 * - `pkt[10]` (`0x69`/`0x6B`) / `pkt[11]` (`0x6A`) carries `lifePct & 0x7f` ONLY when `rawCmd === 0x06` (`MONMODE_GETHIT`, `0x6fd13829` / `0x6fafe16c`).
 * - When `rawCmd === 0x08` (`MONMODE_DEATH`) or `0x09` (`MONMODE_DEAD`), `D2Client.dll` (`0x6fafe298`) sets HP to `0`.
 * - For all other commands (e.g. `0x0C` `MONMODE_SEQUENCE` when Charsi hammers the anvil), the byte is `0` on the wire and must NOT overwrite `unit.lifePct` with `0`.
 */
function resolveMonsterCmdLifePct(rawCmd: number, paramByte: number): number | undefined {
  if (rawCmd === 0x08 || rawCmd === 0x09) {
    return 0
  }
  if (rawCmd === 0x06) {
    if (paramByte === 0) return undefined
    const masked = paramByte & 0x7f
    return masked > 0 ? masked : 128
  }
  return paramByte > 0 && paramByte <= 0x80 ? paramByte : undefined
}

/** 0x59 AssignPlayer (26B, D2Client.dll 0x6fb5df20 -> 0x6fac9275) */
export function decode0x59AssignPlayer(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x59
  const id = r.u32LE()
  const classId = r.u8()
  const name = r.fixedCString(16)
  const x = r.u16LE()
  const y = r.u16LE()
  return {
    type: 'UnitAssign',
    classId,
    unit: {
      unitType: 0,
      id,
      classId,
      name,
      x,
      y,
      mode: 1,
    },
  }
}

/**
 * 0x69 SetNPCMode (12B, D2Client.dll 0x6fb5f390 -> 0x6fafdc70)
 *
 * Commands 0x08 (DT) and 0x09 (DD) never read the packet x/y on the client (`0x6FAFE298` / `0x6FAFE79C`): the
 * monster dies where the client currently has it. For DT the server fills those words with the path's last point
 * (D2MOO `MonsterMsg.cpp:206-219` `sub_6FC65C70`, `PATH_GetLastPointX/Y`) — a stale path end — so no position is
 * emitted for them.
 *
 * `npc.s = {x @06, y @08, u8 @0A, 2, 0, 4, u8 @0B}` exactly as the 0x6FB5F390 builder stacks it; no drift check.
 */
export function decode0x69SetNpcMode(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x69 SetNPCMode', 12)
  const r = new ByteReader(pkt)
  r.u8() // 0x69
  const id = r.u32LE()
  const rawCmd = r.u8()
  const x = r.u16LE()
  const y = r.u16LE()
  const paramByte = r.u8()
  const b0B = r.u8()
  const lifePct = resolveMonsterCmdLifePct(rawCmd, paramByte)
  return {
    type: 'UnitMode',
    unitType: 1,
    id,
    mode: resolveMonsterCmdMode(rawCmd),
    ...(lifePct !== undefined ? { lifePct } : {}),
    npc: { opcode: 0x69, cmd: rawCmd, s: [x, y, paramByte, 2, 0, 4, b0B] },
  }
}

/**
 * 0x6A NPCAction (12B, D2Client.dll 0x6fb5f340 -> 0x6fafdc70).
 * `npc.s = {target type @06, target id @07, u8 @0B, 2, 0, 4, <uninitialised>}`; no drift check.
 */
export function decode0x6ANpcAction(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x6A NPCAction', 12)
  const r = new ByteReader(pkt)
  r.u8() // 0x6A
  const id = r.u32LE()
  const rawCmd = r.u8()
  const rawTargetType = r.u8()
  const targetId = r.u32LE()
  const paramByte = r.u8()
  const lifePct = resolveMonsterCmdLifePct(rawCmd, paramByte)
  return {
    type: 'UnitMode',
    unitType: 1,
    id,
    mode: resolveMonsterCmdMode(rawCmd),
    ...(lifePct !== undefined ? { lifePct } : {}),
    npc: { opcode: 0x6a, cmd: rawCmd, s: [rawTargetType, targetId, paramByte, 2, 0, 4, null] },
  }
}

/**
 * 0x6B NPCAction2 (16B, D2Client.dll 0x6fb5f7c0 -> 0x6fb5f390 -> 0x6fafdc70): drift check at
 * (u16 @0C, u16 @0E) (0x6FB5F7D7), then the 0x69 builder over bytes @05..@0B.
 */
export function decode0x6BNpcAction2(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x6B NPCAction2', 16)
  const r = new ByteReader(pkt)
  r.u8() // 0x6B
  const id = r.u32LE()
  const rawCmd = r.u8()
  const sx = r.u16LE()
  const sy = r.u16LE()
  const paramByte = r.u8()
  const b0B = r.u8()
  const x = r.u16LE()
  const y = r.u16LE()
  const lifePct = resolveMonsterCmdLifePct(rawCmd, paramByte)
  return {
    type: 'UnitMode',
    unitType: 1,
    id,
    mode: resolveMonsterCmdMode(rawCmd),
    ...(lifePct !== undefined ? { lifePct } : {}),
    npc: {
      opcode: 0x6b,
      cmd: rawCmd,
      s: [sx, sy, paramByte, 2, 0, 4, b0B],
      driftCheckAt: { x, y },
    },
  }
}

/**
 * 0x76 HoverTextClear (6B, D2Client.dll 0x6fb5d370).
 *
 * The client looks the unit up in the table of wire type `pkt[1]` (0x6fb5d39d -> 0x6FB54E20), frees its
 * overhead hover message at unit+0xA4 (0x6fb5d3b5 -> D2Common #10422 CHAT_FreeHoverMsg) and zeroes the field.
 * Nothing else: no mode, HP or ISDEAD change. The server (D2MOO `sub_6FCC5FA0`) sends it when a unit flagged
 * UNITFLAG_HASTXTMSG no longer has hover text — the text timed out or was freed at death (`sub_6FC63E80`).
 * Decoding it as a mode change revived dead units into NU (Refs #916).
 */
export function decode0x76HoverTextClear(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x76 HoverTextClear', 6)
  const r = new ByteReader(pkt)
  r.u8() // 0x76
  const rawUnitType = r.u8()
  const id = r.u32LE()
  return {
    type: 'UnitHoverTextClear',
    rawUnitType,
    id,
  }
}

/**
 * 0xAC AssignNPC (variable pkt[12], D2Game.dll 0x6fcaca40 -> D2Client.dll 0x6fb5e420).
 *
 * Bitstream layout starting at offset 13 (`0x6fb5e462`):
 * - 4 bits: initial monster mode `nMode` (`D2Game.dll 0x6fcacac9`: `0=DT`, `8=S1`, `9=S2`, `12=DD`,
 *   or `1=NU` for all other alive modes; normalized on initial `0xAC` sight so transient one-shot
 *   modes `3..11`, `13` start in `1=NU` while persistent `1=NU, 2=WL, 14=XX, 15=RN` and dead `0=DT, 12=DD` are preserved)
 * - 1 bit: `hasAnimComp` (`0x6fb5e47f`)
 *   - If `hasAnimComp === 1`, 16 component variant values follow with bit widths from
 *     `monstats2.bin[monstats.bin[hcIdx].wMonStatsEx].nComponentVariants[0..15]` (`0x6fab1260`).
 * - 1 bit: `hasMonsterFlags` (`0x6fb5e4fc`)
 *   - If `hasMonsterFlags === 1`:
 *     - 5 flag bits: `champion (0x04)`, `unique (0x08)`, `superunique (0x02)`, `minion (0x10)`, `ghostly (0x40)`
 *     - If `superunique`: 16-bit `superUniqueId` (`0x6fb5e549`)
 *     - Up to 9 `uint8` `bossMods` terminated by `0` (`0x6fb5e565..0x6fb5e585`)
 *     - 16-bit `nameSeed` (`0x6fb5e594`)
 * - 1 bit: `hasOwner` (`0x6fb5e5ae`), followed by 32-bit `ownerId` (`0x6fb5e5c4`) when `1`.
 */
export function decode0xACAssignNpc(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0xAC
  const id = r.u32LE()
  const classId = r.u16LE()
  const x = r.u16LE()
  const y = r.u16LE()
  const lifePct = r.u8()
  const packetLen = r.u8()

  let rawMode: number | undefined
  let flags = 0
  let isChampion: boolean | undefined
  let isUnique: boolean | undefined
  let isSuperUnique: boolean | undefined
  let superUniqueId: number | undefined
  let bossMods: number[] | undefined
  let nameSeed: number | undefined
  let compVariants: number[] | undefined
  let ownerId: number | undefined

  if (packetLen > 13 && pkt.byteLength >= 13) {
    const bitReader = new BitReader(pkt.subarray(13, Math.min(pkt.byteLength, packetLen)))
    if (bitReader.remainingBits >= 4) {
      rawMode = bitReader.readBits(4) // 4-bit initial monster mode (D2Client.dll 0x6fb5e462)
      if (bitReader.remainingBits >= 1) {
        const hasAnimComp = bitReader.readBit()
        let canReadFlags = true
        if (hasAnimComp === 1) {
          const widths = getMonsterAnimCompBitWidths(classId)
          const comps: number[] = []
          for (let i = 0; i < 16; i++) {
            const w = widths[i] ?? 1
            if (bitReader.remainingBits < w) {
              canReadFlags = false
              break
            }
            comps.push(bitReader.readBits(w))
          }
          if (canReadFlags) {
            compVariants = comps
          }
        }

        if (canReadFlags && bitReader.remainingBits >= 1) {
          const hasMonsterFlags = bitReader.readBit()
          let canReadOwner = hasMonsterFlags === 0
          if (hasMonsterFlags === 1 && bitReader.remainingBits >= 5) {
            if (bitReader.readBit()) {
              flags |= 0x04 // champion
              isChampion = true
            }
            if (bitReader.readBit()) {
              flags |= 0x08 // unique
              isUnique = true
            }
            if (bitReader.readBit()) {
              flags |= 0x02 // superunique
              isSuperUnique = true
            }
            if (bitReader.readBit()) flags |= 0x10 // minion
            if (bitReader.readBit()) flags |= 0x40 // ghostly

            let flagsComplete = true
            if (isSuperUnique) {
              if (bitReader.remainingBits >= 16) {
                superUniqueId = bitReader.readBits(16)
              } else {
                flagsComplete = false
              }
            }

            if (flagsComplete) {
              const mods: number[] = []
              for (let i = 0; i < 9; i++) {
                if (bitReader.remainingBits < 8) {
                  flagsComplete = false
                  break
                }
                const mod = bitReader.readBits(8)
                if (mod === 0) break
                mods.push(mod)
              }
              if (mods.length > 0) {
                bossMods = mods
              }
            }

            if (flagsComplete && bitReader.remainingBits >= 16) {
              nameSeed = bitReader.readBits(16)
              canReadOwner = true
            }
          }

          if (canReadOwner && bitReader.remainingBits >= 1) {
            const hasOwner = bitReader.readBit()
            if (hasOwner === 1 && bitReader.remainingBits >= 32) {
              ownerId = bitReader.readBits(32) >>> 0
            }
          }
        }
      }
    }
  }

  const mode =
    lifePct <= 0
      ? rawMode === 0 || rawMode === 12
        ? rawMode
        : 12
      : rawMode === 1 || rawMode === 2 || rawMode === 14 || rawMode === 15
        ? rawMode
        : 1

  // D2Client.dll 0x6fafd512..0x6fafd59c (D2CLIENT_InitMonsterUnit): initial facing seeded by unit id
  const direction = Math.imul(id, 0x6ac690c5) & 0x3f

  return {
    type: 'UnitAssign',
    classId,
    unit: {
      unitType: 1,
      id,
      classId,
      x,
      y,
      mode,
      direction,
      lifePct,
      flags,
      ...(isChampion !== undefined ? { isChampion } : {}),
      ...(isUnique !== undefined ? { isUnique } : {}),
      ...(isSuperUnique !== undefined ? { isSuperUnique } : {}),
      ...(superUniqueId !== undefined ? { superUniqueId } : {}),
      ...(bossMods !== undefined ? { bossMods } : {}),
      ...(nameSeed !== undefined ? { nameSeed } : {}),
      ...(compVariants !== undefined ? { compVariants } : {}),
      ...(ownerId !== undefined ? { ownerId } : {}),
    },
  }
}
