/**
 * Diablo II: Resurrected (D2R) Mobile Twin-Stick, Cone Targeting, Compact Center HUD & 6x2 Skill Wheel
 * (`src/client/ui/touch-controls.ts`, Phase 2 Issue #1382 & Phase 3 Issue #1383).
 */

import type { D2FontRenderer } from './font.ts'
import type { MonsterTargetHudInfo } from './world-panels.ts'
import type { HudLayoutMode, SkillWheelBankMode } from '../settings/client-settings.ts'
import { isUsableRightClickItem, type EquipSlotId, type UiInventoryItem } from './inventory.ts'
import { isAutoBeltablePotion } from './belt.ts'
import type { BaseStatKey } from './character-sheet.ts'

export const JOYSTICK_OUTER_RADIUS = 68
export const JOYSTICK_WALK_RADIUS = 44
export const JOYSTICK_KNOB_RADIUS = 23
export const JOYSTICK_DEADZONE_RATIO = 0.12
export const JOYSTICK_AUTORUN_RATIO = 0.65

export const DEFAULT_CONE_HALF_ANGLE_RAD = Math.PI / 4 // ±45°
export const DEFAULT_CONE_MAX_SCREEN_RANGE = 380
export const DEFAULT_INTERACT_MAX_SCREEN_RANGE = 135

export const COMPACT_HUD_WIDTH = 524
export const COMPACT_HUD_HEIGHT = 104
export const COMPACT_BELT_SLOT_SIZE = 44
export const COMPACT_BELT_SLOT_GAP = 6
export const SKILL_WHEEL_MAIN_RADIUS = 39
export const SKILL_WHEEL_SLOT_RADIUS = 25
export const SKILL_WHEEL_ARC_RADIUS = 114
export const SKILL_WHEEL_ARC_ANGLES_DEG: readonly [number, number, number, number, number] = [
  186, 215, 244, 273, 302,
] as const

export type JoystickLocomotionMode = 'idle' | 'walk' | 'run'

export interface DynamicJoystickState {
  readonly active: boolean
  readonly pointerId: number | null
  readonly originX: number
  readonly originY: number
  readonly currentX: number
  readonly currentY: number
  readonly knobX: number
  readonly knobY: number
  readonly dx: number
  readonly dy: number
  readonly angleRad: number
  readonly magnitude: number
  readonly locomotionMode: JoystickLocomotionMode
}

export interface ConeMonsterCandidate {
  readonly unitId: number
  readonly name: string
  readonly screenX: number
  readonly screenY: number
  readonly hp: number
  readonly maxHp: number
  readonly isDead?: boolean | undefined
  readonly isBoss?: boolean | undefined
  readonly isSuperUnique?: boolean | undefined
  readonly isUnique?: boolean | undefined
  readonly isChampion?: boolean | undefined
  readonly isUndead?: boolean | undefined
  readonly isDemon?: boolean | undefined
  readonly descriptors?: readonly string[] | undefined
  readonly resists?: MonsterTargetHudInfo['resists'] | undefined
}

export type InteractableCandidateKind = 'item' | 'npc' | 'object' | 'warp'

export interface ConeInteractableCandidate {
  readonly id: number
  readonly kind: InteractableCandidateKind
  readonly label: string
  readonly screenX: number
  readonly screenY: number
  readonly qualityRank?: number | undefined
}

export interface ScoredMonsterTarget {
  readonly candidate: ConeMonsterCandidate
  readonly score: number
  readonly distancePx: number
  readonly angleDiffRad: number
}

export interface ConeTargetSelectionResult {
  readonly lockedMonster: ScoredMonsterTarget | null
  readonly lockedInteractable: ConeInteractableCandidate | null
  readonly coneAngleRad: number
  readonly coneHalfAngleRad: number
}

export type CompactUtilityAction = 'char' | 'inv' | 'skill' | 'automap' | 'altLabels' | 'menu'

export interface CompactD2rHudMetrics {
  readonly logicalWidth: number
  readonly logicalHeight: number
  readonly barX: number
  readonly barY: number
  readonly barWidth: number
  readonly barHeight: number
  readonly leftGlobe: { readonly cx: number; readonly cy: number; readonly r: number }
  readonly rightGlobe: { readonly cx: number; readonly cy: number; readonly r: number }
  readonly consoleBox: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  readonly beltSlots: readonly { readonly col: 0 | 1 | 2 | 3; readonly x: number; readonly y: number; readonly size: number }[]
  readonly popbeltDrawer: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  readonly refillBtn: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  readonly runBtn: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  readonly wheel: {
    readonly cx: number
    readonly cy: number
    readonly mainR: number
    readonly arcRadius: number
    readonly slotR: number
    readonly arcSlots: readonly {
      readonly arcIndex: 0 | 1 | 2 | 3 | 4
      readonly cx: number
      readonly cy: number
      readonly r: number
    }[]
  }
  readonly l2PreviewBar: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly l2Btn: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  }
  readonly lootBtn: { readonly cx: number; readonly cy: number; readonly r: number }
  readonly weaponSwapBtn: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  readonly topUtilityBar: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly buttons: readonly {
      readonly action: CompactUtilityAction
      readonly labelZh: string
      readonly labelEn: string
      readonly x: number
      readonly y: number
      readonly width: number
      readonly height: number
    }[]
  }
}

export type CompactHudHitResult =
  | { readonly kind: 'beltSlot'; readonly col: 0 | 1 | 2 | 3 }
  | { readonly kind: 'popbeltCell'; readonly col: 0 | 1 | 2 | 3; readonly row: 1 | 2 | 3 }
  | { readonly kind: 'beltAutoRefill' }
  | { readonly kind: 'runToggle' }
  | { readonly kind: 'lifeGlobe' }
  | { readonly kind: 'manaGlobe' }
  | { readonly kind: 'l2BankSwitch' }
  | { readonly kind: 'primarySkill'; readonly hotkeyIndex: number }
  | { readonly kind: 'wheelSkill'; readonly arcIndex: 0 | 1 | 2 | 3 | 4; readonly hotkeyIndex: number }
  | { readonly kind: 'contextLootInteract' }
  | { readonly kind: 'weaponSwap' }
  | { readonly kind: 'utilityAction'; readonly action: CompactUtilityAction }
  | { readonly kind: 'compactBarChrome' }

export interface SkillWheelSlotDescriptor {
  readonly hotkeyIndex: number
  readonly keyLabel: string
  readonly skillId: number
  readonly name: string
  readonly hand?: 'left' | 'right' | undefined
  readonly manaCost?: number | undefined
  readonly cooldownRemainingSec?: number | undefined
  readonly charges?: number | undefined
  readonly directionalAim?: boolean | undefined
}

export interface VectorAimState {
  readonly active: boolean
  readonly pointerId: number
  readonly hotkeyIndex: number
  readonly skillId: number
  readonly originX: number
  readonly originY: number
  readonly targetScreenX: number
  readonly targetScreenY: number
}

export function createIdleJoystickState(defaultX = 148, defaultY = 456): DynamicJoystickState {
  return {
    active: false,
    pointerId: null,
    originX: defaultX,
    originY: defaultY,
    currentX: defaultX,
    currentY: defaultY,
    knobX: defaultX,
    knobY: defaultY,
    dx: 0,
    dy: 0,
    angleRad: -Math.PI / 4,
    magnitude: 0,
    locomotionMode: 'idle',
  }
}

export function computeJoystickVector(
  originX: number,
  originY: number,
  currentX: number,
  currentY: number,
  pointerId: number | null = 1,
  outerRadius: number = JOYSTICK_OUTER_RADIUS,
  fallbackAngleRad: number = -Math.PI / 4,
): DynamicJoystickState {
  const safeR = outerRadius > 0 ? outerRadius : JOYSTICK_OUTER_RADIUS
  const rawDx = currentX - originX
  const rawDy = currentY - originY
  const dist = Math.hypot(rawDx, rawDy)
  const clampedDist = Math.min(safeR, dist)
  const magnitude = clampedDist / safeR

  if (dist < 1e-4 || magnitude < JOYSTICK_DEADZONE_RATIO) {
    return {
      active: pointerId !== null,
      pointerId,
      originX,
      originY,
      currentX,
      currentY,
      knobX: originX + (dist > 1e-4 ? (rawDx / dist) * clampedDist : 0),
      knobY: originY + (dist > 1e-4 ? (rawDy / dist) * clampedDist : 0),
      dx: 0,
      dy: 0,
      angleRad: dist > 1e-4 ? Math.atan2(rawDy, rawDx) : fallbackAngleRad,
      magnitude: 0,
      locomotionMode: 'idle',
    }
  }

  const ux = rawDx / dist
  const uy = rawDy / dist
  const angleRad = Math.atan2(uy, ux)
  const locomotionMode: JoystickLocomotionMode =
    magnitude >= JOYSTICK_AUTORUN_RATIO ? 'run' : 'walk'

  return {
    active: pointerId !== null,
    pointerId,
    originX,
    originY,
    currentX,
    currentY,
    knobX: originX + ux * clampedDist,
    knobY: originY + uy * clampedDist,
    dx: ux * magnitude,
    dy: uy * magnitude,
    angleRad,
    magnitude,
    locomotionMode,
  }
}

export function computeJoystickWorldSubTileTarget(
  playerSubTileX: number,
  playerSubTileY: number,
  screenDx: number,
  screenDy: number,
  stepDistanceSubTiles: number = 6,
): { readonly x: number; readonly y: number } {
  const len = Math.hypot(screenDx, screenDy)
  if (len < 1e-4 || !Number.isFinite(stepDistanceSubTiles) || stepDistanceSubTiles <= 0) {
    return {
      x: Math.round(playerSubTileX),
      y: Math.round(playerSubTileY),
    }
  }
  const nx = screenDx / len
  const ny = screenDy / len
  const rawSubDx = nx + 2 * ny
  const rawSubDy = 2 * ny - nx
  const subLen = Math.hypot(rawSubDx, rawSubDy)
  const scale = subLen > 1e-4 ? stepDistanceSubTiles / subLen : 0

  return {
    x: Math.round(playerSubTileX + rawSubDx * scale),
    y: Math.round(playerSubTileY + rawSubDy * scale),
  }
}

export function angularDistanceRad(a: number, b: number): number {
  let diff = (a - b) % (Math.PI * 2)
  if (diff > Math.PI) diff -= Math.PI * 2
  if (diff < -Math.PI) diff += Math.PI * 2
  return Math.abs(diff)
}

export function scoreConeMonsterCandidate(
  playerScreenX: number,
  playerScreenY: number,
  coneAngleRad: number,
  candidate: ConeMonsterCandidate,
  coneHalfAngleRad: number = DEFAULT_CONE_HALF_ANGLE_RAD,
  maxRangePx: number = DEFAULT_CONE_MAX_SCREEN_RANGE,
): ScoredMonsterTarget | null {
  if (candidate.isDead || candidate.hp <= 0) return null
  const dx = candidate.screenX - playerScreenX
  const dy = candidate.screenY - playerScreenY
  const distancePx = Math.hypot(dx, dy)
  if (!Number.isFinite(distancePx) || distancePx > maxRangePx) return null

  const targetAngle = distancePx > 1e-3 ? Math.atan2(dy, dx) : coneAngleRad
  const angleDiffRad = distancePx > 1e-3 ? angularDistanceRad(targetAngle, coneAngleRad) : 0

  const effectiveHalfAngle =
    distancePx <= 48 ? Math.max(coneHalfAngleRad, (75 * Math.PI) / 180) : coneHalfAngleRad
  if (angleDiffRad > effectiveHalfAngle) {
    return null
  }

  const distRatio = Math.max(0, 1 - distancePx / Math.max(1, maxRangePx))
  const alignRatio = Math.max(
    0,
    Math.cos((angleDiffRad / Math.max(1e-4, effectiveHalfAngle)) * (Math.PI / 2)),
  )

  let tierBonus = 0
  if (candidate.isBoss || candidate.isSuperUnique || candidate.isUnique) {
    tierBonus = 0.35
  } else if (candidate.isChampion) {
    tierBonus = 0.2
  }

  const score = distRatio * 0.55 + alignRatio * 0.45 + tierBonus
  return {
    candidate,
    score,
    distancePx,
    angleDiffRad,
  }
}

export function selectBestConeTargets(
  playerScreenX: number,
  playerScreenY: number,
  coneAngleRad: number,
  monsters: readonly ConeMonsterCandidate[],
  interactables: readonly ConeInteractableCandidate[] = [],
  coneHalfAngleRad: number = DEFAULT_CONE_HALF_ANGLE_RAD,
  maxMonsterRangePx: number = DEFAULT_CONE_MAX_SCREEN_RANGE,
  maxInteractRangePx: number = DEFAULT_INTERACT_MAX_SCREEN_RANGE,
): ConeTargetSelectionResult {
  let bestMonster: ScoredMonsterTarget | null = null
  for (let i = 0; i < monsters.length; i++) {
    const m = monsters[i]
    if (!m) continue
    const scored = scoreConeMonsterCandidate(
      playerScreenX,
      playerScreenY,
      coneAngleRad,
      m,
      coneHalfAngleRad,
      maxMonsterRangePx,
    )
    if (!scored) continue
    if (bestMonster === null || scored.score > bestMonster.score) {
      bestMonster = scored
    }
  }

  let bestInteractable: ConeInteractableCandidate | null = null
  let bestInteractScore = -Infinity
  for (let i = 0; i < interactables.length; i++) {
    const item = interactables[i]
    if (!item) continue
    const dx = item.screenX - playerScreenX
    const dy = item.screenY - playerScreenY
    const dist = Math.hypot(dx, dy)
    if (!Number.isFinite(dist) || dist > maxInteractRangePx) continue
    const angleDiff = dist > 1e-3 ? angularDistanceRad(Math.atan2(dy, dx), coneAngleRad) : 0
    const inForwardCone = angleDiff <= coneHalfAngleRad * 1.25
    const distScore = 1 - dist / Math.max(1, maxInteractRangePx)
    const qualityScore = (item.qualityRank ?? 1) * 0.12
    const coneBonus = inForwardCone ? 0.2 : 0
    const totalScore = distScore + qualityScore + coneBonus
    if (totalScore > bestInteractScore) {
      bestInteractScore = totalScore
      bestInteractable = item
    }
  }

  return {
    lockedMonster: bestMonster,
    lockedInteractable: bestInteractable,
    coneAngleRad,
    coneHalfAngleRad,
  }
}

export function toMonsterTargetHudInfo(candidate: ConeMonsterCandidate): MonsterTargetHudInfo {
  const rank: MonsterTargetHudInfo['rank'] = candidate.isBoss
    ? 'boss'
    : candidate.isSuperUnique
      ? 'superunique'
      : candidate.isUnique
        ? 'unique'
        : candidate.isChampion
          ? 'champion'
          : 'normal'
  return {
    unitId: candidate.unitId,
    name: candidate.name,
    hp: Math.max(0, candidate.hp),
    maxHp: Math.max(1, candidate.maxHp),
    rank,
    isBoss: candidate.isBoss,
    isUndead: candidate.isUndead,
    isDemon: candidate.isDemon,
    modifiers: candidate.descriptors ? [...candidate.descriptors] : undefined,
    resists: candidate.resists,
  }
}

/**
 * Compute pixel-exact geometry for the Phase 3 (#1383) D2R 524px Compact Center Bar,
 * Top-Right 6-in-1 Utility Bar, and Bottom-Right 6x2 Skill Wheel for any logical viewport size.
 */
export function computeCompactD2rHudMetrics(
  logicalWidth: number = 1280,
  logicalHeight: number = 600,
): CompactD2rHudMetrics {
  const barWidth = COMPACT_HUD_WIDTH
  const barHeight = COMPACT_HUD_HEIGHT
  const barX = Math.round((logicalWidth - barWidth) / 2)
  const barY = logicalHeight - barHeight

  const leftGlobe = { cx: barX + 64, cy: barY + 46, r: 40 }
  const rightGlobe = { cx: barX + barWidth - 64, cy: barY + 46, r: 40 }
  const consoleBox = { x: barX + 102, y: barY + 28, width: barWidth - 204, height: 74 }

  const beltStartX = consoleBox.x + 18
  const beltRow0Y = barY + 34
  const beltSlots = ([0, 1, 2, 3] as const).map((col) => ({
    col,
    x: beltStartX + col * (COMPACT_BELT_SLOT_SIZE + COMPACT_BELT_SLOT_GAP),
    y: beltRow0Y,
    size: COMPACT_BELT_SLOT_SIZE,
  }))

  const beltTotalW = 4 * COMPACT_BELT_SLOT_SIZE + 3 * COMPACT_BELT_SLOT_GAP
  const popbeltDrawer = {
    x: beltStartX - 8,
    y: beltRow0Y - 3 * (COMPACT_BELT_SLOT_SIZE + 4) - 22,
    width: beltTotalW + 16,
    height: 3 * (COMPACT_BELT_SLOT_SIZE + 4) + 20,
  }

  const utilColX = beltStartX + beltTotalW + 8
  const refillBtn = { x: utilColX, y: beltRow0Y, width: 48, height: 20 }
  const runBtn = { x: utilColX, y: beltRow0Y + 24, width: 48, height: 22 }

  const wheelCx = logicalWidth - 134
  const wheelCy = logicalHeight - 122
  const arcSlots = ([0, 1, 2, 3, 4] as const).map((arcIndex) => {
    const rad = (SKILL_WHEEL_ARC_ANGLES_DEG[arcIndex] * Math.PI) / 180
    return {
      arcIndex,
      cx: Math.round(wheelCx + Math.cos(rad) * SKILL_WHEEL_ARC_RADIUS),
      cy: Math.round(wheelCy + Math.sin(rad) * SKILL_WHEEL_ARC_RADIUS),
      r: SKILL_WHEEL_SLOT_RADIUS,
    }
  })

  const previewStartX = logicalWidth - 260
  const previewY = logicalHeight - 310
  const l2PreviewBar = {
    x: previewStartX - 68,
    y: previewY - 20,
    width: 294,
    height: 52,
    l2Btn: { x: previewStartX - 62, y: previewY - 14, width: 56, height: 40 },
  }

  const lootBtn = { cx: wheelCx - 98, cy: wheelCy + 56, r: 27 }
  const weaponSwapBtn = { x: wheelCx + 56, y: wheelCy + 34, width: 56, height: 36 }

  const utilDefinitions: readonly {
    action: CompactUtilityAction
    labelZh: string
    labelEn: string
  }[] = [
    { action: 'char', labelZh: '人物', labelEn: 'Char' },
    { action: 'inv', labelZh: '背包', labelEn: 'Inv' },
    { action: 'skill', labelZh: '技能树', labelEn: 'Skills' },
    { action: 'automap', labelZh: '小地图', labelEn: 'Map' },
    { action: 'altLabels', labelZh: '物品名', labelEn: 'Loot' },
    { action: 'menu', labelZh: '菜单', labelEn: 'Menu' },
  ]
  const utilBtnSize = 44
  const utilBtnGap = 8
  const utilTotalW = utilDefinitions.length * utilBtnSize + (utilDefinitions.length - 1) * utilBtnGap
  const utilBarX = logicalWidth - utilTotalW - 22
  const utilBarY = 10
  const topUtilityBar = {
    x: utilBarX - 8,
    y: utilBarY - 4,
    width: utilTotalW + 16,
    height: utilBtnSize + 10,
    buttons: utilDefinitions.map((def, idx) => ({
      ...def,
      x: utilBarX + idx * (utilBtnSize + utilBtnGap),
      y: utilBarY,
      width: utilBtnSize,
      height: utilBtnSize,
    })),
  }

  return {
    logicalWidth,
    logicalHeight,
    barX,
    barY,
    barWidth,
    barHeight,
    leftGlobe,
    rightGlobe,
    consoleBox,
    beltSlots,
    popbeltDrawer,
    refillBtn,
    runBtn,
    wheel: {
      cx: wheelCx,
      cy: wheelCy,
      mainR: SKILL_WHEEL_MAIN_RADIUS,
      arcRadius: SKILL_WHEEL_ARC_RADIUS,
      slotR: SKILL_WHEEL_SLOT_RADIUS,
      arcSlots,
    },
    l2PreviewBar,
    lootBtn,
    weaponSwapBtn,
    topUtilityBar,
  }
}

function pointInRect(
  x: number,
  y: number,
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

function pointInCircle(x: number, y: number, cx: number, cy: number, r: number): boolean {
  return Math.hypot(x - cx, y - cy) <= r
}

/**
 * Hit-test the Phase 3 D2R Compact Center Bar, 6x2 Skill Wheel, and Top-Right 6-in-1 Utility Bar.
 */
export function hitTestCompactD2rHud(
  x: number,
  y: number,
  logicalWidth: number,
  logicalHeight: number,
  beltExpanded: boolean = false,
  activeBank: 0 | 1 = 0,
): CompactHudHitResult | null {
  const m = computeCompactD2rHudMetrics(logicalWidth, logicalHeight)
  const bankOffset = activeBank === 1 ? 6 : 0

  // 1. Top-Right 6-in-1 Utility Bar
  for (const btn of m.topUtilityBar.buttons) {
    if (pointInRect(x, y, btn)) {
      return { kind: 'utilityAction', action: btn.action }
    }
  }

  // 2. Popbelt 4x4 Expanded Drawer (rows 1..3)
  if (beltExpanded && pointInRect(x, y, m.popbeltDrawer)) {
    const beltStartX = m.beltSlots[0]!.x
    const beltRow0Y = m.beltSlots[0]!.y
    for (const r of [1, 2, 3] as const) {
      const cellY = beltRow0Y - r * (COMPACT_BELT_SLOT_SIZE + 4)
      for (const c of [0, 1, 2, 3] as const) {
        const cellX = beltStartX + c * (COMPACT_BELT_SLOT_SIZE + COMPACT_BELT_SLOT_GAP)
        if (
          x >= cellX &&
          x <= cellX + COMPACT_BELT_SLOT_SIZE &&
          y >= cellY &&
          y <= cellY + COMPACT_BELT_SLOT_SIZE
        ) {
          return { kind: 'popbeltCell', col: c, row: r }
        }
      }
    }
    return { kind: 'compactBarChrome' }
  }

  // 3. L2 Bank Switcher Pill Button
  if (pointInRect(x, y, m.l2PreviewBar.l2Btn)) {
    return { kind: 'l2BankSwitch' }
  }

  // 4. Primary Skill Wheel Slot (F6 in Bank 0 -> hotkeyIndex 5; F12 in Bank 1 -> hotkeyIndex 11)
  if (pointInCircle(x, y, m.wheel.cx, m.wheel.cy, m.wheel.mainR + 4)) {
    return { kind: 'primarySkill', hotkeyIndex: bankOffset + 5 }
  }

  // 5. 5 Satellite Arc Skill Slots (F1..F5 in Bank 0 -> 0..4; F7..F11 in Bank 1 -> 6..10)
  for (const slot of m.wheel.arcSlots) {
    if (pointInCircle(x, y, slot.cx, slot.cy, slot.r + 3)) {
      return {
        kind: 'wheelSkill',
        arcIndex: slot.arcIndex,
        hotkeyIndex: bankOffset + slot.arcIndex,
      }
    }
  }

  // 6. Dedicated Context Loot / Interact Button ([A 拾取])
  if (pointInCircle(x, y, m.lootBtn.cx, m.lootBtn.cy, m.lootBtn.r + 2)) {
    return { kind: 'contextLootInteract' }
  }

  // 7. Weapon Swap Button ([W 武器 I/II])
  if (pointInRect(x, y, m.weaponSwapBtn)) {
    return { kind: 'weaponSwap' }
  }

  // 8. Enlarged 4x1 Belt Slots
  for (const b of m.beltSlots) {
    if (x >= b.x && x <= b.x + b.size && y >= b.y && y <= b.y + b.size) {
      return { kind: 'beltSlot', col: b.col }
    }
  }

  // 9. Belt Auto-Refill & Run/Walk Toggle Buttons
  if (pointInRect(x, y, m.refillBtn)) {
    return { kind: 'beltAutoRefill' }
  }
  if (pointInRect(x, y, m.runBtn)) {
    return { kind: 'runToggle' }
  }

  // 10. Life & Mana Globes
  if (pointInCircle(x, y, m.leftGlobe.cx, m.leftGlobe.cy, m.leftGlobe.r)) {
    return { kind: 'lifeGlobe' }
  }
  if (pointInCircle(x, y, m.rightGlobe.cx, m.rightGlobe.cy, m.rightGlobe.r)) {
    return { kind: 'manaGlobe' }
  }

  // 11. Any remaining part of the 524px Compact Center Bar
  if (
    x >= m.barX &&
    x <= m.barX + m.barWidth &&
    y >= m.barY + 24 &&
    y <= m.barY + m.barHeight
  ) {
    return { kind: 'compactBarChrome' }
  }

  return null
}

/**
 * Detect whether the current browser runtime is in mobile / touch mode
 * (including Chrome DevTools Device Toolbar / Mobile Emulation, iOS Safari, Android Chrome,
 * or compact landscape touch viewports). Returns `false` in Node/Vitest or standard desktop browsers.
 */
export function detectMobileTouchEnvironment(
  win: Window | undefined = typeof window !== 'undefined' ? window : undefined,
): boolean {
  if (!win) return false
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) {
      return true
    }
    const coarsePointer = win.matchMedia?.('(pointer: coarse)')?.matches === true
    const hoverNone = win.matchMedia?.('(hover: none)')?.matches === true
    if (coarsePointer && hoverNone) {
      return true
    }
    const w = Number(win.innerWidth) || 0
    const h = Number(win.innerHeight) || 0
    const shortSide = w > 0 && h > 0 ? Math.min(w, h) : 0
    if (
      shortSide > 0 &&
      shortSide <= 540 &&
      (coarsePointer || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || w > h)
    ) {
      return true
    }
  } catch {
    // ignore matchMedia / navigator errors in restricted environments
  }
  return false
}

export class TouchControlsHud {
  private _enabled: boolean = detectMobileTouchEnvironment()
  private _manualOverride: boolean | null = null
  private _lastEnvDetected: boolean = this._enabled

  /** Whether mobile/touch twin-stick overlay is active. */
  get enabled(): boolean {
    return this._enabled
  }
  set enabled(val: boolean) {
    this._enabled = Boolean(val)
    this._manualOverride = Boolean(val)
  }

  /**
   * Synchronize `enabled` with the browser's mobile/touch environment when `hudLayoutMode === 'auto'`.
   * Automatically activates virtual controls when entering Chrome DevTools Mobile Emulation
   * (`iPhone 16 · 852 × 393`, etc.) or real mobile browsers without breaking manual overrides in tests.
   */
  syncFromEnvironment(
    win: Window | undefined = typeof window !== 'undefined' ? window : undefined,
  ): boolean {
    if (this.hudLayoutMode === 'compact-d2r') {
      this._enabled = true
      return this._enabled
    }
    if (this.hudLayoutMode === 'classic') {
      this._enabled = false
      return this._enabled
    }
    const envDetected = detectMobileTouchEnvironment(win)
    if (envDetected !== this._lastEnvDetected) {
      this._lastEnvDetected = envDetected
      this._manualOverride = null
    }
    if (this._manualOverride !== null) {
      this._enabled = this._manualOverride
    } else {
      this._enabled = envDetected
    }
    return this._enabled
  }

  /**
   * Resolve a 6x2 Skill Wheel slot (`hotkeyIndex` `0..11`, i.e. `F1..F12`) from custom `wheelSlots`
   * or dynamically from the player's `SkillHotkeysHud` bindings and available skills.
   */
  resolveWheelSlot(
    hotkeyIndex: number,
    hotkeys?: {
      readonly leftSkillId: number
      readonly rightSkillId: number
      readonly bindings?: ReadonlyMap<string, { readonly side: 'left' | 'right'; readonly skillId: number }>
      readonly availableSkills?: readonly {
        readonly skillId: number
        readonly name?: string
        readonly nameZh?: string
        readonly leftUsable?: boolean
      }[]
    } | null,
  ): SkillWheelSlotDescriptor {
    const custom = this.wheelSlots[hotkeyIndex]
    if (custom) return custom
    const keyLabel = `F${hotkeyIndex + 1}`
    if (!hotkeys) {
      return {
        hotkeyIndex,
        keyLabel,
        skillId: hotkeyIndex === 5 ? 0 : -1,
        name: hotkeyIndex === 5 ? '普通攻击' : keyLabel,
        hand: hotkeyIndex === 5 ? 'left' : 'right',
      }
    }
    const bound = hotkeys.bindings?.get(keyLabel)
    if (bound && bound.skillId >= 0) {
      const entry = hotkeys.availableSkills?.find((s) => s.skillId === bound.skillId)
      return {
        hotkeyIndex,
        keyLabel,
        skillId: bound.skillId,
        name: entry?.nameZh || entry?.name || (bound.skillId === 0 ? '普通攻击' : `技能#${bound.skillId}`),
        hand: bound.side,
      }
    }
    if (hotkeyIndex === 5) {
      const primaryId = hotkeys.rightSkillId > 0 ? hotkeys.rightSkillId : hotkeys.leftSkillId
      const entry = hotkeys.availableSkills?.find((s) => s.skillId === primaryId)
      return {
        hotkeyIndex,
        keyLabel,
        skillId: primaryId,
        name: entry?.nameZh || entry?.name || (primaryId === 0 ? '普通攻击' : `技能#${primaryId}`),
        hand: hotkeys.rightSkillId > 0 ? 'right' : 'left',
      }
    }
    if (hotkeyIndex === 11) {
      const secId = hotkeys.leftSkillId
      const entry = hotkeys.availableSkills?.find((s) => s.skillId === secId)
      return {
        hotkeyIndex,
        keyLabel,
        skillId: secId,
        name: entry?.nameZh || entry?.name || (secId === 0 ? '普通攻击' : `技能#${secId}`),
        hand: 'left',
      }
    }
    const avail = hotkeys.availableSkills ?? []
    const candidateIdx = hotkeyIndex < 5 ? hotkeyIndex : hotkeyIndex - 1
    const candidate = avail[candidateIdx]
    if (candidate && candidate.skillId >= 0) {
      return {
        hotkeyIndex,
        keyLabel,
        skillId: candidate.skillId,
        name: candidate.nameZh || candidate.name || (candidate.skillId === 0 ? '普通攻击' : `技能#${candidate.skillId}`),
        hand: candidate.leftUsable && candidate.skillId === 0 ? 'left' : 'right',
      }
    }
    return {
      hotkeyIndex,
      keyLabel,
      skillId: -1,
      name: keyLabel,
      hand: 'right',
    }
  }

  /** HUD layout mode (`'auto' | 'classic' | 'compact-d2r'`). */
  hudLayoutMode: HudLayoutMode = 'auto'
  /** L2 Bank switching behavior (`'toggle'` on tap or `'hold'` while pressed). */
  skillWheelBankMode: SkillWheelBankMode = 'toggle'
  /** Active skill wheel bank: `0` = Bank 1 (`F1–F6`), `1` = Bank 2 (`F7–F12`). */
  activeSkillBank: 0 | 1 = 0
  /** Custom 12-slot skill wheel descriptors (`F1..F12`). */
  wheelSlots: SkillWheelSlotDescriptor[] = []
  /** Active hold-to-drag vector aiming state for directional skills (e.g. Teleport, Blizzard). */
  vectorAim: VectorAimState | null = null
  /** Currently tap-locked panel item for Phase 4 (#1384) zero-drag inspection & context actions. */
  selectedPanelItem: TouchSelectedPanelItem | null = null
  /** Priority-sorted foot-proximity ground loot queue for Phase 5 (#1385) sequential [拾取 A] pickup. */
  footLootQueue: FootLootCandidate[] = []
  /** Optional mobile walk-over auto-pickup for gold and beltable potions. */
  autoPickupGoldAndPotions = false
  /** Whether mobile haptic vibration feedback is enabled (Phase 6, Issue #1386). */
  hapticsEnabled = true

  joystick: DynamicJoystickState = createIdleJoystickState()
  lastFacingAngleRad: number = -Math.PI / 5
  lockedMonster: ScoredMonsterTarget | null = null
  lockedInteractable: ConeInteractableCandidate | null = null
  coneHalfAngleRad: number = DEFAULT_CONE_HALF_ANGLE_RAD

  /** Whether the D2R 524px Compact Center Bar & 6x2 Skill Wheel should replace the 800px PC bottom bar. */
  get compactHudActive(): boolean {
    if (this.hudLayoutMode === 'compact-d2r') return true
    if (this.hudLayoutMode === 'classic') return false
    return this.enabled
  }

  toggleSkillBank(): 0 | 1 {
    this.activeSkillBank = this.activeSkillBank === 0 ? 1 : 0
    return this.activeSkillBank
  }

  beginVectorAim(
    pointerId: number,
    hotkeyIndex: number,
    skillId: number,
    originX: number,
    originY: number,
    playerScreenX: number,
    playerScreenY: number,
  ): void {
    this.vectorAim = {
      active: true,
      pointerId,
      hotkeyIndex,
      skillId,
      originX,
      originY,
      targetScreenX: playerScreenX,
      targetScreenY: playerScreenY,
    }
  }

  updateVectorAim(
    pointerId: number,
    currentX: number,
    currentY: number,
    playerScreenX: number,
    playerScreenY: number,
    maxDragR: number = 64,
    maxWorldSpreadPx: number = 240,
  ): boolean {
    if (!this.vectorAim || !this.vectorAim.active || this.vectorAim.pointerId !== pointerId) {
      return false
    }
    const dx = currentX - this.vectorAim.originX
    const dy = currentY - this.vectorAim.originY
    const dist = Math.hypot(dx, dy)
    const ratio = Math.min(1, dist / Math.max(1, maxDragR))
    const ux = dist > 1e-3 ? dx / dist : 0
    const uy = dist > 1e-3 ? dy / dist : 0
    this.vectorAim = {
      ...this.vectorAim,
      targetScreenX: Math.round(playerScreenX + ux * ratio * maxWorldSpreadPx),
      targetScreenY: Math.round(playerScreenY + uy * ratio * maxWorldSpreadPx * 0.65),
    }
    return true
  }

  endVectorAim(pointerId: number): VectorAimState | null {
    if (!this.vectorAim || this.vectorAim.pointerId !== pointerId) return null
    const finished = this.vectorAim
    this.vectorAim = null
    return finished
  }

  isInLeftJoystickZone(
    x: number,
    y: number,
    logicalWidth: number,
    logicalHeight: number,
    leftPanelOpen: boolean,
  ): boolean {
    if (!this.enabled || leftPanelOpen) return false
    if (this.compactHudActive) {
      const m = computeCompactD2rHudMetrics(logicalWidth, logicalHeight)
      if (x >= m.barX && x <= m.barX + m.barWidth && y >= m.barY + 16) return false
    }
    return (
      x >= 0 &&
      x <= logicalWidth * 0.35 &&
      y >= logicalHeight * 0.35 &&
      y <= logicalHeight
    )
  }

  handlePointerDown(
    pointerId: number,
    x: number,
    y: number,
    logicalWidth: number,
    logicalHeight: number,
    leftPanelOpen: boolean,
  ): boolean {
    if (!this.isInLeftJoystickZone(x, y, logicalWidth, logicalHeight, leftPanelOpen)) {
      return false
    }
    const clampedOriginX = Math.max(
      JOYSTICK_OUTER_RADIUS + 14,
      Math.min(logicalWidth * 0.3, x),
    )
    const clampedOriginY = Math.max(
      logicalHeight * 0.42,
      Math.min(logicalHeight - JOYSTICK_OUTER_RADIUS - 20, y),
    )
    this.joystick = computeJoystickVector(
      clampedOriginX,
      clampedOriginY,
      x,
      y,
      pointerId,
      JOYSTICK_OUTER_RADIUS,
      this.lastFacingAngleRad,
    )
    if (this.joystick.magnitude > 0) {
      this.lastFacingAngleRad = this.joystick.angleRad
    }
    return true
  }

  handlePointerMove(pointerId: number, x: number, y: number): boolean {
    if (!this.joystick.active || this.joystick.pointerId !== pointerId) {
      return false
    }
    this.joystick = computeJoystickVector(
      this.joystick.originX,
      this.joystick.originY,
      x,
      y,
      pointerId,
      JOYSTICK_OUTER_RADIUS,
      this.lastFacingAngleRad,
    )
    if (this.joystick.magnitude > 0) {
      this.lastFacingAngleRad = this.joystick.angleRad
    }
    return true
  }

  handlePointerUp(pointerId: number): boolean {
    if (!this.joystick.active || this.joystick.pointerId !== pointerId) {
      return false
    }
    this.joystick = createIdleJoystickState(this.joystick.originX, this.joystick.originY)
    this.joystick = {
      ...this.joystick,
      angleRad: this.lastFacingAngleRad,
    }
    return true
  }

  updateTargets(
    playerScreenX: number,
    playerScreenY: number,
    monsters: readonly ConeMonsterCandidate[],
    interactables: readonly ConeInteractableCandidate[] = [],
  ): ConeTargetSelectionResult {
    const activeAngle =
      this.joystick.active && this.joystick.magnitude > 0
        ? this.joystick.angleRad
        : this.lastFacingAngleRad
    const result = selectBestConeTargets(
      playerScreenX,
      playerScreenY,
      activeAngle,
      monsters,
      interactables,
      this.coneHalfAngleRad,
    )
    this.lockedMonster = result.lockedMonster
    this.lockedInteractable = result.lockedInteractable
    return result
  }

  drawWorldConeAndTargetOverlay(
    ctx: CanvasRenderingContext2D,
    font: D2FontRenderer,
    playerScreenX: number,
    playerScreenY: number,
  ): void {
    if (!this.enabled) return
    const angle =
      this.joystick.active && this.joystick.magnitude > 0
        ? this.joystick.angleRad
        : this.lastFacingAngleRad

    ctx.save()
    if (this.joystick.active || this.lockedMonster !== null) {
      const coneLen = 210
      const startA = angle - this.coneHalfAngleRad
      const endA = angle + this.coneHalfAngleRad
      ctx.beginPath()
      ctx.moveTo(playerScreenX, playerScreenY)
      ctx.arc(playerScreenX, playerScreenY, coneLen, startA, endA)
      ctx.closePath()
      ctx.fillStyle = 'rgba(216, 184, 100, 0.08)'
      ctx.fill()

      ctx.strokeStyle = 'rgba(232, 200, 120, 0.35)'
      ctx.lineWidth = 1.2
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([5, 5])
      }
      ctx.stroke()
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([])
      }
    }

    if (this.lockedMonster !== null) {
      const { screenX, screenY } = this.lockedMonster.candidate
      ctx.save()
      ctx.translate(screenX, screenY)
      ctx.scale(1, 0.5)
      ctx.beginPath()
      ctx.arc(0, 0, 32, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(229, 57, 53, 0.92)'
      ctx.lineWidth = 2.4
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(0, 0, 23, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.85)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()

      font.drawText(ctx, '▼', Math.round(screenX), Math.round(screenY - 36), {
        font: 'font16',
        color: 'red',
        align: 'center',
      })
    }

    // Vector Aiming Ground Reticle when holding & dragging a directional skill
    if (this.vectorAim && this.vectorAim.active) {
      const { targetScreenX, targetScreenY } = this.vectorAim
      ctx.save()
      ctx.translate(targetScreenX, targetScreenY)
      ctx.scale(1, 0.5)
      ctx.beginPath()
      ctx.arc(0, 0, 36, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(79, 195, 247, 0.92)'
      ctx.lineWidth = 2.2
      ctx.stroke()
      ctx.restore()
    }
    ctx.restore()
  }

  drawJoystick(ctx: CanvasRenderingContext2D, font: D2FontRenderer): void {
    if (!this.enabled) return
    const { originX, originY, knobX, knobY, angleRad, locomotionMode } = this.joystick
    const outerR = JOYSTICK_OUTER_RADIUS
    const walkR = JOYSTICK_WALK_RADIUS
    const knobR = JOYSTICK_KNOB_RADIUS

    ctx.save()
    ctx.beginPath()
    ctx.arc(originX, originY, outerR, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(10, 8, 6, 0.48)'
    ctx.fill()
    ctx.strokeStyle =
      locomotionMode === 'run' ? 'rgba(255, 213, 79, 0.88)' : 'rgba(199, 161, 88, 0.58)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(originX, originY, walkR, 0, Math.PI * 2)
    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([4, 4])
    }
    ctx.strokeStyle = 'rgba(199, 161, 88, 0.32)'
    ctx.lineWidth = 1
    ctx.stroke()
    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([])
    }

    if (locomotionMode === 'run') {
      ctx.beginPath()
      ctx.arc(originX, originY, outerR + 3, angleRad - 0.5, angleRad + 0.5)
      ctx.strokeStyle = '#ffd54f'
      ctx.lineWidth = 3
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.moveTo(originX, originY)
    ctx.lineTo(knobX, knobY)
    ctx.strokeStyle = 'rgba(232, 200, 120, 0.65)'
    ctx.lineWidth = 2.5
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(knobX, knobY, knobR, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(184, 146, 70, 0.92)'
    ctx.fill()
    ctx.strokeStyle = '#ffe082'
    ctx.lineWidth = 1.8
    ctx.stroke()

    font.drawText(
      ctx,
      locomotionMode === 'run' ? '自动奔跑' : '直控摇杆',
      Math.round(originX),
      Math.round(originY + outerR + 14),
      {
        font: 'font6',
        color: 'gold',
        align: 'center',
      },
    )
    ctx.restore()
  }

  /**
   * Draw the Phase 3 (#1383) D2R 524px Compact Center Bar (Demon/Angel Gargoyle Island + 4x1/4x4 Belt),
   * Top-Right 6-in-1 Utility Bar, and Bottom-Right 6x2 Skill Wheel (`F1–F6` / `F7–F12` + `[L2 翻页]` + `[✋ 拾取 A]`).
   */
  drawCompactD2rHudAndWheel(
    ctx: CanvasRenderingContext2D,
    font: D2FontRenderer,
    state: {
      readonly logicalWidth: number
      readonly logicalHeight: number
      readonly hp: number
      readonly maxHp: number
      readonly mana: number
      readonly maxMana: number
      readonly stamina: number
      readonly maxStamina: number
      readonly xpRatio: number
      readonly isRunning: boolean
      readonly beltExpanded: boolean
      readonly showGroundLabels: boolean
      readonly unspentStatPoints: number
      readonly unspentSkillPoints: number
      readonly weaponSwapSet: 0 | 1
      readonly leftPanel: string
      readonly rightPanel: string
      readonly images: ReadonlyMap<string, HTMLImageElement>
      readonly hotkeys?: {
        readonly leftSkillId: number
        readonly rightSkillId: number
        readonly bindings?: ReadonlyMap<string, { readonly side: 'left' | 'right'; readonly skillId: number }>
        readonly availableSkills?: readonly {
          readonly skillId: number
          readonly name?: string
          readonly nameZh?: string
          readonly leftUsable?: boolean
        }[]
        readonly getSkillIcon?: (skillId: number) => HTMLImageElement | undefined
        readonly swordImage?: HTMLImageElement | null
      } | null
      readonly belt?: {
        readonly getSlot: (
          col: number,
          row: number,
        ) => { readonly code?: string; readonly name?: string; readonly nameZh?: string } | null
      } | null
    },
  ): void {
    const m = computeCompactD2rHudMetrics(state.logicalWidth, state.logicalHeight)
    const ctrlPnl = state.images.get('ctrlPnl')
    const globeLife = state.images.get('globeLife')
    const globeMana = state.images.get('globeMana')
    const overlapLeft = state.images.get('overlapLeft')
    const overlapRight = state.images.get('overlapRight')
    const isBank2 = this.activeSkillBank === 1

    const drawPotionGlyph = (x: number, y: number, size: number, code: string) => {
      const lc = code.trim().toLowerCase()
      const isRejuv = lc.startsWith('rv')
      const isMana = lc.startsWith('mp')
      const isLife = lc.startsWith('hp')
      const fillColor = isRejuv
        ? '#8e24aa'
        : isMana
          ? '#1565c0'
          : isLife
            ? '#c62828'
            : '#f9a825'
      ctx.save()
      ctx.beginPath()
      ctx.arc(Math.round(x + size / 2), Math.round(y + size / 2 + 2), Math.round(size * 0.28), 0, Math.PI * 2)
      ctx.fillStyle = fillColor
      ctx.fill()
      ctx.strokeStyle = '#ffe082'
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.fillStyle = '#d7ccc8'
      ctx.fillRect(Math.round(x + size / 2 - 3), Math.round(y + 5), 6, 5)
      ctx.restore()
    }

    const drawSkillSlotIcon = (cx: number, cy: number, r: number, skillId: number) => {
      if (skillId < 0 || !state.hotkeys) return
      const iconImg =
        skillId === 0 && state.hotkeys.swordImage
          ? state.hotkeys.swordImage
          : state.hotkeys.getSkillIcon?.(skillId)
      if (!iconImg) return
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(4, r - 2), 0, Math.PI * 2)
      if (typeof ctx.clip === 'function') {
        ctx.clip()
      }
      ctx.drawImage(iconImg, cx - r, cy - r, r * 2, r * 2)
      ctx.restore()
    }

    ctx.save()
    // 1. Top-Right 6-in-1 Utility Bar
    ctx.fillStyle = 'rgba(12, 10, 8, 0.88)'
    ctx.fillRect(
      m.topUtilityBar.x,
      m.topUtilityBar.y,
      m.topUtilityBar.width,
      m.topUtilityBar.height,
    )
    ctx.strokeStyle = '#7e653a'
    ctx.lineWidth = 1.4
    ctx.strokeRect(
      m.topUtilityBar.x,
      m.topUtilityBar.y,
      m.topUtilityBar.width,
      m.topUtilityBar.height,
    )

    for (const btn of m.topUtilityBar.buttons) {
      const isActive =
        (btn.action === 'char' && state.leftPanel === 'char') ||
        (btn.action === 'inv' && state.rightPanel === 'inv') ||
        (btn.action === 'skill' && state.rightPanel === 'skill') ||
        (btn.action === 'altLabels' && state.showGroundLabels)
      ctx.fillStyle = isActive ? 'rgba(62, 46, 22, 0.95)' : 'rgba(22, 18, 14, 0.92)'
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height)
      ctx.strokeStyle = isActive ? '#ffd54f' : '#8d703b'
      ctx.lineWidth = 1.2
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height)
      font.drawText(ctx, btn.labelZh, Math.round(btn.x + btn.width / 2), Math.round(btn.y + 30), {
        font: 'font6',
        color: isActive ? 'gold' : 'white',
        align: 'center',
      })
      const badgeCount =
        btn.action === 'char'
          ? state.unspentStatPoints
          : btn.action === 'skill'
            ? state.unspentSkillPoints
            : 0
      if (badgeCount > 0) {
        ctx.beginPath()
        ctx.arc(btn.x + btn.width - 4, btn.y + 4, 8, 0, Math.PI * 2)
        ctx.fillStyle = '#c62828'
        ctx.fill()
        font.drawText(ctx, `+${badgeCount}`, Math.round(btn.x + btn.width - 4), Math.round(btn.y + 7), {
          font: 'font6',
          color: 'white',
          align: 'center',
        })
      }
    }

    // 2. Central 524px D2R Demon/Angel Compact Bar
    ctx.fillStyle = 'rgba(14, 11, 8, 0.96)'
    ctx.fillRect(m.consoleBox.x, m.consoleBox.y, m.consoleBox.width, m.consoleBox.height)
    if (ctrlPnl) {
      ctx.drawImage(
        ctrlPnl,
        248,
        48,
        304,
        56,
        m.consoleBox.x + 2,
        m.consoleBox.y + 2,
        m.consoleBox.width - 4,
        m.consoleBox.height - 4,
      )
    }
    ctx.strokeStyle = '#9c7e47'
    ctx.lineWidth = 2
    ctx.strokeRect(m.consoleBox.x, m.consoleBox.y, m.consoleBox.width, m.consoleBox.height)

    // Enlarged 4x1 Belt Slots
    for (const slot of m.beltSlots) {
      ctx.fillStyle = 'rgba(8, 6, 5, 0.92)'
      ctx.fillRect(slot.x, slot.y, slot.size, slot.size)
      ctx.strokeStyle = '#8d703b'
      ctx.lineWidth = 1.4
      ctx.strokeRect(slot.x, slot.y, slot.size, slot.size)
      const pot = state.belt?.getSlot(slot.col, 0)
      if (pot?.code) {
        drawPotionGlyph(slot.x, slot.y, slot.size, pot.code)
      }
      font.drawText(ctx, String(slot.col + 1), slot.x + 6, slot.y + slot.size - 5, {
        font: 'font6',
        color: 'gold',
        align: 'left',
      })
    }

    // Expanded 4x4 Popbelt Drawer
    if (state.beltExpanded) {
      ctx.fillStyle = 'rgba(12, 9, 6, 0.95)'
      ctx.fillRect(
        m.popbeltDrawer.x,
        m.popbeltDrawer.y,
        m.popbeltDrawer.width,
        m.popbeltDrawer.height,
      )
      ctx.strokeStyle = '#c7a158'
      ctx.lineWidth = 1.6
      ctx.strokeRect(
        m.popbeltDrawer.x,
        m.popbeltDrawer.y,
        m.popbeltDrawer.width,
        m.popbeltDrawer.height,
      )
      const beltStartX = m.beltSlots[0]!.x
      const beltRow0Y = m.beltSlots[0]!.y
      for (const r of [1, 2, 3] as const) {
        const cellY = beltRow0Y - r * (COMPACT_BELT_SLOT_SIZE + 4)
        for (const c of [0, 1, 2, 3] as const) {
          const cellX = beltStartX + c * (COMPACT_BELT_SLOT_SIZE + COMPACT_BELT_SLOT_GAP)
          ctx.fillStyle = 'rgba(8, 6, 5, 0.92)'
          ctx.fillRect(cellX, cellY, COMPACT_BELT_SLOT_SIZE, COMPACT_BELT_SLOT_SIZE)
          ctx.strokeStyle = '#6c5834'
          ctx.lineWidth = 1
          ctx.strokeRect(cellX, cellY, COMPACT_BELT_SLOT_SIZE, COMPACT_BELT_SLOT_SIZE)
          const pot = state.belt?.getSlot(c, r)
          if (pot?.code) {
            drawPotionGlyph(cellX, cellY, COMPACT_BELT_SLOT_SIZE, pot.code)
          }
        }
      }
      font.drawText(
        ctx,
        '▲ 4×4 腰带抽屉',
        Math.round(m.popbeltDrawer.x + m.popbeltDrawer.width / 2),
        Math.round(m.popbeltDrawer.y + 13),
        {
          font: 'font6',
          color: 'gold',
          align: 'center',
        },
      )
    }

    // Refill & Run Buttons
    ctx.fillStyle = 'rgba(28, 22, 16, 0.94)'
    ctx.fillRect(m.refillBtn.x, m.refillBtn.y, m.refillBtn.width, m.refillBtn.height)
    ctx.strokeStyle = '#8d703b'
    ctx.strokeRect(m.refillBtn.x, m.refillBtn.y, m.refillBtn.width, m.refillBtn.height)
    font.drawText(
      ctx,
      '补满R3',
      Math.round(m.refillBtn.x + m.refillBtn.width / 2),
      Math.round(m.refillBtn.y + 13),
      { font: 'font6', color: 'gold', align: 'center' },
    )

    ctx.fillStyle = state.isRunning ? 'rgba(64, 48, 20, 0.95)' : 'rgba(20, 16, 12, 0.95)'
    ctx.fillRect(m.runBtn.x, m.runBtn.y, m.runBtn.width, m.runBtn.height)
    ctx.strokeStyle = state.isRunning ? '#ffd54f' : '#6c5834'
    ctx.strokeRect(m.runBtn.x, m.runBtn.y, m.runBtn.width, m.runBtn.height)
    font.drawText(
      ctx,
      state.isRunning ? '奔跑' : '行走',
      Math.round(m.runBtn.x + m.runBtn.width / 2),
      Math.round(m.runBtn.y + 14),
      { font: 'font6', color: state.isRunning ? 'gold' : 'white', align: 'center' },
    )

    // EXP & Stamina Bars
    const barTrackX = m.beltSlots[0]!.x
    const barTrackW = 248
    const expY = m.barY + 83
    const staY = m.barY + 91
    const hpRatio = state.maxHp > 0 ? Math.max(0, Math.min(1, state.hp / state.maxHp)) : 1
    const manaRatio = state.maxMana > 0 ? Math.max(0, Math.min(1, state.mana / state.maxMana)) : 1
    const staRatio =
      state.maxStamina > 0 ? Math.max(0, Math.min(1, state.stamina / state.maxStamina)) : 1

    ctx.fillStyle = '#090806'
    ctx.fillRect(barTrackX, expY, barTrackW, 5)
    ctx.fillStyle = '#d4af37'
    ctx.fillRect(
      barTrackX + 1,
      expY + 1,
      Math.round((barTrackW - 2) * Math.max(0, Math.min(1, state.xpRatio))),
      3,
    )

    ctx.fillStyle = '#090806'
    ctx.fillRect(barTrackX, staY, barTrackW, 6)
    ctx.fillStyle = '#e0a938'
    ctx.fillRect(barTrackX + 1, staY + 1, Math.round((barTrackW - 2) * staRatio), 4)

    // Left Demon Wing + Life Globe & Right Angel Wing + Mana Globe
    const drawCompactWingAndGlobe = (
      cx: number,
      cy: number,
      r: number,
      ratio: number,
      isLife: boolean,
    ) => {
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r + 3, 0, Math.PI * 2)
      ctx.fillStyle = '#070504'
      ctx.fill()

      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      if (typeof ctx.clip === 'function') {
        ctx.clip()
      }
      const fillH = Math.round(r * 2 * ratio)
      const fillTop = cy + r - fillH
      const globeImg = isLife ? globeLife : globeMana
      if (globeImg) {
        ctx.drawImage(globeImg, cx - r, fillTop, r * 2, fillH)
      } else {
        ctx.fillStyle = isLife ? '#b71c1c' : '#0d47a1'
        ctx.fillRect(cx - r, fillTop, r * 2, fillH)
      }
      ctx.restore()

      ctx.beginPath()
      ctx.arc(cx, cy, r + 1, 0, Math.PI * 2)
      ctx.strokeStyle = '#a8894e'
      ctx.lineWidth = 2.2
      ctx.stroke()

      if (isLife) {
        if (ctrlPnl) {
          ctx.drawImage(ctrlPnl, 0, 0, 117, 104, m.barX, m.barY, 117, 104)
        }
        if (overlapLeft) {
          ctx.drawImage(overlapLeft, m.barX, m.barY - 4)
        }
      } else {
        if (ctrlPnl) {
          ctx.drawImage(ctrlPnl, 683, 0, 117, 104, m.barX + m.barWidth - 117, m.barY, 117, 104)
        }
        if (overlapRight) {
          ctx.drawImage(overlapRight, cx - r - 4, m.barY + 4)
        }
      }

      font.drawText(
        ctx,
        isLife ? `${state.hp} / ${state.maxHp}` : `${state.mana} / ${state.maxMana}`,
        cx,
        cy - r - 10,
        {
          font: 'font6',
          color: isLife ? 'red' : 'blue',
          align: 'center',
        },
      )
      ctx.restore()
    }

    drawCompactWingAndGlobe(
      m.leftGlobe.cx,
      m.leftGlobe.cy,
      m.leftGlobe.r,
      hpRatio,
      true,
    )
    drawCompactWingAndGlobe(
      m.rightGlobe.cx,
      m.rightGlobe.cy,
      m.rightGlobe.r,
      manaRatio,
      false,
    )

    // 3. Bottom-Right D2R 6x2 Skill Wheel + L2 Bank Switcher + [A 拾取] + [W 武器切换]
    ctx.fillStyle = 'rgba(12, 10, 8, 0.9)'
    ctx.fillRect(
      m.l2PreviewBar.x,
      m.l2PreviewBar.y,
      m.l2PreviewBar.width,
      m.l2PreviewBar.height,
    )
    ctx.strokeStyle = isBank2 ? '#4fc3f7' : '#7e653a'
    ctx.strokeRect(
      m.l2PreviewBar.x,
      m.l2PreviewBar.y,
      m.l2PreviewBar.width,
      m.l2PreviewBar.height,
    )

    ctx.fillStyle = isBank2 ? 'rgba(13, 71, 161, 0.95)' : 'rgba(44, 34, 20, 0.95)'
    ctx.fillRect(
      m.l2PreviewBar.l2Btn.x,
      m.l2PreviewBar.l2Btn.y,
      m.l2PreviewBar.l2Btn.width,
      m.l2PreviewBar.l2Btn.height,
    )
    ctx.strokeStyle = isBank2 ? '#4fc3f7' : '#ffd54f'
    ctx.strokeRect(
      m.l2PreviewBar.l2Btn.x,
      m.l2PreviewBar.l2Btn.y,
      m.l2PreviewBar.l2Btn.width,
      m.l2PreviewBar.l2Btn.height,
    )
    font.drawText(
      ctx,
      isBank2 ? 'L2 2/2页' : 'L2 1/2页',
      Math.round(m.l2PreviewBar.l2Btn.x + m.l2PreviewBar.l2Btn.width / 2),
      Math.round(m.l2PreviewBar.l2Btn.y + 24),
      {
        font: 'font6',
        color: 'gold',
        align: 'center',
      },
    )

    // 6 Inactive Bank Mini Preview Circles inside L2 Preview Bar
    const inactiveBankOffset = isBank2 ? 0 : 6
    const miniStartX = m.l2PreviewBar.l2Btn.x + m.l2PreviewBar.l2Btn.width + 22
    const miniCy = Math.round(m.l2PreviewBar.y + m.l2PreviewBar.height / 2)
    for (let i = 0; i < 6; i++) {
      const miniCx = miniStartX + i * 36
      const miniSlot = this.resolveWheelSlot(inactiveBankOffset + i, state.hotkeys)
      ctx.beginPath()
      ctx.arc(miniCx, miniCy, 14, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(18, 15, 11, 0.92)'
      ctx.fill()
      drawSkillSlotIcon(miniCx, miniCy, 14, miniSlot.skillId)
      ctx.beginPath()
      ctx.arc(miniCx, miniCy, 14, 0, Math.PI * 2)
      ctx.strokeStyle = '#6c5834'
      ctx.lineWidth = 1.2
      ctx.stroke()
      font.drawText(ctx, miniSlot.keyLabel, miniCx, miniCy + 4, {
        font: 'font6',
        color: 'gold',
        align: 'center',
      })
    }

    // 5 Satellite Arc Skill Slots
    const bankOffset = isBank2 ? 6 : 0
    for (const arcSlot of m.wheel.arcSlots) {
      const slotDesc = this.resolveWheelSlot(bankOffset + arcSlot.arcIndex, state.hotkeys)
      const keyLabel = slotDesc.keyLabel
      const skillName = slotDesc.name
      ctx.beginPath()
      ctx.arc(arcSlot.cx, arcSlot.cy, arcSlot.r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(16, 13, 10, 0.92)'
      ctx.fill()
      drawSkillSlotIcon(arcSlot.cx, arcSlot.cy, arcSlot.r, slotDesc.skillId)
      ctx.beginPath()
      ctx.arc(arcSlot.cx, arcSlot.cy, arcSlot.r, 0, Math.PI * 2)
      ctx.strokeStyle = isBank2 ? '#64b5f6' : '#c7a158'
      ctx.lineWidth = 2.2
      ctx.stroke()

      font.drawText(ctx, keyLabel, arcSlot.cx, arcSlot.cy + 4, {
        font: 'font6',
        color: 'gold',
        align: 'center',
      })
      font.drawText(ctx, skillName, arcSlot.cx, arcSlot.cy + arcSlot.r + 11, {
        font: 'font6',
        color: 'white',
        align: 'center',
      })
    }

    // Center Primary Skill Slot
    const primaryDesc = this.resolveWheelSlot(bankOffset + 5, state.hotkeys)
    const primaryKey = primaryDesc.keyLabel
    const primaryName = primaryDesc.name || '主技能'
    ctx.beginPath()
    ctx.arc(m.wheel.cx, m.wheel.cy, m.wheel.mainR, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(20, 16, 12, 0.95)'
    ctx.fill()
    drawSkillSlotIcon(m.wheel.cx, m.wheel.cy, m.wheel.mainR, primaryDesc.skillId)
    ctx.beginPath()
    ctx.arc(m.wheel.cx, m.wheel.cy, m.wheel.mainR, 0, Math.PI * 2)
    ctx.strokeStyle = '#ffd54f'
    ctx.lineWidth = 3
    ctx.stroke()
    font.drawText(
      ctx,
      `主槽 ${primaryKey} · ${primaryName}`,
      m.wheel.cx,
      m.wheel.cy + m.wheel.mainR + 14,
      {
        font: 'font6',
        color: 'gold',
        align: 'center',
      },
    )

    // Dedicated Context Loot / Interact Button ([A 拾取])
    ctx.beginPath()
    ctx.arc(m.lootBtn.cx, m.lootBtn.cy, m.lootBtn.r, 0, Math.PI * 2)
    ctx.fillStyle =
      this.lockedInteractable !== null ? 'rgba(93, 67, 24, 0.95)' : 'rgba(28, 22, 16, 0.92)'
    ctx.fill()
    ctx.strokeStyle = this.lockedInteractable !== null ? '#ffd54f' : '#8d703b'
    ctx.lineWidth = 2
    ctx.stroke()
    font.drawText(ctx, '拾取 A', m.lootBtn.cx, m.lootBtn.cy + 4, {
      font: 'font6',
      color: 'gold',
      align: 'center',
    })

    // Weapon Swap Button ([W 武器 I/II])
    ctx.fillStyle = 'rgba(28, 22, 16, 0.92)'
    ctx.fillRect(
      m.weaponSwapBtn.x,
      m.weaponSwapBtn.y,
      m.weaponSwapBtn.width,
      m.weaponSwapBtn.height,
    )
    ctx.strokeStyle = '#8d703b'
    ctx.strokeRect(
      m.weaponSwapBtn.x,
      m.weaponSwapBtn.y,
      m.weaponSwapBtn.width,
      m.weaponSwapBtn.height,
    )
    font.drawText(
      ctx,
      state.weaponSwapSet === 1 ? '武器 II (W)' : '武器 I (W)',
      Math.round(m.weaponSwapBtn.x + m.weaponSwapBtn.width / 2),
      Math.round(m.weaponSwapBtn.y + 22),
      {
        font: 'font6',
        color: 'gold',
        align: 'center',
      },
    )

    ctx.restore()
  }

  selectPanelItem(selected: TouchSelectedPanelItem | null): void {
    this.selectedPanelItem = selected
  }

  clearSelectedPanelItem(): void {
    this.selectedPanelItem = null
  }

  updateFootLootQueue(
    playerScreenX: number,
    playerScreenY: number,
    groundItems: readonly GroundLootCandidateInput[],
    maxPickupRadiusPx: number = DEFAULT_INTERACT_MAX_SCREEN_RANGE,
  ): FootLootCandidate[] {
    this.footLootQueue = buildFootLootQueue(
      playerScreenX,
      playerScreenY,
      groundItems,
      maxPickupRadiusPx,
    )
    return this.footLootQueue
  }

  popNextFootLoot(): FootLootCandidate | null {
    if (this.footLootQueue.length === 0) return null
    const next = this.footLootQueue[0]!
    this.footLootQueue = this.footLootQueue.slice(1)
    return next
  }

  drawSelectedItemContextOverlay(
    ctx: CanvasRenderingContext2D,
    font: D2FontRenderer,
    context: {
      readonly logicalWidth: number
      readonly logicalHeight: number
      readonly leftPanel: string
      readonly rightPanel: string
      readonly vendorMode?: 'trade' | 'gamble' | undefined
      readonly equipped: Partial<Record<EquipSlotId, UiInventoryItem>>
    },
  ): TouchActionBarLayout | null {
    if (!this.selectedPanelItem) return null
    const actions = buildTouchContextActions(this.selectedPanelItem, {
      leftPanel: context.leftPanel,
      rightPanel: context.rightPanel,
      vendorMode: context.vendorMode,
    })
    const equippedCounterpart = resolveEquippedComparisonCounterpart(
      this.selectedPanelItem.item,
      context.equipped,
    )
    const layout = computeTouchActionBarLayout(
      this.selectedPanelItem,
      actions,
      equippedCounterpart,
      context.logicalWidth,
      context.logicalHeight,
    )

    ctx.save()
    // 1. Highlight frame around tap-locked item slot
    ctx.strokeStyle = '#ffd54f'
    ctx.lineWidth = 2.4
    ctx.strokeRect(
      this.selectedPanelItem.anchorX - 2,
      this.selectedPanelItem.anchorY - 2,
      (this.selectedPanelItem.item.invWidth || 1) * 29 + 4,
      (this.selectedPanelItem.item.invHeight || 1) * 29 + 4,
    )

    // 2. Side-by-Side Comparison Cards ([已穿戴] vs [当前选中])
    if (layout.equippedCard && equippedCounterpart) {
      ctx.fillStyle = 'rgba(10, 8, 6, 0.94)'
      ctx.fillRect(
        layout.equippedCard.x,
        layout.equippedCard.y,
        layout.equippedCard.width,
        layout.equippedCard.height,
      )
      ctx.strokeStyle = '#7e653a'
      ctx.lineWidth = 1.5
      ctx.strokeRect(
        layout.equippedCard.x,
        layout.equippedCard.y,
        layout.equippedCard.width,
        layout.equippedCard.height,
      )
      font.drawText(
        ctx,
        `[已穿戴] ${equippedCounterpart.nameZh || equippedCounterpart.name}`,
        layout.equippedCard.x + 8,
        layout.equippedCard.y + 18,
        { font: 'font6', color: 'gold', align: 'left' },
      )
    }

    ctx.fillStyle = 'rgba(12, 10, 8, 0.96)'
    ctx.fillRect(
      layout.selectedCard.x,
      layout.selectedCard.y,
      layout.selectedCard.width,
      layout.selectedCard.height,
    )
    ctx.strokeStyle = '#ffd54f'
    ctx.lineWidth = 1.8
    ctx.strokeRect(
      layout.selectedCard.x,
      layout.selectedCard.y,
      layout.selectedCard.width,
      layout.selectedCard.height,
    )
    font.drawText(
      ctx,
      `[选中] ${this.selectedPanelItem.item.nameZh || this.selectedPanelItem.item.name}`,
      layout.selectedCard.x + 8,
      layout.selectedCard.y + 18,
      { font: 'font6', color: 'gold', align: 'left' },
    )

    // 3. Context Action Bar Buttons
    ctx.fillStyle = 'rgba(14, 11, 8, 0.96)'
    ctx.fillRect(layout.barX, layout.barY, layout.barWidth, layout.barHeight)
    ctx.strokeStyle = '#c7a158'
    ctx.lineWidth = 1.6
    ctx.strokeRect(layout.barX, layout.barY, layout.barWidth, layout.barHeight)

    for (const btn of layout.buttons) {
      ctx.fillStyle = btn.action === 'drop' ? 'rgba(68, 20, 20, 0.94)' : 'rgba(38, 30, 18, 0.94)'
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height)
      ctx.strokeStyle = btn.action === 'drop' ? '#ef5350' : '#ffd54f'
      ctx.lineWidth = 1.3
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height)
      font.drawText(
        ctx,
        btn.labelZh,
        Math.round(btn.x + btn.width / 2),
        Math.round(btn.y + 21),
        {
          font: 'font6',
          color: btn.action === 'drop' ? 'red' : 'gold',
          align: 'center',
        },
      )
    }
    ctx.restore()
    return layout
  }
}

// ============================================================================
// Phase 4 (#1384): Panel Touch Inspection, Comparison Card & Context Action Bar
// ============================================================================

export type TouchItemContainerSource =
  | 'inv'
  | 'equip'
  | 'stash'
  | 'cube'
  | 'vendor'
  | 'merc'

export type TouchContextActionKind =
  | 'equip'
  | 'unequip'
  | 'use'
  | 'putBelt'
  | 'toStash'
  | 'toCube'
  | 'toBag'
  | 'equipMerc'
  | 'buy'
  | 'sell'
  | 'drop'

export interface TouchSelectedPanelItem {
  readonly source: TouchItemContainerSource
  readonly item: UiInventoryItem
  readonly col?: number | undefined
  readonly row?: number | undefined
  readonly equipSlot?: EquipSlotId | undefined
  readonly anchorX: number
  readonly anchorY: number
}

export interface TouchContextActionSpec {
  readonly action: TouchContextActionKind
  readonly labelZh: string
  readonly labelEn: string
}

export interface TouchContextActionButton extends TouchContextActionSpec {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface TouchActionBarLayout {
  readonly barX: number
  readonly barY: number
  readonly barWidth: number
  readonly barHeight: number
  readonly buttons: readonly TouchContextActionButton[]
  readonly selectedCard: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  }
  readonly equippedCard: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  } | null
}

/**
 * Resolve the currently equipped counterpart item for side-by-side `[已穿戴] vs [当前选中]` comparison.
 */
export function resolveEquippedComparisonCounterpart(
  selectedItem: UiInventoryItem,
  equipped: Partial<Record<EquipSlotId, UiInventoryItem>>,
): UiInventoryItem | null {
  if (!selectedItem.allowedSlots || selectedItem.allowedSlots.length === 0) {
    return null
  }
  for (const slot of selectedItem.allowedSlots) {
    const eq = equipped[slot]
    if (eq && eq.id !== selectedItem.id) {
      return eq
    }
  }
  return null
}

/**
 * Build context-sensitive one-tap action buttons (`[穿戴/替换]`, `[使用/鉴定]`, `[装入腰带]`,
 * `[存入箱子]`, `[放入方块]`, `[购买/出售]`, `[给佣兵]`, `[丢弃]`) for a tap-selected item.
 */
export function buildTouchContextActions(
  selected: TouchSelectedPanelItem,
  context: {
    readonly leftPanel: string
    readonly rightPanel: string
    readonly vendorMode?: 'trade' | 'gamble' | undefined
  },
): TouchContextActionSpec[] {
  const actions: TouchContextActionSpec[] = []
  const { item, source } = selected

  if (source === 'vendor') {
    actions.push({
      action: 'buy',
      labelZh: context.vendorMode === 'gamble' ? '赌博购买' : '购买',
      labelEn: context.vendorMode === 'gamble' ? 'Gamble' : 'Buy',
    })
    return actions
  }

  if (context.leftPanel === 'vendor' && source === 'inv') {
    actions.push({ action: 'sell', labelZh: '出售', labelEn: 'Sell' })
  }

  if (source === 'equip') {
    actions.push({ action: 'unequip', labelZh: '卸下至背包', labelEn: 'Unequip' })
  } else if (item.allowedSlots && item.allowedSlots.length > 0) {
    actions.push({ action: 'equip', labelZh: '穿戴/替换', labelEn: 'Equip' })
  }

  if (isUsableRightClickItem(item.code ?? '')) {
    actions.push({ action: 'use', labelZh: '使用/鉴定', labelEn: 'Use' })
  }

  if (isAutoBeltablePotion(item)) {
    actions.push({ action: 'putBelt', labelZh: '装入腰带', labelEn: 'Belt' })
  }

  if (context.leftPanel === 'stash') {
    if (source === 'inv') {
      actions.push({ action: 'toStash', labelZh: '存入箱子', labelEn: 'To Stash' })
    } else if (source === 'stash') {
      actions.push({ action: 'toBag', labelZh: '取出至背包', labelEn: 'To Bag' })
    }
  }

  if (context.leftPanel === 'cube') {
    if (source === 'inv') {
      actions.push({ action: 'toCube', labelZh: '放入方块', labelEn: 'To Cube' })
    } else if (source === 'cube') {
      actions.push({ action: 'toBag', labelZh: '取出至背包', labelEn: 'To Bag' })
    }
  }

  if (context.leftPanel === 'merc' && source === 'inv' && item.allowedSlots.length > 0) {
    actions.push({ action: 'equipMerc', labelZh: '给佣兵穿戴', labelEn: 'Equip Merc' })
  }

  actions.push({ action: 'drop', labelZh: '丢弃', labelEn: 'Drop' })
  return actions
}

export function computeTouchActionBarLayout(
  selected: TouchSelectedPanelItem,
  actions: readonly TouchContextActionSpec[],
  equippedCounterpart: UiInventoryItem | null,
  logicalWidth: number = 800,
  logicalHeight: number = 600,
): TouchActionBarLayout {
  const btnWidth = 76
  const btnHeight = 32
  const btnGap = 6
  const paddingX = 8
  const paddingY = 6
  const totalBtnsW =
    actions.length * btnWidth + Math.max(0, actions.length - 1) * btnGap
  const barWidth = totalBtnsW + paddingX * 2
  const barHeight = btnHeight + paddingY * 2

  const rawBarX = Math.round(selected.anchorX - barWidth / 2 + 16)
  const barX = Math.max(12, Math.min(logicalWidth - barWidth - 12, rawBarX))
  const rawBarY = selected.anchorY + 64
  const barY =
    rawBarY + barHeight <= logicalHeight - 60
      ? rawBarY
      : Math.max(12, selected.anchorY - barHeight - 8)

  const buttons: TouchContextActionButton[] = actions.map((spec, idx) => ({
    ...spec,
    x: barX + paddingX + idx * (btnWidth + btnGap),
    y: barY + paddingY,
    width: btnWidth,
    height: btnHeight,
  }))

  const cardW = 196
  const cardH = Math.max(68, 28 + (selected.item.stats?.length ?? 0) * 14)
  const selectedCardX = Math.max(
    12,
    Math.min(logicalWidth - cardW - 12, barX),
  )
  const selectedCardY = Math.max(12, barY - cardH - 6)
  const selectedCard = {
    x: selectedCardX,
    y: selectedCardY,
    width: cardW,
    height: cardH,
  }

  const equippedCard = equippedCounterpart
    ? {
        x: Math.max(12, selectedCardX - cardW - 8),
        y: selectedCardY,
        width: cardW,
        height: cardH,
      }
    : null

  return {
    barX,
    barY,
    barWidth,
    barHeight,
    buttons,
    selectedCard,
    equippedCard,
  }
}

export function hitTestTouchActionBar(
  x: number,
  y: number,
  layout: TouchActionBarLayout | null,
): TouchContextActionKind | null {
  if (!layout) return null
  for (const btn of layout.buttons) {
    if (pointInRect(x, y, btn)) {
      return btn.action
    }
  }
  return null
}

/**
 * Allocate `1` or up to `5` stat points in a single tap (`[+1]` / `[+5]` touch controls,
 * replacing PC `Shift + Left-Click` batch stat allocation).
 */
export function allocateStatPointsBatch(
  stat: BaseStatKey,
  requestedCount: 1 | 5,
  unspentPoints: number,
  allocateSingle: (stat: BaseStatKey) => void,
): number {
  const actual = Math.max(0, Math.min(requestedCount, Math.floor(unspentPoints)))
  for (let i = 0; i < actual; i++) {
    allocateSingle(stat)
  }
  return actual
}

// ============================================================================
// Phase 5 (#1385): Spring-Repulsion Ground Label Magnet & Sequential Loot Queue
// ============================================================================

export const TOUCH_GROUND_LABEL_MIN_HEIGHT = 28
export const TOUCH_GROUND_LABEL_PAD_X = 12
export const TOUCH_GROUND_LABEL_GAP_Y = 4

export interface GroundLootCandidateInput {
  readonly id: number
  readonly code?: string | undefined
  readonly label: string
  readonly quality?: string | undefined
  readonly screenX: number
  readonly screenY: number
  readonly textWidthPx?: number | undefined
}

export interface TouchGroundLabelBox {
  readonly id: number
  readonly label: string
  readonly quality: string
  readonly anchorX: number
  readonly anchorY: number
  readonly boxX: number
  readonly boxY: number
  readonly boxWidth: number
  readonly boxHeight: number
  readonly displaced: boolean
}

export interface FootLootCandidate extends GroundLootCandidateInput {
  readonly priorityTier: number
  readonly distancePx: number
  readonly score: number
}

export function resolveLootPriorityTier(item: {
  readonly code?: string | undefined
  readonly quality?: string | undefined
}): number {
  const q = (item.quality ?? '').toLowerCase()
  const code = (item.code ?? '').trim().toLowerCase()
  if (q === 'unique' || q === 'set' || /^r(2[0-9]|3[0-3])$/.test(code)) return 6
  if (q === 'rare' || q === 'crafted') return 5
  if (q === 'magic' || /^r(0[1-9]|1[0-9])$/.test(code)) return 4
  if (q === 'superior' || q === 'socketed') return 3
  if (/^(hp[1-5]|hpo|hpf|mp[1-5]|mpo|mpf|rvs|rvl|vps|yps|wms|tsc|isc)$/.test(code)) {
    return 2
  }
  return 1
}

/**
 * Compute non-overlapping mobile touch ground label boxes (`height >= 28px`, horizontal padding `12px`)
 * using iterative vertical spring-repulsion so dense loot piles never stack on top of each other.
 * Preserves each item's true world `(anchorX, anchorY)` for drawing a leader line back to the drop spot.
 */
export function layoutTouchGroundLabels(
  items: readonly GroundLootCandidateInput[],
  logicalWidth: number = 800,
  logicalHeight: number = 600,
): TouchGroundLabelBox[] {
  if (items.length === 0) return []
  const working = items.map((item) => {
    const textW = Math.max(40, item.textWidthPx ?? item.label.length * 9)
    const boxWidth = textW + TOUCH_GROUND_LABEL_PAD_X * 2
    const boxHeight = TOUCH_GROUND_LABEL_MIN_HEIGHT
    const rawX = Math.round(item.screenX - boxWidth / 2)
    const boxX = Math.max(8, Math.min(logicalWidth - boxWidth - 8, rawX))
    const rawY = Math.round(item.screenY - boxHeight - 8)
    const boxY = Math.max(8, Math.min(logicalHeight - boxHeight - 60, rawY))
    return {
      id: item.id,
      label: item.label,
      quality: item.quality ?? 'normal',
      anchorX: item.screenX,
      anchorY: item.screenY,
      boxX,
      boxY,
      boxWidth,
      boxHeight,
    }
  })

  // Sort bottom-to-top by anchorY so lower items keep their ground position and push upper labels upward
  working.sort((a, b) => b.anchorY - a.anchorY || a.id - b.id)

  for (let pass = 0; pass < 6; pass++) {
    let anyMoved = false
    for (let i = 0; i < working.length; i++) {
      const a = working[i]!
      for (let j = i + 1; j < working.length; j++) {
        const b = working[j]!
        const overlapX =
          a.boxX < b.boxX + b.boxWidth + 4 && a.boxX + a.boxWidth + 4 > b.boxX
        const overlapY =
          a.boxY < b.boxY + b.boxHeight + TOUCH_GROUND_LABEL_GAP_Y &&
          a.boxY + a.boxHeight + TOUCH_GROUND_LABEL_GAP_Y > b.boxY
        if (overlapX && overlapY) {
          const targetBY = a.boxY - b.boxHeight - TOUCH_GROUND_LABEL_GAP_Y
          if (b.boxY !== targetBY) {
            b.boxY = Math.max(6, targetBY)
            anyMoved = true
          }
        }
      }
    }
    if (!anyMoved) break
  }

  return working.map((w) => ({
    ...w,
    displaced:
      Math.hypot(
        w.boxX + w.boxWidth / 2 - w.anchorX,
        w.boxY + w.boxHeight - w.anchorY,
      ) > 16,
  }))
}

export function hitTestTouchGroundLabels(
  x: number,
  y: number,
  boxes: readonly TouchGroundLabelBox[],
): TouchGroundLabelBox | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i]!
    if (
      x >= b.boxX &&
      x <= b.boxX + b.boxWidth &&
      y >= b.boxY &&
      y <= b.boxY + b.boxHeight
    ) {
      return b
    }
  }
  return null
}

/**
 * Build a priority-sorted queue of ground loot within `maxPickupRadiusPx` of the player's feet
 * (`Unique / Set / High Rune` > `Rare` > `Magic` > `Potion` > `Gold/Normal`, then by closer distance).
 */
export function buildFootLootQueue(
  playerScreenX: number,
  playerScreenY: number,
  groundItems: readonly GroundLootCandidateInput[],
  maxPickupRadiusPx: number = DEFAULT_INTERACT_MAX_SCREEN_RANGE,
): FootLootCandidate[] {
  const candidates: FootLootCandidate[] = []
  for (const item of groundItems) {
    const dist = Math.hypot(item.screenX - playerScreenX, item.screenY - playerScreenY)
    if (!Number.isFinite(dist) || dist > maxPickupRadiusPx) continue
    const priorityTier = resolveLootPriorityTier(item)
    const distScore = 1 - dist / Math.max(1, maxPickupRadiusPx)
    const score = priorityTier * 10 + distScore
    candidates.push({
      ...item,
      priorityTier,
      distancePx: dist,
      score,
    })
  }
  candidates.sort((a, b) => b.score - a.score || a.distancePx - b.distancePx || a.id - b.id)
  return candidates
}

/**
 * Filter walk-over auto-pickup candidates (Gold `gld` and beltable potions when belt has space)
 * within `autoPickupRadiusPx` (default `56px` ≈ 2 subtiles).
 */
export function collectAutoPickupCandidates(
  playerScreenX: number,
  playerScreenY: number,
  groundItems: readonly GroundLootCandidateInput[],
  options: {
    readonly enabled: boolean
    readonly beltHasSpace: boolean
    readonly autoPickupRadiusPx?: number | undefined
  },
): GroundLootCandidateInput[] {
  if (!options.enabled) return []
  const radius = options.autoPickupRadiusPx ?? 56
  const picked: GroundLootCandidateInput[] = []
  for (const item of groundItems) {
    const dist = Math.hypot(item.screenX - playerScreenX, item.screenY - playerScreenY)
    if (!Number.isFinite(dist) || dist > radius) continue
    const code = (item.code ?? '').trim().toLowerCase()
    if (code === 'gld') {
      picked.push(item)
    } else if (
      options.beltHasSpace &&
      /^(hp[1-5]|hpo|hpf|mp[1-5]|mpo|mpf|rvs|rvl)$/.test(code)
    ) {
      picked.push(item)
    }
  }
  return picked
}

// ============================================================================
// Phase 6 (#1386): Mobile WebAudio Unlock, Haptics, Adaptive DPR & Soft Keyboard
// ============================================================================

export type MobileHapticPatternKind = 'tap' | 'rareDrop' | 'lowHpWarning'

export const MOBILE_HAPTIC_PATTERNS: Readonly<
  Record<MobileHapticPatternKind, number | readonly number[]>
> = {
  tap: 10,
  rareDrop: [30, 50, 60],
  lowHpWarning: [45, 40, 45],
}

export interface VibrateCapableNavigator {
  vibrate?: ((pattern: number | number[]) => boolean) | undefined
}

/**
 * Trigger multi-tier mobile haptic vibration (`tap` = 10ms, `rareDrop` = [30,50,60]ms,
 * `lowHpWarning` = [45,40,45]ms). Safely returns `false` on iOS Safari or desktop browsers
 * without `navigator.vibrate`.
 */
export function triggerMobileHaptic(
  kind: MobileHapticPatternKind,
  enabled: boolean = true,
  nav: VibrateCapableNavigator | null | undefined = typeof navigator !== 'undefined'
    ? (navigator as VibrateCapableNavigator)
    : null,
): boolean {
  if (!enabled || !nav || typeof nav.vibrate !== 'function') {
    return false
  }
  try {
    const pat = MOBILE_HAPTIC_PATTERNS[kind]
    return Boolean(nav.vibrate(Array.isArray(pat) ? [...pat] : (pat as number)))
  } catch {
    return false
  }
}

export interface ResumableAudioContextLike {
  readonly state: 'suspended' | 'running' | 'closed' | 'interrupted' | string
  resume: () => Promise<void>
  suspend?: (() => Promise<void>) | undefined
}

/**
 * Unlock a `suspended` or `interrupted` WebAudio `AudioContext` on the first user touch/click gesture.
 */
export async function unlockMobileAudioContext(
  audioCtx: ResumableAudioContextLike | null | undefined,
): Promise<boolean> {
  if (!audioCtx) return false
  if (audioCtx.state === 'running') return true
  if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
    try {
      await audioCtx.resume()
      return true
    } catch {
      return false
    }
  }
  return false
}

/**
 * Handle page visibility change (`document.hidden`) by suspending audio when backgrounded
 * and resuming when returning to foreground.
 */
export async function syncMobileAudioVisibility(
  audioCtx: ResumableAudioContextLike | null | undefined,
  isHidden: boolean,
): Promise<void> {
  if (!audioCtx) return
  try {
    if (isHidden) {
      if (audioCtx.state === 'running' && typeof audioCtx.suspend === 'function') {
        await audioCtx.suspend()
      }
    } else if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
      await audioCtx.resume()
    }
  } catch {
    // Ignore autoplay/suspension errors in background tabs
  }
}

/**
 * Clamp `window.devicePixelRatio` on mobile/touch devices (`maxMobileDpr = 1.75` by default)
 * to prevent 3x Retina fill-rate throttling and battery overheating, while keeping desktop DPR (`2.0`) intact.
 */
export function clampMobileDevicePixelRatio(
  rawDpr: number,
  isTouchDevice: boolean,
  maxMobileDpr: number = 1.75,
): number {
  const safeRaw = Number.isFinite(rawDpr) && rawDpr > 0 ? rawDpr : 1
  const cap = isTouchDevice ? Math.max(1, Math.min(2, maxMobileDpr)) : 2
  return Math.max(1, Math.min(safeRaw, cap))
}

export interface MobileThermalStepResult {
  readonly avgFrameMs: number
  readonly throttled: boolean
  readonly recommendedMaxDpr: number
  readonly recommendedFpsCap: 30 | 60
}

/**
 * Evaluate a sliding window of frame durations (`ms`) and step down DPR / FPS cap
 * when sustained frame time exceeds `25ms` (`< 40 FPS`).
 */
export function evaluateMobileThermalFrameStep(
  recentFrameDurationsMs: readonly number[],
  currentMaxDpr: number = 1.75,
): MobileThermalStepResult {
  if (recentFrameDurationsMs.length === 0) {
    return {
      avgFrameMs: 16.67,
      throttled: false,
      recommendedMaxDpr: currentMaxDpr,
      recommendedFpsCap: 60,
    }
  }
  let sum = 0
  for (const d of recentFrameDurationsMs) {
    sum += Math.max(0, d)
  }
  const avgFrameMs = sum / recentFrameDurationsMs.length
  if (avgFrameMs > 25) {
    const nextDpr = currentMaxDpr > 1.25 ? 1.25 : 1.0
    return {
      avgFrameMs,
      throttled: true,
      recommendedMaxDpr: nextDpr,
      recommendedFpsCap: 30,
    }
  }
  return {
    avgFrameMs,
    throttled: false,
    recommendedMaxDpr: currentMaxDpr,
    recommendedFpsCap: 60,
  }
}

export type GoldQuickPreset = '25%' | '50%' | '75%' | 'max'

export function resolveGoldQuickPresetAmount(
  preset: GoldQuickPreset,
  maxGold: number,
): number {
  const clampedMax = Math.max(0, Math.floor(maxGold))
  switch (preset) {
    case '25%':
      return Math.max(1, Math.floor(clampedMax * 0.25))
    case '50%':
      return Math.max(1, Math.floor(clampedMax * 0.5))
    case '75%':
      return Math.max(1, Math.floor(clampedMax * 0.75))
    case 'max':
      return clampedMax
  }
}

export interface MobileSoftKeyboardInputAttrs {
  readonly type: 'text'
  readonly inputMode: 'numeric' | 'text'
  readonly pattern?: string | undefined
  readonly enterKeyHint: 'done' | 'send'
  readonly autoComplete: 'off'
}

export function buildMobileSoftKeyboardInputAttrs(
  kind: 'gold' | 'chat',
): MobileSoftKeyboardInputAttrs {
  if (kind === 'gold') {
    return {
      type: 'text',
      inputMode: 'numeric',
      pattern: '[0-9]*',
      enterKeyHint: 'done',
      autoComplete: 'off',
    }
  }
  return {
    type: 'text',
    inputMode: 'text',
    enterKeyHint: 'send',
    autoComplete: 'off',
  }
}


