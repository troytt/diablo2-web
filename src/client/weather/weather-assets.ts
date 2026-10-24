/**
 * Loads the baked 1.13c weather assets (`npm run pack:weather` → `public/weather/weather.json`):
 * the act palettes LoadWeather 0x6fb31750 builds its colour ramps from and the drawn overlay cels.
 * There is no fallback: a missing or corrupt file is an error.
 */

import { validateWeatherManifest, type WeatherManifestData } from '../../common/pack-contract/index.ts'

export const WEATHER_ASSETS_URL = '/weather/weather.json'

export async function loadWeatherAssets(
  url: string = WEATHER_ASSETS_URL,
  fetchImpl: (url: string) => Promise<Response> = (u) => fetch(u),
): Promise<WeatherManifestData> {
  try {
    const resp = await fetchImpl(url)
    if (!resp.ok) throw new Error(`HTTP ${String(resp.status)}`)
    return validateWeatherManifest((await resp.json()) as unknown)
  } catch (err) {
    throw new Error(`weather assets ${url}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Loads weather assets with graceful degradation:
 * If the fetch fails for any reason (offline, failed to fetch, 404, corrupt JSON, etc.),
 * logs a warning and returns `null` instead of throwing, allowing the game session to
 * proceed without weather effects.
 */
export async function loadWeatherAssetsSafe(
  url: string = WEATHER_ASSETS_URL,
  fetchImpl: (url: string) => Promise<Response> = (u) => fetch(u),
): Promise<WeatherManifestData | null> {
  try {
    return await loadWeatherAssets(url, fetchImpl)
  } catch (err) {
    console.warn(`[weather] Weather assets failed to load; local weather effects disabled:`, err)
    return null
  }
}
