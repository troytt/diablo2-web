/**
 * Diablo II v1.13c Character Stats Sheet (`Panel\invchar6.dc6` frames 0..3).
 *
 * Anchored in the Left-Half 800x600 Dock (`800BorderFrame.dc6` frames 0..4 at x=0, y=0;
 * 320x432 panel at x=80, y=60).
 * Displays character identity, level, XP, Strength / Dexterity / Vitality / Energy with
 * interactive red `+` allocation buttons (`Panel\Level.dc6` native 30x30 cells, vertically
 * centered on each attribute text row: steady lit frame 0 while stat points are unspent,
 * pressed cell 1 while held down; hidden entirely with 0 points, unlike the always-socketed
 * control bar buttons; the allocation request fires on mouse-up inside the button —
 * dragging off cancels it), the always-visible Remaining Stat Points section (two runtime
 * sunken D2Win slots below Energy: label banner + white counter socket),
 * combat ratings, life/mana/stamina, and Fire / Cold / Lightning / Poison resistances.
 */

import type { D2FontRenderer, D2ColorCode } from './font.ts'
import { LevelPlusButton, LEVEL_BTN_CELL_SIZE } from './level-button.ts'
import { PanelCloseButton } from './close-button.ts'
import { getTblLang, requireTbl, type TblLang } from '../i18n/lang.ts'
import { CANONICAL_CHARSTATS, type CharacterClassCode } from '../../common/units/classes.ts'
import type { BaseStatKey, CharacterAttributes } from '../../common/units/unit-types.ts'
import { SKILLS_BY_ID } from '../../common/data/skills-catalog.ts'
import { getSkillName, getSkillTableMeta } from '../../common/skills/skills-meta.ts'
import type { CombatDamageFormulaBreakdown } from '../ui-model/combat-stats.ts'
import { reportMissingArt } from '../../client/scene/world-renderer.ts'

export type { BaseStatKey, CharacterAttributes }
export type DamageHandKey = 'left' | 'right'
export type CharSheetHoveredElement = 'leftAr' | 'rightAr' | 'defense' | 'close' | 'advStats'

/**
 * Skills that always hit or bypass Attack Rating in Diablo II v1.13c (`D2Client.dll 0x6FADE350` & `Skills.txt`):
 * - `#22` Guided Arrow, `#25` Lightning Bolt, `#35` Lightning Fury, `#97` Smite, `#154` War Cry.
 */
const AUTO_HIT_NO_AR_SKILL_IDS = new Set<number>([22, 25, 35, 97, 154])

/**
 * Physical / weapon / kick skills that roll Attack Rating (`ToHit`) in 1.13c `D2Client.dll 0x6FADE350`.
 */
const EXPLICIT_AR_ATTACK_SKILL_IDS = new Set<number>([
  0, 1, 2, 4, 5,
  6, 7, 9, 10, 11, 12, 14, 15, 16, 19, 20, 21, 24, 26, 27, 30, 31, 34,
  73,
  96, 106, 107, 111, 116,
  126, 133, 139, 140, 143, 144, 147, 151, 152,
  232, 233, 238, 239, 242, 248,
  254, 255, 257, 259, 260, 265, 266, 269, 270, 274, 275, 277, 280,
])

/**
 * Ground Truth (`D2Client.dll 0x6FADE350` & `0x6FB6D3C1..0x6FB6D3DF`):
 * Returns `true` only when `skillId` performs an Attack Rating (`ToHit`) check.
 * Pure spells (Teleport, Fire Ball, Blizzard, Nova, Hammers, Traps, Curses, Warcries, Summons)
 * and auto-hit attacks (Smite `#97`, Guided Arrow `#22`, Lightning Fury `#35`) return `false`.
 */
export function doesSkillUseAttackRating(skillId: number | null | undefined): boolean {
  const id = skillId ?? 0
  if (id < 0) return false
  if (AUTO_HIT_NO_AR_SKILL_IDS.has(id)) return false
  if (EXPLICIT_AR_ATTACK_SKILL_IDS.has(id)) return true
  const meta = getSkillTableMeta(id)
  if (meta && (meta.passive === 1 || meta.aura === 1)) return false
  const def = SKILLS_BY_ID[id] as any
  if (!def) return false
  if (
    (typeof def.toHit === 'number' && def.toHit > 0) ||
    (typeof def.toHitLev === 'number' && def.toHitLev > 0) ||
    Boolean(def.toHitCalc)
  ) {
    return true
  }
  if (typeof def.srcDamage === 'number' && def.srcDamage > 0 && Boolean(meta?.itypea1)) return true
  return false
}

/**
 * Ground Truth (`D2Common.dll #10428` / `D2Client.dll 0x6FB6C760` & `0x6FB6C8F0`):
 * Computes hit chance percentage clamped to `[5, 95]`:
 * `clamp(5, 95, floor(200 * ar * alvl / ((ar + def) * (alvl + dlvl))))`.
 */
export function computeCharSheetHitChancePct(
  attackerAr: number,
  defenderDef: number,
  attackerLvl: number,
  defenderLvl: number,
): number {
  const alvl = Math.max(1, Math.trunc(attackerLvl || 1))
  const dlvl = Math.max(1, Math.trunc(defenderLvl || alvl))
  const ar = Math.max(0, Math.trunc(attackerAr || 0))
  const def = Math.max(0, Math.trunc(defenderDef || 0))
  const denom = ar + def
  const raw =
    denom <= 0
      ? Math.floor((200 * alvl) / (alvl + dlvl))
      : Math.floor((200 * ar * alvl) / (denom * (alvl + dlvl)))
  return Math.max(5, Math.min(95, raw))
}

/**
 * Ground Truth (`D2Common.dll #10918` `UNITS_GetBlockRate` @ `0x6FD87BE0` & `D2Client.dll 0x6FB6C430` `#263` Weapon Block):
 * Computes total character block percentage clamped to `[0, 75]`.
 */
export function computeCharacterBlockChancePct(attrs: CharacterSheetAttributes): number {
  if (typeof attrs.blockChance === 'number' && Number.isFinite(attrs.blockChance)) {
    return Math.max(0, Math.min(75, Math.trunc(attrs.blockChance)))
  }
  if (typeof attrs.shieldBaseBlock === 'number' && attrs.shieldBaseBlock > 0) {
    const clvl = Math.max(1, Math.trunc(attrs.level || 1))
    const dex = Math.max(0, Math.trunc(attrs.dex || 0))
    const extra = Math.trunc(attrs.extraBlockPct || 0)
    const scaled = Math.floor((attrs.shieldBaseBlock * Math.max(0, dex - 15)) / (clvl * 2)) + extra
    return Math.max(0, Math.min(75, scaled))
  }
  if (typeof attrs.weaponBlockChance === 'number' && attrs.weaponBlockChance > 0) {
    return Math.max(0, Math.min(75, Math.trunc(attrs.weaponBlockChance)))
  }
  return 0
}

export interface CharacterSheetAttributes extends CharacterAttributes {
  baseStr?: number | undefined
  baseDex?: number | undefined
  baseVit?: number | undefined
  baseEne?: number | undefined
  baseDefense?: number | undefined
  defenseColor?: D2ColorCode | undefined
  baseAttackRating?: number | undefined
  leftAttackRating?: number | undefined
  rightAttackRating?: number | undefined
  baseRightAttackRating?: number | undefined
  leftSkillId?: number | undefined
  rightSkillId?: number | undefined
  blockChance?: number | undefined
  shieldBaseBlock?: number | undefined
  extraBlockPct?: number | undefined
  weaponBlockChance?: number | undefined
  lastMonsterName?: string | undefined
  lastMonsterLevel?: number | undefined
  lastMonsterAttackRating?: number | undefined
  lastMonsterDefense?: number | undefined
  leftAR?: number | undefined
  leftARColor?: D2ColorCode | undefined
  rightAR?: number | undefined
  rightARColor?: D2ColorCode | undefined
  leftSkillName?: string | undefined
  rightSkillName?: string | undefined
  leftSkillDmg?: string | undefined
  rightSkillDmg?: string | undefined
  leftSkillDmgColor?: D2ColorCode | undefined
  rightSkillDmgColor?: D2ColorCode | undefined
  leftDamageFormula?: CombatDamageFormulaBreakdown | undefined
  rightDamageFormula?: CombatDamageFormulaBreakdown | undefined
  maxHp?: number | undefined
  maxHpColor?: D2ColorCode | undefined
  maxMana?: number | undefined
  maxManaColor?: D2ColorCode | undefined
  maxStamina?: number | undefined
  maxStaminaColor?: D2ColorCode | undefined
  strColor?: D2ColorCode | undefined
  dexColor?: D2ColorCode | undefined
  vitColor?: D2ColorCode | undefined
  eneColor?: D2ColorCode | undefined
  maxFireRes?: number | undefined
  maxColdRes?: number | undefined
  maxLightRes?: number | undefined
  maxPoisonRes?: number | undefined
  baseFireRes?: number | undefined
  baseColdRes?: number | undefined
  baseLightRes?: number | undefined
  basePoisonRes?: number | undefined
  fireResColor?: D2ColorCode | undefined
  coldResColor?: D2ColorCode | undefined
  lightResColor?: D2ColorCode | undefined
  poisResColor?: D2ColorCode | undefined
  weaponStrBonus?: number | undefined
  weaponDexBonus?: number | undefined
  weaponPhysBaseMin?: number | undefined
  weaponPhysBaseMax?: number | undefined
  weaponIsRanged?: boolean | undefined
  arPctBonus?: number | undefined
  [key: string]: any
}

/**
 * Resolves canonical D2 1.13c resistance value color (`D2Client.dll`):
 * - `displayed >= maxCap` -> `'gold'`
 * - `displayed < 0` or (`baseDisplayed !== undefined && displayed < baseDisplayed`) -> `'red'`
 * - `baseDisplayed !== undefined && displayed > baseDisplayed` -> `'blue'`
 * - otherwise -> `'white'`
 */
export function resolveResistanceValueColor(
  displayed: number,
  maxCap: number = 75,
  baseDisplayed?: number,
): D2ColorCode {
  if (displayed >= maxCap) return 'gold'
  if (displayed < 0) return 'red'
  if (baseDisplayed !== undefined) {
    if (displayed < baseDisplayed) return 'red'
    if (displayed > baseDisplayed) return 'blue'
  }
  return 'white'
}

export interface FormattedStatBasePlusBonus {
  readonly text: string
  readonly font: 'font8' | 'font6'
  readonly color: D2ColorCode
}

/**
 * Formats a character primary attribute as `base+bonus` (`x+y`, or `x-y` when reduced by curses/debuffs).
 */
export function formatStatBasePlusBonus(total: number, base: number): FormattedStatBasePlusBonus {
  const safeTotal = Math.round(total)
  const safeBase = Math.round(base)
  const bonus = safeTotal - safeBase
  let text: string
  let color: D2ColorCode
  if (bonus > 0) {
    text = `${safeBase}+${bonus}`
    color = 'blue'
  } else if (bonus < 0) {
    text = `${safeBase}-${Math.abs(bonus)}`
    color = 'red'
  } else {
    text = `${safeBase}+0`
    color = 'white'
  }
  const font: 'font8' | 'font6' = text.length >= 6 ? 'font6' : 'font8'
  return { text, font, color }
}

export interface StatGainTooltipLine {
  readonly text: string
  readonly color: D2ColorCode
  readonly font: 'fontexocet10' | 'font8' | 'font6'
  readonly align?: 'left' | 'center' | 'right' | undefined
}

export function formatStatGainNumber(val: number): string {
  return Number(val.toFixed(2)).toString()
}

/**
 * Computes the 1-point attribute gain tooltip lines for a primary attribute (`str`, `dex`, `vit`, `ene`)
 * per Diablo II v1.13c (`CharStats.txt`, `Weapons.txt`, `D2Common.dll` `UNITS_GetAttackRate` / `UNITS_GetDefense`,
 * and `D2Game.dll` `SUNITDMG_ApplyDamageBonuses`).
 */
export function formatStatGainTooltipLines(
  statKey: BaseStatKey,
  classCode: CharacterClassCode | null,
  attrs: CharacterSheetAttributes,
  lang: TblLang = 'CHI',
): StatGainTooltipLine[] {
  if (classCode === null) return []
  const classStats = CANONICAL_CHARSTATS[classCode]
  const isEn = lang === 'ENG'
  const tblKeyByStat: Readonly<Record<BaseStatKey, string>> = {
    str: 'strchrstr',
    dex: 'strchrdex',
    vit: 'strchrvit',
    ene: 'strchreng',
  }
  const lines: StatGainTooltipLine[] = [
    {
      text: requireTbl(tblKeyByStat[statKey], lang),
      color: 'gold',
      font: 'fontexocet10',
      align: 'center',
    },
    {
      text: isEn ? 'Per +1 Attribute Point' : '每 1 点属性增益',
      color: 'tan',
      font: 'font8',
      align: 'center',
    },
  ]

  switch (statKey) {
    case 'vit': {
      const lifeGain = formatStatGainNumber(classStats.perStatPoint.lifePerVitality)
      const stamGain = formatStatGainNumber(classStats.perStatPoint.staminaPerVitality)
      lines.push({
        text: isEn ? `+${lifeGain} Life` : `+${lifeGain} 生命`,
        color: 'blue',
        font: 'font8',
        align: 'center',
      })
      lines.push({
        text: isEn ? `+${stamGain} Stamina` : `+${stamGain} 耐力`,
        color: 'blue',
        font: 'font8',
        align: 'center',
      })
      break
    }
    case 'ene': {
      const manaGain = formatStatGainNumber(classStats.perStatPoint.manaPerEnergy)
      lines.push({
        text: isEn ? `+${manaGain} Mana` : `+${manaGain} 法力`,
        color: 'blue',
        font: 'font8',
        align: 'center',
      })
      break
    }
    case 'str': {
      const strBonus = attrs.weaponStrBonus ?? 100
      const baseMin = attrs.weaponPhysBaseMin ?? 1
      const baseMax = attrs.weaponPhysBaseMax ?? 2
      const isRanged = attrs.weaponIsRanged === true
      if (strBonus > 0) {
        const pct = formatStatGainNumber(strBonus / 100)
        const minGain = formatStatGainNumber((baseMin * strBonus) / 10000)
        const maxGain = formatStatGainNumber((baseMax * strBonus) / 10000)
        const rangeStr = minGain === maxGain ? minGain : `${minGain}-${maxGain}`
        const dmgLabel = isEn
          ? isRanged
            ? 'Ranged Damage'
            : 'Melee Damage'
          : isRanged
            ? '远程伤害'
            : '近战伤害'
        lines.push({
          text: `+${rangeStr} ${dmgLabel} (+${pct}%)`,
          color: 'blue',
          font: 'font8',
          align: 'center',
        })
      } else {
        lines.push({
          text: isEn ? '+0 Current Ranged Weapon Damage' : '+0 当前远程武器伤害',
          color: 'white',
          font: 'font8',
          align: 'center',
        })
        lines.push({
          text: isEn ? '(Unarmed/Melee: +1% Melee Damage)' : '(空手/常规近战: +1% 近战伤害)',
          color: 'blue',
          font: 'font8',
          align: 'center',
        })
      }
      break
    }
    case 'dex': {
      const arPct = attrs.arPctBonus ?? 0
      if (arPct !== 0) {
        const effAr = formatStatGainNumber(5 * (1 + arPct / 100))
        lines.push({
          text: isEn ? `+${effAr} Attack Rating (+5 Base)` : `+${effAr} 攻击准确率 (基础 +5)`,
          color: 'blue',
          font: 'font8',
          align: 'center',
        })
      } else {
        lines.push({
          text: isEn ? '+5 Attack Rating' : '+5 攻击准确率',
          color: 'blue',
          font: 'font8',
          align: 'center',
        })
      }
      lines.push({
        text: isEn ? '+0.25 Base Defense (+1 per 4 pts)' : '+0.25 基础防御力 (每 4 点 +1)',
        color: 'blue',
        font: 'font8',
        align: 'center',
      })
      const dexBonus = attrs.weaponDexBonus ?? 0
      if (dexBonus > 0) {
        const pct = formatStatGainNumber(dexBonus / 100)
        const baseMin = attrs.weaponPhysBaseMin ?? 1
        const baseMax = attrs.weaponPhysBaseMax ?? 2
        const minGain = formatStatGainNumber((baseMin * dexBonus) / 10000)
        const maxGain = formatStatGainNumber((baseMax * dexBonus) / 10000)
        const rangeStr = minGain === maxGain ? minGain : `${minGain}-${maxGain}`
        const dmgLabel = isEn
          ? attrs.weaponIsRanged
            ? 'Ranged Damage'
            : 'Melee Damage'
          : attrs.weaponIsRanged
            ? '远程伤害'
            : '近战伤害'
        lines.push({
          text: `+${rangeStr} ${dmgLabel} (+${pct}%)`,
          color: 'blue',
          font: 'font8',
          align: 'center',
        })
      }
      break
    }
  }

  return lines
}

export const CHAR_PANEL_ORIGIN = { x: 80, y: 60, width: 320, height: 432 } as const
export const CHAR_CLOSE_BTN_BOUNDS = { x: 80 + 128, y: 60 + 388, w: 32, h: 32 } as const
export const CHAR_ADV_STATS_BTN_BOUNDS = { x: 80 + 92, y: 60 + 388, w: 32, h: 32 } as const
export const CHAR_ADV_STATS_PANEL_BOUNDS = { x: 80 + 6, y: 60 + 6, w: 308, h: 376 } as const

export interface IasBreakpointEntry {
  readonly ias: number
  readonly frames: string
}

export interface IasBreakpointResult {
  readonly isAttack: boolean
  readonly entries: readonly IasBreakpointEntry[]
  readonly activeIndex: number
}

/**
 * Computes 1.13c FCR (Faster Cast Rate) breakpoints for the character class, shapeshift/vampire form,
 * and right-click skill (`AnimData.d2` & `BH.dll` `0x10116c20`).
 */
export function computeFcrBreakpoints(
  classCode: CharacterClassCode | null,
  attrs: CharacterSheetAttributes,
): readonly number[] {
  if (attrs.vampireState) return [6, 11, 18, 24, 35, 48, 65, 86, 120, 180]
  if (attrs.werebearState) return [7, 15, 26, 40, 63, 99, 163]
  if (attrs.werewolfState) return [6, 14, 26, 40, 60, 95, 157]
  const rSkill = attrs.rightSkillId ?? 0
  if (classCode === 'sor' && (rSkill === 41 || rSkill === 43 || rSkill === 49 || rSkill === 53)) {
    return [7, 15, 23, 35, 52, 78, 117, 194]
  }
  switch (classCode) {
    case 'ama':
      return [7, 14, 22, 32, 48, 68, 99, 152]
    case 'sor':
    case 'bar':
      return [9, 20, 37, 63, 105, 200]
    case 'nec':
    case 'pal':
      return [9, 18, 30, 48, 75, 125]
    case 'dru':
      return [4, 10, 19, 30, 46, 68, 99, 163]
    case 'ass':
      return [8, 16, 27, 42, 65, 102, 174]
    default:
      return [9, 18, 30, 48, 75, 125]
  }
}

/**
 * Computes 1.13c FHR (Faster Hit Recovery) breakpoints for the character class, shapeshift/vampire form,
 * and equipped weapon type (`AnimData.d2` & `BH.dll` `0x10116d60`).
 */
export function computeFhrBreakpoints(
  classCode: CharacterClassCode | null,
  attrs: CharacterSheetAttributes,
): readonly number[] {
  if (attrs.vampireState) return [2, 6, 10, 16, 24, 34, 48, 72, 117]
  if (attrs.werebearState) return [5, 10, 16, 24, 37, 54, 86, 152, 360]
  if (attrs.werewolfState) return [9, 20, 42, 86, 280]
  switch (classCode) {
    case 'ama':
      return [6, 13, 20, 32, 52, 86, 174, 600]
    case 'sor':
      return [5, 9, 14, 20, 30, 42, 60, 86, 142, 280]
    case 'nec':
      return [5, 10, 16, 26, 39, 56, 86, 152, 377]
    case 'pal':
      return attrs.isSpearOrStaff ? [3, 7, 13, 20, 32, 48, 75, 129, 280] : [7, 15, 27, 48, 86, 200]
    case 'bar':
    case 'ass':
      return [7, 15, 27, 48, 86, 200]
    case 'dru':
      return attrs.isOneHandSwinging
        ? [3, 7, 13, 19, 29, 42, 63, 99, 174, 456]
        : [5, 10, 16, 26, 39, 56, 86, 152, 377]
    default:
      return [7, 15, 27, 48, 86, 200]
  }
}

const TRAP_SKILL_IDS = new Set<number>([251, 256, 261, 262, 271, 272, 276])
const ROLLBACK_MULTI_HIT_SKILLS = new Set<number>([26, 30, 106, 248, 255])

function isIasGovernedSkill(skillId: number): boolean {
  if (skillId === 0 || skillId === 1 || skillId === 2 || skillId === 4) return true
  if (skillId === 22 || skillId === 25 || skillId === 35 || skillId === 97) return true
  if (TRAP_SKILL_IDS.has(skillId)) return true
  if (doesSkillUseAttackRating(skillId)) return true
  return false
}

function resolveBaseAttackAnimFrames(
  classCode: CharacterClassCode | null,
  wclass: string,
  skillId: number,
): { actionFrame: number; totalFrames: number; isRollback: boolean } {
  const wc = (wclass || '1hs').toLowerCase()
  const isRollback = ROLLBACK_MULTI_HIT_SKILLS.has(skillId)
  if (TRAP_SKILL_IDS.has(skillId)) {
    return { actionFrame: 7, totalFrames: 16, isRollback: false }
  }
  switch (classCode) {
    case 'pal':
      if (wc === '2hs') return { actionFrame: 8, totalFrames: 18, isRollback }
      if (wc === '2ht' || wc === 'stf') return { actionFrame: 9, totalFrames: 19, isRollback }
      if (wc === 'bow' || wc === 'xbw') return { actionFrame: 8, totalFrames: 16, isRollback }
      return { actionFrame: 7, totalFrames: 15, isRollback }
    case 'ama':
      if (wc === 'bow') return { actionFrame: 6, totalFrames: 14, isRollback }
      if (wc === 'xbw') return { actionFrame: 9, totalFrames: 20, isRollback }
      if (wc === '1ht' || wc === '2ht') return { actionFrame: 8, totalFrames: 16, isRollback }
      return { actionFrame: 7, totalFrames: 16, isRollback }
    case 'bar':
      if (wc === '2hs' || wc === '2ht' || wc === 'stf') return { actionFrame: 8, totalFrames: 18, isRollback }
      return { actionFrame: 7, totalFrames: 16, isRollback }
    case 'dru':
      if (wc === '2hs' || wc === '2ht' || wc === 'stf') return { actionFrame: 8, totalFrames: 17, isRollback }
      return { actionFrame: 9, totalFrames: 19, isRollback }
    case 'ass':
      if (wc === 'ht1' || wc === 'ht2' || wc === 'h2h' || wc === 'h2h2') {
        return { actionFrame: 6, totalFrames: 12, isRollback }
      }
      return { actionFrame: 7, totalFrames: 15, isRollback }
    case 'nec':
    case 'sor':
      if (wc === '2hs' || wc === '2ht' || wc === 'stf') return { actionFrame: 9, totalFrames: 18, isRollback }
      return { actionFrame: 9, totalFrames: 19, isRollback }
    default:
      return { actionFrame: 7, totalFrames: 15, isRollback }
  }
}

/**
 * Computes 1.13c IAS (Increased Attack Speed) breakpoints and frame counts relative to the right-click skill
 * (`AnimData.d2` & `BH.dll` `0x10116eb0`).
 */
export function computeIasBreakpoints(
  classCode: CharacterClassCode | null,
  attrs: CharacterSheetAttributes,
): IasBreakpointResult {
  const rightSkillId = attrs.rightSkillId ?? 0
  if (!isIasGovernedSkill(rightSkillId)) {
    return { isAttack: false, entries: [], activeIndex: -1 }
  }
  const wsm = attrs.weaponWsm ?? 0
  const skillEias = attrs.skillEias ?? 0
  const { actionFrame, totalFrames, isRollback } = resolveBaseAttackAnimFrames(
    classCode,
    attrs.weaponClass ?? '1hs',
    rightSkillId,
  )

  const entries: IasBreakpointEntry[] = []
  let prevFrames = ''
  for (let ias = 0; ias <= 250; ias++) {
    const itemEias = Math.trunc((120 * ias) / (120 + ias))
    const eias = Math.max(-75, Math.min(75, itemEias + skillEias - wsm))
    const step = Math.max(1, Math.trunc((256 * (100 + eias)) / 100))
    let frames: string
    if (isRollback) {
      const f2 = Math.ceil((256 * actionFrame) / step)
      const f1 = f2 + 1
      const f3 = Math.max(f2, Math.ceil((256 * totalFrames) / step) - 2)
      frames = `${f1}|${f2}|${f3}`
    } else {
      const fTot = Math.max(4, Math.ceil((256 * totalFrames) / step) - 1)
      frames = `${fTot}`
    }
    if (frames !== prevFrames) {
      entries.push({ ias, frames })
      prevFrames = frames
    }
  }

  const curIas = Math.max(0, Math.trunc(attrs.ias ?? 0))
  let activeIndex = 0
  for (let i = 0; i < entries.length; i++) {
    if (entries[i]!.ias <= curIas) activeIndex = i
  }
  return { isAttack: true, entries, activeIndex }
}

/**
 * Stat allocation `+` button cells: the same native 30x30 `Panel\Level.dc6` cells as the
 * control-bar buttons, vertically centered on the attribute text row — the `font8` label
 * baseline sits at y = 94/156/242/304 (panel space) with its visible ink center ~4px above
 * the baseline, so the 30px cell top lands at baseline - 19.
 */
export const STAT_ALLOC_BUTTONS: Readonly<Record<BaseStatKey, { x: number; y: number; w: number; h: number }>> = {
  str: { x: 80 + 122, y: 60 + 75, w: 30, h: 30 },
  dex: { x: 80 + 122, y: 60 + 137, w: 30, h: 30 },
  vit: { x: 80 + 122, y: 60 + 223, w: 30, h: 30 },
  ene: { x: 80 + 122, y: 60 + 285, w: 30, h: 30 },
}

export const STAT_ROW_BOUNDS: Readonly<Record<BaseStatKey, { x: number; y: number; w: number; h: number }>> = {
  str: { x: 80 + 12, y: 60 + 78, w: 140, h: 30 },
  dex: { x: 80 + 12, y: 60 + 140, w: 140, h: 30 },
  vit: { x: 80 + 12, y: 60 + 226, w: 140, h: 30 },
  ene: { x: 80 + 12, y: 60 + 288, w: 140, h: 30 },
}

export const DAMAGE_ROW_BOUNDS: Readonly<Record<DamageHandKey, { x: number; y: number; w: number; h: number }>> = {
  left: { x: 80 + 160, y: 60 + 76, w: 152, h: 24 },
  right: { x: 80 + 160, y: 60 + 101, w: 152, h: 25 },
}

function fmtSignedPct(v: number): string {
  return v >= 0 ? `+${v}%` : `${v}%`
}

/**
 * Formats the 1.13c character-sheet damage formula breakdown tooltip lines for the left or right skill hand.
 * Uses `~` for all damage ranges (`308~424`, `1755~2416`).
 */
export function formatCharacterDamageTooltipLines(
  hand: DamageHandKey,
  attrs: CharacterSheetAttributes,
  lang: TblLang = getTblLang(),
): StatGainTooltipLine[] {
  const isEn = (lang as string) === 'en' || lang === 'ENG'
  const defaultAtkName = getSkillName(0, lang)
  const dmgLabel = isEn ? 'Damage' : '伤害'

  let formula: CombatDamageFormulaBreakdown | undefined =
    hand === 'left' ? attrs.leftDamageFormula : attrs.rightDamageFormula

  const rawSkillName = hand === 'left' ? attrs.leftSkillName : attrs.rightSkillName
  const skillLabel =
    formula?.skillId !== undefined && (!rawSkillName || (isEn && /[^\x00-\x7f]/.test(rawSkillName)))
      ? getSkillName(formula.skillId, lang)
      : rawSkillName || defaultAtkName

  if (!formula) {
    const rawDmgStr = (hand === 'left' ? attrs.leftSkillDmg : attrs.rightSkillDmg) || '1-2'
    if (rawDmgStr === '--') return []
    const m = /(\d+)\s*[-~]\s*(\d+)/.exec(rawDmgStr)
    const weaponMin = attrs.weaponPhysBaseMin ?? 1
    const weaponMax = attrs.weaponPhysBaseMax ?? 2
    const strBonus = attrs.weaponStrBonus ?? 100
    const dexBonus = attrs.weaponDexBonus ?? 0
    const strEdPct = strBonus !== 0 ? Math.trunc((strBonus * (attrs.str || 0)) / 100) : 0
    const dexEdPct = dexBonus !== 0 ? Math.trunc((dexBonus * (attrs.dex || 0)) / 100) : 0
    const totalEd = strEdPct + dexEdPct
    const finalMin = m ? Number(m[1]) : Math.max(1, Math.floor((weaponMin * (100 + totalEd)) / 100))
    const finalMax = m ? Number(m[2]) : Math.max(finalMin + 1, Math.floor((weaponMax * (100 + totalEd)) / 100))
    formula = {
      kind: 'weapon',
      weaponMin,
      weaponMax,
      offWeaponFlatMin: 0,
      offWeaponFlatMax: 0,
      physBaseMin: weaponMin,
      physBaseMax: weaponMax,
      strEdPct,
      dexEdPct,
      masteryEdPct: 0,
      skillEdPct: 0,
      gearEdPct: 0,
      auraEdPct: 0,
      totalMinEdPct: totalEd,
      totalMaxEdPct: totalEd,
      skillPhysMin: 0,
      skillPhysMax: 0,
      srcDam: 128,
      magicConversionPct: 0,
      physMin: finalMin,
      physMax: finalMax,
      fireMin: 0,
      fireMax: 0,
      coldMin: 0,
      coldMax: 0,
      lightMin: 0,
      lightMax: 0,
      magicMin: 0,
      magicMax: 0,
      poisonMin: 0,
      poisonMax: 0,
      finalMin,
      finalMax,
    }
  }

  if (formula.kind === 'none') return []

  const lines: StatGainTooltipLine[] = [
    {
      text: `${skillLabel} ${dmgLabel}`,
      color: 'gold',
      font: 'font8',
      align: 'center',
    },
  ]

  if (formula.kind === 'spell') {
    const sb = formula.spellBreakdown ?? {
      spellType: 'magic',
      baseMin: formula.physBaseMin,
      baseMax: formula.physBaseMax,
      synergyBonusPct: formula.skillEdPct,
      withSynergyMin: formula.physBaseMin,
      withSynergyMax: formula.physBaseMax,
      masteryBonusPct: formula.masteryEdPct,
      equipSpellDamagePct: formula.gearEdPct,
      auraBonusPct: formula.auraEdPct,
      finalMin: formula.finalMin,
      finalMax: formula.finalMax,
    }

    lines.push({
      text: isEn
        ? `Skill Base Damage: ${sb.baseMin}~${sb.baseMax}`
        : `技能基础伤害: ${sb.baseMin}~${sb.baseMax}`,
      color: 'white',
      font: 'font8',
      align: 'center',
    })

    if (sb.synergyBonusPct > 0) {
      lines.push({
        text: isEn
          ? `Synergy Bonus: +${sb.synergyBonusPct}% (→ ${sb.withSynergyMin}~${sb.withSynergyMax})`
          : `技能协同增伤: +${sb.synergyBonusPct}% (→ ${sb.withSynergyMin}~${sb.withSynergyMax})`,
        color: 'blue',
        font: 'font8',
        align: 'center',
      })
    }

    const totalSpellPct = sb.masteryBonusPct + sb.equipSpellDamagePct + sb.auraBonusPct
    const spellParts: string[] = [
      isEn ? `Mastery +${sb.masteryBonusPct}%` : `法术精通 +${sb.masteryBonusPct}%`,
      isEn ? `Equip +${sb.equipSpellDamagePct}%` : `装备法伤 +${sb.equipSpellDamagePct}%`,
    ]
    if (sb.auraBonusPct > 0) {
      spellParts.push(isEn ? `Aura +${sb.auraBonusPct}%` : `光环 +${sb.auraBonusPct}%`)
    }
    lines.push({
      text: isEn
        ? `Spell Bonus (+${totalSpellPct}%): ${spellParts.join(' + ')}`
        : `法术增伤 (+${totalSpellPct}%): ${spellParts.join(' + ')}`,
      color: 'blue',
      font: 'font8',
      align: 'center',
    })

    let spellExpr: string
    const masteryAndEquipPct = sb.masteryBonusPct + sb.equipSpellDamagePct
    if (sb.synergyBonusPct > 0 && totalSpellPct > 0) {
      if (sb.auraBonusPct > 0 && masteryAndEquipPct > 0) {
        spellExpr = `⌊⌊${sb.baseMin}~${sb.baseMax} × (1+${sb.synergyBonusPct}%)⌋ × (1+${masteryAndEquipPct}%)⌋ × (1+${sb.auraBonusPct}%)`
      } else {
        spellExpr = `⌊${sb.baseMin}~${sb.baseMax} × (1+${sb.synergyBonusPct}%)⌋ × (1+${totalSpellPct}%)`
      }
    } else if (sb.synergyBonusPct > 0) {
      spellExpr = `${sb.baseMin}~${sb.baseMax} × (1+${sb.synergyBonusPct}%)`
    } else if (totalSpellPct > 0) {
      spellExpr = `${sb.baseMin}~${sb.baseMax} × (1+${totalSpellPct}%)`
    } else {
      spellExpr = `${sb.baseMin}~${sb.baseMax} × (1+0%)`
    }

    lines.push({
      text: isEn
        ? `Formula: ${spellExpr} = ${sb.finalMin}~${sb.finalMax}`
        : `公式: ${spellExpr} = ${sb.finalMin}~${sb.finalMax}`,
      color: 'gold',
      font: 'font8',
      align: 'center',
    })
    return lines
  }

  const hasFlat = formula.offWeaponFlatMin !== 0 || formula.offWeaponFlatMax !== 0
  if (hasFlat) {
    const flatSignMin = formula.offWeaponFlatMin >= 0 ? `+${formula.offWeaponFlatMin}` : `${formula.offWeaponFlatMin}`
    lines.push({
      text: isEn
        ? `Weapon Base: ${formula.weaponMin}~${formula.weaponMax} | Off-Weapon Flat: ${flatSignMin}~${formula.offWeaponFlatMax} (Phys Base ${formula.physBaseMin}~${formula.physBaseMax})`
        : `武器伤害基底: ${formula.weaponMin}~${formula.weaponMax} | 装备点伤: ${flatSignMin}~${formula.offWeaponFlatMax} (物理基底 ${formula.physBaseMin}~${formula.physBaseMax})`,
      color: 'white',
      font: 'font8',
      align: 'center',
    })
  } else {
    lines.push({
      text: isEn
        ? `Weapon Base: ${formula.weaponMin}~${formula.weaponMax}`
        : `武器伤害基底: ${formula.weaponMin}~${formula.weaponMax}`,
      color: 'white',
      font: 'font8',
      align: 'center',
    })
  }

  const edParts: string[] = []
  if (formula.strEdPct !== 0) edParts.push(isEn ? `Str ${fmtSignedPct(formula.strEdPct)}` : `力量 ${fmtSignedPct(formula.strEdPct)}`)
  if (formula.dexEdPct !== 0) edParts.push(isEn ? `Dex ${fmtSignedPct(formula.dexEdPct)}` : `敏捷 ${fmtSignedPct(formula.dexEdPct)}`)
  if (formula.masteryEdPct !== 0) edParts.push(isEn ? `Mastery ${fmtSignedPct(formula.masteryEdPct)}` : `支配 ${fmtSignedPct(formula.masteryEdPct)}`)
  if (formula.skillEdPct !== 0) edParts.push(isEn ? `Skill ${fmtSignedPct(formula.skillEdPct)}` : `技能 ${fmtSignedPct(formula.skillEdPct)}`)
  if (formula.gearEdPct !== 0) edParts.push(isEn ? `Gear ${fmtSignedPct(formula.gearEdPct)}` : `防具 ${fmtSignedPct(formula.gearEdPct)}`)
  if (formula.auraEdPct !== 0) edParts.push(isEn ? `Aura ${fmtSignedPct(formula.auraEdPct)}` : `光环 ${fmtSignedPct(formula.auraEdPct)}`)

  const totalEdLabel =
    formula.totalMinEdPct === formula.totalMaxEdPct
      ? fmtSignedPct(formula.totalMaxEdPct)
      : `${fmtSignedPct(formula.totalMinEdPct)}~${fmtSignedPct(formula.totalMaxEdPct)}`
  const edDetail = edParts.length > 0 ? edParts.join(' + ') : '+0%'

  lines.push({
    text: isEn ? `Phys %ED (${totalEdLabel}): ${edDetail}` : `物理增伤 (${totalEdLabel}): ${edDetail}`,
    color: 'blue',
    font: 'font8',
    align: 'center',
  })

  if (formula.skillPhysMin > 0 || formula.skillPhysMax > 0) {
    lines.push({
      text: isEn
        ? `Skill Flat Phys: +${formula.skillPhysMin}~${formula.skillPhysMax}`
        : `技能附加物理: +${formula.skillPhysMin}~${formula.skillPhysMax}`,
      color: 'blue',
      font: 'font8',
      align: 'center',
    })
  }

  const elemParts: string[] = []
  if (formula.fireMax > 0) elemParts.push(isEn ? `Fire ${formula.fireMin}~${formula.fireMax}` : `火焰 ${formula.fireMin}~${formula.fireMax}`)
  if (formula.lightMax > 0) elemParts.push(isEn ? `Ltng ${formula.lightMin}~${formula.lightMax}` : `闪电 ${formula.lightMin}~${formula.lightMax}`)
  if (formula.coldMax > 0) elemParts.push(isEn ? `Cold ${formula.coldMin}~${formula.coldMax}` : `冰冷 ${formula.coldMin}~${formula.coldMax}`)
  if (formula.magicMax > 0) elemParts.push(isEn ? `Magic ${formula.magicMin}~${formula.magicMax}` : `魔法 ${formula.magicMin}~${formula.magicMax}`)
  if (formula.poisonMax > 0) elemParts.push(isEn ? `Pois ${formula.poisonMin}~${formula.poisonMax}` : `毒素 ${formula.poisonMin}~${formula.poisonMax}`)

  if (elemParts.length > 0) {
    lines.push({
      text: isEn ? `Elemental/Magic: ${elemParts.join(' + ')}` : `元素/魔法附加: ${elemParts.join(' + ')}`,
      color: 'blue',
      font: 'font8',
      align: 'center',
    })
  }

  const skillElemMin = formula.skillElemMin ?? 0
  const skillElemMax = formula.skillElemMax ?? 0
  if (skillElemMax > 0) {
    lines.push({
      text: isEn
        ? `Skill Elemental: +${skillElemMin}-${skillElemMax}`
        : `技能元素附加: +${skillElemMin}-${skillElemMax}`,
      color: 'blue',
      font: 'font8',
      align: 'center',
    })
  }

  const baseTerm = hasFlat
    ? `(${formula.weaponMin}~${formula.weaponMax} + ${formula.offWeaponFlatMin}~${formula.offWeaponFlatMax})`
    : `${formula.weaponMin}~${formula.weaponMax}`
  const edTerm =
    formula.totalMinEdPct === formula.totalMaxEdPct
      ? formula.totalMaxEdPct >= 0
        ? ` × (1+${formula.totalMaxEdPct}%)`
        : ` × (1-${Math.abs(formula.totalMaxEdPct)}%)`
      : ` × (1+${formula.totalMinEdPct}%~${formula.totalMaxEdPct}%)`
  let expr = `${baseTerm}${edTerm}`
  if (formula.skillPhysMin > 0 || formula.skillPhysMax > 0) {
    expr = `(${expr} + ${formula.skillPhysMin}~${formula.skillPhysMax})`
  }
  if (formula.srcDam !== 128) {
    const srcPct = Math.round((formula.srcDam * 100) / 128)
    expr = `⌊${expr}⌋ × ${srcPct}%`
  }
  if (formula.magicConversionPct === 100) {
    expr += isEn ? ' (100% Magic)' : ' (100%转魔法)'
  }
  const extraElemMin =
    formula.fireMin +
    formula.lightMin +
    formula.coldMin +
    formula.poisonMin +
    (formula.magicConversionPct > 0 ? 0 : formula.magicMin)
  const extraElemMax =
    formula.fireMax +
    formula.lightMax +
    formula.coldMax +
    formula.poisonMax +
    (formula.magicConversionPct > 0 ? 0 : formula.magicMax)
  if (extraElemMax > 0) {
    expr = `${expr} + (${extraElemMin}~${extraElemMax})`
  }
  if (skillElemMax > 0) {
    expr = `${expr} + (${skillElemMin}-${skillElemMax})`
  }

  lines.push({
    text: isEn ? `Formula: ${expr} = ${formula.finalMin}~${formula.finalMax}` : `公式: ${expr} = ${formula.finalMin}~${formula.finalMax}`,
    color: 'gold',
    font: 'font8',
    align: 'center',
  })

  return lines
}

/**
 * Remaining Stat Points section (below Energy, panel space y 341..362). The 1.13c
 * client composites this at runtime with two sunken D2Win beveled slots — they are
 * NOT part of the `invchar6.dc6` art (that region is plain stone) and their widths
 * differ (79 vs 38), so vanilla draws them programmatically rather than from a
 * sprite: a wide banner behind the two stacked red `strchrstat`/`strchrrema` lines
 * and a narrower counter socket whose number is WHITE (red is only the label text).
 * Bounds measured from a live 1.13c capture anchored on the four `+` button rows.
 */
export const STAT_POINTS_BANNER_BOUNDS = { x: 80 + 5, y: 60 + 341, w: 79, h: 21 } as const
export const STAT_POINTS_NUMBER_BOX_BOUNDS = { x: 80 + 85, y: 60 + 341, w: 38, h: 21 } as const

/**
 * Sunken gold-railed slot, drawn programmatically exactly like the 1.13c D2Win
 * beveled rects the client uses for the stat-points banner/counter. Rail and
 * interior colors are sampled from the sibling value slots that ARE baked into
 * `invchar6.dc6` (e.g. the Energy row slot at panel-rel (55, 292)):
 * top rail rgb(172,156,100), interior rgb(4,4,4), an inner light line
 * rgb(172,172,172) above the bottom rail rgb(140,124,80).
 */
export function drawStatPointsSunkenSlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = '#040404'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#ac9c64'
  ctx.fillRect(x, y, w, 1)
  ctx.fillStyle = '#acacac'
  ctx.fillRect(x, y + h - 2, w, 1)
  ctx.fillStyle = '#8c7c50'
  ctx.fillRect(x, y + h - 1, w, 1)
}

/**
 * Neutral, not-ready character attributes. Every field is filled from server packets
 * (`ClientWorld.self`) by `HudModel.syncFromWorld()`; nothing is pre-seeded with demo values.
 */
export function createEmptyCharacterAttributes(): CharacterSheetAttributes {
  return {
    name: '',
    classNameZh: '',
    classNameEn: '',
    level: 0,
    xp: 0,
    nextLevelXp: 0,
    str: 0,
    dex: 0,
    vit: 0,
    ene: 0,
    statPoints: 0,
    baseMaxHp: 0,
    baseMaxMana: 0,
    baseMaxStamina: 0,
    defense: 0,
    attackRating: 0,
    fireRes: 0,
    coldRes: 0,
    lightRes: 0,
    poisRes: 0,
  }
}

export class CharacterSheetPanel {
  visible = false
  lang: TblLang = getTblLang()
  /** `null` until the server assigns the character class. */
  classCode: CharacterClassCode | null = null
  attrs: CharacterSheetAttributes = createEmptyCharacterAttributes()
  showBasePlusBonusStats = false
  showStatGainTooltips = false
  showDamageFormulaTooltips = false
  showAdvancedStatsButton = false
  advancedStatsOpen = false
  advStatsBtnPressed = false
  hoveredStat: BaseStatKey | null = null
  hoveredDamageHand: DamageHandKey | null = null
  hoveredElement: CharSheetHoveredElement | null = null
  /**
   * Close `X` with 1.13c button semantics: mouse-down latches the depressed
   * `buysellbtn.dc6` cell 11, the sheet closes on mouse-up landing back on the button.
   */
  readonly closeButton = new PanelCloseButton(() => CHAR_CLOSE_BTN_BOUNDS)
  readonly strPlusButton = new LevelPlusButton('str', () => STAT_ALLOC_BUTTONS.str)
  readonly dexPlusButton = new LevelPlusButton('dex', () => STAT_ALLOC_BUTTONS.dex)
  readonly vitPlusButton = new LevelPlusButton('vit', () => STAT_ALLOC_BUTTONS.vit)
  readonly enePlusButton = new LevelPlusButton('ene', () => STAT_ALLOC_BUTTONS.ene)

  private readonly plusButtonEntries: readonly (readonly [BaseStatKey, LevelPlusButton])[] = [
    ['str', this.strPlusButton],
    ['dex', this.dexPlusButton],
    ['vit', this.vitPlusButton],
    ['ene', this.enePlusButton],
  ]

  /** Stat `+` button currently held down (mouse-down cell of `Panel\Level.dc6`), cleared on mouse-up. */
  get pressedStatKey(): BaseStatKey | null {
    const pressed = this.plusButtonEntries.find(([, b]) => b.isPressed)
    return pressed ? pressed[0] : null
  }

  private plusButtonFor(key: BaseStatKey): LevelPlusButton {
    return this.plusButtonEntries.find(([k]) => k === key)![1]!
  }

  handleMouseMove(localX: number, localY: number): void {
    if (!this.visible) {
      this.hoveredStat = null
      this.hoveredDamageHand = null
      this.hoveredElement = null
      return
    }
    const ox = CHAR_PANEL_ORIGIN.x
    const oy = CHAR_PANEL_ORIGIN.y
    const isOverlayOpen = this.showAdvancedStatsButton && this.advancedStatsOpen
    if (
      localX >= CHAR_CLOSE_BTN_BOUNDS.x &&
      localX <= CHAR_CLOSE_BTN_BOUNDS.x + CHAR_CLOSE_BTN_BOUNDS.w &&
      localY >= CHAR_CLOSE_BTN_BOUNDS.y &&
      localY <= CHAR_CLOSE_BTN_BOUNDS.y + CHAR_CLOSE_BTN_BOUNDS.h
    ) {
      this.hoveredElement = 'close'
    } else if (
      this.showAdvancedStatsButton &&
      localX >= CHAR_ADV_STATS_BTN_BOUNDS.x &&
      localX <= CHAR_ADV_STATS_BTN_BOUNDS.x + CHAR_ADV_STATS_BTN_BOUNDS.w &&
      localY >= CHAR_ADV_STATS_BTN_BOUNDS.y &&
      localY <= CHAR_ADV_STATS_BTN_BOUNDS.y + CHAR_ADV_STATS_BTN_BOUNDS.h
    ) {
      this.hoveredElement = 'advStats'
    } else if (
      !isOverlayOpen &&
      localX >= ox + 162 &&
      localX <= ox + 320 &&
      localY >= oy + 138 &&
      localY <= oy + 165
    ) {
      this.hoveredElement = doesSkillUseAttackRating(this.attrs.leftSkillId ?? 0) ? 'leftAr' : null
    } else if (
      !isOverlayOpen &&
      localX >= ox + 162 &&
      localX <= ox + 320 &&
      localY >= oy + 166 &&
      localY <= oy + 191
    ) {
      this.hoveredElement = doesSkillUseAttackRating(this.attrs.rightSkillId ?? 0) ? 'rightAr' : null
    } else if (
      !isOverlayOpen &&
      localX >= ox + 166 &&
      localX <= ox + 311 &&
      localY >= oy + 192 &&
      localY <= oy + 215
    ) {
      this.hoveredElement = 'defense'
    } else {
      this.hoveredElement = null
    }

    if (this.showStatGainTooltips && !isOverlayOpen) {
      let foundStat: BaseStatKey | null = null
      for (const [key, b] of Object.entries(STAT_ROW_BOUNDS) as [
        BaseStatKey,
        typeof STAT_ROW_BOUNDS[BaseStatKey],
      ][]) {
        if (localX >= b.x && localX <= b.x + b.w && localY >= b.y && localY <= b.y + b.h) {
          foundStat = key
          break
        }
      }
      this.hoveredStat = foundStat
    } else {
      this.hoveredStat = null
    }

    if (this.showDamageFormulaTooltips && !isOverlayOpen) {
      let foundHand: DamageHandKey | null = null
      for (const [hand, b] of Object.entries(DAMAGE_ROW_BOUNDS) as [
        DamageHandKey,
        typeof DAMAGE_ROW_BOUNDS[DamageHandKey],
      ][]) {
        if (localX >= b.x && localX <= b.x + b.w && localY >= b.y && localY <= b.y + b.h) {
          foundHand = hand
          break
        }
      }
      this.hoveredDamageHand = foundHand
    } else {
      this.hoveredDamageHand = null
    }
  }

  formatStatGainTooltipLines(statKey: BaseStatKey): StatGainTooltipLine[] {
    return formatStatGainTooltipLines(statKey, this.classCode, this.attrs, this.lang)
  }

  formatDamageTooltipLines(hand: DamageHandKey): StatGainTooltipLine[] {
    return formatCharacterDamageTooltipLines(hand, this.attrs, this.lang)
  }

  static computeStatTooltipPlacement(
    rowBounds: { x: number; y: number; w: number; h: number },
    lines: readonly StatGainTooltipLine[],
    font: D2FontRenderer,
    maxLocalX = 792,
  ): { x: number; y: number; w: number; h: number } {
    const maxLineWidth = lines.reduce((max, l) => {
      const w =
        typeof font?.measureText === 'function' ? font.measureText(l.text, l.font) : l.text.length * 8
      return Math.max(max, w)
    }, 0)
    const boxW = Math.max(190, maxLineWidth + 28)
    const boxH = lines.length * 17 + 20
    const rawX = rowBounds.x + rowBounds.w + 8
    const clampedX = Math.max(8, Math.min(maxLocalX - boxW, rawX))
    const rawY = Math.round(rowBounds.y + rowBounds.h / 2 - boxH / 2)
    const clampedY = Math.max(8, Math.min(552 - boxH, rawY))
    return { x: clampedX, y: clampedY, w: boxW, h: boxH }
  }

  drawStatTooltip(ctx: CanvasRenderingContext2D, font: D2FontRenderer, maxLocalX = 792): void {
    if (!this.visible || !this.showStatGainTooltips || !this.hoveredStat) return
    const lines = this.formatStatGainTooltipLines(this.hoveredStat)
    if (lines.length === 0) return
    const rowBounds = STAT_ROW_BOUNDS[this.hoveredStat]
    const placement = CharacterSheetPanel.computeStatTooltipPlacement(rowBounds, lines, font, maxLocalX)

    ctx.fillStyle = 'rgba(4, 4, 4, 0.94)'
    ctx.fillRect(placement.x, placement.y, placement.w, placement.h)
    ctx.strokeStyle = '#8c7244'
    ctx.lineWidth = 1
    ctx.strokeRect(placement.x + 0.5, placement.y + 0.5, placement.w - 1, placement.h - 1)

    lines.forEach((l, idx) => {
      const lineY = placement.y + 10 + 10 + idx * 17
      const lineX =
        l.align === 'left'
          ? placement.x + 14
          : l.align === 'right'
            ? placement.x + placement.w - 14
            : placement.x + Math.round(placement.w / 2)
      font.drawText(ctx, l.text, lineX, lineY, {
        font: l.font,
        color: l.color,
        align: l.align ?? 'center',
      })
    })
  }

  drawDamageTooltip(ctx: CanvasRenderingContext2D, font: D2FontRenderer, maxLocalX = 792): void {
    if (!this.visible || !this.showDamageFormulaTooltips || !this.hoveredDamageHand) return
    const lines = this.formatDamageTooltipLines(this.hoveredDamageHand)
    if (lines.length === 0) return
    const rowBounds = DAMAGE_ROW_BOUNDS[this.hoveredDamageHand]
    const placement = CharacterSheetPanel.computeStatTooltipPlacement(rowBounds, lines, font, maxLocalX)

    ctx.fillStyle = 'rgba(4, 4, 4, 0.94)'
    ctx.fillRect(placement.x, placement.y, placement.w, placement.h)
    ctx.strokeStyle = '#8c7244'
    ctx.lineWidth = 1
    ctx.strokeRect(placement.x + 0.5, placement.y + 0.5, placement.w - 1, placement.h - 1)

    lines.forEach((l, idx) => {
      const lineY = placement.y + 10 + 10 + idx * 17
      const lineX =
        l.align === 'left'
          ? placement.x + 14
          : l.align === 'right'
            ? placement.x + placement.w - 14
            : placement.x + Math.round(placement.w / 2)
      font.drawText(ctx, l.text, lineX, lineY, {
        font: l.font,
        color: l.color,
        align: l.align ?? 'center',
      })
    })
  }

  /**
   * Mouse-down inside the sheet: latches the pressed cell of the stat `+` buttons,
   * the close `X`, and the `?` Advanced Stats button (1.13c semantics — nothing fires until mouse-up).
   */
  handleMouseDown(logicalX: number, logicalY: number): boolean {
    if (!this.visible) return false
    if (logicalX > 400) return false

    // Close button — press only latches the depressed cell; the sheet closes on
    // mouse-up landing back on the button (see `handleMouseUp`).
    if (
      logicalX >= CHAR_CLOSE_BTN_BOUNDS.x &&
      logicalX <= CHAR_CLOSE_BTN_BOUNDS.x + CHAR_CLOSE_BTN_BOUNDS.w &&
      logicalY >= CHAR_CLOSE_BTN_BOUNDS.y &&
      logicalY <= CHAR_CLOSE_BTN_BOUNDS.y + CHAR_CLOSE_BTN_BOUNDS.h
    ) {
      this.closeButton.press(logicalX, logicalY)
      return true
    }

    if (
      this.showAdvancedStatsButton &&
      logicalX >= CHAR_ADV_STATS_BTN_BOUNDS.x &&
      logicalX <= CHAR_ADV_STATS_BTN_BOUNDS.x + CHAR_ADV_STATS_BTN_BOUNDS.w &&
      logicalY >= CHAR_ADV_STATS_BTN_BOUNDS.y &&
      logicalY <= CHAR_ADV_STATS_BTN_BOUNDS.y + CHAR_ADV_STATS_BTN_BOUNDS.h
    ) {
      this.advStatsBtnPressed = true
      return true
    }

    if (this.showAdvancedStatsButton && this.advancedStatsOpen) {
      return true
    }

    // Stat allocation `+` buttons: latch only; `LevelPlusButton.press` self-gates on
    // lit cells (buttons hidden from drawing with 0 unspent points never latch).
    const lit = this.attrs.statPoints > 0
    for (const [, button] of this.plusButtonEntries) button.press(logicalX, logicalY, lit)
    return true
  }

  /**
   * Mouse-up: allocates only when the release lands back on the same pressed `+`
   * button — dragging off the button and releasing cancels the allocation. The close
   * `X` and `?` Advanced Stats buttons follow the same semantics.
   */
  handleMouseUp(logicalX: number, logicalY: number, onStatAllocated?: (key: BaseStatKey) => void): boolean {
    let fired = false
    if (this.closeButton.release(logicalX, logicalY) && this.visible) {
      this.visible = false
      this.hoveredStat = null
      this.hoveredDamageHand = null
      this.advStatsBtnPressed = false
      fired = true
    }
    if (this.advStatsBtnPressed) {
      this.advStatsBtnPressed = false
      if (
        this.visible &&
        this.showAdvancedStatsButton &&
        logicalX >= CHAR_ADV_STATS_BTN_BOUNDS.x &&
        logicalX <= CHAR_ADV_STATS_BTN_BOUNDS.x + CHAR_ADV_STATS_BTN_BOUNDS.w &&
        logicalY >= CHAR_ADV_STATS_BTN_BOUNDS.y &&
        logicalY <= CHAR_ADV_STATS_BTN_BOUNDS.y + CHAR_ADV_STATS_BTN_BOUNDS.h
      ) {
        this.advancedStatsOpen = !this.advancedStatsOpen
        this.hoveredStat = null
        this.hoveredDamageHand = null
        fired = true
      }
    }
    if (!this.visible) return fired
    for (const [key, button] of this.plusButtonEntries) {
      if (button.release(logicalX, logicalY)) {
        // Server-authoritative: only request `AddStatPoint (0x3A)`; the new values arrive via 0x1D..0x1F.
        onStatAllocated?.(key)
        fired = true
      }
    }
    return fired
  }

  draw(
    ctx: CanvasRenderingContext2D,
    liveRuntime: {
      hp: number
      maxHp: number
      mana: number
      maxMana: number
      stamina: number
      maxStamina: number
      leftSkillDmg: string
      rightSkillDmg: string
    },
    assets: {
      borderLeftImg: HTMLImageElement | null
      charSheetImg: HTMLImageElement | null
      buySellBtnImg: HTMLImageElement | null
      levelBtnImg?: HTMLImageElement | null
      questLastImg?: HTMLImageElement | null
    },
    font: D2FontRenderer,
    skipTooltip = false,
  ): void {
    if (!this.visible) return
    const isEn = this.lang === 'ENG'

    // 1. Draw 800x600 Left Gothic Border (`800BorderFrame.dc6` frames 0..4) at (0, 0)
    if (assets.borderLeftImg) {
      ctx.drawImage(assets.borderLeftImg, 0, 0)
    }

    // 2. Draw 320x432 Character Sheet (`invchar6.dc6` frames 0..3) at (80, 60)
    const ox = CHAR_PANEL_ORIGIN.x
    const oy = CHAR_PANEL_ORIGIN.y
    if (assets.charSheetImg) {
      ctx.drawImage(assets.charSheetImg, ox, oy)
    } else {
      reportMissingArt('ui-panel', 'invchar6-char', 'Missing character sheet background invchar6.dc6')
    }

    // 3. Top Header: Character Name (x=12..181, mid=97) & Class (x=194..309, mid=252)
    font.drawText(ctx, this.attrs.name, ox + 97, oy + 21, {
      font: 'fontexocet10',
      color: 'gold',
      align: 'center',
    })
    font.drawText(ctx, isEn ? this.attrs.classNameEn : this.attrs.classNameZh, ox + 252, oy + 21, {
      font: 'fontexocet10',
      color: 'white',
      align: 'center',
    })

    // 4. Level (x=12..53, mid=33), Experience (x=66..181, mid=124), Next Level (x=194..309, mid=252)
    font.drawText(ctx, requireTbl('strchrlvl', this.lang), ox + 33, oy + 46, {
      font: isEn ? 'font6' : 'font8',
      color: 'tan',
      align: 'center',
    })
    font.drawText(ctx, String(this.attrs.level), ox + 33, oy + 62, {
      font: 'fontexocet10',
      color: 'white',
      align: 'center',
    })

    font.drawText(ctx, requireTbl('strchrexp', this.lang), ox + 124, oy + 46, {
      font: isEn ? 'font6' : 'font8',
      color: 'tan',
      align: 'center',
    })
    font.drawText(ctx, String(Math.floor(this.attrs.xp)), ox + 124, oy + 62, {
      font: 'font6',
      color: 'white',
      align: 'center',
    })

    font.drawText(ctx, requireTbl('strchrnxtlvl', this.lang), ox + 252, oy + 46, {
      font: isEn ? 'font6' : 'font8',
      color: 'tan',
      align: 'center',
    })
    font.drawText(ctx, String(Math.floor(this.attrs.nextLevelXp)), ox + 252, oy + 62, {
      font: 'font6',
      color: 'white',
      align: 'center',
    })

    // 5. Four Primary Attributes (`Str`, `Dex`, `Vit`, `Ene`)
    const statRows: readonly {
      key: BaseStatKey
      label: string
      y: number
      val: number
      baseVal: number
    }[] = [
      { key: 'str', label: requireTbl('strchrstr', this.lang), y: 94, val: this.attrs.str, baseVal: this.attrs.baseStr ?? this.attrs.str },
      { key: 'dex', label: requireTbl('strchrdex', this.lang), y: 156, val: this.attrs.dex, baseVal: this.attrs.baseDex ?? this.attrs.dex },
      { key: 'vit', label: requireTbl('strchrvit', this.lang), y: 242, val: this.attrs.vit, baseVal: this.attrs.baseVit ?? this.attrs.vit },
      { key: 'ene', label: requireTbl('strchreng', this.lang), y: 304, val: this.attrs.ene, baseVal: this.attrs.baseEne ?? this.attrs.ene },
    ]
    for (const r of statRows) {
      font.drawText(ctx, r.label, ox + 18, oy + r.y, { font: 'font8', color: 'tan' })
      if (this.showBasePlusBonusStats) {
        const formatted = formatStatBasePlusBonus(r.val, r.baseVal)
        font.drawText(ctx, formatted.text, ox + 95, oy + r.y, {
          font: formatted.font,
          color: formatted.color,
          align: 'center',
        })
      } else {
        font.drawText(ctx, String(r.val), ox + 95, oy + r.y, {
          font: 'fontexocet10',
          color: this.attrs[r.key + 'Color'] || 'white',
          align: 'center',
        })
      }
      if (this.attrs.statPoints > 0) {
        const b = STAT_ALLOC_BUTTONS[r.key]
        if (assets.levelBtnImg) {
          // Same native 30x30 `Panel\Level.dc6` cells as the control-bar `+` buttons,
          // vertically centered on this attribute's text row: steady lit red frame 0,
          // pressed cell 1 while this button is held down (gray frame 2 is never reached
          // here because the sheet hides the buttons with 0 unspent points).
          const frame = this.plusButtonFor(r.key).frame(this.attrs.statPoints)
          ctx.drawImage(
            assets.levelBtnImg,
            frame * LEVEL_BTN_CELL_SIZE,
            0,
            LEVEL_BTN_CELL_SIZE,
            LEVEL_BTN_CELL_SIZE,
            b.x,
            b.y,
            b.w,
            b.h,
          )
        } else {
          reportMissingArt('ui-button', 'level-btn', 'Missing stat allocation button Level.dc6')
        }
      }
    }

    // Remaining Stat Points (`strchrstat` + `strchrrema`): always visible in the
    // 1.13c client — two runtime sunken slots (label banner + counter socket),
    // red stacked labels centered in the banner, WHITE counter centered in its
    // socket. The section stays up at 0 points; only the `+` buttons disappear.
    drawStatPointsSunkenSlot(ctx, STAT_POINTS_BANNER_BOUNDS.x, STAT_POINTS_BANNER_BOUNDS.y, STAT_POINTS_BANNER_BOUNDS.w, STAT_POINTS_BANNER_BOUNDS.h)
    drawStatPointsSunkenSlot(ctx, STAT_POINTS_NUMBER_BOX_BOUNDS.x, STAT_POINTS_NUMBER_BOX_BOUNDS.y, STAT_POINTS_NUMBER_BOX_BOUNDS.w, STAT_POINTS_NUMBER_BOX_BOUNDS.h)
    const statPtsLabel = requireTbl('strchrstat', this.lang)
    const remLabel = requireTbl('strchrrema', this.lang)
    font.drawText(ctx, statPtsLabel, ox + 44, oy + 349, {
      font: 'font6',
      color: 'red',
      align: 'center',
    })
    font.drawText(ctx, remLabel, ox + 44, oy + 358, {
      font: 'font6',
      color: 'red',
      align: 'center',
    })
    font.drawText(ctx, String(this.attrs.statPoints), ox + 104, oy + 355, {
      font: 'fontexocet10',
      color: 'white',
      align: 'center',
    })

    // 6. Combat Ratings (Left/Right Skill Damage, Left/Right Attack Rating, Defense), Stamina, Life, Mana
    const dmgLabel = requireTbl('strchrskm', this.lang)
    const defaultAtkName = getSkillName(0, this.lang)
    const leftSkillLabel = this.attrs.leftSkillName || defaultAtkName
    const rightSkillLabel = this.attrs.rightSkillName || defaultAtkName
    const leftDmgStr = liveRuntime.leftSkillDmg || this.attrs.leftSkillDmg || '1-2'
    const rightDmgStr = liveRuntime.rightSkillDmg || this.attrs.rightSkillDmg || '1-2'

    font.drawText(ctx, leftSkillLabel, ox + 214, oy + 89, {
      font: isEn ? 'font6' : 'font8',
      color: 'tan',
      align: 'center',
    })
    font.drawText(ctx, dmgLabel, ox + 214, oy + 98, {
      font: isEn ? 'font6' : 'font8',
      color: 'tan',
      align: 'center',
    })
    font.drawText(ctx, leftDmgStr, ox + 288, oy + 94, {
      font: 'font6',
      color: this.attrs.leftSkillDmgColor ?? 'white',
      align: 'center',
    })

    font.drawText(ctx, rightSkillLabel, ox + 214, oy + 113, {
      font: isEn ? 'font6' : 'font8',
      color: 'tan',
      align: 'center',
    })
    font.drawText(ctx, dmgLabel, ox + 214, oy + 122, {
      font: isEn ? 'font6' : 'font8',
      color: 'tan',
      align: 'center',
    })
    font.drawText(ctx, rightDmgStr, ox + 288, oy + 118, {
      font: 'font6',
      color: this.attrs.rightSkillDmgColor ?? 'white',
      align: 'center',
    })

    // Three boxes next to Dexterity (y=138..159 Left AR, y=164..185 Right AR, y=192..213 Defense)
    const arTemplate = requireTbl('strchratr', this.lang)
    const arParts = arTemplate.replace('%s', '').trim().split('\n').filter(Boolean)
    const arLabelText = arParts[arParts.length - 1] ?? requireTbl('strchratr', this.lang)
    font.drawText(ctx, arLabelText, ox + 166, oy + 153, {
      font: isEn ? 'font6' : 'font8',
      color: 'tan',
    })
    // Box 1: Left-hand Attack Rating (y=138..159, baseline oy + 153) — gated by doesSkillUseAttackRating (0x6FADE350)
    const leftSkillUsesAr = doesSkillUseAttackRating(this.attrs.leftSkillId ?? 0)
    if (leftSkillUsesAr) {
      const leftAr = this.attrs.leftAttackRating ?? this.attrs.leftAR ?? this.attrs.attackRating
      font.drawText(ctx, String(leftAr), ox + 290, oy + 153, {
        font: 'font8',
        color: this.attrs.leftARColor || 'white',
        align: 'center',
      })
    }
    // Box 2: Right-hand Attack Rating (y=164..185, baseline oy + 178) — gated by doesSkillUseAttackRating (0x6FADE350)
    const rightSkillUsesAr = doesSkillUseAttackRating(this.attrs.rightSkillId ?? 0)
    if (rightSkillUsesAr) {
      const rightAr = this.attrs.rightAttackRating ?? this.attrs.rightAR ?? this.attrs.attackRating
      font.drawText(ctx, String(rightAr), ox + 290, oy + 178, {
        font: 'font8',
        color: this.attrs.rightARColor || 'white',
        align: 'center',
      })
    }
    // Box 3: Defense (y=192..213, baseline oy + 204)
    font.drawText(ctx, requireTbl('strchrdef', this.lang), ox + 166, oy + 204, {
      font: 'font8',
      color: 'tan',
    })
    font.drawText(ctx, String(this.attrs.defense), ox + 290, oy + 204, {
      font: 'font8',
      color: this.attrs.defenseColor || 'white',
      align: 'center',
    })

    // Stamina, Life, Mana — D2Client.dll 1.13c `UI_DrawCharSheet` (0x6fb6cea0) stat readout table
    // at 0x6fb8d6f0 (entries [7]..[13], stride = 16):
    //   [7] x1=232..267 (mid=250): statId=11 (STAT_MAXSTAMINA, blue when boosted / red when reduced)
    //   [8] x1=273..308 (mid=291): statId=10 (STAT_STAMINA, white)
    //   [9] x1=232..267 (mid=250): statId=7  (STAT_MAXHP, blue when boosted / red when reduced)
    //  [10] x1=273..308 (mid=291): statId=6  (STAT_HITPOINTS, white)
    //  [12] x1=232..267 (mid=250): statId=9  (STAT_MAXMANA, blue when boosted / red when reduced)
    //  [13] x1=273..308 (mid=291): statId=8  (STAT_MANA, white)
    // Authentic 1.13c draws Maximum in the LEFT box (ox + 251) and Current in the RIGHT box (ox + 291).
    const maxStam = Math.round(this.attrs.maxStamina || liveRuntime.maxStamina)
    const curStam = Math.round(liveRuntime.stamina)
    font.drawText(ctx, requireTbl('strchrstm', this.lang), ox + 166, oy + 242, {
      font: 'font8',
      color: 'tan',
    })
    font.drawText(ctx, `${maxStam}`, ox + 251, oy + 242, {
      font: 'font8',
      color: this.attrs.maxStaminaColor || 'white',
      align: 'center',
    })
    font.drawText(ctx, `${curStam}`, ox + 291, oy + 242, {
      font: 'font8',
      color: 'white',
      align: 'center',
    })

    const maxHp = Math.round(this.attrs.maxHp || liveRuntime.maxHp)
    const curHp = Math.round(liveRuntime.hp)
    font.drawText(ctx, requireTbl('strchrlif', this.lang), ox + 166, oy + 266, {
      font: 'font8',
      color: 'tan',
    })
    font.drawText(ctx, `${maxHp}`, ox + 251, oy + 266, {
      font: 'font8',
      color: this.attrs.maxHpColor || 'white',
      align: 'center',
    })
    font.drawText(ctx, `${curHp}`, ox + 291, oy + 266, {
      font: 'font8',
      color: 'white',
      align: 'center',
    })

    const maxMana = Math.round(this.attrs.maxMana || liveRuntime.maxMana)
    const curMana = Math.round(liveRuntime.mana)
    font.drawText(ctx, requireTbl('strchrman', this.lang), ox + 166, oy + 304, {
      font: 'font8',
      color: 'tan',
    })
    font.drawText(ctx, `${maxMana}`, ox + 251, oy + 304, {
      font: 'font8',
      color: this.attrs.maxManaColor || 'white',
      align: 'center',
    })
    font.drawText(ctx, `${curMana}`, ox + 291, oy + 304, {
      font: 'font8',
      color: 'white',
      align: 'center',
    })

    // 7. Four Elemental Resistances (`strchrfir`, `strchrcol`, `strchrlit`, `strchrpos`)
    const resRows = [
      { tblKey: 'strchrfir', y: 344, val: this.attrs.fireRes, maxCap: this.attrs.maxFireRes ?? 75, base: this.attrs.baseFireRes, colorStr: this.attrs.fireResColor },
      { tblKey: 'strchrcol', y: 368, val: this.attrs.coldRes, maxCap: this.attrs.maxColdRes ?? 75, base: this.attrs.baseColdRes, colorStr: this.attrs.coldResColor },
      { tblKey: 'strchrlit', y: 392, val: this.attrs.lightRes, maxCap: this.attrs.maxLightRes ?? 75, base: this.attrs.baseLightRes, colorStr: this.attrs.lightResColor },
      { tblKey: 'strchrpos', y: 416, val: this.attrs.poisRes, maxCap: this.attrs.maxPoisonRes ?? 75, base: this.attrs.basePoisonRes, colorStr: this.attrs.poisResColor },
    ] as const
    for (const res of resRows) {
      const rawLabel = requireTbl(res.tblKey, this.lang)
      const labelLines = rawLabel.split('\n').map(s => s.trim()).filter(Boolean)
      if (labelLines.length >= 2) {
        font.drawText(ctx, labelLines[0]!, ox + 222, oy + res.y - 4, {
          font: isEn ? 'font6' : 'font8',
          color: 'tan',
          align: 'center',
        })
        font.drawText(ctx, labelLines[1]!, ox + 222, oy + res.y + 4, {
          font: isEn ? 'font6' : 'font8',
          color: 'tan',
          align: 'center',
        })
      } else {
        font.drawText(ctx, labelLines[0] ?? rawLabel, ox + 222, oy + res.y, {
          font: isEn ? 'font6' : 'font8',
          color: 'tan',
          align: 'center',
        })
      }
      font.drawText(ctx, `${res.val}%`, ox + 291, oy + res.y, {
        font: 'fontexocet10',
        color: (res as any).colorStr === 'red' ? 'red' : res.val >= res.maxCap ? 'gold' : res.val < 0 ? 'red' : ((res as any).colorStr === 'blue' ? 'blue' : resolveResistanceValueColor(res.val, res.maxCap, res.base)),
        align: 'center',
      })
    }

    // 8. Close Button (`buysellbtn.dc6` frame 10 raised / 11 pressed while held down)
    if (assets.buySellBtnImg) {
      ctx.drawImage(
        assets.buySellBtnImg,
        this.closeButton.frame() * 32,
        0,
        32,
        32,
        CHAR_CLOSE_BTN_BOUNDS.x,
        CHAR_CLOSE_BTN_BOUNDS.y,
        32,
        32,
      )
    }

    // 8b. Advanced Character Stats Button (`questlast.dc6` in sunken socket) & Overlay (`hud-enhancements`)
    if (this.showAdvancedStatsButton) {
      this.drawAdvancedStatsQuestionButton(ctx, assets, font)
      if (this.advancedStatsOpen) {
        this.drawAdvancedStatsOverlay(ctx, font, ox, oy)
      }
    }

    // 9. Canonical 1.13c Hover Tooltips (`0x6FB6C760` Defense/Block, `0x6FB6C8F0` Attack Rating, `0x6FB6CFD4` Close)
    if (this.hoveredElement !== null) {
      this.drawVanillaHoverTooltip(ctx, font, ox, oy)
    }

    // 10. Hover Tooltips for Primary Attribute 1-Point Gain and Damage Formula Breakdown
    if (this.showStatGainTooltips && this.hoveredStat && !skipTooltip) {
      this.drawStatTooltip(ctx, font)
    }
    if (this.showDamageFormulaTooltips && this.hoveredDamageHand && !skipTooltip) {
      this.drawDamageTooltip(ctx, font)
    }
  }

  private advStatsCompositeCache: {
    charSheetImg: HTMLImageElement
    questLastImg: HTMLImageElement
    frames: [HTMLCanvasElement | null, HTMLCanvasElement | null]
  } | null = null

  private getAdvStatsCompositeCanvas(
    charSheetImg: HTMLImageElement,
    questLastImg: HTMLImageElement,
    frame: 0 | 1,
  ): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null
    if (
      !this.advStatsCompositeCache ||
      this.advStatsCompositeCache.charSheetImg !== charSheetImg ||
      this.advStatsCompositeCache.questLastImg !== questLastImg
    ) {
      this.advStatsCompositeCache = {
        charSheetImg,
        questLastImg,
        frames: [null, null],
      }
    }
    const existing = this.advStatsCompositeCache.frames[frame]
    if (existing) return existing
    const canvas = document.createElement('canvas')
    canvas.width = CHAR_PANEL_ORIGIN.width
    canvas.height = CHAR_PANEL_ORIGIN.height
    const cctx = canvas.getContext('2d')
    if (!cctx || typeof cctx.drawImage !== 'function') return null
    cctx.imageSmoothingEnabled = false
    const panelX = CHAR_ADV_STATS_BTN_BOUNDS.x - CHAR_PANEL_ORIGIN.x
    const panelY = CHAR_ADV_STATS_BTN_BOUNDS.y - CHAR_PANEL_ORIGIN.y
    cctx.drawImage(charSheetImg, 126, 386, 36, 36, panelX - 2, panelY - 2, 36, 36)
    cctx.drawImage(questLastImg, frame * 30, 0, 30, 30, panelX + 1, panelY + 1, 30, 30)
    this.advStatsCompositeCache.frames[frame] = canvas
    return canvas
  }

  private drawAdvancedStatsQuestionButton(
    ctx: CanvasRenderingContext2D,
    assets: {
      charSheetImg: HTMLImageElement | null
      questLastImg?: HTMLImageElement | null
    },
    font: D2FontRenderer,
  ): void {
    const b = CHAR_ADV_STATS_BTN_BOUNDS
    const depressed = this.advStatsBtnPressed || this.advancedStatsOpen
    const frame: 0 | 1 = depressed ? 1 : 0

    // When both native sprites are loaded in the browser (`width > 0`), pre-composite the 36x36
    // socket and 30x30 `questlast.dc6` frame at 1:1 native texel resolution on a 320x432 layer
    // and draw it at `(CHAR_PANEL_ORIGIN.x, CHAR_PANEL_ORIGIN.y)`. This guarantees identical
    // texel-to-pixel rounding with the neighboring Close button socket and prevents Skia subrect
    // perimeter anti-aliasing from blending `questlast.dc6` row 0 into the top gold border under fractional `uiScale`.
    if (
      assets.charSheetImg &&
      assets.charSheetImg.width > 0 &&
      assets.questLastImg &&
      assets.questLastImg.width > 0
    ) {
      const composite = this.getAdvStatsCompositeCanvas(assets.charSheetImg, assets.questLastImg, frame)
      if (composite) {
        ctx.drawImage(composite, CHAR_PANEL_ORIGIN.x, CHAR_PANEL_ORIGIN.y)
        return
      }
    }

    // 1. Sunken gold-beveled button socket (cloned from the native `invchar6.dc6` Close button socket at 126,386)
    if (assets.charSheetImg) {
      ctx.drawImage(assets.charSheetImg, 126, 386, 36, 36, b.x - 2, b.y - 2, 36, 36)
    } else {
      ctx.fillStyle = '#0c0a08'
      ctx.fillRect(b.x, b.y, b.w, b.h)
      ctx.strokeStyle = '#ac9c64'
      ctx.lineWidth = 1
      ctx.strokeRect(b.x - 0.5, b.y - 0.5, b.w + 1, b.h + 1)
    }

    // 2. Authentic `data/global/ui/MENU/questlast.dc6` speech-bubble `!` button (frame 0 raised / frame 1 pressed, 30x30)
    if (assets.questLastImg) {
      ctx.drawImage(assets.questLastImg, frame * 30, 0, 30, 30, b.x + 1, b.y + 1, 30, 30)
    } else {
      const offset = depressed ? 1 : 0
      font.drawText(ctx, '!', b.x + Math.round(b.w / 2) + offset, b.y + 22 + offset, {
        font: 'fontexocet10',
        color: this.advancedStatsOpen ? 'yellow' : 'gold',
        align: 'center',
        shadow: true,
      })
    }
  }

  private drawColoredSegments(
    ctx: CanvasRenderingContext2D,
    font: D2FontRenderer,
    startX: number,
    y: number,
    segments: readonly { readonly text: string; readonly color: D2ColorCode }[],
  ): void {
    let curX = startX
    for (const seg of segments) {
      if (!seg.text) continue
      font.drawText(ctx, seg.text, curX, y, {
        font: 'font6',
        color: seg.color,
        align: 'left',
      })
      const w =
        typeof font?.measureText === 'function' ? font.measureText(seg.text, 'font6') : seg.text.length * 6
      curX += w
    }
  }

  private drawAdvancedStatsOverlay(
    ctx: CanvasRenderingContext2D,
    font: D2FontRenderer,
    ox: number,
    oy: number,
  ): void {
    const isEn = this.lang === 'ENG'
    const a = this.attrs
    const box = CHAR_ADV_STATS_PANEL_BOUNDS

    // Dark stone overlay with double gothic gold/bronze frame
    ctx.fillStyle = 'rgba(4, 4, 4, 0.98)'
    ctx.fillRect(box.x, box.y, box.w, box.h)
    ctx.strokeStyle = '#8c7244'
    ctx.lineWidth = 1
    ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1)
    ctx.strokeStyle = '#2e2618'
    ctx.strokeRect(box.x + 2.5, box.y + 2.5, box.w - 5, box.h - 5)

    const leftX = ox + 12
    const rightX = ox + 166
    const rowStep = 11
    const sectionGap = 5
    let y = oy + 19

    // 1. Name
    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Name: ' : '名称: ', color: 'tan' },
      { text: a.name || '-', color: 'white' },
    ])
    y += rowStep + sectionGap

    // 2. Resistances (Uncapped / Max + Poison/Curse Length)
    const uncappedFire = a.uncappedFireRes ?? a.fireRes ?? 0
    const maxFire = a.maxFireRes ?? 75
    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Fire Resist: ' : '火焰抗性: ', color: 'tan' },
      { text: `${uncappedFire}`, color: 'red' },
      { text: ` / ${maxFire}`, color: 'white' },
    ])
    y += rowStep

    const uncappedCold = a.uncappedColdRes ?? a.coldRes ?? 0
    const maxCold = a.maxColdRes ?? 75
    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Cold Resist: ' : '冰冷抗性: ', color: 'tan' },
      { text: `${uncappedCold}`, color: 'blue' },
      { text: ` / ${maxCold}`, color: 'white' },
    ])
    y += rowStep

    const uncappedLight = a.uncappedLightRes ?? a.lightRes ?? 0
    const maxLight = a.maxLightRes ?? 75
    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Lightning Resist: ' : '闪电抗性: ', color: 'tan' },
      { text: `${uncappedLight}`, color: 'yellow' },
      { text: ` / ${maxLight}`, color: 'white' },
    ])
    y += rowStep

    const uncappedPois = a.uncappedPoisonRes ?? a.poisRes ?? 0
    const maxPois = a.maxPoisonRes ?? 75
    const poisLen = a.poisonLengthPct ?? 100
    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Poison Resist: ' : '毒素抗性: ', color: 'tan' },
      { text: `${uncappedPois}`, color: 'green' },
      { text: ` / ${maxPois}  `, color: 'white' },
      { text: isEn ? 'Length: ' : '持续时间: ', color: 'tan' },
      { text: `${poisLen}%`, color: 'green' },
    ])
    y += rowStep

    const curseRes = a.curseRes ?? 0
    const maxCurseRes = a.maxCurseRes ?? 50
    const curseLen = a.curseLengthPct ?? Math.max(25, 100 - curseRes)
    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Curse Resist: ' : '诅咒抗性: ', color: 'tan' },
      { text: `${curseRes}`, color: 'orange' },
      { text: ` / ${maxCurseRes} `, color: 'white' },
      { text: isEn ? 'Length: ' : '持续时间: ', color: 'tan' },
      { text: `${curseLen}%`, color: 'white' },
    ])
    y += rowStep + sectionGap

    // 3. Absorption, Damage Reduction, Attacker Takes Damage
    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Absorption: ' : '伤害吸收: ', color: 'tan' },
      { text: `${a.fireAbsorbFlat ?? 0}/${a.fireAbsorbPct ?? 0}% `, color: 'red' },
      { text: `${a.coldAbsorbFlat ?? 0}/${a.coldAbsorbPct ?? 0}% `, color: 'blue' },
      { text: `${a.lightAbsorbFlat ?? 0}/${a.lightAbsorbPct ?? 0}% `, color: 'yellow' },
      { text: `${a.magicAbsorbFlat ?? 0}/${a.magicAbsorbPct ?? 0}%`, color: 'orange' },
    ])
    y += rowStep

    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Damage Reduction: ' : '伤害减免: ', color: 'tan' },
      { text: `${a.drFlat ?? 0}/${a.drPct ?? 0}% `, color: 'white' },
      { text: `${a.mdrFlat ?? 0}/${a.mdrPct ?? 0}%`, color: 'orange' },
    ])
    y += rowStep

    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Attacker Takes Damage: ' : '攻击者受到伤害: ', color: 'tan' },
      { text: `${a.atdPhys ?? 0} `, color: 'white' },
      { text: `${a.atdLight ?? 0}`, color: 'yellow' },
    ])
    y += rowStep + sectionGap

    // 4. Elemental Mastery, Elemental Pierce, Base AR, Base Def, Base Damage
    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Elemental Mastery: ' : '元素掌握: ', color: 'tan' },
      { text: `${a.fireMasteryPct ?? 0}% `, color: 'red' },
      { text: `${a.coldMasteryPct ?? 0}% `, color: 'blue' },
      { text: `${a.lightMasteryPct ?? 0}% `, color: 'yellow' },
      { text: `${a.poisonMasteryPct ?? 0}% `, color: 'green' },
      { text: `${a.magicMasteryPct ?? 0}%`, color: 'orange' },
    ])
    y += rowStep

    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Elemental Pierce: ' : '元素穿透: ', color: 'tan' },
      { text: `${a.firePiercePct ?? 0}% `, color: 'red' },
      { text: `${a.coldPiercePct ?? 0}% `, color: 'blue' },
      { text: `${a.lightPiercePct ?? 0}% `, color: 'yellow' },
      { text: `${a.poisonPiercePct ?? 0}% `, color: 'green' },
      { text: `${a.magicPiercePct ?? 0}%`, color: 'orange' },
    ])
    y += rowStep

    const toHitFactor = this.classCode ? (CANONICAL_CHARSTATS[this.classCode]?.toHitFactor ?? 0) : 0
    const dexAr = a.baseArDex ?? Math.max(0, ((a.dex ?? 0) - 7) * 5 + toHitFactor)
    const equipAr = a.baseArEquip ?? 0
    const totalBaseAr = dexAr + equipAr
    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Base AR: ' : '基础命中: ', color: 'tan' },
      { text: isEn ? 'dex: ' : '敏捷: ', color: 'gray' },
      { text: `${dexAr} `, color: 'white' },
      { text: isEn ? 'equip: ' : '装备: ', color: 'gray' },
      { text: `${equipAr} `, color: 'white' },
      { text: isEn ? 'total: ' : '总计: ', color: 'gray' },
      { text: `${totalBaseAr}`, color: 'white' },
    ])
    y += rowStep

    const dexDef = a.baseDefDex ?? Math.floor((a.dex ?? 0) / 4)
    const equipDef = a.baseDefEquip ?? Math.max(0, (a.baseDefense ?? a.defense ?? 0) - dexDef)
    const totalBaseDef = dexDef + equipDef
    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Base Def: ' : '基础防御: ', color: 'tan' },
      { text: isEn ? 'dex: ' : '敏捷: ', color: 'gray' },
      { text: `${dexDef} `, color: 'white' },
      { text: isEn ? 'equip: ' : '装备: ', color: 'gray' },
      { text: `${equipDef} `, color: 'white' },
      { text: isEn ? 'total: ' : '总计: ', color: 'gray' },
      { text: `${totalBaseDef}`, color: 'white' },
    ])
    y += rowStep

    const dmg1hMin = a.baseDmg1hMin ?? a.weaponPhysBaseMin ?? 0
    const dmg1hMax = a.baseDmg1hMax ?? a.weaponPhysBaseMax ?? 0
    const dmg2hMin = a.baseDmg2hMin ?? 0
    const dmg2hMax = a.baseDmg2hMax ?? 0
    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Base Damage: ' : '基础伤害: ', color: 'tan' },
      { text: isEn ? '1h: ' : '单手: ', color: 'gray' },
      { text: `${dmg1hMin}-${dmg1hMax} `, color: 'white' },
      { text: isEn ? '2h: ' : '双手: ', color: 'gray' },
      { text: `${dmg2hMin}-${dmg2hMax}`, color: 'white' },
    ])
    y += rowStep + sectionGap

    // 5. Rates (2 columns)
    const fcr = a.fcr ?? 0
    const fbr = a.fbr ?? 0
    const fhr = a.fhr ?? 0
    const frw = a.frw ?? 0
    const arPct = a.arPct ?? a.arPctBonus ?? 0
    const ias = a.ias ?? 0

    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Cast Rate: ' : '施法速度: ', color: 'tan' },
      { text: `${fcr}`, color: 'white' },
    ])
    this.drawColoredSegments(ctx, font, rightX, y, [
      { text: isEn ? 'Block Rate: ' : '格挡速度: ', color: 'tan' },
      { text: `${fbr}`, color: 'white' },
    ])
    y += rowStep

    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Hit Recovery: ' : '打击恢复: ', color: 'tan' },
      { text: `${fhr}`, color: 'white' },
    ])
    this.drawColoredSegments(ctx, font, rightX, y, [
      { text: isEn ? 'Run/Walk: ' : '高跑速度: ', color: 'tan' },
      { text: `${frw}`, color: 'white' },
    ])
    y += rowStep

    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Attack Rate: ' : '命中加成: ', color: 'tan' },
      { text: `${arPct}`, color: 'white' },
    ])
    this.drawColoredSegments(ctx, font, rightX, y, [
      { text: 'IAS: ', color: 'tan' },
      { text: `${ias}`, color: 'white' },
    ])
    y += rowStep + sectionGap

    // 6. Breakpoints (relative to Right Click Skill)
    this.drawColoredSegments(ctx, font, leftX, y, [
      {
        text: isEn ? 'Breakpoints (relative to Right Click Skill):' : '档位断点 (基于右键技能):',
        color: 'tan',
      },
    ])
    y += rowStep

    const fcrBps = computeFcrBreakpoints(this.classCode, a)
    let activeFcrIdx = -1
    for (let i = 0; i < fcrBps.length; i++) {
      if (fcr >= fcrBps[i]!) activeFcrIdx = i
    }
    const fcrSegs: { text: string; color: D2ColorCode }[] = [{ text: 'FCR: ', color: 'tan' }]
    fcrBps.forEach((bp, idx) => {
      if (idx > 0) fcrSegs.push({ text: ' / ', color: 'white' })
      fcrSegs.push({ text: `${bp}`, color: idx === activeFcrIdx ? 'orange' : 'white' })
    })
    this.drawColoredSegments(ctx, font, leftX, y, fcrSegs)
    y += rowStep

    const fhrBps = computeFhrBreakpoints(this.classCode, a)
    let activeFhrIdx = -1
    for (let i = 0; i < fhrBps.length; i++) {
      if (fhr >= fhrBps[i]!) activeFhrIdx = i
    }
    const fhrSegs: { text: string; color: D2ColorCode }[] = [{ text: 'FHR: ', color: 'tan' }]
    fhrBps.forEach((bp, idx) => {
      if (idx > 0) fhrSegs.push({ text: ' / ', color: 'white' })
      fhrSegs.push({ text: `${bp}`, color: idx === activeFhrIdx ? 'orange' : 'white' })
    })
    this.drawColoredSegments(ctx, font, leftX, y, fhrSegs)
    y += rowStep

    const iasRes = computeIasBreakpoints(this.classCode, a)
    if (!iasRes.isAttack || iasRes.entries.length === 0) {
      this.drawColoredSegments(ctx, font, leftX, y, [
        { text: 'IAS: ', color: 'tan' },
        { text: isEn ? 'N/A (not an attack)' : '无 (非攻击技能)', color: 'white' },
      ])
    } else {
      const iasSegs: { text: string; color: D2ColorCode }[] = [
        { text: isEn ? 'IAS (Frames): ' : 'IAS (帧数): ', color: 'tan' },
      ]
      iasRes.entries.forEach((entry, idx) => {
        if (idx > 0) iasSegs.push({ text: ' / ', color: 'white' })
        const isActive = idx === iasRes.activeIndex
        const label = isActive ? `${entry.ias} (${entry.frames})` : `${entry.ias}`
        iasSegs.push({ text: label, color: isActive ? 'orange' : 'white' })
      })
      this.drawColoredSegments(ctx, font, leftX, y, iasSegs)
    }
    y += rowStep + sectionGap

    // 7. Combat Modifiers (2 columns)
    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Crushing Blow: ' : '压碎性打击: ', color: 'tan' },
      { text: `${a.crushingBlow ?? 0}`, color: 'white' },
    ])
    this.drawColoredSegments(ctx, font, rightX, y, [
      { text: isEn ? 'Open Wounds: ' : '撕开伤口: ', color: 'tan' },
      { text: `${a.openWounds ?? 0}%/+${a.openWoundsFlat ?? 0}`, color: 'white' },
    ])
    y += rowStep

    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Deadly Strike: ' : '致命攻击: ', color: 'tan' },
      { text: `${a.deadlyStrike ?? 0}`, color: 'white' },
    ])
    this.drawColoredSegments(ctx, font, rightX, y, [
      { text: isEn ? 'Critical Strike: ' : '双倍打击: ', color: 'tan' },
      { text: `${a.criticalStrike ?? 0}`, color: 'white' },
    ])
    y += rowStep

    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Life Leech: ' : '生命偷取: ', color: 'tan' },
      { text: `${a.lifeLeech ?? 0}`, color: 'red' },
    ])
    this.drawColoredSegments(ctx, font, rightX, y, [
      { text: isEn ? 'Mana Leech: ' : '法力偷取: ', color: 'tan' },
      { text: `${a.manaLeech ?? 0}`, color: 'blue' },
    ])
    y += rowStep

    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Projectile Pierce: ' : '穿刺几率: ', color: 'tan' },
      { text: `${a.projectilePierce ?? 0}`, color: 'white' },
    ])
    this.drawColoredSegments(ctx, font, rightX, y, [
      { text: isEn ? 'HP/MP per Kill: ' : '击杀回血/回蓝: ', color: 'tan' },
      { text: `${a.lifeAfterKill ?? 0}`, color: 'red' },
      { text: ' / ', color: 'white' },
      { text: `${a.manaAfterKill ?? 0}`, color: 'blue' },
    ])
    y += rowStep + sectionGap

    // 8. Added Damage, Magic Find, Gold Find, Stash Gold
    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Added Damage: ' : '附加伤害: ', color: 'tan' },
      { text: `${a.addedPhysDmg ?? 0}`, color: 'white' },
    ])
    this.drawColoredSegments(ctx, font, rightX, y, [
      { text: `${a.addedMagicMin ?? 0}-${a.addedMagicMax ?? 0}`, color: 'orange' },
    ])
    y += rowStep

    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: `${a.addedFireMin ?? 0}-${a.addedFireMax ?? 0}`, color: 'red' },
    ])
    this.drawColoredSegments(ctx, font, rightX, y, [
      { text: `${a.addedColdMin ?? 0}-${a.addedColdMax ?? 0}`, color: 'blue' },
    ])
    y += rowStep

    const poisMin = a.addedPoisonMin ?? 0
    const poisMax = a.addedPoisonMax ?? 0
    const poisSec = a.addedPoisonSec ?? 0
    const poisText =
      poisMin > 0 || poisMax > 0
        ? isEn
          ? `${poisMin}-${poisMax} over ${poisSec.toFixed(1)}s`
          : `${poisMin}-${poisMax} (${poisSec.toFixed(1)}秒)`
        : '0-0'
    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: `${a.addedLightMin ?? 0}-${a.addedLightMax ?? 0}`, color: 'yellow' },
    ])
    this.drawColoredSegments(ctx, font, rightX, y, [{ text: poisText, color: 'green' }])
    y += rowStep

    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Magic Find: ' : '魔法装备掉率: ', color: 'tan' },
      { text: `${a.magicFind ?? 0}`, color: 'blue' },
    ])
    this.drawColoredSegments(ctx, font, rightX, y, [
      { text: isEn ? 'Gold Find: ' : '额外金币掉率: ', color: 'tan' },
      { text: `${a.goldFind ?? 0}`, color: 'yellow' },
    ])
    y += rowStep

    this.drawColoredSegments(ctx, font, leftX, y, [
      { text: isEn ? 'Stash Gold: ' : '储物箱金币: ', color: 'tan' },
      { text: `${a.stashGold ?? 0}`, color: 'yellow' },
    ])
  }

  formatVanillaHoverTooltipLines(): string[] {
    if (!this.hoveredElement) return []
    const clvl = Math.max(1, Math.trunc(this.attrs.level || 1))
    const monLvl = Math.max(1, Math.trunc(this.attrs.lastMonsterLevel || clvl))
    const monName =
      this.attrs.lastMonsterName && this.attrs.lastMonsterName.trim().length > 0
        ? this.attrs.lastMonsterName.trim()
        : this.lang === 'ENG'
          ? `level ${monLvl} monster`
          : `等級 ${monLvl} 怪物`

    if (this.hoveredElement === 'close') {
      return [requireTbl('strClose', this.lang)]
    }
    if (this.hoveredElement === 'advStats') {
      return [this.lang === 'ENG' ? 'Advanced Stats' : '更多属性']
    }
    if (this.hoveredElement === 'defense') {
      const monAr = this.attrs.lastMonsterAttackRating ?? monLvl * 15
      const monHitPct = computeCharSheetHitChancePct(monAr, this.attrs.defense, monLvl, clvl)
      const blockPct = computeCharacterBlockChancePct(this.attrs)
      if (blockPct > 0) {
        const raw = requireTbl('patchstring#105', this.lang)
          .replace('%d', String(blockPct))
          .replace('%s', monName)
          .replace('%d', String(monHitPct))
        return raw.split(/\r?\n/).filter(Boolean)
      }
      const raw = requireTbl('patchstring#104', this.lang)
        .replace('%s', monName)
        .replace('%d', String(monHitPct))
      return raw.split(/\r?\n/).filter(Boolean)
    }
    if (this.hoveredElement === 'leftAr' || this.hoveredElement === 'rightAr') {
      const skillId =
        this.hoveredElement === 'leftAr'
          ? (this.attrs.leftSkillId ?? 0)
          : (this.attrs.rightSkillId ?? 0)
      if (!doesSkillUseAttackRating(skillId)) return []
      const ar =
        this.hoveredElement === 'leftAr'
          ? (this.attrs.leftAttackRating ?? this.attrs.leftAR ?? this.attrs.attackRating)
          : (this.attrs.rightAttackRating ?? this.attrs.rightAR ?? this.attrs.attackRating)
      const monDef = this.attrs.lastMonsterDefense ?? monLvl * 10
      const hitPct = computeCharSheetHitChancePct(ar, monDef, clvl, monLvl)
      const header = requireTbl('StrChr20', this.lang)
      const detail = requireTbl('patchstring#103', this.lang)
        .replace('%s', monName)
        .replace('%d', String(hitPct))
      return [header, detail]
    }
    return []
  }

  private drawVanillaHoverTooltip(
    ctx: CanvasRenderingContext2D,
    font: D2FontRenderer,
    ox: number,
    oy: number,
  ): void {
    const lines = this.formatVanillaHoverTooltipLines()
    if (lines.length === 0) return
    const maxW = lines.reduce((acc, line) => Math.max(acc, font.measureText(line, 'font16')), 0)
    const boxW = Math.max(44, maxW + 16)
    const lineH = 16
    const boxH = lines.length * lineH + 8
    const centerX =
      this.hoveredElement === 'close'
        ? ox + 143
        : this.hoveredElement === 'advStats'
          ? ox + 108
          : this.hoveredElement === 'defense'
            ? ox + 239
            : ox + 241
    const anchorY =
      this.hoveredElement === 'close' || this.hoveredElement === 'advStats'
        ? oy + 385
        : this.hoveredElement === 'defense'
          ? oy + 190
          : this.hoveredElement === 'rightAr'
            ? oy + 164
            : oy + 138
    const boxX = Math.max(ox + 4, Math.min(ox + 316 - boxW, Math.round(centerX - boxW / 2)))
    const boxY = anchorY - boxH
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
    ctx.fillRect(boxX, boxY, boxW, boxH)
    for (let i = 0; i < lines.length; i++) {
      font.drawText(ctx, lines[i]!, boxX + Math.round(boxW / 2), boxY + 15 + i * lineH, {
        font: 'font16',
        color: 'white',
        align: 'center',
      })
    }
  }
}
