/**
 * Diablo II Web Client: Front-End Invisible IME/Keyboard Sink (`FrontendImeSink`)
 *
 * Provides a DOM `<input>` element bridge (`#d2-frontend-ime-sink`) positioned over the active
 * canvas editbox on Battle.net front-end screens (Login, Create Account, Campfire Character
 * Creation, and Battle.net Lobby Chat / Game Creation & Join).
 *
 * On mobile touch devices (iOS Safari, Android Chrome, and touch emulators), touching any
 * front-end editbox triggers synchronous `.focus()` on this element during the native `touchend`
 * gesture, reliably invoking the system soft keyboard / virtual input method (IME).
 *
 * It also enables full IME composition (Chinese/Japanese/Korean pinyin and multi-byte typing),
 * paste, and native selection while preserving 100% authentic Diablo II bitmap font rendering
 * and blinking caret drawing on `#bnet-canvas`.
 */

import type { ActiveInputField } from './flow-state.ts'
import {
  canAcceptCharNameChar,
  isValidAccountChar,
} from './flow-state.ts'
import type { FrontendRenderer } from './frontend-renderer.ts'

export interface FieldInputAttributes {
  readonly type: 'text' | 'password'
  readonly inputMode: 'text' | 'numeric'
  readonly autocomplete: string
  readonly autocapitalize: string
  readonly maxLength: number
}

/**
 * Returns DOM input element attributes tailored to the active Diablo II front-end field.
 */
export function getFieldInputAttributes(
  field: Exclude<ActiveInputField, null>,
): FieldInputAttributes {
  switch (field) {
    case 'accountName':
    case 'bnet_account':
      return {
        type: 'text',
        inputMode: 'text',
        autocomplete: 'username',
        autocapitalize: 'none',
        maxLength: 15,
      }
    case 'accountPassword':
    case 'bnet_password':
      return {
        type: 'password',
        inputMode: 'text',
        autocomplete: 'current-password',
        autocapitalize: 'none',
        maxLength: 15,
      }
    case 'accountVerifyPassword':
    case 'bnet_verify_password':
      return {
        type: 'password',
        inputMode: 'text',
        autocomplete: 'new-password',
        autocapitalize: 'none',
        maxLength: 15,
      }
    case 'charName':
      return {
        type: 'text',
        inputMode: 'text',
        autocomplete: 'off',
        autocapitalize: 'words',
        maxLength: 15,
      }
    case 'gameName':
      return {
        type: 'text',
        inputMode: 'text',
        autocomplete: 'off',
        autocapitalize: 'none',
        maxLength: 15,
      }
    case 'gamePassword':
      return {
        type: 'password',
        inputMode: 'text',
        autocomplete: 'off',
        autocapitalize: 'none',
        maxLength: 15,
      }
    case 'gameDescription':
      return {
        type: 'text',
        inputMode: 'text',
        autocomplete: 'off',
        autocapitalize: 'none',
        maxLength: 31,
      }
    case 'maxPlayers':
      return {
        type: 'text',
        inputMode: 'numeric',
        autocomplete: 'off',
        autocapitalize: 'none',
        maxLength: 1,
      }
    case 'charDifference':
      return {
        type: 'text',
        inputMode: 'numeric',
        autocomplete: 'off',
        autocapitalize: 'none',
        maxLength: 2,
      }
    case 'chatInput':
      return {
        type: 'text',
        inputMode: 'text',
        autocomplete: 'off',
        autocapitalize: 'none',
        maxLength: 38,
      }
  }
}

/**
 * Sanitizes typed or pasted text against Diablo II 1.13c field rules.
 */
export function sanitizeFieldValue(
  field: Exclude<ActiveInputField, null>,
  raw: string,
): string {
  switch (field) {
    case 'accountName':
    case 'bnet_account':
      return [...raw].filter((ch) => isValidAccountChar(ch)).join('').slice(0, 15)

    case 'accountPassword':
    case 'bnet_password':
    case 'accountVerifyPassword':
    case 'bnet_verify_password':
      return [...raw]
        .filter((ch) => {
          const code = ch.charCodeAt(0)
          return code >= 0x20 && code <= 0x7e
        })
        .join('')
        .slice(0, 15)

    case 'charName': {
      let acc = ''
      for (const ch of raw) {
        if (canAcceptCharNameChar(acc, ch)) {
          acc += ch
        }
      }
      return acc.slice(0, 15)
    }

    case 'gameName':
      return [...raw].filter((ch) => /^[A-Za-z0-9_-]$/.test(ch)).join('').slice(0, 15)

    case 'gamePassword':
      return [...raw].filter((ch) => /^[A-Za-z0-9_-]$/.test(ch)).join('').slice(0, 15)

    case 'gameDescription':
      return [...raw]
        .filter((ch) => {
          const code = ch.charCodeAt(0)
          return code >= 0x20 && code <= 0x7e
        })
        .join('')
        .slice(0, 31)

    case 'maxPlayers': {
      const match = raw.replace(/[^1-8]/g, '')
      return match ? match.slice(-1) : '8'
    }

    case 'charDifference': {
      const digits = raw.replace(/\D/g, '').slice(0, 2)
      if (!digits) return ''
      const num = Math.min(99, Math.max(0, parseInt(digits, 10)))
      return String(num)
    }

    case 'chatInput':
      return raw.slice(0, 38)
  }
}

export interface FrontendImeSinkOptions {
  readonly renderer: FrontendRenderer
  readonly container: HTMLElement
  readonly canvas: HTMLCanvasElement
  readonly inputElement?: HTMLInputElement | undefined
}

export class FrontendImeSink {
  readonly renderer: FrontendRenderer
  readonly container: HTMLElement
  readonly canvas: HTMLCanvasElement
  readonly inputEl: HTMLInputElement

  private isComposing = false
  private disposed = false
  private lastStage: string
  private lastSubPanel: string
  private lastActiveInput: ActiveInputField
  private lastHasPopupModal: boolean
  private readonly cleanupFns: (() => void)[] = []

  constructor(options: FrontendImeSinkOptions) {
    this.renderer = options.renderer
    this.container = options.container
    this.canvas = options.canvas
    this.lastStage = this.renderer.state.stage
    this.lastSubPanel = this.renderer.state.lobbySubPanel
    this.lastActiveInput = this.renderer.state.activeInput
    this.lastHasPopupModal = this.renderer.state.popupModal !== null

    if (options.inputElement) {
      this.inputEl = options.inputElement
    } else {
      let el = this.container.querySelector<HTMLInputElement>(
        '.d2-frontend-ime-sink, #d2-frontend-ime-sink',
      )
      if (!el) {
        el = document.createElement('input')
        el.className = 'd2-frontend-ime-sink'
        if (!document.getElementById('d2-frontend-ime-sink')) {
          el.id = 'd2-frontend-ime-sink'
        }
        this.container.appendChild(el)
      }
      this.inputEl = el
    }

    this.configureElementStyles()
    this.bindEvents()

    // Hook renderer callback for focus changes
    const previousHandler = this.renderer.onActiveInputChange
    this.renderer.onActiveInputChange = (field, focus = true) => {
      previousHandler?.(field, focus)
      this.lastStage = this.renderer.state.stage
      this.lastSubPanel = this.renderer.state.lobbySubPanel
      this.lastActiveInput = field
      this.lastHasPopupModal = this.renderer.state.popupModal !== null
      this.syncFromActiveInput(field, focus)
    }

    const previousRenderSync = this.renderer.onRenderSync
    this.renderer.onRenderSync = () => {
      previousRenderSync?.()
      if (this.disposed) return
      const st = this.renderer.state
      const hasPopup = st.popupModal !== null
      if (
        st.stage !== this.lastStage ||
        st.lobbySubPanel !== this.lastSubPanel ||
        st.activeInput !== this.lastActiveInput ||
        hasPopup !== this.lastHasPopupModal
      ) {
        this.lastStage = st.stage
        this.lastSubPanel = st.lobbySubPanel
        this.lastActiveInput = st.activeInput
        this.lastHasPopupModal = hasPopup
        this.syncFromActiveInput(st.activeInput, false)
      }
    }

    // Initial sync
    if (this.renderer.state.activeInput) {
      this.syncFromActiveInput(this.renderer.state.activeInput, false)
    }
  }

  private configureElementStyles(): void {
    const el = this.inputEl
    el.tabIndex = -1
    el.setAttribute('autocomplete', 'off')
    el.setAttribute('autocorrect', 'off')
    el.setAttribute('autocapitalize', 'off')
    el.setAttribute('spellcheck', 'false')
    el.dataset.d2Synced = '1'

    el.style.position = 'absolute'
    el.style.opacity = '0'
    el.style.pointerEvents = 'none'
    el.style.background = 'transparent'
    el.style.border = 'none'
    el.style.outline = 'none'
    el.style.padding = '0'
    el.style.margin = '0'
    el.style.color = 'transparent'
    el.style.caretColor = 'transparent'
    el.style.fontSize = '16px' // Crucial: prevents mobile Safari from auto-zooming viewport
    el.style.zIndex = '20'
    el.style.display = 'none'
  }

  private bindEvents(): void {
    const el = this.inputEl

    const onInput = (): void => {
      if (this.disposed) return
      const activeField = this.renderer.state.activeInput
      if (!activeField) return

      if (this.renderer.state.popupModal !== null) {
        el.value = this.renderer.getFieldValue(activeField)
        return
      }

      if (this.isComposing && activeField === 'chatInput') {
        this.renderer.setFieldValue('chatInput', el.value.slice(0, 38))
        this.renderer.markDirty()
        this.renderer.render(performance.now())
        return
      }

      if (!this.isComposing) {
        const sanitized = sanitizeFieldValue(activeField, el.value)
        if (el.value !== sanitized) {
          el.value = sanitized
        }
        this.renderer.setFieldValue(activeField, sanitized)
        this.renderer.markDirty()
        this.renderer.render(performance.now())
      }
    }

    const onCompositionStart = (): void => {
      this.isComposing = true
    }

    const onCompositionEnd = (): void => {
      this.isComposing = false
      onInput()
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      if (this.disposed) return
      if (this.isComposing) return

      if (this.renderer.state.popupModal !== null) {
        if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          el.blur()
          this.renderer.handleKeyDown(e)
          this.syncFromActiveInput(this.renderer.state.activeInput, false)
        }
        return
      }

      const activeField = this.renderer.state.activeInput
      if (!activeField) return

      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()

        const sanitized = sanitizeFieldValue(activeField, el.value)
        this.renderer.setFieldValue(activeField, sanitized)

        if (
          this.renderer.state.stage === 'bnet_login' &&
          (activeField === 'accountName' || activeField === 'bnet_account') &&
          this.renderer.state.accountName.trim().length > 0 &&
          this.renderer.state.accountPassword.length === 0
        ) {
          this.renderer.setActiveInput('accountPassword')
          return
        }

        if (this.renderer.state.stage === 'bnet_create_account') {
          if (
            (activeField === 'accountName' || activeField === 'bnet_account') &&
            this.renderer.state.accountName.trim().length > 0 &&
            this.renderer.state.accountPassword.length === 0
          ) {
            this.renderer.setActiveInput('accountPassword')
            return
          }
          if (
            (activeField === 'accountPassword' || activeField === 'bnet_password') &&
            this.renderer.state.accountPassword.length > 0 &&
            this.renderer.state.accountVerifyPassword.length === 0
          ) {
            this.renderer.setActiveInput('accountVerifyPassword')
            return
          }
        }

        this.renderer.handleKeyDown(e)

        if (activeField === 'chatInput') {
          el.value = ''
          this.renderer.markDirty()
        } else {
          this.syncFromActiveInput(this.renderer.state.activeInput, false)
        }
        return
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        this.renderer.handleKeyDown(e)
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        el.blur()
        this.renderer.handleKeyDown(e)
        this.syncFromActiveInput(this.renderer.state.activeInput, false)
        return
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (activeField === 'maxPlayers' || activeField === 'charDifference') {
          e.preventDefault()
          e.stopPropagation()
          this.renderer.handleKeyDown(e)
          el.value = this.renderer.getFieldValue(activeField)
          this.renderer.markDirty()
          return
        }
      }
    }

    const onBlur = (): void => {
      if (this.disposed) return
      // Keep `this.renderer.state.activeInput` intact per 1.13c so the blinking
      // underscore cursor and physical keyboard input continue working after
      // dismissing the mobile soft keyboard or clicking non-editbox controls.
      this.isComposing = false
      this.renderer.markDirty()
    }

    el.addEventListener('input', onInput)
    el.addEventListener('compositionstart', onCompositionStart)
    el.addEventListener('compositionend', onCompositionEnd)
    el.addEventListener('keydown', onKeyDown)
    el.addEventListener('blur', onBlur)

    this.cleanupFns.push(() => {
      el.removeEventListener('input', onInput)
      el.removeEventListener('compositionstart', onCompositionStart)
      el.removeEventListener('compositionend', onCompositionEnd)
      el.removeEventListener('keydown', onKeyDown)
      el.removeEventListener('blur', onBlur)
    })

    const onResize = (): void => {
      this.updatePosition()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onResize)
      window.visualViewport?.addEventListener('resize', onResize)
      window.visualViewport?.addEventListener('scroll', onResize)

      this.cleanupFns.push(() => {
        window.removeEventListener('resize', onResize)
        window.visualViewport?.removeEventListener('resize', onResize)
        window.visualViewport?.removeEventListener('scroll', onResize)
      })
    }
  }

  /**
   * Dynamically aligns the `<input>` element with the bounding box of the active editbox on canvas.
   */
  updatePosition(): void {
    if (this.disposed || !this.inputEl) return
    const activeField = this.renderer.state.activeInput
    if (!activeField) {
      this.inputEl.style.display = 'none'
      return
    }

    const bounds = this.renderer.getActiveInputBounds(activeField)
    if (!bounds) {
      this.inputEl.style.display = 'none'
      return
    }

    const canvasRect = this.canvas.getBoundingClientRect()
    const containerRect = this.container.getBoundingClientRect()
    if (canvasRect.width <= 0 || canvasRect.height <= 0) return

    const scaleX = canvasRect.width / 800
    const scaleY = canvasRect.height / 600

    const left = canvasRect.left - containerRect.left + bounds.x * scaleX
    const top = canvasRect.top - containerRect.top + bounds.y * scaleY
    const width = Math.max(1, bounds.width * scaleX)
    const height = Math.max(1, bounds.height * scaleY)

    this.inputEl.style.display = 'block'
    this.inputEl.style.left = `${Math.round(left)}px`
    this.inputEl.style.top = `${Math.round(top)}px`
    this.inputEl.style.width = `${Math.round(width)}px`
    this.inputEl.style.height = `${Math.round(height)}px`
  }

  /**
   * Synchronizes the DOM `<input>` with the specified active front-end field.
   */
  syncFromActiveInput(field: ActiveInputField, focus = true): void {
    if (this.disposed || !this.inputEl) return

    if (!field || this.renderer.state.popupModal !== null) {
      if (typeof document === 'undefined' || document.activeElement === this.inputEl) {
        this.inputEl.blur()
      }
      this.inputEl.style.display = 'none'
      return
    }

    const attrs = getFieldInputAttributes(field)
    if (this.inputEl.type !== attrs.type) {
      this.inputEl.type = attrs.type
    }
    this.inputEl.inputMode = attrs.inputMode
    this.inputEl.setAttribute('autocomplete', attrs.autocomplete)
    this.inputEl.setAttribute('autocapitalize', attrs.autocapitalize)
    this.inputEl.maxLength = attrs.maxLength

    const curVal = this.renderer.getFieldValue(field)
    this.inputEl.value = curVal

    this.updatePosition()

    if (focus) {
      this.inputEl.focus()
      try {
        const len = this.inputEl.value.length
        this.inputEl.setSelectionRange(len, len)
      } catch {
        // Some input types (e.g. number) might throw on setSelectionRange in some browsers
      }
    } else if (typeof document === 'undefined' || document.activeElement === this.inputEl) {
      this.inputEl.blur()
    }
    this.renderer.markDirty()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const fn of this.cleanupFns) {
      fn()
    }
    this.cleanupFns.length = 0
    this.inputEl.remove()
  }
}
