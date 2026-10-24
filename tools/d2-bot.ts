#!/usr/bin/env npx tsx
/**
 * Headless Diablo II 1.13c Online Bot & Wire Capture CLI (`scripts/d2-bot.ts`, Features F5 & F10).
 *
 * Commands:
 *   register | login | chars | create-char | games | create-game | join | idle | record | walk | audit-levels
 *
 * Options:
 *   --via=mixed|wss|tcp        (default: mixed — TCP <bnetHost>:6112 for bnet, WSS for realm/game)
 *   --host=<bnetHost>          (default: D2_BNET_HOST or www.laiseek.xyz)
 *   --ws-host=<bridgeHost>     (default: www.laiseek.xyz)
 *   --account=<username>       (default: d2webbot1)
 *   --char=<charName>          (default: WebBotOne)
 *   --class=<0..6>             (default: 1 Sorceress)
 *   --game=<gameName>          (default: auto-generated)
 *   --pass=<gamePass>          (default: "")
 *   --create-game              Create the game before joining
 *   --idle=<seconds>           Stay in-game for N seconds (default: 5 for join, 60 for idle)
 *   --world                    Print ClientWorld state summary
 *   --capture=<out.d2cap>      Write .d2cap JSONL wire capture to disk
 *   --scenario=<name>          Scenario name for record command (town|combat|items|npc|chat|full, or a
 *                              vendor scenario: inspect|vendor-open|vendor-buy-sell|vendor-repair|stash-gold|
 *                              gamble|vendor-verify — see tools/lib/vendor-scenarios.ts)
 *   --report=<out.json>        Write the vendor scenario report (server-driven before/after state) to disk
 */

import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import './lib/node-map-loader.ts'
import {
  MapService,
  getCollisionLocalSubTile,
  getCollisionWorldSubTile,
  isWalkableLocalSubTile,
  isWalkableWorldSubTile,
  localToWorldSubTile,
  type LevelView,
} from '../src/client/map/map-service.ts'
import { findPathWorld, type SubTilePoint } from '../src/client/motion/pathfind.ts'
import { LocalMovementPredictor } from '../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../src/client/session/rate-limiter.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { getCanonicalItemDataTables } from '../src/client/world/item-tables-provider.ts'
import { COLLIDE_MASK_INVALID } from '../src/common/world/d2map.ts'
import { isTownLevel } from '../src/common/world/scene-population.ts'
import {
  InMemoryPacketTap,
  createD2OnlineFlow,
  createMixedResolver,
  createTcpResolver,
  createWsBridgeResolver,
  registerDefaultTcpOpener,
  unitTypeToId,
  type CharClassId,
  type EndpointResolver,
  type GameServerAdapter,
} from '../src/netproto/index.ts'
import { connectNodeTcpStream } from './lib/node-tcp-stream.ts'
import { isVendorScenario, runVendorScenario } from './lib/vendor-scenarios.ts'
import {
  D2S_MAGIC,
  D2S_QUEST_OFFSET,
  D2S_VERSION_113C,
  D2S_WAYPOINT_OFFSET,
  unlockLocalD2sFile,
  unlockRemotePvpgnCharSave,
  verifyD2sUnlocked,
  writeD2sChecksum,
} from './d2s-unlock.ts'

registerDefaultTcpOpener(connectNodeTcpStream)

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(__dirname, '..')
const ACCOUNTS_PATH = resolve(ROOT_DIR, 'scratch/bot-accounts.json')

export interface BotAccountRecord {
  readonly username: string
  readonly password: string
  readonly defaultChar: string
  readonly charClass: CharClassId
  readonly createdAt: string
}

export interface BotAccountsFile {
  readonly server: string
  readonly realm: string
  readonly updatedAt: string
  readonly accounts: Record<string, BotAccountRecord>
}

function loadOrInitBotAccounts(serverHost: string): BotAccountsFile {
  if (existsSync(ACCOUNTS_PATH)) {
    try {
      return JSON.parse(readFileSync(ACCOUNTS_PATH, 'utf8')) as BotAccountsFile
    } catch {
      // Fall through to re-init
    }
  }
  const defaults: Record<string, BotAccountRecord> = {
    d2webbot1: {
      username: 'd2webbot1',
      password: `d2w_${randomBytes(6).toString('hex')}`,
      defaultChar: 'WebBotOne',
      charClass: 1,
      createdAt: new Date().toISOString(),
    },
    d2webbot2: {
      username: 'd2webbot2',
      password: `d2w_${randomBytes(6).toString('hex')}`,
      defaultChar: 'WebBotTwo',
      charClass: 3,
      createdAt: new Date().toISOString(),
    },
    d2webbot3: {
      username: 'd2webbot3',
      password: `d2w_${randomBytes(6).toString('hex')}`,
      defaultChar: 'WebBotThree',
      charClass: 4,
      createdAt: new Date().toISOString(),
    },
  }
  const data: BotAccountsFile = {
    server: serverHost,
    realm: 'Sanctuary',
    updatedAt: new Date().toISOString(),
    accounts: defaults,
  }
  mkdirSync(dirname(ACCOUNTS_PATH), { recursive: true })
  writeFileSync(ACCOUNTS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8')
  return data
}

function saveBotAccounts(data: BotAccountsFile): void {
  mkdirSync(dirname(ACCOUNTS_PATH), { recursive: true })
  writeFileSync(ACCOUNTS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function parseArgs(argv: readonly string[]): {
  readonly cmd: string
  readonly flags: Readonly<Record<string, string | boolean>>
} {
  const flags: Record<string, string | boolean> = {}
  let cmd = 'help'
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=')
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1)
      } else {
        flags[arg.slice(2)] = true
      }
    } else if (cmd === 'help') {
      cmd = arg
    }
  }
  return { cmd, flags }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function buildResolver(
  via: 'mixed' | 'wss' | 'tcp',
  bnetHost: string,
  wsHost: string,
): EndpointResolver {
  if (via === 'tcp') {
    return createTcpResolver({ hostOverride: bnetHost, timeoutMs: 12_000 })
  }
  if (via === 'wss') {
    return createWsBridgeResolver({
      host: wsHost,
      scheme: 'wss',
      basePath: '/d2net',
      timeoutMs: 12_000,
    })
  }
  return createMixedResolver({
    bnetTcpHost: bnetHost,
    bnetTcpPort: 6112,
    host: wsHost,
    scheme: 'wss',
    basePath: '/d2net',
    timeoutMs: 12_000,
  })
}

function printWorldSummary(world: ClientWorld, adapter: GameServerAdapter, prefix = '[world]'): void {
  const players = world.getUnitsByType('player').length
  const monsters = world.getUnitsByType('monster').length
  const objects = world.getUnitsByType('object').length
  const items = world.getUnitsByType('item').length
  const tiles = world.getUnitsByType('tile').length
  console.log(
    `${prefix} act=${world.act} seed=0x${world.mapSeed.toString(16).padStart(8, '0')} diff=${world.difficulty} exp=${world.expansion} area=${world.areaId} loading=${world.loading} | self=${world.self.name}(#${world.selfId}, class=${world.self.charClass}, lvl=${world.self.level}) pos=(${world.self.x},${world.self.y}) hp=${world.self.life}/${world.self.maxLife} mp=${world.self.mana}/${world.self.maxMana} stam=${world.self.stamina}/${world.self.maxStamina} gold=${world.self.gold} skills=${world.self.skills.size} (L=${world.self.leftSkill},R=${world.self.rightSkill}) | units=${world.units.size} (plr=${players},mon=${monsters},obj=${objects},itm=${items},tile=${tiles}) rooms=${world.revealedRooms.size} | inv=${world.containers.inventory.size} eq=${world.containers.equipment.size} belt=${world.containers.belt.size} ground=${world.containers.ground.size} cursor=${world.containers.cursor?.code ?? 'none'} | rtt=${adapter.stats.rttMs}ms pktsIn=${adapter.stats.packetsIn} pktsOut=${adapter.stats.packetsOut} unknown=${adapter.stats.unknownPackets} opaque=${adapter.stats.opaquePackets} errs=${adapter.stats.protocolErrors}`,
  )
}

async function runInGameScenario(
  scenario: string,
  world: ClientWorld,
  adapter: GameServerAdapter,
): Promise<void> {
  await sleep(800)

  // 1. Overhead & regular chat
  if (scenario === 'chat' || scenario === 'town' || scenario === 'full') {
    adapter.send({ type: 'OverheadChat', text: 'Bot online!' })
    await sleep(350)
    adapter.send({ type: 'Chat', text: 'Hello Sanctuary from d2-bot' })
    await sleep(350)
  }

  // 2. Walk and Run around current town position
  if (scenario === 'town' || scenario === 'combat' || scenario === 'full') {
    const startX = world.self.x
    const startY = world.self.y
    if (startX > 0 && startY > 0) {
      const offsets: readonly [number, number, boolean][] = [
        [4, 0, false],
        [4, 4, true],
        [0, 4, true],
        [0, 0, false],
      ]
      for (const [dx, dy, run] of offsets) {
        adapter.send({
          type: 'Move',
          run,
          to: { x: startX + dx, y: startY + dy },
        })
        await sleep(700)
      }
    }
  }

  // 3. Skill selection & cast
  if (scenario === 'combat' || scenario === 'full') {
    const firstSkill = Array.from(world.self.skills.keys()).find(id => id > 0) ?? 0
    adapter.send({ type: 'SelectSkill', hand: 'right', skill: firstSkill })
    await sleep(300)
    if (world.self.x > 0 && world.self.y > 0) {
      adapter.send({
        type: 'SkillAt',
        hand: 'right',
        at: { x: world.self.x + 3, y: world.self.y + 3 },
        hold: false,
      })
      await sleep(500)
    }
  }

  // 4. Item actions (weapon swap, belt / inventory / equip manipulation)
  if (scenario === 'items' || scenario === 'full') {
    adapter.send({ type: 'SwapWeapons' })
    await sleep(450)
    adapter.send({ type: 'SwapWeapons' })
    await sleep(450)

    // Pick up an inventory item to cursor and place it back
    const invItem = Array.from(world.containers.inventory.values())[0]
    if (invItem) {
      const origX = invItem.gridX
      const origY = invItem.gridY
      adapter.send({ type: 'ItemToCursor', itemId: invItem.id })
      await sleep(500)
      if (world.containers.cursor?.id === invItem.id) {
        adapter.send({
          type: 'ItemPlace',
          itemId: invItem.id,
          x: origX,
          y: origY,
          buffer: 0, // inventory buffer
        })
        await sleep(500)
      }
    }
  }

  // 5. NPC interaction in town
  if (scenario === 'npc' || scenario === 'full') {
    const selfX = world.self.x
    const selfY = world.self.y
    const monsters = world.getUnitsByType('monster')
    let nearestNpc = monsters[0]
    let bestDist = Infinity
    for (const m of monsters) {
      if (m.x > 0 && m.y > 0) {
        const d = Math.hypot(m.x - selfX, m.y - selfY)
        if (d < bestDist) {
          bestDist = d
          nearestNpc = m
        }
      }
    }
    if (nearestNpc && bestDist < 60) {
      adapter.send({
        type: 'MoveToUnit',
        run: true,
        target: { unitType: unitTypeToId('monster'), id: nearestNpc.id },
      })
      await sleep(900)
      adapter.send({
        type: 'NpcInit',
        target: { unitType: unitTypeToId('monster'), id: nearestNpc.id },
      })
      await sleep(500)
      adapter.send({
        type: 'Interact',
        target: { unitType: unitTypeToId('monster'), id: nearestNpc.id },
      })
      await sleep(600)
      adapter.send({
        type: 'NpcCancel',
        target: { unitType: unitTypeToId('monster'), id: nearestNpc.id },
      })
      await sleep(400)
    }
  }
}

function subdividePathHops(path: readonly SubTilePoint[], maxHopDist = 3.5): SubTilePoint[] {
  if (path.length === 0) return []
  const hops: SubTilePoint[] = []
  let cur = path[0]!
  for (let i = 1; i < path.length; i++) {
    const target = path[i]!
    const dx = target.x - cur.x
    const dy = target.y - cur.y
    const dist = Math.hypot(dx, dy)
    if (dist <= 1e-3) continue
    const steps = Math.max(1, Math.ceil(dist / maxHopDist))
    for (let s = 1; s <= steps; s++) {
      const ratio = s / steps
      hops.push({
        x: Math.round(cur.x + dx * ratio),
        y: Math.round(cur.y + dy * ratio),
      })
    }
    cur = target
  }
  return hops
}

function createSyntheticBotD2sBuffer(charName: string): Uint8Array {
  const buf = new Uint8Array(765)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  view.setUint32(0x00, D2S_MAGIC, true)
  view.setUint32(0x04, D2S_VERSION_113C, true)
  view.setUint32(0x08, buf.byteLength, true)

  for (let i = 0; i < Math.min(15, charName.length); i++) {
    buf[0x14 + i] = charName.charCodeAt(i) & 0x7f
  }
  buf[0x24] = 0x20 // Expansion
  buf[0x25] = 0x00 // Progression 0
  buf[0x2b] = 1 // Level 1

  buf[D2S_QUEST_OFFSET] = 0x57 // 'W'
  buf[D2S_QUEST_OFFSET + 1] = 0x6f // 'o'
  buf[D2S_QUEST_OFFSET + 2] = 0x6f // 'o'
  buf[D2S_QUEST_OFFSET + 3] = 0x21 // '!'
  view.setUint32(D2S_QUEST_OFFSET + 4, 6, true)
  view.setUint16(D2S_QUEST_OFFSET + 8, 298, true)

  buf[D2S_WAYPOINT_OFFSET] = 0x57 // 'W'
  buf[D2S_WAYPOINT_OFFSET + 1] = 0x53 // 'S'
  view.setUint32(D2S_WAYPOINT_OFFSET + 2, 1, true)
  view.setUint16(D2S_WAYPOINT_OFFSET + 6, 80, true)
  for (let diff = 0; diff < 3; diff++) {
    const wpBase = 0x281 + diff * 24
    buf[wpBase] = 0x02
    buf[wpBase + 1] = 0x01
    buf[wpBase + 2] = 0x01
  }

  writeD2sChecksum(buf)
  return buf
}

/**
 * Walk-bot pass criterion, not a game rule: a non-teleport `0x15` that moves the bot further
 * than this (sub-tiles) means its walk and the server disagreed.
 */
const BOT_MAX_REASSIGN_DRIFT = 5

async function runWalkSubcommand(
  world: ClientWorld,
  adapter: GameServerAdapter,
  mapService: MapService,
): Promise<void> {
  const rateLimiter = new OutboundRateLimiter({ refillPerSec: 25, burstCapacity: 8 })
  const areaId = world.areaId || 1
  const view =
    mapService.getActiveLevelView() ?? mapService.getLevelView(areaId, 'all', true)
  const inTown = isTownLevel(view.id)

  console.log(
    `[d2-bot:walk] Loaded LevelView area=${view.id} act=${view.act} seed=0x${view.seed.toString(16).padStart(8, '0')} origin=(${view.subOriginX},${view.subOriginY}) subSize=${view.subWidth}x${view.subHeight} walkableCells=${view.walkableCellCount} rooms=${view.rooms.length}`,
  )

  const predictor = new LocalMovementPredictor({
    initialX: world.self.x,
    initialY: world.self.y,
  })

  let hardSnaps = 0
  let resyncRequests = 0
  let serverCorrections = 0

  adapter.onEvent((ev) => {
    if (ev.type === 'UnitReassign' && ev.unitType === 'player' && ev.id === world.selfId) {
      serverCorrections++
      const before = predictor.getSnapshot()
      const drift = Math.hypot(ev.at.x - before.logicalX, ev.at.y - before.logicalY)
      // 1.13c `0x15` repositions the player directly (D2Client 0x6FB5F640 → 0x6FB57E20).
      predictor.setPosition(ev.at.x, ev.at.y)
      if (!ev.snap && drift > BOT_MAX_REASSIGN_DRIFT) {
        hardSnaps++
        console.warn(
          `[d2-bot:walk] Unexpected UnitReassign hard-snap: drift=${drift.toFixed(2)} to (${ev.at.x},${ev.at.y})`,
        )
      }
    } else if (ev.type === 'LifeMana' && ev.at && ev.at.x > 0 && ev.at.y > 0) {
      serverCorrections++
      if (ev.vx === undefined || ev.vy === undefined) {
        throw new Error('[d2-bot:walk] LifeMana has a position but no vx/vy motion vector')
      }
      // D2Client 0x6FADA1B0; the RTT is 0 until the first 0x8F pong, like D2Client's
      // zero-initialised [0x6FBC9804].
      const verdict = predictor.verifyServerPosition({
        x: ev.at.x,
        y: ev.at.y,
        source: { kind: 'life-mana', vx: ev.vx, vy: ev.vy },
        rttMs: adapter.stats.rttMs ?? 0,
        inTown,
      })
      if (verdict.action === 'request-resync') {
        resyncRequests++
        adapter.send({ type: 'UpdatePlayerPos', x: verdict.clientX, y: verdict.clientY })
      }
    }
  })

  interface LandmarkTarget {
    readonly label: string
    readonly x: number
    readonly y: number
  }
  const candidates: LandmarkTarget[] = []

  for (const m of world.getUnitsByType('monster')) {
    if (m.x > 0 && m.y > 0 && Math.hypot(m.x - world.self.x, m.y - world.self.y) >= 6) {
      candidates.push({ label: `npc#${m.id}(class=${m.classId})`, x: m.x, y: m.y })
    }
  }
  for (const o of world.getUnitsByType('object')) {
    if (o.x > 0 && o.y > 0 && Math.hypot(o.x - world.self.x, o.y - world.self.y) >= 6) {
      candidates.push({ label: `obj#${o.id}(class=${o.classId})`, x: o.x, y: o.y })
    }
  }
  for (const ent of view.entrances) {
    const worldPt = localToWorldSubTile(view, ent.interiorX * 5 + 2, ent.interiorY * 5 + 2)
    candidates.push({
      label: `entrance(${ent.kind}:${view.id}->${ent.toLevelId})`,
      x: worldPt.worldSubX,
      y: worldPt.worldSubY,
    })
  }
  for (const pu of view.presetUnits.slice(0, 12)) {
    const worldPt = localToWorldSubTile(view, pu.subX, pu.subY)
    if (Math.hypot(worldPt.worldSubX - world.self.x, worldPt.worldSubY - world.self.y) >= 8) {
      candidates.push({
        label: `preset(type=${pu.type},id=${pu.index})`,
        x: worldPt.worldSubX,
        y: worldPt.worldSubY,
      })
    }
  }

  const selectedLandmarks: LandmarkTarget[] = []
  for (const cand of candidates) {
    if (selectedLandmarks.length >= 4) break
    const tooClose = selectedLandmarks.some(
      prev => Math.hypot(prev.x - cand.x, prev.y - cand.y) < 8,
    )
    if (tooClose) continue
    const checkPath = findPathWorld(view, world.self.x, world.self.y, cand.x, cand.y, {
      smooth: true,
      nearestTargetRadius: 10,
      maxExpandedNodes: 16384,
    })
    if (checkPath.reachedGoal && checkPath.path.length >= 2) {
      selectedLandmarks.push(cand)
    }
  }

  if (selectedLandmarks.length < 3) {
    throw new Error(
      `[d2-bot:walk] Expected at least 3 reachable town landmarks, found ${selectedLandmarks.length}`,
    )
  }

  let landmarksVisited = 0
  let totalHops = 0
  let totalSubTilesWalked = 0
  let curX = world.self.x
  let curY = world.self.y
  predictor.setPosition(curX, curY)

  for (const landmark of selectedLandmarks) {
    const pathRes = findPathWorld(view, curX, curY, landmark.x, landmark.y, {
      smooth: true,
      nearestTargetRadius: 10,
      maxExpandedNodes: 16384,
    })
    if (pathRes.path.length < 2) continue

    for (const stepPt of pathRes.rawPath) {
      if (!isWalkableWorldSubTile(view, stepPt.x, stepPt.y)) {
        throw new Error(
          `[d2-bot:walk] Unwalkable A* step at (${stepPt.x},${stepPt.y}) en route to ${landmark.label}`,
        )
      }
      const mask = getCollisionWorldSubTile(view, stepPt.x, stepPt.y)
      if ((mask & COLLIDE_MASK_INVALID) === COLLIDE_MASK_INVALID) {
        throw new Error(
          `[d2-bot:walk] Void collision mask 0x${mask.toString(16)} at (${stepPt.x},${stepPt.y})`,
        )
      }
    }

    const hops = subdividePathHops(pathRes.path, 3.0)
    console.log(
      `[d2-bot:walk] Walking from (${Math.round(curX)},${Math.round(curY)}) -> ${landmark.label} at (${landmark.x},${landmark.y}): rawSteps=${pathRes.rawPath.length} smoothedWaypoints=${pathRes.path.length} hops=${hops.length}`,
    )

    for (const hop of hops) {
      const hopDist = Math.hypot(hop.x - curX, hop.y - curY)
      if (hopDist < 0.5) continue

      const moveCmd = {
        type: 'Move' as const,
        run: true,
        to: { x: hop.x, y: hop.y },
      }
      while (!rateLimiter.tryAcquire(moveCmd, Date.now()).allowed) {
        await sleep(25)
      }
      adapter.send(moveCmd)
      predictor.setPath([hop], true)

      const travelMs = Math.max(120, Math.ceil((hopDist / predictor.getEffectiveSpeedSubTilesPerSec()) * 1000))
      const ticks = Math.max(1, Math.ceil(travelMs / 40))
      for (let t = 0; t < ticks; t++) {
        await sleep(40)
        predictor.update(40)
        world.tick()
      }

      curX = hop.x
      curY = hop.y
      totalHops++
      totalSubTilesWalked += hopDist
    }

    landmarksVisited++
    const snap = predictor.getSnapshot()
    console.log(
      `[d2-bot:walk] Reached landmark ${landmarksVisited}/${selectedLandmarks.length} (${landmark.label}): predictor=(${snap.x.toFixed(1)},${snap.y.toFixed(1)}) worldSelf=(${world.self.x},${world.self.y}) hardSnaps=${hardSnaps} resyncRequests=${resyncRequests}`,
    )
  }

  console.log(
    `[d2-bot:walk:summary] landmarksVisited=${landmarksVisited} totalHops=${totalHops} subTilesWalked=${totalSubTilesWalked.toFixed(1)} serverCorrections=${serverCorrections} resyncRequests=${resyncRequests} hardSnaps=${hardSnaps}`,
  )

  if (landmarksVisited < 3) {
    throw new Error(`[d2-bot:walk] Failed: landmarksVisited=${landmarksVisited} < 3`)
  }
  if (hardSnaps > 0) {
    throw new Error(`[d2-bot:walk] Failed: unexpected UnitReassign hardSnaps=${hardSnaps} > 0`)
  }
}

const WAYPOINT_OBJECT_CLASS_IDS = new Set<number>([
  119, // Act 1 Wilderness / Rogue Encampment Waypoint
  145, // Act 1 Inner Hell / Dungeon Waypoint
  156, // Act 2 Town (Lut Gholein) Waypoint
  157, // Act 2 Desert / Tombs Waypoint
  237, // Act 3 Town (Kurast Docks) Waypoint
  238, // Act 3 Jungle / Kurast Waypoint
  288, // Act 2 Cellar / Harem / Palace Waypoint
  323, // Act 2 Arcane Sanctuary Waypoint
  324, // Act 3 Durance of Hate Waypoint
  398, // Act 4 Pandemonium Fortress Waypoint
  402, // Act 4 Hell / River of Flame Waypoint
  429, // Act 5 Harrogath Waypoint
  494, // Act 5 Ice Caves / Crystalline Passage Waypoint
  496, // Act 5 Temple / Halls of Pain Waypoint
  511, // Act 5 Glacial / Frozen Tundra Waypoint
  539, // Act 5 Worldstone Keep Waypoint
])

const DEFAULT_AUDIT_WAYPOINT_TOUR: readonly number[] = [
  // Act 1
  1, 3, 6, 27, 35,
  // Act 2
  40, 42, 74, 46,
  // Act 3
  75, 79, 83, 101,
  // Act 4
  103, 106, 107,
  // Act 5
  109, 111, 113, 129,
]

function getActIndexForAreaId(areaId: number): 0 | 1 | 2 | 3 | 4 {
  if (areaId <= 39) return 0
  if (areaId <= 74) return 1
  if (areaId <= 102) return 2
  if (areaId <= 108) return 3
  return 4
}

async function runAuditLevelsSubcommand(options: {
  readonly via: 'mixed' | 'wss' | 'tcp'
  readonly bnetHost: string
  readonly wsHost: string
  readonly accountsFile: BotAccountsFile
  readonly tables: ReturnType<typeof getCanonicalItemDataTables>
  readonly tap: InMemoryPacketTap
}): Promise<void> {
  const { via, bnetHost, wsHost, accountsFile, tables, tap } = options
  const botAcc = accountsFile.accounts.d2webbot2 ?? {
    username: 'd2webbot2',
    password: `d2w_${randomBytes(6).toString('hex')}`,
    defaultChar: 'WebBotTwo',
    charClass: 3 as CharClassId,
    createdAt: new Date().toISOString(),
  }
  const auditCharName = botAcc.defaultChar || 'WebBotTwo'

  const runBootstrapPrepGame = async (): Promise<void> => {
    const prepFlow = createD2OnlineFlow({
      resolver: buildResolver(via, bnetHost, wsHost),
      bnetHost,
      defaultRealm: accountsFile.realm,
      itemTables: tables,
      tap,
    })
    try {
      console.log(
        `[d2-bot:audit-levels] Preparing bot character "${auditCharName}" on account "${botAcc.username}"...`,
      )
      await prepFlow.loginOrRegister(botAcc.username, botAcc.password, { register: true })
      const chars = await prepFlow.enterRealm(accountsFile.realm)
      const exists = chars.some(c => c.name.toLowerCase() === auditCharName.toLowerCase())
      if (!exists) {
        await prepFlow.createCharacter({
          name: auditCharName,
          classId: botAcc.charClass,
          expansion: true,
          hardcore: false,
          ladder: true,
        })
        console.log(`[d2-bot:audit-levels] Created character "${auditCharName}"`)
      }
      await prepFlow.selectCharacter(auditCharName)
      const prepGame = `wba${Math.floor(Date.now() / 1000).toString(36).slice(-5)}`
      await prepFlow.createGame({
        name: prepGame,
        password: '',
        description: 'd2s prep',
        difficulty: 0,
        maxPlayers: 8,
      })
      const adapter = await prepFlow.joinGame(prepGame, '')
      await sleep(1000)
      adapter.leave()
      await sleep(600)
    } finally {
      await prepFlow.close()
    }
    // Wait for d2dbs to flush the 980-byte v96 .d2s save to disk
    await sleep(1500)
  }

  const localSaveDir = resolve(ROOT_DIR, 'scratch/charsave')
  mkdirSync(localSaveDir, { recursive: true })
  const localSavePath = resolve(localSaveDir, auditCharName.toLowerCase())
  if (!existsSync(localSavePath)) {
    writeFileSync(localSavePath, createSyntheticBotD2sBuffer(auditCharName))
  }
  const localUnlock = unlockLocalD2sFile(localSavePath, { progression: 15 })
  console.log(
    `[d2-bot:audit-levels] Verified local .d2s unlock: file=${localUnlock.filePath} backup=${localUnlock.backupPath} checksum=0x${(localUnlock.verification.actualChecksum >>> 0).toString(16)} allUnlocked=${localUnlock.verification.allUnlocked}`,
  )

  const isSshAuthUnavailableError = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err)
    const stderr =
      err && typeof err === 'object' && 'stderr' in err && err.stderr != null
        ? String(err.stderr)
        : ''
    const combined = `${msg}\n${stderr}`
    return /Permission denied|ControlPath|ControlSocket|publickey,password|Connection refused|Connection timed out/i.test(
      combined,
    )
  }

  let remoteUnlock: ReturnType<typeof unlockRemotePvpgnCharSave> | null = null
  try {
    remoteUnlock = unlockRemotePvpgnCharSave(auditCharName, {
      host: bnetHost,
      progression: 15,
    })
  } catch (err) {
    if (isSshAuthUnavailableError(err)) {
      console.log(
        '[d2-bot:audit-levels] SSH ControlMaster inactive; verifying server-side .d2s unlock directly via live D2GS 0x63 WaypointMenu (requires 39/39 unlocked waypoints)...',
      )
    } else {
      await runBootstrapPrepGame()
      remoteUnlock = unlockRemotePvpgnCharSave(auditCharName, {
        host: bnetHost,
        progression: 15,
      })
    }
  }
  if (remoteUnlock !== null) {
    if (!remoteUnlock.verification.allUnlocked) {
      throw new Error(
        `[d2-bot:audit-levels] Remote .d2s unlock verification failed for ${auditCharName}`,
      )
    }
    console.log(
      `[d2-bot:audit-levels] Unlocked remote PvPGN charsave: ${remoteUnlock.remotePath} (backup: ${remoteUnlock.backupPath}) checksum=0x${(remoteUnlock.verification.actualChecksum >>> 0).toString(16)} allUnlocked=${remoteUnlock.verification.allUnlocked}`,
    )
  }

  const verifyRes = verifyD2sUnlocked(new Uint8Array(readFileSync(localSavePath)))
  if (!verifyRes.allUnlocked) {
    throw new Error(`[d2-bot:audit-levels] .d2s unlock verification failed for ${auditCharName}`)
  }

  const mapService = await MapService.fromPackedDir(resolve(ROOT_DIR, 'public/act-packs/tiles'))
  const auditFlow = createD2OnlineFlow({
    resolver: buildResolver(via, bnetHost, wsHost),
    bnetHost,
    defaultRealm: accountsFile.realm,
    itemTables: tables,
    tap,
  })

  try {
    await auditFlow.loginOrRegister(botAcc.username, botAcc.password, { register: true })
    await auditFlow.enterRealm(accountsFile.realm)
    await auditFlow.selectCharacter(auditCharName)

    const gameName = `wbl${Math.floor(Date.now() / 1000).toString(36).slice(-5)}`
    await auditFlow.createGame({
      name: gameName,
      password: '',
      description: 'd2-bot audit-levels',
      difficulty: 0,
      maxPlayers: 8,
    })
    const adapter = await auditFlow.joinGame(gameName, '')
    const world = new ClientWorld()

    let liveSeed = 0
    let currentAreaId = 1
    let currentActIndex: 0 | 1 | 2 | 3 | 4 = 0
    let lastWaypointMenuUnitId = 0
    let waypointMenuSeq = 0
    let playerReassignSeq = 0

    const revealedRooms: {
      readonly act: 0 | 1 | 2 | 3 | 4
      readonly areaId: number
      readonly tileX: number
      readonly tileY: number
    }[] = []
    const revealedAreaIds = new Set<number>()
    const revealedAreasByAct = new Map<number, Set<number>>([
      [0, new Set([1])],
      [1, new Set()],
      [2, new Set()],
      [3, new Set()],
      [4, new Set()],
    ])
    const liveAssignedUnits: {
      readonly act: 0 | 1 | 2 | 3 | 4
      readonly areaIdHint: number
      readonly unitType: string
      readonly id: number
      readonly classId: number
      readonly x: number
      readonly y: number
    }[] = []
    const waypointObjectsByAct = new Map<
      number,
      Map<number, { id: number; classId: number; x: number; y: number; mode: number }>
    >([
      [0, new Map()],
      [1, new Map()],
      [2, new Map()],
      [3, new Map()],
      [4, new Map()],
    ])

    adapter.onEvent((ev) => {
      world.apply(ev)
      if (ev.type === 'LoadAct') {
        liveSeed = ev.mapSeed >>> 0
        currentActIndex = (ev.act >= 0 && ev.act <= 4 ? ev.act : 0) as 0 | 1 | 2 | 3 | 4
        waypointObjectsByAct.get(currentActIndex)?.clear()
        if (ev.areaId > 0) {
          currentAreaId = ev.areaId
          revealedAreaIds.add(ev.areaId)
          revealedAreasByAct.get(currentActIndex)?.add(ev.areaId)
        }
        mapService.onLoadActPacket(
          { act: ev.act, mapSeed: ev.mapSeed, areaId: ev.areaId || currentAreaId },
          { difficulty: world.difficulty, revealMode: 'all' },
        )
      } else if (ev.type === 'RoomReveal') {
        const roomAct = getActIndexForAreaId(ev.areaId)
        currentActIndex = roomAct
        revealedRooms.push({
          act: roomAct,
          areaId: ev.areaId,
          tileX: ev.tileX,
          tileY: ev.tileY,
        })
        revealedAreaIds.add(ev.areaId)
        revealedAreasByAct.get(roomAct)?.add(ev.areaId)
        if (mapService.getActiveAct() === roomAct && liveSeed !== 0) {
          mapService.onAddRoomDataPacket({
            roomX: ev.tileX,
            roomY: ev.tileY,
            areaId: ev.areaId,
          })
        }
      } else if (ev.type === 'UnitAssign') {
        const uType =
          typeof ev.unit.unitType === 'number'
            ? (['player', 'monster', 'object', 'missile', 'item', 'tile'][ev.unit.unitType] ??
              'player')
            : ev.unit.unitType
        if (uType === 'player' && (ev.isSelf || ev.unit.id === world.selfId)) {
          playerReassignSeq++
        }
        if (ev.unit.x > 0 || ev.unit.y > 0) {
          liveAssignedUnits.push({
            act: currentActIndex,
            areaIdHint: currentAreaId,
            unitType: uType,
            id: ev.unit.id,
            classId: ev.unit.classId,
            x: ev.unit.x,
            y: ev.unit.y,
          })
        }
        if (uType === 'object' && WAYPOINT_OBJECT_CLASS_IDS.has(ev.unit.classId)) {
          waypointObjectsByAct.get(currentActIndex)?.set(ev.unit.id, {
            id: ev.unit.id,
            classId: ev.unit.classId,
            x: ev.unit.x,
            y: ev.unit.y,
            mode: ev.unit.mode ?? 0,
          })
        }
      } else if (ev.type === 'UnitMode') {
        const wpMap = waypointObjectsByAct.get(currentActIndex)
        const existingWp = wpMap?.get(ev.id)
        if (existingWp && ev.mode !== undefined) {
          existingWp.mode = ev.mode
        }
      } else if (
        ev.type === 'UnitReassign' &&
        (ev.unitType === 'player' || ev.unitType === 0) &&
        (ev.id === world.selfId || world.selfId === 0)
      ) {
        playerReassignSeq++
      } else if (ev.type === 'WaypointMenu') {
        lastWaypointMenuUnitId = ev.unitId
        waypointMenuSeq++
      }
    })

    const waitStart = Date.now()
    while ((world.loading || liveSeed === 0) && Date.now() - waitStart < 6000) {
      await sleep(80)
    }
    await sleep(350)

    printWorldSummary(world, adapter, '[d2-bot:audit-levels:entered]')

    if (liveSeed === 0) {
      throw new Error('[d2-bot:audit-levels] Expected non-zero mapSeed from live D2GS 0x03 LoadAct')
    }

    const levelViewCache = new Map<number, LevelView>()
    const getLevelViewForArea = (areaId: number): LevelView => {
      const cached = levelViewCache.get(areaId)
      if (cached) return cached
      const actIdx = getActIndexForAreaId(areaId)
      if (mapService.getActiveAct() !== actIdx || mapService.getActiveSeed() !== liveSeed) {
        mapService.loadAct({ act: actIdx, seed: liveSeed, difficulty: world.difficulty })
      }
      const lv = mapService.getLevelView(areaId, 'all')
      levelViewCache.set(areaId, lv)
      return lv
    }

    let curX = world.self.x
    let curY = world.self.y

    const findNearestWaypointInAct = (
      actIdx: 0 | 1 | 2 | 3 | 4,
      refX: number,
      refY: number,
      maxDist = Infinity,
    ): { id: number; classId: number; x: number; y: number; mode: number } | null => {
      const wpMap = waypointObjectsByAct.get(actIdx)
      if (!wpMap || wpMap.size === 0) return null
      let best: { id: number; classId: number; x: number; y: number; mode: number } | null = null
      let bestDist = maxDist
      for (const wp of wpMap.values()) {
        const d = Math.hypot(wp.x - refX, wp.y - refY)
        if (d <= bestDist) {
          bestDist = d
          best = wp
        }
      }
      return best
    }

    const walkAlongLevelTo = async (
      lv: LevelView,
      targetX: number,
      targetY: number,
      stopDist = 3.5,
    ): Promise<void> => {
      const dist0 = Math.hypot(targetX - curX, targetY - curY)
      if (dist0 <= stopDist) return
      const pathRes = findPathWorld(lv, curX, curY, targetX, targetY, {
        smooth: true,
        nearestTargetRadius: 8,
        maxExpandedNodes: 16384,
      })
      const waypoints: readonly SubTilePoint[] =
        pathRes.path.length >= 2
          ? pathRes.path
          : [
              { x: curX, y: curY },
              { x: targetX, y: targetY },
            ]
      const hops = subdividePathHops(waypoints, 3.5)
      for (const hop of hops) {
        if (Math.hypot(targetX - curX, targetY - curY) <= stopDist) break
        adapter.send({ type: 'Move', run: true, to: { x: hop.x, y: hop.y } })
        curX = hop.x
        curY = hop.y
        await sleep(200)
      }
      await sleep(220)
    }

    const openWaypointMenu = async (wp: {
      id: number
      classId: number
      x: number
      y: number
    }): Promise<void> => {
      for (let attempt = 1; attempt <= 4; attempt++) {
        const prevSeq = waypointMenuSeq
        adapter.send({
          type: 'Interact',
          target: { unitType: 'object', id: wp.id },
        })
        const waitMenuStart = Date.now()
        while (Date.now() - waitMenuStart < 650) {
          if (waypointMenuSeq > prevSeq && lastWaypointMenuUnitId === wp.id) {
            return
          }
          await sleep(40)
        }
      }
      throw new Error(
        `[d2-bot:audit-levels] Failed to receive 0x63 WaypointMenu after interacting with waypoint #${wp.id} (class=${wp.classId}) at (${wp.x},${wp.y}) from player (${curX},${curY})`,
      )
    }

    // 1. In the starting town (e.g. areaId = 1), locate and walk to the town waypoint
    const entryAreaId = world.areaId || currentAreaId || 1
    const entryActIdx = getActIndexForAreaId(entryAreaId)
    currentAreaId = entryAreaId
    currentActIndex = entryActIdx

    const townView = getLevelViewForArea(entryAreaId)
    let currentWp = findNearestWaypointInAct(entryActIdx, curX, curY)
    if (!currentWp) {
      const presetWp = townView.presetUnits.find(
        pu => pu.type === 2 && WAYPOINT_OBJECT_CLASS_IDS.has(pu.index),
      )
      if (presetWp) {
        const wpWorld = localToWorldSubTile(townView, presetWp.subX, presetWp.subY)
        await walkAlongLevelTo(townView, wpWorld.worldSubX, wpWorld.worldSubY, 3.5)
      }
      currentWp = findNearestWaypointInAct(entryActIdx, curX, curY)
    }
    if (!currentWp) {
      throw new Error(
        `[d2-bot:audit-levels] Could not locate starting town waypoint in areaId=${entryAreaId}`,
      )
    }

    await walkAlongLevelTo(townView, currentWp.x, currentWp.y, 3.5)
    await openWaypointMenu(currentWp)

    console.log(
      `[d2-bot:audit-levels] Opened WaypointMenu at area=${entryAreaId} wp=#${currentWp.id}(class=${currentWp.classId}) unlockedWaypoints=${world.waypoints.size}/39`,
    )
    if (world.waypoints.size < 39) {
      throw new Error(
        `[d2-bot:audit-levels] Expected all 39 waypoints unlocked in 0x63 WaypointMenu, got ${world.waypoints.size}` +
          (remoteUnlock === null
            ? ` (server-side .d2s for ${auditCharName} on ${bnetHost} is not unlocked; start SSH ControlMaster socket /tmp/d2host-ssh.sock or set D2HOST_PW to unlock it)`
            : ''),
      )
    }

    const actsVisited = new Set<number>([entryActIdx + 1])
    const waypointsVisited = new Set<number>([entryAreaId])

    const tourAreas = [
      ...(entryAreaId === 1 ? DEFAULT_AUDIT_WAYPOINT_TOUR.slice(1) : DEFAULT_AUDIT_WAYPOINT_TOUR),
      1,
    ]

    // 2. Chain live 0x49 WaypointGo teleports across all 5 Acts and return to Rogue Encampment (1)
    for (const destAreaId of tourAreas) {
      if (destAreaId === currentAreaId) continue
      const destActIdx = getActIndexForAreaId(destAreaId)
      if (lastWaypointMenuUnitId !== currentWp.id) {
        const curLv = getLevelViewForArea(currentAreaId)
        await walkAlongLevelTo(curLv, currentWp.x, currentWp.y, 3.5)
        await openWaypointMenu(currentWp)
      }

      const prevReassignSeq = playerReassignSeq
      currentAreaId = destAreaId
      adapter.send({
        type: 'WaypointGo',
        waypointId: currentWp.id,
        destAreaId,
      })

      const tpStart = Date.now()
      while (Date.now() - tpStart < 6000) {
        if (revealedAreaIds.has(destAreaId) && playerReassignSeq > prevReassignSeq) {
          break
        }
        await sleep(60)
      }
      await sleep(300)

      if (!revealedAreaIds.has(destAreaId)) {
        throw new Error(
          `[d2-bot:audit-levels] WaypointGo to areaId=${destAreaId} (Act ${destActIdx + 1}) did not receive 0x07 RoomReveal`,
        )
      }

      curX = world.self.x
      curY = world.self.y
      const destLv = getLevelViewForArea(destAreaId)

      let destWp = findNearestWaypointInAct(destActIdx, curX, curY, 45)
      if (!destWp) {
        const presetWp = destLv.presetUnits.find(
          pu => pu.type === 2 && WAYPOINT_OBJECT_CLASS_IDS.has(pu.index),
        )
        if (presetWp) {
          const wpWorld = localToWorldSubTile(destLv, presetWp.subX, presetWp.subY)
          await walkAlongLevelTo(destLv, wpWorld.worldSubX, wpWorld.worldSubY, 3.5)
          destWp = findNearestWaypointInAct(destActIdx, curX, curY, 45)
        }
      }
      if (!destWp) {
        throw new Error(
          `[d2-bot:audit-levels] Missing destination waypoint object (0x51) after teleporting to areaId=${destAreaId} (Act ${destActIdx + 1})`,
        )
      }

      if (Math.hypot(destWp.x - curX, destWp.y - curY) > 3.5) {
        await walkAlongLevelTo(destLv, destWp.x, destWp.y, 3.5)
      }

      actsVisited.add(destActIdx + 1)
      waypointsVisited.add(destAreaId)
      currentWp = destWp
      lastWaypointMenuUnitId = 0

      console.log(
        `[d2-bot:audit-levels:hop] act=${destActIdx + 1} areaId=${destAreaId} pos=(${curX},${curY}) wp=#${destWp.id}(class=${destWp.classId},at=${destWp.x},${destWp.y}) totalRevealedRooms=${revealedRooms.length}`,
      )
    }

    // 3. Audit all live 0x07 RoomReveal rooms and 0x51/0xAC/0x09 UnitAssign packets across Acts 1-5
    let liveRoomsAudited = 0
    let liveUnitsAudited = 0
    let outOfBoundsUnits = 0
    let voidSpawnCollisions = 0

    for (const r of revealedRooms) {
      const lv = getLevelViewForArea(r.areaId)
      const inBounds =
        r.tileX >= lv.tileOriginX - 16 &&
        r.tileX <= lv.tileOriginX + lv.tileWidth + 16 &&
        r.tileY >= lv.tileOriginY - 16 &&
        r.tileY <= lv.tileOriginY + lv.tileHeight + 16
      if (!inBounds) {
        throw new Error(
          `[d2-bot:audit-levels] Server RoomReveal (${r.tileX},${r.tileY}) out of bounds for area ${r.areaId} (Act ${r.act + 1})`,
        )
      }
      liveRoomsAudited++
    }

    for (const u of liveAssignedUnits) {
      if (u.x <= 0 && u.y <= 0) continue
      let matchedView: LevelView | null = null
      const candidateAreas = new Set<number>([
        u.areaIdHint,
        ...(revealedAreasByAct.get(u.act) ?? []),
      ])
      for (const areaId of candidateAreas) {
        if (areaId <= 0) continue
        const lv = getLevelViewForArea(areaId)
        if (
          u.x >= lv.subOriginX &&
          u.x < lv.subOriginX + lv.subWidth &&
          u.y >= lv.subOriginY &&
          u.y < lv.subOriginY + lv.subHeight
        ) {
          matchedView = lv
          break
        }
      }
      if (!matchedView) {
        outOfBoundsUnits++
        console.warn(
          `[d2-bot:audit-levels] Unit ${u.unitType}#${u.id} (class=${u.classId}, act=${u.act + 1}) at (${u.x},${u.y}) outside loaded level bounds`,
        )
      } else {
        liveUnitsAudited++
        if (u.unitType === 'player') {
          const coll = getCollisionWorldSubTile(matchedView, u.x, u.y)
          if ((coll & COLLIDE_MASK_INVALID) === COLLIDE_MASK_INVALID) {
            voidSpawnCollisions++
          }
        }
      }
    }

    // 4. Full 136-level DRLG structural & connectivity audit across Acts 1-5 using the live seed
    const actLevelRanges: readonly { readonly act: number; readonly start: number; readonly end: number }[] = [
      { act: 0, start: 1, end: 39 },
      { act: 1, start: 40, end: 74 },
      { act: 2, start: 75, end: 102 },
      { act: 3, start: 103, end: 108 },
      { act: 4, start: 109, end: 136 },
    ]

    let levelsVerified = 0
    let totalPresetUnitsVerified = 0
    let totalWarpsVerified = 0
    let totalRoomsVerified = 0

    for (const range of actLevelRanges) {
      mapService.loadAct({ act: range.act, seed: liveSeed, difficulty: world.difficulty })
      for (let areaId = range.start; areaId <= range.end; areaId++) {
        const lv = mapService.getLevelView(areaId, 'all')
        if (lv.rooms.length === 0 || lv.walkableCellCount === 0) {
          throw new Error(
            `[d2-bot:audit-levels] Level ${areaId} (Act ${range.act + 1}) has rooms=${lv.rooms.length}, walkable=${lv.walkableCellCount}`,
          )
        }

        let spawnWalkable = false
        for (let dy = -2; dy <= 7 && !spawnWalkable; dy++) {
          for (let dx = -2; dx <= 7; dx++) {
            const sx = lv.spawnX * 5 + dx
            const sy = lv.spawnY * 5 + dy
            if (
              isWalkableLocalSubTile(lv, sx, sy) &&
              (getCollisionLocalSubTile(lv, sx, sy) & COLLIDE_MASK_INVALID) !== COLLIDE_MASK_INVALID
            ) {
              spawnWalkable = true
              break
            }
          }
        }
        if (!spawnWalkable) {
          voidSpawnCollisions++
          throw new Error(`[d2-bot:audit-levels] Level ${areaId} spawn (${lv.spawnX},${lv.spawnY}) is solid void`)
        }

        for (const pu of lv.presetUnits) {
          if (pu.subX < 0 || pu.subX >= lv.subWidth || pu.subY < 0 || pu.subY >= lv.subHeight) {
            outOfBoundsUnits++
          } else {
            totalPresetUnitsVerified++
          }
        }
        for (const warp of lv.warps) {
          if (warp.room < 0 || warp.room >= lv.rooms.length || warp.toLevelId <= 0) {
            outOfBoundsUnits++
          } else {
            totalWarpsVerified++
          }
        }

        totalRoomsVerified += lv.rooms.length
        levelsVerified++
      }
    }

    console.log(
      `[d2-bot:audit-levels:summary] liveSeed=0x${liveSeed.toString(16).padStart(8, '0')} actsVisited=${actsVisited.size}/5 waypointsVisited=${waypointsVisited.size} levelsVerified=${levelsVerified}/136 totalRooms=${totalRoomsVerified} presetUnits=${totalPresetUnitsVerified} warps=${totalWarpsVerified} liveRoomsAudited=${liveRoomsAudited} liveUnitsAudited=${liveUnitsAudited} outOfBoundsUnits=${outOfBoundsUnits} voidSpawnCollisions=${voidSpawnCollisions}`,
    )

    adapter.leave()
    await sleep(300)

    if (
      actsVisited.size < 5 ||
      waypointsVisited.size < 10 ||
      liveRoomsAudited < 50 ||
      levelsVerified !== 136 ||
      liveUnitsAudited === 0 ||
      outOfBoundsUnits > 0 ||
      voidSpawnCollisions > 0
    ) {
      throw new Error(
        `[d2-bot:audit-levels] Audit failed: actsVisited=${actsVisited.size}/5 waypointsVisited=${waypointsVisited.size} levels=${levelsVerified}/136 liveRooms=${liveRoomsAudited} liveUnits=${liveUnitsAudited} outOfBounds=${outOfBoundsUnits} voidCollisions=${voidSpawnCollisions}`,
      )
    }
  } finally {
    await auditFlow.close()
  }
}

async function main(): Promise<void> {
  const { cmd, flags } = parseArgs(process.argv.slice(2))
  const via = ((typeof flags.via === 'string' ? flags.via : 'mixed') as 'mixed' | 'wss' | 'tcp')
  const bnetHost =
    typeof flags.host === 'string' ? flags.host : (process.env.D2_BNET_HOST ?? 'www.laiseek.xyz')
  const wsHost = typeof flags['ws-host'] === 'string' ? flags['ws-host'] : 'www.laiseek.xyz'
  const showWorld = Boolean(flags.world)
  const capturePath = typeof flags.capture === 'string' ? resolve(flags.capture) : undefined
  const scenario = typeof flags.scenario === 'string' ? flags.scenario : 'full'

  const accountsFile = loadOrInitBotAccounts(bnetHost)
  const defaultAccountKey = cmd === 'walk' || cmd === 'audit-levels' ? 'd2webbot2' : 'd2webbot1'
  const accountKey = typeof flags.account === 'string' ? flags.account : defaultAccountKey
  let accountRec = accountsFile.accounts[accountKey]
  if (!accountRec) {
    accountRec = {
      username: accountKey,
      password: typeof flags.password === 'string' ? flags.password : `d2w_${randomBytes(6).toString('hex')}`,
      defaultChar: typeof flags.char === 'string' ? flags.char : `${accountKey}c`,
      charClass: (typeof flags.class === 'string' ? Number(flags.class) : 1) as CharClassId,
      createdAt: new Date().toISOString(),
    }
    accountsFile.accounts[accountKey] = accountRec
    saveBotAccounts(accountsFile)
  }

  const charName = typeof flags.char === 'string' ? flags.char : accountRec.defaultChar
  const charClass = (typeof flags.class === 'string' ? Number(flags.class) : accountRec.charClass) as CharClassId

  const tap = new InMemoryPacketTap(50_000)
  const tables = getCanonicalItemDataTables()

  let captureWritten = false
  const writeCaptureIfRequested = (scenLabel: string): void => {
    if (!capturePath || captureWritten) return
    captureWritten = true
    mkdirSync(dirname(capturePath), { recursive: true })
    const jsonl = tap.toD2CapJsonl({
      format: 'd2cap-v1',
      createdAt: new Date().toISOString(),
      server: `${bnetHost} (via=${via})`,
      account: '<redacted>',
      character: charName,
      scenario: scenLabel,
    })
    writeFileSync(capturePath, jsonl, 'utf8')
    console.log(`[d2-bot] Saved capture (${tap.entries.length} packets) -> ${capturePath}`)
  }

  if (cmd === 'register') {
    const targets =
      typeof flags.account === 'string'
        ? [accountRec]
        : Object.values(accountsFile.accounts)

    for (const acc of targets) {
      const flow = createD2OnlineFlow({
        resolver: buildResolver(via, bnetHost, wsHost),
        bnetHost,
        defaultRealm: accountsFile.realm,
        itemTables: tables,
        tap,
      })
      try {
        console.log(`[d2-bot] Registering/verifying account "${acc.username}" via ${via}...`)
        await flow.loginOrRegister(acc.username, acc.password, { register: true })
        const chars = await flow.enterRealm(accountsFile.realm)
        console.log(
          `[d2-bot] Account "${acc.username}" authenticated on realm "${accountsFile.realm}" (${chars.length} chars)`,
        )
        const hasChar = chars.some(c => c.name.toLowerCase() === acc.defaultChar.toLowerCase())
        if (!hasChar) {
          console.log(`[d2-bot] Creating default character "${acc.defaultChar}" (class=${acc.charClass})...`)
          await flow.createCharacter({
            name: acc.defaultChar,
            classId: acc.charClass,
            expansion: true,
            hardcore: false,
            ladder: true,
          })
          console.log(`[d2-bot] Created character "${acc.defaultChar}".`)
        }
      } finally {
        await flow.close()
      }
    }
    saveBotAccounts(accountsFile)
    writeCaptureIfRequested('register')
    return
  }

  if (cmd === 'audit-levels') {
    await runAuditLevelsSubcommand({
      via,
      bnetHost,
      wsHost,
      accountsFile,
      tables,
      tap,
    })
    writeCaptureIfRequested('audit-levels')
    return
  }

  const bncsKeepaliveIntervalMs =
    typeof flags['bncs-keepalive-ms'] === 'string'
      ? Number(flags['bncs-keepalive-ms'])
      : undefined

  const flow = createD2OnlineFlow({
    resolver: buildResolver(via, bnetHost, wsHost),
    bnetHost,
    defaultRealm: accountsFile.realm,
    itemTables: tables,
    tap,
    ...(bncsKeepaliveIntervalMs !== undefined ? { bncsKeepaliveIntervalMs } : {}),
  })

  try {
    console.log(`[d2-bot] Connecting to ${bnetHost} (via=${via}) as "${accountRec.username}"...`)
    await flow.loginOrRegister(accountRec.username, accountRec.password, { register: true })

    if (cmd === 'login') {
      const realms = await flow.listRealms()
      console.log(`[d2-bot] Logged in. Realms:`, realms)
      const chars = await flow.enterRealm(accountsFile.realm)
      console.log(`[d2-bot] Entered realm "${accountsFile.realm}", characters (${chars.length}):`, chars.map(c => c.name))
      writeCaptureIfRequested('login')
      return
    }

    const chars = await flow.enterRealm(accountsFile.realm)

    if (cmd === 'chars') {
      console.log(
        `[d2-bot] Characters (${chars.length}):`,
        chars.map(c => ({
          name: c.name,
          class: c.charClass,
          level: c.level,
          exp: c.expansion,
          hc: c.hardcore,
          ladder: c.ladder,
        })),
      )
      writeCaptureIfRequested('chars')
      return
    }

    if (cmd === 'create-char') {
      const exists = chars.some(c => c.name.toLowerCase() === charName.toLowerCase())
      if (!exists) {
        await flow.createCharacter({
          name: charName,
          classId: charClass,
          expansion: true,
          hardcore: false,
          ladder: true,
        })
        console.log(`[d2-bot] Created character "${charName}" (class=${charClass})`)
      } else {
        console.log(`[d2-bot] Character "${charName}" already exists`)
      }
      writeCaptureIfRequested('create-char')
      return
    }

    if (cmd === 'lobby-idle') {
      const idleSec = typeof flags.idle === 'string' ? Math.max(1, Number(flags.idle)) : 190
      console.log(
        `[d2-bot:lobby-idle] Entered realm "${accountsFile.realm}" (state=${flow.state}, chars=${chars.length}). Idling ${idleSec}s on character screen...`,
      )
      const startMs = Date.now()
      const endAt = startMs + idleSec * 1000
      let nextLogAt = startMs + 15_000
      while (Date.now() < endAt && flow.sessionLost === null) {
        await sleep(250)
        if (Date.now() >= nextLogAt) {
          const elapsedSec = Math.round((Date.now() - startMs) / 1000)
          const c2sNulls = tap.entries.filter(e => e.packetName === 'SID_NULL' && e.dir === 'c2s').length
          const s2cNulls = tap.entries.filter(e => e.packetName === 'SID_NULL' && e.dir === 's2c').length
          console.log(
            `[d2-bot:lobby-idle] elapsed=${elapsedSec}s/${idleSec}s state=${flow.state} sessionLost=null c2s_SID_NULL=${c2sNulls} s2c_SID_NULL=${s2cNulls}`,
          )
          nextLogAt = Date.now() + 15_000
        }
      }
      if (flow.sessionLost !== null) {
        throw new Error(`[d2-bot:lobby-idle] Session lost during idle: ${flow.sessionLost.message}`)
      }
      const c2sNulls = tap.entries.filter(e => e.packetName === 'SID_NULL' && e.dir === 'c2s').length
      const s2cNulls = tap.entries.filter(e => e.packetName === 'SID_NULL' && e.dir === 's2c').length
      console.log(
        `[d2-bot:lobby-idle] Idle complete (${idleSec}s): c2s_SID_NULL=${c2sNulls} s2c_SID_NULL=${s2cNulls}. Verifying listChars & createGame...`,
      )
      const refreshedChars = await flow.listCharacters()
      console.log(
        `[d2-bot:lobby-idle] listCharacters() succeeded (${refreshedChars.length} chars):`,
        refreshedChars.map(c => c.name),
      )
      const hasChar = refreshedChars.some(c => c.name.toLowerCase() === charName.toLowerCase())
      if (!hasChar) {
        await flow.createCharacter({
          name: charName,
          classId: charClass,
          expansion: true,
          hardcore: false,
          ladder: true,
        })
      }
      await flow.selectCharacter(charName)
      await flow.enterChat()
      const idleGameName = `wbi${Math.floor(Date.now() / 1000).toString(36).slice(-5)}`
      await flow.createGame({
        name: idleGameName,
        password: '',
        description: 'lobby-idle verify',
        difficulty: 0,
        maxPlayers: 8,
      })
      const activeGames = await flow.listGames('')
      console.log(
        `[d2-bot:lobby-idle] createGame("${idleGameName}") & listGames() succeeded (activeGames=${activeGames.length}, sessionLost=${flow.sessionLost})`,
      )
      writeCaptureIfRequested('lobby-idle')
      return
    }

    // Ensure target character exists and select it
    const hasTargetChar = chars.some(c => c.name.toLowerCase() === charName.toLowerCase())
    if (!hasTargetChar) {
      console.log(`[d2-bot] Creating character "${charName}" (class=${charClass})...`)
      await flow.createCharacter({
        name: charName,
        classId: charClass,
        expansion: true,
        hardcore: false,
        ladder: true,
      })
    }
    await flow.selectCharacter(charName)
    console.log(`[d2-bot] Selected character "${charName}"`)

    if (cmd === 'games') {
      const games = await flow.listGames('')
      console.log(`[d2-bot] Active games (${games.length}):`, games)
      writeCaptureIfRequested('games')
      return
    }

    const gameName =
      typeof flags.game === 'string'
        ? flags.game
        : `wb${Math.floor(Date.now() / 1000)
            .toString(36)
            .slice(-5)}`
    const gamePass = typeof flags.pass === 'string' ? flags.pass : ''

    if (cmd === 'create-game') {
      await flow.createGame({
        name: gameName,
        password: gamePass,
        description: 'd2-bot test',
        difficulty: 0,
        maxPlayers: 8,
      })
      console.log(`[d2-bot] Created game "${gameName}"`)
      writeCaptureIfRequested('create-game')
      return
    }

    if (cmd === 'join' || cmd === 'idle' || cmd === 'record' || cmd === 'walk') {
      const shouldCreate =
        Boolean(flags['create-game']) || typeof flags.game !== 'string' || cmd === 'record' || cmd === 'walk'
      if (shouldCreate) {
        console.log(`[d2-bot] Creating game "${gameName}"...`)
        await flow.createGame({
          name: gameName,
          password: gamePass,
          description: `d2-bot ${cmd}`,
          difficulty: 0,
          maxPlayers: 8,
        })
      }

      const mapService =
        cmd === 'walk' || (cmd === 'record' && isVendorScenario(scenario))
          ? await MapService.fromPackedDir(resolve(ROOT_DIR, 'public/act-packs/tiles'))
          : null

      console.log(`[d2-bot] Joining game "${gameName}"...`)
      const adapter = await flow.joinGame(gameName, gamePass)
      const world = new ClientWorld()

      adapter.onEvent((ev) => {
        world.apply(ev)
        if (mapService) {
          if (ev.type === 'LoadAct') {
            mapService.onLoadActPacket(
              { act: ev.act, mapSeed: ev.mapSeed, areaId: ev.areaId || 1 },
              { difficulty: world.difficulty, revealMode: 'all' },
            )
          } else if (ev.type === 'RoomReveal') {
            mapService.onAddRoomDataPacket({
              roomX: ev.tileX,
              roomY: ev.tileY,
              areaId: ev.areaId,
            })
          } else if (ev.type === 'RoomHide') {
            mapService.onRemoveRoomDataPacket({
              roomX: ev.tileX,
              roomY: ev.tileY,
              areaId: ev.areaId,
            })
          }
        }
      })

      // Wait briefly for initial load burst to settle
      const waitStart = Date.now()
      while (world.loading && Date.now() - waitStart < 5000) {
        await sleep(100)
      }

      if (showWorld || cmd === 'join' || cmd === 'idle' || cmd === 'record' || cmd === 'walk') {
        printWorldSummary(world, adapter, '[d2-bot:entered]')
      }

      if (cmd === 'walk' && mapService) {
        await sleep(300)
        await runWalkSubcommand(world, adapter, mapService)
        printWorldSummary(world, adapter, '[d2-bot:final]')
        adapter.leave()
        await sleep(300)
        writeCaptureIfRequested('walk')
        return
      }

      if (cmd === 'record') {
        console.log(`[d2-bot] Running scenario="${scenario}"...`)
        if (isVendorScenario(scenario)) {
          if (!mapService) throw new Error('vendor scenarios require the MapService')
          const report = await runVendorScenario(scenario, world, adapter, mapService)
          console.log(`[d2-bot] vendor report: ${JSON.stringify(report)}`)
          if (typeof flags.report === 'string') {
            const reportPath = resolve(flags.report)
            mkdirSync(dirname(reportPath), { recursive: true })
            writeFileSync(reportPath, JSON.stringify({ scenario, account: '<redacted>', character: charName, report }, null, 2))
          }
        } else {
          await runInGameScenario(scenario, world, adapter)
        }
      }

      const defaultIdleSec = cmd === 'idle' ? 60 : cmd === 'record' ? 6 : 5
      const idleSec =
        typeof flags.idle === 'string' ? Math.max(1, Number(flags.idle)) : defaultIdleSec

      console.log(`[d2-bot] Remaining in game "${gameName}" for ${idleSec}s...`)
      const endAt = Date.now() + idleSec * 1000
      let nextLogAt = Date.now() + 10_000
      while (Date.now() < endAt && adapter.state !== 'closed') {
        await sleep(250)
        world.tick()
        if (Date.now() >= nextLogAt) {
          printWorldSummary(world, adapter, '[d2-bot:tick]')
          nextLogAt = Date.now() + 10_000
        }
      }

      printWorldSummary(world, adapter, '[d2-bot:final]')
      adapter.leave()
      await sleep(300)
      writeCaptureIfRequested(cmd === 'record' ? scenario : cmd)
      return
    }

    console.error(`Unknown d2-bot command: "${cmd}"`)
    process.exit(1)
  } finally {
    await flow.close()
    writeCaptureIfRequested(cmd)
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (isMain) {
  main().catch((err) => {
    console.error('[d2-bot] FATAL:', err)
    process.exit(1)
  })
}
