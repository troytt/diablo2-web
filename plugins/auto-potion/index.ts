import type { AutoPotionThresholds, D2WebPlugin, LocalizedText } from '../../src/client/plugin-host/api.ts'

const THRESHOLDS: readonly { readonly key: keyof AutoPotionThresholds; readonly label: LocalizedText; readonly options: readonly number[]; readonly default: number }[] = [
  { key: 'life', label: { zh: '生命低于时喝治疗药剂', en: 'Healing potion below life' }, options: [0, 30, 40, 50, 60, 70, 80], default: 50 },
  { key: 'rejuv', label: { zh: '生命低于时喝回复药剂', en: 'Rejuvenation below life' }, options: [0, 15, 20, 25, 30, 35], default: 25 },
  { key: 'mana', label: { zh: '法力低于时喝法力药剂', en: 'Mana potion below mana' }, options: [0, 10, 20, 30, 40, 50], default: 20 },
  { key: 'merc', label: { zh: '佣兵生命低于时喂药', en: 'Feed mercenary below life' }, options: [0, 30, 40, 50, 60], default: 40 },
]

const optionLabel = (value: number): LocalizedText => (value === 0 ? { zh: '关闭', en: 'Off' } : { zh: `${value}%`, en: `${value}%` })

export const autoPotionPlugin: D2WebPlugin = {
  id: 'auto-potion',
  name: { zh: '自动喝药', en: 'Auto-Potion' },
  description: {
    zh: '非 1.13c 增强：生命或法力过低时自动喝药，优先使用背包中的药剂，背包没有时再用腰带。生命危急时优先喝回复药剂；否则选用刚好能补满缺口的最小治疗/法力药剂，并等上一瓶的持续回复结束后再喝下一瓶，避免浪费。佣兵生命过低时自动从腰带喂治疗药剂（相当于 Shift+数字键）。腰带只使用每列最下方的药剂，城镇中暂停；背包和腰带中都没有治疗药剂（或法力不足时没有法力药剂）时，生命球上方会显示红色提示。各阈值可在设置中调整。关闭插件即恢复原版行为。',
    en: "Non-1.13c enhancement: drinks a potion when life or mana runs low, using potions in your inventory first and the belt only when the inventory has none of the right kind. At critical life it reaches for a rejuvenation potion first; otherwise it picks the smallest healing or mana potion that covers what you're missing, and waits for the previous potion's heal-over-time to finish before drinking another so nothing is wasted. When your mercenary's life drops it feeds them a healing potion from the belt (like Shift+number). Only the bottom potion of each belt column is used, it pauses in town, and a red notice above the life orb warns you when neither your inventory nor your belt has healing potions left, or mana potions while your mana is low. Every threshold can be changed in the settings. Disabling restores vanilla behavior.",
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
      deactivate: () => (unsubscribe(), ctx.autoPotion.setThresholds(null)),
    }
  },
}
