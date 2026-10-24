/**
 * Issue #937: 1.13c `D2Client.dll` (`0x6fb4f830`, `0x6fb50250 -> 0x6fb502d4`, `0x6fb50375`) and
 * `D2Game.dll` (`0x6fcecfe0 -> 0x6fce00c0 -> 0x6fce0947`) parity for Charsi Imbue, Larzuk Add Sockets,
 * and Anya Personalize confirmation lifecycle.
 */
import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { decode0x58OpenUi, type ClientCommand, type ItemData } from '../src/netproto/index.ts'

function createArtisanTestHarness() {
  const world = new ClientWorld()
  const hud = new HudManager()
  const commands: ClientCommand[] = []
  const model = new HudModel({
    world,
    hudManager: hud,
    onCommand: (cmd) => {
      commands.push(cmd)
      world.noteOutgoingCommand(cmd)
    },
  })
  world.apply({
    type: 'UnitAssign',
    isSelf: true,
    unit: {
      unitType: 'player',
      id: 1,
      classId: 4, // Barbarian
      name: 'Tester',
      x: 5100,
      y: 5050,
      lifePct: 128,
      mode: 1,
    },
  } as any)
  world.apply({ type: 'StatSet', stat: 12, value: 35, param: 0 } as any)
  return { world, hud, model, commands }
}

function clickHud(hud: HudManager, x: number, y: number, button = 0): void {
  hud.handleHudMouseDown({
    clientX: x,
    clientY: y,
    _logicalX: x,
    _logicalY: y,
    button,
    shiftKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as MouseEvent)
}

function makeItemData(overrides: Partial<ItemData> & { id: number; code: string }): ItemData {
  return {
    itemId: overrides.id,
    opcode: 0x9c,
    action: 0,
    category: 0,
    flags: 0x10,
    rawFlags: 0x10,
    version: 100,
    location: 0,
    container: 'inventory',
    bodyLoc: 0,
    equippedSlot: 0,
    gridX: 0,
    gridY: 0,
    storePage: 1,
    storagePage: 1,
    worldX: 0,
    worldY: 0,
    x: 0,
    y: 0,
    rawCode: `${overrides.code} `,
    compact: false,
    simple: false,
    identified: true,
    socketed: false,
    ethereal: false,
    runeword: false,
    personalized: false,
    isEar: false,
    newItem: false,
    starterItem: false,
    broken: false,
    inSocket: false,
    equipped: false,
    socketedChildCount: 0,
    usedSockets: 0,
    totalSockets: 0,
    quality: 2,
    invWidth: 1,
    invHeight: 1,
    stats: [],
    setBonusStats: [],
    runewordStats: [],
    ...overrides,
  }
}

describe('Issue #937: Larzuk Add Sockets, Charsi Imbue, and Anya Personalize confirm flow (1.13c)', () => {
  it('Larzuk add_sockets confirm sends only C2S 0x38 (no premature 0x30 NpcCancel, no Charsi imbue hijack, no stone menu pop) and completes on S2C 0x58 (uiId=6, unitId=npcId)', () => {
    const { world, hud, model, commands } = createArtisanTestHarness()
    const larzukId = 5110
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: larzukId,
        classId: 511, // Larzuk
        x: 5104,
        y: 5050,
        lifePct: 128,
        mode: 1,
      },
    } as any)

    // Both A1Q3 Imbue (quest[3]) and A5Q1 Siege on Harrogath (quest[35]) rewards are available:
    // confirming Larzuk Add Sockets must NOT trigger client-side Charsi Imbue!
    world.quests[3] = 0x0002
    world.quests[35] = 0x0002

    const monarch: ItemData = makeItemData({
      id: 8001,
      code: 'uit',
      quality: 2, // Normal
      ilvl: 72,
      invWidth: 2,
      invHeight: 3,
      location: 0,
      container: 'inventory',
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
      stats: [{ statId: 31, param: 0, value: 148 }],
    })
    const charm: ItemData = makeItemData({
      id: 8002,
      code: 'cm1',
      quality: 4,
      ilvl: 50,
      invWidth: 1,
      invHeight: 1,
      location: 0,
      container: 'inventory',
      gridX: 5,
      gridY: 0,
      x: 5,
      y: 0,
    })
    world.containers.applyItemEvent(0x00, monarch, 'inventory', 1)
    world.containers.applyItemEvent(0x00, charm, 'inventory', 1)
    model.syncFromWorld()

    // 1. Interact with Larzuk and select 'add_sockets' from NPC menu (0x6fafbe10 -> 0x6fafbd00 -> 0x6fb4ff70)
    world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: larzukId } })
    model.handleNpcMenuAction('add_sockets', larzukId)
    expect(hud.leftPanel).toBe('add_sockets')
    expect(hud.rightPanel).toBe('inv')
    expect(hud.inventory.visible).toBe(true)
    expect(commands.some((c) => c.type === 'NpcCancel')).toBe(false)

    // 2. Pick up Monarch from inventory to cursor (C2S 0x19 ItemToCursor) and server puts it on cursor
    clickHud(hud, 419 + 14, 315 + 14)
    expect(commands).toContainEqual({ type: 'ItemToCursor', itemId: 8001 })
    world.containers.removeItemById(8001)
    world.containers.applyItemEvent(0x02, { ...monarch, location: 4, container: 'cursor' }, 'cursor', 1)
    model.syncFromWorld()
    expect(hud.inventory.cursorItem?.id).toBe('8001')

    // 3. Place Monarch into useitem slot [123..211, 106..220] (0x6fb5038e -> 0x6fb4f950: state 1 -> 2)
    clickHud(hud, 167, 160)
    expect(hud.worldPanels.questRewardItem?.id).toBe('8001')
    expect(hud.inventory.cursorItem).toBeNull()

    // 4. While useitem slot is occupied (state == 2, 0x6fb50375), clicking another item in the inventory
    // grid must NOT emit ItemToCursor (which would desync pCursorItem on the server).
    commands.length = 0
    clickHud(hud, 419 + 5 * 29 + 14, 315 + 14)
    expect(commands).toEqual([])
    expect(hud.worldPanels.questRewardItem?.id).toBe('8001')

    // 5. Click Confirm button 0 [122..154, 224..256] (0x6fb4f830 -> 0x6faf5fb0):
    // must send ONLY C2S 0x38 NpcEntityAction(action=0, npcId=larzukId, complement=8001),
    // must NOT send C2S 0x30 NpcCancel yet, must NOT re-open the NPC stone menu, and must keep inventory open.
    clickHud(hud, 138, 240)
    expect(commands).toEqual([
      {
        type: 'NpcEntityAction',
        action: 0,
        npcId: larzukId,
        complement: 8001,
      },
    ])
    expect(hud.leftPanel).toBe('none')
    expect(hud.rightPanel).toBe('inv')
    expect(hud.inventory.visible).toBe(true)
    expect(hud.worldPanels.npcMenu).toBeNull()
    // Monarch was NOT hijacked by client-side Charsi Imbue (still quality 2, A1Q3 bit still intact)
    expect(world.containers.cursor?.quality).toBe(2)
    expect(world.quests[3]! & 0x0002).toBe(0x0002)

    // 6. Server D2Game.dll 0x6fce05aa..0x6fce0947 adds 4 sockets to Monarch on cursor and sends
    // 7-byte S2C 0x58: [0x58, u32(larzukId), 6, 0]
    world.containers.removeItemById(8001)
    world.containers.applyItemEvent(
      0x02,
      {
        ...monarch,
        location: 4,
        container: 'cursor',
        socketed: true,
        totalSockets: 4,
      },
      'cursor',
      1,
    )
    const raw58 = new Uint8Array(7)
    raw58[0] = 0x58
    new DataView(raw58.buffer).setUint32(1, larzukId, true)
    raw58[5] = 6
    raw58[6] = 0
    const openUiEv = decode0x58OpenUi(raw58)
    expect(openUiEv).toMatchObject({ type: 'OpenUi', unitId: larzukId, uiId: 6 })

    commands.length = 0
    world.apply(openUiEv)

    // D2Client.dll 0x6fb502d4 -> 0x6fb4f9e0 -> 0x6faf8150 -> 0x6faf7b20:
    // closes UI_USEITEM (does NOT re-open 'imbue'!), keeps UI_INVENTORY open with 4-socket Monarch on cursor,
    // and sends C2S 0x30 NpcCancel(larzukId).
    expect(hud.leftPanel).toBe('none')
    expect(hud.rightPanel).toBe('inv')
    expect(hud.inventory.visible).toBe(true)
    expect(hud.worldPanels.npcMenu).toBeNull()
    expect(hud.inventory.cursorItem?.id).toBe('8001')
    expect(hud.inventory.cursorItem?.sockets).toBe(4)
    expect(commands).toEqual([
      {
        type: 'NpcCancel',
        target: { unitType: 1, id: larzukId },
      },
    ])
  })

  it('Charsi imbue and Anya personalize complete on S2C 0x58 (uiId=6 or 7, unitId=npcId) by sending NpcCancel without re-opening artisan panels', () => {
    const { world, hud, model, commands } = createArtisanTestHarness()
    const anyaId = 5120
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: anyaId,
        classId: 512, // Anya
        x: 5106,
        y: 5050,
        lifePct: 128,
        mode: 1,
      },
    } as any)
    world.quests[38] = 0x0002

    const helm: ItemData = makeItemData({
      id: 9001,
      code: 'ci3',
      quality: 7, // Unique (eligible for personalize and sockets, ineligible for imbue)
      ilvl: 85,
      invWidth: 2,
      invHeight: 2,
      location: 4,
      container: 'cursor',
    })
    world.containers.applyItemEvent(0x02, helm, 'cursor', 1)
    model.syncFromWorld()

    world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: anyaId } })
    model.handleNpcMenuAction('personalize', anyaId)
    expect(hud.leftPanel).toBe('personalize')

    // Place Diadem in slot and click Confirm
    clickHud(hud, 167, 160)
    commands.length = 0
    clickHud(hud, 138, 240)
    expect(commands).toEqual([
      {
        type: 'NpcEntityAction',
        action: 0,
        npcId: anyaId,
        complement: 9001,
      },
    ])

    // Server sends S2C 0x58 with unitId = anyaId, uiId = 6 (success)
    commands.length = 0
    world.apply({
      type: 'OpenUi',
      unitId: anyaId,
      unitType: 1,
      uiId: 6,
      extra: 0,
    })
    expect(hud.leftPanel).toBe('none')
    expect(hud.rightPanel).toBe('inv')
    expect(hud.inventory.visible).toBe(true)
    expect(commands).toEqual([
      {
        type: 'NpcCancel',
        target: { unitType: 1, id: anyaId },
      },
    ])
  })

  it('Charsi imbue confirm imbues white/normal items to rare even when itemId matches a town area id (1, 40, 75, 109) or npcInteraction was cleared', () => {
    for (const itemId of [1, 40, 75, 109]) {
      const { world, hud, model, commands } = createArtisanTestHarness()
      const charsiId = 1540
      world.apply({
        type: 'UnitAssign',
        unit: {
          unitType: 'monster',
          id: charsiId,
          classId: 154, // Charsi
          x: 5100,
          y: 5040,
          lifePct: 128,
          mode: 1,
        },
      } as any)

      const diadem: ItemData = makeItemData({
        id: itemId,
        code: 'ci3',
        quality: 2,
        ilvl: 85,
        invWidth: 2,
        invHeight: 2,
        location: 4,
        container: 'cursor',
      })
      world.containers.applyItemEvent(0x02, diadem, 'cursor', 1)
      model.syncFromWorld()

      // Simulate imbue window open where world.npcInteraction was reset to 'none' / null npcId,
      // and _hasQuestInfo is true with q3 === 0:
      ;(world as any)._hasQuestInfo = true
      world.quests[3] = 0
      hud.leftPanel = 'imbue'
      ;(hud.worldPanels as any).activePanel = 'imbue'
      ;(hud.worldPanels as any).questRewardItem = hud.inventory.cursorItem
      hud.inventory.cursorItem = null

      commands.length = 0
      clickHud(hud, 138, 240)

      expect(commands).toEqual([
        {
          type: 'NpcEntityAction',
          action: 0,
          npcId: charsiId,
          complement: itemId,
        },
      ])
      expect(hud.leftPanel).toBe('none')
      expect(hud.rightPanel).toBe('inv')
      expect(hud.inventory.visible).toBe(true)
      expect(world.containers.cursor?.id).toBe(itemId)
      expect(world.containers.cursor?.quality).toBe(6)
      expect((world.containers.cursor?.stats?.length ?? 0) > 0).toBe(true)
      const cursorAfter = hud.inventory.cursorItem as any
      expect(cursorAfter?.id).toBe(String(itemId))
      expect(cursorAfter?.quality).toBe('rare')
    }
  })
})
