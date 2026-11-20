/**
 * #765 — 1.13c weapon swap wire model (PROJECT.md "Gen2 Decisions — round 3", rules 23–25).
 *
 * S2C 0x97 WeaponSwitch is a 1-byte header-only packet that flips ONLY the local I/II tab. The items the
 * swap moved arrive separately as 0x9D action 0x17 (ITEMACTION_WEAPONSWITCH), each carrying its NEW body
 * loc, and are placed like any other equipment update without touching the tab.
 *
 * Ground truth (D2MOO, D2Game):
 * - `ITEMS/ItemMode.cpp` `sub_6FC46840` 3173-3224: physical 4<->11 / 5<->12 move (`INVENTORY_PlaceItemInBodyLoc`,
 *   `ITEMS_SetBodyLocation`), CMD flag 0x200000 on each moved item, then `CLIENTS_SetWeaponSwitch` + 0x97.
 * - `GAME/SCmd.cpp:2361-2369` `D2GAME_PACKETS_SendPacket0x97_6FC3FB60`: header only, sent to the owning client.
 * - `INVENTORY/InvMode.cpp:178-181` `sub_6FC410E0`: CMD flag 0x200000 -> 0x9D action 0x17, with no
 *   `pPlayer == pClientPlayer` check (observers receive other players' swaps too).
 * - `GAME/SCmd.cpp:1456-1510`: 0x9D carries the full item bitstream; socketed children are re-sent as
 *   0x13 ITEMINSOCKET right after the parent.
 * - `PLAYER/PlrSave2.cpp:1549-1551`: at join, 0x97 is sent once when the saved tab is II (no item moves).
 * - Real 1.13c capture `tests/fixtures/netproto/03-d2gs-items-npc-skills.d2cap`: C2S 0x60 -> S2C 0x97 ->
 *   0x23 skill assigns -> 0x9D/0x17 ktr (id 7) 4->11 and buc (id 8) 5->12; the second swap moves them back.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodeCapturedGameS2cPacket, OnlineSession } from '../../src/client/session/online-session.ts'
import { createSettingsStore } from '../../src/client/settings/settings-store.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { getCanonicalItemDataTables } from '../../src/client/world/item-tables-provider.ts'
import { ProtocolError } from '../../src/netproto/core/errors.ts'
import { parseD2CapJsonl } from '../../src/netproto/core/packet-tap.ts'
import { D2GS_S2C_REGISTRY, decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'
import type { ItemData } from '../../src/netproto/domain/ids.ts'
import type { ServerEvent } from '../../src/netproto/domain/server-event.ts'

const CAPTURE_PATH = resolve(process.cwd(), 'tests/fixtures/netproto/03-d2gs-items-npc-skills.d2cap')
const CAPTURE_TEXT = readFileSync(CAPTURE_PATH, 'utf8')

type ItemEvent = Extract<ServerEvent, { type: 'ItemEvent' }>

interface SwapSnapshot {
  readonly weaponSet: 0 | 1
  readonly slot4: number | undefined
  readonly slot5: number | undefined
  readonly slot11: number | undefined
  readonly slot12: number | undefined
  readonly leftSkill: number
  readonly rightSkill: number
}

function snapshot(world: ClientWorld): SwapSnapshot {
  const bySlot = world.containers.equipmentBySlot
  return {
    weaponSet: world.self.weaponSet,
    slot4: bySlot.get(4)?.id,
    slot5: bySlot.get(5)?.id,
    slot11: bySlot.get(11)?.id,
    slot12: bySlot.get(12)?.id,
    leftSkill: world.self.leftSkill,
    rightSkill: world.self.rightSkill,
  }
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Every game S2C packet of the capture, decoded with the production decoder, in wire order. */
function captureGameS2c(): Array<{ readonly bytes: Uint8Array; readonly ev: ServerEvent }> {
  const out: Array<{ readonly bytes: Uint8Array; readonly ev: ServerEvent }> = []
  for (const record of parseD2CapJsonl(CAPTURE_TEXT).records) {
    if (record.conn !== 'game' || record.dir !== 's2c') continue
    const bytes = hexToBytes(record.hex)
    out.push({ bytes, ev: decodeCapturedGameS2cPacket(bytes) })
  }
  return out
}

/** The first captured 0x9D packet with the given action / item id / body loc (found by content). */
function findCapturedItemPacket(action: number, itemId: number, bodyLoc: number): { bytes: Uint8Array; ev: ItemEvent } {
  for (const { bytes, ev } of captureGameS2c()) {
    if (ev.type !== 'ItemEvent' || bytes[0] !== 0x9d) continue
    if (ev.action === action && ev.item.id === itemId && ev.item.bodyLoc === bodyLoc) return { bytes, ev }
  }
  throw new Error(`capture has no 0x9D action 0x${action.toString(16)} for item ${itemId} at body loc ${bodyLoc}`)
}

function itemEvent(action: number, item: ItemData): ItemEvent {
  return { type: 'ItemEvent', action, item: { ...item, action }, container: item.container }
}

/** A real decoded equipped item re-identified / re-placed (all other fields stay as the decoder produced them). */
function equippedAt(base: ItemData, id: number, bodyLoc: number): ItemData {
  return { ...base, id, itemId: id, bodyLoc, equippedSlot: bodyLoc, container: 'equipment', location: 1 }
}

describe('#765 S2C 0x97 WeaponSwitch decoder (1.13c)', () => {
  const tables = getCanonicalItemDataTables()

  it('decodes the 1-byte 0x97 to a WeaponSwitch event that carries no skill', () => {
    // SCmd.cpp:2361-2369: `D2GSPacketSrv97` is the header byte only.
    expect(D2GS_S2C_REGISTRY[0x97]?.name).toBe('WeaponSwitch')
    const ev = decodeD2gsS2cPacket(new Uint8Array([0x97]), { tables })
    expect(ev).toEqual({ type: 'WeaponSwitch' })
    expect(ev.type).not.toBe('ActiveSkill')
  })

  it('rejects a 0x97 whose length differs from the 1-byte 1.13c size', () => {
    expect(() => decodeD2gsS2cPacket(new Uint8Array([0x97, 0x00]), { tables })).toThrow(ProtocolError)
  })
})

describe('#765 weapon swap through OnlineSession + ClientWorld (real 1.13c capture)', () => {
  it('replays both captured swaps: 0x97 flips only the tab, each 0x9D/0x17 moves one item to its new body loc', () => {
    const session = new OnlineSession({ settingsStore: createSettingsStore() })
    try {
      session.loadD2CapReplay(CAPTURE_TEXT)
      const world = session.world

      interface SwapRecord {
        readonly c2sBefore: number | undefined
        readonly before: SwapSnapshot
        readonly afterSwitch: SwapSnapshot
        readonly moves: Array<{ readonly id: number; readonly bodyLoc: number; readonly after: SwapSnapshot }>
      }
      const swaps: SwapRecord[] = []
      const tabFlipOpcodes: number[] = []
      let lastGameC2sOpcode: number | undefined

      for (;;) {
        const before = snapshot(world)
        const frame = session.stepD2CapReplay()
        if (frame === null) break
        const after = snapshot(world)
        if (after.weaponSet !== before.weaponSet) tabFlipOpcodes.push(frame.opcode)
        if (frame.conn !== 'game') continue
        if (frame.dir === 'c2s') {
          lastGameC2sOpcode = frame.opcode
          continue
        }
        if (frame.opcode === 0x97) {
          swaps.push({ c2sBefore: lastGameC2sOpcode, before, afterSwitch: after, moves: [] })
          continue
        }
        if (frame.opcode === 0x9d && frame.raw[1] === 0x17) {
          const ev = decodeCapturedGameS2cPacket(frame.raw)
          if (ev.type !== 'ItemEvent') throw new Error(`0x9D/0x17 decoded as ${ev.type}`)
          const current = swaps[swaps.length - 1]
          if (current === undefined) throw new Error('0x9D/0x17 before any 0x97 in the capture')
          current.moves.push({ id: ev.item.id, bodyLoc: ev.item.bodyLoc, after })
        }
      }

      // Exactly two swaps, each requested by C2S 0x60 SwapWeapons, and the tab flipped only on those 0x97s.
      expect(swaps).toHaveLength(2)
      expect(swaps.map((s) => s.c2sBefore)).toEqual([0x60, 0x60])
      expect(tabFlipOpcodes).toEqual([0x97, 0x97])

      const [first, second] = swaps as [SwapRecord, SwapRecord]

      // Swap 1 (I -> II). Before: ktr (id 7) in the right hand, buckler (id 8) in the left hand.
      expect(first.before).toMatchObject({ weaponSet: 0, slot4: 7, slot5: 8, slot11: undefined, slot12: undefined })
      // 0x97 itself: tab II, no item moved yet, and the skills are untouched (the old decoder wrote 0xffff here).
      expect(first.afterSwitch).toEqual({ ...first.before, weaponSet: 1 })
      expect(first.afterSwitch.rightSkill).not.toBe(0xffff)
      // The two 0x9D/0x17 packets carry the new body locs and are placed there; the tab stays II.
      expect(first.moves.map(({ id, bodyLoc }) => ({ id, bodyLoc }))).toEqual([
        { id: 7, bodyLoc: 11 },
        { id: 8, bodyLoc: 12 },
      ])
      expect(first.moves[1]!.after).toMatchObject({ weaponSet: 1, slot4: undefined, slot5: undefined, slot11: 7, slot12: 8 })

      // Swap 2 (II -> I) moves them back.
      expect(second.before).toMatchObject({ weaponSet: 1, slot4: undefined, slot5: undefined, slot11: 7, slot12: 8 })
      expect(second.afterSwitch).toEqual({ ...second.before, weaponSet: 0 })
      expect(second.moves.map(({ id, bodyLoc }) => ({ id, bodyLoc }))).toEqual([
        { id: 7, bodyLoc: 4 },
        { id: 8, bodyLoc: 5 },
      ])
      expect(second.moves[1]!.after).toMatchObject({ weaponSet: 0, slot4: 7, slot5: 8, slot11: undefined, slot12: undefined })

      // End of capture: set I active again, both items still owned exactly once.
      expect(snapshot(world)).toMatchObject({ weaponSet: 0, slot4: 7, slot5: 8, slot11: undefined, slot12: undefined })
      expect(world.containers.equipment.get(7)?.code).toBe('ktr')
      expect(world.containers.equipment.get(8)?.code).toBe('buc')
    } finally {
      session.destroy()
    }
  })

  it('join with a saved tab II: a lone 0x97 selects tab II and leaves the hands at body locs 4/5', () => {
    // PlrSave2.cpp:1549-1551: the server sends 0x97 once at join when `CLIENTS_GetWeaponSwitch(pClient)` is set;
    // no item moves, so the active weapons stay in body locs 4/5 (rule 24 / (d): weaponSet is the tab only).
    const session = new OnlineSession({ settingsStore: createSettingsStore() })
    try {
      session.loadD2CapReplay(CAPTURE_TEXT)
      const world = session.world
      while (world.containers.equipmentBySlot.get(4)?.id !== 7 || world.containers.equipmentBySlot.get(5)?.id !== 8) {
        if (session.stepD2CapReplay() === null) throw new Error('capture ended before the join equips of ktr/buc')
      }
      const joined = snapshot(world)
      const equipmentCount = world.containers.equipment.size
      expect(joined).toMatchObject({ weaponSet: 0, slot4: 7, slot5: 8, slot11: undefined, slot12: undefined })

      session.handleServerEvent(decodeCapturedGameS2cPacket(new Uint8Array([0x97])))

      expect(snapshot(world)).toEqual({ ...joined, weaponSet: 1 })
      expect(world.containers.equipment.size).toBe(equipmentCount)
    } finally {
      session.destroy()
    }
  })

  it("ignores another player's 0x9D/0x17 (observer copy) but places the local player's own copy", () => {
    // InvMode.cpp:178-181 sends 0x9D/0x17 to observers too. The real captured packet (ktr id 7 -> body loc 11) is
    // patched to another player's owner id (0x9D header bytes 9..12, after owner type byte 8 = 0 player).
    const session = new OnlineSession({ settingsStore: createSettingsStore() })
    try {
      session.loadD2CapReplay(CAPTURE_TEXT)
      session.replayAllD2Cap()
      const world = session.world
      expect(world.selfId).toBe(1)
      const settled = snapshot(world)
      expect(settled).toMatchObject({ weaponSet: 0, slot4: 7, slot5: 8, slot11: undefined, slot12: undefined })
      const equipmentCount = world.containers.equipment.size

      const own = findCapturedItemPacket(0x17, 7, 11)
      expect(own.ev.item.ownerType).toBe(0)
      expect(own.ev.item.ownerId).toBe(1)

      const observed = new Uint8Array(own.bytes)
      new DataView(observed.buffer).setUint32(9, 2, true)
      const observedEv = decodeCapturedGameS2cPacket(observed)
      expect(observedEv.type === 'ItemEvent' && observedEv.item.ownerId).toBe(2)
      session.handleServerEvent(observedEv)
      expect(snapshot(world)).toEqual(settled)
      expect(world.containers.equipment.size).toBe(equipmentCount)

      session.handleServerEvent(decodeCapturedGameS2cPacket(own.bytes))
      expect(snapshot(world)).toEqual({ ...settled, slot4: undefined, slot11: 7 })
      expect(world.containers.equipment.size).toBe(equipmentCount)
    } finally {
      session.destroy()
    }
  })
})

describe('#765 weapon swap edge cases through ClientWorld (decoded 1.13c items)', () => {
  const ktr = findCapturedItemPacket(0x06, 7, 4).ev.item
  const buc = findCapturedItemPacket(0x06, 8, 5).ev.item

  function freshWorld(): ClientWorld {
    const world = new ClientWorld()
    world.selfId = 1
    return world
  }

  it('re-attaches a socketed parent\'s child exactly once when the parent is moved (also with a duplicate parent 0x17)', () => {
    // SCmd.cpp:1501-1509 re-sends socketed children as 0x13 right after the parent's 0x9D. The InvMode.cpp:41-53
    // nested loop passes the PARENT to sub_6FC410E0 for each nested item, so the parent's 0x17 may repeat.
    const world = freshWorld()
    const parent = equippedAt(ktr, 100, 4)
    const child: ItemData = {
      ...ktr,
      id: 101,
      itemId: 101,
      ownerType: 4,
      ownerId: 100,
      location: 6,
      container: 'socket',
      bodyLoc: 0,
      equippedSlot: 0,
      inSocket: true,
      equipped: false,
    }
    world.apply(itemEvent(0x06, parent))
    world.apply(itemEvent(0x13, child))
    expect(world.containers.sockets.get(100)?.map((c) => c.id)).toEqual([101])

    world.apply({ type: 'WeaponSwitch' })
    world.apply(itemEvent(0x17, equippedAt(parent, 100, 11)))
    world.apply(itemEvent(0x13, child))
    world.apply(itemEvent(0x17, equippedAt(parent, 100, 11)))
    world.apply(itemEvent(0x13, child))

    expect(world.self.weaponSet).toBe(1)
    expect(world.containers.equipmentBySlot.get(11)?.id).toBe(100)
    expect(world.containers.equipmentBySlot.has(4)).toBe(false)
    expect(world.containers.sockets.get(100)?.map((c) => c.id)).toEqual([101])
  })

  for (const order of ['into-swap-slots-first', 'into-hands-first'] as const) {
    it(`exchanges both full weapon pairs with exactly one tab flip (${order})`, () => {
      // ItemMode.cpp:3173-3215 moves all four items before 0x97; the 0x17 order follows the inventory node list,
      // so both orders must converge on the same state.
      const world = freshWorld()
      world.apply(itemEvent(0x06, equippedAt(ktr, 201, 4)))
      world.apply(itemEvent(0x06, equippedAt(buc, 202, 5)))
      world.apply(itemEvent(0x06, equippedAt(ktr, 203, 11)))
      world.apply(itemEvent(0x06, equippedAt(buc, 204, 12)))
      expect(snapshot(world)).toMatchObject({ weaponSet: 0, slot4: 201, slot5: 202, slot11: 203, slot12: 204 })

      const toSwapSlots = [itemEvent(0x17, equippedAt(ktr, 201, 11)), itemEvent(0x17, equippedAt(buc, 202, 12))]
      const toHands = [itemEvent(0x17, equippedAt(ktr, 203, 4)), itemEvent(0x17, equippedAt(buc, 204, 5))]
      world.apply({ type: 'WeaponSwitch' })
      for (const ev of order === 'into-swap-slots-first' ? [...toSwapSlots, ...toHands] : [...toHands, ...toSwapSlots]) {
        world.apply(ev)
        expect(world.self.weaponSet).toBe(1)
      }

      expect(snapshot(world)).toMatchObject({ weaponSet: 1, slot4: 203, slot5: 204, slot11: 201, slot12: 202 })
      expect([...world.containers.equipment.keys()].sort((a, b) => a - b)).toEqual([201, 202, 203, 204])
    })
  }
})
