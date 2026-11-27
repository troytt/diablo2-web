/**
 * Walk the baked world the way a player would, without a browser.
 *
 * `verify-packs` proves every opening in the pack corresponds to an edge in the
 * world graph and that no edge was left uncut. That is a statement about
 * bookkeeping. It says nothing about whether the openings are somewhere a
 * player can actually reach: a staircase walled off behind a cliff satisfies
 * every count and still ends the game.
 *
 * This script closes that gap by replaying the runtime's own rules against the
 * pack:
 *
 *   - the copy loaded for a destination comes from `WorldVariants`
 *     (`src/game/act-variants.ts`), the same object `loadRuntimeForLevel` asks:
 *     one generated copy per act for DRLG acts (the town file that copy fixed
 *     included), one copy per level otherwise, preferring the copy whose opening
 *     faces the side the player arrives from; the walk starts where a fresh
 *     session starts (`startEntry`);
 *   - the landing spot is the destination's own opening back to where we came
 *     from, exactly as `travel` does;
 *   - a link fires when the player is within `SEAM_TRIGGER_SUBTILES` or
 *     `WARP_TRIGGER_SUBTILES` of it, using the constants the scene imports.
 *
 * Two passes run:
 *
 *   1. **The acceptance route.** Rogue Encampment → Blood Moor → Cold Plains →
 *      Cave Level 1 → Cave Level 2, then the Cold Plains waypoint home. Every
 *      hop asserts that the exit is reachable on foot from where the previous
 *      hop dropped us, and that the landing is on open ground. This is issue
 *      #23's acceptance criterion, minus the pixels.
 *   2. **The whole world.** For every baked variant, flood fill from the point
 *      a player arrives at and report which of that level's exits are cut off.
 *      A level with exits but none reachable is a trap and fails; the rest is
 *      reported as a percentage so the number cannot quietly rot.
 *
 * Usage: node scripts/verify-world-walk.ts [pack-directory]
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { WorldVariants, type ActLayout } from '../src/common/world/act-variants.ts'
import { SEAM_TRIGGER_SUBTILES, WARP_TRIGGER_SUBTILES } from '../src/common/world/level-links.ts'
import type { Side } from '../src/common/rng/variants.ts'

const [packDir = 'public/packs'] = process.argv.slice(2)

/** One opening, either kind, reduced to what walking needs. */
interface Link {
  readonly toLevelId: number
  readonly x: number
  readonly y: number
  readonly arriveX: number
  readonly arriveY: number
  readonly label: string
  readonly radius: number
  readonly what: string
  /** The edge a seam leaves by (passed on as `fromSide`, as `travel` does); absent for warps. */
  readonly side?: Side
}

/** The fields of `scene.json` this script reads. */
interface PackedScene {
  readonly levelId: number
  readonly levelName: string
  readonly act: number
  readonly cellsX: number
  readonly cellsY: number
  /** Scene-pixel offset of the map's top corner; `spawn` is measured from it. */
  readonly originX: number
  readonly originY: number
  readonly collision: { readonly width: number; readonly height: number; readonly runs: readonly (readonly number[])[] }
  readonly spawn: readonly number[] | null
  readonly entrances?: readonly {
    toLevelId: number; side: Side; label: string
    x: number; y: number; arriveX: number; arriveY: number
  }[]
  readonly warps?: readonly {
    toLevelId: number; label: string; direction: string; source: string
    x: number; y: number; arriveX: number; arriveY: number
  }[]
  readonly waypoints?: readonly {
    waypointId: number; x: number; y: number; arriveX: number; arriveY: number
  }[]
}

interface IndexEntry {
  readonly act: number
  readonly levelId: number
  readonly path: string
  readonly label: string
  readonly slug?: string
  readonly kind?: string
  /** DS1 member (presets) or generator tag the map was baked from. */
  readonly ds1?: string
  /** DRLG act variant of a generated level. */
  readonly actVariant?: number
}

const index = JSON.parse(await readFile(join(packDir, 'index.json'), 'utf8')) as {
  levels: readonly IndexEntry[]
  actLayouts?: Record<string, readonly ActLayout[]>
}

let checks = 0
let failures = 0

/**
 * Assert one expectation.
 *
 * @param ok - whether it held.
 * @param message - what was checked.
 */
function check(ok: boolean, message: string): void {
  checks += 1
  if (ok) return
  failures += 1
  console.log(`   FAIL ${message}`)
}

const sceneCache = new Map<string, PackedScene>()

/**
 * Read one variant's `scene.json`, cached.
 *
 * @param entry - the index entry.
 * @returns the decoded scene.
 */
async function sceneOf(entry: IndexEntry): Promise<PackedScene> {
  const hit = sceneCache.get(entry.path)
  if (hit !== undefined) return hit
  const scene = JSON.parse(await readFile(join(packDir, entry.path, 'scene.json'), 'utf8')) as PackedScene
  sceneCache.set(entry.path, scene)
  return scene
}

/**
 * Expand the run-length encoded collision grid.
 *
 * @param scene - the packed scene.
 * @returns one byte per sub-tile, non-zero meaning impassable.
 */
function blockedOf(scene: PackedScene): Uint8Array {
  const { width, height, runs } = scene.collision
  const out = new Uint8Array(width * height)
  let at = 0
  for (const run of runs) {
    const value = run[0] ?? 0
    const count = run[1] ?? 0
    out.fill(value, at, at + count)
    at += count
  }
  return out
}

/**
 * The sub-tile the player stands on at the spawn point.
 *
 * `scene.json` stores the spawn in scene pixels, because that is the space the
 * player entity lives in, while every link is in sub-tiles. The inverse
 * isometric projection is the one `playerSubTile` applies in the scene: the
 * half-cell is 16×8 pixels, so `x` and `y` come out of the sum and difference
 * of the pixel offsets from the map's origin.
 *
 * The result is floored, as the collision the player moves against floors it
 * (`isBlockedAt` in `src/game/d2map.ts`). Spawns sit at sub-tile centres
 * (`n + 0.5`), where rounding picks the neighbouring sub-tile: the Rogue
 * Encampment's TownS1 spawn is the centre of the open sub-tile (123,196), while
 * (124,197) is part of a wall.
 *
 * @param scene - the packed scene.
 * @returns the spawn sub-tile, or null when the map has no spawn.
 */
function spawnSubTile(scene: PackedScene): { x: number; y: number } | null {
  if (scene.spawn == null) return null
  const dx = ((scene.spawn[0] ?? 0) - scene.originX) / 16
  const dy = ((scene.spawn[1] ?? 0) - scene.originY) / 8
  return { x: Math.floor((dy + dx) / 2), y: Math.floor((dy - dx) / 2) }
}

/** The runtime's copy chooser, over this pack (`loadRuntimeForLevel` builds the same one). */
const variants = new WorldVariants(index)

/**
 * Pick the copy the runtime would load.
 *
 * @param levelId - the level wanted.
 * @param fromSide - the edge of the previous level the player walked off (seams only).
 * @returns the index entry, or null when the pack has no such level.
 */
function variantFor(levelId: number, fromSide?: Side): IndexEntry | null {
  return variants.entryForLevel(levelId, fromSide)
}

/** Every way out of a level, with the radius that fires it. */
function linksOf(scene: PackedScene): Link[] {
  const out: Link[] = []
  for (const entrance of scene.entrances ?? []) {
    out.push({ ...entrance, radius: SEAM_TRIGGER_SUBTILES, what: `接缝(${entrance.side})` })
  }
  for (const warp of scene.warps ?? []) {
    out.push({ ...warp, radius: WARP_TRIGGER_SUBTILES, what: `传送门(${warp.direction}/${warp.source})` })
  }
  return out
}

/**
 * Flood fill the walkable sub-tiles reachable from a point.
 *
 * Four-connected, because the engine's feet box slides along axes and a
 * diagonal squeeze between two blocked corners is not something a player can
 * actually walk through.
 *
 * @param scene - the packed scene, for its grid size.
 * @param blocked - the expanded collision grid.
 * @param from - the starting sub-tile.
 * @returns a mask of reachable sub-tiles, empty when the start is blocked.
 */
function reachable(scene: PackedScene, blocked: Uint8Array, from: { x: number; y: number }): Uint8Array {
  const width = scene.collision.width
  const height = scene.collision.height
  const seen = new Uint8Array(width * height)
  const at = (x: number, y: number): number => y * width + x
  if (from.x < 0 || from.y < 0 || from.x >= width || from.y >= height) return seen
  if (blocked[at(from.x, from.y)] !== 0) return seen

  // An explicit stack rather than recursion: the Nihlathak maps are 425×425,
  // which is deep enough to blow the call stack.
  const stack = [at(from.x, from.y)]
  seen[stack[0]!] = 1
  while (stack.length > 0) {
    const here = stack.pop()!
    const x = here % width
    const y = (here - x) / width
    const neighbours = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const next = at(nx, ny)
      if (seen[next] === 1 || blocked[next] !== 0) continue
      seen[next] = 1
      stack.push(next)
    }
  }
  return seen
}

/**
 * Whether a link can be triggered from somewhere in a reachable region.
 *
 * The anchor itself is usually blocked — a staircase is scenery — so what
 * matters is whether any walkable sub-tile inside the trigger box is reachable.
 *
 * @param scene - the packed scene.
 * @param mask - the reachable mask from `reachable`.
 * @param link - the link to test.
 * @returns true when the player can stand somewhere that fires it.
 */
function canTrigger(scene: PackedScene, mask: Uint8Array, link: Link): boolean {
  const width = scene.collision.width
  const height = scene.collision.height
  for (let dy = -link.radius; dy <= link.radius; dy += 1) {
    for (let dx = -link.radius; dx <= link.radius; dx += 1) {
      const x = link.x + dx
      const y = link.y + dy
      if (x < 0 || y < 0 || x >= width || y >= height) continue
      if (mask[y * width + x] === 1) return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Pass 1: the acceptance route.
// ---------------------------------------------------------------------------

/** One hop of the scripted walk. */
interface Hop {
  readonly to: number
  /** How the player leaves: a link on the map, or the waypoint network. */
  readonly via: 'link' | 'waypoint'
  readonly note: string
}

/**
 * Issue #23's acceptance walk.
 *
 * The Den of Evil is deliberately not used for the descent: it is a single
 * level with nothing below it, so Cold Plains → Cave Level 1 → Cave Level 2 is
 * the shortest route that actually exercises a multi-level dungeon.
 */
const ROUTE: readonly Hop[] = [
  { to: 2, via: 'link', note: '罗格营地 → 鲜血荒地（接缝）' },
  { to: 3, via: 'link', note: '鲜血荒地 → 冰冷高原（接缝）' },
  { to: 9, via: 'link', note: '冰冷高原 → 洞穴一层（洞口）' },
  { to: 13, via: 'link', note: '洞穴一层 → 洞穴二层（下行楼梯）' },
]

console.log('=== 验收路线 ===')

let entry = variants.startEntry(1)
check(entry !== null, '资源包里有罗格营地（关卡 1）')
let scene = entry === null ? null : await sceneOf(entry)
let here = scene === null ? { x: 0, y: 0 } : spawnSubTile(scene) ?? { x: 0, y: 0 }
/** Waypoints the walk switched on, mirroring `WaypointNetwork.activate`. */
const activated = new Map<number, { levelId: number; x: number; y: number }>()

for (const hop of ROUTE) {
  if (scene === null || entry === null) break
  const fromLevelId = scene.levelId
  const blocked = blockedOf(scene)
  const mask = reachable(scene, blocked, here)
  const reach = mask.reduce<number>((sum, byte) => sum + byte, 0)

  // Standing on a waypoint switches it on, which is how the trip home works.
  // The network stores the pedestal's *arrival* sub-tile, not its anchor: the
  // anchor is the pedestal itself and is usually solid.
  for (const waypoint of scene.waypoints ?? []) {
    const asLink: Link = {
      ...waypoint, toLevelId: -1, label: '', radius: WARP_TRIGGER_SUBTILES, what: '',
    }
    if (!canTrigger(scene, mask, asLink)) continue
    activated.set(waypoint.waypointId, { levelId: fromLevelId, x: waypoint.arriveX, y: waypoint.arriveY })
  }

  const link = linksOf(scene).find(candidate => candidate.toLevelId === hop.to)
  check(link !== undefined, `${hop.note}：${scene.levelName} 有通往 ${String(hop.to)} 的出口`)
  if (link === undefined) break
  check(
    canTrigger(scene, mask, link),
    `${hop.note}：出口「${link.label}」${link.what} 在 (${String(link.x)},${String(link.y)}) 可从落脚点 (${String(here.x)},${String(here.y)}) 走到`
    + `（连通区域 ${String(reach)} 子格）`,
  )

  const nextEntry = variantFor(hop.to, link.side)
  check(nextEntry !== null, `${hop.note}：资源包里有目的地 ${String(hop.to)}`)
  if (nextEntry === null) break
  const nextScene = await sceneOf(nextEntry)
  const back = linksOf(nextScene).find(candidate => candidate.toLevelId === fromLevelId)
  check(back !== undefined, `${hop.note}：${nextScene.levelName} 有回到 ${String(fromLevelId)} 的对侧开口`)
  // travel() refuses a destination with no way back, so the walk ends here too.
  if (back === undefined) break
  const landing = { x: back.arriveX, y: back.arriveY }
  const nextBlocked = blockedOf(nextScene)
  const inBounds = landing.x >= 0 && landing.y >= 0
    && landing.x < nextScene.collision.width && landing.y < nextScene.collision.height
  check(
    inBounds && nextBlocked[landing.y * nextScene.collision.width + landing.x] === 0,
    `${hop.note}：落脚点 (${String(landing.x)},${String(landing.y)}) 在 ${nextScene.levelName} 是空地`,
  )
  console.log(`   ${hop.note} → ${nextEntry.label}，落脚 (${String(landing.x)},${String(landing.y)})`)

  entry = nextEntry
  scene = nextScene
  here = landing
}

// The trip home. The waypoint we want is Cold Plains', switched on while
// walking through it; the scene's own rule is "go to this act's town".
console.log('=== 传送点回城 ===')
const townSite = [...activated.values()].find(site => site.levelId === 1)
const coldPlains = [...activated.entries()].find(([, site]) => site.levelId === 3)
check(coldPlains !== undefined, '路过冰冷高原时激活了它的传送点')
// Act 1's town has no waypoint pedestal of its own in the pack when the player
// has never stood on one, so the network falls back to the town's own site.
const townEntry = variantFor(1)
check(townEntry !== null, '资源包里有罗格营地')
if (townEntry !== null) {
  const townScene = await sceneOf(townEntry)
  const townWaypoint = (townScene.waypoints ?? [])[0]
  check(townWaypoint !== undefined, '罗格营地烘焙出了传送点底座')
  const landing = townSite ?? (townWaypoint === undefined
    ? null
    : { levelId: 1, x: townWaypoint.arriveX, y: townWaypoint.arriveY })
  if (landing !== null) {
    const townBlocked = blockedOf(townScene)
    check(
      townBlocked[landing.y * townScene.collision.width + landing.x] === 0,
      `回城落脚点 (${String(landing.x)},${String(landing.y)}) 是空地`,
    )
    const mask = reachable(townScene, townBlocked, landing)
    const out = linksOf(townScene).find(link => link.toLevelId === 2)
    check(out !== undefined, '罗格营地仍有通往鲜血荒地的出口')
    if (out !== undefined) {
      check(canTrigger(townScene, mask, out), '回城之后还能再走出营地大门')
    }
  }
}

// ---------------------------------------------------------------------------
// Pass 2: the whole world.
// ---------------------------------------------------------------------------

console.log('=== 全量可达性 ===')

/**
 * The question asked here is "arrive through this opening, can you leave by
 * that one".
 *
 * Starting from the map's spawn instead would be wrong for generated levels:
 * `findIsoSpawn` picks any open sub-tile, and on a maze the biggest expanse of
 * open sub-tiles is the unstamped void outside the dungeon, because
 * `buildIsoMapScene` only marks a sub-tile solid when a tile's flags say so and
 * a cell with no tiles at all has no flags. An arrival point, by contrast, is
 * always placed next to a real staircase, so it is somewhere the player can
 * genuinely be.
 */
let variantsWithExits = 0
let pairs = 0
let reachablePairs = 0
const traps: string[] = []
const partial: string[] = []

for (const candidate of index.levels) {
  const packed = await sceneOf(candidate)
  const links = linksOf(packed)
  if (links.length === 0) continue
  variantsWithExits += 1
  const blocked = blockedOf(packed)

  let worst = Number.MAX_SAFE_INTEGER
  let stranded = false
  for (const arrival of links) {
    const mask = reachable(packed, blocked, { x: arrival.arriveX, y: arrival.arriveY })
    let got = 0
    for (const other of links) {
      if (other === arrival) continue
      pairs += 1
      if (canTrigger(packed, mask, other)) { got += 1; reachablePairs += 1 }
    }
    // A single-exit level cannot strand anyone: you came in that way, so you
    // can leave that way. Only count levels that have somewhere else to go.
    if (links.length > 1) {
      worst = Math.min(worst, got)
      if (got === 0) stranded = true
    }
  }
  if (stranded) traps.push(`${candidate.label}（${String(links.length)} 个出口，某个入口进来后一个都走不到）`)
  else if (links.length > 1 && worst < links.length - 1) {
    partial.push(`${candidate.label} 最差 ${String(worst)}/${String(links.length - 1)}`)
  }

  // Freeing the cache keeps a 365-map sweep inside a sane heap.
  sceneCache.delete(candidate.path)
}

for (const trap of traps.slice(0, 40)) console.log(`   困死 ${trap}`)
if (traps.length > 40) console.log(`   …以及另外 ${String(traps.length - 40)} 张`)
if (partial.length > 0) {
  console.log(`   部分可达 ${String(partial.length)} 张：${partial.slice(0, 10).join('，')}${partial.length > 10 ? ' …' : ''}`)
}
console.log(
  `   ${String(variantsWithExits)} 张有出口的地图，出入口配对可达 ${String(reachablePairs)}/${String(pairs)}`
  + `（${((reachablePairs / Math.max(1, pairs)) * 100).toFixed(1)}%），困死 ${String(traps.length)} 张`,
)
check(traps.length === 0, `存在 ${String(traps.length)} 张困死地图`)
check(reachablePairs === pairs, `全图出入口配对可达率不足 100% (${String(reachablePairs)}/${String(pairs)})`)

console.log(`\n${String(checks - failures)}/${String(checks)} 项断言通过`)
if (failures > 0) process.exitCode = 1
