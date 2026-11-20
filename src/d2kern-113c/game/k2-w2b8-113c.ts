/**
 * Diablo II v1.13c `D2Game.dll` Core & Combat Pipeline (`[K2]` Wave 2 Batch 8 `w2b8`):
 * 45 `PACKET`, `ITEMS`, `SUNITDMG`, `SUNIT`, `ACT3Q2..Q6`, `MONSTER`, `PLAYERLIST`, and `AI`
 * functions (`0x6FCEB590 .. 0x6FD13CB0`, image base `0x6FC20000`, total `2,813B`).
 *
 * Every exported function is a 1:1 instruction-faithful `Memory113c` translation of the
 * `D2Game.dll` v1.13c x86 machine code, with zero array ordering helpers, zero nullish
 * coalescing, zero Node/DOM globals, and zero cross-layer imports.
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DRLG_ResolveMonsterSubClassIdForRoom113c } from '../common/drlg/drlg-ver.ts'
import { DUNGEON_GetLevelIdIfNotHidden113c } from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import {
  INVENTORY_AppendItemGuidNode113c,
  INVENTORY_UpdateWeaponGuidOnInsert113c,
} from '../common/inventory.ts'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_CanUseCharmInInventory113c,
  ITEMS_GetBaseCode113c,
  ITEMS_GetBodyLocation113c,
  ITEMS_SetItemFlag113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items.ts'
import {
  INVENTORY_GetCompositWeaponMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
} from '../common/k0-d2common-memports.ts'
import { PATH_GetTargetUnit113c, PATH_SetStepNum113c } from '../common/path.ts'
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record.ts'
import {
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetSkillUseFailReason113c,
} from '../common/skills.ts'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_ExpireTimedSubLists113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  UNITS_GetAnimOrSeqMode113c,
  UNITS_GetRoom113c,
  UNITS_SetUnitUpdateFlags113c,
} from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  MONSTER_InitModeChangeStrc113c,
  SUNITDMG_FreeAttackerCombatList113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c.ts'
import { D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c } from './boot-init-gap-b-113c.ts'
import {
  AI_IdleWander113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
} from './combat-a1c-113c.ts'
import { ITEMS_ActivateEquippedItemStats113c } from './k2-gap-itemdef-113c.ts'
import {
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c,
  QUESTS_SendQuestItemState2_5D_113c,
  QUESTS_SendQuestStateAlert5D_113c,
} from './k2-items-tc-w1-113c.ts'
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c.ts'
import { UNITS_ChangeAnimMode113c } from './monster-events.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_GetRecordPtr113c,
  MONSTER_Create113c,
  MONSTER_SpawnPartyMinionInRing113c,
  SUNIT_ValidatePathTargetUnit113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.ts'
import {
  EVENT_DeleteEventByType113c,
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
} from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/** `D2Game.dll` `.rdata` `0x6FD1B9A4`: `..\Source\D2Game\UNIT\PlayerList.cpp` source string VA. */
export const D2GAME_PLAYERLIST_CPP_STR_VA_113C = 0x6fd1b9a4

/** `D2Game.dll` `.rdata` `0x6FD18D10`: `KERNEL32.dll!GetTickCount` IAT slot VA. */
export const D2GAME_IAT_GET_TICK_COUNT_VA_113C = 0x6fd18d10

/** Isolated reentrant scratch stack pointer for `w2b8` stack structs (`D2MonSpawnArgsStrc`, `D2ModeChangeStrc`). */
let k2W2B8StackPtr = 0x7ea80000

/** Optional host/callee hooks for `w2b8` functions. */
export interface K2W2B8Hooks113c extends RegpopSpawnHooks113c {
  readonly freePoolMemory?: (
    m: Memory113c,
    pMemPool: number,
    pMem: number,
    szFile: number,
    nLine: number,
    nUnused: number,
  ) => void
  readonly getTickCount?: (m: Memory113c) => number
  readonly onMonsterStartMode?: (
    m: Memory113c,
    pGame: number,
    pModeArgs: number,
    bUpdateAnim: number,
  ) => number
}

function stepSeed64At113c(m: Memory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 4) >>> 0, newHi)
  m.setU32(pSeed >>> 0, newLo)
  return newLo
}

function dispatchMonsterStartMode6FC95E10(
  m: Memory113c,
  pGame: number,
  pModeArgs: number,
  bUpdateAnim: number,
  hooks?: K2W2B8Hooks113c,
): number {
  if (hooks !== undefined && hooks.onMonsterStartMode !== undefined) {
    return hooks.onMonsterStartMode(m, pGame >>> 0, pModeArgs >>> 0, bUpdateAnim | 0) | 0
  }
  const mode = m.u32(pModeArgs >>> 0) | 0
  const pUnit = m.u32((pModeArgs + 0x04) >>> 0) >>> 0
  const pTarget = m.u32((pModeArgs + 0x08) >>> 0) >>> 0
  const targetX = m.u32((pModeArgs + 0x0c) >>> 0) | 0
  const targetY = m.u32((pModeArgs + 0x10) >>> 0) | 0
  return MONSTER_StartMode113c(m, pGame >>> 0, pUnit, mode, pTarget, targetX, targetY) | 0
}

/**
 * Exact 1.13c `D2Game.dll` `0x6FD12540` (`AI_ApproachTarget`, `ecx = pGame`, `edx = pUnit`,
 * `[esp+4] = pTarget`, `[esp+8] = nMode`, `[esp+12] = nX`, `[esp+16] = nY`, `[esp+20] = nStepNum`, `[esp+24] = dwFlags`)
 * invoked by `0x6FD12F00`, `0x6FD12F30`, and `0x6FD13000`.
 */
function aiApproachTarget6FD12540(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pTarget: number,
  nMode: number,
  nX: number,
  nY: number,
  nStepNum: number,
  dwFlags: number,
  hooks?: K2W2B8Hooks113c,
): number {
  let mode = nMode | 0
  if (mode === 0x0f && (STATES_CheckState113c(m, pUnit >>> 0, 0x3c) | 0) !== 0) {
    let pAiControl = 0
    if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        pAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
      }
    }
    m.setU32((pAiControl + 0x18) >>> 0, 0)
    m.setU32((pAiControl + 0x1c) >>> 0, 0)
    m.setU8((pAiControl + 0x20) >>> 0, 0)
    mode = 2
  }

  PATH_SetStepNum113c(m, m.u32((pUnit + 0x2c) >>> 0), nStepNum | 0)

  const sp = (k2W2B8StackPtr - 0x20) >>> 0
  k2W2B8StackPtr = sp
  try {
    MONSTER_InitModeChangeStrc113c(m, pUnit >>> 0, sp, mode)
    if (pTarget !== 0) {
      m.setU32((sp + 0x08) >>> 0, pTarget >>> 0)
    } else {
      m.setU32((sp + 0x0c) >>> 0, nX >>> 0)
      m.setU32((sp + 0x10) >>> 0, nY >>> 0)
    }

    const res = dispatchMonsterStartMode6FC95E10(m, pGame >>> 0, sp, 1, hooks) | 0
    if (res !== 0) {
      return res
    }

    const flagsByte = dwFlags & 0xff
    if ((flagsByte & 4) !== 0) {
      let pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
      while (pEvent !== 0) {
        const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
        if (m.u8(pEvent) === 2) {
          EVENT_FreeNode113c(m, pGame >>> 0, pEvent)
        }
        pEvent = pNext
      }
    }

    if ((flagsByte & 1) !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
        if (pAiGeneral !== 0) {
          m.setU8((pAiGeneral + 8) >>> 0, (m.u8((pAiGeneral + 8) >>> 0) | 0x40) & 0xff)
        }
      }
    }

    if ((flagsByte & 2) !== 0) {
      const roll = (stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100
      if (roll < 0x46) {
        AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 4)
        return 1
      }
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 10)
      return 1
    }

    return res
  } finally {
    k2W2B8StackPtr = (sp + 0x20) >>> 0
  }
}

/**
 * C2S packet `0x12` handler (`edx = pPlayer`, `[esp+4] = pPacket`, `[esp+8] = nPacketLen`):
 * Validates `nPacketLen === 1`, clears GFX state flag `0x0C` (`STATE_INVIS`) on `pPlayer`
 * via `D2Common.#10945` (`STATES_ToggleGfxStateFlag113c(pPlayer, 12, 0)`), and returns `0` (or `3` on bad length).
 *
 * @va D2Game.dll@0x6fceb590 (30B)
 */
export function PACKET_Recv12_ClearGfxState0C_6FCEB590_113c(
  m: Memory113c,
  pPlayer: number,
  _pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEB590)
  if ((nPacketLen | 0) !== 1) {
    return 3
  }
  STATES_ToggleGfxStateFlag113c(m, pPlayer >>> 0, 0x0c, 0)
  return 0
}

/**
 * C2S packet `0x3F` handler (`edx = pPlayer`, `[esp+4] = pPacket`, `[esp+8] = nPacketLen`):
 * Validates `nPacketLen === 3` and voice phrase ID `u16(pPacket + 1)` in `[0x19, 0x20]`,
 * returns `1` if `pPlayer` has `(dwFlags >> 10) & 1` set, otherwise broadcasts event sound
 * via `SUNIT_SetUnitEventSound113c(pPlayer, wPhraseId, 0)` and returns `0`.
 *
 * @va D2Game.dll@0x6fcebd50 (78B)
 */
export function PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c(
  m: Memory113c,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEBD50)
  if ((nPacketLen | 0) !== 3) {
    return 3
  }
  const wPhraseId = m.u16((pPacket + 1) >>> 0)
  if ((wPhraseId | 0) < 0x19 || (wPhraseId | 0) > 0x20) {
    return 0
  }
  if (pPlayer !== 0 && ((m.u32((pPlayer + 0xc4) >>> 0) >>> 10) & 1) !== 0) {
    return 1
  }
  SUNIT_SetUnitEventSound113c(m, pPlayer >>> 0, wPhraseId, 0)
  return 0
}

/**
 * Places `pItem` (`esi`) into `pUnit` (`edi`) inventory in cursor/socket anim mode `4`,
 * setting `ITEMFLAG_IN_SOCKET` (`0x100000`), appending the item GUID node to `pUnit->pInventory` (`+0x60`),
 * and marking `pUnit` update flags (`1`).
 *
 * @va D2Game.dll@0x6fcf1650 (91B)
 */
export function ITEMS_PlaceItemInSocketInventory_6FCF1650_113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FCF1650)
  if (pUnit === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x19a1)
  }
  if (pItem === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x19a2)
  }
  UNITS_ChangeAnimMode113c(m, pItem >>> 0, 4)
  ITEMS_SetItemFlag113c(m, pItem >>> 0, 0x100000, 1)
  INVENTORY_AppendItemGuidNode113c(m, m.u32((pUnit + 0x60) >>> 0), pItem >>> 0)
  UNITS_SetUnitUpdateFlags113c(m, pUnit >>> 0, 1)
  return 1
}

/**
 * Item timer event callback (`unitTimerTypeHandlers[12]`, `ecx = pGame`, `edx = pItem`):
 * Expires timed stat sublists on `pItem` at `pGame->dwGameFrame` (`+0xA8`).
 *
 * @va D2Game.dll@0x6fcf1780 (14B)
 */
export function ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
): void {
  hitD2GameVa113c(0x6FCF1780)
  STATLIST_ExpireTimedSubLists113c(m, pItem >>> 0, m.u32((pGame + 0xa8) >>> 0))
}

/**
 * Checks whether `SKILLS_GetSkillUseFailReason113c(pUnit, pSkill)` returns neither `2` nor `7`.
 *
 * @va D2Game.dll@0x6fcf1a30 (26B)
 */
export function ITEMS_CheckSkillUseNotBlocked2Or7_6FCF1A30_113c(
  m: Memory113c,
  pUnit: number,
  pSkill: number,
): number {
  hitD2GameVa113c(0x6FCF1A30)
  const reason = SKILLS_GetSkillUseFailReason113c(m, pUnit >>> 0, pSkill >>> 0) | 0
  if (reason === 2 || reason === 7) {
    return 0
  }
  return 1
}

/**
 * Resolves the primary composite weapon (`*pOutPrimaryWeapon`) and secondary weapon (`*pOutSecondaryWeapon`)
 * from `pUnit->pInventory` (`+0x60`), clearing `*pOutSecondaryWeapon` if it is not of item type `0x2D` (`ITEMTYPE_ANY_WEAPON`).
 *
 * @va D2Game.dll@0x6fcf1a50 (80B)
 */
export function ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c(
  m: Memory113c,
  pUnit: number,
  pOutPrimaryWeapon: number,
  pOutSecondaryWeapon: number,
): void {
  hitD2GameVa113c(0x6FCF1A50)
  m.setU32(pOutSecondaryWeapon >>> 0, 0)
  m.setU32(pOutPrimaryWeapon >>> 0, 0)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) {
    return
  }
  const pComposite = INVENTORY_GetCompositWeaponMemPort113c(m, pInventory) >>> 0
  m.setU32(pOutPrimaryWeapon >>> 0, pComposite)
  const pRightArm = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, 4) >>> 0
  const pLeftArm = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, 5) >>> 0
  if ((m.u32(pOutPrimaryWeapon >>> 0) >>> 0) === pRightArm) {
    m.setU32(pOutSecondaryWeapon >>> 0, pLeftArm)
  } else {
    m.setU32(pOutSecondaryWeapon >>> 0, pRightArm)
  }
  const pSecondary = m.u32(pOutSecondaryWeapon >>> 0) >>> 0
  if (pSecondary === 0) {
    return
  }
  if ((ITEMS_CheckItemTypeIdMemPort113c(m, pSecondary, 0x2d) | 0) === 0) {
    m.setU32(pOutSecondaryWeapon >>> 0, 0)
  }
}

/**
 * Updates weapon GUID tracking and activates equipped or usable-charm stats on `pUnit` when `pItem`
 * is inserted outside alternate weapon swap slots (`0x0B`, `0x0C`).
 *
 * @va D2Game.dll@0x6fcf4ff0 (80B)
 */
export function ITEMS_OnInsertOrEquipUpdateStats_6FCF4FF0_113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
  _pGame = 0,
): void {
  hitD2GameVa113c(0x6FCF4FF0)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) {
    return
  }
  const bodyLoc = ITEMS_GetBodyLocation113c(m, pItem >>> 0) & 0xff
  if (bodyLoc === 0x0b || bodyLoc === 0x0c) {
    return
  }
  INVENTORY_UpdateWeaponGuidOnInsert113c(m, pInventory, pItem >>> 0)
  if ((UNITS_GetAnimOrSeqMode113c(m, pItem >>> 0) | 0) === 1) {
    ITEMS_ActivateEquippedItemStats113c(m, pUnit >>> 0, pItem >>> 0, 1)
    return
  }
  if ((UNITS_GetAnimOrSeqMode113c(m, pItem >>> 0) | 0) !== 0) {
    return
  }
  if ((ITEMS_CanUseCharmInInventory113c(m, pItem >>> 0, pUnit >>> 0) | 0) === 0) {
    return
  }
  ITEMS_ActivateEquippedItemStats113c(m, pUnit >>> 0, pItem >>> 0, 1)
}

/**
 * Sets item command flag `0x10` on `pItem` and, if `pItem` is in inventory mode (`eItemMode === 0`)
 * and is a usable charm for `pUnit`, activates its stats and refreshes all inventory/equipment stats on `pUnit`.
 *
 * @va D2Game.dll@0x6fcf6710 (71B)
 */
export function ITEMS_OnCharmPlacedInInventory_6FCF6710_113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCF6710)
  ITEMS_SetOrClearCommandFlags113c(m, pItem >>> 0, 0x10, 1)
  if (pItem !== 0 && (m.u32((pItem + 0x10) >>> 0) | 0) !== 0) {
    return
  }
  if ((ITEMS_CanUseCharmInInventory113c(m, pItem >>> 0, pUnit >>> 0) | 0) === 0) {
    return
  }
  ITEMS_ActivateEquippedItemStats113c(m, pUnit >>> 0, pItem >>> 0, 0)
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame >>> 0, pUnit >>> 0, 0)
  UNITS_SetUnitUpdateFlags113c(m, pUnit >>> 0, 1)
}

/**
 * Adds positive `nManaGain` (`[esp+4]`) to `pUnit`'s `STAT_MANA` (`8`) clamped to `STATLIST_GetMaxManaFromUnit113c`,
 * returning the actual mana added.
 *
 * @va D2Game.dll@0x6fcfae70 (83B)
 */
export function SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c(
  m: Memory113c,
  pUnit: number,
  nManaGain: number,
): number {
  hitD2GameVa113c(0x6FCFAE70)
  const gain = nManaGain | 0
  if (gain <= 0) {
    return 0
  }
  const maxMana = STATLIST_GetMaxManaFromUnit113c(m, pUnit >>> 0) | 0
  const curMana = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 8, 0) | 0
  let newMana = (gain + curMana) | 0
  if (newMana >= maxMana) {
    newMana = maxMana
  }
  STATLIST_SetUnitStat113c(m, pUnit >>> 0, 8, newMana, 0)
  if (newMana === maxMana) {
    return (maxMana - curMana) | 0
  }
  return gain
}

/**
 * Frees `pUnit`'s combat list via `SUNITDMG_FreeAttackerCombatList113c` and transitions `pUnit`
 * to animation mode `nMode` via `UNITS_ChangeAnimMode113c`.
 *
 * @va D2Game.dll@0x6fcff980 (24B)
 */
export function SUNIT_FreeCombatListAndChangeAnimMode_6FCFF980_113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nMode: number,
): number {
  hitD2GameVa113c(0x6FCFF980)
  SUNITDMG_FreeAttackerCombatList113c(m, pUnit >>> 0, pGame >>> 0)
  return UNITS_ChangeAnimMode113c(m, pUnit >>> 0, nMode | 0) | 0
}

/**
 * Records `dwInteractUnitId` (`+0x64`), `nInteractUnitType` (`+0x68`), and `bInteracting = 1` (`+0x6C`) on `pUnit`
 * if `pUnit->bInteracting` (`+0x6C`) is currently `0`.
 *
 * @va D2Game.dll@0x6fcffae0 (74B)
 */
export function SUNIT_SetLastKillerInfo_6FCFFAE0_113c(
  m: Memory113c,
  pUnit: number,
  nInteractUnitType: number,
  dwInteractUnitId: number,
): void {
  hitD2GameVa113c(0x6FCFFAE0)
  const bInteracting = m.u8((pUnit + 0x6c) >>> 0)
  if (bInteracting !== 0) {
    if ((m.u32(pUnit >>> 0) | 0) === 0) {
      UNITS_GetPlayerData113c(m, pUnit >>> 0)
    }
    return
  }
  m.setU32((pUnit + 0x64) >>> 0, dwInteractUnitId >>> 0)
  m.setU32((pUnit + 0x68) >>> 0, nInteractUnitType >>> 0)
  m.setU8((pUnit + 0x6c) >>> 0, 1)
}

/**
 * Asserts `pUnit !== 0` and `pUnit->dwUnitType === 0` (`UNIT_PLAYER`), then writes `pClient`
 * into `UNITS_GetPlayerData(pUnit)->pClient` (`+0x9C`).
 *
 * @va D2Game.dll@0x6fd00040 (66B)
 */
export function SUNIT_SetPlayerClientPtr_6FD00040_113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FD00040)
  if (pUnit === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x4bb)
  }
  if ((m.u32(pUnit >>> 0) | 0) !== 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x4bc)
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pUnit >>> 0) >>> 0
  m.setU32((pPlayerData + 0x9c) >>> 0, pClient >>> 0)
}

/**
 * Clears player trade/timeout fields `+0x148` and `+0x14C` on `pPlayer->pPlayerData` and deletes
 * event `0x0E` (`0x6FD00410`) on `pPlayer`.
 *
 * @va D2Game.dll@0x6fd00410 (77B)
 */
export function SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _nArg0 = 0,
  _nArg1 = 0,
  _nArg2 = 0,
): number {
  hitD2GameVa113c(0x6FD00410)
  if (pPlayer === 0) {
    return 0
  }
  if ((m.u32(pPlayer >>> 0) | 0) !== 0) {
    return 0
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  if (pPlayerData === 0) {
    return 0
  }
  m.setU32((pPlayerData + 0x148) >>> 0, 0)
  m.setU32((pPlayerData + 0x14c) >>> 0, 0)
  EVENT_DeleteEventByType113c(m, pGame >>> 0, pPlayer >>> 0, 0x0e, 0x6fd00410)
  return 1
}

/**
 * Validates `pUnit`'s path target unit in `pGame` via `SUNIT_ValidatePathTargetUnit113c` and returns
 * `PATH_GetTargetUnit113c(pUnit->pPath)` (or `0` if the target is `pUnit` itself).
 *
 * @va D2Game.dll@0x6fd00bd0 (27B)
 */
export function SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FD00BD0)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  return pTarget === (pUnit >>> 0) ? 0 : pTarget
}

/**
 * Object init callback for Compelling Orb (`0x6FD2E124`, `ecx = pObjInitStrc`):
 * Finds quest `0x13` (`19`) in `pGame->pQuestControl` (`+0x10F4`) and, if `pQuestState->bOrbSmashed` (`+0x0C`)
 * is non-zero, sets the object animation mode to `2` (`OBJMODE_OPENED`).
 *
 * @va D2Game.dll@0x6fd02a00 (57B)
 */
export function ACT3Q5_InitCompellingOrbObject_6FD02A00_113c(
  m: Memory113c,
  pObjInitStrc: number,
): void {
  hitD2GameVa113c(0x6FD02A00)
  const pGame = m.u32(pObjInitStrc >>> 0) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x13) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pState + 0x0c) >>> 0) !== 0) {
    UNITS_ChangeAnimMode113c(m, m.u32((pObjInitStrc + 4) >>> 0), 2)
  }
}

/**
 * Act 3 Quest 2 (`Blade of the Old Religion`) item-drop/leave callback (`ecx = pQuest`, `edx = pQuestArg`):
 * When a `'g33 '` (`0x20333367`) item is removed, decrements `pState->nGidbinnCount` (`+0x1C`) and, if it
 * reaches `0` while the altar is active (`pState->bAltarSpawned !== 0`, `pQuest->bActive !== 0`, `pQuest->nSeq < 5`),
 * sets `pState->bCanSpawnGidbinn` (`+0x20`) to `1`.
 *
 * @va D2Game.dll@0x6fd02d00 (53B)
 */
export function ACT3Q2_OnGidbinnItemRemoved_6FD02D00_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD02D00)
  const pItem = m.u32((pQuestArg + 8) >>> 0) >>> 0
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if ((ITEMS_GetBaseCode113c(m, pItem) >>> 0) !== 0x20333367) {
    return
  }
  const nextCount = (m.u32((pState + 0x1c) >>> 0) - 1) >>> 0
  m.setU32((pState + 0x1c) >>> 0, nextCount)
  if (nextCount !== 0) {
    return
  }
  if (m.u8(pState) === 0) {
    return
  }
  if (m.u8((pQuest + 9) >>> 0) === 0) {
    return
  }
  if (m.u8((pQuest + 0x0c) >>> 0) >= 5) {
    return
  }
  m.setU8((pState + 0x20) >>> 0, 1)
}

/**
 * Object init callback for Act 3 Sewer Stairs (`0x6FD2E0F8`, `ecx = pObjInitStrc`):
 * Finds quest `0x10` (`16`) in `pGame->pQuestControl` (`+0x10F4`) and, if `pQuest->bNotIntro` (`+0x09`) is `0`,
 * sets the object animation mode to `2` (`OBJMODE_OPENED`).
 *
 * @va D2Game.dll@0x6fd02e00 (53B)
 */
export function ACT3Q3_InitSewerStairsObject_6FD02E00_113c(
  m: Memory113c,
  pObjInitStrc: number,
): void {
  hitD2GameVa113c(0x6FD02E00)
  const pGame = m.u32(pObjInitStrc >>> 0) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) {
    return
  }
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) {
    return
  }
  while ((m.u32(pQuest) | 0) !== 0x10) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) {
      return
    }
  }
  if (m.u8((pQuest + 9) >>> 0) === 0) {
    UNITS_ChangeAnimMode113c(m, m.u32((pObjInitStrc + 4) >>> 0), 2)
  }
}

/**
 * Act 3 Quest 5 (`The Blackened Temple`) callback `14` wrapper (`ecx = pQuest`, `edx = pQuestArg`):
 * Forwards to `QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c` (`0x6FC540C0`).
 *
 * @va D2Game.dll@0x6fd03390 (14B)
 */
export function ACT3Q5_Callback14_RemovePlayerGuid_6FD03390_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD03390)
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuest >>> 0, pQuestArg >>> 0)
}

/**
 * Act 3 Quest 6 (`The Guardian`) callback `14` wrapper (`ecx = pQuest`, `edx = pQuestArg`):
 * Forwards to `QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c` (`0x6FC540C0`).
 *
 * @va D2Game.dll@0x6fd03960 (14B)
 */
export function ACT3Q6_Callback14_RemovePlayerGuid_6FD03960_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD03960)
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuest >>> 0, pQuestArg >>> 0)
}

/**
 * Act 3 Quest 2 (`Blade of the Old Religion`) callback `14` wrapper (`ecx = pQuest`, `edx = pQuestArg`):
 * Forwards to `QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c` (`0x6FC540C0`).
 *
 * @va D2Game.dll@0x6fd03b30 (14B)
 */
export function ACT3Q2_Callback14_RemovePlayerGuid_6FD03B30_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD03B30)
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuest >>> 0, pQuestArg >>> 0)
}

/**
 * Object init callback for the Gidbinn Altar (`0x6FD2E0EC`, `ecx = pObjInitStrc`):
 * Finds quest `0x11` (`17`) in `pGame->pQuestControl` (`+0x10F4`), stores the altar object GUID (`+0x28`)
 * and coordinates (`+0x10`, `+0x14`) in `pQuestState`, and sets the object animation mode to `pQuestState->nAltarMode` (`+0x2C`).
 *
 * @va D2Game.dll@0x6fd04120 (81B)
 */
export function ACT3Q2_InitGidbinnAltarObject_6FD04120_113c(
  m: Memory113c,
  pObjInitStrc: number,
): void {
  hitD2GameVa113c(0x6FD04120)
  const pGame = m.u32(pObjInitStrc >>> 0) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) {
    return
  }
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) {
    return
  }
  while ((m.u32(pQuest) | 0) !== 0x11) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) {
      return
    }
  }
  const pObj = m.u32((pObjInitStrc + 4) >>> 0) >>> 0
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const objGuid = pObj === 0 ? 0xffffffff : m.u32((pObj + 0x0c) >>> 0)
  m.setU32((pState + 0x28) >>> 0, objGuid >>> 0)
  m.setU32((pState + 0x10) >>> 0, m.u32((pObjInitStrc + 0x14) >>> 0))
  m.setU32((pState + 0x14) >>> 0, m.u32((pObjInitStrc + 0x18) >>> 0))
  UNITS_ChangeAnimMode113c(m, m.u32((pObjInitStrc + 4) >>> 0), m.u32((pState + 0x2c) >>> 0))
}

/**
 * Act 3 Quest 2 player-enter callback (`ecx = pQuest`, `edx = pQuestArg`):
 * Checks if `pQuestArg->pPlayer` (`+0x0C`) carries `'g33 '` (`0x20333367`), incrementing `pState->nGidbinnCount` (`+0x1C`)
 * if found, and clearing `pState->bCanSpawnGidbinn` (`+0x20`) if `nGidbinnCount === 1`.
 *
 * @va D2Game.dll@0x6fd041a0 (47B)
 */
export function ACT3Q2_OnPlayerEnteredCheckGidbinn_6FD041A0_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD041A0)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x20333367) !== 0) {
    m.setU32((pState + 0x1c) >>> 0, (m.u32((pState + 0x1c) >>> 0) + 1) >>> 0)
  }
  if (m.u8((pState + 0x20) >>> 0) !== 0 && (m.u32((pState + 0x1c) >>> 0) | 0) === 1) {
    m.setU8((pState + 0x20) >>> 0, 0)
  }
}

/**
 * Act 3 Quest 3 (`Khalim's Will`) player-item check for Khalim's Heart (`'qhr '` `0x20726871` or `'qf2 '` `0x20326671`):
 * If `pPlayer` has neither item, increments `pQuestState->nMissingPlayerCount` (`+0x0C`) on quest `0x10`.
 *
 * @va D2Game.dll@0x6fd047d0 (87B)
 */
export function ACT3Q3_CountPlayerMissingKhalimHeart_6FD047D0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FD047D0)
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, pGame >>> 0, 0x20726871) === 0 &&
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, pGame >>> 0, 0x20326671) === 0
  ) {
    const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
    if (pQuestControl !== 0) {
      let pQuest = m.u32(pQuestControl) >>> 0
      while (pQuest !== 0) {
        if ((m.u32(pQuest) | 0) === 0x10) {
          const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
          m.setU32((pState + 0x0c) >>> 0, (m.u32((pState + 0x0c) >>> 0) + 1) >>> 0)
          break
        }
        pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
      }
    }
  }
  return 0
}

/**
 * Act 3 Quest 3 (`Khalim's Will`) player-item check for Khalim's Brain (`'qbr '` `0x20726271` or `'qf2 '` `0x20326671`):
 * If `pPlayer` has neither item, increments `pQuestState->nMissingPlayerCount` (`+0x0C`) on quest `0x10`.
 *
 * @va D2Game.dll@0x6fd04830 (87B)
 */
export function ACT3Q3_CountPlayerMissingKhalimBrain_6FD04830_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FD04830)
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, pGame >>> 0, 0x20726271) === 0 &&
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, pGame >>> 0, 0x20326671) === 0
  ) {
    const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
    if (pQuestControl !== 0) {
      let pQuest = m.u32(pQuestControl) >>> 0
      while (pQuest !== 0) {
        if ((m.u32(pQuest) | 0) === 0x10) {
          const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
          m.setU32((pState + 0x0c) >>> 0, (m.u32((pState + 0x0c) >>> 0) + 1) >>> 0)
          break
        }
        pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
      }
    }
  }
  return 0
}

/**
 * Act 3 Quest 3 (`Khalim's Will`) player-item check for Khalim's Eye (`'qey '` `0x20796571` or `'qf2 '` `0x20326671`):
 * If `pPlayer` has neither item, increments `pQuestState->nMissingPlayerCount` (`+0x0C`) on quest `0x10`.
 *
 * @va D2Game.dll@0x6fd04890 (87B)
 */
export function ACT3Q3_CountPlayerMissingKhalimEye_6FD04890_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FD04890)
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, pGame >>> 0, 0x20796571) === 0 &&
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, pGame >>> 0, 0x20326671) === 0
  ) {
    const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
    if (pQuestControl !== 0) {
      let pQuest = m.u32(pQuestControl) >>> 0
      while (pQuest !== 0) {
        if ((m.u32(pQuest) | 0) === 0x10) {
          const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
          m.setU32((pState + 0x0c) >>> 0, (m.u32((pState + 0x0c) >>> 0) + 1) >>> 0)
          break
        }
        pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
      }
    }
  }
  return 0
}

/**
 * Object init callback for Act 3 Sewer Lever (`0x6FD2E0F4`, `ecx = pObjInitStrc`):
 * Finds quest `0x10` (`16`) in `pGame->pQuestControl` (`+0x10F4`), records `bLeverInitialized = 1` (`+0x00`)
 * and lever object GUID (`+0x04`), and sets the lever animation mode to `2` (if `pQuest->bNotIntro === 0`)
 * or `pQuestState->nLeverMode` (`+0x08`).
 *
 * @va D2Game.dll@0x6fd04980 (95B)
 */
export function ACT3Q3_InitSewerLeverObject_6FD04980_113c(
  m: Memory113c,
  pObjInitStrc: number,
): void {
  hitD2GameVa113c(0x6FD04980)
  const pGame = m.u32(pObjInitStrc >>> 0) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) {
    return
  }
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) {
    return
  }
  while ((m.u32(pQuest) | 0) !== 0x10) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) {
      return
    }
  }
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU8(pState, 1)
  const pObj = m.u32((pObjInitStrc + 4) >>> 0) >>> 0
  const objGuid = pObj === 0 ? 0xffffffff : m.u32((pObj + 0x0c) >>> 0)
  m.setU32((pState + 4) >>> 0, objGuid >>> 0)
  if (m.u8((pQuest + 9) >>> 0) === 0) {
    UNITS_ChangeAnimMode113c(m, m.u32((pObjInitStrc + 4) >>> 0), 2)
    return
  }
  UNITS_ChangeAnimMode113c(m, m.u32((pObjInitStrc + 4) >>> 0), m.u32((pState + 8) >>> 0))
}

/**
 * Act 3 Quest 4 (`Lam Esen's Tome`) player-item check (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = pArg`):
 * If `pPlayer` carries `'bbb '` (`0x20626262`), finds quest `0x0F` (`15`) in `pGame->pQuestControl` (`+0x10F4`)
 * and sets `pQuestState->bPlayerHasTome` (`+0x04`) to `1`.
 *
 * @va D2Game.dll@0x6fd05080 (63B)
 */
export function ACT3Q4_CheckPlayerHasLamEsensTome_6FD05080_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FD05080)
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, pGame >>> 0, 0x20626262) === 0) {
    return
  }
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  let pQuest = pQuestControl !== 0 ? m.u32(pQuestControl) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x0f) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU8((pState + 4) >>> 0, 1)
}

/**
 * Act 3 Quest 4 (`Lam Esen's Tome`) NPC interact callback (`ecx = pQuest`, `edx = pQuestArg`):
 * When interacting with Alkor (`wClassId === 0xFE`) while `pState->bPendingIntroVoice === 1` (`+0x0C`)
 * and `pPlayer` matches `pState->dwTargetPlayerGuid` (`+0x10`), plays event sound `0x43` for non-Expansion classes
 * (`dwClassId !== 5 && dwClassId !== 6`) and clears `pState->bPendingIntroVoice` (`+0x0C`).
 *
 * @va D2Game.dll@0x6fd051c0 (81B)
 */
export function ACT3Q4_OnAlkorInteractPlayVoice_6FD051C0_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD051C0)
  const pTarget = m.u32((pQuestArg + 8) >>> 0) >>> 0
  if (pTarget === 0) {
    return
  }
  if (m.u16((pTarget + 4) >>> 0) !== 0xfe) {
    return
  }
  const pState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pState + 0x0c) >>> 0) !== 1) {
    return
  }
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const playerGuid = pPlayer === 0 ? 0xffffffff : m.u32((pPlayer + 0x0c) >>> 0)
  if ((playerGuid >>> 0) !== (m.u32((pState + 0x10) >>> 0) >>> 0)) {
    return
  }
  if (pPlayer === 0 || ((m.u32((pPlayer + 4) >>> 0) | 0) !== 6 && (m.u32((pPlayer + 4) >>> 0) | 0) !== 5)) {
    const pSrc = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
    SUNIT_SetUnitEventSound113c(m, pSrc, 0x43, pSrc)
  }
  m.setU8((pState + 0x0c) >>> 0, 0)
}

/**
 * Act 3 Quest 4 (`Lam Esen's Tome`) callback `14` wrapper (`ecx = pQuest`, `edx = pQuestArg`):
 * Forwards to `QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c` (`0x6FC540C0`).
 *
 * @va D2Game.dll@0x6fd05220 (14B)
 */
export function ACT3Q4_Callback14_RemovePlayerGuid_6FD05220_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD05220)
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuest >>> 0, pQuestArg >>> 0)
}

/**
 * Act 3 Quest 4 (`Lam Esen's Tome`) NPC quest-alert check (`ecx = pQuest`, `edx = nNpcId`,
 * `[esp+4] = pPlayer`, `[esp+8] = pQuestFlags`, `[esp+12] = pNpcUnit`):
 * Returns `1` if `nNpcId === 0xFE` (`Alkor`) and either quest `0x11` is in sequence `1` with bits `0` and `0x0F` clear,
 * or `pPlayer` holds `'bbb '` (`0x20626262`).
 *
 * @va D2Game.dll@0x6fd053f0 (87B)
 */
export function ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c(
  m: Memory113c,
  pQuest: number,
  nNpcId: number,
  pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit = 0,
): number {
  hitD2GameVa113c(0x6FD053F0)
  if ((nNpcId | 0) !== 0xfe) {
    return 0
  }
  if (
    m.u8((pQuest + 0x0c) >>> 0) === 1 &&
    (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x11, 0) | 0) === 0 &&
    (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 0x11, 0x0f) | 0) === 0
  ) {
    return 1
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      pPlayer >>> 0,
      m.u32((pQuest + 4) >>> 0),
      0x20626262,
    ) !== 0
  ) {
    return 1
  }
  return 0
}

/**
 * Act 3 Quest 6 (`The Guardian`) player quest-record update callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = pArg`):
 * If quest `0x16` (`22`) bits `0` and `0x0B` are not `1` on `pPlayer`'s difficulty quest record,
 * sets quest state `(0x16, 0x0E)` and sends alert `0x5D` (`uQuestId = 0x14`, `uState = 0`).
 *
 * @va D2Game.dll@0x6fd05b10 (76B)
 */
export function ACT3Q6_UpdatePlayerQuestState0E_6FD05B10_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FD05B10)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0) | 0) !== 1 &&
    (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0x0b) | 0) !== 1
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x16, 0x0e)
    QUESTS_SendQuestStateAlert5D_113c(m, pPlayer >>> 0, 0x14, 0)
  }
  return 0
}

/**
 * Act 3 Quest 5 (`The Blackened Temple`) player quest-record update callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = pArg`):
 * If quest `0x15` (`21`) bits `0` and `4` are not `1` on `pPlayer`'s difficulty quest record,
 * sets quest state `(0x15, 0x0E)` and sends alert `0x5D` (`uQuestId = 0x13`, `uState = 0`).
 *
 * @va D2Game.dll@0x6fd05cd0 (76B)
 */
export function ACT3Q5_UpdatePlayerQuestState0E_6FD05CD0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FD05CD0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0) | 0) !== 1 &&
    (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 4) | 0) !== 1
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x15, 0x0e)
    QUESTS_SendQuestStateAlert5D_113c(m, pPlayer >>> 0, 0x13, 0)
  }
  return 0
}

/**
 * Act 3 Quest 4 (`Lam Esen's Tome`) reward callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = pArg`):
 * If quest `0x11` (`17`) bit `1` is `1` on `pPlayer`'s difficulty quest record, grants `+5` `STAT_STATPTS` (`4`),
 * sends quest item state `2` alert `0x5D` (`uQuestId = 0x0F`), and clears quest bit `(0x11, 1)`.
 *
 * @va D2Game.dll@0x6fd06470 (73B)
 */
export function ACT3Q4_GrantPlayerStatPointsReward_6FD06470_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FD06470)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + bDiff * 4 + 0x10) >>> 0) >>> 0
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 1) | 0) === 1) {
    STATLIST_AddUnitStatMemPort113c(m, pPlayer >>> 0, 4, 5, 0)
    QUESTS_SendQuestItemState2_5D_113c(m, pPlayer >>> 0, 0x0f)
    QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x11, 1)
  }
  return 0
}

/**
 * Resolves room monster subclass index `nSubClassIndex` (`[esp+8]`) for `pLeader`'s room (`UNITS_GetRoom113c`)
 * if the room's level is non-hidden (`DUNGEON_GetLevelIdIfNotHidden113c !== 0`), then spawns a minion
 * via `MONSTER_SpawnPartyMinionInRing113c`.
 *
 * @va D2Game.dll@0x6fd0df20 (64B)
 */
export function MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c(
  m: Memory113c,
  pLeader: number,
  nMode: number,
  nSubClassIndex: number,
  pGame: number,
  nMaxRadius: number,
  wFlags: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  hitD2GameVa113c(0x6FD0DF20)
  const pRoom = UNITS_GetRoom113c(m, pLeader >>> 0) >>> 0
  if ((DUNGEON_GetLevelIdIfNotHidden113c(m, pRoom) | 0) === 0) {
    return 0
  }
  const nClassId = DRLG_ResolveMonsterSubClassIdForRoom113c(m, pRoom, nSubClassIndex | 0) | 0
  return (
    MONSTER_SpawnPartyMinionInRing113c(
      m,
      nClassId,
      pLeader >>> 0,
      nMode | 0,
      pGame >>> 0,
      nMaxRadius | 0,
      wFlags & 0xffff,
      hooks,
    ) >>> 0
  )
}

/**
 * Packs a `0x28`-byte `D2MonSpawnArgsStrc` on the stack (`+0x00=pGame`, `+0x04=pRoom`, `+0x08=0`,
 * `+0x0C=nClassId`, `+0x10=nMode`, `+0x14=dwArg14`, `+0x18=nX`, `+0x1C=nY`, `+0x20=nMaxRadius`, `+0x24=wFlags`)
 * and calls `MONSTER_Create113c` (`0x6FD0EF10`).
 *
 * @va D2Game.dll@0x6fd0f450 (86B)
 */
export function MONSTER_SpawnAtCoords_6FD0F450_113c(
  m: Memory113c,
  dwArg14: number,
  nClassId: number,
  nMode: number,
  pGame: number,
  pRoom: number,
  nX: number,
  nY: number,
  nMaxRadius: number,
  wFlags: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  hitD2GameVa113c(0x6FD0F450)
  const sp = (k2W2B8StackPtr - 0x28) >>> 0
  k2W2B8StackPtr = sp
  try {
    m.setU32(sp, pGame >>> 0)
    m.setU32((sp + 0x04) >>> 0, pRoom >>> 0)
    m.setU32((sp + 0x08) >>> 0, 0)
    m.setU32((sp + 0x0c) >>> 0, nClassId >>> 0)
    m.setU32((sp + 0x10) >>> 0, nMode >>> 0)
    m.setU32((sp + 0x14) >>> 0, dwArg14 >>> 0)
    m.setU32((sp + 0x18) >>> 0, nX >>> 0)
    m.setU32((sp + 0x1c) >>> 0, nY >>> 0)
    m.setU32((sp + 0x20) >>> 0, nMaxRadius >>> 0)
    m.setU16((sp + 0x24) >>> 0, wFlags & 0xffff)
    return MONSTER_Create113c(m, sp, hooks) >>> 0
  } finally {
    k2W2B8StackPtr = (sp + 0x28) >>> 0
  }
}

/**
 * Unlinks and frees the `D2PlayerListStrc` node matching `pTargetUnit` (`eax`) from
 * `UNITS_GetPlayerData(pOwnerUnit)->pPlayerList` (`+0x38`).
 *
 * @va D2Game.dll@0x6fd0ffd0 (100B)
 */
export function PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c(
  m: Memory113c,
  pTargetUnit: number,
  pOwnerUnit: number,
  pGame: number,
  hooks?: K2W2B8Hooks113c,
): void {
  hitD2GameVa113c(0x6FD0FFD0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pOwnerUnit >>> 0) >>> 0
  const targetGuid = pTargetUnit === 0 ? 0xffffffff : m.u32((pTargetUnit + 0x0c) >>> 0)
  if ((pOwnerUnit >>> 0) === (pTargetUnit >>> 0)) {
    return
  }
  let pPrev = 0
  let pNode = m.u32((pPlayerData + 0x38) >>> 0) >>> 0
  if (pNode === 0) {
    return
  }
  while ((m.u32(pNode) >>> 0) !== (targetGuid >>> 0)) {
    pPrev = pNode
    pNode = m.u32((pNode + 0x10) >>> 0) >>> 0
    if (pNode === 0) {
      return
    }
  }
  const pNext = m.u32((pNode + 0x10) >>> 0) >>> 0
  if (pPrev !== 0) {
    m.setU32((pPrev + 0x10) >>> 0, pNext)
  } else {
    m.setU32((pPlayerData + 0x38) >>> 0, pNext)
  }
  const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
  if (hooks !== undefined && hooks.freePoolMemory !== undefined) {
    hooks.freePoolMemory(m, pMemPool, pNode, D2GAME_PLAYERLIST_CPP_STR_VA_113C, 0x97, 0)
  }
}

/**
 * Sets `pNode->dwHostileDelayTick` (`+0x08`) to `dwHostileTick` (`[esp+4]`) on the `D2PlayerListStrc` node
 * for `pTargetUnit` in `pOwnerUnit->pPlayerData->pPlayerList` (`+0x38`), and records `GetTickCount()`
 * at `pOwnerUnit->pPlayerData + 0x160`.
 *
 * @va D2Game.dll@0x6fd10090 (80B)
 */
export function PLAYERLIST_SetHostileDelayTick_6FD10090_113c(
  m: Memory113c,
  pTargetUnit: number,
  pOwnerUnit: number,
  dwHostileTick: number,
  hooks?: K2W2B8Hooks113c,
): void {
  hitD2GameVa113c(0x6FD10090)
  const pPlayerData = UNITS_GetPlayerData113c(m, pOwnerUnit >>> 0) >>> 0
  const targetGuid = pTargetUnit === 0 ? 0xffffffff : m.u32((pTargetUnit + 0x0c) >>> 0)
  if ((pOwnerUnit >>> 0) !== (pTargetUnit >>> 0)) {
    let pNode = m.u32((pPlayerData + 0x38) >>> 0) >>> 0
    while (pNode !== 0) {
      if ((m.u32(pNode) >>> 0) === (targetGuid >>> 0)) {
        m.setU32((pNode + 8) >>> 0, dwHostileTick >>> 0)
        break
      }
      pNode = m.u32((pNode + 0x10) >>> 0) >>> 0
    }
  }
  const pOwnerData2 = UNITS_GetPlayerData113c(m, pOwnerUnit >>> 0) >>> 0
  if (pOwnerData2 !== 0) {
    let tick = 0
    if (hooks !== undefined && hooks.getTickCount !== undefined) {
      tick = hooks.getTickCount(m) >>> 0
    } else {
      const pTickSlot = m.u32(D2GAME_IAT_GET_TICK_COUNT_VA_113C) >>> 0
      tick = pTickSlot !== 0 ? m.u32(pTickSlot) >>> 0 : 0
    }
    m.setU32((pOwnerData2 + 0x160) >>> 0, tick)
  }
}

/**
 * Initializes a `D2ModeChangeStrc` for `pUnit` (`ecx`) and `nMode` (`eax`), sets `PATH_SetStepNum113c(pUnit->pPath, 0)`,
 * populates `(nX, nY)` at `+0x0C`/`+0x10`, and dispatches `MONSTER_StartMode` (`0x6FC95E10`).
 *
 * @va D2Game.dll@0x6fd11fa0 (67B)
 */
export function AI_StartModeAtCoordsStep0_6FD11FA0_113c(
  m: Memory113c,
  pUnit: number,
  nMode: number,
  pGame: number,
  nX: number,
  nY: number,
  hooks?: K2W2B8Hooks113c,
): number {
  hitD2GameVa113c(0x6FD11FA0)
  const sp = (k2W2B8StackPtr - 0x20) >>> 0
  k2W2B8StackPtr = sp
  try {
    MONSTER_InitModeChangeStrc113c(m, pUnit >>> 0, sp, nMode | 0)
    PATH_SetStepNum113c(m, m.u32((pUnit + 0x2c) >>> 0), 0)
    m.setU32((sp + 0x0c) >>> 0, nX >>> 0)
    m.setU32((sp + 0x10) >>> 0, nY >>> 0)
    return dispatchMonsterStartMode6FC95E10(m, pGame >>> 0, sp, 1, hooks) | 0
  } finally {
    k2W2B8StackPtr = (sp + 0x20) >>> 0
  }
}

/**
 * Initializes a `D2ModeChangeStrc` for `pUnit` (`ecx`) and `nMode` (`eax`), sets `PATH_SetStepNum113c(pUnit->pPath, 1)`,
 * populates `(nX, nY)` at `+0x0C`/`+0x10`, and dispatches `MONSTER_StartMode` (`0x6FC95E10`).
 *
 * @va D2Game.dll@0x6fd11ff0 (67B)
 */
export function AI_StartModeAtCoordsStep1_6FD11FF0_113c(
  m: Memory113c,
  pUnit: number,
  nMode: number,
  pGame: number,
  nX: number,
  nY: number,
  hooks?: K2W2B8Hooks113c,
): number {
  hitD2GameVa113c(0x6FD11FF0)
  const sp = (k2W2B8StackPtr - 0x20) >>> 0
  k2W2B8StackPtr = sp
  try {
    MONSTER_InitModeChangeStrc113c(m, pUnit >>> 0, sp, nMode | 0)
    PATH_SetStepNum113c(m, m.u32((pUnit + 0x2c) >>> 0), 1)
    m.setU32((sp + 0x0c) >>> 0, nX >>> 0)
    m.setU32((sp + 0x10) >>> 0, nY >>> 0)
    return dispatchMonsterStartMode6FC95E10(m, pGame >>> 0, sp, 1, hooks) | 0
  } finally {
    k2W2B8StackPtr = (sp + 0x20) >>> 0
  }
}

/**
 * Frees any existing `EVENT_AITHINK` (`2`) timer nodes on `pUnit->pSrvTimerList` (`+0xDC`)
 * and schedules a new `EVENT_AITHINK` (`2`) at `pGame->dwGameFrame + (nDelay || 1)`.
 *
 * @va D2Game.dll@0x6fd120c0 (83B)
 */
export function AI_ScheduleAiThinkTimer_6FD120C0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nDelay: number,
): void {
  hitD2GameVa113c(0x6FD120C0)
  const delay = (nDelay | 0) === 0 ? 1 : nDelay | 0
  if (pUnit !== 0) {
    let pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pEvent !== 0) {
      const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
      if (m.u8(pEvent) === 2) {
        EVENT_FreeNode113c(m, pGame >>> 0, pEvent)
      }
      pEvent = pNext
    }
  }
  const frame = (m.u32((pGame + 0xa8) >>> 0) + delay) >>> 0
  EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 2, frame, 0, 0, 0)
}

/**
 * Initializes a `D2ModeChangeStrc` for `pUnit` (`edi`) and `nMode` (`eax`), populates `(nX, nY)`
 * at `+0x0C`/`+0x10` without altering `pPath->nStepNum`, and dispatches `MONSTER_StartMode` (`0x6FC95E10`).
 *
 * @va D2Game.dll@0x6fd121e0 (52B)
 */
export function AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(
  m: Memory113c,
  pUnit: number,
  nMode: number,
  pGame: number,
  nX: number,
  nY: number,
  hooks?: K2W2B8Hooks113c,
): number {
  hitD2GameVa113c(0x6FD121E0)
  const sp = (k2W2B8StackPtr - 0x20) >>> 0
  k2W2B8StackPtr = sp
  try {
    MONSTER_InitModeChangeStrc113c(m, pUnit >>> 0, sp, nMode | 0)
    m.setU32((sp + 0x0c) >>> 0, nX >>> 0)
    m.setU32((sp + 0x10) >>> 0, nY >>> 0)
    return dispatchMonsterStartMode6FC95E10(m, pGame >>> 0, sp, 1, hooks) | 0
  } finally {
    k2W2B8StackPtr = (sp + 0x20) >>> 0
  }
}

/**
 * Runs (`MONMODE_RUN = 15`) `pUnit` (`edx`) toward `pTarget` (`ecx`) with low byte of `nStepNum`
 * defaulted to `1` if `0`, forwarding to `AI_ApproachTarget` (`0x6FD12540`).
 *
 * @va D2Game.dll@0x6fd12f00 (39B)
 */
export function AI_RunTowardTarget_6FD12F00_113c(
  m: Memory113c,
  pUnit: number,
  pTarget: number,
  pGame: number,
  nStepNum: number,
  hooks?: K2W2B8Hooks113c,
): number {
  hitD2GameVa113c(0x6FD12F00)
  const stepNum = (nStepNum & 0xff) === 0 ? (nStepNum & ~0xff) | 1 : nStepNum | 0
  return aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget >>> 0, 0x0f, 0, 0, stepNum, 0, hooks)
}

/**
 * Walks (`MONMODE_WALK = 2`) `pUnit` (`edx`) toward `pTarget` (`ecx`) with low byte of `nStepNum`
 * defaulted to `1` if `0`, forwarding to `AI_ApproachTarget` (`0x6FD12540`).
 *
 * @va D2Game.dll@0x6fd12f30 (39B)
 */
export function AI_WalkTowardTarget_6FD12F30_113c(
  m: Memory113c,
  pUnit: number,
  pTarget: number,
  pGame: number,
  nStepNum: number,
  hooks?: K2W2B8Hooks113c,
): number {
  hitD2GameVa113c(0x6FD12F30)
  const stepNum = (nStepNum & 0xff) === 0 ? (nStepNum & ~0xff) | 1 : nStepNum | 0
  return aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget >>> 0, 2, 0, 0, stepNum, 0, hooks)
}

/**
 * Sets `pUnit->pMonsterData->pAiControl->dwPathType` (`+0x18`) to `0x0D` (`13`) and approaches `pTarget`
 * in `MONMODE_WALK` (`2`) with `nStepNum = 1` and `dwFlags` via `AI_ApproachTarget` (`0x6FD12540`).
 *
 * @va D2Game.dll@0x6fd13000 (56B)
 */
export function AI_ApproachTargetPathType13_6FD13000_113c(
  m: Memory113c,
  pUnit: number,
  pTarget: number,
  pGame: number,
  dwFlags: number,
  hooks?: K2W2B8Hooks113c,
): number {
  hitD2GameVa113c(0x6FD13000)
  let pAiControl = 0
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
    }
  }
  m.setU32((pAiControl + 0x18) >>> 0, 0x0d)
  return aiApproachTarget6FD12540(
    m,
    pGame >>> 0,
    pUnit >>> 0,
    pTarget >>> 0,
    2,
    0,
    0,
    1,
    dwFlags >>> 0,
    hooks,
  )
}

/**
 * Looks up `MonStats2.txt` for `pUnit` (`edi`): when `bEquipSkill !== 0` (`eax`), optionally equips
 * `pMonStats2->wResurrectSkill` (`+0x10C`) as `pUnit`'s used skill if `0 < wSkillId < sgptDataTables->nSkillsTxtRecordCount` (`+0xBA0`),
 * and returns `pMonStats2->nResurrectMode` (`+0x10B`) if `< 0x10` (otherwise `1`).
 *
 * @va D2Game.dll@0x6fd13cb0 (100B)
 */
export function AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c(
  m: Memory113c,
  pUnit: number,
  bEquipSkill: number,
): number {
  hitD2GameVa113c(0x6FD13CB0)
  if ((bEquipSkill | 0) === 0) {
    return 1
  }
  const nClassId = pUnit === 0 ? -1 : m.u32((pUnit + 4) >>> 0) | 0
  const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, nClassId) >>> 0
  if (pMonStats2 === 0) {
    return 1
  }
  const wSkillId = m.u16((pMonStats2 + 0x10c) >>> 0)
  if (wSkillId > 0) {
    const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if ((wSkillId | 0) < (m.u32((pDataTables + 0xba0) >>> 0) | 0)) {
      const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit >>> 0, wSkillId) >>> 0
      SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, pSkill)
    }
  }
  const uMode = m.u8((pMonStats2 + 0x10b) >>> 0)
  return uMode >= 0x10 ? 1 : uMode
}
