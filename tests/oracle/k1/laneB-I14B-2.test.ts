import { afterEach, describe, expect, it, vi } from 'vitest'
import * as drlgRoomMod from '../../../src/d2kern-113c/common/drlg/drlg-room.ts'
import * as monstersMod from '../../../src/d2kern-113c/common/monsters.ts'
import * as outPlaceMod from '../../../src/d2kern-113c/common/drlg/out-place.ts'
import * as outdoorsMod from '../../../src/d2kern-113c/common/drlg/outdoors.ts'
import * as presetMod from '../../../src/d2kern-113c/common/drlg/preset.ts'
import * as roomTileMod from '../../../src/d2kern-113c/common/drlg/room-tile.ts'
import * as drlgMod from '../../../src/d2kern-113c/common/drlg/drlg.ts'
import { DRLGGRID_AllocAndInitGridCells113c } from '../../../src/d2kern-113c/common/drlg/drlg-grid.ts'
import {
  DRLG_AllocAndInitLevel113c,
  DRLG_CountNonPresetRoomsInLevel113c,
  DRLG_FreeLevelData113c,
  DRLG_GetLevel113c,
  DRLG_InitLevelCoordsFromLevelsTxt113c,
  DRLG_TryDeactivateLevelRooms113c,
  DRLG_UpdateInactiveLevels113c,
  DRLG_UpdateLevelActiveCount113c,
} from '../../../src/d2kern-113c/common/drlg/drlg.ts'
import {
  DRLG_AllocAndInitDrlg113c,
  DRLG_FindRoomExAtCoords113c,
  DRLG_InitLevelRooms113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-room.ts'
import {
  DUNGEON_AllocAct113c,
  DUNGEON_CountNonPresetRoomsInLevel113c,
  DUNGEON_FreeActiveRoom113c,
  DUNGEON_SyncActiveRoomStatusChange113c,
  DUNGEON_UpdateInactiveLevels113c,
  DUNGEON_UpdateRoomLevelChange113c,
} from '../../../src/d2kern-113c/common/dungeon.ts'
import {
  UNITS_GetBlockChance113c,
  UNITS_IsMonsterShieldEquipped113c,
} from '../../../src/d2kern-113c/common/unit.ts'
import {
  ADDR_ACT,
  ADDR_CHARSTATS_TXT,
  ADDR_DRLG,
  ADDR_INV0,
  ADDR_ITEMS_TXT,
  ADDR_LEVEL_DEFS,
  ADDR_LVL0,
  ADDR_LVL1,
  ADDR_NEAR_ARR,
  ADDR_OUT0,
  ADDR_OUTDOORS,
  ADDR_ROOM0,
  ADDR_ROOM1,
  ADDR_RX0,
  ADDR_RX1,
  ADDR_SLISTEX,
  ADDR_STATS0,
  ADDR_UNIT0,
  createArenaMem,
  loadVectors,
  resetArena,
  setupOutdoorsBasic,
} from './laneB-I14B-harness.ts'

const VECS = loadVectors(2)
const byVa = (va: string) => VECS.filter((v) => v.va === va)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('K1r13 I14B-2 Wine differential parity (19 VAs)', () => {
  it('0x6FD7D890..0x6FD7DC10 DRLG level init, alloc, free, get', () => {
    const m = createArenaMem()
    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD7D890')[k]!
      resetArena(m)
      m.setU8(ADDR_DRLG + 0x450, k)
      m.setU32(ADDR_DRLG + 0x47c, ADDR_LVL1)
      m.setU32(ADDR_LVL0 + 0x1d0, 2); m.setU32(ADDR_LVL1 + 0x1d0, 1)
      m.setU32(ADDR_LVL1 + 0x1c, 50); m.setU32(ADDR_LVL1 + 0x20, 60)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x0c + k * 4, 32 + k * 8)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x18 + k * 4, 40 + k * 8)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x24, 10)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x28, 20)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x2c, k === 0 ? 0 : 1)
      DRLG_InitLevelCoordsFromLevelsTxt113c(m, ADDR_LVL0, ADDR_DRLG)
      expect(m.u32(ADDR_LVL0 + 0x1c)).toBe(r.out[0])
      expect(m.u32(ADDR_LVL0 + 0x20)).toBe(r.out[1])
      expect(m.u32(ADDR_LVL0 + 0x24)).toBe(r.out[2])
      expect(m.u32(ADDR_LVL0 + 0x28)).toBe(r.out[3])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD7D9B0')[k]!
      resetArena(m)
      const dt = [0, 3, 1]
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x30, dt[k]!)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x34, 5)
      m.setU32(ADDR_DRLG + 0x8c, k & 1)
      m.setU32(ADDR_DRLG + 0x470, 0x100)
      const lvl = DRLG_AllocAndInitLevel113c(m, ADDR_DRLG, 2)
      if (r.exc === 0) {
        expect(m.u32(lvl)).toBe(r.ret)
        expect(m.u32(lvl + 0x1c0)).toBe(r.out[1])
      } else {
        expect(m.u32(lvl)).toBe(1)
      }
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD7DAF0')[k]!
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 4, 4)
      m.setU32(ADDR_LVL0 + 0x00, k === 0 ? 0 : k === 1 ? 1 : 2)
      m.setU32(ADDR_LVL0 + 0x14, k === 1 ? ADDR_OUTDOORS : 0)
      m.setU32(ADDR_LVL0 + 0x1d8, k + 1)
      DRLG_FreeLevelData113c(m, ADDR_LVL0, 0, k & 1)
      expect(m.u32(ADDR_LVL0 + 0x14)).toBe(r.out[0])
      expect(m.u32(ADDR_LVL0 + 0x1d8)).toBe(k === 2 ? 0 : r.out[1])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD7DD80')[k]!
      resetArena(m)
      m.setU32(ADDR_DRLG + 0x47c, k === 0 ? 0 : ADDR_LVL0)
      m.setU32(ADDR_LVL0 + 0x1d0, 2); m.setU32(ADDR_LVL0 + 0x1ac, ADDR_LVL1)
      m.setU32(ADDR_LVL1 + 0x1d0, 5)
      const q = [2, 2, 5]
      const lvl = DRLG_GetLevel113c(m, ADDR_DRLG, q[k]!)
      expect(m.u32(lvl + 0x1d0)).toBe(r.ret)
    }
  })

  it('0x6FD7DD80..0x6FD7E5C0 DRLG room status, active counts, Drlg init, FindRoomEx', () => {
    const m = createArenaMem()
    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD7DDB0')[k]!
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 4, 4)
      m.setU32(ADDR_LVL0 + 0x10, k === 0 ? 0 : ADDR_RX0)
      m.setU8(ADDR_RX0 + 0x44, k === 1 ? 2 : 4)
      m.setU32(ADDR_RX0 + 0x28, k === 2 ? 0x100000 : 0)
      expect(DRLG_TryDeactivateLevelRooms113c(m, ADDR_LVL0)).toBe(r.ret)
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD7DF80')[k]!
      resetArena(m)
      m.setU32(ADDR_LVL0 + 0x0c, k === 0 ? 0 : 3)
      m.setU32(ADDR_LVL0 + 0x1d4, 9)
      m.setU32(ADDR_LVL0 + 0x1b4, ADDR_DRLG)
      m.setU32(ADDR_DRLG + 0x47c, ADDR_LVL0)
      m.setU32(ADDR_LVL0 + 0x10, ADDR_RX0)
      m.setU8(ADDR_RX0 + 0x44, 4)
      DRLG_UpdateLevelActiveCount113c(m, ADDR_LVL0, k === 0 ? -1 : k === 1 ? 2 : -2)
      expect(m.u32(ADDR_LVL0 + 0x0c)).toBe(r.out[0])
      expect(m.u32(ADDR_LVL0 + 0x1d4)).toBe(r.out[1])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD7E1A0')[k]!
      resetArena(m)
      m.setU32(ADDR_DRLG + 0x47c, ADDR_LVL0); m.setU32(ADDR_LVL0 + 0x1d0, 2)
      m.setU32(ADDR_LVL0 + 0x10, k === 0 ? 0 : ADDR_RX0)
      m.setU32(ADDR_RX0 + 0x28, k === 1 ? 0x800000 : 0)
      m.setU32(ADDR_RX0 + 0x24, k === 2 ? ADDR_RX1 : 0)
      expect(DRLG_CountNonPresetRoomsInLevel113c(m, ADDR_DRLG, 2)).toBe(r.ret)
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD7E2C0')[k]!
      resetArena(m)
      m.setU32(ADDR_DRLG + 0x47c, ADDR_LVL0); m.setU32(ADDR_LVL0 + 0x1b4, ADDR_DRLG)
      m.setU32(ADDR_LVL0 + 0x1d0, 2); m.setU32(ADDR_LVL0 + 0x0c, k === 0 ? 1 : 0)
      m.setU32(ADDR_LVL0 + 0x10, ADDR_RX0); m.setU32(ADDR_LVL0 + 0x1d4, k === 1 ? 5 : 0)
      m.setU32(ADDR_RX0 + 0x14, ADDR_LVL0); m.setU32(ADDR_RX0 + 0x58, ADDR_LVL0)
      m.setU8(ADDR_RX0 + 0x44, 4)
      vi.spyOn(roomTileMod, 'DRLGROOMTILE_FreeRoomResources113c').mockImplementation(() => {})
      DRLG_UpdateInactiveLevels113c(m, ADDR_DRLG)
      expect(m.u32(ADDR_LVL0 + 0x1d4)).toBe(r.out[0])
      expect(m.u32(ADDR_LVL0 + 0x10)).toBe(r.exc === 0 ? r.out[1] : 0)
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD7E360')[k]!
      resetArena(m)
      m.setU32(ADDR_DRLG + 0x470, (0x5555 + k * 0x1111) >>> 0)
      m.setU32(ADDR_LVL0 + 0x1b4, ADDR_DRLG); m.setU32(ADDR_LVL0 + 0x1d0, 2)
      m.setU32(ADDR_LVL0 + 0x00, k === 0 ? 0 : k === 1 ? 4 : 9)
      vi.spyOn(presetMod, 'DRLGPRESET_InitLevelPresetRooms113c').mockImplementation(() => {})
      DRLG_InitLevelRooms113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_LVL0 + 0x1c4)).toBe(r.out[0])
      expect(m.u32(ADDR_LVL0 + 0x1c8)).toBe(r.out[1])
    }

    const actNos = [3, 4, 5]
    const seeds = [0x1234, 0x2345, 0x3456]
    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD7E3E0')[k]!
      resetArena(m)
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_LinkAct5OutdoorLevels113c').mockImplementation(() => {})
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_PlaceActLevelsByList113c').mockImplementation(() => {})
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_PlaceAct5OutdoorLevels113c').mockImplementation(() => 0)
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_PlaceAct4Levels113c').mockImplementation(() => {})
      vi.spyOn(drlgMod, 'DRLG_InitActTownFloorTileData113c').mockImplementation(() => {})
      const d = DRLG_AllocAndInitDrlg113c(m, ADDR_ACT, actNos[k]!, 0, seeds[k]!, 0, k & 1, 0, 0, 0, 0)
      expect(m.u32(d + 0x470)).toBe(r.out[0])
      expect(m.u8(d + 0x480)).toBe(r.out[1])
      expect(m.u32(d + 0x47c) !== 0 ? 1 : 0).toBe(r.out[2])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD7E5C0')[k]!
      resetArena(m)
      m.setU32(ADDR_RX0 + 0x34, 10); m.setU32(ADDR_RX0 + 0x38, 20); m.setU32(ADDR_RX0 + 0x3c, 8); m.setU32(ADDR_RX0 + 0x40, 8)
      m.setU32(ADDR_RX0 + 0x2c, 1); m.setU32(ADDR_RX0 + 0x08, ADDR_NEAR_ARR); m.setU32(ADDR_NEAR_ARR, ADDR_RX1)
      m.setU32(ADDR_RX1 + 0x34, 18); m.setU32(ADDR_RX1 + 0x38, 20); m.setU32(ADDR_RX1 + 0x3c, 8); m.setU32(ADDR_RX1 + 0x40, 8)
      m.setU32(ADDR_LVL0 + 0x10, ADDR_RX0); m.setU32(ADDR_RX0 + 0x24, ADDR_RX1)
      const qx = [12, 20, 999]
      const found = DRLG_FindRoomExAtCoords113c(m, ADDR_RX0, qx[k]!, 22, ADDR_DRLG, ADDR_LVL0)
      expect(found !== 0 ? m.u32(found + 0x34) : 0).toBe(r.ret)
    }
  })

  it('0x6FD81680..0x6FD8CC40 Units & Dungeon management', () => {
    const m = createArenaMem()
    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD81680')[k]!
      resetArena(m)
      const cids = [0xf3, 0x167, 0x136]
      m.setU32(ADDR_UNIT0 + 0x00, 1); m.setU32(ADDR_UNIT0 + 0x04, cids[k]!)
      expect(UNITS_IsMonsterShieldEquipped113c(m, ADDR_UNIT0)).toBe(r.ret)
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD81D20')[k]!
      resetArena(m)
      m.setU32(ADDR_UNIT0 + 0x00, k === 0 ? 2 : k === 1 ? 0 : 1)
      m.setU32(ADDR_UNIT0 + 0x04, k === 2 ? 0xf3 : 0)
      m.setU32(ADDR_UNIT0 + 0x60, ADDR_INV0); m.setU32(ADDR_UNIT0 + 0x5c, ADDR_SLISTEX)
      m.setU32(ADDR_SLISTEX + 0x24, ADDR_STATS0); m.setU16(ADDR_SLISTEX + 0x28, 1)
      m.setU32(ADDR_STATS0 + 0x00, 0x140000); m.setU32(ADDR_STATS0 + 0x04, 25)
      m.setU8(ADDR_CHARSTATS_TXT + 0x49, 15)
      expect(UNITS_GetBlockChance113c(m, ADDR_UNIT0, 0)).toBe(r.ret)
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD8C7E0')[k]!
      resetArena(m)
      m.setU32(ADDR_ACT + 0x48, ADDR_DRLG); m.setU32(ADDR_DRLG + 0x47c, ADDR_LVL0)
      m.setU32(ADDR_LVL0 + 0x1d0, 2); m.setU32(ADDR_LVL0 + 0x10, k === 0 ? 0 : ADDR_RX0)
      m.setU32(ADDR_RX0 + 0x28, k === 1 ? 0x800000 : 0)
      expect(DUNGEON_CountNonPresetRoomsInLevel113c(m, ADDR_ACT, 2)).toBe(r.ret)
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD8C800')[k]!
      resetArena(m)
      m.setU32(ADDR_ACT + 0x48, ADDR_DRLG); m.setU32(ADDR_DRLG + 0x47c, ADDR_LVL0)
      m.setU32(ADDR_LVL0 + 0x1b4, ADDR_DRLG)
      m.setU32(ADDR_LVL0 + 0x0c, k === 0 ? 1 : 0); m.setU32(ADDR_LVL0 + 0x10, ADDR_RX0)
      m.setU32(ADDR_LVL0 + 0x1d4, k * 3); m.setU8(ADDR_RX0 + 0x44, 4)
      vi.spyOn(roomTileMod, 'DRLGROOMTILE_FreeRoomResources113c').mockImplementation(() => {})
      DUNGEON_UpdateInactiveLevels113c(m, ADDR_ACT)
      expect(m.u32(ADDR_LVL0 + 0x1d4)).toBe(r.out[0])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD8C810')[k]!
      resetArena(m)
      m.setU32(ADDR_DRLG + 0x47c, ADDR_LVL0)
      m.setU32(ADDR_LVL0 + 0x1b4, ADDR_DRLG); m.setU32(ADDR_LVL0 + 0x1d0, 2); m.setU32(ADDR_LVL0 + 0x0c, 2)
      m.setU32(ADDR_LVL0 + 0x1ac, ADDR_LVL1)
      m.setU32(ADDR_LVL1 + 0x1b4, ADDR_DRLG); m.setU32(ADDR_LVL1 + 0x1d0, 3); m.setU32(ADDR_LVL1 + 0x0c, 0)
      m.setU32(ADDR_ROOM0 + 0x10, ADDR_RX0); m.setU32(ADDR_RX0 + 0x58, ADDR_LVL0)
      m.setU32(ADDR_ROOM1 + 0x10, ADDR_RX1); m.setU32(ADDR_RX1 + 0x58, k === 0 ? ADDR_LVL0 : ADDR_LVL1)
      const rnew = k === 2 ? 0 : ADDR_ROOM1
      DUNGEON_UpdateRoomLevelChange113c(m, ADDR_ROOM0, rnew)
      expect(m.u32(ADDR_LVL0 + 0x0c)).toBe(r.out[0])
      expect(m.u32(ADDR_LVL1 + 0x0c)).toBe(r.out[1])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD8CA20')[k]!
      resetArena(m)
      m.setU32(ADDR_RX0 + 0x58, ADDR_LVL0); m.setU32(ADDR_LVL0 + 0x1b4, ADDR_DRLG)
      m.setU32(ADDR_ACT + 0x10, k === 1 ? 0 : ADDR_ROOM0)
      m.setU32(ADDR_ROOM0 + 0x10, ADDR_RX0); m.setU32(ADDR_ROOM0 + 0x2c, ADDR_ACT); m.setU32(ADDR_ROOM0 + 0x34, 1)
      m.setU32(ADDR_RX0 + 0x30, ADDR_ROOM0)
      const rm = k === 0 ? 0 : ADDR_ROOM0
      vi.spyOn(drlgRoomMod, 'DRLGROOM_IncrementRoomAndNeighborsStatus113c').mockImplementation(() => {})
      if (r.exc !== 0) {
        expect(() => DUNGEON_FreeActiveRoom113c(m, ADDR_ACT, rm)).toThrow()
      } else {
        DUNGEON_FreeActiveRoom113c(m, ADDR_ACT, rm)
        expect(m.u32(ADDR_ACT + 0x10)).toBe(r.out[0])
        expect(m.u32(ADDR_RX0 + 0x60)).toBe(r.out[1])
        expect(m.u32(ADDR_RX0 + 0x30)).toBe(r.out[2])
      }
    }

    // 0x6FD8CB30 DUNGEON_AllocAct113c
    for (let k = 0; k < 3; k++) {
      const rAllocAct = byVa('0x6FD8CB30')[k]!
      resetArena(m)
      m.setU32(ADDR_ITEMS_TXT + 0x04, 1)
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_LinkAct5OutdoorLevels113c').mockImplementation(() => {})
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_PlaceActLevelsByList113c').mockImplementation(() => {})
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_PlaceAct5OutdoorLevels113c').mockImplementation(() => 0)
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_PlaceAct4Levels113c').mockImplementation(() => {})
      vi.spyOn(drlgMod, 'DRLG_InitActTownFloorTileData113c').mockImplementation(() => {})
      const act = DUNGEON_AllocAct113c(m, rAllocAct.args[0]!, rAllocAct.args[1]!, rAllocAct.args[2]!, 0, 0, 0, rAllocAct.args[3]!, 0, 0)
      expect(m.u8(act + 0x14)).toBe(rAllocAct.ret)
      expect(m.u32(act + 0x0c)).toBe(rAllocAct.out[0])
      expect(m.u32(act + 0x50)).toBe(rAllocAct.out[1])
      expect(m.u32(act + 0x08)).toBe(rAllocAct.out[2])
      expect(m.u32(act + 0x48) !== 0 ? 1 : 0).toBe(rAllocAct.out[3])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD8CC40')[k]!
      resetArena(m)
      m.setU32(ADDR_RX0 + 0x58, ADDR_LVL0); m.setU32(ADDR_LVL0 + 0x1b4, ADDR_DRLG)
      m.setU32(ADDR_ROOM0 + 0x10, ADDR_RX0); m.setU32(ADDR_ROOM1 + 0x10, k === 0 ? ADDR_RX0 : 0)
      m.setU16(ADDR_RX0 + 0x0c, k === 1 ? 0 : 2)
      vi.spyOn(drlgRoomMod, 'DRLGROOM_DecrementNearRoomsStatus113c').mockImplementation(() => {})
      vi.spyOn(drlgRoomMod, 'DRLGROOM_IncrementRoomAndNeighborsStatus113c').mockImplementation(() => {})
      DUNGEON_SyncActiveRoomStatusChange113c(m, ADDR_ROOM0, k === 2 ? 0 : ADDR_ROOM1)
      expect(m.u16(ADDR_RX0 + 0x0c)).toBe(r.out[0])
    }
  })

  it('AST mutation boundary killers for I14B-2', () => {
    const m = createArenaMem()

    // 1. DRLG_InitLevelCoordsFromLevelsTxt113c: nLevelId = 0 (>= 0 vs > 0)
    {
      resetArena(m)
      m.setU32(ADDR_LVL0 + 0x1d0, 0)
      m.setU32(ADDR_LEVEL_DEFS + 0x24, 17); m.setU32(ADDR_LEVEL_DEFS + 0x28, 29)
      DRLG_InitLevelCoordsFromLevelsTxt113c(m, ADDR_LVL0, ADDR_DRLG)
      expect(m.u32(ADDR_LVL0 + 0x1c)).toBe(17)
      expect(m.u32(ADDR_LVL0 + 0x20)).toBe(29)
    }

    // 2. DRLG_AllocAndInitLevel113c: dwDrlgType=2 (PRESET_InitLevel113c), dwDrlgType=3 (Outdoors alloc), drlg+0x8c=1 (| 0x10), sgpt+0xc5c boundary
    {
      resetArena(m)
      m.setU32(ADDR_DRLG + 0x8c, 1)
      m.setU32(ADDR_LEVEL_DEFS + 3 * 0x9c + 0x30, 2)
      const initSpy = vi.spyOn(presetMod, 'DRLGPRESET_AllocLevelPresetInfo113c').mockImplementation(() => {})
      const lvl = DRLG_AllocAndInitLevel113c(m, ADDR_DRLG, 3)
      expect(m.u32(lvl + 0x04) & 0x10).toBe(0x10)
      expect(initSpy.mock.calls.length).toBe(1)

      m.setU32(ADDR_LEVEL_DEFS + 4 * 0x9c + 0x30, 3)
      const lvl3 = DRLG_AllocAndInitLevel113c(m, ADDR_DRLG, 4)
      expect(m.u32(lvl3 + 0x14)).not.toBe(0)

      // boundary lvlId === sgpt+0xc5c (must NOT read level defs at sgpt+0xc5c)
      m.setU32(m.u32(0x6fde9e1c) + 0xc5c, 3)
      expect(() => DRLG_AllocAndInitLevel113c(m, ADDR_DRLG, 3)).toThrow()
    }

    // 3. DRLG_FreeLevelData113c: dwDrlgType=2, pPreset!=0, pArr!=0, pPresetRoom!=0, p1bc!=0, pCoordNode!=0
    {
      resetArena(m)
      m.setU32(ADDR_LVL0 + 0x00, 2)
      const pPreset = m.alloc(0x20) >>> 0; m.setU32(pPreset, 99)
      const pArr = m.alloc(0x40) >>> 0
      const p1bc = m.alloc(0x20) >>> 0
      const pCoord = m.alloc(0x20) >>> 0; m.setU32(pCoord + 0x0c, 0)
      m.setU32(ADDR_LVL0 + 0x14, pPreset)
      m.setU32(ADDR_LVL0 + 0x1b4, ADDR_DRLG)
      m.setU32(ADDR_LVL0 + 0x10, ADDR_RX0); m.setU32(ADDR_RX0 + 0x60, 1); m.setU32(ADDR_RX0 + 0x58, ADDR_LVL0)
      m.setU32(ADDR_LVL0 + 0x22c, pArr)
      m.setU32(ADDR_LVL0 + 0x1b0, 0x20025000)
      m.setU32(ADDR_LVL0 + 0x1bc, p1bc)
      m.setU32(ADDR_LVL0 + 0x1cc, pCoord)
      vi.spyOn(presetMod, 'DRLGPRESET_FreeDrlgMapList113c').mockImplementation(() => {})
      DRLG_FreeLevelData113c(m, ADDR_LVL0, 0, 1)
      expect(m.u32(pArr)).toBe(1)
      DRLG_FreeLevelData113c(m, ADDR_LVL0, 0, 0)
      expect(m.u32(ADDR_LVL0 + 0x14)).toBe(0)
      expect(m.u32(ADDR_LVL0 + 0x1b0)).toBe(0)
      expect(m.u32(ADDR_LVL0 + 0x1bc)).toBe(0)
      expect(m.u32(ADDR_LVL0 + 0x1cc)).toBe(0)

      // pRoomEx + 0x60 === 0 -> does not write to address 0
      m.setU32(0, 0x77)
      m.setU32(ADDR_LVL0 + 0x10, ADDR_RX0); m.setU32(ADDR_RX0 + 0x60, 0); m.setU32(ADDR_RX0 + 0x58, ADDR_LVL0)
      DRLG_FreeLevelData113c(m, ADDR_LVL0, 0, 0)
      expect(m.u32(0)).toBe(0x77)
    }

    // 4. DRLG_TryDeactivateLevelRooms113c & DRLG_UpdateLevelActiveCount113c boundaries
    {
      resetArena(m)
      m.setU32(ADDR_LVL0 + 0x1b4, ADDR_DRLG); m.setU32(ADDR_DRLG + 0x47c, ADDR_LVL0)
      m.setU32(ADDR_LVL0 + 0x1d0, 2); m.setU32(ADDR_LVL0 + 0x1ac, ADDR_LVL1)
      m.setU32(ADDR_LVL1 + 0x1b4, ADDR_DRLG); m.setU32(ADDR_LVL1 + 0x1d0, 3)
      m.setU32(ADDR_LVL0 + 0x0c, 0); m.setU32(ADDR_LVL0 + 0x1d4, 5)
      m.setU32(ADDR_LVL0 + 0x10, ADDR_RX0); m.setU8(ADDR_RX0 + 0x44, 4); m.setU32(ADDR_RX0 + 0x24, ADDR_RX1)
      m.setU8(ADDR_RX1 + 0x44, 3) // 2nd room in list has status <= 3 -> blocks deactivation!
      const freeUnitsSpy = vi.spyOn(roomTileMod, 'DRLGROOMTILE_FreeRoomResources113c').mockImplementation(() => {})
      expect(DRLG_TryDeactivateLevelRooms113c(m, ADDR_LVL0)).toBe(0)
      m.setU8(ADDR_RX1 + 0x44, 4)
      // warp-connected dstLevelId = 3 with active warp room (0x28 & 0x10 and status <= 3) blocks deactivation
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x48 + 0 * 4, 3)
      m.setU32(ADDR_LEVEL_DEFS + 3 * 0x9c + 0x48 + 0 * 4, 2)
      m.setU32(ADDR_LVL1 + 0x10, ADDR_RX1); m.setU32(ADDR_RX0 + 0x24, 0)
      m.setU32(ADDR_RX1 + 0x28, 0x10); m.setU8(ADDR_RX1 + 0x44, 3)
      expect(DRLG_TryDeactivateLevelRooms113c(m, ADDR_LVL0)).toBe(0)
      m.setU8(ADDR_RX1 + 0x44, 4)
      expect(DRLG_TryDeactivateLevelRooms113c(m, ADDR_LVL0)).toBe(1)

      DRLG_UpdateLevelActiveCount113c(m, ADDR_LVL0, 1)
      expect(m.u32(ADDR_LVL0 + 0x0c)).toBe(1)
      m.setU8(ADDR_RX0 + 0x44, 3)
      freeUnitsSpy.mockClear()
      DRLG_UpdateLevelActiveCount113c(m, ADDR_LVL0, -1) // status=3 -> does NOT free units!
      expect(m.u32(ADDR_LVL0 + 0x0c)).toBe(0)
      expect(freeUnitsSpy.mock.calls.length).toBe(0)
    }

    // 4b. DRLG_InitLevelRooms113c (type=3 Outdoors) & DRLG_AllocAndInitDrlg113c (pfnErrorCallback, nStartLevelId=0, nAct=5)
    {
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 4, 4)
      m.fill(0, 0x50, 0)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x38, 0xffffffff)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x3c, 0xffffffff)
      m.setU32(ADDR_LVL0 + 0x00, 3); m.setU32(ADDR_LVL0 + 0x24, 16); m.setU32(ADDR_LVL0 + 0x28, 16)
      // Isolate 0x6FD7E360 from the Act 1 wilderness generator (0x6FDCF3A0 needs full LvlPrest/Levels data; on this
      // 16x16 fixture it would INT_DIVIDE_BY_ZERO in 0x6FD92EB0 exactly like the DLL). Stub 0x6FD93580 at the
      // cross-module boundary with its grid allocation + a filled sub-theme grid, then run the real 0x6FD93190.
      vi.spyOn(outdoorsMod, 'DRLGOUTDOORS_InitOutdoorLevel113c').mockImplementation((sm, lvl) => {
        const out = sm.u32(lvl + 0x14)
        const pool = sm.u32(sm.u32(lvl + 0x1b4) + 0x478)
        const gw = ((sm.u32(lvl + 0x24) | 0) / 8) | 0
        const gh = ((sm.u32(lvl + 0x28) | 0) / 8) | 0
        sm.setU32(out + 0x54, 0); sm.setU32(out + 0x58, 0); sm.setU32(out + 0x5c, gw); sm.setU32(out + 0x60, gh)
        for (const off of [0x04, 0x18, 0x2c, 0x40]) DRLGGRID_AllocAndInitGridCells113c(sm, out + off, pool, gw, gh)
        sm.fill(sm.u32(out + 0x40), 64, 0xff)
        outdoorsMod.DRLGOUTDOORS_BuildOutdoorRoomExList113c(sm, lvl)
      })
      vi.spyOn(presetMod, 'DRLGPRESET_BuildPresetRoomsFromMap113c').mockImplementation(() => 0)
      DRLG_InitLevelRooms113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_LVL0 + 0x10)).not.toBe(0)

      resetArena(m)
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_LinkAct5OutdoorLevels113c').mockImplementation(() => 0)
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_PlaceActLevelsByList113c').mockImplementation(() => 0)
      const d1 = DRLG_AllocAndInitDrlg113c(m, ADDR_ACT, 1, 0, 0x1234, 0, 0, 0, 0, 0, 0x12345678)
      expect(m.u32(d1 + 0x488)).toBe(0x12345678)
      expect(m.u32(d1 + 0x484)).toBeGreaterThanOrEqual(0x42)

      const d5 = DRLG_AllocAndInitDrlg113c(m, ADDR_ACT, 5, 0, 0x1234, 0, 0, 0, 0, 0, 0)
      expect(m.u32(d5 + 0x47c)).toBe(0)
    }

    // 5. DRLG_FindRoomExAtCoords113c boundary (< vs <=)
    {
      resetArena(m)
      m.setU32(ADDR_LVL0 + 0x1b4, ADDR_DRLG); m.setU32(ADDR_DRLG + 0x47c, ADDR_LVL0)
      m.setU32(ADDR_LVL0 + 0x1c, 0); m.setU32(ADDR_LVL0 + 0x20, 0); m.setU32(ADDR_LVL0 + 0x24, 100); m.setU32(ADDR_LVL0 + 0x28, 100)
      m.setU32(ADDR_LVL0 + 0x10, ADDR_RX0)
      m.setU32(ADDR_RX0 + 0x34, 10); m.setU32(ADDR_RX0 + 0x38, 10)
      m.setU32(ADDR_RX0 + 0x3c, 5); m.setU32(ADDR_RX0 + 0x40, 5)
      expect(DRLG_FindRoomExAtCoords113c(m, ADDR_RX0, 14, 10, ADDR_DRLG, ADDR_LVL0)).toBe(ADDR_RX0)
      expect(DRLG_FindRoomExAtCoords113c(m, ADDR_RX0, 15, 10, ADDR_DRLG, ADDR_LVL0)).toBe(0)
      expect(DRLG_FindRoomExAtCoords113c(m, ADDR_RX0, 10, 15, ADDR_DRLG, ADDR_LVL0)).toBe(0)
    }

    // 6. DUNGEON_FreeActiveRoom113c & DUNGEON_UpdateRoomLevelChange113c & DUNGEON_SyncActiveRoomStatusChange113c
    {
      resetArena(m)
      m.setU32(ADDR_ACT + 0x10, ADDR_ROOM1)
      m.setU32(ADDR_ROOM1 + 0x7c, ADDR_ROOM0); m.setU32(ADDR_ROOM0 + 0x7c, 0)
      const pNear0 = m.alloc(16) >>> 0; m.setU32(pNear0, ADDR_ROOM1)
      const pNear1 = m.alloc(16) >>> 0; m.setU32(pNear1, ADDR_ROOM0); m.setU32(pNear1 + 4, ADDR_ROOM1)
      m.setU32(ADDR_ROOM0, pNear0); m.setU32(ADDR_ROOM0 + 0x24, 1)
      m.setU32(ADDR_ROOM1, pNear1); m.setU32(ADDR_ROOM1 + 0x24, 2)
      m.setU32(ADDR_ROOM0 + 0x10, ADDR_RX0); m.setU32(ADDR_ROOM0 + 0x2c, ADDR_ACT); m.setU32(ADDR_ROOM0 + 0x34, 1)
      m.setU32(ADDR_RX0 + 0x58, ADDR_LVL0)
      m.setU32(ADDR_RX0 + 0x28, 0x100000); m.setU32(ADDR_RX0 + 0x30, ADDR_ROOM0)
      const freeSpy = vi.spyOn(roomTileMod, 'DRLGROOMTILE_FreeRoomResources113c').mockImplementation(() => {})
      const clearSpy = vi.spyOn(drlgRoomMod, 'DRLGROOM_IncrementRoomAndNeighborsStatus113c').mockImplementation(() => {})
      DUNGEON_FreeActiveRoom113c(m, ADDR_ACT, ADDR_ROOM0)
      expect(m.u32(ADDR_ROOM1 + 0x7c)).toBe(0)
      expect(m.u32(ADDR_ROOM1 + 0x24)).toBe(1)
      expect(m.u32(pNear1)).toBe(ADDR_ROOM1)
      expect(m.u32(ADDR_RX0 + 0x60)).toBe(1)
      expect(m.u32(ADDR_RX0 + 0x30)).toBe(0)
      expect(freeSpy.mock.calls.length).toBe(1)

      // prev = 0 with nextRoom = ADDR_ROOM1 updates ADDR_ACT + 0x10 to ADDR_ROOM1
      m.setU32(ADDR_ACT + 0x10, ADDR_ROOM0); m.setU32(ADDR_ROOM0 + 0x7c, ADDR_ROOM1); m.setU32(ADDR_ROOM0 + 0x24, 0)
      DUNGEON_FreeActiveRoom113c(m, ADDR_ACT, ADDR_ROOM0)
      expect(m.u32(ADDR_ACT + 0x10)).toBe(ADDR_ROOM1)

      // DUNGEON_UpdateRoomLevelChange113c with pOldRoom = 0, pNewRoom = ADDR_ROOM1
      m.setU32(ADDR_ROOM1 + 0x10, ADDR_RX1); m.setU32(ADDR_RX1 + 0x58, ADDR_LVL1); m.setU32(ADDR_LVL1 + 0x1b4, ADDR_DRLG); m.setU32(ADDR_LVL1 + 0x0c, 0)
      DUNGEON_UpdateRoomLevelChange113c(m, 0, ADDR_ROOM1)
      expect(m.u32(ADDR_LVL1 + 0x0c)).toBe(1)

      // DUNGEON_SyncActiveRoomStatusChange113c: verify ClearStatus called only when rxNew != 0
      clearSpy.mockClear()
      m.setU32(ADDR_ROOM0 + 0x10, 0); m.setU32(ADDR_ROOM1 + 0x10, ADDR_RX1)
      DUNGEON_SyncActiveRoomStatusChange113c(m, ADDR_ROOM0, ADDR_ROOM1)
      expect(clearSpy.mock.calls.length).toBe(1)
    }

    // 7. UNITS_IsMonsterShieldEquipped113c & UNITS_GetBlockChance113c boundaries
    {
      resetArena(m)
      m.setU32(ADDR_UNIT0 + 0x00, 2); m.setU32(ADDR_UNIT0 + 0x04, 1) // unitType=2 -> varIdx = 0
      const compArgs: number[] = []
      vi.spyOn(monstersMod, 'MONSTERS_GetCompCode113c').mockImplementation((_m, _u, _c, v) => { compArgs.push(v); return 0 })
      expect(UNITS_IsMonsterShieldEquipped113c(m, ADDR_UNIT0)).toBe(0)
      expect(compArgs).toEqual([0])

      // pCode match at idx=0 ('buc ' != 0x20202020 -> returns 1)
      const pLink = m.alloc(0x40) >>> 0; const pCodeArr = m.alloc(0x40) >>> 0
      m.fill(pLink, 0x40, 0); m.fill(pCodeArr, 0x40, 0)
      m.setU32(pLink + 0x00, 1); m.setU32(pLink + 0x08, pCodeArr)
      m.setU32(pCodeArr + 0, 0x20637562); m.setU32(pCodeArr + 4, 0)
      m.setU32(0x6fdeff6c, pLink)
      m.setU16(ADDR_ITEMS_TXT + 0 * 0x1a8 + 0x11e, 2)
      vi.spyOn(monstersMod, 'MONSTERS_GetCompCode113c').mockImplementation(() => 0x20637562)
      expect(UNITS_IsMonsterShieldEquipped113c(m, ADDR_UNIT0)).toBe(1)

      // UNITS_GetBlockChance113c: unitType=0 with equipped shield in grid0 slot 4 & slot 5, and unitType=1 with cid=32
      resetArena(m)
      m.setU32(ADDR_UNIT0 + 0x00, 0); m.setU32(ADDR_UNIT0 + 0x04, 0)
      m.setU32(ADDR_UNIT0 + 0x60, ADDR_INV0); m.setU32(ADDR_INV0 + 0x00, 0x01020304)
      m.setU32(ADDR_UNIT0 + 0x5c, ADDR_SLISTEX)
      m.setU32(ADDR_SLISTEX + 0x24, ADDR_STATS0); m.setU16(ADDR_SLISTEX + 0x28, 1)
      m.setU32(ADDR_STATS0 + 0x00, 0x140000); m.setU32(ADDR_STATS0 + 0x04, 25)
      m.setU8(ADDR_CHARSTATS_TXT + 0x49, 15)
      const pGrid0 = m.alloc(0x80) >>> 0; const pShield = m.alloc(0x80) >>> 0
      m.fill(pGrid0, 0x80, 0); m.fill(pShield, 0x80, 0)
      m.setU8(0x6fded378, 13); m.setU8(0x6fded379, 1)
      m.setU32(ADDR_INV0 + 0x14, pGrid0); m.setU32(ADDR_INV0 + 0x18, 1)
      m.setU8(pGrid0 + 8, 13); m.setU8(pGrid0 + 9, 1)
      m.setU32(pGrid0 + 0x0c, pGrid0 + 0x20); m.setU32(pGrid0 + 0x20 + 4 * 4, pShield)
      m.setU32(pShield + 0x00, 4); m.setU32(pShield + 0x04, 1)
      m.setU16(ADDR_ITEMS_TXT + 1 * 0x1a8 + 0x11e, 1)
      m.setU32(0x20006000 + (4 * 1 + (0x33 >> 5)) * 4, (1 << (0x33 & 0x1f)) >>> 0)
      expect(UNITS_GetBlockChance113c(m, ADDR_UNIT0, 0)).toBe(40)

      m.setU32(ADDR_UNIT0 + 0x00, 1); m.setU32(ADDR_UNIT0 + 0x04, 32) // cid == sgpt+0xa80 -> returns 0
      expect(UNITS_GetBlockChance113c(m, ADDR_UNIT0, 0)).toBe(0)
    }

    // 8. DUNGEON_AllocAct113c: bClient=1 path, nTownLevelId, & dwFlags=1
    {
      resetArena(m)
      m.setU32(ADDR_ITEMS_TXT + 0x04, 1)
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_LinkAct5OutdoorLevels113c').mockImplementation(() => 0)
      vi.spyOn(outPlaceMod, 'DRLGOUTPLACE_PlaceActLevelsByList113c').mockImplementation(() => 0)
      vi.spyOn(drlgMod, 'DRLG_InitActTownFloorTileData113c').mockImplementation(() => {})
      const act = DUNGEON_AllocAct113c(m, 0, 0x1234, 0, 1, 2, 1, 40, 0, 0)
      expect(m.u32(act + 0x0c)).toBe(0x1234)
      expect(m.u32(act + 0x08)).toBe(40)
      expect(m.u32(act + 0x5c)).toBe(1)
      const actFlags = DUNGEON_AllocAct113c(m, 0, 0x1234, 1, 1, 2, 1, 40, 0, 0)
      expect(m.u32(actFlags + 0x50)).toBe(1)
    }
  })
})

