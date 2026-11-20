/**
 * Milestone 36 [K5] Single-Player `d2kern-113c` Runtime Switch & Multi-Resolution
 * (`800x600`, `1068x600`, `1280x720`) Live Browser Verification Gate.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSiteConfigHttpMiddleware } from '../../../src/baker/io/site-config.ts'
import { loadSiteConfig } from '../../../src/client/config/site-config.ts'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import { VIEWPORT_1280x720, VIEWPORT_800x600 } from '../../../src/client/view/viewport-profile.ts'
import { STATLIST_SetUnitStat113c, UNITS_GetX113c, UNITS_GetY113c } from '../../../src/d2kern-113c/index.ts'
import { asSubTile, type LocalAreaLevelGeometry, type LocalAreaLevelSource } from '../../../src/netproto/index.ts'
import {
  LocalKernelD2gsAdapter113c,
  LocalLobbyProvider,
  LocalLoopbackAdapter,
  createLocalKernelSession113c,
  createLocalLoopbackSession,
  readD2sSave113c,
} from '../../../src/server/index.ts'
import {
  runK5BrowserMultiresE2e,
  stripPngAncillaryChunks,
} from '../../../tools/oracle/k5/verify-browser-multires-e2e.ts'

function buildRogueEncampmentLevelSource(): LocalAreaLevelSource {
  const originX = 5000
  const originY = 5000
  const subWidth = 120
  const subHeight = 120
  const blocked = new Uint8Array(subWidth * subHeight)
  const collision = new Uint16Array(subWidth * subHeight)
  const geom: LocalAreaLevelGeometry = {
    areaId: 1,
    originX,
    originY,
    subWidth,
    subHeight,
    blocked,
    collision,
    spawnTileX: 12,
    spawnTileY: 12,
    rooms: [
      { areaId: 1, tileX: 1000, tileY: 1000 },
      { areaId: 1, tileX: 1008, tileY: 1000 },
      { areaId: 1, tileX: 1000, tileY: 1008 },
    ],
    roomRects: [
      { index: 0, x: 5000, y: 5000, w: 60, h: 60, seed: 0x11112222 },
      { index: 1, x: 5060, y: 5000, w: 60, h: 60, seed: 0x33334444 },
    ],
    presetUnits: [
      // Akara (`148`) & Warriv (`155`) in Rogue Encampment
      { type: 1, index: 148, mode: 1, subX: 70, subY: 55 },
      { type: 1, index: 155, mode: 1, subX: 52, subY: 64 },
      // Stash (`267`) & Rogue Encampment Waypoint (`119`)
      { type: 2, index: 267, mode: 0, subX: 56, subY: 54 },
      { type: 2, index: 119, mode: 0, subX: 76, subY: 68 },
    ],
    warps: [],
  }
  return (req) => (req.areaId === 1 ? geom : null)
}

describe('[K5] Single-Player d2kern-113c Runtime Switch & Live Multi-Resolution Verification', () => {
  it('parses singlePlayerBackend cleanly in loadSiteConfig & createSiteConfigHttpMiddleware without altering default shape', async () => {
    // 1. Default omitted backend preserves exact { singlePlayerEnabled } shape
    const cfgDefault = await loadSiteConfig({
      fetchFn: async () =>
        new Response(JSON.stringify({ singlePlayerEnabled: true }), { status: 200 }),
    })
    expect(cfgDefault).toEqual({ singlePlayerEnabled: true })

    // 2. Explicit d2kern-113c backend in site-config.json
    const cfgKern = await loadSiteConfig({
      fetchFn: async () =>
        new Response(
          JSON.stringify({ singlePlayerEnabled: true, singlePlayerBackend: 'd2kern-113c' }),
          { status: 200 },
        ),
    })
    expect(cfgKern).toEqual({
      singlePlayerEnabled: true,
      singlePlayerBackend: 'd2kern-113c',
    })

    // 3. Env override fallback when fetch fails
    const cfgEnv = await loadSiteConfig({
      buildEnvSinglePlayer: 'true',
      buildEnvSinglePlayerBackend: 'd2kern-113c',
      fetchFn: async () => {
        throw new Error('offline')
      },
    })
    expect(cfgEnv).toEqual({
      singlePlayerEnabled: true,
      singlePlayerBackend: 'd2kern-113c',
    })

    // 4. Dev server HTTP middleware serves singlePlayerBackend cleanly
    const tempPublicDir = mkdtempSync(join(tmpdir(), 'd2w-k5-sitecfg-'))
    try {
      writeFileSync(
        join(tempPublicDir, 'site-config.json'),
        JSON.stringify({ singlePlayerEnabled: true, singlePlayerBackend: 'd2kern-113c' }),
      )
      const mw = createSiteConfigHttpMiddleware({ publicDir: tempPublicDir, env: {} })
      let status = 0
      let body = ''
      await new Promise<void>((resolve) => {
        const req = { method: 'GET', url: '/site-config.json?ts=1' } as IncomingMessage
        const res = {
          setHeader: () => res,
          end: (chunk?: string) => {
            body = chunk ?? ''
            resolve()
          },
          get statusCode() {
            return status
          },
          set statusCode(v: number) {
            status = v
          },
        } as unknown as ServerResponse
        mw(req, res, () => resolve())
      })
      expect(status).toBe(200)
      expect(JSON.parse(body)).toEqual({
        singlePlayerEnabled: true,
        singlePlayerBackend: 'd2kern-113c',
      })
    } finally {
      rmSync(tempPublicDir, { recursive: true, force: true })
    }
  })

  it('switches LocalLobbyProvider and createLocalLoopbackSession between legacy and d2kern-113c backends', async () => {
    const lobby = new LocalLobbyProvider({ defaultMapSeed: 0x2468ace0 })
    expect(lobby.getBackend()).toBe('legacy')

    await lobby.createCharacter({
      name: 'SwitchSor',
      classId: 1,
      expansion: true,
      hardcore: false,
      ladder: false,
    })

    // 1. Default legacy mode returns LocalLoopbackAdapter
    const legacyAdapter = await lobby.enterGame({ charName: 'SwitchSor' })
    expect(legacyAdapter).toBeInstanceOf(LocalLoopbackAdapter)
    legacyAdapter.leave()

    // 2. Per-call override returns LocalKernelD2gsAdapter113c over compressed ByteStream + D2gsAdapter
    const perCallKern = await lobby.enterGame({
      charName: 'SwitchSor',
      backend: 'd2kern-113c',
    })
    expect(perCallKern).toBeInstanceOf(LocalKernelD2gsAdapter113c)
    expect(perCallKern.kind).toBe('d2kern-113c')
    expect(perCallKern.state).toBe('ingame')
    expect(perCallKern.stats.bytesIn).toBeGreaterThan(20)
    expect(perCallKern.stats.bytesOut).toBeGreaterThan(30)
    expect(perCallKern.stats.protocolErrors).toBe(0)
    perCallKern.leave()

    // 3. Provider-level setBackend('d2kern-113c') switches default Single-Player runtime
    lobby.setBackend('d2kern-113c')
    expect(lobby.getBackend()).toBe('d2kern-113c')
    const switchedAdapter = await lobby.enterSinglePlayerGame('SwitchSor')
    expect(switchedAdapter).toBeInstanceOf(LocalKernelD2gsAdapter113c)
    switchedAdapter.leave()

    // 4. Factory helpers createLocalLoopbackSession({ backend: 'd2kern-113c' }) & createLocalKernelSession113c
    const factorySession = createLocalLoopbackSession({
      backend: 'd2kern-113c',
      charName: 'SwitchPal',
      charClass: 3,
      mapSeed: 0x13579bdf,
    })
    expect(factorySession.adapter).toBeInstanceOf(LocalKernelD2gsAdapter113c)
    expect(factorySession.gameAdapter.playerId).toBeGreaterThan(0)
    factorySession.adapter.leave()

    const directKern = createLocalKernelSession113c({
      charName: 'DirectAma',
      classId: 0,
      mapSeed: 0xfeedface,
    })
    expect(directKern.gameAdapter.kind).toBe('d2kern-113c')
    directKern.adapter.leave()
  })

  it('drives full OnlineSession Single-Player lifecycle over LocalKernelD2gsAdapter113c (DRLG town, walk/run, 800x600 & 1280x720 snapshots, stat spend & .d2s auto-save)', async () => {
    const lobby = new LocalLobbyProvider({
      defaultMapSeed: 0x5150113c,
      backend: 'd2kern-113c',
    })
    await lobby.createCharacter({
      name: 'KernRunner',
      classId: 1,
      expansion: true,
      hardcore: false,
      ladder: false,
    })

    const areaLevelSource = buildRogueEncampmentLevelSource()
    const chars = await lobby.listCharacters()
    expect(chars.length).toBe(1)

    const adapter = await lobby.enterKernelGame({
      charName: 'KernRunner',
      areaLevelSource,
      playersX: 4,
    })
    expect(adapter).toBeInstanceOf(LocalKernelD2gsAdapter113c)
    expect(adapter.getPlayersX()).toBe(4)

    const session = new OnlineSession()
    const lostEvents: unknown[] = []
    session.onSessionLost((ev) => lostEvents.push(ev))

    session.attachGameServer(adapter, {
      localCharacter: {
        characters: chars,
        selectedName: 'KernRunner',
        writeProgression: (name, prog) => lobby.writeCharacterProgression(name, prog),
      },
    })

    let simNowMs = performance.now() + 200
    const stepSession40 = (): void => {
      simNowMs += 40
      session.tick(40, simNowMs)
    }

    stepSession40()
    expect(session.phase).toBe('ingame')
    expect(session.world.areaId).toBe(1)
    expect(session.world.act).toBe(0)
    expect(session.world.selfId).toBe(adapter.playerId)
    expect(session.world.self.name).toBe('KernRunner')

    // Verify DRLG rooms, Rogue Encampment NPCs (Akara 148, Warriv 155), and town objects (Stash 267, Waypoint 119)
    expect(session.world.monsters.size).toBeGreaterThanOrEqual(2)
    const objectUnits = [...session.world.units.values()].filter((u) => u.unitType === 'object')
    expect(objectUnits.length).toBeGreaterThanOrEqual(2)
    const monsterClasses = [...session.world.monsters.values()].map((m) => m.classId)
    expect(monsterClasses).toEqual(expect.arrayContaining([148, 155]))
    const objectClasses = objectUnits.map((o) => o.classId)
    expect(objectClasses).toEqual(expect.arrayContaining([267, 119]))

    const startServerX = UNITS_GetX113c(adapter.bridge.m, adapter.handle.getPlayerPtr())
    const startServerY = UNITS_GetY113c(adapter.bridge.m, adapter.handle.getPlayerPtr())
    const startClientX = session.world.self.x
    const startClientY = session.world.self.y

    // Walk across Rogue Encampment at 800x600
    session.sendCommand(
      {
        type: 'Move',
        to: { x: asSubTile(startServerX + 8), y: asSubTile(startServerY + 6) },
        run: false,
      },
      simNowMs,
    )
    for (let i = 0; i < 18; i++) {
      stepSession40()
    }
    session.sceneSource.setViewportProfile(VIEWPORT_800x600)
    const snap800 = session.sceneSource.buildFrameSnapshot()
    expect(snap800.viewportProfile.width).toBe(800)
    expect(snap800.viewportProfile.height).toBe(600)
    expect(snap800.levelId).toBe(1)

    // Run further across Rogue Encampment at 1280x720
    const midServerX = UNITS_GetX113c(adapter.bridge.m, adapter.handle.getPlayerPtr())
    const midServerY = UNITS_GetY113c(adapter.bridge.m, adapter.handle.getPlayerPtr())
    expect(Math.hypot(midServerX - startServerX, midServerY - startServerY)).toBeGreaterThan(2)

    session.sendCommand(
      {
        type: 'Move',
        to: { x: asSubTile(midServerX + 8), y: asSubTile(midServerY - 4) },
        run: true,
      },
      simNowMs,
    )
    for (let i = 0; i < 16; i++) {
      stepSession40()
    }
    const endServerX = UNITS_GetX113c(adapter.bridge.m, adapter.handle.getPlayerPtr())
    const endServerY = UNITS_GetY113c(adapter.bridge.m, adapter.handle.getPlayerPtr())
    session.sceneSource.setViewportProfile(VIEWPORT_1280x720)
    const snap1280 = session.sceneSource.buildFrameSnapshot()
    expect(snap1280.viewportProfile.width).toBe(1280)
    expect(snap1280.viewportProfile.height).toBe(720)
    expect(Math.hypot(endServerX - midServerX, endServerY - midServerY)).toBeGreaterThan(3)
    expect(Math.hypot(endServerX - startClientX, endServerY - startClientY)).toBeGreaterThan(5)

    // Verify PauseGame freezes kernel frame progression while keeping adapter healthy
    const frameBeforePause = adapter.bridge.frame
    adapter.send({ type: 'PauseGame', paused: true })
    expect(adapter.isPaused()).toBe(true)
    expect(adapter.tick(120)).toBe(0)
    expect(adapter.bridge.frame).toBe(frameBeforePause)
    adapter.send({ type: 'PauseGame', paused: false })
    expect(adapter.isPaused()).toBe(false)

    // Grant 5 stat points in SparseMemory113c (`STAT_STATPTS = 4`) and spend 1 on Strength (`0x3A`)
    const pPlayer = adapter.handle.getPlayerPtr()
    STATLIST_SetUnitStat113c(adapter.bridge.m, pPlayer, 4, 5, 0)
    adapter.send({ type: 'AddStatPoint', statId: 0 })
    stepSession40()

    expect(adapter.stats.protocolErrors).toBe(0)

    // Save & exit (`leaveGame`) -> exports updated .d2s back into LocalLobbyProvider
    await session.leaveGame()
    expect(lostEvents).toEqual([])
    expect(adapter.state).toBe('closed')

    const savedBytes = lobby.getCharacterD2s('KernRunner')
    expect(savedBytes).toBeDefined()
    const reparsed = readD2sSave113c(savedBytes!)
    // Sorceress base Strength is 10; spending +1 Strength persists 11 into `.d2s`
    expect(reparsed.attributes.strength).toBe(11)
    expect(reparsed.attributes.statPts).toBe(4)

    // Re-entering a second d2kern-113c game restores persisted Strength = 11
    const secondAdapter = await lobby.enterKernelGame({
      charName: 'KernRunner',
      areaLevelSource,
    })
    session.attachGameServer(secondAdapter, {
      localCharacter: {
        characters: await lobby.listCharacters(),
        selectedName: 'KernRunner',
        writeProgression: (name, prog) => lobby.writeCharacterProgression(name, prog),
      },
    })
    session.tick(40)
    expect(session.world.self.stats.get(0)).toBe(11)
    await session.leaveGame()
    expect(lostEvents).toEqual([])
  })

  it(
    'verifies live play.html Single-Player on d2kern-113c backend across 800x600, 1068x600, and 1280x720 in headless Chrome',
    async () => {
      const outDir = join(tmpdir(), 'd2w-k5-sp-kern-vitest')
      const res = await runK5BrowserMultiresE2e({
        outDir,
        singlePlayerBackend: 'd2kern-113c',
        forceLocalWorktreeServer: true,
      })

      expect(res.usedLiveServer8080).toBe(false)
      expect(res.bootProgressPercent).toBe(100)
      expect(res.singlePlayerEnabled).toBe(true)
      expect(res.singlePlayerBackend).toBe('d2kern-113c')
      expect(res.areaId).toBe(1)
      expect(res.act).toBe(0)
      expect(res.consoleErrors).toEqual([])
      expect(res.pageExceptions).toEqual([])

      expect(res.resolutions.map((r) => r.viewport)).toEqual(['800x600', '1068x600', '1280x720'])

      for (const audit of res.resolutions) {
        expect(audit.viewCanvasWidth).toBe(audit.expectedWidth)
        expect(audit.viewCanvasHeight).toBe(audit.expectedHeight)
        expect(audit.hudCanvasWidth).toBe(audit.expectedWidth)
        expect(audit.hudCanvasHeight).toBe(audit.expectedHeight)
        expect(audit.webglNonBlackRatio).toBeGreaterThan(0.25)
        expect(audit.hudBarOpaquePixels).toBeGreaterThan(2000)
        expect(audit.hudPanelsOpaquePixels).toBeGreaterThan(20000)
        expect(audit.panelsToggled).toEqual([
          'inventory',
          'character',
          'skillTree',
          'questLog',
          'party',
          'escapeMenu',
        ])
        expect(audit.moveCommandsSent).toBeGreaterThanOrEqual(1)
        expect(audit.movedDistanceSubtiles).toBeGreaterThanOrEqual(1.0)
      }

      expect(res.screenshots.length).toBe(10)
      for (const shot of res.screenshots) {
        expect(existsSync(shot.filePath)).toBe(true)
        const diskBytes = new Uint8Array(readFileSync(shot.filePath))
        const verifyClean = stripPngAncillaryChunks(diskBytes)
        expect(verifyClean.droppedChunks).toEqual([])
      }
    },
    180_000,
  )
})
