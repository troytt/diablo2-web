/**
 * Bilingual (`zh` / `en`) copy for the Toolbar Plugin Configuration Modal (`PluginMenu`).
 */

import type { GameLang } from '../i18n/lang.ts'

export type PluginMenuI18nKey =
  | 'pluginMenu.title'
  | 'pluginMenu.subtitle'
  | 'pluginMenu.close'
  | 'pluginMenu.empty'
  | 'pluginMenu.resetAll'
  | 'pluginMenu.corruptConfig'
  | 'pluginMenu.pluginErrorPrefix'
  | 'pluginMenu.status.active'
  | 'pluginMenu.status.disabled'
  | 'pluginMenu.toggle.enable'
  | 'pluginMenu.toggle.disable'
  | 'pluginMenu.section.description'
  | 'pluginMenu.section.settings'
  | 'pluginMenu.noSettings'
  | 'pluginMenu.disabledHint'

export const PLUGIN_MENU_I18N: Readonly<
  Record<PluginMenuI18nKey, { readonly zh: string; readonly en: string }>
> = {
  'pluginMenu.title': {
    zh: '插件管理',
    en: 'Plugins',
  },
  'pluginMenu.subtitle': {
    zh: '以下均为 1.13c 原版之外的增强功能，关闭后不影响游戏本体。',
    en: 'All items below are non-1.13c enhancements; disabling them leaves base gameplay untouched.',
  },
  'pluginMenu.close': {
    zh: '关闭 (Esc)',
    en: 'Close (Esc)',
  },
  'pluginMenu.empty': {
    zh: '当前未注册任何插件。',
    en: 'No plugins registered.',
  },
  'pluginMenu.resetAll': {
    zh: '全部恢复默认',
    en: 'Reset All to Defaults',
  },
  'pluginMenu.corruptConfig': {
    zh: '插件配置存储 (d2web.plugins.v1) 损坏，已临时回退到默认设置；修改设置或点击「全部恢复默认」后将修复存储。',
    en: 'Plugin configuration storage (d2web.plugins.v1) is corrupted; using default settings in memory until you change a setting or click "Reset All to Defaults".',
  },
  'pluginMenu.pluginErrorPrefix': {
    zh: '插件运行错误：',
    en: 'Plugin runtime error: ',
  },
  'pluginMenu.status.active': {
    zh: '运行中',
    en: 'Active',
  },
  'pluginMenu.status.disabled': {
    zh: '已关闭',
    en: 'Disabled',
  },
  'pluginMenu.toggle.enable': {
    zh: '已开启',
    en: 'Enabled',
  },
  'pluginMenu.toggle.disable': {
    zh: '已关闭',
    en: 'Disabled',
  },
  'pluginMenu.section.description': {
    zh: '插件说明',
    en: 'Description',
  },
  'pluginMenu.section.settings': {
    zh: '配置项',
    en: 'Settings',
  },
  'pluginMenu.noSettings': {
    zh: '该插件无需额外配置项，开启即可生效。',
    en: 'No additional settings required; takes effect when enabled.',
  },
  'pluginMenu.disabledHint': {
    zh: '插件当前已关闭，开启后可配置相关选项。',
    en: 'This plugin is currently disabled. Enable it above to configure its options.',
  },
}

export function tPluginMenu(key: PluginMenuI18nKey, lang: GameLang): string {
  const entry = PLUGIN_MENU_I18N[key]
  return lang === 'en' ? entry.en : entry.zh
}
