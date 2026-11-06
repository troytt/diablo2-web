/**
 * Ground Item Display Enhancements Plugin (`plugins/ground-item-beam/index.ts`).
 *
 * Isolates non-1.13c ground item visual enhancements outside core `src/`:
 * - `showUniqueSetBeams`: renders a Diablo III-style vertical loot beam (2:1 isometric
 *   elliptical base glow + expanding ripple ring, multi-layered additive vertical light
 *   column, base starburst flare, and rising light motes) on Unique (amber-gold) and
 *   Set (emerald-green) items lying on the ground.
 * - `alwaysShowUniqueSetLabels`: permanently displays ground item name labels for
 *   Unique and Set items without requiring the player to hold `Alt` or hover the item,
 *   while participating in full label collision layout and click-to-pickup hit-testing.
 *
 * When disabled in the Plugin Menu, `PluginHost` automatically releases the capability claim
 * and reverts both settings to 100% authentic Diablo II v1.13c vanilla display (`false`).
 */

import {
  type D2WebPlugin,
  type GroundItemEnhancementsConfig,
  type PluginContext,
  type PluginInstance,
  type PluginStatus,
} from '../../src/client/plugin-host/api.ts'

export interface GroundItemBeamPluginInstance extends PluginInstance {
  getConfig(): GroundItemEnhancementsConfig
  setConfig(patch: Partial<GroundItemEnhancementsConfig>): void
}

export function createGroundItemBeamPlugin(): D2WebPlugin {
  return {
    id: 'ground-item-beam',
    name: {
      zh: '地面物品显示增强',
      en: 'Ground Item Display Enhancements',
    },
    description: {
      zh: '非 1.13c 增强：为地面上的暗金（Unique）与套装（Set）物品渲染暗黑破坏神3风格的冲天掉落光柱，并强制常驻显示物品名称标签（无需按住 Alt，支持直接点击标签拾取）。关闭插件后严格恢复 1.13c 原版显示。',
      en: 'Non-1.13c enhancement: renders Diablo III-style vertical loot beams for Unique (gold) and Set (emerald) items on the ground, and permanently displays their ground name labels without holding Alt (supporting direct label click-to-pickup). Reverts to 1.13c vanilla display when disabled.',
    },
    defaultEnabled: true,
    settings: [
      {
        kind: 'boolean',
        key: 'showUniqueSetBeams',
        label: {
          zh: '暗金/套装地面物品显示暗黑3风格光柱',
          en: 'Show Diablo III-Style Loot Beams for Unique & Set Items',
        },
        default: true,
      },
      {
        kind: 'boolean',
        key: 'alwaysShowUniqueSetLabels',
        label: {
          zh: '暗金/套装地面物品强制常驻显示名字',
          en: 'Always Show Ground Labels for Unique & Set Items',
        },
        default: true,
      },
    ],
    activate(ctx: PluginContext): GroundItemBeamPluginInstance {
      const readSettingsConfig = (): GroundItemEnhancementsConfig => ({
        showUniqueSetBeams: ctx.settings.get('showUniqueSetBeams') === true,
        alwaysShowUniqueSetLabels: ctx.settings.get('alwaysShowUniqueSetLabels') === true,
      })

      ctx.client.setGroundItemEnhancements(readSettingsConfig())

      const unsubClient = ctx.client.subscribeGroundItemEnhancements((clientCfg) => {
        if (ctx.settings.get('showUniqueSetBeams') !== clientCfg.showUniqueSetBeams) {
          ctx.settings.set('showUniqueSetBeams', clientCfg.showUniqueSetBeams)
        }
        if (ctx.settings.get('alwaysShowUniqueSetLabels') !== clientCfg.alwaysShowUniqueSetLabels) {
          ctx.settings.set('alwaysShowUniqueSetLabels', clientCfg.alwaysShowUniqueSetLabels)
        }
        ctx.notifyStatusChanged()
      })

      const unsubSettings = ctx.settings.subscribe((key) => {
        if (key === 'showUniqueSetBeams' || key === 'alwaysShowUniqueSetLabels') {
          ctx.client.setGroundItemEnhancements(readSettingsConfig())
          ctx.notifyStatusChanged()
        }
      })

      const getStatus = (): PluginStatus => {
        const cfg = ctx.client.getGroundItemEnhancements()
        const activeZh: string[] = []
        const activeEn: string[] = []
        if (cfg.showUniqueSetBeams) {
          activeZh.push('掉落光柱')
          activeEn.push('Loot Beams')
        }
        if (cfg.alwaysShowUniqueSetLabels) {
          activeZh.push('名字常驻')
          activeEn.push('Permanent Labels')
        }
        if (activeZh.length === 0) {
          return {
            level: 'ok',
            text: {
              zh: '当前：已全部关闭（原版显示）',
              en: 'Active: None (Vanilla display)',
            },
          }
        }
        return {
          level: 'ok',
          text: {
            zh: `已启用：${activeZh.join(' / ')}`,
            en: `Active: ${activeEn.join(', ')}`,
          },
        }
      }

      return {
        getConfig: () => ctx.client.getGroundItemEnhancements(),
        setConfig: (patch: Partial<GroundItemEnhancementsConfig>) => {
          if (typeof patch.showUniqueSetBeams === 'boolean') {
            ctx.settings.set('showUniqueSetBeams', patch.showUniqueSetBeams)
          }
          if (typeof patch.alwaysShowUniqueSetLabels === 'boolean') {
            ctx.settings.set('alwaysShowUniqueSetLabels', patch.alwaysShowUniqueSetLabels)
          }
        },
        getStatus,
        deactivate(): void {
          unsubSettings()
          unsubClient()
        },
      }
    },
  }
}

export const groundItemBeamPlugin: D2WebPlugin = createGroundItemBeamPlugin()
export default groundItemBeamPlugin
