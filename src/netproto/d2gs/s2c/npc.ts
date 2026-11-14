/**
 * D2GS S->C NPC Info, Menu, Transaction, and Heal Packet Decoders (1.13c).
 * Verified against D2Client.dll:
 * - 0x27 NPCInfo (40B, 0x6fb5d680)
 * - 0x2A NPCTransaction (15B, 0x6fb5f9b0)
 * - 0x91 NPCGossip / SetNPCTalk (26B, 0x6fb5c750)
 * - 0xAB NPCHeal (7B, 0x6fb5d0b0)
 */

import { ByteReader } from '../../core/byte-reader.ts'
import type { ServerEvent } from '../../domain/server-event.ts'

export interface D2NpcMessageEntry {
  readonly menu: number
  readonly stringId: number
}

/**
 * 0x27 NPCInfo (40B, D2Client.dll 0x6fb5d680 -> 0x6fb2de50 / D2Common.#10619 0x6fd8d060 & #10485 0x6fd8d380):
 * - `[0]` = `0x27`
 * - `[1]` = `unitType` (`1` = monster/NPC, `2` = object)
 * - `[2..5]` = `dwUnitId` (`u32LE`)
 * - `[6]` = `count` (`u8`, clamped to `0..8` by `D2Common.#10485`)
 * - `[7]` = struct alignment padding (never read; uninitialized stack in `D2Game.dll 0x6fc54b80`, `0x6fc68cd1`, `0x6fd118b0`)
 * - `[8..39]` = 8 × 4-byte `D2MessageStrc` wire slots (`off = 8 + i * 4`):
 *   - `pkt[off]` = `nMenu` (`u8`: `0` = auto-open speech, `1` = talk quest topic, `2` = talk intro/gossip, `3` = unused / overhead speech)
 *   - `pkt[off + 1]` = struct alignment padding (never read; uninitialized stack in `0x6fc54b80`, `0x6fc68cd1`, `0x6fd118b0`)
 *   - `pkt[off + 2 .. off + 3]` = `wStringId` (`u16LE` `.tbl` string index)
 *
 * `D2Common.#10485` loops strictly `i = 0 .. count - 1`; slots `i >= count` contain uninitialized D2GS stack memory
 * in `QUESTS_NPCMessage` (`0x6fc54b80`, e.g. Frozen Anya `OperateFn 67` at `0x6fc7cdae` where `0x0200 = 512` `drehya`
 * sits on the stack) and must never be added to `messages`.
 */
export function decode0x27NpcInfo(pkt: Uint8Array): ServerEvent {
  if (pkt.length < 40) throw new RangeError(`0x27 NPCInfo: expected at least 40 bytes, got ${pkt.length}`)
  const r = new ByteReader(pkt)
  r.u8() // 0x27
  const unitType = r.u8()
  const npcId = r.u32LE()

  const rawCount = pkt[6]!
  const count = Math.min(rawCount, 8)
  const allMessages: Array<{ menu: number; stringId: number; msgId: number; menuIndex: number }> = []
  const messages: Array<{ menu: number; stringId: number; msgId: number; menuIndex: number }> = []
  for (let i = 0; i < 8; i++) {
    const off = 8 + i * 4
    const menuIndex = pkt[off]!
    const msgId = pkt[off + 2]! | (pkt[off + 3]! << 8)
    const entry = { menu: menuIndex, stringId: msgId, msgId, menuIndex }
    allMessages.push(entry)
    if (
      i < count &&
      msgId > 0 &&
      (menuIndex <= 2 || (count === 1 && menuIndex === 3))
    ) {
      messages.push(entry)
    }
  }
  return {
    type: 'Npc',
    kind: 'info',
    unitType,
    npcId,
    unitId: npcId,
    count,
    messages,
    allMessages,
    raw: pkt.slice(6),
  }
}

/**
 * 0x2A NPCTransaction (15B).
 *
 * Server builder D2Game.dll 0x6fcaac90(al=0x2A, cl=result, edx=gold; stack: client, itemId, flag):
 *   [0]=0x2A [1]=flag [2]=result [3..6]=not written (stack garbage) [7..10]=u32 itemId [11..14]=u32 gold (stat 14).
 * Client D2Client.dll 0x6fb5f9b0 -> 0x6fafbc80 copies the packet to 0x6fbc977f and only reads
 * result ([0x6fbc9781]) and itemId ([0x6fbc9786]); flag and gold are not consumed by the client
 * (inventory gold is driven by stat 14 updates).
 */
export function decode0x2ANpcTransaction(pkt: Uint8Array): ServerEvent {
  if (pkt.length !== 15) throw new RangeError(`0x2A NPCTransaction: expected 15 bytes, got ${pkt.length}`)
  const r = new ByteReader(pkt)
  r.u8() // 0x2A
  const flag = r.u8()
  const result = r.u8()
  r.skip(4) // [3..6] uninitialised on the server side
  const itemId = r.u32LE()
  const gold = r.u32LE()
  return {
    type: 'NpcTransaction',
    result,
    flag,
    itemId,
    gold,
  }
}

/** 0x8A NPCWantsInteract (6B, D2Client.dll 0x6fb5db30): [0x8A, unitType(u8), npcId(u32LE)] */
export function decode0x8ANpcWantsInteract(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x8A
  const unitType = r.u8()
  const npcId = r.u32LE()
  return {
    type: 'Npc',
    kind: 'wantsInteract',
    unitType,
    npcId,
    unitId: npcId,
  }
}

/**
 * 0x91 SetNPCTalk (26B, D2Client.dll 0x6fb5c750).
 * Packet layout:
 *   [0]      = 0x91
 *   [1]      = u8 nAct (0..4)
 *   [2..13]  = u16[6] pNPCFlags (copied via 3 DWORDs `rep movsd` to client table at 0x6fbb5990 + nAct*12)
 *   [14..25] = trailing 12 bytes (6 u16 words)
 */
export function decode0x91SetNpcTalk(pkt: Uint8Array): ServerEvent & {
  readonly type: 'Npc' | 'NpcMenu'
  readonly kind: 'menu'
  readonly npcId: number
  readonly unitId: number
  readonly act: number
  readonly npcFlags: readonly number[]
} {
  if (pkt.length !== 26) {
    throw new RangeError(`0x91 SetNPCTalk: expected 26 bytes, got ${pkt.length}`)
  }
  const r = new ByteReader(pkt)
  r.u8() // 0x91
  const act = r.u8()
  const flags: number[] = []
  for (let i = 0; i < 12; i++) {
    flags.push(r.u16LE())
  }
  return {
    type: 'Npc',
    kind: 'menu',
    act,
    npcFlags: flags,
    result: act,
    raw: pkt.slice(2),
  } as any
}

export const decode0x91NpcMenu = decode0x91SetNpcTalk

/**
 * 0xAB UnitLife (7B, D2Client.dll 0x6fb5d0b0). A generic life update for any unit, not an NPC heal:
 * `[1]` unit type, `[2..5]` id, `[6]` life on the 128 scale. The client ignores its own player and units with
 * `[unit+0xC4]` bit 9; a monster gets `SetStat(6, life << 8)` (0x6fb5d0fd), any other type updates the roster
 * entry: `roster+0x14 = (life * 100) / 128` (signed truncating division, 0x6fb5d113..0x6fb5d126).
 */
export function decode0xABNpcHeal(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0xAB
  const unitType = r.u8()
  const npcId = r.u32LE()
  const lifePct = r.u8()
  return {
    type: 'Npc',
    kind: 'heal',
    unitType,
    npcId,
    result: lifePct,
  }
}
