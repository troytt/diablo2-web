/**
 * DOM controller and interactive UI for `plugins/kill-stats/index.html`.
 *
 * Security & Fidelity Invariants:
 * - All user/server/file strings are rendered exclusively via `textContent` (never `innerHTML`).
 * - Synchronizes language (`zh` / `en`) and plugin enabled state via `bootPluginPage(killStatsPlugin)`.
 * - Subscribes to `BroadcastChannel('d2web-kill-stats')` with 300ms debounced auto-refresh.
 * - Displays `role="alert"` error banners on IndexedDB errors or `KillStatsImportError` violations.
 */

import {
  bootPluginPage,
  type GameLang,
  type PluginPageContext,
} from '../../src/client/plugin-host/api.ts'
import { killStatsPlugin } from './index.ts'
import {
  KILL_STATS_CHANNEL_NAME,
  KillStatsImportError,
  type KillStatsImportSummary,
  type KillStatsSnapshot,
} from './kill-stats-model.ts'
import {
  IndexedDbKillStatsRepository,
  type KillStatsRepository,
} from './kill-stats-store.ts'
import {
  buildKillStatsViewModel,
  computeAccountKey,
  type KillStatsCharacterNode,
  type KillStatsScope,
  type KillStatsViewModel,
  type MonsterSortColumn,
  type MonsterTableSort,
} from './kill-stats-view.ts'
import { tStats } from './stats-i18n.ts'

export interface KillStatsPageOptions {
  readonly root: HTMLElement
  readonly repository?: KillStatsRepository | undefined
  readonly pageContext?: PluginPageContext | undefined
  readonly confirmFn?: ((message: string) => boolean) | undefined
  readonly refreshDebounceMs?: number | undefined
}

interface BuiltDomRefs {
  readonly pageTitleEl: HTMLElement
  readonly backToGameLink: HTMLAnchorElement
  readonly sidebarTitleEl: HTMLElement
  readonly allAccountsBtn: HTMLButtonElement
  readonly allAccountsLabelEl: HTMLElement
  readonly allAccountsCountEl: HTMLElement
  readonly accountTreeEl: HTMLElement
  readonly disabledNoticeEl: HTMLElement
  readonly errorBannerEl: HTMLElement
  readonly infoBannerEl: HTMLElement
  readonly cardNormalLabelEl: HTMLElement
  readonly cardNormalValEl: HTMLElement
  readonly cardNightmareLabelEl: HTMLElement
  readonly cardNightmareValEl: HTMLElement
  readonly cardHellLabelEl: HTMLElement
  readonly cardHellValEl: HTMLElement
  readonly cardTotalLabelEl: HTMLElement
  readonly cardTotalValEl: HTMLElement
  readonly soloOnlyInput: HTMLInputElement
  readonly soloOnlyLabelEl: HTMLElement
  readonly showUnkilledInput: HTMLInputElement
  readonly showUnkilledLabelEl: HTMLElement
  readonly langToggleBtn: HTMLButtonElement
  readonly exportBtn: HTMLButtonElement
  readonly importBtn: HTMLButtonElement
  readonly importInput: HTMLInputElement
  readonly deleteCharBtn: HTMLButtonElement
  readonly clearAllBtn: HTMLButtonElement
  readonly emptyStateEl: HTMLElement
  readonly emptyStateTitleEl: HTMLElement
  readonly emptyStateBodyEl: HTMLElement
  readonly boardTitleEl: HTMLElement
  readonly boardSubtitleEl: HTMLElement
  readonly boardCountBadgeEl: HTMLElement
  readonly boardColNameEl: HTMLElement
  readonly boardColKindEl: HTMLElement
  readonly boardColNormalEl: HTMLElement
  readonly boardColNightmareEl: HTMLElement
  readonly boardColHellEl: HTMLElement
  readonly boardColTotalEl: HTMLElement
  readonly boardColLastAtEl: HTMLElement
  readonly boardTbodyEl: HTMLTableSectionElement
  readonly monstersTitleEl: HTMLElement
  readonly monstersCountBadgeEl: HTMLElement
  readonly monsterSearchInput: HTMLInputElement
  readonly monstersColHcIdxBtn: HTMLButtonElement
  readonly monstersColNameBtn: HTMLButtonElement
  readonly monstersColNormalBtn: HTMLButtonElement
  readonly monstersColNightmareBtn: HTMLButtonElement
  readonly monstersColHellBtn: HTMLButtonElement
  readonly monstersColTotalBtn: HTMLButtonElement
  readonly monstersTbodyEl: HTMLTableSectionElement
  readonly footnoteEl: HTMLElement
}

function formatTimestamp(ms: number | null, lang: GameLang): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) {
    return '—'
  }
  try {
    const d = new Date(ms)
    return d.toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return String(ms)
  }
}

export class KillStatsPage {
  readonly repository: KillStatsRepository
  private readonly root: HTMLElement
  private readonly doc: Document
  private readonly pageContext: PluginPageContext
  private readonly confirmFn: (message: string) => boolean
  private readonly refreshDebounceMs: number
  private readonly dom: BuiltDomRefs

  private snapshot: KillStatsSnapshot = {
    replicaId: '',
    characters: [],
    tallies: [],
  }
  private scope: KillStatsScope = { kind: 'all' }
  private soloOnly = false
  private showUnkilled = true
  private lang: GameLang
  private monsterSearch = ''
  private monsterSort: MonsterTableSort = {
    column: 'total',
    direction: 'desc',
  }
  private lastViewModel: KillStatsViewModel | null = null
  private lastExportJson: string | null = null
  private errorMessage: string | null = null
  private infoMessage: string | null = null

  private channel: BroadcastChannel | null = null
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  private unsubLang: (() => void) | null = null
  private unsubEnabled: (() => void) | null = null

  constructor(options: KillStatsPageOptions) {
    this.root = options.root
    this.doc = options.root.ownerDocument
    this.pageContext = options.pageContext ?? bootPluginPage(killStatsPlugin)
    this.lang = this.pageContext.getLang()
    this.confirmFn =
      options.confirmFn ??
      ((msg: string) =>
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(msg)
          : true)
    this.refreshDebounceMs = options.refreshDebounceMs ?? 300

    this.repository =
      options.repository ??
      new IndexedDbKillStatsRepository({
        onBlocked: () => {
          this.showError(tStats('stats.error.idbBlocked', this.lang))
        },
        onVersionChange: () => {
          this.showError(tStats('stats.error.idbVersionChange', this.lang))
        },
      })

    this.dom = this.mountDom()
    this.bindEvents()
  }

  async init(): Promise<void> {
    this.setupBroadcastChannel()
    this.unsubLang = this.pageContext.subscribeLang((nextLang) => {
      if (nextLang !== this.lang) {
        this.lang = nextLang
        this.render()
      }
    })
    this.unsubEnabled = this.pageContext.subscribeEnabled(() => {
      this.render()
    })
    await this.refresh({ rethrow: true })
  }

  destroy(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
    this.unsubLang?.()
    this.unsubLang = null
    this.unsubEnabled?.()
    this.unsubEnabled = null
    this.pageContext.destroy()
    try {
      this.channel?.close()
    } catch {
      // Ignore BroadcastChannel close errors
    }
    this.channel = null
    this.repository.close?.()
  }

  getViewModel(): KillStatsViewModel | null {
    return this.lastViewModel
  }

  getLastExportJson(): string | null {
    return this.lastExportJson
  }

  private setupBroadcastChannel(): void {
    if (typeof globalThis.BroadcastChannel !== 'function') {
      return
    }
    try {
      this.channel = new globalThis.BroadcastChannel(KILL_STATS_CHANNEL_NAME)
      this.channel.onmessage = (ev: MessageEvent) => {
        const data = ev.data as { type?: unknown } | null
        if (data && data.type === 'updated') {
          this.scheduleDebouncedRefresh()
        }
      }
    } catch {
      this.channel = null
    }
  }

  private broadcastUpdated(): void {
    try {
      this.channel?.postMessage({ type: 'updated', at: Date.now() })
    } catch {
      // Ignore broadcast errors
    }
  }

  private scheduleDebouncedRefresh(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer)
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null
      void this.refresh()
    }, this.refreshDebounceMs)
  }

  async refresh(options?: { readonly rethrow?: boolean }): Promise<void> {
    try {
      this.snapshot = await this.repository.loadAll()
      this.render()
    } catch (err) {
      console.error('[kill-stats] Failed to load kill stats snapshot:', err)
      const detail = err instanceof Error ? err.message : String(err)
      this.showError(`${tStats('stats.error.idbUnavailable', this.lang)} (${detail})`)
      this.render()
      if (options?.rethrow) {
        throw err
      }
    }
  }

  showError(message: string): void {
    this.errorMessage = message
    this.dom.errorBannerEl.textContent = message
    this.dom.errorBannerEl.hidden = false
  }

  clearError(): void {
    this.errorMessage = null
    this.dom.errorBannerEl.textContent = ''
    this.dom.errorBannerEl.hidden = true
  }

  private showInfo(message: string): void {
    this.infoMessage = message
    this.dom.infoBannerEl.textContent = message
    this.dom.infoBannerEl.hidden = false
  }

  private clearInfo(): void {
    this.infoMessage = null
    this.dom.infoBannerEl.textContent = ''
    this.dom.infoBannerEl.hidden = true
  }

  private resolveTargetDeleteCharKey(vm: KillStatsViewModel): string | null {
    if (vm.selectedCharacter) {
      return vm.selectedCharacter.charKey
    }
    if (vm.scope.kind === 'account') {
      const acctKey = computeAccountKey(
        vm.scope.host,
        vm.scope.realm,
        vm.scope.account,
      )
      const acct = vm.accounts.find((a) => a.accountKey === acctKey)
      if (acct && acct.characters.length === 1) {
        return acct.characters[0]!.charKey
      }
      return null
    }
    if (this.snapshot.characters.length === 1) {
      return this.snapshot.characters[0]!.charKey
    }
    return null
  }

  async handleExportJson(): Promise<string> {
    this.clearError()
    const payload = await this.repository.exportPayload()
    const json = JSON.stringify(payload, null, 2)
    this.lastExportJson = json
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __d2LastExportedKillStatsJson?: string }).__d2LastExportedKillStatsJson =
        json
    }

    if (
      typeof Blob !== 'undefined' &&
      typeof URL !== 'undefined' &&
      typeof URL.createObjectURL === 'function'
    ) {
      try {
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = this.doc.createElement('a')
        a.href = url
        a.download = `d2web-kill-stats-${payload.exportedAt}.json`
        a.style.display = 'none'
        this.doc.body.appendChild(a)
        a.click()
        this.doc.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } catch {
        // Ignore download anchor errors in headless test environments
      }
    }
    return json
  }

  async handleImportJsonText(rawText: string): Promise<KillStatsImportSummary | null> {
    this.clearError()
    this.clearInfo()
    try {
      const summary = await this.repository.importPayload(rawText)
      await this.refresh()
      this.broadcastUpdated()
      const summaryText = tStats('stats.import.successDetail', this.lang, {
        addedChars: summary.addedCharacters,
        updatedChars: summary.updatedCharacters,
        addedTallies: summary.addedTallies,
        updatedTallies: summary.updatedTallies,
        unchangedTallies: summary.unchangedTallies,
      })
      this.showInfo(summaryText)
      return summary
    } catch (err) {
      if (err instanceof KillStatsImportError) {
        this.showError(
          `${tStats('stats.error.importFailedPrefix', this.lang)}${err.path} — ${err.message}`,
        )
      } else {
        const detail = err instanceof Error ? err.message : String(err)
        this.showError(`${tStats('stats.error.importFailedPrefix', this.lang)}${detail}`)
      }
      return null
    }
  }

  async handleDeleteSelectedCharacter(): Promise<boolean> {
    const vm =
      this.lastViewModel ??
      buildKillStatsViewModel(this.snapshot, {
        scope: this.scope,
        soloOnly: this.soloOnly,
        showUnkilled: this.showUnkilled,
        lang: this.lang,
        monsterSearch: this.monsterSearch,
        monsterSort: this.monsterSort,
      })
    const targetCharKey = this.resolveTargetDeleteCharKey(vm)
    if (!targetCharKey) {
      return false
    }
    const confirmed = this.confirmFn(tStats('stats.confirm.deleteCharacter', this.lang))
    if (!confirmed) {
      return false
    }
    this.clearError()
    this.clearInfo()
    try {
      await this.repository.deleteCharacter(targetCharKey)
      if (this.scope.kind === 'character' && this.scope.charKey === targetCharKey) {
        this.scope = { kind: 'all' }
      }
      await this.refresh()
      this.broadcastUpdated()
      return true
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      this.showError(detail)
      return false
    }
  }

  async handleClearAll(): Promise<boolean> {
    const confirmed = this.confirmFn(tStats('stats.confirm.clearAll', this.lang))
    if (!confirmed) {
      return false
    }
    this.clearError()
    this.clearInfo()
    try {
      await this.repository.clearAll()
      this.scope = { kind: 'all' }
      await this.refresh()
      this.broadcastUpdated()
      return true
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      this.showError(detail)
      return false
    }
  }

  toggleLanguage(): GameLang {
    const nextLang: GameLang = this.lang === 'en' ? 'zh' : 'en'
    this.lang = nextLang
    this.pageContext.setLang(nextLang)
    this.render()
    return nextLang
  }

  private bindEvents(): void {
    this.dom.allAccountsBtn.addEventListener('click', () => {
      this.scope = { kind: 'all' }
      this.render()
    })

    this.dom.soloOnlyInput.addEventListener('change', () => {
      this.soloOnly = this.dom.soloOnlyInput.checked
      this.render()
    })

    this.dom.showUnkilledInput.addEventListener('change', () => {
      this.showUnkilled = this.dom.showUnkilledInput.checked
      this.render()
    })

    this.dom.langToggleBtn.addEventListener('click', () => {
      this.toggleLanguage()
    })

    this.dom.exportBtn.addEventListener('click', () => {
      void this.handleExportJson()
    })

    this.dom.importBtn.addEventListener('click', () => {
      this.dom.importInput.value = ''
      this.dom.importInput.click()
    })

    this.dom.importInput.addEventListener('change', () => {
      const file = this.dom.importInput.files?.[0]
      if (!file) return
      void file.text().then((text) => {
        void this.handleImportJsonText(text)
      })
    })

    this.dom.deleteCharBtn.addEventListener('click', () => {
      void this.handleDeleteSelectedCharacter()
    })

    this.dom.clearAllBtn.addEventListener('click', () => {
      void this.handleClearAll()
    })

    this.dom.monsterSearchInput.addEventListener('input', () => {
      this.monsterSearch = this.dom.monsterSearchInput.value
      this.render()
    })

    const bindSortBtn = (btn: HTMLButtonElement, column: MonsterSortColumn): void => {
      btn.addEventListener('click', () => {
        if (this.monsterSort.column === column) {
          this.monsterSort = {
            column,
            direction: this.monsterSort.direction === 'asc' ? 'desc' : 'asc',
          }
        } else {
          this.monsterSort = {
            column,
            direction: column === 'hcIdx' || column === 'name' ? 'asc' : 'desc',
          }
        }
        this.render()
      })
    }

    bindSortBtn(this.dom.monstersColHcIdxBtn, 'hcIdx')
    bindSortBtn(this.dom.monstersColNameBtn, 'name')
    bindSortBtn(this.dom.monstersColNormalBtn, 'normal')
    bindSortBtn(this.dom.monstersColNightmareBtn, 'nightmare')
    bindSortBtn(this.dom.monstersColHellBtn, 'hell')
    bindSortBtn(this.dom.monstersColTotalBtn, 'total')
  }

  render(): void {
    const vm = buildKillStatsViewModel(this.snapshot, {
      scope: this.scope,
      soloOnly: this.soloOnly,
      showUnkilled: this.showUnkilled,
      lang: this.lang,
      monsterSearch: this.monsterSearch,
      monsterSort: this.monsterSort,
    })
    this.lastViewModel = vm
    this.scope = vm.scope

    const lang = vm.lang
    if (this.doc.documentElement) {
      this.doc.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
    }
    this.doc.title = tStats('stats.page.title', lang)

    const isPluginEnabled = this.pageContext.isEnabled()
    this.dom.disabledNoticeEl.textContent = tStats('stats.notice.pluginDisabled', lang)
    this.dom.disabledNoticeEl.hidden = isPluginEnabled

    this.dom.pageTitleEl.textContent = tStats('stats.page.title', lang)
    this.dom.backToGameLink.textContent = tStats('stats.action.backToGame', lang)
    this.dom.sidebarTitleEl.textContent = tStats('stats.sidebar.title', lang)
    this.dom.allAccountsLabelEl.textContent = tStats('stats.sidebar.allAccounts', lang)
    this.dom.allAccountsCountEl.textContent = String(vm.totalAllAccountsKills)
    this.dom.allAccountsBtn.classList.toggle(
      'd2-stats__nav-item--active',
      vm.scope.kind === 'all',
    )

    this.renderSidebarTree(vm)

    // Summary cards
    this.dom.cardNormalLabelEl.textContent = tStats('stats.summary.normal', lang)
    this.dom.cardNormalValEl.textContent = String(vm.summary.normal)
    this.dom.cardNightmareLabelEl.textContent = tStats('stats.summary.nightmare', lang)
    this.dom.cardNightmareValEl.textContent = String(vm.summary.nightmare)
    this.dom.cardHellLabelEl.textContent = tStats('stats.summary.hell', lang)
    this.dom.cardHellValEl.textContent = String(vm.summary.hell)
    this.dom.cardTotalLabelEl.textContent = tStats('stats.summary.total', lang)
    this.dom.cardTotalValEl.textContent = String(vm.summary.total)

    // Filter & action controls
    this.dom.soloOnlyInput.checked = vm.soloOnly
    this.dom.soloOnlyLabelEl.textContent = tStats('stats.filter.soloOnly', lang)
    this.dom.showUnkilledInput.checked = vm.showUnkilled
    this.dom.showUnkilledLabelEl.textContent = tStats('stats.filter.showUnkilled', lang)
    this.dom.langToggleBtn.textContent = tStats('stats.filter.langToggle', lang)
    this.dom.exportBtn.textContent = tStats('stats.action.exportJson', lang)
    this.dom.importBtn.textContent = tStats('stats.action.importJson', lang)
    this.dom.deleteCharBtn.textContent = tStats('stats.action.deleteCharacter', lang)
    this.dom.deleteCharBtn.disabled = this.resolveTargetDeleteCharKey(vm) === null
    this.dom.clearAllBtn.textContent = tStats('stats.action.clearAll', lang)

    // Empty state
    const isCompletelyEmpty =
      this.snapshot.characters.length === 0 && this.snapshot.tallies.length === 0
    this.dom.emptyStateEl.hidden = !isCompletelyEmpty
    this.dom.emptyStateTitleEl.textContent = tStats('stats.emptyState.title', lang)
    this.dom.emptyStateBodyEl.textContent = tStats('stats.emptyState.body', lang)

    // Boss & SuperUnique Kill Board
    this.dom.boardTitleEl.textContent = tStats('stats.board.title', lang)
    this.dom.boardSubtitleEl.textContent = tStats('stats.board.subtitle', lang)
    this.dom.boardCountBadgeEl.textContent = `${vm.boardRows.length} / ${vm.totalBoardCatalogRows}`
    this.dom.boardColNameEl.textContent = tStats('stats.board.col.name', lang)
    this.dom.boardColKindEl.textContent = tStats('stats.board.col.kind', lang)
    this.dom.boardColNormalEl.textContent = tStats('stats.board.col.normal', lang)
    this.dom.boardColNightmareEl.textContent = tStats('stats.board.col.nightmare', lang)
    this.dom.boardColHellEl.textContent = tStats('stats.board.col.hell', lang)
    this.dom.boardColTotalEl.textContent = tStats('stats.board.col.total', lang)
    this.dom.boardColLastAtEl.textContent = tStats('stats.board.col.lastAt', lang)

    this.renderBoardRows(vm)

    // Monster Type × Difficulty Table
    this.dom.monstersTitleEl.textContent = tStats('stats.monsters.title', lang)
    this.dom.monstersCountBadgeEl.textContent = String(vm.monsterRows.length)
    this.dom.monsterSearchInput.placeholder = tStats(
      'stats.monsters.searchPlaceholder',
      lang,
    )

    const sortArrow = (col: MonsterSortColumn): string => {
      if (vm.monsterSort.column !== col) return ''
      return vm.monsterSort.direction === 'asc' ? ' ▲' : ' ▼'
    }
    this.dom.monstersColHcIdxBtn.textContent =
      tStats('stats.monsters.col.hcIdx', lang) + sortArrow('hcIdx')
    this.dom.monstersColNameBtn.textContent =
      tStats('stats.monsters.col.name', lang) + sortArrow('name')
    this.dom.monstersColNormalBtn.textContent =
      tStats('stats.monsters.col.normal', lang) + sortArrow('normal')
    this.dom.monstersColNightmareBtn.textContent =
      tStats('stats.monsters.col.nightmare', lang) + sortArrow('nightmare')
    this.dom.monstersColHellBtn.textContent =
      tStats('stats.monsters.col.hell', lang) + sortArrow('hell')
    this.dom.monstersColTotalBtn.textContent =
      tStats('stats.monsters.col.total', lang) + sortArrow('total')

    this.renderMonsterRows(vm)

    this.dom.footnoteEl.textContent = tStats('stats.footnote.attribution', lang)
  }

  private renderSidebarTree(vm: KillStatsViewModel): void {
    const container = this.dom.accountTreeEl
    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    if (vm.accounts.length === 0) {
      const emptyEl = this.doc.createElement('div')
      emptyEl.className = 'd2-stats__sidebar-empty'
      emptyEl.textContent = tStats('stats.sidebar.emptyAccounts', vm.lang)
      container.appendChild(emptyEl)
      return
    }

    for (const acct of vm.accounts) {
      const groupEl = this.doc.createElement('div')
      groupEl.className = 'd2-stats__account-group'
      groupEl.dataset.accountKey = acct.accountKey

      const acctBtn = this.doc.createElement('button')
      acctBtn.type = 'button'
      acctBtn.className = 'd2-stats__account-btn'
      const isAcctActive =
        vm.scope.kind === 'account' &&
        computeAccountKey(vm.scope.host, vm.scope.realm, vm.scope.account) ===
          acct.accountKey
      if (isAcctActive) {
        acctBtn.classList.add('d2-stats__nav-item--active')
      }

      const acctLabelSpan = this.doc.createElement('span')
      acctLabelSpan.className = 'd2-stats__account-label'
      acctLabelSpan.textContent = acct.label

      const acctKillsSpan = this.doc.createElement('span')
      acctKillsSpan.className = 'd2-stats__nav-count'
      acctKillsSpan.textContent = String(acct.totalKills)

      acctBtn.append(acctLabelSpan, acctKillsSpan)
      acctBtn.addEventListener('click', () => {
        this.scope = {
          kind: 'account',
          host: acct.host,
          realm: acct.realm,
          account: acct.account,
        }
        this.render()
      })
      groupEl.appendChild(acctBtn)

      const charListEl = this.doc.createElement('div')
      charListEl.className = 'd2-stats__char-list'

      for (const ch of acct.characters) {
        charListEl.appendChild(this.createCharacterButton(ch, vm))
      }

      groupEl.appendChild(charListEl)
      container.appendChild(groupEl)
    }
  }

  private createCharacterButton(
    ch: KillStatsCharacterNode,
    vm: KillStatsViewModel,
  ): HTMLButtonElement {
    const btn = this.doc.createElement('button')
    btn.type = 'button'
    btn.className = 'd2-stats__char-btn'
    btn.dataset.charKey = ch.charKey
    btn.dataset.charName = ch.charName
    if (vm.scope.kind === 'character' && vm.scope.charKey === ch.charKey) {
      btn.classList.add('d2-stats__nav-item--active')
    }

    const topRow = this.doc.createElement('div')
    topRow.className = 'd2-stats__char-top'

    const nameSpan = this.doc.createElement('span')
    nameSpan.className = 'd2-stats__char-name'
    nameSpan.textContent = ch.charName

    const killsSpan = this.doc.createElement('span')
    killsSpan.className = 'd2-stats__nav-count'
    killsSpan.textContent = String(ch.totalKills)

    topRow.append(nameSpan, killsSpan)

    const metaRow = this.doc.createElement('div')
    metaRow.className = 'd2-stats__char-meta'

    const classLevelSpan = this.doc.createElement('span')
    classLevelSpan.className = 'd2-stats__char-class'
    classLevelSpan.textContent = `${ch.className} Lv.${ch.level}`
    metaRow.appendChild(classLevelSpan)

    const modeBadge = this.doc.createElement('span')
    modeBadge.className = ch.hardcore
      ? 'd2-stats__badge d2-stats__badge--hc'
      : 'd2-stats__badge'
    modeBadge.textContent = ch.hardcore
      ? tStats('stats.badge.hc', vm.lang)
      : tStats('stats.badge.sc', vm.lang)
    metaRow.appendChild(modeBadge)

    if (ch.ladder) {
      const ladderBadge = this.doc.createElement('span')
      ladderBadge.className = 'd2-stats__badge d2-stats__badge--ladder'
      ladderBadge.textContent = tStats('stats.badge.ladder', vm.lang)
      metaRow.appendChild(ladderBadge)
    }

    const expBadge = this.doc.createElement('span')
    expBadge.className = 'd2-stats__badge'
    expBadge.textContent = ch.expansion
      ? tStats('stats.badge.expansion', vm.lang)
      : tStats('stats.badge.classic', vm.lang)
    metaRow.appendChild(expBadge)

    btn.append(topRow, metaRow)
    btn.addEventListener('click', () => {
      this.scope = { kind: 'character', charKey: ch.charKey }
      this.render()
    })
    return btn
  }

  private renderBoardRows(vm: KillStatsViewModel): void {
    const tbody = this.dom.boardTbodyEl
    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild)
    }

    if (vm.boardRows.length === 0) {
      const tr = this.doc.createElement('tr')
      const td = this.doc.createElement('td')
      td.colSpan = 7
      td.className = 'd2-stats__table-empty'
      td.textContent = tStats('stats.board.empty', vm.lang)
      tr.appendChild(td)
      tbody.appendChild(tr)
      return
    }

    for (const row of vm.boardRows) {
      const tr = this.doc.createElement('tr')
      tr.dataset.boardKey = row.key
      tr.dataset.canonicalId = row.canonicalId
      if (row.total > 0) {
        tr.classList.add('d2-stats__row--killed')
      }

      const nameTd = this.doc.createElement('td')
      const nameSpan = this.doc.createElement('span')
      nameSpan.className = 'd2-stats__entity-name'
      nameSpan.textContent = row.name
      nameTd.appendChild(nameSpan)
      if (row.subtitle !== null) {
        const subSpan = this.doc.createElement('span')
        subSpan.className = 'd2-stats__entity-subtitle'
        subSpan.textContent = row.subtitle
        nameTd.appendChild(subSpan)
      }

      const kindTd = this.doc.createElement('td')
      const kindBadge = this.doc.createElement('span')
      kindBadge.className =
        row.rowKind === 'boss'
          ? 'd2-stats__badge d2-stats__badge--boss'
          : 'd2-stats__badge d2-stats__badge--su'
      kindBadge.textContent =
        row.rowKind === 'boss'
          ? tStats('stats.board.kind.boss', vm.lang)
          : tStats('stats.board.kind.superunique', vm.lang)
      kindTd.appendChild(kindBadge)

      const normalTd = this.doc.createElement('td')
      normalTd.dataset.col = 'normal'
      normalTd.className = 'd2-stats__num'
      normalTd.textContent = String(row.normal)

      const nightmareTd = this.doc.createElement('td')
      nightmareTd.dataset.col = 'nightmare'
      nightmareTd.className = 'd2-stats__num'
      nightmareTd.textContent = String(row.nightmare)

      const hellTd = this.doc.createElement('td')
      hellTd.dataset.col = 'hell'
      hellTd.className = 'd2-stats__num'
      hellTd.textContent = String(row.hell)

      const totalTd = this.doc.createElement('td')
      totalTd.dataset.col = 'total'
      totalTd.className = 'd2-stats__num d2-stats__num--total'
      totalTd.textContent = String(row.total)

      const lastAtTd = this.doc.createElement('td')
      lastAtTd.dataset.col = 'lastAt'
      lastAtTd.className = 'd2-stats__time'
      lastAtTd.textContent = formatTimestamp(row.lastAt, vm.lang)

      tr.append(nameTd, kindTd, normalTd, nightmareTd, hellTd, totalTd, lastAtTd)
      tbody.appendChild(tr)
    }
  }

  private renderMonsterRows(vm: KillStatsViewModel): void {
    const tbody = this.dom.monstersTbodyEl
    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild)
    }

    if (vm.monsterRows.length === 0) {
      const tr = this.doc.createElement('tr')
      const td = this.doc.createElement('td')
      td.colSpan = 6
      td.className = 'd2-stats__table-empty'
      td.textContent = tStats('stats.monsters.empty', vm.lang)
      tr.appendChild(td)
      tbody.appendChild(tr)
      return
    }

    for (const row of vm.monsterRows) {
      const tr = this.doc.createElement('tr')
      tr.dataset.monsterHcidx = String(row.hcIdx)
      tr.dataset.monsterId = row.id

      const hcIdxTd = this.doc.createElement('td')
      hcIdxTd.dataset.col = 'hcIdx'
      hcIdxTd.className = 'd2-stats__num'
      hcIdxTd.textContent = String(row.hcIdx)

      const nameTd = this.doc.createElement('td')
      nameTd.dataset.col = 'name'
      const nameSpan = this.doc.createElement('span')
      nameSpan.className = 'd2-stats__entity-name'
      nameSpan.textContent = row.name
      const idSpan = this.doc.createElement('span')
      idSpan.className = 'd2-stats__entity-subtitle'
      idSpan.textContent = row.id
      nameTd.append(nameSpan, idSpan)

      const normalTd = this.doc.createElement('td')
      normalTd.dataset.col = 'normal'
      normalTd.className = 'd2-stats__num'
      normalTd.textContent = String(row.normal)

      const nightmareTd = this.doc.createElement('td')
      nightmareTd.dataset.col = 'nightmare'
      nightmareTd.className = 'd2-stats__num'
      nightmareTd.textContent = String(row.nightmare)

      const hellTd = this.doc.createElement('td')
      hellTd.dataset.col = 'hell'
      hellTd.className = 'd2-stats__num'
      hellTd.textContent = String(row.hell)

      const totalTd = this.doc.createElement('td')
      totalTd.dataset.col = 'total'
      totalTd.className = 'd2-stats__num d2-stats__num--total'
      totalTd.textContent = String(row.total)

      tr.append(hcIdxTd, nameTd, normalTd, nightmareTd, hellTd, totalTd)
      tbody.appendChild(tr)
    }
  }

  private mountDom(): BuiltDomRefs {
    while (this.root.firstChild) {
      this.root.removeChild(this.root.firstChild)
    }
    this.root.classList.add('d2-stats-shell')

    // Left Fixed Sidebar (isolated scroll)
    const sidebar = this.doc.createElement('aside')
    sidebar.id = 'd2-stats-sidebar'
    sidebar.className = 'd2-stats__sidebar'

    const sidebarHeader = this.doc.createElement('div')
    sidebarHeader.className = 'd2-stats__sidebar-header'

    const pageTitleEl = this.doc.createElement('h1')
    pageTitleEl.id = 'd2-stats-page-title'
    pageTitleEl.className = 'd2-stats__title'

    const backToGameLink = this.doc.createElement('a')
    backToGameLink.id = 'd2-stats-back-link'
    backToGameLink.className = 'd2-stats__btn d2-stats__btn--link'
    backToGameLink.href = '../../play.html'

    sidebarHeader.append(pageTitleEl, backToGameLink)

    const sidebarTitleEl = this.doc.createElement('div')
    sidebarTitleEl.className = 'd2-stats__sidebar-section-title'

    const allAccountsBtn = this.doc.createElement('button')
    allAccountsBtn.type = 'button'
    allAccountsBtn.id = 'd2-stats-scope-all'
    allAccountsBtn.className = 'd2-stats__all-btn'

    const allAccountsLabelEl = this.doc.createElement('span')
    const allAccountsCountEl = this.doc.createElement('span')
    allAccountsCountEl.id = 'd2-stats-scope-all-count'
    allAccountsCountEl.className = 'd2-stats__nav-count'
    allAccountsBtn.append(allAccountsLabelEl, allAccountsCountEl)

    const accountTreeEl = this.doc.createElement('div')
    accountTreeEl.id = 'd2-stats-account-tree'
    accountTreeEl.className = 'd2-stats__account-tree'

    sidebar.append(sidebarHeader, sidebarTitleEl, allAccountsBtn, accountTreeEl)

    // Right Main Content Area (isolated scroll)
    const main = this.doc.createElement('main')
    main.id = 'd2-stats-main'
    main.className = 'd2-stats__main'

    const disabledNoticeEl = this.doc.createElement('div')
    disabledNoticeEl.id = 'd2-stats-disabled-notice'
    disabledNoticeEl.className = 'd2-stats__banner d2-stats__banner--warn'
    disabledNoticeEl.setAttribute('role', 'status')
    disabledNoticeEl.hidden = true

    const errorBannerEl = this.doc.createElement('div')
    errorBannerEl.id = 'd2-stats-error-banner'
    errorBannerEl.className = 'd2-stats__banner d2-stats__banner--error'
    errorBannerEl.setAttribute('role', 'alert')
    errorBannerEl.hidden = true

    const infoBannerEl = this.doc.createElement('div')
    infoBannerEl.id = 'd2-stats-info-banner'
    infoBannerEl.className = 'd2-stats__banner d2-stats__banner--info'
    infoBannerEl.setAttribute('role', 'status')
    infoBannerEl.hidden = true

    // Summary Cards Grid
    const summaryGrid = this.doc.createElement('section')
    summaryGrid.id = 'd2-stats-summary-grid'
    summaryGrid.className = 'd2-stats__summary-grid'

    const makeSummaryCard = (
      idSuffix: string,
    ): { card: HTMLElement; label: HTMLElement; val: HTMLElement } => {
      const card = this.doc.createElement('div')
      card.id = `d2-stats-card-${idSuffix}`
      card.className = `d2-stats__card d2-stats__card--${idSuffix}`
      const label = this.doc.createElement('div')
      label.className = 'd2-stats__card-label'
      const val = this.doc.createElement('div')
      val.id = `d2-stats-val-${idSuffix}`
      val.className = 'd2-stats__card-val'
      card.append(label, val)
      return { card, label, val }
    }

    const normalCard = makeSummaryCard('normal')
    const nightmareCard = makeSummaryCard('nightmare')
    const hellCard = makeSummaryCard('hell')
    const totalCard = makeSummaryCard('total')
    summaryGrid.append(
      normalCard.card,
      nightmareCard.card,
      hellCard.card,
      totalCard.card,
    )

    // Filter & Actions Toolbar
    const controlsBar = this.doc.createElement('section')
    controlsBar.id = 'd2-stats-controls'
    controlsBar.className = 'd2-stats__controls'

    const filtersGroup = this.doc.createElement('div')
    filtersGroup.className = 'd2-stats__controls-group'

    const soloOnlyWrap = this.doc.createElement('label')
    soloOnlyWrap.className = 'd2-stats__checkbox-label'
    const soloOnlyInput = this.doc.createElement('input')
    soloOnlyInput.type = 'checkbox'
    soloOnlyInput.id = 'd2-stats-solo-only'
    const soloOnlyLabelEl = this.doc.createElement('span')
    soloOnlyLabelEl.id = 'd2-stats-solo-only-label'
    soloOnlyWrap.append(soloOnlyInput, soloOnlyLabelEl)

    const showUnkilledWrap = this.doc.createElement('label')
    showUnkilledWrap.className = 'd2-stats__checkbox-label'
    const showUnkilledInput = this.doc.createElement('input')
    showUnkilledInput.type = 'checkbox'
    showUnkilledInput.id = 'd2-stats-show-unkilled'
    showUnkilledInput.checked = true
    const showUnkilledLabelEl = this.doc.createElement('span')
    showUnkilledLabelEl.id = 'd2-stats-show-unkilled-label'
    showUnkilledWrap.append(showUnkilledInput, showUnkilledLabelEl)

    filtersGroup.append(soloOnlyWrap, showUnkilledWrap)

    const actionsGroup = this.doc.createElement('div')
    actionsGroup.className = 'd2-stats__controls-group'

    const langToggleBtn = this.doc.createElement('button')
    langToggleBtn.type = 'button'
    langToggleBtn.id = 'd2-stats-lang-toggle'
    langToggleBtn.className = 'd2-stats__btn'

    const exportBtn = this.doc.createElement('button')
    exportBtn.type = 'button'
    exportBtn.id = 'd2-stats-export-btn'
    exportBtn.className = 'd2-stats__btn'

    const importBtn = this.doc.createElement('button')
    importBtn.type = 'button'
    importBtn.id = 'd2-stats-import-btn'
    importBtn.className = 'd2-stats__btn'

    const importInput = this.doc.createElement('input')
    importInput.type = 'file'
    importInput.id = 'd2-stats-import-input'
    importInput.accept = '.json,application/json'
    importInput.style.display = 'none'

    const deleteCharBtn = this.doc.createElement('button')
    deleteCharBtn.type = 'button'
    deleteCharBtn.id = 'd2-stats-delete-char-btn'
    deleteCharBtn.className = 'd2-stats__btn d2-stats__btn--danger'

    const clearAllBtn = this.doc.createElement('button')
    clearAllBtn.type = 'button'
    clearAllBtn.id = 'd2-stats-clear-all-btn'
    clearAllBtn.className = 'd2-stats__btn d2-stats__btn--danger'

    actionsGroup.append(
      langToggleBtn,
      exportBtn,
      importBtn,
      importInput,
      deleteCharBtn,
      clearAllBtn,
    )
    controlsBar.append(filtersGroup, actionsGroup)

    // Empty State
    const emptyStateEl = this.doc.createElement('section')
    emptyStateEl.id = 'd2-stats-empty-state'
    emptyStateEl.className = 'd2-stats__empty-state'
    const emptyStateTitleEl = this.doc.createElement('h2')
    emptyStateTitleEl.className = 'd2-stats__empty-title'
    const emptyStateBodyEl = this.doc.createElement('p')
    emptyStateBodyEl.className = 'd2-stats__empty-body'
    emptyStateEl.append(emptyStateTitleEl, emptyStateBodyEl)

    // Section 1: 86-Row Boss & SuperUnique Kill Board
    const boardSection = this.doc.createElement('section')
    boardSection.id = 'd2-stats-board-section'
    boardSection.className = 'd2-stats__section'

    const boardHeader = this.doc.createElement('div')
    boardHeader.className = 'd2-stats__section-header'
    const boardTitleWrap = this.doc.createElement('div')
    const boardTitleEl = this.doc.createElement('h2')
    boardTitleEl.id = 'd2-stats-board-title'
    boardTitleEl.className = 'd2-stats__section-title'
    const boardSubtitleEl = this.doc.createElement('div')
    boardSubtitleEl.className = 'd2-stats__section-subtitle'
    boardTitleWrap.append(boardTitleEl, boardSubtitleEl)

    const boardCountBadgeEl = this.doc.createElement('span')
    boardCountBadgeEl.id = 'd2-stats-board-count'
    boardCountBadgeEl.className = 'd2-stats__section-badge'
    boardHeader.append(boardTitleWrap, boardCountBadgeEl)

    const boardTableWrap = this.doc.createElement('div')
    boardTableWrap.className = 'd2-stats__table-wrap'
    const boardTable = this.doc.createElement('table')
    boardTable.id = 'd2-stats-board-table'
    boardTable.className = 'd2-stats__table'

    const boardThead = this.doc.createElement('thead')
    const boardHeadTr = this.doc.createElement('tr')
    const boardColNameEl = this.doc.createElement('th')
    const boardColKindEl = this.doc.createElement('th')
    const boardColNormalEl = this.doc.createElement('th')
    boardColNormalEl.className = 'd2-stats__num'
    const boardColNightmareEl = this.doc.createElement('th')
    boardColNightmareEl.className = 'd2-stats__num'
    const boardColHellEl = this.doc.createElement('th')
    boardColHellEl.className = 'd2-stats__num'
    const boardColTotalEl = this.doc.createElement('th')
    boardColTotalEl.className = 'd2-stats__num'
    const boardColLastAtEl = this.doc.createElement('th')
    boardHeadTr.append(
      boardColNameEl,
      boardColKindEl,
      boardColNormalEl,
      boardColNightmareEl,
      boardColHellEl,
      boardColTotalEl,
      boardColLastAtEl,
    )
    boardThead.appendChild(boardHeadTr)

    const boardTbodyEl = this.doc.createElement('tbody')
    boardTbodyEl.id = 'd2-stats-board-tbody'
    boardTable.append(boardThead, boardTbodyEl)
    boardTableWrap.appendChild(boardTable)
    boardSection.append(boardHeader, boardTableWrap)

    // Section 2: Monster Type × Difficulty Table
    const monstersSection = this.doc.createElement('section')
    monstersSection.id = 'd2-stats-monsters-section'
    monstersSection.className = 'd2-stats__section'

    const monstersHeader = this.doc.createElement('div')
    monstersHeader.className = 'd2-stats__section-header'
    const monstersTitleWrap = this.doc.createElement('div')
    monstersTitleWrap.className = 'd2-stats__title-row'
    const monstersTitleEl = this.doc.createElement('h2')
    monstersTitleEl.id = 'd2-stats-monsters-title'
    monstersTitleEl.className = 'd2-stats__section-title'
    const monstersCountBadgeEl = this.doc.createElement('span')
    monstersCountBadgeEl.id = 'd2-stats-monsters-count'
    monstersCountBadgeEl.className = 'd2-stats__section-badge'
    monstersTitleWrap.append(monstersTitleEl, monstersCountBadgeEl)

    const monsterSearchInput = this.doc.createElement('input')
    monsterSearchInput.type = 'search'
    monsterSearchInput.id = 'd2-stats-monster-search'
    monsterSearchInput.className = 'd2-stats__search-input'

    monstersHeader.append(monstersTitleWrap, monsterSearchInput)

    const monstersTableWrap = this.doc.createElement('div')
    monstersTableWrap.className = 'd2-stats__table-wrap'
    const monstersTable = this.doc.createElement('table')
    monstersTable.id = 'd2-stats-monster-table'
    monstersTable.className = 'd2-stats__table'

    const monstersThead = this.doc.createElement('thead')
    const monstersHeadTr = this.doc.createElement('tr')

    const makeSortHeader = (
      col: MonsterSortColumn,
      isNumeric: boolean,
    ): { th: HTMLTableCellElement; btn: HTMLButtonElement } => {
      const th = this.doc.createElement('th')
      if (isNumeric) th.className = 'd2-stats__num'
      const btn = this.doc.createElement('button')
      btn.type = 'button'
      btn.id = `d2-stats-sort-${col}`
      btn.dataset.sortCol = col
      btn.className = 'd2-stats__sort-btn'
      th.appendChild(btn)
      return { th, btn }
    }

    const colHcIdx = makeSortHeader('hcIdx', true)
    const colName = makeSortHeader('name', false)
    const colNormal = makeSortHeader('normal', true)
    const colNightmare = makeSortHeader('nightmare', true)
    const colHell = makeSortHeader('hell', true)
    const colTotal = makeSortHeader('total', true)
    monstersHeadTr.append(
      colHcIdx.th,
      colName.th,
      colNormal.th,
      colNightmare.th,
      colHell.th,
      colTotal.th,
    )
    monstersThead.appendChild(monstersHeadTr)

    const monstersTbodyEl = this.doc.createElement('tbody')
    monstersTbodyEl.id = 'd2-stats-monster-tbody'
    monstersTable.append(monstersThead, monstersTbodyEl)
    monstersTableWrap.appendChild(monstersTable)
    monstersSection.append(monstersHeader, monstersTableWrap)

    const footnoteEl = this.doc.createElement('footer')
    footnoteEl.id = 'd2-stats-footnote'
    footnoteEl.className = 'd2-stats__footnote'

    main.append(
      disabledNoticeEl,
      errorBannerEl,
      infoBannerEl,
      summaryGrid,
      controlsBar,
      emptyStateEl,
      boardSection,
      monstersSection,
      footnoteEl,
    )

    this.root.append(sidebar, main)

    return {
      pageTitleEl,
      backToGameLink,
      sidebarTitleEl,
      allAccountsBtn,
      allAccountsLabelEl,
      allAccountsCountEl,
      accountTreeEl,
      disabledNoticeEl,
      errorBannerEl,
      infoBannerEl,
      cardNormalLabelEl: normalCard.label,
      cardNormalValEl: normalCard.val,
      cardNightmareLabelEl: nightmareCard.label,
      cardNightmareValEl: nightmareCard.val,
      cardHellLabelEl: hellCard.label,
      cardHellValEl: hellCard.val,
      cardTotalLabelEl: totalCard.label,
      cardTotalValEl: totalCard.val,
      soloOnlyInput,
      soloOnlyLabelEl,
      showUnkilledInput,
      showUnkilledLabelEl,
      langToggleBtn,
      exportBtn,
      importBtn,
      importInput,
      deleteCharBtn,
      clearAllBtn,
      emptyStateEl,
      emptyStateTitleEl,
      emptyStateBodyEl,
      boardTitleEl,
      boardSubtitleEl,
      boardCountBadgeEl,
      boardColNameEl,
      boardColKindEl,
      boardColNormalEl,
      boardColNightmareEl,
      boardColHellEl,
      boardColTotalEl,
      boardColLastAtEl,
      boardTbodyEl,
      monstersTitleEl,
      monstersCountBadgeEl,
      monsterSearchInput,
      monstersColHcIdxBtn: colHcIdx.btn,
      monstersColNameBtn: colName.btn,
      monstersColNormalBtn: colNormal.btn,
      monstersColNightmareBtn: colNightmare.btn,
      monstersColHellBtn: colHell.btn,
      monstersColTotalBtn: colTotal.btn,
      monstersTbodyEl,
      footnoteEl,
    }
  }
}
