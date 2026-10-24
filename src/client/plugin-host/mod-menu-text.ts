import type { GameLang } from '../i18n/lang.ts'
import type { PluginMenuCardViewModel } from './plugin-menu-model.ts'

interface Text {
  readonly zh: string
  readonly en: string
}

export interface PlainText {
  readonly name?: Text
  readonly description?: Text
  readonly settings?: Readonly<Record<string, Text>>
}

export interface MenuLayout {
  readonly groupOf: Readonly<Record<string, GroupId>>
  readonly plain: Readonly<Record<string, PlainText>>
}

export const NO_LAYOUT: MenuLayout = { groupOf: {}, plain: {} }

const say = (text: Text, lang: GameLang) => (lang === 'en' ? text.en : text.zh)

export const MENU_TEXT = {
  title: { zh: '插件', en: 'Plugins' },
  subtitle: { zh: '原版之外的小功能。全部关掉，就是原汁原味的 1.13c。', en: "Extras on top of the original game. Switch any of them off and you're back to plain 1.13c." },
  search: { zh: '搜索插件', en: 'Search plugins' },
  close: { zh: '关闭 (Esc)', en: 'Close (Esc)' },
  on: { zh: '开', en: 'On' },
  off: { zh: '关', en: 'Off' },
  noSettings: { zh: '没有需要调的选项。', en: 'Nothing to set up here.' },
  disabled: { zh: '打开后才能调整选项。', en: 'Turn it on to change its options.' },
  nothing: { zh: '没有找到“{q}”', en: 'Nothing matches "{q}"' },
  count: { zh: '已开启 {on}/{all}', en: '{on} of {all} on' },
  reset: { zh: '全部恢复默认', en: 'Reset everything' },
  empty: { zh: '还没有插件。', en: 'No plugins yet.' },
  authorCredit: { zh: '作者：{author} · 感谢贡献！', en: 'Author: {author} · Special thanks for contributing!' },
} as const satisfies Record<string, Text>

export type MenuTextKey = keyof typeof MENU_TEXT

export const menuText = (key: MenuTextKey, lang: GameLang, values: Readonly<Record<string, string | number>> = {}): string =>
  Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), say(MENU_TEXT[key], lang))

export type GroupId = 'combat' | 'loot' | 'map' | 'tracking' | 'interface' | 'other'

const GROUPS: readonly (readonly [GroupId, Text])[] = [
  ['combat', { zh: '战斗', en: 'Combat' }],
  ['loot', { zh: '物品', en: 'Loot' }],
  ['map', { zh: '地图与指引', en: 'Map & Guide' }],
  ['tracking', { zh: '统计', en: 'Tracking' }],
  ['interface', { zh: '界面', en: 'Interface' }],
  ['other', { zh: '其他', en: 'Other' }],
]

export const plainCard = (card: PluginMenuCardViewModel, lang: GameLang, layout: MenuLayout = NO_LAYOUT): PluginMenuCardViewModel => {
  const plain = layout.plain[card.id]
  if (!plain) return card
  return {
    ...card,
    name: plain.name ? say(plain.name, lang) : card.name,
    description: plain.description ? say(plain.description, lang) : card.description,
    settings: card.settings.map((setting) => {
      const label = plain.settings?.[setting.key]
      return label ? { ...setting, label: say(label, lang) } : setting
    }),
  }
}

export interface MenuSection {
  readonly id: GroupId
  readonly title: string
  readonly cards: readonly PluginMenuCardViewModel[]
}

const matches = (card: PluginMenuCardViewModel, groupTitle: string, query: string) =>
  query.length === 0 || [card.name, card.description, groupTitle].some((text) => text.toLowerCase().includes(query))

export const menuSections = (cards: readonly PluginMenuCardViewModel[], lang: GameLang, query = '', layout: MenuLayout = NO_LAYOUT): MenuSection[] => {
  const needle = query.trim().toLowerCase()
  return GROUPS.map(([id, title]) => ({ id, title: say(title, lang) }))
    .map((group) => ({ ...group, cards: cards.filter((card) => (layout.groupOf[card.id] ?? 'other') === group.id && matches(card, group.title, needle)).sort((a, b) => a.name.localeCompare(b.name, lang)) }))
    .filter((group) => group.cards.length > 0)
}
