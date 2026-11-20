/**
 * src/common/skills/skill-tooltip-builder.ts
 *
 * Skill tree hover tooltip text, ported from the two D2Client.dll builders called by 0x6FB28820:
 *
 *  - `0x6FAE3550` (used when the hovered skill has no current level, `[esp+0x89C] == -1`):
 *      dsc3 → descline (lvl ≥ 1) → "First Level" | "Current Skill Level: N" [+ " (item)"] → `\n\n`
 *      → dsc2 → `\n` → "Maximum Level Reached" | "Required Level : <reqlevel + lvl>" → str long → str name (ÿc2)
 *      → [`\n\n` StrSkill118 if granted by an item] → [`\n\n` StrSkill119 if not learned].
 *  - `0x6FAE3B50` (skill has a level): dsc3 → [descline at lvl+1 → "Next Level" (or "First Level" when lvl == 0)
 *      → `\n\n`, only while base level < max level] → descline at lvl → "Current Skill Level: N" [+ " (item)"]
 *      → `\n\n` → dsc2 → `\n` → str long → str name (ÿc2) → [StrSkill118] → [StrSkill119].
 *
 * D2 draws the resulting multi-line buffer bottom-up (the first appended line is the lowest), which is also why
 * multi-line `.tbl` strings (str long) are stored bottom line first. This module rebuilds the exact buffer and
 * returns it top-to-bottom.
 */
import { SKILL_DESC_BY_SKILL_ID, SKILL_DESC_FIXED_TBL } from '../data/skilldesc-table.ts'
import type { D2ColorCode, FormattedTooltipLine } from './skills-meta.ts'
import { evaluateSkillDescLines, type SkillCalcState } from './skill-calc-engine.ts'
import type { SkillCatalogEntry } from '../data/skills-catalog.ts'

/** `ÿc<n>` colour index → renderer colour (D2Win palette order). */
const D2_COLOR_INDEX: readonly D2ColorCode[] = ['white', 'red', 'green', 'blue', 'gold', 'gray', 'black', 'tan', 'orange', 'yellow']

export interface SkillTooltipInput {
  readonly state: SkillCalcState
  readonly skill: SkillCatalogEntry
  /** Base (hard) points and effective (base + item/oskill bonus) level. */
  readonly baseLevel: number
  readonly effectiveLevel: number
  /** Skills.txt maxlvl (≤ 0 → 20, `0x6FAE3876 mov esi, 0x14`). */
  readonly maxLevel: number
  /** Skills.txt reqlevel (+0x174). */
  readonly reqLevel: number
  readonly lang: 'en' | 'zh'
  readonly difficulty?: number
  /** Optional `x (hard+bonus)` level display (plugin option, not 1.13c). */
  readonly levelText?: string
}

interface Segment {
  readonly text: string
  readonly color?: number | undefined
}

export function buildSkillTooltipLines(input: SkillTooltipInput): FormattedTooltipLine[] {
  const { state, skill, baseLevel, effectiveLevel, lang } = input
  const rec = SKILL_DESC_BY_SKILL_ID[skill.id]
  if (!rec) throw new Error(`buildSkillTooltipLines: skill ${skill.id} has no SkillDesc record`)
  const tbl = (key: string): string => {
    const e = SKILL_DESC_FIXED_TBL[key]
    if (!e) throw new Error(`SKILL_DESC_FIXED_TBL missing '${key}'`)
    return e[lang]
  }
  const pick = (t: { en: string; zh: string } | undefined): string => (t ? t[lang] : '')
  const difficulty = input.difficulty ?? 0
  const buf: Segment[] = []
  const nl = () => buf.push({ text: '\n' })
  const pushLines = (
    lines: readonly {
      textEn: string
      textZh: string
      color?: number | undefined
      sideBoxOnly?: boolean | undefined
    }[],
  ): boolean => {
    for (const l of lines.slice().reverse()) {
      if (l.sideBoxOnly) continue
      // evaluateSkillDescLines returns top-to-bottom; the original strcat order is bottom-up.
      buf.push({ text: lang === 'en' ? l.textEn : l.textZh, color: l.color })
      nl()
    }
    return lines.length > 0
  }
  const grantedByItem = baseLevel === 0 && effectiveLevel > 0
  const lvl = effectiveLevel
  const levelLabel = input.levelText ?? String(lvl)

  // dsc3 (synergies / footnotes); evaluated at lvl + 1 in 0x6FAE3550 (edi = lvl + 1) and 0x6FAE3B50.
  if (pushLines(evaluateSkillDescLines(state, skill, Math.max(1, lvl + 1), 'dsc3', difficulty))) nl()

  if (lvl <= 0) {
    // 0x6FAE3550
    if (pushLines(evaluateSkillDescLines(state, skill, 1, 'desc', difficulty))) {
      buf.push({ text: tbl('StrSkill17') })
      nl()
      nl()
    }
  } else {
    // 0x6FAE3B50: Next Level block only while the base level is below the max level.
    if (baseLevel < input.maxLevel) {
      if (pushLines(evaluateSkillDescLines(state, skill, lvl + 1, 'desc', difficulty))) {
        buf.push({ text: tbl('StrSkill1') })
        nl()
        nl()
      }
    }
    if (pushLines(evaluateSkillDescLines(state, skill, lvl, 'desc', difficulty))) {
      buf.push({ text: `${tbl('StrSkill2')}${levelLabel}${grantedByItem ? tbl('StrSkill117') : ''}` })
      nl()
      nl()
    }
  }
  // 0x6FAE3550 (lvl <= 0) passes 1 at 0x6FAE37D4; 0x6FAE3B50 (lvl > 0) passes [esp+0x18] = lvl + 1 at 0x6FAE3EA0.
  if (pushLines(evaluateSkillDescLines(state, skill, lvl > 0 ? lvl + 1 : 1, 'dsc2', difficulty))) nl()

  if (lvl <= 0) {
    // 0x6FAE38BE: required level = reqlevel + current level, omitted when 0.
    if (baseLevel >= input.maxLevel) {
      buf.push({ text: tbl('StrSkill116') })
      nl()
    } else if (input.reqLevel + baseLevel !== 0) {
      buf.push({ text: `${tbl('skilldesc3')}${input.reqLevel + baseLevel}` })
      nl()
    }
  }
  buf.push({ text: pick(rec.strLong) })
  nl()
  buf.push({ text: pick(rec.strName), color: 2 })
  if (grantedByItem) {
    nl()
    nl()
    buf.push({ text: tbl('StrSkill118') })
  }
  if (effectiveLevel <= 0) {
    nl()
    nl()
    buf.push({ text: tbl('StrSkill119') })
  }

  // Split the bottom-up buffer into lines and flip to top-to-bottom.
  const lines: { text: string; color?: number | undefined }[] = [{ text: '' }]
  for (const seg of buf) {
    const parts = seg.text.split('\n')
    parts.forEach((part, i) => {
      if (i > 0) lines.push({ text: '' })
      const cur = lines[lines.length - 1]!
      cur.text += part
      if (part && seg.color !== undefined) cur.color = seg.color
    })
  }
  if (lines.length > 1 && lines[lines.length - 1]!.text === '') lines.pop()
  return lines.reverse().map(l => ({
    text: l.text,
    color: l.color !== undefined ? (D2_COLOR_INDEX[l.color] ?? 'white') : 'white',
    font: 'font8' as const,
    align: 'center' as const,
  }))
}
