import { describe, expect, it, vi } from 'vitest'
import {
  computeCharsiImbueIlvl,
  imbueItem113c,
  isEligibleForCharsiImbue113c,
} from '../src/common/items/drop-tables.ts'
import {
  type ItemData,
  imbueItemData113c,
  imbueUiInventoryItem113c,
  onlineItemDataToUiInventoryItem,
} from '../src/common/items/item-bridge.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import { WorldPanelsHud, isEligibleArtisanItem } from '../src/client/ui/world-panels.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { decode0x58OpenUi } from '../src/netproto/d2gs/s2c/misc.ts'
import { getTownNpcDescriptorByHcIdx } from '../src/common/units/npc-table.ts'
import { lookupTbl } from '../src/client/i18n/lang.ts'
import type { UiInventoryItem } from '../src/client/ui/inventory.ts'

function makeUiItem(overrides: Record<string, unknown> = {}): UiInventoryItem {
  return {
    id: '101',
    code: 'ssd',
    name: 'Short Sword',
    nameZh: '短剑',
    baseNameZh: '短剑',
    quality: 'normal',
    invWidth: 1,
    invHeight: 3,
    invFile: 'invssd',
    allowedSlots: ['rarm'],
    identified: true,
    sockets: 0,
    stats: [],
    statsEn: [],
    ...overrides,
  } as unknown as UiInventoryItem
}

function makeWorldItemData(overrides: Partial<ItemData> = {}): ItemData {
  return {
    id: 101,
    code: 'ssd',
    action: 0,
    category: 5,
    flags: 0x10,
    version: 100,
    destination: 0,
    gridX: 0,
    gridY: 0,
    container: 2, // inventory
    equippedSlot: 0,
    earLevel: 0,
    earName: '',
    simpleItem: false,
    identified: true,
    ethereal: false,
    personalized: false,
    runeword: false,
    socketed: false,
    broken: false,
    ilvl: 12,
    quality: 2, // normal
    hasGraphic: false,
    graphicId: 0,
    hasColor: false,
    colorIndex: 0,
    inferiorRank: 0,
    superiorRank: 0,
    setId: 0,
    uniqueId: 0,
    runewordId: 0,
    personalizedName: '',
    defense: 0,
    maxDurability: 24,
    durability: 24,
    quantity: 0,
    sockets: 0,
    stats: [],
    setMods: [],
    runewordStats: [],
    ...overrides,
  } as ItemData
}

describe('Issue #902: Charsi Imbue UI, 1.13c Eligibility, and End-to-End Protocol Loop', () => {
  describe('R2 & R3: 1.13c Charsi Imbue ilvl & Eligibility Ground Truth (D2Common_10185 @ 0x6fd750b0)', () => {
    it('computes 1.13c Charsi Imbue ilvl (0x6fce040e..0x6fce041e: clvl <= 5 ? clvl : min(99, clvl + 4))', () => {
      expect(computeCharsiImbueIlvl(1)).toBe(1)
      expect(computeCharsiImbueIlvl(4)).toBe(4)
      expect(computeCharsiImbueIlvl(5)).toBe(5)
      expect(computeCharsiImbueIlvl(6)).toBe(10)
      expect(computeCharsiImbueIlvl(8)).toBe(12)
      expect(computeCharsiImbueIlvl(30)).toBe(34)
      expect(computeCharsiImbueIlvl(94)).toBe(98)
      expect(computeCharsiImbueIlvl(95)).toBe(99)
      expect(computeCharsiImbueIlvl(99)).toBe(99)
    })

    it('enforces exact D2Common_10185 (0x6fd750b0) eligibility rules in both drop-tables and WorldPanelsHud', () => {
      // 1. Eligible normal/low/superior weapons & armors with 0 sockets
      expect(isEligibleForCharsiImbue113c({ code: 'ssd', quality: 'normal', sockets: 0, identified: true })).toBe(true)
      expect(isEligibleForCharsiImbue113c({ code: 'cap', quality: 'low', sockets: 0, identified: true })).toBe(true)
      expect(isEligibleForCharsiImbue113c({ code: 'chn', quality: 'superior', sockets: 0, identified: true })).toBe(true)
      expect(isEligibleArtisanItem('imbue', makeUiItem({ code: 'ssd', quality: 'normal', sockets: 0 }))).toBe(true)
      expect(isEligibleArtisanItem('imbue', makeUiItem({ code: 'cap', quality: 'low', sockets: 0, category: 'helm' }))).toBe(true)
      expect(isEligibleArtisanItem('imbue', makeUiItem({ code: 'chn', quality: 'superior', sockets: 0, category: 'armor' }))).toBe(true)

      // 2. Ethereal non-throwing weapons and ethereal armors ARE eligible (0x6fd75114..0x6fd75126)
      expect(
        isEligibleForCharsiImbue113c({ code: 'ssd', quality: 'normal', sockets: 0, identified: true, ethereal: true }),
      ).toBe(true)
      expect(
        isEligibleForCharsiImbue113c({ code: 'chn', quality: 'normal', sockets: 0, identified: true, ethereal: true }),
      ).toBe(true)
      expect(
        isEligibleArtisanItem('imbue', makeUiItem({ code: 'ssd', quality: 'normal', sockets: 0, ethereal: true })),
      ).toBe(true)
      expect(
        isEligibleArtisanItem('imbue', makeUiItem({ code: 'chn', quality: 'normal', sockets: 0, ethereal: true, category: 'armor' })),
      ).toBe(true)

      // 3. Non-ethereal throwing weapons ARE eligible, but ETHEREAL throwing weapons are REJECTED (0x6fd7511c)
      expect(
        isEligibleForCharsiImbue113c({ code: 'jav', quality: 'normal', sockets: 0, identified: true, ethereal: false }),
      ).toBe(true)
      expect(
        isEligibleForCharsiImbue113c({ code: 'jav', quality: 'normal', sockets: 0, identified: true, ethereal: true }),
      ).toBe(false)
      expect(
        isEligibleForCharsiImbue113c({ code: 'tkf', quality: 'normal', sockets: 0, identified: true, ethereal: true }),
      ).toBe(false)
      expect(
        isEligibleArtisanItem('imbue', makeUiItem({ code: 'jav', quality: 'normal', sockets: 0, ethereal: false })),
      ).toBe(true)
      expect(
        isEligibleArtisanItem('imbue', makeUiItem({ code: 'jav', quality: 'normal', sockets: 0, ethereal: true })),
      ).toBe(false)
      expect(
        isEligibleArtisanItem('imbue', makeUiItem({ code: 'tkf', quality: 'normal', sockets: 0, ethereal: true })),
      ).toBe(false)

      // 4. Wirt's Leg ('leg') IS explicitly allowed (0x6fd75148..0x6fd75153), while other quest weapons are rejected
      expect(
        isEligibleForCharsiImbue113c({ code: 'leg', quality: 'normal', sockets: 0, identified: true }),
      ).toBe(true)
      expect(
        isEligibleArtisanItem('imbue', makeUiItem({ code: 'leg', quality: 'normal', sockets: 0 })),
      ).toBe(true)
      for (const questWeap of ['msf', 'hst', 'vip', 'g33', 'qf1', 'qf2', 'hfh']) {
        expect(isEligibleForCharsiImbue113c({ code: questWeap, quality: 'normal', sockets: 0, identified: true })).toBe(
          false,
        )
        expect(isEligibleArtisanItem('imbue', makeUiItem({ code: questWeap, quality: 'normal', sockets: 0 }))).toBe(
          false,
        )
      }

      // 5. Magic, Set, Rare, Unique, Crafted qualities are rejected (0x6fd750ff: quality must be 1..3)
      for (const q of ['magic', 'set', 'rare', 'unique', 'crafted'] as const) {
        expect(isEligibleForCharsiImbue113c({ code: 'ssd', quality: q, sockets: 0, identified: true })).toBe(false)
        expect(isEligibleArtisanItem('imbue', makeUiItem({ code: 'ssd', quality: q, sockets: 0 }))).toBe(false)
      }

      // 6. Socketed items (sockets > 0) and unidentified items are rejected
      expect(isEligibleForCharsiImbue113c({ code: 'ssd', quality: 'normal', sockets: 1, identified: true })).toBe(false)
      expect(isEligibleArtisanItem('imbue', makeUiItem({ code: 'ssd', quality: 'normal', sockets: 2 }))).toBe(false)
      expect(isEligibleForCharsiImbue113c({ code: 'ssd', quality: 'normal', sockets: 0, identified: false })).toBe(false)
      expect(isEligibleArtisanItem('imbue', makeUiItem({ code: 'ssd', quality: 'normal', sockets: 0, identified: false }))).toBe(
        false,
      )

      // 7. Misc items (potions, scrolls, rings, amulets, charms, quivers, ears) are rejected
      for (const miscCode of ['hp1', 'mp1', 'isc', 'tsc', 'rin', 'amu', 'cm1', 'aqv', 'cqv', 'ear', 'gld']) {
        expect(isEligibleForCharsiImbue113c({ code: miscCode, quality: 'normal', sockets: 0, identified: true })).toBe(
          false,
        )
        expect(isEligibleArtisanItem('imbue', makeUiItem({ code: miscCode, quality: 'normal', sockets: 0, category: 'misc' }))).toBe(
          false,
        )
      }
    })

    it('generates an identified Rare item with Rare name, 3..6 affixes, and preserved ethereal/personalized state (0x6fce0320)', () => {
      const imbued = imbueItem113c(
        {
          code: 'ssd',
          quality: 'superior',
          sockets: 0,
          identified: true,
          ethereal: true,
          personalized: true,
          personalizedName: 'Hero',
        },
        { playerLevel: 24, seed: 0x13572468 },
      )
      expect(imbued.quality).toBe('rare')
      expect(imbued.ilvl).toBe(28) // 24 + 4
      expect(imbued.identified).toBe(true)
      expect(imbued.ethereal).toBe(true)
      expect(imbued.personalized).toBe(true)
      expect(imbued.personalizedName).toBe('Hero')
      expect(imbued.rarePrefixId).toBeGreaterThan(0)
      expect(imbued.rareSuffixId).toBeGreaterThan(0)
      expect(imbued.rareName?.length).toBeGreaterThan(2)
      const totalAffixes = imbued.prefixes.length + imbued.suffixes.length
      expect(totalAffixes).toBeGreaterThanOrEqual(3)
      expect(totalAffixes).toBeLessThanOrEqual(6)
      expect(imbued.prefixes.length).toBeLessThanOrEqual(3)
      expect(imbued.suffixes.length).toBeLessThanOrEqual(3)
      expect(imbued.rolledProps.length).toBeGreaterThan(0)

      // Engine wrapper
      const engine = new GameEngine('sor')
      const engineImbued = engine.imbueItem('chn', { playerLevel: 18, ethereal: true, seed: 999 })
      expect(engineImbued.quality).toBe('rare')
      expect(engineImbued.ilvl).toBe(22)
      expect(engineImbued.ethereal).toBe(true)
      expect(engineImbued.identified).toBe(true)
    })

    it('transforms both ItemData and UiInventoryItem into Rare items with localized names and tooltip stats', () => {
      const baseData = makeWorldItemData({
        id: 505,
        code: 'ssd',
        quality: 3, // superior
        ethereal: true,
        personalized: true,
        personalizedName: 'Deckard',
      })
      const imbuedData = imbueItemData113c(baseData, 20, 123456)
      expect(imbuedData.id).toBe(505)
      expect(imbuedData.quality).toBe(6) // rare
      expect(imbuedData.ilvl).toBe(24)
      expect(imbuedData.identified).toBe(true)
      expect(imbuedData.ethereal).toBe(true)
      expect(imbuedData.personalized).toBe(true)
      expect(imbuedData.personalizedName).toBe('Deckard')
      expect(imbuedData.container).toBe(0) // cursor
      expect(imbuedData.destination).toBe(1) // cursor
      expect(imbuedData.stats?.length ?? 0).toBeGreaterThan(0)

      const uiFromData = onlineItemDataToUiInventoryItem(imbuedData)
      expect(uiFromData.quality).toBe('rare')
      expect(uiFromData.ethereal).toBe(true)
      expect(uiFromData.stats.length).toBeGreaterThan(0)

      const uiDirect = imbueUiInventoryItem113c(makeUiItem({ id: '777', code: 'cap', category: 'helm', ethereal: true }), 16, 654321)
      expect(uiDirect.id).toBe('777')
      expect(uiDirect.quality).toBe('rare')
      expect(uiDirect.identified).toBe(true)
      expect(uiDirect.ethereal).toBe(true)
      expect(uiDirect.stats.length).toBeGreaterThan(0)
    })
  })

  describe('R1 & R2: WorldPanelsHud Imbue UI, Slot Placement/Swap/Pickup, Hover Tooltip & Safe Return', () => {
    it('renders Imbue panel title, prompt, slot item, and handles slot click lifecycle without item loss', () => {
      const wp = new WorldPanelsHud()
      wp.lang = 'CHI'
      wp.activePanel = 'imbue'

      const drawTextCalls: Array<{ text: string; x: number; y: number }> = []
      const mockFont = {
        loaded: true,
        drawText: (_ctx: any, text: string, x: number, y: number) => {
          drawTextCalls.push({ text, x, y })
        },
        measureText: (text: string) => text.length * 8,
        getFontMeta: () => ({ lineHeight: 16 }),
      } as any
      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        drawImage: vi.fn(),
        fillText: vi.fn(),
      } as any

      // Render empty Imbue panel in 800x600 (useitem.cpp draws at absolute coordinates, no 80/60 offset)
      wp.renderActiveLeftPanel(mockCtx, 'imbue', mockFont, {}, 800, 600)
      const expectedPrompt = lookupTbl('patchstring#76', 'CHI')!
      expect(expectedPrompt).toBeTruthy()
      expect(drawTextCalls.map((c) => c.text).join('')).toBe(expectedPrompt)
      expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), 105, 86, 119, 184)

      // Confirm click on empty slot is a no-op (button disabled when empty)
      let confirmedItemId = 0
      const inventory = {
        cursorItem: null as UiInventoryItem | null,
        gridItems: [] as Array<{ item: UiInventoryItem; col: number; row: number }>,
        autoPlaceInGrid(item: UiInventoryItem) {
          this.gridItems.push({ item, col: 0, row: 0 })
          return true
        },
      }
      wp.handleActiveLeftPanelClick('imbue', 138, 240, false, false, {
        onConfirmQuestReward: (id) => {
          confirmedItemId = id
        },
        inventory,
      })
      expect(confirmedItemId).toBe(0)
      expect(wp.activePanel).toBe('imbue')

      // Attempt to place an INELIGIBLE magic item into slot ([123..211]x[106..220], D2Client 0x6fb503ae)
      const magicSword = makeUiItem({ id: '201', code: 'ssd', quality: 'magic' })
      inventory.cursorItem = magicSword
      wp.handleActiveLeftPanelClick('imbue', 167, 160, false, false, {
        inventory,
      })
      expect(wp.questRewardItem).toBeNull()
      expect(inventory.cursorItem).toBe(magicSword)

      // Place an ELIGIBLE normal Short Sword into slot
      const normalSword = makeUiItem({ id: '101', code: 'ssd', quality: 'normal', sockets: 0 })
      inventory.cursorItem = normalSword
      wp.handleActiveLeftPanelClick('imbue', 167, 160, false, false, {
        inventory,
      })
      expect(wp.questRewardItem).toBe(normalSword)
      expect(inventory.cursorItem).toBeNull()

      // Hover over the occupied slot -> populates hoveredQuestRewardItem
      wp.handleMouseMove(167, 160)
      expect(wp.hoveredQuestRewardItem?.item).toBe(normalSword)
      wp.handleMouseMove(20, 20)
      expect(wp.hoveredQuestRewardItem).toBeNull()

      // Swap occupied slot item with another eligible cursor item
      const normalHelm = makeUiItem({ id: '102', code: 'cap', name: 'Cap', quality: 'normal', sockets: 0, category: 'helm' })
      inventory.cursorItem = normalHelm
      wp.handleActiveLeftPanelClick('imbue', 167, 160, false, false, { inventory })
      expect(wp.questRewardItem).toBe(normalHelm)
      expect(inventory.cursorItem).toBe(normalSword)

      // Pick up item from slot when cursor is empty
      inventory.cursorItem = null
      wp.handleActiveLeftPanelClick('imbue', 167, 160, false, false, { inventory })
      expect(wp.questRewardItem).toBeNull()
      expect(inventory.cursorItem).toBe(normalHelm)

      // Place item back in slot, put another item on cursor, then click Close
      // (buysellbtn frame 10, [177..209]x[224..256]; 1.13c semantics per issue #927:
      // mouse-down latches the depressed cell, the close fires on mouse-up back on it)
      // Verify slot item is safely auto-placed into inventory grid without overwriting cursorItem!
      wp.questRewardItem = normalHelm
      inventory.cursorItem = normalSword
      let closed = false
      wp.handleActiveLeftPanelClick('imbue', 190, 240, false, false, {
        onClose: () => {
          closed = true
        },
        inventory,
      })
      expect(closed).toBe(false)
      expect(wp.hasPendingCloseRelease()).toBe(true)
      wp.releaseCloseButton(190, 240, 190, 240)
      expect(closed).toBe(true)
      expect(wp.questRewardItem).toBeNull()
      expect(inventory.cursorItem).toBe(normalSword)
      expect(inventory.gridItems.some((g) => g.item === normalHelm)).toBe(true)
    })
  })

  describe('R3: Client-Server End-to-End Protocol Loop (C2S 0x38 / S2C 0x58 / Quest Bit 0x0002 -> 0x0001)', () => {
    it('decodes S2C 0x58 OpenUi(uiId=6) with unitType=1 when unitId > 0 and unitType=0 when unitId === 0', () => {
      const openPacket = new Uint8Array([0x58, 0x2a, 0x00, 0x00, 0x00, 0x06, 0x00])
      const decodedOpen = decode0x58OpenUi(openPacket)
      expect(decodedOpen).toEqual({
        type: 'OpenUi',
        uiId: 6,
        unitType: 1,
        unitId: 0x2a,
        extra: 0,
      })

      const closePacket = new Uint8Array([0x58, 0x00, 0x00, 0x00, 0x00, 0x06, 0x00])
      const decodedClose = decode0x58OpenUi(closePacket)
      expect(decodedClose).toEqual({
        type: 'OpenUi',
        uiId: 6,
        unitType: 0,
        unitId: 0,
        extra: 0,
      })
    })

    it('completes the full Charsi Imbue flow through HudModel, ClientWorld, and HudManager', () => {
      const world = new ClientWorld()
      const hud = new HudManager()
      const emittedCommands: any[] = []

      const model = new HudModel({
        world,
        hudManager: hud,
        onCommand: (cmd) => {
          emittedCommands.push(cmd)
          world.noteOutgoingCommand(cmd)
        },
      })
      hud.commandSink = model as any

      // 1. Spawn player (level 20) and Charsi (unitId = 42, hcIdx = 154) in Act 1 town
      const charsiDesc = getTownNpcDescriptorByHcIdx(154)!
      expect(charsiDesc.npcTxtKey).toBe('charsi')
      ;(world.self as any).level = 20
      world.apply({
        type: 'AssignNpc',
        unitId: 42,
        classId: 154,
        x: 5100,
        y: 5050,
        life: 128,
      } as any)

      // 2. Grant A1Q5 (Tools of the Trade, quest index 3) reward bit 0x0002 (b0=0, b1=1)
      const qWords = new Array<number>(48).fill(0)
      qWords[3] = 0x0002
      world.apply({
        type: 'QuestState',
        updateType: 6,
        quests: qWords,
      } as any)
      expect((world.quests[3]! & 0x0002) !== 0).toBe(true)

      // Verify Charsi's NPC menu includes 'imbue' while q[3] & 0x0002 is set
      const menuBefore = hud.worldPanels.buildNpcMenuOptions(charsiDesc, {
        questFlags: world.quests,
      })
      expect(menuBefore.some((opt) => opt.id === 'imbue')).toBe(true)

      // 3. Put an eligible normal Short Sword (id = 101) into world inventory and sync
      const swordData = makeWorldItemData({
        id: 101,
        code: 'ssd',
        quality: 2, // normal
        sockets: 0,
        identified: true,
        ethereal: true,
      })
      ;(world.containers as any).inventory.set(101, swordData)
      ;(world.containers as any).allById.set(101, swordData)

      // 4. Server sends S2C 0x58 OpenUi(uiId = 6, unitType = 1, unitId = 42) -> opens Imbue left panel + Inventory right panel
      world.apply({
        type: 'OpenUi',
        uiId: 6,
        unitType: 1,
        unitId: 42,
        extra: 0,
      })
      model.syncFromWorld()
      expect(hud.leftPanel).toBe('imbue')
      expect(hud.rightPanel).toBe('inv')
      expect(hud.inventory.visible).toBe(true)

      // 5. Place the sword into the Imbue slot
      const uiSword = onlineItemDataToUiInventoryItem(swordData)
      hud.worldPanels.questRewardItem = uiSword

      // 6. Click Confirm button in Imbue panel via HudModel.confirmQuestReward
      model.confirmQuestReward(101, 42)

      // Verify C2S 0x38 NpcEntityAction(action: 0, npcId: 42, complement: 101) was emitted
      expect(emittedCommands).toContainEqual({
        type: 'NpcEntityAction',
        action: 0,
        npcId: 42,
        complement: 101,
      })

      // Verify left Imbue panel closed, right Inventory panel stayed open, and cursor holds the newly imbued Rare sword
      expect(hud.leftPanel).toBe('none')
      expect(hud.rightPanel).toBe('inv')
      expect(hud.inventory.visible).toBe(true)
      expect(hud.worldPanels.questRewardItem).toBeNull()
      expect(hud.inventory.cursorItem).not.toBeNull()
      expect(hud.inventory.cursorItem?.quality).toBe('rare')
      expect(hud.inventory.cursorItem?.identified).toBe(true)
      expect(hud.inventory.cursorItem?.ethereal).toBe(true)
      expect(hud.inventory.cursorItem?.stats.length).toBeGreaterThan(0)

      // Verify A1Q5 quest bit transitioned from 0x0002 -> 0x0001 and Charsi's NPC menu no longer offers 'imbue'
      expect(world.quests[3]! & 0x0002).toBe(0)
      expect(world.quests[3]! & 0x0001).toBe(0x0001)
      const menuAfter = hud.worldPanels.buildNpcMenuOptions(charsiDesc, {
        questFlags: world.quests,
      })
      expect(menuAfter.some((opt) => opt.id === 'imbue')).toBe(false)
    })

    it('imbues an eligible item in GameEngine using the player level and loot RNG', () => {
      const engine = new GameEngine('bar')
      engine.world.player.level = 18

      const imbued = engine.imbueItem('ssd', {
        ethereal: true,
        personalized: true,
      }) as any
      expect(imbued.quality).toBe('rare')
      expect(imbued.ilvl).toBe(22) // max(18 + 4, 18) = 22
      expect(imbued.identified).toBe(true)
      expect(imbued.ethereal).toBe(true)
      expect(imbued.personalized).toBe(true)
      expect(imbued.rarePrefixId).toBeGreaterThan(0)
      expect(imbued.rareSuffixId).toBeGreaterThan(0)
      const totalAffixes = imbued.prefixes.length + imbued.suffixes.length
      expect(totalAffixes).toBeGreaterThanOrEqual(3)
      expect(totalAffixes).toBeLessThanOrEqual(6)

      // Ineligible item (already Rare) throws
      expect(() => engine.imbueItem(imbued)).toThrow()
    })

    it('Issue #987 / #988: handles D2GS rawFlags (0x200010), 0x29 GameQuestLog, and 0x42 + 0x9C(action=2,location=4) + 0x58(uiId=6) server sequence without returning un-imbued item to cursor', () => {
      const world = new ClientWorld()
      const hud = new HudManager()
      const emittedCommands: any[] = []

      const model = new HudModel({
        world,
        hudManager: hud,
        onCommand: (cmd) => {
          emittedCommands.push(cmd)
          world.noteOutgoingCommand(cmd)
        },
      })
      hud.commandSink = model as any
      ;(world.self as any).level = 16
      world.selfId = 1

      // Simulate S2C 0x29 GameQuestLog having set _hasQuestInfo = true before S2C 0x28
      world.apply({
        type: 'QuestState',
        source: 0x29,
        kind: 'log',
        quests: new Array<number>(48).fill(0),
      } as any)

      // Open Charsi Imbue window via NPC menu action
      model.openArtisanWindow('imbue', 42)
      expect(hud.leftPanel).toBe('imbue')

      // Pick up an eligible normal item with D2GS wire rawFlags = 0x200010 (compact + identified, bit 0x01 === 0)
      const cursorSword = makeWorldItemData({
        id: 303,
        code: 'ssd',
        quality: 2,
        compact: true,
        simple: true,
        simpleItem: true,
        rawFlags: 0x200010,
        identified: undefined as any,
        location: 4,
        container: 'cursor' as any,
      })
      world.apply({
        type: 'WorldItemAction',
        action: 0x05,
        item: cursorSword,
        container: 'cursor',
      } as any)
      model.syncFromWorld()

      // Place item into Imbue slot
      const uiSword = onlineItemDataToUiInventoryItem({ ...cursorSword, identified: true })
      hud.worldPanels.questRewardItem = uiSword
      hud.inventory.cursorItem = null

      // Click Confirm -> immediately imbues optimistically into Rare item on cursor
      model.confirmQuestReward(303, 42)
      expect(hud.leftPanel).toBe('none')
      const optimisticCursor = hud.inventory.cursorItem as typeof uiSword | null
      expect(optimisticCursor).not.toBeNull()
      expect(optimisticCursor?.quality).toBe('rare')

      // Now simulate authoritative D2GS QUESTS_CharsiImbueItem (0x6fce0310) response sequence:
      // 1. S2C 0x42 ClearCursor
      world.apply({
        type: 'CursorClear',
        unitType: 0,
        id: 1,
      } as any)
      // 2. S2C 0x9C WorldItemAction(action=0x02, location=4 IMODE_ONCURSOR) from INVMODE_PutInCursor (0x6fcf76a0)
      const serverRareSword = imbueItemData113c({ ...cursorSword, id: 304, identified: true }, 16, 0x987988)
      world.apply({
        type: 'WorldItemAction',
        action: 0x02,
        item: {
          ...serverRareSword,
          action: 0x02,
          location: 4,
          container: undefined as any,
        },
      } as any)
      // 3. S2C 0x58 OpenUi(uiId=6, unitId=0)
      world.apply({
        type: 'OpenUi',
        uiId: 6,
        unitType: 0,
        unitId: 0,
        extra: 0,
      })
      model.syncFromWorld()

      // Authoritative Rare item must be on cursor (never routed to ground)
      const authoritativeCursor = hud.inventory.cursorItem as typeof uiSword | null
      expect(world.containers.cursor?.id).toBe(304)
      expect(world.containers.cursor?.quality).toBe(6)
      expect(world.containers.ground.has(304)).toBe(false)
      expect(authoritativeCursor?.id).toBe('304')
      expect(authoritativeCursor?.quality).toBe('rare')
      expect(authoritativeCursor?.stats.length).toBeGreaterThan(0)
    })
  })
})

