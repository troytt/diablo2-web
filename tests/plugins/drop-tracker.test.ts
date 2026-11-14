import { describe, expect, it } from 'vitest'
import {
  DropTracker,
  IndexedDbDropStatsRepository,
  MemoryDropStatsRepository,
  buildDropGrailCatalog,
  classifyDropItem,
  computeDropItemBreakdown,
  createDropTrackerPlugin,
  dropTrackerPlugin,
  isGroundDropEvent,
  isRuneCode,
  resolveDropItemNames,
  type DropTrackerPluginInstance,
} from '../../plugins/drop-tracker/index.ts'
import { mountDropTrackerPage } from '../../plugins/drop-tracker/standalone.ts'
import type { PluginSessionView } from '../../src/client/plugin-host/api.ts'
import { PluginConfigStore } from '../../src/client/plugin-host/plugin-config-store.ts'
import { PluginHost } from '../../src/client/plugin-host/plugin-host.ts'
import { SettingsStore } from '../../src/client/settings/settings-store.ts'
import { Toolbar } from '../../src/client/toolbar/toolbar.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'

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

class FakeElement {
  readonly tagName: string
  readonly ownerDocument: FakeDocument
  readonly children: FakeElement[] = []
  readonly style: Record<string, string> = {}
  parentNode: FakeElement | null = null
  id = ''
  className = ''
  type = ''
  value = ''
  placeholder = ''
  href = ''
  target = ''
  rel = ''
  title = ''
  htmlFor = ''
  disabled = false
  hidden = false
  private text = ''
  private readonly attrs = new Map<string, string>()
  private readonly listeners = new Map<string, Array<(ev: { type: string }) => void>>()

  constructor(tagName: string, ownerDocument: FakeDocument) {
    this.tagName = tagName.toUpperCase()
    this.ownerDocument = ownerDocument
  }

  get options(): FakeElement[] {
    return this.children
  }

  set innerHTML(val: string) {
    if (val === '') {
      for (const c of this.children) c.parentNode = null
      this.children.length = 0
      this.text = ''
    }
  }

  get textContent(): string {
    if (this.children.length === 0) return this.text
    return this.text + this.children.map((c) => c.textContent).join('')
  }

  set textContent(val: string | null) {
    for (const c of this.children) c.parentNode = null
    this.children.length = 0
    this.text = val ?? ''
  }

  setAttribute(name: string, val: string): void {
    if (name === 'id') this.id = val
    if (name === 'class') this.className = val
    this.attrs.set(name, val)
  }

  getAttribute(name: string): string | null {
    if (name === 'id' && this.id) return this.id
    if (name === 'class' && this.className) return this.className
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
    if (this.parentNode) {
      this.parentNode.removeChild(this)
    }
  }

  addEventListener(type: string, cb: (ev: { type: string }) => void): void {
    const list = this.listeners.get(type) ?? []
    list.push(cb)
    this.listeners.set(type, list)
  }

  dispatchEvent(ev: { type: string }): void {
    for (const cb of [...(this.listeners.get(ev.type) ?? [])]) {
      cb(ev)
    }
  }

  click(): void {
    this.dispatchEvent({ type: 'click' })
  }

  private matchesSelector(selector: string): boolean {
    if (selector.startsWith('#')) {
      return this.id === selector.slice(1)
    }
    if (selector.startsWith('.')) {
      const cls = selector.slice(1)
      return this.className.split(/\s+/).includes(cls)
    }
    const attrMatch = /^\[([a-zA-Z0-9_-]+)="([^"]*)"\]$/.exec(selector)
    if (attrMatch) {
      return this.getAttribute(attrMatch[1]!) === attrMatch[2]
    }
    return this.tagName.toLowerCase() === selector.toLowerCase()
  }

  querySelector<T = FakeElement>(selector: string): T | null {
    for (const child of this.children) {
      if (child.matchesSelector(selector)) return child as unknown as T
      const found = child.querySelector<T>(selector)
      if (found) return found
    }
    return null
  }
}

class FakeDocument {
  readonly documentElement: FakeElement
  readonly head: FakeElement
  readonly body: FakeElement

  constructor() {
    this.documentElement = new FakeElement('html', this)
    this.documentElement.setAttribute('lang', 'zh-CN')
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
}

function withFakeDom<T>(fn: (doc: FakeDocument, container: FakeElement) => Promise<T> | T): Promise<T> {
  const prevDoc = (globalThis as { document?: unknown }).document
  const fakeDoc = new FakeDocument()
  const container = fakeDoc.createElement('div')
  fakeDoc.body.appendChild(container)
  ;(globalThis as { document?: unknown }).document = fakeDoc
  return Promise.resolve()
    .then(() => fn(fakeDoc, container))
    .finally(() => {
      ;(globalThis as { document?: unknown }).document = prevDoc
    })
}

describe('Item Drop Tracker Plugin (plugins/drop-tracker)', () => {
  it('recognizes all 33 canonical rune codes (r01..r33) and rejects non-rune codes', () => {
    for (let i = 1; i <= 33; i++) {
      const code = `r${String(i).padStart(2, '0')}`
      expect(isRuneCode(code)).toBe(true)
      expect(classifyDropItem({ code, quality: 2 })).toBe('rune')
    }
    for (const invalid of ['r00', 'r34', 'r99', 'rin', 'rvb', 'gld', 'hp1', '']) {
      expect(isRuneCode(invalid)).toBe(false)
      expect(classifyDropItem({ code: invalid, quality: 2 })).toBeNull()
    }
  })

  it('classifies Set (quality=5), Unique (quality=7), and Runes while ignoring Normal/Magic/Rare non-runes and non-ground containers', () => {
    expect(classifyDropItem({ code: 'uth', quality: 5 })).toBe('set')
    expect(classifyDropItem({ code: 'uap', quality: 7 })).toBe('unique')
    expect(classifyDropItem({ code: 'r30', quality: 2 })).toBe('rune')
    expect(classifyDropItem({ code: 'cap', quality: 2 })).toBeNull()
    expect(classifyDropItem({ code: 'cap', quality: 4 })).toBeNull()
    expect(classifyDropItem({ code: 'cap', quality: 6 })).toBeNull()

    expect(
      isGroundDropEvent({
        type: 'ItemEvent',
        action: 0x00,
        container: 'ground',
        item: { id: 1, code: 'uap', quality: 7 },
      }),
    ).toBe(true)
    expect(
      isGroundDropEvent({
        type: 'ItemAction',
        action: 0x02,
        item: { id: 2, code: 'uth', quality: 5, container: 'ground' },
      }),
    ).toBe(true)
    expect(
      isGroundDropEvent({
        type: 'ItemAction',
        action: 0x03,
        item: { id: 3, code: 'r31', quality: 2, destination: 3 },
      }),
    ).toBe(true)
    expect(
      isGroundDropEvent({
        type: 'ItemAction',
        action: 0x04,
        item: { id: 4, code: 'uap', quality: 7, container: 'inventory' },
      }),
    ).toBe(false)
  })

  it('deduplicates repeated ground events by item.id within a session and resets on game session change', async () => {
    const repository = new MemoryDropStatsRepository()
    const tracker = new DropTracker({
      repository,
      now: () => 1700000000000,
    })

    const berDrop = {
      type: 'ItemAction',
      action: 0x00,
      areaId: 85,
      item: {
        id: 5001,
        code: 'r30',
        quality: 2,
        container: 'ground',
      },
    }

    expect(tracker.handleEventPayload(berDrop)?.category).toBe('rune')
    // Duplicate packet for same ground item ID in same session -> ignored
    expect(tracker.handleEventPayload(berDrop)).toBeNull()
    await tracker.flushNow()
    expect(tracker.getSummary().runeCount).toBe(1)
    expect(tracker.getSummary().totalTracked).toBe(1)

    // Session transition (GameFlags) resets seenItemIds
    tracker.handleServerEvent({
      type: 'GameFlags',
      difficulty: 2,
      hardcore: false,
      expansion: true,
      ladder: true,
    })
    expect(tracker.handleEventPayload(berDrop)?.category).toBe('rune')
    await tracker.flushNow()
    expect(tracker.getSummary().runeCount).toBe(2)
    expect(tracker.getSummary().totalTracked).toBe(2)

    tracker.destroy()
  })

  it('persists drops across IndexedDbDropStatsRepository instances via storage mirror and supports clearAll + exportJson', async () => {
    const storage = new MemoryStorage()
    const repo1 = new IndexedDbDropStatsRepository({ storage })
    const tracker1 = new DropTracker({
      repository: repo1,
      now: () => 1700000010000,
    })

    tracker1.handleEventPayload({
      type: 'ItemAction',
      action: 0x00,
      areaId: 108,
      item: { id: 101, code: 'uap', quality: 7, container: 'ground' },
    })
    tracker1.handleEventPayload({
      type: 'ItemAction',
      action: 0x02,
      areaId: 108,
      item: { id: 102, code: 'lrg', quality: 5, setItemId: 0, container: 'ground' },
    })
    tracker1.handleEventPayload({
      type: 'ItemAction',
      action: 0x03,
      areaId: 108,
      item: { id: 103, code: 'r31', quality: 2, container: 'ground' },
    })
    await tracker1.flushNow()
    tracker1.destroy()

    // Reload into a second repository & tracker backed by the same storage
    const repo2 = new IndexedDbDropStatsRepository({ storage })
    const tracker2 = new DropTracker({ repository: repo2 })
    const summary = await tracker2.init()

    expect(summary.uniqueCount).toBe(1)
    expect(summary.setCount).toBe(1)
    expect(summary.runeCount).toBe(1)
    expect(summary.totalTracked).toBe(3)

    const breakdown = computeDropItemBreakdown(summary.records)
    expect(breakdown).toHaveLength(3)

    const exported = JSON.parse(tracker2.exportJson()) as {
      totalTracked: number
      records: unknown[]
    }
    expect(exported.totalTracked).toBe(3)
    expect(exported.records).toHaveLength(3)

    const cleared = await tracker2.clearAll()
    expect(cleared.totalTracked).toBe(0)
    expect((await repo2.loadAll()).length).toBe(0)
    tracker2.destroy()
  })

  it('mounts toolbar shortcut in #d2-toolbar-plugin-slot, updates live counts, and cleans up on deactivate', async () => {
    await withFakeDom(async (_doc, container) => {
      const storage = new MemoryStorage()
      const settingsStore = new SettingsStore({
        storage,
        defaultLang: 'zh',
        syncGlobalLang: false,
      })
      const toolbar = new Toolbar({
        container: container as unknown as HTMLElement,
        store: settingsStore,
      })
      const world = new ClientWorld()
      const eventListeners = new Set<(ev: ServerEvent) => void>()

      const session: PluginSessionView = {
        phase: 'ingame',
        world,
        loginHost: '127.0.0.1',
        getSnapshot: () =>
          ({
            phase: 'ingame',
            username: 'tester',
            selectedChar: 'Hero',
            selectedRealm: null,
            realms: [],
            characters: [],
          }) as unknown as ReturnType<PluginSessionView['getSnapshot']>,
        onServerEvent(cb) {
          eventListeners.add(cb)
          return () => eventListeners.delete(cb)
        },
        onStateChange() {
          return () => {}
        },
      }

      const plugin = createDropTrackerPlugin({
        repository: new MemoryDropStatsRepository(),
      })
      const configStore = new PluginConfigStore([plugin], { storage })
      const host = new PluginHost({
        plugins: [plugin],
        session,
        toolbar,
        settingsStore,
        configStore,
        autoStart: true,
      })
      await host.whenStarted()

      const slot = container.querySelector('#d2-toolbar-plugin-slot')!
      const linkEl = slot.querySelector('#d2-toolbar-plugin-drop-tracker-open')
      expect(linkEl).not.toBeNull()
      expect(linkEl?.textContent).toBe('掉落 绿0 · 金0 · 符0')

      world.areaId = 108

      // 1. Rune drop -> live toolbar counter updates to 符1
      for (const cb of eventListeners) {
        cb({
          type: 'ItemEvent',
          action: 0x00,
          container: 'ground',
          item: {
            id: 777,
            code: 'r33',
            name: 'Zod Rune',
            quality: 2,
            identified: true,
          } as unknown as Extract<ServerEvent, { type: 'ItemEvent' }>['item'],
        })
      }
      expect(linkEl?.textContent).toBe('掉落 绿0 · 金0 · 符1')
      expect(linkEl?.getAttribute('data-rune-count')).toBe('1')

      // 2. Set item drop -> live toolbar counter updates to 绿1 · 金0 · 符1
      for (const cb of eventListeners) {
        cb({
          type: 'ItemEvent',
          action: 0x02,
          container: 'ground',
          item: {
            id: 778,
            code: 'rin',
            name: "Cathan's Seal",
            quality: 5,
            identified: false,
          } as unknown as Extract<ServerEvent, { type: 'ItemEvent' }>['item'],
        })
      }
      expect(linkEl?.textContent).toBe('掉落 绿1 · 金0 · 符1')
      expect(linkEl?.getAttribute('data-set-count')).toBe('1')

      // 3. Unique item drop -> live toolbar counter updates to 绿1 · 金1 · 符1
      for (const cb of eventListeners) {
        cb({
          type: 'ItemEvent',
          action: 0x03,
          container: 'ground',
          item: {
            id: 779,
            code: 'uap',
            name: 'Harlequin Crest',
            quality: 7,
            identified: false,
          } as unknown as Extract<ServerEvent, { type: 'ItemEvent' }>['item'],
        })
      }
      expect(linkEl?.textContent).toBe('掉落 绿1 · 金1 · 符1')
      expect(linkEl?.getAttribute('data-unique-count')).toBe('1')
      expect(linkEl?.getAttribute('data-total-count')).toBe('3')

      // 4. Subsequent Toolbar.syncDom() triggers (setRttMs, setConnectionState, setLang) must preserve live counts
      toolbar.setRttMs(42)
      expect(linkEl?.textContent).toBe('掉落 绿1 · 金1 · 符1')

      toolbar.setConnectionState({ phase: 'd2gs', rttMs: 36 })
      expect(linkEl?.textContent).toBe('掉落 绿1 · 金1 · 符1')

      toolbar.setLang('en')
      expect(linkEl?.textContent).toBe('Drops S:1 · U:1 · R:1')
      toolbar.setRttMs(28)
      expect(linkEl?.textContent).toBe('Drops S:1 · U:1 · R:1')

      toolbar.setLang('zh')
      expect(linkEl?.textContent).toBe('掉落 绿1 · 金1 · 符1')

      const instance = host.getInstance<DropTrackerPluginInstance>('drop-tracker')
      expect(instance?.getSummary()).toEqual({
        setCount: 1,
        uniqueCount: 1,
        runeCount: 1,
        totalTracked: 3,
      })
      expect(instance?.getRecords()[0]?.areaId).toBe(108)

      await host.setEnabled('drop-tracker', false)
      expect(slot.querySelector('#d2-toolbar-plugin-drop-tracker-open')).toBeNull()

      await host.destroy()
      toolbar.destroy()
    })
  })

  it('hydrates persisted drop counts on activate() via tracker.init() and displays non-zero initial badge in toolbar', async () => {
    await withFakeDom(async (_doc, container) => {
      const storage = new MemoryStorage()
      const preRepo = new IndexedDbDropStatsRepository({ storage, hydrateSync: true })
      await preRepo.append({
        timestamp: 1700000001000,
        itemId: 901,
        code: 'rin',
        name: "Cathan's Seal",
        nameZh: '卡珊的印记',
        category: 'set',
        areaId: 102,
        areaNameZh: '憎恨的囚牢第三层',
      })
      await preRepo.append({
        timestamp: 1700000002000,
        itemId: 902,
        code: 'r30',
        name: 'Ber Rune',
        nameZh: '贝(30)',
        category: 'rune',
        areaId: 102,
        areaNameZh: '憎恨的囚牢第三层',
      })

      const settingsStore = new SettingsStore({
        storage,
        defaultLang: 'zh',
        syncGlobalLang: false,
      })
      const toolbar = new Toolbar({
        container: container as unknown as HTMLElement,
        store: settingsStore,
      })
      const session: PluginSessionView = {
        phase: 'ingame',
        world: new ClientWorld(),
        loginHost: '127.0.0.1',
        getSnapshot: () =>
          ({
            phase: 'ingame',
            username: 'tester',
            selectedChar: 'Hero',
            selectedRealm: null,
            realms: [],
            characters: [],
          }) as unknown as ReturnType<PluginSessionView['getSnapshot']>,
        onServerEvent: () => () => {},
        onStateChange: () => () => {},
      }

      const plugin = createDropTrackerPlugin({
        repository: new IndexedDbDropStatsRepository({ storage }),
      })
      const host = new PluginHost({
        plugins: [plugin],
        session,
        toolbar,
        settingsStore,
        configStore: new PluginConfigStore([plugin], { storage }),
        autoStart: true,
      })
      await host.whenStarted()
      await new Promise((r) => setTimeout(r, 10))

      const linkEl = container.querySelector('#d2-toolbar-plugin-drop-tracker-open')
      expect(linkEl?.textContent).toBe('掉落 绿1 · 金0 · 符1')
      toolbar.setRttMs(55)
      expect(linkEl?.textContent).toBe('掉落 绿1 · 金0 · 符1')

      await host.destroy()
      toolbar.destroy()
    })
  })

  it('builds canonical 1.13c Holy Grail catalog with 32 sets (127 pieces), 372 uniques sorted by base type & tier (normal -> exceptional -> elite), and 33 runes (#01..#33) with valid sprite rects', () => {
    const catalog = buildDropGrailCatalog([
      {
        id: 1,
        timestamp: 1700000000000,
        itemId: 901,
        code: 'uth',
        name: "Tal Rasha's Guardianship",
        nameZh: '塔拉夏的守护',
        category: 'set',
        areaId: 85,
        areaNameZh: '古代通道',
        setItemId: 85,
      },
      {
        id: 2,
        timestamp: 1700000005000,
        itemId: 902,
        code: 'uap',
        name: 'Harlequin Crest',
        nameZh: '谐角之冠',
        category: 'unique',
        areaId: 108,
        areaNameZh: '混沌避难所',
        uniqueItemId: 245,
      },
      {
        id: 3,
        timestamp: 1700000010000,
        itemId: 903,
        code: 'r30',
        name: 'Ber Rune',
        nameZh: '贝 (30号)',
        category: 'rune',
        areaId: 108,
        areaNameZh: '混沌避难所',
      },
    ])

    // 1. Sets: 32 canonical sets, 127 total pieces, 1 lit piece
    expect(catalog.totalSets).toBe(32)
    expect(catalog.totalSetPieces).toBe(127)
    expect(catalog.litSetPieces).toBe(1)
    expect(catalog.completedSets).toBe(0)
    const talSet = catalog.sets.find((s) => s.index === "Tal Rasha's Wrappings")
    expect(talSet).toBeDefined()
    expect(talSet?.totalPieces).toBe(5)
    expect(talSet?.litPieces).toBe(1)
    const talArmor = talSet?.pieces.find((p) => p.code === 'uth')
    expect(talArmor?.lit).toBe(true)
    expect(talArmor?.count).toBe(1)
    expect(talArmor?.spriteRect.w).toBeGreaterThan(0)
    expect(talArmor?.spriteRect.h).toBeGreaterThan(0)

    // Verify every single Set piece has a valid sprite rect
    for (const s of catalog.sets) {
      for (const p of s.pieces) {
        expect(p.spriteRect.w).toBeGreaterThan(0)
        expect(p.spriteRect.h).toBeGreaterThan(0)
      }
    }

    // 2. Uniques: 372 canonical spawnable uniques grouped by base type & sorted by tier (Normal -> Exceptional -> Elite)
    expect(catalog.totalUniqueItems).toBe(372)
    expect(catalog.litUniqueItems).toBe(1)
    const helmGroup = catalog.uniqueGroups.find((g) => g.baseType === 'helm')
    expect(helmGroup).toBeDefined()
    expect(helmGroup?.litItems).toBe(1)
    const shako = helmGroup?.items.find((u) => u.code === 'uap')
    expect(shako?.lit).toBe(true)
    expect(shako?.tier).toBe('elite')
    expect(shako?.tierLabelZh).toBe('精英')

    // Verify within each equipment group, items are sorted by tierRank (0=普通 <= 1=扩展 <= 2=精英) and have valid sprite rects
    for (const g of catalog.uniqueGroups) {
      let prevTierRank = -1
      for (const item of g.items) {
        expect(item.tierRank).toBeGreaterThanOrEqual(prevTierRank)
        prevTierRank = item.tierRank
        expect(item.spriteRect.w).toBeGreaterThan(0)
        expect(item.spriteRect.h).toBeGreaterThan(0)
      }
    }

    // 3. Runes: 33 canonical runes sorted 1..33
    expect(catalog.totalRunes).toBe(33)
    expect(catalog.litRunes).toBe(1)
    expect(catalog.runes.map((r) => r.runeNumber)).toEqual(
      Array.from({ length: 33 }, (_, idx) => idx + 1),
    )
    const berRune = catalog.runes.find((r) => r.code === 'r30')
    expect(berRune?.lit).toBe(true)
    expect(berRune?.count).toBe(1)
    for (const r of catalog.runes) {
      expect(r.spriteRect.w).toBe(28)
      expect(r.spriteRect.h).toBe(28)
    }
  })

  it('renders standalone Drop Tracker dashboard (mountDropTrackerPage) in Light-Up Mode with in-game sprites, category/status filters, search, and intact drop log', async () => {
    await withFakeDom(async (_doc, container) => {
      const names = resolveDropItemNames({ code: 'r33', quality: 2 })
      const repository = new MemoryDropStatsRepository([
        {
          id: 1,
          timestamp: 1700000000000,
          itemId: 301,
          code: 'r33',
          name: names.name,
          nameZh: names.nameZh,
          category: 'rune',
          areaId: 85,
          areaNameZh: '古代通道',
          areaNameEn: 'Ancient Tunnels',
        },
        {
          id: 2,
          timestamp: 1700000005000,
          itemId: 302,
          code: 'uap',
          name: 'Harlequin Crest',
          nameZh: '谐角之冠',
          category: 'unique',
          areaId: 108,
          areaNameZh: '混沌避难所',
          areaNameEn: 'Chaos Sanctuary',
        },
        {
          id: 3,
          timestamp: 1700000008000,
          itemId: 303,
          code: 'uth',
          name: "Tal Rasha's Guardianship",
          nameZh: '塔拉夏的守护',
          category: 'set',
          areaId: 108,
          areaNameZh: '混沌避难所',
          areaNameEn: 'Chaos Sanctuary',
          setItemId: 85,
        },
      ])

      const page = mountDropTrackerPage(container as unknown as HTMLElement, { repository })
      expect(container.querySelector('#d2-drops-total-count')?.textContent).toBe('3')
      expect(container.querySelector('#d2-drops-set-count')?.textContent).toBe('1')
      expect(container.querySelector('#d2-drops-rune-count')?.textContent).toBe('1')
      expect(container.querySelector('#d2-drops-unique-count')?.textContent).toBe('1')

      // Verify all 3 Light-Up sections are rendered with in-game sprites from /ui/items-atlas.png
      const setsSec = container.querySelector('#d2-drops-sets-section')
      const uniquesSec = container.querySelector('#d2-drops-uniques-section')
      const runesSec = container.querySelector('#d2-drops-runes-section')
      expect(setsSec).not.toBeNull()
      expect(uniquesSec).not.toBeNull()
      expect(runesSec).not.toBeNull()

      const talCard = setsSec?.querySelector('[data-set-index="Tal Rasha\'s Wrappings"]')
      expect(talCard?.getAttribute('data-set-lit')).toBe('1')
      expect(talCard?.getAttribute('data-set-total')).toBe('5')
      const talArmorTile = talCard?.querySelector('[data-item-code="uth"]')
      expect(talArmorTile?.getAttribute('data-lit')).toBe('true')
      const spriteEl = talArmorTile?.querySelector('.d2-drops__item-sprite')
      expect(spriteEl?.style.backgroundImage).toContain('/ui/items-atlas.png')

      const helmGroup = uniquesSec?.querySelector('[data-base-type="helm"]')
      expect(helmGroup).not.toBeNull()
      expect(helmGroup?.querySelector('[data-tier="normal"]')).not.toBeNull()
      expect(helmGroup?.querySelector('[data-tier="exceptional"]')).not.toBeNull()
      expect(helmGroup?.querySelector('[data-tier="elite"]')).not.toBeNull()
      const shakoTile = helmGroup?.querySelector('[data-item-code="uap"]')
      expect(shakoTile?.getAttribute('data-lit')).toBe('true')

      const zodTile = runesSec?.querySelector('[data-rune-number="33"]')
      expect(zodTile?.getAttribute('data-lit')).toBe('true')
      const elTile = runesSec?.querySelector('[data-rune-number="1"]')
      expect(elTile?.getAttribute('data-lit')).toBe('false')

      // Filter by 'rune'
      const runeBtn = container.querySelector('[data-filter="rune"]')!
      runeBtn.click()
      expect(container.querySelector('#d2-drops-sets-section')).toBeNull()
      expect(container.querySelector('#d2-drops-uniques-section')).toBeNull()
      expect(container.querySelector('#d2-drops-runes-section')).not.toBeNull()
      expect(container.querySelector('#d2-drops-history-table')?.textContent).toContain('r33')
      expect(container.querySelector('#d2-drops-history-table')?.textContent).not.toContain('uap')

      // Filter by Lit Only ('lit')
      const litBtn = container.querySelector('[data-grail-status="lit"]')!
      litBtn.click()
      expect(container.querySelector('[data-rune-number="33"]')).not.toBeNull()
      expect(container.querySelector('[data-rune-number="1"]')).toBeNull()

      // Search input preserves the exact DOM node across keystrokes while updating filtered results
      const allBtn = container.querySelector('[data-filter="all"]')!
      allBtn.click()
      const searchInput = container.querySelector('#d2-drops-search')!
      searchInput.value = 'uap'
      searchInput.dispatchEvent({ type: 'input' })
      expect(container.querySelector('#d2-drops-search')).toBe(searchInput)
      expect(container.querySelector('#d2-drops-history-table')?.textContent).toContain('uap')
      expect(container.querySelector('#d2-drops-history-table')?.textContent).not.toContain('r33')
      searchInput.value = ''
      searchInput.dispatchEvent({ type: 'input' })
      expect(container.querySelector('#d2-drops-search')).toBe(searchInput)

      // Clear all drops
      const clearBtn = container.querySelector('#d2-drops-clear-btn')!
      clearBtn.click()
      await new Promise((r) => setTimeout(r, 10))
      expect(container.querySelector('#d2-drops-total-count')?.textContent).toBe('0')

      page.destroy()
      expect(dropTrackerPlugin.id).toBe('drop-tracker')
    })
  })

  it('synchronizes standalone Drop Tracker UI language with main controller d2web.settings.v1 (zh <-> en) without overwriting stored setting on /plugins/drop-tracker/index.html', async () => {
    await withFakeDom(async (doc, container) => {
      const prevWin = (globalThis as { window?: unknown }).window
      const storage = new MemoryStorage()
      storage.setItem('d2web.settings.v1', JSON.stringify({ version: 1, lang: 'en' }))
      const storageListeners: Array<(ev: { key: string | null }) => void> = []

      ;(globalThis as { window?: unknown }).window = {
        location: {
          pathname: '/plugins/drop-tracker/index.html',
          search: '',
          protocol: 'http:',
        },
        localStorage: storage,
        addEventListener(type: string, cb: (ev: { key: string | null }) => void) {
          if (type === 'storage') storageListeners.push(cb)
        },
        removeEventListener() {},
      }

      try {
        const repository = new MemoryDropStatsRepository([
          {
            id: 1,
            timestamp: 1700000005000,
            itemId: 302,
            code: 'uap',
            name: 'Harlequin Crest',
            nameZh: '谐角之冠',
            category: 'unique',
            areaId: 108,
            areaNameZh: '混沌避难所',
            areaNameEn: 'Chaos Sanctuary',
          },
        ])

        const page = mountDropTrackerPage(container as unknown as HTMLElement, { repository })

        // Initial render follows main controller's stored 'en' setting with 100% pure English (zero CJK characters)
        expect(page.getLang()).toBe('en')
        expect(doc.documentElement.getAttribute('lang')).toBe('en')
        expect(container.querySelector('#d2-drops-page-title')?.textContent).toBe('Drop Tracker')
        expect(container.querySelector('[data-filter="all"]')?.textContent).toContain('All Grail')
        expect(container.querySelector('#d2-drops-total-grail')?.textContent).toContain('Grail Lit')
        expect(container.querySelector('#d2-drops-history-table')?.textContent).toContain('Chaos Sanctuary')
        expect(/[\u4e00-\u9fff]/.test(container.textContent ?? '')).toBe(false)

        // Simulate main controller switching language to 'zh' via localStorage storage event
        storage.setItem('d2web.settings.v1', JSON.stringify({ version: 1, lang: 'zh' }))
        for (const fn of storageListeners) {
          fn({ key: 'd2web.settings.v1' })
        }

        expect(page.getLang()).toBe('zh')
        expect(doc.documentElement.getAttribute('lang')).toBe('zh-CN')
        expect(container.querySelector('#d2-drops-page-title')?.textContent).toBe('掉落统计')
        expect(container.querySelector('[data-filter="all"]')?.textContent).toContain('全部图鉴')
        expect(container.querySelector('#d2-drops-total-grail')?.textContent).toContain('圣杯点亮')
        expect(container.querySelector('#d2-drops-history-table')?.textContent).toContain('混沌避难所')

        // Clicking #d2-drops-lang-toggle on the standalone page toggles back to 'en' and updates d2web.settings.v1
        container.querySelector('#d2-drops-lang-toggle')!.click()
        expect(page.getLang()).toBe('en')
        expect(JSON.parse(storage.getItem('d2web.settings.v1')!).lang).toBe('en')
        expect(/[\u4e00-\u9fff]/.test(container.textContent ?? '')).toBe(false)

        page.destroy()
      } finally {
        ;(globalThis as { window?: unknown }).window = prevWin
      }
    })
  })
})
