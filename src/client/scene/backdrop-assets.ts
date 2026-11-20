/**
 * Loads the baked 1.13c level backdrop assets (`npm run bake -- backdrop` → `public/backdrop/backdrop.json`,
 * issues #1537 / #1538). A missing or corrupt file is reported through the missing-art channel and the session
 * runs without the Arreat Summit sky / Arcane Sanctuary starfield (like the weather assets).
 */

import { validateBackdropManifest, type BackdropManifestData } from '../../common/pack-contract/backdrop-manifest.ts'
import { reportMissingArt } from './missing-art.ts'

export const BACKDROP_ASSETS_URL = '/backdrop/backdrop.json'

export async function loadBackdropAssets(
  url: string = BACKDROP_ASSETS_URL,
  fetchImpl: (url: string) => Promise<Response> = (u) => fetch(u),
): Promise<BackdropManifestData | null> {
  try {
    const resp = await fetchImpl(url)
    if (!resp.ok) throw new Error(`HTTP ${String(resp.status)}`)
    return validateBackdropManifest((await resp.json()) as unknown)
  } catch (err) {
    reportMissingArt('backdrop', url, `backdrop assets ${url}: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}
