/**
 * Vendor / stash / gamble ClientWorld replay over live 1.13c captures 05-09
 * (WebBotThree, clvl 1, 2 gold). Everything asserted here is what the server sent.
 */
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { replayD2CapFile, type ReplayResult } from '../../tools/netproto-replay.ts'
import { ClickButtonId, type ServerEvent } from '../../src/netproto/index.ts'

const FIXTURES = path.resolve(__dirname, '../fixtures/netproto')
const replay = (name: string): ReplayResult => {
  const r = replayD2CapFile(path.join(FIXTURES, name), { strict: true })
  expect(r.unknownPackets).toBe(0)
  expect(r.opaquePackets).toBe(0)
  expect(r.protocolErrors).toBe(0)
  return r
}
type Tx = Extract<ServerEvent, { type: 'NpcTransaction' }>
const txs = (r: ReplayResult): Tx[] => r.events.filter((e): e is Tx => e.type === 'NpcTransaction')
const MONSTER = 1

describe('vendor/stash captures -> ClientWorld', () => {
  it('05 vendor-open: Charsi store arrives only as 0x9C AddToShop and is freed locally on 0x30', () => {
    const r = replay('05-d2gs-vendor-open.d2cap')
    const shop = [...r.world.containers.shop.values()]
    expect(shop.length).toBe(46)
    for (const it of shop) {
      expect(it.action).toBe(0x0b)
      expect([1, 2, 3, 4]).toContain(it.storePage)
      expect(it.gridX).toBeGreaterThanOrEqual(0)
      expect(it.gridX).toBeLessThan(10)
      expect(it.gridY).toBeGreaterThanOrEqual(0)
      expect(it.gridY).toBeLessThan(10)
    }
    expect(txs(r)).toEqual([])
    // The capture ends after C2S 0x30 with no RemoveFromShop; the client frees the store itself.
    const npcId = r.world.npcInteraction.npcId
    r.world.noteOutgoingCommand({ type: 'NpcCancel', target: { unitType: MONSTER, id: 6 } })
    expect(npcId).toBeNull() // replay feeds S2C only; NpcInit was never noted
    expect(r.world.containers.shop.size).toBe(0)
    expect(r.world.npcInteraction.window).toBe('none')
  })

  it('06 vendor-buy-sell: sells remove the item (act 5 loc 0), buys without gold are rejected with result 12', () => {
    const r = replay('06-d2gs-vendor-buy-sell.d2cap')
    const t = txs(r)
    const sells = t.filter(x => x.flag === 3)
    expect(sells.length).toBe(2)
    for (const s of sells) {
      expect(s.result).toBe(1)
      expect(s.itemId).not.toBe(0xffffffff)
    }
    const rejects = t.filter(x => x.result === 12)
    expect(rejects.length).toBeGreaterThan(0)
    for (const x of rejects) {
      expect(x.flag).toBe(0)
      expect(x.itemId).toBe(0xffffffff)
    }
    // Sold items must not reappear on the cursor (0x9D act 5 with location 0).
    expect(r.world.containers.cursor).toBeNull()
    expect(r.world.containers.inventory.size).toBe(0)
    expect(r.world.self.gold).toBe(sells[sells.length - 1]!.gold)
    expect(r.world.lastNpcTransaction?.seq).toBe(t.length)
  })

  it('07 vendor-repair: undamaged repair -> result 9, repair-all with nothing damaged -> result 2 flag 1', () => {
    const r = replay('07-d2gs-vendor-repair.d2cap')
    expect(txs(r).map(x => [x.result, x.flag, x.itemId])).toEqual([
      [9, 0, 0xffffffff],
      [2, 1, 0xffffffff],
    ])
    expect(r.world.self.gold).toBe(2)
  })

  it('08 stash-gold: 0x77 0x10 opens the stash; deposit/withdraw update stats 15/14; close is local', () => {
    const r = replay('08-d2gs-stash-gold.d2cap')
    expect(r.events.some(e => e.type === 'Trade' && e.action === 0x10)).toBe(true)
    expect(r.world.npcInteraction.stashOpen).toBe(true)
    expect(r.world.self.gold).toBe(2)
    expect(r.world.self.stashGold).toBe(0)
    r.world.noteOutgoingCommand({ type: 'ClickButton', buttonId: ClickButtonId.CloseStash, amount: 0 })
    expect(r.world.npcInteraction.stashOpen).toBe(false)
  })

  it('09 gamble: Gheed gamble store fills via 0x9C; gambling a ring with 2 gold is rejected (result 12)', () => {
    const r = replay('09-d2gs-gamble.d2cap')
    const codes = [...r.world.containers.shop.values()].map(i => i.code)
    expect(codes).toContain('rin')
    expect(codes).toContain('amu')
    expect(txs(r).map(x => [x.result, x.flag, x.itemId])).toEqual([[12, 0, 0xffffffff]])
  })
})
