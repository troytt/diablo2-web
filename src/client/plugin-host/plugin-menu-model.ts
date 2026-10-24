/**
 * Pure View-Model Builder for the Toolbar Plugin Configuration Modal (`PluginMenu`).
 *
 * Projects `PluginHost` state and `GameLang` into a deterministic, DOM-free view model
 * for unit testing and DOM rendering.
 */

import {
  resolveLocalizedText,
  type GameLang,
  type PluginStatus,
} from './api.ts'
import type { PluginHost } from './plugin-host.ts'
import { tPluginMenu } from './plugin-menu-i18n.ts'

export type PluginMenuSettingControlViewModel =
  | {
      readonly kind: 'boolean'
      readonly key: string
      readonly label: string
      readonly value: boolean
    }
  | {
      readonly kind: 'select'
      readonly key: string
      readonly label: string
      readonly value: string
      readonly options: readonly {
        readonly value: string
        readonly label: string
      }[]
    }

export type PluginMenuActionViewModel =
  | {
      readonly kind: 'link'
      readonly id: string
      readonly label: string
      readonly href: string
    }
  | {
      readonly kind: 'button'
      readonly id: string
      readonly label: string
    }

export interface PluginMenuCardViewModel {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly author?: string | undefined
  readonly enabled: boolean
  readonly toggleLabel: string
  readonly statusLevel: PluginStatus['level'] | 'disabled'
  readonly statusText: string
  readonly settings: readonly PluginMenuSettingControlViewModel[]
  readonly actions: readonly PluginMenuActionViewModel[]
}

export interface PluginMenuViewModel {
  readonly lang: GameLang
  readonly title: string
  readonly subtitle: string
  readonly closeLabel: string
  readonly resetAllLabel: string
  readonly emptyText: string
  readonly descriptionHeader: string
  readonly settingsHeader: string
  readonly noSettingsText: string
  readonly disabledHintText: string
  readonly alertText: string | null
  readonly selectedPluginId: string | null
  readonly cards: readonly PluginMenuCardViewModel[]
}

export function buildPluginMenuViewModel(
  host: PluginHost,
  lang: GameLang,
  preferredPluginId?: string | null,
): PluginMenuViewModel {
  const snapshots = host.list()
  const alertMessages: string[] = []

  if (host.hasCorruptionError()) {
    const detail = host.getCorruptionMessage()
    alertMessages.push(
      detail
        ? `${tPluginMenu('pluginMenu.corruptConfig', lang)} (${detail})`
        : tPluginMenu('pluginMenu.corruptConfig', lang),
    )
  }

  const cards: PluginMenuCardViewModel[] = snapshots.map((snap) => {
    const plugin = snap.plugin
    const name = resolveLocalizedText(plugin.name, lang)
    const description = resolveLocalizedText(plugin.description, lang)

    let statusLevel: PluginMenuCardViewModel['statusLevel']
    let statusText: string

    if (snap.status.level === 'error') {
      statusLevel = 'error'
      statusText = resolveLocalizedText(snap.status.text, lang)
      alertMessages.push(
        `${tPluginMenu('pluginMenu.pluginErrorPrefix', lang)}${name} — ${statusText}`,
      )
    } else if (!snap.enabled) {
      statusLevel = 'disabled'
      statusText = tPluginMenu('pluginMenu.status.disabled', lang)
    } else {
      statusLevel = snap.status.level
      statusText = resolveLocalizedText(snap.status.text, lang)
    }

    const settings: PluginMenuSettingControlViewModel[] = snap.enabled
      ? (plugin.settings ?? []).filter(({ shownWhen = [] }) => shownWhen.every(({ key, is }) => is.includes(snap.settings[key] ?? plugin.settings?.find((other) => other.key === key)?.default ?? ''))).map((spec) => {
          if (spec.kind === 'boolean') {
            return {
              kind: 'boolean',
              key: spec.key,
              label: resolveLocalizedText(spec.label, lang),
              value: Boolean(snap.settings[spec.key]),
            }
          }
          return {
            kind: 'select',
            key: spec.key,
            label: resolveLocalizedText(spec.label, lang),
            value: String(snap.settings[spec.key] ?? spec.default),
            options: spec.options.map((opt) => ({
              value: opt.value,
              label: resolveLocalizedText(opt.label, lang),
            })),
          }
        })
      : []

    const actions: PluginMenuActionViewModel[] = snap.enabled
      ? (plugin.actions ?? []).map((action) => {
          if (action.kind === 'link') {
            return {
              kind: 'link',
              id: action.id,
              label: resolveLocalizedText(action.label, lang),
              href: action.href,
            }
          }
          return {
            kind: 'button',
            id: action.id,
            label: resolveLocalizedText(action.label, lang),
          }
        })
      : []

    return {
      id: plugin.id,
      name,
      description,
      author: plugin.author,
      enabled: snap.enabled,
      toggleLabel: snap.enabled
        ? tPluginMenu('pluginMenu.toggle.enable', lang)
        : tPluginMenu('pluginMenu.toggle.disable', lang),
      statusLevel,
      statusText,
      settings,
      actions,
    }
  })

  const selectedPluginId =
    preferredPluginId && cards.some((c) => c.id === preferredPluginId)
      ? preferredPluginId
      : (cards[0]?.id ?? null)

  return {
    lang,
    title: tPluginMenu('pluginMenu.title', lang),
    subtitle: tPluginMenu('pluginMenu.subtitle', lang),
    closeLabel: tPluginMenu('pluginMenu.close', lang),
    resetAllLabel: tPluginMenu('pluginMenu.resetAll', lang),
    emptyText: tPluginMenu('pluginMenu.empty', lang),
    descriptionHeader: tPluginMenu('pluginMenu.section.description', lang),
    settingsHeader: tPluginMenu('pluginMenu.section.settings', lang),
    noSettingsText: tPluginMenu('pluginMenu.noSettings', lang),
    disabledHintText: tPluginMenu('pluginMenu.disabledHint', lang),
    alertText: alertMessages.length > 0 ? alertMessages.join(' | ') : null,
    selectedPluginId,
    cards,
  }
}
