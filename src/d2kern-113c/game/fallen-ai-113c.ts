/**
 * Diablo II v1.13c Pure Kernel Vertical Slice:
 * - `D2ActiveRoomStrc` death ring (`D2Common.#10873` `0x6FD8AFD0`)
 * - `D2DynamicPathStrc` (`0x200` bytes) memory-native `D2Common.dll` path ordinals (`../common/path.ts`)
 * - `MONSTER_SavePrevMode` (`0x6FC95260`), `MONSTER_StartMove` (`0x6FC94F90`), `MONSTER_UpdateVelocityAndRate` (`0x6FC94CE0`)
 * - `MONSTER_StartMode` (`0x6FC95E10`), `MONSTER_StepPath` (`0x6FD01930`), `MONSTER_StepWalk` (`0x6FC97010`), `MONSTER_StepRun` (`0x6FC96FE0`)
 * - `MONSTER_EndToAiOrNeutral` (`0x6FC96BF0`), `MONSTER_StartDeath` (`0x6FC96270`), `MONSTER_EndDeath` (`0x6FC96040`)
 * - `AI_RunMonsterAI` (`0x6FCBD3B0` -> `0x6FCBD160` -> `0x6FD13220`), `AiFallen` (`0x6FCA3130`), `AiZombie` (`0x6FCA38B0`)
 * - `AI_ApproachTarget` (`0x6FD12540`), `AI_FleeFrom` (`0x6FD12D80`), `AI_IdleWander` (`0x6FD11B10`), `AI_Stall` (`0x6FD122C0`)
 * - `SUNITDMG_CheckToHit` (`0x6FCFDE90`), `SUNITDMG_RollDamageValues` (`0x6FCFD450`), `SUNITDMG_ExecuteEvents` (`0x6FCFE0C0`),
 *   `SUNITDMG_CalculateExperienceGain` (`0x6FCFC030`), `ITEMS_RollMonsterTreasureClass` (`0x6FC51000`)
 * - `PLAYER_DrainRunStamina` (`0x6FC97BB0`), `PLAYER_Event3_RegenTick` (`0x6FC99B10`: `0x6FC97CB0` / `0x6FC97A50` / `0x6FC97950`),
 *   `PLAYER_Event11_PeriodicTick` (`0x6FC99A60`), and `AnimData.d2` player `0x06` melee timing.
 *
 * Zero legacy server imports: runs purely against `SparseMemory113c` + `D2TimerStrc` (`0x6FCAF070`).
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2ActiveRoomStrc,
  D2AiCmdStrc,
  D2AiCmdStrc_SIZE,
  D2AiControlStrc,
  D2AiGeneralStrc,
  D2DynamicPathStrc,
  D2EventStrc,
  D2GameStrc,
  D2GameStrc_SIZE,
  D2MonsterDataStrc,
  D2RoomExStrc,
  D2StatListExStrc,
  D2StatListExStrc_SIZE,
  D2StatListStrc,
  D2TimerStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import { seedNext, seedRoll, type D2SeedStrc } from '../prng.ts'
import { mulDiv113c } from '../common/int-math.ts'
import { SKILLS_GetUsedSkill113c } from '../common/skills.ts'
import { D2COMMON_SGPT_DATATABLES_VA_113C } from '../common/inline-helpers.ts'
import {
  STATLIST_AddUnitStat113c,
  STATLIST_GetStatListFromUnitAndState113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_RemoveStatListFromUnit113c,
  STATLIST_SetUnitStat113c,
  STATES_CheckState113c,
  STATES_ToggleState113c,
} from '../common/statlist.ts'
import {
  UNIT_ITEM,
  UNIT_MONSTER,
  UNIT_PLAYER,
  UNITROOM_ClearUpdateQueue113c,
  UNITROOM_RefreshUnit113c,
  UNITS_GetDistanceToOtherUnit113c,
  UNITS_GetRoom113c,
  UNITS_GetSeed113c,
  UNITS_SetSeed113c,
} from '../common/unit.ts'
import {
  PATH_Compute113c,
  PATH_ComputeDirection113c,
  PATH_ForceDirection113c,
  PATH_MarkUnitDeadCollision113c,
  PATH_SetDistance113c,
  PATH_SetNewDistance113c,
  PATH_SetStepNum113c,
  PATH_SetTargetPos113c,
  PATH_SetTargetUnit113c,
  PATH_SetType113c,
  PATH_SetVelocity113c,
  PATH_Step113c,
} from '../common/path.ts'
import {
  EVENT_AllocChunk113c,
  EVENT_DeleteEventByArg14_113c,
  EVENT_SetEventFull113c,
  EVENT_UpdateTimers113c,
} from './timer-wheel.ts'
import {
  MON_EVENT_AI_THINK,
  MON_EVENT_MODE_END,
  MON_EVENT_STAT_REGEN,
  MONSTER_ClearModeEvents113c,
  MONSTER_ClearStepEvents113c,
  MONSTER_DispatchEvent113c,
  MONSTER_GetModeEntry113c,
  MONSTER_INLINE_AI_ON_END_TABLE_113C,
  MONSTER_IsContinuousMode113c,
  MONSTER_RegisterContinuousModeEvent113c,
  SKILLS_SetUsedSkill113c,
  SUNIT_IsDeadOrDying113c,
} from './monster-events.ts'
import {
  bindRoomCollisionGrid113c,
  calculateKillExperienceGainPure113c,
  computeFrwDiminishingPure113c,
  computeRawPlayerAnimSpeedPure113c,
  ensureD2CommonPathGlobals113c,
  getCharAnimClipPure113c,
  getCharStatsPure113c,
  getItemTypeClosurePure113c,
  getItemsTxtRecordPure113c,
  getMonLvlXpRow113c,
  getMonStatsRowByClassId113c,
  getMonsterModeBaseFrameCountPure113c,
  playerAnimStartFramePure113c,
  rollTreasureClassSeedOnly113c,
  type CharStatsPure113c,
  type MonStatsRow113c,
  type PureCharAnimClip113c,
  type PureItemTypeClosure113c,
} from './tables-bootstrap-113c.ts'
import {
  AIGENERAL_AllocAiCommand113c,
  AIGENERAL_CopyAiCommandParams113c,
  AIGENERAL_PopAiCommand113c,
  AI_ApproachTarget113c,
  AI_DispatchTargetByAiFlag113c,
  AI_FleeFrom113c,
  AI_IdleWander113c,
  AI_Stall113c,
  AiFallen113c,
  AiZombie113c,
  MONSTER_EndDeath113c,
  MONSTER_EndToAiOrNeutral113c,
  MONSTER_SavePrevMode113c,
  MONSTER_StartDeath113c,
  MONSTER_StartMode113c,
  MONSTER_StartMove113c,
  MONSTER_StepPath113c,
  MONSTER_StepRun113c,
  MONSTER_StepWalk113c,
  ROOM_RecordMonsterDeath113c,
  SUNITDMG_CheckToHit113c,
  SUNITDMG_ExecuteEvents113c,
  UNITS_GetDistanceToCoordinates113c,
} from './k2-real-s2c-combat-113c.ts'
import {
  ITEMS_CheckNotBrokenOrUnequipping113c,
  PLAYER_DrainRunStamina113c,
  PLAYER_Event11_PeriodicTick113c,
  PLAYER_Event3_RegenTick113c,
  PLAYER_GetEquippedWeapon113c,
  PLAYER_UpdateHpRegen113c,
  PLAYER_UpdateManaRegen113c,
  PLAYER_UpdateStaminaRegen113c,
  SKILLS_GetFlags113c,
  STATLIST_FindSubListByStateAndFlags113c,
  SUNIT_ScheduleModeAnimEvents113c,
  UNITS_CanDualWield113c,
  applyPlayerPacket113c,
  stepFallenSliceFrame113c,
} from './replay-kernel-113c.ts'

export {
  AIGENERAL_AllocAiCommand113c,
  AIGENERAL_CopyAiCommandParams113c,
  AIGENERAL_PopAiCommand113c,
  AI_ApproachTarget113c,
  AI_DispatchTargetByAiFlag113c,
  AI_FleeFrom113c,
  AI_IdleWander113c,
  AI_Stall113c,
  AiFallen113c,
  AiZombie113c,
  ITEMS_CheckNotBrokenOrUnequipping113c,
  MONSTER_EndDeath113c,
  MONSTER_EndToAiOrNeutral113c,
  MONSTER_SavePrevMode113c,
  MONSTER_StartDeath113c,
  MONSTER_StartMode113c,
  MONSTER_StartMove113c,
  MONSTER_StepPath113c,
  MONSTER_StepRun113c,
  MONSTER_StepWalk113c,
  PLAYER_DrainRunStamina113c,
  PLAYER_Event11_PeriodicTick113c,
  PLAYER_Event3_RegenTick113c,
  PLAYER_GetEquippedWeapon113c,
  PLAYER_UpdateHpRegen113c,
  PLAYER_UpdateManaRegen113c,
  PLAYER_UpdateStaminaRegen113c,
  ROOM_RecordMonsterDeath113c,
  SKILLS_GetFlags113c,
  STATLIST_FindSubListByStateAndFlags113c,
  SUNITDMG_CheckToHit113c,
  SUNITDMG_ExecuteEvents113c,
  SUNIT_ScheduleModeAnimEvents113c,
  UNITS_CanDualWield113c,
  applyPlayerPacket113c,
  stepFallenSliceFrame113c,
  UNITS_GetDistanceToCoordinates113c,
}

const COLLIDE_MASK_INVALID_113C = 0xffff
const PATHTYPE_TOWARD_FINISH_113C = 13
const PATHTYPE_WALL_FOLLOW_113C = 15

export const VA_AI_FALLEN_113C = 0x6fca3130
export const VA_AI_ZOMBIE_113C = 0x6fca38b0
export const VA_MONSTER_STEP_WALK_113C = 0x6fc97010
export const VA_MONSTER_STEP_RUN_113C = 0x6fc96fe0
export const VA_MONSTER_CLEAR_STEP_113C = 0x6fc95320
export const VA_MONSTER_END_DEATH_113C = 0x6fc96040
export const VA_MONSTER_END_TO_AI_113C = 0x6fc96bf0

const STAT_STRENGTH = 0
const STAT_DEXTERITY = 2
const STAT_HITPOINTS = 6
const STAT_MAXHP = 7
const STAT_MANA = 8
const STAT_MAXMANA = 9
const STAT_STAMINA = 10
const STAT_MAXSTAMINA = 11
const STAT_LEVEL = 12
const STAT_EXPERIENCE = 13
const STAT_MAXDAMAGE_PERCENT = 17
const STAT_MINDAMAGE_PERCENT = 18
const STAT_TOHIT = 19
const STAT_TOBLOCK = 20
const STAT_MINDAMAGE = 21
const STAT_MAXDAMAGE = 22
const STAT_DAMAGEPERCENT = 25
const STAT_MANARECOVERY = 26
const STAT_MANARECOVERYBONUS = 27
const STAT_STAMINARECOVERYBONUS = 28
const STAT_ARMORCLASS = 31
const STAT_DAMAGERESIST = 36
const STAT_VELOCITYPERCENT = 67
const STAT_ATTACKRATE = 68
const STAT_DURABILITY = 72
const STAT_MAXDURABILITY = 73
const STAT_HPREGEN = 74
const STAT_ADDEXPERIENCE = 85
const STAT_FASTERATTACKRATE = 93
const STAT_FASTERMOVEVELOCITY = 96
const STAT_MONSTER_PLAYERCOUNT = 100
const STAT_ITEM_NORMALDAMAGE = 111
const STAT_ITEM_TOHIT_PERCENT = 119
const STAT_ITEM_DEADLYSTRIKE = 141
const STAT_ITEM_INDESTRUCTIBLE = 152
const STAT_STAMINADRAINPCT = 154
const STAT_PASSIVE_CRITICAL_STRIKE = 337
const STAT_PASSIVE_DODGE = 338
const STAT_PASSIVE_AVOID = 339
const STAT_PASSIVE_WEAPON_MASTERY_MELEE_TH = 342
const STAT_PASSIVE_WEAPON_MASTERY_MELEE_DMG = 343
const STAT_PASSIVE_WEAPON_MASTERY_MELEE_CRIT = 344
const STAT_PASSIVE_WEAPON_MASTERY_THROW_TH = 345
const STAT_PASSIVE_WEAPON_MASTERY_THROW_DMG = 346
const STAT_PASSIVE_WEAPON_MASTERY_THROW_CRIT = 347
const STAT_HP_TIER_ICON = 352

const PLR_EVENT_MODE_STEP = 0
const PLR_EVENT_MODE_END = 1
const PLR_EVENT_STAMINA = 3
const PLR_EVENT_IDLE = 11

const PLRMODE_NEUTRAL = 1
const PLRMODE_WALK = 2
const PLRMODE_RUN = 3
const PLRMODE_TOWN_NEUTRAL = 5
const PLRMODE_TOWN_WALK = 6
const PLRMODE_ATTACK1 = 7

const UNITFLAG_IN_SKILL_ACTION = 0x00000040
const UNITFLAG_MODE_CHANGED_TICK = 0x00080000
const UNITFLAG_PER_TICK_SYNC_MASK = 0x00080001
const UNITFLAG2_CORPSE_SELECTABLE = 0x00020000

const INV_SIGNATURE_113C = 0x01020304
const INV_OFF_PGRIDS = 0x14
const INV_OFF_NGRIDS = 0x18
const INV_OFF_DWWEAPONID = 0x1c
const INVGRID_OFF_PPITEMS = 0x0c
const BODYLOC_COUNT_113C = 13
const BODYLOC_TORSO = 3
const BODYLOC_RARM = 4
const BODYLOC_LARM = 5
const ITYPE_WEAPON_113C = 45
const ITYPE_MELEE_WEAPON_113C = 46
const ITYPE_THROWING_WEAPON_113C = 48
const ITYPE_ANY_ARMOR_113C = 50
const ITEMDATA_OFF_DWFLAGS = 0x18
const ITEMFLAG_BROKEN_113C = 0x00000100
const ITEMFLAG_UNEQUIPPING_113C = 0x00004000
const LEVEL_OFF_DWLEVELNO = 0x1d0

/**
 * `D2Game:0x6FD2E628` (`g_ArmorDurabilityWeights113c`):
 * 7-entry `(bodyLoc, weight)` table scanned by `SUNITDMG_DrainItemDurability` (`0x6FCFEBC6..0x6FCFED1A`)
 * when a player defender takes melee/physical damage.
 */
const ARMOR_DURABILITY_WEIGHTS_113C: ReadonlyArray<{ readonly bodyLoc: number; readonly weight: number }> = [
  { bodyLoc: 1, weight: 3 }, // HEAD
  { bodyLoc: 3, weight: 5 }, // TORSO
  { bodyLoc: 4, weight: 4 }, // RARM
  { bodyLoc: 5, weight: 4 }, // LARM
  { bodyLoc: 8, weight: 2 }, // BELT
  { bodyLoc: 9, weight: 2 }, // FEET
  { bodyLoc: 10, weight: 2 }, // GLOVES
]

export interface D2ItemsTxtRecord113c {
  readonly classId: number
  readonly isWeapon: boolean
  readonly code: string
  readonly wclass: string
  readonly wType1: number
  readonly wType2: number
  readonly strBonus: number
  readonly dexBonus: number
  readonly bNoDurability: number
  readonly dwSpeed: number
}

function getItemTypeClosure113c(): PureItemTypeClosure113c {
  return getItemTypeClosurePure113c()
}

/**
 * `@va D2Common:0x6FDC19A0` (`D2Common.#10695` `DATATBLS_GetItemsTxtRecord`):
 * Returns the compiled `D2ItemsTxt` record for `dwClassId` (`0..305` from `Weapons.txt`,
 * `306..507` from `Armor.txt`, `508..658` from `Misc.txt`).
 */
export function DATATBLS_GetItemsTxtRecord113c(classId: number): D2ItemsTxtRecord113c | null {
  return getItemsTxtRecordPure113c(classId)
}

/**
 * `@va D2Common:0x6FD74430` (`D2Common.#10744` `ITEMS_CheckItemTypeId`):
 * Checks whether `pItem` (`dwUnitType == 4`) has `itemTypeId` (`0..102`) in the `Equiv1`/`Equiv2`
 * ancestor closure of its `D2ItemsTxt.wType[0]` (`+0x11E`) or `wType[1]` (`+0x120`).
 */
export function ITEMS_CheckItemTypeId113c(
  m: Memory113c,
  pItem: number,
  itemTypeId: number,
): number {
  if (pItem === 0 || m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 0
  const { ancestorsByIndex } = getItemTypeClosure113c()
  const targetType = itemTypeId | 0
  if (targetType <= 0 || targetType >= ancestorsByIndex.length) return 0
  const rec = DATATBLS_GetItemsTxtRecord113c(m.get(pItem, D2UnitStrc.dwClassId))
  if (rec === null) return 0
  const set1 = ancestorsByIndex[rec.wType1]
  if (set1 !== undefined && set1.has(targetType)) return 1
  if (rec.wType2 > 0) {
    const set2 = ancestorsByIndex[rec.wType2]
    if (set2 !== undefined && set2.has(targetType)) return 1
  }
  return 0
}

/**
 * `@va D2Common:0x6FD729A0` (`D2Common.#10213` `ITEMS_GetStrBonus`):
 * Returns `D2ItemsTxt.wStrBonus (+0x106)` for `UNIT_ITEM` (`100` if `pItem == 0`, non-item, or `wStrBonus == 1`).
 */
export function ITEMS_GetStrBonus113c(m: Memory113c, pItem: number): number {
  if (pItem === 0 || m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 100
  const rec = DATATBLS_GetItemsTxtRecord113c(m.get(pItem, D2UnitStrc.dwClassId))
  if (rec === null || rec.strBonus === 1) return 100
  return rec.strBonus
}

/**
 * `@va D2Common:0x6FD72970` (`D2Common.#10120` `ITEMS_GetDexBonus`):
 * Returns `D2ItemsTxt.wDexBonus (+0x108)` for `UNIT_ITEM` (`100` if `pItem == 0`, non-item, or `wDexBonus == 1`).
 */
export function ITEMS_GetDexBonus113c(m: Memory113c, pItem: number): number {
  if (pItem === 0 || m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 100
  const rec = DATATBLS_GetItemsTxtRecord113c(m.get(pItem, D2UnitStrc.dwClassId))
  if (rec === null || rec.dexBonus === 1) return 100
  return rec.dexBonus
}

/**
 * `@va D2Common:0x6FD74C30` (`D2Common.#10711` `ITEMS_CheckIfThrowItem`):
 * Resolves `pItem`'s primary `wType1` (`0x6FD730F0` -> `0x6FD730A0` `D2ItemsTxt + 0x11E`) and
 * returns `D2ItemTypesTxt[wType1].nThrows (+0x10)` (`0` when `pItem == 0`, non-item, or `wType1 <= 0`).
 */
export function ITEMS_CheckIfThrowItem113c(m: Memory113c, pItem: number): number {
  if (pItem === 0 || m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 0
  const rec = DATATBLS_GetItemsTxtRecord113c(m.get(pItem, D2UnitStrc.dwClassId))
  if (rec === null || rec.wType1 <= 0) return 0
  const { throwsByIndex } = getItemTypeClosure113c()
  if (rec.wType1 >= throwsByIndex.length) return 0
  return throwsByIndex[rec.wType1]!
}

const BODY_GRID_DEF_113C = { bGridX: 13, bGridY: 1 } as const

/**
 * `@va D2Common:0x6FD6E1B0` (`INVENTORY_GetOrInitGrid`):
 * Validates `pInventory->dwSignature == 0x01020304`; if `nGridCount (+0x18) <= gridIdx` and
 * `pGridDef != null`, reallocates `pGrids (+0x14)` to `(gridIdx + 1) * 16` bytes, sets
 * `nGridCount = gridIdx + 1`, writes `bGridX (+0x08)` / `bGridY (+0x09)`, and allocates
 * `ppItems (+0x0C)` (`bGridX * bGridY * 4` bytes). If `nGridCount > gridIdx`, lazily allocates
 * `ppItems` when `ppItems == 0 && pGridDef != null`, and verifies `bGridX == pGridDef.bGridX`
 * and `bGridY == pGridDef.bGridY` (`0x6FD6E2BC..0x6FD6E2CE`).
 */
export function INVENTORY_GetOrInitGrid113c(
  m: Memory113c,
  pInventory: number,
  gridIdx: number,
  pGridDef: { readonly bGridX: number; readonly bGridY: number } | null = BODY_GRID_DEF_113C,
): number {
  if (pInventory === 0 || m.u32(pInventory) !== INV_SIGNATURE_113C) return 0
  const nGrids = m.u32(pInventory + INV_OFF_NGRIDS) | 0
  const idx = gridIdx | 0
  if (idx < 0) return 0
  if (nGrids <= idx) {
    if (pGridDef === null) return 0
    const oldGrids = m.u32(pInventory + INV_OFF_PGRIDS) >>> 0
    const newCount = (idx + 1) | 0
    const newGrids = m.alloc(newCount * 16)
    if (oldGrids !== 0 && nGrids > 0) {
      for (let i = 0; i < nGrids * 16; i++) {
        m.setU8(newGrids + i, m.u8(oldGrids + i))
      }
    }
    m.setU32(pInventory + INV_OFF_PGRIDS, newGrids)
    m.setU32(pInventory + INV_OFF_NGRIDS, newCount >>> 0)
    const pGrid = (newGrids + idx * 16) >>> 0
    const gx = pGridDef.bGridX & 0xff
    const gy = pGridDef.bGridY & 0xff
    m.setU8(pGrid + 0x08, gx)
    m.setU8(pGrid + 0x09, gy)
    const ppItems = m.alloc(gx * gy * 4)
    m.setU32(pGrid + INVGRID_OFF_PPITEMS, ppItems)
    return pGrid
  }
  const pGrids = m.u32(pInventory + INV_OFF_PGRIDS) >>> 0
  if (pGrids === 0) return 0
  const pGrid = (pGrids + idx * 16) >>> 0
  if (m.u32(pGrid + INVGRID_OFF_PPITEMS) === 0) {
    if (pGridDef === null) return 0
    const gx = pGridDef.bGridX & 0xff
    const gy = pGridDef.bGridY & 0xff
    m.setU8(pGrid + 0x08, gx)
    m.setU8(pGrid + 0x09, gy)
    const ppItems = m.alloc(gx * gy * 4)
    m.setU32(pGrid + INVGRID_OFF_PPITEMS, ppItems)
  }
  if (pGridDef !== null) {
    const gx = (m.u8(pGrid + 0x08) << 24) >> 24
    const gy = (m.u8(pGrid + 0x09) << 24) >> 24
    if (gx !== pGridDef.bGridX || gy !== pGridDef.bGridY) return 0
  }
  return pGrid
}

/**
 * `@va D2Common:0x6FD6E670` (`D2Common.#11139` `INVENTORY_GetItemFromBodyLoc` -> `0x6FD6E1B0`):
 * Validates `pInventory` (`dwSignature == 0x01020304`), bounds-checks `0 <= bodyLoc < 13`
 * (`0x6FD6E690: cmp edi, 0x0D`), resolves grid `0` (`0x6FDED378`: `13x1`) via `0x6FD6E1B0`,
 * and returns `pGrid0->ppItems (+0x0C)[bodyLoc]`.
 */
export function INVENTORY_GetItemFromBodyLoc113c(
  m: Memory113c,
  pInventory: number,
  bodyLoc: number,
): number {
  if (pInventory === 0 || m.u32(pInventory) !== INV_SIGNATURE_113C) return 0
  const loc = bodyLoc | 0
  if (loc < 0 || loc >= BODYLOC_COUNT_113C) return 0
  const pGrid0 = INVENTORY_GetOrInitGrid113c(m, pInventory, 0, BODY_GRID_DEF_113C)
  if (pGrid0 === 0) return 0
  const ppItems = m.u32(pGrid0 + INVGRID_OFF_PPITEMS)
  if (ppItems === 0) return 0
  return m.u32(ppItems + loc * 4)
}

/**
 * `@va D2Common:0x6FD70320` (`INVENTORY_GetCompositWeapon`):
 * Checks `pInventory->dwWeaponId (+0x1C) != -1`, then inspects `BODYLOC_LARM (5)` and
 * `BODYLOC_RARM (4)` for a weapon (`ITEMS_CheckItemTypeId(pItem, 45) != 0`) whose
 * `dwUnitId (+0x0C) == dwWeaponId`.
 */
export function INVENTORY_GetCompositWeapon113c(m: Memory113c, pInventory: number): number {
  if (pInventory === 0 || m.u32(pInventory) !== INV_SIGNATURE_113C) return 0
  const weaponId = m.u32(pInventory + INV_OFF_DWWEAPONID) | 0
  if (weaponId === -1) return 0
  const pLeft = INVENTORY_GetItemFromBodyLoc113c(m, pInventory, BODYLOC_LARM)
  if (
    pLeft !== 0 &&
    ITEMS_CheckItemTypeId113c(m, pLeft, ITYPE_WEAPON_113C) !== 0 &&
    m.get(pLeft, D2UnitStrc.dwUnitId) === (weaponId >>> 0)
  ) {
    return pLeft
  }
  const pRight = INVENTORY_GetItemFromBodyLoc113c(m, pInventory, BODYLOC_RARM)
  if (
    pRight !== 0 &&
    ITEMS_CheckItemTypeId113c(m, pRight, ITYPE_WEAPON_113C) !== 0 &&
    m.get(pRight, D2UnitStrc.dwUnitId) === (weaponId >>> 0)
  ) {
    return pRight
  }
  return 0
}

/**
 * `@va D2Common:0x6FD70700` (`D2Common.#10101` `INVENTORY_GetActiveWeapon`):
 * Checks `BODYLOC_RARM (4)` then `BODYLOC_LARM (5)` via `0x6FD6E1B0`, returning the first item
 * that passes `#11006` (`ITEMS_CheckNotBrokenOrUnequipping`) and `#10744(pItem, 45)` (`ITYPE_WEAPON`).
 */
export function INVENTORY_GetActiveWeapon113c(m: Memory113c, pInventory: number): number {
  if (pInventory === 0 || m.u32(pInventory) !== INV_SIGNATURE_113C) return 0
  const pRight = INVENTORY_GetItemFromBodyLoc113c(m, pInventory, BODYLOC_RARM)
  if (
    pRight !== 0 &&
    ITEMS_CheckNotBrokenOrUnequipping113c(m, pRight) !== 0 &&
    ITEMS_CheckItemTypeId113c(m, pRight, ITYPE_WEAPON_113C) !== 0
  ) {
    return pRight
  }
  const pLeft = INVENTORY_GetItemFromBodyLoc113c(m, pInventory, BODYLOC_LARM)
  if (
    pLeft !== 0 &&
    ITEMS_CheckNotBrokenOrUnequipping113c(m, pLeft) !== 0 &&
    ITEMS_CheckItemTypeId113c(m, pLeft, ITYPE_WEAPON_113C) !== 0
  ) {
    return pLeft
  }
  return 0
}

/**
 * `@va D2Common:0x6FD70830` (`D2Common.#10062` `INVENTORY_GetWeaponByHandSlot`):
 * For dual-wielding skill weapon selection (`bWeapSel` in `Skills.txt` `+0x168`):
 * - `slotCode == 5` (primary hand): prefers the arm matching `0x6FD70320(pInventory)`.
 * - `slotCode == 6` (secondary hand): prefers the opposite arm from `0x6FD70320(pInventory)`.
 */
export function INVENTORY_GetWeaponByHandSlot113c(
  m: Memory113c,
  pInventory: number,
  slotCode: number,
): number {
  if (pInventory === 0 || m.u32(pInventory) !== INV_SIGNATURE_113C) return 0
  const pRight = INVENTORY_GetItemFromBodyLoc113c(m, pInventory, BODYLOC_RARM)
  const pLeft = INVENTORY_GetItemFromBodyLoc113c(m, pInventory, BODYLOC_LARM)
  let first: number
  let second: number
  if (slotCode === 5) {
    if (pLeft !== 0 && pLeft === INVENTORY_GetCompositWeapon113c(m, pInventory)) {
      first = pLeft
      second = pRight
    } else {
      first = pRight
      second = pLeft
    }
  } else if (slotCode === 6) {
    if (pRight !== 0 && pRight === INVENTORY_GetCompositWeapon113c(m, pInventory)) {
      first = pLeft
      second = pRight
    } else {
      first = pRight
      second = pLeft
    }
  } else {
    return 0
  }
  if (
    first !== 0 &&
    ITEMS_CheckNotBrokenOrUnequipping113c(m, first) !== 0 &&
    ITEMS_CheckItemTypeId113c(m, first, ITYPE_WEAPON_113C) !== 0
  ) {
    return first
  }
  if (
    second !== 0 &&
    ITEMS_CheckNotBrokenOrUnequipping113c(m, second) !== 0 &&
    ITEMS_CheckItemTypeId113c(m, second, ITYPE_WEAPON_113C) !== 0
  ) {
    return second
  }
  return 0
}

export const DATATABLES_OFF_MONSTATS_COUNT_113C = 0x0a80
export const STATLIST_FLAG_EXTENDED_113C = 0x80000000

/**
 * `@va D2Common:0x6FD9F640` (`D2Common.#10804` `SKILLS_GetWeaponMasteryBonus`):
 * Scans `pUnit->pStatListEx->pFullStat (+0x48, wFullStatCount +0x4C)` for entries whose `wStatId`
 * matches `342/343/344` (`passive_mastery_melee_th/dmg/crit`) or
 * `345/346/347` (`passive_mastery_throw_th/dmg/crit` when `bIsThrowing != 0`) and whose
 * `wParam` (`ItemTypes.bin` index) matches `ITEMS_CheckItemTypeId113c(m, pWeapon, wParam) != 0`,
 * returning the maximum `dwValue`.
 */
export function SKILLS_GetWeaponMasteryBonus113c(
  m: Memory113c,
  pUnit: number,
  pWeapon: number,
  pSkill: number,
  nBonusType: 0 | 1 | 2,
): number {
  if (pUnit === 0 || pWeapon === 0 || m.get(pWeapon, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 0
  const effSkill = pSkill !== 0 ? pSkill : SKILLS_GetUsedSkill113c(m, pUnit)
  let isThrowing = false
  if (effSkill !== 0) {
    const pSkillsTxt = m.u32(effSkill)
    if (
      pSkillsTxt !== 0 &&
      (m.u8(pSkillsTxt + 0x05) & 0x20) !== 0 &&
      ITEMS_CheckItemTypeId113c(m, pWeapon, ITYPE_THROWING_WEAPON_113C) !== 0
    ) {
      isThrowing = true
    }
  }
  let targetStatId: number
  if (nBonusType === 0) {
    targetStatId = isThrowing
      ? STAT_PASSIVE_WEAPON_MASTERY_THROW_TH
      : STAT_PASSIVE_WEAPON_MASTERY_MELEE_TH
  } else if (nBonusType === 1) {
    targetStatId = isThrowing
      ? STAT_PASSIVE_WEAPON_MASTERY_THROW_DMG
      : STAT_PASSIVE_WEAPON_MASTERY_MELEE_DMG
  } else {
    targetStatId = isThrowing
      ? STAT_PASSIVE_WEAPON_MASTERY_THROW_CRIT
      : STAT_PASSIVE_WEAPON_MASTERY_MELEE_CRIT
  }

  const pListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pListEx === 0 || (m.get(pListEx, D2StatListExStrc.dwFlags) & 0x80000000) === 0) return 0
  const pFullStat = m.get(pListEx, D2StatListExStrc.pFullStat)
  const nFullCount = m.get(pListEx, D2StatListExStrc.wFullStatCount)
  if (pFullStat === 0 || nFullCount <= 0) return 0

  let best = 0
  for (let i = 0; i < nFullCount; i++) {
    const entryAddr = pFullStat + i * 8
    const wStatId = m.u16(entryAddr + 2)
    if (wStatId !== targetStatId) continue
    const wParam = m.u16(entryAddr)
    if (ITEMS_CheckItemTypeId113c(m, pWeapon, wParam) !== 0) {
      const val = m.u32(entryAddr + 4) | 0
      if (val > best) best = val
    }
  }
  return best
}

/**
 * `@va D2Common:0x6FD8C390` (`D2Common.#10057` `DUNGEON_CheckRoomIsTown` -> `0x6FD7D320`):
 * Reads `pRoom->pRoomEx (+0x10)->pLevel (+0x58)->dwLevelNo (+0x1D0)` and checks if `levelId`
 * is one of the 5 Act town levels (`{1, 40, 75, 103, 109}`).
 */
export function DUNGEON_CheckRoomIsTown113c(m: Memory113c, pRoom: number): number {
  if (pRoom === 0) return 0
  const pRoomEx = m.get(pRoom, D2ActiveRoomStrc.pRoomEx)
  if (pRoomEx === 0) return 0
  const pLevel = m.get(pRoomEx, D2RoomExStrc.pLevel)
  if (pLevel === 0) return 0
  const levelId = m.u32(pLevel + LEVEL_OFF_DWLEVELNO) | 0
  return levelId === 1 || levelId === 40 || levelId === 75 || levelId === 103 || levelId === 109
    ? 1
    : 0
}

function getCharStatsByClassId113c(classId: number): CharStatsPure113c {
  return getCharStatsPure113c(classId)
}

/** `[phase, evType, unitType, unitId, animMode]` record emitted in `a1c-ord-f785.ndjson.gz`. */
export type OrdEventTuple113c = readonly [
  phase: number,
  evType: number,
  unitType: number,
  unitId: number,
  animMode: number,
]

export interface MemdumpBlock113c {
  readonly n: string
  readonly a: number
  readonly h: string
}

export interface MemdumpUnitEntry113c {
  readonly type: number
  readonly id: number
  readonly blocks: readonly MemdumpBlock113c[]
}

export interface MemdumpSnapshot113c {
  readonly frame: number
  readonly mem: readonly MemdumpUnitEntry113c[]
}

export interface SlicePathCollisionGrid113c {
  get(x: number, y: number): number
  set(x: number, y: number, value: number): void
}

export interface MutablePathRoom113c {
  readonly ptr: number
  readonly subX: number
  readonly subY: number
  readonly subW: number
  readonly subH: number
  readonly isTown: boolean
  adjacentRooms: readonly unknown[]
  readonly grid: SlicePathCollisionGrid113c
}

export interface MutablePathUnit113c {
  readonly pUnit: number
  readonly pPath: number
  readonly dwUnitType: number
  readonly dwClassId: number
  readonly dwUnitId: number
  dwAnimMode: number
  dwFlags: number
  dwFlagEx: number
  readonly pDynamicPath?: unknown
  readonly pStaticPath?: unknown
  readonly objectTxt?: unknown
}

export interface FallenSliceWorld113c {
  readonly m: Memory113c
  readonly pGame: number
  readonly pTimer: number
  readonly unitsByKey: Map<string, number>
  readonly monsterById: Map<number, number>
  readonly playerById: Map<number, number>
  readonly clientById?: ReadonlyMap<number, number>
  readonly pathUnitByPtr: Map<number, MutablePathUnit113c>
  readonly roomByPtr: Map<number, MutablePathRoom113c>
  readonly minionIdsByLeaderId: Map<number, number[]>
  readonly lastFrameOrd: OrdEventTuple113c[]
  readonly lastFrameDmg: Array<{
    readonly att: readonly [number, number]
    readonly def: readonly [number, number]
    readonly ret: number
  }>
}

function unitKey(type: number, id: number): string {
  return `${type}:${id}`
}

function decodeHexBytes113c(hex: string): Uint8Array {
  const len = hex.length >>> 1
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function stepUnitSeed(m: Memory113c, pUnit: number): D2SeedStrc {
  const s = UNITS_GetSeed113c(m, pUnit)
  seedNext(s)
  UNITS_SetSeed113c(m, pUnit, s.lo, s.hi)
  return s
}

function rollUnitLimited(m: Memory113c, pUnit: number, limit: number): number {
  const s = UNITS_GetSeed113c(m, pUnit)
  const v = seedRoll(s, limit)
  UNITS_SetSeed113c(m, pUnit, s.lo, s.hi)
  return v
}

function writeUnitAnimState113c(
  m: Memory113c,
  pUnit: number,
  dwFrame0x40: number,
  dwFrame0x44: number,
  dwFrameCount0x48: number,
  wAnimSpeed: number,
  wActionFrame: number,
): void {
  m.setU32(pUnit + 0x40, dwFrame0x40 >>> 0)
  m.setU32(pUnit + 0x44, dwFrame0x44 >>> 0)
  m.setU32(pUnit + 0x48, dwFrameCount0x48 >>> 0)
  m.set(pUnit, D2UnitStrc.wAnimSpeed, wAnimSpeed & 0xffff)
  m.set(pUnit, D2UnitStrc.wActionFrame, wActionFrame & 0xffff)
}

function ensureSliceWorldPathMemory113c(world: FallenSliceWorld113c): void {
  const { m } = world
  ensureD2CommonPathGlobals113c(m)
  for (const [rPtr, roomObj] of world.roomByPtr) {
    if (m.u32((rPtr + 0x20) >>> 0) === 0) {
      bindRoomCollisionGrid113c(
        m,
        rPtr,
        roomObj.subX,
        roomObj.subY,
        roomObj.subW,
        roomObj.subH,
        (x, y) => roomObj.grid.get(x, y),
      )
    }
  }
}

export function syncDynamicPathFromMem113c(
  world: FallenSliceWorld113c,
  pu: MutablePathUnit113c,
): void {
  const { m } = world
  pu.dwAnimMode = m.get(pu.pUnit, D2UnitStrc.dwAnimMode)
  pu.dwFlags = m.get(pu.pUnit, D2UnitStrc.dwFlags)
  pu.dwFlagEx = m.get(pu.pUnit, D2UnitStrc.dwFlags2)
}

export function syncDynamicPathToMem113c(
  world: FallenSliceWorld113c,
  pu: MutablePathUnit113c,
): void {
  const { m } = world
  m.set(pu.pUnit, D2UnitStrc.dwFlags, pu.dwFlags >>> 0)
  m.set(pu.pUnit, D2UnitStrc.dwFlags2, pu.dwFlagEx >>> 0)
}

export function getUnitPosSubtile113c(m: Memory113c, pUnit: number): { x: number; y: number } {
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath === 0) return { x: 0, y: 0 }
  return {
    x: m.get(pPath, D2DynamicPathStrc.wPosX),
    y: m.get(pPath, D2DynamicPathStrc.wPosY),
  }
}

function getMonStatsRow113c(m: Memory113c, pMonster: number): MonStatsRow113c {
  const classId = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  const row = getMonStatsRowByClassId113c(classId)
  if (row === undefined) {
    throw new RangeError(`Missing MonStats.bin row for classId=${classId}`)
  }
  return row
}

/**
 * Difficulty index resolution (`0x6FC94EA4` inside `MONSTER_StartNeutral` `0x6FC94E60`):
 * Classic (`bExpansion == 0 && dwGameType == 0`) uses column `0` for `aidel`/`aidist`/`aip` tables;
 * Expansion clamps `nDifficulty` into `0..2`.
 */
function getDifficultyIdx113c(m: Memory113c, pGame: number): 0 | 1 | 2 {
  const d = m.get(pGame, D2GameStrc.nDifficulty) & 0xff
  return d >= 2 ? 2 : d === 1 ? 1 : 0
}

export const MONSTER_StepContinuousMove113c = MONSTER_StepWalk113c

export function runMonsterAiDriver113c(
  world: FallenSliceWorld113c,
  pMonster: number,
  pfnThink: number,
): void {
  AI_DispatchTargetByAiFlag113c(world, pMonster, pfnThink)
}

/**
 * Computes exact 1.13c melee/physical hit chance (`[5, 95]`) inside `0x6FCFDE90` (`SUNITDMG_CheckToHit`)
 * from `CharStats.toHitFactor`, `STAT_DEXTERITY (2)`, `STAT_TOHIT (19)`, `STAT_ITEM_TOHIT_PERCENT (119)`,
 * `STAT_ARMORCLASS (31)`, `alvl`, and `dlvl`.
 */
export function SUNITDMG_ComputeHitChance113c(
  m: Memory113c,
  _pGame: number,
  pAttacker: number,
  pDefender: number,
  arBonus = 0,
): number {
  const attType = m.get(pAttacker, D2UnitStrc.dwUnitType)
  const defType = m.get(pDefender, D2UnitStrc.dwUnitType)

  // 0x6FCFDF1A..0x6FCFDF2B: `D2Common.#10519(pAttacker, 12, 0)` and `D2Common.#10519(pDefender, 12, 0)`
  const alvl = STATLIST_GetUnitStat113c(m, pAttacker, STAT_LEVEL, 0) | 0
  const dlvl = STATLIST_GetUnitStat113c(m, pDefender, STAT_LEVEL, 0) | 0

  let ar: number
  if (attType === UNIT_PLAYER) {
    const classId = m.get(pAttacker, D2UnitStrc.dwClassId) >>> 0
    const charStats = getCharStatsByClassId113c(classId)
    const dex = STATLIST_GetUnitStat113c(m, pAttacker, STAT_DEXTERITY, 0) | 0
    const flatToHit = STATLIST_GetUnitStat113c(m, pAttacker, STAT_TOHIT, 0) | 0
    const baseAr = (dex * 5 - 35 + charStats.toHitFactor + flatToHit) | 0
    // 0x6FCFDFD0..0x6FCFE00A: add weapon mastery AR% via `D2Common.#10804(pAttacker, pWeapon, 0, 0)`
    const pWeapon = PLAYER_GetEquippedWeapon113c(m, pAttacker)
    const masteryArPct = SKILLS_GetWeaponMasteryBonus113c(m, pAttacker, pWeapon, 0, 0)
    const arPct =
      (STATLIST_GetUnitStat113c(m, pAttacker, STAT_ITEM_TOHIT_PERCENT, 0) +
        arBonus +
        masteryArPct) |
      0
    ar = arPct !== 0 ? (baseAr + mulDiv113c(arPct, baseAr, 100)) | 0 : baseAr
  } else if (attType === UNIT_MONSTER) {
    // 0x6FCFE045..0x6FCFE070: `baseAr = stat19 + 5 * dex + arBonus`, scaled by `stat 119` (`item_tohit_percent`)
    const dex = STATLIST_GetUnitStat113c(m, pAttacker, STAT_DEXTERITY, 0) | 0
    const statToHit = STATLIST_GetUnitStat113c(m, pAttacker, STAT_TOHIT, 0) | 0
    const baseAr = (statToHit + dex * 5 + arBonus) | 0
    const arPct = STATLIST_GetUnitStat113c(m, pAttacker, STAT_ITEM_TOHIT_PERCENT, 0) | 0
    ar = arPct !== 0 ? (baseAr + mulDiv113c(arPct, baseAr, 100)) | 0 : baseAr
  } else {
    ar = STATLIST_GetUnitStat113c(m, pAttacker, STAT_TOHIT, 0) | 0
  }

  let def = 0
  if (defType === UNIT_PLAYER) {
    const pMode = m.get(pDefender, D2UnitStrc.dwAnimMode)
    // 0x6FCFDF66: running player (`PLRMODE_RUN == 3`) skips `dex/4 + ac` defense
    if (pMode !== PLRMODE_RUN) {
      const dex = STATLIST_GetUnitStat113c(m, pDefender, STAT_DEXTERITY, 0) | 0
      const ac = STATLIST_GetUnitStat113c(m, pDefender, STAT_ARMORCLASS, 0) | 0
      def = ((dex >> 2) + ac) | 0
    }
  } else {
    def = STATLIST_GetUnitStat113c(m, pDefender, STAT_ARMORCLASS, 0) | 0
  }

  // 0x6FCFDFA2..0x6FCFDFB8: negative `def` transfers `-def` to `ar` and clamps `def = 0`; negative `ar` transfers `-ar` to `def` and clamps `ar = 0`.
  if (def < 0) {
    ar = (ar - def) | 0
    def = 0
  }
  if (ar < 0) {
    def = (def - ar) | 0
    ar = 0
  }

  const denom = (ar + def) | 0
  const arRatio = denom > 0 ? mulDiv113c(ar, 100, denom) : 0
  const lvlSum = alvl + dlvl
  const rawChance = lvlSum > 0 ? Math.trunc((2 * alvl * arRatio) / lvlSum) | 0 : 0
  return rawChance < 5 ? 5 : rawChance > 95 ? 95 : rawChance
}

export interface D2DamageData113c {
  wResultFlags: number
  dwHitFlags: number
  dwPhysDamage: number
  dwEnhDmgPct: number
  dwBurnDamage: number
  dwSrcDam: number
}

/**
 * Slice helper for `D2Game:0x6FCFC530` (`SUNITDMG_RollPhysicalDamage` + `0x6FCFBED0`):
 * Computes 256-fixed-point physical damage from `STAT_MINDAMAGE (21)`, `STAT_MAXDAMAGE (22)`,
 * `STAT_ITEM_NORMALDAMAGE (111)`, `STAT_DAMAGEPERCENT (25)`, `STAT_MINDAMAGE_PERCENT (18)`,
 * `STAT_MAXDAMAGE_PERCENT (17)`, weapon `StrBonus` / `DexBonus` (`D2Common.#10213` / `#10120` at
 * `0x6FCFC687..0x6FCFC697`, or unarmed `strBonus = 100` when `bAddUnarmedStr` at `0x6FCFC6A7..B9`),
 * and passive weapon mastery (`D2Common.#10804(pAttacker, pWeapon, 0, 1)` at `0x6FCFC6A0`), then draws
 * `SEED_RollLimited(pAttacker->pSeed, maxScaled - minScaled)` (`0x6FCFBFA5`).
 */
export function SUNITDMG_RollPhysicalDamage113c(
  world: FallenSliceWorld113c,
  pAttacker: number,
  dmgData: D2DamageData113c,
): number {
  const { m } = world
  const attType = m.get(pAttacker, D2UnitStrc.dwUnitType)

  let min256 = (STATLIST_GetUnitStat113c(m, pAttacker, STAT_MINDAMAGE, 0) | 0) << 8
  let max256 = (STATLIST_GetUnitStat113c(m, pAttacker, STAT_MAXDAMAGE, 0) | 0) << 8
  const normDmg256 = (STATLIST_GetUnitStat113c(m, pAttacker, STAT_ITEM_NORMALDAMAGE, 0) | 0) << 8
  min256 = (min256 + normDmg256) | 0
  max256 = (max256 + normDmg256) | 0
  if (min256 < 256) min256 = 256
  if (max256 <= min256) max256 = (min256 + 256) | 0

  const minEd = STATLIST_GetUnitStat113c(m, pAttacker, STAT_MINDAMAGE_PERCENT, 0) | 0
  const maxEd = STATLIST_GetUnitStat113c(m, pAttacker, STAT_MAXDAMAGE_PERCENT, 0) | 0
  let edPct =
    (dmgData.dwEnhDmgPct + (STATLIST_GetUnitStat113c(m, pAttacker, STAT_DAMAGEPERCENT, 0) | 0)) | 0

  if (attType === UNIT_PLAYER) {
    // 0x6FCFC620..0x6FCFC6B9: look up active weapon (`0x6FC572C0`); if equipped (`pWeapon != 0`),
    // query `D2Common.#10213(pWeapon)` (`StrBonus`) / `#10120(pWeapon)` (`DexBonus`) and
    // `D2Common.#10804(pAttacker, pWeapon, 0, 1)` (`masteryDmgPct`); else if `bAddUnarmedStr`
    // (`0x6FCFC6A7..B9`), add `STAT_STRENGTH (0)`.
    const pWeapon = PLAYER_GetEquippedWeapon113c(m, pAttacker)
    if (pWeapon !== 0) {
      const strBonus = ITEMS_GetStrBonus113c(m, pWeapon)
      const dexBonus = ITEMS_GetDexBonus113c(m, pWeapon)
      const str = STATLIST_GetUnitStat113c(m, pAttacker, STAT_STRENGTH, 0) | 0
      const dex = STATLIST_GetUnitStat113c(m, pAttacker, STAT_DEXTERITY, 0) | 0
      const statBonusPct =
        (Math.trunc((str * strBonus) / 100) + Math.trunc((dex * dexBonus) / 100)) | 0
      const masteryDmgPct = SKILLS_GetWeaponMasteryBonus113c(m, pAttacker, pWeapon, 0, 1)
      edPct = (edPct + statBonusPct + masteryDmgPct) | 0
    } else {
      const str = STATLIST_GetUnitStat113c(m, pAttacker, STAT_STRENGTH, 0) | 0
      edPct = (edPct + str) | 0
    }
  }
  if (edPct < -90) edPct = -90

  // 0x6FCFBED0: scale min/max by `(minEd + edPct)` / `(maxEd + edPct)` and roll span
  let minScaled = (min256 + Math.trunc((min256 * (minEd + edPct)) / 100)) | 0
  let maxScaled = (max256 + Math.trunc((max256 * (maxEd + edPct)) / 100)) | 0
  if (minScaled < 0) minScaled = 0
  if (maxScaled < 0) maxScaled = 0

  let physDmg256 = minScaled
  if (maxScaled > minScaled) {
    physDmg256 = (minScaled + rollUnitLimited(m, pAttacker, maxScaled - minScaled)) | 0
  }
  dmgData.dwPhysDamage = physDmg256
  return physDmg256
}

/**
 * Slice helper for `D2Game:0x6FCFD450` (`SUNITDMG_RollDamageValues`):
 * Rolls physical damage (`0x6FCFC530`), critical/deadly strike (`0x6FCFD520..0x6FCFD5B4`),
 * and burn damage rounding (`0x6FCFD8F0..0x6FCFD92D`: `SEED_RollLimited(pAttacker->pSeed, 1)` at `0x6FCFD908`).
 */
export function SUNITDMG_RollDamageValues113c(
  world: FallenSliceWorld113c,
  pAttacker: number,
  pDefender: number,
  dmgData: D2DamageData113c,
): void {
  const { m } = world
  if (pAttacker === 0 || pDefender === 0) return

  SUNITDMG_RollPhysicalDamage113c(world, pAttacker, dmgData)
  const srcDam = dmgData.dwSrcDam | 0
  if (srcDam !== 128) {
    dmgData.dwPhysDamage = Math.trunc((dmgData.dwPhysDamage * srcDam) / 128) | 0
  }

  // 0x6FCFD520..0x6FCFD5B4: Weapon Mastery crit (`D2Common.#10804(pAttacker, pWeapon, 0, 2)` at `0x6FCFD53C`),
  // Critical Strike (`stat 337`), Deadly Strike (`stat 141`)
  if (dmgData.dwPhysDamage > 0) {
    let isCrit = false
    const pWeapon =
      m.get(pAttacker, D2UnitStrc.dwUnitType) === UNIT_PLAYER
        ? PLAYER_GetEquippedWeapon113c(m, pAttacker)
        : 0
    if (
      pWeapon !== 0 &&
      ITEMS_CheckItemTypeId113c(m, pWeapon, ITYPE_MELEE_WEAPON_113C) !== 0
    ) {
      const masteryCrit = SKILLS_GetWeaponMasteryBonus113c(m, pAttacker, pWeapon, 0, 2)
      if (masteryCrit > 0 && rollUnitLimited(m, pAttacker, 100) < masteryCrit) {
        isCrit = true
      }
    }
    if (!isCrit) {
      const csChance = STATLIST_GetUnitStat113c(m, pAttacker, STAT_PASSIVE_CRITICAL_STRIKE, 0) | 0
      if (csChance > 0 && rollUnitLimited(m, pAttacker, 100) < csChance) {
        isCrit = true
      }
    }
    if (!isCrit) {
      const dsChance = STATLIST_GetUnitStat113c(m, pAttacker, STAT_ITEM_DEADLYSTRIKE, 0) | 0
      if (dsChance > 0 && rollUnitLimited(m, pAttacker, 100) < dsChance) {
        isCrit = true
      }
    }
    if (isCrit) {
      dmgData.dwPhysDamage = (dmgData.dwPhysDamage << 1) | 0
      dmgData.wResultFlags |= 0x20
    }
  }

  // 0x6FCFD8F0..0x6FCFD92D: burn damage rounding (`SEED_RollLimited(pAttacker->pSeed, 1)` at `0x6FCFD908`)
  const burnScaled = (dmgData.dwBurnDamage * srcDam + 0x13c) | 0
  const burnRoll = rollUnitLimited(m, pAttacker, 1)
  const burnTotal = burnScaled + burnRoll - 0x13c
  dmgData.dwBurnDamage = burnTotal > 0 ? burnTotal >> 7 : 0
}

/**
 * Slice helper for `D2Game:0x6FCFB030` (`SUNITDMG_CheckBlockOrDodge`) + `D2Game:0x6FCFC0B0` (`SUNITDMG_ApplyResistancesAndBlock`):
 * Applies defender `STAT_DAMAGERESIST (36)` and checks defender block/dodge/avoid (`0x6FCFB030`).
 */
export function SUNITDMG_ApplyResistancesAndBlock113c(
  world: FallenSliceWorld113c,
  pDefender: number,
  dmgData: D2DamageData113c,
): void {
  const { m } = world
  if (dmgData.dwPhysDamage > 0) {
    let dmgRes = STATLIST_GetUnitStat113c(m, pDefender, STAT_DAMAGERESIST, 0) | 0
    if (dmgRes > 50) dmgRes = 50
    if (dmgRes !== 0) {
      dmgData.dwPhysDamage =
        (dmgData.dwPhysDamage - mulDiv113c(dmgData.dwPhysDamage, dmgRes, 100)) | 0
      if (dmgData.dwPhysDamage < 0) dmgData.dwPhysDamage = 0
    }
  }

  // 0x6FCFB030: check shield block (only when unit has shield in pInventory and `toblock > 0`) or dodge/avoid
  const defMode = m.get(pDefender, D2UnitStrc.dwAnimMode)
  const defType = m.get(pDefender, D2UnitStrc.dwUnitType)
  const isMovingMon = defType === UNIT_MONSTER && (defMode === 2 || defMode === 15)
  if (!isMovingMon && m.get(pDefender, D2UnitStrc.pInventory) !== 0) {
    const blockChance = STATLIST_GetUnitStat113c(m, pDefender, STAT_TOBLOCK, 0) | 0
    if (blockChance > 0 && rollUnitLimited(m, pDefender, 100) < blockChance) {
      dmgData.dwPhysDamage = 0
      dmgData.wResultFlags |= 0x10
      return
    }
  }
  const dodgeChance = STATLIST_GetUnitStat113c(m, pDefender, STAT_PASSIVE_DODGE, 0) | 0
  if (dodgeChance > 0 && rollUnitLimited(m, pDefender, 100) < dodgeChance) {
    dmgData.dwPhysDamage = 0
    dmgData.wResultFlags |= 0x80
  }
  const avoidChance = STATLIST_GetUnitStat113c(m, pDefender, STAT_PASSIVE_AVOID, 0) | 0
  if (avoidChance > 0 && rollUnitLimited(m, pDefender, 100) < avoidChance) {
    dmgData.dwPhysDamage = 0
    dmgData.wResultFlags |= 0x100
  }
}

function executeSliceDamageEvents113c(
  world: FallenSliceWorld113c,
  pAttacker: number,
  pDefender: number,
  dmgData: D2DamageData113c,
): void {
  const { m, pGame } = world
  const totalDmg = (dmgData.dwPhysDamage + dmgData.dwBurnDamage) | 0
  const oldHp = STATLIST_GetUnitStat113c(m, pDefender, STAT_HITPOINTS, 0) | 0
  const appliedDmg = totalDmg < oldHp ? totalDmg : oldHp
  let newHp = (oldHp - appliedDmg) | 0
  // 0x6FCFE255: `cmp eax, 0x100; jge ...; xor eax, eax`
  if (newHp < 0x100) newHp = 0
  STATLIST_SetUnitStat113c(m, pDefender, STAT_HITPOINTS, newHp, 0)

  if (newHp > 0 && m.get(pDefender, D2UnitStrc.dwUnitType) === UNIT_MONSTER) {
    if (STATLIST_GetUnitStat113c(m, pDefender, STAT_HPREGEN, 0) !== 0 && pGame !== 0) {
      const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
      EVENT_SetEventFull113c(m, pGame, pDefender, MON_EVENT_STAT_REGEN, (frame + 1) >>> 0, 0, 0, 0)
    }
  }

  if (oldHp > 0 && newHp <= 0) {
    dmgData.wResultFlags |= 0x02
  } else if (appliedDmg >= 0x100) {
    dmgData.wResultFlags |= 0x04
  }

  world.lastFrameDmg.push({
    att: [m.get(pAttacker, D2UnitStrc.dwUnitType), m.get(pAttacker, D2UnitStrc.dwUnitId)],
    def: [m.get(pDefender, D2UnitStrc.dwUnitType), m.get(pDefender, D2UnitStrc.dwUnitId)],
    ret: totalDmg,
  })
}

/**
 * Slice helper for `D2Game:0x6FC32EE0` (`ITEMS_RollItemDurabilityLoss`):
 * Validates that `pItem` is a weapon (`#10744(pItem, 45)`) or armor (`#10744(pItem, 50)`) with
 * `bNoDurability == 0`, `STAT_MAXDURABILITY (73) > 0`, and `STAT_ITEM_INDESTRUCTIBLE (152) == 0`;
 * if `!isArmor` and `#10711(pItem)` (`0x6FD74C30` `ITEMS_CheckIfThrowItem`) is non-zero
 * (`0x6FC32F1C..0x6FC32F35`), requires `pGame->bExpansion (+0x70) != 0` and raises `threshold`
 * from `4` to `10`; rolls `SEED_RollLimited(pOwner->pSeed, 100) < threshold` (`0x6FC32F38..0x6FC32F5E`),
 * decrements `STAT_DURABILITY (72)`, clamps to `maxDur`, and sets `ITEMFLAG_BROKEN (0x100)` on
 * `pItemData->dwFlags (+0x18)` when `curDur - 1 <= 0` (`0x6FC32F72`).
 */
export function ITEMS_RollItemDurabilityLoss113c(
  world: FallenSliceWorld113c,
  pOwner: number,
  pItem: number,
): void {
  const { m } = world
  if (pOwner === 0 || pItem === 0 || m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return
  const isArmor = ITEMS_CheckItemTypeId113c(m, pItem, ITYPE_ANY_ARMOR_113C) !== 0
  let threshold = 10
  if (!isArmor) {
    if (ITEMS_CheckItemTypeId113c(m, pItem, ITYPE_WEAPON_113C) === 0) return
    threshold = 4
    // 0x6FC32F1C..0x6FC32F35: throwing weapon check (`D2Common.#10711` `0x6FD74C30`)
    if (ITEMS_CheckIfThrowItem113c(m, pItem) !== 0) {
      if (world.pGame === 0 || m.get(world.pGame, D2GameStrc.bExpansion) === 0) return
      threshold = 10
    }
  }

  const rec = DATATBLS_GetItemsTxtRecord113c(m.get(pItem, D2UnitStrc.dwClassId))
  if (rec === null || rec.bNoDurability !== 0) return
  const maxDur = STATLIST_GetUnitBaseStat113c(m, pItem, STAT_MAXDURABILITY, 0) | 0
  if (maxDur <= 0) return
  if (STATLIST_GetUnitStat113c(m, pItem, STAT_ITEM_INDESTRUCTIBLE, 0) !== 0) return

  if (rollUnitLimited(m, pOwner, 100) >= threshold) return

  let nextDur = (STATLIST_GetUnitBaseStat113c(m, pItem, STAT_DURABILITY, 0) - 1) | 0
  if (nextDur > 0) {
    const totalMaxDur = STATLIST_GetUnitStat113c(m, pItem, STAT_MAXDURABILITY, 0) | 0
    if (nextDur > totalMaxDur) nextDur = totalMaxDur
    STATLIST_SetUnitStat113c(m, pItem, STAT_DURABILITY, nextDur, 0)
  } else {
    const pItemData = m.get(pItem, D2UnitStrc.pUnitData)
    if (pItemData !== 0) {
      m.setU32(
        pItemData + ITEMDATA_OFF_DWFLAGS,
        (m.u32(pItemData + ITEMDATA_OFF_DWFLAGS) | ITEMFLAG_BROKEN_113C) >>> 0,
      )
    }
    STATLIST_SetUnitStat113c(m, pItem, STAT_DURABILITY, 0, 0)
  }
}

/**
 * Slice helper for `D2Game:0x6FCFEBA0` (`SUNITDMG_DrainItemDurability`):
 * - Attacker branch (`0x6FCFEBAE..0x6FCFEBC4`): if `pAttacker` is a player (`uType == 0`), rolls
 *   weapon durability loss via `0x6FC32EE0(pGame, pAttacker, PLAYER_GetEquippedWeapon(pAttacker))`.
 * - Defender branch (`0x6FCFEBC6..0x6FCFED1A`): if `pDefender` is a player with `pInventory != 0`,
 *   inspects the 7 armor bodyLocs in `0x6FD2E628` (`HEAD:3, TORSO:5, RARM:4, LARM:4, BELT:2, FEET:2, GLOVES:2`)
 *   for `ITEMS_CheckItemTypeId(pItem, 50) != 0` (`ITYPE_ANY_ARMOR`); if `totalWeight > 0`, draws
 *   `startIdx = SEED_RollLimited(pDefender->pSeed, 7)` and `pick = SEED_RollLimited(pDefender->pSeed, totalWeight)`,
 *   walks circularly `(idx + 1) % 7` subtracting slot weight until `pick < slotWeight`, and calls
 *   `0x6FC32EE0(pGame, pDefender, chosenArmor)`.
 */
export function SUNITDMG_DrainItemDurability113c(
  world: FallenSliceWorld113c,
  pAttacker: number,
  pDefender = 0,
): void {
  const { m } = world
  if (pAttacker !== 0 && m.get(pAttacker, D2UnitStrc.dwUnitType) === UNIT_PLAYER) {
    const pWeapon = PLAYER_GetEquippedWeapon113c(m, pAttacker)
    if (pWeapon !== 0) {
      ITEMS_RollItemDurabilityLoss113c(world, pAttacker, pWeapon)
    }
  }
  if (pDefender !== 0 && m.get(pDefender, D2UnitStrc.dwUnitType) === UNIT_PLAYER) {
    const pInv = m.get(pDefender, D2UnitStrc.pInventory)
    if (pInv === 0) return
    const slotItems = [0, 0, 0, 0, 0, 0, 0]
    const slotWeights = [0, 0, 0, 0, 0, 0, 0]
    let totalWeight = 0
    for (let i = 0; i < ARMOR_DURABILITY_WEIGHTS_113C.length; i++) {
      const entry = ARMOR_DURABILITY_WEIGHTS_113C[i]!
      const pItem = INVENTORY_GetItemFromBodyLoc113c(m, pInv, entry.bodyLoc)
      if (pItem !== 0 && ITEMS_CheckItemTypeId113c(m, pItem, ITYPE_ANY_ARMOR_113C) !== 0) {
        slotItems[i] = pItem
        slotWeights[i] = entry.weight
        totalWeight += entry.weight
      }
    }
    if (totalWeight <= 0) return
    let idx = rollUnitLimited(m, pDefender, 7)
    let pick = rollUnitLimited(m, pDefender, totalWeight)
    while (pick >= slotWeights[idx]!) {
      pick -= slotWeights[idx]!
      idx = (idx + 1) % 7
    }
    const chosenArmor = slotItems[idx]!
    if (chosenArmor !== 0) {
      ITEMS_RollItemDurabilityLoss113c(world, pDefender, chosenArmor)
    }
  }
}

/**
 * Slice helper for `D2Game:0x6FCFCF20` (`SUNITDMG_ExecuteDamageResult`) + `0x6FCFB910` (`SUNITDMG_CheckMonsterGetHitRecovery`):
 * Rolls monster hit-reaction on `pDefender->pSeed` and transitions to `MONSTER_StartDeath113c` (`0x6FCFEEE0` -> `0x6FC96270`)
 * when `wResultFlags & 0x02` (`HITFLAG_DEATH`) is set.
 */
export function SUNITDMG_ExecuteDamageResult113c(
  world: FallenSliceWorld113c,
  pAttacker: number,
  pDefender: number,
  dmgData: D2DamageData113c,
): void {
  const { m } = world
  if (m.get(pDefender, D2UnitStrc.dwUnitType) === UNIT_MONSTER) {
    stepUnitSeed(m, pDefender)
  }
  if ((dmgData.wResultFlags & 0x02) !== 0) {
    MONSTER_StartDeath113c(world, pDefender, pAttacker)
  }
}

/**
 * Slice helper for `D2Game:0x6FCFE5A0` (`SUNITDMG_ExecuteMissileOrMeleeDmg`):
 * Top-level 1.13c melee/missile combat execution pipeline (`0x6FCFE5A0` -> `0x6FCFDE90` -> `0x6FCFD450`
 * -> `0x6FCFC0B0` -> `0x6FCFE0C0` -> `0x6FCFEBA0` -> `0x6FCFCF20`).
 */
export function SUNITDMG_ExecuteMissileOrMeleeDmg113c(
  world: FallenSliceWorld113c,
  pAttacker: number,
  pDefender: number,
  arBonus = 0,
  enhDmgPct = 0,
): boolean {
  const { m, pGame } = world
  if (pAttacker === 0 || pDefender === 0) return false

  // 0x6FCFE5F1: running player (`defType == 0 && defMode == 3`) auto-hits without calling `0x6FCFDE90`
  const defType = m.get(pDefender, D2UnitStrc.dwUnitType)
  const isRunningPlayer =
    defType === UNIT_PLAYER && m.get(pDefender, D2UnitStrc.dwAnimMode) === PLRMODE_RUN
  if (!isRunningPlayer && SUNITDMG_CheckToHit113c(m, pGame, pAttacker, pDefender, arBonus) === 0) {
    return false
  }

  const dmgData: D2DamageData113c = {
    wResultFlags: 0x01,
    dwHitFlags: 0x20,
    dwPhysDamage: 0,
    dwEnhDmgPct: enhDmgPct,
    dwBurnDamage: 0,
    dwSrcDam: 128,
  }
  SUNITDMG_RollDamageValues113c(world, pAttacker, pDefender, dmgData)
  SUNITDMG_ApplyResistancesAndBlock113c(world, pDefender, dmgData)
  executeSliceDamageEvents113c(world, pAttacker, pDefender, dmgData)
  SUNITDMG_DrainItemDurability113c(world, pAttacker, pDefender)
  SUNITDMG_ExecuteDamageResult113c(world, pAttacker, pDefender, dmgData)
  return true
}

function resolvePlayerWeaponClass113c(world: FallenSliceWorld113c, pPlayer: number): string {
  const { m } = world
  const pWeapon = PLAYER_GetEquippedWeapon113c(m, pPlayer)
  if (pWeapon !== 0) {
    const rec = DATATBLS_GetItemsTxtRecord113c(m.get(pWeapon, D2UnitStrc.dwClassId))
    if (rec !== null && rec.wclass.length > 0) return rec.wclass
  }
  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  return getCharStatsByClassId113c(classId).baseWClass
}

/**
 * Hydrate a complete `FallenSliceWorld113c` directly from `a1c-memdump-f785.ndjson.gz` and
 * `a1c-coll-f785.bin.gz` in `SparseMemory113c` (with zero legacy dependencies).
 */
export function hydrateFallenSliceFromMemdump113c(
  m: Memory113c,
  snapshot: MemdumpSnapshot113c,
  collRaw: Uint8Array,
): FallenSliceWorld113c {
  let pGame = 0
  let pTimer = 0
  const unitsByKey = new Map<string, number>()
  const monsterById = new Map<number, number>()
  const playerById = new Map<number, number>()
  const roomPtrs = new Set<number>()

  for (const uEntry of snapshot.mem) {
    let pUnit = 0
    for (const blk of uEntry.blocks) {
      const bytes = decodeHexBytes113c(blk.h)
      const baseAddr = blk.a >>> 0
      for (let i = 0; i < bytes.length; i++) {
        m.setU8((baseAddr + i) >>> 0, bytes[i]!)
      }
      if (blk.n === 'game') {
        if (pGame === 0 && bytes.length < D2GameStrc_SIZE) {
          for (let i = bytes.length; i < D2GameStrc_SIZE; i++) {
            m.setU8((baseAddr + i) >>> 0, 0)
          }
        }
        pGame = baseAddr
      } else if (blk.n === 'timer') pTimer = baseAddr
      else if (blk.n === 'unit') pUnit = baseAddr
      else if (blk.n === 'itemunit') {
        const iType = m.get(baseAddr, D2UnitStrc.dwUnitType)
        const iId = m.get(baseAddr, D2UnitStrc.dwUnitId)
        unitsByKey.set(unitKey(iType, iId), baseAddr)
      } else if (blk.n === 'room' || blk.n === 'adjroom' || blk.n === 'nearroom') {
        roomPtrs.add(baseAddr)
      } else if (blk.n === 'childstatlist' && bytes.length < D2StatListExStrc_SIZE) {
        for (let i = bytes.length; i < D2StatListExStrc_SIZE; i++) {
          m.setU8((baseAddr + i) >>> 0, 0)
        }
      }
    }
    if (pUnit !== 0) {
      unitsByKey.set(unitKey(uEntry.type, uEntry.id), pUnit)
      if (uEntry.type === UNIT_MONSTER) monsterById.set(uEntry.id, pUnit)
      else if (uEntry.type === UNIT_PLAYER) playerById.set(uEntry.id, pUnit)
    }
  }

  m.set(pGame, D2GameStrc.dwGameFrame, snapshot.frame >>> 0)
  // `a1c-memdump-f785` does not dump `D2ActStrc`, `pMonRegRoomNodes`, `pQuestCtrl`, or tail controllers.
  m.fill((pGame + 0xbc) >>> 0, 20, 0)
  m.fill((pGame + 0xd8) >>> 0, 20, 0)
  m.setU32((pGame + 0x10f4) >>> 0, 0)
  m.fill((pGame + 0x1d00) >>> 0, 0x38, 0)
  // Populate `pGame->pUnitHash` (`+0x1120`) player hash buckets and `clientById` (`pPlayerData+0x9C -> pClient+0x00`)
  const clientById = new Map<number, number>()
  for (const pUnit of playerById.values()) {
    const uId = m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0
    m.set(pGame, D2GameStrc.pUnitHash, pUnit, uId & 0x7f)
    const pPlrData = m.get(pUnit, D2UnitStrc.pUnitData) >>> 0
    if (pPlrData !== 0) {
      m.setU32((pPlrData + 0x44) >>> 0, 0)
      const pClient = m.u32(pPlrData + 0x9c) >>> 0
      if (pClient !== 0) {
        const dwClientId = m.u32(pClient) >>> 0
        clientById.set(dwClientId, pUnit)
      }
    }
  }
  // Rebind `pTimer->pPool` to a live `0x7088` chunk in `SparseMemory113c`
  m.set(pTimer, D2TimerStrc.pPool, 0)
  EVENT_AllocChunk113c(m, pTimer)
  ensureD2CommonPathGlobals113c(m)

  // Parse `a1c-coll-f785.bin.gz`: header `(x0, y0, w, h)` + `uint16[w * h]` at byte 16
  const collView = new DataView(collRaw.buffer, collRaw.byteOffset, collRaw.byteLength)
  const cx0 = collView.getUint32(0, true)
  const cy0 = collView.getUint32(4, true)
  const cw = collView.getUint32(8, true)
  const ch = collView.getUint32(12, true)
  const maskCells = new Uint16Array(cw * ch)
  for (let i = 0; i < cw * ch; i++) {
    maskCells[i] = collView.getUint16(16 + i * 2, true)
  }

  const sharedGrid: SlicePathCollisionGrid113c = {
    get(x: number, y: number): number {
      const rx = (x | 0) - cx0
      const ry = (y | 0) - cy0
      if (rx < 0 || ry < 0 || rx >= cw || ry >= ch) return COLLIDE_MASK_INVALID_113C
      return maskCells[ry * cw + rx]!
    },
    set(x: number, y: number, value: number): void {
      const rx = (x | 0) - cx0
      const ry = (y | 0) - cy0
      if (rx < 0 || ry < 0 || rx >= cw || ry >= ch) return
      maskCells[ry * cw + rx] = value & 0xffff
    },
  }

  // Bind native `D2RoomCollisionGridStrc` (`+0x20`) in `Memory113c` for every dumped room
  const roomByPtr = new Map<number, MutablePathRoom113c>()
  for (const rPtr of roomPtrs) {
    const subX = m.get(rPtr, D2ActiveRoomStrc.nSubtileX) | 0
    const subY = m.get(rPtr, D2ActiveRoomStrc.nSubtileY) | 0
    const subW = m.get(rPtr, D2ActiveRoomStrc.nSubtileWidth) | 0
    const subH = m.get(rPtr, D2ActiveRoomStrc.nSubtileHeight) | 0
    bindRoomCollisionGrid113c(m, rPtr, subX, subY, subW, subH, (x, y) => sharedGrid.get(x, y))
    roomByPtr.set(rPtr, {
      ptr: rPtr,
      subX,
      subY,
      subW,
      subH,
      isTown: DUNGEON_CheckRoomIsTown113c(m, rPtr) !== 0,
      adjacentRooms: [],
      grid: sharedGrid,
    })
  }
  for (const [rPtr, roomObj] of roomByPtr) {
    const ppRoomsNear = m.get(rPtr, D2ActiveRoomStrc.ppRoomsNear) >>> 0
    const nRoomsNear = m.get(rPtr, D2ActiveRoomStrc.nRoomsNear) >>> 0
    const adjList: MutablePathRoom113c[] = []
    if (ppRoomsNear !== 0 && nRoomsNear <= 32) {
      for (let i = 0; i < nRoomsNear; i++) {
        const nearPtr = m.u32(ppRoomsNear + i * 4) >>> 0
        if (nearPtr === 0 || nearPtr === rPtr) continue
        const adj = roomByPtr.get(nearPtr)
        if (adj !== undefined) adjList.push(adj)
      }
    }
    roomObj.adjacentRooms = adjList
  }

  // Normalize Wine `D2Game.dll` (`0x01990000`) `pfnThink` VAs to `0x6FC20000` and build minion lists
  const minionIdsByLeaderId = new Map<number, number[]>()
  for (const [monId, pMon] of monsterById) {
    const pMonData = m.get(pMon, D2UnitStrc.pUnitData)
    if (pMonData === 0) continue
    const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
    if (pAiGen === 0) continue
    const rawThink = m.get(pAiGen, D2AiGeneralStrc.pfnThink) >>> 0
    if (rawThink !== 0 && ((rawThink - 0x83130) & 0xffff) === 0) {
      m.set(pAiGen, D2AiGeneralStrc.pfnThink, VA_AI_FALLEN_113C)
    } else if (rawThink !== 0 && ((rawThink - 0x838b0) & 0xffff) === 0) {
      m.set(pAiGen, D2AiGeneralStrc.pfnThink, VA_AI_ZOMBIE_113C)
    }
    m.set(pAiGen, D2AiGeneralStrc.pCommandHead, 0)
    m.set(pAiGen, D2AiGeneralStrc.pCommandTail, 0)

    const pGroup = m.get(pAiGen, D2AiGeneralStrc.pGroup)
    const leaderId = m.get(pAiGen, D2AiGeneralStrc.dwLeaderId)
    const leaderType = m.get(pAiGen, D2AiGeneralStrc.dwLeaderType)
    if (pGroup !== 0 && leaderType === 1 && leaderId !== monId) {
      let list = minionIdsByLeaderId.get(leaderId)
      if (list === undefined) {
        list = []
        minionIdsByLeaderId.set(leaderId, list)
      }
      list.unshift(monId) // `0x6FC40CF0` prepends newest spawned minion first
    }
  }

  const pathUnitByPtr = new Map<number, MutablePathUnit113c>()
  for (const pUnit of unitsByKey.values()) {
    if (m.get(pUnit, D2UnitStrc.dwUnitType) === UNIT_ITEM) continue
    const pPath = m.get(pUnit, D2UnitStrc.pPath)
    const pu: MutablePathUnit113c = {
      pUnit,
      pPath,
      dwUnitType: m.get(pUnit, D2UnitStrc.dwUnitType),
      dwClassId: m.get(pUnit, D2UnitStrc.dwClassId),
      dwUnitId: m.get(pUnit, D2UnitStrc.dwUnitId),
      dwAnimMode: m.get(pUnit, D2UnitStrc.dwAnimMode),
      dwFlags: m.get(pUnit, D2UnitStrc.dwFlags),
      dwFlagEx: m.get(pUnit, D2UnitStrc.dwFlags2),
    }
    pathUnitByPtr.set(pUnit, pu)
  }

  const world: FallenSliceWorld113c = {
    m,
    pGame,
    pTimer,
    unitsByKey,
    monsterById,
    playerById,
    clientById,
    pathUnitByPtr,
    roomByPtr,
    minionIdsByLeaderId,
    lastFrameOrd: [],
    lastFrameDmg: [],
  }
  return world
}
