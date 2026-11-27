import { describe, expect, it } from 'vitest'
import { resolveObjectDisplayName, isObjectSelectableInMode, CANONICAL_113C_OBJECTS } from '../src/common/world/objects-meta.ts'
import { resolveBaseItemNameEn, setTooltipLocale } from '../src/common/i18n/tooltip-i18n.ts'
import { onlineItemDataToUiInventoryItem } from '../src/common/items/item-bridge.ts'
import { formatItemTooltip } from '../src/common/items/item-tooltip.ts'
import { resolveGroundItemMetadata, CANONICAL_QUEST_ITEM_CODES } from '../src/common/items/ground-items.ts'
import { transmuteCubeItems } from '../src/common/items/runeword-socket.ts'
import { resolveObjectAutomapCellId } from '../src/common/formats/automap-table.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import type { ClientCommand } from '../src/netproto/index.ts'

describe('Act 3 Quests (A3Q1..A3Q6) 1.13c Parity Audit & Fixes', () => {
  describe('Fix 1: OpenWarp=1 Objects (74, 194, 195, 386) Hover Label in mode=2 (ON)', () => {
    it('resolves Travincal Durance of Hate stairs (386) as unselectable in mode 0 and "To The Durance of Hate Level 1" in mode 2', () => {
      expect(isObjectSelectableInMode(386, 0)).toBe(false)
      expect(isObjectSelectableInMode(386, 2)).toBe(true)

      expect(resolveObjectDisplayName(386, 0)).toBeUndefined()
      expect(resolveObjectDisplayName(386, 1)).toBeUndefined()
      expect(resolveObjectDisplayName(386, 2)).toEqual({
        name: 'To The Durance of Hate Level 1',
        nameZh: '前往憎恨的囚牢第一層',
      })
    })

    it('resolves Kurast Left/Right Temple stairs (194, 195) to static "Stair" in mode 0 and area-specific LevelWarp in mode 2', () => {
      expect(resolveObjectDisplayName(194, 0, undefined, undefined, 80)?.name).toBe('Stair')
      expect(resolveObjectDisplayName(195, 0, undefined, undefined, 80)?.name).toBe('Stair')

      // Kurast Bazaar (80): Ruined Temple (94) & Disused Fane (95)
      expect(resolveObjectDisplayName(194, 2, undefined, undefined, 80)).toEqual({
        name: 'To The Ruined Temple',
        nameZh: '前往殘破的神殿',
      })
      expect(resolveObjectDisplayName(195, 2, undefined, undefined, 80)).toEqual({
        name: 'To The Disused Fane',
        nameZh: '前往廢棄的寺院',
      })

      // Upper Kurast (81): Forgotten Reliquary (96) & Forgotten Temple (97)
      expect(resolveObjectDisplayName(194, 2, undefined, undefined, 81)).toEqual({
        name: 'To The Forgotten Reliquary',
        nameZh: '前往被遺忘的聖物室',
      })
      expect(resolveObjectDisplayName(195, 2, undefined, undefined, 81)).toEqual({
        name: 'To The Forgotten Temple',
        nameZh: '前往被遺忘的神殿',
      })

      // Kurast Causeway (82): Ruined Fane (98) & Disused Reliquary (99)
      expect(resolveObjectDisplayName(194, 2, undefined, undefined, 82)).toEqual({
        name: 'To The Ruined Fane',
        nameZh: '前往荒廢的寺院',
      })
      expect(resolveObjectDisplayName(195, 2, undefined, undefined, 82)).toEqual({
        name: 'To The Disused Reliquary',
        nameZh: '前往被遺棄的聖物室',
      })
    })

    it('resolves Lut Gholein Sewers Trap Door (74) to "Trap Door" in mode 0 and "To The Sewers Level 1" in mode 2', () => {
      expect(resolveObjectDisplayName(74, 0)?.name).toBe('Trap Door')
      expect(resolveObjectDisplayName(74, 2)).toEqual({
        name: 'To The Sewers Level 1',
        nameZh: '前往下水道第一層',
      })
    })
  })

  describe('Fix 2: Act 3 Quest Item Display Names, Multi-line .tbl Consumables, and Quest Gold Color (quest != 0)', () => {
    it('resolves all Act 3 quest item names from .txt internal names to canonical .tbl display names', () => {
      expect(resolveBaseItemNameEn('jade figurine', 'j34')).toBe('A Jade Figurine')
      expect(resolveBaseItemNameEn('gold bird', 'g34')).toBe('The Golden Bird')
      expect(resolveBaseItemNameEn('scroll of self resurrect', 'xyz')).toBe('Potion of Life')
      expect(resolveBaseItemNameEn('decoy dagger', 'd33')).toBe('Decoy Gidbinn')
      expect(resolveBaseItemNameEn('Gidbinn', 'g33')).toBe('The Gidbinn')
      expect(resolveBaseItemNameEn("lam esen's tome", 'bbb')).toBe("Lam Esen's Tome")
      expect(resolveBaseItemNameEn('KhalimEye', 'qey')).toBe("Khalim's Eye")
      expect(resolveBaseItemNameEn('KhalimHeart', 'qhr')).toBe("Khalim's Heart")
      expect(resolveBaseItemNameEn('KhalimBrain', 'qbr')).toBe("Khalim's Brain")
      expect(resolveBaseItemNameEn('KhalimFlail', 'qf1')).toBe("Khalim's Flail")
      expect(resolveBaseItemNameEn('SuperKhalimFlail', 'qf2')).toBe("Khalim's Will")
      expect(resolveBaseItemNameEn('Mephisto SoulStone', 'mss')).toBe("Mephisto's Soulstone")
    })

    it('resolves multi-line .tbl consumables (xyz, ass, ice, tr2, toa) to clean item title lines and emits right-click instruction lines in tooltips', () => {
      setTooltipLocale('en')
      const xyzUi = onlineItemDataToUiInventoryItem({ code: 'xyz', quality: 2, identified: true })
      expect(xyzUi.name).toBe('Potion of Life')
      expect(xyzUi.nameZh).toBe('生命药剂')

      const xyzTooltipEn = formatItemTooltip(xyzUi.rawItem!, 'en')
      expect(xyzTooltipEn.title).toBe('Potion of Life')
      expect(xyzTooltipEn.qualityColor).toBe('#c8a15a')
      expect(xyzTooltipEn.lines).toContainEqual({
        text: 'Right Click to permanently add 20 to Life',
        color: 'instruction',
      })

      const xyzTooltipZh = formatItemTooltip(xyzUi.rawItem!, 'zh')
      expect(xyzTooltipZh.title).toBe('生命药剂')
      expect(xyzTooltipZh.qualityColor).toBe('#c8a15a')
      expect(xyzTooltipZh.lines).toContainEqual({
        text: '滑鼠右键点选之后，可以永久性的增加20点生命',
        color: 'instruction',
      })
    })

    it("resolves Unique quest weapons (qf1 Khalim's Flail, qf2 Khalim's Will) to canonical .tbl titles instead of raw UniqueItems.txt index", () => {
      setTooltipLocale('en')
      const qf1Ui = onlineItemDataToUiInventoryItem({ code: 'qf1', quality: 7, identified: true })
      expect(qf1Ui.name).toBe("Khalim's Flail")
      expect(qf1Ui.nameZh).toBe('克林姆的连枷')
      const qf1Tooltip = formatItemTooltip(qf1Ui.rawItem!, 'en')
      expect(qf1Tooltip.title).toBe("Khalim's Flail")
      expect(qf1Tooltip.qualityColor).toBe('#c8a15a')

      const qf2Ui = onlineItemDataToUiInventoryItem({ code: 'qf2', quality: 7, identified: true })
      expect(qf2Ui.name).toBe("Khalim's Will")
      expect(qf2Ui.nameZh).toBe('克林姆的意志')
      const qf2Tooltip = formatItemTooltip(qf2Ui.rawItem!, 'en')
      expect(qf2Tooltip.title).toBe("Khalim's Will")
      expect(qf2Tooltip.qualityColor).toBe('#c8a15a')
    })

    it('renders all Act 3 quest items in Quest Gold (#c4a060 on ground, #c8a15a in tooltip) even when quality is normal (2)', () => {
      const act3QuestCodes = ['j34', 'g34', 'xyz', 'd33', 'g33', 'bbb', 'qey', 'qhr', 'qbr', 'qf1', 'qf2', 'mss']
      for (const code of act3QuestCodes) {
        expect(CANONICAL_QUEST_ITEM_CODES.has(code)).toBe(true)
        const groundMeta = resolveGroundItemMetadata({ code, quality: 2, identified: true })
        expect(groundMeta.color).toBe('#c4a060')

        const uiItem = onlineItemDataToUiInventoryItem({ code, quality: 2, identified: true })
        const tooltip = formatItemTooltip(uiItem.rawItem!, 'en')
        expect(tooltip.qualityColor).toBe('#c8a15a')
      }
    })
  })

  describe('Fix 3: vendorSell Guard Blocks All Act 3 Quest Items (including xyz, g33, d33)', () => {
    it('prevents selling any Act 3 quest item to NPCs', () => {
      const world = new ClientWorld()
      const hud = new HudManager()
      const commands: ClientCommand[] = []
      const model = new HudModel({
        world,
        hudManager: hud,
        onCommand: (c) => {
          commands.push(c)
          world.noteOutgoingCommand(c)
        },
        vendorPrice: () => 100,
        vendorRepairAll: () => 0,
      })
      const act3Codes = ['j34', 'g34', 'xyz', 'g33', 'd33', 'bbb', 'qey', 'qhr', 'qbr', 'qf1', 'qf2', 'mss']
      // Seed Ormus NPC and open store in ClientWorld
      ;(world.units as Map<string, any>).set('monster:50', {
        unitType: 'monster',
        id: 50,
        classId: 255, // Ormus
        mode: 1,
        x: 5130,
        y: 5090,
        lifePct: 128,
        flags: 0,
      })
      world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: 50 } })
      world.noteOutgoingCommand({ type: 'NpcOpenTrade', npcId: 50 })
      for (let i = 0; i < act3Codes.length; i++) {
        const itemId = 100 + i
        const code = act3Codes[i]!
        ;(world.containers.inventory as Map<number, any>).set(itemId, {
          id: itemId,
          code,
          quality: 2,
          location: 0,
          container: 'inventory',
          x: i % 10,
          y: Math.floor(i / 10),
          width: 1,
          height: 1,
          identified: true,
        })
      }
      for (let i = 0; i < act3Codes.length; i++) {
        expect(model.vendorSell(100 + i)).toBe(false)
      }
      expect(commands).toHaveLength(0)
    })
  })

  describe("Fix 4: Horadric Cube Quest Transmute Recipes (CubeMain.txt Row 0 & Row 1)", () => {
    it("transmutes Khalim's Flail (qf1) + Heart (qhr) + Eye (qey) + Brain (qbr) into Khalim's Will (qf2)", () => {
      const qf1 = onlineItemDataToUiInventoryItem({ id: 1, code: 'qf1', quality: 7, identified: true })
      const qhr = onlineItemDataToUiInventoryItem({ id: 2, code: 'qhr', quality: 2, identified: true })
      const qey = onlineItemDataToUiInventoryItem({ id: 3, code: 'qey', quality: 2, identified: true })
      const qbr = onlineItemDataToUiInventoryItem({ id: 4, code: 'qbr', quality: 2, identified: true })

      const res = transmuteCubeItems([
        { item: qf1, col: 0, row: 0 },
        { item: qhr, col: 2, row: 0 },
        { item: qey, col: 2, row: 1 },
        { item: qbr, col: 2, row: 2 },
      ])
      expect(res.matched).toBe(true)
      expect(res.resultItems).toHaveLength(1)
      const out = res.resultItems[0]!.item
      expect(out.code).toBe('qf2')
      expect(out.quality).toBe('unique')
      expect(out.name).toBe("Khalim's Will")
      expect(out.nameZh).toBe('克林姆的意志')
    })

    it('transmutes Staff of Kings (msf) + Amulet of the Viper (vip) into Horadric Staff (hst)', () => {
      const msf = onlineItemDataToUiInventoryItem({ id: 10, code: 'msf', quality: 7, identified: true })
      const vip = onlineItemDataToUiInventoryItem({ id: 11, code: 'vip', quality: 7, identified: true })

      const res = transmuteCubeItems([
        { item: msf, col: 0, row: 0 },
        { item: vip, col: 2, row: 0 },
      ])
      expect(res.matched).toBe(true)
      expect(res.resultItems).toHaveLength(1)
      const out = res.resultItems[0]!.item
      expect(out.code).toBe('hst')
      expect(out.quality).toBe('unique')
      expect(out.name).toBe('Horadric Staff')
      expect(out.nameZh).toBe('赫拉迪克法杖')
    })
  })

  describe('Fix 5: Sewer Stairs (366) & Sewer Lever (367) Automap & Metadata Parity', () => {
    it('hides Sewer Stairs (366, AutoMap=223) on automap until mode === 2 (ON)', () => {
      const obj366 = CANONICAL_113C_OBJECTS[366]
      expect(obj366).toBeDefined()
      expect(obj366?.selectableMask).toBe(4)

      expect(resolveObjectAutomapCellId({ objectClassId: 366, autoMapCol: 223, mode: 0 })).toBe(-1)
      expect(resolveObjectAutomapCellId({ objectClassId: 366, autoMapCol: 223, mode: 1 })).toBe(-1)
      expect(resolveObjectAutomapCellId({ objectClassId: 366, autoMapCol: 223, mode: 2 })).toBe(223)
    })
  })
})
