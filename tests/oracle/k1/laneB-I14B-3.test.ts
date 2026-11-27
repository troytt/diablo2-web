import { afterEach, describe, expect, it, vi } from 'vitest'
import * as drlgGridMod from '../../../src/d2kern-113c/common/drlg/drlg-grid.ts'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import * as drlgRoomMod from '../../../src/d2kern-113c/common/drlg/drlg-room.ts'
import * as outJungMod from '../../../src/d2kern-113c/common/drlg/out-jung.ts'
import * as outdoorsMod from '../../../src/d2kern-113c/common/drlg/outdoors.ts'
import * as presetMod from '../../../src/d2kern-113c/common/drlg/preset.ts'
import * as envMod from '../../../src/d2kern-113c/common/env.ts'
import { DRLGROOM_LinkAdjacentWarpRooms113c } from '../../../src/d2kern-113c/common/drlg/drlg-room.ts'
import {
  DRLGVER_ApplyMazeBorderTiles113c,
  DRLGVER_CollectOutdoorRoomLinks113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-ver.ts'
import {
  DRLGOUTDOORS_BuildOutdoorRoomExList113c,
  DRLGOUTDOORS_BuildOutdoorSubstContext113c,
  DRLGOUTDOORS_InitOutdoorLevel113c,
  DRLGOUTDOORS_PlaceClosestOutdoorPresetToRect113c,
  DRLGOUTDOORS_PlaceRandomOutdoorPresetNearSeed113c,
  DRLGOUTDOORS_PlaceRandomOutdoorShrineOrSpecial113c,
} from '../../../src/d2kern-113c/common/drlg/outdoors.ts'
import {
  DRLGOUTWILD_BuildOutdoorPathsAndEnv113c,
  DRLGOUTWILD_ResolveOutdoorRoomBridgeTargets113c,
} from '../../../src/d2kern-113c/common/drlg/room-tile.ts'
import {
  DUNGEON_FindFreeSpawnPositionInLevel113c,
  DUNGEON_FindLevelSpawnRoom113c,
  DUNGEON_FindRoomBySubtileCoords113c,
  DUNGEON_FindWarpPortalUnitInTargetLevel113c,
} from '../../../src/d2kern-113c/common/dungeon.ts'
import {
  DRLGOUTANIM_BuildAct5Outdoors113c,
  DRLGOUTANIM_BuildAct5PresetContext113c,
} from '../../../src/d2kern-113c/tables/anim-tbls-113c.ts'
import {
  ADDR_ACT,
  ADDR_DRLG,
  ADDR_GRID0_CELLS,
  ADDR_GRID0_ROWS,
  ADDR_GRID1_CELLS,
  ADDR_GRID2_CELLS,
  ADDR_GRID2_ROWS,
  ADDR_LEVEL_DEFS,
  ADDR_LVLPREST_TXT,
  ADDR_LVL0,
  ADDR_LVL1,
  ADDR_MAZEGRID,
  ADDR_MGRID_CELLS,
  ADDR_MGRID_ROWS,
  ADDR_ORTH0,
  ADDR_OUT0,
  ADDR_OUT1,
  ADDR_OUT_COMP,
  ADDR_OUTDOORS,
  ADDR_RECT,
  ADDR_ROOM0,
  ADDR_ROOM1,
  ADDR_RT0,
  ADDR_RX0,
  ADDR_RX1,
  ADDR_UNIT0,
  ADDR_V0,
  ADDR_V1,
  createArenaMem,
  loadVectors,
  resetArena,
  setupGrid,
  setupOutdoorsBasic,
} from './laneB-I14B-harness.ts'

const VECS = loadVectors(3)
const byVa = (va: string) => VECS.filter((v) => v.va === va)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('K1r13 I14B-3 Wine differential parity (17 VAs)', () => {
  it('0x6FD8CD00..0x6FD8CEE0 Dungeon finders', () => {
    const m = createArenaMem()
    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD8CD00')[k]!
      resetArena(m)
      // Mirrors k1r13-laneB-it14-emitter.c case 38 (ADDR_TILE0 == ADDR_RT0).
      m.setU32(ADDR_ROOM0 + 0x10, ADDR_RX0)
      if (k >= 1) {
        m.setU32(ADDR_RX0 + 0x4c, ADDR_RT0)
        m.setU32(ADDR_RT0, ADDR_RX1); m.setU32(ADDR_RT0 + 0x10, ADDR_V0); m.setU32(ADDR_V0, 77)
        m.setU32(ADDR_RX1 + 0x28, 0x03100000); m.setU32(ADDR_RX1 + 0x4c, ADDR_RT0 + 0x20)
        m.setU32(ADDR_RT0 + 0x20, ADDR_RX0); m.setU32(ADDR_RT0 + 0x30, ADDR_V1); m.setU32(ADDR_V1, 88)
        m.setU32(ADDR_RX1 + 0x30, ADDR_ROOM1)
        if (k === 2) {
          m.setU32(ADDR_ROOM1 + 0x74, ADDR_UNIT0); m.setU32(ADDR_UNIT0 + 0x00, 5); m.setU32(ADDR_UNIT0 + 0x04, 88)
        }
      }
      const rm = k === 0 ? 0 : ADDR_ROOM0
      if (r.exc !== 0) {
        expect(() => DUNGEON_FindWarpPortalUnitInTargetLevel113c(m, rm, 77, ADDR_OUT0)).toThrow(D2CommonAssertError)
      } else {
        // 0x6FD8CD67..0x6FD8CD71: *pOutLvlWarpTxt = pLvlWarpTxt (from 0x6FD6A0D0), eax = pUnit.
        expect(DUNGEON_FindWarpPortalUnitInTargetLevel113c(m, rm, 77, ADDR_OUT0) >>> 0).toBe(r.ret >>> 0)
        expect(m.u32(ADDR_OUT0)).toBe(r.out[0])
      }
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD8CDA0')[k]!
      resetArena(m)
      m.setU32(ADDR_ACT + 0x48, ADDR_DRLG); m.setU32(ADDR_DRLG + 0x47c, ADDR_LVL0)
      m.setU32(ADDR_LVL0 + 0x10, ADDR_RX0)
      m.setU32(ADDR_RX0 + 0x28, 0x03100000)
      m.setU32(ADDR_RX0 + 0x34, 10); m.setU32(ADDR_RX0 + 0x38, 20); m.setU32(ADDR_RX0 + 0x3c, 8); m.setU32(ADDR_RX0 + 0x40, 8)
      m.setU32(ADDR_RX0 + 0x30, ADDR_ROOM0)
      const act = k === 0 ? 0 : ADDR_ACT
      const x = k === 1 ? 12 : 999
      if (r.exc !== 0) {
        expect(() => DUNGEON_FindRoomBySubtileCoords113c(m, act, x, 22)).toThrow()
      } else {
        // 0x6FD8CDE1: tail-calls 0x6FDCC270 -> returns D2ActiveRoomStrc* (pRoomEx->pRoom1), not pRoomEx.
        expect(DUNGEON_FindRoomBySubtileCoords113c(m, act, x, 22) >>> 0).toBe(r.ret >>> 0)
      }
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD8CDF0')[k]!
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 4, 4)
      m.setU32(ADDR_ACT + 0x48, ADDR_DRLG)
      m.setU32(ADDR_LVL0 + 0x10, k === 1 ? 0 : ADDR_RX0)
      m.setU32(ADDR_RX0 + 0x28, 0x03110000); m.setU32(ADDR_RX0 + 0x30, ADDR_ROOM0)
      m.setU32(ADDR_RX0 + 0x34, 10); m.setU32(ADDR_RX0 + 0x38, 20); m.setU32(ADDR_RX0 + 0x3c, 8); m.setU32(ADDR_RX0 + 0x40, 8)
      m.setU32(ADDR_ROOM0 + 0x4c, ADDR_OUT_COMP)
      const act = k === 0 ? 0 : ADDR_ACT
      vi.spyOn(drlgRoomMod, 'DRLGROOM_EnsureRoomAndGetRoom1_113c').mockImplementation(() => 0)
      if (r.exc !== 0) {
        expect(() => DUNGEON_FindFreeSpawnPositionInLevel113c(m, act, 2, k, ADDR_OUT0, ADDR_OUT1, 2)).toThrow()
      }
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD8CEE0')[k]!
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 4, 4)
      m.setU32(ADDR_ACT + 0x48, ADDR_DRLG); m.setU32(ADDR_LVL0 + 0x10, ADDR_RX0)
      m.setU32(ADDR_RX0 + 0x28, 0x03110000); m.setU32(ADDR_RX0 + 0x30, ADDR_ROOM0)
      m.setU32(ADDR_RX0 + 0x34, 10); m.setU32(ADDR_RX0 + 0x38, 20); m.setU32(ADDR_RX0 + 0x3c, 8); m.setU32(ADDR_RX0 + 0x40, 8)
      const act = k === 0 ? 0 : ADDR_ACT
      vi.spyOn(drlgRoomMod, 'DRLGROOM_EnsureRoomAndGetRoom1_113c').mockImplementation(() => 0)
      if (r.exc !== 0) {
        expect(() => DUNGEON_FindLevelSpawnRoom113c(m, act, 2, k, ADDR_OUT0, ADDR_OUT1)).toThrow()
      } else {
        const ret = DUNGEON_FindLevelSpawnRoom113c(m, act, 2, k, ADDR_OUT0, ADDR_OUT1)
        expect(ret !== 0 ? 1 : 0).toBe(r.ret)
        expect(m.u32(ADDR_OUT0)).toBe(r.out[0])
        expect(m.u32(ADDR_OUT1)).toBe(r.out[1])
      }
    }
  })

  it('0x6FD8D5A0..0x6FD8E000 DRLGVER & DRLGOUTWILD', () => {
    const m = createArenaMem()
    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD8D5A0')[k]!
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 4, 4)
      if (k >= 1) {
        m.setU32(ADDR_OUTDOORS + 0x264, ADDR_ORTH0)
        m.setU32(ADDR_ORTH0 + 0x00, ADDR_LVL1); m.setU32(ADDR_ORTH0 + 0x04, k - 1)
        m.setU32(ADDR_LVL1 + 0x1d0, k === 1 ? 1 : 0x1b)
        m.setU32(ADDR_LVL1 + 0x1c, 200); m.setU32(ADDR_LVL1 + 0x20, 300)
      }
      DRLGVER_CollectOutdoorRoomLinks113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_OUTDOORS + 0x260)).toBe(r.out[0])
      expect(m.u32(ADDR_OUTDOORS + 0x80)).toBe(r.out[1])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD8DB20')[k]!
      resetArena(m)
      // Mirrors k1r13-laneB-it14-emitter.c case 43: eax-less __stdcall(pRoomEx), pRoomEx->pOutdoor (+0x20)
      // with output grid at +0x28/+0x2C and source grid at +0x3C/+0x40 (0x6FD8DB20..0x6FD8DC89).
      m.setU32(ADDR_RX0 + 0x20, ADDR_OUTDOORS)
      m.setU32(ADDR_RX0 + 0x3c, k === 0 ? 0xfffffffe : 3)
      m.setU32(ADDR_RX0 + 0x40, 3)
      m.setU32(ADDR_OUTDOORS + 0x28, ADDR_GRID0_CELLS); m.setU32(ADDR_OUTDOORS + 0x2c, ADDR_GRID0_ROWS)
      m.setU32(ADDR_OUTDOORS + 0x34, 6); m.setU32(ADDR_OUTDOORS + 0x38, 6)
      m.setU32(ADDR_OUTDOORS + 0x3c, ADDR_MGRID_CELLS); m.setU32(ADDR_OUTDOORS + 0x40, ADDR_MGRID_ROWS)
      m.setU32(ADDR_OUTDOORS + 0x48, 6); m.setU32(ADDR_OUTDOORS + 0x4c, 6)
      setupGrid(m, ADDR_GRID0_ROWS, 6, 6); setupGrid(m, ADDR_MGRID_ROWS, 6, 6)
      for (let i = 0; i < 36; i++) { m.setU32(ADDR_GRID0_CELLS + i * 4, 0); m.setU32(ADDR_MGRID_CELLS + i * 4, 0) }
      const setM = (x: number, y: number): void => m.setU32(ADDR_MGRID_CELLS + (y * 6 + x) * 4, 1)
      if (k === 1) {
        setM(2, 2); setM(1, 2)
      } else if (k === 2) {
        setM(0, 2); setM(0, 1); setM(0, 0); setM(1, 2); setM(1, 1); setM(2, 1)
      }
      expect(r.exc).toBe(0)
      DRLGVER_ApplyMazeBorderTiles113c(m, ADDR_RX0)
      expect(m.u32(ADDR_GRID0_CELLS)).toBe(r.out[0])
      expect(m.u32(ADDR_GRID0_CELLS + (1 * 6 + 1) * 4)).toBe(r.out[1])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD8DD40')[k]!
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 4, 4)
      m.setU32(ADDR_OUTDOORS + 0x260, k)
      if (k >= 1) {
        m.setU32(ADDR_OUTDOORS + 0x264, ADDR_ORTH0)
        m.setU32(ADDR_ORTH0 + 0x00, ADDR_LVL1); m.setU32(ADDR_ORTH0 + 0x04, 0); m.setU32(ADDR_LVL1 + 0x1d0, 1)
        m.setU32(ADDR_LVL1 + 0x1c, 100); m.setU32(ADDR_LVL1 + 0x20, 200)
        m.setU32(ADDR_ORTH0 + 0x14, ADDR_ORTH0 + 0x20)
        m.setU32(ADDR_ORTH0 + 0x20, ADDR_LVL1); m.setU32(ADDR_ORTH0 + 0x24, 1)
      }
      DRLGOUTWILD_ResolveOutdoorRoomBridgeTargets113c(m, ADDR_LVL0)
      if (k >= 1) expect(m.u32(ADDR_LVL1 + 0x1c)).toBe(100)
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD8E000')[k]!
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 4, 4)
      if (k >= 1) {
        m.setU32(ADDR_OUTDOORS + 0x264, ADDR_ORTH0)
        m.setU32(ADDR_ORTH0 + 0x00, ADDR_LVL1); m.setU32(ADDR_ORTH0 + 0x04, k - 1); m.setU32(ADDR_LVL1 + 0x1d0, 1)
        m.setU32(ADDR_LVL1 + 0x1c, 100); m.setU32(ADDR_LVL1 + 0x20, 200)
      }
      vi.spyOn(outdoorsMod, 'DRLGOUTWILD_InitAct1OutdoorLevel113c').mockImplementation(() => {})
      DRLGOUTWILD_BuildOutdoorPathsAndEnv113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_OUTDOORS + 0x260)).toBe(r.out[0])
    }
  })

  it('0x6FD91AD0..0x6FD952C0 Act5 anim, Outdoors & LinkAdjacentWarpRooms', () => {
    const m = createArenaMem()
    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD91AD0')[k]!
      resetArena(m)
      const lid = k === 0 ? 0x6e : k === 1 ? 0x6f : 0x70
      setupOutdoorsBasic(m, lid, 30, 4, 4)
      if (r.exc !== 0) {
        expect(() => DRLGOUTANIM_BuildAct5PresetContext113c(m, ADDR_LVL0)).toThrow()
      } else {
        DRLGOUTANIM_BuildAct5PresetContext113c(m, ADDR_LVL0)
      }
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD91CA0')[k]!
      resetArena(m)
      const lid = k === 0 ? 0x6e : k === 1 ? 0x6f : 0x70
      setupOutdoorsBasic(m, lid, 30, 4, 4)
      if (r.exc !== 0) {
        expect(() => DRLGOUTANIM_BuildAct5Outdoors113c(m, ADDR_LVL0)).toThrow()
      }
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD926A0')[k]!
      resetArena(m)
      setupOutdoorsBasic(m, k === 0 ? 3 : 2, 2, k === 2 ? 2 : 6, k === 2 ? 2 : 6)
      if (k === 0) {
        m.setU32(ADDR_GRID1_CELLS + (2 * 6 + 2) * 4, 0x10)
        m.setU32(ADDR_GRID2_CELLS + (2 * 6 + 2) * 4, 0x400)
      }
      DRLGOUTDOORS_PlaceRandomOutdoorShrineOrSpecial113c(m, ADDR_LVL0)
      let marked = 0
      for (let i = 0; i < 36; i++) if ((m.u32(ADDR_GRID2_CELLS + i * 4) & 0x800) !== 0) marked++
      expect(marked).toBe(r.out[0])
      if (k > 0) expect(m.u32(ADDR_LVL0 + 0x1c4)).toBe(r.out[1])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD92EB0')[k]!
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, k === 0 ? 2 : 6, k === 0 ? 2 : 6)
      m.setU32(ADDR_RECT + 0x00, 110 + k * 10); m.setU32(ADDR_RECT + 0x04, 210)
      m.setU32(ADDR_RECT + 0x08, 16); m.setU32(ADDR_RECT + 0x0c, 16)
      if (r.exc !== 0) {
        expect(() => DRLGOUTDOORS_PlaceClosestOutdoorPresetToRect113c(m, ADDR_LVL0, ADDR_RECT, 5, 0x200, 0, 15)).toThrow()
      }
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD93100')[k]!
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 4, 4)
      const lvl = k === 0 ? 0 : ADDR_LVL0
      vi.spyOn(drlgGridMod, 'DRLGTILESUB_ApplySubThemeByIndex113c').mockImplementation(() => {
        throw new Error('assert')
      })
      if (r.exc !== 0) {
        expect(() => DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, k + 1, 0x10)).toThrow()
      }
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD93190')[k]!
      resetArena(m)
      const lt = [2, 16, 21]
      setupOutdoorsBasic(m, 2, lt[k]!, 4 + k, 4 + k)
      for (let i = 0; i < 36; i++) m.setU32(ADDR_GRID2_CELLS + i * 4, 0x100)
      if (k === 2) m.setU32(ADDR_GRID2_CELLS, 0)
      DRLGOUTDOORS_BuildOutdoorRoomExList113c(m, ADDR_LVL0)
      const headRx = m.u32(ADDR_LVL0 + 0x10)
      expect(headRx !== 0 ? 1 : 0).toBe(r.out[0])
      // 0x6FD932A3..0x6FD932D0: eax = grid1 cell (dwFlags) -> pRoomEx->dwFlags (+0x28)
      expect(headRx !== 0 ? m.u32(headRx + 0x28) : 0).toBe(r.out[1])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD93350')[k]!
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 6, 6)
      // Mirrors k1r13-laneB-it14-emitter.c case 52 (0x6FDE3474 DX / 0x6FDE346C DY neighbour tables).
      if (k !== 1) for (let i = 0; i < 36; i++) m.setU32(ADDR_GRID2_CELLS + i * 4, 0x800)
      if (k === 2) {
        m.setU32(ADDR_GRID2_CELLS + (2 * 6 + 2) * 4, 0x880)
        m.setU32(ADDR_GRID2_CELLS + (2 * 6 + 1) * 4, 0)
      }
      expect(r.exc).toBe(0)
      expect(DRLGOUTDOORS_PlaceRandomOutdoorPresetNearSeed113c(m, ADDR_LVL0, 5 + k, 0x01)).toBe(r.ret)
      expect(m.u32(ADDR_LVL0 + 0x1c4)).toBe(r.out[0])
      expect(m.u32(ADDR_GRID0_CELLS + (2 * 6 + 1) * 4)).toBe(r.out[1])
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD93580')[k]!
      resetArena(m)
      const lid = k === 0 ? 2 : k === 1 ? 41 : 110
      setupOutdoorsBasic(m, lid, k === 0 ? 2 : k === 1 ? 16 : 30, 4, 4)
      if (r.exc !== 0) {
        expect(() => DRLGOUTDOORS_InitOutdoorLevel113c(m, ADDR_LVL0)).toThrow()
      }
    }

    for (let k = 0; k < 3; k++) {
      const r = byVa('0x6FD952C0')[k]!
      resetArena(m)
      m.setU32(ADDR_RX0 + 0x14, ADDR_LVL0); m.setU32(ADDR_RX0 + 0x58, ADDR_LVL0); m.setU32(ADDR_LVL0 + 0x1d0, 77); m.setU32(ADDR_LVL0 + 0x1b4, ADDR_DRLG)
      m.setU32(ADDR_RX0 + 0x28, k === 2 ? 0x10 : 0)
      m.setU32(ADDR_RX0 + 0x34, 10); m.setU32(ADDR_RX0 + 0x38, 10); m.setU32(ADDR_RX0 + 0x3c, 8); m.setU32(ADDR_RX0 + 0x40, 8)
      m.setU32(ADDR_RX1 + 0x34, 18); m.setU32(ADDR_RX1 + 0x38, 10); m.setU32(ADDR_RX1 + 0x3c, 8); m.setU32(ADDR_RX1 + 0x40, 8)
      const list = k === 0 ? 0 : ADDR_RX0
      DRLGROOM_LinkAdjacentWarpRooms113c(m, list, 0, ADDR_RX1, 0, 0, -1)
      expect(m.u32(ADDR_RX1 + 0x2c)).toBe(r.out[0])
    }
  })

  it('AST mutation boundary killers for I14B-3', () => {
    const m = createArenaMem()

    // 1. DUNGEON_FindWarpPortalUnitInTargetLevel113c: skip non-matching classId before matching classId
    {
      resetArena(m)
      const pDummy = m.alloc(0x100) >>> 0; m.fill(pDummy, 0x100, 0)
      m.setU32(ADDR_ROOM0 + 0x10, ADDR_RX0)
      m.setU32(ADDR_RX0 + 0x14, ADDR_LVL0); m.setU32(ADDR_LVL0 + 0x1d0, 77)
      m.setU32(ADDR_RX0 + 0x4c, ADDR_RT0)
      m.setU32(ADDR_RT0 + 0x00, ADDR_RX1); m.setU32(ADDR_RT0 + 0x10, ADDR_LVL1 + 0x1d0)
      m.setU32(ADDR_RX1 + 0x14, ADDR_LVL1); m.setU32(ADDR_LVL1 + 0x1d0, 88)
      m.setU32(ADDR_RX1 + 0x4c, ADDR_RT0 + 0x40)
      m.setU32(ADDR_RT0 + 0x40, ADDR_RX0); m.setU32(ADDR_RT0 + 0x48, ADDR_LVL0 + 0x1d0); m.setU32(ADDR_RT0 + 0x50, ADDR_LVL1 + 0x1d0)
      m.setU32(ADDR_RX1 + 0x30, ADDR_ROOM1)
      m.setU32(ADDR_ROOM1 + 0x74, pDummy)
      m.setU32(pDummy + 0x00, 5); m.setU32(pDummy + 0x04, 999); m.setU32(pDummy + 0xe8, ADDR_UNIT0)
      m.setU32(ADDR_UNIT0 + 0x00, 5); m.setU32(ADDR_UNIT0 + 0x04, 88) // targetLvlId = 88
      expect(DUNGEON_FindWarpPortalUnitInTargetLevel113c(m, ADDR_ROOM0, 88, ADDR_OUT0) >>> 0).toBe(ADDR_UNIT0)
    }

    // 2. DUNGEON_FindFreeSpawnPositionInLevel113c & DUNGEON_FindLevelSpawnRoom113c: non-zero & zero return + mask 0x1c09
    {
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 6, 6)
      m.setU32(ADDR_ACT + 0x48, ADDR_DRLG)
      m.setU32(ADDR_LVL0 + 0x10, ADDR_RX0)
      m.setU32(ADDR_RX0 + 0x28, 0x03130000); m.setU32(ADDR_RX0 + 0x30, 0) // rx.pRoom === 0 -> pRoom === 0 -> returns 0
      vi.spyOn(drlgRoomMod, 'DRLGROOM_EnsureRoomAndGetRoom1_113c').mockImplementation(() => 0)
      expect(DUNGEON_FindFreeSpawnPositionInLevel113c(m, ADDR_ACT, 2, 1, ADDR_OUT0, ADDR_OUT1, 1)).toBe(0)

      m.setU32(ADDR_RX0 + 0x30, ADDR_ROOM0)
      m.setU32(ADDR_RX0 + 0x34, 10); m.setU32(ADDR_RX0 + 0x38, 15)
      m.setU32(ADDR_RX0 + 0x3c, 10); m.setU32(ADDR_RX0 + 0x40, 10) // mid = (15, 20) -> subtile (78, 103)
      m.setU32(ADDR_ROOM0 + 0x4c, 50); m.setU32(ADDR_ROOM0 + 0x50, 50)
      m.setU32(ADDR_ROOM0 + 0x54, 100); m.setU32(ADDR_ROOM0 + 0x58, 100)
      m.setU32(ADDR_ROOM0 + 0x20, ADDR_OUT_COMP)
      m.setU32(ADDR_OUT_COMP + 0x00, 50); m.setU32(ADDR_OUT_COMP + 0x04, 50)
      m.setU32(ADDR_OUT_COMP + 0x08, 100); m.setU32(ADDR_OUT_COMP + 0x0c, 100)
      m.setU32(ADDR_OUT_COMP + 0x10, 50); m.setU32(ADDR_OUT_COMP + 0x14, 50)
      m.setU32(ADDR_OUT_COMP + 0x18, 100); m.setU32(ADDR_OUT_COMP + 0x1c, 100)
      const pMap = m.alloc(24000) >>> 0; m.fill(pMap, 24000, 0)
      m.setU32(ADDR_OUT_COMP + 0x20, pMap); m.setU32(ADDR_OUT_COMP + 0x24, pMap + 20000)
      vi.spyOn(drlgRoomMod, 'DRLGROOM_EnsureRoomAndGetRoom1_113c').mockImplementation(() => 0)
      expect(DUNGEON_FindFreeSpawnPositionInLevel113c(m, ADDR_ACT, 2, 1, ADDR_OUT0, ADDR_OUT1, 1)).toBe(ADDR_ROOM0)
      expect(m.u32(ADDR_OUT0)).toBe(78)
      expect(m.u32(ADDR_OUT1)).toBe(103)
      // Block subtile (78, 103) with flag 0x0001 (in 0x1c09 but NOT in 0x1c08)
      m.setU16(pMap + ((103 - 50) * 100 + (78 - 50)) * 2, 1)
      expect(DUNGEON_FindFreeSpawnPositionInLevel113c(m, ADDR_ACT, 2, 1, ADDR_OUT0, ADDR_OUT1, 1)).toBe(ADDR_ROOM0)
      expect(m.u32(ADDR_OUT0) === 78 && m.u32(ADDR_OUT1) === 103).toBe(false)

      expect(DUNGEON_FindLevelSpawnRoom113c(m, ADDR_ACT, 2, 1, ADDR_OUT0, ADDR_OUT1)).toBe(ADDR_ROOM0)
      expect(m.u32(ADDR_OUT0)).toBe(15)
      expect(m.u32(ADDR_OUT1)).toBe(20)
    }

    // 3. DRLGVER_CollectOutdoorRoomLinks113c: dstId===1 (dir=1 & dir=3), dstId===0x1a, k===6 at x===gw-2, sw===0x30
    {
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 4, 4)
      m.setU32(ADDR_OUTDOORS + 0x264, ADDR_ORTH0)
      m.setU32(ADDR_ORTH0 + 0x00, ADDR_LVL1); m.setU32(ADDR_ORTH0 + 0x04, 1)
      m.setU32(ADDR_LVL1 + 0x1d0, 0x1a) // dstId === 0x1a -> ent+0x08 = 1, count = 1
      m.setU32(ADDR_LVL1 + 0x1c, 200); m.setU32(ADDR_LVL1 + 0x20, 300)
      DRLGVER_CollectOutdoorRoomLinks113c(m, ADDR_LVL0)
      expect(m.u8(ADDR_OUTDOORS + 0x88)).toBe(1)
      expect(m.u32(ADDR_OUTDOORS + 0x260)).toBe(1)

      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 4, 4)
      m.setU32(ADDR_OUTDOORS + 0x264, ADDR_ORTH0)
      m.setU32(ADDR_ORTH0 + 0x00, ADDR_LVL1); m.setU32(ADDR_ORTH0 + 0x04, 3) // dir=3
      m.setU32(ADDR_LVL1 + 0x1d0, 1)
      m.setU32(ADDR_LVL1 + 0x1c, 200); m.setU32(ADDR_LVL1 + 0x20, 300)
      // Set grid0 cell at (x = gw - 2 = 2, y = 1) to c0 = 28 (sw = 24 -> k = 6) with c2Byte = 1, and (1, 2) to c0 = 52 (sw = 0x30 -> k = 8)
      m.setU32(ADDR_GRID0_CELLS + (1 * 4 + 2) * 4, 28)
      m.setU32(ADDR_GRID2_CELLS + (1 * 4 + 2) * 4, 0x010000)
      m.setU32(ADDR_GRID0_CELLS + (2 * 4 + 1) * 4, 52)
      DRLGVER_CollectOutdoorRoomLinks113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_OUTDOORS + 0x80)).toBe(200 + 0x1d)
      expect(m.u32(ADDR_OUTDOORS + 0x84)).toBe(300 + 0x03)
      expect(m.u32(ADDR_OUTDOORS + 0x260)).toBe(3) // orth + (2,1) + (1,2)!
    }

    // 4. DRLGVER_ApplyMazeBorderTiles113c (__stdcall(pRoomEx)): exact border tile code check for mask=79
    //    (kills n8 0->1 & n6 !== -> ===). Real-DLL ground truth: i14b-3 vector 0x6FD8DB20 'mask79_wall' -> 0x2b82.
    {
      resetArena(m)
      m.setU32(ADDR_RX0 + 0x20, ADDR_OUTDOORS)
      m.setU32(ADDR_RX0 + 0x3c, 3); m.setU32(ADDR_RX0 + 0x40, 3)
      m.setU32(ADDR_OUTDOORS + 0x28, ADDR_GRID0_CELLS); m.setU32(ADDR_OUTDOORS + 0x2c, ADDR_GRID0_ROWS)
      m.setU32(ADDR_OUTDOORS + 0x3c, ADDR_MGRID_CELLS); m.setU32(ADDR_OUTDOORS + 0x40, ADDR_MGRID_ROWS)
      for (let r = 0; r < 6; r++) {
        m.setU32(ADDR_GRID0_ROWS + r * 4, r * 6)
        m.setU32(ADDR_MGRID_ROWS + r * 4, r * 6)
      }
      for (let i = 0; i < 36; i++) { m.setU32(ADDR_GRID0_CELLS + i * 4, 0); m.setU32(ADDR_MGRID_CELLS + i * 4, 0) }
      // At (x=1, y=1): n0=(0,2), n1=(0,1), n2=(0,0), n3=(1,2), n4=(1,1), n7=(2,1) -> mask=79 -> code=43 -> 0x2b82
      m.setU32(ADDR_MGRID_CELLS + (2 * 6 + 0) * 4, 1)
      m.setU32(ADDR_MGRID_CELLS + (1 * 6 + 0) * 4, 1)
      m.setU32(ADDR_MGRID_CELLS + (0 * 6 + 0) * 4, 1)
      m.setU32(ADDR_MGRID_CELLS + (2 * 6 + 1) * 4, 1)
      m.setU32(ADDR_MGRID_CELLS + (1 * 6 + 1) * 4, 1)
      m.setU32(ADDR_MGRID_CELLS + (1 * 6 + 2) * 4, 1)
      DRLGVER_ApplyMazeBorderTiles113c(m, ADDR_RX0)
      expect(m.u32(ADDR_GRID0_CELLS + (0 * 6 + 0) * 4)).toBe(0x2b82)
      // maxX = dwWidth + 1 < 1 (jl, not jle) returns before touching the grids
      resetArena(m)
      m.setU32(ADDR_RX0 + 0x20, ADDR_OUTDOORS); m.setU32(ADDR_RX0 + 0x3c, 0xfffffffe)
      expect(() => DRLGVER_ApplyMazeBorderTiles113c(m, ADDR_RX0)).not.toThrow()
    }

    // 4b. DRLGOUTWILD_ResolveOutdoorRoomBridgeTargets113c & DRLGOUTWILD_BuildOutdoorPathsAndEnv113c
    {
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 8, 8)
      m.setU32(ADDR_OUTDOORS + 0x260, 2)
      m.setU32(ADDR_OUTDOORS + 0x80, 100); m.setU32(ADDR_OUTDOORS + 0x84, 200)
      m.setU32(ADDR_OUTDOORS + 0x94, 100); m.setU32(ADDR_OUTDOORS + 0x98, 200) // sumX=0, sumY=0 -> (gx=0, gy=0)
      for (let i = 1; i < 64; i++) m.setU32(ADDR_GRID2_CELLS + i * 4, 0x800)
      DRLGOUTWILD_ResolveOutdoorRoomBridgeTargets113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_OUTDOORS + 0x1e8)).toBe(103) // cx=0 >= 0, cy=0 >= 0 -> 100 + 0 * 8 + 3
      expect(m.u32(ADDR_OUTDOORS + 0x1ec)).toBe(203)

      // All cells blocked -> after r=7, k=3 finishes, cy = gy + 7 = 9 -> 200 + 9 * 8 + 3 = 275 (vs k=4 -> cy = 2 -> 219)
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 8, 8)
      m.setU32(ADDR_OUTDOORS + 0x260, 2)
      m.setU32(ADDR_OUTDOORS + 0x80, 116); m.setU32(ADDR_OUTDOORS + 0x84, 216)
      m.setU32(ADDR_OUTDOORS + 0x94, 132); m.setU32(ADDR_OUTDOORS + 0x98, 216) // (gx=3, gy=2)
      for (let i = 0; i < 64; i++) m.setU32(ADDR_GRID2_CELLS + i * 4, 0x800)
      DRLGOUTWILD_ResolveOutdoorRoomBridgeTargets113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_OUTDOORS + 0x1e8)).toBe(183)

      // outFlags = 0x10 with no bridge preset in grid0 -> fallback sets dst0 from center
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 8, 8)
      m.setU8(ADDR_OUTDOORS, 0x10)
      m.setU32(ADDR_OUTDOORS + 0x260, 1)
      m.setU32(ADDR_OUTDOORS + 0x80, 116); m.setU32(ADDR_OUTDOORS + 0x84, 216)
      DRLGOUTWILD_ResolveOutdoorRoomBridgeTargets113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_OUTDOORS + 0x1e8)).toBe(135) // 100 + 4 * 8 + 3
      expect(m.u32(ADDR_OUTDOORS + 0x1ec)).toBe(235) // 200 + 4 * 8 + 3

      // DRLGOUTWILD_BuildOutdoorPathsAndEnv113c: verify ENVIRONMENT_Init113c called with non-zero pVertexHead at +0x68
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 8, 8)
      m.setU32(ADDR_OUTDOORS + 0x264, ADDR_ORTH0)
      m.setU32(ADDR_ORTH0 + 0x00, ADDR_LVL1); m.setU32(ADDR_ORTH0 + 0x04, 0); m.setU32(ADDR_LVL1 + 0x1d0, 1)
      m.setU32(ADDR_LVL1 + 0x1c, 60); m.setU32(ADDR_LVL1 + 0x20, 200)
      const envArgs: Array<[number, number, number]> = []
      vi.spyOn(envMod, 'ENVIRONMENT_Init113c').mockImplementation((_m, vh, g2, fl) => { envArgs.push([vh, g2, fl]); return 1 })
      DRLGOUTWILD_BuildOutdoorPathsAndEnv113c(m, ADDR_LVL0)
      expect(envArgs.length).toBe(1)
      expect(envArgs[0]![0]).not.toBe(0)
      expect(envArgs[0]![1]).toBe(ADDR_OUTDOORS + 0x2c)
      expect(envArgs[0]![2]).toBe(0x80)
    }

    // 5. DRLGOUTANIM_BuildAct5Outdoors113c & BuildAct5PresetContext113c & InitOutdoorLevel113c
    {
      resetArena(m)
      setupOutdoorsBasic(m, 0x6f, 2, 4, 4)
      m.setU32(ADDR_LVL0 + 0x1d0, 0x6f)
      let presetCtxCalls = 0
      let sawFrigidCorner = false
      vi.spyOn(drlgGridMod, 'DRLGTILESUB_ApplySubThemeByIndex113c').mockImplementation((sm, ctx) => {
        presetCtxCalls++
        expect(sm.u32(ctx + 0x04)).toBe(ADDR_OUTDOORS + 0x54)
        expect(sm.u32(ctx + 0x34)).toBe(0x6fd92a70)
        // 0x6FD91120: 0x380 lands at (gx, gy - 2) = (nWidth - sizeX / 8, nHeight - sizeY / 8 - 2) = (3, 1) on the
        // 4x4 grid with the harness LvlPrest dwSizeX = dwSizeY = 8 (row stride 4 -> cell 1 * 4 + 3).
        if (sm.u32(ADDR_GRID0_CELLS + (1 * 4 + 3) * 4) === 0x380) sawFrigidCorner = true
        for (let i = 0; i < 16; i++) {
          sm.setU32(ADDR_GRID0_CELLS + i * 4, 0x393)
          sm.setU32(ADDR_GRID2_CELLS + i * 4, 0x200)
        }
      })
      DRLGOUTANIM_BuildAct5PresetContext113c(m, ADDR_LVL0)
      expect(presetCtxCalls).toBe(1)

      // 0x6e early return in BuildAct5PresetContext113c and BuildAct5Outdoors113c
      m.setU32(ADDR_LVL0 + 0x1d0, 0x6e)
      DRLGOUTANIM_BuildAct5PresetContext113c(m, ADDR_LVL0)
      expect(presetCtxCalls).toBe(1)
      m.fill(0, 0x50, 0); m.setU32(0x40, 1); m.setU32(m.u32(0x6fde9e1c) + 0xc68, 0x362)
      m.setU32(ADDR_OUTDOORS + 0x5c, 2)
      // 0x6FD91070 steps gx -= LvlPrest[865].dwSizeX / 8 for 15 strips and asserts OutRoom.cpp:0x294 on gx < 0;
      // with the harness default dwSizeX = 8 a 2-wide grid would assert (as the DLL does), so pin dwSizeX < 8.
      m.setU32(ADDR_LVLPREST_TXT + 865 * 0x1b0 + 0x28, 0)
      DRLGOUTANIM_BuildAct5Outdoors113c(m, ADDR_LVL0)
      expect(presetCtxCalls).toBe(1)
      expect(m.u32(ADDR_GRID0_CELLS + (0 * 4 + 2) * 4)).toBe(0x36f)

      // 0x6f and 0x70 full paths in BuildAct5Outdoors113c
      for (const lid5 of [0x6f, 0x70] as const) {
        resetArena(m)
        setupOutdoorsBasic(m, lid5, 2, 4, 4)
        setupGrid(m, ADDR_GRID0_ROWS, 4, 6)
        setupGrid(m, ADDR_GRID2_ROWS, 4, 6)
        m.fill(0, 0x50, 0); m.setU32(0x40, 1); m.setU32(m.u32(0x6fde9e1c) + 0xc68, 0x371)
        m.setU32(0x20030000 + 0x370 * 0x1b0 + 0x40, 1)
        m.setU32(ADDR_OUTDOORS + 0x64, ADDR_ORTH0)
        m.setU32(ADDR_ORTH0 + 0x0c, 2); m.setU32(ADDR_ORTH0 + 0x10, ADDR_ORTH0)
        m.setU32(ADDR_GRID0_CELLS + (0 * 4 + 2) * 4, 0x371)
        m.setU32(ADDR_GRID0_CELLS + (0 * 4 + 0) * 4, 0x374)
        DRLGOUTANIM_BuildAct5Outdoors113c(m, ADDR_LVL0)
      }
      expect(presetCtxCalls).toBe(3)
      expect(sawFrigidCorner).toBe(true)

      // 0x6FDCF3A0 (Act 1 init) lives in outdoors.ts with its caller, so observe its first cross-module callee
      // 0x6FD67180 (SpawnOutdoorBorderPresets) instead; the Act 2/3/4/5 paths below never reach it directly.
      const initWildSpy = vi.spyOn(drlgRoomMod, 'DRLGROOM_SpawnOutdoorBorderPresets113c').mockImplementation(() => {})
      const initAct2Spy = vi.spyOn(outJungMod, 'DRLGOUTJUNG_InitAct2OutdoorLevel113c').mockImplementation(() => {})
      const initAct4Spy = vi.spyOn(outJungMod, 'DRLGOUTJUNG_InitAct4OutdoorLevel113c').mockImplementation(() => {})
      const act1Spy = vi.spyOn(outJungMod, 'DRLGOUTJUNG_SpawnAct3CityPresetsByLevel113c').mockImplementation(() => {})

      for (const [lid, spy] of [
        [2, initWildSpy],
        [41, initAct2Spy],
        [75, act1Spy],
        [104, initAct4Spy],
        [0x86, initAct2Spy],
      ] as const) {
        resetArena(m)
        setupOutdoorsBasic(m, lid, 2, 4, 4)
        m.setU32(ADDR_LVL0 + 0x24, 32); m.setU32(ADDR_LVL0 + 0x28, 32)
        m.setU32(ADDR_LVL0 + 0x1d0, lid)
        m.setU32(ADDR_OUTDOORS + 0x58, 0xdeadbeef)
        spy.mockClear()
        try { DRLGOUTDOORS_InitOutdoorLevel113c(m, ADDR_LVL0) } catch {}
        expect(m.u32(ADDR_OUTDOORS + 0x58)).toBe(0)
        expect(spy.mock.calls.length).toBe(1)
      }
      // Act 5 (lid = 0x6e -> i = 5, actIdx = 4): must NOT call initWildSpy
      resetArena(m)
      setupOutdoorsBasic(m, 0x6e, 2, 4, 4)
      m.setU32(ADDR_LVL0 + 0x24, 32); m.setU32(ADDR_LVL0 + 0x28, 32)
      initWildSpy.mockClear()
      try { DRLGOUTDOORS_InitOutdoorLevel113c(m, ADDR_LVL0) } catch {}
      expect(initWildSpy.mock.calls.length).toBe(0)
    }

    // 6. DRLGOUTDOORS_PlaceRandomOutdoorShrineOrSpecial113c & PlaceClosestOutdoorPresetToRect113c & PlaceRandomOutdoorPresetNearSeed113c
    {
      resetArena(m)
      setupOutdoorsBasic(m, 3, 2, 6, 6)
      m.setU32(ADDR_LEVEL_DEFS + 3 * 0x9c + 0x48 + 1 * 4, 2)
      m.setU32(ADDR_GRID1_CELLS, 0x20)
      m.setU32(ADDR_GRID2_CELLS, 0x400)
      m.setU32(ADDR_LVL0 + 0x1c4, 0)
      DRLGOUTDOORS_PlaceRandomOutdoorShrineOrSpecial113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_GRID1_CELLS + (1 * 6 + 1) * 4) & 0x20000).toBe(0x20000)
      expect(m.u32(ADDR_GRID2_CELLS + (1 * 6 + 1) * 4) & 0x800).toBe(0x800)

      // x = gw - 1 = 5, y = gh - 1 = 5 clamped to (4, 4); out-of-bounds cell 36 (y=5, x=6) must NOT be visited
      resetArena(m)
      setupOutdoorsBasic(m, 3, 2, 2, 2)
      m.setU32(ADDR_LEVEL_DEFS + 3 * 0x9c + 0x48 + 1 * 4, 2)
      m.setU32(ADDR_GRID1_CELLS + 4 * 4, 0x20)
      m.setU32(ADDR_GRID2_CELLS + 4 * 4, 0x400)
      m.setU32(ADDR_LVL0 + 0x1c4, 0)
      DRLGOUTDOORS_PlaceRandomOutdoorShrineOrSpecial113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_GRID1_CELLS + 2 * 4) & 0x20000).toBe(0)

      resetArena(m)
      setupOutdoorsBasic(m, 3, 2, 6, 6)
      m.setU32(ADDR_LEVEL_DEFS + 3 * 0x9c + 0x48 + 1 * 4, 2)
      m.setU32(ADDR_GRID1_CELLS + (5 * 6 + 5) * 4, 0x20)
      m.setU32(ADDR_GRID2_CELLS + (5 * 6 + 5) * 4, 0x400)
      m.setU32(ADDR_LVL0 + 0x1c4, 0)
      DRLGOUTDOORS_PlaceRandomOutdoorShrineOrSpecial113c(m, ADDR_LVL0)
      expect(m.u32(ADDR_GRID1_CELLS + (4 * 6 + 4) * 4) & 0x20000).toBe(0x20000)
      expect(m.u32(ADDR_GRID2_CELLS + (4 * 6 + 4) * 4) & 0x800).toBe(0x800)

      // PlaceClosestOutdoorPresetToRect113c: all blocked -> returns 0; unblocked -> returns 1 and writes preset at exact best (bestX, bestY)
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 12, 12)
      m.setU32(ADDR_OUTDOORS + 0x34, 12); m.setU32(ADDR_OUTDOORS + 0x38, 12)
      m.fill(0, 0x50, 0); m.setU32(0x28, 8); m.setU32(0x2c, 8); m.setU32(0x40, 1); m.setU32(m.u32(0x6fde9e1c) + 0xc68, 0)
      m.setU32(ADDR_RECT + 0x00, 136); m.setU32(ADDR_RECT + 0x04, 228); m.setU32(ADDR_RECT + 0x08, 8); m.setU32(ADDR_RECT + 0x0c, 8)
      // centerX = 140, centerY = 232; lx = 100, ly = 200
      for (let i = 0; i < 144; i++) m.setU32(ADDR_GRID2_CELLS + i * 4, 0x800)
      expect(DRLGOUTDOORS_PlaceClosestOutdoorPresetToRect113c(m, ADDR_LVL0, ADDR_RECT, 5, 0x200, 0, 15)).toBe(0)
      // Candidate 1 at (gx=1, gy=1): dx=28 > dy=20 -> d = (20 + 56) >> 1 = 38 (visited first -> wins tie)
      // Candidate 2 at (gx=9, gy=3): dx=36 > dy=4 -> d = (4 + 72) >> 1 = 38 (overtakes if dx*3 -> 56>52, or if centerX=132 -> dx2=44 -> 46>30)
      m.setU32(ADDR_GRID2_CELLS + (1 * 12 + 1) * 4, 0)
      m.setU32(ADDR_GRID2_CELLS + (3 * 12 + 9) * 4, 0)
      m.setU32(ADDR_LVL0 + 0x1c4, 0); m.setU32(ADDR_LVL0 + 0x1c8, 0)
      expect(DRLGOUTDOORS_PlaceClosestOutdoorPresetToRect113c(m, ADDR_LVL0, ADDR_RECT, 5, 0x200, 0, 15)).toBe(1)
      expect(m.u32(ADDR_GRID0_CELLS + (1 * 12 + 1) * 4)).toBe(5)

      // PlaceRandomOutdoorPresetNearSeed113c: 0x80 at (2, 2) spawns at d=0 (nx = 2 + dX[0x6FDE3474] = 1, ny = 2 + dY[0x6FDE346C] = 2),
      // matching the real-DLL i14b-3 vector 0x6FD93350 'seed_d0_west' (0x6FD934E0..0x6FD93503).
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 6, 6)
      m.setU32(ADDR_OUTDOORS + 0x34, 6); m.setU32(ADDR_OUTDOORS + 0x38, 6)
      m.fill(0, 0x50, 0); m.setU32(0x28, 8); m.setU32(0x2c, 8); m.setU32(0x40, 1); m.setU32(m.u32(0x6fde9e1c) + 0xc68, 0)
      m.setU32(ADDR_GRID2_CELLS + (2 * 6 + 2) * 4, 0x80)
      expect(DRLGOUTDOORS_PlaceRandomOutdoorPresetNearSeed113c(m, ADDR_LVL0, 7, 0x200)).toBe(1)
      expect(m.u32(ADDR_GRID0_CELLS + (2 * 6 + 1) * 4)).toBe(7)
    }

    // 7. DRLGOUTDOORS_BuildOutdoorSubstContext113c & DRLGOUTDOORS_BuildOutdoorRoomExList113c
    {
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 4, 4)
      let substCalls = 0
      vi.spyOn(drlgGridMod, 'DRLGTILESUB_ApplySubThemeByIndex113c').mockImplementation((sm, ctx) => {
        expect(sm.u32(ctx + 0x10)).toBe(0x10)
        expect(sm.u32(ctx + 0x18)).toBe(3)
        expect(sm.u32(ctx + 0x1c)).toBe(0x6fd92270)
        expect(sm.u32(ctx + 0x20)).toBe(0x6fd92370)
        expect(sm.u32(ctx + 0x24)).toBe(0)
        sm.setU32(ctx + 0x24, 0xdeadbeef)
        substCalls++
      })
      DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, ADDR_LVL0, 3, 0x10)
      DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, ADDR_LVL0, 3, 0x10)
      expect(substCalls).toBe(2)

      // BuildOutdoorRoomExList113c: sw===0 (levelType=2 -> 0x44103), sw===3 (levelType=30 -> 0x11), & (c2 & 0x200) !== 0
      resetArena(m)
      setupOutdoorsBasic(m, 2, 2, 4, 4)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x38, 0xffffffff)
      DRLGOUTDOORS_BuildOutdoorRoomExList113c(m, ADDR_LVL0)
      // roomFlags (switch 0x6FD93330) is the 7th stack arg of 0x6FD9A5C0 (dwDT1Mask -> pRoomEx+0x50);
      // eax = grid1 cell -> dwFlags (+0x28), confirmed by i14b-3 vector 0x6FD93190 'lt21'.
      expect(m.u32(m.u32(ADDR_LVL0 + 0x10) + 0x50)).toBe(0x44103)

      resetArena(m)
      setupOutdoorsBasic(m, 2, 30, 4, 4) // rel = 28 -> sw = 3 -> roomFlags = 0x11
      m.setU32(ADDR_LVL0 + 0x20, 333)
      m.setU32(ADDR_LEVEL_DEFS + 2 * 0x9c + 0x38, 0xffffffff)
      m.setU32(ADDR_GRID0_CELLS, 5)
      m.setU32(ADDR_GRID2_CELLS, 0x00070200) // (c2 >>> 16) & 0x0f = 7
      vi.spyOn(presetMod, 'DRLGPRESET_BuildPresetRoomsFromMap113c').mockImplementation(() => 0)
      DRLGOUTDOORS_BuildOutdoorRoomExList113c(m, ADDR_LVL0)
      const pMap = m.u32(ADDR_LVL0 + 0x1b0)
      expect(m.u32(pMap + 0x04)).toBe(7)
      expect(m.u32(pMap + 0x14)).toBe(333)
      expect(m.u32(m.u32(ADDR_LVL0 + 0x10) + 0x50)).toBe(0x11)
    }

    // 8. DRLGROOM_LinkAdjacentWarpRooms113c: tx === cx, ty === cy, dx === 5 (< 6 vs <= 6)
    {
      resetArena(m)
      m.setU32(ADDR_RX0 + 0x14, ADDR_LVL0); m.setU32(ADDR_RX0 + 0x58, ADDR_LVL0); m.setU32(ADDR_LVL0 + 0x1d0, 77); m.setU32(ADDR_LVL0 + 0x1b4, ADDR_DRLG)
      m.setU32(ADDR_RX0 + 0x28, 0x10)
      m.setU32(ADDR_RX0 + 0x34, 10); m.setU32(ADDR_RX0 + 0x38, 10); m.setU32(ADDR_RX0 + 0x3c, 5); m.setU32(ADDR_RX0 + 0x40, 5)
      m.setU32(ADDR_RX1 + 0x34, 21); m.setU32(ADDR_RX1 + 0x38, 10); m.setU32(ADDR_RX1 + 0x3c, 5); m.setU32(ADDR_RX1 + 0x40, 5)
      DRLGROOM_LinkAdjacentWarpRooms113c(m, ADDR_RX0, 0, ADDR_RX1, 0, 0, -1)
      expect(m.u32(ADDR_RX1 + 0x2c)).toBe(0) // dx = 21 - 5 - 10 = 6 (NOT < 6!)
      m.setU32(ADDR_RX1 + 0x34, 20) // dx = 5 (< 6!)
      DRLGROOM_LinkAdjacentWarpRooms113c(m, ADDR_RX0, 0, ADDR_RX1, 0, 0, -1)
      expect(m.u32(ADDR_RX1 + 0x2c)).toBe(1)

      // tx === cx (10 === 10) with target.w = -10 (0xfffffff6) so tx < cx gives dx = -5 < 6, while tx <= cx gives dx = 10 >= 6
      m.setU32(ADDR_RX1 + 0x2c, 0); m.setU32(ADDR_RX1 + 0x08, 0)
      m.setU32(ADDR_RX1 + 0x34, 10); m.setU32(ADDR_RX1 + 0x3c, 0xfffffff6)
      expect(DRLGROOM_LinkAdjacentWarpRooms113c(m, ADDR_RX0, 0, ADDR_RX1, 0, 0, -1)).toBe(1)
    }
  })
})
