/**
 * src/common/items/charged-skill.ts
 *
 * `item_charged_skill` (ItemStatCost stat 204, descfunc 24) tooltip line, ported from D2Client.dll 0x6FB056C2:
 *   param  = (skill << shift) | level   (shift / mask from DataTables+0xC6C / +0xC70, i.e. 6 / 0x3F)
 *   value  = (maxCharges << 8) | currentCharges
 *   text   = ModStre10b "Level" + " " + level + " " + skill name + " " + sprintf(ModStre10d "(%d/%d Charges)", cur, max)
 */
import { CANONICAL_CHI_TBL_DICT, CANONICAL_ENG_TBL_DICT } from '../data/canonical-tbl-strings.ts'
import { SKILLS_BY_ID, SKILLS_CATALOG } from '../data/skills-catalog.ts'
import { resolveSkillMeta } from '../skills/skills-data.ts'

export interface ChargedSkillCharges {
  readonly current: number
  readonly max: number
}

export interface DecodedChargedSkillEntry {
  readonly skillId: number
  readonly level: number
  readonly slvl: number
  readonly charges: number
  readonly maxCharges: number
  readonly param: number
  readonly itemId: number
}

/** Splits the packed stat 204 value (`and edi,0xFF` / `sar ecx,8` at 0x6FB056E3). */
export function decodeChargedSkillValue(packed: number): ChargedSkillCharges {
  return { current: packed & 0xff, max: (packed >> 8) & 0xff }
}

/** Packs current / max charges into the stat 204 value. */
export function encodeChargedSkillValue(current: number, max: number): number {
  return ((max & 0xff) << 8) | (current & 0xff)
}

/**
 * Resolves a skill reference (`number` ID or `Skills.txt` name/code) to a canonical skill ID (`-1` if unknown).
 */
export function resolveChargedSkillId113c(skillRef: string | number | undefined): number {
  if (typeof skillRef === 'number' && Number.isInteger(skillRef) && skillRef >= 0) {
    return SKILLS_BY_ID[skillRef] !== undefined ? skillRef : -1
  }
  if (typeof skillRef === 'string') {
    const trimmed = skillRef.trim()
    if (trimmed.length === 0) return -1
    const asNum = Number(trimmed)
    if (Number.isInteger(asNum) && asNum >= 0 && SKILLS_BY_ID[asNum] !== undefined) {
      return asNum
    }
    const byMeta = resolveSkillMeta(trimmed)
    if (byMeta !== undefined) return byMeta.id
    const lower = trimmed.toLowerCase()
    const match = SKILLS_CATALOG.find((s) => s.name.toLowerCase() === lower)
    return match ? match.id : -1
  }
  return -1
}

/**
 * 1.13c `D2Common.dll` `0x6FD97420` (`gpPropertyFuncTable[18]`, `Properties.txt` `func1 = 19` for `charged`):
 * Resolves `(slvl, maxCharges)` from `MagicSuffix.txt` / `UniqueItems.txt` / `SetItems.txt` `(min, max)`:
 * - `slvl`:
 *   - `rawMax === 0`: `min(max(1, trunc((ilvl - reqLvl) / 4) + 1), maxSkillLvl)`
 *   - `rawMax < 0`: `span = max(1, 99 - reqLvl)`, `step = max(1, trunc(span / -rawMax))`, `slvl = max(1, trunc((ilvl - reqLvl) / step))`
 *   - `rawMax > 0`: `rawMax`
 * - `maxCharges`:
 *   - `rawMin === 0`: `5`
 *   - `rawMin < 0`: `absMin = -rawMin`, `absMin + trunc((absMin * slvl) / 8)`
 *   - `rawMin > 0`: `rawMin`
 *   - Clamped to `[1, 255]` (`0x6FD974E5..0x6FD974FB`).
 */
export function resolveChargedSkillRoll113c(
  rawMin: number,
  rawMax: number,
  opts?: {
    readonly ilvl?: number | undefined
    readonly reqLvl?: number | undefined
    readonly maxSkillLvl?: number | undefined
    readonly skillId?: number | string | undefined
  },
): { readonly slvl: number; readonly maxCharges: number } {
  const skillMeta =
    opts?.skillId !== undefined ? SKILLS_BY_ID[resolveChargedSkillId113c(opts.skillId)] : undefined
  const reqLvl = Math.max(1, Math.trunc(opts?.reqLvl ?? skillMeta?.reqlevel ?? 1))
  const maxSkillLvl = Math.max(1, Math.trunc(opts?.maxSkillLvl ?? 20))
  const clampedIlvl = Math.min(99, Math.trunc(opts?.ilvl ?? reqLvl + 1))
  const effectiveIlvl = clampedIlvl <= reqLvl ? reqLvl + 1 : clampedIlvl

  let slvl: number
  if (rawMax === 0) {
    slvl = Math.min(maxSkillLvl, Math.max(1, Math.trunc((effectiveIlvl - reqLvl) / 4) + 1))
  } else if (rawMax < 0) {
    const span = Math.max(1, 99 - reqLvl)
    const step = Math.max(1, Math.trunc(span / -rawMax))
    slvl = Math.max(1, Math.trunc((effectiveIlvl - reqLvl) / step))
  } else {
    slvl = Math.trunc(rawMax)
  }
  slvl = Math.min(63, Math.max(1, slvl))

  let rawCharges: number
  if (rawMin === 0) {
    rawCharges = 5
  } else if (rawMin < 0) {
    const absMin = -Math.trunc(rawMin)
    rawCharges = absMin + Math.trunc((absMin * slvl) / 8)
  } else {
    rawCharges = Math.trunc(rawMin)
  }
  const maxCharges = Math.min(255, Math.max(1, rawCharges))
  return { slvl, maxCharges }
}

/**
 * Resolves the charges of a `charged` RolledItemProp: online items carry the packed stat value in `value`;
 * Properties.txt rolls (`charged` par=skill, min=charges, max=level) are freshly created, so current = max = min.
 */
export function chargedSkillChargesOf(value: number, min: number, slvl = 1): ChargedSkillCharges {
  if (value > 0xff) {
    const decoded = decodeChargedSkillValue(value)
    if (decoded.max > 0) return decoded
  }
  if (min <= 0) {
    const resolvedMax = resolveChargedSkillRoll113c(min, slvl).maxCharges
    const cur = value > 0 && value <= resolvedMax ? value : resolvedMax
    return { current: cur, max: resolvedMax }
  }
  const max = Math.min(255, Math.max(1, Math.trunc(min)))
  const current = value >= 0 && value <= max && value !== min ? Math.trunc(value) : max
  return { current, max }
}

export function formatChargedSkill(
  level: number,
  skillName: string,
  charges: ChargedSkillCharges,
  locale: 'en' | 'zh',
): string {
  const dict = locale === 'en' ? CANONICAL_ENG_TBL_DICT : CANONICAL_CHI_TBL_DICT
  const lvlStr = dict.ModStre10b ?? CANONICAL_ENG_TBL_DICT.ModStre10b
  const fmt = dict.ModStre10d ?? CANONICAL_ENG_TBL_DICT.ModStre10d
  if (lvlStr === undefined || fmt === undefined) throw new Error('charged-skill: ModStre10b/ModStre10d missing')
  const effLevel = level > 0 ? Math.trunc(level) : resolveChargedSkillRoll113c(-charges.max, level).slvl
  let i = 0
  const counts = fmt.replace(/%d/g, () => String(i++ === 0 ? charges.current : charges.max))
  return `${lvlStr} ${effLevel} ${skillName} ${counts}`
}

/**
 * Decodes a single `statId === 204` (`item_charged_skill`) stat entry into `{ skillId, level, charges, maxCharges, param }`.
 * Handles both canonical 1.13c packed `param = (skillId << 6) | (level & 0x3f)` and unpacked test fixtures (`param < 64`).
 */
export function decodeStat204ChargedSkill113c(
  stat: {
    readonly statId?: number | undefined
    readonly id?: number | undefined
    readonly param?: number | undefined
    readonly value?: number | undefined
    readonly min?: number | undefined
    readonly max?: number | undefined
  },
  itemIlvl?: number,
): Omit<DecodedChargedSkillEntry, 'itemId'> | null {
  const rawParam = Math.trunc(stat.param ?? 0)
  if (rawParam <= 0) return null
  const shiftedSkillId = rawParam >>> 6
  let skillId: number
  let level: number
  if (shiftedSkillId > 0) {
    skillId = shiftedSkillId
    level = Math.max(1, rawParam & 0x3f)
  } else {
    skillId = rawParam
    const rawMax = stat.max ?? 1
    level =
      rawMax > 0
        ? Math.max(1, Math.trunc(rawMax))
        : resolveChargedSkillRoll113c(stat.min ?? 1, rawMax, { ilvl: itemIlvl, skillId }).slvl
  }
  if (SKILLS_BY_ID[skillId] === undefined) return null
  const rawVal = Math.trunc(stat.value ?? 0)
  let charges: number
  let maxCharges: number
  if (rawVal > 0xff) {
    charges = rawVal & 0xff
    maxCharges = (rawVal >>> 8) & 0xff
  } else if (stat.min !== undefined && stat.min !== 0) {
    const resolved = chargedSkillChargesOf(rawVal, stat.min, level)
    charges = rawVal >= 0 && rawVal <= resolved.max ? rawVal : resolved.current
    maxCharges = resolved.max
  } else {
    charges = Math.max(0, rawVal & 0xff)
    maxCharges = Math.max(charges, 1)
  }
  const canonicalParam = ((skillId & 0x3ff) << 6) | (Math.max(1, level) & 0x3f)
  return {
    skillId,
    level,
    slvl: level,
    charges,
    maxCharges,
    param: shiftedSkillId > 0 ? rawParam : canonicalParam,
  }
}

/**
 * Extracts all charged skill entries (`stat 204` / `rolledProps` `charged` / `chargedSkills`) from an item.
 * Per `D2Common.#10731` (`0x6FD98395..0x6FD983AC`) and `D2Game` (`0x6FCF9A21`), unidentified or broken items
 * do not grant charged skills.
 */
export function extractItemChargedSkills113c(item: unknown): DecodedChargedSkillEntry[] {
  if (!item || typeof item !== 'object') return []
  const rec = item as Record<string, any>
  if (rec.identified === false || rec.flags?.identified === false) return []
  if (rec.broken === true || rec.flags?.broken === true) return []
  if (typeof rec.rawFlags === 'number') {
    if ((rec.rawFlags & 0x10) === 0 && (rec.quality ?? 0) >= 4 && rec.identified !== true) return []
    if ((rec.rawFlags & 0x100) !== 0) return []
  }
  const rawId = Number(rec.id ?? rec.unitId ?? 0xffffffff)
  const itemId = Number.isInteger(rawId) && rawId >= 0 ? rawId >>> 0 : 0xffffffff
  const itemIlvl = typeof rec.ilvl === 'number' ? rec.ilvl : typeof rec.level === 'number' ? rec.level : undefined
  const out: DecodedChargedSkillEntry[] = []
  const seenParams = new Set<number>()

  const scanStatList = (list: unknown) => {
    if (!Array.isArray(list)) return
    for (const s of list) {
      if (!s || typeof s !== 'object') continue
      const sid = s.statId ?? s.id
      if (sid !== 204) continue
      const decoded = decodeStat204ChargedSkill113c(s, itemIlvl)
      if (!decoded || seenParams.has(decoded.param)) continue
      seenParams.add(decoded.param)
      out.push({ ...decoded, itemId })
    }
  }

  scanStatList(rec.stats)
  scanStatList(rec.runewordStats)
  if (rec.rawItem && typeof rec.rawItem === 'object') {
    scanStatList(rec.rawItem.stats)
    scanStatList(rec.rawItem.runewordStats)
  }

  const scanRolledProps = (props: unknown) => {
    if (!Array.isArray(props)) return
    for (const p of props) {
      if (!p || typeof p !== 'object') continue
      const code = String(p.code ?? '').trim().toLowerCase()
      if (code !== 'charged' && code !== 'item_charged_skill') continue
      const skillId = resolveChargedSkillId113c(p.param ?? p.par)
      if (skillId < 0) continue
      const rolled = resolveChargedSkillRoll113c(p.min ?? 0, p.max ?? 0, { ilvl: itemIlvl, skillId })
      const level = p.max > 0 ? Math.max(1, Math.trunc(p.max)) : rolled.slvl
      const ch = chargedSkillChargesOf(p.value ?? p.min ?? rolled.maxCharges, p.min ?? rolled.maxCharges, level)
      const param = ((skillId & 0x3ff) << 6) | (level & 0x3f)
      if (seenParams.has(param)) continue
      seenParams.add(param)
      out.push({
        skillId,
        level,
        slvl: level,
        charges: ch.current,
        maxCharges: ch.max,
        param,
        itemId,
      })
    }
  }

  scanRolledProps(rec.rolledProps)
  if (rec.rawItem && typeof rec.rawItem === 'object') {
    scanRolledProps(rec.rawItem.rolledProps)
  }

  if (Array.isArray(rec.chargedSkills)) {
    for (const cs of rec.chargedSkills) {
      if (!cs || typeof cs !== 'object') continue
      const skillId = resolveChargedSkillId113c(cs.skillId ?? cs.skill)
      if (skillId < 0) continue
      const level = Math.max(1, Math.trunc(cs.level ?? cs.slvl ?? 1))
      const maxCharges = Math.min(255, Math.max(1, Math.trunc(cs.maxCharges ?? cs.charges ?? 1)))
      const charges = Math.min(maxCharges, Math.max(0, Math.trunc(cs.charges ?? maxCharges)))
      const param = ((skillId & 0x3ff) << 6) | (level & 0x3f)
      if (seenParams.has(param)) continue
      seenParams.add(param)
      out.push({
        skillId,
        level,
        slvl: level,
        charges,
        maxCharges,
        param,
        itemId,
      })
    }
  }

  return out
}
