/**
 * tests/issue-904-cube-staff-of-kings.test.ts
 *
 * Regression & 1.13c parity tests for Issue #904 ("国王之杖放不进赫拉迪克方块" /
 * Staff of Kings `msf` cannot be placed into Horadric Cube `box`):
 *
 * 1. S2C `0x77` `0x15` (`UPDATEUI_OPENCUBE` @ `D2Client.dll` `0x6fb0a520[0x15] -> 0x6fb48070`)
 *    opens the Horadric Cube UI instead of misrouting to `add_sockets`, and closing the Cube
 *    sends C2S `0x4F` `0x17` (`TRADEBTN_CLOSECUBE = 23` @ `D2Game.dll` `PlrTrade.cpp:1357`).
 * 2. 1.13c cursor-centered grid placement & footprint overlap (`D2Client.dll` `0x6fb44820` &
 *    `0x6fb46e66..0x6fb47295`) for `1x3` `msf` (Staff of Kings) and `1x4` `hst` (Horadric Staff)
 *    in the `3x4` Horadric Cube and `10x4` Inventory.
 * 3. Indirect Cube placement C2S `0x2A` (`ItemToCube` @ `D2Client.dll` `0x6fb470b3..0x6fb47154` &
 *    `D2Game.dll` `0x6fc866e0`) when dropping a cursor item onto the `box` icon in Inventory/Stash.
 * 4. Quest Amulet `vip` (`Amulet of the Viper`) sprite resolution (`invvip` vs generic `invamu1`).
 * 5. Saved cursor item (`IMODE_ONCURSOR = 4` / `0x9C` `action = 0x12` `ITEMACTION_TOCURSOR`)
 *    restored to `containers.cursor` on login/rejoin (`D2Game.dll` `0x6fc3efa0`).
 */

import { describe, expect, it, vi } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import {
  INV_GRID_ORIGIN,
  computeCursorItemGridPlacement,
  resolveItemSpriteRect,
  type UiInventoryItem,
} from '../src/client/ui/inventory.ts'
import { CUBE_GRID_ORIGIN } from '../src/client/ui/world-panels.ts'
import {
  ClickButtonId,
  encodeC2sItemToCube,
  encodeClientCommand,
  type ClientCommand,
  type ItemData,
} from '../src/netproto/index.ts'
import { resolveItemContainer } from '../src/netproto/d2gs/items/item-types.ts'
import { resolveItemInvFile } from '../src/common/items/item-bridge.ts'

if (typeof globalThis.window === 'undefined') {
  ;(globalThis as unknown as { window: Record<string, unknown> }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

function makeHudMouseEvent(
  logicalX: number,
  logicalY: number,
  button: 0 | 2 = 0,
  shiftKey = false,
): MouseEvent {
  return {
    button,
    shiftKey,
    ctrlKey: false,
    defaultPrevented: false,
    _logicalX: logicalX,
    _logicalY: logicalY,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as MouseEvent
}

function makeUiItem(overrides: Partial<UiInventoryItem> & { id: string; code: string }): UiInventoryItem {
  const w = overrides.invWidth ?? overrides.gridW ?? 1
  const h = overrides.invHeight ?? overrides.gridH ?? 1
  return {
    id: overrides.id,
    code: overrides.code,
    invFile: overrides.invFile ?? `inv${overrides.code}`,
    name: overrides.name ?? overrides.code,
    nameZh: overrides.nameZh ?? overrides.code,
    baseNameZh: overrides.baseNameZh ?? overrides.code,
    quality: overrides.quality ?? 'unique',
    invWidth: w,
    invHeight: h,
    gridW: w,
    gridH: h,
    allowedSlots: overrides.allowedSlots ?? [],
    stats: overrides.stats ?? [],
    identified: overrides.identified ?? true,
  }
}

function makeWorldItem(overrides: Partial<ItemData> & { id: number; code: string }): ItemData {
  const x = overrides.x ?? overrides.gridX ?? 0
  const y = overrides.y ?? overrides.gridY ?? 0
  const storePage = overrides.storePage ?? overrides.storagePage ?? 1
  return {
    id: overrides.id,
    itemId: overrides.itemId ?? overrides.id,
    opcode: overrides.opcode ?? 0x9c,
    action: overrides.action ?? 0x04,
    category: overrides.category ?? 0,
    flags: overrides.flags ?? 0x10,
    rawFlags: overrides.rawFlags ?? overrides.flags ?? 0x10,
    version: overrides.version ?? 101,
    location: overrides.location ?? 0,
    container: overrides.container ?? 'inventory',
    bodyLoc: overrides.bodyLoc ?? 0,
    equippedSlot: overrides.equippedSlot ?? 0,
    gridX: x,
    gridY: y,
    storePage,
    storagePage: storePage,
    worldX: overrides.worldX ?? 0,
    worldY: overrides.worldY ?? 0,
    x,
    y,
    code: overrides.code,
    rawCode: overrides.rawCode ?? overrides.code,
    compact: overrides.compact ?? false,
    simple: overrides.simple ?? false,
    identified: overrides.identified ?? true,
    socketed: overrides.socketed ?? false,
    ethereal: overrides.ethereal ?? false,
    runeword: overrides.runeword ?? false,
    personalized: overrides.personalized ?? false,
    isEar: overrides.isEar ?? false,
    newItem: overrides.newItem ?? false,
    starterItem: overrides.starterItem ?? false,
    broken: overrides.broken ?? false,
    inSocket: overrides.inSocket ?? false,
    equipped: overrides.equipped ?? false,
    socketedChildCount: overrides.socketedChildCount ?? 0,
    usedSockets: overrides.usedSockets ?? 0,
    totalSockets: overrides.totalSockets ?? 0,
    quality: overrides.quality ?? 7,
    ilvl: overrides.ilvl ?? 1,
    invWidth: overrides.invWidth ?? 1,
    invHeight: overrides.invHeight ?? 1,
    stats: overrides.stats ?? [],
    setBonusStats: overrides.setBonusStats ?? [],
    runewordStats: overrides.runewordStats ?? [],
  }
}

describe('Issue #904: Horadric Cube & Staff of Kings 1.13c Parity', () => {
  it('handles S2C 0x77 action 0x15 (UPDATEUI_OPENCUBE) by opening the Cube panel and sends C2S 0x4F 0x17 on close', () => {
    const world = new ClientWorld()
    const hud = new HudManager()
    const emitted: ClientCommand[] = []
    const model = new HudModel({
      world,
      hudManager: hud,
      onCommand: (cmd) => emitted.push(cmd),
    })

    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      charClass: 1,
      name: 'Hero',
      x: 5100,
      y: 5100,
    })

    // S2C 0x77 action 0x15 (UPDATEUI_OPENCUBE = 21) from D2Game SKILLITEM_pSpell07_OpenCube
    world.apply({
      type: 'Trade',
      action: 0x15,
    })

    expect(world.npcInteraction.cubeOpen).toBe(true)
    expect(world.npcInteraction.window).toBe('none')
    expect(hud.leftPanel).toBe('cube')
    expect(hud.rightPanel).toBe('inv')

    // Closing the Cube panel sends C2S 0x4F 0x17 (ClickButtonId.CloseCube)
    hud.toggleLeftPanel('cube')
    expect(hud.leftPanel).toBe('none')
    expect(world.npcInteraction.cubeOpen).toBe(false)
    expect(emitted).toContainEqual({
      type: 'ClickButton',
      buttonId: ClickButtonId.CloseCube,
      amount: 0,
    })
    void model
  })

  it('computes 1.13c cursor-centered grid placement (0x6fb44820) for 1x3 msf and 1x4 hst in 3x4 Cube', () => {
    const cubeOrigin = { x: 0, y: 0, cols: 3, rows: 4, cellPx: 29 }

    // msf (Staff of Kings) is 1x3 (28x84 px).
    // Clicking the visual center of the 3x4 Cube at (col=1, rawRow=2) -> localY = 2*29 + 14 = 72.
    // D2Client 0x6fb44820 centers the 1x3 item so its top-left lands on row 1 (rows 1..3), NOT row 2!
    const msfCenterClick = computeCursorItemGridPlacement(
      14 + 29,
      72,
      cubeOrigin,
      { invWidth: 1, invHeight: 3, code: 'msf' },
      [],
    )
    expect(msfCenterClick.inBounds).toBe(true)
    expect(msfCenterClick.col).toBe(1)
    expect(msfCenterClick.row).toBe(1)
    expect(msfCenterClick.overlaps).toHaveLength(0)

    // Clicking the bottom-most row (rawRow=3, localY = 3*29 + 20 = 107) puts top-left at row 2 (2 + 3 = 5 > 4 -> out of bounds)
    const msfBottomClick = computeCursorItemGridPlacement(
      14 + 29,
      107,
      cubeOrigin,
      { invWidth: 1, invHeight: 3, code: 'msf' },
      [],
    )
    expect(msfBottomClick.inBounds).toBe(false)
    expect(msfBottomClick.row).toBe(2)

    // hst (Horadric Staff) is 1x4 (28x112 px).
    // Per D2Client 0x6fb4486b (`if (itemH == gridH) centerY = gridTop + pxH/2`), clicking ANY row 0..3 snaps row to 0!
    for (let rawRow = 0; rawRow < 4; rawRow++) {
      const hstClick = computeCursorItemGridPlacement(
        14,
        rawRow * 29 + 14,
        cubeOrigin,
        { invWidth: 1, invHeight: 4, code: 'hst' },
        [],
      )
      expect(hstClick.inBounds).toBe(true)
      expect(hstClick.col).toBe(0)
      expect(hstClick.row).toBe(0)
    }
  })

  it('detects 1-item footprint overlap for 0x1F SwapContainerItem and rejects >1 overlaps in Cube', () => {
    const world = new ClientWorld()
    const hud = new HudManager()
    const emitted: ClientCommand[] = []
    new HudModel({
      world,
      hudManager: hud,
      onCommand: (cmd) => emitted.push(cmd),
    })

    // Seed Viper Amulet (1x1) at (col=1, row=2) inside Cube, and Staff of Kings (1x3) on cursor
    const vipItem = makeWorldItem({
      id: 201,
      code: 'vip',
      container: 'cube',
      storePage: 4,
      x: 1,
      y: 2,
      invWidth: 1,
      invHeight: 1,
    })
    const msfItem = makeWorldItem({
      id: 202,
      code: 'msf',
      action: 0x01,
      location: 4,
      container: 'cursor',
      invWidth: 1,
      invHeight: 3,
    })
    world.apply({ type: 'ItemEvent', action: vipItem.action, item: vipItem, container: 'cube' })
    world.apply({ type: 'ItemEvent', action: msfItem.action, item: msfItem, container: 'cursor' })
    world.apply({ type: 'Trade', action: 0x15 })

    // Click at (col=1, rawRow=1) in Cube: cursor-centered top-left is (col=1, row=0), footprint rows 0..2 overlaps vip at (1, 2).
    // Even though cell (1, 1) itself is empty, 1.13c (0x6fb46e66..0x6fb47295) sends 0x1F SwapContainerItem with vip (201)!
    const cubeGridX = CUBE_GRID_ORIGIN.x + 1 * CUBE_GRID_ORIGIN.cellPx + 14
    const cubeGridY = CUBE_GRID_ORIGIN.y + 1 * CUBE_GRID_ORIGIN.cellPx + 14
    hud.handleHudMouseDown(makeHudMouseEvent(cubeGridX, cubeGridY, 0))

    expect(emitted).toContainEqual({
      type: 'SwapContainerItem',
      cursorItemId: 202,
      replacedItemId: 201,
      targetItemId: 201,
      x: 1,
      y: 0,
    })

    // Add a second 1x1 item at (col=1, row=0) so the 1x3 footprint overlaps 2 items -> must reject!
    emitted.length = 0
    const ringItem = makeWorldItem({
      id: 203,
      code: 'rin',
      container: 'cube',
      storePage: 4,
      x: 1,
      y: 0,
      invWidth: 1,
      invHeight: 1,
    })
    world.apply({ type: 'ItemEvent', action: ringItem.action, item: ringItem, container: 'cube' })
    hud.handleHudMouseDown(makeHudMouseEvent(cubeGridX, cubeGridY, 0))
    expect(emitted).toHaveLength(0)
  })

  it('encodes C2S 0x2A ItemToCube (9 bytes) and dispatches it when dropping msf onto box in Inventory or Stash', () => {
    const raw = encodeC2sItemToCube(0x11223344, 0x55667788)
    expect(Array.from(raw)).toEqual([0x2a, 0x44, 0x33, 0x22, 0x11, 0x88, 0x77, 0x66, 0x55])
    const encodedPackets = encodeClientCommand({
      type: 'ItemToCube',
      itemId: 0x11223344,
      cubeId: 0x55667788,
    })
    expect(encodedPackets).toHaveLength(1)
    expect(Array.from(encodedPackets[0]!)).toEqual(Array.from(raw))

    const world = new ClientWorld()
    const hud = new HudManager()
    const emitted: ClientCommand[] = []
    new HudModel({
      world,
      hudManager: hud,
      onCommand: (cmd) => emitted.push(cmd),
    })

    // Place Horadric Cube (box, 2x2) in Inventory at (0, 0), and Staff of Kings (msf, 1x3) on cursor
    const boxItem = makeWorldItem({
      id: 300,
      code: 'box',
      container: 'inventory',
      storePage: 1,
      x: 0,
      y: 0,
      invWidth: 2,
      invHeight: 2,
    })
    const msfItem = makeWorldItem({
      id: 301,
      code: 'msf',
      action: 0x01,
      location: 4,
      container: 'cursor',
      invWidth: 1,
      invHeight: 3,
    })
    world.apply({ type: 'ItemEvent', action: boxItem.action, item: boxItem, container: 'inventory' })
    world.apply({ type: 'ItemEvent', action: msfItem.action, item: msfItem, container: 'cursor' })
    hud.toggleRightPanel('inv')

    // Click on the Horadric Cube icon in Inventory -> should emit ItemToCube (0x2A), NOT SwapContainerItem (0x1F)
    const invBoxClickX = INV_GRID_ORIGIN.x + 14
    const invBoxClickY = INV_GRID_ORIGIN.y + 14
    hud.handleHudMouseDown(makeHudMouseEvent(invBoxClickX, invBoxClickY, 0))

    expect(emitted).toContainEqual({
      type: 'ItemToCube',
      itemId: 301,
      cubeId: 300,
    })
    expect(emitted.some((c) => c.type === 'SwapContainerItem')).toBe(false)

    // Now fill the Cube so a 1x3 item cannot fit (three 1x2 items at row=1 across cols 0, 1, 2)
    emitted.length = 0
    for (let col = 0; col < 3; col++) {
      const filler = makeWorldItem({
        id: 310 + col,
        code: 'cm2',
        container: 'cube',
        storePage: 4,
        x: col,
        y: 1,
        invWidth: 1,
        invHeight: 2,
      })
      world.apply({ type: 'ItemEvent', action: filler.action, item: filler, container: 'cube' })
    }
    expect(hud.worldPanels.canFitInCube(hud.inventory.cursorItem!)).toBe(false)
    hud.handleHudMouseDown(makeHudMouseEvent(invBoxClickX, invBoxClickY, 0))
    expect(emitted).toHaveLength(0)

    // Cube cannot be placed inside another Cube (`canFitInCube` rejects `code === 'box'`)
    expect(
      hud.worldPanels.canFitInCube(
        makeUiItem({ id: '999', code: 'box', invWidth: 2, invHeight: 2 }),
      ),
    ).toBe(false)
  })

  it('preserves invvip for Amulet of the Viper (vip) instead of generic amulet artwork', () => {
    const resolved = resolveItemInvFile(
      {
        code: 'vip',
        base: { type: 'amul', invfile: 'invvip' },
      } as unknown as Parameters<typeof resolveItemInvFile>[0],
      'unique',
      'vip',
    )
    expect(resolved.invFile).toBe('invvip')

    const rect = resolveItemSpriteRect(
      makeUiItem({
        id: '400',
        code: 'vip',
        quality: 'unique',
        identified: true,
        invFile: 'invvip',
      }),
    )
    expect(rect).not.toBeNull()
  })

  it('restores cursor items sent via 0x9C action 0x12 (ITEMACTION_TOCURSOR) or location 4 on login/rejoin', () => {
    expect(resolveItemContainer(0x9c, 0x12, undefined, 4, 0)).toBe('cursor')
    expect(resolveItemContainer(0x9c, 0x04, undefined, 4, 0)).toBe('cursor')

    const world = new ClientWorld()
    const hud = new HudManager()
    new HudModel({ world, hudManager: hud })

    const loginCursorItem = makeWorldItem({
      id: 500,
      code: 'msf',
      action: 0x12,
      location: 4,
      storePage: 0,
      container: resolveItemContainer(0x9c, 0x12, undefined, 4, 0),
      invWidth: 1,
      invHeight: 3,
    })
    world.apply({
      type: 'ItemEvent',
      action: loginCursorItem.action,
      item: loginCursorItem,
      container: loginCursorItem.container,
    })

    expect(world.containers.cursor?.id).toBe(500)
    expect(world.containers.inventory.has(500)).toBe(false)
    expect(hud.inventory.cursorItem?.code).toBe('msf')

    expect(typeof vi.fn).toBe('function')
  })
})
