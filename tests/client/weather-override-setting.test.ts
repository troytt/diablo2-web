/**
 * NOT 1.13c: the `weatherOverride` client setting behind the `weather-override` plugin.
 *
 * `'off'` is the vanilla 1.13c weather and the value for anything that is not a known override
 * id, so a corrupt or missing stored value can never force precipitation.
 */

import { describe, expect, it } from 'vitest'
import {
  createDefaultClientSettings,
  DEFAULT_CLIENT_SETTINGS,
  normalizeWeatherOverride,
  sanitizeClientSettings,
  SETTINGS_STORAGE_KEY,
  VALID_WEATHER_OVERRIDES,
} from '../../src/client/settings/client-settings.ts'
import { createSettingsStore, type SettingsKey, type StorageLike } from '../../src/client/settings/settings-store.ts'

function memoryStorage(initial?: string): StorageLike & { readonly data: Map<string, string> } {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(SETTINGS_STORAGE_KEY, initial)
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

describe('weatherOverride client setting (NOT 1.13c)', () => {
  it('defaults to the vanilla weather', () => {
    expect(VALID_WEATHER_OVERRIDES).toEqual(['off', 'rain', 'snow'])
    expect(DEFAULT_CLIENT_SETTINGS.weatherOverride).toBe('off')
    expect(createDefaultClientSettings().weatherOverride).toBe('off')
    expect(sanitizeClientSettings({}).weatherOverride).toBe('off')
  })

  it('normalizes case and whitespace and maps anything unknown to off', () => {
    expect(normalizeWeatherOverride(' RAIN ')).toBe('rain')
    expect(normalizeWeatherOverride('Snow')).toBe('snow')
    expect(normalizeWeatherOverride('off')).toBe('off')
    for (const bad of ['fog', '', 'rain snow', 42, null, undefined, true, { mode: 'rain' }]) {
      expect(normalizeWeatherOverride(bad)).toBe('off')
    }
    expect(sanitizeClientSettings({ weatherOverride: 'SNOW' }).weatherOverride).toBe('snow')
    expect(sanitizeClientSettings({ weatherOverride: 'thunder' }).weatherOverride).toBe('off')
  })

  it('reports the key to subscribers and persists it', () => {
    const storage = memoryStorage()
    const store = createSettingsStore({ storage, syncGlobalLang: false })
    const changes: (readonly SettingsKey[])[] = []
    store.subscribe((_next, _prev, changedKeys) => changes.push(changedKeys))

    store.set({ weatherOverride: 'rain' })
    expect(changes).toEqual([['weatherOverride']])
    expect(store.get().weatherOverride).toBe('rain')
    expect(JSON.parse(storage.data.get(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({ weatherOverride: 'rain' })

    store.set({ weatherOverride: 'rain' })
    expect(changes).toHaveLength(1)

    const reloaded = createSettingsStore({ storage, syncGlobalLang: false })
    expect(reloaded.get().weatherOverride).toBe('rain')
  })

  it('heals a corrupt stored value to off', () => {
    const storage = memoryStorage(JSON.stringify({ version: 1, weatherOverride: 'blizzard' }))
    const store = createSettingsStore({ storage, syncGlobalLang: false })
    expect(store.get().weatherOverride).toBe('off')
    expect(JSON.parse(storage.data.get(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({ weatherOverride: 'off' })
  })
})
