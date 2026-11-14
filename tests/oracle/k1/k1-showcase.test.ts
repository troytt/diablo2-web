import { existsSync, readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BrowserPathSandboxEngine } from '../../../plugins/k1-showcase/path-browser-engine.ts'
import {
  parsePathVectorsBinaryInBrowser,
  type ShowcaseCallgraphResponse,
  type ShowcaseDrlgCatalogResponse,
  type ShowcaseDrlgLevelRunResponse,
  type ShowcaseFunctionDetailResponse,
  type ShowcaseOverviewResponse,
  type ShowcasePathVectorsJsonResponse,
  type ShowcasePathWorldResponse,
  type ShowcaseReplayPayload,
} from '../../../plugins/k1-showcase/types.ts'
import { shouldRedirectUnknownPageToHome } from '../../../src/baker/io/server-status-probe.ts'
import { createK1ShowcaseHttpMiddleware } from '../../../tools/oracle/k1-showcase-server.ts'
import viteConfig from '../../../vite.config.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')

describe('[K1] Interactive Visual Showcase Backend, Browser PATH Engine & Route Wiring', () => {
  let server: Server
  let baseUrl = ''

  beforeAll(async () => {
    const mw = createK1ShowcaseHttpMiddleware({ rootDir: REPO_ROOT })
    server = createServer((req, res) => {
      mw(req, res, () => {
        res.statusCode = 404
        res.end('Not Found')
      })
    })
    await new Promise<void>((resolveListen) => {
      server.listen(0, '127.0.0.1', () => resolveListen())
    })
    const addr = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${addr.port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolveClose) => {
      server.close(() => resolveClose())
    })
  })

  it('wires /k1-showcase.html, plugins/k1-showcase/index.html, and Vite build inputs without redirecting to /', () => {
    const pluginHtml = resolve(REPO_ROOT, 'plugins/k1-showcase/index.html')
    const publicHtml = resolve(REPO_ROOT, 'public/k1-showcase.html')
    expect(existsSync(pluginHtml)).toBe(true)
    expect(existsSync(publicHtml)).toBe(true)

    const html = readFileSync(pluginHtml, 'utf8')
    expect(html).toContain('/ui/fonts/D2Exocet.ttf')
    expect(html).toContain('/ui/fonts/D2Formal436.ttf')
    expect(html).toContain('/ui/fonts/Chi.ttf')
    expect(html).toContain('/ui-pd2/home/stone-back.png')
    expect(html).toContain('/cursor-pd2/other.png')
    expect(html).toContain('/cursor-pd2/hand.png')
    expect(html).toContain('height: 100vh')
    expect(html).toContain('overflow-y: auto')

    const inputs = (viteConfig.build?.rollupOptions?.input ?? {}) as Record<string, string>
    expect(inputs['plugin-k1-showcase']).toBe(pluginHtml)
    expect(shouldRedirectUnknownPageToHome('/k1-showcase.html', { rootDir: REPO_ROOT })).toBe(false)
  })

  it('serves /api/k1-showcase/overview with exact K1 exit-gate ground-truth counts', async () => {
    const resp = await fetch(`${baseUrl}/api/k1-showcase/overview`)
    expect(resp.status).toBe(200)
    const data = (await resp.json()) as ShowcaseOverviewResponse
    expect(data.ok).toBe(true)
    expect(data.d2Common.total).toBe(1479)
    expect(data.d2Common.diffVerified).toBe(1476)
    expect(data.d2Common.ported).toBe(3)
    expect(data.d2Common.unported).toBe(0)
    expect(data.d2Common.completionPct).toBe(100)
    expect(data.d2Game.total).toBe(3331)
    expect(data.drlg.totalVectors).toBe(20400)
    expect(data.path.totalVectors).toBe(6924)
    expect(data.path.activeRooms).toBe(35)
  })

  it(
    'serves /api/k1-showcase/replay for both a1-town-walk (750/750) and a1c-bloodmoor-fallen (2000/2000) with zero divergence',
    async () => {
      const townResp = await fetch(`${baseUrl}/api/k1-showcase/replay?scenario=a1-town-walk`)
      expect(townResp.status).toBe(200)
      const town = (await townResp.json()) as ShowcaseReplayPayload
      expect(town.strictHorizon).toBe(750)
      expect(town.lastGoldenFrame).toBe(750)
      expect(town.firstStrictDivergence).toBeNull()
      expect(town.frames.length).toBe(749) // F2..F750 inclusive
      expect(town.rooms.length).toBeGreaterThan(0)
      expect(town.frames.every((f) => f.diff === null)).toBe(true)

      const fallenResp = await fetch(
        `${baseUrl}/api/k1-showcase/replay?scenario=a1c-bloodmoor-fallen`,
      )
      expect(fallenResp.status).toBe(200)
      const fallen = (await fallenResp.json()) as ShowcaseReplayPayload
      expect(fallen.strictHorizon).toBe(2000)
      expect(fallen.lastGoldenFrame).toBe(2000)
      expect(fallen.firstStrictDivergence).toBeNull()
      expect(fallen.frames.length).toBe(1999) // F2..F2000 inclusive
      expect(fallen.rooms.length).toBeGreaterThanOrEqual(9)
      expect(fallen.frames.every((f) => f.diff === null)).toBe(true)

      const f2000 = fallen.frames[fallen.frames.length - 1]!
      expect(f2000.frame).toBe(2000)
      const winePlayer = f2000.wineUnits.find((u) => u.type === 0)!
      const tsPlayer = f2000.tsUnits.find((u) => u.type === 0)!
      expect(tsPlayer).toEqual(winePlayer)
      expect(tsPlayer.level).toBe(2) // Blood Moor
      expect(tsPlayer.xp).toBe(72)
    },
    60_000,
  )

  it(
    'serves /api/k1-showcase/drlg catalog (20,400 digests) and executes live DRLG with XOR=0 across frozen & custom seeds',
    async () => {
      const catResp = await fetch(`${baseUrl}/api/k1-showcase/drlg`)
      expect(catResp.status).toBe(200)
      const cat = (await catResp.json()) as ShowcaseDrlgCatalogResponse
      expect(cat.totalRecords).toBe(20400)
      expect(cat.frozenSeeds.length).toBe(50)
      expect(cat.levels.length).toBe(136)
      expect(cat.diffSensitiveLevels).toEqual([18, 19, 21, 22, 23, 24, 100, 101, 133])

      // Town level L=1 (Rogue Encampment) on seed=12345, diff=0
      const l1Resp = await fetch(`${baseUrl}/api/k1-showcase/drlg?levelId=1&diff=0&seed=12345`)
      expect(l1Resp.status).toBe(200)
      const l1 = (await l1Resp.json()) as ShowcaseDrlgLevelRunResponse
      expect(l1.rooms.length).toBe(35)
      expect(l1.collRooms.length).toBe(35)
      expect(l1.parity.isFrozenSeed).toBe(true)
      expect(l1.parity.layoutXor).toBe('0x0000000000000000')
      expect(l1.parity.collXor).toBe('0x0000000000000000')
      expect(l1.parity.roomsD2tvMatch).toBe(true)
      expect(l1.parity.townCollD2tvMatch).toBe(true)
      expect(l1.parity.exactMatch).toBe(true)

      // Maze level L=8 (Den of Evil) on seed=777, diff=2
      const l8Resp = await fetch(`${baseUrl}/api/k1-showcase/drlg?levelId=8&diff=2&seed=777`)
      expect(l8Resp.status).toBe(200)
      const l8 = (await l8Resp.json()) as ShowcaseDrlgLevelRunResponse
      expect(l8.parity.isFrozenSeed).toBe(true)
      expect(l8.parity.layoutXor).toBe('0x0000000000000000')
      expect(l8.parity.collXor).toBe('0x0000000000000000')
      expect(l8.parity.exactMatch).toBe(true)

      // Custom non-frozen seed 0x13579BDF on L=132 (Worldstone Chamber)
      const customResp = await fetch(
        `${baseUrl}/api/k1-showcase/drlg?levelId=132&diff=1&seed=0x13579BDF`,
      )
      expect(customResp.status).toBe(200)
      const custom = (await customResp.json()) as ShowcaseDrlgLevelRunResponse
      expect(custom.parity.isFrozenSeed).toBe(false)
      expect(custom.rooms.length).toBeGreaterThan(0)
      expect(custom.collRooms.length).toBe(custom.rooms.length)
    },
    60_000,
  )

  it(
    'hydrates BrowserPathSandboxEngine from /api/k1-showcase/path-world & replays all 6,924 PATHVEC vectors + custom obstacles',
    async () => {
      const [worldResp, jsonResp, binResp] = await Promise.all([
        fetch(`${baseUrl}/api/k1-showcase/path-world`),
        fetch(`${baseUrl}/api/k1-showcase/path-vectors?pathType=14&onlyPositive=1&limit=10`),
        fetch(`${baseUrl}/api/k1-showcase/path-vectors?format=bin`),
      ])
      expect(worldResp.status).toBe(200)
      expect(jsonResp.status).toBe(200)
      expect(binResp.status).toBe(200)

      const worldData = (await worldResp.json()) as ShowcasePathWorldResponse
      const jsonVecs = (await jsonResp.json()) as ShowcasePathVectorsJsonResponse
      const binBuf = await binResp.arrayBuffer()

      expect(worldData.rooms.length).toBe(35)
      expect(worldData.pages.length).toBe(65)
      expect(worldData.fogSinTableU32.length).toBe(512)
      expect(jsonVecs.totalCount).toBe(6924)
      expect(jsonVecs.byPathType.length).toBe(18)
      expect(jsonVecs.records.length).toBe(10)

      const allRecords = parsePathVectorsBinaryInBrowser(binBuf)
      expect(allRecords.length).toBe(6924)

      const engine = new BrowserPathSandboxEngine(worldData)
      const verify = engine.verifyAllVectors(allRecords)
      expect(verify.total).toBe(6924)
      expect(verify.matched).toBe(6924)
      expect(verify.diverged).toBe(0)
      expect(verify.firstMismatch).toBeNull()

      // Interactive PATHTYPE 0..17 execution & custom obstacle rerouting
      const baseIda = engine.computeInteractive({
        pathType: 0,
        startX: 5653,
        startY: 5918,
        targetX: 5684,
        targetY: 5946,
        unitSize: 1,
        unitTypeMode: 'auto',
        customObstacles: new Set(),
      })
      expect(baseIda.faultKind).toBe(0)
      expect(baseIda.ret).toBeGreaterThan(0)
      expect(baseIda.waypoints.length).toBeGreaterThan(0)

      // Block midpoint along baseIda trajectory and confirm PATH_Compute113c recomputes around it
      const midWp = baseIda.waypoints[0]!
      const obs = new Set<string>()
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          obs.add(`${midWp.x + dx}:${midWp.y + dy}`)
        }
      }
      const rerouted = engine.computeInteractive({
        pathType: 0,
        startX: 5653,
        startY: 5918,
        targetX: 5684,
        targetY: 5946,
        unitSize: 2,
        unitTypeMode: 'auto',
        customObstacles: obs,
      })
      expect(rerouted.faultKind).toBe(0)

      // PATHTYPE 14 Blessed Hammer 77-point spiral
      const hammer = engine.computeInteractive({
        pathType: 14,
        startX: 5653,
        startY: 5918,
        targetX: 5665,
        targetY: 5925,
        unitSize: 1,
        unitTypeMode: 'auto',
        customObstacles: new Set(),
      })
      expect(hammer.faultKind).toBe(0)
      expect(hammer.dwPathPoints).toBe(77)

      // PATHTYPE 17 NULL handler triggers documented Fog.#10024 assert at line 894 (0x37E)
      const pt17 = engine.computeInteractive({
        pathType: 17,
        startX: 5653,
        startY: 5918,
        targetX: 5660,
        targetY: 5920,
        unitSize: 1,
        unitTypeMode: 'auto',
        customObstacles: new Set(),
      })
      expect(pt17.faultKind).toBe(2)
      expect(pt17.faultLine).toBe(0x37e)
    },
    30_000,
  )

  it('serves /api/k1-showcase/callgraph (1,479/1,479 D2Common) and /api/k1-showcase/fn-detail with real x86 disassembly & TS source', async () => {
    const cgResp = await fetch(`${baseUrl}/api/k1-showcase/callgraph`)
    expect(cgResp.status).toBe(200)
    const cg = (await cgResp.json()) as ShowcaseCallgraphResponse
    expect(cg.summary.totalReachable).toBe(4810)
    expect(cg.summary.d2Common.total).toBe(1479)
    expect(cg.summary.d2Common.diffVerified).toBe(1476)
    expect(cg.summary.d2Common.ported).toBe(3)
    expect(cg.summary.d2Common.unported).toBe(0)
    expect(cg.summary.d2Common.completionPct).toBe(100)
    expect(cg.summary.d2Game.total).toBe(3331)

    const detailResp = await fetch(
      `${baseUrl}/api/k1-showcase/fn-detail?module=D2Common&va=0x6FD86230`,
    )
    expect(detailResp.status).toBe(200)
    const detail = (await detailResp.json()) as ShowcaseFunctionDetailResponse
    expect(detail.fn.module).toBe('D2Common')
    expect(detail.fn.va).toBe('0x6FD86230')
    expect(detail.fn.status).toBe('diff-verified')
    expect(detail.disassembly.binaryName).toBe('D2Common.dll')
    expect(detail.disassembly.instructionCount).toBeGreaterThan(15)
    expect(detail.disassembly.text).toContain('6fd86230:')
    expect(detail.disassembly.text).not.toContain('/usr/')
    expect(detail.tsSource.kernFile).toBe('src/d2kern-113c/common/path.ts')
    expect(detail.tsSource.tsSymbol).toBe('PATH_Compute113c')
    expect(detail.tsSource.code).toContain('export function PATH_Compute113c')
    expect(detail.callees.length).toBeGreaterThan(0)
  })
})
