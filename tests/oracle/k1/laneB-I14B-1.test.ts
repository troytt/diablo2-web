import { afterEach, describe, expect, it, vi } from 'vitest'
import * as drlgRoomMod from '../../../src/d2kern-113c/common/drlg/drlg-room.ts'
import * as itemsMod from '../../../src/d2kern-113c/common/items.ts'
import * as outPlaceMod from '../../../src/d2kern-113c/common/drlg/out-place.ts'
import {
  DRLG_EnsureRoomExActiveAndLoaded113c,
  DRLG_FindLevelSpawnRoom113c,
  DRLG_FindPortalTargetRoomEx113c,
  DRLG_FindWarpTargetRoom113c,
  DRLG_FindWaypointRoomExAndPos113c,
} from '../../../src/d2kern-113c/common/dungeon.ts'
import {
  DRLGROOM_ConnectOutdoorLevelOrthNodes113c,
  DRLGROOM_SetupAct1OutdoorLinks113c,
  DRLGROOM_SetupAct2OutdoorLinks113c,
  DRLGROOM_SetupAct3OutdoorLinks113c,
  DRLGROOM_SetupAct4OutdoorLinks113c,
  DRLGROOM_SetupAct5OutdoorLinks113c,
  DRLGROOM_SpawnOutdoorBorderPresets113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-room.ts'
import {
  DRLGOUTPLACE_BuildOutdoorMazeLinkPath113c,
  DRLGOUTPLACE_ExpandMazeLinkPath113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-ver.ts'
import {
  INVENTORY_UpdateEquippedGfxAndColor113c,
  INVENTORY_UpdateItemBodyLocGfx113c,
} from '../../../src/d2kern-113c/common/inventory.ts'
import {
  ITEMMODS_ToggleSetItemStateList113c,
  ITEMMODS_UpdateSetItemEquipmentState113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import {
  ADDR_ACT,
  ADDR_CTX,
  ADDR_DRLG,
  ADDR_GRID0_CELLS,
  ADDR_GRID2_CELLS,
  ADDR_INV0,
  ADDR_ITEM0,
  ADDR_ITEMDATA0,
  ADDR_ITEMS_TXT,
  ADDR_LEVEL_DEFS,
  ADDR_LVL0,
  ADDR_LVL1,
  ADDR_OBJECTS_TXT,
  ADDR_OUT0,
  ADDR_OUT1,
  ADDR_OUT_COLOR,
  ADDR_OUT_COMP,
  ADDR_OUTDOORS,
  ADDR_PRESET0,
  ADDR_ROOM0,
  ADDR_ROOM1,
  ADDR_RT0,
  ADDR_RX0,
  ADDR_RX1,
  ADDR_SETITEMS_TXT,
  ADDR_SETS_TXT,
  ADDR_SLISTEX,
  ADDR_UNIT0,
  ADDR_V0,
  ADDR_V1,
  ADDR_V2,
  ADDR_V3,
  createArenaMem,
  loadVectors,
  resetArena,
  setupOutdoorsBasic,
} from './laneB-I14B-harness.ts'

const VECS = loadVectors(1)
const byVa = (va: string) => VECS.filter((v) => v.va === va)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('K1r13 I14B-1 Wine differential parity (18 VAs)', () => {
  it('0x6FD67180 DRLGROOM_SpawnOutdoorBorderPresets113c', () => {
    const m = createArenaMem()
    const rows = byVa('0x6FD67180')
    expect(rows.length).toBe(3)
    const lids = [0x11, 41, 110]
    const ltypes = [2, 16, 30]
    for (let k = 0; k < 3; k++) {
      resetArena(m)
      setupOutdoorsBasic(m, lids[k]!, ltypes[k]!, 8, 8)
      m.setU32(ADDR_GRID2_CELLS + (0 * 8 + 0) * 4, 1)
      m.setU32(ADDR_GRID2_CELLS + (0 * 8 + 7) * 4, 1)
      m.setU32(ADDR_GRID2_CELLS + (7 * 8 + 0) * 4, 1)
      m.setU32(ADDR_GRID2_CELLS + (7 * 8 + 7) * 4, 1)
      const vf = k === 2 ? 2 : 1
      m.setU32(ADDR_V0 + 0x00, 1); m.setU32(ADDR_V0 + 0x04, 1); m.setU8(ADDR_V0 + 0x08, k & 1); m.setU32(ADDR_V0 + 0x0c, vf); m.setU32(ADDR_V0 + 0x10, ADDR_V1)
      m.setU32(ADDR_V1 + 0x00, 5); m.setU32(ADDR_V1 + 0x04, 1); m.setU8(ADDR_V1 + 0x08, 0); m.setU32(ADDR_V1 + 0x0c, vf); m.setU32(ADDR_V1 + 0x10, ADDR_V2)
      m.setU32(ADDR_V2 + 0x00, 5); m.setU32(ADDR_V2 + 0x04, 5); m.setU8(ADDR_V2 + 0x08, 1); m.setU32(ADDR_V2 + 0x0c, vf); m.setU32(ADDR_V2 + 0x10, ADDR_V3)
      m.setU32(ADDR_V3 + 0x00, 1); m.setU32(ADDR_V3 + 0x04, 5); m.setU8(ADDR_V3 + 0x08, 0); m.setU32(ADDR_V3 + 0x0c, vf); m.setU32(ADDR_V3 + 0x10, ADDR_V0)
      DRLGROOM_SpawnOutdoorBorderPresets113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_GRID2_CELLS + (1 * 8 + 3) * 4)).toBe(rows[k]!.out[0])
      expect(m.u32(ADDR_GRID0_CELLS + (1 * 8 + 3) * 4)).toBe(rows[k]!.out[1])
      expect(m.u32(ADDR_GRID0_CELLS + (1 * 8 + 5) * 4)).toBe(rows[k]!.out[2])
      expect(m.u32(ADDR_GRID2_CELLS + (1 * 8 + 5) * 4)).toBe(rows[k]!.out[3])
    }
  })

  it('0x6FD67760 DRLGROOM_ConnectOutdoorLevelOrthNodes113c', () => {
    const m = createArenaMem()
    const rows = byVa('0x6FD67760')
    expect(rows.length).toBe(3)
    for (let k = 0; k < 3; k++) {
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 6, 6)
      m.setU32(ADDR_LVL0 + 0x00, k === 2 ? 2 : 3)
      const s = k === 0 ? 3 : 2
      const e = k === 0 ? 1 : 2
      DRLGROOM_ConnectOutdoorLevelOrthNodes113c(m, ADDR_DRLG, s, e)
      expect(m.u32(ADDR_OUTDOORS + 0x264)).toBe(rows[k]!.out[0])
    }
  })

  it('0x6FD67930..0x6FD67AE0 Act1..Act5 outdoor link setups', () => {
    const m = createArenaMem()
    const specs: Array<[string, (m: typeof createArenaMem extends () => infer R ? R : never, d: number) => unknown, number]> = [
      ['0x6FD67930', DRLGROOM_SetupAct2OutdoorLinks113c, 1],
      ['0x6FD67990', DRLGROOM_SetupAct1OutdoorLinks113c, 0x68],
      ['0x6FD67A00', DRLGROOM_SetupAct3OutdoorLinks113c, 0x4b],
      ['0x6FD67AA0', DRLGROOM_SetupAct4OutdoorLinks113c, 1],
      ['0x6FD67AE0', DRLGROOM_SetupAct5OutdoorLinks113c, 1],
    ]
    for (const [va, fn, lid] of specs) {
      const rows = byVa(va)
      expect(rows.length).toBe(3)
      for (let k = 0; k < 3; k++) {
        resetArena(m)
        m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x30, 3)
        setupOutdoorsBasic(m, lid, 1, 4, 4)
        m.setU8(ADDR_DRLG + 0x450, k)
        const initSeed = va === '0x6FD67A00' ? (0x3456789a + k * 0x44444444) >>> 0 : (0x12345678 + k * 0x11111111) >>> 0
        m.setU32(ADDR_DRLG + 0x00, initSeed)
        vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_LinkAct5OutdoorLevels113c').mockImplementation(() => {})
        vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_PlaceActLevelsByList113c').mockImplementation(() => {})
        vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_PlaceAct5OutdoorLevels113c').mockImplementation(() => 0)
        vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_PlaceAct4Levels113c').mockImplementation(() => {})
        fn(m, ADDR_DRLG)
        if (va === '0x6FD67A00') {
          expect(m.u32(ADDR_LVL0 + 0x20)).toBe(rows[k]!.out[1])
          expect(m.u32(ADDR_LVL0 + 0x24)).toBe(rows[k]!.out[2])
          expect(m.u32(ADDR_LVL0 + 0x28)).toBe(rows[k]!.out[3])
        } else {
          expect(m.u32(ADDR_LVL0 + 0x24)).toBe(rows[k]!.out[2] !== 0 ? m.u32(ADDR_LVL0 + 0x24) : 0)
        }
      }
    }
  })

  it('0x6FD67D00 DRLGOUTPLACE_ExpandMazeLinkPath113c', () => {
    const m = createArenaMem()
    const rows = byVa('0x6FD67D00')
    expect(rows.length).toBe(3)
    for (let k = 0; k < 3; k++) {
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 6, 6)
      const root = ADDR_CTX + 4
      m.setU32(ADDR_CTX, root)
      m.setU32(ADDR_CTX + 0x8ca4, 1)
      m.setU32(root + 0x0c, 2); m.setU32(root + 0x10, 2)
      m.setU32(root + 0x14, 0xffffffff); m.setU32(root + 0x18, 0x6fddcab8)
      m.setU8(root + 0x1c, 0)
      m.setU32(ADDR_OUT0, k === 0 ? 2 : k === 1 ? 3 : 5)
      m.setU32(ADDR_OUT0 + 4, 2)
      const maxC = k === 2 ? 2 : 20
      const ret = DRLGOUTPLACE_ExpandMazeLinkPath113c(m, ADDR_CTX, maxC, ADDR_LVL0, ADDR_OUT0)
      expect(ret >>> 0).toBe(rows[k]!.ret)
      expect(m.u32(ADDR_CTX + 0x8ca4)).toBe(rows[k]!.out[0])
      expect(ret !== 0 ? m.u32(ret + 0x0c) : 0).toBe(rows[k]!.out[1])
      expect(ret !== 0 ? m.u32(ret + 0x10) : 0).toBe(rows[k]!.out[2])
    }
  })

  it('0x6FD67EB0 DRLGOUTPLACE_BuildOutdoorMazeLinkPath113c', () => {
    const m = createArenaMem()
    const rows = byVa('0x6FD67EB0')
    expect(rows.length).toBe(3)
    const gx = [108, 132, 148]
    for (let k = 0; k < 3; k++) {
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 8, 8)
      m.setU32(ADDR_OUTDOORS + 0xf8, 108); m.setU32(ADDR_OUTDOORS + 0xfc, 208)
      m.setU32(ADDR_OUTDOORS + 0x170, gx[k]!); m.setU32(ADDR_OUTDOORS + 0x174, 208)
      const ret = DRLGOUTPLACE_BuildOutdoorMazeLinkPath113c(m, ADDR_LVL0, 0)
      expect(ret >>> 0).toBe(rows[k]!.ret)
      const vh = m.u32(ADDR_OUTDOORS + 0x68)
      expect(m.u32(vh)).toBe(rows[k]!.out[0])
      expect(m.u32(vh + 4)).toBe(rows[k]!.out[1])
    }
  })

  it('0x6FD69B60..0x6FD6A130 DRLG room/spawn finders', () => {
    const m = createArenaMem()
    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD69B60')[k]!
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 6, 6)
      m.setU32(ADDR_LVL0 + 0x1d8, k === 0 ? 0 : 2)
      m.setU32(ADDR_LVL0 + 0x2c, 111); m.setU32(ADDR_LVL0 + 0x30, 222); m.setU32(ADDR_LVL0 + 0x34, 1)
      m.setU32(ADDR_LVL0 + 0x38, 333); m.setU32(ADDR_LVL0 + 0x3c, 444); m.setU32(ADDR_LVL0 + 0x40, 2)
      m.setU32(ADDR_LVL0 + 0x10, ADDR_RX0)
      m.setU32(ADDR_RX0 + 0x34, 0); m.setU32(ADDR_RX0 + 0x38, 0)
      m.setU32(ADDR_RX0 + 0x3c, 500); m.setU32(ADDR_RX0 + 0x40, 500)
      const pt = k === 2 ? 2 : 1
      const ret = DRLG_FindPortalTargetRoomEx113c(m, ADDR_LVL0, pt, ADDR_OUT0, ADDR_OUT1)
      expect(ret >>> 0).toBe(r.ret)
      expect(m.u32(ADDR_OUT0)).toBe(r.out[0])
      expect(m.u32(ADDR_OUT1)).toBe(r.out[1])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD69FA0')[k]!
      resetArena(m)
      m.setU32(ADDR_LVL0 + 0x10, k === 0 ? 0 : ADDR_RX0)
      m.setU32(ADDR_RX0 + 0x28, k === 1 ? 0 : 0x03110000)
      m.setU32(ADDR_RX0 + 0x30, ADDR_ROOM0)
      m.setU32(ADDR_RX0 + 0x34, 10); m.setU32(ADDR_RX0 + 0x38, 20)
      m.setU32(ADDR_RX0 + 0x5c, k === 2 ? ADDR_PRESET0 : 0)
      m.setU32(ADDR_PRESET0 + 0x04, 5); m.setU32(ADDR_PRESET0 + 0x08, 25); m.setU32(ADDR_PRESET0 + 0x14, 2); m.setU32(ADDR_PRESET0 + 0x18, 35)
      m.setU8(ADDR_OBJECTS_TXT + 5 * 0x1c0 + 0x167, 0x40)
      expect(DRLG_FindWaypointRoomExAndPos113c(m, ADDR_LVL0, ADDR_OUT0, ADDR_OUT1)).toBe(r.ret)
      expect(m.u32(ADDR_OUT0)).toBe(r.out[0])
      expect(m.u32(ADDR_OUT1)).toBe(r.out[1])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD6A080')[k]!
      resetArena(m)
      m.setU32(ADDR_RX0 + 0x28, k === 0 ? 0x03100000 : k === 1 ? 0x01100000 : 0x00100000)
      m.setU32(ADDR_RX0 + 0x30, (0x12340000 + k) >>> 0)
      m.setU32(ADDR_RX0 + 0x48, 1)
      m.setU32(ADDR_RX0 + 0x58, ADDR_LVL0)
      m.setU32(ADDR_LVL0 + 0x1b4, ADDR_DRLG)
      if (r.exc !== 0) {
        expect(() => DRLG_EnsureRoomExActiveAndLoaded113c(m, ADDR_RX0)).toThrow()
      } else {
        DRLG_EnsureRoomExActiveAndLoaded113c(m, ADDR_RX0)
        expect(m.u32(ADDR_RX0 + 0x28)).toBe(r.out[0])
      }
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD6A0D0')[k]!
      resetArena(m)
      if (k >= 1) {
        m.setU32(ADDR_RX0 + 0x4c, ADDR_RT0)
        m.setU32(ADDR_RT0 + 0x00, ADDR_RX1)
        m.setU32(ADDR_RT0 + 0x10, ADDR_V0)
        m.setU32(ADDR_V0, 77)
      }
      if (k === 2) {
        m.setU32(ADDR_RX1 + 0x28, 0x03100000)
        m.setU32(ADDR_RX1 + 0x4c, ADDR_RT0 + 0x20)
        m.setU32(ADDR_RT0 + 0x20, ADDR_RX0)
        m.setU32(ADDR_RT0 + 0x30, ADDR_V1)
        m.setU32(ADDR_V1, 88)
        m.setU32(ADDR_RX1 + 0x30, ADDR_ROOM1)
      }
      expect(DRLG_FindWarpTargetRoom113c(m, 77, ADDR_RX0, ADDR_OUT0, ADDR_OUT1)).toBe(r.ret)
      expect(m.u32(ADDR_OUT0)).toBe(r.out[0])
      expect(m.u32(ADDR_OUT1)).toBe(r.out[1])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD6A130')[k]!
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 6, 6)
      m.setU32(ADDR_LVL0 + 0x10, ADDR_RX0)
      m.setU32(ADDR_LVL0 + 0x1d8, 1)
      m.setU32(ADDR_LVL0 + 0x2c, 108); m.setU32(ADDR_LVL0 + 0x30, 212); m.setU32(ADDR_LVL0 + 0x34, 1)
      m.setU32(ADDR_RX0 + 0x28, 0x03110000)
      m.setU32(ADDR_RX0 + 0x30, ADDR_ROOM0)
      m.setU32(ADDR_RX0 + 0x34, 100); m.setU32(ADDR_RX0 + 0x38, 200); m.setU32(ADDR_RX0 + 0x3c, 20); m.setU32(ADDR_RX0 + 0x40, 20)
      m.setU32(ADDR_RX0 + 0x5c, ADDR_PRESET0)
      m.setU32(ADDR_PRESET0 + 0x04, 5); m.setU32(ADDR_PRESET0 + 0x08, 15); m.setU32(ADDR_PRESET0 + 0x14, 2); m.setU32(ADDR_PRESET0 + 0x18, 25)
      m.setU8(ADDR_OBJECTS_TXT + 5 * 0x1c0 + 0x167, 0x40)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x90, k === 0 ? 0 : 1)
      const pt = k === 2 ? 0x0d : 1
      vi.spyOn(drlgRoomMod, 'DRLGROOM_EnsureRoomAndGetRoom1_113c').mockImplementation(() => 0)
      expect(DRLG_FindLevelSpawnRoom113c(m, ADDR_OUT0, ADDR_DRLG, 2, pt, ADDR_OUT1)).toBe(r.ret)
      expect(m.u32(ADDR_OUT0)).toBe(r.out[0])
      expect(m.u32(ADDR_OUT1)).toBe(r.out[1])
    }
  })

  it('0x6FD71300..0x6FD7C910 Inventory & SetItems', () => {
    const m = createArenaMem()
    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD71300')[k]!
      resetArena(m)
      m.setU32(ADDR_UNIT0 + 0x60, k === 0 ? 0 : ADDR_INV0)
      m.setU32(ADDR_ITEM0 + 0x00, 4); m.setU32(ADDR_ITEM0 + 0x04, k === 2 ? 99 : 1)
      m.setU32(ADDR_ITEMS_TXT + 1 * 0x1a8 + 0x80, 0x206b6362)
      m.setU32(ADDR_ITEMS_TXT + 1 * 0x1a8 + 0x90, 0x206b6362)
      if (r.exc !== 0) {
        expect(() => INVENTORY_UpdateItemBodyLocGfx113c(m, ADDR_UNIT0, ADDR_OUT_COMP, ADDR_OUT_COLOR, ADDR_ITEM0)).toThrow()
      } else {
        INVENTORY_UpdateItemBodyLocGfx113c(m, ADDR_UNIT0, ADDR_OUT_COMP, ADDR_OUT_COLOR, ADDR_ITEM0)
        expect(m.u32(ADDR_OUT_COMP)).toBe(r.out[0])
        expect(m.u32(ADDR_OUT_COLOR)).toBe(r.out[1])
      }
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD71420')[k]!
      resetArena(m)
      m.setU32(ADDR_UNIT0 + 0x60, k === 0 ? 0 : ADDR_INV0)
      m.setU32(ADDR_INV0 + 0x00, k === 0 ? 0 : 0x01020304)
      m.setU32(ADDR_INV0 + 0x0c, k === 1 ? 0 : ADDR_ITEM0)
      m.setU32(ADDR_ITEM0 + 0x00, 4); m.setU32(ADDR_ITEM0 + 0x04, 1); m.setU32(ADDR_ITEM0 + 0x10, 1)
      m.setU32(ADDR_ITEM0 + 0x14, ADDR_ITEMDATA0); m.setU8(ADDR_ITEMDATA0 + 0x44, 1)
      m.setU32(ADDR_ITEMS_TXT + 1 * 0x1a8 + 0x80, 0x2074696c)
      m.setU32(ADDR_ITEMS_TXT + 1 * 0x1a8 + 0x90, 0x2074696c)
      m.setU8(ADDR_ITEMS_TXT + 1 * 0x1a8 + 0x115, 2)
      m.setU16(ADDR_ITEMS_TXT + 1 * 0x1a8 + 0x11e, 0xffff)
      INVENTORY_UpdateEquippedGfxAndColor113c(m, ADDR_UNIT0, ADDR_OUT_COMP, ADDR_OUT_COLOR)
      expect(m.u32(ADDR_OUT_COMP)).toBe(r.out[0])
      expect(m.u32(ADDR_OUT_COLOR)).toBe(r.out[1])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD7C630')[k]!
      resetArena(m)
      vi.spyOn(itemsMod, 'ITEMMODS_ApplySetItemBonusProps113c').mockImplementation(() => {})
      m.setU32(ADDR_UNIT0 + 0x5c, ADDR_SLISTEX); m.setU32(ADDR_SLISTEX + 0x10, 0x80000000)
      m.setU32(ADDR_ITEM0 + 0x00, 4); m.setU32(ADDR_ITEM0 + 0x0c, 42); m.setU32(ADDR_ITEM0 + 0x14, ADDR_ITEMDATA0)
      m.setU32(ADDR_ITEMDATA0 + 0x00, k === 0 ? 1 : 5)
      m.setU16(ADDR_SETITEMS_TXT + 0x2c, 1); m.setU32(ADDR_SETS_TXT + 0x10, 1)
      const mode = k === 0 ? 1 : k === 1 ? 0 : 2
      expect(ITEMMODS_ToggleSetItemStateList113c(m, ADDR_UNIT0, ADDR_ITEM0, mode)).toBe(r.ret)
      expect(m.u32(ADDR_SLISTEX + 0x3c) !== 0 ? 1 : 0).toBe(r.out[0])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD7C910')[k]!
      resetArena(m)
      m.setU32(ADDR_UNIT0 + 0x60, k === 1 ? 0 : ADDR_INV0)
      m.setU32(ADDR_ITEM0 + 0x00, 4); m.setU32(ADDR_ITEM0 + 0x14, k === 1 ? 0 : ADDR_ITEMDATA0)
      m.setU32(ADDR_ITEMDATA0 + 0x00, 1)
      const u = k === 0 ? 0 : ADDR_UNIT0
      expect(ITEMMODS_UpdateSetItemEquipmentState113c(m, u, ADDR_ITEM0, 1, 0)).toBe(r.ret)
    }
  })

  it('AST mutation boundary killers for I14B-1', () => {
    const m = createArenaMem()

    // 1. DRLGROOM_SpawnOutdoorBorderPresets113c: actIdx 0 (0x11 vs 2), style1=4, actIdx 1 (pairIdx*2), actIdx 2 (no-op), actIdx 3/4
    {
      // style1 = 4 (>= 4 -> 883 edge & 883 corner vs > 4 -> LOW table) with nLevelType=31 and v1Flags=0
      resetArena(m)
      setupOutdoorsBasic(m, 0x11, 31, 8, 8)
      m.fill(0, 0x50, 0); m.setU32(0x40, 1); m.setU32(m.u32(0x6fde9e1c) + 0xc68, 0)
      for (let i = 0; i < 64; i++) m.setU32(ADDR_GRID2_CELLS + i * 4, 1)
      m.setU32(ADDR_V0 + 0x00, 1); m.setU32(ADDR_V0 + 0x04, 1); m.setU8(ADDR_V0 + 0x08, 0); m.setU32(ADDR_V0 + 0x0c, 0); m.setU32(ADDR_V0 + 0x10, ADDR_V1)
      m.setU32(ADDR_V1 + 0x00, 3); m.setU32(ADDR_V1 + 0x04, 1); m.setU8(ADDR_V1 + 0x08, 0); m.setU32(ADDR_V1 + 0x0c, 2); m.setU32(ADDR_V1 + 0x10, ADDR_V2)
      m.setU32(ADDR_V2 + 0x00, 3); m.setU32(ADDR_V2 + 0x04, 3); m.setU8(ADDR_V2 + 0x08, 0); m.setU32(ADDR_V2 + 0x0c, 2); m.setU32(ADDR_V2 + 0x10, ADDR_V0)
      DRLGROOM_SpawnOutdoorBorderPresets113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_GRID0_CELLS + (1 * 8 + 2) * 4)).toBe(883)
      // Corner at (3,1): !v1Has2 && v2Has2 -> idx = 40 + stepCorner2(1) + 0 + 9 * (stepDir2(0) + 1) = 53,
      // .rdata 0x6FDE55E0[53] = 3 -> 0x6FDDCB88[style2 + 3 * 2 - 6] = 883 (0x6FD675C5..0x6FD6763A).
      expect(m.u32(ADDR_GRID0_CELLS + (1 * 8 + 3) * 4)).toBe(883)

      // actIdx 0 with v1Flags = 1: nLevelId = 0x11 (0x40400) vs nLevelId = 2 (0x30400)
      resetArena(m)
      setupOutdoorsBasic(m, 0x11, 0, 8, 8)
      m.fill(0, 0x50, 0); m.setU32(0x40, 1); m.setU32(m.u32(0x6fde9e1c) + 0xc68, 0)
      for (let i = 0; i < 64; i++) m.setU32(ADDR_GRID2_CELLS + i * 4, 1)
      m.setU32(ADDR_V0 + 0x00, 1); m.setU32(ADDR_V0 + 0x04, 1); m.setU8(ADDR_V0 + 0x08, 0); m.setU32(ADDR_V0 + 0x0c, 1); m.setU32(ADDR_V0 + 0x10, ADDR_V1)
      m.setU32(ADDR_V1 + 0x00, 3); m.setU32(ADDR_V1 + 0x04, 1); m.setU8(ADDR_V1 + 0x08, 0); m.setU32(ADDR_V1 + 0x0c, 2); m.setU32(ADDR_V1 + 0x10, ADDR_V0)
      DRLGROOM_SpawnOutdoorBorderPresets113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_GRID2_CELLS + (1 * 8 + 2) * 4) & 0xf0000).toBe(0x40000)

      resetArena(m)
      setupOutdoorsBasic(m, 2, 0, 8, 8)
      m.fill(0, 0x50, 0); m.setU32(0x40, 1); m.setU32(m.u32(0x6fde9e1c) + 0xc68, 0)
      for (let i = 0; i < 64; i++) m.setU32(ADDR_GRID2_CELLS + i * 4, 1)
      m.setU32(ADDR_V0 + 0x00, 1); m.setU32(ADDR_V0 + 0x04, 1); m.setU8(ADDR_V0 + 0x08, 0); m.setU32(ADDR_V0 + 0x0c, 1); m.setU32(ADDR_V0 + 0x10, ADDR_V1)
      m.setU32(ADDR_V1 + 0x00, 3); m.setU32(ADDR_V1 + 0x04, 1); m.setU8(ADDR_V1 + 0x08, 0); m.setU32(ADDR_V1 + 0x0c, 2); m.setU32(ADDR_V1 + 0x10, ADDR_V0)
      DRLGROOM_SpawnOutdoorBorderPresets113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_GRID2_CELLS + (1 * 8 + 2) * 4) & 0xf0000).toBe(0x30000)

      // actIdx 1 (nLevelId = 41 -> pairIdx = 3 -> 373 at (2,1), 370 at (3,1), and 0x30000 == 0)
      resetArena(m)
      setupOutdoorsBasic(m, 41, 0, 8, 8)
      m.fill(0, 0x50, 0); m.setU32(0x40, 1); m.setU32(m.u32(0x6fde9e1c) + 0xc68, 0)
      for (let i = 0; i < 64; i++) m.setU32(ADDR_GRID2_CELLS + i * 4, 1)
      m.setU32(ADDR_V0 + 0x00, 1); m.setU32(ADDR_V0 + 0x04, 1); m.setU8(ADDR_V0 + 0x08, 0); m.setU32(ADDR_V0 + 0x0c, 1); m.setU32(ADDR_V0 + 0x10, ADDR_V1)
      m.setU32(ADDR_V1 + 0x00, 3); m.setU32(ADDR_V1 + 0x04, 1); m.setU8(ADDR_V1 + 0x08, 0); m.setU32(ADDR_V1 + 0x0c, 2); m.setU32(ADDR_V1 + 0x10, ADDR_V0)
      DRLGROOM_SpawnOutdoorBorderPresets113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_GRID2_CELLS + (1 * 8 + 2) * 4) & 0x30000).toBe(0)
      expect(m.u32(ADDR_GRID0_CELLS + (1 * 8 + 2) * 4)).toBe(373)

      // actIdx 2 (nLevelId = 76 -> no-op at midX, midY) vs actIdx 4 (nLevelId = 110 -> sets 0x30400)
      resetArena(m)
      setupOutdoorsBasic(m, 76, 0, 8, 8)
      m.fill(0, 0x50, 0); m.setU32(0x40, 1); m.setU32(m.u32(0x6fde9e1c) + 0xc68, 0)
      for (let i = 0; i < 64; i++) m.setU32(ADDR_GRID2_CELLS + i * 4, 1)
      m.setU32(ADDR_V0 + 0x00, 1); m.setU32(ADDR_V0 + 0x04, 1); m.setU8(ADDR_V0 + 0x08, 0); m.setU32(ADDR_V0 + 0x0c, 1); m.setU32(ADDR_V0 + 0x10, ADDR_V1)
      m.setU32(ADDR_V1 + 0x00, 3); m.setU32(ADDR_V1 + 0x04, 1); m.setU8(ADDR_V1 + 0x08, 0); m.setU32(ADDR_V1 + 0x0c, 2); m.setU32(ADDR_V1 + 0x10, ADDR_V0)
      DRLGROOM_SpawnOutdoorBorderPresets113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_GRID2_CELLS + (1 * 8 + 2) * 4) & 0xf0000).toBe(0)

      resetArena(m)
      setupOutdoorsBasic(m, 110, 0, 8, 8)
      m.fill(0, 0x50, 0); m.setU32(0x40, 1); m.setU32(m.u32(0x6fde9e1c) + 0xc68, 0)
      for (let i = 0; i < 64; i++) m.setU32(ADDR_GRID2_CELLS + i * 4, 1)
      m.setU32(ADDR_V0 + 0x00, 1); m.setU32(ADDR_V0 + 0x04, 1); m.setU8(ADDR_V0 + 0x08, 0); m.setU32(ADDR_V0 + 0x0c, 1); m.setU32(ADDR_V0 + 0x10, ADDR_V1)
      m.setU32(ADDR_V1 + 0x00, 3); m.setU32(ADDR_V1 + 0x04, 1); m.setU8(ADDR_V1 + 0x08, 0); m.setU32(ADDR_V1 + 0x0c, 2); m.setU32(ADDR_V1 + 0x10, ADDR_V0)
      DRLGROOM_SpawnOutdoorBorderPresets113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_GRID2_CELLS + (1 * 8 + 2) * 4) & 0xf0000).toBe(0x30000)
    }

    // 2. DRLGROOM_ConnectOutdoorLevelOrthNodes113c: i=7 (< 8 vs < 7), level type 3 vs != 3, y1 > y2
    {
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 8, 8)
      m.setU32(ADDR_LVL0 + 0x1ac, ADDR_LVL1)
      m.setU32(ADDR_LVL1 + 0x00, 3); m.setU32(ADDR_LVL1 + 0x1d0, 3)
      m.setU32(ADDR_LVL0 + 0x1c, 10); m.setU32(ADDR_LVL0 + 0x20, 20); m.setU32(ADDR_LVL0 + 0x24, 10); m.setU32(ADDR_LVL0 + 0x28, 10)
      m.setU32(ADDR_LVL1 + 0x1c, 10); m.setU32(ADDR_LVL1 + 0x20, 10); m.setU32(ADDR_LVL1 + 0x24, 10); m.setU32(ADDR_LVL1 + 0x28, 10)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x48 + 7 * 4, 3)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x68 + 7 * 4, 0xffffffff)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x48 + 8 * 4, 3)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x68 + 8 * 4, 0xffffffff)
      m.setU32(ADDR_LVL0 + 0x00, 2) // not 3 -> skipped
      DRLGROOM_ConnectOutdoorLevelOrthNodes113c(m, ADDR_DRLG, 1, 3)
      expect(m.u32(ADDR_OUTDOORS + 0x264)).toBe(0)
      m.setU32(ADDR_LVL0 + 0x00, 3)
      DRLGROOM_ConnectOutdoorLevelOrthNodes113c(m, ADDR_DRLG, 1, 3)
      const pOrth = m.u32(ADDR_OUTDOORS + 0x264)
      expect(pOrth).not.toBe(0)
      expect(m.u32(pOrth + 0x04)).toBe(1) // y1 > y2 -> dir = 1
      expect(m.u32(pOrth + 0x14)).toBe(0) // only i=7 (< 8), i=8 not included
    }

    // 3. SetupAct1..5OutdoorLinks113c: assert exact 0x6FD66CF0 / 0x6FD66E10 call args & bitwise OR & Act3 sgpt+0xc5c boundary
    {
      resetArena(m)
      setupOutdoorsBasic(m, 0x68, 0, 8, 8)
      m.setU32(ADDR_LVL0 + 0x1d0, 0x68); m.setU32(ADDR_LVL0 + 0x00, 1); m.setU32(ADDR_DRLG + 0x00, ADDR_LVL0)
      m.setU32(0x6fdf146c, 0x12340000); m.setU32(ADDR_OUTDOORS, 0x00000055)
      const rules: Array<[number, number, number]> = []
      const ranges: Array<[number, number]> = []
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_PlaceActLevelsByList113c').mockImplementation((_m, _d, a, _place, b, c) => { rules.push([a, Number(b), Number(c)]) })
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_LinkAct5OutdoorLevels113c').mockImplementation((_m, _d, a, b) => { ranges.push([a, b]) })
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_PlaceAct5OutdoorLevels113c').mockImplementation(() => ADDR_RX0)
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_PlaceAct4Levels113c').mockImplementation(() => {})

      DRLGROOM_SetupAct1OutdoorLinks113c(m, ADDR_DRLG)
      expect(m.u32(ADDR_OUTDOORS)).toBe(0x12340055)
      expect(m.u32(m.u32(ADDR_DRLG + 0x47c) + 0x1d0)).toBe(0x6a)
      expect(rules).toEqual([[0x6fddd098, 0x6fd646c0, 0], [0x6fddd188, 0x6fd64630, 0]])

      rules.length = 0; ranges.length = 0
      DRLGROOM_SetupAct2OutdoorLinks113c(m, ADDR_DRLG)
      expect(rules).toEqual([[0x6fddd278, 0, 0], [0x6fddd368, 0, 0], [0x6fddcfa8, 0x6fd64750, 0]])
      expect(ranges).toEqual([[0x6f, 0x70], [0x6e, 0x6f], [0x6d, 0x6e]])

      rules.length = 0; ranges.length = 0
      DRLGROOM_SetupAct4OutdoorLinks113c(m, ADDR_DRLG)
      expect(rules).toEqual([[0x6fddcdc8, 0x6fd64870, 0], [0x6fddceb8, 0x6fd647e0, 0]])

      rules.length = 0; ranges.length = 0
      DRLGROOM_SetupAct5OutdoorLinks113c(m, ADDR_DRLG)
      expect(rules).toEqual([[0x6fddcbe8, 0x6fd64a00, 0x6fd63fd0], [0x6fddccd8, 0x6fd64900, 0x6fd63fd0]])

      m.setU32(ADDR_LVL0 + 0x1d0, 0x4b); m.setU32(ADDR_LVL0 + 0x1c, 0)
      const pLvlTxt75 = (m.u32(0x6fdf0b38) + 0x2db4) >>> 0
      m.setU32(pLvlTxt75 + 0x24, 111)
      m.setU32(m.u32(0x6fde9e1c) + 0xc5c, 0x4b) // boundary: 0x4b is NOT > 0x4b -> pLvlTxt = 0 -> reads 0 at 0x24
      DRLGROOM_SetupAct3OutdoorLinks113c(m, ADDR_DRLG)
      expect(m.u32(ADDR_LVL0 + 0x1c)).toBe(0)
      m.setU32(m.u32(0x6fde9e1c) + 0xc5c, 0x4c) // 0x4c > 0x4b -> sets ADDR_LVL0 + 0x1c = 111
      DRLGROOM_SetupAct3OutdoorLinks113c(m, ADDR_DRLG)
      expect(m.u32(ADDR_LVL0 + 0x1c)).toBe(111)
    }

    // 3b. DRLGOUTPLACE_ExpandMazeLinkPath113c & BuildOutdoorMazeLinkPath113c boundary killers
    {
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 6, 6)
      const root = ADDR_CTX + 4
      m.setU32(ADDR_CTX, root)
      m.setU32(ADDR_CTX + 0x8ca4, 1)
      m.setU32(root + 0x0c, 2); m.setU32(root + 0x10, 2); m.setU32(root + 0x14, 0xffffffff); m.setU32(root + 0x18, 0x6fddcab8); m.setU8(root + 0x1c, 0)
      m.setU32(ADDR_OUT0, 3); m.setU32(ADDR_OUT0 + 4, 2)
      const ret = DRLGOUTPLACE_ExpandMazeLinkPath113c(m, ADDR_CTX, 10, ADDR_LVL0, ADDR_OUT0)
      expect(m.u8(ret + 0x1c)).toBe(3)

      // costLimit = 100 vs baseH + (baseH >> 1) when baseH = 72
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 42, 8)
      m.setU32(ADDR_OUTDOORS + 0xf8, 116); m.setU32(ADDR_OUTDOORS + 0xfc, 208) // sx = 2, sy = 1
      m.setU32(ADDR_OUTDOORS + 0x170, 404); m.setU32(ADDR_OUTDOORS + 0x174, 208) // gx = 38, gy = 1 -> adx = 36, baseH = 72
      expect(DRLGOUTPLACE_BuildOutdoorMazeLinkPath113c(m, ADDR_LVL0, 0)).toBe(1)

      // 2nd iteration of BuildOutdoorMazeLinkPath113c when direct path is blocked
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 10, 10)
      m.setU32(ADDR_OUTDOORS + 0xf8, 116); m.setU32(ADDR_OUTDOORS + 0xfc, 232) // sx = 2, sy = 4
      m.setU32(ADDR_OUTDOORS + 0x170, 132); m.setU32(ADDR_OUTDOORS + 0x174, 232) // gx = 4, gy = 4 -> baseH = 4, maxCost0 = 6
      m.setU32(ADDR_GRID2_CELLS + (4 * 10 + 3) * 4, 0x200) // block (3, 4) so detour needs maxCost = 11 (2nd iter)
      expect(DRLGOUTPLACE_BuildOutdoorMazeLinkPath113c(m, ADDR_LVL0, 0)).toBe(1)
    }

    // 4. DRLG_FindPortalTargetRoomEx113c, FindWaypointRoomExAndPos, FindWarpTargetRoom, FindLevelSpawnRoom
    {
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 10, 10)
      m.setU32(ADDR_LVL0 + 0x1c, 0); m.setU32(ADDR_LVL0 + 0x20, 0); m.setU32(ADDR_LVL0 + 0x24, 100); m.setU32(ADDR_LVL0 + 0x28, 100)
      m.setU32(ADDR_DRLG + 0x470, 1)
      m.setU32(ADDR_LVL0 + 0x10, ADDR_RX0)
      m.setU32(ADDR_RX0 + 0x28, 0x03110000); m.setU32(ADDR_RX0 + 0x30, ADDR_ROOM0)
      m.setU32(ADDR_RX0 + 0x34, 3); m.setU32(ADDR_RX0 + 0x38, 4) // nRoomX=3 -> 3*5=15
      m.setU32(ADDR_RX0 + 0x3c, 20); m.setU32(ADDR_RX0 + 0x40, 25)
      m.setU32(ADDR_RX0 + 0x5c, ADDR_PRESET0)
      m.setU32(ADDR_PRESET0 + 0x04, 5); m.setU32(ADDR_PRESET0 + 0x08, 15); m.setU32(ADDR_PRESET0 + 0x14, 2); m.setU32(ADDR_PRESET0 + 0x18, 3)
      m.setU32(ADDR_RX0 + 0x28, 0x03110000)
      m.setU8(ADDR_OBJECTS_TXT + 5 * 0x1c0 + 0x167, 0x40)
      m.setU32(ADDR_LVL0 + 0x2c, 17); m.setU32(ADDR_LVL0 + 0x30, 23)
      vi.spyOn(drlgRoomMod, 'DRLGROOM_EnsureRoomAndGetRoom1_113c').mockImplementation(() => 0)
      expect(DRLG_FindPortalTargetRoomEx113c(m, ADDR_LVL0, 0, ADDR_OUT0, ADDR_OUT1)).toBe(ADDR_RX0)
      expect(m.u32(ADDR_OUT0)).toBe(17) // 3*5 + 2

      // count = 3 with sSeed = (1, 1) -> newLo = 0x6ac690c6, newLo % 3 = 1 vs newLo & 2 = 2
      m.setU32(ADDR_RX0 + 0x34, 100); m.setU32(ADDR_RX0 + 0x38, 200); m.setU32(ADDR_RX0 + 0x3c, 50); m.setU32(ADDR_RX0 + 0x40, 50)
      m.setU32(ADDR_LVL0 + 0x1c4, 1); m.setU32(ADDR_LVL0 + 0x1c8, 1); m.setU32(ADDR_LVL0 + 0x1d8, 3)
      m.setU32(ADDR_LVL0 + 0x2c, 101); m.setU32(ADDR_LVL0 + 0x30, 201); m.setU32(ADDR_LVL0 + 0x34, 5)
      m.setU32(ADDR_LVL0 + 0x38, 102); m.setU32(ADDR_LVL0 + 0x3c, 202); m.setU32(ADDR_LVL0 + 0x40, 5)
      m.setU32(ADDR_LVL0 + 0x44, 103); m.setU32(ADDR_LVL0 + 0x48, 203); m.setU32(ADDR_LVL0 + 0x4c, 5)
      expect(DRLG_FindPortalTargetRoomEx113c(m, ADDR_LVL0, 5, ADDR_OUT0, ADDR_OUT1)).toBe(ADDR_RX0)
      expect(m.u32(ADDR_LVL0 + 0x1c4)).toBe(0x6ac690c6)
      expect(m.u32(ADDR_OUT0)).toBe(102)

      m.setU32(ADDR_RX0 + 0x28, 0x20000)
      expect(DRLG_FindWaypointRoomExAndPos113c(m, ADDR_LVL0, ADDR_OUT0, ADDR_OUT1)).toBe(ADDR_RX0)
      // objId == sgpt+0x6fdf0b98 boundary (64 >= 64 -> throws)
      m.setU32(ADDR_PRESET0 + 0x04, 64)
      expect(() => DRLG_FindWaypointRoomExAndPos113c(m, ADDR_LVL0, ADDR_OUT0, ADDR_OUT1)).toThrow()
      m.setU32(ADDR_PRESET0 + 0x04, 5)

      m.setU32(ADDR_RX0 + 0x4c, 0)
      expect(DRLG_FindWarpTargetRoom113c(m, 88, ADDR_RX0, ADDR_OUT0, ADDR_OUT1)).toBe(0)
      // pTile != 0 with matching targetId=88, but pBack = 0 -> returns 0
      m.setU32(ADDR_RX0 + 0x4c, ADDR_RT0)
      m.setU32(ADDR_RT0 + 0x00, ADDR_RX1); m.setU32(ADDR_RT0 + 0x10, ADDR_LVL1 + 0x1d0)
      m.setU32(ADDR_RX1 + 0x14, ADDR_LVL1); m.setU32(ADDR_LVL1 + 0x1d0, 88); m.setU32(ADDR_RX1 + 0x4c, 0)
      expect(DRLG_FindWarpTargetRoom113c(m, 88, ADDR_RX0, ADDR_OUT0, ADDR_OUT1)).toBe(0)

      m.setU32(ADDR_RX0 + 0x34, 3); m.setU32(ADDR_RX0 + 0x38, 4)
      m.setU32(ADDR_RX0 + 0x3c, 20); m.setU32(ADDR_RX0 + 0x40, 26)
      m.setU32(ADDR_RX0 + 0x28, 0x03100000) // no 0x30000 waypoint flag -> falls back to GetRoomExFromCoordinates at midX, midY
      expect(DRLG_FindLevelSpawnRoom113c(m, ADDR_OUT0, ADDR_DRLG, 2, 1, ADDR_OUT1)).toBe(ADDR_ROOM0)
      expect(m.u32(ADDR_OUT0)).toBe(4 + 13) // nRoomY + (nSizeY >> 1) = 17
      expect(m.u32(ADDR_OUT1)).toBe(3 + 10) // nRoomX + (nSizeX >> 1) = 13

      // nLevelId = 0 (>= 0 boundary)
      m.setU32(ADDR_LVL0 + 0x1d0, 0)
      m.setU32(ADDR_LVL0 + 0x1d8, 0)
      m.setU32(ADDR_LVL0 + 0x2c, 3); m.setU32(ADDR_LVL0 + 0x30, 4)
      m.setU32(ADDR_LEVEL_DEFS + 0 * 0x9c + 0x90, 1)
      expect(DRLG_FindLevelSpawnRoom113c(m, ADDR_OUT0, ADDR_DRLG, 0, 1, ADDR_OUT1)).toBe(ADDR_ROOM0)
    }

    // 5. INVENTORY_UpdateItemBodyLocGfx113c & INVENTORY_UpdateEquippedGfxAndColor113c
    {
      resetArena(m)
      m.setU32(ADDR_UNIT0 + 0x60, ADDR_INV0)
      m.setU32(ADDR_INV0 + 0x00, 0x01020304); m.setU32(ADDR_INV0 + 0x0c, ADDR_ITEM0)
      m.setU32(ADDR_ITEM0 + 0x00, 4); m.setU32(ADDR_ITEM0 + 0x04, 1); m.setU32(ADDR_ITEM0 + 0x10, 1)
      m.setU32(ADDR_ITEM0 + 0x14, ADDR_ITEMDATA0); m.setU8(ADDR_ITEMDATA0 + 0x44, 3) // page 3!
      // Test gfxCode=0 (code 0x206b6362 not in cache) with compIdx=0x10 at +0x115 (should NOT write outComp+0x10)
      m.setU32(ADDR_ITEMS_TXT + 1 * 0x1a8 + 0x80, 0x206b6362)
      m.setU32(ADDR_ITEMS_TXT + 1 * 0x1a8 + 0x90, 0x206b6362)
      m.setU8(ADDR_ITEMS_TXT + 1 * 0x1a8 + 0x115, 0x10)
      m.setU8(ADDR_OUT_COMP + 0x10, 0x77)
      INVENTORY_UpdateItemBodyLocGfx113c(m, ADDR_UNIT0, ADDR_OUT_COMP, ADDR_OUT_COLOR, ADDR_ITEM0)
      expect(m.u8(ADDR_OUT_COMP + 0x10)).toBe(0x77)

      // Test gfxCode=1 ('lit ' = 0x2074696c) with non-0xfe initial ADDR_OUT_COLOR so 0xff vs +1 is distinguished
      m.setU32(ADDR_ITEMS_TXT + 1 * 0x1a8 + 0x80, 0x2074696c)
      m.setU32(ADDR_ITEMS_TXT + 1 * 0x1a8 + 0x90, 0x2074696c)
      m.setU8(ADDR_ITEMS_TXT + 1 * 0x1a8 + 0x115, 2)
      m.setU8(ADDR_OUT_COLOR + 2, 0x10)
      INVENTORY_UpdateItemBodyLocGfx113c(m, ADDR_UNIT0, ADDR_OUT_COMP, ADDR_OUT_COLOR, ADDR_ITEM0)
      expect(m.u8(ADDR_OUT_COMP + 2)).toBe(1)
      expect(m.u8(ADDR_OUT_COLOR + 2)).toBe(0xff)

      // page=3 in UpdateEquippedGfxAndColor113c: first test classId=0 (> 0 vs >= 0 boundary)
      const pCompositArr = m.alloc(0x100) >>> 0
      m.fill(pCompositArr, 0x100, 0)
      m.setU32(0x6fdf13d4, pCompositArr)
      m.setU32(pCompositArr + 0x20, 0x2074696c) // 'lit ' -> gfxCode = 1 when classId > 0
      m.setU32(ADDR_ITEM0 + 0x04, 0)
      m.setU32(ADDR_ITEMDATA0 + 0x5c + 0x08, 0)
      INVENTORY_UpdateEquippedGfxAndColor113c(m, ADDR_UNIT0, ADDR_OUT_COMP, ADDR_OUT_COLOR)
      expect(m.u8(ADDR_OUT_COMP + 1)).toBe(0xff)

      // Now test classId=1 (page=3) linked to pItem2 (classId=1, page=1, compIdx=5) to kill !== 4 break
      m.setU32(ADDR_ITEM0 + 0x04, 1)
      m.setU8(ADDR_ITEMS_TXT + 1 * 0x1a8 + 0x115, 5)
      const pItem2 = m.alloc(0x80) >>> 0; const pItemData2 = m.alloc(0x80) >>> 0
      m.fill(pItem2, 0x80, 0); m.fill(pItemData2, 0x80, 0)
      m.setU32(pItem2 + 0x00, 4); m.setU32(pItem2 + 0x04, 1); m.setU32(pItem2 + 0x10, 1); m.setU32(pItem2 + 0x14, pItemData2)
      m.setU8(pItemData2 + 0x44, 1) // page 1
      m.setU32(ADDR_ITEMDATA0 + 0x5c + 0x08, pItem2)
      m.setU8(ADDR_OUT_COMP + 5, 0)
      INVENTORY_UpdateEquippedGfxAndColor113c(m, ADDR_UNIT0, ADDR_OUT_COMP, ADDR_OUT_COLOR)
      expect(m.u8(ADDR_OUT_COMP + 1)).toBe(1)
      expect(m.u8(ADDR_OUT_COMP + 5)).toBe(1)
    }

    // 6. ITEMMODS_ToggleSetItemStateList113c & ITEMMODS_UpdateSetItemEquipmentState113c
    {
      resetArena(m)
      vi.spyOn(itemsMod, 'ITEMMODS_ApplySetItemBonusProps113c').mockImplementation(() => {})
      m.setU32(ADDR_UNIT0 + 0x08, 1)
      m.setU32(ADDR_UNIT0 + 0x5c, ADDR_SLISTEX); m.setU32(ADDR_SLISTEX + 0x10, 0x80000000)
      m.setU32(ADDR_UNIT0 + 0x60, ADDR_INV0); m.setU32(ADDR_INV0 + 0x00, 0x01020304)
      m.setU32(ADDR_ITEM0 + 0x00, 4); m.setU32(ADDR_ITEM0 + 0x0c, 42); m.setU32(ADDR_ITEM0 + 0x14, ADDR_ITEMDATA0)
      m.setU32(ADDR_ITEMDATA0 + 0x00, 5) // set quality!
      m.setU16(ADDR_SETITEMS_TXT + 0x2c, 1); m.setU32(ADDR_SETS_TXT + 0x10, 1)
      // 0x6FD7C630 re-reads stat 0x47 via STATLIST_GetStatValue (0x6FDB7E50), which returns 0 unless
      // sgptDataTables->nItemStatCostTxtRecordCount (+0xBD4) > 0x47 and pItemStatCostTxt (+0xBCC) is set.
      {
        const sgpt = m.u32(0x6fde9e1c)
        const pIsc = m.alloc(0x48 * 0x144) >>> 0
        m.fill(pIsc, 0x48 * 0x144, 0)
        m.setU32(sgpt + 0xbcc, pIsc); m.setU32(sgpt + 0xbd4, 0x48)
      }
      expect(ITEMMODS_ToggleSetItemStateList113c(m, ADDR_UNIT0, ADDR_ITEM0, 0)).toBe(1)
      expect(ITEMMODS_ToggleSetItemStateList113c(m, ADDR_UNIT0, ADDR_ITEM0, 1)).toBe(1)
      expect(ITEMMODS_ToggleSetItemStateList113c(m, ADDR_UNIT0, ADDR_ITEM0, 1)).toBe(0) // already freed!
      expect(ITEMMODS_UpdateSetItemEquipmentState113c(m, ADDR_UNIT0, 0, 0, 0)).toBe(0)

      // Set item sublist flag 0x2000 when bAddFunc === 2
      m.setU8(ADDR_SETITEMS_TXT + 0x87, 2)
      const pItemSlistEx = m.alloc(0x80) >>> 0; const pItemSub = m.alloc(0x80) >>> 0
      m.fill(pItemSlistEx, 0x80, 0); m.fill(pItemSub, 0x80, 0)
      m.setU32(pItemSlistEx + 0x10, 0x80000000); m.setU32(pItemSlistEx + 0x3c, pItemSub)
      m.setU32(pItemSub + 0x04, 1); m.setU32(pItemSub + 0x14, 0xa5)
      m.setU32(ADDR_ITEM0 + 0x5c, pItemSlistEx)
      m.setU32(ADDR_INV0 + 0x0c, ADDR_ITEM0); m.setU8(ADDR_ITEMDATA0 + 0x44, 3); m.setU8(ADDR_ITEMDATA0 + 0x45, 1)
      expect(ITEMMODS_UpdateSetItemEquipmentState113c(m, ADDR_UNIT0, ADDR_ITEM0, 0, 0)).toBe(1)
      expect(m.u32(pItemSub + 0x10) & 0x2000).toBe(0x2000)
    }
  })
})
