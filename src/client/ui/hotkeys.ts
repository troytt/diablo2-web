/**
 * Diablo II v1.13c Skill Hotkeys & Speedbar Popup (`spellsel.cpp`).
 *
 * Per D2Client.dll 0x6fad7440..0x6fad7536:
 * - Frame 0 ends at x=117 and Frame 1 begins at x=165 -> 48x48 Left-Click Skill Slot at (117, 551)
 * - Frame 4 ends at x=635 and Frame 5 begins at x=683 -> 48x48 Right-Click Skill Slot at (635, 551)
 * - Clicking either slot opens the upward-expanding Speedbar grid of available skills
 * - Pressing F1..F8 while hovering a skill in the Speedbar binds that F-key; pressing F1..F8
 *   during gameplay switches the bound side's active skill immediately.
 */

import type { D2FontRenderer, D2ColorCode } from './font.ts'
import type { CharacterClassCode } from '../../common/units/classes.ts'
import { SKILLS_BY_ID } from '../../common/data/skills-catalog.ts'
import { buildTooltipViewModel, calculateManaCost, createInitialState, type TooltipViewModel } from '../../common/skills/skill-calc-engine.ts'
import { CLASS_SKILL_TREES, formatDamageTypeEn, type FormattedTooltipLine } from './skill-tree-panel.ts'
import type { TblLang } from '../i18n/lang.ts'
import { reportMissingArt } from '../../client/scene/world-renderer.ts'

import {
  PASSIVE_SKILL_IDS,
  isPassiveSkill,
  LEFT_USABLE_SKILL_IDS,
  isLeftUsableSkill,
  PALADIN_AURA_SKILL_IDS,
  isAuraSkill,
  SKILLS_TABLE_META,
  SKILL_TBL_STRINGS,
  GENERIC_SKILL_TBL_STRINGS,
  getSkillName,
  getGenericSkillLongDesc,
  getCanonicalSkillListRow,
  getCanonicalSkillIconCel,
  canUseSkillInMorphState,
  canUseSkillWithWeapon,
  RESTRICT_STATE_IDS_113C,
  type WeaponEquipCheckState,
  type HotkeySkillEntry,
} from '../../common/skills/skills-meta.ts'

export {
  PASSIVE_SKILL_IDS,
  isPassiveSkill,
  LEFT_USABLE_SKILL_IDS,
  isLeftUsableSkill,
  PALADIN_AURA_SKILL_IDS,
  isAuraSkill,
  canUseSkillInMorphState,
  canUseSkillWithWeapon,
  RESTRICT_STATE_IDS_113C,
  type WeaponEquipCheckState,
  type HotkeySkillEntry,
}

/**
 * Enhancement (not in 1.13c): skills the equipment grants that the vanilla Speedbar never lists —
 * - `item-aura`: `item_aura` (stat 151) auras. Same-aura grants from several items stack; the level is the item
 *   level only (never raised by `+All Skills` / `+Class Skills` / oskills).
 * - `item-passive`: non-class passive skills from `item_nonclassskill` (stat 97, oskill); the level includes the
 *   equipment / state `+All Skills` (and tab / elemental) bonuses that `SKILLS_GetSkillLevel` applies to oskills.
 * They are shown in a dedicated, display-only Speedbar row: no selection, no F-key binding.
 */
export interface GrantedSkillEntry {
  readonly skillId: number
  readonly level: number
  readonly kind: 'item-aura' | 'item-passive'
  readonly name: string
  readonly nameZh: string
}

export interface SkillIconMapping {
  readonly skillId: number
  readonly name: string
  readonly iconPath: string
  readonly isGeneric: boolean
  readonly dc6Path: string
  readonly dc6Source: string
  readonly frameIndex: number
  readonly atlasRect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly w?: number; readonly h?: number }
}

/**
 * Resolves authentic icon mapping for skillId from `skilldesc.txt` `IconCel`
 * (Skillicon.DC6 frame 2 for Attack #0 regardless of weapon state, frame 6 for Throw #2,
 * frame 4 for Unsummon #3, frame 12 for Left Hand Throw #4, frame 14 for Identify #217/#218,
 * frame 18 for Townportal #219/#220).
 */
export function resolveSkillIcon(skillId: number, _hasWeapon = true): SkillIconMapping {
  if (skillId in GENERIC_SKILL_TBL_STRINGS) {
    const iconCel = getCanonicalSkillIconCel(skillId)
    const name = getSkillName(skillId, 'ENG')
    return {
      skillId,
      name,
      iconPath: `/skills/icon_${skillId}.png`,
      isGeneric: true,
      dc6Path: 'data/global/ui/SPELLS/Skillicon.DC6',
      dc6Source: 'data/global/ui/SPELLS/Skillicon.DC6',
      frameIndex: iconCel,
      atlasRect: { x: iconCel * 48, y: 0, width: 48, height: 48, w: 48, h: 48 },
    }
  }
  const meta = SKILLS_TABLE_META[skillId]
  return {
    skillId,
    name: getSkillName(skillId, 'ENG'),
    iconPath: `/skills/icon_${skillId}.png`,
    isGeneric: false,
    dc6Path: '',
    dc6Source: '',
    frameIndex: meta ? meta.iconCel : skillId,
    atlasRect: { x: 0, y: 0, width: 48, height: 48, w: 48, h: 48 },
  }
}

/**
 * Resolves authentic 1.13c `ListRow` for Speedbar popup (`-1..4`) from `skilldesc.txt`.
 * - Row -1: Excluded from speedbar (Kick #1, Left Hand Swing #5)
 * - Row 0 (bottom): Basic universal actions (Attack #0, Throw #2, Unsummon #3, Left Hand Throw #4)
 * - Rows 1..3: Character skill tree tabs
 * - Row 4 (top): Item skills (Scrolls/Books of TP & ID #217..#220, or items with charges)
 * Fails fast if an unknown skill has no `skilldesc` entry and is not an item skill.
 */
export function getSkillListRow(skill: HotkeySkillEntry): number {
  if (typeof (skill as { listRow?: unknown }).listRow === 'number') {
    return (skill as { listRow: number }).listRow
  }
  const id = skill.skillId
  if (
    id === 217 ||
    id === 218 ||
    id === 219 ||
    id === 220 ||
    Boolean((skill as { isItemSkill?: boolean }).isItemSkill) ||
    skill.charges !== undefined
  ) {
    return 4
  }
  if (id in SKILLS_TABLE_META) {
    return getCanonicalSkillListRow(id, false)
  }
  if (typeof (skill as { tabIndex?: unknown }).tabIndex === 'number') {
    return (skill as { tabIndex: number }).tabIndex + 1
  }
  if ((skill as { isGeneric?: boolean }).isGeneric) {
    return 0
  }
  return getCanonicalSkillListRow(id, false)
}

/**
 * Resolves requirement level (reqlevel) for intra-row sorting in Speedbar popup.
 */
export function getSkillReqLevel(skill: HotkeySkillEntry): number {
  if (typeof (skill as { reqlevel?: unknown }).reqlevel === 'number') {
    return (skill as { reqlevel: number }).reqlevel
  }
  const catalogEntry = SKILLS_BY_ID[skill.skillId]
  if (catalogEntry && typeof catalogEntry.reqlevel === 'number') {
    return catalogEntry.reqlevel
  }
  return 1
}

/**
 * Builds a canonical `HotkeySkillEntry` for a generic or item skill (`#0..#5`, `#217..#220`, `#350`).
 * Returns `null` for class skills (`6..280` outside `GENERIC_SKILL_TBL_STRINGS`).
 */
export function createCanonicalGenericSkillEntry(
  skillId: number,
  levelOrCharges?: number,
  chargesArg?: number,
): HotkeySkillEntry | null {
  if (!(skillId in GENERIC_SKILL_TBL_STRINGS)) {
    return null
  }
  const isScrollOrTome = skillId >= 217 && skillId <= 220
  const resolvedCharges =
    chargesArg !== undefined
      ? chargesArg
      : isScrollOrTome && levelOrCharges !== undefined
        ? levelOrCharges
        : undefined
  const meta = getCanonicalSkillListRow(skillId, resolvedCharges !== undefined && isScrollOrTome)
  const entry: HotkeySkillEntry = {
    skillId,
    name: getSkillName(skillId, 'ENG'),
    nameZh: getSkillName(skillId, 'CHI'),
    level: 1,
    manaCost: 0,
    leftUsable: isLeftUsableSkill(skillId),
    rightUsable: !isPassiveSkill(skillId),
    listRow: meta,
    reqlevel: 1,
    ...(resolvedCharges !== undefined ? { charges: resolvedCharges } : {}),
    ...(isScrollOrTome ? { isItemSkill: true } : {}),
  }
  return entry
}

/**
 * Ensures Default Attack (`#0`) is always present in a player's skill list so the player can
 * always switch back to normal Attack from the speedbar.
 */
export function ensureDefaultAttackSkill(skills: readonly HotkeySkillEntry[]): HotkeySkillEntry[] {
  if (skills.some(s => s.skillId === 0)) {
    return [...skills]
  }
  return [createCanonicalGenericSkillEntry(0)!, ...skills]
}

export function getAvailableSkillsForSide(
  side: 'left' | 'right',
  skills: readonly HotkeySkillEntry[],
  weaponState?: WeaponEquipCheckState,
): readonly HotkeySkillEntry[] {
  return ensureDefaultAttackSkill(skills).filter(s => {
    if (isPassiveSkill(s.skillId) || s.isPassive) return false
    const row = getSkillListRow(s)
    if (row < 0) return false
    if ((s.skillId === 2 || s.skillId === 4) && !canUseSkillWithWeapon(s.skillId, weaponState)) {
      return false
    }
    if (side === 'left') {
      if (isAuraSkill(s.skillId) || s.isAura) return false
      if (!isLeftUsableSkill(s.skillId)) return false
      return s.leftUsable !== false
    } else {
      return s.rightUsable !== false
    }
  })
}

export const LEFT_SKILL_BOUNDS = { x: 117, y: 552, width: 48, height: 48 } as const
export const RIGHT_SKILL_BOUNDS = { x: 635, y: 552, width: 48, height: 48 } as const

export const LEFT_SKILL_BOUNDS_640 = { x: 117, y: 432, width: 48, height: 48 } as const
export const RIGHT_SKILL_BOUNDS_640 = { x: 475, y: 432, width: 48, height: 48 } as const

/**
 * Normalize a skill owner GUID: `undefined` / `0xFFFFFFFF` (1.13c `dwOwnerGUID == -1`) = the player's own skill.
 */
export function normalizeSkillItemId(itemId: number | undefined | null): number | undefined {
  if (itemId === undefined || itemId === null) return undefined
  const v = itemId >>> 0
  return v === 0xffffffff ? undefined : v
}

/** Owner argument for an entry: explicit GUID for charged copies, `0xFFFFFFFF` for the player's own skill. */
function skillOwnerArg(entry: HotkeySkillEntry): number | undefined {
  if (entry.itemId !== undefined) return entry.itemId
  return entry.isItemSkill ? undefined : 0xffffffff
}

export class SkillHotkeysHud {
  lang: TblLang = 'CHI'
  is640 = false
  /** Active left/right skill; mirrors server `0x23 AssignSkill` (0 = Attack until the server says otherwise). */
  leftSkillId = 0
  rightSkillId = 0
  /**
   * Owning item GUID of the active left/right skill (`0x23 AssignSkill` @+7). `undefined` = the player's own
   * (native) skill (`pSkill->dwOwnerGUID == -1`); a GUID = an item-granted charged skill node.
   */
  leftSkillItemId: number | undefined = undefined
  rightSkillItemId: number | undefined = undefined
  /** Which Speedbar popup is currently expanded ('left', 'right', or null). */
  openPopup: 'left' | 'right' | null = null
  /** Hovered skill inside the Speedbar popup. */
  hoveredPopupSkill: { side: 'left' | 'right'; skillId: number; itemId?: number | undefined } | null = null
  /** Equipment-granted item auras / non-class passives (display-only Speedbar row, see {@link GrantedSkillEntry}). */
  grantedSkills: readonly GrantedSkillEntry[] = []
  /** Hovered cell of the granted row (never bindable, never selectable). */
  hoveredGrantedSkill: { side: 'left' | 'right'; skillId: number; kind: GrantedSkillEntry['kind'] } | null = null
  /** Currently hovered skill ID in left or right slot. */
  hoverSkillId: number | null = null
  /** Currently hovered skill ID inside speedbar. */
  hoverSpeedbarSkillId: number | null = null
  /** Currently hovered slot on the control panel ('left' | 'right' | null). */
  hoveredSlot: 'left' | 'right' | null = null
  /** Optional custom tooltip resolver returning TooltipViewModel from the skill engine. */
  tooltipResolver?: ((skillId: number) => TooltipViewModel | null) | undefined

  get leftSkillBounds(): { x: number; y: number; width: number; height: number } {
    return this.is640 ? LEFT_SKILL_BOUNDS_640 : LEFT_SKILL_BOUNDS
  }

  get rightSkillBounds(): { x: number; y: number; width: number; height: number } {
    return this.is640 ? RIGHT_SKILL_BOUNDS_640 : RIGHT_SKILL_BOUNDS
  }

  get selectionOpen(): 'left' | 'right' | null {
    return this.openPopup
  }
  set selectionOpen(val: 'left' | 'right' | null) {
    this.openPopup = val
  }

  /** F1..F8 bindings (`F1`..'F8' -> `{ side, skillId, itemId }`). */
  readonly bindings = new Map<string, { side: 'left' | 'right'; skillId: number; itemId?: number | undefined }>()

  /** Quickbar skills; rebuilt from the server skill list by `HudModel.syncFromWorld()`. */
  availableSkills: HotkeySkillEntry[] = []
  /**
   * Server-authoritative skill selection sink. When set (online), popup clicks and F-keys only request
   * `SelectSkill (0x3C)`; the active slots change when the server answers with `0x23 AssignSkill`.
   */
  onSelectSkill?: ((side: 'left' | 'right', skillId: number, itemId?: number) => void) | undefined
  /**
   * Callback invoked when a skill hotkey slot (0..15) is bound in the Speedbar popup (`0x51 AssignSkillHotkey`).
   */
  onAssignHotkey?: ((slot: number, side: 'left' | 'right', skillId: number, itemId?: number) => void) | undefined
  hasEquippedWeapon = true
  /** Optional current player mana for 1.13c insufficient-mana skill icon tinting (0x6fb565c0). */
  currentMana: number | null = null
  showBasePlusBonusSkills = false
  swordImage: HTMLImageElement | null = null
  private iconImages = new Map<number, HTMLImageElement>()
  private cooldowns = new Map<number, { untilMs: number; totalMs: number }>()
  private globalSkillDelayUntilMs = 0
  private skillCharges = new Map<number, { charges: number; maxCharges?: number | undefined }>()

  /**
   * Exact `(skillId, owner)` lookup. 1.13c keeps the player's own skill (`dwOwnerGUID == -1`) and every
   * item-granted charged copy as separate `D2SkillStrc` nodes (`D2Common.#10952` `SKILLS_GetSkillById(pUnit, id, guid)`),
   * so a native entry and a charged entry of the same skillId never alias.
   */
  findSkillEntry(skillId: number, itemId?: number): HotkeySkillEntry | undefined {
    const owner = normalizeSkillItemId(itemId)
    return this.availableSkills.find(s => s.skillId === skillId && normalizeSkillItemId(s.itemId) === owner)
  }

  /** The player's own (non item-granted) entry for `skillId`, if learned / granted by +skills. */
  findNativeSkillEntry(skillId: number): HotkeySkillEntry | undefined {
    return this.availableSkills.find(
      s => s.skillId === skillId && normalizeSkillItemId(s.itemId) === undefined && !s.isItemSkill && (s.level ?? 0) > 0,
    )
  }

  /** A live (charges > 0) item-granted charged entry for `skillId`; `itemId` restricts it to that owner. */
  findChargedSkillEntry(skillId: number, itemId?: number): HotkeySkillEntry | undefined {
    const owner = normalizeSkillItemId(itemId)
    return this.availableSkills.find(
      s =>
        s.skillId === skillId &&
        normalizeSkillItemId(s.itemId) !== undefined &&
        (owner === undefined || normalizeSkillItemId(s.itemId) === owner) &&
        (s.charges ?? 0) > 0,
    )
  }

  /**
   * Resolve the owner GUID a selection/hotkey of `skillId` must carry.
   * - `itemId` names a live charged entry -> that item;
   * - otherwise the player's own skill wins (`undefined` = `0xFFFFFFFF`), including when the bound charged item
   *   has been depleted / unequipped (the hotkey falls back to the native skill instead of going dead);
   * - only when the skill is not natively available and no explicit native owner (`0xFFFFFFFF`, #1975) was
   *   requested do we fall back to any live charged copy.
   */
  resolveSkillOwnerItemId(skillId: number, itemId?: number): number | undefined {
    const owner = normalizeSkillItemId(itemId)
    if (owner !== undefined && this.findChargedSkillEntry(skillId, owner)) return owner
    if (this.findNativeSkillEntry(skillId)) return undefined
    if (owner !== undefined) {
      // Bound item no longer carries this skill; keep the owner only if no other copy exists.
      return this.findChargedSkillEntry(skillId)?.itemId ?? owner
    }
    if (itemId !== undefined && itemId >>> 0 === 0xffffffff) return undefined
    return this.findChargedSkillEntry(skillId)?.itemId
  }

  private findOwnedSkillEntry(skillId: number, itemId?: number): HotkeySkillEntry | undefined {
    const owner = itemId === undefined ? this.resolveSkillOwnerItemId(skillId) : normalizeSkillItemId(itemId)
    return (
      this.findSkillEntry(skillId, owner) ??
      (owner === undefined ? this.availableSkills.find(s => s.skillId === skillId && s.itemId === undefined) : undefined)
    )
  }

  /**
   * `itemId`: owner of the skill being checked (`0xFFFFFFFF` = the player's own skill). When omitted the owner is
   * resolved with {@link resolveSkillOwnerItemId}.
   */
  hasEnoughMana(skillId: number, itemId?: number): boolean {
    if (this.currentMana === null) return true
    if (skillId <= 0 || isPassiveSkill(skillId) || isAuraSkill(skillId)) return true
    if (
      skillId === 217 ||
      skillId === 218 ||
      skillId === 219 ||
      skillId === 220 ||
      this.getSkillCharges(skillId, itemId) !== undefined
    ) {
      return true
    }
    // 1.13c D2Common.#10787 -> 0x6fda0af0 (`nocostinstate = 1`): unshifting from Werewolf (#223 in state 139)
    // or Werebear (#228 in state 140) costs 0 mana.
    if (
      (skillId === 223 && this.activeMorphStates.has(139)) ||
      (skillId === 228 && this.activeMorphStates.has(140))
    ) {
      return true
    }
    const entry = this.findOwnedSkillEntry(skillId, itemId)
    // 1.13c 0x6fda0b17: only item-owned skill nodes (`pSkill->dwItemId != -1`) bypass the mana check.
    if (entry?.isItemSkill || entry?.charges !== undefined) return true
    let manaCost: number = entry?.manaCost ?? 0
    if (entry === undefined) {
      const cat = SKILLS_BY_ID[skillId]
      manaCost = cat ? calculateManaCost(cat, 1) : 0
    }
    // 1.13c D2Common.#10787 -> 0x6fd9fdc0 (`wStartMana` in `Skills.txt`): Inferno (#41), Arctic Blast (#230),
    // and Blade Fury (#266) require `startmana` (6) when not already channeling (`STATE_INFERNO` = 12).
    const startMana =
      SKILLS_BY_ID[skillId]?.startmana ??
      (skillId === 41 || skillId === 230 || skillId === 266 ? 6 : 0)
    if (startMana > 0 && !this.activeMorphStates.has(12)) {
      manaCost = Math.max(manaCost, startMana)
    }
    if (manaCost <= 0) return true
    return this.currentMana >= manaCost
  }

  setSkillCooldown(skillId: number, durationMs: number, nowMs = performance.now()): void {
    if (durationMs <= 0) {
      this.cooldowns.delete(skillId)
    } else {
      this.cooldowns.set(skillId, { untilMs: nowMs + durationMs, totalMs: durationMs })
      if ((SKILLS_BY_ID[skillId]?.delay ?? 0) > 0) {
        this.globalSkillDelayUntilMs = Math.max(this.globalSkillDelayUntilMs, nowMs + durationMs)
      }
    }
  }

  setGlobalSkillDelay(durationMs: number, nowMs = performance.now()): void {
    if (durationMs <= 0) {
      this.globalSkillDelayUntilMs = 0
    } else {
      this.globalSkillDelayUntilMs = nowMs + durationMs
    }
  }

  isSkillOnCooldown(skillId: number, nowMs = performance.now()): boolean {
    const cd = this.cooldowns.get(skillId)
    if (cd) {
      if (nowMs >= cd.untilMs) {
        this.cooldowns.delete(skillId)
      } else {
        return true
      }
    }
    if (this.globalSkillDelayUntilMs > 0) {
      if (nowMs >= this.globalSkillDelayUntilMs) {
        this.globalSkillDelayUntilMs = 0
      } else if ((SKILLS_BY_ID[skillId]?.delay ?? 0) > 0) {
        return true
      }
    }
    return false
  }

  getSkillCooldownRemaining(skillId: number, nowMs = performance.now()): number {
    const cd = this.cooldowns.get(skillId)
    let rem = 0
    if (cd) {
      rem = cd.untilMs - nowMs
      if (rem <= 0) {
        this.cooldowns.delete(skillId)
        rem = 0
      }
    }
    if ((SKILLS_BY_ID[skillId]?.delay ?? 0) > 0 && this.globalSkillDelayUntilMs > nowMs) {
      rem = Math.max(rem, this.globalSkillDelayUntilMs - nowMs)
    }
    return rem
  }

  setSkillCharges(skillId: number, charges: number, maxCharges?: number | undefined): void {
    if (maxCharges !== undefined) {
      this.skillCharges.set(skillId, { charges, maxCharges })
    } else {
      this.skillCharges.set(skillId, { charges })
    }
  }

  deleteSkillCharges(skillId: number): void {
    this.skillCharges.delete(skillId)
  }

  clearSkillCharges(): void {
    this.skillCharges.clear()
  }

  /**
   * Remaining charges of the `(skillId, itemId)` node (`itemId` omitted = resolved owner, see
   * {@link resolveSkillOwnerItemId}). The player's own skill has no charges unless it is a scroll/tome count.
   */
  getSkillCharges(skillId: number, itemId?: number): number | undefined {
    const owner = itemId === undefined ? this.resolveSkillOwnerItemId(skillId) : normalizeSkillItemId(itemId)
    if (owner !== undefined) return this.findSkillEntry(skillId, owner)?.charges
    const explicit = this.skillCharges.get(skillId)
    if (explicit !== undefined) return explicit.charges
    return this.findOwnedSkillEntry(skillId, 0xffffffff)?.charges
  }

  getSkillMaxCharges(skillId: number, itemId?: number): number | undefined {
    const owner = itemId === undefined ? this.resolveSkillOwnerItemId(skillId) : normalizeSkillItemId(itemId)
    if (owner !== undefined) return this.findSkillEntry(skillId, owner)?.maxCharges
    const explicit = this.skillCharges.get(skillId)
    if (explicit !== undefined) return explicit.maxCharges
    return this.findOwnedSkillEntry(skillId, 0xffffffff)?.maxCharges
  }

  private ensureSkillIcon(skillId: number): HTMLImageElement | undefined {
    if (skillId < 0) return undefined
    const existing = this.iconImages.get(skillId)
    if (existing) return existing
    if (typeof Image === 'undefined') return undefined
    const img = new Image()
    img.src = `/skills/icon_${skillId}.png`
    this.iconImages.set(skillId, img)
    return img
  }

  /**
   * Bind a shared `skillId -> HTMLImageElement` cache (e.g. from `SkillTreePanel.getSkillIconsMap()`)
   * so icons preloaded by the skill tree or lobby character preloader are immediately available
   * on the left/right HUD skill slots and speedbar popup without duplicate `Image` requests.
   */
  bindSharedIconCache(cache: Map<number, HTMLImageElement>): void {
    for (const [id, img] of this.iconImages.entries()) {
      if (!cache.has(id)) {
        cache.set(id, img)
      }
    }
    this.iconImages = cache
  }

  hasSkillIcon(skillId: number): boolean {
    return this.iconImages.has(skillId)
  }

  getSkillIcon(skillId: number): HTMLImageElement | undefined {
    return this.iconImages.get(skillId)
  }

  /**
   * Preload all 30 class skill icons (`CLASS_SKILL_TREES[classCode]`) plus universal action/scroll/tome
   * skill icons (`0, 2, 3, 4, 217, 218, 219, 220`) and `/skills/icon_0_sword.png`.
   */
  preloadClassSkillIcons(classCode: CharacterClassCode): void {
    if (typeof Image === 'undefined') return
    for (const universalId of [0, 2, 3, 4, 217, 218, 219, 220]) {
      this.ensureSkillIcon(universalId)
    }
    const nodes = CLASS_SKILL_TREES[classCode] ?? []
    for (const node of nodes) {
      this.ensureSkillIcon(node.skillId)
    }
    this.preloadSkillIcons()
  }

  preloadSkillIcons(): void {
    if (typeof Image === 'undefined') return
    for (const s of this.availableSkills) {
      if (s.skillId >= 0) {
        this.ensureSkillIcon(s.skillId)
      }
    }
    this.ensureSkillIcon(this.leftSkillId)
    this.ensureSkillIcon(this.rightSkillId)
    if (!this.swordImage) {
      const sImg = new Image()
      sImg.src = '/skills/icon_0_sword.png'
      this.swordImage = sImg
    }
  }

  weaponEquipState?: WeaponEquipCheckState | undefined
  activeMorphStates: Set<number> = new Set()
  private unusableWeaponSkills: Set<number> = new Set()

  setActiveStates(states?: Iterable<number>): void {
    this.activeMorphStates.clear()
    if (!states) return
    for (const st of states) {
      this.activeMorphStates.add(st)
    }
  }

  setSkillWeaponUsable(skillId: number, usable: boolean): void {
    if (usable) {
      this.unusableWeaponSkills.delete(skillId)
    } else {
      this.unusableWeaponSkills.add(skillId)
    }
  }

  clearWeaponUsability(): void {
    this.unusableWeaponSkills.clear()
  }

  isSkillWeaponUsable(skillId: number): boolean {
    if (!canUseSkillInMorphState(skillId, this.activeMorphStates)) return false
    if (this.unusableWeaponSkills.has(skillId)) return false
    return canUseSkillWithWeapon(skillId, this.weaponEquipState, this.activeMorphStates)
  }

  isSkillUsableWithCurrentWeapon(skillId: number): boolean {
    return this.isSkillWeaponUsable(skillId)
  }

  setAvailableSkills(
    skills: readonly HotkeySkillEntry[],
    defaultLeft?: number,
    defaultRight?: number,
  ): void {
    // Passive skills and ListRow < 0 skills (Kick #1, Left Hand Swing #5) strictly cannot enter the quickbar
    this.availableSkills = skills.filter(s => {
      if (isPassiveSkill(s.skillId) || s.isPassive) return false
      return getSkillListRow(s) >= 0
    })
    if (defaultLeft !== undefined && isLeftUsableSkill(defaultLeft) && !isAuraSkill(defaultLeft)) {
      this.leftSkillId = defaultLeft
    }
    if (defaultRight !== undefined && !isPassiveSkill(defaultRight)) {
      this.rightSkillId = defaultRight
    }
    this.preloadSkillIcons()
  }

  addOrUpdateSkill(entry: HotkeySkillEntry): void {
    if (isPassiveSkill(entry.skillId) || entry.isPassive) return
    if (getSkillListRow(entry) < 0) return
    const owner = normalizeSkillItemId(entry.itemId)
    const idx = this.availableSkills.findIndex(
      s => s.skillId === entry.skillId && normalizeSkillItemId(s.itemId) === owner,
    )
    if (idx >= 0) {
      this.availableSkills[idx] = entry
    } else {
      this.availableSkills.push(entry)
    }
    this.preloadSkillIcons()
  }

  /**
   * Select `skillId` for `side` if it is legal there (no passives; no auras / right-only skills on the left).
   * Online (`onSelectSkill` set) this only emits the request; offline widget use applies it directly.
   */
  requestSelect(side: 'left' | 'right', skillId: number, itemId?: number): void {
    if (isPassiveSkill(skillId)) return
    if (side === 'left' && (!isLeftUsableSkill(skillId) || isAuraSkill(skillId))) return
    const resolvedItemId = this.resolveSkillOwnerItemId(skillId, itemId)
    if (this.onSelectSkill) {
      this.onSelectSkill(side, skillId, resolvedItemId)
      return
    }
    if (side === 'left') {
      this.leftSkillId = skillId
      this.leftSkillItemId = resolvedItemId
    } else {
      this.rightSkillId = skillId
      this.rightSkillItemId = resolvedItemId
    }
  }

  getHotkeyLabelForSkill(side: 'left' | 'right', skillId: number): string | null {
    for (const [key, binding] of this.bindings.entries()) {
      if (binding.side === side && binding.skillId === skillId) return key
    }
    return null
  }

  /** Hotkey bound to exactly the `(side, skillId, owner)` node (native and charged copies are labelled separately). */
  getHotkeyLabelForSkillOwner(side: 'left' | 'right', skillId: number, itemId?: number): string | null {
    const owner = normalizeSkillItemId(itemId)
    for (const [key, binding] of this.bindings.entries()) {
      if (binding.side === side && binding.skillId === skillId && normalizeSkillItemId(binding.itemId) === owner) {
        return key
      }
    }
    return null
  }

  static slotIndexFromKey(fKey: string): number | null {
    const key = fKey.trim().toUpperCase()
    if (/^F([1-8])$/.test(key)) {
      return Number(key.slice(1)) - 1
    }
    const skillMatch = /^SKILL\s*(9|1[0-6])$/.exec(key) ?? /^F(9|1[0-6])$/.exec(key)
    if (skillMatch) {
      return Number(skillMatch[1]) - 1
    }
    return null
  }

  static keyFromSlotIndex(slot: number): string | null {
    if (!Number.isInteger(slot) || slot < 0 || slot > 15) return null
    return slot < 8 ? `F${slot + 1}` : `SKILL${slot + 1}`
  }

  bindHotkey(fKey: string, side: 'left' | 'right', skillId: number, itemId?: number): void {
    const normKey = fKey.trim().toUpperCase()
    // 0xffffffff is the 1.13c "no item" sentinel (explicitly a non-item binding): never store it as
    // a concrete itemId and never re-resolve it to a charged item (#1975 regression from fa7180ed).
    // Issue #289: an omitted owner prefers the player's own skill over an item's charged copy of the same id.
    const resolvedItemId = this.resolveSkillOwnerItemId(skillId, itemId)
    // 1.13c D2Client.dll 0x6faed280..0x6faed2e5: deduplicate any other slot bound to the same (side, skillId, itemId).
    for (const [existingKey, existing] of Array.from(this.bindings.entries())) {
      if (
        existingKey !== normKey &&
        existing.side === side &&
        existing.skillId === skillId &&
        (existing.itemId ?? 0xffffffff) === (resolvedItemId ?? 0xffffffff)
      ) {
        this.bindings.delete(existingKey)
      }
    }
    this.bindings.set(normKey, {
      side,
      skillId,
      ...(resolvedItemId !== undefined ? { itemId: resolvedItemId } : {}),
    })
  }

  handleKeyDown(key: string): boolean {
    const res = this.triggerFunctionKey(key)
    return res !== null
  }

  openSpeedbar(side: 'left' | 'right'): void {
    this.openPopup = side
  }

  assignSkill(side: 'left' | 'right', skillId: number): boolean {
    if (isPassiveSkill(skillId)) return false
    if (side === 'left') {
      if (isAuraSkill(skillId) || !isLeftUsableSkill(skillId)) return false
      this.leftSkillId = skillId
    } else {
      this.rightSkillId = skillId
    }
    return true
  }

  setDualSkill(skillId: number): boolean {
    if (isPassiveSkill(skillId) || isAuraSkill(skillId) || !isLeftUsableSkill(skillId)) return false
    this.leftSkillId = skillId
    this.rightSkillId = skillId
    return true
  }

  getAvailableSkillsForSide(side: 'left' | 'right'): readonly HotkeySkillEntry[] {
    return getAvailableSkillsForSide(side, this.availableSkills, this.weaponEquipState)
  }

  isSkillAvailable(skillId: number): boolean {
    if (skillId === 0) return true
    if (skillId < 0 || skillId === 0xffff || skillId === 0x7fff) return false
    if (this.availableSkills.length === 0) return true
    return this.availableSkills.some(
      (s) => s.skillId === skillId && ((s.level ?? 0) > 0 || (s.charges ?? 0) > 0),
    )
  }

  /** Last selected hotkey slot index `0..15` (`0x6FBC9D70`, updated by `0x6FAED5B0`). */
  lastSelectedSlot = 0

  triggerFunctionKey(fKey: string): { side: 'left' | 'right'; skillId: number; itemId?: number | undefined } | null {
    const key = fKey.trim().toUpperCase()
    const slotIndex = SkillHotkeysHud.slotIndexFromKey(key)
    if (this.openPopup !== null && this.hoveredGrantedSkill !== null) {
      return null
    }
    if (this.openPopup !== null && this.hoveredPopupSkill !== null) {
      const hovered = this.hoveredPopupSkill
      this.bindHotkey(key, hovered.side, hovered.skillId, hovered.itemId)
      if (slotIndex !== null) {
        this.onAssignHotkey?.(slotIndex, hovered.side, hovered.skillId, hovered.itemId)
      }
      return hovered
    }
    const bound = this.bindings.get(key)
    if (!bound) return null
    if (!this.isSkillAvailable(bound.skillId)) {
      this.bindings.delete(key)
      return null
    }
    const owned = this.refreshBindingOwner(key, slotIndex)
    if (!owned) return null
    if (slotIndex !== null) {
      this.lastSelectedSlot = slotIndex
    }
    this.requestSelect(owned.side, owned.skillId, owned.itemId)
    return owned
  }

  /**
   * Re-resolve the owner of a bound hotkey. A slot bound to an item's charged copy whose charges ran out (or whose
   * item was unequipped) falls back to the player's own skill when it is learned, so the F-key keeps working; a
   * charged-only binding with no live copy left is dropped.
   */
  private refreshBindingOwner(
    key: string,
    slotIndex: number | null,
  ): { side: 'left' | 'right'; skillId: number; itemId?: number | undefined } | null {
    const bound = this.bindings.get(key)
    if (!bound) return null
    if (bound.skillId <= 0) return bound
    const prevOwner = normalizeSkillItemId(bound.itemId)
    if (prevOwner === undefined) return bound
    if (this.findChargedSkillEntry(bound.skillId, prevOwner)) return bound
    const nextOwner = this.resolveSkillOwnerItemId(bound.skillId, prevOwner)
    if (nextOwner !== undefined && !this.findChargedSkillEntry(bound.skillId, nextOwner)) {
      this.bindings.delete(key)
      return null
    }
    const next = { side: bound.side, skillId: bound.skillId, ...(nextOwner !== undefined ? { itemId: nextOwner } : {}) }
    this.bindings.set(key, next)
    if (slotIndex !== null) {
      this.onAssignHotkey?.(slotIndex, next.side, next.skillId, nextOwner ?? 0xffffffff)
    }
    return next
  }

  /**
   * 1.13c `SelectPreviousSkill` (`0x6faea8e0`, `step = -1`) / `SelectNextSkill` (`0x6faea8c0`, `step = 1`)
   * -> `sub_6FAED6D0(step)` (`0x6faed6d0`):
   * Steps `edi = (lastSelectedSlot + dir) mod 16` up to 16 times across right-hand bound slots
   * (`[edi*4 + 0x6fbc9e20] == 0`), calling `0x6faed5b0` on the matched slot.
   */
  cycleBoundSkills(step: -1 | 1): { side: 'left' | 'right'; skillId: number; slot: number } | null {
    const dir = step > 0 ? 1 : -1
    let count = Math.abs(step) || 1
    let startSlot = this.lastSelectedSlot & 0x0f
    const startKey = SkillHotkeysHud.keyFromSlotIndex(startSlot)
    const startBinding = startKey ? this.bindings.get(startKey) : undefined
    if (!startBinding || startBinding.side !== 'right' || startBinding.skillId !== this.rightSkillId) {
      for (let s = 0; s < 16; s++) {
        const k = SkillHotkeysHud.keyFromSlotIndex(s)
        const b = k ? this.bindings.get(k) : undefined
        if (b && b.side === 'right' && b.skillId === this.rightSkillId) {
          startSlot = s
          break
        }
      }
    }

    let matchedSlot = -1
    let matchedSkillId = -1
    let matchedItemId: number | undefined
    let edi = startSlot + dir
    for (let ebx = 0; ebx < 16; ebx++) {
      if (edi < 0) edi = 15
      else if (edi >= 16) edi = 0
      const key = SkillHotkeysHud.keyFromSlotIndex(edi)
      const b = key ? this.bindings.get(key) : undefined
      if (b && b.skillId >= 0 && b.skillId !== 0xffff && b.side === 'right') {
        const owned = key && this.isSkillAvailable(b.skillId) ? this.refreshBindingOwner(key, edi) : null
        if (!owned) {
          if (key) this.bindings.delete(key)
        } else {
          matchedSlot = edi
          matchedSkillId = owned.skillId
          matchedItemId = owned.itemId
          count -= 1
          if (count === 0) break
        }
      }
      edi += dir
    }

    if (matchedSlot === -1) return null
    this.lastSelectedSlot = matchedSlot
    this.requestSelect('right', matchedSkillId, matchedItemId)
    return { slot: matchedSlot, side: 'right', skillId: matchedSkillId }
  }

  getPopupCells(side: 'left' | 'right'): {
    skill: HotkeySkillEntry
    x: number
    y: number
    w: number
    h: number
    listRow: number
    visualRow: number
    col: number
  }[] {
    const list = this.getAvailableSkillsForSide(side)
    const cellW = 48
    const cellH = 48
    const base = side === 'left' ? this.leftSkillBounds : this.rightSkillBounds
    const maxW = this.is640 ? 640 : 800
    const maxH = this.is640 ? 480 : 600

    // 1. Group available skills by authentic ListRow (0..4)
    const rowMap = new Map<number, HotkeySkillEntry[]>()
    for (const skill of list) {
      const explicitCharges = this.getSkillCharges(skill.skillId, skillOwnerArg(skill))
      const effectiveSkill = (explicitCharges !== undefined && skill.charges === undefined)
        ? { ...skill, charges: explicitCharges }
        : skill
      const row = getSkillListRow(effectiveSkill)
      let group = rowMap.get(row)
      if (!group) {
        group = []
        rowMap.set(row, group)
      }
      group.push(effectiveSkill)
    }

    // 2. Intra-row ordering: sort each row by reqlevel ascending, then skillId ascending
    for (const group of rowMap.values()) {
      group.sort((a, b) => {
        const reqA = getSkillReqLevel(a)
        const reqB = getSkillReqLevel(b)
        if (reqA !== reqB) return reqA - reqB
        return a.skillId - b.skillId
      })
    }

    // 3. Compaction: only consider rows with >= 1 skill, ordered from bottom (Row 0) to top (Row 4)
    // Row 0: Basic actions (bottom, closest to slot)
    // Rows 1..3: Class skill tree tabs
    // Row 4: Item skills (top)
    // Unlearned or inactive rows are compacted without blank gaps
    const populatedRows = Array.from(rowMap.keys())
      .filter(r => (rowMap.get(r)?.length ?? 0) > 0)
      .sort((a, b) => a - b)

    const cells: {
      skill: HotkeySkillEntry
      x: number
      y: number
      w: number
      h: number
      listRow: number
      visualRow: number
      col: number
    }[] = []

    populatedRows.forEach((listRow, visualRow) => {
      const skillsInRow = rowMap.get(listRow)!
      skillsInRow.forEach((skill, col) => {
        const rawX = side === 'left' ? base.x + col * cellW : base.x - col * cellW
        const rawY = base.y - (visualRow + 1) * cellH - 6
        // Clamp strictly within active viewport canvas bounds
        const x = Math.max(0, Math.min(maxW - cellW, rawX))
        const y = Math.max(0, Math.min(maxH - cellH, rawY))
        cells.push({ skill, x, y, w: cellW, h: cellH, listRow, visualRow, col })
      })
    })

    return cells
  }

  getSpeedbarSkills(side: 'left' | 'right'): {
    skill: HotkeySkillEntry
    x: number
    y: number
    w: number
    h: number
    listRow: number
    visualRow: number
    col: number
  }[] {
    return this.getPopupCells(side)
  }

  /** Replace the display-only granted row (item auras first, then non-class passives). */
  setGrantedSkills(entries: readonly GrantedSkillEntry[]): void {
    this.grantedSkills = entries.filter(e => e.skillId > 0 && e.level > 0)
    if (typeof Image === 'undefined') return
    for (const e of this.grantedSkills) this.ensureSkillIcon(e.skillId)
  }

  /** Stable signature of the granted row for HUD redraw caching. */
  getGrantedSkillsKey(): string {
    return this.grantedSkills.map(e => `${e.kind === 'item-aura' ? 'a' : 'p'}${e.skillId}:${e.level}`).join(',')
  }

  /**
   * Cells of the display-only granted row: one extra row stacked above the topmost selectable Speedbar row,
   * laid out like the other rows (towards the screen centre from the hand button).
   */
  getGrantedPopupCells(side: 'left' | 'right'): {
    granted: GrantedSkillEntry
    x: number
    y: number
    w: number
    h: number
    visualRow: number
    col: number
  }[] {
    if (this.grantedSkills.length === 0) return []
    const cellW = 48
    const cellH = 48
    const base = side === 'left' ? this.leftSkillBounds : this.rightSkillBounds
    const maxW = this.is640 ? 640 : 800
    const maxH = this.is640 ? 480 : 600
    let visualRow = 0
    for (const c of this.getPopupCells(side)) visualRow = Math.max(visualRow, c.visualRow + 1)
    return this.grantedSkills.map((granted, col) => {
      const rawX = side === 'left' ? base.x + col * cellW : base.x - col * cellW
      const rawY = base.y - (visualRow + 1) * cellH - 6
      const x = Math.max(0, Math.min(maxW - cellW, rawX))
      const y = Math.max(0, Math.min(maxH - cellH, rawY))
      return { granted, x, y, w: cellW, h: cellH, visualRow, col }
    })
  }

  private drawGrantedSkillButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    side: 'left' | 'right',
    granted: GrantedSkillEntry,
    font: D2FontRenderer,
    highlighted: boolean,
  ): void {
    ctx.fillStyle = '#14110d'
    ctx.fillRect(x, y, 48, 48)
    const icon = this.ensureSkillIcon(granted.skillId)
    if (icon && icon.complete && icon.naturalWidth > 0) {
      ctx.drawImage(icon, x, y, 48, 48)
    } else if (!icon || icon.complete) {
      reportMissingArt('skill-icon', `icon_${granted.skillId}`, `Missing granted skill icon for skillId=${granted.skillId} (${side})`)
    }
    // Display-only row: blue frame (item-granted colour, `levelColor: 'blue'` like the merc item-aura list).
    ctx.strokeStyle = highlighted ? '#e8c26b' : '#4f6fb0'
    ctx.lineWidth = highlighted ? 2 : 1
    ctx.strokeRect(x + 0.5, y + 0.5, 47, 47)
    font.drawText(ctx, String(granted.level), x + 4, y + 44, {
      font: 'font8',
      color: granted.kind === 'item-aura' ? 'gold' : 'blue',
    })
  }

  handleMouseMove(logicalX: number, logicalY: number): void {
    this.hoveredGrantedSkill = null
    this.hoverSkillId = null
    this.hoverSpeedbarSkillId = null
    this.hoveredPopupSkill = null
    this.hoveredSlot = null

    const leftBounds = this.leftSkillBounds
    const rightBounds = this.rightSkillBounds

    if (
      logicalX >= leftBounds.x &&
      logicalX <= leftBounds.x + leftBounds.width &&
      logicalY >= leftBounds.y &&
      logicalY <= leftBounds.y + leftBounds.height
    ) {
      this.hoverSkillId = this.leftSkillId
      this.hoveredSlot = 'left'
      return
    }

    if (
      logicalX >= rightBounds.x &&
      logicalX <= rightBounds.x + rightBounds.width &&
      logicalY >= rightBounds.y &&
      logicalY <= rightBounds.y + rightBounds.height
    ) {
      this.hoverSkillId = this.rightSkillId
      this.hoveredSlot = 'right'
      return
    }

    if (!this.openPopup) return
    const cells = this.getPopupCells(this.openPopup)
    for (const c of cells) {
      if (logicalX >= c.x && logicalX <= c.x + c.w && logicalY >= c.y && logicalY <= c.y + c.h) {
        this.hoveredPopupSkill = {
          side: this.openPopup,
          skillId: c.skill.skillId,
          ...(c.skill.itemId !== undefined ? { itemId: c.skill.itemId } : {}),
        }
        this.hoverSpeedbarSkillId = c.skill.skillId
        return
      }
    }
    for (const g of this.getGrantedPopupCells(this.openPopup)) {
      if (logicalX >= g.x && logicalX <= g.x + g.w && logicalY >= g.y && logicalY <= g.y + g.h) {
        this.hoveredGrantedSkill = { side: this.openPopup, skillId: g.granted.skillId, kind: g.granted.kind }
        this.hoverSpeedbarSkillId = g.granted.skillId
        return
      }
    }
  }

  handleClick(logicalX: number, logicalY: number): boolean {
    // 1. Check click inside open Speedbar popup
    if (this.openPopup) {
      const cells = this.getPopupCells(this.openPopup)
      for (const c of cells) {
        if (logicalX >= c.x && logicalX <= c.x + c.w && logicalY >= c.y && logicalY <= c.y + c.h) {
          this.requestSelect(this.openPopup, c.skill.skillId, c.skill.itemId)
          this.openPopup = null
          return true
        }
      }
      for (const g of this.getGrantedPopupCells(this.openPopup)) {
        if (logicalX >= g.x && logicalX <= g.x + g.w && logicalY >= g.y && logicalY <= g.y + g.h) {
          return true
        }
      }
    }

    const leftBounds = this.leftSkillBounds
    const rightBounds = this.rightSkillBounds

    // 2. Check click on Left Skill Slot
    if (
      logicalX >= leftBounds.x &&
      logicalX <= leftBounds.x + leftBounds.width &&
      logicalY >= leftBounds.y &&
      logicalY <= leftBounds.y + leftBounds.height
    ) {
      this.openPopup = this.openPopup === 'left' ? null : 'left'
      return true
    }

    // 3. Check click on Right Skill Slot
    if (
      logicalX >= rightBounds.x &&
      logicalX <= rightBounds.x + rightBounds.width &&
      logicalY >= rightBounds.y &&
      logicalY <= rightBounds.y + rightBounds.height
    ) {
      this.openPopup = this.openPopup === 'right' ? null : 'right'
      return true
    }

    if (this.openPopup) {
      this.openPopup = null
      return true
    }
    return false
  }

  draw(
    ctx: CanvasRenderingContext2D,
    genericSkillsImg: HTMLImageElement | null,
    font: D2FontRenderer,
    hasEquippedWeapon = this.hasEquippedWeapon,
    nowMs = performance.now(),
  ): void {
    this.hasEquippedWeapon = hasEquippedWeapon
    const leftBounds = this.leftSkillBounds
    const rightBounds = this.rightSkillBounds
    this.drawSkillButton(
      ctx,
      leftBounds.x,
      leftBounds.y,
      'left',
      this.leftSkillId,
      genericSkillsImg,
      font,
      false,
      nowMs,
      this.findOwnedSkillEntry(this.leftSkillId, this.leftSkillItemId ?? 0xffffffff),
    )
    this.drawSkillButton(
      ctx,
      rightBounds.x,
      rightBounds.y,
      'right',
      this.rightSkillId,
      genericSkillsImg,
      font,
      false,
      nowMs,
      this.findOwnedSkillEntry(this.rightSkillId, this.rightSkillItemId ?? 0xffffffff),
    )

    if (this.openPopup) {
      const cells = this.getPopupCells(this.openPopup)
      for (const c of cells) {
        this.drawSkillButton(
          ctx,
          c.x,
          c.y,
          this.openPopup,
          c.skill.skillId,
          genericSkillsImg,
          font,
          this.hoveredPopupSkill?.skillId === c.skill.skillId &&
            normalizeSkillItemId(this.hoveredPopupSkill?.itemId) === normalizeSkillItemId(c.skill.itemId),
          nowMs,
          c.skill,
        )
      }
      for (const g of this.getGrantedPopupCells(this.openPopup)) {
        this.drawGrantedSkillButton(
          ctx,
          g.x,
          g.y,
          this.openPopup,
          g.granted,
          font,
          this.hoveredGrantedSkill?.skillId === g.granted.skillId && this.hoveredGrantedSkill?.kind === g.granted.kind,
        )
      }
    }

    // Authentic Diablo II v1.13c Skill Tooltip on Quickbar / Speedbar
    this.drawSkillTooltip(ctx, font)
  }

  private drawSkillButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    side: 'left' | 'right',
    skillId: number,
    genericSkillsImg: HTMLImageElement | null,
    font: D2FontRenderer,
    highlighted = false,
    _nowMs = performance.now(),
    skillEntry?: HotkeySkillEntry,
  ): void {
    ctx.fillStyle = '#14110d'
    ctx.fillRect(x, y, 48, 48)

    if (skillId in GENERIC_SKILL_TBL_STRINGS) {
      const iconCel = getCanonicalSkillIconCel(skillId)
      if (skillId === 0 && !this.swordImage && typeof Image !== 'undefined') {
        const sImg = new Image()
        sImg.src = '/skills/icon_0_sword.png'
        this.swordImage = sImg
      }
      const icon = this.ensureSkillIcon(skillId)
      if (skillId === 0 && this.swordImage && this.swordImage.complete && this.swordImage.naturalWidth > 0) {
        ctx.drawImage(this.swordImage, x, y, 48, 48)
      } else if (icon && icon.complete && icon.naturalWidth > 0) {
        ctx.drawImage(icon, x, y, 48, 48)
      } else if (genericSkillsImg && genericSkillsImg.complete && genericSkillsImg.naturalWidth > 0) {
        ctx.drawImage(genericSkillsImg, iconCel * 48, 0, 48, 48, x, y, 48, 48)
      } else {
        const swordPending = Boolean(skillId === 0 && this.swordImage && !this.swordImage.complete)
        const iconPending = Boolean(icon && !icon.complete)
        const sheetPending = Boolean(genericSkillsImg && !genericSkillsImg.complete)
        if (!swordPending && !iconPending && !sheetPending) {
          reportMissingArt('skill-icon', `icon_${skillId}`, `Missing generic skill icon for skillId=${skillId} (${side})`)
        }
      }
    } else {
      const icon = this.ensureSkillIcon(skillId)
      if (icon && icon.complete && icon.naturalWidth > 0) {
        ctx.drawImage(icon, x, y, 48, 48)
      } else if (!icon || icon.complete) {
        reportMissingArt('skill-icon', `icon_${skillId}`, `Missing class skill icon for skillId=${skillId} (${side})`)
      }
    }

    // 1. 1.13c D2Client.dll 0x6fad8bc0 -> 0x6faeda60 (bottom bar) & 0x6faee7f0 (Speedbar popup):
    // Calls D2Common.#10787(pPlayer, pSkill). Any non-zero status other than 6 (passive) — including
    // 1 (insufficient mana), 2 (unusable weapon/state/town), 4 (0 charges), 8 (skilldelay cooldown) —
    // sets nPalette = 1 (red icon tint).
    const ownerArg = skillEntry ? skillOwnerArg(skillEntry) : undefined
    const charges = skillEntry?.charges ?? this.getSkillCharges(skillId, ownerArg)
    if (
      this.isSkillOnCooldown(skillId, _nowMs) ||
      !this.isSkillWeaponUsable(skillId) ||
      !this.hasEnoughMana(skillId, ownerArg) ||
      (charges !== undefined && charges <= 0)
    ) {
      ctx.fillStyle = 'rgba(180, 20, 20, 0.55)'
      ctx.fillRect(x + 1, y + 1, 46, 46)
    }

    // 2. Standard 1.13c button border
    ctx.strokeStyle = highlighted ? '#e8c26b' : '#584a34'
    ctx.lineWidth = highlighted ? 2 : 1
    ctx.strokeRect(x + 0.5, y + 0.5, 47, 47)

    // 3. Hotkey label (F1..F8) at bottom-right
    // Per owner: the native and charged copies carry their own F-key.
    const fKey = skillEntry
      ? this.getHotkeyLabelForSkillOwner(side, skillId, skillEntry.itemId)
      : this.getHotkeyLabelForSkill(side, skillId)
    if (fKey) {
      font.drawText(ctx, fKey, x + 44, y + 44, {
        font: 'font8',
        color: 'gold',
        align: 'right',
      })
    }

    // 4. Charges / Tome quantity display at bottom-left
    if (charges !== undefined) {
      const chargeColor = charges > 0 ? 'white' : 'red'
      font.drawText(ctx, String(charges), x + 4, y + 44, {
        font: 'font8',
        color: chargeColor,
      })
    }
  }

  /**
   * Formats authentic Diablo II 1.13c multi-line tooltip lines for quickbar and speedbar popups
   * driven by `skilldesc.txt` (`descline*`) and `.tbl` strings.
   */
  formatTooltipLines(
    skillId: number,
    side: 'left' | 'right',
    isSpeedbar: boolean,
    lang: TblLang = this.lang,
    ownerItemId?: number,
    granted?: GrantedSkillEntry,
  ): FormattedTooltipLine[] {
    const lines: FormattedTooltipLine[] = []
    const isEn = lang === 'ENG'
    const tbl = SKILL_TBL_STRINGS[lang]

    const pushHotkeyLine = () => {
      if (granted) {
        // Display-only granted row: source line + "no hotkey" instead of the F-key hint.
        lines.push({
          text:
            granted.kind === 'item-aura'
              ? isEn
                ? `Item Aura (Level ${granted.level}, not raised by +Skills)`
                : `装备赋予光环（等级 ${granted.level}，不受 +技能 加成）`
              : isEn
                ? `Item-Granted Passive (Level ${granted.level})`
                : `装备赋予被动技能（等级 ${granted.level}）`,
          color: 'blue',
          font: 'font8',
          align: 'center',
        })
        lines.push({
          text: isEn ? 'Cannot be assigned to a hotkey' : '不可设置快捷键',
          color: 'tan',
          font: 'font8',
          align: 'center',
        })
        return
      }
      const boundKey =
        ownerItemId !== undefined
          ? this.getHotkeyLabelForSkillOwner(side, skillId, ownerItemId)
          : this.getHotkeyLabelForSkill(side, skillId)
      if (isSpeedbar) {
        lines.push({
          text: isEn
            ? (boundKey ? `Current Hotkey: ${boundKey} (Press F1-F8 to rebind)` : 'Press F1-F8 to set hotkey')
            : (boundKey ? `当前快捷键: ${boundKey} (按 F1-F8 键重新绑定)` : '按 F1-F8 键设置快捷键'),
          color: 'tan',
          font: 'font8',
          align: 'center',
        })
      } else if (boundKey) {
        lines.push({
          text: isEn ? `Hotkey: ${boundKey}` : `快捷键: ${boundKey}`,
          color: 'tan',
          font: 'font8',
          align: 'center',
        })
      }
    }

    // 1. Generic & Item Skills (#0..#5, #217..#220, #350) from skilldesc.txt + .tbl
    if (skillId in GENERIC_SKILL_TBL_STRINGS) {
      lines.push({
        text: getSkillName(skillId, lang),
        color: 'gold',
        font: 'fontexocet10',
        align: 'center',
      })
      pushHotkeyLine()
      const longDesc = getGenericSkillLongDesc(skillId, lang)
      if (longDesc) {
        for (const descLine of longDesc.split('\n')) {
          const trimmed = descLine.trim()
          if (trimmed) {
            lines.push({
              text: trimmed,
              color: 'white',
              font: 'font8',
              align: 'center',
            })
          }
        }
      }
      const meta = SKILLS_TABLE_META[skillId]
      if (meta?.descline1 && meta.descline1 >= 53 && meta.descline1 <= 56) {
        const charges = this.getSkillCharges(skillId, ownerItemId)
        if (charges !== undefined) {
          lines.push({
            text: `${tbl.skilldesc4}${charges}`,
            color: charges > 0 ? 'white' : 'red',
            font: 'font8',
            align: 'center',
          })
        }
      }
      return lines
    }

    // 2. Class Skills
    const entry = granted
      ? { skillId, level: granted.level, manaCost: 0, name: granted.name, nameZh: granted.nameZh, itemId: undefined }
      : (this.findOwnedSkillEntry(skillId, ownerItemId) ?? this.availableSkills.find(s => s.skillId === skillId))
    const isChargedCopy = normalizeSkillItemId(entry?.itemId) !== undefined
    const catalogEntry = SKILLS_BY_ID[skillId]
    const fallbackLevel = Math.max(1, entry?.level ?? 1)
    // An item's charged copy is cast at the item's own level (`stat 204` param low 6 bits), never the player's
    // hard points + bonuses, so its tooltip is built from the entry level instead of the native tooltip resolver.
    // Item auras are fixed-level grants (no +skills, no hard points), so they never use the native resolver;
    // granted passives use it only when it agrees on the granted level.
    const resolvedVm =
      this.tooltipResolver && !isChargedCopy && granted?.kind !== 'item-aura' ? this.tooltipResolver(skillId) : null
    const rawVm = granted && resolvedVm && resolvedVm.effectiveLevel !== granted.level ? null : resolvedVm
    const vm =
      rawVm && rawVm.effectiveLevel > 0
        ? rawVm
        : catalogEntry
          ? (() => {
              const st = createInitialState(catalogEntry.classCode)
              st.hardPoints[skillId] = fallbackLevel
              return buildTooltipViewModel(st, skillId)
            })()
          : rawVm

    const nameZh = vm?.skill.nameZh ?? entry?.nameZh ?? catalogEntry?.nameZh ?? `技能 ${skillId}`
    const nameEn = vm?.skill.name ?? entry?.name ?? catalogEntry?.name ?? `Skill ${skillId}`

    // Title
    lines.push({
      text: isEn ? nameEn : nameZh,
      color: 'gold',
      font: 'fontexocet10',
      align: 'center',
    })

    // Hotkey Info
    pushHotkeyLine()

    // Charges Tag (for item-granted charged skills)
    const charges = granted ? undefined : this.getSkillCharges(skillId, ownerItemId)
    const maxCharges = granted ? undefined : this.getSkillMaxCharges(skillId, ownerItemId)
    if (charges !== undefined) {
      lines.push({
        text: isEn
          ? `Charges: ${charges}${maxCharges !== undefined ? ` / ${maxCharges}` : ''}`
          : `剩余充能: ${charges}${maxCharges !== undefined ? ` / ${maxCharges}` : ''}`,
        color: charges > 0 ? 'blue' : 'red',
        font: 'font8',
        align: 'center',
      })
    }

    if (vm) {
      // Current level (StrSkill2: "Current Skill Level: " / "目前技能等級：")
      const soft = Math.max(0, vm.effectiveLevel - vm.hardPoints)
      const levelLabel = this.showBasePlusBonusSkills
        ? `${vm.effectiveLevel} (${vm.hardPoints}+${soft})`
        : String(vm.effectiveLevel)
      lines.push({
        text: `${tbl.StrSkill2}${levelLabel}`,
        color: soft > 0 ? 'blue' : 'white',
        font: 'font8',
        align: 'center',
      })

      // Mana cost (StrSkill3: "Mana Cost: " / "法力消耗：")
      if (vm.current.manaCost > 0 || vm.skill.mana > 0) {
        lines.push({
          text: `${tbl.StrSkill3}${vm.current.manaCost}`,
          color: 'white',
          font: 'font8',
          align: 'center',
        })
      }

      // Description narrative
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

      // Damage / stats fallback when canonical SkillDesc.txt descline effects are empty
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

      // Effects (`SkillDesc.txt` `dsc2` + `dsc1` lines)
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

      // Synergies received (canonical .tbl Sksyn)
      if (vm.synergiesReceived && vm.synergiesReceived.length > 0) {
        const skillTitle = isEn ? nameEn : nameZh
        lines.push({
          text: tbl.Sksyn.replace('%s', skillTitle),
          color: 'white',
          font: 'font8',
          align: 'center',
        })
        for (const syn of vm.synergiesReceived) {
          const text = isEn
            ? `${syn.providerName}: +${syn.percentPerLevel}% Damage per Level`
            : `${syn.providerNameZh}: +${syn.percentPerLevel}% 每等級傷害`
          lines.push({
            text,
            color: 'white',
            font: 'font8',
            align: 'center',
          })
        }
      }
    } else {
      const level = entry?.level ?? 1
      const mana = entry?.manaCost ?? 0
      lines.push({
        text: `${tbl.StrSkill2}${level}`,
        color: 'white',
        font: 'font8',
        align: 'center',
      })
      if (mana > 0) {
        lines.push({
          text: `${tbl.StrSkill3}${mana}`,
          color: 'white',
          font: 'font8',
          align: 'center',
        })
      }
    }

    return lines
  }

  /**
   * Computes placement for quickbar tooltips clamped safely inside the viewport.
   */
  static computeTooltipPlacement(
    anchor: { x: number; y: number; w?: number; h?: number; width?: number; height?: number },
    lines: readonly FormattedTooltipLine[],
    font: D2FontRenderer,
    viewportWidth = 800,
    viewportHeight = 600,
  ): { x: number; y: number; w: number; h: number } {
    const maxLineWidth = lines.reduce((max, l) => {
      const w = typeof font?.measureText === 'function' ? font.measureText(l.text, l.font) : l.text.length * 8
      return Math.max(max, w)
    }, 0)
    const boxW = Math.max(220, maxLineWidth + 28)
    const boxH = lines.length * 17 + 22

    const anchorW = anchor.w ?? (anchor as any).width ?? 48
    const anchorH = anchor.h ?? (anchor as any).height ?? 48

    // Center horizontally on anchor
    const rawX = Math.round(anchor.x + anchorW / 2 - boxW / 2)
    const clampedX = Math.max(8, Math.min(viewportWidth - boxW - 8, rawX))

    // Position vertically above anchor
    let clampedY = anchor.y - boxH - 6
    if (clampedY < 8) {
      if (anchor.y + anchorH + boxH + 6 <= 552) {
        clampedY = anchor.y + anchorH + 6
      } else {
        clampedY = 8
      }
    }

    return { x: clampedX, y: clampedY, w: boxW, h: boxH }
  }

  /**
   * Renders the authentic Diablo II 1.13c skill tooltip on the quickbar or speedbar.
   */
  drawSkillTooltip(ctx: CanvasRenderingContext2D, font: D2FontRenderer): void {
    let skillId: number | null = null
    let side: 'left' | 'right' = 'left'
    let anchor: { x: number; y: number; w?: number; h?: number; width?: number; height?: number } | null = null
    let isSpeedbar = false
    let ownerItemId: number | undefined

    let granted: GrantedSkillEntry | undefined
    if (this.openPopup && this.hoveredGrantedSkill) {
      const hg = this.hoveredGrantedSkill
      const cell = this.getGrantedPopupCells(this.openPopup).find(
        g => g.granted.skillId === hg.skillId && g.granted.kind === hg.kind,
      )
      if (cell) {
        skillId = cell.granted.skillId
        side = hg.side
        anchor = cell
        isSpeedbar = true
        granted = cell.granted
      }
    } else if (this.openPopup && this.hoveredPopupSkill) {
      skillId = this.hoveredPopupSkill.skillId
      side = this.hoveredPopupSkill.side
      const cells = this.getPopupCells(this.openPopup)
      const hoveredOwner = normalizeSkillItemId(this.hoveredPopupSkill.itemId)
      const cell = cells.find(
        c => c.skill.skillId === skillId && normalizeSkillItemId(c.skill.itemId) === hoveredOwner,
      )
      if (cell) {
        anchor = cell
        ownerItemId = skillOwnerArg(cell.skill)
        isSpeedbar = true
      }
    } else if (this.hoverSkillId !== null && this.hoveredSlot !== null) {
      skillId = this.hoverSkillId
      side = this.hoveredSlot
      anchor = side === 'left' ? this.leftSkillBounds : this.rightSkillBounds
      ownerItemId = (side === 'left' ? this.leftSkillItemId : this.rightSkillItemId) ?? 0xffffffff
      isSpeedbar = false
    }

    if (skillId === null || !anchor) return

    const lines = this.formatTooltipLines(skillId, side, isSpeedbar, this.lang, ownerItemId, granted)
    if (lines.length === 0) return

    const placement = SkillHotkeysHud.computeTooltipPlacement(
      anchor,
      lines,
      font,
      this.is640 ? 640 : 800,
      this.is640 ? 480 : 600,
    )

    // Diablo II dark translucent background
    ctx.fillStyle = 'rgba(4, 4, 4, 0.94)'
    ctx.fillRect(placement.x, placement.y, placement.w, placement.h)

    // Outer border
    ctx.strokeStyle = '#8c7244'
    ctx.lineWidth = 1
    ctx.strokeRect(placement.x + 0.5, placement.y + 0.5, placement.w - 1, placement.h - 1)

    // Inner subtle border
    ctx.strokeStyle = '#3d2b1a'
    ctx.strokeRect(placement.x + 2.5, placement.y + 2.5, placement.w - 5, placement.h - 5)

    // Render lines
    lines.forEach((l, idx) => {
      const lineY = placement.y + 12 + 10 + idx * 17
      const lineX = l.align === 'center' ? placement.x + Math.round(placement.w / 2) : placement.x + 14
      if (typeof font?.drawText === 'function') {
        font.drawText(ctx, l.text, lineX, lineY, {
          font: l.font,
          color: l.color,
          align: l.align ?? 'center',
        })
      }
    })
  }
}
