/**
 * Scripted vendor / stash / gamble scenarios for `tools/d2-bot.ts record --scenario=<name>`.
 *
 * Every state change printed here comes from server packets applied to `ClientWorld`
 * (stat 14 / 15, 0x9C/0x9D item events, 0x2A NpcTransaction). Nothing is mutated locally.
 *
 * Scenarios:
 *   inspect          print self / inventory / town NPC + object list (read-only)
 *   vendor-open      Charsi: 0x13 -> 0x2F -> 0x38 action 1 (trade) -> 0x30 (fixture 05)
 *   vendor-buy-sell  Akara: sell an inventory item, buy the cheapest affordable item, sell it back,
 *                    attempt an unaffordable buy (fixture 06)
 *   vendor-repair    Charsi: single-item repair + repair-all (fixture 07)
 *   stash-gold       stash: deposit 1 / withdraw 1 / withdraw more than the bank holds / close (fixture 08)
 *   gamble           Gheed: 0x38 action 2, attempt a gamble purchase (fixture 09)
 *   vendor-verify    reversible end-to-end run: open shop, buy, sell back, repair, deposit 1, withdraw 1
 */

import type { MapService } from '../../src/client/map/map-service.ts'
import { findPathWorld } from '../../src/client/motion/pathfind.ts'
import { priceItem113c } from '../../src/client/ui-model/transaction-cost-input.ts'
import type { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ClientUnit } from '../../src/client/world/client-unit.ts'
import {
  ClickButtonId,
  unitTypeToId,
  type ClientCommand,
  type GameServerAdapter,
  type ItemData,
  type ServerEvent,
} from '../../src/netproto/index.ts'

/** monstats.txt hcIdx of the Act 1 town NPCs used here. */
export const NPC_CLASS = {
  Gheed: 147,
  Akara: 148,
  Charsi: 154,
} as const

/** objects.txt id 267 = bank (stash); D2Game 0x6fc917e0 requires interact state 2 with this class. */
export const OBJECT_CLASS_STASH = 267
/** objects.txt id 119 = Act 1 Waypoint (Rogue Encampment / Wilderness). */
export const OBJECT_CLASS_ACT1_WAYPOINT = 119

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export const VENDOR_SCENARIOS = [
  'inspect',
  'vendor-open',
  'vendor-buy-sell',
  'vendor-sell-cursor',
  'vendor-repair',
  'stash-gold',
  'gamble',
  'vendor-verify',
  'waypoint-teleport',
] as const

export function isVendorScenario(s: string): s is (typeof VENDOR_SCENARIOS)[number] {
  return (VENDOR_SCENARIOS as readonly string[]).includes(s)
}

interface Ctx {
  readonly world: ClientWorld
  readonly map: MapService
  /** Predicted own position (the server does not echo our own walk hops). */
  pos: { x: number; y: number }
  readonly adapter: GameServerAdapter
  readonly log: (msg: string) => void
  readonly tx: Array<Extract<ServerEvent, { type: 'NpcTransaction' }>>
  readonly report: Record<string, unknown>
}

/** Sends a command and applies its local side effects to ClientWorld, like OnlineSession does. */
function send(ctx: Ctx, cmd: ClientCommand): void {
  ctx.adapter.send(cmd)
  ctx.world.noteOutgoingCommand(cmd)
}

function fmtItem(it: ItemData): string {
  return `#${it.id} ${it.code} q=${it.quality ?? '-'} loc=${it.location} page=${it.storePage} grid=(${it.gridX},${it.gridY}) act=0x${it.action.toString(16)}`
}

function dist(world: ClientWorld, u: ClientUnit, from?: { x: number; y: number }): number {
  const p = from ?? world.self
  return Math.hypot(u.x - p.x, u.y - p.y)
}

function findUnit(world: ClientWorld, kind: 'monster' | 'object', classId: number): ClientUnit {
  const units = world.getUnitsByType(kind).filter((u) => u.classId === classId && u.x > 0 && u.y > 0)
  if (units.length === 0) {
    throw new Error(`no ${kind} with class ${classId} visible (area=${world.areaId})`)
  }
  units.sort((a, b) => dist(world, a) - dist(world, b))
  return units[0]!
}

async function walkTo(ctx: Ctx, kind: 'monster' | 'object', u: ClientUnit, within = 4): Promise<void> {
  for (let step = 0; step < 8 && dist(ctx.world, u, ctx.pos) > within; step++) {
    const dx = u.x - ctx.pos.x
    const dy = u.y - ctx.pos.y
    const d = Math.hypot(dx, dy)
    if (d <= within) break
    const legDist = Math.min(d, 15)
    const tx = Math.round(ctx.pos.x + (dx * legDist) / d)
    const ty = Math.round(ctx.pos.y + (dy * legDist) / d)
    const prevX = ctx.pos.x
    const prevY = ctx.pos.y
    if (!(await walkToPoint(ctx, tx, ty, Math.max(within, 6)))) {
      throw new Error(`no path to ${kind} #${u.id} (class ${u.classId}) from (${ctx.pos.x},${ctx.pos.y})`)
    }
    if (ctx.pos.x === prevX && ctx.pos.y === prevY) break
  }
  ctx.log(`walked to (${ctx.pos.x},${ctx.pos.y}); ${kind} #${u.id} dist=${dist(ctx.world, u, ctx.pos).toFixed(1)}`)
}

function activeView(ctx: Ctx) {
  return ctx.map.getLevelView(ctx.world.areaId || 1, 'all', true)
}

/** Walks along a MapService path in <= 3 sub-tile hops; returns false when no path exists. */
async function walkToPoint(ctx: Ctx, tx: number, ty: number, within: number, stopWhen?: () => boolean): Promise<boolean> {
  const view = activeView(ctx)
  const res = findPathWorld(view, ctx.pos.x, ctx.pos.y, tx, ty, {
    smooth: true,
    nearestTargetRadius: within,
    maxExpandedNodes: 32768,
  })
  if (res.path.length < 2) return false
  for (const wp of res.path.slice(1)) {
    if (stopWhen?.()) return true
    // Subdivide into <= 3 sub-tile hops like the real client's short click-moves.
    const d = Math.hypot(wp.x - ctx.pos.x, wp.y - ctx.pos.y)
    const n = Math.max(1, Math.ceil(d / 3))
    const sx = ctx.pos.x
    const sy = ctx.pos.y
    for (let i = 1; i <= n; i++) {
      if (stopWhen?.()) return true
      const hx = Math.round(sx + ((wp.x - sx) * i) / n)
      const hy = Math.round(sy + ((wp.y - sy) * i) / n)
      const hd = Math.hypot(hx - ctx.pos.x, hy - ctx.pos.y)
      if (hd < 0.5) continue
      send(ctx, { type: 'Move', run: true, to: { x: hx, y: hy } })
      await sleep(Math.max(180, Math.ceil(hd * 165)))
      ctx.world.tick()
      ctx.pos = { x: hx, y: hy }
    }
  }
  return true
}

/**
 * Units are only visible near the player. When `classId` is not in view, walk to
 * walkable town cells (coarse grid, farthest from everything visited first) until it shows up.
 */
async function seekUnit(ctx: Ctx, kind: 'monster' | 'object', classId: number, maxLegs = 10): Promise<ClientUnit> {
  const visible = () => ctx.world.getUnitsByType(kind).some(u => u.classId === classId && u.x > 0 && u.y > 0)
  const view = activeView(ctx)
  const visited: Array<{ x: number; y: number }> = [{ ...ctx.pos }]
  const STEP = 10
  const SPREAD = 25
  for (let leg = 0; leg < maxLegs && !visible(); leg++) {
    const cands: Array<{ x: number; y: number; d: number }> = []
    for (let ly = 2; ly < view.subHeight - 2; ly += STEP) {
      for (let lx = 2; lx < view.subWidth - 2; lx += STEP) {
        if (view.walkable[ly * view.subWidth + lx] !== 1) continue
        const x = view.subOriginX + lx
        const y = view.subOriginY + ly
        if (visited.some(v => Math.hypot(v.x - x, v.y - y) < SPREAD)) continue
        cands.push({ x, y, d: Math.min(...visited.map(v => Math.hypot(v.x - x, v.y - y))) })
      }
    }
    cands.sort((a, b) => b.d - a.d)
    const next = cands[0]
    if (!next) break
    visited.push(next)
    ctx.log(`seek ${kind} class ${classId}: leg ${leg} -> (${next.x},${next.y}) view=${view.subWidth}x${view.subHeight}`)
    if (!(await walkToPoint(ctx, next.x, next.y, 2, visible))) leg--
    await sleep(400)
  }
  return findUnit(ctx.world, kind, classId)
}

async function waitFor(ctx: Ctx, pred: () => boolean, timeoutMs: number, what: string): Promise<boolean> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (pred()) return true
    await sleep(100)
  }
  ctx.log(`timeout waiting for ${what}`)
  return false
}

async function waitTx(ctx: Ctx, fromIndex: number, timeoutMs = 3000): Promise<Extract<ServerEvent, { type: 'NpcTransaction' }> | null> {
  const ok = await waitFor(ctx, () => ctx.tx.length > fromIndex, timeoutMs, '0x2A NpcTransaction')
  if (!ok) return null
  // Let the trailing 0x9C/0x9D/stat packets of the same transaction arrive.
  await sleep(600)
  return ctx.tx[fromIndex]!
}

function snapshot(ctx: Ctx, label: string): Record<string, unknown> {
  const s = {
    gold: ctx.world.self.gold,
    stashGold: ctx.world.self.stashGold,
    level: ctx.world.self.level,
    inventory: ctx.world.containers.inventory.size,
    shop: ctx.world.containers.shop.size,
  }
  ctx.log(`[${label}] gold=${s.gold} stash=${s.stashGold} clvl=${s.level} inv=${s.inventory} shop=${s.shop}`)
  return s
}

async function openNpc(ctx: Ctx, npcClass: number): Promise<ClientUnit> {
  const npc = await seekUnit(ctx, 'monster', npcClass)
  ctx.log(`npc class=${npcClass} id=${npc.id} at (${npc.x},${npc.y}) dist=${dist(ctx.world, npc, ctx.pos).toFixed(1)}`)
  await walkTo(ctx, 'monster', npc)
  const target = { unitType: unitTypeToId('monster'), id: npc.id }
  send(ctx, { type: 'Interact', target })
  await sleep(700)
  send(ctx, { type: 'NpcInit', target })
  await sleep(700)
  return npc
}

async function closeNpc(ctx: Ctx, npc: ClientUnit): Promise<void> {
  send(ctx, { type: 'NpcCancel', target: { unitType: unitTypeToId('monster'), id: npc.id } })
  await sleep(800)
  ctx.log(`closed npc #${npc.id}; shop items left in ClientWorld=${ctx.world.containers.shop.size}`)
}

async function openShop(ctx: Ctx, npc: ClientUnit, gamble: boolean): Promise<readonly ItemData[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = ctx.world.containers.shop.size
    send(ctx, gamble ? { type: 'NpcOpenGamble', npcId: npc.id } : { type: 'NpcOpenTrade', npcId: npc.id })
    const gotShop = await waitFor(ctx, () => ctx.world.containers.shop.size > before, 4000, 'shop items')
    if (gotShop) break
    if (attempt === 0) {
      ctx.log(`retrying walkTo + Interact + NpcInit for npc #${npc.id} at (${npc.x},${npc.y}) from (${ctx.pos.x},${ctx.pos.y})`)
      await walkTo(ctx, 'monster', npc, 2)
      const target = { unitType: unitTypeToId('monster'), id: npc.id }
      send(ctx, { type: 'Interact', target })
      await sleep(700)
      send(ctx, { type: 'NpcInit', target })
      await sleep(700)
    }
  }
  await sleep(1200)
  const items = [...ctx.world.containers.shop.values()]
  ctx.log(`${gamble ? 'gamble' : 'trade'} shop opened: ${items.length} items`)
  const pages = new Map<number, number>()
  for (const it of items) pages.set(it.storePage, (pages.get(it.storePage) ?? 0) + 1)
  ctx.log(`  storePage histogram: ${[...pages].map(([p, n]) => `${p}:${n}`).join(' ')}`)
  for (const it of items.slice(0, 80)) ctx.log(`  shop ${fmtItem(it)}`)
  return items
}

function sellCandidate(world: ClientWorld): ItemData | undefined {
  // Inventory items only (dwMode 0 = stored); never equipped gear or belt potions.
  return [...world.containers.inventory.values()].sort((a, b) => a.id - b.id)[0]
}

async function sell(ctx: Ctx, npc: ClientUnit, item: ItemData, label: string): Promise<void> {
  const g0 = ctx.world.self.gold
  const i = ctx.tx.length
  ctx.log(`${label}: sell ${fmtItem(item)}`)
  send(ctx, { type: 'NpcSell', npcId: npc.id, itemId: item.id, itemMode: 0, cost: 1 })
  const t = await waitTx(ctx, i)
  ctx.log(`${label}: result=${t?.result} flag=${t?.flag} itemId=0x${(t?.itemId ?? 0).toString(16)} gold@11=${t?.gold} | stat14 ${g0} -> ${ctx.world.self.gold} (Δ${ctx.world.self.gold - g0}) stillInInv=${ctx.world.containers.inventory.has(item.id)}`)
  ctx.report[label] = { item: item.code, result: t?.result, flag: t?.flag, goldBefore: g0, goldAfter: ctx.world.self.gold }
}

async function sellFromCursor(ctx: Ctx, npc: ClientUnit, item: ItemData, label: string): Promise<void> {
  if (ctx.world.containers.cursor?.id === item.id) {
    ctx.log(`${label}: item #${item.id} (${item.code}) already on cursor; placing in inventory (0x18) first`)
    send(ctx, { type: 'ItemPlace', itemId: item.id, x: 0, y: 0, buffer: 0 })
    await waitFor(ctx, () => ctx.world.containers.inventory.has(item.id), 3000, '0x9D act 0x04 place in inventory')
  }
  ctx.log(`${label}: pick up ${fmtItem(item)} to cursor (0x19)`)
  send(ctx, { type: 'ItemToCursor', itemId: item.id })
  const picked = await waitFor(ctx, () => ctx.world.containers.cursor?.id === item.id, 3000, '0x9D act 0x05 cursor pickup')
  if (!picked) {
    throw new Error(`${label}: failed to pick up item #${item.id} (${item.code}) to cursor`)
  }
  const g0 = ctx.world.self.gold
  const i = ctx.tx.length
  ctx.log(`${label}: sell cursor item #${item.id} (${item.code}) with itemMode=4 (0x33)`)
  send(ctx, { type: 'NpcSell', npcId: npc.id, itemId: item.id, itemMode: 4, cost: 1 })
  const t = await waitTx(ctx, i)
  const cursorAfter = ctx.world.containers.cursor?.id ?? null
  ctx.log(`${label}: result=${t?.result} flag=${t?.flag} itemId=0x${(t?.itemId ?? 0).toString(16)} gold@11=${t?.gold} | stat14 ${g0} -> ${ctx.world.self.gold} (Δ${ctx.world.self.gold - g0}) cursorAfter=${cursorAfter} stillInInv=${ctx.world.containers.inventory.has(item.id)}`)
  ctx.report[label] = {
    item: item.code,
    itemMode: 4,
    result: t?.result,
    flag: t?.flag,
    goldBefore: g0,
    goldAfter: ctx.world.self.gold,
    cursorAfter,
    stillInInv: ctx.world.containers.inventory.has(item.id),
  }
}

async function buy(
  ctx: Ctx,
  npc: ClientUnit,
  item: ItemData,
  opts: { gamble: boolean; shiftFill: boolean; cost: number },
  label: string,
): Promise<number | undefined> {
  const g0 = ctx.world.self.gold
  const inv0 = new Set(ctx.world.containers.inventory.keys())
  const belt0 = new Set(ctx.world.containers.belt.keys())
  const i = ctx.tx.length
  ctx.log(`${label}: buy ${fmtItem(item)} gamble=${opts.gamble} shift=${opts.shiftFill} cost=${opts.cost}`)
  send(ctx, { type: 'NpcBuy', npcId: npc.id, itemId: item.id, itemMode: 0, ...opts })
  const t = await waitTx(ctx, i)
  const newInv = [...ctx.world.containers.inventory.values()].filter((x) => !inv0.has(x.id))
  const newBelt = [...ctx.world.containers.belt.values()].filter((x) => !belt0.has(x.id))
  ctx.log(`${label}: result=${t?.result} flag=${t?.flag} itemId=0x${(t?.itemId ?? 0).toString(16)} gold@11=${t?.gold} | stat14 ${g0} -> ${ctx.world.self.gold} (Δ${ctx.world.self.gold - g0}) newInv=[${newInv.map(fmtItem).join('; ')}] newBelt=${newBelt.length}`)
  ctx.report[label] = { item: item.code, result: t?.result, flag: t?.flag, goldBefore: g0, goldAfter: ctx.world.self.gold, newInv: newInv.map((x) => x.id) }
  return newInv[0]?.id
}

async function stashGold(ctx: Ctx, button: number, amount: number, label: string): Promise<void> {
  const g0 = ctx.world.self.gold
  const s0 = ctx.world.self.stashGold
  send(ctx, { type: 'ClickButton', buttonId: button, amount })
  await sleep(1500)
  ctx.log(`${label}: 0x4F 0x${button.toString(16)} amount=${amount} | gold ${g0} -> ${ctx.world.self.gold}, stash ${s0} -> ${ctx.world.self.stashGold}`)
  ctx.report[label] = { amount, goldBefore: g0, goldAfter: ctx.world.self.gold, stashBefore: s0, stashAfter: ctx.world.self.stashGold }
}

async function openStash(ctx: Ctx): Promise<void> {
  const stash = findUnit(ctx.world, 'object', OBJECT_CLASS_STASH)
  ctx.log(`stash object id=${stash.id} at (${stash.x},${stash.y}) dist=${dist(ctx.world, stash).toFixed(1)}`)
  await walkTo(ctx, 'object', stash, 3)
  send(ctx, { type: 'Interact', target: { unitType: unitTypeToId('object'), id: stash.id } })
  await sleep(1500)
}

function damagedEquipped(world: ClientWorld): ItemData | undefined {
  for (const it of world.containers.equipment.values()) {
    if (it.curDurability !== undefined && it.maxDurability !== undefined && it.curDurability < it.maxDurability) return it
  }
  return undefined
}

export async function runVendorScenario(
  scenario: (typeof VENDOR_SCENARIOS)[number],
  world: ClientWorld,
  adapter: GameServerAdapter,
  map: MapService,
): Promise<Record<string, unknown>> {
  const tx: Ctx['tx'] = []
  const off = adapter.onEvent((ev) => {
    if (ev.type === 'NpcTransaction') tx.push(ev)
  })
  const ctx: Ctx = {
    world,
    adapter,
    map,
    pos: { x: world.self.x, y: world.self.y },
    tx,
    report: {},
    log: (m) => console.log(`[vendor] ${m}`),
  }
  const offPos = adapter.onEvent((ev) => {
    // Server-authoritative corrections of our own position.
    if (ev.type === 'UnitReassign' && (ev.unitType === 0 || ev.unitType === 'player') && (ev.id === world.selfId || world.selfId === 0)) {
      ctx.pos = { x: ev.at.x, y: ev.at.y }
    } else if (ev.type === 'LifeMana' && ev.at && ev.at.x > 0 && ev.at.y > 0) {
      ctx.pos = { x: ev.at.x, y: ev.at.y }
    }
  })
  try {
    await sleep(1500)
    ctx.report.before = snapshot(ctx, 'before')
    ctx.log(`area=${world.areaId} act=${world.act} self=(${world.self.x},${world.self.y})`)
    if (scenario === 'inspect') {
      for (const it of world.containers.inventory.values()) ctx.log(`inv ${fmtItem(it)}`)
      for (const it of world.containers.equipment.values()) {
        ctx.log(`eq ${fmtItem(it)} dur=${it.curDurability}/${it.maxDurability} bodyLoc=${it.bodyLoc}`)
      }
      for (const it of world.containers.belt.values()) ctx.log(`belt ${fmtItem(it)}`)
      for (const u of world.getUnitsByType('monster')) ctx.log(`npc #${u.id} class=${u.classId} at (${u.x},${u.y})`)
      for (const u of world.getUnitsByType('object')) ctx.log(`obj #${u.id} class=${u.classId} at (${u.x},${u.y})`)
    } else if (scenario === 'vendor-open') {
      const npc = await openNpc(ctx, NPC_CLASS.Charsi)
      const items = await openShop(ctx, npc, false)
      ctx.report.shopItems = items.length
      await closeNpc(ctx, npc)
    } else if (scenario === 'vendor-buy-sell' || scenario === 'vendor-verify') {
      const npc = await openNpc(ctx, NPC_CLASS.Akara)
      const items = await openShop(ctx, npc, false)
      ctx.report.shopItems = items.length
      if (scenario === 'vendor-buy-sell') {
        // Starter items are the only natural gold source in town for a fresh character.
        let n = 0
        for (let cand = sellCandidate(world); cand && n < 2; cand = sellCandidate(world), n++) {
          await sell(ctx, npc, cand, `sell-starter-${n}`)
        }
      }
      // Cheapest consumable by code family that the server can price (hp1 / mp1 / tsc / isc).
      const prefer = ['hp1', 'mp1', 'isc', 'tsc', 'hp2', 'mp2']
      const target = prefer.map((c) => items.find((it) => it.code === c)).find((x) => x !== undefined)
      if (target) {
        // Display price from the 1.13c #10107 port; D2Game ignores the cost field (0x6fcdf200).
        const price = priceItem113c(world, target, 0, NPC_CLASS.Akara)
        ctx.report.buyPrice = { item: target.code, price, goldBefore: world.self.gold }
        ctx.log(`buy price of ${target.code} at Akara (1.13c port) = ${price}, gold=${world.self.gold}`)
        const boughtId = await buy(ctx, npc, target, { gamble: false, shiftFill: false, cost: price }, 'buy')
        if (boughtId !== undefined) {
          const bought = world.containers.inventory.get(boughtId)
          if (bought) await sell(ctx, npc, bought, 'sell-back')
        }
      } else {
        ctx.log('no consumable on the shelf to buy')
      }
      if (scenario === 'vendor-buy-sell') {
        const pricey = items.filter((it) => it.code !== target?.code).sort((a, b) => b.id - a.id)[0]
        if (pricey) await buy(ctx, npc, pricey, { gamble: false, shiftFill: false, cost: 1 }, 'buy-unaffordable')
        if (target) await buy(ctx, npc, target, { gamble: false, shiftFill: true, cost: 1 }, 'buy-shift')
      }
      await closeNpc(ctx, npc)
      if (scenario === 'vendor-verify') {
        const smith = await openNpc(ctx, NPC_CLASS.Charsi)
        await openShop(ctx, smith, false)
        const dmg = damagedEquipped(world)
        const i = ctx.tx.length
        if (dmg) {
          const cur = dmg.curDurability!
          adapter.send({ type: 'NpcRepairItem', npcId: smith.id, itemId: dmg.id, itemMode: 1, durability: cur })
        } else {
          adapter.send({ type: 'NpcRepairAll', npcId: smith.id })
        }
        const t = await waitTx(ctx, i)
        ctx.log(`repair(${dmg ? 'item' : 'all'}): result=${t?.result} flag=${t?.flag} gold=${world.self.gold}`)
        ctx.report.repair = { kind: dmg ? 'item' : 'all', result: t?.result, flag: t?.flag }
        await closeNpc(ctx, smith)
        await openStash(ctx)
        await stashGold(ctx, ClickButtonId.DepositGold, 1, 'deposit-1')
        await stashGold(ctx, ClickButtonId.WithdrawGold, 1, 'withdraw-1')
        adapter.send({ type: 'ClickButton', buttonId: ClickButtonId.CloseStash, amount: 0 })
        await sleep(800)
      }
    } else if (scenario === 'vendor-sell-cursor') {
      if (world.containers.cursor) {
        const curId = world.containers.cursor.id
        ctx.log(`placing initial cursor item #${curId} (${world.containers.cursor.code}) into inventory (0x18) before NPC interact`)
        send(ctx, { type: 'ItemPlace', itemId: curId, x: 0, y: 0, buffer: 0 })
        await waitFor(ctx, () => world.containers.inventory.has(curId), 3000, '0x9D act 0x04 place in inventory')
        await sleep(300)
      }
      let npc = await openNpc(ctx, NPC_CLASS.Charsi)
      let items = await openShop(ctx, npc, false)
      if (items.length === 0) {
        await closeNpc(ctx, npc)
        npc = await openNpc(ctx, NPC_CLASS.Akara)
        items = await openShop(ctx, npc, false)
      }
      ctx.report.shopItems = items.length
      const cand = sellCandidate(world)
      if (cand && items.length > 0) {
        await sellFromCursor(ctx, npc, cand, 'sell-cursor-starter')
      }
      await closeNpc(ctx, npc)
    } else if (scenario === 'vendor-repair') {
      const npc = await openNpc(ctx, NPC_CLASS.Charsi)
      await openShop(ctx, npc, false)
      const dmg = damagedEquipped(world)
      const eq = dmg ?? [...world.containers.equipment.values()][0]
      if (eq) {
        if (eq.curDurability === undefined) throw new Error(`equipped ${eq.code} has no durability`)
        const cur = eq.curDurability
        const i = ctx.tx.length
        ctx.log(`repair-item ${fmtItem(eq)} durability=${cur} damaged=${dmg !== undefined}`)
        adapter.send({ type: 'NpcRepairItem', npcId: npc.id, itemId: eq.id, itemMode: 1, durability: cur })
        const t = await waitTx(ctx, i)
        ctx.log(`repair-item: result=${t?.result} flag=${t?.flag} gold=${world.self.gold}`)
        ctx.report.repairItem = { item: eq.code, damaged: dmg !== undefined, result: t?.result, flag: t?.flag }
      }
      await sleep(2100) // D2Client throttles repair-all to one request per 2000 ms
      const i = ctx.tx.length
      adapter.send({ type: 'NpcRepairAll', npcId: npc.id })
      const t = await waitTx(ctx, i)
      ctx.log(`repair-all: result=${t?.result} flag=${t?.flag} gold=${world.self.gold}`)
      ctx.report.repairAll = { result: t?.result, flag: t?.flag }
      await closeNpc(ctx, npc)
    } else if (scenario === 'stash-gold') {
      await openStash(ctx)
      await stashGold(ctx, ClickButtonId.DepositGold, 1, 'deposit-1')
      await stashGold(ctx, ClickButtonId.WithdrawGold, 1, 'withdraw-1')
      await stashGold(ctx, ClickButtonId.WithdrawGold, world.self.stashGold + 1, 'withdraw-more-than-bank')
      adapter.send({ type: 'ClickButton', buttonId: ClickButtonId.CloseStash, amount: 0 })
      await sleep(1000)
    } else if (scenario === 'gamble') {
      const npc = await openNpc(ctx, NPC_CLASS.Gheed)
      const items = await openShop(ctx, npc, true)
      ctx.report.shopItems = items.length
      const pick = items.find((it) => it.code === 'rin') ?? items[0]
      if (pick) await buy(ctx, npc, pick, { gamble: true, shiftFill: false, cost: 1 }, 'gamble-buy')
      await closeNpc(ctx, npc)
    } else if (scenario === 'waypoint-teleport') {
      const wp = await seekUnit(ctx, 'object', OBJECT_CLASS_ACT1_WAYPOINT)
      ctx.log(`waypoint id=${wp.id} class=${wp.classId} at (${wp.x},${wp.y}) dist=${dist(ctx.world, wp, ctx.pos).toFixed(1)}`)
      await walkTo(ctx, 'object', wp, 8)
      const wpTarget = { unitType: unitTypeToId('object'), id: wp.id }
      send(ctx, { type: 'MoveToUnit', run: true, target: wpTarget })
      await sleep(500)
      for (let attempt = 1; attempt <= 4; attempt++) {
        const prevSeq = world.waypointMenuSeq
        send(ctx, { type: 'Interact', target: wpTarget })
        if (await waitFor(ctx, () => world.waypointMenuSeq > prevSeq && world.waypointUnitId === wp.id, 800, `0x63 WaypointMenu (attempt ${attempt})`)) {
          break
        }
      }
      ctx.log(`opened 0x63 WaypointMenu: unitId=${world.waypointUnitId} unlockedCount=${world.waypoints.size} unlocked=[${[...world.waypoints].join(',')}]`)
      ctx.report.openedWaypoint = {
        unitId: world.waypointUnitId,
        unlockedWaypoints: [...world.waypoints],
      }
      // Teleport to Cold Plains (areaId = 3) if unlocked, or first unlocked non-1 area, or test close (destAreaId = 0) + Rogue Encampment
      const destAreaId = world.waypoints.has(3) ? 3 : ([...world.waypoints].find((a) => a !== 1) ?? 0)
      if (destAreaId > 0) {
        const posBeforeTp = { ...ctx.pos }
        send(ctx, { type: 'WaypointGo', waypointId: wp.id, destAreaId })
        await waitFor(
          ctx,
          () =>
            [...world.revealedRooms].some((r) => r.startsWith(`${destAreaId}:`)) &&
            (ctx.pos.x !== posBeforeTp.x || ctx.pos.y !== posBeforeTp.y),
          6000,
          `area transition to area ${destAreaId}`,
        )
        await sleep(800)
        ctx.log(`teleported to area=${destAreaId} pos=(${ctx.pos.x},${ctx.pos.y})`)
        ctx.report.afterTeleport = {
          areaId: destAreaId,
          x: ctx.pos.x,
          y: ctx.pos.y,
        }
        const destWp = world
          .getUnitsByType('object')
          .filter((u) => u.classId === OBJECT_CLASS_ACT1_WAYPOINT && u.id !== wp.id)
          .sort((a, b) => dist(world, a, ctx.pos) - dist(world, b, ctx.pos))[0]
        if (destWp) {
          const destTarget = { unitType: unitTypeToId('object'), id: destWp.id }
          send(ctx, { type: 'MoveToUnit', run: true, target: destTarget })
          await sleep(400)
          for (let attempt = 1; attempt <= 4; attempt++) {
            const seq2 = world.waypointMenuSeq
            send(ctx, { type: 'Interact', target: destTarget })
            if (await waitFor(ctx, () => world.waypointMenuSeq > seq2, 800, '0x63 WaypointMenu at dest')) {
              break
            }
          }
          // Test closing with destAreaId = 0, then re-open and return to Rogue Encampment (areaId = 1)
          send(ctx, { type: 'WaypointGo', waypointId: destWp.id, destAreaId: 0 })
          await sleep(400)
          for (let attempt = 1; attempt <= 4; attempt++) {
            const seq3 = world.waypointMenuSeq
            send(ctx, { type: 'Interact', target: destTarget })
            if (await waitFor(ctx, () => world.waypointMenuSeq > seq3, 800, '0x63 WaypointMenu reopen at dest')) {
              break
            }
          }
          send(ctx, { type: 'WaypointGo', waypointId: destWp.id, destAreaId: 1 })
          await waitFor(
            ctx,
            () => [...world.revealedRooms].some((r) => r.startsWith('1:')) && Math.hypot(ctx.pos.x - destWp.x, ctx.pos.y - destWp.y) > 20,
            6000,
            'return to Rogue Encampment',
          )
          await sleep(600)
          ctx.log(`returned to Rogue Encampment: pos=(${ctx.pos.x},${ctx.pos.y})`)
        }
      } else {
        // Only Rogue Encampment (1) unlocked on this character: test closing with destAreaId = 0
        send(ctx, { type: 'WaypointGo', waypointId: wp.id, destAreaId: 0 })
        await sleep(500)
      }
    }
    ctx.report.after = snapshot(ctx, 'after')
    ctx.report.tx = tx.map((t) => ({ result: t.result, flag: t.flag, itemId: t.itemId, gold: t.gold }))
    return ctx.report
  } finally {
    off()
    offPos()
  }
}
