/**
 * Quick Cast Plugin (`plugins/quick-cast/index.ts`, Issue #952).
 *
 * NOT 1.13c: PD2 / D2R-style Quick Cast as a single toggle — zero configuration.
 *
 * - The vanilla binding flow is untouched: press `S` to open the skill popup, hover a skill,
 *   press a bindable skill hotkey (vanilla 1.13c: `F1..F8`) to bind it. The bindable key
 *   range is owned by the binding flow (`SKILL_HOTKEY_KEY_RE_113C`), not by this plugin.
 * - While this plugin is enabled, pressing a bound skill hotkey no longer switches the
 *   active skill selection: it casts the bound skill immediately at the mouse cursor
 *   (`CommandMapper.quickCastMode`). Execution follows the binding maps, so any key the
 *   binding flow ever supports is cast-able here automatically. The cast executes the
 *   original wire sequence `SelectSkill (0x3C)` → `SkillAt`/`SkillOn` → `SelectSkill`
 *   restore, and all vanilla gates (town skill restrictions, cast lock, cooldown, gold
 *   dialog) stay enforced.
 * - Disabling the plugin releases the capability claim and restores the vanilla
 *   select-on-press behavior (PluginHost automatic claim teardown).
 */

import {
  type D2WebPlugin,
  type PluginContext,
  type PluginInstance,
  type PluginStatus,
} from '../../src/client/plugin-host/api.ts'

export function createQuickCastPlugin(): D2WebPlugin {
  return {
    id: 'quick-cast',
    name: {
      zh: '快捷施法（按键直接施放）',
      en: 'Quick Cast (cast on keybind)',
    },
    description: {
      zh: '非 1.13c 增强（PD2 / D2R 同款）：纯开关、零配置。原版绑定方式完全不变——按 S 打开技能列表，悬停技能按可绑定的技能快捷键（当前为原版 F1-F8）完成绑定。插件开启后，按下已绑定的快捷键不再切换当前技能，而是立即在鼠标光标处施放该技能（内部按原版网络序列“切换技能→施法→还原”执行，城镇禁技、施法锁定与冷却等原版规则全部保留）；绑定支持哪些按键由绑定流程决定，本插件只接管按键后的行为。关闭插件即恢复原版切换技能行为。',
      en: 'Non-1.13c enhancement (PD2 / D2R parity): a single toggle with zero configuration. The native binding flow is unchanged — open the skill list with S, hover a skill, press a bindable skill hotkey (currently the vanilla F1-F8) to bind it. While enabled, pressing a bound hotkey no longer switches the active skill — it casts that skill instantly at the mouse cursor via the vanilla wire sequence select -> cast -> restore, with all vanilla gates (town restrictions, cast lock, cooldown) enforced. The set of supported keys follows whatever the binding flow allows; this plugin only takes over what a press does. Disabling restores vanilla behavior.',
    },
    defaultEnabled: true,
    activate(ctx: PluginContext): PluginInstance {
      ctx.quickCast.setEnabled(true)
      return {
        getStatus(): PluginStatus {
          const active = ctx.quickCast.isEnabled()
          return {
            level: active ? 'ok' : 'warn',
            text: active
              ? { zh: '已开启', en: 'Active' }
              : { zh: '未开启', en: 'Inactive' },
          }
        },
        deactivate(): void {
          // PluginHost releases the capability claim automatically; explicit release here
          // keeps the plugin self-contained for hosts without claim teardown.
          ctx.quickCast.setEnabled(false)
        },
      }
    },
  }
}

export const quickCastPlugin: D2WebPlugin = createQuickCastPlugin()
