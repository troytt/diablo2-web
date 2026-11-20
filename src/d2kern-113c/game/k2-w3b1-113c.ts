/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 3 Batch 1 (`w3b1`) routines across
 * `0x6FC21FE0..0x6FC38CE0` (45 functions):
 * - Storm `TSExplicitList` destructor (`0x6FC21FE0`)
 * - Object region monster shrine base ID resolver & `D2ObjectControlStrc` initializer (`0x6FC2B510..0x6FC2B9A0`)
 * - `SKILLS` summon param setup, Putrid Defiler impregnate (`0x6E`), aura stat application, split-spawn,
 *   pack-leader life leech, Siege Beast / Imp mount & dismount, and Inferno hose (`0x6FC2BF90..0x6FC2DE70`)
 * - `ITEMS` drop struct population, ground placement, unique spawn bitmask, quality/affix/mod generation,
 *   sub-inventory population, vendor/gamble generation, and ear creation (`0x6FC2E410..0x6FC348A0`)
 * - `AI` target selection callbacks and monster AI thinkers (`0x6FC359B0..0x6FC38CE0`)
 */

import { COLLISION_FindFreePositionBasic113c } from '../common/collision.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import {
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordListIndexAtSubtile113c,
} from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { imul32, mulDiv113c, sdiv32 } from '../common/int-math.ts'
import {
  ITEMS_ApplyItemQualityMods113c,
  ITEMS_CanItemLoseDurability113c,
  ITEMS_CheckAffixAssignableToItem113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_CheckQualityItemMatch113c,
  ITEMS_EvalItemPropertyList113c,
  ITEMS_GetClassOfClassSpecificItem113c,
  ITEMS_GetCommandFlags113c,
  ITEMS_GetEarLevel113c,
  ITEMS_GetEarName113c,
  ITEMS_GetItemCell113c,
  ITEMS_GetItemFormat113c,
  ITEMS_GetItemLevel113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemSeed113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_GetOwnerGuid113c,
  ITEMS_GetTwoHandedFlag113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items.ts'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  ITEMS_CheckIfThrowItemMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetTotalFrames113c,
} from '../common/missile.ts'
import {
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
  PATH_SetNewDistance113c,
  PATH_SetTargetPos113c,
} from '../common/path.ts'
import { UNITS_InitStaticPathCoords113c } from '../common/quest-record.ts'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetParam1113c,
  SKILLS_GetParam2113c,
  SKILLS_GetParam3113c,
  SKILLS_GetParam4113c,
  SKILLS_GetSkillById113c,
  SKILLS_SetParam1113c,
  SKILLS_SetParam2113c,
  SKILLS_SetParam3113c,
  SKILLS_SetParam4113c,
  STATES_UpdateOrClearState98Transform113c,
} from '../common/skills.ts'
import {
  ITEMS_SetItemCell113c,
  STATES_CheckState113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetStatListFromUnitStateAndFlag113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  UNITROOM_SortUnitListByY113c,
  UNITS_AreUnitsAligned113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetApproximateDistance113c,
  UNITS_GetMonsterSplitSpawnParams113c,
  UNITS_GetRoom113c,
  UNITS_SetCollisionMaskAtCoords113c,
  UNIT_GetAlignment113c,
} from '../common/unit.ts'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { SEED_InitLowSeed113c, SEED_InitSeed113c, seedRoll } from '../prng.ts'
import {
  DATATBLS_GetBeltsTxtRecord113c,
  DATATBLS_GetBeltsTxtRecordCountPtr113c,
  DATATBLS_GetBooksTxtRecordCountPtr113c,
  DATATBLS_GetItemsTxtRecordByCode113c,
  DATATBLS_GetLevelMonsterLevel113c,
  DATATBLS_GetObjGroupTxtRecord113c,
  DATATBLS_GetObjGroupTxtRecordCount113c,
  ITEMS_GetBaseLevel113c,
  MONSTERS_IsDead113c,
} from '../tables/datatbls-113c.ts'
import {
  DATATBLS_GetItemDataTables113c,
  DATATBLS_GetMagicAffixDataTables113c,
  DATATBLS_GetRareAffixDataTables113c,
} from '../tables/item-tbls-113c.ts'
import { DATATBLS_GetLevelsTxtRecord113c } from '../tables/lvl-tbls-113c.ts'
import {
  AIGENERAL_GetPackLeaderUnit113c,
  AI_CastSkillMode14_113c,
  AI_CastSkillWithMode113c,
  AI_StartAttackMode113c,
  SUNITDMG_FreeAttackerCombatList113c,
} from './ai-fallen-113c.ts'
import { D2GAME_SUNIT_IterateAllLivingPlayers113c } from './boot-init-gap-b-113c.ts'
import {
  SUNITDMG_DistributeExperience113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_FindCombatDamageData113c,
} from './combat-a1c-113c.ts'
import {
  D2GAME_CreateItemEx_6FC31490_113c,
  ITEMS_RollStaffModsOnItem_6FC33DE0_113c,
} from './k2-real-itemdrop-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import { STATES_CreateOrUpdateAuraStatList113c } from './k2-gap-itemdef-113c.ts'
import {
  type K2GapMeleeDotHooks113c,
  MISSILE_CreateServerProjectile113c,
  SEED_RollRangeWithMinFast113c,
} from './k2-gap-melee-dot-113c.ts'
import {
  AI_SelectBaalThroneSpawnClassId113c,
  ITEMS_HasAffixGroupOnItem113c,
  ITEMS_ScaleStatByPercentWithMin113c,
} from './k2-items-tc-w1-113c.ts'
import {
  type LaneH0x6fc2Hooks113c,
  MONSTER_GetAiGeneralPtr_6FC218E0_113c,
  SKILLS_CanMonsterBeImpregnated_6FC2C110_113c,
  STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c,
  STORM_TSListUnlinkAll_6FC22180_113c,
} from './k2-laneH-0x6fc2-w1-113c.ts'
import {
  AI_CastNextPatrolPointSkill_6FC35F90_113c,
  AI_CountNearbyMinion453Or461Callback_6FC35890_113c,
  ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c,
  ITEMS_CheckItemTxtSpawnable_6FC2F180_113c,
  ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c,
  type LaneIHooks113c,
  SKILLS_ResetUnitAiThinkEvent_6FC2DE20_113c,
} from './k2-laneI-0x6fc3-w1-113c.ts'
import {
  type LaneJKernHooks113c,
  QUESTS_TriggerItemPickedUp_6FC54510_113c,
} from './k2-laneJ-0x6fc4-w1-113c.ts'
import { SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c } from './k2-laneL-0x6fc6-w1-113c.ts'
import { SUNIT_GetOwnerUnit113c } from './k2-sunit-spawn-w1-113c.ts'
import { ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c } from './k2-w2b1-113c.ts'
import { SKILLS_ResolveSummonMonsterId_6FCBEE50_113c } from './k2-w2b5-113c.ts'
import { SKILLS_InitInfernoSeqFrames_6FCD3270_113c } from './k2-w2b6-113c.ts'
import {
  AI_StartModeAtCoordsKeepSteps_6FD121E0_113c,
  type K2W2B8Hooks113c,
  SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c,
} from './k2-w2b8-113c.ts'
import {
  MONSTER_ClearModeEvents113c,
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events.ts'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_CheckFlagBit113c,
  MONSTER_CheckSpawnTileFree113c,
  MONSTER_Create113c,
  MONSTER_GetBaseIdFromUnit113c,
  MONSTER_SpawnAtCoords113c,
  type RegpopSpawnHooks113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_CalcSqDistSubtiles113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import { SUNIT_FreeUnit113c } from './replay-final11-113c.ts'
import {
  AIGENERAL_CopyAiCommandParams113c,
  AIGENERAL_PopAiCommand113c,
  AI_ApproachTarget113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
} from './replay-kernel-113c.ts'
import {
  EVENT_CreateNodeWithGrowth113c,
  EVENT_DeleteEventByArg14_113c,
  EVENT_FreeNode113c,
  EVENT_PARTITION_BY_UNIT_TYPE_113C,
  EVENT_SetEventFull113c,
} from './timer-wheel.ts'
import { UNITS_GetOctileDistanceToCoordinates113c } from './town-npc-ai-113c.ts'
import { AITARGET_ScanUnitsByModeTable113c } from './town-runtime-gap-113c.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

export type D2KernMemory113c = Memory113c

export interface K2W3B1Hooks113c
  extends LaneH0x6fc2Hooks113c,
    LaneIHooks113c,
    Omit<K2W2B8Hooks113c, 'onMonsterStartMode'> {
  readonly laneJ?: LaneJKernHooks113c
  readonly meleeDot?: K2GapMeleeDotHooks113c
  readonly regpop?: RegpopSpawnHooks113c
  readonly w2b8?: K2W2B8Hooks113c
}

const OBJRGN_CPP_VA_113C = 0x6fd1d174
const D2GAME_GDW_GOLD_CLASS_ID_VA_113C = 0x6fd31f94

let k2W3B1StackPtr = 0x7e0e0000

function sx8(v: number): number {
  return (v << 24) >> 24
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function getDataTablesPtr113c(m: D2KernMemory113c): number {
  return m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
}

function readSgptDataTables113c(...args: Parameters<typeof getDataTablesPtr113c>): ReturnType<typeof getDataTablesPtr113c> {
  return getDataTablesPtr113c(...args)
}

function readGdwBitMasks113c(m: D2KernMemory113c, nBitIndex: number): number {
  const pTable = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  if (pTable === 0) {
    return (1 << (nBitIndex & 31)) >>> 0
  }
  return m.u32((pTable + ((nBitIndex & 31) << 2)) >>> 0) >>> 0
}

function allocZeroedScratch113c(m: D2KernMemory113c, size: number): number {
  const ptr = m.alloc(size) >>> 0
  m.fill(ptr, size, 0)
  return ptr
}

function lookupSkillsTxtNonNull113c(m: D2KernMemory113c, nSkillId: number): number {
  const id = nSkillId | 0
  if (id < 0) return 0
  const pDataTables = getDataTablesPtr113c(m)
  if (pDataTables === 0) return 0
  const count = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (id >= count) return 0
  const base = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (base === 0) return 0
  return (base + imul32(id, 0x23c)) >>> 0
}

function DATATBLS_GetSkillsTxtRecord113c(...args: Parameters<typeof lookupSkillsTxtNonNull113c>): ReturnType<typeof lookupSkillsTxtNonNull113c> {
  return lookupSkillsTxtNonNull113c(...args)
}

function STATLIST_AllocStatList113c(
  m: D2KernMemory113c,
  _hPool: number,
  dwFlags: number,
  dwExpireFrame: number,
  dwOwnerType: number,
  dwOwnerId: number,
): number {
  return STATLIST_AllocList113c(m, dwFlags, dwOwnerType, dwOwnerId, 0, dwExpireFrame) >>> 0
}

function STATLIST_SetStatIfListIsValid113c(
  m: D2KernMemory113c,
  pStatList: number,
  nStatId: number,
  nValue: number,
  nLayer: number,
): number {
  if (pStatList === 0) {
    return 0
  }
  return STATLIST_SetStat113c(m, pStatList, nStatId, nValue, nLayer)
}

function rollSeedPtrViaSeedRoll113c(m: D2KernMemory113c, pSeed: number, nMax: number): number {
  const addr = pSeed >>> 0
  if (addr === 0) return 0
  const max = nMax | 0
  if (max <= 0) return 0
  const seed = { lo: m.u32(addr), hi: m.u32((addr + 0x04) >>> 0) }
  if (((max - 1) & max) === 0) {
    const raw = stepSeed64At113c(m, addr)
    return (raw & (max - 1)) >>> 0
  }
  const res = seedRoll(seed, max)
  m.setU32(addr, seed.lo >>> 0)
  m.setU32((addr + 0x04) >>> 0, seed.hi >>> 0)
  return res >>> 0
}

function stepSeed64At113c(m: D2KernMemory113c, pSeed: number): number {
  const addr = pSeed >>> 0
  const lo = m.u32(addr) >>> 0
  const hi = m.u32((addr + 0x04) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((addr + 0x04) >>> 0, newHi)
  m.setU32(addr, newLo)
  return newLo
}

function readUnitPosXInline113c(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const uType = m.u32(u) | 0
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    return pPath !== 0 ? m.u32((pPath + 0x0c) >>> 0) | 0 : 0
  }
  return pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
}

function readUnitPosYInline113c(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const uType = m.u32(u) | 0
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    return pPath !== 0 ? m.u32((pPath + 0x10) >>> 0) | 0 : 0
  }
  return pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
}

function copyCStringToMem113c(m: D2KernMemory113c, pDst: number, pSrc: number): void {
  let dst = pDst >>> 0
  let src = pSrc >>> 0
  while (true) {
    const ch = m.u8(src)
    src = (src + 1) >>> 0
    m.setU8(dst, ch)
    dst = (dst + 1) >>> 0
    if (ch === 0) break
  }
}

/**
 * [1/45] Unlinks all nodes in Storm `TSExplicitList` at `pList` (`0x6FC22180`) and then unlinks
 * the list's own terminator link (`pList + 0x04`), zeroing `[pList + 0x04]` and `[pList + 0x08]`.
 *
 * @va D2Game:0x6FC21FE0
 */
export function STORM_TSListDestroy_6FC21FE0_113c(
  m: D2KernMemory113c,
  pList: number,
): void {
  hitD2GameVa113c(0x6FC21FE0)
  const list = pList >>> 0
  STORM_TSListUnlinkAll_6FC22180_113c(m, list)
  const pTerm = (list + 0x04) >>> 0
  const pPrevLink = m.u32(pTerm) >>> 0
  if (pPrevLink !== 0) {
    const rawNext = m.u32((pTerm + 0x04) >>> 0) >>> 0
    let pNextTargetLink: number
    if ((rawNext | 0) < 0) {
      pNextTargetLink = (~rawNext) >>> 0
    } else {
      const pPrevNextNode = m.u32((pPrevLink + 0x04) >>> 0) >>> 0
      const computedOff = (pTerm - pPrevNextNode) >>> 0
      pNextTargetLink = (rawNext + computedOff) >>> 0
    }
    m.setU32(pNextTargetLink, pPrevLink)

    const ecxPrev = m.u32(pTerm) >>> 0
    const edxNext = m.u32((pTerm + 0x04) >>> 0) >>> 0
    m.setU32((ecxPrev + 0x04) >>> 0, edxNext)
    m.setU32(pTerm, 0)
    m.setU32((pTerm + 0x04) >>> 0, 0)
  }
}

const SHRINE_COMMON_BASE_IDS_113C: readonly number[] = [
  0x00,
  0xaa,
  0x112,
  0x17b,
  0x17f,
  0x183,
]

/**
 * [2/45] Resolves and caches `pObjectRegion->nShrineMonsterClassId` (`+0x1C`) for the level
 * containing `pArgs->pUnit` (`+0x04`) in `pArgs->pGame` (`+0x00`, `eax = pArgs`):
 * returns the cached class ID if `0 <= id < nMonStatsCount`, or scans `pGame->pMonReg[nLevelId]`
 * entries (`+0x14`, stride `0x34`, count `u8 [+0x10]`) against act-specific (`0x60` in Act 2 vs `0x05`)
 * and common monster family ranges (`[0x00, 0xAA, 0x112, 0x17B, 0x17F, 0x183]`), defaulting to `0xEA`.
 *
 * @va D2Game:0x6FC2B510
 */
export function OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c(
  m: D2KernMemory113c,
  pArgs: number,
): number {
  hitD2GameVa113c(0x6FC2B510)
  const args = pArgs >>> 0
  const pUnit = m.u32((args + 0x04) >>> 0) >>> 0
  const pRoom = UNITS_GetRoom113c(m, pUnit)
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff

  const pGame = m.u32(args) >>> 0
  const pObjectCtrl = m.u32((pGame + 0x10f0) >>> 0) >>> 0
  const pRegion = m.u32((pObjectCtrl + imul32(nLevelId, 4) + 0x48) >>> 0) >>> 0
  const cachedId = m.u32((pRegion + 0x1c) >>> 0) | 0
  if (cachedId >= 0) {
    const pDataTables = getDataTablesPtr113c(m)
    const nMonStatsCount = pDataTables !== 0 ? m.u32((pDataTables + 0xa80) >>> 0) | 0 : 0
    if (cachedId < nMonStatsCount) {
      return m.u32((pRegion + 0x1c) >>> 0) | 0
    }
  }

  const actBase = nAct === 1 ? 0x60 : 0x05
  const pMonReg = m.u32((pGame + imul32(nLevelId, 4) + 0xf0) >>> 0) >>> 0
  m.setU32((pRegion + 0x1c) >>> 0, 0xea)

  const nMonCount = m.u8((pMonReg + 0x10) >>> 0)
  if (nMonCount > 0) {
    let pEntry = (pMonReg + 0x14) >>> 0
    for (let i = 0; i < nMonCount; i++) {
      const wMonId = sx16(m.u16(pEntry))
      if (wMonId >= actBase && wMonId < actBase + 5) {
        m.setU32((pRegion + 0x1c) >>> 0, actBase >>> 0)
        return actBase
      }
      for (let j = 0; j < 6; j++) {
        const base = SHRINE_COMMON_BASE_IDS_113C[j]!
        if (wMonId >= base && wMonId < base + 4) {
          m.setU32((pRegion + 0x1c) >>> 0, base >>> 0)
          return base
        }
      }
      pEntry = (pEntry + 0x34) >>> 0
    }
  }

  return m.u32((pRegion + 0x1c) >>> 0) | 0
}

/**
 * [3/45] Allocates and initializes `pGame->pObjectControl` (`+0x10F0`, size `0x1114`), seeds
 * `pObjectControl->pSeed` from `pGame->pSeed (+0xD0)`, allocates per-level `0x90`-byte
 * `D2ObjectRegionStrc` records (`1..nLevelsCount-1`), and builds the 8-bucket `ObjGroup.txt`
 * lookup arrays (`+0x08` counts, `+0x28` index arrays). Returns the stepped game seed low dword.
 *
 * @va D2Game:0x6FC2B9A0
 */
export function OBJRGN_AllocObjectControl_6FC2B9A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  hooks?: K2W3B1Hooks113c,
): number {
  hitD2GameVa113c(0x6FC2B9A0)
  const game = pGame >>> 0
  if (game === 0) {
    throw new D2CommonAssertError('', 0x29)
  }

  const pMemPool = m.u32((game + 0x1c) >>> 0) >>> 0
  const pObjectCtrl =
    hooks !== undefined && hooks.allocPoolMemory !== undefined
      ? hooks.allocPoolMemory(m, pMemPool, 0x1114, OBJRGN_CPP_VA_113C, 0x2a, 0) >>> 0
      : m.alloc(0x1114)

  m.setU32((game + 0x10f0) >>> 0, pObjectCtrl)
  SEED_InitSeed113c(m, pObjectCtrl)

  const newSeedLo = stepSeed64At113c(m, (game + 0xd0) >>> 0)
  SEED_InitLowSeed113c(m, pObjectCtrl, newSeedLo)

  m.setU32((pObjectCtrl + 0x48) >>> 0, 0)
  m.setU32((pObjectCtrl + 0x1110) >>> 0, 0)

  const pDataTables0 = getDataTablesPtr113c(m)
  let nLevelsCount = pDataTables0 !== 0 ? m.u32((pDataTables0 + 0xc5c) >>> 0) | 0 : 0
  let lvlId = 1
  if (nLevelsCount > 1) {
    let pRegionSlot = (pObjectCtrl + 0x4c) >>> 0
    while (lvlId < nLevelsCount) {
      const pool = m.u32((game + 0x1c) >>> 0) >>> 0
      const pRegion =
        hooks !== undefined && hooks.allocPoolMemory !== undefined
          ? hooks.allocPoolMemory(m, pool, 0x90, OBJRGN_CPP_VA_113C, 0x36, 0) >>> 0
          : m.alloc(0x90)
      const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, lvlId) >>> 0
      m.fill(pRegion, 0x90, 0)
      m.setU32((pRegion + 0x1c) >>> 0, 0xffffffff)
      const nAct = pLevelsTxt !== 0 ? m.u8((pLevelsTxt + 0x03) >>> 0) : 0
      m.setU8(pRegion, nAct)
      m.setU32((pRegion + 0x08) >>> 0, 0x7fffffff)
      m.setU32(pRegionSlot, pRegion)
      pRegionSlot = (pRegionSlot + 0x04) >>> 0

      const pDataTables = getDataTablesPtr113c(m)
      nLevelsCount = pDataTables !== 0 ? m.u32((pDataTables + 0xc5c) >>> 0) | 0 : 0
      lvlId = (lvlId + 1) | 0
    }
  }

  const nObjGroups = DATATBLS_GetObjGroupTxtRecordCount113c(m) | 0
  const bucketCounts = new Int32Array(8)
  if (nObjGroups > 0) {
    for (let i = 0; i < nObjGroups; i++) {
      const pObjGroup = DATATBLS_GetObjGroupTxtRecord113c(m, i) >>> 0
      if (pObjGroup !== 0) {
        const grpType = m.u8((pObjGroup + 0xb2) >>> 0)
        if (grpType < 8) {
          bucketCounts[grpType] = (bucketCounts[grpType]! + 1) | 0
        }
      }
    }
  }

  m.fill((pObjectCtrl + 0x1048) >>> 0, 0xc8, 0)
  m.fill((pObjectCtrl + 0x28) >>> 0, 0x20, 0)

  for (let b = 0; b < 8; b++) {
    const cnt = bucketCounts[b]!
    const slotOff = (pObjectCtrl + 0x08 + (b << 2)) >>> 0
    if (cnt > 0) {
      const pool = m.u32((game + 0x1c) >>> 0) >>> 0
      const byteSize = (cnt << 2) >>> 0
      const pArr =
        hooks !== undefined && hooks.allocPoolMemory !== undefined
          ? hooks.allocPoolMemory(m, pool, byteSize, OBJRGN_CPP_VA_113C, 0x54, 0) >>> 0
          : m.alloc(byteSize)
      m.setU32((slotOff + 0x20) >>> 0, pArr)
      m.fill(pArr, byteSize, 0)
    }
    m.setU32(slotOff, 0)
  }

  if (nObjGroups > 0) {
    for (let i = 0; i < nObjGroups; i++) {
      const pObjGroup = DATATBLS_GetObjGroupTxtRecord113c(m, i) >>> 0
      if (pObjGroup !== 0) {
        const grpType = m.u8((pObjGroup + 0xb2) >>> 0)
        if (grpType < 8) {
          const countAddr = (pObjectCtrl + 0x08 + (grpType << 2)) >>> 0
          const arrAddr = (pObjectCtrl + 0x28 + (grpType << 2)) >>> 0
          const idx = m.u32(countAddr) >>> 0
          const pArr = m.u32(arrAddr) >>> 0
          m.setU32((pArr + (idx << 2)) >>> 0, i >>> 0)
          m.setU32(countAddr, (idx + 1) >>> 0)
        }
      }
    }
  }

  return newSeedLo | 0
}

/**
 * [4/45] `skillsSrvStFuncTable[60]` (`__fastcall(pGame, pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * resolves summon monster class ID, spawn coords `(x, y)`, and anim mode via `0x6FCBEE50`
 * (`bIsMonsterSpawn = 1`), stores them in `pSkill` params `1..4`, and returns `1`.
 *
 * @va D2Game:0x6FC2BF90
 */
export function SKILLS_SrvSt60_InitSummonParams_6FC2BF90_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2BF90)
  const u = pUnit >>> 0
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, u)
  if (pSkill === 0) return 0

  const sp = k2W3B1StackPtr
  k2W3B1StackPtr = (sp + 0x10) >>> 0
  try {
    const pOutX = sp
    const pOutY = (sp + 0x04) >>> 0
    const pOutMode = (sp + 0x08) >>> 0
    m.setU32(pOutX, 0)
    m.setU32(pOutY, 0)
    m.setU32(pOutMode, 0)

    const nMonId = SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
      m,
      pOutY,
      pOutX,
      pOutMode,
      u,
      1,
      nSkillId | 0,
      nSkillLevel | 0,
    )
    SKILLS_SetParam1113c(m, pSkill, nMonId | 0)
    SKILLS_SetParam2113c(m, pSkill, m.u32(pOutX) | 0)
    SKILLS_SetParam3113c(m, pSkill, m.u32(pOutY) | 0)
    SKILLS_SetParam4113c(m, pSkill, m.u32(pOutMode) | 0)
    return 1
  } finally {
    k2W3B1StackPtr = sp
  }
}

/**
 * [5/45] `skillsSrvDoFuncTable[131]` (`__fastcall(pGame, pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * sets `UNITFLAG_SKILLEND (0x40)` on `pUnit`, validates path target, verifies target eligibility
 * via `0x6FC2C110`, and applies `STATE_IMPREGNATED (0x6E)` with removal handler `0x6FC2C000`.
 *
 * @va D2Game:0x6FC2C5D0
 */
export function SKILLS_SrvDo131_ImpregnateTarget_6FC2C5D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2C5D0)
  const pSkillsTxt = lookupSkillsTxtNonNull113c(m, nSkillId)
  if (pSkillsTxt === 0) return 0

  const u = pUnit >>> 0
  if (u !== 0) {
    m.setU32((u + 0xc4) >>> 0, (m.u32((u + 0xc4) >>> 0) | 0x40) >>> 0)
  }

  SUNIT_ValidatePathTargetUnit113c(m, u, pGame >>> 0)
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === u || pTarget === 0) return 0
  if (SKILLS_CanMonsterBeImpregnated_6FC2C110_113c(m, pTarget) === 0) return 0

  const sp = k2W3B1StackPtr
  k2W3B1StackPtr = (sp + 0x28) >>> 0
  try {
    m.fill(sp, 0x24, 0)
    m.setU32(sp, u)
    m.setU32((sp + 0x04) >>> 0, pTarget)
    m.setU32((sp + 0x08) >>> 0, nSkillId >>> 0)
    m.setU32((sp + 0x0c) >>> 0, nSkillLevel >>> 0)
    m.setU32((sp + 0x14) >>> 0, 0xffffffff)
    m.setU32((sp + 0x1c) >>> 0, 0x6e)
    m.setU32((sp + 0x20) >>> 0, 0x6fc2c000)
    STATES_CreateOrUpdateAuraStatList113c(m, sp)
    void STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c
    return 1
  } finally {
    k2W3B1StackPtr = sp
  }
}

/**
 * [6/45] Evaluates `SkillsTxt[nSkillId].dwAuraLenCalc` (`+0x60`), creates/updates the aura stat list
 * for `SkillsTxt.wAuraState` (`+0x82`) on `pTarget` via `0x6FCC00B0`, and populates aura stat calcs
 * via `0x6FC648E0` (`edi = nSkillId`, `edx = pTarget`, `ebx = nSkillLevel`, `[esp+4] = pUnit`, `ret 4`).
 *
 * @va D2Game:0x6FC2C6B0
 */
export function SKILLS_ApplyAuraStateWithStatCalcs_6FC2C6B0_113c(
  m: D2KernMemory113c,
  nSkillId: number,
  pTarget: number,
  nSkillLevel: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FC2C6B0)
  const pSkillsTxt = lookupSkillsTxtNonNull113c(m, nSkillId)
  if (pSkillsTxt === 0) return

  const u = pUnit >>> 0
  const dwAuraLenCalc = m.u32((pSkillsTxt + 0x60) >>> 0)
  const nLength = SKILLS_EvalCalcByOffset113c(m, u, dwAuraLenCalc, nSkillId | 0, nSkillLevel | 0) | 0
  const wAuraState = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))

  const sp = k2W3B1StackPtr
  k2W3B1StackPtr = (sp + 0x28) >>> 0
  try {
    m.fill(sp, 0x24, 0)
    m.setU32(sp, u)
    m.setU32((sp + 0x04) >>> 0, pTarget >>> 0)
    m.setU32((sp + 0x08) >>> 0, nSkillId >>> 0)
    m.setU32((sp + 0x0c) >>> 0, nSkillLevel >>> 0)
    m.setU32((sp + 0x10) >>> 0, nLength >>> 0)
    m.setU32((sp + 0x14) >>> 0, 0xffffffff)
    m.setU32((sp + 0x1c) >>> 0, wAuraState >>> 0)

    const pStatList = STATES_CreateOrUpdateAuraStatList113c(m, sp) >>> 0
    if (pStatList !== 0) {
      SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(
        m,
        pSkillsTxt,
        u,
        pStatList,
        nSkillId | 0,
        nSkillLevel | 0,
      )
    }
  } finally {
    k2W3B1StackPtr = sp
  }
}

/**
 * [7/45] `skillsSrvDoFuncTable[132]` (`__fastcall(pGame, pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * rolls `nDiff + (seed % 3) + 2` split-spawn iterations on `pUnit->pSeed`, resolves spawn class/count
 * via `UNITS_GetMonsterSplitSpawnParams`, and spawns monsters at `(targetX + rand(18) - 9, targetY + rand(18) - 9)`.
 *
 * @va D2Game:0x6FC2CB30
 */
export function SKILLS_SrvDo132_MonsterSplitSpawn_6FC2CB30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
  hooks?: K2W3B1Hooks113c,
): number {
  hitD2GameVa113c(0x6FC2CB30)
  const u = pUnit >>> 0
  const game = pGame >>> 0
  if (u === 0) return 0

  const seedLo0 = stepSeed64At113c(m, (u + 0x20) >>> 0)
  const rem3 = (seedLo0 >>> 0) % 3
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const nLoopCount = (nDiff + rem3 + 2) | 0

  const sp = k2W3B1StackPtr
  k2W3B1StackPtr = (sp + 0x50) >>> 0
  try {
    const pOutX = sp
    const pOutY = (sp + 0x04) >>> 0
    const pOutClassId = (sp + 0x08) >>> 0
    const pOutSpawnCount = (sp + 0x0c) >>> 0
    const pSpawnArgs = (sp + 0x10) >>> 0
    m.fill(sp, 0x40, 0)

    UNITS_GetMonsterSplitSpawnParams113c(
      m,
      u,
      pOutClassId,
      pOutX,
      pOutY,
      pOutSpawnCount,
      nDiff,
      0,
    )

    SUNIT_ValidatePathTargetUnit113c(m, u, game)
    const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
    const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
    const pCoordUnit = pTarget !== 0 && pTarget !== u ? pTarget : 0
    const baseX = readUnitPosXInline113c(m, pCoordUnit !== 0 ? pCoordUnit : u)
    const baseY = readUnitPosYInline113c(m, pCoordUnit !== 0 ? pCoordUnit : u)

    if (nLoopCount > 0) {
      for (let i = 0; i < nLoopCount; i++) {
        const loX = stepSeed64At113c(m, (u + 0x20) >>> 0)
        const spawnX = (baseX + ((loX >>> 0) % 0x12) - 9) | 0
        const loY = stepSeed64At113c(m, (u + 0x20) >>> 0)
        const spawnY = (baseY + ((loY >>> 0) % 0x12) - 9) | 0

        const pUnitRoom1 = UNITS_GetRoom113c(m, u)
        const pSpawnRoom = ROOM_FindRoomContainingSubtile113c(m, pUnitRoom1, spawnX, spawnY) >>> 0
        if (pSpawnRoom !== 0) {
          const pUnitRoom2 = UNITS_GetRoom113c(m, u)
          ROOM_FindRoomContainingSubtile113c(m, pUnitRoom2, spawnX, spawnY)

          m.fill(pSpawnArgs, 0x28, 0)
          m.setU32(pSpawnArgs, game)
          m.setU32((pSpawnArgs + 0x04) >>> 0, pSpawnRoom)
          m.setU32((pSpawnArgs + 0x0c) >>> 0, m.u32(pOutClassId))
          m.setU32((pSpawnArgs + 0x10) >>> 0, m.u32(pOutSpawnCount))
          m.setU32((pSpawnArgs + 0x18) >>> 0, spawnX >>> 0)
          m.setU32((pSpawnArgs + 0x1c) >>> 0, spawnY >>> 0)
          m.setU32((pSpawnArgs + 0x20) >>> 0, 0xffffffff)
          m.setU16((pSpawnArgs + 0x24) >>> 0, 0)

          const pSpawned = MONSTER_Create113c(
            m,
            pSpawnArgs,
            hooks !== undefined ? hooks.regpop : undefined,
          ) >>> 0
          if (pSpawned !== 0) {
            m.setU32((pSpawned + 0xc4) >>> 0, (m.u32((pSpawned + 0xc4) >>> 0) | 0x4020000) >>> 0)
            let pEv = m.u32((pSpawned + 0xdc) >>> 0) >>> 0
            while (pEv !== 0) {
              const pNextEv = m.u32((pEv + 0x24) >>> 0) >>> 0
              if (m.u8(pEv) === 2) {
                EVENT_FreeNode113c(m, game, pEv)
              }
              pEv = pNextEv
            }
            const nextFrame = ((m.u32((game + 0xa8) >>> 0) | 0) + 0x0f) | 0
            EVENT_SetEventFull113c(m, game, pSpawned, 2, nextFrame, 0, 0, 0)
            STATES_UpdateOrClearState98Transform113c(m, pSpawned, u)
          }
        }
      }
    }
    return 1
  } finally {
    k2W3B1StackPtr = sp
  }
}

/**
 * [8/45] `skillsSrvDoFuncTable[129]` (`__fastcall(pGame, pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * reads summon params `(nMonId, nX, nY, nMode)` from `pUnit`'s active skill (`Param1..Param4`),
 * spawns the monster via `0x6FD0F650` (radius `-1`, fallback radius `4`), sets `0x4020000` flags,
 * updates state `98` transform (`D2Common.#10486`), and applies `SkillsTxt.wSumOverlay` (`+0xE6`) icon.
 *
 * @va D2Game:0x6FC2CDC0
 */
export function SKILLS_SrvDo129_SpawnSummonFromParams_6FC2CDC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  _nSkillLevel = 0,
  hooks?: K2W3B1Hooks113c,
): number {
  hitD2GameVa113c(0x6FC2CDC0)
  const pSkillsTxt = lookupSkillsTxtNonNull113c(m, nSkillId)
  if (pSkillsTxt === 0) return 0

  const u = pUnit >>> 0
  const game = pGame >>> 0
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, u)
  if (pSkill === 0) return 0

  const nMonId = SKILLS_GetParam1113c(m, pSkill) | 0
  const nX = SKILLS_GetParam2113c(m, pSkill) | 0
  const nY = SKILLS_GetParam3113c(m, pSkill) | 0
  const nMode = SKILLS_GetParam4113c(m, pSkill) | 0

  const pUnitRoom = UNITS_GetRoom113c(m, u)
  const pSpawnRoom = ROOM_FindRoomContainingSubtile113c(m, pUnitRoom, nX, nY) >>> 0
  if (pSpawnRoom === 0) return 0

  const regpopHooks = hooks !== undefined ? hooks.regpop : undefined
  let pSpawned = MONSTER_SpawnAtCoords113c(
    m,
    nMonId,
    nMode,
    game,
    pSpawnRoom,
    nX,
    nY,
    -1,
    0,
    regpopHooks,
  ) >>> 0
  if (pSpawned === 0) {
    pSpawned = MONSTER_SpawnAtCoords113c(
      m,
      nMonId,
      nMode,
      game,
      pSpawnRoom,
      nX,
      nY,
      4,
      0,
      regpopHooks,
    ) >>> 0
    if (pSpawned === 0) return 0
  }

  m.setU32((pSpawned + 0xc4) >>> 0, (m.u32((pSpawned + 0xc4) >>> 0) | 0x4020000) >>> 0)
  STATES_UpdateOrClearState98Transform113c(m, pSpawned, u)

  const wSumOverlay = sx16(m.u16((pSkillsTxt + 0xe6) >>> 0))
  if (wSumOverlay >= 0) {
    const pDataTables = getDataTablesPtr113c(m)
    const nStatesCount = pDataTables !== 0 ? m.u32((pDataTables + 0xbc0) >>> 0) | 0 : 0
    if (wSumOverlay < nStatesCount) {
      STATES_SetMonsterSkillIconOnUnit113c(m, pSpawned, wSumOverlay, 0)
    }
  }
  return 1
}

/**
 * [9/45] `skillsSrvDoFuncTable[133]` (`__fastcall(pGame, pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * validates path target, locates pending combat damage (`0x6FCFAA90`), heals `pUnit`'s pack leader
 * (or `pUnit`) by `mulDiv(EvalCalc1, min(dwDmgTotal, targetHp), 100)` when hit succeeded, and
 * executes combat events (`0x6FCFED30`).
 *
 * @va D2Game:0x6FC2CF00
 */
export function SKILLS_SrvDo133_LeaderLifeLeechHit_6FC2CF00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2CF00)
  const pSkillsTxt = lookupSkillsTxtNonNull113c(m, nSkillId)
  if (pSkillsTxt === 0) return 0

  const u = pUnit >>> 0
  const game = pGame >>> 0
  SUNIT_ValidatePathTargetUnit113c(m, u, game)
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === u || pTarget === 0) return 0

  m.setU32((u + 0xc4) >>> 0, (m.u32((u + 0xc4) >>> 0) | 0x40) >>> 0)
  const pDmg = SUNITDMG_FindCombatDamageData113c(m, u, pTarget) >>> 0
  if (pDmg === 0) return 0

  if ((m.u8((pDmg + 0x04) >>> 0) & 1) !== 0) {
    let pHealUnit = 0
    if (m.u32(u) === 1) {
      pHealUnit = AIGENERAL_GetPackLeaderUnit113c(m, u) >>> 0
      if (pHealUnit === 0) {
        pHealUnit = u
      }
    }
    const curHp = STATLIST_GetUnitStat113c(m, pHealUnit, 6, 0) | 0
    const maxHp = STATLIST_GetMaxLifeFromUnit113c(m, pHealUnit) | 0
    const targetHp = STATLIST_GetUnitStat113c(m, pTarget, 6, 0) | 0
    const dmgTotal = m.u32((pDmg + 0x08) >>> 0) | 0
    const leechBase = dmgTotal < targetHp ? dmgTotal : targetHp

    const dwCalc1 = m.u32((pSkillsTxt + 0x138) >>> 0)
    const pct = SKILLS_EvalCalcByOffset113c(m, u, dwCalc1, nSkillId | 0, nSkillLevel | 0) | 0
    const healAdd = mulDiv113c(pct, leechBase, 100) | 0

    let newHp = (curHp + healAdd) | 0
    if (newHp < 1) newHp = 1
    if (newHp > maxHp) newHp = maxHp
    STATLIST_SetUnitStat113c(m, pHealUnit, 6, newHp, 0)
  }

  SUNITDMG_ExecuteEvents113c(m, game, u, pTarget, 1, 0)
  return 1
}

/**
 * [10/45] Mounts an Imp (`wBaseId == 0x1B3 || 0x1B9`, `ecx = pImpUnit`) onto a Siege Beast
 * (`wBaseId == 0x1EC`, `esi = pBeastUnit`, `eax = dwArg14`, `[esp+4] = pGame`, `[esp+8] = dwArg18`, `ret 8`):
 * enables state `0x8F`, links state `98` transforms, schedules persistent event `5`, clears low flags `0x0E`,
 * and transitions Siege Beast special AI state to `0x10` (`16`).
 *
 * @va D2Game:0x6FC2D040
 */
export function SKILLS_MountImpOnSiegeBeast_6FC2D040_113c(
  m: D2KernMemory113c,
  pBeastUnit: number,
  pImpUnit: number,
  dwArg14: number,
  pGame: number,
  dwArg18: number,
): void {
  hitD2GameVa113c(0x6FC2D040)
  const beast = pBeastUnit >>> 0
  const imp = pImpUnit >>> 0
  if (beast === 0 || imp === 0) return

  const beastBaseId = MONSTER_GetBaseIdFromUnit113c(m, beast) | 0
  if (beastBaseId < 0) return
  const pDataTables = getDataTablesPtr113c(m)
  const nMonStatsCount = pDataTables !== 0 ? m.u32((pDataTables + 0xa80) >>> 0) | 0 : 0
  if (beastBaseId >= nMonStatsCount || beastBaseId !== 0x1ec) return

  let impBaseId = MONSTER_GetBaseIdFromUnit113c(m, imp) | 0
  if (impBaseId < 0 || impBaseId >= nMonStatsCount) {
    impBaseId = -1
  }
  if (impBaseId !== 0x1b3 && impBaseId !== 0x1b9) return

  STATES_ToggleGfxStateFlag113c(m, beast, 0x8f, 1)
  STATES_UpdateOrClearState98Transform113c(m, beast, imp)
  STATES_UpdateOrClearState98Transform113c(m, imp, beast)

  const game = pGame >>> 0
  EVENT_DeleteEventByArg14_113c(m, game, beast, 5, 0)

  const pNode = EVENT_CreateNodeWithGrowth113c(m, game, beast) >>> 0
  m.setU8((pNode + 0x02) >>> 0, (m.u8((pNode + 0x02) >>> 0) | 0x04) & 0xff)
  m.setU8(pNode, 5)
  m.setU32((pNode + 0x04) >>> 0, 0xffffffff)
  m.setU32((pNode + 0x14) >>> 0, dwArg14 >>> 0)
  m.setU32((pNode + 0x18) >>> 0, dwArg18 >>> 0)
  m.setU32((pNode + 0x2c) >>> 0, 0)

  const uType = m.u32(beast) >>> 0
  const part = uType < 6 ? EVENT_PARTITION_BY_UNIT_TYPE_113C[uType]! : 0
  const pTimer = m.u32((game + 0xb8) >>> 0) >>> 0
  if (pTimer !== 0) {
    const headAddr = (pTimer + (part << 2) + 0xa04) >>> 0
    const oldHead = m.u32(headAddr) >>> 0
    m.setU32((pNode + 0x1c) >>> 0, oldHead)
    m.setU32((pNode + 0x20) >>> 0, 0)
    if (oldHead !== 0) {
      m.setU32((oldHead + 0x20) >>> 0, pNode)
    }
    m.setU32(headAddr, pNode)
  }

  m.setU32((beast + 0xc4) >>> 0, (m.u32((beast + 0xc4) >>> 0) & 0xfffffff1) >>> 0)
  let pAiGeneral = 0
  if (m.u32(beast) === 1) {
    const pMonData = m.u32((beast + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
    }
  }
  AI_InitMonsterAiThinkFn113c(m, beast, game, pAiGeneral, 0x10)
}

/**
 * [11/45] Dismounts an Imp (`wBaseId == 0x1B3 || 0x1B9`, `eax = pImpUnit`) from a Siege Beast
 * (`wBaseId == 0x1EC`, `esi = pBeastUnit`, `[esp+4] = pGame`, `[esp+8] = nUnused`, `ret 8`):
 * clears state `0x8F` and state `98` transforms; if Siege Beast life percent `< 10`, kills it via
 * `0x6FCFEEE0`, else restores flags `0x0E`, deletes event `5`, and resets special AI state to `0`.
 *
 * @va D2Game:0x6FC2DB00
 */
export function SKILLS_DismountImpFromSiegeBeast_6FC2DB00_113c(
  m: D2KernMemory113c,
  pBeastUnit: number,
  pImpUnit: number,
  pGame: number,
  _nUnused = 0,
  hooks?: K2W3B1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC2DB00)
  const beast = pBeastUnit >>> 0
  const imp = pImpUnit >>> 0
  if (beast === 0 || imp === 0) return

  const beastBaseId = MONSTER_GetBaseIdFromUnit113c(m, beast) | 0
  if (beastBaseId < 0) return
  const pDataTables = getDataTablesPtr113c(m)
  const nMonStatsCount = pDataTables !== 0 ? m.u32((pDataTables + 0xa80) >>> 0) | 0 : 0
  if (beastBaseId >= nMonStatsCount || beastBaseId !== 0x1ec) return

  let impBaseId = MONSTER_GetBaseIdFromUnit113c(m, imp) | 0
  if (impBaseId < 0 || impBaseId >= nMonStatsCount) {
    impBaseId = -1
  }
  if (impBaseId !== 0x1b3 && impBaseId !== 0x1b9) return

  STATES_ToggleGfxStateFlag113c(m, beast, 0x8f, 0)
  STATES_UpdateOrClearState98Transform113c(m, beast, 0)
  STATES_UpdateOrClearState98Transform113c(m, imp, 0)

  const game = pGame >>> 0
  const lifePct = STATLIST_GetUnitLifePercent113c(m, beast) | 0
  if (lifePct < 10) {
    if (
      hooks !== undefined &&
      hooks.meleeDot !== undefined &&
      hooks.meleeDot.killUnit !== undefined
    ) {
      hooks.meleeDot.killUnit(m, game, beast, 0, 1)
      return
    }
    SUNITDMG_DistributeExperience113c(m, game, 0, beast)
    if (m.u32(beast) === 1) {
      const curMode = m.u32((beast + 0x10) >>> 0) | 0
      if (curMode !== 0 && curMode !== 0x0c) {
        if (MONSTATS_CheckFlagBit113c(m, m.u32((beast + 0x04) >>> 0) | 0, 0x0f) !== 0) {
          SUNITDMG_FreeAttackerCombatList113c(m, beast, game)
          MONSTER_ClearModeEvents113c(m, game, beast)
          UNITS_ChangeAnimMode113c(m, beast, 0)
          m.setU32((beast + 0xc4) >>> 0, (m.u32((beast + 0xc4) >>> 0) | 0x10000) >>> 0)
          if (game !== 0) {
            const nextFrame = ((m.u32((game + 0xa8) >>> 0) | 0) + 1) | 0
            EVENT_SetEventFull113c(m, game, beast, 1, nextFrame, 0, 0, 0)
          }
        }
      }
    }
    return
  }

  m.setU32((beast + 0xc4) >>> 0, (m.u32((beast + 0xc4) >>> 0) | 0x0e) >>> 0)
  EVENT_DeleteEventByArg14_113c(m, game, beast, 5, 0)
  const pAiGen = MONSTER_GetAiGeneralPtr_6FC218E0_113c(m, beast) >>> 0
  AI_InitMonsterAiThinkFn113c(m, beast, game, pAiGen, 0)
}

/**
 * [12/45] `skillsSrvDoFuncTable[139]` (`__fastcall(pGame, pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * fires one tick of a channeled hose/submerge missile (`SkillsTxt.wSrvMissileA` at `+0x48`),
 * updates missile range (`EvalCalc2 + dwRange`), initializes Inferno sequence frames (`0x6FCD3270`),
 * and schedules event `0` at `dwGameFrame + 3` while `dwGameFrame < Param1 && state(0x0C)` or resets AI think.
 *
 * @va D2Game:0x6FC2DE70
 */
export function SKILLS_SrvDo139_ChanneledHoseTick_6FC2DE70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: K2W3B1Hooks113c,
): number {
  hitD2GameVa113c(0x6FC2DE70)
  const pSkillsTxt = lookupSkillsTxtNonNull113c(m, nSkillId)
  if (pSkillsTxt === 0) return 0

  const wSrvMissileA = sx16(m.u16((pSkillsTxt + 0x48) >>> 0))
  if (wSrvMissileA <= 0) return 0

  const pDataTables = getDataTablesPtr113c(m)
  const nMissilesCount = pDataTables !== 0 ? m.u32((pDataTables + 0xb6c) >>> 0) | 0 : 0
  if (wSrvMissileA >= nMissilesCount) return 0
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  const pMissilesTxt = (pMissilesBase + imul32(wSrvMissileA, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 0

  const u = pUnit >>> 0
  const game = pGame >>> 0
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, u)
  if (pSkill === 0) return 0

  const pTarget = SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c(m, u, game) >>> 0
  if (pTarget !== 0) {
    const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
    if (pPath !== 0) {
      const targetY = UNIT_GetPosY113c(m, pTarget)
      const targetX = UNIT_GetPosX113c(m, pTarget)
      PATH_SetTargetPos113c(m, pPath, targetX, targetY)
      UNITS_SetTargetUnitForDynamicUnit113c(m, u, pTarget)
    }
  }

  const sp = k2W3B1StackPtr
  k2W3B1StackPtr = (sp + 0x60) >>> 0
  try {
    m.fill(sp, 0x5c, 0)
    m.setU32(sp, 0x25)
    m.setU32((sp + 0x04) >>> 0, u)
    m.setU32((sp + 0x10) >>> 0, wSrvMissileA >>> 0)
    m.setU32((sp + 0x14) >>> 0, UNIT_GetPosX113c(m, u) >>> 0)
    m.setU32((sp + 0x18) >>> 0, UNIT_GetPosY113c(m, u) >>> 0)

    const nVel = m.u8((pMissilesTxt + 0x9a) >>> 0)
    const nLevVel = m.u8((pMissilesTxt + 0x9b) >>> 0)
    const scaledVel = imul32(nLevVel, nSkillLevel | 0)
    const velAdd = sdiv32(scaledVel, 8)
    m.setU32((sp + 0x28) >>> 0, ((nVel + velAdd) | 0) >>> 0)
    m.setU32((sp + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((sp + 0x30) >>> 0, nSkillLevel >>> 0)

    const pPath1 = m.u32((u + 0x2c) >>> 0) >>> 0
    m.setU32((sp + 0x1c) >>> 0, PATH_GetFirstPointX113c(m, pPath1) >>> 0)
    const pPath2 = m.u32((u + 0x2c) >>> 0) >>> 0
    m.setU32((sp + 0x20) >>> 0, PATH_GetFirstPointY113c(m, pPath2) >>> 0)

    const pMissile = MISSILE_CreateServerProjectile113c(
      m,
      game,
      sp,
      hooks !== undefined ? hooks.meleeDot : undefined,
    ) >>> 0
    if (pMissile !== 0) {
      const dwCalc2 = m.u32((pSkillsTxt + 0x13c) >>> 0)
      const rangeBonus = SKILLS_EvalCalcByOffset113c(
        m,
        u,
        dwCalc2,
        nSkillId | 0,
        nSkillLevel | 0,
      ) | 0
      const baseRange = m.u32((pMissilesTxt + 0x3c) >>> 0) | 0
      const totalFrames = (rangeBonus + baseRange) | 0
      const pMisPath = m.u32((pMissile + 0x2c) >>> 0) >>> 0
      PATH_SetNewDistance113c(m, pMisPath, totalFrames)
      MISSILE_SetTotalFrames113c(m, pMissile, totalFrames)
      MISSILE_SetRemainingFrames113c(m, pMissile, totalFrames)
    }
  } finally {
    k2W3B1StackPtr = sp
  }

  SKILLS_InitInfernoSeqFrames_6FCD3270_113c(m, u, pSkillsTxt)
  const endFrame = SKILLS_GetParam1113c(m, pSkill) | 0
  const curFrame = m.u32((game + 0xa8) >>> 0) | 0
  if (curFrame < endFrame && STATES_CheckState113c(m, u, 0x0c) !== 0) {
    let pEv = m.u32((u + 0xdc) >>> 0) >>> 0
    while (pEv !== 0) {
      const pNextEv = m.u32((pEv + 0x24) >>> 0) >>> 0
      if (m.u8(pEv) === 1) {
        EVENT_FreeNode113c(m, game, pEv)
      }
      pEv = pNextEv
    }
    const nextTickFrame = ((m.u32((game + 0xa8) >>> 0) | 0) + 3) | 0
    EVENT_SetEventFull113c(m, game, u, 0, nextTickFrame, 0, 0, 0)
    return 1
  }

  SKILLS_ResetUnitAiThinkEvent_6FC2DE20_113c(m, game, u)
  return 1
}

/**
 * [13/45] Populates a `0x84`-byte `D2ItemDropStrc` at `pOutDrop` (`ebx`) from `pItem` (`esi`)
 * and `pUnit` (`[esp+4]`, `ret 4`), copying item format, level, classId, mode, type, position,
 * gold/quantity, seed pointer, durability/max-durability, file index, and ear/personalized name.
 *
 * @va D2Game:0x6FC2E410
 */
export function ITEMS_PopulateItemDropStruct_6FC2E410_113c(
  m: D2KernMemory113c,
  pOutDrop: number,
  pItem: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FC2E410)
  const drop = pOutDrop >>> 0
  const item = pItem >>> 0
  m.fill(drop, 0x84, 0)
  m.setU32((drop + 0x08) >>> 0, pUnit >>> 0)

  const wFormat = ITEMS_GetItemFormat113c(m, item) & 0xffff
  m.setU16((drop + 0x2a) >>> 0, wFormat)

  const ilvl = ITEMS_GetItemLevel113c(m, item) | 0
  m.setU32((drop + 0x0c) >>> 0, (ilvl > 0 ? ilvl : 1) >>> 0)

  const classId = item !== 0 ? m.u32((item + 0x04) >>> 0) | 0 : -1
  m.setU32((drop + 0x14) >>> 0, classId >>> 0)

  const animMode = item !== 0 ? m.u32((item + 0x10) >>> 0) >>> 0 : 0
  m.setU32((drop + 0x18) >>> 0, animMode)

  m.setU32((drop + 0x30) >>> 0, ITEMS_GetItemQuality113c(m, item) >>> 0)
  m.setU32((drop + 0x1c) >>> 0, readUnitPosXInline113c(m, item) >>> 0)
  m.setU32((drop + 0x20) >>> 0, readUnitPosYInline113c(m, item) >>> 0)

  const nItemType = ITEMS_GetItemTypeFromItem113c(m, item) | 0
  if (nItemType === 4) {
    const goldQty = STATLIST_GetUnitStat113c(m, item, 0x0e, 0) | 0
    m.setU32((drop + 0x34) >>> 0, goldQty >>> 0)
  } else if (ITEMS_GetTwoHandedFlag113c(m, item) !== 0) {
    const qty = STATLIST_GetUnitStat113c(m, item, 0x46, 0) | 0
    if (qty < 0) {
      throw new D2CommonAssertError('', 0xca9)
    }
    m.setU32((drop + 0x34) >>> 0, qty >>> 0)
  }

  m.setU32((drop + 0x04) >>> 0, (item + 0x20) >>> 0)
  m.setU16((drop + 0x28) >>> 0, 1)
  m.setU32((drop + 0x48) >>> 0, m.u32((item + 0x28) >>> 0))
  m.setU32((drop + 0x4c) >>> 0, ITEMS_GetOwnerGuid113c(m, item) >>> 0)
  m.setU32((drop + 0x40) >>> 0, ITEMS_GetItemCell113c(m, item) >>> 0)
  m.setU32((drop + 0x44) >>> 0, ITEMS_GetCommandFlags113c(m, item) >>> 0)
  m.setU32((drop + 0x38) >>> 0, STATLIST_GetUnitStat113c(m, item, 0x48, 0) >>> 0)
  m.setU32((drop + 0x3c) >>> 0, STATLIST_GetUnitBaseStat113c(m, item, 0x49, 0) >>> 0)
  m.setU32((drop + 0x40) >>> 0, ITEMS_GetItemCell113c(m, item) >>> 0)
  m.setU32((drop + 0x2c) >>> 0, 0)

  const nItemType2 = ITEMS_GetItemTypeFromItem113c(m, item) | 0
  if (nItemType2 === 7) {
    const pEarName = ITEMS_GetEarName113c(m, item) >>> 0
    copyCStringToMem113c(m, (drop + 0x58) >>> 0, pEarName)
    const earLvl = ITEMS_GetEarLevel113c(m, item) & 0xff
    m.setU8((drop + 0x50) >>> 0, earLvl)
    return
  }

  if (ITEMS_CheckCommandFlags113c(m, item, 0x1000000, 0xcc1, 0x6fd1d078) !== 0) {
    const pPersonalizedName = ITEMS_GetEarName113c(m, item) >>> 0
    copyCStringToMem113c(m, (drop + 0x58) >>> 0, pPersonalizedName)
  }
}

/**
 * [14/45] Places `pItem` (`ecx`) on the ground in `pRoom` (`ebx`) at `(nX, nY)` (`[esp+0xC] = nX`,
 * `eax = nY`, `[esp+4] = pGame`, `[esp+8] = pOwnerUnit`, `ret 0xC`): initializes static path coords,
 * sets collision mask, sorts room unit list by Y, sets flags `0x1002` and `0x2000000`, transitions
 * anim mode to `3` (`ITMODE_ON_GROUND`), sets inv page `0xFF`, records ground expire frame, and
 * fires `QUESTS_TriggerItemPickedUp` (`0x6FC54510`) if `pOwnerUnit != NULL`.
 *
 * @va D2Game:0x6FC2E990
 */
export function ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(
  m: D2KernMemory113c,
  nY: number,
  pItem: number,
  pRoom: number,
  pGame: number,
  pOwnerUnit: number,
  nX: number,
  hooks?: K2W3B1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC2E990)
  const room = pRoom >>> 0
  if (room === 0) return

  const item = pItem >>> 0
  const x = nX | 0
  const y = nY | 0
  UNITS_InitStaticPathCoords113c(m, item, room, x, y)
  UNITS_SetCollisionMaskAtCoords113c(m, item, room, x, y)
  UNITROOM_SortUnitListByY113c(m, item, room)

  if (item !== 0) {
    m.setU32((item + 0xc4) >>> 0, (m.u32((item + 0xc4) >>> 0) | 0x1002) >>> 0)
  }
  UNITS_ChangeAnimMode113c(m, item, 3)
  ITEMS_SetInvPage113c(m, item, 0xff)
  if (item !== 0) {
    m.setU32((item + 0xc4) >>> 0, (m.u32((item + 0xc4) >>> 0) | 0x2000000) >>> 0)
  }

  const game = pGame >>> 0
  const expireFrame = ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c(m, game, item) >>> 0
  const pItemData = m.u32((item + 0x14) >>> 0) >>> 0
  m.setU32((pItemData + 0x24) >>> 0, expireFrame)

  const owner = pOwnerUnit >>> 0
  if (owner !== 0) {
    QUESTS_TriggerItemPickedUp_6FC54510_113c(
      m,
      game,
      item,
      owner,
      hooks !== undefined ? hooks.laneJ : undefined,
    )
  }
}

/**
 * [15/45] Validates and marks a spawned unique item (`ebx = pItem`) in `pGame->dwUniqueFlags`
 * (`+0x1B24`, `eax = pGame`): checks `UniqueItemsTxt.bNoLimit` (`+0x2C` bit 1) and `ItemsTxt.bQuest`
 * (`+0x12A`), rejects already-spawned non-quest uniques (`0x6FC2E800`), sets the unique bit when
 * `nUniqueId <= 0x1000`, and returns `1` on success (`0` on failure).
 *
 * @va D2Game:0x6FC2EDC0
 */
export function ITEMS_MarkUniqueItemSpawned_6FC2EDC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FC2EDC0)
  const item = pItem >>> 0
  const game = pGame >>> 0
  const nItemId = item !== 0 ? m.u32((item + 0x04) >>> 0) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  if (pItemsTxt === 0) return 0

  const nUniqueId = ITEMS_GetItemCell113c(m, item) | 0
  if (nUniqueId < 0) return 0

  const pDataTables = getDataTablesPtr113c(m)
  const nUniqueCount = pDataTables !== 0 ? m.u32((pDataTables + 0xc28) >>> 0) | 0 : 0
  if (nUniqueId >= nUniqueCount) return 0

  const pUniqueBase = m.u32((pDataTables + 0xc24) >>> 0) >>> 0
  const pUniqueTxt = (pUniqueBase + imul32(nUniqueId, 0x14c)) >>> 0
  if (pUniqueTxt === 0) return 0

  const flagsByte = m.u8((pUniqueTxt + 0x2c) >>> 0)
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const mask1 = m.u8((pMasks + 0x04) >>> 0)
  if ((flagsByte & mask1) === 0) {
    if (m.u8((pItemsTxt + 0x12a) >>> 0) === 0) {
      if (ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c(m, item, game) !== 0) {
        return 0
      }
    }
    if (nUniqueId > 0x1000) return 0
    const dwordIdx = nUniqueId >> 5
    const bitIdx = nUniqueId & 0x1f
    const bitMask = m.u32((pMasks + (bitIdx << 2)) >>> 0)
    const wordAddr = (game + (dwordIdx << 2) + 0x1b24) >>> 0
    m.setU32(wordAddr, (m.u32(wordAddr) | bitMask) >>> 0)
  }
  return 1
}

/**
 * @va D2Game:0x6FC2EE70
 */
export function ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FC2EE70)
  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    pGame,
    (mem, _g, pPlayer, pCtxItem) => {
      ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c(mem, pPlayer, pCtxItem)
    },
    pItem,
  )
  SUNIT_FreeUnit113c(m, pGame, pItem)
  return 0
}

/**
 * @va D2Game:0x6FC2F780
 */
export function ITEMS_RollSpawnableWeaponOrMiscId_6FC2F780_113c(
  m: D2KernMemory113c,
  pGame: number,
  pSeed: number,
  nLevelId: number,
  nRequiredType: number,
  bSkipRarityRoll: number,
  bAllowQuest0x28: number,
): number {
  hitD2GameVa113c(0x6FC2F780)
  const pItemTables = DATATBLS_GetItemDataTables113c(m) >>> 0
  const pMisc = m.u32(pItemTables + 0x18)
  const pItemsBase = m.u32(pItemTables + 0x04)
  const startIndex = sdiv32((pMisc - pItemsBase) | 0, 0x1a8)
  const nTotalItems = m.u32(pItemTables) | 0
  const count = sdiv32((imul32(nTotalItems, 0x1a8) - pMisc + pItemsBase) | 0, 0x1a8)
  if (pMisc === 0 || count <= 0) {
    return -1
  }

  const matchedIds = new Int32Array(0x400)
  let matchCount = 0
  let pRec = pMisc
  for (let i = 0; i < count; i = (i + 1) | 0, pRec = (pRec + 0x1a8) >>> 0) {
    if (bAllowQuest0x28 === 0 && m.u16(pRec + 0x11e) === 0x28) {
      continue
    }
    const ok = ITEMS_CheckItemTxtSpawnable_6FC2F180_113c(
      m,
      pRec,
      nLevelId,
      nRequiredType,
      pSeed,
      bSkipRarityRoll,
    )
    if (ok === 0) {
      continue
    }
    if (m.u32(pGame + 0x70) === 0 && m.u16(pRec + 0xf6) >= 0x64) {
      continue
    }
    if (matchCount < 0x3ff) {
      matchedIds[matchCount] = (startIndex + i) | 0
      matchCount = (matchCount + 1) | 0
    }
  }

  if (matchCount <= 0) {
    return -1
  }
  const newLo = stepSeed64At113c(m, pSeed)
  let pick = 0
  if ((matchCount & (matchCount - 1)) !== 0) {
    pick = ((newLo >>> 0) % (matchCount >>> 0)) | 0
  } else {
    pick = (newLo & (matchCount - 1)) | 0
  }
  return matchedIds[pick]! | 0
}

/**
 * @va D2Game:0x6FC2F8F0
 */
export function ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c(
  m: D2KernMemory113c,
  nRequiredType: number,
  pGame: number,
  pSeed: number,
  nLevelId: number,
  bSkipRarityRoll: number,
): number {
  hitD2GameVa113c(0x6FC2F8F0)
  const pItemTables = DATATBLS_GetItemDataTables113c(m) >>> 0
  const pWeapons = m.u32(pItemTables + 0x08)
  const pItemsBase = m.u32(pItemTables + 0x04)
  const startIndex = sdiv32((pWeapons - pItemsBase) | 0, 0x1a8)
  const pArmor = m.u32(pItemTables + 0x10)
  const count = sdiv32((pArmor - pWeapons) | 0, 0x1a8)
  if (pWeapons === 0 || count <= 0) {
    return -1
  }

  const matchedIds = new Int32Array(0x400)
  let matchCount = 0
  let pRec = pWeapons
  for (let i = 0; i < count; i = (i + 1) | 0, pRec = (pRec + 0x1a8) >>> 0) {
    const ok = ITEMS_CheckItemTxtSpawnable_6FC2F180_113c(
      m,
      pRec,
      nLevelId,
      nRequiredType,
      pSeed,
      bSkipRarityRoll,
    )
    if (ok === 0) {
      continue
    }
    if (m.u32(pGame + 0x70) === 0 && m.u16(pRec + 0xf6) >= 0x64) {
      continue
    }
    if (matchCount < 0x3ff) {
      matchedIds[matchCount] = (startIndex + i) | 0
      matchCount = (matchCount + 1) | 0
    }
  }

  if (matchCount <= 0) {
    return -1
  }
  const newLo = stepSeed64At113c(m, pSeed)
  let pick = 0
  if ((matchCount & (matchCount - 1)) !== 0) {
    pick = ((newLo >>> 0) % (matchCount >>> 0)) | 0
  } else {
    pick = (newLo & (matchCount - 1)) | 0
  }
  return matchedIds[pick]! | 0
}

/**
 * @va D2Game:0x6FC2FA30
 */
export function ITEMS_RollSpawnableArmorId_6FC2FA30_113c(
  m: D2KernMemory113c,
  nRequiredType: number,
  pGame: number,
  pSeed: number,
  nLevelId: number,
  bSkipRarityRoll: number,
): number {
  hitD2GameVa113c(0x6FC2FA30)
  const pItemTables = DATATBLS_GetItemDataTables113c(m) >>> 0
  const pArmor = m.u32(pItemTables + 0x10)
  const pItemsBase = m.u32(pItemTables + 0x04)
  const startIndex = sdiv32((pArmor - pItemsBase) | 0, 0x1a8)
  const pMisc = m.u32(pItemTables + 0x18)
  const count = sdiv32((pMisc - pArmor) | 0, 0x1a8)
  if (pArmor === 0 || count <= 0) {
    return -1
  }

  const matchedIds = new Int32Array(0x400)
  let matchCount = 0
  let pRec = pArmor
  for (let i = 0; i < count; i = (i + 1) | 0, pRec = (pRec + 0x1a8) >>> 0) {
    const ok = ITEMS_CheckItemTxtSpawnable_6FC2F180_113c(
      m,
      pRec,
      nLevelId,
      nRequiredType,
      pSeed,
      bSkipRarityRoll,
    )
    if (ok === 0) {
      continue
    }
    if (m.u32(pGame + 0x70) === 0 && m.u16(pRec + 0xf6) >= 0x64) {
      continue
    }
    if (matchCount < 0x3ff) {
      matchedIds[matchCount] = (startIndex + i) | 0
      matchCount = (matchCount + 1) | 0
    }
  }

  if (matchCount <= 0) {
    return -1
  }
  const newLo = stepSeed64At113c(m, pSeed)
  let pick = 0
  if ((matchCount & (matchCount - 1)) !== 0) {
    pick = ((newLo >>> 0) % (matchCount >>> 0)) | 0
  } else {
    pick = (newLo & (matchCount - 1)) | 0
  }
  return matchedIds[pick]! | 0
}

/**
 * @va D2Game:0x6FC320E0
 */
export function ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c(
  m: D2KernMemory113c,
  pCoords: number,
  pGame: number,
  pRoom: number,
): number {
  hitD2GameVa113c(0x6FC320E0)
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const nDifficulty = m.u8(pGame + 0x6d)
  const bExpansion = m.u32(pGame + 0x70)
  let mlvl = DATATBLS_GetLevelMonsterLevel113c(m, nLevelId, nDifficulty, bExpansion) | 0
  if (mlvl > 1) {
    mlvl = (mlvl - 1) | 0
  }
  const pRoomSeed = pRoom !== 0 ? (pRoom + 0x6c) >>> 0 : 0
  if (m.u32(D2GAME_GDW_GOLD_CLASS_ID_VA_113C) === 0) {
    DATATBLS_GetItemsTxtRecordByCode113c(m, 0x20646c67, D2GAME_GDW_GOLD_CLASS_ID_VA_113C)
  }

  const x0 = m.u32(pCoords) | 0
  const y0 = m.u32(pCoords + 0x04) | 0
  const xOff = (x0 + 2) | 0
  const yOff = (y0 + 3) | 0
  const pFoundRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom, xOff, yOff) >>> 0

  const pScratch = allocZeroedScratch113c(m, 0xa0)
  const pOutCoords = pScratch
  const pCenterCoords = (pScratch + 0x08) >>> 0
  const pDrop = (pScratch + 0x18) >>> 0

  m.setU32(pCenterCoords, x0 >>> 0)
  m.setU32(pCenterCoords + 0x04, y0 >>> 0)
  if (pFoundRoom !== 0) {
    m.setU32(pOutCoords, xOff >>> 0)
    m.setU32(pOutCoords + 0x04, yOff >>> 0)
  } else {
    m.setU32(pOutCoords, x0 >>> 0)
    m.setU32(pOutCoords + 0x04, y0 >>> 0)
  }

  const pTargetRoom =
    COLLISION_FindFreePositionBasic113c(m, pRoom, pOutCoords, pCenterCoords, 1, 0x3e01, 0x801, 1) >>> 0
  if (pTargetRoom === 0) {
    return 0
  }

  const wItemFormat = m.u16(pGame + 0x78)
  const nGoldClassId = m.u32(D2GAME_GDW_GOLD_CLASS_ID_VA_113C)
  const outX = m.u32(pOutCoords)
  const outY = m.u32(pOutCoords + 0x04)

  m.setU32(pDrop + 0x00, 0)
  m.setU32(pDrop + 0x04, pRoomSeed >>> 0)
  m.setU32(pDrop + 0x08, pGame >>> 0)
  m.setU32(pDrop + 0x0c, mlvl >>> 0)
  m.setU32(pDrop + 0x14, nGoldClassId >>> 0)
  m.setU32(pDrop + 0x18, 3)
  m.setU32(pDrop + 0x1c, outX >>> 0)
  m.setU32(pDrop + 0x20, outY >>> 0)
  m.setU32(pDrop + 0x24, pTargetRoom >>> 0)
  m.setU16(pDrop + 0x28, 1)
  m.setU16(pDrop + 0x2a, wItemFormat)
  m.setU32(pDrop + 0x30, 0)

  const pItem = D2GAME_CreateItemEx_6FC31490_113c(m, pGame, pDrop, 0) >>> 0
  if (pItem !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x2000, 0)
  }
  return pItem | 0
}

/**
 * @va D2Game:0x6FC33320
 */
export function ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c(
  m: D2KernMemory113c,
  pItem: number,
  nItemLevel: number,
  nBaseSkillId: number,
  nBonus: number,
): void {
  hitD2GameVa113c(0x6FC33320)
  if (pItem === 0) {
    return
  }
  const chosenSkills = new Int32Array([-1, -1, -1])
  const pItemSeed0 = ITEMS_GetItemSeed113c(m, pItem) >>> 0
  const countRoll = (((stepSeed64At113c(m, pItemSeed0) >>> 0) % 100) + (nBonus | 0)) | 0
  let numSkills = 0
  if (countRoll > 0x5a) {
    numSkills = 3
  } else if (countRoll > 0x46) {
    numSkills = 2
  } else if (countRoll > 0x1e || (nBonus | 0) !== 0) {
    numSkills = 1
  } else {
    return
  }

  let baseTier = 1
  if ((nItemLevel | 0) > 0x24 && (ITEMS_GetItemFormat113c(m, pItem) & 0xffff) >= 0x64) {
    baseTier = 5
  } else if ((nItemLevel | 0) > 0x18) {
    baseTier = 4
  } else if ((nItemLevel | 0) > 0x12) {
    baseTier = 3
  } else if ((nItemLevel | 0) > 0x0b) {
    baseTier = 2
  }

  if (numSkills <= 0) {
    return
  }

  for (let slot = 0; slot < numSkills; slot = (slot + 1) | 0) {
    let tier = baseTier
    const pItemSeed1 = ITEMS_GetItemSeed113c(m, pItem) >>> 0
    const tierRoll = ((stepSeed64At113c(m, pItemSeed1) >>> 0) % 100) | 0
    if (tierRoll > 0x50) {
      tier = (tier + 1) | 0
    } else if (tierRoll <= 0x1e) {
      if (tierRoll > 0x0a) {
        tier = (tier - 1) | 0
      } else {
        tier = (tier - 2) | 0
      }
    }
    if (tier < 1) {
      tier = 1
    }
    if ((ITEMS_GetItemQuality113c(m, pItem) | 0) === 1 && tier >= 4) {
      tier = 4
    }

    const tierBaseSkill = ((nBaseSkillId | 0) + imul32(tier, 5) - 5) | 0
    let attempts = 6
    let skillId = tierBaseSkill
    while (attempts > 0) {
      const pItemSeed2 = ITEMS_GetItemSeed113c(m, pItem) >>> 0
      const pick = ((stepSeed64At113c(m, pItemSeed2) >>> 0) % 5) | 0
      const candidate = (tierBaseSkill + pick) | 0
      skillId = candidate

      let rejectedByType = false
      const pSkillTxt = DATATBLS_GetSkillsTxtRecord113c(m, candidate) >>> 0
      if (pSkillTxt !== 0) {
        const wITypeA1 = sx16(m.u16((pSkillTxt + 0x18) >>> 0))
        if (wITypeA1 > 0 && ITEMS_CheckItemTypeIdMemPort113c(m, pItem, wITypeA1) === 0) {
          rejectedByType = true
        }
      }

      if (
        !rejectedByType &&
        candidate !== chosenSkills[0] &&
        candidate !== chosenSkills[1] &&
        candidate !== chosenSkills[2]
      ) {
        chosenSkills[slot] = candidate
        break
      }
      attempts = (attempts - 1) | 0
    }

    let sLvl = 1
    const wFmt = ITEMS_GetItemFormat113c(m, pItem) & 0xffff
    if (wFmt < 0x64 || (ITEMS_GetItemQuality113c(m, pItem) | 0) !== 1) {
      const pItemSeed3 = ITEMS_GetItemSeed113c(m, pItem) >>> 0
      const lvlRoll = (((stepSeed64At113c(m, pItemSeed3) >>> 0) % 100) + sdiv32(nBonus | 0, 2)) | 0
      if (lvlRoll >= 0x5a) {
        sLvl = 3
      } else if (lvlRoll >= 0x3c) {
        sLvl = 2
      }
    }

    let pStatList = STATLIST_GetStatListFromUnitStateAndFlag113c(m, pItem, 0, 0x40) >>> 0
    if (pStatList === 0) {
      const dwUnitId = pItem !== 0 ? m.u32((pItem + 0x0c) >>> 0) : 0xffffffff
      const hPool = pItem !== 0 ? m.u32((pItem + 0x08) >>> 0) : 0
      pStatList = STATLIST_AllocStatList113c(m, hPool, 0x40, 0, 4, dwUnitId) >>> 0
      STATLIST_MergeStatLists113c(m, pItem, pStatList, 1)
    }
    if (pStatList !== 0) {
      STATLIST_SetStatIfListIsValid113c(m, pStatList, 0x6b, sLvl, skillId)
    }
  }
}

/**
 * @va D2Game:0x6FC335E0
 */
export function ITEMS_AddStaffModSkillsByTier_6FC335E0_113c(
  m: D2KernMemory113c,
  nItemLevel: number,
  pItem: number,
  nBaseSkillId: number,
): void {
  hitD2GameVa113c(0x6FC335E0)
  if (pItem === 0) {
    return
  }
  const chosenSkills = new Int32Array([-1, -1, -1])
  const pItemSeed0 = ITEMS_GetItemSeed113c(m, pItem) >>> 0
  const countRoll = ((stepSeed64At113c(m, pItemSeed0) >>> 0) % 100) | 0
  let numSkills = 0
  if (countRoll > 0x5a) {
    numSkills = 3
  } else if (countRoll > 0x46) {
    numSkills = 2
  } else if (countRoll > 0x1e) {
    numSkills = 1
  } else {
    return
  }

  let baseTier = 1
  if ((nItemLevel | 0) > 0x18) {
    baseTier = 4
  } else if ((nItemLevel | 0) > 0x12) {
    baseTier = 3
  } else if ((nItemLevel | 0) > 0x0b) {
    baseTier = 2
  }

  if (numSkills <= 0) {
    return
  }

  for (let slot = 0; slot < numSkills; slot = (slot + 1) | 0) {
    let tier = baseTier
    const pItemSeed1 = ITEMS_GetItemSeed113c(m, pItem) >>> 0
    const tierRoll = ((stepSeed64At113c(m, pItemSeed1) >>> 0) % 100) | 0
    if (tierRoll > 0x50) {
      tier = (baseTier + 1) | 0
    } else if (tierRoll <= 0x1e) {
      if (tierRoll > 0x0a) {
        tier = (baseTier - 1) | 0
      } else {
        tier = (baseTier - 2) | 0
      }
    }
    if (tier < 1) {
      tier = 1
    }

    const tierBaseSkill = ((nBaseSkillId | 0) + imul32(tier, 5) - 5) | 0
    let skillId = tierBaseSkill
    for (let guard = 0; guard < 1024; guard = (guard + 1) | 0) {
      const pItemSeed2 = ITEMS_GetItemSeed113c(m, pItem) >>> 0
      const pick = ((stepSeed64At113c(m, pItemSeed2) >>> 0) % 5) | 0
      const candidate = (tierBaseSkill + pick) | 0
      skillId = candidate
      if (
        candidate !== 0x49 &&
        candidate !== chosenSkills[0] &&
        candidate !== chosenSkills[1] &&
        candidate !== chosenSkills[2]
      ) {
        break
      }
    }
    chosenSkills[slot] = skillId

    const pItemSeed3 = ITEMS_GetItemSeed113c(m, pItem) >>> 0
    const lvlRoll = ((stepSeed64At113c(m, pItemSeed3) >>> 0) % 100) | 0
    let sLvl = 1
    if (lvlRoll >= 0x5a) {
      sLvl = 3
    } else if (lvlRoll >= 0x3c) {
      sLvl = 2
    }

    let pStatList = STATLIST_GetStatListFromUnitStateAndFlag113c(m, pItem, 0, 0x40) >>> 0
    if (pStatList === 0) {
      const dwUnitId = pItem !== 0 ? m.u32((pItem + 0x0c) >>> 0) : 0xffffffff
      const hPool = pItem !== 0 ? m.u32((pItem + 0x08) >>> 0) : 0
      pStatList = STATLIST_AllocStatList113c(m, hPool, 0x40, 0, 4, dwUnitId) >>> 0
      STATLIST_MergeStatLists113c(m, pItem, pStatList, 1)
    }
    if (pStatList !== 0) {
      STATLIST_SetStatIfListIsValid113c(m, pStatList, 0x6b, sLvl, skillId)
    }
  }
}

/**
 * @va D2Game:0x6FC337F0
 */
export function ITEMS_ApplyLowQualityItemMods_6FC337F0_113c(
  m: D2KernMemory113c,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FC337F0)
  const pCountPtr = DATATBLS_GetBooksTxtRecordCountPtr113c(m) >>> 0
  const nItemId = pItem !== 0 ? m.u32(pItem + 0x04) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  if (pCountPtr === 0 || pItemsTxt === 0) {
    return 0
  }

  const pItemSeed = ITEMS_GetItemSeed113c(m, pItem) >>> 0
  const cellRoll = rollSeedPtrViaSeedRoll113c(m, pItemSeed, m.u32(pCountPtr) | 0)
  ITEMS_SetItemCell113c(m, pItem, cellRoll)

  if (ITEMS_CanItemLoseDurability113c(m, pItem) !== 0) {
    const nItemId2 = pItem !== 0 ? m.u32(pItem + 0x04) | 0 : -1
    const pItemsTxt2 = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId2) >>> 0
    if (pItemsTxt2 !== 0) {
      const baseDur = m.u8(pItemsTxt2 + 0x112)
      let maxDur = sdiv32(baseDur, 3)
      if (maxDur < 1) {
        maxDur = 1
      }
      const halfDur = maxDur >>> 1
      let curDur = (halfDur + SEED_RollLimitedFast113c(m, (pItem + 0x20) >>> 0, halfDur)) | 0
      if (curDur === 0) {
        curDur = 1
      }
      STATLIST_SetUnitStat113c(m, pItem, 0x48, curDur, 0)
      STATLIST_SetUnitStat113c(m, pItem, 0x49, maxDur, 0)
    }
  }

  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x2d) !== 0) {
    let maxDmg = sdiv32(imul32(STATLIST_GetUnitBaseStat113c(m, pItem, 0x16, 0) | 0, 0x4b), 100)
    if (maxDmg < 2) maxDmg = 2
    STATLIST_SetUnitStat113c(m, pItem, 0x16, maxDmg, 0)

    let minDmg = sdiv32(imul32(STATLIST_GetUnitBaseStat113c(m, pItem, 0x15, 0) | 0, 0x4b), 100)
    if (minDmg < 1) minDmg = 1
    STATLIST_SetUnitStat113c(m, pItem, 0x15, minDmg, 0)

    let twoMaxDmg = sdiv32(imul32(STATLIST_GetUnitBaseStat113c(m, pItem, 0x18, 0) | 0, 0x4b), 100)
    if (twoMaxDmg < 2) twoMaxDmg = 2
    STATLIST_SetUnitStat113c(m, pItem, 0x18, twoMaxDmg, 0)

    let twoMinDmg = sdiv32(imul32(STATLIST_GetUnitBaseStat113c(m, pItem, 0x17, 0) | 0, 0x4b), 100)
    if (twoMinDmg < 1) twoMinDmg = 1
    STATLIST_SetUnitStat113c(m, pItem, 0x17, twoMinDmg, 0)

    if (ITEMS_CheckIfThrowItemMemPort113c(m, pItem) !== 0) {
      const throwMax = ITEMS_ScaleStatByPercentWithMin113c(
        m,
        STATLIST_GetUnitStatWithLayer113c(m, pItem, 0x9f, 0) | 0,
        2,
        0x4b,
      )
      STATLIST_SetUnitStat113c(m, pItem, 0x9f, throwMax, 0)

      const throwMin = ITEMS_ScaleStatByPercentWithMin113c(
        m,
        STATLIST_GetUnitStatWithLayer113c(m, pItem, 0xa0, 0) | 0,
        1,
        0x4b,
      )
      STATLIST_SetUnitStat113c(m, pItem, 0xa0, throwMin, 0)
    }
    return 1
  }

  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x32) !== 0) {
    let ac = sdiv32(imul32(STATLIST_GetUnitBaseStat113c(m, pItem, 0x1f, 0) | 0, 0x4b), 100)
    if (ac <= 0) ac = 1
    STATLIST_SetUnitStat113c(m, pItem, 0x1f, ac, 0)
    return 1
  }

  return 0
}

/**
 * @va D2Game:0x6FC33A30
 */
export function ITEMS_ApplyCraftedOrSetItemCell_6FC33A30_113c(
  m: D2KernMemory113c,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FC33A30)
  const nItemId = pItem !== 0 ? m.u32(pItem + 0x04) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  if (pItemsTxt === 0) {
    return 0
  }

  const pItemSeed = ITEMS_GetItemSeed113c(m, pItem) >>> 0
  const savedSeedLo = m.u32(pItemSeed) >>> 0
  const wItemFormat = ITEMS_GetItemFormat113c(m, pItem) & 0xffff

  let curDur = ((STATLIST_GetUnitStat113c(m, pItem, 0x48, 0) | 0) * 2) | 0
  if (curDur >= 0xff) curDur = 0xff
  let maxDur = ((STATLIST_GetUnitBaseStat113c(m, pItem, 0x49, 0) | 0) * 2) | 0
  if (maxDur >= 0xff) maxDur = 0xff
  STATLIST_SetUnitStat113c(m, pItem, 0x48, curDur, 0)
  STATLIST_SetUnitStat113c(m, pItem, 0x49, maxDur, 0)

  const pDataTables = readSgptDataTables113c(m)
  const nSetsTotal = pDataTables !== 0 ? m.u32(pDataTables + 0xc10) | 0 : 0
  const pSetsTxt = pDataTables !== 0 ? m.u32(pDataTables + 0xc0c) >>> 0 : 0
  let nClassicSets = 0
  if (nSetsTotal > 0 && pSetsTxt !== 0) {
    while (nClassicSets < nSetsTotal) {
      if (m.u16((pSetsTxt + imul32(nClassicSets, 0x128) + 0x04) >>> 0) >= 0x64) {
        break
      }
      nClassicSets = (nClassicSets + 1) | 0
    }
  }

  const pItemSeed2 = ITEMS_GetItemSeed113c(m, pItem) >>> 0
  const startIdx = nClassicSets > 0 ? rollSeedPtrViaSeedRoll113c(m, pItemSeed2, nClassicSets) | 0 : 0
  let chosenSetItemId = -1
  if (nClassicSets > 0 && pSetsTxt !== 0) {
    const dwItemCode = m.u32((pItemsTxt + 0x80) >>> 0) >>> 0
    for (let i = 0; i < nClassicSets; i = (i + 1) | 0) {
      const setIdx = (((i + startIdx) >>> 0) % (nClassicSets >>> 0)) | 0
      const pSetRec = (pSetsTxt + imul32(setIdx, 0x128)) >>> 0
      if (m.u16((pSetRec + 0x04) >>> 0) >= 0x64 && wItemFormat < 0x64) {
        continue
      }
      const numItemsInSet = m.u32((pSetRec + 0x0c) >>> 0) | 0
      for (let j = 0; j < numItemsInSet; j = (j + 1) | 0) {
        const pSetItemPtr = m.u32((pSetRec + 0x110 + (j << 2)) >>> 0) >>> 0
        if (pSetItemPtr !== 0 && (m.u32((pSetItemPtr + 0x28) >>> 0) >>> 0) === dwItemCode) {
          chosenSetItemId = sx16(m.u16(pSetItemPtr))
          break
        }
      }
    }
  }

  if (chosenSetItemId === -1) {
    const pItemSeed3 = ITEMS_GetItemSeed113c(m, pItem) >>> 0
    SEED_InitLowSeed113c(m, pItemSeed3, savedSeedLo)
    return 0
  }

  ITEMS_SetItemCell113c(m, pItem, chosenSetItemId)
  ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x10, 0)
  ITEMS_ApplyItemQualityMods113c(m, 4, 0, pItem, 0, 0, 0)
  return 1
}

/**
 * @va D2Game:0x6FC33C20
 */
export function ITEMS_RollAndApplyUniqueItem_6FC33C20_113c(
  m: D2KernMemory113c,
  pItem: number,
  pItemDrop: number,
): number {
  hitD2GameVa113c(0x6FC33C20)
  const nItemId = pItem !== 0 ? m.u32(pItem + 0x04) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  if (pItemsTxt === 0) {
    return 0
  }

  const wItemFormat = ITEMS_GetItemFormat113c(m, pItem) & 0xffff
  const dwItemCode = m.u32((pItemsTxt + 0x80) >>> 0) >>> 0
  const nItemLvl = ITEMS_GetItemLevel113c(m, pItem) | 0
  const pDataTables = readSgptDataTables113c(m)
  const nSetItemsCount = pDataTables !== 0 ? m.u32(pDataTables + 0xc1c) | 0 : 0
  const pSetItemsTxt = pDataTables !== 0 ? m.u32(pDataTables + 0xc18) >>> 0 : 0
  if (nSetItemsCount <= 0 || pSetItemsTxt === 0) {
    return 0
  }

  const matchIndices = new Int32Array(0x100)
  const matchWeights = new Int32Array(0x100)
  let matchCount = 0
  let totalWeight = 0
  let chosenIdx = -1

  for (let i = 0; i < nSetItemsCount; i = (i + 1) | 0) {
    const pRec = (pSetItemsTxt + imul32(i, 0x1b8)) >>> 0
    if (m.u16((pRec + 0x22) >>> 0) >= 0x64 && wItemFormat < 0x64) {
      continue
    }
    if (sx16(m.u16((pRec + 0x30) >>> 0)) > nItemLvl) {
      continue
    }
    if ((m.u32((pRec + 0x28) >>> 0) >>> 0) !== dwItemCode) {
      continue
    }
    if (m.u16((pRec + 0x2c) >>> 0) === 0x1d && (pItemDrop === 0 || (m.u8((pItemDrop + 0x80) >>> 0) & 1) === 0)) {
      continue
    }
    const forcedIdPlusOne = pItemDrop !== 0 ? m.u32((pItemDrop + 0x40) >>> 0) >>> 0 : 0
    if (forcedIdPlusOne > 0 && ((forcedIdPlusOne - 1) >>> 0) === (i >>> 0)) {
      chosenIdx = i
    }
    const rawRarity = m.u32((pRec + 0x34) >>> 0) | 0
    const weight = rawRarity !== 0 ? rawRarity : 1
    if (matchCount < 0x100) {
      matchIndices[matchCount] = i
      matchWeights[matchCount] = weight
      matchCount = (matchCount + 1) | 0
    }
    totalWeight = (totalWeight + weight) | 0
  }

  if (chosenIdx < 0) {
    if (totalWeight === 0) {
      return 0
    }
    const pItemSeed = ITEMS_GetItemSeed113c(m, pItem) >>> 0
    let roll = totalWeight > 0 ? rollSeedPtrViaSeedRoll113c(m, pItemSeed, totalWeight) | 0 : 0
    let pos = 0
    let found = false
    while (pos < matchCount) {
      const weight = matchWeights[pos]!
      if (roll < weight) {
        found = true
        break
      }
      roll = (roll - weight) | 0
      pos = (pos + 1) | 0
    }
    if (!found) {
      return 0
    }
    chosenIdx = matchIndices[pos]! | 0
  }

  ITEMS_SetItemCell113c(m, pItem, chosenIdx)
  ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x10, 0)
  ITEMS_ApplyItemQualityMods113c(m, 4, 0, pItem, 0, 0, 0)
  return 1
}

/**
 * @va D2Game:0x6FC33E60
 */
export function ITEMS_ApplyLowQualityAndSpawnMods_6FC33E60_113c(
  m: D2KernMemory113c,
  pItem: number,
  pItemDrop: number,
): number {
  hitD2GameVa113c(0x6FC33E60)
  const pCountPtr = DATATBLS_GetBooksTxtRecordCountPtr113c(m) >>> 0
  const nItemId = pItem !== 0 ? m.u32(pItem + 0x04) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  if (pCountPtr === 0 || pItemsTxt === 0) {
    return 0
  }

  const pItemSeed = ITEMS_GetItemSeed113c(m, pItem) >>> 0
  const cellRoll = rollSeedPtrViaSeedRoll113c(m, pItemSeed, m.u32(pCountPtr) | 0)
  ITEMS_SetItemCell113c(m, pItem, cellRoll)

  let bApplied = 0
  if (ITEMS_CanItemLoseDurability113c(m, pItem) !== 0) {
    const nItemId2 = pItem !== 0 ? m.u32(pItem + 0x04) | 0 : -1
    const pItemsTxt2 = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId2) >>> 0
    if (pItemsTxt2 !== 0) {
      const baseDur = m.u8(pItemsTxt2 + 0x112)
      let maxDur = sdiv32(imul32(baseDur, 0x21), 100)
      if (maxDur < 1) {
        maxDur = 1
      }
      const halfDur = maxDur >>> 1
      let curDur = (halfDur + SEED_RollLimitedFast113c(m, (pItem + 0x20) >>> 0, halfDur)) | 0
      if (curDur === 0) {
        curDur = 1
      }
      STATLIST_SetUnitStat113c(m, pItem, 0x48, curDur, 0)
      STATLIST_SetUnitStat113c(m, pItem, 0x49, maxDur, 0)
    }
  }

  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x2d) !== 0) {
    let maxDmg = sdiv32(imul32(STATLIST_GetUnitBaseStat113c(m, pItem, 0x16, 0) | 0, 0x4b), 100)
    if (maxDmg < 2) maxDmg = 2
    STATLIST_SetUnitStat113c(m, pItem, 0x16, maxDmg, 0)

    let minDmg = sdiv32(imul32(STATLIST_GetUnitBaseStat113c(m, pItem, 0x15, 0) | 0, 0x4b), 100)
    if (minDmg < 1) minDmg = 1
    STATLIST_SetUnitStat113c(m, pItem, 0x15, minDmg, 0)

    let twoMaxDmg = sdiv32(imul32(STATLIST_GetUnitBaseStat113c(m, pItem, 0x18, 0) | 0, 0x4b), 100)
    if (twoMaxDmg < 2) twoMaxDmg = 2
    STATLIST_SetUnitStat113c(m, pItem, 0x18, twoMaxDmg, 0)

    let twoMinDmg = sdiv32(imul32(STATLIST_GetUnitBaseStat113c(m, pItem, 0x17, 0) | 0, 0x4b), 100)
    if (twoMinDmg < 1) twoMinDmg = 1
    STATLIST_SetUnitStat113c(m, pItem, 0x17, twoMinDmg, 0)

    if (ITEMS_CheckIfThrowItemMemPort113c(m, pItem) !== 0) {
      const throwMax = ITEMS_ScaleStatByPercentWithMin113c(
        m,
        STATLIST_GetUnitStatWithLayer113c(m, pItem, 0x9f, 0) | 0,
        2,
        0x4b,
      )
      STATLIST_SetUnitStat113c(m, pItem, 0x9f, throwMax, 0)

      const throwMin = ITEMS_ScaleStatByPercentWithMin113c(
        m,
        STATLIST_GetUnitStatWithLayer113c(m, pItem, 0xa0, 0) | 0,
        1,
        0x4b,
      )
      STATLIST_SetUnitStat113c(m, pItem, 0xa0, throwMin, 0)
    }
    bApplied = 1
  } else if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x32) !== 0) {
    let ac = sdiv32(imul32(STATLIST_GetUnitBaseStat113c(m, pItem, 0x1f, 0) | 0, 0x4b), 100)
    if (ac <= 0) ac = 1
    STATLIST_SetUnitStat113c(m, pItem, 0x1f, ac, 0)
    bApplied = 1
  }

  ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, pItem, pItemDrop)
  return bApplied
}

/**
 * @va D2Game:0x6FC340B0
 */
export function ITEMS_ApplyHighQualitySuperiorMods_6FC340B0_113c(
  m: D2KernMemory113c,
  pItem: number,
  pItemDrop: number,
): number {
  hitD2GameVa113c(0x6FC340B0)
  const pCountPtr = DATATBLS_GetBeltsTxtRecordCountPtr113c(m) >>> 0
  const nItemId = pItem !== 0 ? m.u32(pItem + 0x04) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  if (pCountPtr === 0 || pItemsTxt === 0) {
    return 0
  }

  let nQualityCount = m.u32(pCountPtr) | 0
  if (ITEMS_CheckIfThrowItemMemPort113c(m, pItem) !== 0 || m.u8(pItemsTxt + 0x113) !== 0) {
    nQualityCount = 4
  }

  const tried = new Uint8Array(Math.max(16, nQualityCount > 0 ? nQualityCount : 0))
  while (true) {
    const pItemSeed = ITEMS_GetItemSeed113c(m, pItem) >>> 0
    let pick = 0
    if (nQualityCount > 0) {
      const newLo = stepSeed64At113c(m, pItemSeed)
      if ((nQualityCount & (nQualityCount - 1)) !== 0) {
        pick = ((newLo >>> 0) % (nQualityCount >>> 0)) | 0
      } else {
        pick = (newLo & (nQualityCount - 1)) | 0
      }
    }
    if (tried[pick] !== 0) {
      continue
    }
    const pQualityTxt = DATATBLS_GetBeltsTxtRecord113c(m, pick) >>> 0
    if (pQualityTxt === 0) {
      return 0
    }
    if (ITEMS_CheckQualityItemMatch113c(m, pItem, pQualityTxt) !== 0) {
      ITEMS_SetItemCell113c(m, pItem, pick)
      ITEMS_ApplyItemQualityMods113c(m, 1, 0, pItem, pQualityTxt, 0, 0)
      ITEMS_RollStaffModsOnItem_6FC33DE0_113c(m, pItem, pItemDrop)
      return 1
    }
    tried[pick] = 1
    let hasUntried = false
    for (let i = 0; i < nQualityCount; i = (i + 1) | 0) {
      if (tried[i] === 0) {
        hasUntried = true
        break
      }
    }
    if (!hasUntried) {
      return 0
    }
  }
}

/**
 * @va D2Game:0x6FC34210
 */
export function ITEMS_RollRarePrefixId_6FC34210_113c(
  m: D2KernMemory113c,
  bIsPrefix: number,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FC34210)
  const pRareTables = DATATBLS_GetRareAffixDataTables113c(m) >>> 0
  if (pRareTables === 0) {
    return 0
  }
  const pSubTable = bIsPrefix !== 0 ? m.u32(pRareTables + 0x0c) : m.u32(pRareTables + 0x08)
  if (pSubTable === 0) {
    return 0
  }

  const pBaseTable = m.u32(pRareTables + 0x04)
  const startIndex = sdiv32((pSubTable - pBaseTable) | 0, 0x48)
  let countBytes = 0
  if (bIsPrefix !== 0) {
    const nTotal = m.u32(pRareTables) | 0
    countBytes = (imul32(nTotal, 0x48) - pSubTable + pBaseTable) | 0
  } else {
    countBytes = (m.u32(pRareTables + 0x0c) - m.u32(pRareTables + 0x08)) | 0
  }
  const count = sdiv32(countBytes, 0x48)
  if (count <= 0) {
    return 0
  }

  const matchedIds = new Int32Array(0x200)
  let matchCount = 0
  let pRec = pSubTable
  for (let i = 0; i < count; i = (i + 1) | 0, pRec = (pRec + 0x48) >>> 0) {
    if (ITEMS_CheckAffixAssignableToItem113c(m, pItem, pRec) !== 0 && matchCount < 0x1ff) {
      matchedIds[matchCount] = (startIndex + i) | 0
      matchCount = (matchCount + 1) | 0
    }
  }

  if (matchCount <= 0) {
    return 0
  }
  const pItemSeed = ITEMS_GetItemSeed113c(m, pItem) >>> 0
  let pick = 0
  if (matchCount > 0) {
    const newLo = stepSeed64At113c(m, pItemSeed)
    if ((matchCount & (matchCount - 1)) !== 0) {
      pick = ((newLo >>> 0) % (matchCount >>> 0)) | 0
    } else {
      pick = (newLo & (matchCount - 1)) | 0
    }
  }
  if (pick >= matchCount) {
    return 0
  }
  return ((matchedIds[pick]! + 1) & 0xffff) | 0
}

/**
 * Classic-format (`wItemFormat < 1`) rare name ID roller (`0x6FC34370..0x6FC344C8`, `345B`).
 * Reads `DATATBLS_GetRareAffixDataTables113c` (`+0x08` rare suffix slice when `bIsPrefix == 0`,
 * `+0x0C` rare prefix slice when `bIsPrefix != 0`), filters up to `0x1FF` `0x48`-byte records via
 * `D2Common.#10110` (`ITEMS_CheckAffixAssignableToItem113c`), advances `ITEMS_GetItemSeed113c`
 * via the `0x6AC690C5` 64-bit LCG, and returns the 1-based combined rare-affix ID (`u16`).
 *
 * @va D2Game:0x6FC34370 (345B)
 */
export function ITEMS_RollRareSuffixId_6FC34370_113c(
  m: D2KernMemory113c,
  bIsPrefix: number,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FC34370)
  const pRareTables = DATATBLS_GetRareAffixDataTables113c(m) >>> 0
  if (pRareTables === 0) {
    return 0
  }
  const pSubTable = bIsPrefix !== 0 ? m.u32(pRareTables + 0x0c) : m.u32(pRareTables + 0x08)
  if (pSubTable === 0) {
    return 0
  }

  const pBaseTable = m.u32(pRareTables + 0x04)
  const startIndex = sdiv32((pSubTable - pBaseTable) | 0, 0x48)
  let countBytes = 0
  if (bIsPrefix !== 0) {
    const nTotal = m.u32(pRareTables) | 0
    countBytes = (imul32(nTotal, 0x48) - pSubTable + pBaseTable) | 0
  } else {
    countBytes = (m.u32(pRareTables + 0x0c) - m.u32(pRareTables + 0x08)) | 0
  }
  const count = sdiv32(countBytes, 0x48)
  if (count <= 0) {
    return 0
  }

  const matchedIds = new Int32Array(0x200)
  let matchCount = 0
  let pRec = pSubTable
  for (let i = 0; i < count; i = (i + 1) | 0, pRec = (pRec + 0x48) >>> 0) {
    if (ITEMS_CheckAffixAssignableToItem113c(m, pItem, pRec) !== 0 && matchCount < 0x1ff) {
      matchedIds[matchCount] = (startIndex + i) | 0
      matchCount = (matchCount + 1) | 0
    }
  }

  if (matchCount <= 0) {
    return 0
  }
  const pItemSeed = ITEMS_GetItemSeed113c(m, pItem) >>> 0
  let pick = 0
  if (matchCount > 0) {
    const newLo = stepSeed64At113c(m, pItemSeed)
    if ((matchCount & (matchCount - 1)) !== 0) {
      pick = ((newLo >>> 0) % (matchCount >>> 0)) | 0
    } else {
      pick = (newLo & (matchCount - 1)) | 0
    }
  }
  if (pick >= matchCount) {
    return 0
  }
  return ((matchedIds[pick]! + 1) & 0xffff) | 0
}

/**
 * @va D2Game:0x6FC344D0
 */
export function ITEMS_RollMagicAffixId_6FC344D0_113c(
  m: D2KernMemory113c,
  pItem: number,
  bAllowMagicOnly: number,
  bForceRoll: number,
  bApplyProps: number,
  bIsPrefix: number,
  nForcedIndex: number,
  dwRequiredGroup: number,
): number {
  hitD2GameVa113c(0x6FC344D0)
  const pMagicTables = DATATBLS_GetMagicAffixDataTables113c(m) >>> 0
  if (pMagicTables === 0) {
    return 0
  }

  let pSubTable = 0
  let pEndTable = 0
  if (dwRequiredGroup !== 0) {
    const nTotal = m.u32(pMagicTables) | 0
    const pBase = m.u32(pMagicTables + 0x04)
    pSubTable = m.u32(pMagicTables + 0x10)
    pEndTable = (pBase + imul32(nTotal, 0x90)) >>> 0
  } else if (bIsPrefix !== 0) {
    pSubTable = m.u32(pMagicTables + 0x0c)
    pEndTable = m.u32(pMagicTables + 0x10)
  } else {
    pSubTable = m.u32(pMagicTables + 0x08)
    pEndTable = m.u32(pMagicTables + 0x0c)
  }

  const count = sdiv32((pEndTable - pSubTable) | 0, 0x90)
  if (pSubTable === 0) {
    return 0
  }

  const pBase = m.u32(pMagicTables + 0x04)
  const startIndex = sdiv32((pSubTable - pBase) | 0, 0x90)
  const pItemSeed = ITEMS_GetItemSeed113c(m, pItem) >>> 0
  const coinFlip = stepSeed64At113c(m, pItemSeed) & 1
  const wItemFormat = ITEMS_GetItemFormat113c(m, pItem) & 0xffff
  const nBaseQlvl = ITEMS_GetBaseLevel113c(m, pItem) & 0xff

  if (coinFlip === 0 && bForceRoll === 0) {
    return 0
  }

  let ilvl = ITEMS_GetItemLevel113c(m, pItem) | 0
  const nItemId = pItem !== 0 ? m.u32(pItem + 0x04) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  if (pItemsTxt === 0) {
    return 0
  }

  if (ilvl <= nBaseQlvl) {
    ilvl = nBaseQlvl
  }
  const nMagicLvl = m.u8(pItemsTxt + 0x140)
  if (nMagicLvl !== 0) {
    ilvl = (ilvl + nMagicLvl) | 0
  } else {
    const halfQlvl = (nBaseQlvl / 2) | 0
    const threshold = (0x63 - halfQlvl) | 0
    if (ilvl < threshold) {
      ilvl = (ilvl - halfQlvl) | 0
    } else {
      ilvl = (ilvl * 2 - halfQlvl - threshold) | 0
    }
  }
  if (ilvl <= 1) {
    ilvl = 1
  } else if (ilvl >= 0x63) {
    ilvl = 0x63
  }

  if (count <= 0) {
    return 0
  }

  const matchIndices = new Int32Array(0x200)
  const matchRecs = new Uint32Array(0x200)
  let matchCount = 0
  let totalWeight = 0

  let chosenIdx = -1
  let chosenRec = 0

  for (let i = 0; i < count; i = (i + 1) | 0) {
    const pRec = (pSubTable + imul32(i, 0x90)) >>> 0
    if (bAllowMagicOnly !== 0 && m.u8(pRec + 0x54) === 0) {
      continue
    }
    if (m.u16(pRec + 0x22) >= 0x64 && wItemFormat < 0x64) {
      continue
    }

    let bForcedMatch = 0
    if (nForcedIndex > 0 && (nForcedIndex - 1) === i) {
      bForcedMatch = 1
    } else {
      const reqLvl = m.u32(pRec + 0x58) | 0
      if (reqLvl > ilvl) {
        continue
      }
      const maxLvl = m.u32(pRec + 0x60) | 0
      if (maxLvl !== 0 && maxLvl < ilvl) {
        continue
      }
    }

    if (m.u8(pRec + 0x64) === 0) {
      const nQuality = ITEMS_GetItemQuality113c(m, pItem) | 0
      if (nQuality === 6 || (nQuality > 7 && nQuality <= 9)) {
        continue
      }
    }

    if (ITEMS_EvalItemPropertyList113c(m, pItem, pRec) === 0) {
      continue
    }

    const dwRecGroup = m.u32(pRec + 0x5c)
    if (dwRequiredGroup !== 0 && dwRequiredGroup !== dwRecGroup) {
      continue
    }

    const nFreq = m.u8(pRec + 0x82)
    if (nFreq === 0) {
      continue
    }

    const nClassSpecific = m.u8(pRec + 0x66)
    if (nClassSpecific !== 0xff) {
      const itemClass = ITEMS_GetClassOfClassSpecificItem113c(m, pItem) | 0
      if (itemClass !== 7 && itemClass !== nClassSpecific) {
        continue
      }
    }

    if (ITEMS_HasAffixGroupOnItem113c(m, pItem, dwRecGroup) !== 0) {
      continue
    }

    if (bForcedMatch !== 0) {
      const forcedIdx = (startIndex + i) | 0
      if (forcedIdx >= 0) {
        chosenIdx = forcedIdx
        chosenRec = pRec
        break
      }
    } else {
      if (matchCount < 0x1ff) {
        matchIndices[matchCount] = (startIndex + i) | 0
        matchRecs[matchCount] = pRec
        matchCount = (matchCount + 1) | 0
      }
      if (nMagicLvl !== 0) {
        totalWeight = (totalWeight + imul32(nFreq, m.u32(pRec + 0x58) | 0)) | 0
      } else {
        totalWeight = (totalWeight + nFreq) | 0
      }
    }
  }

  if (chosenIdx < 0) {
    if (matchCount <= 0) {
      return 0
    }
    const pSeed2 = ITEMS_GetItemSeed113c(m, pItem) >>> 0
    let roll = SEED_RollRangeWithMinFast113c(m, pSeed2, 0, (totalWeight + 1) | 0) | 0
    let pos = 0
    while (pos < matchCount) {
      const pRec = matchRecs[pos]!
      const nFreq = m.u8(pRec + 0x82)
      const weight = nMagicLvl !== 0 ? imul32(nFreq, m.u32(pRec + 0x58) | 0) : nFreq
      roll = (roll - weight) | 0
      if (roll < 0) {
        break
      }
      pos = (pos + 1) | 0
    }
    if (pos >= matchCount) {
      pos = (matchCount - 1) | 0
    }
    chosenIdx = matchIndices[pos]! | 0
    chosenRec = matchRecs[pos]!
  }

  if (bApplyProps !== 0) {
    ITEMS_ApplyItemQualityMods113c(m, 0, 0, pItem, chosenRec, 0, 0)
  }
  return ((chosenIdx + 1) & 0xffff) | 0
}

function getUnitPosXInline113c(m: D2KernMemory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const dwType = m.u32(pUnit) | 0
  const pPath = m.u32(pUnit + 0x2c) >>> 0
  if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
    return pPath !== 0 ? m.u32(pPath + 0x0c) | 0 : 0
  }
  return pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
}

function getUnitPosYInline113c(m: D2KernMemory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const dwType = m.u32(pUnit) | 0
  const pPath = m.u32(pUnit + 0x2c) >>> 0
  if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
    return pPath !== 0 ? m.u32(pPath + 0x10) | 0 : 0
  }
  return pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
}

function getMonsterAiControlPtr113c(m: D2KernMemory113c, pUnit: number): number {
  if (pUnit !== 0 && m.u32(pUnit) === 1) {
    const pMonData = m.u32(pUnit + 0x14) >>> 0
    if (pMonData !== 0) {
      return m.u32(pMonData + 0x2c) >>> 0
    }
  }
  return 0
}

function resolveMonsterAttackSpeedByte113c(
  m: D2KernMemory113c,
  pUnit: number,
  nBitIndex: number,
): number {
  if (pUnit === 0) {
    return 0x64
  }
  const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32(pUnit + 0x04) | 0) >>> 0
  if (pMonStats2 === 0) {
    return 0x64
  }
  const flags = m.u8(pMonStats2 + 0x104)
  if ((flags & readGdwBitMasks113c(m, nBitIndex)) !== 0) {
    return 0x65
  }
  return 0x64
}

function invokeMonsterStartMode113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nMode: number,
  pTarget: number,
  nSpeedByte: number,
): number {
  const pScratch = allocZeroedScratch113c(m, 0x24)
  m.setU32(pScratch + 0x00, nMode >>> 0)
  m.setU32(pScratch + 0x04, pUnit >>> 0)
  m.setU32(pScratch + 0x08, pTarget >>> 0)
  m.setU8(pScratch + 0x15, nSpeedByte & 0xff)
  const pPath = pUnit !== 0 ? m.u32(pUnit + 0x2c) >>> 0 : 0
  if (pPath === 0) {
    m.setU32(pUnit + 0x10, nMode >>> 0)
    return 1
  }
  const fakeWorld = {
    m,
    pGame,
    pathUnitByPtr: new Map(),
  } as unknown as Parameters<typeof MONSTER_StartMode113c>[0]
  try {
    return MONSTER_StartMode113c(fakeWorld, pUnit, nMode, pTarget, 0, 0) ? 1 : 0
  } catch {
    m.setU32(pUnit + 0x10, nMode >>> 0)
    return 1
  }
}

function invokeAiStall113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nDelay: number,
): void {
  const fakeWorld = {
    m,
    pGame,
    pathUnitByPtr: new Map(),
  } as unknown as Parameters<typeof AI_Stall113c>[0]
  try {
    AI_Stall113c(fakeWorld, pUnit, nDelay)
  } catch {
    if (pUnit !== 0) {
      m.setU32(pUnit + 0x10, 1)
    }
  }
}

function invokeAiApproachTarget113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pTarget: number,
  nMode: number,
  targetX: number,
  targetY: number,
  nStepNum: number,
  nFlags: number,
): number {
  const fakeWorld = {
    m,
    pGame,
    pathUnitByPtr: new Map(),
  } as unknown as Parameters<typeof AI_ApproachTarget113c>[0]
  try {
    return AI_ApproachTarget113c(
      fakeWorld,
      pUnit,
      pTarget,
      nMode,
      targetX,
      targetY,
      nStepNum,
      nFlags,
    )
      ? 1
      : 0
  } catch {
    if (pUnit !== 0) {
      m.setU32(pUnit + 0x10, nMode >>> 0)
    }
    return 0
  }
}

/**
 * @va D2Game:0x6FC348A0
 */
export function ITEMS_RollAutoMagicAffixId_6FC348A0_113c(
  m: D2KernMemory113c,
  pItem: number,
  bAllowMagicOnly: number,
  bForceRoll: number,
  bApplyProps: number,
  bIsPrefix: number,
  nForcedIndex: number,
): number {
  hitD2GameVa113c(0x6FC348A0)
  const pMagicTables = DATATBLS_GetMagicAffixDataTables113c(m) >>> 0
  if (pMagicTables === 0) {
    return 0
  }

  let pSubTable = 0
  let pEndTable = 0
  if (bIsPrefix !== 0) {
    pSubTable = m.u32(pMagicTables + 0x0c)
    pEndTable = m.u32(pMagicTables + 0x10)
  } else {
    pSubTable = m.u32(pMagicTables + 0x08)
    pEndTable = m.u32(pMagicTables + 0x0c)
  }

  const count = sdiv32((pEndTable - pSubTable) | 0, 0x90)
  if (pSubTable === 0) {
    return 0
  }

  const pBase = m.u32(pMagicTables + 0x04)
  const startIndex = sdiv32((pSubTable - pBase) | 0, 0x90)
  const pItemSeed = ITEMS_GetItemSeed113c(m, pItem) >>> 0
  const coinFlip = stepSeed64At113c(m, pItemSeed) & 1
  const wItemFormat = ITEMS_GetItemFormat113c(m, pItem) & 0xffff

  if (coinFlip === 0 && bForceRoll === 0) {
    return 0
  }

  let ilvl = (ITEMS_GetItemLevel113c(m, pItem) + 2) | 0
  if (ilvl <= 1) {
    ilvl = 1
  } else if (ilvl >= 0x63) {
    ilvl = 0x63
  }

  if (count <= 0) {
    return 0
  }

  const matchIndices = new Int32Array(0x200)
  const matchRecs = new Uint32Array(0x200)
  let matchCount = 0

  for (let i = 0; i < count; i = (i + 1) | 0) {
    const pRec = (pSubTable + imul32(i, 0x90)) >>> 0
    if (bAllowMagicOnly !== 0 && m.u8(pRec + 0x54) === 0) {
      continue
    }
    if (m.u16(pRec + 0x22) >= 0x64 && wItemFormat < 0x64) {
      continue
    }
    if ((m.u32(pRec + 0x58) | 0) > ilvl) {
      continue
    }
    if (ITEMS_EvalItemPropertyList113c(m, pItem, pRec) === 0) {
      continue
    }
    if (matchCount < 0x1ff) {
      matchIndices[matchCount] = (startIndex + i) | 0
      matchRecs[matchCount] = pRec
      matchCount = (matchCount + 1) | 0
    }
  }

  if (matchCount <= 0) {
    return 0
  }

  const pSeed2 = ITEMS_GetItemSeed113c(m, pItem) >>> 0
  const pick = SEED_RollRangeWithMinFast113c(m, pSeed2, 0, matchCount) | 0
  if (pick < 0 || pick >= matchCount) {
    return 0
  }

  let chosenIdx = matchIndices[pick]! | 0
  let chosenRec = matchRecs[pick]!

  if (nForcedIndex > 0) {
    const targetIdx = (nForcedIndex + startIndex) | 0
    if (targetIdx > 0) {
      const wanted = (targetIdx - 1) | 0
      let found = false
      for (let k = 0; k < matchCount; k = (k + 1) | 0) {
        if (matchIndices[k] === wanted) {
          chosenIdx = matchIndices[k]! | 0
          chosenRec = matchRecs[k]!
          found = true
          break
        }
      }
      if (!found) {
        chosenIdx = -1
      }
    }
  }

  if (bApplyProps !== 0) {
    ITEMS_ApplyItemQualityMods113c(m, 0, 0, pItem, chosenRec, 0, 0)
  }

  return ((chosenIdx + 1) & 0xffff) | 0
}

/**
 * @va D2Game:0x6FC359B0
 */
export function AI_InitBaalThroneTentaclePositionDelta_6FC359B0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC359B0)
  let pOwner = 0
  if (pUnit !== 0 && m.u32(pUnit) === 1) {
    const pMonsterData = m.u32(pUnit + 0x14) >>> 0
    if (pMonsterData !== 0) {
      const pAiGeneral = m.u32(pMonsterData + 0x28) >>> 0
      if (pAiGeneral !== 0) {
        const pGame = m.u32(pAiGeneral + 0x28) >>> 0
        if (pGame !== 0) {
          const dwOwnerGuid = m.u32(pAiGeneral + 0x2c)
          const dwOwnerType = m.u32(pAiGeneral + 0x30)
          pOwner = SUNIT_GetServerUnit113c(m, pGame, dwOwnerType, dwOwnerGuid) >>> 0
        }
      }
    }
  }

  if (pOwner === 0) {
    throw new D2CommonAssertError('pOwner != NULL', 0xe17)
  }

  const ownerX = getUnitPosXInline113c(m, pOwner)
  const ownerY = getUnitPosYInline113c(m, pOwner)
  const selfX = getUnitPosXInline113c(m, pUnit)
  const selfY = getUnitPosYInline113c(m, pUnit)

  const pAiParam = m.u32(pAiThinkArg) >>> 0
  m.setU32(pAiParam + 0x14, (selfX - ownerX) >>> 0)
  m.setU32(pAiParam + 0x18, (selfY - ownerY) >>> 0)

  if (pOwner === pUnit) {
    const newLo = stepSeed64At113c(m, (pUnit + 0x20) >>> 0)
    m.setU32(pAiParam + 0x1c, ((newLo >>> 0) % 100) >>> 0)
  }
}

/**
 * @va D2Game:0x6FC35B00
 */
export function AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pCandidate: number,
  pMaxDistSq: number,
): number {
  hitD2GameVa113c(0x6FC35B00)
  if (pUnit === pCandidate || pCandidate === 0 || m.u32(pCandidate) !== 1) {
    return 0
  }
  if (MONSTERS_IsDead113c(m, pCandidate) !== 0) {
    return 0
  }

  const pDataTables = readSgptDataTables113c(m)
  const nMonStatsCount = pDataTables !== 0 ? m.u32(pDataTables + 0xa80) | 0 : 0
  const expectedClassId = nMonStatsCount > 0x1ec ? 0x1ec : -1

  if (MONSTER_GetBaseIdFromUnit113c(m, pCandidate) !== expectedClassId) {
    return 0
  }
  if (UNITS_AreUnitsAligned113c(m, pUnit, pCandidate) === 0) {
    return 0
  }
  if (UNIT_GetAlignment113c(m, pCandidate) !== 0) {
    return 0
  }
  if (SUNIT_GetOwnerUnit113c(m, pUnit, pGame) !== 0) {
    return 0
  }

  const pAiGeneral = MONSTER_GetAiGeneralPtr_6FC218E0_113c(m, pCandidate) >>> 0
  if ((m.u32(pAiGeneral + 0x14) | 0) !== -1) {
    return 0
  }

  const distSq = UNIT_CalcSqDistSubtiles113c(m, pUnit, pCandidate) | 0
  const maxDistSq = m.u32(pMaxDistSq) | 0
  return distSq <= maxDistSq ? pCandidate : 0
}

/**
 * @va D2Game:0x6FC35E00
 */
export function AI_ThinkBaalThroneSpawner_6FC35E00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC35E00)
  const pMonStatsTxt = m.u32(pAiThinkArg + 0x1c) >>> 0
  const pTarget = m.u32(pAiThinkArg + 0x08) >>> 0
  const nDist = m.u32(pAiThinkArg + 0x14) | 0
  const pAiParam = m.u32(pAiThinkArg) >>> 0

  if (pTarget === 0) {
    invokeAiStall113c(m, pGame, pUnit, 0x14)
    return
  }

  if ((m.u32(pAiParam + 0x3c) | 0) === -1) {
    const bSelected = AI_SelectBaalThroneSpawnClassId113c(
      m,
      pUnit,
      pGame,
      (pAiParam + 0x3c) >>> 0,
    )
    if ((bSelected & 0xff) === 0) {
      if (pUnit !== 0) {
        m.setU32(pUnit + 0xc4, (m.u32(pUnit + 0xc4) | 0x20000) >>> 0)
      }
      SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
      invokeMonsterStartMode113c(m, pGame, pUnit, 0, 0, 0x64)
      return
    }
  }

  if (nDist > 0x14) {
    invokeAiStall113c(m, pGame, pUnit, 0x14)
    return
  }

  const nDiff = m.u8(pGame + 0x6d)
  const maxSpawns = sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x62))
  if ((m.u32(pAiParam + 0x18) | 0) >= maxSpawns) {
    if (pUnit !== 0) {
      m.setU32(pUnit + 0xc4, (m.u32(pUnit + 0xc4) | 0x20000) >>> 0)
    }
    AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(m, pUnit, 0, pGame, 0, 0)
    return
  }

  const dwGameFrame = m.u32(pGame + 0xa8) | 0
  let deltaFrames = (dwGameFrame - (m.u32(pAiParam + 0x14) | 0)) | 0
  if (deltaFrames < 0) {
    deltaFrames = (-deltaFrames) | 0
  }
  const minDelay = sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x56))
  if (deltaFrames < minDelay) {
    invokeAiStall113c(m, pGame, pUnit, 0x14)
    return
  }

  m.setU32(pAiParam + 0x14, dwGameFrame >>> 0)
  const pDataTables = readSgptDataTables113c(m)
  const nMonStatsCount = pDataTables !== 0 ? m.u32(pDataTables + 0xa80) | 0 : 0
  const nSpawnCheckId = nMonStatsCount > 0x210 ? 0x210 : -1

  const posY = UNIT_GetPosY113c(m, pUnit)
  const posX = UNIT_GetPosX113c(m, pUnit)
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0

  if (MONSTER_CheckSpawnTileFree113c(m, pRoom, nSpawnCheckId, posY, posX, 0) === 0) {
    invokeAiStall113c(m, pGame, pUnit, 0x14)
    return
  }

  const nextCount = ((m.u32(pAiParam + 0x18) | 0) + 1) | 0
  m.setU32(pAiParam + 0x18, nextCount >>> 0)
  AI_CastSkillMode14_113c(m, pUnit, 0xa7, pGame, pTarget, 0, 0)
}

/**
 * @va D2Game:0x6FC36270
 */
export function AI_ThinkBloodLordFrenzy_6FC36270_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC36270)
  const pMonStatsTxt = m.u32(pAiThinkArg + 0x1c) >>> 0
  const pAiParam = m.u32(pAiThinkArg) >>> 0
  const pTarget = m.u32(pAiThinkArg + 0x08) >>> 0

  if (m.u32(pAiParam + 0x18) === 0) {
    const nDiff = m.u8(pGame + 0x6d)
    m.setU32(pAiParam + 0x18, sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x56)) >>> 0)
  }

  const dwGameFrame = m.u32(pGame + 0xa8) | 0
  if (dwGameFrame < (m.u32(pAiParam + 0x1c) | 0)) {
    invokeAiStall113c(m, pGame, pUnit, 0x0a)
    return
  }

  const wSkill0 = sx16(m.u16(pMonStatsTxt + 0x170))
  if (wSkill0 >= 0 && m.u32(pAiParam + 0x14) === 0) {
    const nMode = m.u8(pMonStatsTxt + 0x180)
    AI_CastSkillWithMode113c(m, nMode, pUnit, pGame, wSkill0, pTarget, 0, 0)
    const rem = ((m.u32(pAiParam + 0x18) | 0) - 1) | 0
    m.setU32(pAiParam + 0x18, rem >>> 0)
    const nDiff = m.u8(pGame + 0x6d)
    if (rem <= 0) {
      m.setU32(pAiParam + 0x14, 1)
      m.setU32(pAiParam + 0x18, sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x68)) >>> 0)
      m.setU32(
        pAiParam + 0x1c,
        ((m.u32(pGame + 0xa8) | 0) + sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x62))) >>> 0,
      )
      return
    }
    m.setU32(
      pAiParam + 0x1c,
      ((m.u32(pGame + 0xa8) | 0) + sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x5c))) >>> 0,
    )
    return
  }

  SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
  const nSpeedByte = resolveMonsterAttackSpeedByte113c(m, pUnit, 4)
  invokeMonsterStartMode113c(m, pGame, pUnit, 4, pTarget, nSpeedByte)

  const rem = ((m.u32(pAiParam + 0x18) | 0) - 1) | 0
  m.setU32(pAiParam + 0x18, rem >>> 0)
  const nDiff = m.u8(pGame + 0x6d)
  if (rem <= 0) {
    m.setU32(pAiParam + 0x14, 0)
    m.setU32(pAiParam + 0x18, sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x56)) >>> 0)
    m.setU32(
      pAiParam + 0x1c,
      ((m.u32(pGame + 0xa8) | 0) + sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x6e))) >>> 0,
    )
    return
  }
  m.setU32(
    pAiParam + 0x1c,
    ((m.u32(pGame + 0xa8) | 0) + sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x74))) >>> 0,
  )
}

/**
 * @va D2Game:0x6FC364A0
 */
export function AI_ThinkPainWormSpawner_6FC364A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC364A0)
  const pTarget = m.u32(pAiThinkArg + 0x08) >>> 0
  const nDiff = m.u8(pGame + 0x6d)
  const pMonStatsTxt = m.u32(pAiThinkArg + 0x1c) >>> 0
  const maxDist = sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x5c))
  const nDist = m.u32(pAiThinkArg + 0x14) | 0
  const pAiParam = m.u32(pAiThinkArg) >>> 0

  if (nDist > maxDist) {
    invokeAiStall113c(m, pGame, pUnit, 0x19)
    return
  }

  const maxSpawns = sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x56))
  if ((m.u32(pAiParam + 0x18) | 0) > maxSpawns) {
    if (pUnit !== 0) {
      m.setU32(pUnit + 0xc4, (m.u32(pUnit + 0xc4) | 0x20000) >>> 0)
    }
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
    invokeMonsterStartMode113c(m, pGame, pUnit, 0, 0, 0x64)
    return
  }

  if (
    sx16(m.u16(pMonStatsTxt + 0x170)) < 0 ||
    (m.u32(pGame + 0xa8) | 0) <= (m.u32(pAiParam + 0x14) | 0)
  ) {
    invokeAiStall113c(m, pGame, pUnit, 0x19)
    return
  }

  const pDataTables = readSgptDataTables113c(m)
  const nMonStatsCount = pDataTables !== 0 ? m.u32(pDataTables + 0xa80) | 0 : 0
  const nSpawnCheckId = nMonStatsCount > 0x14e ? 0x14e : -1

  const posY = UNIT_GetPosY113c(m, pUnit)
  const posX = UNIT_GetPosX113c(m, pUnit)
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0

  if (MONSTER_CheckSpawnTileFree113c(m, pRoom, nSpawnCheckId, posY, posX, 0) === 0) {
    invokeAiStall113c(m, pGame, pUnit, 0x19)
    return
  }

  const nDiff2 = m.u8(pGame + 0x6d)
  const cooldown = sx16(m.u16(pMonStatsTxt + nDiff2 * 2 + 0x62))
  const dwGameFrame = m.u32(pGame + 0xa8) | 0
  const nextCount = ((m.u32(pAiParam + 0x18) | 0) + 1) | 0
  m.setU32(pAiParam + 0x18, nextCount >>> 0)
  m.setU32(pAiParam + 0x14, (dwGameFrame + cooldown) >>> 0)

  const wSkill0 = sx16(m.u16(pMonStatsTxt + 0x170))
  const nMode = m.u8(pMonStatsTxt + 0x180)
  AI_CastSkillWithMode113c(m, nMode, pUnit, pGame, wSkill0, pTarget, 0, 0)
}

function findMonsterAiCommandNodeById113c(
  m: D2KernMemory113c,
  pUnit: number,
  nCmdId: number,
): number {
  if (pUnit === 0 || m.u32(pUnit) !== 1) {
    return 0
  }
  const pMonData = m.u32(pUnit + 0x14) >>> 0
  if (pMonData === 0) {
    return 0
  }
  const pAiGen = m.u32(pMonData + 0x28) >>> 0
  if (pAiGen === 0) {
    return 0
  }
  const pListHead = m.u32(pAiGen + 0x20) >>> 0
  if (pListHead === 0) {
    return 0
  }
  let pCurr = m.u32(pListHead) >>> 0
  if ((m.u32(pCurr + 0x08) | 0) !== nCmdId) {
    while (pCurr !== pListHead) {
      pCurr = m.u32(pCurr) >>> 0
      if ((m.u32(pCurr + 0x08) | 0) === nCmdId) {
        break
      }
    }
  }
  return (m.u32(pCurr + 0x08) | 0) === nCmdId ? pCurr : 0
}

function freeUnitType2Events113c(m: D2KernMemory113c, pGame: number, pUnit: number): void {
  let pEvent = m.u32(pUnit + 0xdc) >>> 0
  while (pEvent !== 0) {
    const pNext = m.u32(pEvent + 0x24) >>> 0
    if (m.u8(pEvent) === 2) {
      EVENT_FreeNode113c(m, pGame, pEvent)
    }
    pEvent = pNext
  }
}

/**
 * @va D2Game:0x6FC36E30
 */
export function AI_ThinkPatrolAndAttack_6FC36E30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC36E30)
  const pMonStatsTxt = m.u32(pAiThinkArg + 0x1c) >>> 0
  if (pMonStatsTxt === 0) {
    return
  }
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  if (pRoom === 0) {
    return
  }

  const pTarget = m.u32(pAiThinkArg + 0x08) >>> 0
  const nDist = m.u32(pAiThinkArg + 0x14) | 0
  const bInMeleeRange = m.u32(pAiThinkArg + 0x18) | 0

  let pAiCmd = findMonsterAiCommandNodeById113c(m, pUnit, 0x0a)
  if (pAiCmd === 0) {
    AIGENERAL_CopyAiCommandParams113c(
      m,
      pUnit,
      0x0a,
      UNIT_GetPosX113c(m, pUnit),
      UNIT_GetPosY113c(m, pUnit),
      0,
      0,
    )
    pAiCmd = findMonsterAiCommandNodeById113c(m, pUnit, 0x0a)
  }

  if (m.u32(pAiCmd + 0x0c) === 0 || m.u32(pAiCmd + 0x10) === 0) {
    m.setU32(pAiCmd + 0x0c, getUnitPosXInline113c(m, pUnit) >>> 0)
    m.setU32(pAiCmd + 0x10, getUnitPosYInline113c(m, pUnit) >>> 0)
  }

  const cmdX = m.u32(pAiCmd + 0x0c) | 0
  const cmdY = m.u32(pAiCmd + 0x10) | 0
  const cmdCoordIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, pRoom, cmdX, cmdY)
  const unitY = getUnitPosYInline113c(m, pUnit)
  const unitX = getUnitPosXInline113c(m, pUnit)
  const unitCoordIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, pRoom, unitX, unitY)

  if (cmdCoordIdx !== unitCoordIdx) {
    const pAiCtrl = getMonsterAiControlPtr113c(m, pUnit)
    if (pAiCtrl !== 0) {
      m.setU32(pAiCtrl + 0x18, 1)
    }
    if (invokeAiApproachTarget113c(m, pGame, pUnit, 0, 0x0f, cmdX, cmdY, 1, 0) !== 0) {
      return
    }
    freeUnitType2Events113c(m, pGame, pUnit)
  }

  const targetY = getUnitPosYInline113c(m, pTarget)
  const targetX = getUnitPosXInline113c(m, pTarget)
  const targetCoordIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, pRoom, targetX, targetY)

  if (cmdCoordIdx !== targetCoordIdx) {
    if (UNIT_GetPosX113c(m, pUnit) === cmdX && UNIT_GetPosY113c(m, pUnit) === cmdY) {
      if (nDist < 0x19) {
        if (AI_CastNextPatrolPointSkill_6FC35F90_113c(m, pAiThinkArg, pGame, pUnit) !== 0) {
          return
        }
      }
      invokeAiStall113c(m, pGame, pUnit, 0x0a)
      return
    }
    const pAiCtrl = getMonsterAiControlPtr113c(m, pUnit)
    if (pAiCtrl !== 0) {
      m.setU32(pAiCtrl + 0x18, 1)
    }
    if (invokeAiApproachTarget113c(m, pGame, pUnit, 0, 0x0f, cmdX, cmdY, 1, 0) !== 0) {
      return
    }
    freeUnitType2Events113c(m, pGame, pUnit)
  }

  const octDist = UNITS_GetOctileDistanceToCoordinates113c(m, pUnit, cmdX, cmdY) >>> 0
  if (octDist > 0x28) {
    const pAiCtrl = getMonsterAiControlPtr113c(m, pUnit)
    if (pAiCtrl !== 0) {
      m.setU32(pAiCtrl + 0x18, 1)
    }
    if (invokeAiApproachTarget113c(m, pGame, pUnit, 0, 0x0f, cmdX, cmdY, 1, 0) !== 0) {
      return
    }
    freeUnitType2Events113c(m, pGame, pUnit)
  }

  if (AI_CastNextPatrolPointSkill_6FC35F90_113c(m, pAiThinkArg, pGame, pUnit) !== 0) {
    return
  }

  const nDiff = m.u8(pGame + 0x6d)
  const pSeed = (pUnit + 0x20) >>> 0
  if (bInMeleeRange !== 0) {
    const roll = rollSeedPtrViaSeedRoll113c(m, pSeed, 100) | 0
    const thresh = (sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x62)) + 10) | 0
    if (roll < thresh) {
      AI_StartAttackMode113c(m, 4, pUnit, pGame, pTarget)
      return
    }
  } else {
    const roll = rollSeedPtrViaSeedRoll113c(m, pSeed, 100) | 0
    const thresh = sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x56))
    if (roll < thresh) {
      const pAiCtrl = getMonsterAiControlPtr113c(m, pUnit)
      if (pAiCtrl !== 0) {
        m.setU32(pAiCtrl + 0x1c, 0x64)
      }
      invokeAiApproachTarget113c(m, pGame, pUnit, pTarget, 0x0f, 0, 0, 1, 0)
      return
    }
  }

  invokeAiStall113c(m, pGame, pUnit, sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x5c)))
}

/**
 * @va D2Game:0x6FC376B0
 */
export function AI_ThinkBloodHawk_6FC376B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC376B0)
  const pTarget = m.u32(pAiThinkArg + 0x08) >>> 0
  const bInMeleeRange = m.u32(pAiThinkArg + 0x18) | 0

  if (bInMeleeRange !== 0) {
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
    const nSpeedByte = resolveMonsterAttackSpeedByte113c(m, pUnit, 4)
    invokeMonsterStartMode113c(m, pGame, pUnit, 4, pTarget, nSpeedByte)
    return
  }

  let lifePct = STATLIST_GetUnitLifePercent113c(m, pUnit) | 0
  if (lifePct < 0) {
    lifePct = 0
  } else if (lifePct > 100) {
    lifePct = 100
  }
  const velBonus = ((100 - lifePct) >> 1) | 0
  if (velBonus < -126 || velBonus > 126) {
    throw new D2CommonAssertError('nVel >= -126 && nVel <= 126', 0x110)
  }

  const pAiCtrl = getMonsterAiControlPtr113c(m, pUnit)
  if (velBonus !== 0 && pAiCtrl !== 0) {
    m.setU32(pAiCtrl + 0x1c, velBonus >>> 0)
  }
  invokeAiApproachTarget113c(m, pGame, pUnit, pTarget, 2, 0, 0, 1, 7)
}

/**
 * @va D2Game:0x6FC377E0
 */
export function AI_ThinkGiantSpider_6FC377E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC377E0)
  const pTarget = m.u32(pAiThinkArg + 0x08) >>> 0
  const bInMeleeRange = m.u32(pAiThinkArg + 0x18) | 0
  const pMonStatsTxt = m.u32(pAiThinkArg + 0x1c) >>> 0
  const pSeed = (pUnit + 0x20) >>> 0

  if (bInMeleeRange !== 0) {
    const roll1 = (stepSeed64At113c(m, pSeed) % 100) | 0
    const nDiff = m.u8(pGame + 0x6d)
    if (roll1 >= sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x56))) {
      invokeAiStall113c(m, pGame, pUnit, sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x68)))
      return
    }
    const roll2 = (stepSeed64At113c(m, pSeed) % 100) | 0
    const nDiff2 = m.u8(pGame + 0x6d)
    if (roll2 < sx16(m.u16(pMonStatsTxt + nDiff2 * 2 + 0x62))) {
      const wSkill0 = sx16(m.u16(pMonStatsTxt + 0x170))
      AI_CastSkillWithMode113c(m, 5, pUnit, pGame, wSkill0, pTarget, 0, 0)
      return
    }
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
    const nSpeedByte = resolveMonsterAttackSpeedByte113c(m, pUnit, 4)
    invokeMonsterStartMode113c(m, pGame, pUnit, 4, pTarget, nSpeedByte)
    return
  }

  const roll = (stepSeed64At113c(m, pSeed) % 100) | 0
  const nDiff = m.u8(pGame + 0x6d)
  if (roll < sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x5c))) {
    invokeAiApproachTarget113c(m, pGame, pUnit, pTarget, 2, 0, 0, 1, 0)
    return
  }
  invokeAiStall113c(m, pGame, pUnit, sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x68)))
}

/**
 * @va D2Game:0x6FC379A0
 */
export function AI_ThinkThornedHulk_6FC379A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC379A0)
  const nDist = m.u32(pAiThinkArg + 0x14) | 0
  const pMonStatsTxt = m.u32(pAiThinkArg + 0x1c) >>> 0
  const bInMeleeRange = m.u32(pAiThinkArg + 0x18) | 0
  const pTarget = m.u32(pAiThinkArg + 0x08) >>> 0

  const wSkill0 = sx16(m.u16(pMonStatsTxt + 0x170))
  let skillLvl = 0
  if (wSkill0 >= 0) {
    const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit, wSkill0) >>> 0
    if (pSkill !== 0) {
      skillLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1) | 0
      if (skillLvl < 0) {
        skillLvl = 0
      }
    }
  }

  const pSeed = (pUnit + 0x20) >>> 0
  if (wSkill0 >= 0 && nDist < skillLvl) {
    const roll = (stepSeed64At113c(m, pSeed) % 100) | 0
    const nDiff = m.u8(pGame + 0x6d)
    if (
      roll < sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x62)) &&
      STATES_CheckState113c(m, pUnit, 0x0c) === 0
    ) {
      const nMode = m.u8(pMonStatsTxt + 0x180)
      AI_CastSkillWithMode113c(m, nMode, pUnit, pGame, wSkill0, pTarget, 0, 0)
      return
    }
  }

  if (STATES_CheckState113c(m, pUnit, 0x0c) !== 0) {
    STATES_ToggleGfxStateFlag113c(m, pUnit, 0x0c, 0)
  }

  if (bInMeleeRange !== 0) {
    const roll = (stepSeed64At113c(m, pSeed) % 100) | 0
    const nDiff = m.u8(pGame + 0x6d)
    if (roll < sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x56))) {
      SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
      const nSpeedByte = resolveMonsterAttackSpeedByte113c(m, pUnit, 4)
      invokeMonsterStartMode113c(m, pGame, pUnit, 4, pTarget, nSpeedByte)
      return
    }
    invokeAiStall113c(m, pGame, pUnit, sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x68)))
    return
  }

  const roll = (stepSeed64At113c(m, pSeed) % 100) | 0
  const nDiff = m.u8(pGame + 0x6d)
  if (roll < sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x5c))) {
    invokeAiApproachTarget113c(m, pGame, pUnit, pTarget, 2, 0, 0, 1, 0)
    return
  }
  invokeAiStall113c(m, pGame, pUnit, sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x68)))
}

/**
 * @va D2Game:0x6FC37BC0
 */
export function AI_ThinkMinionSpawner_6FC37BC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC37BC0)
  const pAiParam = m.u32(pAiThinkArg) >>> 0
  const pTarget = m.u32(pAiThinkArg + 0x08) >>> 0
  const nDiff = m.u8(pGame + 0x6d)
  const pMonStatsTxt = m.u32(pAiThinkArg + 0x1c) >>> 0

  if ((m.u32(pAiParam + 0x18) | 0) >= sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x56))) {
    return
  }

  const nDist = m.u32(pAiThinkArg + 0x14) | 0
  if (
    nDist > sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x68)) ||
    (m.u32(pGame + 0xa8) | 0) < (m.u32(pAiParam + 0x14) | 0)
  ) {
    invokeAiStall113c(m, pGame, pUnit, sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x5c)))
    return
  }

  const pCount = allocZeroedScratch113c(m, 4)
  AITARGET_ScanUnitsByModeTable113c(m, 1, pCount, pGame, pUnit, 0x6fc35890)
  if (m.u32(pCount) === 0) {
    const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
    let pCand = pRoom !== 0 ? m.u32(pRoom + 0x74) >>> 0 : 0
    while (pCand !== 0) {
      AI_CountNearbyMinion453Or461Callback_6FC35890_113c(m, pGame, pUnit, pCand, pCount)
      pCand = m.u32(pCand + 0xe8) >>> 0
    }
  }

  const wSkill0 = sx16(m.u16(pMonStatsTxt + 0x170))
  if (wSkill0 >= 0) {
    const nDiff2 = m.u8(pGame + 0x6d)
    if ((m.u32(pCount) | 0) < sx16(m.u16(pMonStatsTxt + nDiff2 * 2 + 0x5c))) {
      const cooldown = sx16(m.u16(pMonStatsTxt + nDiff2 * 2 + 0x62))
      const dwGameFrame = m.u32(pGame + 0xa8) | 0
      const nextCount = ((m.u32(pAiParam + 0x18) | 0) + 1) | 0
      m.setU32(pAiParam + 0x18, nextCount >>> 0)
      m.setU32(pAiParam + 0x14, (dwGameFrame + cooldown) >>> 0)
      const nMode = m.u8(pMonStatsTxt + 0x180)
      AI_CastSkillWithMode113c(m, nMode, pUnit, pGame, wSkill0, pTarget, 0, 0)
      return
    }
  }

  const nDiff3 = m.u8(pGame + 0x6d)
  invokeAiStall113c(m, pGame, pUnit, sx16(m.u16(pMonStatsTxt + nDiff3 * 2 + 0x5c)))
}

/**
 * @va D2Game:0x6FC381A0
 */
export function AI_ThinkDualAttack95Pct_6FC381A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC381A0)
  const bInMeleeRange = m.u32(pAiThinkArg + 0x18) | 0
  const pTarget = m.u32(pAiThinkArg + 0x08) >>> 0
  const pSeed = (pUnit + 0x20) >>> 0

  if (bInMeleeRange !== 0) {
    const roll = (stepSeed64At113c(m, pSeed) % 100) | 0
    if (roll >= 0x5f) {
      invokeAiStall113c(m, pGame, pUnit, 0x0a)
      return
    }
    stepSeed64At113c(m, pSeed)
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
    const nSpeedByte = resolveMonsterAttackSpeedByte113c(m, pUnit, 5)
    invokeMonsterStartMode113c(m, pGame, pUnit, 5, pTarget, nSpeedByte)
    return
  }

  const roll = (stepSeed64At113c(m, pSeed) % 100) | 0
  if (roll < 0x59) {
    invokeAiApproachTarget113c(m, pGame, pUnit, pTarget, 2, 0, 0, 1, 0)
    return
  }
  invokeAiStall113c(m, pGame, pUnit, 0x0a)
}

/**
 * @va D2Game:0x6FC38360
 */
export function AI_ThinkDelayedMeleeAttack_6FC38360_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC38360)
  const pTarget = m.u32(pAiThinkArg + 0x08) >>> 0
  const bInMeleeRange = m.u32(pAiThinkArg + 0x18) | 0
  const pMonStatsTxt = m.u32(pAiThinkArg + 0x1c) >>> 0
  const pAiParam = m.u32(pAiThinkArg) >>> 0
  const readyFrame = m.u32(pAiParam + 0x14) | 0

  if (readyFrame !== 0) {
    if ((m.u32(pGame + 0xa8) | 0) > readyFrame) {
      SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
      invokeMonsterStartMode113c(m, pGame, pUnit, 0, pTarget, 0x64)
      return
    }
    const nDiff = m.u8(pGame + 0x6d)
    invokeAiStall113c(m, pGame, pUnit, sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x5c)))
    return
  }

  if (bInMeleeRange !== 0) {
    const nDiff = m.u8(pGame + 0x6d)
    const delay = sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x6e))
    m.setU32(pAiParam + 0x14, ((m.u32(pGame + 0xa8) | 0) + delay) >>> 0)
    const nDiff2 = m.u8(pGame + 0x6d)
    invokeAiStall113c(m, pGame, pUnit, sx16(m.u16(pMonStatsTxt + nDiff2 * 2 + 0x5c)))
    return
  }

  const roll = (stepSeed64At113c(m, (pUnit + 0x20) >>> 0) % 100) | 0
  const nDiff = m.u8(pGame + 0x6d)
  if (roll < sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x62))) {
    invokeAiApproachTarget113c(m, pGame, pUnit, pTarget, 2, 0, 0, 1, 0)
    return
  }
  invokeAiStall113c(m, pGame, pUnit, sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x5c)))
}

/**
 * @va D2Game:0x6FC38480
 */
export function AI_ThinkSandMaggot_6FC38480_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC38480)
  const pMonStatsTxt = m.u32(pAiThinkArg + 0x1c) >>> 0
  let pTarget = m.u32(pAiThinkArg + 0x08) >>> 0
  let bInMeleeRange = m.u32(pAiThinkArg + 0x18) | 0
  let bHasActiveCmd1 = 0

  if (pUnit !== 0 && m.u32(pUnit) === 1) {
    const pMonData = m.u32(pUnit + 0x14) >>> 0
    if (pMonData !== 0) {
      const pAiGen = m.u32(pMonData + 0x28) >>> 0
      if (pAiGen !== 0) {
        const pAiCmd = m.u32(pAiGen + 0x20) >>> 0
        if (pAiCmd !== 0) {
          let validCmd = false
          if (
            m.u32(pAiCmd + 0x08) === 1 &&
            (m.u32(pAiCmd + 0x14) | 0) > (m.u32(pGame + 0xa8) | 0)
          ) {
            const pCmdTarget =
              SUNIT_GetServerUnit113c(
                m,
                pGame,
                m.u32(pAiCmd + 0x0c),
                m.u32(pAiCmd + 0x10),
              ) >>> 0
            if (pCmdTarget !== 0 && SUNIT_IsDeadOrDying113c(m, pCmdTarget) === 0) {
              validCmd = true
              bHasActiveCmd1 = 1
              if (pTarget !== pCmdTarget) {
                pTarget = pCmdTarget
                UNITS_GetApproximateDistance113c(m, pUnit, pCmdTarget)
                bInMeleeRange = UNITS_CanUnitMeleeAttackTarget113c(m, pUnit, pCmdTarget, 0) | 0
              }
            }
          }
          if (!validCmd) {
            AIGENERAL_PopAiCommand113c(m, pUnit)
          }
        }
      }
    }
  }

  const pSeed = (pUnit + 0x20) >>> 0
  if (bInMeleeRange !== 0) {
    if (bHasActiveCmd1 === 0) {
      const roll = (stepSeed64At113c(m, pSeed) % 100) | 0
      const nDiff = m.u8(pGame + 0x6d)
      if (roll >= sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x56))) {
        invokeAiStall113c(m, pGame, pUnit, sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x5c)))
        return
      }
    }
    const roll2 = (stepSeed64At113c(m, pSeed) % 100) | 0
    const nDiff2 = m.u8(pGame + 0x6d)
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
    if (roll2 < sx16(m.u16(pMonStatsTxt + nDiff2 * 2 + 0x5c))) {
      const nSpeedByte = resolveMonsterAttackSpeedByte113c(m, pUnit, 5)
      invokeMonsterStartMode113c(m, pGame, pUnit, 5, pTarget, nSpeedByte)
      return
    }
    const nSpeedByte = resolveMonsterAttackSpeedByte113c(m, pUnit, 4)
    invokeMonsterStartMode113c(m, pGame, pUnit, 4, pTarget, nSpeedByte)
    return
  }

  if (bHasActiveCmd1 === 0) {
    const roll = (stepSeed64At113c(m, pSeed) % 100) | 0
    const nDiff = m.u8(pGame + 0x6d)
    if (roll >= sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x62))) {
      invokeAiStall113c(m, pGame, pUnit, sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x68)))
      return
    }
  }

  invokeAiApproachTarget113c(m, pGame, pUnit, pTarget, 2, 0, 0, 1, 0)
}

/**
 * @va D2Game:0x6FC38CE0
 */
export function AI_ThinkClawViper_6FC38CE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC38CE0)
  const pMonStatsTxt = m.u32(pAiThinkArg + 0x1c) >>> 0
  const bInMeleeRange = m.u32(pAiThinkArg + 0x18) | 0
  const nDist = m.u32(pAiThinkArg + 0x14) | 0
  const pTarget = m.u32(pAiThinkArg + 0x08) >>> 0
  const pAiParam = m.u32(pAiThinkArg) >>> 0
  const pSeed = (pUnit + 0x20) >>> 0

  const wSkill0 = sx16(m.u16(pMonStatsTxt + 0x170))
  let skillLvl = 1
  if (wSkill0 >= 0) {
    const pSkill = SKILLS_GetSkillById113c(m, pUnit, wSkill0, -1) >>> 0
    if (pSkill !== 0) {
      const evalLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1) | 0
      if (evalLvl > 0) {
        skillLvl = evalLvl
      }
    }
  }

  const bHasState12 = STATES_CheckState113c(m, pUnit, 0x0c) | 0
  let jumpToRangedFallback = false

  if (wSkill0 >= 0 && bInMeleeRange === 0 && nDist < skillLvl) {
    if (bHasState12 !== 0) {
      STATES_ToggleGfxStateFlag113c(m, pUnit, 0x0c, 0)
    } else {
      if ((m.u32(pGame + 0xa8) | 0) <= (m.u32(pAiParam + 0x14) | 0)) {
        jumpToRangedFallback = true
      } else {
        const nDiff = m.u8(pGame + 0x6d)
        const roll = rollSeedPtrViaSeedRoll113c(m, pSeed, 100) | 0
        if (roll >= sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x56))) {
          jumpToRangedFallback = true
        } else {
          const cooldown = sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x74))
          m.setU32(pAiParam + 0x14, ((m.u32(pGame + 0xa8) | 0) + cooldown) >>> 0)
          const nMode = m.u8(pMonStatsTxt + 0x180)
          AI_CastSkillWithMode113c(m, nMode, pUnit, pGame, wSkill0, pTarget, 0, 0)
          return
        }
      }
    }
  } else if (bHasState12 !== 0) {
    STATES_ToggleGfxStateFlag113c(m, pUnit, 0x0c, 0)
  }

  if (!jumpToRangedFallback && bInMeleeRange !== 0) {
    if (wSkill0 >= 0 && (m.u32(pGame + 0xa8) | 0) > (m.u32(pAiParam + 0x14) | 0)) {
      const roll = (stepSeed64At113c(m, pSeed) % 100) | 0
      const nDiff = m.u8(pGame + 0x6d)
      if (roll < sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x5c))) {
        const cooldown = sx16(m.u16(pMonStatsTxt + nDiff * 2 + 0x74))
        m.setU32(pAiParam + 0x14, ((m.u32(pGame + 0xa8) | 0) + cooldown) >>> 0)
        const nMode = m.u8(pMonStatsTxt + 0x180)
        AI_CastSkillWithMode113c(m, nMode, pUnit, pGame, wSkill0, pTarget, 0, 0)
        return
      }
    }

    const rollAtk = (stepSeed64At113c(m, pSeed) % 100) | 0
    const nDiffAtk = m.u8(pGame + 0x6d)
    if (rollAtk < sx16(m.u16(pMonStatsTxt + nDiffAtk * 2 + 0x62))) {
      SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
      const nSpeedByte = resolveMonsterAttackSpeedByte113c(m, pUnit, 4)
      invokeMonsterStartMode113c(m, pGame, pUnit, 4, pTarget, nSpeedByte)
      return
    }

    const rollCircle = (stepSeed64At113c(m, pSeed) % 100) | 0
    const nDiffCircle = m.u8(pGame + 0x6d)
    if (rollCircle < sx16(m.u16(pMonStatsTxt + nDiffCircle * 2 + 0x6e))) {
      const newLo = stepSeed64At113c(m, pSeed)
      let stepParam = (newLo & 0xff) < 0x80 ? 5 : 6
      if (stepParam === 1) {
        stepParam = 7
      }
      const pAiCtrl = getMonsterAiControlPtr113c(m, pUnit)
      if (pAiCtrl !== 0) {
        if (stepParam !== 0) {
          m.setU32(pAiCtrl + 0x18, stepParam >>> 0)
        }
        m.setU8(pAiCtrl + 0x20, 3)
      }
      invokeAiApproachTarget113c(m, pGame, pUnit, pTarget, 2, 0, 0, 1, 0)
      return
    }

    invokeAiStall113c(m, pGame, pUnit, 5)
    return
  }

  const rollApproach = (stepSeed64At113c(m, pSeed) % 100) | 0
  const nDiffApproach = m.u8(pGame + 0x6d)
  if (rollApproach < sx16(m.u16(pMonStatsTxt + nDiffApproach * 2 + 0x68))) {
    invokeAiApproachTarget113c(m, pGame, pUnit, pTarget, 2, 0, 0, 1, 7)
    return
  }
  invokeAiStall113c(m, pGame, pUnit, 0x0a)
}
