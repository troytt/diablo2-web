/**
 * Extended Viewports Plugin (`plugins/extended-viewports/index.ts` — Issue #716).
 *
 * A plugin-config mirror of the viewport selector. PD2's SGD2FreeRes resolution list is the client
 * default (the toolbar offers all of it, `1068x600` first-run default), so this plugin no longer gates
 * anything: enabling or disabling it leaves the PD2 list available. It only keeps its `viewport`
 * setting in sync with the client.
 */

import {
  DEFAULT_VIEWPORT_RESOLUTION,
  VALID_VIEWPORT_RESOLUTIONS,
  formatViewportLabel,
  type D2WebPlugin,
  type PluginContext,
  type PluginInstance,
  type PluginStatus,
  type PluginToolbarSelectOption,
  type ViewportResolution,
} from '../../src/client/plugin-host/api.ts'

const VIEWPORT_SELECT_OPTIONS: readonly PluginToolbarSelectOption[] =
  VALID_VIEWPORT_RESOLUTIONS.map((vp) => {
    const label = formatViewportLabel(vp)
    return {
      value: vp,
      label: {
        zh: label,
        en: label,
      },
    }
  })

function isViewportResolution(value: unknown): value is ViewportResolution {
  return (
    typeof value === 'string' &&
    (VALID_VIEWPORT_RESOLUTIONS as readonly string[]).includes(value)
  )
}

export interface ExtendedViewportsPluginInstance extends PluginInstance {
  getViewport(): ViewportResolution
  setViewport(viewport: ViewportResolution): void
}

export function createExtendedViewportsPlugin(): D2WebPlugin {
  return {
    id: 'extended-viewports',
    name: {
      zh: '扩展高分与宽屏视口',
      en: 'Extended Viewports',
    },
    description: {
      zh: 'PD2 SGD2FreeRes 分辨率列表（默认 1068×600）的视口选择器，与工具栏同步。',
      en: 'Viewport selector for the PD2 SGD2FreeRes resolution list (default 1068×600), kept in sync with the toolbar.',
    },
    defaultEnabled: true,
    settings: [
      {
        kind: 'select',
        key: 'viewport',
        label: {
          zh: '当前视口分辨率',
          en: 'Active Viewport',
        },
        default: DEFAULT_VIEWPORT_RESOLUTION,
        options: VIEWPORT_SELECT_OPTIONS,
      },
    ],
    activate(ctx: PluginContext): ExtendedViewportsPluginInstance {
      // The whole PD2 SGD2FreeRes list (the same list the client allows without this plugin).
      ctx.client.setAllowedViewports(VALID_VIEWPORT_RESOLUTIONS)

      const storedSetting = ctx.settings.get('viewport')
      const initialViewport: ViewportResolution = isViewportResolution(storedSetting)
        ? storedSetting
        : DEFAULT_VIEWPORT_RESOLUTION

      ctx.client.setViewport(initialViewport)

      const unsubClient = ctx.client.subscribeViewport((clientVp) => {
        if (ctx.settings.get('viewport') !== clientVp) {
          ctx.settings.set('viewport', clientVp)
        }
        ctx.notifyStatusChanged()
      })

      const unsubSettings = ctx.settings.subscribe((key) => {
        if (key === 'viewport') {
          const next = ctx.settings.get('viewport')
          if (isViewportResolution(next)) {
            ctx.client.setViewport(next)
            ctx.notifyStatusChanged()
          }
        }
      })

      const getStatus = (): PluginStatus => {
        const vp = ctx.client.getViewport()
        const label = formatViewportLabel(vp)
        return {
          level: 'ok',
          text: {
            zh: `当前：${label}`,
            en: `Viewport: ${label}`,
          },
        }
      }

      return {
        getViewport: () => ctx.client.getViewport(),
        setViewport: (viewport: ViewportResolution) => {
          if (!isViewportResolution(viewport)) {
            throw new Error(`Invalid viewport resolution: ${String(viewport)}`)
          }
          ctx.settings.set('viewport', viewport)
        },
        getStatus,
        deactivate(): void {
          unsubClient()
          unsubSettings()
        },
      }
    },
  }
}

export const extendedViewportsPlugin: D2WebPlugin = createExtendedViewportsPlugin()
