/**
 * Test fixture: fill a `WorldPanelsHud` store the way `HudModel.syncNpcInteraction` does after the
 * server streamed `0x9C AddToShop` items, but with items generated offline by the common vendor
 * generator (D2Game store rolls) so panel/draw tests keep realistic content without a live server.
 */
import { VendorSessionManager } from '../../src/common/items/vendor-service.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { itemToUiInventoryItem } from '../../src/common/items/item-bridge.ts'
import { getTownNpcDescriptorByName } from '../../src/common/units/npc-table.ts'
import { VENDOR_TABS, type WorldPanelsHud } from '../../src/client/ui/world-panels.ts'

export function openGeneratedVendorShop(
  wp: WorldPanelsHud,
  npcName: string,
  mode: 'trade' | 'gamble' = 'trade',
  cLvl = 85,
  difficulty: 0 | 1 | 2 = 0,
  npcId = 1,
): void {
  const descriptor = getTownNpcDescriptorByName(npcName)
  if (!descriptor || descriptor.vendorId === null) {
    throw new Error(`openGeneratedVendorShop: ${npcName} is not a vendor NPC`)
  }
  const tables = getEmbeddedDropTables()
  const session = new VendorSessionManager(tables)
  const vendorId = descriptor.vendorId
  const items: { storePage: number; placement: { item: ReturnType<typeof itemToUiInventoryItem>; col: number; row: number } }[] = []
  if (mode === 'gamble') {
    for (const p of session.getOrCreateGambleStore(vendorId, cLvl).getAllItems()) {
      const buyCost = session.getBuyPrice(p.item, vendorId, difficulty, cLvl, true)
      const item = itemToUiInventoryItem({ ...p.item, buyCost, isGambleMystery: true } as typeof p.item, tables)
      items.push({ storePage: 1, placement: { item, col: p.x, row: p.y } })
    }
  } else {
    const store = session.getOrCreateVendorStore(vendorId, difficulty, cLvl)
    VENDOR_TABS.forEach((tab, idx) => {
      for (const p of store.tabs[tab.id].getAllItems()) {
        const buyCost = session.getBuyPrice(p.item, vendorId, difficulty, cLvl, false)
        const item = itemToUiInventoryItem({ ...p.item, buyCost } as typeof p.item, tables)
        items.push({ storePage: idx + 1, placement: { item, col: p.x, row: p.y } })
      }
    })
  }
  wp.setVendorShop({ npcId, descriptor, mode, items })
}
