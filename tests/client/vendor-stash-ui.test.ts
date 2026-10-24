/**
 * Server-driven store / stash / gold UI (D2Client 1.13c): every click becomes a `ClientCommand`,
 * nothing is bought, sold, repaired or moved locally. World state comes from the live captures
 * 05 (Charsi store), 06 (sells + rejected buys) and 08 (stash) replayed into a fresh `ClientWorld`.
 */
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { replayD2CapFile } from '../../tools/netproto-replay.ts'
import {
  ClickButtonId,
  encodeC2sSelectMainItem,
  type ClientCommand,
  type ServerEvent,
} from '../../src/netproto/index.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { D2StatId } from '../../src/client/world/stat-list.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import {
  NPC_SPEECH_BOX_H,
  NPC_SPEECH_BOX_W,
  NPC_SPEECH_LEADING_BLANK_LINES,
  STASH_GOLD_BTN_HIT,
  VENDOR_BUTTON_TABLE_X,
  VENDOR_GRID_ORIGIN,
  WorldPanelsHud,
  buildNpcMenuOptions,
  wrapSpeechText,
} from '../../src/client/ui/world-panels.ts'
import {
  TOWN_NPC_DESCRIPTORS,
  getLocalizedNpcGossip,
  getLocalizedNpcGreetings,
  getLocalizedNpcName,
  getTownNpcDescriptorByHcIdx,
  resolveNpcDialogueTblText,
} from '../../src/common/units/npc-table.ts'
import { requireTbl } from '../../src/client/i18n/lang.ts'
import {
  HudModel,
  NPC_TRADE_THROTTLE_MS,
  npcTransactionMessageKey,
} from '../../src/client/ui-model/hud-model.ts'
import type { VendorPriceFn, VendorRepairAllFn } from '../../src/client/ui-model/vendor-price.ts'
import { decode0x27NpcInfo } from '../../src/netproto/d2gs/s2c/npc.ts'
import { buildSceneDrawables } from '../../src/client/view/unit-drawables.ts'
import { OVERLAY_METAS } from '../../src/client/render/overlays-meta.ts'
import { isUsableRightClickItem } from '../../src/client/ui/inventory.ts'
import {
  CANONICAL_NPC_MSG_ID_TO_TBL_KEY,
  resolveNpcIntroMsgIdByTblKey,
  resolveNpcMsgIdTblKey,
  resolveQuestTitleKeyForMsgId,
} from '../../src/common/data/canonical-npc-dialog-table.ts'

if (typeof globalThis.window === 'undefined') {
  ;(globalThis as unknown as { window: Record<string, unknown> }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

const FIXTURES = path.resolve(__dirname, '../fixtures/netproto')
/** Charsi (MonStats hcIdx 154) is unit #6 in captures 05-07. */
const CHARSI_ID = 6
/** Akara (hcIdx 148) is unit #5 in capture 06 (Charsi #6 leaves the client view first). */
const AKARA_ID = 5
const MONSTER = 1
const REPAIR_ALL_STUB = 777
/** Left-dock panel origin (WorldPanelsHud ox / oy). */
const STASH_X = 80
const STASH_Y = 60

/** Display-only price stub (D2Game ignores the client cost): distinct per item and transaction type. */
const stubPrice: VendorPriceFn = (item, type) => 1000 * (type + 1) + item.id
const stubRepairAll: VendorRepairAllFn = () => REPAIR_ALL_STUB

function createSession() {
  const world = new ClientWorld()
  const hud = new HudManager()
  const commands: ClientCommand[] = []
  const clock = { t: 50_000 }
  const model = new HudModel({
    world,
    hudManager: hud,
    // OnlineSession.forwardCommandToAdapter notes every sent command on the world.
    onCommand: (c) => {
      commands.push(c)
      world.noteOutgoingCommand(c)
    },
    vendorPrice: stubPrice,
    vendorRepairAll: stubRepairAll,
    now: () => clock.t,
  })
  return { world, hud, model, commands, clock }
}

function loadCapture(name: string): readonly ServerEvent[] {
  const r = replayD2CapFile(path.join(FIXTURES, name), { strict: true })
  expect(r.unknownPackets).toBe(0)
  return r.events
}

const isShopItem = (e: ServerEvent): boolean => e.type === 'ItemEvent' && e.container === 'shop'

/** Replay up to the store contents, click the NPC (C2S 0x13 NpcInit) and return the remaining events. */
function walkUpToNpc(s: ReturnType<typeof createSession>, events: readonly ServerEvent[], npcId: number): ServerEvent[] {
  const firstShop = events.findIndex(isShopItem)
  expect(firstShop).toBeGreaterThan(0)
  for (const e of events.slice(0, firstShop)) s.world.apply(e)
  s.model.syncFromWorld()
  s.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: MONSTER, id: npcId } })
  s.model.syncFromWorld()
  // First-visit menu=0 intro slots from S2C 0x27 (Charsi 37 CharsiIntroBarGossip1, Akara 11
  // AkaraIntroGossip1 chained with quest 64) auto-pop the greeting speech before the stone
  // menu (1.13c parity); dismiss the chained speeches so store-flow tests can click the menu.
  let guard = 0
  while (s.hud.worldPanels.npcSpeech !== null && guard++ < 8) {
    s.hud.worldPanels.closeNpcSpeech()
    s.model.syncFromWorld()
  }
  s.commands.length = 0
  return events.slice(firstShop)
}

function mouseDown(hud: HudManager, x: number, y: number, opts: { button?: number; shiftKey?: boolean } = {}): void {
  hud.handleHudMouseDown({
    clientX: x,
    clientY: y,
    button: opts.button ?? 0,
    shiftKey: opts.shiftKey ?? false,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as MouseEvent)
}

function clickNpcOption(hud: HudManager, optionId: string): void {
  const menu = hud.worldPanels.npcMenu
  if (!menu?.options) throw new Error('no NPC menu')
  const idx = menu.options.findIndex(
    (o) => o.id === optionId || (optionId === 'trade' && o.id === 'trade_repair') || (optionId === 'trade_repair' && o.id === 'trade'),
  )
  expect(idx).toBeGreaterThanOrEqual(0)
  const layout = hud.worldPanels.getNpcMenuLayout(hud.font)!
  mouseDown(hud, layout.left + Math.trunc(layout.width / 2), layout.optionYs[idx]! - 3)
}

function openCharsiStore(capture: string, keep: (e: ServerEvent) => boolean = () => true) {
  const s = createSession()
  const rest = walkUpToNpc(s, loadCapture(capture), CHARSI_ID)
  s.model.openNpcTrade(CHARSI_ID)
  for (const e of rest) if (keep(e)) s.world.apply(e)
  s.model.syncFromWorld()
  return s
}

describe('NPC menu -> server store', () => {
  it('NpcInit opens the descriptor menu; "trade/repair" sends 0x38 and the 0x9C store fills the panel with display prices', () => {
    const s = createSession()
    const rest = walkUpToNpc(s, loadCapture('05-d2gs-vendor-open.d2cap'), CHARSI_ID)
    const menu = s.hud.worldPanels.npcMenu
    expect(menu?.npcId).toBe(CHARSI_ID)
    expect(menu?.options?.some((o) => o.id === 'trade' || o.id === 'trade_repair')).toBe(true)

    clickNpcOption(s.hud, 'trade')
    expect(s.commands).toEqual([{ type: 'NpcOpenTrade', npcId: CHARSI_ID }])
    expect(s.hud.leftPanel).toBe('vendor')
    expect(s.world.npcInteraction.window).toBe('trade')

    for (const e of rest) s.world.apply(e)
    s.model.syncFromWorld()
    const wp = s.hud.worldPanels
    const shown = Object.values(wp.vendorTabPlacements).flat()
    expect(shown.length).toBe(s.world.containers.shop.size)
    expect(shown.length).toBe(46)
    for (const pl of shown) {
      const raw = s.world.containers.shop.get(Number(pl.item.id))!
      expect(pl.item.buyCost).toBe(stubPrice(raw, 0, { world: s.world, npcClass: 154 }))
      expect(pl.col).toBe(raw.gridX)
      expect(pl.row).toBe(raw.gridY)
    }
    expect(wp.vendorRepairAllCost).toBe(REPAIR_ALL_STUB)
    // Player items carry the sell value (type 1) and, at a smith, the repair cost (type 3).
    for (const pl of s.hud.inventory.gridItems) {
      expect(pl.item.sellCost).toBe(1000 * 2 + Number(pl.item.id))
    }
    const axeRaw = [...s.world.containers.equipment.values()].find((i) => i.code === 'hax')!
    const axe = s.hud.inventory.equipped.weapon1
    expect(axe?.id).toBe(String(axeRaw.id))
    expect(axe?.repairCost).toBe(0)

    // Closing the panel sends 0x30 and frees the store locally (no RemoveFromShop arrives).
    s.hud.closeAllPanels()
    expect(s.commands.at(-1)).toEqual({ type: 'NpcCancel', target: { unitType: MONSTER, id: CHARSI_ID } })
    expect(s.world.containers.shop.size).toBe(0)
    expect(s.hud.leftPanel).toBe('none')
    expect(wp.activeVendorDescriptor).toBeNull()
  })

  it('"cancel" and clicks outside the menu send NpcCancel', () => {
    const s = createSession()
    walkUpToNpc(s, loadCapture('05-d2gs-vendor-open.d2cap'), CHARSI_ID)
    clickNpcOption(s.hud, 'cancel')
    expect(s.commands).toEqual([{ type: 'NpcCancel', target: { unitType: MONSTER, id: CHARSI_ID } }])
    expect(s.hud.worldPanels.npcMenu).toBeNull()

    s.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: MONSTER, id: CHARSI_ID } })
    s.model.syncFromWorld()
    expect(s.hud.worldPanels.npcMenu?.npcId).toBe(CHARSI_ID)
    mouseDown(s.hud, 20, 20)
    expect(s.commands.at(-1)).toEqual({ type: 'NpcCancel', target: { unitType: MONSTER, id: CHARSI_ID } })
    expect(s.hud.worldPanels.npcMenu).toBeNull()
  })

  it('Charsi does not gamble: openNpcGamble fails fast', () => {
    const s = createSession()
    walkUpToNpc(s, loadCapture('05-d2gs-vendor-open.d2cap'), CHARSI_ID)
    expect(() => s.model.openNpcGamble(CHARSI_ID)).toThrow(/does not gamble/)
    expect(s.commands).toEqual([])
  })

  it('a store needs price providers: without them openNpcTrade throws before sending', () => {
    const world = new ClientWorld()
    const commands: ClientCommand[] = []
    const model = new HudModel({ world, hudManager: new HudManager(), onCommand: (c) => commands.push(c) })
    expect(() => model.openNpcTrade(CHARSI_ID)).toThrow(/vendorPrice/)
    expect(commands).toEqual([])
  })
})

describe('store actions are commands only', () => {
  it('buy / shift-buy click the store grid -> 0x32 with itemMode 0 and the #10107 price without 2000 ms throttle (1.13c 0x6faf6f6f, #1304)', () => {
    const s = openCharsiStore('05-d2gs-vendor-open.d2cap')
    const before = s.commands.length
    const pl = s.hud.worldPanels.getActiveVendorPlacements()[0]!
    const x = VENDOR_GRID_ORIGIN.x + pl.col * VENDOR_GRID_ORIGIN.cellPx + 5
    const y = VENDOR_GRID_ORIGIN.y + pl.row * VENDOR_GRID_ORIGIN.cellPx + 5
    const itemId = Number(pl.item.id)
    const raw = s.world.containers.shop.get(itemId)!
    const shopSize = s.world.containers.shop.size
    const gold = s.world.self.gold

    mouseDown(s.hud, x, y)
    expect(s.commands.slice(before)).toEqual([
      { type: 'NpcBuy', npcId: CHARSI_ID, itemId, itemMode: 0, gamble: false, shiftFill: false, cost: stubPrice(raw, 0, { world: s.world, npcClass: 154 }) },
    ])
    // D2Client.dll 0x6faf6f5c..0x6faf6f6f: `g_bIsRepairAll` (`[0x6fbcbc90]`) is 0 for buy (`0x32`),
    // so consecutive buys dispatch immediately without waiting 2000 ms (#1304).
    mouseDown(s.hud, x, y, { shiftKey: true })
    expect(s.commands.length).toBe(before + 2)
    expect(s.commands.at(-1)).toMatchObject({ type: 'NpcBuy', itemId, shiftFill: true, gamble: false })

    // Nothing changed locally: the server answers with 0x2A / 0x9C / stat 14.
    expect(s.world.containers.shop.size).toBe(shopSize)
    expect(s.world.self.gold).toBe(gold)
    expect(s.hud.inventory.cursorItem).toBeNull()
  })

  it('sell / repair / repair-all send 0x33 / 0x35 with the current durability; only repair-all (0x6fbcbc90 != 0) is throttled to 2000 ms (#1304)', () => {
    const s = openCharsiStore('05-d2gs-vendor-open.d2cap')
    const before = s.commands.length
    const scroll = [...s.world.containers.inventory.values()].find((i) => i.code === 'tsc')!
    const axe = [...s.world.containers.equipment.values()].find((i) => i.code === 'hax')!

    expect(s.model.vendorSell(scroll.id)).toBe(true)
    expect(s.model.vendorSell(scroll.id)).toBe(true)
    // 1.13c: items at max durability reject repair
    expect(s.model.vendorRepairItem(axe.id)).toBe(false)
    Object.assign(axe, { curDurability: 20 })
    expect(s.model.vendorRepairItem(axe.id)).toBe(true)
    // Single-item repair (`[0x6fbcbc90] == 0`) does not arm the 2000 ms `[0x6fbd3484]` Repair-All cooldown;
    // the first `vendorRepairAll` (`[0x6fbcbc90] == 1`) succeeds immediately, and a second one within 2000 ms is throttled.
    expect(s.model.vendorRepairAll()).toBe(true)
    expect(s.model.vendorRepairAll()).toBe(false)
    s.clock.t += NPC_TRADE_THROTTLE_MS
    expect(s.model.vendorRepairAll()).toBe(true)

    expect(s.commands.slice(before)).toEqual([
      { type: 'NpcSell', npcId: CHARSI_ID, itemId: scroll.id, itemMode: 0, cost: stubPrice(scroll, 1, { world: s.world, npcClass: 154 }) },
      { type: 'NpcSell', npcId: CHARSI_ID, itemId: scroll.id, itemMode: 0, cost: stubPrice(scroll, 1, { world: s.world, npcClass: 154 }) },
      { type: 'NpcRepairItem', npcId: CHARSI_ID, itemId: axe.id, itemMode: 0, durability: 20 },
      { type: 'NpcRepairAll', npcId: CHARSI_ID },
      { type: 'NpcRepairAll', npcId: CHARSI_ID },
    ])
    expect(s.world.containers.inventory.has(scroll.id)).toBe(true)
    expect(s.world.containers.equipment.get(axe.id)?.curDurability).toBe(20)
  })

  it('Repair All button and holding a cursor item over the store grid go through the command sink', () => {
    const s = openCharsiStore('05-d2gs-vendor-open.d2cap')
    const before = s.commands.length
    const wp = s.hud.worldPanels
    // Charsi button table [buy, sell, repair, repairAll]; slot 3 = Repair All.
    wp.handleLeftDockClick('vendor', 80 + VENDOR_BUTTON_TABLE_X[3] + 20, 60 + 390, {
      onClose: () => {},
      onWaypointTeleport: () => {},
      onVendorRepairAll: () => s.model.vendorRepairAll(),
    })

    // Pick up scroll to cursor and click the vendor grid -> NpcSell with itemMode: 4
    const scroll = [...s.world.containers.inventory.values()].find((i) => i.code === 'tsc')!
    s.world.apply({
      type: 'ItemEvent',
      action: 0x05,
      container: 'cursor',
      item: { ...scroll, opcode: 0x9d, action: 0x05, location: 4, container: 'cursor' },
    })
    s.model.syncFromWorld()
    mouseDown(s.hud, VENDOR_GRID_ORIGIN.x + 20, VENDOR_GRID_ORIGIN.y + 20)

    expect(s.commands.slice(before)).toEqual([
      { type: 'NpcRepairAll', npcId: CHARSI_ID },
      { type: 'NpcSell', npcId: CHARSI_ID, itemId: scroll.id, itemMode: 4, cost: stubPrice(scroll, 1, { world: s.world, npcClass: 154 }) },
    ])
  })

  it('a store action with no store open fails fast', () => {
    const s = createSession()
    expect(() => s.model.vendorBuy(1, false)).toThrow(/no store window/)
    expect(() => s.model.vendorRepairAll()).toThrow(/no store window/)
  })
})

describe('S2C 0x2A NpcTransaction feedback', () => {
  it('rejected buys (result 12) show TransactionResults10 (tbl 3362)', () => {
    const s = createSession()
    const rest = walkUpToNpc(s, loadCapture('06-d2gs-vendor-buy-sell.d2cap'), AKARA_ID)
    s.model.openNpcTrade(AKARA_ID)
    expect(s.hud.worldPanels.vendorRepairAllCost).toBeNull()
    for (const e of rest) {
      s.world.apply(e)
      s.model.syncFromWorld()
    }
    expect(s.model.lastNpcTransactionMessage).toEqual({ tblKey: 'TransactionResults10', text: requireTbl('TransactionResults10', 'CHI') })
    // Gold comes only from stat 14 (2 gold after the two sells).
    expect(s.hud.inventory.gold).toBe(s.world.self.gold)
  })
})

describe('NPC store tbl strings', () => {
  it('every 0x2A message key and store/gold-dialog key is packed in both languages', () => {
    const keys = new Set<string>()
    for (let result = 0; result <= 20; result++) {
      const k = npcTransactionMessageKey(result)
      if (k !== null) keys.add(k)
    }
    expect([...keys].sort()).toEqual([
      'TransactionResults10',
      'TransactionResults11',
      'TransactionResults14',
      'TransactionResults4',
      'TransactionResults5',
      'TransactionResults6',
      'TransactionResults8',
      'TransactionResults9',
    ])
    for (const k of [...keys, 'cost', 'Repair', 'Sell', 'ok', 'Back', 'strDropGoldHowMuch', 'strBankGoldDeposit', 'strBankGoldWithdraw']) {
      expect(requireTbl(k, 'ENG').length).toBeGreaterThan(0)
      expect(requireTbl(k, 'CHI').length).toBeGreaterThan(0)
    }
    expect(requireTbl('patchstring#95', 'ENG')).toBe('Repair all equipment: %d')
    expect(requireTbl('patchstring#95', 'CHI')).toBe('修復所有裝備：%d')
    expect(() => requireTbl('notAPackedKey', 'ENG')).toThrow(/not packed/)
  })
})

describe('stash and gold dialog', () => {
  function openStash() {
    const s = createSession()
    for (const e of loadCapture('08-d2gs-stash-gold.d2cap')) s.world.apply(e)
    s.model.syncFromWorld()
    expect(s.hud.leftPanel).toBe('stash')
    s.world.apply({ type: 'StatSet', stat: D2StatId.Gold, value: 5000 })
    s.world.apply({ type: 'StatSet', stat: D2StatId.GoldBank, value: 1200 })
    s.model.syncFromWorld()
    expect(s.hud.inventory.gold).toBe(5000)
    expect(s.hud.worldPanels.stashGold).toBe(1200)
    return s
  }

  it('deposit (mode 3) is pre-filled with the bag gold; typed digits replace it; ok sends 0x4F 0x14', () => {
    const s = openStash()
    s.hud.openGoldDialog(3)
    expect(s.hud.goldDialog).toEqual({ mode: 3, amount: 5000, fresh: true })
    s.hud.typeGoldDialogKey('7')
    s.hud.typeGoldDialogKey('5')
    s.hud.confirmGoldDialog()
    expect(s.commands).toEqual([{ type: 'ClickButton', buttonId: ClickButtonId.DepositGold, amount: 75 }])
    expect(s.hud.inventory.gold).toBe(5000)
    expect(s.hud.worldPanels.stashGold).toBe(1200)
  })

  it('withdraw (mode 4) clamps to the stash balance; 0 sends nothing; drop (mode 0) sends 0x15 DropGold', () => {
    const s = openStash()
    s.hud.openGoldDialog(4)
    s.hud.setGoldDialogAmount(99_999)
    expect(s.hud.goldDialog?.amount).toBe(1200)
    s.hud.confirmGoldDialog()
    s.hud.openGoldDialog(4)
    s.hud.setGoldDialogAmount(0)
    s.hud.confirmGoldDialog()
    s.hud.openGoldDialog(0)
    s.hud.setGoldDialogAmount(10)
    s.hud.confirmGoldDialog()
    expect(s.commands).toEqual([
      { type: 'ClickButton', buttonId: ClickButtonId.WithdrawGold, amount: 1200 },
      { type: 'DropGold', unitId: s.world.selfId, amount: 10 },
    ])
    expect(s.hud.goldDialog).toBeNull()
  })

  it('the stash gold button opens the withdraw dialog; cancel sends nothing; closing the stash sends 0x4F 0x12', () => {
    const s = openStash()
    s.hud.worldPanels.handleLeftDockClick('stash', STASH_X + STASH_GOLD_BTN_HIT.relX0 + 10, STASH_Y + STASH_GOLD_BTN_HIT.relY0 + 5, {
      onClose: () => {},
      onWaypointTeleport: () => {},
      onStashGoldButton: () => s.hud.openGoldDialog(4),
    })
    expect(s.hud.goldDialog?.mode).toBe(4)
    s.hud.cancelGoldDialog()
    expect(s.commands).toEqual([])

    s.hud.closeAllPanels()
    expect(s.commands).toEqual([{ type: 'ClickButton', buttonId: ClickButtonId.CloseStash, amount: 0 }])
    expect(s.world.npcInteraction.stashOpen).toBe(false)
    expect(() => s.hud.openGoldDialog(3)).toThrow(/stash open/)
  })
})

function createMockCanvasContext(): CanvasRenderingContext2D & {
  drawnTexts: string[]
  fillRectCount: number
  strokeRectCount: number
} {
  const drawnTexts: string[] = []
  let fillRectCount = 0
  let strokeRectCount = 0
  return {
    drawnTexts,
    get fillRectCount() {
      return fillRectCount
    },
    get strokeRectCount() {
      return strokeRectCount
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillRect: () => {
      fillRectCount++
    },
    strokeRect: () => {
      strokeRectCount++
    },
    clearRect: () => {},
    fillText: (text: string) => {
      drawnTexts.push(String(text))
    },
    measureText: (text: string) => ({ width: text.length * 8 } as TextMetrics),
    drawImage: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    save: () => {},
    restore: () => {},
  } as unknown as CanvasRenderingContext2D & {
    drawnTexts: string[]
    fillRectCount: number
    strokeRectCount: number
  }
}

describe('M3B: NPC dialogue, travel, mercenary, party, trade, and quest reward panels', () => {
  it('buildNpcMenuOptions produces full 1.13c options for hirelings, travel NPCs, vendors, and quest rewards', () => {
    const kashya = getTownNpcDescriptorByHcIdx(150)!
    expect(buildNpcMenuOptions(kashya, { hasDeadMercenary: false }).map((o) => o.id)).toEqual([
      'talk',
      'hire',
      'cancel',
    ])
    const kashyaDeadMerc = buildNpcMenuOptions(kashya, {
      hasDeadMercenary: true,
      deadMercenaryReviveCost: 1500,
    })
    expect(kashyaDeadMerc.map((o) => o.id)).toEqual(['talk', 'hire', 'resurrect', 'cancel'])
    expect(kashyaDeadMerc.find((o) => o.id === 'resurrect')?.labelEn).toContain('1500')

    const warrivAct1 = getTownNpcDescriptorByHcIdx(155)!
    expect(buildNpcMenuOptions(warrivAct1).map((o) => o.id)).toEqual(['talk', 'travel_east', 'cancel'])

    const warrivAct2 = getTownNpcDescriptorByHcIdx(175)!
    expect(buildNpcMenuOptions(warrivAct2).map((o) => o.id)).toEqual(['talk', 'travel_west', 'cancel'])

    const meshifAct2 = getTownNpcDescriptorByHcIdx(210)!
    expect(buildNpcMenuOptions(meshifAct2).map((o) => o.id)).toEqual(['talk', 'travel_east', 'cancel'])

    const meshifAct3 = getTownNpcDescriptorByHcIdx(264)!
    expect(buildNpcMenuOptions(meshifAct3).map((o) => o.id)).toEqual(['talk', 'travel_west', 'cancel'])

    const tyrael = getTownNpcDescriptorByHcIdx(367)!
    expect(buildNpcMenuOptions(tyrael).map((o) => o.id)).toEqual(['talk', 'travel_harrogath', 'cancel'])

    const charsi = getTownNpcDescriptorByHcIdx(154)!
    expect(buildNpcMenuOptions(charsi).map((o) => o.id)).toEqual([
      'talk',
      'trade_repair',
      'imbue',
      'cancel',
    ])

    const larzuk = getTownNpcDescriptorByHcIdx(511)!
    expect(buildNpcMenuOptions(larzuk).map((o) => o.id)).toEqual([
      'talk',
      'trade_repair',
      'add_sockets',
      'cancel',
    ])

    const anya = getTownNpcDescriptorByHcIdx(512)!
    expect(buildNpcMenuOptions(anya).map((o) => o.id)).toEqual([
      'talk',
      'trade',
      'gamble',
      'personalize',
      'cancel',
    ])

    const cain = getTownNpcDescriptorByHcIdx(244)!
    expect(buildNpcMenuOptions(cain).map((o) => o.id)).toEqual(['talk', 'identify', 'cancel'])
  })

  it('clickNpcMenuOption dispatches talk, hire, resurrect_merc, travel_east, and quest reward options; setLanguage toggles speech', () => {
    const wp = new WorldPanelsHud()
    const questMessages: Array<{ npcUnitId: number; messageIndex: number }> = []
    const entityActions: Array<{ actionType: number; npcId: number; param: number | undefined }> = []
    const resurrectedNpcs: number[] = []
    const confirmedRewards: number[] = []

    wp.onQuestMessage = (npcUnitId, messageIndex) => questMessages.push({ npcUnitId, messageIndex })
    wp.onNpcEntityAction = (actionType, npcId, param) => entityActions.push({ actionType, npcId, param })
    wp.onResurrectMerc = (npcId) => resurrectedNpcs.push(npcId)
    wp.onConfirmQuestReward = (itemId) => confirmedRewards.push(itemId)

    // 1. Talk + language toggle ('zh' <-> 'en')
    const warriv = getTownNpcDescriptorByHcIdx(155)!
    wp.setLanguage('zh')
    wp.openNpcMenu(101, warriv)
    expect(wp.clickNpcMenuOption('talk')).toBe(true)
    expect(questMessages).toEqual([{ npcUnitId: 101, messageIndex: 0 }])
    const zhLines = wp.npcSpeech?.lines
    expect(zhLines?.length).toBeGreaterThan(0)

    wp.setLanguage('en')
    expect(wp.language).toBe('en')
    // `lines` carries the leading blank auto-scroll lead-in; the body must match the greetings
    expect(wp.npcSpeech?.lines.slice(NPC_SPEECH_LEADING_BLANK_LINES)).toEqual(warriv.greetingLines)

    wp.setLanguage('zh')
    expect(wp.language).toBe('zh')
    expect(wp.npcSpeech?.lines).toEqual(zhLines)

    // 2. Travel to Act II via Warriv
    wp.openNpcMenu(101, warriv)
    expect(wp.clickNpcMenuOption('travel_east')).toBe(true)
    expect(entityActions.at(-1)).toEqual({ actionType: 0, npcId: 101, param: 40 })
    expect(wp.npcMenu).toBeNull()

    // 3. Hire and Resurrect Mercenary via Kashya
    const kashya = getTownNpcDescriptorByHcIdx(150)!
    wp.openNpcMenu(202, kashya, { hasDeadMercenary: true, deadMercenaryReviveCost: 900 })
    expect(wp.clickNpcMenuOption('hire')).toBe(true)
    expect(wp.activePanel).toBe('hire')
    expect(entityActions.at(-1)).toEqual({ actionType: 3, npcId: 202, param: 0 })

    wp.openNpcMenu(202, kashya, { hasDeadMercenary: true, deadMercenaryReviveCost: 900 })
    expect(wp.clickNpcMenuOption('resurrect_merc')).toBe(true)
    expect(resurrectedNpcs).toEqual([202])

    // 4. Quest reward panels ('imbue', 'add_sockets', 'personalize') + confirmQuestReward
    const charsi = getTownNpcDescriptorByHcIdx(154)!
    wp.openNpcMenu(303, charsi)
    expect(wp.clickNpcMenuOption('imbue')).toBe(true)
    expect(wp.activePanel).toBe('imbue')
    wp.questRewardItem = { id: '77', code: 'cap', name: 'Cap', kind: 'armor', allowedSlots: ['head'] } as any
    expect(wp.confirmQuestReward('imbue', 77)).toBe(true)
    expect(confirmedRewards).toEqual([77])
    expect(wp.questRewardItem).toBeNull()
    expect(wp.activePanel).toBe('none')
  })

  it('renderActiveLeftPanel and render draw merc, hire, party, trade, and quest reward panels without throwing', () => {
    const wp = new WorldPanelsHud()
    wp.setLanguage('en')

    // 1. Mercenary paperdoll & stats panel ('merc')
    wp.merc = {
      unitId: 501,
      hcIdx: 271,
      name: 'amplisa',
      level: 12,
      experience: 14500,
      life: 180,
      maxLife: 200,
      strength: 52,
      dexterity: 68,
      minDamage: 14,
      maxDamage: 32,
      defense: 95,
      fireResist: 35,
      coldResist: 35,
      lightResist: 35,
      poisonResist: 35,
      alive: true,
      reviveCost: 0,
      headItem: { itemId: 1, code: 'cap', name: 'Tarnhelm' },
      bodyItem: { itemId: 2, code: 'qui', name: 'Stealth Quilted Armor' },
      weaponItem: { itemId: 3, code: 'sbw', name: 'Zephyr Short Bow' },
      shieldItem: null,
    }
    wp.activePanel = 'merc'
    const mercCtx = createMockCanvasContext()
    wp.renderActiveLeftPanel(mercCtx, 'merc', undefined, {
      mercBgImg: { width: 320, height: 432 } as any,
    })
    expect(mercCtx.drawnTexts.some((t) => t.includes('amplisa'))).toBe(true)
    expect(mercCtx.drawnTexts.some((t) => t.includes('180 / 200'))).toBe(true)
    expect(mercCtx.drawnTexts.some((t) => t.includes('14-32'))).toBe(true)
    expect(mercCtx.drawnTexts.some((t) => t.includes(requireTbl('strchrexp', 'ENG')))).toBe(true)

    // 2. Mercenary hire list panel ('hire')
    wp.mercHireList = [
      {
        mercId: 1,
        nameId: 10,
        name: 'Aliza',
        hcIdx: 271,
        level: 8,
        cost: 1050,
        life: 140,
        strength: 44,
        dexterity: 55,
        damageMin: 8,
        damageMax: 18,
        defense: 60,
        fireResist: 20,
        coldResist: 20,
        lightResist: 20,
        poisonResist: 20,
      },
    ]
    wp.activePanel = 'hire'
    const hireCtx = createMockCanvasContext()
    const hireFontTexts: string[] = []
    const hireMockFont = {
      isLoaded: () => true,
      hasFont: (name: string) => name === 'font16' || name === 'fontformal12',
      drawText: (_ctx: unknown, text: string) => {
        hireFontTexts.push(text)
      },
      measureText: (text: string) => text.length * 8,
    } as any
    wp.renderActiveLeftPanel(hireCtx, 'hire', hireMockFont)
    expect(hireCtx.fillRectCount).toBeGreaterThan(0)
    expect(hireCtx.drawnTexts).toHaveLength(0)
    expect(hireFontTexts.some((t) => t.includes('Aliza'))).toBe(true)
    expect(hireFontTexts.some((t) => t.includes('Cost: 1050'))).toBe(true)
    expect(hireFontTexts.some((t) => t.includes('1050 Gold'))).toBe(false)

    // 3. Party screen panel ('party')
    wp.partyMembers = [
      {
        unitId: 2,
        name: 'SorceressTwo',
        charClass: 1,
        level: 24,
        partyId: 1,
        areaId: 1,
        lifePct: 100,
        x: 5100,
        y: 5050,
        relationship: 'in_party',
        hostile: false,
        lootPermitted: true,
      },
    ]
    wp.activePanel = 'party'
    const partyCtx = createMockCanvasContext()
    wp.renderActiveLeftPanel(partyCtx)
    expect(partyCtx.fillRectCount).toBeGreaterThan(0)
    expect(partyCtx.drawnTexts.some((t) => t.includes('SorceressTwo'))).toBe(true)

    // 4. Player trade panel ('trade') — 1.13c trade.dc6 panel with D2FontRenderer text & item sprites (#880)
    wp.trade = {
      isOpen: true,
      active: true,
      partnerUnitId: 2,
      partnerName: 'PaladinTrader',
      myGold: 2500,
      partnerGold: 5000,
      myAccepted: true,
      partnerAccepted: false,
      acceptDisabledTicks: 0,
      myItems: [{ itemId: 11, code: 'rin', name: 'Stone of Jordan', gridX: 0, gridY: 0, width: 1, height: 1 }],
      partnerItems: [{ itemId: 12, code: 'amu', name: 'Mara Kaleidoscope', gridX: 1, gridY: 0, width: 1, height: 1 }],
    }
    wp.activePanel = 'trade'
    const tradeCtx = createMockCanvasContext()
    const tradeFontTexts: string[] = []
    const tradeFont = {
      loaded: true,
      drawText: (_c: unknown, t: string) => tradeFontTexts.push(t),
      measureText: (t: string) => t.length * 6,
      getFontMeta: () => ({ lineHeight: 16 }),
    } as any
    wp.renderActiveLeftPanel(tradeCtx, undefined, tradeFont)
    expect(tradeCtx.fillRectCount).toBeGreaterThan(0)
    expect(tradeFontTexts.some((t) => t.includes('PaladinTrader'))).toBe(true)
    expect(tradeFontTexts.some((t) => t.includes('2500'))).toBe(true)
    expect(tradeFontTexts.some((t) => t.includes('5000'))).toBe(true)

    // 5. Quest reward panels ('imbue', 'add_sockets', 'personalize') + unified render & snapshot
    wp.questRewardItem = { id: '88', code: 'ci3', name: 'Diadem' } as any
    // D2Client useitem.cpp (Issue #912): inset + buttons + font16 instruction text only, no item-name text.
    for (const rewardPanel of ['imbue', 'add_sockets', 'personalize'] as const) {
      wp.activePanel = rewardPanel
      const qCtx = createMockCanvasContext()
      const qFontTexts: string[] = []
      const qFont = {
        loaded: true,
        drawText: (_c: unknown, t: string) => qFontTexts.push(t),
        measureText: (t: string) => t.length * 6,
        getFontMeta: () => ({ lineHeight: 16 }),
      } as any
      wp.render(qCtx, qFont)
      expect(qFontTexts.length).toBeGreaterThan(0)
      expect(qFontTexts.some((t) => t.includes('Diadem'))).toBe(false)
      expect(qCtx.drawnTexts.some((t) => t.includes('Diadem'))).toBe(false)
      expect(wp.snapshot.activePanel).toBe(rewardPanel)
    }
  })

  it('preserves sellCost, repairCost, and buyCost on hoveredItem across repeated syncFromWorld ticks while vendor panel is open', () => {
    const s = openCharsiStore('05-d2gs-vendor-open.d2cap')
    s.hud.worldPanels.setLanguage('en')

    // 1. Hover over a player inventory item on the right panel
    const invPl = s.hud.inventory.gridItems[0]!
    const invHoverX = 419 + invPl.col * 29 + 5
    const invHoverY = 315 + invPl.row * 29 + 5
    s.hud.handleMouseMove(invHoverX, invHoverY)
    const expectedSellCost = 1000 * 2 + Number(invPl.item.id)
    expect(s.hud.inventory.hoveredItem?.item.sellCost).toBe(expectedSellCost)

    // Simulate 25Hz logic ticks calling syncFromWorld while mouse is stationary
    s.model.syncFromWorld()
    s.model.syncFromWorld()
    expect(s.hud.inventory.hoveredItem?.item.sellCost).toBe(expectedSellCost)

    const tooltipTexts: string[] = []
    const mockFont = {
      isLoaded: () => true,
      hasFont: () => true,
      drawText: (_ctx: unknown, text: string) => {
        tooltipTexts.push(text)
      },
      measureText: (text: string) => text.length * 8,
    } as any
    s.hud.worldPanels.drawItemTooltip(
      createMockCanvasContext(),
      s.hud.inventory.hoveredItem,
      mockFont,
      s.hud.leftPanel === 'vendor',
    )
    expect(tooltipTexts.some((t) => t.includes(String(expectedSellCost)))).toBe(true)

    // 2. Hover over a vendor shop item on the left panel
    const shopPl = s.hud.worldPanels.getActiveVendorPlacements()[0]!
    const shopHoverX = VENDOR_GRID_ORIGIN.x + shopPl.col * VENDOR_GRID_ORIGIN.cellPx + 5
    const shopHoverY = VENDOR_GRID_ORIGIN.y + shopPl.row * VENDOR_GRID_ORIGIN.cellPx + 5
    s.hud.handleMouseMove(shopHoverX, shopHoverY)
    const expectedBuyCost = 1000 * 1 + Number(shopPl.item.id)
    expect(s.hud.inventory.hoveredItem?.item.buyCost).toBe(expectedBuyCost)

    s.model.syncFromWorld()
    s.model.syncFromWorld()
    expect(s.hud.inventory.hoveredItem?.item.buyCost).toBe(expectedBuyCost)

    tooltipTexts.length = 0
    s.hud.worldPanels.drawItemTooltip(
      createMockCanvasContext(),
      s.hud.inventory.hoveredItem,
      mockFont,
      s.hud.leftPanel === 'vendor',
    )
    expect(tooltipTexts.some((t) => t.includes(String(expectedBuyCost)))).toBe(true)
  })
})

describe('NPC quest chain & overhead npcalert indicator (1.13c parity)', () => {
  it('decodes authentic 1.13c S2C 0x27 NPCInfo 4-byte message slots (nMenu at +0, wStringId at +2)', () => {
    // Capture 06 Akara (unitId=5) packet: slot0=(menu=0, stringId=64), slot1=(menu=0, stringId=62), slot2..7=(menu=3, stringId=0)
    const hex =
      '27010500000001000000400000003e00030000000300000003000000030000000300000003000000'
    const pkt = Uint8Array.from(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
    const decoded = decode0x27NpcInfo(pkt)
    expect(decoded.type).toBe('Npc')
    if (decoded.type === 'Npc' && decoded.kind === 'info') {
      expect(decoded.npcId).toBe(AKARA_ID)
      expect(decoded.messages).toEqual([
        { menu: 0, stringId: 64, msgId: 64, menuIndex: 0 },
        { menu: 0, stringId: 62, msgId: 62, menuIndex: 0 },
      ])
    }
    expect(resolveNpcMsgIdTblKey(64)).toBe('A1Q1InitAkara')
    expect(resolveQuestTitleKeyForMsgId(64)).toBe('qstsa1q1')
    expect(resolveNpcMsgIdTblKey(76)).toBe('A1Q1SuccessfulAkara')
    expect(resolveQuestTitleKeyForMsgId(76)).toBe('qstsa1q1')
  })

  it('isolates per-NPC 0x27 message tables and completes Act 1 Quest 1 (Den of Evil) offer, in-progress Talk submenu, and turn-in with Akara', () => {
    const s = createSession()
    for (const e of loadCapture('06-d2gs-vendor-buy-sell.d2cap')) {
      s.world.apply(e)
    }
    // D2Common.#10485 (0x6fd8d380) slices S2C 0x27 to pkt[6] (count=2 in capture 06: 64=A1Q1InitAkara, 11=AkaraIntroGossip1).
    expect(s.world.getNpcMessages(AKARA_ID)).toEqual([
      { menu: 0, stringId: 64, msgId: 64, menuIndex: 0 },
      { menu: 0, stringId: 11, msgId: 11, menuIndex: 0 },
    ])

    // Simulate a second town NPC (Charsi #6) broadcasting S2C 0x27; Akara (#5) message table must remain intact,
    // and S2C 0x27 alone does not set wantsInteract (only S2C 0x8A sets wantsInteract).
    ;(s.world as any).ensureUnit('monster', CHARSI_ID)
    s.world.apply({
      type: 'Npc',
      kind: 'info',
      unitType: MONSTER,
      npcId: CHARSI_ID,
      unitId: CHARSI_ID,
      count: 1,
      messages: [{ menu: 0, stringId: 67 }],
      allMessages: [{ menu: 0, stringId: 67 }],
      raw: new Uint8Array(34),
    })
    expect(s.world.getUnit('monster', CHARSI_ID)?.wantsInteract).toBeFalsy()
    expect(s.world.getNpcMessages(CHARSI_ID)?.some((m) => m.stringId === 67)).toBe(true)
    expect(s.world.getNpcMessages(AKARA_ID)?.some((m) => m.stringId === 64)).toBe(true)

    const tblLang = s.hud.worldPanels.language === 'zh' ? 'CHI' : 'ENG'

    // 1. Stage 0 (Offer, D2Game 0x6fd28410): menu=0, stringId=64 (A1Q1InitAkara).
    // Interacting with Akara (NpcInit) auto-pops her offer speech and dispatches C2S 0x31(5, 64) + 0x40 (D2Client 0x6fafba20).
    s.commands.length = 0
    s.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: MONSTER, id: AKARA_ID } })
    s.model.syncFromWorld()
    expect(s.hud.worldPanels.npcMenu?.npcId).toBe(AKARA_ID)
    expect(s.hud.worldPanels.npcMenu?.talking).toBe(true)
    // The first-visit greeting (menu=0, stringId=11 AkaraIntroGossip1) auto-pops first and is
    // acknowledged with C2S 0x31 (which is what stops D2GS re-asserting S2C 0x8A).
    expect(s.commands).toEqual([{ type: 'QuestMessage', npcId: AKARA_ID, messageId: 11 }])
    const expectedIntroLine =
      resolveNpcDialogueTblText(148, { topic: 'quest', lang: tblLang, questStringId: 11 })
        ?.split('\n')[0]!
        .trim() ?? ''
    expect(expectedIntroLine.length).toBeGreaterThan(0)
    expect(s.hud.worldPanels.npcSpeech?.lines.join('\n')).toContain(expectedIntroLine)

    // Dismissing the greeting chains into the quest offer speech (menu=0, stringId=64)
    // with C2S 0x31 + 0x40 (D2Client 0x6fafba20 -> 0x6faf5ff0 / 0x6fafb230).
    s.commands.length = 0
    s.hud.worldPanels.closeNpcSpeech()
    expect(s.commands).toEqual([
      { type: 'QuestMessage', npcId: AKARA_ID, messageId: 64 },
      { type: 'RequestQuestData' },
    ])
    const expectedInitLine =
      resolveNpcDialogueTblText(148, { topic: 'quest', lang: tblLang, questStringId: 64 })
        ?.split('\n')[0]!
        .trim() ?? ''
    expect(expectedInitLine.length).toBeGreaterThan(0)
    expect(s.hud.worldPanels.npcSpeech?.lines.join('\n')).toContain(expectedInitLine)

    // Dismissing the quest speech reveals the main stone menu (Talk / Trade / Cancel);
    // clicking Talk opens the Talk submenu without spamming C2S 0x31 (D2Client 0x6faf9dc0).
    s.hud.worldPanels.closeNpcSpeech()
    expect(s.hud.worldPanels.npcMenu?.talking).toBe(false)
    s.commands.length = 0
    clickNpcOption(s.hud, 'talk')
    expect(s.commands).toEqual([])
    expect(s.hud.worldPanels.npcMenu?.options?.map((o) => o.id)).toEqual([
      'talk_intro',
      'talk_gossip',
      'talk_quest:64',
      'cancel',
    ])
    clickNpcOption(s.hud, 'talk_quest:64')
    expect(s.commands).toEqual([
      { type: 'QuestMessage', npcId: AKARA_ID, messageId: 64 },
      { type: 'RequestQuestData' },
    ])

    // 2. Stage 1 / Stage 2 (In Progress, D2Game 0x6fd284d4 / 0x6fd28598): menu=2, stringId=65 (A1Q1AfterInitAkara).
    // Interacting with Akara does NOT auto-pop speech; the topic lives under Talk -> Den of Evil (talk_quest:65).
    s.hud.closeAllPanels()
    s.commands.length = 0
    s.world.apply({
      type: 'Npc',
      kind: 'info',
      unitType: MONSTER,
      npcId: AKARA_ID,
      unitId: AKARA_ID,
      count: 1,
      messages: [{ menu: 2, stringId: 65 }],
      allMessages: [{ menu: 2, stringId: 65 }],
      raw: new Uint8Array(34),
    })
    s.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: MONSTER, id: AKARA_ID } })
    s.model.syncFromWorld()
    expect(s.commands).toEqual([])
    expect(s.hud.worldPanels.npcMenu?.talking).toBe(false)
    clickNpcOption(s.hud, 'talk')
    expect(s.commands).toEqual([])
    expect(s.hud.worldPanels.npcMenu?.options?.some((o) => o.id === 'talk_quest:65')).toBe(true)
    clickNpcOption(s.hud, 'talk_quest:65')
    expect(s.commands).toEqual([
      { type: 'QuestMessage', npcId: AKARA_ID, messageId: 65 },
      { type: 'RequestQuestData' },
    ])

    // 3. Stage 3 (Den Cleared / Turn-In, D2Game 0x6fd28680): D2GS sends S2C 0x27 with menu=0, stringId=76 (A1Q1SuccessfulAkara).
    // Interacting with Akara auto-triggers C2S 0x31 QuestMessage(5, 76) + 0x40 RequestQuestData and opens her reward speech.
    s.hud.closeAllPanels()
    s.commands.length = 0
    s.world.apply({
      type: 'Npc',
      kind: 'info',
      unitType: MONSTER,
      npcId: AKARA_ID,
      unitId: AKARA_ID,
      count: 1,
      messages: [{ menu: 0, stringId: 76 }],
      allMessages: [{ menu: 0, stringId: 76 }],
      raw: new Uint8Array(34),
    })
    s.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: MONSTER, id: AKARA_ID } })
    s.model.syncFromWorld()
    expect(s.commands).toEqual([
      { type: 'QuestMessage', npcId: AKARA_ID, messageId: 76 },
      { type: 'RequestQuestData' },
    ])
    expect(s.hud.worldPanels.npcSpeech?.npcId).toBe(AKARA_ID)
    const expectedSuccessLine =
      resolveNpcDialogueTblText(148, { topic: 'quest', lang: tblLang, questStringId: 76 })
        ?.split('\n')[0]!
        .trim() ?? ''
    expect(expectedSuccessLine.length).toBeGreaterThan(0)
    expect(s.hud.worldPanels.npcSpeech?.lines.join('\n')).toContain(expectedSuccessLine)
  })

  it('attaches authentic 1.13c npcalert (overlayId 72, NPCSpeechBalloon.dcc) when NPC has quest and clears on interact', () => {
    expect(OVERLAY_METAS['npcalert']).toBeDefined()
    expect(OVERLAY_METAS['npcalert']!.celFile).toBe('NPCSpeechBalloon')
    expect(OVERLAY_METAS['npcalert']!.frames).toBe(16)

    const s = createSession()
    // If S2C 0x8A arrives before 0xAC UnitAssign, pending set preserves it until UnitAssign arrives
    s.world.apply({
      type: 'Npc',
      kind: 'wantsInteract',
      unitType: MONSTER,
      npcId: AKARA_ID,
      unitId: AKARA_ID,
    })
    for (const e of loadCapture('06-d2gs-vendor-buy-sell.d2cap')) {
      s.world.apply(e)
    }
    const akaraUnit = s.world.getUnit('monster', AKARA_ID)!
    expect(akaraUnit.wantsInteract).toBe(true)

    const drawablesBefore = buildSceneDrawables(
      [
        {
          id: akaraUnit.id,
          kind: 'monster',
          classId: akaraUnit.classId,
          x: akaraUnit.x,
          y: akaraUnit.y,
          mode: akaraUnit.mode,
          direction: akaraUnit.direction,
          hpRatio: 1,
          isCorpse: false,
          isHovered: false,
          isNpc: true,
          wantsInteract: akaraUnit.wantsInteract,
        },
      ],
      { tick: 5 },
    )
    const alertOv = drawablesBefore.overlayDrawables.find((o) => o.ownerUnitId === AKARA_ID)
    expect(alertOv).toBeDefined()
    expect(alertOv?.overlayId).toBe(72)
    expect(alertOv?.token).toBe('npcalert')
    expect(alertOv?.totalFrames).toBe(16)
    expect(alertOv?.frame).toBe(5)
    expect(alertOv?.blendMode).toBe('additive')

    // Interacting with Akara clears wantsInteract, and periodic 0x8A while interacting is ignored (D2Client 0x6faf7970)
    s.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: MONSTER, id: AKARA_ID } })
    expect(akaraUnit.wantsInteract).toBe(false)
    s.world.apply({
      type: 'Npc',
      kind: 'wantsInteract',
      unitType: MONSTER,
      npcId: AKARA_ID,
      unitId: AKARA_ID,
    })
    expect(akaraUnit.wantsInteract).toBe(false)
  })

  it('auto-greets an S2C 0x8A "!" NPC without 0x27 slots (Warriv on a fresh character) and acknowledges it with C2S 0x31', () => {
    // Verified against a live 1.13c PvPGN+D2GS server: a brand-new character spawns with
    // 0x8A on Warriv only, clicking him (0x13 + 0x2F) yields NO S2C 0x27 message slots, the
    // server keeps re-asserting 0x8A after 0x30, and only C2S 0x31 QuestMessage(npcId, 1)
    // (WarrivAct1IntroPalGossip1, normalized from WarrivAct1IntroGossip1) stops the stream.
    expect(resolveNpcIntroMsgIdByTblKey('WarrivAct1IntroGossip1')).toBe(1)
    expect(resolveNpcIntroMsgIdByTblKey('AkaraIntroGossip1')).toBe(11)
    expect(resolveNpcIntroMsgIdByTblKey('CharsiIntroGossip1')).toBe(36)
    expect(resolveNpcIntroMsgIdByTblKey('KashyaIntroGossip1')).toBe(24)

    const s = createSession()
    const warriv = (s.world as any).ensureUnit('monster', 7) as {
      classId: number
      wantsInteract?: boolean
      x: number
      y: number
    }
    warriv.classId = 155
    warriv.x = 5000
    warriv.y = 5000
    s.world.self.x = 4996
    s.world.self.y = 4996
    s.world.apply({
      type: 'Npc',
      kind: 'wantsInteract',
      unitType: MONSTER,
      npcId: 7,
      unitId: 7,
    })
    expect(warriv.wantsInteract).toBe(true)

    s.commands.length = 0
    s.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: MONSTER, id: 7 } })
    s.model.syncFromWorld()

    // The overhead "!" is cleared locally and the greeting speech auto-pops over the menu.
    expect(warriv.wantsInteract).toBe(false)
    expect(s.hud.worldPanels.npcMenu?.npcId).toBe(7)
    expect(s.hud.worldPanels.npcMenu?.talking).toBe(true)
    expect(s.hud.worldPanels.npcSpeech?.topic).toBe('intro')
    expect(s.hud.worldPanels.npcSpeech?.stringId).toBe(1)
    expect(s.commands).toEqual([{ type: 'QuestMessage', npcId: 7, messageId: 1 }])
    const tblLang = s.hud.worldPanels.language === 'zh' ? 'CHI' : 'ENG'
    const expectedWarrivIntroLine =
      resolveNpcDialogueTblText(155, { topic: 'intro', lang: tblLang })?.split('\n')[0]!.trim() ?? ''
    expect(expectedWarrivIntroLine.length).toBeGreaterThan(0)
    expect(s.hud.worldPanels.npcSpeech?.lines.join('\n')).toContain(expectedWarrivIntroLine)

    // Dismissing the greeting reveals the stone menu; the auto-greet does not repeat
    // (one-shot consume + intro-played flag), and no further C2S is dispatched.
    s.commands.length = 0
    s.hud.worldPanels.closeNpcSpeech()
    s.model.syncFromWorld()
    expect(s.hud.worldPanels.npcSpeech).toBeNull()
    expect(s.hud.worldPanels.npcMenu?.talking).toBe(false)
    expect(s.commands).toEqual([])
  })

  it('recognizes all 1.13c right-click usable quest items (bks, bkd, tr1, tr2, box, ass, xyz, 0sc)', () => {
    for (const code of ['bks', 'bkd', 'tr1', 'tr2', 'box', 'ass', 'xyz', '0sc']) {
      expect(isUsableRightClickItem(code)).toBe(true)
    }
  })

  it('renders Akara quest speech (A1Q2EarlyReturnAkara, stringId=88) from line 0 without top-clipping or orphan wrapping (1.13c 0x6fb2c6f4 / 0x6fb2bb40)', () => {
    // D2Client.dll 0x6fb2c6f4 sets NPC speech box width to 0x145 (325px) with 0x10 (16px) side padding -> 293px textW.
    expect(NPC_SPEECH_BOX_W).toBe(325)
    const textW = NPC_SPEECH_BOX_W - 32
    expect(textW).toBe(293)

    const akaraDesc = getTownNpcDescriptorByHcIdx(148)!
    const earlyReturnZh = resolveNpcDialogueTblText(akaraDesc, {
      topic: 'quest',
      lang: 'CHI',
      questStringId: 88,
    })!
    expect(earlyReturnZh).toContain('如果你無法殺死血鳥，恐怕我們的修道會')

    // Simulate CJK glyph width (15px per fullwidth char in fontformal12)
    const cjkFont = {
      measureText: (str: string) => {
        let w = 0
        for (const ch of str) {
          w += ch.charCodeAt(0) > 0xff ? 15 : 8
        }
        return w
      },
    }
    const wrapped = wrapSpeechText(cjkFont, earlyReturnZh, textW, 'fontformal12')
    // Must cleanly produce the 2 TBL lines without orphan-wrapping "會" or adding a phantom trailing empty line
    expect(wrapped).toEqual(['如果你無法殺死血鳥，恐怕我們的修道會', '就再也不存在了。'])

    // Verify drawNpcMenu renders Line 0 with its baseline offset inside the clip rect and initializes scrollY=0 on frame 0
    const wp = new WorldPanelsHud()
    wp.setLanguage('CHI')
    wp.openNpcMenu(akaraDesc, 400, 300, AKARA_ID)
    wp.openNpcSpeech(akaraDesc, undefined, 'quest', 88)
    expect(wp.npcSpeech?.scrollY).toBe(0)
    expect(wp.npcSpeech?.lastScrollTimeMs).toBeUndefined()
    // Leading blank lines give the 16px/s auto-scroll headroom so line 0 is not clipped off
    // the top edge moments after the speech opens; `text` stays the pure body text.
    expect(wp.npcSpeech?.lines.slice(0, NPC_SPEECH_LEADING_BLANK_LINES)).toEqual(
      new Array<string>(NPC_SPEECH_LEADING_BLANK_LINES).fill(''),
    )
    expect(
      wp.npcSpeech?.lines.slice(NPC_SPEECH_LEADING_BLANK_LINES).join('\n').replace(/\n+$/, ''),
    ).toBe(wrapped.join('\n'))
    expect(wp.npcSpeech?.text).not.toMatch(/^\n/)
    expect(wp.npcSpeech?.maxScrollY).toBe(
      Math.max(0, (wrapped.length + NPC_SPEECH_LEADING_BLANK_LINES) * 16 - (NPC_SPEECH_BOX_H - 60)),
    )

    let clipRect: { x: number; y: number; w: number; h: number } | null = null
    const drawnLines: Array<{ text: string; x: number; y: number }> = []
    const mockCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      rect: (x: number, y: number, w: number, h: number) => {
        clipRect = { x, y, w, h }
      },
      clip: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D
    const mockFont = {
      measureText: cjkFont.measureText,
      drawText: (_ctx: CanvasRenderingContext2D, text: string, x: number, y: number) => {
        drawnLines.push({ text, x, y })
      },
    } as any
    const dummyImg = { complete: true, naturalWidth: 64, width: 64, height: 64 } as HTMLImageElement

    wp.drawNpcMenu(mockCtx, mockFont, { boxPiecesImg: dummyImg }, 800, 600)

    expect(clipRect).not.toBeNull()
    // First line is header ("阿卡拉"); the leading blank lead-in lines draw as empty strings,
    // then the 2 body lines
    const bodyDraws = drawnLines.filter((d) => d.text !== '阿卡拉' && d.text !== '')
    expect(bodyDraws.map((d) => d.text)).toEqual([
      '如果你無法殺死血鳥，恐怕我們的修道會',
      '就再也不存在了。',
    ])
    // Line 0 baseline must be at least 12px below clipRect.y so the 12px glyph ascent is never sliced off by ctx.clip()
    expect(bodyDraws[0]!.y - clipRect!.y).toBeGreaterThanOrEqual(12)
    expect(wp.npcSpeech?.scrollY).toBe(0)
    expect(wp.npcSpeech?.lastScrollTimeMs).toBeTypeOf('number')
  })

  it('localizes Akara and all Act 1-5 NPC gossip, introductions, and quest speech in Chinese mode without English leaks', () => {
    const cjkRe = /[\u4e00-\u9fff]/
    const wp = new WorldPanelsHud()
    wp.setLanguage('CHI')

    // 1. Akara gossip in CHI mode must display Chinese text ("「目盲之眼」修女會曾經有一段長久而聞..."), never English
    const akara = getTownNpcDescriptorByHcIdx(148)!
    wp.openNpcMenu(AKARA_ID, akara)
    expect(wp.clickNpcMenuOption('talk')).toBe(true)
    expect(wp.clickNpcMenuOption('talk_gossip')).toBe(true)
    expect(wp.npcSpeech?.topic).toBe('gossip')
    expect(wp.npcSpeech?.title).toBe('阿卡拉')
    expect(wp.npcSpeech?.text).toContain('「目盲之眼」修女會曾經有一段長久而聞')
    expect(wp.npcSpeech?.text).not.toContain('The Sisterhood of the Sightless Eye')

    // 2. Live language toggle while gossip speech is open switches between ENG and CHI gossip
    wp.setLanguage('ENG')
    expect(wp.npcSpeech?.title).toBe('Akara')
    expect(wp.npcSpeech?.text).toContain('The Sisterhood of the Sightless Eye')
    wp.setLanguage('CHI')
    expect(wp.npcSpeech?.title).toBe('阿卡拉')
    expect(wp.npcSpeech?.text).toContain('「目盲之眼」修女會曾經有一段長久而聞')

    // 3. Every NPC descriptor across Acts 1-5 resolves to CJK name, intro, and gossip in CHI mode
    for (const desc of TOWN_NPC_DESCRIPTORS) {
      const nameChi = getLocalizedNpcName(desc, 'CHI')
      const introChi = getLocalizedNpcGreetings(desc, 'CHI').join('\n')
      const gossipChi = getLocalizedNpcGossip(desc, 'CHI').join('\n')
      const gossipEng = getLocalizedNpcGossip(desc, 'ENG').join('\n')

      expect(cjkRe.test(nameChi), `Expected CJK name for ${desc.npcTxtKey}, got: ${nameChi}`).toBe(true)
      expect(cjkRe.test(introChi), `Expected CJK intro for ${desc.npcTxtKey}, got: ${introChi}`).toBe(true)
      expect(cjkRe.test(gossipChi), `Expected CJK gossip for ${desc.npcTxtKey}, got: ${gossipChi}`).toBe(true)
      // Ensure NPCs whose lowercase key collides with string.tbl monster names (hratli, alkor, ormus, asheara, etc.)
      // never resolve gossip to a 1-word monster name
      expect(gossipEng.trim().length, `Expected full ENG gossip for ${desc.npcTxtKey}, got: ${gossipEng}`).toBeGreaterThan(4)
      expect(gossipChi.trim()).not.toBe(nameChi.trim())

      if (desc.canTalk !== false) {
        wp.setLanguage('CHI')
        wp.openNpcMenu(1, desc)
        expect(wp.clickNpcMenuOption('talk')).toBe(true)
        expect(wp.clickNpcMenuOption('talk_gossip')).toBe(true)
        expect(cjkRe.test(wp.npcSpeech?.text ?? ''), `Speech box gossip for ${desc.npcTxtKey} must be CJK`).toBe(true)
      }
    }

    // 4. All 913 canonical NPC dialogue records (Classic + Expansion 20000..20180) resolve to CJK in CHI mode
    for (const [msgId, tblKey] of Object.entries(CANONICAL_NPC_MSG_ID_TO_TBL_KEY)) {
      const chiText = resolveNpcDialogueTblText(tblKey, { lang: 'CHI' })
      expect(
        Boolean(chiText && cjkRe.test(chiText)),
        `Expected CJK dialogue for msgId=${msgId} (${tblKey}), got: ${chiText}`,
      ).toBe(true)
    }
  })

  it('aligns Act 1 Quests 2-6 and Quest Log speech replay with D2 1.13c ground truth', () => {
    // 1. A1Q2 (Sisters' Burial Grounds): Kashya (hcIdx 150) Hire & Resurrect gating (0x6faf8e83)
    const kashya = getTownNpcDescriptorByHcIdx(150)!
    const qNoQ2 = new Uint16Array(41)
    // Before A1Q2 complete, level < 8, no merc -> no hire
    expect(
      buildNpcMenuOptions(kashya, {
        questFlags: qNoQ2,
        playerLevel: 5,
        hasMerc: false,
        hasDeadMercenary: false,
      }).map((o) => o.id),
    ).not.toContain('hire')
    // At level >= 8 even before A1Q2 complete -> hire available (0x6faf8e83)
    expect(
      buildNpcMenuOptions(kashya, {
        questFlags: qNoQ2,
        playerLevel: 8,
        hasMerc: false,
      }).map((o) => o.id),
    ).toContain('hire')
    // When A1Q2 completed (q[2] & 1) at level < 8 -> hire & resurrect available
    const qWithQ2 = new Uint16Array(41)
    qWithQ2[2] = 0x0001
    const kashyaOptsAfterQ2 = buildNpcMenuOptions(kashya, {
      questFlags: qWithQ2,
      playerLevel: 5,
      hasMerc: false,
      hasDeadMercenary: true,
      deadMercenaryReviveCost: 500,
    }).map((o) => o.id)
    expect(kashyaOptsAfterQ2).toContain('hire')
    expect(kashyaOptsAfterQ2).toContain('resurrect')

    // 2. A1Q3 (The Search for Cain):
    // a) S2C 0x50 type=4 Cairn Stone order decoding (0x6fb56ca0 -> 0x6fb2cf50)
    const s = createSession()
    const { world, hud, model, commands: emitted } = s
    world.questLog.apply50([4, 0, 1, 2, 3, 4])
    expect(world.questLog.cairnStoneOrder).toEqual([0, 1, 2, 3, 4])

    // b) Right-clicking bks / bkd / 0sc / trs (0x6fac8cc0, 0x6fb2f20b -> C2S 0x3E SelectMainItem)
    emitted.length = 0
    const invMap = world.containers.inventory as Map<number, any>
    invMap.set(101, {
      id: 101,
      code: 'bks',
      container: 'inventory',
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      identified: true,
      stats: [],
    })
    invMap.set(102, {
      id: 102,
      code: 'bkd',
      container: 'inventory',
      x: 2,
      y: 0,
      width: 2,
      height: 2,
      identified: true,
      stats: [],
    })
    invMap.set(103, {
      id: 103,
      code: '0sc',
      container: 'inventory',
      x: 4,
      y: 0,
      width: 1,
      height: 1,
      identified: true,
      stats: [],
    })
    invMap.set(104, {
      id: 104,
      code: 'trs',
      container: 'inventory',
      x: 5,
      y: 0,
      width: 1,
      height: 1,
      identified: true,
      stats: [],
    })
    expect(isUsableRightClickItem('trs')).toBe(true)

    // bks opens undeciphered barkscroll without sending any packet
    model.useItem(101)
    expect(hud.leftPanel).toBe('barkscroll')
    expect(hud.worldPanels.barkscrollDeciphered).toBe(false)
    expect(emitted).toHaveLength(0)

    // bkd opens deciphered barkscroll AND sends SelectMainItem (0x3E)
    model.useItem(102)
    expect(hud.leftPanel).toBe('barkscroll')
    expect(hud.worldPanels.barkscrollDeciphered).toBe(true)
    expect(hud.worldPanels.cairnStoneOrder).toEqual([0, 1, 2, 3, 4])
    expect(emitted).toEqual([{ type: 'SelectMainItem', itemId: 102 }])
    expect([...encodeC2sSelectMainItem(102)]).toEqual([0x3e, 102, 0, 0, 0])

    // 0sc and trs send SelectMainItem (0x3E)
    emitted.length = 0
    model.useItem(103)
    model.useItem(104)
    expect(emitted).toEqual([
      { type: 'SelectMainItem', itemId: 103 },
      { type: 'SelectMainItem', itemId: 104 },
    ])

    // c) Deckard Cain (hcIdx 265) 100 gold fee when (q[4] & 3) === 0 (0x6faf8e3a)
    const cain = getTownNpcDescriptorByHcIdx(265)!
    const qCainUnrescued = new Uint16Array(41)
    const cainOptPaid = buildNpcMenuOptions(cain, {
      questFlags: qCainUnrescued,
      unidentifiedItemCount: 2,
      hasUnidentifiedItems: true,
    }).find((o) => o.id === 'identify')!
    expect(cainOptPaid.strIdx).toBe(3384)
    expect(cainOptPaid.labelEn).toContain('100')

    const qCainRescued = new Uint16Array(41)
    qCainRescued[4] = 0x0001
    const cainOptFree = buildNpcMenuOptions(cain, {
      questFlags: qCainRescued,
      unidentifiedItemCount: 2,
      hasUnidentifiedItems: true,
    }).find((o) => o.id === 'identify')!
    expect(cainOptFree.strIdx).toBe(3385)
    expect(cainOptFree.labelEn).not.toContain('100')

    // 3. A1Q4 (The Forgotten Tower): Tower Tome (unitType=2, stringId=127) opens standalone speech & sends QuestMessage(0xffffffff, 127) on close
    emitted.length = 0
    hud.closeAllPanels()
    world.apply({
      type: 'Npc',
      kind: 'info',
      unitType: 2,
      npcId: 777,
      unitId: 777,
      count: 1,
      messages: [{ menu: 0, stringId: 127 }],
      allMessages: [{ menu: 0, stringId: 127 }],
      raw: new Uint8Array(34),
    })
    model.syncFromWorld()
    expect(hud.worldPanels.npcSpeech).not.toBeNull()
    expect(hud.worldPanels.npcSpeech?.stringId).toBe(127)
    expect(hud.worldPanels.npcSpeech?.text.length).toBeGreaterThan(10)
    // Click inside standalone speech box to dismiss and trigger C2S 0x31 QuestMessage(0xffffffff, 127)
    expect(
      hud.worldPanels.handleNpcMenuClick(400, 120, {
        onOpenVendor: () => {},
        onIdentifyAll: () => {},
        onCancel: () => {},
      }),
    ).toBe(true)
    expect(emitted).toContainEqual({
      type: 'QuestMessage',
      npcId: 0xffffffff,
      messageId: 127,
    })

    // 4. A1Q5 (Tools of the Trade): Charsi Imbue checks ONLY q[3], never q[5] (0x6faf8b60)
    const charsi = getTownNpcDescriptorByHcIdx(154)!
    const qWrongSlot5 = new Uint16Array(41)
    qWrongSlot5[5] = 0x0002 // Tower quest slot 5 must NOT unlock Imbue
    expect(
      buildNpcMenuOptions(charsi, { questFlags: qWrongSlot5, playerLevel: 12 }).map((o) => o.id),
    ).not.toContain('imbue')
    const qCorrectSlot3 = new Uint16Array(41)
    qCorrectSlot3[3] = 0x0002 // Tools of the Trade reward pending in q[3]
    expect(
      buildNpcMenuOptions(charsi, { questFlags: qCorrectSlot3, playerLevel: 8 }).map((o) => o.id),
    ).toContain('imbue')

    // 5. Quest Log speech replay button (questlast.dc6, 0x6facd5b0)
    world.quests[1] = 0x0001
    model.syncFromWorld()
    hud.worldPanels.selectedActTab = 1
    hud.worldPanels.selectedQuestIdx = 0
    // Click replay button at [ox + 226..259, oy + 387..423] (ox=80, oy=60 -> 310, 455)
    const action = hud.worldPanels.handleLeftDockClick('quest', 310, 455, {
      onClose: () => {},
      onWaypointTeleport: () => {},
    })
    expect(action).toBe(true)
    expect(hud.worldPanels.npcSpeech).not.toBeNull()
    expect(hud.worldPanels.npcSpeech?.text.length).toBeGreaterThan(10)
  })

  it('Issue #1323: right-clicking non-usable items quick-sells at Vendor and quick-transfers between Inventory, Stash (buffer=4), and Cube (buffer=3)', () => {
    // 1. Vendor Shop open: right-clicking non-usable inventory item sends NpcSell (0x33)
    const sVendor = openCharsiStore('05-d2gs-vendor-open.d2cap')
    sVendor.world.apply({
      type: 'ItemEvent',
      action: 0x04,
      container: 'inventory',
      item: {
        opcode: 0x9c,
        action: 0x04,
        id: 9001,
        code: 'cap',
        category: 1,
        location: 0,
        container: 'inventory',
        gridX: 5,
        gridY: 0,
        width: 2,
        height: 2,
        quality: 2,
        identified: true,
        compact: false,
        ethereal: false,
        socketed: false,
        ear: false,
        starter: false,
        simple: false,
        personalized: false,
        runeword: false,
        broken: false,
        version: 100,
        flags: 0x10,
      } as any,
    })
    sVendor.model.syncFromWorld()
    const capPl = sVendor.hud.inventory.gridItems.find((p) => p.item.id === '9001')!
    expect(capPl).toBeDefined()
    expect(isUsableRightClickItem(capPl.item.code)).toBe(false)

    sVendor.commands.length = 0
    mouseDown(sVendor.hud, 419 + capPl.col * 29 + 5, 315 + capPl.row * 29 + 5, { button: 2 })
    expect(sVendor.commands).toEqual([
      {
        type: 'NpcSell',
        npcId: CHARSI_ID,
        itemId: 9001,
        itemMode: 0,
        cost: 1000 * 2 + 9001,
      },
    ])

    // 2. Stash open: right-clicking non-usable inventory item sends ItemToCursor (0x19) + ItemPlace(0x18, buffer=4)
    sVendor.hud.setLeftPanel('stash')
    sVendor.commands.length = 0
    mouseDown(sVendor.hud, 419 + capPl.col * 29 + 5, 315 + capPl.row * 29 + 5, { button: 2 })
    expect(sVendor.commands).toEqual([
      { type: 'ItemToCursor', itemId: 9001 },
      { type: 'ItemPlace', itemId: 9001, x: 0, y: 0, buffer: 4 },
    ])

    // 3. Stash -> Inventory: right-clicking item in Stash grid transfers it back to Inventory (buffer=0)
    const stashPl = sVendor.hud.worldPanels.stashItems.find((p) => p.item.id === '9001')!
    expect(stashPl).toBeDefined()
    sVendor.commands.length = 0
    mouseDown(sVendor.hud, STASH_X + 73 + stashPl.col * 29 + 5, STASH_Y + 83 + stashPl.row * 29 + 5, { button: 2 })
    const invPlAfterStash = sVendor.hud.inventory.gridItems.find((p) => p.item.id === '9001')!
    expect(invPlAfterStash).toBeDefined()
    expect(sVendor.commands).toEqual([
      { type: 'ItemToCursor', itemId: 9001 },
      { type: 'ItemPlace', itemId: 9001, x: invPlAfterStash.col, y: invPlAfterStash.row, buffer: 0 },
    ])

    // 4. Cube open: right-clicking non-usable inventory item sends ItemToCursor (0x19) + ItemPlace(0x18, buffer=3)
    sVendor.hud.setLeftPanel('cube')
    sVendor.commands.length = 0
    mouseDown(
      sVendor.hud,
      419 + invPlAfterStash.col * 29 + 5,
      315 + invPlAfterStash.row * 29 + 5,
      { button: 2 },
    )
    expect(sVendor.commands).toEqual([
      { type: 'ItemToCursor', itemId: 9001 },
      { type: 'ItemPlace', itemId: 9001, x: 0, y: 0, buffer: 3 },
    ])
  })
})



