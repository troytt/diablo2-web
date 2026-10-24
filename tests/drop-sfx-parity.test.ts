import { describe, expect, it, vi } from 'vitest'
import { RAW_WEAPONS, RAW_ARMOR, RAW_MISC } from '../src/common/data/canonical-drop-data.ts'
import { parseWeaponsTable } from '../src/common/items/weapons.ts'
import { parseArmorTable } from '../src/common/items/armor.ts'
import { parseMiscTable } from '../src/common/items/misc-items.ts'
import { parseTable } from '../src/common/world/acts.ts'
import {
  GroundItemManager,
  resolveGroundItemMetadata,
} from '../src/common/items/ground-items.ts'

describe('Issue #421: Base Item Drop SFX & Frame (1.13c Parity)', () => {
  describe('Suite 1: Data Table dropsound & dropsfxframe Column Extraction', () => {
    it('1.1: extracts dropsound and dropsfxframe for weapons', () => {
      const weaponsTable = parseWeaponsTable(RAW_WEAPONS)
      const handAxe = weaponsTable.byCode.get('hax')
      expect(handAxe).toBeDefined()
      expect(handAxe!.dropsound).toBe('item_smallmetalweapon')
      expect(handAxe!.dropsfxframe).toBe(12)

      const club = weaponsTable.byCode.get('clb')
      expect(club).toBeDefined()
      expect(club!.dropsound).toBe('item_staff')
      expect(club!.dropsfxframe).toBe(12)
    })

    it('1.2: extracts dropsound and dropsfxframe for armor', () => {
      const d2table = parseTable(new TextEncoder().encode(RAW_ARMOR))
      const armorTable = parseArmorTable(d2table)
      const cap = armorTable.byCode.get('cap')
      expect(cap).toBeDefined()
      expect(cap!.dropsound).toBe('item_cap')
      expect(cap!.dropsfxframe).toBe(12)

      const leatherArmor = armorTable.byCode.get('lea')
      expect(leatherArmor).toBeDefined()
      expect(leatherArmor!.dropsound).toBe('item_lightarmor')
      expect(leatherArmor!.dropsfxframe).toBe(12)
    })

    it('1.3: extracts dropsound and dropsfxframe for misc items', () => {
      const d2table = parseTable(new TextEncoder().encode(RAW_MISC))
      const miscTable = parseMiscTable(d2table)
      const healingPotion = miscTable.byCode.get('hp1')
      expect(healingPotion).toBeDefined()
      expect(healingPotion!.dropsound).toBe('item_potion')
      expect(healingPotion!.dropsfxframe).toBe(14) // Potions use frame 14

      const townPortalScroll = miscTable.byCode.get('tsc')
      expect(townPortalScroll).toBeDefined()
      expect(townPortalScroll!.dropsound).toBe('item_scroll')
      expect(townPortalScroll!.dropsfxframe).toBe(10)
    })
  })

  describe('Suite 2: Ground Item Metadata Resolution', () => {
    it('2.1: resolves gold to item_gold sound at frame 12', () => {
      const meta = resolveGroundItemMetadata({ isGold: true, amount: 500, code: 'gld' })
      expect(meta.dropSound).toBe('item_gold')
      expect(meta.dropSfxFrame).toBe(12)
    })

    it('2.2: resolves equipment to base dropsound and dropsfxframe', () => {
      const item = {
        name: 'Short Sword',
        base: {
          id: 'ssd',
          dropsound: 'item_sword',
          dropsfxframe: 12,
        },
      }
      const meta = resolveGroundItemMetadata(item)
      expect(meta.dropSound).toBe('item_sword')
      expect(meta.dropSfxFrame).toBe(12)
    })

    it('2.3: resolves potion to item_potion at frame 14', () => {
      const item = {
        name: 'Healing Potion',
        base: {
          id: 'hp1',
          dropsound: 'item_potion',
          dropsfxframe: 14,
        },
      }
      const meta = resolveGroundItemMetadata(item)
      expect(meta.dropSound).toBe('item_potion')
      expect(meta.dropSfxFrame).toBe(14)
    })
  })

  describe('Suite 3: Bounce Animation Lifecycle', () => {
    it('3.1: records landing frame when bounce animation reaches dropsfxframe (frame * 40ms)', () => {
      const manager = new GroundItemManager()
      const startTime = 1000
      const entity = manager.add(
        {
          name: 'Broad Sword',
          base: { dropsound: 'item_sword', dropsfxframe: 12 },
        },
        10,
        10,
        200,
        200,
        { bounce: true, now: startTime, durationMs: 600 },
      )

      expect(entity.dropSound).toBe('item_sword')
      expect(entity.dropSfxFrame).toBe(12)
      expect(entity.sfxPlayed).toBe(false)

      // At frame 10 (400ms elapsed), currentFrame = 10 < 12: should not trigger
      expect(manager.updateBounces(startTime + 400)).toHaveLength(0)
      expect(entity.sfxPlayed).toBe(false)

      // At frame 12 (480ms elapsed), currentFrame = 12 >= 12: records landing frame once
      const triggered = manager.updateBounces(startTime + 480)
      expect(entity.sfxPlayed).toBe(true)
      expect(triggered).toHaveLength(1)
      expect(triggered[0]!.sound).toBe('item_sword')

      // Subsequent ticks do not re-trigger
      expect(manager.updateBounces(startTime + 520)).toHaveLength(0)
      expect(manager.updateBounces(startTime + 600)).toHaveLength(0)
    })
  })
})
