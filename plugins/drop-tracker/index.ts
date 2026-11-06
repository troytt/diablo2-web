/**
 * Item Drop Tracker Plugin (`plugins/drop-tracker/index.ts`).
 *
 * Tracks ground drops of Set items (`quality === 5`), Unique items (`quality === 7`),
 * and Runes (`r01`–`r33`), displays live counts in `#d2-toolbar-plugin-slot`, and links
 * to the standalone Drop Tracker dashboard (`plugins/drop-tracker/index.html` / `/drops.html`).
 */

import {
  TOOLBAR_DROP_TRACKER_ICON_SVG,
  type D2WebPlugin,
  type GameLang,
  type LocalizedText,
  type PluginContext,
  type PluginInstance,
  type PluginStatus,
  type ToolbarContributionHandle,
} from '../../src/client/plugin-host/api.ts'
import {
  DropTracker,
  IndexedDbDropStatsRepository,
  type DropRecord,
  type DropStatsRepository,
  type DropStatsSummary,
  type DropTrackerOptions,
} from './drop-tracker.ts'

export * from './drop-tracker.ts'
export * from './drop-i18n.ts'

export const DROP_TRACKER_PLUGIN_ID = 'drop-tracker'
export const DROP_TRACKER_TOOLBAR_BUTTON_ID = 'd2-toolbar-plugin-drop-tracker-open'

export interface DropTrackerCountsSummary {
  readonly setCount: number
  readonly uniqueCount: number
  readonly runeCount: number
  readonly totalTracked: number
}

export interface DropTrackerPluginInstance extends PluginInstance {
  readonly tracker: DropTracker
  readonly repository: DropStatsRepository
  flushNow(): Promise<void>
  getSummary(): DropTrackerCountsSummary
  getFullSummary(): DropStatsSummary
  getRecords(): readonly DropRecord[]
  clearAll(): Promise<DropStatsSummary>
  exportJson(): string
}

export interface CreateDropTrackerPluginOptions {
  readonly repository?: DropStatsRepository | undefined
  readonly hydrateSync?: boolean | undefined
  readonly trackerOptions?: Omit<DropTrackerOptions, 'session' | 'repository'> | undefined
}

export function formatDropToolbarLabel(summary: DropTrackerCountsSummary): LocalizedText {
  return {
    zh: `掉落 绿${summary.setCount} · 金${summary.uniqueCount} · 符${summary.runeCount}`,
    en: `Drops S:${summary.setCount} · U:${summary.uniqueCount} · R:${summary.runeCount}`,
  }
}

export function formatDropBadgeText(
  summary: {
    readonly setCount?: number | undefined
    readonly uniqueCount?: number | undefined
    readonly runeCount?: number | undefined
    readonly totalSet?: number | undefined
    readonly totalUnique?: number | undefined
    readonly totalRune?: number | undefined
  },
  lang: GameLang = 'zh',
): string {
  const setCount = summary.setCount ?? summary.totalSet ?? 0
  const uniqueCount = summary.uniqueCount ?? summary.totalUnique ?? 0
  const runeCount = summary.runeCount ?? summary.totalRune ?? 0
  const localized = formatDropToolbarLabel({
    setCount,
    uniqueCount,
    runeCount,
    totalTracked: setCount + uniqueCount + runeCount,
  })
  return lang === 'en' ? localized.en : localized.zh
}

export function createDropTrackerPlugin(
  options: CreateDropTrackerPluginOptions = {},
): D2WebPlugin {
  return {
    id: DROP_TRACKER_PLUGIN_ID,
    name: {
      zh: '掉落统计',
      en: 'Drop Tracker',
    },
    description: {
      zh: '实时记录本浏览器内地面掉落的绿色套装、暗金传奇与符文（r01–r33），支持独立统计页与 JSON 导出。',
      en: 'Tracks ground drops of Set items, Unique items, and Runes (r01–r33) in real time with a standalone dashboard and JSON export.',
    },
    defaultEnabled: true,
    settings: [
      {
        kind: 'boolean',
        key: 'showToolbarShortcut',
        label: {
          zh: '在工具栏显示掉落计数入口',
          en: 'Show drop counter shortcut in toolbar',
        },
        default: true,
      },
    ],
    actions: [
      {
        kind: 'link',
        id: 'open-page',
        label: {
          zh: '打开掉落统计页',
          en: 'Open Drop Tracker Page',
        },
        href: 'plugins/drop-tracker/index.html',
      },
    ],
    activate(ctx: PluginContext): DropTrackerPluginInstance {
      const repository =
        options.repository ??
        new IndexedDbDropStatsRepository({
          hydrateSync: options.hydrateSync ?? true,
        })
      let toolbarHandle: ToolbarContributionHandle | null = null
      let currentSummary: DropTrackerCountsSummary = {
        setCount: 0,
        uniqueCount: 0,
        runeCount: 0,
        totalTracked: 0,
      }

      const updateToolbarLabel = (summary: DropTrackerCountsSummary): void => {
        currentSummary = {
          setCount: summary.setCount,
          uniqueCount: summary.uniqueCount,
          runeCount: summary.runeCount,
          totalTracked: summary.totalTracked,
        }
        if (!toolbarHandle) return
        const label: LocalizedText = {
          zh: formatDropBadgeText(currentSummary, 'zh'),
          en: formatDropBadgeText(currentSummary, 'en'),
        }
        toolbarHandle.update?.({ label })
        if (typeof document !== 'undefined') {
          const el = document.getElementById(DROP_TRACKER_TOOLBAR_BUTTON_ID)
          if (el) {
            const htmlLang = document.documentElement?.lang?.toLowerCase() ?? ''
            const activeLang: GameLang =
              typeof ctx.lang?.get === 'function'
                ? ctx.lang.get()
                : htmlLang.startsWith('en')
                  ? 'en'
                  : 'zh'
            const badgeText = activeLang === 'en' ? label.en : label.zh
            if (el.textContent !== badgeText) {
              el.textContent = badgeText
            }
            if ('title' in el) {
              ;(el as HTMLElement).title = badgeText
            }
            el.setAttribute('data-set-count', String(currentSummary.setCount))
            el.setAttribute('data-unique-count', String(currentSummary.uniqueCount))
            el.setAttribute('data-rune-count', String(currentSummary.runeCount))
            el.setAttribute('data-total-count', String(currentSummary.totalTracked))
          }
        }
      }

      const tracker = new DropTracker({
        session: ctx.session,
        repository,
        log: ctx.log,
        ...options.trackerOptions,
        onSummaryChange: (summary) => {
          options.trackerOptions?.onSummaryChange?.(summary)
          updateToolbarLabel(summary)
          ctx.notifyStatusChanged()
        },
      })

      const syncToolbarShortcut = (): void => {
        const settingVal = ctx.settings.get('showToolbarShortcut')
        const show = settingVal === undefined ? true : settingVal === true
        if (show && !toolbarHandle) {
          const initialCounts = tracker.getSummary()
          toolbarHandle = ctx.toolbar.addLink({
            id: 'open',
            label: formatDropToolbarLabel(initialCounts),
            iconSvg: TOOLBAR_DROP_TRACKER_ICON_SVG,
            href: 'plugins/drop-tracker/index.html',
          })
          updateToolbarLabel(initialCounts)
        } else if (!show && toolbarHandle) {
          toolbarHandle.dispose()
          toolbarHandle = null
        }
      }

      syncToolbarShortcut()
      const unsubSettings = ctx.settings.subscribe((key) => {
        if (key === 'showToolbarShortcut') {
          syncToolbarShortcut()
        }
      })

      const subscribeLang =
        typeof ctx.lang?.onChange === 'function'
          ? ctx.lang.onChange.bind(ctx.lang)
          : typeof ctx.lang?.subscribe === 'function'
            ? ctx.lang.subscribe.bind(ctx.lang)
            : null
      const unsubLang = subscribeLang
        ? subscribeLang(() => {
            updateToolbarLabel(currentSummary)
          })
        : () => {}

      void tracker.init()

      const getStatus = (): PluginStatus => {
        const s = tracker.getSummary()
        return {
          level: 'ok',
          text: {
            zh: `已记录 ${s.totalTracked} 件（套装 ${s.setCount} / 暗金 ${s.uniqueCount} / 符文 ${s.runeCount}）`,
            en: `Tracked ${s.totalTracked} drops (Set ${s.setCount} / Unique ${s.uniqueCount} / Rune ${s.runeCount})`,
          },
        }
      }

      return {
        tracker,
        repository,
        flushNow: () => tracker.flushNow(),
        getSummary: (): DropTrackerCountsSummary => {
          const s = tracker.getSummary()
          return {
            setCount: s.setCount,
            uniqueCount: s.uniqueCount,
            runeCount: s.runeCount,
            totalTracked: s.totalTracked,
          }
        },
        getFullSummary: () => tracker.getSummary(),
        getRecords: () => tracker.getSummary().records,
        clearAll: () => tracker.clearAll(),
        exportJson: () => tracker.exportJson(),
        getStatus,
        async deactivate(): Promise<void> {
          unsubSettings()
          unsubLang()
          if (toolbarHandle) {
            toolbarHandle.dispose()
            toolbarHandle = null
          }
          await tracker.flushNow()
          tracker.destroy()
        },
      }
    },
  }
}

export const dropTrackerPlugin: D2WebPlugin = createDropTrackerPlugin()
export default dropTrackerPlugin
