import { describe, expect, it } from 'vitest'
import {
  ClickButtonId,
  type ClientCommand,
  type CloseReason,
  type GameListEntry,
  type GameServerAdapter,
  type GameServerStats,
  type ItemData,
  type ServerEvent,
} from '../../src/netproto/index.ts'
import {
  ACT1_ROGUE_ENCAMPMENT_AREA_ID,
  STASH_BANK_OBJECT_CLASS_ID,
  TradeHallController,
  filterTradeRooms,
  suggestNextTradeRoomName,
} from '../../plugins/trade-hall/trade-hall-controller.ts'
import { handleHudMouseDown } from '../../src/client/ui/hud-input-router.ts'
import { createFakeRealm } from '../netproto/fake-realm-servers.ts'

class MockGameServerAdapter implements GameServerAdapter {
  readonly state = 'ingame' as const
  readonly stats: GameServerStats = {
    unknownPackets: 0,
    opaquePackets: 0,
    rttMs: 25,
    bytesIn: 0,
    bytesOut: 0,
    packetsSent: 0,
    packetsReceived: 0,
  }
  readonly sentCommands: ClientCommand[] = []
  private readonly eventListeners = new Set<(ev: ServerEvent) => void>()
  private readonly closeListeners = new Set<(reason: CloseReason) => void>()

  send(cmd: ClientCommand): void {
    this.sentCommands.push(cmd)
  }

  onEvent(cb: (ev: ServerEvent) => void): () => void {
    this.eventListeners.add(cb)
    return () => this.eventListeners.delete(cb)
  }

  onClose(cb: (reason: CloseReason) => void): () => void {
    this.closeListeners.add(cb)
    return () => this.closeListeners.delete(cb)
  }

  emitEvent(ev: ServerEvent): void {
    for (const cb of this.eventListeners) {
      cb(ev)
    }
  }

  leave(): void {}
}

function makeMouseEvent(
  logicalX: number,
  logicalY: number,
  button = 0,
  shiftKey = false,
): MouseEvent {
  return {
    clientX: logicalX,
    clientY: logicalY,
    _logicalX: logicalX,
    _logicalY: logicalY,
    button,
    shiftKey,
    defaultPrevented: false,
    preventDefault() {
      ;(this as { defaultPrevented: boolean }).defaultPrevented = true
    },
    stopPropagation() {},
  } as unknown as MouseEvent
}

function makeItemData(overrides: Partial<ItemData> & { id: number; code: string }): ItemData {
  const { id, code, ...rest } = overrides
  return {
    id,
    itemId: id,
    opcode: rest.opcode ?? 0x9c,
    action: rest.action ?? 0x04,
    category: rest.category ?? 0,
    flags: rest.flags ?? 0x10,
    rawFlags: rest.rawFlags ?? 0x10,
    version: rest.version ?? 100,
    location: rest.location ?? 0,
    container: rest.container ?? 'inventory',
    bodyLoc: rest.bodyLoc ?? 0,
    equippedSlot: rest.equippedSlot ?? 0,
    gridX: rest.gridX ?? rest.x ?? 0,
    gridY: rest.gridY ?? rest.y ?? 0,
    storePage: rest.storePage ?? 0,
    storagePage: rest.storagePage ?? 0,
    worldX: rest.worldX ?? 0,
    worldY: rest.worldY ?? 0,
    x: rest.x ?? 0,
    y: rest.y ?? 0,
    code,
    rawCode: rest.rawCode ?? code,
    compact: false,
    simple: false,
    identified: rest.identified ?? true,
    socketed: rest.socketed ?? false,
    ethereal: rest.ethereal ?? false,
    runeword: rest.runeword ?? false,
    personalized: false,
    isEar: false,
    newItem: false,
    starterItem: false,
    broken: false,
    inSocket: false,
    equipped: false,
    socketedChildCount: 0,
    usedSockets: rest.usedSockets ?? 0,
    totalSockets: rest.totalSockets ?? 0,
    quality: rest.quality ?? 7,
    uniqueItemId: rest.uniqueItemId ?? 245,
    invWidth: rest.invWidth ?? 1,
    invHeight: rest.invHeight ?? 1,
    stats: rest.stats ?? [
      { statId: 127, param: 0, value: 2 }, // +2 to All Skills
      { statId: 80, param: 0, value: 50 }, // +50% Better Chance of Getting Magic Items
    ],
    setBonusStats: [],
    runewordStats: [],
    ...rest,
  }
}

describe('Trade Hall standalone controller & minimal HUD integration', () => {
  it('suggests next trade room name on 0x1F collision and filters trade rooms', () => {
    expect(suggestNextTradeRoomName('trade-01')).toBe('trade-02')
    expect(suggestNextTradeRoomName('shako9')).toBe('shako10')
    expect(suggestNextTradeRoomName('enigma')).toBe('enigma-02')
    expect(suggestNextTradeRoomName('')).toBe('trade-01')

    const rooms: GameListEntry[] = [
      { index: 1, name: 'baal-01', description: 'fast xp', playerCount: 7, status: 0 },
      { index: 2, name: 'o shako n ist', description: 'a1 stash', playerCount: 2, status: 0 },
      { index: 3, name: 'trade-hr', description: '出乔丹收24#', playerCount: 4, status: 0 },
      { index: 4, name: 'empty-room', description: 'trade', playerCount: 0, status: 0 },
    ]
    const filteredAll = filterTradeRooms(rooms, '', false)
    expect(filteredAll.map((r) => r.name)).toEqual(['trade-hr', 'o shako n ist', 'baal-01'])

    const filteredTradeOnly = filterTradeRooms(rooms, '', true)
    expect(filteredTradeOnly.map((r) => r.name)).toEqual(['trade-hr', 'o shako n ist'])

    const filteredSearch = filterTradeRooms(rooms, 'shako', true)
    expect(filteredSearch.map((r) => r.name)).toEqual(['o shako n ist'])
  })

  it('keeps rightPanel = inv when closing Stash/Trade in tradeHallMode and skips non-panel overlays', () => {
    const controller = new TradeHallController()
    const hud = controller.hudManager

    expect(hud.tradeHallMode).toBe(true)
    expect(hud.rightPanel).toBe('inv')
    expect(hud.inventory.visible).toBe(true)

    // Opening and closing Stash on the left dock must preserve rightPanel = 'inv'
    hud.leftPanel = 'stash'
    hud.hideLeftPanelFromWorld('stash')
    expect(hud.leftPanel).toBe('none')
    expect(hud.rightPanel).toBe('inv')
    expect(hud.inventory.visible).toBe(true)

    // setCharacterClass in tradeHallMode must not trigger skill tree / skill icon preloads
    hud.setCharacterClass('sor')
    expect(hud.charSheet.classCode).toBe('sor')
    expect((hud.skillTree as unknown as { skillIcons: Map<string, unknown> }).skillIcons.size).toBe(0)
  })

  it('auto-moves to Act 1 Stash with 正在移动。。。。 banner on room entry and opens Stash + Inventory side-by-side', () => {
    const controller = new TradeHallController()
    const adapter = new MockGameServerAdapter()
    controller.session.attachGameServer(adapter)

    // Enter Act 1 Rogue Encampment with player at (5110, 5050) and Stash (`classId = 267`) at (5124, 5058)
    adapter.emitEvent({
      type: 'GameLogonAck',
      playerUnitId: 1,
      mapSeed: 12345,
      difficulty: 0,
      act: 0,
      areaId: ACT1_ROGUE_ENCAMPMENT_AREA_ID,
    })
    adapter.emitEvent({
      type: 'PlayerAssign',
      unitId: 1,
      charClass: 1,
      charName: 'TradeSorc',
      x: 5110,
      y: 5050,
      areaId: ACT1_ROGUE_ENCAMPMENT_AREA_ID,
    })
    adapter.emitEvent({
      type: 'LoadAct',
      act: 0,
      mapSeed: 12345,
      areaId: ACT1_ROGUE_ENCAMPMENT_AREA_ID,
    })
    adapter.emitEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'object',
        id: 100,
        classId: STASH_BANK_OBJECT_CLASS_ID,
        x: 5124,
        y: 5058,
        mode: 0,
      },
    })

    // Immediately after Stash assignment, controller must enter auto-move state with `正在移动。。。。`
    const movingSnap = controller.getSnapshot(1000)
    expect(movingSnap.movementStatus.active).toBe(true)
    expect(movingSnap.movementStatus.kind).toBe('stash')
    expect(movingSnap.movementStatus.title).toBe('正在移动。。。。')
    expect(controller.hudManager.tradeHallIdleHint?.title).toBe('正在移动。。。。')

    // Step ticks until the local predictor reaches Stash interaction range and dispatches `Interact (0x13)`
    let nowMs = 1040
    for (let i = 0; i < 60; i++) {
      controller.tick(40, nowMs)
      nowMs += 40
    }

    const interactCmd = adapter.sentCommands.find(
      (c) => c.type === 'Interact' && c.target.unitType === 'object' && c.target.id === 100,
    )
    expect(interactCmd).toBeDefined()

    // Server responds with `S2C 0x77 0x10` (Open Stash)
    adapter.emitEvent({
      type: 'Trade',
      action: 0x10,
    })
    controller.tick(40, nowMs + 40)

    const readySnap = controller.getSnapshot(nowMs + 40)
    expect(readySnap.stashOpen).toBe(true)
    expect(readySnap.movementStatus.active).toBe(false)
    expect(controller.hudManager.leftPanel).toBe('stash')
    expect(controller.hudManager.rightPanel).toBe('inv')
    expect(controller.hudManager.inventory.visible).toBe(true)
  })

  it('reproduces Stash -> Inventory -> Trade Grid item transfer and blocks accidental ground drops in tradeHallMode', () => {
    const controller = new TradeHallController()
    const adapter = new MockGameServerAdapter()
    controller.session.attachGameServer(adapter)

    adapter.emitEvent({
      type: 'PlayerAssign',
      unitId: 1,
      charClass: 1,
      charName: 'TradeSorc',
      x: 5124,
      y: 5058,
      areaId: ACT1_ROGUE_ENCAMPMENT_AREA_ID,
    })
    adapter.emitEvent({
      type: 'Trade',
      action: 0x10, // Open Stash
    })

    // 1. Place Harlequin Crest (Shako, 2x2, id=501) inside Stash (`buffer=4`) at (0, 0)
    const shakoInStash = makeItemData({
      id: 501,
      code: 'uap',
      container: 'stash',
      location: 0,
      x: 0,
      y: 0,
      gridX: 0,
      gridY: 0,
      invWidth: 2,
      invHeight: 2,
    })
    adapter.emitEvent({
      type: 'ItemEvent',
      action: 0x04,
      item: shakoInStash,
      container: 'stash',
      x: 0,
      y: 0,
    })
    controller.tick(40, 1000)

    expect(controller.hudManager.worldPanels.stashItems.length).toBe(1)

    // 2. Pick up Shako from Stash to cursor, then place into Inventory (`buffer=0`)
    const shakoOnCursor = makeItemData({
      ...shakoInStash,
      action: 0x02,
      location: 4, // cursor
      container: 'cursor',
    })
    adapter.emitEvent({
      type: 'ItemEvent',
      action: 0x02,
      item: shakoOnCursor,
      container: 'cursor',
    })
    controller.tick(40, 1040)
    expect(controller.hasCursorItem()).toBe(true)

    // Clicking outside panels in tradeHallMode MUST NOT send `ItemDrop (0x17)`!
    adapter.sentCommands.length = 0
    handleHudMouseDown(controller.hudManager, makeMouseEvent(5, 580, 0, false))
    expect(adapter.sentCommands.some((c) => c.type === 'ItemDrop')).toBe(false)

    // Use 1-click safety recovery (`returnCursorItemToSafety`) to put cursor item into Inventory (`buffer=0`)
    const recovered = controller.returnCursorItemToSafety(1080)
    expect(recovered).toBe(true)
    expect(adapter.sentCommands).toContainEqual({
      type: 'ItemPlace',
      itemId: 501,
      x: 0,
      y: 0,
      buffer: 0,
    })

    // Server confirms Shako is now in Inventory (`buffer=0`) at (0, 0)
    const shakoInInv = makeItemData({
      ...shakoInStash,
      action: 0x04,
      location: 0,
      container: 'inventory',
      x: 0,
      y: 0,
      gridX: 0,
      gridY: 0,
    })
    adapter.emitEvent({
      type: 'CursorClear',
      unitType: 'player',
      id: 1,
    })
    adapter.emitEvent({
      type: 'ItemEvent',
      action: 0x04,
      item: shakoInInv,
      container: 'inventory',
      x: 0,
      y: 0,
    })
    controller.tick(40, 1120)
    expect(controller.hudManager.inventory.gridItems.length).toBe(1)

    // 3. Open Player Trade (`S2C 0x78` / `0x77 0x06`) and quick-transfer (`Shift+Left-Click`) Shako from Inventory to Self Trade Grid (`buffer=2`)
    adapter.emitEvent({
      type: 'Trade',
      action: 0x78,
      partnerName: 'PaladinTrader',
    })
    controller.tick(40, 1160)
    expect(controller.hudManager.leftPanel).toBe('trade')
    expect(controller.hudManager.rightPanel).toBe('inv')

    adapter.sentCommands.length = 0
    // Inventory grid starts at x = 400 + 18 = 418, y = 315; click on cell (0, 0) with shiftKey = true
    handleHudMouseDown(controller.hudManager, makeMouseEvent(425, 325, 0, true))
    expect(adapter.sentCommands).toContainEqual({
      type: 'ItemToCursor',
      itemId: 501,
    })
    expect(adapter.sentCommands).toContainEqual({
      type: 'ItemPlace',
      itemId: 501,
      x: 0,
      y: 0,
      buffer: 2,
    })
  })

  it('requests trade with room players: auto-closes Stash, approaches in-town player with 正在移动。。。。, and whispers out-of-town player', () => {
    const controller = new TradeHallController()
    const adapter = new MockGameServerAdapter()
    controller.session.attachGameServer(adapter)

    adapter.emitEvent({
      type: 'PlayerAssign',
      unitId: 1,
      charClass: 1,
      charName: 'TradeSorc',
      x: 5120,
      y: 5055,
      areaId: ACT1_ROGUE_ENCAMPMENT_AREA_ID,
    })
    adapter.emitEvent({
      type: 'LoadAct',
      act: 0,
      mapSeed: 1,
      areaId: ACT1_ROGUE_ENCAMPMENT_AREA_ID,
    })
    adapter.emitEvent({
      type: 'Trade',
      action: 0x10, // Stash open initially
    })
    controller.tick(40, 1000)

    // Spawn an in-town player (#2) and an out-of-town player (#3 in Blood Moor areaId = 2)
    adapter.emitEvent({
      type: 'Party',
      kind: 'roster',
      action: 'join',
      unitId: 2,
      charName: 'TownPaladin',
      charClass: 3,
      charLevel: 90,
      areaId: ACT1_ROGUE_ENCAMPMENT_AREA_ID,
      at: { x: 5123, y: 5056 },
    })
    adapter.emitEvent({
      type: 'Party',
      kind: 'roster',
      action: 'join',
      unitId: 3,
      charName: 'FieldBarb',
      charClass: 4,
      charLevel: 88,
      areaId: 2, // Blood Moor (outside town)
      at: { x: 5400, y: 5200 },
    })
    controller.tick(40, 1040)

    const roster = controller.getRoomPlayers()
    expect(roster.map((p) => p.name)).toEqual(['FieldBarb', 'TownPaladin'])

    // Out-of-town player (#3): sends whisper `/w FieldBarb ...` instead of `0x13`
    adapter.sentCommands.length = 0
    const outTownResult = controller.requestTradeWithPlayer(3, 1080)
    expect(outTownResult).toBe(false)
    expect(
      adapter.sentCommands.some(
        (c) => c.type === 'Chat' && c.whisperTo === 'FieldBarb',
      ),
    ).toBe(true)

    // In-town player (#2): closes open Stash (`ClickButton CloseStash 0x12`), shows `正在移动。。。。`, and sends `Interact`
    adapter.sentCommands.length = 0
    const inTownResult = controller.requestTradeWithPlayer(2, 1120)
    expect(inTownResult).toBe(true)
    expect(controller.getSnapshot(1120).movementStatus.title).toBe('正在移动。。。。')
    expect(
      adapter.sentCommands.some(
        (c) =>
          c.type === 'ClickButton' &&
          (c.buttonId === ClickButtonId.CloseStash || c.button === ClickButtonId.CloseStash),
      ),
    ).toBe(true)
    expect(adapter.sentCommands).toContainEqual({
      type: 'Interact',
      target: { unitType: 'player', id: 2 },
    })
  })

  it('audits partner offer removal (0x77 0x0E anti-scam diff alert), checks 2D capacity, and logs TradeReceipt on 0x77 0x0D', () => {
    const controller = new TradeHallController()
    const adapter = new MockGameServerAdapter()
    controller.session.attachGameServer(adapter)

    adapter.emitEvent({
      type: 'PlayerAssign',
      unitId: 1,
      charClass: 1,
      charName: 'TradeSorc',
      x: 5120,
      y: 5055,
      areaId: ACT1_ROGUE_ENCAMPMENT_AREA_ID,
    })
    // Set self level = 10 (inventory gold limit = 100,000) and self gold = 90,000
    adapter.emitEvent({
      type: 'StatSet',
      stat: 12, // level
      value: 10,
    })
    adapter.emitEvent({
      type: 'StatSet',
      stat: 14, // gold
      value: 90_000,
    })

    // Open Trade (`0x77 0x05`)
    adapter.emitEvent({
      type: 'Trade',
      action: 0x05,
      partnerName: 'ScamTester',
    })

    // Self offers 1 item (id=601)
    const selfItem = makeItemData({
      id: 601,
      code: 'rin',
      container: 'tradeSelf',
      x: 0,
      y: 0,
      gridX: 0,
      gridY: 0,
      invWidth: 1,
      invHeight: 1,
    })
    adapter.emitEvent({
      type: 'ItemEvent',
      action: 0x04,
      item: selfItem,
      container: 'tradeSelf',
      x: 0,
      y: 0,
    })

    // Partner offers 1 item (id=701, Shako) and 25,000 gold (which overflows 90k + 25k > 100k limit)
    const partnerShako = makeItemData({
      id: 701,
      code: 'uap',
      container: 'tradePartner',
      x: 0,
      y: 0,
      gridX: 0,
      gridY: 0,
      invWidth: 2,
      invHeight: 2,
    })
    adapter.emitEvent({
      type: 'ItemEvent',
      action: 0x04,
      item: partnerShako,
      container: 'tradePartner',
      x: 0,
      y: 0,
    })
    ;(controller.session.world.trade as { partnerGold: number }).partnerGold = 25_000
    controller.session.hudModel.syncFromWorld()
    controller.tick(40, 2000)

    // Capacity check must flag the 15,000 gold overflow
    const capOverflow = controller.evaluateTradeCapacity()
    expect(capOverflow.canFitAllItems).toBe(true)
    expect(capOverflow.canFitGold).toBe(false)
    expect(capOverflow.goldOverflowAmount).toBe(15_000)

    // Ensure baseline snapshot is captured before partner removes item
    adapter.emitEvent({
      type: 'Trade',
      action: 0x06, // PartnerCheck
    })

    // Partner lowers gold to 5,000 and removes Shako (id=701), triggering `0x77 0x0E` (DisableAccept)
    ;(controller.session.world.containers.tradePartner as Map<number, ItemData>).delete(701)
    ;(controller.session.world.trade as { partnerGold: number }).partnerGold = 5_000
    controller.session.hudModel.syncFromWorld()
    adapter.emitEvent({
      type: 'Trade',
      action: 0x0e, // DisableAccept (5-second red lockout)
    })

    const alertSnap = controller.getSnapshot(2080)
    expect(alertSnap.acceptDisabled).toBe(true)
    expect(alertSnap.lockoutRemainingMs).toBeGreaterThan(4000)
    expect(alertSnap.tradeDiffAlert).not.toBeNull()
    expect(alertSnap.tradeDiffAlert?.removedItems.length).toBe(1)
    expect(alertSnap.tradeDiffAlert?.previousGold).toBe(25_000)
    expect(alertSnap.tradeDiffAlert?.currentGold).toBe(5_000)

    // Partner puts Shako back and trade completes (`0x77 0x0D`)
    adapter.emitEvent({
      type: 'ItemEvent',
      action: 0x04,
      item: partnerShako,
      container: 'tradePartner',
      x: 0,
      y: 0,
    })
    controller.tick(40, 2120)
    adapter.emitEvent({
      type: 'Trade',
      action: 0x0d, // TradeCompleted
    })

    const doneSnap = controller.getSnapshot(2160)
    expect(doneSnap.tradeReceipts.length).toBe(1)
    const receipt = doneSnap.tradeReceipts[0]!
    expect(receipt.partnerName).toBe('ScamTester')
    expect(receipt.givenItems.length).toBe(1)
    expect(receipt.receivedItems.length).toBe(1)
    expect(receipt.receivedGold).toBe(5_000)
  })

  it('logs in default character via MCP_CHARLOGON before MCP_GAMELIST, switches characters via realm re-entry, and recovers from MCP disconnect', async () => {
    const realm = createFakeRealm({
      characters: 3,
      strictD2csState: true,
    })
    const controller = new TradeHallController({
      resolver: realm.resolver,
      defaultHost: '127.0.0.1',
    })

    // 1. Login + listTradeRooms must succeed against strict PvPGN d2cs without "Target closed"
    const loginRes = await controller.login({
      host: '127.0.0.1',
      username: 'tt1',
      password: 'secret',
    })
    expect(loginRes.characters.length).toBe(3)
    expect(controller.session.phase).toBe('lobby')
    expect(controller.session.selectedChar).toBe('d2webbot_sorc')

    const rooms = await controller.listTradeRooms()
    expect(controller.session.phase).toBe('lobby')
    expect(controller.getSnapshot().notice).toBeNull()
    expect(rooms.map((r) => r.name)).toEqual(['trade-shako'])

    // 2. Switching to a second character in the lobby must cleanly re-enter the realm on MCP
    // and log in the new character without triggering "MCP realm connection closed by server"
    await controller.selectCharacter('d2webbot_sorc1')
    expect(controller.session.phase).toBe('lobby')
    expect(controller.session.selectedChar).toBe('d2webbot_sorc1')
    expect(controller.getSnapshot().notice).toBeNull()

    const roomsAfterSwitch = await controller.listTradeRooms()
    expect(roomsAfterSwitch.map((r) => r.name)).toEqual(['trade-shako'])
    expect(controller.session.phase).toBe('lobby')

    // 3. Simulate an unexpected remote MCP close while idle in lobby; selecting another character
    // or refreshing rooms transparently recovers the lobby session using saved credentials.
    realm.latest('realm').server.close({ kind: 'remote', code: 1000, reason: 'Target closed' })
    expect(controller.session.phase).toBe('disconnected')

    await controller.selectCharacter('d2webbot_sorc2')
    expect(controller.session.phase).toBe('lobby')
    expect(controller.session.selectedChar).toBe('d2webbot_sorc2')
    expect(controller.getSnapshot().notice).toBeNull()
  })
})
