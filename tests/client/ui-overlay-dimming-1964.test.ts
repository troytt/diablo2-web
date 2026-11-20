import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PLUGIN_MENU_LAYOUT } from '../../plugins/index.ts'
import type { D2WebPlugin } from '../../src/client/plugin-host/api.ts'
import { ModMenu } from '../../src/client/plugin-host/mod-menu.ts'
import { PluginConfigStore } from '../../src/client/plugin-host/plugin-config-store.ts'
import { PluginHost } from '../../src/client/plugin-host/plugin-host.ts'
import { PluginMenu } from '../../src/client/plugin-host/plugin-menu.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { SettingsStore } from '../../src/client/settings/settings-store.ts'
import { Toolbar } from '../../src/client/toolbar/toolbar.ts'
import {
  closeModalDomOverlay,
  collectModalDomOverlays,
  dismissAllModalDomOverlays,
  isModalDomOverlayOpen,
  openModalDomOverlay,
  reconcileModalDomOverlays,
  type ModalOverlayOwner,
} from '../../src/client/ui/dom-overlay.ts'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

interface FakeEvent {
  type: string
  key?: string
  target: FakeElement | null
  defaultPrevented: boolean
  stopped: boolean
  preventDefault(): void
  stopImmediatePropagation(): void
  stopPropagation(): void
}

function makeEvent(type: string, init: { key?: string; target?: FakeElement | null } = {}): FakeEvent {
  const ev: FakeEvent = {
    type,
    ...(init.key !== undefined ? { key: init.key } : {}),
    target: init.target ?? null,
    defaultPrevented: false,
    stopped: false,
    preventDefault() {
      ev.defaultPrevented = true
    },
    stopImmediatePropagation() {
      ev.stopped = true
    },
    stopPropagation() {
      ev.stopped = true
    },
  }
  return ev
}

class FakeStyleDeclaration {
  display = ''
  visibility = ''
  pointerEvents = ''
  opacity = ''
  background = ''
  backdropFilter = ''
  webkitBackdropFilter = ''
  borderColor = ''
  boxShadow = ''
  private readonly props = new Map<string, string>()

  setProperty(name: string, value: string): void {
    this.props.set(name, value)
    if (name === 'display') this.display = value
    else if (name === 'visibility') this.visibility = value
    else if (name === 'pointer-events') this.pointerEvents = value
    else if (name === 'opacity') this.opacity = value
    else if (name === 'background') this.background = value
    else if (name === 'backdrop-filter') this.backdropFilter = value
    else if (name === '-webkit-backdrop-filter') this.webkitBackdropFilter = value
  }

  removeProperty(name: string): string {
    const prev = this.props.get(name) ?? ''
    this.props.delete(name)
    if (name === 'display') this.display = ''
    else if (name === 'visibility') this.visibility = ''
    else if (name === 'pointer-events') this.pointerEvents = ''
    else if (name === 'opacity') this.opacity = ''
    else if (name === 'background') this.background = ''
    else if (name === 'backdrop-filter') this.backdropFilter = ''
    else if (name === '-webkit-backdrop-filter') this.webkitBackdropFilter = ''
    return prev
  }

  getPropertyValue(name: string): string {
    return this.props.get(name) ?? ''
  }
}

type FakeListener = (ev: FakeEvent) => void

class FakeElement {
  readonly tagName: string
  readonly ownerDocument: FakeDocument
  readonly style = new FakeStyleDeclaration()
  readonly children: FakeElement[] = []
  parentNode: FakeElement | null = null
  id = ''
  className = ''
  type = ''
  value = ''
  placeholder = ''
  title = ''
  htmlFor = ''
  checked = false
  disabled = false
  scrollTop = 0
  private isHidden = false
  private ownText = ''
  private rawHtml = ''
  private readonly attrs = new Map<string, string>()
  private readonly listeners = new Map<string, FakeListener[]>()

  constructor(tagName: string, ownerDocument: FakeDocument) {
    this.tagName = tagName.toUpperCase()
    this.ownerDocument = ownerDocument
  }

  get options(): FakeElement[] {
    return this.children
  }

  get hidden(): boolean {
    return this.isHidden
  }

  set hidden(val: boolean) {
    this.isHidden = Boolean(val)
    if (this.isHidden) {
      this.attrs.set('hidden', '')
    } else {
      this.attrs.delete('hidden')
    }
  }

  get textContent(): string {
    if (this.children.length === 0) return this.ownText
    return this.ownText + this.children.map((c) => c.textContent).join('')
  }

  set textContent(val: string | null) {
    for (const c of this.children) c.parentNode = null
    this.children.length = 0
    this.ownText = val ?? ''
  }

  get innerHTML(): string {
    return this.rawHtml || this.textContent
  }

  set innerHTML(val: string) {
    this.rawHtml = val
    for (const c of this.children) c.parentNode = null
    this.children.length = 0
    this.ownText = val
  }

  setAttribute(name: string, value: string): void {
    if (name === 'id') this.id = value
    else if (name === 'class') this.className = value
    else if (name === 'hidden') this.isHidden = true
    this.attrs.set(name, value)
  }

  getAttribute(name: string): string | null {
    if (name === 'id') return this.id || null
    if (name === 'class') return this.className || null
    if (name === 'hidden') return this.isHidden ? '' : null
    return this.attrs.get(name) ?? null
  }

  removeAttribute(name: string): void {
    if (name === 'id') this.id = ''
    if (name === 'class') this.className = ''
    if (name === 'hidden') this.isHidden = false
    this.attrs.delete(name)
  }

  appendChild(child: FakeElement): FakeElement {
    if (child.parentNode) {
      child.parentNode.removeChild(child)
    }
    child.parentNode = this
    this.children.push(child)
    return child
  }

  replaceChild(newChild: FakeElement, oldChild: FakeElement): FakeElement {
    const idx = this.children.indexOf(oldChild)
    if (idx >= 0) {
      if (newChild.parentNode) newChild.parentNode.removeChild(newChild)
      oldChild.parentNode = null
      newChild.parentNode = this
      this.children[idx] = newChild
    }
    return oldChild
  }

  removeChild(child: FakeElement): FakeElement {
    const idx = this.children.indexOf(child)
    if (idx >= 0) {
      this.children.splice(idx, 1)
      child.parentNode = null
    }
    return child
  }

  remove(): void {
    this.parentNode?.removeChild(this)
  }

  addEventListener(type: string, listener: FakeListener): void {
    const list = this.listeners.get(type) ?? []
    list.push(listener)
    this.listeners.set(type, list)
  }

  removeEventListener(type: string, listener: FakeListener): void {
    const list = this.listeners.get(type)
    if (!list) return
    const idx = list.indexOf(listener)
    if (idx >= 0) list.splice(idx, 1)
  }

  dispatchEvent(ev: FakeEvent): FakeEvent {
    if (!ev.target) ev.target = this
    for (const fn of [...(this.listeners.get(ev.type) ?? [])]) {
      fn(ev)
      if (ev.stopped) return ev
    }
    if (!ev.stopped && this.parentNode) {
      this.parentNode.dispatchEvent(ev)
    }
    return ev
  }

  click(): void {
    this.dispatchEvent(makeEvent('click', { target: this }))
  }

  focus(): void {
    this.ownerDocument.activeElement = this
  }

  scrollIntoView(): void {}

  matchesSingle(selector: string): boolean {
    const sel = selector.trim()
    if (sel === '[data-d2-modal-overlay]:not([hidden])') {
      return this.attrs.has('data-d2-modal-overlay') && !this.isHidden
    }
    if (sel === '[data-d2-modal-overlay]') {
      return this.attrs.has('data-d2-modal-overlay')
    }
    if (sel.startsWith('#')) {
      return this.id === sel.slice(1)
    }
    if (sel.startsWith('.')) {
      return this.className.split(/\s+/).includes(sel.slice(1))
    }
    const attrEq = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel)
    if (attrEq) {
      return this.getAttribute(attrEq[1]!) === attrEq[2]!
    }
    return this.tagName.toLowerCase() === sel.toLowerCase()
  }

  matchesSelector(selector: string): boolean {
    return selector.split(',').some((part) => this.matchesSingle(part))
  }

  querySelector(selector: string): FakeElement | null {
    for (const child of this.children) {
      if (child.matchesSelector(selector)) return child
      const nested = child.querySelector(selector)
      if (nested) return nested
    }
    return null
  }

  querySelectorAll(selector: string): FakeElement[] {
    const out: FakeElement[] = []
    for (const child of this.children) {
      if (child.matchesSelector(selector)) out.push(child)
      out.push(...child.querySelectorAll(selector))
    }
    return out
  }
}

class FakeDocument {
  readonly documentElement: FakeElement
  readonly head: FakeElement
  readonly body: FakeElement
  activeElement: FakeElement | null = null
  hidden = false
  private readonly listeners = new Map<string, FakeListener[]>()

  constructor() {
    this.documentElement = new FakeElement('html', this)
    this.head = new FakeElement('head', this)
    this.body = new FakeElement('body', this)
    this.documentElement.appendChild(this.head)
    this.documentElement.appendChild(this.body)
  }

  createElement(tag: string): FakeElement {
    return new FakeElement(tag, this)
  }

  getElementById(id: string): FakeElement | null {
    return this.documentElement.querySelector(`#${id}`)
  }

  querySelector(selector: string): FakeElement | null {
    return this.documentElement.querySelector(selector)
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.documentElement.querySelectorAll(selector)
  }

  addEventListener(type: string, listener: FakeListener): void {
    const list = this.listeners.get(type) ?? []
    list.push(listener)
    this.listeners.set(type, list)
  }

  removeEventListener(type: string, listener: FakeListener): void {
    const list = this.listeners.get(type)
    if (!list) return
    const idx = list.indexOf(listener)
    if (idx >= 0) list.splice(idx, 1)
  }

  dispatch(type: string): void {
    const ev = makeEvent(type)
    for (const fn of [...(this.listeners.get(type) ?? [])]) {
      fn(ev)
    }
  }
}

class FakeWindow {
  private readonly captureListeners = new Map<string, FakeListener[]>()
  private readonly bubbleListeners = new Map<string, FakeListener[]>()

  addEventListener(type: string, listener: FakeListener, capture?: boolean | AddEventListenerOptions): void {
    const isCapture = typeof capture === 'boolean' ? capture : Boolean(capture?.capture)
    const map = isCapture ? this.captureListeners : this.bubbleListeners
    const list = map.get(type) ?? []
    list.push(listener)
    map.set(type, list)
  }

  removeEventListener(type: string, listener: FakeListener, capture?: boolean | EventListenerOptions): void {
    const isCapture = typeof capture === 'boolean' ? capture : Boolean(capture?.capture)
    const map = isCapture ? this.captureListeners : this.bubbleListeners
    const list = map.get(type)
    if (!list) return
    const idx = list.indexOf(listener)
    if (idx >= 0) list.splice(idx, 1)
  }

  listenerCount(type: string): number {
    return (this.captureListeners.get(type)?.length ?? 0) + (this.bubbleListeners.get(type)?.length ?? 0)
  }

  dispatchKey(type: 'keydown' | 'keyup', key: string): FakeEvent {
    const ev = makeEvent(type, { key })
    for (const fn of [...(this.captureListeners.get(type) ?? [])]) {
      fn(ev)
      if (ev.stopped) return ev
    }
    for (const fn of [...(this.bubbleListeners.get(type) ?? [])]) {
      fn(ev)
      if (ev.stopped) return ev
    }
    return ev
  }

  dispatch(type: string): FakeEvent {
    const ev = makeEvent(type)
    for (const fn of [...(this.captureListeners.get(type) ?? [])]) {
      fn(ev)
      if (ev.stopped) return ev
    }
    for (const fn of [...(this.bubbleListeners.get(type) ?? [])]) {
      fn(ev)
      if (ev.stopped) return ev
    }
    return ev
  }

  getComputedStyle(el: FakeElement): {
    readonly display: string
    readonly visibility: string
    readonly pointerEvents: string
    readonly opacity: string
    readonly background: string
    readonly backdropFilter: string
  } {
    const classes = new Set(el.className.split(/\s+/).filter(Boolean))
    const isModsOverlay = classes.has('d2-mods-overlay')
    const isModalOverlay =
      isModsOverlay ||
      classes.has('d2-plugin-menu-overlay') ||
      classes.has('d2-toolbar-modal-overlay') ||
      el.getAttribute('data-d2-modal-overlay') !== null

    if (el.hidden && isModalOverlay) {
      return {
        display: 'none',
        visibility: 'hidden',
        pointerEvents: 'none',
        opacity: '0',
        background: 'none',
        backdropFilter: 'none',
      }
    }

    return {
      display: el.style.display || (isModalOverlay ? 'flex' : 'block'),
      visibility: el.style.visibility || 'visible',
      pointerEvents: el.style.pointerEvents || 'auto',
      opacity: el.style.opacity || '1',
      background:
        el.style.background ||
        (isModsOverlay
          ? 'radial-gradient(ellipse at 50% 40%, rgba(16, 10, 5, 0.62) 0%, rgba(2, 1, 1, 0.9) 75%)'
          : isModalOverlay
            ? 'rgba(4, 3, 2, 0.78)'
            : 'none'),
      backdropFilter:
        el.style.backdropFilter || (isModsOverlay ? 'blur(3px) saturate(0.6)' : 'none'),
    }
  }
}

const TEST_PLUGIN: D2WebPlugin = {
  id: 'sample-mod',
  name: { zh: '测试模组', en: 'Sample Mod' },
  description: { zh: '测试说明', en: 'Sample description' },
  defaultEnabled: true,
  activate: () => ({ deactivate() {} }),
}

describe('UI modal overlay dimming & backdrop-filter teardown (#1964)', () => {
  let prevDocument: unknown
  let prevWindow: unknown
  let doc: FakeDocument
  let win: FakeWindow

  beforeEach(() => {
    const g = globalThis as { document?: unknown; window?: unknown }
    prevDocument = g.document
    prevWindow = g.window
    doc = new FakeDocument()
    win = new FakeWindow()
    g.document = doc
    g.window = win
  })

  afterEach(() => {
    const g = globalThis as { document?: unknown; window?: unknown }
    g.document = prevDocument
    g.window = prevWindow
  })

  function expectAllModalOverlaysCompletelyHidden(): void {
    expect(doc.querySelector('[data-d2-modal-overlay]:not([hidden])')).toBeNull()
    expect(isModalDomOverlayOpen(doc as unknown as Document)).toBe(false)
    const overlays = collectModalDomOverlays(doc as unknown as Document)
    expect(overlays.length).toBeGreaterThan(0)
    for (const raw of overlays) {
      const el = raw as unknown as FakeElement
      expect(el.hidden).toBe(true)
      expect(el.getAttribute('aria-hidden')).toBe('true')
      expect(el.style.display).toBe('none')
      expect(el.style.visibility).toBe('hidden')
      expect(el.style.pointerEvents).toBe('none')
      expect(el.style.backdropFilter).toBe('none')
      const computed = win.getComputedStyle(el)
      expect(computed.display).toBe('none')
      expect(computed.visibility).toBe('hidden')
      expect(computed.pointerEvents).toBe('none')
      expect(computed.backdropFilter).toBe('none')
    }
  }

  it('scopes .d2-mods-overlay backdrop-filter strictly to :not([hidden]) and enforces compositor teardown on [hidden] across CSS bundles', () => {
    const pluginMenuCss = readFileSync(
      resolve(process.cwd(), 'src/client/theme/plugin-menu.css'),
      'utf8',
    )
    const toolbarCss = readFileSync(
      resolve(process.cwd(), 'src/client/toolbar/toolbar.css'),
      'utf8',
    )

    expect(pluginMenuCss).toContain('.d2-mods-overlay:not([hidden])')
    expect(pluginMenuCss).toContain('.d2-mods-overlay:not([hidden]) .d2-mods')

    const baseOverlayBlock = /\.d2-mods-overlay\s*\{([\s\S]*?)\}/.exec(pluginMenuCss)?.[1] ?? ''
    expect(baseOverlayBlock).not.toContain('backdrop-filter')

    const hiddenOverlayBlock =
      /\.d2-mods-overlay\[hidden\],\s*\[data-d2-modal-overlay\]\[hidden\]\s*\{([\s\S]*?)\}/.exec(
        pluginMenuCss,
      )?.[1] ?? ''
    expect(hiddenOverlayBlock).toContain('display: none !important')
    expect(hiddenOverlayBlock).toContain('visibility: hidden !important')
    expect(hiddenOverlayBlock).toContain('pointer-events: none !important')
    expect(hiddenOverlayBlock).toContain('background: none !important')
    expect(hiddenOverlayBlock).toContain('backdrop-filter: none !important')

    const toolbarHiddenBlock =
      /\.d2-toolbar-modal-overlay\[hidden\]\s*\{([\s\S]*?)\}/.exec(toolbarCss)?.[1] ?? ''
    expect(toolbarHiddenBlock).toContain('display: none !important')
    expect(toolbarHiddenBlock).toContain('visibility: hidden !important')
    expect(toolbarHiddenBlock).toContain('pointer-events: none !important')
    expect(toolbarHiddenBlock).toContain('backdrop-filter: none !important')
  })

  it('tears down display and backdrop-filter across ModMenu, Config, and Bug-Report modals on close button, backdrop click, mutual exclusion, and Escape', async () => {
    const toolbarContainer = doc.createElement('div')
    toolbarContainer.id = 'd2-toolbar-container'
    doc.body.appendChild(toolbarContainer)

    const store = new SettingsStore({
      storage: new MemoryStorage(),
      defaultLang: 'zh',
      syncGlobalLang: false,
    })

    let modMenuRef: ModMenu | null = null
    const toolbar = new Toolbar({
      container: toolbarContainer as unknown as HTMLElement,
      store,
      callbacks: {
        onPluginsToggle: () => {
          modMenuRef?.toggle()
        },
        onModalOpen: () => {
          modMenuRef?.close()
        },
      },
    })

    const host = new PluginHost({
      plugins: [TEST_PLUGIN],
      configStore: new PluginConfigStore([TEST_PLUGIN], { storage: new MemoryStorage() }),
      session: new OnlineSession(),
      toolbar,
      autoStart: false,
    })
    await host.start()

    const modMenu = new ModMenu({
      host,
      toolbar,
      layout: PLUGIN_MENU_LAYOUT,
      onOpen: () => {
        toolbar.closeModals()
      },
    })
    modMenuRef = modMenu

    // Initial state: all 3 overlays mounted hidden with display:none and backdropFilter:none
    expectAllModalOverlaysCompletelyHidden()

    // 1. Open ModMenu -> verify active dim/backdrop-filter, then close via close button
    modMenu.open()
    const modOverlay = modMenu.getElement() as unknown as FakeElement
    expect(isModalDomOverlayOpen(doc as unknown as Document)).toBe(true)
    expect(win.getComputedStyle(modOverlay).display).toBe('flex')
    expect(win.getComputedStyle(modOverlay).backdropFilter).toBe('blur(3px) saturate(0.6)')
    doc.getElementById('d2-plugin-menu-close')!.click()
    expect(modMenu.isOpen()).toBe(false)
    expectAllModalOverlaysCompletelyHidden()

    // 2. Open ModMenu -> close via backdrop click
    modMenu.open()
    expect(isModalDomOverlayOpen(doc as unknown as Document)).toBe(true)
    modOverlay.dispatchEvent(makeEvent('click', { target: modOverlay }))
    expect(modMenu.isOpen()).toBe(false)
    expectAllModalOverlaysCompletelyHidden()

    // 3. Open ModMenu -> mutual exclusion when opening Config modal -> mutual exclusion when opening Bug modal -> mutual exclusion back to ModMenu
    modMenu.open()
    expect(modMenu.isOpen()).toBe(true)
    toolbar.openConfigModal()
    expect(modMenu.isOpen()).toBe(false)
    expect(toolbar.isConfigModalOpen()).toBe(true)
    expect(win.getComputedStyle(modOverlay).display).toBe('none')
    expect(win.getComputedStyle(modOverlay).backdropFilter).toBe('none')

    toolbar.openBugModal()
    expect(toolbar.isConfigModalOpen()).toBe(false)
    expect(toolbar.isBugModalOpen()).toBe(true)

    modMenu.open()
    expect(toolbar.isBugModalOpen()).toBe(false)
    expect(modMenu.isOpen()).toBe(true)

    // 4. Close ModMenu via Escape
    win.dispatchKey('keydown', 'Escape')
    expect(modMenu.isOpen()).toBe(false)
    expectAllModalOverlaysCompletelyHidden()

    // 5. Open Config & Bug modals and close via Escape and backdrop click
    toolbar.openConfigModal()
    expect(isModalDomOverlayOpen(doc as unknown as Document)).toBe(true)
    win.dispatchKey('keydown', 'Escape')
    expect(toolbar.isConfigModalOpen()).toBe(false)
    expectAllModalOverlaysCompletelyHidden()

    toolbar.openBugModal()
    const bugOverlay = toolbar.getBugModalOverlayElement() as unknown as FakeElement
    bugOverlay.dispatchEvent(makeEvent('click', { target: bugOverlay }))
    expect(toolbar.isBugModalOpen()).toBe(false)
    expectAllModalOverlaysCompletelyHidden()

    // 6. State/DOM desync recovery: force hidden=false while openState===false, then call close()
    openModalDomOverlay(modOverlay)
    expect(isModalDomOverlayOpen(doc as unknown as Document)).toBe(true)
    modMenu.close()
    expectAllModalOverlaysCompletelyHidden()

    openModalDomOverlay(toolbar.getConfigModalOverlayElement())
    expect(isModalDomOverlayOpen(doc as unknown as Document)).toBe(true)
    toolbar.closeModals()
    expectAllModalOverlaysCompletelyHidden()

    modMenu.destroy()
    toolbar.destroy()
    await host.destroy()
  })

  it('prevents orphaned #d2-plugin-menu-overlay leaks on re-mount, child-slot container:null, destroy(), room lifecycle, and visibilitychange/blur', async () => {
    const toolbarContainer = doc.createElement('div')
    doc.body.appendChild(toolbarContainer)
    const store = new SettingsStore({
      storage: new MemoryStorage(),
      defaultLang: 'zh',
      syncGlobalLang: false,
    })
    const toolbar = new Toolbar({
      container: toolbarContainer as unknown as HTMLElement,
      store,
    })
    const host = new PluginHost({
      plugins: [TEST_PLUGIN],
      configStore: new PluginConfigStore([TEST_PLUGIN], { storage: new MemoryStorage() }),
      session: new OnlineSession(),
      toolbar,
      autoStart: false,
    })
    await host.start()

    // Inject an unowned orphan .d2-mods-overlay left behind before ModMenu mounts
    const leakedBeforeMount = doc.createElement('div')
    leakedBeforeMount.id = 'd2-plugin-menu-overlay'
    leakedBeforeMount.className = 'd2-mods-overlay d2-plugin-menu-overlay'
    leakedBeforeMount.setAttribute('data-d2-modal-overlay', 'plugins')
    openModalDomOverlay(leakedBeforeMount)
    doc.body.appendChild(leakedBeforeMount)
    expect(isModalDomOverlayOpen(doc as unknown as Document)).toBe(true)

    // Mounting ModMenu deduplicates and removes the stale #d2-plugin-menu-overlay
    const primaryMenu = new ModMenu({ host, toolbar, layout: PLUGIN_MENU_LAYOUT })
    expect(leakedBeforeMount.parentNode).toBeNull()
    expect(doc.querySelectorAll('#d2-plugin-menu-overlay')).toHaveLength(1)
    expectAllModalOverlaysCompletelyHidden()

    // Multibox child slot (`container: null`) neither appends to document.body nor registers window key listeners
    const listenersBeforeChild = win.listenerCount('keydown')
    const childSlotMenu = new ModMenu({
      host,
      toolbar: null,
      container: null,
      layout: PLUGIN_MENU_LAYOUT,
    })
    expect(doc.querySelectorAll('#d2-plugin-menu-overlay')).toHaveLength(1)
    expect(win.listenerCount('keydown')).toBe(listenersBeforeChild)
    childSlotMenu.destroy()

    const owners: readonly ModalOverlayOwner[] = [
      {
        element: primaryMenu.getElement(),
        isOpen: () => primaryMenu.isOpen(),
        close: () => primaryMenu.close(),
      },
      {
        element: toolbar.getConfigModalOverlayElement(),
        isOpen: () => toolbar.isConfigModalOpen(),
        close: () => toolbar.closeConfigModal(),
      },
      {
        element: toolbar.getBugModalOverlayElement(),
        isOpen: () => toolbar.isBugModalOpen(),
        close: () => toolbar.closeBugModal(),
      },
    ]

    // Simulate visibilitychange / blur sweeping an injected orphan .d2-mods-overlay and headless dialog
    const orphanOverlay = doc.createElement('div')
    orphanOverlay.className = 'd2-mods-overlay'
    orphanOverlay.setAttribute('data-d2-modal-overlay', 'plugins')
    openModalDomOverlay(orphanOverlay)
    doc.body.appendChild(orphanOverlay)
    expect(isModalDomOverlayOpen(doc as unknown as Document)).toBe(true)

    const cleanedCount = reconcileModalDomOverlays({
      doc: doc as unknown as Document,
      owners,
    })
    expect(cleanedCount).toBeGreaterThanOrEqual(1)
    expect(orphanOverlay.parentNode).toBeNull()
    expectAllModalOverlaysCompletelyHidden()

    // Simulate inner dialog hidden while outer .d2-mods-overlay stays open -> reconcile closes headless dim overlay
    primaryMenu.open()
    const innerDialog = doc.getElementById('d2-plugin-menu')!
    innerDialog.hidden = true
    reconcileModalDomOverlays({
      doc: doc as unknown as Document,
      owners,
    })
    expect(primaryMenu.isOpen()).toBe(false)
    expectAllModalOverlaysCompletelyHidden()
    innerDialog.hidden = false

    // Simulate room entry / exit dismissing all open modals
    primaryMenu.open()
    expect(isModalDomOverlayOpen(doc as unknown as Document)).toBe(true)
    dismissAllModalDomOverlays(doc as unknown as Document, owners)
    expect(primaryMenu.isOpen()).toBe(false)
    expectAllModalOverlaysCompletelyHidden()

    // Legacy PluginMenu also enforces closeModalDomOverlay & deduplication
    primaryMenu.destroy()
    expect(doc.querySelector('#d2-plugin-menu-overlay')).toBeNull()

    const legacyMenu = new PluginMenu({ host, toolbar })
    legacyMenu.open()
    expect(isModalDomOverlayOpen(doc as unknown as Document)).toBe(true)
    closeModalDomOverlay(legacyMenu.getElement())
    legacyMenu.close()
    expect(legacyMenu.isOpen()).toBe(false)
    expectAllModalOverlaysCompletelyHidden()

    legacyMenu.destroy()
    toolbar.destroy()
    await host.destroy()
  })
})
