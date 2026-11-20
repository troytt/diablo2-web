import { describe, expect, it, vi } from 'vitest'
import {
  FrontendImeSink,
  getFieldInputAttributes,
  sanitizeFieldValue,
} from '../../src/client/frontend/frontend-ime-sink.ts'
import {
  agreeTermsOfUse,
  completeBnetConnect,
  createInitialFlowState,
  openPopupModal,
  selectCampfireClass,
  type ActiveInputField,
  type BnetFlowState,
} from '../../src/client/frontend/flow-state.ts'
import { FrontendRenderer } from '../../src/client/frontend/frontend-renderer.ts'

class MockCanvasContext {
  drawImage = vi.fn()
  getImageData = vi.fn(() => ({ data: new Uint8ClampedArray(4) }))
  putImageData = vi.fn()
  imageSmoothingEnabled = false
}

function createMockCanvas(): HTMLCanvasElement {
  const ctx = new MockCanvasContext()
  const canvas = {
    getContext: vi.fn(() => ctx),
    getBoundingClientRect: vi.fn(() => ({
      left: 100,
      top: 50,
      width: 800,
      height: 600,
      right: 900,
      bottom: 650,
    })),
    style: {},
    width: 800,
    height: 600,
  } as unknown as HTMLCanvasElement
  return canvas
}

function createMockContainer(): HTMLElement {
  const children: HTMLElement[] = []
  const container = {
    getBoundingClientRect: vi.fn(() => ({
      left: 100,
      top: 50,
      width: 800,
      height: 600,
      right: 900,
      bottom: 650,
    })),
    querySelector: vi.fn((sel: string) => (sel === '#d2-frontend-ime-sink' ? children[0] ?? null : null)),
    appendChild: vi.fn((child: HTMLElement) => {
      children.push(child)
      return child
    }),
  } as unknown as HTMLElement
  return container
}

type MockInputElement = HTMLInputElement & {
  focus: ReturnType<typeof vi.fn>
  blur: ReturnType<typeof vi.fn>
  _listeners: Record<string, ((e: unknown) => void)[]>
  _trigger: (event: string, payload?: unknown) => void
}

function createMockInputElement(): MockInputElement {
  const listeners: Record<string, ((e: unknown) => void)[]> = {}
  const style: Record<string, string> = {}
  const attrs: Record<string, string> = {}
  const dataset: Record<string, string> = {}

  const el = {
    id: 'd2-frontend-ime-sink',
    type: 'text',
    inputMode: 'text',
    value: '',
    maxLength: 15,
    tabIndex: -1,
    style,
    dataset,
    setAttribute: vi.fn((k: string, v: string) => {
      attrs[k] = v
    }),
    getAttribute: vi.fn((k: string) => attrs[k] ?? null),
    addEventListener: vi.fn((event: string, fn: (e: unknown) => void) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event]!.push(fn)
    }),
    removeEventListener: vi.fn((event: string, fn: (e: unknown) => void) => {
      listeners[event] = listeners[event]?.filter((h) => h !== fn)
    }),
    focus: vi.fn(),
    blur: vi.fn(),
    setSelectionRange: vi.fn(),
    remove: vi.fn(),
    _listeners: listeners,
    _trigger: (event: string, payload: unknown = {}) => {
      for (const fn of listeners[event] ?? []) {
        fn(payload)
      }
    },
  } as unknown as MockInputElement
  return el
}

describe('Frontend Mobile IME & Virtual Keyboard Sink (#1388)', () => {
  describe('Field Attributes & Security Specifications (getFieldInputAttributes)', () => {
    it('configures accountName with username autocomplete and 15 max length', () => {
      const attrs = getFieldInputAttributes('accountName')
      expect(attrs.type).toBe('text')
      expect(attrs.inputMode).toBe('text')
      expect(attrs.autocomplete).toBe('username')
      expect(attrs.maxLength).toBe(15)
    })

    it('configures passwords with password type and appropriate autocomplete', () => {
      const loginPass = getFieldInputAttributes('accountPassword')
      expect(loginPass.type).toBe('password')
      expect(loginPass.autocomplete).toBe('current-password')
      expect(loginPass.maxLength).toBe(15)

      const verifyPass = getFieldInputAttributes('accountVerifyPassword')
      expect(verifyPass.type).toBe('password')
      expect(verifyPass.autocomplete).toBe('new-password')

      const gamePass = getFieldInputAttributes('gamePassword')
      expect(gamePass.type).toBe('password')
      expect(gamePass.autocomplete).toBe('off')
    })

    it('configures numeric fields with numeric inputMode for mobile soft keypad', () => {
      const maxPlayers = getFieldInputAttributes('maxPlayers')
      expect(maxPlayers.inputMode).toBe('numeric')
      expect(maxPlayers.maxLength).toBe(1)

      const charDiff = getFieldInputAttributes('charDifference')
      expect(charDiff.inputMode).toBe('numeric')
      expect(charDiff.maxLength).toBe(2)
    })

    it('configures charName with word capitalization and off autocomplete', () => {
      const charName = getFieldInputAttributes('charName')
      expect(charName.type).toBe('text')
      expect(charName.autocapitalize).toBe('words')
      expect(charName.maxLength).toBe(15)
    })

    it('configures chatInput with 38 character max length', () => {
      const chat = getFieldInputAttributes('chatInput')
      expect(chat.type).toBe('text')
      expect(chat.maxLength).toBe(38)
    })
  })

  describe('Full Class-of-Field Sanitization Sweep (sanitizeFieldValue)', () => {
    it('sanitizes accountName: drops illegal symbols, enforces 15 chars', () => {
      expect(sanitizeFieldValue('accountName', 'TestUser123')).toBe('TestUser123')
      expect(sanitizeFieldValue('accountName', 'Test_User-99')).toBe('Test_User-99')
      expect(sanitizeFieldValue('accountName', 'bad#user*name?')).toBe('badusername')
      expect(sanitizeFieldValue('accountName', 'very_long_account_name_exceeding_limit')).toBe(
        'very_long_accou',
      )
    })

    it('sanitizes accountPassword: keeps printable ASCII, caps at 15', () => {
      expect(sanitizeFieldValue('accountPassword', 'P@ssw0rd!#$')).toBe('P@ssw0rd!#$')
      expect(sanitizeFieldValue('accountPassword', 'super_secret_password_too_long')).toBe(
        'super_secret_pa',
      )
    })

    it('sanitizes charName per D2 1.13c rules: ASCII letters and at most 1 internal dash/underscore', () => {
      expect(sanitizeFieldValue('charName', 'Barbarian')).toBe('Barbarian')
      expect(sanitizeFieldValue('charName', 'Hero-One')).toBe('Hero-One')
      expect(sanitizeFieldValue('charName', 'Hero_Two')).toBe('Hero_Two')
      // Leading dash or underscore is rejected
      expect(sanitizeFieldValue('charName', '-Leading')).toBe('Leading')
      expect(sanitizeFieldValue('charName', '_Leading')).toBe('Leading')
      // Numbers and symbols are rejected
      expect(sanitizeFieldValue('charName', 'Hero123!@#')).toBe('Hero')
      // Multiple dashes/underscores are rejected after the first
      expect(sanitizeFieldValue('charName', 'A-B-C_D')).toBe('A-BCD')
    })

    it('sanitizes gameName and gamePassword: alphanumeric, underscore, dash, max 15', () => {
      expect(sanitizeFieldValue('gameName', 'Baal-Run-01')).toBe('Baal-Run-01')
      expect(sanitizeFieldValue('gameName', 'Room with spaces and symbols!*')).toBe(
        'Roomwithspacesa',
      )
      expect(sanitizeFieldValue('gamePassword', '12345')).toBe('12345')
      expect(sanitizeFieldValue('gamePassword', 'pass word')).toBe('password')
    })

    it('sanitizes numeric controls: maxPlayers in 1..8 and charDifference in 0..99', () => {
      expect(sanitizeFieldValue('maxPlayers', '5')).toBe('5')
      expect(sanitizeFieldValue('maxPlayers', '9')).toBe('8')
      expect(sanitizeFieldValue('maxPlayers', 'abc8xyz')).toBe('8')

      expect(sanitizeFieldValue('charDifference', '10')).toBe('10')
      expect(sanitizeFieldValue('charDifference', '99')).toBe('99')
      expect(sanitizeFieldValue('charDifference', '150')).toBe('15')
    })

    it('sanitizes chatInput: allows multi-language UTF-8 up to 38 chars', () => {
      expect(sanitizeFieldValue('chatInput', '大家好！Hello world!')).toBe('大家好！Hello world!')
      const longMsg = '这是一个超长的暗黑破坏神战网大厅聊天消息测试文本，看看能不能顺利截断在三十八个字符之内！'
      expect(sanitizeFieldValue('chatInput', longMsg).length).toBe(38)
    })
  })

  describe('FrontendRenderer Active Input Bounds Calculation', () => {
    it('returns exact bounding rects for bnet_login fields', () => {
      const state = createInitialFlowState()
      state.stage = 'bnet_login'
      const canvas = createMockCanvas()
      const renderer = new FrontendRenderer(canvas, state)

      expect(renderer.getActiveInputBounds('accountName')).toEqual({
        x: 278,
        y: 316,
        width: 243,
        height: 31,
      })
      expect(renderer.getActiveInputBounds('accountPassword')).toEqual({
        x: 278,
        y: 376,
        width: 243,
        height: 31,
      })
    })

    it('returns exact bounding rects for bnet_create_account fields', () => {
      const state = createInitialFlowState()
      state.stage = 'bnet_create_account'
      const canvas = createMockCanvas()
      const renderer = new FrontendRenderer(canvas, state)

      expect(renderer.getActiveInputBounds('accountName')).toEqual({
        x: 278,
        y: 318,
        width: 243,
        height: 34,
      })
      expect(renderer.getActiveInputBounds('accountPassword')).toEqual({
        x: 278,
        y: 372,
        width: 243,
        height: 39,
      })
      expect(renderer.getActiveInputBounds('accountVerifyPassword')).toEqual({
        x: 278,
        y: 426,
        width: 243,
        height: 45,
      })
    })

    it('returns exact bounding rects for char_create field', () => {
      const state = createInitialFlowState()
      state.stage = 'char_create'
      const canvas = createMockCanvas()
      const renderer = new FrontendRenderer(canvas, state)

      expect(renderer.getActiveInputBounds('charName')).toEqual({
        x: 318,
        y: 485,
        width: 175,
        height: 28,
      })
    })

    it('returns exact bounding rects for bnet_lobby fields across join and create subpanels', () => {
      const state = createInitialFlowState()
      state.stage = 'bnet_lobby'
      state.lobbySubPanel = 'join'
      const canvas = createMockCanvas()
      const renderer = new FrontendRenderer(canvas, state)

      expect(renderer.getActiveInputBounds('chatInput')).toEqual({
        x: 28,
        y: 418,
        width: 335,
        height: 28,
      })
      expect(renderer.getActiveInputBounds('gameName')).toEqual({
        x: 425,
        y: 123,
        width: 167,
        height: 25,
      })
      expect(renderer.getActiveInputBounds('gamePassword')).toEqual({
        x: 599,
        y: 123,
        width: 168,
        height: 25,
      })

      state.lobbySubPanel = 'create'
      expect(renderer.getActiveInputBounds('gameName')).toEqual({
        x: 427,
        y: 137,
        width: 188,
        height: 25,
      })
      expect(renderer.getActiveInputBounds('gamePassword')).toEqual({
        x: 427,
        y: 191,
        width: 188,
        height: 25,
      })
      expect(renderer.getActiveInputBounds('gameDescription')).toEqual({
        x: 427,
        y: 245,
        width: 342,
        height: 25,
      })
      expect(renderer.getActiveInputBounds('maxPlayers')).toEqual({
        x: 655,
        y: 278,
        width: 42,
        height: 29,
      })
      expect(renderer.getActiveInputBounds('charDifference')).toEqual({
        x: 650,
        y: 313,
        width: 55,
        height: 33,
      })
    })
  })

  describe('FrontendImeSink Lifecycle & DOM Synchronization', () => {
    it('attaches to container and initializes with correct invisible/accessible styles', () => {
      const state = createInitialFlowState()
      const canvas = createMockCanvas()
      const container = createMockContainer()
      const renderer = new FrontendRenderer(canvas, state)
      const inputEl = createMockInputElement()

      const sink = new FrontendImeSink({
        renderer,
        container,
        canvas,
        inputElement: inputEl,
      })

      expect(inputEl.style.position).toBe('absolute')
      expect(inputEl.style.opacity).toBe('0')
      expect(inputEl.style.pointerEvents).toBe('none')
      expect(inputEl.style.fontSize).toBe('16px') // iOS viewport protection
      expect(inputEl.style.zIndex).toBe('20')

      sink.dispose()
      expect(inputEl.remove).toHaveBeenCalled()
    })

    it('focuses input and aligns coordinates when activeInput changes in login stage', () => {
      const state = createInitialFlowState()
      state.stage = 'bnet_login'
      state.accountName = 'ExistingHero'
      const canvas = createMockCanvas()
      const container = createMockContainer()
      const renderer = new FrontendRenderer(canvas, state)
      const inputEl = createMockInputElement()

      const sink = new FrontendImeSink({
        renderer,
        container,
        canvas,
        inputElement: inputEl,
      })

      renderer.setActiveInput('accountName')

      expect(inputEl.type).toBe('text')
      expect(inputEl.value).toBe('ExistingHero')
      expect(inputEl.focus).toHaveBeenCalled()
      expect(inputEl.style.display).toBe('block')
      expect(inputEl.style.left).toBe('278px')
      expect(inputEl.style.top).toBe('316px')
      expect(inputEl.style.width).toBe('243px')
      expect(inputEl.style.height).toBe('31px')

      sink.dispose()
    })

    it('switches to password type when accountPassword is selected', () => {
      const state = createInitialFlowState()
      state.stage = 'bnet_login'
      const canvas = createMockCanvas()
      const container = createMockContainer()
      const renderer = new FrontendRenderer(canvas, state)
      const inputEl = createMockInputElement()

      const sink = new FrontendImeSink({
        renderer,
        container,
        canvas,
        inputElement: inputEl,
      })

      renderer.setActiveInput('accountPassword')
      expect(inputEl.type).toBe('password')
      expect(inputEl.style.top).toBe('376px')
      expect(inputEl.focus).toHaveBeenCalled()

      sink.dispose()
    })

    it('syncs typed input back into state and triggers renderer onInput', () => {
      const state = createInitialFlowState()
      state.stage = 'char_create'
      state.selectedClass = 'ba'
      const canvas = createMockCanvas()
      const container = createMockContainer()
      const renderer = new FrontendRenderer(canvas, state)
      const inputEl = createMockInputElement()

      const sink = new FrontendImeSink({
        renderer,
        container,
        canvas,
        inputElement: inputEl,
      })

      renderer.setActiveInput('charName')
      inputEl.value = 'MyHero'
      inputEl._trigger('input')

      expect(renderer.state.charName).toBe('MyHero')

      sink.dispose()
    })

    it('supports IME composition without prematurely corrupting multi-byte characters', () => {
      const state = createInitialFlowState()
      state.stage = 'bnet_lobby'
      const canvas = createMockCanvas()
      const container = createMockContainer()
      const renderer = new FrontendRenderer(canvas, state)
      const inputEl = createMockInputElement()

      const sink = new FrontendImeSink({
        renderer,
        container,
        canvas,
        inputElement: inputEl,
      })

      renderer.setActiveInput('chatInput')

      // IME starts: e.g. pinyin 'nihao'
      inputEl._trigger('compositionstart')
      inputEl.value = 'nihao'
      inputEl._trigger('input')
      expect(renderer.state.chatInput).toBe('nihao')

      // IME confirms selection: '你好'
      inputEl.value = '你好'
      inputEl._trigger('compositionend')
      expect(renderer.state.chatInput).toBe('你好')

      sink.dispose()
    })

    it('sends lobby chat on Enter keydown and resets input value', () => {
      const state = createInitialFlowState()
      state.stage = 'bnet_lobby'
      state.chatInput = 'Ready for run!'
      const canvas = createMockCanvas()
      const container = createMockContainer()
      const renderer = new FrontendRenderer(canvas, state)
      const inputEl = createMockInputElement()

      const mockSendChat = vi.fn()
      renderer.setAsyncHandlers({
        onSendChat: mockSendChat,
      })

      const sink = new FrontendImeSink({
        renderer,
        container,
        canvas,
        inputElement: inputEl,
      })

      renderer.setActiveInput('chatInput')
      inputEl.value = 'Ready for run!'

      const preventDefault = vi.fn()
      const stopPropagation = vi.fn()
      inputEl._trigger('keydown', { key: 'Enter', preventDefault, stopPropagation })

      expect(preventDefault).toHaveBeenCalled()
      expect(inputEl.value).toBe('')

      sink.dispose()
    })

    it('preserves activeInput on input blur (1.13c caret & desktop typing) and clears on Escape', () => {
      const state = createInitialFlowState()
      state.stage = 'bnet_login'
      const canvas = createMockCanvas()
      const container = createMockContainer()
      const renderer = new FrontendRenderer(canvas, state)
      const inputEl = createMockInputElement()

      const sink = new FrontendImeSink({
        renderer,
        container,
        canvas,
        inputElement: inputEl,
      })

      renderer.setActiveInput('accountName')
      expect(renderer.state.activeInput).toBe('accountName')

      // Dismissing soft keyboard (blur) keeps activeInput intact per 1.13c
      inputEl._trigger('blur')
      expect(renderer.state.activeInput).toBe('accountName')

      // Escape key clears activeInput and returns to main_menu
      const preventDefault = vi.fn()
      const stopPropagation = vi.fn()
      inputEl._trigger('keydown', { key: 'Escape', preventDefault, stopPropagation })
      expect(renderer.state.stage).toBe('main_menu')
      expect(renderer.state.activeInput).toBeNull()
      expect(inputEl.style.display).toBe('none')

      sink.dispose()
    })

    it('invokes focus on already-active default fields when tapped on mobile (login, create account, char create, lobby)', () => {
      const state = createInitialFlowState()
      const canvas = createMockCanvas()
      const container = createMockContainer()
      const renderer = new FrontendRenderer(canvas, state)
      const inputEl = createMockInputElement()

      const sink = new FrontendImeSink({
        renderer,
        container,
        canvas,
        inputElement: inputEl,
      })

      // 1. Entering bnet_login sets default activeInput = 'accountName' without focusing sink yet
      state.stage = 'bnet_connecting'
      completeBnetConnect(state)
      expect(state.stage).toBe('bnet_login')
      expect(state.activeInput).toBe('accountName')
      inputEl.focus.mockClear()

      // Tapping the already-active accountName box MUST focus the sink to open mobile soft keyboard
      renderer.handleMouseUp(300, 325)
      expect(inputEl.focus).toHaveBeenCalledTimes(1)

      // Dismissing keyboard and tapping the same accountName box again MUST re-open soft keyboard
      inputEl._trigger('blur')
      inputEl.focus.mockClear()
      renderer.handleMouseUp(300, 325)
      expect(inputEl.focus).toHaveBeenCalledTimes(1)

      // 2. Entering bnet_create_account sets default activeInput = 'accountName'
      agreeTermsOfUse(state)
      expect(state.stage).toBe('bnet_create_account')
      expect(state.activeInput).toBe('accountName')
      inputEl.focus.mockClear()

      renderer.handleMouseUp(300, 330)
      expect(inputEl.focus).toHaveBeenCalledTimes(1)

      // 3. Selecting a campfire class in char_create sets activeInput = 'charName' without popping keyboard,
      //    then tapping the charName box focuses the sink
      state.stage = 'char_create'
      selectCampfireClass(state, 'so')
      expect(state.activeInput).toBe('charName')
      inputEl.focus.mockClear()

      renderer.handleMouseUp(350, 495)
      expect(inputEl.focus).toHaveBeenCalledTimes(1)

      // 4. Entering bnet_lobby sets default activeInput = 'gameName'
      state.stage = 'bnet_lobby'
      state.lobbySubPanel = 'create'
      state.activeInput = 'gameName'
      inputEl.focus.mockClear()

      renderer.handleMouseUp(500, 150)
      expect(inputEl.focus).toHaveBeenCalledTimes(1)

      sink.dispose()
    })

    it('cycles focus across all 3 bnet_create_account fields on Tab and Enter', () => {
      const state = createInitialFlowState()
      agreeTermsOfUse(state)
      const canvas = createMockCanvas()
      const container = createMockContainer()
      const renderer = new FrontendRenderer(canvas, state)
      const inputEl = createMockInputElement()

      const sink = new FrontendImeSink({
        renderer,
        container,
        canvas,
        inputElement: inputEl,
      })

      renderer.handleMouseUp(300, 330)
      expect(state.activeInput).toBe('accountName')
      expect(inputEl.type).toBe('text')

      // Tab -> accountPassword
      const preventDefault = vi.fn()
      const stopPropagation = vi.fn()
      inputEl._trigger('keydown', { key: 'Tab', shiftKey: false, preventDefault, stopPropagation })
      expect(state.activeInput).toBe('accountPassword')
      expect(inputEl.type).toBe('password')

      // Tab -> accountVerifyPassword
      inputEl._trigger('keydown', { key: 'Tab', shiftKey: false, preventDefault, stopPropagation })
      expect(state.activeInput).toBe('accountVerifyPassword')
      expect(inputEl.type).toBe('password')

      // Shift+Tab -> accountPassword
      inputEl._trigger('keydown', { key: 'Tab', shiftKey: true, preventDefault, stopPropagation })
      expect(state.activeInput).toBe('accountPassword')

      sink.dispose()
    })

    it('syncs Join Game list row selection into inputEl without popping up soft keyboard', () => {
      const state = createInitialFlowState()
      state.stage = 'bnet_lobby'
      state.lobbySubPanel = 'join'
      state.activeInput = 'gameName'
      state.realmGames = [
        { index: 0, name: 'BaalRun-01', description: 'fast', playerCount: 5, flags: 0x04 },
      ]
      const canvas = createMockCanvas()
      const container = createMockContainer()
      const renderer = new FrontendRenderer(canvas, state)
      const inputEl = createMockInputElement()

      const sink = new FrontendImeSink({
        renderer,
        container,
        canvas,
        inputElement: inputEl,
      })

      inputEl.focus.mockClear()
      inputEl.blur.mockClear()

      // Tap first row in Join Game list (x=450, y=225)
      renderer.handleMouseUp(450, 225, 1000)
      expect(state.gameName).toBe('BaalRun-01')
      expect(inputEl.value).toBe('BaalRun-01')
      expect(inputEl.focus).not.toHaveBeenCalled()
      expect(inputEl.blur).toHaveBeenCalled()

      sink.dispose()
    })

    it('guards against typing when popupModal is open and dismisses modal on Enter/Escape/Space', () => {
      const state = createInitialFlowState()
      state.stage = 'bnet_login'
      state.accountName = 'HeroAcc'
      const canvas = createMockCanvas()
      const container = createMockContainer()
      const renderer = new FrontendRenderer(canvas, state)
      const inputEl = createMockInputElement()

      const sink = new FrontendImeSink({
        renderer,
        container,
        canvas,
        inputElement: inputEl,
      })

      renderer.handleMouseUp(300, 325)
      expect(inputEl.value).toBe('HeroAcc')

      // Open popup modal
      openPopupModal(state, 'Invalid Password', 'bnet_login')

      // Typing while modal is open must not mutate accountName
      inputEl.value = 'HackedAcc'
      inputEl._trigger('input')
      expect(state.accountName).toBe('HeroAcc')
      expect(inputEl.value).toBe('HeroAcc')

      // Pressing Enter dismisses the modal
      const preventDefault = vi.fn()
      const stopPropagation = vi.fn()
      inputEl._trigger('keydown', { key: 'Enter', preventDefault, stopPropagation })
      expect(state.popupModal).toBeNull()

      sink.dispose()
    })
  })

  describe('Touch Hit-Testing Integration Flow in FrontendRenderer', () => {
    it('sets activeInput on touching accountName editbox in bnet_login', () => {
      const state = createInitialFlowState()
      state.stage = 'bnet_login'
      const canvas = createMockCanvas()
      const renderer = new FrontendRenderer(canvas, state)

      const focusSpy = vi.fn()
      renderer.onActiveInputChange = focusSpy

      // Touch within (278, 316, 243, 31)
      renderer.handleMouseUp(300, 325)
      expect(renderer.state.activeInput).toBe('accountName')
      expect(focusSpy).toHaveBeenCalledWith('accountName')

      // Touch within password box (278, 376, 243, 31)
      renderer.handleMouseUp(300, 385)
      expect(renderer.state.activeInput).toBe('accountPassword')
      expect(focusSpy).toHaveBeenCalledWith('accountPassword')

      // Clear focus via setActiveInput(null)
      renderer.setActiveInput(null)
      expect(renderer.state.activeInput).toBeNull()
      expect(focusSpy).toHaveBeenCalledWith(null)
    })

    it('sets activeInput on touching character name in char_create', () => {
      const state = createInitialFlowState()
      state.stage = 'char_create'
      state.selectedClass = 'pa'
      const canvas = createMockCanvas()
      const renderer = new FrontendRenderer(canvas, state)

      const focusSpy = vi.fn()
      renderer.onActiveInputChange = focusSpy

      // Touch char name box at (318, 485, 175, 28)
      renderer.handleMouseUp(350, 495)
      expect(renderer.state.activeInput).toBe('charName')
      expect(focusSpy).toHaveBeenCalledWith('charName')

      // Clear focus via setActiveInput(null)
      renderer.setActiveInput(null)
      expect(renderer.state.activeInput).toBeNull()
    })

    it('sets activeInput on touching lobby chat and create game boxes', () => {
      const state = createInitialFlowState()
      state.stage = 'bnet_lobby'
      state.lobbySubPanel = 'create'
      const canvas = createMockCanvas()
      const renderer = new FrontendRenderer(canvas, state)

      const focusSpy = vi.fn()
      renderer.onActiveInputChange = focusSpy

      // Touch chat input at (28, 418, 335, 28)
      renderer.handleMouseUp(100, 430)
      expect(renderer.state.activeInput).toBe('chatInput')
      expect(focusSpy).toHaveBeenCalledWith('chatInput')

      // Touch create game name at (427, 137, 188, 25)
      renderer.handleMouseUp(500, 150)
      expect(renderer.state.activeInput).toBe('gameName')
      expect(focusSpy).toHaveBeenCalledWith('gameName')

      // Touch maxPlayers box at (655, 278, 42, 29)
      renderer.handleMouseUp(670, 290)
      expect(renderer.state.activeInput).toBe('maxPlayers')
      expect(focusSpy).toHaveBeenCalledWith('maxPlayers')

      // Clear focus via setActiveInput(null)
      renderer.setActiveInput(null)
      expect(renderer.state.activeInput).toBeNull()
    })
  })
})
