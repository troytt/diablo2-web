/**
 * Auto-Potion (`auto-potion`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import type { AutoPotionThresholds, D2WebPlugin, LocalizedText } from '../../src/client/plugin-host/api.ts'

const THRESHOLDS: readonly { readonly key: keyof AutoPotionThresholds; readonly label: LocalizedText; readonly options: readonly number[]; readonly default: number }[] = [
  { key: 'life', label: { zh: '生命低于时喝治疗药剂', en: 'Healing potion below life' }, options: [0, 30, 40, 50, 60, 65, 70, 80], default: 65 },
  { key: 'rejuv', label: { zh: '生命低于时喝回复药剂', en: 'Rejuvenation below life' }, options: [0, 15, 20, 25, 30, 35, 40, 50], default: 35 },
  { key: 'mana', label: { zh: '法力低于时喝法力药剂', en: 'Mana potion below mana' }, options: [0, 10, 20, 30, 40, 50], default: 20 },
  { key: 'merc', label: { zh: '佣兵生命低于时喂药', en: 'Feed mercenary below life' }, options: [0, 30, 40, 50, 60], default: 40 },
]

const optionLabel = (value: number): LocalizedText => (value === 0 ? { zh: '关闭', en: 'Off' } : { zh: `${value}%`, en: `${value}%` })

export const autoPotionPlugin: D2WebPlugin = {
  id: 'auto-potion',
  author: 'David-Rodden',
  name: { zh: '自动喝药', en: 'Auto-Potion' },
  description: {
    zh: '生命或法力过低时自动喝药，先用背包里的，再用腰带。危急时喝回复药剂，也会喂佣兵，药快用完时会捡地上的药。（作者：David-Rodden，感谢贡献！）',
    en: "Drinks a potion when life or mana runs low, inventory first, then belt. Uses rejuvenations when things get critical, feeds your mercenary, and picks potions up when you're running out. (Author: David-Rodden — Special thanks for contributing!)",
  },
  defaultEnabled: false,
  settings: THRESHOLDS.map(({ key, label, options, default: value }) => ({
    kind: 'select' as const,
    key,
    label,
    default: String(value),
    options: options.map((option) => ({ value: String(option), label: optionLabel(option) })),
  })),
  activate(ctx) {
    const read = (key: keyof AutoPotionThresholds): number => {
      const value = Number(ctx.settings.get(key))
      return Number.isFinite(value) && value >= 0 ? value : (THRESHOLDS.find((t) => t.key === key)?.default ?? 0)
    }
    const apply = () => ctx.autoPotion.setThresholds({ life: read('life'), rejuv: read('rejuv'), mana: read('mana'), merc: read('merc') })
    apply()
    const unsubscribe = ctx.settings.subscribe(apply)
    return {
      getStatus: () => {
        const thresholds = ctx.autoPotion.getThresholds()
        return thresholds
          ? { level: 'ok', text: { zh: `生命 ${thresholds.life}% / 法力 ${thresholds.mana}%`, en: `Life ${thresholds.life}% / mana ${thresholds.mana}%` } }
          : { level: 'warn', text: { zh: '未开启', en: 'Inactive' } }
      },
      deactivate: () => {
        unsubscribe()
        ctx.autoPotion.setThresholds(null)
      },
    }
  },
}
