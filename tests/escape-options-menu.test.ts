import { describe, expect, it, vi } from 'vitest'
import {
  HudManager,
  computeControlsMenuLayout,
  computeEscapeMenuLayout,
  computeOptionsSubmenuLayout,
} from '../src/client/ui/hud-manager.ts'
import { SettingsStore } from '../src/client/settings/settings-store.ts'
import {
  assignKeyBinding,
  clearKeyBindingSlot,
  CONTROL_ACTION_DEFINITIONS,
  DEFAULT_KEY_BINDINGS,
  formatKeyBindingCode,
  matchesKeyBinding,
  VALID_VIEWPORT_RESOLUTIONS,
} from '../src/client/settings/client-settings.ts'
import { Toolbar } from '../src/client/toolbar/toolbar.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { CommandMapper } from '../src/client/input/command-mapper.ts'

function createMockCanvasContext() {
  const fillRectCalls: Array<{ x: number; y: number; w: number; h: number }> = []
  const strokeRectCalls: Array<{ x: number; y: number; w: number; h: number }> = []
  const fillTextCalls: Array<{ text: string; x: number; y: number }> = []
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    translate: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      fillRectCalls.push({ x, y, w, h })
    }),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) => {
      strokeRectCalls.push({ x, y, w: w, h })
    }),
    fillText: vi.fn((text: string, x: number, y: number) => {
      fillTextCalls.push({ text, x, y })
    }),
    measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '16px sans-serif',
    textAlign: 'left',
    textBaseline: 'top',
  } as unknown as CanvasRenderingContext2D
  return { ctx, fillRectCalls, strokeRectCalls, fillTextCalls }
}

describe('In-Game Options Menu (Options / Sound / Video / Configure Controls)', () => {
  it('opens Options submenu when activating row 0 in Escape Menu and navigates back with Escape', () => {
    const hud = new HudManager()
    hud.setLang('en')
    expect(hud.escapeMenuOpen).toBe(false)

    // Open main Escape menu (defaults to row 2 Return to Game)
    hud.toggleEscapeMenu()
    expect(hud.escapeMenuOpen).toBe(true)
    expect(hud.escapeMenuScreen).toBe('main')
    expect(hud.escapeMenuSelectedIndex).toBe(2)

    // Click row 0 (Options)
    const mainLayout = computeEscapeMenuLayout(800, 600, 0, 0)
    const row0 = mainLayout.rows[0]
    const action = hud.handleEscapeMenuClick(mainLayout.centerX, row0.rowY + 20)
    expect(action).toBe('options')
    expect(hud.escapeMenuOpen).toBe(true)
    expect(hud.escapeMenuScreen).toBe('options')
    expect(hud.worldPanels.optionsSubmenuSelectedIndex).toBe(0)

    // Pressing Escape inside 'options' returns to 'main' without closing the Escape menu
    hud.handleKeyDown({ key: 'Escape' })
    expect(hud.escapeMenuOpen).toBe(true)
    expect(hud.escapeMenuScreen).toBe('main')
    expect(hud.escapeMenuSelectedIndex).toBe(0)

    // Pressing Escape again on 'main' closes the Escape menu
    hud.handleKeyDown({ key: 'Escape' })
    expect(hud.escapeMenuOpen).toBe(false)
  })

  it('synchronizes Sound Options (Volume 21-step OptBar slider & Mute Sound) with SettingsStore and Toolbar', () => {
    const store = new SettingsStore({
      storage: null,
      defaultLang: 'en',
    })
    const toolbar = new Toolbar({ store })
    const hud = new HudManager()
    hud.setLang('en')
    hud.configureEscapeMenuSettings({
      getSettings: () => ({
        masterVolume: store.get().masterVolume,
        audioMuted: store.get().audioMuted,
        viewport: store.get().viewport,
        worldRenderFps: store.get().worldRenderFps,
        keyBindings: store.get().keyBindings,
      }),
      onUpdateSettings: (patch) => {
        if (patch.masterVolume !== undefined) toolbar.setMasterVolume(patch.masterVolume)
        if (patch.audioMuted !== undefined) toolbar.setAudioMuted(patch.audioMuted)
      },
    })

    hud.toggleEscapeMenu()
    hud.activateEscapeMenuIndex(0) // -> 'options'
    expect(hud.escapeMenuScreen).toBe('options')

    // Activate row 0 ('SOUND OPTIONS')
    hud.handleKeyDown({ key: 'Enter' })
    expect(hud.escapeMenuScreen).toBe('sound')
    expect(hud.worldPanels.optionsSubmenuSelectedIndex).toBe(0)

    // Default masterVolume is 0.80 -> ArrowLeft decreases by 5% to 0.75
    hud.handleKeyDown({ key: 'ArrowLeft' })
    expect(store.get().masterVolume).toBeCloseTo(0.75, 2)

    // Drag/click slider to 50%
    const soundLayout = computeOptionsSubmenuLayout(
      'sound',
      800,
      600,
      0,
      0,
      {
        masterVolume: store.get().masterVolume,
        audioMuted: store.get().audioMuted,
        viewport: store.get().viewport,
        worldRenderFps: store.get().worldRenderFps,
        keyBindings: store.get().keyBindings,
        fullscreenActive: false,
        fullscreenSupported: true,
      },
      'en',
    )
    const sb = soundLayout.rows[0]!.sliderBounds!
    const midX = sb.left + Math.round(sb.width * 0.5)
    const midY = Math.round((sb.top + sb.bottom) / 2)
    hud.handleEscapeMenuClick(midX, midY)
    expect(store.get().masterVolume).toBeCloseTo(0.5, 2)
    hud.handleHudMouseUp(midX, midY, 0)
    expect(hud.worldPanels.soundDraggingSlider).toBe(false)

    // Navigate to row 1 ('MUTE SOUND') and toggle ON
    hud.handleKeyDown({ key: 'ArrowDown' })
    expect(hud.worldPanels.optionsSubmenuSelectedIndex).toBe(1)
    hud.handleKeyDown({ key: 'Enter' })
    expect(store.get().audioMuted).toBe(true)

    // Rendering Sound Options draws title, rows, and slider without errors
    const { ctx, fillTextCalls } = createMockCanvasContext()
    hud.worldPanels.drawEscapeMenu(ctx, 800, 600, 100, {
      escOptionsImg: null,
      escExitImg: null,
      escReturnImg: null,
      pentSpinImg: null,
    })
    expect(fillTextCalls.some((c) => c.text.includes('SOUND OPTIONS'))).toBe(true)
    expect(fillTextCalls.some((c) => c.text === 'ON')).toBe(true)

    // Navigate to row 2 ('PREVIOUS MENU') and return to 'options'
    hud.handleKeyDown({ key: 'ArrowDown' })
    expect(hud.worldPanels.optionsSubmenuSelectedIndex).toBe(2)
    hud.handleKeyDown({ key: 'Enter' })
    expect(hud.escapeMenuScreen).toBe('options')
  })

  it('synchronizes Video Options (Display Mode, Resolution, Frame Rate) with SettingsStore and Toolbar', () => {
    const store = new SettingsStore({
      storage: null,
      defaultLang: 'en',
    })
    let fullscreenActive = false
    const hud = new HudManager()
    hud.setLang('en')
    hud.configureEscapeMenuSettings({
      getSettings: () => ({
        masterVolume: store.get().masterVolume,
        audioMuted: store.get().audioMuted,
        viewport: store.get().viewport,
        worldRenderFps: store.get().worldRenderFps,
        keyBindings: store.get().keyBindings,
        fullscreenActive,
        fullscreenSupported: true,
      }),
      onUpdateSettings: (patch) => {
        store.set(patch)
      },
      onToggleFullscreen: () => {
        fullscreenActive = !fullscreenActive
      },
    })

    hud.toggleEscapeMenu()
    hud.activateEscapeMenuIndex(0) // -> 'options'
    // Select row 1 ('VIDEO OPTIONS')
    hud.handleKeyDown({ key: 'ArrowDown' })
    hud.handleKeyDown({ key: 'Enter' })
    expect(hud.escapeMenuScreen).toBe('video')

    // Row 0: DISPLAY MODE -> Enter toggles fullscreen
    expect(hud.worldPanels.optionsSubmenuSelectedIndex).toBe(0)
    hud.handleKeyDown({ key: 'Enter' })
    expect(fullscreenActive).toBe(true)

    // Row 1: RESOLUTION -> ArrowRight cycles to next resolution in VALID_VIEWPORT_RESOLUTIONS
    hud.handleKeyDown({ key: 'ArrowDown' })
    expect(hud.worldPanels.optionsSubmenuSelectedIndex).toBe(1)
    const initialRes = store.get().viewport
    const initialIdx = VALID_VIEWPORT_RESOLUTIONS.indexOf(initialRes)
    hud.handleKeyDown({ key: 'ArrowRight' })
    const expectedNext = VALID_VIEWPORT_RESOLUTIONS[(initialIdx + 1) % VALID_VIEWPORT_RESOLUTIONS.length]
    expect(store.get().viewport).toBe(expectedNext)
    expect(hud.viewportProfile.id).toBe(expectedNext)

    // ArrowLeft cycles back to initialRes
    hud.handleKeyDown({ key: 'ArrowLeft' })
    expect(store.get().viewport).toBe(initialRes)

    // Row 2: FRAME RATE -> toggles 60 FPS <-> 30 FPS
    hud.handleKeyDown({ key: 'ArrowDown' })
    expect(hud.worldPanels.optionsSubmenuSelectedIndex).toBe(2)
    expect(store.get().worldRenderFps).toBe(60)
    hud.handleKeyDown({ key: 'Enter' })
    expect(store.get().worldRenderFps).toBe(30)
    hud.handleKeyDown({ key: 'ArrowRight' })
    expect(store.get().worldRenderFps).toBe(60)

    // Render Video Options
    const { ctx, fillTextCalls } = createMockCanvasContext()
    hud.worldPanels.drawEscapeMenu(ctx, 800, 600, 100, {
      escOptionsImg: null,
      escExitImg: null,
      escReturnImg: null,
      pentSpinImg: null,
    })
    expect(fillTextCalls.some((c) => c.text.includes('VIDEO OPTIONS'))).toBe(true)
    expect(fillTextCalls.some((c) => c.text === 'FULLSCREEN')).toBe(true)
    expect(fillTextCalls.some((c) => c.text === '60 FPS')).toBe(true)
  })

  it('supports Configure Controls key capture, conflict clearing, Default/Accept/Cancel buttons, and live hotkey routing', () => {
    const store = new SettingsStore({
      storage: null,
      defaultLang: 'en',
    })
    const world = new ClientWorld()
    const hud = new HudManager()
    hud.setLang('en')
    const hudModel = new HudModel({
      world,
      hudManager: hud,
      onCommand: () => {},
    })
    const mapper = new CommandMapper({
      world,
      hudManager: hud,
      hudModel,
      sendCommand: () => {},
    })

    hud.configureEscapeMenuSettings({
      getSettings: () => ({
        masterVolume: store.get().masterVolume,
        audioMuted: store.get().audioMuted,
        viewport: store.get().viewport,
        worldRenderFps: store.get().worldRenderFps,
        keyBindings: store.get().keyBindings,
      }),
      onUpdateSettings: (patch) => {
        store.set(patch)
      },
    })

    // Enter Configure Controls: Escape -> Options -> Row 2 (Configure Controls)
    hud.toggleEscapeMenu()
    hud.activateEscapeMenuIndex(0)
    hud.handleKeyDown({ key: 'ArrowDown' })
    hud.handleKeyDown({ key: 'ArrowDown' })
    hud.handleKeyDown({ key: 'Enter' })
    expect(hud.escapeMenuScreen).toBe('controls')
    expect(hud.worldPanels.controlsSelectedRow).toBe(0) // characterScreen
    expect(hud.worldPanels.controlsSelectedCol).toBe('primary')

    // Press Enter to start capturing key for characterScreen primary slot
    hud.handleKeyDown({ key: 'Enter' })
    expect(hud.worldPanels.controlsAwaitingBinding).toBe(true)

    // Bind 'KeyK' to characterScreen primary
    hud.handleKeyDown({ key: 'k', code: 'KeyK' })
    expect(hud.worldPanels.controlsAwaitingBinding).toBe(false)
    expect(hud.worldPanels.controlsDraftBindings?.characterScreen.primary).toBe('KeyK')

    // Test wheel scrolling in Configure Controls
    expect(hud.handleWheel(120)).toBe(true)
    expect(hud.worldPanels.controlsScrollOffset).toBe(1)
    expect(hud.handleWheel(-120)).toBe(true)
    expect(hud.worldPanels.controlsScrollOffset).toBe(0)

    // Click ACCEPT button (press + release) to persist bindings into SettingsStore
    const ctrlLayout = computeControlsMenuLayout(
      800,
      600,
      0,
      hud.worldPanels.controlsDraftBindings!,
      'en',
    )
    const acceptBtn = ctrlLayout.buttons.find((b) => b.id === 'accept')!
    const btnCenterX = acceptBtn.x + Math.trunc(acceptBtn.width / 2)
    const btnCenterY = acceptBtn.y + Math.trunc(acceptBtn.height / 2)
    hud.handleEscapeMenuClick(btnCenterX, btnCenterY)
    expect(hud.worldPanels.controlsPressedButtonId).toBe('accept')
    hud.handleHudMouseUp(btnCenterX, btnCenterY, 0)

    // Should return to 'options' and update store
    expect(hud.escapeMenuScreen).toBe('options')
    expect(store.get().keyBindings.characterScreen.primary).toBe('KeyK')

    // Close Escape Menu completely
    hud.handleKeyDown({ key: 'Escape' }) // -> 'main'
    hud.handleKeyDown({ key: 'Escape' }) // -> closed
    expect(hud.escapeMenuOpen).toBe(false)

    // Pressing 'K' now opens the Character Screen!
    expect(hud.leftPanel).toBe('none')
    mapper.handleKeyDown({ key: 'k', code: 'KeyK' })
    expect(hud.leftPanel).toBe('char')
  })

  it('clears conflicting bindings when assigning an already-bound key and supports Delete/Backspace to unbind', () => {
    let bindings = DEFAULT_KEY_BINDINGS
    expect(bindings.characterScreen.primary).toBe('KeyA')
    expect(bindings.inventoryScreen.primary).toBe('KeyI')

    // Assign 'KeyI' to characterScreen.primary -> should clear inventoryScreen.primary!
    bindings = assignKeyBinding(bindings, 'characterScreen', 'primary', 'KeyI')
    expect(bindings.characterScreen.primary).toBe('KeyI')
    expect(bindings.inventoryScreen.primary).toBeNull()

    // Clear characterScreen.secondary
    bindings = clearKeyBindingSlot(bindings, 'characterScreen', 'secondary')
    expect(bindings.characterScreen.secondary).toBeNull()
    expect(formatKeyBindingCode(null, 'en')).toBe('None')
    expect(formatKeyBindingCode(null, 'zh')).toBe('無')
    expect(formatKeyBindingCode('KeyI', 'en')).toBe('I')
    expect(CONTROL_ACTION_DEFINITIONS.length).toBeGreaterThanOrEqual(30)
    expect(matchesKeyBinding(bindings, 'characterScreen', { code: 'KeyI', key: 'i' })).toBe(true)
  })
})
