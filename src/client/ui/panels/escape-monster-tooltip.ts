import type { WorldPanelsHud } from '../world-panels.ts'
import { drawUpgradeCrosses, upgradeSuffix } from '../upgrade-marker.ts'
import { D2FontRenderer, type D2ColorCode } from '../font.ts'
import { getEffectiveItemReqClass, isUiItemUnidentified, type UiInventoryItem } from '../inventory.ts'
import type { WeaponDamageInfo } from '../../../common/items/inventory-model.ts'
import type { CharacterClassCode } from '../../../common/units/classes.ts'
import { requireTbl } from '../../i18n/lang.ts'
import { CANONICAL_CHI_TBL_DICT, CANONICAL_ENG_TBL_DICT } from '../../../common/data/canonical-tbl-strings.ts'
import { CANONICAL_ELITE_MODIFIERS, FIXED_UNIQUE_BOSS_HCIDX_SET, monsterDisplayName, rollUniqueMonsterNameKeys } from '../../../common/units/monsters-data.ts'
import { getSocketableInfo, isJewelCode } from '../../../common/items/gems-data.ts'
import { formatItemTooltip } from '../../../common/items/item-tooltip.ts'
import type { Item } from '../../../common/items/items.ts'
import { STONE_BOX_BG_FILL } from './panel-layout-constants.ts'
import { drawControlsMenu, drawOptionsSubmenu } from './escape-options-menu.ts'

export type EscapeMenuRowIndex = 0 | 1 | 2
export type EscapeMenuAction = 'options' | 'saveAndExit' | 'returnToGame'

export const ESCAPE_MENU_ACTIONS: readonly [EscapeMenuAction, EscapeMenuAction, EscapeMenuAction] = [
  'options',
  'saveAndExit',
  'returnToGame',
] as const

export const ESCAPE_MENU_BANNER_SIZES: readonly [
  { readonly width: 160; readonly height: 36 },
  { readonly width: 434; readonly height: 36 },
  { readonly width: 356; readonly height: 36 },
] = [
  { width: 160, height: 36 },
  { width: 434, height: 36 },
  { width: 356, height: 36 },
] as const

export const ESCAPE_MENU_PENTSPIN_MAX_WIDTH = 52
export const ESCAPE_MENU_PENTSPIN_INTERVAL_MS = 50

export interface PentSpinFrameMeta {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly offsetX: number
  readonly offsetY: number
}

/**
 * Authentic 8-frame `data/global/ui/CURSOR/Pentspin.dc6` strip geometry (`public/ui/pentspin.png`, 295x53).
 */
export const ESCAPE_MENU_PENTSPIN_FRAMES: readonly [
  PentSpinFrameMeta,
  PentSpinFrameMeta,
  PentSpinFrameMeta,
  PentSpinFrameMeta,
  PentSpinFrameMeta,
  PentSpinFrameMeta,
  PentSpinFrameMeta,
  PentSpinFrameMeta,
] = [
  { x: 0, y: 0, w: 51, h: 52, offsetX: -1, offsetY: 0 },
  { x: 51, y: 0, w: 43, h: 53, offsetX: 3, offsetY: 0 },
  { x: 94, y: 0, w: 27, h: 53, offsetX: 11, offsetY: 0 },
  { x: 121, y: 0, w: 9, h: 53, offsetX: 21, offsetY: 0 },
  { x: 130, y: 0, w: 23, h: 53, offsetX: 15, offsetY: 0 },
  { x: 153, y: 0, w: 40, h: 53, offsetX: 7, offsetY: 0 },
  { x: 193, y: 0, w: 50, h: 52, offsetX: 1, offsetY: 0 },
  { x: 243, y: 0, w: 52, h: 51, offsetX: -1, offsetY: 0 },
] as const

export interface EscapeMenuRowLayout {
  readonly index: EscapeMenuRowIndex
  readonly action: EscapeMenuAction
  readonly rowY: number
  readonly baselineY: number
  readonly bannerX: number
  readonly bannerY: number
  readonly bannerWidth: number
  readonly bannerHeight: number
}

export interface EscapeMenuPentPlacement {
  readonly frameIndex: number
  readonly frame: PentSpinFrameMeta
  readonly anchorX: number
  readonly baselineY: number
  readonly x: number
  readonly y: number
}

export interface EscapeMenuLayout {
  readonly centerX: number
  readonly topY: number
  readonly totalHeight: number
  readonly rowStepY: number
  readonly hitMinX: number
  readonly hitMaxX: number
  readonly hitMinY: number
  readonly hitMaxY: number
  readonly selectedIndex: EscapeMenuRowIndex
  readonly spinFrame: number
  readonly rows: readonly [EscapeMenuRowLayout, EscapeMenuRowLayout, EscapeMenuRowLayout]
  readonly leftPent: EscapeMenuPentPlacement
  readonly rightPent: EscapeMenuPentPlacement
}

/**
 * Compute authentic Diablo II v1.13c In-Game Escape Menu layout (`D2Client.dll` `0x6fb92ac0`, `0x6fb15230..0x6fb15555`).
 */
export function computeEscapeMenuLayout(
  hudWidth = 800,
  hudHeight = 600,
  selectedIndex: EscapeMenuRowIndex = 2,
  nowMs = 0,
): EscapeMenuLayout {
  const centerX = Math.trunc(hudWidth / 2)
  const rowStepY = 50
  const totalHeight = 3 * rowStepY
  const topY = Math.trunc((hudHeight - 80) / 2) - Math.trunc(totalHeight / 2)

  const buildRow = (index: EscapeMenuRowIndex): EscapeMenuRowLayout => {
    const size = ESCAPE_MENU_BANNER_SIZES[index]
    const rowY = topY + index * rowStepY
    const baselineY = rowY + 39
    const bannerX = centerX - Math.trunc(size.width / 2) - 1
    const bannerY = baselineY - size.height
    return {
      index,
      action: ESCAPE_MENU_ACTIONS[index],
      rowY,
      baselineY,
      bannerX,
      bannerY,
      bannerWidth: size.width,
      bannerHeight: size.height,
    }
  }

  const rows: readonly [EscapeMenuRowLayout, EscapeMenuRowLayout, EscapeMenuRowLayout] = [
    buildRow(0),
    buildRow(1),
    buildRow(2),
  ]

  const spinFrame = Math.floor(Math.max(0, nowMs) / ESCAPE_MENU_PENTSPIN_INTERVAL_MS) & 7
  const leftFrameIndex = (8 - spinFrame) & 7
  const rightFrameIndex = spinFrame
  const leftFrame = ESCAPE_MENU_PENTSPIN_FRAMES[leftFrameIndex]!
  const rightFrame = ESCAPE_MENU_PENTSPIN_FRAMES[rightFrameIndex]!

  const pentBaselineY = topY + selectedIndex * rowStepY + 51
  const leftAnchorX = centerX - ESCAPE_MENU_PENTSPIN_MAX_WIDTH - 249
  const rightAnchorX = centerX + 249

  return {
    centerX,
    topY,
    totalHeight,
    rowStepY,
    hitMinX: centerX - 260,
    hitMaxX: centerX + 260,
    hitMinY: topY,
    hitMaxY: topY + totalHeight,
    selectedIndex,
    spinFrame,
    rows,
    leftPent: {
      frameIndex: leftFrameIndex,
      frame: leftFrame,
      anchorX: leftAnchorX,
      baselineY: pentBaselineY,
      x: leftAnchorX + leftFrame.offsetX,
      y: pentBaselineY - leftFrame.h + leftFrame.offsetY,
    },
    rightPent: {
      frameIndex: rightFrameIndex,
      frame: rightFrame,
      anchorX: rightAnchorX,
      baselineY: pentBaselineY,
      x: rightAnchorX + rightFrame.offsetX,
      y: pentBaselineY - rightFrame.h + rightFrame.offsetY,
    },
  }
}

/**
 * Hit-test the In-Game Escape Menu (`D2Client.dll` `0x6fb15560` horizontal guard + `0x6fb14080` row check).
 * Returns row index `0` (`options`), `1` (`saveAndExit`), `2` (`returnToGame`), or `null` if outside bounds.
 */
export function hitTestEscapeMenu(
  logicalX: number,
  logicalY: number,
  hudWidth = 800,
  hudHeight = 600,
): EscapeMenuRowIndex | null {
  const centerX = Math.trunc(hudWidth / 2)
  if (logicalX < centerX - 260 || logicalX > centerX + 260) {
    return null
  }
  const topY = Math.trunc((hudHeight - 80) / 2) - 75
  if (logicalY < topY || logicalY >= topY + 150) {
    return null
  }
  const idx = Math.floor((logicalY - topY) / 50)
  return idx === 0 || idx === 1 || idx === 2 ? idx : null
}

/**
 * Target monster HUD info consumed by `drawMonsterTargetBar` (`D2Client.dll` `0x6FB70850`).
 */
export interface MonsterTargetHudInfo {
  readonly unitId?: number | undefined
  readonly name: string
  readonly nameKey?: string | undefined
  readonly hcIdx?: number | undefined
  readonly nameSeed?: number | undefined
  readonly hp: number
  readonly maxHp: number
  readonly rank?: 'normal' | 'champion' | 'unique' | 'superunique' | 'minion' | 'boss' | undefined
  readonly isBoss?: boolean | undefined
  readonly isUndead?: boolean | undefined
  readonly isDemon?: boolean | undefined
  readonly descStr?: string | undefined
  readonly descKey?: string | undefined
  readonly modifiers?: readonly string[] | undefined
  readonly resists?: {
    readonly physical?: number | undefined
    readonly magic?: number | undefined
    readonly fire?: number | undefined
    readonly lightning?: number | undefined
    readonly cold?: number | undefined
    readonly poison?: number | undefined
  } | undefined
  readonly resistances?: {
    readonly physical?: number | undefined
    readonly magic?: number | undefined
    readonly fire?: number | undefined
    readonly lightning?: number | undefined
    readonly cold?: number | undefined
    readonly poison?: number | undefined
  } | undefined
  /** Legacy compatibility fields */
  readonly affixes?: readonly string[] | undefined
  readonly subType?: string | undefined
}

export interface MonsterLifebarLayout {
  readonly visible: boolean
  readonly centerX: number
  readonly y: number
  readonly barWidth: number
  readonly barHeight: number
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly fillRatio128: number
  readonly fillWidth: number
}

export interface MonsterHoverSubtextResult {
  readonly line1: string
  readonly line1Colored: string
  readonly line1Y: number
  readonly line2: string
  readonly line2Colored: string
  readonly line2Y: number
}

/**
 * Resolve a `.tbl` string key in `CANONICAL_ENG_TBL_DICT` or `CANONICAL_CHI_TBL_DICT`
 * (falling back from CHI to ENG when a key is expansion-only).
 */
export function lookupMonsterTblString(key: string, locale: 'en' | 'zh' = 'en'): string | undefined {
  if (!key) return undefined
  if (locale === 'zh') {
    return CANONICAL_CHI_TBL_DICT[key] ?? CANONICAL_ENG_TBL_DICT[key]
  }
  return CANONICAL_ENG_TBL_DICT[key]
}

export const CHAMPION_SUBTYPE_TBL_KEYS: Readonly<Record<string, string>> = {
  '16': 'Champion',
  champion: 'Champion',
  '36': 'champghostlyX',
  ghostly: 'champghostlyX',
  champghostlyx: 'champghostlyX',
  '37': 'champfanaticX',
  fanatic: 'champfanaticX',
  champfanaticx: 'champfanaticX',
  '38': 'champpossessedX',
  possessed: 'champpossessedX',
  champpossessedx: 'champpossessedX',
  '39': 'champberserkX',
  berserk: 'champberserkX',
  berserker: 'champberserkX',
  champberserkx: 'champberserkX',
}

/**
 * Resolve localized monster title, 2-space lifebar padding (`"  " + Name + "  "`),
 * and canonical rank color (`white` Normal/Minion, `blue` Champion, `gold` Unique/SuperUnique/Boss)
 * per `D2Client.dll` `sub_6FACFDD0` (`0x6FACFDD0`), `sub_6FB70850` (`0x6FB70850`),
 * and `sub_6FAD0620` (`0x6FAD0620`).
 */
export function resolveMonsterTitleAndColor(
  target: MonsterTargetHudInfo,
  locale: 'en' | 'zh' = 'en',
): {
  readonly displayName: string
  readonly paddedTitle: string
  readonly titleColor: D2ColorCode
} {
  const rawKey = target.nameKey || target.name
  const baseName =
    lookupMonsterTblString(rawKey, locale) ??
    monsterDisplayName(rawKey, locale === 'en' ? 'ENG' : 'CHI') ??
    target.name

  const isGoldRank =
    target.rank === 'unique' ||
    target.rank === 'superunique' ||
    target.rank === 'boss' ||
    Boolean(target.isBoss)

  if (isGoldRank) {
    if (
      target.rank === 'unique' &&
      target.nameSeed !== undefined &&
      !FIXED_UNIQUE_BOSS_HCIDX_SET.has(target.hcIdx ?? -1)
    ) {
      const mods =
        target.modifiers && target.modifiers.length > 0
          ? target.modifiers
          : (target.affixes ?? [])
      const hasBloodRavenUMod = mods.some(m => String(m).trim() === '12')
      if (hasBloodRavenUMod) {
        const brName = lookupMonsterTblString('Blood Raven', locale) ?? 'Blood Raven'
        return {
          displayName: brName,
          paddedTitle: `  ${brName}  `,
          titleColor: 'gold',
        }
      }
      const partKeys = rollUniqueMonsterNameKeys(target.nameSeed)
      const rolledName = partKeys
        .map(k => lookupMonsterTblString(k, locale) ?? k)
        .join(' ')
      return {
        displayName: rolledName,
        paddedTitle: `  ${rolledName}  `,
        titleColor: 'gold',
      }
    }

    return {
      displayName: baseName,
      paddedTitle: `  ${baseName}  `,
      titleColor: 'gold',
    }
  }

  if (target.rank === 'champion') {
    let champTblKey = 'Champion'
    const mods =
      target.modifiers && target.modifiers.length > 0
        ? target.modifiers
        : (target.affixes ?? [])
    for (const mod of mods) {
      const normalized = String(mod).trim().toLowerCase()
      const mapped = CHAMPION_SUBTYPE_TBL_KEYS[normalized]
      if (mapped) {
        champTblKey = mapped
        break
      }
    }
    const prefix = lookupMonsterTblString(champTblKey, locale) ?? 'Champion'
    const displayName = baseName.startsWith(`${prefix} `) ? baseName : `${prefix} ${baseName}`
    return {
      displayName,
      paddedTitle: `  ${displayName}  `,
      titleColor: 'blue',
    }
  }

  return {
    displayName: baseName,
    paddedTitle: `  ${baseName}  `,
    titleColor: 'white',
  }
}

/**
 * Compute authentic 1.13c monster lifebar plaque geometry and health fill ratio
 * per `D2Client.dll` `sub_6FB70850` (`0x6FB70850`) and `D2Win.dll` `Ordinal_10070` (`0x6F8F18F0`).
 *
 * - Center X (`sub_6FB70850`):
 *   - Neither panel open: `canvasWidth / 2` (`400`)
 *   - Left panel open only: `(3 * canvasWidth) / 4` (`600`)
 *   - Right panel open only: `canvasWidth / 4` (`200`)
 *   - Both panels open: hidden (`visible: false`)
 * - Vertical position: `y = 32` (`top = 19`, `bottom = 36`, `barHeight = 17`)
 * - Bar width: `Math.max(128, textWidth)`
 * - Health fill ratio: `clamp(floor((hp * 128) / maxHp), 2, 128)` when `hp > 0`
 */
export function computeMonsterLifebarLayout(
  canvasWidth: number,
  leftPanelOpen: boolean,
  rightPanelOpen: boolean,
  textWidth: number,
  hp: number,
  maxHp: number,
): MonsterLifebarLayout {
  const y = 32
  const barHeight = 17
  const top = y - 13
  const bottom = y + 4
  const barWidth = Math.max(128, Math.ceil(textWidth))

  if (hp <= 0 || (leftPanelOpen && rightPanelOpen)) {
    const centerX = Math.floor(canvasWidth / 2)
    const left = Math.floor(centerX - barWidth / 2)
    return {
      visible: false,
      centerX,
      y,
      barWidth,
      barHeight,
      left,
      top,
      right: left + barWidth,
      bottom,
      fillRatio128: 0,
      fillWidth: 0,
    }
  }

  let centerX = Math.floor(canvasWidth / 2)
  if (leftPanelOpen && !rightPanelOpen) {
    centerX = Math.floor((3 * canvasWidth) / 4)
  } else if (!leftPanelOpen && rightPanelOpen) {
    centerX = Math.floor(canvasWidth / 4)
  }

  const left = Math.floor(centerX - barWidth / 2)
  const right = left + barWidth

  const safeMaxHp = maxHp > 0 ? maxHp : 1
  const rawRatio = Math.floor((hp * 128) / safeMaxHp)
  const fillRatio128 = Math.max(2, Math.min(128, rawRatio))
  const fillWidth = Math.floor((barWidth * fillRatio128) / 128)

  return {
    visible: true,
    centerX,
    y,
    barWidth,
    barHeight,
    left,
    top,
    right,
    bottom,
    fillRatio128,
    fillWidth,
  }
}

/**
 * Canonical 1.13c immunity descriptor table (`.rdata:0x6FB834EC`, iterated in `sub_6FB719B0`).
 * Strictly ordered: Physical (gold `ÿc4`), Magic (orange `ÿc8`), Fire (red `ÿc1`),
 * Lightning (yellow `ÿc9`), Cold (blue `ÿc3`), Poison (green `ÿc2`).
 */
export const CANONICAL_IMMUNITY_DESCRIPTORS: readonly {
  readonly key: 'physical' | 'magic' | 'fire' | 'lightning' | 'cold' | 'poison'
  readonly tblKey: string
  readonly colorCode: string
  readonly fallbackEn: string
}[] = [
  { key: 'physical', tblKey: 'strScaryMonDesc5', colorCode: 'ÿc4', fallbackEn: 'Immune to Physical' },
  { key: 'magic', tblKey: 'strScaryMonDesc6', colorCode: 'ÿc8', fallbackEn: 'Immune to Magic' },
  { key: 'fire', tblKey: 'strScaryMonDesc1', colorCode: 'ÿc1', fallbackEn: 'Immune to Fire' },
  { key: 'lightning', tblKey: 'strScaryMonDesc3', colorCode: 'ÿc9', fallbackEn: 'Immune to Lightning' },
  { key: 'cold', tblKey: 'strScaryMonDesc2', colorCode: 'ÿc3', fallbackEn: 'Immune to Cold' },
  { key: 'poison', tblKey: 'strScaryMonDesc4', colorCode: 'ÿc2', fallbackEn: 'Immune to Poison' },
]

/**
 * Complete `wMonUModStrTable` (`D2Client.dll` `.data:0x6FBA9F88`) lookup map
 * covering all 14 displayed `MonUMod.txt` IDs (`5..9, 17, 18, 24..30`),
 * canonical names, `.tbl` keys (`3205..3218`), and `MonUMod.txt` short names.
 */
export const MONSTER_UMOD_TBL_KEYS: Readonly<Record<string, { readonly tblKey: string; readonly label: string }>> = {
  '5': { tblKey: 'uniquextrastrong', label: 'Extra Strong' },
  strong: { tblKey: 'uniquextrastrong', label: 'Extra Strong' },
  uniquextrastrong: { tblKey: 'uniquextrastrong', label: 'Extra Strong' },
  '6': { tblKey: 'uniqueextrafast', label: 'Extra Fast' },
  fast: { tblKey: 'uniqueextrafast', label: 'Extra Fast' },
  uniqueextrafast: { tblKey: 'uniqueextrafast', label: 'Extra Fast' },
  '7': { tblKey: 'uniquecursed', label: 'Cursed' },
  cursed: { tblKey: 'uniquecursed', label: 'Cursed' },
  curse: { tblKey: 'uniquecursed', label: 'Cursed' },
  uniquecursed: { tblKey: 'uniquecursed', label: 'Cursed' },
  '8': { tblKey: 'uniquemagicresistance', label: 'Magic Resistant' },
  magicresistant: { tblKey: 'uniquemagicresistance', label: 'Magic Resistant' },
  resist: { tblKey: 'uniquemagicresistance', label: 'Magic Resistant' },
  uniquemagicresistance: { tblKey: 'uniquemagicresistance', label: 'Magic Resistant' },
  '9': { tblKey: 'uniquefireenchanted', label: 'Fire Enchanted' },
  fireenchant: { tblKey: 'uniquefireenchanted', label: 'Fire Enchanted' },
  fire: { tblKey: 'uniquefireenchanted', label: 'Fire Enchanted' },
  uniquefireenchanted: { tblKey: 'uniquefireenchanted', label: 'Fire Enchanted' },
  '17': { tblKey: 'monsteruniqueprop2', label: 'Lightning Enchanted' },
  lightenchant: { tblKey: 'monsteruniqueprop2', label: 'Lightning Enchanted' },
  lightning: { tblKey: 'monsteruniqueprop2', label: 'Lightning Enchanted' },
  monsteruniqueprop2: { tblKey: 'monsteruniqueprop2', label: 'Lightning Enchanted' },
  '18': { tblKey: 'monsteruniqueprop1', label: 'Cold Enchanted' },
  coldenchant: { tblKey: 'monsteruniqueprop1', label: 'Cold Enchanted' },
  cold: { tblKey: 'monsteruniqueprop1', label: 'Cold Enchanted' },
  monsteruniqueprop1: { tblKey: 'monsteruniqueprop1', label: 'Cold Enchanted' },
  '24': { tblKey: 'monsteruniqueprop8', label: 'Thief' },
  thief: { tblKey: 'monsteruniqueprop8', label: 'Thief' },
  monsteruniqueprop8: { tblKey: 'monsteruniqueprop8', label: 'Thief' },
  '25': { tblKey: 'monsteruniqueprop3', label: 'Mana Burn' },
  manahit: { tblKey: 'monsteruniqueprop3', label: 'Mana Burn' },
  mana: { tblKey: 'monsteruniqueprop3', label: 'Mana Burn' },
  monsteruniqueprop3: { tblKey: 'monsteruniqueprop3', label: 'Mana Burn' },
  '26': { tblKey: 'monsteruniqueprop5', label: 'Teleportation' },
  teleport: { tblKey: 'monsteruniqueprop5', label: 'Teleportation' },
  monsteruniqueprop5: { tblKey: 'monsteruniqueprop5', label: 'Teleportation' },
  '27': { tblKey: 'monsteruniqueprop4', label: 'Spectral Hit' },
  spectralhit: { tblKey: 'monsteruniqueprop4', label: 'Spectral Hit' },
  spectral: { tblKey: 'monsteruniqueprop4', label: 'Spectral Hit' },
  monsteruniqueprop4: { tblKey: 'monsteruniqueprop4', label: 'Spectral Hit' },
  '28': { tblKey: 'monsteruniqueprop6', label: 'Stone Skin' },
  stoneskin: { tblKey: 'monsteruniqueprop6', label: 'Stone Skin' },
  monsteruniqueprop6: { tblKey: 'monsteruniqueprop6', label: 'Stone Skin' },
  '29': { tblKey: 'monsteruniqueprop7', label: 'Multiple Shots' },
  multishot: { tblKey: 'monsteruniqueprop7', label: 'Multiple Shots' },
  multi: { tblKey: 'monsteruniqueprop7', label: 'Multiple Shots' },
  monsteruniqueprop7: { tblKey: 'monsteruniqueprop7', label: 'Multiple Shots' },
  '30': { tblKey: 'monsteruniqueprop9', label: 'Aura Enchanted' },
  aura: { tblKey: 'monsteruniqueprop9', label: 'Aura Enchanted' },
  monsteruniqueprop9: { tblKey: 'monsteruniqueprop9', label: 'Aura Enchanted' },
}

/**
 * Build the 2-line monster hover subtext below the lifebar plaque
 * per `D2Client.dll` `sub_6FB70850` (`0x6FB70850`), `sub_6FB6FCA0` (`0x6FB6FCA0`),
 * `sub_6FB719B0` (`0x6FB719B0`), and `sub_6FB71A20` (`0x6FB71A20`).
 *
 * - Line 1 (`y = 55`):
 *   - Race (`Undead` if `isUndead`, `Demon` if `isDemon`, omitted for animals/beasts)
 *   - Unique/SuperUnique: `"  "`-separated `<Race>  <Modifiers>  <DescStr>` in `gold` (`ÿc4`)
 *   - Minion: `<Race>  Minion` (`3221`) in `white` (`ÿc0`)
 *   - Normal/Champion/Boss: `<Race>  <DescStr>` in rank color (`white` / `blue` / `gold`)
 * - Line 2 (`y = 69` when Line 1 is non-empty, `y = 55` when Line 1 is empty):
 *   - `", "`-separated immunities (`res >= 100`) in exact `.rdata:0x6FB834EC` order.
 */
const RESIST_NAMES: Record<(typeof CANONICAL_IMMUNITY_DESCRIPTORS)[number]['key'], { readonly en: string; readonly zh: string }> = {
  physical: { en: 'Physical', zh: '物理' },
  magic: { en: 'Magic', zh: '魔法' },
  fire: { en: 'Fire', zh: '火焰' },
  lightning: { en: 'Lightning', zh: '闪电' },
  cold: { en: 'Cold', zh: '冰冷' },
  poison: { en: 'Poison', zh: '毒素' },
}

export function buildMonsterHoverSubtext(
  target: MonsterTargetHudInfo,
  locale: 'en' | 'zh' = 'en',
  showResists = false,
): MonsterHoverSubtextResult {
  const raceText = target.isUndead
    ? (lookupMonsterTblString('UndeadDescriptX', locale) ?? 'Undead')
    : target.isDemon
      ? (lookupMonsterTblString('DemonID', locale) ?? 'Demon')
      : ''

  const rawDesc = (target.descKey ?? target.descStr ?? '').trim()
  const isDummyDesc = rawDesc.toLowerCase() === 'dummy'
  const resolvedDesc = rawDesc && !isDummyDesc ? (lookupMonsterTblString(rawDesc, locale) ?? rawDesc) : ''
  const descText = resolvedDesc.toLowerCase() === 'dummy' ? '' : resolvedDesc

  let abilityPlain = ''
  let abilityColorPrefix = ''

  if (target.rank === 'unique' || target.rank === 'superunique') {
    const modParts: string[] = []
    const mods = (target.modifiers && target.modifiers.length > 0)
      ? target.modifiers
      : (target.affixes ?? [])
    for (const mod of mods) {
      const normalizedMod = String(mod).trim().toLowerCase()
      const umodEntry = MONSTER_UMOD_TBL_KEYS[normalizedMod]
        ?? CANONICAL_ELITE_MODIFIERS.find(m => m.name === normalizedMod || m.tblKey === normalizedMod)
      const label = umodEntry
        ? (lookupMonsterTblString(umodEntry.tblKey, locale) ?? umodEntry.label)
        : (lookupMonsterTblString(mod, locale) ?? mod)
      if (label && label.toLowerCase() !== 'dummy') modParts.push(label)
    }
    if (descText) {
      modParts.push(descText)
    }
    abilityPlain = modParts.join('  ')
    abilityColorPrefix = 'ÿc4'
  } else if (target.rank === 'minion') {
    abilityPlain = lookupMonsterTblString('minion', locale) ?? 'Minion'
    abilityColorPrefix = ''
  } else {
    const rawSubType = (target.subType ?? '').trim()
    const cleanSubType =
      rawSubType.toLowerCase() === 'dummy'
        ? ''
        : rawSubType.includes(' · ')
          ? (locale === 'en' ? rawSubType.split(' · ')[0]! : rawSubType.split(' · ').slice(-1)[0]!)
          : rawSubType
    abilityPlain = descText || cleanSubType
    if (target.rank === 'boss' || target.isBoss) {
      abilityColorPrefix = 'ÿc4'
    } else if (target.rank === 'champion') {
      abilityColorPrefix = 'ÿc3'
    } else {
      abilityColorPrefix = ''
    }
  }

  let line1 = ''
  if (raceText !== '' && abilityPlain !== '') {
    line1 = `${raceText}  ${abilityPlain}`
  } else if (raceText !== '') {
    line1 = raceText
  } else if (abilityPlain !== '') {
    line1 = abilityPlain
  }
  const line1Colored =
    line1 !== '' && abilityColorPrefix !== '' ? `${abilityColorPrefix}${line1}` : line1

  const res = target.resists ?? target.resistances
  const immPlainParts: string[] = []
  const immColoredParts: string[] = []
  if (res) {
    for (const desc of CANONICAL_IMMUNITY_DESCRIPTORS) {
      const val = res[desc.key]
      if (typeof val === 'number' && (val >= 100 || (showResists && val !== 0))) {
        const label = val >= 100 ? (lookupMonsterTblString(desc.tblKey, locale) ?? desc.fallbackEn) : `${RESIST_NAMES[desc.key][locale]} ${val}%`
        immPlainParts.push(label)
        immColoredParts.push(`${desc.colorCode}${label}`)
      }
    }
  }

  const line2 = immPlainParts.join(', ')
  const line2Colored = immColoredParts.join('ÿc0, ')
  const line1Y = 55
  const line2Y = line1 !== '' ? 69 : 55

  return {
    line1,
    line1Colored,
    line1Y,
    line2,
    line2Colored,
    line2Y,
  }
}

export const STARTER_STAT_EN_EXACT: Record<string, string> = {
  '任务宝盒': 'Horadric Artifact',
  '轻型铁手套': 'Light Gauntlets',
  '完美宝石': 'Perfect Gem',
  '宝石': 'Gem',
  '骷髅': 'Skull',
  '卷轴': 'Scroll',
  '可镶嵌进有凹槽的装备': 'Can be Inserted into Socketed Items',
  '右键点击打开合成界面 (3×4 网格)': 'Right-Click to Open Horadric Cube (3x4 Grid)',
  '右键施放城镇传送门': 'Right-Click to Cast Town Portal',
  '鉴定未辨识的魔法/暗金装备': 'Right-Click to Identify Unidentified Items',
  '被击中时有 25% 几率施放等级 1 传送': '25% Chance to Cast Level 1 Teleport When Struck',
  '击中时有 5% 几率施放等级 10 火风暴': '5% Chance to Cast Level 10 Firestorm on Striking',
  '升级时有 100% 几率施放等级 29 炽烈之径': '100% Chance to Cast Level 29 Blaze When You Level-Up',
  '阵亡时有 100% 几率施放等级 37 暴风雪': '100% Chance to Cast Level 37 Blizzard When You Die',
  '升级时有 100% 几率施放等级 41 新星': '100% Chance to Cast Level 41 Nova When You Level-Up',
  '化身为吸血鬼巫妖形态 (完整套装)': 'Transforms into Vampire Form (Full Set)',
  '发射魔法箭 (等级 1)': 'Fires Magic Arrows (Level 1)',
  '冻结目标时间减半': 'Half Freeze Duration',
  '无法冰冻': 'Cannot Be Frozen',
  '忽略目标防御': "Ignore Target's Defense",
  '防止怪物自愈 / 防止怪物自疗 (Prevent Monster Heal)': 'Prevent Monster Heal',
  '法球类 - 普通攻击速度': 'Orb Class - Normal Attack Speed',
  '剑类 - 极快的攻击速度': 'Sword Class - Very Fast Attack Speed',
  '弓类 - 极快攻击速度 [40]': 'Bow Class - Very Fast Attack Speed [40]',
  '权杖类 - 极快攻击速度 [40]': 'Scepter Class - Very Fast Attack Speed [40]',
  '锤类 - 极快攻击速度 [40]': 'Mace Class - Very Fast Attack Speed [40]',
  '钉头槌类 - 极快攻击速度 [30]': 'Mace Class - Very Fast Attack Speed [30]',
  '爪类 - 极快攻击速度 [40]': 'Claw Class - Very Fast Attack Speed [40]',
}

function localizeStarterTooltipLine(text: string, isEn: boolean): string {
  if (!text) return text
  if (!isEn) {
    // CHI mode: strip trailing English parentheticals like `(Harlequin Crest)`, `(Shako)`, `(FCR)`, `(+2 To All Skills)`
    // and clean up inline English annotations on starter items while keeping authentic Chinese parens like `凹槽 (2)`,
    // `穿刺攻击 (33%)`, `(完整套装)` / `(数量: 20)`.
    let zh = text
      .replace(/^带插槽\s*\((\d+)\)$/, '凹槽 ($1)')
      .replace(/^精神\s*\(Spirit\)\s*统盾$/, '精神')
      .replace(/\s*\(([A-Za-z]+)\s+符文\)$/, '符文')
      .replace(/\s*\(Rainbow Facet\s*-\s*([^)]+)\)$/, ' ($1)')
      .replace(/\s*\/\s*每次命中偷取生命\s*\([^)]+\)$/, '')
      .replace(/\s*\/\s*防止怪物自疗\s*\([^)]+\)$/, '')
      .replace(/\s*\/\s*战嚎\s*\([^)]+\)$/, '')
      .replace(/\s*\/\s*生命补满\s*\+\d+\s*\([^)]+\)$/, '')
    zh = zh.replace(
      /\s*\((?:[A-Za-z0-9'+\-% /×·,.#:]*[A-Za-z][A-Za-z0-9'+\-% /×·,.#:]*|\d+\/\d+|#\d+)\)$/,
      '',
    )
    return zh
  }

  // ENG mode: zero CJK characters allowed
  if (!/[\u4e00-\u9fff]/.test(text)) {
    return text.replace(
      /^(\d+)\s*to\s*(\d+)\s*\/\s*Two-Hand:\s*(\d+)\s*to\s*(\d+)$/i,
      'One-Hand Damage: $1 to $2 / Two-Hand Damage: $3 to $4',
    )
  }
  if (text.includes('ÿc')) {
    return text
      .split(/(ÿc[0-9:;])/g)
      .map((part) => {
        if (/^ÿc[0-9:;]$/.test(part) || !part) return part
        const lead = /^\s*/.exec(part)?.[0] ?? ''
        const trail = /\s*$/.exec(part)?.[0] ?? ''
        const core = part.trim()
        if (!core) return part
        return `${lead}${localizeStarterTooltipLine(core, true).trim()}${trail}`
      })
      .join('')
  }
  if (STARTER_STAT_EN_EXACT[text]) return STARTER_STAT_EN_EXACT[text]!

  // If the string has an explicit English parenthetical like `谐角之冠 (Harlequin Crest)` or `+2 所有技能 (+2 To All Skills)`
  const trailingEnMatch = /\(([A-Za-z0-9'+\-% /,.#:]+)\)$/.exec(text)
  if (trailingEnMatch) {
    const inner = trailingEnMatch[1]!.trim()
    // Only use `inner` directly if it's a full phrase/name (not a short acronym like FCR/FHR/IAS/ED/FRW/MF/CB or number like 40/15)
    if (
      inner.length > 3 &&
      !/^(FCR|FHR|IAS|FRW|MF|ED|CB|\d+\/\d+|#\d+|\d+)$/.test(inner)
    ) {
      return inner
    }
  }

  let s = text
    // Strip short acronym parentheticals before pattern replacement
    .replace(/\s*\((?:FCR|FHR|IAS|FRW|MF|ED|CB)\)/g, '')
    // Full set / partial set suffixes
    .replace(/(^|\s+)\(完整套装加成\)/g, '$1(Full Set Bonus)')
    .replace(/(^|\s+)\(完整套装\)/g, '$1(Full Set)')
    .replace(/(^|\s+)\((\d+)\s*件装备\)/g, '$1($2 Items)')
    .replace(/(^|\s+)\(依角色等级而定\)/g, '$1(Based on Character Level)')
    .replace(/(^|\s+)\(持续\s*(\d+)\s*秒\)/g, '$1(Over $2 Seconds)')
    // Class restrictions inside skill lines
    .replace(/(^|\s+)\(限法师\)/g, '$1(Sorceress Only)')
    .replace(/(^|\s+)\(限死灵法师\)/g, '$1(Necromancer Only)')
    .replace(/(^|\s+)\(限圣骑士\)/g, '$1(Paladin Only)')
    .replace(/(^|\s+)\(限野蛮人\)/g, '$1(Barbarian Only)')
    .replace(/(^|\s+)\(限德鲁伊\)/g, '$1(Druid Only)')
    .replace(/(^|\s+)\(限刺客\)/g, '$1(Assassin Only)')
    .replace(/(^|\s+)\(限亚马逊\)/g, '$1(Amazon Only)')
    // Weapon damage lines
    .replace(/^双手伤害:\s*(\d+)\s*-\s*(\d+)$/, 'Two-Hand Damage: $1 to $2')
    .replace(/^投掷伤害:\s*(\d+)\s*-\s*(\d+)$/, 'Throw Damage: $1 to $2')
    .replace(/^单手伤害:\s*(\d+)\s*-\s*(\d+)$/, 'One-Hand Damage: $1 to $2')
    .replace(/^(\d+)\s*-\s*(\d+)\s*\/\s*双手:\s*(\d+)\s*-\s*(\d+)$/, 'One-Hand Damage: $1 to $2 / Two-Hand Damage: $3 to $4')
    .replace(/^(\d+)\s*to\s*(\d+)\s*\/\s*Two-Hand:\s*(\d+)\s*to\s*(\d+)$/i, 'One-Hand Damage: $1 to $2 / Two-Hand Damage: $3 to $4')
    .replace(/^双手伤害:\s*/, 'Two-Hand Damage: ')
    .replace(/^投掷伤害:\s*/, 'Throw Damage: ')
    .replace(/^单手伤害:\s*/, 'One-Hand Damage: ')
    .replace(/\s*\/\s*双手:\s*/, ' / Two-Hand Damage: ')
    // Specific base/title patterns
    .replace(/^法术书\s*\(数量[:：]\s*(\d+)\)$/, 'Tome (Quantity: $1)')
    .replace(/^符文\s*\(#(\d+)\)$/, 'Rune (#$1)')
    .replace(/^带插槽\s*\((\d+)\)$/, 'Socketed ($1)')
    .replace(/^凹槽\s*\((\d+)\)$/, 'Socketed ($1)')
    // Stat patterns
    .replace(/^\+(\d+)\s*所有技能/, '+$1 to All Skills')
    .replace(/^\+(\d+)\s*亚马逊技能等级/, '+$1 to Amazon Skill Levels')
    .replace(/^\+(\d+)\s*法师技能等级/, '+$1 to Sorceress Skill Levels')
    .replace(/^\+(\d+)\s*死灵法师技能等级/, '+$1 to Necromancer Skill Levels')
    .replace(/^\+(\d+)\s*圣骑士技能等级/, '+$1 to Paladin Skill Levels')
    .replace(/^\+(\d+)\s*野蛮人技能等级/, '+$1 to Barbarian Skill Levels')
    .replace(/^\+(\d+)\s*德鲁伊技能等级/, '+$1 to Druid Skill Levels')
    .replace(/^\+(\d+)\s*刺客技能等级/, '+$1 to Assassin Skill Levels')
    .replace(/^\+(\d+)\s*角色技能等级/, '+$1 to Character Skill Levels')
    .replace(/^\+(\d+)\s*火焰技能/, '+$1 to Fire Skills')
    .replace(/^\+(\d+)\s*亚马逊被动与魔法技能/, '+$1 to Passive and Magic Skills (Amazon Only)')
    .replace(/^\+(\d+)\s*亚马逊弓与十字弓技能/, '+$1 to Bow and Crossbow Skills (Amazon Only)')
    .replace(/^\+(\d+)\s*召唤技能/, '+$1 to Summoning Skills')
    .replace(/^\+(\d+)\s*毒素与白骨技能/, '+$1 to Poison and Bone Skills')
    .replace(/^\+(\d+)\s*诅咒技能/, '+$1 to Curses')
    .replace(/^\+(\d+)\s*防御灵气/, '+$1 to Defensive Auras')
    .replace(/^\+(\d+)\s*战吼技能/, '+$1 to Warcries')
    .replace(/^\+(\d+)\s*战斗技能/, '+$1 to Combat Skills')
    .replace(/^\+(\d+)\s*元素技能/, '+$1 to Elemental Skills')
    .replace(/^\+(\d+)\s*变形技能/, '+$1 to Shape Shifting Skills')
    .replace(/^\+(\d+)\s*影子训练技能/, '+$1 to Shadow Disciplines')
    .replace(/^\+(\d+)\s*支配火焰/, '+$1 to Fire Mastery')
    .replace(/^\+(\d+)\s*支配闪电/, '+$1 to Lightning Mastery')
    .replace(/^\+(\d+)\s*支配冰冷/, '+$1 to Cold Mastery')
    .replace(/^\+(\d+)\s*火球/, '+$1 to Fire Ball')
    .replace(/^\+(\d+)\s*火墙/, '+$1 to Fire Wall')
    .replace(/^\+(\d+)\s*陨石/, '+$1 to Meteor')
    .replace(/^\+(\d+)%\s*快速施法速度/, '+$1% Faster Cast Rate')
    .replace(/^\+(\d+)%\s*快速再度攻击/, '+$1% Faster Hit Recovery')
    .replace(/^\+(\d+)%\s*快速格挡率/, '+$1% Faster Block Rate')
    .replace(/^\+(\d+)%\s*增加格挡几率/, '+$1% Increased Chance of Blocking')
    .replace(/^\+(\d+)%\s*高速跑步\/行走/, '+$1% Faster Run/Walk')
    .replace(/^\+(\d+)%\s*提升攻击速度/, '+$1% Increased Attack Speed')
    .replace(/^\+(\d+)%\s*增强伤害/, '+$1% Enhanced Damage')
    .replace(/^\+(\d+)%\s*增强防御/, '+$1% Enhanced Defense')
    .replace(/^\+(\d+)%\s*额外攻击准确率/, '+$1% Bonus to Attack Rating')
    .replace(/^\+(\d+)%\s*对恶魔的伤害/, '+$1% Damage to Demons')
    .replace(/^\+(\d+)%\s*对不死生物的伤害/, '+$1% Damage to Undead')
    .replace(/^\+(\d+)%\s*冰冷技能伤害/, '+$1% to Cold Skill Damage')
    .replace(/^\+(\d+)%\s*火焰技能伤害/, '+$1% to Fire Skill Damage')
    .replace(/^\+(\d+)%\s*闪电技能伤害/, '+$1% to Lightning Skill Damage')
    .replace(/^\+(\d+)%\s*毒素技能伤害/, '+$1% to Poison Skill Damage')
    .replace(/^-(\d+)%\s*敌人火焰抗性/, '-$1% to Enemy Fire Resistance')
    .replace(/^-(\d+)%\s*敌人冰冷抗性/, '-$1% to Enemy Cold Resistance')
    .replace(/^-(\d+)%\s*敌人闪电抗性/, '-$1% to Enemy Lightning Resistance')
    .replace(/^\+(\d+)%\s*获得经验值/, '+$1% to Experience Gained')
    .replace(/^(\d+)%\s*压碎性打击/, '$1% Chance of Crushing Blow')
    .replace(/^(\d+)%\s*每次命中偷取生命/, '$1% Life Stolen per Hit')
    .replace(/^(\d+)%\s*每次命中偷取法力/, '$1% Mana Stolen per Hit')
    .replace(/^(\d+)%\s*更佳机会取得魔法装备/, '$1% Better Chance of Getting Magic Items')
    .replace(/^(\d+)%\s*额外金币从怪物身上取得/, '$1% Extra Gold from Monsters')
    .replace(/^(\d+)%\s*额外金币取得/, '$1% Extra Gold from Monsters')
    .replace(/^降低所有(?:商店|商人)价格\s*(\d+)%/, 'Reduces All Vendor Prices $1%')
    .replace(/^增加法力上限\s*(\d+)%/, 'Increase Maximum Mana $1%')
    .replace(/^法力(?:再生|回复)速度提高\s*(\d+)%/, 'Regenerate Mana $1%')
    .replace(/^减慢目标速度\s*(\d+)%/, 'Slows Target by $1%')
    .replace(/^减慢耐力消耗\s*(\d+)%/, '$1% Slower Stamina Drain')
    .replace(/^受损生命转化为法力\s*(\d+)%/, '$1% Damage Taken Goes to Mana')
    .replace(/^物理伤害减少\s*(\d+)%/, 'Damage Reduced by $1%')
    .replace(/^魔法伤害减少\s*(\d+)/, 'Magic Damage Reduced by $1')
    .replace(/^需求\s*-(\d+)%/, 'Requirements -$1%')
    .replace(/^所有抗性\s*\+(\d+)/, 'All Resistances +$1')
    .replace(/^抗寒\s*\+(\d+)%/, 'Cold Resist +$1%')
    .replace(/^抗电\s*\+(\d+)%/, 'Lightning Resist +$1%')
    .replace(/^抗火\s*\+(\d+)%/, 'Fire Resist +$1%')
    .replace(/^抗毒\s*\+(\d+)%/, 'Poison Resist +$1%')
    .replace(/^增加\s*(\d+-\d+)\s*火焰伤害/, 'Adds $1 Fire Damage')
    .replace(/^增加\s*(\d+-\d+)\s*闪电伤害/, 'Adds $1 Lightning Damage')
    .replace(/^增加\s*(\d+-\d+)\s*冰冷伤害/, 'Adds $1 Cold Damage')
    .replace(/^增加\s*(\d+)\s*冰冷伤害/, 'Adds $1 Cold Damage')
    .replace(/^增加\s*(\d+-\d+)\s*魔法伤害/, 'Adds $1 Magic Damage')
    .replace(/^增加\s*(\d+-\d+)\s*伤害/, 'Adds $1 Damage')
    .replace(/^\+(\d+)\s*生命补给/, 'Replenish Life +$1')
    .replace(/^生命回复\s*\+(\d+)/, 'Replenish Life +$1')
    .replace(/^\+([\d.]+)\s*最大生命/, '+$1 to Maximum Life')
    .replace(/^\+([\d.]+)\s*生命/, '+$1 to Life')
    .replace(/^\+([\d.]+)\s*法力/, '+$1 to Mana')
    .replace(/^\+(\d+)\s*最大耐力/, '+$1 Maximum Stamina')
    .replace(/^\+(\d+)\s*力量/, '+$1 to Strength')
    .replace(/^\+(\d+)\s*敏捷/, '+$1 to Dexterity')
    .replace(/^\+(\d+)\s*体力/, '+$1 to Vitality')
    .replace(/^\+(\d+)\s*精力/, '+$1 to Energy')
    .replace(/^\+(\d+)\s*所有属性/, '+$1 to All Attributes')
    .replace(/^\+(\d+)\s*防御/, '+$1 Defense')
    .replace(/^\+(\d+)\s*对远距离攻击的防御/, '+$1 Defense vs. Missile')
    .replace(/^\+(\d+)\s*攻击准确率/, '+$1 to Attack Rating')
    .replace(/^\+(\d+)\s*照亮范围/, '+$1 to Light Radius')
    .replace(/^\+(\d+)\s*每次击杀获得法力/, '+$1 to Mana After Each Kill')
    .replace(/^\+(\d+)\s*魔法吸收/, '+$1 Magic Absorb')
    .replace(/^攻击者受到伤害\s*(\d+)/, 'Attacker Takes Damage of $1')

  return s
}
/**
 * Draw Top-Center Monster Target Health Bar & 2-Line Subtext Plaque
 * (`D2Client.dll` `0x6FB70850`, `0x6FACFDD0`, `0x6FB6FCA0`, `0x6FB719B0`, `0x6FB71A20`, `D2Win.dll` `Ordinal_10070`).
 */
export function drawMonsterTargetBarImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  monster: MonsterTargetHudInfo | null,
  font: D2FontRenderer,
  options?: {
    readonly leftPanelOpen?: boolean
    readonly rightPanelOpen?: boolean
    readonly canvasWidth?: number
    readonly locale?: 'en' | 'zh'
  },
): void {
  if (!monster || monster.hp <= 0) return
  const leftPanelOpen = options?.leftPanelOpen ?? false
  const rightPanelOpen = options?.rightPanelOpen ?? false
  const canvasWidth = options?.canvasWidth ?? 800
  const locale = options?.locale ?? (this.lang === 'ENG' ? 'en' : 'zh')

  const { paddedTitle, titleColor } = resolveMonsterTitleAndColor(monster, locale)
  const textWidth = font.measureText(paddedTitle, 'font16')
  const layout = computeMonsterLifebarLayout(
    canvasWidth,
    leftPanelOpen,
    rightPanelOpen,
    textWidth,
    monster.hp,
    monster.maxHp,
  )
  if (!layout.visible) return

  // 1. Lifebar Plaque Background (`D2Win.dll` `Ordinal_10070` dark semi-transparent box)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
  ctx.fillRect(layout.left, layout.top, layout.barWidth, layout.barHeight)

  // 2. Red Health Fill (`paletteIdx = 132` crimson fill, `(barWidth * fillRatio128) >> 7`)
  if (layout.fillWidth > 0) {
    ctx.fillStyle = 'rgba(156, 20, 20, 0.88)'
    ctx.fillRect(layout.left, layout.top, layout.fillWidth, layout.barHeight)
  }

  // 3. Centered `font16` Title (`"  " + Name + "  "` at `y = 32`)
  font.drawText(ctx, paddedTitle, layout.centerX, layout.y, {
    font: 'font16',
    color: titleColor,
    align: 'center',
  })

  // 4. 2-Line Subtext (`font6` at `y = 55` and `y = 69` / `55`)
  const subtext = buildMonsterHoverSubtext(monster, locale, this.showMonsterResists)
  const singleSidePanelOpen = (leftPanelOpen && !rightPanelOpen) || (rightPanelOpen && !leftPanelOpen)
  const activeViewportWidth = singleSidePanelOpen ? Math.max(200, canvasWidth - 400) : canvasWidth
  // D2Client.dll 0x6facff8d caps modifier accumulation at 0x1e0 (480px), further bounded by open viewport width
  const maxLine1Width = Math.min(480, Math.max(120, activeViewportWidth - 8))
  const maxLine2Width = Math.max(120, activeViewportWidth - 8)

  if (subtext.line1 !== '') {
    let line1ToDraw = subtext.line1Colored
    if (font.measureText(subtext.line1, 'font6') > maxLine1Width && line1ToDraw.includes('  ')) {
      const plainTokens = subtext.line1.split('  ')
      const coloredTokens = subtext.line1Colored.split('  ')
      let count = plainTokens.length
      while (count > 1 && font.measureText(plainTokens.slice(0, count).join('  '), 'font6') > maxLine1Width) {
        count -= 1
      }
      line1ToDraw = coloredTokens.slice(0, count).join('  ')
    }
    font.drawText(ctx, line1ToDraw, layout.centerX, subtext.line1Y, {
      font: 'font6',
      color: 'white',
      align: 'center',
    })
  }
  if (subtext.line2 !== '') {
    if (font.measureText(subtext.line2, 'font6') > maxLine2Width && subtext.line2Colored.includes('ÿc0, ')) {
      const plainParts = subtext.line2.split(', ')
      const coloredParts = subtext.line2Colored.split('ÿc0, ')
      const wrappedColoredLines: string[] = []
      let curPlain = ''
      let curColored = ''
      for (let i = 0; i < coloredParts.length; i += 1) {
        const pPart = plainParts[i] ?? ''
        const cPart = coloredParts[i] ?? ''
        const nextPlain = curPlain ? `${curPlain}, ${pPart}` : pPart
        if (curPlain && font.measureText(nextPlain, 'font6') > maxLine2Width) {
          wrappedColoredLines.push(curColored)
          curPlain = pPart
          curColored = cPart
        } else {
          curPlain = nextPlain
          curColored = curColored ? `${curColored}ÿc0, ${cPart}` : cPart
        }
      }
      if (curColored) wrappedColoredLines.push(curColored)
      for (let i = 0; i < wrappedColoredLines.length; i += 1) {
        font.drawText(ctx, wrappedColoredLines[i]!, layout.centerX, subtext.line2Y + i * 14, {
          font: 'font6',
          color: 'white',
          align: 'center',
        })
      }
    } else {
      font.drawText(ctx, subtext.line2Colored, layout.centerX, subtext.line2Y, {
        font: 'font6',
        color: 'white',
        align: 'center',
      })
    }
  }
}
function formatSingleWeaponDamageFormula(
  dmg: WeaponDamageInfo,
  prefixZh: string,
  prefixEn: string,
  isEn: boolean,
  fallbackEthereal?: boolean,
): string | null {
  const baseMin = dmg.baseMin ?? dmg.min
  const baseMax = dmg.baseMax ?? dmg.max
  if (!(baseMin > 0 && baseMax > 0)) return null

  const baseRangeStr = `${baseMin}~${baseMax}`
  const finalRangeStr = `${dmg.min}~${dmg.max}`
  const basePart = isEn ? `${prefixEn}: ${baseRangeStr}` : `${prefixZh}: ${baseRangeStr}`

  const isLowQuality = Boolean(dmg.isLowQuality)
  const isEthereal = Boolean(dmg.isEthereal ?? fallbackEthereal)
  const edPct = dmg.edPct ?? 0
  const extraMaxEdPct = dmg.extraMaxEdPct ?? 0
  const flatMin = dmg.flatMin ?? 0
  const flatMax = dmg.flatMax ?? 0

  const hasScaling =
    isLowQuality ||
    isEthereal ||
    edPct !== 0 ||
    extraMaxEdPct !== 0 ||
    flatMin !== 0 ||
    flatMax !== 0 ||
    dmg.min !== baseMin ||
    dmg.max !== baseMax

  if (!hasScaling) {
    return basePart
  }

  let expr = baseRangeStr
  if (isLowQuality) {
    expr = `⌊${expr}⌋×0.75`
  }
  if (isEthereal) {
    expr = `⌊${expr}⌋×1.5`
  }
  if (extraMaxEdPct !== 0) {
    const minSign = edPct >= 0 ? '+' : ''
    expr = `${expr} × (1${minSign}${edPct}%~${edPct + extraMaxEdPct}%)`
  } else if (edPct !== 0) {
    const sign = edPct >= 0 ? '+' : ''
    expr = `${expr} × (1${sign}${edPct}%)`
  }
  if (flatMin !== 0 || flatMax !== 0) {
    expr = `${expr} + (${flatMin}~${flatMax})`
  }

  const formulaLabel = isEn ? 'Formula' : '公式'
  return `${basePart} | ${formulaLabel}: ${expr} = ${finalRangeStr}`
}

/**
 * Formats non-1.13c HUD enhancement lines showing a weapon's raw `Weapons.txt` white damage
 * (excluding ethereal and low-quality scaling) and the 1.13c formula to final displayed damage.
 */
export function formatWeaponDamageFormulaLines(item: UiInventoryItem, isEn: boolean): string[] {
  if (isUiItemUnidentified(item)) return []
  const hasThrow = Boolean(item.throwDamage && (item.throwDamage.baseMax ?? item.throwDamage.max) > 0)
  const has1H = Boolean(item.oneHandDamage && (item.oneHandDamage.baseMax ?? item.oneHandDamage.max) > 0)
  const has2H = Boolean(item.twoHandDamage && (item.twoHandDamage.baseMax ?? item.twoHandDamage.max) > 0)
  const modeCount = (hasThrow ? 1 : 0) + (has1H ? 1 : 0) + (has2H ? 1 : 0)
  if (modeCount === 0) return []

  const singleMode = modeCount === 1
  const out: string[] = []
  if (hasThrow && item.throwDamage) {
    const line = formatSingleWeaponDamageFormula(
      item.throwDamage,
      singleMode ? '基础白字' : '投掷白字',
      singleMode ? 'Base White' : 'Throw Base',
      isEn,
      item.ethereal,
    )
    if (line) out.push(line)
  }
  if (has1H && item.oneHandDamage) {
    const line = formatSingleWeaponDamageFormula(
      item.oneHandDamage,
      singleMode ? '基础白字' : '单手白字',
      singleMode ? 'Base White' : '1H Base',
      isEn,
      item.ethereal,
    )
    if (line) out.push(line)
  }
  if (has2H && item.twoHandDamage) {
    const line = formatSingleWeaponDamageFormula(
      item.twoHandDamage,
      singleMode ? '基础白字' : '双手白字',
      singleMode ? 'Base White' : '2H Base',
      isEn,
      item.ethereal,
    )
    if (line) out.push(line)
  }
  return out
}

/**
 * Draw Canonical Diablo II Item Hover Tooltip (`showitems.cpp` `0x6fb47fd8` & `0x6fb49fe0`).
 * - All lines use uniform `font16`.
 * - Weapon speed line appears AFTER `Required Dexterity`, `Required Strength`, and `Required Level`.
 * - Tight box sizing (`maxW + 16`, `lines.length * 16 + 16`) with `STONE_BOX_BG_FILL` (`rgba(0, 0, 0, 0.85)`) and NO border stroke.
 */
export function drawItemTooltipImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  hover: { item: UiInventoryItem; x: number; y: number } | null,
  font: D2FontRenderer,
  vendorOpen = false,
  viewportWidth = 800,
  viewportHeight = 600,
): void {
  if (!hover) return
  const { item } = hover
  const isEn = this.lang === 'ENG'
  const lines: { text: string; color: D2ColorCode; font: 'font16' }[] = []
  const upgrade = this.upgradeVerdictFor(item)

  const rawItemCode = (item.code ?? '').trim().toLowerCase()
  const isQuestCode =
    rawItemCode === 'bks' ||
    rawItemCode === 'bkd' ||
    rawItemCode === 'leg' ||
    rawItemCode === 'hdm' ||
    rawItemCode === 'ass' ||
    rawItemCode === 'tr1' ||
    rawItemCode === 'box' ||
    rawItemCode === 'hst' ||
    rawItemCode === 'msf' ||
    rawItemCode === 'vip' ||
    rawItemCode === 'j34' ||
    rawItemCode === 'g34' ||
    rawItemCode === 'xyz' ||
    rawItemCode === 'g33' ||
    rawItemCode === 'd33' ||
    rawItemCode === 'bbb' ||
    rawItemCode === 'qey' ||
    rawItemCode === 'qhr' ||
    rawItemCode === 'qbr' ||
    rawItemCode === 'qf1' ||
    rawItemCode === 'qf2' ||
    rawItemCode === 'mss' ||
    rawItemCode === 'hfh' ||
    rawItemCode === 'ice' ||
    rawItemCode === 'tr2'
  const titleColor: D2ColorCode =
    item.quality === 'unique' || item.quality === 'rune' || isQuestCode
      ? 'gold'
      : item.quality === 'set'
        ? 'green'
        : item.quality === 'rare'
          ? 'yellow'
          : item.quality === 'magic'
            ? 'blue'
            : item.quality === 'craft'
              ? 'orange'
              : 'white'

  const resolveHeaderZh = (raw: string): string => localizeStarterTooltipLine(raw, false)
  const resolveBaseName = (): string | undefined => {
    if (isEn) {
      if (item.baseNameEn) return item.baseNameEn
      if (!item.baseNameZh) return undefined
      return localizeStarterTooltipLine(item.baseNameZh, true)
    }
    if (!item.baseNameZh) return undefined
    return localizeStarterTooltipLine(item.baseNameZh, false)
  }

  // Header: Title, Runeword Runes line, Base item name
  const socketableInfo = item.code ? getSocketableInfo(item.code) : undefined
  const unid = isUiItemUnidentified(item)
  if (unid) {
    const maskedBaseHeader = isEn
      ? item.baseNameEn ||
        (item.baseNameZh ? localizeStarterTooltipLine(item.baseNameZh.split(' · ')[0]!, true) : undefined) ||
        item.name ||
        localizeStarterTooltipLine(item.nameZh, true)
      : (item.baseNameZh ? resolveHeaderZh(item.baseNameZh.split(' · ')[0]!) : undefined) ||
        resolveHeaderZh(item.nameZh)
    lines.push({ text: maskedBaseHeader + upgradeSuffix(upgrade), color: titleColor, font: 'font16' })
  } else {
    const headerText = isEn
      ? (item.name && !/[\u4e00-\u9fff]/.test(item.name) ? item.name : localizeStarterTooltipLine(item.nameZh, true))
      : resolveHeaderZh(item.nameZh)
    lines.push({ text: headerText + upgradeSuffix(upgrade), color: titleColor, font: 'font16' })
    if (item.runewordRunes) {
      lines.push({ text: item.runewordRunes, color: 'gold', font: 'font16' })
    }
    // 1.13c parity (Issue #723): Only Rare, Unique, Set, Crafted, and Runeword items display
    // a second base-type line below their appellation; Normal/Low/Superior/Magic/Socketable items
    // only display a single title line.
    const isAppellationQuality =
      !socketableInfo &&
      (item.quality === 'unique' ||
        item.quality === 'set' ||
        item.quality === 'rare' ||
        item.quality === 'craft' ||
        item.quality === 'rune' ||
        Boolean(item.runewordRunes))
    const baseLine = isAppellationQuality ? resolveBaseName() : undefined
    if (baseLine && baseLine !== headerText) {
      lines.push({ text: baseLine, color: item.quality === 'set' ? 'green' : 'white', font: 'font16' })
    }
  }

  // Vendor Transaction Cost Line (`ITEMS_CalculateTransactionCost` at 0x6FD9B1C0)
  // Prices come from HudModel's injected VendorPriceFn (buyCost / sellCost / repairCost on the UI item).
  if (item.buyCost !== undefined) {
    lines.push({ text: `${requireTbl('cost', this.lang)}${item.buyCost}`, color: 'white', font: 'font16' })
  } else if (vendorOpen && this.activeVendorDescriptor) {
    if (this.repairCursorMode && this.activeVendorDescriptor.canRepair) {
      if (item.repairCost !== undefined && item.repairCost > 0) {
        lines.push({ text: `${requireTbl('Repair', this.lang)}${item.repairCost}`, color: 'white', font: 'font16' })
      }
    } else if (item.sellCost !== undefined) {
      lines.push({ text: `${requireTbl('Sell', this.lang)}${item.sellCost}`, color: 'white', font: 'font16' })
    }
  }

  const playerCtx = this.getEffectivePlayerContext()
  const rawItemForLive = item.rawItem as
    | (Item & { charLevel?: number; playerLevel?: number })
    | undefined
  const hasPerLevelProps =
    !unid &&
    Boolean(
      rawItemForLive &&
        ((Array.isArray(rawItemForLive.rolledProps) &&
          rawItemForLive.rolledProps.some(p => {
            const c = (p?.code ?? '').trim().toLowerCase()
            return c.endsWith('/lvl') || c.endsWith('_perlevel')
          })) ||
          (Array.isArray((rawItemForLive as any).activeItemSetProps) &&
            (rawItemForLive as any).activeItemSetProps.some((p: any) => {
              const c = String(p?.code ?? '').trim().toLowerCase()
              return c.endsWith('/lvl') || c.endsWith('_perlevel')
            })) ||
          (rawItemForLive.setItemDef &&
            Array.isArray(rawItemForLive.setItemDef.aprops) &&
            rawItemForLive.setItemDef.aprops.some((p: { code?: string } | undefined) => {
              const c = (p?.code ?? '').trim().toLowerCase()
              return c.endsWith('/lvl') || c.endsWith('_perlevel')
            }))),
    )
  const itemCharLevel = rawItemForLive
    ? Math.max(1, Math.trunc(Number(rawItemForLive.charLevel ?? rawItemForLive.playerLevel ?? 1) || 1))
    : 1
  const livePerLevelTooltip =
    hasPerLevelProps && rawItemForLive && playerCtx.level > 0 && itemCharLevel !== playerCtx.level
      ? formatItemTooltip(
          { ...rawItemForLive, charLevel: playerCtx.level } as Item,
          isEn ? 'en' : 'zh',
        )
      : undefined

  // Base Stats Block
  const effectiveDefense = livePerLevelTooltip?.defense ?? item.defense
  if (effectiveDefense !== undefined) {
    lines.push({
      text: (isEn ? 'Defense: ' : '防御: ') + effectiveDefense,
      color: 'white',
      font: 'font16',
    })
  }
  if (item.damage !== undefined || item.damageEn !== undefined) {
    if (isEn) {
      const rawDmg = item.damageEn ?? item.damage ?? ''
      const cleanDmg = localizeStarterTooltipLine(rawDmg, true)
      const dmgText = /Damage/i.test(cleanDmg) ? cleanDmg : `One-Hand Damage: ${cleanDmg}`
      lines.push({ text: dmgText, color: 'white', font: 'font16' })
    } else {
      const rawDmg = item.damage ?? ''
      const dmgText = rawDmg.includes('伤害') ? rawDmg : ('单手伤害: ' + rawDmg)
      lines.push({ text: dmgText, color: 'white', font: 'font16' })
    }
    if (this.showWeaponDamageFormula && !unid) {
      for (const formulaLine of formatWeaponDamageFormulaLines(item, isEn)) {
        lines.push({ text: formulaLine, color: 'gray', font: 'font16' })
      }
    }
  }
  if (item.durability !== undefined) {
    lines.push({
      text: isEn
        ? `Durability: ${item.durability.current} of ${item.durability.max}`
        : '耐久度: ' + item.durability.current + ' 之 ' + item.durability.max,
      color: 'white',
      font: 'font16',
    })
  }
  const effectiveReqClass = getEffectiveItemReqClass(item)
  if (!unid && effectiveReqClass !== undefined) {
    const classLabelMapZh: Record<CharacterClassCode, string> = {
      ama: '(限亚马逊使用)',
      sor: '(限法师使用)',
      nec: '(限死灵法师使用)',
      pal: '(限圣骑士使用)',
      bar: '(限野蛮人使用)',
      dru: '(限德鲁伊使用)',
      ass: '(限刺客使用)',
    }
    const classLabelMapEn: Record<CharacterClassCode, string> = {
      ama: '(Amazon Only)',
      sor: '(Sorceress Only)',
      nec: '(Necromancer Only)',
      pal: '(Paladin Only)',
      bar: '(Barbarian Only)',
      dru: '(Druid Only)',
      ass: '(Assassin Only)',
    }
    const classText = isEn ? classLabelMapEn[effectiveReqClass] : classLabelMapZh[effectiveReqClass]
    if (classText) {
      lines.push({
        text: classText,
        color: playerCtx.classCode && playerCtx.classCode !== effectiveReqClass ? 'red' : 'white',
        font: 'font16',
      })
    }
  }
  if (item.reqDex !== undefined && item.reqDex > 0) {
    lines.push({
      text: (isEn ? 'Required Dexterity: ' : '需要敏捷: ') + item.reqDex,
      color: playerCtx.dex < item.reqDex ? 'red' : 'white',
      font: 'font16',
    })
  }
  if (item.reqStr !== undefined) {
    lines.push({
      text: (isEn ? 'Required Strength: ' : '需要力量: ') + item.reqStr,
      color: playerCtx.str < item.reqStr ? 'red' : 'white',
      font: 'font16',
    })
  }
  // Ground Truth (D2Client.dll 0x6fb43d89..0x6fb43da3):
  // ITEMS_CheckItemFlag(pItem, IFLAG_IDENTIFIED (0x10), 4054, __FILE__) gates "Required Level: %d" (0x6fb3de40);
  // when unidentified, je 0x6fb43dd4 skips required level formatting completely.
  const displayReqLevel = unid ? undefined : item.reqLevel
  // For socketables (gems/runes), Required Level is placed at the bottom after the 4 slot bonus lines per 1.13c.
  // D2Client.dll (0x6fb42c7b / 0x6fb43db2) suppresses "Required Level: %d" when nRequiredLevel <= 1.
  if (!socketableInfo && displayReqLevel !== undefined && displayReqLevel > 1) {
    lines.push({
      text: (isEn ? 'Required Level: ' : '需要等级: ') + displayReqLevel,
      color: playerCtx.level < displayReqLevel ? 'red' : 'white',
      font: 'font16',
    })
  }
  // Weapon Speed Line appears AFTER Required Dexterity / Strength / Level per `showitems.cpp` `0x6fb49fe0`
  const speedLine = isEn
    ? (item.speedTextEn ?? (item.speedText ? localizeStarterTooltipLine(item.speedText, true) : undefined))
    : (item.speedText ? localizeStarterTooltipLine(item.speedText, false) : undefined)
  if (speedLine) {
    lines.push({ text: speedLine, color: 'white', font: 'font16' })
  }
  const itemLevel = this.showItemLevel && !item.rawItem?.flags?.simple ? item.rawItem?.ilvl : undefined
  if (itemLevel !== undefined) lines.push({ text: (isEn ? 'Item Level: ' : '物品等级: ') + itemLevel, color: 'white', font: 'font16' })

  if (unid) {
    if (item.isGambleMystery) {
      lines.push({ text: isEn ? 'Unidentified' : '未辨识', color: 'red', font: 'font16' })
    } else {
      lines.push({ text: isEn ? 'Unidentified' : '未辨识', color: 'red', font: 'font16' })
      if (item.allowedSlots.length > 0) {
        lines.push({ text: isEn ? 'Cannot be Equipped' : '无法使用', color: 'red', font: 'font16' })
      }
      if (item.ethereal) {
        lines.push({
          text: isEn ? 'Ethereal (Cannot be Repaired)' : '无形的 (无法修复)',
          color: 'blue',
          font: 'font16',
        })
      }
    }
  } else {
    // Magic Affixes & Socketable Instructions
    const activeStats = livePerLevelTooltip
      ? livePerLevelTooltip.lines.map(l => ({
          text: l.text,
          color: (l.color === 'instruction' ? 'white' : l.color) as D2ColorCode,
        }))
      : isEn
        ? (item.statsEn ?? item.stats)
        : item.stats
    const hasSocketableSlotLines = activeStats.some(
      s => s.text.startsWith('Weapons:') || s.text.startsWith('武器:'),
    )
    if (socketableInfo && !hasSocketableSlotLines) {
      if (isEn) {
        lines.push({ text: 'Can be Inserted into Socketed Items', color: 'white', font: 'font16' })
        lines.push({ text: `Weapons: ${socketableInfo.weaponsEn}`, color: 'white', font: 'font16' })
        lines.push({ text: `Armor: ${socketableInfo.armorEn}`, color: 'white', font: 'font16' })
        lines.push({ text: `Helms: ${socketableInfo.helmsEn}`, color: 'white', font: 'font16' })
        lines.push({ text: `Shields: ${socketableInfo.shieldsEn}`, color: 'white', font: 'font16' })
      } else {
        lines.push({ text: '可镶嵌进有凹槽的装备', color: 'white', font: 'font16' })
        lines.push({ text: `武器: ${socketableInfo.weaponsZh}`, color: 'white', font: 'font16' })
        lines.push({ text: `防具: ${socketableInfo.armorZh}`, color: 'white', font: 'font16' })
        lines.push({ text: `头盔: ${socketableInfo.helmsZh}`, color: 'white', font: 'font16' })
        lines.push({ text: `盾牌: ${socketableInfo.shieldsZh}`, color: 'white', font: 'font16' })
      }
    } else {
      const isJewel =
        isJewelCode(item.code) ||
        Boolean(item.baseNameZh?.includes('珠宝')) ||
        item.baseNameEn?.trim().toLowerCase() === 'jewel'
      if (
        isJewel &&
        !activeStats.some(
          s =>
            s.text.includes('可镶嵌进有凹槽的装备') ||
            s.text.includes('Can be Inserted into Socketed Items'),
        )
      ) {
        lines.push({
          text: isEn ? 'Can be Inserted into Socketed Items' : '可镶嵌进有凹槽的装备',
          color: 'white',
          font: 'font16',
        })
      }
      for (const st of activeStats) {
        if (
          socketableInfo &&
          (st.text.startsWith('Required Level:') || st.text.startsWith('需要等级:'))
        ) {
          continue
        }
        lines.push({
          text: localizeStarterTooltipLine(st.text, isEn),
          color: st.color ?? 'blue',
          font: 'font16',
        })
      }
    }
    if (socketableInfo) {
      const socketableReqLevel =
        displayReqLevel !== undefined && displayReqLevel > 0
          ? displayReqLevel
          : socketableInfo.reqLevel > 0
            ? socketableInfo.reqLevel
            : undefined
      if (socketableReqLevel !== undefined) {
        lines.push({
          text: (isEn ? 'Required Level: ' : '需要等级: ') + socketableReqLevel,
          color: playerCtx.level < socketableReqLevel ? 'red' : 'white',
          font: 'font16',
        })
      }
    }

    if (
      item.ethereal &&
      !lines.some(s => s.text.includes('Ethereal') || s.text.includes('无形') || s.text.includes('無形'))
    ) {
      lines.push({
        text: isEn ? 'Ethereal (Cannot be Repaired)' : '无形的 (无法修复)',
        color: 'blue',
        font: 'font16',
      })
    }

    // Sockets Block
    if (
      item.sockets !== undefined &&
      item.sockets > 0 &&
      !lines.some(s => s.text.includes('凹槽') || s.text.includes('插槽') || s.text.includes('Socketed'))
    ) {
      lines.push({
        text: isEn ? `Socketed (${item.sockets})` : '凹槽 (' + item.sockets + ')',
        color: 'blue',
        font: 'font16',
      })
    }

    // Set Bonuses & Set Roster Block (`showitems.cpp` 1.13c order:
    // 1. Unlocked item-specific green bonuses + unlocked partial/full gold set bonuses
    // 2. Set Name header in gold
    // 3. All set pieces in green (equipped) or red (unequipped))
    const activeSetBonuses =
      livePerLevelTooltip?.setBonuses
        ? livePerLevelTooltip.setBonuses.map(b => ({
            text: b.text,
            color: (b.color ?? 'green') as D2ColorCode,
          }))
        : isEn
          ? (item.setBonusesEn ?? item.setBonuses)
          : item.setBonuses
    if (activeSetBonuses) {
      for (const bonus of activeSetBonuses) {
        lines.push({
          text: localizeStarterTooltipLine(bonus.text, isEn),
          color: bonus.color ?? 'green',
          font: 'font16',
        })
      }
    }
    const activeSetName = isEn ? (item.setNameEn ?? item.setName) : item.setName
    const activeSetPieces = isEn ? (item.setPiecesEn ?? item.setPieces) : item.setPieces
    if (activeSetName) {
      lines.push({
        text: localizeStarterTooltipLine(activeSetName, isEn),
        color: 'gold',
        font: 'font16',
      })
    }
    if (activeSetPieces) {
      activeSetPieces.forEach((piece, pieceIdx) => {
        const pieceColor: D2ColorCode = item.setPieceColors?.[pieceIdx] ?? 'red'
        lines.push({
          text: localizeStarterTooltipLine(piece, isEn),
          color: pieceColor,
          font: 'font16',
        })
      })
    }
  }

  // Viewport Dimensions & Dynamic Vertical Flip / Clamping (`showitems.cpp` `0x6fb47fd8`)
  const lineH = 16, padX = 8, padY = 8
  const maxW = Math.max(...lines.map(l => font.measureText(l.text, l.font)))
  const boxW = maxW + padX * 2
  const boxH = lines.length * lineH + padY * 2

  const rawBy = hover.y < 280 ? hover.y + 24 : hover.y - boxH - 8
  const bx = Math.max(8, Math.min(viewportWidth - boxW - 8, Math.round(hover.x - boxW / 2)))
  const maxTop = Math.max(8, viewportHeight - boxH - 8)
  const topMargin = (hover.y < 280 || maxTop < 44) ? 8 : 44
  const by = Math.max(topMargin, Math.min(viewportHeight - boxH - 8, rawBy))
  this.lastTooltipRect = { bx, by, boxW, boxH }

  // Rendering: Translucent black background (`STONE_BOX_BG_FILL`) with NO border stroke
  ctx.fillStyle = STONE_BOX_BG_FILL
  ctx.fillRect(bx, by, boxW, boxH)

  lines.forEach((l, idx) => {
    font.drawText(ctx, l.text, bx + Math.round(boxW / 2), by + padY + 12 + idx * lineH, {
      font: l.font,
      color: l.color,
      align: 'center',
    })
  })
  drawUpgradeCrosses(ctx, font, lines[0]!.text, upgrade, bx + Math.round(boxW / 2), by + padY + 12)
}
/**
 * Draw the authentic Diablo II v1.13c In-Game Escape Menu (`D2Client.dll` `gmenu.cpp` `0x6fb15230..0x6fb15555`
 * & `D2Win.dll` `#10138` `0x6f8f17a0`):
 * - No background box or screen dimming: draws the 3 stitched DC6 banners (`Options.dc6`, `Exit.dc6`,
 *   `ReturnToGame.dc6`) directly over the game viewport.
 * - Draws counter-rotating 8-frame 3D pentagrams (`CURSOR\Pentspin.dc6`, 50ms/frame) flanking the selected row.
 */
export function drawEscapeMenuImpl(
  this: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  hudWidth: number,
  hudHeight: number,
  nowMs: number,
  assets: {
    escOptionsImg: HTMLImageElement | null
    escExitImg: HTMLImageElement | null
    escReturnImg: HTMLImageElement | null
    pentSpinImg: HTMLImageElement | null
    boxPiecesImg?: HTMLImageElement | null | undefined
    textSlidImg?: HTMLImageElement | null | undefined
    focus16Img?: HTMLImageElement | null | undefined
    btnMediumImg?: HTMLImageElement | null | undefined
    font?: D2FontRenderer | undefined
  },
): void {
  if (!this.escapeMenuOpen) return
  if (
    this.escapeMenuScreen === 'options' ||
    this.escapeMenuScreen === 'sound' ||
    this.escapeMenuScreen === 'video'
  ) {
    drawOptionsSubmenu(this, ctx, hudWidth, hudHeight, nowMs, {
      pentSpinImg: assets.pentSpinImg,
      font: assets.font ?? this.font ?? this.defaultFont,
    })
    return
  }
  if (this.escapeMenuScreen === 'controls') {
    drawControlsMenu(this, ctx, hudWidth, hudHeight, nowMs, {
      boxPiecesImg: assets.boxPiecesImg,
      textSlidImg: assets.textSlidImg,
      focus16Img: assets.focus16Img,
      btnMediumImg: assets.btnMediumImg,
      font: assets.font ?? this.font ?? this.defaultFont,
    })
    return
  }
  const layout = computeEscapeMenuLayout(hudWidth, hudHeight, this.escapeMenuSelectedIndex, nowMs)
  const bannerImgs: readonly (HTMLImageElement | null)[] = [
    assets.escOptionsImg,
    assets.escExitImg,
    assets.escReturnImg,
  ]
  for (const row of layout.rows) {
    const img = bannerImgs[row.index]
    if (img) {
      ctx.drawImage(img, row.bannerX, row.bannerY, row.bannerWidth, row.bannerHeight)
    }
  }
  if (assets.pentSpinImg) {
    const lp = layout.leftPent
    ctx.drawImage(
      assets.pentSpinImg,
      lp.frame.x,
      lp.frame.y,
      lp.frame.w,
      lp.frame.h,
      lp.x,
      lp.y,
      lp.frame.w,
      lp.frame.h,
    )
    const rp = layout.rightPent
    ctx.drawImage(
      assets.pentSpinImg,
      rp.frame.x,
      rp.frame.y,
      rp.frame.w,
      rp.frame.h,
      rp.x,
      rp.y,
      rp.frame.w,
      rp.frame.h,
    )
  }
}
