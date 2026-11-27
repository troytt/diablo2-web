/**
 * Milestone 33 [K2] Wave 4 Batch 4 (`w4b4`): 45 `D2Game.dll` v1.13c functions
 * in the VA range `0x6FC22510..0x6FCACFB0`.
 */

import { UNITS_GetPlayerData113c, UNITS_GetStashGoldLimit113c } from '../common/composit'
import { DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32, sdiv32 } from '../common/int-math'
import {
  INVENTORY_GetItemEquipLocation113c,
  ITEMS_SetCellOverwrite113c,
} from '../common/inventory'
import {
  ITEMS_CheckCommandFlags113c,
  ITEMS_GetCommandFlags113c,
  ITEMS_GetItemFormat113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemSeed113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_SerializeItemToBuffer113c,
  ITEMS_SetItemQuality113c,
  ITEMS_SetOrClearCommandFlags113c,
  ITEMS_SetOwnerGuid113c,
} from '../common/items'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
} from '../common/k0-d2common-memports'
import {
  PATH_Compute113c,
  PATH_GetNumberOfPathPoints113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_SetDistance113c,
  PATH_SetNewDistance113c,
  PATH_SetTargetUnit113c,
  PATH_SetType113c,
} from '../common/path'
import {
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_GetMaxStaminaFromUnit113c,
  STATLIST_GetUnitGoldBankLimit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITS_AdvanceAnimFrame113c,
  UNITS_GetMonsterSplitSpawnParams113c,
  UNITS_GetRoom113c,
  UNITS_HasAnimFinished113c,
} from '../common/unit'
import type { Memory113c } from '../mem/sparse-memory'
import { SEED_InitLowSeed113c, seedRoll } from '../prng'
import { ITEMS_SyncSocketedSubItemsToClient113c } from './a1c-post150-f786-f1040-113c'
import {
  AIGENERAL_GetPackLeaderUnit113c,
  AI_CastSkillWithMode113c,
  AI_StartAttackMode113c,
  type AiFallenHooks113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c'
import {
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c'
import {
  AI_IdleWander113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
} from './combat-a1c-113c'
import {
  AI_ApproachTarget113c,
  type FallenSliceWorld113c,
  MONSTER_StepPath113c,
} from './replay-kernel-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  AIGENERAL_GetField3C_113c,
  MONUMOD_MarkBossAndIncrementUniqueCount113c,
} from './k2-items-tc-w1-113c'
import { PLRTRADE_HasAnyCubePageItemOnUnit113c } from './k2-combat-core-w1-113c'
import { STORM_TSArrayCalcChunkSize_6FC225F0_113c } from './k2-laneH-0x6fc2-w1-113c'
import {
  ITEMS_ClearAffixesAndItemCell_6FC2E210_113c,
  ITEMS_FindQuestItemByBaseCode_6FC2E660_113c,
  ITEMS_GetVendorHealthPotionCode_6FC2E390_113c,
  ITEMS_GetVendorManaPotionCode_6FC2E310_113c,
} from './k2-laneI-0x6fc3-w1-113c'
import { OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c } from './k2-laneJ-0x6fc4-w1-113c'
import { STORM_TSListPlacementNewDefault_6FC225A0_113c } from './k2-w2b1-113c'
import { OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c } from './k2-w2b2-113c'
import {
  NET_SendPacket77_ButtonAction_6FCAB340_113c,
  NET_ShouldSyncTrackedStatDelta_6FCAA330_113c,
} from './k2-w2b3-113c'
import {
  S2C_Send7BytePacketToPlayerUnit_6FCAC5F0_113c,
  SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c,
} from './k2-w2b4-113c'
import { ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c } from './k2-w2b6-113c'
import {
  AI_ApproachTargetPathType13_6FD13000_113c,
  AI_ScheduleAiThinkTimer_6FD120C0_113c,
  AI_StartModeAtCoordsStep1_6FD11FF0_113c,
  type K2W2B8Hooks113c,
} from './k2-w2b8-113c'
import { OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c } from './k2-w3b1-113c'
import { PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c } from './k2-w3b5-113c'
import {
  MONSTER_StartGetHitOrScheduleAi_6FC965E0_113c,
  NET_SendEventMessagePacket5A_6FC90BF0_113c,
  OBJ_ApplyShrineAuraStatList_6FC8A960_113c,
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c,
  OBJ_OnStaminaShrineStateRemoved_6FC8A900_113c,
  OBJ_SpawnCompanionObjectsA2AndA0_6FC8BF00_113c,
} from './k2-w3b7-113c'
import {
  AI_ScanCallbackHostileTargetsMetrics_6FC9CF10_113c,
  AI_UnburrowAndScheduleThink_6FC9BE10_113c,
} from './k2-w3b8-113c'
import {
  ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c,
  MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c,
  STORM_TSListDestroySehWrapper_6FC21F60_113c,
} from './k2-w4b1-113c'
import {
  ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c,
  ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c,
  ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c,
  ITEMS_SpawnRandomRoomDropAtCoords_6FC32230_113c,
  MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c,
  MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c,
  OBJ_CalcShrineStatBonusValue_6FC89EE0_113c,
  OBJ_SpawnMonster326FromObject_6FC8B880_113c,
  OBJ_SpawnMonster329FromObject_6FC8B870_113c,
  OBJ_SpawnMonster330FromObject_6FC8B890_113c,
  OBJ_SpawnMonster369FromObject_6FC8B860_113c,
  OBJ_SpawnRandomMonsterTrapFromObject_6FC8A4E0_113c,
  PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c,
  STORM_TSListArrayResize_6FC22630_113c,
} from './k2-w4b3-113c'
import {
  ITEMS_FinalizeNormalExpansionItem_6FC30550_113c,
  ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c,
} from './k2-real-itemdrop-113c'
import {
  MONSTER_RegisterContinuousModeEvent113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events'
import { MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c } from './k2-w4b7-113c'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  MONSTATS2_GetRecordPtr113c,
  MONSTER_GetDifficultyAndPlayerBonus113c,
  MONSTER_SpawnAtCoords113c,
  MONSTER_SpawnPackMember113c,
  type RegpopSpawnHooks113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollRangeHalfOpen113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import {
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
  type EventWheelHooks113c,
} from './timer-wheel'
import { AITARGET_ScanUnitsByModeTable113c } from './town-runtime-gap-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

export type D2KernMemory113c = Memory113c

function i32(m: D2KernMemory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}

function tryReadU32(m: D2KernMemory113c, addr: number): number {
  try {
    return m.u32(addr >>> 0) >>> 0
  } catch {
    return 0
  }
}

export interface K2W4B4Hooks113c {
  readonly aiFallen?: AiFallenHooks113c
  readonly eventWheel?: EventWheelHooks113c
  readonly regpop?: RegpopSpawnHooks113c
  readonly w2b8?: K2W2B8Hooks113c
  readonly world?: FallenSliceWorld113c
  readonly onTSListDestroy_6FC21F60?: (m: D2KernMemory113c, pList: number) => void
  readonly onTSListArrayResize_6FC22630?: (
    m: D2KernMemory113c,
    pListArray: number,
    nNewCount: number,
  ) => void
  readonly onApplyTypeSpecificCreatedItemMods_6FC30600?: (
    m: D2KernMemory113c,
    pItem: number,
    pItemDrop: number,
    nSpellArg: number,
  ) => void
  readonly onRollAndDropItemByTypeAtUnit_6FC31A70?: (
    m: D2KernMemory113c,
    pGame: number,
    pUnit: number,
    nQuality: number,
    pInOutItemLevel: number,
    pOutItemDrop: number,
    nRequiredItemType: number,
    bSkipRarityRoll: number,
  ) => number
  readonly onSpawnRandomMiscItemInRoomAtCoords_6FC31CA0?: (
    m: D2KernMemory113c,
    pCoords: number,
    pGame: number,
    pRoom: number,
    nRequiredType: number,
    bSkipRarityRoll: number,
    pOwnerUnit: number,
  ) => number
  readonly onSpawnRandomRoomDropAtCoords_6FC32230?: (
    m: D2KernMemory113c,
    pCoords: number,
    pGame: number,
    pRoom: number,
    pOutItemDrop: number,
  ) => number
  readonly onRollChampionOrUniqueUMods_6FC43CA0?: (
    m: D2KernMemory113c,
    pGame: number,
    pMonster: number,
    bAllowChampion: number,
  ) => void
  readonly onInitBossAndMinionPackUMods_6FC448A0?: (
    m: D2KernMemory113c,
    bSpawnMinions: number,
    pRoom: number,
    pGame: number,
    pBoss: number,
    pCoordNode: number,
  ) => void
  readonly onPromoteToBossWithSingleUMod_6FC44BF0?: (
    m: D2KernMemory113c,
    pMonster: number,
    pGame: number,
    bUModId: number,
  ) => void
  readonly onDropPlayerInventoryGold_6FC57F80?: (
    m: D2KernMemory113c,
    pGame: number,
    dwPlayerUnitId: number,
    pPlayerUnit: number,
    nGoldToDrop: number,
  ) => number
  readonly onSpawnFrozenAnyaAndObject189_6FC7C690?: (
    m: D2KernMemory113c,
    pQuest: number,
    pQuestData: number,
  ) => void
  readonly onCalcShrineStatBonusValue_6FC89EE0?: (
    m: D2KernMemory113c,
    pPlayerUnit: number,
    nBonusPct: number,
    nStatId: number,
  ) => number
  readonly onSpawnRandomMonsterTrapFromObject_6FC8A4E0?: (
    m: D2KernMemory113c,
    pGame: number,
    pObjectUnit: number,
  ) => void
  readonly onSpawnMonster326FromObject_6FC8B880?: (
    m: D2KernMemory113c,
    pGame: number,
    pObject: number,
  ) => number
}

let k2W4B4StackPtr = 0x7ef20000

function allocStackFrame113c(size: number): number {
  const aligned = (size + 0x0f) & ~0x0f
  k2W4B4StackPtr = (k2W4B4StackPtr - aligned) >>> 0
  return k2W4B4StackPtr
}

function freeStackFrame113c(size: number): void {
  const aligned = (size + 0x0f) & ~0x0f
  k2W4B4StackPtr = (k2W4B4StackPtr + aligned) >>> 0
}

/**
 * [1/45] Sets the active element count (`+0x04`) of a `TSGrowableArray<TSExplicitList>`,
 * destroying tail lists on shrink (`0x6FC21F60`) or growing capacity aligned to chunk size (`+0x0C`)
 * via `0x6FC22630` and placement-constructing new lists via `0x6FC225A0`.
 *
 * @va D2Game:0x6FC22510
 */
export function STORM_TSListArraySetCount_6FC22510_113c(
  m: D2KernMemory113c,
  pListArray: number,
  nNewCount: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FC22510)
  const esi = pListArray >>> 0
  const edi = nNewCount >>> 0
  const nOldCount = m.u32((esi + 0x04) >>> 0) >>> 0

  if (edi <= nOldCount) {
    if (edi < nOldCount) {
      let ebx = (imul32(edi, 3) << 2) >>> 0
      let ebp = edi
      while (ebp < (m.u32((esi + 0x04) >>> 0) >>> 0)) {
        const pList = (m.u32((esi + 0x08) >>> 0) + ebx) >>> 0
        if (hooks?.onTSListDestroy_6FC21F60) {
          hooks.onTSListDestroy_6FC21F60(m, pList)
        } else {
          STORM_TSListDestroySehWrapper_6FC21F60_113c(m, pList)
        }
        ebp = (ebp + 1) >>> 0
        ebx = (ebx + 12) >>> 0
      }
    }
    m.setU32((esi + 0x04) >>> 0, edi)
    return
  }

  if (edi > (m.u32(esi) >>> 0)) {
    let ecx = m.u32((esi + 0x0c) >>> 0) >>> 0
    if (ecx === 0) {
      ecx = STORM_TSArrayCalcChunkSize_6FC225F0_113c(m, edi, esi) >>> 0
    }
    const edx = ecx !== 0 ? (edi % ecx) >>> 0 : 0
    let ebx = edi
    if (edx !== 0) {
      ebx = ((ecx - edx) + edi) >>> 0
    }
    if (hooks?.onTSListArrayResize_6FC22630) {
      hooks.onTSListArrayResize_6FC22630(m, esi, ebx)
    } else {
      STORM_TSListArrayResize_6FC22630_113c(m, esi, ebx)
    }
  }

  const curCount = m.u32((esi + 0x04) >>> 0) >>> 0
  if (curCount < edi) {
    let ebx = (imul32(curCount, 3) << 2) >>> 0
    let ebp = (edi - curCount) >>> 0
    do {
      const pList = (m.u32((esi + 0x08) >>> 0) + ebx) >>> 0
      STORM_TSListPlacementNewDefault_6FC225A0_113c(m, pList)
      ebx = (ebx + 12) >>> 0
      ebp = (ebp - 1) >>> 0
    } while (ebp !== 0)
  }
  m.setU32((esi + 0x04) >>> 0, edi)
}

/**
 * [2/45] Re-initializes `*ppItem` to Normal quality (`2`), restores `dwSavedSeed`,
 * invokes `0x6FC2EE90` (`ITEMS_RollItemQualityOnCreatedItem`), and dispatches either
 * `0x6FC30600` (format `0`) or `0x6FC30550` (`ITEMS_FinalizeNormalExpansionItem`, format `!= 0`).
 *
 * @va D2Game:0x6FC309B0
 */
export function ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c(
  m: D2KernMemory113c,
  dwSavedSeed: number,
  ppItem: number,
  pItemDrop: number,
  nSpellArg = 0,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FC309B0)
  const edi = ppItem >>> 0
  const ebxSeed = dwSavedSeed >>> 0
  const esi = pItemDrop >>> 0
  const ebp = nSpellArg | 0

  ITEMS_ClearAffixesAndItemCell_6FC2E210_113c(m, edi)
  ITEMS_SetOwnerGuid113c(m, m.u32(edi) >>> 0, ebxSeed)
  const pSeed = ITEMS_GetItemSeed113c(m, m.u32(edi) >>> 0) >>> 0
  SEED_InitLowSeed113c(m, pSeed, ebxSeed)
  ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c(m, m.u32(edi) >>> 0, esi)
  ITEMS_SetItemQuality113c(m, m.u32(edi) >>> 0, 2)
  m.setU32((esi + 0x30) >>> 0, 2)

  const ebxItem = m.u32(edi) >>> 0
  const fmt = ITEMS_GetItemFormat113c(m, ebxItem) & 0xffff
  if (fmt === 0) {
    if (hooks?.onApplyTypeSpecificCreatedItemMods_6FC30600) {
      hooks.onApplyTypeSpecificCreatedItemMods_6FC30600(m, ebxItem, esi, ebp)
    } else {
      ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c(m, ebxItem, esi, ebp)
    }
    return
  }
  ITEMS_FinalizeNormalExpansionItem_6FC30550_113c(m, ebxItem, esi)
}

/**
 * [3/45] Promotes `pMonster` (`eax`) to a random Boss/Champion (`pGame` in `ecx`),
 * rolling UMods (`0x6FC43CA0`), applying boss UMod callbacks (`0x6FC448A0`), and setting
 * unit flag `0x800` plus `pMonData + 0x5C |= 0x01`.
 *
 * @va D2Game:0x6FC44B70
 */
export function MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c(
  m: D2KernMemory113c,
  pMonster: number,
  pGame: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FC44B70)
  const edi = pMonster >>> 0
  const esi = pGame >>> 0
  if (edi === 0) return
  const uType = m.u32(edi) | 0
  if (uType !== 1) return
  const pMonData = m.u32((edi + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pUMods = (pMonData + 0x1c) >>> 0
  if (pUMods === 0) return

  m.setU8((pMonData + 0x16) >>> 0, (m.u8((pMonData + 0x16) >>> 0) | 0x01) & 0xff)
  MONUMOD_MarkBossAndIncrementUniqueCount113c(m, edi, esi)
  if (hooks?.onRollChampionOrUniqueUMods_6FC43CA0) {
    hooks.onRollChampionOrUniqueUMods_6FC43CA0(m, esi, edi, 1)
  } else {
    MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c(m, esi, edi, 1)
  }
  const pRoom = UNITS_GetRoom113c(m, edi) >>> 0
  if (hooks?.onInitBossAndMinionPackUMods_6FC448A0) {
    hooks.onInitBossAndMinionPackUMods_6FC448A0(m, 0, pRoom, esi, edi, 0)
  } else {
    MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(m, 0, pRoom, esi, edi, 0)
  }
  const newFlags = (m.u32((edi + 0xc4) >>> 0) | 0x800) >>> 0
  const curType = m.u32(edi) | 0
  m.setU32((edi + 0xc4) >>> 0, newFlags)
  if (curType === 1) {
    const pMonDataAfter = m.u32((edi + 0x14) >>> 0) >>> 0
    if (pMonDataAfter !== 0) {
      m.setU8((pMonDataAfter + 0x5c) >>> 0, (m.u8((pMonDataAfter + 0x5c) >>> 0) | 0x01) & 0xff)
    }
  }
}

/**
 * [4/45] Scans the `2`-subtile grid inside `pRoomCoords` (clamped to `12 x 12` max width/height),
 * checking clear `1x1` spots via `0x6FC4E5D0` and spawning up to `32` (`0x20`) random room drops
 * via `0x6FC32230`.
 *
 * @va D2Game:0x6FC4F4B0
 */
export function OBJRGN_PopulateRoomRandomItemDropsGrid_6FC4F4B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  pRoomCoords: number,
  hooks?: K2W4B4Hooks113c,
): number {
  hitD2GameVa113c(0x6FC4F4B0)
  const eaxCoords = pRoomCoords >>> 0
  const ecxGame = pGame >>> 0
  const edxRoom = pRoom >>> 0

  let sizeX = i32(m, (eaxCoords + 0x08) >>> 0)
  if (sizeX > 0x0c) {
    sizeX = 0x0c
  }
  const startX = i32(m, eaxCoords)
  const endX = (startX + sizeX) >>> 0

  const rawSizeY = i32(m, (eaxCoords + 0x0c) >>> 0)
  const sizeY = rawSizeY > 0x0c ? 0x0c : rawSizeY
  const startY = i32(m, (eaxCoords + 0x04) >>> 0)
  const endY = (startY + sizeY) >>> 0

  let ebxCount = 0
  let curX = (startX + 1) >>> 0
  if (curX < endX) {
    const pPos = allocStackFrame113c(8)
    try {
      while (curX < endX) {
        let curY = (i32(m, (eaxCoords + 0x04) >>> 0) + 1) >>> 0
        if (curY < endY) {
          m.setU32(pPos, curX)
          while (curY < endY) {
            m.setU32((pPos + 0x04) >>> 0, curY)
            const clear =
              OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c(
                m,
                eaxCoords,
                pPos,
                edxRoom,
                1,
                1,
              ) | 0
            if (clear === 1) {
              if (hooks?.onSpawnRandomRoomDropAtCoords_6FC32230) {
                hooks.onSpawnRandomRoomDropAtCoords_6FC32230(m, pPos, ecxGame, edxRoom, 0)
              } else {
                ITEMS_SpawnRandomRoomDropAtCoords_6FC32230_113c(m, pPos, ecxGame, edxRoom, 0)
              }
              ebxCount = (ebxCount + 1) | 0
              if (ebxCount >= 0x20) {
                return 1
              }
            }
            curY = (curY + 2) >>> 0
          }
        }
        curX = (curX + 2) >>> 0
      }
    } finally {
      freeStackFrame113c(8)
    }
  }
  return 1
}

/**
 * [5/45] Applies death gold penalty (`min(clvl, 20)%` of `gold + goldbank`, capped at `clvl * 500`
 * in gameType `3` and clamped to inventory gold in gameType `3`), drops inventory gold via
 * `0x6FC57F80`, updates stats `14`/`15`, and records lost gold in stat `0xAF` (`175`).
 *
 * @va D2Game:0x6FC58180
 */
export function PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c(
  m: D2KernMemory113c,
  pVictimUnit: number,
  pGame: number,
  pAttackerUnit: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FC58180)
  const esi = pVictimUnit >>> 0
  const game = pGame >>> 0
  const attacker = pAttackerUnit >>> 0

  const clvl = STATLIST_GetUnitStat113c(m, esi, 0x0c, 0) | 0
  const invGold = STATLIST_GetUnitStat113c(m, esi, 0x0e, 0) | 0
  let stashGold = STATLIST_GetUnitStat113c(m, esi, 0x0f, 0) | 0
  const totalGold = (invGold + stashGold) | 0

  const cappedLvl = clvl < 20 ? clvl : 20
  const maxRemainingFloor = imul32(clvl, 500) | 0
  let ebxPenalty = sdiv32(imul32(cappedLvl, totalGold), 100) | 0
  const remainingGold = (totalGold - ebxPenalty) | 0

  let bPvpKill = 0
  if (attacker !== 0 && attacker !== esi) {
    const attType = m.u32(attacker) | 0
    if (attType === 0) {
      bPvpKill = 1
    } else if (attType === 1) {
      const pLeader = AIGENERAL_GetPackLeaderUnit113c(m, attacker) >>> 0
      if (pLeader !== 0 && (m.u32(pLeader) | 0) === 0) {
        bPvpKill = 1
      }
    }
  }

  const gameType = m.u8((game + 0x6a) >>> 0) & 0xff
  if (gameType === 3) {
    if (remainingGold < maxRemainingFloor) {
      ebxPenalty = (totalGold - maxRemainingFloor) | 0
      if (ebxPenalty < 0) {
        ebxPenalty = 0
      }
    }
    if (ebxPenalty > invGold) {
      ebxPenalty = invGold
    }
  }

  const dropGoldHelper = (nDrop: number): void => {
    const dwUnitId = esi !== 0 ? m.u32((esi + 0x0c) >>> 0) >>> 0 : 0xffffffff
    if (hooks?.onDropPlayerInventoryGold_6FC57F80) {
      hooks.onDropPlayerInventoryGold_6FC57F80(m, game, dwUnitId, esi, nDrop)
    } else {
      PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c(m, game, dwUnitId, esi, nDrop)
    }
  }

  const setStashGoldGuarded = (val: number): void => {
    if (esi === 0) return
    let v = val | 0
    if (v < 0) {
      v = 0
    } else if ((m.u32(esi) | 0) === 0) {
      const limit = UNITS_GetStashGoldLimit113c(esi) | 0
      if (v > limit) {
        v = 0
      }
    }
    STATLIST_SetUnitStat113c(m, esi, 0x0f, v, 0)
  }

  const setInvGoldGuarded = (val: number): void => {
    if (esi === 0) return
    let v = val | 0
    if (v < 0) {
      v = 0
    } else if ((m.u32(esi) | 0) === 0) {
      const limit = STATLIST_GetUnitGoldBankLimit113c(m, esi) | 0
      if (v > limit) {
        v = 0
      }
    }
    STATLIST_SetUnitStat113c(m, esi, 0x0e, v, 0)
  }

  if (bPvpKill !== 0) {
    if (ebxPenalty > invGold) {
      stashGold = (stashGold - ebxPenalty + invGold) | 0
      if (esi !== 0) {
        setStashGoldGuarded(stashGold)
        setInvGoldGuarded(ebxPenalty)
      }
    }
    dropGoldHelper(ebxPenalty)
  } else {
    if (ebxPenalty <= invGold) {
      dropGoldHelper((invGold - ebxPenalty) | 0)
    } else if (gameType !== 3) {
      stashGold = (stashGold - ebxPenalty + invGold) | 0
      if (esi !== 0) {
        setStashGoldGuarded(stashGold)
      }
    }
    if (esi !== 0) {
      if ((m.u32(esi) | 0) === 0) {
        STATLIST_GetUnitGoldBankLimit113c(m, esi)
      }
      STATLIST_SetUnitStat113c(m, esi, 0x0e, 0, 0)
    }
  }

  if (esi !== 0) {
    STATLIST_SetUnitStat113c(m, esi, 0xaf, ebxPenalty < 0 ? 0 : ebxPenalty, 0)
  }
}

const DEFAULT_SHRINE_AURA_TABLE_6FD1A5F8: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [-1, 0],
  [-1, 0],
  [-1, 0],
  [-1, 0],
  [-1, 0],
  [171, 128],
  [-1, 129],
  [39, 131],
  [43, 132],
  [41, 130],
  [45, 133],
  [11, 134],
  [27, 135],
  [162, 136],
  [85, 137],
  [-1, 0],
  [-1, 0],
  [-1, 0],
  [-1, 0],
  [-1, 0],
  [-1, 0],
  [-1, 0],
  [-1, 0],
]

const DEFAULT_OBJ_TRAP_HANDLERS_6FD27B8C: readonly number[] = [
  0x00000000,
  0x6fc8b890,
  0x6fc8b880,
  0x6fc8b870,
  0x6fc8b860,
  0x6fc8bf00,
  0x6fc8b880,
  0x6fc8bf00,
  0x6fc8a4e0,
  0x6fc8a4e0,
]

/**
 * [6/45] When `pLeader` (`esi`) is a Champion monster (`pMonData + 0x16 & 0x04`), advances its
 * 64-bit LCG (`+0x20`) to roll `1..3` pack members of `nClassId` (`ebx`), spawning each in mode `1`
 * within radius `4` (`MONSTER_SpawnPackMember113c`) and promoting it via `0x6FC44BF0(..., 0x10)`.
 *
 * @va D2Game:0x6FC67880
 */
export function MONSTER_SpawnChampionPackMembers_6FC67880_113c(
  m: D2KernMemory113c,
  pLeader: number,
  nClassId: number,
  pGame: number,
  pCoordNode: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FC67880)
  const esi = pLeader >>> 0
  if (esi === 0) return
  if ((m.u32(esi) | 0) !== 1) return
  const pMonData = m.u32((esi + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  if ((m.u8((pMonData + 0x16) >>> 0) & 0x04) === 0) return

  const lo = BigInt(m.u32((esi + 0x20) >>> 0))
  const hi = BigInt(m.u32((esi + 0x24) >>> 0))
  const prod = lo * 0x6ac690c5n + hi
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((esi + 0x24) >>> 0, newHi)
  m.setU32((esi + 0x20) >>> 0, newLo)

  const count = ((newLo % 3) + 1) | 0
  if (count <= 0) return

  const ebx = nClassId | 0
  const edi = pGame >>> 0
  const ebp = pCoordNode >>> 0
  for (let rem = count; rem !== 0; rem = (rem - 1) | 0) {
    const pSpawned =
      MONSTER_SpawnPackMember113c(m, ebx, esi, 1, edi, ebp, 4, 0, hooks?.regpop) >>> 0
    if (pSpawned !== 0) {
      if (hooks?.onPromoteToBossWithSingleUMod_6FC44BF0) {
        hooks.onPromoteToBossWithSingleUMod_6FC44BF0(m, pSpawned, edi, 0x10)
      } else {
        MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c(m, pSpawned, edi, 0x10)
      }
    }
  }
}

/**
 * [7/45] Walks `pGame->pQuestControl->pQuestList` (`+0x10F4`) for quest ID `0x21` (`33`, Act 5 Quest 3),
 * sets `pQuestData + 0xAD = 1` and `pQuestData + 0x84 = 2`, and invokes `0x6FC7C690`.
 *
 * @va D2Game:0x6FC7CC30
 */
export function ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c(
  m: D2KernMemory113c,
  pGame: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7CC30)
  const pQuestCtrl = m.u32(((pGame >>> 0) + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return
  let pQuest = m.u32(pQuestCtrl) >>> 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) | 0) === 0x21) {
      const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0
      m.setU8((pQuestData + 0xad) >>> 0, 1)
      m.setU32((pQuestData + 0x84) >>> 0, 2)
      if (hooks?.onSpawnFrozenAnyaAndObject189_6FC7C690) {
        hooks.onSpawnFrozenAnyaAndObject189_6FC7C690(m, pQuest, pQuestData)
      } else {
        ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c(m, pQuest, pQuestData)
      }
      return
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
}

/**
 * [8/45] Act 1 Quest 4 (Countess chest) gold burst callback: initializes `pQuestData + 0x8C` to
 * `SEED_RollRangeHalfOpen(pQuestControl + 0x18, 10, 20)` and `pUnit + 0xB8 = 'gld '` on first tick
 * (`+0x90 == 0`), drops one item via `0x6FC31A70`, and reschedules event `7` at `+10` frames while `> 0`.
 *
 * @va D2Game:0x6FC88E20
 */
export function ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pUnit: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FC88E20)
  const ebp = pQuest >>> 0
  const edi = pUnit >>> 0
  const esi = m.u32((ebp + 0x18) >>> 0) >>> 0

  if (m.u8((esi + 0x90) >>> 0) === 0) {
    m.setU8((esi + 0x90) >>> 0, 1)
    const pGame0 = m.u32((ebp + 0x04) >>> 0) >>> 0
    const pQuestCtrl = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0
    if (pQuestCtrl === 0) {
      throw new D2CommonAssertError('pGame->pQuestControl != NULL', 0x1fb)
    }
    const rolled = SEED_RollRangeHalfOpen113c(m, (pQuestCtrl + 0x18) >>> 0, 0x0a, 0x14) | 0
    m.setU32((esi + 0x8c) >>> 0, rolled >>> 0)
    m.setU32((edi + 0xb8) >>> 0, 0x20646c67)
  }

  if ((m.u32((esi + 0x8c) >>> 0) | 0) !== 0) {
    const ebxGame = m.u32((ebp + 0x04) >>> 0) >>> 0
    const pIlvl = allocStackFrame113c(4)
    let dropped = 0
    try {
      m.setU32(pIlvl, 0)
      if (hooks?.onRollAndDropItemByTypeAtUnit_6FC31A70) {
        dropped =
          hooks.onRollAndDropItemByTypeAtUnit_6FC31A70(m, ebxGame, edi, 2, pIlvl, 0, -1, 0) | 0
      } else {
        dropped =
          ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(m, ebxGame, edi, 2, pIlvl, 0, -1, 0) | 0
      }
    } finally {
      freeStackFrame113c(4)
    }
    if (dropped !== 0) {
      const nextCount = (i32(m, (esi + 0x8c) >>> 0) - 1) | 0
      m.setU32((esi + 0x8c) >>> 0, nextCount >>> 0)
      if (nextCount > 0) {
        const pGame1 = m.u32((ebp + 0x04) >>> 0) >>> 0
        const frame = (m.u32((pGame1 + 0xa8) >>> 0) + 0x0a) >>> 0
        EVENT_SetEventFull113c(m, pGame1, edi, 7, frame, 0, 0, 0, hooks?.eventWheel)
      }
    }
  }
}

/**
 * [9/45] Dispatches object trap/spawn initialization from `0x6FD27B8C` by `pObjectData->bShrineId & 0x7F`,
 * overriding with `0x6FD27B94` (`0x6FC8B880`) based on room level ID (`>= 75` for index `8`,
 * `< 40 && != 25` for index `3`, `< 40` for index `1` or `4`).
 *
 * @va D2Game:0x6FC89970
 */
export function OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c(
  m: D2KernMemory113c,
  pGame: number,
  pObject: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FC89970)
  const ebxGame = pGame >>> 0
  const esiObj = pObject >>> 0
  const pRoom = UNITS_GetRoom113c(m, esiObj) >>> 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0

  const pObjData = m.u32((esiObj + 0x14) >>> 0) >>> 0
  const ediIdx = (m.u8((pObjData + 0x04) >>> 0) & 0x7f) >>> 0
  const rawLimit = tryReadU32(m, 0x6fd27bb4) | 0
  const limit = rawLimit !== 0 ? rawLimit : 10
  if ((ediIdx | 0) >= limit) return

  const readHandlerAt = (index: number): number => {
    const inMem = tryReadU32(m, (0x6fd27b8c + (index << 2)) >>> 0)
    if (inMem !== 0) return inMem
    return index >= 0 && index < DEFAULT_OBJ_TRAP_HANDLERS_6FD27B8C.length
      ? DEFAULT_OBJ_TRAP_HANDLERS_6FD27B8C[index]!
      : 0
  }

  let useFallback2 = false
  let assertLine = 0x17b
  if (ediIdx === 8) {
    if (nLevelId >= 0x4b) {
      useFallback2 = true
      assertLine = 0x161
    }
  } else if (ediIdx === 3) {
    if (nLevelId < 0x28 && nLevelId !== 0x19) {
      useFallback2 = true
      assertLine = 0x16c
    }
  } else if (ediIdx === 1 || ediIdx === 4) {
    if (nLevelId < 0x28) {
      useFallback2 = true
      assertLine = 0x176
    }
  }

  const targetVa = useFallback2 ? readHandlerAt(2) : readHandlerAt(ediIdx)
  if (targetVa === 0) {
    throw new D2CommonAssertError('Objects.cpp', assertLine)
  }
  if (targetVa === 0x6fc8b890) {
    OBJ_SpawnMonster330FromObject_6FC8B890_113c(m, ebxGame, esiObj)
  } else if (targetVa === 0x6fc8b880) {
    if (hooks?.onSpawnMonster326FromObject_6FC8B880) {
      hooks.onSpawnMonster326FromObject_6FC8B880(m, ebxGame, esiObj)
    } else {
      OBJ_SpawnMonster326FromObject_6FC8B880_113c(m, ebxGame, esiObj)
    }
  } else if (targetVa === 0x6fc8b870) {
    OBJ_SpawnMonster329FromObject_6FC8B870_113c(m, ebxGame, esiObj)
  } else if (targetVa === 0x6fc8b860) {
    OBJ_SpawnMonster369FromObject_6FC8B860_113c(m, ebxGame, esiObj)
  } else if (targetVa === 0x6fc8bf00) {
    OBJ_SpawnCompanionObjectsA2AndA0_6FC8BF00_113c(m, ebxGame, esiObj)
  } else if (targetVa === 0x6fc8a4e0) {
    if (hooks?.onSpawnRandomMonsterTrapFromObject_6FC8A4E0) {
      hooks.onSpawnRandomMonsterTrapFromObject_6FC8A4E0(m, ebxGame, esiObj)
    } else {
      OBJ_SpawnRandomMonsterTrapFromObject_6FC8A4E0_113c(m, ebxGame, esiObj)
    }
  }
}

/**
 * [10/45] Applies a shrine aura stat list (`0x6FC8A960`) from `0x6FD1A5F8[pShrineTxt->nCode]`,
 * scaling the stat bonus via `0x6FC89EE0` when `dwStatId != -1`.
 *
 * @va D2Game:0x6FC8ABB0
 */
export function OBJ_OperateAuraStatShrine_6FC8ABB0_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
  pShrineTxt: number,
  hooks?: K2W4B4Hooks113c,
): number {
  hitD2GameVa113c(0x6FC8ABB0)
  const ebp = pOperateArgs >>> 0
  const edxTxt = pShrineTxt >>> 0
  const nCode = m.u8(edxTxt) & 0xff
  const rawMax = tryReadU32(m, 0x6fd27d4c) | 0
  const maxCode = rawMax !== 0 ? rawMax : 24
  if (nCode >= maxCode) {
    throw new D2CommonAssertError('Objects.cpp', 0x9f9)
  }

  const entryVa = (0x6fd1a5f8 + imul32(nCode, 12)) >>> 0
  const inMemStat = tryReadU32(m, (entryVa + 0x04) >>> 0) | 0
  const inMemState = tryReadU32(m, (entryVa + 0x08) >>> 0) | 0
  const hasInMem = tryReadU32(m, entryVa) !== 0 || inMemStat !== 0 || inMemState !== 0
  const defPair =
    nCode < DEFAULT_SHRINE_AURA_TABLE_6FD1A5F8.length
      ? DEFAULT_SHRINE_AURA_TABLE_6FD1A5F8[nCode]!
      : ([-1, 0] as const)
  const dwStatId = hasInMem ? inMemStat : defPair[0]
  const dwStateId = hasInMem ? inMemState : defPair[1]

  let nStatBonus = 0
  if (dwStatId !== -1) {
    const nBonusPct = i32(m, (edxTxt + 0x04) >>> 0)
    const pPlayer = m.u32((ebp + 0x08) >>> 0) >>> 0
    if (hooks?.onCalcShrineStatBonusValue_6FC89EE0) {
      nStatBonus = hooks.onCalcShrineStatBonusValue_6FC89EE0(m, pPlayer, nBonusPct, dwStatId) | 0
    } else {
      nStatBonus = OBJ_CalcShrineStatBonusValue_6FC89EE0_113c(m, pPlayer, nBonusPct, dwStatId) | 0
    }
  }

  const pGame = m.u32((ebp + 0x04) >>> 0) >>> 0
  const pUnit = m.u32((ebp + 0x08) >>> 0) >>> 0
  const dwDuration = m.u32((edxTxt + 0x0c) >>> 0) >>> 0
  return (
    OBJ_ApplyShrineAuraStatList_6FC8A960_113c(
      m,
      pGame,
      pUnit,
      dwDuration,
      nStatBonus,
      dwStatId,
      dwStateId,
      0,
    ) | 0
  )
}

/**
 * [11/45] Operates a Stamina Shrine: restores current stamina (`10`) to `STATLIST_GetMaxStaminaFromUnit`,
 * applies the shrine aura stat list (`0x6FC8A960`) with expire callback `0x6FC8A900`, and sets
 * stat `10` (`2 * bonus`) and stat `28` (`1000`% stamina recovery) on the stat list.
 *
 * @va D2Game:0x6FC8AC30
 */
export function OBJ_OperateStaminaShrine_6FC8AC30_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
  pShrineTxt: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FC8AC30)
  void OBJ_OnStaminaShrineStateRemoved_6FC8A900_113c
  const ediArgs = pOperateArgs >>> 0
  const ebxTxt = pShrineTxt >>> 0
  const nCode = m.u8(ebxTxt) & 0xff
  const rawMax = tryReadU32(m, 0x6fd27d4c) | 0
  const maxCode = rawMax !== 0 ? rawMax : 24
  if (nCode >= maxCode) {
    throw new D2CommonAssertError('Objects.cpp', 0x9e7)
  }

  const entryVa = (0x6fd1a5f8 + imul32(nCode, 12)) >>> 0
  const pPlayer0 = m.u32((ediArgs + 0x08) >>> 0) >>> 0
  const maxStam = STATLIST_GetMaxStaminaFromUnit113c(m, pPlayer0) | 0
  const pPlayer1 = m.u32((ediArgs + 0x08) >>> 0) >>> 0
  STATLIST_SetUnitStat113c(m, pPlayer1, 0x0a, maxStam, 0)

  const inMemStat = tryReadU32(m, (entryVa + 0x04) >>> 0) | 0
  const inMemState = tryReadU32(m, (entryVa + 0x08) >>> 0) | 0
  const hasInMem = tryReadU32(m, entryVa) !== 0 || inMemStat !== 0 || inMemState !== 0
  const defPair =
    nCode < DEFAULT_SHRINE_AURA_TABLE_6FD1A5F8.length
      ? DEFAULT_SHRINE_AURA_TABLE_6FD1A5F8[nCode]!
      : ([-1, 0] as const)
  const dwStatId = hasInMem ? inMemStat : defPair[0]
  const dwStateId = hasInMem ? inMemState : defPair[1]

  const pPlayer2 = m.u32((ediArgs + 0x08) >>> 0) >>> 0
  const nBonusPct = i32(m, (ebxTxt + 0x04) >>> 0)
  const esiBonus = hooks?.onCalcShrineStatBonusValue_6FC89EE0
    ? hooks.onCalcShrineStatBonusValue_6FC89EE0(m, pPlayer2, nBonusPct, dwStatId) | 0
    : OBJ_CalcShrineStatBonusValue_6FC89EE0_113c(m, pPlayer2, nBonusPct, dwStatId) | 0

  const pGame = m.u32((ediArgs + 0x04) >>> 0) >>> 0
  const pUnit = m.u32((ediArgs + 0x08) >>> 0) >>> 0
  const dwDuration = m.u32((ebxTxt + 0x0c) >>> 0) >>> 0
  const pStatList =
    OBJ_ApplyShrineAuraStatList_6FC8A960_113c(
      m,
      pGame,
      pUnit,
      dwDuration,
      esiBonus,
      dwStatId,
      dwStateId,
      0x6fc8a900,
    ) >>> 0

  STATLIST_SetStat113c(m, pStatList, 0x0a, (esiBonus + esiBonus) | 0, 0)
  STATLIST_SetStat113c(m, pStatList, 0x1c, 0x3e8, 0)
}

/**
 * [12/45] Operates a Combat Shrine: computes the attack-rating (`0x13 = 19`) bonus via `0x6FC89EE0`,
 * applies the shrine aura stat list (`0x6FC8A960`) with stat `0x19` (`25 = damagepercent`) set to
 * `pShrineTxt->dwArg1 (+0x08)`, and sets stat `0x13` on the returned stat list.
 *
 * @va D2Game:0x6FC8ACE0
 */
export function OBJ_OperateCombatShrine_6FC8ACE0_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
  pShrineTxt: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FC8ACE0)
  const ebpArgs = pOperateArgs >>> 0
  const ediTxt = pShrineTxt >>> 0
  const nCode = m.u8(ediTxt) & 0xff
  const rawMax = tryReadU32(m, 0x6fd27d4c) | 0
  const maxCode = rawMax !== 0 ? rawMax : 24
  if (nCode >= maxCode) {
    throw new D2CommonAssertError('Objects.cpp', 0x9c1)
  }

  const nBonusPct = i32(m, (ediTxt + 0x04) >>> 0)
  const pPlayer = m.u32((ebpArgs + 0x08) >>> 0) >>> 0
  const entryVa = (0x6fd1a5f8 + imul32(nCode, 12)) >>> 0
  const esiToHit = hooks?.onCalcShrineStatBonusValue_6FC89EE0
    ? hooks.onCalcShrineStatBonusValue_6FC89EE0(m, pPlayer, nBonusPct, 0x13) | 0
    : OBJ_CalcShrineStatBonusValue_6FC89EE0_113c(m, pPlayer, nBonusPct, 0x13) | 0

  const inMemState = tryReadU32(m, (entryVa + 0x08) >>> 0) | 0
  const hasInMem =
    tryReadU32(m, entryVa) !== 0 || (tryReadU32(m, (entryVa + 0x04) >>> 0) | 0) !== 0 || inMemState !== 0
  const defPair =
    nCode < DEFAULT_SHRINE_AURA_TABLE_6FD1A5F8.length
      ? DEFAULT_SHRINE_AURA_TABLE_6FD1A5F8[nCode]!
      : ([-1, 0] as const)
  const dwStateId = hasInMem ? inMemState : defPair[1]

  const nDamagePct = i32(m, (ediTxt + 0x08) >>> 0)
  const dwDuration = m.u32((ediTxt + 0x0c) >>> 0) >>> 0
  const pGame = m.u32((ebpArgs + 0x04) >>> 0) >>> 0
  const pUnit = m.u32((ebpArgs + 0x08) >>> 0) >>> 0
  const pStatList =
    OBJ_ApplyShrineAuraStatList_6FC8A960_113c(
      m,
      pGame,
      pUnit,
      dwDuration,
      nDamagePct,
      0x19,
      dwStateId,
      0,
    ) >>> 0

  STATLIST_SetStat113c(m, pStatList, 0x13, esiToHit, 0)
}

/**
 * [13/45] Operates a Tome/Scroll bookshelf object: transitions `pObject` (`+0x04`) to mode `2`,
 * clears unit flag `0x02`, steps `pOperateArgs->pSeed (+0x0C)` twice to pick `'ibk '`, `'tbk '`,
 * `'isc '`, or `'tsc '` into `pObject + 0xB8`, and drops the item via `0x6FC31A70`.
 *
 * @va D2Game:0x6FC8B340
 */
export function OBJ_OperateTomeOrScrollStand_6FC8B340_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
  hooks?: K2W4B4Hooks113c,
): number {
  hitD2GameVa113c(0x6FC8B340)
  const esi = pOperateArgs >>> 0
  const pObj0 = m.u32((esi + 0x04) >>> 0) >>> 0
  if (pObj0 !== 0 && m.u32((pObj0 + 0x10) >>> 0) !== 0) {
    return 1
  }

  UNITS_ChangeAnimMode113c(m, pObj0, 2)
  const pObj1 = m.u32((esi + 0x04) >>> 0) >>> 0
  if (pObj1 !== 0) {
    m.setU32((pObj1 + 0xc4) >>> 0, (m.u32((pObj1 + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
  }

  const pScratch = allocStackFrame113c(12)
  try {
    PATH_GetTargetTypeAndPosition113c(m, m.u32((esi + 0x04) >>> 0), pScratch)

    const pSeed0 = m.u32((esi + 0x0c) >>> 0) >>> 0
    const prod1 = BigInt(m.u32(pSeed0)) * 0x6ac690c5n + BigInt(m.u32((pSeed0 + 0x04) >>> 0))
    const lo1 = Number(prod1 & 0xffffffffn) >>> 0
    const hi1 = Number((prod1 >> 32n) & 0xffffffffn) >>> 0
    m.setU32((pSeed0 + 0x04) >>> 0, hi1)
    m.setU32(pSeed0, lo1)
    const rem = (lo1 % 0x14) >>> 0

    const pSeed1 = m.u32((esi + 0x0c) >>> 0) >>> 0
    const prod2 = BigInt(m.u32(pSeed1)) * 0x6ac690c5n + BigInt(m.u32((pSeed1 + 0x04) >>> 0))
    const lo2 = Number(prod2 & 0xffffffffn) >>> 0
    const hi2 = Number((prod2 >> 32n) & 0xffffffffn) >>> 0
    m.setU32((pSeed1 + 0x04) >>> 0, hi2)
    m.setU32(pSeed1, lo2)

    const pObj2 = m.u32((esi + 0x04) >>> 0) >>> 0
    if ((rem | 0) > 0x0c) {
      m.setU32((pObj2 + 0xb8) >>> 0, (lo2 & 1) !== 0 ? 0x206b6269 : 0x206b6274)
    } else {
      m.setU32((pObj2 + 0xb8) >>> 0, (lo2 & 1) !== 0 ? 0x20637369 : 0x20637374)
    }

    if (hooks?.onRollAndDropItemByTypeAtUnit_6FC31A70) {
      hooks.onRollAndDropItemByTypeAtUnit_6FC31A70(
        m,
        m.u32(esi) >>> 0,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        2,
        (pScratch + 8) >>> 0,
        0,
        -1,
        0,
      )
    } else {
      ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
        m,
        m.u32(esi) >>> 0,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        2,
        (pScratch + 8) >>> 0,
        0,
        -1,
        0,
      )
    }
  } finally {
    freeStackFrame113c(12)
  }
  return 1
}

/**
 * [14/45] Operates Wirt's Body (`0x6FC8D960`): sets `pObject + 0xB8 = 'leg '`, drops Wirt's Leg
 * via `0x6FC31A70`, and on success transitions `pObject` to mode `1` and schedules events `1` and `7`.
 *
 * @va D2Game:0x6FC8D960
 */
export function OBJ_OperateWirtsBody_6FC8D960_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
  hooks?: K2W4B4Hooks113c,
): number {
  hitD2GameVa113c(0x6FC8D960)
  const esi = pOperateArgs >>> 0
  const pObj0 = m.u32((esi + 0x04) >>> 0) >>> 0
  if (pObj0 !== 0 && m.u32((pObj0 + 0x10) >>> 0) !== 0) {
    return 1
  }

  m.setU32((pObj0 + 0xb8) >>> 0, 0x2067656c)
  const pIlvl = allocStackFrame113c(4)
  let dropped = 0
  try {
    if (hooks?.onRollAndDropItemByTypeAtUnit_6FC31A70) {
      dropped =
        hooks.onRollAndDropItemByTypeAtUnit_6FC31A70(
          m,
          m.u32(esi) >>> 0,
          m.u32((esi + 0x04) >>> 0) >>> 0,
          2,
          pIlvl,
          0,
          -1,
          0,
        ) | 0
    } else {
      dropped =
        ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
          m,
          m.u32(esi) >>> 0,
          m.u32((esi + 0x04) >>> 0) >>> 0,
          2,
          pIlvl,
          0,
          -1,
          0,
        ) | 0
    }
  } finally {
    freeStackFrame113c(4)
  }

  if (dropped !== 0) {
    UNITS_ChangeAnimMode113c(m, m.u32((esi + 0x04) >>> 0) >>> 0, 1)
    const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, i32(m, (esi + 0x10) >>> 0)) >>> 0
    const frameDelta = (m.u32((pObjTxt + 0xdc) >>> 0) >>> 8) >>> 0
    const pGame0 = m.u32(esi) >>> 0
    const frame1 = (m.u32((pGame0 + 0xa8) >>> 0) + frameDelta + 1) >>> 0
    EVENT_SetEventFull113c(
      m,
      pGame0,
      m.u32((esi + 0x04) >>> 0) >>> 0,
      1,
      frame1,
      0,
      0,
      0,
      hooks?.eventWheel,
    )

    const pGame1 = m.u32(esi) >>> 0
    const frame7 = (m.u32((pGame1 + 0xa8) >>> 0) + 0x0a) >>> 0
    EVENT_SetEventFull113c(
      m,
      pGame1,
      m.u32((esi + 0x04) >>> 0) >>> 0,
      7,
      frame7,
      0,
      0,
      0,
      hooks?.eventWheel,
    )
  }
  return 1
}

/**
 * [15/45] Operates a gold-and-potion stash object (`0x6FC8DBF0`): drops 3 chest treasure rolls
 * (`0x6FC8B570(..., 4)`), 2 vendor health potions (`0x6FC2E390`), and 2 vendor mana potions
 * (`0x6FC2E310`), then transitions animation mode and clears unit flag `0x02`.
 *
 * @va D2Game:0x6FC8DBF0
 */
export function OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FC8DBF0)
  const esi = pOperateArgs >>> 0
  const pObj0 = m.u32((esi + 0x04) >>> 0) >>> 0
  if (pObj0 !== 0 && m.u32((pObj0 + 0x10) >>> 0) !== 0) {
    return
  }

  const ediTxt = DATATBLS_GetObjectsTxtRecord113c(m, i32(m, (esi + 0x10) >>> 0)) >>> 0
  const pScratch = allocStackFrame113c(12)
  try {
    PATH_GetTargetTypeAndPosition113c(m, m.u32((esi + 0x04) >>> 0) >>> 0, pScratch)
    OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, esi, 4)
    OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, esi, 4)
    OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, esi, 4)

    const hpCode = ITEMS_GetVendorHealthPotionCode_6FC2E390_113c(
      m,
      m.u32((esi + 0x04) >>> 0) >>> 0,
    ) >>> 0
    if (hpCode === 0) {
      throw new D2CommonAssertError('Objects.cpp', 0x594)
    }
    const pObjHp = m.u32((esi + 0x04) >>> 0) >>> 0
    m.setU32((pObjHp + 0xb8) >>> 0, hpCode)
    if (hooks?.onRollAndDropItemByTypeAtUnit_6FC31A70) {
      hooks.onRollAndDropItemByTypeAtUnit_6FC31A70(
        m,
        m.u32(esi) >>> 0,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        2,
        (pScratch + 8) >>> 0,
        0,
        -1,
        1,
      )
      hooks.onRollAndDropItemByTypeAtUnit_6FC31A70(
        m,
        m.u32(esi) >>> 0,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        2,
        (pScratch + 8) >>> 0,
        0,
        -1,
        1,
      )
    } else {
      ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
        m,
        m.u32(esi) >>> 0,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        2,
        (pScratch + 8) >>> 0,
        0,
        -1,
        1,
      )
      ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
        m,
        m.u32(esi) >>> 0,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        2,
        (pScratch + 8) >>> 0,
        0,
        -1,
        1,
      )
    }

    const mpCode = ITEMS_GetVendorManaPotionCode_6FC2E310_113c(
      m,
      m.u32((esi + 0x04) >>> 0) >>> 0,
    ) >>> 0
    if (mpCode === 0) {
      throw new D2CommonAssertError('Objects.cpp', 0x599)
    }
    const pObjMp = m.u32((esi + 0x04) >>> 0) >>> 0
    m.setU32((pObjMp + 0xb8) >>> 0, mpCode)
    if (hooks?.onRollAndDropItemByTypeAtUnit_6FC31A70) {
      hooks.onRollAndDropItemByTypeAtUnit_6FC31A70(
        m,
        m.u32(esi) >>> 0,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        2,
        (pScratch + 8) >>> 0,
        0,
        -1,
        1,
      )
      hooks.onRollAndDropItemByTypeAtUnit_6FC31A70(
        m,
        m.u32(esi) >>> 0,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        2,
        (pScratch + 8) >>> 0,
        0,
        -1,
        1,
      )
    } else {
      ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
        m,
        m.u32(esi) >>> 0,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        2,
        (pScratch + 8) >>> 0,
        0,
        -1,
        1,
      )
      ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
        m,
        m.u32(esi) >>> 0,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        2,
        (pScratch + 8) >>> 0,
        0,
        -1,
        1,
      )
    }

    const bHasAnim = m.u8((ediTxt + 0x140) >>> 0)
    const pObjAnim = m.u32((esi + 0x04) >>> 0) >>> 0
    if (bHasAnim !== 0) {
      UNITS_ChangeAnimMode113c(m, pObjAnim, 1)
      const pGame = m.u32(esi) >>> 0
      const frameDelta = (m.u32((ediTxt + 0xdc) >>> 0) >>> 8) >>> 0
      const frame = (m.u32((pGame + 0xa8) >>> 0) + frameDelta + 1) >>> 0
      EVENT_SetEventFull113c(
        m,
        pGame,
        m.u32((esi + 0x04) >>> 0) >>> 0,
        1,
        frame,
        0,
        0,
        0,
        hooks?.eventWheel,
      )
    } else {
      UNITS_ChangeAnimMode113c(m, pObjAnim, 2)
    }

    const pObjEnd = m.u32((esi + 0x04) >>> 0) >>> 0
    if (pObjEnd !== 0) {
      m.setU32((pObjEnd + 0xc4) >>> 0, (m.u32((pObjEnd + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
    }
  } finally {
    freeStackFrame113c(12)
  }
}

/**
 * [16/45] Validates object trap handler `bTrapIndex` in `0x6FD27B8C` (`< 0x6FD27BB4`), checks room
 * spawn eligibility (`0x6FC89940`) when handler is `0x6FC8A4E0`, schedules event `4` at `+0x23`
 * frames, and triggers sound `0x0D` (`SUNIT_SetUnitEventSound113c`).
 *
 * @va D2Game:0x6FC8DD60
 */
export function OBJ_ScheduleObjectTrapEventOrSound_6FC8DD60_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
  bTrapIndex: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FC8DD60)
  const edi = pOperateArgs >>> 0
  const esiIdx = bTrapIndex & 0xff
  const rawMax = tryReadU32(m, 0x6fd27bb4) | 0
  const maxIdx = rawMax !== 0 ? rawMax : 10
  if (esiIdx >= maxIdx) return

  const inMemHandler = tryReadU32(m, (0x6fd27b8c + (esiIdx << 2)) >>> 0)
  const handlerVa =
    inMemHandler !== 0
      ? inMemHandler
      : rawMax === 0 && esiIdx < DEFAULT_OBJ_TRAP_HANDLERS_6FD27B8C.length
        ? DEFAULT_OBJ_TRAP_HANDLERS_6FD27B8C[esiIdx]!
        : 0
  if (handlerVa === 0) return
  if (handlerVa === 0xffffffff) {
    throw new D2CommonAssertError('Objects.cpp', 0x56c)
  }

  if (handlerVa === 0x6fc8a4e0) {
    const nClassId = OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c(m, edi) | 0
    const pRoom = UNITS_GetRoom113c(m, m.u32((edi + 0x04) >>> 0) >>> 0) >>> 0
    const canSpawn = OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c(m, pRoom, nClassId) | 0
    if (canSpawn === 0) return
  }

  const pGame = m.u32(edi) >>> 0
  const frame = (m.u32((pGame + 0xa8) >>> 0) + 0x23) >>> 0
  const pObject = m.u32((edi + 0x04) >>> 0) >>> 0
  EVENT_SetEventFull113c(m, pGame, pObject, 4, frame, 0, 0, 0, hooks?.eventWheel)
  SUNIT_SetUnitEventSound113c(m, m.u32((edi + 0x04) >>> 0) >>> 0, 0x0d, 0)
}

/**
 * [17/45] Allocates a `0x18`-byte trade snapshot header and `0x2000`-byte item buffer on `pPlayer`'s
 * `pPlayerData + 0x5C`, serializing inventory/cursor items via `0x6FC737D0` and recording gold (`0x0E`).
 *
 * @va D2Game:0x6FC90FB0
 */
export function PLRTRADE_SavePlayerInventorySnapshot_6FC90FB0_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC90FB0)
  const ebx = pPlayer >>> 0
  const edi = pGame >>> 0
  const ebpData = UNITS_GetPlayerData113c(m, ebx) >>> 0
  if (m.u32((ebpData + 0x5c) >>> 0) !== 0) {
    return 0
  }

  const esiSnap = m.alloc(0x18) >>> 0
  const pBuffer = m.alloc(0x2000) >>> 0
  m.setU32((esiSnap + 0x04) >>> 0, pBuffer)
  const pInventory = m.u32((ebx + 0x60) >>> 0) >>> 0
  const nWritten =
    PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c(
      m,
      pBuffer,
      pInventory,
      edi,
      ebx,
      0x2000,
      0,
      0,
      0,
    ) | 0
  m.setU32(esiSnap, nWritten >>> 0)
  if (nWritten <= 0) {
    throw new D2CommonAssertError('PlrTrade.cpp', 0x806)
  }

  m.setU32((esiSnap + 0x08) >>> 0, 0)
  m.setU32((esiSnap + 0x0c) >>> 0, 0)
  m.setU32((esiSnap + 0x14) >>> 0, 0)
  const gold = STATLIST_GetUnitStat113c(m, ebx, 0x0e, 0) | 0
  m.setU32((esiSnap + 0x10) >>> 0, gold >>> 0)
  m.setU32((ebpData + 0x5c) >>> 0, esiSnap)
  return 1
}

/**
 * [18/45] Validates an active player trade session and optional item (`pItem`) for quest/cube/flag
 * restrictions, cancelling the trade (state `7`, event `0x0D`, button action `6`) and returning
 * whether the item/action is permitted (`1` or `0`).
 *
 * @va D2Game:0x6FC93860
 */
export function PLRTRADE_ValidateTradeItemAndCancelSession_6FC93860_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
  pItem = 0,
  hooks?: K2W4B4Hooks113c,
): number {
  hitD2GameVa113c(0x6FC93860)
  const esi = pPlayer >>> 0
  const ebx = pGame >>> 0
  const ebpData = UNITS_GetPlayerData113c(m, esi) >>> 0
  const bTrading = m.u8((esi + 0x6c) >>> 0) & 0xff
  const dwPartnerId = m.u32((esi + 0x64) >>> 0) >>> 0
  const dwTradeField68 = m.u32((esi + 0x68) >>> 0) >>> 0

  if (bTrading === 0) {
    return i32(m, (ebpData + 0x50) >>> 0) <= 4 ? 1 : 0
  }
  if (dwTradeField68 !== 0) {
    return 1
  }

  const ediPartner = SUNIT_GetServerUnit113c(m, ebx, 0, dwPartnerId) >>> 0
  if (ediPartner === 0) {
    return i32(m, (ebpData + 0x50) >>> 0) <= 4 ? 1 : 0
  }

  const pPartnerData = UNITS_GetPlayerData113c(m, ediPartner) >>> 0
  if (m.u32((pPartnerData + 0x5c) >>> 0) === 0) {
    return 0
  }
  if ((ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c(m, ebx) | 0) !== 0) {
    return 0
  }
  if (((m.u32((esi + 0xc8) >>> 0) >>> 0x17) & 1) !== 0) {
    return 0
  }
  if (((m.u32((ediPartner + 0xc8) >>> 0) >>> 0x17) & 1) !== 0) {
    return 0
  }
  if (m.u32((ebpData + 0x5c) >>> 0) === 0) {
    throw new D2CommonAssertError('PlrTrade.cpp', 0xd39)
  }

  let bAllowed = i32(m, (ebpData + 0x50) >>> 0) === 4 ? 0 : 1
  const item = pItem >>> 0
  if (item !== 0 && (m.u32(item) | 0) === 4) {
    const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, i32(m, (item + 0x04) >>> 0)) >>> 0
    if (m.u8((pItemsTxt + 0x12a) >>> 0) !== 0) {
      const dwCode = m.u32((pItemsTxt + 0x80) >>> 0) >>> 0
      if (dwCode === 0x20786f62) {
        if ((PLRTRADE_HasAnyCubePageItemOnUnit113c(m, esi) | 0) !== 0) {
          bAllowed = 0
          NET_SendEventMessagePacket5A_6FC90BF0_113c(m, 0, 0x0a, esi)
        }
      }
      const hasDupQuest =
        ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
          m,
          ediPartner,
          ebx,
          m.u32((pItemsTxt + 0x80) >>> 0) >>> 0,
        ) | 0
      if (hasDupQuest !== 0) {
        bAllowed = 0
      }
    } else {
      const hasFlag1000 = ITEMS_CheckCommandFlags113c(m, item, 0x1000, 0xd55, 0x6fd1bd3c) | 0
      if (hasFlag1000 !== 0) {
        bAllowed = 0
      } else {
        ITEMS_GetItemQuality113c(m, item)
      }
    }
  }

  m.setU32((esi + 0xc8) >>> 0, (m.u32((esi + 0xc8) >>> 0) | 0x400000) >>> 0)
  m.setU32((ebpData + 0x50) >>> 0, 7)
  m.setU32((pPartnerData + 0x50) >>> 0, 7)

  const frame1 = (m.u32((ebx + 0xa8) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, ebx, esi, 0x0d, frame1, 0, 0, 0, hooks?.eventWheel)
  const frame2 = (m.u32((ebx + 0xa8) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, ebx, ediPartner, 0x0d, frame2, 0, 0, 0, hooks?.eventWheel)

  const pClient1 =
    (m.u32(esi) | 0) === 0
      ? m.u32((UNITS_GetPlayerData113c(m, esi) + 0x9c) >>> 0) >>> 0
      : 0
  NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 6, pClient1)

  const pClient2 =
    (m.u32(ediPartner) | 0) === 0
      ? m.u32((UNITS_GetPlayerData113c(m, ediPartner) + 0x9c) >>> 0) >>> 0
      : 0
  NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 6, pClient2)

  return bAllowed
}

/**
 * [19/45] Advances a monster's path step (`MONSTER_StepPath113c`) and animation frame
 * (`UNITS_AdvanceAnimFrame113c`), calling `0x6FC965E0` and returning `2` when finished (or `1` while ongoing).
 *
 * @va D2Game:0x6FC96A10
 */
export function MONSTER_TickPathStepAndAnim_6FC96A10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  hooks?: K2W4B4Hooks113c,
): number {
  hitD2GameVa113c(0x6FC96A10)
  const edi = pGame >>> 0
  const esi = pMonster >>> 0
  const stepWorld =
    hooks !== undefined && hooks.world !== undefined
      ? hooks.world
      : ({ m } as unknown as FallenSliceWorld113c)
  MONSTER_StepPath113c(stepWorld, esi)
  UNITS_AdvanceAnimFrame113c(m, esi)
  if ((UNITS_HasAnimFinished113c(m, esi) | 0) !== 0) {
    MONSTER_StartGetHitOrScheduleAi_6FC965E0_113c(m, edi, esi)
    return 2
  }
  return 1
}

/**
 * [20/45] Spawns a gold item (`nRequiredType = 4`) at `pSourceUnit`'s coordinates via `0x6FC31CA0`,
 * sets its gold amount (`stat 14`) with player gold-bank cap guard, and records `pOwnerUnit`'s GUID
 * via `ITEMS_SetCellOverwrite113c`.
 *
 * @va D2Game:0x6FC98C50
 */
export function ITEMS_DropGoldPileWithOwnerAtUnit_6FC98C50_113c(
  m: D2KernMemory113c,
  pSourceUnit: number,
  nGoldAmount: number,
  pOwnerUnit: number,
  pGame: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FC98C50)
  const ediGold = nGoldAmount | 0
  if (ediGold <= 0) return

  const esiSrc = pSourceUnit >>> 0
  const ebxOwner = pOwnerUnit >>> 0
  const game = pGame >>> 0
  const pCoords = allocStackFrame113c(8)
  try {
    PATH_GetTargetTypeAndPosition113c(m, esiSrc, pCoords)
    const pRoom = UNITS_GetRoom113c(m, esiSrc) >>> 0
    const pGoldItem = hooks?.onSpawnRandomMiscItemInRoomAtCoords_6FC31CA0
      ? hooks.onSpawnRandomMiscItemInRoomAtCoords_6FC31CA0(
          m,
          pCoords,
          game,
          pRoom,
          4,
          1,
          ebxOwner,
        ) >>> 0
      : ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c(
          m,
          pCoords,
          game,
          pRoom,
          4,
          1,
          ebxOwner,
        ) >>> 0
    if (pGoldItem === 0) return

    const itemType = ITEMS_GetItemTypeFromItem113c(m, pGoldItem) | 0
    if (itemType !== 4) {
      throw new D2CommonAssertError('SUnitDmg.cpp', 0x24b)
    }

    let val = ediGold
    if ((m.u32(pGoldItem) | 0) === 0) {
      const limit = STATLIST_GetUnitGoldBankLimit113c(m, pGoldItem) | 0
      if (val > limit) {
        val = 0
      }
    }
    STATLIST_SetUnitStat113c(m, pGoldItem, 0x0e, val, 0)

    const ownerGuid = ebxOwner !== 0 ? m.u32((ebxOwner + 0x0c) >>> 0) >>> 0 : 0xffffffff
    ITEMS_SetCellOverwrite113c(m, pGoldItem, ownerGuid)
  } finally {
    freeStackFrame113c(8)
  }
}

function stepUnitLcgMod100_113c(m: D2KernMemory113c, pSeed: number): number {
  const lo = BigInt(m.u32(pSeed >>> 0))
  const hi = BigInt(m.u32(((pSeed >>> 0) + 0x04) >>> 0))
  const prod = lo * 0x6ac690c5n + hi
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32(((pSeed >>> 0) + 0x04) >>> 0, newHi)
  m.setU32(pSeed >>> 0, newLo)
  return (newLo % 0x64) | 0
}

function approachTargetOrStartMode113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  pTarget: number,
  nMode: number,
  nStepNum: number,
  dwFlags: number,
  hooks?: K2W4B4Hooks113c,
): void {
  if (hooks !== undefined && hooks.world !== undefined) {
    AI_ApproachTarget113c(hooks.world, pMonster, pTarget, nMode, 0, 0, nStepNum, dwFlags)
  } else {
    AI_ApproachTarget113c(m, pGame, pMonster, pTarget, nMode, 0, 0, nStepNum, dwFlags)
  }
}

/**
 * [21/45] AI awakening / burrow-emerge think callback (`0x6FC9CE40`): frees pending event `2` nodes
 * and reschedules event `2` when `pAiParam->dwState` is `10` or `11`, or casts skill `pMonStats + 0x170`
 * and unburrows (`0x6FC9BE10`) when `pAiParam + 0x1C >= 2`.
 *
 * @va D2Game:0x6FC9CE40
 */
export function AI_ThinkWakeOrUnburrowSkill_6FC9CE40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  pAiTickArgs: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FC9CE40)
  const ediGame = pGame >>> 0
  const esiMon = pMonster >>> 0
  const ecxArgs = pAiTickArgs >>> 0
  const ebpParam = m.u32(ecxArgs) >>> 0
  const aiState = i32(m, ebpParam)
  const edxStats = m.u32((ecxArgs + 0x1c) >>> 0) >>> 0

  if (aiState === 0x0a || aiState === 0x0b) {
    AI_InitMonsterAiThinkFn113c(m, esiMon, ediGame, ebpParam, aiState)
    if (esiMon !== 0) {
      let pEvent = m.u32((esiMon + 0xdc) >>> 0) >>> 0
      while (pEvent !== 0) {
        const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
        if (m.u8(pEvent) === 2) {
          EVENT_FreeNode113c(m, ediGame, pEvent)
        }
        pEvent = pNext
      }
    }
    const frame = (m.u32((ediGame + 0xa8) >>> 0) + 1) >>> 0
    EVENT_SetEventFull113c(m, ediGame, esiMon, 2, frame, 0, 0, 0, hooks?.eventWheel)
    return
  }

  const nSkillId = (m.u16((edxStats + 0x170) >>> 0) << 16) >> 16
  if (nSkillId >= 0 && i32(m, (ebpParam + 0x1c) >>> 0) >= 2) {
    const pTarget = m.u32((ecxArgs + 0x08) >>> 0) >>> 0
    const nMode = m.u8((edxStats + 0x180) >>> 0) & 0xff
    AI_CastSkillWithMode113c(
      m,
      nMode,
      esiMon,
      ediGame,
      nSkillId,
      pTarget,
      0,
      0,
      hooks?.world,
      hooks?.aiFallen,
    )
    m.setU32((ebpParam + 0x1c) >>> 0, 1)
    AI_UnburrowAndScheduleThink_6FC9BE10_113c(m, ediGame, esiMon)
    return
  }

  AI_InitMonsterAiThinkFn113c(m, esiMon, ediGame, ebpParam, aiState)
  AI_ScheduleAiThinkTimer_6FD120C0_113c(m, ediGame, esiMon, 1)
}

/**
 * [22/45] Standard melee monster AI think (`0x6FCA1F50`): wanders or stalls when distance exceeds
 * `wAiParam[0]` (`+0x56`), rolls attack (`wAiParam[2]` at `+0x62`) and A1/A2 (`wAiParam[3]` at `+0x68`)
 * when in melee range, or approaches the target.
 *
 * @va D2Game:0x6FCA1F50
 */
export function AI_ThinkMeleeBasic_6FCA1F50_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  pAiTickArgs: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FCA1F50)
  const ebxGame = pGame >>> 0
  const esiMon = pMonster >>> 0
  const args = pAiTickArgs >>> 0
  const ebpInMelee = i32(m, (args + 0x18) >>> 0)
  const pTarget = m.u32((args + 0x08) >>> 0) >>> 0
  const nDist = i32(m, (args + 0x14) >>> 0)
  const ediStats = m.u32((args + 0x1c) >>> 0) >>> 0
  const pSeed = (esiMon + 0x20) >>> 0

  if (esiMon !== 0 && (m.u32(esiMon) | 0) === 1) {
    const pMonData = m.u32((esiMon + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const subType = i32(m, (pMonData + 0x54) >>> 0)
      if ((subType === 3 || subType === 0x13) && ebpInMelee === 0) {
        approachTargetOrStartMode113c(m, ebxGame, esiMon, pTarget, 2, 1, 7, hooks)
        return
      }
    }
  }

  const diff0 = m.u8((ebxGame + 0x6d) >>> 0) & 0xff
  const maxDist = (m.u16((ediStats + diff0 * 2 + 0x56) >>> 0) << 16) >> 16
  if (nDist > maxDist) {
    const rollWander = stepUnitLcgMod100_113c(m, pSeed)
    const diff1 = m.u8((ebxGame + 0x6d) >>> 0) & 0xff
    const wanderChance = (m.u16((ediStats + diff1 * 2 + 0x5c) >>> 0) << 16) >> 16
    if (rollWander < wanderChance) {
      AI_IdleWander113c(m, ebxGame, esiMon, 3)
      return
    }
    const stallDelay = (m.u16((ediStats + diff1 * 2 + 0x6e) >>> 0) << 16) >> 16
    AI_Stall113c(m, ebxGame, esiMon, stallDelay)
    return
  }

  if (ebpInMelee !== 0) {
    const rollAtk = stepUnitLcgMod100_113c(m, pSeed)
    const diff2 = m.u8((ebxGame + 0x6d) >>> 0) & 0xff
    const atkChance = (m.u16((ediStats + diff2 * 2 + 0x62) >>> 0) << 16) >> 16
    if (rollAtk < atkChance) {
      const seedObj = {
        lo: m.u32(pSeed) >>> 0,
        hi: m.u32((pSeed + 0x04) >>> 0) >>> 0,
      }
      const rollA2 = seedRoll(seedObj, 0x64) | 0
      m.setU32(pSeed, seedObj.lo >>> 0)
      m.setU32((pSeed + 0x04) >>> 0, seedObj.hi >>> 0)
      const diff3 = m.u8((ebxGame + 0x6d) >>> 0) & 0xff
      const a1Chance = (m.u16((ediStats + diff3 * 2 + 0x68) >>> 0) << 16) >> 16
      const atkMode = rollA2 < a1Chance ? 4 : 5
      AI_StartAttackMode113c(
        m,
        atkMode,
        esiMon,
        ebxGame,
        pTarget,
        hooks?.world,
        hooks?.aiFallen,
      )
      return
    }
    const stallDelay = (m.u16((ediStats + diff2 * 2 + 0x6e) >>> 0) << 16) >> 16
    AI_Stall113c(m, ebxGame, esiMon, stallDelay)
  }

  approachTargetOrStartMode113c(m, ebxGame, esiMon, pTarget, 2, 1, 7, hooks)
}

function startMonsterAttackModeWithMonStats2MoveCheck113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  nMode: number,
  pTarget: number,
  hooks?: K2W4B4Hooks113c,
): void {
  const ediGame = pGame >>> 0
  const esiMon = pMonster >>> 0
  const target = pTarget >>> 0
  const mode = nMode | 0

  SKILLS_SetUsedSkillMemPort113c(m, esiMon, 0)
  const pModeArgs = allocStackFrame113c(0x20)
  try {
    for (let i = 0; i < 0x20; i += 4) {
      m.setU32((pModeArgs + i) >>> 0, 0)
    }
    m.setU32(pModeArgs, mode >>> 0)
    m.setU32((pModeArgs + 0x04) >>> 0, esiMon)
    m.setU32((pModeArgs + 0x08) >>> 0, target)

    let bPathType = 0x64
    if (esiMon !== 0) {
      const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, i32(m, (esiMon + 0x04) >>> 0)) >>> 0
      if (pMonStats2 !== 0) {
        const pMasks = tryReadU32(m, D2GAME_IAT_GDW_BITMASKS_VA_113C)
        const byteOff = (mode >>> 3) & 3
        const bitIdx = mode & 7
        const mask =
          pMasks !== 0 ? m.u32((pMasks + (bitIdx << 2)) >>> 0) >>> 0 : (1 << bitIdx) >>> 0
        if ((m.u8((pMonStats2 + 0x104 + byteOff) >>> 0) & mask) !== 0) {
          bPathType = 0x65
        }
      }
    }
    m.setU8((pModeArgs + 0x15) >>> 0, bPathType)

    if (hooks?.aiFallen?.onMonsterStartMode) {
      hooks.aiFallen.onMonsterStartMode(m, ediGame, pModeArgs, 1)
      return
    }

    const pPath = esiMon !== 0 ? m.u32((esiMon + 0x2c) >>> 0) >>> 0 : 0
    if (pPath !== 0 && mode !== 3) {
      if (target !== 0) {
        PATH_SetTargetUnit113c(m, pPath, target)
      }
      PATH_SetDistance113c(m, pPath, 0x14)
    }

    let pAiCtrl = 0
    if (esiMon !== 0 && (m.u32(esiMon) | 0) === 1) {
      const pMonData = m.u32((esiMon + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        pAiCtrl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
      }
    }

    let rawPathType = bPathType
    let velOv = 0
    let distOv = 0
    if (pAiCtrl !== 0) {
      const ptOv = m.u32((pAiCtrl + 0x18) >>> 0) | 0
      if (ptOv !== 0) {
        rawPathType = ptOv
      }
      velOv = m.u32((pAiCtrl + 0x1c) >>> 0) | 0
      distOv = m.u8((pAiCtrl + 0x20) >>> 0) & 0xff
      m.setU32((pAiCtrl + 0x18) >>> 0, 0)
      m.setU32((pAiCtrl + 0x1c) >>> 0, 0)
      m.setU8((pAiCtrl + 0x20) >>> 0, 0)
    }

    if (rawPathType === 0x64) {
      if (pAiCtrl !== 0) {
        m.setU32((pAiCtrl + 0x10) >>> 0, 0)
        m.setU32((pAiCtrl + 0x14) >>> 0, 0xffffffff)
      }
      if (ediGame !== 0) {
        m.setU32((ediGame + 0x1d70) >>> 0, (m.u32((ediGame + 0x1d70) >>> 0) + 1) >>> 0)
      }
      MONSTER_StartMode113c(m, ediGame, esiMon, mode, target, 0, 0)
      return
    }

    const mappedPathType = rawPathType === 0x65 ? 0x0d : rawPathType
    const newDist = distOv !== 0 ? distOv : 5
    let pathOk = 0
    if (pPath !== 0) {
      PATH_SetNewDistance113c(m, pPath, newDist)
      PATH_SetType113c(m, pPath, mappedPathType)
      const pRoom = m.u32((pPath + 0x1c) >>> 0) >>> 0
      const pRoomEx = pRoom !== 0 ? m.u32((pRoom + 0x10) >>> 0) >>> 0 : 0
      if (pRoomEx !== 0 && m.u32((pRoomEx + 0x6c) >>> 0) !== 0) {
        pathOk = PATH_Compute113c(m, pPath, esiMon, 0) !== 0 ? 1 : 0
      } else {
        m.setU32((pPath + 0x10) >>> 0, 1)
        pathOk = 1
      }
    }
    if (pAiCtrl !== 0) {
      const hasPts = pPath !== 0 && PATH_GetNumberOfPathPoints113c(m, pPath) !== 0
      m.setU32((pAiCtrl + 0x10) >>> 0, velOv >>> 0)
      m.setU32((pAiCtrl + 0x14) >>> 0, pathOk !== 1 && hasPts ? 0x0a : 0xffffffff)
    }
    if (ediGame !== 0) {
      const slotOff = (0x1d70 + (pathOk << 2)) >>> 0
      m.setU32((ediGame + slotOff) >>> 0, (m.u32((ediGame + slotOff) >>> 0) + 1) >>> 0)
      if (pathOk !== 0) {
        m.setU32((ediGame + 0x1db4) >>> 0, (m.u32((ediGame + 0x1db4) >>> 0) + 1) >>> 0)
      }
    }

    MONSTER_StartMode113c(m, ediGame, esiMon, mode, target, 0, 0)
    if (pPath !== 0 && PATH_GetNumberOfPathPoints113c(m, pPath) !== 0) {
      MONSTER_RegisterContinuousModeEvent113c(m, ediGame, esiMon)
    }
  } finally {
    freeStackFrame113c(0x20)
  }
}

function executeSimpleMeleeOrApproachAi113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  pAiTickArgs: number,
  hooks?: K2W4B4Hooks113c,
): void {
  const ediGame = pGame >>> 0
  const esiMon = pMonster >>> 0
  const args = pAiTickArgs >>> 0
  const bInMelee = i32(m, (args + 0x18) >>> 0)
  const pTarget = m.u32((args + 0x08) >>> 0) >>> 0
  const ecxStats = m.u32((args + 0x1c) >>> 0) >>> 0

  const roll100 = stepUnitLcgMod100_113c(m, (esiMon + 0x20) >>> 0)
  const diff = m.u8((ediGame + 0x6d) >>> 0) & 0xff

  if (bInMelee !== 0) {
    const atkChance = (m.u16((ecxStats + diff * 2 + 0x62) >>> 0) << 16) >> 16
    if (roll100 < atkChance) {
      startMonsterAttackModeWithMonStats2MoveCheck113c(m, ediGame, esiMon, 4, pTarget, hooks)
      return
    }
  } else {
    const approachChance = (m.u16((ecxStats + diff * 2 + 0x56) >>> 0) << 16) >> 16
    if (roll100 < approachChance) {
      approachTargetOrStartMode113c(m, ediGame, esiMon, pTarget, 2, 1, 7, hooks)
      return
    }
  }

  const stallDelay = (m.u16((ecxStats + diff * 2 + 0x5c) >>> 0) << 16) >> 16
  AI_Stall113c(m, ediGame, esiMon, stallDelay)
}

/**
 * [23/45] Simple melee/approach AI think variant A (`0x6FCA2430`): clears used skill and starts mode `4`
 * (setting `D2ModeChangeStrc.bPathType = 0x65` when `MonStats2[+0x104] & 0x10 !== 0`, else `0x64`)
 * when in melee range and `roll < wAiParam[2]`, approaches in mode `2` when `roll < wAiParam[0]`, or stalls.
 *
 * @va D2Game:0x6FCA2430
 */
export function AI_ThinkSimpleMeleeVariantA_6FCA2430_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  pAiTickArgs: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FCA2430)
  executeSimpleMeleeOrApproachAi113c(m, pGame, pMonster, pAiTickArgs, hooks)
}

/**
 * [24/45] Simple melee/approach AI think variant B (`0x6FCA2570`): identical binary routine to `0x6FCA2430`.
 *
 * @va D2Game:0x6FCA2570
 */
export function AI_ThinkSimpleMeleeVariantB_6FCA2570_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  pAiTickArgs: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FCA2570)
  executeSimpleMeleeOrApproachAi113c(m, pGame, pMonster, pAiTickArgs, hooks)
}

/**
 * [25/45] Charger / fast-runner AI think (`0x6FCA2EC0`): charges in mode `0x0F` (`15`) with velocity bonus
 * `wAiParam[3]` (`[-126, 126]`) when distance exceeds `20 - 3 * nBonusTier` or when `roll < wAiParam[4]`,
 * attacks in mode `4` in melee range, or approaches/stalls.
 *
 * @va D2Game:0x6FCA2EC0
 */
export function AI_ThinkChargerRunOrAttack_6FCA2EC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  pAiTickArgs: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FCA2EC0)
  const ediGame = pGame >>> 0
  const ebpMon = pMonster >>> 0
  const args = pAiTickArgs >>> 0
  const ebxStats = m.u32((args + 0x1c) >>> 0) >>> 0
  const nDist = i32(m, (args + 0x14) >>> 0)
  const bInMelee = i32(m, (args + 0x18) >>> 0)
  const pTarget = m.u32((args + 0x08) >>> 0) >>> 0

  UNITS_GetRoom113c(m, ebpMon)
  const pBonusScratch = allocStackFrame113c(16)
  let nBonusTier = 0
  try {
    m.setU32(pBonusScratch, 0)
    m.setU32((pBonusScratch + 0x04) >>> 0, 0)
    m.setU32((pBonusScratch + 0x08) >>> 0, 0)
    m.setU32((pBonusScratch + 0x0c) >>> 0, 0)
    MONSTER_GetDifficultyAndPlayerBonus113c(
      m,
      ediGame,
      pBonusScratch,
      (pBonusScratch + 4) >>> 0,
      (pBonusScratch + 8) >>> 0,
      (pBonusScratch + 12) >>> 0,
      ebpMon,
    )
    nBonusTier = i32(m, pBonusScratch)
  } finally {
    freeStackFrame113c(16)
  }

  const runCharge = (velBonus: number): void => {
    if (velBonus < -126 || velBonus > 126) {
      throw new D2CommonAssertError('AiThink.cpp', 0x110)
    }
    let pAiGen = 0
    if (ebpMon !== 0 && (m.u32(ebpMon) | 0) === 1) {
      const pMonData = m.u32((ebpMon + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        pAiGen = m.u32((pMonData + 0x2c) >>> 0) >>> 0
      }
    }
    m.setU32((pAiGen + 0x18) >>> 0, 0x0d)
    if (velBonus !== 0) {
      m.setU32((pAiGen + 0x1c) >>> 0, velBonus >>> 0)
    }
    approachTargetOrStartMode113c(m, ediGame, ebpMon, pTarget, 0x0f, 3, 0, hooks)
  }

  const threshold = (0x14 - imul32(nBonusTier, 3)) | 0
  if (nDist > threshold) {
    const diff0 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
    const velBonus = (m.u16((ebxStats + diff0 * 2 + 0x68) >>> 0) << 16) >> 16
    runCharge(velBonus)
    return
  }

  if (bInMelee !== 0) {
    const rollAtk = stepUnitLcgMod100_113c(m, (ebpMon + 0x20) >>> 0)
    const diff1 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
    const atkChance = (m.u16((ebxStats + diff1 * 2 + 0x62) >>> 0) << 16) >> 16
    if (rollAtk < atkChance) {
      startMonsterAttackModeWithMonStats2MoveCheck113c(m, ediGame, ebpMon, 4, pTarget, hooks)
      return
    }
    const stallDelay = (m.u16((ebxStats + diff1 * 2 + 0x5c) >>> 0) << 16) >> 16
    AI_Stall113c(m, ediGame, ebpMon, stallDelay)
    return
  }

  const rollMove = stepUnitLcgMod100_113c(m, (ebpMon + 0x20) >>> 0)
  const diff2 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
  const moveChance = (m.u16((ebxStats + diff2 * 2 + 0x56) >>> 0) << 16) >> 16
  if (rollMove >= moveChance) {
    const stallDelay = (m.u16((ebxStats + diff2 * 2 + 0x5c) >>> 0) << 16) >> 16
    AI_Stall113c(m, ediGame, ebpMon, stallDelay)
    return
  }

  const rollRun = stepUnitLcgMod100_113c(m, (ebpMon + 0x20) >>> 0)
  const diff3 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
  const runChance = (m.u16((ebxStats + diff3 * 2 + 0x6e) >>> 0) << 16) >> 16
  if (rollRun < runChance) {
    const velBonus = (m.u16((ebxStats + diff3 * 2 + 0x68) >>> 0) << 16) >> 16
    runCharge(velBonus)
    return
  }

  approachTargetOrStartMode113c(m, ediGame, ebpMon, pTarget, 2, 1, 7, hooks)
}


/**
 * [26/45] Dual-attack melee/approach AI think (`0x6FCA3AC0`): rolls `wAiParam[2]` (`+0x62`) and
 * `wAiParam[3]` (`+0x68`) in melee range to start mode `4` (`A1`) or `5` (`A2`), approaches in mode `2`
 * when `roll < wAiParam[0]` (`+0x56`), or stalls by `wAiParam[1]` (`+0x5C`).
 *
 * @va D2Game:0x6FCA3AC0
 */
export function AI_ThinkDualAttackMelee_6FCA3AC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  pAiTickArgs: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FCA3AC0)
  const ediGame = pGame >>> 0
  const esiMon = pMonster >>> 0
  const args = pAiTickArgs >>> 0
  const bInMelee = i32(m, (args + 0x18) >>> 0)
  const ebxStats = m.u32((args + 0x1c) >>> 0) >>> 0
  const ebpTarget = m.u32((args + 0x08) >>> 0) >>> 0

  if (bInMelee !== 0) {
    const rollAtk = stepUnitLcgMod100_113c(m, (esiMon + 0x20) >>> 0)
    const diff0 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
    const atkChance = (m.u16((ebxStats + diff0 * 2 + 0x62) >>> 0) << 16) >> 16
    if (rollAtk < atkChance) {
      const rollA1 = stepUnitLcgMod100_113c(m, (esiMon + 0x20) >>> 0)
      const diff1 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
      const a1Chance = (m.u16((ebxStats + diff1 * 2 + 0x68) >>> 0) << 16) >> 16
      const atkMode = rollA1 < a1Chance ? 4 : 5
      startMonsterAttackModeWithMonStats2MoveCheck113c(m, ediGame, esiMon, atkMode, ebpTarget, hooks)
      return
    }
    const stallDelay = (m.u16((ebxStats + diff0 * 2 + 0x5c) >>> 0) << 16) >> 16
    AI_Stall113c(m, ediGame, esiMon, stallDelay)
    return
  }

  const rollMove = stepUnitLcgMod100_113c(m, (esiMon + 0x20) >>> 0)
  const diff2 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
  const moveChance = (m.u16((ebxStats + diff2 * 2 + 0x56) >>> 0) << 16) >> 16
  if (rollMove < moveChance) {
    approachTargetOrStartMode113c(m, ediGame, esiMon, ebpTarget, 2, 1, 7, hooks)
    return
  }
  const stallDelay = (m.u16((ebxStats + diff2 * 2 + 0x5c) >>> 0) << 16) >> 16
  AI_Stall113c(m, ediGame, esiMon, stallDelay)
}

/**
 * [27/45] Scans hostile units around `pMonster` via `0x6FC9CF10` (`AITARGET_ScanUnitsByModeTable113c`)
 * and probabilistically selects `pCtx + 0x0C` using `wAiParam[1]` (`+0x5C`) or `wAiParam[2]` (`+0x62`),
 * falling back to `pDefaultTarget`.
 *
 * @va D2Game:0x6FCA4720
 */
export function AI_SelectHostileTargetByMetrics_6FCA4720_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  pMonStats: number,
  pDefaultTarget: number,
): number {
  hitD2GameVa113c(0x6FCA4720)
  void AI_ScanCallbackHostileTargetsMetrics_6FC9CF10_113c
  const ediGame = pGame >>> 0
  const esiMon = pMonster >>> 0
  const ebxStats = pMonStats >>> 0
  const defTarget = pDefaultTarget >>> 0

  const pCtx = allocStackFrame113c(0x28)
  try {
    for (let i = 0; i < 0x28; i += 4) {
      m.setU32((pCtx + i) >>> 0, 0)
    }
    m.setU32((pCtx + 0x04) >>> 0, 0x7fffffff)
    m.setU32((pCtx + 0x10) >>> 0, 0x7fffffff)
    m.setU32((pCtx + 0x18) >>> 0, 0x7fffffff)

    hitD2GameVa113c(0x6FCD17B0)
    MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c(
      m,
      esiMon,
      0x6fc9cf10,
      ediGame,
      pCtx,
      AI_ScanCallbackHostileTargetsMetrics_6FC9CF10_113c,
    )

    if (m.u32((pCtx + 0x0c) >>> 0) !== 0) {
      const roll1 = stepUnitLcgMod100_113c(m, (esiMon + 0x20) >>> 0)
      const diff1 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
      const chance1 = (m.u16((ebxStats + diff1 * 2 + 0x5c) >>> 0) << 16) >> 16
      if (roll1 < chance1) {
        return m.u32((pCtx + 0x0c) >>> 0) >>> 0
      }
    }

    if (m.u32((pCtx + 0x14) >>> 0) !== 0) {
      const roll2 = stepUnitLcgMod100_113c(m, (esiMon + 0x20) >>> 0)
      const diff2 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
      const chance2 = (m.u16((ebxStats + diff2 * 2 + 0x62) >>> 0) << 16) >> 16
      if (roll2 < chance2) {
        return m.u32((pCtx + 0x0c) >>> 0) >>> 0
      }
    }

    return defTarget
  } finally {
    freeStackFrame113c(0x28)
  }
}

/**
 * [28/45] Pack-following / circling melee AI think (`0x6FCA4800`): attacks in mode `4` when in melee range,
 * approaches `pTarget` via path type `13` (`0x6FD13000`) when `roll < wAiParam[0]`, regroups toward closest
 * same-base monster (`0x6FCBCA00`) when beyond `wAiParam[2]^2`, circles (`pathType = 5 | 6`), or stalls.
 *
 * @va D2Game:0x6FCA4800
 */
export function AI_ThinkPackFollowerMelee_6FCA4800_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  pAiTickArgs: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FCA4800)
  void SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c
  const ediGame = pGame >>> 0
  const esiMon = pMonster >>> 0
  const args = pAiTickArgs >>> 0
  const bInMelee = i32(m, (args + 0x18) >>> 0)
  const ebpTarget = m.u32((args + 0x08) >>> 0) >>> 0
  const ebxStats = m.u32((args + 0x1c) >>> 0) >>> 0

  if (bInMelee !== 0) {
    const rollAtk = stepUnitLcgMod100_113c(m, (esiMon + 0x20) >>> 0)
    const diff0 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
    const atkChance = (m.u16((ebxStats + diff0 * 2 + 0x5c) >>> 0) << 16) >> 16
    if (rollAtk < atkChance) {
      startMonsterAttackModeWithMonStats2MoveCheck113c(m, ediGame, esiMon, 4, ebpTarget, hooks)
      return
    }
    const stallDelay = (m.u16((ebxStats + diff0 * 2 + 0x68) >>> 0) << 16) >> 16
    AI_Stall113c(m, ediGame, esiMon, stallDelay)
    return
  }

  const getAiGeneral = (): number => {
    if (esiMon !== 0 && (m.u32(esiMon) | 0) === 1) {
      const pMonData = m.u32((esiMon + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        return m.u32((pMonData + 0x2c) >>> 0) >>> 0
      }
    }
    return 0
  }

  const rollApproach = stepUnitLcgMod100_113c(m, (esiMon + 0x20) >>> 0)
  const diff1 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
  const approachChance = (m.u16((ebxStats + diff1 * 2 + 0x56) >>> 0) << 16) >> 16
  if (rollApproach < approachChance) {
    const pAiGen = getAiGeneral()
    m.setU32((pAiGen + 0x1c) >>> 0, 0x4b)
    AI_ApproachTargetPathType13_6FD13000_113c(m, esiMon, ebpTarget, ediGame, 7, hooks?.w2b8)
    return
  }

  const pBestCtx = allocStackFrame113c(8)
  try {
    m.setU32(pBestCtx, 0)
    m.setU32((pBestCtx + 4) >>> 0, 0x7fffffff)
    hitD2GameVa113c(0x6FCD17B0)
    MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c(
      m,
      esiMon,
      0x6fcbca00,
      ediGame,
      pBestCtx,
      (mem, _pg, orig, cand, ctx) =>
        SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c(mem, orig, cand, ctx),
    )
    const pAlly = m.u32(pBestCtx) >>> 0
    if (pAlly !== 0) {
      const diff2 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
      const maxAllyDist = (m.u16((ebxStats + diff2 * 2 + 0x62) >>> 0) << 16) >> 16
      const maxDistSq = imul32(maxAllyDist, maxAllyDist)
      if (i32(m, (pBestCtx + 4) >>> 0) > maxDistSq) {
        const pAiGen = getAiGeneral()
        m.setU32((pAiGen + 0x1c) >>> 0, 0x4b)
        approachTargetOrStartMode113c(m, ediGame, esiMon, pAlly, 2, 1, 7, hooks)
        return
      }
    }
  } finally {
    freeStackFrame113c(8)
  }

  const rollCircle = stepUnitLcgMod100_113c(m, (esiMon + 0x20) >>> 0)
  if (rollCircle < 0x19) {
    const lo = BigInt(m.u32((esiMon + 0x20) >>> 0))
    const hi = BigInt(m.u32((esiMon + 0x24) >>> 0))
    const prod = lo * 0x6ac690c5n + hi
    const newLo = Number(prod & 0xffffffffn) >>> 0
    const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
    m.setU32((esiMon + 0x24) >>> 0, newHi)
    m.setU32((esiMon + 0x20) >>> 0, newLo)
    const pathType = (newLo & 0xff) < 0x80 ? 5 : 6
    const pAiGen = getAiGeneral()
    m.setU32((pAiGen + 0x18) >>> 0, pathType)
    m.setU8((pAiGen + 0x20) >>> 0, 3)
    approachTargetOrStartMode113c(m, ediGame, esiMon, ebpTarget, 2, 1, 0, hooks)
    return
  }

  const diff3 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
  const stallDelay = (m.u16((ebxStats + diff3 * 2 + 0x68) >>> 0) << 16) >> 16
  AI_Stall113c(m, ediGame, esiMon, stallDelay)
}


/**
 * [29/45] Burrower / spawner AI think (`0x6FCA77B0`): transitions from mode `1` -> `0x0A` -> `0x0B`
 * when `nDist <= 5`, spawns up to `wAiParam[0]` (`+0x56`) split-monsters via `UNITS_GetMonsterSplitSpawnParams113c`
 * and `MONSTER_SpawnAtCoords113c` every `wAiParam[1]` (`+0x5C`) frames (applying state `0xB8` and icon `0xCA`
 * when `dwTxtFileNo === 0x2C7`), and enters mode `0` (`DT`) when depleted.
 *
 * @va D2Game:0x6FCA77B0
 */
export function AI_ThinkBurrowerSpawner_6FCA77B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  pAiTickArgs: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FCA77B0)
  const esiGame = pGame >>> 0
  const ediMon = pMonster >>> 0
  const args = pAiTickArgs >>> 0
  const ebxParam = m.u32(args) >>> 0
  const ebpStats = m.u32((args + 0x1c) >>> 0) >>> 0

  if (i32(m, (ebxParam + 0x14) >>> 0) <= 0) {
    const diff0 = m.u8((esiGame + 0x6d) >>> 0) & 0xff
    const delay0 = (m.u16((ebpStats + diff0 * 2 + 0x5c) >>> 0) << 16) >> 16
    m.setU32((ebxParam + 0x14) >>> 0, (i32(m, (esiGame + 0xa8) >>> 0) + delay0) >>> 0)
    const diff1 = m.u8((esiGame + 0x6d) >>> 0) & 0xff
    const count0 = (m.u16((ebpStats + diff1 * 2 + 0x56) >>> 0) << 16) >> 16
    m.setU32((ebxParam + 0x18) >>> 0, count0 >>> 0)
  }

  const nAnimMode = ediMon !== 0 ? i32(m, (ediMon + 0x10) >>> 0) : 0
  if (nAnimMode === 1) {
    if (i32(m, (args + 0x14) >>> 0) > 5) {
      AI_Stall113c(m, esiGame, ediMon, 5)
      return
    }
    startMonsterAttackModeWithMonStats2MoveCheck113c(m, esiGame, ediMon, 0x0a, 0, hooks)
    AI_ScheduleAiThinkTimer_6FD120C0_113c(m, esiGame, ediMon, 0x14)
    return
  }

  if (nAnimMode === 0x0a) {
    startMonsterAttackModeWithMonStats2MoveCheck113c(m, esiGame, ediMon, 0x0b, 0, hooks)
    AI_ScheduleAiThinkTimer_6FD120C0_113c(m, esiGame, ediMon, 0x14)
    return
  }

  if (nAnimMode === 0x0b && i32(m, (ebxParam + 0x18) >>> 0) > 0) {
    if (i32(m, (esiGame + 0xa8) >>> 0) > i32(m, (ebxParam + 0x14) >>> 0)) {
      const diff2 = m.u8((esiGame + 0x6d) >>> 0) & 0xff
      const delay2 = (m.u16((ebpStats + diff2 * 2 + 0x5c) >>> 0) << 16) >> 16
      m.setU32((ebxParam + 0x14) >>> 0, (i32(m, (esiGame + 0xa8) >>> 0) + delay2) >>> 0)

      const pSpawnScratch = allocStackFrame113c(16)
      try {
        m.setU32(pSpawnScratch, 0)
        m.setU32((pSpawnScratch + 4) >>> 0, 0)
        m.setU32((pSpawnScratch + 8) >>> 0, 0)
        m.setU32((pSpawnScratch + 12) >>> 0, 0)
        UNITS_GetMonsterSplitSpawnParams113c(
          m,
          ediMon,
          (pSpawnScratch + 4) >>> 0,
          (pSpawnScratch + 8) >>> 0,
          (pSpawnScratch + 12) >>> 0,
          pSpawnScratch,
          0,
          0,
        )
        const spawnX = i32(m, (pSpawnScratch + 8) >>> 0)
        const spawnY = i32(m, (pSpawnScratch + 12) >>> 0)
        const pRoom = UNITS_GetRoom113c(m, ediMon) >>> 0
        const pSpawnRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom, spawnX, spawnY) >>> 0
        if (pSpawnRoom !== 0) {
          const pSpawned =
            MONSTER_SpawnAtCoords113c(
              m,
              i32(m, (pSpawnScratch + 4) >>> 0),
              i32(m, pSpawnScratch),
              esiGame,
              pSpawnRoom,
              spawnX,
              spawnY,
              2,
              0x42,
              hooks?.regpop,
            ) >>> 0
          if (pSpawned !== 0) {
            m.setU32((ebxParam + 0x18) >>> 0, (i32(m, (ebxParam + 0x18) >>> 0) - 1) >>> 0)
            m.setU32(
              (pSpawned + 0xc4) >>> 0,
              (m.u32((pSpawned + 0xc4) >>> 0) | 0x4020000) >>> 0,
            )
            if (ediMon !== 0 && i32(m, (ediMon + 0x04) >>> 0) === 0x2c7) {
              STATES_ToggleGfxStateFlag113c(m, pSpawned, 0xb8, 1)
              STATES_SetMonsterSkillIconOnUnit113c(m, pSpawned, 0xca, 0)
            }
          }
        }
      } finally {
        freeStackFrame113c(16)
      }
    }
    const diff3 = m.u8((esiGame + 0x6d) >>> 0) & 0xff
    const delay3 = (m.u16((ebpStats + diff3 * 2 + 0x5c) >>> 0) << 16) >> 16
    AI_ScheduleAiThinkTimer_6FD120C0_113c(m, esiGame, ediMon, delay3)
    return
  }

  SKILLS_SetUsedSkillMemPort113c(m, ediMon, 0)
  MONSTER_StartMode113c(m, esiGame, ediMon, 0, 0, 0, 0)
}

/**
 * [30/45] Nest / egg-layer spawner AI think (`0x6FCA7A60`): stalls `25 * wAiParam[1]` frames when
 * `pAiParam + 0x1C !== 0`, starts mode `8` (`S1`) at own coordinates (`0x6FD11FF0`) when `pAiParam + 0x18 === 0`
 * and `spawnCount < wAiParam[0]`, or spawns a child monster via `UNITS_GetMonsterSplitSpawnParams113c` +
 * `MONSTER_SpawnAtCoords113c` using callback `0x6FC40C60` (`AIGENERAL_GetField3C_113c`).
 *
 * @va D2Game:0x6FCA7A60
 */
export function AI_ThinkMonsterSpawnerNest_6FCA7A60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  pAiTickArgs: number,
  hooks?: K2W4B4Hooks113c,
): void {
  hitD2GameVa113c(0x6FCA7A60)
  const ediGame = pGame >>> 0
  const ebpMon = pMonster >>> 0
  const args = pAiTickArgs >>> 0
  const esiParam = m.u32(args) >>> 0
  const ebxStats = m.u32((args + 0x1c) >>> 0) >>> 0

  if (i32(m, (esiParam + 0x1c) >>> 0) !== 0) {
    const diff0 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
    const delay0 = (m.u16((ebxStats + diff0 * 2 + 0x5c) >>> 0) << 16) >> 16
    AI_Stall113c(m, ediGame, ebpMon, imul32(delay0, 25))
    m.setU32((esiParam + 0x1c) >>> 0, 0)
    return
  }

  if (i32(m, (esiParam + 0x18) >>> 0) === 0) {
    const diff1 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
    const maxCount = (m.u16((ebxStats + diff1 * 2 + 0x56) >>> 0) << 16) >> 16
    if (i32(m, (esiParam + 0x14) >>> 0) < maxCount) {
      const posY = UNIT_GetPosY113c(m, ebpMon)
      const posX = UNIT_GetPosX113c(m, ebpMon)
      AI_StartModeAtCoordsStep1_6FD11FF0_113c(m, ebpMon, 8, ediGame, posX, posY, hooks?.w2b8)
      const diff2 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
      const delay2 = (m.u16((ebxStats + diff2 * 2 + 0x5c) >>> 0) << 16) >> 16
      AI_ScheduleAiThinkTimer_6FD120C0_113c(m, ediGame, ebpMon, delay2)
      m.setU32((esiParam + 0x18) >>> 0, 1)
    }
    return
  }

  const pSpawnScratch = allocStackFrame113c(16)
  try {
    m.setU32(pSpawnScratch, 0)
    m.setU32((pSpawnScratch + 4) >>> 0, 0)
    m.setU32((pSpawnScratch + 8) >>> 0, 0)
    m.setU32((pSpawnScratch + 12) >>> 0, 0)
    UNITS_GetMonsterSplitSpawnParams113c(
      m,
      ebpMon,
      (pSpawnScratch + 4) >>> 0,
      (pSpawnScratch + 8) >>> 0,
      (pSpawnScratch + 12) >>> 0,
      pSpawnScratch,
      0,
      AIGENERAL_GetField3C_113c,
    )
    const spawnX = i32(m, (pSpawnScratch + 8) >>> 0)
    const spawnY = i32(m, (pSpawnScratch + 12) >>> 0)
    const pRoom = UNITS_GetRoom113c(m, ebpMon) >>> 0
    const pSpawnRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom, spawnX, spawnY) >>> 0
    if (pSpawnRoom !== 0) {
      const pSpawned =
        MONSTER_SpawnAtCoords113c(
          m,
          i32(m, (pSpawnScratch + 4) >>> 0),
          i32(m, pSpawnScratch),
          ediGame,
          pSpawnRoom,
          spawnX,
          spawnY,
          2,
          0x42,
          hooks?.regpop,
        ) >>> 0
      if (pSpawned !== 0) {
        m.setU32((pSpawned + 0xc4) >>> 0, (m.u32((pSpawned + 0xc4) >>> 0) | 0x4000000) >>> 0)
        m.setU32((esiParam + 0x14) >>> 0, (i32(m, (esiParam + 0x14) >>> 0) + 1) >>> 0)
      }
    }
  } finally {
    freeStackFrame113c(16)
  }

  const diff3 = m.u8((ediGame + 0x6d) >>> 0) & 0xff
  const delay3 = (m.u16((ebxStats + diff3 * 2 + 0x5c) >>> 0) << 16) >> 16
  AI_ScheduleAiThinkTimer_6FD120C0_113c(m, ediGame, ebpMon, delay3)
  m.setU32((esiParam + 0x18) >>> 0, 0)
  m.setU32((esiParam + 0x1c) >>> 0, 1)
}


function fogInitBitBuffer113c(
  m: D2KernMemory113c,
  pBitStream: number,
  pBuffer: number,
  nBytes: number,
): void {
  const bs = pBitStream >>> 0
  m.setU32(bs, pBuffer >>> 0)
  m.setU32((bs + 0x04) >>> 0, ((nBytes | 0) << 3) >>> 0)
  m.setU32((bs + 0x08) >>> 0, 0)
  m.setU32((bs + 0x0c) >>> 0, 0)
  m.setU32((bs + 0x10) >>> 0, 0)
}

function fogGetBitBufferSize113c(m: D2KernMemory113c, pBitStream: number): number {
  const bs = pBitStream >>> 0
  const nPos = m.u32((bs + 0x08) >>> 0) | 0
  return m.u32((bs + 0x0c) >>> 0) !== 0 ? (nPos + 1) | 0 : nPos
}

function fogWriteBits113c(
  m: D2KernMemory113c,
  pBitStream: number,
  nValue: number,
  nBits: number,
): void {
  const esi = pBitStream >>> 0
  const ecx = m.u32((esi + 0x0c) >>> 0) | 0
  const edx = m.u32((esi + 0x08) >>> 0) | 0
  const eax = m.u32((esi + 0x04) >>> 0) | 0
  let ebp = nBits | 0
  const newBitTotal = (ecx + (edx << 3) + ebp) | 0
  if (newBitTotal > eax) {
    m.setU32((esi + 0x10) >>> 0, 1)
    m.setU32((esi + 0x08) >>> 0, (((eax + ((eax >> 31) & 7)) | 0) >> 3) >>> 0)
    m.setU32((esi + 0x0c) >>> 0, 0)
    return
  }
  if (ecx === 0) {
    m.setU8(m.u32(esi) >>> 0, 0)
  }
  if (ebp <= 0) return
  let ebx = nValue | 0
  while (ebp > 0) {
    const curBit = m.u32((esi + 0x0c) >>> 0) | 0
    let chunk = (8 - curBit) | 0
    if (chunk > ebp) chunk = ebp
    const mask = ((1 << chunk) - 1) & 0xff
    const edi = m.u32(esi) >>> 0
    const dl = ((ebx & mask) << (curBit & 31)) & 0xff
    m.setU8(edi, (m.u8(edi) | dl) & 0xff)
    const nextBit = (curBit + chunk) | 0
    m.setU32((esi + 0x0c) >>> 0, nextBit >>> 0)
    if (nextBit === 8) {
      const newBuf = (m.u32(esi) + 1) >>> 0
      const newPos = (m.u32((esi + 0x08) >>> 0) + 1) | 0
      const maxBits = m.u32((esi + 0x04) >>> 0) | 0
      m.setU32((esi + 0x08) >>> 0, newPos >>> 0)
      m.setU32(esi, newBuf)
      m.setU32((esi + 0x0c) >>> 0, 0)
      if ((newPos << 3) < maxBits) {
        m.setU8(newBuf, 0)
      }
    }
    ebp = (ebp - chunk) | 0
    ebx = ebx >> (chunk & 31)
  }
}

function stormStrCopy113c(m: D2KernMemory113c, dst: number, src: number, maxLen: number): number {
  const limit = maxLen | 0
  if (limit <= 0 || dst === 0) return 0
  let i = 0
  if (src !== 0) {
    for (; i < limit - 1; i++) {
      const ch = m.u8((src + i) >>> 0)
      if (ch === 0) break
      m.setU8((dst + i) >>> 0, ch)
    }
  }
  m.setU8((dst + i) >>> 0, 0)
  return i
}

/**
 * [31/45] Flushes `pClient`'s queued 9-byte ground-unit entries (`pClient + 0x1CC`, count at `+0x3BC`)
 * as a single `0x16` S2C batch packet into `pClient + 0x1B8`.
 *
 * @va D2Game:0x6FCAA2A0
 */
export function NET_FlushPacket16_GroundUnitBatch_6FCAA2A0_113c(
  m: D2KernMemory113c,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FCAA2A0)
  const edx = pClient >>> 0
  const eaxCount = i32(m, (edx + 0x3bc) >>> 0)
  if (eaxCount === 0) return

  const esiBuf = m.u32((edx + 0x1b8) >>> 0) >>> 0
  let ecxDst = (esiBuf + m.u32(esiBuf) + 4) >>> 0
  const ediTotal = (imul32(eaxCount, 9) + 0x0d) >>> 0

  m.setU8(ecxDst, 0x16)
  m.setU8((ecxDst + 3) >>> 0, eaxCount & 0xff)
  m.setU16((ecxDst + 1) >>> 0, ediTotal & 0xffff)
  ecxDst = (ecxDst + 4) >>> 0

  if (eaxCount > 0) {
    let src = (edx + 0x1cc) >>> 0
    for (let i = 0; i < eaxCount; i++) {
      m.setU32(ecxDst, m.u32(src))
      m.setU32((ecxDst + 4) >>> 0, m.u32((src + 4) >>> 0))
      m.setU8((ecxDst + 8) >>> 0, m.u8((src + 8) >>> 0))
      ecxDst = (ecxDst + 9) >>> 0
      src = (src + 9) >>> 0
    }
  }

  m.setU32(esiBuf, (m.u32(esiBuf) + (ediTotal & 0xffff)) >>> 0)
}

/**
 * [32/45] Builds 18-byte (`0x12`) packet `0x7D` (`[0]=0x7D`, `[1]=bOwnerType`, `[2..5]=dwOwnerGuid`,
 * `[6..9]=dwItemGuid`, `[10..13]=dwFlags`, `[14..17]=dwMask`) and queues it via `0x6FCAA3E0`.
 *
 * @va D2Game:0x6FCAADE0
 */
export function NET_SendPacket7D_SetItemFlags_6FCAADE0_113c(
  m: D2KernMemory113c,
  pOwnerUnit: number,
  pItemUnit: number,
  pClient: number,
  dwFlags: number,
  dwMask: number,
): number {
  hitD2GameVa113c(0x6FCAADE0)
  const eaxOwner = pOwnerUnit >>> 0
  const edxItem = pItemUnit >>> 0
  const pPkt = allocStackFrame113c(0x14)
  try {
    m.setU32(pPkt, 0)
    m.setU32((pPkt + 0x04) >>> 0, 0)
    m.setU32((pPkt + 0x08) >>> 0, 0)
    m.setU32((pPkt + 0x0c) >>> 0, 0)
    m.setU16((pPkt + 0x10) >>> 0, 0)

    m.setU8(pPkt, 0x7d)
    const ownerType = eaxOwner !== 0 ? m.u32(eaxOwner) & 0xff : 6
    m.setU8((pPkt + 0x01) >>> 0, ownerType)
    const ownerGuid = eaxOwner !== 0 ? m.u32((eaxOwner + 0x0c) >>> 0) >>> 0 : 0xffffffff
    m.setU32((pPkt + 0x02) >>> 0, ownerGuid)
    const itemGuid = edxItem !== 0 ? m.u32((edxItem + 0x0c) >>> 0) >>> 0 : 0xffffffff
    m.setU32((pPkt + 0x06) >>> 0, itemGuid)
    m.setU32((pPkt + 0x0a) >>> 0, dwFlags >>> 0)
    m.setU32((pPkt + 0x0e) >>> 0, dwMask >>> 0)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x12) | 0
  } finally {
    freeStackFrame113c(0x14)
  }
}

/**
 * [33/45] Serializes owned item `pItemUnit` into an S2C `0x9D` packet (`<= 0xFC` bytes) with temporary
 * command flags `dwCmdFlags`, queues it to `pClient` (`0x6FCAA3E0`), and syncs socketed sub-items (`0x6FCAC890`).
 *
 * @va D2Game:0x6FCAB0F0
 */
export function NET_SendPacket9D_ItemActionOwned_6FCAB0F0_113c(
  m: D2KernMemory113c,
  bAction: number,
  pOwnerUnit: number,
  pItemUnit: number,
  pClient: number,
  dwCmdFlags: number,
  bGamble: number,
): number {
  hitD2GameVa113c(0x6FCAB0F0)
  const ediOwner = pOwnerUnit >>> 0
  const esiItem = pItemUnit >>> 0
  const ebpCmdFlags = dwCmdFlags >>> 0
  const pPkt = allocStackFrame113c(0x104)
  try {
    m.setU8(pPkt, 0x9d)
    m.setU8((pPkt + 0x01) >>> 0, bAction & 0xff)
    const equipLoc = INVENTORY_GetItemEquipLocation113c(m, ediOwner, esiItem) & 0xff
    m.setU8((pPkt + 0x03) >>> 0, equipLoc)
    const itemGuid = esiItem !== 0 ? m.u32((esiItem + 0x0c) >>> 0) >>> 0 : 0xffffffff
    m.setU32((pPkt + 0x04) >>> 0, itemGuid)
    const ownerType = ediOwner !== 0 ? m.u32(ediOwner) & 0xff : 6
    m.setU8((pPkt + 0x08) >>> 0, ownerType)
    const ownerGuid = ediOwner !== 0 ? m.u32((ediOwner + 0x0c) >>> 0) >>> 0 : 0xffffffff
    m.setU32((pPkt + 0x09) >>> 0, ownerGuid)

    const savedFlags = ITEMS_GetCommandFlags113c(m, esiItem) >>> 0
    ITEMS_SetOrClearCommandFlags113c(m, esiItem, ebpCmdFlags, 1)
    const nSerialized =
      ITEMS_SerializeItemToBuffer113c(
        m,
        esiItem,
        (pPkt + 0x0d) >>> 0,
        0xf4,
        0,
        0,
        bGamble | 0,
      ) | 0
    const ebxLen = (nSerialized + 0x0d) >>> 0
    if (ebxLen > 0xfc) {
      throw new D2CommonAssertError('SUnitNet.cpp', 0x7b4)
    }
    ITEMS_SetOrClearCommandFlags113c(m, esiItem, 0xffffffff, 0)
    ITEMS_SetOrClearCommandFlags113c(m, esiItem, savedFlags, 1)

    const pktByteLen = ebxLen & 0xff
    m.setU8((pPkt + 0x02) >>> 0, pktByteLen)
    NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, pktByteLen)
    return ITEMS_SyncSocketedSubItemsToClient113c(m, pClient >>> 0, esiItem, ebpCmdFlags) | 0
  } finally {
    freeStackFrame113c(0x104)
  }
}

/**
 * [34/45] Serializes a variable-length chat/overhead message struct (`pChatMsg`) with 10-byte header,
 * null-terminated speaker name (`+0x0A`, max `0x10`), and null-terminated message text (`+0x1A`, `< 0x100`),
 * and queues it to `pClient` (`0x6FCAA3E0`).
 *
 * @va D2Game:0x6FCAB470
 */
export function NET_SendPacket26_ChatMessage_6FCAB470_113c(
  m: D2KernMemory113c,
  pChatMsg: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAB470)
  const eaxMsg = pChatMsg >>> 0
  const ediText = (eaxMsg + 0x1a) >>> 0
  let textLen = 0
  while (m.u8((ediText + textLen) >>> 0) !== 0) {
    textLen++
  }
  if (textLen >>> 0 >= 0x100) {
    throw new D2CommonAssertError('SUnitNet.cpp', 0x5ba)
  }
  if (m.u8((eaxMsg + 0x119) >>> 0) !== 0) {
    m.setU8((eaxMsg + 0x119) >>> 0, 0)
  }

  const pPkt = allocStackFrame113c(0x120)
  try {
    m.setU8(pPkt, m.u8(eaxMsg))
    m.setU8((pPkt + 0x01) >>> 0, m.u8((eaxMsg + 0x01) >>> 0))
    m.setU8((pPkt + 0x02) >>> 0, m.u8((eaxMsg + 0x02) >>> 0))
    m.setU8((pPkt + 0x03) >>> 0, m.u8((eaxMsg + 0x03) >>> 0))
    m.setU32((pPkt + 0x04) >>> 0, m.u32((eaxMsg + 0x04) >>> 0))
    m.setU8((pPkt + 0x08) >>> 0, m.u8((eaxMsg + 0x08) >>> 0))
    m.setU8((pPkt + 0x09) >>> 0, m.u8((eaxMsg + 0x09) >>> 0))

    const nameLen = stormStrCopy113c(m, (pPkt + 0x0a) >>> 0, (eaxMsg + 0x0a) >>> 0, 0x10)
    const esiTextDst = (pPkt + 0x0b + nameLen) >>> 0
    const copiedTextLen = stormStrCopy113c(m, esiTextDst, ediText, 0x100)
    const totalLen = (copiedTextLen + (0x0b + nameLen) + 1) >>> 0
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, totalLen) | 0
  } finally {
    freeStackFrame113c(0x120)
  }
}

/**
 * [35/45] Bit-packs S2C packet `0x96` (`WalkVerify`: `8b` opcode `0x96`, `15b` stamina, `16b` X, `16b` Y,
 * `8b` dX, `8b` dY = 9 bytes) and queues it to `pClient` (`0x6FCAA3E0`).
 *
 * @va D2Game:0x6FCAB750
 */
export function NET_SendPacket96_WalkVerify_6FCAB750_113c(
  m: D2KernMemory113c,
  pClient: number,
  wStamina: number,
  wX: number,
  wY: number,
  bDx: number,
  bDy: number,
): number {
  hitD2GameVa113c(0x6FCAB750)
  const pScratch = allocStackFrame113c(0x20)
  try {
    const pPkt = pScratch
    const pBitStream = (pScratch + 0x0c) >>> 0
    fogInitBitBuffer113c(m, pBitStream, pPkt, 9)
    fogWriteBits113c(m, pBitStream, 0x96, 8)
    fogWriteBits113c(m, pBitStream, wStamina & 0xffff, 0x0f)
    fogWriteBits113c(m, pBitStream, wX & 0xffff, 0x10)
    fogWriteBits113c(m, pBitStream, wY & 0xffff, 0x10)
    fogWriteBits113c(m, pBitStream, bDx & 0xff, 8)
    fogWriteBits113c(m, pBitStream, bDy & 0xff, 8)
    const nBytes = fogGetBitBufferSize113c(m, pBitStream)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, nBytes) | 0
  } finally {
    freeStackFrame113c(0x20)
  }
}


/**
 * [36/45] Bit-packs S2C packet `0x95` (`LifeManaStamina`: `8b` opcode `0x95`, `15b` life, `15b` mana,
 * `15b` stamina, `16b` X, `16b` Y, `8b` dX, `8b` dY = 13 bytes) and queues it to `pClient` (`0x6FCAA3E0`).
 *
 * @va D2Game:0x6FCAB7F0
 */
export function NET_SendPacket95_LifeManaStamina_6FCAB7F0_113c(
  m: D2KernMemory113c,
  pClient: number,
  wLife: number,
  wMana: number,
  wStamina: number,
  wX: number,
  wY: number,
  bDx: number,
  bDy: number,
): number {
  hitD2GameVa113c(0x6FCAB7F0)
  const pScratch = allocStackFrame113c(0x28)
  try {
    const pPkt = pScratch
    const pBitStream = (pScratch + 0x10) >>> 0
    fogInitBitBuffer113c(m, pBitStream, pPkt, 0x0d)
    fogWriteBits113c(m, pBitStream, 0x95, 8)
    fogWriteBits113c(m, pBitStream, wLife & 0xffff, 0x0f)
    fogWriteBits113c(m, pBitStream, wMana & 0xffff, 0x0f)
    fogWriteBits113c(m, pBitStream, wStamina & 0xffff, 0x0f)
    fogWriteBits113c(m, pBitStream, wX & 0xffff, 0x10)
    fogWriteBits113c(m, pBitStream, wY & 0xffff, 0x10)
    fogWriteBits113c(m, pBitStream, bDx & 0xff, 8)
    fogWriteBits113c(m, pBitStream, bDy & 0xff, 8)
    const nBytes = fogGetBitBufferSize113c(m, pBitStream)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, nBytes) | 0
  } finally {
    freeStackFrame113c(0x28)
  }
}

/**
 * [37/45] Bit-packs S2C packet `0x18` (`HpManaPot`: `8b` opcode `0x18`, `15b` life, `15b` mana,
 * `15b` stamina, `7b` lifeRegen, `7b` manaRegen, `16b` X, `16b` Y, `8b` dX, `8b` dY = 15 bytes)
 * and queues it to `pClient` (`0x6FCAA3E0`).
 *
 * @va D2Game:0x6FCAB8C0
 */
export function NET_SendPacket18_HpManaPot_6FCAB8C0_113c(
  m: D2KernMemory113c,
  pClient: number,
  wLife: number,
  wMana: number,
  wStamina: number,
  bLifeRegen: number,
  bManaRegen: number,
  wX: number,
  wY: number,
  bDx: number,
  bDy: number,
): number {
  hitD2GameVa113c(0x6FCAB8C0)
  const pScratch = allocStackFrame113c(0x28)
  try {
    const pPkt = pScratch
    const pBitStream = (pScratch + 0x10) >>> 0
    fogInitBitBuffer113c(m, pBitStream, pPkt, 0x0f)
    fogWriteBits113c(m, pBitStream, 0x18, 8)
    fogWriteBits113c(m, pBitStream, wLife & 0xffff, 0x0f)
    fogWriteBits113c(m, pBitStream, wMana & 0xffff, 0x0f)
    fogWriteBits113c(m, pBitStream, wStamina & 0xffff, 0x0f)
    fogWriteBits113c(m, pBitStream, bLifeRegen & 0xff, 7)
    fogWriteBits113c(m, pBitStream, bManaRegen & 0xff, 7)
    fogWriteBits113c(m, pBitStream, wX & 0xffff, 0x10)
    fogWriteBits113c(m, pBitStream, wY & 0xffff, 0x10)
    fogWriteBits113c(m, pBitStream, bDx & 0xff, 8)
    fogWriteBits113c(m, pBitStream, bDy & 0xff, 8)
    const nBytes = fogGetBitBufferSize113c(m, pBitStream)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, nBytes) | 0
  } finally {
    freeStackFrame113c(0x28)
  }
}

/**
 * [38/45] Builds 24-byte (`0x18`) S2C packet `0xA3` (`[0]=0xA3`, `[1]=bUnitType`, `[2..3]=wSkillId`,
 * `[4..5]=wSkillLevel`, `[6]=bTargetType`, `[7..10]=dwUnitGuid`, `[11]=bByteB`, `[12..15]=dwTargetGuid`,
 * `[16..19]=nTargetX`, `[20..23]=nTargetY`) and queues it to `pClient` (`0x6FCAA3E0`).
 *
 * @va D2Game:0x6FCABA90
 */
export function NET_SendPacketA3_AuraTargetSkill_6FCABA90_113c(
  m: D2KernMemory113c,
  bUnitType: number,
  wSkillId: number,
  pClient: number,
  wSkillLevel: number,
  bTargetType: number,
  dwUnitGuid: number,
  bByteB: number,
  dwTargetGuid: number,
  nTargetX: number,
  nTargetY: number,
): number {
  hitD2GameVa113c(0x6FCABA90)
  const pPkt = allocStackFrame113c(0x18)
  try {
    for (let i = 0; i < 0x18; i += 4) {
      m.setU32((pPkt + i) >>> 0, 0)
    }
    m.setU8(pPkt, 0xa3)
    m.setU8((pPkt + 0x01) >>> 0, bUnitType & 0xff)
    m.setU16((pPkt + 0x02) >>> 0, wSkillId & 0xffff)
    m.setU16((pPkt + 0x04) >>> 0, wSkillLevel & 0xffff)
    m.setU8((pPkt + 0x06) >>> 0, bTargetType & 0xff)
    m.setU32((pPkt + 0x07) >>> 0, dwUnitGuid >>> 0)
    m.setU8((pPkt + 0x0b) >>> 0, bByteB & 0xff)
    m.setU32((pPkt + 0x0c) >>> 0, dwTargetGuid >>> 0)
    m.setU32((pPkt + 0x10) >>> 0, nTargetX >>> 0)
    m.setU32((pPkt + 0x14) >>> 0, nTargetY >>> 0)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x18) | 0
  } finally {
    freeStackFrame113c(0x18)
  }
}

/**
 * [39/45] Asserts `(wStatId & 0xFFFF) < 0xFF` (`0x42D`), computes `delta = (nNewVal - nBaseVal) >>> 0`,
 * and queues S2C packet `0xA1` (7B, `delta < 0xFF`), `0xA2` (8B, `delta < 0xFFFF`), or `0xA0` (10B, full `nBaseVal`)
 * for `pUnit` (`0x6FCAA3E0`).
 *
 * @va D2Game:0x6FCABB10
 */
export function NET_SendPacketA0A1A2_StatDelta_6FCABB10_113c(
  m: D2KernMemory113c,
  pClient: number,
  wStatId: number,
  nNewVal: number,
  nBaseVal: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCABB10)
  if ((wStatId & 0xffff) >= 0xff) {
    throw new D2CommonAssertError('SUnitNet.cpp', 0x42d)
  }
  const esiUnit = pUnit >>> 0
  const dwUnitGuid = esiUnit !== 0 ? m.u32((esiUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
  const delta = ((nNewVal | 0) - (nBaseVal | 0)) >>> 0
  const pPkt = allocStackFrame113c(0x0c)
  try {
    m.setU8((pPkt + 0x01) >>> 0, wStatId & 0xff)
    m.setU32((pPkt + 0x02) >>> 0, dwUnitGuid)
    if (delta < 0xff) {
      m.setU8(pPkt, 0xa1)
      m.setU8((pPkt + 0x06) >>> 0, delta & 0xff)
      return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 7) | 0
    }
    if (delta < 0xffff) {
      m.setU8(pPkt, 0xa2)
      m.setU16((pPkt + 0x06) >>> 0, delta & 0xffff)
      return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 8) | 0
    }
    m.setU8(pPkt, 0xa0)
    m.setU32((pPkt + 0x06) >>> 0, nBaseVal >>> 0)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x0a) | 0
  } finally {
    freeStackFrame113c(0x0c)
  }
}

/**
 * [40/45] Asserts `(wStatId & 0xFFFF) < 0xFF` (`0x3F5`) and queues S2C unit stat packet `0x9E` (7B, `< 0xFF`),
 * `0x9F` (8B, `< 0xFFFF`), or `0xA0` (10B, `>= 0xFFFF`) for `pUnit` (`0x6FCAA3E0`).
 *
 * @va D2Game:0x6FCABC20
 */
export function NET_SendPacket9E9FA0_StatValue_6FCABC20_113c(
  m: D2KernMemory113c,
  wStatId: number,
  pUnit: number,
  pClient: number,
  dwStatVal: number,
): number {
  hitD2GameVa113c(0x6FCABC20)
  if ((wStatId & 0xffff) >= 0xff) {
    throw new D2CommonAssertError('SUnitNet.cpp', 0x3f5)
  }
  const ecxUnit = pUnit >>> 0
  const dwUnitGuid = ecxUnit !== 0 ? m.u32((ecxUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
  const esiVal = dwStatVal >>> 0
  const pPkt = allocStackFrame113c(0x0c)
  try {
    m.setU8((pPkt + 0x01) >>> 0, wStatId & 0xff)
    m.setU32((pPkt + 0x02) >>> 0, dwUnitGuid)
    if (esiVal < 0xff) {
      m.setU8(pPkt, 0x9e)
      m.setU8((pPkt + 0x06) >>> 0, esiVal & 0xff)
      return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 7) | 0
    }
    if (esiVal < 0xffff) {
      m.setU8(pPkt, 0x9f)
      m.setU16((pPkt + 0x06) >>> 0, esiVal & 0xffff)
      return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 8) | 0
    }
    m.setU8(pPkt, 0xa0)
    m.setU32((pPkt + 0x06) >>> 0, esiVal)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x0a) | 0
  } finally {
    freeStackFrame113c(0x0c)
  }
}


/**
 * [41/45] Computes `delta = nNewGold - nOldGold`: queues 2-byte `0x19` packet when `0 < delta < 0xFF`,
 * or queues stat `14` (`0x0E`, `STAT_GOLD`) update packet `0x1D` (3B, `< 0xFF`), `0x1E` (4B, `< 0xFFFF`),
 * or `0x1F` (6B, `>= 0xFFFF`) via `0x6FCAA3E0`.
 *
 * @va D2Game:0x6FCABE10
 */
export function NET_SendPacket19_1D1E1F_GoldUpdate_6FCABE10_113c(
  m: D2KernMemory113c,
  pClient: number,
  nNewGold: number,
  nOldGold: number,
): number {
  hitD2GameVa113c(0x6FCABE10)
  const delta = ((nNewGold | 0) - (nOldGold | 0)) | 0
  const edxNew = nNewGold >>> 0
  const pPkt = allocStackFrame113c(8)
  try {
    if (delta > 0 && delta < 0xff) {
      m.setU8(pPkt, 0x19)
      m.setU8((pPkt + 0x01) >>> 0, delta & 0xff)
      return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 2) | 0
    }
    if (edxNew < 0xff) {
      m.setU8(pPkt, 0x1d)
      m.setU8((pPkt + 0x01) >>> 0, 0x0e)
      m.setU8((pPkt + 0x02) >>> 0, edxNew & 0xff)
      return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 3) | 0
    }
    if (edxNew < 0xffff) {
      m.setU8(pPkt, 0x1e)
      m.setU8((pPkt + 0x01) >>> 0, 0x0e)
      m.setU16((pPkt + 0x02) >>> 0, edxNew & 0xffff)
      return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 4) | 0
    }
    m.setU8(pPkt, 0x1f)
    m.setU8((pPkt + 0x01) >>> 0, 0x0e)
    m.setU32((pPkt + 0x02) >>> 0, edxNew)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 6) | 0
  } finally {
    freeStackFrame113c(8)
  }
}

/**
 * [42/45] Asserts `(bUnitType & 0xFF) < 6` (`0x136`), builds a 13-byte (`0x0D`) S2C unit coordinate event packet
 * (`[0]=bPacketId`, `[1]=bUnitType`, `[2..5]=dwUnitGuid`, `[6]=bByte6`, `[7..8]=wX`, `[9..10]=wY`,
 * `[11]=bByteB`, `[12]=bByteC`), and queues it to `pClient` (`0x6FCAA3E0`).
 *
 * @va D2Game:0x6FCAC280
 */
export function NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c(
  m: D2KernMemory113c,
  bUnitType: number,
  bPacketId: number,
  dwUnitGuid: number,
  pClient: number,
  bByte6: number,
  wX: number,
  wY: number,
  bByteB: number,
  bByteC: number,
): number {
  hitD2GameVa113c(0x6FCAC280)
  if ((bUnitType & 0xff) >= 6) {
    throw new D2CommonAssertError('SUnitNet.cpp', 0x136)
  }
  const pPkt = allocStackFrame113c(0x10)
  try {
    m.setU8(pPkt, bPacketId & 0xff)
    m.setU8((pPkt + 0x01) >>> 0, bUnitType & 0xff)
    m.setU32((pPkt + 0x02) >>> 0, dwUnitGuid >>> 0)
    m.setU8((pPkt + 0x06) >>> 0, bByte6 & 0xff)
    m.setU16((pPkt + 0x07) >>> 0, wX & 0xffff)
    m.setU16((pPkt + 0x09) >>> 0, wY & 0xffff)
    m.setU8((pPkt + 0x0b) >>> 0, bByteB & 0xff)
    m.setU8((pPkt + 0x0c) >>> 0, bByteC & 0xff)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x0d) | 0
  } finally {
    freeStackFrame113c(0x10)
  }
}

/**
 * [43/45] Asserts `pGame->pArenaCtrl (+0x1D28) !== 0` (`0x139`), builds an 8-byte game handshake/arena
 * info packet (`[0]=bPacketId`, `[1]=bDifficulty`, `[2..5]=dwArenaFlags`, `[6]=(pGame->dwGameType !== 0)`,
 * `[7]=(pGame->bExpansion !== 0)`), and queues it to `pClient` (`0x6FCAA3E0`).
 *
 * @va D2Game:0x6FCAC420
 */
export function NET_SendPacket8B_GameHandshake_6FCAC420_113c(
  m: D2KernMemory113c,
  pGame: number,
  bPacketId: number,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FCAC420)
  const eaxGame = pGame >>> 0
  const pArenaCtrl = m.u32((eaxGame + 0x1d28) >>> 0) >>> 0
  if (pArenaCtrl === 0) {
    throw new D2CommonAssertError('SUnitNet.cpp', 0x139)
  }
  const pPkt = allocStackFrame113c(8)
  try {
    m.setU8(pPkt, bPacketId & 0xff)
    m.setU8((pPkt + 0x01) >>> 0, m.u8((eaxGame + 0x6d) >>> 0))
    m.setU32((pPkt + 0x02) >>> 0, m.u32((pArenaCtrl + 0x08) >>> 0))
    m.setU8((pPkt + 0x06) >>> 0, m.u32((eaxGame + 0x70) >>> 0) !== 0 ? 1 : 0)
    m.setU8((pPkt + 0x07) >>> 0, m.u32((eaxGame + 0x74) >>> 0) !== 0 ? 1 : 0)
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 8) | 0
  } finally {
    freeStackFrame113c(8)
  }
}

/**
 * [44/45] Checks whether `pPlayerUnit` and `pTargetPlayerUnit` share a valid party (`!= 0xFFFF`, `0x6FCBBEB0`),
 * finds or allocates a 20-byte party stat-tracking node on `pPlayerData + 0x98`, and returns `1` when
 * `dwKey (+0x08)` changed or `NET_ShouldSyncTrackedStatDelta_6FCAA330_113c` triggers (`0` otherwise).
 *
 * @va D2Game:0x6FCAC910
 */
export function NET_CheckPartyMemberStatSyncDelta_6FCAC910_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  pTargetPlayerUnit: number,
  nNewVal: number,
  dwKey: number,
): number {
  hitD2GameVa113c(0x6FCAC910)
  const esiPlayer = pPlayerUnit >>> 0
  const ebpTarget = pTargetPlayerUnit >>> 0
  if (esiPlayer === 0) {
    throw new D2CommonAssertError('SUnitNet.cpp', 0xa2a)
  }
  const ediGame = m.u32((esiPlayer + 0x80) >>> 0) >>> 0
  if (ediGame === 0) {
    return 0
  }
  const partyId1 = D2GAME_PARTY_GetPartyIdForUnit113c(m, esiPlayer, ediGame) & 0xffff
  if (partyId1 === 0xffff) {
    return 0
  }
  const partyId2 = D2GAME_PARTY_GetPartyIdForUnit113c(m, ebpTarget, ediGame) & 0xffff
  if (partyId1 !== partyId2) {
    return 0
  }
  const esiPlayerData = UNITS_GetPlayerData113c(m, esiPlayer) >>> 0
  if (esiPlayerData === 0) {
    return 0
  }

  const ebxTargetGuid = ebpTarget !== 0 ? m.u32((ebpTarget + 0x0c) >>> 0) >>> 0 : 0xffffffff
  let pNode = m.u32((esiPlayerData + 0x98) >>> 0) >>> 0
  while (pNode !== 0) {
    if (m.u32(pNode) === ebxTargetGuid) {
      break
    }
    pNode = m.u32((pNode + 0x10) >>> 0) >>> 0
  }

  if (pNode === 0) {
    m.u32((ediGame + 0x1c) >>> 0)
    pNode = m.alloc(0x14) >>> 0
    if (pNode === 0) {
      return 0
    }
    m.setU32(pNode, 0)
    m.setU32((pNode + 0x04) >>> 0, 0)
    m.setU32((pNode + 0x08) >>> 0, 0)
    m.setU32((pNode + 0x0c) >>> 0, 0)
    m.setU32((pNode + 0x10) >>> 0, m.u32((esiPlayerData + 0x98) >>> 0))
    m.setU32((esiPlayerData + 0x98) >>> 0, pNode)
    m.setU32(pNode, ebxTargetGuid)
  }

  if (m.u32((pNode + 0x08) >>> 0) !== (dwKey >>> 0)) {
    m.setU32((pNode + 0x04) >>> 0, nNewVal >>> 0)
    m.setU32((pNode + 0x08) >>> 0, dwKey >>> 0)
    return 1
  }

  return NET_ShouldSyncTrackedStatDelta_6FCAA330_113c(m, pNode, nNewVal) | 0
}

/**
 * [45/45] Builds 7-byte S2C packet `0x8D` (`[0]=0x8D`, `[1..4]=dwPlayerGuid`, `[5..6]=wPartyId`)
 * for `pPlayerUnit` and broadcasts it to all living players in `pGame` via `0x6FCFFC10` + `0x6FCAC5F0`.
 *
 * @va D2Game:0x6FCACFB0
 */
export function PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCACFB0)
  const eaxPlayer = pPlayerUnit >>> 0
  const ediGame = pGame >>> 0
  const pPkt = allocStackFrame113c(8)
  try {
    m.setU8(pPkt, 0x8d)
    const dwGuid = eaxPlayer !== 0 ? m.u32((eaxPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff
    m.setU32((pPkt + 0x01) >>> 0, dwGuid)

    let wPartyId = 0xffff
    if (
      eaxPlayer !== 0 &&
      m.u32((eaxPlayer + 0x80) >>> 0) !== 0 &&
      (m.u32(eaxPlayer) | 0) === 0
    ) {
      wPartyId =
        D2GAME_PARTY_GetPartyIdForUnit113c(m, eaxPlayer, m.u32((eaxPlayer + 0x80) >>> 0) >>> 0) &
        0xffff
    }
    m.setU16((pPkt + 0x05) >>> 0, wPartyId)

    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      m,
      ediGame,
      (mem, _game, pLivingPlayer, pCtx) => {
        S2C_Send7BytePacketToPlayerUnit_6FCAC5F0_113c(mem, pLivingPlayer, pCtx)
      },
      pPkt,
    )
  } finally {
    freeStackFrame113c(8)
  }
}
