/**
 * Diablo II v1.13c `D2StatListStrc` (`0x3C` bytes), `D2StatListExStrc` (`0x64` bytes),
 * `EvalStatWithOps` (`0x6FD89530` `op 1..13`), and `STATES` bitvectors (`185` states).
 *
 * Binary evidence (`D2Common.dll`, image base `0x6FD50000`, `kb/stats/d2common-statlist-struct-113c.md`):
 * - `#11013` (`0x6FD88100`): `STATLIST_AllocStatList` (`0x3C` bytes)
 * - `#11166` (`0x6FD8AF00`): `STATLIST_AllocStatListEx` (`0x64` bytes + `48`-byte `pStateFlags`)
 * - `0x6FD88270` / `0x6FD882B0`: signed 32-bit binary search on `dwKey = (statId << 16) | (layer & 0xFFFF)`
 * - `0x6FD88640` / `0x6FD881A0`: `D2StatStrc` array growth (`+4`) and shrink (`-4` when `cap - count > 8`)
 * - `#10188` (`0x6FD8A7B0` -> `0x6FD8A280`): `STATLIST_SetBaseStat` (always removes `newValue == 0` from `BaseStats`)
 * - `#10887` (`0x6FD8A740`): `STATLIST_SetUnitStat`
 * - `#10973` (`0x6FD88B70` -> `0x6FD88A80`): `STATLIST_GetUnitStat` (with `fMin` floor clamp on player/monster)
 * - `#10587` (`0x6FD88C20` -> `0x6FD88B00`): `STATLIST_GetUnitBaseStat` (with `fMin` floor clamp on player/monster)
 * - `0x6FD89530`: `EvalStatWithOps` (`op 1..13` jump table at `0x6FD89AF0`)
 * - `#10494` (`0x6FD83CD0`): `STATES_CheckState` (`dwUnitType` in `{0, 1, 3}`, `0 <= stateId < 185`)
 * - `0x6FD88730`: `STATES_ToggleState` (active dwords `[0..5]` + dirty/gfx dwords `[6..11]`)
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2ActStrc,
  D2ActiveRoomStrc,
  D2CharStatsTxt,
  D2CharStatsTxt_SIZE,
  D2DrlgStrc,
  D2EnvironmentStrc,
  D2ItemDataStrc,
  D2ItemsTxt,
  D2RoomExStrc,
  D2SkillsTxt,
  D2SkillsTxt_SIZE,
  D2StatListExStrc,
  D2StatListExStrc_SIZE,
  D2StatListStrc,
  D2StatListStrc_SIZE,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
  DATATABLES_OFF_113C,
  DATATBLS_GetSetItemsTxtRecordInline113c,
  DATATBLS_GetSetsTxtRecordInline113c,
  DATATBLS_GetSkillsTxtMaxLvlInline113c,
  DATATBLS_GetSkillsTxtRecordInline113c,
  DATATBLS_GetUniqueItemsTxtRecordInline113c,
  DATATBLS_HasValidSkillDescInline113c,
  SEED_RollRandomNumberInline113c,
} from './inline-helpers.ts'
import { imul32, mulDiv113c, sar32, sdiv32, shl32 } from './int-math.ts'
import {
  DRLGROOM_RollItemCoordinate113c,
  DRLGROOM_RollItemCoordinateAlt113c,
  FIXED_POINT_STAT_SWITCH_6FD95668,
  ITEMMODS_ShiftStatValueIfFixedPoint113c,
} from './drlg/drlg-room.ts'
import { ITEMMODS_ApplySetItemBonusProps113c } from './items.ts'
import {
  D2COMMON_ITEMS_CODE_LINK_VA_113C,
  INVENTORY_GetItemIfOwnedByInventory113c,
  INVENTORY_GetItemNodePositionOther113c,
  UNITS_SetStaticPathPosX113c,
  UNITS_SetStaticPathPosY113c,
  fogGetLinkIndex113c,
  getItemsTxtRecordInvMem113c,
} from './inventory.ts'
import {
  ITEMS_AddSockets113c,
  ITEMS_CheckEtherealFlag113c,
  ITEMS_CheckItemTypeIdMem113c,
  ITEMS_DecodeAndSetSaveStat113c,
  ITEMS_EnsureMinimumBaseDamageAndACStats113c,
  ITEMS_GetBaseCode113c,
  ITEMS_GetBodyLocation113c,
  ITEMS_GetCommandFlags113c,
  ITEMS_GetEquippedSetItemsMask113c,
  ITEMS_GetItemCell113c,
  ITEMS_GetItemLevel113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemSeed113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_IsHighQualityItem113c,
  ITEMS_GetSetItemsSetId113c,
  ITEMS_GetSetItemsTxtRecordFromItem113c,
  ITEMS_GetTwoHandedFlag113c,
  ITEMS_ResetBaseDamageOrACStatFromTxt113c,
  ITEMS_RollItemOrUnitSeedRange113c,
  ITEMS_SetMagicPrefix113c,
  ITEMS_SetMagicSuffix113c,
  ITEMS_SetRarePrefix113c,
  ITEMS_SetRareSuffix113c,
} from './items.ts'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndId113c,
  SKILLS_GetOrCreateSkillStatList113c,
  SKILLS_GetReqLevel113c,
} from './skills.ts'
import { DATATBLS_GetHirelingTxtRecordFromActAndDifficulty113c } from '../tables/monster-tbls-113c.ts'
import { UNITROOM_RefreshUnit113c, UNITS_UpdateAnimFrame113c } from './unit.ts'
import {
  CANONICAL_CHAR_GROWTH_113C,
  CANONICAL_ITEM_STAT_COST_113C,
  CHAR_STATS_BIN_STRIDE_113C,
  CHAR_STATS_COUNT_113C,
  ISC_FLAG_CSV_SIGNED,
  ISC_FLAG_DAMAGE_RELATED,
  ISC_FLAG_DIRECT,
  ISC_FLAG_FCALLBACK,
  ISC_FLAG_FMIN,
  ISC_FLAG_ITEM_SPECIFIC,
  ISC_FLAG_RUNTIME_MAXHP,
  ISC_FLAG_RUNTIME_MAXMANA,
  ISC_FLAG_RUNTIME_MAXSTAM,
  ISC_FLAG_RUNTIME_MAXSTAT,
  ISC_FLAG_SAVED,
  ISC_FLAG_SEND_OTHER,
  ISC_FLAG_SIGNED,
  ISC_FLAG_UPDATE_ANIM_RATE,
  ITEM_STAT_COST_BIN_STRIDE_113C,
  ITEM_STAT_COST_COUNT_113C,
  STAT_ID_NONE_113C,
  parseCharStatsBin113c,
  parseItemStatCostBin113c,
  type CharStatsGrowthMeta113c,
  type ItemStatCostMeta113c,
} from '../tables/item-stat-cost-113c.ts'

export {
  CANONICAL_CHAR_GROWTH_113C,
  CANONICAL_ITEM_STAT_COST_113C,
  CHAR_STATS_BIN_STRIDE_113C,
  CHAR_STATS_COUNT_113C,
  ISC_FLAG_CSV_SIGNED,
  ISC_FLAG_DAMAGE_RELATED,
  ISC_FLAG_DIRECT,
  ISC_FLAG_FCALLBACK,
  ISC_FLAG_FMIN,
  ISC_FLAG_ITEM_SPECIFIC,
  ISC_FLAG_RUNTIME_MAXHP,
  ISC_FLAG_RUNTIME_MAXMANA,
  ISC_FLAG_RUNTIME_MAXSTAM,
  ISC_FLAG_RUNTIME_MAXSTAT,
  ISC_FLAG_SAVED,
  ISC_FLAG_SEND_OTHER,
  ISC_FLAG_SIGNED,
  ISC_FLAG_UPDATE_ANIM_RATE,
  ITEM_STAT_COST_BIN_STRIDE_113C,
  ITEM_STAT_COST_COUNT_113C,
  STAT_ID_NONE_113C,
  parseCharStatsBin113c,
  parseItemStatCostBin113c,
  type CharStatsGrowthMeta113c,
  type ItemStatCostMeta113c,
}

export const STATLIST_FLAG_TIMED = 0x00000002
export const STATLIST_FLAG_SET = 0x00002000
export const STATLIST_FLAG_DYNAMIC_OP = 0x20000000
export const STATLIST_FLAG_MERGED = 0x40000000
export const STATLIST_FLAG_EXTENDED = 0x80000000

export const STATES_COUNT_113C = 185 // [sgptDataTables+0xC4] = 185 (States.txt rows 0..184, 184 = uberminion)
export const STATE_DWORDS_113C = 6 // ceil(185 / 32) = 6 active dwords + 6 dirty/gfx dwords = 48 bytes

export interface StatOpEntry113c {
  readonly op: number // 1..13
  readonly opParam: number // shift parameter (`bOpParam`)
  readonly opBase: number // base stat ID (`wOpBase`, 0xFFFF if unused)
  readonly sourceStat: number // source stat ID (`wSourceStat`)
}

export class StatTableRegistry113c {
  private readonly meta = new Map<number, ItemStatCostMeta113c>()
  private readonly reverseOps = new Map<number, StatOpEntry113c[]>()
  private readonly baseDeps = new Map<number, number[]>()
  private readonly charGrowth: readonly CharStatsGrowthMeta113c[]

  constructor(
    entries: readonly ItemStatCostMeta113c[] = CANONICAL_ITEM_STAT_COST_113C,
    charGrowth: readonly CharStatsGrowthMeta113c[] = CANONICAL_CHAR_GROWTH_113C,
  ) {
    this.charGrowth = charGrowth
    for (const e of entries) {
      this.register(e)
    }
  }

  private removeContributions(statId: number, prev: ItemStatCostMeta113c): void {
    if (prev.opBase !== undefined && prev.opBase >= 0 && prev.opBase !== 0xffff) {
      const deps = this.baseDeps.get(prev.opBase)
      if (deps) {
        const idx = deps.indexOf(statId)
        if (idx >= 0) deps.splice(idx, 1)
      }
    }
    if (prev.opStats) {
      for (const targetStat of prev.opStats) {
        if (targetStat < 0 || targetStat === 0xffff) continue
        const rev = this.reverseOps.get(targetStat)
        if (rev) {
          for (let i = rev.length - 1; i >= 0; i--) {
            if (rev[i]!.sourceStat === statId) rev.splice(i, 1)
          }
        }
      }
    }
  }

  register(entry: ItemStatCostMeta113c): void {
    const prev = this.meta.get(entry.statId)
    if (prev !== undefined) {
      this.removeContributions(entry.statId, prev)
    }
    let postLoadFlags = entry.flags !== undefined ? entry.flags >>> 0 : 0
    const op = entry.op !== undefined ? entry.op : 0
    if (op >= 1 && op <= 13) {
      // 0x6FDC3CE3..0x6FDC3D35: table[wOpBase].wBaseDepStats (+0x5E) stores `entry.statId` (NOT targetStat!)
      if (entry.opBase !== undefined && entry.opBase >= 0 && entry.opBase !== 0xffff) {
        let deps = this.baseDeps.get(entry.opBase)
        if (!deps) {
          deps = []
          this.baseDeps.set(entry.opBase, deps)
        }
        if (deps.length < 64 && !deps.includes(entry.statId)) {
          deps.push(entry.statId)
        }
      }
      if (entry.opStats) {
        for (const targetStat of entry.opStats) {
          if (targetStat < 0 || targetStat === 0xffff) continue
          let rev = this.reverseOps.get(targetStat)
          if (!rev) {
            rev = []
            this.reverseOps.set(targetStat, rev)
          }
          if (rev.length < 16) {
            rev.push({
              op,
              opParam: entry.opParam !== undefined ? entry.opParam : 0,
              opBase: entry.opBase !== undefined ? entry.opBase : 0xffff,
              sourceStat: entry.statId,
            })
            // 0x6FDC3DA8..0x6FDC3E7A: post-load runtime `dwFlags` bits 5..8 for maxhp(7), maxmana(9), maxstamina(11)
            if (entry.statId === 7 || targetStat === 7) {
              postLoadFlags =
                (postLoadFlags | ISC_FLAG_RUNTIME_MAXHP | ISC_FLAG_RUNTIME_MAXSTAT) >>> 0
            } else if (entry.statId === 9 || targetStat === 9) {
              postLoadFlags =
                (postLoadFlags | ISC_FLAG_RUNTIME_MAXMANA | ISC_FLAG_RUNTIME_MAXSTAT) >>> 0
            } else if (entry.statId === 11 || targetStat === 11) {
              postLoadFlags =
                (postLoadFlags | ISC_FLAG_RUNTIME_MAXSTAM | ISC_FLAG_RUNTIME_MAXSTAT) >>> 0
            }
          }
        }
      }
    }
    const normalized: ItemStatCostMeta113c =
      entry.flags === postLoadFlags
        ? entry
        : {
            ...entry,
            flags: postLoadFlags,
            runtimeMaxStat: (postLoadFlags & ISC_FLAG_RUNTIME_MAXSTAT) !== 0,
            runtimeMaxHp: (postLoadFlags & ISC_FLAG_RUNTIME_MAXHP) !== 0,
            runtimeMaxMana: (postLoadFlags & ISC_FLAG_RUNTIME_MAXMANA) !== 0,
            runtimeMaxStam: (postLoadFlags & ISC_FLAG_RUNTIME_MAXSTAM) !== 0,
          }
    this.meta.set(entry.statId, normalized)
  }

  get size(): number {
    return this.meta.size
  }

  get(statId: number): ItemStatCostMeta113c | undefined {
    return this.meta.get(statId)
  }

  getReverseOps(targetStatId: number): readonly StatOpEntry113c[] {
    const rev = this.reverseOps.get(targetStatId)
    return rev !== undefined ? rev : []
  }

  /** `+0x5E..+0xDD` `wBaseDepStats[0..63]`: stats whose `wOpBase == baseStatId` (`0x6FDC3D06`). */
  getBaseDependents(baseStatId: number): readonly number[] {
    const deps = this.baseDeps.get(baseStatId)
    return deps !== undefined ? deps : []
  }

  getDependents(changedStatId: number): readonly number[] {
    const entry = this.meta.get(changedStatId)
    const out: number[] = []
    if (entry?.opStats) {
      for (const t of entry.opStats) {
        if (t >= 0 && t !== 0xffff && !out.includes(t)) out.push(t)
      }
    }
    const bDeps = this.baseDeps.get(changedStatId)
    if (bDeps) {
      for (const t of bDeps) {
        if (!out.includes(t)) out.push(t)
      }
    }
    return out
  }

  getCharGrowth(classId: number): CharStatsGrowthMeta113c | undefined {
    return this.charGrowth[classId]
  }
}

/**
 * Complete canonical 1.13c `ItemStatCost.bin` (`Patch_D2.mpq`, 359 rows × `0x144` bytes)
 * definitions verified byte-for-byte against `ItemStatCost.bin`.
 */
export const CANONICAL_CORE_STATS_113C: readonly ItemStatCostMeta113c[] = CANONICAL_ITEM_STAT_COST_113C

export const DEFAULT_STAT_REGISTRY_113C = new StatTableRegistry113c(
  CANONICAL_ITEM_STAT_COST_113C,
  CANONICAL_CHAR_GROWTH_113C,
)

/** Pack `(statId, layer)` into 1.13c `D2StatStrc.dwKey` (`(statId << 16) | (layer & 0xFFFF)`). */
export function statKey113c(statId: number, layer = 0): number {
  return (((statId & 0xffff) << 16) | (layer & 0xffff)) | 0
}

/**
 * `D2Common 0x6FD882B0`: exact signed 32-bit binary search on a `D2StatsArrayStrc` (`pArrayHdr`: `+0 pStat`, `+4 wCount`, `+6 wCap`).
 * Returns index `>= 0` if found, `-1` if absent.
 */
export function STATLIST_FindStatIndex113c(m: Memory113c, pArrayHdr: number, dwKey: number): number {
  const count = (m.u16(pArrayHdr + 4) << 16) >> 16 // movsx ecx, word ptr [esi + 4]
  if (count <= 0) return -1
  const pStat = m.u32(pArrayHdr)
  const target = dwKey | 0
  let lo = 0
  let hi = count
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const curKey = m.u32(pStat + mid * 8) | 0
    if (target < curKey) {
      hi = mid
    } else if (target > curKey) {
      lo = mid + 1
    } else {
      return mid
    }
  }
  return -1
}

/** `D2Common 0x6FD88270`: lower-bound insertion index under signed 32-bit `dwKey` ordering. */
export function STATLIST_FindInsertPos113c(m: Memory113c, pArrayHdr: number, dwKey: number): number {
  const count = (m.u16(pArrayHdr + 4) << 16) >> 16
  if (count <= 0) return 0
  const pStat = m.u32(pArrayHdr)
  const target = dwKey | 0
  let lo = 0
  let hi = count
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const curKey = m.u32(pStat + mid * 8) | 0
    if (target <= curKey) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }
  return lo
}

/** `D2Common 0x6FD88640`: insert `dwKey` at `insertIdx` with initial value `0`, growing capacity in steps of `+4`. */
function insertStatSlot(m: Memory113c, pArrayHdr: number, insertIdx: number, dwKey: number): number {
  const count = (m.u16(pArrayHdr + 4) << 16) >> 16
  let cap = (m.u16(pArrayHdr + 6) << 16) >> 16
  let pStat = m.u32(pArrayHdr)
  if (count >= cap) {
    const newCap = cap + 4
    const nextBuf = m.alloc(newCap * 8)
    for (let i = 0; i < count * 8; i += 4) {
      m.setU32(nextBuf + i, m.u32(pStat + i))
    }
    pStat = nextBuf
    cap = newCap
    m.setU32(pArrayHdr, pStat)
    m.setU16(pArrayHdr + 6, cap & 0xffff)
  }
  for (let i = count; i > insertIdx; i--) {
    m.setU32(pStat + i * 8, m.u32(pStat + (i - 1) * 8))
    m.setU32(pStat + i * 8 + 4, m.u32(pStat + (i - 1) * 8 + 4))
  }
  m.setU32(pStat + insertIdx * 8, dwKey >>> 0)
  m.setU32(pStat + insertIdx * 8 + 4, 0)
  m.setU16(pArrayHdr + 4, (count + 1) & 0xffff)
  return pStat + insertIdx * 8
}

/** `D2Common 0x6FD881A0`: remove entry at `idx`, shrinking capacity by `-4` if `(cap - newCount) > 8`. */
export function removeStatSlot(m: Memory113c, pArrayHdr: number, idx: number): void {
  const count = (m.u16(pArrayHdr + 4) << 16) >> 16
  if (idx < 0 || idx >= count) return
  let pStat = m.u32(pArrayHdr)
  for (let i = idx; i < count - 1; i++) {
    m.setU32(pStat + i * 8, m.u32(pStat + (i + 1) * 8))
    m.setU32(pStat + i * 8 + 4, m.u32(pStat + (i + 1) * 8 + 4))
  }
  const newCount = count - 1
  m.setU16(pArrayHdr + 4, newCount & 0xffff)
  const cap = (m.u16(pArrayHdr + 6) << 16) >> 16
  if (cap - newCount > 8) {
    const newCap = cap - 4
    const nextBuf = newCap > 0 ? m.alloc(newCap * 8) : 0
    for (let i = 0; i < newCount * 8; i += 4) {
      m.setU32(nextBuf + i, m.u32(pStat + i))
    }
    m.setU32(pArrayHdr, nextBuf)
    m.setU16(pArrayHdr + 6, newCap & 0xffff)
  }
}

function readStatFromArray(m: Memory113c, pArrayHdr: number, dwKey: number): number {
  const idx = STATLIST_FindStatIndex113c(m, pArrayHdr, dwKey)
  if (idx < 0) return 0
  const pStat = m.u32(pArrayHdr)
  return m.u32(pStat + idx * 8 + 4) | 0
}

function writeFullStat(
  m: Memory113c,
  pListEx: number,
  dwKey: number,
  value: number,
  keepZero: boolean,
  hasItemDynamicOp = false,
): void {
  const pFullHdr = pListEx + D2StatListExStrc.pFullStat.off
  const idx = STATLIST_FindStatIndex113c(m, pFullHdr, dwKey)
  const val = value | 0
  if (val === 0 && !keepZero) {
    if (idx >= 0) removeStatSlot(m, pFullHdr, idx)
    return
  }
  if (idx >= 0) {
    const pStat = m.u32(pFullHdr)
    m.setU32(pStat + idx * 8 + 4, val >>> 0)
  } else {
    const ins = STATLIST_FindInsertPos113c(m, pFullHdr, dwKey)
    const entryPtr = insertStatSlot(m, pFullHdr, ins, dwKey)
    m.setU32(entryPtr + 4, val >>> 0)
  }
  if (val !== 0 && hasItemDynamicOp) {
    // 0x6FD88997..0x6FD8899E: if `isc[+0x53] != 0` (`op == 4 || op == 5`), set `0x20000000`
    m.set(
      pListEx,
      D2StatListStrc.dwFlags,
      (m.get(pListEx, D2StatListStrc.dwFlags) | STATLIST_FLAG_DYNAMIC_OP) >>> 0,
    )
  }
}

/**
 * `D2Common 0x6FD889E0` (`STATLIST_AddFullStatDelta`):
 * Direct additive fast-path on `pListEx->FullStats` (`+0x48`) used by `0x6FD89F70` when neither
 * `bHasOpStat` (`+0x51`) nor `bIsOpTarget` (`+0x52`) is set on the `ItemStatCostTxt` record.
 */
function addFullStatDelta(
  m: Memory113c,
  pListEx: number,
  dwKey: number,
  delta: number,
  keepZero: boolean,
  hasItemDynamicOp = false,
): void {
  const pFullHdr = pListEx + D2StatListExStrc.pFullStat.off
  let idx = STATLIST_FindStatIndex113c(m, pFullHdr, dwKey)
  let entryPtr = 0
  if (idx >= 0) {
    entryPtr = m.u32(pFullHdr) + idx * 8
  } else {
    const ins = STATLIST_FindInsertPos113c(m, pFullHdr, dwKey)
    entryPtr = insertStatSlot(m, pFullHdr, ins, dwKey)
    idx = ins
  }
  const prevVal = m.u32(entryPtr + 4) | 0
  const nextVal = (prevVal + (delta | 0)) | 0
  m.setU32(entryPtr + 4, nextVal >>> 0)
  if (nextVal > 0 && hasItemDynamicOp) {
    // 0x6FD88A17..0x6FD88A24: `jle` skips when `nextVal <= 0`
    m.set(
      pListEx,
      D2StatListStrc.dwFlags,
      (m.get(pListEx, D2StatListStrc.dwFlags) | STATLIST_FLAG_DYNAMIC_OP) >>> 0,
    )
  }
  if (nextVal === 0 && !keepZero) {
    removeStatSlot(m, pFullHdr, idx)
  }
}

/** `D2Common.#11013` (`0x6FD88100`): allocate base `D2StatListStrc` (`0x3C` bytes). */
export function STATLIST_AllocList113c(
  m: Memory113c,
  flags = 0,
  ownerType = 6,
  ownerId = 0,
  stateNo = 0,
  expireFrame = 0,
): number {
  const pList = m.alloc(D2StatListStrc_SIZE)
  let fl = flags >>> 0
  if (expireFrame > 0) fl = (fl | STATLIST_FLAG_TIMED) >>> 0
  m.set(pList, D2StatListStrc.eOwnerType, ownerType >>> 0)
  m.set(pList, D2StatListStrc.dwOwnerId, ownerId >>> 0)
  m.set(pList, D2StatListStrc.dwFlags, fl)
  m.set(pList, D2StatListStrc.dwStateNo, stateNo >>> 0)
  m.set(pList, D2StatListStrc.dwExpireFrame, expireFrame >>> 0)
  return pList
}

/** `D2Common.#11166` (`0x6FD8AF00`): allocate `D2StatListExStrc` (`0x64` bytes + `48`-byte `pStateFlags`) and attach to `pOwner`. */
export function STATLIST_CreateEx113c(
  m: Memory113c,
  pOwner: number,
  argFlags = 0,
  pGame = 0,
): number {
  const pListEx = m.alloc(D2StatListExStrc_SIZE)
  const pStateFlags = m.alloc(STATE_DWORDS_113C * 2 * 4) // 48 bytes: [0..5] active, [6..11] dirty/gfx
  const ownerType = pOwner !== 0 ? m.get(pOwner, D2UnitStrc.dwUnitType) : 6
  const ownerId = pOwner !== 0 ? m.get(pOwner, D2UnitStrc.dwUnitId) : 0
  const dwFlags = ((argFlags & 1) | STATLIST_FLAG_EXTENDED) >>> 0

  m.set(pListEx, D2StatListExStrc.eOwnerType, ownerType)
  m.set(pListEx, D2StatListExStrc.dwOwnerId, ownerId)
  m.set(pListEx, D2StatListExStrc.dwFlags, dwFlags)
  m.set(pListEx, D2StatListExStrc.pOwner, pOwner)
  m.set(pListEx, D2StatListExStrc.pStateFlags, pStateFlags)
  m.set(pListEx, D2StatListExStrc.pGame, pGame)
  if (pOwner !== 0) {
    m.set(pOwner, D2UnitStrc.pStatListEx, pListEx)
  }
  return pListEx
}

/**
 * `D2Common 0x6FD87470` (`ENVIRONMENT_GetTimeOfDayAndAngle`):
 * Reads `pEnv = pAct->pEnvironment` (`+0x04`), returns `nTimeOfDay` (`+0x04`) and `nAngle`
 * (`pEnv->dwCyclePeriod != 0 ? trunc(pEnv->dwTicks / pEnv->dwCyclePeriod) : 0`).
 */
export function ENVIRONMENT_GetTimeOfDayAndAngle113c(
  m: Memory113c,
  pAct: number,
): { readonly timeOfDay: number; readonly angle: number } {
  if (pAct === 0) return { timeOfDay: 0, angle: 0 }
  const pEnv = m.get(pAct, D2ActStrc.pEnvironment)
  if (pEnv === 0) return { timeOfDay: 0, angle: 0 }
  const period = m.get(pEnv, D2EnvironmentStrc.dwCyclePeriod) | 0
  const ticks = m.get(pEnv, D2EnvironmentStrc.dwTicks) | 0
  const angle = period !== 0 ? Math.trunc(ticks / period) | 0 : 0
  const timeOfDay = m.get(pEnv, D2EnvironmentStrc.nTimeOfDay) | 0
  return { timeOfDay, angle }
}

/**
 * `D2Common.#10449` (`0x6FD96330` `ITEMS_CalcByTimeStat`):
 * Unpacks packed `(period:2, min:10, max:10)` signed `[-256, 767]` range from `rawValue`,
 * snaps `|nAngle - period * 90|` to 15-degree steps (`(delta + 7) / 15 * 15`), clamps to `[0, 359]`,
 * folds `(180, 359]` via `360 - step`, and interpolates `max - trunc(((max - min) * step) / 180)`.
 */
export function ITEMS_CalcByTimeStat113c(
  rawValue: number,
  _nTimeOfDay: number,
  nAngle: number,
): number {
  const raw = rawValue | 0
  const period = raw & 3
  const minVal = (((raw >> 2) & 0x3ff) - 0x100) | 0
  const maxVal = (((raw >> 12) & 0x3ff) - 0x100) | 0
  let delta = ((nAngle | 0) - imul32(period, 90)) | 0
  if (delta < 0) delta = (-delta) | 0
  const plus7 = (delta + 7) | 0
  let step = imul32(Math.trunc(plus7 / 15) | 0, 15)
  if (step <= 0) {
    step = 0
  } else if (step >= 0x167) {
    step = 0x168 - 0x167
  } else if (step > 0xb4) {
    step = (0x168 - step) | 0
  }
  const prod = imul32((maxVal - minVal) | 0, step)
  const scaled = Math.trunc(prod / 180) | 0
  return (maxVal - scaled) | 0
}

/**
 * `D2Common 0x6FD88CD0`: sum `dwKey` across `pList`'s own `BaseStats` (`+0x24`) and, when extended,
 * all active sub-lists chained from `pMyLastList` (`+0x3C`) along `pPrevLink` (`+0x2C`), skipping
 * `STATLIST_FLAG_MERGED` (`0x40000000`, `bType == 0` non-active weapon/armor merge) when
 * `ISC_FLAG_DAMAGE_RELATED` (`0x04`, `gdwBitMasks[2]`) is set (`0x6FD88D04..0x6FD88D3B`).
 */
export function STATLIST_SumDirectAndSubLists113c(
  m: Memory113c,
  pList: number,
  dwKey: number,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
): number {
  let sum = readStatFromArray(m, pList + D2StatListStrc.pStat.off, dwKey)
  const flags = m.get(pList, D2StatListStrc.dwFlags)
  if ((flags & STATLIST_FLAG_EXTENDED) === 0) {
    return sum | 0
  }
  const statId = (dwKey >>> 16) & 0xffff
  const meta = registry.get(statId)
  const metaFlags = meta !== undefined && meta.flags !== undefined ? meta.flags : 0
  const isDamageRelated = (metaFlags & ISC_FLAG_DAMAGE_RELATED) !== 0
  // Walk sub-lists (`pMyLastList` via `pPrevLink` `+0x2C` per `0x6FD88D23..0x6FD88D99`)
  for (
    let sub = m.get(pList, D2StatListExStrc.pMyLastList);
    sub !== 0;
    sub = m.get(sub, D2StatListStrc.pPrevLink)
  ) {
    const subFlags = m.get(sub, D2StatListStrc.dwFlags)
    if (isDamageRelated && (subFlags & STATLIST_FLAG_MERGED) !== 0) {
      continue
    }
    const pSubHdr =
      (subFlags & STATLIST_FLAG_EXTENDED) !== 0
        ? sub + D2StatListExStrc.pFullStat.off
        : sub + D2StatListStrc.pStat.off
    sum = (sum + readStatFromArray(m, pSubHdr, dwKey)) | 0
  }
  return sum | 0
}

/**
 * `D2Common 0x6FD89530` (`EvalStatWithOps`): exact implementation of the 13-entry jump table
 * at `0x6FD89AF0` (`op 1..13`).
 */
export function EvalStatWithOps113c(
  m: Memory113c,
  pList: number,
  dwKey: number,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
): number {
  const statId = (dwKey >>> 16) & 0xffff
  const rawBaseSum = STATLIST_SumDirectAndSubLists113c(m, pList, dwKey, registry)
  const revOps = registry.getReverseOps(statId)
  if (revOps.length === 0) {
    return rawBaseSum | 0
  }

  let total = rawBaseSum | 0
  let baseRef = rawBaseSum | 0
  const isEx = (m.get(pList, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) !== 0
  const pOwner = isEx ? m.get(pList, D2StatListExStrc.pOwner) : 0
  const ownerType = m.get(pList, D2StatListStrc.eOwnerType)

  for (const r of revOps) {
    const srcKey = statKey113c(r.sourceStat, 0)
    switch (r.op) {
      case 1: {
        // 0x6FD895D0: mulDiv113c(srcVal, baseRef, 100)
        if (pOwner === 0) break
        if (m.get(pOwner, D2UnitStrc.dwUnitType) === 4) {
          baseRef = STATLIST_GetUnitBaseStat113c(m, pOwner, statId, 0, registry)
        }
        if (baseRef === 0) break
        const srcVal = EvalStatWithOps113c(m, pList, srcKey, registry)
        if (srcVal !== 0) {
          total = (total + mulDiv113c(srcVal, baseRef, 100)) | 0
        }
        break
      }
      case 2:
      case 3: {
        // 0x6FD8960D / 0x6FD896AA: (srcVal * (opBase >> valShift)) >> opParam
        if ((ownerType !== 0 && ownerType !== 1) || r.opBase === 0xffff) break
        const pArr = isEx
          ? pList + D2StatListExStrc.pFullStat.off
          : pList + D2StatListStrc.pStat.off
        // Read opBase (evaluate if not yet materialized in FullStats)
        let opBaseRaw = readStatFromArray(m, pArr, statKey113c(r.opBase, 0))
        if (opBaseRaw === 0 && isEx) {
          opBaseRaw = EvalStatWithOps113c(m, pList, statKey113c(r.opBase, 0), registry)
        }
        const opBaseMeta = registry.get(r.opBase)
        const bValShift =
          opBaseMeta !== undefined && opBaseMeta.valShift !== undefined ? opBaseMeta.valShift : 0
        const opBaseShifted = sar32(opBaseRaw, bValShift)
        if (opBaseShifted <= 0) break
        const srcVal = EvalStatWithOps113c(m, pList, srcKey, registry)
        if (srcVal === 0) break
        const scaled = sar32(imul32(srcVal, opBaseShifted), r.opParam)
        if (r.op === 2) {
          total = (total + scaled) | 0
        } else if (baseRef !== 0) {
          total = (total + mulDiv113c(scaled, baseRef, 100)) | 0
        }
        break
      }
      case 4:
      case 5: {
        // 0x6FD8974B / 0x6FD897DD: item sub-list attached via `pList->pUnit (+0x04)`
        const pAttachUnit = m.get(pList, D2StatListStrc.pUnit)
        if (pAttachUnit === 0 || r.opBase === 0xffff) break
        const uType = m.get(pAttachUnit, D2UnitStrc.dwUnitType)
        if (uType !== 0 && uType !== 1) break
        const opBaseRaw = STATLIST_GetUnitStat113c(m, pAttachUnit, r.opBase, 0, registry)
        const opBaseMeta = registry.get(r.opBase)
        const bValShift =
          opBaseMeta !== undefined && opBaseMeta.valShift !== undefined ? opBaseMeta.valShift : 0
        const opBaseShifted = sar32(opBaseRaw, bValShift)
        if (opBaseShifted <= 0) break
        const srcVal = EvalStatWithOps113c(m, pList, srcKey, registry)
        if (srcVal === 0) break
        const scaled = sar32(imul32(srcVal, opBaseShifted), r.opParam)
        if (r.op === 4) {
          total = (total + scaled) | 0
        } else if (baseRef !== 0) {
          total = (total + mulDiv113c(scaled, baseRef, 100)) | 0
        }
        break
      }
      case 6:
      case 7: {
        // 0x6FD89872 / 0x6FD898D2: by-time scaling via 0x6FD87470 + 0x6FD96330
        if (pOwner === 0) break
        const pAct = m.get(pOwner, D2UnitStrc.pAct)
        const srcMeta = registry.get(r.sourceStat)
        if (pAct === 0 && !srcMeta?.evalByTime) break
        const srcVal = EvalStatWithOps113c(m, pList, srcKey, registry)
        if (srcVal === 0) break
        let byTime: number
        if (pAct !== 0) {
          const env = ENVIRONMENT_GetTimeOfDayAndAngle113c(m, pAct)
          byTime = ITEMS_CalcByTimeStat113c(srcVal, env.timeOfDay, env.angle)
        } else {
          byTime = srcMeta!.evalByTime!(pOwner, srcVal)
        }
        if (r.op === 6) {
          total = (total + byTime) | 0
        } else {
          // 0x6FD8992C..0x6FD8993E: op 7 scales running `total` ([esp+0x10]), NOT `baseRef`!
          total = (total + mulDiv113c(byTime, total, 100)) | 0
        }
        break
      }
      case 8: {
        // 0x6FD89947: non-base energy -> maxmana (`(fullEnergy - baseEnergy) * ManaPerMagic << 6`)
        if (pOwner === 0 || m.get(pOwner, D2UnitStrc.dwUnitType) !== 0) break
        const growth = registry.getCharGrowth(m.get(pOwner, D2UnitStrc.dwClassId))
        if (!growth) break
        const baseEne = readStatFromArray(m, pList + D2StatListStrc.pStat.off, srcKey)
        const fullEne = EvalStatWithOps113c(m, pList, srcKey, registry)
        const nonBase = (fullEne - baseEne) | 0
        if (nonBase !== 0) {
          total = (total + shl32(imul32(growth.manaPerMagic, nonBase), 6)) | 0
        }
        break
      }
      case 9: {
        // 0x6FD899C3: non-base vitality -> maxstamina (statId==11) or maxhp (`<< 6`)
        if (pOwner === 0 || m.get(pOwner, D2UnitStrc.dwUnitType) !== 0) break
        const growth = registry.getCharGrowth(m.get(pOwner, D2UnitStrc.dwClassId))
        if (!growth) break
        const baseVit = readStatFromArray(m, pList + D2StatListStrc.pStat.off, srcKey)
        const fullVit = EvalStatWithOps113c(m, pList, srcKey, registry)
        const nonBase = (fullVit - baseVit) | 0
        if (nonBase !== 0) {
          const factor = statId === 11 ? growth.staminaPerVitality : growth.lifePerVitality
          total = (total + shl32(imul32(factor, nonBase), 6)) | 0
        }
        break
      }
      case 10:
      case 12:
        // 0x6FD89ACF: no-op in 1.13c
        break
      case 11: {
        // 0x6FD89A5C: player/monster percentage bonus
        if (baseRef === 0 || pOwner === 0) break
        const uType = m.get(pOwner, D2UnitStrc.dwUnitType)
        if (uType !== 0 && uType !== 1) break
        const srcVal = EvalStatWithOps113c(m, pList, srcKey, registry)
        if (srcVal !== 0) {
          total = (total + mulDiv113c(srcVal, baseRef, 100)) | 0
        }
        break
      }
      case 13: {
        // 0x6FD89A87: local item percentage bonus (`dwUnitType == 4`)
        if (pOwner === 0 || m.get(pOwner, D2UnitStrc.dwUnitType) !== 4) break
        baseRef = STATLIST_GetUnitBaseStat113c(m, pOwner, statId, 0, registry)
        if (baseRef === 0) break
        const srcVal = EvalStatWithOps113c(m, pList, srcKey, registry)
        if (srcVal !== 0) {
          total = (total + mulDiv113c(srcVal, baseRef, 100)) | 0
        }
        break
      }
    }
  }
  return total | 0
}

/**
 * `D2Common 0x6FD89CE0..0x6FD89F48` (`STATLIST_RecomputeExStat`):
 * Evaluates `dwKey` via `EvalStatWithOps` (`0x6FD89530`), propagates to `wOpStat[0..2]` (`+0x58`),
 * applies the exact carrier-suppression switch (`0x6FD89F48` / `0x6FD89F60`), and updates
 * `wBaseDepStats[0..63]` (`+0x5E`).
 */
export function STATLIST_RecomputeExStat113c(
  m: Memory113c,
  pListEx: number,
  statId: number,
  layer = 0,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
  visited = new Set<number>(),
): number {
  if ((m.get(pListEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) === 0) return 0
  const key = statKey113c(statId, layer)
  if (visited.has(key)) {
    return EvalStatWithOps113c(m, pListEx, key, registry)
  }
  visited.add(key)

  const val = EvalStatWithOps113c(m, pListEx, key, registry)
  const meta = registry.get(statId)
  const keepZero = meta !== undefined && meta.keepZero !== undefined ? meta.keepZero : false
  const op = meta !== undefined && meta.op !== undefined ? meta.op : 0
  const opStats = meta !== undefined && meta.opStats !== undefined ? meta.opStats : []
  const baseDeps = registry.getBaseDependents(statId)
  const hasOpStat = (op >= 1 && op <= 13 && opStats.length > 0) || baseDeps.length > 0

  const hasDynOp = op === 4 || op === 5
  if (!hasOpStat) {
    // 0x6FD89CFD: byte [esi + 0x51] == 0 -> write directly to FullStats and return
    writeFullStat(m, pListEx, key, val, keepZero, hasDynOp)
  } else {
    // 0x6FD89D1E: if evaluated carrier == 0, clear stale FullStats slot immediately
    if (val === 0) {
      writeFullStat(m, pListEx, key, 0, keepZero, hasDynOp)
    }
    let keepCarrier = true // [esp + 0x10] = 1 at 0x6FD89D38
    const flags = m.get(pListEx, D2StatListStrc.dwFlags)
    const ownerType = m.get(pListEx, D2StatListStrc.eOwnerType)
    const selfRevOps = registry.getReverseOps(statId)

    for (let i = 0; i < 3 && i < opStats.length; i++) {
      const targetStat = opStats[i]!
      if (targetStat < 0 || targetStat === 0xffff) break
      const targetKey = statKey113c(targetStat, 0)
      const targetVal = STATLIST_RecomputeExStat113c(m, pListEx, targetStat, 0, registry, visited)
      const targetMeta = registry.get(targetStat)
      const targetKeepZero =
        targetMeta !== undefined && targetMeta.keepZero !== undefined ? targetMeta.keepZero : false
      const targetDynOp = targetMeta !== undefined && (targetMeta.op === 4 || targetMeta.op === 5)
      writeFullStat(m, pListEx, targetKey, targetVal, targetKeepZero, targetDynOp)

      if (targetVal !== 0) {
        // 0x6FD89DBB..0x6FD89E65: jump table 0x6FD89F48 indexed by 0x6FD89F60[bOp]
        // Note 0x6FD89DEA / 0x6FD89E38: 1.13c reads `word [esi + 0xDE + i*6]` (`unk_DE[i].wOpBase`,
        // zero-initialized to stat 0 `strength` unless another stat targets this carrier).
        const revEntry = selfRevOps[i]
        const unkDeBase = revEntry !== undefined ? revEntry.opBase : 0
        switch (op) {
          case 1:
          case 12:
            keepCarrier = false
            break
          case 2:
          case 3: {
            if ((ownerType === 0 || ownerType === 1) && unkDeBase !== 0xffff) {
              const checkHdr =
                (flags & STATLIST_FLAG_EXTENDED) !== 0
                  ? pListEx + D2StatListExStrc.pFullStat.off
                  : pListEx + D2StatListStrc.pStat.off
              if (readStatFromArray(m, checkHdr, statKey113c(unkDeBase, 0)) > 0) {
                keepCarrier = false
              }
            }
            break
          }
          case 4:
          case 5: {
            const pEquipUnit = m.get(pListEx, D2StatListStrc.pUnit)
            if (pEquipUnit !== 0 && unkDeBase !== 0xffff) {
              const eqType = m.get(pEquipUnit, D2UnitStrc.dwUnitType)
              if (
                (eqType === 0 || eqType === 1) &&
                STATLIST_GetUnitStat113c(m, pEquipUnit, unkDeBase, 0, registry) > 0
              ) {
                keepCarrier = false
              }
            }
            break
          }
          case 6:
          case 7:
            if (ownerType === 0 || ownerType === 1) {
              keepCarrier = false
            }
            break
          case 13:
            if (ownerType === 4) {
              keepCarrier = false
            }
            break
        }
      }
    }

    // 0x6FD89E9D..0x6FD89F36: write carrier if unconsumed, then recompute wBaseDepStats[0..63] (+0x5E)
    if (keepCarrier && val !== 0) {
      writeFullStat(m, pListEx, key, val, keepZero, hasDynOp)
      for (const depStat of baseDeps) {
        const depKey = statKey113c(depStat, 0)
        const depVal = STATLIST_RecomputeExStat113c(m, pListEx, depStat, 0, registry, visited)
        const depMeta = registry.get(depStat)
        const depKeepZero =
          depMeta !== undefined && depMeta.keepZero !== undefined ? depMeta.keepZero : false
        const depDynOp = depMeta !== undefined && (depMeta.op === 4 || depMeta.op === 5)
        writeFullStat(m, pListEx, depKey, depVal, depKeepZero, depDynOp)
      }
    }
  }
  return val
}

/**
 * `D2Common 0x6FD89F70` (`STATLIST_PropagateDelta`):
 * Propagates `(dwKey, delta)` from `pStartList` up the `pParent` (`+0x34`) chain:
 * - If `bHasOpStat == 0` (`+0x51`) and `bIsOpTarget == 0` (`+0x52`), applies additive fast-path
 *   `0x6FD889E0` (`addFullStatDelta(cur, dwKey, delta)`).
 * - Otherwise calls `0x6FD89CE0` (`STATLIST_RecomputeExStat113c(cur, statId, layer)`).
 * - Stops climbing `pParent` when `STATLIST_FLAG_SET` (`0x2000`) or
 *   (`ISC_FLAG_DAMAGE_RELATED` (`0x04`) && `STATLIST_FLAG_MERGED` (`0x40000000`)) is set on `cur`.
 */
export function STATLIST_PropagateDelta113c(
  m: Memory113c,
  pStartList: number,
  statId: number,
  layer: number,
  delta: number,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
): void {
  const d = delta | 0
  if (pStartList === 0 || d === 0 || statId < 0) return
  const meta = registry.get(statId)
  if (!meta) return
  const startFlags = m.get(pStartList, D2StatListStrc.dwFlags)
  if ((startFlags & STATLIST_FLAG_SET) !== 0) return

  const metaFlags = meta.flags !== undefined ? meta.flags : 0
  const isDamageRelated = (metaFlags & ISC_FLAG_DAMAGE_RELATED) !== 0
  const keepZero = meta.keepZero !== undefined ? meta.keepZero : false
  const op = meta.op !== undefined ? meta.op : 0
  const opStats = meta.opStats !== undefined ? meta.opStats : []
  const baseDeps = registry.getBaseDependents(statId)
  const bHasOpStat = (op >= 1 && op <= 13 && opStats.length > 0) || baseDeps.length > 0
  const bIsOpTarget = registry.getReverseOps(statId).length > 0
  const hasDynOp = op === 4 || op === 5
  const key = statKey113c(statId, layer)

  let cur =
    (startFlags & STATLIST_FLAG_EXTENDED) !== 0
      ? pStartList
      : m.get(pStartList, D2StatListStrc.pParent)

  while (cur !== 0) {
    if (!bHasOpStat && !bIsOpTarget) {
      addFullStatDelta(m, cur, key, d, keepZero, hasDynOp)
    } else {
      STATLIST_RecomputeExStat113c(m, cur, statId, layer, registry, new Set<number>())
    }
    const curFlags = m.get(cur, D2StatListStrc.dwFlags)
    cur = m.get(cur, D2StatListStrc.pParent)
    if ((curFlags & STATLIST_FLAG_SET) !== 0) break
    if (isDamageRelated && (curFlags & STATLIST_FLAG_MERGED) !== 0) break
  }
}

function collectSubListEntries113c(
  m: Memory113c,
  pSubList: number,
  registry: StatTableRegistry113c,
  skipDamageRelated: boolean,
): Array<readonly [number, number]> {
  const subFlags = m.get(pSubList, D2StatListStrc.dwFlags)
  const pHdr =
    (subFlags & STATLIST_FLAG_EXTENDED) !== 0
      ? pSubList + D2StatListExStrc.pFullStat.off
      : pSubList + D2StatListStrc.pStat.off
  const n = (m.u16(pHdr + 4) << 16) >> 16
  const p = m.u32(pHdr)
  const out: Array<readonly [number, number]> = []
  for (let i = 0; i < n; i++) {
    const k = m.u32(p + i * 8) | 0
    const v = m.u32(p + i * 8 + 4) | 0
    if (skipDamageRelated) {
      const sid = (k >>> 16) & 0xffff
      const sidMeta = registry.get(sid)
      const sidFlags = sidMeta !== undefined && sidMeta.flags !== undefined ? sidMeta.flags : 0
      if ((sidFlags & ISC_FLAG_DAMAGE_RELATED) !== 0) continue
    }
    out.push([k, v])
  }
  return out
}

function collectListStatKeys(
  m: Memory113c,
  pList: number,
  keys: Set<number>,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
  skipDamageRelated = false,
): void {
  const collectHdr = (pHdr: number): void => {
    const n = (m.u16(pHdr + 4) << 16) >> 16
    const p = m.u32(pHdr)
    for (let i = 0; i < n; i++) {
      const k = m.u32(p + i * 8) | 0
      if (skipDamageRelated) {
        const sid = (k >>> 16) & 0xffff
        const sidMeta = registry.get(sid)
        const sidFlags = sidMeta !== undefined && sidMeta.flags !== undefined ? sidMeta.flags : 0
        if ((sidFlags & ISC_FLAG_DAMAGE_RELATED) !== 0) continue
      }
      keys.add(k)
    }
  }
  collectHdr(pList + D2StatListStrc.pStat.off)
  if ((m.get(pList, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) !== 0) {
    collectHdr(pList + D2StatListExStrc.pFullStat.off)
  }
}

function recomputeItemDynamicOps113c(
  m: Memory113c,
  pSubList: number,
  registry: StatTableRegistry113c,
): void {
  const subFlags = m.get(pSubList, D2StatListStrc.dwFlags)
  if ((subFlags & STATLIST_FLAG_EXTENDED) === 0 || (subFlags & STATLIST_FLAG_DYNAMIC_OP) === 0) {
    return
  }
  const pFullHdr = pSubList + D2StatListExStrc.pFullStat.off
  const n = (m.u16(pFullHdr + 4) << 16) >> 16
  const p = m.u32(pFullHdr)
  const dynKeys: number[] = []
  for (let i = 0; i < n; i++) {
    const k = m.u32(p + i * 8) | 0
    const sid = (k >>> 16) & 0xffff
    const sidMeta = registry.get(sid)
    const op = sidMeta !== undefined && sidMeta.op !== undefined ? sidMeta.op : 0
    if (op === 4 || op === 5) {
      dynKeys.push(k)
    }
  }
  for (const k of dynKeys) {
    const sid = (k >>> 16) & 0xffff
    const layer = k & 0xffff
    STATLIST_RecomputeExStat113c(m, pSubList, sid, layer, registry, new Set<number>())
  }
}

/** Recompute all keys present on `pListEx` and its sub-lists (plus optional `extraKeys` from a detached sub-list). */
export function STATLIST_RebuildAllExStats113c(
  m: Memory113c,
  pListEx: number,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
  extraKeys?: Iterable<number>,
): void {
  if (pListEx === 0 || (m.get(pListEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) === 0) return
  const keys = new Set<number>(extraKeys)
  collectListStatKeys(m, pListEx, keys, registry, false)
  for (
    let sub = m.get(pListEx, D2StatListExStrc.pMyLastList);
    sub !== 0;
    sub = m.get(sub, D2StatListStrc.pPrevLink)
  ) {
    const subMerged = (m.get(sub, D2StatListStrc.dwFlags) & STATLIST_FLAG_MERGED) !== 0
    collectListStatKeys(m, sub, keys, registry, subMerged)
  }
  const plainKeys: number[] = []
  const opTargetKeys: number[] = []
  for (const k of keys) {
    const statId = (k >>> 16) & 0xffff
    if (registry.getReverseOps(statId).length === 0) {
      plainKeys.push(k)
    } else {
      opTargetKeys.push(k)
    }
  }
  for (const k of plainKeys) {
    STATLIST_RecomputeExStat113c(m, pListEx, (k >>> 16) & 0xffff, k & 0xffff, registry, new Set<number>())
  }
  for (const k of opTargetKeys) {
    STATLIST_RecomputeExStat113c(m, pListEx, (k >>> 16) & 0xffff, k & 0xffff, registry, new Set<number>())
  }
}

/**
 * `D2Common 0x6FD88160`: binary search `pModStat` (`pListEx + 0x50`: `+0 pModStat`, `+4 wModStatCount`, `+6 wModStatCap`)
 * under signed 32-bit `dwKey` ordering. Returns `-1` if `dwKey` is already present (`0x6FD88195`),
 * or the sorted insertion index `0 <= ins <= count` (`0x6FD88190`).
 */
export function STATLIST_FindModStatInsertPos113c(
  m: Memory113c,
  pModHdr: number,
  dwKey: number,
): number {
  const count = (m.u16(pModHdr + 4) << 16) >> 16
  if (count <= 0) return 0
  const pMod = m.u32(pModHdr)
  const target = dwKey | 0
  let lo = 0
  let hi = count
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const curKey = m.u32(pMod + mid * 4) | 0
    if (target > curKey) {
      lo = mid + 1
    } else if (target < curKey) {
      hi = mid
    } else {
      return -1
    }
  }
  return lo
}

/**
 * `@va D2Common:0x6FD88550` (`STATLIST_RecordModStat`, `ebx = pListEx`, `eax = dwKey`):
 * Records `dwKey` in `pListEx->pModStat` (`+0x50` ptr, `+0x54` `wModStatCount`, `+0x56` `wModStatCap`)
 * when `pListEx` is extended, `statId` is not in `{6, 8, 10, 13, 14}` (`0x6FD88568..0x6FD88577`),
 * `0 <= statId < 359`, and `ItemStatCost.bin[statId].dwFlags & ISC_FLAG_SAVED` (`0x1000`, `0x6FD885AA`) is set.
 * Grows `pModStat` by `+4` dwords (`newCap * 4` bytes) when `count >= cap` (`0x6FD885CB..0x6FD885F8`).
 */
export function STATLIST_RecordModStat113c(
  m: Memory113c,
  pListEx: number,
  dwKey: number,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
): void {
  if (pListEx === 0) return
  if ((m.get(pListEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) === 0) return
  const statId = (dwKey >>> 16) & 0xffff
  // 0x6FD88568..0x6FD88577 jump table at 0x6FD88628 / 0x6FD88630: skip 6, 8, 10, 13, 14
  if (statId === 6 || statId === 8 || statId === 10 || statId === 13 || statId === 14) {
    return
  }
  if ((statId | 0) < 0 || statId >= ITEM_STAT_COST_COUNT_113C) return
  const meta = registry.get(statId)
  if (meta === undefined) return
  const metaFlags = meta.flags !== undefined ? meta.flags : 0
  if ((metaFlags & ISC_FLAG_SAVED) === 0) return

  const pModHdr = pListEx + D2StatListExStrc.pModStat.off
  const ins = STATLIST_FindModStatInsertPos113c(m, pModHdr, dwKey)
  if (ins < 0) return

  const count = (m.u16(pModHdr + 4) << 16) >> 16
  let cap = (m.u16(pModHdr + 6) << 16) >> 16
  let pMod = m.u32(pModHdr)
  if (count >= cap) {
    const newCap = (cap + 4) & 0xffff
    const nextBuf = m.alloc(((newCap << 16) >> 16) * 4)
    for (let i = 0; i < count * 4; i += 4) {
      m.setU32(nextBuf + i, m.u32(pMod + i))
    }
    if (pMod !== 0) {
      ;(m as { free?: (p: number) => void }).free?.(pMod)
    }
    pMod = nextBuf
    cap = (newCap << 16) >> 16
    m.setU32(pModHdr, pMod)
    m.setU16(pModHdr + 6, newCap)
  }
  for (let i = count; i > ins; i--) {
    m.setU32(pMod + i * 4, m.u32(pMod + (i - 1) * 4))
  }
  m.setU32(pMod + ins * 4, dwKey >>> 0)
  m.setU16(pModHdr + 4, (count + 1) & 0xffff)
}

/**
 * `D2Common.#10188` (`0x6FD8A7B0` -> `0x6FD8A280` `STATLIST_SetStatIfListIsValid`).
 * Returns `1` if the stat changed (`delta != 0`), `0` if unchanged.
 */
export function STATLIST_SetStat113c(
  m: Memory113c,
  pList: number,
  statId: number,
  value: number,
  layer = 0,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
): number {
  if (pList === 0 || statId < 0) return 0
  const key = statKey113c(statId, layer)
  const pBaseHdr = pList + D2StatListStrc.pStat.off
  const newVal = value | 0
  const idx = STATLIST_FindStatIndex113c(m, pBaseHdr, key)

  let oldVal = 0
  if (idx >= 0) {
    const pStat = m.u32(pBaseHdr)
    oldVal = m.u32(pStat + idx * 8 + 4) | 0
    if (oldVal === newVal) return 0
    if (newVal === 0) {
      removeStatSlot(m, pBaseHdr, idx)
    } else {
      m.setU32(pStat + idx * 8 + 4, newVal >>> 0)
    }
  } else {
    if (newVal === 0) return 0
    const ins = STATLIST_FindInsertPos113c(m, pBaseHdr, key)
    const entryPtr = insertStatSlot(m, pBaseHdr, ins, key)
    m.setU32(entryPtr + 4, newVal >>> 0)
  }

  // 0x6FD8A2FC..0x6FD8A301: propagate `(dwKey, newVal - oldVal)` via `0x6FD89F70`
  STATLIST_PropagateDelta113c(m, pList, statId, layer, (newVal - oldVal) | 0, registry)
  // 0x6FD8A309..0x6FD8A316: when `eOwnerType == 0` (player), record modified stat key via `0x6FD88550`
  if (m.get(pList, D2StatListStrc.eOwnerType) === 0) {
    STATLIST_RecordModStat113c(m, pList, key, registry)
  }
  return 1
}

/** `D2Common 0x6FD8A330` (`STATLIST_AddStat`). */
export function STATLIST_AddStat113c(
  m: Memory113c,
  pList: number,
  statId: number,
  delta: number,
  layer = 0,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
): number {
  if (pList === 0 || (delta | 0) === 0) return 0
  const key = statKey113c(statId, layer)
  const cur = readStatFromArray(m, pList + D2StatListStrc.pStat.off, key)
  const changed = STATLIST_SetStat113c(m, pList, statId, (cur + (delta | 0)) | 0, layer, registry)
  if (changed !== 0 && m.get(pList, D2StatListStrc.eOwnerType) === 0) {
    STATLIST_RecordModStat113c(m, pList, key, registry)
  }
  return changed
}

/**
 * `D2Common.#10887` (`0x6FD8A740` `STATLIST_SetUnitStat`).
 * Note: in native 1.13c `D2Common.dll`, `#10887` has C return type `void` (when `pUnit->dwUnitType == 0`
 * and `STATLIST_SetStat` returns `1`, `0x6FD8A775` calls `void 0x6FD88550` `STATLIST_RecordModStat`
 * which clobbers `eax`); `#10188` (`0x6FD8A7B0` -> `0x6FD8A280`) returns `BOOL` (`0` or `1`).
 */
export function STATLIST_SetUnitStat113c(
  m: Memory113c,
  pUnit: number,
  statId: number,
  value: number,
  layer = 0,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
): number {
  if (pUnit === 0) return 0
  const pList = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pList === 0) return 0
  const changed = STATLIST_SetStat113c(m, pList, statId, value, layer, registry)
  if (changed !== 0 && m.get(pUnit, D2UnitStrc.dwUnitType) === 0) {
    STATLIST_RecordModStat113c(m, pList, statKey113c(statId, layer), registry)
  }
  return changed
}

/** `D2Common.#10551` (`0x6FD8A710` `STATLIST_AddUnitStat`). */
export function STATLIST_AddUnitStat113c(
  m: Memory113c,
  pUnit: number,
  statId: number,
  delta: number,
  layer = 0,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
): number {
  if (pUnit === 0 || (delta | 0) === 0) return 0
  const pList = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pList === 0) return 0
  return STATLIST_AddStat113c(m, pList, statId, delta, layer, registry)
}

/**
 * `D2Common 0x6FD88AB9..0x6FD88AED` / `0x6FD88B2B..0x6FD88B62`:
 * Clamps a PRESENT stat slot (`idx >= 0`) on an extended player/monster `StatListEx` (`pOwner->dwUnitType` in `{0, 1}`):
 * `if (rawVal < dwMinAccr) rawVal = dwMinAccr << bValShift;`
 * Absent slots (`idx < 0`) return `0` BEFORE reaching this clamp (`0x6FD88A9C` / `0x6FD88B12`).
 */
function clampPresentMinStat113c(
  m: Memory113c,
  pList: number,
  statId: number,
  rawVal: number,
  registry: StatTableRegistry113c,
): number {
  const flags = m.get(pList, D2StatListStrc.dwFlags)
  if ((flags & STATLIST_FLAG_EXTENDED) === 0) return rawVal | 0
  const pOwner = m.get(pList, D2StatListExStrc.pOwner)
  if (pOwner === 0) return rawVal | 0
  const ownerType = m.get(pOwner, D2UnitStrc.dwUnitType)
  if (ownerType !== 0 && ownerType !== 1) return rawVal | 0
  const meta = registry.get(statId)
  if (meta === undefined || !meta.fMin) return rawVal | 0
  const minAccr = (meta.minAccr !== undefined ? meta.minAccr : 0) | 0
  const val = rawVal | 0
  if (val < minAccr) {
    return shl32(minAccr, meta.valShift !== undefined ? meta.valShift : 0)
  }
  return val
}

/** `D2Common.#10973` (`0x6FD88B70` -> `0x6FD88A80` `STATLIST_GetUnitStat`). */
export function STATLIST_GetUnitStat113c(
  m: Memory113c,
  pUnit: number,
  statId: number,
  layer = 0,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
): number {
  if (pUnit === 0 || statId < 0) return 0
  const pList = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pList === 0) return 0
  const flags = m.get(pList, D2StatListStrc.dwFlags)
  const pHdr =
    (flags & STATLIST_FLAG_EXTENDED) !== 0
      ? pList + D2StatListExStrc.pFullStat.off
      : pList + D2StatListStrc.pStat.off
  const idx = STATLIST_FindStatIndex113c(m, pHdr, statKey113c(statId, layer))
  if (idx < 0) return 0
  const raw = m.u32(m.u32(pHdr) + idx * 8 + 4) | 0
  return clampPresentMinStat113c(m, pList, statId, raw, registry)
}

/** `D2Common.#10587` (`0x6FD88C20` -> `0x6FD88B00` `STATLIST_GetUnitBaseStat`). */
export function STATLIST_GetUnitBaseStat113c(
  m: Memory113c,
  pUnit: number,
  statId: number,
  layer = 0,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
): number {
  if (pUnit === 0 || statId < 0) return 0
  const pList = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pList === 0) return 0
  const pHdr = pList + D2StatListStrc.pStat.off
  const idx = STATLIST_FindStatIndex113c(m, pHdr, statKey113c(statId, layer))
  if (idx < 0) return 0
  const raw = m.u32(m.u32(pHdr) + idx * 8 + 4) | 0
  return clampPresentMinStat113c(m, pList, statId, raw, registry)
}

/**
 * `D2Common.#10807` (`0x6FD8A7D0` `STATLIST_MergeStatLists`):
 * Unlinks `pSubList` if previously attached, links into `pMyStats` (`+0x40`) when `STATLIST_FLAG_SET` (`0x2000`),
 * otherwise links into `pMyLastList` (`+0x3C`), sets `pSubList->pUnit = pTargetUnit`, re-evaluates `op 4/5`
 * dynamic item stats (`STATLIST_FLAG_DYNAMIC_OP`), sets (`bType == 0`) or clears (`bType != 0`)
 * `STATLIST_FLAG_MERGED` (`0x40000000`), and propagates stats to `pTargetUnit`'s `D2StatListExStrc`.
 */
export function STATLIST_MergeStatLists113c(
  m: Memory113c,
  pTargetUnit: number,
  pSubList: number,
  bType: number,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
): void {
  if (pTargetUnit === 0 || pSubList === 0) return
  const pParentEx = m.get(pTargetUnit, D2UnitStrc.pStatListEx)
  if (pParentEx === 0 || (m.get(pParentEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) === 0) {
    return
  }
  STATLIST_InsertSubList113c(m, pParentEx, pSubList, registry, bType, pTargetUnit)
}

/**
 * Attach `pSubList` onto `pParentEx` (`bType = 0` for equipped item with `ISC_FLAG_ITEM_SPECIFIC`
 * isolation; `bType = 1` default for state/aura/buff sub-list).
 */
export function STATLIST_InsertSubList113c(
  m: Memory113c,
  pParentEx: number,
  pSubList: number,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
  bType = 1,
  pTargetUnitOverride?: number,
): void {
  if (pParentEx === 0 || pSubList === 0) return
  if ((m.get(pParentEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) === 0) return
  if (m.get(pSubList, D2StatListStrc.pParent) !== 0) {
    STATLIST_RemoveSubList113c(m, pSubList, registry)
  }

  // 0x6FD8A800..0x6FD8A80D: cycle check up pParent chain
  for (let cur = pParentEx; cur !== 0; cur = m.get(cur, D2StatListStrc.pParent)) {
    if (cur === pSubList) return
  }

  const pTargetUnit =
    pTargetUnitOverride !== undefined ? pTargetUnitOverride : m.get(pParentEx, D2StatListExStrc.pOwner)
  const subFlags0 = m.get(pSubList, D2StatListStrc.dwFlags)
  if ((subFlags0 & 0x04) !== 0) {
    m.set(
      pParentEx,
      D2StatListStrc.dwFlags,
      (m.get(pParentEx, D2StatListStrc.dwFlags) | STATLIST_FLAG_TIMED) >>> 0,
    )
  }

  // 0x6FD8A81C..0x6FD8A844: STATLIST_FLAG_SET (0x2000) links into pMyStats (+0x40) without FullStats merge
  if ((subFlags0 & STATLIST_FLAG_SET) !== 0) {
    const oldSet = m.get(pParentEx, D2StatListExStrc.pMyStats)
    m.set(pSubList, D2StatListStrc.pPrevLink, oldSet)
    if (oldSet !== 0) m.set(oldSet, D2StatListStrc.pNextLink, pSubList)
    m.set(pSubList, D2StatListStrc.pNextLink, 0)
    m.set(pParentEx, D2StatListExStrc.pMyStats, pSubList)
    m.set(pSubList, D2StatListStrc.pParent, pParentEx)
    m.set(pSubList, D2StatListStrc.pUnit, pTargetUnit)
    return
  }

  const oldLast = m.get(pParentEx, D2StatListExStrc.pMyLastList)
  m.set(pSubList, D2StatListStrc.pPrevLink, oldLast)
  m.set(pSubList, D2StatListStrc.pNextLink, 0)
  if (oldLast !== 0) {
    m.set(oldLast, D2StatListStrc.pNextLink, pSubList)
  }
  m.set(pParentEx, D2StatListExStrc.pMyLastList, pSubList)
  m.set(pSubList, D2StatListStrc.pUnit, pTargetUnit)

  // 0x6FD8A87C..0x6FD8A91A: re-evaluate op 4/5 dynamic item stats on extended sub-list BEFORE setting pParent
  recomputeItemDynamicOps113c(m, pSubList, registry)

  m.set(pSubList, D2StatListStrc.pParent, pParentEx)
  const curFlags = m.get(pSubList, D2StatListStrc.dwFlags)
  const nextFlags =
    bType === 0
      ? (curFlags | STATLIST_FLAG_MERGED) >>> 0
      : (curFlags & ~STATLIST_FLAG_MERGED) >>> 0
  m.set(pSubList, D2StatListStrc.dwFlags, nextFlags)

  // 0x6FD8A91C..0x6FD8A9D5: propagate each sub-list entry via `0x6FD89F70`
  const entries = collectSubListEntries113c(m, pSubList, registry, bType === 0)
  for (const [k, v] of entries) {
    STATLIST_PropagateDelta113c(m, pParentEx, (k >>> 16) & 0xffff, k & 0xffff, v, registry)
  }
}

/** `D2Common.#11111` (`0x6FD8A5F0` `STATLIST_UnlinkSubList`). */
export function STATLIST_UnlinkSubList113c(
  m: Memory113c,
  _pTargetUnit: number,
  pSubList: number,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
): void {
  STATLIST_RemoveSubList113c(m, pSubList, registry)
}

export const STATLIST_RemoveStatListFromUnit113c = STATLIST_UnlinkSubList113c

/**
 * `D2Common 0x6FD8A3B0` (`STATLIST_UnlinkSubListInternal`):
 * Unlinks `pSubList` from its parent `D2StatListExStrc`, clears `pUnit`, re-evaluates any active
 * `op 4/5` dynamic stats on `pSubList`, and subtracts each sub-list entry from parent `FullStats`
 * via `0x6FD89F70`.
 */
export function STATLIST_RemoveSubList113c(
  m: Memory113c,
  pSubList: number,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
): void {
  if (pSubList === 0) return
  const pParentEx = m.get(pSubList, D2StatListStrc.pParent)
  const subFlags = m.get(pSubList, D2StatListStrc.dwFlags)
  const wasMerged = (subFlags & STATLIST_FLAG_MERGED) !== 0

  const prev = m.get(pSubList, D2StatListStrc.pPrevLink)
  const next = m.get(pSubList, D2StatListStrc.pNextLink)
  if (pParentEx !== 0 && (m.get(pParentEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) !== 0) {
    if (m.get(pParentEx, D2StatListExStrc.pMyLastList) === pSubList) {
      m.set(pParentEx, D2StatListExStrc.pMyLastList, prev)
    }
    if (m.get(pParentEx, D2StatListExStrc.pMyStats) === pSubList) {
      m.set(pParentEx, D2StatListExStrc.pMyStats, prev)
    }
  }
  if (next !== 0) m.set(next, D2StatListStrc.pPrevLink, prev)
  if (prev !== 0) m.set(prev, D2StatListStrc.pNextLink, next)

  m.set(pSubList, D2StatListStrc.pParent, 0)
  m.set(pSubList, D2StatListStrc.pPrevLink, 0)
  m.set(pSubList, D2StatListStrc.pNextLink, 0)
  m.set(pSubList, D2StatListStrc.pUnit, 0)

  if ((subFlags & STATLIST_FLAG_SET) !== 0) {
    return
  }

  // 0x6FD8A44E..0x6FD8A4EA: re-evaluate op 4/5 dynamic item stats after clearing pUnit
  recomputeItemDynamicOps113c(m, pSubList, registry)

  // 0x6FD8A4EF..0x6FD8A59D: propagate `-nVal` for each sub-list entry via `0x6FD89F70`
  if (pParentEx !== 0) {
    const entries = collectSubListEntries113c(m, pSubList, registry, wasMerged)
    for (const [k, v] of entries) {
      STATLIST_PropagateDelta113c(m, pParentEx, (k >>> 16) & 0xffff, k & 0xffff, (-v) | 0, registry)
    }
  }
}

/**
 * `@va D2Common:0x6FD87F80` (`STATLIST_FindSubListByStateAndFlags`, `__fastcall (ecx = pStatListEx, edx = stateId)`):
 * Returns `0` if `pStatListEx == 0`, `stateId == 0`, or `(pStatListEx->dwFlags (+0x10) & 0x80000000) == 0`;
 * otherwise walks `pMyLastList (+0x3C)` then `pMyStats (+0x40)` via `pPrevLink (+0x2C)` and returns the first
 * sublist with `dwStateNo (+0x14) == stateId` (`0` if not found).
 */
function findSubListByStateAndFlags113c(
  m: Memory113c,
  pStatListEx: number,
  stateId: number,
): number {
  if (pStatListEx === 0 || stateId === 0) return 0
  if ((m.get(pStatListEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) === 0) {
    return 0
  }
  const target = stateId >>> 0
  for (
    let sub = m.get(pStatListEx, D2StatListExStrc.pMyLastList);
    sub !== 0;
    sub = m.get(sub, D2StatListStrc.pPrevLink)
  ) {
    if (m.get(sub, D2StatListStrc.dwStateNo) === target) return sub
  }
  for (
    let sub = m.get(pStatListEx, D2StatListExStrc.pMyStats);
    sub !== 0;
    sub = m.get(sub, D2StatListStrc.pPrevLink)
  ) {
    if (m.get(sub, D2StatListStrc.dwStateNo) === target) return sub
  }
  return 0
}

/** `D2Common.#10871` (`0x6FD88520` -> `0x6FD87F80` `STATLIST_GetStatListFromUnitAndState`). */
export function STATLIST_GetStatListFromUnitAndState113c(
  m: Memory113c,
  pUnit: number,
  stateId: number,
): number {
  if (pUnit === 0) return 0
  const pListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pListEx === 0 || (m.get(pListEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) === 0) {
    return 0
  }
  return findSubListByStateAndFlags113c(m, pListEx, stateId)
}

/**
 * `D2Common.#10494` (`0x6FD83CD0` `STATES_CheckState`):
 * Valid only on `dwUnitType` in `{0, 1, 3}` (`player`, `monster`, `missile`) and `0 <= stateId < 185`.
 * Returns raw masked bit (`1 << (stateId & 31)` >>> 0) or `0`.
 */
export function STATES_CheckState113c(m: Memory113c, pUnit: number, stateId: number): number {
  if (pUnit === 0) return 0
  const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
  if (uType !== 0 && uType !== 1 && uType !== 3) return 0
  if (stateId < 0 || stateId >= STATES_COUNT_113C) return 0
  const pListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pListEx === 0 || (m.get(pListEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) === 0) {
    return 0
  }
  const pStateFlags = m.get(pListEx, D2StatListExStrc.pStateFlags)
  if (pStateFlags === 0) return 0
  const wordIdx = stateId >> 5
  const mask = (1 << (stateId & 31)) >>> 0
  return (m.u32(pStateFlags + wordIdx * 4) & mask) >>> 0
}

/**
 * `States.bin` (`185` states, stride `60` bytes) `+0x12` bit `0` (`disguise`, `fStateMasks[16]` at `[sgptDataTables+0x10C]`)
 * 6-dword bitmask: exact active states `{63, 93, 119, 139, 140, 176, 177}` extracted from 1.13c `states.bin`.
 */
export const DISGUISE_STATE_MASK_WORDS_113C: readonly [
  number,
  number,
  number,
  number,
  number,
  number,
] = [
  0x00000000, // states 0..31:   none
  0x80000000, // states 32..63:  63 (bit 31)
  0x20000000, // states 64..95:  93 (bit 29)
  0x00800000, // states 96..127: 119 (bit 23)
  0x00001800, // states 128..159: 139 (bit 11), 140 (bit 12)
  0x00030000, // states 160..184: 176 (bit 16), 177 (bit 17)
]

export const UNITFLAG2_DISGUISE_113C = 0x00000008

/**
 * `@va D2Common:0x6FD83C20` (`STATES_CheckStateMaskOnUnit`, `eax = pUnit`, `ecx = pMaskWords`):
 * Checks `pUnit != 0`, `pListEx = pUnit->pStatListEx (+0x5C)`, `(pListEx->dwFlags & 0x80000000) != 0`,
 * and `pStateFlags = pListEx->pStateFlags (+0x58) != 0`, then computes
 * `nDwords = ((nStatesTxtRecordCount + 31) + (((nStatesTxtRecordCount + 31) >> 31) & 31)) >> 5`
 * from `sgptDataTables+0xC4` (falling back to `STATE_DWORDS_113C = 6` when `sgptDataTables == 0`)
 * and scans `pStateFlags[0..nDwords-1]` against `maskWords[0..nDwords-1]`, returning `1` if any
 * `pStateFlags[i] & maskWords[i]` is non-zero, else `0`.
 */
export function STATES_CheckStateMaskOnUnit113c(
  m: Memory113c,
  pUnit: number,
  maskWords: number | ArrayLike<number>,
): number {
  if (pUnit === 0) return 0
  const pListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pListEx === 0 || (m.get(pListEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) === 0) {
    return 0
  }
  const pStateFlags = m.get(pListEx, D2StatListExStrc.pStateFlags)
  if (pStateFlags === 0) return 0
  if (typeof maskWords === 'number') {
    const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    let nDwords = STATE_DWORDS_113C
    if (sgpt !== 0) {
      const cnt = ((m.u32((sgpt + 0xc4) >>> 0) | 0) + 31) | 0
      nDwords = sar32((cnt + ((cnt >> 31) & 31)) | 0, 5)
    }
    if (nDwords <= 0) return 0
    const pMask = maskWords >>> 0
    for (let i = 0; i < nDwords; i++) {
      const stateWord = m.u32((pStateFlags + i * 4) >>> 0)
      const maskWord = m.u32((pMask + i * 4) >>> 0)
      if ((stateWord & maskWord) !== 0) {
        return 1
      }
    }
  } else {
    for (let i = 0; i < STATE_DWORDS_113C; i++) {
      const maskWord = (i < maskWords.length ? maskWords[i]! : 0) >>> 0
      if (maskWord !== 0 && (m.u32((pStateFlags + i * 4) >>> 0) & maskWord) !== 0) {
        return 1
      }
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD83D60` (`D2Common.#10541` `STATES_CheckStateMask33OnUnit`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `0` or `1`).
 *
 * Reads `pMask = [sgptDataTables + 0x150]` (`fStateMasks[33]`)
 * and delegates to `0x6FD83C20` (`STATES_CheckStateMaskOnUnit113c`).
 */
export function STATES_CheckStateMask33OnUnit113c(m: Memory113c, pUnit: number): number {
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const pMask = m.u32((sgpt + 0x150) >>> 0)
  return STATES_CheckStateMaskOnUnit113c(m, pUnit, pMask)
}

/**
 * `@va D2Common:0x6FD88730` (`STATES_ToggleState`):
 * - Internal helper called by `D2Common.#10945` (`0x6FD84510`), `0x6FD83060`, `0x6FD8AE97`, and `0x6FDA1FA1`
 *   (caller enforces `0 <= stateId < 185`; we retain `0 <= stateId < STATES_COUNT_113C` array-bounds safety).
 * - Reads `pListEx = pUnit->pStatListEx (+0x5C)`: returns immediately when `0` or non-extended
 *   (NEVER allocates a `D2StatListExStrc`).
 * - Toggles `stateId` in `pStateFlags[0..5]`; if the bit actually flipped, sets the dirty/gfx bit
 *   in `pStateFlags[6..11]` (`wordIdx + 6`) and updates `pUnit->dwFlags2 (+0xC8)` bit `0x08`
 *   for `States.bin + 0x12` bit `0` (`disguise`: `{63, 93, 119, 139, 140, 176, 177}`) via `0x6FD83C20`.
 */
export function STATES_ToggleState113c(
  m: Memory113c,
  pUnit: number,
  stateId: number,
  bSet: boolean | number,
): void {
  if (pUnit === 0 || stateId < 0 || stateId >= STATES_COUNT_113C) return
  const pListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pListEx === 0 || (m.get(pListEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) === 0) {
    return
  }
  const pStateFlags = m.get(pListEx, D2StatListExStrc.pStateFlags)
  if (pStateFlags === 0) return

  const setFlag = Boolean(bSet)
  const wordIdx = stateId >> 5
  const mask = (1 << (stateId & 31)) >>> 0
  const curWord = m.u32(pStateFlags + wordIdx * 4)
  const wasSet = (curWord & mask) !== 0
  if (wasSet === setFlag) return

  const nextWord = setFlag ? (curWord | mask) >>> 0 : (curWord & ~mask) >>> 0
  m.setU32(pStateFlags + wordIdx * 4, nextWord)

  // Dirty/gfx bitvector sits immediately after the 6 active dwords (`+6 * 4 = +0x18`)
  const dirtyAddr = pStateFlags + (wordIdx + STATE_DWORDS_113C) * 4
  m.setU32(dirtyAddr, (m.u32(dirtyAddr) | mask) >>> 0)

  // `0x6FD887E8..0x6FD88838`: `States.bin + 0x12` bit 0 (`disguise`) -> `pUnit->dwFlags2 (+0xC8)` bit `0x08`
  if (((DISGUISE_STATE_MASK_WORDS_113C[wordIdx] as number) & mask) !== 0) {
    const flags2 = m.get(pUnit, D2UnitStrc.dwFlags2)
    if (setFlag) {
      m.set(pUnit, D2UnitStrc.dwFlags2, (flags2 | UNITFLAG2_DISGUISE_113C) >>> 0)
    } else if (STATES_CheckStateMaskOnUnit113c(m, pUnit, DISGUISE_STATE_MASK_WORDS_113C) === 0) {
      m.set(pUnit, D2UnitStrc.dwFlags2, (flags2 & ~UNITFLAG2_DISGUISE_113C) >>> 0)
    }
  }
}

/**
 * `@va D2Common:0x6FD84510` (`D2Common.#10945` `STATES_ToggleGfxStateFlag`):
 * Checks `0 <= stateId < 185` (`[sgptDataTables+0xC4]`), calls `0x6FD88730` (`STATES_ToggleState113c`),
 * and calls `D2Common.#10158` (`0x6FDB65C0` `UNITROOM_RefreshUnit113c`) at `0x6FD84537`.
 */
export function STATES_ToggleGfxStateFlag113c(
  m: Memory113c,
  pUnit: number,
  stateId: number,
  bSet: number | boolean,
): void {
  if (stateId < 0 || stateId >= STATES_COUNT_113C) return
  STATES_ToggleState113c(m, pUnit, stateId, Boolean(bSet))
  UNITROOM_RefreshUnit113c(m, pUnit)
}

/** `D2Common.#10446` (`0x6FD843E0`): read dirty/gfx state bit (`pStateFlags[(stateId >> 5) + 6] & (1 << (stateId & 31))`). */
export function STATES_CheckGfxStateFlag113c(m: Memory113c, pUnit: number, stateId: number): number {
  if (pUnit === 0 || stateId < 0 || stateId >= STATES_COUNT_113C) return 0
  const pListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pListEx === 0 || (m.get(pListEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) === 0) {
    return 0
  }
  const pStateFlags = m.get(pListEx, D2StatListExStrc.pStateFlags)
  if (pStateFlags === 0) return 0
  const wordIdx = (stateId >> 5) + STATE_DWORDS_113C
  const mask = (1 << (stateId & 31)) >>> 0
  return (m.u32(pStateFlags + wordIdx * 4) & mask) >>> 0
}

/**
 * `@va D2Common:0x6FD84450` (`D2Common.#11039` `STATES_ClearGfxStateFlag`):
 * Checks `pUnit != 0`, `pListEx != 0`, `(pListEx->dwFlags & 0x80000000) != 0`, `pStateFlags != 0`,
 * and `0 <= stateId < 185`. When `bSet == 0` (default), clears `pStateFlags[6 + (stateId >> 5)] &= ~mask`
 * (`0x6FD844DD`); when `bSet != 0`, sets `pStateFlags[6 + (stateId >> 5)] |= mask` (`0x6FD844BA`);
 * both paths then call `D2Common.#10158` (`0x6FDB65C0` `UNITROOM_RefreshUnit113c`) at `0x6FD844C0` / `0x6FD844E3`.
 */
export function STATES_ClearGfxStateFlag113c(
  m: Memory113c,
  pUnit: number,
  stateId: number,
  bSet: number | boolean = 0,
): void {
  if (pUnit === 0 || stateId < 0 || stateId >= STATES_COUNT_113C) return
  const pListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pListEx === 0 || (m.get(pListEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) === 0) {
    return
  }
  const pStateFlags = m.get(pListEx, D2StatListExStrc.pStateFlags)
  if (pStateFlags === 0) return
  const wordIdx = (stateId >> 5) + STATE_DWORDS_113C
  const mask = (1 << (stateId & 31)) >>> 0
  const cur = m.u32(pStateFlags + wordIdx * 4)
  if (bSet) {
    m.setU32(pStateFlags + wordIdx * 4, (cur | mask) >>> 0)
  } else {
    m.setU32(pStateFlags + wordIdx * 4, (cur & ~mask) >>> 0)
  }
  UNITROOM_RefreshUnit113c(m, pUnit)
}

/**
 * `@va D2Common:0x6FD8AE60` (`STATLIST_ExpireStateListsOnModeChange`):
 * When `(pListEx->dwFlags & 0x02) != 0`, walks `pListEx->pMyLastList (+0x3C)` along `pPrevLink (+0x2C)`
 * and expires any sub-list with `(sub->dwFlags & 0x04) != 0` (clearing its `dwStateNo` in `pStateFlags`,
 * calling `UNITROOM_RefreshUnit113c`, and unlinking/freeing non-extended sub-lists), then clears bit `0x02`
 * on `pListEx->dwFlags`.
 */
export function STATLIST_ExpireStateListsOnModeChange113c(
  m: Memory113c,
  pUnit: number,
  _bIsClient = 0,
  registry: StatTableRegistry113c = DEFAULT_STAT_REGISTRY_113C,
): void {
  if (pUnit === 0) return
  const pListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pListEx === 0 || (m.get(pListEx, D2StatListStrc.dwFlags) & 0x02) === 0) return

  let sub = m.get(pListEx, D2StatListExStrc.pMyLastList)
  while (sub !== 0) {
    let nextSub = m.get(sub, D2StatListStrc.pPrevLink)
    const subFlags = m.get(sub, D2StatListStrc.dwFlags)
    if ((subFlags & 0x04) !== 0) {
      const stateNo = m.get(sub, D2StatListStrc.dwStateNo) | 0
      if (stateNo > 0 && stateNo < STATES_COUNT_113C) {
        STATES_ToggleState113c(m, pUnit, stateNo, 0)
        UNITROOM_RefreshUnit113c(m, pUnit)
      }
      if ((subFlags & STATLIST_FLAG_EXTENDED) === 0) {
        STATLIST_RemoveSubList113c(m, sub, registry)
      }
      nextSub = m.get(pListEx, D2StatListExStrc.pMyLastList)
    }
    sub = nextSub
  }
  m.set(pListEx, D2StatListStrc.dwFlags, (m.get(pListEx, D2StatListStrc.dwFlags) & ~0x02) >>> 0)
}

export {
  ITEMS_SetMagicPrefix113c,
  ITEMS_SetMagicSuffix113c,
  ITEMS_SetRarePrefix113c,
  ITEMS_SetRareSuffix113c,
}

/** `D2DataTablesStrc` offsets read by `STATES_CheckStateMaskExpOnUnit` (`0x6FD83AB0`). */
export const DATATABLES_OFF_STATES_COUNT_113C = 0xc4
export const DATATABLES_OFF_PLAYER_STATE_MASK_EXP_113C = 0x100
export const DATATABLES_OFF_MONSTER_STATE_MASK_EXP_113C = 0x104

/**
 * `@va D2Common:0x6FD83AB0` (`D2Common.#11061` `STATES_CheckStateMaskExpOnUnit`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nState`, `ret 8` -> masked bit or `0`).
 *
 * Checks `0 <= nState < sgptDataTables->nStatesTxtRecordCount (+0xC4)`, selects
 * `sgptDataTables->pMonsterStateMaskExp (+0x104)` when `pUnit != NULL && pUnit->dwUnitType == 1`
 * or `sgptDataTables->pPlayerStateMaskExp (+0x100)` otherwise, and returns
 * `pMask[nState >> 5] & gdwBitMasks[nState & 31]`.
 */
export function STATES_CheckStateMaskExpOnUnit113c(
  m: Memory113c,
  pUnit: number,
  nState: number,
): number {
  const state = nState | 0
  if (state < 0) return 0
  const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (state >= (m.u32((dt + DATATABLES_OFF_STATES_COUNT_113C) >>> 0) | 0)) return 0
  const pMask =
    pUnit !== 0 && m.get(pUnit, D2UnitStrc.dwUnitType) === 1
      ? m.u32((dt + DATATABLES_OFF_MONSTER_STATE_MASK_EXP_113C) >>> 0)
      : m.u32((dt + DATATABLES_OFF_PLAYER_STATE_MASK_EXP_113C) >>> 0)
  const word = m.u32((pMask + (sar32(state, 5) << 2)) >>> 0)
  const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
  const bit = m.u32((pBitMasks + ((state & 0x1f) << 2)) >>> 0)
  return (word & bit) >>> 0
}

/**
 * `@va D2Common:0x6FD87D30` (`D2Common.#10515` `STATLIST_GetSkillLevel`,
 * stdcall `[esp+4] = pStatList`, `ret 4` -> `pStatList->nSkillLevel (+0x20)`).
 */
export function STATLIST_GetSkillLevel113c(m: Memory113c, pStatList: number): number {
  return m.get(pStatList >>> 0, D2StatListStrc.nSkillLevel) >>> 0
}

/**
 * `@va D2Common:0x6FD87D40` (`D2Common.#11081` `STATLIST_SetSkillLevel`,
 * stdcall `[esp+4] = pStatList`, `[esp+8] = nSkillLevel`, `ret 8`, void).
 */
export function STATLIST_SetSkillLevel113c(
  m: Memory113c,
  pStatList: number,
  nSkillLevel: number,
): void {
  m.set(pStatList >>> 0, D2StatListStrc.nSkillLevel, nSkillLevel >>> 0)
}

/**
 * `@va D2Common:0x6FD87D50` (`D2Common.#10555` `STATLIST_GetSkillId`,
 * stdcall `[esp+4] = pStatList`, `ret 4` -> `pStatList->nSkillNo (+0x1C)`).
 */
export function STATLIST_GetSkillId113c(m: Memory113c, pStatList: number): number {
  return m.get(pStatList >>> 0, D2StatListStrc.nSkillNo) >>> 0
}

/**
 * `@va D2Common:0x6FD87D60` (`D2Common.#10725` `STATLIST_SetSkillId`,
 * stdcall `[esp+4] = pStatList`, `[esp+8] = nSkillNo`, `ret 8`, void).
 */
export function STATLIST_SetSkillId113c(m: Memory113c, pStatList: number, nSkillNo: number): void {
  m.set(pStatList >>> 0, D2StatListStrc.nSkillNo, nSkillNo >>> 0)
}

/**
 * `@va D2Common:0x6FD87D70` (`D2Common.#10911` `STATLIST_SetStatRemoveProc`,
 * stdcall `[esp+4] = pStatList`, `[esp+8] = pfOnRemove`, `ret 8`, void).
 */
export function STATLIST_SetStatRemoveProc113c(
  m: Memory113c,
  pStatList: number,
  pfOnRemove: number,
): void {
  if (pStatList === 0) return
  m.set(pStatList, D2StatListStrc.fpRemove, pfOnRemove >>> 0)
}

/**
 * `@va D2Common:0x6FD87DE0` (`D2Common.#10354` `STATLIST_CheckUnitStatListFlag100`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `(pUnit->pStatListEx->dwFlags >> 8) & 1` or `0`).
 */
export function STATLIST_CheckUnitStatListFlag100113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const pStatList = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pStatList === 0) return 0
  return ((m.get(pStatList, D2StatListStrc.dwFlags) >>> 8) & 1) >>> 0
}

/**
 * `@va D2Common:0x6FD87E70` (`D2Common.#11160` `STATLIST_GetOwnerAndDynamicFlag`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pOutNotMerged`, `ret 8` -> `pParent->pOwner (+0x44)` or `0`).
 */
export function STATLIST_GetOwnerAndDynamicFlag113c(
  m: Memory113c,
  pUnit: number,
  pOutNotMerged: number,
): number {
  if (pUnit !== 0) {
    const pList = m.get(pUnit, D2UnitStrc.pStatListEx)
    if (pList !== 0) {
      const pParent = m.get(pList, D2StatListStrc.pParent)
      if (
        pParent !== 0 &&
        (m.get(pParent, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) !== 0
      ) {
        if (pOutNotMerged !== 0) {
          const notMerged = (~(m.get(pList, D2StatListStrc.dwFlags) >>> 30) & 1) >>> 0
          m.setU32(pOutNotMerged >>> 0, notMerged)
        }
        return m.get(pParent, D2StatListExStrc.pOwner) >>> 0
      }
    }
  }
  if (pOutNotMerged !== 0) {
    m.setU32(pOutNotMerged >>> 0, 0)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD87EC0` (`D2Common.#10930` `STATLIST_GetStatListFromUnitStateAndFlag`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nState`, `[esp+0xC] = dwFilterFlags`, `ret 0xC` -> `pSub` or `0`).
 */
export function STATLIST_GetStatListFromUnitStateAndFlag113c(
  m: Memory113c,
  pUnit: number,
  nState: number,
  dwFilterFlags: number,
): number {
  const pListEx = m.get(pUnit >>> 0, D2UnitStrc.pStatListEx)
  if (pListEx === 0) return 0
  if ((m.get(pListEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) === 0) return 0
  let mask = dwFilterFlags >>> 0
  let pCur: number
  if ((mask & 0x2000) !== 0) {
    pCur = m.get(pListEx, D2StatListExStrc.pMyStats)
    mask = (mask & 0xffffdfff) >>> 0
  } else {
    pCur = m.get(pListEx, D2StatListExStrc.pMyLastList)
  }
  const targetState = nState >>> 0
  while (pCur !== 0) {
    if (
      m.get(pCur, D2StatListStrc.dwStateNo) === targetState &&
      (mask === 0 || (m.get(pCur, D2StatListStrc.dwFlags) & mask) !== 0)
    ) {
      return pCur >>> 0
    }
    pCur = m.get(pCur, D2StatListStrc.pPrevLink)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD87F40` (`STATLIST_GetStatListFromFlag`,
 * internal LTCG `eax = pStatList`, `ecx = dwFilterFlags`, `ret` -> `pSub` or `0`).
 */
export function STATLIST_GetStatListFromFlag113c(
  m: Memory113c,
  pStatList: number,
  dwFilterFlags: number,
): number {
  if (pStatList === 0) return 0
  let pCur = pStatList >>> 0
  if ((m.get(pStatList, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED) !== 0) {
    pCur =
      (dwFilterFlags & 0x2000) !== 0
        ? m.get(pStatList, D2StatListExStrc.pMyStats)
        : m.get(pStatList, D2StatListExStrc.pMyLastList)
  }
  const mask = (dwFilterFlags & 0xffffdfff) >>> 0
  while (pCur !== 0) {
    if ((m.get(pCur, D2StatListStrc.dwFlags) & mask) !== 0) {
      return pCur >>> 0
    }
    pCur = m.get(pCur, D2StatListStrc.pPrevLink)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD88000` (`D2Common.#10412` `STATLIST_GetExpireFrame`,
 * stdcall `[esp+4] = pStatList`, `ret 4` -> `pStatList->dwExpireFrame (+0x18)` or `0`).
 */
export function STATLIST_GetExpireFrame113c(m: Memory113c, pStatList: number): number {
  const s = pStatList >>> 0
  if (s === 0) return 0
  return m.get(s, D2StatListStrc.dwExpireFrame) >>> 0
}

/**
 * `@va D2Common:0x6FD88020` (`D2Common.#10161` `STATLIST_SetExpireFrame`,
 * stdcall `[esp+4] = pStatList`, `[esp+8] = nExpireFrame`, `ret 8`, void).
 *
 * If `pStatList != 0`: when signed `nExpireFrame > 0`, sets `STATLIST_FLAG_TIMED` (`0x02`) in
 * `pStatList->dwFlags (+0x10)` (`0x6FD8802C..0x6FD88030`), then writes `pStatList->dwExpireFrame (+0x18)`.
 */
export function STATLIST_SetExpireFrame113c(
  m: Memory113c,
  pStatList: number,
  nExpireFrame: number,
): void {
  const s = pStatList >>> 0
  if (s === 0) return
  const frame = nExpireFrame | 0
  if (frame > 0) {
    m.set(
      s,
      D2StatListStrc.dwFlags,
      (m.get(s, D2StatListStrc.dwFlags) | STATLIST_FLAG_TIMED) >>> 0,
    )
  }
  m.set(s, D2StatListStrc.dwExpireFrame, frame >>> 0)
}

/**
 * `@va D2Common:0x6FD88040` (`D2Common.#11132` `STATLIST_GetState`,
 * stdcall `[esp+4] = pStatList`, `ret 4` -> `pStatList->dwStateNo (+0x14)` or `0`).
 */
export function STATLIST_GetState113c(m: Memory113c, pStatList: number): number {
  const s = pStatList >>> 0
  if (s === 0) return 0
  return m.get(s, D2StatListStrc.dwStateNo) >>> 0
}

/**
 * `@va D2Common:0x6FD88060` (`D2Common.#10785` `STATLIST_SetState`,
 * stdcall `[esp+4] = pStatList`, `[esp+8] = nState`, `ret 8`, void).
 */
export function STATLIST_SetState113c(m: Memory113c, pStatList: number, nState: number): void {
  const s = pStatList >>> 0
  if (s === 0) return
  m.set(s, D2StatListStrc.dwStateNo, nState >>> 0)
}

/**
 * `@va D2Common:0x6FD88080` (`D2Common.#10473` `STATLIST_GetOwnerId`,
 * stdcall `[esp+4] = pStatList`, `ret 4` -> `pStatList->dwOwnerId (+0x0C)` or `0`).
 */
export function STATLIST_GetOwnerId113c(m: Memory113c, pStatList: number): number {
  const s = pStatList >>> 0
  if (s === 0) return 0
  return m.get(s, D2StatListStrc.dwOwnerId) >>> 0
}

/**
 * `@va D2Common:0x6FD880A0` (`D2Common.#11165` `STATLIST_GetUnitFullStatsCount`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `movsx eax, word [pListEx+0x4C]` or `0`).
 */
export function STATLIST_GetUnitFullStatsCount113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pListEx = m.get(u, D2UnitStrc.pStatListEx)
  if (pListEx === 0) return 0
  return ((m.get(pListEx, D2StatListExStrc.wFullStatCount) << 16) >> 16) >>> 0
}

/**
 * `@va D2Common:0x6FD880E0` (`D2Common.#11131` `STATLIST_GetOwnerType`,
 * stdcall `[esp+4] = pStatList`, `ret 4` -> `pStatList->eOwnerType (+0x08)` or `6` if NULL).
 */
export function STATLIST_GetOwnerType113c(m: Memory113c, pStatList: number): number {
  const s = pStatList >>> 0
  if (s === 0) return 6
  return m.get(s, D2StatListStrc.eOwnerType) >>> 0
}

/**
 * `@va D2Common:0x6FD88220` (`STATLIST_FindStatFirstIndexOrLowerBound`,
 * internal LTCG `eax = pStatArrayHdr`, `ebx = dwKey`, plain `ret` -> index `>= 0` or `-1` (`0xFFFFFFFF`)).
 *
 * Binary search on `D2StatsArrayStrc` (`+0x00 pStat`, `+0x04 wStatCount`):
 * - `0x6FD88221 movsx ebp, word [eax+4]; mov esi, ebp; xor ecx, ecx; test esi, esi; mov edi, [eax]; jle`
 * - Loop (`0x6FD88231..0x6FD8824E`): `mid = lo + trunc((hi - lo) / 2)`, `cur = [edi + mid*8]`.
 *   If `(dwKey | 0) > (cur | 0)`: `lo = mid + 1`.
 *   Else if `(dwKey | 0) >= (cur | 0)`: returns `mid` immediately (`jge 0x6FD8825D`).
 *   Else: `hi = mid`.
 * - Post-loop (`0x6FD88250..0x6FD88260`): if `lo < count`, returns `lo`; otherwise returns `-1` (`0xFFFFFFFF`).
 */
export function STATLIST_FindStatFirstIndexOrLowerBound113c(
  m: Memory113c,
  pStatArrayHdr: number,
  dwKey: number,
): number {
  const hdr = pStatArrayHdr >>> 0
  const count = (m.u16((hdr + 4) >>> 0) << 16) >> 16
  let hi = count
  let lo = 0
  const pStat = m.u32(hdr)
  const key = dwKey | 0
  if (hi > 0) {
    while (lo < hi) {
      const diff = (hi - lo) | 0
      const mid = (lo + ((diff - (diff >> 31)) >> 1)) | 0
      const cur = m.u32((pStat + mid * 8) >>> 0) | 0
      if (key > cur) {
        lo = (mid + 1) | 0
      } else if (key >= cur) {
        return mid >>> 0
      } else {
        hi = mid
      }
    }
  }
  if (lo < count) {
    return lo >>> 0
  }
  return 0xffffffff
}

/**
 * `@va D2Common:0x6FD88380` (`D2Common.#11043` `STATLIST_SetExpireFrameEx`,
 * stdcall `[esp+4] = pStatList`, `[esp+8] = nExpireFrame`, `ret 8`, void).
 *
 * Byte-for-byte identical in machine code to `STATLIST_SetExpireFrame` (`0x6FD88020`).
 */
export function STATLIST_SetExpireFrameEx113c(
  m: Memory113c,
  pStatList: number,
  nExpireFrame: number,
): void {
  const s = pStatList >>> 0
  if (s === 0) return
  const frame = nExpireFrame | 0
  if (frame > 0) {
    m.set(
      s,
      D2StatListStrc.dwFlags,
      (m.get(s, D2StatListStrc.dwFlags) | STATLIST_FLAG_TIMED) >>> 0,
    )
  }
  m.set(s, D2StatListStrc.dwExpireFrame, frame >>> 0)
}

/**
 * `@va D2Common:0x6FD883A0` (`D2Common.#10959` `STATLIST_GetExpireFrameEx`,
 * stdcall `[esp+4] = pStatList`, `ret 4` -> `pStatList->dwExpireFrame (+0x18)` or `0`).
 *
 * Byte-for-byte identical in machine code to `STATLIST_GetExpireFrame` (`0x6FD88000`).
 */
export function STATLIST_GetExpireFrameEx113c(m: Memory113c, pStatList: number): number {
  const s = pStatList >>> 0
  if (s === 0) return 0
  return m.get(s, D2StatListStrc.dwExpireFrame) >>> 0
}

/**
 * `@va D2Common:0x6FD883C0` (`D2Common.#10658` `STATLIST_CopyBaseStatsToBuffer`,
 * stdcall `[esp+4] = pStatList`, `[esp+8] = pOutStats`, `[esp+0xC] = nMaxStats`, `ret 0xC` -> copied count).
 *
 * Reads `count = movsx(pStatList->wStatCount (+0x28))`, clamps `if (count >= nMaxStats) count = nMaxStats`
 * (`0x6FD883CD..0x6FD883D9`, signed `jl`), copies `8`-byte `D2StatStrc` records from `pStatList->pStat (+0x24)`
 * to `pOutStats` while `src < (src + count * 8) >>> 0` (`0x6FD883DF..0x6FD88402`, unsigned `jae`/`jb`),
 * and returns `count`.
 */
export function STATLIST_CopyBaseStatsToBuffer113c(
  m: Memory113c,
  pStatList: number,
  pOutStats: number,
  nMaxStats: number,
): number {
  const s = pStatList >>> 0
  if (s === 0) return 0
  let count = (m.get(s, D2StatListStrc.wStatCount) << 16) >> 16
  const maxStats = nMaxStats | 0
  if (count >= maxStats) {
    count = maxStats
  }
  let src = m.get(s, D2StatListStrc.pStat) >>> 0
  const end = (src + imul32(count, 8)) >>> 0
  if (src < end) {
    let dst = pOutStats >>> 0
    do {
      m.setU32(dst, m.u32(src))
      m.setU32((dst + 4) >>> 0, m.u32((src + 4) >>> 0))
      src = (src + 8) >>> 0
      dst = (dst + 8) >>> 0
    } while (src < end)
  }
  return count >>> 0
}

/**
 * `@va D2Common:0x6FD88410` (`D2Common.#10790` `STATLIST_CopyUnitFullStatsToBuffer`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pOutStats`, `[esp+0xC] = nMaxStats`, `ret 0xC` -> copied count).
 *
 * Checks `pUnit != 0`, `pListEx = pUnit->pStatListEx (+0x5C) != 0`, and `(pListEx->dwFlags & 0x80000000) != 0`
 * (`0x6FD88410..0x6FD88424 test eax, eax; js`); otherwise returns `0`.
 * Clamps `count = min_signed(movsx(pListEx->wFullStatCount (+0x4C)), nMaxStats)` and copies `8`-byte
 * `D2StatStrc` records from `pListEx->pFullStat (+0x48)` into `pOutStats`.
 */
export function STATLIST_CopyUnitFullStatsToBuffer113c(
  m: Memory113c,
  pUnit: number,
  pOutStats: number,
  nMaxStats: number,
): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pListEx = m.get(u, D2UnitStrc.pStatListEx)
  if (pListEx === 0) return 0
  if ((m.get(pListEx, D2StatListStrc.dwFlags) | 0) >= 0) return 0
  let count = (m.get(pListEx, D2StatListExStrc.wFullStatCount) << 16) >> 16
  const maxStats = nMaxStats | 0
  if (count >= maxStats) {
    count = maxStats
  }
  let src = m.get(pListEx, D2StatListExStrc.pFullStat) >>> 0
  const end = (src + imul32(count, 8)) >>> 0
  if (src < end) {
    let dst = pOutStats >>> 0
    do {
      m.setU32(dst, m.u32(src))
      m.setU32((dst + 4) >>> 0, m.u32((src + 4) >>> 0))
      src = (src + 8) >>> 0
      dst = (dst + 8) >>> 0
    } while (src < end)
  }
  return count >>> 0
}

/**
 * `@va D2Common:0x6FD8B080` (`D2Common.#10518` `DRLGLOGIC_GetBossTombLevel`,
 * stdcall `[esp+4] = pAct`, `ret 4` -> `pAct->pDrlg->nBossTombLevel (+0x94)` or `0`).
 */
export function DRLGLOGIC_GetBossTombLevel113c(m: Memory113c, pAct: number): number {
  const a = pAct >>> 0
  if (a === 0) return 0
  const pDrlg = m.get(a, D2ActStrc.pDrlg)
  if (pDrlg === 0) return 0
  return m.get(pDrlg, D2DrlgStrc.nBossTombLevel) >>> 0
}

/** `.data` VA of the 5-dword Act start level ID table `[1, 40, 75, 103, 109]` (`0x6FD8B1E0`). */
export const D2COMMON_ACT_LEVEL_IDS_VA_113C = 0x6fde4084

/** `.data` VAs for the random item graphic cell table (`0x6FD96920`). */
export const D2COMMON_ITEM_GRAPHIC_CELL_COUNT_VA_113C = 0x6fdeefa0
export const D2COMMON_ITEM_GRAPHIC_CELL_TABLE_VA_113C = 0x6fdeefa4

/**
 * `@va D2Common:0x6FD725F0` (`D2Common.#10483` `ITEMS_SetItemCell`,
 * stdcall `[esp+4] = pItem`, `[esp+8] = nItemCell`, `ret 8`, void).
 *
 * Asserts `pItem != NULL` (`0x107D`), `pItem->dwUnitType == 4` (`0x107E`), and
 * `pItem->pItemData (+0x14) != NULL` (`0x1080`), then stores `pItemData->dwItemCell (+0x28) = nItemCell`.
 */
export function ITEMS_SetItemCell113c(m: Memory113c, pItem: number, nItemCell: number): void {
  const item = pItem >>> 0
  if (item === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x107d)
  }
  if (m.get(item, D2UnitStrc.dwUnitType) !== 4) {
    throw new D2CommonAssertError('Items.cpp', 0x107e)
  }
  const pItemData = m.get(item, D2UnitStrc.pUnitData)
  if (pItemData === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x1080)
  }
  m.set(pItemData, D2ItemDataStrc.dwItemCell, nItemCell >>> 0)
}

/**
 * `@va D2Common:0x6FD82E10` (`UNITS_ApplyRunWalkStatListInline`,
 * custom LTCG `eax = nCharClassId`, `[esp+4] = pUnit`, `ret 4`, void).
 *
 * Allocates a `0x3C`-byte `D2StatListStrc` with `dwFlags = 4`, looks up `CharStats.txt[nCharClassId]`,
 * and when `nWalkSpeed (+0x40) != 0`, sets stat `0x43` (`item_fastermovevelocity`) to
 * `trunc((nRunSpeed * 100) / nWalkSpeed) - 100` via `0x6FD8A280` (`STATLIST_SetStat113c`) and merges
 * the sub-list onto `pUnit` with `bType = 1` via `0x6FD8A7D0` (`STATLIST_MergeStatLists113c`).
 */
export function UNITS_ApplyRunWalkStatListInline113c(
  m: Memory113c,
  nCharClassId: number,
  pUnit: number,
): void {
  const u = pUnit >>> 0
  let dwOwnerId: number
  let eOwnerType: number
  let pMemPool: number
  if (u === 0) {
    dwOwnerId = 0xffffffff
    eOwnerType = 6
    pMemPool = 0
  } else {
    dwOwnerId = m.get(u, D2UnitStrc.dwUnitId)
    eOwnerType = m.get(u, D2UnitStrc.dwUnitType)
    pMemPool = m.get(u, D2UnitStrc.pMemPool)
  }

  const pStatList = m.alloc(D2StatListStrc_SIZE)
  for (let i = 0; i < 15; i++) {
    m.setU32((pStatList + i * 4) >>> 0, 0)
  }
  m.set(pStatList, D2StatListStrc.pMemPool, pMemPool)
  m.set(pStatList, D2StatListStrc.eOwnerType, eOwnerType)
  m.set(pStatList, D2StatListStrc.dwOwnerId, dwOwnerId)
  m.set(pStatList, D2StatListStrc.dwFlags, 4)
  m.set(pStatList, D2StatListStrc.dwExpireFrame, 0)

  let pCharStatsTxt = 0
  const cls = nCharClassId | 0
  if (cls >= 0) {
    const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    if (cls < (m.u32((dt + DATATABLES_OFF_113C.nCharStatsTxtRecordCount) >>> 0) | 0)) {
      pCharStatsTxt =
        (m.u32((dt + DATATABLES_OFF_113C.pCharStatsTxt) >>> 0) +
          imul32(cls, D2CharStatsTxt_SIZE)) >>>
        0
    }
  }

  const nWalkSpeed = m.u8((pCharStatsTxt + D2CharStatsTxt.nWalkSpeed.off) >>> 0)
  if (nWalkSpeed !== 0) {
    const nRunSpeed = m.u8((pCharStatsTxt + D2CharStatsTxt.nRunSpeed.off) >>> 0)
    const nVelPercent = (Math.trunc(imul32(nRunSpeed, 100) / nWalkSpeed) - 100) | 0
    STATLIST_SetStat113c(m, pStatList, 0x43, nVelPercent, 0)
    STATLIST_MergeStatLists113c(m, u, pStatList, 1)
  }
}

/**
 * `@va D2Common:0x6FD87E20` (`D2Common.#10561` `STATLIST_FreeModStats`,
 * stdcall `[esp+4] = pUnit`, `ret 4`, void).
 *
 * When `pUnit != 0`, `pStatListEx = pUnit->pStatListEx (+0x5C) != 0`, and `(pStatListEx->dwFlags & 0x80000000) != 0`:
 * frees `pStatListEx->pModStat (+0x50)` if non-NULL, zeroes `pModStat`, and zeroes `wModStatCapacity (+0x56)` and `wModStatCount (+0x54)`.
 */
export function STATLIST_FreeModStats113c(m: Memory113c, pUnit: number): void {
  const u = pUnit >>> 0
  if (u === 0) return
  const pStatListEx = m.get(u, D2UnitStrc.pStatListEx)
  if (pStatListEx === 0) return
  if ((m.get(pStatListEx, D2StatListStrc.dwFlags) | 0) >= 0) return
  const pModStat = m.get(pStatListEx, D2StatListExStrc.pModStat)
  if (pModStat !== 0) {
    const pMemPool = m.get(pStatListEx, D2StatListStrc.pMemPool)
    void pMemPool
    ;(m as { free?: (p: number) => void }).free?.(pModStat)
    m.set(pStatListEx, D2StatListExStrc.pModStat, 0)
  }
  m.set(pStatListEx, D2StatListExStrc.wModStatCapacity, 0)
  m.set(pStatListEx, D2StatListExStrc.wModStatCount, 0)
}

/**
 * `@va D2Common:0x6FD8A9F0` (`STATLIST_FreeStatListImpl`,
 * custom LTCG `ecx = pStatList`, plain `ret`, void).
 *
 * Unlinks `pStatList` via `0x6FD8A3B0` (`STATLIST_RemoveSubList113c`), frees `pStat (+0x24)` if non-NULL,
 * and if extended (`(dwFlags & 0x80000000) != 0`), walks `pMyLastList (+0x3C)` along `pPrevLink (+0x2C)`
 * detaching child sub-lists and recursively freeing non-extended children, frees `pFullStat (+0x48)` and
 * `pModStat (+0x50)` if non-NULL, frees `pStateFlags (+0x58)`, and finally frees `pStatList`.
 */
export function STATLIST_FreeStatListImpl113c(m: Memory113c, pStatList: number): void {
  const esi = pStatList >>> 0
  STATLIST_RemoveSubList113c(m, esi)
  const pStat = m.get(esi, D2StatListStrc.pStat)
  if (pStat !== 0) {
    const pMemPool = m.get(esi, D2StatListStrc.pMemPool)
    void pMemPool
    ;(m as { free?: (p: number) => void }).free?.(pStat)
  }
  if ((m.get(esi, D2StatListStrc.dwFlags) | 0) < 0) {
    let ecx = m.get(esi, D2StatListExStrc.pMyLastList)
    while (ecx !== 0) {
      const edx = m.get(ecx, D2StatListStrc.dwFlags) | 0
      let eax = m.get(ecx, D2StatListStrc.pPrevLink)
      m.set(ecx, D2StatListStrc.pParent, 0)
      m.set(ecx, D2StatListStrc.pUnit, 0)
      if (edx >= 0) {
        if (m.get(esi, D2StatListExStrc.pMyLastList) === ecx) {
          m.set(esi, D2StatListExStrc.pMyLastList, eax)
        }
        STATLIST_FreeStatListImpl113c(m, ecx)
        eax = m.get(esi, D2StatListExStrc.pMyLastList)
      }
      ecx = eax
    }
    const pFullStat = m.get(esi, D2StatListExStrc.pFullStat)
    if (pFullStat !== 0) {
      const pMemPool = m.get(esi, D2StatListStrc.pMemPool)
      void pMemPool
      ;(m as { free?: (p: number) => void }).free?.(pFullStat)
    }
    const pModStat = m.get(esi, D2StatListExStrc.pModStat)
    if (pModStat !== 0) {
      const pMemPool = m.get(esi, D2StatListStrc.pMemPool)
      void pMemPool
      ;(m as { free?: (p: number) => void }).free?.(pModStat)
    }
    const pStateFlags = m.get(esi, D2StatListExStrc.pStateFlags)
    const pMemPoolEx = m.get(esi, D2StatListStrc.pMemPool)
    void pMemPoolEx
    if (pStateFlags !== 0) {
      ;(m as { free?: (p: number) => void }).free?.(pStateFlags)
    }
  }
  const pMemPoolSelf = m.get(esi, D2StatListStrc.pMemPool)
  void pMemPoolSelf
  ;(m as { free?: (p: number) => void }).free?.(esi)
}

/**
 * `@va D2Common:0x6FD8B0A0` (`D2Common.#10018` `STATLIST_GetUnitType`,
 * stdcall `[esp+4] = pStatList`, `ret 4` -> `pStatList->eOwnerType (+0x08)`).
 *
 * Asserts `pStatList != NULL` (`line 0x634`) and returns `pStatList->eOwnerType (+0x08)`.
 */
export function STATLIST_GetUnitType113c(m: Memory113c, pStatList: number): number {
  const s = pStatList >>> 0
  if (s === 0) {
    throw new D2CommonAssertError('Dungeon.cpp', 0x634)
  }
  return m.get(s, D2StatListStrc.eOwnerType) >>> 0
}

/**
 * `@va D2Common:0x6FD8B1A0` (`DUNGEON_GetRoomTileSubtypesPtr`,
 * stdcall `[esp+4] = pRoom`, `ret 4` -> `&pRoom->pRoomEx->pLevel->pTileSubtypes (+0x1E0)`).
 *
 * Asserts `pRoom != NULL` (`line 0x5B9`) and returns `(pRoom->pRoomEx (+0x10)->pLevel (+0x58) + 0x1E0) >>> 0`.
 */
export function DUNGEON_GetRoomTileSubtypesPtr113c(m: Memory113c, pRoom: number): number {
  const r = pRoom >>> 0
  if (r === 0) {
    throw new D2CommonAssertError('Dungeon.cpp', 0x5b9)
  }
  const pRoomEx = m.get(r, D2ActiveRoomStrc.pRoomEx)
  const pLevel = m.get(pRoomEx, D2RoomExStrc.pLevel)
  return (pLevel + 0x1e0) >>> 0
}

/**
 * `@va D2Common:0x6FD8B1E0` (`D2Common.#10691` `DUNGEON_GetActLevelId`,
 * stdcall `[esp+4] = nAct`, `ret 4` -> `dword [0x6FDE4084 + (nAct & 0xFF) * 4]`).
 *
 * Zero-extends `nAct & 0xFF`, asserts `(nAct & 0xFF) < 5` (`line 0x59A`), and returns
 * `m.u32(0x6FDE4084 + (nAct & 0xFF) * 4)`.
 */
export function DUNGEON_GetActLevelId113c(m: Memory113c, nAct: number): number {
  const actByte = nAct & 0xff
  if (actByte >= 5) {
    throw new D2CommonAssertError('Dungeon.cpp', 0x59a)
  }
  return m.u32((D2COMMON_ACT_LEVEL_IDS_VA_113C + actByte * 4) >>> 0) >>> 0
}

/**
 * `@va D2Common:0x6FD95780` (`STATLIST_UnpackSkillStatParam`,
 * stdcall `[esp+4] = nParam`, `[esp+8] = pOutDiv3`, `[esp+0xC] = pOutRem3`, `[esp+0x10] = pOutSkillIdx`, `ret 0x10`, void).
 *
 * Asserts `pOutDiv3 != 0 && pOutRem3 != 0 && pOutSkillIdx != 0` (`line 0x1AA`), unpacks
 * `low5 = nParam & 0x1F`, writes `*pOutDiv3 = trunc(low5 / 3)`, `*pOutRem3 = low5 % 3`,
 * and `*pOutSkillIdx = (nParam >> 5) & 0x1F`.
 */
export function STATLIST_UnpackSkillStatParam113c(
  m: Memory113c,
  nParam: number,
  pOutDiv3: number,
  pOutRem3: number,
  pOutSkillIdx: number,
): void {
  const outDiv = pOutDiv3 >>> 0
  const outRem = pOutRem3 >>> 0
  const outIdx = pOutSkillIdx >>> 0
  if (outDiv === 0 || outRem === 0 || outIdx === 0) {
    throw new D2CommonAssertError('SkillStat.cpp', 0x1aa)
  }
  const low5 = nParam & 0x1f
  const q = Math.trunc(low5 / 3) | 0
  const r = (low5 - q * 3) | 0
  m.setU32(outDiv, q >>> 0)
  m.setU32(outRem, r >>> 0)
  m.setU32(outIdx, ((nParam >> 5) & 0x1f) >>> 0)
}

/**
 * `@va D2Common:0x6FD96920` (`STATLIST_RollRandomItemGraphicStat`,
 * stdcall `[esp+4] = pItem`, `ret 4`, void).
 *
 * Rolls an item graphic cell from `.data` table `0x6FDEEFA0` (`nCount`) / `0x6FDEEFA4` (`dwCells[]`)
 * using `pItem->pItemData->dwSeed (+0x04)`, sets `pItem->pItemData->dwItemCell (+0x28)`, rolls a
 * secondary graphic value `((seed & 3) + 1) << 8` when `cell == 9 || cell == 7` (or `1` otherwise),
 * writes stat `0x47` via `0x6FD8A280` (`STATLIST_SetStat113c`), and if changed on `dwUnitType == 0`,
 * records `0x00470000` via `0x6FD88550` (`STATLIST_RecordModStat113c`).
 */
export function STATLIST_RollRandomItemGraphicStat113c(m: Memory113c, pItem: number): void {
  const item = pItem >>> 0
  let pSeed = 0
  if (item !== 0 && m.get(item, D2UnitStrc.dwUnitType) === 4) {
    const pItemData0 = m.get(item, D2UnitStrc.pUnitData)
    if (pItemData0 !== 0) {
      pSeed = (pItemData0 + D2ItemDataStrc.dwSeed.off) >>> 0
    }
  }

  const nCount = m.u32(D2COMMON_ITEM_GRAPHIC_CELL_COUNT_VA_113C) | 0
  let idx = 0
  if (nCount > 0) {
    const hi0 = m.u32((pSeed + 4) >>> 0)
    const lo0 = m.u32(pSeed)
    const next = BigInt(lo0) * 0x6ac690c5n + BigInt(hi0)
    const nextLo = Number(next & 0xffffffffn) >>> 0
    const nextHi = Number((next >> 32n) & 0xffffffffn) >>> 0
    m.setU32((pSeed + 4) >>> 0, nextHi)
    m.setU32(pSeed, nextLo)
    if ((nCount & (nCount - 1)) === 0) {
      idx = (nextLo & (nCount - 1)) >>> 0
    } else {
      idx = ((nextLo >>> 0) % (nCount >>> 0)) >>> 0
    }
  }

  const cellVal = m.u32((D2COMMON_ITEM_GRAPHIC_CELL_TABLE_VA_113C + idx * 4) >>> 0)
  if (item === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x107d)
  }
  if (m.get(item, D2UnitStrc.dwUnitType) !== 4) {
    throw new D2CommonAssertError('Items.cpp', 0x107e)
  }
  const pItemData = m.get(item, D2UnitStrc.pUnitData)
  if (pItemData === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x1080)
  }
  m.set(pItemData, D2ItemDataStrc.dwItemCell, cellVal >>> 0)

  const cellVal2 = m.u32((D2COMMON_ITEM_GRAPHIC_CELL_TABLE_VA_113C + idx * 4) >>> 0)
  let statVal: number
  if (cellVal2 === 9 || cellVal2 === 7) {
    let pSeed2 = 0
    if (m.get(item, D2UnitStrc.dwUnitType) === 4) {
      const pData2 = m.get(item, D2UnitStrc.pUnitData)
      if (pData2 !== 0) {
        pSeed2 = (pData2 + D2ItemDataStrc.dwSeed.off) >>> 0
      }
    }
    const lo1 = m.u32(pSeed2)
    const hi1 = m.u32((pSeed2 + 4) >>> 0)
    const next2 = BigInt(lo1) * 0x6ac690c5n + BigInt(hi1)
    const nextLo2 = Number(next2 & 0xffffffffn) >>> 0
    const nextHi2 = Number((next2 >> 32n) & 0xffffffffn) >>> 0
    m.setU32((pSeed2 + 4) >>> 0, nextHi2)
    m.setU32(pSeed2, nextLo2)
    statVal = (((nextLo2 & 3) + 1) << 8) | 0
  } else {
    statVal = 1
  }

  const changed = STATLIST_SetStat113c(m, m.get(item, D2UnitStrc.pStatListEx), 0x47, statVal, 0)
  if (changed !== 0 && m.get(item, D2UnitStrc.dwUnitType) === 0) {
    STATLIST_RecordModStat113c(m, m.get(item, D2UnitStrc.pStatListEx), 0x00470000)
  }
}

export function getTotalStatWithMinFromList113c(
  m: Memory113c,
  pStatList: number,
  dwKey: number,
  pIscRec: number,
): number {
  const isEx = (m.u32((pStatList + 0x10) >>> 0) & 0x80000000) !== 0
  const pHdr = isEx ? (pStatList + 0x48) >>> 0 : (pStatList + 0x24) >>> 0
  const idx = STATLIST_FindStatIndex113c(m, pHdr, dwKey)
  if (idx < 0) return 0
  const pEntry = (m.u32(pHdr) + idx * 8) >>> 0
  if (pEntry === 0) return 0
  let val = m.u32((pEntry + 4) >>> 0) | 0
  if (pIscRec !== 0) {
    const dl = m.u8((pIscRec + 5) >>> 0)
    const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
    if ((m.u8((pBitMasks + 8) >>> 0) & dl) !== 0 && isEx) {
      const pOwner = m.u32((pStatList + 0x44) >>> 0)
      if (pOwner !== 0) {
        const ownerType = m.u32(pOwner)
        if (ownerType === 0 || ownerType === 1) {
          const minVal = m.u32((pIscRec + 0x2c) >>> 0) | 0
          if (val < minVal) {
            const shift = m.u8((pIscRec + 0x18) >>> 0) & 0x1f
            val = (minVal << shift) | 0
          }
        }
      }
    }
  }
  return val >>> 0
}

export function getBaseStatWithMinFromList113c(
  m: Memory113c,
  pStatList: number,
  dwKey: number,
  pIscRec: number,
): number {
  const pHdr = (pStatList + 0x24) >>> 0
  const idx = STATLIST_FindStatIndex113c(m, pHdr, dwKey)
  if (idx < 0) return 0
  const pEntry = (m.u32(pHdr) + idx * 8) >>> 0
  if (pEntry === 0) return 0
  let val = m.u32((pEntry + 4) >>> 0) | 0
  if (pIscRec !== 0) {
    const dl = m.u8((pIscRec + 5) >>> 0)
    const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
    if ((m.u8((pBitMasks + 8) >>> 0) & dl) !== 0) {
      if ((m.u32((pStatList + 0x10) >>> 0) | 0) < 0) {
        const pOwner = m.u32((pStatList + 0x44) >>> 0)
        if (pOwner !== 0) {
          const ownerType = m.u32(pOwner)
          if (ownerType === 0 || ownerType === 1) {
            const minVal = m.u32((pIscRec + 0x2c) >>> 0) | 0
            if (val < minVal) {
              const shift = m.u8((pIscRec + 0x18) >>> 0) & 0x1f
              val = (minVal << shift) | 0
            }
          }
        }
      }
    }
  }
  return val >>> 0
}

function propagateDeltaMem113c(
  m: Memory113c,
  pStartList: number,
  dwKey: number,
  delta: number,
  _pUnit: number,
): void {
  const d = delta | 0
  if (d === 0) return
  const statId = (dwKey >> 16) & 0xffff
  if ((statId | 0) < 0) return
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (statId >= (m.u32((sgpt + 0xbd4) >>> 0) | 0)) return
  const iscBase = m.u32((sgpt + 0xbcc) >>> 0)
  const pIscRec = (iscBase + imul32(statId, 0x144)) >>> 0
  if (pIscRec === 0) return
  const startFlags = m.u32((pStartList + 0x10) >>> 0)
  if ((startFlags & 0x2000) !== 0) return
  const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
  const isDmgRelated = (m.u8((pIscRec + 4) >>> 0) & m.u32((pBitMasks + 8) >>> 0)) >>> 0
  let cur = (startFlags | 0) < 0 ? pStartList : m.u32((pStartList + 0x34) >>> 0)
  while (cur !== 0) {
    const bHasOpStat = m.u8((pIscRec + 0x51) >>> 0)
    const bIsOpTarget = bHasOpStat === 0 ? m.u8((pIscRec + 0x52) >>> 0) : 1
    if (bHasOpStat === 0 && bIsOpTarget === 0) {
      const pFullHdr = (cur + 0x48) >>> 0
      let idx = STATLIST_FindStatIndex113c(m, pFullHdr, dwKey)
      let entryPtr = idx >= 0 ? (m.u32(pFullHdr) + idx * 8) >>> 0 : 0
      if (entryPtr === 0) {
        m.u32(cur)
        const ins = STATLIST_FindInsertPos113c(m, pFullHdr, dwKey)
        entryPtr = insertStatSlot(m, pFullHdr, ins, dwKey)
        idx = ins
      }
      const prevVal = m.u32((entryPtr + 4) >>> 0) | 0
      const nextVal = (prevVal + d) | 0
      m.setU32((entryPtr + 4) >>> 0, nextVal >>> 0)
      if (nextVal > 0 && m.u8((pIscRec + 0x53) >>> 0) !== 0) {
        m.setU32((cur + 0x10) >>> 0, (m.u32((cur + 0x10) >>> 0) | 0x20000000) >>> 0)
      }
      if (m.u32((entryPtr + 4) >>> 0) === 0 && m.u8((pIscRec + 0x50) >>> 0) === 0) {
        m.u32(cur)
        removeStatSlot(m, pFullHdr, idx)
      }
      const pfOnValue = m.u32((cur + 0x5c) >>> 0)
      if (pfOnValue !== 0) {
        m.u8((pIscRec + 5) >>> 0)
        m.u8((m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C) + 0x0c) >>> 0)
      }
    } else {
      // 0x6FD89FFD..0x6FD8A003: op-stat source/target -> `0x6FD89CE0` (`STATLIST_RecomputeExStat`).
      STATLIST_RecomputeExStat113c(m, cur, statId, dwKey & 0xffff)
    }
    const curFlags = m.u32((cur + 0x10) >>> 0)
    cur = m.u32((cur + 0x34) >>> 0)
    if ((curFlags & 0x2000) !== 0) break
    if (isDmgRelated !== 0 && (curFlags & 0x40000000) !== 0) break
  }
}

function recordModStatMem113c(m: Memory113c, pListEx: number, dwKey: number): void {
  if ((m.u32((pListEx + 0x10) >>> 0) | 0) >= 0) return
  const statId = (dwKey >> 16) & 0xffff
  if (statId === 6 || statId === 8 || statId === 10 || statId === 13 || statId === 14) return
  if ((statId | 0) < 0) return
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (statId >= (m.u32((sgpt + 0xbd4) >>> 0) | 0)) return
  const pIscRec = (m.u32((sgpt + 0xbcc) >>> 0) + imul32(statId, 0x144)) >>> 0
  if (pIscRec === 0) return
  const dl = m.u8((pIscRec + 5) >>> 0)
  const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
  if ((m.u8((pBitMasks + 0x10) >>> 0) & dl) === 0) return
  const pModHdr = (pListEx + 0x50) >>> 0
  const ins = STATLIST_FindModStatInsertPos113c(m, pModHdr, dwKey)
  if (ins < 0) return
  const cap = (m.u16((pListEx + 0x56) >>> 0) << 16) >> 16
  const count = (m.u16((pListEx + 0x54) >>> 0) << 16) >> 16
  if (count >= cap) {
    const newCap = (cap + 4) & 0xffff
    const nextBuf = m.alloc(((newCap << 16) >> 16) * 4)
    const oldMod = m.u32(pModHdr)
    for (let i = 0; i < count * 4; i += 4) {
      m.setU32((nextBuf + i) >>> 0, m.u32((oldMod + i) >>> 0))
    }
    m.setU16((pListEx + 0x56) >>> 0, newCap)
    m.setU32(pModHdr, nextBuf)
  }
  const curCount = (m.u16((pListEx + 0x54) >>> 0) << 16) >> 16
  const pMod = m.u32(pModHdr)
  for (let i = curCount; i > ins; i--) {
    m.setU32((pMod + i * 4) >>> 0, m.u32((pMod + (i - 1) * 4) >>> 0))
  }
  m.setU32((pMod + ins * 4) >>> 0, dwKey >>> 0)
  m.setU16((pListEx + 0x54) >>> 0, (curCount + 1) & 0xffff)
}

/**
 * `@va D2Common:0x6FD88FF0` (`D2Common.#11116` `STATLIST_GetMaxDurabilityFromUnit`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> total stat `0x49` if base stat `0x49 != 0`, else `0`).
 */
export function STATLIST_GetMaxDurabilityFromUnit113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) <= 0x49) return 0
  const pIscRec = (m.u32((sgpt + 0xbcc) >>> 0) + 0x5c64) >>> 0
  if (pIscRec === 0) return 0
  const pStatList = m.u32((u + 0x5c) >>> 0)
  if (pStatList === 0) return 0
  if (getBaseStatWithMinFromList113c(m, pStatList, 0x00490000, pIscRec) === 0) return 0
  return getTotalStatWithMinFromList113c(m, pStatList, 0x00490000, pIscRec)
}

/**
 * `@va D2Common:0x6FD89050` (`D2Common.#10578` `STATLIST_GetMaxStaminaFromUnit`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> total stat `0x0B` or `0`).
 */
export function STATLIST_GetMaxStaminaFromUnit113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pStatList = m.u32((u + 0x5c) >>> 0)
  if (pStatList === 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) <= 0x0b) return 0
  const pIscRec = (m.u32((sgpt + 0xbcc) >>> 0) + 0xdec) >>> 0
  if (pIscRec === 0) return 0
  return getTotalStatWithMinFromList113c(m, pStatList, 0x000b0000, pIscRec)
}

/**
 * `@va D2Common:0x6FD890A0` (`D2Common.#10186` `STATLIST_GetMaxManaFromUnit`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> total stat `0x09` or `0`).
 */
export function STATLIST_GetMaxManaFromUnit113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pStatList = m.u32((u + 0x5c) >>> 0)
  if (pStatList === 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) <= 0x09) return 0
  const pIscRec = (m.u32((sgpt + 0xbcc) >>> 0) + 0xb64) >>> 0
  if (pIscRec === 0) return 0
  return getTotalStatWithMinFromList113c(m, pStatList, 0x00090000, pIscRec)
}

/**
 * `@va D2Common:0x6FD890F0` (`D2Common.#10913` `STATLIST_GetMaxLifeFromUnit`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> total stat `0x07` or `0`).
 */
export function STATLIST_GetMaxLifeFromUnit113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pStatList = m.u32((u + 0x5c) >>> 0)
  if (pStatList === 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) <= 0x07) return 0
  const pIscRec = (m.u32((sgpt + 0xbcc) >>> 0) + 0x8dc) >>> 0
  if (pIscRec === 0) return 0
  return getTotalStatWithMinFromList113c(m, pStatList, 0x00070000, pIscRec)
}

/**
 * `@va D2Common:0x6FD89140` (`D2Common.#10680` `STATLIST_GetStatValue`,
 * stdcall `[esp+4] = pStatList`, `[esp+8] = nStatId`, `[esp+0xC] = nLayer`, `ret 0xC`).
 */
export function STATLIST_GetStatValue113c(
  m: Memory113c,
  pStatList: number,
  nStatId: number,
  nLayer: number,
): number {
  const s = pStatList >>> 0
  if (s === 0) return 0
  const statId = nStatId | 0
  if (statId < 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (statId >= (m.u32((sgpt + 0xbd4) >>> 0) | 0)) return 0
  const pIscRec = (m.u32((sgpt + 0xbcc) >>> 0) + imul32(statId, 0x144)) >>> 0
  if (pIscRec === 0) return 0
  const dwKey = ((statId << 16) + (nLayer & 0xffff)) >>> 0
  return getBaseStatWithMinFromList113c(m, s, dwKey, pIscRec)
}

/**
 * `@va D2Common:0x6FD891A0` (`D2Common.#10848` `STATLIST_GetTotalStatValueLayer0`,
 * stdcall `[esp+4] = pStatList`, `[esp+8] = nStatId`, `ret 8`).
 */
export function STATLIST_GetTotalStatValueLayer0_113c(
  m: Memory113c,
  pStatList: number,
  nStatId: number,
): number {
  const s = pStatList >>> 0
  if (s === 0) return 0
  const statId = nStatId | 0
  if (statId < 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (statId >= (m.u32((sgpt + 0xbd4) >>> 0) | 0)) return 0
  const pIscRec = (m.u32((sgpt + 0xbcc) >>> 0) + imul32(statId, 0x144)) >>> 0
  if (pIscRec === 0) return 0
  return getTotalStatWithMinFromList113c(m, s, (statId << 16) >>> 0, pIscRec)
}

/**
 * `@va D2Common:0x6FD89380` (`STATLIST_GetStatBonusFromListInline`,
 * custom LTCG `eax = pStatList`, `esi = nStatId`, `[esp+4] = nLayer`, `ret 4`).
 */
export function STATLIST_GetStatBonusFromListInline113c(
  m: Memory113c,
  pStatList: number,
  nStatId: number,
  nLayer: number,
): number {
  const s = pStatList >>> 0
  if (s === 0) return 0
  const statId = nStatId | 0
  let totalVal = 0
  if (statId >= 0) {
    const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    if (statId < (m.u32((sgpt + 0xbd4) >>> 0) | 0)) {
      const pIscRec = (m.u32((sgpt + 0xbcc) >>> 0) + imul32(statId, 0x144)) >>> 0
      if (pIscRec !== 0) {
        const dwKey = ((statId << 16) + (nLayer & 0xffff)) >>> 0
        totalVal = getTotalStatWithMinFromList113c(m, s, dwKey, pIscRec) | 0
      }
    }
  }
  let baseVal = 0
  if (statId >= 0) {
    const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    if (statId < (m.u32((sgpt + 0xbd4) >>> 0) | 0)) {
      const pIscRec = (m.u32((sgpt + 0xbcc) >>> 0) + imul32(statId, 0x144)) >>> 0
      if (pIscRec !== 0) {
        const dwKey = ((statId << 16) + (nLayer & 0xffff)) >>> 0
        baseVal = getBaseStatWithMinFromList113c(m, s, dwKey, pIscRec) | 0
      }
    }
  }
  return ((totalVal - baseVal) | 0) >>> 0
}

/**
 * `@va D2Common:0x6FD89430` (`D2Common.#10910` `STATLIST_GetUnitStatWithLayer`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nStatId`, `[esp+0xC] = nLayer`, `ret 0xC`).
 */
export function STATLIST_GetUnitStatWithLayer113c(
  m: Memory113c,
  pUnit: number,
  nStatId: number,
  nLayer: number,
): number {
  const pStatList = m.u32(((pUnit >>> 0) + 0x5c) >>> 0)
  if (pStatList === 0) return 0
  const statId = nStatId | 0
  if (statId < 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (statId >= (m.u32((sgpt + 0xbd4) >>> 0) | 0)) return 0
  const pIscRec = (m.u32((sgpt + 0xbcc) >>> 0) + imul32(statId, 0x144)) >>> 0
  if (pIscRec === 0) return 0
  const dwKey = ((statId << 16) + (nLayer & 0xffff)) >>> 0
  return getTotalStatWithMinFromList113c(m, pStatList, dwKey, pIscRec)
}

/**
 * `@va D2Common:0x6FD894E0` (`STATLIST_GetBaseStatFromListInline`,
 * custom LTCG `ecx = pStatList`, `eax = nStatId`, `[esp+4] = nLayer`, `ret 4`).
 */
export function STATLIST_GetBaseStatFromListInline113c(
  m: Memory113c,
  pStatList: number,
  nStatId: number,
  nLayer: number,
): number {
  const s = pStatList >>> 0
  if (s === 0) return 0
  const statId = nStatId | 0
  if (statId < 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (statId >= (m.u32((sgpt + 0xbd4) >>> 0) | 0)) return 0
  const pIscRec = (m.u32((sgpt + 0xbcc) >>> 0) + imul32(statId, 0x144)) >>> 0
  if (pIscRec === 0) return 0
  const dwKey = ((statId << 16) + (nLayer & 0xffff)) >>> 0
  return getBaseStatWithMinFromList113c(m, s, dwKey, pIscRec)
}

/**
 * `@va D2Common:0x6FD8A1D0` (`D2Common.#10745` `STATLIST_SetBaseStatEx`,
 * stdcall `[esp+4] = pStatList`, `[esp+8] = nStatId`, `[esp+0xC] = nValue`, `[esp+0x10] = nLayer`, `[esp+0x14] = pUnit`, `ret 0x14`).
 */
export function STATLIST_SetBaseStatEx113c(
  m: Memory113c,
  pStatList: number,
  nStatId: number,
  nValue: number,
  nLayer: number,
  pUnit: number,
): number {
  const s = pStatList >>> 0
  if (s === 0) return 0
  const dwKey = ((nStatId << 16) + (nLayer & 0xffff)) >>> 0
  const pBaseHdr = (s + 0x24) >>> 0
  let idx = STATLIST_FindStatIndex113c(m, pBaseHdr, dwKey)
  let pEntry = idx >= 0 ? (m.u32(pBaseHdr) + idx * 8) >>> 0 : 0
  const val = nValue | 0
  if (pEntry === 0) {
    if (val === 0) return 0
    m.u32(s)
    const ins = STATLIST_FindInsertPos113c(m, pBaseHdr, dwKey)
    pEntry = insertStatSlot(m, pBaseHdr, ins, dwKey)
    idx = ins
  }
  const oldVal = m.u32((pEntry + 4) >>> 0) | 0
  const delta = (val - oldVal) | 0
  if (delta === 0) return 0
  if (val === 0) {
    m.u32(s)
    removeStatSlot(m, pBaseHdr, idx)
  } else {
    m.setU32((pEntry + 4) >>> 0, val >>> 0)
  }
  propagateDeltaMem113c(m, s, dwKey, delta, pUnit >>> 0)
  if ((m.u32((s + 0x10) >>> 0) | 0) < 0 && m.u32((s + 0x08) >>> 0) === 0) {
    recordModStatMem113c(m, s, dwKey)
  }
  return 1
}

/** `D2Common 0x6FD517A0` (`eax = statId`): ItemStatCost record or `0` (signed range check vs `+0xBD4`). */
function getIscRecordOrZeroMem113c(m: Memory113c, statId: number): number {
  const id = statId | 0
  if (id < 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (id >= (m.u32((sgpt + 0xbd4) >>> 0) | 0)) return 0
  return (m.u32((sgpt + 0xbcc) >>> 0) + imul32(id, 0x144)) >>> 0
}

/**
 * Dynamic-op refresh shared by 0x6FD8A442..0x6FD8A4ED and 0x6FD8A87C..0x6FD8A91A: for an extended list with
 * `0x20000000` set, collects the `pFullStat (+0x48)` keys whose ItemStatCost `+0x53` byte is non-zero, then
 * re-evaluates each through `0x6FD89CE0` (`STATLIST_RecomputeExStat`).
 */
function refreshDynamicOpStatsMem113c(m: Memory113c, s: number): void {
  const flags = m.u32((s + 0x10) >>> 0)
  if ((flags | 0) >= 0 || (flags & 0x20000000) === 0) return
  const pArr = m.u32((s + 0x48) >>> 0)
  const count = (m.u16((s + 0x4c) >>> 0) << 16) >> 16
  const keys: number[] = []
  for (let i = 0; i < count; i++) {
    const k = m.u32((pArr + i * 8) >>> 0)
    const pRec = getIscRecordOrZeroMem113c(m, (k >> 16) & 0xffff)
    if (pRec !== 0 && m.u8((pRec + 0x53) >>> 0) !== 0) keys.push(k)
  }
  for (const k of keys) {
    if (getIscRecordOrZeroMem113c(m, (k >> 16) & 0xffff) !== 0) {
      STATLIST_RecomputeExStat113c(m, s, (k >> 16) & 0xffff, k & 0xffff)
    }
  }
}

/**
 * Propagates every entry of `s` (`pFullStat` when extended, else `pStat`) into `pTarget` via `0x6FD89F70`
 * with `sign * value`; when `bSkipDamageRelated`, entries whose ItemStatCost `+0x04` byte hits
 * `gdwBitMasks[2]` (`[0x6FDD90B0] + 8`) are skipped (0x6FD8A552..0x6FD8A55D / 0x6FD8A9AD..0x6FD8A9B8).
 */
function propagateSubListEntriesMem113c(
  m: Memory113c,
  s: number,
  pTarget: number,
  sign: number,
  bSkipDamageRelated: boolean,
): void {
  const flags = m.u32((s + 0x10) >>> 0)
  const pHdr = (flags | 0) < 0 ? (s + 0x48) >>> 0 : (s + 0x24) >>> 0
  const pArr = m.u32(pHdr)
  const count = (m.u16((pHdr + 4) >>> 0) << 16) >> 16
  for (let i = 0; i < count; i++) {
    const k = m.u32((pArr + i * 8) >>> 0)
    if (bSkipDamageRelated) {
      const pRec = getIscRecordOrZeroMem113c(m, (k >> 16) & 0xffff)
      if (pRec === 0) continue
      const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
      if ((m.u8((pBitMasks + 8) >>> 0) & m.u8((pRec + 4) >>> 0)) !== 0) continue
    }
    const v = m.u32((pArr + i * 8 + 4) >>> 0) | 0
    propagateDeltaMem113c(m, pTarget, k, imul32(sign, v), 0)
  }
}

/**
 * Memory port of `D2Common 0x6FD8A3B0` (`STATLIST_UnlinkSubListInternal`): unlinks `s` from its parent's
 * `pMyLastList (+0x3C)` / `pMyStats (+0x40)` and from the `+0x2C/+0x30` chain, clears `pPrev/pNext/pOwner`,
 * stops for `0x2000` lists, refreshes dynamic-op stats, then removes its entries from the parent (skipping
 * damage-related stats when `0x40000000` is set, 0x6FD8A50F). The trailing `pfnCallback (+0x38)` call
 * (0x6FD8A5A7..0x6FD8A5B6) is a host callback and is not modelled.
 */
function unlinkSubListMem113c(m: Memory113c, pSub: number): void {
  const s = pSub >>> 0
  if (s === 0) return
  const pParent = m.u32((s + 0x34) >>> 0)
  if (pParent !== 0) {
    if ((m.u32((pParent + 0x10) >>> 0) | 0) < 0) {
      if (m.u32((pParent + 0x3c) >>> 0) === s) {
        m.setU32((pParent + 0x3c) >>> 0, m.u32((s + 0x2c) >>> 0))
      }
      if (m.u32((pParent + 0x40) >>> 0) === s) {
        m.setU32((pParent + 0x40) >>> 0, m.u32((s + 0x2c) >>> 0))
      }
    }
    m.setU32((s + 0x34) >>> 0, 0)
  }
  const pNext = m.u32((s + 0x30) >>> 0)
  if (pNext !== 0) {
    m.setU32((pNext + 0x2c) >>> 0, m.u32((s + 0x2c) >>> 0))
  }
  const pPrev = m.u32((s + 0x2c) >>> 0)
  if (pPrev !== 0) {
    m.setU32((pPrev + 0x30) >>> 0, m.u32((s + 0x30) >>> 0))
  }
  m.u32((s + 0x04) >>> 0)
  const subFlags = m.u32((s + 0x10) >>> 0)
  m.setU32((s + 0x2c) >>> 0, 0)
  m.setU32((s + 0x30) >>> 0, 0)
  m.setU32((s + 0x04) >>> 0, 0)
  if ((subFlags & 0x2000) !== 0) return
  refreshDynamicOpStatsMem113c(m, s)
  if (pParent !== 0) {
    const bMerged = (m.u32((s + 0x10) >>> 0) & 0x40000000) !== 0
    propagateSubListEntriesMem113c(m, s, pParent, -1, bMerged)
  }
}

/**
 * Memory port of `D2Common 0x6FD8A7D0` (`STATLIST_MergeStatLists`, stdcall `(pUnit, pSub, bType)`): requires an
 * extended `pUnit->pStatListEx`, unlinks `pSub` (0x6FD8A7F8), returns if it is already in the parent chain,
 * links it as `pMyStats` (`0x2000` lists) or `pMyLastList`, refreshes dynamic-op stats (0x6FD8A87C), then
 * adds its entries into the parent: `bType != 0` clears `0x40000000` and adds all; `bType == 0` sets it and
 * skips damage-related stats (0x6FD8A973..0x6FD8A9D5).
 */
function mergeSubListMem113c(m: Memory113c, pTargetUnit: number, pSub: number, bType: number): void {
  const u = pTargetUnit >>> 0
  const s = pSub >>> 0
  const pParentEx = m.u32((u + 0x5c) >>> 0)
  if (pParentEx === 0 || (m.u32((pParentEx + 0x10) >>> 0) | 0) >= 0) return
  unlinkSubListMem113c(m, s)
  for (let cur = pParentEx; cur !== 0; cur = m.u32((cur + 0x34) >>> 0)) {
    if (cur === s) return
  }
  if ((m.u8((s + 0x10) >>> 0) & 0x04) !== 0) {
    m.setU32((pParentEx + 0x10) >>> 0, (m.u32((pParentEx + 0x10) >>> 0) | 0x02) >>> 0)
  }
  if ((m.u32((s + 0x10) >>> 0) & 0x2000) !== 0) {
    m.setU32((s + 0x2c) >>> 0, m.u32((pParentEx + 0x40) >>> 0))
    const oldSet = m.u32((pParentEx + 0x40) >>> 0)
    if (oldSet !== 0) {
      m.setU32((oldSet + 0x30) >>> 0, s)
    }
    m.setU32((s + 0x30) >>> 0, 0)
    m.setU32((pParentEx + 0x40) >>> 0, s)
    m.setU32((s + 0x34) >>> 0, pParentEx)
    m.setU32((s + 0x04) >>> 0, u)
    return
  }
  const oldLast = m.u32((pParentEx + 0x3c) >>> 0)
  m.setU32((s + 0x2c) >>> 0, oldLast)
  if (oldLast !== 0) {
    m.setU32((oldLast + 0x30) >>> 0, s)
  }
  m.setU32((s + 0x34) >>> 0, pParentEx)
  m.setU32((pParentEx + 0x3c) >>> 0, s)
  m.setU32((s + 0x04) >>> 0, u)
  refreshDynamicOpStatsMem113c(m, s)
  const flags = m.u32((s + 0x10) >>> 0)
  if (bType !== 0) {
    m.setU32((s + 0x10) >>> 0, (flags & 0xbfffffff) >>> 0)
    propagateSubListEntriesMem113c(m, s, pParentEx, 1, false)
  } else {
    m.setU32((s + 0x10) >>> 0, (flags | 0x40000000) >>> 0)
    propagateSubListEntriesMem113c(m, s, pParentEx, 1, true)
  }
}

/**
 * `@va D2Common:0x6FD8A5D0` (`D2Common.#11127` `STATLIST_UnlinkUnitStatList`,
 * stdcall `[esp+4] = pUnusedUnit`, `[esp+8] = pTargetUnit`, `ret 8`, void).
 */
export function STATLIST_UnlinkUnitStatList113c(
  m: Memory113c,
  _pUnusedUnit: number,
  pTargetUnit: number,
): void {
  const u = pTargetUnit >>> 0
  if (u === 0) return
  const pStatList = m.u32((u + 0x5c) >>> 0)
  if (pStatList === 0) return
  unlinkSubListMem113c(m, pStatList)
}

/**
 * `@va D2Common:0x6FD8A650` (`D2Common.#10343` `STATLIST_ClearBaseStats`,
 * stdcall `[esp+4] = pStatList`, `ret 4`, void).
 */
export function STATLIST_ClearBaseStats113c(m: Memory113c, pStatList: number): void {
  const s = pStatList >>> 0
  if (s === 0) return
  if ((m.u16((s + 0x28) >>> 0) << 16) >> 16 <= 0) return
  const pBaseHdr = (s + 0x24) >>> 0
  while ((m.u16((s + 0x28) >>> 0) << 16) >> 16 > 0) {
    const pArr0 = m.u32(pBaseHdr)
    const statId = m.u16((pArr0 + 2) >>> 0)
    const layer = m.u16(pArr0)
    const dwKey = ((statId << 16) + layer) >>> 0
    const idx = STATLIST_FindStatIndex113c(m, pBaseHdr, dwKey)
    if (idx >= 0) {
      const pEntry = (m.u32(pBaseHdr) + idx * 8) >>> 0
      if (pEntry !== 0) {
        const negVal = -(m.u32((pEntry + 4) >>> 0) | 0) | 0
        if (negVal !== 0) {
          m.u32(s)
          removeStatSlot(m, pBaseHdr, idx)
          propagateDeltaMem113c(m, s, dwKey, negVal, 0)
          if ((m.u32((s + 0x10) >>> 0) | 0) < 0 && m.u32((s + 0x08) >>> 0) === 0) {
            recordModStatMem113c(m, s, dwKey)
          }
        }
      }
    }
  }
}

/**
 * `@va D2Common:0x6FD8AAB0` (`D2Common.#10656` `STATLIST_UpdateUnitStateSetFlag`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nState`, `[esp+0xC] = bSet`, `ret 0xC`).
 */
export function STATLIST_UpdateUnitStateSetFlag113c(
  m: Memory113c,
  pUnit: number,
  nState: number,
  bSet: number,
): number {
  const state = nState | 0
  if (state === 0) return 0
  const u = pUnit >>> 0
  const pListEx = m.u32((u + 0x5c) >>> 0)
  if (pListEx === 0) return 0
  if ((m.u32((pListEx + 0x10) >>> 0) | 0) >= 0) return 0
  const pSub = findSubListByStateAndFlags113c(m, pListEx, state)
  if (pSub === 0) return 0
  const subFlags = m.u32((pSub + 0x10) >>> 0)
  if (bSet !== 0) {
    if ((subFlags & 0x2000) !== 0) return 0
    unlinkSubListMem113c(m, pSub)
    m.setU32((pSub + 0x10) >>> 0, (m.u32((pSub + 0x10) >>> 0) | 0x2000) >>> 0)
    mergeSubListMem113c(m, u, pSub, 1)
    return 1
  }
  if ((subFlags & 0x2000) === 0) return 0
  unlinkSubListMem113c(m, pSub)
  m.setU32((pSub + 0x10) >>> 0, (m.u32((pSub + 0x10) >>> 0) & ~0x2000) >>> 0)
  mergeSubListMem113c(m, u, pSub, 1)
  return 1
}

/**
 * `@va D2Common:0x6FD96D50` (`STATLIST_RemoveItemDurabilityStatsModHandler`,
 * stdcall `[esp+4] = pItem`, `[esp+8..0x18] = a1..a5`, `[esp+0x1C] = pTargetUnit`, `ret 0x1C`).
 */
export function STATLIST_RemoveItemDurabilityStatsModHandler113c(
  m: Memory113c,
  pItem: number,
  _a1: number,
  _a2: number,
  _a3: number,
  _a4: number,
  _a5: number,
  pTargetUnit: number,
): number {
  const target = pTargetUnit >>> 0
  const u = target !== 0 && m.u32(target) === 4 ? target : pItem >>> 0
  for (const statKey of [0x00490000, 0x00480000]) {
    const pStatList = m.u32((u + 0x5c) >>> 0)
    if (pStatList !== 0) {
      const pBaseHdr = (pStatList + 0x24) >>> 0
      const idx = STATLIST_FindStatIndex113c(m, pBaseHdr, statKey)
      if (idx >= 0) {
        const pEntry = (m.u32(pBaseHdr) + idx * 8) >>> 0
        if (pEntry !== 0) {
          const negVal = -(m.u32((pEntry + 4) >>> 0) | 0) | 0
          if (negVal !== 0) {
            m.u32(pStatList)
            removeStatSlot(m, pBaseHdr, idx)
            propagateDeltaMem113c(m, pStatList, statKey, negVal, 0)
            if ((m.u32((pStatList + 0x10) >>> 0) | 0) < 0 && m.u32((pStatList + 0x08) >>> 0) === 0) {
              recordModStatMem113c(m, pStatList, statKey)
            }
            if (m.u32(u) === 0) {
              recordModStatMem113c(m, m.u32((u + 0x5c) >>> 0), statKey)
            }
          }
        }
      }
    }
  }
  return 1
}

/**
 * `@va D2Common:0x6FDA4A00` (`D2Common.#11089` `DATATBLS_CalculateMonsterStatsByLevel`,
 * stdcall `(nMonsterId, nGameType, nDifficulty, nLevel, nFlags, pOutStats) -> BOOL`, `ret 0x18`).
 */
export function DATATBLS_CalculateMonsterStatsByLevel113c(
  m: Memory113c,
  nMonsterId: number,
  nGameType: number,
  nDifficulty: number,
  nLevel: number,
  nFlags: number,
  pOutStats: number,
): number {
  const monId = nMonsterId | 0
  if (monId < 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (monId >= (m.u32((sgpt + 0xa80) >>> 0) | 0)) return 0
  const pMonStatsTxt = (m.u32((sgpt + 0xa78) >>> 0) + imul32(monId, 0x1a8)) >>> 0
  if (pMonStatsTxt === 0) return 0

  const monLvlCount = m.u32((sgpt + 0xb74) >>> 0) | 0
  const maxLvlIdx = (monLvlCount - 1) | 0
  let lvl = nLevel | 0
  if (lvl >= maxLvlIdx) lvl = maxLvlIdx
  if (lvl < 0 || lvl >= monLvlCount) return 0
  const pMonLvlTxt = (m.u32((sgpt + 0xb70) >>> 0) + imul32(lvl, 0x78)) >>> 0
  if (pMonLvlTxt === 0) return 0

  let diff = nDifficulty | 0
  if (diff <= 0) diff = 0
  else if (diff >= 2) diff = 2

  const bExp = (nGameType | 0) !== 0 ? 1 : 0
  const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
  const bNoRatio = (m.u8((pMonStatsTxt + 0x0c) >>> 0) & m.u8((pBitMasks + 8) >>> 0)) !== 0
  const flags = nFlags | 0
  const out = pOutStats >>> 0

  if ((flags & 0x01) !== 0) {
    let minHp = (m.u16((pMonStatsTxt + 0xb0 + diff * 2) >>> 0) << 16) >> 16
    let maxHp = (m.u16((pMonStatsTxt + 0xb6 + diff * 2) >>> 0) << 16) >> 16
    if (!bNoRatio) {
      const ratio = m.u32((pMonLvlTxt + (diff + (bExp + 4) * 3) * 4) >>> 0) | 0
      minHp = mulDiv113c(minHp, ratio, 100)
      maxHp = mulDiv113c(maxHp, ratio, 100)
    }
    m.setU32(out, minHp >>> 0)
    m.setU32((out + 0x04) >>> 0, maxHp >>> 0)
  }

  if ((flags & 0x02) !== 0) {
    let ac = (m.u16((pMonStatsTxt + 0xbc + diff * 2) >>> 0) << 16) >> 16
    if (!bNoRatio) {
      const ratio = m.u32((pMonLvlTxt + (diff + bExp * 3) * 4) >>> 0) | 0
      ac = mulDiv113c(ac, ratio, 100)
    }
    m.setU32((out + 0x08) >>> 0, ac >>> 0)
  }

  if ((flags & 0x04) !== 0) {
    let exp = (m.u16((pMonStatsTxt + 0xd4 + diff * 2) >>> 0) << 16) >> 16
    if (!bNoRatio) {
      const ratio = m.u32((pMonLvlTxt + (diff + (bExp + 8) * 3) * 4) >>> 0) | 0
      exp = mulDiv113c(exp, ratio, 100)
    }
    m.setU32((out + 0x10) >>> 0, exp >>> 0)
  }

  if ((flags & 0x08) !== 0) {
    let th = (m.u16((pMonStatsTxt + 0xc2 + diff * 2) >>> 0) << 16) >> 16
    let minD = (m.u16((pMonStatsTxt + 0xda + diff * 2) >>> 0) << 16) >> 16
    let maxD = (m.u16((pMonStatsTxt + 0xe0 + diff * 2) >>> 0) << 16) >> 16
    if (!bNoRatio) {
      const thRatio = m.u32((pMonLvlTxt + (diff + (bExp + 2) * 3) * 4) >>> 0) | 0
      const dmRatio = m.u32((pMonLvlTxt + (diff + (bExp + 6) * 3) * 4) >>> 0) | 0
      th = mulDiv113c(th, thRatio, 100)
      minD = mulDiv113c(minD, dmRatio, 100)
      maxD = mulDiv113c(maxD, dmRatio, 100)
    }
    m.setU32((out + 0x0c) >>> 0, th >>> 0)
    m.setU32((out + 0x14) >>> 0, minD >>> 0)
    m.setU32((out + 0x18) >>> 0, maxD >>> 0)
  }

  if ((flags & 0x10) !== 0) {
    let th = (m.u16((pMonStatsTxt + 0xc8 + diff * 2) >>> 0) << 16) >> 16
    let minD = (m.u16((pMonStatsTxt + 0xe6 + diff * 2) >>> 0) << 16) >> 16
    let maxD = (m.u16((pMonStatsTxt + 0xec + diff * 2) >>> 0) << 16) >> 16
    if (!bNoRatio) {
      const thRatio = m.u32((pMonLvlTxt + (diff + (bExp + 2) * 3) * 4) >>> 0) | 0
      const dmRatio = m.u32((pMonLvlTxt + (diff + (bExp + 6) * 3) * 4) >>> 0) | 0
      th = mulDiv113c(th, thRatio, 100)
      minD = mulDiv113c(minD, dmRatio, 100)
      maxD = mulDiv113c(maxD, dmRatio, 100)
    }
    m.setU32((out + 0x0c) >>> 0, th >>> 0)
    m.setU32((out + 0x1c) >>> 0, minD >>> 0)
    m.setU32((out + 0x20) >>> 0, maxD >>> 0)
  }

  if ((flags & 0x20) !== 0) {
    let th = (m.u16((pMonStatsTxt + 0xce + diff * 2) >>> 0) << 16) >> 16
    let minD = (m.u16((pMonStatsTxt + 0xf2 + diff * 2) >>> 0) << 16) >> 16
    let maxD = (m.u16((pMonStatsTxt + 0xf8 + diff * 2) >>> 0) << 16) >> 16
    if (!bNoRatio) {
      const thRatio = m.u32((pMonLvlTxt + (diff + (bExp + 2) * 3) * 4) >>> 0) | 0
      const dmRatio = m.u32((pMonLvlTxt + (diff + (bExp + 6) * 3) * 4) >>> 0) | 0
      th = mulDiv113c(th, thRatio, 100)
      minD = mulDiv113c(minD, dmRatio, 100)
      maxD = mulDiv113c(maxD, dmRatio, 100)
    }
    m.setU32((out + 0x0c) >>> 0, th >>> 0)
    m.setU32((out + 0x24) >>> 0, minD >>> 0)
    m.setU32((out + 0x28) >>> 0, maxD >>> 0)
  }

  const elSlots: Array<readonly [number, number, number, number]> = [
    [0x40, 0x10e, 0x120, 0x132],
    [0x80, 0x114, 0x126, 0x138],
    [0x100, 0x11a, 0x12c, 0x13e],
  ]
  for (const [bit, minOff, maxOff, lenOff] of elSlots) {
    if ((flags & bit) !== 0) {
      const minEl = (m.u16((pMonStatsTxt + minOff + diff * 2) >>> 0) << 16) >> 16
      const maxEl = (m.u16((pMonStatsTxt + maxOff + diff * 2) >>> 0) << 16) >> 16
      if (bNoRatio) {
        m.setU32((out + 0x24) >>> 0, minEl >>> 0)
        m.setU32((out + 0x28) >>> 0, maxEl >>> 0)
      } else {
        const elRatio = m.u32((pMonLvlTxt + (diff + (bExp + 6) * 3) * 4) >>> 0) | 0
        m.setU32((out + 0x2c) >>> 0, mulDiv113c(minEl, elRatio, 100) >>> 0)
        m.setU32((out + 0x30) >>> 0, mulDiv113c(maxEl, elRatio, 100) >>> 0)
      }
      const lenEl = (m.u16((pMonStatsTxt + lenOff + diff * 2) >>> 0) << 16) >> 16
      m.setU32((out + 0x34) >>> 0, lenEl >>> 0)
    }
  }

  return 1
}

/**
 * `@va D2Common:0x6FDBAB20` (`MISSILE_CalculateMasteryBonus`,
 * custom LTCG `eax = pUnit`, `ecx = nElemType`, `esi = nDamage`, plain `ret`).
 */
export function MISSILE_CalculateMasteryBonus113c(
  m: Memory113c,
  pUnit: number,
  nElemType: number,
  nDamage: number,
): number {
  const u = pUnit >>> 0
  const dmg = nDamage | 0
  if (u === 0 || dmg === 0) return 0
  let statId = -1
  switch (nElemType | 0) {
    case 1:
      statId = 0x149
      break
    case 2:
      statId = 0x14a
      break
    case 4:
    case 12:
      statId = 0x14b
      break
    case 5:
      statId = 0x14c
      break
    default:
      return 0
  }
  const pct = STATLIST_GetUnitStatWithLayer113c(m, u, statId, 0) | 0
  if (pct === 0) return 0
  return mulDiv113c(pct, dmg, 100) >>> 0
}

const ITEMMODS_ASSERT_FILE_113C = '..\\Source\\D2Common\\ITEMS\\ItemMods.cpp'

/**
 * `@va D2Common:0x6FD97020` (`ITEMMODS_GetOrCreateStatList`,
 * custom LTCG `ecx = pItem`, `eax = pUnit`, `[esp+4] = nStateId`, `[esp+8] = nFlags`, `ret 8` -> `D2StatListStrc*`).
 *
 * Selects `pTarget = pItem != 0 ? pItem : pUnit`. If `pTarget->pStatListEx (+0x5C)` is non-null and
 * extended (`dwFlags < 0`), searches via `0x6FD87F80` (`findSubListByStateAndFlags113c`) when `nStateId != 0`
 * or `0x6FD87F40` (`STATLIST_GetStatListFromFlag113c`) when `nStateId == 0`, returning any existing match.
 * Otherwise allocates a new `0x3C`-byte `D2StatListStrc` via `D2Common.#11013` (`0x6FD88100`) with
 * `(pMemPool = pTarget->pMemPool (+0x08), fFlags = nFlags, dwExpireFrame = 0, nUnitType = 4, dwUnitGuid = pTarget->dwUnitId (+0x0C))`,
 * merges it onto `pTarget` with `bType = 1` via `D2Common.#10807` (`0x6FD8A7D0`), asserts `pStatList != NULL`
 * at `ItemMods.cpp:0x201` (`513`), writes `pStatList->dwStateNo (+0x14) = nStateId`, and returns `pStatList`.
 */
export function ITEMMODS_GetOrCreateStatList113c(
  m: Memory113c,
  pItem: number,
  pUnit: number,
  nStateId: number,
  nFlags: number,
): number {
  const pTarget = (pItem >>> 0) !== 0 ? pItem >>> 0 : pUnit >>> 0
  const pStatListEx = m.u32((pTarget + D2UnitStrc.pStatListEx.off) >>> 0)
  if (pStatListEx !== 0 && (m.u32((pStatListEx + D2StatListStrc.dwFlags.off) >>> 0) | 0) < 0) {
    const pExisting =
      (nStateId | 0) !== 0
        ? findSubListByStateAndFlags113c(m, pStatListEx, nStateId)
        : STATLIST_GetStatListFromFlag113c(m, pStatListEx, nFlags)
    if (pExisting !== 0) {
      return pExisting >>> 0
    }
  }
  const dwUnitId = m.u32((pTarget + D2UnitStrc.dwUnitId.off) >>> 0)
  const pMemPool = m.u32((pTarget + D2UnitStrc.pMemPool.off) >>> 0)
  const pStatList = m.alloc(D2StatListStrc_SIZE)
  if (pStatList !== 0) {
    m.set(pStatList, D2StatListStrc.pMemPool, pMemPool)
    m.set(pStatList, D2StatListStrc.eOwnerType, 4)
    m.set(pStatList, D2StatListStrc.dwOwnerId, dwUnitId)
    m.set(pStatList, D2StatListStrc.dwFlags, nFlags >>> 0)
    m.set(pStatList, D2StatListStrc.dwExpireFrame, 0)
  }
  mergeSubListMem113c(m, pTarget, pStatList, 1)
  if (pStatList === 0) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x201)
  }
  m.set(pStatList, D2StatListStrc.dwStateNo, nStateId >>> 0)
  return pStatList >>> 0
}

// ---------------------------------------------------------------------------
// Iteration 10 Lane A: Memory113c-pure callee helpers + I10A-1 (#01..#18)
// ---------------------------------------------------------------------------

function allocStatListMem113c(
  m: Memory113c,
  pMemPool: number,
  fFlags: number,
  dwExpireFrame: number,
  eOwnerType: number,
  dwOwnerId: number,
): number {
  const pStatList = m.alloc(D2StatListStrc_SIZE)
  if (pStatList === 0) return 0
  for (let i = 0; i < 15; i++) {
    m.setU32((pStatList + i * 4) >>> 0, 0)
  }
  m.setU32(pStatList, pMemPool >>> 0)
  m.setU32((pStatList + 0x08) >>> 0, eOwnerType >>> 0)
  m.setU32((pStatList + 0x0c) >>> 0, dwOwnerId >>> 0)
  m.setU32((pStatList + 0x10) >>> 0, fFlags >>> 0)
  m.setU32((pStatList + 0x18) >>> 0, dwExpireFrame >>> 0)
  return pStatList >>> 0
}

function addStatMem113c(
  m: Memory113c,
  pStatList: number,
  nStatId: number,
  nDelta: number,
  nLayer: number,
): void {
  const s = pStatList >>> 0
  if (s === 0) return
  const delta = nDelta | 0
  if (delta === 0) return
  const dwKey = ((nStatId << 16) + (nLayer & 0xffff)) >>> 0
  const pBaseHdr = (s + 0x24) >>> 0
  let idx = STATLIST_FindStatIndex113c(m, pBaseHdr, dwKey)
  let pEntry = idx >= 0 ? (m.u32(pBaseHdr) + idx * 8) >>> 0 : 0
  if (pEntry === 0) {
    m.u32(s)
    const ins = STATLIST_FindInsertPos113c(m, pBaseHdr, dwKey)
    pEntry = insertStatSlot(m, pBaseHdr, ins, dwKey)
    idx = ins
  }
  const nextVal = ((m.u32((pEntry + 4) >>> 0) | 0) + delta) | 0
  m.setU32((pEntry + 4) >>> 0, nextVal >>> 0)
  if (nextVal === 0) {
    m.u32(s)
    removeStatSlot(m, pBaseHdr, idx)
  }
  propagateDeltaMem113c(m, s, dwKey, delta, 0)
  if ((m.u32((s + 0x10) >>> 0) | 0) < 0 && m.u32((s + 0x08) >>> 0) === 0) {
    recordModStatMem113c(m, s, dwKey)
  }
}

function setUnitStatMem113c(
  m: Memory113c,
  pUnit: number,
  nStatId: number,
  nValue: number,
  nLayer: number,
): void {
  const u = pUnit >>> 0
  if (u === 0) return
  const pList = m.u32((u + 0x5c) >>> 0)
  if (pList === 0) return
  const changed = STATLIST_SetBaseStatEx113c(m, pList, nStatId, nValue, nLayer, 0)
  if (changed !== 0 && m.u32(u) === 0) {
    const dwKey = ((nStatId << 16) + (nLayer & 0xffff)) >>> 0
    recordModStatMem113c(m, m.u32((u + 0x5c) >>> 0), dwKey)
  }
}

function freeStatListMem113c(m: Memory113c, pStatList: number): void {
  const esi = pStatList >>> 0
  unlinkSubListMem113c(m, esi)
  const pStat = m.u32((esi + 0x24) >>> 0)
  if (pStat !== 0) {
    m.u32(esi)
    ;(m as { free?: (p: number) => void }).free?.(pStat)
  }
  if ((m.u32((esi + 0x10) >>> 0) | 0) < 0) {
    let ecx = m.u32((esi + 0x3c) >>> 0)
    while (ecx !== 0) {
      const edx = m.u32((ecx + 0x10) >>> 0) | 0
      let eax = m.u32((ecx + 0x2c) >>> 0)
      m.setU32((ecx + 0x34) >>> 0, 0)
      m.setU32((ecx + 0x04) >>> 0, 0)
      if (edx >= 0) {
        if (m.u32((esi + 0x3c) >>> 0) === ecx) {
          m.setU32((esi + 0x3c) >>> 0, eax)
        }
        freeStatListMem113c(m, ecx)
        eax = m.u32((esi + 0x3c) >>> 0)
      }
      ecx = eax
    }
    const pFullStat = m.u32((esi + 0x48) >>> 0)
    if (pFullStat !== 0) {
      m.u32(esi)
      ;(m as { free?: (p: number) => void }).free?.(pFullStat)
    }
    const pModStat = m.u32((esi + 0x50) >>> 0)
    if (pModStat !== 0) {
      m.u32(esi)
      ;(m as { free?: (p: number) => void }).free?.(pModStat)
    }
    const pStateFlags = m.u32((esi + 0x58) >>> 0)
    m.u32(esi)
    if (pStateFlags !== 0) {
      ;(m as { free?: (p: number) => void }).free?.(pStateFlags)
    }
  }
  m.u32(esi)
  ;(m as { free?: (p: number) => void }).free?.(esi)
}

function getStatsByIdFromListMem113c(
  m: Memory113c,
  pStatList: number,
  pOut: number,
  nStatId: number,
  nMax: number,
): number {
  const s = pStatList >>> 0
  if (s === 0) return 0
  const pHdr = (m.u32((s + 0x10) >>> 0) | 0) < 0 ? (s + 0x48) >>> 0 : (s + 0x24) >>> 0
  let idx = STATLIST_FindStatFirstIndexOrLowerBound113c(m, pHdr, (nStatId << 16) >>> 0) | 0
  if (idx < 0) return 0
  const pArr = m.u32(pHdr)
  let count = (m.u16((pHdr + 4) >>> 0) << 16) >> 16
  let copied = 0
  let cur = (pArr + idx * 8) >>> 0
  let dst = pOut >>> 0
  const maxStats = nMax | 0
  if (idx < count) {
    do {
      const dwKey = m.u32(cur)
      if (((dwKey >> 16) & 0xffff) !== (nStatId >>> 0)) break
      if (copied >= maxStats) break
      m.setU32(dst, dwKey)
      m.setU32((dst + 4) >>> 0, m.u32((cur + 4) >>> 0))
      count = (m.u16((pHdr + 4) >>> 0) << 16) >> 16
      copied = (copied + 1) | 0
      idx = (idx + 1) | 0
      cur = (cur + 8) >>> 0
      dst = (dst + 8) >>> 0
    } while (idx < count)
  }
  return copied >>> 0
}

function sumDirectAndSubListsMem113c(
  m: Memory113c,
  pList: number,
  dwKey: number,
  pIscRec: number,
): number {
  const s = pList >>> 0
  const pBaseHdr = (s + 0x24) >>> 0
  const baseIdx = STATLIST_FindStatIndex113c(m, pBaseHdr, dwKey)
  let sum = 0
  if (baseIdx >= 0) {
    const pBaseEntry = (m.u32(pBaseHdr) + baseIdx * 8) >>> 0
    if (pBaseEntry !== 0) {
      sum = m.u32((pBaseEntry + 4) >>> 0) | 0
    }
  }
  const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
  const isDmgRelated = (m.u8((pIscRec + 4) >>> 0) & m.u32((pBitMasks + 8) >>> 0)) >>> 0
  const listFlags = m.u32((s + 0x10) >>> 0) | 0
  if (listFlags >= 0) return sum | 0
  for (let sub = m.u32((s + 0x3c) >>> 0); sub !== 0; sub = m.u32((sub + 0x2c) >>> 0)) {
    if (isDmgRelated !== 0 && (m.u32((sub + 0x10) >>> 0) & 0x40000000) !== 0) {
      continue
    }
    const subHdr = (m.u32((sub + 0x10) >>> 0) | 0) < 0 ? (sub + 0x48) >>> 0 : (sub + 0x24) >>> 0
    const subIdx = STATLIST_FindStatIndex113c(m, subHdr, dwKey)
    if (subIdx >= 0) {
      const pSubEntry = (m.u32(subHdr) + subIdx * 8) >>> 0
      if (pSubEntry !== 0) {
        sum = (sum + (m.u32((pSubEntry + 4) >>> 0) | 0)) | 0
      }
    }
  }
  return sum | 0
}
function evalStatWithOpsMem113c(m: Memory113c, pList: number, dwKey: number): number {
  const s = pList >>> 0
  const statId = (dwKey >> 16) & 0xffff
  const pIscRec = getIscRecordOrZeroMem113c(m, statId)
  if (pIscRec === 0) return 0
  const rawBaseSum = sumDirectAndSubListsMem113c(m, s, dwKey, pIscRec)
  let total = rawBaseSum | 0
  let baseRef = rawBaseSum | 0
  if (m.u8((pIscRec + 0x52) >>> 0) === 0) {
    return total | 0
  }
  for (let i = 0; i < 16; i++) {
    const entryAddr = (pIscRec + i * 6) >>> 0
    const op = m.u8((entryAddr + 0xe2) >>> 0)
    if (op === 0) break
    switch (op) {
      case 1: {
        const pOwner = m.u32((s + 0x44) >>> 0)
        if (pOwner === 0) break
        if (m.u32(pOwner) === 4) {
          baseRef = STATLIST_GetBaseStatFromListInline113c(m, m.u32((pOwner + 0x5c) >>> 0), statId, 0) | 0
        }
        if (baseRef === 0) break
        const srcStat = m.u16((entryAddr + 0xe0) >>> 0)
        const srcVal = evalStatWithOpsMem113c(m, s, (srcStat << 16) >>> 0)
        if (srcVal !== 0) {
          total = (total + mulDiv113c(srcVal, baseRef, 100)) | 0
        }
        break
      }
      case 2:
      case 3: {
        const ownerType = m.u32((s + 0x08) >>> 0)
        if (ownerType !== 0 && ownerType !== 1) break
        const opBase = m.u16((entryAddr + 0xde) >>> 0)
        if (opBase === 0xffff) break
        const pBaseIsc = getIscRecordOrZeroMem113c(m, opBase)
        if (pBaseIsc === 0) break
        const pHdr = (m.u32((s + 0x10) >>> 0) | 0) < 0 ? (s + 0x48) >>> 0 : (s + 0x24) >>> 0
        const idx = STATLIST_FindStatIndex113c(m, pHdr, (opBase << 16) >>> 0)
        let rawBase = 0
        if (idx >= 0) {
          const pEntry = (m.u32(pHdr) + idx * 8) >>> 0
          if (pEntry !== 0) rawBase = m.u32((pEntry + 4) >>> 0) | 0
        }
        const shifted = sar32(rawBase, m.u8((pBaseIsc + 0x18) >>> 0) & 0x1f)
        if (shifted <= 0) break
        const srcStat = m.u16((entryAddr + 0xe0) >>> 0)
        const srcVal = evalStatWithOpsMem113c(m, s, (srcStat << 16) >>> 0)
        if (srcVal === 0) break
        const scaled = sar32(imul32(srcVal, shifted), m.u8((entryAddr + 0xe3) >>> 0) & 0x1f)
        if (op === 2) {
          total = (total + scaled) | 0
        } else {
          total = (total + mulDiv113c(scaled, baseRef, 100)) | 0
        }
        break
      }
      case 4:
      case 5: {
        const pAttachUnit = m.u32((s + 0x04) >>> 0)
        if (pAttachUnit === 0) break
        const uType = m.u32(pAttachUnit)
        if (uType !== 0 && uType !== 1) break
        const opBase = m.u16((entryAddr + 0xde) >>> 0)
        if (opBase === 0xffff) break
        const pBaseIsc = getIscRecordOrZeroMem113c(m, opBase)
        if (pBaseIsc === 0) break
        const rawBase = STATLIST_GetUnitStatWithLayer113c(m, pAttachUnit, opBase, 0) | 0
        const shifted = sar32(rawBase, m.u8((pBaseIsc + 0x18) >>> 0) & 0x1f)
        if (shifted <= 0) break
        const srcStat = m.u16((entryAddr + 0xe0) >>> 0)
        const srcVal = evalStatWithOpsMem113c(m, s, (srcStat << 16) >>> 0)
        if (srcVal === 0) break
        const scaled = sar32(imul32(srcVal, shifted), m.u8((entryAddr + 0xe3) >>> 0) & 0x1f)
        if (op === 4) {
          total = (total + scaled) | 0
        } else {
          total = (total + mulDiv113c(scaled, baseRef, 100)) | 0
        }
        break
      }
      case 6:
      case 7: {
        const pOwner = m.u32((s + 0x44) >>> 0)
        if (pOwner === 0) break
        const pAct = m.u32((pOwner + 0x1c) >>> 0)
        if (pAct === 0) break
        const srcStat = m.u16((entryAddr + 0xe0) >>> 0)
        const srcVal = evalStatWithOpsMem113c(m, s, (srcStat << 16) >>> 0)
        if (srcVal === 0) break
        const env = ENVIRONMENT_GetTimeOfDayAndAngle113c(m, pAct)
        const byTime = ITEMS_CalcByTimeStat113c(srcVal, env.timeOfDay, env.angle)
        if (op === 6) {
          total = (total + byTime) | 0
        } else {
          total = (total + mulDiv113c(byTime, total, 100)) | 0
        }
        break
      }
      case 8:
      case 9: {
        const pOwner = m.u32((s + 0x44) >>> 0)
        if (pOwner === 0 || m.u32(pOwner) !== 0) break
        const cls = m.u32((pOwner + 4) >>> 0) | 0
        const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
        if (cls < 0 || cls >= (m.u32((dt + DATATABLES_OFF_113C.nCharStatsTxtRecordCount) >>> 0) | 0)) {
          break
        }
        const pChar = (m.u32((dt + DATATABLES_OFF_113C.pCharStatsTxt) >>> 0) + imul32(cls, D2CharStatsTxt_SIZE)) >>> 0
        if (pChar === 0) break
        const srcStat = m.u16((entryAddr + 0xe0) >>> 0)
        const srcKey = (srcStat << 16) >>> 0
        const pBaseHdr = (s + 0x24) >>> 0
        const bIdx = STATLIST_FindStatIndex113c(m, pBaseHdr, srcKey)
        let baseVal = 0
        if (bIdx >= 0) {
          const pEntry = (m.u32(pBaseHdr) + bIdx * 8) >>> 0
          if (pEntry !== 0) baseVal = m.u32((pEntry + 4) >>> 0) | 0
        }
        const fullVal = evalStatWithOpsMem113c(m, s, srcKey)
        const nonBase = (fullVal - baseVal) | 0
        if (nonBase === 0) break
        const factor =
          op === 8
            ? m.u8((pChar + 0x48) >>> 0)
            : statId === 11
              ? m.u8((pChar + 0x47) >>> 0)
              : m.u8((pChar + 0x46) >>> 0)
        total = (total + shl32(imul32(factor, nonBase), 6)) | 0
        break
      }
      case 11: {
        if (baseRef === 0) break
        const pOwner = m.u32((s + 0x44) >>> 0)
        if (pOwner === 0) break
        const uType = m.u32(pOwner)
        if (uType !== 0 && uType !== 1) break
        const srcStat = m.u16((entryAddr + 0xe0) >>> 0)
        const srcVal = evalStatWithOpsMem113c(m, s, (srcStat << 16) >>> 0)
        if (srcVal !== 0) {
          total = (total + mulDiv113c(srcVal, baseRef, 100)) | 0
        }
        break
      }
      case 13: {
        const pOwner = m.u32((s + 0x44) >>> 0)
        if (pOwner === 0 || m.u32(pOwner) !== 4) break
        baseRef = STATLIST_GetBaseStatFromListInline113c(m, m.u32((pOwner + 0x5c) >>> 0), statId, 0) | 0
        if (baseRef === 0) break
        const srcStat = m.u16((entryAddr + 0xe0) >>> 0)
        const srcVal = evalStatWithOpsMem113c(m, s, (srcStat << 16) >>> 0)
        if (srcVal !== 0) {
          total = (total + mulDiv113c(srcVal, baseRef, 100)) | 0
        }
        break
      }
    }
  }
  return total | 0
}

/**
 * `@va D2Common:0x6FD7CC60` (`D2Common.#11097` `STATLIST_GetUnitHirelingResurrectCost`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `u32`).
 */
export function STATLIST_GetUnitHirelingResurrectCost113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  let lvl = 0
  if (u !== 0) {
    const pList = m.u32((u + 0x5c) >>> 0)
    if (pList !== 0) {
      const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) > 0x0c) {
        const pIsc = (m.u32((sgpt + 0xbcc) >>> 0) + 0xf30) >>> 0
        if (pIsc !== 0) {
          lvl = getTotalStatWithMinFromList113c(m, pList, 0x000c0000, pIsc) | 0
        }
      }
    }
  }
  const sq = imul32(lvl, lvl)
  const half = (sq - (sq >> 31)) >> 1
  const cost = imul32(half, 15)
  return ((cost >>> 0) <= 0xc350 ? cost : 0xc350) >>> 0
}

/**
 * `@va D2Common:0x6FD81940` (`D2Common.#10049` `STATLIST_GetUnitGoldBankLimit`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `u32`).
 */
export function STATLIST_GetUnitGoldBankLimit113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pList = m.u32((u + 0x5c) >>> 0)
  if (pList === 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) <= 0x0c) return 0
  const pIsc = (m.u32((sgpt + 0xbcc) >>> 0) + 0xf30) >>> 0
  if (pIsc === 0) return 0
  const lvl = getTotalStatWithMinFromList113c(m, pList, 0x000c0000, pIsc) | 0
  return imul32(lvl, 10000) >>> 0
}

/**
 * `@va D2Common:0x6FD82330` (`D2Common.#11027` `STATLIST_GetUnitLifePercent`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `i32`).
 */
export function STATLIST_GetUnitLifePercent113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  let hpRaw = 0
  if (u !== 0) {
    const pList = m.u32((u + 0x5c) >>> 0)
    if (pList !== 0) {
      const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) > 6) {
        const pIsc6 = (m.u32((sgpt + 0xbcc) >>> 0) + 0x798) >>> 0
        if (pIsc6 !== 0) {
          hpRaw = getTotalStatWithMinFromList113c(m, pList, 0x00060000, pIsc6) | 0
        }
      }
    }
  }
  const hp = hpRaw >> 8
  let maxHpRaw = 0
  if (u !== 0) {
    const pList = m.u32((u + 0x5c) >>> 0)
    if (pList !== 0) {
      const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) > 7) {
        const pIsc7 = (m.u32((sgpt + 0xbcc) >>> 0) + 0x8dc) >>> 0
        if (pIsc7 !== 0) {
          maxHpRaw = getTotalStatWithMinFromList113c(m, pList, 0x00070000, pIsc7) | 0
        }
      }
    }
  }
  const maxHp = maxHpRaw >> 8
  if (maxHp === 0) return 0
  return sdiv32(imul32(hp, 100), maxHp) >>> 0
}
/**
 * `@va D2Common:0x6FD82CA0` (`STATES_SetUnitSourceUnit`,
 * custom LTCG `edi = pUnit`, `[esp+4] = nSrcType`, `[esp+8] = nSrcId`, `ret 8`, void).
 */
export function STATES_SetUnitSourceUnit113c(
  m: Memory113c,
  pUnit: number,
  nSrcType: number,
  nSrcId: number,
): void {
  const edi = pUnit >>> 0
  if (edi === 0) return
  const esi0 = m.u32((edi + 0x5c) >>> 0)
  m.setU32((edi + 0x94) >>> 0, nSrcType >>> 0)
  m.setU32((edi + 0x98) >>> 0, nSrcId >>> 0)
  if (esi0 === 0) {
    m.setU32((edi + 0xc8) >>> 0, (m.u32((edi + 0xc8) >>> 0) | 0x400) >>> 0)
    return
  }
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const nStates = m.u32((sgpt + 0xc4) >>> 0) | 0
  if (nStates > 0x62) {
    if ((m.u32((esi0 + 0x10) >>> 0) | 0) < 0) {
      const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
      const bit2 = m.u32((pBitMasks + 8) >>> 0)
      const pFlags = m.u32((esi0 + 0x58) >>> 0)
      const prev = m.u32((pFlags + 0x0c) >>> 0)
      const wasSet = prev & bit2
      m.setU32((pFlags + 0x0c) >>> 0, (prev | bit2) >>> 0)
      if (wasSet === 0) {
        const sgpt2 = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
        const cnt = ((m.u32((sgpt2 + 0xc4) >>> 0) | 0) + 31) | 0
        const pBitMasks2 = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
        const strideDwords = (cnt + ((cnt >> 31) & 31)) >> 5
        const pFlags2 = m.u32((esi0 + 0x58) >>> 0)
        const pGfxWord = (pFlags2 + strideDwords * 4 + 0x0c) >>> 0
        const prevGfx = m.u32(pGfxWord)
        const bit2Gfx = m.u32((pBitMasks2 + 8) >>> 0)
        m.setU32(pGfxWord, (prevGfx | bit2Gfx) >>> 0)
        const sgpt3 = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
        if ((m.u32((sgpt3 + 0xc4) >>> 0) | 0) > 0x62) {
          const pState98 = (m.u32((sgpt3 + 0xbc) >>> 0) + 0x16f8) >>> 0
          if (pState98 !== 0) {
            const pBitMasks3 = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
            const al = m.u8((pState98 + 0x12) >>> 0)
            if ((m.u8(pBitMasks3) & al) !== 0) {
              m.setU32((edi + 0xc8) >>> 0, (m.u32((edi + 0xc8) >>> 0) | 0x08) >>> 0)
            }
          }
        }
      }
    }
    UNITROOM_RefreshUnit113c(m, edi)
  }
  const pEx = m.u32((edi + 0x5c) >>> 0)
  let sub = 0
  if (pEx !== 0 && (m.u32((pEx + 0x10) >>> 0) | 0) < 0) {
    sub = findSubListByStateAndFlags113c(m, pEx, 0x62)
  }
  if (sub === 0) {
    const dwOwnerId = m.u32((edi + 0x0c) >>> 0)
    const eOwnerType = m.u32(edi)
    const pMemPool = m.u32((edi + 0x08) >>> 0)
    sub = allocStatListMem113c(m, pMemPool, 0, 0, eOwnerType, dwOwnerId)
    if (sub === 0) return
    m.setU32((sub + 0x14) >>> 0, 0x62)
    mergeSubListMem113c(m, edi, sub, 1)
  }
  STATLIST_SetBaseStatEx113c(m, sub, 0x161, nSrcType, 0, 0)
  if (sub !== 0) {
    STATLIST_SetBaseStatEx113c(m, sub, 0x162, nSrcId, 0, 0)
  }
  m.setU32((edi + 0xc8) >>> 0, (m.u32((edi + 0xc8) >>> 0) | 0x400) >>> 0)
}

/**
 * `@va D2Common:0x6FD83D10` (`D2Common.#10866` `STATES_CheckStateMaskByIndexOnUnit`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nMaskIdx`, `ret 8` -> `0 | 1`).
 */
export function STATES_CheckStateMaskByIndexOnUnit113c(
  m: Memory113c,
  pUnit: number,
  nMaskIdx: number,
): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const idx = nMaskIdx | 0
  if (idx < 0 || idx >= 0x28) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const pMask = m.u32((sgpt + idx * 4 + 0xcc) >>> 0)
  return STATES_CheckStateMaskOnUnit113c(m, u, pMask)
}

/**
 * `@va D2Common:0x6FD83D80` (`D2Common.#10372` `STATES_CheckStateMask32OnUnit`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `0 | 1`).
 */
export function STATES_CheckStateMask32OnUnit113c(m: Memory113c, pUnit: number): number {
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const pMask = m.u32((sgpt + 0x14c) >>> 0)
  return STATES_CheckStateMaskOnUnit113c(m, pUnit >>> 0, pMask)
}

/**
 * `@va D2Common:0x6FD83DC0` (`D2Common.#10927` `STATES_CheckStateMask30OnUnit`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `0 | 1`).
 */
export function STATES_CheckStateMask30OnUnit113c(m: Memory113c, pUnit: number): number {
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const pMask = m.u32((sgpt + 0x144) >>> 0)
  return STATES_CheckStateMaskOnUnit113c(m, pUnit >>> 0, pMask)
}

/**
 * `@va D2Common:0x6FD83FE0` (`D2Common.#10198` `STATES_CheckStateMask6OnUnit`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `0 | 1`).
 */
export function STATES_CheckStateMask6OnUnit113c(m: Memory113c, pUnit: number): number {
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const pMask = m.u32((sgpt + 0xe4) >>> 0)
  return STATES_CheckStateMaskOnUnit113c(m, pUnit >>> 0, pMask)
}

/**
 * `@va D2Common:0x6FD84020` (`D2Common.#10341` `STATES_CheckStateMask2OnUnit`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `0 | 1`).
 */
export function STATES_CheckStateMask2OnUnit113c(m: Memory113c, pUnit: number): number {
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const pMask = m.u32((sgpt + 0xd4) >>> 0)
  return STATES_CheckStateMaskOnUnit113c(m, pUnit >>> 0, pMask)
}

/**
 * `@va D2Common:0x6FD84040` (`D2Common.#10761` `STATES_CheckStateMask4OnUnit`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `0 | 1`).
 */
export function STATES_CheckStateMask4OnUnit113c(m: Memory113c, pUnit: number): number {
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const pMask = m.u32((sgpt + 0xdc) >>> 0)
  return STATES_CheckStateMaskOnUnit113c(m, pUnit >>> 0, pMask)
}

/**
 * `@va D2Common:0x6FD888E0` (`D2Common.#10771` `STATLIST_NotifyIfStatModified`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pArg`, `[esp+0xC] = nStatId`, `[esp+0x10] = pfnCb`, `ret 0x10`, void).
 */
export function STATLIST_NotifyIfStatModified113c(
  m: Memory113c,
  pUnit: number,
  pArg: number,
  nStatId: number,
  pfnCb: number,
  cb?: (m: Memory113c, pUnit: number, nStatId: number, nVal: number, pArg: number) => void,
): void {
  const u = pUnit >>> 0
  if (u === 0) return
  const esi = m.u32((u + 0x5c) >>> 0)
  if (esi === 0) return
  if ((m.u32((esi + 0x10) >>> 0) | 0) >= 0) return
  const dwKey = (nStatId << 16) >>> 0
  const ins = STATLIST_FindModStatInsertPos113c(m, (esi + 0x50) >>> 0, dwKey)
  if (ins !== -1) return
  const pBaseHdr = (esi + 0x24) >>> 0
  const idx = STATLIST_FindStatIndex113c(m, pBaseHdr, dwKey)
  if (idx < 0) return
  const pEntry = (m.u32(pBaseHdr) + idx * 8) >>> 0
  if (pEntry === 0) return
  const val = m.u32((pEntry + 4) >>> 0) | 0
  if ((pfnCb >>> 0) !== 0 && cb !== undefined) {
    cb(m, u, nStatId | 0, val, pArg >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD88940` (`STATLIST_SetFullStatEntry`,
 * custom LTCG `ebx = pListEx`, `[esp+4] = dwKey`, `[esp+8] = nVal`, `[esp+0xC] = pIscRec`, `[esp+0x10] = pUnit`, `ret 0x10`, void).
 */
export function STATLIST_SetFullStatEntry113c(
  m: Memory113c,
  pListEx: number,
  dwKey: number,
  nVal: number,
  pIscRec: number,
  pUnit: number,
  onValueCb?: (
    m: Memory113c,
    pGame: number,
    pOwner: number,
    pUnit: number,
    dwKey: number,
    oldVal: number,
    newVal: number,
  ) => void,
): void {
  const ebx = pListEx >>> 0
  const ebp = nVal | 0
  const key = dwKey >>> 0
  const isc = pIscRec >>> 0
  const pFullHdr = (ebx + 0x48) >>> 0
  let idx = STATLIST_FindStatIndex113c(m, pFullHdr, key)
  let pEntry = idx >= 0 ? (m.u32(pFullHdr) + idx * 8) >>> 0 : 0
  if (pEntry === 0) {
    if (ebp === 0) return
    m.u32(ebx)
    const ins = STATLIST_FindInsertPos113c(m, pFullHdr, key)
    pEntry = insertStatSlot(m, pFullHdr, ins, key)
    idx = ins
  }
  const oldVal = m.u32((pEntry + 4) >>> 0) | 0
  if (ebp === 0 && m.u8((isc + 0x50) >>> 0) === 0) {
    m.u32(ebx)
    removeStatSlot(m, pFullHdr, idx)
  } else {
    m.setU32((pEntry + 4) >>> 0, ebp >>> 0)
    if (m.u8((isc + 0x53) >>> 0) !== 0) {
      m.setU32((ebx + 0x10) >>> 0, (m.u32((ebx + 0x10) >>> 0) | 0x20000000) >>> 0)
    }
  }
  if (oldVal !== ebp) {
    const pfOnValue = m.u32((ebx + 0x5c) >>> 0)
    if (pfOnValue !== 0) {
      const dl = m.u8((isc + 5) >>> 0)
      const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
      if ((m.u8((pBitMasks + 0x0c) >>> 0) & dl) !== 0) {
        const pOwner = m.u32((ebx + 0x44) >>> 0)
        const pGame = m.u32((ebx + 0x60) >>> 0)
        onValueCb?.(m, pGame, pOwner, pUnit >>> 0, key, oldVal, ebp)
      }
    }
  }
}

/**
 * `@va D2Common:0x6FD88BD0` (`STATLIST_GetTotalStatWithLayerInline`,
 * custom LTCG `ecx = pStatList`, `eax = nStatId`, `[esp+4] = nLayer`, `ret 4` -> `i32`).
 */
export function STATLIST_GetTotalStatWithLayerInline113c(
  m: Memory113c,
  pStatList: number,
  nStatId: number,
  nLayer: number,
): number {
  const s = pStatList >>> 0
  const statId = nStatId | 0
  if (s === 0 || statId < 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (statId >= (m.u32((sgpt + 0xbd4) >>> 0) | 0)) return 0
  const pIscRec = (m.u32((sgpt + 0xbcc) >>> 0) + imul32(statId, 0x144)) >>> 0
  if (pIscRec === 0) return 0
  const dwKey = ((statId << 16) + (nLayer & 0xffff)) >>> 0
  return getTotalStatWithMinFromList113c(m, s, dwKey, pIscRec)
}

/**
 * `@va D2Common:0x6FD88ED0` (`D2Common.#10823` `STATLIST_GetUnitMinDamage`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = bTwoHanded`, `ret 8` -> `i32`).
 */
export function STATLIST_GetUnitMinDamage113c(
  m: Memory113c,
  pUnit: number,
  bTwoHanded: number,
): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pList = m.u32((u + 0x5c) >>> 0)
  if (pList === 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const statId = (bTwoHanded | 0) !== 0 ? 0x17 : 0x15
  if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) <= statId) return 0
  const pIsc = (m.u32((sgpt + 0xbcc) >>> 0) + imul32(statId, 0x144)) >>> 0
  if (pIsc === 0) return 0
  return getTotalStatWithMinFromList113c(m, pList, (statId << 16) >>> 0, pIsc)
}

/**
 * `@va D2Common:0x6FD88F60` (`D2Common.#10925` `STATLIST_GetUnitMaxDamage`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = bTwoHanded`, `ret 8` -> `i32`).
 */
export function STATLIST_GetUnitMaxDamage113c(
  m: Memory113c,
  pUnit: number,
  bTwoHanded: number,
): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pList = m.u32((u + 0x5c) >>> 0)
  if (pList === 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const statId = (bTwoHanded | 0) !== 0 ? 0x18 : 0x16
  if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) <= statId) return 0
  const pIsc = (m.u32((sgpt + 0xbcc) >>> 0) + imul32(statId, 0x144)) >>> 0
  if (pIsc === 0) return 0
  return getTotalStatWithMinFromList113c(m, pList, (statId << 16) >>> 0, pIsc)
}

/**
 * `@va D2Common:0x6FD8A030` (`D2Common.#10734` `STATLIST_DeactivateWeaponDamageStats`,
 * stdcall `[esp+4] = pOwnerUnit`, `[esp+8] = pItemUnit`, `ret 8` -> `BOOL`).
 */
export function STATLIST_DeactivateWeaponDamageStats113c(
  m: Memory113c,
  pOwnerUnit: number,
  pItemUnit: number,
): number {
  const owner = pOwnerUnit >>> 0
  const item = pItemUnit >>> 0
  if (owner === 0 || item === 0) return 0
  const pItemList = m.u32((item + 0x5c) >>> 0)
  if (pItemList === 0) return 0
  if (m.u32((pItemList + 0x04) >>> 0) !== owner) {
    STATLIST_SetWeaponStatListActive113c(m, owner, item, 0)
    return 0
  }
  const pOwnerEx = m.u32((owner + 0x5c) >>> 0)
  if (pOwnerEx === 0) return 0
  if ((m.u32((pOwnerEx + 0x10) >>> 0) | 0) >= 0) return 0
  const oldFlags = m.u32((pItemList + 0x10) >>> 0)
  if ((oldFlags & 0x40000000) !== 0) return 0
  const newFlags = (oldFlags | 0x40000000) >>> 0
  m.setU32((pItemList + 0x10) >>> 0, newFlags)
  const pHdr = (newFlags | 0) < 0 ? (pItemList + 0x48) >>> 0 : (pItemList + 0x24) >>> 0
  let cur = m.u32(pHdr)
  const count = (m.u16((pHdr + 4) >>> 0) << 16) >> 16
  const pEnd = (cur + imul32(count, 8)) >>> 0
  while ((cur >>> 0) < (pEnd >>> 0)) {
    const dwKey = m.u32(cur)
    const statId = (dwKey >> 16) & 0xffff
    const pIsc = getIscRecordOrZeroMem113c(m, statId)
    if (pIsc !== 0) {
      const cl = m.u8((pIsc + 4) >>> 0)
      const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
      if ((m.u8((pBitMasks + 8) >>> 0) & cl) !== 0) {
        const negVal = -(m.u32((cur + 4) >>> 0) | 0) | 0
        propagateDeltaMem113c(m, pOwnerEx, dwKey, negVal, owner)
      }
    }
    cur = (cur + 8) >>> 0
  }
  return 1
}

/**
 * `@va D2Common:0x6FD8A100` (`D2Common.#10077` `STATLIST_ReactivateWeaponDamageStats`,
 * stdcall `[esp+4] = pOwnerUnit`, `[esp+8] = pItemUnit`, `ret 8` -> `BOOL`).
 */
export function STATLIST_ReactivateWeaponDamageStats113c(
  m: Memory113c,
  pOwnerUnit: number,
  pItemUnit: number,
): number {
  const owner = pOwnerUnit >>> 0
  const item = pItemUnit >>> 0
  if (owner === 0 || item === 0) return 0
  const pItemList = m.u32((item + 0x5c) >>> 0)
  if (pItemList === 0) return 0
  if (m.u32((pItemList + 0x04) >>> 0) !== owner) {
    STATLIST_SetWeaponStatListActive113c(m, owner, item, 1)
    return 0
  }
  const pOwnerEx = m.u32((owner + 0x5c) >>> 0)
  if (pOwnerEx === 0) return 0
  if ((m.u32((pOwnerEx + 0x10) >>> 0) | 0) >= 0) return 0
  const oldFlags = m.u32((pItemList + 0x10) >>> 0)
  if ((oldFlags & 0x40000000) === 0) return 0
  const newFlags = (oldFlags & 0xbfffffff) >>> 0
  m.setU32((pItemList + 0x10) >>> 0, newFlags)
  const pHdr = (newFlags | 0) < 0 ? (pItemList + 0x48) >>> 0 : (pItemList + 0x24) >>> 0
  let cur = m.u32(pHdr)
  const count = (m.u16((pHdr + 4) >>> 0) << 16) >> 16
  const pEnd = (cur + imul32(count, 8)) >>> 0
  while ((cur >>> 0) < (pEnd >>> 0)) {
    const dwKey = m.u32(cur)
    const statId = (dwKey >> 16) & 0xffff
    const pIsc = getIscRecordOrZeroMem113c(m, statId)
    if (pIsc !== 0) {
      const cl = m.u8((pIsc + 4) >>> 0)
      const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
      if ((m.u8((pBitMasks + 8) >>> 0) & cl) !== 0) {
        const val = m.u32((cur + 4) >>> 0) | 0
        propagateDeltaMem113c(m, pOwnerEx, dwKey, val, owner)
      }
    }
    cur = (cur + 8) >>> 0
  }
  return 1
}

/**
 * `@va D2Common:0x6FD8AC90` (`D2Common.#10164` `STATLIST_SetWeaponStatListActive`,
 * stdcall `[esp+4] = pOwnerUnit`, `[esp+8] = pItemUnit`, `[esp+0xC] = bActive`, `ret 0xC`, void).
 */
export function STATLIST_SetWeaponStatListActive113c(
  m: Memory113c,
  pOwnerUnit: number,
  pItemUnit: number,
  bActive: number,
): void {
  const owner = pOwnerUnit >>> 0
  const item = pItemUnit >>> 0
  if (owner === 0 || item === 0) return
  const pItemList = m.u32((item + 0x5c) >>> 0)
  if (pItemList === 0) return
  if (m.u32(item) === 4) {
    const bl = ITEMS_GetBodyLocation113c(m, item) & 0xff
    if (bl === 11 || bl === 12) {
      unlinkSubListMem113c(m, pItemList)
      return
    }
  }
  if (m.u32((pItemList + 0x04) >>> 0) === owner) {
    const flags = m.u32((pItemList + 0x10) >>> 0)
    if ((bActive | 0) !== 0) {
      if ((flags & 0x40000000) !== 0) {
        STATLIST_ReactivateWeaponDamageStats113c(m, owner, item)
      }
      return
    }
    if ((flags & 0x40000000) === 0) {
      STATLIST_DeactivateWeaponDamageStats113c(m, owner, item)
    }
    return
  }
  mergeSubListMem113c(m, owner, pItemList, bActive | 0)
  m.setU32((pItemList + 0x04) >>> 0, owner)
}
// ---------------------------------------------------------------------------
// Iteration 10 Lane A: I10A-2 statlist.ts functions (#27..#39)
// ---------------------------------------------------------------------------

/**
 * `@va D2Common:0x6FD886E0` (`D2Common.#10702` `STATLIST_GetExtendedUnitStatsById`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nStatId`, `[esp+0xC] = pOut`, `[esp+0x10] = nMax`, `ret 0x10` -> `i32`).
 */
export function STATLIST_GetExtendedUnitStatsById113c(
  m: Memory113c,
  pUnit: number,
  nStatId: number,
  pOut: number,
  nMax: number,
): number {
  const pEx = m.u32(((pUnit >>> 0) + 0x5c) >>> 0)
  if (pEx === 0 || (m.u32((pEx + 0x10) >>> 0) | 0) >= 0) return 0
  return getStatsByIdFromListMem113c(m, pEx, pOut >>> 0, nStatId | 0, nMax | 0)
}

const CLASSIC_CONV_TABLE_6FDE4E3C: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [7, 1, 2, 1, 2],
  [31, 10, 12, 10, 12],
  [13, 10, 17, 10, 26],
]

/**
 * `@va D2Common:0x6FD6B1D0` (`D2Common.#11136` `MONSTERS_ApplyClassicConversionStats`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = bExpansion`, `[esp+0xC] = nMode`, `ret 0xC`, void).
 */
export function MONSTERS_ApplyClassicConversionStats113c(
  m: Memory113c,
  pUnit: number,
  bExpansion: number,
  nMode: number,
): void {
  if ((bExpansion | 0) !== 0) return
  const modeByte = nMode & 0xff
  if (modeByte === 0) return
  const u = pUnit >>> 0
  if (u === 0 || m.u32(u) !== 1) return
  const monId = m.u32((u + 4) >>> 0) | 0
  let pMon = 0
  if (monId >= 0) {
    const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    if (monId < (m.u32((sgpt + 0xa80) >>> 0) | 0)) {
      pMon = (m.u32((sgpt + 0xa78) >>> 0) + imul32(monId, 0x1a8)) >>> 0
    }
  }
  if (pMon === 0 || m.u8((pMon + 0x4c) >>> 0) === 1) return
  for (const [statId, m1, d1, mOther, dOther] of CLASSIC_CONV_TABLE_6FDE4E3C) {
    const cur = STATLIST_GetUnitStatWithLayer113c(m, u, statId, 0) | 0
    const mul = modeByte === 1 ? m1 : mOther
    const div = modeByte === 1 ? d1 : dOther
    setUnitStatMem113c(m, u, statId, mulDiv113c(mul, cur, div), 0)
  }
  const wLvl = (m.u16((pMon + 0xaa) >>> 0) << 16) >> 16
  const newLvl = (wLvl + imul32(modeByte, 25)) | 0
  setUnitStatMem113c(m, u, 0x0c, newLvl, 0)
}

/**
 * `@va D2Common:0x6FD82C10` (`D2Common.#10689` `STATES_SetMonsterSkillIconOnUnit`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nSkillId`, `[esp+0xC] = uUnused`, `ret 0xC`, void).
 */
export function STATES_SetMonsterSkillIconOnUnit113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
  _uUnused: number,
): void {
  const skillId = nSkillId | 0
  if (skillId < 0) return
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (skillId >= (m.u32((sgpt + 0xbc0) >>> 0) | 0)) return
  const u = pUnit >>> 0
  const pEx = m.u32((u + 0x5c) >>> 0)
  let sub = 0
  if (pEx !== 0 && (m.u32((pEx + 0x10) >>> 0) | 0) < 0) {
    sub = STATLIST_GetStatListFromFlag113c(m, pEx, 0x80)
  }
  if (sub === 0) {
    const dwOwnerId = m.u32((u + 0x0c) >>> 0)
    const eOwnerType = m.u32(u)
    const pMemPool = m.u32((u + 0x08) >>> 0)
    sub = allocStatListMem113c(m, pMemPool, 0x80, 0, eOwnerType, dwOwnerId)
    mergeSubListMem113c(m, u, sub, 1)
  }
  const pEx2 = m.u32((u + 0x5c) >>> 0)
  if (pEx2 !== 0) {
    m.setU32((pEx2 + 0x10) >>> 0, (m.u32((pEx2 + 0x10) >>> 0) | 0x100) >>> 0)
  }
  STATLIST_SetBaseStatEx113c(m, sub, 0xb2, skillId & 0xffff, 0, 0)
  UNITROOM_RefreshUnit113c(m, u)
}

/**
 * `@va D2Common:0x6FD884B0` (`D2Common.#10872` `STATLIST_GetStatListFromUnitStateOrFlag`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nState`, `[esp+0xC] = dwFlags`, `ret 0xC` -> `pSub | 0`).
 */
export function STATLIST_GetStatListFromUnitStateOrFlag113c(
  m: Memory113c,
  pUnit: number,
  nState: number,
  dwFlags: number,
): number {
  const pEx = m.u32(((pUnit >>> 0) + 0x5c) >>> 0)
  if (pEx === 0 || (m.u32((pEx + 0x10) >>> 0) | 0) >= 0) return 0
  if ((nState | 0) !== 0) {
    return findSubListByStateAndFlags113c(m, pEx, nState)
  }
  return STATLIST_GetStatListFromFlag113c(m, pEx, dwFlags)
}

/**
 * `@va D2Common:0x6FD884F0` (`D2Common.#10195` `STATLIST_GetStatListFromUnitAndFlag`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = dwFlags`, `ret 8` -> `pSub | 0`).
 */
export function STATLIST_GetStatListFromUnitAndFlag113c(
  m: Memory113c,
  pUnit: number,
  dwFlags: number,
): number {
  const pEx = m.u32(((pUnit >>> 0) + 0x5c) >>> 0)
  if (pEx === 0 || (m.u32((pEx + 0x10) >>> 0) | 0) >= 0) return 0
  return STATLIST_GetStatListFromFlag113c(m, pEx, dwFlags)
}

/**
 * `@va D2Common:0x6FD89B60` (`D2Common.#10381` `STATLIST_UpdateUnitByTimeStats`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pItem`, `ret 8`, void).
 */
export function STATLIST_UpdateUnitByTimeStats113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
): void {
  const u = pUnit >>> 0
  if (u === 0) return
  const item = pItem >>> 0
  if (item === 0) return
  const uType = m.u32(u)
  if (uType !== 0 && uType !== 1) return
  const pItemEx = m.u32((item + 0x5c) >>> 0)
  if (pItemEx === 0) return
  if ((m.u32((pItemEx + 0x10) >>> 0) | 0) >= 0) return
  let cur = m.u32((pItemEx + 0x48) >>> 0)
  const count = (m.u16((pItemEx + 0x4c) >>> 0) << 16) >> 16
  const end = (cur + imul32(count, 8)) >>> 0
  if ((cur >>> 0) >= (end >>> 0)) return
  let sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  while ((cur >>> 0) < (end >>> 0)) {
    const statId = m.u16((cur + 2) >>> 0)
    let pIsc = 0
    if ((statId | 0) >= 0 && (statId | 0) < (m.u32((sgpt + 0xbd4) >>> 0) | 0)) {
      pIsc = (m.u32((sgpt + 0xbcc) >>> 0) + imul32(statId, 0x144)) >>> 0
    }
    const op = m.u8((pIsc + 0x54) >>> 0)
    if (op >= 6 && op <= 7) {
      let pOpStatWord = (pIsc + 0x58) >>> 0
      for (let j = 0; j < 3; j++) {
        const targetId = m.u16(pOpStatWord)
        if (targetId === 0xffff) break
        let pTargetIsc = 0
        if ((targetId | 0) >= 0 && (targetId | 0) < (m.u32((sgpt + 0xbd4) >>> 0) | 0)) {
          pTargetIsc = (m.u32((sgpt + 0xbcc) >>> 0) + imul32(targetId, 0x144)) >>> 0
        }
        const pUnitList1 = m.u32((u + 0x5c) >>> 0)
        const dwTargetKey = (targetId << 16) >>> 0
        const val = evalStatWithOpsMem113c(m, pUnitList1, dwTargetKey)
        const pUnitList2 = m.u32((u + 0x5c) >>> 0)
        STATLIST_SetFullStatEntry113c(m, pUnitList2, dwTargetKey, val, pTargetIsc, u)
        pOpStatWord = (pOpStatWord + 2) >>> 0
        sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      }
    }
    cur = (cur + 8) >>> 0
  }
}

/**
 * `@va D2Common:0x6FD89CC0` (`D2Common.#10379` `STATLIST_GetUnitStatBonus`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nStatId`, `[esp+0xC] = nLayer`, `ret 0xC` -> `i32`).
 */
export function STATLIST_GetUnitStatBonus113c(
  m: Memory113c,
  pUnit: number,
  nStatId: number,
  nLayer: number,
): number {
  const pList = m.u32(((pUnit >>> 0) + 0x5c) >>> 0)
  return STATLIST_GetStatBonusFromListInline113c(m, pList, nStatId, nLayer)
}

/**
 * `@va D2Common:0x6FD8A790` (`D2Common.#11037` `STATLIST_SetBaseStatExIfValid`,
 * stdcall `[esp+4] = pStatList`, `[esp+8] = nStatId`, `[esp+0xC] = nVal`, `[esp+0x10] = nLayer`, `[esp+0x14] = pUnit`, `ret 0x14` -> `BOOL`).
 */
export function STATLIST_SetBaseStatExIfValid113c(
  m: Memory113c,
  pStatList: number,
  nStatId: number,
  nVal: number,
  nLayer: number,
  pUnit: number,
): number {
  const s = pStatList >>> 0
  if (s === 0) return 0
  return STATLIST_SetBaseStatEx113c(m, s, nStatId, nVal, nLayer, pUnit)
}

/**
 * `@va D2Common:0x6FD8AB30` (`D2Common.#10815` `STATLIST_ClampUnitPoolStatsToMax`,
 * stdcall `[esp+4] = pUnit`, `ret 4`, void).
 */
export function STATLIST_ClampUnitPoolStatsToMax113c(m: Memory113c, pUnit: number): void {
  const u = pUnit >>> 0
  if (u === 0) return
  let pList = m.u32((u + 0x5c) >>> 0)
  if (pList === 0) return
  let sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)

  let curStam = 0
  if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) > 0x0a) {
    const pIsc10 = (m.u32((sgpt + 0xbcc) >>> 0) + 0xca8) >>> 0
    if (pIsc10 !== 0) {
      curStam = getTotalStatWithMinFromList113c(m, pList, 0x000a0000, pIsc10) | 0
      sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    }
  }
  const maxStam = STATLIST_GetMaxStaminaFromUnit113c(m, u) | 0
  if (curStam > maxStam) {
    const diff = (maxStam - curStam) | 0
    if (diff !== 0) {
      addStatMem113c(m, pList, 0x0a, diff, 0)
      sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    }
  }

  pList = m.u32((u + 0x5c) >>> 0)
  let curMana = 0
  if (pList !== 0 && (m.u32((sgpt + 0xbd4) >>> 0) | 0) > 0x08) {
    const pIsc8 = (m.u32((sgpt + 0xbcc) >>> 0) + 0xa20) >>> 0
    if (pIsc8 !== 0) {
      curMana = getTotalStatWithMinFromList113c(m, pList, 0x00080000, pIsc8) | 0
      sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    }
  }
  const maxMana = STATLIST_GetMaxManaFromUnit113c(m, u) | 0
  if (curMana > maxMana) {
    const diff = (maxMana - curMana) | 0
    if (diff !== 0) {
      addStatMem113c(m, pList, 0x08, diff, 0)
      sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    }
  }

  pList = m.u32((u + 0x5c) >>> 0)
  let curHp = 0
  if (pList !== 0 && (m.u32((sgpt + 0xbd4) >>> 0) | 0) > 0x06) {
    const pIsc6 = (m.u32((sgpt + 0xbcc) >>> 0) + 0x798) >>> 0
    if (pIsc6 !== 0) {
      curHp = getTotalStatWithMinFromList113c(m, pList, 0x00060000, pIsc6) | 0
    }
  }
  const maxHp = STATLIST_GetMaxLifeFromUnit113c(m, u) | 0
  if (curHp > maxHp) {
    const diff = (maxHp - curHp) | 0
    if (diff !== 0) {
      addStatMem113c(m, pList, 0x06, diff, 0)
    }
  }
}

/**
 * `@va D2Common:0x6FD8AC50` (`D2Common.#11040` `STATLIST_ClearMonsterSkillIconStatList`,
 * stdcall `[esp+4] = pUnit`, `ret 4`, void).
 */
export function STATLIST_ClearMonsterSkillIconStatList113c(m: Memory113c, pUnit: number): void {
  const u = pUnit >>> 0
  if (u === 0) return
  const pEx = m.u32((u + 0x5c) >>> 0)
  if (pEx === 0) return
  m.setU32((pEx + 0x10) >>> 0, (m.u32((pEx + 0x10) >>> 0) & 0xfffffeff) >>> 0)
  const pEx2 = m.u32((u + 0x5c) >>> 0)
  if (pEx2 === 0 || (m.u32((pEx2 + 0x10) >>> 0) | 0) >= 0) return
  const sub = STATLIST_GetStatListFromFlag113c(m, pEx2, 0x80)
  if (sub === 0) return
  STATLIST_ClearBaseStats113c(m, sub)
}

/**
 * `@va D2Common:0x6FD8AD40` (`D2Common.#11108` `STATLIST_FreeStatListIfNonExtended`,
 * stdcall `[esp+4] = pStatList`, `ret 4`, void).
 */
export function STATLIST_FreeStatListIfNonExtended113c(m: Memory113c, pStatList: number): void {
  const s = pStatList >>> 0
  if (s === 0) return
  if ((m.u32((s + 0x10) >>> 0) | 0) < 0) return
  freeStatListMem113c(m, s)
}

/**
 * `@va D2Common:0x6FD8AD60` (`D2Common.#11004` `STATLIST_ExpireOrphanStateSubLists`,
 * stdcall `[esp+4] = pUnit`, `ret 4`, void).
 */
export function STATLIST_ExpireOrphanStateSubLists113c(m: Memory113c, pUnit: number): void {
  const u = pUnit >>> 0
  if (u === 0) return
  const pEx = m.u32((u + 0x5c) >>> 0)
  if (pEx === 0 || (m.u32((pEx + 0x10) >>> 0) | 0) >= 0) return
  let sub = m.u32((pEx + 0x3c) >>> 0)
  while (sub !== 0) {
    let next = m.u32((sub + 0x2c) >>> 0)
    if (m.u32((sub + 0x08) >>> 0) !== 4) {
      const flags = m.u32((sub + 0x10) >>> 0)
      if ((flags & 0x181) === 0) {
        const stateNo = m.u32((sub + 0x14) >>> 0)
        if (STATES_CheckStateMaskExpOnUnit113c(m, u, stateNo) === 0) {
          if ((flags | 0) >= 0) {
            freeStatListMem113c(m, sub)
          }
          next = m.u32((pEx + 0x3c) >>> 0)
        }
      }
    }
    sub = next
  }
}

/**
 * `@va D2Common:0x6FD8ADD0` (`D2Common.#11093` `STATLIST_ExpireTimedSubLists`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nFrame`, `ret 8`, void).
 */
export function STATLIST_ExpireTimedSubLists113c(
  m: Memory113c,
  pUnit: number,
  nFrame: number,
): void {
  const u = pUnit >>> 0
  if (u === 0) return
  const pEx = m.u32((u + 0x5c) >>> 0)
  if (pEx === 0 || (m.u32((pEx + 0x10) >>> 0) | 0) >= 0) return
  let sub = m.u32((pEx + 0x3c) >>> 0)
  const frame = nFrame | 0
  if (frame !== 0) {
    while (sub !== 0) {
      const flags = m.u32((sub + 0x10) >>> 0)
      let next = m.u32((sub + 0x2c) >>> 0)
      if ((flags & 0x02) !== 0 && (m.u32((sub + 0x18) >>> 0) | 0) <= frame) {
        if ((flags | 0) >= 0) {
          freeStatListMem113c(m, sub)
        }
        next = m.u32((pEx + 0x3c) >>> 0)
      }
      sub = next
    }
  } else {
    while (sub !== 0) {
      const flags = m.u32((sub + 0x10) >>> 0)
      let next = m.u32((sub + 0x2c) >>> 0)
      if ((flags & 0x02) !== 0) {
        const rem = ((m.u32((sub + 0x18) >>> 0) | 0) - 1) | 0
        m.setU32((sub + 0x18) >>> 0, rem >>> 0)
        if (rem <= 0) {
          if ((flags | 0) >= 0) {
            freeStatListMem113c(m, sub)
          }
          next = m.u32((pEx + 0x3c) >>> 0)
        }
      }
      sub = next
    }
  }
}

/**
 * `@va D2Common:0x6FD975E0` (internal LTCG `ITEMS_AddOrSetStatOnStatList`,
 * custom reg `eax = bApply`, stack `[esp+4] = pItem`, `[esp+8] = pUnit`, `[esp+0xC] = bSetStat`,
 * `[esp+0x10] = wStatId`, `[esp+0x14] = nLayer`, `[esp+0x18] = nValue`,
 * `[esp+0x1C] = nStateId`, `[esp+0x20] = fStatListFlags`, `ret 0x20` -> `int32`).
 */
export function ITEMS_AddOrSetStatOnStatList113c(
  m: Memory113c,
  bApply: number,
  pItem: number,
  pUnit: number,
  bSetStat: number,
  wStatId: number,
  nLayer: number,
  nValue: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  const bp = (wStatId << 16) >> 16
  if ((bApply >>> 0) === 0 || (nValue | 0) === 0) {
    return 0
  }
  const edi = bp
  if (edi < 0) {
    return 0
  }
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (edi >= (m.u32((sgpt + 0xbd4) >>> 0) | 0)) {
    return 0
  }
  const pIsc = (m.u32((sgpt + 0xbcc) >>> 0) + imul32(edi, 0x144)) >>> 0
  if (pIsc === 0) {
    return 0
  }
  const ebx = ITEMMODS_GetOrCreateStatList113c(m, pItem, pUnit, nStateId, fStatListFlags)
  if (ebx === 0) {
    return 0
  }
  const cl = m.u8((pIsc + 0x18) >>> 0) & 0x1f
  const shifted = ((nValue | 0) << cl) | 0
  if (bSetStat !== 0) {
    STATLIST_SetStat113c(m, ebx, edi, shifted, nLayer)
    if (bp === 0x3a) {
      if (STATLIST_GetStatValue113c(m, ebx, 0x146, 0) === 0) {
        const pBaseHdr = (ebx + 0x24) >>> 0
        const idx = STATLIST_FindStatIndex113c(m, pBaseHdr, 0x01460000)
        let pEntry = idx >= 0 ? (m.u32(pBaseHdr) + idx * 8) >>> 0 : 0
        if (pEntry === 0) {
          m.u32(ebx)
          const ins = STATLIST_FindInsertPos113c(m, pBaseHdr, 0x01460000)
          pEntry = insertStatSlot(m, pBaseHdr, ins, 0x01460000)
        }
        const oldVal = m.u32((pEntry + 4) >>> 0) | 0
        const delta = (1 - oldVal) | 0
        if (delta !== 0) {
          m.setU32((pEntry + 4) >>> 0, 1)
          propagateDeltaMem113c(m, ebx, 0x01460000, delta, 0)
          if ((m.u32((ebx + 0x10) >>> 0) | 0) < 0 && m.u32((ebx + 0x08) >>> 0) === 0) {
            recordModStatMem113c(m, ebx, 0x01460000)
          }
        }
      }
    }
  } else {
    addStatMem113c(m, ebx, edi, shifted, nLayer)
    if (bp === 0x3a) {
      addStatMem113c(m, ebx, 0x146, 1, 0)
    }
  }
  return nValue >>> 0
}

/**
 * `@va D2Common:0x6FD97EF0` (internal LTCG `ITEMS_ApplySkillBonusStat`,
 * custom reg `eax = bRoll`, `ecx = pUnit`, `edi = nStatId`, stack `[esp+4] = bForceRoll`,
 * `[esp+8] = pItem`, `[esp+0xC] = nValue`, `[esp+0x10] = bNegateCur`,
 * `[esp+0x14] = nStateId`, `[esp+0x18] = fStatListFlags`, `ret 0x18` -> `0 | 1`).
 */
export function ITEMS_ApplySkillBonusStat113c(
  m: Memory113c,
  bRoll: number,
  pUnit: number,
  nStatId: number,
  bForceRoll: number,
  pItem: number,
  nValue: number,
  bNegateCur: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  const esi = pUnit >>> 0
  if (bRoll !== 0 || (bForceRoll | 0) === 1) {
    ITEMS_ResetBaseDamageOrACStatFromTxt113c(m, esi, nStatId)
  }
  let val = nValue | 0
  if (val === 0) {
    return 0
  }
  const u = ((nStatId - 6) | 0) >>> 0
  if (u <= 0xd3 && FIXED_POINT_STAT_SWITCH_6FD95668[u] === 0) {
    val = (val << 8) | 0
  }
  const pStatList = ITEMMODS_GetOrCreateStatList113c(m, pItem, esi, nStateId, fStatListFlags)
  if (pStatList === 0) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x2c5)
  }
  if (bNegateCur !== 0) {
    const negCur = (-STATLIST_GetStatValue113c(m, pStatList, nStatId, 0)) | 0
    addStatMem113c(m, pStatList, nStatId, negCur, 0)
    return 1
  }
  addStatMem113c(m, pStatList, nStatId, val, 0)
  return 1
}

/**
 * `@va D2Common:0x6FD97FA0` (internal LTCG `ITEMS_ApplyElemMasteryOrPierceStat`,
 * custom reg `eax = bIsMinToMax`, `ecx = pPropEntry`, `edx = pUnit`, `edi = nStatId`,
 * stack `[esp+4] = bForceRoll`, `[esp+8] = pItem`, `[esp+0xC] = bNegateCur`,
 * `[esp+0x10] = nStateId`, `[esp+0x14] = fStatListFlags`, `ret 0x14` -> `0 | 1`).
 */
export function ITEMS_ApplyElemMasteryOrPierceStat113c(
  m: Memory113c,
  bIsMinToMax: number,
  pPropEntry: number,
  pUnit: number,
  nStatId: number,
  bForceRoll: number,
  pItem: number,
  bNegateCur: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  const esi = pUnit >>> 0
  const prop = pPropEntry >>> 0
  const maxVal = m.u32((prop + 0x0c) >>> 0)
  const minVal = m.u32((prop + 0x08) >>> 0)
  let ebx: number
  if (bIsMinToMax !== 0) {
    ebx = DRLGROOM_RollItemCoordinate113c(m, maxVal, minVal, esi) | 0
    ITEMS_ResetBaseDamageOrACStatFromTxt113c(m, esi, nStatId)
  } else {
    ebx = DRLGROOM_RollItemCoordinateAlt113c(m, maxVal, minVal, esi) | 0
    if ((bForceRoll | 0) === 1) {
      ITEMS_ResetBaseDamageOrACStatFromTxt113c(m, esi, nStatId)
    }
  }
  if (ebx === 0) {
    return 0
  }
  const u = ((nStatId - 6) | 0) >>> 0
  if (u <= 0xd3 && FIXED_POINT_STAT_SWITCH_6FD95668[u] === 0) {
    ebx = (ebx << 8) | 0
  }
  const pStatList = ITEMMODS_GetOrCreateStatList113c(m, pItem, esi, nStateId, fStatListFlags)
  if (pStatList === 0) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x29d)
  }
  const addVal =
    bNegateCur !== 0 ? (-STATLIST_GetStatValue113c(m, pStatList, nStatId, 0)) | 0 : ebx
  addStatMem113c(m, pStatList, nStatId, addVal, 0)
  if ((nStatId | 0) === 0x3a) {
    addStatMem113c(m, pStatList, 0x146, 1, 0)
  }
  return 1
}

/**
 * `@va D2Common:0x6FD7CCC0` (`D2Common.#10458` `HIRELING_RollAndPopulateStatsEntry`,
 * fastcall `ecx = bExpansion`, `edx = pUnit`, stack `[esp+4] = dwSeed`,
 * `[esp+8] = nAct`, `[esp+0xC] = nDifficulty`, `[esp+0x10] = pOutStats`, `ret 0x10` -> `0 | 1`).
 */
export function HIRELING_RollAndPopulateStatsEntry113c(
  m: Memory113c,
  bExpansion: number,
  pUnit: number,
  dwSeed: number,
  nAct: number,
  nDifficulty: number,
  pOutStats: number,
): number {
  const recs: number[] = []
  let pRec = DATATBLS_GetHirelingTxtRecordFromActAndDifficulty113c(
    m,
    bExpansion,
    nAct,
    nDifficulty,
    0,
  )
  while (pRec !== 0) {
    recs.push(pRec >>> 0)
    pRec = DATATBLS_GetHirelingTxtRecordFromActAndDifficulty113c(
      m,
      bExpansion,
      nAct,
      nDifficulty,
      pRec,
    )
  }
  if (recs.length === 0) {
    return 0
  }

  const prod0 = BigInt(dwSeed >>> 0) * 0x6ac690c5n + 0x29an
  const lo0 = Number(prod0 & 0xffffffffn) >>> 0
  const hi0 = Number((prod0 >> 32n) & 0xffffffffn) >>> 0
  const idx = (lo0 >>> 0) % (recs.length >>> 0)
  const pChosen = recs[idx]!

  const out = pOutStats >>> 0
  m.setU32(out, m.u32((pChosen + 0x04) >>> 0))

  let unitLvl = 0
  const u = pUnit >>> 0
  if (u !== 0) {
    const pStatList = m.u32((u + 0x5c) >>> 0)
    if (pStatList !== 0) {
      const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) > 0x0c) {
        const pIsc12 = (m.u32((sgpt + 0xbcc) >>> 0) + 0xf30) >>> 0
        if (pIsc12 !== 0) {
          unitLvl = getTotalStatWithMinFromList113c(m, pStatList, 0x000c0000, pIsc12) | 0
        }
      }
    }
  }

  const prod1 = BigInt(lo0) * 0x6ac690c5n + BigInt(hi0)
  const lo1 = Number(prod1 & 0xffffffffn) >>> 0
  let lvl = (((lo1 >>> 0) % 5) + unitLvl - 5) | 0
  if (lvl < 2) {
    lvl = 2
  }
  const baseLvl = m.u32((pChosen + 0x1c) >>> 0) | 0
  const ecx = (lvl - baseLvl) | 0
  const edi = (baseLvl + ecx) | 0
  m.setU32((out + 0x04) >>> 0, edi >>> 0)

  const hp = Math.max(
    0x28,
    ((m.u32((pChosen + 0x24) >>> 0) | 0) + imul32(m.u32((pChosen + 0x28) >>> 0) | 0, ecx)) | 0,
  )
  m.setU32((out + 0x08) >>> 0, hp >>> 0)

  const str = Math.max(
    0x0a,
    ((m.u32((pChosen + 0x34) >>> 0) | 0) + (imul32(m.u32((pChosen + 0x38) >>> 0) | 0, ecx) >> 3)) |
      0,
  )
  m.setU32((out + 0x0c) >>> 0, str >>> 0)

  const dex = Math.max(
    0x0a,
    ((m.u32((pChosen + 0x3c) >>> 0) | 0) + (imul32(m.u32((pChosen + 0x40) >>> 0) | 0, ecx) >> 3)) |
      0,
  )
  m.setU32((out + 0x10) >>> 0, dex >>> 0)

  const baseCost = m.u32((pChosen + 0x18) >>> 0) | 0
  const scaledCost = sdiv32(imul32((imul32(ecx, 0x0f) + 0x64) | 0, baseCost), 100)
  m.setU32((out + 0x14) >>> 0, Math.max(baseCost, scaledCost) >>> 0)

  const expMult = m.u32((pChosen + 0x20) >>> 0) | 0
  const exp = imul32(imul32(imul32((edi + 1) | 0, expMult), edi), edi)
  m.setU32((out + 0x18) >>> 0, Math.max(0, exp) >>> 0)

  const def =
    ((m.u32((pChosen + 0x2c) >>> 0) | 0) + imul32(m.u32((pChosen + 0x30) >>> 0) | 0, ecx)) | 0
  m.setU32((out + 0x1c) >>> 0, Math.max(0, def) >>> 0)

  const dmgBonus = imul32(m.u32((pChosen + 0x58) >>> 0) | 0, ecx) >> 3
  const minDmg = ((m.u32((pChosen + 0x50) >>> 0) | 0) + dmgBonus) | 0
  m.setU32((out + 0x20) >>> 0, Math.max(0, minDmg) >>> 0)

  const maxDmg = ((m.u32((pChosen + 0x54) >>> 0) | 0) + dmgBonus) | 0
  m.setU32((out + 0x24) >>> 0, Math.max(1, maxDmg) >>> 0)

  const ar = m.u32((pChosen + 0x4c) >>> 0) | 0
  m.setU32((out + 0x28) >>> 0, Math.max(0, ar) >>> 0)

  const res = m.u32((pChosen + 0x5c) >>> 0) | 0
  m.setU32((out + 0x2c) >>> 0, Math.max(0, res) >>> 0)

  m.setU32((out + 0x30) >>> 0, m.u8((pChosen + 0xd2) >>> 0) >>> 0)
  m.setU32((out + 0x34) >>> 0, 1)
  m.setU16((out + 0x38) >>> 0, 0)
  return 1
}

/**
 * `@va D2Common:0x6FD97120` (`D2Common.#10803` `ITEMS_AddChargedSkillStatToItemOrSocket`,
 * stdcall `[esp+4] = pItem`, `[esp+8] = nSkillId`, `[esp+0xC] = nLevel`, `[esp+0x10] = nChargesToSet`,
 * `ret 0x10` -> `0 | 1`).
 */
export function ITEMS_AddChargedSkillStatToItemOrSocket113c(
  m: Memory113c,
  pItem: number,
  nSkillId: number,
  nLevel: number,
  nChargesToSet: number,
): number {
  const ebx = pItem >>> 0
  if (ebx === 0 || m.u32(ebx) !== 4) {
    return 0
  }
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const shift = m.u32((sgpt + 0xc6c) >>> 0) & 0x1f
  const mask = m.u32((sgpt + 0xc70) >>> 0)
  const ebp = ((nSkillId << shift) + (nLevel & mask)) >>> 0

  const pEx = m.u32((ebx + 0x5c) >>> 0)
  if (pEx !== 0 && (m.u32((pEx + 0x10) >>> 0) | 0) < 0) {
    let esi = STATLIST_GetStatListFromFlag113c(m, pEx, 0x40)
    while (esi !== 0) {
      let raw = 0
      const curSgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      if ((m.u32((curSgpt + 0xbd4) >>> 0) | 0) > 0xcc) {
        const pIsc = (m.u32((curSgpt + 0xbcc) >>> 0) + 0x10230) >>> 0
        if (pIsc !== 0) {
          raw = getBaseStatWithMinFromList113c(m, esi, (0x00cc0000 + (ebp & 0xffff)) >>> 0, pIsc) | 0
        }
      }
      if (raw !== 0) {
        const maxChg = raw >> 8
        if (maxChg <= 0 || maxChg > 0xff) {
          return 0
        }
        let newChg = nChargesToSet | 0
        if (newChg <= 0) {
          newChg = 0
        }
        if (newChg >= maxChg) {
          newChg = maxChg
        }
        const packedVal = ((maxChg << 8) + (newChg & 0xff)) >>> 0
        STATLIST_SetBaseStatEx113c(m, esi, 0xcc, packedVal, ebp, ebx)
        return 1
      }
      let next = m.u32((esi + 0x2c) >>> 0)
      while (next !== 0 && (m.u8((next + 0x10) >>> 0) & 0x40) === 0) {
        next = m.u32((next + 0x2c) >>> 0)
      }
      esi = next
    }
  }

  const pInv = m.u32((ebx + 0x60) >>> 0)
  if (pInv !== 0 && m.u32(pInv) === 0x01020304) {
    let cur = m.u32((pInv + 0x0c) >>> 0)
    while (cur !== 0) {
      const subArg = m.u32(cur) === 4 ? cur : 0
      if (ITEMS_AddChargedSkillStatToItemOrSocket113c(m, subArg, nSkillId, nLevel, nChargesToSet) !== 0) {
        return 1
      }
      if (m.u32(cur) !== 4) {
        break
      }
      const pData = m.u32((cur + 0x14) >>> 0)
      if (pData === 0) {
        break
      }
      const pExtra = (pData + 0x5c) >>> 0
      if (pExtra === 0) {
        break
      }
      cur = m.u32((pExtra + 0x08) >>> 0)
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD98B80` (internal LTCG `ITEMS_RollAndApplySkillBonusStat`,
 * fastcall `ecx = bForceRoll`, `edx = pItem`, stack `[esp+4] = pUnit`,
 * `[esp+8] = pPropEntry`, `[esp+0xC] = nStatId`, `[esp+0x10] = bNegateCur`,
 * `[esp+0x14] = nStateId`, `[esp+0x18] = fStatListFlags`, `[esp+0x1C] = _unused`,
 * `ret 0x1C` -> `0 | 1`).
 */
export function ITEMS_RollAndApplySkillBonusStat113c(
  m: Memory113c,
  bForceRoll: number,
  pItem: number,
  pUnit: number,
  pPropEntry: number,
  nStatId: number,
  bNegateCur: number,
  nStateId: number,
  fStatListFlags: number,
  _unused = 0,
): number {
  const prop = pPropEntry >>> 0
  const rolled = DRLGROOM_RollItemCoordinateAlt113c(
    m,
    m.u32((prop + 0x0c) >>> 0),
    m.u32((prop + 0x08) >>> 0),
    pUnit,
  )
  return ITEMS_ApplySkillBonusStat113c(
    m,
    0,
    pUnit,
    nStatId,
    bForceRoll,
    pItem,
    rolled,
    bNegateCur,
    nStateId,
    fStatListFlags,
  )
}

/**
 * `@va D2Common:0x6FD99140` (internal LTCG `ITEMS_ApplyElemMasteryOrPierceMinToMax`,
 * fastcall `ecx = bForceRoll`, `edx = pItem`, stack `[esp+4] = pUnit`,
 * `[esp+8] = pPropEntry`, `[esp+0xC] = nStatId`, `[esp+0x10] = bNegateCur`,
 * `[esp+0x14] = nStateId`, `[esp+0x18] = fStatListFlags`, `[esp+0x1C] = _unused`,
 * `ret 0x1C` -> `0 | 1`).
 */
export function ITEMS_ApplyElemMasteryOrPierceMinToMax113c(
  m: Memory113c,
  bForceRoll: number,
  pItem: number,
  pUnit: number,
  pPropEntry: number,
  nStatId: number,
  bNegateCur: number,
  nStateId: number,
  fStatListFlags: number,
  _unused = 0,
): number {
  return ITEMS_ApplyElemMasteryOrPierceStat113c(
    m,
    1,
    pPropEntry,
    pUnit,
    nStatId,
    bForceRoll,
    pItem,
    bNegateCur,
    nStateId,
    fStatListFlags,
  )
}

/**
 * `@va D2Common:0x6FD99190` (internal LTCG `ITEMS_ApplyElemMasteryOrPierceMaxOnly`,
 * fastcall `ecx = bForceRoll`, `edx = pItem`, stack `[esp+4] = pUnit`,
 * `[esp+8] = pPropEntry`, `[esp+0xC] = nStatId`, `[esp+0x10] = bNegateCur`,
 * `[esp+0x14] = nStateId`, `[esp+0x18] = fStatListFlags`, `[esp+0x1C] = _unused`,
 * `ret 0x1C` -> `0 | 1`).
 */
export function ITEMS_ApplyElemMasteryOrPierceMaxOnly113c(
  m: Memory113c,
  bForceRoll: number,
  pItem: number,
  pUnit: number,
  pPropEntry: number,
  nStatId: number,
  bNegateCur: number,
  nStateId: number,
  fStatListFlags: number,
  _unused = 0,
): number {
  return ITEMS_ApplyElemMasteryOrPierceStat113c(
    m,
    0,
    pPropEntry,
    pUnit,
    nStatId,
    bForceRoll,
    pItem,
    bNegateCur,
    nStateId,
    fStatListFlags,
  )
}

/**
 * `@va D2Common:0x6FD972E0` (`ITEMMODS_ApplyPropertyIndestructible`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertyIndestructible113c(
  m: Memory113c,
  _bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  _bSetStat: number,
  _wStatId: number,
  _nParam: number,
  _nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused = 0,
): number {
  const u = pUnit >>> 0
  if (u === 0 || m.u32(u) !== 4) return 0
  if ((pProp >>> 0) === 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) <= 0x98) return 0
  if (((m.u32((sgpt + 0xbcc) >>> 0) + 0xc060) >>> 0) === 0) return 0
  const pStatList = ITEMMODS_GetOrCreateStatList113c(m, u, pItem, nStateId, fStatListFlags)
  if (pStatList === 0) return 0
  addStatMem113c(m, pStatList, 0x98, 1, 0)
  return 1
}

/**
 * `@va D2Common:0x6FD97350` (`ITEMMODS_ApplyPropertyPackedDuration`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertyPackedDuration113c(
  m: Memory113c,
  _bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  _bSetStat: number,
  wStatId: number,
  _nParam: number,
  _nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused = 0,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  const statId = (wStatId << 16) >> 16
  if (statId < 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (statId >= (m.u32((sgpt + 0xbd4) >>> 0) | 0)) return 0
  const pIsc = (m.u32((sgpt + 0xbcc) >>> 0) + imul32(statId, 0x144)) >>> 0
  if (pIsc === 0) return 0

  let param = m.u32((prop + 0x04) >>> 0) | 0
  if (param <= 0) param = 0
  else if (param >= 3) param = 3

  let minVal = ((m.u32((prop + 0x08) >>> 0) | 0) + 0x100) | 0
  if (minVal <= 0) minVal = 0
  else if (minVal >= 0x3ff) minVal = 0x3ff

  let maxVal = ((m.u32((prop + 0x0c) >>> 0) | 0) + 0x100) | 0
  if (maxVal <= 0) maxVal = 0
  else if (maxVal >= 0x3ff) maxVal = 0x3ff

  const pStatList = ITEMMODS_GetOrCreateStatList113c(m, pUnit, pItem, nStateId, fStatListFlags)
  if (pStatList === 0) return 0

  const packed = ((((maxVal << 10) + minVal) * 4) + param) | 0
  STATLIST_SetBaseStatEx113c(m, pStatList, statId, packed, 0, 0)
  return maxVal >>> 0
}

/**
 * `@va D2Common:0x6FD98070` (`ITEMMODS_ApplyPropertyCondResetRollDurability`,
 * fastcall `ecx = bForceReset`, `edx = pItem`, stack `(pUnit, pProp, bSetStat, wStatId, nParam, nValue, nStateId, fStatListFlags, _unused)`, `ret 0x24`).
 */
export function ITEMMODS_ApplyPropertyCondResetRollDurability113c(
  m: Memory113c,
  bForceReset: number,
  pItem: number,
  pUnit: number,
  pProp: number,
  bSetStat: number,
  wStatId: number,
  _nParam: number,
  _nValue: number,
  nStateId: number,
  fStatListFlags: number,
  _unused = 0,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  const u = pUnit >>> 0
  if (u === 0) return 0
  if (m.u32(u) === 4 && (bForceReset | 0) === 1) {
    ITEMS_ResetBaseDamageOrACStatFromTxt113c(m, u, (wStatId << 16) >> 16)
  }
  const rolled = ITEMS_RollItemOrUnitSeedRange113c(
    m,
    m.u32((prop + 0x0c) >>> 0),
    m.u32((prop + 0x08) >>> 0),
    u,
  )
  const applied = ITEMS_AddOrSetStatOnStatList113c(
    m,
    prop,
    pItem,
    u,
    bSetStat,
    wStatId,
    0,
    rolled,
    nStateId,
    fStatListFlags,
  )
  if (applied === 0) return 0
  const maxDur = STATLIST_GetMaxDurabilityFromUnit113c(m, u) | 0
  if (maxDur > 0) {
    setUnitStatMem113c(m, u, 0x48, maxDur, 0)
  }
  return applied >>> 0
}

// ---------------------------------------------------------------------------
// Iteration 13 Lane A: I13A-1 (#12..#22)
// ---------------------------------------------------------------------------

/** `.rdata` 0x6FDE4748: 64-entry 6-bit popcount table (0..0x3F). */
const SET_MASK_POPCOUNT_6FDDE4748: readonly number[] = [
  0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4,
  1, 2, 2, 3, 2, 3, 3, 4, 2, 3, 3, 4, 3, 4, 4, 5,
  1, 2, 2, 3, 2, 3, 3, 4, 2, 3, 3, 4, 3, 4, 4, 5,
  2, 3, 3, 4, 3, 4, 4, 5, 3, 4, 4, 5, 4, 5, 5, 6,
]

/** `.data` 0x6FDDCA08: five set-bonus state IDs (165..169). */
const SET_BONUS_STATES_6FDDCA08: readonly number[] = [0xa5, 0xa6, 0xa7, 0xa8, 0xa9]

/**
 * `@va D2Common:0x6FD7C7C0` (`ITEMMODS_UpdateSetItemBonusStates`,
 * custom `ebx = pItem`, `[esp+4] = dwMask`, `ret 4` -> `BOOL 0|1`).
 */
export function ITEMMODS_UpdateSetItemBonusStates113c(
  m: Memory113c,
  pItem: number,
  dwMask: number,
): number {
  const item = pItem >>> 0
  if (item === 0 || m.get(item, D2UnitStrc.dwUnitType) !== 4) return 0
  const pItemData = m.get(item, D2UnitStrc.pUnitData) >>> 0
  if (pItemData === 0 || m.get(pItemData, D2ItemDataStrc.dwQuality) !== 5) return 0
  const pSetItemTxt = ITEMS_GetSetItemsTxtRecordFromItem113c(m, item) >>> 0
  if (pSetItemTxt === 0) return 0

  const addFunc = m.u8((pSetItemTxt + 0x87) >>> 0)
  if (addFunc === 0) return 0

  if (addFunc === 1) {
    const selfIdx = ITEMS_GetSetItemsSetId113c(m, item) | 0
    for (let i = 0; i < 6; i++) {
      if (i === selfIdx) continue
      const slotIdx = i > selfIdx ? i - 1 : i
      const stateId = SET_BONUS_STATES_6FDDCA08[slotIdx]!
      const bOff = (dwMask & (1 << i)) !== 0 ? 0 : 1
      STATLIST_UpdateUnitStateSetFlag113c(m, item, stateId, bOff)
    }
    return 1
  }

  if (addFunc === 2) {
    const maskU = dwMask >>> 0
    const count = maskU < 0x40 ? SET_MASK_POPCOUNT_6FDDE4748[maskU]! : 0
    const nActive = (count - 1) | 0
    for (let i = 0; i < nActive; i++) {
      STATLIST_UpdateUnitStateSetFlag113c(m, item, SET_BONUS_STATES_6FDDCA08[i]!, 0)
    }
    for (let j = nActive; j < 5; j++) {
      const stateId = SET_BONUS_STATES_6FDDCA08[j]!
      if (stateId === 0) continue
      const pListEx = m.get(item, D2UnitStrc.pStatListEx) >>> 0
      if (pListEx === 0 || (m.get(pListEx, D2StatListStrc.dwFlags) | 0) >= 0) continue
      const pSub = findSubListByStateAndFlags113c(m, pListEx, stateId) >>> 0
      if (pSub === 0) continue
      const subFlags = m.get(pSub, D2StatListStrc.dwFlags) >>> 0
      if ((subFlags & 0x2000) !== 0) continue
      STATLIST_RemoveSubList113c(m, pSub)
      m.set(pSub, D2StatListStrc.dwFlags, (subFlags | 0x2000) >>> 0)
      mergeSubListMem113c(m, item, pSub, 1)
    }
  }
  return 1
}

/**
 * `@va D2Common:0x6FD97420` (`ITEMMODS_ApplyCastSkillPropStat`,
 * custom `edx = pUnit`, stack `[esp+4]=pItem, [esp+8]=pProp, [esp+C]=_u3, [esp+10]=wStatId,
 * [esp+14]=_u5, [esp+18]=_u6, [esp+1C]=nStateId, [esp+20]=fStatListFlags, [esp+24]=_u9`, `ret 0x24` -> `i32`).
 */
export function ITEMMODS_ApplyCastSkillPropStat113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
  pProp: number,
  wStatId: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  const item = pItem >>> 0
  if (item === 0 || m.get(item, D2UnitStrc.dwUnitType) !== 4) return 0

  const nSkillId = m.u32((prop + 0x04) >>> 0) | 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
  if (
    nSkillId < 0 ||
    nSkillId >= (m.u32((sgpt + DATATABLES_OFF_113C.nSkillsTxtRecordCount) >>> 0) | 0) ||
    DATATBLS_GetSkillsTxtRecordInline113c(m, nSkillId) === 0
  ) {
    return 0
  }

  let lvl = m.u32((prop + 0x0c) >>> 0) | 0
  if (lvl === 0) {
    const ilvl = ITEMS_GetItemLevel113c(m, item) | 0
    const reqLvl = SKILLS_GetReqLevel113c(m, nSkillId) | 0
    let scaled = (Math.trunc((ilvl - reqLvl) / 4) + 1) | 0
    const maxLvl = DATATBLS_GetSkillsTxtMaxLvlInline113c(m, nSkillId) | 0
    if (scaled <= 1) scaled = 1
    lvl = scaled < maxLvl ? scaled : maxLvl
  } else if (lvl < 0) {
    const reqLvl = SKILLS_GetReqLevel113c(m, nSkillId) | 0
    const rem = Math.max((0x63 - reqLvl) | 0, 1)
    const step = Math.max((-Math.trunc(rem / lvl)) | 0, 1)
    const ilvl = ITEMS_GetItemLevel113c(m, item) | 0
    lvl = Math.max(Math.trunc((ilvl - reqLvl) / step) | 0, 1)
  }

  let chance = m.u32((prop + 0x08) >>> 0) | 0
  if (chance === 0) {
    chance = 5
  } else if (chance < 0) {
    const neg = (-chance) | 0
    chance = (neg + Math.trunc(imul32(neg, lvl) / 8)) | 0
  }
  const clamped = chance <= 1 ? 1 : chance < 0xff ? chance : 0xff

  const baseChance = Math.trunc(clamped / 8) | 0
  const roll = SEED_RollRandomNumberInline113c(m, ITEMS_GetItemSeed113c(m, item), (clamped - baseChance) | 0) | 0
  const rolledChance = (roll + baseChance + 1) | 0

  const pStatList = ITEMMODS_GetOrCreateStatList113c(m, item, pUnit >>> 0, nStateId, fStatListFlags) >>> 0
  if (pStatList !== 0) {
    const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
    const shift = m.u32((dt + 0xc6c) >>> 0)
    const mask = m.u16((dt + 0xc70) >>> 0)
    const layer = (shl32(nSkillId, shift) + (lvl & mask)) | 0
    const statId = (wStatId << 16) >> 16
    const val = ((rolledChance & 0xff) + (clamped << 8)) | 0
    STATLIST_SetStat113c(m, pStatList, statId, val, layer)
  }
  return clamped
}

/** `.text` 0x6FD97880: 98-byte LUT mapping `nStatId - 0x53` (`0..0x61`) to class index `0..6` (default `7 -> 0`). */
const CLASS_SKILL_STAT_INDEX_6FD97880: readonly number[] = [
  0, 1, 2, 3, 4, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  5, 6,
]

/**
 * `@va D2Common:0x6FD97780` (`ITEMMODS_ApplyClassSkillsPropStat`,
 * custom `edx = pUnit`, stack `[esp+4]=pItem, [esp+8]=pProp, [esp+C]=nStatId,
 * [esp+10]=bNegate, [esp+14]=nStateId, [esp+18]=fStatListFlags, [esp+1C]=_u7`, `ret 0x1C` -> `BOOL 0|1`).
 */
export function ITEMMODS_ApplyClassSkillsPropStat113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
  pProp: number,
  nStatId: number,
  bNegate: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  const item = pItem >>> 0
  const prop = pProp >>> 0
  const nMin = m.u32((prop + 0x08) >>> 0) | 0
  const nMax = m.u32((prop + 0x0c) >>> 0) | 0
  let rolled = DRLGROOM_RollItemCoordinateAlt113c(m, nMax, nMin, item) | 0
  if (rolled === 0) return 0

  const pStatList = ITEMMODS_GetOrCreateStatList113c(m, item, pUnit >>> 0, nStateId, fStatListFlags) >>> 0
  if (pStatList === 0) return 0

  const idx = ((nStatId - 0x53) | 0) >>> 0
  const mapped = idx <= 0x61 ? CLASS_SKILL_STAT_INDEX_6FD97880[idx]! : 7
  const classId = mapped < 7 ? mapped : 0

  if ((bNegate | 0) !== 0) {
    const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
    if ((m.u32((sgpt + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0) > 0x53) {
      const basePtr = m.u32((sgpt + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0)
      const pIsc = (basePtr + 0x690c) >>> 0
      if (pIsc !== 0) {
        rolled = (-getBaseStatWithMinFromList113c(m, pStatList, (0x530000 + (classId & 0xffff)) >>> 0, pIsc)) | 0
      } else {
        rolled = 0
      }
    } else {
      rolled = 0
    }
  }
  STATLIST_AddStat113c(m, pStatList, 0x53, rolled, classId)
  return 1
}

/**
 * `@va D2Common:0x6FD978F0` (`ITEMMODS_ApplyAmazonSkillsPropStat`,
 * custom `edx = pUnit`, stack `[esp+4]=pItem, [esp+8]=pProp, [esp+C]=_u3,
 * [esp+10]=bNegate, [esp+14]=nStateId, [esp+18]=fStatListFlags, [esp+1C]=_u7`, `ret 0x1C` -> `BOOL 0|1`).
 */
export function ITEMMODS_ApplyAmazonSkillsPropStat113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
  pProp: number,
  bNegate: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  const item = pItem >>> 0
  const prop = pProp >>> 0
  const nMin = m.u32((prop + 0x08) >>> 0) | 0
  const nMax = m.u32((prop + 0x0c) >>> 0) | 0
  let rolled = DRLGROOM_RollItemCoordinateAlt113c(m, nMax, nMin, item) | 0
  if (rolled === 0) return 0

  const pStatList = ITEMMODS_GetOrCreateStatList113c(m, item, pUnit >>> 0, nStateId, fStatListFlags) >>> 0
  if (pStatList === 0) return 0

  if ((bNegate | 0) !== 0) {
    const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
    if ((m.u32((sgpt + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0) > 0x7e) {
      const basePtr = m.u32((sgpt + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0)
      const pIsc = (basePtr + 0x9f78) >>> 0
      if (pIsc !== 0) {
        rolled = (-getBaseStatWithMinFromList113c(m, pStatList, 0x7e0001, pIsc)) | 0
      } else {
        rolled = 0
      }
    } else {
      rolled = 0
    }
  }
  STATLIST_AddStat113c(m, pStatList, 0x7e, rolled, 1)
  return 1
}

/**
 * `@va D2Common:0x6FD97980` (`ITEMMODS_ApplyAddSingleSkillPropStat`,
 * custom `edx = pUnit`, stack `[esp+4]=pItem, [esp+8]=pProp, [esp+C]=_u3,
 * [esp+10]=bNegate, [esp+14]=nStateId, [esp+18]=fStatListFlags, [esp+1C]=_u7`, `ret 0x1C` -> `BOOL 0|1`).
 */
export function ITEMMODS_ApplyAddSingleSkillPropStat113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
  pProp: number,
  bNegate: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  const item = pItem >>> 0
  const nMin = m.u32((prop + 0x08) >>> 0) | 0
  const nMax = m.u32((prop + 0x0c) >>> 0) | 0
  let rolled = DRLGROOM_RollItemCoordinateAlt113c(m, nMax, nMin, item) | 0
  const nSkillId = m.u32((prop + 0x04) >>> 0) | 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
  if (nSkillId < 0 || nSkillId >= (m.u32((sgpt + DATATABLES_OFF_113C.nSkillsTxtRecordCount) >>> 0) | 0)) {
    return 0
  }
  const pStatList = ITEMMODS_GetOrCreateStatList113c(m, item, pUnit >>> 0, nStateId, fStatListFlags) >>> 0
  if (pStatList === 0) return 0

  if ((bNegate | 0) !== 0) {
    rolled = (-STATLIST_GetBaseStatFromListInline113c(m, pStatList, 0x6b, nSkillId)) | 0
  }
  STATLIST_AddStat113c(m, pStatList, 0x6b, rolled, nSkillId)
  return 1
}

/**
 * `@va D2Common:0x6FD97A10` (`ITEMMODS_ApplyAddDamageTripletPropStat`,
 * custom `edx = pUnit`, stack `[esp+4]=pItem, [esp+8]=pProp, [esp+C]=wBaseStatId,
 * [esp+10]=bNegate, [esp+14]=nStateId, [esp+18]=fStatListFlags, [esp+1C]=_u7`, `ret 0x1C` -> `1`).
 */
export function ITEMMODS_ApplyAddDamageTripletPropStat113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
  pProp: number,
  wBaseStatId: number,
  bNegate: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  const prop = pProp >>> 0
  const item = pItem >>> 0
  const baseStat = wBaseStatId | 0
  const sm = withBitStreamScratch113c(m)
  const pMin = (BITSTREAM_STACK_BASE + 0x18) >>> 0
  const pMax = (BITSTREAM_STACK_BASE + 0x1c) >>> 0
  const pLen = (BITSTREAM_STACK_BASE + 0x20) >>> 0
  sm.setU32(pMin, sm.u32((prop + 0x08) >>> 0))
  sm.setU32(pMax, sm.u32((prop + 0x0c) >>> 0))
  sm.setU32(pLen, sm.u32((prop + 0x04) >>> 0))

  ITEMMODS_ShiftStatValueIfFixedPoint113c(sm, baseStat, pMin)
  ITEMMODS_ShiftStatValueIfFixedPoint113c(sm, (baseStat + 1) | 0, pMax)
  ITEMMODS_ShiftStatValueIfFixedPoint113c(sm, (baseStat + 2) | 0, pLen)

  let vMin = sm.u32(pMin) | 0
  let vMax = sm.u32(pMax) | 0
  let vLen = sm.u32(pLen) | 0

  const pStatList = ITEMMODS_GetOrCreateStatList113c(m, item, pUnit >>> 0, nStateId, fStatListFlags) >>> 0
  if (pStatList === 0) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x4ad)
  }

  if ((bNegate | 0) !== 0) {
    vMin = (-STATLIST_GetStatValue113c(m, pStatList, baseStat, 0)) | 0
    vMax = (-STATLIST_GetStatValue113c(m, pStatList, (baseStat + 1) | 0, 0)) | 0
    vLen = (-STATLIST_GetStatValue113c(m, pStatList, (baseStat + 2) | 0, 0)) | 0
  }

  STATLIST_AddStat113c(m, pStatList, baseStat, vMin, 0)
  STATLIST_AddStat113c(m, pStatList, (baseStat + 1) | 0, vMax, 0)
  STATLIST_AddStat113c(m, pStatList, (baseStat + 2) | 0, vLen, 0)
  if (baseStat === 0x39) {
    STATLIST_AddStat113c(m, pStatList, 0x146, 1, 0)
  }
  return 1
}

/**
 * `@va D2Common:0x6FD97B20` (`ITEMMODS_ApplyPackedDamageRangePropStat`,
 * custom `edx = pUnit`, stack `[esp+4]=pItem, [esp+8]=pProp, [esp+C]=wStatId,
 * [esp+10]=_u4, [esp+14]=nStateId, [esp+18]=fStatListFlags, [esp+1C]=_u7`, `ret 0x1C` -> `1`).
 */
export function ITEMMODS_ApplyPackedDamageRangePropStat113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
  pProp: number,
  wStatId: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  const prop = pProp >>> 0
  const nMin = m.u32((prop + 0x08) >>> 0) | 0
  const nMax = m.u32((prop + 0x0c) >>> 0) | 0
  if (nMin > nMax) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x444)
  }
  const nVal = m.u32((prop + 0x04) >>> 0) | 0
  const packedMin = (nMin + 0x100) | 0
  const packedMax = (nMax + 0x100) | 0
  const pStatList = ITEMMODS_GetOrCreateStatList113c(m, pItem >>> 0, pUnit >>> 0, nStateId, fStatListFlags) >>> 0
  if (pStatList === 0) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x44a)
  }
  if (nVal < 0 || nVal > 3) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x44c)
  }
  if (packedMin < 0 || packedMin >= 0x400) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x44d)
  }
  if (packedMax < 0 || packedMax >= 0x400) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x44e)
  }
  const packed = ((((packedMax << 10) + packedMin) * 4) + nVal) | 0
  STATLIST_SetStat113c(m, pStatList, wStatId | 0, packed, 0)
  return 1
}

/**
 * `@va D2Common:0x6FD97C00` (`ITEMMODS_ApplyCastSkillOnItemPropStat`,
 * custom `edx = pUnit`, stack `[esp+4]=pItem, [esp+8]=pProp, [esp+C]=wStatId,
 * [esp+10]=_u4, [esp+14]=nStateId, [esp+18]=fStatListFlags, [esp+1C]=_u7`, `ret 0x1C` -> `BOOL 0|1`).
 */
export function ITEMMODS_ApplyCastSkillOnItemPropStat113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
  pProp: number,
  wStatId: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) return 0
  const item = pItem >>> 0
  const nSkillId = m.u32((prop + 0x04) >>> 0) | 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
  if (nSkillId < 0 || nSkillId >= (m.u32((sgpt + DATATABLES_OFF_113C.nSkillsTxtRecordCount) >>> 0) | 0)) {
    return 0
  }
  const pSkillsTxtBase = m.u32((sgpt + DATATABLES_OFF_113C.pSkillsTxt) >>> 0)
  const pSkillsTxt = (pSkillsTxtBase + imul32(nSkillId, D2SkillsTxt_SIZE)) >>> 0
  if (pSkillsTxt === 0) return 0

  let lvl = m.u32((prop + 0x0c) >>> 0) | 0
  if (lvl === 0) {
    const ilvl = ITEMS_GetItemLevel113c(m, item) | 0
    const reqLvl = SKILLS_GetReqLevel113c(m, nSkillId) | 0
    let scaled = (Math.trunc((ilvl - reqLvl) / 4) + 1) | 0
    const maxLvl = DATATBLS_GetSkillsTxtMaxLvlInline113c(m, nSkillId) | 0
    if (scaled <= 1) scaled = 1
    lvl = scaled < maxLvl ? scaled : maxLvl
  } else if (lvl < 0) {
    const reqLvl = SKILLS_GetReqLevel113c(m, nSkillId) | 0
    const rem = Math.max((0x63 - reqLvl) | 0, 1)
    const step = Math.max((-Math.trunc(rem / lvl)) | 0, 1)
    const ilvl = ITEMS_GetItemLevel113c(m, item) | 0
    lvl = Math.max(Math.trunc((ilvl - reqLvl) / step) | 0, 1)
  }

  let chance = m.u32((prop + 0x08) >>> 0) | 0
  if (chance === 0) {
    chance = 5
  } else if (chance < 0) {
    const neg = (-chance) | 0
    chance = (neg + Math.trunc(imul32(neg, lvl) / 8)) | 0
  }
  const clamped = chance <= 1 ? 1 : chance < 0xff ? chance : 0xff

  const baseChance = Math.trunc(clamped / 8) | 0
  const roll = SEED_RollRandomNumberInline113c(m, ITEMS_GetItemSeed113c(m, item), (clamped - baseChance) | 0) | 0
  const rolledChance = (roll + baseChance + 1) | 0

  const pStatList = ITEMMODS_GetOrCreateStatList113c(m, item, pUnit >>> 0, nStateId, fStatListFlags) >>> 0
  if (pStatList !== 0) {
    const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
    const shift = m.u32((dt + 0xc6c) >>> 0)
    const mask = m.u16((dt + 0xc70) >>> 0)
    const layer = (shl32(nSkillId, shift) + (lvl & mask)) | 0
    const val = ((rolledChance & 0xff) + (clamped << 8)) | 0
    STATLIST_SetStat113c(m, pStatList, wStatId | 0, val, layer)
  }
  return 1
}

/**
 * `@va D2Common:0x6FD97E20` (`ITEMMODS_ApplyBaseStatOverridePropStat`,
 * custom `ecx = bResetToMin`, `edx = pUnit`, stack `[esp+4]=pItem, [esp+8]=pProp, [esp+C]=nStatId,
 * [esp+10]=bNegate, [esp+14]=nStateId, [esp+18]=fStatListFlags, [esp+1C]=_u7`, `ret 0x1C` -> `BOOL 0|1`).
 */
export function ITEMMODS_ApplyBaseStatOverridePropStat113c(
  m: Memory113c,
  bResetToMin: number,
  pUnit: number,
  pItem: number,
  pProp: number,
  nStatId: number,
  bNegate: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  const prop = pProp >>> 0
  if (prop === 0) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x2e2)
  }
  let val = m.u32((prop + 0x04) >>> 0) | 0
  if (val === 0) return 0

  const item = pItem >>> 0
  const statId = nStatId | 0
  if ((statId >= 0x10 && statId <= 0x12) || (bResetToMin | 0) === 1) {
    ITEMS_ResetBaseDamageOrACStatFromTxt113c(m, item, statId)
  }
  const sm = withBitStreamScratch113c(m)
  const pVal = BITSTREAM_STACK_BASE
  sm.setU32(pVal, val >>> 0)
  ITEMMODS_ShiftStatValueIfFixedPoint113c(sm, statId, pVal)
  val = sm.u32(pVal) | 0

  const pStatList = ITEMMODS_GetOrCreateStatList113c(m, item, pUnit >>> 0, nStateId, fStatListFlags) >>> 0
  if (pStatList === 0) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x2f0)
  }

  if ((bNegate | 0) !== 0) {
    val = (-STATLIST_GetStatValue113c(m, pStatList, statId, 0)) | 0
  }
  STATLIST_AddStat113c(m, pStatList, statId, val, 0)
  return 1
}

/**
 * `@va D2Common:0x6FD996F0` (`ITEMMODS_ApplyDmgToUndeadPropStat`,
 * custom `ecx = bCheckItem`, `edx = pUnit`, stack `[esp+4]=pItem, [esp+8]=pProp, [esp+C]=nRetVal,
 * [esp+10]=bNegate, [esp+14]=nStateId, [esp+18]=fStatListFlags, [esp+1C]=_u7`, `ret 0x1C` -> `nRetVal`).
 */
export function ITEMMODS_ApplyDmgToUndeadPropStat113c(
  m: Memory113c,
  bCheckItem: number,
  pUnit: number,
  pItem: number,
  pProp: number,
  nRetVal: number,
  bNegate: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  const item = pItem >>> 0
  const prop = pProp >>> 0
  const nMin = m.u32((prop + 0x08) >>> 0) | 0
  const nMax = m.u32((prop + 0x0c) >>> 0) | 0
  let rolled = DRLGROOM_RollItemCoordinateAlt113c(m, nMax, nMin, item) | 0

  if ((bCheckItem | 0) === 1) {
    if (item === 0) {
      throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x61b)
    }
    if (m.get(item, D2UnitStrc.dwUnitType) !== 4) {
      throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x61c)
    }
    const pRec = getItemsTxtRecordInvMem113c(m, m.get(item, D2UnitStrc.dwClassId)) >>> 0
    if (pRec === 0) {
      throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x61f)
    }
    fogGetLinkIndex113c(m, m.u32(D2COMMON_ITEMS_CODE_LINK_VA_113C), m.get(pRec, D2ItemsTxt.dwCode))
  }

  if (rolled !== 0) {
    const pStatList = ITEMMODS_GetOrCreateStatList113c(m, item, pUnit >>> 0, nStateId, fStatListFlags) >>> 0
    if (pStatList === 0) {
      throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x29d)
    }
    if ((bNegate | 0) !== 0) {
      const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
      if ((m.u32((sgpt + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0) > 0x7f) {
        const basePtr = m.u32((sgpt + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0)
        const pIsc = (basePtr + 0xa0bc) >>> 0
        if (pIsc !== 0) {
          rolled = (-getBaseStatWithMinFromList113c(m, pStatList, 0x7f0000, pIsc)) | 0
        } else {
          rolled = 0
        }
      } else {
        rolled = 0
      }
    }
    STATLIST_AddStat113c(m, pStatList, 0x7f, rolled, 0)
  }
  return nRetVal | 0
}

/**
 * `@va D2Common:0x6FDA2480` (`D2Common.#10056` `STATES_ApplyMonSkillIconToUnit`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nSkillId`, `ret 8`, void).
 */
export function STATES_ApplyMonSkillIconToUnit113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
): void {
  const unit = pUnit >>> 0
  const skId = nSkillId | 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
  if (skId < 0 || skId >= (m.u32((sgpt + DATATABLES_OFF_113C.nSkillsTxtRecordCount) >>> 0) | 0)) {
    return
  }
  const pSkillsTxtBase = m.u32((sgpt + DATATABLES_OFF_113C.pSkillsTxt) >>> 0)
  const pSkillsTxt = (pSkillsTxtBase + imul32(skId, D2SkillsTxt_SIZE)) >>> 0
  if (pSkillsTxt === 0) return

  const wAuraState = (m.get(pSkillsTxt, D2SkillsTxt.wPassiveState) << 16) >> 16
  if (wAuraState <= 0) return
  if (wAuraState >= (m.u32((sgpt + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0) | 0)) return

  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndId113c(m, unit, skId) >>> 0
  if (pSkill === 0) {
    const pListEx = m.get(unit, D2UnitStrc.pStatListEx) >>> 0
    if (pListEx === 0 || (m.get(pListEx, D2StatListStrc.dwFlags) | 0) >= 0) return
    const pSub = findSubListByStateAndFlags113c(m, pListEx, wAuraState) >>> 0
    if (pSub === 0) return
    STATLIST_RemoveSubList113c(m, pSub)
    if ((m.get(pSub, D2StatListStrc.dwFlags) | 0) >= 0) {
      STATLIST_FreeStatListImpl113c(m, pSub)
    }
    return
  }

  const wPassStatState = (m.u16((pSkillsTxt + 0x80) >>> 0) << 16) >> 16
  if (wPassStatState > 0 && STATES_CheckState113c(m, unit, wPassStatState) !== 0) {
    SKILLS_GetOrCreateSkillStatList113c(m, unit, wAuraState, 0)
    return
  }

  const slvl = SKILLS_EvaluateSkillLevel113c(m, unit, pSkill, 1) | 0
  const pStatList = SKILLS_GetOrCreateSkillStatList113c(m, unit, wAuraState, slvl) >>> 0
  if (pStatList === 0) return
  if ((STATLIST_GetStatValue113c(m, pStatList, 0x15f, 0) | 0) === slvl) return

  for (let i = 0; i < 5; i++) {
    const wStatId = (m.u16((pSkillsTxt + 0x98 + i * 2) >>> 0) << 16) >> 16
    const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
    if (wStatId < 0 || wStatId >= (m.u32((dt + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0)) {
      break
    }
    const dwCalcOff = m.u32((pSkillsTxt + 0xa4 + i * 4) >>> 0)
    const val = SKILLS_EvalCalcByOffset113c(m, unit, dwCalcOff, skId, slvl) | 0
    const wAuraEvent = (m.u16((pSkillsTxt + 0x96) >>> 0) << 16) >> 16
    const layer = wAuraEvent > 0 ? wAuraEvent : 0
    STATLIST_SetStat113c(m, pStatList, wStatId, val, layer)
  }
  STATLIST_SetStat113c(m, pStatList, 0x15e, skId, 0)
  STATLIST_SetStat113c(m, pStatList, 0x15f, slvl, 0)
  STATES_ClearGfxStateFlag113c(m, unit, wAuraState, 1)
}

// ---------------------------------------------------------------------------
// Iteration 13 Lane A: I13A-2 (#04..#10)
// ---------------------------------------------------------------------------

/**
 * `@va D2Common:0x6FD98BD0` (`ITEMMODS_ApplyStateSkillTripletMod`,
 * custom `ecx = bResetToMin`, `edx = pUnit`, stack `[esp+4]=pItem, [esp+8]=pProp, [esp+C]=nBaseStatId,
 * [esp+10]=bNegate, [esp+14]=nStateId, [esp+18]=fStatListFlags, [esp+1C]=_u7`, `ret 0x1C` -> `1`).
 */
export function ITEMMODS_ApplyStateSkillTripletMod113c(
  m: Memory113c,
  bResetToMin: number,
  pUnit: number,
  pItem: number,
  pProp: number,
  nBaseStatId: number,
  bNegate: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  const prop = pProp >>> 0
  const item = pItem >>> 0
  const unit = pUnit >>> 0
  const statId = nBaseStatId | 0

  const sm = withBitStreamScratch113c(m)
  const pMin = (BITSTREAM_STACK_BASE + 0x18) >>> 0
  const pMax = (BITSTREAM_STACK_BASE + 0x1c) >>> 0
  sm.setU32(pMin, sm.u32((prop + 0x08) >>> 0))
  sm.setU32(pMax, sm.u32((prop + 0x0c) >>> 0))
  ITEMMODS_ShiftStatValueIfFixedPoint113c(sm, statId, pMin)
  ITEMMODS_ShiftStatValueIfFixedPoint113c(sm, (statId + 1) | 0, pMax)
  const shiftedMin = sm.u32(pMin) | 0
  const shiftedMax = sm.u32(pMax) | 0

  if (statId === 0x15) {
    let pTxt = 0
    if (unit !== 0 && m.u32(unit) === 4) {
      pTxt = getItemsTxtRecordInvMem113c(m, m.u32((unit + 0x04) >>> 0)) >>> 0
    } else {
      const cls = item !== 0 ? m.u32((item + 0x04) >>> 0) | 0 : -1
      pTxt = getItemsTxtRecordInvMem113c(m, cls) >>> 0
    }
    const isWeapon = ITEMS_CheckItemTypeIdMem113c(m, item, 0x2d)
    if (
      isWeapon === 0 ||
      m.u8((pTxt + 0xff) >>> 0) !== 0 ||
      m.u8((pTxt + 0x103) >>> 0) === 0
    ) {
      ITEMS_ApplySkillBonusStat113c(m, 0, item, 0x15, bResetToMin, unit, shiftedMin, bNegate, nStateId, fStatListFlags)
      ITEMS_ApplySkillBonusStat113c(m, 0, item, 0x16, bResetToMin, unit, shiftedMax, bNegate, nStateId, fStatListFlags)
    }
    if (
      ITEMS_CheckItemTypeIdMem113c(m, item, 0x2d) === 0 ||
      m.u8((pTxt + 0x103) >>> 0) !== 0 ||
      m.u8((pTxt + 0xfe) >>> 0) === 0
    ) {
      ITEMS_ApplySkillBonusStat113c(m, 0, item, 0x17, bResetToMin, unit, shiftedMin, bNegate, nStateId, fStatListFlags)
      ITEMS_ApplySkillBonusStat113c(m, 0, item, 0x18, bResetToMin, unit, shiftedMax, bNegate, nStateId, fStatListFlags)
    }
    if (item !== 0 && m.u32(item) === 4) {
      const itemType = ITEMS_GetItemTypeFromItem113c(m, item) | 0
      const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
      if (itemType >= 0 && itemType < (m.u32((sgpt + DATATABLES_OFF_113C.nItemTypesTxtRecordCount) >>> 0) | 0)) {
        const pTypeTxt = (m.u32((sgpt + DATATABLES_OFF_113C.pItemTypesTxt) >>> 0) + imul32(itemType, 0xe4)) >>> 0
        if (pTypeTxt !== 0 && m.u8((pTypeTxt + 0x10) >>> 0) !== 0) {
          ITEMS_ApplySkillBonusStat113c(m, 0, item, 0x9f, bResetToMin, unit, shiftedMin, bNegate, nStateId, fStatListFlags)
          ITEMS_ApplySkillBonusStat113c(m, 0, item, 0xa0, bResetToMin, unit, shiftedMax, bNegate, nStateId, fStatListFlags)
        }
      }
    }
    return 1
  }

  const pStatList = ITEMMODS_GetOrCreateStatList113c(m, item, unit, nStateId, fStatListFlags) >>> 0
  if (pStatList === 0) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x485)
  }
  let v0 = shiftedMin
  let v1 = shiftedMax
  if ((bNegate | 0) !== 0) {
    v0 = (-STATLIST_GetStatValue113c(m, pStatList, statId, 0)) | 0
    v1 = (-STATLIST_GetStatValue113c(m, pStatList, (statId + 1) | 0, 0)) | 0
  }
  STATLIST_AddStat113c(m, pStatList, statId, v0, 0)
  STATLIST_AddStat113c(m, pStatList, (statId + 1) | 0, v1, 0)
  if (statId === 0x39) {
    STATLIST_AddStat113c(m, pStatList, 0x146, 1, 0)
  }
  return 1
}

function applyOrRemoveResistGroup113c(
  m: Memory113c,
  bCheckItem: number,
  pUnit: number,
  pItem: number,
  pProp: number,
  nRetVal: number,
  bNegate: number,
  nStateId: number,
  fStatListFlags: number,
  propAssertLine: number,
  stats: readonly [number, number, number, number],
): number {
  const item = pItem >>> 0
  if (item === 0) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x1505)
  }
  if (m.u32(item) !== 4) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x1506)
  }
  const pItemData = m.get(item, D2UnitStrc.pUnitData) >>> 0
  if (pItemData === 0) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x1508)
  }

  const prop = pProp >>> 0
  const unit = pUnit >>> 0
  const chk = bCheckItem | 0
  const wFormat = m.u16((pItemData + 0x30) >>> 0)
  if (wFormat >= 1) {
    if (prop === 0) {
      throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, propAssertLine)
    }
    const nMin = m.u32((prop + 0x08) >>> 0) | 0
    const nMax = m.u32((prop + 0x0c) >>> 0) | 0
    const rolled = DRLGROOM_RollItemCoordinateAlt113c(m, nMax, nMin, item) | 0
    for (let i = 0; i < 4; i++) {
      ITEMS_ApplySkillBonusStat113c(
        m,
        0,
        item,
        stats[i]!,
        chk,
        unit,
        rolled,
        bNegate,
        nStateId,
        fStatListFlags,
      )
    }
    return nRetVal | 0
  }

  const nMin = m.u32((prop + 0x08) >>> 0) | 0
  const nMax = m.u32((prop + 0x0c) >>> 0) | 0
  for (let i = 0; i < 4; i++) {
    let rolled = DRLGROOM_RollItemCoordinateAlt113c(m, nMax, nMin, item) | 0
    if (chk === 1) {
      if (m.u32(item) !== 4) {
        throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x61c)
      }
      const pRec = getItemsTxtRecordInvMem113c(m, m.get(item, D2UnitStrc.dwClassId)) >>> 0
      if (pRec === 0) {
        throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x61f)
      }
      fogGetLinkIndex113c(m, m.u32(D2COMMON_ITEMS_CODE_LINK_VA_113C), m.get(pRec, D2ItemsTxt.dwCode))
    }
    if (rolled !== 0) {
      const pStatList = ITEMMODS_GetOrCreateStatList113c(m, item, unit, nStateId, fStatListFlags) >>> 0
      if (pStatList === 0) {
        throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x29d)
      }
      const statId = stats[i]!
      if ((bNegate | 0) !== 0) {
        const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
        if ((m.u32((sgpt + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0) > statId) {
          const basePtr = m.u32((sgpt + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0)
          const pIsc = (basePtr + imul32(statId, 0x144)) >>> 0
          if (pIsc !== 0) {
            rolled = (-getBaseStatWithMinFromList113c(m, pStatList, (statId << 16) >>> 0, pIsc)) | 0
          } else {
            rolled = 0
          }
        } else {
          rolled = 0
        }
      }
      STATLIST_AddStat113c(m, pStatList, statId, rolled, 0)
    }
  }
  return nRetVal | 0
}

/**
 * `@va D2Common:0x6FD99AF0` (`ITEMMODS_ApplyItemModProperty`,
 * custom `ecx = bCheckItem`, `edx = pUnit`, stack `[esp+4]=pItem, [esp+8]=pProp, [esp+C]=nRetVal,
 * [esp+10]=bNegate, [esp+14]=nStateId, [esp+18]=fStatListFlags, [esp+1C]=_u7`, `ret 0x1C` -> `nRetVal`).
 */
export function ITEMMODS_ApplyItemModProperty113c(
  m: Memory113c,
  bCheckItem: number,
  pUnit: number,
  pItem: number,
  pProp: number,
  nRetVal: number,
  bNegate: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  return applyOrRemoveResistGroup113c(
    m,
    bCheckItem,
    pUnit,
    pItem,
    pProp,
    nRetVal,
    bNegate,
    nStateId,
    fStatListFlags,
    0x364,
    [0x28, 0x2a, 0x2c, 0x2e],
  )
}

/**
 * `@va D2Common:0x6FD99F30` (`ITEMMODS_RemoveItemModProperty`,
 * custom `ecx = bCheckItem`, `edx = pUnit`, stack `[esp+4]=pItem, [esp+8]=pProp, [esp+C]=nRetVal,
 * [esp+10]=bNegate, [esp+14]=nStateId, [esp+18]=fStatListFlags, [esp+1C]=_u7`, `ret 0x1C` -> `nRetVal`).
 */
export function ITEMMODS_RemoveItemModProperty113c(
  m: Memory113c,
  bCheckItem: number,
  pUnit: number,
  pItem: number,
  pProp: number,
  nRetVal: number,
  bNegate: number,
  nStateId: number,
  fStatListFlags: number,
): number {
  return applyOrRemoveResistGroup113c(
    m,
    bCheckItem,
    pUnit,
    pItem,
    pProp,
    nRetVal,
    bNegate,
    nStateId,
    fStatListFlags,
    0x349,
    [0x27, 0x29, 0x2b, 0x2d],
  )
}

/** Pairs `(pDmgDataOffset, nStatId)` copied in `0x6FDBB4A0`. */
const MISSILE_DMG_STAT_FIELDS_113C: readonly (readonly [number, number])[] = [
  [0x04, 0x15],
  [0x08, 0x16],
  [0x0c, 0x30],
  [0x10, 0x31],
  [0x14, 0x13b],
  [0x18, 0x32],
  [0x1c, 0x33],
  [0x20, 0x34],
  [0x24, 0x35],
  [0x28, 0x36],
  [0x2c, 0x37],
  [0x30, 0x38],
  [0x34, 0x39],
  [0x38, 0x3a],
  [0x3c, 0x3b],
  [0x40, 0x146],
  [0x44, 0x3c],
  [0x48, 0x3d],
  [0x4c, 0x3e],
  [0x50, 0x3f],
  [0x54, 0x40],
  [0x58, 0x41],
  [0x5c, 0x42],
  [0x60, 0x13c],
  [0x64, 0x13d],
  [0x68, 0x13b],
  [0x6c, 0x79],
  [0x70, 0x7a],
  [0x74, 0x78],
  [0x78, 0x19],
]

/**
 * `@va D2Common:0x6FDBB4A0` (`D2Common.#10484` `MISSILE_ApplyDamageDataToStatList`,
 * stdcall `[esp+4]=pSrcUnit, [esp+8]=pMissile, [esp+C]=pDmgData, [esp+10]=nSrcDmg128`, `ret 0x10`, void).
 */
export function MISSILE_ApplyDamageDataToStatList113c(
  m: Memory113c,
  pSrcUnit: number,
  pMissile: number,
  pDmgData: number,
  nSrcDmg128: number,
): void {
  const missile = pMissile >>> 0
  if (missile === 0 || m.u32(missile) !== 3) return

  const dmg = pDmgData >>> 0
  const dmgFlags = m.u32(dmg) >>> 0
  const pMissileData = m.get(missile, D2UnitStrc.pUnitData) >>> 0
  if (pMissileData !== 0) {
    let streamFlags = m.u32((pMissileData + 0x14) >>> 0) >>> 0
    if ((dmgFlags & 1) !== 0) streamFlags = (streamFlags | 1) >>> 0
    if ((dmgFlags & 4) !== 0) streamFlags = (streamFlags | 2) >>> 0
    m.setU32((pMissileData + 0x14) >>> 0, streamFlags)
  }

  const pListEx = m.get(missile, D2UnitStrc.pStatListEx) >>> 0
  STATLIST_SetStat113c(m, pListEx, 0x0c, nSrcDmg128 | 0, 0)
  for (let i = 0; i < MISSILE_DMG_STAT_FIELDS_113C.length; i++) {
    const [off, statId] = MISSILE_DMG_STAT_FIELDS_113C[i]!
    const val = m.u32((dmg + off) >>> 0) | 0
    STATLIST_SetStat113c(m, pListEx, statId, val, 0)
  }

  if ((dmgFlags & 0x100) !== 0) STATLIST_SetUnitStat113c(m, missile, 0x67, 1, 0)
  if ((dmgFlags & 0x200) !== 0) STATLIST_SetUnitStat113c(m, missile, 0x68, 1, 0)
  if ((dmgFlags & 0x400) !== 0) STATLIST_SetUnitStat113c(m, missile, 0x6a, 1, 0)
  if ((dmgFlags & 0x002) !== 0) STATLIST_SetUnitStat113c(m, missile, 0x8d, 1, 0)

  const src = pSrcUnit >>> 0
  if (src === 0) return
  const srcList = m.get(src, D2UnitStrc.pStatListEx) >>> 0
  if (srcList === 0 || (m.get(srcList, D2StatListStrc.dwFlags) | 0) >= 0) return

  const pHdr = (srcList + 0x48) >>> 0
  let idx = STATLIST_FindStatFirstIndexOrLowerBound113c(m, pHdr, 0x00b40000) | 0
  if (idx < 0) return
  const count = (m.u16((pHdr + 4) >>> 0) << 16) >> 16
  let pEntry = (m.u32(pHdr) + imul32(idx, 8)) >>> 0
  const copied: Array<readonly [number, number]> = []
  while (idx < count && copied.length < 0x80) {
    const key = m.u32(pEntry)
    if (((key >> 16) & 0xffff) !== 0xb4) break
    copied.push([key & 0xffff, m.u32((pEntry + 4) >>> 0) | 0])
    idx++
    pEntry = (pEntry + 8) >>> 0
  }
  const destList = m.get(missile, D2UnitStrc.pStatListEx) >>> 0
  for (let i = 0; i < copied.length; i++) {
    const [layer, val] = copied[i]!
    STATLIST_SetStat113c(m, destList, 0xb4, val, layer)
  }
}

function bitStreamInit113c(m: Memory113c, pBitBuf: number, pData: number, nBytes: number): void {
  const b = pBitBuf >>> 0
  m.setU32(b, pData >>> 0)
  m.setU32((b + 0x04) >>> 0, ((nBytes | 0) << 3) >>> 0)
  m.setU32((b + 0x08) >>> 0, 0)
  m.setU32((b + 0x0c) >>> 0, 0)
  m.setU32((b + 0x10) >>> 0, 0)
}

function bitStreamReadU113c(m: Memory113c, pBitBuf: number, nBits: number): number {
  const esi = pBitBuf >>> 0
  const eax = m.u32((esi + 0x08) >>> 0) | 0
  const ecx = m.u32((esi + 0x0c) >>> 0) | 0
  let ebp = nBits | 0
  let overflow = ((eax << 3) - (m.u32((esi + 0x04) >>> 0) | 0) + ebp + ecx) | 0
  if (overflow < 0) overflow = 0
  ebp = (ebp - overflow) | 0
  if (overflow !== 0) {
    m.setU32((esi + 0x10) >>> 0, 1)
  }
  if (ebp <= 0) return 0
  let result = 0
  let shift = 0
  while (ebp > 0) {
    const curBit = m.u32((esi + 0x0c) >>> 0) | 0
    let edx = (8 - curBit) | 0
    if (edx > ebp) edx = ebp
    const edi = m.u32(esi)
    const byteVal = m.u8(edi)
    const highMask = (0xff << (curBit & 7)) & 0xff
    const extracted = ((byteVal & highMask) >>> (curBit & 31)) & ((1 << edx) - 1)
    result = (result + ((extracted << (shift & 31)) >>> 0)) >>> 0
    shift = (shift + edx) | 0
    ebp = (ebp - edx) | 0
    const nextBit = (curBit + edx) | 0
    m.setU32((esi + 0x0c) >>> 0, nextBit >>> 0)
    if (nextBit === 8) {
      m.setU32(esi, (edi + 1) >>> 0)
      m.setU32((esi + 0x0c) >>> 0, 0)
      m.setU32((esi + 0x08) >>> 0, (m.u32((esi + 0x08) >>> 0) + 1) >>> 0)
    }
  }
  return result >>> 0
}

function bitStreamReadS113c(m: Memory113c, pBitBuf: number, nBits: number): number {
  const val = bitStreamReadU113c(m, pBitBuf, nBits)
  if ((nBits | 0) >= 32) return val | 0
  const signBit = (1 << ((nBits - 1) & 31)) >>> 0
  if ((val & signBit) !== 0) {
    return (val | (~((1 << nBits) - 1))) | 0
  }
  return val | 0
}

function bitStreamGetBytePos113c(m: Memory113c, pBitBuf: number): number {
  const b = pBitBuf >>> 0
  const pos = m.u32((b + 0x08) >>> 0) >>> 0
  return m.u32((b + 0x0c) >>> 0) !== 0 ? (pos + 1) >>> 0 : pos
}

const BITSTREAM_STACK_BASE = 0x7fff0200
const BITSTREAM_STACK_SIZE = 0x30
const _bsBuf = new ArrayBuffer(BITSTREAM_STACK_SIZE)
const _bsDv = new DataView(_bsBuf)

function withBitStreamScratch113c(m: Memory113c): Memory113c {
  if ((m as { __hasBsScratch?: boolean }).__hasBsScratch) return m
  const isScratch = (p: number): boolean => {
    const u = p >>> 0
    return u >= BITSTREAM_STACK_BASE && u < BITSTREAM_STACK_BASE + BITSTREAM_STACK_SIZE
  }
  const wrapped: Memory113c & { __hasBsScratch: boolean } = {
    __hasBsScratch: true,
    alloc: (size) => m.alloc(size),
    u8: (p) => (isScratch(p) ? _bsDv.getUint8((p >>> 0) - BITSTREAM_STACK_BASE) : m.u8(p)),
    u16: (p) => (isScratch(p) ? _bsDv.getUint16((p >>> 0) - BITSTREAM_STACK_BASE, true) : m.u16(p)),
    u32: (p) => (isScratch(p) ? _bsDv.getUint32((p >>> 0) - BITSTREAM_STACK_BASE, true) : m.u32(p)),
    setU8: (p, v) => {
      if (isScratch(p)) _bsDv.setUint8((p >>> 0) - BITSTREAM_STACK_BASE, v & 0xff)
      else m.setU8(p, v)
    },
    setU16: (p, v) => {
      if (isScratch(p)) _bsDv.setUint16((p >>> 0) - BITSTREAM_STACK_BASE, v & 0xffff, true)
      else m.setU16(p, v)
    },
    setU32: (p, v) => {
      if (isScratch(p)) _bsDv.setUint32((p >>> 0) - BITSTREAM_STACK_BASE, v >>> 0, true)
      else m.setU32(p, v)
    },
    get: (base, field, index = 0) => m.get(base, field, index),
    set: (base, field, value, index = 0) => m.set(base, field, value, index),
    fill: (p, len, v) => m.fill(p, len, v),
  }
  return wrapped
}

function changeAnimModeMem113c(m: Memory113c, pUnit: number, nMode: number): number {
  const u = pUnit >>> 0
  if (u === 0 || m.u32(u) === 5) return 0
  const prev = m.get(u, D2UnitStrc.dwAnimMode) | 0
  const next = nMode | 0
  if (prev !== next) {
    UNITROOM_RefreshUnit113c(m, u)
    m.set(u, D2UnitStrc.dwFlags, (m.get(u, D2UnitStrc.dwFlags) | 1) >>> 0)
    m.set(u, D2UnitStrc.dwAnimMode, next >>> 0)
    STATLIST_ExpireStateListsOnModeChange113c(m, u, 0)
    UNITS_UpdateAnimFrame113c(m, u)
    return 1
  }
  if (!(m.u32(u) === 1 && prev === 1)) {
    UNITROOM_RefreshUnit113c(m, u)
    m.set(u, D2UnitStrc.dwFlags, (m.get(u, D2UnitStrc.dwFlags) | 1) >>> 0)
  }
  return 0
}

/** `.rdata` 0x6FD7BF4C: 17-entry version group table for `(nVersion - 0x48)` in `0..0x10`. */
const ITEM_VERSION_AFFIX_GROUP_6FD7BF4C: readonly number[] = [
  0, 0, 4, 4, 4, 4, 4, 4, 0, 0, 0, 1, 1, 2, 2, 2, 3,
]

/** `.data` 0x6FDDCA20: set-bonus state IDs `[165..169, 0, 0, -1]`. */
const SET_BONUS_STATES_EXT_6FDDCA20: readonly number[] = [
  0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0, 0, -1,
]

/** `.rdata` 0x6FD7BFE8: 214-byte LUT mapping `nStatId` (`0..0xD5`) to case `0..24`. */
const ITEM_SAVE_STAT_CASE_6FD7BFE8: readonly number[] = [
  0, 1, 0, 2, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 3, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
  24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 4, 24, 5, 24, 6, 24, 7, 24, 24, 8, 24, 24, 24, 24, 24, 24,
  24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 9, 10, 11, 12, 13, 24, 24, 24, 24, 24, 24, 24, 24,
  24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 14, 14, 14, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 15, 24,
  24, 24, 24, 24, 24, 24, 16, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
  24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 17, 18, 14, 14, 14, 14, 14, 14, 14, 19, 19, 19, 19,
  19, 19, 24, 20, 20, 20, 21, 21, 21, 22, 22, 22, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
]

function setStatAndRecordModOnList113c(
  m: Memory113c,
  pList: number,
  statId: number,
  value: number,
): void {
  const list = pList >>> 0
  if (list === 0) return
  const key = (statId << 16) >>> 0
  const pHdr = (list + 0x24) >>> 0
  let idx = STATLIST_FindStatIndex113c(m, pHdr, key) | 0
  let pSlot = idx >= 0 ? (m.u32(pHdr) + imul32(idx, 8)) >>> 0 : 0
  if (pSlot === 0) {
    const ins = STATLIST_FindInsertPos113c(m, pHdr, key)
    pSlot = insertStatSlot(m, pHdr, ins, key) >>> 0
  }
  const oldVal = m.u32((pSlot + 4) >>> 0) | 0
  const delta = ((value | 0) - oldVal) | 0
  if (delta === 0) return
  m.setU32((pSlot + 4) >>> 0, value >>> 0)
  STATLIST_PropagateDelta113c(m, list, statId, 0, delta)
  if ((m.u32((list + 0x10) >>> 0) | 0) < 0 && m.u32((list + 0x08) >>> 0) === 0) {
    STATLIST_RecordModStat113c(m, list, key)
  }
}

/**
 * `@va D2Common:0x6FD7A600` (`ITEMS_ReadItemBitstream`,
 * stdcall `[esp+4]=pItem, [esp+8]=pBitStream, [esp+C]=bHasVersionCoords,
 * [esp+10]=bIsSimple, [esp+14]=pOutBodyLocOrUnused, [esp+18]=nVersion`, `ret 0x18` -> `1 | -1`).
 */
export function ITEMS_ReadItemBitstream113c(
  m: Memory113c,
  pItem: number,
  pBitStream: number,
  bHasVersionCoords: number,
  bIsSimple: number,
  pOutUnused: number,
  nVersion: number,
): number {
  const item = pItem >>> 0
  const bs = pBitStream >>> 0
  const fmt = bitStreamReadU113c(m, bs, 10)
  if (item === 0) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x1510)
  }
  if (m.u32(item) !== 4) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x1511)
  }
  const pItemData = m.get(item, D2UnitStrc.pUnitData) >>> 0
  if (pItemData === 0) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x1513)
  }
  m.setU16((pItemData + 0x30) >>> 0, fmt & 0xffff)

  const ver = nVersion >>> 0
  let bFailed = 0
  let bHasRuneword = 0

  const mode = bitStreamReadU113c(m, bs, 3)
  if (mode === 3 || mode === 5) {
    const posX = bitStreamReadU113c(m, bs, 16)
    UNITS_SetStaticPathPosX113c(m, item, posX)
    const posY = bitStreamReadU113c(m, bs, 16)
    UNITS_SetStaticPathPosY113c(m, item, posY)
  } else {
    const bodyLoc = bitStreamReadU113c(m, bs, 4)
    if (m.u32(item) === 4 && m.get(item, D2UnitStrc.pUnitData) !== 0) {
      m.setU8((m.get(item, D2UnitStrc.pUnitData) + 0x44) >>> 0, bodyLoc & 0xff)
    }
    const gX = bitStreamReadU113c(m, bs, 4)
    UNITS_SetStaticPathPosX113c(m, item, gX)
    const gY = bitStreamReadU113c(m, bs, 4)
    UNITS_SetStaticPathPosY113c(m, item, gY)
    const page = ((bitStreamReadU113c(m, bs, 3) - 1) | 0) & 0xff
    if (m.u32(item) === 4 && m.get(item, D2UnitStrc.pUnitData) !== 0) {
      m.setU8((m.get(item, D2UnitStrc.pUnitData) + 0x45) >>> 0, page)
    }
  }

  changeAnimModeMem113c(m, item, mode)
  const dwCode = bitStreamReadU113c(m, bs, 32)
  const itemIdx = fogGetLinkIndex113c(m, m.u32(D2COMMON_ITEMS_CODE_LINK_VA_113C), dwCode)
  if (itemIdx >= 0) {
    m.set(item, D2UnitStrc.dwClassId, itemIdx >>> 0)
  }

  if ((bIsSimple | 0) !== 0) {
    if (m.u32(item) === 4) {
      const pd = m.get(item, D2UnitStrc.pUnitData) >>> 0
      if (pd !== 0) {
        m.setU32((pd + 0x2c) >>> 0, 1)
        m.setU32(pd, 1)
      }
    }
    return 1
  }

  const nSockets = bitStreamReadU113c(m, bs, 3)
  if ((pOutUnused >>> 0) !== 0) {
    m.setU32(pOutUnused >>> 0, nSockets)
  }

  if ((bHasVersionCoords | 0) !== 0) {
    const dwId = bitStreamReadU113c(m, bs, 32)
    m.setU32((item + 0x28) >>> 0, dwId)
    m.setU32((item + 0x20) >>> 0, dwId)
    m.setU32((item + 0x24) >>> 0, 0x29a)
  }

  let ilvl = bitStreamReadU113c(m, bs, 7) | 0
  if (ilvl < 1) ilvl = 1
  if (m.u32(item) === 4) {
    const pd = m.get(item, D2UnitStrc.pUnitData) >>> 0
    if (pd !== 0) m.setU32((pd + 0x2c) >>> 0, ilvl >>> 0)
  }

  const quality = bitStreamReadU113c(m, bs, 4)
  if (m.u32(item) === 4) {
    const pd = m.get(item, D2UnitStrc.pUnitData) >>> 0
    if (pd !== 0) m.setU32(pd, quality >>> 0)
  }

  if (bitStreamReadU113c(m, bs, 1) !== 0) {
    const gfx = bitStreamReadU113c(m, bs, 3)
    if (m.u32(item) === 4) {
      const pd = m.get(item, D2UnitStrc.pUnitData) >>> 0
      if (pd !== 0) m.setU8((pd + 0x49) >>> 0, gfx & 0xff)
    }
  }

  const baseAffixPtr = m.u32(0x6fdefbbc) | 0
  let suffixStart = sdiv32(((m.u32(0x6fdefbc4) | 0) - baseAffixPtr) | 0, 0x90)
  let autoStart = sdiv32(((m.u32(0x6fdefbc8) | 0) - baseAffixPtr) | 0, 0x90)
  const vDelta = ((ver - 0x48) | 0) >>> 0
  if (vDelta <= 0x10) {
    const grp = ITEM_VERSION_AFFIX_GROUP_6FD7BF4C[vDelta]!
    if (grp === 0) {
      suffixStart = (suffixStart - 0x295) | 0
      autoStart = (autoStart - 0x4ee) | 0
    } else if (grp === 1) {
      suffixStart = (suffixStart - 0x2a2) | 0
      autoStart = (autoStart - 0x4f1) | 0
    } else if (grp === 2) {
      suffixStart = (suffixStart - 0x2a3) | 0
      autoStart = (autoStart - 0x4f2) | 0
    } else if (grp === 3) {
      suffixStart = (suffixStart - 0x2d9) | 0
      autoStart = (autoStart - 0x5a0) | 0
    }
  }

  if (bitStreamReadU113c(m, bs, 1) !== 0) {
    let autoRaw = bitStreamReadU113c(m, bs, 11)
    if (ver <= 0x58) {
      autoRaw = 0
    } else {
      if (ver <= 0x59) autoRaw = (autoRaw + 1) >>> 0
      if ((autoRaw & 0xffff) > 0) {
        autoRaw = (autoRaw + autoStart) | 0
      }
    }
    if (m.u32(item) === 4) {
      const pd = m.get(item, D2UnitStrc.pUnitData) >>> 0
      if (pd !== 0) m.setU16((pd + 0x36) >>> 0, autoRaw & 0xffff)
    }
  } else if (m.u32(item) === 4) {
    const pd = m.get(item, D2UnitStrc.pUnitData) >>> 0
    if (pd !== 0) m.setU16((pd + 0x36) >>> 0, 0)
  }

  if (quality <= 9) {
    switch (quality) {
      case 0:
      case 2:
        break
      case 1:
      case 3: {
        if ((bHasVersionCoords | 0) !== 0 || (ITEMS_GetCommandFlags113c(m, item) & 0x10) !== 0) {
          const fileIdx = bitStreamReadU113c(m, bs, 3)
          ITEMS_SetItemCell113c(m, item, fileIdx)
        }
        break
      }
      case 4: {
        if ((bHasVersionCoords | 0) !== 0 || (ITEMS_GetCommandFlags113c(m, item) & 0x10) !== 0) {
          let pre = bitStreamReadU113c(m, bs, 11)
          if ((pre & 0xffff) > 0) pre = (pre + suffixStart) | 0
          ITEMS_SetMagicPrefix113c(m, item, pre & 0xffff, 0)
          const suf = bitStreamReadU113c(m, bs, 11)
          ITEMS_SetMagicSuffix113c(m, item, suf & 0xffff, 0)
        }
        break
      }
      case 5: {
        if ((bHasVersionCoords | 0) !== 0 || (ITEMS_GetCommandFlags113c(m, item) & 0x10) !== 0) {
          if (ver <= 0x5c) {
            const setId = bitStreamReadU113c(m, bs, 12) | 0
            const pSet = DATATBLS_GetSetsTxtRecordInline113c(m, setId) >>> 0
            if (pSet !== 0) {
              const cnt = m.u32((pSet + 0x0c) >>> 0) | 0
              let foundIdx = -1
              for (let c = 0; c < cnt; c++) {
                const pSetItem = m.u32((pSet + 0x110 + c * 4) >>> 0) >>> 0
                if (m.u32((pSetItem + 0x28) >>> 0) === dwCode) {
                  foundIdx = c
                  break
                }
              }
              if (foundIdx >= 0) {
                const pMatched = m.u32((pSet + 0x110 + foundIdx * 4) >>> 0) >>> 0
                const cellId = (m.u16(pMatched) << 16) >> 16
                ITEMS_SetItemCell113c(m, item, cellId)
              } else {
                bFailed = 1
              }
            } else {
              bFailed = 1
            }
          } else {
            const setItemId = bitStreamReadU113c(m, bs, 12) | 0
            const pSetItem = DATATBLS_GetSetItemsTxtRecordInline113c(m, setItemId) >>> 0
            if (pSetItem !== 0) {
              const cellId = (m.u16(pSetItem) << 16) >> 16
              ITEMS_SetItemCell113c(m, item, cellId)
            } else {
              bFailed = 1
            }
          }
        }
        break
      }
      case 6:
      case 8: {
        if ((bHasVersionCoords | 0) !== 0 || (ITEMS_GetCommandFlags113c(m, item) & 0x10) !== 0) {
          const rPre = bitStreamReadU113c(m, bs, 8)
          ITEMS_SetRarePrefix113c(m, item, rPre)
          const rSuf = bitStreamReadU113c(m, bs, 8)
          ITEMS_SetRareSuffix113c(m, item, rSuf)
        }
        for (let slot = 0; slot < 3; slot++) {
          const pd = m.u32(item) === 4 ? m.get(item, D2UnitStrc.pUnitData) >>> 0 : 0
          if (bitStreamReadU113c(m, bs, 1) !== 0) {
            let pre = bitStreamReadU113c(m, bs, 11)
            if (ver <= 0x59) pre = (pre + 1) >>> 0
            if ((pre & 0xffff) > 0) pre = (pre + suffixStart) | 0
            if (pd !== 0) m.setU16((pd + 0x38 + slot * 2) >>> 0, pre & 0xffff)
          } else if (pd !== 0) {
            m.setU16((pd + 0x38 + slot * 2) >>> 0, 0)
          }
          if (bitStreamReadU113c(m, bs, 1) !== 0) {
            let suf = bitStreamReadU113c(m, bs, 11)
            if (ver <= 0x59) suf = (suf + 1) >>> 0
            if (pd !== 0) m.setU16((pd + 0x3e + slot * 2) >>> 0, suf & 0xffff)
          } else if (pd !== 0) {
            m.setU16((pd + 0x3e + slot * 2) >>> 0, 0)
          }
        }
        break
      }
      case 7: {
        if ((bHasVersionCoords | 0) !== 0 || (ITEMS_GetCommandFlags113c(m, item) & 0x10) !== 0) {
          const rawUid = bitStreamReadU113c(m, bs, 12) | 0
          const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
          const nUniqCount = m.u32((dt + DATATABLES_OFF_113C.nUniqueItemsTxtRecordCount) >>> 0) | 0
          let uId = rawUid < 0 ? -1 : rawUid >= nUniqCount ? -1 : rawUid
          if (ver > 0x59 && DATATBLS_GetUniqueItemsTxtRecordInline113c(m, uId) === 0) {
            uId = -1
          }
          ITEMS_SetItemCell113c(m, item, uId)
        }
        break
      }
      case 9: {
        if ((bHasVersionCoords | 0) !== 0 || (ITEMS_GetCommandFlags113c(m, item) & 0x10) !== 0) {
          const rPre = bitStreamReadU113c(m, bs, 8)
          ITEMS_SetRarePrefix113c(m, item, rPre)
          const rSuf = bitStreamReadU113c(m, bs, 8)
          ITEMS_SetRareSuffix113c(m, item, rSuf)
        }
        break
      }
    }
  }

  if ((ITEMS_GetCommandFlags113c(m, item) & 0x4000000) !== 0) {
    bHasRuneword = 1
    const rwId = bitStreamReadU113c(m, bs, 16)
    if (m.u32(item) === 4) {
      const pd = m.get(item, D2UnitStrc.pUnitData) >>> 0
      if (pd !== 0) m.setU16((pd + 0x38) >>> 0, rwId & 0xffff)
    }
  }

  const cmdFlags = ITEMS_GetCommandFlags113c(m, item) >>> 0
  if ((cmdFlags & 0x10000) !== 0) {
    const earCls = bitStreamReadU113c(m, bs, 3)
    ITEMS_SetItemCell113c(m, item, earCls)
    const earLvl = bitStreamReadU113c(m, bs, 7)
    if (m.u32(item) === 4) {
      const pd = m.get(item, D2UnitStrc.pUnitData) >>> 0
      if (pd !== 0) m.setU8((pd + 0x48) >>> 0, earLvl & 0xff)
    }
    const namePtr = m.u32(item) === 4 && m.get(item, D2UnitStrc.pUnitData) !== 0
      ? (m.get(item, D2UnitStrc.pUnitData) + 0x4a) >>> 0
      : 0
    for (let p = namePtr; ; p = (p + 1) >>> 0) {
      const ch = bitStreamReadU113c(m, bs, 7) & 0xff
      m.setU8(p, ch)
      if (ch === 0) break
    }
  } else if ((cmdFlags & 0x1000000) !== 0) {
    const namePtr = m.u32(item) === 4 && m.get(item, D2UnitStrc.pUnitData) !== 0
      ? (m.get(item, D2UnitStrc.pUnitData) + 0x4a) >>> 0
      : 0
    for (let p = namePtr; ; p = (p + 1) >>> 0) {
      const ch = bitStreamReadU113c(m, bs, 7) & 0xff
      m.setU8(p, ch)
      if (ch === 0) break
    }
  }

  if ((bHasVersionCoords | 0) !== 0 && ver > 0x56) {
    if (bitStreamReadU113c(m, bs, 1) !== 0) {
      const s0 = bitStreamReadU113c(m, bs, 32)
      const s1 = bitStreamReadU113c(m, bs, 32)
      if (ver > 0x5d) {
        bitStreamReadU113c(m, bs, 32)
      }
      if (m.u32(item) === 4) {
        const pd = m.get(item, D2UnitStrc.pUnitData) >>> 0
        if (pd !== 0) {
          m.setU32((pd + 0x1c) >>> 0, s0 >>> 0)
          m.setU32((pd + 0x20) >>> 0, s1 >>> 0)
        }
      }
    }
  }

  const nSaveSlot = ver < 0x5d ? 1 : 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0

  if (ITEMS_CheckItemTypeIdMem113c(m, item, 0x32) !== 0) {
    const pIsc1f = (m.u32((sgpt + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0) > 0x1f
      ? (m.u32((sgpt + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0) + 0x273c) >>> 0
      : 0
    const acVal = (bitStreamReadU113c(m, bs, m.u8((pIsc1f + nSaveSlot + 0x19) >>> 0)) -
      (m.u32((pIsc1f + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
    const itemList = m.get(item, D2UnitStrc.pStatListEx) >>> 0
    if (STATLIST_SetStat113c(m, itemList, 0x1f, acVal, 0) !== 0 && m.u32(item) === 0) {
      STATLIST_RecordModStat113c(m, itemList, 0x1f0000)
    }
    const pTxt = getItemsTxtRecordInvMem113c(m, m.u32((item + 0x04) >>> 0)) >>> 0
    if (pTxt === 0) {
      throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x18b7)
    }
    STATLIST_SetUnitStat113c(m, item, 0x14, m.u8((pTxt + 0x111) >>> 0), 0)
    STATLIST_SetUnitStat113c(m, item, 0x43, (-(m.u32((pTxt + 0xd8) >>> 0) | 0)) | 0, 0)
    const pIsc49 = (m.u32((sgpt + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0) > 0x49
      ? (m.u32((sgpt + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0) + 0x5c64) >>> 0
      : 0
    const maxDur = (bitStreamReadU113c(m, bs, m.u8((pIsc49 + nSaveSlot + 0x19) >>> 0)) -
      (m.u32((pIsc49 + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
    STATLIST_SetUnitStat113c(m, item, 0x49, maxDur, 0)
    if (maxDur !== 0) {
      const pIsc48 = (m.u32((sgpt + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0) > 0x48
        ? (m.u32((sgpt + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0) + 0x5b20) >>> 0
        : 0
      const bits48 = ver > 0x5f ? m.u8((pIsc48 + nSaveSlot + 0x19) >>> 0) : 8
      const curDur = (bitStreamReadU113c(m, bs, bits48) -
        (m.u32((pIsc48 + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
      STATLIST_SetUnitStat113c(m, item, 0x48, curDur, 0)
    }
  } else if (ITEMS_CheckItemTypeIdMem113c(m, item, 0x2d) !== 0) {
    const pTxt = getItemsTxtRecordInvMem113c(m, m.u32((item + 0x04) >>> 0)) >>> 0
    if (pTxt === 0) {
      throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x18ce)
    }
    STATLIST_SetUnitStat113c(m, item, 0x44, (-(m.u32((pTxt + 0xd8) >>> 0) | 0)) | 0, 0)
    const pdCheck = m.u32(item) === 4 ? m.get(item, D2UnitStrc.pUnitData) >>> 0 : 0
    if (pdCheck !== 0 && m.u32(pdCheck) === 1) {
      const minDam = m.u8((pTxt + 0xff) >>> 0)
      if (minDam !== 0) {
        STATLIST_SetUnitStat113c(m, item, 0x16, Math.max(sdiv32(imul32(minDam, 3), 4), 2), 0)
      }
      const maxDam = m.u8((pTxt + 0xfe) >>> 0)
      if (maxDam !== 0) {
        let lowMin = sdiv32(imul32(maxDam, 3), 4)
        if (lowMin < 1) lowMin = 1
        STATLIST_SetUnitStat113c(m, item, 0x15, lowMin, 0)
      }
      const twoHandMin = m.u8((pTxt + 0x104) >>> 0)
      if (twoHandMin !== 0) {
        STATLIST_SetUnitStat113c(m, item, 0x18, Math.max(sdiv32(imul32(twoHandMin, 3), 4), 2), 0)
      }
      const twoHandMax = m.u8((pTxt + 0x103) >>> 0)
      if (twoHandMax !== 0) {
        let low2h = sdiv32(imul32(twoHandMax, 3), 4)
        if (low2h < 1) low2h = 1
        STATLIST_SetUnitStat113c(m, item, 0x17, low2h, 0)
      }
      const misMin = m.u8((pTxt + 0x102) >>> 0)
      if (misMin !== 0) {
        STATLIST_SetUnitStat113c(m, item, 0xa0, Math.max(sdiv32(imul32(misMin, 3), 4), 2), 0)
      }
      const misMax = m.u8((pTxt + 0x101) >>> 0)
      if (misMax !== 0) {
        let lowMis = sdiv32(imul32(misMax, 3), 4)
        if (lowMis < 1) lowMis = 1
        STATLIST_SetUnitStat113c(m, item, 0x9f, lowMis, 0)
      }
    } else {
      const min1 = m.u8((pTxt + 0xff) >>> 0)
      if (min1 !== 0) STATLIST_SetUnitStat113c(m, item, 0x16, min1, 0)
      const max1 = m.u8((pTxt + 0xfe) >>> 0)
      if (max1 !== 0) STATLIST_SetUnitStat113c(m, item, 0x15, max1, 0)
      const min2 = m.u8((pTxt + 0x102) >>> 0)
      if (min2 !== 0) STATLIST_SetUnitStat113c(m, item, 0x17, min2, 0)
      const max2 = m.u8((pTxt + 0x103) >>> 0)
      if (max2 !== 0) STATLIST_SetUnitStat113c(m, item, 0x18, max2, 0)
      const maxM = m.u8((pTxt + 0x101) >>> 0)
      if (maxM !== 0) {
        const minM = m.u8((pTxt + 0x100) >>> 0)
        STATLIST_SetUnitStat113c(m, item, 0x9f, minM, 0)
        STATLIST_SetUnitStat113c(m, item, 0xa0, maxM, 0)
      }
    }

    if (ITEMS_CheckEtherealFlag113c(m, item) !== 0) {
      const s16 = (STATLIST_GetUnitBaseStat113c(m, item, 0x16, 0) | 0)
      STATLIST_SetUnitStat113c(m, item, 0x16, sdiv32(imul32(s16, 3), 2), 0)
      const s15 = (STATLIST_GetUnitBaseStat113c(m, item, 0x15, 0) | 0)
      STATLIST_SetUnitStat113c(m, item, 0x15, sdiv32(imul32(s15, 3), 2), 0)
      const s18 = (STATLIST_GetUnitBaseStat113c(m, item, 0x18, 0) | 0)
      STATLIST_SetUnitStat113c(m, item, 0x18, sdiv32(imul32(s18, 3), 2), 0)
      const s17 = (STATLIST_GetUnitBaseStat113c(m, item, 0x17, 0) | 0)
      STATLIST_SetUnitStat113c(m, item, 0x17, sdiv32(imul32(s17, 3), 2), 0)
      const s9f = (STATLIST_GetUnitBaseStat113c(m, item, 0x9f, 0) | 0)
      STATLIST_SetUnitStat113c(m, item, 0x9f, sdiv32(imul32(s9f, 3), 2), 0)
      const sa0 = (STATLIST_GetUnitBaseStat113c(m, item, 0xa0, 0) | 0)
      STATLIST_SetUnitStat113c(m, item, 0xa0, sdiv32(imul32(sa0, 3), 2), 0)
    }

    const pIsc49 = (m.u32((sgpt + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0) > 0x49
      ? (m.u32((sgpt + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0) + 0x5c64) >>> 0
      : 0
    const maxDur = (bitStreamReadU113c(m, bs, m.u8((pIsc49 + nSaveSlot + 0x19) >>> 0)) -
      (m.u32((pIsc49 + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
    STATLIST_SetUnitStat113c(m, item, 0x49, maxDur, 0)
    if (maxDur !== 0) {
      const pIsc48 = (m.u32((sgpt + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0) > 0x48
        ? (m.u32((sgpt + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0) + 0x5b20) >>> 0
        : 0
      const bits48 = ver > 0x5f ? m.u8((pIsc48 + nSaveSlot + 0x19) >>> 0) : 8
      const curDur = (bitStreamReadU113c(m, bs, bits48) -
        (m.u32((pIsc48 + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
      STATLIST_SetUnitStat113c(m, item, 0x48, curDur, 0)
    }
  } else if (ITEMS_CheckItemTypeIdMem113c(m, item, 4) !== 0) {
    const bitsGold = (ITEMS_GetCommandFlags113c(m, item) & 0x20000000) !== 0 ? 32 : 12
    const goldVal = bitStreamReadU113c(m, bs, bitsGold)
    STATLIST_SetUnitStat113c(m, item, 0x0e, goldVal, 0)
  }

  if ((ITEMS_GetCommandFlags113c(m, item) & 0x800) !== 0) {
    const pIscC2 = (m.u32((sgpt + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0) > 0xc2
      ? (m.u32((sgpt + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0) + 0xf588) >>> 0
      : 0
    const socks = bitStreamReadU113c(m, bs, m.u8((pIscC2 + nSaveSlot + 0x19) >>> 0))
    ITEMS_AddSockets113c(m, item, socks)
  }

  if ((bHasVersionCoords | 0) === 0 && (ITEMS_GetCommandFlags113c(m, item) & 0x10) === 0) {
    return bFailed === 0 ? 1 : -1
  }

  let nLists = 0
  let dwSetMask = 0
  if (ver > 0x54 && m.u32(item) === 4) {
    const pd = m.get(item, D2UnitStrc.pUnitData) >>> 0
    if (pd !== 0 && m.u32(pd) === 5) {
      nLists = 5
      dwSetMask = bitStreamReadU113c(m, bs, 5)
    }
  }
  if (bHasRuneword !== 0) {
    nLists = (nLists + 1) | 0
  }

  for (let listIdx = -1; listIdx < nLists; listIdx++) {
    let stateId = 0
    let listFlags = 0x40
    if (listIdx >= 0) {
      if (bHasRuneword !== 0 && listIdx === nLists - 1) {
        stateId = 0xab
        listFlags = 0x40
      } else {
        if ((dwSetMask & (1 << listIdx)) === 0) continue
        stateId = SET_BONUS_STATES_EXT_6FDDCA20[listIdx]!
        listFlags = 0x2040
      }
    }

    const itemListEx = m.get(item, D2UnitStrc.pStatListEx) >>> 0
    let pList = 0
    if (itemListEx !== 0 && (m.get(itemListEx, D2StatListStrc.dwFlags) | 0) < 0) {
      pList = stateId !== 0
        ? findSubListByStateAndFlags113c(m, itemListEx, stateId) >>> 0
        : STATLIST_GetStatListFromFlag113c(m, itemListEx, listFlags) >>> 0
    }
    if (pList === 0) {
      const pPool = m.get(item, D2UnitStrc.pMemPool) >>> 0
      const dwUnitId = m.get(item, D2UnitStrc.dwUnitId) >>> 0
      pList = m.alloc(D2StatListStrc_SIZE) >>> 0
      if (pList !== 0) {
        m.fill(pList, D2StatListStrc_SIZE, 0)
        m.set(pList, D2StatListStrc.pMemPool, pPool)
        m.set(pList, D2StatListStrc.eOwnerType, 4)
        m.set(pList, D2StatListStrc.dwOwnerId, dwUnitId)
        m.set(pList, D2StatListStrc.dwFlags, listFlags >>> 0)
        m.set(pList, D2StatListStrc.dwExpireFrame, 0)
      }
      mergeSubListMem113c(m, item, pList, 1)
      m.set(pList, D2StatListStrc.dwStateNo, stateId >>> 0)
    }

    let prevStat = -1
    let statId = bitStreamReadU113c(m, bs, 9) | 0
    while (statId !== 0x1ff) {
      if (statId === 0 && prevStat === 0) {
        bFailed = 1
        break
      }
      const dtNow = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
      const nIscCount = m.u32((dtNow + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0
      if (statId < 0 || statId >= nIscCount) break
      const pIscBase = m.u32((dtNow + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0)
      const pIsc = (pIscBase + imul32(statId, 0x144)) >>> 0
      if (pIsc === 0) break

      const caseId = statId <= 0xd5 ? ITEM_SAVE_STAT_CASE_6FD7BFE8[statId]! : 24
      switch (caseId) {
        case 0: {
          const val = (bitStreamReadU113c(m, bs, m.u8((pIsc + nSaveSlot + 0x19) >>> 0)) -
            (m.u32((pIsc + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, statId, val, 0)
          break
        }
        case 1: {
          const v1 = (bitStreamReadU113c(m, bs, m.u8((pIsc + nSaveSlot + 0x19) >>> 0)) -
            (m.u32((pIsc + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 1, v1, 0)
          if (ver <= 0x55) {
            const pIsc9 = nIscCount > 9 ? (pIscBase + 0xb64) >>> 0 : 0
            const v9 = (bitStreamReadU113c(m, bs, m.u8((pIsc9 + nSaveSlot + 0x19) >>> 0)) -
              (m.u32((pIsc9 + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
            if (pList !== 0) STATLIST_SetStat113c(m, pList, 9, v9, 0)
          }
          break
        }
        case 2: {
          const v3 = (bitStreamReadU113c(m, bs, m.u8((pIsc + nSaveSlot + 0x19) >>> 0)) -
            (m.u32((pIsc + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 3, v3, 0)
          if (ver <= 0x55) {
            const pIsc7 = nIscCount > 7 ? (pIscBase + 0x8dc) >>> 0 : 0
            const v7 = (bitStreamReadU113c(m, bs, m.u8((pIsc7 + nSaveSlot + 0x19) >>> 0)) -
              (m.u32((pIsc7 + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
            if (pList !== 0) STATLIST_SetStat113c(m, pList, 7, (v7 << 8) | 0, 0)
          }
          break
        }
        case 3: {
          ITEMS_EnsureMinimumBaseDamageAndACStats113c(m, item, 0x11)
          const v11 = (bitStreamReadU113c(m, bs, m.u8((pIsc + nSaveSlot + 0x19) >>> 0)) -
            (m.u32((pIsc + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x11, v11, 0)
          ITEMS_EnsureMinimumBaseDamageAndACStats113c(m, item, 0x12)
          const pIsc12 = nIscCount > 0x12 ? (pIscBase + 0x16c8) >>> 0 : 0
          const v12 = (bitStreamReadU113c(m, bs, m.u8((pIsc12 + nSaveSlot + 0x19) >>> 0)) -
            (m.u32((pIsc12 + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x12, v12, 0)
          break
        }
        case 4: {
          const b30 = ver > 0x51 ? m.u8((pIsc + nSaveSlot + 0x19) >>> 0) : 6
          const v30 = (bitStreamReadU113c(m, bs, b30) - (m.u32((pIsc + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x30, v30, 0)
          const pIsc31 = nIscCount > 0x31 ? (pIscBase + 0x3e04) >>> 0 : 0
          const b31 = ver > 0x51 ? m.u8((pIsc31 + nSaveSlot + 0x19) >>> 0) : 7
          const v31 = (bitStreamReadU113c(m, bs, b31) - (m.u32((pIsc31 + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x31, v31, 0)
          break
        }
        case 5: {
          const v32 = (bitStreamReadU113c(m, bs, m.u8((pIsc + nSaveSlot + 0x19) >>> 0)) -
            (m.u32((pIsc + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x32, v32, 0)
          const pIsc33 = nIscCount > 0x33 ? (pIscBase + 0x408c) >>> 0 : 0
          const b33 = ver > 0x51 ? m.u8((pIsc33 + nSaveSlot + 0x19) >>> 0) : 7
          const v33 = (bitStreamReadU113c(m, bs, b33) - (m.u32((pIsc33 + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x33, v33, 0)
          break
        }
        case 6: {
          const v34 = (bitStreamReadU113c(m, bs, m.u8((pIsc + nSaveSlot + 0x19) >>> 0)) -
            (m.u32((pIsc + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x34, v34, 0)
          const pIsc35 = nIscCount > 0x35 ? (pIscBase + 0x4314) >>> 0 : 0
          const v35 = (bitStreamReadU113c(m, bs, m.u8((pIsc35 + nSaveSlot + 0x19) >>> 0)) -
            (m.u32((pIsc35 + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x35, v35, 0)
          break
        }
        case 7: {
          const v36 = (bitStreamReadU113c(m, bs, m.u8((pIsc + nSaveSlot + 0x19) >>> 0)) -
            (m.u32((pIsc + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x36, v36, 0)
          const pIsc37 = nIscCount > 0x37 ? (pIscBase + 0x459c) >>> 0 : 0
          const b37 = ver > 0x51 ? m.u8((pIsc37 + nSaveSlot + 0x19) >>> 0) : 7
          const v37 = (bitStreamReadU113c(m, bs, b37) - (m.u32((pIsc37 + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x37, v37, 0)
          const pIsc38 = nIscCount > 0x38 ? (pIscBase + 0x46e0) >>> 0 : 0
          const v38 = (bitStreamReadU113c(m, bs, m.u8((pIsc38 + nSaveSlot + 0x19) >>> 0)) -
            (m.u32((pIsc38 + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x38, v38, 0)
          break
        }
        case 8: {
          const b39 = ver > 0x51 ? m.u8((pIsc + nSaveSlot + 0x19) >>> 0) : 7
          const v39 = (bitStreamReadU113c(m, bs, b39) - (m.u32((pIsc + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x39, v39, 0)
          const pIsc3a = nIscCount > 0x3a ? (pIscBase + 0x4968) >>> 0 : 0
          const b3a = ver > 0x51 ? m.u8((pIsc3a + nSaveSlot + 0x19) >>> 0) : 8
          const v3a = (bitStreamReadU113c(m, bs, b3a) - (m.u32((pIsc3a + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x3a, v3a, 0)
          const pIsc3b = nIscCount > 0x3b ? (pIscBase + 0x4aac) >>> 0 : 0
          const v3b = (bitStreamReadU113c(m, bs, m.u8((pIsc3b + nSaveSlot + 0x19) >>> 0)) -
            (m.u32((pIsc3b + nSaveSlot * 4 + 0x1c) >>> 0) | 0)) | 0
          if (pList !== 0) {
            STATLIST_SetStat113c(m, pList, 0x3b, v3b, 0)
            setStatAndRecordModOnList113c(m, pList, 0x146, 1)
          }
          break
        }
        case 9:
        case 10:
        case 11:
        case 12:
        case 13:
        case 17:
        case 18: {
          const legacyClsLayer =
            caseId === 9 ? 0 : caseId === 10 ? 3 : caseId === 11 ? 2 : caseId === 12 ? 1 : caseId === 13 ? 4 : caseId === 17 ? 5 : 6
          const modernClsStat =
            caseId === 9 ? 0x53 : caseId === 10 ? 0x54 : caseId === 11 ? 0x55 : caseId === 12 ? 0x56 : caseId === 13 ? 0x57 : caseId === 17 ? 0xb3 : 0xb4
          if (ver <= 0x5c) {
            const v = bitStreamReadU113c(m, bs, 3) | 0
            if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x53, v, legacyClsLayer)
          } else {
            ITEMS_DecodeAndSetSaveStat113c(m, nSaveSlot, ver, pIsc, bs, pList, modernClsStat)
          }
          break
        }
        case 14: {
          if (ver <= 0x5c) {
            const raw = bitStreamReadU113c(m, bs, 14)
            const skId = raw & 0x1ff
            const lvl = (raw >> 9) & 0x1f
            let maxLvl = 7
            if (nIscCount > 0x6b) {
              const pIsc6b = (pIscBase + 0x876c) >>> 0
              if (pIsc6b !== 0) {
                maxLvl = ((1 << m.u8((pIsc6b + 0x19) >>> 0)) - 1) | 0
              }
            }
            if (lvl > 0 && lvl <= maxLvl && DATATBLS_HasValidSkillDescInline113c(m, skId) !== 0) {
              if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x6b, lvl, skId)
            }
          } else {
            ITEMS_DecodeAndSetSaveStat113c(m, nSaveSlot, ver, pIsc, bs, pList, statId)
          }
          break
        }
        case 15: {
          if (ver <= 0x5c) {
            const v = bitStreamReadU113c(m, bs, 4) | 0
            if (pList !== 0) STATLIST_SetStat113c(m, pList, 0x7e, v, 1)
          } else {
            ITEMS_DecodeAndSetSaveStat113c(m, nSaveSlot, ver, pIsc, bs, pList, 0x7e)
          }
          break
        }
        case 16: {
          if (ver <= 0x59) {
            bitStreamReadU113c(m, bs, 16)
            if (pList !== 0) setStatAndRecordModOnList113c(m, pList, 0x86, 1)
          } else {
            ITEMS_DecodeAndSetSaveStat113c(m, nSaveSlot, ver, pIsc, bs, pList, 0x86)
          }
          break
        }
        case 19: {
          if (ver <= 0x5c) {
            const raw10 = bitStreamReadU113c(m, bs, 10)
            const smTmp = withBitStreamScratch113c(m)
            const pTmp = BITSTREAM_STACK_BASE + 0x20
            STATLIST_UnpackSkillStatParam113c(smTmp, raw10, pTmp, (pTmp + 4) >>> 0, (pTmp + 8) >>> 0)
            const div3 = smTmp.u32(pTmp) | 0
            const rem3 = smTmp.u32((pTmp + 4) >>> 0) | 0
            let skIdx = smTmp.u32((pTmp + 8) >>> 0) | 0
            if (skIdx > 7) skIdx = 7
            if (pList !== 0) STATLIST_SetStat113c(m, pList, 0xbc, skIdx, (div3 + rem3 * 8) | 0)
          } else {
            ITEMS_DecodeAndSetSaveStat113c(m, nSaveSlot, ver, pIsc, bs, pList, statId)
          }
          break
        }
        case 20:
        case 21:
        case 22: {
          if (ver <= 0x5c) {
            const cStat = caseId === 20 ? 0xc3 : caseId === 21 ? 0xc6 : 0xc9
            const raw21 = bitStreamReadU113c(m, bs, 21)
            const skId = raw21 & 0x1ff
            const lvl = (raw21 >> 9) & 0x1f
            const val = (raw21 >> 14) & 0x7f
            if (pList !== 0) STATLIST_SetStat113c(m, pList, cStat, val, ((skId << 6) + lvl) | 0)
          } else {
            ITEMS_DecodeAndSetSaveStat113c(m, nSaveSlot, ver, pIsc, bs, pList, statId)
          }
          break
        }
        case 23: {
          if (ver <= 0x5c) {
            const rawChg = bitStreamReadU113c(m, bs, ver <= 0x49 ? 29 : 30)
            const skId = rawChg & 0x1ff
            const mask = m.u8((dtNow + 0xc70) >>> 0)
            const lvl = ((rawChg >> 9) & mask) & 0x1f
            const shift = m.u32((dtNow + 0xc6c) >>> 0)
            const layer = (shl32(skId, shift) + lvl) | 0
            const cur = (rawChg >> 14) & 0xff
            const max = (rawChg >> 22) & 0xff
            if (pList !== 0) STATLIST_SetStat113c(m, pList, 0xcc, ((max << 8) + cur) | 0, layer)
          } else {
            ITEMS_DecodeAndSetSaveStat113c(m, nSaveSlot, ver, pIsc, bs, pList, statId)
          }
          break
        }
        default: {
          ITEMS_DecodeAndSetSaveStat113c(m, nSaveSlot, ver, pIsc, bs, pList, statId)
          break
        }
      }

      prevStat = statId
      statId = bitStreamReadU113c(m, bs, 9) | 0
    }

    if (ver <= 0x5c && pList !== 0) {
      const dt2 = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
      const nIscCount2 = m.u32((dt2 + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0
      const pIscBase2 = m.u32((dt2 + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0)
      const pIsc53 = nIscCount2 > 0x53 ? (pIscBase2 + 0x690c) >>> 0 : 0
      const v0 = pIsc53 !== 0 ? getBaseStatWithMinFromList113c(m, pList, 0x530000, pIsc53) | 0 : 0
      if (v0 > 0) {
        const v1 = pIsc53 !== 0 ? getBaseStatWithMinFromList113c(m, pList, 0x530001, pIsc53) | 0 : 0
        const v2 = pIsc53 !== 0 ? getBaseStatWithMinFromList113c(m, pList, 0x530002, pIsc53) | 0 : 0
        const v3 = STATLIST_GetStatValue113c(m, pList, 0x53, 3) | 0
        const v4 = STATLIST_GetStatValue113c(m, pList, 0x53, 4) | 0
        if (v1 === v0 && v2 === v0 && v3 === v0 && v4 === v0) {
          for (let cls = 0; cls < 7; cls++) {
            const pStatHdr = (pList + 0x24) >>> 0
            const key = (0x530000 + cls) >>> 0
            const slotIdx = STATLIST_FindStatIndex113c(m, pStatHdr, key) | 0
            if (slotIdx >= 0) {
              const pArr = m.u32(pStatHdr)
              const delta = (-(m.u32((pArr + imul32(slotIdx, 8) + 4) >>> 0) | 0)) | 0
              if (delta !== 0) {
                removeStatSlot(m, pStatHdr, slotIdx)
                STATLIST_PropagateDelta113c(m, pList, 0x53, cls, delta)
                if ((m.u32((pList + 0x10) >>> 0) | 0) < 0 && m.u32((pList + 0x08) >>> 0) === 0) {
                  STATLIST_RecordModStat113c(m, pList, key)
                }
              }
            }
          }
          STATLIST_SetStat113c(m, pList, 0x7f, v0, 0)
        }
      }
    }
  }

  return bFailed === 0 ? 1 : -1
}

/**
 * `@va D2Common:0x6FD7C0C0` (`ITEMS_ReadCompactEarItemFromBitstream`,
 * custom `eax = pItem, edi = pBitStream`, stack `[esp+4]=bHasCoords, [esp+8]=nVersion`, `ret 8` -> `1 | -1`).
 */
export function ITEMS_ReadCompactEarItemFromBitstream113c(
  m: Memory113c,
  pItem: number,
  pBitStream: number,
  bHasCoords: number,
  nVersion: number,
): number {
  const item = pItem >>> 0
  const bs = pBitStream >>> 0
  const fmt = bitStreamReadU113c(m, bs, 10)
  if (item === 0) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x1510)
  }
  if (m.u32(item) !== 4) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x1511)
  }
  const pItemData = m.get(item, D2UnitStrc.pUnitData) >>> 0
  if (pItemData === 0) {
    throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x1513)
  }
  m.setU16((pItemData + 0x30) >>> 0, fmt & 0xffff)

  const mode = bitStreamReadU113c(m, bs, 3)
  if (mode === 3 || mode === 5) {
    const posX = bitStreamReadU113c(m, bs, 16)
    const unitType = m.u32(item) | 0
    if (unitType !== 2 && (unitType <= 3 || unitType > 5)) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\UNITS\\Units.cpp', 0x6fa)
    }
    const pPath = m.get(item, D2UnitStrc.pPath) >>> 0
    m.setU32((pPath + 0x0c) >>> 0, posX)
    const posY = bitStreamReadU113c(m, bs, 16)
    const unitType2 = m.u32(item) | 0
    if (unitType2 !== 2 && (unitType2 <= 3 || unitType2 > 5)) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\UNITS\\Units.cpp', 0x711)
    }
    m.setU32((m.get(item, D2UnitStrc.pPath) + 0x10) >>> 0, posY)
  } else {
    const bodyLoc = bitStreamReadU113c(m, bs, 4)
    if (m.u32(item) === 4 && m.get(item, D2UnitStrc.pUnitData) !== 0) {
      m.setU8((m.get(item, D2UnitStrc.pUnitData) + 0x44) >>> 0, bodyLoc & 0xff)
    }
    const gX = bitStreamReadU113c(m, bs, 4)
    UNITS_SetStaticPathPosX113c(m, item, gX)
    const gY = bitStreamReadU113c(m, bs, 4)
    UNITS_SetStaticPathPosY113c(m, item, gY)
    const page = ((bitStreamReadU113c(m, bs, 3) - 1) | 0) & 0xff
    if (m.u32(item) === 4 && m.get(item, D2UnitStrc.pUnitData) !== 0) {
      m.setU8((m.get(item, D2UnitStrc.pUnitData) + 0x45) >>> 0, page)
    }
  }

  changeAnimModeMem113c(m, item, mode)
  const cmdFlags = m.u32(item) === 4 && m.get(item, D2UnitStrc.pUnitData) !== 0
    ? m.u32((m.get(item, D2UnitStrc.pUnitData) + 0x18) >>> 0) >>> 0
    : 0
  if ((cmdFlags & 0x10000) !== 0) {
    const earCls = bitStreamReadU113c(m, bs, 3)
    ITEMS_SetItemCell113c(m, item, earCls)
    const earLvl = bitStreamReadU113c(m, bs, 7)
    if (m.u32(item) === 4 && m.get(item, D2UnitStrc.pUnitData) !== 0) {
      m.setU8((m.get(item, D2UnitStrc.pUnitData) + 0x48) >>> 0, earLvl & 0xff)
    }
    const namePtr = m.u32(item) === 4 && m.get(item, D2UnitStrc.pUnitData) !== 0
      ? (m.get(item, D2UnitStrc.pUnitData) + 0x4a) >>> 0
      : 0
    for (let p = namePtr; ; p = (p + 1) >>> 0) {
      const ch = bitStreamReadU113c(m, bs, 7) & 0xff
      m.setU8(p, ch)
      if (ch === 0) break
    }
  } else {
    const code = bitStreamReadU113c(m, bs, 32)
    const idx = fogGetLinkIndex113c(m, m.u32(D2COMMON_ITEMS_CODE_LINK_VA_113C), code)
    m.set(item, D2UnitStrc.dwClassId, idx >>> 0)
    if (ITEMS_CheckItemTypeIdMem113c(m, item, 4) !== 0) {
      const bitsGold = bitStreamReadU113c(m, bs, 1) !== 0 ? 32 : 12
      const goldVal = bitStreamReadU113c(m, bs, bitsGold)
      STATLIST_SetUnitStat113c(m, item, 0x0e, goldVal, 0)
    }
    if (ITEMS_CheckItemTypeIdMem113c(m, item, 0x16) !== 0) {
      if (code === 0x20637374) {
        if (m.u32(item) === 4 && m.get(item, D2UnitStrc.pUnitData) !== 0) {
          m.setU16((m.get(item, D2UnitStrc.pUnitData) + 0x3e) >>> 0, 0)
        }
      } else if (code === 0x20637369) {
        if (m.u32(item) === 4 && m.get(item, D2UnitStrc.pUnitData) !== 0) {
          m.setU16((m.get(item, D2UnitStrc.pUnitData) + 0x3e) >>> 0, 1)
        }
      }
    }
  }

  const ver = nVersion >>> 0
  if (ver > 0x5c) {
    const baseCode = ITEMS_GetBaseCode113c(m, item)
    const mIdx = fogGetLinkIndex113c(m, m.u32(D2COMMON_ITEMS_CODE_LINK_VA_113C), baseCode)
    if (mIdx < 0) return -1
    const pMisc = (m.u32(0x6fdefb98) + imul32(mIdx, 0x1a8)) >>> 0
    if (pMisc === 0) return -1
    if (m.u8((pMisc + 0x12a) >>> 0) !== 0 && m.u8((pMisc + 0x12b) >>> 0) !== 0) {
      const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
      if ((m.u32((sgpt + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0) <= 0x164) {
        throw new D2CommonAssertError(ITEMMODS_ASSERT_FILE_113C, 0x1608)
      }
      const pIsc164 = (m.u32((sgpt + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0) + 0x1c290) >>> 0
      const raw = bitStreamReadU113c(m, bs, m.u8((pIsc164 + 0x19) >>> 0)) | 0
      const shift = m.u8((pIsc164 + 0x18) >>> 0) & 31
      const val = ((raw - (m.u32((pIsc164 + 0x1c) >>> 0) | 0)) << shift) | 0
      const listEx = m.get(item, D2UnitStrc.pStatListEx) >>> 0
      let pList = 0
      if (listEx !== 0 && (m.get(listEx, D2StatListStrc.dwFlags) | 0) < 0) {
        let cur = m.u32((listEx + 0x3c) >>> 0) >>> 0
        while (cur !== 0) {
          if ((m.u8((cur + 0x10) >>> 0) & 0x40) !== 0) {
            pList = cur
            break
          }
          cur = m.u32((cur + 0x2c) >>> 0) >>> 0
        }
      }
      if (pList === 0) {
        pList = m.alloc(D2StatListStrc_SIZE) >>> 0
        if (pList !== 0) {
          m.fill(pList, D2StatListStrc_SIZE, 0)
          m.set(pList, D2StatListStrc.pMemPool, m.get(item, D2UnitStrc.pMemPool))
          m.set(pList, D2StatListStrc.eOwnerType, 4)
          m.set(pList, D2StatListStrc.dwOwnerId, m.get(item, D2UnitStrc.dwUnitId))
          m.set(pList, D2StatListStrc.dwFlags, 0x40)
          m.set(pList, D2StatListStrc.dwExpireFrame, 0)
        }
        mergeSubListMem113c(m, item, pList, 1)
      }
      if (pList !== 0) {
        STATLIST_SetStat113c(m, pList, 0x164, val, 0)
      }
    }
  }

  if ((bHasCoords | 0) !== 0 && ver > 0x56) {
    if (bitStreamReadU113c(m, bs, 1) !== 0) {
      const s0 = bitStreamReadU113c(m, bs, 32)
      const s1 = bitStreamReadU113c(m, bs, 32)
      if (m.u32(item) === 4 && m.get(item, D2UnitStrc.pUnitData) !== 0) {
        const pd = m.get(item, D2UnitStrc.pUnitData) >>> 0
        m.setU32((pd + 0x1c) >>> 0, s0 >>> 0)
        m.setU32((pd + 0x20) >>> 0, s1 >>> 0)
      }
      if (ver > 0x5d) {
        bitStreamReadU113c(m, bs, 32)
      }
    }
  }

  m.setU32((item + 0x28) >>> 0, 0)
  m.setU32((item + 0x20) >>> 0, 0)
  m.setU32((item + 0x24) >>> 0, 0x29a)
  if (m.u32(item) === 4 && m.get(item, D2UnitStrc.pUnitData) !== 0) {
    const pd = m.get(item, D2UnitStrc.pUnitData) >>> 0
    m.setU32((pd + 0x2c) >>> 0, 1)
    m.setU32(pd, 2)
  }
  return 1
}

/**
 * `@va D2Common:0x6FD7C470` (`D2Common.#11145` `ITEMS_LoadStatsFromBitstream`,
 * stdcall `[esp+4]=pItem, [esp+8]=pBuf, [esp+C]=nSize, [esp+10]=bHasVersionCoords,
 * [esp+14]=pOutSockets, [esp+18]=nVersion, [esp+1C]=pOutFailed`, `ret 0x1C` -> `dwBytesRead`).
 */
export function ITEMS_LoadStatsFromBitstream113c(
  m: Memory113c,
  pItem: number,
  pBuf: number,
  nSize: number,
  bHasVersionCoords: number,
  pOutSockets: number,
  nVersion: number,
  pOutFailed: number,
): number {
  const sm = withBitStreamScratch113c(m)
  const pBitBuf = BITSTREAM_STACK_BASE
  bitStreamInit113c(sm, pBitBuf, pBuf, nSize)
  const hasHdr = bHasVersionCoords | 0
  const outFail = pOutFailed >>> 0
  if (hasHdr !== 0) {
    const sig = bitStreamReadS113c(sm, pBitBuf, 0x10)
    if (sig !== 0x4d4a) {
      sm.setU32(outFail, 1)
      return 0
    }
  }
  sm.setU32(outFail, 0)
  let rawFlags = bitStreamReadU113c(sm, pBitBuf, 32) >>> 0
  let bSimple = 0
  if ((rawFlags & 0x2000000) !== 0) {
    bSimple = 1
    rawFlags = (rawFlags & 0xfdffffff) >>> 0
  }

  const item = pItem >>> 0
  if (item !== 0 && sm.u32(item) === 4) {
    const pd = sm.get(item, D2UnitStrc.pUnitData) >>> 0
    if (pd !== 0) {
      sm.setU32((pd + 0x18) >>> 0, rawFlags >>> 0)
      const b1a = sm.u8((pd + 0x1a) >>> 0) & 0xf7
      sm.setU8((pd + 0x1a) >>> 0, b1a)
      sm.setU32((pd + 0x2c) >>> 0, 1)
      sm.setU16((pd + 0x38) >>> 0, 0)
      sm.setU16((pd + 0x3e) >>> 0, 0)
      sm.setU16((pd + 0x3a) >>> 0, 0)
      sm.setU16((pd + 0x40) >>> 0, 0)
      sm.setU16((pd + 0x3c) >>> 0, 0)
      sm.setU16((pd + 0x42) >>> 0, 0)
      sm.setU16((pd + 0x32) >>> 0, 0)
      sm.setU16((pd + 0x34) >>> 0, 0)
    }
  }

  let res = 0
  if ((rawFlags & 0x200000) !== 0) {
    res = ITEMS_ReadCompactEarItemFromBitstream113c(sm, item, pBitBuf, hasHdr, nVersion)
    if ((pOutSockets >>> 0) !== 0) {
      sm.setU32(pOutSockets >>> 0, 0)
    }
  } else {
    res = ITEMS_ReadItemBitstream113c(sm, item, pBitBuf, hasHdr, bSimple, pOutSockets, nVersion)
  }
  if ((res | 0) <= 0) {
    sm.setU32(outFail, 1)
  }
  const bytesRead = bitStreamGetBytePos113c(sm, pBitBuf)
  return bytesRead >>> 0
}

const SET_ITEM_STATES_6FDDCA08 = [0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa] as const

/**
 * `D2Common.dll` `0x6FD7C630` (internal `__usercall(pUnit@<eax>, pItem, nMode)`).
 * Allocates, updates, or removes a set-item state statlist (`0xA5..0xAA`, stat `0x47`) on `pUnit`.
 */
export function ITEMMODS_ToggleSetItemStateList113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
  nMode: number,
): number {
  const mode = nMode | 0
  if (mode > 1) return 0
  const unit = pUnit >>> 0
  const item = pItem >>> 0
  if (unit === 0 || item === 0 || m.u32(item) !== 4) return 0
  if (ITEMS_GetItemQuality113c(m, item) !== 5) return 0
  if (m.u32(unit) === 4 && ITEMS_IsHighQualityItem113c(m, item) !== 0) return 0

  const setItemId = ITEMS_GetItemCell113c(m, item)
  const pSetItem = DATATBLS_GetSetItemsTxtRecordInline113c(m, setItemId)
  if (pSetItem === 0) return 0
  const setId = (m.u16((pSetItem + 0x2c) >>> 0) << 16) >> 16
  if (setId < 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (setId >= (m.u32((sgpt + 0xc10) >>> 0) | 0)) return 0

  let freeSlot = -1
  let pFoundList = 0
  let foundState = 0
  for (let i = 0; i < 6; i++) {
    const state = SET_ITEM_STATES_6FDDCA08[i]!
    const pList = STATLIST_GetStatListFromUnitAndState113c(m, unit, state)
    if (pList !== 0) {
      if (STATLIST_GetStatValue113c(m, pList, 0x47, 0) === setId) {
        pFoundList = pList
        foundState = state
        if (mode === 0) {
          STATLIST_ClearBaseStats113c(m, pList)
        }
        break
      }
    } else if (freeSlot < 0) {
      freeSlot = i
    }
  }

  if (pFoundList === 0) {
    if (mode === 1 || freeSlot < 0) return 0
    const state = SET_ITEM_STATES_6FDDCA08[freeSlot]!
    pFoundList = STATLIST_AllocList113c(
      m,
      m.u32((unit + 0x08) >>> 0),
      0,
      0,
      m.u32(item),
      m.u32((item + 0x0c) >>> 0),
    )
    STATLIST_MergeStatLists113c(m, unit, pFoundList, 1)
    if (pFoundList !== 0) {
      m.setU32((pFoundList + 0x14) >>> 0, state >>> 0)
    }
    foundState = state
  }

  if (mode === 0) {
    STATLIST_AddStat113c(m, pFoundList, 0x47, setId, 0)
    ITEMMODS_ApplySetItemBonusProps113c(m, item, unit, foundState)
    return 1
  }
  if (mode === 1) {
    STATLIST_UnlinkSubList113c(m, unit, pFoundList)
    STATLIST_FreeStatListIfNonExtended113c(m, pFoundList)
    return 1
  }
  return 1
}

/**
 * `D2Common.dll` `0x6FD7C910` (Ord `10600`, `__stdcall(pUnit, pItem, nMode, nFlag)`).
 */
export function ITEMMODS_UpdateSetItemEquipmentState113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
  nMode: number,
  nFlag: number,
): number {
  const unit = pUnit >>> 0
  if (unit === 0) return 0
  const item = pItem >>> 0
  if (item === 0 || m.u32(item) !== 4) return 0
  const pInv = m.u32((unit + 0x60) >>> 0)
  if (pInv === 0) return 0

  let mask = 0
  const pNode = INVENTORY_GetItemIfOwnedByInventory113c(m, pInv, item)
  if (pNode !== 0 && INVENTORY_GetItemNodePositionOther113c(m, pNode) === 3) {
    mask = ITEMS_GetEquippedSetItemsMask113c(m, unit, item, 1)
  }

  const mode = nMode | 0
  if ((nFlag | 0) !== 0 || mode === 0) {
    ITEMMODS_UpdateSetItemBonusStates113c(m, item, mask)
  }
  ITEMMODS_ToggleSetItemStateList113c(m, unit, item, mode)
  return 1
}





