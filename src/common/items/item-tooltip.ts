/**
 * Diablo II Item Tooltip and Formatted Attribute Generator.
 *
 * Formats dropped Item instances into rich, canonical Diablo II tooltip data:
 * - Quality colors and tiered title (Unique gold, Set green, Rare yellow, Magic blue, Rune orange, Gem purple)
 * - Base equipment stats (Defense, 1H/2H Damage, Speed, Durability, Required Str/Dex/Level, ilvl)
 * - Rolled magic modifiers, affix lines, and unique/set fixed modifiers formatted with authentic D2 strings
 * - Sockets, rune effects, and gem socketing bonuses
 *
 * All equipment names and attribute modifiers strictly use canonical Diablo II 1.13c English strings.
 */

import type { Item, ItemBase, RolledItemProp } from './items.ts'
import type { UniqueItem, UniqueItemProp } from './unique-items.ts'
import {
  CANONICAL_SET_ITEMS_TABLE,
  CANONICAL_SETS_TABLE,
  type SetItem,
  type SetItemProp,
} from './set-items.ts'
import { inferItemClassFromType } from './affixes.ts'
import { formatDgrpLine } from './dgrp-line.ts'
import { elementalPairCombines, formatElementalPair, formatPhysicalRange, formatPoisonPair, physicalPairCombines } from './damage-merge.ts'
import { chargedSkillChargesOf, formatChargedSkill, resolveChargedSkillRoll113c } from './charged-skill.ts'
import {
  NON_RANDOM_RANGE_CODES,
  getItemTypeCode,
  type GeneratedAffixes,
  type GeneratedRareAffixes,
  type RolledAffix,
  type RolledMod,
} from './affix-generator.ts'
import {
  resolveProperty,
  getDefaultItemPropertiesAndStats,
  type PropertiesTable,
  type ItemStatCostTable,
  type ItemStatCostRecord,
} from './properties.ts'
import {
  getTooltipLocale,
  setTooltipLocale,
  translateItemName,
  translateMagicName,
  translateRareName,
  resolveBaseItemNameEn,
  resolveRareNameEn,
  resolveMagicNameEn,
  formatPropertyCodeI18n,
  formatReplenishDurability,
  RUNE_INFO_ZH,
  type TooltipLocale,
} from '../i18n/tooltip-i18n.ts'
import {
  CANONICAL_ENG_TBL_DICT,
  CANONICAL_CHI_TBL_DICT,
  CANONICAL_ISC_DESC_TABLE,
  type CanonicalIscDescEntry,
} from '../data/canonical-tbl-strings.ts'
import {
  GEM_INFO,
  RUNE_INFO,
  getSocketableInfo,
  getSocketableSlotText,
  getSocketableSlotLines,
  isGemCode,
  isRuneCode,
  isJewelCode,
  isSocketableCode,
  type GemInfo,
  type RuneInfo,
  type SocketTargetCategory,
} from './gems-data.ts'
import {
  CANONICAL_GEMS_TABLE,
  resolveSocketTargetCategory,
  getSocketedItemModifiersForHost,
  isSocketableDomainItem,
  canSocketDomainItem,
  socketItemIntoHost,
} from './gems.ts'

export {
  getTooltipLocale,
  setTooltipLocale,
  translateItemName,
  resolveBaseItemNameEn,
  resolveRareNameEn,
  resolveMagicNameEn,
  type TooltipLocale,
} from '../i18n/tooltip-i18n.ts'
export {
  CANONICAL_ENG_TBL_DICT,
  CANONICAL_CHI_TBL_DICT,
  CANONICAL_ISC_DESC_TABLE,
  type CanonicalIscDescEntry,
} from '../data/canonical-tbl-strings.ts'
export {
  GEM_INFO,
  RUNE_INFO,
  getSocketableInfo,
  getSocketableSlotText,
  getSocketableSlotLines,
  isGemCode,
  isRuneCode,
  isJewelCode,
  isSocketableCode,
  type GemInfo,
  type RuneInfo,
  type SocketTargetCategory,
} from './gems-data.ts'
export {
  CANONICAL_GEMS_TABLE,
  resolveSocketTargetCategory,
  getSocketedItemModifiersForHost,
  isSocketableDomainItem,
  canSocketDomainItem,
  socketItemIntoHost,
} from './gems.ts'

export interface FormattedStatLine {
  text: string
  color?: 'blue' | 'white' | 'gold' | 'green' | 'orange' | 'yellow' | 'red' | 'gray' | 'instruction'
  isMagic?: boolean | undefined
}

export interface WeaponDamageInfo {
  min: number
  max: number
  baseMin?: number | undefined
  baseMax?: number | undefined
  isEnhanced?: boolean | undefined
  isEthereal?: boolean | undefined
  isLowQuality?: boolean | undefined
  edPct?: number | undefined
  extraMaxEdPct?: number | undefined
  flatMin?: number | undefined
  flatMax?: number | undefined
}

export interface FormattedItemTooltip {
  title: string
  subTitle?: string | undefined
  quality: string
  qualityColor: string
  baseType: string
  ilvl: number
  reqLevel?: number | undefined
  baseReqLevel?: number | undefined
  reqStr?: number | undefined
  baseReqStr?: number | undefined
  reqDex?: number | undefined
  baseReqDex?: number | undefined
  defense?: number | undefined
  baseDefense?: number | undefined
  oneHandDamage?: WeaponDamageInfo | undefined
  twoHandDamage?: WeaponDamageInfo | undefined
  throwDamage?: WeaponDamageInfo | undefined
  durability?: {
    current: number
    max: number
    baseMax?: number | undefined
    isEnhanced?: boolean | undefined
  } | undefined
  sockets?: number | undefined
  lines: FormattedStatLine[]
  setName?: string | undefined
  setPieces?: string[] | undefined
  setPieceColors?: ('green' | 'red')[] | undefined
  setBonuses?: FormattedStatLine[] | undefined
  flavorText?: string | undefined
  isSocketable?: boolean | undefined
  runewordRunes?: string | undefined
  speedText?: string | undefined
}



/**
 * Formats a Diablo II property modifier into a canonical 1.13c English string.
 *
 * For discrete stats (e.g., mana, hp, str, res-all, fcr), the rolled concrete value
 * is formatted (e.g., '+17 to Mana'), never a range like '+11-20'.
 * Damage range stats (e.g., dmg-fire, dmg-ltng) format the range (e.g., 'Adds 1-50 Lightning Damage').
 *
 * Supports overloaded call signatures:
 * - formatPropertyCode(code, value, min, max, par)
 * - formatPropertyCode(code, min, max, par)
 * - formatPropertyCode(code, value)
 */
import {
  CANONICAL_SKILLS,
  resolveSkillInfo,
  resolveSkillMeta,
  CANONICAL_SKILL_TABS,
  CANONICAL_REANIMATE_MONSTERS,
  type CanonicalSkillMeta,
} from '../skills/skills-data.ts'
import { CANONICAL_AUTOMAGIC_TABLE } from './automagic.ts'

export {
  resolveSkillInfo,
  resolveSkillMeta,
  CANONICAL_SKILLS,
  CANONICAL_SKILL_TABS,
  CANONICAL_REANIMATE_MONSTERS,
  formatReplenishDurability,
  type CanonicalSkillMeta,
}

/**
 * Ground Truth (`D2Client.dll` `0x6FB046E0` + `0x6FB04E10` `descFunc` 6..10 & `ItemStatCost.txt` `op` 2..5):
 * Per-level properties (`op` 2..5, `op param = 3`) compute `(clvl * rawEighths) >> 3` as an integer
 * for the current character level (`clvl >= 1`). `eighths` is a display-unit property value: stats 216
 * (`hp/lvl`) and 217 (`mana/lvl`) carry `ValShift = 8` internally, which `convertOnlineItemStatsToRolledProps`
 * always removes (`>> ValShift`) before a property reaches the tooltip (#1639).
 */
function formatPerLevelVal(eighths: number, charLevel = 1): string {
  const clvl = charLevel > 0 && Number.isFinite(charLevel) ? Math.max(1, Math.trunc(charLevel)) : 1
  return `${Math.floor((eighths * clvl) / 8)}`
}

export function formatPropertyCode(
  code: string,
  valueOrMin: number,
  minOrMax?: number,
  maxOrPar?: number | string,
  maybePar?: string | number,
  locale?: TooltipLocale,
  charLevel = 1,
): string {
  if (locale && locale !== 'en') {
    const i18nOut = formatPropertyCodeI18n(code, valueOrMin, minOrMax, maxOrPar, maybePar, locale, charLevel)
    const normCode = (code || '').trim().toLowerCase().replace(/^\*/, '')
    const iscEntry =
      CANONICAL_ISC_DESC_TABLE[normCode] ??
      (PROP_STAT_ID[normCode] !== undefined ? ISC_BY_ID.get(PROP_STAT_ID[normCode]) : undefined)
    if (i18nOut.startsWith(`${code}: `) && iscEntry && iscEntry.descFunc >= 1 && iscEntry.descFunc <= 28) {
      return formatStatByIscDescFunc(
        normCode,
        valueOrMin,
        minOrMax ?? valueOrMin,
        typeof maxOrPar === 'number' ? maxOrPar : valueOrMin,
        maybePar ?? (typeof maxOrPar === 'string' ? maxOrPar : undefined),
        locale,
        charLevel,
      )
    }
    return i18nOut
  }
  let value: number
  let min: number
  let max: number
  let par: string | number | undefined

  if (typeof maxOrPar === 'number') {
    // Called as (code, value, min, max, par)
    value = valueOrMin
    min = minOrMax ?? valueOrMin
    max = maxOrPar
    par = maybePar
  } else if (typeof minOrMax === 'number') {
    // Called as (code, min, max, par) or (code, value, min)
    if (typeof maxOrPar === 'string') {
      min = valueOrMin
      max = minOrMax
      value = min
      par = maxOrPar
    } else {
      min = valueOrMin
      max = minOrMax
      value = valueOrMin
    }
  } else {
    // Called as (code, value)
    value = valueOrMin
    min = valueOrMin
    max = valueOrMin
    if (typeof minOrMax === 'string') {
      par = minOrMax
    }
  }

  // For func=17 properties where min=0, max=0, and par holds the actual numeric rate/eighths
  const effectiveVal =
    value === 0 && min === 0 && max === 0 && par !== undefined && par !== '' && !Number.isNaN(Number(par))
      ? Number(par)
      : value

  const plusVal = effectiveVal >= 0 ? `+${effectiveVal}` : `${effectiveVal}`

  switch (code.trim().toLowerCase().replace(/^\*/, '')) {
    // --- Skills & Class Skills (descFunc 1, 13, 14, 16, 27, 28) ---
    case 'allskills':
      return `${plusVal} to All Skills`
    case 'ama':
      return `${plusVal} to Amazon Skill Levels`
    case 'sor':
      return `${plusVal} to Sorceress Skill Levels`
    case 'nec':
      return `${plusVal} to Necromancer Skill Levels`
    case 'pal':
      return `${plusVal} to Paladin Skill Levels`
    case 'bar':
      return `${plusVal} to Barbarian Skill Levels`
    case 'dru':
      return `${plusVal} to Druid Skills`
    case 'ass':
      return `${plusVal} to Assassin Skills`
    case 'randclassskill':
      return `+${effectiveVal || 3} to Random Class Skill Levels`
    case 'classskills':
      return `${plusVal} to ${par ? `${par} ` : ''}Skill Levels`
    case 'fireskill':
      return `${plusVal} to Fire Skills`
    case 'skilltab': {
      const tabId = Number(par)
      if (!Number.isNaN(tabId) && CANONICAL_SKILL_TABS[tabId]) {
        return `${plusVal} to ${CANONICAL_SKILL_TABS[tabId]}`
      }
      return `${plusVal} to ${par ?? 'Skill Tab'}`
    }
    case 'skill': {
      const sk = resolveSkillInfo(par)
      return `${plusVal} to ${sk.name}${sk.classOnly ? ` ${sk.classOnly}` : ''}`
    }
    case 'skill-rand': {
      const slvl = Number(par) || effectiveVal || 3
      const sk = resolveSkillInfo(min)
      return `+${slvl} to ${sk.name}${sk.classOnly ? ` ${sk.classOnly}` : ' (Sorceress Only)'}`
    }
    case 'oskill': {
      const sk = resolveSkillInfo(par)
      return `${plusVal} to ${sk.name}`
    }
    case 'aura': {
      const sk = resolveSkillInfo(par)
      return `Level ${effectiveVal} ${sk.name} Aura When Equipped`
    }

    // --- Event Procs (func=11, descFunc=15) & Charged Skills (func=19, descFunc=24) ---
    case 'hit-skill': {
      const sk = resolveSkillInfo(par)
      const chance = min || effectiveVal || 5
      const slvl = max || 1
      return `${chance}% Chance to cast level ${slvl} ${sk.name} on striking`
    }
    case 'att-skill': {
      const sk = resolveSkillInfo(par)
      const chance = min || effectiveVal || 5
      const slvl = max || 1
      return `${chance}% Chance to cast level ${slvl} ${sk.name} on attack`
    }
    case 'gethit-skill': {
      const sk = resolveSkillInfo(par)
      const chance = min || effectiveVal || 5
      const slvl = max || 1
      return `${chance}% Chance to cast level ${slvl} ${sk.name} when struck`
    }
    case 'kill-skill': {
      const sk = resolveSkillInfo(par)
      const chance = min || effectiveVal || 5
      const slvl = max || 1
      return `${chance}% Chance to cast level ${slvl} ${sk.name} when you Kill an Enemy`
    }
    case 'death-skill': {
      const sk = resolveSkillInfo(par)
      const chance = min || effectiveVal || 100
      const slvl = max || 1
      return `${chance}% Chance to cast level ${slvl} ${sk.name} when you Die`
    }
    case 'levelup-skill': {
      const sk = resolveSkillInfo(par)
      const chance = min || effectiveVal || 100
      const slvl = max || 1
      return `${chance}% Chance to cast level ${slvl} ${sk.name} when you Level-Up`
    }
    case 'charged': {
      const sk = resolveSkillInfo(par)
      const slvl = max > 0 ? max : resolveChargedSkillRoll113c(min, max, { skillId: par }).slvl
      return formatChargedSkill(slvl, sk.name, chargedSkillChargesOf(value, min, slvl), 'en')
    }

    // --- Attributes & Life / Mana / Stamina ---
    case 'str':
      return `${plusVal} to Strength`
    case 'dex':
      return `${plusVal} to Dexterity`
    case 'vit':
      return `${plusVal} to Vitality`
    case 'enr':
      return `${plusVal} to Energy`
    case 'all-stats':
      return formatDgrpLine('all-stats', effectiveVal, 'en')
    case 'hp':
      return `${plusVal} to Life`
    case 'hp%':
      return `Increase Maximum Life ${effectiveVal}%`
    case 'mana':
      return `${plusVal} to Mana`
    case 'mana%':
      return `Increase Maximum Mana ${effectiveVal}%`
    case 'stam':
      return `${plusVal} Maximum Stamina`
    case 'regen-stam':
      return `Heal Stamina Plus ${effectiveVal}%`
    case 'stamdrain':
      return `${effectiveVal}% Slower Stamina Drain`

    // --- Per-Level Scaling Properties (func=17, descFunc 6..9) ---
    case 'hp/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} to Life (Based on Character Level)`
    case 'mana/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} to Mana (Based on Character Level)`
    case 'stam/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} Maximum Stamina (Based on Character Level)`
    case 'regen-stam/lvl':
      return `Heal Stamina Plus +${formatPerLevelVal(effectiveVal, charLevel)}% (Based on Character Level)`
    case 'str/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} to Strength (Based on Character Level)`
    case 'dex/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} to Dexterity (Based on Character Level)`
    case 'vit/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} to Vitality (Based on Character Level)`
    case 'enr/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} to Energy (Based on Character Level)`
    case 'ac/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} Defense (Based on Character Level)`
    case 'ac%/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)}% Enhanced Defense (Based on Character Level)`
    case 'dmg/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} to Maximum Damage (Based on Character Level)`
    case 'dmg%/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)}% Enhanced Maximum Damage (Based on Character Level)`
    case 'att/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} to Attack Rating (Based on Character Level)`
    case 'att%/lvl':
      return `${formatPerLevelVal(effectiveVal, charLevel)}% Bonus to Attack Rating (Based on Character Level)`
    case 'dmg-cold/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} to Maximum Cold Damage (Based on Character Level)`
    case 'dmg-fire/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} to Maximum Fire Damage (Based on Character Level)`
    case 'dmg-ltng/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} to Maximum Lightning Damage (Based on Character Level)`
    case 'dmg-pois/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} to Maximum Poison Damage (Based on Character Level)`
    case 'dmg-dem/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)}% Damage to Demons (Based on Character Level)`
    case 'dmg-und/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)}% Damage to Undead (Based on Character Level)`
    case 'att-dem/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} to Attack Rating against Demons (Based on Character Level)`
    case 'att-und/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} to Attack Rating against Undead (Based on Character Level)`
    case 'deadly/lvl':
      return `${formatPerLevelVal(effectiveVal, charLevel)}% Deadly Strike (Based on Character Level)`
    case 'crush/lvl':
      return `${formatPerLevelVal(effectiveVal, charLevel)}% Chance of Crushing Blow (Based on Character Level)`
    case 'wounds/lvl':
      return `${formatPerLevelVal(effectiveVal, charLevel)}% Chance of Open Wounds (Based on Character Level)`
    case 'kick/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} Kick Damage (Based on Character Level)`
    case 'thorns/lvl':
      return `Attacker Takes Damage of ${formatPerLevelVal(effectiveVal, charLevel)} (Based on Character Level)`
    case 'mag%/lvl':
      return `${formatPerLevelVal(effectiveVal, charLevel)}% Better Chance of Getting Magic Items (Based on Character Level)`
    case 'gold%/lvl':
      return `${formatPerLevelVal(effectiveVal, charLevel)}% Extra Gold from Monsters (Based on Character Level)`
    case 'res-cold/lvl':
      return `Cold Resist +${formatPerLevelVal(effectiveVal, charLevel)}% (Based on Character Level)`
    case 'res-fire/lvl':
      return `Fire Resist +${formatPerLevelVal(effectiveVal, charLevel)}% (Based on Character Level)`
    case 'res-ltng/lvl':
      return `Lightning Resist +${formatPerLevelVal(effectiveVal, charLevel)}% (Based on Character Level)`
    case 'res-pois/lvl':
      return `Poison Resist +${formatPerLevelVal(effectiveVal, charLevel)}% (Based on Character Level)`
    case 'abs-cold/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} Absorbs Cold Damage (Based on Character Level)`
    case 'abs-fire/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} Absorbs Fire Damage (Based on Character Level)`
    case 'abs-ltng/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} Absorbs Lightning Damage (Based on Character Level)`
    case 'abs-pois/lvl':
      return `+${formatPerLevelVal(effectiveVal, charLevel)} Absorbs Poison Damage (Based on Character Level)`

    // --- Defense & Damage Modifiers ---
    case 'ac':
      return `${plusVal} Defense`
    case 'ac%':
      return `${plusVal}% Enhanced Defense`
    case 'ac-miss':
      return `${plusVal} Defense vs. Missile`
    case 'ac-hth':
      return `${plusVal} Defense vs. Melee`
    case 'dmg%':
    case 'damagepercent':
      return `${plusVal}% Enhanced Damage`
    case 'dmg-max%':
    case 'item_maxdamage_percent':
      return formatStatByIscDescFunc('item_maxdamage_percent', effectiveVal, min, max, par, 'en', charLevel)
    case 'dmg-min%':
    case 'item_mindamage_percent':
      return formatStatByIscDescFunc('item_mindamage_percent', effectiveVal, min, max, par, 'en', charLevel)
    case 'dmg':
      return `Damage ${plusVal}`
    case 'dmg-min':
      return `${plusVal} to Minimum Damage`
    case 'dmg-max':
      return `${plusVal} to Maximum Damage`
    case 'dmg-norm':
      return physicalPairCombines(min, max) ? formatPhysicalRange(min, max, 'en') : `${plusVal} to Minimum Damage`
    case 'dmg-ac':
      return `${plusVal} to Monster Defense Per Hit`
    case 'reduce-ac':
      return `-${Math.abs(effectiveVal)}% Target Defense`
    case 'dmg-demon':
      return `${plusVal}% Damage to Demons`
    case 'dmg-undead':
      return `${plusVal}% Damage to Undead`
    case 'att-demon':
      return `${plusVal} to Attack Rating against Demons`
    case 'att-undead':
      return `${plusVal} to Attack Rating against Undead`
    case 'demon-heal':
      return `${plusVal} Life after each Demon Kill`

    // --- Resistances, Max Resistances & Elemental Mastery/Pierce ---
    case 'res-all':
      return formatDgrpLine('res-all', effectiveVal, 'en')
    case 'res-all-max':
      return `${plusVal}% to Maximum All Resistances`
    case 'res-fire':
    case 'fireresist':
      return `Fire Resist ${plusVal}%`
    case 'res-fire-max':
      return `${plusVal}% to Maximum Fire Resist`
    case 'res-cold':
    case 'coldresist':
      return `Cold Resist ${plusVal}%`
    case 'res-cold-max':
      return `${plusVal}% to Maximum Cold Resist`
    case 'res-ltng':
    case 'lightresist':
      return `Lightning Resist ${plusVal}%`
    case 'res-ltng-max':
      return `${plusVal}% to Maximum Lightning Resist`
    case 'res-pois':
    case 'poisonresist':
      return `Poison Resist ${plusVal}%`
    case 'res-pois-max':
      return `${plusVal}% to Maximum Poison Resist`
    case 'res-pois-len':
      return `Poison Length Reduced by ${Math.abs(effectiveVal)}%`
    case 'extra-fire':
      return `${plusVal}% to Fire Skill Damage`
    case 'extra-cold':
      return `${plusVal}% to Cold Skill Damage`
    case 'extra-ltng':
      return `${plusVal}% to Lightning Skill Damage`
    case 'extra-pois':
      return `${plusVal}% to Poison Skill Damage`
    case 'pierce-fire':
      return `-${Math.abs(effectiveVal)}% to Enemy Fire Resistance`
    case 'pierce-cold':
      return `-${Math.abs(effectiveVal)}% to Enemy Cold Resistance`
    case 'pierce-ltng':
      return `-${Math.abs(effectiveVal)}% to Enemy Lightning Resistance`
    case 'pierce-pois':
      return `-${Math.abs(effectiveVal)}% to Enemy Poison Resistance`

    // --- Elemental & Magic Absorb (descFunc 1 & 2) ---
    case 'abs-fire':
      return `${plusVal} Fire Absorb`
    case 'abs-fire%':
      return `Fire Absorb ${effectiveVal}%`
    case 'abs-cold':
      return `${plusVal} Cold Absorb`
    case 'abs-cold%':
      return `Cold Absorb ${effectiveVal}%`
    case 'abs-ltng':
      return `${plusVal} Lightning Absorb`
    case 'abs-ltng%':
      return `Lightning Absorb ${effectiveVal}%`
    case 'abs-mag':
      return `${plusVal} Magic Absorb`
    case 'abs-pois':
      return `${plusVal} Poison Absorb`

    // --- Speed & Rate Modifiers (Properties.txt func=8) ---
    case 'fcr':
    case 'cast1':
    case 'cast2':
    case 'cast3':
      return `${plusVal}% Faster Cast Rate`
    case 'fhr':
    case 'balance1':
    case 'balance2':
    case 'balance3':
      return `${plusVal}% Faster Hit Recovery`
    case 'ias':
    case 'swing1':
    case 'swing2':
    case 'swing3':
      return `${plusVal}% Increased Attack Speed`
    case 'frw':
    case 'move1':
    case 'move2':
    case 'move3':
      return `${plusVal}% Faster Run/Walk`
    case 'fbr':
    case 'block1':
    case 'block2':
    case 'block3':
      return `${plusVal}% Faster Block Rate`
    case 'block':
      return `${effectiveVal}% Increased Chance of Blocking`

    // --- Combat & Leech & Reduction Modifiers ---
    case 'mag%':
      return `${effectiveVal}% Better Chance of Getting Magic Items`
    case 'gold%':
      return `${effectiveVal}% Extra Gold from Monsters`
    case 'lifesteal':
    case 'leech':
      return `${effectiveVal}% Life stolen per hit`
    case 'manasteal':
      return `${effectiveVal}% Mana stolen per hit`
    case 'crush':
      return `${effectiveVal}% Chance of Crushing Blow`
    case 'openwounds':
      return `${effectiveVal}% Chance of Open Wounds`
    case 'deadly':
      return `${effectiveVal}% Deadly Strike`
    case 'dmag':
    case 'red-dmg%':
      return `Damage Reduced by ${effectiveVal}%`
    case 'dmag-ac':
    case 'red-dmg':
      return `Damage Reduced by ${effectiveVal}`
    case 'mag-ac':
    case 'red-mag':
      return `Magic Damage Reduced by ${effectiveVal}`
    case 'dmg-to-mana':
      return `${effectiveVal}% Damage Taken Goes To Mana`
    case 'thorns':
      return `Attacker Takes Damage of ${effectiveVal}`
    case 'light-thorns':
      return `Attacker Takes Lightning Damage of ${effectiveVal}`
    case 'mana-kill':
      return `${plusVal} to Mana after each Kill`
    case 'heal-kill':
    case 'hp-kill':
      return `${plusVal} Life after each Kill`

    // --- Durability, Quantity, Requirements, Sockets & Special Flags ---
    case 'rep-dur': {
      // D2Client.dll 0x6FB051A5 descFunc=11 + expansionstring.tbl ModStre9t / ModStre9u
      const rate =
        par !== undefined && par !== '' && !Number.isNaN(Number(par)) && Number(par) !== 0
          ? Number(par)
          : effectiveVal
      return formatReplenishDurability(rate, 'en')
    }
    case 'rep-quant':
      return 'Replenishes quantity'
    case 'ease':
      return `Requirements ${effectiveVal > 0 ? `+${effectiveVal}` : effectiveVal}%`
    case 'ethereal':
      return 'Ethereal (Cannot be Repaired)'
    case 'indestruct':
      return 'Indestructible'
    case 'sock':
      return `Socketed (${effectiveVal})`
    case 'stack':
      return 'Increased Stack Size'
    case 'dur':
      return `${plusVal} Maximum Durability`
    case 'dur%':
      return `Increase Maximum Durability ${effectiveVal}%`
    case 'no-freeze':
    case 'nofreeze':
      return 'Cannot Be Frozen'
    case 'half-freeze':
      return 'Half Freeze Duration'
    case 'noheal':
    case 'no-heal':
      return 'Prevent Monster Heal'
    case 'rip':
      return 'Slain Monsters Rest in Peace'
    case 'knock':
      return 'Knockback'
    case 'howl':
      return `Hit Causes Monster to Flee ${effectiveVal}%`
    case 'stupidity':
    case 'blind':
      return effectiveVal > 1 ? `Hit Blinds Target +${effectiveVal}` : 'Hit Blinds Target'
    case 'rep-life':
    case 'regen':
      return effectiveVal >= 0 ? `Replenish Life +${effectiveVal}` : `Drain Life ${effectiveVal}`
    case 'regen-mana':
    case 'manaregen':
      return `Regenerate Mana ${effectiveVal}%`
    case 'pierce':
      return effectiveVal > 0 ? `Piercing Attack (${effectiveVal}%)` : 'Piercing Attack'
    case 'ignore-ac':
      return "Ignore Target's Defense"
    case 'freeze':
      return effectiveVal > 1 ? `Freezes target +${effectiveVal}` : 'Freezes target'
    case 'slow':
      return `Slows Target by ${effectiveVal}%`
    case 'light':
      return `${plusVal} to Light Radius`
    case 'cheap':
      return `Reduces all Vendor Prices ${effectiveVal}%`
    case 'addxp':
      return `${plusVal}% to Experience Gained`
    case 'magicarrow':
      return 'Fires Magic Arrows'
    case 'explosivearrow':
      return 'Fires Explosive Arrows or Bolts'
    case 'reanimate': {
      const monId = Number(par)
      const monName = !Number.isNaN(monId) && CANONICAL_REANIMATE_MONSTERS[monId]
        ? CANONICAL_REANIMATE_MONSTERS[monId]
        : (par || 'Returned')
      return `${effectiveVal}% Reanimate as: ${monName}`
    }
    case 'bloody':
      return 'Extra Blood'
    case 'fade':
      return 'Fade'
    case 'state':
      return String(par).toLowerCase() === 'monsterset' ? 'Transforms into Vampire' : 'Display Aura'

    // --- Attack Rating & Elemental Damages ---
    case 'att':
      return `${plusVal} to Attack Rating`
    case 'att%':
      return `${effectiveVal}% Bonus to Attack Rating`
    case 'dmg-fire':
      return formatElementalPair('fire', min > 0 ? min : effectiveVal, max > 0 ? max : effectiveVal, 'en')
    case 'fire-min':
      return `${plusVal} to Minimum Fire Damage`
    case 'fire-max':
      return `${plusVal} to Maximum Fire Damage`
    case 'dmg-cold':
      return formatElementalPair('cold', min > 0 ? min : effectiveVal, max > 0 ? max : effectiveVal, 'en')
    case 'cold-min':
      return `${plusVal} to Minimum Cold Damage`
    case 'cold-max':
      return `${plusVal} to Maximum Cold Damage`
    case 'cold-len':
      return `Cold Duration: ${Math.max(1, Math.round(effectiveVal / 25))} Seconds`
    case 'dmg-ltng':
      return formatElementalPair('ltng', min > 0 ? min : effectiveVal, max > 0 ? max : effectiveVal, 'en')
    case 'ltng-min':
      return `${plusVal} to Minimum Lightning Damage`
    case 'ltng-max':
      return `${plusVal} to Maximum Lightning Damage`
    case 'dmg-pois':
      return formatPoisonPair(min > 0 ? min : effectiveVal, max > 0 ? max : effectiveVal, Number(par) || 0, 1, 'en')
    case 'pois-min':
      return `${plusVal} to Minimum Poison Damage`
    case 'pois-max':
      return `${plusVal} to Maximum Poison Damage`
    case 'pois-len':
      return `Poison Duration: ${Math.max(1, Math.round(effectiveVal / 25))} Seconds`
    case 'dmg-mag':
      return formatElementalPair('mag', min > 0 ? min : effectiveVal, max > 0 ? max : effectiveVal, 'en')
    case 'dmg-elem':
      return min > 0 && max > min ? `Adds ${min}-${max} Elemental Damage` : `Adds ${effectiveVal} Elemental Damage`
    default: {
      const normCode = code.trim().toLowerCase().replace(/^\*/, '')
      const iscEntry =
        CANONICAL_ISC_DESC_TABLE[normCode] ??
        (PROP_STAT_ID[normCode] !== undefined ? ISC_BY_ID.get(PROP_STAT_ID[normCode]) : undefined)
      if (iscEntry && iscEntry.descFunc >= 1 && iscEntry.descFunc <= 28) {
        return formatStatByIscDescFunc(normCode, effectiveVal, min, max, par, 'en', charLevel)
      }
      return `${code}: ${plusVal}${par ? ` (${par})` : ''}`
    }
  }
}

/**
 * Canonical 1.13c ItemStatCost.txt descpriority lookup table (0..180).
 * Higher priority stats appear higher on the item tooltip.
 */
const PROP_DESC_PRIORITY: Record<string, number> = {
  'ac/time': 180,
  'att-skill': 160,
  'hit-skill': 160,
  'gethit-skill': 160,
  'kill-skill': 160,
  'death-skill': 160,
  'levelup-skill': 160,
  indestruct: 160,
  aura: 159,
  allskills: 158,
  fireskill: 157,
  skilltab: 151,
  ama: 150,
  pal: 150,
  nec: 150,
  sor: 150,
  bar: 150,
  dru: 150,
  ass: 150,
  randclassskill: 150,
  classskills: 150,
  frw: 148,
  move1: 148,
  move2: 148,
  move3: 148,
  ias: 145,
  swing1: 145,
  swing2: 145,
  swing3: 145,
  fcr: 142,
  cast1: 142,
  cast2: 142,
  cast3: 142,
  fhr: 139,
  balance1: 139,
  balance2: 139,
  balance3: 139,
  fbr: 136,
  block1: 136,
  block2: 136,
  block3: 136,
  block: 134,
  explosivearrow: 133,
  pierce: 132,
  magicarrow: 131,
  'dmg%': 129,
  damagepercent: 129,
  'dmg-max%': 129,
  item_maxdamage_percent: 129,
  'dmg-min%': 128,
  item_mindamage_percent: 128,
  'dmg%/lvl': 128,
  'dmg-norm': 127,
  'dmg-min': 126,
  'dmg-max': 125,
  'dmg/lvl': 125,
  dmg: 122,
  'kick/lvl': 120,
  'ignore-ac': 119,
  'reduce-ac': 118,
  'att%': 117,
  'att%/lvl': 116,
  att: 115,
  'att/lvl': 114,
  'dmg-demon': 112,
  'dmg-dem/lvl': 111,
  'att-demon': 110,
  'att-dem/lvl': 109,
  'dmg-undead': 108,
  'dmg-und/lvl': 107,
  'att-undead': 106,
  'att-und/lvl': 105,
  'dmg-mag': 104,
  'dmg-fire': 102,
  'fire-min': 102,
  'dmg-elem': 102,
  'fire-max': 101,
  'dmg-ltng': 99,
  'ltng-min': 99,
  'ltng-max': 98,
  'dmg-cold': 96,
  'cold-min': 96,
  'cold-max': 95,
  'dmg-pois': 92,
  'pois-min': 92,
  'pois-max': 91,
  manasteal: 89,
  lifesteal: 88,
  leech: 88,
  'pierce-fire': 88,
  'pierce-ltng': 88,
  'pierce-cold': 88,
  'pierce-pois': 88,
  'extra-fire': 88,
  'extra-ltng': 88,
  'extra-cold': 88,
  'extra-pois': 88,
  crush: 87,
  'crush/lvl': 86,
  deadly: 85,
  'deadly/lvl': 84,
  openwounds: 83,
  'wounds/lvl': 82,
  noheal: 81,
  'no-heal': 81,
  skill: 81,
  rip: 81,
  'skill-rand': 81,
  oskill: 81,
  stupidity: 80,
  blind: 80,
  howl: 79,
  freeze: 78,
  slow: 77,
  knock: 76,
  'dmg-ac': 75,
  'ac%': 74,
  'ac%/lvl': 73,
  'ac/lvl': 72,
  ac: 71,
  'ac-hth': 70,
  'ac-miss': 69,
  'all-stats': 68,
  str: 67,
  'str/lvl': 66,
  dex: 65,
  'dex/lvl': 64,
  vit: 63,
  'vit/lvl': 62,
  enr: 61,
  'enr/lvl': 60,
  hp: 59,
  'hp%': 58,
  'hp/lvl': 57,
  regen: 56,
  'rep-life': 56,
  mana: 55,
  'mana%': 54,
  'mana/lvl': 53,
  'regen-mana': 52,
  manaregen: 52,
  stam: 51,
  'stam/lvl': 50,
  stamdrain: 49,
  'regen-stam': 48,
  'regen-stam/lvl': 47,
  'res-pois-max': 45,
  'res-cold-max': 44,
  'res-ltng-max': 43,
  'res-fire-max': 42,
  'res-all-max': 42,
  'res-all': 41,
  'res-cold': 40,
  coldresist: 40,
  'res-cold/lvl': 39,
  'res-ltng': 38,
  lightresist: 38,
  'res-ltng/lvl': 37,
  'res-fire': 36,
  fireresist: 36,
  'res-fire/lvl': 35,
  'res-pois': 34,
  poisonresist: 34,
  'abs-mag': 33,
  'res-pois/lvl': 33,
  'abs-cold/lvl': 32,
  'abs-cold': 31,
  'abs-ltng/lvl': 30,
  'abs-ltng': 29,
  'abs-fire/lvl': 28,
  'abs-fire': 27,
  'abs-cold%': 25,
  'abs-ltng%': 24,
  'abs-fire%': 23,
  'red-dmg': 22,
  'dmag-ac': 22,
  'red-dmg%': 22,
  dmag: 22,
  'red-mag': 21,
  'mag-ac': 21,
  nofreeze: 20,
  'no-freeze': 20,
  'half-freeze': 19,
  'res-pois-len': 18,
  reanimate: 17,
  'mana-kill': 16,
  'heal-kill': 16,
  'hp-kill': 16,
  'demon-heal': 15,
  'light-thorns': 14,
  thorns: 13,
  'thorns/lvl': 12,
  'dmg-to-mana': 11,
  addxp: 11,
  'gold%': 10,
  'gold%/lvl': 9,
  'mag%': 8,
  cheap: 8,
  'mag%/lvl': 7,
  light: 6,
  stack: 4,
  'dur%': 3,
  dur: 3,
  'rep-quant': 2,
  'rep-dur': 1,
  charged: 1,
  ease: 0,
  sock: 0,
  ethereal: 0,
  bloody: 0,
  fade: 0,
  state: 0,
  'res-mag': 41,
  'res-mag-max': 46,
  'abs-mag%': 26,
  kick: 121,
  throw: 5,
  'dmg-fire/lvl': 100,
  'dmg-ltng/lvl': 97,
  'dmg-cold/lvl': 94,
  'dmg-pois/lvl': 90,
  'att-mon%': 108,
  'dmg-mon%': 106,
}

/**
 * Canonical 1.13c ItemStatCost.txt numeric Stat ID lookup table (0..358, plus 359 for ethereal).
 * Used as the secondary tie-breaker when two distinct properties share the same descpriority.
 */
export const PROP_STAT_ID: Record<string, number> = {
  ac: 31,
  'ac-miss': 32,
  'ac-hth': 33,
  'red-dmg': 34,
  'dmag-ac': 34,
  'red-mag': 35,
  'mag-ac': 35,
  'red-dmg%': 36,
  dmag: 36,
  'ac%': 16,
  str: 0,
  enr: 1,
  dex: 2,
  vit: 3,
  hp: 7,
  mana: 9,
  stam: 11,
  'dmg%': 17,
  damagepercent: 17,
  'dmg-max%': 17,
  item_maxdamage_percent: 17,
  'dmg-min%': 18,
  item_mindamage_percent: 18,
  att: 19,
  block: 20,
  'dmg-min': 21,
  'dmg-norm': 21,
  'dmg-max': 22,
  'regen-mana': 27,
  manaregen: 27,
  'regen-stam': 28,
  'res-mag': 37,
  'res-mag-max': 38,
  'res-fire': 39,
  fireresist: 39,
  'res-all': 39,
  'all-res': 39,
  'res-fire-max': 40,
  'res-all-max': 40,
  'res-ltng': 41,
  lightresist: 41,
  'res-ltng-max': 42,
  'res-cold': 43,
  coldresist: 43,
  'res-cold-max': 44,
  'res-pois': 45,
  poisonresist: 45,
  'res-pois-max': 46,
  'fire-min': 48,
  'dmg-fire': 48,
  'dmg-elem': 48,
  'dmg-elem-min': 48,
  'fire-max': 49,
  'dmg-elem-max': 49,
  'ltng-min': 50,
  'dmg-ltng': 50,
  'ltng-max': 51,
  'dmg-mag': 52,
  'cold-min': 54,
  'dmg-cold': 54,
  'cold-max': 55,
  'cold-len': 56,
  'pois-min': 57,
  'dmg-pois': 57,
  'pois-max': 58,
  'pois-len': 59,
  lifesteal: 60,
  leech: 60,
  manasteal: 62,
  dur: 73,
  regen: 74,
  'rep-life': 74,
  'dur%': 75,
  'hp%': 76,
  'mana%': 77,
  thorns: 78,
  'gold%': 79,
  'mag%': 80,
  knock: 81,
  time: 82,
  ama: 83,
  pal: 83,
  nec: 83,
  sor: 83,
  bar: 83,
  dru: 83,
  ass: 83,
  randclassskill: 83,
  classskills: 83,
  addxp: 85,
  'heal-kill': 86,
  'hp-kill': 86,
  cheap: 87,
  herb: 88,
  light: 89,
  color: 90,
  ease: 91,
  levelreq: 92,
  ias: 93,
  swing1: 93,
  swing2: 93,
  swing3: 93,
  frw: 96,
  move1: 96,
  move2: 96,
  move3: 96,
  oskill: 97,
  state: 98,
  fhr: 99,
  balance1: 99,
  balance2: 99,
  balance3: 99,
  fbr: 102,
  block1: 102,
  block2: 102,
  block3: 102,
  fcr: 105,
  cast1: 105,
  cast2: 105,
  cast3: 105,
  skill: 107,
  'skill-rand': 107,
  rip: 108,
  'res-pois-len': 110,
  dmg: 111,
  howl: 112,
  stupidity: 113,
  blind: 113,
  'dmg-to-mana': 114,
  'ignore-ac': 115,
  'reduce-ac': 116,
  noheal: 117,
  'no-heal': 117,
  'half-freeze': 118,
  'att%': 119,
  'dmg-ac': 120,
  'dmg-demon': 121,
  'dmg-undead': 122,
  'att-demon': 123,
  'att-undead': 124,
  throw: 125,
  fireskill: 126,
  allskills: 127,
  'light-thorns': 128,
  freeze: 134,
  openwounds: 135,
  crush: 136,
  kick: 137,
  'mana-kill': 138,
  'demon-heal': 139,
  bloody: 140,
  deadly: 141,
  'abs-fire%': 142,
  'abs-fire': 143,
  'abs-ltng%': 144,
  'abs-ltng': 145,
  'abs-mag%': 146,
  'abs-mag': 147,
  'abs-cold%': 148,
  'abs-cold': 149,
  slow: 150,
  aura: 151,
  indestruct: 152,
  nofreeze: 153,
  'no-freeze': 153,
  stamdrain: 154,
  reanimate: 155,
  pierce: 156,
  magicarrow: 157,
  explosivearrow: 158,
  'dmg-throw': 159,
  'att-mon%': 179,
  'dmg-mon%': 180,
  fade: 181,
  skilltab: 188,
  sock: 194,
  'att-skill': 195,
  'kill-skill': 196,
  'death-skill': 197,
  'hit-skill': 198,
  'levelup-skill': 199,
  'gethit-skill': 201,
  charged: 204,
  'ac/lvl': 214,
  'ac%/lvl': 215,
  'hp/lvl': 216,
  'mana/lvl': 217,
  'dmg/lvl': 218,
  'dmg%/lvl': 219,
  'str/lvl': 220,
  'dex/lvl': 221,
  'enr/lvl': 222,
  'vit/lvl': 223,
  'att/lvl': 224,
  'att%/lvl': 225,
  'dmg-cold/lvl': 226,
  'dmg-fire/lvl': 227,
  'dmg-ltng/lvl': 228,
  'dmg-pois/lvl': 229,
  'res-cold/lvl': 230,
  'res-fire/lvl': 231,
  'res-ltng/lvl': 232,
  'res-pois/lvl': 233,
  'abs-cold/lvl': 234,
  'abs-fire/lvl': 235,
  'abs-ltng/lvl': 236,
  'abs-pois/lvl': 237,
  'thorns/lvl': 238,
  'gold%/lvl': 239,
  'mag%/lvl': 240,
  'regen-stam/lvl': 241,
  'stam/lvl': 242,
  'dmg-dem/lvl': 243,
  'dmg-und/lvl': 244,
  'att-dem/lvl': 245,
  'att-und/lvl': 246,
  'crush/lvl': 247,
  'wounds/lvl': 248,
  'kick/lvl': 249,
  'deadly/lvl': 250,
  'rep-dur': 252,
  'rep-quant': 253,
  stack: 254,
  'ac/time': 268,
  'ac%/time': 269,
  'hp/time': 270,
  'mana/time': 271,
  'dmg/time': 272,
  'dmg%/time': 273,
  'str/time': 274,
  'dex/time': 275,
  'enr/time': 276,
  'vit/time': 277,
  'att/time': 278,
  'att%/time': 279,
  'dmg-cold/time': 280,
  'dmg-fire/time': 281,
  'dmg-ltng/time': 282,
  'dmg-pois/time': 283,
  'res-cold/time': 284,
  'res-fire/time': 285,
  'res-ltng/time': 286,
  'res-pois/time': 287,
  'abs-cold/time': 288,
  'abs-fire/time': 289,
  'abs-ltng/time': 290,
  'abs-pois/time': 291,
  'gold%/time': 292,
  'mag%/time': 293,
  'regen-stam/time': 294,
  'stam/time': 295,
  'dmg-dem/time': 296,
  'dmg-und/time': 297,
  'att-dem/time': 298,
  'att-und/time': 299,
  'crush/time': 300,
  'wounds/time': 301,
  'kick/time': 302,
  'deadly/time': 303,
  'extra-fire': 329,
  'extra-ltng': 330,
  'extra-cold': 331,
  'extra-pois': 332,
  'pierce-fire': 333,
  'pierce-ltng': 334,
  'pierce-cold': 335,
  'pierce-pois': 336,
  'all-stats': 0,
  ethereal: 359,
}

const PROP_CODE_TO_MPQ_PROP: Record<string, string> = {
  ias: 'swing1',
  fcr: 'cast1',
  fhr: 'balance1',
  frw: 'move1',
  fbr: 'block1',
  classskills: 'ama',
  fireresist: 'res-fire',
  coldresist: 'res-cold',
  lightresist: 'res-ltng',
  poisonresist: 'res-pois',
  'all-res': 'res-all',
  dmag: 'red-dmg%',
  'dmag-ac': 'red-dmg',
  'mag-ac': 'red-mag',
  leech: 'lifesteal',
  'rep-life': 'regen',
  manaregen: 'regen-mana',
  'hp-kill': 'heal-kill',
  'no-freeze': 'nofreeze',
  'no-heal': 'noheal',
  blind: 'stupidity',
}

const COMPOSITE_OR_SPECIAL_PRIORITY_CODES = new Set([
  'dmg-norm',
  'dmg-min',
  'dmg-max',
  'res-all',
  'all-res',
  'all-stats',
  'dur',
  'cold-len',
  'pois-len',
  'levelreq',
])

let runtimePropertiesTable: PropertiesTable | undefined
let runtimeItemStatCostTable: ItemStatCostTable | undefined

export interface RuntimePropertyTables {
  readonly properties?: PropertiesTable | undefined
  readonly itemStatCost?: ItemStatCostTable | undefined
}

/**
 * Injects runtime MPQ-parsed Properties.txt and ItemStatCost.txt tables into the tooltip engine.
 */
export function setRuntimePropertyTables(
  properties?: PropertiesTable,
  itemStatCost?: ItemStatCostTable,
): void {
  runtimePropertiesTable = properties
  runtimeItemStatCostTable = itemStatCost
}

/**
 * Resolves live metadata (descPriority, statId, descFunc, descVal, dgrp) for a property code
 * from the active MPQ Properties.txt -> ItemStatCost.txt tables.
 */
export function getRuntimePropertyMetadata(
  code: string,
  tables?: RuntimePropertyTables,
): { descPriority: number; statId: number; descFunc?: number; descVal?: number; dgrp?: number } | undefined {
  const defaults = getDefaultItemPropertiesAndStats()
  const propsTable = tables?.properties ?? runtimePropertiesTable ?? defaults.properties
  const iscTable = tables?.itemStatCost ?? runtimeItemStatCostTable ?? defaults.stats

  if (!propsTable || !iscTable) {
    return undefined
  }

  const norm = (code || '').trim().toLowerCase()
  if (!norm) return undefined

  const lookupCode = PROP_CODE_TO_MPQ_PROP[norm] ?? norm
  const propRec = propsTable.byCode.get(norm) ?? propsTable.byCode.get(lookupCode)

  let statRec: ItemStatCostRecord | undefined
  if (propRec?.stat1) {
    statRec = iscTable.byStat.get(propRec.stat1)
  }
  if (!statRec && propRec) {
    try {
      const resolved = resolveProperty(propRec.code, undefined, 1, 1, {
        properties: propsTable,
        stats: iscTable,
      })
      if (resolved[0]?.stat) {
        statRec = iscTable.byStat.get(resolved[0].stat)
      }
    } catch {
      // Fallback below if resolveProperty fails
    }
  }
  if (!statRec) {
    statRec = iscTable.byStat.get(norm)
  }

  if (!propRec && !statRec && !(norm in PROP_DESC_PRIORITY) && !(norm in PROP_STAT_ID)) {
    return undefined
  }

  const statId = statRec?.id ?? PROP_STAT_ID[norm] ?? PROP_STAT_ID[lookupCode] ?? -1
  let descPriority: number
  if (
    COMPOSITE_OR_SPECIAL_PRIORITY_CODES.has(norm) ||
    COMPOSITE_OR_SPECIAL_PRIORITY_CODES.has(lookupCode) ||
    !statRec
  ) {
    descPriority = PROP_DESC_PRIORITY[norm] ?? PROP_DESC_PRIORITY[lookupCode] ?? statRec?.descPriority ?? 10
  } else {
    descPriority = statRec.descPriority
  }

  return {
    descPriority,
    statId,
    ...(statRec
      ? {
          descFunc: statRec.descFunc,
          descVal: statRec.descVal,
          dgrp: statRec.dgrp,
        }
      : {}),
  }
}

export function getPropertyPriority(code: string, tables?: RuntimePropertyTables): number {
  const norm = code.trim().toLowerCase()
  const meta = getRuntimePropertyMetadata(norm, tables)
  if (meta !== undefined) {
    return meta.descPriority
  }
  return PROP_DESC_PRIORITY[norm] ?? 10
}

export function getPropertyStatId(code: string, tables?: RuntimePropertyTables): number {
  const norm = code.trim().toLowerCase()
  const meta = getRuntimePropertyMetadata(norm, tables)
  if (meta !== undefined && meta.statId >= 0) {
    return meta.statId
  }
  const lookup = PROP_CODE_TO_MPQ_PROP[norm] ?? norm
  return PROP_STAT_ID[norm] ?? PROP_STAT_ID[lookup] ?? -1
}

const ISC_BY_ID: ReadonlyMap<number, CanonicalIscDescEntry> = (() => {
  const map = new Map<number, CanonicalIscDescEntry>()
  for (const entry of Object.values(CANONICAL_ISC_DESC_TABLE)) {
    map.set(entry.id, entry)
  }
  return map
})()

const CLASS_SKILLS_TBL_KEYS: readonly string[] = [
  'ModStr3a',
  'ModStr3d',
  'ModStr3c',
  'ModStr3b',
  'ModStr3e',
  'ModStre8a',
  'ModStre8b',
]

const CLASS_ONLY_TBL_KEYS: Readonly<Record<string, string>> = {
  ama: 'AmaOnly',
  sor: 'SorOnly',
  nec: 'NecOnly',
  pal: 'PalOnly',
  bar: 'BarOnly',
  dru: 'DruOnly',
  ass: 'AssOnly',
}

const CLASS_CODE_TO_INDEX: Readonly<Record<string, number>> = {
  ama: 0,
  amazon: 0,
  sor: 1,
  sorceress: 1,
  nec: 2,
  necromancer: 2,
  pal: 3,
  paladin: 3,
  bar: 4,
  barbarian: 4,
  dru: 5,
  druid: 5,
  ass: 6,
  assassin: 6,
}

const SKILL_TAB_TBL_KEYS: readonly [string, string][] = [
  ['StrSklTabItem3', 'AmaOnly'],
  ['StrSklTabItem2', 'AmaOnly'],
  ['StrSklTabItem1', 'AmaOnly'],
  ['StrSklTabItem15', 'SorOnly'],
  ['StrSklTabItem14', 'SorOnly'],
  ['StrSklTabItem13', 'SorOnly'],
  ['StrSklTabItem8', 'NecOnly'],
  ['StrSklTabItem7', 'NecOnly'],
  ['StrSklTabItem9', 'NecOnly'],
  ['StrSklTabItem6', 'PalOnly'],
  ['StrSklTabItem5', 'PalOnly'],
  ['StrSklTabItem4', 'PalOnly'],
  ['StrSklTabItem11', 'BarOnly'],
  ['StrSklTabItem12', 'BarOnly'],
  ['StrSklTabItem10', 'BarOnly'],
  ['StrSklTabItem16', 'DruOnly'],
  ['StrSklTabItem17', 'DruOnly'],
  ['StrSklTabItem18', 'DruOnly'],
  ['StrSklTabItem19', 'AssOnly'],
  ['StrSklTabItem20', 'AssOnly'],
  ['StrSklTabItem21', 'AssOnly'],
]

/**
 * `D2Client.dll` `0x6FB85E20[0..3]` period string table for `descFunc` 17 & 18 (`encode=4` `bytime` stats):
 * `0` = Daytime (`ModStre9e`), `1` = Dusk (`ModStre9g`), `2` = Nighttime (`ModStre9d`), `3` = Dawn (`ModStre9f`).
 */
const BYTIME_PERIOD_TBL_KEYS: readonly string[] = [
  'ModStre9e',
  'ModStre9g',
  'ModStre9d',
  'ModStre9f',
]

/**
 * `MonType.txt` `strplur` column (`+0x0A`) used by `D2Client.dll` `0x6FB05569` (`descFunc=22`).
 */
const MON_TYPE_STRPLUR_BY_ID: Readonly<Record<number, string>> = {
  1: 'Skeleton',
  2: 'Demon',
  3: 'Undead',
  8: 'Goatman',
  10: 'Afflicted',
  12: 'Fallen',
  13: 'Yeti',
  24: 'HellSwarm',
  35: 'Fetish',
  37: 'Undead Fetish',
  50: 'Yeti',
}

/**
 * Formats an `ItemStatCost.txt` stat or `Properties.txt` property code directly from
 * 1.13c `.tbl` (`CANONICAL_ENG_TBL_DICT` / `CANONICAL_CHI_TBL_DICT`) and `CANONICAL_ISC_DESC_TABLE`
 * (`descFunc` 1..28, `descVal` 0..2, `descStrPos`, `descStrNeg`, `descStr2`, and `dgrp` 1..2).
 */
export function formatStatByIscDescFunc(
  statOrCode: string,
  value: number,
  min: number = value,
  max: number = value,
  param?: string | number,
  locale: TooltipLocale = getTooltipLocale(),
  charLevel = 1,
  viewerClass?: number | string,
): string {
  const norm = (statOrCode || '').trim().toLowerCase().replace(/^\*/, '')
  const dict = locale === 'en' ? CANONICAL_ENG_TBL_DICT : CANONICAL_CHI_TBL_DICT
  const lookupTbl = (key: string): string => {
    if (!key) return ''
    return (dict[key] ?? CANONICAL_ENG_TBL_DICT[key] ?? key).trim()
  }

  const isDgrp1 = norm === 'all-stats'
  const isDgrp2 = norm === 'res-all' || norm === 'all-res'

  let entry: CanonicalIscDescEntry | undefined
  if (isDgrp1) {
    entry = CANONICAL_ISC_DESC_TABLE['strength']
  } else if (isDgrp2) {
    entry = CANONICAL_ISC_DESC_TABLE['fireresist']
  } else {
    entry =
      CANONICAL_ISC_DESC_TABLE[norm] ??
      (PROP_STAT_ID[norm] !== undefined ? ISC_BY_ID.get(PROP_STAT_ID[norm]) : undefined)
  }

  if (!entry) {
    return formatPropertyCode(statOrCode, value, min, max, param, locale, charLevel)
  }

  const useDgrp = isDgrp1 || isDgrp2
  const descFunc = useDgrp ? entry.dgrpFunc : entry.descFunc
  const descVal = useDgrp ? entry.dgrpVal : entry.descVal
  const strKey = value >= 0
    ? (useDgrp ? entry.dgrpStrPos : entry.descStrPos)
    : ((useDgrp ? entry.dgrpStrNeg : entry.descStrNeg) || (useDgrp ? entry.dgrpStrPos : entry.descStrPos))
  const str2Key = useDgrp ? entry.dgrpStr2 : entry.descStr2

  const str1 = lookupTbl(strKey)
  const str2 = lookupTbl(str2Key)

  const composeWithVal = (valStr: string, baseStr: string, extraStr = ''): string => {
    let result: string
    if (descVal === 0 || !valStr) {
      result = baseStr
    } else if (descVal === 1) {
      result = baseStr ? `${valStr} ${baseStr}` : valStr
    } else {
      result = baseStr ? `${baseStr} ${valStr}` : valStr
    }
    if (extraStr) {
      result = `${result} ${extraStr}`
    }
    return result.replace(/\s+/g, ' ').trim()
  }

  const perLvlStr = formatPerLevelVal(value, charLevel)
  const signedInt = value >= 0 ? `+${value}` : `${value}`
  const signedPerLvl = value >= 0 ? `+${perLvlStr}` : `${perLvlStr}`

  switch (descFunc) {
    case 1:
      return composeWithVal(signedInt, str1)
    case 2:
      return composeWithVal(`${value}%`, str1)
    case 3:
      return composeWithVal(`${value}`, str1)
    case 4:
      return composeWithVal(`${signedInt}%`, str1)
    case 5:
      return composeWithVal(`${Math.floor((value * 100) / 128)}%`, str1)
    case 6:
      return composeWithVal(signedPerLvl, str1, str2)
    case 7:
      return composeWithVal(`${perLvlStr}%`, str1, str2)
    case 8:
      return composeWithVal(`${signedPerLvl}%`, str1, str2)
    case 9:
      return composeWithVal(perLvlStr, str1, str2)
    case 10:
      return composeWithVal(`${Math.floor((Number(perLvlStr) * 100) / 128)}%`, str1, str2)
    case 11: {
      const rate =
        param !== undefined && param !== '' && !Number.isNaN(Number(param)) && Number(param) !== 0
          ? Number(param)
          : value
      return formatReplenishDurability(rate, locale)
    }
    case 12:
      return composeWithVal(value > 1 ? `+${value}` : '', str1)
    case 13: {
      let clsIdx = 0
      if (typeof param === 'number' && Number.isFinite(param)) {
        clsIdx = Math.max(0, Math.min(6, Math.trunc(param)))
      } else if (typeof param === 'string' && param.trim() !== '') {
        const pNorm = param.trim().toLowerCase()
        if (!Number.isNaN(Number(pNorm))) {
          clsIdx = Math.max(0, Math.min(6, Math.trunc(Number(pNorm))))
        } else if (CLASS_CODE_TO_INDEX[pNorm] !== undefined) {
          clsIdx = CLASS_CODE_TO_INDEX[pNorm]
        }
      } else if (CLASS_CODE_TO_INDEX[norm] !== undefined) {
        clsIdx = CLASS_CODE_TO_INDEX[norm]
      }
      const clsStr = lookupTbl(CLASS_SKILLS_TBL_KEYS[clsIdx] ?? 'ModStr3a')
      return composeWithVal(signedInt, clsStr)
    }
    case 14: {
      const rawParam = Number(param) || 0
      const tabIdx =
        rawParam > 20 && (rawParam & 7) <= 2 && ((rawParam >> 3) & 7) <= 6
          ? ((rawParam >> 3) & 7) * 3 + (rawParam & 7)
          : Math.max(0, Math.min(20, Math.trunc(rawParam)))
      const [tabKey, clsOnlyKey] = SKILL_TAB_TBL_KEYS[tabIdx] ?? SKILL_TAB_TBL_KEYS[0]
      const tabStr = lookupTbl(tabKey).replace('%d', String(value))
      const clsOnlyStr = lookupTbl(clsOnlyKey)
      return `${tabStr} ${clsOnlyStr}`.replace(/\s+/g, ' ').trim()
    }
    case 15: {
      let skillRef: string | number | undefined = param
      let slvl: number
      let chance: number
      if (
        typeof param === 'number' &&
        param >= 64 &&
        min === value &&
        max === value &&
        resolveSkillMeta(param) === undefined
      ) {
        skillRef = param >> 6
        slvl = Math.max(1, param & 0x3f)
        chance = value || 5
      } else {
        slvl = max !== value || min !== value ? (max || 1) : 1
        chance = min || value || 5
      }
      const skInfo = resolveSkillInfo(skillRef)
      const skName =
        locale === 'en'
          ? skInfo.name
          : (lookupTbl(skInfo.name) || skInfo.name)
      let i = 0
      const nums = [chance, slvl]
      return str1
        .replace(/%%/g, '\x00')
        .replace(/%d/g, () => String(nums[i++] ?? 0))
        .replace(/%s/g, skName)
        .replace(/\x00/g, '%')
    }
    case 16: {
      const skInfo = resolveSkillInfo(param)
      const skName =
        locale === 'en'
          ? skInfo.name
          : (lookupTbl(skInfo.name) || skInfo.name)
      return str1.replace('%d', String(value)).replace('%s', skName)
    }
    case 17:
    case 18: {
      let period = 2
      let displayVal = value
      if (param === undefined && value >= (1 << 12)) {
        period = value & 3
        const unpackedMin = ((value >>> 2) & 0x3ff) - 0x100
        const unpackedMax = ((value >>> 12) & 0x3ff) - 0x100
        displayVal = unpackedMax !== 0 ? unpackedMax : unpackedMin
      } else if (param !== undefined && param !== '' && !Number.isNaN(Number(param))) {
        period = Number(param) & 3
        displayVal = max !== 0 && max !== value ? max : value
      }
      const periodStr = lookupTbl(BYTIME_PERIOD_TBL_KEYS[period] ?? 'ModStre9d')
      const bSigned = displayVal >= 0 ? `+${displayVal}` : `${displayVal}`
      return descFunc === 17
        ? composeWithVal(bSigned, str1, periodStr)
        : composeWithVal(`${displayVal}%`, str1, periodStr)
    }
    case 19:
      if (str1.includes('%+d')) {
        return str1.replace('%+d', signedInt)
      }
      if (str1.includes('%d')) {
        return str1.replace('%d', String(value))
      }
      return composeWithVal(signedInt, str1)
    case 20:
      return composeWithVal(`-${Math.abs(value)}%`, str1)
    case 21:
      return composeWithVal(`-${Math.abs(value)}`, str1)
    case 22: {
      const monTypeId = Number(param)
      const strplurKey =
        !Number.isNaN(monTypeId) && MON_TYPE_STRPLUR_BY_ID[monTypeId]
          ? MON_TYPE_STRPLUR_BY_ID[monTypeId]
          : String(param ?? 'Monster')
      const monTypePlur = lookupTbl(strplurKey) || strplurKey
      return `${composeWithVal(`${signedInt}%`, str1)}: ${monTypePlur}`
    }
    case 23: {
      const monId = Number(param)
      const monNameEn =
        !Number.isNaN(monId) && CANONICAL_REANIMATE_MONSTERS[monId]
          ? CANONICAL_REANIMATE_MONSTERS[monId]
          : String(param || 'Returned')
      const monName = locale === 'en' ? monNameEn : lookupTbl(monNameEn) || monNameEn
      return `${composeWithVal(`${value}%`, str1)} ${monName}`.replace(/\s+/g, ' ').trim()
    }
    case 24: {
      let skillRef: string | number | undefined = param
      let slvl = max
      if (
        typeof param === 'number' &&
        param >= 64 &&
        max === value &&
        resolveSkillMeta(param) === undefined
      ) {
        skillRef = param >> 6
        slvl = Math.max(1, param & 0x3f)
      } else if (slvl <= 0) {
        slvl = resolveChargedSkillRoll113c(min, max, { skillId: skillRef }).slvl
      }
      const charges = chargedSkillChargesOf(value, min, slvl)
      const skInfo = resolveSkillInfo(skillRef)
      const skName =
        locale === 'en'
          ? skInfo.name
          : (lookupTbl(skInfo.name) || skInfo.name)
      return formatChargedSkill(slvl, skName, charges, locale === 'en' ? 'en' : 'zh')
    }
    case 27: {
      if (value === 0) return ''
      const skMeta = resolveSkillMeta(param)
      const skInfo = resolveSkillInfo(param)
      if (!skMeta && (param === undefined || param === '')) return ''
      const skName =
        locale === 'en'
          ? skInfo.name
          : (lookupTbl(skInfo.name) || skInfo.name)
      const clsCode = skMeta?.classCode?.toLowerCase() ?? ''
      const clsOnlyKey = CLASS_ONLY_TBL_KEYS[clsCode]
      const clsOnly = clsOnlyKey ? lookupTbl(clsOnlyKey) : skInfo.classOnly
      const toWord = lookupTbl('to') || 'to'
      return `${signedInt} ${toWord} ${skName}${clsOnly ? ` ${clsOnly}` : ''}`.replace(/\s+/g, ' ').trim()
    }
    case 28: {
      if (value === 0) return ''
      const skMeta = resolveSkillMeta(param)
      const skInfo = resolveSkillInfo(param)
      if (!skMeta && (param === undefined || param === '')) return ''
      let effVal = value
      if (viewerClass !== undefined && skMeta?.classCode) {
        const viewerIdx =
          typeof viewerClass === 'number'
            ? viewerClass
            : CLASS_CODE_TO_INDEX[String(viewerClass).trim().toLowerCase()]
        const skillClsIdx = CLASS_CODE_TO_INDEX[skMeta.classCode.toLowerCase()]
        if (viewerIdx !== undefined && skillClsIdx !== undefined && viewerIdx === skillClsIdx && effVal > 3) {
          effVal = 3
        }
      }
      const effSigned = effVal >= 0 ? `+${effVal}` : `${effVal}`
      const skName =
        locale === 'en'
          ? skInfo.name
          : (lookupTbl(skInfo.name) || skInfo.name)
      const toWord = lookupTbl('to') || 'to'
      return `${effSigned} ${toWord} ${skName}`.replace(/\s+/g, ' ').trim()
    }
    default:
      return formatPropertyCode(statOrCode, value, min, max, param, locale, charLevel)
  }
}

const ALIAS_CODE_MAP: Record<string, string> = {
  swing1: 'ias',
  swing2: 'ias',
  swing3: 'ias',
  cast1: 'fcr',
  cast2: 'fcr',
  cast3: 'fcr',
  balance1: 'fhr',
  balance2: 'fhr',
  balance3: 'fhr',
  move1: 'frw',
  move2: 'frw',
  move3: 'frw',
  block1: 'fbr',
  block2: 'fbr',
  block3: 'fbr',
  fireresist: 'res-fire',
  coldresist: 'res-cold',
  lightresist: 'res-ltng',
  poisonresist: 'res-pois',
  'all-res': 'res-all',
  dmag: 'red-dmg%',
  'dmag-ac': 'red-dmg',
  'mag-ac': 'red-mag',
  leech: 'lifesteal',
  'rep-life': 'regen',
  manaregen: 'regen-mana',
  'hp-kill': 'heal-kill',
  'no-freeze': 'nofreeze',
  'no-heal': 'noheal',
  blind: 'stupidity',
}

/**
 * Aggregates and sorts item properties per Diablo II 1.13c tooltip rules (Issue #125, #130, #133):
 * 1. Combines elemental min/max pairs (`fire-min` + `fire-max` -> `Adds X-Y Fire Damage`, etc.)
 * 2. Combines physical min/max pairs (`dmg-min` + `dmg-max` -> `Adds X-Y Damage`)
 * 3. Merges 4-element resistances (`dgrp=2`) into `All Resistances +X` when all 4 displayed values are equal (any sign,
 *    D2Client.dll 0x6FB04AC0)
 * 4. Merges 4 core attributes (`dgrp=1`) into `+X to all Attributes` under the same equal-value rule
 * 5. Accumulates identical scalar stats across prefixes, suffixes, and base modifiers
 * 6. Sorts all resulting properties descending by `ItemStatCost.txt` `descpriority`, with secondary ascending `statId` tie-breaker
 */
type AggregatedItemProp = RolledItemProp & {
  readonly pairRange?: {
    readonly minLo: number
    readonly minHi: number
    readonly maxLo: number
    readonly maxHi: number
  }
}

const PARAMETERIZED_SCALAR_MERGE_CODES: ReadonlySet<string> = new Set([
  'skill',
  'oskill',
  'aura',
  'skilltab',
  'reanimate',
  'att-mon%',
  'dmg-mon%',
])

function resolvePropRollBounds(p: RolledItemProp, fallback: number): readonly [number, number] {
  if (
    typeof p.min === 'number' &&
    typeof p.max === 'number' &&
    Number.isFinite(p.min) &&
    Number.isFinite(p.max)
  ) {
    return [Math.min(p.min, p.max), Math.max(p.min, p.max)]
  }
  return [fallback, fallback]
}

export function aggregateAndSortProperties(
  rawProps: readonly RolledItemProp[],
  tables?: RuntimePropertyTables,
): RolledItemProp[] {
  let fireMin = 0
  let fireMax = 0
  let fireMinLo = 0
  let fireMinHi = 0
  let fireMaxLo = 0
  let fireMaxHi = 0
  let ltngMin = 0
  let ltngMax = 0
  let ltngMinLo = 0
  let ltngMinHi = 0
  let ltngMaxLo = 0
  let ltngMaxHi = 0
  let coldMin = 0
  let coldMax = 0
  let coldMinLo = 0
  let coldMinHi = 0
  let coldMaxLo = 0
  let coldMaxHi = 0
  let coldLen = 0
  let poisMin = 0
  let poisMax = 0
  let poisMinLo = 0
  let poisMinHi = 0
  let poisMaxLo = 0
  let poisMaxHi = 0
  let poisLen = 0
  let poisCount = 0
  let physMin = 0
  let physMax = 0
  let physMinLo = 0
  let physMinHi = 0
  let physMaxLo = 0
  let physMaxHi = 0
  let edMinPct = 0
  let edMaxPct = 0
  let edMinLo = 0
  let edMinHi = 0
  let edMaxLo = 0
  let edMaxHi = 0

  let fireRes = 0
  let coldRes = 0
  let ltngRes = 0
  let poisRes = 0
  let fireResMin = 0
  let fireResMax = 0
  let coldResMin = 0
  let coldResMax = 0
  let ltngResMin = 0
  let ltngResMax = 0
  let poisResMin = 0
  let poisResMax = 0

  let strVal = 0
  let dexVal = 0
  let vitVal = 0
  let enrVal = 0
  let strMin = 0
  let strMax = 0
  let dexMin = 0
  let dexMax = 0
  let vitMin = 0
  let vitMax = 0
  let enrMin = 0
  let enrMax = 0

  const otherMerged = new Map<string, RolledItemProp>()
  const unmergedProcs: RolledItemProp[] = []

  const NON_ACCUMULATABLE = new Set([
    'hit-skill',
    'att-skill',
    'gethit-skill',
    'kill-skill',
    'death-skill',
    'levelup-skill',
    'charged',
    'skill-rand',
    'dmg-mag',
  ])

  for (const p of rawProps) {
    const rawCode = (p.code || '').trim().toLowerCase()
    if (!rawCode) continue
    const code = ALIAS_CODE_MAP[rawCode] ?? rawCode
    const val = p.value

    // 1. Fire damage bucket
    if (code === 'dmg-fire') {
      const fMin = p.min > 0 ? p.min : val
      const fMax = p.max > 0 ? p.max : val
      fireMin += fMin
      fireMax += fMax
      fireMinLo += fMin
      fireMinHi += fMin
      fireMaxLo += fMax
      fireMaxHi += fMax
      continue
    }
    if (code === 'fire-min') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      fireMin += val
      fireMinLo += lo
      fireMinHi += hi
      continue
    }
    if (code === 'fire-max') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      fireMax += val
      fireMaxLo += lo
      fireMaxHi += hi
      continue
    }

    // 2. Lightning damage bucket
    if (code === 'dmg-ltng') {
      const lMin = p.min > 0 ? p.min : val
      const lMax = p.max > 0 ? p.max : val
      ltngMin += lMin
      ltngMax += lMax
      ltngMinLo += lMin
      ltngMinHi += lMin
      ltngMaxLo += lMax
      ltngMaxHi += lMax
      continue
    }
    if (code === 'ltng-min') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      ltngMin += val
      ltngMinLo += lo
      ltngMinHi += hi
      continue
    }
    if (code === 'ltng-max') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      ltngMax += val
      ltngMaxLo += lo
      ltngMaxHi += hi
      continue
    }

    // 3. Cold damage bucket
    if (code === 'dmg-cold') {
      const cMin = p.min > 0 ? p.min : val
      const cMax = p.max > 0 ? p.max : val
      coldMin += cMin
      coldMax += cMax
      coldMinLo += cMin
      coldMinHi += cMin
      coldMaxLo += cMax
      coldMaxHi += cMax
      coldLen += Number(p.param) || 0
      continue
    }
    if (code === 'cold-min') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      coldMin += val
      coldMinLo += lo
      coldMinHi += hi
      continue
    }
    if (code === 'cold-max') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      coldMax += val
      coldMaxLo += lo
      coldMaxHi += hi
      continue
    }
    if (code === 'cold-len') {
      coldLen += val
      continue
    }

    // 4. Tri-element damage
    if (code === 'dmg-elem') {
      const eMin = p.min > 0 ? p.min : val
      const eMax = p.max > 0 ? p.max : val
      fireMin += eMin
      fireMax += eMax
      fireMinLo += eMin
      fireMinHi += eMin
      fireMaxLo += eMax
      fireMaxHi += eMax
      ltngMin += eMin
      ltngMax += eMax
      ltngMinLo += eMin
      ltngMinHi += eMin
      ltngMaxLo += eMax
      ltngMaxHi += eMax
      coldMin += eMin
      coldMax += eMax
      coldMinLo += eMin
      coldMinHi += eMin
      coldMaxLo += eMax
      coldMaxHi += eMax
      coldLen += Number(p.param) || 0
      continue
    }

    // 5. Poison damage bucket
    if (code === 'dmg-pois') {
      const psMin = p.min > 0 ? p.min : val
      const psMax = p.max > 0 ? p.max : val
      poisMin += psMin
      poisMax += psMax
      poisMinLo += psMin
      poisMinHi += psMin
      poisMaxLo += psMax
      poisMaxHi += psMax
      poisLen += Number(p.param) || 0
      poisCount += 1
      continue
    }
    if (code === 'pois-min') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      poisMin += val
      poisMinLo += lo
      poisMinHi += hi
      continue
    }
    if (code === 'pois-max') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      poisMax += val
      poisMaxLo += lo
      poisMaxHi += hi
      continue
    }
    if (code === 'pois-len') {
      poisLen += val
      continue
    }
    // ItemStatCost stat 326 `poison_count` (no descfunc): online items carry it explicitly.
    if (code === 'poison_count') {
      poisCount += val
      continue
    }

    // 6. Physical min/max damage bucket
    if (code === 'dmg-norm') {
      const pMin = p.min > 0 ? p.min : val
      const pMax = p.max > 0 ? p.max : val
      physMin += pMin
      physMax += pMax
      physMinLo += pMin
      physMinHi += pMin
      physMaxLo += pMax
      physMaxHi += pMax
      continue
    }
    if (code === 'dmg-min') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      physMin += val
      physMinLo += lo
      physMinHi += hi
      continue
    }
    if (code === 'dmg-max') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      physMax += val
      physMaxLo += lo
      physMaxHi += hi
      continue
    }

    // 6b. Enhanced Damage min% (stat 18) & max% (stat 17) bucket (D2Client.dll 0x6FB04000 + 0x6FB04594)
    if (code === 'dmg%' || code === 'damagepercent') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      edMinPct += val
      edMaxPct += val
      edMinLo += lo
      edMinHi += hi
      edMaxLo += lo
      edMaxHi += hi
      continue
    }
    if (code === 'item_mindamage_percent' || code === 'dmg-min%') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      edMinPct += val
      edMinLo += lo
      edMinHi += hi
      continue
    }
    if (code === 'item_maxdamage_percent' || code === 'dmg-max%') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      edMaxPct += val
      edMaxLo += lo
      edMaxHi += hi
      continue
    }

    // 7. Resistances bucket (dgrp=2)
    if (code === 'res-all' || code === 'all-res') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      fireRes += val
      coldRes += val
      ltngRes += val
      poisRes += val
      fireResMin += lo
      fireResMax += hi
      coldResMin += lo
      coldResMax += hi
      ltngResMin += lo
      ltngResMax += hi
      poisResMin += lo
      poisResMax += hi
      continue
    }
    if (code === 'res-fire') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      fireRes += val
      fireResMin += lo
      fireResMax += hi
      continue
    }
    if (code === 'res-cold') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      coldRes += val
      coldResMin += lo
      coldResMax += hi
      continue
    }
    if (code === 'res-ltng') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      ltngRes += val
      ltngResMin += lo
      ltngResMax += hi
      continue
    }
    if (code === 'res-pois') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      poisRes += val
      poisResMin += lo
      poisResMax += hi
      continue
    }

    // 8. Attributes bucket (dgrp=1)
    if (code === 'all-stats') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      strVal += val
      dexVal += val
      vitVal += val
      enrVal += val
      strMin += lo
      strMax += hi
      dexMin += lo
      dexMax += hi
      vitMin += lo
      vitMax += hi
      enrMin += lo
      enrMax += hi
      continue
    }
    if (code === 'str') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      strVal += val
      strMin += lo
      strMax += hi
      continue
    }
    if (code === 'dex') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      dexVal += val
      dexMin += lo
      dexMax += hi
      continue
    }
    if (code === 'vit') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      vitVal += val
      vitMin += lo
      vitMax += hi
      continue
    }
    if (code === 'enr') {
      const [lo, hi] = resolvePropRollBounds(p, val)
      enrVal += val
      enrMin += lo
      enrMax += hi
      continue
    }

    // 9. Procs / Charges / Ranges
    if (NON_ACCUMULATABLE.has(code)) {
      unmergedProcs.push({ ...p, code })
      continue
    }

    // 10. General accumulatable scalar stats
    const [lo, hi] = resolvePropRollBounds(p, val)
    const mergeParamKey = PARAMETERIZED_SCALAR_MERGE_CODES.has(code) ? String(p.param ?? '') : ''
    const mergeKey = `${code}::${mergeParamKey}`
    const existing = otherMerged.get(mergeKey)
    if (existing) {
      otherMerged.set(mergeKey, {
        code,
        param: existing.param ?? p.param,
        min: existing.min + lo,
        max: existing.max + hi,
        value: existing.value + val,
      })
    } else {
      otherMerged.set(mergeKey, {
        code,
        param: p.param,
        min: lo,
        max: hi,
        value: val,
      })
    }
  }

  const out: AggregatedItemProp[] = [...unmergedProcs, ...otherMerged.values()]

  // Emit merged Enhanced Damage (D2Client.dll 0x6FB04000 + 0x6FB04594): whenever both item_mindamage_percent (stat 18)
  // and item_maxdamage_percent (stat 17) are > 0, stat 17 is suppressed and stat 18 outputs "+{min%}% Enhanced Damage".
  // Otherwise a lone stat 17 or stat 18 outputs its own descfunc=3, descval=0 line (ModStr2j / ModStr2k).
  if ((edMinPct > 0 && edMaxPct > 0) || (edMinPct !== 0 && edMinPct === edMaxPct)) {
    out.push({ code: 'dmg%', min: edMinLo, max: edMinHi, value: edMinPct })
  } else {
    if (edMaxPct !== 0) {
      out.push({ code: 'item_maxdamage_percent', min: edMaxLo, max: edMaxHi, value: edMaxPct })
    }
    if (edMinPct !== 0) {
      out.push({ code: 'item_mindamage_percent', min: edMinLo, max: edMinHi, value: edMinPct })
    }
  }

  // Emit merged Physical Damage (D2Client.dll 0x6FB04000 + 0x6FB0453F): one "Adds %d-%d damage" line only when
  // both halves are > 0 and min < max; otherwise each half keeps its own descfunc line.
  if (physicalPairCombines(physMin, physMax)) {
    const hasPairRange = physMinLo !== physMinHi || physMaxLo !== physMaxHi
    out.push({
      code: 'dmg-norm',
      min: physMin,
      max: physMax,
      value: physMin,
      ...(hasPairRange
        ? {
            pairRange: {
              minLo: physMinLo,
              minHi: physMinHi,
              maxLo: physMaxLo,
              maxHi: physMaxHi,
            },
          }
        : {}),
    })
  } else {
    if (physMin !== 0) out.push({ code: 'dmg-min', min: physMinLo, max: physMinHi, value: physMin })
    if (physMax !== 0) out.push({ code: 'dmg-max', min: physMaxLo, max: physMaxHi, value: physMax })
  }

  // Emit merged Fire / Lightning / Cold Damage (0x6FB04328 / 0x6FB043AC / 0x6FB0436A): combined whenever both
  // halves are > 0 ("Adds %d-%d" when min < max, otherwise "+%d" with the max value); a lone half keeps its own line.
  const emitElemental = (
    pair: string,
    minCode: string,
    maxCode: string,
    min: number,
    max: number,
    minLo: number,
    minHi: number,
    maxLo: number,
    maxHi: number,
    param?: number,
  ) => {
    if (elementalPairCombines(min, max)) {
      const hasPairRange = minLo !== minHi || maxLo !== maxHi
      out.push({
        code: pair,
        ...(param !== undefined ? { param } : {}),
        min,
        max,
        value: min,
        ...(hasPairRange ? { pairRange: { minLo, minHi, maxLo, maxHi } } : {}),
      })
    } else {
      if (min !== 0) out.push({ code: minCode, min: minLo, max: minHi, value: min })
      if (max !== 0) out.push({ code: maxCode, min: maxLo, max: maxHi, value: max })
    }
  }
  emitElemental('dmg-fire', 'fire-min', 'fire-max', fireMin, fireMax, fireMinLo, fireMinHi, fireMaxLo, fireMaxHi)
  emitElemental('dmg-ltng', 'ltng-min', 'ltng-max', ltngMin, ltngMax, ltngMinLo, ltngMinHi, ltngMaxLo, ltngMaxHi)
  emitElemental('dmg-cold', 'cold-min', 'cold-max', coldMin, coldMax, coldMinLo, coldMinHi, coldMaxLo, coldMaxHi, coldLen)

  // Emit merged Poison Damage (0x6FB0446B): requires both poisonmindam and poisonmaxdam > 0; poisonlength is
  // divided by poison_count (stat 326, +1 per `dmg-pois` property) before the `(v*len+128)>>8` conversion.
  if (elementalPairCombines(poisMin, poisMax)) {
    out.push({
      code: 'dmg-pois',
      param: Math.trunc(poisLen / (poisCount > 0 ? poisCount : 1)),
      min: poisMin,
      max: poisMax,
      value: poisMin,
    })
  } else {
    if (poisMin !== 0) out.push({ code: 'pois-min', min: poisMinLo, max: poisMinHi, value: poisMin })
    if (poisMax !== 0) out.push({ code: 'pois-max', min: poisMaxLo, max: poisMaxHi, value: poisMax })
  }

  // Emit merged Attributes (dgrp=1). D2Client.dll 0x6FB04AC0 folds a dgrp group whenever every member's
  // displayed value is equal — there is no sign check, so equal negative values fold too (dgrpstrneg).
  if (strVal !== 0 && strVal === dexVal && dexVal === vitVal && vitVal === enrVal) {
    const eqAttrBounds =
      strMin === dexMin &&
      dexMin === vitMin &&
      vitMin === enrMin &&
      strMax === dexMax &&
      dexMax === vitMax &&
      vitMax === enrMax
    out.push({
      code: 'all-stats',
      min: eqAttrBounds ? strMin : strVal,
      max: eqAttrBounds ? strMax : strVal,
      value: strVal,
    })
  } else {
    if (strVal !== 0) out.push({ code: 'str', min: strMin, max: strMax, value: strVal })
    if (dexVal !== 0) out.push({ code: 'dex', min: dexMin, max: dexMax, value: dexVal })
    if (vitVal !== 0) out.push({ code: 'vit', min: vitMin, max: vitMax, value: vitVal })
    if (enrVal !== 0) out.push({ code: 'enr', min: enrMin, max: enrMax, value: enrVal })
  }

  // Emit merged Resistances (dgrp=2): same 0x6FB04AC0 rule (equal displayed values, any sign).
  if (fireRes !== 0 && fireRes === coldRes && coldRes === ltngRes && ltngRes === poisRes) {
    const eqResBounds =
      fireResMin === coldResMin &&
      coldResMin === ltngResMin &&
      ltngResMin === poisResMin &&
      fireResMax === coldResMax &&
      coldResMax === ltngResMax &&
      ltngResMax === poisResMax
    out.push({
      code: 'res-all',
      min: eqResBounds ? fireResMin : fireRes,
      max: eqResBounds ? fireResMax : fireRes,
      value: fireRes,
    })
  } else {
    if (coldRes !== 0) out.push({ code: 'res-cold', min: coldResMin, max: coldResMax, value: coldRes })
    if (ltngRes !== 0) out.push({ code: 'res-ltng', min: ltngResMin, max: ltngResMax, value: ltngRes })
    if (fireRes !== 0) out.push({ code: 'res-fire', min: fireResMin, max: fireResMax, value: fireRes })
    if (poisRes !== 0) out.push({ code: 'res-pois', min: poisResMin, max: poisResMax, value: poisRes })
  }

  // Sort descending by ItemStatCost.txt descpriority, then ascending by 1.13c statId for distinct properties
  return out
    .map((item, index) => ({
      item,
      index,
      prio: getPropertyPriority(item.code, tables),
      statId: getPropertyStatId(item.code, tables),
    }))
    .sort((a, b) => {
      if (b.prio !== a.prio) {
        return b.prio - a.prio
      }
      if (
        a.statId >= 0 &&
        b.statId >= 0 &&
        a.statId !== b.statId &&
        a.item.code.trim().toLowerCase() !== b.item.code.trim().toLowerCase()
      ) {
        return a.statId - b.statId
      }
      return a.index - b.index
    })
    .map(x => x.item)
}

function resolveItemClass(item: Item): string {
  const base = item.base
  const explicit = (item as any).itemClass ?? (base as any).itemClass ?? (base as any).class
  if (typeof explicit === 'string' && explicit.trim() !== '') {
    return explicit.trim().toLowerCase()
  }
  const fromType = inferItemClassFromType(getItemTypeCode(base))
  if (fromType) return fromType
  if (base.tags && base.tags.length > 0) {
    for (const tag of base.tags) {
      const fromTag = inferItemClassFromType(tag)
      if (fromTag) return fromTag
    }
  }
  return ''
}

function getAffixEffectiveLevelReq(aff: RolledAffix, itemClass: string): number {
  const affClass = (aff.class ?? aff.affix?.class ?? '').trim().toLowerCase()
  const affClassLevelReq = aff.classlevelreq ?? aff.affix?.classlevelreq
  if (
    itemClass &&
    affClass &&
    affClass === itemClass &&
    affClassLevelReq !== undefined &&
    affClassLevelReq > 0
  ) {
    return affClassLevelReq
  }
  return aff.levelreq
}

export interface FormatItemTooltipOptions {
  readonly showStatRanges?: boolean | undefined
  readonly showItemStatRanges?: boolean | undefined
  readonly equippedSetIds?: Iterable<string | number> | undefined
  readonly wornSetPieceCount?: number | undefined
}

function formatStatRangeSuffix(
  code: string,
  min: number,
  max: number,
  locale: TooltipLocale,
  pairRange?: AggregatedItemProp['pairRange'],
): string {
  if (pairRange && (pairRange.minLo !== pairRange.minHi || pairRange.maxLo !== pairRange.maxHi)) {
    const aPart =
      pairRange.minLo !== pairRange.minHi ? `${pairRange.minLo}-${pairRange.minHi}` : `${pairRange.minLo}`
    const bPart =
      pairRange.maxLo !== pairRange.maxHi ? `${pairRange.maxLo}-${pairRange.maxHi}` : `${pairRange.maxLo}`
    const joiner = locale === 'zh' ? '至' : 'to'
    return ` [${aPart} ${joiner} ${bPart}]`
  }
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  if (lo === hi) return ''
  const norm = code.trim().toLowerCase()
  if (norm.endsWith('/lvl') || norm.endsWith('_perlevel')) {
    const fmt = (v: number): string => String(Number((v / 8).toFixed(3)))
    return ` [${fmt(lo)}-${fmt(hi)}]`
  }
  return ` [${lo}-${hi}]`
}

/**
 * Generates formatted tooltip structure for any dropped Diablo II Item.
 */
export function formatItemTooltip(
  item: Item,
  localeOrOptions?: TooltipLocale | FormatItemTooltipOptions,
  maybeOptions?: FormatItemTooltipOptions,
): FormattedItemTooltip {
  const locale: TooltipLocale =
    typeof localeOrOptions === 'string' ? localeOrOptions : getTooltipLocale()
  const options: FormatItemTooltipOptions | undefined =
    typeof localeOrOptions === 'object' && localeOrOptions !== null ? localeOrOptions : maybeOptions
  const base = item.base
  const rawQuality = String(item.rarity || item.quality || 'normal').toLowerCase()
  const isRunewordItem = Boolean(
    rawQuality === 'runeword' ||
      item.flags?.runeword ||
      (item as any).runeword ||
      (item as any).isRuneword,
  )
  const quality = isRunewordItem
    ? 'runeword'
    : rawQuality === '2'
      ? 'normal'
      : rawQuality === '3'
        ? 'superior'
        : rawQuality === '1'
          ? 'low'
          : rawQuality === '4'
            ? 'magic'
            : rawQuality === '5'
              ? 'set'
              : rawQuality === '6'
                ? 'rare'
                : rawQuality === '7'
                  ? 'unique'
                  : rawQuality === '8' || rawQuality === 'crafted'
                    ? 'craft'
                    : rawQuality
  const ilvl = item.level ?? item.ilvl ?? 1
  const itemClass = resolveItemClass(item)

  let title = item.name
  let subTitle: string | undefined = undefined
  let qualityColor: string = '#ffffff'
  const lines: FormattedStatLine[] = []

  // Check if this item is a Gem or a Rune (Socketable)
  const itemCode = (item.code || (item.base as any)?.code || item.base?.id || '').trim().toLowerCase()
  const socketable = getSocketableInfo(itemCode)
  const isRune = isRuneCode(itemCode)

  if (socketable) {
    const isZh = locale === 'zh' || locale === 'bilingual'
    let title: string
    let subTitle: string | undefined = undefined
    let quality: string
    let qualityColor: string
    let baseType: string

    if (isRune) {
      const runeInfo = socketable as RuneInfo
      if (locale === 'zh') {
        title = `${runeInfo.nameZh}符文`
        subTitle = `符文 (${runeInfo.num})`
      } else if (locale === 'bilingual') {
        title = `${runeInfo.nameEn} (${runeInfo.nameZh})`
        subTitle = `Rune (${runeInfo.num})`
      } else {
        title = runeInfo.nameEn
        subTitle = `Rune (${runeInfo.num})`
      }
      quality = locale === 'zh' ? '符文' : 'Rune'
      qualityColor = '#ff8c00'
      baseType = locale === 'zh' ? '符文' : 'Rune'
    } else {
      const gemInfo = socketable as GemInfo
      if (locale === 'zh') {
        title = gemInfo.nameZh
      } else if (locale === 'bilingual') {
        title = `${gemInfo.nameEn} (${gemInfo.nameZh})`
      } else {
        title = gemInfo.nameEn
      }
      quality = locale === 'zh' ? '宝石' : 'Gem'
      qualityColor = '#ffffff'
      baseType = locale === 'zh' ? '宝石' : 'Gem'
    }

    // Line 0: Instruction (White / Instruction)
    lines.push({
      text: isZh ? '可镶嵌进有凹槽的装备' : 'Can be Inserted into Socketed Items',
      color: 'instruction',
    })

    // Lines 1..4: The 4 distinct equipment slots (White, strictly matching D2 1.13c)
    lines.push({
      text: isZh ? `武器: ${socketable.weaponsZh}` : `Weapons: ${socketable.weaponsEn}`,
      color: 'white',
    })
    lines.push({
      text: isZh ? `防具: ${socketable.armorZh}` : `Armor: ${socketable.armorEn}`,
      color: 'white',
    })
    lines.push({
      text: isZh ? `头盔: ${socketable.helmsZh}` : `Helms: ${socketable.helmsEn}`,
      color: 'white',
    })
    lines.push({
      text: isZh ? `盾牌: ${socketable.shieldsZh}` : `Shields: ${socketable.shieldsEn}`,
      color: 'white',
    })

    // Note: Required Level (`socketable.reqLevel`) is returned via `reqLevel` below
    // and rendered once at the bottom of the socketable tooltip by `WorldPanelsHud.drawItemTooltip`
    // with dynamic white/red coloring based on `playerCtx.level < reqLevel` (Issue #723).

    return {
      title,
      subTitle,
      quality,
      qualityColor,
      baseType,
      ilvl,
      reqLevel: socketable.reqLevel > 0 ? socketable.reqLevel : undefined,
      lines,
      isSocketable: true,
    }
  }

  // Check if this is Gold
  if (base.id === 'gld' || (base.kind !== 'weapon' && base.kind !== 'armor' && base.name.trim().toLowerCase() === 'gold')) {
    const amount = (item.stats.amount ?? item.value ?? 100)
    title = locale === 'zh' ? `${amount.toLocaleString()} 金币` : `${amount.toLocaleString()} Gold`
    qualityColor = '#ffd700'
    return {
      title,
      quality: locale === 'zh' ? '普通' : 'Normal',
      qualityColor,
      baseType: locale === 'zh' ? '金币' : 'Gold',
      ilvl: 1,
      lines: [],
    }
  }

  // Collect raw properties from the item across all quality tiers
  const rawProps: RolledItemProp[] = []
  let affixReqLevel = 0

  const autoMagicDef = (item as any).rolledAutoMagic as { entry?: any; levelreq?: number; mods?: readonly RolledMod[] } | undefined
  if (quality === 'magic' || quality === 'rare') {
    if (autoMagicDef) {
      const autoEffReq = getAffixEffectiveLevelReq((autoMagicDef.entry ?? autoMagicDef) as any, itemClass)
      if (autoEffReq > 0) {
        affixReqLevel = Math.max(affixReqLevel, autoEffReq)
      } else if (autoMagicDef.levelreq && autoMagicDef.levelreq > 0) {
        affixReqLevel = Math.max(affixReqLevel, autoMagicDef.levelreq)
      }
    } else if (typeof (item as any).autoAffixId === 'number' && (item as any).autoAffixId > 0) {
      const autoId = (item as any).autoAffixId as number
      const autoEntry =
        CANONICAL_AUTOMAGIC_TABLE.entries[autoId - 1] ??
        CANONICAL_AUTOMAGIC_TABLE.entries.find(e => e.id === autoId)
      if (autoEntry) {
        const autoEffReq = getAffixEffectiveLevelReq(autoEntry as any, itemClass)
        if (autoEffReq > 0) {
          affixReqLevel = Math.max(affixReqLevel, autoEffReq)
        } else if (autoEntry.levelreq > 0) {
          affixReqLevel = Math.max(affixReqLevel, autoEntry.levelreq)
        }
      }
    }
  } else if (quality !== 'craft' && autoMagicDef?.levelreq && autoMagicDef.levelreq > 0) {
    // Preserve explicit rolledAutoMagic.levelreq when present on non-crafted domain item
    affixReqLevel = Math.max(affixReqLevel, autoMagicDef.levelreq)
  }

  const baseCode = (item.code || (base as any)?.code || base.id || '').trim()
  const baseNameEn = resolveBaseItemNameEn(base.name, baseCode)

  if (quality === 'unique') {
    qualityColor = '#c8a15a'
    const uniqDef = item.uniqueItemDef as UniqueItem | undefined
    if (uniqDef) {
      const rawUniqueKey = (uniqDef.index || '').trim()
      const uniqNameEn = resolveBaseItemNameEn(rawUniqueKey, baseCode) || rawUniqueKey
      const uniqNameZh =
        translateItemName(rawUniqueKey) !== rawUniqueKey
          ? translateItemName(rawUniqueKey)
          : translateItemName(uniqNameEn)
      if (locale === 'zh') {
        title = uniqNameZh
        subTitle = translateItemName(baseNameEn)
      } else if (locale === 'bilingual') {
        const bZh = translateItemName(baseNameEn)
        title = `${uniqNameEn} (${uniqNameZh})`
        subTitle = `${baseNameEn} (${bZh})`
      } else {
        title = uniqNameEn
        subTitle = baseNameEn
      }
      if (uniqDef.levelreq > 0) affixReqLevel = Math.max(affixReqLevel, uniqDef.levelreq)
      if (item.rolledProps && item.rolledProps.length > 0) {
        rawProps.push(...item.rolledProps)
      } else if (Array.isArray(uniqDef.props)) {
        for (const prop of uniqDef.props) {
          if (prop.code) {
            rawProps.push({
              code: prop.code,
              param: prop.par,
              min: prop.min,
              max: prop.max,
              value: prop.min,
            })
          }
        }
      }
    } else {
      subTitle = locale === 'zh' ? translateItemName(baseNameEn) : locale === 'bilingual' ? `${baseNameEn} (${translateItemName(baseNameEn)})` : baseNameEn
    }
  } else if (quality === 'set') {
    qualityColor = '#00e600'
    const setDef =
      (item.setItemDef as SetItem | undefined) ??
      (item.name ? CANONICAL_SET_ITEMS_TABLE.get(item.name) : undefined)
    if (setDef) {
      const sEn = resolveBaseItemNameEn(setDef.index) || setDef.index.trim()
      if (locale === 'zh') {
        title = translateItemName(setDef.index.trim())
        subTitle = translateItemName(baseNameEn)
      } else if (locale === 'bilingual') {
        const sZh = translateItemName(setDef.index.trim())
        const bZh = translateItemName(baseNameEn)
        title = `${sEn} (${sZh})`
        subTitle = `${baseNameEn} (${bZh})`
      } else {
        title = sEn
        subTitle = baseNameEn
      }
      if (setDef.levelreq > 0) affixReqLevel = Math.max(affixReqLevel, setDef.levelreq)
      if (item.rolledProps && item.rolledProps.length > 0) {
        rawProps.push(...item.rolledProps)
      } else if (Array.isArray(setDef.props)) {
        for (const prop of setDef.props) {
          if (prop.code) {
            rawProps.push({
              code: prop.code,
              param: prop.par,
              min: prop.min,
              max: prop.max,
              value: prop.min,
            })
          }
        }
      }
    } else {
      subTitle = locale === 'zh' ? translateItemName(baseNameEn) : locale === 'bilingual' ? `${baseNameEn} (${translateItemName(baseNameEn)})` : baseNameEn
    }
  } else if (quality === 'rare' || quality === 'craft') {
    qualityColor = quality === 'craft' ? '#ff8c00' : '#ffff60'
    const rareDef = item.rolledRareAffixes as GeneratedRareAffixes | undefined
    const rawRareName = rareDef?.name || item.name
    const rarePreKey = (rareDef as any)?.rarePrefix?.name ?? (rareDef as any)?.prefix1?.name
    const rareSufKey = (rareDef as any)?.rareSuffix?.name ?? (rareDef as any)?.suffix1?.name
    const enName = resolveRareNameEn(rawRareName, rarePreKey, rareSufKey)
    if (locale === 'zh') {
      title = translateRareName(rawRareName, rarePreKey, rareSufKey)
      subTitle = translateItemName(baseNameEn, baseCode)
    } else if (locale === 'bilingual') {
      const rZh = translateRareName(rawRareName, rarePreKey, rareSufKey)
      const bZh = translateItemName(baseNameEn, baseCode)
      title = `${enName} (${rZh})`
      subTitle = `${baseNameEn} (${bZh})`
    } else {
      title = enName
      subTitle = baseNameEn
    }
    if (rareDef && Array.isArray(rareDef.affixes)) {
      for (const aff of rareDef.affixes) {
        const effReq = getAffixEffectiveLevelReq(aff, itemClass)
        if (effReq > 0) affixReqLevel = Math.max(affixReqLevel, effReq)
      }
      if (quality === 'craft') {
        affixReqLevel = Math.min(98, affixReqLevel + 10 + 3 * rareDef.affixes.length)
      }
    }
    if (item.rolledProps && item.rolledProps.length > 0) {
      for (const p of item.rolledProps) {
        const keepRange = NON_RANDOM_RANGE_CODES.has(p.code.toLowerCase()) || (p.min === 0 && p.max === 0)
        rawProps.push({
          code: p.code,
          param: p.param,
          min: keepRange ? p.min : p.value,
          max: keepRange ? p.max : p.value,
          value: p.value,
        })
      }
    } else if (rareDef && Array.isArray(rareDef.affixes)) {
      for (const aff of rareDef.affixes) {
        if (Array.isArray(aff.mods)) {
          for (const mod of aff.mods) {
            const keepRange = NON_RANDOM_RANGE_CODES.has(mod.code.toLowerCase()) || (mod.min === 0 && mod.max === 0)
            rawProps.push({
              code: mod.code,
              param: mod.param,
              min: keepRange ? mod.min : mod.value,
              max: keepRange ? mod.max : mod.value,
              value: mod.value,
            })
          }
        }
      }
    }
  } else if (quality === 'magic') {
    qualityColor = '#4880ff'
    const magicDef = item.rolledMagicAffixes as GeneratedAffixes | undefined
    const rawMagicName = magicDef?.name || item.name
    const magicPreKey = magicDef?.prefix?.name ?? item.prefix?.name
    const magicSufKey = magicDef?.suffix?.name ?? item.suffix?.name
    const enName = resolveMagicNameEn(
      rawMagicName,
      base.name,
      magicPreKey,
      magicSufKey,
      baseCode,
    )
    if (locale === 'zh') {
      title = translateMagicName(rawMagicName, base.name, magicPreKey, magicSufKey, baseCode)
      subTitle = translateItemName(baseNameEn, baseCode)
    } else if (locale === 'bilingual') {
      const mZh = translateMagicName(rawMagicName, base.name, magicPreKey, magicSufKey, baseCode)
      const bZh = translateItemName(baseNameEn, baseCode)
      title = `${enName} (${mZh})`
      subTitle = `${baseNameEn} (${bZh})`
    } else {
      title = enName
      subTitle = baseNameEn
    }
    if (magicDef) {
      if (magicDef.prefix) {
        const effReq = getAffixEffectiveLevelReq(magicDef.prefix, itemClass)
        if (effReq > 0) affixReqLevel = Math.max(affixReqLevel, effReq)
      }
      if (magicDef.suffix) {
        const effReq = getAffixEffectiveLevelReq(magicDef.suffix, itemClass)
        if (effReq > 0) affixReqLevel = Math.max(affixReqLevel, effReq)
      }
      if (Array.isArray(magicDef.affixes)) {
        for (const aff of magicDef.affixes) {
          const effReq = getAffixEffectiveLevelReq(aff, itemClass)
          if (effReq > 0) affixReqLevel = Math.max(affixReqLevel, effReq)
        }
      }
    }
    if (item.rolledProps && item.rolledProps.length > 0) {
      for (const p of item.rolledProps) {
        const keepRange = NON_RANDOM_RANGE_CODES.has(p.code.toLowerCase()) || (p.min === 0 && p.max === 0)
        rawProps.push({
          code: p.code,
          param: p.param,
          min: keepRange ? p.min : p.value,
          max: keepRange ? p.max : p.value,
          value: p.value,
        })
      }
    } else if (magicDef) {
      if (magicDef.prefix && Array.isArray(magicDef.prefix.mods)) {
        for (const m of magicDef.prefix.mods) {
          const keepRange = NON_RANDOM_RANGE_CODES.has(m.code.toLowerCase()) || (m.min === 0 && m.max === 0)
          rawProps.push({
            code: m.code,
            param: m.param,
            min: keepRange ? m.min : m.value,
            max: keepRange ? m.max : m.value,
            value: m.value,
          })
        }
      }
      if (magicDef.suffix && Array.isArray(magicDef.suffix.mods)) {
        for (const m of magicDef.suffix.mods) {
          const keepRange = NON_RANDOM_RANGE_CODES.has(m.code.toLowerCase()) || (m.min === 0 && m.max === 0)
          rawProps.push({
            code: m.code,
            param: m.param,
            min: keepRange ? m.min : m.value,
            max: keepRange ? m.max : m.value,
            value: m.value,
          })
        }
      }
    }
  } else if (quality === 'superior') {
    const hasSocketed = Boolean(
      (item.socketedItems && item.socketedItems.length > 0) ||
        (item.name && item.name.startsWith('Gemmed ')),
    )
    qualityColor = hasSocketed ? '#a0a0a0' : '#ffffff'
    const enName = hasSocketed
      ? `Gemmed ${baseNameEn}`
      : item.name && item.name.startsWith('Superior ')
        ? item.name
        : `Superior ${baseNameEn}`
    const zhName = hasSocketed
      ? `镶嵌的${translateItemName(baseNameEn)}`
      : translateItemName(enName)
    if (locale === 'zh') {
      title = zhName
    } else if (locale === 'bilingual') {
      title = `${enName} (${zhName})`
    } else {
      title = enName
    }
    if (item.rolledProps && item.rolledProps.length > 0) {
      rawProps.push(...item.rolledProps)
    } else if (base.kind === 'weapon') {
      rawProps.push({ code: 'dmg%', min: 15, max: 15, value: 15 })
    } else {
      rawProps.push({ code: 'ac%', min: 15, max: 15, value: 15 })
    }
  } else if (quality === 'low') {
    qualityColor = '#a0a0a0'
    const hasSocketed = Boolean(
      (item.socketedItems && item.socketedItems.length > 0) ||
        (item.name && item.name.startsWith('Gemmed ')),
    )
    const enName = hasSocketed
      ? `Gemmed ${baseNameEn}`
      : item.name && item.name !== base.name
        ? item.name
        : `Cracked ${baseNameEn}`
    const zhName = hasSocketed
      ? `镶嵌的${translateItemName(baseNameEn)}`
      : translateItemName(enName)
    if (locale === 'zh') {
      title = zhName
    } else if (locale === 'bilingual') {
      title = `${enName} (${zhName})`
    } else {
      title = enName
    }
    if (item.rolledProps && item.rolledProps.length > 0) {
      rawProps.push(...item.rolledProps)
    }
  } else if (quality === 'runeword' || (quality === 'rune' && !socketable)) {
    qualityColor = '#c8a15a'
    const rwKey =
      (item as any).runeword?.key ||
      (item as any).runeword?.name ||
      (item as any).runewordName ||
      item.name ||
      'Runeword'
    const rwEn =
      (item as any).runeword?.name && !(item as any).runeword.name.startsWith('Runeword')
        ? String((item as any).runeword.name)
        : CANONICAL_ENG_TBL_DICT[rwKey] || String(item.name || rwKey)
    const rwZhRaw = (item as any).nameZh
      ? String((item as any).nameZh).replace(/\s*\([A-Za-z0-9' -]+\)$/, '')
      : translateItemName(rwKey) !== rwKey
        ? translateItemName(rwKey)
        : translateItemName(rwEn)
    const rwZh = rwZhRaw || rwEn
    const bZh = (item as any).baseNameZh || translateItemName(baseNameEn)
    if (locale === 'zh') {
      title = rwZh
      subTitle = bZh
    } else if (locale === 'bilingual') {
      title = rwZh !== rwEn ? `${rwEn} (${rwZh})` : rwEn
      subTitle = `${baseNameEn} (${bZh})`
    } else {
      title = rwEn
      subTitle = baseNameEn
    }
    const rwLevelReq = (item as any).runeword?.levelreq || (item as any).reqLevel
    if (rwLevelReq && rwLevelReq > 0) {
      affixReqLevel = Math.max(affixReqLevel, rwLevelReq)
    }
    if (item.rolledProps && item.rolledProps.length > 0) {
      rawProps.push(...item.rolledProps)
    } else if (Array.isArray((item as any).runeword?.props)) {
      for (const prop of (item as any).runeword.props) {
        if (prop.code) {
          rawProps.push({
            code: prop.code,
            param: prop.par ?? prop.param,
            min: prop.min,
            max: prop.max,
            value: prop.min,
          })
        }
      }
    }
  } else {
    const hasSocketed = Boolean(
      (item.socketedItems && item.socketedItems.length > 0) ||
        (item.name && item.name.startsWith('Gemmed ')),
    )
    const hasSockets = Boolean(
      hasSocketed ||
        item.flags?.socketed ||
        (item.totalSockets && item.totalSockets > 0) ||
        ((item as any).sockets && (item as any).sockets > 0),
    )
    const isEth = Boolean(item.flags?.ethereal || (item as any).ethereal || item.stats?.ethereal)
    const isOrangeSpecial =
      itemCode === 'ceh' ||
      itemCode === 'bet' ||
      itemCode === 'tes' ||
      itemCode === 'fed' ||
      itemCode === 'toa' ||
      itemCode === 'dhn' ||
      itemCode === 'bey' ||
      itemCode === 'mbr' ||
      itemCode === 'pk1' ||
      itemCode === 'pk2' ||
      itemCode === 'pk3'
    const isQuestItem =
      itemCode !== 'leg' &&
      ((itemCode.length > 0 &&
        (itemCode === 'bks' ||
          itemCode === 'bkd' ||
          itemCode === 'hdm' ||
          itemCode === 'ass' ||
          itemCode === 'tr1' ||
          itemCode === 'box' ||
          itemCode === 'hst' ||
          itemCode === 'msf' ||
          itemCode === 'vip' ||
          itemCode === 'j34' ||
          itemCode === 'g34' ||
          itemCode === 'xyz' ||
          itemCode === 'g33' ||
          itemCode === 'd33' ||
          itemCode === 'bbb' ||
          itemCode === 'qey' ||
          itemCode === 'qhr' ||
          itemCode === 'qbr' ||
          itemCode === 'qf1' ||
          itemCode === 'qf2' ||
          itemCode === 'mss' ||
          itemCode === 'hfh' ||
          itemCode === 'ice' ||
          itemCode === 'tr2')) ||
        ((base as { quest?: number }).quest ?? 0) > 0)
    qualityColor = isOrangeSpecial
      ? '#ff9c18'
      : isQuestItem
        ? '#c8a15a'
        : hasSocketed || hasSockets || isEth
          ? '#a0a0a0'
          : '#e0d5c1'
    const enName = hasSocketed ? `Gemmed ${baseNameEn}` : baseNameEn
    const zhName = hasSocketed
      ? `镶嵌的${translateItemName(baseNameEn)}`
      : translateItemName(baseNameEn)
    if (locale === 'zh') {
      title = zhName
    } else if (locale === 'bilingual') {
      title = `${enName} (${zhName})`
    } else {
      title = enName
    }
    if (item.rolledProps && item.rolledProps.length > 0) {
      rawProps.push(...item.rolledProps)
    }
  }

  // Fallback for domain items where rolledAutoMagic or staffMods were provided without rolledProps
  if ((!item.rolledProps || item.rolledProps.length === 0) && quality !== 'unique' && quality !== 'set' && quality !== 'runeword') {
    if (autoMagicDef && Array.isArray(autoMagicDef.mods)) {
      for (const mod of autoMagicDef.mods) {
        const keepRange = NON_RANDOM_RANGE_CODES.has(mod.code.toLowerCase()) || (mod.min === 0 && mod.max === 0)
        rawProps.push({
          code: mod.code,
          param: mod.param,
          min: keepRange ? mod.min : mod.value,
          max: keepRange ? mod.max : mod.value,
          value: mod.value,
        })
      }
    }
    if (Array.isArray((item as any).staffMods)) {
      for (const sm of (item as any).staffMods) {
        rawProps.push({
          code: sm.code,
          param: sm.param,
          min: sm.min,
          max: sm.max,
          value: sm.value,
        })
      }
    }
  }

  // 0. If this item is an un-socketed Jewel ('jew' / 'jewl'), prepend the 1.13c socketable instruction
  const isJewel =
    isJewelCode(itemCode) ||
    isJewelCode((item as { type?: string }).type) ||
    Boolean(base.tags?.some((t) => t.toLowerCase() === 'jewl'))
  if (isJewel) {
    const isZh = locale === 'zh' || locale === 'bilingual'
    lines.push({
      text: isZh ? '可镶嵌进有凹槽的装备' : 'Can be Inserted into Socketed Items',
      color: 'instruction',
    })
  }

  // 0b. If this item is a 1.13c multi-line `.tbl` quest/respec consumable (`xyz`, `ass`, `ice`, `tr2`, `toa`),
  // emit its canonical right-click instruction line (`string.tbl` / `expansionstring.tbl` / `patchstring.tbl`).
  if (
    itemCode === 'xyz' ||
    itemCode === 'ass' ||
    itemCode === 'ice' ||
    itemCode === 'tr2' ||
    itemCode === 'toa'
  ) {
    const isZh = locale === 'zh' || locale === 'bilingual'
    const instrText =
      itemCode === 'xyz'
        ? isZh
          ? '滑鼠右键点选之后，可以永久性的增加20点生命'
          : 'Right Click to permanently add 20 to Life'
        : itemCode === 'ass'
          ? isZh
            ? '滑鼠右键点选后可以增加一点技能点数'
            : 'Right Click to learn skill of your choice'
          : itemCode === 'ice'
            ? isZh
              ? '留着用来解冻安亚'
              : 'Keep it to thaw Anya'
            : itemCode === 'tr2'
              ? isZh
                ? '点击鼠标右键施展'
                : 'Right Click to Cast'
              : isZh
                ? '右键点击以重设属性/技能点数。'
                : 'Right-click to reset Stat/Skill Points'
    lines.push({
      text: instrText,
      color: 'instruction',
    })
  }

  // Respect explicit reqLevel on the item if present
  if (typeof (item as any).reqLevel === 'number' && (item as any).reqLevel > 0) {
    affixReqLevel = Math.max(affixReqLevel, (item as any).reqLevel)
  }

  // Aggregate modifiers, reqLevel, and rune letters from socketedItems (Gems, Runes, Jewels)
  let derivedRunewordRunes: string | undefined = (item as any).runewordRunes
  if (item.socketedItems && item.socketedItems.length > 0) {
    const hostCategory = resolveSocketTargetCategory(item)
    const runeLetters: string[] = []
    for (const sockItem of item.socketedItems) {
      const sockCode = (sockItem.code || (sockItem.base as any)?.code || sockItem.base?.id || '').trim().toLowerCase()
      const sockInfo = getSocketableInfo(sockCode)
      const sockReqLvl =
        sockInfo !== undefined
          ? sockInfo.reqLevel
          : ((sockItem as any).reqLevel ?? sockItem.level ?? 0)
      if (sockReqLvl > 0) {
        affixReqLevel = Math.max(affixReqLevel, sockReqLvl)
      }
      const rInfo = RUNE_INFO[sockCode]
      if (rInfo) {
        runeLetters.push(rInfo.letter)
      }
      if (!(item as any)._socketPropsMerged && hostCategory) {
        const sockProps = getSocketedItemModifiersForHost(sockItem, hostCategory, CANONICAL_GEMS_TABLE)
        const sockQualRaw = String(sockItem.rarity || sockItem.quality || '').toLowerCase()
        const isSockUnique = sockQualRaw === 'unique' || sockQualRaw === '7' || sockItem.quality === 7
        for (const sp of sockProps) {
          if (isSockUnique || NON_RANDOM_RANGE_CODES.has(sp.code.toLowerCase())) {
            rawProps.push(sp)
          } else {
            rawProps.push({
              ...sp,
              min: sp.value,
              max: sp.value,
            })
          }
        }
      }
    }
    if (!derivedRunewordRunes && runeLetters.length > 0) {
      derivedRunewordRunes = `'${runeLetters.join('')}'`
    } else if (derivedRunewordRunes && !derivedRunewordRunes.startsWith("'")) {
      derivedRunewordRunes = `'${derivedRunewordRunes}'`
    }
  }

  const charLevel = Math.max(
    0,
    Math.trunc(Number((item as any).charLevel ?? (item as any).playerLevel ?? 0) || 0),
  )
  const propCharLevel = charLevel > 0 ? charLevel : 1
  const rawPlayerClass = String((item as any).charClass ?? (item as any).playerClass ?? '').trim().toLowerCase()

  const isUnidentifiedItem =
    (item as { identified?: boolean }).identified === false || item.flags?.identified === false
  const isEligibleSetUniqueRunewordQuality =
    !socketable &&
    !isUnidentifiedItem &&
    (quality === 'unique' ||
      quality === 'set' ||
      quality === 'runeword' ||
      (quality === 'rune' && !socketable))
  const allowItemStatRange =
    !isUnidentifiedItem &&
    (Boolean(options?.showStatRanges) ||
      (Boolean(options?.showItemStatRanges) && isEligibleSetUniqueRunewordQuality))

  const appendRangeIfVariable = (text: string, prop: RolledItemProp): string => {
    if (!text || !allowItemStatRange) return text
    const normCode = (prop.code || '').trim().toLowerCase().replace(/^\*/, '')
    const pairRange = (prop as AggregatedItemProp).pairRange
    if (pairRange && (pairRange.minLo !== pairRange.minHi || pairRange.maxLo !== pairRange.maxHi)) {
      return `${text}${formatStatRangeSuffix(normCode, prop.min, prop.max, locale, pairRange)}`
    }
    if (
      NON_RANDOM_RANGE_CODES.has(normCode) ||
      normCode === 'ethereal' ||
      normCode === 'indestruct' ||
      normCode === 'state' ||
      normCode === 'corrupt' ||
      normCode === 'desecrate' ||
      normCode === 'mirrored'
    ) {
      return text
    }
    if (
      typeof prop.min === 'number' &&
      typeof prop.max === 'number' &&
      Number.isFinite(prop.min) &&
      Number.isFinite(prop.max) &&
      prop.min !== prop.max
    ) {
      return `${text}${formatStatRangeSuffix(normCode, prop.min, prop.max, locale)}`
    }
    return text
  }

  // Merge and sort properties per Issue #125 (min/max damage pairs, dgrp resists/attributes, descpriority)
  const mergedProps = aggregateAndSortProperties(
    rawProps.filter(p => (p.code || '').trim().toLowerCase() !== 'levelreq'),
  )
  for (const prop of mergedProps) {
    const baseText = formatPropertyCode(prop.code, prop.value, prop.min, prop.max, prop.param, locale, propCharLevel)
    lines.push({
      text: appendRangeIfVariable(baseText, prop),
      color: 'blue',
      isMagic: true,
    })
  }

  let setName: string | undefined
  let setPieces: string[] | undefined
  let setPieceColors: ('green' | 'red')[] | undefined
  let setBonuses: FormattedStatLine[] | undefined
  const activeItemProps: RolledItemProp[] = []

  if (quality === 'set') {
    const setItemDef =
      (item.setItemDef as SetItem | undefined) ??
      (item.name ? CANONICAL_SET_ITEMS_TABLE.get(item.name) : undefined)
    if (setItemDef) {
      const setRecord = CANONICAL_SETS_TABLE.get(setItemDef.set)
      const memberItems = CANONICAL_SET_ITEMS_TABLE.getBySet(setItemDef.set)
      const rawSetKey = (setRecord?.name || setItemDef.set).trim()
      const setEn = resolveBaseItemNameEn(rawSetKey) || rawSetKey
      const setZh = translateItemName(rawSetKey)
      setName =
        locale === 'zh'
          ? setZh
          : locale === 'bilingual'
            ? `${setEn} (${setZh})`
            : setEn

      if (memberItems.length > 0) {
        const isItemBroken = (it: any): boolean => {
          if (!it || typeof it !== 'object') return false
          if (Boolean(it.broken) || Boolean(it.flags?.broken)) return true
          const statsArr = Array.isArray(it.stats) ? it.stats : undefined
          const stat72 = statsArr?.find((s: any) => s && s.statId === 72)
          const stat73 = statsArr?.find((s: any) => s && s.statId === 73)
          const curDur = it.durability ?? it.curDurability ?? stat72?.value
          const maxDur = it.maxDurability ?? stat73?.value ?? 0
          return curDur === 0 && Number(maxDur) > 0
        }
        const equippedIndicesRaw: readonly (string | number)[] | undefined =
          options?.equippedSetIds !== undefined
            ? [...options.equippedSetIds]
            : Array.isArray((item as any).equippedSetIds)
              ? (item as any).equippedSetIds
              : (item as any).equippedSetIds &&
                  typeof (item as any).equippedSetIds[Symbol.iterator] === 'function'
                ? [...(item as any).equippedSetIds]
                : undefined
        const equippedSetIdSet = new Set<number>()
        const equippedSetIndexSet = new Set<string>()
        if (equippedIndicesRaw) {
          for (const entry of equippedIndicesRaw) {
            if (typeof entry === 'number') {
              equippedSetIdSet.add(entry)
            } else if (typeof entry === 'string') {
              equippedSetIndexSet.add(entry.trim().toLowerCase())
            }
          }
        } else if (
          !isItemBroken(item) &&
          ((item as any).bodyLoc !== undefined || (item as any).equippedSlot !== undefined
            ? Number((item as any).bodyLoc ?? (item as any).equippedSlot ?? 0) >= 1 &&
              Number((item as any).bodyLoc ?? (item as any).equippedSlot ?? 0) <= 10
            : (item as any).equipped === true)
        ) {
          equippedSetIdSet.add(setItemDef.id)
          equippedSetIndexSet.add(setItemDef.index.trim().toLowerCase())
        }

        setPieces = []
        setPieceColors = []
        let myPos = 0
        memberItems.forEach((member, idx) => {
          if (member.id === setItemDef.id || member.index.trim().toLowerCase() === setItemDef.index.trim().toLowerCase()) {
            myPos = idx
          }
          const mKey = member.index.trim()
          const mEn = resolveBaseItemNameEn(mKey) || mKey
          const mZh = translateItemName(mKey)
          const pieceLabel =
            locale === 'zh'
              ? mZh
              : locale === 'bilingual'
                ? `${mEn} (${mZh})`
                : mEn
          setPieces!.push(pieceLabel)
          const isWorn =
            equippedSetIdSet.has(member.id) ||
            equippedSetIndexSet.has(mKey.toLowerCase()) ||
            equippedSetIndexSet.has(mEn.toLowerCase())
          setPieceColors!.push(isWorn ? 'green' : 'red')
        })

        // Compute worn set mask & piece count
        let setMask = 0
        for (let i = 0; i < memberItems.length; i++) {
          if (setPieceColors[i] === 'green') {
            setMask |= 1 << i
          }
        }
        const explicitWornCount =
          typeof options?.wornSetPieceCount === 'number'
            ? Math.max(0, Math.trunc(options.wornSetPieceCount))
            : typeof (item as any).wornSetPieceCount === 'number'
              ? Math.max(0, Math.trunc((item as any).wornSetPieceCount))
              : undefined
        let maskCount = 0
        for (let m = setMask; m !== 0; m &= m - 1) maskCount++
        const wornCount = explicitWornCount !== undefined ? explicitWornCount : maskCount

        const activeBonusLines: FormattedStatLine[] = []

        // 1. Item-specific green set bonuses (aprop1a..aprop5b or explicit activeItemSetProps)
        if (Array.isArray((item as any).activeItemSetProps)) {
          activeItemProps.push(...(item as any).activeItemSetProps)
        } else if (wornCount >= 2 && Array.isArray(setItemDef.aprops) && setItemDef.aprops.length > 0) {
          for (const ap of setItemDef.aprops) {
            if (!ap.code || ap.code.trim().toLowerCase() === 'state') continue
            const listIdx = ap.threshold - 1 // 0..4
            let unlocked = false
            if (setItemDef.addFunc === 1) {
              const partnerPos = listIdx < myPos ? listIdx : listIdx + 1
              unlocked =
                equippedIndicesRaw !== undefined || setMask !== 0
                  ? (setMask & (1 << partnerPos)) !== 0
                  : explicitWornCount !== undefined && explicitWornCount >= ap.threshold + 1
            } else if (setItemDef.addFunc === 2) {
              unlocked = wornCount >= ap.threshold + 1
            }
            if (unlocked) {
              activeItemProps.push({
                code: ap.code,
                param: ap.par,
                min: ap.min,
                max: ap.max,
                value: ap.min,
              })
            }
          }
        }

        if (activeItemProps.length > 0) {
          const mergedItemGreen = aggregateAndSortProperties(
            activeItemProps.filter(p => {
              const c = (p.code || '').trim().toLowerCase()
              return c !== 'levelreq' && c !== 'state'
            }),
          )
          for (const prop of mergedItemGreen) {
            const text = appendRangeIfVariable(
              formatPropertyCode(prop.code, prop.value, prop.min, prop.max, prop.param, locale, propCharLevel),
              prop,
            )
            if (text) {
              activeBonusLines.push({ text, color: 'green' })
            }
          }
        }

        // 2. Partial and Full set gold bonuses (PCode2a..PCode5b and FCode1..FCode8)
        if (wornCount >= 2 && setRecord) {
          const goldSetProps: RolledItemProp[] = []
          const maxPartialThreshold = Math.min(wornCount, Math.max(0, memberItems.length - 1))
          for (const pc of setRecord.pCodes) {
            if (pc.threshold <= maxPartialThreshold && pc.code && pc.code.trim().toLowerCase() !== 'state') {
              goldSetProps.push({
                code: pc.code,
                param: pc.par,
                min: pc.min,
                max: pc.max,
                value: pc.min,
              })
            }
          }
          if (wornCount >= memberItems.length) {
            for (const fc of setRecord.fCodes) {
              if (fc.code && fc.code.trim().toLowerCase() !== 'state') {
                goldSetProps.push({
                  code: fc.code,
                  param: fc.par,
                  min: fc.min,
                  max: fc.max,
                  value: fc.min,
                })
              }
            }
          }
          if (goldSetProps.length > 0) {
            const mergedGold = aggregateAndSortProperties(
              goldSetProps.filter(p => {
                const c = (p.code || '').trim().toLowerCase()
                return c !== 'levelreq' && c !== 'state'
              }),
            )
            for (const prop of mergedGold) {
              const text = appendRangeIfVariable(
                formatPropertyCode(prop.code, prop.value, prop.min, prop.max, prop.param, locale, propCharLevel),
                prop,
              )
              if (text) {
                activeBonusLines.push({ text, color: 'gold' })
              }
            }
          }
        }

        if (activeBonusLines.length > 0) {
          setBonuses = activeBonusLines
        }
      }
    }
  }

  // Compute Enhanced Base Stats vs Original Base Stats per Issue #123 & #131
  let totalEdPct = 0
  let edMinPct = 0
  let edMaxPct = 0
  let extraMaxEdPct = 0
  let flatMinDmg = 0
  let flatMaxDmg = 0
  let totalAcPct = 0
  let flatAc = 0
  let totalEase = 0
  let durBonus = 0
  let durPct = 0
  let rolledSockets = 0
  let levelReqBonus = 0

  // Ground Truth (D2Common.dll ITEMS_GetRequiredLevel 0x6FD9A3F0 / Items.cpp:1401-1434):
  // - STAT_ITEM_SINGLESKILL (statId 107, code 'skill' / 'skill-rand'): max(nRequiredLevel, pSkillsTxtRecord->wReqLevel)
  // - STAT_ITEM_NONCLASSSKILL (statId 97, code 'oskill'): max(nRequiredLevel, wReqLevel if same class else wReqLevel + 6)
  // - STAT_ITEM_LEVELREQ (statId 92, code 'levelreq'): nRequiredLevel += value
  const applySkillPropReqLevel = (p: {
    readonly code?: string | undefined
    readonly param?: string | number | undefined
    readonly min?: number | undefined
  }) => {
    const c = (p.code || '').trim().toLowerCase()
    if (c === 'skill') {
      const sk = resolveSkillMeta(p.param)
      if (sk && sk.reqlevel > 1) {
        affixReqLevel = Math.max(affixReqLevel, sk.reqlevel)
      }
    } else if (c === 'skill-rand') {
      const sk = resolveSkillMeta(p.min)
      if (sk && sk.reqlevel > 1) {
        affixReqLevel = Math.max(affixReqLevel, sk.reqlevel)
      }
    } else if (c === 'oskill') {
      const sk = resolveSkillMeta(p.param)
      if (sk && sk.reqlevel > 0) {
        const oskillReq =
          rawPlayerClass && sk.classCode && rawPlayerClass === sk.classCode.toLowerCase()
            ? sk.reqlevel
            : sk.reqlevel + 6
        if (oskillReq > 1) {
          affixReqLevel = Math.max(affixReqLevel, oskillReq)
        }
      }
    }
  }

  for (const p of [...rawProps, ...activeItemProps]) {
    const c = (p.code || '').trim().toLowerCase()
    if (c === 'dmg%' || c === 'damagepercent') {
      totalEdPct += p.value
      edMinPct += p.value
      edMaxPct += p.value
    } else if (c === 'item_mindamage_percent' || c === 'dmg-min%') {
      edMinPct += p.value
      totalEdPct = edMinPct
    } else if (c === 'item_maxdamage_percent' || c === 'dmg-max%') {
      edMaxPct += p.value
      if (totalEdPct === 0) totalEdPct = edMaxPct
    } else if (c === 'dmg%/lvl' || c === 'item_maxdamage_percent_perlevel') {
      const rate = p.value !== 0 ? p.value : Number(p.param) || 0
      extraMaxEdPct += Math.floor((rate * propCharLevel) / 8)
    } else if (c === 'dmg-min' || c === 'mindamage' || c === 'secondary_mindamage' || c === 'item_throw_mindamage') {
      flatMinDmg += p.value
    } else if (c === 'dmg-max' || c === 'maxdamage' || c === 'secondary_maxdamage' || c === 'item_throw_maxdamage') {
      flatMaxDmg += p.value
    } else if (c === 'dmg/lvl' || c === 'item_maxdamage_perlevel') {
      const rate = p.value !== 0 ? p.value : Number(p.param) || 0
      flatMaxDmg += Math.floor((rate * propCharLevel) / 8)
    } else if (c === 'dmg-norm') {
      flatMinDmg += p.min > 0 ? p.min : p.value
      flatMaxDmg += p.max > 0 ? p.max : p.value
    } else if (c === 'dmg' || c === 'item_normaldamage') {
      flatMinDmg += p.value
      flatMaxDmg += p.value
    } else if (c === 'ac%' || c === 'item_armor_percent') {
      totalAcPct += p.value
    } else if (c === 'ac' || c === 'armorclass') {
      flatAc += p.value
    } else if (c === 'ac/lvl' || c === 'item_armor_perlevel') {
      const rate = p.value !== 0 ? p.value : Number(p.param) || 0
      flatAc += Math.floor((rate * propCharLevel) / 8)
    } else if (c === 'ac%/lvl' || c === 'item_armorpercent_perlevel') {
      const rate = p.value !== 0 ? p.value : Number(p.param) || 0
      totalAcPct += Math.floor((rate * propCharLevel) / 8)
    } else if (c === 'ease') totalEase += p.value
    else if (c === 'dur') durBonus += p.value
    else if (c === 'dur%') durPct += p.value
    else if (c === 'sock') rolledSockets += p.value
    else if (c === 'levelreq') levelReqBonus += p.value
    else if (c === 'skill' || c === 'skill-rand' || c === 'oskill') {
      applySkillPropReqLevel(p)
    }
  }

  if (Array.isArray((item as any).staffMods)) {
    for (const sm of (item as any).staffMods) {
      applySkillPropReqLevel(sm)
    }
  }

  const isEthereal = Boolean(
    item.flags?.ethereal ||
      (item as any).ethereal ||
      item.stats?.ethereal ||
      rawProps.some(p => (p.code || '').trim().toLowerCase() === 'ethereal'),
  )

  const explicitSockets = Number((item as any).sockets || item.totalSockets || rolledSockets || 0)

  if (isEthereal && !lines.some(l => l.text.includes('Ethereal') || l.text.includes('无形'))) {
    const ethText = locale === 'zh' || locale === 'bilingual' ? '无形 (无法修复)' : 'Ethereal (Cannot be Repaired)'
    lines.push({ text: ethText, color: 'blue', isMagic: true })
  }
  if (explicitSockets > 0 && !lines.some(l => l.text.includes('Socketed') || l.text.includes('凹槽'))) {
    const baseSockText = locale === 'zh' || locale === 'bilingual' ? `凹槽 (${explicitSockets})` : `Socketed (${explicitSockets})`
    const sockRange = (item as { socketRange?: { readonly min: number; readonly max: number } }).socketRange
    const sockSuffix =
      allowItemStatRange && sockRange && sockRange.min !== sockRange.max
        ? formatStatRangeSuffix('sock', sockRange.min, sockRange.max, locale)
        : ''
    lines.push({ text: `${baseSockText}${sockSuffix}`, color: 'blue', isMagic: true })
  }

  // 1. Defense (Enhanced / Low Quality / Ethereal vs Base)
  const explicitRolledBaseDef =
    typeof (item as any).rolledBaseDefense === 'number' && (item as any).rolledBaseDefense > 0
      ? Number((item as any).rolledBaseDefense)
      : 0
  const rawBaseDef = explicitRolledBaseDef > 0 ? explicitRolledBaseDef : (base.defense > 0 ? base.defense : 0)
  let defense: number | undefined = undefined
  let baseDefense: number | undefined = undefined
  if (rawBaseDef > 0) {
    let effectiveBaseDef = rawBaseDef
    if (explicitRolledBaseDef <= 0) {
      if (quality === 'low') {
        effectiveBaseDef = Math.max(1, Math.floor(effectiveBaseDef * 0.75))
      }
      if (isEthereal) {
        effectiveBaseDef = Math.floor(effectiveBaseDef * 1.5)
      }
    }
    let finalDef = Math.floor(effectiveBaseDef * (100 + totalAcPct) / 100) + flatAc
    if (totalAcPct > 0 && finalDef === effectiveBaseDef) {
      finalDef = effectiveBaseDef + 1
    }
    defense = finalDef
    if (finalDef !== rawBaseDef || totalAcPct !== 0 || flatAc !== 0 || quality === 'low' || isEthereal) {
      baseDefense = rawBaseDef
    }
  }

  // 2. One-Hand & Two-Hand Damage (Enhanced / Low Quality / Ethereal vs Base)
  const computeWeaponDamage = (baseMin: number, baseMax: number): WeaponDamageInfo => {
    let effMin = baseMin
    let effMax = baseMax
    const isLowQuality = quality === 'low'
    if (isLowQuality) {
      effMin = Math.max(1, Math.trunc((effMin * 75) / 100))
      effMax = Math.max(2, Math.trunc((effMax * 75) / 100))
      if (effMin >= effMax) {
        effMax = Math.max(2, effMin + 1)
      }
    }
    if (isEthereal) {
      effMin = Math.floor(effMin * 1.5)
      effMax = Math.floor(effMax * 1.5)
    }
    let finalMin = Math.floor(effMin * (100 + edMinPct) / 100) + flatMinDmg
    let finalMax = Math.floor(effMax * (100 + edMaxPct + extraMaxEdPct) / 100) + flatMaxDmg
    if (edMaxPct + extraMaxEdPct > 0 && finalMax === effMax) {
      finalMax = effMax + 1
    }
    if ((edMinPct !== 0 || edMaxPct !== 0 || extraMaxEdPct !== 0 || flatMinDmg !== 0 || flatMaxDmg !== 0) && finalMin >= finalMax) {
      finalMax = finalMin + 1
    }
    const isEnhanced =
      finalMin !== baseMin ||
      finalMax !== baseMax ||
      edMinPct !== 0 ||
      edMaxPct !== 0 ||
      extraMaxEdPct !== 0 ||
      flatMinDmg !== 0 ||
      flatMaxDmg !== 0 ||
      isLowQuality ||
      isEthereal
    return {
      min: isEnhanced ? finalMin : baseMin,
      max: isEnhanced ? finalMax : baseMax,
      baseMin,
      baseMax,
      ...(isEnhanced ? { isEnhanced: true } : {}),
      ...(isEthereal ? { isEthereal: true } : {}),
      ...(isLowQuality ? { isLowQuality: true } : {}),
      ...(totalEdPct !== 0 ? { edPct: totalEdPct } : {}),
      ...(extraMaxEdPct !== 0 ? { extraMaxEdPct } : {}),
      ...(flatMinDmg !== 0 ? { flatMin: flatMinDmg } : {}),
      ...(flatMaxDmg !== 0 ? { flatMax: flatMaxDmg } : {}),
    }
  }

  const origWeaponBase = (base as any)?.rawUnscaledBase ?? base
  const oneHandDamage =
    (origWeaponBase as any).mindam && (origWeaponBase as any).maxdam
      ? computeWeaponDamage((origWeaponBase as any).mindam, (origWeaponBase as any).maxdam)
      : (item as any).damage && typeof (item as any).damage === 'string' && (item as any).damage.includes('-')
        ? (() => {
            const parts = (item as any).damage.split('-').map((s: string) => parseInt(s.trim(), 10))
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
              return { min: parts[0], max: parts[1], isEnhanced: totalEdPct > 0 || extraMaxEdPct > 0 }
            }
            return undefined
          })()
        : undefined

  const twoHandDamage =
    (origWeaponBase as any).twoHandedMindam && (origWeaponBase as any).twoHandedMaxdam
      ? computeWeaponDamage((origWeaponBase as any).twoHandedMindam, (origWeaponBase as any).twoHandedMaxdam)
      : undefined

  const throwDamage =
    (origWeaponBase as any).minMisDam && (origWeaponBase as any).maxMisDam
      ? computeWeaponDamage((origWeaponBase as any).minMisDam, (origWeaponBase as any).maxMisDam)
      : undefined

  // 3. Requirements (Required Strength, Required Dexterity, Required Level)
  // D2Common #10244 (0x6fd76db0): delta = MulDiv(item_req_percent, reqstr|reqdex, 100) via 0x6fd511e0 (signed
  // imul/idiv, truncates toward zero), required = base + delta - (ethereal ? 10 : 0) (0x6fd76e7f..0x6fd76ec9).
  // item_req_percent keeps its sign (The Humongous: ease +20 raises requirements) (#1645).
  const reqWithEase = (base: number): number => base + Math.trunc((base * totalEase) / 100) - (isEthereal ? 10 : 0)
  const rawBaseReqStr = (base as any).reqstr > 0 ? (base as any).reqstr : 0
  let reqStr: number | undefined = undefined
  let baseReqStr: number | undefined = undefined
  if (rawBaseReqStr > 0) {
    const finalReqStr = Math.max(
      0,
      reqWithEase(rawBaseReqStr),
    )
    reqStr = finalReqStr
    if (finalReqStr !== rawBaseReqStr) {
      baseReqStr = rawBaseReqStr
    }
  }

  const rawBaseReqDex = (base as any).reqdex > 0 ? (base as any).reqdex : 0
  let reqDex: number | undefined = undefined
  let baseReqDex: number | undefined = undefined
  if (rawBaseReqDex > 0) {
    const finalReqDex = Math.max(
      0,
      reqWithEase(rawBaseReqDex),
    )
    reqDex = finalReqDex
    if (finalReqDex !== rawBaseReqDex) {
      baseReqDex = rawBaseReqDex
    }
  }

  const rawBaseReqLevel = (base as any).levelreq > 0 ? (base as any).levelreq : 0
  const finalReqLevel = Math.max(0, Math.max(rawBaseReqLevel, affixReqLevel) + levelReqBonus)
  const reqLevel = finalReqLevel > 1 ? finalReqLevel : undefined
  const baseReqLevel = rawBaseReqLevel > 0 && finalReqLevel !== rawBaseReqLevel ? rawBaseReqLevel : undefined

  // 4. Durability & automatic Indestructible line (D2Client.dll 0x6FB05E58..0x6FB05EF3)
  const rawBaseDur = (base as any).durability > 0 ? (base as any).durability : undefined
  const explicitMaxDur = item.maxDurability ?? (item.stats as any)?.maxdurability
  if (
    rawBaseDur !== undefined &&
    rawBaseDur > 0 &&
    !(base as any).nodurability &&
    explicitMaxDur === 0 &&
    !lines.some(l => l.text.includes('Indestructible') || l.text.includes('无法破坏') || l.text.includes('無法破壞'))
  ) {
    const indText = locale === 'zh' || locale === 'bilingual' ? '无法破坏' : 'Indestructible'
    lines.push({ text: indText, color: 'blue', isMagic: true })
  }
  let durability: FormattedItemTooltip['durability'] = undefined
  if (item.durability && item.maxDurability) {
    const finalMaxDur = Math.floor(item.maxDurability * (100 + durPct) / 100) + durBonus
    const finalCurDur = Math.floor(item.durability * (100 + durPct) / 100) + durBonus
    const isEnhanced = rawBaseDur !== undefined && (finalMaxDur !== rawBaseDur || quality === 'low')
    durability = isEnhanced
      ? { current: finalCurDur, max: finalMaxDur, baseMax: rawBaseDur, isEnhanced: true }
      : { current: finalCurDur, max: finalMaxDur }
  }

  const sockets = explicitSockets > 0 ? explicitSockets : (base as any).gemsockets > 0 ? (base as any).gemsockets : undefined

  const displayQuality =
    quality === 'runeword' || (quality === 'rune' && !socketable) ? (locale === 'zh' ? '符文之语' : 'Runeword') :
    quality === 'unique' ? (locale === 'zh' ? '暗金' : 'Unique') :
    quality === 'set' ? (locale === 'zh' ? '套装' : 'Set') :
    quality === 'craft' ? (locale === 'zh' ? '橙色' : 'Crafted') :
    quality === 'rare' ? (locale === 'zh' ? '亮金' : 'Rare') :
    quality === 'magic' ? (locale === 'zh' ? '魔法' : 'Magic') :
    quality === 'superior' ? (locale === 'zh' ? '超强' : 'Superior') :
    quality === 'low' ? (locale === 'zh' ? '劣质' : 'Low Quality') :
    isRune ? (locale === 'zh' ? '符文' : 'Rune') : (locale === 'zh' ? '普通' : 'Normal')

  return {
    title,
    subTitle,
    quality: displayQuality,
    qualityColor,
    baseType: base.kind === 'weapon' ? 'Weapon' : base.kind === 'armor' ? 'Armor' : 'Misc',
    ilvl,
    reqLevel,
    ...(baseReqLevel !== undefined ? { baseReqLevel } : {}),
    reqStr,
    ...(baseReqStr !== undefined ? { baseReqStr } : {}),
    reqDex,
    ...(baseReqDex !== undefined ? { baseReqDex } : {}),
    defense,
    ...(baseDefense !== undefined ? { baseDefense } : {}),
    oneHandDamage,
    twoHandDamage,
    ...(throwDamage !== undefined ? { throwDamage } : {}),
    durability,
    sockets,
    lines,
    ...(setName !== undefined ? { setName } : {}),
    ...(setPieces !== undefined ? { setPieces } : {}),
    ...(setPieceColors !== undefined ? { setPieceColors } : {}),
    ...(setBonuses !== undefined ? { setBonuses } : {}),
    ...(isJewel ? { isSocketable: true } : {}),
    ...(derivedRunewordRunes ? { runewordRunes: derivedRunewordRunes } : {}),
    ...((item as any).speedText ? { speedText: (item as any).speedText } : {}),
  }
}

