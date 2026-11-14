import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { D2WebPlugin } from '../../../src/client/plugin-host/api.ts'
import {
  PLUGIN_CONFIG_STORAGE_KEY,
  PluginConfigStore,
} from '../../../src/client/plugin-host/plugin-config-store.ts'
import {
  PluginHost,
  type PluginHostToolbarPort,
} from '../../../src/client/plugin-host/plugin-host.ts'
import { PluginMenu } from '../../../src/client/plugin-host/plugin-menu.ts'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import { isModalDomOverlayOpen } from '../../../src/client/ui/dom-overlay.ts'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
}

type FakeListener = (event: FakeEvent) => void

interface FakeEvent {
  type: string
  key?: string
  target?: FakeElement | null
  defaultPrevented: boolean
  immediatePropagationStopped: boolean
  preventDefault(): void
  stopImmediatePropagation(): void
}

function makeFakeEvent(type: string, init: { key?: string; target?: FakeElement | null } = {}): FakeEvent {
  const ev: FakeEvent = {
    type,
    ...(init.key !== undefined ? { key: init.key } : {}),
    target: init.target ?? null,
    defaultPrevented: false,
    immediatePropagationStopped: false,
    preventDefault() {
      ev.defaultPrevented = true
    },
    stopImmediatePropagation() {
      ev.immediatePropagationStopped = true
    },
  }
  return ev
}

class FakeElement {
  readonly tagName: string
  readonly ownerDocument: FakeDocument
  readonly style: Record<string, string> = {}
  readonly dataset: Record<string, string> = {}
  id = ''
  className = ''
  type = ''
  checked = false
  value = ''
  href = ''
  target = ''
  rel = ''
  parentNode: FakeElement | null = null
  readonly children: FakeElement[] = []
  private readonly attrs = new Map<string, string>()
  private readonly listeners = new Map<string, FakeListener[]>()
  private text = ''
  private isHidden = false

  constructor(tagName: string, ownerDocument: FakeDocument) {
    this.tagName = tagName.toLowerCase()
    this.ownerDocument = ownerDocument
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
    if (this.children.length === 0) return this.text
    return this.text + this.children.map((c) => c.textContent).join('')
  }

  set textContent(val: string | null) {
    this.children.length = 0
    this.text = val ?? ''
  }

  get innerHTML(): string {
    return this.textContent
  }

  set innerHTML(val: string) {
    this.children.length = 0
    this.text = val
  }

  setAttribute(name: string, value: string): void {
    if (name === 'id') this.id = value
    if (name === 'hidden') this.isHidden = true
    this.attrs.set(name, value)
  }

  getAttribute(name: string): string | null {
    if (name === 'id' && this.id) return this.id
    if (name === 'hidden') return this.isHidden ? '' : null
    return this.attrs.get(name) ?? null
  }

  appendChild(child: FakeElement): FakeElement {
    if (child.parentNode) {
      child.parentNode.removeChild(child)
    }
    child.parentNode = this
    this.children.push(child)
    return child
  }

  removeChild(child: FakeElement): FakeElement {
    const idx = this.children.indexOf(child)
    if (idx >= 0) {
      this.children.splice(idx, 1)
      child.parentNode = null
    }
    return child
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

  dispatchEvent(event: FakeEvent): void {
    if (!event.target) event.target = this
    const list = [...(this.listeners.get(event.type) ?? [])]
    for (const fn of list) {
      fn(event)
      if (event.immediatePropagationStopped) break
    }
  }

  click(): void {
    this.dispatchEvent(makeFakeEvent('click', { target: this }))
  }

  focus(): void {
    this.ownerDocument.activeElement = this
  }

  matchesSelector(selector: string): boolean {
    if (selector === '[data-d2-modal-overlay]:not([hidden])') {
      return this.attrs.has('data-d2-modal-overlay') && !this.isHidden
    }
    if (selector.startsWith('#')) {
      return this.id === selector.slice(1)
    }
    const attrMatch = /^\[([a-z0-9-]+)="([^"]+)"\]$/i.exec(selector)
    if (attrMatch) {
      return this.getAttribute(attrMatch[1]!) === attrMatch[2]!
    }
    return false
  }

  querySelector(selector: string): FakeElement | null {
    for (const child of this.children) {
      if (child.matchesSelector(selector)) return child
      const found = child.querySelector(selector)
      if (found) return found
    }
    return null
  }
}

class FakeDocument {
  readonly head: FakeElement
  readonly body: FakeElement
  activeElement: FakeElement | null = null

  constructor() {
    this.head = new FakeElement('head', this)
    this.body = new FakeElement('body', this)
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this)
  }

  getElementById(id: string): FakeElement | null {
    return this.head.querySelector(`#${id}`) ?? this.body.querySelector(`#${id}`)
  }

  querySelector(selector: string): FakeElement | null {
    return this.head.querySelector(selector) ?? this.body.querySelector(selector)
  }
}

class FakeWindow {
  private readonly captureListeners = new Map<string, FakeListener[]>()
  private readonly bubbleListeners = new Map<string, FakeListener[]>()

  addEventListener(type: string, listener: FakeListener, capture?: boolean): void {
    const map = capture ? this.captureListeners : this.bubbleListeners
    const list = map.get(type) ?? []
    list.push(listener)
    map.set(type, list)
  }

  removeEventListener(type: string, listener: FakeListener, capture?: boolean): void {
    const map = capture ? this.captureListeners : this.bubbleListeners
    const list = map.get(type)
    if (!list) return
    const idx = list.indexOf(listener)
    if (idx >= 0) list.splice(idx, 1)
  }

  dispatchKey(type: 'keydown' | 'keyup', key: string): FakeEvent {
    const ev = makeFakeEvent(type, { key })
    for (const fn of [...(this.captureListeners.get(type) ?? [])]) {
      fn(ev)
      if (ev.immediatePropagationStopped) return ev
    }
    for (const fn of [...(this.bubbleListeners.get(type) ?? [])]) {
      fn(ev)
      if (ev.immediatePropagationStopped) return ev
    }
    return ev
  }
}

function makeMenuPlugin(overrides: Partial<D2WebPlugin> & { onAction?: () => void } = {}): D2WebPlugin {
  return {
    id: overrides.id ?? 'kill-stats',
    name: overrides.name ?? { zh: '击杀统计', en: 'Kill Stats' },
    description: overrides.description ?? {
      zh: '记录角色击杀数据',
      en: 'Record character kill statistics',
    },
    defaultEnabled: overrides.defaultEnabled ?? true,
    settings: overrides.settings ?? [
      {
        kind: 'boolean',
        key: 'showToolbarShortcut',
        label: { zh: '在工具栏显示快捷入口', en: 'Show shortcut in toolbar' },
        default: true,
      },
      {
        kind: 'select',
        key: 'theme',
        label: { zh: '主题', en: 'Theme' },
        default: 'gold',
        options: [
          { value: 'gold', label: { zh: '暗金', en: 'Gold' } },
          { value: 'iron', label: { zh: '玄铁', en: 'Iron' } },
        ],
      },
    ],
    actions: overrides.actions ?? [
      {
        kind: 'link',
        id: 'open-page',
        label: { zh: '打开统计页', en: 'Open Stats Page' },
        href: 'plugins/kill-stats/index.html',
      },
      {
        kind: 'button',
        id: 'custom-btn',
        label: { zh: '执行动作', en: 'Run Action' },
        run() {
          overrides.onAction?.()
        },
      },
    ],
    activate:
      overrides.activate ??
      (() => ({
        deactivate() {},
      })),
  }
}

describe('PluginMenu (DOM Modal Overlay, Keyboard Isolation & Interactive Controls)', () => {
  let prevDocument: unknown
  let prevWindow: unknown
  let fakeDoc: FakeDocument
  let fakeWin: FakeWindow

  beforeEach(() => {
    prevDocument = (globalThis as { document?: unknown }).document
    prevWindow = (globalThis as { window?: unknown }).window
    fakeDoc = new FakeDocument()
    fakeWin = new FakeWindow()
    ;(globalThis as unknown as { document: unknown }).document = fakeDoc
    ;(globalThis as unknown as { window: unknown }).window = fakeWin
  })

  afterEach(() => {
    ;(globalThis as unknown as { document: unknown }).document = prevDocument
    ;(globalThis as unknown as { window: unknown }).window = prevWindow
    vi.restoreAllMocks()
  })

  it('mounts hidden [data-d2-modal-overlay="plugins"], toggles isModalDomOverlayOpen, intercepts Escape in capture phase, and returns focus to #d2-toolbar-plugins-btn', async () => {
    const toolbarBtn = fakeDoc.createElement('button')
    toolbarBtn.id = 'd2-toolbar-plugins-btn'
    fakeDoc.body.appendChild(toolbarBtn)

    const storage = new MemoryStorage()
    const plugin = makeMenuPlugin()
    const configStore = new PluginConfigStore([plugin], { storage })
    const buttonStates: { ready: boolean; hasWarning: boolean; open?: boolean | undefined }[] = []
    const toolbarPort: PluginHostToolbarPort = {
      setPluginsButtonState(state) {
        buttonStates.push(state)
      },
      addContribution() {
        return () => {}
      },
    }

    const host = new PluginHost({
      plugins: [plugin],
      configStore,
      session: new OnlineSession(),
      toolbar: toolbarPort,
      autoStart: false,
    })
    await host.start()

    const menu = new PluginMenu({ host, toolbar: toolbarPort })
    expect(menu.isOpen()).toBe(false)
    expect(isModalDomOverlayOpen(fakeDoc as unknown as Document)).toBe(false)

    // Register a bubble listener on window to verify capture-phase key interception when modal is open
    const leakedKeys: string[] = []
    fakeWin.addEventListener('keydown', (e) => leakedKeys.push(`down:${e.key}`), false)
    fakeWin.addEventListener('keyup', (e) => leakedKeys.push(`up:${e.key}`), false)

    // Open modal
    menu.open()
    expect(menu.isOpen()).toBe(true)
    expect(isModalDomOverlayOpen(fakeDoc as unknown as Document)).toBe(true)
    expect(fakeDoc.activeElement?.id).toBe('d2-plugin-menu-close')
    expect(buttonStates.at(-1)?.open).toBe(true)

    // Pressing a regular key while open is stopped in capture phase and never reaches bubble listeners
    const spaceEv = fakeWin.dispatchKey('keydown', ' ')
    const spaceUpEv = fakeWin.dispatchKey('keyup', ' ')
    expect(spaceEv.immediatePropagationStopped).toBe(true)
    expect(spaceUpEv.immediatePropagationStopped).toBe(true)
    expect(leakedKeys).toEqual([])

    // Pressing Escape closes the modal, prevents default, stops propagation, and restores focus to #d2-toolbar-plugins-btn
    const escEv = fakeWin.dispatchKey('keydown', 'Escape')
    expect(escEv.defaultPrevented).toBe(true)
    expect(escEv.immediatePropagationStopped).toBe(true)
    expect(menu.isOpen()).toBe(false)
    expect(isModalDomOverlayOpen(fakeDoc as unknown as Document)).toBe(false)
    expect(fakeDoc.activeElement).toBe(toolbarBtn)
    expect(buttonStates.at(-1)?.open).toBe(false)

    // When modal is closed, keys reach bubble listeners normally
    fakeWin.dispatchKey('keydown', 'i')
    expect(leakedKeys).toEqual(['down:i'])

    menu.destroy()
    await host.destroy()
  })

  it('renders plugin cards, boolean/select settings, link/button actions, and updates PluginHost on user interaction', async () => {
    let actionCount = 0
    const plugin = makeMenuPlugin({
      onAction: () => {
        actionCount++
      },
    })
    const storage = new MemoryStorage()
    const configStore = new PluginConfigStore([plugin], { storage })
    const host = new PluginHost({
      plugins: [plugin],
      configStore,
      session: new OnlineSession(),
      autoStart: false,
    })
    await host.start()

    const menu = new PluginMenu({ host })
    menu.open()

    // Verify link action renders with target="_blank" and relative href
    const linkEl = fakeDoc.querySelector('[data-plugin-action="kill-stats:open-page"]')
    expect(linkEl).not.toBeNull()
    expect(linkEl?.tagName).toBe('a')
    expect(linkEl?.href).toBe('plugins/kill-stats/index.html')
    expect(linkEl?.target).toBe('_blank')

    // Verify button action invokes host.runAction
    const actionBtn = fakeDoc.querySelector('[data-plugin-action="kill-stats:custom-btn"]')
    expect(actionBtn).not.toBeNull()
    actionBtn!.click()
    expect(actionCount).toBe(1)

    // Toggle boolean setting
    const boolCheckbox = fakeDoc.querySelector(
      '[data-plugin-setting="kill-stats:showToolbarShortcut"]',
    )
    expect(boolCheckbox).not.toBeNull()
    expect(boolCheckbox?.checked).toBe(true)
    boolCheckbox!.checked = false
    boolCheckbox!.dispatchEvent(makeFakeEvent('change'))
    expect(host.getSetting('kill-stats', 'showToolbarShortcut')).toBe(false)

    // Change select setting
    const selectEl = fakeDoc.querySelector('[data-plugin-setting="kill-stats:theme"]')
    expect(selectEl).not.toBeNull()
    expect(selectEl?.value).toBe('gold')
    selectEl!.value = 'iron'
    selectEl!.dispatchEvent(makeFakeEvent('change'))
    expect(host.getSetting('kill-stats', 'theme')).toBe('iron')

    // Disable plugin via toggle checkbox -> controls row is hidden when disabled
    const toggleCheckbox = fakeDoc.querySelector('[data-plugin-toggle="kill-stats"]')
    expect(toggleCheckbox).not.toBeNull()
    toggleCheckbox!.checked = false
    toggleCheckbox!.dispatchEvent(makeFakeEvent('change'))
    await Promise.resolve()
    await Promise.resolve()

    expect(host.isEnabled('kill-stats')).toBe(false)
    expect(
      fakeDoc.querySelector('[data-plugin-setting="kill-stats:showToolbarShortcut"]'),
    ).toBeNull()

    menu.destroy()
    await host.destroy()
  })

  it('renders a two-column layout with left plugin list (#d2-plugin-menu-nav) and switches the right detail pane (#d2-plugin-menu-list) when clicking a plugin on the left', async () => {
    const pluginA = makeMenuPlugin({
      id: 'plugin-alpha',
      name: { zh: '阿尔法插件', en: 'Alpha Plugin' },
      description: { zh: '阿尔法插件说明文本', en: 'Alpha description' },
    })
    const pluginB = makeMenuPlugin({
      id: 'plugin-beta',
      name: { zh: '贝塔插件', en: 'Beta Plugin' },
      description: { zh: '贝塔插件说明文本', en: 'Beta description' },
      settings: [
        {
          kind: 'boolean',
          key: 'betaFlag',
          label: { zh: '贝塔开关', en: 'Beta Flag' },
          default: true,
        },
      ],
      actions: [],
    })
    const storage = new MemoryStorage()
    const configStore = new PluginConfigStore([pluginA, pluginB], { storage })
    const host = new PluginHost({
      plugins: [pluginA, pluginB],
      configStore,
      session: new OnlineSession(),
      autoStart: false,
    })
    await host.start()

    const menu = new PluginMenu({ host })
    menu.open()

    const navContainer = fakeDoc.getElementById('d2-plugin-menu-nav')
    const detailContainer = fakeDoc.getElementById('d2-plugin-menu-list')
    expect(navContainer).not.toBeNull()
    expect(detailContainer).not.toBeNull()

    const navAlpha = fakeDoc.querySelector('[data-plugin-nav="plugin-alpha"]')
    const navBeta = fakeDoc.querySelector('[data-plugin-nav="plugin-beta"]')
    const cardAlpha = fakeDoc.querySelector('[data-plugin-id="plugin-alpha"]')
    const cardBeta = fakeDoc.querySelector('[data-plugin-id="plugin-beta"]')

    expect(navAlpha?.textContent).toContain('阿尔法插件')
    expect(navBeta?.textContent).toContain('贝塔插件')

    // Initially, first plugin (plugin-alpha) is selected on the left and shown on the right
    expect(menu.getSelectedPluginId()).toBe('plugin-alpha')
    expect(navAlpha?.getAttribute('aria-selected')).toBe('true')
    expect(navBeta?.getAttribute('aria-selected')).toBe('false')
    expect(cardAlpha?.hidden).toBe(false)
    expect(cardBeta?.hidden).toBe(true)

    // Click second plugin (plugin-beta) in the left column -> right column shows plugin-beta details & settings
    navBeta!.click()

    const navAlphaAfter = fakeDoc.querySelector('[data-plugin-nav="plugin-alpha"]')
    const navBetaAfter = fakeDoc.querySelector('[data-plugin-nav="plugin-beta"]')
    const cardAlphaAfter = fakeDoc.querySelector('[data-plugin-id="plugin-alpha"]')
    const cardBetaAfter = fakeDoc.querySelector('[data-plugin-id="plugin-beta"]')

    expect(menu.getSelectedPluginId()).toBe('plugin-beta')
    expect(navAlphaAfter?.getAttribute('aria-selected')).toBe('false')
    expect(navBetaAfter?.getAttribute('aria-selected')).toBe('true')
    expect(cardAlphaAfter?.hidden).toBe(true)
    expect(cardBetaAfter?.hidden).toBe(false)
    expect(cardBetaAfter?.textContent).toContain('贝塔插件说明文本')
    expect(cardBetaAfter?.textContent).toContain('插件说明')
    expect(cardBetaAfter?.textContent).toContain('配置项')

    // Changing a setting on plugin-beta preserves plugin-beta as the selected plugin
    const betaCheckbox = fakeDoc.querySelector('[data-plugin-setting="plugin-beta:betaFlag"]')
    expect(betaCheckbox).not.toBeNull()
    betaCheckbox!.checked = false
    betaCheckbox!.dispatchEvent(makeFakeEvent('change'))
    expect(host.getSetting('plugin-beta', 'betaFlag')).toBe(false)
    expect(menu.getSelectedPluginId()).toBe('plugin-beta')
    expect(fakeDoc.querySelector('[data-plugin-id="plugin-beta"]')?.hidden).toBe(false)
    expect(fakeDoc.querySelector('[data-plugin-id="plugin-alpha"]')?.hidden).toBe(true)

    menu.destroy()
    await host.destroy()
  })

  it('displays #d2-plugin-menu-alert on corrupt storage or plugin error and clears it when #d2-plugin-menu-reset is clicked', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const storage = new MemoryStorage()
    storage.data.set(PLUGIN_CONFIG_STORAGE_KEY, '{corrupt-json')

    let shouldFail = true
    const plugin = makeMenuPlugin({
      id: 'flaky-plugin',
      activate() {
        if (shouldFail) {
          throw new Error('Activation failed once')
        }
        return { deactivate() {} }
      },
    })

    const configStore = new PluginConfigStore([plugin], { storage })
    const host = new PluginHost({
      plugins: [plugin],
      configStore,
      session: new OnlineSession(),
      autoStart: false,
    })
    await host.start()

    const menu = new PluginMenu({ host })
    menu.open()

    const alertEl = fakeDoc.getElementById('d2-plugin-menu-alert')
    expect(alertEl).not.toBeNull()
    expect(alertEl?.hidden).toBe(false)
    expect(alertEl?.getAttribute('role')).toBe('alert')
    expect(alertEl?.textContent).toContain('Corrupt JSON')
    expect(alertEl?.textContent).toContain('Activation failed once')

    // Fix underlying error and click #d2-plugin-menu-reset
    shouldFail = false
    const resetBtn = fakeDoc.getElementById('d2-plugin-menu-reset')
    expect(resetBtn).not.toBeNull()
    resetBtn!.click()
    await Promise.resolve()
    await Promise.resolve()

    expect(host.hasErrorOrCorruption()).toBe(false)
    expect(alertEl?.hidden).toBe(true)

    menu.destroy()
    await host.destroy()
    errSpy.mockRestore()
  })
})
