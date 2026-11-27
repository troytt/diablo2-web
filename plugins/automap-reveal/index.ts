/**
 * Automap Reveal Plugin (`plugins/automap-reveal/index.ts` — Issue #714).
 *
 * Isolates the non-1.13c full-level (`level`) and full-act (`act`) automap reveal,
 * MapHack-style automap radar markers (`showMonsters`, `showShrines`),
 * ambient lighting preset overrides (`lightingPreset`), and weather particle overrides
 * (`weatherOverride`) outside core `src/`. All `<select>` dropdowns are rendered inside
 * the Plugin Management modal (`PluginMenu`) rather than on the top toolbar.
 * When disabled, `PluginHost` releases all capability claims and strictly enforces
 * 1.13c vanilla defaults (`automapReveal = 'off'`, `lightingPreset = 'auto'`,
 * `weatherOverride = 'off'`, `automapShowMonsters = false`, `automapShowShrines = false`).
 */

import {
  CLIENT_LIGHTING_PRESET_ORDER,
  LIGHTING_PRESETS,
  VALID_AUTOMAP_REVEAL_MODES,
  VALID_LIGHTING_PRESETS,
  VALID_WEATHER_OVERRIDES,
  type AutomapRevealMode,
  type ClientLightingPreset,
  type D2WebPlugin,
  type LocalizedText,
  type PluginContext,
  type PluginInstance,
  type PluginStatus,
  type PluginToolbarSelectOption,
  type WeatherOverrideSetting,
} from '../../src/client/plugin-host/api.ts'

const AUTOMAP_MODE_LABELS: Readonly<Record<AutomapRevealMode, LocalizedText>> = {
  off: {
    zh: '关闭',
    en: 'Off',
  },
  level: {
    zh: '本层全开',
    en: 'Current Level',
  },
  act: {
    zh: '整幕全开',
    en: 'Full Act',
  },
}

const AUTOMAP_SELECT_OPTIONS: readonly PluginToolbarSelectOption[] =
  VALID_AUTOMAP_REVEAL_MODES.map((mode) => ({
    value: mode,
    label: AUTOMAP_MODE_LABELS[mode],
  }))

const LIGHTING_SELECT_OPTIONS: readonly PluginToolbarSelectOption[] =
  CLIENT_LIGHTING_PRESET_ORDER.map((preset) => ({
    value: preset,
    label: {
      zh: LIGHTING_PRESETS[preset].labelZh,
      en: LIGHTING_PRESETS[preset].labelEn,
    },
  }))

const WEATHER_OVERRIDE_LABELS: Readonly<
  Record<WeatherOverrideSetting, LocalizedText>
> = {
  off: {
    zh: '默认 (1.13c)',
    en: 'Default (1.13c)',
  },
  rain: {
    zh: '强制降雨',
    en: 'Force Rain',
  },
  snow: {
    zh: '强制降雪',
    en: 'Force Snow',
  },
}

const WEATHER_SELECT_OPTIONS: readonly PluginToolbarSelectOption[] =
  VALID_WEATHER_OVERRIDES.map((mode) => ({
    value: mode,
    label: WEATHER_OVERRIDE_LABELS[mode],
  }))

function isAutomapRevealMode(value: unknown): value is AutomapRevealMode {
  return (
    typeof value === 'string' &&
    (VALID_AUTOMAP_REVEAL_MODES as readonly string[]).includes(value)
  )
}

function isLightingPreset(value: unknown): value is ClientLightingPreset {
  return (
    typeof value === 'string' &&
    (VALID_LIGHTING_PRESETS as readonly string[]).includes(value)
  )
}

function isWeatherOverride(value: unknown): value is WeatherOverrideSetting {
  return (
    typeof value === 'string' &&
    (VALID_WEATHER_OVERRIDES as readonly string[]).includes(value)
  )
}

export interface AutomapRevealPluginInstance extends PluginInstance {
  getMode(): AutomapRevealMode
  setMode(mode: AutomapRevealMode): void
  getLightingPreset(): ClientLightingPreset
  setLightingPreset(preset: ClientLightingPreset): void
  getWeatherOverride(): WeatherOverrideSetting
  setWeatherOverride(mode: WeatherOverrideSetting): void
  getShowMonsters(): boolean
  setShowMonsters(show: boolean): void
  getShowShrines(): boolean
  setShowShrines(show: boolean): void
  getShowWaypoints(): boolean
  setShowWaypoints(show: boolean): void
}

export function createAutomapRevealPlugin(): D2WebPlugin {
  return {
    id: 'automap-reveal',
    name: {
      zh: '小地图全图透视',
      en: 'Automap Reveal',
    },
    description: {
      zh: '非 1.13c 增强：支持一键揭开本层或整幕全部小地图房间与传送点标记、高亮放大显示小站图标、显示附近怪物与神龛类型图标，并提供环境光照预设与天气效果覆盖。关闭插件后严格恢复 1.13c 原版战争迷雾、昼夜光照与关卡自然天气。',
      en: 'Non-1.13c enhancement: reveals all rooms and warp markers for the current level or entire Act, highlights and enlarges waypoint icons, shows MapHack-style nearby monster crosshairs and shrine type icons, and provides ambient lighting preset and weather overrides. When disabled, strictly enforces 1.13c vanilla defaults.',
    },
    defaultEnabled: true,
    settings: [
      {
        kind: 'select',
        key: 'mode',
        label: {
          zh: '透视范围',
          en: 'Reveal Scope',
        },
        default: 'off',
        options: AUTOMAP_SELECT_OPTIONS,
      },
      {
        kind: 'select',
        key: 'lightingPreset',
        label: {
          zh: '光照预设',
          en: 'Lighting Preset',
        },
        default: 'auto',
        options: LIGHTING_SELECT_OPTIONS,
      },
      {
        kind: 'select',
        key: 'weatherOverride',
        label: {
          zh: '天气模式',
          en: 'Weather Mode',
        },
        default: 'off',
        options: WEATHER_SELECT_OPTIONS,
      },
      {
        kind: 'boolean',
        key: 'showMonsters',
        label: {
          zh: '显示附近怪物',
          en: 'Show nearby monsters',
        },
        default: true,
      },
      {
        kind: 'boolean',
        key: 'showShrines',
        label: {
          zh: '显示附近神龛及类型图标',
          en: 'Show nearby shrines & type icons',
        },
        default: true,
      },
      {
        kind: 'boolean',
        key: 'showWaypoints',
        label: {
          zh: '高亮放大显示小站图标',
          en: 'Highlight & enlarge waypoint icons',
        },
        default: true,
      },
    ],
    activate(ctx: PluginContext): AutomapRevealPluginInstance {
      const storedMode = ctx.settings.get('mode')
      const initialMode: AutomapRevealMode = isAutomapRevealMode(storedMode)
        ? storedMode
        : 'off'
      const storedLighting = ctx.settings.get('lightingPreset')
      const initialLighting: ClientLightingPreset = isLightingPreset(
        storedLighting,
      )
        ? storedLighting
        : 'auto'
      const storedWeather = ctx.settings.get('weatherOverride')
      const initialWeather: WeatherOverrideSetting = isWeatherOverride(
        storedWeather,
      )
        ? storedWeather
        : 'off'
      const initialShowMonsters = ctx.settings.get('showMonsters') === true
      const initialShowShrines = ctx.settings.get('showShrines') === true
      const initialShowWaypoints = ctx.settings.get('showWaypoints') !== false

      ctx.client.setAutomapReveal(initialMode)
      ctx.client.setLightingPreset(initialLighting)
      ctx.client.setWeatherOverride(initialWeather)
      ctx.client.setAutomapRadar({
        automapShowMonsters: initialShowMonsters,
        automapShowShrines: initialShowShrines,
        automapShowWaypoints: initialShowWaypoints,
      })

      const unsubClient = ctx.client.subscribeAutomapReveal((clientMode) => {
        if (ctx.settings.get('mode') !== clientMode) {
          ctx.settings.set('mode', clientMode)
        }
        ctx.notifyStatusChanged()
      })

      const unsubLighting = ctx.client.subscribeLightingPreset(
        (clientPreset) => {
          if (ctx.settings.get('lightingPreset') !== clientPreset) {
            ctx.settings.set('lightingPreset', clientPreset)
          }
          ctx.notifyStatusChanged()
        },
      )

      const unsubWeather = ctx.client.subscribeWeatherOverride((clientMode) => {
        if (ctx.settings.get('weatherOverride') !== clientMode) {
          ctx.settings.set('weatherOverride', clientMode)
        }
        ctx.notifyStatusChanged()
      })

      const unsubRadar = ctx.client.subscribeAutomapRadar((radar) => {
        if (ctx.settings.get('showMonsters') !== radar.automapShowMonsters) {
          ctx.settings.set('showMonsters', radar.automapShowMonsters)
        }
        if (ctx.settings.get('showShrines') !== radar.automapShowShrines) {
          ctx.settings.set('showShrines', radar.automapShowShrines)
        }
        if (
          radar.automapShowWaypoints !== undefined &&
          ctx.settings.get('showWaypoints') !== radar.automapShowWaypoints
        ) {
          ctx.settings.set('showWaypoints', radar.automapShowWaypoints)
        }
        ctx.notifyStatusChanged()
      })

      const unsubSettings = ctx.settings.subscribe((key) => {
        if (key === 'mode') {
          const next = ctx.settings.get('mode')
          if (isAutomapRevealMode(next)) {
            ctx.client.setAutomapReveal(next)
            ctx.notifyStatusChanged()
          }
        } else if (key === 'lightingPreset') {
          const next = ctx.settings.get('lightingPreset')
          if (isLightingPreset(next)) {
            ctx.client.setLightingPreset(next)
            ctx.notifyStatusChanged()
          }
        } else if (key === 'weatherOverride') {
          const next = ctx.settings.get('weatherOverride')
          if (isWeatherOverride(next)) {
            ctx.client.setWeatherOverride(next)
            ctx.notifyStatusChanged()
          }
        } else if (key === 'showMonsters') {
          const next = ctx.settings.get('showMonsters') === true
          ctx.client.setAutomapRadar({ automapShowMonsters: next })
          ctx.notifyStatusChanged()
        } else if (key === 'showShrines') {
          const next = ctx.settings.get('showShrines') === true
          ctx.client.setAutomapRadar({ automapShowShrines: next })
          ctx.notifyStatusChanged()
        } else if (key === 'showWaypoints') {
          const next = ctx.settings.get('showWaypoints') === true
          ctx.client.setAutomapRadar({ automapShowWaypoints: next })
          ctx.notifyStatusChanged()
        }
      })

      const getStatus = (): PluginStatus => {
        const mode = ctx.client.getAutomapReveal()
        const lighting = ctx.client.getLightingPreset()
        const weather = ctx.client.getWeatherOverride()
        const modeLabel = AUTOMAP_MODE_LABELS[mode]
        const lightingConfig = LIGHTING_PRESETS[lighting]
        const weatherLabel = WEATHER_OVERRIDE_LABELS[weather]
        return {
          level: 'ok',
          text: {
            zh: `当前：${modeLabel.zh} · 光照：${lightingConfig.labelZh} · 天气：${weatherLabel.zh}`,
            en: `Mode: ${modeLabel.en} · Light: ${lightingConfig.labelEn} · Weather: ${weatherLabel.en}`,
          },
        }
      }

      return {
        getMode: () => ctx.client.getAutomapReveal(),
        setMode: (mode: AutomapRevealMode) => {
          if (!isAutomapRevealMode(mode)) {
            throw new Error(`Invalid automap reveal mode: ${String(mode)}`)
          }
          ctx.settings.set('mode', mode)
        },
        getLightingPreset: () => ctx.client.getLightingPreset(),
        setLightingPreset: (preset: ClientLightingPreset) => {
          if (!isLightingPreset(preset)) {
            throw new Error(`Invalid lighting preset: ${String(preset)}`)
          }
          ctx.settings.set('lightingPreset', preset)
        },
        getWeatherOverride: () => ctx.client.getWeatherOverride(),
        setWeatherOverride: (mode: WeatherOverrideSetting) => {
          if (!isWeatherOverride(mode)) {
            throw new Error(`Invalid weather override mode: ${String(mode)}`)
          }
          ctx.settings.set('weatherOverride', mode)
        },
        getShowMonsters: () => ctx.client.getAutomapRadar().automapShowMonsters,
        setShowMonsters: (show: boolean) => {
          if (typeof show !== 'boolean') {
            throw new Error(`Invalid showMonsters flag: ${String(show)}`)
          }
          ctx.settings.set('showMonsters', show)
        },
        getShowShrines: () => ctx.client.getAutomapRadar().automapShowShrines,
        setShowShrines: (show: boolean) => {
          if (typeof show !== 'boolean') {
            throw new Error(`Invalid showShrines flag: ${String(show)}`)
          }
          ctx.settings.set('showShrines', show)
        },
        getShowWaypoints: () =>
          Boolean(ctx.client.getAutomapRadar().automapShowWaypoints),
        setShowWaypoints: (show: boolean) => {
          if (typeof show !== 'boolean') {
            throw new Error(`Invalid showWaypoints flag: ${String(show)}`)
          }
          ctx.settings.set('showWaypoints', show)
        },
        getStatus,
        deactivate(): void {
          unsubClient()
          unsubLighting()
          unsubWeather()
          unsubRadar()
          unsubSettings()
        },
      }
    },
  }
}

export const automapRevealPlugin: D2WebPlugin = createAutomapRevealPlugin()
