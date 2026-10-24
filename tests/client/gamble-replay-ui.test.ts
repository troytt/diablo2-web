/**
 * Gamble UI over live capture 09 (Gheed, WebBotThree with 2 gold): the menu sends 0x38 action 2,
 * the gamble grid is exactly the server's 0x9C AddToShop items, clicking a ring sends a gamble
 * 0x32 NpcBuy, and the server's rejection (0x2A result 12) shows tbl string 3362.
 */
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { replayD2CapFile } from '../../tools/netproto-replay.ts'
import type { ClientCommand, ServerEvent } from '../../src/netproto/index.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { VENDOR_GRID_ORIGIN } from '../../src/client/ui/world-panels.ts'
import { requireTbl } from '../../src/client/i18n/lang.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import type { VendorPriceFn } from '../../src/client/ui-model/vendor-price.ts'

const GAMBLE_CAPTURE = path.resolve(__dirname, '../fixtures/netproto/09-d2gs-gamble.d2cap')
/** Gheed (MonStats hcIdx 147) is unit #4 in capture 09. */
const GHEED_ID = 4
const GHEED_CLASS = 147
const MONSTER = 1

const stubPrice: VendorPriceFn = (item, type) => 1000 * (type + 1) + item.id

describe('gamble capture 09 -> HudModel / HudManager', () => {
  it('menu -> NpcOpenGamble, server grid shown, ring click -> gamble NpcBuy, result 12 -> TransactionResults10', () => {
    const r = replayD2CapFile(GAMBLE_CAPTURE, { strict: true })
    expect(r.unknownPackets).toBe(0)
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
      vendorPrice: stubPrice,
      vendorRepairAll: () => {
        throw new Error('gamble stores have no Repair All')
      },
      now: () => 10_000,
    })

    const firstShop = r.events.findIndex((e) => e.type === 'ItemEvent' && e.container === 'shop')
    expect(firstShop).toBeGreaterThan(0)
    for (const e of r.events.slice(0, firstShop)) world.apply(e)
    model.syncFromWorld()
    expect(world.getUnit('monster', GHEED_ID)?.classId).toBe(GHEED_CLASS)

    // Click Gheed (C2S 0x13) -> the first-visit greeting (menu=0 intro slot, GheedIntroGossip1
    // #45) auto-pops over the menu; dismiss it so the NPC menu with "gamble" is clickable.
    world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: MONSTER, id: GHEED_ID } })
    model.syncFromWorld()
    expect(commands).toEqual([{ type: 'QuestMessage', npcId: GHEED_ID, messageId: 45 }])
    hud.worldPanels.closeNpcSpeech()
    model.syncFromWorld()
    commands.length = 0
    const menu = hud.worldPanels.npcMenu!
    expect(menu.npcId).toBe(GHEED_ID)
    const gambleIdx = menu.options!.findIndex((o) => o.id === 'gamble')
    expect(gambleIdx).toBeGreaterThanOrEqual(0)
    const layout = hud.worldPanels.getNpcMenuLayout(hud.font)!
    const down = (x: number, y: number, shiftKey = false) =>
      hud.handleHudMouseDown({
        clientX: x,
        clientY: y,
        button: 0,
        shiftKey,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as MouseEvent)
    down(layout.left + Math.trunc(layout.width / 2), layout.optionYs[gambleIdx]! - 3)
    expect(commands).toEqual([{ type: 'NpcOpenGamble', npcId: GHEED_ID }])
    expect(hud.leftPanel).toBe('vendor')

    // Server fills the gamble grid; hold back the 0x2A reply until the click.
    const rest = r.events.slice(firstShop)
    const reply = rest.filter((e): e is Extract<ServerEvent, { type: 'NpcTransaction' }> => e.type === 'NpcTransaction')
    expect(reply.map((e) => e.result)).toEqual([12])
    for (const e of rest) if (e.type !== 'NpcTransaction') world.apply(e)
    model.syncFromWorld()

    const wp = hud.worldPanels
    expect(wp.vendorMode).toBe('gamble')
    expect(wp.gamblePlacements.length).toBe(world.containers.shop.size)
    expect(wp.vendorRepairAllCost).toBeNull()
    for (const pl of wp.gamblePlacements) {
      const raw = world.containers.shop.get(Number(pl.item.id))!
      expect(pl.item.buyCost).toBe(stubPrice(raw, 2, { world, npcClass: GHEED_CLASS }))
    }

    const ring = wp.gamblePlacements.find((pl) => pl.item.code === 'rin')!
    expect(ring).toBeDefined()
    const ringId = Number(ring.item.id)
    const ringRaw = world.containers.shop.get(ringId)!
    // Shift is ignored for gamble buys (D2Client sends shiftFill 0 in gamble mode).
    down(
      VENDOR_GRID_ORIGIN.x + ring.col * VENDOR_GRID_ORIGIN.cellPx + 5,
      VENDOR_GRID_ORIGIN.y + ring.row * VENDOR_GRID_ORIGIN.cellPx + 5,
      true,
    )
    expect(commands.at(-1)).toEqual({
      type: 'NpcBuy',
      npcId: GHEED_ID,
      itemId: ringId,
      itemMode: 0,
      gamble: true,
      shiftFill: false,
      cost: stubPrice(ringRaw, 2, { world, npcClass: GHEED_CLASS }),
    })
    expect(world.self.gold).toBe(2)

    for (const e of reply) world.apply(e)
    model.syncFromWorld()
    expect(model.lastNpcTransactionMessage).toEqual({ tblKey: 'TransactionResults10', text: requireTbl('TransactionResults10', 'CHI') })
    expect(world.self.gold).toBe(2)
    expect(world.containers.shop.has(ringId)).toBe(true)
  })
})
