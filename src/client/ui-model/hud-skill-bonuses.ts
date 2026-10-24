/**
 * HUD Skill Bonuses & Class/BodyLoc Lookups (`src/client/ui-model/hud-skill-bonuses.ts`).
 *
 * Canonical 1.13c class/bodyLoc lookup tables and client-side `+Skills` equipment, socket, set,
 * runeword, charm, and state bonus preaggregation (`SKILLS_GetSkillLevel` in `D2Common.dll`).
 *
 * Zero imports from `src/netproto/{bncs,mcp,d2gs,crypto}/**` — consumes only `src/netproto/index.ts`.
 */

import {
  CANONICAL_CHI_TBL_DICT,
  CANONICAL_ENG_TBL_DICT,
} from '../../common/data/canonical-tbl-strings.ts'
import { SKILLS_BY_ID, type SkillCatalogEntry } from '../../common/data/skills-catalog.ts'
import { resolveOnlineItemReqLevel } from '../../common/items/item-bridge.ts'
import { skillTabStatParam } from '../../common/skills/skills-data.ts'
import type { CharacterClassCode } from '../../common/units/classes.ts'
import type { CharClassId, ItemData, ItemStat } from '../../netproto/index.ts'
import type { EquipSlotId } from '../ui/inventory.ts'
import type { ClientItemContainers } from '../world/inventory.ts'
import { D2StatId, type StatList } from '../world/stat-list.ts'
import { computeFullSetBonusStats, computeItemSetBonusStats } from './set-bonuses.ts'
import { gemSocketStats, getItemBaseRow, isGemsTxtItem } from './stat-engine.ts'

export const CLASS_ID_TO_CODE: Readonly<Record<CharClassId, CharacterClassCode>> = {
  0: 'ama',
  1: 'sor',
  2: 'nec',
  3: 'pal',
  4: 'bar',
  5: 'dru',
  6: 'ass',
} as const

export const CLASS_ID_TO_NAMES: Readonly<
  Record<CharClassId, { readonly en: string; readonly zh: string }>
> = {
  0: { en: CANONICAL_ENG_TBL_DICT['Amazon'] ?? 'Amazon', zh: CANONICAL_CHI_TBL_DICT['Amazon'] ?? '亞馬遜' },
  1: { en: CANONICAL_ENG_TBL_DICT['Sorceress'] ?? 'Sorceress', zh: CANONICAL_CHI_TBL_DICT['Sorceress'] ?? '法師' },
  2: { en: CANONICAL_ENG_TBL_DICT['Necromancer'] ?? 'Necromancer', zh: CANONICAL_CHI_TBL_DICT['Necromancer'] ?? '死靈法師' },
  3: { en: CANONICAL_ENG_TBL_DICT['Paladin'] ?? 'Paladin', zh: CANONICAL_CHI_TBL_DICT['Paladin'] ?? '聖騎士' },
  4: { en: CANONICAL_ENG_TBL_DICT['Barbarian'] ?? 'Barbarian', zh: CANONICAL_CHI_TBL_DICT['Barbarian'] ?? '野蠻人' },
  5: { en: CANONICAL_ENG_TBL_DICT['Druid'] ?? 'Druid', zh: CANONICAL_CHI_TBL_DICT['Druid'] ?? '德魯依' },
  6: { en: CANONICAL_ENG_TBL_DICT['Assassin'] ?? 'Assassin', zh: CANONICAL_CHI_TBL_DICT['Assassin'] ?? '刺客' },
} as const

export const BODY_LOC_TO_EQUIP_SLOT: Readonly<Record<number, EquipSlotId>> = {
  1: 'helm',
  2: 'amulet',
  3: 'armor',
  4: 'weapon1',
  5: 'weapon2',
  6: 'ring1',
  7: 'ring2',
  8: 'belt',
  9: 'boots',
  10: 'gloves',
} as const

export const EQUIP_SLOT_TO_BODY_LOC: Readonly<Record<EquipSlotId, number>> = {
  helm: 1,
  amulet: 2,
  armor: 3,
  weapon1: 4,
  weapon2: 5,
  ring1: 6,
  ring2: 7,
  belt: 8,
  boots: 9,
  gloves: 10,
} as const

export const CLASS_CODE_TO_ID: Readonly<Record<CharacterClassCode, CharClassId>> = {
  ama: 0,
  sor: 1,
  nec: 2,
  pal: 3,
  bar: 4,
  dru: 5,
  ass: 6,
} as const

const ELEM_TYPE_BY_PARAM: Readonly<Record<number, string>> = {
  1: 'fire',
  2: 'ltng',
  3: 'mag',
  4: 'cold',
  5: 'pois',
} as const

const CHARM_ITEM_CODES = new Set(['cm1', 'cm2', 'cm3'])

export interface PreaggregatedEquipmentSkillBonuses {
  readonly allSkills: number
  readonly classSkills: ReadonlyMap<number, number>
  readonly tabSkills: ReadonlyMap<number, number>
  readonly singleSkills: ReadonlyMap<number, number>
  readonly elemSkills: ReadonlyMap<string, number>
  readonly oskills: ReadonlyMap<number, number>
}

/**
 * Total bonus skill levels used for Speedbar availability and the skill-tree
 * `hard+bonus` display: server-reported bonuses plus equipment "+X to skill"
 * grants ALWAYS apply - including at 0 hard points, because 1.13c item grants
 * (the starting staff's +1 Firebolt, Ormus Robes' +3 to an unlearned skill)
 * make a class skill selectable without any hard investment (issue #848).
 */
export function computeTotalSkillBonus(
  serverBonus: number | undefined,
  equipBonus: number,
): number {
  return Math.max(0, (serverBonus ?? 0) + equipBonus)
}

export function preaggregateEquipmentSkillBonuses(
  containers: Pick<ClientItemContainers, 'equipment' | 'inventory'> & Partial<Pick<ClientItemContainers, 'sockets'>>,
  selfStats?: StatList,
  activeWeaponSet: 0 | 1 = 0,
  wearerLevel?: number,
  charClassCode?: CharacterClassCode | null,
): PreaggregatedEquipmentSkillBonuses {
  let allSkills = 0
  const classSkills = new Map<number, number>()
  const tabSkills = new Map<number, number>()
  const singleSkills = new Map<number, number>()
  const elemSkills = new Map<string, number>()
  const oskills = new Map<number, number>()

  const statLvl = selfStats
    ? typeof selfStats.getBase === 'function' && selfStats.getBase(D2StatId.Level) > 0
      ? selfStats.getBase(D2StatId.Level)
      : selfStats.get(D2StatId.Level)
    : 0
  const effectiveWearerLevel =
    typeof wearerLevel === 'number' && wearerLevel > 0 ? wearerLevel : statLvl > 0 ? statLvl : 0

  const accumulateStatList = (statList: readonly ItemStat[] | undefined): void => {
    if (!statList) return
    for (const s of statList) {
      const statId = s.statId ?? (s as unknown as { id?: number }).id
      const param = s.param ?? 0
      const val = s.value ?? 0
      if (val <= 0) continue

      switch (statId) {
        case 127: // item_allskills
          allSkills += val
          break
        case 83: // item_addclassskills
          classSkills.set(param, (classSkills.get(param) ?? 0) + val)
          break
        case 188: // item_addskill_tab
          tabSkills.set(param, (tabSkills.get(param) ?? 0) + val)
          break
        case 107: // item_singleskill (Class Only)
          singleSkills.set(param, (singleSkills.get(param) ?? 0) + val)
          break
        case 126: { // item_elemskill
          const eType = ELEM_TYPE_BY_PARAM[param]
          if (eType) {
            elemSkills.set(eType, (elemSkills.get(eType) ?? 0) + val)
          }
          break
        }
        case 97: // item_nonclassskill (oskill)
          oskills.set(param, (oskills.get(param) ?? 0) + val)
          break
      }
    }
  }

  let hasSlot4Or5 = false
  let hasSlot11Or12 = false
  for (const item of containers.equipment.values()) {
    if (item.identified === false || item.broken === true) continue
    const bodyLoc = item.bodyLoc || item.equippedSlot || 0
    if (bodyLoc === 4 || bodyLoc === 5) hasSlot4Or5 = true
    else if (bodyLoc === 11 || bodyLoc === 12) hasSlot11Or12 = true
  }
  const useSwapSlots = activeWeaponSet === 1 && !hasSlot4Or5 && hasSlot11Or12

  const activeEquipped: ItemData[] = []
  for (const item of containers.equipment.values()) {
    if (item.identified === false || item.broken === true) continue
    const bodyLoc = item.bodyLoc || item.equippedSlot || 0
    if (!useSwapSlots) {
      if (bodyLoc === 11 || bodyLoc === 12) continue
    } else {
      if (bodyLoc === 4 || bodyLoc === 5) continue
    }
    activeEquipped.push(item)
  }

  for (const item of activeEquipped) {
    accumulateStatList(item.stats)
    accumulateStatList(item.runewordStats)
    if (item.quality === 5) {
      const enabledSetItemStats = computeItemSetBonusStats(item, activeEquipped)
      if (enabledSetItemStats.length > 0) {
        accumulateStatList(enabledSetItemStats)
      } else if (item.setItemId === undefined && item.setBonusStats) {
        for (const entry of item.setBonusStats as readonly unknown[]) {
          if (Array.isArray(entry)) {
            accumulateStatList(entry as readonly ItemStat[])
          } else if (
            entry &&
            typeof entry === 'object' &&
            'stats' in entry &&
            Array.isArray((entry as { readonly stats?: unknown }).stats)
          ) {
            accumulateStatList((entry as { readonly stats: readonly ItemStat[] }).stats)
          } else if (entry && typeof entry === 'object') {
            accumulateStatList([entry as ItemStat])
          }
        }
      }
    } else if (item.setBonusStats) {
      for (const entry of item.setBonusStats as readonly unknown[]) {
        if (Array.isArray(entry)) {
          accumulateStatList(entry as readonly ItemStat[])
        } else if (
          entry &&
          typeof entry === 'object' &&
          'stats' in entry &&
          Array.isArray((entry as { readonly stats?: unknown }).stats)
        ) {
          accumulateStatList((entry as { readonly stats: readonly ItemStat[] }).stats)
        } else if (entry && typeof entry === 'object') {
          accumulateStatList([entry as ItemStat])
        }
      }
    }
    const socketChildren = containers.sockets?.get(item.id)
    if (socketChildren) {
      for (const child of socketChildren) {
        if (child.identified === false || child.broken === true) continue
        if ((!child.stats || child.stats.length === 0) && isGemsTxtItem(child.code) && child.code !== 'jew') {
          try {
            const { row } = getItemBaseRow(item.code)
            accumulateStatList(gemSocketStats(child.code, row))
          } catch {
            // Ignore unknown base/gem codes on synthetic test stubs
          }
        } else {
          accumulateStatList(child.stats)
        }
      }
    }
  }

  try {
    accumulateStatList(computeFullSetBonusStats(activeEquipped))
  } catch {
    // Ignore incomplete synthetic set items in unit tests
  }

  const seenUniqueCharmIds = new Set<number>()
  for (const item of containers.inventory.values()) {
    if (item.identified === false || (item as any).flags?.identified === false || item.broken === true) continue
    const code = (item.code ?? '').trim().toLowerCase()
    if (!CHARM_ITEM_CODES.has(code)) continue
    if (effectiveWearerLevel > 0) {
      const reqLvl = resolveOnlineItemReqLevel(item, undefined, undefined, charClassCode)
      if (reqLvl > 0 && effectiveWearerLevel < reqLvl) continue
    }
    const isUnique = item.quality === 7 || (item.quality as unknown) === 'unique'
    const uid = item.uniqueItemId ?? (item as any).uniqueId
    if (isUnique && typeof uid === 'number' && uid >= 0) {
      if (seenUniqueCharmIds.has(uid)) continue
      seenUniqueCharmIds.add(uid)
    }
    accumulateStatList(item.stats)
  }

  if (selfStats) {
    const allSkillsStat = selfStats.get(127, 0)
    if (allSkillsStat > 0) allSkills += allSkillsStat

    for (const [elemParamStr, elemType] of Object.entries(ELEM_TYPE_BY_PARAM)) {
      const elemStat = selfStats.get(126, Number(elemParamStr))
      if (elemStat > 0) {
        elemSkills.set(elemType, (elemSkills.get(elemType) ?? 0) + elemStat)
      }
    }
  }

  return {
    allSkills,
    classSkills,
    tabSkills,
    singleSkills,
    elemSkills,
    oskills,
  }
}

export function resolvePreaggregatedSkillBonus(
  skillId: number,
  charClassCode: CharacterClassCode | null,
  agg: PreaggregatedEquipmentSkillBonuses,
  selfStats?: StatList,
  skillsCatalog: Readonly<Record<number, SkillCatalogEntry>> = SKILLS_BY_ID,
): number {
  if (!charClassCode) return 0
  const skill = skillsCatalog[skillId]
  if (!skill) return 0

  const skillClassId = CLASS_CODE_TO_ID[skill.classCode]
  // D2Common SKILLS_GetSkillLevel: stat 188 layer = SkillPage - 1 + 8 * classId (never the linear par 0..20).
  const tabParam = skillTabStatParam(skillClassId, skill.tabIndex)

  let bonus = agg.allSkills
  let oskillBonus = agg.oskills.get(skillId) ?? 0

  if (skill.classCode === charClassCode) {
    bonus += agg.classSkills.get(skillClassId) ?? 0
    bonus += agg.singleSkills.get(skillId) ?? 0
  }

  bonus += agg.tabSkills.get(tabParam) ?? 0

  if (skill.eType) {
    bonus += agg.elemSkills.get(skill.eType) ?? 0
  }

  if (selfStats) {
    if (skill.classCode === charClassCode) {
      const classSkillsStat = selfStats.get(83, skillClassId)
      if (classSkillsStat > 0) bonus += classSkillsStat

      const singleSkillStat = selfStats.get(107, skillId)
      if (singleSkillStat > 0) bonus += singleSkillStat
    }

    const tabStat = selfStats.get(188, tabParam)
    if (tabStat > 0) bonus += tabStat

    const oskillStat = selfStats.get(97, skillId)
    if (oskillStat > 0) oskillBonus += oskillStat
  }

  if (oskillBonus > 0) {
    bonus += skill.classCode === charClassCode ? Math.min(3, oskillBonus) : oskillBonus
  }

  return Math.max(0, bonus)
}

/**
 * Computes the 1.13c client-side `+Skills` equipment, socket, set, runeword, charm, and state bonus
 * (`SKILLS_GetSkillLevel` in `D2Common.dll`) for `skillId`:
 * - `127` (`item_allskills`): `+X to All Skills`
 * - `83` (`item_addclassskills`): `+X to [Class] Skill Levels` (`param === classId`)
 * - `188` (`item_addskill_tab`): `+X to [Skill Tab]` (`param === (classId << 3) | (SkillPage - 1)`, D2Common SKILLS_GetSkillLevel)
 * - `107` (`item_singleskill`): `+X to [Skill] (Class Only)` (`param === skillId` when character matches skill class)
 * - `126` (`item_elemskill`): `+X to Fire/Elemental Skills` (`param` matches `Skills.txt EType`)
 * - `97` (`item_nonclassskill` / oskill): `+X to [Skill]` (`param === skillId`, capped at `+3` when `skill.classCode === charClassCode`)
 */
export function computeEquipmentSkillBonus(
  skillId: number,
  charClassCode: CharacterClassCode | null,
  containers: Pick<ClientItemContainers, 'equipment' | 'inventory'> & Partial<Pick<ClientItemContainers, 'sockets'>>,
  selfStats?: StatList,
  weaponSetOrCatalog?: 0 | 1 | Readonly<Record<number, SkillCatalogEntry>>,
  maybeCatalog?: Readonly<Record<number, SkillCatalogEntry>>,
): number {
  const activeWeaponSet: 0 | 1 =
    typeof weaponSetOrCatalog === 'number' ? (weaponSetOrCatalog === 1 ? 1 : 0) : 0
  const skillsCatalog: Readonly<Record<number, SkillCatalogEntry>> =
    typeof weaponSetOrCatalog === 'object' && weaponSetOrCatalog !== null
      ? weaponSetOrCatalog
      : (maybeCatalog ?? SKILLS_BY_ID)

  if (!charClassCode) return 0
  const skill = skillsCatalog[skillId]
  if (!skill) return 0

  const agg = preaggregateEquipmentSkillBonuses(
    containers,
    selfStats,
    activeWeaponSet,
    undefined,
    charClassCode,
  )
  return resolvePreaggregatedSkillBonus(skillId, charClassCode, agg, selfStats, skillsCatalog)
}
