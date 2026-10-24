/**
 * Browser entry point for `plugins/kill-stats/index.html`.
 */

import { bootPluginPage } from '../../src/client/plugin-host/api.ts'
import { killStatsPlugin } from './index.ts'
import type { KillStatsRepository } from './kill-stats-store.ts'
import type { KillStatsViewModel } from './kill-stats-view.ts'
import { tStats } from './stats-i18n.ts'
import { KillStatsPage } from './stats-page.ts'

export interface StatsAppController {
  readonly ready: boolean
  readonly page: KillStatsPage
  readonly repository: KillStatsRepository
  refresh(): Promise<void>
  getViewModel(): KillStatsViewModel | null
  getLastExportJson(): string | null
}

declare global {
  interface Window {
    __d2StatsApp?: StatsAppController
  }
}

export async function bootStatsApp(): Promise<void> {
  const root =
    document.getElementById('d2-stats-app') ??
    (() => {
      const el = document.createElement('div')
      el.id = 'd2-stats-app'
      document.body.appendChild(el)
      return el
    })()

  let page: KillStatsPage | null = null
  const pageContext = bootPluginPage(killStatsPlugin)

  try {
    page = new KillStatsPage({
      root,
      pageContext,
    })

    await page.init()

    const controller: StatsAppController = {
      ready: true,
      page,
      repository: page.repository,
      refresh: () => page!.refresh(),
      getViewModel: () => page!.getViewModel(),
      getLastExportJson: () => page!.getLastExportJson(),
    }

    window.__d2StatsApp = controller
  } catch (err) {
    console.error('[kill-stats] Failed to initialize KillStatsPage:', err)
    const detail = err instanceof Error ? err.message : String(err)
    const message = `${tStats('stats.error.idbUnavailable', pageContext.getLang())} (${detail})`
    if (page) {
      page.showError(message)
      if (typeof window !== 'undefined') {
        window.__d2StatsApp = {
          ready: false,
          page,
          repository: page.repository,
          refresh: () => page!.refresh(),
          getViewModel: () => page!.getViewModel(),
          getLastExportJson: () => page!.getLastExportJson(),
        }
      }
    } else {
      const banner = document.createElement('div')
      banner.id = 'd2-stats-error-banner'
      banner.className = 'd2-stats__banner d2-stats__banner--error'
      banner.setAttribute('role', 'alert')
      banner.textContent = message
      root.appendChild(banner)
    }
  }
}

if (typeof document !== 'undefined') {
  void bootStatsApp()
}
