/**
 * Standalone Drop Tracker Dashboard (`plugins/drop-tracker/standalone.ts`).
 *
 * Mounts into `#d2-drops-app` in `plugins/drop-tracker/index.html` (and `/drops.html`),
 * displaying:
 * - Holy Grail Light-Up Mode (`点亮模式` / `Light-Up Grail`) summary sections with actual in-game equipment icons (`/ui/items-atlas.png`):
 *   1. Set Items (`套装`): organized by Set (32 sets, 127 pieces), lighting up dropped pieces.
 *   2. Unique Items (`暗金装备`): organized by Base Item Type and sorted by Base Tier (`普通 Normal` -> `扩展 Exceptional` -> `精英 Elite`).
 *   3. Runes (`符文`): sorted in ascending numerical order (`#01`..`#33`).
 * - Chronological Drop Log (`掉落流水` `#d2-drops-history-table`), JSON export, and Clear All controls with live
 *   `BroadcastChannel('d2-drop-tracker')` updates and main-controller (`d2web.settings.v1`) language synchronization.
 */

import {
  bootPluginPage,
  type GameLang,
  type PluginPageContext,
} from '../../src/client/plugin-host/api.ts'
import { tDrop } from './drop-i18n.ts'
import {
  DROP_ITEMS_ATLAS_URL,
  DropTracker,
  IndexedDbDropStatsRepository,
  buildDropGrailCatalog,
  type DropCategory,
  type DropEquipmentTier,
  type DropGrailRuneEntry,
  type DropGrailSetPieceEntry,
  type DropGrailUniqueItemEntry,
  type DropRecord,
  type DropSpriteRect,
  type DropStatsRepository,
  type DropStatsSummary,
} from './drop-tracker.ts'
import { dropTrackerPlugin } from './index.ts'

export interface MountDropTrackerPageOptions {
  readonly repository?: DropStatsRepository | undefined
  readonly tracker?: DropTracker | undefined
  readonly pageContext?: PluginPageContext | undefined
  readonly lang?: GameLang | undefined
}

export interface MountedDropTrackerPage {
  readonly tracker: DropTracker
  getLang(): GameLang
  setLang(lang: GameLang): void
  render(): void
  destroy(): void
}

export type GrailStatusFilter = 'all' | 'lit' | 'unlit'

function formatTimestamp(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return '-'
  try {
    const d = new Date(ts)
    const pad = (n: number): string => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch {
    return String(ts)
  }
}

function createCategoryBadge(doc: Document, category: DropCategory, lang: GameLang): HTMLElement {
  const badge = doc.createElement('span')
  if (category === 'set') {
    badge.className = 'd2-drops__badge d2-drops__badge--set'
    badge.textContent = tDrop('drop.category.set', lang)
  } else if (category === 'unique') {
    badge.className = 'd2-drops__badge d2-drops__badge--unique'
    badge.textContent = tDrop('drop.category.unique', lang)
  } else {
    badge.className = 'd2-drops__badge d2-drops__badge--rune'
    badge.textContent = tDrop('drop.category.rune', lang)
  }
  return badge
}

function createSpriteBoxElement(doc: Document, rect: DropSpriteRect): HTMLElement {
  const box = doc.createElement('div')
  box.className = 'd2-drops__sprite-box'

  const sprite = doc.createElement('div')
  sprite.className = 'd2-drops__item-sprite'
  sprite.style.width = `${rect.w}px`
  sprite.style.height = `${rect.h}px`
  sprite.style.backgroundImage = `url('${DROP_ITEMS_ATLAS_URL}')`
  sprite.style.backgroundPosition = `-${rect.x}px -${rect.y}px`
  sprite.style.backgroundRepeat = 'no-repeat'
  sprite.setAttribute('data-sprite-x', String(rect.x))
  sprite.setAttribute('data-sprite-y', String(rect.y))
  sprite.setAttribute('data-sprite-w', String(rect.w))
  sprite.setAttribute('data-sprite-h', String(rect.h))

  box.appendChild(sprite)
  return box
}

function createSetPieceTile(
  doc: Document,
  piece: DropGrailSetPieceEntry,
  lang: GameLang,
): HTMLElement {
  const isEn = lang === 'en'
  const localName = isEn ? piece.name : piece.nameZh
  const localBase = isEn ? piece.baseName : piece.baseNameZh
  const metaText = `${localBase} (${piece.code})`

  const tile = doc.createElement('div')
  tile.className = `d2-drops__item-tile d2-drops__item-tile--set ${
    piece.lit ? 'd2-drops__item-tile--lit' : 'd2-drops__item-tile--unlit'
  }`
  tile.setAttribute('data-item-code', piece.code)
  tile.setAttribute('data-set-item-id', String(piece.id))
  tile.setAttribute('data-lit', piece.lit ? 'true' : 'false')
  tile.title = piece.lit
    ? tDrop('drop.tile.tooltipLit', lang, {
        name: localName,
        meta: metaText,
        count: piece.count,
      })
    : tDrop('drop.tile.tooltipUnlit', lang, {
        name: localName,
        meta: metaText,
      })

  const topRow = doc.createElement('div')
  topRow.className = 'd2-drops__tile-top'
  const codeBadge = doc.createElement('span')
  codeBadge.className = 'd2-drops__tile-code'
  codeBadge.textContent = piece.code
  topRow.appendChild(codeBadge)

  const statusBadge = doc.createElement('span')
  statusBadge.className = piece.lit
    ? 'd2-drops__item-count d2-drops__item-count--lit'
    : 'd2-drops__item-count d2-drops__item-count--unlit'
  statusBadge.textContent = piece.lit ? `×${piece.count}` : tDrop('drop.tile.unlit', lang)
  topRow.appendChild(statusBadge)
  tile.appendChild(topRow)

  tile.appendChild(createSpriteBoxElement(doc, piece.spriteRect))

  const primaryNameEl = doc.createElement('div')
  primaryNameEl.className = 'd2-drops__item-name d2-drops__text--set'
  primaryNameEl.textContent = localName
  tile.appendChild(primaryNameEl)

  const metaEl = doc.createElement('div')
  metaEl.className = 'd2-drops__item-meta'
  metaEl.textContent = metaText
  tile.appendChild(metaEl)

  return tile
}

function createUniqueItemTile(
  doc: Document,
  item: DropGrailUniqueItemEntry,
  showTierBadge: boolean,
  lang: GameLang,
): HTMLElement {
  const isEn = lang === 'en'
  const localName = isEn ? item.name : item.nameZh
  const localBase = isEn ? item.baseName : item.baseNameZh
  const localTier = isEn ? item.tierLabelEn : item.tierLabelZh
  const metaText = `${localBase} (${item.code})`

  const tile = doc.createElement('div')
  tile.className = `d2-drops__item-tile d2-drops__item-tile--unique ${
    item.lit ? 'd2-drops__item-tile--lit' : 'd2-drops__item-tile--unlit'
  }`
  tile.setAttribute('data-item-code', item.code)
  tile.setAttribute('data-unique-index', item.index)
  tile.setAttribute('data-tier', item.tier)
  tile.setAttribute('data-lit', item.lit ? 'true' : 'false')
  tile.title = item.lit
    ? tDrop('drop.tile.tooltipLit', lang, {
        name: localName,
        meta: `${localBase} [${localTier}/${item.code}]`,
        count: item.count,
      })
    : tDrop('drop.tile.tooltipUnlit', lang, {
        name: localName,
        meta: `${localBase} [${localTier}/${item.code}]`,
      })

  const topRow = doc.createElement('div')
  topRow.className = 'd2-drops__tile-top'
  if (showTierBadge) {
    const tierBadge = doc.createElement('span')
    tierBadge.className = `d2-drops__tier-pill d2-drops__tier-pill--${item.tier}`
    tierBadge.textContent = localTier
    topRow.appendChild(tierBadge)
  } else {
    const codeBadge = doc.createElement('span')
    codeBadge.className = 'd2-drops__tile-code'
    codeBadge.textContent = item.code
    topRow.appendChild(codeBadge)
  }

  const statusBadge = doc.createElement('span')
  statusBadge.className = item.lit
    ? 'd2-drops__item-count d2-drops__item-count--lit'
    : 'd2-drops__item-count d2-drops__item-count--unlit'
  statusBadge.textContent = item.lit ? `×${item.count}` : tDrop('drop.tile.unlit', lang)
  topRow.appendChild(statusBadge)
  tile.appendChild(topRow)

  tile.appendChild(createSpriteBoxElement(doc, item.spriteRect))

  const primaryNameEl = doc.createElement('div')
  primaryNameEl.className = 'd2-drops__item-name d2-drops__text--unique'
  primaryNameEl.textContent = localName
  tile.appendChild(primaryNameEl)

  const metaEl = doc.createElement('div')
  metaEl.className = 'd2-drops__item-meta'
  metaEl.textContent = metaText
  tile.appendChild(metaEl)

  return tile
}

function createRuneTile(
  doc: Document,
  rune: DropGrailRuneEntry,
  lang: GameLang,
): HTMLElement {
  const isEn = lang === 'en'
  const numStr = `#${String(rune.runeNumber).padStart(2, '0')}`
  const localName = isEn ? rune.name : rune.nameZh

  const tile = doc.createElement('div')
  tile.className = `d2-drops__item-tile d2-drops__item-tile--rune ${
    rune.lit ? 'd2-drops__item-tile--lit' : 'd2-drops__item-tile--unlit'
  }`
  tile.setAttribute('data-item-code', rune.code)
  tile.setAttribute('data-rune-number', String(rune.runeNumber))
  tile.setAttribute('data-lit', rune.lit ? 'true' : 'false')
  tile.title = rune.lit
    ? tDrop('drop.tile.tooltipLit', lang, {
        name: `${numStr} ${localName}`,
        meta: rune.code,
        count: rune.count,
      })
    : tDrop('drop.tile.tooltipUnlit', lang, {
        name: `${numStr} ${localName}`,
        meta: rune.code,
      })

  const topRow = doc.createElement('div')
  topRow.className = 'd2-drops__tile-top'
  const numBadge = doc.createElement('span')
  numBadge.className = 'd2-drops__rune-num'
  numBadge.textContent = numStr
  topRow.appendChild(numBadge)

  const statusBadge = doc.createElement('span')
  statusBadge.className = rune.lit
    ? 'd2-drops__item-count d2-drops__item-count--lit'
    : 'd2-drops__item-count d2-drops__item-count--unlit'
  statusBadge.textContent = rune.lit ? `×${rune.count}` : tDrop('drop.tile.unlit', lang)
  topRow.appendChild(statusBadge)
  tile.appendChild(topRow)

  tile.appendChild(createSpriteBoxElement(doc, rune.spriteRect))

  const primaryNameEl = doc.createElement('div')
  primaryNameEl.className = 'd2-drops__item-name d2-drops__text--rune'
  primaryNameEl.textContent = localName
  tile.appendChild(primaryNameEl)

  const metaEl = doc.createElement('div')
  metaEl.className = 'd2-drops__item-meta'
  metaEl.textContent = rune.code
  tile.appendChild(metaEl)

  return tile
}

export function mountDropTrackerPage(
  container: HTMLElement,
  options: MountDropTrackerPageOptions = {},
): MountedDropTrackerPage {
  const doc = (container.ownerDocument ?? document) as Document
  const pageContext = options.pageContext ?? bootPluginPage(dropTrackerPlugin)
  const repository =
    options.repository ?? new IndexedDbDropStatsRepository({ hydrateSync: true })
  const tracker =
    options.tracker ??
    new DropTracker({
      repository,
    })

  let currentLang: GameLang = options.lang ?? pageContext.getLang()
  let activeFilter: 'all' | DropCategory = 'all'
  let grailStatusFilter: GrailStatusFilter = 'all'
  let searchQuery = ''
  let latestSummary: DropStatsSummary = tracker.getSummary()
  let latestCatalog = buildDropGrailCatalog(latestSummary.records)
  let catalogRecordsRef: readonly DropRecord[] = latestSummary.records
  let catalogRecordsLen = latestSummary.records.length
  let catalogLastId =
    latestSummary.records.length > 0
      ? (latestSummary.records[latestSummary.records.length - 1]?.id ?? -1)
      : -1

  const matchesStatusFilter = (lit: boolean): boolean => {
    if (grailStatusFilter === 'lit') return lit
    if (grailStatusFilter === 'unlit') return !lit
    return true
  }

  const filterRecords = (records: readonly DropRecord[]): DropRecord[] => {
    const q = searchQuery.trim().toLowerCase()
    return records.filter((r) => {
      if (activeFilter !== 'all' && r.category !== activeFilter) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.nameZh.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r.areaNameZh ?? '').toLowerCase().includes(q) ||
        (r.areaNameEn ?? '').toLowerCase().includes(q)
      )
    })
  }

  // Persistent DOM chrome constructed once per mount so keystrokes in #d2-drops-search
  // never destroy the input element, lose focus/IME state, or rebuild the sidebar/header.
  container.textContent = ''

  const shell = doc.createElement('div')
  shell.className = 'd2-drops-shell'

  // Sidebar
  const sidebar = doc.createElement('aside')
  sidebar.className = 'd2-drops__sidebar'

  const sidebarHeader = doc.createElement('div')
  sidebarHeader.className = 'd2-drops__sidebar-header'
  const titleEl = doc.createElement('h1')
  titleEl.id = 'd2-drops-page-title'
  titleEl.className = 'd2-drops__title'
  const subtitleEl = doc.createElement('div')
  subtitleEl.className = 'd2-drops__subtitle'
  sidebarHeader.appendChild(titleEl)
  sidebarHeader.appendChild(subtitleEl)
  sidebar.appendChild(sidebarHeader)

  const catTitle = doc.createElement('div')
  catTitle.className = 'd2-drops__sidebar-section-title'
  sidebar.appendChild(catTitle)

  const navDefs: ReadonlyArray<{
    readonly filter: 'all' | DropCategory
    readonly countId: string
    readonly countExtraClass: string
  }> = [
    { filter: 'all', countId: 'd2-drops-nav-all', countExtraClass: '' },
    { filter: 'set', countId: 'd2-drops-nav-set', countExtraClass: ' d2-drops__text--set' },
    { filter: 'unique', countId: 'd2-drops-nav-unique', countExtraClass: ' d2-drops__text--unique' },
    { filter: 'rune', countId: 'd2-drops-nav-rune', countExtraClass: ' d2-drops__text--rune' },
  ]

  const navBtnRefs: Array<{
    readonly filter: 'all' | DropCategory
    readonly btn: HTMLButtonElement
    readonly labelSpan: HTMLSpanElement
    readonly countSpan: HTMLSpanElement
  }> = []

  for (const def of navDefs) {
    const btn = doc.createElement('button')
    btn.type = 'button'
    btn.setAttribute('data-filter', def.filter)
    const labelSpan = doc.createElement('span')
    const countSpan = doc.createElement('span')
    countSpan.id = def.countId
    countSpan.className = `d2-drops__nav-count${def.countExtraClass}`
    btn.appendChild(labelSpan)
    btn.appendChild(countSpan)
    btn.addEventListener('click', () => {
      activeFilter = def.filter
      updateNavActiveStates()
      renderResults()
    })
    sidebar.appendChild(btn)
    navBtnRefs.push({ filter: def.filter, btn, labelSpan, countSpan })
  }

  const statusTitle = doc.createElement('div')
  statusTitle.className = 'd2-drops__sidebar-section-title'
  sidebar.appendChild(statusTitle)

  const statusDefs: ReadonlyArray<GrailStatusFilter> = ['all', 'lit', 'unlit']
  const statusBtnRefs: Array<{
    readonly status: GrailStatusFilter
    readonly btn: HTMLButtonElement
  }> = []

  for (const status of statusDefs) {
    const btn = doc.createElement('button')
    btn.type = 'button'
    btn.setAttribute('data-grail-status', status)
    btn.addEventListener('click', () => {
      grailStatusFilter = status
      updateNavActiveStates()
      renderResults()
    })
    sidebar.appendChild(btn)
    statusBtnRefs.push({ status, btn })
  }

  const actionsTitle = doc.createElement('div')
  actionsTitle.className = 'd2-drops__sidebar-section-title'
  sidebar.appendChild(actionsTitle)

  const actionsBox = doc.createElement('div')
  actionsBox.className = 'd2-drops__actions'

  const langToggleBtn = doc.createElement('button')
  langToggleBtn.type = 'button'
  langToggleBtn.id = 'd2-drops-lang-toggle'
  langToggleBtn.className = 'd2-drops__btn'
  langToggleBtn.addEventListener('click', () => {
    const nextLang: GameLang = currentLang === 'en' ? 'zh' : 'en'
    currentLang = nextLang
    pageContext.setLang(nextLang)
    render()
  })
  actionsBox.appendChild(langToggleBtn)

  const backLink = doc.createElement('a')
  backLink.className = 'd2-drops__btn'
  backLink.href = '/play.html'
  actionsBox.appendChild(backLink)

  const exportBtn = doc.createElement('button')
  exportBtn.type = 'button'
  exportBtn.id = 'd2-drops-export-btn'
  exportBtn.className = 'd2-drops__btn'
  exportBtn.addEventListener('click', () => {
    const json = tracker.exportJson()
    if (
      typeof Blob !== 'undefined' &&
      typeof URL !== 'undefined' &&
      typeof URL.createObjectURL === 'function'
    ) {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = doc.createElement('a')
      link.href = url
      link.download = `d2-drop-tracker-${Date.now()}.json`
      link.click()
      URL.revokeObjectURL(url)
    }
  })
  actionsBox.appendChild(exportBtn)

  const clearBtn = doc.createElement('button')
  clearBtn.type = 'button'
  clearBtn.id = 'd2-drops-clear-btn'
  clearBtn.className = 'd2-drops__btn d2-drops__btn--danger'
  clearBtn.addEventListener('click', () => {
    void tracker.clearAll().then(() => {
      render()
    })
  })
  actionsBox.appendChild(clearBtn)
  sidebar.appendChild(actionsBox)

  // Main content
  const main = doc.createElement('main')
  main.className = 'd2-drops__main'

  const summaryGrid = doc.createElement('section')
  summaryGrid.className = 'd2-drops__summary-grid'

  const cardDefs: ReadonlyArray<{
    readonly key: 'total' | 'set' | 'unique' | 'rune'
    readonly valId: string
    readonly subId: string
    readonly cardExtra: string
    readonly valExtra: string
  }> = [
    {
      key: 'total',
      valId: 'd2-drops-total-count',
      subId: 'd2-drops-total-grail',
      cardExtra: ' d2-drops__card--total',
      valExtra: '',
    },
    {
      key: 'set',
      valId: 'd2-drops-set-count',
      subId: 'd2-drops-set-grail',
      cardExtra: '',
      valExtra: ' d2-drops__text--set',
    },
    {
      key: 'unique',
      valId: 'd2-drops-unique-count',
      subId: 'd2-drops-unique-grail',
      cardExtra: '',
      valExtra: ' d2-drops__text--unique',
    },
    {
      key: 'rune',
      valId: 'd2-drops-rune-count',
      subId: 'd2-drops-rune-grail',
      cardExtra: '',
      valExtra: ' d2-drops__text--rune',
    },
  ]

  const summaryCardRefs: Array<{
    readonly key: 'total' | 'set' | 'unique' | 'rune'
    readonly lbl: HTMLElement
    readonly val: HTMLElement
    readonly sub: HTMLElement
  }> = []

  for (const cd of cardDefs) {
    const card = doc.createElement('div')
    card.className = `d2-drops__card${cd.cardExtra}`
    const lbl = doc.createElement('div')
    lbl.className = 'd2-drops__card-label'
    const val = doc.createElement('div')
    val.id = cd.valId
    val.className = `d2-drops__card-val${cd.valExtra}`
    const sub = doc.createElement('div')
    sub.id = cd.subId
    sub.className = 'd2-drops__card-sub'
    card.appendChild(lbl)
    card.appendChild(val)
    card.appendChild(sub)
    summaryGrid.appendChild(card)
    summaryCardRefs.push({ key: cd.key, lbl, val, sub })
  }
  main.appendChild(summaryGrid)

  // Controls
  const controls = doc.createElement('section')
  controls.className = 'd2-drops__controls'
  const searchInput = doc.createElement('input')
  searchInput.type = 'search'
  searchInput.id = 'd2-drops-search'
  searchInput.className = 'd2-drops__search-input'
  searchInput.value = searchQuery
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value
    renderResults()
  })
  const filterBadge = doc.createElement('span')
  filterBadge.className = 'd2-drops__section-badge'
  controls.appendChild(searchInput)
  controls.appendChild(filterBadge)
  main.appendChild(controls)

  const resultsContainer = doc.createElement('div')
  resultsContainer.className = 'd2-drops__results'
  resultsContainer.style.display = 'flex'
  resultsContainer.style.flexDirection = 'column'
  resultsContainer.style.gap = '18px'
  main.appendChild(resultsContainer)

  shell.appendChild(sidebar)
  shell.appendChild(main)
  container.appendChild(shell)

  const updateNavActiveStates = (): void => {
    for (const ref of navBtnRefs) {
      ref.btn.className =
        activeFilter === ref.filter
          ? 'd2-drops__nav-btn d2-drops__nav-btn--active'
          : 'd2-drops__nav-btn'
    }
    for (const sRef of statusBtnRefs) {
      sRef.btn.className =
        grailStatusFilter === sRef.status
          ? 'd2-drops__nav-btn d2-drops__nav-btn--active'
          : 'd2-drops__nav-btn'
    }
  }

  const updateChrome = (): void => {
    const isEn = currentLang === 'en'
    if (doc.documentElement) {
      doc.documentElement.lang = isEn ? 'en' : 'zh-CN'
      if (typeof doc.documentElement.setAttribute === 'function') {
        doc.documentElement.setAttribute('lang', isEn ? 'en' : 'zh-CN')
      }
    }
    doc.title = tDrop('drop.page.browserTitle', currentLang)

    titleEl.textContent = tDrop('drop.page.title', currentLang)
    subtitleEl.textContent = tDrop('drop.page.subtitle', currentLang)
    catTitle.textContent = tDrop('drop.sidebar.categories', currentLang)

    for (const ref of navBtnRefs) {
      if (ref.filter === 'all') {
        ref.labelSpan.textContent = tDrop('drop.filter.all', currentLang)
        ref.countSpan.textContent = String(latestSummary.totalTracked)
      } else if (ref.filter === 'set') {
        ref.labelSpan.textContent = tDrop('drop.filter.set', currentLang)
        ref.countSpan.textContent = String(latestSummary.setCount)
      } else if (ref.filter === 'unique') {
        ref.labelSpan.textContent = tDrop('drop.filter.unique', currentLang)
        ref.countSpan.textContent = String(latestSummary.uniqueCount)
      } else {
        ref.labelSpan.textContent = tDrop('drop.filter.rune', currentLang)
        ref.countSpan.textContent = String(latestSummary.runeCount)
      }
    }

    statusTitle.textContent = tDrop('drop.sidebar.statusFilter', currentLang)
    for (const sRef of statusBtnRefs) {
      if (sRef.status === 'all') {
        sRef.btn.textContent = tDrop('drop.statusFilter.all', currentLang)
      } else if (sRef.status === 'lit') {
        sRef.btn.textContent = tDrop('drop.statusFilter.lit', currentLang)
      } else {
        sRef.btn.textContent = tDrop('drop.statusFilter.unlit', currentLang)
      }
    }
    updateNavActiveStates()

    actionsTitle.textContent = tDrop('drop.sidebar.actions', currentLang)
    langToggleBtn.textContent = tDrop('drop.filter.langToggle', currentLang)
    backLink.textContent = tDrop('drop.action.backToGame', currentLang)
    exportBtn.textContent = tDrop('drop.action.exportJson', currentLang)
    clearBtn.textContent = tDrop('drop.action.clearAll', currentLang)

    const catalog = latestCatalog
    const totalLitAll = catalog.litSetPieces + catalog.litUniqueItems + catalog.litRunes
    const totalGrailAll = catalog.totalSetPieces + catalog.totalUniqueItems + catalog.totalRunes

    for (const cRef of summaryCardRefs) {
      if (cRef.key === 'total') {
        cRef.lbl.textContent = tDrop('drop.summary.totalLabel', currentLang)
        cRef.val.textContent = String(latestSummary.totalTracked)
        cRef.sub.textContent = tDrop('drop.summary.totalSub', currentLang, {
          lit: totalLitAll,
          total: totalGrailAll,
        })
      } else if (cRef.key === 'set') {
        cRef.lbl.textContent = tDrop('drop.summary.setLabel', currentLang)
        cRef.val.textContent = String(latestSummary.setCount)
        cRef.sub.textContent = tDrop('drop.summary.setSub', currentLang, {
          lit: catalog.litSetPieces,
          total: catalog.totalSetPieces,
          completedSets: catalog.completedSets,
          totalSets: catalog.totalSets,
        })
      } else if (cRef.key === 'unique') {
        cRef.lbl.textContent = tDrop('drop.summary.uniqueLabel', currentLang)
        cRef.val.textContent = String(latestSummary.uniqueCount)
        cRef.sub.textContent = tDrop('drop.summary.uniqueSub', currentLang, {
          lit: catalog.litUniqueItems,
          total: catalog.totalUniqueItems,
        })
      } else {
        cRef.lbl.textContent = tDrop('drop.summary.runeLabel', currentLang)
        cRef.val.textContent = String(latestSummary.runeCount)
        cRef.sub.textContent = tDrop('drop.summary.runeSub', currentLang, {
          lit: catalog.litRunes,
          total: catalog.totalRunes,
        })
      }
    }

    searchInput.placeholder = tDrop('drop.search.placeholder', currentLang)
    if (searchInput.value !== searchQuery) {
      searchInput.value = searchQuery
    }
  }

  const renderResults = (): void => {
    const isEn = currentLang === 'en'
    const filtered = filterRecords(latestSummary.records)
    const catalog = latestCatalog
    const q = searchQuery.trim().toLowerCase()

    filterBadge.textContent = tDrop('drop.search.filteredBadge', currentLang, {
      count: filtered.length,
    })

    resultsContainer.textContent = ''

    // 1. Set Items Light-Up Section
    if (activeFilter === 'all' || activeFilter === 'set') {
      const setsSec = doc.createElement('section')
      setsSec.id = 'd2-drops-sets-section'
      setsSec.className = 'd2-drops__section'

      const setsHeader = doc.createElement('div')
      setsHeader.className = 'd2-drops__section-header'
      const setsTitle = doc.createElement('h2')
      setsTitle.className = 'd2-drops__section-title d2-drops__text--set'
      setsTitle.textContent = tDrop('drop.section.setsTitle', currentLang)
      const setsBadge = doc.createElement('span')
      setsBadge.className = 'd2-drops__section-badge'
      setsBadge.textContent = tDrop('drop.section.setsBadge', currentLang, {
        lit: catalog.litSetPieces,
        total: catalog.totalSetPieces,
        completedSets: catalog.completedSets,
        totalSets: catalog.totalSets,
      })
      setsHeader.appendChild(setsTitle)
      setsHeader.appendChild(setsBadge)
      setsSec.appendChild(setsHeader)

      const setsGrid = doc.createElement('div')
      setsGrid.className = 'd2-drops__sets-grid'

      let renderedSets = 0
      for (const setGroup of catalog.sets) {
        const setMatchesQuery =
          !q ||
          setGroup.nameZh.toLowerCase().includes(q) ||
          setGroup.name.toLowerCase().includes(q) ||
          setGroup.index.toLowerCase().includes(q)

        const visiblePieces = setGroup.pieces.filter((p) => {
          if (!matchesStatusFilter(p.lit)) return false
          if (setMatchesQuery) return true
          return (
            p.nameZh.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q) ||
            p.baseNameZh.toLowerCase().includes(q) ||
            p.baseName.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q)
          )
        })

        if (visiblePieces.length === 0) continue
        renderedSets += 1

        const setCard = doc.createElement('div')
        const stateCls = setGroup.completed
          ? ' d2-drops__set-card--completed'
          : setGroup.litPieces > 0
            ? ' d2-drops__set-card--partial'
            : ''
        setCard.className = `d2-drops__set-card${stateCls}`
        setCard.setAttribute('data-set-index', setGroup.index)
        setCard.setAttribute('data-set-lit', String(setGroup.litPieces))
        setCard.setAttribute('data-set-total', String(setGroup.totalPieces))

        const cardHeader = doc.createElement('div')
        cardHeader.className = 'd2-drops__set-header'
        const titleWrap = doc.createElement('div')
        titleWrap.className = 'd2-drops__set-title'
        const primarySpan = doc.createElement('span')
        primarySpan.className = 'd2-drops__entity-name d2-drops__text--set'
        primarySpan.textContent = isEn ? setGroup.name : setGroup.nameZh
        titleWrap.appendChild(primarySpan)

        const progBadge = doc.createElement('span')
        progBadge.className = 'd2-drops__set-progress'
        progBadge.textContent = tDrop('drop.section.groupLitProgress', currentLang, {
          lit: setGroup.litPieces,
          total: setGroup.totalPieces,
        })
        cardHeader.appendChild(titleWrap)
        cardHeader.appendChild(progBadge)
        setCard.appendChild(cardHeader)

        const piecesWrap = doc.createElement('div')
        piecesWrap.className = 'd2-drops__set-pieces'
        for (const piece of visiblePieces) {
          piecesWrap.appendChild(createSetPieceTile(doc, piece, currentLang))
        }
        setCard.appendChild(piecesWrap)
        setsGrid.appendChild(setCard)
      }

      if (renderedSets === 0) {
        const emptyEl = doc.createElement('div')
        emptyEl.className = 'd2-drops__table-empty'
        emptyEl.textContent = tDrop('drop.empty.sets', currentLang)
        setsSec.appendChild(emptyEl)
      } else {
        setsSec.appendChild(setsGrid)
      }
      resultsContainer.appendChild(setsSec)
    }

    // 2. Unique Items Light-Up Section
    if (activeFilter === 'all' || activeFilter === 'unique') {
      const uniquesSec = doc.createElement('section')
      uniquesSec.id = 'd2-drops-uniques-section'
      uniquesSec.className = 'd2-drops__section'

      const uniquesHeader = doc.createElement('div')
      uniquesHeader.className = 'd2-drops__section-header'
      const uniquesTitle = doc.createElement('h2')
      uniquesTitle.className = 'd2-drops__section-title d2-drops__text--unique'
      uniquesTitle.textContent = tDrop('drop.section.uniquesTitle', currentLang)
      const uniquesBadge = doc.createElement('span')
      uniquesBadge.className = 'd2-drops__section-badge'
      uniquesBadge.textContent = tDrop('drop.section.uniquesBadge', currentLang, {
        lit: catalog.litUniqueItems,
        total: catalog.totalUniqueItems,
      })
      uniquesHeader.appendChild(uniquesTitle)
      uniquesHeader.appendChild(uniquesBadge)
      uniquesSec.appendChild(uniquesHeader)

      const groupsContainer = doc.createElement('div')
      groupsContainer.className = 'd2-drops__unique-groups'

      let renderedGroups = 0
      const tierDefinitions: ReadonlyArray<{
        readonly tier: DropEquipmentTier
        readonly i18nKey: 'drop.tier.normal' | 'drop.tier.exceptional' | 'drop.tier.elite'
      }> = [
        { tier: 'normal', i18nKey: 'drop.tier.normal' },
        { tier: 'exceptional', i18nKey: 'drop.tier.exceptional' },
        { tier: 'elite', i18nKey: 'drop.tier.elite' },
      ]

      for (const ug of catalog.uniqueGroups) {
        const groupMatchesQuery =
          !q ||
          ug.typeNameZh.toLowerCase().includes(q) ||
          ug.typeNameEn.toLowerCase().includes(q) ||
          ug.baseType.toLowerCase().includes(q)

        const visibleItems = ug.items.filter((u) => {
          if (!matchesStatusFilter(u.lit)) return false
          if (groupMatchesQuery) return true
          return (
            u.nameZh.toLowerCase().includes(q) ||
            u.name.toLowerCase().includes(q) ||
            u.baseNameZh.toLowerCase().includes(q) ||
            u.baseName.toLowerCase().includes(q) ||
            u.code.toLowerCase().includes(q) ||
            u.tierLabelZh.includes(q) ||
            u.tierLabelEn.toLowerCase().includes(q)
          )
        })

        if (visibleItems.length === 0) continue
        renderedGroups += 1

        const groupCard = doc.createElement('div')
        groupCard.className = 'd2-drops__type-group'
        groupCard.setAttribute('data-base-type', ug.baseType)
        groupCard.setAttribute('data-type-lit', String(ug.litItems))
        groupCard.setAttribute('data-type-total', String(ug.totalItems))

        const groupHeader = doc.createElement('div')
        groupHeader.className = 'd2-drops__type-header'
        const groupTitle = doc.createElement('div')
        groupTitle.className = 'd2-drops__type-title'
        const primarySpan = doc.createElement('span')
        primarySpan.className = 'd2-drops__entity-name d2-drops__text--unique'
        primarySpan.textContent = isEn ? ug.typeNameEn : ug.typeNameZh
        groupTitle.appendChild(primarySpan)

        const progBadge = doc.createElement('span')
        progBadge.className = 'd2-drops__section-badge'
        progBadge.textContent = tDrop('drop.section.groupLitProgress', currentLang, {
          lit: ug.litItems,
          total: ug.totalItems,
        })
        groupHeader.appendChild(groupTitle)
        groupHeader.appendChild(progBadge)
        groupCard.appendChild(groupHeader)

        if (ug.hasEquipmentTiers) {
          for (const td of tierDefinitions) {
            const tierItems = visibleItems.filter((item) => item.tier === td.tier)
            if (tierItems.length === 0) continue

            const tierBand = doc.createElement('div')
            tierBand.className = 'd2-drops__tier-band'
            tierBand.setAttribute('data-tier', td.tier)

            const tierHeader = doc.createElement('div')
            tierHeader.className = 'd2-drops__tier-header'
            const tierBadge = doc.createElement('span')
            tierBadge.className = `d2-drops__tier-badge d2-drops__tier-badge--${td.tier}`
            tierBadge.textContent = tDrop(td.i18nKey, currentLang)
            tierHeader.appendChild(tierBadge)
            tierBand.appendChild(tierHeader)

            const itemsGrid = doc.createElement('div')
            itemsGrid.className = 'd2-drops__items-grid'
            for (const item of tierItems) {
              itemsGrid.appendChild(createUniqueItemTile(doc, item, true, currentLang))
            }
            tierBand.appendChild(itemsGrid)
            groupCard.appendChild(tierBand)
          }
        } else {
          const itemsGrid = doc.createElement('div')
          itemsGrid.className = 'd2-drops__items-grid'
          for (const item of visibleItems) {
            itemsGrid.appendChild(createUniqueItemTile(doc, item, false, currentLang))
          }
          groupCard.appendChild(itemsGrid)
        }

        groupsContainer.appendChild(groupCard)
      }

      if (renderedGroups === 0) {
        const emptyEl = doc.createElement('div')
        emptyEl.className = 'd2-drops__table-empty'
        emptyEl.textContent = tDrop('drop.empty.uniques', currentLang)
        uniquesSec.appendChild(emptyEl)
      } else {
        uniquesSec.appendChild(groupsContainer)
      }
      resultsContainer.appendChild(uniquesSec)
    }

    // 3. Runes Light-Up Section
    if (activeFilter === 'all' || activeFilter === 'rune') {
      const runesSec = doc.createElement('section')
      runesSec.id = 'd2-drops-runes-section'
      runesSec.className = 'd2-drops__section'

      const runesHeader = doc.createElement('div')
      runesHeader.className = 'd2-drops__section-header'
      const runesTitle = doc.createElement('h2')
      runesTitle.className = 'd2-drops__section-title d2-drops__text--rune'
      runesTitle.textContent = tDrop('drop.section.runesTitle', currentLang)
      const runesBadge = doc.createElement('span')
      runesBadge.className = 'd2-drops__section-badge'
      runesBadge.textContent = tDrop('drop.section.runesBadge', currentLang, {
        lit: catalog.litRunes,
        total: catalog.totalRunes,
      })
      runesHeader.appendChild(runesTitle)
      runesHeader.appendChild(runesBadge)
      runesSec.appendChild(runesHeader)

      const visibleRunes = catalog.runes.filter((r) => {
        if (!matchesStatusFilter(r.lit)) return false
        if (!q) return true
        const numStr = String(r.runeNumber)
        const paddedNum = numStr.padStart(2, '0')
        return (
          r.nameZh.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          numStr === q ||
          `#${numStr}` === q ||
          `#${paddedNum}` === q
        )
      })

      if (visibleRunes.length === 0) {
        const emptyEl = doc.createElement('div')
        emptyEl.className = 'd2-drops__table-empty'
        emptyEl.textContent = tDrop('drop.empty.runes', currentLang)
        runesSec.appendChild(emptyEl)
      } else {
        const runesGrid = doc.createElement('div')
        runesGrid.className = 'd2-drops__runes-grid'
        for (const rune of visibleRunes) {
          runesGrid.appendChild(createRuneTile(doc, rune, currentLang))
        }
        runesSec.appendChild(runesGrid)
      }
      resultsContainer.appendChild(runesSec)
    }

    // 4. Chronological Drop Log
    const historySec = doc.createElement('section')
    historySec.className = 'd2-drops__section'
    const historyHeader = doc.createElement('div')
    historyHeader.className = 'd2-drops__section-header'
    const historyTitle = doc.createElement('h2')
    historyTitle.className = 'd2-drops__section-title'
    historyTitle.textContent = tDrop('drop.section.historyTitle', currentLang)
    const historyCountBadge = doc.createElement('span')
    historyCountBadge.className = 'd2-drops__section-badge'
    historyCountBadge.textContent = tDrop('drop.section.historyBadge', currentLang, {
      count: filtered.length,
    })
    historyHeader.appendChild(historyTitle)
    historyHeader.appendChild(historyCountBadge)
    historySec.appendChild(historyHeader)

    const historyWrap = doc.createElement('div')
    historyWrap.className = 'd2-drops__table-wrap'
    const historyTable = doc.createElement('table')
    historyTable.id = 'd2-drops-history-table'
    historyTable.className = 'd2-drops__table'

    const historyThead = doc.createElement('thead')
    const headTr = doc.createElement('tr')
    const headCols = [
      tDrop('drop.history.col.time', currentLang),
      tDrop('drop.history.col.category', currentLang),
      tDrop('drop.history.col.name', currentLang),
      tDrop('drop.history.col.code', currentLang),
      tDrop('drop.history.col.area', currentLang),
    ]
    for (const colText of headCols) {
      const th = doc.createElement('th')
      th.textContent = colText
      headTr.appendChild(th)
    }
    historyThead.appendChild(headTr)
    historyTable.appendChild(historyThead)

    const historyTbody = doc.createElement('tbody')
    if (filtered.length === 0) {
      const tr = doc.createElement('tr')
      const td = doc.createElement('td')
      td.colSpan = 5
      td.className = 'd2-drops__table-empty'
      td.textContent = tDrop('drop.empty.history', currentLang)
      tr.appendChild(td)
      historyTbody.appendChild(tr)
    } else {
      for (const rec of filtered) {
        const tr = doc.createElement('tr')
        const tdTime = doc.createElement('td')
        tdTime.textContent = formatTimestamp(rec.timestamp)
        const tdCat = doc.createElement('td')
        tdCat.appendChild(createCategoryBadge(doc, rec.category, currentLang))
        const tdName = doc.createElement('td')
        const primaryNameSpan = doc.createElement('span')
        primaryNameSpan.className = `d2-drops__entity-name d2-drops__text--${rec.category}`
        primaryNameSpan.textContent = isEn ? rec.name : rec.nameZh
        tdName.appendChild(primaryNameSpan)
        const tdCode = doc.createElement('td')
        tdCode.textContent = rec.code
        const tdArea = doc.createElement('td')
        tdArea.textContent = isEn
          ? (rec.areaNameEn ?? tDrop('drop.history.unknownArea', currentLang))
          : (rec.areaNameZh ?? tDrop('drop.history.unknownArea', currentLang))
        tr.appendChild(tdTime)
        tr.appendChild(tdCat)
        tr.appendChild(tdName)
        tr.appendChild(tdCode)
        tr.appendChild(tdArea)
        historyTbody.appendChild(tr)
      }
    }
    historyTable.appendChild(historyTbody)
    historyWrap.appendChild(historyTable)
    historySec.appendChild(historyWrap)
    resultsContainer.appendChild(historySec)
  }

  const render = (): void => {
    latestSummary = tracker.getSummary()
    const recs = latestSummary.records
    const lastId = recs.length > 0 ? (recs[recs.length - 1]?.id ?? -1) : -1
    if (
      recs !== catalogRecordsRef ||
      recs.length !== catalogRecordsLen ||
      lastId !== catalogLastId
    ) {
      latestCatalog = buildDropGrailCatalog(recs)
      catalogRecordsRef = recs
      catalogRecordsLen = recs.length
      catalogLastId = lastId
    }
    updateChrome()
    renderResults()
  }

  render()
  const unsubTracker = tracker.subscribe(() => {
    render()
  })
  const unsubLang = pageContext.subscribeLang((nextLang) => {
    if (nextLang !== currentLang) {
      currentLang = nextLang
      render()
    }
  })
  void tracker.init()

  return {
    tracker,
    getLang(): GameLang {
      return currentLang
    },
    setLang(nextLang: GameLang): void {
      currentLang = nextLang
      pageContext.setLang(nextLang)
      render()
    },
    render,
    destroy(): void {
      unsubTracker()
      unsubLang()
      if (!options.pageContext) {
        pageContext.destroy()
      }
      if (!options.tracker) {
        tracker.destroy()
      }
    },
  }
}

if (typeof document !== 'undefined') {
  const appEl = document.getElementById('d2-drops-app')
  if (appEl) {
    mountDropTrackerPage(appEl)
  }
}
