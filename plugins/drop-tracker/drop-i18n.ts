/**
 * Bilingual (`zh` / `en`) UI strings for `plugins/drop-tracker/`.
 */

import {
  createPluginI18n,
  type GameLang,
  type PluginI18nDictionary,
  type PluginI18nParams,
} from '../../src/client/plugin-host/api.ts'

export type DropI18nKey =
  | 'drop.page.browserTitle'
  | 'drop.page.title'
  | 'drop.page.subtitle'
  | 'drop.sidebar.categories'
  | 'drop.filter.all'
  | 'drop.filter.set'
  | 'drop.filter.unique'
  | 'drop.filter.rune'
  | 'drop.sidebar.statusFilter'
  | 'drop.statusFilter.all'
  | 'drop.statusFilter.lit'
  | 'drop.statusFilter.unlit'
  | 'drop.sidebar.actions'
  | 'drop.filter.langToggle'
  | 'drop.action.backToGame'
  | 'drop.action.exportJson'
  | 'drop.action.clearAll'
  | 'drop.summary.totalLabel'
  | 'drop.summary.totalSub'
  | 'drop.summary.setLabel'
  | 'drop.summary.setSub'
  | 'drop.summary.uniqueLabel'
  | 'drop.summary.uniqueSub'
  | 'drop.summary.runeLabel'
  | 'drop.summary.runeSub'
  | 'drop.search.placeholder'
  | 'drop.search.filteredBadge'
  | 'drop.section.setsTitle'
  | 'drop.section.setsBadge'
  | 'drop.section.groupLitProgress'
  | 'drop.section.uniquesTitle'
  | 'drop.section.uniquesBadge'
  | 'drop.section.runesTitle'
  | 'drop.section.runesBadge'
  | 'drop.section.historyTitle'
  | 'drop.section.historyBadge'
  | 'drop.tier.normal'
  | 'drop.tier.exceptional'
  | 'drop.tier.elite'
  | 'drop.empty.sets'
  | 'drop.empty.uniques'
  | 'drop.empty.runes'
  | 'drop.empty.history'
  | 'drop.history.col.time'
  | 'drop.history.col.category'
  | 'drop.history.col.name'
  | 'drop.history.col.code'
  | 'drop.history.col.area'
  | 'drop.history.unknownArea'
  | 'drop.category.unique'
  | 'drop.category.set'
  | 'drop.category.rune'
  | 'drop.tile.unlit'
  | 'drop.tile.tooltipLit'
  | 'drop.tile.tooltipUnlit'

export const DROP_I18N: PluginI18nDictionary<DropI18nKey> = {
  'drop.page.browserTitle': {
    zh: '掉落统计 — Diablo II Web',
    en: 'Drop Tracker — Diablo II Web',
  },
  'drop.page.title': {
    zh: '掉落统计',
    en: 'Drop Tracker',
  },
  'drop.page.subtitle': {
    zh: 'Diablo II v1.13c 圣杯点亮图鉴与地面掉落记录',
    en: 'Diablo II v1.13c Holy Grail & Ground Drop Log',
  },
  'drop.sidebar.categories': {
    zh: '分类筛选',
    en: 'Categories',
  },
  'drop.filter.all': {
    zh: '全部图鉴',
    en: 'All Grail',
  },
  'drop.filter.set': {
    zh: '绿色套装',
    en: 'Set Items',
  },
  'drop.filter.unique': {
    zh: '暗金传奇',
    en: 'Unique Items',
  },
  'drop.filter.rune': {
    zh: '符文编号 (r01–r33)',
    en: 'Runes (r01–r33)',
  },
  'drop.sidebar.statusFilter': {
    zh: '点亮状态',
    en: 'Light-Up Filter',
  },
  'drop.statusFilter.all': {
    zh: '显示全部',
    en: 'All Items',
  },
  'drop.statusFilter.lit': {
    zh: '仅看已点亮',
    en: 'Lit Only',
  },
  'drop.statusFilter.unlit': {
    zh: '仅看未点亮',
    en: 'Unlit Only',
  },
  'drop.sidebar.actions': {
    zh: '数据操作',
    en: 'Actions',
  },
  'drop.filter.langToggle': {
    zh: '语言: 中文 / EN',
    en: 'Lang: EN / ZH',
  },
  'drop.action.backToGame': {
    zh: '返回游戏',
    en: 'Back to Game',
  },
  'drop.action.exportJson': {
    zh: '导出 JSON',
    en: 'Export JSON',
  },
  'drop.action.clearAll': {
    zh: '清空记录',
    en: 'Clear Drops',
  },
  'drop.summary.totalLabel': {
    zh: '总计掉落',
    en: 'Total Tracked',
  },
  'drop.summary.totalSub': {
    zh: '圣杯点亮 {lit} / {total}',
    en: 'Grail Lit {lit} / {total}',
  },
  'drop.summary.setLabel': {
    zh: '绿色套装',
    en: 'Set Items',
  },
  'drop.summary.setSub': {
    zh: '点亮 {lit} / {total} 件 ({completedSets}/{totalSets} 套)',
    en: 'Lit {lit} / {total} pcs ({completedSets}/{totalSets} sets)',
  },
  'drop.summary.uniqueLabel': {
    zh: '暗金传奇',
    en: 'Unique Items',
  },
  'drop.summary.uniqueSub': {
    zh: '点亮 {lit} / {total} 件',
    en: 'Lit {lit} / {total} items',
  },
  'drop.summary.runeLabel': {
    zh: '符文 (r01–r33)',
    en: 'Runes (r01–r33)',
  },
  'drop.summary.runeSub': {
    zh: '点亮 {lit} / {total} 号',
    en: 'Lit {lit} / {total} runes',
  },
  'drop.search.placeholder': {
    zh: '搜索装备名称、套装、底材、代码或掉落区域...',
    en: 'Search item name, set, base type, code, or drop area...',
  },
  'drop.search.filteredBadge': {
    zh: '当前筛选：{count} 条流水',
    en: 'Filtered: {count} drops',
  },
  'drop.section.setsTitle': {
    zh: '绿色套装点亮图鉴 (按套装组织)',
    en: 'Set Items Grail (Grouped by Set)',
  },
  'drop.section.setsBadge': {
    zh: '已点亮 {lit} / {total} 件 · 齐套 {completedSets} / {totalSets} 套',
    en: 'Lit {lit} / {total} pcs · Completed {completedSets} / {totalSets} sets',
  },
  'drop.section.groupLitProgress': {
    zh: '{lit} / {total} 已点亮',
    en: '{lit} / {total} Lit',
  },
  'drop.section.uniquesTitle': {
    zh: '暗金装备点亮图鉴 (按底材类型与普通 / 扩展 / 精英排序)',
    en: 'Unique Items Grail (By Base Type & Normal / Exceptional / Elite)',
  },
  'drop.section.uniquesBadge': {
    zh: '已点亮 {lit} / {total} 件',
    en: 'Lit {lit} / {total} items',
  },
  'drop.section.runesTitle': {
    zh: '符文点亮图鉴 (#01–#33 按编号排序)',
    en: 'Runes Grail (#01 El – #33 Zod)',
  },
  'drop.section.runesBadge': {
    zh: '已点亮 {lit} / {total} 号',
    en: 'Lit {lit} / {total} runes',
  },
  'drop.section.historyTitle': {
    zh: '掉落流水',
    en: 'Chronological Drop Log',
  },
  'drop.section.historyBadge': {
    zh: '{count} 条',
    en: '{count} entries',
  },
  'drop.tier.normal': {
    zh: '普通',
    en: 'Normal',
  },
  'drop.tier.exceptional': {
    zh: '扩展',
    en: 'Exceptional',
  },
  'drop.tier.elite': {
    zh: '精英',
    en: 'Elite',
  },
  'drop.empty.sets': {
    zh: '暂无符合筛选条件的套装部位',
    en: 'No matching Set pieces',
  },
  'drop.empty.uniques': {
    zh: '暂无符合筛选条件的暗金装备',
    en: 'No matching Unique items',
  },
  'drop.empty.runes': {
    zh: '暂无符合筛选条件的符文',
    en: 'No matching Runes',
  },
  'drop.empty.history': {
    zh: '暂无掉落流水',
    en: 'No drop events recorded yet',
  },
  'drop.history.col.time': {
    zh: '时间',
    en: 'Time',
  },
  'drop.history.col.category': {
    zh: '类别',
    en: 'Category',
  },
  'drop.history.col.name': {
    zh: '名称',
    en: 'Item Name',
  },
  'drop.history.col.code': {
    zh: '代码',
    en: 'Code',
  },
  'drop.history.col.area': {
    zh: '掉落区域',
    en: 'Area',
  },
  'drop.history.unknownArea': {
    zh: '未知区域',
    en: 'Unknown Area',
  },
  'drop.category.unique': {
    zh: '暗金',
    en: 'Unique',
  },
  'drop.category.set': {
    zh: '套装',
    en: 'Set',
  },
  'drop.category.rune': {
    zh: '符文',
    en: 'Rune',
  },
  'drop.tile.unlit': {
    zh: '未点亮',
    en: 'Unlit',
  },
  'drop.tile.tooltipLit': {
    zh: '{name} · {meta} · 已掉落 {count} 次',
    en: '{name} · {meta} · Dropped {count}×',
  },
  'drop.tile.tooltipUnlit': {
    zh: '{name} · {meta} · 未点亮',
    en: '{name} · {meta} · Unlit',
  },
}

export const tDrop: (
  key: DropI18nKey,
  lang: GameLang,
  params?: PluginI18nParams,
) => string = createPluginI18n('drop-tracker', DROP_I18N)
