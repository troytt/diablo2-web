/**
 * Bilingual (`zh` / `en`) UI strings for `stats.html`.
 */

import {
  createPluginI18n,
  type GameLang,
  type LocalizedText,
  type PluginI18nDictionary,
  type PluginI18nParams,
} from '../../src/client/plugin-host/api.ts'

export type StatsI18nKey =
  | 'stats.page.title'
  | 'stats.sidebar.title'
  | 'stats.sidebar.allAccounts'
  | 'stats.sidebar.emptyAccounts'
  | 'stats.sidebar.killsSuffix'
  | 'stats.badge.hc'
  | 'stats.badge.sc'
  | 'stats.badge.ladder'
  | 'stats.badge.expansion'
  | 'stats.badge.classic'
  | 'stats.summary.normal'
  | 'stats.summary.nightmare'
  | 'stats.summary.hell'
  | 'stats.summary.total'
  | 'stats.filter.soloOnly'
  | 'stats.filter.showUnkilled'
  | 'stats.filter.langToggle'
  | 'stats.action.exportJson'
  | 'stats.action.importJson'
  | 'stats.action.deleteCharacter'
  | 'stats.action.clearAll'
  | 'stats.action.backToGame'
  | 'stats.confirm.deleteCharacter'
  | 'stats.confirm.clearAll'
  | 'stats.board.title'
  | 'stats.board.subtitle'
  | 'stats.board.col.name'
  | 'stats.board.col.kind'
  | 'stats.board.col.normal'
  | 'stats.board.col.nightmare'
  | 'stats.board.col.hell'
  | 'stats.board.col.total'
  | 'stats.board.col.lastAt'
  | 'stats.board.kind.boss'
  | 'stats.board.kind.superunique'
  | 'stats.board.empty'
  | 'stats.monsters.title'
  | 'stats.monsters.searchPlaceholder'
  | 'stats.monsters.col.hcIdx'
  | 'stats.monsters.col.name'
  | 'stats.monsters.col.normal'
  | 'stats.monsters.col.nightmare'
  | 'stats.monsters.col.hell'
  | 'stats.monsters.col.total'
  | 'stats.monsters.empty'
  | 'stats.emptyState.title'
  | 'stats.emptyState.body'
  | 'stats.footnote.attribution'
  | 'stats.import.successSummary'
  | 'stats.import.successDetail'
  | 'stats.notice.pluginDisabled'
  | 'stats.error.idbUnavailable'
  | 'stats.error.idbBlocked'
  | 'stats.error.idbVersionChange'
  | 'stats.error.importFailedPrefix'
  | 'stats.error.bootFailedPrefix'

export const STATS_I18N: PluginI18nDictionary<StatsI18nKey> = {
  'stats.page.title': {
    zh: '暗黑破坏神 II · 怪物击杀统计',
    en: 'Diablo II · Monster Kill Statistics',
  },
  'stats.sidebar.title': {
    zh: '账号与角色',
    en: 'Accounts & Characters',
  },
  'stats.sidebar.allAccounts': {
    zh: '全部账号',
    en: 'All Accounts',
  },
  'stats.sidebar.emptyAccounts': {
    zh: '暂无角色记录',
    en: 'No characters recorded yet',
  },
  'stats.sidebar.killsSuffix': {
    zh: '击杀',
    en: 'kills',
  },
  'stats.badge.hc': {
    zh: 'HC',
    en: 'HC',
  },
  'stats.badge.sc': {
    zh: 'SC',
    en: 'SC',
  },
  'stats.badge.ladder': {
    zh: 'L',
    en: 'L',
  },
  'stats.badge.expansion': {
    zh: 'EXP',
    en: 'EXP',
  },
  'stats.badge.classic': {
    zh: 'CL',
    en: 'CL',
  },
  'stats.summary.normal': {
    zh: '普通',
    en: 'Normal',
  },
  'stats.summary.nightmare': {
    zh: '噩梦',
    en: 'Nightmare',
  },
  'stats.summary.hell': {
    zh: '地狱',
    en: 'Hell',
  },
  'stats.summary.total': {
    zh: '总击杀',
    en: 'Total Kills',
  },
  'stats.filter.soloOnly': {
    zh: '仅单人局',
    en: 'Solo Only',
  },
  'stats.filter.showUnkilled': {
    zh: '显示未击杀',
    en: 'Show Unkilled',
  },
  'stats.filter.langToggle': {
    zh: '语言: 中文 / EN',
    en: 'Lang: EN / ZH',
  },
  'stats.action.exportJson': {
    zh: '导出 JSON',
    en: 'Export JSON',
  },
  'stats.action.importJson': {
    zh: '导入 JSON',
    en: 'Import JSON',
  },
  'stats.action.deleteCharacter': {
    zh: '删除角色',
    en: 'Delete Character',
  },
  'stats.action.clearAll': {
    zh: '清空全部',
    en: 'Clear All',
  },
  'stats.action.backToGame': {
    zh: '返回游戏',
    en: 'Back to Game',
  },
  'stats.confirm.deleteCharacter': {
    zh: '确定要删除当前选中角色的击杀统计记录吗？',
    en: 'Are you sure you want to delete kill statistics for the selected character?',
  },
  'stats.confirm.clearAll': {
    zh: '确定要清空本浏览器内所有账号和角色的击杀统计记录吗？',
    en: 'Are you sure you want to clear all kill statistics across all accounts and characters?',
  },
  'stats.board.title': {
    zh: '首领与超级精英击杀榜',
    en: 'Boss & SuperUnique Kill Board',
  },
  'stats.board.subtitle': {
    zh: '1.13c 原版 24 首领 + 66 超级精英（合并 4 重叠项，共 86 项）',
    en: '1.13c Ground Truth: 24 Bosses + 66 SuperUniques (4 overlaps merged = 86 rows)',
  },
  'stats.board.col.name': {
    zh: '名称',
    en: 'Name',
  },
  'stats.board.col.kind': {
    zh: '类别',
    en: 'Category',
  },
  'stats.board.col.normal': {
    zh: '普通',
    en: 'Normal',
  },
  'stats.board.col.nightmare': {
    zh: '噩梦',
    en: 'Nightmare',
  },
  'stats.board.col.hell': {
    zh: '地狱',
    en: 'Hell',
  },
  'stats.board.col.total': {
    zh: '合计',
    en: 'Total',
  },
  'stats.board.col.lastAt': {
    zh: '最近击杀',
    en: 'Last Kill',
  },
  'stats.board.kind.boss': {
    zh: '首领',
    en: 'Boss',
  },
  'stats.board.kind.superunique': {
    zh: '超级精英',
    en: 'SuperUnique',
  },
  'stats.board.empty': {
    zh: '当前筛选条件下暂无首领或超级精英击杀记录',
    en: 'No Boss or SuperUnique kills under the current filter',
  },
  'stats.monsters.title': {
    zh: '怪物类型 × 难度击杀表',
    en: 'Monster Type × Difficulty Kills',
  },
  'stats.monsters.searchPlaceholder': {
    zh: '搜索怪物中文名 / 英文名 / ID...',
    en: 'Search monster Chinese / English name / ID...',
  },
  'stats.monsters.col.hcIdx': {
    zh: 'ID (hcIdx)',
    en: 'ID (hcIdx)',
  },
  'stats.monsters.col.name': {
    zh: '怪物名称',
    en: 'Monster Name',
  },
  'stats.monsters.col.normal': {
    zh: '普通',
    en: 'Normal',
  },
  'stats.monsters.col.nightmare': {
    zh: '噩梦',
    en: 'Nightmare',
  },
  'stats.monsters.col.hell': {
    zh: '地狱',
    en: 'Hell',
  },
  'stats.monsters.col.total': {
    zh: '合计',
    en: 'Total',
  },
  'stats.monsters.empty': {
    zh: '暂无匹配的怪物击杀记录',
    en: 'No matching monster kills recorded',
  },
  'stats.emptyState.title': {
    zh: '暂无怪物击杀数据',
    en: 'No Monster Kill Statistics Recorded Yet',
  },
  'stats.emptyState.body': {
    zh: '在 play.html 进入游戏击杀敌对怪物后，统计数据将自动写入本地 IndexedDB 并实时同步至此页面；您也可以点击「导入 JSON」恢复已有备份。',
    en: 'Enter a game in play.html and slay hostile monsters to record statistics automatically in local IndexedDB with live cross-tab sync, or click "Import JSON" to restore a backup.',
  },
  'stats.footnote.attribution': {
    zh: '口径说明：1.13c D2GS 服务端 0x69 死亡包不下发击杀者归属，客户端记录视野内观察到的敌对怪物死亡。单人局内等于精确个人击杀（含佣兵与召唤物）；多人局内包含附近队友击杀，可勾选「仅单人局」查看纯单人击杀。',
    en: 'Attribution Note: 1.13c D2GS 0x69 death packets do not identify the killer; the client records hostile monster deaths observed in view. In solo games this equals exact personal kills (including merc/pets); in party games nearby party kills are included—toggle "Solo Only" for solo-only counts.',
  },
  'stats.import.successSummary': {
    zh: '导入合并完成',
    en: 'Import merge complete',
  },
  'stats.import.successDetail': {
    zh: '导入合并完成：+{addedChars}/~{updatedChars} 个角色，+{addedTallies}/~{updatedTallies}/={unchangedTallies} 条计数',
    en: 'Import merge complete: +{addedChars}/~{updatedChars} chars, +{addedTallies}/~{updatedTallies}/={unchangedTallies} tallies',
  },
  'stats.notice.pluginDisabled': {
    zh: '击杀统计插件当前已禁用 — 仅展示历史已保存数据，当前游戏内击杀不会被记录。可在游戏顶部工具栏「插件」弹窗中重新启用。',
    en: 'Kill Statistics plugin is currently disabled — showing saved historical data only; new in-game kills are not being recorded. Re-enable it from the Toolbar Plugins modal.',
  },
  'stats.error.idbUnavailable': {
    zh: 'IndexedDB 在当前浏览器环境下不可用，无法读取或保存击杀统计。',
    en: 'IndexedDB is unavailable in this browser environment; cannot load or save kill statistics.',
  },
  'stats.error.idbBlocked': {
    zh: 'IndexedDB 数据库连接被其他标签页阻塞，请关闭其他旧标签页后重试。',
    en: 'IndexedDB connection is blocked by another tab. Please close older tabs and retry.',
  },
  'stats.error.idbVersionChange': {
    zh: 'IndexedDB 数据库版本已在其他标签页更新，请刷新本页面。',
    en: 'IndexedDB database version changed in another tab. Please refresh this page.',
  },
  'stats.error.importFailedPrefix': {
    zh: 'JSON 导入校验失败：',
    en: 'JSON import validation failed: ',
  },
  'stats.error.bootFailedPrefix': {
    zh: '击杀统计页面启动失败：',
    en: 'Failed to initialize Kill Statistics page: ',
  },
}

export const tStats: (
  key: StatsI18nKey,
  lang: GameLang,
  params?: PluginI18nParams,
) => string = createPluginI18n('kill-stats', STATS_I18N)

const SKIP_REASON_TRANSLATIONS: Readonly<Record<string, LocalizedText>> = {
  'incomplete character identity (host, realm, account, charName)': {
    zh: '等待数据：角色身份信息不完整（服务器、战网领域、账号或角色名缺失）',
    en: 'Waiting for data: incomplete character identity (host, realm, account, charName)',
  },
  'GameFlags (0x01) difficulty has not been received in this game': {
    zh: '等待数据：尚未收到当前游戏难度数据包 (GameFlags 0x01)',
    en: 'Waiting for data: GameFlags (0x01) difficulty has not been received in this game',
  },
  'missing or invalid character class (expected integer 0..6)': {
    zh: '等待数据：角色职业缺失或无效（需为 0..6 整数）',
    en: 'Waiting for data: missing or invalid character class (expected integer 0..6)',
  },
  'missing or invalid character level (expected finite integer >= 1)': {
    zh: '等待数据：角色等级缺失或无效（需为 >= 1 的整数）',
    en: 'Waiting for data: missing or invalid character level (expected finite integer >= 1)',
  },
  'missing authoritative world mode flags (hardcore, expansion, ladder)': {
    zh: '等待数据：世界模式标志缺失（专家级、资料片、天梯）',
    en: 'Waiting for data: missing authoritative world mode flags (hardcore, expansion, ladder)',
  },
}

export function localizeKillSkipReason(reason: string): LocalizedText {
  const known = SKIP_REASON_TRANSLATIONS[reason]
  if (known) return known
  return {
    zh: `等待数据：${reason}`,
    en: `Waiting for data: ${reason}`,
  }
}
