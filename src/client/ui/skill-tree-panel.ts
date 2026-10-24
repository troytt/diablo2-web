/**
 * Diablo II v1.13c In-Game Skill Tree Panel (`Spells\skltree_*_back.dc6`).
 *
 * Anchored in the Right-Half 800x600 Dock (`800BorderFrame.dc6` frames 5..9 at x=400, y=0;
 * 320x432 skill tree + vertical tab bar at x=400, y=60, hotkey `T`).
 * Uses the extracted `public/skills/bg_<cls>_<tab>.png` (256x432) and `icon_<id>.png` (48x48)
 * assets, with authentic 3-column × 6-row grid positioning (`SkillRow`, `SkillColumn`),
 * point allocation, prerequisite checks, and rich hover tooltips.
 */

import type { D2FontRenderer, D2ColorCode } from './font.ts'
import type { CharacterClassCode } from '../../common/units/classes.ts'
import { SKILLS_CATALOG } from '../../common/data/skills-catalog.ts'
import { lookupTbl, requireTbl, type TblLang } from '../i18n/lang.ts'
import {
  buildTooltipViewModel,
  type TooltipViewModel,
  type SkillCalcState,
} from '../../common/skills/skill-calc-engine.ts'
import {
  getSkillName,
  formatDamageTypeEn,
  getSkillMaxLevel,
  SKILL_TBL_STRINGS,
  type FormattedTooltipLine,
} from '../../common/skills/skills-meta.ts'
import { reportMissingArt } from '../../client/scene/world-renderer.ts'
import { PanelCloseButton } from './close-button.ts'

export {
  getSkillName,
  formatDamageTypeEn,
  getSkillMaxLevel,
  type FormattedTooltipLine,
}

export interface SkillNodeDef {
  readonly skillId: number
  readonly tab: 0 | 1 | 2 // 0 = Fire, 1 = Lightning, 2 = Cold
  readonly row: 1 | 2 | 3 | 4 | 5 | 6
  readonly col: 1 | 2 | 3
  readonly reqLevel: number
  readonly prereqs: readonly number[]
  readonly nameEn: string
  readonly nameZh: string
  readonly descZh: string
  readonly baseMana: number
  readonly baseDmgMin: number
  readonly baseDmgMax: number
}

export const SKILL_PANEL_ORIGIN = { x: 400, y: 60, width: 320, height: 432 } as const

/**
 * Authentic D2 v1.13c (`skltree_*_back.DC6` frames 6, 10, 14) 32x32 Close Button socket X offsets
 * per class and tab `[tab0, tab1, tab2]` relative to `SKILL_PANEL_ORIGIN.x` (Y offset is always +385).
 */
export const SKILL_CLOSE_BTN_OFFSET_X: Record<CharacterClassCode, readonly [number, number, number]> = {
  ama: [171, 101, 16],
  sor: [16, 16, 171],
  nec: [16, 171, 16],
  pal: [16, 101, 16],
  bar: [171, 16, 171],
  dru: [171, 171, 171],
  ass: [101, 171, 16],
}

export const SKILL_CLOSE_BTN_BOUNDS = { x: 400 + 171, y: 60 + 385, w: 32, h: 32 } as const

/** Authentic D2Client.dll 1.13c ground truth grid offsets inside panel (ox=400, oy=60). */
export const SKILL_TREE_COL_OFFSETS_X = [15, 84, 153] as const
export const SKILL_TREE_ROW_OFFSETS_Y = [14, 82, 150, 218, 287, 355] as const

/**
 * Expansion `expansionstring.tbl` CHI entries for Druid & Assassin skill tree tabs (`StrSklTree26`..`StrSklTree34`),
 * corresponding to `ModStre8w`..`ModStre9b` in `canonical-tbl-strings.ts`.
 */
const EXPANSION_SKILL_TREE_CHI_TBL: Readonly<Record<string, string>> = {
  StrSklTree26: '召喚',
  StrSklTree27: '變形',
  StrSklTree28: '技能',
  StrSklTree29: '元素',
  StrSklTree30: '陷阱',
  StrSklTree31: '影子',
  StrSklTree32: '訓練',
  StrSklTree33: '武學',
  StrSklTree34: '藝術',
}

export function resolveSkillTreeTbl(key: string, lang: TblLang): string {
  if (!key) return ''
  const v = lookupTbl(key, lang)
  if (v !== undefined) return v
  if (lang === 'CHI' && key in EXPANSION_SKILL_TREE_CHI_TBL) {
    return EXPANSION_SKILL_TREE_CHI_TBL[key]!
  }
  return requireTbl(key, lang)
}

export interface SkillTreeTabInfo {
  readonly tab: 0 | 1 | 2
  readonly titleKey: string
  readonly subKey: string
  readonly titleZh: string
  readonly subZh: string
  readonly titleEn: string
  readonly subEn: string
  readonly y: number
}

function makeSkillTab(tab: 0 | 1 | 2, titleKey: string, subKey: string, y: number): SkillTreeTabInfo {
  return {
    tab,
    titleKey,
    subKey,
    titleEn: resolveSkillTreeTbl(titleKey, 'ENG'),
    subEn: subKey ? resolveSkillTreeTbl(subKey, 'ENG') : '',
    titleZh: resolveSkillTreeTbl(titleKey, 'CHI'),
    subZh: subKey ? resolveSkillTreeTbl(subKey, 'CHI') : '',
    y,
  }
}

export const CLASS_VERTICAL_TABS: Record<CharacterClassCode, readonly SkillTreeTabInfo[]> = {
  ama: [
    makeSkillTab(2, 'StrSklTree6', 'StrSklTree7', 95),
    makeSkillTab(1, 'StrSklTree8', 'StrSklTree9', 195),
    makeSkillTab(0, 'StrSklTree10', 'StrSklTree11', 295),
  ],
  sor: [
    makeSkillTab(2, 'StrSklTree23', 'StrSklTree5', 95),
    makeSkillTab(1, 'StrSklTree24', 'StrSklTree5', 195),
    makeSkillTab(0, 'StrSklTree25', 'StrSklTree5', 295),
  ],
  nec: [
    makeSkillTab(2, 'StrSklTree16', 'StrSklTree5', 95),
    makeSkillTab(1, 'StrSklTree17', 'StrSklTree18', 195),
    makeSkillTab(0, 'StrSklTree19', '', 295),
  ],
  pal: [
    makeSkillTab(2, 'StrSklTree12', 'StrSklTree13', 95),
    makeSkillTab(1, 'StrSklTree14', 'StrSklTree13', 195),
    makeSkillTab(0, 'StrSklTree15', 'StrSklTree4', 295),
  ],
  bar: [
    makeSkillTab(2, 'StrSklTree20', '', 95),
    makeSkillTab(1, 'StrSklTree21', 'StrSklTree22', 195),
    makeSkillTab(0, 'StrSklTree21', 'StrSklTree4', 295),
  ],
  dru: [
    makeSkillTab(2, 'StrSklTree29', 'StrSklTree4', 95),
    makeSkillTab(1, 'StrSklTree27', 'StrSklTree28', 195),
    makeSkillTab(0, 'StrSklTree26', 'StrSklTree4', 295),
  ],
  ass: [
    makeSkillTab(2, 'StrSklTree33', 'StrSklTree34', 95),
    makeSkillTab(1, 'StrSklTree31', 'StrSklTree32', 195),
    makeSkillTab(0, 'StrSklTree30', '', 295),
  ],
}

function buildClassSkillTrees(): Record<CharacterClassCode, readonly SkillNodeDef[]> {
  const result: Record<CharacterClassCode, SkillNodeDef[]> = {
    ama: [],
    sor: [],
    nec: [],
    pal: [],
    bar: [],
    dru: [],
    ass: [],
  }
  for (const s of SKILLS_CATALOG) {
    const list = result[s.classCode]
    if (!list) continue
    list.push({
      skillId: s.id,
      tab: s.tabIndex as 0 | 1 | 2,
      row: s.row as 1 | 2 | 3 | 4 | 5 | 6,
      col: s.col as 1 | 2 | 3,
      reqLevel: s.reqlevel,
      prereqs: s.reqskills,
      nameEn: s.name,
      nameZh: s.nameZh,
      descZh: s.shortDescZh || s.longDescZh || '',
      baseMana: s.mana,
      baseDmgMin: s.minDam,
      baseDmgMax: s.maxDam,
    })
  }
  return result
}

export const CLASS_SKILL_TREES: Record<CharacterClassCode, readonly SkillNodeDef[]> = buildClassSkillTrees()

export interface SkillSocketLabel {
  readonly text: string
  readonly font: 'font6' | 'font8'
  readonly color: D2ColorCode
}

/**
 * Formats the skill level stone socket label:
 * - When `showBasePlusBonus === false` (1.13c vanilla): total effective level in `font8`
 *   - `hard <= 0`: returns `null` (socket left empty)
 *   - `hard >= 1 && bonus > 0`: returns `{ text: String(hard + bonus), font: 'font8', color: 'blue' }`
 *   - `hard >= 1 && bonus === 0`: returns `{ text: String(hard), font: 'font8', color: 'white' }`
 * - When `showBasePlusBonus === true`: `hard+bonus` (`x+y`) in `font6`
 *   - `hard <= 0`: returns `null`
 *   - `hard >= 1`: returns `{ text: `${hard}+${Math.max(0, bonus)}`, font: 'font6', color: bonus > 0 ? 'blue' : 'white' }`
 */
export function formatSkillSocketLabel(
  hard: number,
  bonus: number,
  showBasePlusBonus = false,
): SkillSocketLabel | null {
  if (hard <= 0) return null
  if (showBasePlusBonus) {
    const safeBonus = Math.max(0, bonus)
    return {
      text: `${hard}+${safeBonus}`,
      font: 'font6',
      color: safeBonus > 0 ? 'blue' : 'white',
    }
  }
  if (bonus > 0) {
    return { text: String(hard + bonus), font: 'font8', color: 'blue' }
  }
  return { text: String(hard), font: 'font8', color: 'white' }
}

/**
 * Authentic Diablo II v1.13c `data\global\palette\ACT1\pal.pl2` `textShifts[5]` (`nColor = 5`,
 * dark-gray `RGB(105, 105, 105)` palette remap table used by `D2Client.dll` `0x6FB28820`
 * `SKILLTREE_DrawSkillIcon` -> `D2Gdi.dll` `0x6F876580`).
 *
 * Encodes all 254 non-zero `ACT1/pal.pl2` palette entries (`indices 1..254`, 6 bytes each:
 * `[r, g, b, dr, dg, db]`) so baked skill icons (`public/skills/icon_<id>.png`) remap pixel-for-pixel
 * identically to 1.13c `gpPalette->textShifts[5]`.
 */
const ACT1_PL2_TEXT_SHIFT_5_B64 =
  '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'

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_LOOKUP = new Uint8Array(128)
for (let i = 0; i < B64_ALPHABET.length; i++) {
  B64_LOOKUP[B64_ALPHABET.charCodeAt(i)] = i
}

function buildAct1Pl2TextShift5Map(): ReadonlyMap<number, number> {
  const b64 = ACT1_PL2_TEXT_SHIFT_5_B64
  let pad = 0
  if (b64.endsWith('==')) pad = 2
  else if (b64.endsWith('=')) pad = 1
  const outLen = ((b64.length * 3) >> 2) - pad
  const bytes = new Uint8Array(outLen)
  let outIdx = 0
  for (let i = 0; i < b64.length; i += 4) {
    const triple =
      ((B64_LOOKUP[b64.charCodeAt(i)] ?? 0) << 18) |
      ((B64_LOOKUP[b64.charCodeAt(i + 1)] ?? 0) << 12) |
      ((B64_LOOKUP[b64.charCodeAt(i + 2)] ?? 0) << 6) |
      (B64_LOOKUP[b64.charCodeAt(i + 3)] ?? 0)
    if (outIdx < outLen) bytes[outIdx++] = (triple >> 16) & 0xff
    if (outIdx < outLen) bytes[outIdx++] = (triple >> 8) & 0xff
    if (outIdx < outLen) bytes[outIdx++] = triple & 0xff
  }
  const map = new Map<number, number>()
  for (let i = 0; i + 5 < bytes.length; i += 6) {
    const src = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!
    const dst = (bytes[i + 3]! << 16) | (bytes[i + 4]! << 8) | bytes[i + 5]!
    map.set(src, dst)
  }
  return map
}

const ACT1_PL2_TEXT_SHIFT_5_MAP: ReadonlyMap<number, number> = buildAct1Pl2TextShift5Map()

/**
 * Remaps an RGB pixel through 1.13c `ACT1/pal.pl2` `textShifts[5]` (`nColor = 5`, `RGB(105, 105, 105)`).
 * Falls back to `RGB(105, 105, 105)` luminance scaling (`105 / 255`) for non-palette synthetic colors.
 */
export function remapSkillIconPixelToTextShift5(
  r: number,
  g: number,
  b: number,
): readonly [number, number, number] {
  const key = ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
  const mapped = ACT1_PL2_TEXT_SHIFT_5_MAP.get(key)
  if (mapped !== undefined) {
    return [(mapped >> 16) & 0xff, (mapped >> 8) & 0xff, mapped & 0xff]
  }
  const maxC = Math.max(r & 0xff, g & 0xff, b & 0xff)
  const gray = Math.round((maxC * 105) / 255)
  return [gray, gray, gray]
}

export class SkillTreePanel {
  static formatSkillSocketLabel = formatSkillSocketLabel
  visible = false
  /**
   * Close `X` in the active class/tab socket with 1.13c button semantics: mouse-down
   * latches the depressed `buysellbtn.dc6` cell 11, the tree closes on mouse-up landing
   * back on the button (rect follows the per-class/per-tab socket position).
   */
  readonly closeButton = new PanelCloseButton(() => this.getCloseButtonBounds())
  lang: TblLang = 'CHI'
  showBasePlusBonusSkills = false
  /** Active skill tab: 2 = Cold (Top), 1 = Lightning (Middle), 0 = Fire (Bottom) for Sorceress. */
  activeTab: 0 | 1 | 2 = 2
  /** Server stat 5 (`newskills`). */
  unspentSkillPoints = 0
  /**
   * Generic `+all skills` soft points used only by the offline skill calculator state.
   * Online, per-skill bonuses come from the server (`0x21` UpdateSkill bonus byte) via `bonusLevels`.
   */
  bonusAllSkills = 0
  /** `null` until the server assigns the character class (no implicit Sorceress default). */
  characterClass: CharacterClassCode | null = null
  /** Server character level (stat 12); 0 = not yet received. */
  characterLevel = 0
  /** Hard (base) skill levels, rebuilt from the server skill list on every sync. */
  readonly hardPoints = new Map<number, number>()
  /** Per-skill bonus levels reported by the server (`0x21` bonus byte: +all/+class/+tab/+single). */
  readonly bonusLevels = new Map<number, number>()
  hoveredSkill: SkillNodeDef | null = null

  private tabBgs = new Map<number, HTMLImageElement>()
  private skillIcons = new Map<number, HTMLImageElement>()
  private dimmedSkillIcons = new Map<number, { source: HTMLImageElement; canvas: HTMLCanvasElement }>()
  private tabBgClass: CharacterClassCode | null = null

  constructor(initialClass?: CharacterClassCode) {
    if (initialClass) {
      this.setClass(initialClass)
    }
  }

  /** Register or override a skill icon image (used by runtime preloader and unit tests). */
  setSkillIcon(skillId: number, icon: HTMLImageElement): void {
    this.skillIcons.set(skillId, icon)
    this.dimmedSkillIcons.delete(skillId)
  }

  /** Underlying skill icon cache map (`skillId -> HTMLImageElement`), shared with `SkillHotkeysHud`. */
  getSkillIconsMap(): Map<number, HTMLImageElement> {
    return this.skillIcons
  }

  hasSkillIcon(skillId: number): boolean {
    return this.skillIcons.has(skillId)
  }

  getSkillIcon(skillId: number): HTMLImageElement | undefined {
    return this.skillIcons.get(skillId)
  }

  hasTabBackground(tab: 0 | 1 | 2): boolean {
    return this.tabBgs.has(tab) && this.tabBgClass === this.characterClass
  }

  /**
   * Authentic D2 v1.13c skill icon palette state (`D2Client.dll` `0x6FB28AA0` / `0x6FB28C50` -> `0x6FB28820`):
   * - When `unspentSkillPoints <= 0`: `hardPoints > 0` uses normal palette (`nColor = 0`), `hardPoints === 0` is dimmed (`nColor = 5`).
   * - When `unspentSkillPoints > 0`: allocatable (`canAllocate === true`) or learned (`hardPoints > 0`) uses normal palette (`nColor = 0`),
   *   and non-allocatable unlearned (`hardPoints === 0 && !canAllocate`) is dimmed (`nColor = 5`).
   */
  isSkillDimmed(skillId: number): boolean {
    const hard = this.getHardPoints(skillId)
    return hard === 0 && (this.unspentSkillPoints <= 0 || !this.canAllocate(skillId))
  }

  private getDimmedSkillIcon(
    skillId: number,
    icon: HTMLImageElement,
  ): HTMLCanvasElement | HTMLImageElement {
    const cached = this.dimmedSkillIcons.get(skillId)
    if (cached && cached.source === icon) {
      return cached.canvas
    }
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return icon
    }
    const canvas = document.createElement('canvas')
    if (!canvas || typeof canvas.getContext !== 'function') {
      return icon
    }
    const w = icon.naturalWidth || icon.width || 48
    const h = icon.naturalHeight || icon.height || 48
    canvas.width = w
    canvas.height = h
    const octx = canvas.getContext('2d')
    if (!octx) {
      return icon
    }
    octx.imageSmoothingEnabled = false
    octx.globalAlpha = 1.0
    octx.drawImage(icon, 0, 0, w, h)

    if (typeof octx.getImageData === 'function' && typeof octx.putImageData === 'function') {
      try {
        const imgData = octx.getImageData(0, 0, w, h)
        const d = imgData.data
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3]!
          if (a === 0) continue
          const [dr, dg, db] = remapSkillIconPixelToTextShift5(d[i]!, d[i + 1]!, d[i + 2]!)
          d[i] = dr
          d[i + 1] = dg
          d[i + 2] = db
          d[i + 3] = 255
        }
        octx.putImageData(imgData, 0, 0)
        this.dimmedSkillIcons.set(skillId, { source: icon, canvas })
        return canvas
      } catch {
        // Fall through to opaque dark-gray fallback when canvas is tainted or mock lacks pixel data
      }
    }

    octx.globalCompositeOperation = 'source-atop'
    octx.fillStyle = '#696969'
    octx.fillRect(0, 0, w, h)
    octx.globalCompositeOperation = 'source-over'
    this.dimmedSkillIcons.set(skillId, { source: icon, canvas })
    return canvas
  }

  formatSkillTooltipLines(skillId: number): FormattedTooltipLine[] {
    const vm = this.getTooltipViewModel(skillId)
    if (!vm) return []
    return SkillTreePanel.formatSkillTooltipLines(vm, this.lang, this.showBasePlusBonusSkills)
  }

  getSkillTree(): readonly SkillNodeDef[] {
    if (this.characterClass === null) return []
    const tree = CLASS_SKILL_TREES[this.characterClass]
    if (!tree) throw new Error(`SkillTreePanel: no skill tree for class '${this.characterClass}'`)
    return tree
  }

  getVerticalTabs(): readonly SkillTreeTabInfo[] {
    if (this.characterClass === null) return []
    const tabs = CLASS_VERTICAL_TABS[this.characterClass]
    if (!tabs) throw new Error(`SkillTreePanel: no tab layout for class '${this.characterClass}'`)
    return tabs
  }

  preloadAssets(): void {
    if (typeof Image === 'undefined') return
    if (this.characterClass === null) return
    for (const tab of [0, 1, 2]) {
      if (!this.tabBgs.has(tab) || this.tabBgClass !== this.characterClass) {
        const bg = new Image()
        bg.src = `/skills/bg_${this.characterClass}_${tab}.png`
        this.tabBgs.set(tab, bg)
      }
    }
    this.tabBgClass = this.characterClass
    for (const node of this.getSkillTree()) {
      if (!this.skillIcons.has(node.skillId)) {
        const icon = new Image()
        icon.src = `/skills/icon_${node.skillId}.png`
        this.skillIcons.set(node.skillId, icon)
      }
    }
  }

  setClass(classCode: CharacterClassCode): void {
    this.characterClass = classCode
    const vTabs = this.getVerticalTabs()
    this.activeTab = vTabs[0]?.tab ?? 0
    this.preloadAssets()
  }

  loadProfile(
    classCode: CharacterClassCode,
    hardPoints: Map<number, number>,
    unspent: number,
    activeTab?: 0 | 1 | 2,
  ): void {
    this.characterClass = classCode
    this.hardPoints.clear()
    for (const [id, pts] of hardPoints.entries()) {
      this.hardPoints.set(id, pts)
    }
    this.unspentSkillPoints = unspent
    const vTabs = this.getVerticalTabs()
    this.activeTab = activeTab !== undefined ? activeTab : (vTabs[0]?.tab ?? 0)
    this.preloadAssets()
  }

  getHardPoints(skillId: number): number {
    return this.hardPoints.get(skillId) ?? 0
  }

  /** Server-reported bonus levels for `skillId` (0 when none). */
  getBonusLevels(skillId: number): number {
    return this.bonusLevels.get(skillId) ?? 0
  }

  getEffectiveLevel(skillId: number): number {
    const hard = this.getHardPoints(skillId)
    const bonus = this.getBonusLevels(skillId) + this.bonusAllSkills
    return hard > 0 ? hard + bonus : 0
  }

  /**
   * Formats the skill tree level socket label as total effective skill level (`String(eff)`) or
   * `hard+bonus` (`x+y` when `showBasePlusBonusSkills` is enabled) when `hard >= 1`, or `""` when `hard === 0`.
   */
  formatSkillSocketLabel(skillId: number): string {
    const hard = this.getHardPoints(skillId)
    if (hard <= 0) return ''
    const eff = this.getEffectiveLevel(skillId)
    const label = formatSkillSocketLabel(
      hard,
      Math.max(0, eff - hard),
      this.showBasePlusBonusSkills,
    )
    return label ? label.text : ''
  }

  /** Skill calculator state; `null` while the class is not yet known. */
  getSkillCalcState(): SkillCalcState | null {
    if (this.characterClass === null) return null
    const hardPoints: Record<number, number> = {}
    for (const [id, pts] of this.hardPoints.entries()) {
      if (pts > 0) hardPoints[id] = pts
    }
    const specificSoftPoints: Record<number, number> = {}
    for (const [id, bonus] of this.bonusLevels.entries()) {
      // Equipment "+X to skill" grants apply at 0 hard points too (issue #848):
      // gating them on hardPoints hid the starting staff's +1 Firebolt from
      // skill tooltips as "0+0".
      if (bonus > 0) specificSoftPoints[id] = bonus
    }
    return {
      classCode: this.characterClass,
      hardPoints,
      tabSoftPoints: { 0: 0, 1: 0, 2: 0 },
      allSkillsSoftPoints: this.bonusAllSkills,
      specificSoftPoints,
    }
  }

  getTooltipViewModel(skillId: number): TooltipViewModel | null {
    const state = this.getSkillCalcState()
    if (!state) return null
    return buildTooltipViewModel(state, skillId, this.characterLevel)
  }

  /**
   * Whether the 1.13c client would send `AddSkillPoint (0x3B)` for `skillId`: unspent points, class tree
   * membership, `Skills.txt reqlevel` (+1 per hard point) against the real character level, and prerequisites.
   */
  canAllocate(skillId: number, charLevel: number = this.characterLevel, maxlvlOverride?: number): boolean {
    if (this.unspentSkillPoints <= 0) return false
    const node = this.getSkillTree().find(n => n.skillId === skillId)
    if (!node) return false
    const cur = this.getHardPoints(skillId)
    if (cur >= getSkillMaxLevel(skillId, maxlvlOverride)) return false
    if (charLevel < node.reqLevel + cur) return false
    return node.prereqs.every(p => this.getHardPoints(p) > 0)
  }

  static nodeScreenPos(node: SkillNodeDef): { x: number; y: number; w: number; h: number } {
    const colIdx = Math.max(0, Math.min(2, node.col - 1))
    const rowIdx = Math.max(0, Math.min(5, node.row - 1))
    const x = SKILL_PANEL_ORIGIN.x + (SKILL_TREE_COL_OFFSETS_X[colIdx] ?? (15 + colIdx * 69))
    const y = SKILL_PANEL_ORIGIN.y + (SKILL_TREE_ROW_OFFSETS_Y[rowIdx] ?? (14 + rowIdx * 68))
    return { x, y, w: 48, h: 48 }
  }

  /** Close-button socket for the active class/tab; `null` while the class is unknown. */
  getCloseButtonBounds(): { x: number; y: number; w: number; h: number } | null {
    if (this.characterClass === null) return null
    const offsets = SKILL_CLOSE_BTN_OFFSET_X[this.characterClass]
    const offsetX = offsets[this.activeTab]
    return {
      x: SKILL_PANEL_ORIGIN.x + offsetX,
      y: SKILL_PANEL_ORIGIN.y + 385,
      w: 32,
      h: 32,
    }
  }

  handleMouseMove(logicalX: number, logicalY: number): void {
    this.hoveredSkill = null
    if (!this.visible) return
    const tabNodes = this.getSkillTree().filter(n => n.tab === this.activeTab)
    for (const node of tabNodes) {
      const r = SkillTreePanel.nodeScreenPos(node)
      if (logicalX >= r.x && logicalX <= r.x + r.w && logicalY >= r.y && logicalY <= r.y + r.h) {
        this.hoveredSkill = node
        return
      }
    }
  }

  handleClick(logicalX: number, logicalY: number, onSkillAllocated?: (skillId: number) => void): boolean {
    if (!this.visible) return false
    if (logicalX < 400) return false

    // Close button (authentic per-class/per-tab 32x32 stone socket at y = oy + 385) —
    // press only latches the depressed cell; the tree closes on mouse-up landing back
    // on the button (see `handleMouseUp`).
    const closeBounds = this.getCloseButtonBounds()
    if (
      closeBounds &&
      logicalX >= closeBounds.x &&
      logicalX <= closeBounds.x + closeBounds.w &&
      logicalY >= closeBounds.y &&
      logicalY <= closeBounds.y + closeBounds.h
    ) {
      this.closeButton.press(logicalX, logicalY)
      return true
    }

    // Right vertical tabs (`x = 630..720`, full 90px tab column `ox + 230..320`)
    if (logicalX >= SKILL_PANEL_ORIGIN.x + 230 && logicalX <= SKILL_PANEL_ORIGIN.x + 320) {
      const vTabs = this.getVerticalTabs()
      if (logicalY >= 60 + 95 && logicalY < 60 + 195 && vTabs[0]) {
        this.activeTab = vTabs[0].tab
        return true
      }
      if (logicalY >= 60 + 195 && logicalY < 60 + 295 && vTabs[1]) {
        this.activeTab = vTabs[1].tab
        return true
      }
      if (logicalY >= 60 + 295 && logicalY <= 60 + 432 && vTabs[2]) {
        this.activeTab = vTabs[2].tab
        return true
      }
    }

    // Skill nodes
    const tabNodes = this.getSkillTree().filter(n => n.tab === this.activeTab)
    for (const node of tabNodes) {
      const r = SkillTreePanel.nodeScreenPos(node)
      if (logicalX >= r.x && logicalX <= r.x + r.w && logicalY >= r.y && logicalY <= r.y + r.h) {
        // Server-authoritative: request `AddSkillPoint (0x3B)` only; levels arrive via 0x21/0x94.
        if (this.canAllocate(node.skillId)) {
          onSkillAllocated?.(node.skillId)
        }
        return true
      }
    }

    return true
  }

  /**
   * Mouse-up over the tree: closes the panel only when the release lands back on the
   * pressed close `X` — dragging off the button and releasing cancels the close.
   */
  handleMouseUp(logicalX: number, logicalY: number): boolean {
    const triggered = this.closeButton.release(logicalX, logicalY) && this.visible
    if (triggered) this.visible = false
    return triggered
  }

  draw(
    ctx: CanvasRenderingContext2D,
    assets: {
      borderRightImg: HTMLImageElement | null
      skillPointsImg: HTMLImageElement | null
      buySellBtnImg: HTMLImageElement | null
      skillTabsImg?: HTMLImageElement | null
    },
    font: D2FontRenderer,
    skipTooltip = false,
  ): void {
    if (!this.visible) return
    if (this.skillIcons.size === 0 && this.characterClass !== null) {
      this.preloadAssets()
    }

    // 1. Draw 800x600 Right Gothic Border (`800BorderFrame.dc6` frames 5..9) at (400, 0)
    if (assets.borderRightImg) {
      ctx.drawImage(assets.borderRightImg, 400, 0)
    }

    const ox = SKILL_PANEL_ORIGIN.x
    const oy = SKILL_PANEL_ORIGIN.y

    // 2. Draw 256x432 Skill Tree Tab Background (`bg_sor_<tab>.png`)
    const bg = this.tabBgs.get(this.activeTab)
    const hasBg = Boolean(bg && bg.complete && bg.naturalWidth > 0)
    if (hasBg && bg) {
      ctx.drawImage(bg, ox, oy, 256, 432)
    } else {
      reportMissingArt(
        'ui-panel',
        `skltree_bg_${this.characterClass}_${this.activeTab}`,
        `Missing skill tree background for class=${this.characterClass} tab=${this.activeTab}`,
      )
    }

    // 3. Draw Right 64x432 Vertical Tab Column (`x = 656..720`)
    const verticalTabs = this.getVerticalTabs()
    const tabColIdx = verticalTabs.findIndex(vt => vt.tab === this.activeTab)
    const safeColIdx = tabColIdx >= 0 ? tabColIdx : 0

    const hasTabsImg = Boolean(
      assets.skillTabsImg && assets.skillTabsImg.complete && assets.skillTabsImg.naturalWidth > 0,
    )
    if (hasTabsImg && assets.skillTabsImg) {
      ctx.drawImage(assets.skillTabsImg, safeColIdx * 64, 0, 64, 432, ox + 256, oy, 64, 432)
    } else {
      reportMissingArt(
        'ui-panel',
        `skltree_tabs_${this.characterClass}`,
        `Missing skill tree vertical tabs image for class=${this.characterClass}`,
      )
    }

    const isEn = this.lang === 'ENG'

    // Remaining Skill Points Header Plaque (D2Client.dll 0x6FB52120..0x6FB52240: StrSklTree1 / StrSklTree2 / StrSklTree3)
    font.drawText(ctx, resolveSkillTreeTbl('StrSklTree1', this.lang), ox + 276, oy + 26, {
      font: 'font8',
      color: 'gold',
      align: 'center',
    })
    font.drawText(ctx, resolveSkillTreeTbl('StrSklTree2', this.lang), ox + 276, oy + 38, {
      font: 'font8',
      color: 'gold',
      align: 'center',
    })
    font.drawText(ctx, resolveSkillTreeTbl('StrSklTree3', this.lang), ox + 276, oy + 50, {
      font: 'font8',
      color: 'gold',
      align: 'center',
    })
    font.drawText(ctx, String(this.unspentSkillPoints), ox + 276, oy + 78, {
      font: 'font16',
      color: this.unspentSkillPoints > 0 ? 'red' : 'white',
      align: 'center',
    })

    // 3 Vertical Tabs for Active Class (90px column x=230..319, center ox + 275)
    for (const vt of verticalTabs) {
      const active = this.activeTab === vt.tab
      const title = isEn ? vt.titleEn : vt.titleZh
      const sub = isEn ? vt.subEn : vt.subZh
      if (sub) {
        font.drawText(ctx, title, ox + 275, oy + vt.y + 52, {
          font: 'fontexocet10',
          color: active ? 'gold' : 'tan',
          align: 'center',
        })
        font.drawText(ctx, sub, ox + 275, oy + vt.y + 72, {
          font: 'fontexocet10',
          color: active ? 'gold' : 'tan',
          align: 'center',
        })
      } else {
        font.drawText(ctx, title, ox + 275, oy + vt.y + 62, {
          font: 'fontexocet10',
          color: active ? 'gold' : 'tan',
          align: 'center',
        })
      }
    }

    // 4. Draw Skill Nodes & Level Sockets on Active Tab
    const tabNodes = this.getSkillTree().filter(n => n.tab === this.activeTab)
    for (const node of tabNodes) {
      const pos = SkillTreePanel.nodeScreenPos(node)
      const hard = this.getHardPoints(node.skillId)
      const eff = this.getEffectiveLevel(node.skillId)
      const icon = this.skillIcons.get(node.skillId)

      if (icon && icon.complete && icon.naturalWidth > 0) {
        const isDimmed = hard === 0 && (this.unspentSkillPoints <= 0 || !this.canAllocate(node.skillId))
        const drawImg = isDimmed ? this.getDimmedSkillIcon(node.skillId, icon) : icon
        ctx.save()
        ctx.globalAlpha = 1.0
        ctx.drawImage(drawImg, pos.x, pos.y, 48, 48)
        ctx.restore()
      } else if (!icon || icon.complete) {
        reportMissingArt('ui-skill-icon', String(node.skillId), `Skill icon image missing for skillId=${node.skillId}`)
      }

      if (this.hoveredSkill?.skillId === node.skillId) {
        ctx.strokeStyle = '#e8c26b'
        ctx.lineWidth = 2
        ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, 47, 47)
      }

      // Level socket: built-in DC6 stone socket has dark interior at pos.x + 42..60, pos.y + 50..60.
      // Authentic D2 v1.13c displays the total effective skill level in font8 (blue when boosted by
      // equipment/skill bonuses, white when unboosted), or leaves the socket empty when unlearned.
      const socketLabel = formatSkillSocketLabel(
        hard,
        Math.max(0, eff - hard),
        this.showBasePlusBonusSkills,
      )
      if (socketLabel) {
        if (this.showBasePlusBonusSkills && socketLabel.text.length >= 3) {
          const textW =
            typeof font?.measureText === 'function'
              ? font.measureText(socketLabel.text, socketLabel.font)
              : socketLabel.text.length * 6
          const pillW = Math.max(20, textW + 6)
          ctx.fillStyle = 'rgba(6, 6, 6, 0.82)'
          ctx.fillRect(Math.round(pos.x + 51 - pillW / 2), pos.y + 49, pillW, 12)
        }
        font.drawText(ctx, socketLabel.text, pos.x + 51, pos.y + 59, {
          font: socketLabel.font,
          color: socketLabel.color,
          align: 'center',
        })
      }
    }

    // 5. Close Button (`buysellbtn.dc6` frame 10 raised / 11 pressed while held down,
    //    in the authentic per-tab 32x32 DC6 stone socket)
    const closeBounds = this.getCloseButtonBounds()
    if (assets.buySellBtnImg && closeBounds) {
      ctx.drawImage(
        assets.buySellBtnImg,
        this.closeButton.frame() * 32,
        0,
        32,
        32,
        closeBounds.x,
        closeBounds.y,
        32,
        32,
      )
    }

    // 6. Hover Tooltip for Skill Node
    if (this.hoveredSkill && !skipTooltip) {
      this.drawSkillTooltip(ctx, font)
    }
  }

  static formatSkillTooltipLines(
    vm: TooltipViewModel,
    lang: TblLang = 'CHI',
    showBasePlusBonus = false,
  ): FormattedTooltipLine[] {
    const lines: FormattedTooltipLine[] = []
    const isEn = lang === 'ENG'
    const tbl = SKILL_TBL_STRINGS[lang]

    // 1. Title: Skill Name in Gold (#c8a15a, fontexocet10, center)
    lines.push({
      text: isEn ? vm.skill.name : (vm.skill.nameZh || vm.skill.name),
      color: 'gold',
      font: 'fontexocet10',
      align: 'center',
    })

    // 2. Requirements: Red (#ff4d4d) if player level < reqlevel or unmet prereqs
    if (!vm.levelMet) {
      lines.push({
        text: `${tbl.StrSkill18}${isEn ? ' ' : ''}${vm.reqlevel}`,
        color: 'red',
        font: 'font8',
        align: 'center',
      })
    }
    for (const prereq of vm.prereqs) {
      if (!prereq.met) {
        lines.push({
          text: isEn ? `Required Skill: ${prereq.name}` : `需要前置技能: ${prereq.nameZh}`,
          color: 'red',
          font: 'font8',
          align: 'center',
        })
      }
    }

    // 3. Narrative: Short/Long description in White (#e8e4dc, font8)
    const desc = isEn
      ? (vm.skill.shortDesc || vm.shortDesc || vm.skill.longDesc || vm.longDesc)
      : (vm.skill.shortDescZh || vm.shortDescZh || vm.skill.longDescZh || vm.longDescZh)
    if (desc) {
      lines.push({
        text: desc,
        color: 'white',
        font: 'font8',
        align: 'center',
      })
    }

    // 4. Current Level / First Level header (StrSkill2 / StrSkill17)
    if (vm.isLearned) {
      const soft = Math.max(0, vm.effectiveLevel - vm.hardPoints)
      const levelText = showBasePlusBonus
        ? `${vm.effectiveLevel} (${vm.hardPoints}+${soft})`
        : String(vm.effectiveLevel)
      lines.push({
        text: `${tbl.StrSkill2}${levelText}`,
        color: soft > 0 ? 'blue' : 'white',
        font: 'font8',
        align: 'center',
      })
    } else {
      lines.push({
        text: tbl.StrSkill17,
        color: 'white',
        font: 'font8',
        align: 'center',
      })
    }

    // 5. Current Stats: Mana cost, damage ranges, duration, and effects
    if (vm.current.manaCost > 0 || vm.skill.mana > 0) {
      lines.push({
        text: `${tbl.StrSkill3}${vm.current.manaCost}`,
        color: 'white',
        font: 'font8',
        align: 'center',
      })
    }
    if (vm.current.effects.length === 0 && vm.current.damage.hasDamage) {
      const d = vm.current.damage
      lines.push({
        text: isEn
          ? `${formatDamageTypeEn(d.type)}: ${d.finalMin} - ${d.finalMax}`
          : `${d.typeZh || '傷害'}: ${d.finalMin} - ${d.finalMax}`,
        color: 'blue',
        font: 'font8',
        align: 'center',
      })
      if (d.durationSeconds !== undefined && d.durationSeconds > 0) {
        lines.push({
          text: isEn ? `Duration: ${d.durationSeconds} sec` : `持續時間: ${d.durationSeconds} 秒`,
          color: 'white',
          font: 'font8',
          align: 'center',
        })
      }
      if (d.weaponDamagePercent !== undefined && d.weaponDamagePercent > 0) {
        lines.push({
          text: isEn ? `Weapon Damage: ${d.weaponDamagePercent}%` : `武器傷害: ${d.weaponDamagePercent}%`,
          color: 'white',
          font: 'font8',
          align: 'center',
        })
      }
    }
    for (const eff of vm.current.effects) {
      const effText = isEn ? eff.textEn : eff.textZh
      if (effText) {
        lines.push({
          text: effText,
          color: 'blue',
          font: 'font8',
          align: 'center',
        })
      }
    }

    // 6. Next Level Preview: Header StrSkill1 ("Next Level" / "下一等級") in Green, omitted if unlearned or maxed
    const maxLvl = getSkillMaxLevel(vm.skill.id)
    if (vm.nextLevel && vm.isLearned && vm.hardPoints < maxLvl) {
      lines.push({
        text: tbl.StrSkill1,
        color: 'green',
        font: 'font8',
        align: 'center',
      })
      if (vm.nextLevel.manaCost !== vm.current.manaCost) {
        lines.push({
          text: `${tbl.StrSkill3}${vm.nextLevel.manaCost}`,
          color: 'green',
          font: 'font8',
          align: 'center',
        })
      }
      if (vm.nextLevel.effects.length === 0 && vm.nextLevel.damage.hasDamage) {
        const nd = vm.nextLevel.damage
        lines.push({
          text: isEn
            ? `${formatDamageTypeEn(nd.type)}: ${nd.finalMin} - ${nd.finalMax}`
            : `${nd.typeZh || '傷害'}: ${nd.finalMin} - ${nd.finalMax}`,
          color: 'green',
          font: 'font8',
          align: 'center',
        })
        if (nd.durationSeconds !== undefined && nd.durationSeconds > 0 && nd.durationSeconds !== vm.current.damage.durationSeconds) {
          lines.push({
            text: isEn ? `Duration: ${nd.durationSeconds} sec` : `持續時間: ${nd.durationSeconds} 秒`,
            color: 'green',
            font: 'font8',
            align: 'center',
          })
        }
        if (nd.weaponDamagePercent !== undefined && nd.weaponDamagePercent !== vm.current.damage.weaponDamagePercent) {
          lines.push({
            text: isEn ? `Weapon Damage: ${nd.weaponDamagePercent}%` : `武器傷害: ${nd.weaponDamagePercent}%`,
            color: 'green',
            font: 'font8',
            align: 'center',
          })
        }
      }
      for (const eff of vm.nextLevel.effects) {
        const effText = isEn ? eff.textEn : eff.textZh
        if (effText) {
          lines.push({
            text: effText,
            color: 'green',
            font: 'font8',
            align: 'center',
          })
        }
      }
    }

    // 7. Synergies Section: canonical .tbl Sksyn ("%s Receives Bonuses From:" / "額外的對%s")
    if (vm.synergiesReceived && vm.synergiesReceived.length > 0) {
      const skillTitle = isEn ? vm.skill.name : (vm.skill.nameZh || vm.skill.name)
      lines.push({
        text: tbl.Sksyn.replace('%s', skillTitle),
        color: 'white',
        font: 'font8',
        align: 'center',
      })
      for (const syn of vm.synergiesReceived) {
        const text = isEn
          ? (syn.labelEn || `${syn.providerName}: +${syn.percentPerLevel}% Damage per Level`)
          : (syn.labelZh || `${syn.providerNameZh}: +${syn.percentPerLevel}% 每等級傷害`)
        lines.push({
          text,
          color: syn.hardPoints > 0 ? 'blue' : 'gray',
          font: 'font8',
          align: 'center',
        })
      }
    }
    if (vm.masteryInfo && vm.masteryInfo.active) {
      lines.push({
        text: isEn ? vm.masteryInfo.descriptionEn : vm.masteryInfo.descriptionZh,
        color: 'blue',
        font: 'font8',
        align: 'center',
      })
    }

    return lines
  }

  static computeTooltipPlacement(
    pos: { x: number; y: number; w: number; h: number },
    lines: readonly FormattedTooltipLine[],
    font: D2FontRenderer,
    minLocalX = 8,
  ): { x: number; y: number; w: number; h: number } {
    const maxLineWidth = lines.reduce((max, l) => {
      const w = typeof font?.measureText === 'function' ? font.measureText(l.text, l.font) : l.text.length * 8
      return Math.max(max, w)
    }, 0)
    const boxW = Math.max(240, maxLineWidth + 28)
    const boxH = lines.length * 17 + 24
    const rawX = pos.x - boxW - 8
    const clampedX = Math.max(minLocalX, Math.min(800 - boxW - 8, rawX))
    const rawY = Math.round(pos.y + 24 - boxH / 2)
    const clampedY = Math.max(8, Math.min(552 - boxH, rawY))
    return { x: clampedX, y: clampedY, w: boxW, h: boxH }
  }

  drawSkillTooltip(ctx: CanvasRenderingContext2D, font: D2FontRenderer, minLocalX = 8): void {
    if (!this.hoveredSkill) return
    const pos = SkillTreePanel.nodeScreenPos(this.hoveredSkill)
    const vm = this.getTooltipViewModel(this.hoveredSkill.skillId)
    if (!vm) return

    const lines = SkillTreePanel.formatSkillTooltipLines(
      vm,
      this.lang,
      this.showBasePlusBonusSkills,
    )
    if (lines.length === 0) return

    const placement = SkillTreePanel.computeTooltipPlacement(pos, lines, font, minLocalX)

    ctx.fillStyle = 'rgba(4, 4, 4, 0.94)'
    ctx.fillRect(placement.x, placement.y, placement.w, placement.h)
    ctx.strokeStyle = '#8c7244'
    ctx.lineWidth = 1
    ctx.strokeRect(placement.x + 0.5, placement.y + 0.5, placement.w - 1, placement.h - 1)

    lines.forEach((l, idx) => {
      const lineY = placement.y + 12 + 10 + idx * 17
      const lineX = l.align === 'center' ? placement.x + Math.round(placement.w / 2) : placement.x + 14
      font.drawText(ctx, l.text, lineX, lineY, {
        font: l.font,
        color: l.color,
        align: l.align ?? 'center',
      })
    })
  }
}
