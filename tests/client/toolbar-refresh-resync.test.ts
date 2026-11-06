import { describe, expect, it, vi } from 'vitest'
import {
  encodeC2sRequestEntityUpdate,
  encodeD2gsClientCommand,
  type ClientCommand,
} from '../../src/netproto/index.ts'
import { SettingsStore } from '../../src/client/settings/settings-store.ts'
import { TOOLBAR_REFRESH_ICON_SVG, Toolbar } from '../../src/client/toolbar/toolbar.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'

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
  private readonly listeners = new Map<
    string,
    Array<(ev: { type: string; target?: unknown }) => void>
  >()

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

describe('Toolbar Refresh Display & Server Position Resync (#d2-toolbar-refresh-btn)', () => {
  it('encodes C2S 0x4B RequestEntityUpdate as 9 bytes [0x4B, unitType u32 LE, unitId u32 LE]', () => {
    const pkt = encodeC2sRequestEntityUpdate(0, 0x12345678)
    expect(pkt).toBeInstanceOf(Uint8Array)
    expect(pkt.byteLength).toBe(9)
    expect(Array.from(pkt)).toEqual([0x4b, 0x00, 0x00, 0x00, 0x00, 0x78, 0x56, 0x34, 0x12])

    const viaRegistry = encodeD2gsClientCommand({
      type: 'RequestEntityUpdate',
      unitType: 1,
      unitId: 42,
    })
    expect(viaRegistry.map(p => Array.from(p))).toEqual([
      [0x4b, 0x01, 0x00, 0x00, 0x00, 42, 0x00, 0x00, 0x00],
    ])
  })

  it('renders #d2-toolbar-refresh-btn on the right side of the toolbar, updates localized title, closes modals, and triggers onRefreshDisplay', () => {
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
      const onRefreshDisplay = vi.fn()
      const toolbar = new Toolbar({
        container: container as unknown as HTMLElement,
        store,
        callbacks: {
          onRefreshDisplay,
        },
      })

      const root = container.querySelector('#d2-toolbar')!
      const refreshBtn = root.querySelector('#d2-toolbar-refresh-btn')!
      const configBtn = root.querySelector('#d2-toolbar-config-btn')!
      const configOverlay = root.querySelector('#d2-config-modal-overlay')!

      expect(refreshBtn).not.toBeNull()
      expect(refreshBtn.getAttribute('data-d2-toolbar-action')).toBe('refresh')
      expect(refreshBtn.title).toBe('刷新前端显示与同步位置')
      expect(refreshBtn.getAttribute('aria-label')).toBe('刷新前端显示与同步位置')
      expect(refreshBtn.querySelector('.d2-toolbar__btn-icon')!.innerHTML).toBe(
        TOOLBAR_REFRESH_ICON_SVG,
      )

      // Open config modal, then click refreshBtn -> closes config modal, adds is-refreshing spin class, fires callback
      configBtn.click()
      expect(configOverlay.hidden).toBe(false)
      refreshBtn.click()
      expect(configOverlay.hidden).toBe(true)
      expect(onRefreshDisplay).toHaveBeenCalledTimes(1)
      expect(refreshBtn.className).toContain('is-refreshing')

      // Switching language updates tooltip/aria-label
      toolbar.setLanguage('en')
      expect(refreshBtn.title).toBe('Refresh Display & Resync Position')
      expect(refreshBtn.getAttribute('aria-label')).toBe('Refresh Display & Resync Position')

      toolbar.destroy()
    } finally {
      ;(globalThis as { document?: unknown }).document = prevDoc
    }
  })

  it('resets stuck CommandMapper/HudManager/Camera state and sends throttled C2S 0x4B in OnlineSession.refreshDisplayAndResync', () => {
    const session = new OnlineSession()

    // Simulate stuck input & UI states
    const mapper = session.commandMapper as unknown as {
      leftMouseDown: boolean
      rightMouseDown: boolean
      altHeld: boolean
      shiftHeld: boolean
      ctrlHeld: boolean
      pendingNpcInteractId: number | null
    }
    mapper.leftMouseDown = true
    mapper.rightMouseDown = true
    mapper.altHeld = true
    mapper.shiftHeld = true
    mapper.ctrlHeld = true
    mapper.pendingNpcInteractId = 99

    session.hudManager.hotkeys.openPopup = 'left'
    session.hudManager.belt.lockedOpen = true
    session.hudManager.helpOverlayOpen = true
    session.hudManager.escapeMenuOpen = true
    session.hudManager.showGroundLabels = true
    session.hudManager.setInputFocused(false)

    // Populate player & living merc in world
    const selfMut = session.world.self as unknown as {
      unitId: number
      x: number
      y: number
      mercId: number
    }
    selfMut.unitId = 101
    selfMut.x = 5100
    selfMut.y = 5200
    selfMut.mercId = 202
    session.predictor.setPosition(5180, 5260)

    const dispatched: ClientCommand[] = []
    ;(
      session as unknown as {
        phaseValue: string
        gameAdapter: Record<string, unknown>
      }
    ).phaseValue = 'ingame'
    ;(
      session as unknown as {
        gameAdapter: Record<string, unknown>
      }
    ).gameAdapter = {}
    vi.spyOn(session, 'dispatchCommand').mockImplementation(cmd => {
      dispatched.push(cmd as ClientCommand)
      return true
    })

    const res1 = session.refreshDisplayAndResync(5000)
    expect(res1.sentNetworkResync).toBe(true)

    // Verify stuck input flags cleared
    expect(mapper.leftMouseDown).toBe(false)
    expect(mapper.rightMouseDown).toBe(false)
    expect(mapper.altHeld).toBe(false)
    expect(mapper.shiftHeld).toBe(false)
    expect(mapper.ctrlHeld).toBe(false)
    expect(mapper.pendingNpcInteractId).toBeNull()

    // Verify stuck HUD flyouts/modals cleared and input focus restored
    expect(session.hudManager.hotkeys.openPopup).toBeNull()
    expect(session.hudManager.belt.lockedOpen).toBe(false)
    expect(session.hudManager.helpOverlayOpen).toBe(false)
    expect(session.hudManager.escapeMenuOpen).toBe(false)
    expect(session.hudManager.showGroundLabels).toBe(false)
    expect(session.hudManager.isInputFocused()).toBe(true)

    // Verify predictor and camera snapped to self position
    expect(session.predictor.getSnapshot().x).toBe(5100)
    expect(session.predictor.getSnapshot().y).toBe(5200)
    expect(session.camera.subX).toBe(5100)
    expect(session.camera.subY).toBe(5200)

    // Sent 0x4B RequestEntityUpdate for non-local merc (202), NEVER for local player (101) (D2Client 0x6FADB1EC, Issue #1712)
    expect(dispatched).toEqual([
      { type: 'RequestEntityUpdate', unitType: 1, unitId: 202 },
    ])

    // Calling again within 1000ms still refreshes local display state, but throttles network packets
    mapper.leftMouseDown = true
    const res2 = session.refreshDisplayAndResync(5500)
    expect(res2.sentNetworkResync).toBe(false)
    expect(mapper.leftMouseDown).toBe(false)
    expect(dispatched.length).toBe(1)

    // Non-local unit with unit+0xC4 bit 23 (0x00800000) and unit+0xC8 bit 5 (0x20) triggers 0x4B and clears both bits (0x6FADB20E..0x6FADB240)
    session.world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 303, classId: 5, x: 5110, y: 5210, mode: 1 } as any,
    })
    const remoteMonster = session.world.getUnit('monster', 303) as unknown as {
      flags: number
      flagsEx?: number
    }
    remoteMonster.flags = 0x00800000
    remoteMonster.flagsEx = 0x00000020

    // Calling after 1000ms sends network packets again
    const res3 = session.refreshDisplayAndResync(6100)
    expect(res3.sentNetworkResync).toBe(true)
    expect(dispatched).toEqual([
      { type: 'RequestEntityUpdate', unitType: 1, unitId: 202 },
      { type: 'RequestEntityUpdate', unitType: 1, unitId: 202 },
      { type: 'RequestEntityUpdate', unitType: 1, unitId: 303 },
    ])
    expect(remoteMonster.flags & 0x00800000).toBe(0)
    expect((remoteMonster.flagsEx ?? 0) & 0x00000020).toBe(0)
  })
})
