/**
 * Auto Pickup (`auto-gold-pickup`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import type { AutoLootRules, D2WebPlugin, LocalizedText, LootCategories, PluginSettingSpec } from '../../src/client/plugin-host/api.ts'
import { describeBuild } from '../../src/common/items/character-build.ts'
import { appraisalContextOf } from '../../src/common/items/loot-context.ts'

const CATEGORIES: readonly { readonly key: keyof LootCategories; readonly label: LocalizedText; readonly default: boolean }[] = [
  { key: 'runes', label: { zh: '符文', en: 'Runes' }, default: true },
  { key: 'uniques', label: { zh: '暗金物品', en: 'Unique items' }, default: true },
  { key: 'sets', label: { zh: '套装物品', en: 'Set items' }, default: true },
  { key: 'charms', label: { zh: '护身符', en: 'Charms' }, default: true },
  { key: 'jewels', label: { zh: '珠宝', en: 'Jewels' }, default: true },
  { key: 'gems', label: { zh: '无瑕和完美宝石', en: 'Flawless and perfect gems' }, default: false },
  { key: 'rares', label: { zh: '稀有物品', en: 'Rare items' }, default: false },
]

const PICKS_ITEMS = { key: 'pickup', is: ['both', 'items'] } as const
const BY_CATEGORY = { key: 'choose', is: ['categories'] } as const

const SETTINGS: readonly PluginSettingSpec[] = [
  {
    kind: 'select',
    key: 'pickup',
    label: { zh: '捡什么', en: 'Pick up' },
    default: 'both',
    options: [
      { value: 'both', label: { zh: '金币和物品', en: 'Gold and items' } },
      { value: 'gold', label: { zh: '只捡金币', en: 'Gold only' } },
      { value: 'items', label: { zh: '只捡物品', en: 'Items only' } },
    ],
  },
  {
    kind: 'select',
    key: 'choose',
    label: { zh: '哪些物品', en: 'Which items' },
    default: 'smart',
    shownWhen: [PICKS_ITEMS],
    options: [
      { value: 'smart', label: { zh: '对我的角色有用的', en: 'Whatever helps my character' } },
      { value: 'great', label: { zh: '只要极品', en: 'Only great finds for my character' } },
      { value: 'categories', label: { zh: '我自己选类别', en: 'Categories I choose' } },
    ],
  },
  ...CATEGORIES.map(({ key, label, default: value }) => ({ kind: 'boolean' as const, key, label, default: value, shownWhen: [PICKS_ITEMS, BY_CATEGORY] })),
  { kind: 'boolean', key: 'makeRoom', label: { zh: '背包满了就整理，必要时丢掉垃圾', en: 'Make room for better loot (rearrange, then drop junk)' }, default: true, shownWhen: [PICKS_ITEMS] },
  { kind: 'boolean', key: 'sellJunk', label: { zh: '和商人交易时卖掉垃圾', en: 'Sell junk when trading with a vendor' }, default: true },
  { kind: 'boolean', key: 'stashValuables', label: { zh: '打开仓库时存入符文、宝石等好东西', en: 'Stash runes, gems and other valuables when you open the stash' }, default: true },
]

const listText = (parts: readonly string[]): string => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`)

export const autoGoldPickupPlugin: D2WebPlugin = {
  id: 'auto-gold-pickup',
  author: 'David-Rodden',
  name: { zh: '自动拾取', en: 'Auto Pickup' },
  description: {
    zh: '自动捡起附近的金币和好东西。会看你的职业、技能和装备，判断什么对你有用，并帮你整理背包、卖垃圾、存仓库。（作者：David-Rodden，感谢贡献！）',
    en: "Picks up gold and loot near you. It reads your class, skills and gear to judge what's worth having, and can tidy your inventory, sell junk and stash valuables. (Author: David-Rodden — Special thanks for contributing!)",
  },
  defaultEnabled: false,
  settings: SETTINGS,
  activate(ctx) {
    const setting = (key: string) => ctx.settings.get(key)
    const lootRules = (): AutoLootRules | null => {
      if (setting('pickup') === 'gold') return null
      const choose = setting('choose')
      if (choose !== 'categories') return { mode: 'smart', minTier: choose === 'great' ? 'great' : 'good' }
      return { mode: 'categories', ...(Object.fromEntries(CATEGORIES.map(({ key }) => [key, setting(key) === true])) as unknown as LootCategories) }
    }
    const apply = () => {
      ctx.autoGoldPickup.setEnabled(setting('pickup') !== 'items')
      ctx.autoLoot.setRules(lootRules())
      ctx.inventoryCare.setConfig({ makeRoom: setting('pickup') !== 'gold' && setting('makeRoom') === true, sellJunk: setting('sellJunk') === true, stashValuables: setting('stashValuables') === true })
    }
    apply()
    const unsubscribe = ctx.settings.subscribe(apply)
    const buildText = () => {
      const { build } = appraisalContextOf(ctx.session.world)
      return build.classIndex < 0 ? null : describeBuild(build)
    }
    return {
      getStatus: () => {
        const rules = ctx.autoLoot.getRules()
        const items = rules === null ? [] : rules.mode === 'smart' ? [rules.minTier === 'great' ? 'great finds' : 'useful items'] : CATEGORIES.filter(({ key }) => rules[key]).map(({ label }) => label.en.toLowerCase())
        const picked = listText([...(ctx.autoGoldPickup.isEnabled() ? ['gold'] : []), ...items])
        const build = rules?.mode === 'smart' ? buildText() : null
        if (!picked) return { level: 'warn', text: { zh: '没有选择任何物品', en: 'Nothing selected' } }
        return { level: 'ok', text: { zh: '已开启', en: `Picking up ${picked}${build ? ` for a ${build}` : ''}` } }
      },
      deactivate: () => {
        unsubscribe()
        ctx.autoGoldPickup.setEnabled(false)
        ctx.autoLoot.setRules(null)
        ctx.inventoryCare.setConfig(null)
      },
    }
  },
}
