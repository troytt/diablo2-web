/**
 * Trade Hall Plugin (`plugins/trade-hall/index.ts`).
 *
 * Registers the standalone Diablo II v1.13c Trade Hall (`/trade.html` / `/plugins/trade-hall/index.html`)
 * in the built-in plugin registry and optionally surfaces a toolbar shortcut link.
 */

import {
  TOOLBAR_TRADE_HALL_ICON_SVG,
  type D2WebPlugin,
  type PluginContext,
  type PluginInstance,
  type PluginStatus,
} from '../../src/client/plugin-host/api.ts'

export function createTradeHallPlugin(): D2WebPlugin {
  return {
    id: 'trade-hall',
    name: {
      zh: '交易大厅',
      en: 'Trade Hall',
    },
    description: {
      zh: '独立提取的暗黑破坏神 II v1.13c 在线交易大厅网页：仅加载物品栏、储藏箱、交易栏与装备词条美术资源，进房自动前往 A1 储藏箱并内置防骗变动对比。',
      en: 'Standalone Diablo II v1.13c online Trade Hall page with minimal UI/item art loading, auto-walk to Act 1 Stash, and anti-scam offer diff auditing.',
    },
    defaultEnabled: true,
    settings: [
      {
        kind: 'boolean',
        key: 'showToolbarShortcut',
        label: {
          zh: '在工具栏显示交易大厅入口',
          en: 'Show Trade Hall shortcut in toolbar',
        },
        default: true,
      },
    ],
    actions: [
      {
        kind: 'link',
        id: 'open-page',
        label: {
          zh: '打开交易大厅',
          en: 'Open Trade Hall',
        },
        href: 'plugins/trade-hall/index.html',
      },
    ],
    activate(ctx: PluginContext): PluginInstance {
      let removeToolbarLink: (() => void) | null = null
      const syncToolbarShortcut = (): void => {
        const show = ctx.settings.get('showToolbarShortcut') === true
        if (show && !removeToolbarLink) {
          removeToolbarLink = ctx.toolbar.addLink({
            id: 'open',
            label: {
              zh: '交易大厅',
              en: 'Trade Hall',
            },
            iconSvg: TOOLBAR_TRADE_HALL_ICON_SVG,
            href: 'plugins/trade-hall/index.html',
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

      return {
        deactivate(): void {
          unsubSettings()
          if (removeToolbarLink) {
            removeToolbarLink()
            removeToolbarLink = null
          }
        },
        getStatus(): PluginStatus {
          return {
            level: 'ok',
            text: {
              zh: '可打开独立交易大厅网页 (/trade.html)',
              en: 'Standalone Trade Hall ready (/trade.html)',
            },
          }
        },
      }
    },
  }
}

export const tradeHallPlugin: D2WebPlugin = createTradeHallPlugin()
