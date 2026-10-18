/**
 * Diablo II v1.13c HUD Viewport & Docking Coordinate Math + Skill Damage Formatters
 * (`src/client/ui/hud-viewport-layout.ts`).
 *
 * Extracted from `hud-manager.ts`:
 * - 800x600 / 640x480 / widescreen `ViewportProfile` aspect-ratio scaling (`computeHudLayout`)
 * - Left/right dock panel coordinate transforms (`computeDockingLayout`, `toControlBarLocal`,
 *   `toLeftDockLocal`, `fromLeftDockLocal`, `toRightDockLocal`, `fromRightDockLocal`)
 * - Client CSS <-> logical viewport coordinate conversion (`clientToLogical`, `logicalToClient`)
 * - Idle 25Hz HUD frame throttle gate (`shouldRenderHudFrame`)
 * - Equipped weapon base damage resolution & skill damage string formatting
 *   (`resolveEquippedWeaponBaseDamage`, `computeHudSkillDamageString`)
 */

import { SKILLS_BY_ID } from '../../common/data/skills-catalog.ts'
import {
  calculateDetailedDamage,
  createInitialState,
} from '../../common/skills/skill-calc-engine.ts'
import { getEmbeddedDropTables } from '../../common/items/embedded-drop-tables.ts'
import type { UiInventoryItem } from './inventory.ts'
import {
  isExtendedViewport,
  VIEWPORT_800x600,
  type ViewportProfile,
} from '../view/viewport-profile.ts'
import type { HudManager } from './hud-manager.ts'
import { crispRenderDpr, devicePixelRatioOrOne } from '../view/crisp-scale.ts'

export interface GroundItemBeamDescriptor {
  readonly id: number
  readonly quality: 'unique' | 'set'
  readonly screenX: number
  readonly screenY: number
  readonly isHovered: boolean
}

export interface HudLayout {
  readonly uiScale: number
  readonly offsetX: number
  readonly offsetY: number
  readonly dpr: number
  readonly physicalScale: number
  readonly physicalOffsetX: number
  readonly physicalOffsetY: number
}

export interface DockingLayout extends HudLayout {
  marginW: number
  leftDockX: number
  rightDockX: number
  channelLeft: number
  channelRight: number
  channelWidthLogical: number
  channelWidthCss: number
  isWidescreen: boolean
  barOffsetX?: number
  barOffsetY?: number
  panelOffsetY?: number
}

/**
 * Computes 1:1 uniform aspect ratio scaling and horizontal centering margins
 * for the active Diablo II HUD viewport (`ViewportProfile` size) onto an arbitrary window/canvas size.
 */
export function computeHudLayout(
  cssW: number,
  cssH: number,
  dpr: number = 1,
  profile: ViewportProfile = VIEWPORT_800x600,
): HudLayout {
  const safeW = Number.isFinite(cssW) && cssW > 0 ? cssW : 1
  const safeH = Number.isFinite(cssH) && cssH > 0 ? cssH : 1
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1
  const uiScale = Math.min(safeW / profile.width, safeH / profile.height)
  const offsetX = Math.max(0, (safeW - profile.width * uiScale) / 2)
  const offsetY = Math.max(0, safeH - profile.height * uiScale)

  return {
    uiScale,
    offsetX,
    offsetY,
    dpr: safeDpr,
    physicalScale: uiScale * safeDpr,
    physicalOffsetX: Math.round(offsetX * safeDpr),
    physicalOffsetY: Math.round(offsetY * safeDpr),
  }
}

export const crispHudDpr = (cssW: number, cssH: number, profile: ViewportProfile): number =>
  crispRenderDpr(computeDockingLayout(cssW, cssH, 1, profile).uiScale, devicePixelRatioOrOne())

/**
 * On-demand HUD repaint decision. The HUD is a 2D canvas covering the viewport
 * that used to repaint on every `requestAnimationFrame` (measured 60.5 clears +
 * ~2965 drawImage/s while standing still) even though its fastest real change
 * is the 25Hz server logic (orbs/belt are event-driven). Redraw immediately
 * while the mouse moves (the software cursor lives on this canvas), otherwise
 * at most every `minIntervalMs`.
 */
export function shouldRenderHudFrame(
  prev: { mouseX: number; mouseY: number; drawMs: number } | null,
  mouseX: number,
  mouseY: number,
  nowMs: number,
  minIntervalMs = 40,
): boolean {
  if (prev === null) return true
  if (mouseX !== prev.mouseX || mouseY !== prev.mouseY) return true
  return nowMs - prev.drawMs >= minIntervalMs
}

/**
 * Computes widescreen panel docking layout metrics, margins, and central vision corridor.
 *
 * Extended profiles (larger than 800×600) pin the 400px dock panels to the logical viewport edges:
 * left dock at `x = 0`, right dock at `x = width - 400`, corridor `400..width - 400`. The 800×600
 * profile docks the panels against the browser window margins instead (`marginW`).
 */
export function computeDockingLayout(
  cssW: number,
  cssH: number,
  dpr: number = 1,
  profile: ViewportProfile = VIEWPORT_800x600,
): DockingLayout {
  if (isExtendedViewport(profile)) {
    const layout = computeHudLayout(cssW, cssH, dpr, profile)
    const marginW = layout.uiScale > 0 ? layout.offsetX / layout.uiScale : 0
    const rightDockX = profile.width - 400
    const channelWidthLogical = rightDockX - 400
    return {
      ...layout,
      marginW,
      leftDockX: 0,
      rightDockX,
      channelLeft: 400,
      channelRight: rightDockX,
      channelWidthLogical,
      channelWidthCss: channelWidthLogical * layout.uiScale,
      isWidescreen: true,
      barOffsetX: profile.barOffsetX,
      barOffsetY: profile.barOffsetY,
      panelOffsetY: profile.panelOffsetY,
    }
  }

  if (profile.id === '640x480') {
    const layout = computeHudLayout(cssW, cssH, dpr, profile)
    const marginW = layout.uiScale > 0 ? layout.offsetX / layout.uiScale : 0
    return {
      ...layout,
      marginW,
      leftDockX: -80,
      rightDockX: 320,
      channelLeft: 320,
      channelRight: 320,
      channelWidthLogical: 0,
      channelWidthCss: 0,
      isWidescreen: false,
      barOffsetX: 0,
      barOffsetY: 0,
      panelOffsetY: -60,
    }
  }

  const layout = computeHudLayout(cssW, cssH, dpr, VIEWPORT_800x600)
  const marginW = layout.uiScale > 0 ? layout.offsetX / layout.uiScale : 0
  const leftDockX = 0
  const rightDockX = 400
  const channelLeft = 400
  const channelRight = 400
  const channelWidthLogical = 0
  const channelWidthCss = 0
  const isWidescreen = false

  return {
    ...layout,
    marginW,
    leftDockX,
    rightDockX,
    channelLeft,
    channelRight,
    channelWidthLogical,
    channelWidthCss,
    isWidescreen,
    barOffsetX: 0,
    barOffsetY: 0,
    panelOffsetY: 0,
  }
}

export function clientToLogical(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  dpr: number = 1,
  profile: ViewportProfile = VIEWPORT_800x600,
): { x: number; y: number } {
  const safeClientX = Number.isFinite(clientX) ? clientX : 0
  const safeClientY = Number.isFinite(clientY) ? clientY : 0
  const { uiScale, offsetX, offsetY } = computeHudLayout(rect.width, rect.height, dpr, profile)
  const left = Number.isFinite(rect.left) ? rect.left : 0
  const top = Number.isFinite(rect.top) ? rect.top : 0
  return {
    x: (safeClientX - left - offsetX) / uiScale,
    y: (safeClientY - top - offsetY) / uiScale,
  }
}

export function logicalToClient(
  logicalX: number,
  logicalY: number,
  rect: { left: number; top: number; width: number; height: number },
  dpr: number = 1,
  profile: ViewportProfile = VIEWPORT_800x600,
): { x: number; y: number } {
  const safeLogicalX = Number.isFinite(logicalX) ? logicalX : 0
  const safeLogicalY = Number.isFinite(logicalY) ? logicalY : 0
  const { uiScale, offsetX, offsetY } = computeHudLayout(rect.width, rect.height, dpr, profile)
  const left = Number.isFinite(rect.left) ? rect.left : 0
  const top = Number.isFinite(rect.top) ? rect.top : 0
  return {
    x: safeLogicalX * uiScale + left + offsetX,
    y: safeLogicalY * uiScale + top + offsetY,
  }
}

/**
 * Converts a logical viewport coordinate `(x, y)` into the 800×600-local coordinate space
 * of the bottom control bar region (`controlBar`, `globes`, `belt`, `hotkeys`).
 */
export function toControlBarLocal(
  x: number,
  y: number,
  docking: Pick<DockingLayout, 'barOffsetX' | 'barOffsetY'>,
): { x: number; y: number } {
  return {
    x: x - (docking.barOffsetX ?? 0),
    y: y - (docking.barOffsetY ?? 0),
  }
}

/**
 * Converts a logical viewport coordinate `(x, y)` into the 800×600-local coordinate space
 * of the left dock panel region (`charSheet`, `worldPanels`).
 */
export function toLeftDockLocal(
  x: number,
  y: number,
  docking: Pick<DockingLayout, 'leftDockX' | 'panelOffsetY'>,
): { x: number; y: number } {
  return {
    x: x - docking.leftDockX,
    y: y - (docking.panelOffsetY ?? 0),
  }
}

/**
 * Reverse-translates a left-dock-local coordinate `(localX, localY)` back into
 * logical viewport coordinates (used for hovered item tooltip anchoring).
 */
export function fromLeftDockLocal(
  localX: number,
  localY: number,
  docking: Pick<DockingLayout, 'leftDockX' | 'panelOffsetY'>,
): { x: number; y: number } {
  return {
    x: localX + docking.leftDockX,
    y: localY + (docking.panelOffsetY ?? 0),
  }
}

/**
 * Converts a logical viewport coordinate `(x, y)` into the 800×600-local coordinate space
 * of the right dock panel region (`inventory`, `skillTree`), where the right panel is
 * authored at `x = 400..800, y = 0..553`.
 */
export function toRightDockLocal(
  x: number,
  y: number,
  docking: Pick<DockingLayout, 'rightDockX' | 'panelOffsetY'>,
): { x: number; y: number } {
  const deltaRight = docking.rightDockX - 400
  return {
    x: x - deltaRight,
    y: y - (docking.panelOffsetY ?? 0),
  }
}

/**
 * Reverse-translates a right-dock-local coordinate `(localX, localY)` back into
 * logical viewport coordinates (used for hovered item tooltip anchoring).
 */
export function fromRightDockLocal(
  localX: number,
  localY: number,
  docking: Pick<DockingLayout, 'rightDockX' | 'panelOffsetY'>,
): { x: number; y: number } {
  const deltaRight = docking.rightDockX - 400
  return {
    x: localX + deltaRight,
    y: localY + (docking.panelOffsetY ?? 0),
  }
}

/**
 * Ground Truth (Diablo II v1.13c):
 * Resolves base physical damage `(min, max)` for an equipped weapon `UiInventoryItem`,
 * consulting structured fields (`minDamage`/`maxDamage`, `rawItem.base`) and canonical
 * `Weapons.txt` (`getEmbeddedDropTables().weapons.get(code)`) before falling back to
 * tooltip string parsing for synthetic items without a canonical code.
 */
export function resolveEquippedWeaponBaseDamage(
  weapon: UiInventoryItem | null | undefined,
  skillId: number,
): { min: number; max: number } | null {
  if (!weapon) return null

  const isThrowSkill = skillId === 2 || skillId === 4
  const structured = weapon as {
    minDamage?: number
    maxDamage?: number
    twoHandMinDamage?: number
    twoHandMaxDamage?: number
    throwMinDamage?: number
    throwMaxDamage?: number
  }
  if (
    isThrowSkill &&
    typeof structured.throwMinDamage === 'number' &&
    typeof structured.throwMaxDamage === 'number' &&
    structured.throwMaxDamage > 0
  ) {
    return { min: structured.throwMinDamage, max: structured.throwMaxDamage }
  }
  if (
    typeof structured.minDamage === 'number' &&
    typeof structured.maxDamage === 'number' &&
    structured.maxDamage > 0
  ) {
    return { min: structured.minDamage, max: structured.maxDamage }
  }

  const rawBase = weapon.rawItem?.base as
    | {
        kind?: string
        mindam?: number
        maxdam?: number
        twoHandedMindam?: number
        twoHandedMaxdam?: number
        minMisDam?: number
        maxMisDam?: number
        twoHanded?: boolean
      }
    | undefined
  if (rawBase) {
    if (
      isThrowSkill &&
      typeof rawBase.minMisDam === 'number' &&
      typeof rawBase.maxMisDam === 'number' &&
      rawBase.maxMisDam > 0
    ) {
      return { min: rawBase.minMisDam, max: rawBase.maxMisDam }
    }
    if (
      rawBase.twoHanded &&
      typeof rawBase.twoHandedMindam === 'number' &&
      typeof rawBase.twoHandedMaxdam === 'number' &&
      rawBase.twoHandedMaxdam > 0
    ) {
      return { min: rawBase.twoHandedMindam, max: rawBase.twoHandedMaxdam }
    }
    if (
      typeof rawBase.mindam === 'number' &&
      typeof rawBase.maxdam === 'number' &&
      rawBase.maxdam > 0
    ) {
      return { min: rawBase.mindam, max: rawBase.maxdam }
    }
  }

  const code = (weapon.code ?? '').trim().toLowerCase()
  if (code) {
    const wRow = getEmbeddedDropTables().weapons.get(code)
    if (wRow) {
      if (
        isThrowSkill &&
        typeof wRow.minMisDam === 'number' &&
        typeof wRow.maxMisDam === 'number' &&
        wRow.maxMisDam > 0
      ) {
        return { min: wRow.minMisDam, max: wRow.maxMisDam }
      }
      if (
        wRow.twoHanded &&
        typeof wRow.twoHandedMindam === 'number' &&
        typeof wRow.twoHandedMaxdam === 'number' &&
        wRow.twoHandedMaxdam > 0
      ) {
        return { min: wRow.twoHandedMindam, max: wRow.twoHandedMaxdam }
      }
      if (typeof wRow.mindam === 'number' && typeof wRow.maxdam === 'number' && wRow.maxdam > 0) {
        return { min: wRow.mindam, max: wRow.maxdam }
      }
    }
  }

  // Fallback for synthetic test items without a canonical Weapons.txt code
  const dmgText = weapon.damageEn ?? weapon.damage ?? ''
  const m = /(\d+)\s*(?:-|to)\s*(\d+)/.exec(dmgText)
  if (m) {
    return { min: Number(m[1]), max: Number(m[2]) }
  }

  return null
}

/**
 * Shared 1.13c HUD skill damage string evaluator used by both `HudManager` and `HudModel`.
 */
export function computeHudSkillDamageString(
  skillId: number,
  hud: HudManager,
  fallbackSkillEntries?: ReadonlyMap<
    number,
    {
      readonly level: number
      readonly baseLevel?: number | undefined
      readonly bonus?: number | undefined
    }
  >,
  activeStates?: ReadonlySet<number>,
): string {
  const strBonus = 1 + (hud.charSheet.attrs.str || 0) / 100
  if (skillId === 0 || skillId === 2 || skillId === 4) {
    const w = skillId === 4 ? hud.inventory.equipped.weapon2 : hud.inventory.equipped.weapon1
    const baseDmg = resolveEquippedWeaponBaseDamage(w, skillId)
    if (baseDmg) {
      const minDmg = Math.max(1, Math.floor(baseDmg.min * strBonus))
      const maxDmg = Math.max(minDmg + 1, Math.floor(baseDmg.max * strBonus))
      return `${minDmg}-${maxDmg}`
    }
    if (skillId === 0) {
      const minDmg = Math.max(1, Math.floor(1 * strBonus))
      const maxDmg = Math.max(2, Math.floor(2 * strBonus))
      return `${minDmg}-${maxDmg}`
    }
    return '--'
  }

  const def = SKILLS_BY_ID[skillId]
  if (!def) return '--'
  const treeEff = hud.skillTree.getEffectiveLevel(skillId)
  const sl = fallbackSkillEntries?.get(skillId)
  const effLvl =
    treeEff > 0
      ? treeEff
      : fallbackSkillEntries !== undefined
        ? sl
          ? Math.max(0, (sl.baseLevel ?? sl.level) + (sl.bonus ?? 0))
          : 0
        : 1
  if (effLvl <= 0) return '--'

  const calcState = createInitialState((hud.currentClass ?? def.classCode ?? 'sor') as any)
  for (const [id, pts] of hud.skillTree.hardPoints.entries()) {
    calcState.hardPoints[id] = pts
  }
  for (const [id, bon] of hud.skillTree.bonusLevels.entries()) {
    if (fallbackSkillEntries === undefined || (hud.skillTree.hardPoints.get(id) ?? 0) > 0) {
      calcState.specificSoftPoints[id] = bon
    }
  }
  const dmg = calculateDetailedDamage(calcState, def, effLvl)
  if (dmg.hasDamage && dmg.finalMax > 0) {
    let concBonusPct = 0
    if (skillId === 112 && (activeStates?.has(42) || hud.hotkeys.rightSkillId === 113)) {
      const concTreeEff = hud.skillTree.getEffectiveLevel(113)
      const concSl = fallbackSkillEntries?.get(113)
      const concLvl =
        concTreeEff > 0
          ? concTreeEff
          : concSl
            ? Math.max(0, (concSl.baseLevel ?? concSl.level) + (concSl.bonus ?? 0))
            : activeStates?.has(42)
              ? 1
              : 0
      if (concLvl > 0) {
        concBonusPct = Math.floor((60 + 15 * (concLvl - 1)) / 2)
      }
    }
    const finalMin = Math.floor((dmg.finalMin * (100 + concBonusPct)) / 100)
    const finalMax = Math.floor((dmg.finalMax * (100 + concBonusPct)) / 100)
    return `${finalMin}-${finalMax}`
  }
  return '--'
}

export function getHudCanvasRect(hud: HudManager): DOMRect {
  const internal = hud as unknown as {
    readonly hudCanvas: HTMLCanvasElement
    cachedCanvasRect: DOMRect | null
    cachedCanvasRectKey: string
  }
  const hasWindow = typeof window !== 'undefined'
  const dpr = hasWindow && window.devicePixelRatio ? window.devicePixelRatio : 1
  const winW = hasWindow && window.innerWidth ? window.innerWidth : hud.viewportProfile.width
  const winH = hasWindow && window.innerHeight ? window.innerHeight : hud.viewportProfile.height
  const cw = internal.hudCanvas?.clientWidth ?? 0
  const ch = internal.hudCanvas?.clientHeight ?? 0
  const w = internal.hudCanvas?.width ?? 0
  const h = internal.hudCanvas?.height ?? 0
  const key = `${cw}:${ch}:${w}:${h}:${winW}:${winH}:${dpr}:${hud.viewportProfile.id}`
  if (internal.cachedCanvasRect && internal.cachedCanvasRectKey === key) {
    return internal.cachedCanvasRect
  }
  const fallbackW = cw || w || hud.viewportProfile.width
  const fallbackH = ch || h || hud.viewportProfile.height
  const rect =
    internal.hudCanvas?.getBoundingClientRect?.() ??
    ({
      left: 0,
      top: 0,
      width: fallbackW,
      height: fallbackH,
      right: fallbackW,
      bottom: fallbackH,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)
  internal.cachedCanvasRect = rect
  internal.cachedCanvasRectKey = key
  return rect
}

export function getActiveHudDockingLayout(hud: HudManager): DockingLayout {
  const internal = hud as unknown as {
    readonly hudCanvas: HTMLCanvasElement
    activeRenderDockingLayout: DockingLayout | null
    getCanvasRect(): DOMRect
  }
  if (internal.activeRenderDockingLayout) {
    return internal.activeRenderDockingLayout
  }
  const hasWindow = typeof window !== 'undefined'
  const dpr = Math.min(hasWindow && window.devicePixelRatio ? window.devicePixelRatio : 1, 2)
  const cw = internal.hudCanvas?.clientWidth ?? 0
  const ch = internal.hudCanvas?.clientHeight ?? 0
  const rect = cw > 0 && ch > 0 ? null : internal.getCanvasRect()
  const canvasW = cw || rect?.width || (internal.hudCanvas?.width ?? 0)
  const canvasH = ch || rect?.height || (internal.hudCanvas?.height ?? 0)
  const winW = hasWindow && window.innerWidth ? window.innerWidth : hud.viewportProfile.width
  const winH = hasWindow && window.innerHeight ? window.innerHeight : hud.viewportProfile.height
  const cssW = Math.max(320, canvasW || winW)
  const cssH = Math.max(240, canvasH || winH)
  return computeDockingLayout(cssW, cssH, dpr, hud.viewportProfile)
}
