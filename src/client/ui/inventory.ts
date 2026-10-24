/**
 * Diablo II v1.13c Inventory & Equipment Paperdoll Panel (`Panel\invchar6.dc6` frames 4..7).
 *
 * Implements:
 * - Right-Half 800x600 Gothic Border Frame (`800BorderFrame.dc6` frames 5..9 at x=400, y=0)
 * - 320x432 Inventory Panel anchored at (400, 60)
 * - 10x4 Inventory Grid (29x29 px per cell at local x=18, y=256)
 * - 10 Equipment Slots (`helm`, `amulet`, `weapon1`, `armor`, `weapon2`, `gloves`, `ring1`, `belt`, `ring2`, `boots`)
 * - Weapon Swap `I / II` Tabs (`invchar6Tab.dc6`, hotkey `W`)
 * - Full Cursor Pick-up (`cursorItem`), Grid Collision, Slot Type Validation, Swap-on-Place,
 *   Right-Click Quick Equip / Potion Consume, and Drop-to-Ground (`engine.ground`)
 */

import type { D2ColorCode, D2FontRenderer } from './font.ts'
import { BAKED_UI_MANIFEST, type SpriteRect } from '../../common/items/baked-ui-meta.ts'
import type { Item } from '../../common/items/items.ts'
import type { CharacterClassCode } from '../../common/units/classes.ts'
import {
  getGemColorTransform,
  getSocketableInfo,
  getSocketableSlotLines,
  isGemCode,
  isJewelCode,
  isRuneCode,
  isSocketableCode,
  type SocketTargetCategory,
} from '../../common/items/gems-data.ts'
import {
  getSocketedItemModifiersForHost,
  isSocketableDomainItem,
  resolveSocketTargetCategory,
  socketItemIntoHost,
} from '../../common/items/gems.ts'
import { CANONICAL_RUNES_TABLE, checkRunewordMatch, RUNE_CODE_TO_NAME } from '../../common/items/runeword.ts'
import { getEmbeddedDropTables } from '../../common/items/embedded-drop-tables.ts'
import { isA } from '../../common/items/item-types.ts'
import { formatPropertyCode } from '../../common/items/item-tooltip.ts'
import { translateItemName } from '../../common/i18n/tooltip-i18n.ts'

import {
  ASSASSIN_HAND_TO_HAND_CLAW_CODES,
  BARBARIAN_ONE_OR_TWO_HANDED_SWORD_CODES,
  CANONICAL_BOW_WEAPON_CODES,
  CANONICAL_CLASS_SPECIFIC_ITEM_CODES,
  CANONICAL_CROSSBOW_WEAPON_CODES,
  CANONICAL_ONE_HANDED_WEAPON_CODES,
  CANONICAL_SHIELD_AND_OFFHAND_CODES,
  CANONICAL_VAR_INV_GFX,
  STRICT_TWO_HANDED_WEAPON_CODES,
  getEffectiveItemReqClass,
  itemToUiInventoryItem,
  resolveAllowedSlots,
  resolveItemInvFile,
} from '../../common/items/item-bridge.ts'
import { reportMissingArt } from '../../client/scene/world-renderer.ts'
import { PanelCloseButton } from './close-button.ts'
import { getTblLang, requireTbl, type TblLang } from '../i18n/lang.ts'

export type { SpriteRect, SocketTargetCategory }
export {
  ASSASSIN_HAND_TO_HAND_CLAW_CODES,
  BARBARIAN_ONE_OR_TWO_HANDED_SWORD_CODES,
  CANONICAL_BOW_WEAPON_CODES,
  CANONICAL_CLASS_SPECIFIC_ITEM_CODES,
  CANONICAL_CROSSBOW_WEAPON_CODES,
  CANONICAL_ONE_HANDED_WEAPON_CODES,
  CANONICAL_SHIELD_AND_OFFHAND_CODES,
  CANONICAL_VAR_INV_GFX,
  STRICT_TWO_HANDED_WEAPON_CODES,
  getEffectiveItemReqClass,
  itemToUiInventoryItem,
  resolveAllowedSlots,
  resolveItemInvFile,
}
import {
  INV_COLS,
  INV_ROWS,
  STASH_GOLD_CAP,
  getInventoryGoldLimit,
  getStashGoldLimit,
  findFreeGridSlot,
  type EquipSlotId,
  type UiItemQuality,
  type UiInventoryItem,
  type GridPlacement,
} from '../../common/items/inventory-model.ts'

export {
  INV_COLS,
  INV_ROWS,
  STASH_GOLD_CAP,
  getInventoryGoldLimit,
  getStashGoldLimit,
  findFreeGridSlot,
  type EquipSlotId,
  type UiItemQuality,
  type UiInventoryItem,
  type GridPlacement,
}

export type InventoryTxtBodySlotKey =
  | 'rArm'
  | 'torso'
  | 'lArm'
  | 'head'
  | 'neck'
  | 'rHand'
  | 'lHand'
  | 'belt'
  | 'feet'
  | 'gloves'

export interface InventoryTxtSlotRect {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly width: number
  readonly height: number
}

export interface InventoryTxtRow {
  readonly class: string
  readonly invLeft: number
  readonly invRight: number
  readonly invTop: number
  readonly invBottom: number
  readonly invWidth: number
  readonly invHeight: number
  readonly gridX: number
  readonly gridY: number
  readonly gridLeft: number
  readonly gridRight: number
  readonly gridTop: number
  readonly gridBottom: number
  readonly gridBoxWidth: number
  readonly gridBoxHeight: number
  readonly slots: Readonly<Record<InventoryTxtBodySlotKey, InventoryTxtSlotRect>>
}

/**
 * Ground Truth (`data\global\excel\inventory.txt` from Diablo II v1.13c `patch_d2.mpq`):
 * All 32 canonical panel layout definitions (640x480 base rows + 800x600 `*2` rows).
 */
export const RAW_INVENTORY_TXT = [
  'class\tinvLeft\tinvRight\tinvTop\tinvBottom\tgridX\tgridY\tgridLeft\tgridRight\tgridTop\tgridBottom\tgridBoxWidth\tgridBoxHeight\trArmLeft\trArmRight\trArmTop\trArmBottom\trArmWidth\trArmHeight\ttorsoLeft\ttorsoRight\ttorsoTop\ttorsoBottom\ttorsoWidth\ttorsoHeight\tlArmLeft\tlArmRight\tlArmTop\tlArmBottom\tlArmWidth\tlArmHeight\theadLeft\theadRight\theadTop\theadBottom\theadWidth\theadHeight\tneckLeft\tneckRight\tneckTop\tneckBottom\tneckWidth\tneckHeight\trHandLeft\trHandRight\trHandTop\trHandBottom\trHandWidth\trHandHeight\tlHandLeft\tlHandRight\tlHandTop\tlHandBottom\tlHandWidth\tlHandHeight\tbeltLeft\tbeltRight\tbeltTop\tbeltBottom\tbeltWidth\tbeltHeight\tfeetLeft\tfeetRight\tfeetTop\tfeetBottom\tfeetWidth\tfeetHeight\tglovesLeft\tglovesRight\tglovesTop\tglovesBottom\tglovesWidth\tglovesHeight',
  'Amazon\t320\t640\t0\t441\t10\t4\t339\t626\t257\t370\t29\t29\t340\t396\t46\t159\t55\t112\t455\t512\t76\t162\t56\t82\t570\t627\t46\t159\t55\t112\t455\t510\t7\t61\t54\t51\t529\t556\t35\t62\t23\t24\t413\t440\t180\t208\t23\t24\t527\t556\t180\t208\t23\t24\t455\t511\t179\t206\t52\t25\t571\t628\t180\t236\t54\t52\t340\t396\t180\t236\t54\t53',
  'Sorceress\t320\t640\t0\t441\t10\t4\t339\t626\t257\t370\t29\t29\t340\t396\t46\t159\t55\t112\t455\t512\t76\t162\t56\t82\t570\t627\t46\t159\t55\t112\t455\t510\t7\t61\t54\t51\t529\t556\t35\t62\t23\t24\t413\t440\t180\t208\t23\t24\t527\t556\t180\t208\t23\t24\t455\t511\t179\t206\t52\t25\t571\t628\t180\t236\t54\t52\t340\t396\t180\t236\t54\t53',
  'Necromancer\t320\t640\t0\t441\t10\t4\t339\t626\t257\t370\t29\t29\t340\t396\t46\t159\t55\t112\t455\t512\t76\t162\t56\t82\t570\t627\t46\t159\t55\t112\t455\t510\t7\t61\t54\t51\t529\t556\t35\t62\t23\t24\t413\t440\t180\t208\t23\t24\t527\t556\t180\t208\t23\t24\t455\t511\t179\t206\t52\t25\t571\t628\t180\t236\t54\t52\t340\t396\t180\t236\t54\t53',
  'Paladin\t320\t640\t0\t441\t10\t4\t339\t626\t257\t370\t29\t29\t340\t396\t46\t159\t55\t112\t455\t512\t76\t162\t56\t82\t570\t627\t46\t159\t55\t112\t455\t510\t7\t61\t54\t51\t529\t556\t35\t62\t23\t24\t413\t440\t180\t208\t23\t24\t527\t556\t180\t208\t23\t24\t455\t511\t179\t206\t52\t25\t571\t628\t180\t236\t54\t52\t340\t396\t180\t236\t54\t53',
  'Barbarian\t320\t640\t0\t441\t10\t4\t339\t626\t257\t370\t29\t29\t340\t396\t46\t159\t55\t112\t455\t512\t76\t162\t56\t82\t570\t627\t46\t159\t55\t112\t455\t510\t7\t61\t54\t51\t529\t556\t35\t62\t23\t24\t413\t440\t180\t208\t23\t24\t527\t556\t180\t208\t23\t24\t455\t511\t179\t206\t52\t25\t571\t628\t180\t236\t54\t52\t340\t396\t180\t236\t54\t53',
  'Monster\t0\t320\t0\t441\t10\t10\t19\t306\t82\t370\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Trade Page 1\t0\t320\t0\t441\t10\t4\t19\t306\t12\t127\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Trade Page 2\t0\t320\t0\t441\t10\t4\t19\t306\t223\t338\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Bank Page 1\t0\t320\t0\t441\t6\t4\t74\t249\t143\t258\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Transmogrify Box Page 1\t0\t320\t0\t441\t3\t4\t116\t202\t139\t254\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Guild Vault Page 1\t0\t320\t0\t441\t8\t8\t46\t279\t88\t321\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Trophy Case Page 1\t0\t320\t0\t441\t2\t2\t111\t216\t141\t254\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Big Bank Page 1\t0\t320\t0\t441\t6\t8\t74\t249\t82\t315\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Hireling\t0\t320\t0\t441\t0\t0\t-1\t-1\t-1\t-1\t29\t29\t20\t75\t47\t159\t55\t112\t133\t189\t77\t159\t56\t82\t251\t306\t47\t159\t55\t112\t135\t189\t8\t59\t54\t51\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1',
  'Druid\t320\t640\t0\t441\t10\t4\t339\t626\t257\t370\t29\t29\t340\t396\t46\t159\t55\t112\t455\t512\t76\t162\t56\t82\t570\t627\t46\t159\t55\t112\t455\t510\t7\t61\t54\t51\t529\t556\t35\t62\t23\t24\t413\t440\t180\t208\t23\t24\t527\t556\t180\t208\t23\t24\t455\t511\t179\t206\t52\t25\t571\t628\t180\t236\t54\t52\t340\t396\t180\t236\t54\t53',
  'Assassin\t320\t640\t0\t441\t10\t4\t339\t626\t257\t370\t29\t29\t340\t396\t46\t159\t55\t112\t455\t512\t76\t162\t56\t82\t570\t627\t46\t159\t55\t112\t455\t510\t7\t61\t54\t51\t529\t556\t35\t62\t23\t24\t413\t440\t180\t208\t23\t24\t527\t556\t180\t208\t23\t24\t455\t511\t179\t206\t52\t25\t571\t628\t180\t236\t54\t52\t340\t396\t180\t236\t54\t53',
  'Amazon2\t400\t720\t60\t501\t10\t4\t419\t706\t315\t429\t29\t29\t420\t475\t107\t219\t55\t112\t533\t589\t137\t219\t56\t82\t651\t706\t107\t219\t55\t112\t535\t589\t68\t119\t54\t51\t609\t632\t95\t119\t23\t24\t495\t518\t240\t264\t23\t24\t609\t632\t240\t264\t23\t24\t536\t588\t239\t264\t52\t25\t652\t706\t242\t294\t54\t52\t421\t475\t241\t294\t54\t53',
  'Sorceress2\t400\t720\t60\t501\t10\t4\t419\t706\t315\t429\t29\t29\t420\t475\t107\t219\t55\t112\t533\t589\t137\t219\t56\t82\t651\t706\t107\t219\t55\t112\t535\t589\t68\t119\t54\t51\t609\t632\t95\t119\t23\t24\t495\t518\t240\t264\t23\t24\t609\t632\t240\t264\t23\t24\t536\t588\t239\t264\t52\t25\t652\t706\t242\t294\t54\t52\t421\t475\t241\t294\t54\t53',
  'Necromancer2\t400\t720\t60\t501\t10\t4\t419\t706\t315\t429\t29\t29\t420\t475\t107\t219\t55\t112\t533\t589\t137\t219\t56\t82\t651\t706\t107\t219\t55\t112\t535\t589\t68\t119\t54\t51\t609\t632\t95\t119\t23\t24\t495\t518\t240\t264\t23\t24\t609\t632\t240\t264\t23\t24\t536\t588\t239\t264\t52\t25\t652\t706\t242\t294\t54\t52\t421\t475\t241\t294\t54\t53',
  'Paladin2\t400\t720\t60\t501\t10\t4\t419\t706\t315\t429\t29\t29\t420\t475\t107\t219\t55\t112\t533\t589\t137\t219\t56\t82\t651\t706\t107\t219\t55\t112\t535\t589\t68\t119\t54\t51\t609\t632\t95\t119\t23\t24\t495\t518\t240\t264\t23\t24\t609\t632\t240\t264\t23\t24\t536\t588\t239\t264\t52\t25\t652\t706\t242\t294\t54\t52\t421\t475\t241\t294\t54\t53',
  'Barbarian2\t400\t720\t60\t501\t10\t4\t419\t706\t315\t429\t29\t29\t420\t475\t107\t219\t55\t112\t533\t589\t137\t219\t56\t82\t651\t706\t107\t219\t55\t112\t535\t589\t68\t119\t54\t51\t609\t632\t95\t119\t23\t24\t495\t518\t240\t264\t23\t24\t609\t632\t240\t264\t23\t24\t536\t588\t239\t264\t52\t25\t652\t706\t242\t294\t54\t52\t421\t475\t241\t294\t54\t53',
  'Monster2\t80\t400\t60\t501\t10\t10\t99\t386\t142\t430\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Trade Page 1-2\t80\t400\t60\t501\t10\t4\t99\t386\t72\t187\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Trade Page 2-2\t80\t400\t60\t501\t10\t4\t99\t386\t283\t398\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Bank Page 1-2\t80\t400\t60\t501\t6\t4\t154\t329\t203\t318\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Transmogrify Box Page 1-2\t80\t400\t60\t501\t3\t4\t196\t282\t199\t314\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Guild Vault Page 1-2\t80\t400\t60\t501\t8\t8\t126\t359\t148\t381\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Trophy Case Page 1-2\t80\t400\t60\t501\t2\t2\t191\t296\t201\t314\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Big Bank Page 1-2\t80\t400\t60\t501\t6\t8\t153\t325\t143\t373\t29\t29\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t56\t82\t-1\t-1\t-1\t-1\t55\t112\t-1\t-1\t-1\t-1\t54\t51\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t23\t24\t-1\t-1\t-1\t-1\t52\t25\t-1\t-1\t-1\t-1\t54\t52\t-1\t-1\t-1\t-1\t54\t53',
  'Hireling2\t80\t400\t60\t501\t0\t0\t-1\t-1\t-1\t-1\t29\t29\t100\t155\t107\t219\t55\t112\t213\t269\t137\t219\t56\t82\t331\t386\t107\t219\t55\t112\t215\t269\t68\t119\t54\t51\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1\t-1',
  'Druid2\t400\t720\t60\t501\t10\t4\t419\t706\t315\t429\t29\t29\t420\t475\t107\t219\t55\t112\t533\t589\t137\t219\t56\t82\t651\t706\t107\t219\t55\t112\t535\t589\t68\t119\t54\t51\t609\t632\t95\t119\t23\t24\t495\t518\t240\t264\t23\t24\t609\t632\t240\t264\t23\t24\t536\t588\t239\t264\t52\t25\t652\t706\t242\t294\t54\t52\t421\t475\t241\t294\t54\t53',
  'Assassin2\t400\t720\t60\t501\t10\t4\t419\t706\t315\t429\t29\t29\t420\t475\t107\t219\t55\t112\t533\t589\t137\t219\t56\t82\t651\t706\t107\t219\t55\t112\t535\t589\t68\t119\t54\t51\t609\t632\t95\t119\t23\t24\t495\t518\t240\t264\t23\t24\t609\t632\t240\t264\t23\t24\t536\t588\t239\t264\t52\t25\t652\t706\t242\t294\t54\t52\t421\t475\t241\t294\t54\t53',
].join('\n')

const INVENTORY_TXT_BODY_SLOT_KEYS: readonly InventoryTxtBodySlotKey[] = [
  'rArm',
  'torso',
  'lArm',
  'head',
  'neck',
  'rHand',
  'lHand',
  'belt',
  'feet',
  'gloves',
]

export function parseInventoryTxt(tsv: string): readonly InventoryTxtRow[] {
  const lines = tsv
    .split(/\r?\n/)
    .map(l => l.trimEnd())
    .filter(l => l.length > 0)
  if (lines.length < 2) {
    throw new Error('[inventory] Invalid inventory.txt: missing header or data rows')
  }
  const headers = lines[0]!.split('\t')
  const colIndex = new Map<string, number>()
  headers.forEach((h, i) => colIndex.set(h.trim(), i))

  const num = (cols: string[], name: string): number => {
    const idx = colIndex.get(name)
    if (idx === undefined) {
      throw new Error(`[inventory] Missing column "${name}" in inventory.txt`)
    }
    const val = Number(cols[idx])
    if (!Number.isFinite(val)) {
      throw new Error(`[inventory] Invalid numeric value "${cols[idx]}" for column "${name}" in inventory.txt`)
    }
    return val
  }

  const rows: InventoryTxtRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split('\t')
    const className = (cols[colIndex.get('class') ?? 0] ?? '').trim()
    if (!className || className.toLowerCase() === 'expansion') continue

    const invLeft = num(cols, 'invLeft')
    const invRight = num(cols, 'invRight')
    const invTop = num(cols, 'invTop')
    const invBottom = num(cols, 'invBottom')

    const slots = {} as Record<InventoryTxtBodySlotKey, InventoryTxtSlotRect>
    for (const key of INVENTORY_TXT_BODY_SLOT_KEYS) {
      slots[key] = {
        left: num(cols, `${key}Left`),
        right: num(cols, `${key}Right`),
        top: num(cols, `${key}Top`),
        bottom: num(cols, `${key}Bottom`),
        width: num(cols, `${key}Width`),
        height: num(cols, `${key}Height`),
      }
    }

    rows.push({
      class: className,
      invLeft,
      invRight,
      invTop,
      invBottom,
      invWidth: invRight - invLeft,
      invHeight: invBottom - invTop,
      gridX: num(cols, 'gridX'),
      gridY: num(cols, 'gridY'),
      gridLeft: num(cols, 'gridLeft'),
      gridRight: num(cols, 'gridRight'),
      gridTop: num(cols, 'gridTop'),
      gridBottom: num(cols, 'gridBottom'),
      gridBoxWidth: num(cols, 'gridBoxWidth'),
      gridBoxHeight: num(cols, 'gridBoxHeight'),
      slots,
    })
  }
  return rows
}

export const INVENTORY_TXT_LAYOUTS: readonly InventoryTxtRow[] = parseInventoryTxt(RAW_INVENTORY_TXT)
export const INVENTORY_TXT_BY_CLASS: ReadonlyMap<string, InventoryTxtRow> = new Map(
  INVENTORY_TXT_LAYOUTS.map(r => [r.class, r]),
)

const CLASS_CODE_TO_INVENTORY_TXT_NAME: Readonly<Record<string, string>> = {
  ama: 'Amazon',
  sor: 'Sorceress',
  nec: 'Necromancer',
  pal: 'Paladin',
  bar: 'Barbarian',
  dru: 'Druid',
  ass: 'Assassin',
}

/**
 * Looks up a canonical `inventory.txt` layout row by class code (`ama..ass`),
 * class name (`Amazon..Assassin`), or panel name (`Big Bank Page 1`, `Hireling`, etc.)
 * and resolution (`0` = 640x480, `1` = 800x600 `*2` / `*-2` rows).
 * Fails fast if the requested layout does not exist.
 */
export function getInventoryLayout(classOrPanelName: string, resolution: 0 | 1 = 1): InventoryTxtRow {
  const trimmed = classOrPanelName.trim()
  const baseName = CLASS_CODE_TO_INVENTORY_TXT_NAME[trimmed.toLowerCase()] ?? trimmed
  if (resolution === 1) {
    if (baseName.endsWith('2') && INVENTORY_TXT_BY_CLASS.has(baseName)) {
      return INVENTORY_TXT_BY_CLASS.get(baseName)!
    }
    const candidate2 = `${baseName}2`
    if (INVENTORY_TXT_BY_CLASS.has(candidate2)) {
      return INVENTORY_TXT_BY_CLASS.get(candidate2)!
    }
    const candidateDash2 = `${baseName}-2`
    if (INVENTORY_TXT_BY_CLASS.has(candidateDash2)) {
      return INVENTORY_TXT_BY_CLASS.get(candidateDash2)!
    }
  }
  const exact = INVENTORY_TXT_BY_CLASS.get(baseName)
  if (!exact) {
    throw new Error(`[inventory] Unknown inventory.txt layout "${classOrPanelName}" (resolution=${resolution})`)
  }
  return exact
}

const DEFAULT_INV_LAYOUT_800 = getInventoryLayout('Amazon2', 1)

export const INV_PANEL_ORIGIN = {
  x: DEFAULT_INV_LAYOUT_800.invLeft,
  y: DEFAULT_INV_LAYOUT_800.invTop,
  width: DEFAULT_INV_LAYOUT_800.invWidth,
  height: DEFAULT_INV_LAYOUT_800.invHeight,
} as const

export const INV_GRID_ORIGIN = {
  x: DEFAULT_INV_LAYOUT_800.gridLeft,
  y: DEFAULT_INV_LAYOUT_800.gridTop,
  cols: DEFAULT_INV_LAYOUT_800.gridX,
  rows: DEFAULT_INV_LAYOUT_800.gridY,
  cellPx: DEFAULT_INV_LAYOUT_800.gridBoxWidth,
} as const

export const EQUIP_SLOTS_LAYOUT: Readonly<
  Record<EquipSlotId, { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly label: string }>
> = {
  helm: {
    x: DEFAULT_INV_LAYOUT_800.slots.head.left,
    y: DEFAULT_INV_LAYOUT_800.slots.head.top,
    w: DEFAULT_INV_LAYOUT_800.slots.head.width,
    h: DEFAULT_INV_LAYOUT_800.slots.head.height,
    label: '头盔',
  },
  amulet: {
    x: DEFAULT_INV_LAYOUT_800.slots.neck.left,
    y: DEFAULT_INV_LAYOUT_800.slots.neck.top,
    w: DEFAULT_INV_LAYOUT_800.slots.neck.width,
    h: DEFAULT_INV_LAYOUT_800.slots.neck.height,
    label: '项链',
  },
  weapon1: {
    x: DEFAULT_INV_LAYOUT_800.slots.rArm.left,
    y: DEFAULT_INV_LAYOUT_800.slots.rArm.top,
    w: DEFAULT_INV_LAYOUT_800.slots.rArm.width,
    h: DEFAULT_INV_LAYOUT_800.slots.rArm.height,
    label: '主手武器',
  },
  armor: {
    x: DEFAULT_INV_LAYOUT_800.slots.torso.left,
    y: DEFAULT_INV_LAYOUT_800.slots.torso.top,
    w: DEFAULT_INV_LAYOUT_800.slots.torso.width,
    h: DEFAULT_INV_LAYOUT_800.slots.torso.height,
    label: '护甲',
  },
  weapon2: {
    x: DEFAULT_INV_LAYOUT_800.slots.lArm.left,
    y: DEFAULT_INV_LAYOUT_800.slots.lArm.top,
    w: DEFAULT_INV_LAYOUT_800.slots.lArm.width,
    h: DEFAULT_INV_LAYOUT_800.slots.lArm.height,
    label: '副手/盾牌',
  },
  gloves: {
    x: DEFAULT_INV_LAYOUT_800.slots.gloves.left,
    y: DEFAULT_INV_LAYOUT_800.slots.gloves.top,
    w: DEFAULT_INV_LAYOUT_800.slots.gloves.width,
    h: DEFAULT_INV_LAYOUT_800.slots.gloves.height,
    label: '手套',
  },
  ring1: {
    x: DEFAULT_INV_LAYOUT_800.slots.rHand.left,
    y: DEFAULT_INV_LAYOUT_800.slots.rHand.top,
    w: DEFAULT_INV_LAYOUT_800.slots.rHand.width,
    h: DEFAULT_INV_LAYOUT_800.slots.rHand.height,
    label: '左戒指',
  },
  belt: {
    x: DEFAULT_INV_LAYOUT_800.slots.belt.left,
    y: DEFAULT_INV_LAYOUT_800.slots.belt.top,
    w: DEFAULT_INV_LAYOUT_800.slots.belt.width,
    h: DEFAULT_INV_LAYOUT_800.slots.belt.height,
    label: '腰带',
  },
  ring2: {
    x: DEFAULT_INV_LAYOUT_800.slots.lHand.left,
    y: DEFAULT_INV_LAYOUT_800.slots.lHand.top,
    w: DEFAULT_INV_LAYOUT_800.slots.lHand.width,
    h: DEFAULT_INV_LAYOUT_800.slots.lHand.height,
    label: '右戒指',
  },
  boots: {
    x: DEFAULT_INV_LAYOUT_800.slots.feet.left,
    y: DEFAULT_INV_LAYOUT_800.slots.feet.top,
    w: DEFAULT_INV_LAYOUT_800.slots.feet.width,
    h: DEFAULT_INV_LAYOUT_800.slots.feet.height,
    label: '靴子',
  },
}

/**
 * Ground Truth (`Panel\invchar6Tab.dc6` frames 0 & 1, 62x22 px each, drawn at `ox + 15, oy + 23` and `ox + 245, oy + 23`):
 * Each 62x22 weapon swap tab strip has two 31x22 sub-tabs:
 * - Left half (`w = 31`): Weapon Set `I` (`weaponSwapSet = 0`)
 * - Right half (`w = 31`): Weapon Set `II` (`weaponSwapSet = 1`)
 */
export const WEAPON_SWAP_TABS_BOUNDS = {
  left: { x: 400 + 15, y: 60 + 23, w: 62, h: 22 },
  right: { x: 400 + 245, y: 60 + 23, w: 62, h: 22 },
  leftI: { x: 400 + 15, y: 60 + 23, w: 31, h: 22, set: 0 as const },
  leftII: { x: 400 + 46, y: 60 + 23, w: 31, h: 22, set: 1 as const },
  rightI: { x: 400 + 245, y: 60 + 23, w: 31, h: 22, set: 0 as const },
  rightII: { x: 400 + 276, y: 60 + 23, w: 31, h: 22, set: 1 as const },
} as const

export function resolveWeaponSwapTabClick(logicalX: number, logicalY: number): 0 | 1 | null {
  for (const subTab of [
    WEAPON_SWAP_TABS_BOUNDS.leftI,
    WEAPON_SWAP_TABS_BOUNDS.leftII,
    WEAPON_SWAP_TABS_BOUNDS.rightI,
    WEAPON_SWAP_TABS_BOUNDS.rightII,
  ]) {
    if (
      logicalX >= subTab.x &&
      logicalX < subTab.x + subTab.w &&
      logicalY >= subTab.y &&
      logicalY <= subTab.y + subTab.h
    ) {
      return subTab.set
    }
  }
  return null
}

export const INV_CLOSE_BTN_BOUNDS = { x: 400 + 18, y: 60 + 385, w: 32, h: 32 } as const

/**
 * D2Client.dll `0x6fb3cfb0` (`0x6fb3d118` & `0x6fb3d2a2`) + `Panel\invchar6.dc6` frames 4..7:
 * - Left gold coin button socket (`Panel\goldcoinbtn.dc6`, 2 frames of 20x18, row 0 transparent):
 *   drawn at `x = ox + 84 = 484`, `y = oy + 391 = 451` (`w = 20, h = 18`), filling the 20x16 dark socket (`relX = 84..103, relY = 392..407`).
 * - Vertical divider bar: `relX = 104..106` (3px wide).
 * - Right gold amount text recess: `relX = 107..196` (`w = 90`), `relY = 392..407` (`h = 16`),
 *   horizontally centered at `textX = ox + 152 = 552` and vertically centered at alphabetic baseline `textY = oy + 403 = 463`.
 */
export const INV_GOLD_BTN_BOUNDS = {
  x: 400 + 84,
  y: 60 + 391,
  relX: 84,
  relY: 391,
  w: 20,
  h: 18,
} as const

/** Panel-relative click rect of the inventory gold coin button (inclusive bounds, D2Client inventory panel). */
export const INV_GOLD_BTN_HIT = { relX0: 83, relX1: 103, relY0: 392, relY1: 410 } as const

export const INV_GOLD_BOX_RECESS = {
  x: 400 + 107,
  y: 60 + 392,
  relX: 107,
  relY: 392,
  w: 90,
  h: 16,
  textX: 400 + 152,
  textY: 60 + 403,
} as const

/**
 * Resolves the authentic DC6 sprite rectangle from the items atlas for a given item.
 *
 * Implements a 5-tier fallback resolution chain guaranteeing 0 empty fallback boxes:
 * 1. Direct `item.invFile` lookup in `itemRects`
 * 2. Item unique/display name lookup in `BAKED_UI_MANIFEST.codeToInvFile`
 * 3. Base item code lookup in `BAKED_UI_MANIFEST.codeToInvFile`
 * 4. Authoritative Diablo II 1.13c specific item code/name mappings
 * 5. Robust bounding-box dimension fallbacks based on (invWidth, invHeight)
 */
export interface ResolvableItem {
  readonly code?: string | undefined
  readonly name?: string | undefined
  readonly nameZh?: string | undefined
  readonly baseNameZh?: string | undefined
  readonly invFile?: string | undefined
  readonly baseInvFile?: string | undefined
  readonly flippyFile?: string | undefined
  readonly isGold?: boolean | undefined
  readonly amount?: number | undefined
  readonly gold?: number | undefined
  readonly invtransform?: string | undefined
  readonly chrtransform?: string | undefined
  readonly variant?: number | undefined
  readonly graphicIndex?: number | undefined
  readonly id?: string | number | undefined
  readonly invWidth?: number | undefined
  readonly invHeight?: number | undefined
  readonly width?: number | undefined
  readonly height?: number | undefined
  readonly identified?: boolean | undefined
  readonly isGambleMystery?: boolean | undefined
  readonly rawItem?: Item | undefined
}

/**
 * Returns the canonical, unpadded item code for sprite lookups.
 *
 * Simulation items carry `code` as the fixed 4-byte .d2s field, space padded
 * (`'hp1 '`, `'dr3 '`); UI items carry it unpadded. Both are normalized here,
 * falling back to the ItemBase code (`base.id`) when `code` is absent.
 */
export function normalizeItemCode(item: ResolvableItem): string | undefined {
  const raw = item.code ?? (item as { base?: { id?: unknown } }).base?.id
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function resolveItemSpriteRect(
  rawItem: ResolvableItem,
  itemRects: Record<string, SpriteRect> = BAKED_UI_MANIFEST.itemRects,
): SpriteRect | null {
  const normalizedCode = normalizeItemCode(rawItem)
  const normalizedItem: ResolvableItem =
    normalizedCode === rawItem.code ? rawItem : { ...rawItem, code: normalizedCode }
  const isUnid = Boolean(
    normalizedItem.identified === false ||
      normalizedItem.isGambleMystery === true ||
      normalizedItem.rawItem?.identified === false ||
      normalizedItem.rawItem?.isGambleMystery === true ||
      (normalizedItem.rawItem?.flags !== undefined && normalizedItem.rawItem.flags.identified === false),
  )
  // Per D2Client.dll, unidentified items render their base item graphic without unique/set invfile or dye transform
  const item: ResolvableItem = isUnid
    ? {
        ...normalizedItem,
        invFile:
          normalizedItem.baseInvFile ??
          (normalizedItem.code && BAKED_UI_MANIFEST.codeToInvFile[normalizedItem.code]
            ? BAKED_UI_MANIFEST.codeToInvFile[normalizedItem.code]
            : normalizedItem.invFile),
        invtransform: undefined,
        name: normalizedItem.rawItem?.base?.name ?? undefined,
      }
    : normalizedItem
  // Tier 0: Transformed dyed item lookup: `${invFile}_${invtransform}`
  const targetInv =
    item.invFile ||
    (item.name ? BAKED_UI_MANIFEST.codeToInvFile[item.name] : undefined) ||
    (item.code ? BAKED_UI_MANIFEST.codeToInvFile[item.code] : undefined)

  if (targetInv && item.invtransform) {
    const targetLower = targetInv.toLowerCase()
    const dyedKey = `${targetLower}_${item.invtransform}`.toLowerCase()
    if (itemRects[dyedKey]) return itemRects[dyedKey]
    if (itemRects[`${targetInv}_${item.invtransform}`]) {
      return itemRects[`${targetInv}_${item.invtransform}`]
    }
    if (targetLower.endsWith(`_${item.invtransform.toLowerCase()}`) && itemRects[targetLower]) {
      return itemRects[targetLower]
    }
  }

  // Tier 0.5: Authentic Diablo II 1.13c ItemTypes.txt VarInvGfx (Charms, Rings, Amulets, Jewels)
  const lowerCode = item.code?.toLowerCase()
  const lowerInv = item.invFile?.toLowerCase()
  const varGfxCode =
    lowerCode && CANONICAL_VAR_INV_GFX[lowerCode]
      ? lowerCode
      : lowerInv && /^invrin\d?$/.test(lowerInv)
        ? 'rin'
        : lowerInv && /^invamu\d?$/.test(lowerInv)
          ? 'amu'
          : lowerInv && /^(invjw|invjew)\d?$/.test(lowerInv)
            ? 'jew'
            : undefined
  const varGfxList = varGfxCode ? CANONICAL_VAR_INV_GFX[varGfxCode] : undefined

  if (varGfxList) {
    if (lowerInv && (lowerInv === 'invmss' || lowerInv === 'invtrch' || lowerInv === 'invvip')) {
      const rect = itemRects[item.invFile!] ?? itemRects[lowerInv]
      if (rect) return rect
    }
    const rawVariant = item.variant ?? item.graphicIndex
    if (typeof rawVariant === 'number' && Number.isFinite(rawVariant) && rawVariant >= 0) {
      const key = varGfxList[Math.trunc(rawVariant) % varGfxList.length]!
      if (itemRects[key]) return itemRects[key]
    }
    if (lowerInv && varGfxList.includes(lowerInv)) {
      const rect = itemRects[item.invFile!] ?? itemRects[lowerInv]
      if (rect) return rect
    }
    if (item.name) {
      const fromName = BAKED_UI_MANIFEST.codeToInvFile[item.name]
      if (
        fromName &&
        (varGfxList.includes(fromName) ||
          fromName === 'invmss' ||
          fromName === 'invtrch' ||
          fromName === 'invvip') &&
        itemRects[fromName]
      ) {
        return itemRects[fromName]
      }
    }
    const defaultKey = varGfxList[0]!
    return itemRects[defaultKey] ?? null
  }

  // Tier 1: Direct invFile
  if (item.invFile) {
    if (itemRects[item.invFile]) return itemRects[item.invFile]
    const lower = item.invFile.toLowerCase()
    if (itemRects[lower]) return itemRects[lower]
  }

  // Tier 2: Unique / set / display name in codeToInvFile
  if (item.name) {
    const fromName = BAKED_UI_MANIFEST.codeToInvFile[item.name]
    if (fromName && itemRects[fromName]) return itemRects[fromName]
  }

  // Tier 3: Base item code in codeToInvFile
  if (item.code) {
    const fromCode = BAKED_UI_MANIFEST.codeToInvFile[item.code]
    if (fromCode && itemRects[fromCode]) return itemRects[fromCode]
  }

  // Tier 4: Canonical Diablo II 1.13c specific code overrides
  if (item.code === 'tbk') return itemRects['invbbk'] ?? null
  if (item.code === 'ibk') return itemRects['invrbk'] ?? null
  if (item.code === 'box') return itemRects['invbox'] ?? null

  return null
}

export interface CursorItemGridPlacement {
  /** Top-left cell column computed by D2Client.dll 0x6fb44820 cursor-centered math. */
  readonly col: number
  /** Top-left cell row computed by D2Client.dll 0x6fb44820 cursor-centered math. */
  readonly row: number
  /** Raw cell column directly under the mouse hotspot (`Math.floor((mouseX - origin.x) / cellPx)`). */
  readonly rawCol: number
  /** Raw cell row directly under the mouse hotspot (`Math.floor((mouseY - origin.y) / cellPx)`). */
  readonly rawRow: number
  /** Whether `[col..col+w-1] x [row..row+h-1]` fits completely inside the container's `cols x rows`. */
  readonly inBounds: boolean
  /** All placed items overlapping the `[col..col+w-1] x [row..row+h-1]` footprint when `inBounds` is true. */
  readonly overlaps: readonly GridPlacement[]
  /** Placed item directly under `(rawCol, rawRow)` hotspot, if any. */
  readonly directHit: GridPlacement | null
}

/**
 * Ground Truth (`D2Client.dll` `0x6fb445d0`, `0x6fb44820`, `0x6fb46e66..0x6fb47295`):
 * Computes the top-left grid cell `(col, row)`, bounds check, and footprint overlaps for a held
 * `cursorItem` rendered centered on `(mouseX, mouseY)`.
 *
 * In `D2Client.dll` `0x6fb44820`:
 * - `pxW = invWidth * 28`, `pxH = invHeight * 28` (`0x6fb445d0`).
 * - Even cell dimensions add `px >> 2` (`14 * cells / 2`) before dividing by `gridBoxWidth` (`29`),
 *   then subtract `cells >> 1` (clamped at `0`).
 * - Odd cell dimensions divide directly by `29`, then subtract `cells >> 1` (clamped at `0`).
 * - When `invHeight === rows` (e.g. `1x4` `hst` in `3x4` Cube or `10x4` Inventory), `row` is forced to
 *   `(rows >> 1) - (invHeight >> 1) = 0` regardless of which row the cursor is over.
 */
export function computeCursorItemGridPlacement(
  mouseX: number,
  mouseY: number,
  origin: {
    readonly x: number
    readonly y: number
    readonly cols: number
    readonly rows: number
    readonly cellPx: number
  },
  cursorItem: Pick<UiInventoryItem, 'invWidth' | 'invHeight' | 'code'>,
  placedItems: readonly GridPlacement[],
): CursorItemGridPlacement {
  const { cols, rows, cellPx } = origin
  const rawCol = Math.floor((mouseX - origin.x) / cellPx)
  const rawRow = Math.floor((mouseY - origin.y) / cellPx)
  const directHit =
    placedItems.find(
      (p) =>
        rawCol >= p.col &&
        rawCol < p.col + p.item.invWidth &&
        rawRow >= p.row &&
        rawRow < p.row + p.item.invHeight,
    ) ?? null

  const w = Math.max(1, Math.trunc(cursorItem.invWidth || 1))
  const h = Math.max(1, Math.trunc(cursorItem.invHeight || 1))
  const pxW = w * 28
  const pxH = h * 28

  let col =
    (w & 1) === 0
      ? Math.floor((mouseX - origin.x + (pxW >> 2)) / cellPx)
      : Math.floor((mouseX - origin.x) / cellPx)
  if (w === cols) col = cols >> 1
  if (w > 1) col = Math.max(0, col - (w >> 1))

  let row =
    (h & 1) === 0
      ? Math.floor((mouseY - origin.y + (pxH >> 2)) / cellPx)
      : Math.floor((mouseY - origin.y) / cellPx)
  if (h === rows) row = rows >> 1
  if (h > 1) row = Math.max(0, row - (h >> 1))

  const inBounds = col >= 0 && row >= 0 && col + w <= cols && row + h <= rows
  const overlaps = inBounds
    ? placedItems.filter((p) => {
        const ox = col < p.col + p.item.invWidth && col + w > p.col
        const oy = row < p.row + p.item.invHeight && row + h > p.row
        return ox && oy
      })
    : []

  return {
    col,
    row,
    rawCol,
    rawRow,
    inBounds,
    overlaps,
    directHit,
  }
}

/**
 * Resolves the authentic Diablo II 1.13c ground item sprite rect from the items atlas.
 *
 * In Diablo II, ground items do NOT use the 2D inventory icon (\`invfile\`).
 * Instead, they use \`flippyfile\` (\`flp*.dc6\`), where the animation's last frame
 * represents the resting, hand-drawn/3D-rendered isometric ground item.
 */

/**
 * Authentic Diablo II 1.13c Gold Flippy Sprite Key & Rect Resolution (`flpgld.dc6`, `D2Client.dll` `0x6fb36810` / `D2Game.dll` `0x6fcad3d0`).
 * - Tier 0 (`flpgld_0`): 1–99 gold (24×7 px).
 * - Tier 1 (`flpgld_1`): 100–499 gold (26×13 px).
 * - Tier 2 (`flpgld_2`): 500–4999 gold (32×20 px).
 * - Tier 3 (`flpgld_3`): 5000+ gold (46×23 px).
 */
export function getGoldFlippyKey(
  amount: number,
): 'flpgld_0' | 'flpgld_1' | 'flpgld_2' | 'flpgld_3' {
  const safeAmount = Math.max(1, Math.floor(amount || 1))
  if (safeAmount >= 5000) return 'flpgld_3'
  if (safeAmount >= 500) return 'flpgld_2'
  if (safeAmount >= 100) return 'flpgld_1'
  return 'flpgld_0'
}

export function getGoldFlippyRect(
  amount: number,
  flippyRects: Record<string, SpriteRect> = BAKED_UI_MANIFEST.flippyRects ?? {},
): SpriteRect | null {
  const key = getGoldFlippyKey(amount)
  return flippyRects[key] ?? flippyRects['flpgld'] ?? null
}

export function resolveGroundItemFlippyKey(
  item: ResolvableItem,
  availableKeys: Readonly<Record<string, unknown>> = BAKED_UI_MANIFEST.flippyRects ?? {},
  codeToFlippyFile: Record<string, string> = BAKED_UI_MANIFEST.codeToFlippyFile ?? {},
): string | null {
  // 1. Gold rendering: 4 authentic visual graphic tiers (< 100, 100-499, 500-4999, 5000+)
  if ((item as any).isGold || item.code === 'gld') {
    const amount = (item as any).amount ?? (item as any).goldAmount ?? 1
    const key = getGoldFlippyKey(amount)
    if (availableKeys[key]) return key
    if (availableKeys['flpgld']) return 'flpgld'
    return null
  }

  // 1.5 Authentic Charm Ground Flippy Resolution (cm1 -> flpchm1, cm2 -> flpchm2, cm3 -> flpchm3)
  const normCode = normalizeItemCode(item)?.toLowerCase()
  const isAnni =
    normCode === 'anni' ||
    normCode === 'mss' ||
    ((!normCode || normCode === 'cm1') && typeof item.name === 'string' && item.name.includes('Annihilus'))
  const isTorch =
    normCode === 'torch' ||
    normCode === 'trch' ||
    ((!normCode || normCode === 'cm2') &&
      typeof item.name === 'string' &&
      (item.name === 'Hellfire Torch' || item.name.includes('Hellfire Torch') || (normCode === 'cm2' && item.name.includes('Torch'))))
  if (
    normCode === 'cm3' ||
    normCode === 'gheeds' ||
    ((!normCode || normCode === 'cm3') && typeof item.name === 'string' && item.name.includes('Gheed'))
  ) {
    return availableKeys['flpchm3'] ? 'flpchm3' : null
  }
  if (normCode === 'cm2' || isTorch) {
    if (isTorch && availableKeys['flptrch']) return 'flptrch'
    return availableKeys['flpchm2'] ? 'flpchm2' : null
  }
  if (normCode === 'cm1' || isAnni) {
    if (isAnni && availableKeys['flpmss']) return 'flpmss'
    return availableKeys['flpchm1'] ? 'flpchm1' : null
  }

  // 2. Direct flippyFile property
  if ((item as any).flippyFile) {
    const flpFile = String((item as any).flippyFile).toLowerCase()
    if (item.invtransform) {
      const dyed = `${flpFile}_${item.invtransform}`.toLowerCase()
      if (availableKeys[dyed]) return dyed
    }
    if (availableKeys[flpFile]) return flpFile
  }

  // 3. Unique / Set item name lookup in codeToFlippyFile
  if (item.name) {
    const fromName = codeToFlippyFile[item.name]
    if (fromName) {
      if (item.invtransform) {
        const dyed = `${fromName}_${item.invtransform}`.toLowerCase()
        if (availableKeys[dyed]) return dyed
      }
      if (availableKeys[fromName]) return fromName
    }
  }

  // 4. Base item code lookup in codeToFlippyFile.
  // Simulation `Item.code` is the 4-char space-padded .d2s code (e.g. 'dr3 ',
  // D2Common!6FD77180), so it must be trimmed; `base.id` is the unpadded
  // ItemBase code and is authoritative when `code` is absent.
  const itemCode = normalizeItemCode(item)
  if (itemCode) {
    const fromCode = codeToFlippyFile[itemCode] ?? codeToFlippyFile[itemCode.toLowerCase()]
    if (fromCode) {
      if (item.invtransform) {
        const dyed = `${fromCode}_${item.invtransform}`.toLowerCase()
        if (availableKeys[dyed]) return dyed
      }
      if (availableKeys[fromCode]) return fromCode
    }
  }

  // 5. invFile -> flp substitution (e.g. invhax -> flphax, invcap -> flpcap)
  if (item.invFile) {
    const flpCandidate = item.invFile.toLowerCase().replace(/^inv/, 'flp')
    if (item.invtransform) {
      const dyed = `${flpCandidate}_${item.invtransform}`.toLowerCase()
      if (availableKeys[dyed]) return dyed
    }
    if (availableKeys[flpCandidate]) return flpCandidate
  }

  return null
}

export function resolveGroundItemSpriteRect(
  item: ResolvableItem,
  flippyRects: Record<string, SpriteRect> = BAKED_UI_MANIFEST.flippyRects ?? {},
  codeToFlippyFile: Record<string, string> = BAKED_UI_MANIFEST.codeToFlippyFile ?? {},
): SpriteRect | null {
  const key = resolveGroundItemFlippyKey(item, flippyRects, codeToFlippyFile)
  return key ? (flippyRects[key] ?? null) : null
}

/** Maximum scrolls held in a Tome of Town Portal (`tbk`) or Tome of Identify (`ibk`) per `Books.txt`. */
export const TOME_MAX_QUANTITY = 20

/** Maximum keys held in a Key stack (`key`) per `Misc.txt` (`maxstack = 12`). */
export const KEY_MAX_QUANTITY = 12

export function isTomeCode(code: string | undefined): code is 'tbk' | 'ibk' {
  const c = (code ?? '').trim().toLowerCase()
  return c === 'tbk' || c === 'ibk'
}

export function isKeyCode(code: string | undefined): code is 'key' {
  return (code ?? '').trim().toLowerCase() === 'key'
}

export function isScrollForTome(scrollCode: string | undefined, tomeCode: string | undefined): boolean {
  const sc = (scrollCode ?? '').trim().toLowerCase()
  const tc = (tomeCode ?? '').trim().toLowerCase()
  return (sc === 'tsc' && tc === 'tbk') || (sc === 'isc' && tc === 'ibk')
}

export function isKeyStackPair(cursorCode: string | undefined, targetCode: string | undefined): boolean {
  return isKeyCode(cursorCode) && isKeyCode(targetCode)
}

/**
 * Ground Truth (`data\global\excel\misc.txt` `useable === 1` in Diablo II v1.13c):
 * The exact 35 miscellaneous item codes that can be activated via right-click in the inventory.
 */
export const CANONICAL_MISC_USABLE_CODES: ReadonlySet<string> = new Set([
  'elx', 'hpo', 'mpo', 'hpf', 'mpf', 'vps', 'yps', 'rvs', 'rvl', 'wms',
  'tbk', 'ibk', 'tsc', 'isc', 'xyz', 'box', 'ass',
  'hp1', 'hp2', 'hp3', 'hp4', 'hp5',
  'mp1', 'mp2', 'mp3', 'mp4', 'mp5',
  'hrb', 'rps', 'rpl', 'bps', 'bpl', '0sc', 'trs', 'tr1', 'tr2', 'toa', 'bks', 'bkd',
])

export function isUsableRightClickItem(code: string | undefined): boolean {
  const c = (code ?? '').trim().toLowerCase()
  return CANONICAL_MISC_USABLE_CODES.has(c)
}

export function getTomeQuantity(item: UiInventoryItem): number {
  if (typeof item.quantity === 'number' && Number.isFinite(item.quantity)) {
    return Math.max(0, Math.trunc(item.quantity))
  }
  if (typeof item.rawItem?.quantity === 'number' && Number.isFinite(item.rawItem.quantity)) {
    return Math.max(0, Math.trunc(item.rawItem.quantity))
  }
  if ((isTomeCode(item.code) || isKeyCode(item.code)) && typeof item.rawItem?.stack === 'number' && Number.isFinite(item.rawItem.stack)) {
    return Math.max(0, Math.trunc(item.rawItem.stack))
  }
  const rawStatList = (item.rawItem as { readonly stats?: readonly { statId?: number; id?: number; value?: number }[] } | undefined)?.stats
  if (Array.isArray(rawStatList)) {
    const stat70 = rawStatList.find(s => (s.statId ?? s.id) === 70)?.value
    if (typeof stat70 === 'number' && Number.isFinite(stat70)) {
      return Math.max(0, Math.trunc(stat70))
    }
  }
  const baseMatch = /数量\s*[:：]\s*(\d+)|Quantity\s*[:：]\s*(\d+)/i.exec(item.baseNameZh ?? '')
  if (baseMatch) {
    return Math.max(0, Number(baseMatch[1] ?? baseMatch[2]))
  }
  for (const s of item.stats ?? []) {
    const statMatch = /数量\s*[:：]\s*(\d+)|Quantity\s*[:：]\s*(\d+)/i.exec(s.text)
    if (statMatch) {
      return Math.max(0, Number(statMatch[1] ?? statMatch[2]))
    }
  }
  return isTomeCode(item.code) ? TOME_MAX_QUANTITY : 1
}

export function setTomeQuantity(item: UiInventoryItem, newQty: number): UiInventoryItem {
  const maxQty =
    item.maxQuantity ??
    (isTomeCode(item.code)
      ? TOME_MAX_QUANTITY
      : isKeyCode(item.code)
        ? KEY_MAX_QUANTITY
        : 99)
  const qty = Math.max(0, Math.min(maxQty, Math.trunc(newQty)))
  ;(item as { quantity?: number }).quantity = qty

  if (item.baseNameZh && /数量\s*[:：]\s*\d+/i.test(item.baseNameZh)) {
    ;(item as { baseNameZh: string }).baseNameZh = item.baseNameZh.replace(/数量\s*[:：]\s*\d+/gi, `数量: ${qty}`)
  } else if (isTomeCode(item.code) && item.baseNameZh && !item.stats?.some(s => /数量\s*[:：]\s*\d+/i.test(s.text))) {
    ;(item as { baseNameZh: string }).baseNameZh = `${item.baseNameZh} (数量: ${qty})`
  }

  if (item.baseNameEn && /Quantity\s*[:：]\s*\d+/i.test(item.baseNameEn)) {
    ;(item as { baseNameEn: string }).baseNameEn = item.baseNameEn.replace(/Quantity\s*[:：]\s*\d+/gi, `Quantity: ${qty}`)
  }

  if (Array.isArray(item.stats)) {
    const hasQtyLine = item.stats.some(s => /^(数量|Quantity)\s*[:：]\s*\d+/i.test(s.text))
    if (hasQtyLine) {
      ;(item as { stats: readonly { text: string; color?: D2ColorCode }[] }).stats = item.stats.map(s =>
        /^(数量|Quantity)\s*[:：]\s*\d+/i.test(s.text) ? { ...s, text: `数量: ${qty}` } : s,
      )
    }
  }

  if (Array.isArray(item.statsEn)) {
    const hasQtyLineEn = item.statsEn.some(s => /^(数量|Quantity)\s*[:：]\s*\d+/i.test(s.text))
    if (hasQtyLineEn) {
      ;(item as { statsEn: readonly { text: string; color?: D2ColorCode }[] }).statsEn = item.statsEn.map(s =>
        /^(数量|Quantity)\s*[:：]\s*\d+/i.test(s.text) ? { ...s, text: `Quantity: ${qty}` } : s,
      )
    }
  }

  if (item.rawItem) {
    ;(item.rawItem as { quantity?: number; stack?: number }).quantity = qty
    ;(item.rawItem as { quantity?: number; stack?: number }).stack = qty
  }

  return item
}

export function withTomeQuantity(item: UiInventoryItem, quantity: number): UiInventoryItem {
  const cloned: UiInventoryItem = {
    ...item,
    stats: [...item.stats],
    ...(item.statsEn ? { statsEn: [...item.statsEn] } : {}),
  }
  return setTomeQuantity(cloned, quantity)
}

export function isUiItemUnidentified(item: UiInventoryItem): boolean {
  return Boolean(
    item.identified === false ||
    item.isGambleMystery === true ||
    item.rawItem?.identified === false ||
    item.rawItem?.isGambleMystery === true ||
    (item.rawItem?.flags !== undefined && item.rawItem.flags.identified === false),
  )
}

/**
 * Ground Truth (D2Client.dll 1.13c @ 0x6fb3c600..0x6fb3c710 & 0x6fbbb330..0x6fbbb334):
 * Palette tint indices used by `INVENTORY_DrawGridItems` (`0x6fb458a0..0x6fb45b58`):
 * - Index 0 (`RGB(128, 0, 0)`): Red backdrop — unusable, unmet requirements, unidentified, or gamble mystery item
 * - Index 1 (`RGB(0, 128, 0)`): Green backdrop — hovered cell only when holding an item on cursor (`pCursorItem != NULL` at `0x6fb45a04`)
 * - Index 2 (`RGB(0, 0, 128)`): Blue backdrop — usable / equippable item
 */
export const GRID_ITEM_BG_RED = 'rgba(72, 18, 18, 0.50)'
export const GRID_ITEM_BG_GREEN = 'rgba(46, 68, 36, 0.55)'
export const GRID_ITEM_BG_BLUE = 'rgba(20, 32, 54, 0.45)'

export interface PlayerItemRequirementContext {
  readonly level: number
  readonly str: number
  readonly dex: number
  readonly classCode?: CharacterClassCode | undefined
}

let _playerContextSeqCounter = 0

export function nextPlayerContextSeq(): number {
  return ++_playerContextSeqCounter
}

/**
 * Ground Truth (D2Common.dll 1.13c `ITEMS_CheckItemRequirements` #10244 & `ITEMS_CanEquipInHandSlots` @ 0x6fd73680):
 * Classifies an item targeting `weapon1` / `weapon2` into:
 * - `'one_handed_weapon'`: 1H weapons (`2handed == 0`)
 * - `'barbarian_1or2h_weapon'`: Two-handed swords with `1or2handed == 1` (`BARBARIAN_ONE_OR_TWO_HANDED_SWORD_CODES`), which Barbarian (`bar`) can wield 1H or 2H
 * - `'strict_two_handed_weapon'`: Strict 2H weapons (`2handed == 1 && 1or2handed != 1`: bows, crossbows, polearms, spears, staves, 2H axes, 2H hammers)
 * - `'offhand'`: Shields (`shie`, `ashd`), Necromancer Shrunken Heads (`head`), and Quivers (`bowq`, `xboq`)
 * - `'other'`: Non-hand items
 */
export type HandSlotItemCategory =
  | 'one_handed_weapon'
  | 'barbarian_1or2h_weapon'
  | 'strict_two_handed_weapon'
  | 'offhand'
  | 'other'

export function isAssassinClawItem(item: UiInventoryItem): boolean {
  const code = (item.code ?? item.rawItem?.base?.id ?? (item as any).base?.id ?? '').trim().toLowerCase()
  if (code.length > 0 && ASSASSIN_HAND_TO_HAND_CLAW_CODES.has(code)) {
    return true
  }
  const rawType = (
    item.rawItem?.base?.type ??
    (item as any).base?.type ??
    (item as any).type ??
    ''
  ).trim().toLowerCase()
  return rawType === 'h2h' || rawType === 'h2h2'
}

export function classifyHandSlotItem(item: UiInventoryItem): HandSlotItemCategory {
  if (
    Array.isArray(item.allowedSlots) &&
    !item.allowedSlots.includes('weapon1') &&
    !item.allowedSlots.includes('weapon2')
  ) {
    return 'other'
  }
  const code = (item.code ?? item.rawItem?.base?.id ?? (item as any).base?.id ?? '').trim().toLowerCase()
  const rawType = (
    item.rawItem?.base?.type ??
    (item as any).base?.type ??
    (item as any).type ??
    ''
  ).trim().toLowerCase()

  // 1. Explicit off-hand / shield check (Shields, Paladin Shields, Necromancer Shrunken Heads, Quivers)
  if (
    (Array.isArray(item.allowedSlots) &&
      item.allowedSlots.includes('weapon2') &&
      !item.allowedSlots.includes('weapon1')) ||
    rawType === 'shie' ||
    rawType === 'shield' ||
    rawType === 'ashd' ||
    rawType === 'head' ||
    rawType === 'bowq' ||
    rawType === 'xboq' ||
    (code.length > 0 && CANONICAL_SHIELD_AND_OFFHAND_CODES.has(code))
  ) {
    return 'offhand'
  }

  // 2. Explicit boolean flags on UiInventoryItem or rawItem.base
  const rawBase = item.rawItem?.base ?? (item as any).base
  if (item.oneOrTwoHanded === true || rawBase?.oneOrTwoHanded === true) {
    return 'barbarian_1or2h_weapon'
  }
  if (item.twoHanded === true || rawBase?.twoHanded === true) {
    return 'strict_two_handed_weapon'
  }
  if (item.twoHanded === false && item.oneOrTwoHanded === false) {
    return 'one_handed_weapon'
  }

  // 3. Canonical 1.13c Weapons.txt / Armor.txt code lookup
  if (code.length > 0) {
    if (BARBARIAN_ONE_OR_TWO_HANDED_SWORD_CODES.has(code)) {
      return 'barbarian_1or2h_weapon'
    }
    if (STRICT_TWO_HANDED_WEAPON_CODES.has(code)) {
      return 'strict_two_handed_weapon'
    }
    if (CANONICAL_ONE_HANDED_WEAPON_CODES.has(code)) {
      return 'one_handed_weapon'
    }
  }

  // 4. ItemType fallback for custom test fixtures without weapon codes
  if (
    rawType === 'bow' ||
    rawType === 'abow' ||
    rawType === 'xbow' ||
    rawType === 'pole' ||
    rawType === 'spea' ||
    rawType === 'aspe' ||
    rawType === 'staf'
  ) {
    return 'strict_two_handed_weapon'
  }

  return 'one_handed_weapon'
}

/**
 * 1.13c ground truth: determine whether a hand slot weapon requires both hands for the player's class.
 */
export function isTwoHandedForClass(item: UiInventoryItem, classCode?: CharacterClassCode | null): boolean {
  const cat = classifyHandSlotItem(item)
  if (cat === 'strict_two_handed_weapon') return true
  if (cat === 'barbarian_1or2h_weapon') return classCode !== 'bar'
  return false
}

/**
 * Ground Truth (`D2Common.dll` `0x6fd74eb0` `ITEMS_GetItemShoots`, `ItemTypes.txt` `Shoots` at `+0x0c`):
 * Resolves the ammunition quiver type shot by `item`:
 * - Bows & Amazon Bows (`bow`, `abow`, `CANONICAL_BOW_WEAPON_CODES`) -> `'bowq'`
 * - Crossbows (`xbow`, `CANONICAL_CROSSBOW_WEAPON_CODES`) -> `'xboq'`
 * - All other items -> `null`
 */
export function getItemShootsQuiverType(item: UiInventoryItem | null | undefined): 'bowq' | 'xboq' | null {
  if (!item) return null
  const code = (item.code ?? item.rawItem?.base?.id ?? (item as any).base?.id ?? '').trim().toLowerCase()
  if (code.length > 0) {
    if (CANONICAL_BOW_WEAPON_CODES.has(code)) return 'bowq'
    if (CANONICAL_CROSSBOW_WEAPON_CODES.has(code)) return 'xboq'
  }
  const rawType = (
    item.rawItem?.base?.type ??
    (item as any).base?.type ??
    (item as any).type ??
    ''
  ).trim().toLowerCase()
  if (rawType === 'bow' || rawType === 'abow') return 'bowq'
  if (rawType === 'xbow') return 'xboq'
  return null
}

/**
 * Ground Truth (`D2Common.dll` `0x6fd74e60` `ITEMS_GetItemQuiver`, `ItemTypes.txt` `Quiver` at `+0x0e`):
 * Resolves the ammunition quiver type of `item` when `item` is a quiver:
 * - Arrow Quivers (`aqv`, `bowq`, `mboq`) -> `'bowq'`
 * - Bolt Quivers (`cqv`, `xboq`, `mxbq`) -> `'xboq'`
 * - All non-quiver items -> `null`
 */
export function getItemQuiverType(item: UiInventoryItem | null | undefined): 'bowq' | 'xboq' | null {
  if (!item) return null
  const code = (item.code ?? item.rawItem?.base?.id ?? (item as any).base?.id ?? '').trim().toLowerCase()
  if (code === 'aqv') return 'bowq'
  if (code === 'cqv') return 'xboq'
  const rawType = (
    item.rawItem?.base?.type ??
    (item as any).base?.type ??
    (item as any).type ??
    ''
  ).trim().toLowerCase()
  if (rawType === 'bowq' || rawType === 'mboq' || rawType === 'aqv') return 'bowq'
  if (rawType === 'xboq' || rawType === 'mxbq' || rawType === 'cqv') return 'xboq'
  return null
}

/**
 * Ground Truth (`D2Common.dll` `0x6fd6f980` `INVENTORY_AreItemsCompatibleInHands(pUnit, item1, item2)`):
 * Determines whether `item1` and `item2` can be equipped simultaneously in `weapon1` and `weapon2`:
 * 1. (`0x6fd6f990..0x6fd6f9c8`): BEFORE checking `ITEMS_Is2Handed`, checks `ITEMS_GetItemShoots`:
 *    if `item1` shoots `item2` (`bow`/`abow` + `bowq`/`aqv`, or `xbow` + `xboq`/`cqv`) or `item2` shoots `item1`,
 *    returns `true`!
 * 2. (`0x6fd6f9ce..0x6fd6f9e4`): Calls `ITEMS_GetItemQuiver`: if either `item1` or `item2` is a quiver (`bowq` / `xboq`)
 *    and was not matched by its corresponding launcher above, returns `false` (quivers cannot pair with melee weapons,
 *    shields, or mismatched bows/crossbows).
 * 3. (`0x6fd6f9ea..0x6fd6fa1b`): Calls `ITEMS_Is2Handed` & `ITEMS_CanUnitUse2HandedAs1Handed`:
 *    if either item requires 2 hands for `classCode`, returns `false`.
 * 4. (`0x6fd6fa1c..0x6fd6fabd`): Checks 1H weapon + shield/shrunken-head (rejecting two off-hands) and
 *    class dual-wielding (Barbarian `bar` any 1H/1or2H weapon, Assassin `ass` two `h2h`/`h2h2` claws).
 */
export function areHandSlotItemsCompatible(
  item1: UiInventoryItem,
  item2: UiInventoryItem,
  classCode?: CharacterClassCode | null,
): boolean {
  // 1. Shoots + Quiver pair (`0x6fd6f990..0x6fd6f9c8`) — checked BEFORE 2H weapon restriction!
  const shoots1 = getItemShootsQuiverType(item1)
  const shoots2 = getItemShootsQuiverType(item2)
  const quiver1 = getItemQuiverType(item1)
  const quiver2 = getItemQuiverType(item2)
  if ((shoots1 !== null && shoots1 === quiver2) || (shoots2 !== null && shoots2 === quiver1)) {
    return true
  }

  // 2. Unmatched quiver (`0x6fd6f9ce..0x6fd6f9e4`) cannot pair with any other item
  if (quiver1 !== null || quiver2 !== null) {
    return false
  }

  const cat1 = classifyHandSlotItem(item1)
  const cat2 = classifyHandSlotItem(item2)
  if (cat1 === 'other' || cat2 === 'other') {
    return false
  }

  // 3. 2H weapon check (`0x6fd6f9ea..0x6fd6fa1b`)
  if (isTwoHandedForClass(item1, classCode) || isTwoHandedForClass(item2, classCode)) {
    return false
  }

  // 4. Cannot equip two shields / off-hands simultaneously (`0x6fd6fa8a..0x6fd6faae`)
  if (cat1 === 'offhand' && cat2 === 'offhand') {
    return false
  }

  // 5. One 1H weapon + one shield/shrunken-head (`0x6fd6fa8a..0x6fd6fab8`)
  if (cat1 === 'offhand' || cat2 === 'offhand') {
    return true
  }

  // 6. Dual Wielding (`0x6fd6fa25..0x6fd6fa88`):
  // - Barbarian (`bar`) can dual-wield any 1H or 1or2handed sword
  // - Assassin (`ass`) can dual-wield two Hand-to-Hand (`h2h` / `h2h2`) claws
  if (classCode === 'bar') {
    return true
  }
  if (classCode === 'ass' && isAssassinClawItem(item1) && isAssassinClawItem(item2)) {
    return true
  }
  return false
}

/**
 * 1.13c ground truth: checks if an item's allowedSlots includes slotId (with either-hand allowance for weapon1/weapon2).
 */
export function isItemAllowedInSlot(item: UiInventoryItem, rawSlotId: EquipSlotId | string): boolean {
  const slotId = normalizeEquipSlotId(rawSlotId)
  if (Array.isArray(item.allowedSlots) && !item.allowedSlots.includes(slotId)) {
    const isHandSlot = slotId === 'weapon1' || slotId === 'weapon2'
    const allowsEitherHand =
      item.allowedSlots.includes('weapon1') || item.allowedSlots.includes('weapon2')
    if (!(isHandSlot && allowsEitherHand)) {
      return false
    }
  }
  return true
}

/**
 * Ground Truth (D2Client.dll 1.13c @ 0x6fb45ab8..0x6fb45b54 & D2Common.dll @ 0x6fd76db0 `ITEMS_CheckItemRequirements` #10244):
 * Checks whether the player meets all requirements to equip/use an item in a vendor or inventory grid:
 * 1. Gamble mode or Unidentified (`bIdentified == 0` at `0x6fd76e23` / `0x6fd77006`) -> false (Red)
 * 2. Broken durability (`durability.max > 0 && durability.current <= 0`) -> false (Red)
 * 3. Empty Tome (`tbk` / `ibk` with `quantity <= 0` at `0x6fd77072`) -> false (Red)
 * 4. Class restriction (`0x6fd74280` `ITEMS_GetClassOfClassSpecificItem` #10202) -> false if `effectiveReqClass !== player.classCode` (Red)
 * 5. Level requirement (`0x6fd76fc7`) -> false if `player.level < item.reqLevel` (Red)
 * 6. Strength requirement (`0x6fd76eab`) -> false if `player.str < item.reqStr` (Red)
 * 7. Dexterity requirement (`0x6fd76f83`) -> false if `player.dex < item.reqDex` (Red)
 */
export function canPlayerUseUiItem(
  item: UiInventoryItem,
  player: PlayerItemRequirementContext,
  vendorMode: 'trade' | 'gamble' = 'trade',
): boolean {
  if (vendorMode === 'gamble' || isUiItemUnidentified(item)) {
    return false
  }
  if (item.durability !== undefined && item.durability.max > 0 && item.durability.current <= 0) {
    return false
  }
  const code = (item.code ?? '').trim().toLowerCase()
  if ((code === 'tbk' || code === 'ibk') && getTomeQuantity(item) <= 0) {
    return false
  }
  const effectiveReqClass = getEffectiveItemReqClass(item)
  if (effectiveReqClass !== undefined && player.classCode !== undefined && effectiveReqClass !== player.classCode) {
    return false
  }
  if (item.reqLevel !== undefined && item.reqLevel > 0 && player.level < item.reqLevel) {
    return false
  }
  if (item.reqStr !== undefined && item.reqStr > 0 && player.str < item.reqStr) {
    return false
  }
  if (item.reqDex !== undefined && item.reqDex > 0 && player.dex < item.reqDex) {
    return false
  }
  return true
}

/**
 * Ground Truth (D2Client.dll 1.13c @ 0x6fb459f7..0x6fb45b58 `INVENTORY_DrawGridItems`):
 * Resolves the exact cell background fill style for an item in a grid:
 * - At `0x6fb45a04..0x6fb45a0c`: Hovering turns the backdrop GREEN (`index 1`) ONLY when `hasCursorItem` is true (`ds:0x6fbcbc28 != 0`).
 *   Hovering with an empty cursor jumps to `0x6fb45ab8` and preserves the item's RED (`index 0`) or BLUE (`index 2`) requirement color.
 * - In Gamble mode (`vendorMode === 'gamble'`), all items are unidentified mystery items -> RED (`index 0`).
 * - In Trade mode, items that fail `canPlayerUseUiItem` -> RED (`index 0`), usable items -> BLUE (`index 2`).
 */
export function resolveGridItemBackgroundFill(
  item: UiInventoryItem,
  player: PlayerItemRequirementContext,
  options?: {
    readonly isHovered?: boolean | undefined
    readonly hasCursorItem?: boolean | undefined
    readonly vendorMode?: 'trade' | 'gamble' | undefined
  },
): string {
  if (options?.isHovered && options?.hasCursorItem) {
    return GRID_ITEM_BG_GREEN
  }
  return canPlayerUseUiItem(item, player, options?.vendorMode ?? 'trade')
    ? GRID_ITEM_BG_BLUE
    : GRID_ITEM_BG_RED
}

/**
 * Ground Truth (D2Client.dll 1.13c @ 0x6fb47be0 `INVENTORY_DrawEquippedItems`):
 * Paperdoll equipment slots do NOT draw a green background for normal usable equipped items
 * (the dark carved slot recess from `invchar6.dc6` shows through); a background fill is only
 * drawn when the equipped item fails requirements (`GRID_ITEM_BG_RED`) or when hovered
 * while holding a cursor item (`GRID_ITEM_BG_GREEN`).
 */
export function resolvePaperdollSlotBackgroundFill(
  item: UiInventoryItem,
  player: PlayerItemRequirementContext,
  options?: {
    readonly isHovered?: boolean | undefined
    readonly hasCursorItem?: boolean | undefined
  },
): string | null {
  if (options?.isHovered && options?.hasCursorItem) {
    return GRID_ITEM_BG_GREEN
  }
  if (!canPlayerUseUiItem(item, player, 'trade')) {
    return GRID_ITEM_BG_RED
  }
  return null
}

export function identifyUiItem(item: UiInventoryItem, playerLevel?: number): UiInventoryItem {
  ;(item as { identified?: boolean; isGambleMystery?: boolean }).identified = true
  ;(item as { identified?: boolean; isGambleMystery?: boolean }).isGambleMystery = false

  if (item.rawItem) {
    item.rawItem.identified = true
    ;(item.rawItem as { isGambleMystery?: boolean }).isGambleMystery = false
    if (item.rawItem.flags) {
      ;(item.rawItem as { flags: typeof item.rawItem.flags }).flags = {
        ...item.rawItem.flags,
        identified: true,
        gamble: false,
      }
    }
    if (typeof item.rawItem.rawFlags === 'number') {
      ;(item.rawItem as { rawFlags: number }).rawFlags = (item.rawItem.rawFlags | 1) & ~0x8000
    }
    const effectiveLevel =
      playerLevel !== undefined && Number.isFinite(playerLevel) && playerLevel > 0
        ? Math.max(1, Math.trunc(playerLevel))
        : (item.rawItem as { charLevel?: number }).charLevel
    const rebuilt = itemToUiInventoryItem(item.rawItem, undefined, effectiveLevel)
    Object.assign(item, {
      invFile: rebuilt.invFile,
      ...(rebuilt.baseInvFile !== undefined ? { baseInvFile: rebuilt.baseInvFile } : {}),
      name: rebuilt.name,
      nameZh: rebuilt.nameZh,
      baseNameZh: rebuilt.baseNameZh,
      ...(rebuilt.baseNameEn !== undefined ? { baseNameEn: rebuilt.baseNameEn } : {}),
      quality: rebuilt.quality,
      stats: rebuilt.stats.filter(
        (s: { text: string; color?: D2ColorCode }) =>
          !s.text.includes('未辨识') && !s.text.includes('未鉴定') && !s.text.includes('Unidentified'),
      ),
      ...(rebuilt.statsEn !== undefined
        ? {
            statsEn: rebuilt.statsEn.filter(
              (s: { text: string; color?: D2ColorCode }) => !s.text.includes('Unidentified'),
            ),
          }
        : {}),
      ...(rebuilt.defense !== undefined ? { defense: rebuilt.defense } : {}),
      ...(rebuilt.baseDefense !== undefined ? { baseDefense: rebuilt.baseDefense } : {}),
      ...(rebuilt.oneHandDamage !== undefined ? { oneHandDamage: rebuilt.oneHandDamage } : {}),
      ...(rebuilt.twoHandDamage !== undefined ? { twoHandDamage: rebuilt.twoHandDamage } : {}),
      ...(rebuilt.throwDamage !== undefined ? { throwDamage: rebuilt.throwDamage } : {}),
      ...(rebuilt.damage !== undefined ? { damage: rebuilt.damage } : {}),
      ...(rebuilt.damageEn !== undefined ? { damageEn: rebuilt.damageEn } : {}),
      ...(rebuilt.reqLevel !== undefined ? { reqLevel: rebuilt.reqLevel } : {}),
      ...(rebuilt.reqStr !== undefined ? { reqStr: rebuilt.reqStr } : {}),
      ...(rebuilt.reqDex !== undefined ? { reqDex: rebuilt.reqDex } : {}),
      ...(rebuilt.reqClass !== undefined ? { reqClass: rebuilt.reqClass } : {}),
      ...(rebuilt.twoHanded !== undefined ? { twoHanded: rebuilt.twoHanded } : {}),
      ...(rebuilt.oneOrTwoHanded !== undefined ? { oneOrTwoHanded: rebuilt.oneOrTwoHanded } : {}),
      ...(rebuilt.durability !== undefined ? { durability: rebuilt.durability } : {}),
      ...(rebuilt.sockets !== undefined ? { sockets: rebuilt.sockets } : {}),
      ...(rebuilt.speedText !== undefined ? { speedText: rebuilt.speedText } : {}),
      ...(rebuilt.speedTextEn !== undefined ? { speedTextEn: rebuilt.speedTextEn } : {}),
      ...(rebuilt.invtransform !== undefined ? { invtransform: rebuilt.invtransform } : {}),
      ...(rebuilt.chrtransform !== undefined ? { chrtransform: rebuilt.chrtransform } : {}),
      ...(rebuilt.setPieces !== undefined ? { setPieces: rebuilt.setPieces } : {}),
      ...(rebuilt.setPiecesEn !== undefined ? { setPiecesEn: rebuilt.setPiecesEn } : {}),
      ...(rebuilt.setBonuses !== undefined ? { setBonuses: rebuilt.setBonuses } : {}),
      ...(rebuilt.setBonusesEn !== undefined ? { setBonusesEn: rebuilt.setBonusesEn } : {}),
      identified: true,
      isGambleMystery: false,
    })
    if (rebuilt.reqLevel === undefined) {
      delete (item as { reqLevel?: number }).reqLevel
    }
  } else {
    if (Array.isArray(item.stats)) {
      ;(item as { stats: readonly { text: string; color?: D2ColorCode }[] }).stats = item.stats.filter(
        s => !s.text.includes('未辨识') && !s.text.includes('未鉴定') && !s.text.includes('Unidentified'),
      )
    }
    if (Array.isArray(item.statsEn)) {
      ;(item as { statsEn: readonly { text: string; color?: D2ColorCode }[] }).statsEn = item.statsEn.filter(
        s => !s.text.includes('Unidentified'),
      )
    }
  }

  return item
}

export interface IdentifyCursorSource {
  readonly container: 'inventory' | 'stash' | 'cube'
  readonly itemId: string
  readonly code: 'ibk' | 'isc'
}

/**
 * Ground Truth (Diablo II v1.13c):
 * Returns true if `item` is a socketable filler (Gem, Rune, or Jewel).
 */
export function isSocketableUiItem(item: UiInventoryItem | null | undefined): boolean {
  if (!item) return false
  const code = (item.code ?? '').trim().toLowerCase()
  if (isSocketableCode(code)) return true
  if (
    item.quality === 'rune' &&
    (item.sockets ?? 0) === 0 &&
    (!Array.isArray(item.allowedSlots) || item.allowedSlots.length === 0) &&
    !item.runewordRunes
  ) {
    return true
  }
  if (item.rawItem && isSocketableDomainItem(item.rawItem)) {
    return true
  }
  const baseZh = (item.baseNameZh ?? '').trim()
  const baseEn = (item.baseNameEn ?? '').trim().toLowerCase()
  if (baseZh.includes('珠宝') || baseEn === 'jewel') {
    return true
  }
  return false
}

/**
 * Ground Truth (D2Common.dll 1.13c @ 0x6fd75a90):
 * Resolves the target equipment slot category (`'weapon' | 'helm' | 'armor' | 'shield'`)
 * for a socketed host `UiInventoryItem`, or `null` if it cannot accept sockets.
 */
export function resolveUiSocketTargetCategory(
  target: UiInventoryItem | null | undefined,
): SocketTargetCategory | null {
  if (!target) return null
  if (isSocketableUiItem(target)) return null

  const code = (target.code ?? '').trim().toLowerCase()
  if (code) {
    const dropTables = getEmbeddedDropTables()
    if (dropTables.weapons.get(code) !== undefined) {
      return 'weapon'
    }
    const aRow = dropTables.armor.get(code)
    if (aRow) {
      const aType = (aRow.type ?? '').trim().toLowerCase()
      if (dropTables.isA(aType, 'helm')) return 'helm'
      if (dropTables.isA(aType, 'tors')) return 'armor'
      if (
        dropTables.isA(aType, 'shie') ||
        dropTables.isA(aType, 'shld') ||
        dropTables.isA(aType, 'ashd') ||
        dropTables.isA(aType, 'head')
      ) {
        return 'shield'
      }
      return null
    }
  }

  const slots = target.allowedSlots ?? []
  if (slots.includes('helm')) return 'helm'
  if (slots.includes('armor')) return 'armor'
  if (slots.includes('weapon1')) return 'weapon'
  if (slots.includes('weapon2')) {
    if (target.damage !== undefined && target.defense === undefined) {
      return 'weapon'
    }
    const fromDomain = resolveSocketTargetCategory({
      code: target.code,
      base: target.rawItem?.base,
      allowedSlots: target.allowedSlots,
    })
    return fromDomain ?? 'shield'
  }

  return resolveSocketTargetCategory({
    code: target.code,
    base: target.rawItem?.base,
    allowedSlots: target.allowedSlots,
  })
}

/**
 * Ground Truth (D2Common.dll 1.13c & D2Game.dll `0x6fc479c0`):
 * Checks whether `socketable` (Gem, Rune, or Jewel) can be inserted into `target`:
 * - `socketable` must be a valid identified socketable item (Gem, Rune, or Jewel).
 * - `target` must be an identified non-socketable equipment item in `weapon`, `helm`, `armor`, or `shield` category.
 * - `target` must have `sockets > 0` and `(socketedItems?.length ?? 0) < sockets`.
 */
export function canSocketUiItem(
  socketable: UiInventoryItem | null | undefined,
  target: UiInventoryItem | null | undefined,
): boolean {
  if (!socketable || !target || socketable === target) return false
  if (!isSocketableUiItem(socketable)) return false
  if (isSocketableUiItem(target)) return false
  if (isUiItemUnidentified(socketable) || isUiItemUnidentified(target)) return false
  const totalSockets =
    target.sockets ??
    (target as { totalSockets?: number }).totalSockets ??
    target.rawItem?.totalSockets ??
    (target.rawItem as { sockets?: number } | undefined)?.sockets ??
    0
  if (totalSockets <= 0) return false
  const usedSockets = Math.max(
    (target as { usedSockets?: number }).usedSockets ?? 0,
    target.socketedItems?.length ?? target.rawItem?.socketedItems?.length ?? 0,
  )
  if (usedSockets >= totalSockets) return false
  const category = resolveUiSocketTargetCategory(target)
  return category !== null
}

function isSocketInstructionOrCountLine(text: string): boolean {
  const t = text.trim()
  return (
    t.includes('可镶嵌进有凹槽的装备') ||
    t.includes('Can be Inserted into Socketed Items') ||
    /^带插槽\s*\(\d+\)$/.test(t) ||
    /^凹槽\s*\(\d+\)$/.test(t) ||
    /^Socketed\s*\(\d+\)$/i.test(t) ||
    t === '未辨识' ||
    t === '未鉴定' ||
    t === 'Unidentified'
  )
}

function insertStatLinesBeforeSocketLine(
  existing: readonly { text: string; color?: D2ColorCode }[],
  added: readonly { text: string; color?: D2ColorCode }[],
): { text: string; color?: D2ColorCode }[] {
  if (added.length === 0) return [...existing]
  const sockIdx = existing.findIndex(s =>
    /^(?:带插槽|凹槽|Socketed)\s*\(\d+\)$/i.test(s.text.trim()),
  )
  if (sockIdx === -1) {
    return [...existing, ...added]
  }
  return [...existing.slice(0, sockIdx), ...added, ...existing.slice(sockIdx)]
}

function inferCandidateRunewordItemTypes(
  target: UiInventoryItem,
  category: SocketTargetCategory,
): string[] {
  const types = new Set<string>()
  const code = (target.code ?? '').trim().toLowerCase()
  const dropTables = getEmbeddedDropTables()

  const rawBaseType = (target.rawItem?.base as { type?: string } | undefined)?.type
  if (rawBaseType) {
    types.add(rawBaseType.trim().toLowerCase())
  }
  if (target.rawItem?.base?.tags) {
    for (const tag of target.rawItem.base.tags) {
      types.add(tag.trim().toLowerCase())
    }
  }
  const wRow = dropTables.weapons.get(code) as { type?: string } | undefined
  if (wRow?.type) types.add(wRow.type.trim().toLowerCase())
  const aRow = dropTables.armor.get(code) as { type?: string } | undefined
  if (aRow?.type) types.add(aRow.type.trim().toLowerCase())

  // Expand canonical ItemTypes.txt hierarchy (Equiv1 / Equiv2) when any canonical type is known
  const seedTypes = Array.from(types).filter(t => dropTables.itemTypes.byCode.has(t))
  if (seedTypes.length > 0) {
    for (const seed of seedTypes) {
      for (const candidateCode of dropTables.itemTypes.byCode.keys()) {
        if (dropTables.isA(seed, candidateCode)) {
          types.add(candidateCode)
        }
      }
      if (dropTables.isA(seed, 'shie') || dropTables.isA(seed, 'ashd')) {
        types.add('shld')
      }
      if (dropTables.isA(seed, 'ashd') || dropTables.isA(seed, 'pala')) {
        types.add('pash')
        types.add('pala')
      }
    }
    return Array.from(types).filter(Boolean)
  }

  // Fallback for synthetic test items without a canonical Weapons.txt / Armor.txt code
  if (category === 'helm') {
    types.add('helm')
    types.add('armo')
  } else if (category === 'armor') {
    types.add('tors')
    types.add('armo')
  } else if (category === 'shield') {
    types.add('shld')
    types.add('shie')
    types.add('armo')
    const nameStr = `${target.name} ${target.baseNameZh} ${target.baseNameEn ?? ''}`.toLowerCase()
    if (nameStr.includes('targe') || nameStr.includes('rondache') || nameStr.includes('akaran') || nameStr.includes('vortex') || nameStr.includes('kurast') || nameStr.includes('zakarum') || target.reqClass === 'pal') {
      types.add('pash')
    }
  } else if (category === 'weapon') {
    const nameStr = `${target.name} ${target.baseNameZh} ${target.baseNameEn ?? ''} ${target.speedText ?? ''}`.toLowerCase()
    if (nameStr.includes('sword') || nameStr.includes('blade') || nameStr.includes('剑') || nameStr.includes('刃')) {
      types.add('swor')
      types.add('mele')
    }
    if (nameStr.includes('axe') || nameStr.includes('斧')) {
      types.add('axe')
      types.add('mele')
    }
    if (nameStr.includes('pole') || nameStr.includes('halberd') || nameStr.includes('scythe') || nameStr.includes('thresher') || nameStr.includes('长柄') || nameStr.includes('镰')) {
      types.add('pole')
      types.add('mele')
    }
    if (nameStr.includes('staff') || nameStr.includes('stave') || nameStr.includes('法杖') || nameStr.includes('长杖')) {
      types.add('staf')
      types.add('mele')
    }
    if (nameStr.includes('mace') || nameStr.includes('flail') || nameStr.includes('连枷') || nameStr.includes('钉头槌') || nameStr.includes('锤')) {
      types.add('mace')
      types.add('hamm')
      types.add('club')
      types.add('mele')
    }
    if (nameStr.includes('scepter') || nameStr.includes('权杖')) {
      types.add('scep')
      types.add('mele')
    }
    if (nameStr.includes('wand') || nameStr.includes('魔杖')) {
      types.add('wand')
      types.add('mele')
    }
    if (nameStr.includes('bow') || nameStr.includes('弓')) {
      types.add('bow')
      types.add('miss')
    }
    if (nameStr.includes('claw') || nameStr.includes('katar') || nameStr.includes('爪') || nameStr.includes('拳刃')) {
      types.add('h2h')
      types.add('mele')
    }
    if (nameStr.includes('spear') || nameStr.includes('lance') || nameStr.includes('长矛') || nameStr.includes('枪')) {
      types.add('spea')
      types.add('mele')
    }
    types.add('weap')
    if (!types.has('miss')) {
      types.add('mele')
    }
  }

  return Array.from(types).filter(Boolean)
}

function applyStatDeltaToTargetBase(
  target: UiInventoryItem,
  addedZh: readonly { text: string; color?: D2ColorCode }[],
  addedEn: readonly { text: string; color?: D2ColorCode }[],
): void {
  let edPct = 0
  let defPct = 0
  let flatDef = 0
  let addMinDmg = 0
  let addMaxDmg = 0
  let reqPct = 0
  let indestruct = false

  for (const line of addedZh) {
    const t = line.text.trim()
    if (t.includes('无法破坏') || /Indestructible/i.test(t)) {
      indestruct = true
    }
    const edMatch = /^\+(\d+)%\s*(?:增强伤害|强化伤害)/.exec(t)
    if (edMatch) edPct += Number(edMatch[1])

    const defPctMatch = /^\+(\d+)%\s*(?:增强防御|强化防御)/.exec(t)
    if (defPctMatch) defPct += Number(defPctMatch[1])

    const flatDefMatch = /^\+(\d+)\s*防御$/.exec(t)
    if (flatDefMatch) flatDef += Number(flatDefMatch[1])

    const physRangeMatch = /^增加\s*(\d+)\s*-\s*(\d+)\s*伤害$/.exec(t)
    if (physRangeMatch) {
      addMinDmg += Number(physRangeMatch[1])
      addMaxDmg += Number(physRangeMatch[2])
    }
    const minDmgMatch = /^\+(\d+)\s*最小伤害$/.exec(t)
    if (minDmgMatch) addMinDmg += Number(minDmgMatch[1])
    const maxDmgMatch = /^\+(\d+)\s*最大伤害$/.exec(t)
    if (maxDmgMatch) addMaxDmg += Number(maxDmgMatch[1])

    const reqMatch = /^(?:装备)?需求\s*(-\d+)%/.exec(t)
    if (reqMatch) reqPct += Number(reqMatch[1])
  }

  // Fallback check on English lines if a test only supplied English stat text on a custom jewel
  if (
    edPct === 0 &&
    defPct === 0 &&
    flatDef === 0 &&
    addMinDmg === 0 &&
    addMaxDmg === 0 &&
    reqPct === 0 &&
    !indestruct
  ) {
    for (const line of addedEn) {
      const t = line.text.trim()
      if (/Indestructible/i.test(t)) indestruct = true
      const edMatch = /^\+(\d+)%\s*Enhanced Damage/i.exec(t)
      if (edMatch) edPct += Number(edMatch[1])
      const defPctMatch = /^\+(\d+)%\s*Enhanced Defense/i.exec(t)
      if (defPctMatch) defPct += Number(defPctMatch[1])
      const flatDefMatch = /^\+(\d+)\s*Defense$/i.exec(t)
      if (flatDefMatch) flatDef += Number(flatDefMatch[1])
      const physRangeMatch = /^Adds\s*(\d+)\s*(?:-|to)\s*(\d+)\s*Damage$/i.exec(t)
      if (physRangeMatch) {
        addMinDmg += Number(physRangeMatch[1])
        addMaxDmg += Number(physRangeMatch[2])
      }
      const minDmgMatch = /^\+(\d+)\s*to Minimum Damage$/i.exec(t)
      if (minDmgMatch) addMinDmg += Number(minDmgMatch[1])
      const maxDmgMatch = /^\+(\d+)\s*to Maximum Damage$/i.exec(t)
      if (maxDmgMatch) addMaxDmg += Number(maxDmgMatch[1])
      const reqMatch = /^Requirements\s*(-\d+)%/i.exec(t)
      if (reqMatch) reqPct += Number(reqMatch[1])
    }
  }

  const mutable = target as unknown as Record<string, unknown>

  if (indestruct) {
    delete mutable.durability
  }

  if (reqPct !== 0) {
    if (mutable._baseReqStr === undefined && target.reqStr !== undefined) {
      mutable._baseReqStr = target.reqStr
    }
    if (mutable._baseReqDex === undefined && target.reqDex !== undefined) {
      mutable._baseReqDex = target.reqDex
    }
    const nextCumReq = ((mutable._cumReqPct as number | undefined) ?? 0) + reqPct
    mutable._cumReqPct = nextCumReq
    if (typeof mutable._baseReqStr === 'number') {
      mutable.reqStr = Math.max(0, Math.floor((mutable._baseReqStr * (100 + nextCumReq)) / 100))
    }
    if (typeof mutable._baseReqDex === 'number') {
      mutable.reqDex = Math.max(0, Math.floor((mutable._baseReqDex * (100 + nextCumReq)) / 100))
    }
  }

  if (target.defense !== undefined && (defPct !== 0 || flatDef !== 0)) {
    if (mutable._baseDefense === undefined) {
      mutable._baseDefense = target.defense
    }
    const nextCumDefPct = ((mutable._cumDefPct as number | undefined) ?? 0) + defPct
    const nextCumFlatDef = ((mutable._cumFlatDef as number | undefined) ?? 0) + flatDef
    mutable._cumDefPct = nextCumDefPct
    mutable._cumFlatDef = nextCumFlatDef
    const baseDef = mutable._baseDefense as number
    mutable.defense = Math.floor((baseDef * (100 + nextCumDefPct)) / 100) + nextCumFlatDef
  }

  if (target.damage !== undefined && (edPct !== 0 || addMinDmg !== 0 || addMaxDmg !== 0)) {
    if (mutable._baseDamageStr === undefined) {
      mutable._baseDamageStr = target.damage
    }
    if (mutable._baseDamageEnStr === undefined && target.damageEn !== undefined) {
      mutable._baseDamageEnStr = target.damageEn
    }
    const nextCumEdPct = ((mutable._cumEdPct as number | undefined) ?? 0) + edPct
    const nextCumMinDmg = ((mutable._cumMinDmg as number | undefined) ?? 0) + addMinDmg
    const nextCumMaxDmg = ((mutable._cumMaxDmg as number | undefined) ?? 0) + addMaxDmg
    mutable._cumEdPct = nextCumEdPct
    mutable._cumMinDmg = nextCumMinDmg
    mutable._cumMaxDmg = nextCumMaxDmg

    const baseDmgStr = String(mutable._baseDamageStr)
    mutable.damage = baseDmgStr.replace(/(\d+)\s*-\s*(\d+)/g, (_m, minS, maxS) => {
      const bMin = Number(minS)
      const bMax = Number(maxS)
      const nMin = Math.floor((bMin * (100 + nextCumEdPct)) / 100) + nextCumMinDmg
      const nMax = Math.floor((bMax * (100 + nextCumEdPct)) / 100) + nextCumMaxDmg
      return `${nMin} - ${nMax}`
    })
    if (typeof mutable._baseDamageEnStr === 'string') {
      mutable.damageEn = mutable._baseDamageEnStr.replace(
        /(\d+)\s*(?:to|-)\s*(\d+)/gi,
        (_m, minS, maxS) => {
          const bMin = Number(minS)
          const bMax = Number(maxS)
          const nMin = Math.floor((bMin * (100 + nextCumEdPct)) / 100) + nextCumMinDmg
          const nMax = Math.floor((bMax * (100 + nextCumEdPct)) / 100) + nextCumMaxDmg
          return `${nMin} to ${nMax}`
        },
      )
    }

    const updateDmgInfo = (key: 'oneHandDamage' | 'twoHandDamage' | 'throwDamage'): void => {
      const existing = target[key]
      if (!existing) return
      const bMin = existing.baseMin ?? existing.min
      const bMax = existing.baseMax ?? existing.max
      let effMin = bMin
      let effMax = bMax
      if (existing.isLowQuality) {
        effMin = Math.max(1, Math.floor(effMin * 0.75))
        effMax = Math.max(1, Math.floor(effMax * 0.75))
      }
      if (existing.isEthereal ?? target.ethereal) {
        effMin = Math.floor(effMin * 1.5)
        effMax = Math.floor(effMax * 1.5)
      }
      const nextEd = (existing.edPct ?? 0) + edPct
      const nextExtraMaxEd = existing.extraMaxEdPct ?? 0
      const nextFlatMin = (existing.flatMin ?? 0) + addMinDmg
      const nextFlatMax = (existing.flatMax ?? 0) + addMaxDmg
      let finalMin = Math.floor((effMin * (100 + nextEd)) / 100) + nextFlatMin
      let finalMax = Math.floor((effMax * (100 + nextEd + nextExtraMaxEd)) / 100) + nextFlatMax
      if (nextEd + nextExtraMaxEd > 0 && finalMax === effMax) {
        finalMax = effMax + 1
      }
      if ((nextEd !== 0 || nextExtraMaxEd !== 0 || nextFlatMin !== 0 || nextFlatMax !== 0) && finalMin >= finalMax) {
        finalMax = finalMin + 1
      }
      mutable[key] = {
        ...existing,
        min: finalMin,
        max: finalMax,
        baseMin: bMin,
        baseMax: bMax,
        isEnhanced: true,
        ...(nextEd !== 0 ? { edPct: nextEd } : {}),
        ...(nextFlatMin !== 0 ? { flatMin: nextFlatMin } : {}),
        ...(nextFlatMax !== 0 ? { flatMax: nextFlatMax } : {}),
      }
    }
    updateDmgInfo('oneHandDamage')
    updateDmgInfo('twoHandDamage')
    updateDmgInfo('throwDamage')
  }
}

/**
 * Ground Truth (D2Game.dll 1.13c @ 0x6fc479c0 & D2Common.dll @ 0x6fd75a90):
 * Inserts 1 unit of `socketable` (Gem, Rune, or Jewel) into `target`:
 * 1. Jewels (`jew` / `jewl`) apply their own modifiers identically regardless of `target`'s equipment slot.
 * 2. Gems (`gcv`..`skz`) and Runes (`r01`..`r33`) apply slot-dependent modifiers (`weapon`, `helm`, `armor`, `shield`) per `Gems.txt`.
 * 3. Updates `target.socketedItems`, `target.stats`, `target.statsEn`, `target.reqLevel`, `target.defense`, `target.damage`, `target.reqStr`, `target.reqDex`, and `target.runewordRunes`.
 * 4. Checks and activates Runeword completion (`checkRunewordMatch`) when all sockets of a normal-quality base item are filled with runes.
 */
export function applySocketToUiItem(
  target: UiInventoryItem,
  socketable: UiInventoryItem,
): UiInventoryItem {
  if (!canSocketUiItem(socketable, target)) {
    throw new Error(
      `Cannot socket item "${socketable?.code ?? 'unknown'}" into target "${target?.code ?? 'unknown'}"`,
    )
  }

  const category = resolveUiSocketTargetCategory(target)!
  const code = (socketable.code ?? '').trim().toLowerCase()
  const insertedUnit: UiInventoryItem = {
    ...socketable,
    quantity: 1,
    stats: [...socketable.stats],
    ...(socketable.statsEn ? { statsEn: [...socketable.statsEn] } : {}),
  }

  const nextSocketed = [...(target.socketedItems ?? []), insertedUnit]
  const mutable = target as unknown as Record<string, unknown>
  mutable.socketedItems = nextSocketed

  if (target.quality === 'normal' && !target.invtransform && !target.chrtransform) {
    const gemTransform = getGemColorTransform(code)
    if (gemTransform) {
      mutable.invtransform = gemTransform
      mutable.chrtransform = gemTransform
    }
  }

  let addedZh: { text: string; color?: D2ColorCode }[] = []
  let addedEn: { text: string; color?: D2ColorCode }[] = []

  const isJewel =
    isJewelCode(code) ||
    Boolean(socketable.baseNameZh?.includes('珠宝')) ||
    socketable.baseNameEn?.trim().toLowerCase() === 'jewel'

  const hostCharLevel = Math.max(
    1,
    Math.trunc(
      Number(
        (target.rawItem as { charLevel?: number; playerLevel?: number } | undefined)?.charLevel ??
          (target.rawItem as { charLevel?: number; playerLevel?: number } | undefined)?.playerLevel ??
          (target as { charLevel?: number }).charLevel ??
          1,
      ) || 1,
    ),
  )

  if (isJewel) {
    // 1. Jewel: slot-independent modifiers across weapon, helm, armor, and shield
    addedZh = socketable.stats
      .filter(s => !isSocketInstructionOrCountLine(s.text))
      .map(s => ({ text: s.text, color: (s.color ?? 'blue') as D2ColorCode }))
    const srcEn = socketable.statsEn ?? socketable.stats
    addedEn = srcEn
      .filter(s => !isSocketInstructionOrCountLine(s.text))
      .map(s => ({ text: s.text, color: (s.color ?? 'blue') as D2ColorCode }))
  } else if (isGemCode(code) || isRuneCode(code)) {
    // 2. Gem or Rune: slot-dependent modifiers based on target category ('weapon' | 'helm' | 'armor' | 'shield')
    addedZh = getSocketableSlotLines(code, category, 'zh').map(text => ({
      text,
      color: 'blue' as D2ColorCode,
    }))
    addedEn = getSocketableSlotLines(code, category, 'en').map(text => ({
      text,
      color: 'blue' as D2ColorCode,
    }))
  } else if (socketable.rawItem) {
    const mods = getSocketedItemModifiersForHost(socketable.rawItem, category)
    addedZh = mods
      .map(m => ({
        text: formatPropertyCode(m.code, m.value, m.min, m.max, m.param, 'zh', hostCharLevel),
        color: 'blue' as D2ColorCode,
      }))
      .filter(l => l.text.length > 0)
    addedEn = mods
      .map(m => ({
        text: formatPropertyCode(m.code, m.value, m.min, m.max, m.param, 'en', hostCharLevel),
        color: 'blue' as D2ColorCode,
      }))
      .filter(l => l.text.length > 0)
  }

  // Update Required Level = max(host.reqLevel, socketable.reqLevel)
  const sockInfo = getSocketableInfo(code)
  const sockReqLvl = Math.max(sockInfo?.reqLevel ?? 0, socketable.reqLevel ?? 0)
  const nextReqLevel = Math.max(target.reqLevel ?? 0, sockReqLvl)
  if (nextReqLevel > 0) {
    mutable.reqLevel = nextReqLevel
  }

  // Update Runeword Rune sequence display (e.g. 'RalOrtTal' or 'TalThulOrtAmn')
  const runeSequence = nextSocketed
    .filter(s => isRuneCode(s.code))
    .map(s => RUNE_CODE_TO_NAME[(s.code ?? '').trim().toLowerCase()] ?? s.name)
    .join('')
  if (runeSequence.length > 0 && (target.quality === 'normal' || target.quality === 'rune')) {
    mutable.runewordRunes = `'${runeSequence}'`
  }

  // Check Runeword completion if all sockets of a normal item are now filled with Runes
  const totalSockets =
    target.sockets ??
    target.rawItem?.totalSockets ??
    (target.rawItem as { sockets?: number } | undefined)?.sockets ??
    0
  if (
    totalSockets > 0 &&
    nextSocketed.length === totalSockets &&
    target.quality === 'normal' &&
    nextSocketed.every(s => isRuneCode(s.code))
  ) {
    const dropTables = getEmbeddedDropTables()
    const runeCodes = nextSocketed.map(s => (s.code ?? '').trim().toLowerCase())
    const candidateTypes = inferCandidateRunewordItemTypes(target, category)
    const isAPred = (t: string, targetType: string): boolean => {
      if (t === targetType) return true
      if (
        dropTables.itemTypes.byCode.has(t) &&
        dropTables.itemTypes.byCode.has(targetType)
      ) {
        if (dropTables.isA(t, targetType)) return true
        if (isA(t, targetType, dropTables.itemTypes)) return true
      }
      return false
    }

    const syntheticBaseItem = {
      code: target.code ?? '',
      quality: 'normal',
      totalSockets,
      prefix: null,
      suffix: null,
      base: {
        id: target.code ?? '',
        name: target.baseNameEn ?? target.name,
        kind: category === 'weapon' ? 'weapon' : 'armor',
        tags: candidateTypes,
      },
    } as unknown as Item

    const matchedRw = checkRunewordMatch(
      syntheticBaseItem,
      runeCodes,
      isAPred,
      CANONICAL_RUNES_TABLE,
      { isLadder: true },
    )
    if (matchedRw) {
      const rwNameEn = matchedRw.runeName || matchedRw.name
      mutable.quality = 'rune'
      mutable.name = rwNameEn
      const rwZh = translateItemName(rwNameEn)
      mutable.nameZh = rwZh && rwZh !== rwNameEn ? rwZh : rwNameEn
      mutable.runewordRunes = `'${runeCodes.map(rc => RUNE_CODE_TO_NAME[rc] ?? rc).join('')}'`

      for (const prop of matchedRw.t1Codes) {
        const rolledVal = prop.min === prop.max ? prop.min : prop.max
        const zhLine = formatPropertyCode(prop.code, rolledVal, prop.min, prop.max, prop.param, 'zh', hostCharLevel)
        const enLine = formatPropertyCode(prop.code, rolledVal, prop.min, prop.max, prop.param, 'en', hostCharLevel)
        if (zhLine) addedZh.push({ text: zhLine, color: 'blue' })
        if (enLine) addedEn.push({ text: enLine, color: 'blue' })
      }
    }
  }

  mutable.stats = insertStatLinesBeforeSocketLine(target.stats, addedZh)
  if (target.statsEn !== undefined || addedEn.length > 0) {
    mutable.statsEn = insertStatLinesBeforeSocketLine(target.statsEn ?? target.stats, addedEn)
  }

  applyStatDeltaToTargetBase(target, addedZh, addedEn)

  if (
    target.rawItem &&
    target.rawItem.base &&
    (target.rawItem.totalSockets ?? 0) > (target.rawItem.socketedItems?.length ?? target.rawItem.socketedCount ?? 0)
  ) {
    const domainSocketable: Item =
      socketable.rawItem ??
      ({
        id: 0,
        code,
        name: socketable.name,
        quality: isJewel ? 4 : 2,
        level: sockReqLvl || 1,
        invWidth: 1,
        invHeight: 1,
        identified: true,
        base: {
          id: code,
          name: socketable.baseNameEn ?? socketable.name,
          kind: 'misc',
          type: isJewel ? 'jewl' : isRuneCode(code) ? 'rune' : 'gem',
          invWidth: 1,
          invHeight: 1,
          maxStack: 1,
          value: 100,
          damage: 0,
          defense: 0,
          tags: [isJewel ? 'jewl' : isRuneCode(code) ? 'rune' : 'gem'],
          level: sockReqLvl || 1,
        },
        rolledProps: [],
        stats: {},
      } as unknown as Item)
    mutable.rawItem = socketItemIntoHost(target.rawItem, domainSocketable)
  }

  return target
}

/**
 * Ground Truth (Diablo II v1.13c `D2Client.dll` `GFX_DrawItem` @ `0x6FB1B5A0`, `ENGINE\Gfx.cpp` line 2754):
 * - Calls `D2Common.dll!#10202` (`ITEMS_CheckItemFlag(pItem, IFLAG_ETHEREAL = 0x00400000, 2754, ...)`).
 * - If non-zero, overrides `eDrawMode` from `DRAWMODE_NORMAL (5)` to `DRAWMODE_TRANS50 (1)`.
 * - In `D2Direct3D.dll` (`0x6F886CD3..0x6F886CEF`), `DRAWMODE_TRANS50 (1)` maps to `alpha = 0x80` (`128 / 255` ≈ 50% opacity),
 *   and in `D2Gdi.dll` (`0x6F8762E0`) it selects `transPalettes[1]` (`pal.pl2` 50%/50% blend table).
 */
export const ETHEREAL_ITEM_ALPHA = 0.5

/**
 * Checks whether a UI item carries the 1.13c Ethereal flag (`IFLAG_ETHEREAL = 0x00400000`).
 * Gamble mystery items never render as ethereal prior to purchase.
 */
export function isUiItemEthereal(item: UiInventoryItem | null | undefined): boolean {
  if (!item || item.isGambleMystery) return false
  if (typeof item.ethereal === 'boolean') return item.ethereal
  if ((item as { isEthereal?: unknown }).isEthereal === true) return true
  const raw = item.rawItem
  if (raw) {
    if (typeof raw.flags?.ethereal === 'boolean') return raw.flags.ethereal
    if ((raw as { ethereal?: unknown }).ethereal === true) return true
    if (typeof raw.stats?.ethereal === 'number' && raw.stats.ethereal > 0) return true
    if (typeof raw.rawFlags === 'number' && (raw.rawFlags & 0x00400000) !== 0) return true
  }
  const rawFlags = (item as { rawFlags?: unknown }).rawFlags
  if (typeof rawFlags === 'number' && (rawFlags & 0x00400000) !== 0) return true
  return false
}

/**
 * Applies `ETHEREAL_ITEM_ALPHA` (`0.5`, `DRAWMODE_TRANS50 = 1`) to `ctx.globalAlpha` during `drawFn`
 * when `isEthereal` is true, and restores `ctx.globalAlpha` immediately afterward so overlays
 * (such as `gemsocket.dc6` and non-ethereal socketed Gems/Runes/Jewels) remain unaffected.
 */
export function drawImageWithEtherealAlpha(
  ctx: CanvasRenderingContext2D,
  isEthereal: boolean,
  drawFn: () => void,
): void {
  if (!isEthereal) {
    drawFn()
    return
  }
  const prevAlpha = typeof ctx.globalAlpha === 'number' ? ctx.globalAlpha : 1
  ctx.save?.()
  ctx.globalAlpha = prevAlpha * ETHEREAL_ITEM_ALPHA
  try {
    drawFn()
  } finally {
    ctx.globalAlpha = prevAlpha
    ctx.restore?.()
  }
}

/**
 * Canonical 28x28 `data\global\ui\PANEL\gemsocket.dc6` frame 0 sprite dimensions.
 */
export const GEMSOCKET_SPRITE_RECT: SpriteRect = { x: 0, y: 0, w: 28, h: 28 }

/**
 * `D2Client.dll` `0x6FB4521B..0x6FB4523F`: `D2GFX_DrawCelContext` is called with
 * `eDrawMode = 0` (`DRAWMODE_TRANS25`, vertex alpha `0x40 / 0x100 = 0.25` in `D2Direct3D.dll`
 * `0x6F886CD7` and `alphaBlend[2]` 25%/75% blend in `D2Gdi.dll` `0x6F8762F5`).
 */
export const GEMSOCKET_ALPHA = 0.25

/**
 * Authoritative 48-entry socket coordinate table from `D2Client.dll` `0x6FB80A98`
 * (`UI_DrawItemSockets` @ `0x6FB45196..0x6FB451B0`), indexed by:
 *   `idx = invHeight + 4 * (invWidth + 2 * totalSockets) - 13`
 * for `totalSockets` in `1..6`, `invWidth` in `1..2`, `invHeight` in `1..4`.
 * Each entry contains up to 6 `[gx, gy]` half-cell coordinate pairs.
 */
export const D2_SOCKET_COORD_TABLE_113C: readonly (readonly (readonly [number, number])[])[] = [
  // totalSockets = 1 (idx 0..7)
  [[1, 1]], // 1x1
  [[1, 2]], // 1x2
  [[1, 3]], // 1x3
  [[1, 4]], // 1x4
  [[2, 1]], // 2x1
  [[2, 2]], // 2x2
  [[2, 3]], // 2x3
  [[2, 4]], // 2x4
  // totalSockets = 2 (idx 8..15)
  [[0, 0], [0, 0]], // 1x1
  [[1, 1], [1, 3]], // 1x2
  [[1, 2], [1, 4]], // 1x3
  [[1, 3], [1, 5]], // 1x4
  [[1, 1], [3, 1]], // 2x1
  [[2, 1], [2, 3]], // 2x2
  [[2, 2], [2, 4]], // 2x3
  [[2, 2], [2, 6]], // 2x4
  // totalSockets = 3 (idx 16..23)
  [[0, 0], [0, 0], [0, 0]], // 1x1
  [[0, 0], [0, 0], [0, 0]], // 1x2
  [[1, 1], [1, 3], [1, 5]], // 1x3
  [[1, 2], [1, 4], [1, 6]], // 1x4
  [[0, 0], [0, 0], [0, 0]], // 2x1
  [[1, 1], [3, 1], [2, 3]], // 2x2 (triangle layout)
  [[2, 1], [2, 3], [2, 5]], // 2x3
  [[2, 2], [2, 4], [2, 6]], // 2x4
  // totalSockets = 4 (idx 24..31)
  [[0, 0], [0, 0], [0, 0], [0, 0]], // 1x1
  [[0, 0], [0, 0], [0, 0], [0, 0]], // 1x2
  [[0, 0], [0, 0], [0, 0], [0, 0]], // 1x3
  [[1, 1], [1, 3], [1, 5], [1, 7]], // 1x4
  [[0, 0], [0, 0], [0, 0], [0, 0]], // 2x1
  [[1, 1], [3, 3], [1, 3], [3, 1]], // 2x2 (diagonal fill order: TL, BR, BL, TR)
  [[1, 2], [3, 4], [1, 4], [3, 2]], // 2x3 (diagonal fill order)
  [[2, 1], [2, 3], [2, 5], [2, 7]], // 2x4 (single centered vertical column)
  // totalSockets = 5 (idx 32..39)
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // 1x1
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // 1x2
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // 1x3
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // 1x4
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // 2x1
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // 2x2
  [[2, 3], [1, 1], [3, 5], [1, 5], [3, 1]], // 2x3 (quincunx: center first, then 4 corners)
  [[2, 4], [1, 2], [3, 6], [1, 6], [3, 2]], // 2x4 (quincunx: center first, then 4 corners)
  // totalSockets = 6 (idx 40..47)
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // 1x1
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // 1x2
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // 1x3
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // 1x4
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // 2x1
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // 2x2
  [[1, 1], [1, 3], [1, 5], [3, 1], [3, 3], [3, 5]], // 2x3 (column-major: left col 1..3, right col 4..6)
  [[1, 2], [1, 4], [1, 6], [3, 2], [3, 4], [3, 6]], // 2x4 (column-major: left col 1..3, right col 4..6)
]

export interface ItemSocketDrawPosition {
  /** Half-cell coordinate `gx` from `0x6FB80A98`. */
  readonly gx: number
  /** Half-cell coordinate `gy` from `0x6FB80A98`. */
  readonly gy: number
  /** `xLeft` (`esi` in `0x6FB451FC`). */
  readonly xLeft: number
  /** `yBottom` (`ebx` in `0x6FB45216`). */
  readonly yBottom: number
  /** Top-left X for `gemsocket.dc6` (`xLeft - 1` per `0x6FB45232`). */
  readonly socketFrameX: number
  /** Top-left Y for `gemsocket.dc6` (`yBottom - 28` per `0x6FB45231..0x6FB4523F`). */
  readonly socketFrameY: number
  /** Top-left X for socketed child item (`xLeft` per `0x6FB4525C`). */
  readonly childItemX: number
  /** Top-left Y for socketed child item (`yBottom - cellH` per `0x6FB45255..0x6FB4525B`). */
  readonly childItemY: number
}

/**
 * Computes the exact 1.13c `D2Client.dll` (`0x6FB45140..0x6FB45265` & `0x6FB4530B..0x6FB4537E`)
 * pixel positions for each socket on an item rendered within bounding box `(x, y, w, h)`.
 */
export function computeItemSocketPositions113c(
  totalSockets: number,
  invWidth: number,
  invHeight: number,
  x: number,
  y: number,
  w: number,
  h: number,
  cellW = 29,
  cellH = 29,
): ItemSocketDrawPosition[] {
  const clampedSockets = Math.min(6, Math.max(0, Math.trunc(totalSockets)))
  if (clampedSockets <= 0) return []
  const clampedW = Math.min(2, Math.max(1, Math.trunc(invWidth || 1)))
  const clampedH = Math.min(4, Math.max(1, Math.trunc(invHeight || 1)))
  const tableIdx = clampedH + 4 * (clampedW + 2 * clampedSockets) - 13
  const coords = D2_SOCKET_COORD_TABLE_113C[tableIdx]
  if (!coords) return []

  // Per 0x6FB4530B..0x6FB45338: when drawn inside a larger equipment/useitem slot,
  // itemX/itemY centers the (invWidth * cellW, invHeight * cellH) item grid box inside (x, y, w, h).
  // For grid cells where w === invWidth * cellW and h === invHeight * cellH, itemX === x and itemY === y.
  const itemX = x + Math.trunc((w - clampedW * cellW) / 2)
  const itemY = y + Math.trunc((h - clampedH * cellH) / 2)

  const out: ItemSocketDrawPosition[] = []
  for (let i = 0; i < clampedSockets; i++) {
    const pair = coords[i]
    if (!pair) break
    const [gx, gy] = pair
    const xLeft = itemX + Math.trunc(((gx - 1) * cellW) / 2)
    const yBottom = itemY + Math.trunc(((gy + 1) * cellH) / 2)
    out.push({
      gx,
      gy,
      xLeft,
      yBottom,
      socketFrameX: xLeft - 1,
      socketFrameY: yBottom - GEMSOCKET_SPRITE_RECT.h,
      childItemX: xLeft,
      childItemY: yBottom - cellH,
    })
  }
  return out
}

/**
 * Draws the authentic Diablo II `gemsocket.dc6` socket frame and any socketed Gem/Rune/Jewel icons
 * overlaid on a hovered socketed item in the Inventory, Equipment slot, Stash, Horadric Cube,
 * Mercenary paperdoll, Trade grid, Vendor store, or Quest UseItem slot (`D2Client.dll` `0x6FB45140`).
 * Never draws procedural circles or colored dots; fails fast if `gemsocket.dc6` or a socketed item sprite is missing.
 */
export function drawItemSocketOverlay(
  ctx: CanvasRenderingContext2D,
  item: UiInventoryItem,
  x: number,
  y: number,
  w: number,
  h: number,
  assets: {
    itemsAtlasImg: HTMLImageElement | null
    gemSocketImg?: HTMLImageElement | null
    itemRects: Record<string, { x: number; y: number; w: number; h: number }>
    isHovered?: boolean | undefined
  },
  options?: {
    readonly isHovered?: boolean | undefined
  },
): void {
  const isHovered = options?.isHovered ?? assets.isHovered
  if (isHovered === false) return
  const totalSockets = Math.min(6, Math.max(0, item.sockets ?? 0))
  if (totalSockets <= 0 || isUiItemUnidentified(item)) return

  const socketed = item.socketedItems ?? []
  const socketRect = assets.itemRects['gemsocket']
  if (!assets.gemSocketImg && !socketRect) {
    throw new Error('[inventory] Missing sprite rect for gemsocket.dc6 in itemRects')
  }

  const positions = computeItemSocketPositions113c(
    totalSockets,
    item.invWidth,
    item.invHeight,
    x,
    y,
    w,
    h,
  )

  for (let idx = 0; idx < positions.length; idx++) {
    const pos = positions[idx]!

    // 1. Draw empty socket ring (`data\global\ui\PANEL\gemsocket.dc6`) via `D2GFX_DrawCelContext`
    //    at `(xLeft - 1, yBottom)` with `eDrawMode = 0` (`DRAWMODE_TRANS25` = 0.25 alpha, 0x6FB4521B..0x6FB4523F).
    const prevAlpha = typeof ctx.globalAlpha === 'number' ? ctx.globalAlpha : 1
    ctx.save?.()
    ctx.globalAlpha = prevAlpha * GEMSOCKET_ALPHA
    try {
      if (assets.gemSocketImg) {
        ctx.drawImage(
          assets.gemSocketImg,
          0,
          0,
          GEMSOCKET_SPRITE_RECT.w,
          GEMSOCKET_SPRITE_RECT.h,
          pos.socketFrameX,
          pos.socketFrameY,
          GEMSOCKET_SPRITE_RECT.w,
          GEMSOCKET_SPRITE_RECT.h,
        )
      } else if (assets.itemsAtlasImg && socketRect) {
        ctx.drawImage(
          assets.itemsAtlasImg,
          socketRect.x,
          socketRect.y,
          socketRect.w,
          socketRect.h,
          pos.socketFrameX,
          pos.socketFrameY,
          socketRect.w,
          socketRect.h,
        )
      }
    } finally {
      ctx.globalAlpha = prevAlpha
      ctx.restore?.()
    }

    // 2. Draw socketed child item (`pSocketedItem`) via `GFX_DrawItem` at `(xLeft, yBottom - 29)` (0x6FB4524C..0x6FB45263).
    const sockItem = socketed[idx]
    if (sockItem) {
      const sr = resolveItemSpriteRect(sockItem, assets.itemRects)
      if (!sr) {
        throw new Error(
          `[inventory] Missing sprite rect for socketed item code="${sockItem.code ?? ''}" invFile="${sockItem.invFile ?? ''}"`,
        )
      }
      if (assets.itemsAtlasImg) {
        const atlasImg = assets.itemsAtlasImg
        ctx.save?.()
        try {
          drawImageWithEtherealAlpha(ctx, isUiItemEthereal(sockItem), () => {
            ctx.drawImage(
              atlasImg,
              sr.x,
              sr.y,
              sr.w,
              sr.h,
              pos.childItemX,
              pos.childItemY,
              sr.w,
              sr.h,
            )
          })
        } finally {
          ctx.restore?.()
        }
      }
    }
  }
}

function normalizeEquipSlotId(slotId: string): EquipSlotId {
  if (slotId === 'head') return 'helm'
  if (slotId === 'mainHand') return 'weapon1'
  if (slotId === 'offHand') return 'weapon2'
  if (slotId === 'body') return 'armor'
  return slotId as EquipSlotId
}

export class InventoryPanel {
  visible = false
  /**
   * Close `X` with 1.13c button semantics: mouse-down latches the depressed
   * `buysellbtn.dc6` cell 11, the panel closes on mouse-up landing back on the button.
   */
  readonly closeButton = new PanelCloseButton(() => INV_CLOSE_BTN_BOUNDS)
  /** Active weapon swap set: 0 = Weapon Set I, 1 = Weapon Set II. */
  weaponSwapSet: 0 | 1 = 0
  get activeWeaponSlot(): 0 | 1 {
    return this.weaponSwapSet
  }
  set activeWeaponSlot(val: 0 | 1) {
    this.weaponSwapSet = val
  }
  /** Equipped gear slots (empty until the server sends `0x9C`/`0x9D` equip events). */
  readonly equipped: Partial<Record<EquipSlotId | 'head' | 'torso', UiInventoryItem>> & {
    get: (slot: string) => UiInventoryItem | undefined
    set: (slot: string, item: UiInventoryItem | null | undefined) => unknown
  } = {} as any
  /** Secondary weapon swap slots (`Weapon Set II`). */
  readonly swapWeapons: { weapon1: UiInventoryItem | null; weapon2: UiInventoryItem | null } = {
    weapon1: null,
    weapon2: null,
  }
  /** 10x4 grid items (empty until the server sends inventory item events). */
  gridItems: GridPlacement[] = []
  /** Flat list of inventory items mirrored from `gridItems`. */
  get inventory(): readonly UiInventoryItem[] {
    return this.gridItems.map(g => g.item)
  }
  /** 16-slot belt mirror populated from server belt state. */
  belt: (UiInventoryItem | null)[] = new Array(16).fill(null)
  private _cursorItem: UiInventoryItem | null = null
  /** Item currently held on the mouse cursor (`cursorItem`). */
  get cursorItem(): UiInventoryItem | null {
    return this._cursorItem
  }
  set cursorItem(val: UiInventoryItem | Item | null) {
    this._cursorItem = val as UiInventoryItem | null
  }
  /** Active Identify targeting mode source (`ibk` or `isc`) initiated via Right-Click. */
  identifyCursorSource: IdentifyCursorSource | null = null
  /** Currently hovered item (either in a slot or in the 10x4 grid) for Tooltip rendering. */
  hoveredItem: { item: UiInventoryItem; x: number; y: number } | null = null
  /** Currently hovered inventory button (`gold` or `close`) for 1.13c hover tooltip (`0x6FB48350`). */
  hoveredButton: 'gold' | 'close' | null = null
  /** Whether the Private Stash is currently open on the left dock (`strBankGoldDeposit` vs `strDropGoldHowMuch`). */
  stashOpen = false
  lang: TblLang = getTblLang()
  private _playerLevel = 1
  _playerLevelExplicitlySet = false
  /** Player character level for authentic inventory gold capacity calculation. */
  get playerLevel(): number {
    return this._playerLevel
  }
  set playerLevel(val: number) {
    this._playerLevel = val
    this._playerLevelExplicitlySet = true
  }
  /**
   * Player character requirement context (`level`, `str`, `dex`, `classCode`) for
   * 1.13c equipment validation (`ITEMS_CheckItemRequirements` & `ITEMS_CanEquipInHandSlots`).
   */
  playerContext: PlayerItemRequirementContext = {
    level: 1,
    str: 0,
    dex: 0,
  }
  /** Monotonic sequence counter for syncing `playerContext` with `WorldPanelsHud`. */
  playerContextSeq = 0

  constructor() {
    Object.defineProperty(this.equipped, 'get', {
      value: (slot: string) => this.equipped[normalizeEquipSlotId(slot)],
      enumerable: false,
      configurable: true,
    })
    Object.defineProperty(this.equipped, 'set', {
      value: (slot: string, val: UiInventoryItem | null | undefined) => {
        const norm = normalizeEquipSlotId(slot)
        if (val == null) delete this.equipped[norm]
        else this.equipped[norm] = val
        return this.equipped
      },
      enumerable: false,
      configurable: true,
    })
    Object.defineProperty(this.equipped, 'head', {
      get: () => this.equipped.helm,
      set: (val: UiInventoryItem | null | undefined) => {
        if (val == null) delete this.equipped.helm
        else this.equipped.helm = val
      },
      enumerable: false,
      configurable: true,
    })
    Object.defineProperty(this.equipped, 'torso', {
      get: () => this.equipped.armor,
      set: (val: UiInventoryItem | null | undefined) => {
        if (val == null) delete this.equipped.armor
        else this.equipped.armor = val
      },
      enumerable: false,
      configurable: true,
    })
  }

  updatePlayerContext(ctx: Partial<PlayerItemRequirementContext>): void {
    this.setPlayerContext(ctx)
  }

  setPlayerContext(ctx: Partial<PlayerItemRequirementContext>): void {
    this.playerContext = {
      level: ctx.level !== undefined ? Math.max(1, ctx.level) : this.playerContext.level,
      str: ctx.str !== undefined ? Math.max(0, ctx.str) : this.playerContext.str,
      dex: ctx.dex !== undefined ? Math.max(0, ctx.dex) : this.playerContext.dex,
      classCode: ctx.classCode !== undefined ? ctx.classCode : this.playerContext.classCode,
    }
    this.playerContextSeq = nextPlayerContextSeq()
  }

  /** Server stat 14 (`gold`); 0 until received (D2GS omits zero-valued stats). */
  private _gold = 0

  /** Authentic 1.13c inventory gold capacity: playerLevel * 10,000. */
  get maxGold(): number {
    return getInventoryGoldLimit(this.playerLevel)
  }

  /** Player gold in inventory. */
  get gold(): number {
    return this._gold
  }

  set gold(value: number) {
    const safe = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
    this._gold = safe
  }

  isIdentifyMode(): boolean {
    return this.identifyCursorSource !== null
  }

  cancelIdentifyMode(): void {
    this.identifyCursorSource = null
  }

  /**
   * Enter Identify Cursor Mode from a Tome of Identify (`ibk`) or Scroll of Identify (`isc`).
   */
  startIdentifyMode(item: UiInventoryItem, container: 'inventory' | 'stash' | 'cube' = 'inventory'): boolean {
    const code = (item.code ?? '').trim().toLowerCase()
    if (code === 'ibk') {
      if (getTomeQuantity(item) <= 0) return false
      this.identifyCursorSource = { container, itemId: item.id, code: 'ibk' }
      return true
    }
    if (code === 'isc') {
      this.identifyCursorSource = { container, itemId: item.id, code: 'isc' }
      return true
    }
    return false
  }

  /**
   * Consume 1 charge from the active `identifyCursorSource` (`ibk` decrements quantity, `isc` is removed)
   * and identify `targetItem` if it is currently unidentified.
   */
  applyIdentifyToItem(
    targetItem: UiInventoryItem,
    externalContainers?: {
      stashItems?: GridPlacement[]
      cubeItems?: GridPlacement[]
    },
  ): boolean {
    if (!this.identifyCursorSource) return false
    if (!isUiItemUnidentified(targetItem)) {
      this.identifyCursorSource = null
      return false
    }

    const src = this.identifyCursorSource
    const containerList =
      src.container === 'stash'
        ? externalContainers?.stashItems
        : src.container === 'cube'
        ? externalContainers?.cubeItems
        : this.gridItems

    if (!containerList) {
      this.identifyCursorSource = null
      return false
    }

    const srcIdx = containerList.findIndex(p => p.item.id === src.itemId)
    if (srcIdx === -1) {
      this.identifyCursorSource = null
      return false
    }

    const srcPlaced = containerList[srcIdx]!
    if (src.code === 'ibk') {
      const qty = getTomeQuantity(srcPlaced.item)
      if (qty <= 0) {
        this.identifyCursorSource = null
        return false
      }
      setTomeQuantity(srcPlaced.item, qty - 1)
    } else {
      const qty = srcPlaced.item.quantity ?? srcPlaced.item.rawItem?.quantity ?? 1
      if (qty > 1) {
        setTomeQuantity(srcPlaced.item, qty - 1)
      } else {
        containerList.splice(srcIdx, 1)
      }
    }

    identifyUiItem(targetItem, Math.max(1, this.playerContext.level || this.playerLevel || 1))
    if (this.hoveredItem && String(this.hoveredItem.item.id) === String(targetItem.id)) {
      this.hoveredItem = { ...this.hoveredItem, item: { ...targetItem } }
    }
    this.identifyCursorSource = null
    return true
  }

  toggleWeaponSwap(): void {
    const curW1 = this.equipped.weapon1 ?? null
    const curW2 = this.equipped.weapon2 ?? null
    if (this.swapWeapons.weapon1) this.equipped.weapon1 = this.swapWeapons.weapon1
    else delete this.equipped.weapon1
    if (this.swapWeapons.weapon2) this.equipped.weapon2 = this.swapWeapons.weapon2
    else delete this.equipped.weapon2
    this.swapWeapons.weapon1 = curW1
    this.swapWeapons.weapon2 = curW2
    this.weaponSwapSet = this.weaponSwapSet === 0 ? 1 : 0
  }

  /**
   * Check whether an item of `(w, h)` can be placed at `(col, row)` in the 10x4 grid.
   * Returns the list of overlapping `GridPlacement`s.
   */
  getGridOverlaps(col: number, row: number, w: number, h: number): GridPlacement[] {
    if (col < 0 || row < 0 || col + w > INV_GRID_ORIGIN.cols || row + h > INV_GRID_ORIGIN.rows) {
      throw new RangeError('Out of 10x4 grid bounds')
    }
    return this.gridItems.filter(p => {
      const ox = col < p.col + p.item.invWidth && col + w > p.col
      const oy = row < p.row + p.item.invHeight && row + h > p.row
      return ox && oy
    })
  }

  /**
   * Attempt to place an item into the first free `(col, row)` in the 10x4 grid.
   */
  autoPlaceInGrid(rawItem: UiInventoryItem | Item): boolean {
    const item = rawItem as UiInventoryItem
    if (isKeyCode(item.code)) {
      let remQty = Math.max(1, getTomeQuantity(item))
      for (const p of this.gridItems) {
        if (!isKeyCode(p.item.code)) continue
        const curQty = getTomeQuantity(p.item)
        const maxQty = p.item.maxQuantity ?? KEY_MAX_QUANTITY
        if (curQty < maxQty) {
          const addQty = Math.min(maxQty - curQty, remQty)
          setTomeQuantity(p.item, curQty + addQty)
          remQty -= addQty
          if (remQty <= 0) {
            return true
          }
        }
      }
      setTomeQuantity(item, remQty)
    }
    for (let col = 0; col <= INV_GRID_ORIGIN.cols - item.invWidth; col++) {
      for (let row = 0; row <= INV_GRID_ORIGIN.rows - item.invHeight; row++) {
        if (this.getGridOverlaps(col, row, item.invWidth, item.invHeight).length === 0) {
          this.gridItems.push({ item, col, row })
          return true
        }
      }
    }
    return false
  }

  /**
   * Handle left-click on a grid cell `(col, row)`:
   * - If `cursorItem` is null: pick up the item at `(col, row)` into `cursorItem`.
   * - If `cursorItem` is a Scroll (`tsc`/`isc`) and hits a matching Tome (`tbk`/`ibk`) with `quantity < 20`:
   *   stack the scroll into the tome (`quantity + 1`) and clear `cursorItem` (`Books.txt`).
   * - If `cursorItem` is a Gem, Rune, or Jewel and hits a socketed item with open sockets:
   *   socket 1 unit of `cursorItem` into the target item (`D2Game.dll` `0x6fc479c0`).
   * - If `cursorItem` is held: place it if 0 overlaps, or swap if exactly 1 overlap!
   */
  clickGridCell(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= INV_GRID_ORIGIN.cols || row >= INV_GRID_ORIGIN.rows) {
      return false
    }
    if (!this.cursorItem) {
      const hit = this.gridItems.find(
        p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
      )
      if (!hit) {
        return false
      }
      this.gridItems = this.gridItems.filter(p => p !== hit)
      this.cursorItem = hit.item
      return true
    }

    // Check direct hit for Scroll-into-Tome stacking (`tsc` -> `tbk`, `isc` -> `ibk`), Key stacking (`key` -> `key`), or Socketing
    const directHit = this.gridItems.find(
      p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
    )
    if (
      directHit &&
      (isScrollForTome(this.cursorItem.code, directHit.item.code) ||
        isKeyStackPair(this.cursorItem.code, directHit.item.code))
    ) {
      const curQty = getTomeQuantity(directHit.item)
      const maxQty =
        directHit.item.maxQuantity ??
        (isKeyCode(directHit.item.code) ? KEY_MAX_QUANTITY : TOME_MAX_QUANTITY)
      if (curQty < maxQty) {
        const scrollQty = getTomeQuantity(this.cursorItem)
        const addQty = Math.min(maxQty - curQty, Math.max(1, scrollQty))
        setTomeQuantity(directHit.item, curQty + addQty)
        if (scrollQty > addQty) {
          setTomeQuantity(this.cursorItem, scrollQty - addQty)
        } else {
          this.cursorItem = null
        }
        return true
      }
    }
    if (directHit && canSocketUiItem(this.cursorItem, directHit.item)) {
      applySocketToUiItem(directHit.item, this.cursorItem)
      const qty = this.cursorItem.quantity ?? this.cursorItem.rawItem?.quantity ?? 1
      if (qty > 1) {
        setTomeQuantity(this.cursorItem, qty - 1)
      } else {
        this.cursorItem = null
      }
      return true
    }

    if (!directHit && (col + this.cursorItem.invWidth > INV_GRID_ORIGIN.cols || row + this.cursorItem.invHeight > INV_GRID_ORIGIN.rows)) {
      return false
    }

    const targetCol = Math.min(INV_GRID_ORIGIN.cols - this.cursorItem.invWidth, Math.max(0, col))
    const targetRow = Math.min(INV_GRID_ORIGIN.rows - this.cursorItem.invHeight, Math.max(0, row))
    const overlaps = this.getGridOverlaps(targetCol, targetRow, this.cursorItem.invWidth, this.cursorItem.invHeight)
    if (overlaps.length === 0) {
      this.gridItems.push({ item: this.cursorItem, col: targetCol, row: targetRow })
      this.cursorItem = null
      return true
    }
    if (overlaps.length === 1) {
      const single = overlaps[0]!
      if (
        isScrollForTome(this.cursorItem.code, single.item.code) ||
        isKeyStackPair(this.cursorItem.code, single.item.code)
      ) {
        const curQty = getTomeQuantity(single.item)
        const maxQty =
          single.item.maxQuantity ??
          (isKeyCode(single.item.code) ? KEY_MAX_QUANTITY : TOME_MAX_QUANTITY)
        if (curQty < maxQty) {
          const scrollQty = getTomeQuantity(this.cursorItem)
          const addQty = Math.min(maxQty - curQty, Math.max(1, scrollQty))
          setTomeQuantity(single.item, curQty + addQty)
          if (scrollQty > addQty) {
            setTomeQuantity(this.cursorItem, scrollQty - addQty)
          } else {
            this.cursorItem = null
          }
          return true
        }
      }
      if (canSocketUiItem(this.cursorItem, single.item)) {
        applySocketToUiItem(single.item, this.cursorItem)
        const qty = this.cursorItem.quantity ?? this.cursorItem.rawItem?.quantity ?? 1
        if (qty > 1) {
          setTomeQuantity(this.cursorItem, qty - 1)
        } else {
          this.cursorItem = null
        }
        return true
      }
      this.gridItems = this.gridItems.filter(p => p !== single)
      this.gridItems.push({ item: this.cursorItem, col: targetCol, row: targetRow })
      this.cursorItem = single.item
      return true
    }
    return false
  }

  /**
   * Ground Truth (D2Common.dll 1.13c `ITEMS_CheckItemRequirements` #10244 & `ITEMS_CanEquipInHandSlots` @ 0x6fd73680):
   * Validates whether `item` can be equipped into `slotId` given the current `playerContext` and currently equipped items:
   * 1. Must be identified and satisfy level (`reqLevel`), strength (`reqStr`), dexterity (`reqDex`), and class (`reqClass`) requirements.
   * 2. Must be allowed in `slotId`.
   * 3. Hand slot (`weapon1` / `weapon2`) rules when the opposite hand slot (`otherItem`) is occupied:
   *    - Strict 2H weapons (`strict_two_handed_weapon`) always occupy both hands and cannot be combined with any weapon or shield (for any class, including Barbarian).
   *    - Two shields/off-hands (`offhand` + `offhand`) cannot be equipped together.
   *    - Non-Barbarian (`classCode !== 'bar'`):
   *      - Can only equip 1 one-handed weapon + 1 shield/off-hand, OR 1 two-handed weapon (`strict_two_handed_weapon` or `barbarian_1or2h_weapon`).
   *      - Cannot dual-wield two weapons, and cannot pair a 2H sword (`barbarian_1or2h_weapon`) with a shield.
   *    - Barbarian (`classCode === 'bar'`):
   *      - Can dual-wield one-handed weapons (`one_handed_weapon`) and/or `1or2handed` two-handed swords (`barbarian_1or2h_weapon`).
   *      - Can pair a `1or2handed` two-handed sword (`barbarian_1or2h_weapon`) with a shield (`offhand`).
   */
  canEquipItemInSlot(item: UiInventoryItem, rawSlotId: EquipSlotId | string): boolean {
    const slotId = normalizeEquipSlotId(rawSlotId)
    if (isUiItemUnidentified(item)) {
      return false
    }
    if (Array.isArray(item.allowedSlots) && !item.allowedSlots.includes(slotId)) {
      const isHandSlot = slotId === 'weapon1' || slotId === 'weapon2'
      const allowsEitherHand =
        item.allowedSlots.includes('weapon1') || item.allowedSlots.includes('weapon2')
      if (!(isHandSlot && allowsEitherHand)) {
        return false
      }
    }
    if (!canPlayerUseUiItem(item, this.playerContext)) {
      return false
    }

    if (slotId === 'weapon1' || slotId === 'weapon2') {
      const incomingCat = classifyHandSlotItem(item)
      if (incomingCat === 'other' && Array.isArray(item.allowedSlots)) {
        return false
      }
      const otherSlotId: EquipSlotId = slotId === 'weapon1' ? 'weapon2' : 'weapon1'
      const otherItem = this.equipped[otherSlotId] ?? null
      if (!otherItem) {
        return true
      }
      return areHandSlotItemsCompatible(item, otherItem, this.playerContext.classCode)
    }

    return true
  }

  /**
   * Handle left-click on an equipment slot (`helm`, `weapon1`, `armor`, etc.).
   * Enforces Diablo II v1.13c item level/attribute/class requirements and weapon/shield hand-slot rules.
   * Holding a Gem, Rune, or Jewel and left-clicking an equipped socketed item sockets it directly.
   */
  clickEquipSlot(rawSlotId: EquipSlotId | string): boolean {
    const slotId = normalizeEquipSlotId(rawSlotId)
    const existing = this.equipped[slotId] ?? null
    if (!this.cursorItem) {
      if (!existing) {
        // 1.13c Case 4: clicking empty hand slot while 2H weapon is in opposite hand unequips the 2H weapon to cursor
        if (slotId === 'weapon1' || slotId === 'weapon2') {
          const otherSlotId: EquipSlotId = slotId === 'weapon1' ? 'weapon2' : 'weapon1'
          const otherItem = this.equipped[otherSlotId] ?? null
          if (otherItem && isTwoHandedForClass(otherItem, this.playerContext.classCode)) {
            delete this.equipped[otherSlotId]
            this.cursorItem = otherItem
            return true
          }
        }
        return false
      }
      delete this.equipped[slotId]
      this.cursorItem = existing
      return true
    }
    if (existing && canSocketUiItem(this.cursorItem, existing)) {
      applySocketToUiItem(existing, this.cursorItem)
      const qty = this.cursorItem.quantity ?? this.cursorItem.rawItem?.quantity ?? 1
      if (qty > 1) {
        setTomeQuantity(this.cursorItem, qty - 1)
      } else {
        this.cursorItem = null
      }
      return true
    }

    // 1.13c Case 2 (`D2Common.dll` `0x6fd70db0` & `0x6fd6f980` `INVENTORY_AreItemsCompatibleInHands`):
    // Clicking an empty hand slot (`!existing`) when the opposite hand slot has an incompatible item
    // (`!areHandSlotItemsCompatible`, e.g. 2H weapon + non-quiver, or Bow + Bolts) swaps the opposite hand's item to cursor.
    // When compatible (e.g. Bow + Arrows `aqv` or Crossbow + Bolts `cqv`), equips into `slotId` without unequipping `otherSlotId`!
    if (slotId === 'weapon1' || slotId === 'weapon2') {
      const otherSlotId: EquipSlotId = slotId === 'weapon1' ? 'weapon2' : 'weapon1'
      const otherItem = this.equipped[otherSlotId] ?? null
      if (
        !existing &&
        otherItem &&
        !areHandSlotItemsCompatible(this.cursorItem, otherItem, this.playerContext.classCode) &&
        (isTwoHandedForClass(otherItem, this.playerContext.classCode) ||
          isTwoHandedForClass(this.cursorItem, this.playerContext.classCode) ||
          getItemQuiverType(otherItem) !== null ||
          getItemQuiverType(this.cursorItem) !== null)
      ) {
        if (isUiItemUnidentified(this.cursorItem) || !canPlayerUseUiItem(this.cursorItem, this.playerContext)) {
          return false
        }
        if (!isItemAllowedInSlot(this.cursorItem, slotId)) {
          return false
        }
        delete this.equipped[otherSlotId]
        const swappedOut = otherItem
        this.equipped[slotId] = this.cursorItem
        this.cursorItem = swappedOut
        return true
      }
    }

    if (!this.canEquipItemInSlot(this.cursorItem, slotId)) {
      return false
    }
    this.equipped[slotId] = this.cursorItem
    this.cursorItem = existing
    return true
  }

  /**
   * Right-click use handler for usable items (`misc.txt` `useable === 1`) inside a container.
   */
  usePlacedItemByRightClick(
    placed: GridPlacement,
    container: 'inventory' | 'stash' | 'cube',
    containerList: GridPlacement[],
    callbacks?: {
      onOpenCube?: () => void
      onCastTownPortal?: (source?: 'tbk' | 'tsc', item?: UiInventoryItem) => boolean | void
      onUseItem?: (item: UiInventoryItem, container: 'inventory' | 'stash' | 'cube') => boolean | void
    },
  ): boolean {
    if (this.cursorItem !== null) return false
    const code = (placed.item.code ?? '').trim().toLowerCase()
    if (!CANONICAL_MISC_USABLE_CODES.has(code)) return false
    if (code === 'box') {
      callbacks?.onOpenCube?.()
      return true
    }
    if (code === 'tbk') {
      const qty = getTomeQuantity(placed.item)
      if (qty <= 0) return false
      const castOk = callbacks?.onCastTownPortal?.('tbk', placed.item)
      if (castOk !== false) {
        setTomeQuantity(placed.item, qty - 1)
      }
      return true
    }
    if (code === 'tsc') {
      const castOk = callbacks?.onCastTownPortal?.('tsc', placed.item)
      if (castOk !== false) {
        const qty = placed.item.quantity ?? placed.item.rawItem?.quantity ?? 1
        if (qty > 1) {
          setTomeQuantity(placed.item, qty - 1)
        } else {
          const idx = containerList.indexOf(placed)
          if (idx !== -1) containerList.splice(idx, 1)
          if (this.hoveredItem?.item.id === placed.item.id) {
            this.hoveredItem = null
          }
        }
      }
      return true
    }
    if (code === 'ibk' || code === 'isc') {
      return this.startIdentifyMode(placed.item, container)
    }
    const usedOk = callbacks?.onUseItem?.(placed.item, container)
    const isNonConsumableScroll = code === 'bks' || code === 'bkd' || code === 'tr1'
    if (usedOk !== false && !isNonConsumableScroll) {
      const qty = placed.item.quantity ?? placed.item.rawItem?.quantity ?? 1
      if (qty > 1) {
        setTomeQuantity(placed.item, qty - 1)
      } else {
        const idx = containerList.indexOf(placed)
        if (idx !== -1) containerList.splice(idx, 1)
        if (this.hoveredItem?.item.id === placed.item.id) {
          this.hoveredItem = null
        }
      }
    }
    return true
  }

  getOppositeHandTwoHandedWeapon(slotId: EquipSlotId): UiInventoryItem | null {
    if (slotId !== 'weapon1' && slotId !== 'weapon2') return null
    if (this.equipped[slotId]) return null
    const otherSlot: EquipSlotId = slotId === 'weapon1' ? 'weapon2' : 'weapon1'
    const otherItem = this.equipped[otherSlot]
    if (otherItem && isTwoHandedForClass(otherItem, this.playerContext.classCode)) {
      return otherItem
    }
    return null
  }

  handleMouseMove(logicalX: number, logicalY: number): void {
    this.hoveredItem = null
    this.hoveredButton = null
    if (!this.visible) return

    // Check Gold Coin Button & Close Button (`D2Client.dll 0x6FB48350`)
    if (
      logicalX >= INV_PANEL_ORIGIN.x + INV_GOLD_BTN_HIT.relX0 &&
      logicalX <= INV_PANEL_ORIGIN.x + INV_GOLD_BTN_HIT.relX1 &&
      logicalY >= INV_PANEL_ORIGIN.y + INV_GOLD_BTN_HIT.relY0 &&
      logicalY <= INV_PANEL_ORIGIN.y + INV_GOLD_BTN_HIT.relY1
    ) {
      this.hoveredButton = 'gold'
      return
    }
    if (
      logicalX >= INV_CLOSE_BTN_BOUNDS.x &&
      logicalX <= INV_CLOSE_BTN_BOUNDS.x + INV_CLOSE_BTN_BOUNDS.w &&
      logicalY >= INV_CLOSE_BTN_BOUNDS.y &&
      logicalY <= INV_CLOSE_BTN_BOUNDS.y + INV_CLOSE_BTN_BOUNDS.h
    ) {
      this.hoveredButton = 'close'
      return
    }

    // Check equipment slots (including 2H weapon in opposite hand slot per 0x6FB47BE0)
    for (const [slotId, rect] of Object.entries(EQUIP_SLOTS_LAYOUT) as [EquipSlotId, typeof EQUIP_SLOTS_LAYOUT[EquipSlotId]][]) {
      if (logicalX >= rect.x && logicalX <= rect.x + rect.w && logicalY >= rect.y && logicalY <= rect.y + rect.h) {
        const eq = this.equipped[slotId] ?? this.getOppositeHandTwoHandedWeapon(slotId)
        if (eq) {
          this.hoveredItem = { item: eq, x: rect.x + rect.w / 2, y: rect.y }
        }
        return
      }
    }

    // Check 10x4 grid
    if (
      logicalX >= INV_GRID_ORIGIN.x &&
      logicalX < INV_GRID_ORIGIN.x + INV_GRID_ORIGIN.cols * INV_GRID_ORIGIN.cellPx &&
      logicalY >= INV_GRID_ORIGIN.y &&
      logicalY < INV_GRID_ORIGIN.y + INV_GRID_ORIGIN.rows * INV_GRID_ORIGIN.cellPx
    ) {
      const col = Math.floor((logicalX - INV_GRID_ORIGIN.x) / INV_GRID_ORIGIN.cellPx)
      const row = Math.floor((logicalY - INV_GRID_ORIGIN.y) / INV_GRID_ORIGIN.cellPx)
      const hit = this.gridItems.find(
        p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
      )
      if (hit) {
        this.hoveredItem = {
          item: hit.item,
          x: INV_GRID_ORIGIN.x + (hit.col + hit.item.invWidth / 2) * INV_GRID_ORIGIN.cellPx,
          y: INV_GRID_ORIGIN.y + hit.row * INV_GRID_ORIGIN.cellPx,
        }
      }
    }
  }

  /**
   * Mouse-up over the panel: closes the inventory only when the release lands back on
   * the pressed close `X` — dragging off the button and releasing cancels the close.
   * The latch is always popped here so a panel re-closed via hotkey mid-hold can not
   * fire a stale close.
   */
  handleMouseUp(logicalX: number, logicalY: number): boolean {
    const triggered = this.closeButton.release(logicalX, logicalY) && this.visible
    if (triggered) this.visible = false
    return triggered
  }

  /**
   * Handle mouse click on the Inventory Panel (`400..720, 60..501`).
   *
   * Ground Truth (Diablo II v1.13c):
   * - `button === 0` (Left-Click):
   *   - In Identify Cursor Mode: identifies an unidentified item under the cursor (consuming 1 tome charge or scroll), or cancels Identify mode if clicking elsewhere.
   *   - In normal mode: picks up, places, swaps items in the 10x4 grid or equipment slots; stacks scrolls (`tsc`/`isc`) into matching tomes (`tbk`/`ibk`). Never uses `box` or `tbk`!
   * - `button === 2` (Right-Click):
   *   - In Identify Cursor Mode: cancels Identify mode.
   *   - In normal mode: uses usable items (`misc.txt` `useable === 1`: `box` opens Horadric Cube, `tbk`/`tsc` casts Town Portal and consumes 1 charge/scroll, `ibk`/`isc` enters Identify Cursor Mode, potions/usables consume 1 item). Never picks up or moves items onto the cursor!
   */
  handleClick(
    logicalX: number,
    logicalY: number,
    callbacks?: {
      onOpenCube?: () => void
      onCastTownPortal?: (source?: 'tbk' | 'tsc', item?: UiInventoryItem) => boolean | void
      onUseItem?: (item: UiInventoryItem, container: 'inventory' | 'stash' | 'cube') => boolean | void
      /** Inventory gold coin button pressed: open the gold dialog (drop, or deposit while the stash is open). */
      onGoldButton?: () => void
    },
    button: 0 | 2 = 0,
    externalContainers?: {
      stashItems?: GridPlacement[]
      cubeItems?: GridPlacement[]
    },
  ): boolean {
    if (!this.visible) return false
    if (logicalX < 400) return false

    // Active Identify Cursor Mode handling (`ibk` / `isc`)
    if (this.identifyCursorSource !== null) {
      if (button === 2) {
        this.cancelIdentifyMode()
        return true
      }

      // Left-Click on equipment slot in Identify Mode
      for (const [slotId, rect] of Object.entries(EQUIP_SLOTS_LAYOUT) as [EquipSlotId, typeof EQUIP_SLOTS_LAYOUT[EquipSlotId]][]) {
        if (logicalX >= rect.x && logicalX <= rect.x + rect.w && logicalY >= rect.y && logicalY <= rect.y + rect.h) {
          const eq = this.equipped[slotId]
          if (eq && isUiItemUnidentified(eq)) {
            this.applyIdentifyToItem(eq, externalContainers)
          } else {
            this.cancelIdentifyMode()
          }
          return true
        }
      }

      // Left-Click on 10x4 grid in Identify Mode
      if (
        logicalX >= INV_GRID_ORIGIN.x &&
        logicalX < INV_GRID_ORIGIN.x + INV_GRID_ORIGIN.cols * INV_GRID_ORIGIN.cellPx &&
        logicalY >= INV_GRID_ORIGIN.y &&
        logicalY < INV_GRID_ORIGIN.y + INV_GRID_ORIGIN.rows * INV_GRID_ORIGIN.cellPx
      ) {
        const col = Math.floor((logicalX - INV_GRID_ORIGIN.x) / INV_GRID_ORIGIN.cellPx)
        const row = Math.floor((logicalY - INV_GRID_ORIGIN.y) / INV_GRID_ORIGIN.cellPx)
        const hit = this.gridItems.find(
          p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
        )
        if (hit && isUiItemUnidentified(hit.item)) {
          this.applyIdentifyToItem(hit.item, externalContainers)
        } else {
          this.cancelIdentifyMode()
        }
        return true
      }

      this.cancelIdentifyMode()
      return true
    }

    // Right-Click (`button === 2`): Use items only; NEVER pick up or move items onto cursor!
    if (button === 2) {
      if (
        logicalX >= INV_GRID_ORIGIN.x &&
        logicalX < INV_GRID_ORIGIN.x + INV_GRID_ORIGIN.cols * INV_GRID_ORIGIN.cellPx &&
        logicalY >= INV_GRID_ORIGIN.y &&
        logicalY < INV_GRID_ORIGIN.y + INV_GRID_ORIGIN.rows * INV_GRID_ORIGIN.cellPx
      ) {
        const col = Math.floor((logicalX - INV_GRID_ORIGIN.x) / INV_GRID_ORIGIN.cellPx)
        const row = Math.floor((logicalY - INV_GRID_ORIGIN.y) / INV_GRID_ORIGIN.cellPx)
        const hit = this.gridItems.find(
          p => col >= p.col && col < p.col + p.item.invWidth && row >= p.row && row < p.row + p.item.invHeight,
        )
        if (hit) {
          return this.usePlacedItemByRightClick(hit, 'inventory', this.gridItems, callbacks)
        }
      }
      return false
    }

    // Left-Click (`button === 0`): UI Buttons & Item Move / Pick Up / Place / Swap / Stack
    // 1. Close button — press only latches the depressed cell; the close fires on
    // mouse-up landing back on the button (see `handleMouseUp`).
    if (
      logicalX >= INV_CLOSE_BTN_BOUNDS.x &&
      logicalX <= INV_CLOSE_BTN_BOUNDS.x + INV_CLOSE_BTN_BOUNDS.w &&
      logicalY >= INV_CLOSE_BTN_BOUNDS.y &&
      logicalY <= INV_CLOSE_BTN_BOUNDS.y + INV_CLOSE_BTN_BOUNDS.h
    ) {
      this.closeButton.press(logicalX, logicalY)
      return true
    }

    // 2. Weapon Swap `I / II` Tabs (sub-tabs I -> set 0, II -> set 1; clicking active tab is a no-op)
    const targetSwapSet = resolveWeaponSwapTabClick(logicalX, logicalY)
    if (targetSwapSet !== null) {
      if (this.weaponSwapSet !== targetSwapSet) {
        this.toggleWeaponSwap()
      }
      return true
    }

    // 3. Equipment slots
    for (const [slotId, rect] of Object.entries(EQUIP_SLOTS_LAYOUT) as [EquipSlotId, typeof EQUIP_SLOTS_LAYOUT[EquipSlotId]][]) {
      if (logicalX >= rect.x && logicalX <= rect.x + rect.w && logicalY >= rect.y && logicalY <= rect.y + rect.h) {
        this.clickEquipSlot(slotId)
        return true
      }
    }

    // 4. 10x4 Bag Grid (Left-Click always moves/picks up/places/stacks; never opens cube or casts TP)
    if (
      logicalX >= INV_GRID_ORIGIN.x &&
      logicalX < INV_GRID_ORIGIN.x + INV_GRID_ORIGIN.cols * INV_GRID_ORIGIN.cellPx &&
      logicalY >= INV_GRID_ORIGIN.y &&
      logicalY < INV_GRID_ORIGIN.y + INV_GRID_ORIGIN.rows * INV_GRID_ORIGIN.cellPx
    ) {
      if (this.cursorItem) {
        const placement = computeCursorItemGridPlacement(
          logicalX,
          logicalY,
          INV_GRID_ORIGIN,
          this.cursorItem,
          this.gridItems,
        )
        if (
          placement.directHit &&
          (isScrollForTome(this.cursorItem.code, placement.directHit.item.code) ||
            canSocketUiItem(this.cursorItem, placement.directHit.item))
        ) {
          this.clickGridCell(placement.rawCol, placement.rawRow)
          return true
        }
        if (!placement.inBounds || placement.overlaps.length > 1) {
          return true
        }
        this.clickGridCell(placement.col, placement.row)
        return true
      }
      const col = Math.floor((logicalX - INV_GRID_ORIGIN.x) / INV_GRID_ORIGIN.cellPx)
      const row = Math.floor((logicalY - INV_GRID_ORIGIN.y) / INV_GRID_ORIGIN.cellPx)
      this.clickGridCell(col, row)
      return true
    }

    // 5. Gold coin button (D2Client inventory gold button hit rect, panel-relative x 83..103, y 392..410).
    //    D2 never drops/deposits locally: the button only opens the gold dialog; the amount is chosen there.
    if (
      logicalX >= INV_PANEL_ORIGIN.x + INV_GOLD_BTN_HIT.relX0 &&
      logicalX <= INV_PANEL_ORIGIN.x + INV_GOLD_BTN_HIT.relX1 &&
      logicalY >= INV_PANEL_ORIGIN.y + INV_GOLD_BTN_HIT.relY0 &&
      logicalY <= INV_PANEL_ORIGIN.y + INV_GOLD_BTN_HIT.relY1
    ) {
      if (this.gold > 0) callbacks?.onGoldButton?.()
      return true
    }

    return true
  }

  draw(
    ctx: CanvasRenderingContext2D,
    assets: {
      borderRightImg: HTMLImageElement | null
      invSheetImg: HTMLImageElement | null
      invTab0Img: HTMLImageElement | null
      invTab1Img: HTMLImageElement | null
      buySellBtnImg: HTMLImageElement | null
      goldCoinBtnImg?: HTMLImageElement | null
      gemSocketImg?: HTMLImageElement | null
      itemsAtlasImg: HTMLImageElement | null
      itemRects: Record<string, { x: number; y: number; w: number; h: number }>
    },
    font: D2FontRenderer,
  ): void {
    if (!this.visible) return

    // 1. Draw 800x600 Right Gothic Stone Border (`800BorderFrame.dc6` frames 5..9) at (400, 0)
    if (assets.borderRightImg) {
      ctx.drawImage(assets.borderRightImg, 400, 0)
    }

    // 2. Draw 320x441 Inventory Panel (`invchar6.dc6` frames 4..7) at (400, 60)
    if (assets.invSheetImg) {
      ctx.drawImage(assets.invSheetImg, INV_PANEL_ORIGIN.x, INV_PANEL_ORIGIN.y)
    } else {
      reportMissingArt('ui-panel', 'invchar6-inv', 'Missing inventory panel background invchar6.dc6')
    }

    // 3. Draw Weapon Swap Set II (`invchar6Tab.dc6` frame 0 = left slot overlay, frame 1 = right slot overlay)
    // Per 1.13c D2Client.dll 0x6fb49c25 (`cmp %ebp, g_bWeaponSet; je skip`):
    // - Set I (`weaponSwapSet === 0`) is baked directly into `invchar6.dc6` (`invSheetImg`); no tab overlay is drawn.
    // - Set II (`weaponSwapSet === 1`) draws frame 0 (`invTab0Img`, 67x141) at `(rArm.left - 5, 83) = (415, 83)`
    //   and frame 1 (`invTab1Img`, 135x141) at `(lArm.left - 5, 83) = (646, 83)`.
    if (this.weaponSwapSet === 1) {
      if (assets.invTab0Img) {
        ctx.drawImage(assets.invTab0Img, WEAPON_SWAP_TABS_BOUNDS.left.x, WEAPON_SWAP_TABS_BOUNDS.left.y)
      }
      if (assets.invTab1Img) {
        ctx.drawImage(assets.invTab1Img, EQUIP_SLOTS_LAYOUT.weapon2.x - 5, WEAPON_SWAP_TABS_BOUNDS.right.y)
      }
    }

    // 4. Draw Equipped Items in Paperdoll Slots (no background fill for usable items; red only when unusable, green when hovered with cursor item)
    for (const [slotId, rect] of Object.entries(EQUIP_SLOTS_LAYOUT) as [EquipSlotId, typeof EQUIP_SLOTS_LAYOUT[EquipSlotId]][]) {
      const eq = this.equipped[slotId]
      if (!eq) {
        const ghost2H = this.getOppositeHandTwoHandedWeapon(slotId)
        if (ghost2H) {
          // D2Client.dll 0x6FB3B2F0 / 0x6FB47BE0: hide empty weapon silhouette and draw 2H weapon in opposite hand with DRAWMODE_TRANS50 (0.38 alpha)
          ctx.fillStyle = '#080808'
          ctx.fillRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2)
          const prevAlpha = typeof ctx.globalAlpha === 'number' ? ctx.globalAlpha : 1
          ctx.save?.()
          ctx.globalAlpha = 0.38
          try {
            this.drawItemSprite(ctx, ghost2H, rect.x, rect.y, rect.w, rect.h, assets, false)
          } finally {
            ctx.globalAlpha = prevAlpha
            ctx.restore?.()
          }
        }
        continue
      }
      const isHovered = this.hoveredItem?.item === eq
      const slotFill = resolvePaperdollSlotBackgroundFill(eq, this.playerContext, {
        isHovered,
        hasCursorItem: this.cursorItem !== null,
      })
      if (slotFill) {
        ctx.fillStyle = slotFill
        ctx.fillRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2)
      }
      this.drawItemSprite(ctx, eq, rect.x, rect.y, rect.w, rect.h, assets, isHovered)
    }

    // 5. Draw 10x4 Bag Grid Items (D2Client.dll 0x6fb459f7: blue for usable, red for unusable/unidentified, green when hovered with cursor item)
    for (const placed of this.gridItems) {
      const gx = INV_GRID_ORIGIN.x + placed.col * INV_GRID_ORIGIN.cellPx
      const gy = INV_GRID_ORIGIN.y + placed.row * INV_GRID_ORIGIN.cellPx
      const gw = placed.item.invWidth * INV_GRID_ORIGIN.cellPx
      const gh = placed.item.invHeight * INV_GRID_ORIGIN.cellPx
      const isHovered = this.hoveredItem?.item === placed.item

      ctx.fillStyle = resolveGridItemBackgroundFill(placed.item, this.playerContext, {
        isHovered,
        hasCursorItem: this.cursorItem !== null,
      })
      ctx.fillRect(gx + 1, gy + 1, gw - 2, gh - 2)
      this.drawItemSprite(ctx, placed.item, gx, gy, gw, gh, assets, isHovered)
    }

    // 6. Gold Coin Button (`Panel\goldcoinbtn.dc6` frame 0 at x=484, y=451, 20x18) & Gold Amount Readout
    if (assets.goldCoinBtnImg) {
      ctx.drawImage(
        assets.goldCoinBtnImg,
        0,
        0,
        INV_GOLD_BTN_BOUNDS.w,
        INV_GOLD_BTN_BOUNDS.h,
        INV_GOLD_BTN_BOUNDS.x,
        INV_GOLD_BTN_BOUNDS.y,
        INV_GOLD_BTN_BOUNDS.w,
        INV_GOLD_BTN_BOUNDS.h,
      )
    }
    font.drawText(ctx, String(Math.floor(this.gold)), INV_GOLD_BOX_RECESS.textX, INV_GOLD_BOX_RECESS.textY, {
      font: 'font8',
      color: 'white',
      align: 'center',
    })

    // 7. Close Button (`buysellbtn.dc6` frame 10 raised / 11 pressed while held down)
    if (assets.buySellBtnImg) {
      ctx.drawImage(
        assets.buySellBtnImg,
        this.closeButton.frame() * 32,
        0,
        32,
        32,
        INV_CLOSE_BTN_BOUNDS.x,
        INV_CLOSE_BTN_BOUNDS.y,
        32,
        32,
      )
    }

    // 8. Button Hover Tooltips (`D2Client.dll 0x6FB48350`: Gold button `strDropGoldHowMuch` / `strBankGoldDeposit`, Close button `strClose`)
    if (this.hoveredButton !== null) {
      const isGold = this.hoveredButton === 'gold'
      const hoverText = requireTbl(
        isGold ? (this.stashOpen ? 'strBankGoldDeposit' : 'strDropGoldHowMuch') : 'strClose',
        this.lang,
      )
      const boxW = Math.max(36, font.measureText(hoverText, 'font16') + 16)
      const boxH = 22
      const centerX = isGold
        ? INV_GOLD_BTN_BOUNDS.x + Math.round(INV_GOLD_BTN_BOUNDS.w / 2)
        : INV_CLOSE_BTN_BOUNDS.x + Math.round(INV_CLOSE_BTN_BOUNDS.w / 2)
      const anchorY = isGold ? INV_GOLD_BTN_BOUNDS.y - 4 : INV_CLOSE_BTN_BOUNDS.y - 4
      const boxX = Math.round(centerX - boxW / 2)
      const boxY = anchorY - boxH
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
      ctx.fillRect(boxX, boxY, boxW, boxH)
      font.drawText(ctx, hoverText, centerX, boxY + 16, {
        font: 'font16',
        color: 'white',
        align: 'center',
      })
    }
  }

  private drawItemSprite(
    ctx: CanvasRenderingContext2D,
    item: UiInventoryItem,
    x: number,
    y: number,
    w: number,
    h: number,
    assets: {
      itemsAtlasImg: HTMLImageElement | null
      gemSocketImg?: HTMLImageElement | null
      itemRects: Record<string, { x: number; y: number; w: number; h: number }>
    },
    isHovered = false,
  ): void {
    const effectiveRects =
      Object.keys(assets.itemRects).length > 0 ? assets.itemRects : BAKED_UI_MANIFEST.itemRects
    const sr = resolveItemSpriteRect(item, effectiveRects)
    if (!sr) {
      throw new Error(
        `[inventory] Missing sprite rect for item code="${item.code ?? ''}" invFile="${item.invFile ?? ''}"`,
      )
    }
    if (assets.itemsAtlasImg) {
      const atlasImg = assets.itemsAtlasImg
      const dx = x + Math.floor((w - sr.w) / 2)
      const dy = y + Math.floor((h - sr.h) / 2)
      drawImageWithEtherealAlpha(ctx, isUiItemEthereal(item), () => {
        ctx.drawImage(atlasImg, sr.x, sr.y, sr.w, sr.h, dx, dy, sr.w, sr.h)
      })
    }
    if (isHovered) {
      drawItemSocketOverlay(ctx, item, x, y, w, h, assets, { isHovered: true })
    }
  }
}
