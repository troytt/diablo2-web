/**
 * Issue #923 — deterministic multi-frame audit of floor-tile stability (all 136 level IDs by default).
 *
 * This host's headless Chrome has no WebGL2, so the check runs the real client path without a GPU: `MapService` over
 * the baked `public/act-packs/tiles` bundle -> DRLG session -> `LevelView` -> `ClientWorldSceneSource` snapshot ->
 * `renderSceneSourceFrame` against a recording (non-WebGL) renderer.
 *
 * For every level a set of fixed views is built (the grounded spawn, plus cells holding snow floors
 * (`materialFlags & 0x400`) and cells holding animated floors). Each view is rendered at 32 consecutive clock values
 * (`nowMs = 0, 40, ..., 1240`, i.e. one 1.13c 25 Hz tick apart) and at 5 camera offsets; the recorded atlas frame per
 * screen location must be identical across the camera offsets, and may change over time only where the floor tile
 * animates in 1.13c: D2Common `DRLGANIM_TestLoadAnimatedRoomTiles` / `DRLGANIM_AllocAnimationTileGrid`
 * (1.13c `0x6fd62f20` / `0x6fd62ff0`: `D2CMP.#10051` (word at tile `+0x06`) then `test ah, 0x1`) animate a tile iff
 * its material flags carry `TILE_FLAGS_LAVA` (`0x100`).
 *
 * Usage: npx tsx tools/verify-floor-flicker-923.ts [--levels=1,2,3] [--seed=0x1234]
 */
import './lib/node-map-loader.ts'
import { MapService } from '../src/client/map/map-service.ts'
import type { LevelView } from '../src/client/map/level-view.ts'
import { DRLG_GetActNoFromLevelId } from '../src/common/drlg/drlg-drlg.ts'
import { ClientWorldSceneSource, type SceneTileQuad } from '../src/client/view/scene-source.ts'
import { renderSceneSourceFrame, type SceneSourceRenderContext } from '../src/client/scene/world-renderer.ts'

if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
  ;(globalThis as unknown as { window: Record<string, unknown> }).window = { addEventListener: () => {}, removeEventListener: () => {} }
}

const TILE_FLAGS_LAVA = 0x100
const TILE_FLAGS_SNOW = 0x400
const FRAMES = 32
const FRAME_MS = 40
const CAMERA_OFFSETS: readonly (readonly [number, number])[] = [[0, 0], [1, 0], [0, 1], [3, 2], [-2, 4]]

const args = new Map(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=') as [string, string]))
const seed = Number(args.get('seed') ?? '0x1234')
const levelIds = args.has('levels')
  ? args.get('levels')!.split(',').map(Number)
  : Array.from({ length: 136 }, (_, i) => i + 1)

type DrawRecord = Map<string, string[]>

/** Render one frame and return the atlas frames drawn per screen location. */
function recordFrame(v: LevelView, subX: number, subY: number, nowMs: number): { draws: DrawRecord; floors: readonly SceneTileQuad[] } {
  const source = new ClientWorldSceneSource(() => ({ levelView: v, playerSubX: subX, playerSubY: subY, ambient: null, units: [] }))
  const snap = source.buildFrameSnapshot()
  const draws: DrawRecord = new Map()
  const renderer = {
    begin: () => {}, flush: () => {}, setLighting: () => {}, setUnitLight: () => {}, setBlendMode: () => {},
    draw: (frame: { x: number; y: number; width: number; height: number }, x: number, y: number, opts?: { atlas?: { page?: string } }) => {
      const k = `${String(x)},${String(y)}`
      const list = draws.get(k) ?? []
      list.push(`${String(opts?.atlas?.page)}:${String(frame.x)},${String(frame.y)},${String(frame.width)}x${String(frame.height)}`)
      draws.set(k, list)
    },
  }
  const ctx = {
    nowMs,
    renderer,
    tileGpuCache: {
      ensureActPalette: () => {},
      getPageHandle: (act: number, page: number) => ({ texture: {}, width: 4096, height: 4096, page: `${String(act)}/${String(page)}` }),
    },
    source,
  } as unknown as SceneSourceRenderContext
  renderSceneSourceFrame(ctx)
  return { draws, floors: snap.floorQuads }
}

const signature = (list: readonly string[] | undefined): string => (list ? [...list].sort().join('|') : '')

/** Whether every element of `a` (with multiplicity) also occurs in `b`. */
function isSubMultiset(a: readonly string[], b: readonly string[]): boolean {
  const counts = new Map<string, number>()
  for (const s of b) counts.set(s, (counts.get(s) ?? 0) + 1)
  for (const s of a) {
    const n = counts.get(s) ?? 0
    if (n === 0) return false
    counts.set(s, n - 1)
  }
  return true
}

const ms = await MapService.fromPackedDir('public/act-packs/tiles')
const problems: string[] = []
let checkedLevels = 0
let totalViews = 0
let totalSnowFloorsInView = 0
let totalLavaAnimLocations = 0

for (const id of levelIds) {
  const act = DRLG_GetActNoFromLevelId(id) + 1
  ms.loadAct({ act, seed, areaId: id })
  const v: LevelView = ms.getLevelView(id)
  const fail = (msg: string): void => { problems.push(`level ${String(id)}: ${msg}`) }

  // Views: spawn + up to 4 snow-floor cells + up to 4 animated-floor cells, spread through the floor list.
  const views: [number, number][] = [[v.spawnX, v.spawnY]]
  const pickSpread = (pred: (f: (typeof v.floors)[number]) => boolean): void => {
    const cells = v.floors.filter(pred)
    for (let i = 0; i < Math.min(4, cells.length); i += 1) {
      const f = cells[Math.floor((i * cells.length) / Math.min(4, cells.length))]!
      views.push([f.cellX, f.cellY])
    }
  }
  pickSpread(f => ((f.materialFlags ?? 0) & TILE_FLAGS_SNOW) !== 0)
  pickSpread(f => f.animatedPlacements !== undefined && f.animatedPlacements.length > 1)

  let snowInView = 0
  let lavaAnim = 0
  let changedNonLava = 0
  for (const [cx, cy] of views) {
    totalViews += 1
    const baseSubX = v.originX + cx * 5 + 2
    const baseSubY = v.originY + cy * 5 + 2

    // Time: the same view over 32 consecutive frames.
    const frames: DrawRecord[] = []
    let floors: readonly SceneTileQuad[] = []
    for (let i = 0; i < FRAMES; i += 1) {
      const r = recordFrame(v, baseSubX, baseSubY, i * FRAME_MS)
      frames.push(r.draws)
      if (i === 0) floors = r.floors
    }
    const floorsAt = new Map<string, SceneTileQuad[]>()
    for (const q of floors) {
      const k = `${String(q.worldX)},${String(q.worldY)}`
      floorsAt.set(k, [...(floorsAt.get(k) ?? []), q])
      if (((q.materialFlags ?? 0) & TILE_FLAGS_SNOW) !== 0) snowInView += 1
    }
    const locations = new Set<string>()
    for (const f of frames) for (const k of f.keys()) locations.add(k)
    for (const k of locations) {
      const base = signature(frames[0]!.get(k))
      let changes = 0
      for (let i = 1; i < FRAMES; i += 1) if (signature(frames[i]!.get(k)) !== base) changes += 1
      if (changes === 0) continue
      const qs = floorsAt.get(k) ?? []
      // A lava cell may carry a static second floor layer on top of the animating lava (River of Flame edges).
      if (qs.some(q => ((q.materialFlags ?? 0) & TILE_FLAGS_LAVA) !== 0)) {
        lavaAnim += 1
        continue
      }
      changedNonLava += 1
      if (changedNonLava <= 5) {
        const desc = qs.map(q => `${q.dt1Path.split('\\').slice(-2).join('/')}#${String(q.tile)} flags=0x${(q.materialFlags ?? 0).toString(16)}`).join(', ') || 'non-floor draw'
        fail(`view (${String(cx)},${String(cy)}) location ${k} changes in ${String(changes)}/${String(FRAMES - 1)} frames: ${desc}`)
      }
    }

    // Camera: the same clock at 5 camera offsets. A location drawn in two views must draw the same frames; one view
    // may only draw a subset (a wall / shadow quad culled at the snapshot edge), never a different frame.
    const ref = frames[0]!
    for (const [dx, dy] of CAMERA_OFFSETS.slice(1)) {
      const other = recordFrame(v, baseSubX + dx, baseSubY + dy, 0).draws
      let diffs = 0
      for (const [k, list] of other) {
        const a = ref.get(k)
        if (a !== undefined && !isSubMultiset(a, list) && !isSubMultiset(list, a)) {
          diffs += 1
          if (diffs <= 3) fail(`view (${String(cx)},${String(cy)}) camera offset (${String(dx)},${String(dy)}) location ${k}: ${signature(a)} vs ${signature(list)}`)
        }
      }
    }
  }
  if (changedNonLava > 5) fail(`... ${String(changedNonLava - 5)} more non-lava locations change over time`)
  totalSnowFloorsInView += snowInView
  totalLavaAnimLocations += lavaAnim
  checkedLevels += 1
  console.log(`level ${String(id).padStart(3)}  views ${String(views.length)}  snow-floors-in-view ${String(snowInView).padStart(5)}  lava-animating ${String(lavaAnim).padStart(5)}  non-lava-changing ${String(changedNonLava).padStart(5)}`)
}

console.log(`levels      ${String(checkedLevels)} / ${String(levelIds.length)}`)
console.log(`views       ${String(totalViews)} x ${String(FRAMES)} frames + ${String(CAMERA_OFFSETS.length - 1)} camera offsets`)
console.log(`snow floors in view ${String(totalSnowFloorsInView)}, lava (0x100) animating locations ${String(totalLavaAnimLocations)}`)
console.log(`problems    ${String(problems.length)}`)
for (const p of problems.slice(0, 60)) console.log(`  - ${p}`)
console.log(problems.length === 0 ? 'RESULT      floor tiles are stable; only TILE_FLAGS_LAVA tiles animate' : 'RESULT      FAILED')
process.exit(problems.length === 0 ? 0 : 1)
