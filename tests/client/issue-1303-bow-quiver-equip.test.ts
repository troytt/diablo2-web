import { describe, expect, it, vi } from 'vitest'
import {
  InventoryPanel,
  EQUIP_SLOTS_LAYOUT,
  CANONICAL_BOW_WEAPON_CODES,
  CANONICAL_CROSSBOW_WEAPON_CODES,
  getItemShootsQuiverType,
  getItemQuiverType,
  areHandSlotItemsCompatible,
  resolveAllowedSlots,
  resolveItemInvFile,
  getEffectiveItemReqClass,
  type UiInventoryItem,
} from '../../src/client/ui/inventory.ts'
import { forwardInventoryPanelClick } from '../../src/client/ui/hud-input-router.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { executeNormalAttack } from '../../src/server/engine/combat-pipeline.ts'
import { GameEngine } from '../../src/server/engine/game-engine.ts'

function makeUiItemFromCode(code: string, id = `item-${code}`): UiInventoryItem {
  const tables = getEmbeddedDropTables()
  const base: any = tables.weapons.get(code) ?? tables.armor.get(code) ?? tables.misc.get(code)
  const allowedSlots = resolveAllowedSlots(base, tables)
  const reqClass = getEffectiveItemReqClass({ code })
  const resolvedInv = resolveItemInvFile(base, 'normal', code)
  const invFile = typeof resolvedInv === 'string' ? resolvedInv : (resolvedInv?.invFile ?? code)
  return {
    id,
    code,
    name: base?.name ?? code,
    nameZh: base?.name ?? code,
    baseNameZh: base?.name ?? code,
    invFile,
    invWidth: base?.invWidth ?? 1,
    invHeight: base?.invHeight ?? 3,
    quality: 'normal',
    identified: true,
    ...(base?.twoHanded !== undefined ? { twoHanded: Boolean(base.twoHanded) } : {}),
    ...(base?.oneOrTwoHanded !== undefined ? { oneOrTwoHanded: Boolean(base.oneOrTwoHanded) } : {}),
    ...(reqClass !== undefined ? { reqClass } : {}),
    allowedSlots: allowedSlots ?? [],
    stats: [],
  }
}

describe('Issue #1303: 1.13c Bow/Crossbow & Quiver Hand-Slot Compatibility (D2Common.dll 0x6fd6f980 & 0x6fd70db0)', () => {
  describe('1. Canonical Shoots & Quiver taxonomy (ITEMS_GetItemShoots 0x6fd74eb0 & ITEMS_GetItemQuiver 0x6fd74e60)', () => {
    it('identifies all 30 canonical Bow & Amazon Bow codes as shooting bowq and all 12 Crossbow codes as shooting xboq', () => {
      expect(CANONICAL_BOW_WEAPON_CODES.size).toBe(30)
      for (const code of CANONICAL_BOW_WEAPON_CODES) {
        const bow = makeUiItemFromCode(code)
        expect(getItemShootsQuiverType(bow), `Bow ${code} should shoot bowq`).toBe('bowq')
        expect(getItemQuiverType(bow), `Bow ${code} is not a quiver`).toBeNull()
      }

      expect(CANONICAL_CROSSBOW_WEAPON_CODES.size).toBe(12)
      for (const code of CANONICAL_CROSSBOW_WEAPON_CODES) {
        const xbow = makeUiItemFromCode(code)
        expect(getItemShootsQuiverType(xbow), `Crossbow ${code} should shoot xboq`).toBe('xboq')
        expect(getItemQuiverType(xbow), `Crossbow ${code} is not a quiver`).toBeNull()
      }

      const arrows = makeUiItemFromCode('aqv')
      expect(getItemQuiverType(arrows)).toBe('bowq')
      expect(getItemShootsQuiverType(arrows)).toBeNull()

      const bolts = makeUiItemFromCode('cqv')
      expect(getItemQuiverType(bolts)).toBe('xboq')
      expect(getItemShootsQuiverType(bolts)).toBeNull()
    })

    it('areHandSlotItemsCompatible (0x6fd6f980) allows Bow+Arrows and Crossbow+Bolts in either hand and rejects invalid pairs', () => {
      const shortBow = makeUiItemFromCode('sbw')
      const stagBow = makeUiItemFromCode('am1')
      const lightXbow = makeUiItemFromCode('lxb')
      const arrows = makeUiItemFromCode('aqv')
      const bolts = makeUiItemFromCode('cqv')
      const shortSword = makeUiItemFromCode('ssd')
      const buckler = makeUiItemFromCode('buc')
      const spear = makeUiItemFromCode('spr')

      // Valid launcher + quiver pairs (both hand orders)
      expect(areHandSlotItemsCompatible(shortBow, arrows, 'ama')).toBe(true)
      expect(areHandSlotItemsCompatible(arrows, shortBow, 'ama')).toBe(true)
      expect(areHandSlotItemsCompatible(stagBow, arrows, 'ama')).toBe(true)
      expect(areHandSlotItemsCompatible(arrows, stagBow, 'ama')).toBe(true)
      expect(areHandSlotItemsCompatible(lightXbow, bolts, 'ama')).toBe(true)
      expect(areHandSlotItemsCompatible(bolts, lightXbow, 'ama')).toBe(true)

      // Mismatched launcher + quiver -> false
      expect(areHandSlotItemsCompatible(shortBow, bolts, 'ama')).toBe(false)
      expect(areHandSlotItemsCompatible(stagBow, bolts, 'ama')).toBe(false)
      expect(areHandSlotItemsCompatible(lightXbow, arrows, 'ama')).toBe(false)

      // Quiver + 1H weapon / shield / 2H melee / another quiver -> false (0x6fd6f9ce..0x6fd6f9e4)
      expect(areHandSlotItemsCompatible(shortSword, arrows, 'ama')).toBe(false)
      expect(areHandSlotItemsCompatible(arrows, shortSword, 'ama')).toBe(false)
      expect(areHandSlotItemsCompatible(buckler, arrows, 'ama')).toBe(false)
      expect(areHandSlotItemsCompatible(spear, arrows, 'ama')).toBe(false)
      expect(areHandSlotItemsCompatible(arrows, arrows, 'ama')).toBe(false)
      expect(areHandSlotItemsCompatible(arrows, bolts, 'ama')).toBe(false)

      // Bow/Crossbow + Shield or 1H weapon -> false
      expect(areHandSlotItemsCompatible(shortBow, buckler, 'ama')).toBe(false)
      expect(areHandSlotItemsCompatible(shortBow, shortSword, 'bar')).toBe(false)

      // 1H weapon + Shield -> true
      expect(areHandSlotItemsCompatible(shortSword, buckler, 'ama')).toBe(true)
    })
  })

  describe('2. InventoryPanel.canEquipItemInSlot & clickEquipSlot for Amazon with Bow + Arrows', () => {
    it('equips Arrows (aqv) into weapon2 when Amazon already has a Bow (sbw / am1) in weapon1', () => {
      const inv = new InventoryPanel()
      inv.visible = true
      inv.setPlayerContext({ level: 30, str: 100, dex: 100, classCode: 'ama' })

      const stagBow = makeUiItemFromCode('am1', 'bow-am1')
      const arrows = makeUiItemFromCode('aqv', 'quiver-aqv')

      // 1. Put Stag Bow on cursor and equip into weapon1
      inv.cursorItem = stagBow
      expect(inv.canEquipItemInSlot(stagBow, 'weapon1')).toBe(true)
      expect(inv.clickEquipSlot('weapon1')).toBe(true)
      expect(inv.equipped.weapon1).toBe(stagBow)
      expect(inv.cursorItem).toBeNull()

      // Before arrows are equipped, weapon2 shows the 2H ghost silhouette of Stag Bow
      expect(inv.getOppositeHandTwoHandedWeapon('weapon2')).toBe(stagBow)

      // 2. Put Arrows on cursor and equip into weapon2
      inv.cursorItem = arrows
      expect(inv.canEquipItemInSlot(arrows, 'weapon2')).toBe(true)
      expect(inv.clickEquipSlot('weapon2')).toBe(true)

      // Both Stag Bow and Arrows are now equipped simultaneously!
      expect(inv.equipped.weapon1).toBe(stagBow)
      expect(inv.equipped.weapon2).toBe(arrows)
      expect(inv.cursorItem).toBeNull()
      expect(inv.getOppositeHandTwoHandedWeapon('weapon2')).toBeNull()
    })

    it('equips Bow (sbw) into weapon1 when Arrows (aqv) are already equipped in weapon2', () => {
      const inv = new InventoryPanel()
      inv.visible = true
      inv.setPlayerContext({ level: 30, str: 100, dex: 100, classCode: 'ama' })

      const shortBow = makeUiItemFromCode('sbw', 'bow-sbw')
      const arrows = makeUiItemFromCode('aqv', 'quiver-aqv')

      inv.cursorItem = arrows
      expect(inv.clickEquipSlot('weapon2')).toBe(true)
      expect(inv.equipped.weapon2).toBe(arrows)
      expect(inv.cursorItem).toBeNull()

      inv.cursorItem = shortBow
      expect(inv.canEquipItemInSlot(shortBow, 'weapon1')).toBe(true)
      expect(inv.clickEquipSlot('weapon1')).toBe(true)

      expect(inv.equipped.weapon1).toBe(shortBow)
      expect(inv.equipped.weapon2).toBe(arrows)
      expect(inv.cursorItem).toBeNull()
    })

    it('swaps Bow 1 for Bow 2 in weapon1 while keeping Arrows equipped in weapon2', () => {
      const inv = new InventoryPanel()
      inv.visible = true
      inv.setPlayerContext({ level: 30, str: 100, dex: 100, classCode: 'ama' })

      const bow1 = makeUiItemFromCode('sbw', 'bow-1')
      const bow2 = makeUiItemFromCode('am1', 'bow-2')
      const arrows = makeUiItemFromCode('aqv', 'quiver-aqv')

      inv.equipped.weapon1 = bow1
      inv.equipped.weapon2 = arrows

      inv.cursorItem = bow2
      expect(inv.clickEquipSlot('weapon1')).toBe(true)
      expect(inv.equipped.weapon1).toBe(bow2)
      expect(inv.equipped.weapon2).toBe(arrows)
      expect(inv.cursorItem).toBe(bow1)
    })

    it('swaps Bow in weapon1 onto cursor when clicking empty weapon2 with incompatible Bolts (cqv) or Shield (buc)', () => {
      const inv = new InventoryPanel()
      inv.visible = true
      inv.setPlayerContext({ level: 30, str: 100, dex: 100, classCode: 'ama' })

      const bow = makeUiItemFromCode('sbw', 'bow-1')
      const bolts = makeUiItemFromCode('cqv', 'bolts-1')

      inv.equipped.weapon1 = bow
      inv.cursorItem = bolts

      expect(inv.clickEquipSlot('weapon2')).toBe(true)
      expect(inv.equipped.weapon1).toBeUndefined()
      expect(inv.equipped.weapon2).toBe(bolts)
      expect(inv.cursorItem).toBe(bow)
    })
  })

  describe('3. HUD Input Router packet selection (D2Client.dll 0x6fb46280 / 0x6fb46690 & D2Common.dll 0x6fd70db0)', () => {
    function createMockHudAndSink() {
      const inv = new InventoryPanel()
      inv.visible = true
      inv.setPlayerContext({ level: 30, str: 100, dex: 100, classCode: 'ama' })

      const sink = {
        equipItem: vi.fn(),
        unequipItem: vi.fn(),
        onSwapEquipItem: vi.fn(),
        onSwap2HandedItem: vi.fn(),
        onSwap2HandedDual: vi.fn(),
      }
      const hud: any = {
        inventory: inv,
        currentClass: 'ama',
        commandSink: sink,
        pendingIdentifyScrollId: null,
        playItemDropUiSound: vi.fn(),
        playCantUseSound: vi.fn(),
      }
      return { inv, hud, sink }
    }

    it('sends 0x1A equipItem (NOT 0x1B onSwap2HandedItem) when clicking empty weapon2 with Arrows while Bow is in weapon1', () => {
      const { inv, hud, sink } = createMockHudAndSink()
      const bow = { ...makeUiItemFromCode('sbw', '101'), serverId: 101 } as UiInventoryItem
      const arrows = { ...makeUiItemFromCode('aqv', '202'), serverId: 202 } as UiInventoryItem

      inv.equipped.weapon1 = bow
      inv.cursorItem = arrows

      const w2 = EQUIP_SLOTS_LAYOUT.weapon2
      const handled = forwardInventoryPanelClick(hud, w2.x + 10, w2.y + 10, false)
      expect(handled).toBe(true)
      expect(sink.equipItem).toHaveBeenCalledWith(202, 'weapon2')
      expect(sink.onSwap2HandedItem).not.toHaveBeenCalled()
      expect(sink.onSwap2HandedDual).not.toHaveBeenCalled()
    })

    it('sends 0x1A equipItem (NOT 0x1B onSwap2HandedItem) when clicking empty weapon1 with Bow while Arrows are in weapon2', () => {
      const { inv, hud, sink } = createMockHudAndSink()
      const bow = { ...makeUiItemFromCode('am1', '101'), serverId: 101 } as UiInventoryItem
      const arrows = { ...makeUiItemFromCode('aqv', '202'), serverId: 202 } as UiInventoryItem

      inv.equipped.weapon2 = arrows
      inv.cursorItem = bow

      const w1 = EQUIP_SLOTS_LAYOUT.weapon1
      const handled = forwardInventoryPanelClick(hud, w1.x + 10, w1.y + 10, false)
      expect(handled).toBe(true)
      expect(sink.equipItem).toHaveBeenCalledWith(101, 'weapon1')
      expect(sink.onSwap2HandedItem).not.toHaveBeenCalled()
    })

    it('sends 0x1D onSwapEquipItem (NOT 0x1E onSwap2HandedDual) when swapping Bow 1 for Bow 2 while Arrows are in weapon2', () => {
      const { inv, hud, sink } = createMockHudAndSink()
      const bow1 = { ...makeUiItemFromCode('sbw', '101'), serverId: 101 } as UiInventoryItem
      const bow2 = { ...makeUiItemFromCode('am1', '102'), serverId: 102 } as UiInventoryItem
      const arrows = { ...makeUiItemFromCode('aqv', '202'), serverId: 202 } as UiInventoryItem

      inv.equipped.weapon1 = bow1
      inv.equipped.weapon2 = arrows
      inv.cursorItem = bow2

      const w1 = EQUIP_SLOTS_LAYOUT.weapon1
      const handled = forwardInventoryPanelClick(hud, w1.x + 10, w1.y + 10, false)
      expect(handled).toBe(true)
      expect(sink.onSwapEquipItem).toHaveBeenCalledWith(102, 'weapon1')
      expect(sink.onSwap2HandedDual).not.toHaveBeenCalled()
    })

    it('sends 0x1B onSwap2HandedItem when clicking empty weapon2 with Bolts or Shield while Bow is in weapon1', () => {
      const { inv, hud, sink } = createMockHudAndSink()
      const bow = { ...makeUiItemFromCode('sbw', '101'), serverId: 101 } as UiInventoryItem
      const bolts = { ...makeUiItemFromCode('cqv', '303'), serverId: 303 } as UiInventoryItem

      inv.equipped.weapon1 = bow
      inv.cursorItem = bolts

      const w2 = EQUIP_SLOTS_LAYOUT.weapon2
      forwardInventoryPanelClick(hud, w2.x + 10, w2.y + 10, false)
      expect(sink.onSwap2HandedItem).toHaveBeenCalledWith(303, 'weapon2')
      expect(sink.equipItem).not.toHaveBeenCalled()
    })

    it('sends 0x1E onSwap2HandedDual when clicking occupied weapon1 (Bow) with 2H Spear while Arrows are in weapon2', () => {
      const { inv, hud, sink } = createMockHudAndSink()
      const bow = { ...makeUiItemFromCode('sbw', '101'), serverId: 101 } as UiInventoryItem
      const arrows = { ...makeUiItemFromCode('aqv', '202'), serverId: 202 } as UiInventoryItem
      const spear = { ...makeUiItemFromCode('spr', '404'), serverId: 404 } as UiInventoryItem

      inv.equipped.weapon1 = bow
      inv.equipped.weapon2 = arrows
      inv.cursorItem = spear

      const w1 = EQUIP_SLOTS_LAYOUT.weapon1
      forwardInventoryPanelClick(hud, w1.x + 10, w1.y + 10, false)
      expect(sink.onSwap2HandedDual).toHaveBeenCalledWith(404, 'weapon1')
      expect(sink.onSwapEquipItem).not.toHaveBeenCalled()
    })
  })

  describe('4. Ranged weapon attack with Bow+Arrows in either hand slot', () => {
    it('fires ranged arrow projectile whether Bow is in weapon1+Arrows in weapon2 or Arrows in weapon1+Bow in weapon2', () => {
      const engine = new GameEngine()
      const bow = makeUiItemFromCode('sbw', 'bow-1')
      const arrows = { ...makeUiItemFromCode('aqv', 'quiver-1'), quantity: 50 }

      const res1 = executeNormalAttack(engine.world.player.x + 100, engine.world.player.y, {
        engine,
        hudLike: {
          mana: 100,
          inventory: {
            equipped: { weapon1: bow, weapon2: arrows },
          } as any,
        } as any,
      })
      expect(res1.casted).toBe(true)

      const res2 = executeNormalAttack(engine.world.player.x + 100, engine.world.player.y, {
        engine,
        hudLike: {
          mana: 100,
          inventory: {
            equipped: { weapon1: arrows, weapon2: bow },
          } as any,
        } as any,
      })
      expect(res2.casted).toBe(true)
    })
  })
})
