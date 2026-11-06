/**
 * Diablo II v1.13c Pure Kernel Vertical Slice:
 * - `D2ActiveRoomStrc` death ring (`D2Common.#10873` `0x6FD8AFD0`)
 * - `D2DynamicPathStrc` (`0x200` bytes) memory-backed bridge to `D2Common.dll` path ordinals (`src/common/path/`)
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
  D2TimerStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import { seedNext, seedRoll, type D2SeedStrc } from '../prng.ts'
import { mulDiv113c } from '../common/int-math.ts'
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
  UNITROOM_RefreshUnit113c,
  UNITS_GetRoom113c,
  UNITS_GetSeed113c,
  UNITS_SetSeed113c,
} from '../common/unit.ts'
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
  COLLIDE_MASK_INVALID,
  D2COMMON_10170_PathSetTargetPos,
  D2Common_10142,
  D2Common_10226,
  D2Common_10399,
  DynamicPath,
  PATHTYPE_TOWARD_FINISH,
  PATHTYPE_WALL_FOLLOW,
  PATH_ComputeDirection,
  PATH_SetDirection,
  PATH_SetDistance,
  PATH_SetNewDistance,
  PATH_SetStepNum,
  PATH_SetTargetUnit,
  PATH_SetType,
  PATH_SetUnitDeadCollision,
  PATH_SetVelocity,
  getMonsterModeBaseFrameCount113c,
  getMonsterPathRecord,
  toFP16Center,
  type PathCollisionGrid,
  type PathRoom,
  type PathUnit,
} from '../../common/path/index.ts'
import {
  MONLVL_113C_ROWS,
  MONSTATS_113C_ROWS,
  type MonStats113cRow,
} from '../../common/units/monstats-113c-data.ts'
import {
  CANONICAL_CHARSTATS,
  CHARACTER_CLASS_CODES,
  type CharacterClassStats,
} from '../../common/units/classes.ts'
import {
  computeFrwDiminishing113c,
  computeRawPlayerAnimSpeed113c,
  getCharAnimClip113c,
  playerAnimStartFrame113c,
  type CharAnimClip113c,
} from '../../common/units/char-anim-speed.ts'
import { calculateKillExperienceGain113c } from '../../common/progression/experience-113c.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import {
  RAW_ARMOR,
  RAW_ITEM_TYPES,
  RAW_MISC,
  RAW_TC_EX,
  RAW_WEAPONS,
} from '../../common/data/canonical-drop-data.ts'
import { parseTable } from '../../common/world/acts.ts'
import { parseTreasureClassTable, type TreasureClassTable } from '../../common/items/treasure-class.ts'
import { rollTreasureClass } from '../../common/items/treasure-engine.ts'

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

interface ItemTypeClosure113c {
  readonly codeToIndex: ReadonlyMap<string, number>
  readonly ancestorsByIndex: ReadonlyArray<ReadonlySet<number>>
  readonly throwsByIndex: readonly number[]
}

let cachedItemTypeClosure113c: ItemTypeClosure113c | null = null
let cachedItemsTxtTable113c: readonly D2ItemsTxtRecord113c[] | null = null

function getItemTypeClosure113c(): ItemTypeClosure113c {
  if (cachedItemTypeClosure113c !== null) return cachedItemTypeClosure113c
  const tbl = parseTable(new TextEncoder().encode(RAW_ITEM_TYPES))
  const cName = tbl.header.indexOf('ItemType')
  const cCode = tbl.header.indexOf('Code')
  const cEq1 = tbl.header.indexOf('Equiv1')
  const cEq2 = tbl.header.indexOf('Equiv2')
  const cThrows = tbl.header.indexOf('Throwable')

  const rawRows: Array<{ readonly code: string; readonly eq1: string; readonly eq2: string }> = []
  const throwsByIndex: number[] = []
  const codeToIndex = new Map<string, number>()
  for (const r of tbl.rows) {
    if (r[cName] === 'Expansion') continue
    const idx = rawRows.length
    const code = (r[cCode] !== undefined ? r[cCode]! : '').trim()
    const eq1 = (r[cEq1] !== undefined ? r[cEq1]! : '').trim()
    const eq2 = (r[cEq2] !== undefined ? r[cEq2]! : '').trim()
    rawRows.push({ code, eq1, eq2 })
    throwsByIndex.push((Number(r[cThrows]) | 0) & 0xff)
    if (code.length > 0 && !codeToIndex.has(code)) {
      codeToIndex.set(code, idx)
    }
  }

  const ancestorsByIndex: ReadonlySet<number>[] = []
  for (let i = 0; i < rawRows.length; i++) {
    const set = new Set<number>()
    const stack = [i]
    while (stack.length > 0) {
      const cur = stack.pop()!
      if (set.has(cur)) continue
      set.add(cur)
      const row = rawRows[cur]!
      if (row.eq1.length > 0) {
        const p1 = codeToIndex.get(row.eq1)
        if (p1 !== undefined && !set.has(p1)) stack.push(p1)
      }
      if (row.eq2.length > 0) {
        const p2 = codeToIndex.get(row.eq2)
        if (p2 !== undefined && !set.has(p2)) stack.push(p2)
      }
    }
    ancestorsByIndex.push(set)
  }

  cachedItemTypeClosure113c = { codeToIndex, ancestorsByIndex, throwsByIndex }
  return cachedItemTypeClosure113c
}

function resolveItemTypeIndex113c(
  codeToIndex: ReadonlyMap<string, number>,
  typeCode: string | undefined,
): number {
  if (typeCode === undefined) return 0
  const trimmed = typeCode.trim()
  if (trimmed.length === 0) return 0
  const idx = codeToIndex.get(trimmed)
  return idx !== undefined ? idx : 0
}

/**
 * `@va D2Common:0x6FDC19A0` (`D2Common.#10695` `DATATBLS_GetItemsTxtRecord`):
 * Returns the compiled `D2ItemsTxt` record for `dwClassId` (`0..305` from `Weapons.txt`,
 * `306..507` from `Armor.txt`, `508..658` from `Misc.txt`).
 */
export function DATATBLS_GetItemsTxtRecord113c(classId: number): D2ItemsTxtRecord113c | null {
  if (cachedItemsTxtTable113c === null) {
    const { codeToIndex } = getItemTypeClosure113c()
    const out: D2ItemsTxtRecord113c[] = []
    const enc = new TextEncoder()
    const weapTbl = parseTable(enc.encode(RAW_WEAPONS))
    const wName = weapTbl.header.indexOf('name')
    const wCode = weapTbl.header.indexOf('code')
    const wType1 = weapTbl.header.indexOf('type')
    const wType2 = weapTbl.header.indexOf('type2')
    const wClass = weapTbl.header.indexOf('wclass')
    const wStrB = weapTbl.header.indexOf('StrBonus')
    const wDexB = weapTbl.header.indexOf('DexBonus')
    const wNoDur = weapTbl.header.indexOf('nodurability')
    const wSpeed = weapTbl.header.indexOf('speed')
    for (const r of weapTbl.rows) {
      if (r[wName] === 'Expansion') continue
      const idx = out.length
      out.push({
        classId: idx,
        isWeapon: true,
        code: r[wCode] !== undefined ? r[wCode]! : '',
        wclass: r[wClass] !== undefined ? r[wClass]! : '',
        wType1: resolveItemTypeIndex113c(codeToIndex, r[wType1]),
        wType2: resolveItemTypeIndex113c(codeToIndex, r[wType2]),
        strBonus: Number(r[wStrB]) | 0,
        dexBonus: Number(r[wDexB]) | 0,
        bNoDurability: Number(r[wNoDur]) | 0,
        dwSpeed: Number(r[wSpeed]) | 0,
      })
    }
    const armorTbl = parseTable(enc.encode(RAW_ARMOR))
    const aName = armorTbl.header.indexOf('name')
    const aCode = armorTbl.header.indexOf('code')
    const aType1 = armorTbl.header.indexOf('type')
    const aType2 = armorTbl.header.indexOf('type2')
    const aStrB = armorTbl.header.indexOf('StrBonus')
    const aDexB = armorTbl.header.indexOf('DexBonus')
    const aNoDur = armorTbl.header.indexOf('nodurability')
    const aSpeed = armorTbl.header.indexOf('speed')
    for (const r of armorTbl.rows) {
      if (r[aName] === 'Expansion') continue
      const idx = out.length
      out.push({
        classId: idx,
        isWeapon: false,
        code: r[aCode] !== undefined ? r[aCode]! : '',
        wclass: '',
        wType1: resolveItemTypeIndex113c(codeToIndex, r[aType1]),
        wType2: resolveItemTypeIndex113c(codeToIndex, r[aType2]),
        strBonus: Number(r[aStrB]) | 0,
        dexBonus: Number(r[aDexB]) | 0,
        bNoDurability: Number(r[aNoDur]) | 0,
        dwSpeed: Number(r[aSpeed]) | 0,
      })
    }
    const miscTbl = parseTable(enc.encode(RAW_MISC))
    const mName = miscTbl.header.indexOf('name')
    const mCode = miscTbl.header.indexOf('code')
    const mType1 = miscTbl.header.indexOf('type')
    const mType2 = miscTbl.header.indexOf('type2')
    const mNoDur = miscTbl.header.indexOf('nodurability')
    const mSpeed = miscTbl.header.indexOf('speed')
    for (const r of miscTbl.rows) {
      if (r[mName] === 'Expansion') continue
      const idx = out.length
      out.push({
        classId: idx,
        isWeapon: false,
        code: r[mCode] !== undefined ? r[mCode]! : '',
        wclass: '',
        wType1: resolveItemTypeIndex113c(codeToIndex, r[mType1]),
        wType2: resolveItemTypeIndex113c(codeToIndex, r[mType2]),
        strBonus: 0,
        dexBonus: 0,
        bNoDurability: Number(r[mNoDur]) | 0,
        dwSpeed: Number(r[mSpeed]) | 0,
      })
    }
    cachedItemsTxtTable113c = out
  }
  const idx = classId | 0
  if (idx < 0 || idx >= cachedItemsTxtTable113c.length) return null
  return cachedItemsTxtTable113c[idx]!
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
 * `@va D2Common:0x6FD73EF0` (`D2Common.#11006` `ITEMS_CheckNotBrokenOrUnequipping`):
 * Returns `1` when `pItem` is a `UNIT_ITEM` whose `pItemData->dwFlags (+0x18)` has neither
 * `ITEMFLAG_BROKEN (0x100)` nor `ITEMFLAG_UNEQUIPPING (0x4000)` set (`(dwFlags & 0x4100) == 0`).
 */
export function ITEMS_CheckNotBrokenOrUnequipping113c(m: Memory113c, pItem: number): number {
  if (pItem === 0 || m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 0
  const pItemData = m.get(pItem, D2UnitStrc.pUnitData)
  if (pItemData !== 0) {
    const flags = m.u32(pItemData + ITEMDATA_OFF_DWFLAGS)
    if ((flags & (ITEMFLAG_BROKEN_113C | ITEMFLAG_UNEQUIPPING_113C)) !== 0) return 0
  }
  return 1
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

/**
 * `@va D2Common:0x6FD80530` (`D2Common.#10747` `UNITS_CanDualWield`):
 * Returns `1` for Player Barbarian (`4`) / Assassin (`6`) or Monster Shadow Warrior (`417`) / Shadow Master (`418`).
 */
export function UNITS_CanDualWield113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
  const classId = m.get(pUnit, D2UnitStrc.dwClassId) >>> 0
  if (uType === UNIT_PLAYER) {
    return classId === 4 || classId === 6 ? 1 : 0
  }
  if (uType === UNIT_MONSTER) {
    return classId === 417 || classId === 418 ? 1 : 0
  }
  return 0
}

/**
 * `@va D2Common:0x6FD803A0` (`D2Common.#10511` `SKILLS_GetUsedSkill`):
 * Returns `pUnit->pSkills (+0xA8)->pUsedSkill (+0x10)`.
 */
export function SKILLS_GetUsedSkill113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const pSkills = m.get(pUnit, D2UnitStrc.pSkills)
  return pSkills !== 0 ? m.u32(pSkills + 0x10) : 0
}

/**
 * `@va D2Common:0x6FD9DE40` (`D2Common.#10397` `SKILLS_GetFlags`):
 * Returns `pSkill->dwFlags (+0x0C)` (`0` if `pSkill == 0`).
 */
export function SKILLS_GetFlags113c(m: Memory113c, pSkill: number): number {
  if (pSkill === 0) return 0
  return m.u32(pSkill + 0x0c)
}

/**
 * `@va D2Game:0x6FC572C0` (`PLAYER_GetEquippedWeapon`):
 * 1. Calls `D2Common.#10101(pInventory)` (`0x6FD70700` `INVENTORY_GetActiveWeapon`) for `pDefault` (`0x6FC572F1`).
 * 2. Calls `D2Common.#10747(pUnit)` (`0x6FD80530` `UNITS_CanDualWield`); returns `pDefault` if `0` (`0x6FC572FD..0x6FC57308`).
 * 3. Calls `D2Common.#10511(pUnit)` (`0x6FD803A0` `SKILLS_GetUsedSkill`); returns `pDefault` if `pSkill == 0` or `pSkillsTxt == 0` (`0x6FC5730A..0x6FC57322`).
 * 4. Switches on `bWeapSel - 1` (`pSkillsTxt + 0x168`, jump table `0x6FC57414 = [0x6FC573CC, 0x6FC57346, 0x6FC57390, 0x6FC573A8]`):
 *    - `weapSel == 1` (`0x6FC573CC`): `pChosen = #10062(pInventory, 6)`.
 *    - `weapSel == 2` (`0x6FC57346..0x6FC5738E`): checks `(#10397(pSkill) & 0x2000) != 0` (`useRight`), fetches `pLeft = #10062(pInv, 5)` and `pRight = #10062(pInv, 6)`; if `pLeft` is not a weapon (`#10744(pLeft, 45) == 0`), picks `pRight`; else if `pRight` is not a weapon, picks `pLeft`; else picks `useRight ? pRight : pLeft`.
 *    - `weapSel == 3` (`0x6FC57390..0x6FC573A6`): computes signed `frameIdx = (pUnit->dwActionFrame (+0x38) | 0) >> 8`; if `(frameIdx & 1) != 0`, picks `#10062(pInv, 6)`, else `#10062(pInv, 5)`.
 *    - `weapSel == 4` (`0x6FC573A8..0x6FC573B0`): sets `pDefault = 0` and `pChosen = 0` (returns `0`).
 *    - `default` (`weapSel == 0` or `weapSel > 4`, `0x6FC573B2..0x6FC573D4`): tries `pChosen = #10062(pInv, 5)`; if `pChosen == 0` or `#10744(pChosen, 45) == 0`, falls back to `#10062(pInv, 6)`.
 * 5. Shared tail (`0x6FC573D6..0x6FC57403`): if `#10744(pChosen, 45) != 0` and `#11006(pChosen) != 0`, returns `pChosen`; else returns `pDefault`.
 */
export function PLAYER_GetEquippedWeapon113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const pInv = m.get(pUnit, D2UnitStrc.pInventory)
  if (pInv === 0) return 0
  let pDefault = INVENTORY_GetActiveWeapon113c(m, pInv)
  if (UNITS_CanDualWield113c(m, pUnit) === 0) return pDefault
  const pUsedSkill = SKILLS_GetUsedSkill113c(m, pUnit)
  if (pUsedSkill === 0) return pDefault
  const pSkillsTxt = m.u32(pUsedSkill)
  if (pSkillsTxt === 0) return pDefault

  const weapSel = m.u8(pSkillsTxt + 0x168)
  let pChosen = 0
  if (weapSel === 1) {
    pChosen = INVENTORY_GetWeaponByHandSlot113c(m, pInv, 6)
  } else if (weapSel === 2) {
    const useRight = (SKILLS_GetFlags113c(m, pUsedSkill) & 0x2000) !== 0
    const pLeft = INVENTORY_GetWeaponByHandSlot113c(m, pInv, 5)
    const pRight = INVENTORY_GetWeaponByHandSlot113c(m, pInv, 6)
    if (pLeft === 0 || ITEMS_CheckItemTypeId113c(m, pLeft, ITYPE_WEAPON_113C) === 0) {
      pChosen = pRight
    } else if (pRight === 0 || ITEMS_CheckItemTypeId113c(m, pRight, ITYPE_WEAPON_113C) === 0) {
      pChosen = pLeft
    } else {
      pChosen = useRight ? pRight : pLeft
    }
  } else if (weapSel === 3) {
    const frameIdx = (m.u32(pUnit + 0x38) | 0) >> 8
    pChosen = INVENTORY_GetWeaponByHandSlot113c(m, pInv, (frameIdx & 1) !== 0 ? 6 : 5)
  } else if (weapSel === 4) {
    pDefault = 0
    pChosen = 0
  } else {
    pChosen = INVENTORY_GetWeaponByHandSlot113c(m, pInv, 5)
    if (pChosen === 0 || ITEMS_CheckItemTypeId113c(m, pChosen, ITYPE_WEAPON_113C) === 0) {
      pChosen = INVENTORY_GetWeaponByHandSlot113c(m, pInv, 6)
    }
  }

  if (
    ITEMS_CheckItemTypeId113c(m, pChosen, ITYPE_WEAPON_113C) !== 0 &&
    ITEMS_CheckNotBrokenOrUnequipping113c(m, pChosen) !== 0
  ) {
    return pChosen
  }
  return pDefault
}

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

let cachedCanonicalTcTable113c: TreasureClassTable | null = null

function getCanonicalTcTable113c(): TreasureClassTable {
  if (cachedCanonicalTcTable113c === null) {
    cachedCanonicalTcTable113c = parseTreasureClassTable(
      parseTable(new TextEncoder().encode(RAW_TC_EX)),
    )
  }
  return cachedCanonicalTcTable113c
}

function getCharStatsByClassId113c(classId: number): CharacterClassStats {
  const code = CHARACTER_CLASS_CODES[classId >>> 0]
  if (code === undefined) {
    throw new RangeError(`Invalid 1.13c player classId=${classId}`)
  }
  return CANONICAL_CHARSTATS[code]
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

interface MutablePathRoom113c extends PathRoom {
  readonly ptr: number
  adjacentRooms: PathRoom[]
}

interface MutablePathUnit113c extends PathUnit {
  readonly pUnit: number
  readonly pPath: number
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

/**
 * `@va D2Game:0x6FCD08F0` (`UNITS_GetDistanceToCoordinates`):
 * Plain octile `(2 * max + min) >> 1`, no size subtraction.
 */
export function UNITS_GetDistanceToCoordinates113c(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = Math.abs((x1 | 0) - (x2 | 0))
  const dy = Math.abs((y1 | 0) - (y2 | 0))
  const hi = dx >= dy ? dx : dy
  const lo = dx >= dy ? dy : dx
  return ((hi * 2 + lo) >> 1) | 0
}

/**
 * `@va D2Common:0x6FD8AFD0` (`D2Common.#10873` `ROOM_RecordMonsterDeath`):
 * Record `dwUnitId` in `pRoom->dwDeathRing[bDeathRingIdx]` and advance `(idx + 1) & 3`.
 */
export function ROOM_RecordMonsterDeath113c(m: Memory113c, pRoom: number, unitId: number): void {
  if (pRoom === 0) return
  const idx = m.get(pRoom, D2ActiveRoomStrc.bDeathRingIdx) & 3
  m.set(pRoom, D2ActiveRoomStrc.dwDeathRing, unitId >>> 0, idx)
  m.set(pRoom, D2ActiveRoomStrc.bDeathRingIdx, (idx + 1) & 3)
}

export function syncDynamicPathFromMem113c(
  world: FallenSliceWorld113c,
  pu: MutablePathUnit113c,
): void {
  const { m } = world
  const p = pu.pPath
  const dp = pu.pDynamicPath
  if (p === 0 || !dp) return

  pu.dwAnimMode = m.get(pu.pUnit, D2UnitStrc.dwAnimMode)
  pu.dwFlags = m.get(pu.pUnit, D2UnitStrc.dwFlags)
  pu.dwFlagEx = m.get(pu.pUnit, D2UnitStrc.dwFlags2)

  dp.dwPrecisionX = m.u32(p + 0x00)
  dp.dwPrecisionY = m.u32(p + 0x04)
  dp.dwClientCoordX = m.u32(p + 0x08) | 0
  dp.dwClientCoordY = m.u32(p + 0x0c) | 0
  dp.tTargetCoord.X = m.get(p, D2DynamicPathStrc.wTargetX)
  dp.tTargetCoord.Y = m.get(p, D2DynamicPathStrc.wTargetY)
  dp.tPrevTargetCoord.X = m.get(p, D2DynamicPathStrc.wPrevTargetX)
  dp.tPrevTargetCoord.Y = m.get(p, D2DynamicPathStrc.wPrevTargetY)
  dp.tFinalTargetCoord.X = m.get(p, D2DynamicPathStrc.wFinalTargetX)
  dp.tFinalTargetCoord.Y = m.get(p, D2DynamicPathStrc.wFinalTargetY)

  const rPtr = m.get(p, D2DynamicPathStrc.pRoom)
  const prevRPtr = m.get(p, D2DynamicPathStrc.pPreviousRoom)
  const resolvedRoom = rPtr !== 0 ? world.roomByPtr.get(rPtr) : undefined
  const resolvedPrevRoom = prevRPtr !== 0 ? world.roomByPtr.get(prevRPtr) : undefined
  dp.pRoom = resolvedRoom !== undefined ? resolvedRoom : null
  dp.pPreviousRoom = resolvedPrevRoom !== undefined ? resolvedPrevRoom : null

  dp.dwCurrentPointIdx = m.u32(p + 0x24) | 0
  dp.dwPathPoints = m.u32(p + 0x28) | 0
  dp.dwFlags = m.get(p, D2DynamicPathStrc.dwFlags)
  dp.unk0x38 = m.u32(p + 0x38)
  dp.dwPathType = m.get(p, D2DynamicPathStrc.dwPathType)
  dp.dwPrevPathType = m.get(p, D2DynamicPathStrc.dwPrevPathType)
  dp.dwUnitSize = m.get(p, D2DynamicPathStrc.dwUnitSize)
  dp.dwCollisionPattern = m.get(p, D2DynamicPathStrc.dwCollisionPattern)
  dp.nFootprintCollisionMask = m.get(p, D2DynamicPathStrc.nFootprintCollisionMask)
  dp.nMoveTestCollisionMask = m.get(p, D2DynamicPathStrc.nMoveTestCollisionMask)
  dp.nCollidedWithMask = m.get(p, D2DynamicPathStrc.wCollidedWithMask)

  const tgtPtr = m.get(p, D2DynamicPathStrc.pTargetUnit)
  const resolvedTgt = tgtPtr !== 0 ? world.pathUnitByPtr.get(tgtPtr) : undefined
  dp.pTargetUnit = resolvedTgt !== undefined ? resolvedTgt : null
  dp.dwTargetType = m.get(p, D2DynamicPathStrc.dwTargetType)
  dp.dwTargetId = m.get(p, D2DynamicPathStrc.dwTargetId)

  dp.nDirection = m.get(p, D2DynamicPathStrc.nDirection)
  dp.nNewDirection = m.get(p, D2DynamicPathStrc.nNewDirection)
  dp.nDiffDirection = m.get(p, D2DynamicPathStrc.nDiffDirection)
  dp.unk0x67 = m.u8(p + 0x67)
  dp.dwSpeed = m.u8(p + 0x68)
  dp.tDirectionVector.nX = m.u32(p + 0x6a) | 0
  dp.tDirectionVector.nY = m.u32(p + 0x6e) | 0
  dp.tVelocityVector.nX = m.u32(p + 0x72) | 0
  dp.tVelocityVector.nY = m.u32(p + 0x76) | 0
  dp.dwVelocity = m.u32(p + 0x7c) | 0
  dp.nPreviousVelocity = m.get(p, D2DynamicPathStrc.nPreviousVelocity)
  dp.dwMaxVelocity = m.u32(p + 0x84) | 0
  dp.dwAcceleration = m.u32(p + 0x88) | 0
  dp.dwAccelerationsCounter = m.u32(p + 0x8c) | 0
  dp.nDist = m.get(p, D2DynamicPathStrc.nDist)
  dp.nDistMax = m.get(p, D2DynamicPathStrc.nDistMax)
  dp.nIDAStarInitFScore = m.get(p, D2DynamicPathStrc.nIDAStarInitFScore)
  dp.nStepNum = m.get(p, D2DynamicPathStrc.nStepNum)
  dp.nDistance = m.get(p, D2DynamicPathStrc.nDistance)
  dp.nDirOffset = m.u32(p + 0x98) | 0

  for (let i = 0; i < 78; i++) {
    const pt = dp.PathPoints[i]!
    pt.X = m.get(p, D2DynamicPathStrc.wPathPoints, i * 2)
    pt.Y = m.get(p, D2DynamicPathStrc.wPathPoints, i * 2 + 1)
  }
  dp.nSavedStepsCount = m.u32(p + 0x1d4) | 0
  for (let i = 0; i < 10; i++) {
    const sv = dp.SavedSteps[i]!
    sv.X = m.get(p, D2DynamicPathStrc.wSavedSteps, i * 2)
    sv.Y = m.get(p, D2DynamicPathStrc.wSavedSteps, i * 2 + 1)
  }
}

export function syncDynamicPathToMem113c(
  world: FallenSliceWorld113c,
  pu: MutablePathUnit113c,
): void {
  const { m } = world
  const p = pu.pPath
  const dp = pu.pDynamicPath
  if (p === 0 || !dp) return

  m.set(pu.pUnit, D2UnitStrc.dwFlags, pu.dwFlags >>> 0)
  m.set(pu.pUnit, D2UnitStrc.dwFlags2, pu.dwFlagEx >>> 0)

  m.setU32(p + 0x00, dp.dwPrecisionX >>> 0)
  m.setU32(p + 0x04, dp.dwPrecisionY >>> 0)
  m.setU32(p + 0x08, dp.dwClientCoordX >>> 0)
  m.setU32(p + 0x0c, dp.dwClientCoordY >>> 0)
  m.set(p, D2DynamicPathStrc.wTargetX, dp.tTargetCoord.X & 0xffff)
  m.set(p, D2DynamicPathStrc.wTargetY, dp.tTargetCoord.Y & 0xffff)
  m.set(p, D2DynamicPathStrc.wPrevTargetX, dp.tPrevTargetCoord.X & 0xffff)
  m.set(p, D2DynamicPathStrc.wPrevTargetY, dp.tPrevTargetCoord.Y & 0xffff)
  m.set(p, D2DynamicPathStrc.wFinalTargetX, dp.tFinalTargetCoord.X & 0xffff)
  m.set(p, D2DynamicPathStrc.wFinalTargetY, dp.tFinalTargetCoord.Y & 0xffff)

  const rPtr = dp.pRoom ? (dp.pRoom as MutablePathRoom113c).ptr : 0
  const prevRPtr = dp.pPreviousRoom ? (dp.pPreviousRoom as MutablePathRoom113c).ptr : 0
  m.set(p, D2DynamicPathStrc.pRoom, rPtr)
  m.set(p, D2DynamicPathStrc.pPreviousRoom, prevRPtr)

  m.setU32(p + 0x24, dp.dwCurrentPointIdx >>> 0)
  m.setU32(p + 0x28, dp.dwPathPoints >>> 0)
  m.set(p, D2DynamicPathStrc.dwFlags, dp.dwFlags >>> 0)
  m.setU32(p + 0x38, dp.unk0x38 >>> 0)
  m.set(p, D2DynamicPathStrc.dwPathType, dp.dwPathType >>> 0)
  m.set(p, D2DynamicPathStrc.dwPrevPathType, dp.dwPrevPathType >>> 0)
  m.set(p, D2DynamicPathStrc.dwUnitSize, dp.dwUnitSize >>> 0)
  m.set(p, D2DynamicPathStrc.dwCollisionPattern, dp.dwCollisionPattern >>> 0)
  m.set(p, D2DynamicPathStrc.nFootprintCollisionMask, dp.nFootprintCollisionMask >>> 0)
  m.set(p, D2DynamicPathStrc.nMoveTestCollisionMask, dp.nMoveTestCollisionMask >>> 0)
  m.set(p, D2DynamicPathStrc.wCollidedWithMask, dp.nCollidedWithMask & 0xffff)

  const tgtPtr = dp.pTargetUnit ? (dp.pTargetUnit as MutablePathUnit113c).pUnit : 0
  m.set(p, D2DynamicPathStrc.pTargetUnit, tgtPtr)
  m.set(p, D2DynamicPathStrc.dwTargetType, dp.dwTargetType >>> 0)
  m.set(p, D2DynamicPathStrc.dwTargetId, dp.dwTargetId >>> 0)

  m.set(p, D2DynamicPathStrc.nDirection, dp.nDirection & 0xff)
  m.set(p, D2DynamicPathStrc.nNewDirection, dp.nNewDirection & 0xff)
  m.set(p, D2DynamicPathStrc.nDiffDirection, dp.nDiffDirection & 0xff)
  m.setU8(p + 0x67, dp.unk0x67 & 0xff)
  m.setU8(p + 0x68, dp.dwSpeed & 0xff)
  m.setU32(p + 0x6a, dp.tDirectionVector.nX >>> 0)
  m.setU32(p + 0x6e, dp.tDirectionVector.nY >>> 0)
  m.setU32(p + 0x72, dp.tVelocityVector.nX >>> 0)
  m.setU32(p + 0x76, dp.tVelocityVector.nY >>> 0)
  m.setU32(p + 0x7c, dp.dwVelocity >>> 0)
  m.set(p, D2DynamicPathStrc.nPreviousVelocity, dp.nPreviousVelocity >>> 0)
  m.setU32(p + 0x84, dp.dwMaxVelocity >>> 0)
  m.setU32(p + 0x88, dp.dwAcceleration >>> 0)
  m.setU32(p + 0x8c, dp.dwAccelerationsCounter >>> 0)
  m.set(p, D2DynamicPathStrc.nDist, dp.nDist & 0xff)
  m.set(p, D2DynamicPathStrc.nDistMax, dp.nDistMax & 0xff)
  m.set(p, D2DynamicPathStrc.nIDAStarInitFScore, dp.nIDAStarInitFScore & 0xff)
  m.set(p, D2DynamicPathStrc.nStepNum, dp.nStepNum & 0xff)
  m.set(p, D2DynamicPathStrc.nDistance, dp.nDistance & 0xff)
  m.setU32(p + 0x98, dp.nDirOffset >>> 0)

  for (let i = 0; i < 78; i++) {
    const pt = dp.PathPoints[i]!
    m.set(p, D2DynamicPathStrc.wPathPoints, pt.X & 0xffff, i * 2)
    m.set(p, D2DynamicPathStrc.wPathPoints, pt.Y & 0xffff, i * 2 + 1)
  }
  m.setU32(p + 0x1d4, dp.nSavedStepsCount >>> 0)
  for (let i = 0; i < 10; i++) {
    const sv = dp.SavedSteps[i]!
    m.set(p, D2DynamicPathStrc.wSavedSteps, sv.X & 0xffff, i * 2)
    m.set(p, D2DynamicPathStrc.wSavedSteps, sv.Y & 0xffff, i * 2 + 1)
  }
}

export function getUnitPosSubtile113c(m: Memory113c, pUnit: number): { x: number; y: number } {
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath === 0) return { x: 0, y: 0 }
  return {
    x: m.get(pPath, D2DynamicPathStrc.wPosX),
    y: m.get(pPath, D2DynamicPathStrc.wPosY),
  }
}

function getMonStatsRow113c(m: Memory113c, pMonster: number): MonStats113cRow {
  const classId = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  const row = MONSTATS_113C_ROWS[classId]
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

/**
 * `@va D2Game:0x6FC40F30` (`AIGENERAL_AllocAiCommand`):
 * Allocates a `0x20`-byte `D2AiCmdStrc` node and appends it to `pAiGeneral`'s circular
 * doubly-linked command list (`pCommandHead` `+0x20`, `pCommandTail` `+0x24`).
 */
export function AIGENERAL_AllocAiCommand113c(m: Memory113c, pMonster: number): number {
  if (pMonster === 0 || m.get(pMonster, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return 0
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  if (pMonData === 0) return 0
  const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
  if (pAiGen === 0) return 0
  const node = m.alloc(D2AiCmdStrc_SIZE)
  const head = m.get(pAiGen, D2AiGeneralStrc.pCommandHead)
  if (head === 0) {
    m.set(pAiGen, D2AiGeneralStrc.pCommandHead, node)
    m.set(pAiGen, D2AiGeneralStrc.pCommandTail, node)
    m.set(node, D2AiCmdStrc.pNext, node)
    m.set(node, D2AiCmdStrc.pPrev, node)
  } else {
    const tail = m.get(pAiGen, D2AiGeneralStrc.pCommandTail)
    m.set(node, D2AiCmdStrc.pNext, head)
    m.set(node, D2AiCmdStrc.pPrev, tail)
    m.set(head, D2AiCmdStrc.pPrev, node)
    if (tail !== 0) m.set(tail, D2AiCmdStrc.pNext, node)
    m.set(pAiGen, D2AiGeneralStrc.pCommandTail, node)
  }
  return node
}

/**
 * `@va D2Game:0x6FC41290` (`AIGENERAL_CopyAiCommandParams`):
 * Allocates an AI command node via `0x6FC40F30` and copies 5 `uint32` parameters (`+0x00..+0x10`).
 */
export function AIGENERAL_CopyAiCommandParams113c(
  m: Memory113c,
  pMonster: number,
  cmdType: number,
  arg1 = 0,
  arg2 = 0,
  arg3 = 0,
  arg4 = 0,
): number {
  const node = AIGENERAL_AllocAiCommand113c(m, pMonster)
  if (node === 0) return 0
  m.set(node, D2AiCmdStrc.dwCmdType, cmdType >>> 0)
  m.set(node, D2AiCmdStrc.dwParam1, arg1 >>> 0)
  m.set(node, D2AiCmdStrc.dwParam2, arg2 >>> 0)
  m.set(node, D2AiCmdStrc.dwParam3, arg3 >>> 0)
  m.set(node, D2AiCmdStrc.dwParam4, arg4 >>> 0)
  return node
}

/**
 * `@va D2Game:0x6FC40EC0` (`AIGENERAL_PopAiCommand`):
 * Pops and frees (`m.free`) the current head `D2AiCmdStrc` node at `pAiGeneral->pCommandHead (+0x20)`.
 */
export function AIGENERAL_PopAiCommand113c(m: Memory113c, pMonster: number): void {
  if (pMonster === 0 || m.get(pMonster, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  if (pMonData === 0) return
  const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
  if (pAiGen === 0) return
  const head = m.get(pAiGen, D2AiGeneralStrc.pCommandHead)
  if (head === 0) return
  const tail = m.get(pAiGen, D2AiGeneralStrc.pCommandTail)
  if (tail === head) {
    ;(m as { free?: (p: number) => void }).free?.(head)
    m.set(pAiGen, D2AiGeneralStrc.pCommandHead, 0)
    m.set(pAiGen, D2AiGeneralStrc.pCommandTail, 0)
  } else {
    const next = m.get(head, D2AiCmdStrc.pNext)
    const prev = m.get(head, D2AiCmdStrc.pPrev)
    m.set(pAiGen, D2AiGeneralStrc.pCommandHead, next)
    m.set(next, D2AiCmdStrc.pPrev, prev)
    if (tail !== 0) m.set(tail, D2AiCmdStrc.pNext, next)
    ;(m as { free?: (p: number) => void }).free?.(head)
  }
}

/**
 * `@va D2Game:0x6FC95260` (`MONSTER_SavePrevMode`, called at `0x6FC95EA6` when `prevMode != 1`
 * and at `0x6FC962A5` in `MONSTER_StartDeath`):
 * Records `prevMode` into `pMonData->dwAlwaysChaseField (+0x54)` (`0x6FC95271..0x6FC9529A`).
 * Note: clearing `pMonData+0x50 = 0` and checking `prevMode != 1` happen in callers `0x6FC95E10`
 * and `0x6FC96270`, not inside `0x6FC95260`.
 */
export function MONSTER_SavePrevMode113c(
  m: Memory113c,
  pMonster: number,
  prevMode: number,
): void {
  if (pMonster === 0) return
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  if (pMonData === 0) return
  const cur54 = m.get(pMonData, D2MonsterDataStrc.dwAlwaysChaseField) >>> 0
  let next54: number
  if (cur54 >= 16) {
    next54 = (cur54 - 16) >>> 0
  } else if (cur54 === 13 && prevMode === 3) {
    next54 = cur54
  } else {
    next54 = prevMode >>> 0
  }
  m.set(pMonData, D2MonsterDataStrc.dwAlwaysChaseField, next54)
}

/**
 * `@va D2Game:0x6FD122C0` (`AI_Stall`):
 * Calls `D2Common.#11103(pMonster, 0)` (`SKILLS_SetUsedSkill113c`), checks
 * `if (pMonster->dwAnimMode != 1) MONSTER_StartMode(1)`, then deletes pending `nType == 2`
 * and schedules `Event 2` (`AI_THINK`) at `dwGameFrame + (delay === 0 ? 1 : delay)` with `arg14 = 0, arg18 = 0`
 * (`0x6FD12349..0x6FD12369`: `test esi, esi; jnz ...; mov esi, 1; ... push 0; push 0`).
 */
export function AI_Stall113c(
  world: FallenSliceWorld113c,
  pMonster: number,
  delayFrames: number,
): void {
  const { m, pGame } = world
  if (pMonster === 0) return
  SKILLS_SetUsedSkill113c(m, pMonster, 0)
  const rawDelay = delayFrames | 0
  const delay = rawDelay === 0 ? 1 : rawDelay
  if (m.get(pMonster, D2UnitStrc.dwAnimMode) !== 1) {
    MONSTER_StartMode113c(world, pMonster, 1, 0, 0, 0)
  }
  EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  EVENT_SetEventFull113c(m, pGame, pMonster, MON_EVENT_AI_THINK, (frame + delay) >>> 0, 0, 0, 0)
}

/**
 * `@va D2Game:0x6FC95E10` (`MONSTER_StartMode`) + `0x6FC94F90` (`MONSTER_StartMove`) +
 * `0x6FC94CE0` / `0x6FD83330` / `0x6FD7FB10` / `0x6FCFF7B0`:
 * - Resolves mode entry via `MONSTER_GetModeEntry113c` (`0x6FC949A0`); throws if invalid.
 * - Executes `0x6FC94F90` path & `D2AiControlStrc` (`+0x04..+0x20`) + `D2GameStrc.dwMonSpawnCount`
 *   (`+0x1D70`) / `dwMonSpawnTotal` (`+0x1DB4`) updates when `mode != 3` (`GH`).
 * - Updates `D2MonsterDataStrc` (`+0x50` / `dwAlwaysChaseField +0x54`) via `0x6FC95260`.
 * - Sets `dwFlags |= 0x80000` (`0x6FC95EB7`) and `D2UnitStrc` animation fields (`+0x40..+0x4E`).
 * - Schedules continuous (`0x6FD00B40`) or timed (`Event 1` + `Event 2` with `arg14 = 0`) events.
 */
export function MONSTER_StartMode113c(
  world: FallenSliceWorld113c,
  pMonster: number,
  mode: number,
  pTarget: number,
  targetX: number,
  targetY: number,
): boolean {
  const { m, pGame } = world
  const pu = world.pathUnitByPtr.get(pMonster)
  if (!pu || !pu.pDynamicPath) return false
  syncDynamicPathFromMem113c(world, pu)
  const dp = pu.pDynamicPath

  const entry = MONSTER_GetModeEntry113c(m, pMonster, mode)
  if (entry === null) {
    throw new RangeError(
      `MONSTER_StartMode113c: missing mode entry for classId=${m.get(pMonster, D2UnitStrc.dwClassId)} mode=${mode}`,
    )
  }

  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  const pAiCtrl = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiControl) : 0
  const row = getMonStatsRow113c(m, pMonster)
  const pathRec = getMonsterPathRecord(row.hcIdx)
  if (pathRec === null) {
    throw new RangeError(`MONSTER_StartMode113c: missing path record for hcIdx=${row.hcIdx}`)
  }
  const isMoving = MONSTER_IsContinuousMode113c(m, pMonster, mode)
  let moveAnimSpeed = 256

  if (mode !== 3) {
    // 0x6FC95EBE..0x6FC95EE7: `PATH_SetTargetUnit` vs `D2COMMON_10170_PathSetTargetPos`, then `PATH_SetDistance(dp, 20)`
    if (pTarget !== 0) {
      const tgtPu = world.pathUnitByPtr.get(pTarget)
      const resolvedTgtPu = tgtPu !== undefined ? tgtPu : null
      if (resolvedTgtPu !== null) syncDynamicPathFromMem113c(world, resolvedTgtPu)
      PATH_SetTargetUnit(dp, resolvedTgtPu)
    } else {
      D2COMMON_10170_PathSetTargetPos(dp, targetX, targetY)
    }
    PATH_SetDistance(dp, 20)

    let ptOv = 0
    let velOverride = 0
    let ovDist = 0
    if (pAiCtrl !== 0) {
      ptOv = m.get(pAiCtrl, D2AiControlStrc.dwPathTypeOverride) | 0
      velOverride = m.get(pAiCtrl, D2AiControlStrc.dwVelocityOverride) | 0
      ovDist = m.get(pAiCtrl, D2AiControlStrc.bNewDistOverride) & 0xff
      m.set(pAiCtrl, D2AiControlStrc.dwPathTypeOverride, 0)
      m.set(pAiCtrl, D2AiControlStrc.dwVelocityOverride, 0)
      m.set(pAiCtrl, D2AiControlStrc.bNewDistOverride, 0)
    }

    // 0x6FC95070 + 0x6FC94F98..0x6FC94FD4: `rawPathType = ptOv != 0 ? ptOv : (isMoving ? 0x65 : 0x64)`
    const rawPathType = ptOv !== 0 ? ptOv : isMoving ? 0x65 : 0x64
    if (rawPathType !== 0x64) {
      const pathType = rawPathType === 0x65 ? PATHTYPE_TOWARD_FINISH : rawPathType
      // 0x6FC94FD6..0x6FC94FDA: when `bNewDistOverride == 0`, `MONSTER_StartMove` defaults `newDist = 5` (`nDistMax = 5`).
      const newDist = ovDist !== 0 ? ovDist : 5
      PATH_SetNewDistance(dp, newDist)

      // 0x6FC94D61..0x6FC94D9C: `MONSTER_ComputeMovePath` caches `(pTargetUnit, tTargetCoord.X, tTargetCoord.Y)` BEFORE `D2Common_10142`
      const curTargetPtr = dp.pTargetUnit !== null ? pTarget >>> 0 : 0
      const firstX = dp.tTargetCoord.X >>> 0
      const firstY = dp.tTargetCoord.Y >>> 0
      if (
        pAiCtrl !== 0 &&
        (curTargetPtr !== m.u32(pAiCtrl + 0x04) ||
          firstX !== m.u32(pAiCtrl + 0x08) ||
          firstY !== m.u32(pAiCtrl + 0x0c))
      ) {
        m.setU32(pAiCtrl + 0x04, curTargetPtr)
        m.setU32(pAiCtrl + 0x08, firstX)
        m.setU32(pAiCtrl + 0x0c, firstY)
        m.setU8(pAiCtrl + 0x00, 0)
        m.setU8(pAiCtrl + 0x01, 0)
      }

      // 0x6FD83330 + 0x6FC94CE0: totalPct = max(25, (stat67 != 0 ? stat67 : 100) + dim150(stat96) + velOverride)
      const statVelPct = STATLIST_GetUnitStat113c(m, pMonster, STAT_VELOCITYPERCENT, 0) | 0
      const frwStat = STATLIST_GetUnitStat113c(m, pMonster, STAT_FASTERMOVEVELOCITY, 0) | 0
      let totalPct =
        (statVelPct !== 0 ? statVelPct : 100) + computeFrwDiminishing113c(frwStat) + velOverride
      if (totalPct < 25) totalPct = 25

      const baseVel = mode === 15 ? row.run : row.velocity
      const scaledVel = Math.trunc(((baseVel << 8) * totalPct) / 100) | 0
      PATH_SetVelocity(dp, scaledVel > 0 ? scaledVel : 0)

      const baseAnimSpeed = mode === 15 ? pathRec.runAnimSpeed : pathRec.walkAnimSpeed
      const rawAnimSpeed = Math.trunc((baseAnimSpeed * totalPct) / 100) | 0
      moveAnimSpeed = rawAnimSpeed <= 0 ? 0 : rawAnimSpeed >= 0x7fff ? 0x7fff : rawAnimSpeed

      PATH_SetType(dp, pathType)
      let ok = D2Common_10142(dp, pu, 0)
      let moveStatus = pathType
      if (ok !== 0) {
        pu.dwFlags = (pu.dwFlags | 1) >>> 0
        m.set(pMonster, D2UnitStrc.dwFlags, pu.dwFlags)
        if (pAiCtrl !== 0) {
          m.setU8(pAiCtrl + 0x00, 0)
          m.setU8(pAiCtrl + 0x01, 0)
        }
      } else if (
        pathType === 2 ||
        pathType === 7 ||
        pathType === 9 ||
        pathType === PATHTYPE_TOWARD_FINISH
      ) {
        pu.dwFlags = (pu.dwFlags | 1) >>> 0
        m.set(pMonster, D2UnitStrc.dwFlags, pu.dwFlags)
        PATH_SetType(dp, PATHTYPE_WALL_FOLLOW)
        ok = D2Common_10142(dp, pu, 0)
        moveStatus = PATHTYPE_WALL_FOLLOW
      }

      if (pAiCtrl !== 0) {
        m.setU32(pAiCtrl + 0x10, velOverride >>> 0)
        m.setU32(
          pAiCtrl + 0x14,
          moveStatus !== 1 && dp.pTargetUnit !== null ? 0x0a : 0xffffffff,
        )
      }

      // 0x6FC9501A..0x6FC95036: increment `pGame->dwMonSpawnCount[moveStatus]` (`+0x1D70`, 17 slots) & `dwMonSpawnTotal` (`+0x1DB4`)
      if (pGame !== 0 && moveStatus >= 0 && moveStatus < 17) {
        m.set(
          pGame,
          D2GameStrc.dwMonSpawnCount,
          (m.get(pGame, D2GameStrc.dwMonSpawnCount, moveStatus) + 1) >>> 0,
          moveStatus,
        )
        if (moveStatus !== 0) {
          m.set(
            pGame,
            D2GameStrc.dwMonSpawnTotal,
            (m.get(pGame, D2GameStrc.dwMonSpawnTotal) + 1) >>> 0,
          )
        }
      }

      if (isMoving && ok === 0) {
        // 0x6FC95F64..0x6FC95F96: failed move resets used skill (`#11103`), forces `NU (1)`, sets `0x80000`, clears mode events
        SKILLS_SetUsedSkill113c(m, pMonster, 0)
        pu.dwAnimMode = 1
        pu.dwFlags = (pu.dwFlags | UNITFLAG_MODE_CHANGED_TICK) >>> 0
        syncDynamicPathToMem113c(world, pu)
        m.set(pMonster, D2UnitStrc.dwAnimMode, 1)
        const nuFrames = getMonsterModeBaseFrameCount113c(row.hcIdx, 1)
        writeUnitAnimState113c(m, pMonster, 0, 0, nuFrames << 8, 256, 0)
        MONSTER_ClearModeEvents113c(m, pGame, pMonster)
        return false
      }
      syncDynamicPathToMem113c(world, pu)
    } else {
      if (pAiCtrl !== 0) {
        m.setU32(pAiCtrl + 0x10, 0)
        m.setU32(pAiCtrl + 0x14, 0xffffffff)
      }
      if (pGame !== 0) {
        m.set(
          pGame,
          D2GameStrc.dwMonSpawnCount,
          (m.get(pGame, D2GameStrc.dwMonSpawnCount, 0) + 1) >>> 0,
          0,
        )
      }
      syncDynamicPathToMem113c(world, pu)
    }
  }

  const prevMode = m.get(pMonster, D2UnitStrc.dwAnimMode)
  if (pMonData !== 0) {
    m.setU32(pMonData + 0x50, 0)
  }
  if (prevMode !== 1) {
    MONSTER_SavePrevMode113c(m, pMonster, prevMode)
  }

  MONSTER_ClearModeEvents113c(m, pGame, pMonster)
  m.set(pMonster, D2UnitStrc.dwAnimMode, mode >>> 0)
  pu.dwAnimMode = mode >>> 0
  const updatedFlags = (m.get(pMonster, D2UnitStrc.dwFlags) | UNITFLAG_MODE_CHANGED_TICK) >>> 0
  m.set(pMonster, D2UnitStrc.dwFlags, updatedFlags)
  pu.dwFlags = updatedFlags

  const frames = getMonsterModeBaseFrameCount113c(row.hcIdx, mode)
  writeUnitAnimState113c(
    m,
    pMonster,
    0,
    0,
    frames << 8,
    isMoving ? moveAnimSpeed : 256,
    0,
  )

  if (entry.scheduleEvents !== 0) {
    if (isMoving) {
      MONSTER_RegisterContinuousModeEvent113c(m, pGame, pMonster)
    } else {
      const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
      EVENT_SetEventFull113c(m, pGame, pMonster, MON_EVENT_MODE_END, (frame + frames) >>> 0, 0, 0, 0)
      const bExp = m.get(pGame, D2GameStrc.bExpansion)
      const diff: 0 | 1 | 2 = bExp !== 0 ? getDifficultyIdx113c(m, pGame) : 0
      const rawAidel = row.aidel[diff]
      const aidel = rawAidel > 0 ? rawAidel : 15
      EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)
      EVENT_SetEventFull113c(
        m,
        pGame,
        pMonster,
        MON_EVENT_AI_THINK,
        (frame + frames + aidel) >>> 0,
        0,
        0,
        0,
      )
    }
  }
  return true
}

/** `@va D2Game:0x6FD12540` (`AI_ApproachTarget`). */
export function AI_ApproachTarget113c(
  world: FallenSliceWorld113c,
  pMonster: number,
  pTarget: number,
  mode: number,
  targetX: number,
  targetY: number,
  stepNum: number,
  flags: number,
): boolean {
  const { m, pGame } = world
  let actualMode = mode
  if (actualMode === 15 && STATES_CheckState113c(m, pMonster, 60) !== 0) {
    const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
    const pAiCtrl = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiControl) : 0
    if (pAiCtrl !== 0) {
      m.set(pAiCtrl, D2AiControlStrc.dwPathTypeOverride, 0)
      m.set(pAiCtrl, D2AiControlStrc.dwVelocityOverride, 0)
      m.set(pAiCtrl, D2AiControlStrc.bNewDistOverride, 0)
    }
    actualMode = 2
  }

  const pu = world.pathUnitByPtr.get(pMonster)
  if (pu !== undefined && pu.pDynamicPath !== null) {
    syncDynamicPathFromMem113c(world, pu)
    PATH_SetStepNum(pu.pDynamicPath, stepNum)
    syncDynamicPathToMem113c(world, pu)
  }

  const ok = MONSTER_StartMode113c(world, pMonster, actualMode, pTarget, targetX, targetY)
  if (!ok) {
    if ((flags & 4) !== 0) {
      EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)
    }
    if ((flags & 1) !== 0) {
      const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
      const pAiGen = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiGeneral) : 0
      if (pAiGen !== 0) {
        m.set(pAiGen, D2AiGeneralStrc.dwFlags, (m.get(pAiGen, D2AiGeneralStrc.dwFlags) | 0x40) >>> 0)
      }
    }
    if ((flags & 2) !== 0) {
      const roll = stepUnitSeed(m, pMonster).lo % 100
      if (roll < 70) {
        AI_IdleWander113c(world, pMonster, 4)
      } else {
        AI_Stall113c(world, pMonster, 10)
      }
    }
  }
  return ok
}

/** `@va D2Game:0x6FD11B10` (`AI_IdleWander`): 4 LCG draws on `pMonster->pSeed`. */
export function AI_IdleWander113c(
  world: FallenSliceWorld113c,
  pMonster: number,
  range: number,
): boolean {
  const { m } = world
  const { x: x0, y: y0 } = getUnitPosSubtile113c(m, pMonster)
  const axisRoll = stepUnitSeed(m, pMonster)
  let dx: number
  let dy: number
  if ((axisRoll.lo & 1) !== 0) {
    dy = rollUnitLimited(m, pMonster, range)
    dx = range
  } else {
    dx = rollUnitLimited(m, pMonster, range)
    dy = range
  }
  if ((stepUnitSeed(m, pMonster).lo & 1) !== 0) dx = -dx
  if ((stepUnitSeed(m, pMonster).lo & 1) !== 0) dy = -dy

  const ok = AI_ApproachTarget113c(world, pMonster, 0, 2, x0 + dx, y0 + dy, 1, 0)
  if (!ok) {
    AI_Stall113c(world, pMonster, 10)
  }
  return ok
}

/** `@va D2Game:0x6FD12D80` (`AI_FleeFrom`). */
export function AI_FleeFrom113c(
  world: FallenSliceWorld113c,
  pFrom: number,
  pMonster: number,
  distSteps: number,
  clearThinkOnFail: boolean,
): boolean {
  if (pFrom === 0) return false
  const { m } = world
  const { x: mx, y: my } = getUnitPosSubtile113c(m, pMonster)
  const { x: fx, y: fy } = getUnitPosSubtile113c(m, pFrom)
  const sx = mx > fx ? 1 : mx < fx ? -1 : 0
  const sy = my > fy ? 1 : my < fy ? -1 : 0
  if (distSteps > 5) {
    const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
    const pAiCtrl = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiControl) : 0
    if (pAiCtrl !== 0) {
      m.set(pAiCtrl, D2AiControlStrc.bNewDistOverride, Math.min(distSteps, 0x4d))
    }
  }
  return AI_ApproachTarget113c(
    world,
    pMonster,
    0,
    2,
    mx + distSteps * sx,
    my + distSteps * sy,
    1,
    clearThinkOnFail ? 4 : 0,
  )
}

/** `@va D2Game:0x6FCA38B0` (`AiZombie`). */
export function AiZombie113c(
  world: FallenSliceWorld113c,
  pMonster: number,
  pTarget: number,
  dist: number,
  inMeleeRange: boolean,
): void {
  const { m, pGame } = world
  const entryMode = m.get(pMonster, D2UnitStrc.dwAnimMode)
  if (entryMode === 0 || entryMode === 12) return
  if (entryMode !== 1) {
    AI_Stall113c(world, pMonster, 10)
    return
  }

  const row = getMonStatsRow113c(m, pMonster)
  const diff = getDifficultyIdx113c(m, pGame)
  if (inMeleeRange) {
    if (stepUnitSeed(m, pMonster).lo % 100 < row.aip3[diff]) {
      const mode = stepUnitSeed(m, pMonster).lo % 100 < row.aip4[diff] ? 4 : 5
      MONSTER_StartMode113c(world, pMonster, mode, pTarget, 0, 0)
    } else {
      AI_Stall113c(world, pMonster, 10)
    }
    return
  }

  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  const alwaysChase = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.dwAlwaysChaseField) : 0
  let chase = alwaysChase === 3 || alwaysChase === 0x13
  if (!chase && dist < row.aip2[diff]) {
    const roll = stepUnitSeed(m, pMonster).lo % 100
    if (roll < row.aip1[diff]) chase = true
  }
  if (chase) {
    const pAiCtrl = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiControl) : 0
    if (pAiCtrl !== 0) m.set(pAiCtrl, D2AiControlStrc.dwVelocityOverride, 100)
    AI_ApproachTarget113c(world, pMonster, pTarget, 15, 0, 0, 1, 0)
    return
  }
  AI_IdleWander113c(world, pMonster, 3)
}

/**
 * `@va D2Game:0x6FCA3130` (`AiFallen`):
 * - Saves `entryMode = pMonster->dwAnimMode` at entry (`0x6FCA3143`) and tests `entryMode != 1`
 *   at `0x6FCA328F`.
 * - Returns immediately when `pRoom == 0` (`0x6FCA318D`).
 * - Scans current + adjacent rooms' `dwDeathRing[0..3]` for dying ally (`mode == 0`, `dist < 15`).
 */
export function AiFallen113c(
  world: FallenSliceWorld113c,
  pMonster: number,
  pTarget: number,
  dist: number,
  inMeleeRange: boolean,
): void {
  const { m, pGame } = world
  const entryMode = m.get(pMonster, D2UnitStrc.dwAnimMode)
  if (entryMode === 0 || entryMode === 12) return

  EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)

  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  if (pMonData === 0) return
  const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
  const pAiCtrl = m.get(pMonData, D2MonsterDataStrc.pAiControl)
  if (pAiGen === 0) return

  // 0x6FCA3183..0x6FCA3193: `pRoom == 0` early return!
  const pPath = m.get(pMonster, D2UnitStrc.pPath)
  const pRoom = pPath !== 0 ? m.get(pPath, D2DynamicPathStrc.pRoom) : 0
  if (pRoom === 0) return

  const { x: mx, y: my } = getUnitPosSubtile113c(m, pMonster)

  // 0x6FCA31A5..0x6FCA3285: scan current + adjacent rooms' `dwDeathRing[0..3]` for dying ally (`mode == 0`, `dist < 15`)
  const ppRooms = m.get(pRoom, D2ActiveRoomStrc.ppRoomsNear)
  const nRooms = m.get(pRoom, D2ActiveRoomStrc.nRoomsNear)
  let stopScan = false
  for (let rIdx = 0; rIdx < nRooms && !stopScan; rIdx++) {
    const rPtr = ppRooms !== 0 ? m.u32(ppRooms + rIdx * 4) : rIdx === 0 ? pRoom : 0
    if (rPtr === 0) continue
    for (let dIdx = 0; dIdx < 4; dIdx++) {
      const deadId = m.get(rPtr, D2ActiveRoomStrc.dwDeathRing, dIdx)
      if (deadId === 0) continue
      const foundDead = world.monsterById.get(deadId)
      const pDead = foundDead !== undefined ? foundDead : 0
      if (pDead === 0 || m.get(pDead, D2UnitStrc.dwAnimMode) !== 0) continue
      const { x: dx, y: dy } = getUnitPosSubtile113c(m, pDead)
      if (UNITS_GetDistanceToCoordinates113c(dx, dy, mx, my) < 15) {
        m.set(pAiGen, D2AiGeneralStrc.bAfraid, 1)
        AIGENERAL_PopAiCommand113c(m, pMonster)
        if (pAiCtrl !== 0) {
          m.set(pAiCtrl, D2AiControlStrc.dwVelocityOverride, 50)
        }
        if (AI_FleeFrom113c(world, pTarget, pMonster, 12, true)) {
          // 0x6FCA3260: `lo % 20 < 1` unit sound draw
          stepUnitSeed(m, pMonster)
          return
        }
        stopScan = true
        break
      }
    }
  }

  // 0x6FCA328F: checks entry-saved `entryMode != 1` (`MONMODE_NEUTRAL`)
  if (entryMode !== 1) {
    AI_Stall113c(world, pMonster, 10)
    return
  }

  const row = getMonStatsRow113c(m, pMonster)
  const diff = getDifficultyIdx113c(m, pGame)
  const aip1 = row.aip1[diff]
  const aip2 = row.aip2[diff]
  const aip3 = row.aip3[diff]
  const aip4 = row.aip4[diff]

  // 0x6FCA32BF: command stack check
  const cmdHead = m.get(pAiGen, D2AiGeneralStrc.pCommandHead)
  if (cmdHead !== 0) {
    const cmdType = m.get(cmdHead, D2AiCmdStrc.dwCmdType)
    if (cmdType !== 1) {
      AIGENERAL_PopAiCommand113c(m, pMonster)
      AI_Stall113c(world, pMonster, 10)
      return
    }
    if (inMeleeRange) {
      if (stepUnitSeed(m, pMonster).lo % 100 < aip3) {
        const atkMode = stepUnitSeed(m, pMonster).lo % 100 < aip4 ? 4 : 5
        MONSTER_StartMode113c(world, pMonster, atkMode, pTarget, 0, 0)
      } else {
        AI_Stall113c(world, pMonster, 5)
      }
      return
    }
    if (!AI_ApproachTarget113c(world, pMonster, pTarget, 2, 0, 0, 1, 0)) {
      AIGENERAL_PopAiCommand113c(m, pMonster)
    }
    return
  }

  const alwaysChase = m.get(pMonData, D2MonsterDataStrc.dwAlwaysChaseField)
  if (!inMeleeRange && (alwaysChase === 3 || alwaysChase === 0x13)) {
    AI_ApproachTarget113c(world, pMonster, pTarget, 2, 0, 0, 1, 0)
    return
  }

  // 0x6FCA335C: leader war cry check (`dist < 15 && leader(pMonster) == pMonster && lo%100 < aip1`)
  const selfId = m.get(pMonster, D2UnitStrc.dwUnitId)
  const pGroup = m.get(pAiGen, D2AiGeneralStrc.pGroup)
  const leaderId = pGroup !== 0 ? m.get(pAiGen, D2AiGeneralStrc.dwLeaderId) : 0xffffffff
  const leaderType = pGroup !== 0 ? m.get(pAiGen, D2AiGeneralStrc.dwLeaderType) : 0xffffffff
  const isSelfLeader = pGroup !== 0 && leaderType === 1 && leaderId === selfId
  if (dist < 15 && isSelfLeader) {
    if (stepUnitSeed(m, pMonster).lo % 100 < aip1) {
      const minions = world.minionIdsByLeaderId.get(selfId)
      if (minions !== undefined) {
        for (const minionId of minions) {
          const foundMinion = world.monsterById.get(minionId)
          const pMinion = foundMinion !== undefined ? foundMinion : 0
          if (pMinion !== 0 && SUNIT_IsDeadOrDying113c(m, pMinion) === 0) {
            AIGENERAL_CopyAiCommandParams113c(m, pMinion, 1, 0, 0, 0, 0)
          }
        }
      }
      AIGENERAL_CopyAiCommandParams113c(m, pMonster, 1, 0, 0, 0, 0)
      MONSTER_StartMode113c(world, pMonster, 9, pTarget, 0, 0)
      return
    }
  }

  if (inMeleeRange) {
    const bAfraid = m.get(pAiGen, D2AiGeneralStrc.bAfraid)
    if (bAfraid === 0 && stepUnitSeed(m, pMonster).lo % 100 >= aip3) {
      if (stepUnitSeed(m, pMonster).lo % 100 < 30) {
        MONSTER_StartMode113c(world, pMonster, 9, pTarget, 0, 0)
      } else {
        AI_Stall113c(world, pMonster, 10)
      }
      return
    }
    m.set(pAiGen, D2AiGeneralStrc.bAfraid, 0)
    const atkMode = stepUnitSeed(m, pMonster).lo % 100 < aip4 ? 4 : 5
    MONSTER_StartMode113c(world, pMonster, atkMode, pTarget, 0, 0)
    return
  }

  if (dist > aip2) {
    if (stepUnitSeed(m, pMonster).lo % 100 < 30) {
      AI_IdleWander113c(world, pMonster, 3)
    } else {
      AI_Stall113c(world, pMonster, 10)
    }
    return
  }

  AI_ApproachTarget113c(world, pMonster, pTarget, 2, 0, 0, 1, 7)
}

/**
 * Slice helper for `D2Game:0x6FD13220` (`AI_FindNearestPlayerOrAlly` + `aidist` dormancy, called by `0x6FCBD160`):
 * Finds nearest living out-of-town player within `aidist` (`0x6FD13268`: `aidist > 0 ? aidist : 35`),
 * computes melee range via `D2Common_10399`, and dispatches `pAiGeneral->pfnThink` (`AiFallen` or `AiZombie`).
 */
export function runMonsterAiDriver113c(
  world: FallenSliceWorld113c,
  pMonster: number,
  pfnThink: number,
): void {
  const { m, pGame } = world
  if (SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) return

  const row = getMonStatsRow113c(m, pMonster)
  const diff = getDifficultyIdx113c(m, pGame)
  const rawAidist = row.aidist[diff]
  const radius = rawAidist > 0 ? rawAidist : 35
  const { x: mx, y: my } = getUnitPosSubtile113c(m, pMonster)

  let minDist = 0x7fffffff
  let bestTarget = 0
  for (const pPlayer of world.playerById.values()) {
    if (SUNIT_IsDeadOrDying113c(m, pPlayer) !== 0) continue
    const { x: px, y: py } = getUnitPosSubtile113c(m, pPlayer)
    const d = UNITS_GetDistanceToCoordinates113c(px, py, mx, my)
    if (d < minDist) {
      minDist = d
      if (d < 55 && d < radius) {
        bestTarget = pPlayer
      }
    }
  }

  if (bestTarget === 0) {
    let delay: number
    if (minDist >= 35) delay = 25
    else if (minDist < 25) delay = 10
    else delay = minDist - 10
    AI_Stall113c(world, pMonster, delay)
    return
  }

  const monPu = world.pathUnitByPtr.get(pMonster)
  const tgtPu = world.pathUnitByPtr.get(bestTarget)
  let inMelee = false
  if (monPu !== undefined && tgtPu !== undefined) {
    syncDynamicPathFromMem113c(world, monPu)
    syncDynamicPathFromMem113c(world, tgtPu)
    const meleeThreshold = row.meleeRng > 0 ? row.meleeRng : 1
    inMelee = D2Common_10399(tgtPu, monPu) <= meleeThreshold
  }

  if (pfnThink === VA_AI_FALLEN_113C) {
    AiFallen113c(world, pMonster, bestTarget, minDist, inMelee)
  } else if (pfnThink === VA_AI_ZOMBIE_113C) {
    AiZombie113c(world, pMonster, bestTarget, minDist, inMelee)
  } else {
    throw new Error(`Unsupported monster pfnThink VA: 0x${(pfnThink >>> 0).toString(16)}`)
  }
}

/**
 * `@va D2Game:0x6FC96BF0` (`MONSTER_EndToAiOrNeutral`):
 * For `0x6FD2F14C[mode] == 1` (`WL = 2`, `RN = 15`), sets `dwAnimMode = 1` (`NU`) directly via
 * `D2Common.#11090` (`0x6FD83920`) **without** `MONSTER_ClearModeEvents`, checks `STATE_FREEZE (1)`,
 * and runs `AI_RunMonsterAI` (`0x6FCBD3B0`) inline!
 */
export function MONSTER_EndToAiOrNeutral113c(
  world: FallenSliceWorld113c,
  pMonster: number,
): void {
  const { m } = world
  const prevMode = m.get(pMonster, D2UnitStrc.dwAnimMode) >>> 0
  const inlineAiFlag =
    prevMode < MONSTER_INLINE_AI_ON_END_TABLE_113C.length
      ? MONSTER_INLINE_AI_ON_END_TABLE_113C[prevMode]
      : 0
  if (inlineAiFlag !== 0) {
    m.set(pMonster, D2UnitStrc.dwAnimMode, 1)
    const pu = world.pathUnitByPtr.get(pMonster)
    if (pu !== undefined) pu.dwAnimMode = 1
    if (STATES_CheckState113c(m, pMonster, 1) !== 0 && SUNIT_IsDeadOrDying113c(m, pMonster) === 0) {
      return
    }
    const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
    const pAiGen = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiGeneral) : 0
    const pfnThink = pAiGen !== 0 ? m.get(pAiGen, D2AiGeneralStrc.pfnThink) : 0
    if (pfnThink !== 0) {
      runMonsterAiDriver113c(world, pMonster, pfnThink)
    }
    return
  }

  MONSTER_StartMode113c(world, pMonster, 1, 0, 0, 0)
}

/** `@va D2Game:0x6FD01930` (`MONSTER_StepPath`). */
export function MONSTER_StepPath113c(
  world: FallenSliceWorld113c,
  pMonster: number,
): number {
  const pu = world.pathUnitByPtr.get(pMonster)
  if (pu === undefined || pu.pDynamicPath === null) return 0
  syncDynamicPathFromMem113c(world, pu)
  const stepped = D2Common_10226(pu, 0x400)
  syncDynamicPathToMem113c(world, pu)
  return stepped
}

/**
 * `@va D2Game:0x6FC97010` (`MONSTER_StepWalk`):
 * Checks `STATE_BLAZE (0x0D)` / `STATE_INFERNO (0x16)` (`0x6FC97014..0x6FC97035`), steps path via
 * `0x6FD01930` (`MONSTER_StepPath113c`), and transitions via `0x6FC96BF0` when the path completes.
 */
export function MONSTER_StepWalk113c(
  world: FallenSliceWorld113c,
  pMonster: number,
): void {
  const { m } = world
  const hasBlazeOrInferno =
    STATES_CheckState113c(m, pMonster, 0x0d) !== 0 ||
    STATES_CheckState113c(m, pMonster, 0x16) !== 0
  if (hasBlazeOrInferno) {
    // 0x6FC97014..0x6FC97035: Blaze (13) / Inferno (22) ground trail check before stepping path
    m.set(pMonster, D2UnitStrc.dwFlags, (m.get(pMonster, D2UnitStrc.dwFlags) | 1) >>> 0)
  }
  if (MONSTER_StepPath113c(world, pMonster) === 0) {
    MONSTER_EndToAiOrNeutral113c(world, pMonster)
  }
}

/**
 * `@va D2Game:0x6FC96FE0` (`MONSTER_StepRun`):
 * Steps path via `0x6FD01930` (`MONSTER_StepPath113c`), checks `STATE_BLAZE (0x0D)` (`0x6FC96FF1`),
 * and transitions via `0x6FC96BF0` when the path completes.
 */
export function MONSTER_StepRun113c(
  world: FallenSliceWorld113c,
  pMonster: number,
): void {
  const { m } = world
  const stepped = MONSTER_StepPath113c(world, pMonster)
  if (STATES_CheckState113c(m, pMonster, 0x0d) !== 0) {
    m.set(pMonster, D2UnitStrc.dwFlags, (m.get(pMonster, D2UnitStrc.dwFlags) | 1) >>> 0)
  }
  if (stepped === 0) {
    MONSTER_EndToAiOrNeutral113c(world, pMonster)
  }
}

export const MONSTER_StepContinuousMove113c = MONSTER_StepWalk113c

/**
 * `@va D2Game:0x6FC40D50` (`AIGENERAL_PromoteNextPackLeader`):
 * When a pack leader dies, promotes the head living minion in `minionIdsByLeaderId` and updates
 * `D2AiGeneralStrc.dwLeaderId (+0x2C)` across the dying leader and all pack members.
 */
function promotePackLeaderOnDeath113c(world: FallenSliceWorld113c, pMonster: number): void {
  const { m } = world
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  if (pMonData === 0) return
  const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
  if (pAiGen === 0) return
  const pGroup = m.get(pAiGen, D2AiGeneralStrc.pGroup)
  if (pGroup === 0) return
  const selfId = m.get(pMonster, D2UnitStrc.dwUnitId)
  const leaderId = m.get(pAiGen, D2AiGeneralStrc.dwLeaderId)
  const leaderType = m.get(pAiGen, D2AiGeneralStrc.dwLeaderType)
  if (leaderType !== 1 || leaderId !== selfId) return

  const minions = world.minionIdsByLeaderId.get(selfId)
  if (minions === undefined || minions.length === 0) return

  let newLeaderId = 0
  let newLeaderIdx = -1
  for (let i = 0; i < minions.length; i++) {
    const candId = minions[i]!
    const pCand = world.monsterById.get(candId)
    if (pCand !== undefined && SUNIT_IsDeadOrDying113c(m, pCand) === 0) {
      newLeaderId = candId
      newLeaderIdx = i
      break
    }
  }
  if (newLeaderIdx < 0) return

  const remaining = minions.filter((_, idx) => idx !== newLeaderIdx)
  world.minionIdsByLeaderId.delete(selfId)
  world.minionIdsByLeaderId.set(newLeaderId, remaining)

  m.set(pAiGen, D2AiGeneralStrc.dwLeaderId, newLeaderId >>> 0)
  for (const memberId of [newLeaderId, ...remaining]) {
    const pMember = world.monsterById.get(memberId)
    if (pMember === undefined) continue
    const pMemData = m.get(pMember, D2UnitStrc.pUnitData)
    if (pMemData === 0) continue
    const pMemAi = m.get(pMemData, D2MonsterDataStrc.pAiGeneral)
    if (pMemAi !== 0) {
      m.set(pMemAi, D2AiGeneralStrc.dwLeaderId, newLeaderId >>> 0)
    }
  }
}

/**
 * Slice helper for `D2Game:0x6FC51000` (`ITEMS_RollMonsterTreasureClass` -> `0x6FC32D60` / `0x6FC32380`):
 * Resolves the monster's `MonStats.bin` `TreasureClass` column (`diff * 4` normal / `+1` champ / `+2` unique / `+3` quest),
 * counts active game players and same-room/party players from `pGame->pUnitLists[0]` (`0x6FC51190..0x6FC51251`),
 * and executes the full 1.13c `TreasureClassEx.txt` expansion engine (`rollTreasureClass`) on `pMonster->pSeed`.
 */
function rollMonsterDeathDrop113c(
  world: FallenSliceWorld113c,
  pMonster: number,
  row: MonStats113cRow,
): void {
  if (!row.killable) return
  const { m, pGame } = world
  const diff = getDifficultyIdx113c(m, pGame)
  const tcName = row.tc[diff * 4].trim()
  if (tcName.length === 0) return

  // 0x6FC51190..0x6FC51251: count active living players in `pGame` (`gamePlayers`) and same-area/party players (`partyPlayers`)
  const monPath = m.get(pMonster, D2UnitStrc.pPath)
  const monRoom = monPath !== 0 ? m.get(monPath, D2DynamicPathStrc.pRoom) : 0
  const nearRoomSet = new Set<number>()
  if (monRoom !== 0) {
    nearRoomSet.add(monRoom)
    const ppRooms = m.get(monRoom, D2ActiveRoomStrc.ppRoomsNear)
    const nRooms = m.get(monRoom, D2ActiveRoomStrc.nRoomsNear)
    for (let i = 0; i < nRooms; i++) {
      const rPtr = ppRooms !== 0 ? m.u32(ppRooms + i * 4) : 0
      if (rPtr !== 0) nearRoomSet.add(rPtr)
    }
  }

  let gamePlayers = 0
  let partyPlayers = 0
  if (pGame !== 0) {
    for (let b = 0; b < 128; b++) {
      for (
        let pPlr = m.get(pGame, D2GameStrc.pUnitHash, b);
        pPlr !== 0;
        pPlr = m.get(pPlr, D2UnitStrc.pGameHashNext)
      ) {
        if (SUNIT_IsDeadOrDying113c(m, pPlr) !== 0) continue
        gamePlayers++
        const plrPath = m.get(pPlr, D2UnitStrc.pPath)
        const plrRoom = plrPath !== 0 ? m.get(plrPath, D2DynamicPathStrc.pRoom) : 0
        if (nearRoomSet.size === 0 || nearRoomSet.has(plrRoom)) {
          partyPlayers++
        }
      }
    }
  }

  const tcTable = getCanonicalTcTable113c()
  const seed = UNITS_GetSeed113c(m, pMonster)
  const rng = new D2Rng()
  rng.setSeed(seed.lo, seed.hi)
  const monPlayerCount = STATLIST_GetUnitStat113c(m, pMonster, STAT_MONSTER_PLAYERCOUNT, 0) | 0
  const isExpansion =
    pGame !== 0 &&
    (m.u16(pGame + 0x6a) === 3 || m.get(pGame, D2GameStrc.bExpansion) !== 0)

  rollTreasureClass(tcName, {
    rng,
    tcTable,
    gamePlayers,
    partyPlayers,
    monsterPlayerCount: monPlayerCount,
    isExpansion,
  })
  UNITS_SetSeed113c(m, pMonster, rng.lo >>> 0, rng.hi >>> 0)
}

/**
 * Slice helper for `D2Game:0x6FCFEA00` -> `0x6FCFE8F0` -> `0x6FCFC030` (`SUNITDMG_AddExperienceForKill`):
 * Computes base monster XP from `STAT_EXPERIENCE (13)` (or `MonStats.bin` `Exp` × `MonLvl.bin` `XP` / 100
 * when `STAT_EXPERIENCE == 0`), scales through `calculateKillExperienceGain113c` (`0x6FCFC030`:
 * `0x6FCFAA40` level-diff + `0x6FCFA9E0` `ExpRatio` + `stat 85` `item_addexperience`), and adds to killer's `STAT_EXPERIENCE`.
 */
function awardMonsterKillExperience113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller: number,
  row: MonStats113cRow,
): void {
  if (pKiller === 0 || m.get(pKiller, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return
  const diff = getDifficultyIdx113c(m, pGame)
  const mlvl = STATLIST_GetUnitStat113c(m, pMonster, STAT_LEVEL, 0) | 0

  let rawExp = STATLIST_GetUnitStat113c(m, pMonster, STAT_EXPERIENCE, 0) | 0
  if (rawExp <= 0) {
    const monExpFactor = row.exp[diff]
    if (monExpFactor > 0 && mlvl > 0) {
      if (row.noRatio) {
        rawExp = monExpFactor
      } else {
        const lvlIdx = Math.min(mlvl, MONLVL_113C_ROWS.length - 1)
        const lvlRow = MONLVL_113C_ROWS[lvlIdx]
        if (lvlRow === undefined) {
          throw new RangeError(`Missing MonLvl.bin row for mlvl=${mlvl}`)
        }
        rawExp = Math.trunc((lvlRow.xp[diff] * monExpFactor) / 100)
      }
    }
  }
  if (rawExp <= 0) return

  const clvl = STATLIST_GetUnitStat113c(m, pKiller, STAT_LEVEL, 0) | 0
  const addExpPct = STATLIST_GetUnitStat113c(m, pKiller, STAT_ADDEXPERIENCE, 0) | 0
  const gain = calculateKillExperienceGain113c({
    rawExp,
    clvl,
    mlvl,
    addExpPct,
  })
  if (gain > 0) {
    const curXp = STATLIST_GetUnitStat113c(m, pKiller, STAT_EXPERIENCE, 0) | 0
    STATLIST_SetUnitStat113c(m, pKiller, STAT_EXPERIENCE, (curXp + gain) | 0, 0)
  }
}

/** `@va D2Game:0x6FC96270` (`MONSTER_StartDeath`, `DT = 0`). */
export function MONSTER_StartDeath113c(
  world: FallenSliceWorld113c,
  pMonster: number,
  pKiller: number,
): void {
  const { m, pGame } = world
  const prevMode = m.get(pMonster, D2UnitStrc.dwAnimMode)
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  // 0x6FC96295..0x6FC962A5: `pMonData+0x50 = 0`; if `prevMode != 1`, call `MONSTER_SavePrevMode(pMonster, prevMode)`
  if (pMonData !== 0) {
    m.setU32(pMonData + 0x50, 0)
  }
  if (prevMode !== 1) {
    MONSTER_SavePrevMode113c(m, pMonster, prevMode)
  }

  const pAiCtrl = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiControl) : 0
  if (pAiCtrl !== 0) {
    // 0x6FC95E10 -> 0x6FC94F90 (`rawPathType == 0x64` for `DT = 0`): clears overrides, sets `velApplied = 0`, `chaseSteps = 0xFFFFFFFF`
    m.set(pAiCtrl, D2AiControlStrc.dwPathTypeOverride, 0)
    m.set(pAiCtrl, D2AiControlStrc.dwVelocityOverride, 0)
    m.set(pAiCtrl, D2AiControlStrc.bNewDistOverride, 0)
    m.setU32(pAiCtrl + 0x10, 0)
    m.setU32(pAiCtrl + 0x14, 0xffffffff)
  }
  if (pGame !== 0) {
    m.set(
      pGame,
      D2GameStrc.dwMonSpawnCount,
      (m.get(pGame, D2GameStrc.dwMonSpawnCount, 0) + 1) >>> 0,
      0,
    )
  }

  // 0x6FC953F0..0x6FC9541C + 0x6FC95F9B: clear `0x800C` (plus `0x02` if non-corpse) and set `0x80000` (`UNITFLAG_MODE_CHANGED_TICK`)
  const nextFlags = ((m.get(pMonster, D2UnitStrc.dwFlags) & ~0x800c) | UNITFLAG_MODE_CHANGED_TICK) >>> 0
  const nextFlags2 = (m.get(pMonster, D2UnitStrc.dwFlags2) | UNITFLAG2_CORPSE_SELECTABLE) >>> 0
  m.set(pMonster, D2UnitStrc.dwFlags, nextFlags)
  m.set(pMonster, D2UnitStrc.dwFlags2, nextFlags2)

  const pu = world.pathUnitByPtr.get(pMonster)
  if (pu !== undefined && pu.pDynamicPath !== null) {
    syncDynamicPathFromMem113c(world, pu)
    if (pKiller !== 0) {
      const killerPu = world.pathUnitByPtr.get(pKiller)
      PATH_SetTargetUnit(pu.pDynamicPath, killerPu !== undefined ? killerPu : null)
    }
    PATH_SetDistance(pu.pDynamicPath, 20)
    // 0x6FCFEFCD..0x6FCFEFFE: SUNITDMG_KillMonster computes hitDir via D2Common.#10192 (0x6FD7F910)
    const killerPos = pKiller !== 0 ? getUnitPosSubtile113c(m, pKiller) : null
    const hitDir =
      killerPos !== null
        ? PATH_ComputeDirection(pu.pDynamicPath.wPosX, pu.pDynamicPath.wPosY, killerPos.x, killerPos.y)
        : pu.pDynamicPath.nDirection
    m.set(pMonster, D2UnitStrc.dwAnimMode, 0)
    pu.dwAnimMode = 0
    pu.dwFlags = nextFlags
    pu.dwFlagEx = nextFlags2
    PATH_SetUnitDeadCollision(pu, true)
    pu.pDynamicPath.dwPrecisionX = toFP16Center(pu.pDynamicPath.wPosX)
    pu.pDynamicPath.dwPrecisionY = toFP16Center(pu.pDynamicPath.wPosY)
    // 0x6FC95445: D2Common.#10706 (PATH_SetDirection)
    PATH_SetDirection(pu.pDynamicPath, hitDir)
    syncDynamicPathToMem113c(world, pu)
  } else {
    m.set(pMonster, D2UnitStrc.dwAnimMode, 0)
  }

  const row = getMonStatsRow113c(m, pMonster)
  const dtFrames = getMonsterModeBaseFrameCount113c(row.hcIdx, 0)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  writeUnitAnimState113c(m, pMonster, 0, frame << 8, dtFrames << 8, 256, 0)

  const pPath = m.get(pMonster, D2UnitStrc.pPath)
  const pRoom = pPath !== 0 ? m.get(pPath, D2DynamicPathStrc.pRoom) : 0
  ROOM_RecordMonsterDeath113c(m, pRoom, m.get(pMonster, D2UnitStrc.dwUnitId))

  promotePackLeaderOnDeath113c(world, pMonster)
  rollMonsterDeathDrop113c(world, pMonster, row)
  awardMonsterKillExperience113c(m, pGame, pMonster, pKiller, row)

  MONSTER_ClearModeEvents113c(m, pGame, pMonster)
  EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)
  EVENT_SetEventFull113c(m, pGame, pMonster, MON_EVENT_MODE_END, (frame + dtFrames) >>> 0, 0, 0, 0)
}

/**
 * `@va D2Game:0x6FC96040` (`MONSTER_EndDeath`, `DT -> DD = 12`):
 * Clears mode events, sets `dwAnimMode = 12` (`DD`), and sets 1-frame corpse anim state
 * (`dwFrameCount = 256`, `wAnimSpeed = 256`) without setting `0x10000` on `dwFlags`.
 */
export function MONSTER_EndDeath113c(world: FallenSliceWorld113c, pMonster: number): void {
  const { m, pGame } = world
  MONSTER_ClearModeEvents113c(m, pGame, pMonster)
  m.set(pMonster, D2UnitStrc.dwAnimMode, 12)
  writeUnitAnimState113c(m, pMonster, 0, 0, 256, 256, 0)
  const pu = world.pathUnitByPtr.get(pMonster)
  if (pu !== undefined) {
    pu.dwAnimMode = 12
  }
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

/**
 * `@va D2Game:0x6FCFDE90` (`SUNITDMG_CheckToHit`):
 * Computes hit chance (`[5, 95]`) and rolls `SEED_RollLimited(pAttacker->pSeed, 100) < hitChance` (`0x6FCFE08B`).
 * Note: the running-defender auto-hit check is in caller `0x6FCFE5F1` (`SUNITDMG_ExecuteMissileOrMeleeDmg113c`).
 */
export function SUNITDMG_CheckToHit113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  arBonus = 0,
): boolean {
  const hitChance = SUNITDMG_ComputeHitChance113c(m, pGame, pAttacker, pDefender, arBonus)
  const toHitRoll = rollUnitLimited(m, pAttacker, 100)
  return toHitRoll < hitChance
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

/**
 * Slice helper for `D2Game:0x6FCFE0C0` (`SUNITDMG_ExecuteEvents`):
 * Applies total damage to `STAT_HITPOINTS (6)`, enforces the `0x6FCFE255` `< 0x100` (`256`) -> `0`
 * fixed-point death clamp, sets `HITFLAG_DEATH (0x02)` or `HITFLAG_GETHIT (0x04)`, and reschedules
 * monster `Event 3` (`STAT_REGEN`) when `STAT_HPREGEN (74) != 0` (`0x6FCFE2E2..0x6FCFE336`).
 */
export function SUNITDMG_ExecuteEvents113c(
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
  if (!isRunningPlayer && !SUNITDMG_CheckToHit113c(m, pGame, pAttacker, pDefender, arBonus)) {
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
  SUNITDMG_ExecuteEvents113c(world, pAttacker, pDefender, dmgData)
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
 * `@va D2Game:0x6FC97BB0` (`PLAYER_DrainRunStamina`):
 * Checks room town flag (`#10057` `0x6FD8C390` at `0x6FC97BBB`, returns `1` if town), requires
 * `pPlayer->pInventory != 0` (`0x6FC97BFE`), multiplies `(CharStats.runDrain << 1)` by torso
 * armor `dwSpeed/10 + 1` (`#11139` `bodyLoc = 3` at `0x6FC97C08..0x6FC97C3A`), scales by
 * `STAT_STAMINADRAINPCT (154)` (`drain += Math.trunc((drainPct * drain) / -100)` at
 * `0x6FC97C4E..0x6FC97C64`), clamps `if (drain < 1) drain = 1` (`0x6FC97C6B`), applies
 * `STATLIST_AddUnitStat(pPlayer, 10, -drain, 0)` (`0x6FC97C78`), and returns `1` if remaining
 * stamina `> 0`, else clamps `STAT_STAMINA = 0` (`0x6FC97C92`) and returns `0`.
 */
export function PLAYER_DrainRunStamina113c(m: Memory113c, pPlayer: number): number {
  if (pPlayer === 0 || m.get(pPlayer, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return 0
  if (DUNGEON_CheckRoomIsTown113c(m, UNITS_GetRoom113c(m, pPlayer)) !== 0) return 1
  const pInventory = m.get(pPlayer, D2UnitStrc.pInventory)
  if (pInventory === 0) return 0

  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const charStats = getCharStatsByClassId113c(classId)
  let drain = charStats.runDrain << 1
  const pTorso = INVENTORY_GetItemFromBodyLoc113c(m, pInventory, BODYLOC_TORSO)
  if (pTorso !== 0 && m.get(pTorso, D2UnitStrc.dwUnitType) === UNIT_ITEM) {
    const rec = DATATBLS_GetItemsTxtRecord113c(m.get(pTorso, D2UnitStrc.dwClassId))
    if (rec !== null) {
      drain = Math.imul(drain, (Math.trunc(rec.dwSpeed / 10) + 1) | 0)
    }
  }
  const drainPct = STATLIST_GetUnitStat113c(m, pPlayer, STAT_STAMINADRAINPCT, 0) | 0
  if (drainPct !== 0) {
    drain = (drain + Math.trunc(Math.imul(drainPct, drain) / -100)) | 0
  }
  if (drain < 1) drain = 1

  STATLIST_AddUnitStat113c(m, pPlayer, STAT_STAMINA, -drain, 0)
  if ((STATLIST_GetUnitStat113c(m, pPlayer, STAT_STAMINA, 0) | 0) > 0) {
    return 1
  }
  STATLIST_SetUnitStat113c(m, pPlayer, STAT_STAMINA, 0, 0)
  return 0
}

/**
 * `@va D2Game:0x6FC97CB0` (`PLAYER_UpdateHpRegen`):
 * Adds `STAT_HPREGEN (74)` to `STAT_HITPOINTS (6)`, removes `STATE_HEALTHPOT (100)` when `nextHp > maxHp`
 * (`0x6FC97CE2..0x6FC97CFA`), clamps `if (nextHp < 0x100) nextHp = 0x100` (`0x6FC97CFE`), and updates
 * `stat 352` (`0x6FC97D17..0x6FC97D80`).
 */
export function PLAYER_UpdateHpRegen113c(m: Memory113c, pPlayer: number): void {
  if (pPlayer === 0 || m.get(pPlayer, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return
  const curHp = STATLIST_GetUnitStat113c(m, pPlayer, STAT_HITPOINTS, 0) | 0
  if (curHp <= 0) return
  const maxHp = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXHP, 0) | 0
  const hpRegen = STATLIST_GetUnitStat113c(m, pPlayer, STAT_HPREGEN, 0) | 0
  let nextHp = (curHp + hpRegen) | 0
  if (nextHp > maxHp) {
    nextHp = maxHp
    if (STATES_CheckState113c(m, pPlayer, 100) !== 0) {
      const pPotList = STATLIST_GetStatListFromUnitAndState113c(m, pPlayer, 100)
      if (pPotList !== 0) {
        STATLIST_RemoveStatListFromUnit113c(m, pPlayer, pPotList)
      }
      STATES_ToggleState113c(m, pPlayer, 100, false)
    }
  }
  if (nextHp < 0x100) nextHp = 0x100
  if (nextHp !== curHp) {
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_HITPOINTS, nextHp, 0)
    const hpPct = maxHp > 0 ? mulDiv113c(nextHp, 100, maxHp) : 0
    const hpTier = hpPct > 8 ? 3 : hpPct > 4 ? 2 : 1
    if (STATLIST_GetUnitStat113c(m, pPlayer, STAT_HP_TIER_ICON, 0) !== hpTier) {
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_HP_TIER_ICON, hpTier, 0)
      UNITROOM_RefreshUnit113c(m, pPlayer)
    }
  }
}

/**
 * `@va D2Game:0x6FC97950` (`PLAYER_UpdateManaRegen`):
 * Skips when `STATE_INFERNO (85)` is active (`0x6FC97972`), uses `7500` (`0x1D4C`) default divisor,
 * scales `maxMana / (25 * manaRegenSeconds)` by `100 + stat 27` (`manarecoverybonus`), adds `stat 26`
 * (`manarecovery`), removes `STATE_MANAPOT (106)` when reaching `maxMana` (`0x6FC97A00..0x6FC97A27`),
 * and clamps `delta` to `[-curMana, maxMana - curMana]`.
 */
export function PLAYER_UpdateManaRegen113c(m: Memory113c, pPlayer: number): void {
  if (pPlayer === 0 || m.get(pPlayer, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return
  if (STATES_CheckState113c(m, pPlayer, 85) !== 0) return
  const maxMana = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXMANA, 0) | 0
  if (maxMana <= 0) return

  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const charStats = getCharStatsByClassId113c(classId)
  const regenFrames =
    charStats.manaRegenSeconds > 0 ? Math.imul(charStats.manaRegenSeconds, 25) : 7500
  const baseRate = Math.trunc(maxMana / regenFrames) | 0
  const manaBonusPct = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MANARECOVERYBONUS, 0) | 0
  const scaledRate = Math.trunc(Math.imul(baseRate, 100 + manaBonusPct) / 100) | 0
  const flatManaRec = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MANARECOVERY, 0) | 0
  let delta = (scaledRate + flatManaRec) | 0
  if (delta === 0) return

  const curMana = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MANA, 0) | 0
  const maxAdd = (maxMana - curMana) | 0
  if (delta >= maxAdd) {
    if (STATES_CheckState113c(m, pPlayer, 106) !== 0) {
      const pPotList = STATLIST_GetStatListFromUnitAndState113c(m, pPlayer, 106)
      if (pPotList !== 0) {
        STATLIST_RemoveStatListFromUnit113c(m, pPlayer, pPotList)
      }
      STATES_ToggleState113c(m, pPlayer, 106, false)
    }
    delta = maxAdd
  }
  const minSub = -curMana | 0
  if (delta < minSub) {
    delta = minSub
  }
  if (delta !== 0) {
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_MANA, (curMana + delta) | 0, 0)
  }
}

/**
 * `@va D2Game:0x6FC97A50` (`PLAYER_UpdateStaminaRegen`):
 * Jump-table `0x6FC97B04[mode]` (`mode <= 19`):
 * - `mode 1 (NU)` / `mode 5 (TN)` (`0x6FC97A6E`): `baseDelta = maxStam >> 8`
 * - `mode 2 (WL)` (`0x6FC97A7C`): if `curStam < 256` (`0x100`) return, else `baseDelta = maxStam >> 9`
 * - `mode 6 (TW)` (`0x6FC97AA7`): `baseDelta = maxStam >> 9`
 * - `mode 0 (DT)` / `mode 17 (DD)` (`0x6FC97B03`): return
 * - `mode 3 (RN)` / `mode 4 (GH)` / `7..16` / `18..19` (`0x6FC97A92`): if `stat 28 < 1000` (`0x3E8`) return, else `baseDelta = maxStam >> 8`.
 */
export function PLAYER_UpdateStaminaRegen113c(m: Memory113c, pPlayer: number): void {
  if (pPlayer === 0 || m.get(pPlayer, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return
  const mode = m.get(pPlayer, D2UnitStrc.dwAnimMode) >>> 0
  if (mode > 19 || mode === 0 || mode === 17) return

  const curStam = STATLIST_GetUnitStat113c(m, pPlayer, STAT_STAMINA, 0) | 0
  const maxStam = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXSTAMINA, 0) | 0
  const stamBonusPct = STATLIST_GetUnitStat113c(m, pPlayer, STAT_STAMINARECOVERYBONUS, 0) | 0

  let baseDelta: number
  if (mode === PLRMODE_NEUTRAL || mode === PLRMODE_TOWN_NEUTRAL) {
    baseDelta = maxStam >> 8
  } else if (mode === PLRMODE_WALK) {
    if (curStam < 0x100) return
    baseDelta = maxStam >> 9
  } else if (mode === PLRMODE_TOWN_WALK) {
    baseDelta = maxStam >> 9
  } else {
    if (stamBonusPct < 1000) return
    baseDelta = maxStam >> 8
  }

  const delta =
    stamBonusPct !== 0
      ? (baseDelta + Math.trunc(Math.imul(baseDelta, stamBonusPct) / 100)) | 0
      : baseDelta
  if (delta <= 0) return

  if (curStam < maxStam) {
    let nextStam = (curStam + delta) | 0
    if (nextStam > maxStam) nextStam = maxStam
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_STAMINA, nextStam, 0)
  }
}

/**
 * `@va D2Game:0x6FC99B10` (`PLAYER_Event3_RegenTick`):
 * Reschedules `Event 3` (`+1` frame) BEFORE the dead check (`0x6FC99B18..0x6FC99B26`), then
 * executes `HP -> Stamina -> Mana` in exact binary order (`0x6FC99B47..0x6FC99B58`).
 */
export function PLAYER_Event3_RegenTick113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): void {
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  EVENT_SetEventFull113c(m, pGame, pPlayer, PLR_EVENT_STAMINA, (frame + 1) >>> 0, 0, 0, 0)
  if (SUNIT_IsDeadOrDying113c(m, pPlayer) !== 0) return
  PLAYER_UpdateHpRegen113c(m, pPlayer)
  PLAYER_UpdateStaminaRegen113c(m, pPlayer)
  PLAYER_UpdateManaRegen113c(m, pPlayer)
}

/** `@va D2Game:0x6FC99A60` (`PLAYER_Event11_PeriodicTick`): reschedules `Event 11` (`+30` frames, `0x1E`). */
export function PLAYER_Event11_PeriodicTick113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): void {
  if (SUNIT_IsDeadOrDying113c(m, pPlayer) !== 0) return
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  EVENT_SetEventFull113c(m, pGame, pPlayer, PLR_EVENT_IDLE, (frame + 30) >>> 0, 0, 0, 0)
}

function transitionPlayerToNeutral113c(world: FallenSliceWorld113c, pPlayer: number): void {
  const { m, pGame } = world
  MONSTER_ClearModeEvents113c(m, pGame, pPlayer)
  m.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL)
  const nextFlags = (m.get(pPlayer, D2UnitStrc.dwFlags) & ~UNITFLAG_IN_SKILL_ACTION) >>> 0
  m.set(pPlayer, D2UnitStrc.dwFlags, nextFlags)
  const pu = world.pathUnitByPtr.get(pPlayer)
  if (pu !== undefined) {
    pu.dwAnimMode = PLRMODE_NEUTRAL
    pu.dwFlags = nextFlags
  }
  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const weaponClass = resolvePlayerWeaponClass113c(world, pPlayer)
  const nuClip = getCharAnimClip113c(classId, PLRMODE_NEUTRAL, { weaponClass })
  writeUnitAnimState113c(m, pPlayer, 0, 0, nuClip.frames << 8, nuClip.speed, 0)
}

/**
 * `@va D2Game:0x6FCFF7B0` (`SUNIT_ScheduleModeAnimEvents`):
 * Exact x86 fixed-point animation event scheduler (`0x6FCFF7B9..0x6FCFF8F0`):
 * steps `acc = (startFrame << 8) + stepSpeed` while `acc < (clip.frames << 8)`, scanning
 * `AnimData.d2` event bytes `edi <= (acc >> 8)` (`edi < 0x90`) to register `Event 0`
 * (`arg14 = evCode`, `arg18 = hitIdx` for codes `1..2`) and finally `Event 1` (`MODE_END`)
 * at `ebx + 1`.
 */
export function SUNIT_ScheduleModeAnimEvents113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  clip: CharAnimClip113c,
  startFrame: number,
  stepSpeed: number,
): void {
  const gameFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  if (stepSpeed <= 0) {
    EVENT_SetEventFull113c(m, pGame, pUnit, PLR_EVENT_MODE_END, (gameFrame + 1) >>> 0, 0, 0, 0)
    return
  }
  const frameCount256 = clip.frames << 8
  let edi = startFrame | 0
  let acc = ((edi << 8) + stepSpeed) | 0
  let ebx = gameFrame
  let hitIdx = 0

  while (acc < frameCount256) {
    const frameIdx = acc >> 8
    ebx = (ebx + 1) >>> 0
    while (edi <= frameIdx && edi < 0x90) {
      let evCode = 0
      for (const ev of clip.events) {
        if (ev.f === edi) {
          evCode = ev.c
          break
        }
      }
      if (evCode >= 1 && evCode <= 4) {
        const arg18 = evCode === 1 || evCode === 2 ? hitIdx++ : 0
        EVENT_SetEventFull113c(m, pGame, pUnit, PLR_EVENT_MODE_STEP, ebx, 0, evCode, arg18)
      }
      edi++
    }
    acc = (acc + stepSpeed) | 0
  }

  if (ebx === gameFrame) {
    ebx = (ebx + 1) >>> 0
  }
  EVENT_SetEventFull113c(m, pGame, pUnit, PLR_EVENT_MODE_END, (ebx + 1) >>> 0, 0, 0, 0)
}

/**
 * `@va D2Game:0x6FC987C0` (`PLAYER_StartModeAttackWithTarget`) + `D2Common.#11129` (`0x6FD80E80`) +
 * `D2Common.#10031` (`0x6FD82220`) + `D2Common.#10819` (`0x6FD83180`):
 * Handle C2S `0x06` (`AttackUnit`: `06 [unitType:u32] [unitId:u32]`) on `pPlayer` during
 * `D2Game.#10040` (`0x6FC4E460`, before `pGame->dwGameFrame++` in `0x6FC4E050`).
 */
export function applyPlayerPacket113c(
  world: FallenSliceWorld113c,
  pPlayer: number,
  packetBytes: Uint8Array,
): void {
  if (packetBytes.length < 9 || packetBytes[0] !== 0x06) return
  const { m, pGame } = world
  const view = new DataView(packetBytes.buffer, packetBytes.byteOffset, packetBytes.byteLength)
  const targetType = view.getUint32(1, true)
  const targetId = view.getUint32(5, true)

  let pTarget = 0
  if (targetType === UNIT_MONSTER) {
    const foundMon = world.monsterById.get(targetId)
    pTarget = foundMon !== undefined ? foundMon : 0
  } else {
    const foundAny = world.unitsByKey.get(unitKey(targetType, targetId))
    pTarget = foundAny !== undefined ? foundAny : 0
  }
  if (pTarget === 0) return

  // D2Common.#11129 (0x6FD80E80): bind target unit into pPlayer->pPath (+0x58/+0x5C/+0x60)
  const pPath = m.get(pPlayer, D2UnitStrc.pPath)
  if (pPath !== 0) {
    m.set(pPath, D2DynamicPathStrc.pTargetUnit, pTarget)
    m.set(pPath, D2DynamicPathStrc.dwTargetType, targetType)
    m.set(pPath, D2DynamicPathStrc.dwTargetId, targetId)
  }
  const pu = world.pathUnitByPtr.get(pPlayer)
  if (pu !== undefined && pu.pDynamicPath !== null) {
    const targetPu = world.pathUnitByPtr.get(pTarget)
    PATH_SetTargetUnit(pu.pDynamicPath, targetPu !== undefined ? targetPu : null)
  }

  m.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_ATTACK1)
  const nextFlags = (m.get(pPlayer, D2UnitStrc.dwFlags) | UNITFLAG_IN_SKILL_ACTION) >>> 0
  m.set(pPlayer, D2UnitStrc.dwFlags, nextFlags)
  if (pu !== undefined) {
    pu.dwAnimMode = PLRMODE_ATTACK1
    pu.dwFlags = nextFlags
  }

  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const weaponClass = resolvePlayerWeaponClass113c(world, pPlayer)
  const clip = getCharAnimClip113c(classId, PLRMODE_ATTACK1, { weaponClass })
  const stat93 = STATLIST_GetUnitStat113c(m, pPlayer, STAT_FASTERATTACKRATE, 0) | 0
  const stat68 = STATLIST_GetUnitStat113c(m, pPlayer, STAT_ATTACKRATE, 0) | 0
  const stat67 = STATLIST_GetUnitStat113c(m, pPlayer, STAT_VELOCITYPERCENT, 0) | 0
  const stepSpeed = computeRawPlayerAnimSpeed113c({
    mode: PLRMODE_ATTACK1,
    classId,
    statAcc: stat93,
    stat68Acc: stat68,
    stat67Acc: stat67,
    weaponClass,
  })
  const startFrame = playerAnimStartFrame113c(classId, PLRMODE_ATTACK1, weaponClass)

  writeUnitAnimState113c(m, pPlayer, 0, 0, clip.frames << 8, stepSpeed, 0)

  // 0x6FC98812: MONSTER_ClearModeEvents (0x6FD00750) followed by 0x6FCFF7B0
  MONSTER_ClearModeEvents113c(m, pGame, pPlayer)
  SUNIT_ScheduleModeAnimEvents113c(m, pGame, pPlayer, clip, startFrame, stepSpeed)
}

/**
 * Hydrate a complete `FallenSliceWorld113c` directly from `a1c-memdump-f785.ndjson.gz` and
 * `a1c-coll-f785.bin.gz` in `SparseMemory113c` (with zero legacy server dependencies).
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
  // Populate `pGame->pUnitHash` (`+0x1120`) player hash buckets and `clientById` (`pPlayerData+0x9C -> pClient+0x00`)
  const clientById = new Map<number, number>()
  for (const pUnit of playerById.values()) {
    const uId = m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0
    m.set(pGame, D2GameStrc.pUnitHash, pUnit, uId & 0x7f)
    const pPlrData = m.get(pUnit, D2UnitStrc.pUnitData) >>> 0
    if (pPlrData !== 0) {
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

  const sharedGrid: PathCollisionGrid = {
    get(x: number, y: number): number {
      const rx = (x | 0) - cx0
      const ry = (y | 0) - cy0
      if (rx < 0 || ry < 0 || rx >= cw || ry >= ch) return COLLIDE_MASK_INVALID
      return maskCells[ry * cw + rx]!
    },
    set(x: number, y: number, value: number): void {
      const rx = (x | 0) - cx0
      const ry = (y | 0) - cy0
      if (rx < 0 || ry < 0 || rx >= cw || ry >= ch) return
      maskCells[ry * cw + rx] = value & 0xffff
    },
  }

  // Build `PathRoom` objects verbatim from dumped `room`, `roomex`, `level`, and `roomsnear` blocks in `SparseMemory113c`
  const roomByPtr = new Map<number, MutablePathRoom113c>()
  for (const rPtr of roomPtrs) {
    const subX = m.get(rPtr, D2ActiveRoomStrc.nSubtileX) | 0
    const subY = m.get(rPtr, D2ActiveRoomStrc.nSubtileY) | 0
    const subW = m.get(rPtr, D2ActiveRoomStrc.nSubtileWidth) | 0
    const subH = m.get(rPtr, D2ActiveRoomStrc.nSubtileHeight) | 0
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

  // Build `PathUnit` + `DynamicPath` wrappers for all units
  const pathUnitByPtr = new Map<number, MutablePathUnit113c>()
  for (const pUnit of unitsByKey.values()) {
    if (m.get(pUnit, D2UnitStrc.dwUnitType) === UNIT_ITEM) continue
    const pPath = m.get(pUnit, D2UnitStrc.pPath)
    const dp = pPath !== 0 ? new DynamicPath() : null
    const pu: MutablePathUnit113c = {
      pUnit,
      pPath,
      dwUnitType: m.get(pUnit, D2UnitStrc.dwUnitType),
      dwClassId: m.get(pUnit, D2UnitStrc.dwClassId),
      dwUnitId: m.get(pUnit, D2UnitStrc.dwUnitId),
      dwAnimMode: m.get(pUnit, D2UnitStrc.dwAnimMode),
      dwFlags: m.get(pUnit, D2UnitStrc.dwFlags),
      dwFlagEx: m.get(pUnit, D2UnitStrc.dwFlags2),
      pDynamicPath: dp,
      pStaticPath: null,
      objectTxt: null,
    }
    if (dp !== null) dp.pUnit = pu
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
  for (const pu of pathUnitByPtr.values()) {
    syncDynamicPathFromMem113c(world, pu)
  }
  return world
}

/**
 * `@va D2Game:0x6FC4E460` (`D2Game.#10040`) + `@va D2Game:0x6FC4E050` (`D2Game.#10008` per-frame step):
 * 1. Drain incoming C2S packets (`0x6FC4E485..0x6FC4E4A3`) while `pGame->dwGameFrame` is still at `N`.
 * 2. Increment `pGame->dwGameFrame` to `N + 1` (`0x6FC4E053..0x6FC4E063`).
 * 3. Execute `EVENT_UpdateTimers113c` (`0x6FCAF070`) across partitions `[2, 0, 1, 3, 4]`.
 * 4. Clear per-tick room-sync dirty flags (`dwFlags &= ~0x80001`).
 */
export function stepFallenSliceFrame113c(
  world: FallenSliceWorld113c,
  c2sPackets: ReadonlyArray<readonly [clientId: number, hexPayload: string]> = [],
): number {
  const { m, pGame } = world
  world.lastFrameOrd.length = 0
  world.lastFrameDmg.length = 0

  for (const [clientId, hexPayload] of c2sPackets) {
    const pPlayer = world.clientById?.get(clientId >>> 0)
    if (pPlayer === undefined || pPlayer === 0) {
      throw new Error(`Unmapped C2S clientId ${clientId}`)
    }
    applyPlayerPacket113c(world, pPlayer, decodeHexBytes113c(hexPayload))
  }

  const nextFrame = ((m.get(pGame, D2GameStrc.dwGameFrame) >>> 0) + 1) >>> 0
  m.set(pGame, D2GameStrc.dwGameFrame, nextFrame)

  const fired = EVENT_UpdateTimers113c(m, pGame, (_mem, _g, pUnit, evType, arg14, arg18, _fn, pNode) => {
    if (pUnit === 0) return
    const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
    const uId = m.get(pUnit, D2UnitStrc.dwUnitId)

    if (uType === UNIT_PLAYER) {
      if (evType === PLR_EVENT_MODE_STEP) {
        const mode = m.get(pUnit, D2UnitStrc.dwAnimMode)
        if (
          mode === PLRMODE_WALK ||
          mode === PLRMODE_RUN ||
          mode === PLRMODE_TOWN_WALK ||
          mode === 19
        ) {
          // 0x6FD279D0[mode] = 0x6FC99B90 (locomotion step)
          const pu = world.pathUnitByPtr.get(pUnit)
          if (pu !== undefined && pu.pDynamicPath !== null) {
            syncDynamicPathFromMem113c(world, pu)
            if (mode === PLRMODE_RUN) {
              PLAYER_DrainRunStamina113c(m, pUnit)
            }
            const stepped = D2Common_10226(pu, 0)
            syncDynamicPathToMem113c(world, pu)
            if (stepped === 0) {
              transitionPlayerToNeutral113c(world, pUnit)
            }
          }
        } else if (mode >= PLRMODE_ATTACK1 && mode <= 18 && mode !== 17 && mode !== 9) {
          // 0x6FD279D0[mode] = 0x6FC99170 (skill action keyframe)
          if (arg14 === 1) {
            const pPath = m.get(pUnit, D2UnitStrc.pPath)
            const pDef = pPath !== 0 ? m.get(pPath, D2DynamicPathStrc.pTargetUnit) : 0
            if (pDef !== 0) {
              SUNITDMG_ExecuteMissileOrMeleeDmg113c(world, pUnit, pDef)
            }
          }
        }
      } else if (evType === PLR_EVENT_MODE_END) {
        if (m.get(pUnit, D2UnitStrc.dwAnimMode) === PLRMODE_ATTACK1) {
          transitionPlayerToNeutral113c(world, pUnit)
        }
      } else if (evType === PLR_EVENT_STAMINA) {
        PLAYER_Event3_RegenTick113c(m, pGame, pUnit)
      } else if (evType === PLR_EVENT_IDLE) {
        PLAYER_Event11_PeriodicTick113c(m, pGame, pUnit)
      }
      return
    }

    if (uType === UNIT_MONSTER) {
      const isPersistent = (m.get(pNode, D2EventStrc.fFlags) & 0x04) !== 0
      const phase = isPersistent ? 2 : 1
      const preMode = m.get(pUnit, D2UnitStrc.dwAnimMode)
      world.lastFrameOrd.push([phase, evType, uType, uId, preMode])

      MONSTER_DispatchEvent113c(m, pGame, pUnit, evType, arg14, arg18, {
        onModeStep(_m, _pg, pMon, entry) {
          if (entry.pfnStep === VA_MONSTER_STEP_WALK_113C) {
            MONSTER_StepWalk113c(world, pMon)
          } else if (entry.pfnStep === VA_MONSTER_STEP_RUN_113C) {
            MONSTER_StepRun113c(world, pMon)
          } else if (entry.pfnStep === VA_MONSTER_CLEAR_STEP_113C) {
            MONSTER_ClearStepEvents113c(m, pGame, pMon)
          }
        },
        onModeEnd(_m, _pg, pMon, entry) {
          if (entry.pfnEnd === VA_MONSTER_END_DEATH_113C) {
            MONSTER_EndDeath113c(world, pMon)
          } else if (entry.pfnEnd === VA_MONSTER_END_TO_AI_113C) {
            MONSTER_EndToAiOrNeutral113c(world, pMon)
          }
        },
        onAiThink(_m, _pg, pMon, _pAiGen, pfnThink) {
          runMonsterAiDriver113c(world, pMon, pfnThink)
        },
      })
    }
  })

  // 0x6FC48BE0 end-of-frame room update sweep: clears per-tick mode/coord dirty bits (`0x80001`).
  for (const pUnit of world.unitsByKey.values()) {
    const curFlags = m.get(pUnit, D2UnitStrc.dwFlags)
    if ((curFlags & UNITFLAG_PER_TICK_SYNC_MASK) !== 0) {
      const cleared = (curFlags & ~UNITFLAG_PER_TICK_SYNC_MASK) >>> 0
      m.set(pUnit, D2UnitStrc.dwFlags, cleared)
      const pu = world.pathUnitByPtr.get(pUnit)
      if (pu !== undefined) pu.dwFlags = cleared
    }
  }

  return fired
}
