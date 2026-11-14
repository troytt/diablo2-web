/**
 * Issue #919 — full-spectrum (all 136 level IDs) audit of the 1.13c tile layer order and wall occlusion fade data.
 *
 * This host's headless Chrome has no WebGL2, so `play.html` cannot boot here; instead every level is loaded through the
 * same runtime path the client uses (`MapService` over the baked `public/act-packs/tiles` bundle -> DRLG session ->
 * `LevelView`), a real `ClientWorldSceneSource` snapshot is built around the level's grounded spawn, and
 * `renderSceneSourceFrame` is executed against a recording (non-WebGL) renderer. Checked per level:
 *
 * 1. Routing (D2Client `0x6fb2a72e`): `lowerWallQuads` hold exactly the `nTileType 16..19` walls, `upperWallQuads` hold
 *    no `16..19` / `15`, every roof is type 15 and carries no fade box.
 * 2. Pass order (`0x6fb3b110`): in the recorded draw stream every lower-wall draw precedes every floor draw, floors
 *    precede shadows, shadows precede upper walls, upper walls precede roofs; every roof quad in view is drawn.
 * 3. Fade data (`0x6fb29f20`): the logical-index grid covers the canvas; every fade box lies inside the canvas; walls
 *    with a box exist only in levels that have a multi-list logical grid.
 *
 * Usage: npx tsx tools/verify-z-order-919.ts [--levels=1,2,3] [--seed=0x1234]
 */
import './lib/node-map-loader.ts'
import { MapService } from '../src/client/map/map-service.ts'
import type { LevelView } from '../src/client/map/level-view.ts'
import { DRLG_GetActNoFromLevelId } from '../src/common/drlg/drlg-drlg.ts'
import { isLowerWallType } from '../src/common/world/d2map.ts'
import { ClientWorldSceneSource, type SceneTileQuad } from '../src/client/view/scene-source.ts'
import { renderSceneSourceFrame, type SceneSourceRenderContext } from '../src/client/scene/world-renderer.ts'

if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
  ;(globalThis as unknown as { window: Record<string, unknown> }).window = { addEventListener: () => {}, removeEventListener: () => {} }
}

const args = new Map(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=') as [string, string]))
const seed = Number(args.get('seed') ?? '0x1234')
const levelIds = args.has('levels')
  ? args.get('levels')!.split(',').map(Number)
  : Array.from({ length: 136 }, (_, i) => i + 1)

const LAYER_RANK = { lower: 0, floor: 1, shadow: 2, upper: 3, roof: 4 } as const
type Layer = keyof typeof LAYER_RANK

const ms = await MapService.fromPackedDir('public/act-packs/tiles')
const problems: string[] = []
let checkedLevels = 0
let totalLower = 0
let totalUpper = 0
let totalRoofs = 0
let totalFadeWalls = 0
let totalPops = 0
const fadeLevels: number[] = []
const popLevels: number[] = []

for (const id of levelIds) {
  const act = DRLG_GetActNoFromLevelId(id) + 1
  ms.loadAct({ act, seed, areaId: id })
  const v: LevelView = ms.getLevelView(id)
  const fail = (msg: string): void => { problems.push(`level ${String(id)}: ${msg}`) }

  // 3. fade data + POPS boxes (#1009)
  const g = v.logicalIndex
  if (g === undefined) fail('no logicalIndex grid')
  else if (g.width !== v.cellsX || g.height !== v.cellsY || g.cells.length !== v.cellsX * v.cellsY) fail(`logicalIndex ${String(g.width)}x${String(g.height)} != canvas ${String(v.cellsX)}x${String(v.cellsY)}`)
  const distinct = new Set(g ? Array.from(g.cells).filter(c => c >= 0) : [])
  const fadeWalls = v.walls.filter(w => w.fadeBox !== undefined)
  for (const w of fadeWalls) {
    const b = w.fadeBox!
    if (b.x < 0 || b.y < 0 || b.x > v.cellsX || b.y > v.cellsY) fail(`fade box (${String(b.x)}, ${String(b.y)}) outside the canvas`)
    if (!distinct.has(b.index)) fail(`fade box index ${String(b.index)} absent from the logical grid`)
  }
  const pops = v.pops ?? []
  for (const p of pops) {
    const b = p.box
    if (p.index < 1 || p.index > 22) fail(`pop box index ${String(p.index)} out of 1..22 range`)
    if (b.width <= 0 || b.height <= 0) fail(`pop box (${String(b.x)}, ${String(b.y)}) has non-positive size ${String(b.width)}x${String(b.height)}`)
    if (b.x < 0 || b.y < 0 || b.x + b.width > v.cellsX || b.y + b.height > v.cellsY) {
      fail(`pop box (${String(b.x)}, ${String(b.y)}, ${String(b.width)}x${String(b.height)}) outside canvas ${String(v.cellsX)}x${String(v.cellsY)}`)
    }
  }
  if (v.roofs.some(r => r.fadeBox !== undefined)) fail('a roof carries a fade box')
  if (v.roofs.some(r => r.type !== 15)) fail('a roof draw is not type 15')
  if (v.walls.some(w => w.type === 15)) fail('a type-15 tile is in the wall list')
  totalFadeWalls += fadeWalls.length
  if (fadeWalls.length > 0) fadeLevels.push(id)
  totalPops += pops.length
  if (pops.length > 0) popLevels.push(id)

  // 1 + 2. real snapshot + recorded frame at the grounded spawn
  const source = new ClientWorldSceneSource(() => ({
    levelView: v,
    playerSubX: v.originX + v.spawnX * 5 + 2,
    playerSubY: v.originY + v.spawnY * 5 + 2,
    ambient: null,
    units: [],
  }))
  const snap = source.buildFrameSnapshot()
  for (const q of snap.lowerWallQuads) if (!isLowerWallType(q.type)) fail(`lower-wall pass holds type ${String(q.type)}`)
  for (const q of snap.upperWallQuads) if (isLowerWallType(q.type) || q.type === 15) fail(`upper-wall pass holds type ${String(q.type)}`)
  const expectedLower = v.walls.filter(w => isLowerWallType(w.type)).length
  const expectedUpper = v.walls.length - expectedLower
  totalLower += expectedLower
  totalUpper += expectedUpper
  totalRoofs += v.roofs.length

  const layerOf = new Map<string, Layer>()
  const key = (x: number, y: number, q: SceneTileQuad): string => `${String(x)},${String(y)},${String(q.placement?.page)},${String(q.placement?.x)},${String(q.placement?.y)}`
  const tag = (list: readonly SceneTileQuad[], layer: Layer): void => {
    for (const q of list) if (q.placement) layerOf.set(key(q.worldX, q.worldY, q), layer)
  }
  tag(snap.lowerWallQuads, 'lower')
  tag(snap.floorQuads, 'floor')
  tag(snap.shadowQuads, 'shadow')
  tag(snap.upperWallQuads, 'upper')
  tag(snap.roofQuads, 'roof')
  const byXY = new Map<string, Layer>()
  for (const [k, l] of layerOf) {
    const [x, y, , px, py] = k.split(',')
    byXY.set(`${x!},${y!},${px!},${py!}`, l)
  }
  const stream: Layer[] = []
  const renderer = {
    begin: () => {}, flush: () => {}, setLighting: () => {}, setUnitLight: () => {}, setBlendMode: () => {},
    draw: (frame: { x: number; y: number }, x: number, y: number) => {
      const l = byXY.get(`${String(x)},${String(y)},${String(frame.x)},${String(frame.y)}`)
      if (l !== undefined) stream.push(l)
    },
  }
  const ctx = {
    nowMs: 0,
    renderer,
    tileGpuCache: { ensureActPalette: () => {}, getPageHandle: () => ({ texture: {}, width: 4096, height: 4096 }) },
    source,
  } as unknown as SceneSourceRenderContext
  renderSceneSourceFrame(ctx)
  let maxRank = -1
  for (const l of stream) {
    const r = LAYER_RANK[l]
    if (r < maxRank) { fail(`a ${l} draw follows a higher layer (rank ${String(maxRank)})`); break }
    maxRank = r
  }
  const drawnRoofs = stream.filter(l => l === 'roof').length
  const roofsInView = snap.roofQuads.filter(q => q.placement).length
  if (drawnRoofs < roofsInView) fail(`${String(roofsInView - drawnRoofs)} roof quads in view were not drawn`)
  const drawnLower = stream.filter(l => l === 'lower').length
  const expectedDrawnLower = snap.lowerWallQuads.filter(q => q.placement && !q.revealHidden).length
  if (drawnLower !== expectedDrawnLower) fail('not every visible lower-wall quad in view was drawn')
  checkedLevels += 1
  console.log(`level ${String(id).padStart(3)}  walls ${String(v.walls.length).padStart(5)} (lower ${String(expectedLower).padStart(4)})  roofs ${String(v.roofs.length).padStart(4)}  fade-walls ${String(fadeWalls.length).padStart(5)}  pops ${String(pops.length).padStart(3)}  logical-lists ${String(distinct.size).padStart(3)}  frame-draws ${String(stream.length).padStart(5)}`)
}

console.log(`levels      ${String(checkedLevels)} / ${String(levelIds.length)}`)
console.log(`walls       upper ${String(totalUpper)}, lower (16..19) ${String(totalLower)}, roofs ${String(totalRoofs)}`)
console.log(`fade walls  ${String(totalFadeWalls)} in ${String(fadeLevels.length)} levels`)
console.log(`pops boxes  ${String(totalPops)} in ${String(popLevels.length)} levels`)
console.log(`problems    ${String(problems.length)}`)
for (const p of problems.slice(0, 40)) console.log(`  - ${p}`)
console.log(problems.length === 0 ? 'RESULT      all levels pass the 1.13c layer-order / fade-data / POPS invariants' : 'RESULT      FAILED')
process.exit(problems.length === 0 ? 0 : 1)
