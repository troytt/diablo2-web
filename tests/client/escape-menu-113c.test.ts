import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import {
  ESCAPE_MENU_BANNER_SIZES,
  ESCAPE_MENU_PENTSPIN_FRAMES,
  ESCAPE_MENU_PENTSPIN_MAX_WIDTH,
  WorldPanelsHud,
  computeEscapeMenuLayout,
  hitTestEscapeMenu,
} from '../../src/client/ui/world-panels.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'

describe('Diablo II v1.13c In-Game Escape Menu (D2Client.dll gmenu.cpp 0x6fb13b00..0x6fb16300)', () => {
  it('verifies packed Escape menu PNG assets exist in public/ui/', () => {
    const publicUiDir = resolve(process.cwd(), 'public/ui')
    expect(existsSync(resolve(publicUiDir, 'esc-options.png'))).toBe(true)
    expect(existsSync(resolve(publicUiDir, 'esc-exit.png'))).toBe(true)
    expect(existsSync(resolve(publicUiDir, 'esc-return.png'))).toBe(true)
    expect(existsSync(resolve(publicUiDir, 'pentspin.png'))).toBe(true)
  })

  it('computes exact 1.13c Escape menu geometry for 800x600 and 1024x768', () => {
    const layout800 = computeEscapeMenuLayout(800, 600, 2, 0)
    // topY = (600 - 80) / 2 - (3 * 50) / 2 = 260 - 75 = 185
    expect(layout800.centerX).toBe(400)
    expect(layout800.topY).toBe(185)
    expect(layout800.rowStepY).toBe(50)
    expect(layout800.totalHeight).toBe(150)
    expect(layout800.hitMinX).toBe(140)
    expect(layout800.hitMaxX).toBe(660)
    expect(layout800.hitMinY).toBe(185)
    expect(layout800.hitMaxY).toBe(335)
    expect(layout800.rows).toHaveLength(3)

    // Row 0: Options (160x36)
    expect(layout800.rows[0]).toEqual({
      index: 0,
      action: 'options',
      rowY: 185,
      baselineY: 224,
      bannerX: 400 - 80 - 1, // 319
      bannerY: 224 - 36, // 188
      bannerWidth: 160,
      bannerHeight: 36,
    })
    // Row 1: Save and Exit Game (434x36)
    expect(layout800.rows[1]).toEqual({
      index: 1,
      action: 'saveAndExit',
      rowY: 235,
      baselineY: 274,
      bannerX: 400 - 217 - 1, // 182
      bannerY: 274 - 36, // 238
      bannerWidth: 434,
      bannerHeight: 36,
    })
    // Row 2: Return to Game (356x36)
    expect(layout800.rows[2]).toEqual({
      index: 2,
      action: 'returnToGame',
      rowY: 285,
      baselineY: 324,
      bannerX: 400 - 178 - 1, // 221
      bannerY: 324 - 36, // 288
      bannerWidth: 356,
      bannerHeight: 36,
    })
    // Pentagrams flank selected row 2 at anchorX=99 and anchorX=649, baselineY=185+100+51=336
    expect(layout800.leftPent.anchorX).toBe(400 - ESCAPE_MENU_PENTSPIN_MAX_WIDTH - 249) // 99
    expect(layout800.rightPent.anchorX).toBe(400 + 249) // 649
    expect(layout800.leftPent.baselineY).toBe(336)
    expect(layout800.rightPent.baselineY).toBe(336)

    // 1024x768 layout
    const layout1024 = computeEscapeMenuLayout(1024, 768, 1, 0)
    // topY = (768 - 80) / 2 - 75 = 344 - 75 = 269
    expect(layout1024.centerX).toBe(512)
    expect(layout1024.topY).toBe(269)
    expect(layout1024.hitMinX).toBe(252)
    expect(layout1024.hitMaxX).toBe(772)
    expect(layout1024.rows[0].rowY).toBe(269)
    expect(layout1024.rows[1].rowY).toBe(319)
    expect(layout1024.rows[2].rowY).toBe(369)
    expect(layout1024.leftPent.anchorX).toBe(512 - 52 - 249) // 211
    expect(layout1024.rightPent.anchorX).toBe(512 + 249) // 761
    expect(layout1024.leftPent.baselineY).toBe(269 + 50 + 51) // 370
  })

  it('hit-tests rows within [centerX-260, centerX+260] and [topY, topY+150) per 0x6fb15560 & 0x6fb14080', () => {
    // Inside row 0 (185..234)
    expect(hitTestEscapeMenu(400, 185, 800, 600)).toBe(0)
    expect(hitTestEscapeMenu(140, 234, 800, 600)).toBe(0)
    // Inside row 1 (235..284)
    expect(hitTestEscapeMenu(400, 235, 800, 600)).toBe(1)
    expect(hitTestEscapeMenu(660, 284, 800, 600)).toBe(1)
    // Inside row 2 (285..334)
    expect(hitTestEscapeMenu(400, 285, 800, 600)).toBe(2)
    expect(hitTestEscapeMenu(400, 334, 800, 600)).toBe(2)

    // Outside X bounds (140..660)
    expect(hitTestEscapeMenu(139, 210, 800, 600)).toBeNull()
    expect(hitTestEscapeMenu(661, 210, 800, 600)).toBeNull()
    // Outside Y bounds (185..334)
    expect(hitTestEscapeMenu(400, 184, 800, 600)).toBeNull()
    expect(hitTestEscapeMenu(400, 335, 800, 600)).toBeNull()
  })

  it('draws centered DC6 banners and counter-rotating pentspin frames without dimming box', () => {
    const worldPanels = new WorldPanelsHud()
    worldPanels.escapeMenuOpen = true
    worldPanels.escapeMenuSelectedIndex = 1 // Save and Exit

    const drawImageCalls: Array<{
      img: unknown
      args: number[]
    }> = []
    const fillRectCalls: number[][] = []
    const strokeRectCalls: number[][] = []

    const mockCtx = {
      drawImage: (img: unknown, ...args: number[]) => {
        drawImageCalls.push({ img, args })
      },
      fillRect: (...args: number[]) => {
        fillRectCalls.push(args)
      },
      strokeRect: (...args: number[]) => {
        strokeRectCalls.push(args)
      },
    } as unknown as CanvasRenderingContext2D

    const fakeImg = (name: string, w: number, h: number) =>
      ({ name, naturalWidth: w, width: w, height: h }) as unknown as HTMLImageElement

    const escOptionsImg = fakeImg('escOptions', ESCAPE_MENU_BANNER_SIZES[0].width, 36)
    const escExitImg = fakeImg('escExit', ESCAPE_MENU_BANNER_SIZES[1].width, 36)
    const escReturnImg = fakeImg('escReturn', ESCAPE_MENU_BANNER_SIZES[2].width, 36)
    const pentSpinImg = fakeImg('pentSpin', 295, 53)

    // At nowMs = 100ms -> spinFrame = floor(100 / 50) & 7 = 2, leftFrameIndex = (8 - 2) & 7 = 6, rightFrameIndex = 2
    worldPanels.drawEscapeMenu(mockCtx, 800, 600, 100, {
      escOptionsImg,
      escExitImg,
      escReturnImg,
      pentSpinImg,
    })

    // Authentic 1.13c draws no dim rect or brown border box
    expect(fillRectCalls).toHaveLength(0)
    expect(strokeRectCalls).toHaveLength(0)

    // 3 banner draws + 2 pentagram draws = 5 drawImage calls
    expect(drawImageCalls).toHaveLength(5)
    expect(drawImageCalls[0]).toEqual({
      img: escOptionsImg,
      args: [319, 188, 160, 36],
    })
    expect(drawImageCalls[1]).toEqual({
      img: escExitImg,
      args: [182, 238, 434, 36],
    })
    expect(drawImageCalls[2]).toEqual({
      img: escReturnImg,
      args: [221, 288, 356, 36],
    })

    const leftFrame = ESCAPE_MENU_PENTSPIN_FRAMES[6]
    const rightFrame = ESCAPE_MENU_PENTSPIN_FRAMES[2]
    // Selected row 1 pentagram baselineY = 185 + 50 + 51 = 286
    expect(drawImageCalls[3]).toEqual({
      img: pentSpinImg,
      args: [
        leftFrame.x,
        leftFrame.y,
        leftFrame.w,
        leftFrame.h,
        99 + leftFrame.offsetX,
        286 - leftFrame.h + leftFrame.offsetY,
        leftFrame.w,
        leftFrame.h,
      ],
    })
    expect(drawImageCalls[4]).toEqual({
      img: pentSpinImg,
      args: [
        rightFrame.x,
        rightFrame.y,
        rightFrame.w,
        rightFrame.h,
        649 + rightFrame.offsetX,
        286 - rightFrame.h + rightFrame.offsetY,
        rightFrame.w,
        rightFrame.h,
      ],
    })
  })

  it('navigates Escape menu with ArrowUp/ArrowDown/Enter and blocks world input', () => {
    const world = new ClientWorld()
    const actions: string[] = []
    const commands: ClientCommand[] = []

    const hudManager = new HudManager(undefined, {
      onEscapeMenuAction: (act) => actions.push(act),
    })
    const hudModel = new HudModel({
      world,
      hudManager,
      onCommand: (cmd) => commands.push(cmd),
    })
    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      sendCommand: (cmd) => commands.push(cmd),
      onEscapeMenu: () => {
        hudModel.togglePanel('escapeMenu')
      },
    })

    // 1. Open inventory first; Escape closes inventory before opening Escape menu
    hudModel.togglePanel('inventory')
    expect(hudModel.getSnapshot().panels.inventory).toBe(true)
    expect(hudModel.getSnapshot().panels.escapeMenu).toBe(false)

    mapper.handleKeyDown({ key: 'Escape' })
    expect(hudModel.getSnapshot().panels.inventory).toBe(false)
    expect(hudModel.getSnapshot().panels.escapeMenu).toBe(false)

    // 2. Press Escape again -> opens Escape menu with default selection index 2 (Return to Game)
    mapper.handleKeyDown({ key: 'Escape' })
    expect(hudModel.getSnapshot().panels.escapeMenu).toBe(true)
    expect(hudManager.escapeMenuOpen).toBe(true)
    expect(hudManager.escapeMenuSelectedIndex).toBe(2)

    // 3. While Escape menu is open, gameplay hotkeys (I, C, W, 1) and world clicks are blocked
    mapper.handleKeyDown({ key: 'i' })
    mapper.handleKeyDown({ key: 'w' })
    expect(hudModel.getSnapshot().panels.inventory).toBe(false)
    expect(commands).toHaveLength(0)
    expect(hudManager.isPointInterceptedByHud(50, 50)).toBe(true)
    expect(mapper.handlePointerDown(50, 50, 0)).toBeNull()
    expect(commands).toHaveLength(0)

    // 4. ArrowUp moves selection 2 -> 1 (Save and Exit) -> 0 (Options) -> wraps to 2
    mapper.handleKeyDown({ key: 'ArrowUp' })
    expect(hudManager.escapeMenuSelectedIndex).toBe(1)
    mapper.handleKeyDown({ key: 'ArrowUp' })
    expect(hudManager.escapeMenuSelectedIndex).toBe(0)
    mapper.handleKeyDown({ key: 'ArrowUp' })
    expect(hudManager.escapeMenuSelectedIndex).toBe(2)

    // 5. ArrowDown moves selection 2 -> wraps to 0 (Options); Enter activates Options (enters 'options' submenu, Escape returns to 'main')
    mapper.handleKeyDown({ key: 'ArrowDown' })
    expect(hudManager.escapeMenuSelectedIndex).toBe(0)
    mapper.handleKeyDown({ key: 'Enter' })
    expect(actions).toEqual(['options'])
    expect(hudManager.escapeMenuOpen).toBe(true)
    expect(hudManager.escapeMenuScreen).toBe('options')
    mapper.handleKeyDown({ key: 'Escape' })
    expect(hudManager.escapeMenuOpen).toBe(true)
    expect(hudManager.escapeMenuScreen).toBe('main')

    // 6. Click on Row 2 (Return to Game at y=300) -> closes Escape menu
    mapper.handlePointerDown(400, 300, 0)
    expect(actions).toEqual(['options', 'returnToGame'])
    expect(hudManager.escapeMenuOpen).toBe(false)
    expect(hudModel.getSnapshot().panels.escapeMenu).toBe(false)

    // 7. Reopen Escape menu and click Row 1 (Save and Exit at y=250) -> closes menu, emits saveAndExit
    mapper.handleKeyDown({ key: 'Escape' })
    expect(hudManager.escapeMenuOpen).toBe(true)
    expect(hudManager.escapeMenuSelectedIndex).toBe(2) // resets to Return to Game on reopen

    // Issue #1013 (D2Client.dll 0x6fb1528a..0x6fb152d4): hovering over Save and Exit (row 1) or Options (row 0)
    // moves escapeMenuSelectedIndex and the flanking pentagrams to the hovered row; moving outside keeps selection.
    mapper.handlePointerMove(400, 250)
    expect(hudManager.escapeMenuSelectedIndex).toBe(1)
    expect(
      computeEscapeMenuLayout(800, 600, hudManager.escapeMenuSelectedIndex, 0).leftPent.baselineY,
    ).toBe(286)
    expect(
      computeEscapeMenuLayout(800, 600, hudManager.escapeMenuSelectedIndex, 0).rightPent.baselineY,
    ).toBe(286)

    mapper.handlePointerMove(400, 200)
    expect(hudManager.escapeMenuSelectedIndex).toBe(0)
    expect(
      computeEscapeMenuLayout(800, 600, hudManager.escapeMenuSelectedIndex, 0).leftPent.baselineY,
    ).toBe(236)

    // Moving cursor outside menu bounds preserves current selected row (0x6fb152cf: cmp eax, -1)
    mapper.handlePointerMove(50, 50)
    expect(hudManager.escapeMenuSelectedIndex).toBe(0)

    mapper.handlePointerMove(400, 250)
    expect(hudManager.escapeMenuSelectedIndex).toBe(1)

    mapper.handlePointerDown(400, 250, 0)
    expect(actions).toEqual(['options', 'returnToGame', 'saveAndExit'])
    expect(hudManager.escapeMenuOpen).toBe(false)
  })

  it('Save and Exit Game leaves D2GS to Battle.net Lobby (phase="lobby") without tearing down BNCS/MCP session', async () => {
    const { OnlineSession } = await import('../../src/client/session/online-session.ts')
    let flowState: 'idle' | 'realm_ready' | 'ingame' | 'closed' = 'idle'
    let leaveToLobbyCount = 0
    let closeCount = 0

    const session = new OnlineSession({
      flowFactory: () =>
        ({
          get state() {
            return flowState
          },
          get sessionLost() {
            return null
          },
          onState: () => () => {},
          onSessionLost: () => () => {},
          login: async () => {},
          listRealms: async () => [{ index: 0, title: 'D2CS', description: 'Realm' }],
          enterRealm: async () => [
            {
              name: 'HeroSorc',
              charClass: 1,
              level: 1,
              flags: 0x20,
              act: 1,
              expiresAt: 0,
              rawAppearance: new Uint8Array(33),
            },
          ],
          selectCharacter: async () => {},
          createGame: async () => {},
          joinGame: async () => {
            flowState = 'ingame'
            return {
              state: 'ingame',
              stats: { packetsIn: 0, packetsOut: 0, unknownPackets: 0, opaquePackets: 0, protocolErrors: 0, rttMs: 10 },
              send: () => {},
              leave: () => {},
              onEvent: () => () => {},
              onClose: () => () => {},
            } as any
          },
          leaveToLobby: async () => {
            leaveToLobbyCount += 1
            flowState = 'realm_ready'
          },
          close: async () => {
            closeCount += 1
            flowState = 'closed'
          },
        }) as any,
    })

    const sessionLostEvents: unknown[] = []
    session.onSessionLost((ev) => sessionLostEvents.push(ev))

    await session.login({ username: 'acc', password: 'pw' })
    await session.selectCharacter('HeroSorc')
    await session.enterGame({ mode: 'create', spec: { name: 'g1', difficulty: 0 } })
    expect(session.phase).toBe('ingame')

    // Open Escape menu and activate row 1 (Save and Exit Game)
    session.hudModel.togglePanel('escapeMenu')
    expect(session.hudManager.escapeMenuOpen).toBe(true)
    session.hudManager.activateEscapeMenuIndex(1)
    await new Promise((r) => setTimeout(r, 0))

    expect(session.hudManager.escapeMenuOpen).toBe(false)
    expect(leaveToLobbyCount).toBe(1)
    expect(closeCount).toBe(0)
    expect(sessionLostEvents).toHaveLength(0)
    expect(session.phase).toBe('lobby')
  })
})
