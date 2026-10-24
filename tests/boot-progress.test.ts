import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BootProgressTracker,
  extractAssetFileName,
  extractAssetResourceType,
  normalizeAssetPath,
  type BootProgressSnapshot,
} from '../src/client/ui/boot-progress.ts'

const ROOT_DIR = resolve(__dirname, '..')

interface MockElement {
  id: string
  hidden: boolean
  textContent: string
  innerHTML: string
  style: { width: string; display: string }
  attributes: Map<string, string>
  setAttribute(name: string, val: string): void
  removeAttribute(name: string): void
  getAttribute(name: string): string | null
  appendChild(child: MockElement): MockElement
}

function createMockDomEnvironment(): {
  readonly stageEl: HTMLElement
  readonly elementsById: Map<string, MockElement>
  readonly cleanup: () => void
} {
  const elementsById = new Map<string, MockElement>()

  const makeEl = (id = ''): MockElement => {
    const el: MockElement = {
      id,
      hidden: false,
      textContent: '',
      innerHTML: '',
      style: { width: '0%', display: 'flex' },
      attributes: new Map<string, string>(),
      setAttribute(name: string, val: string) {
        this.attributes.set(name, val)
      },
      removeAttribute(name: string) {
        this.attributes.delete(name)
      },
      getAttribute(name: string) {
        return this.attributes.get(name) ?? null
      },
      appendChild(child: MockElement) {
        if (child.id) {
          elementsById.set(child.id, child)
        }
        return child
      },
    }
    if (id) {
      elementsById.set(id, el)
    }
    return el
  }

  // Pre-register the boot progress DOM elements matching play.html
  makeEl('d2-boot-loading')
  makeEl('d2-boot-progress-bar')
  makeEl('d2-boot-progress-fill')
  makeEl('d2-boot-progress-percent')
  makeEl('d2-boot-progress-file')
  makeEl('d2-boot-progress-count')
  const stageEl = makeEl('play-stage') as unknown as HTMLElement

  const prevDoc = (globalThis as Record<string, unknown>).document
  const prevWin = (globalThis as Record<string, unknown>).window

  ;(globalThis as Record<string, unknown>).document = {
    getElementById(id: string) {
      return (elementsById.get(id) ?? null) as unknown as HTMLElement | null
    },
    createElement() {
      return makeEl() as unknown as HTMLElement
    },
  }
  ;(globalThis as Record<string, unknown>).window = globalThis

  return {
    stageEl,
    elementsById,
    cleanup: () => {
      if (prevDoc === undefined) {
        delete (globalThis as Record<string, unknown>).document
      } else {
        ;(globalThis as Record<string, unknown>).document = prevDoc
      }
      if (prevWin === undefined) {
        delete (globalThis as Record<string, unknown>).window
      } else {
        ;(globalThis as Record<string, unknown>).window = prevWin
      }
    },
  }
}

describe('Client Boot Resource Download Progress Bar (boot-progress)', () => {
  let cleanupDom: (() => void) | null = null

  afterEach(() => {
    if (cleanupDom) {
      cleanupDom()
      cleanupDom = null
    }
  })

  it('extractAssetFileName extracts clean filenames and strips query/hash fragments', () => {
    expect(extractAssetFileName('/act-packs/tiles/drlg-bundle.bin')).toBe('drlg-bundle.bin')
    expect(extractAssetFileName('/ui/items-atlas.png?v=123')).toBe(
      'items-atlas.png',
    )
    expect(extractAssetFileName('http://127.0.0.1:5173/ui/frontend/bg-main-menu.png#top')).toBe(
      'bg-main-menu.png',
    )
    expect(extractAssetFileName('data\\global\\tiles\\act1\\town\\town.dt1')).toBe('town.dt1')
    expect(extractAssetFileName('data:image/png;base64,iVBORw0KGgo=')).toBe('')
    expect(extractAssetFileName('blob:http://127.0.0.1:5173/abc-123')).toBe('')
    expect(extractAssetFileName('')).toBe('')
  })

  it('extractAssetResourceType classifies asset paths into semantic resource types instead of raw filenames', () => {
    expect(extractAssetResourceType('/ui/fonts/metrics.json')).toBe('字体资源')
    expect(extractAssetResourceType('/ui/frontend/fonts/fontformal12-c4.png')).toBe('字体资源')
    expect(extractAssetResourceType('/act-packs/tiles/drlg-bundle.bin')).toBe('地图地形资源')
    expect(extractAssetResourceType('data\\global\\tiles\\act1\\town\\town.dt1')).toBe('地图地形资源')
    expect(extractAssetResourceType('http://127.0.0.1:5173/ui/frontend/bg-main-menu.png#top')).toBe(
      '主菜单与大厅界面',
    )
    expect(extractAssetResourceType('/ui/ctrlpnl-800.png')).toBe('游戏界面资源')
    expect(extractAssetResourceType('/ui/items-atlas.png?v=123')).toBe(
      '物品图标资源',
    )
    expect(extractAssetResourceType('/skills/icon_36.png')).toBe('技能图标资源')
    expect(extractAssetResourceType('/ui/automap/MaxiMap.png')).toBe('小地图资源')
    expect(extractAssetResourceType('/entities/char-so.r8')).toBe('角色美术资源')
    expect(extractAssetResourceType('/entities/monster-fallen1-hth.r8')).toBe(
      '怪物美术资源',
    )
    expect(extractAssetResourceType('/missiles/firebolt.png')).toBe('投射物特效资源')
    expect(extractAssetResourceType('/overlays/AuraDefianceBack.png')).toBe('光环与状态特效')
    expect(extractAssetResourceType('./asset-manifest.json')).toBe('资源配置数据')
    expect(extractAssetResourceType('data:image/png;base64,iVBORw0KGgo=')).toBe('')
    expect(extractAssetResourceType('blob:http://127.0.0.1:5173/abc-123')).toBe('')
    expect(extractAssetResourceType('')).toBe('')
  })

  it('normalizeAssetPath strips origin, query, and hash while preserving path', () => {
    expect(normalizeAssetPath('http://127.0.0.1:5173/ui/frontend/bg-main-menu.png?t=1#a')).toBe(
      '/ui/frontend/bg-main-menu.png',
    )
    expect(normalizeAssetPath('/act-packs/tiles/index.json')).toBe('/act-packs/tiles/index.json')
  })

  it('tracks downloading resource types (instead of raw filenames), monotonic percentage (0% -> 100%), and updates DOM elements', () => {
    const dom = createMockDomEnvironment()
    cleanupDom = dom.cleanup

    const tracker = new BootProgressTracker({
      stageEl: dom.stageEl,
      expectedTotal: 4,
    }).install()

    const snapshots: BootProgressSnapshot[] = []
    tracker.subscribe((snap) => snapshots.push(snap))

    const overlayEl = dom.elementsById.get('d2-boot-loading')!
    const percentEl = dom.elementsById.get('d2-boot-progress-percent')!
    const fillEl = dom.elementsById.get('d2-boot-progress-fill')!
    const fileEl = dom.elementsById.get('d2-boot-progress-file')!

    expect(overlayEl.hidden).toBe(false)
    expect(percentEl.textContent).toBe('0%')

    // Start downloading file 1 & file 2 concurrently -> displays resource types instead of filenames
    const id1 = tracker.beginFile('/ui/fonts/metrics.json')
    expect(tracker.getSnapshot().currentFile).toBe('字体资源')
    expect(tracker.getSnapshot().currentResourceType).toBe('字体资源')
    expect(fileEl.textContent).toBe('字体资源')
    expect(fileEl.getAttribute('title')).toBe('字体资源')

    const id2 = tracker.beginFile('/act-packs/tiles/drlg-bundle.bin')
    expect(tracker.getSnapshot().currentFile).toBe('地图地形资源')
    expect(fileEl.textContent).toBe('地图地形资源')

    // Finish file 2 while file 1 is still in flight -> currentFile falls back to in-flight file 1's resource type
    tracker.endFile(id2)
    expect(tracker.getSnapshot().percent).toBe(25)
    expect(tracker.getSnapshot().currentFile).toBe('字体资源')
    expect(percentEl.textContent).toBe('25%')
    expect(fillEl.style.width).toBe('25%')

    // Finish file 1
    tracker.endFile(id1)
    expect(tracker.getSnapshot().percent).toBe(50)
    expect(percentEl.textContent).toBe('50%')

    // Start & finish file 3 & file 4
    const id3 = tracker.beginFile('/ui/frontend/bg-main-menu.png')
    expect(fileEl.textContent).toBe('主菜单与大厅界面')
    tracker.endFile(id3)
    expect(tracker.getSnapshot().percent).toBe(75)

    const id4 = tracker.beginFile('/ui/items-atlas.png')
    expect(fileEl.textContent).toBe('物品图标资源')
    tracker.endFile(id4)
    expect(tracker.getSnapshot().percent).toBe(99)

    // Complete boot
    tracker.complete()
    const finalSnap = tracker.getSnapshot()
    expect(finalSnap.percent).toBe(100)
    expect(finalSnap.status).toBe('completed')
    expect(finalSnap.loadedCount).toBe(4)
    expect(finalSnap.loadedFiles).toEqual([
      '地图地形资源',
      '字体资源',
      '主菜单与大厅界面',
      '物品图标资源',
    ])
    expect(percentEl.textContent).toBe('100%')
    expect(fillEl.style.width).toBe('100%')
    expect(overlayEl.hidden).toBe(true)

    // Verify percentage is strictly monotonic across all emitted snapshots
    for (let i = 1; i < snapshots.length; i++) {
      expect(snapshots[i]!.percent).toBeGreaterThanOrEqual(snapshots[i - 1]!.percent)
    }
  })

  it('intercepts global fetch calls during boot and restores original fetch upon complete()', async () => {
    const dom = createMockDomEnvironment()
    cleanupDom = dom.cleanup

    const mockFetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input)
      return new Response(JSON.stringify({ url }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const prevFetch = globalThis.fetch
    globalThis.fetch = mockFetch as typeof globalThis.fetch

    try {
      const tracker = new BootProgressTracker({
        stageEl: dom.stageEl,
        expectedTotal: 2,
      }).install()

      expect(globalThis.fetch).not.toBe(mockFetch)

      const res1 = await globalThis.fetch('/act-packs/tiles/index.json')
      expect(tracker.getSnapshot().currentFile).toBe('地图地形资源')
      await res1.json()
      expect(tracker.getSnapshot().loadedCount).toBe(1)
      expect(tracker.getSnapshot().percent).toBe(50)

      const res2 = await globalThis.fetch('/ui/frontend/manifest.json')
      expect(tracker.getSnapshot().currentFile).toBe('主菜单与大厅界面')
      await res2.json()
      expect(tracker.getSnapshot().loadedCount).toBe(2)

      await tracker.waitForIdle(200)
      tracker.complete()

      expect(tracker.getSnapshot().percent).toBe(100)
      expect(globalThis.fetch).toBe(mockFetch)
    } finally {
      globalThis.fetch = prevFetch
    }
  })

  it('play.html includes #d2-boot-loading progress bar elements and main.ts wires BootProgressTracker', () => {
    const playHtml = readFileSync(resolve(ROOT_DIR, 'play.html'), 'utf8')
    expect(playHtml).toContain('id="d2-boot-loading"')
    expect(playHtml).toContain('id="d2-boot-progress-bar"')
    expect(playHtml).toContain('id="d2-boot-progress-fill"')
    expect(playHtml).toContain('id="d2-boot-progress-percent"')
    expect(playHtml).toContain('id="d2-boot-progress-file"')

    const mainTs = readFileSync(resolve(ROOT_DIR, 'src/client/main.ts'), 'utf8')
    expect(mainTs).toContain('BootProgressTracker')
    expect(mainTs).toContain('bootProgress.complete()')
  })
})
