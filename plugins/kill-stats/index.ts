/**
 * Kill Statistics Plugin (`plugins/kill-stats/index.ts`).
 */

import {
  TOOLBAR_KILL_STATS_ICON_SVG,
  type D2WebPlugin,
  type PluginContext,
  type PluginInstance,
  type PluginStatus,
} from '../../src/client/plugin-host/api.ts'
import {
  IndexedDbKillStatsRepository,
  type KillStatsRepository,
} from './kill-stats-store.ts'
import { KillTracker, type KillTrackerOptions } from './kill-tracker.ts'
import { localizeKillSkipReason } from './stats-i18n.ts'

export interface KillStatsPluginInstance extends PluginInstance {
  readonly tracker: KillTracker
  readonly repository: KillStatsRepository
  flushNow(): Promise<void>
}

export interface CreateKillStatsPluginOptions {
  readonly repository?: KillStatsRepository | undefined
  readonly trackerOptions?: Omit<KillTrackerOptions, 'session' | 'repository'> | undefined
}

export function createKillStatsPlugin(
  options: CreateKillStatsPluginOptions = {},
): D2WebPlugin {
  return {
    id: 'kill-stats',
    name: {
      zh: '击杀统计',
      en: 'Kill Stats',
    },
    description: {
      zh: '记录本浏览器内各账号与角色在普通/噩梦/地狱难度下的怪物、首领与超级精英击杀数。',
      en: 'Tracks per-account and per-character monster, boss, and SuperUnique kill counts across Normal, Nightmare, and Hell.',
    },
    defaultEnabled: true,
    settings: [
      {
        kind: 'boolean',
        key: 'showToolbarShortcut',
        label: {
          zh: '在工具栏显示快捷入口',
          en: 'Show shortcut in toolbar',
        },
        default: true,
      },
    ],
    actions: [
      {
        kind: 'link',
        id: 'open-page',
        label: {
          zh: '打开统计页',
          en: 'Open Stats Page',
        },
        href: 'plugins/kill-stats/index.html',
      },
    ],
    activate(ctx: PluginContext): KillStatsPluginInstance {
      const repository =
        options.repository ?? new IndexedDbKillStatsRepository()
      const tracker = new KillTracker({
        session: ctx.session,
        repository,
        log: ctx.log,
        ...options.trackerOptions,
        onStatusChange: () => {
          options.trackerOptions?.onStatusChange?.()
          ctx.notifyStatusChanged()
        },
      })

      let removeToolbarLink: (() => void) | null = null
      const syncToolbarShortcut = (): void => {
        const show = ctx.settings.get('showToolbarShortcut') === true
        if (show && !removeToolbarLink) {
          removeToolbarLink = ctx.toolbar.addLink({
            id: 'open',
            label: {
              zh: '击杀统计',
              en: 'Kill Stats',
            },
            iconSvg: TOOLBAR_KILL_STATS_ICON_SVG,
            href: 'plugins/kill-stats/index.html',
          })
        } else if (!show && removeToolbarLink) {
          removeToolbarLink()
          removeToolbarLink = null
        }
      }

      syncToolbarShortcut()
      const unsubSettings = ctx.settings.subscribe((key) => {
        if (key === 'showToolbarShortcut') {
          syncToolbarShortcut()
        }
      })

      const getStatus = (): PluginStatus => {
        const st = tracker.getStatus()
        if (st.lastError) {
          return {
            level: 'error',
            text: {
              zh: `错误：${st.lastError}`,
              en: `Error: ${st.lastError}`,
            },
          }
        }
        if (ctx.session.phase === 'ingame' && st.difficulty === null) {
          return {
            level: 'warn',
            text: {
              zh: '等待下一局（本局未收到难度标记）',
              en: 'Waiting for next game (difficulty flags not received in current game)',
            },
          }
        }
        if (st.lastSkipReason) {
          return {
            level: 'warn',
            text: localizeKillSkipReason(st.lastSkipReason),
          }
        }
        if (ctx.session.phase === 'ingame') {
          return {
            level: 'ok',
            text: {
              zh: '记录中',
              en: 'Recording',
            },
          }
        }
        return {
          level: 'ok',
          text: {
            zh: '就绪（未在游戏中）',
            en: 'Ready (not in game)',
          },
        }
      }

      return {
        tracker,
        repository,
        flushNow: () => tracker.flushNow(),
        getStatus,
        async deactivate(): Promise<void> {
          unsubSettings()
          if (removeToolbarLink) {
            removeToolbarLink()
            removeToolbarLink = null
          }
          tracker.stopListening()
          await tracker.flushNow()
          tracker.destroy()
        },
      }
    },
  }
}

export const killStatsPlugin: D2WebPlugin = createKillStatsPlugin()
