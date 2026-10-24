/**
 * Loot Alerts (`loot-alerts`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import type { D2WebPlugin } from '../../src/client/plugin-host/api.ts'
import { appraisalContextOf } from '../../src/common/items/loot-context.ts'
import type { ItemData } from '../../src/netproto/index.ts'
import { lootAlert, type AlertLevel } from './alerts.ts'

export const lootAlertsPlugin: D2WebPlugin = {
  id: 'loot-alerts',
  author: 'David-Rodden',
  name: { zh: '掉落提醒', en: 'Loot Alerts' },
  description: {
    zh: '怪物掉落对你的角色有用的好东西时，在屏幕上方弹出提示，并说明好在哪里。（作者：David-Rodden，感谢贡献！）',
    en: 'Pops a banner at the top of the screen when a monster drops loot worth having for your character, and says why. (Author: David-Rodden — Special thanks for contributing!)',
  },
  defaultEnabled: true,
  settings: [
    {
      kind: 'select',
      key: 'level',
      label: { zh: '提醒哪些', en: 'Announce' },
      default: 'smart',
      options: [
        { value: 'smart', label: { zh: '对我的角色有用的', en: 'Whatever helps my character' } },
        { value: 'notable', label: { zh: '暗金、套装、符文', en: 'Uniques, sets and runes' } },
        { value: 'valuable', label: { zh: '再加稀有、护身符、珠宝、完美宝石', en: 'Also rares, charms, jewels and perfect gems' } },
        { value: 'runes', label: { zh: '只提醒符文', en: 'Runes only' } },
      ],
    },
  ],
  activate(ctx) {
    const announced = new Set<number>()
    const unsubscribe = ctx.session.onServerEvent((ev) => {
      if (ev.type !== 'ItemEvent' || ev.container !== 'ground' || typeof ev.action !== 'number') return
      const item = ev.item as ItemData | undefined
      if (!item || announced.has(item.id)) return
      const toast = lootAlert(ev.action, item, ctx.settings.get('level') as AlertLevel, ctx.session.world.areaId, appraisalContextOf(ctx.session.world))
      if (toast === null) return
      announced.add(item.id)
      ctx.notify.show(toast)
    })
    const unsubscribeState = ctx.session.onStateChange((snap) => {
      if (snap.phase !== 'ingame') announced.clear()
    })
    return {
      deactivate: () => {
        unsubscribe()
        unsubscribeState()
      },
    }
  },
}
