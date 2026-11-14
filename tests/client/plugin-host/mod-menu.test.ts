import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { D2WebPlugin } from '../../../src/client/plugin-host/api.ts'
import { menuSections, plainCard } from '../../../src/client/plugin-host/mod-menu-text.ts'
import { ModMenu } from '../../../src/client/plugin-host/mod-menu.ts'
import { PLUGIN_MENU_LAYOUT } from '../../../plugins/index.ts'
import { PluginConfigStore } from '../../../src/client/plugin-host/plugin-config-store.ts'
import { PluginHost, type PluginHostToolbarPort } from '../../../src/client/plugin-host/plugin-host.ts'
import { buildPluginMenuViewModel } from '../../../src/client/plugin-host/plugin-menu-model.ts'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import { isModalDomOverlayOpen } from '../../../src/client/ui/dom-overlay.ts'

interface FakeEvent {
  readonly type: string
  readonly key?: string
  target: FakeNode | null
  defaultPrevented: boolean
  stopped: boolean
  preventDefault(): void
  stopImmediatePropagation(): void
  stopPropagation(): void
}

const event = (type: string, key?: string): FakeEvent => ({
  type,
  ...(key === undefined ? {} : { key }),
  target: null,
  defaultPrevented: false,
  stopped: false,
  preventDefault() {
    this.defaultPrevented = true
  },
  stopImmediatePropagation() {
    this.stopped = true
  },
  stopPropagation() {
    this.stopped = true
  },
})

type Listener = (e: FakeEvent) => void

class FakeNode {
  [prop: string]: unknown
  className = ''
  id = ''
  hidden = false
  scrollTop = 0
  parentNode: FakeNode | null = null
  children: FakeNode[] = []
  private ownText = ''
  private readonly attrs = new Map<string, string>()
  private readonly listeners = new Map<string, Listener[]>()

  constructor(
    readonly tagName: string,
    readonly ownerDocument: FakeDocument,
  ) {}

  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join('')
  }

  set textContent(text: string) {
    this.children = []
    this.ownText = text
  }

  set innerHTML(html: string) {
    this.children = []
    this.ownText = html
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value)
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null
  }

  appendChild(child: FakeNode): FakeNode {
    child.parentNode = this
    this.children.push(child)
    return child
  }

  removeChild(child: FakeNode): FakeNode {
    this.children = this.children.filter((c) => c !== child)
    return child
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  dispatch(e: FakeEvent): FakeEvent {
    e.target ??= this
    for (const listener of this.listeners.get(e.type) ?? []) listener(e)
    if (!e.stopped) this.parentNode?.dispatch(e)
    return e
  }

  click(): void {
    this.dispatch(event('click'))
  }

  focus(): void {
    this.ownerDocument.activeElement = this
  }

  scrollIntoView(): void {
    this.ownerDocument.scrolledTo = this
  }

  all(): FakeNode[] {
    return this.children.flatMap((child) => [child, ...child.all()])
  }

  matches(selector: string): boolean {
    if (selector === '[data-d2-modal-overlay]:not([hidden])') return this.attrs.has('data-d2-modal-overlay') && !this.hidden
    if (selector.startsWith('.')) return this.className.split(' ').includes(selector.slice(1))
    if (selector.startsWith('#')) return this.id === selector.slice(1)
    const attr = /^\[([\w-]+)="([^"]*)"\]$/.exec(selector)
    return attr !== null && this.attrs.get(attr[1]!) === attr[2]
  }

  querySelector(selector: string): FakeNode | null {
    return this.all().find((node) => node.matches(selector)) ?? null
  }

  querySelectorAll(selector: string): FakeNode[] {
    return this.all().filter((node) => node.matches(selector))
  }
}

class FakeDocument {
  readonly head = new FakeNode('head', this)
  readonly body = new FakeNode('body', this)
  activeElement: FakeNode | null = null
  scrolledTo: FakeNode | null = null

  createElement(tag: string): FakeNode {
    return new FakeNode(tag, this)
  }

  getElementById(id: string): FakeNode | null {
    return this.body.querySelector(`#${id}`)
  }

  querySelector(selector: string): FakeNode | null {
    return this.body.querySelector(selector)
  }
}

class FakeWindow {
  private readonly listeners: { type: string; listener: Listener; capture: boolean }[] = []

  addEventListener(type: string, listener: Listener, capture = false): void {
    this.listeners.push({ type, listener, capture })
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.splice(this.listeners.findIndex((l) => l.type === type && l.listener === listener), 1)
  }

  key(type: 'keydown' | 'keyup', key: string): FakeEvent {
    const e = event(type, key)
    for (const capture of [true, false]) {
      for (const l of this.listeners.filter((l) => l.type === type && l.capture === capture)) {
        if (!e.stopped) l.listener(e)
      }
    }
    return e
  }
}

const memoryStorage = () => {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), removeItem: (key: string) => void data.delete(key) }
}

const plugin = (id: string, en: string, extra: Partial<D2WebPlugin> = {}): D2WebPlugin => ({
  id,
  name: { zh: en, en },
  description: { zh: `${en} 说明`, en: `${en} does things` },
  defaultEnabled: true,
  activate: () => ({ deactivate() {} }),
  ...extra,
})

const PLUGINS = [
  plugin('auto-combat', 'Auto-Fight', { defaultEnabled: false }),
  plugin('item-info', 'Item Info', { settings: [{ kind: 'boolean', key: 'itemLevel', label: { zh: '物品等级', en: 'Item level' }, default: true }] }),
  plugin('ground-item-beam', 'Ground Item Display Enhancements'),
  plugin('path-guide', 'Path Guide'),
  plugin('someone-elses', 'Mystery'),
]

describe('mod menu', () => {
  let saved: { document: unknown; window: unknown }
  let doc: FakeDocument
  let win: FakeWindow

  beforeEach(() => {
    const g = globalThis as unknown as { document: unknown; window: unknown }
    saved = { document: g.document, window: g.window }
    doc = new FakeDocument()
    win = new FakeWindow()
    Object.assign(globalThis, { document: doc, window: win })
  })

  afterEach(() => {
    Object.assign(globalThis, saved)
  })

  const start = async () => {
    const states: boolean[] = []
    const toolbar: PluginHostToolbarPort = {
      setPluginsButtonState: (state) => void states.push(Boolean(state.open)),
      addContribution: () => () => {},
    }
    const configStore = new PluginConfigStore(PLUGINS, { storage: memoryStorage() })
    const host = new PluginHost({ plugins: PLUGINS, configStore, session: new OnlineSession(), toolbar, autoStart: false })
    await host.start()
    return { host, states, menu: new ModMenu({ host, toolbar, layout: PLUGIN_MENU_LAYOUT }) }
  }

  it('groups plugins into sections with plain names and sorts each section', async () => {
    const { host } = await start()
    const cards = buildPluginMenuViewModel(host, 'en').cards.map((card) => plainCard(card, 'en', PLUGIN_MENU_LAYOUT))
    expect(menuSections(cards, 'en', '', PLUGIN_MENU_LAYOUT).map((section) => [section.title, section.cards.map((card) => card.name)])).toEqual([
      ['Combat', ['Auto-Fight']],
      ['Loot', ['Item Info', 'Loot Beams']],
      ['Map & Guide', ['Path Guide']],
      ['Other', ['Mystery']],
    ])
    expect(menuSections(cards, 'en', 'BEAM', PLUGIN_MENU_LAYOUT).flatMap((section) => section.cards.map((card) => card.id))).toEqual(['ground-item-beam'])
    expect(menuSections(cards, 'en', 'loot', PLUGIN_MENU_LAYOUT).flatMap((section) => section.cards.map((card) => card.id))).toEqual(['item-info', 'ground-item-beam'])
  })

  it('opens as a modal, keeps keys away from the game, and closes on Escape', async () => {
    const { menu, states } = await start()
    const leaked: string[] = []
    win.addEventListener('keydown', (e) => leaked.push(e.key ?? ''))
    menu.open()
    expect(isModalDomOverlayOpen(doc as unknown as Document)).toBe(true)
    expect(doc.activeElement?.id).toBe('d2-plugin-menu-search')
    expect(win.key('keydown', 'i').stopped).toBe(true)
    expect(leaked).toEqual([])
    menu.setQuery('item')
    win.key('keydown', 'Escape')
    expect([menu.isOpen(), (doc.getElementById('d2-plugin-menu-search')?.value as string | undefined) ?? '']).toEqual([true, ''])
    win.key('keydown', 'Escape')
    expect(menu.isOpen()).toBe(false)
    expect(states.at(-1)).toBe(false)
    win.key('keydown', 'i')
    expect(leaked).toEqual(['i'])
  })

  it('keeps its controls in place while only plugin statuses change, so an open dropdown stays open', async () => {
    const { host, menu } = await start()
    menu.open()
    await host.setEnabled('ground-item-beam', true)
    menu.selectPlugin('ground-item-beam')
    const panel = doc.querySelector('[data-plugin-id="ground-item-beam"]')
    menu.render()
    menu.render()
    expect(doc.querySelector('[data-plugin-id="ground-item-beam"]')).toBe(panel)
    menu.setQuery('beam')
    expect(doc.querySelector('[data-plugin-id="ground-item-beam"]')).not.toBe(panel)
  })

  it('switches a plugin on from its list row without selecting it', async () => {
    const { menu, host } = await start()
    menu.open()
    menu.selectPlugin('path-guide')
    expect(doc.scrolledTo?.getAttribute('data-plugin-nav')).toBe('path-guide')
    const row = () => doc.querySelector('[data-plugin-nav="auto-combat"]')!
    const toggle = row().querySelector('[data-plugin-toggle="auto-combat"]')!
    toggle.checked = true
    toggle.click()
    toggle.dispatch(event('change'))
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(host.list().find((snap) => snap.plugin.id === 'auto-combat')?.enabled).toBe(true)
    expect(menu.getSelectedPluginId()).toBe('path-guide')
    row().click()
    expect(row().className).toContain('is-selected')
  })

  it('filters the list and says so when nothing matches', async () => {
    const { menu } = await start()
    menu.open()
    menu.setQuery('path')
    expect(doc.body.querySelectorAll('.d2-mods__row').map((row) => row.getAttribute('data-plugin-nav'))).toEqual(['path-guide'])
    expect(menu.getSelectedPluginId()).toBe('path-guide')
    expect(doc.querySelector('[data-plugin-id="path-guide"]')).not.toBeNull()
    menu.setQuery('zzz')
    expect(doc.body.querySelectorAll('.d2-mods__row')).toEqual([])
    expect(doc.querySelector('.d2-mods__detail')?.textContent).toBe('没有找到“zzz”')
  })

  it('stops wheel events at the overlay so the game never sees them', async () => {
    const { menu } = await start()
    menu.open()
    const bubbled: string[] = []
    doc.body.addEventListener('wheel', (e) => bubbled.push(e.type))
    doc.querySelector('.d2-mods__list')!.dispatch(event('wheel'))
    expect(bubbled).toEqual([])
    menu.destroy()
    expect(doc.querySelector('#d2-plugin-menu-overlay')).toBeNull()
  })
})
