/**
 * loadWeatherAssets (src/client/weather/weather-assets.ts): fetches and validates the baked
 * `public/weather/weather.json`, failing fast (with the URL) on HTTP, JSON and contract errors.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WEATHER_ASSETS_URL, loadWeatherAssets, loadWeatherAssetsSafe } from '../../src/client/weather/weather-assets.ts'
import { loadWeatherManifest } from './weather-golden-scenes.ts'

const WEATHER_JSON = readFileSync(join(process.cwd(), 'public/weather/weather.json'), 'utf8')

function respond(body: string, status = 200): (url: string) => Promise<Response> {
  return () => Promise.resolve(new Response(body, { status }))
}

describe('loadWeatherAssets', () => {
  it('fetches the served weather.json and returns the validated manifest', async () => {
    const urls: string[] = []
    const data = await loadWeatherAssets(undefined, (url) => {
      urls.push(url)
      return Promise.resolve(new Response(WEATHER_JSON))
    })
    expect(urls).toEqual([WEATHER_ASSETS_URL])
    expect(WEATHER_ASSETS_URL).toBe('/weather/weather.json')
    const expected = loadWeatherManifest()
    expect(data.palettes).toEqual(expected.palettes)
    expect(data.cels).toEqual(expected.cels)
    expect(data.atlas.width).toBe(expected.atlas.width)
    expect(data.atlas.height).toBe(expected.atlas.height)
    expect(data.atlas.indices).toEqual(expected.atlas.indices)
  })

  it('fails on an HTTP error', async () => {
    await expect(loadWeatherAssets('/x/weather.json', respond('not found', 404))).rejects.toThrow(
      'weather assets /x/weather.json: HTTP 404',
    )
  })

  it('fails on a network error', async () => {
    await expect(loadWeatherAssets('/x/weather.json', () => Promise.reject(new Error('offline')))).rejects.toThrow(
      'weather assets /x/weather.json: offline',
    )
  })

  it('fails on a body that is not JSON', async () => {
    await expect(loadWeatherAssets(undefined, respond('<html>'))).rejects.toThrow(
      /^weather assets \/weather\/weather\.json: /,
    )
  })

  it('fails on a manifest that breaks the pack contract', async () => {
    await expect(loadWeatherAssets(undefined, respond('{}'))).rejects.toThrow(
      /^weather assets \/weather\/weather\.json: weather\.json : keys \[\] must be exactly/,
    )
    const wrongVersion = JSON.stringify({ ...(JSON.parse(WEATHER_JSON) as object), version: 999 })
    await expect(loadWeatherAssets(undefined, respond(wrongVersion))).rejects.toThrow(/\.version: 999 is not/)
  })

  describe('loadWeatherAssetsSafe (graceful degradation)', () => {
    it('returns validated manifest on success', async () => {
      const data = await loadWeatherAssetsSafe(undefined, () => Promise.resolve(new Response(WEATHER_JSON)))
      expect(data).not.toBeNull()
      expect(data?.palettes.length).toBe(5)
    })

    it('returns null and does not throw on HTTP 404', async () => {
      const result = await loadWeatherAssetsSafe('/x/weather.json', respond('not found', 404))
      expect(result).toBeNull()
    })

    it('returns null and does not throw on network failure (Failed to fetch / offline)', async () => {
      const result = await loadWeatherAssetsSafe('/x/weather.json', () =>
        Promise.reject(new TypeError('Failed to fetch')),
      )
      expect(result).toBeNull()
    })

    it('returns null and does not throw on corrupt or malformed manifest', async () => {
      const result = await loadWeatherAssetsSafe(undefined, respond('{ invalid json'))
      expect(result).toBeNull()
    })
  })
})
