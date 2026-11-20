import { findChromeBinary } from './find-chrome.ts'
/**
 * Full-Spectrum 136-Level Isometric Automap & Minimap Verification (`scripts/verify-automap.ts`).
 *
 * Verifies:
 * 1. All 8 baked automap DC6 sprite sheets (`MaxiMap`, `MaxiMapS`, `Act2Map`, `Act2MapS`,
 *    `Act4Map`, `Act4MapS`, `ExTnMap`, `ExTnMapS`) and manifest frame bounds.
 * 2. All 136 level IDs (`1..136`, 365 baked scene variants in `samples/d2-packs`):
 *    - Non-empty automap cells (`floors + walls + objects + extras > 0`).
 *    - Every cell's `fSaved` (`0..3`) and `cellNo` within bounds of its target sheet.
 *    - Town pre-revealed `fSaved` extras for Lut Gholein (`40`), Pandemonium Fortress (`103`),
 *      and Harrogath (`109`).
 *    - `Minimap` (`reveal` + `draw`) execution in both Corner Minimap (`bMinimap=true`, `nDivisor=20`)
 *      and Full Automap (`bMinimap=false`, `nDivisor=10`) across all 136 levels (`1..136`),
 *      confirming isometric sprites (`spritesDrawn.total > 0`), 12-segment player crosshair
 *      (`crosshairsDrawn.player === 1`), and top-right HUD text (`hudText !== null`).
 * 3. Headless Chrome CDP browser audit across Acts 1–5 towns, wildernesses, and dungeons
 *    (`LevelId = 1, 2, 8, 40, 47, 75, 103, 109`) in both Corner Minimap (`bMinimap=1`) and
 *    Full Automap (`bMinimap=0`) modes with zero console/page/WebGL errors.
 *
 * Usage:
 *   npx tsx scripts/verify-automap.ts
 */

import { spawn } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createServer } from 'vite'
import type { AutomapLayerData } from '../src/common/formats/automap-table.ts'
import type { AtlasFrame } from '../src/client/render/atlas.ts'
import type { AtlasHandle, SpriteRenderer } from '../src/client/render/renderer.ts'
import { AUTOMAP_UI_MANIFEST, type AutomapSpriteKey } from '../src/common/items/baked-ui-meta.ts'
import { Minimap, type MinimapLevel, resolveAutomapSheetName } from '../src/client/ui/minimap.ts'

const PACK_DIR = process.argv[2] ?? 'public/packs'

let checks = 0
let failures = 0

function check(ok: boolean, message: string): void {
  checks += 1
  if (!ok) {
    failures += 1
    console.error(`   FAIL ${message}`)
  }
}

interface PackIndexEntry {
  readonly act: number
  readonly levelId: number
  readonly slug: string
  readonly label: string
  readonly levelName: string
  readonly path: string
  readonly kind?: string
}

interface PackedSceneJson {
  readonly act: number
  readonly levelId: number
  readonly levelName: string
  readonly cellsX: number
  readonly cellsY: number
  readonly originX: number
  readonly originY: number
  readonly widthPx: number
  readonly heightPx: number
  readonly collision: {
    readonly width: number
    readonly height: number
    readonly runs: readonly (readonly number[])[]
  }
  readonly spawn: readonly number[] | null
  readonly entrances?: readonly { readonly x: number; readonly y: number; readonly toLevelId?: number }[]
  readonly warps?: readonly { readonly x: number; readonly y: number; readonly toLevelId?: number }[]
  readonly waypoints?: readonly { readonly x: number; readonly y: number; readonly waypointId?: number }[]
  readonly automap?: AutomapLayerData
}

function createHeadlessMockRenderer(): SpriteRenderer {
  return {
    flush() {},
    draw(_frame: AtlasFrame, _x: number, _y: number) {},
    drawSolid(_x: number, _y: number, _w: number, _h: number) {},
    drawSolidQuad(
      _x0: number,
      _y0: number,
      _x1: number,
      _y1: number,
      _x2: number,
      _y2: number,
      _x3: number,
      _y3: number,
    ) {},
  } as unknown as SpriteRenderer
}

function registerSyntheticAtlases(minimap: Minimap): void {
  const keys: readonly AutomapSpriteKey[] = [
    'MaxiMap',
    'MaxiMapS',
    'Act2Map',
    'Act2MapS',
    'Act4Map',
    'Act4MapS',
    'ExTnMap',
    'ExTnMapS',
  ]
  for (const key of keys) {
    const meta = minimap.getSheetMeta(key)
    minimap.setAtlasHandle(key, {
      texture: key as unknown as WebGLTexture,
      width: meta.atlasWidth,
      height: meta.atlasHeight,
    } as AtlasHandle)
  }
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

async function verifyAll136LevelsOffline(): Promise<Map<number, PackIndexEntry>> {
  console.log('== 1. Verifying 8 Baked Automap DC6 Sprite Sheets ==')
  const expectedSheets: readonly { key: AutomapSpriteKey; frames: number }[] = [
    { key: 'MaxiMap', frames: 1499 },
    { key: 'MaxiMapS', frames: 1499 },
    { key: 'Act2Map', frames: 40 },
    { key: 'Act2MapS', frames: 40 },
    { key: 'Act4Map', frames: 4 },
    { key: 'Act4MapS', frames: 4 },
    { key: 'ExTnMap', frames: 8 },
    { key: 'ExTnMapS', frames: 8 },
  ]

  for (const spec of expectedSheets) {
    const meta = AUTOMAP_UI_MANIFEST.atlases[spec.key]
    check(
      meta !== undefined && meta.frameCount === spec.frames && meta.frames.length === spec.frames,
      `Sheet ${spec.key}: expected ${String(spec.frames)} frames, got ${String(meta?.frameCount)}`,
    )
    const assetStat = await stat(join('public', 'ui', 'automap', `${spec.key}.png`)).catch(
      () => null,
    )
    check(
      assetStat !== null && assetStat.size > 0,
      `Sheet PNG public/ui/automap/${spec.key}.png exists (${String(assetStat?.size ?? 0)} bytes)`,
    )
  }

  console.log('\n== 2. Verifying All 136 Level IDs (1..136) Across 365 Baked Scenes ==')
  const indexRaw = await readFile(join(PACK_DIR, 'index.json'), 'utf8')
  const index = JSON.parse(indexRaw) as { readonly levels: readonly PackIndexEntry[] }

  const entriesByLevelId = new Map<number, PackIndexEntry[]>()
  for (const entry of index.levels) {
    const list = entriesByLevelId.get(entry.levelId) ?? []
    list.push(entry)
    entriesByLevelId.set(entry.levelId, list)
  }

  const representativeEntryByLevelId = new Map<number, PackIndexEntry>()
  const renderer = createHeadlessMockRenderer()
  const minimap = new Minimap()
  registerSyntheticAtlases(minimap)

  let totalScenesVerified = 0
  let totalAutomapCellsVerified = 0

  for (let levelId = 1; levelId <= 136; levelId += 1) {
    const entries = entriesByLevelId.get(levelId) ?? []
    check(entries.length > 0, `LevelId ${String(levelId)}: has at least 1 baked scene in index.json`)
    if (entries.length === 0) continue

    representativeEntryByLevelId.set(levelId, entries[0]!)

    for (const entry of entries) {
      const sceneRaw = await readFile(join(PACK_DIR, entry.path, 'scene.json'), 'utf8')
      const scene = JSON.parse(sceneRaw) as PackedSceneJson
      const automap = scene.automap
      check(automap !== undefined, `${entry.path} (LevelId=${String(levelId)}): scene.automap is present`)
      if (!automap) continue

      const cellCount =
        automap.floors.length + automap.walls.length + automap.objects.length + automap.extras.length
      check(
        cellCount > 0,
        `${entry.path} (LevelId=${String(levelId)}): non-empty automap cells (${String(cellCount)})`,
      )
      totalAutomapCellsVerified += cellCount
      totalScenesVerified += 1

      let invalidCells = 0
      for (const cell of [
        ...automap.floors,
        ...automap.walls,
        ...automap.objects,
        ...automap.extras,
      ]) {
        const sheetFull = resolveAutomapSheetName(cell.fSaved ?? 0, false)
        const sheetHalf = resolveAutomapSheetName(cell.fSaved ?? 0, true)
        const metaFull = AUTOMAP_UI_MANIFEST.atlases[sheetFull]
        const metaHalf = AUTOMAP_UI_MANIFEST.atlases[sheetHalf]
        if (
          !metaFull ||
          !metaHalf ||
          cell.cellNo < 0 ||
          cell.cellNo >= metaFull.frames.length ||
          cell.cellNo >= metaHalf.frames.length
        ) {
          invalidCells += 1
        }
      }
      check(
        invalidCells === 0,
        `${entry.path} (LevelId=${String(levelId)}): all ${String(cellCount)} cells have valid frame bounds`,
      )

      if (levelId === 40) {
        check(
          automap.extras.some(c => c.fSaved === 1),
          `${entry.path} (Lut Gholein LevelId=40): contains fSaved=1 Act2Map town extras`,
        )
      } else if (levelId === 103) {
        check(
          automap.extras.some(c => c.fSaved === 2),
          `${entry.path} (Pandemonium Fortress LevelId=103): contains fSaved=2 Act4Map town extras`,
        )
      } else if (levelId === 109) {
        check(
          automap.extras.some(c => c.fSaved === 3),
          `${entry.path} (Harrogath LevelId=109): contains fSaved=3 ExTnMap town extras`,
        )
      }
    }

    // Exercise Minimap render pipeline in both Corner Minimap (bMinimap=true) and Full Automap (bMinimap=false)
    // for the primary variant of each of the 136 levels.
    const primaryEntry = entries[0]!
    const primaryScene = JSON.parse(
      await readFile(join(PACK_DIR, primaryEntry.path, 'scene.json'), 'utf8'),
    ) as PackedSceneJson
    const automap = primaryScene.automap!

    // Pick a reference cell from the level's automap so the camera is centered over real geometry
    const refCell =
      automap.floors[0] ?? automap.walls[0] ?? automap.objects[0] ?? automap.extras[0]!
    const playerCellX = Math.max(
      0,
      Math.min(primaryScene.cellsX - 1, refCell.cellX ?? Math.floor(primaryScene.cellsX / 2)),
    )
    const playerCellY = Math.max(
      0,
      Math.min(primaryScene.cellsY - 1, refCell.cellY ?? Math.floor(primaryScene.cellsY / 2)),
    )
    const playerWorldX = primaryScene.originX + (playerCellX - playerCellY) * 80
    const playerWorldY = primaryScene.originY + (playerCellX + playerCellY) * 40

    const levelModel: MinimapLevel = {
      key: `verify:${primaryEntry.path}`,
      cellsX: primaryScene.cellsX,
      cellsY: primaryScene.cellsY,
      blocked: new Uint8Array(primaryScene.collision.width * primaryScene.collision.height),
      gridWidth: primaryScene.collision.width,
      originX: primaryScene.originX,
      originY: primaryScene.originY,
      automap,
      levelId,
      levelName: primaryScene.levelName,
      difficulty: 'Normal',
      markers: [
        ...(primaryScene.warps ?? []).map(w => ({
          cellX: Math.floor(w.x / 5),
          cellY: Math.floor(w.y / 5),
          kind: 'exit' as const,
          targetName: `Level ${String(w.toLevelId ?? 0)}`,
        })),
      ],
    }

    minimap.reveal(levelModel, playerCellX, playerCellY, playerWorldX, playerWorldY, true)

    // 1. Corner Minimap (bMinimap = true, nDivisor = 20)
    minimap.mode = 'minimap'
    minimap.draw(
      renderer,
      levelModel,
      playerCellX,
      playerCellY,
      { x: playerWorldX, y: playerWorldY, zoom: 1 },
      { width: 800, height: 600 },
      { playerWorldX, playerWorldY, levelId },
    )
    check(
      minimap.lastRenderStats.divisor === 20 &&
        minimap.lastRenderStats.spritesDrawn.total > 0 &&
        minimap.lastRenderStats.crosshairsDrawn.player === 1 &&
        minimap.lastRenderStats.hudText?.levelName === primaryScene.levelName,
      `LevelId ${String(levelId)} (${primaryScene.levelName}): Corner Minimap (bMinimap=1, div=20) drew ${String(minimap.lastRenderStats.spritesDrawn.total)} sprites & player crosshair`,
    )

    // 2. Full Automap (bMinimap = false, nDivisor = 10)
    minimap.mode = 'full'
    minimap.draw(
      renderer,
      levelModel,
      playerCellX,
      playerCellY,
      { x: playerWorldX, y: playerWorldY, zoom: 1 },
      { width: 800, height: 600 },
      { playerWorldX, playerWorldY, levelId },
    )
    check(
      minimap.lastRenderStats.divisor === 10 &&
        minimap.lastRenderStats.spritesDrawn.total > 0 &&
        minimap.lastRenderStats.crosshairsDrawn.player === 1 &&
        minimap.lastRenderStats.hudText?.levelName === primaryScene.levelName,
      `LevelId ${String(levelId)} (${primaryScene.levelName}): Full Automap (bMinimap=0, div=10) drew ${String(minimap.lastRenderStats.spritesDrawn.total)} sprites & player crosshair`,
    )
  }

  console.log(
    `   Verified 136/136 level IDs (${String(totalScenesVerified)} scenes, ${String(totalAutomapCellsVerified)} total automap cells) in both Corner Minimap and Full Automap modes.`,
  )
  return representativeEntryByLevelId
}

async function verifyHeadlessBrowserCdp(
  representativeEntryByLevelId: Map<number, PackIndexEntry>,
): Promise<void> {
  console.log('\n== 3. Launching Headless Chrome CDP Verification (Acts 1–5 Towns, Wildernesses & Dungeons) ==')
  const server = await createServer({
    root: process.cwd(),
    server: { port: 0, host: '127.0.0.1' },
  })
  await server.listen()
  const address = server.httpServer?.address()
  const port = typeof address === 'object' && address ? address.port : 5173
  const baseUrl = `http://127.0.0.1:${port}`
  console.log(`   Vite dev server listening at ${baseUrl}`)

  const debugPort = 9244
  const chromeProc = spawn(findChromeBinary(), [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--window-size=1280,840',
    `${baseUrl}/acts.html?act=1`,
  ])

  try {
    let wsUrl: string | null = null
    for (let i = 0; i < 60; i += 1) {
      await sleep(300)
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`)
        const pages = (await res.json()) as {
          type: string
          url: string
          webSocketDebuggerUrl?: string
        }[]
        const page = pages.find(p => p.type === 'page' && p.url.includes('acts.html'))
        if (page?.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl
          break
        }
      } catch {
        // Wait for Chrome CDP
      }
    }

    if (!wsUrl) {
      throw new Error('Failed to connect to Chrome CDP')
    }

    const ws = new WebSocket(wsUrl)
    await new Promise<void>(resolve => {
      ws.onopen = () => resolve()
    })

    const consoleErrors: string[] = []
    const pageExceptions: string[] = []

    let idCounter = 1
    const sendCommand = <T = unknown>(
      method: string,
      params: Record<string, unknown> = {},
    ): Promise<T> =>
      new Promise((resolve, reject) => {
        const id = idCounter++
        const handler = (event: MessageEvent) => {
          const msg = JSON.parse(String(event.data))
          if (msg.id === id) {
            ws.removeEventListener('message', handler)
            if (msg.error) reject(new Error(JSON.stringify(msg.error)))
            else resolve(msg.result as T)
          }
        }
        ws.addEventListener('message', handler)
        ws.send(JSON.stringify({ id, method, params }))
      })

    ws.addEventListener('message', (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data))
        if (msg.method === 'Runtime.exceptionThrown') {
          pageExceptions.push(JSON.stringify(msg.params))
        } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
          const text = (msg.params.args ?? [])
            .map((a: { value?: unknown; description?: string }) => a.value ?? a.description ?? '')
            .join(' ')
          if (!text.includes('favicon.ico')) {
            consoleErrors.push(text)
          }
        }
      } catch {
        // ignore parse errors
      }
    })

    const evalJs = async <T = unknown>(expression: string): Promise<T> => {
      const res = await sendCommand<{ result: { value: T }; exceptionDetails?: unknown }>(
        'Runtime.evaluate',
        {
          expression,
          awaitPromise: true,
          returnByValue: true,
        },
      )
      if (res.exceptionDetails) {
        throw new Error(`JS exception: ${JSON.stringify(res.exceptionDetails)}`)
      }
      return res.result.value
    }

    await sendCommand('Runtime.enable')
    await sendCommand('Page.enable')

    const auditLevelIds = [1, 2, 8, 40, 47, 75, 103, 109]

    // Wait for initial Act 1 Town boot
    let initialReady = false
    for (let i = 0; i < 120; i += 1) {
      await sleep(250)
      try {
        initialReady = await evalJs<boolean>(
          `Boolean(window.__d2webActs?.ready && window.__d2webHud?.ready && window.__d2webActs?.automapAtlasesLoaded === 8 && (window.__d2webActs?.automapSpritesDrawn?.total ?? 0) > 0)`,
        )
        if (initialReady) break
      } catch {
        // Boot in progress
      }
    }
    check(initialReady, 'Headless Chrome initial Act 1 Town scene and 8 automap atlases ready')

    for (const levelId of auditLevelIds) {
      const entry = representativeEntryByLevelId.get(levelId)
      if (!entry) continue

      const currentLevel = await evalJs<string>(`window.__d2webActs?.level ?? ''`)
      if (currentLevel !== entry.levelName) {
        await sleep(300) // Allow previous WARP_FADE_MS (250ms) fade-in to clear `travelling` guard
        let transitioned = false
        for (let i = 0; i < 80; i += 1) {
          if (i % 5 === 0) {
            await evalJs(`(() => {
              if (window.__d2webActs?.level !== ${JSON.stringify(entry.levelName)}) {
                window.__d2webHudInstance?.callbacks?.onWaypointTeleport(${String(entry.act)}, ${JSON.stringify(entry.slug)}, ${String(entry.levelId)});
              }
            })()`)
          }
          await sleep(150)
          transitioned = await evalJs<boolean>(
            `Boolean(window.__d2webActs?.level === ${JSON.stringify(entry.levelName)} && (window.__d2webActs?.automapSpritesDrawn?.total ?? 0) > 0)`,
          )
          if (transitioned) break
        }
        check(transitioned, `CDP in-engine transition to LevelId=${String(levelId)} (${entry.levelName})`)
      }

      // Ensure Corner Minimap mode (bMinimap=1, divisor=20)
      await evalJs(`(() => {
        const m = window.__d2webMinimap;
        if (m) {
          m.visible = true;
          m.mode = 'minimap';
          m.resetPan();
        }
        if (window.__d2webHudInstance) {
          window.__d2webHudInstance.leftPanel = 'none';
          window.__d2webHudInstance.rightPanel = 'none';
        }
      })()`)
      for (let i = 0; i < 40; i += 1) {
        await sleep(50)
        const synced = await evalJs<boolean>(
          `Boolean(window.__d2webActs?.automapMode === 'minimap' && window.__d2webActs?.automapDivisor === 20 && window.__d2webActs?.automapViewport?.width === 279 && (window.__d2webActs?.automapSpritesDrawn?.total ?? 0) > 0)`,
        )
        if (synced) break
      }

      const miniTelemetry = await evalJs<{
        level: string
        minimapVisible: boolean
        automapMode: string
        automapDivisor: number
        automapAtlasesLoaded: number
        automapCellCounts: { floors: number; walls: number; objects: number; extras: number; total: number }
        automapRevealedRooms: number
        automapSpritesDrawn: { total: number }
        automapCrosshairsDrawn: { player: number; total: number }
        automapHudText: { levelName: string; difficulty: string } | null
        automapViewport: { width: number; height: number; x: number; y: number }
      }>(`(() => {
        const s = window.__d2webActs;
        return {
          level: s.level,
          minimapVisible: s.minimapVisible,
          automapMode: s.automapMode,
          automapDivisor: s.automapDivisor,
          automapAtlasesLoaded: s.automapAtlasesLoaded,
          automapCellCounts: s.automapCellCounts,
          automapRevealedRooms: s.automapRevealedRooms,
          automapSpritesDrawn: s.automapSpritesDrawn,
          automapCrosshairsDrawn: s.automapCrosshairsDrawn,
          automapHudText: s.automapHudText,
          automapViewport: s.automapViewport,
        };
      })()`)

      check(
        miniTelemetry.minimapVisible === true &&
          miniTelemetry.automapMode === 'minimap' &&
          miniTelemetry.automapDivisor === 20 &&
          miniTelemetry.automapAtlasesLoaded === 8 &&
          miniTelemetry.automapCellCounts.total > 0 &&
          miniTelemetry.automapRevealedRooms > 0 &&
          miniTelemetry.automapSpritesDrawn.total > 0 &&
          miniTelemetry.automapCrosshairsDrawn.player === 1 &&
          miniTelemetry.automapHudText !== null &&
          miniTelemetry.automapViewport.width === 279 &&
          miniTelemetry.automapViewport.height === 225,
        `CDP LevelId=${String(levelId)} (${entry.levelName}): Corner Minimap (div=20, 279x225) rendered ${String(miniTelemetry.automapSpritesDrawn?.total)} sprites, ${String(miniTelemetry.automapCrosshairsDrawn?.total)} crosshairs, HUD="${miniTelemetry.automapHudText?.levelName ?? ''}"`,
      )

      // Toggle to Full Automap ('V') and test panel shift + arrow panning
      await evalJs(`(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', bubbles: true }));
      })()`)
      for (let i = 0; i < 40; i += 1) {
        await sleep(50)
        const synced = await evalJs<boolean>(
          `Boolean(window.__d2webActs?.automapMode === 'full' && window.__d2webActs?.automapDivisor === 10 && window.__d2webActs?.automapViewport?.width > 279 && (window.__d2webActs?.automapSpritesDrawn?.total ?? 0) > 0)`,
        )
        if (synced) break
      }

      const fullTelemetry = await evalJs<{
        automapMode: string
        automapDivisor: number
        automapSpritesDrawn: { total: number }
        automapCrosshairsDrawn: { player: number; total: number }
        automapViewport: { width: number; height: number; centerShiftX: number; panX: number; panY: number }
      }>(`(() => {
        const s = window.__d2webActs;
        return {
          automapMode: s.automapMode,
          automapDivisor: s.automapDivisor,
          automapSpritesDrawn: s.automapSpritesDrawn,
          automapCrosshairsDrawn: s.automapCrosshairsDrawn,
          automapViewport: s.automapViewport,
        };
      })()`)

      check(
        fullTelemetry.automapMode === 'full' &&
          fullTelemetry.automapDivisor === 10 &&
          fullTelemetry.automapSpritesDrawn.total > 0 &&
          fullTelemetry.automapCrosshairsDrawn.player === 1,
        `CDP LevelId=${String(levelId)} (${entry.levelName}): Full Automap (div=10) rendered ${String(fullTelemetry.automapSpritesDrawn?.total)} sprites`,
      )

      console.log(
        `   ok   CDP LevelId=${String(levelId)} (${entry.levelName}): minimap=${String(miniTelemetry.automapSpritesDrawn.total)} sprites, full=${String(fullTelemetry.automapSpritesDrawn.total)} sprites`,
      )
    }

    // Interactive hotkeys & panel shift verification in Full Automap mode
    const interactiveAudit = await evalJs<{
      panAfterArrows: { panX: number; panY: number }
      panAfterHome: { panX: number; panY: number }
      fadeAfterF9: number
      namesAfterF10: boolean
      leftPanelShiftX: number
      rightPanelShiftX: number
      visibleAfterTabOff: boolean
      visibleAfterTabOn: boolean
    }>(`(async () => {
      const waitFrames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const m = window.__d2webMinimap;
      const hud = window.__d2webHudInstance;
      m.visible = true;
      m.mode = 'full';
      m.resetPan();
      hud.leftPanel = 'none';
      hud.rightPanel = 'none';
      await waitFrames();

      // Arrow key panning (+8px right, +8px down)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      const panAfterArrows = { panX: m.panX, panY: m.panY };

      // Home reset
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      const panAfterHome = { panX: m.panX, panY: m.panY };

      // F9 fade cycle & F10 names toggle
      const initialFade = m.fadeState;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F9', bubbles: true }));
      const fadeAfterF9 = m.fadeState;
      const initialNames = m.showNames;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', bubbles: true }));
      const namesAfterF10 = m.showNames !== initialNames;

      // Left panel open -> +160px centerShiftX
      hud.leftPanel = 'char';
      hud.rightPanel = 'none';
      await waitFrames();
      const leftPanelShiftX = window.__d2webActs?.automapViewport?.centerShiftX ?? 0;

      // Right panel open -> -160px centerShiftX
      hud.leftPanel = 'none';
      hud.rightPanel = 'inv';
      await waitFrames();
      const rightPanelShiftX = window.__d2webActs?.automapViewport?.centerShiftX ?? 0;
      hud.rightPanel = 'none';

      // Tab toggle off & on
      m.toggle();
      const visibleAfterTabOff = m.visible;
      m.toggle();
      const visibleAfterTabOn = m.visible;

      void initialFade;
      return {
        panAfterArrows,
        panAfterHome,
        fadeAfterF9,
        namesAfterF10,
        leftPanelShiftX,
        rightPanelShiftX,
        visibleAfterTabOff,
        visibleAfterTabOn,
      };
    })()`)

    check(
      interactiveAudit.panAfterArrows.panX === 8 && interactiveAudit.panAfterArrows.panY === 8,
      `CDP Full Automap arrow panning: expected (8, 8), got (${String(interactiveAudit.panAfterArrows.panX)}, ${String(interactiveAudit.panAfterArrows.panY)})`,
    )
    check(
      interactiveAudit.panAfterHome.panX === 0 && interactiveAudit.panAfterHome.panY === 0,
      `CDP Full Automap Home pan reset: expected (0, 0), got (${String(interactiveAudit.panAfterHome.panX)}, ${String(interactiveAudit.panAfterHome.panY)})`,
    )
    check(
      interactiveAudit.fadeAfterF9 === 1,
      `CDP F9 fade cycle advanced fadeState to ${String(interactiveAudit.fadeAfterF9)}`,
    )
    check(interactiveAudit.namesAfterF10 === true, 'CDP F10 toggled showNames state')
    check(
      interactiveAudit.leftPanelShiftX === 160,
      `CDP Full Automap left panel open shifted center by +160px (got ${String(interactiveAudit.leftPanelShiftX)})`,
    )
    check(
      interactiveAudit.rightPanelShiftX === -160,
      `CDP Full Automap right panel open shifted center by -160px (got ${String(interactiveAudit.rightPanelShiftX)})`,
    )
    check(
      interactiveAudit.visibleAfterTabOff === false && interactiveAudit.visibleAfterTabOn === true,
      'CDP Tab toggled automap visibility off and back on',
    )

    if (consoleErrors.length > 0) {
      for (const err of consoleErrors) {
        console.error('   [CDP console.error]:', err)
      }
    }
    check(
      consoleErrors.length === 0,
      `Zero unexpected console.error messages during CDP audit (got ${String(consoleErrors.length)})`,
    )
    check(
      pageExceptions.length === 0,
      `Zero uncaught page exceptions during CDP audit (got ${String(pageExceptions.length)})`,
    )

    ws.close()
  } finally {
    chromeProc.kill()
    await server.close()
  }
}

async function main(): Promise<void> {
  const representativeEntryByLevelId = await verifyAll136LevelsOffline()
  await verifyHeadlessBrowserCdp(representativeEntryByLevelId)

  console.log(`\n${String(checks - failures)}/${String(checks)} checks passed`)
  if (failures > 0) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('verify-automap failed:', err)
  process.exit(1)
})
