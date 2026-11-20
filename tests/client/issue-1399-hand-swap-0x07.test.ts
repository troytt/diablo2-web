import { describe, expect, it, vi } from 'vitest'
import { ClientInventoryManager } from '../../src/client/world/inventory.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { resolveItemContainer, type ItemData } from '../../src/netproto/d2gs/items/item-types.ts'
import {
  encodeC2sSwap2HandedItem,
  encodeC2sItemSwap,
  encodeC2sSwapTwo1HandedWithOne2HandedItem,
} from '../../src/netproto/d2gs/c2s/items.ts'
import { decodeD2gsC2sPacketToCommand } from '../../src/server/net/session.ts'
import {
  InventoryPanel,
  EQUIP_SLOTS_LAYOUT,
  resolveAllowedSlots,
  resolveItemInvFile,
  getEffectiveItemReqClass,
  type UiInventoryItem,
} from '../../src/client/ui/inventory.ts'
import { forwardInventoryPanelClick } from '../../src/client/ui/hud-input-router.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'

function makeItemData(fields: Record<string, unknown>): ItemData {
  return fields as unknown as ItemData
}

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

describe('Issue #1399: 2H Staff & Shield Hand-Slot Mutual Exclusion on 0x9D action=0x07/0x09/0x16 (D2Client.dll 0x6fb361a0 / 0x6fb369e0 / 0x6fb33790)', () => {
  it('1. Sorceress equipping a Shield into weapon2 (slot 5) while 2H Staff is in weapon1 (slot 4) sends 0x1B and moves 2H Staff to cursor on 0x9D action=0x07 without visual coexistence', () => {
    const invPanel = new InventoryPanel()
    invPanel.visible = true
    invPanel.setPlayerContext({ level: 30, str: 100, dex: 100, classCode: 'sor' })

    const staffUi = { ...makeUiItemFromCode('sst', '100'), serverId: 100 } as UiInventoryItem
    const shieldUi = { ...makeUiItemFromCode('buc', '200'), serverId: 200 } as UiInventoryItem

    invPanel.equipped.weapon1 = staffUi
    invPanel.cursorItem = shieldUi

    const sink = {
      equipItem: vi.fn(),
      unequipItem: vi.fn(),
      onSwapEquipItem: vi.fn(),
      onSwap2HandedItem: vi.fn(),
      onSwap2HandedDual: vi.fn(),
    }
    const hud: any = {
      inventory: invPanel,
      currentClass: 'sor',
      commandSink: sink,
      pendingIdentifyScrollId: null,
      playItemDropUiSound: vi.fn(),
      playCantUseSound: vi.fn(),
    }

    // 1. Clicking empty weapon2 slot while holding Shield on cursor and 2H Staff in weapon1 sends 0x1B (Swap2HandedItem)
    const w2 = EQUIP_SLOTS_LAYOUT.weapon2
    expect(forwardInventoryPanelClick(hud, w2.x + 10, w2.y + 10, false)).toBe(true)
    expect(sink.onSwap2HandedItem).toHaveBeenCalledWith(200, 'weapon2')

    // 2. Server (D2Game.dll sInsertItemBodyRmvOpp 0x6fc93860) responds with a SINGLE 0x9D action=0x07 packet for the Shield (slot 5)
    const world = new ClientWorld()
    world.selfId = 1

    const staffItem = makeItemData({
      id: 100,
      code: 'sst',
      quality: 2,
      identified: true,
      location: 1,
      bodyLoc: 4,
      equippedSlot: 4,
      container: 'equipment',
      ownerType: 0,
      ownerId: 1,
      x: 0,
      y: 0,
      rawFlags: 0x11,
    })
    const shieldOnCursor = makeItemData({
      id: 200,
      code: 'buc',
      quality: 2,
      identified: true,
      location: 4,
      bodyLoc: 0,
      equippedSlot: 0,
      container: 'cursor',
      ownerType: 0,
      ownerId: 1,
      x: 0,
      y: 0,
      rawFlags: 0x10,
    })

    world.containers.applyItemEvent(0x06, staffItem, 'equipment', 1)
    world.containers.applyItemEvent(0x05, shieldOnCursor, 'cursor', 1)
    expect(world.containers.equipmentBySlot.get(4)?.id).toBe(100)
    expect(world.containers.cursor?.id).toBe(200)

    // Apply 0x9D action=0x07 (IndirectlySwapBodyItem) for Shield equipping into slot 5
    const shieldEquipped0x07 = makeItemData({
      ...shieldOnCursor,
      location: 1,
      bodyLoc: 5,
      equippedSlot: 5,
      container: resolveItemContainer(0x9d, 0x07, 0, 1, 0),
      rawFlags: 0x11,
    })
    world.apply({
      type: 'ItemEvent',
      action: 0x07,
      container: shieldEquipped0x07.container,
      item: shieldEquipped0x07,
    } as any)

    // Slot 4 (2H Staff) MUST be cleared from equipmentBySlot & equipment and moved to cursor!
    expect(world.containers.equipmentBySlot.get(4)).toBeUndefined()
    expect(world.containers.equipment.has(100)).toBe(false)
    expect(world.containers.equipmentBySlot.get(5)?.id).toBe(200)
    expect(world.containers.equipment.get(200)?.bodyLoc).toBe(5)
    expect(world.containers.cursor?.id).toBe(100)
    expect(world.containers.cursor?.container).toBe('cursor')
    expect(world.containers.cursor?.location).toBe(4)
    expect(world.containers.cursor?.bodyLoc).toBe(0)
  })

  it('2. Reverse direction: equipping 2H Staff into weapon1 (slot 4) via 0x9D action=0x07 while Shield is in weapon2 (slot 5) moves Shield to cursor', () => {
    const containers = new ClientInventoryManager()
    const shieldEquipped = makeItemData({
      id: 200,
      code: 'buc',
      quality: 2,
      identified: true,
      location: 1,
      bodyLoc: 5,
      equippedSlot: 5,
      container: 'equipment',
      ownerType: 0,
      ownerId: 1,
      x: 0,
      y: 0,
      rawFlags: 0x11,
    })
    const staffOnCursor = makeItemData({
      id: 100,
      code: 'sst',
      quality: 2,
      identified: true,
      location: 4,
      bodyLoc: 0,
      equippedSlot: 0,
      container: 'cursor',
      ownerType: 0,
      ownerId: 1,
      x: 0,
      y: 0,
      rawFlags: 0x10,
    })

    containers.applyItemEvent(0x06, shieldEquipped, 'equipment', 1)
    containers.applyItemEvent(0x05, staffOnCursor, 'cursor', 1)

    // Receive 0x9D action=0x07 for 2H Staff into slot 4
    containers.applyItemEvent(
      0x07,
      { ...staffOnCursor, location: 1, bodyLoc: 4, equippedSlot: 4, container: 'equipment', rawFlags: 0x11 },
      'equipment',
      1,
    )

    expect(containers.equipmentBySlot.get(4)?.id).toBe(100)
    expect(containers.equipmentBySlot.get(5)).toBeUndefined()
    expect(containers.equipment.has(200)).toBe(false)
    expect(containers.cursor?.id).toBe(200)
    expect(containers.cursor?.container).toBe('cursor')
    expect(containers.cursor?.location).toBe(4)
  })

  it('3. Secondary weapon tab (11 <-> 12) and remote player isolation on 0x9D action=0x07', () => {
    const containers = new ClientInventoryManager()

    const bowSlot11 = makeItemData({
      id: 301,
      code: 'sbw',
      quality: 2,
      identified: true,
      location: 1,
      bodyLoc: 11,
      equippedSlot: 11,
      container: 'equipment',
      ownerType: 0,
      ownerId: 1,
      x: 0,
      y: 0,
    })
    const shieldSlot12 = makeItemData({
      id: 302,
      code: 'buc',
      quality: 2,
      identified: true,
      location: 1,
      bodyLoc: 12,
      equippedSlot: 12,
      container: 'equipment',
      ownerType: 0,
      ownerId: 1,
      x: 0,
      y: 0,
    })
    containers.applyItemEvent(0x06, bowSlot11, 'equipment', 1)
    containers.applyItemEvent(0x07, shieldSlot12, 'equipment', 1)

    expect(containers.equipmentBySlot.get(11)).toBeUndefined()
    expect(containers.equipmentBySlot.get(12)?.id).toBe(302)
    expect(containers.cursor?.id).toBe(301)

    // Remote player (ownerId = 99 !== selfId = 1) 0x07 removes opposite slot without touching local cursor
    containers.applyItemEvent(0x06, { ...bowSlot11, id: 901, bodyLoc: 4, equippedSlot: 4, ownerId: 99 }, 'equipment', 1)
    expect(containers.remoteEquipmentByPlayerId.get(99)?.get(4)?.id).toBe(901)

    containers.applyItemEvent(0x07, { ...shieldSlot12, id: 902, bodyLoc: 5, equippedSlot: 5, ownerId: 99 }, 'equipment', 1)
    expect(containers.remoteEquipmentByPlayerId.get(99)?.get(4)).toBeUndefined()
    expect(containers.remoteEquipmentByPlayerId.get(99)?.get(5)?.id).toBe(902)
    expect(containers.cursor?.id).toBe(301)
  })

  it('4. 0x9D action=0x09 (SwapBodyItem D2Client.dll 0x6fb369e0) handles IFLAG_SWITCHOUT (0x80) to cursor and IFLAG_SWITCHIN (0x40) to equipment', () => {
    const containers = new ClientInventoryManager()
    const staffInSlot4 = makeItemData({
      id: 100,
      code: 'sst',
      quality: 2,
      identified: true,
      location: 1,
      bodyLoc: 4,
      equippedSlot: 4,
      container: 'equipment',
      ownerType: 0,
      ownerId: 1,
      x: 0,
      y: 0,
      rawFlags: 0x11,
    })
    const wandOnCursor = makeItemData({
      id: 105,
      code: 'wnd',
      quality: 2,
      identified: true,
      location: 4,
      bodyLoc: 0,
      equippedSlot: 0,
      container: 'cursor',
      ownerType: 0,
      ownerId: 1,
      x: 0,
      y: 0,
      rawFlags: 0x10,
    })
    containers.applyItemEvent(0x06, staffInSlot4, 'equipment', 1)
    containers.applyItemEvent(0x05, wandOnCursor, 'cursor', 1)

    // Packet 1 from sSwapItemBody (0x6fc93aa0): 0x09 with IFLAG_SWITCHOUT (0x80) on removed item (even if container='equipment' / location=1)
    containers.applyItemEvent(
      0x09,
      { ...staffInSlot4, rawFlags: 0x90 },
      'equipment',
      1,
    )
    expect(containers.equipmentBySlot.get(4)).toBeUndefined()
    expect(containers.cursor?.id).toBe(100)

    // Packet 2 from sSwapItemBody: 0x09 with IFLAG_SWITCHIN (0x40) on incoming item
    containers.applyItemEvent(
      0x09,
      { ...wandOnCursor, location: 1, bodyLoc: 4, equippedSlot: 4, rawFlags: 0x51 },
      'equipment',
      1,
    )
    expect(containers.equipmentBySlot.get(4)?.id).toBe(105)
    expect(containers.cursor?.id).toBe(100)
  })

  it('5. 0x9D action=0x16 (D2Client.dll 0x6fb33790) resolves to cursor and places item onto cursor, and server decodes 0x1B/0x1D/0x1E', () => {
    expect(resolveItemContainer(0x9d, 0x16, 0, 0, 0)).toBe('cursor')
    const containers = new ClientInventoryManager()
    const item = makeItemData({
      id: 500,
      code: 'rin',
      quality: 4,
      identified: true,
      location: 4,
      bodyLoc: 0,
      equippedSlot: 0,
      container: 'cursor',
      ownerType: 0,
      ownerId: 1,
      x: 0,
      y: 0,
    })
    containers.applyItemEvent(0x16, item, 'cursor', 1)
    expect(containers.cursor?.id).toBe(500)
    expect(containers.cursor?.container).toBe('cursor')

    expect(decodeD2gsC2sPacketToCommand(encodeC2sSwap2HandedItem(200, 5))).toEqual({
      type: 'ItemSwap2Handed',
      itemId: 200,
      slot: 5,
    })
    expect(decodeD2gsC2sPacketToCommand(encodeC2sItemSwap(105, 4))).toEqual({
      type: 'ItemSwap',
      itemId: 105,
      slot: 4,
    })
    expect(decodeD2gsC2sPacketToCommand(encodeC2sSwapTwo1HandedWithOne2HandedItem(100, 4))).toEqual({
      type: 'ItemSwap2HandedDual',
      itemId: 100,
      slot: 4,
    })
  })
})
