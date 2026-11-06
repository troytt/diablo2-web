import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  appendIncomingLobbyChatMessage,
  createInitialFlowState,
} from '../../src/client/frontend/flow-state.ts'
import {
  FRONTEND_COLOR_INDICES,
  FrontendRenderer,
  normalizeFrontendColorIndex,
  STATIC_UI_IMAGES,
  type FrontendFontName,
  type FrontendManifest,
} from '../../src/client/frontend/frontend-renderer.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import type { ChatLogEntry } from '../../src/client/world/world-skill-state-tables.ts'
import type { GameServerAdapter, ServerEvent } from '../../src/netproto/index.ts'

function createMockCanvas(width = 800, height = 600) {
  const drawCalls: Array<{ key: string; dx: number; dy: number }> = []
  const fillTextCalls: Array<{ text: string; fillStyle: string }> = []
  const ctx = {
    imageSmoothingEnabled: false,
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    shadowColor: 'transparent',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'middle',
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    clip: () => {},
    rect: () => {},
    fillText: (text: string) => {
      fillTextCalls.push({ text, fillStyle: String(ctx.fillStyle) })
    },
    measureText: (text: string) => ({ width: text.length * 12 }),
    drawImage: (
      img: { id?: string },
      sx: number,
      sy: number,
      _sw?: number,
      _sh?: number,
      dx?: number,
      dy?: number,
    ) => {
      drawCalls.push({
        key: img?.id ?? '',
        dx: dx ?? sx,
        dy: dy ?? sy,
      })
    },
  }
  const canvas = {
    width,
    height,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
  } as unknown as HTMLCanvasElement
  return { canvas, ctx, drawCalls, fillTextCalls }
}

function makeLobbyRenderer() {
  const frontendDir = join(process.cwd(), 'public', 'ui', 'frontend')
  const manifest = JSON.parse(
    readFileSync(join(frontendDir, 'manifest.json'), 'utf8'),
  ) as FrontendManifest
  const fontMetas = JSON.parse(readFileSync(join(frontendDir, 'fonts', 'metrics.json'), 'utf8'))
  const { canvas, drawCalls, fillTextCalls } = createMockCanvas(800, 600)
  const state = createInitialFlowState()
  const renderer = new FrontendRenderer(canvas, state)
  renderer.manifest = manifest
  renderer.fontMetas = fontMetas
  renderer.ready = true

  for (const rel of STATIC_UI_IMAGES) {
    renderer.images.set(rel, { id: rel, width: 800, height: 600 } as unknown as HTMLImageElement)
  }
  for (const strip of Object.values(manifest.animStrips)) {
    renderer.images.set(
      strip.file,
      { id: strip.file, width: strip.width, height: strip.height } as unknown as HTMLImageElement,
    )
  }
  for (const strip of Object.values(manifest.charAvatars)) {
    renderer.images.set(
      strip.file,
      { id: strip.file, width: strip.width, height: strip.height } as unknown as HTMLImageElement,
    )
  }
  const activeFonts: FrontendFontName[] = [
    'font6',
    'font8',
    'font16',
    'font24',
    'font30',
    'font42',
    'fontexocet10',
    'fontformal10',
    'fontformal11',
    'fontformal12',
    'fontridiculous',
  ]
  for (const fn of activeFonts) {
    for (const c of FRONTEND_COLOR_INDICES) {
      const key = `fonts/${fn}-c${c}.png`
      renderer.images.set(key, { id: key, width: 256, height: 256 } as unknown as HTMLImageElement)
    }
  }
  renderer.cursorAtlas = { id: '/ui/cursor.png', width: 256, height: 176 } as unknown as HTMLImageElement

  state.stage = 'bnet_lobby'
  state.channelName = 'Diablo II USA-1'
  state.roster = [
    {
      id: 'am-hero',
      name: 'AmazonHero',
      classId: 'am',
      heroToken: 'am',
      className: 'Amazon',
      level: 88,
      isExpansion: true,
      isHardcore: false,
      isLadder: true,
      maxDifficulty: 'hell',
      createdAt: 0,
    },
  ]
  state.selectedSlotIndex = 0
  return { renderer, state, drawCalls, fillTextCalls, manifest, frontendDir }
}

describe('Battle.net Lobby Chat Channel Isolation & Full 13-Color Font Atlas Support', () => {
  it('bakes all 13 sky/pal.pl2 textShifts (colors 0..12) across all 12 frontend bitmap fonts', () => {
    const { manifest, frontendDir } = makeLobbyRenderer()
    expect(manifest.fontColors).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

    const allBakedFonts: FrontendFontName[] = [
      'font6',
      'font8',
      'font16',
      'font24',
      'font30',
      'font42',
      'fontexocet8',
      'fontexocet10',
      'fontformal10',
      'fontformal11',
      'fontformal12',
      'fontridiculous',
    ]
    for (const fn of allBakedFonts) {
      for (const c of FRONTEND_COLOR_INDICES) {
        const pngPath = join(frontendDir, 'fonts', `${fn}-c${c}.png`)
        expect(existsSync(pngPath), pngPath).toBe(true)
        const header = readFileSync(pngPath).subarray(0, 4)
        expect([...header]).toEqual([0x89, 0x50, 0x4e, 0x47])
      }
    }
  })

  it('clamps out-of-range color indices (< 0 or >= 13) to 0 (White) per D2Win.dll 0x6f8f283a', () => {
    for (let c = 0; c <= 12; c++) {
      expect(normalizeFrontendColorIndex(c)).toBe(c)
    }
    expect(normalizeFrontendColorIndex(undefined)).toBe(0)
    expect(normalizeFrontendColorIndex(-1)).toBe(0)
    expect(normalizeFrontendColorIndex(13)).toBe(0)
    expect(normalizeFrontendColorIndex(255)).toBe(0)
    expect(normalizeFrontendColorIndex(Number.NaN)).toBe(0)
  })

  it('isolates D2GS S2C 0x26 / 0x5A in-game packets (including earlyEvents color=11 system alerts) from Battle.net lobby chat while allowing BNCS lobby messages', () => {
    const { canvas } = createMockCanvas(800, 600)
    const hudManager = new HudManager(canvas)
    const session = new OnlineSession({ hudManager })
    const flowState = createInitialFlowState()
    flowState.stage = 'bnet_lobby'

    // Simulate main.ts: inGameView is still false when attachGameServer synchronously drains earlyEvents
    let inGameView = false
    const observedEntries: ChatLogEntry[] = []
    session.onChatMessage((entry) => {
      observedEntries.push(entry)
      appendIncomingLobbyChatMessage(flowState, entry, {
        inGameView,
        sessionPhase: session.phase,
      })
    })

    // 1. BNCS channel messages while in lobby ARE recorded into flowState.chatMessages / chatEntries
    session.handleBncsChatEvent({
      kind: 'info',
      eventId: 0x12,
      username: 'Battle.net',
      text: '\xffc8[D2GS] - Server online.',
    })
    session.handleBncsChatEvent({
      kind: 'talk',
      eventId: 0x05,
      username: 'LobbyPeer',
      text: 'Anyone running Baal?',
    })
    expect(observedEntries).toHaveLength(2)
    expect(observedEntries[0]?.source).toBe('bncs')
    expect(observedEntries[1]?.source).toBe('bncs')
    expect(flowState.chatMessages).toEqual([
      '\xffc8[D2GS] - Server online.',
      '<LobbyPeer> Anyone running Baal?',
    ])

    // 2. Attach D2GS adapter that synchronously replays earlyEvents (like D2gsServerAdapter before inGameAssetsPromise resolves)
    const earlyEvents: ServerEvent[] = [
      {
        type: 'Chat',
        kind: 'system',
        eventType: 0x04,
        color: 11, // Purple D2GS system announcement
        from: '[Server]',
        text: 'Terror gazes upon Sanctuary.',
      } as unknown as ServerEvent,
      {
        type: 'Chat',
        kind: 'event',
        eventType: 0x02,
        color: 4,
        from: 'AmazonHero',
        name2: 'ama_acct',
        text: '',
      } as unknown as ServerEvent,
      {
        type: 'Chat',
        kind: 'say',
        eventType: 0x01,
        color: 0,
        from: 'InGamePeer',
        text: 'tp up',
      } as unknown as ServerEvent,
    ]
    const mockAdapter: GameServerAdapter = {
      state: 'ingame',
      stats: { unknownPackets: 0, opaquePackets: 0, rttMs: 12, bytesIn: 0, bytesOut: 0 },
      send: () => {},
      onClose: () => () => {},
      leave: () => {},
      onEvent: (cb) => {
        for (const ev of earlyEvents) {
          cb(ev)
        }
        return () => {}
      },
    }

    session.attachGameServer(mockAdapter)
    inGameView = true

    // Listeners still observe D2GS chat events with source === 'd2gs', and in-game HUD has them:
    expect(observedEntries).toHaveLength(5)
    expect(observedEntries[2]?.source).toBe('d2gs')
    expect(observedEntries[2]?.color).toBe(11)
    expect(observedEntries[3]?.source).toBe('d2gs')
    expect(observedEntries[4]?.source).toBe('d2gs')
    expect(session.world.chatLog.some((e) => e.color === 11)).toBe(true)

    // Crucially, flowState.chatMessages & chatEntries MUST NOT contain any D2GS in-game messages!
    expect(flowState.chatMessages).toEqual([
      '\xffc8[D2GS] - Server online.',
      '<LobbyPeer> Anyone running Baal?',
    ])
    expect(flowState.chatEntries).toHaveLength(2)

    // 3. BNCS broadcast arriving while in-game goes to in-game overlay, NOT lobby chat buffer
    session.handleBncsChatEvent({
      kind: 'broadcast',
      eventId: 0x06,
      username: 'Admin',
      text: 'Server broadcast while in game',
    })
    expect(flowState.chatMessages).toHaveLength(2)

    session.destroy()
  })

  it('renders bnet_lobby completely without throwing for all colors 0..12, inline 0xFFcX escapes, CJK, and out-of-range colors', () => {
    const { renderer, state, drawCalls, fillTextCalls } = makeLobbyRenderer()
    state.chatMessages = [
      'Black c6 line',
      'DarkGreen c10 line',
      'Purple c11 暗黑破坏神公告',
      'MediumGreen c12 line',
      '\xffc8[D2GS] - \xffc;Purple \xffc<Green \xffc=ResetWhite',
      'OutOfRange color 99 clamped',
    ]
    state.chatEntries = [
      { text: state.chatMessages[0]!, color: 6, kind: 'system' },
      { text: state.chatMessages[1]!, color: 10, kind: 'system' },
      { text: state.chatMessages[2]!, color: 11, kind: 'system' },
      { text: state.chatMessages[3]!, color: 12, kind: 'system' },
      { text: state.chatMessages[4]!, color: 0, kind: 'system' },
      { text: state.chatMessages[5]!, color: 99, kind: 'system' },
    ]

    expect(() => renderer.render(0)).not.toThrow()

    const drawnKeys = new Set(drawCalls.map((d) => d.key))
    expect(drawnKeys.has('fonts/fontformal11-c6.png')).toBe(true)
    expect(drawnKeys.has('fonts/fontformal11-c10.png')).toBe(true)
    expect(drawnKeys.has('fonts/fontformal11-c11.png')).toBe(true)
    expect(drawnKeys.has('fonts/fontformal11-c12.png')).toBe(true)
    expect(drawnKeys.has('fonts/fontformal11-c8.png')).toBe(true)
    expect(drawnKeys.has('fonts/fontformal11-c0.png')).toBe(true)

    expect(fillTextCalls.some((c) => c.text === '暗' && c.fillStyle === '#a420fc')).toBe(true)

    expect(drawnKeys.has('bg-waiting-room.png')).toBe(true)
    expect(drawnKeys.has('gembutton.png')).toBe(true)
    expect(drawnKeys.has('create-game-bg.png')).toBe(true)
    expect(drawnKeys.has('btn-create-cancel.png')).toBe(true)
    expect(drawnKeys.has('btn-game.png')).toBe(true)
    expect(drawnKeys.has('/ui/cursor.png')).toBe(true)
  })
})
