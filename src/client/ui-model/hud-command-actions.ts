/**
 * HUD Command Actions (`src/client/ui-model/hud-command-actions.ts`).
 *
 * Implements `HudCommandSink` and NPC, inventory, belt, waypoint, quest, party, and artisan
 * command dispatchers operating on `HudModel` context.
 *
 * Zero imports from `src/netproto/{bncs,mcp,d2gs,crypto}/**` — consumes only `src/netproto/index.ts`.
 */

import {
  isNpcIntroMessageId,
  resolveNpcIntroMsgIdByTblKey,
} from '../../common/data/canonical-npc-dialog-table.ts'
import {
  getTownNpcDescriptorByHcIdx,
  NPC_CANONICAL_INTRO_KEYS,
  type TownNpcServiceDescriptor,
} from '../../common/units/npc-table.ts'
import { ClickButtonId } from '../../netproto/index.ts'
import { imbueUiInventoryItem113c } from '../../common/items/item-bridge.ts'
import { resolveItemDropSoundId113c } from '../audio/item-drop-sound-113c.ts'
import type { ClientCommand, Hand, ItemData } from '../../netproto/index.ts'
import { lookupTbl, requireTbl } from '../i18n/lang.ts'
import { BELT_COLS } from '../ui/belt.ts'
import type { BaseStatKey } from '../ui/character-sheet.ts'
import type { HudCommandSink } from '../ui/hud-manager.ts'
import type { EquipSlotId } from '../ui/inventory.ts'
import { GAMBLE_NPC_CLASS_IDS, getActQuests } from '../ui/world-panels.ts'
import { STAT_KEY_TO_D2_STAT_ID } from './hud-item-adapter.ts'
import { EQUIP_SLOT_TO_BODY_LOC } from './hud-skill-bonuses.ts'
import type { VendorPriceContext, VendorPriceFn, VendorRepairAllFn } from './vendor-price.ts'

export type { HudCommandSink }

/**
 * D2Client `0x6faf6f5c..0x6faf6fa5` Repair All button throttle (`0x7d0` = 2000 ms on `[0x6fbd3484]`).
 * Guarded by `mov eax, ds:0x6fbcbc90; test eax, eax; je 0x6faf6fac` (`g_bIsRepairAll`, set to 1
 * only at `0x6fb475c8..0x6fb475d9` for button `0x12`); buy (`0x32`), sell (`0x33`), and single-item
 * repair (`0x35` with `0x6fbcbc90 == 0`) jump to `0x6faf6fac` and bypass this cooldown (#1304).
 */
export const NPC_TRADE_THROTTLE_MS = 2000

/**
 * S2C `0x2A` NPCTransaction result -> `string.tbl` key of the message D2Client shows (indices 3356..3363).
 * Results 0 (buy), 1 (sell) and 2 (repair all) succeed silently; any other unknown code shows TransactionResults9.
 */
export function npcTransactionMessageKey(result: number): string | null {
  switch (result) {
    case 0:
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      return null
    case 7:
    case 8:
      return 'TransactionResults6' // 3358
    case 10:
      return 'TransactionResults4' // 3356
    case 11:
      return 'TransactionResults8' // 3360
    case 12:
      return 'TransactionResults10' // 3362
    case 14:
      return 'TransactionResults14'
    case 15:
      return 'TransactionResults11' // 3363
    case 16:
      return 'TransactionResults5' // 3357
    default:
      return 'TransactionResults9' // 3361
  }
}

/** Sound D2Client plays on a successful sell (S2C 0x2A result 1, 0x6fafb606 -> 0xdd = 221 item_gold). */
export const NPC_SELL_SOUND_ID = 0xdd

/** `UnitType` id of monsters / NPCs in `UnitRef`. */
export const UNIT_TYPE_MONSTER = 1

const RED_TEXT = 1
const ARTISAN_ANSWER_MS = 3000
const ARTISAN_NAMES: Readonly<Record<number, string>> = { 154: 'Charsi', 511: 'Larzuk', 512: 'Anya' }
const ARTISAN_WINDOWS = new Set(['imbue', 'add_sockets', 'personalize'])

const EQUIP_SLOT_ALIAS_MAP: Readonly<Record<string, number>> = {
  ...EQUIP_SLOT_TO_BODY_LOC,
  head: 1,
  neck: 2,
  torso: 3,
  rightHand: 4,
  leftHand: 5,
  rightRing: 6,
  leftRing: 7,
  feet: 9,
  hands: 10,
  altRightHand: 11,
  altLeftHand: 12,
} as const

const QUEST_ITEM_CODES = new Set([
  'box', 'leg', 'hfh', 'hst', 'msf', 'vip', 'j34', 'g34', 'xyz', 'g33', 'd33', 'bbb',
  'qey', 'qhr', 'qbr', 'qf1', 'qf2', 'mss', 'ice', 'tr1', 'tr2', 'bbr', 'bkd', 'bks',
  'hdm', 'ass', 'std', 'dhn', 'bey', 'mbr', 'toa', 'tes', 'ceh', 'bet', 'fed',
])

export function npcDescriptorImpl(model: any, npcId: number): TownNpcServiceDescriptor | undefined {
  return getTownNpcDescriptorByHcIdx(model.npcClassOf(npcId))
}

export function tryNpcDescriptorImpl(model: any, npcId: number): TownNpcServiceDescriptor | undefined {
  const unit = model.world.getUnit('monster', npcId)
  return unit ? getTownNpcDescriptorByHcIdx(unit.classId) : undefined
}

export function npcClassOfImpl(model: any, npcId: number): number {
  const unit = model.world.getUnit('monster', npcId)
  if (!unit) throw new Error(`HudModel: NPC unit #${npcId} is not in the world`)
  return unit.classId
}

export function priceContextImpl(model: any, npcId: number): VendorPriceContext {
  return { world: model.world, npcClass: model.npcClassOf(npcId) }
}

export function requireVendorPriceImpl(model: any): VendorPriceFn {
  if (!model.priceProvider) throw new Error('HudModel: no vendorPrice provider (HudModelOptions.vendorPrice)')
  return model.priceProvider
}

export function requireVendorRepairAllImpl(model: any): VendorRepairAllFn {
  if (!model.repairAllProvider) throw new Error('HudModel: no vendorRepairAll provider (HudModelOptions.vendorRepairAll)')
  return model.repairAllProvider
}

export function requireOpenStoreImpl(
  model: any,
  action: string,
): { npcId: number; gamble: boolean; ctx: VendorPriceContext } {
  const npc = model.world.npcInteraction
  if (npc.npcId === null || (npc.window !== 'trade' && npc.window !== 'gamble')) {
    throw new Error(`HudModel.${action}: no store window is open`)
  }
  return { npcId: npc.npcId, gamble: npc.window === 'gamble', ctx: model.priceContext(npc.npcId) }
}

export function isThrottledImpl(model: any, action: string): boolean {
  const t = model.now()
  const last = model.lastNpcActionAt.get(action)
  if (last !== undefined && t - last < NPC_TRADE_THROTTLE_MS) return true
  model.lastNpcActionAt.set(action, t)
  return false
}

export function requirePlayerItemImpl(model: any, itemId: number, action: string): ItemData {
  const c = model.world.containers
  const item = c.inventory.get(itemId) ?? c.equipment.get(itemId) ?? (c.cursor?.id === itemId ? c.cursor : undefined)
  if (!item) throw new Error(`HudModel.${action}: item #${itemId} is not carried by the player`)
  return item
}

export function playerItemModeImpl(model: any, item: ItemData): number {
  const c = model.world.containers
  if (c.cursor?.id === item.id || item.container === 'cursor' || item.location === 4) {
    return 4
  }
  if (c.equipment.has(item.id) || item.container === 'equipment' || item.location === 1) {
    return 1
  }
  return 0
}

export function findWorldItemImpl(model: any, itemId: number): ItemData | undefined {
  return (
    model.world.containers.allById.get(itemId) ??
    (model.world as any).items?.get?.(itemId) ??
    model.world.containers.inventory.get(itemId) ??
    model.world.containers.equipment.get(itemId) ??
    model.world.containers.stash.get(itemId) ??
    model.world.containers.cube.get(itemId) ??
    model.world.containers.tradeSelf?.get?.(itemId) ??
    model.world.containers.tradePartner?.get?.(itemId) ??
    (model.world.containers.cursor?.id === itemId ? model.world.containers.cursor : undefined)
  )
}

export function allocateStatImpl(model: any, key: BaseStatKey, count?: number): boolean {
  const statId = STAT_KEY_TO_D2_STAT_ID[key]
  if (count !== undefined && count > 1) {
    model.emitCommand({ type: 'AddStatPoint', statId, count })
  } else {
    model.emitCommand({ type: 'AddStatPoint', statId })
  }
  return true
}

export function allocateSkillImpl(model: any, skillId: number): boolean {
  model.emitCommand({ type: 'AddSkillPoint', skillId })
  return true
}

export function selectSkillImpl(model: any, hand: Hand, skillId: number, itemId = 0xffffffff): void {
  model.emitCommand({ type: 'SelectSkill', hand, skill: skillId, itemId })
}

export function assignSkillHotkeyImpl(
  model: any,
  slot: number,
  hand: Hand,
  skillId: number,
  itemId = 0xffffffff,
): void {
  if (!Number.isInteger(slot) || slot < 0 || slot > 15) return
  model.hadWorldSkillHotkeys = true
  model.world.assignSkillHotkey(slot, hand, skillId, itemId)
  if (model.hudManager?.hotkeys) {
    const key = slot < 8 ? `F${slot + 1}` : `SKILL${slot + 1}`
    if (skillId === 0xffff || skillId === 0x7fff || skillId < 0) {
      model.hudManager.hotkeys.bindings.delete(key)
    } else {
      model.hudManager.hotkeys.bindHotkey(key, hand, skillId)
    }
  }
  model.emitCommand({ type: 'AssignSkillHotkey', slot, hand, skill: skillId, itemId })
}

export function activateSkillHotkeyImpl(model: any, slot: number): boolean {
  if (!Number.isInteger(slot) || slot < 0 || slot > 15) return false
  const worldBinding = model.world.skillHotkeys.get(slot)
  if (worldBinding && worldBinding.skill >= 0 && worldBinding.skill !== 0xffff) {
    model.selectSkill(worldBinding.hand, worldBinding.skill, worldBinding.itemId ?? 0xffffffff)
    return true
  }
  const key = slot < 8 ? `F${slot + 1}` : `SKILL${slot + 1}`
  const hudBinding = model.hudManager?.hotkeys.bindings.get(key)
  if (hudBinding && hudBinding.skillId >= 0 && hudBinding.skillId !== 0xffff) {
    model.selectSkill(hudBinding.side, hudBinding.skillId, 0xffffffff)
    return true
  }
  return false
}

export function cycleBoundSkillsImpl(model: any, step: -1 | 1): boolean {
  const rightEntries: { slot: number; hand: Hand; skillId: number; itemId?: number }[] = []
  const allEntries: { slot: number; hand: Hand; skillId: number; itemId?: number }[] = []
  for (let slot = 0; slot < 16; slot++) {
    const wb = model.world.skillHotkeys.get(slot)
    const key = slot < 8 ? `F${slot + 1}` : `SKILL${slot + 1}`
    const hb = model.hudManager?.hotkeys.bindings.get(key)
    const hand: Hand | undefined = wb?.hand ?? hb?.side
    const skillId = wb?.skill ?? hb?.skillId
    if (!hand || skillId === undefined || skillId < 0 || skillId === 0xffff || skillId === 0x7fff) {
      continue
    }
    const entry = {
      slot,
      hand,
      skillId,
      ...(wb?.itemId !== undefined ? { itemId: wb.itemId } : {}),
    }
    allEntries.push(entry)
    if (hand === 'right') {
      rightEntries.push(entry)
    }
  }
  const pool = rightEntries.length > 0 ? rightEntries : allEntries
  if (pool.length === 0) return false

  const activeHand: Hand = rightEntries.length > 0 ? 'right' : pool[0]!.hand
  const currentSkillId =
    activeHand === 'right'
      ? (model.world.self.rightSkill || model.hudManager?.hotkeys.rightSkillId || 0)
      : (model.world.self.leftSkill || model.hudManager?.hotkeys.leftSkillId || 0)
  const currentIdx = pool.findIndex(e => e.hand === activeHand && e.skillId === currentSkillId)
  const nextIdx =
    currentIdx < 0
      ? step > 0
        ? 0
        : pool.length - 1
      : (currentIdx + step + pool.length) % pool.length
  const chosen = pool[nextIdx]!
  model.selectSkill(chosen.hand, chosen.skillId, chosen.itemId ?? 0xffffffff)
  return true
}

export function autoBeltItemImpl(model: any, itemId: number): boolean {
  if (!Number.isFinite(itemId) || itemId <= 0) return false
  // 1.13c D2Client.dll 0x6fb46ff8 / 0x6fb47000: play item_pickup (235) and emit C2S 0x63 ItemToBelt.
  model.uiSound?.(235)
  model.hudManager?.onPlayUiSound?.(235)
  model.world.pushSoundRequest?.({ soundId: 235 })
  model.emitCommand({ type: 'ItemToBelt', itemId: itemId >>> 0 })
  return true
}

export function useBeltSlotImpl(model: any, slotIndex: number, shift = false): boolean {
  if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex >= 16) return false
  const bySlot = model.world.containers.beltBySlot?.get(slotIndex)
  const beltItems: ItemData[] = [...model.world.containers.belt.values()]
  const getSlot = (it: ItemData): number => it.gridX ?? it.x ?? 0
  const exact = bySlot ?? beltItems.find((it) => getSlot(it) === slotIndex)
  const beltItem =
    exact ??
    (slotIndex < BELT_COLS
      ? beltItems
          .filter((it) => getSlot(it) >= 0 && getSlot(it) % BELT_COLS === slotIndex)
          .sort((a, b) => getSlot(a) - getSlot(b))[0]
      : undefined)
  if (!beltItem) return false
  if (shift) {
    // 1.13c D2Client.dll 0x6fad9a56..0x6fad9b0b:
    // Requires a living mercenary (`0x6fad9a6a`); mercenaries only accept healing ('healpotion')
    // and rejuvenation ('rejuvpotion') potions. Mana, Stamina, Antidote, and Thawing potions are
    // rejected with speech 0x55 ("I can't use that").
    const merc = model.world.merc ?? model.hudManager?.merc
    if (!merc || merc.isDead) {
      return false
    }
    const code = (beltItem.code ?? '').trim().toLowerCase()
    const isMercConsumable = /^(hp[1-5]|hpo|hpf|rvs|rvl)$/.test(code)
    const mercClassId = merc.classId ?? merc.hcIdx ?? 0
    if (!isMercConsumable) {
      const cantUseSoundId = mercClassId === 271 ? 4612 : 4616
      if (model.uiSound) model.uiSound(cantUseSoundId)
      else model.hudManager?.onPlayUiSound?.(cantUseSoundId)
      model.world.pushSoundRequest?.({ soundId: cantUseSoundId })
      return false
    }
    const thanksSoundId = mercClassId === 271 ? 4615 : 4625
    if (model.uiSound) model.uiSound(thanksSoundId)
    else model.hudManager?.onPlayUiSound?.(thanksSoundId)
    model.world.pushSoundRequest?.({ soundId: thanksSoundId })
    model.emitCommand({
      type: 'BeltUse',
      itemId: beltItem.id >>> 0,
      useOnMerc: 1,
    })
  } else {
    model.emitCommand({
      type: 'BeltUse',
      itemId: beltItem.id >>> 0,
      shift: false,
    })
  }
  return true
}

export function swapEquipItemImpl(model: any, itemId: number, slot: EquipSlotId | string | number): void {
  const bodyLoc = typeof slot === 'number' ? slot : EQUIP_SLOT_ALIAS_MAP[slot]
  if (!Number.isFinite(itemId) || itemId <= 0 || !Number.isFinite(bodyLoc) || bodyLoc! <= 0) return
  model.emitCommand({ type: 'ItemSwap', itemId: itemId >>> 0, slot: bodyLoc! >>> 0 })
}

export function swap2HandedItemImpl(model: any, itemId: number, slot: EquipSlotId | string | number): void {
  const bodyLoc = typeof slot === 'number' ? slot : EQUIP_SLOT_ALIAS_MAP[slot]
  if (!Number.isFinite(itemId) || itemId <= 0 || !Number.isFinite(bodyLoc) || bodyLoc! <= 0) return
  model.emitCommand({ type: 'ItemSwap2Handed', itemId: itemId >>> 0, slot: bodyLoc! >>> 0 })
}

export function swap2HandedDualImpl(model: any, itemId: number, slot: EquipSlotId | string | number): void {
  const bodyLoc = typeof slot === 'number' ? slot : EQUIP_SLOT_ALIAS_MAP[slot]
  if (!Number.isFinite(itemId) || itemId <= 0 || !Number.isFinite(bodyLoc) || bodyLoc! <= 0) return
  model.emitCommand({ type: 'ItemSwap2HandedDual', itemId: itemId >>> 0, slot: bodyLoc! >>> 0 })
}

export function swapContainerItemImpl(
  model: any,
  cursorItemId: number,
  targetItemId: number,
  x: number,
  y: number,
  _container?: number,
): void {
  if (
    !Number.isFinite(cursorItemId) ||
    cursorItemId <= 0 ||
    !Number.isFinite(targetItemId) ||
    targetItemId <= 0
  ) {
    return
  }
  if (x < 0 || y < 0) return
  model.emitCommand({
    type: 'SwapContainerItem',
    cursorItemId: cursorItemId >>> 0,
    targetItemId: targetItemId >>> 0,
    replacedItemId: targetItemId >>> 0,
    x: x >>> 0,
    y: y >>> 0,
  })
}

export function putBeltItemImpl(model: any, itemId: number, slot: number): void {
  if (!Number.isFinite(itemId) || itemId <= 0 || !Number.isFinite(slot) || slot < 0 || slot >= 16) return
  model.emitCommand({ type: 'BeltPut', itemId: itemId >>> 0, slot: slot >>> 0 })
}

export function removeBeltItemImpl(model: any, itemId: number): void {
  if (!Number.isFinite(itemId) || itemId <= 0) return
  model.emitCommand({ type: 'BeltRemove', itemId: itemId >>> 0 })
}

export function swapBeltItemImpl(model: any, cursorItemId: number, beltItemId: number): void {
  if (!Number.isFinite(cursorItemId) || cursorItemId <= 0 || !Number.isFinite(beltItemId) || beltItemId <= 0) return
  model.emitCommand({ type: 'BeltSwap', cursorItemId: cursorItemId >>> 0, beltItemId: beltItemId >>> 0 })
}

export function identifyItemImpl(model: any, itemId: number, scrollId: number): void {
  if (!Number.isFinite(itemId) || itemId <= 0 || !Number.isFinite(scrollId) || scrollId <= 0) return
  model.emitCommand({ type: 'IdentifyItem', itemId: itemId >>> 0, scrollId: scrollId >>> 0 })
}

export function socketItemImpl(model: any, itemId: number, targetItemId: number): void {
  if (!Number.isFinite(itemId) || itemId <= 0 || !Number.isFinite(targetItemId) || targetItemId <= 0) return
  const targetItem = model.findWorldItem(targetItemId)
  if (targetItem) {
    const maxSockets = (targetItem as any).sockets ?? targetItem.totalSockets ?? 0
    if (maxSockets > 0) {
      const used = model.world.containers.sockets.get(targetItemId)?.length ?? 0
      if (used >= maxSockets) return
    }
  }
  model.emitCommand({ type: 'SocketItem', itemId: itemId >>> 0, targetItemId: targetItemId >>> 0 })
}

export function scrollToBookImpl(model: any, scrollId: number, bookId: number): void {
  if (!Number.isFinite(scrollId) || scrollId <= 0 || !Number.isFinite(bookId) || bookId <= 0) return
  const scroll = model.findWorldItem(scrollId)
  const book = model.findWorldItem(bookId)
  if (scroll && book) {
    const sCode = scroll.code.trim()
    const bCode = book.code.trim()
    const compatible = (sCode === 'isc' && bCode === 'ibk') || (sCode === 'tsc' && bCode === 'tbk')
    if (!compatible) return
  }
  model.emitCommand({ type: 'ScrollToBook', scrollId: scrollId >>> 0, bookId: bookId >>> 0 })
}

export function playNpcMessageImpl(model: any, classId: number): void {
  if (!Number.isFinite(classId) || classId < 0) return
  const id = classId & 0xffff
  model.emitCommand({
    type: 'PlayNpcMessage',
    classId: id,
  })
}

export function questMessageImpl(model: any, npcId: number, messageId = 0): void {
  if (!Number.isFinite(npcId) || (npcId <= 0 && (npcId >>> 0) !== 0xffffffff)) return
  model.emitCommand({ type: 'QuestMessage', npcId: npcId >>> 0, messageId: messageId >>> 0 })
}

export function npcEntityActionImpl(model: any, action: number, npcId: number, complement = 0): void {
  if (!Number.isFinite(npcId) || npcId <= 0) return
  model.emitCommand({
    type: 'NpcEntityAction',
    action: action | 0,
    npcId: npcId >>> 0,
    complement: complement >>> 0,
  })
}

export function hireMercImpl(model: any, npcId: number, mercId: number): void {
  if (!Number.isFinite(npcId) || npcId <= 0 || !Number.isFinite(mercId) || mercId <= 0) return
  // Issue #994: Hiring a new mercenary (C2S 0x36 MercHire) replaces any existing mercenary
  // ("This Mercenary will replace your current one.") and destroys its inventory on D2GS without
  // sending per-item 0x9D Unequip packets. Clear client-side mercenary equipment & cached HUD state.
  model.world?.containers?.clearMerc?.()
  model.cachedMercEquipped = null
  model.cachedMercEquipment = null
  if (model.world?.merc) {
    model.world.merc.exp = undefined
    model.world.merc.stats?.clear?.()
  }
  model.emitCommand({ type: 'MercHire', npcId: npcId >>> 0, mercId: mercId >>> 0 })
  if (model.hudManager) {
    if (model.hudManager.leftPanel === 'hire') {
      model.hudManager.leftPanel = 'none'
    }
    const wp = model.hudManager.worldPanels as any
    if (wp?.activePanel === 'hire') {
      wp.activePanel = 'none'
    }
    if (wp) {
      wp.hoveredMercItem = null
    }
  }
  // D2Client.dll 0x6faf7570 / 0x6faf90f0 -> 0x6faf7b20: send C2S 0x30 NpcCancel when closing
  // the Hire dialog so D2Game SCMD_NpcCancel (0x6fced480) clears pPlayer->bInteracting;
  // otherwise SCMD_MercItem (0x6fcf0bc0 @ 0x6fcf0bea) rejects all subsequent C2S 0x61 MercItem packets.
  model.cancelNpcSession(npcId >>> 0)
}

export function resurrectMercImpl(model: any, npcId?: number): void {
  const resolvedNpcId =
    npcId ??
    model.world.npcInteraction.npcId ??
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcUnitId ??
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcId ??
    (model.hudManager?.worldPanels as any)?.activeNpcId ??
    0
  if (!Number.isFinite(resolvedNpcId) || resolvedNpcId <= 0) return
  model.emitCommand({ type: 'MercResurrect', npcId: resolvedNpcId >>> 0 })
  // D2Client.dll 0x6faf8dd0 -> 0x6faf8150 -> 0x6faf7b20: send C2S 0x30 NpcCancel after MercResurrect (0x62)
  // so D2Game SCMD_NpcCancel (0x6fced480) clears pPlayer->bInteracting.
  model.cancelNpcSession(resolvedNpcId >>> 0)
}

export function mercItemImpl(model: any, slot: number): void {
  if (!Number.isFinite(slot) || slot < 0 || slot > 12) return
  // D2Game.dll 0x6fcf0bc0 (@ 0x6fcf0bea): SCMD_MercItem aborts with return 3 if pPlayer->bInteracting != 0.
  // Ensure any lingering NPC session is cancelled via C2S 0x30 NpcCancel before sending C2S 0x61 MercItem.
  const activeNpcId =
    model.world.npcInteraction.npcId ??
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcUnitId ??
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcId ??
    null
  if (activeNpcId !== null && activeNpcId > 0) {
    model.cancelNpcSession(activeNpcId >>> 0)
  }
  // D2Game.dll 0x6fcefbc0 & 0x6fceece0: mercenary weapons (1H or 2H) always equip into bodyLoc 4 (rArm),
  // while 2H weapons render a phantom in slot 5 (lArm). When unequipping with an empty cursor from slot 5
  // and slot 5 has no independent offhand item (e.g. Act 3 shield), target slot 4 where the weapon resides.
  const hasCursor = Boolean(model.world.containers.cursor ?? model.hudManager?.inventory?.cursorItem)
  let resolvedSlot = slot & 0xffff
  if (!hasCursor && resolvedSlot === 5) {
    const wp = model.hudManager?.worldPanels as any
    const m = wp?.merc
    const eq = m?.equipped ?? m?.equipment ?? wp?.mercEquipped
    const hasOffhand = Boolean(
      model.world.containers.mercBySlot.get(5) ??
        m?.shieldItem ??
        m?.offhandItem ??
        eq?.leftHand ??
        eq?.weapon2,
    )
    const hasWeapon = Boolean(
      model.world.containers.mercBySlot.get(4) ??
        m?.weaponItem ??
        eq?.rightHand ??
        eq?.weapon1,
    )
    if (!hasOffhand && hasWeapon) {
      resolvedSlot = 4
    }
  }
  model.emitCommand({ type: 'MercItem', slot: resolvedSlot })
}

export function resurrectImpl(model: any): void {
  model.emitCommand({ type: 'Resurrect' })
}

export function partyActionImpl(model: any, action: number, targetPlayerId: number): void {
  const act = action & 0xff
  const resolvedTarget =
    act === 0x09 && (!Number.isFinite(targetPlayerId) || targetPlayerId <= 0)
      ? (model.world.selfId || 0) >>> 0
      : targetPlayerId
  if (!Number.isFinite(resolvedTarget) || (resolvedTarget <= 0 && act !== 0x09)) return
  model.emitCommand({ type: 'PartyAction', action: act, targetPlayerId: resolvedTarget >>> 0 })
}

export function setHostileImpl(model: any, targetPlayerId: number, hostile: boolean | number, button = 1): void {
  if (!Number.isFinite(targetPlayerId) || targetPlayerId <= 0) return
  if (button === 1) return
  model.emitCommand({
    type: 'Hostile',
    targetPlayerId: targetPlayerId >>> 0,
    hostile: Boolean(hostile),
    button: button === 2 ? 2 : 1,
  })
}

export function clickButtonImpl(model: any, buttonId: number, complement = 0): void {
  const btn = buttonId & 0xffff
  const trade = model.world?.trade
  if (trade) {
    // D2Client.dll 0x6fb09600 / 0x6fb095c0 / 0x6fb09740:
    // Local trade button clicks mutate client state immediately because D2Game.dll (0x6fc90750)
    // only sends S2C 0x77 0x05 (PartnerAccepted) to the partner, not 0x77 0x04 back to self.
    if (btn === 0x02) {
      trade.pendingModal = null
      trade.active = false
      trade.selfAccepted = false
      trade.partnerAccepted = false
      trade.acceptDisabled = false
      trade.partnerGold = 0
      trade.selfGold = 0
      model.world?.containers?.clearTrade?.()
    } else if (btn === 0x03) {
      trade.pendingModal = null
    } else if (btn === 0x04) {
      if (!trade.acceptDisabled) {
        trade.selfAccepted = true
      }
    } else if (btn === 0x07) {
      trade.selfAccepted = false
    } else if (btn === 0x08) {
      trade.selfGold = complement >>> 0
      trade.selfAccepted = false
      trade.partnerAccepted = false
    }
  }
  model.emitCommand({
    type: 'ClickButton',
    button: btn,
    buttonId: btn,
    complement: complement >>> 0,
    amount: complement >>> 0,
  })
}

export function confirmQuestRewardImpl(model: any, itemId: number, explicitNpcId?: number): void {
  if (!Number.isFinite(itemId) || itemId <= 0) return
  const isOrifice =
    model.world.npcInteraction.window === 'orifice' ||
    model.world.npcInteraction.activeWindow === 'orifice' ||
    model.hudManager?.leftPanel === 'orifice' ||
    (model.hudManager?.worldPanels as any)?.activePanel === 'orifice'
  const wasImbue =
    model.world.npcInteraction.window === 'imbue' ||
    model.world.npcInteraction.activeWindow === 'imbue' ||
    model.hudManager?.leftPanel === 'imbue' ||
    (model.hudManager?.worldPanels as any)?.activePanel === 'imbue'
  const wasAddSockets =
    model.world.npcInteraction.window === 'add_sockets' ||
    model.world.npcInteraction.activeWindow === 'add_sockets' ||
    model.hudManager?.leftPanel === 'add_sockets' ||
    (model.hudManager?.worldPanels as any)?.activePanel === 'add_sockets'
  let npcId =
    explicitNpcId ||
    model.world.npcInteraction.npcId ||
    model.world.npcInteraction.infoNpcId ||
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcUnitId ||
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcId ||
    (model.hudManager?.worldPanels as any)?.activeNpcId ||
    (model.hudManager?.worldPanels as any)?.vendorNpcId ||
    0
  if (!isOrifice && npcId <= 0 && model.world.units?.values) {
    const targetClassId = wasImbue ? 154 : wasAddSockets ? 511 : 512
    for (const u of model.world.units.values()) {
      if (u && (u.unitType === 'monster' || u.type === 1) && u.classId === targetClassId) {
        npcId = u.id
        break
      }
    }
  }
  if (isOrifice) {
    ;(model.world.npcInteraction as any).window = 'none'
    ;(model.world.npcInteraction as any).activeWindow = 'none'
    ;(model.world.npcInteraction as any).npcId = null
    if (model.hudManager) {
      ;(model.hudManager.worldPanels as any).questRewardItem = null
      ;(model.hudManager.worldPanels as any).activeNpcId = null
      if (model.hudManager.leftPanel === 'orifice') {
        model.hudManager.leftPanel = 'none'
      }
      if ((model.hudManager.worldPanels as any).activePanel === 'orifice') {
        ;(model.hudManager.worldPanels as any).activePanel = 'none'
      }
    }
    model.emitCommand({
      type: 'StaffInOrifice',
      orificeObjectId: npcId >>> 0,
      staffItemId: itemId >>> 0,
      state: 3,
      playerUnitId: (model.world.selfId || 0xffffffff) >>> 0,
    })
    return
  }
  const slotUiItem = (model.hudManager?.worldPanels as any)?.questRewardItem ?? null
  if (
    wasImbue &&
    slotUiItem &&
    !model.world.containers.allById.has(itemId) &&
    model.world.containers.cursor?.id !== itemId
  ) {
    const rawCode = String(slotUiItem.code ?? '').trim() || 'cap'
    const rawQuality =
      slotUiItem.quality === 'low'
        ? 1
        : slotUiItem.quality === 'superior'
          ? 3
          : typeof slotUiItem.quality === 'number'
            ? slotUiItem.quality
            : 2
    const synthItem: ItemData = {
      id: itemId >>> 0,
      code: rawCode,
      name: slotUiItem.name ?? rawCode,
      width: slotUiItem.width ?? 1,
      height: slotUiItem.height ?? 1,
      quality: rawQuality,
      identified: slotUiItem.identified !== false,
      ethereal: Boolean(slotUiItem.ethereal),
      socketed: Boolean(slotUiItem.sockets && slotUiItem.sockets > 0),
      totalSockets: Number(slotUiItem.sockets ?? 0),
      usedSockets: Array.isArray(slotUiItem.socketedItems) ? slotUiItem.socketedItems.length : 0,
      level: Number(slotUiItem.itemLevel ?? slotUiItem.level ?? 1),
      stats: [],
      container: 'cursor',
      location: 4,
    } as any
    ;(model.world.containers as any).applyItemEvent?.(
      0x02,
      synthItem,
      'cursor',
      model.world.selfId || 1,
    )
  }
  model.pendingArtisanConfirmNpcId = npcId > 0 ? npcId : null
  if (model.hudManager) {
    ;(model.hudManager.worldPanels as any).questRewardItem = null
    ;(model.hudManager.worldPanels as any).hoveredQuestRewardItem = null
    if (
      model.hudManager.leftPanel === 'imbue' ||
      model.hudManager.leftPanel === 'add_sockets' ||
      model.hudManager.leftPanel === 'personalize'
    ) {
      model.hudManager.leftPanel = 'none'
    }
    if (
      (model.hudManager.worldPanels as any).activePanel === 'imbue' ||
      (model.hudManager.worldPanels as any).activePanel === 'add_sockets' ||
      (model.hudManager.worldPanels as any).activePanel === 'personalize'
    ) {
      ;(model.hudManager.worldPanels as any).activePanel = 'none'
    }
    model.hudManager.rightPanel = 'inv'
    model.hudManager.inventory.visible = true
  }
  model.emitCommand({
    type: 'NpcEntityAction',
    action: 0,
    npcId: npcId >>> 0,
    complement: itemId >>> 0,
  })
  if (
    wasImbue &&
    model.world.containers.cursor?.quality !== 6 &&
    (model.world.containers.cursor?.quality as any) !== 'rare'
  ) {
    model.world.executeCharsiImbue(itemId, npcId, { force: true } as any)
  }
  if (model.hudManager) {
    model.syncFromWorld()
    if (wasImbue && slotUiItem && model.hudManager.inventory.cursorItem?.quality !== 'rare') {
      try {
        const playerLevel = Math.max(
          1,
          model.world.self.level || model.world.self.stats.get(12) || 8,
        )
        const imbuedUi = imbueUiInventoryItem113c(slotUiItem, playerLevel)
        model.hudManager.inventory.cursorItem = imbuedUi
        model.hudManager.inventory.gridItems = model.hudManager.inventory.gridItems.filter(
          (g: any) => String(g.item?.id) !== String(itemId),
        )
        model.lastSyncedCursorItemRef = model.hudManager.inventory.cursorItem
        model.lastSyncedGridItemsRef = model.hudManager.inventory.gridItems
      } catch {
        // Keep existing cursorItem if ineligible
      }
    }
  }
  const artisan = ARTISAN_NAMES[model.world.getUnit('monster', npcId)?.classId ?? -1]
  if (artisan !== undefined) {
    setTimeout(() => {
      if (model.world.awaitingArtisanConfirmNpcId === npcId && model.world.containers.cursor?.id === itemId) model.world.addLocalSystemMessage(`${artisan} didn't answer. Stand next to ${artisan} and try again.`, RED_TEXT)
    }, ARTISAN_ANSWER_MS)
  }
}

export function closeHoradricOrificeImpl(model: any, explicitOrificeId?: number): void {
  const returnedSlotItem = (model.hudManager?.worldPanels as any)?.questRewardItem ?? null
  if (model.hudManager) {
    if (returnedSlotItem) {
      if (!model.hudManager.inventory.cursorItem) {
        model.hudManager.inventory.cursorItem = returnedSlotItem
      } else {
        model.hudManager.inventory.autoPlaceInGrid(returnedSlotItem)
      }
      ;(model.hudManager.worldPanels as any).questRewardItem = null
    }
    ;(model.hudManager.worldPanels as any).hoveredQuestRewardItem = null
  }
  const orificeId =
    explicitOrificeId ??
    model.world.npcInteraction.npcId ??
    (model.hudManager?.worldPanels as any)?.activeNpcId ??
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcUnitId ??
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcId ??
    null
  model.pendingArtisanConfirmNpcId = null
  ;(model.world.npcInteraction as any).window = 'none'
  ;(model.world.npcInteraction as any).activeWindow = 'none'
  ;(model.world.npcInteraction as any).npcId = null
  if (model.hudManager) {
    ;(model.hudManager.worldPanels as any).activeNpcId = null
    if (typeof model.hudManager.hideLeftPanelFromWorld === 'function') {
      model.hudManager.hideLeftPanelFromWorld('orifice')
    }
    if (model.hudManager.leftPanel === 'orifice') {
      model.hudManager.leftPanel = 'none'
    }
    if ((model.hudManager.worldPanels as any).activePanel === 'orifice') {
      ;(model.hudManager.worldPanels as any).activePanel = 'none'
    }
  }
  if (orificeId !== null && orificeId > 0) {
    const cmd: ClientCommand = {
      type: 'StaffInOrifice',
      orificeObjectId: orificeId >>> 0,
      staffItemId: 0,
      state: 2,
      playerUnitId: (model.world.selfId || 0xffffffff) >>> 0,
    }
    model.world.noteOutgoingCommand?.(cmd)
    model.emitCommand(cmd)
  }
  model.syncFromWorld?.()
  if (
    returnedSlotItem &&
    model.hudManager &&
    !model.hudManager.inventory.cursorItem &&
    !model.world.containers?.cursor
  ) {
    model.hudManager.inventory.cursorItem = returnedSlotItem
    model.lastSyncedCursorItemRef = returnedSlotItem
    model.hudManager.syncPublishedState?.()
  }
}

export function closeActiveNpcPanelImpl(model: any): void {
  const wasOrifice =
    model.world.npcInteraction.window === 'orifice' ||
    model.world.npcInteraction.activeWindow === 'orifice' ||
    model.hudManager?.leftPanel === 'orifice' ||
    (model.hudManager?.worldPanels as any)?.activePanel === 'orifice'
  const isObjectInteraction = model.world.npcInteraction.unitType === 2
  if (model.hudManager) {
    if ((model.hudManager.worldPanels as any)?.questRewardItem) {
      if (!model.hudManager.inventory.cursorItem) {
        model.hudManager.inventory.cursorItem = (model.hudManager.worldPanels as any).questRewardItem
      } else {
        model.hudManager.inventory.autoPlaceInGrid((model.hudManager.worldPanels as any).questRewardItem)
      }
      ;(model.hudManager.worldPanels as any).questRewardItem = null
    }
    ;(model.hudManager.worldPanels as any).hoveredQuestRewardItem = null
  }
  const npcId =
    model.world.npcInteraction.npcId ??
    model.pendingArtisanConfirmNpcId ??
    (model.world as any).awaitingArtisanConfirmNpcId ??
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcUnitId ??
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcId ??
    (model.hudManager?.worldPanels as any)?.npcSpeech?.npcUnitId ??
    (model.hudManager?.worldPanels as any)?.npcSpeech?.npcId ??
    (model.hudManager?.worldPanels as any)?.activeNpcId ??
    null
  model.pendingArtisanConfirmNpcId = null
  if (wasOrifice) {
    closeHoradricOrificeImpl(model, npcId ?? undefined)
    model.hudManager?.closeAllPanels()
    return
  }
  if (npcId !== null && npcId > 0 && !isObjectInteraction) {
    model.closeNpc(npcId)
  }
  model.hudManager?.closeAllPanels()
}

export function completeOrificeUiImpl(model: any, extra = 0): void {
  model.uiSound?.(extra !== 0 ? 5 : 3)
  model.pendingArtisanConfirmNpcId = null
  ;(model.world.npcInteraction as any).window = 'none'
  ;(model.world.npcInteraction as any).activeWindow = 'none'
  ;(model.world.npcInteraction as any).npcId = null
  if (model.hudManager) {
    ;(model.hudManager.worldPanels as any).questRewardItem = null
    ;(model.hudManager.worldPanels as any).activeNpcId = null
    if (model.hudManager.leftPanel === 'orifice') {
      model.hudManager.leftPanel = 'none'
    }
    if ((model.hudManager.worldPanels as any).activePanel === 'orifice') {
      ;(model.hudManager.worldPanels as any).activePanel = 'none'
    }
  }
}

export function completeArtisanUiImpl(model: any, _uiId: 6 | 7, explicitNpcId?: number): void {
  const cancelNpcId =
    explicitNpcId ||
    model.pendingArtisanConfirmNpcId ||
    (model.world as any).awaitingArtisanConfirmNpcId ||
    model.world.npcInteraction.npcId ||
    (model.hudManager?.worldPanels as any)?.activeNpcId ||
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcUnitId ||
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcId ||
    0
  model.pendingArtisanConfirmNpcId = null
  ;(model.world.npcInteraction as any).window = 'none'
  ;(model.world.npcInteraction as any).activeWindow = 'none'
  ;(model.world.npcInteraction as any).npcId = null
  if (model.hudManager) {
    const wp = model.hudManager.worldPanels as any
    wp.questRewardItem = null
    wp.hoveredQuestRewardItem = null
    wp.npcMenu = null
    wp.npcSpeech = null
    wp.activeNpcId = null
    if (
      model.hudManager.leftPanel === 'imbue' ||
      model.hudManager.leftPanel === 'add_sockets' ||
      model.hudManager.leftPanel === 'personalize' ||
      model.hudManager.leftPanel === 'orifice'
    ) {
      model.hudManager.leftPanel = 'none'
    }
    if (
      wp.activePanel === 'imbue' ||
      wp.activePanel === 'add_sockets' ||
      wp.activePanel === 'personalize' ||
      wp.activePanel === 'orifice'
    ) {
      wp.activePanel = 'none'
    }
    model.hudManager.rightPanel = 'inv'
    model.hudManager.inventory.visible = true
  }
  if (cancelNpcId > 0) {
    model.closeNpc(cancelNpcId)
  } else if (model.hudManager) {
    model.syncFromWorld()
  }
}

export function openArtisanWindowImpl(
  model: any,
  kind: 'imbue' | 'add_sockets' | 'personalize' | 'orifice',
  npcId?: number,
): void {
  model.pendingArtisanConfirmNpcId = null
  const resolvedNpcId =
    npcId ||
    model.world.npcInteraction.npcId ||
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcUnitId ||
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcId ||
    (model.hudManager?.worldPanels as any)?.activeNpcId ||
    0
  ;(model.world.npcInteraction as any).window = kind
  ;(model.world.npcInteraction as any).activeWindow = kind
  if (resolvedNpcId > 0) {
    ;(model.world.npcInteraction as any).npcId = resolvedNpcId
  }
  if (model.hudManager) {
    model.hudManager.leftPanel = kind as any
    ;(model.hudManager.worldPanels as any).activePanel = kind
    ;(model.hudManager.worldPanels as any).npcMenu = null
    ;(model.hudManager.worldPanels as any).npcSpeech = null
    if (resolvedNpcId > 0) {
      ;(model.hudManager.worldPanels as any).activeNpcId = resolvedNpcId
    }
    if (model.hudManager.rightPanel !== 'inv') {
      model.hudManager.toggleRightPanel('inv')
    }
    model.hudManager.inventory.visible = true
  }
}

export function handleNpcMenuActionImpl(
  model: any,
  actionId: string,
  npcId?: number,
  descriptor?: TownNpcServiceDescriptor,
): void {
  const resolvedNpcId =
    npcId ||
    model.world.npcInteraction.npcId ||
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcUnitId ||
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcId ||
    (model.hudManager?.worldPanels as any)?.activeNpcId ||
    0
  if (model.hudManager && resolvedNpcId > 0) {
    ;(model.hudManager.worldPanels as any).activeNpcId = resolvedNpcId
  }
  const resolvedDesc: TownNpcServiceDescriptor | undefined =
    descriptor ??
    (model.hudManager?.worldPanels as any)?.npcMenu?.descriptor ??
    (resolvedNpcId > 0 ? model.tryNpcDescriptor(resolvedNpcId) : undefined)

  if (actionId === 'talk_quest' || actionId.startsWith('talk_quest:')) {
    const parsedId = actionId.startsWith('talk_quest:')
      ? Number.parseInt(actionId.slice('talk_quest:'.length), 10)
      : Number.NaN
    const npcMessages =
      (resolvedNpcId > 0 ? model.world.getNpcMessages(resolvedNpcId) : undefined) ??
      model.world.npcInteraction.messages
    const firstMsg = npcMessages?.[0]
    const fallbackId = typeof firstMsg === 'number' ? firstMsg : (firstMsg?.stringId ?? 0)
    const msgId = Number.isFinite(parsedId)
      ? parsedId
      : fallbackId
    model.questMessage(resolvedNpcId, msgId)
    model.requestQuestData()
    return
  }

  switch (actionId) {
    case 'talk': {
      // D2Client.dll 0x6faf9dc0: clicking Talk only builds and displays the Talk submenu
      // (Introduction, Gossip, and active Quest topics); C2S 0x31 is sent when a topic is clicked.
      break
    }
    case 'talk_intro':
    case 'introduction': {
      if (resolvedDesc) {
        model.world.markNpcIntroPlayed(model.world.act, resolvedDesc.hcIdx)
        const npcMessages =
          (resolvedNpcId > 0 ? model.world.getNpcMessages(resolvedNpcId) : undefined) ??
          model.world.npcInteraction.messages
        const introMsg = npcMessages?.find((m: any) => m.stringId > 0 && isNpcIntroMessageId(m.stringId))
        if (introMsg && resolvedNpcId > 0) {
          model.questMessage(resolvedNpcId, introMsg.stringId)
        } else {
          // No S2C 0x27 intro slot (e.g. Warriv on a fresh character): acknowledge the
          // greeting server-side with C2S 0x31 via the canonical intro msgId so D2GS stops
          // re-asserting S2C 0x8A. C2S 0x4D PlayNpcMessage does not clear the `!` flag.
          const introMsgId = resolveNpcIntroMsgIdByTblKey(
            NPC_CANONICAL_INTRO_KEYS[resolvedDesc.npcTxtKey] ?? resolvedDesc.npcTxtKey,
          )
          if (introMsgId !== undefined && resolvedNpcId > 0) {
            model.questMessage(resolvedNpcId, introMsgId)
          } else {
            model.playNpcMessage(resolvedDesc.hcIdx)
          }
        }
      }
      break
    }
    case 'talk_gossip':
    case 'gossip': {
      if (resolvedDesc) {
        model.playNpcMessage(resolvedDesc.hcIdx)
      }
      break
    }
    case 'identify': {
      model.identifyAllAtNpc(resolvedNpcId)
      break
    }
    case 'respec': {
      model.activeMenu = {
        title: model.activeMenu?.title ?? (resolvedDesc?.displayName ?? 'Akara'),
        options: [
          {
            id: 'confirm_respec',
            label: requireTbl('ResetStatSkillPoints', 'CHI'),
            enabled: true,
          },
          {
            id: 'cancel',
            label: requireTbl('lowercasecancel', 'CHI'),
            enabled: true,
          },
        ],
      }
      if (model.hudManager?.worldPanels) {
        const wp = model.hudManager.worldPanels as any
        if (wp.npcMenu) {
          wp.npcMenu = {
            ...wp.npcMenu,
            submenu: 'respec',
            options: [
              {
                id: 'confirm_respec',
                strIdx: 11168,
                label: requireTbl('ResetStatSkillPoints', wp.lang ?? 'CHI'),
                labelZh: requireTbl('ResetStatSkillPoints', 'CHI'),
                labelEn: requireTbl('ResetStatSkillPoints', 'ENG'),
              },
              {
                id: 'cancel',
                strIdx: 4142,
                label: requireTbl('lowercasecancel', wp.lang ?? 'CHI'),
                labelZh: requireTbl('lowercasecancel', 'CHI'),
                labelEn: requireTbl('lowercasecancel', 'ENG'),
              },
            ],
            hoveredOptionIdx: -1,
          }
        }
      }
      break
    }
    case 'confirm_respec': {
      // D2Client.dll 0x6faf90d0: send C2S 0x30 NpcCancel (0x6faf8150) first, then C2S 0x38 action 0,
      // complement 0. D2Game 0x6fce00c0 routes non-trade/gamble/hire actions by NPC class; Akara (0x94)
      // at 0x6fce0504 checks quest 1 bit 0 and quest 41 bits 0/1 before resetting (0x6fc82340).
      model.cancelNpcSession(resolvedNpcId)
      model.npcEntityAction(0, resolvedNpcId, 0)
      model.activeMenu = null
      if (model.hudManager?.worldPanels) {
        ;(model.hudManager.worldPanels as any).npcMenu = null
      }
      break
    }
    case 'hire': {
      model.npcEntityAction(3, resolvedNpcId, 0)
      ;(model.world.npcInteraction as any).window = 'hire'
      ;(model.world.npcInteraction as any).activeWindow = 'hire'
      if (model.hudManager) {
        model.hudManager.leftPanel = 'hire' as any
        ;(model.hudManager.worldPanels as any).activePanel = 'hire'
        ;(model.hudManager.worldPanels as any).npcMenu = null
      }
      break
    }
    case 'resurrect':
    case 'resurrect_merc': {
      model.resurrectMerc(resolvedNpcId)
      break
    }
    case 'travel_east': {
      const complement =
        resolvedDesc?.hcIdx === 210 || resolvedDesc?.npcTxtKey === 'meshif1' ? 75 : 40
      // D2Client.dll 0x6faf8750/0x6faf8810: send C2S 0x30 NpcCancel BEFORE C2S 0x38 EntityAction (0x6faf8150 -> 0x6faf7b20)
      // so D2Game SCMD_NpcCancel (0x6fced480) can find the NPC in the current room and clear bInteracting.
      model.cancelNpcSession(resolvedNpcId)
      model.npcEntityAction(0, resolvedNpcId, complement)
      if (model.hudManager?.worldPanels) {
        ;(model.hudManager.worldPanels as any).npcMenu = null
      }
      break
    }
    case 'travel_west': {
      const complement =
        resolvedDesc?.hcIdx === 175 || resolvedDesc?.npcTxtKey === 'warriv2' ? 1 : 40
      // D2Client.dll 0x6faf87b0/0x6faf8870: send C2S 0x30 NpcCancel BEFORE C2S 0x38 EntityAction
      model.cancelNpcSession(resolvedNpcId)
      model.npcEntityAction(0, resolvedNpcId, complement)
      if (model.hudManager?.worldPanels) {
        ;(model.hudManager.worldPanels as any).npcMenu = null
      }
      break
    }
    case 'travel_harrogath': {
      // D2Client.dll 0x6faf88d0: send C2S 0x30 NpcCancel BEFORE C2S 0x38 EntityAction
      model.cancelNpcSession(resolvedNpcId)
      model.npcEntityAction(0, resolvedNpcId, 109)
      if (model.hudManager?.worldPanels) {
        ;(model.hudManager.worldPanels as any).npcMenu = null
      }
      break
    }
    case 'imbue':
    case 'add_sockets':
    case 'personalize': {
      model.openArtisanWindow(actionId as any, resolvedNpcId)
      break
    }
    case 'trade':
    case 'trade_repair': {
      if (model.priceProvider && model.repairAllProvider) {
        model.openNpcTrade(resolvedNpcId)
      } else {
        model.npcEntityAction(1, resolvedNpcId, 0)
      }
      break
    }
    case 'gamble': {
      if (model.priceProvider && model.repairAllProvider) {
        model.openNpcGamble(resolvedNpcId)
      } else {
        model.npcEntityAction(2, resolvedNpcId, 0)
      }
      break
    }
    case 'cancel': {
      if (resolvedNpcId > 0) model.closeNpc(resolvedNpcId)
      break
    }
  }
}

export function swapWeaponsImpl(model: any): void {
  model.emitCommand({ type: 'SwapWeapons' })
}

export function requestQuestDataImpl(model: any): void {
  model.emitCommand({ type: 'RequestQuestData' })
}

export function onQuestLogOpenedImpl(model: any): number {
  const tab =
    model.world.areaId > 0
      ? model.resolveActTabForArea(model.world.areaId, model.world.act)
      : Math.max(1, Math.min(5, model.world.act + 1))
  if (model.hudManager) {
    model.hudManager.worldPanels.selectedActTab = tab
  }
  return model.world.questLog.openQuestLog(tab - 1, () => model.firstActiveQuestIndex(tab - 1))
}

export function firstActiveQuestIndexImpl(model: any, act0: number): number {
  const wp = model.hudManager?.worldPanels
  if (!wp) return -1
  const quests = getActQuests(act0 + 1)
  for (let i = 0; i < quests.length; i++) {
    if (wp.getQuestStatus(quests[i]!) === 'active') return i
  }
  return -1
}

export function onQuestLogClosedImpl(model: any): void {
  model.world.questLog.closeQuestLog()
}

export function replayQuestSpeechImpl(model: any, speechKey: string): void {
  if (!model.hudManager || !speechKey || speechKey === 'qstsnull' || speechKey === 'NONE') return
  const wp = model.hudManager.worldPanels
  const bodyText = wp.lookupQuestString(speechKey, wp.lang) ?? lookupTbl(speechKey, wp.lang)
  if (!bodyText) return
  wp.openStandaloneSpeech('', bodyText, { tblKey: speechKey })
}

export function toggleRunWalkImpl(model: any): boolean {
  const next = model.hudManager
    ? !model.hudManager.isRunning
    : !(model.predictor?.getSnapshot().running ?? true)
  if (model.hudManager) {
    model.hudManager.isRunning = next
    model.hudManager.syncPublishedState()
  }
  if (model.predictor) {
    model.predictor.setRunning(next)
  }
  return next
}

export function resolveActTabForAreaImpl(areaId: number, act0Based: number): number {
  if (areaId >= 109) return 5
  if (areaId >= 103) return 4
  if (areaId >= 75) return 3
  if (areaId >= 40) return 2
  if (areaId >= 1) return 1
  return Math.max(1, Math.min(5, (act0Based >= 1 && act0Based <= 5 ? act0Based : act0Based + 1)))
}

export function teleportWaypointImpl(model: any, waypointUnitId: number, destAreaId: number): void {
  model.waypointPacketSent = true
  model.activeWaypointUnitId = null
  model.world.clearWaypointInteraction()
  model.hudManager?.closeAllPanels()
  model.emitCommand({
    type: 'WaypointGo',
    waypointId: waypointUnitId,
    destAreaId,
  })
}

export function closeWaypointImpl(model: any): void {
  const unitId = model.activeWaypointUnitId ?? model.world.waypointUnitId
  const shouldSendCancel = !model.waypointPacketSent && unitId !== null
  model.waypointPacketSent = true
  model.activeWaypointUnitId = null
  model.world.clearWaypointInteraction()
  if (model.hudManager && model.hudManager.leftPanel === 'waypoint') {
    model.hudManager.setLeftPanel('none')
  }
  if (shouldSendCancel && unitId !== null) {
    model.emitCommand({
      type: 'WaypointGo',
      waypointId: unitId,
      destAreaId: 0,
    })
  }
}

export function teleportToLevelImpl(model: any, destAreaId: number): void {
  if (destAreaId === 0) {
    model.closeWaypoint()
    return
  }
  const unitId = model.world.waypointUnitId ?? model.activeWaypointUnitId
  if (unitId === null) {
    console.error('HudModel.teleportToLevel: no active waypoint unitId (0x63 WaypointMenu not open or expired)')
    model.waypointPacketSent = true
    model.activeWaypointUnitId = null
    if (model.hudManager?.leftPanel === 'waypoint') {
      model.hudManager.closeAllPanels()
    }
    return
  }
  model.teleportWaypoint(unitId, destAreaId)
}

export function dropGoldImpl(model: any, amount: number): void {
  const unitId = model.world.selfId
  if (!unitId) throw new Error('HudModel.dropGold: self unit id not assigned yet')
  if (!Number.isInteger(amount) || amount <= 0) return
  model.emitCommand({ type: 'DropGold', unitId, amount })
}

export function useItemImpl(model: any, itemId: number): void {
  const item =
    model.world.containers.inventory.get(itemId) ??
    model.world.containers.cube.get(itemId) ??
    model.world.containers.stash.get(itemId)
  const code = (item?.code ?? '').trim().toLowerCase()
  if (code === 'bks') {
    if (model.hudManager) {
      model.hudManager.worldPanels.openBarkscroll(false, model.world.questLog.cairnStoneOrder)
      model.hudManager.setLeftPanel('barkscroll')
    }
    return
  }
  if (code === 'bkd') {
    if (model.hudManager) {
      model.hudManager.worldPanels.openBarkscroll(true, model.world.questLog.cairnStoneOrder)
      model.hudManager.setLeftPanel('barkscroll')
    }
    model.emitCommand({ type: 'SelectMainItem', itemId: itemId >>> 0 })
    return
  }
  if (code === 'tr1') {
    if (model.hudManager) {
      model.hudManager.worldPanels.openRecipeScroll()
      model.hudManager.setLeftPanel('recipescroll')
    }
    const self = model.world.self
    model.emitCommand({ type: 'ItemUse', itemId, at: { x: self.x, y: self.y } })
    return
  }
  if (code === '0sc' || code === 'trs') {
    model.emitCommand({ type: 'SelectMainItem', itemId: itemId >>> 0 })
    return
  }
  const self = model.world.self
  model.emitCommand({ type: 'ItemUse', itemId, at: { x: self.x, y: self.y } })
}

export function castTownPortalImpl(model: any): void {
  model.emitCommand({ type: 'TownPortal' })
}

export function pickupItemToCursorImpl(model: any, itemId: number): void {
  model.emitCommand({ type: 'ItemToCursor', itemId })
  const { npcId, activeWindow } = model.world.npcInteraction
  if (ARTISAN_WINDOWS.has(activeWindow) && ARTISAN_NAMES[model.world.getUnit('monster', npcId)?.classId ?? -1] !== undefined) reopenArtisan(model, npcId)
}

function reopenArtisan(model: any, npcId: number): void {
  const { window, activeWindow } = model.world.npcInteraction
  const [pending, panel] = [model.pendingArtisanConfirmNpcId, model.hudManager?.leftPanel]
  const target = { unitType: 1, id: npcId }
  model.pendingArtisanConfirmNpcId = npcId
  ;[{ type: 'NpcCancel', target }, { type: 'Interact', target }, { type: 'NpcInit', target }].forEach((command) => model.emitCommand(command))
  Object.assign(model.world.npcInteraction, { window, activeWindow })
  model.pendingArtisanConfirmNpcId = pending
  if (model.hudManager) model.hudManager.leftPanel = panel
}

export function placeCursorItemImpl(model: any, itemId: number, col: number, row: number, buffer = 0): void {
  model.emitCommand({ type: 'ItemPlace', itemId, x: col, y: row, buffer })
}

export function equipItemImpl(model: any, itemId: number, slot: EquipSlotId | number): void {
  const bodyLoc = typeof slot === 'number' ? slot : EQUIP_SLOT_TO_BODY_LOC[slot]
  model.emitCommand({ type: 'ItemEquip', itemId, slot: bodyLoc })
}

export function unequipItemImpl(model: any, slot: EquipSlotId | number): void {
  const bodyLoc = typeof slot === 'number' ? slot : EQUIP_SLOT_TO_BODY_LOC[slot]
  model.emitCommand({ type: 'ItemUnequip', slot: bodyLoc })
}

export function dropItemImpl(model: any, itemId: number): void {
  model.emitCommand({ type: 'ItemDrop', itemId })
}

export function transmuteCubeImpl(model: any): void {
  model.emitCommand({ type: 'ClickButton', buttonId: ClickButtonId.Transmute, amount: 0 })
}

export function buyFromNpcImpl(
  model: any,
  p: { npcId: number; itemId: number; itemMode: number; gamble: boolean; shiftFill: boolean; cost: number },
): void {
  model.emitCommand({ type: 'NpcBuy', ...p })
}

export function sellToNpcImpl(
  model: any,
  p: { npcId: number; itemId: number; itemMode: number; cost: number },
): void {
  model.emitCommand({ type: 'NpcSell', ...p })
}

export function repairItemAtNpcImpl(
  model: any,
  p: { npcId: number; itemId: number; itemMode: number; durability: number },
): void {
  model.emitCommand({ type: 'NpcRepairItem', ...p })
}

export function repairAllAtNpcImpl(model: any, npcId: number): void {
  model.emitCommand({ type: 'NpcRepairAll', npcId })
}

export function identifyAllAtNpcImpl(model: any, npcId: number): void {
  model.emitCommand({ type: 'NpcIdentifyAll', npcId })
}

export function openNpcTradeImpl(model: any, npcId: number): void {
  model.requireVendorPrice()
  model.requireVendorRepairAll()
  model.emitCommand({ type: 'NpcOpenTrade', npcId })
  model.syncFromWorld()
}

export function openNpcGambleImpl(model: any, npcId: number): void {
  const npcClass = model.npcClassOf(npcId)
  if (!GAMBLE_NPC_CLASS_IDS.has(npcClass)) throw new Error(`HudModel.openNpcGamble: NPC class ${npcClass} does not gamble`)
  model.requireVendorPrice()
  model.requireVendorRepairAll()
  model.emitCommand({ type: 'NpcOpenGamble', npcId })
  model.syncFromWorld()
}

export function closeNpcImpl(model: any, npcId: number): void {
  model.pendingArtisanConfirmNpcId = null
  const cmd: ClientCommand = { type: 'NpcCancel', target: { unitType: UNIT_TYPE_MONSTER, id: npcId } }
  model.world.noteOutgoingCommand(cmd)
  model.emitCommand(cmd)
  model.syncFromWorld()
}

export function cancelNpcSessionImpl(model: any, npcId?: number): void {
  const targetNpcId =
    npcId ??
    model.world.npcInteraction.npcId ??
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcUnitId ??
    (model.hudManager?.worldPanels as any)?.npcMenu?.npcId ??
    (model.hudManager?.worldPanels as any)?.activeNpcId ??
    0
  if (targetNpcId > 0) {
    model.closeNpc(targetNpcId)
  }
  if (model.hudManager) {
    const wp = model.hudManager.worldPanels as any
    if (wp?.npcMenu) {
      wp.npcMenu = null
    }
    if (wp?.npcSpeech && (targetNpcId === 0 || wp.npcSpeech.npcId === targetNpcId)) {
      wp.npcSpeech = null
    }
  }
}

export function vendorBuyImpl(model: any, itemId: number, shiftFill: boolean): boolean {
  const store = model.requireOpenStore('vendorBuy')
  const item = model.world.containers.shop.get(itemId)
  if (!item) throw new Error(`HudModel.vendorBuy: shop item #${itemId} not in the store`)
  const cost = model.requireVendorPrice()(item, store.gamble ? 2 : 0, store.ctx)
  // D2Client.dll 0x6faf6f5c..0x6faf6f6f: `g_bIsRepairAll` (`[0x6fbcbc90]`) is 0 for buy (`0x32`),
  // so `je 0x6faf6fac` bypasses the 2000 ms `[0x6fbd3484]` Repair-All throttle (#1304).
  // D2Client.dll 0x6faf709c..0x6faf70a1: the 0x32 buy request stores the store item's dropsound (0x6fb31e40)
  // in [0x6fbc9753]; the S2C 0x2A result-0 reply plays it and clears it (0x6fafb694..0x6fafb6ae) (#991).
  model.pendingVendorBuySoundId = resolveItemDropSoundId113c(item)
  model.buyFromNpc({
    npcId: store.npcId,
    itemId,
    itemMode: 0,
    gamble: store.gamble,
    shiftFill: store.gamble ? false : shiftFill,
    cost,
  })
  return true
}

export function vendorSellImpl(model: any, itemId: number): boolean {
  const store = model.requireOpenStore('vendorSell')
  const item = model.requirePlayerItem(itemId, 'vendorSell')
  const code = (item.code ?? '').trim().toLowerCase()
  if (item.isEar || QUEST_ITEM_CODES.has(code)) return false
  const cost = model.requireVendorPrice()(item, 1, store.ctx)
  if (cost <= 0) return false
  // D2Client.dll 0x6faf6f5c..0x6faf6f6f (`[0x6fbcbc90] == 0` -> `je 0x6faf6fac`) and 0x6fb46d5f
  // (cursor sell -> `0x33` directly): sell (`0x33`) bypasses the 2000 ms Repair-All throttle (#1304).
  const itemMode = model.playerItemMode(item)
  model.sellToNpc({ npcId: store.npcId, itemId, itemMode, cost })
  return true
}

/** Sounds.txt 15 `cursor_repair_item` (cursor\repair.wav). */
export const NPC_REPAIR_SOUND_ID = 15

export function vendorRepairItemImpl(model: any, itemId: number): boolean {
  const store = model.requireOpenStore('vendorRepairItem')
  const item = model.requirePlayerItem(itemId, 'vendorRepairItem')
  const isEth =
    Boolean(item.ethereal) ||
    ((item.rawFlags ?? 0) & 0x400000) !== 0 ||
    (typeof item.flags === 'number' && (item.flags & 0x400000) !== 0) ||
    (typeof item.flags === 'object' && Boolean((item.flags as any)?.ethereal))
  if (isEth) return false
  const curDur = item.curDurability ?? item.durability ?? 0
  const maxDur = item.maxDurability ?? 0
  if (maxDur <= 0 || curDur >= maxDur) return false
  // D2Client.dll 0x6faf6f36..0x6faf6f48: trade mode 3 (repair) plays cursor_repair_item (#991),
  // and at 0x6faf6f5c..0x6faf6f6f `g_bIsRepairAll` (`[0x6fbcbc90]`) is 0 for single-item repair,
  // so `je 0x6faf6fac` bypasses the 2000 ms Repair-All throttle (#1304).
  model.uiSound?.(NPC_REPAIR_SOUND_ID)
  const isCursor = model.world.containers.cursor?.id === itemId
  const itemMode = isCursor ? 4 : 0
  model.repairItemAtNpc({ npcId: store.npcId, itemId, itemMode, durability: curDur })
  return true
}

export function vendorRepairAllImpl(model: any): boolean {
  const store = model.requireOpenStore('vendorRepairAll')
  // D2Client.dll 0x6faf6f36..0x6faf6f48: trade mode 3 plays cursor_repair_item before the
  // 2000 ms Repair-All throttle (`0x6fbcbc90 != 0` -> `0x6faf6f71..0x6faf6fa5`, `0x7d0` ms on `[0x6fbd3484]`).
  model.uiSound?.(NPC_REPAIR_SOUND_ID)
  if (model.isThrottled('repair')) return false
  model.repairAllAtNpc(store.npcId)
  return true
}

export function depositGoldImpl(model: any, amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) return
  model.emitCommand({ type: 'ClickButton', buttonId: ClickButtonId.DepositGold, amount })
}

export function withdrawGoldImpl(model: any, amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) return
  model.emitCommand({ type: 'ClickButton', buttonId: ClickButtonId.WithdrawGold, amount })
}

export function closeStashImpl(model: any): void {
  const cmd: ClientCommand = { type: 'ClickButton', buttonId: ClickButtonId.CloseStash, amount: 0 }
  model.world.noteOutgoingCommand(cmd)
  model.emitCommand(cmd)
  model.syncFromWorld()
}

export function closeCubeImpl(model: any): void {
  const cmd: ClientCommand = { type: 'ClickButton', buttonId: ClickButtonId.CloseCube, amount: 0 }
  model.world.noteOutgoingCommand(cmd)
  model.emitCommand(cmd)
  model.syncFromWorld()
}

export function itemToCubeImpl(model: any, itemId: number, cubeId: number): void {
  model.emitCommand({ type: 'ItemToCube', itemId: itemId >>> 0, cubeId: cubeId >>> 0 })
}
