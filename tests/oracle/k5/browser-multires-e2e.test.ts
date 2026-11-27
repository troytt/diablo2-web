/**
 * Milestone 36 [K5] Single-Player `d2kern-113c` Mode & `800x600` + `1068x600` + `1280x720`
 * Real Headless Browser E2E Verification Gate.
 */

import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import {
  VIEWPORT_1068x600,
  VIEWPORT_1280x720,
  VIEWPORT_800x600,
} from '../../../src/client/view/viewport-profile.ts'
import {
  C2S_DispatchPacketMem113c,
  D2ClientStrcOffsets,
  D2NET_MODE_LOCAL_113C,
  D2NET_QUEUE_GAMEPLAY_113C,
  D2NetPacketSink113c,
  D2UnitStrc,
  PLRMODE_RUN,
  PLRMODE_WALK,
  SparseMemory113c,
} from '../../../src/d2kern-113c/index.ts'
import { LocalLobbyProvider } from '../../../src/server/loopback-adapter.ts'
import {
  runK5BrowserMultiresE2e,
  stripPngAncillaryChunks,
} from '../../../tools/oracle/k5/verify-browser-multires-e2e.ts'

function buildSyntheticPngWithAncillaryChunks(): Uint8Array {
  // Minimal 1x1 RGB PNG + injected tEXt, eXIf, and caBX ancillary chunks before IEND
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const makeChunk = (type: string, data: readonly number[]): number[] => {
    const len = data.length
    const out = [
      (len >>> 24) & 0xff,
      (len >>> 16) & 0xff,
      (len >>> 8) & 0xff,
      len & 0xff,
      type.charCodeAt(0),
      type.charCodeAt(1),
      type.charCodeAt(2),
      type.charCodeAt(3),
      ...data,
      0x12,
      0x34,
      0x56,
      0x78,
    ]
    return out
  }
  const ihdr = makeChunk('IHDR', [0, 0, 3, 0x20, 0, 0, 2, 0x58, 8, 2, 0, 0, 0]) // 800x600
  const text = makeChunk('tEXt', [0x41, 0x75, 0x74, 0x68, 0x6f, 0x72, 0x00, 0x78])
  const exif = makeChunk('eXIf', [0x4d, 0x4d, 0x00, 0x2a])
  const cabx = makeChunk('caBX', [0x63, 0x32, 0x70, 0x61])
  const idat = makeChunk('IDAT', [0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01])
  const iend = makeChunk('IEND', [])
  return new Uint8Array([...sig, ...ihdr, ...text, ...exif, ...cabx, ...idat, ...iend])
}

describe('[K5] Single-Player d2kern-113c Loopback & Multi-Resolution Real Browser E2E', () => {
  it('strips EXIF, C2PA, and text ancillary chunks from PNG artifacts', () => {
    const dirtyPng = buildSyntheticPngWithAncillaryChunks()
    const stripped = stripPngAncillaryChunks(dirtyPng)
    expect(stripped.width).toBe(800)
    expect(stripped.height).toBe(600)
    expect(stripped.droppedChunks).toEqual(['tEXt', 'eXIf', 'caBX'])
    expect(stripped.cleanPng.byteLength).toBeLessThan(dirtyPng.byteLength)

    // Re-running on already stripped PNG drops 0 chunks
    const secondPass = stripPngAncillaryChunks(stripped.cleanPng)
    expect(secondPass.droppedChunks).toEqual([])
    expect(secondPass.width).toBe(800)
    expect(secondPass.height).toBe(600)
  })

  it('steps d2kern-113c D2NET_MODE_LOCAL_113C C2S/S2C loopback and OnlineSession across 800x600 and 1280x720', async () => {
    // 1. Pure d2kern-113c local-mode (`[0x6FBFB418] == 1`) C2S Walk (`0x01`) / Run (`0x03`) + S2C loopback
    const m = new SparseMemory113c()
    const sink = new D2NetPacketSink113c({ netMode: D2NET_MODE_LOCAL_113C })
    expect(sink.mode).toBe(D2NET_MODE_LOCAL_113C)
    sink.registerClient(1, '127.0.0.1')

    const pGame = m.alloc(0x1e00)
    const pTimer = m.alloc(0xa20)
    m.setU32(pGame + 0xb8, pTimer)
    const pClient = m.alloc(0x200)
    const pPlayer = m.alloc(0x100)
    const pPath = m.alloc(0x200)
    const pRoom = m.alloc(0x80)
    const pRoomEx = m.alloc(0x80)
    const pAct = m.alloc(0x60)
    const pActUpdateFlag = m.alloc(0x10)
    const pPacketBuf = m.alloc(0x40)
    const pS2cOut = m.alloc(0x20)

    m.set(pPlayer, D2UnitStrc.dwUnitType, 0)
    m.set(pPlayer, D2UnitStrc.dwClassId, 1)
    m.set(pPlayer, D2UnitStrc.dwUnitId, 1)
    m.set(pPlayer, D2UnitStrc.dwAnimMode, 1)
    m.set(pPlayer, D2UnitStrc.pPath, pPath)
    m.set(pPlayer, D2UnitStrc.pGame, pGame)
    m.set(pPlayer, D2UnitStrc.pAct, pAct)
    m.setU16(pPath + 0x02, 5100)
    m.setU16(pPath + 0x06, 5120)
    m.setU32(pPath + 0x1c, pRoom)
    m.setU32(pPath + 0x30, pPlayer)
    m.setU32(pRoom + 0x10, pRoomEx)
    m.setU32(pRoom + 0x2c, pActUpdateFlag)

    m.setU32(pClient + D2ClientStrcOffsets.dwClientId, 1)
    m.setU32(pClient + D2ClientStrcOffsets.dwClientState, 4)
    m.setU32(pClient + D2ClientStrcOffsets.pPlayer, pPlayer)

    // Enqueue C2S 0x01 WalkToLocation (x=5112, y=5128) via D2NetPacketSink113c Queue 1
    const c2sWalk = new Uint8Array([0x01, 0xf8, 0x13, 0x08, 0x14])
    expect(sink.enqueueC2SPacket(1, c2sWalk, D2NET_QUEUE_GAMEPLAY_113C)).toBe(true)
    const dequeuedLen = sink.dequeueC2SToMemory(m, D2NET_QUEUE_GAMEPLAY_113C, pPacketBuf, 0x40)
    expect(dequeuedLen).toBe(5)
    expect(m.u32(pPacketBuf)).toBe(1)

    let startedMode = 0
    let targetWalkX = 0
    let targetWalkY = 0
    const walkRes = C2S_DispatchPacketMem113c(m, pGame, pClient, pPacketBuf + 4, dequeuedLen, {
      startPlayerModeAtCoords: (_mem, _g, _plr, mode, tx, ty) => {
        startedMode = mode
        targetWalkX = tx
        targetWalkY = ty
        return 1
      },
    })
    expect(walkRes).toBe(5)
    expect(startedMode).toBe(PLRMODE_WALK)
    expect(targetWalkX).toBe(0x13f8)
    expect(targetWalkY).toBe(0x1408)

    // Enqueue C2S 0x03 RunToLocation (x=5120, y=5136)
    const c2sRun = new Uint8Array([0x03, 0x00, 0x14, 0x10, 0x14])
    expect(sink.enqueueC2SPacket(1, c2sRun, D2NET_QUEUE_GAMEPLAY_113C)).toBe(true)
    const runLen = sink.dequeueC2SToMemory(m, D2NET_QUEUE_GAMEPLAY_113C, pPacketBuf, 0x40)
    expect(
      C2S_DispatchPacketMem113c(m, pGame, pClient, pPacketBuf + 4, runLen, {
        startPlayerModeAtCoords: (_mem, _g, _plr, mode) => {
          startedMode = mode
          return 1
        },
      }),
    ).toBe(5)
    expect(startedMode).toBe(PLRMODE_RUN)

    // Emit S2C 0x0F PlayerMove (`16` bytes) in D2NET_MODE_LOCAL_113C (uncompressed 1:1 local loopback)
    m.setU8(pS2cOut + 0, 0x0f)
    m.setU8(pS2cOut + 1, 0x00)
    m.setU32(pS2cOut + 2, 1)
    m.setU8(pS2cOut + 6, 0x01)
    m.setU16(pS2cOut + 7, 0x13f8)
    m.setU16(pS2cOut + 9, 0x1408)
    m.setU8(pS2cOut + 11, 0)
    m.setU16(pS2cOut + 12, 5100)
    m.setU16(pS2cOut + 14, 5120)
    const sentBytes = sink.sendPacketFromMemory(m, 1, 1, pS2cOut, 16)
    expect(sentBytes).toBe(16)
    const captured = sink.drainClient(1)
    expect(captured.length).toBe(1)
    expect(captured[0]!.opcode).toBe(0x0f)
    expect(captured[0]!.bytes.byteLength).toBe(16)
    expect(captured[0]!.wireBytes).toBeUndefined()

    // 2. Verify Single-Player OnlineSession + HUD resize anchors at 800x600, 1068x600, and 1280x720
    expect(VIEWPORT_800x600).toMatchObject({ barOffsetX: 0, barOffsetY: 0, panelOffsetY: 0 })
    expect(VIEWPORT_1068x600).toMatchObject({ barOffsetX: 134, barOffsetY: 0, panelOffsetY: 0 })
    expect(VIEWPORT_1280x720).toMatchObject({ barOffsetX: 240, barOffsetY: 120, panelOffsetY: 60 })

    const lobby = new LocalLobbyProvider()
    await lobby.createCharacter({ name: 'K5Local', classId: 1 })
    const session = new OnlineSession()
    const adapter = await lobby.enterGame({ charName: 'K5Local', difficulty: 0 })
    session.attachGameServer(adapter, {
      localCharacter: {
        characters: await lobby.listCharacters(),
        selectedName: 'K5Local',
        writeProgression: (n, p) => lobby.writeCharacterProgression(n, p),
      },
    })
    session.hudManager.resize(800, 600)
    session.tick(40, 40)
    expect(session.phase).toBe('ingame')
    session.hudManager.resize(1280, 720)
    session.tick(40, 80)
    expect(session.world.selfId).toBeGreaterThan(0)
    await session.leaveGame()
  })

  it(
    'verifies live play.html boot, Single-Player town entry, HUD/panels, walk movement, and zero errors across 800x600, 1068x600, and 1280x720',
    async () => {
      const outDir = join(tmpdir(), 'd2w-k5-screenshots')
      const res = await runK5BrowserMultiresE2e({ outDir })

      expect(res.bootProgressPercent).toBe(100)
      expect(res.singlePlayerEnabled).toBe(true)
      expect(res.areaId).toBe(1)
      expect(res.consoleErrors).toEqual([])
      expect(res.pageExceptions).toEqual([])
      expect(res.resolutions.map((r) => r.viewport)).toEqual(['800x600', '1068x600', '1280x720'])

      for (const audit of res.resolutions) {
        expect(audit.viewCanvasWidth).toBe(audit.expectedWidth)
        expect(audit.viewCanvasHeight).toBe(audit.expectedHeight)
        expect(audit.hudCanvasWidth).toBe(audit.expectedWidth)
        expect(audit.hudCanvasHeight).toBe(audit.expectedHeight)
        expect(audit.webglNonBlackRatio).toBeGreaterThanOrEqual(0.08)
        expect(audit.hudBarOpaquePixels).toBeGreaterThanOrEqual(1000)
        expect(audit.hudPanelsOpaquePixels).toBeGreaterThanOrEqual(5000)
        expect(audit.panelsToggled).toEqual([
          'inventory',
          'character',
          'skillTree',
          'questLog',
          'party',
          'escapeMenu',
        ])
        expect(audit.moveCommandsSent).toBeGreaterThanOrEqual(1)
        expect(audit.movedDistanceSubtiles).toBeGreaterThanOrEqual(1.5)
        expect(audit.missingArtCount).toBe(0)
      }

      // 1 main_menu + 3 * (town + panels + walk) = 10 clean metadata-stripped screenshots
      expect(res.screenshots.length).toBe(10)
      for (const shot of res.screenshots) {
        expect(existsSync(shot.filePath)).toBe(true)
        expect(shot.byteLength).toBeGreaterThan(5000)
        const diskBytes = new Uint8Array(readFileSync(shot.filePath))
        const recheck = stripPngAncillaryChunks(diskBytes)
        expect(recheck.droppedChunks).toEqual([])
        expect(recheck.width).toBe(shot.pngWidth)
        expect(recheck.height).toBe(shot.pngHeight)
      }
    },
    180_000,
  )
})
