/**
 * D2GS S->C Sound, Pong, Warden, Missile, and Miscellaneous Packet Decoders (1.13c).
 * Verified against D2Client.dll 0x6fb8de60 handler table so every single valid 1.13c S->C
 * opcode in 0x00..0xB4 decodes to a strongly-typed ServerEvent (0 opaque packets).
 */

import { ByteReader } from '../../core/byte-reader.ts'
import { ByteWriter } from '../../core/byte-writer.ts'
import { unitTypeToId, wireUnitTypeId } from '../../domain/ids.ts'
import type { ServerEvent } from '../../domain/server-event.ts'
import { S2C_PACKET_SIZES } from '../tables/s2c-sizes.ts'
import { requirePacketLength, unitLookupMiss } from './packet-length.ts'

/** 0x2C PlaySound (8B, D2Client.dll 0x6fb5d740) */
export function decode0x2CPlaySound(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x2C
  const unitTypeRaw = r.u8()
  const unitType = wireUnitTypeId(unitTypeRaw)
  if (unitType === undefined) return unitLookupMiss(pkt) // #1656: D2Client unit lookup fails
  const id = r.u32LE()
  const sound = r.u16LE()
  return {
    type: 'PlaySound',
    unit: { unitType, id },
    sound,
  }
}

/** 0x8F Pong (33B, D2Client.dll 0x6fb5bf40) */
export function decode0x8FPong(pkt: Uint8Array, rttMs = 0): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x8F
  const tickCount = r.u32LE()
  return {
    type: 'Pong',
    rttMs,
    tickCount,
  }
}

/** 0xAE WardenRequest (variable u16@1, D2Client.dll 0x6fb5d630) */
export function decode0xAEWarden(pkt: Uint8Array): ServerEvent {
  return {
    type: 'Warden',
    payload: pkt.slice(3),
  }
}

/**
 * 0x53 EnvironmentSync (10B, D2Client.dll 0x6fb5e9c0).
 *
 * The handler passes the three fields straight to D2Common #10358 `InitializeEnvironment`
 * (0x6fd87920) on the client act: `u32 cycleIndex @1`, `i32 ticks @5`, `u8 eclipse @9`.
 * The game server sends it right after 0x03 LoadAct and whenever its own clock
 * (#11045 `UpdateCycleIndex`) changes cycle or drifts by more than 16 degrees.
 */
export function decode0x53EnvironmentSync(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x53
  const cycleIndex = r.u32LE()
  const ticks = r.u32LE() | 0
  const eclipse = r.u8() !== 0
  return {
    type: 'EnvironmentSync',
    cycleIndex,
    ticks,
    eclipse,
  }
}

/**
 * 0x73 CreateMissile (32B, D2Client.dll 0x6fb5eee0; built by D2Game 0x6fc8f740). The client knows a single
 * wire layout:
 * - [0]      = 0x73
 * - [1..4]   = u32LE unk (always 0 from D2Game)
 * - [5..6]   = u16LE missileClassId
 * - [7..10]  = u32LE x
 * - [11..14] = u32LE y
 * - [15..18] = u32LE targetX
 * - [19..22] = u32LE targetY
 * - [23..24] = u16LE remaining frames: D2Game reads missile data `i16 +0x10` with D2Common #10737; D2Client
 *              pushes it zero-extended (`movzx ecx, word` at 0x6fb5ef83) to D2Common #10970 (0x6FDBA6D0), which
 *              clamps to `[-0x8000, 0x7FFF]` before storing it back to `+0x10`. `+0x10` is the frame countdown:
 *              D2Game sets `+0x0E` (range) and `+0x10` to the same value at creation (e.g. 0x6fc8fccf/0x6fc8fcd6),
 *              decrements `+0x10` each tick (0x6fc5f39e..0x6fc5f3a8, missile ends when it reaches 0), and
 *              D2Common 0x6FDBA240 returns the elapsed frames as `+0x0E - +0x10` (#1655, #1664).
 * - [25]     = u8 ownerType
 * - [26..29] = u32LE ownerId
 * - [30]     = u8 level (D2Common #11029, missile data `+0x0C`; passed unchanged into the create struct, 0 allowed)
 * - [31]     = u8 pierceIdx: when non-zero D2Client sets stat 0x148 (`pierce_idx`) on the missile (0x6fb5ef6b..0x6fb5ef7e)
 * The target is used only when targetX AND targetY are both non-zero (`test edx, edx; je` /
 * `test ebx, ebx; je` before flag 0x40000021 at 0x6fb5ef3a..0x6fb5ef4c); otherwise the missile has no target.
 */
export function decode0x73CreateMissile(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x73 CreateMissile', 32)
  const r = new ByteReader(pkt)
  r.u8() // 0x73
  const unk = r.u32LE()
  const missileClassId = r.u16LE()
  const x = r.u32LE()
  const y = r.u32LE()
  const targetX = r.u32LE()
  const targetY = r.u32LE()
  const remainingFrames = Math.min(r.u16LE(), 0x7fff)
  // D2Client 0x6fb5ef5f..0x6fb5ef66 stores owner type @0x19 / id @0x1A on the missile unchecked; a type outside
  // 0..5 never resolves to an owner unit, so the event carries no owner (#1656).
  const ownerType = wireUnitTypeId(r.u8())
  const ownerId = r.u32LE()
  const level = r.u8()
  const pierceIdx = r.u8()
  const hasTarget = targetX !== 0 && targetY !== 0
  return {
    type: 'CreateMissile',
    missileClassId,
    at: { x, y },
    target: hasTarget ? { x: targetX, y: targetY } : { x, y },
    level,
    ...(ownerType !== undefined ? { owner: { unitType: ownerType, id: ownerId }, ownerType, ownerId } : {}),
    unk,
    remainingFrames,
    pierceIdx,
  }
}

/**
 * 0xA3 AuraStatSkill (24B, D2Client.dll 0x6fb5efb0; built by D2Game 0x6fc9a190, serialized by
 * D2Game 0x6fcaba90): `u8 flag, i16 skill, i16 level, u8 casterType, u32 casterId, u8 targetType,
 * u32 targetId, u32 x, u32 y`. The handler runs the skill's Skills.txt `cltprgfunc1` (0x6fb51b10),
 * not a cast, so it is its own event. Unit types stay raw: 0x6fb54e20 has no type range check.
 */
export function decode0xA3AuraSkill(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0xA3
  const flag = r.u8()
  const skill = r.i16LE() // movsx at 0x6fb5f008
  const level = r.i16LE() // movsx at 0x6fb5f069
  const casterType = r.u8()
  const casterId = r.u32LE()
  const targetType = r.u8()
  const targetId = r.u32LE()
  const x = r.u32LE()
  const y = r.u32LE()
  return {
    type: 'UnitSkillEvent',
    flag,
    skill,
    level,
    caster: { rawUnitType: casterType, id: casterId },
    target: { rawUnitType: targetType, id: targetId },
    x,
    y,
  }
}

/**
 * Encode S2C 0xA3 AuraStatSkill (24B, D2Game 0x6fc9a190 builder + D2Game 0x6fcaba90 serializer):
 * `[0]=0xA3, [1]=u8 flag, [2..3]=i16 skill, [4..5]=i16 level, [6]=u8 casterType, [7..10]=u32 casterId,
 * [11]=u8 targetType, [12..15]=u32 targetId, [16..19]=u32 x, [20..23]=u32 y`.
 */
export function encode0xA3AuraSkill(ev: {
  readonly flag?: number | undefined
  readonly skill: number
  readonly level: number
  readonly caster: { readonly rawUnitType: number; readonly id: number }
  readonly target: { readonly rawUnitType: number; readonly id: number }
  readonly x?: number | undefined
  readonly y?: number | undefined
}): Uint8Array {
  const w = new ByteWriter(24)
  w.u8(0xa3)
  w.u8((ev.flag ?? 0) & 0xff)
  w.i16LE(ev.skill)
  w.i16LE(ev.level)
  w.u8(ev.caster.rawUnitType & 0xff)
  w.u32LE(ev.caster.id >>> 0)
  w.u8(ev.target.rawUnitType & 0xff)
  w.u32LE(ev.target.id >>> 0)
  w.u32LE((ev.x ?? 0) >>> 0)
  w.u32LE((ev.y ?? 0) >>> 0)
  return w.toUint8Array()
}

/** 0xA4 MonsterSpecialSkill (3B, D2Client.dll 0x6fb5d760) */
export function decode0xA4MonsterSpecial(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0xA4
  const classId = r.u16LE()
  return {
    type: 'MonsterSpecial',
    classId,
  }
}

/** 0xA5 StateSkillEffect (8B, D2Client.dll 0x6fb5f7f0) */
export function decode0xA5StateSkillEffect(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0xA5
  const unitTypeRaw = r.u8()
  const unitType = wireUnitTypeId(unitTypeRaw)
  if (unitType === undefined) return unitLookupMiss(pkt) // #1656: D2Client unit lookup fails
  const id = r.u32LE()
  const skillId = r.u16LE()
  return {
    type: 'StateSkillEffect',
    unit: { unitType, id },
    skillId,
  }
}

/**
 * Fallback decoder for remaining rare 1.13c S->C opcodes in D2Net.dll size table
 * (e.g. 0x12..0x14, 0x16, 0x40, 0x45, 0x54, 0x57, 0x58, 0x5F, 0x61, 0x62,
 * 0x6E..0x72, 0x7E, 0x8A, 0x93, 0x97, 0x98, 0xA6, 0xAF) so that every
 * valid 1.13c S->C packet produces a typed domain event (never Opaque or phantom StatSet).
 * Opcodes whose D2Net S->C size is 0 (e.g. 0x17 and 0x80, which only D2Client's own table lists) are never
 * framed by D2NET_10033, so they are rejected instead of decoded with a guessed layout (#1663).
 */
export function decodeRare113cS2cPacket(pkt: Uint8Array): ServerEvent {
  const op = pkt[0]!
  if (op >= S2C_PACKET_SIZES.length || S2C_PACKET_SIZES[op] === 0) {
    throw new RangeError(`S2C 0x${op.toString(16).padStart(2, '0')} has D2Net size 0 and is never framed`)
  }
  switch (op) {
    case 0x12: // UnloadAct (1B, D2Client.dll 0x6fb5c370 / 0x6fb5d6a0)
      return { type: 'UnloadAct' }
    case 0x16: {
      // MultipleUnitAssign (variable, D2Net u16 size @1; D2Client.dll 0x6fb5d9d0): count @3 (`mov al,[ecx+3]`,
      // 0 asserts), entries from @4 (`lea edi,[ecx+4]`), 9 bytes each {u8 type, u32 id, u16 x, u16 y}; every
      // entry whose unit exists with the same type gets the 0x6fada1b0 position drift check.
      const count = pkt[3] ?? 0
      const r = new ByteReader(pkt.subarray(4))
      const entries: Array<{ unitType: ReturnType<typeof unitTypeToId>; id: number; x: number; y: number }> = []
      for (let i = 0; i < count && r.remaining >= 9; i++) {
        const unitType = wireUnitTypeId(r.u8())
        const id = r.u32LE()
        const x = r.u16LE()
        const y = r.u16LE()
        // An entry whose type is outside 0..5 never finds a unit, so it gets no drift check (#1656).
        if (unitType !== undefined) entries.push({ unitType, id, x, y })
      }
      return {
        type: 'ProtocolSync',
        opcode: op,
        byteLength: pkt.byteLength,
        entries,
      }
    }
    case 0x57: {
      // MonsterEnchant (14B, D2Client.dll 0x6fb5d560): u32 id @1; `cmp byte [ecx+5], 1` (monster only);
      // nameSeed u16 @6 -> pMonsterData+0x14; bossMods[0..2] = bytes @8, @9, @10 -> pMonsterData+0x1C..0x1E;
      // u16 @12 non-zero sets the champion flag (0x04), the unique flag (0x08) is always set; then 0x6fad0f20.
      // (The 1.13c D2Game sender 0x6fcaab50 has no callers.)
      const r = new ByteReader(pkt.subarray(1, 14))
      const monsterId = r.u32LE()
      const unitType = r.u8()
      const nameSeed = r.u16LE()
      const bossMods = [r.u8(), r.u8(), r.u8()]
      r.u8() // @11 unused
      const championFlag = r.u16LE()
      return {
        type: 'ProtocolSync',
        opcode: op,
        byteLength: pkt.byteLength,
        monsterEnchant: { monsterId, unitType, nameSeed, bossMods, champion: championFlag !== 0 },
      }
    }
    case 0x93: {
      // 0x93 (8B, D2Client.dll 0x6fb5d3d0): player id @1 (player table, type checked), i8 @5 (`cmp esi, 0x80`
      // sign fix), u8 @6, u8 @7 -> 0x6fb50c40 (walks the player's skill list; Skills.cpp).
      const r = new ByteReader(pkt.subarray(1, 8))
      const playerId = r.u32LE()
      const b5 = r.u8()
      const skillGroup = r.u8()
      const mode = r.u8()
      return {
        type: 'ProtocolSync',
        opcode: op,
        byteLength: pkt.byteLength,
        playerSkillUpdate: { playerId, value: b5 > 0x80 ? b5 - 0x100 : b5, skillGroup, mode },
      }
    }
    case 0x40: {
      // 0x40 (13B, D2Client.dll 0x6fb5d340 -> 0x6fb321b0): item id @1 (item table, type 4 asserted),
      // ITEMS_SetItemFlag(item, dword @5, dword @9).
      const r = new ByteReader(pkt.subarray(1, 13))
      const itemId = r.u32LE()
      const flag = r.u32LE()
      const enabled = r.u32LE()
      return { type: 'ItemFlagUpdate', ownerType: 4, ownerId: 0, itemId, flag, enabled, direct: true }
    }
    case 0x62: {
      // 0x62 (7B, D2Client.dll 0x6fb5dfd0 -> 0x6faf9370): unit type @1, id @2. Type 1 ends the current NPC
      // interaction (unit flag 2, NPC dialog state reset, 0x6faf67c0 frees the menu); types 2/4/6 close the
      // panels via 0x6fb6e350(1, 0); types 3/5 do nothing.
      const r = new ByteReader(pkt.subarray(1, 6))
      const rawUnitType = r.u8()
      const id = r.u32LE()
      return { type: 'ProtocolSync', opcode: op, byteLength: pkt.byteLength, unit: { rawUnitType, id } }
    }
    // 0xA6 (variable, D2Client.dll 0x6fb5bf20): when pkt[1] == 0, D2Common #10005(u16 @4, pkt + 6) rebuilds a
    // D2Common item table (ItemTbls.cpp); the port has no client-side D2Common table to update.
    case 0x5f: {
      // 0x5F (5B, D2Client.dll 0x6fb5c050): D2Common #10073 on the local player: pPlayerData+0x2C = dword @1.
      const r = new ByteReader(pkt.subarray(1, 5))
      return { type: 'ProtocolSync', opcode: op, byteLength: pkt.byteLength, playerData2C: r.u32LE() >>> 0 }
    }
    case 0x97:
      // WeaponSwitch (1B, D2Client.dll 0x6fb5bf50). Header only (D2MOO D2Game `SCmd.cpp:2361-2369`);
      // the server sends it right after toggling the client's switch flag (`ItemMode.cpp:3223-3224`).
      // It carries no skill: the new set's skills arrive as separate 0x23 packets, and the moved
      // items as 0x9D action 0x17 with their new body locs (`InvMode.cpp:178-181`) (#765).
      return { type: 'WeaponSwitch' }
    case 0xaf: // CompressionInfo (2B, D2Client.dll 0x6fb5d450)
      return { type: 'GameLoading' }
    case 0x58: // OpenUiBox (7B, D2Client.dll 0x6fb5f980)
      return decode0x58OpenUi(pkt)
    // 0x7E (5B, D2Client.dll 0x6fb5d240): reloads an engine data file `DATA\\GLOBAL\\<name>` picked from the
    // player's class table (0x6fba9eb4) into 0x6fbc44c8 via 0x6fb19240 — no web-port state to mirror.
    case 0x7e:
      return {
        type: 'ProtocolSync',
        opcode: op,
        byteLength: pkt.byteLength,
      }
    case 0x61: // CanGoToAct (2B, D2Client.dll 0x6fb5f940)
      return decode0x61CanGoToAct(pkt)
    case 0x8a: { // NPCWantsInteract (6B, D2Client.dll 0x6fb5db30)
      const npcId = pkt.byteLength >= 6 ? new ByteReader(pkt.subarray(2, 6)).u32LE() : 0
      return {
        type: 'Npc',
        kind: 'wantsInteract',
        unitType: pkt[1] ?? 1,
        npcId,
        unitId: npcId,
      }
    }
    case 0x98: {
      // 0x98 (7B, D2Client.dll 0x6fb5d4f0 -> 0x6fafc3c0): u32 monster id @1, u16 value @5 (0xFFFF -> -1),
      // stored at pMonsterData+0x40; no mode change. D2Game.dll 0x6fcaa6c0 sends it only for MonStats 528
      // (evilhut, caller 0x6fc9b26e `cmp [ebp+4], 0x210`).
      const r = new ByteReader(pkt.subarray(1, 7))
      const monsterId = r.u32LE()
      const raw = r.u16LE()
      return {
        type: 'ProtocolSync',
        opcode: op,
        byteLength: pkt.byteLength,
        evilHut: { monsterId, value: raw === 0xffff ? -1 : raw },
      }
    }
    default:
      return {
        type: 'ProtocolSync',
        opcode: op,
        byteLength: pkt.byteLength,
      }
  }
}

/**
 * 0x58 OpenUi (7B, D2Client.dll 0x6fb5f980 copies 7 bytes to 0x6fb50250):
 * u8 0x58 | u32 unitId (pkt[1..4]) | u8 uiAction (pkt[5]) | u8 extra (pkt[6]). No unit type is carried.
 * 0x6fb50250 switches on pkt[5] through the jump table at 0x6fb50300:
 * - 0 (0x6fb50264): open the Horadric Orifice UI (unitId = orifice object id, mode 0)
 * - 1 (0x6fb502cf): close the UI (0x6fb4f9e0)
 * - 4 (0x6fb5027b): clear the "please wait" state (state 2)
 * - 5 (0x6fb5029e): item consumed: sound (extra != 0 ? 5 : 3), then close
 * - 6, 7 (0x6fb502d4): close the UI (0x6fb4f9e0) and end the NPC interaction (0x6faf8150)
 * - 2, 3 and anything above 7 are fatal (0x6fb502de), so they are rejected here (#1659).
 */
export function decode0x58OpenUi(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x58 OpenUi', 7)
  const unitId = new ByteReader(pkt.subarray(1, 5)).u32LE()
  const uiId = pkt[5]!
  if (uiId === 2 || uiId === 3 || uiId > 7) {
    throw new RangeError(`0x58 OpenUi: action ${String(uiId)} is fatal in D2Client 0x6fb502de`)
  }
  return {
    type: 'OpenUi',
    unitId,
    uiId,
    extra: pkt[6]!,
  }
}

/** 0x61 CanGoToAct (2B, D2Client.dll 0x6fb5f940): u8 0x61 | u8 act */
export function decode0x61CanGoToAct(pkt: Uint8Array): ServerEvent {
  return {
    type: 'CanGoToAct',
    act: pkt[1] ?? 0,
  }
}
