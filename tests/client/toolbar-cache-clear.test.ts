import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  listSavedBugReports,
  persistBugReportToDisk,
} from '../../src/baker/io/bug-report-store.ts'
import { SettingsStore } from '../../src/client/settings/settings-store.ts'
import {
  TOOLBAR_BUG_ICON_SVG,
  TOOLBAR_CACHE_CLEAR_ICON_SVG,
  TOOLBAR_CONFIG_ICON_SVG,
  TOOLBAR_DROP_TRACKER_ICON_SVG,
  TOOLBAR_FULLSCREEN_ENTER_ICON_SVG,
  TOOLBAR_FULLSCREEN_EXIT_ICON_SVG,
  TOOLBAR_KILL_STATS_ICON_SVG,
  TOOLBAR_LANG_ICON_SVG,
  TOOLBAR_PLUGINS_ICON_SVG,
  TOOLBAR_VOLUME_MUTE_ICON_SVG,
  TOOLBAR_VOLUME_ON_ICON_SVG,
  Toolbar,
} from '../../src/client/toolbar/toolbar.ts'

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
  readonly children: FakeElement[] = []
  readonly style: Record<string, string> = {}
  parentNode: FakeElement | null = null
  id = ''
  className = ''
  type = ''
  value = ''
  title = ''
  htmlFor = ''
  disabled = false
  hidden = false
  rawHtml = ''
  private text = ''
  private readonly attrs = new Map<string, string>()
  private readonly listeners = new Map<string, Array<(ev: { type: string; target?: unknown }) => void>>()

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase()
  }

  get options(): FakeElement[] {
    return this.children
  }

  get innerHTML(): string {
    return this.rawHtml
  }

  set innerHTML(val: string) {
    this.rawHtml = val
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

  addEventListener(type: string, cb: (ev: { type: string; target?: unknown }) => void): void {
    const list = this.listeners.get(type) ?? []
    list.push(cb)
    this.listeners.set(type, list)
  }

  dispatchEvent(ev: { type: string; target?: unknown }): void {
    for (const cb of [...(this.listeners.get(ev.type) ?? [])]) {
      cb({ ...ev, target: ev.target ?? this })
    }
  }

  click(): void {
    this.dispatchEvent({ type: 'click', target: this })
  }

  private matchesSelector(selector: string): boolean {
    if (selector.startsWith('#')) {
      return this.id === selector.slice(1)
    }
    if (selector.startsWith('.')) {
      const cls = selector.slice(1)
      return this.className.split(/\s+/).includes(cls)
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

describe('Top Toolbar Layout, Right Icon Buttons, Config Modal & Bug Report Persistence', () => {
  it('places #d2-toolbar-plugins-btn and #d2-toolbar-plugin-slot on the far left and status + 3 icon buttons (#d2-toolbar-lang-btn, #d2-toolbar-config-btn, #d2-toolbar-bug-btn) on the far right', () => {
    const prevDoc = (globalThis as { document?: unknown }).document
    const head = new FakeElement('head')
    const body = new FakeElement('body')
    const container = new FakeElement('div')
    body.appendChild(container)
    ;(globalThis as { document?: unknown }).document = {
      head,
      body,
      createElement(tag: string) {
        return new FakeElement(tag)
      },
      getElementById(id: string) {
        return body.querySelector(`#${id}`) ?? head.querySelector(`#${id}`)
      },
    }

    try {
      const store = new SettingsStore({
        storage: new MemoryStorage(),
        defaultLang: 'zh',
        syncGlobalLang: false,
      })
      const toolbar = new Toolbar({
        container: container as unknown as HTMLElement,
        store,
      })
      const root = container.querySelector('#d2-toolbar')!
      expect(root).not.toBeNull()

      const children = Array.from(root.children)
      const pluginsBtn = root.querySelector('#d2-toolbar-plugins-btn')!
      const pluginSlot = root.querySelector('#d2-toolbar-plugin-slot')!
      const rightContainer = root.querySelector('#d2-toolbar-right')!
      const configOverlay = root.querySelector('#d2-config-modal-overlay')!
      const bugOverlay = root.querySelector('#d2-bug-modal-overlay')!
      const diagBanner = root.querySelector('#d2-toolbar-diag-banner')!

      expect(pluginsBtn).not.toBeNull()
      expect(pluginSlot).not.toBeNull()
      expect(rightContainer).not.toBeNull()
      expect(configOverlay).not.toBeNull()
      expect(bugOverlay).not.toBeNull()
      expect(diagBanner).not.toBeNull()
      expect(configOverlay.hidden).toBe(true)
      expect(bugOverlay.hidden).toBe(true)
      expect(diagBanner.hidden).toBe(true)

      // Far-left order: pluginsBtn (0), pluginSlot (1), rightContainer (2), modals (3, 4), diagBanner (5)
      expect(children.indexOf(pluginsBtn)).toBe(0)
      expect(children.indexOf(pluginSlot)).toBe(1)
      expect(children.indexOf(rightContainer)).toBe(2)
      expect(children.indexOf(configOverlay)).toBe(3)
      expect(children.indexOf(bugOverlay)).toBe(4)
      expect(children.indexOf(diagBanner)).toBe(5)

      // Right container has status badge, divider, and 3 icon buttons in order: lang, config, bug
      const statusBadge = rightContainer.querySelector('#d2-toolbar-status')!
      const divider = rightContainer.querySelector('.d2-toolbar__divider')!
      const actionsGroup = rightContainer.querySelector('#d2-toolbar-actions')!
      expect(statusBadge).not.toBeNull()
      expect(divider).not.toBeNull()
      expect(actionsGroup).not.toBeNull()

      const langBtn = actionsGroup.querySelector('#d2-toolbar-lang-btn')!
      const configBtn = actionsGroup.querySelector('#d2-toolbar-config-btn')!
      const bugBtn = actionsGroup.querySelector('#d2-toolbar-bug-btn')!
      expect(actionsGroup.children.indexOf(langBtn)).toBe(0)
      expect(actionsGroup.children.indexOf(configBtn)).toBe(1)
      expect(actionsGroup.children.indexOf(bugBtn)).toBe(2)

      expect(langBtn.querySelector('.d2-toolbar__btn-icon')!.innerHTML).toBe(TOOLBAR_LANG_ICON_SVG)
      expect(langBtn.querySelector('#d2-toolbar-lang-badge')!.textContent).toBe('中')
      expect(configBtn.querySelector('.d2-toolbar__btn-icon')!.innerHTML).toBe(
        TOOLBAR_CONFIG_ICON_SVG,
      )
      expect(bugBtn.querySelector('.d2-toolbar__btn-icon')!.innerHTML).toBe(TOOLBAR_BUG_ICON_SVG)

      const pluginsIcon = pluginsBtn.querySelector('.d2-toolbar__btn-icon')!
      const pluginsLabel = pluginsBtn.querySelector('.d2-toolbar__btn-label')!
      expect(pluginsIcon).not.toBeNull()
      expect(pluginsIcon.getAttribute('aria-hidden')).toBe('true')
      expect(pluginsIcon.innerHTML).toBe(TOOLBAR_PLUGINS_ICON_SVG)
      expect(pluginsLabel).not.toBeNull()
      expect(pluginsLabel.textContent).toBe('插件')
      expect(pluginsBtn.textContent).toBe('插件')

      // Clicking #d2-toolbar-lang-btn toggles zh <-> en and preserves icons
      langBtn.click()
      expect(store.get().lang).toBe('en')
      expect(langBtn.querySelector('#d2-toolbar-lang-badge')!.textContent).toBe('EN')
      expect(pluginsBtn.querySelector('.d2-toolbar__btn-icon')).toBe(pluginsIcon)
      expect(pluginsIcon.innerHTML).toBe(TOOLBAR_PLUGINS_ICON_SVG)
      expect(pluginsBtn.textContent).toBe('Plugins')

      toolbar.setPluginsButtonState({ ready: true, hasWarning: true, open: false })
      expect(pluginsBtn.querySelector('.d2-toolbar__btn-icon')).toBe(pluginsIcon)
      expect(pluginsBtn.textContent).toBe('Plugins ⚠')

      langBtn.click()
      expect(store.get().lang).toBe('zh')
      expect(langBtn.querySelector('#d2-toolbar-lang-badge')!.textContent).toBe('中')
      toolbar.setPluginsButtonState({ ready: true, hasWarning: false, open: false })
      expect(pluginsBtn.textContent).toBe('插件')

      toolbar.setDiagBanner('Lag: 42ms')
      expect(diagBanner.hidden).toBe(false)
      expect(diagBanner.textContent).toBe('Lag: 42ms')
      toolbar.setDiagBanner(null)
      expect(diagBanner.hidden).toBe(true)

      toolbar.destroy()
    } finally {
      ;(globalThis as { document?: unknown }).document = prevDoc
    }
  })

  it('aligns play.html static #d2-toolbar markup and toolbar.css layout with runtime Toolbar structure', () => {
    const playHtml = readFileSync(resolve(process.cwd(), 'play.html'), 'utf8')
    const toolbarCss = readFileSync(
      resolve(process.cwd(), 'src/client/toolbar/toolbar.css'),
      'utf8',
    )

    expect(toolbarCss).toContain('justify-content: flex-start')
    expect(toolbarCss).toContain('.d2-toolbar__right')
    expect(toolbarCss).toContain('margin-left: auto')
    expect(toolbarCss).toContain('.d2-toolbar__divider')
    expect(toolbarCss).toContain('.d2-toolbar__btn-icon')
    expect(toolbarCss).toContain('.d2-toolbar-modal-overlay')

    const pluginsBtnPos = playHtml.indexOf('id="d2-toolbar-plugins-btn"')
    const pluginSlotPos = playHtml.indexOf('id="d2-toolbar-plugin-slot"')
    const rightPos = playHtml.indexOf('id="d2-toolbar-right"')
    const statusPos = playHtml.indexOf('id="d2-toolbar-status"')
    const dividerPos = playHtml.indexOf('class="d2-toolbar__divider"')
    const langBtnPos = playHtml.indexOf('id="d2-toolbar-lang-btn"')
    const configBtnPos = playHtml.indexOf('id="d2-toolbar-config-btn"')
    const bugBtnPos = playHtml.indexOf('id="d2-toolbar-bug-btn"')

    expect(pluginsBtnPos).toBeGreaterThan(0)
    expect(pluginSlotPos).toBeGreaterThan(pluginsBtnPos)
    expect(rightPos).toBeGreaterThan(pluginSlotPos)
    expect(statusPos).toBeGreaterThan(rightPos)
    expect(dividerPos).toBeGreaterThan(statusPos)
    expect(langBtnPos).toBeGreaterThan(dividerPos)
    expect(configBtnPos).toBeGreaterThan(langBtnPos)
    expect(bugBtnPos).toBeGreaterThan(configBtnPos)

    expect(playHtml).toContain(TOOLBAR_PLUGINS_ICON_SVG)
    expect(playHtml).toContain(TOOLBAR_LANG_ICON_SVG)
    expect(playHtml).toContain(TOOLBAR_CONFIG_ICON_SVG)
    expect(playHtml).toContain(TOOLBAR_BUG_ICON_SVG)
    expect(playHtml).toContain(TOOLBAR_CACHE_CLEAR_ICON_SVG)
    expect(playHtml).toContain(TOOLBAR_VOLUME_ON_ICON_SVG)
    expect(playHtml).toContain('data-d2-modal-overlay="config"')
    expect(playHtml).toContain('data-d2-modal-overlay="bug-report"')
    expect(toolbarCss).toContain('.d2-toolbar__drop-set')
    expect(toolbarCss).toContain('.d2-toolbar__drop-unique')
    expect(toolbarCss).toContain('.d2-toolbar__drop-rune')
  })

  it('opens config modal (#d2-config-modal-overlay) to configure fullscreen, resolution, FPS, master volume/mute, and cache clear, plus renders plugin contribution icons (#1020)', () => {
    const prevDoc = (globalThis as { document?: unknown }).document
    const head = new FakeElement('head')
    const body = new FakeElement('body')
    const container = new FakeElement('div')
    body.appendChild(container)
    ;(globalThis as { document?: unknown }).document = {
      head,
      body,
      createElement(tag: string) {
        return new FakeElement(tag)
      },
      getElementById(id: string) {
        return body.querySelector(`#${id}`) ?? head.querySelector(`#${id}`)
      },
    }

    try {
      const store = new SettingsStore({
        storage: new MemoryStorage(),
        defaultLang: 'zh',
        syncGlobalLang: false,
      })
      const toolbar = new Toolbar({
        container: container as unknown as HTMLElement,
        store,
      })
      const root = container.querySelector('#d2-toolbar')!
      const configBtn = root.querySelector('#d2-toolbar-config-btn')!
      const configOverlay = root.querySelector('#d2-config-modal-overlay')!
      expect(configOverlay.hidden).toBe(true)

      configBtn.click()
      expect(configOverlay.hidden).toBe(false)
      expect(toolbar.isConfigModalOpen()).toBe(true)
      expect(configBtn.getAttribute('aria-expanded')).toBe('true')

      // Volume & Mute inside Config modal
      const muteBtn = configOverlay.querySelector('#d2-toolbar-mute-btn')!
      const volumeSlider = configOverlay.querySelector('#d2-toolbar-volume-slider')!
      const volumeValue = configOverlay.querySelector('#d2-toolbar-volume-value')!
      expect(volumeSlider.value).toBe('80')
      expect(volumeValue.textContent).toBe('80%')
      expect(muteBtn.querySelector('.d2-toolbar__btn-icon')!.innerHTML).toBe(
        TOOLBAR_VOLUME_ON_ICON_SVG,
      )
      expect(muteBtn.textContent).toBe('静音')

      volumeSlider.value = '45'
      volumeSlider.dispatchEvent({ type: 'input' })
      expect(store.get().masterVolume).toBe(0.45)
      expect(volumeValue.textContent).toBe('45%')

      muteBtn.click()
      expect(store.get().audioMuted).toBe(true)
      expect(volumeValue.textContent).toBe('0%')
      expect(muteBtn.querySelector('.d2-toolbar__btn-icon')!.innerHTML).toBe(
        TOOLBAR_VOLUME_MUTE_ICON_SVG,
      )
      expect(muteBtn.textContent).toBe('已静音')

      // Dragging slider above 0 while muted automatically unmutes
      volumeSlider.value = '65'
      volumeSlider.dispatchEvent({ type: 'change' })
      expect(store.get().masterVolume).toBe(0.65)
      expect(store.get().audioMuted).toBe(false)
      expect(volumeValue.textContent).toBe('65%')

      const cacheClearBtn = configOverlay.querySelector('#d2-toolbar-cache-clear-btn')!
      expect(cacheClearBtn.querySelector('.d2-toolbar__btn-icon')!.innerHTML).toBe(
        TOOLBAR_CACHE_CLEAR_ICON_SVG,
      )
      expect(cacheClearBtn.textContent).toBe('清除缓存')

      toolbar.addContribution({
        domId: 'd2-toolbar-plugin-kill-stats-open',
        kind: 'link',
        label: { zh: '击杀统计', en: 'Kill Stats' },
        iconSvg: TOOLBAR_KILL_STATS_ICON_SVG,
        href: '/stats/kill-stats.html',
      })
      const dropHandle = toolbar.addContribution({
        domId: 'd2-toolbar-plugin-drop-tracker-open',
        kind: 'link',
        label: { zh: '掉落 绿12 · 金3 · 符1', en: 'Drops S:12 · U:3 · R:1' },
        iconSvg: TOOLBAR_DROP_TRACKER_ICON_SVG,
        href: '/stats/drop-tracker.html',
      })

      const slot = root.querySelector('#d2-toolbar-plugin-slot')!
      expect(slot.children.length).toBe(2)
      const killLink = slot.children[0]!
      const dropLink = slot.children[1]!

      expect(killLink.querySelector('.d2-toolbar__btn-icon')!.innerHTML).toBe(
        TOOLBAR_KILL_STATS_ICON_SVG,
      )
      expect(killLink.textContent).toBe('击杀统计')

      expect(dropLink.querySelector('.d2-toolbar__btn-icon')!.innerHTML).toBe(
        TOOLBAR_DROP_TRACKER_ICON_SVG,
      )
      expect(dropLink.textContent).toBe('掉落 绿12 · 金3 · 符1')
      expect(dropLink.querySelector('.d2-toolbar__drop-set')!.textContent).toBe('绿12')
      expect(dropLink.querySelector('.d2-toolbar__drop-unique')!.textContent).toBe('金3')
      expect(dropLink.querySelector('.d2-toolbar__drop-rune')!.textContent).toBe('符1')

      // English drop summary format also parses into colored quality spans
      toolbar.setLanguage('en')
      dropHandle.update?.({
        label: { zh: '掉落 绿4 · 金2 · 符0', en: 'Drops S:4 · U:2 · R:0' },
      })
      expect(dropLink.textContent).toBe('Drops S:4 · U:2 · R:0')
      expect(dropLink.querySelector('.d2-toolbar__drop-set')!.textContent).toBe('S:4')
      expect(dropLink.querySelector('.d2-toolbar__drop-unique')!.textContent).toBe('U:2')
      expect(dropLink.querySelector('.d2-toolbar__drop-rune')!.textContent).toBe('R:0')

      toolbar.destroy()
    } finally {
      ;(globalThis as { document?: unknown }).document = prevDoc
    }
  })

  it('displays and allows modifying battle.net server address in config modal (#d2-toolbar-server-input)', () => {
    const prevDoc = (globalThis as { document?: unknown }).document
    const head = new FakeElement('head')
    const body = new FakeElement('body')
    const container = new FakeElement('div')
    body.appendChild(container)
    ;(globalThis as { document?: unknown }).document = {
      head,
      body,
      createElement(tag: string) {
        return new FakeElement(tag)
      },
      getElementById(id: string) {
        return body.querySelector(`#${id}`) ?? head.querySelector(`#${id}`)
      },
    }

    try {
      const store = new SettingsStore({
        storage: new MemoryStorage(),
        defaultLang: 'zh',
        syncGlobalLang: false,
      })
      const reconnectedHosts: string[] = []
      const toolbar = new Toolbar({
        container: container as unknown as HTMLElement,
        store,
        callbacks: {
          onServerHostReconnect: (newHost) => {
            reconnectedHosts.push(newHost)
          },
        },
      })

      const root = container.querySelector('#d2-toolbar')!
      const configBtn = root.querySelector('#d2-toolbar-config-btn')!
      const configOverlay = root.querySelector('#d2-config-modal-overlay')!
      configBtn.click()

      const serverInput = configOverlay.querySelector('#d2-toolbar-server-input')!
      const serverLabel = configOverlay.querySelector('#d2-config-server-label')!
      const serverApplyBtn = configOverlay.querySelector('#d2-toolbar-server-apply-btn')!
      const serverStatus = configOverlay.querySelector('#d2-toolbar-server-status')!

      expect(serverInput).not.toBeNull()
      expect(serverLabel).not.toBeNull()
      expect(serverApplyBtn).not.toBeNull()
      expect(serverStatus).not.toBeNull()
      expect(serverInput.value).toBe('www.laiseek.xyz')
      expect(serverLabel.textContent).toBe('战网服务器')
      expect(serverApplyBtn.textContent).toBe('连接')
      expect(serverStatus.hidden).toBe(true)

      // Test validation: bare IP on https page is rejected
      serverInput.value = '192.168.1.1'
      serverApplyBtn.click()
      expect(store.get().serverHost).toBe('www.laiseek.xyz')
      expect(serverStatus.hidden).toBe(false)
      expect(serverStatus.textContent).toContain('HTTPS')

      // Typing in input clears error
      serverInput.value = 'd2.laiseek.xyz'
      serverInput.dispatchEvent({ type: 'input' })
      expect(serverStatus.hidden).toBe(true)

      // Submitting valid domain applies and reconnects
      serverApplyBtn.click()
      expect(store.get().serverHost).toBe('d2.laiseek.xyz')
      expect(reconnectedHosts).toEqual(['d2.laiseek.xyz'])
      expect(serverStatus.hidden).toBe(true)

      // Pressing enter key in input submits
      serverInput.value = 'laiseek.xyz'
      serverInput.dispatchEvent({
        type: 'keydown',
        key: 'Enter',
        preventDefault: () => {},
      } as unknown as { type: string })
      expect(store.get().serverHost).toBe('laiseek.xyz')
      expect(reconnectedHosts).toEqual(['d2.laiseek.xyz', 'laiseek.xyz'])

      // Switching language updates label
      toolbar.setLanguage('en')
      expect(serverLabel.textContent).toBe('Battle.net Server')
      expect(serverApplyBtn.textContent).toBe('Apply')

      toolbar.destroy()
    } finally {
      ;(globalThis as { document?: unknown }).document = prevDoc
    }
  })

  it('opens bug report modal (#d2-bug-modal-overlay), validates required fields, and persists submitted bug reports to server files', async () => {
    const prevDoc = (globalThis as { document?: unknown }).document
    const head = new FakeElement('head')
    const body = new FakeElement('body')
    const container = new FakeElement('div')
    body.appendChild(container)
    ;(globalThis as { document?: unknown }).document = {
      head,
      body,
      createElement(tag: string) {
        return new FakeElement(tag)
      },
      getElementById(id: string) {
        return body.querySelector(`#${id}`) ?? head.querySelector(`#${id}`)
      },
    }

    const tmpBugsDir = mkdtempSync(join(tmpdir(), 'd2-bugs-test-'))
    try {
      const store = new SettingsStore({
        storage: new MemoryStorage(),
        defaultLang: 'zh',
        syncGlobalLang: false,
      })
      const toolbar = new Toolbar({
        container: container as unknown as HTMLElement,
        store,
        submitBugReportFn: async (submission) =>
          persistBugReportToDisk(submission, { bugsDir: tmpBugsDir }),
        callbacks: {
          getBugReportContext: () => ({
            inGameView: true,
            areaId: 1,
            selectedChar: 'TestSorc',
          }),
        },
      })

      const root = container.querySelector('#d2-toolbar')!
      const configBtn = root.querySelector('#d2-toolbar-config-btn')!
      const bugBtn = root.querySelector('#d2-toolbar-bug-btn')!
      const configOverlay = root.querySelector('#d2-config-modal-overlay')!
      const bugOverlay = root.querySelector('#d2-bug-modal-overlay')!

      // Opening config then clicking bugBtn closes config modal and opens bug modal
      configBtn.click()
      expect(configOverlay.hidden).toBe(false)
      bugBtn.click()
      expect(configOverlay.hidden).toBe(true)
      expect(bugOverlay.hidden).toBe(false)

      const titleInput = bugOverlay.querySelector('#d2-bug-title-input')!
      const categorySelect = bugOverlay.querySelector('#d2-bug-category-select')!
      const descInput = bugOverlay.querySelector('#d2-bug-desc-input')!
      const submitBtn = bugOverlay.querySelector('#d2-bug-submit-btn')!
      const statusMsg = bugOverlay.querySelector('#d2-bug-status-msg')!

      // Empty submit -> error notice
      submitBtn.click()
      await Promise.resolve()
      expect(statusMsg.hidden).toBe(false)
      expect(statusMsg.className).toContain('d2-toolbar-modal__status--error')
      expect(statusMsg.textContent).toContain('请填写问题标题与详细描述')

      // Valid submit -> saved to disk (bugs/bug-reports.jsonl and bugs/<id>.json)
      titleInput.value = '冰封球在罗格营地边缘音效异常'
      categorySelect.value = 'audio'
      descInput.value = '1. 进入罗格营地\n2. 切换音量后释放技能\n3. 观察音效'
      const res = await toolbar.submitBugReport()
      expect(res.ok).toBe(true)
      expect(res.id).toMatch(/^bug-\d{8}-\d{6}-[0-9a-f]{6}$/)
      expect(titleInput.value).toBe('')
      expect(descInput.value).toBe('')
      expect(statusMsg.hidden).toBe(false)
      expect(statusMsg.className).toContain('d2-toolbar-modal__status--ok')
      expect(statusMsg.textContent).toContain(`#${res.id}`)

      const savedList = listSavedBugReports({ bugsDir: tmpBugsDir })
      expect(savedList).toHaveLength(1)
      expect(savedList[0]!.id).toBe(res.id)
      expect(savedList[0]!.title).toBe('冰封球在罗格营地边缘音效异常')
      expect(savedList[0]!.category).toBe('audio')
      expect(savedList[0]!.gameContext).toEqual({
        inGameView: true,
        areaId: 1,
        selectedChar: 'TestSorc',
      })
      expect(existsSync(join(tmpBugsDir, `${res.id}.json`))).toBe(true)

      toolbar.destroy()
    } finally {
      rmSync(tmpBugsDir, { recursive: true, force: true })
      ;(globalThis as { document?: unknown }).document = prevDoc
    }
  })
})

// NOT 1.13c: toolbar fullscreen toggle (inside Config modal).
describe('Toolbar fullscreen toggle button', () => {
  function mountWithDocument(docExtras: Record<string, unknown>): {
    toolbar: Toolbar
    root: FakeElement
    restore: () => void
  } {
    const prevDoc = (globalThis as { document?: unknown }).document
    const head = new FakeElement('head')
    const body = new FakeElement('body')
    const container = new FakeElement('div')
    body.appendChild(container)
    const fakeDoc = {
      head,
      body,
      createElement(tag: string) {
        return new FakeElement(tag)
      },
      getElementById(id: string) {
        return body.querySelector(`#${id}`) ?? head.querySelector(`#${id}`)
      },
    }
    // Copy descriptors (not values) so the `fullscreenElement` getter stays live.
    Object.defineProperties(fakeDoc, Object.getOwnPropertyDescriptors(docExtras))
    ;(globalThis as { document?: unknown }).document = fakeDoc
    const store = new SettingsStore({
      storage: new MemoryStorage(),
      defaultLang: 'zh',
      syncGlobalLang: false,
    })
    const toolbar = new Toolbar({ container: container as unknown as HTMLElement, store })
    return {
      toolbar,
      root: container.querySelector('#d2-toolbar')!,
      restore: () => {
        toolbar.destroy()
        ;(globalThis as { document?: unknown }).document = prevDoc
      },
    }
  }

  function makeFullscreenDoc(opts: { reject?: Error } = {}) {
    const listeners = new Map<string, Set<() => void>>()
    const fire = (type: string): void => {
      for (const fn of listeners.get(type) ?? []) fn()
    }
    const state = { fullscreenElement: null as unknown }
    const documentElement = {
      requestFullscreen: vi.fn(async () => {
        if (opts.reject) throw opts.reject
        state.fullscreenElement = documentElement
        fire('fullscreenchange')
      }),
    }
    const extras = {
      documentElement,
      get fullscreenElement() {
        return state.fullscreenElement
      },
      exitFullscreen: vi.fn(async () => {
        state.fullscreenElement = null
        fire('fullscreenchange')
      }),
      addEventListener(type: string, fn: () => void) {
        const set = listeners.get(type) ?? new Set()
        set.add(fn)
        listeners.set(type, set)
      },
      removeEventListener(type: string, fn: () => void) {
        listeners.get(type)?.delete(fn)
      },
    }
    return { extras, state, documentElement, listeners, fire }
  }

  const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

  it('sits inside the config modal display row', () => {
    const fs = makeFullscreenDoc()
    const { root, restore } = mountWithDocument(fs.extras)
    try {
      const configModal = root.querySelector('#d2-config-modal')!
      const btn = configModal.querySelector('#d2-toolbar-fullscreen-btn')!
      expect(btn).not.toBeNull()
      expect(btn.className).toBe('d2-toolbar__btn')
      expect(btn.disabled).toBe(false)
      expect(btn.textContent).toBe('全屏')
      expect(btn.querySelector('.d2-toolbar__btn-icon')!.innerHTML).toBe(
        TOOLBAR_FULLSCREEN_ENTER_ICON_SVG,
      )
      expect(btn.getAttribute('aria-pressed')).toBe('false')
    } finally {
      restore()
    }
  })

  it('toggles fullscreen and follows browser-driven exits (Esc)', async () => {
    const fs = makeFullscreenDoc()
    const { toolbar, root, restore } = mountWithDocument(fs.extras)
    try {
      const btn = root.querySelector('#d2-toolbar-fullscreen-btn')!
      btn.click()
      expect(fs.documentElement.requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' })
      await flush()
      expect(btn.textContent).toBe('退出全屏')
      expect(btn.getAttribute('aria-pressed')).toBe('true')
      expect(btn.className).toContain('d2-toolbar__btn--active')
      expect(btn.querySelector('.d2-toolbar__btn-icon')!.innerHTML).toBe(
        TOOLBAR_FULLSCREEN_EXIT_ICON_SVG,
      )

      toolbar.setLanguage('en')
      expect(btn.textContent).toBe('Exit Fullscreen')

      // Esc handled by the browser: fullscreenElement cleared + fullscreenchange.
      fs.state.fullscreenElement = null
      fs.fire('fullscreenchange')
      expect(btn.textContent).toBe('Fullscreen')
      expect(btn.getAttribute('aria-pressed')).toBe('false')

      // Button exit path.
      btn.click()
      await flush()
      expect(btn.getAttribute('aria-pressed')).toBe('true')
      btn.click()
      expect(fs.extras.exitFullscreen).toHaveBeenCalledTimes(1)
      await flush()
      expect(btn.getAttribute('aria-pressed')).toBe('false')
    } finally {
      restore()
    }
    expect(fs.listeners.get('fullscreenchange')?.size).toBe(0)
  })

  it('reports a rejected request instead of swallowing it', async () => {
    const fs = makeFullscreenDoc({ reject: new Error('Permissions check failed') })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { root, restore } = mountWithDocument(fs.extras)
    try {
      root.querySelector('#d2-toolbar-fullscreen-btn')!.click()
      await flush()
      expect(errSpy).toHaveBeenCalledWith(
        '[toolbar]',
        '全屏失败 (enter): Permissions check failed',
      )
    } finally {
      restore()
      errSpy.mockRestore()
    }
  })

  it('is disabled when the document has no Fullscreen API', () => {
    const { root, restore } = mountWithDocument({})
    try {
      const btn = root.querySelector('#d2-toolbar-fullscreen-btn')!
      expect(btn.disabled).toBe(true)
      btn.click()
    } finally {
      restore()
    }
  })
})
