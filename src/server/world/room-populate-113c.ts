/**
 * Diablo II v1.13c per-room DRLG activation, preset & procedural object/monster population, and
 * distant-room hibernation (`D2Game.dll` `0x6FC4CBE0` -> `0x6FD01430`, `0x6FC4CB60`, `0x6FCEAB30`,
 * `0x6FC4F1C3`, `0x6FD0F7A0`).
 */

import { DRLG_AllocDrlg } from '../../common/drlg/drlg-drlg.ts'
import { sub_6FD77110 } from '../../common/drlg/drlg-logic.ts'
import { DRLGPRESET_SpawnHardcodedPresetUnits } from '../../common/drlg/drlg-preset.ts'
import { sub_6FD77BB0 } from '../../common/drlg/drlg-room.ts'
import {
  DRLGROOMTILE_AddRoomMapTiles,
  DRLGROOMTILE_InitRoomGrids,
  DRLGROOMTILE_LoadDT1FilesForRoom,
} from '../../common/drlg/drlg-roomtile.ts'
import { DATATBLS_GetLevelDefRecord, objectSubClass } from '../../common/drlg/drlg-tables.ts'
import {
  DRLGROOMFLAG_HAS_ROOM,
  DRLGROOMFLAG_HAS_WARP_0,
  DRLGROOMFLAG_HAS_WARP_MASK,
  DRLGROOMFLAG_HAS_WAYPOINT_MASK,
  DRLGROOMFLAG_PRESET_UNITS_ADDED,
  DRLGROOMFLAG_ROOM_FREED_SRV,
  DRLGROOMFLAG_TILELIB_LOADED,
  DRLGTYPE_PRESET,
  type D2DrlgCoordStrc,
  type D2DrlgLevelStrc,
  type D2DrlgRoomStrc,
  type D2DrlgStrc,
  type DrlgEnv,
} from '../../common/drlg/drlg-types.ts'
import { DRLGWARP_GetWarpDestinationFromArray } from '../../common/drlg/drlg-warp.ts'
import {
  D2SEED_AdvanceInline,
  SEED_InitLowSeed,
  SEED_InitSeed,
  SEED_RollLimitedRandomNumber,
  SEED_RollRandomNumber,
  newD2Seed,
  type D2SeedStrc,
} from '../../common/rng/d2-rng.ts'
import {
  MONSTATS_113C_ROWS,
  getCanonicalMonsterKinds,
  getSuperUniqueByIndex,
} from '../../common/units/monsters-data.ts'
import { getTownNpcDescriptorByHcIdx } from '../../common/units/npc-table.ts'
import {
  pickTileInfoRecord,
  type ActSpawnTileInfo,
} from '../../common/world/act-spawn-location.ts'
import {
  INIT_FN_3_LOCKABLE_CLASS_IDS_113C,
  SHRINES_BY_EFFECT_CLASS_113C,
} from '../../common/world/object-operate-113c.ts'
import {
  CANONICAL_113C_SHRINES,
  WAYPOINT_CLASS_IDS_113C,
} from '../../common/world/objects-meta.ts'
import type { LocalAreaPresetMonster } from '../../netproto/index.ts'
import { UNIT_TYPE_113C } from '../engine/game-instance/constants-and-helpers.ts'
import type { GameInstanceHost } from '../engine/game-instance/host.ts'
import type { InternalMonsterRecord, InternalWarpTileRecord } from '../engine/game-instance/types.ts'
import {
  preRollMonsterOutfits113c,
  rollLimitedSeed113c,
  type ActMonsterOutfitPalette113c,
} from '../engine/game-instance/unit-seeds-113c.ts'
import { resolveMonPlacePreset113c } from '../../common/units/monai-113c.ts'
import {
  resolvePresetObject113c,
  resolvePresetPortalDestArea113c,
  TOWN_AREA_IDS_113C,
} from './area-bootstrap.ts'
import {
  LEVEL_MON_REGION_113C,
  MONSTATS_SPAWN_META_113C,
  OBJECT_POPULATE_META_113C,
} from './level-mon-region-113c.ts'
import { LEVEL_OBJGRP_113C, OBJGROUP_TXT_113C } from './objgroup-data-113c.ts'

const ACT_SPAWN_LEVEL_IDS_113C: readonly [number, number, number, number, number] = [
  1, 40, 75, 103, 109,
]

const SERVER_ONLY_NPC_SPAWNER_OBJECT_IDS_113C: ReadonlySet<number> = new Set<number>([
  382, 385, 459, 461, 462, 542, 543,
])

const OBJECT_INITFN_ANCHOR_CLASS_IDS_113C: ReadonlySet<number> = new Set<number>([
  121, 122, 378, 379, 382, 385, 459, 461, 462, 542, 543,
])

interface LevelMonRegionRuntime113c {
  readonly den: number
  readonly monLvl: number
  readonly minWarpDistSq: number
  readonly entries: readonly {
    readonly hcIdx: number
    readonly rarity: number
    readonly outfits: readonly (readonly number[])[]
  }[]
  readonly totalRarity: number
  readonly outfitPalette: ActMonsterOutfitPalette113c
  nRoomsPopulated: number
  nShrinesSpawned: number
}

interface SimRoomState113c {
  readonly key: string
  readonly areaId: number
  readonly index: number
  readonly subX: number
  readonly subY: number
  readonly subW: number
  readonly subH: number
  readonly flags: number
  readonly seed: D2SeedStrc
  readonly pRoom: D2DrlgRoomStrc
  active: boolean
  populated: boolean
  hasClientNear: boolean
  inactiveTicks: number
  savedMonsters: InternalMonsterRecord[]
}

export class DrlgRoomPopulator113c {
  private readonly drlgEnv: DrlgEnv
  private readonly mapSeed: number
  private readonly difficulty: 0 | 1 | 2
  private readonly isExpansion: boolean
  private readonly monCtrlSeed: D2SeedStrc = newD2Seed()
  private readonly objCtrlSeed: D2SeedStrc = newD2Seed()
  private readonly pDrlgByAct = new Map<number, D2DrlgStrc>()
  private readonly simByPRoom = new Map<D2DrlgRoomStrc, SimRoomState113c>()
  private readonly levelMonTable = new Map<number, LevelMonRegionRuntime113c>()
  /** Per-room ring of the last 4 monsters that entered DT (`#10873`, room `+0x38[4]`, index byte `+0x14`). */
  private readonly deathRing113c = new Map<D2DrlgRoomStrc, { readonly ids: number[]; idx: number }>()
  private readonly activeRooms: SimRoomState113c[] = []
  private hasPending = false

  constructor(params: {
    readonly drlgEnv: DrlgEnv
    readonly mapSeed: number
    readonly difficulty: 0 | 1 | 2
    readonly monCtrlInit: number
    readonly objCtrlInit: number
    readonly isExpansion?: boolean | undefined
  }) {
    this.drlgEnv = params.drlgEnv
    this.mapSeed = params.mapSeed >>> 0
    this.difficulty = params.difficulty
    this.isExpansion = params.isExpansion ?? true

    SEED_InitSeed(this.monCtrlSeed)
    SEED_InitLowSeed(this.monCtrlSeed, params.monCtrlInit >>> 0)

    SEED_InitSeed(this.objCtrlSeed)
    SEED_InitLowSeed(this.objCtrlSeed, params.objCtrlInit >>> 0)

    this.initLevelMonRegions113c()
  }

  /** Returns the per-level `D2MonRegStrc` outfit palette (`0x6FCEA5F0`). */
  getLevelOutfitPalette(areaId: number): ActMonsterOutfitPalette113c | undefined {
    return this.levelMonTable.get(areaId)?.outfitPalette
  }

  private getOrCreateActDrlg(act: number): D2DrlgStrc {
    const clampedAct = Math.max(0, Math.min(4, act | 0))
    const existing = this.pDrlgByAct.get(clampedAct)
    if (existing) return existing
    const townLevelId = ACT_SPAWN_LEVEL_IDS_113C[clampedAct] ?? 1
    const created = DRLG_AllocDrlg(
      this.drlgEnv,
      clampedAct,
      this.mapSeed,
      townLevelId,
      0,
      0,
    )
    this.pDrlgByAct.set(clampedAct, created)
    return created
  }

  /**
   * `MONREG_InitAllLevels` (`D2Game.dll` `0x6FCEAB30` -> `0x6FCEA760` + `0x6FCFF1A0`):
   * pre-samples each level's `numMon` monster species and pre-rolls their component outfits on
   * `monCtrlSeed` (`draws4[0]`).
   */
  private initLevelMonRegions113c(): void {
    const d = this.difficulty
    for (let lid = 1; lid < LEVEL_MON_REGION_113C.length; lid++) {
      const spec = LEVEL_MON_REGION_113C[lid]
      const outfitPalette: ActMonsterOutfitPalette113c = { byHcIdx: new Map() }
      if (!spec) continue
      const monLvl = spec.monLvlEx[d] ?? 0
      const den = spec.monDen[d] ?? 0
      const minWarpDistSq = spec.minWarpDistSq
      const rangedSpawn = spec.rangedSpawn
      const pool = [...(d > 0 ? spec.nmonPool : spec.monPool)]
      const numMon = Math.min(13, spec.numMon, pool.length)
      const entries: {
        hcIdx: number
        rarity: number
        outfits: number[][]
      }[] = []
      let totalRarity = 0

      for (let s = 0; s < numMon && pool.length > 0; s++) {
        let idx = rollLimitedSeed113c(this.monCtrlSeed, pool.length)
        let hc = pool[idx]!
        if (s === 0 && rangedSpawn !== 0) {
          // 0x6FCEA840..0x6FCEAA81: `add ecx, 5; cmp ecx, 0x14; jl` -> up to 4 retries after initial roll
          for (let tries = 0; tries < 4; tries++) {
            const meta = MONSTATS_SPAWN_META_113C[hc]
            if (meta && meta[1] !== 0) break
            idx = rollLimitedSeed113c(this.monCtrlSeed, pool.length)
            hc = pool[idx]!
          }
        }
        pool.splice(idx, 1)
        const meta = MONSTATS_SPAWN_META_113C[hc]
        if (meta && meta[0] !== 0) {
          const rarity = meta[2]
          entries.push({ hcIdx: hc, rarity, outfits: [] })
          totalRarity += rarity
        }
      }

      for (const ent of entries) {
        ent.outfits = preRollMonsterOutfits113c(this.monCtrlSeed, ent.hcIdx)
        if (!outfitPalette.byHcIdx.has(ent.hcIdx)) {
          outfitPalette.byHcIdx.set(ent.hcIdx, ent.outfits)
        }
      }

      this.levelMonTable.set(lid, {
        den,
        monLvl,
        minWarpDistSq,
        entries,
        totalRarity,
        outfitPalette,
        nRoomsPopulated: 0,
        nShrinesSpawned: 0,
      })
    }
  }

  private findPRoomAt(act: number, px: number, py: number): D2DrlgRoomStrc | null {
    const pDrlg = this.getOrCreateActDrlg(act)
    for (let l = pDrlg.pLevel; l; l = l.pNextLevel) {
      if (!l.pFirstRoomEx) continue
      for (let r: D2DrlgRoomStrc | null = l.pFirstRoomEx; r; r = r.pDrlgRoomNext) {
        const sx = r.pDrlgCoord.nPosX * 5
        const sy = r.pDrlgCoord.nPosY * 5
        const sw = r.pDrlgCoord.nWidth * 5
        const sh = r.pDrlgCoord.nHeight * 5
        if (px >= sx && px < sx + sw && py >= sy && py < sy + sh) {
          return r
        }
      }
    }
    return null
  }

  /**
   * D2Common `#10873` (`0x6FD8AFD0`), called from the monster death mode start (`0x6FC96302`) with the
   * unit's room: stores the unit id at `room+0x38[idx]` and advances `idx = (idx + 1) & 3`.
   */
  recordMonsterDeath113c(act: number, x: number, y: number, unitId: number): void {
    const pRoom = this.findPRoomAt(act, x, y)
    if (pRoom === null) throw new Error(`recordMonsterDeath113c: no room at ${x},${y}`)
    let ring = this.deathRing113c.get(pRoom)
    if (ring === undefined) {
      ring = { ids: [0, 0, 0, 0], idx: 0 }
      this.deathRing113c.set(pRoom, ring)
    }
    ring.ids[ring.idx] = unitId
    ring.idx = (ring.idx + 1) & 3
  }

  /**
   * Unit ids in the death rings of the room at `(x, y)` and its near rooms (`0x6FC2A55C` adjacent room
   * list, walked by `AiFallen` `0x6FCA31B4..0x6FCA3285`), room by room, slots 0..3.
   */
  recentDeathIdsNear113c(act: number, x: number, y: number): number[] {
    const pRoom = this.findPRoomAt(act, x, y)
    if (pRoom === null) throw new Error(`recentDeathIdsNear113c: no room at ${x},${y}`)
    const rooms = pRoom.ppRoomsNear.includes(pRoom) ? pRoom.ppRoomsNear : [pRoom, ...pRoom.ppRoomsNear]
    const out: number[] = []
    for (const r of rooms) {
      const ring = this.deathRing113c.get(r)
      if (ring === undefined) continue
      for (const id of ring.ids) if (id !== 0) out.push(id)
    }
    return out
  }

  private ensureSimRoom(host: GameInstanceHost, pRoom: D2DrlgRoomStrc): SimRoomState113c {
    const existing = this.simByPRoom.get(pRoom)
    if (existing) {
      if (!(pRoom.dwFlags & DRLGROOMFLAG_HAS_ROOM)) {
        DRLGROOMTILE_InitRoomGrids(pRoom)
        DRLGROOMTILE_AddRoomMapTiles(pRoom)
        pRoom.dwFlags = (pRoom.dwFlags | DRLGROOMFLAG_HAS_ROOM) >>> 0
        const reinitSeed = SEED_RollRandomNumber(pRoom.pSeed) >>> 0
        SEED_InitSeed(existing.seed)
        SEED_InitLowSeed(existing.seed, reinitSeed)
      }
      return existing
    }

    const areaId = pRoom.pLevel.nLevelId
    host.ensureAreaLoaded(areaId)

    if (!(pRoom.dwFlags & DRLGROOMFLAG_TILELIB_LOADED)) {
      DRLGROOMTILE_LoadDT1FilesForRoom(pRoom)
    }
    if (!(pRoom.dwFlags & DRLGROOMFLAG_PRESET_UNITS_ADDED) && pRoom.nType === DRLGTYPE_PRESET) {
      DRLGPRESET_SpawnHardcodedPresetUnits(pRoom)
    }
    if (!pRoom.nRoomsNear) {
      sub_6FD77BB0(pRoom)
    }
    if (!(pRoom.dwFlags & DRLGROOMFLAG_HAS_ROOM)) {
      DRLGROOMTILE_InitRoomGrids(pRoom)
      DRLGROOMTILE_AddRoomMapTiles(pRoom)
      pRoom.dwFlags = (pRoom.dwFlags | DRLGROOMFLAG_HAS_ROOM) >>> 0
    }

    const initSeed = SEED_RollRandomNumber(pRoom.pSeed) >>> 0
    const seed = newD2Seed()
    SEED_InitSeed(seed)
    SEED_InitLowSeed(seed, initSeed)

    let idx = 0
    for (let r = pRoom.pLevel.pFirstRoomEx; r && r !== pRoom; r = r.pDrlgRoomNext) {
      idx++
    }

    const sr: SimRoomState113c = {
      key: `${areaId}:${idx}`,
      areaId,
      index: idx,
      subX: pRoom.pDrlgCoord.nPosX * 5,
      subY: pRoom.pDrlgCoord.nPosY * 5,
      subW: pRoom.pDrlgCoord.nWidth * 5,
      subH: pRoom.pDrlgCoord.nHeight * 5,
      flags: pRoom.dwFlags >>> 0,
      seed,
      pRoom,
      active: false,
      populated: false,
      hasClientNear: false,
      inactiveTicks: 0,
      savedMonsters: [],
    }
    this.simByPRoom.set(pRoom, sr)
    return sr
  }

  /**
   * Ensures a `D2RoomStrc` (`pRoom1`) is active on `pAct->pRoom` (`D2Common.dll` `0x6FDCC270` ->
   * `0x6FD7E1F0` -> `0x6FD8C720`), without marking a nearby client (`hasClientNear`).
   */
  private ensureRoom1Active113c(host: GameInstanceHost, pRoom: D2DrlgRoomStrc): SimRoomState113c {
    const sr = this.ensureSimRoom(host, pRoom)
    if (!sr.active) {
      sr.active = true
      sr.inactiveTicks = 0
      this.activeRooms.unshift(sr)
      if (sr.savedMonsters.length > 0) {
        const restored = sr.savedMonsters
        sr.savedMonsters = []
        for (const mon of restored) {
          host.monsters.set(mon.unitId, mon)
          host.areaPathWorld.spawnMonster(mon.areaId, mon, host.currentFrame)
          if (mon.aiAwake && !mon.isNpc && mon.mode === 1) {
            mon.nextAiFrame = host.currentFrame + 2
          }
        }
      }
      this.hasPending = true
    }
    return sr
  }

  /**
   * Activates the player's current room and its `ppRoomsNear` neighbors in 1.13c head-inserted
   * order (`0x6FC4CBE0`), restoring any hibernated monsters.
   */
  activateNear(host: GameInstanceHost, act: number, px: number, py: number): void {
    const pCenter = this.findPRoomAt(act, Math.floor(px), Math.floor(py))
    if (!pCenter) return
    const c = this.ensureSimRoom(host, pCenter)
    const order: SimRoomState113c[] = [c]
    for (let i = 0; i < pCenter.nRoomsNear; i++) {
      const nr = pCenter.ppRoomsNear[i]
      if (!nr) continue
      const n = this.ensureSimRoom(host, nr)
      if (n !== c) order.push(n)
    }
    for (const sr of order) {
      sr.inactiveTicks = 0
      if (host.currentFrame === 0) {
        sr.hasClientNear = true
      }
      if (!sr.active) {
        this.ensureRoom1Active113c(host, sr.pRoom)
      }
    }
  }

  /**
   * Per-frame client room membership update (`D2Game.dll` `0x6FCBD850` / `0x6FCBD5B0`):
   * - `hasClientNear: true -> false` (`SUB_RemoveClientFromRoom` `0x6FCBD980` -> `0x6FCBD8E0`):
   *   deletes pending `EVENTTYPE_MONAI` (`event 2`) on all monsters in the room while preserving
   *   active `EVENTTYPE_MONWALK` (`mode == 2`).
   * - `hasClientNear: false -> true` on an already-populated room (`SUB_AddClientToRoom`
   *   `0x6FCBD950` -> `0x6FCCF920`): schedules `EVENTTYPE_MONAI` at `currentFrame + 2` for
   *   neutral (`mode == 1`) monsters.
   */
  syncClientRoomPresence(host: GameInstanceHost): void {
    const nearSet = new Set<SimRoomState113c>()
    for (const player of host.players.values()) {
      const pCenter = this.findPRoomAt(player.act, Math.round(player.x), Math.round(player.y))
      if (!pCenter) continue
      const c = this.simByPRoom.get(pCenter)
      if (c) nearSet.add(c)
      for (let i = 0; i < pCenter.nRoomsNear; i++) {
        const nr = pCenter.ppRoomsNear[i]
        if (!nr) continue
        const n = this.simByPRoom.get(nr)
        if (n) nearSet.add(n)
      }
    }

    for (const sr of this.activeRooms) {
      if (nearSet.has(sr)) {
        sr.inactiveTicks = 0
        if (sr.populated && !sr.hasClientNear) {
          sr.hasClientNear = true
          for (const mon of host.monsters.values()) {
            if (mon.areaId !== sr.areaId || mon.dead) continue
            const mx = Math.round(mon.x)
            const my = Math.round(mon.y)
            if (mx < sr.subX || mx >= sr.subX + sr.subW || my < sr.subY || my >= sr.subY + sr.subH) {
              continue
            }
            if (mon.mode === 1) {
              if (mon.townNpcAiEnabled) {
                host.areaPathWorld.setTownNpcNextAiFrame(mon.areaId, mon.unitId, host.currentFrame + 2)
              } else if (mon.aiAwake && !mon.isNpc) {
                mon.nextAiFrame = host.currentFrame + 2
              }
            }
          }
        }
      } else if (sr.hasClientNear) {
        sr.hasClientNear = false
        for (const mon of host.monsters.values()) {
          if (mon.areaId !== sr.areaId || mon.dead) continue
          const mx = Math.round(mon.x)
          const my = Math.round(mon.y)
          if (mx < sr.subX || mx >= sr.subX + sr.subW || my < sr.subY || my >= sr.subY + sr.subH) {
            continue
          }
          if (mon.townNpcAiEnabled) {
            host.areaPathWorld.setTownNpcNextAiFrame(mon.areaId, mon.unitId, Infinity)
          } else if (!mon.isNpc) {
            mon.nextAiFrame = Infinity
          }
        }
      }
    }
  }

  /**
   * Retained as no-op (`0x6FC4E11E` -> `0x6FC2B2F4` is `DUNGEON_UpdateAct` `0x6FD8C800`, whereas
   * per-room `inactiveTicks` increments inside `deactivateDistantRooms` via `D2Common #10409`
   * `0x6FD8B350` every 12 frames).
   */
  incrementInactiveRoomFrames(): void {}

  /**
   * 12-frame distant-room hibernation sweep (`D2Game.dll` `0x6FC4E106` -> `0x6FC4CF30` ->
   * `D2Common #10409` `0x6FD8B350` & `DUNGEON_RemoveRoomData` `0x6FD8CA20` ->
   * `DRLGROOMTILE_FreeRoom` `0x6FDB88B0`):
   * increments `inactiveTicks` on active rooms without nearby clients and unloads rooms once
   * `inactiveTicks > 10`, clearing `DRLGROOMFLAG_HAS_ROOM` and `pTileGrid` while preserving
   * `pPresetUnits` and `populated`.
   */
  deactivateDistantRooms(host: GameInstanceHost): void {
    for (let i = this.activeRooms.length - 1; i >= 0; i--) {
      const sr = this.activeRooms[i]!
      if (sr.hasClientNear) {
        sr.inactiveTicks = 0
        continue
      }
      sr.inactiveTicks += 1
      if (sr.inactiveTicks <= 10) continue

      sr.active = false
      sr.inactiveTicks = 0
      sr.pRoom.pTileGrid = null
      for (let rt = sr.pRoom.pRoomTiles; rt; rt = rt.pNext) {
        rt.unk0x0C = null
        rt.unk0x10 = null
      }
      sr.pRoom.dwFlags =
        ((sr.pRoom.dwFlags & ~DRLGROOMFLAG_HAS_ROOM) | DRLGROOMFLAG_ROOM_FREED_SRV) >>> 0
      this.activeRooms.splice(i, 1)

      for (const mon of [...host.monsters.values()]) {
        if (mon.areaId !== sr.areaId) continue
        if (mon.boneConstructOwnerPlayerId !== undefined) continue
        const mx = Math.round(mon.x)
        const my = Math.round(mon.y)
        if (mx >= sr.subX && mx < sr.subX + sr.subW && my >= sr.subY && my < sr.subY + sr.subH) {
          host.monsters.delete(mon.unitId)
          host.areaPathWorld.hibernateMonster(mon.unitId)
          if (!mon.dead) {
            sr.savedMonsters.push(mon)
          }
        }
      }
    }
  }

  private getColInRoomOrNear(
    host: GameInstanceHost,
    baseSr: SimRoomState113c,
    x: number,
    y: number,
  ): number {
    let sr: SimRoomState113c | undefined
    if (
      x >= baseSr.subX &&
      x < baseSr.subX + baseSr.subW &&
      y >= baseSr.subY &&
      y < baseSr.subY + baseSr.subH
    ) {
      sr = baseSr
    } else {
      for (let i = 0; i < baseSr.pRoom.nRoomsNear; i++) {
        const nr = baseSr.pRoom.ppRoomsNear[i]
        if (!nr) continue
        const nx = nr.pDrlgCoord.nPosX * 5
        const ny = nr.pDrlgCoord.nPosY * 5
        const nw = nr.pDrlgCoord.nWidth * 5
        const nh = nr.pDrlgCoord.nHeight * 5
        if (x >= nx && x < nx + nw && y >= ny && y < ny + nh) {
          sr = this.ensureRoom1Active113c(host, nr)
          break
        }
      }
    }
    if (!sr || !sr.active) return 0x0027
    return host.areaPathWorld.getCollisionAt(sr.areaId, x, y)
  }

  private checkCenteredRectCol(
    host: GameInstanceHost,
    sr: SimRoomState113c,
    cx: number,
    cy: number,
    w: number,
    h: number,
    mask: number,
  ): boolean {
    const x0 = w > 1 || h > 1 ? cx - (w >> 1) : cx
    const y0 = w > 1 || h > 1 ? cy - (h >> 1) : cy
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if ((this.getColInRoomOrNear(host, sr, x0 + dx, y0 + dy) & mask) !== 0) {
          return true
        }
      }
    }
    return false
  }

  private stampCenteredRectCol(
    host: GameInstanceHost,
    areaId: number,
    cx: number,
    cy: number,
    w: number,
    h: number,
    mask: number,
  ): void {
    const x0 = w > 1 || h > 1 ? cx - (w >> 1) : cx
    const y0 = w > 1 || h > 1 ? cy - (h >> 1) : cy
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        host.areaPathWorld.addCollisionMaskAt(areaId, x0 + dx, y0 + dy, mask)
      }
    }
  }

  private checkUnitSizeCol(
    host: GameInstanceHost,
    sr: SimRoomState113c,
    cx: number,
    cy: number,
    size: number,
    mask: number,
  ): boolean {
    if (size <= 1) return (this.getColInRoomOrNear(host, sr, cx, cy) & mask) !== 0
    if (size === 2) {
      return (
        ((this.getColInRoomOrNear(host, sr, cx, cy) |
          this.getColInRoomOrNear(host, sr, cx - 1, cy) |
          this.getColInRoomOrNear(host, sr, cx + 1, cy) |
          this.getColInRoomOrNear(host, sr, cx, cy - 1) |
          this.getColInRoomOrNear(host, sr, cx, cy + 1)) &
          mask) !==
        0
      )
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((this.getColInRoomOrNear(host, sr, cx + dx, cy + dy) & mask) !== 0) {
          return true
        }
      }
    }
    return false
  }

  private coordListIndexAt(sr: SimRoomState113c, x: number, y: number): number {
    return sub_6FD77110(sr.pRoom, x, y)?.nIndex ?? -1
  }

  /**
   * `D2Common.#10916` (`0x6FD8C6D0` -> `0x6FDD19C0` / `sub_6FD77110`):
   * returns `0` when `(x, y)` is outside active (`DRLGROOMFLAG_HAS_ROOM`) rooms, `-1` when the tile has
   * no `D2RoomCoordListStrc`, or `coordList.nIndex` (`+0x28`, >= 1).
   */
  tileZoneAt113c(act: number, x: number, y: number): number {
    const pRoom = this.findPRoomAt(act, x | 0, y | 0)
    if (!pRoom || !(pRoom.dwFlags & DRLGROOMFLAG_HAS_ROOM) || !pRoom.pLogicalRoomInfo) return 0
    return sub_6FD77110(pRoom, x | 0, y | 0)?.nIndex ?? -1
  }

  /**
   * `D2Game.dll` `0x6FC66B20` -> `D2Common.#10942` (`0x6FD8CEE0` -> `0x6FD6A130` -> `0x6FD6A080`
   * -> `0x6FDCC0E0`): checks `nRoom_Center_Warp_X/Y[0..nRoomCoords)` first, and if none are within
   * `minDistSq`, invokes `#10942` (`nTileIndex = 11`), which activates the resolved waypoint/warp
   * room (`DRLGACTIVATE_InitRoomEx` / `DUNGEON_AddRoomData`) whenever it is not currently gridded.
   */
  private tooCloseToWarps113c(
    host: GameInstanceHost,
    pLevel: D2DrlgLevelStrc,
    minDistSq: number,
    tx: number,
    ty: number,
  ): boolean {
    if (minDistSq <= 0) return false
    for (let i = 0; i < pLevel.nRoomCoords; i++) {
      const dx = tx - (pLevel.nRoom_Center_Warp_X[i] ?? 0)
      const dy = ty - (pLevel.nRoom_Center_Warp_Y[i] ?? 0)
      if (dx * dx + dy * dy < minDistSq) return true
    }

    let outTileX = -1
    let outTileY = -1
    const levelDef = DATATBLS_GetLevelDefRecord(this.drlgEnv.tables, pLevel.nLevelId)
    if (levelDef.dwPosition !== 0) {
      if (pLevel.nTileInfo > 0) {
        const tileInfo: ActSpawnTileInfo[] = []
        for (let i = 0; i < pLevel.nTileInfo; i++) {
          const t = pLevel.pTileInfo[i]!
          tileInfo.push({ x: t.nPosX, y: t.nPosY, index: t.nTileIndex })
        }
        const rec = pickTileInfoRecord(tileInfo, 11, pLevel.pSeed)
        outTileX = rec.x
        outTileY = rec.y
        for (let r = pLevel.pFirstRoomEx; r; r = r.pDrlgRoomNext) {
          const c = r.pDrlgCoord
          if (
            outTileX >= c.nPosX &&
            outTileX < c.nPosX + c.nWidth &&
            outTileY >= c.nPosY &&
            outTileY < c.nPosY + c.nHeight
          ) {
            this.ensureRoom1Active113c(host, r)
            break
          }
        }
      }
    } else {
      let targetRoom: D2DrlgRoomStrc | null = null
      for (let r = pLevel.pFirstRoomEx; r; r = r.pDrlgRoomNext) {
        if ((r.dwFlags & DRLGROOMFLAG_HAS_WAYPOINT_MASK) !== 0) {
          targetRoom = r
          this.ensureRoom1Active113c(host, r)
          const c = r.pDrlgCoord
          for (let u = r.pPresetUnits; u; u = u.pNext) {
            if (u.nUnitType !== 2 || u.nIndex >= 573) continue
            if ((objectSubClass(this.drlgEnv.tables, u.nIndex) & 0x40) === 0) continue
            outTileX = c.nPosX + Math.trunc(u.nXpos / 5)
            outTileY = c.nPosY + Math.trunc(u.nYpos / 5)
            break
          }
          break
        }
      }
      if (!targetRoom) {
        for (let r = pLevel.pFirstRoomEx; r; r = r.pDrlgRoomNext) {
          if ((r.dwFlags & DRLGROOMFLAG_HAS_WARP_MASK) === 0) continue
          let slot = 0
          for (
            let bit = DRLGROOMFLAG_HAS_WARP_0;
            (bit & DRLGROOMFLAG_HAS_WARP_MASK) !== 0;
            bit <<= 1, slot++
          ) {
            if (
              (r.dwFlags & bit) !== 0 &&
              DRLGWARP_GetWarpDestinationFromArray(pLevel, slot) !== -1
            ) {
              targetRoom = r
              break
            }
          }
          if (targetRoom) break
        }
      }
      if (!targetRoom) {
        const lc = pLevel.pLevelCoords
        const cx = lc.nPosX + Math.trunc(lc.nWidth / 2) - 2
        const cy = lc.nPosY + Math.trunc(lc.nHeight / 2) - 2
        for (let r = pLevel.pFirstRoomEx; r; r = r.pDrlgRoomNext) {
          const c = r.pDrlgCoord
          if (cx >= c.nPosX && cy >= c.nPosY && cx < c.nPosX + c.nWidth && cy < c.nPosY + c.nHeight) {
            targetRoom = r
            break
          }
        }
      }
      if (!targetRoom && pLevel.nRooms > 0) {
        let n = SEED_RollLimitedRandomNumber(pLevel.pSeed, pLevel.nRooms)
        let r = pLevel.pFirstRoomEx
        while (r && n > 0) {
          r = r.pDrlgRoomNext
          n--
        }
        targetRoom = r
      }
      if (targetRoom) {
        if (outTileX === -1 || outTileY === -1) {
          const c = targetRoom.pDrlgCoord
          outTileX = c.nPosX + Math.trunc(c.nWidth / 2)
          outTileY = c.nPosY + Math.trunc(c.nHeight / 2)
        }
        this.ensureRoom1Active113c(host, targetRoom)
      }
    }

    if (outTileX > 0 && outTileY > 0) {
      const ex = outTileX * 5
      const ey = outTileY * 5
      const dx = tx - ex
      const dy = ty - ey
      if (dx * dx + dy * dy < minDistSq) return true
    }
    return false
  }

  private spawnDrlgObject113c(
    host: GameInstanceHost,
    sr: SimRoomState113c,
    ox: number,
    oy: number,
    cid: number,
    presetMode: number,
    isSparklingPreset: boolean,
    reg: LevelMonRegionRuntime113c,
  ): void {
    const meta = OBJECT_POPULATE_META_113C[cid]
    if (!meta) return
    const [sizeX, sizeY, hasCol0, initFn, , preOperate, , , parm0] = meta
    const areaId = sr.areaId
    const isTown = TOWN_AREA_IDS_113C.has(areaId)

    if (OBJECT_INITFN_ANCHOR_CLASS_IDS_113C.has(cid)) {
      const loaded = host.loadedAreas.get(areaId)
      if (loaded) {
        ;(loaded.initFnAnchors as { classId: number; x: number; y: number }[]).push({
          classId: cid,
          x: ox,
          y: oy,
        })
      }
    }

    if (SERVER_ONLY_NPC_SPAWNER_OBJECT_IDS_113C.has(cid)) {
      host.allocateUnitId(UNIT_TYPE_113C.object, true)
      return
    }

    let shrineType = 0
    let isShrine = false
    let trapType = 0
    let isLocked = false

    if (initFn === 1) {
      isShrine = true
      reg.nShrinesSpawned++
      if (parm0 === 0) {
        for (let tries = 0; tries < 8; tries++) {
          const code = 1 + rollLimitedSeed113c(this.objCtrlSeed, 22)
          shrineType = code
          if (areaId >= (CANONICAL_113C_SHRINES[code]?.levelMin ?? 1)) break
        }
      } else {
        const effectClass: 1 | 2 | 3 | 4 =
          parm0 === 1
            ? 2
            : parm0 === 2
              ? 3
              : rollLimitedSeed113c(this.objCtrlSeed, 10) === 0
                ? 1
                : 4
        const list = SHRINES_BY_EFFECT_CLASS_113C[effectClass]
        for (let tries = 0; tries < 8; tries++) {
          const idx = list.length > 0 ? rollLimitedSeed113c(this.objCtrlSeed, list.length) : 0
          const code = list[idx] || 1
          shrineType = code
          if (areaId >= (CANONICAL_113C_SHRINES[code]?.levelMin ?? 1)) break
        }
      }
    } else if (initFn === 2) {
      if (rollLimitedSeed113c(this.objCtrlSeed, 100) < (reg.monLvl >> 3) + 5) {
        trapType = 1 + rollLimitedSeed113c(this.objCtrlSeed, 9)
      }
    } else if (initFn === 3) {
      if (rollLimitedSeed113c(this.objCtrlSeed, 100) < (reg.monLvl >> 3) + 5) {
        trapType = 1 + rollLimitedSeed113c(this.objCtrlSeed, 9)
      }
      if (!isSparklingPreset && INIT_FN_3_LOCKABLE_CLASS_IDS_113C.has(cid)) {
        if (rollLimitedSeed113c(this.objCtrlSeed, 100) < (reg.monLvl >> 1) + 8) {
          isLocked = true
        }
      }
      rollLimitedSeed113c(this.objCtrlSeed, 0xfffe)
    } else if (initFn === 27) {
      rollLimitedSeed113c(this.objCtrlSeed, 1000)
    }

    const isWaypoint = WAYPOINT_CLASS_IDS_113C.has(cid)
    let mode = isWaypoint && isTown ? 1 : presetMode
    if (preOperate !== 0 && !isLocked && mode === 0) {
      if (rollLimitedSeed113c(this.objCtrlSeed, 14) === 0) {
        mode = 2
      }
    }

    const destAreaId = resolvePresetPortalDestArea113c(cid, areaId)
    const objId = host.spawnObject({
      classId: cid,
      x: ox,
      y: oy,
      areaId,
      mode: mode === 0 ? undefined : mode,
      isWaypoint,
      isShrine,
      shrineType: shrineType > 0 ? shrineType : undefined,
      isLocked,
      isSparkling: isSparklingPreset,
      destAreaId,
      rollTrap: false,
      rollPreOperate: false,
    })
    if (trapType > 0) {
      const objRec = host.objects.get(objId)
      if (objRec) objRec.trapType = trapType
    }
  }

  /**
   * 1.13c party spawner `0x6FD0E480` (end of `MONSTER_Create` `0x6FD0EF10`, skipped for spawn flag `0x40`).
   * `MonStats.minion1` (`+0x26`) must be valid; `minion2` (`+0x28`) enables round-robin. Party size is
   * `PartyMin + rollLimited(leader seed, PartyMax - PartyMin + 1)` (`0x6FD0E623..0x6FD0E644`, no draw when
   * `PartyMin >= PartyMax`). Each minion is created by `0x6FD0DDB0` with flags `0x40` and 4 ring steps around
   * the leader (`0x6FD0E65D..0x6FD0E669`), so it never spawns a party of its own. The leader / minion link
   * (`0x6FC40CF0`) is not modelled here.
   */
  private spawnPartyMinions113c(
    host: GameInstanceHost,
    sr: SimRoomState113c,
    cBox: D2DrlgCoordStrc | null,
    coordIdx: number,
    leader: { readonly x: number; readonly y: number; readonly unitId?: number | undefined },
    hcIdx: number,
    leaderSeed: D2SeedStrc,
    monLvl: number,
  ): void {
    const row = MONSTATS_113C_ROWS[hcIdx]
    if (!row) throw new Error(`party spawner: no MonStats row ${hcIdx}`)
    if (row.minions.length === 0) return
    // `0x6FD0E51C`: `BaseId == 0x105` (`tentaclehead1`) takes a different branch (`0x6FD0E527..0x6FD0E5F0`).
    if (row.baseId === 'tentaclehead1') {
      throw new Error('party spawner: tentaclehead branch 0x6FD0E527 not ported')
    }
    const minionIds = row.minions.map((id) => {
      const idx = MONSTATS_113C_ROWS.findIndex((r) => r.id === id)
      if (idx < 0) throw new Error(`party spawner: unknown minion ${id} of ${row.id}`)
      return idx
    })
    const count =
      row.partyMin < row.partyMax
        ? row.partyMin + rollLimitedSeed113c(leaderSeed, row.partyMax - row.partyMin + 1)
        : row.partyMin
    // `0x6FD0E5C0..0x6FD0E5F0`: with the MonStats `SetBoss` bit the leader's `pAiGeneral` points at itself
    // (`0x6FC40D90`: `+0x28` group, `+0x2C` leader id, `+0x30` type 1).
    const leaderRec = leader.unitId !== undefined ? host.monsters.get(leader.unitId) : undefined
    if (row.setBoss) {
      if (leaderRec === undefined) throw new Error(`party spawner: leader ${leader.unitId} missing`)
      leaderRec.groupLeader113c = leaderRec.unitId
      leaderRec.groupMinions113c ??= []
    }
    let idx = 0
    for (let i = 0; i < count; i++) {
      const minion = this.tryPlaceMonsterRing113c(host, sr, cBox, coordIdx, leader.x, leader.y, minionIds[idx]!, 4, false, monLvl)
      // `0x6FD0E672..0x6FD0E6B3`: with the leader row's `SetBoss` bit the minion is linked to the leader and
      // the leader prepends it to its minion list (`0x6FC40CF0`, `+0x34`).
      if (minion?.unitId !== undefined && row.setBoss && leaderRec !== undefined) {
        const minionRec = host.monsters.get(minion.unitId)
        if (minionRec === undefined) throw new Error(`party spawner: minion ${minion.unitId} missing`)
        minionRec.groupLeader113c = leaderRec.unitId
        ;(leaderRec.groupMinions113c ??= []).unshift(minionRec.unitId)
      }
      idx = idx + 1 > minionIds.length - 1 ? 0 : idx + 1
    }
  }

  private tryPlaceMonsterRing113c(
    host: GameInstanceHost,
    sr: SimRoomState113c,
    cBox: D2DrlgCoordStrc | null,
    coordIdx: number,
    cx: number,
    cy: number,
    hcIdx: number,
    maxSteps: number,
    dryRun: boolean,
    monLvl: number,
  ): { readonly x: number; readonly y: number; readonly unitId?: number | undefined } | null {
    const row = MONSTATS_113C_ROWS[hcIdx]
    if (!row) return null
    const mask =
      row.spawnCol === 1
        ? 0x3f11
        : row.spawnCol === 2
          ? 0x01c0
          : row.spawnCol === 3
            ? 0
            : 0x3c01
    const sizeX = row.sizeX
    const rectL = cBox ? cBox.nPosX * 5 : sr.subX
    const rectT = cBox ? cBox.nPosY * 5 : sr.subY
    const rectR = cBox ? cBox.nWidth * 5 : sr.subX + sr.subW
    const rectB = cBox ? cBox.nHeight * 5 : sr.subY + sr.subH

    const stepSeed = (s: D2SeedStrc): number => {
      D2SEED_AdvanceInline(s)
      return s.lo >>> 0
    }

    const startRad = maxSteps < 0 ? 0 : 3
    const endRad = maxSteps < 0 ? 0 : maxSteps * 3
    for (let rad = startRad; rad <= endRad; rad += 3) {
      const s1 = stepSeed(sr.seed)
      let dx: number
      let dy: number
      let stepX: number
      let stepY: number
      if ((s1 & 1) !== 0) {
        dx = rad
        dy = rollLimitedSeed113c(sr.seed, rad)
        stepX = 0
        stepY = 1
      } else {
        dx = rollLimitedSeed113c(sr.seed, rad)
        dy = rad
        stepX = 1
        stepY = 0
      }
      const s2 = stepSeed(sr.seed)
      if ((s2 & 1) !== 0) dx = -dx
      const s3 = stepSeed(sr.seed)
      if ((s3 & 1) !== 0) dy = -dy

      let curX = cx + dx
      let curY = cy + dy
      const minX = cx - rad
      const maxX = cx + rad
      const minY = cy - rad
      const maxY = cy + rad
      const perim = rad === 0 ? 1 : 8 * rad

      for (let p = 0; p < perim; p++) {
        if (curX === minX && curY === minY) {
          stepX = 1
          stepY = 0
        }
        if (curX === maxX) {
          if (curY === minY) {
            stepX = 0
            stepY = 1
          }
          if (curY === maxY) {
            stepX = -1
            stepY = 0
          }
        }
        if (curX === minX) {
          if (curY === maxY) {
            stepX = 0
            stepY = -1
          }
          if (curY === minY && curX === maxX && curY === maxY) {
            stepX = 0
            stepY = 0
          }
        }
        curX += stepX
        curY += stepY

        if (curX < rectL || curX >= rectR || curY < rectT || curY >= rectB) continue
        if (cBox && this.coordListIndexAt(sr, curX, curY) !== coordIdx) continue
        if (mask !== 0 && this.checkUnitSizeCol(host, sr, curX, curY, sizeX, mask)) continue

        if (dryRun) return { x: curX, y: curY }

        const unitId = host.spawnMonster({
          classId: hcIdx,
          areaId: sr.areaId,
          x: curX,
          y: curY,
          areaLevel: monLvl,
        })
        return { x: curX, y: curY, unitId }
      }
    }
    return null
  }

  private resolvePresetMonster113c(
    sr: SimRoomState113c,
    presetIndex: number,
    ox: number,
    oy: number,
    mapAi: LocalAreaPresetMonster['mapAi'],
  ): LocalAreaPresetMonster | null {
    const areaId = sr.areaId
    const isTown = TOWN_AREA_IDS_113C.has(areaId)
    if (presetIndex < 0) return null
    if (presetIndex >= MONSTATS_113C_ROWS.length) {
      const superUniqueIndex = presetIndex - MONSTATS_113C_ROWS.length
      const su = getSuperUniqueByIndex(superUniqueIndex)
      if (su) {
        if (isTown) return null
        const suKind = getCanonicalMonsterKinds('normal').get(su.monsterId)
        if (suKind?.hcIdx === undefined) return null
        return { classId: suKind.hcIdx, x: ox, y: oy, areaId, superUniqueIndex }
      }
      const SUPERUNIQUES_TXT_COUNT_113C = 66
      if (superUniqueIndex >= SUPERUNIQUES_TXT_COUNT_113C && !isTown) {
        const monPlace = resolveMonPlacePreset113c(
          superUniqueIndex - SUPERUNIQUES_TXT_COUNT_113C,
          areaId,
        )
        if (monPlace !== null) {
          if (monPlace.superUniqueIndex !== undefined) {
            return {
              classId: monPlace.classId,
              x: ox,
              y: oy,
              areaId,
              superUniqueIndex: monPlace.superUniqueIndex,
            }
          }
          const mpRow = MONSTATS_113C_ROWS[monPlace.classId]
          if (mpRow) {
            const mpTownNpc = getTownNpcDescriptorByHcIdx(monPlace.classId)
            const mpIsVendor = mpTownNpc !== undefined && mpTownNpc.vendorId !== null
            const mpIsNpc = mpRow.npc || mpTownNpc !== undefined
            const mpIsKillable = !mpIsNpc && mpRow.killable
            return {
              classId: monPlace.classId,
              x: ox,
              y: oy,
              areaId,
              isNpc: mpIsNpc,
              isVendor: mpIsVendor,
              isKillable: mpIsKillable,
              aiDisabled: mpIsNpc,
            }
          }
        }
      }
      return null
    }
    const row = MONSTATS_113C_ROWS[presetIndex]
    if (!row) return null
    const townNpc = getTownNpcDescriptorByHcIdx(presetIndex)
    const isVendor = townNpc !== undefined && townNpc.vendorId !== null
    const isNpc = row.npc || townNpc !== undefined
    const isKillable = !isNpc && row.killable
    return {
      classId: presetIndex,
      x: ox,
      y: oy,
      areaId,
      isNpc,
      isVendor,
      isKillable,
      aiDisabled: isNpc,
      ...(mapAi !== undefined ? { mapAi } : {}),
    }
  }

  /**
   * Processes newly activated rooms (`D2Game.dll` `0x6FC4CC20` -> `0x6FD01430`):
   * advances every active room's `D2SeedStrc` once and populates unpopulated rooms in
   * head-inserted list order.
   */
  updateProgress(host: GameInstanceHost): void {
    if (!this.hasPending) return

    const roomsToStep = [...this.activeRooms]
    for (const sr of roomsToStep) {
      D2SEED_AdvanceInline(sr.seed)
      if (sr.populated) continue
      this.populateSingleRoom113c(host, sr)
    }

    this.hasPending = false
  }

  /**
   * Populates a single unpopulated `SimRoomState113c` (`D2Game.dll` `0x6FC4CCA3..0x6FC4CCBD`
   * and warp-destination immediate activation `0x6FD01570 -> 0x6FC4CB80 -> 0x6FC67950`).
   */
  private populateSingleRoom113c(host: GameInstanceHost, sr: SimRoomState113c): void {
    if (sr.populated) return

    const reg = this.levelMonTable.get(sr.areaId)
    if (!reg) {
      sr.populated = true
      return
    }

    // 1. Preset objects (`nUnitType === 2`) and warp tiles (`nUnitType === 5`)
    for (let u = sr.pRoom.pPresetUnits; u; u = u.pNext) {
      if (u.nUnitType !== 2 && u.nUnitType !== 5) continue
      if ((u.bSpawned & 1) !== 0) continue
      const ox = sr.subX + u.nXpos
      const oy = sr.subY + u.nYpos
      if (u.nUnitType === 2) {
        const resolved = resolvePresetObject113c(
          u.nIndex,
          sr.areaId,
          (n: number) => rollLimitedSeed113c(this.objCtrlSeed, n),
        )
        if (!resolved) continue
        this.spawnDrlgObject113c(
          host,
          sr,
          ox,
          oy,
          resolved.classId,
          u.nMode,
          Boolean(resolved.isSparkling),
          reg,
        )
      } else if (u.nUnitType === 5) {
        const tileUnitId = host.allocateUnitId(UNIT_TYPE_113C.tile)
        let destAreaId = 0
        for (let rt = sr.pRoom.pRoomTiles; rt; rt = rt.pNext) {
          if (rt.pLvlWarpTxtRecord.dwLevelId === u.nIndex) {
            destAreaId = rt.pDrlgRoom.pLevel.nLevelId
            break
          }
        }
        const tile: InternalWarpTileRecord = {
          unitId: tileUnitId,
          lvlWarpId: u.nIndex,
          areaId: sr.areaId,
          x: ox,
          y: oy,
          destAreaId,
        }
        host.warpTiles.set(tileUnitId, tile)
      }
    }

    // 2. Preset monsters / Town NPCs / SuperUniques (`nUnitType === 1`)
    for (let u = sr.pRoom.pPresetUnits; u; u = u.pNext) {
      if (u.nUnitType !== 1) continue
      if ((u.bSpawned & 1) !== 0) continue
      const ox = sr.subX + u.nXpos
      const oy = sr.subY + u.nYpos
      const mapAi =
        u.pMapAI && u.pMapAI.length > 0
          ? u.pMapAI.map((pt) => ({ x: pt.nX, y: pt.nY, action: pt.nMapAIAction }))
          : undefined
      const monSpec = this.resolvePresetMonster113c(sr, u.nIndex, ox, oy, mapAi)
      if (monSpec) {
        host.spawnAreaPresetMonster113c(sr.areaId, monSpec)
      }
    }

    if (sr.areaId === 1) {
      host.syncRogueEncampmentA1Q3State113c()
    }

    // 3. Procedural random objects (`OBJECTS_PopulateRoom` `0x6FC4F1C3`)
    const objGrpSpec = LEVEL_OBJGRP_113C[sr.areaId]
    const hasDirtPath =
      sr.pRoom.nType === 1 && ((sr.pRoom.pOutdoor?.dwFlags ?? 0) & 0x80) !== 0
    if (!TOWN_AREA_IDS_113C.has(sr.areaId) && (sr.flags & 0x00830000) === 0 && !hasDirtPath) {
      reg.nRoomsPopulated++
      const nTotalRooms = sr.pRoom.pLevel.nRooms
      for (let slot = 0; slot < 8; slot++) {
        let rSlot = rollLimitedSeed113c(sr.seed, 100)
        const grpId = objGrpSpec?.objGrp[slot] ?? 0
        const grpPrb = objGrpSpec?.objPrb[slot] ?? 0
        if (
          nTotalRooms > 0 &&
          Math.trunc((reg.nRoomsPopulated << 7) / nTotalRooms) > 0x60 &&
          reg.nShrinesSpawned === 0
        ) {
          if ((OBJECT_POPULATE_META_113C[grpId]?.[7] ?? 0) !== 0) {
            rSlot = 100
          }
        }
        if (grpId !== 0 && rSlot <= grpPrb) {
          const grp = OBJGROUP_TXT_113C[grpId]
          if (!grp) continue
          const rMem = rollLimitedSeed113c(sr.seed, 100)
          let cum = 0
          let chosen = -1
          for (let m = 0; m < 8; m++) {
            const cid = grp.ids[m]!
            if (cid === 0) break
            cum += grp.probs[m]!
            if (rMem < cum) {
              chosen = m
              break
            }
          }
          if (chosen >= 0) {
            const cid = grp.ids[chosen]!
            const rec = OBJECT_POPULATE_META_113C[cid]
            if (rec && rec[6] <= 2) {
              const [sizeX, sizeY, , , popFn] = rec
              if (popFn === 3 || popFn === 6) {
                rollLimitedSeed113c(this.objCtrlSeed, 100)
                const count = (((sr.subW * sr.subH) >> 7) * grp.densities[chosen]!) >> 8
                let lastPos: { readonly x: number; readonly y: number } | null = null
                for (let n = 0; n < count; n++) {
                  lastPos = null
                  for (let t = 0; t < 5; t++) {
                    const dx = rollLimitedSeed113c(this.objCtrlSeed, sr.subW - sizeX - 1)
                    const dy = rollLimitedSeed113c(this.objCtrlSeed, sr.subH - sizeY - 1)
                    const ox = sr.subX + dx
                    const oy = sr.subY + dy
                    if (
                      ox < sr.subX + 1 ||
                      oy < sr.subY + 1 ||
                      ox >= sr.subX + sr.subW - 1 ||
                      oy >= sr.subY + sr.subH - 1
                    ) {
                      continue
                    }
                    if (
                      !this.checkCenteredRectCol(
                        host,
                        sr,
                        ox,
                        oy,
                        sizeX + 6,
                        sizeY + 6,
                        0x3f11,
                      )
                    ) {
                      this.spawnDrlgObject113c(host, sr, ox, oy, cid, 0, false, reg)
                      lastPos = { x: ox, y: oy }
                      break
                    }
                  }
                }
                if (popFn === 6 && lastPos !== null) {
                  if (rollLimitedSeed113c(this.objCtrlSeed, 100) > 70) {
                    this.spawnDrlgObject113c(
                      host,
                      sr,
                      lastPos.x,
                      lastPos.y,
                      103,
                      0,
                      false,
                      reg,
                    )
                  }
                }
              }
            }
          }
        }
      }
    }

    // 4. Procedural random monster packs (`0x6FD0F7A0`)
    if (reg.den > 0 && reg.entries.length > 0 && (sr.flags & 0x00800000) === 0) {
      const players = [...host.players.values()]
      for (let c = sr.pRoom.pLogicalRoomInfo?.pCoordList ?? null; c; c = c.pNext) {
        if (c.nIndex === 0 || c.bNode !== 0) continue
        const x0 = c.pBox[1].nPosX * 5
        const y0 = c.pBox[1].nPosY * 5
        const x1 = c.pBox[1].nWidth * 5
        const y1 = c.pBox[1].nHeight * 5
        const attempts = Math.trunc((x1 - x0) / 3) * Math.trunc((y1 - y0) / 3)
        for (let k = attempts; k >= 1; k--) {
          const rDen = rollLimitedSeed113c(host.gameSeed, 100000)
          if (rDen > reg.den) continue
          let w = rollLimitedSeed113c(sr.seed, reg.totalRarity) + 1
          let hcIdx = reg.entries[0]!.hcIdx
          for (const ent of reg.entries) {
            w -= ent.rarity
            if (w <= 0) {
              hcIdx = ent.hcIdx
              break
            }
          }
          rollLimitedSeed113c(sr.seed, 100)
          const row = MONSTATS_113C_ROWS[hcIdx]
          if (!row) continue
          const realSparse = row.sparsePopulate >= 100 ? 0 : row.sparsePopulate
          if (realSparse !== 0 && rollLimitedSeed113c(host.gameSeed, 100) > realSparse) {
            continue
          }
          let chosenPos: { readonly x: number; readonly y: number } | null = null
          for (let t = 0; t < 20; t++) {
            const tx = x0 + 1 + rollLimitedSeed113c(sr.seed, x1 - (x0 + 1))
            const ty = y0 + 1 + rollLimitedSeed113c(sr.seed, y1 - (y0 + 1))
            if (this.tooCloseToWarps113c(host, sr.pRoom.pLevel, reg.minWarpDistSq, tx, ty)) {
              continue
            }
            let tooCloseToPlayer = false
            for (const pl of players) {
              const dxp = tx - Math.round(pl.x)
              const dyp = ty - Math.round(pl.y)
              if (dxp * dxp + dyp * dyp < 169) {
                tooCloseToPlayer = true
                break
              }
            }
            if (tooCloseToPlayer) continue
            if (this.coordListIndexAt(sr, tx, ty) !== c.nIndex) continue
            if (
              this.tryPlaceMonsterRing113c(
                host,
                sr,
                c.pBox[1],
                c.nIndex,
                tx,
                ty,
                hcIdx,
                -1,
                true,
                reg.monLvl,
              )
            ) {
              chosenPos = { x: tx, y: ty }
              break
            }
          }
          if (!chosenPos) continue
          const leader = this.tryPlaceMonsterRing113c(
            host,
            sr,
            c.pBox[1],
            c.nIndex,
            chosenPos.x,
            chosenPos.y,
            hcIdx,
            -1,
            false,
            reg.monLvl,
          )
          if (!leader || leader.unitId === undefined) continue
          const leaderSeed = host.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${leader.unitId}`)
          if (!leaderSeed) continue
          // `MONSTER_Create` (`0x6FD0EF10`) ends with the party spawner `0x6FD0E480` (`0x6FD0F41B`).
          this.spawnPartyMinions113c(host, sr, c.pBox[1], c.nIndex, leader, hcIdx, leaderSeed, reg.monLvl)
          // `0x6FC67BB9`: `0x6FC66D40` (`BaseId == 19` fallen / `91` scarab) forces the group size to
          // `(1, 1)` because those packs come from the party spawner; `0x6FC677CD..0x6FC677E1` still draws
          // `rollLimited(1)` on the leader seed.
          const fixedGroup = row.baseId === 'fallen1' || row.baseId === 'scarab1'
          const minGrp = fixedGroup ? 1 : row.minGrp
          const maxGrp = fixedGroup ? 1 : row.maxGrp
          const extra = minGrp - 1 + rollLimitedSeed113c(leaderSeed, maxGrp - minGrp + 1)
          for (let e = 0; e < extra; e++) {
            const member = this.tryPlaceMonsterRing113c(
              host,
              sr,
              c.pBox[1],
              c.nIndex,
              leader.x,
              leader.y,
              hcIdx,
              3,
              false,
              reg.monLvl,
            )
            // Group members are created by `0x6FD0F570` with spawn flags 0, so they run the party spawner too.
            if (member?.unitId === undefined) continue
            const memberSeed = host.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${member.unitId}`)
            if (!memberSeed) throw new Error(`room populate: group member ${member.unitId} has no unit seed`)
            this.spawnPartyMinions113c(host, sr, c.pBox[1], c.nIndex, member, hcIdx, memberSeed, reg.monLvl)
          }
        }
      }
    }

    // `D2GAME_SpawnMonsterInCurrentRoom` (`0x6FCCE3BC`): when `pRoom1->nNumClients == 0` during
    // room population (`!sr.hasClientNear`), no initial `EVENTTYPE_MONAI` (`+25`) is queued;
    // `syncClientRoomPresence` (`SUB_AddClientToRoom` `0x6FCCF920`) at end of frame queues `+2`
    // once a client is in `ppRoomsNear`.
    if (!sr.hasClientNear) {
      for (const mon of host.monsters.values()) {
        if (mon.areaId !== sr.areaId || mon.dead || mon.isNpc) continue
        const mx = Math.round(mon.x)
        const my = Math.round(mon.y)
        if (mx < sr.subX || mx >= sr.subX + sr.subW || my < sr.subY || my >= sr.subY + sr.subH) {
          continue
        }
        mon.nextAiFrame = Infinity
      }
    }

    sr.populated = true
  }
}
