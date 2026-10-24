/**
 * Town Portal Key (`town-portal-key`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import type { D2WebPlugin } from '../../src/client/plugin-host/api.ts'

const KEYS = ['G', 'F', 'Y', 'U', 'J', 'K', 'L', 'X'] as const

export const townPortalKeyPlugin: D2WebPlugin = {
  id: 'town-portal-key',
  author: 'David-Rodden',
  name: { zh: '回城快捷键', en: 'Town Portal Key' },
  description: {
    zh: '按一下就开回城门，先用传送书，书空了再用卷轴。不用打开物品栏。（作者：David-Rodden，感谢贡献！）',
    en: 'Press the key to open a Town Portal. It uses your tome first and falls back to a loose scroll, without opening the inventory. (Author: David-Rodden — Special thanks for contributing!)',
  },
  defaultEnabled: true,
  settings: [
    {
      kind: 'select',
      key: 'key',
      label: { zh: '按键', en: 'Key' },
      default: 'G',
      options: KEYS.map((key) => ({ value: key, label: { zh: key, en: key } })),
    },
  ],
  activate(ctx) {
    const apply = () => ctx.townPortal.setKey(String(ctx.settings.get('key') || 'G'))
    apply()
    const unsubscribe = ctx.settings.subscribe(apply)
    return {
      getStatus: () => {
        const key = ctx.townPortal.getKey()
        return key ? { level: 'ok', text: { zh: `按 ${key} 回城`, en: `Press ${key} for a portal` } } : { level: 'warn', text: { zh: '未开启', en: 'Inactive' } }
      },
      deactivate: () => {
        unsubscribe()
        ctx.townPortal.setKey(null)
      },
    }
  },
}
