/**
 * Path Guide (`path-guide`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import type { D2WebPlugin, GuideMode, LocalizedText } from '../../src/client/plugin-host/api.ts'

const MODES: Record<GuideMode, { readonly option: LocalizedText; readonly status: LocalizedText }> = {
  story: { option: { zh: '全部任务', en: 'Every quest' }, status: { zh: '全部任务', en: 'Every quest' } },
  required: { option: { zh: '只做主线', en: 'Required quests only' }, status: { zh: '只做主线', en: 'Required quests' } },
}
const PILOT_KEYS = ['Y', 'U', 'J', 'L', 'V'] as const
const isMode = (value: unknown): value is GuideMode => typeof value === 'string' && value in MODES

export const pathGuidePlugin: D2WebPlugin = {
  id: 'path-guide',
  author: 'David-Rodden',
  name: { zh: '路线指引', en: 'Path Guide' },
  description: {
    zh: '按任务日志的当前步骤指路：小地图和地面上画出路线，并给目标物件和路上的门描边。按自动驾驶键后会替你玩：沿路线走、开门、用传送点、和NPC对话，回城治疗、买药、修理和存仓库；血少或药喝完时会先回城，还可以按常用加点替你分配技能点和属性点；开了自动战斗还会替你打怪。（作者：David-Rodden，感谢贡献！）',
    en: 'Follows your quest log step by step: a route on the minimap and the ground, using your waypoints, with outlines on the objects and doors along the way. Press the autopilot key and it plays for you: it walks the route, opens doors, takes waypoints, talks to NPCs, and visits town to heal, buy potions, repair and stash. It heads back to town when life runs low or the potions run out, and can spend your skill and stat points on a proven build. With Auto-Fight on, it fights too. (Author: David-Rodden — Special thanks for contributing!)',
  },
  defaultEnabled: true,
  settings: [
    { kind: 'select', key: 'mode', label: { zh: '指引', en: 'Guide to' }, default: 'story', options: Object.entries(MODES).map(([value, { option }]) => ({ value, label: option })) },
    {
      kind: 'select',
      key: 'autopilot',
      label: { zh: '自动驾驶按键', en: 'Autopilot key' },
      default: 'Y',
      options: [{ value: 'off', label: { zh: '关闭', en: 'Off' } }, ...PILOT_KEYS.map((key) => ({ value: key, label: { zh: key, en: key } }))],
    },
    {
      kind: 'select',
      key: 'points',
      label: { zh: '自动驾驶加点', en: 'Autopilot spends points' },
      default: 'off',
      options: [
        { value: 'off', label: { zh: '不加，我自己来', en: "No, I'll spend them" } },
        { value: 'build', label: { zh: '按职业的常用加点', en: 'Yes, on a proven build for my class' } },
      ],
    },
  ],
  activate(ctx) {
    const apply = () => {
      const mode = ctx.settings.get('mode')
      const key = String(ctx.settings.get('autopilot'))
      ctx.pathGuide.setMode(isMode(mode) ? mode : 'story')
      ctx.autopilot.setKey(key === 'off' ? null : key)
      ctx.spendPoints.setEnabled(ctx.settings.get('points') === 'build')
    }
    apply()
    const unsubscribe = ctx.settings.subscribe(apply)
    return {
      getStatus: () => {
        const mode = ctx.pathGuide.getMode()
        const key = ctx.autopilot.getKey()
        if (!mode) return { level: 'warn', text: { zh: '未开启', en: 'Inactive' } }
        return { level: 'ok', text: key ? { zh: `${MODES[mode].status.zh} · 按 ${key} 自动驾驶`, en: `${MODES[mode].status.en} · ${key} for autopilot` } : MODES[mode].status }
      },
      deactivate: () => {
        unsubscribe()
        ctx.pathGuide.setMode(null)
        ctx.autopilot.setKey(null)
        ctx.spendPoints.setEnabled(false)
      },
    }
  },
}
