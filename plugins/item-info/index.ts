/**
 * Item Info & Loot Filter (`item-info`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import type { D2WebPlugin, LocalizedText, LootFilter } from '../../src/client/plugin-host/api.ts'

const LOOT_FILTERS: Record<LootFilter, { readonly option: LocalizedText; readonly status: LocalizedText }> = {
  off: { option: { zh: '关闭', en: 'Off' }, status: { zh: '过滤关闭', en: 'filter off' } },
  junk: { option: { zh: '隐藏垃圾', en: 'Hide junk' }, status: { zh: '隐藏垃圾', en: 'hiding junk' } },
  strict: { option: { zh: '只显示值钱的', en: 'Valuables only' }, status: { zh: '只显示值钱的', en: 'valuables only' } },
}
const isLootFilter = (value: unknown): value is LootFilter => typeof value === 'string' && value in LOOT_FILTERS

export const itemInfoPlugin: D2WebPlugin = {
  id: 'item-info',
  author: 'David-Rodden',
  name: { zh: '物品信息与过滤', en: 'Item Info & Loot Filter' },
  description: {
    zh: '地面物品名称旁显示小图标：凹槽、无形和物品等级。可让名称常显，并用拾取过滤隐藏垃圾。（作者：David-Rodden，感谢贡献！）',
    en: 'Ground labels get small icons for sockets, ethereal and item level, and tooltips show the item level. Labels can stay up without holding Alt, and the loot filter hides junk. (Author: David-Rodden — Special thanks for contributing!)',
  },
  defaultEnabled: true,
  settings: [
    { kind: 'boolean', key: 'itemLevel', label: { zh: '物品提示显示物品等级', en: 'Item level in tooltips' }, default: true },
    { kind: 'boolean', key: 'labelDetails', label: { zh: '地面名称显示图标', en: 'Icons on ground labels' }, default: true },
    { kind: 'boolean', key: 'alwaysShow', label: { zh: '地面物品名称常显（无需 Alt）', en: 'Always show ground labels (no Alt)' }, default: false },
    { kind: 'select', key: 'lootFilter', label: { zh: '拾取过滤', en: 'Loot filter' }, default: 'off', options: Object.entries(LOOT_FILTERS).map(([value, { option }]) => ({ value, label: option })) },
  ],
  activate(ctx) {
    const isOn = (key: string) => ctx.settings.get(key) === true
    const lootFilter = () => {
      const value = ctx.settings.get('lootFilter')
      return isLootFilter(value) ? value : 'off'
    }
    const apply = () => ctx.itemInfo.setConfig({ itemLevel: isOn('itemLevel'), labelDetails: isOn('labelDetails'), alwaysShow: isOn('alwaysShow'), lootFilter: lootFilter() })
    apply()
    const unsubscribe = ctx.settings.subscribe(apply)
    return {
      getStatus: () => {
        const config = ctx.itemInfo.getConfig()
        if (!config) return { level: 'warn', text: { zh: '未开启', en: 'Inactive' } }
        const filter = LOOT_FILTERS[config.lootFilter].status
        return { level: 'ok', text: { zh: `${config.alwaysShow ? '名称常显' : '按 Alt 显示'} · ${filter.zh}`, en: `${config.alwaysShow ? 'Labels always on' : 'Labels on Alt'} · ${filter.en}` } }
      },
      deactivate: () => {
        unsubscribe()
        ctx.itemInfo.setConfig(null)
      },
    }
  },
}
