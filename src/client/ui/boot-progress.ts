/**
 * Client Boot Resource Download Progress Bar (`src/client/ui/boot-progress.ts`).
 *
 * Tracks all client boot resource downloads (`fetch` requests and `HTMLImageElement`
 * image loads across HUD, DRLG tile bundles, palettes, Battle.net frontend UI sprites,
 * automap atlases, ground items atlas, character/monster `.r8` atlases, and
 * missile/overlay sprite sheets) when entering `play.html`.
 *
 * Renders:
 * 1. Total download progress percentage (`0%` – `100%`, strictly monotonic).
 * 2. The semantic resource type of the asset currently being downloaded (`currentFile` / `currentResourceType`).
 */

export interface BootProgressSnapshot {
  /** Monotonic total download percentage in `[0, 100]`. */
  readonly percent: number
  /** Semantic resource type of the resource currently being downloaded (e.g. `地图地形资源`, `物品图标资源`). */
  readonly currentFile: string
  /** Semantic resource type of the resource currently being downloaded. */
  readonly currentResourceType: string
  /** Normalized URL/path of the resource currently being downloaded. */
  readonly currentFilePath: string
  /** Number of resources that have finished downloading. */
  readonly loadedCount: number
  /** Total number of discovered/expected resources in the boot batch. */
  readonly totalCount: number
  /** Number of resources currently in flight. */
  readonly inFlightCount: number
  /** Lifecycle status of the boot progress tracker. */
  readonly status: 'idle' | 'loading' | 'completed'
  /** Ordered list of resource types that have completed downloading. */
  readonly loadedFiles: readonly string[]
}

export interface BootProgressOptions {
  /** Container element (e.g. `#play-stage`) where `#d2-boot-loading` resides or will be mounted. */
  readonly stageEl?: HTMLElement | null
  /** Baseline expected number of boot resource requests used to prevent early 100% spikes. */
  readonly expectedTotal?: number
  /** Initial placeholder label before the first request starts. */
  readonly initialFileLabel?: string
  /** Whether to automatically hide the overlay when `complete()` is called (default: `true`). */
  readonly hideOnComplete?: boolean
}

interface InFlightEntry {
  readonly id: number
  readonly fileName: string
  readonly resourceType: string
  readonly filePath: string
  readonly promise: Promise<void>
  readonly resolve: () => void
}

/**
 * Default baseline asset count across pre-auth boot (`startPlayApp()`):
 * - `frontendRenderer.load('/ui/frontend')` (~179 frontend sprites & font atlases)
 *
 * In-game heavy assets (`MapService`, `HudManager`, `Weather`, missiles, overlays, entity catalogs)
 * are streamed concurrently in the background during pre-auth / idle and guaranteed ready in `door_loading`.
 */
export const DEFAULT_EXPECTED_BOOT_ASSETS = 180

const INITIAL_PLACEHOLDER_LABELS = new Set(['initializing...', '正在初始化...'])

const KNOWN_RESOURCE_TYPES = new Set([
  '字体资源',
  '小地图资源',
  '技能图标资源',
  '物品图标资源',
  '投射物特效资源',
  '光环与状态特效',
  '角色美术资源',
  '怪物美术资源',
  '地图地形资源',
  '主菜单与大厅界面',
  '游戏界面资源',
  '资源配置数据',
  '美术贴图资源',
  '游戏资源',
])

/**
 * Extracts a clean resource filename from a URL or relative path.
 * Strips query parameters and hash fragments.
 *
 * Examples:
 * - `/act-packs/tiles/drlg-bundle.bin` -> `drlg-bundle.bin`
 * - `/ui/items-atlas.png?v=1` -> `items-atlas.png`
 * - `/ui/frontend/bg-main-menu.png#top` -> `bg-main-menu.png`
 */
export function extractAssetFileName(urlOrPath: string): string {
  const trimmed = urlOrPath.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return ''
  }
  const noHash = trimmed.split('#')[0] ?? trimmed
  const noQuery = noHash.split('?')[0] ?? noHash
  const normalized = noQuery.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!normalized) return ''
  const segments = normalized.split('/').filter((s) => s.length > 0)
  const last = segments[segments.length - 1] ?? ''
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

/**
 * Normalizes a fetch/image URL into a readable relative path without origin, query, or hash.
 */
export function normalizeAssetPath(urlOrPath: string): string {
  const trimmed = urlOrPath.trim()
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return ''
  }
  let pathPart = trimmed
  try {
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) {
      const parsed = new URL(trimmed)
      pathPart = parsed.pathname
    }
  } catch {
    // Keep original string if URL parsing fails
  }
  const noHash = pathPart.split('#')[0] ?? pathPart
  const noQuery = noHash.split('?')[0] ?? noHash
  return noQuery.replace(/\\/g, '/')
}

/**
 * Classifies a resource URL or path into a human-readable semantic asset type label
 * (replacing raw filenames in the homepage boot download progress UI).
 *
 * Examples:
 * - `/ui/fonts/metrics.json` -> `'字体资源'`
 * - `/act-packs/tiles/drlg-bundle.bin` -> `'地图地形资源'`
 * - `/ui/frontend/bg-main-menu.png` -> `'主菜单与大厅界面'`
 * - `/ui/items-atlas.png` -> `'物品图标资源'`
 * - `/entities/char-so.r8` -> `'角色美术资源'`
 * - `/entities/monster-fallen1-hth.r8` -> `'怪物美术资源'`
 * - `/missiles/firebolt.png` -> `'投射物特效资源'`
 * - `/overlays/AuraDefianceBack.png` -> `'光环与状态特效'`
 * - `/skills/icon_36.png` -> `'技能图标资源'`
 * - `/ui/automap/MaxiMap.png` -> `'小地图资源'`
 * - `/ui/ctrlpnl-800.png` -> `'游戏界面资源'`
 */
export function extractAssetResourceType(urlOrPath: string): string {
  const trimmed = urlOrPath.trim()
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return ''
  }
  if (KNOWN_RESOURCE_TYPES.has(trimmed)) {
    return trimmed
  }

  const rawFileName = extractAssetFileName(trimmed)
  if (!rawFileName) return ''

  const fileName = rawFileName.toLowerCase()
  const normPath = normalizeAssetPath(trimmed).toLowerCase()

  if (
    normPath.includes('/fonts/') ||
    normPath.startsWith('fonts/') ||
    fileName === 'metrics.json' ||
    fileName.startsWith('font') ||
    /\.(?:ttf|woff2?|otf)$/i.test(fileName)
  ) {
    return '字体资源'
  }

  if (
    normPath.includes('/automap/') ||
    /^(?:automap|maximap|act[24]map|extnmap)/i.test(fileName)
  ) {
    return '小地图资源'
  }

  if (
    normPath.includes('/skills/') ||
    normPath.startsWith('skills/') ||
    /^(?:skill|generic-skills|bg_(?:ama|ass|bar|dru|nec|pal|sor)_)/i.test(fileName)
  ) {
    return '技能图标资源'
  }

  if (normPath.includes('/items/') || fileName.startsWith('items-atlas')) {
    return '物品图标资源'
  }

  if (normPath.includes('/missiles/') || normPath.startsWith('missiles/')) {
    return '投射物特效资源'
  }

  if (normPath.includes('/overlays/') || normPath.startsWith('overlays/')) {
    return '光环与状态特效'
  }

  if (normPath.includes('/chars/') || /^char-(?!sheet|select)/i.test(fileName)) {
    return '角色美术资源'
  }

  if (normPath.includes('/entities/') || /^(?:monster-|monstats)/i.test(fileName)) {
    return '怪物美术资源'
  }

  if (
    normPath.includes('/tiles/') ||
    normPath.startsWith('act-packs/tiles') ||
    /(?:^|\/)packs\/act[1-5]\//i.test(normPath) ||
    /^(?:drlg-bundle|palette\.bin|world-graph|tiles-|objects-|scene\.json)/i.test(fileName) ||
    /\.(?:dt1|ds1|pal|pl2)$/i.test(fileName)
  ) {
    return '地图地形资源'
  }

  if (
    normPath.includes('/ui/frontend/') ||
    normPath.startsWith('ui/frontend/') ||
    /^(?:bg-main-menu|bg-char-create|bg-char-select|bg-waiting-room|loading-door-strip|create-game-bg|join-game-bg|charselectbox|realmselect|popup-|logo-|gembutton|textbox|clickbox|joingameclickbox|radiobutton|grey-level-box|btn-)/i.test(
      fileName,
    )
  ) {
    return '主菜单与大厅界面'
  }

  if (
    normPath.includes('/ui/') ||
    normPath.startsWith('ui/') ||
    /^(?:ctrlpnl|globe-|overlap-|border-|char-sheet|inv-sheet|inv-tab|quest-|quests-atlas|waypoint-|stash-bg|cube-bg|vendor-|popbelt|minipanel|runbutton|menubutton|buysellbtn|goldcoinbtn|miniconvert|level-btn|level-socket|cursor|boxpieces|focus16)/i.test(
      fileName,
    )
  ) {
    return '游戏界面资源'
  }

  if (normPath.includes('/anim/') || normPath.includes('/weather/') || /\.(?:json|bin|d2|txt|tbl|dat)$/i.test(fileName)) {
    return '资源配置数据'
  }

  if (/\.(?:png|r8|dc6|dcc|pcx|cel)$/i.test(fileName)) {
    return '美术贴图资源'
  }

  return '游戏资源'
}

export class BootProgressTracker {
  private readonly stageEl: HTMLElement | null
  private readonly expectedTotal: number
  private readonly hideOnComplete: boolean

  private overlayEl: HTMLElement | null = null
  private barEl: HTMLElement | null = null
  private fillEl: HTMLElement | null = null
  private percentEl: HTMLElement | null = null
  private fileEl: HTMLElement | null = null
  private countEl: HTMLElement | null = null

  private nextId = 1
  private totalDiscovered = 0
  private loadedCount = 0
  private stageFloorPercent = 0
  private percent = 0
  private currentFile: string
  private currentFilePath = ''
  private status: 'idle' | 'loading' | 'completed' = 'idle'
  private readonly inFlight = new Map<number, InFlightEntry>()
  private readonly loadedFiles: string[] = []
  private readonly listeners = new Set<(snap: BootProgressSnapshot) => void>()

  private installed = false
  private originalFetch: typeof globalThis.fetch | null = null
  private originalImgSrcDescriptor: PropertyDescriptor | null = null

  constructor(options: BootProgressOptions = {}) {
    this.stageEl = options.stageEl ?? null
    this.expectedTotal = Math.max(1, options.expectedTotal ?? DEFAULT_EXPECTED_BOOT_ASSETS)
    this.currentFile = options.initialFileLabel ?? '正在初始化...'
    this.hideOnComplete = options.hideOnComplete ?? true
    this.bindOrCreateDom()
  }

  /**
   * Ensures the `#d2-boot-loading` DOM structure exists and binds element references.
   */
  private bindOrCreateDom(): void {
    if (typeof document === 'undefined') return

    let overlay =
      (this.stageEl
        ? (this.stageEl.querySelector('#d2-boot-loading, .d2-boot-loading') as HTMLElement | null)
        : null) ?? document.getElementById('d2-boot-loading')
    if (!overlay && this.stageEl) {
      overlay = document.createElement('div')
      overlay.id = 'd2-boot-loading'
      overlay.className = 'd2-boot-loading'
      overlay.innerHTML = [
        '<div class="d2-boot-panel">',
        '  <div class="d2-boot-title">DIABLO II: LORD OF DESTRUCTION</div>',
        '  <div class="d2-boot-subtitle">正在下载游戏资源 · LOADING RESOURCES</div>',
        '  <div id="d2-boot-progress-bar" class="d2-boot-bar-bg" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">',
        '    <div id="d2-boot-progress-fill" class="d2-boot-bar-fill" style="width: 0%"></div>',
        '    <div id="d2-boot-progress-percent" class="d2-boot-pct">0%</div>',
        '  </div>',
        '  <div class="d2-boot-meta">',
        '    <span class="d2-boot-file-label">正在下载:</span>',
        '    <span id="d2-boot-progress-file" class="d2-boot-phase">正在初始化...</span>',
        '    <span id="d2-boot-progress-count">(0/0)</span>',
        '  </div>',
        '</div>',
      ].join('\n')
      this.stageEl.appendChild(overlay)
    }

    this.overlayEl = overlay
    const q = (selector: string, fallbackId: string): HTMLElement | null =>
      (overlay ? (overlay.querySelector(selector) as HTMLElement | null) : null) ??
      document.getElementById(fallbackId)
    this.barEl = q('#d2-boot-progress-bar, .d2-boot-bar-bg', 'd2-boot-progress-bar')
    this.fillEl = q('#d2-boot-progress-fill, .d2-boot-bar-fill', 'd2-boot-progress-fill')
    this.percentEl = q('#d2-boot-progress-percent, .d2-boot-pct', 'd2-boot-progress-percent')
    this.fileEl = q('#d2-boot-progress-file, .d2-boot-phase', 'd2-boot-progress-file')
    this.countEl = q('#d2-boot-progress-count', 'd2-boot-progress-count')
    this.renderDom()
  }

  /**
   * Installs global `fetch` and `HTMLImageElement.prototype.src` hooks to track
   * all resource downloads initiated during client boot.
   */
  install(): this {
    if (this.status === 'idle') {
      this.status = 'loading'
    }
    if (this.overlayEl) {
      this.overlayEl.hidden = false
      this.overlayEl.style.display = 'flex'
      this.overlayEl.removeAttribute('data-boot-complete')
    }
    this.renderDom()

    if (this.installed) return this
    this.installed = true

    if (typeof globalThis.fetch === 'function') {
      const origFetch = globalThis.fetch.bind(globalThis)
      this.originalFetch = globalThis.fetch
      globalThis.fetch = async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        const rawUrl =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : typeof input === 'object' && input !== null && 'url' in input
                ? String((input as Request).url)
                : String(input)

        const id = this.beginFile(rawUrl)
        if (id === 0) {
          return origFetch(input, init)
        }

        try {
          const response = await origFetch(input, init)
          if (!response || !response.ok) {
            this.endFile(id)
            return response
          }
          this.wrapResponseBodyCompletion(response, id)
          return response
        } catch (err) {
          this.endFile(id)
          throw err
        }
      }
    }

    if (typeof HTMLImageElement !== 'undefined' && HTMLImageElement.prototype) {
      const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
      if (desc && typeof desc.set === 'function' && typeof desc.get === 'function') {
        this.originalImgSrcDescriptor = desc
        const tracker = this
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
          configurable: true,
          enumerable: desc.enumerable ?? true,
          get(): string {
            return desc.get!.call(this) as string
          },
          set(value: string) {
            const rawUrl = String(value ?? '')
            const id = tracker.beginFile(rawUrl)
            desc.set!.call(this, value)
            if (id === 0) return

            const img = this as HTMLImageElement
            if (img.complete && img.naturalWidth > 0) {
              queueMicrotask(() => tracker.endFile(id))
              return
            }
            let settled = false
            const done = (): void => {
              if (settled) return
              settled = true
              img.removeEventListener('load', done)
              img.removeEventListener('error', done)
              tracker.endFile(id)
            }
            img.addEventListener('load', done, { once: true })
            img.addEventListener('error', done, { once: true })
          },
        })
      }
    }

    this.publishGlobal()
    return this
  }

  /**
   * Wraps body consumption methods on a `Response` so the resource is marked complete
   * once its payload (`json()`, `arrayBuffer()`, `text()`, or `blob()`) has been downloaded.
   */
  private wrapResponseBodyCompletion(response: Response, id: number): void {
    let finished = false
    const finish = (): void => {
      if (finished) return
      finished = true
      this.endFile(id)
    }

    const methodNames = ['json', 'arrayBuffer', 'text', 'blob'] as const
    for (const method of methodNames) {
      const orig = response[method]
      if (typeof orig === 'function') {
        const bound = orig.bind(response) as () => Promise<unknown>
        try {
          Object.defineProperty(response, method, {
            configurable: true,
            writable: true,
            value: async () => {
              try {
                return await bound()
              } finally {
                finish()
              }
            },
          })
        } catch {
          // Response property may be non-configurable in some synthetic mocks; fallback timer handles it
        }
      }
    }

    // Fallback in case caller only inspects headers/status without consuming body
    setTimeout(finish, 1500)
  }

  /**
   * Restores original `fetch` and `HTMLImageElement.prototype.src` globals.
   */
  uninstall(): void {
    if (!this.installed) return
    this.installed = false

    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch
      this.originalFetch = null
    }
    if (this.originalImgSrcDescriptor && typeof HTMLImageElement !== 'undefined') {
      try {
        Object.defineProperty(HTMLImageElement.prototype, 'src', this.originalImgSrcDescriptor)
      } catch {
        // Ignore restore error
      }
      this.originalImgSrcDescriptor = null
    }
  }

  /**
   * Records the start of a resource download and updates the active resource type & percentage.
   * Returns a non-zero tracking ID (or `0` if the URL is ignored, e.g. `data:`/`blob:`).
   */
  beginFile(urlOrPath: string): number {
    if (this.status === 'completed') return 0
    const fileName = extractAssetFileName(urlOrPath)
    if (!fileName) return 0
    const resourceType = extractAssetResourceType(urlOrPath) || '游戏资源'

    const filePath = normalizeAssetPath(urlOrPath) || fileName
    if (this.status === 'idle') {
      this.status = 'loading'
    }

    const id = this.nextId++
    let resolveFn!: () => void
    const promise = new Promise<void>((r) => {
      resolveFn = r
    })

    this.totalDiscovered++
    this.inFlight.set(id, {
      id,
      fileName,
      resourceType,
      filePath,
      promise,
      resolve: resolveFn,
    })

    this.currentFile = resourceType
    this.currentFilePath = filePath
    this.recalculatePercent()
    this.renderDom()
    this.emitChange()
    return id
  }

  /**
   * Records the completion of a resource download by ID.
   */
  endFile(id: number): void {
    const entry = this.inFlight.get(id)
    if (!entry) return
    this.inFlight.delete(id)
    entry.resolve()

    if (this.status === 'completed') return

    this.loadedCount++
    this.loadedFiles.push(entry.resourceType)

    // If other files are still downloading, show the most recently started in-flight resource type;
    // otherwise keep the just-finished resource type visible.
    if (this.inFlight.size > 0) {
      let latest: InFlightEntry | undefined
      for (const item of this.inFlight.values()) {
        latest = item
      }
      if (latest) {
        this.currentFile = latest.resourceType
        this.currentFilePath = latest.filePath
      }
    } else {
      this.currentFile = entry.resourceType
      this.currentFilePath = entry.filePath
    }

    this.recalculatePercent()
    this.renderDom()
    this.emitChange()
  }

  /**
   * Explicitly tracks an arbitrary Promise associated with a resource path/name.
   */
  async trackPromise<T>(urlOrPath: string, promise: Promise<T>): Promise<T> {
    const id = this.beginFile(urlOrPath)
    try {
      return await promise
    } finally {
      if (id !== 0) {
        this.endFile(id)
      }
    }
  }

  /**
   * Advances the minimum percentage floor at a major boot milestone.
   */
  setStageFloor(minPercent: number, fallbackFile?: string): void {
    if (this.status === 'completed') return
    const clamped = Math.max(0, Math.min(99, Math.floor(minPercent)))
    if (clamped > this.stageFloorPercent) {
      this.stageFloorPercent = clamped
    }
    if (fallbackFile && (!this.currentFile || INITIAL_PLACEHOLDER_LABELS.has(this.currentFile))) {
      this.currentFile = extractAssetResourceType(fallbackFile) || fallbackFile
      this.currentFilePath = normalizeAssetPath(fallbackFile) || this.currentFile
    }
    this.recalculatePercent()
    this.renderDom()
    this.emitChange()
  }

  /**
   * Waits until all currently in-flight resource downloads have settled, bounded by `timeoutMs`.
   */
  async waitForIdle(timeoutMs = 3500): Promise<void> {
    const deadline = Date.now() + Math.max(50, timeoutMs)
    while (this.inFlight.size > 0 && Date.now() < deadline) {
      const pending = Array.from(this.inFlight.values(), (e) => e.promise)
      const remainingMs = Math.max(10, deadline - Date.now())
      await Promise.race([
        Promise.all(pending),
        new Promise<void>((r) => setTimeout(r, Math.min(250, remainingMs))),
      ])
    }
  }

  /**
   * Marks all boot resource downloads as 100% complete, updates DOM, unhides the game stage,
   * and restores patched globals.
   */
  complete(): void {
    for (const entry of this.inFlight.values()) {
      this.loadedCount++
      this.loadedFiles.push(entry.resourceType)
      entry.resolve()
    }
    this.inFlight.clear()

    this.uninstall()
    this.status = 'completed'
    this.percent = 100
    if (!this.currentFile || INITIAL_PLACEHOLDER_LABELS.has(this.currentFile)) {
      this.currentFile = this.loadedFiles[this.loadedFiles.length - 1] ?? '游戏资源'
    }
    this.renderDom()
    if (this.overlayEl) {
      this.overlayEl.setAttribute('data-boot-complete', 'true')
      if (this.hideOnComplete) {
        this.overlayEl.hidden = true
        this.overlayEl.style.display = 'none'
      }
    }
    this.emitChange()
  }

  private recalculatePercent(): void {
    if (this.status === 'completed') {
      this.percent = 100
      return
    }
    const denominator = Math.max(this.expectedTotal, this.totalDiscovered, 1)
    const ratioPercent = Math.min(99, Math.floor((this.loadedCount / denominator) * 100))
    const nextPercent = Math.max(this.percent, this.stageFloorPercent, ratioPercent)
    this.percent = Math.max(0, Math.min(99, nextPercent))
  }

  private renderDom(): void {
    const totalDisplay = Math.max(this.loadedCount, this.totalDiscovered)
    if (this.barEl) {
      this.barEl.setAttribute('aria-valuenow', String(this.percent))
    }
    if (this.fillEl) {
      this.fillEl.style.width = `${this.percent}%`
    }
    if (this.percentEl) {
      this.percentEl.textContent = `${this.percent}%`
    }
    if (this.fileEl) {
      this.fileEl.textContent = this.currentFile
      this.fileEl.setAttribute('title', this.currentFile)
    }
    if (this.countEl) {
      this.countEl.textContent = `(${this.loadedCount}/${totalDisplay})`
    }
    this.publishGlobal()
  }

  private publishGlobal(): void {
    if (typeof window !== 'undefined') {
      ;(
        window as unknown as {
          __d2BootProgress?: BootProgressSnapshot
        }
      ).__d2BootProgress = this.getSnapshot()
    }
  }

  getSnapshot(): BootProgressSnapshot {
    return {
      percent: this.percent,
      currentFile: this.currentFile,
      currentResourceType: this.currentFile,
      currentFilePath: this.currentFilePath,
      loadedCount: this.loadedCount,
      totalCount: Math.max(this.loadedCount, this.totalDiscovered),
      inFlightCount: this.inFlight.size,
      status: this.status,
      loadedFiles: Array.from(this.loadedFiles),
    }
  }

  subscribe(listener: (snap: BootProgressSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emitChange(): void {
    const snap = this.getSnapshot()
    for (const cb of this.listeners) {
      cb(snap)
    }
  }
}
