import type {
  AtlasHandle,
  SpriteRenderer,
} from '../render/renderer.ts'
import { BAKED_UI_MANIFEST } from '../../common/items/baked-ui-meta.ts'

export let globalItemsAtlasHandle: AtlasHandle | undefined
const itemsAtlasHandleByRenderer = new WeakMap<SpriteRenderer, AtlasHandle>()
let cachedItemsAtlasBlobPromise: Promise<Blob> | null = null

/**
 * Load authentic 1.13c baked items atlas from /ui/items-atlas.png.
 * Per-renderer WeakMap caching ensures each WebGL2 context gets its own valid
 * WebGLTexture handle while sharing the downloaded PNG Blob across multibox instances (#1362).
 */
export async function loadItemsAtlas(
  renderer: SpriteRenderer,
  packBase?: string,
): Promise<AtlasHandle | undefined> {
  const existingForRenderer = itemsAtlasHandleByRenderer.get(renderer)
  if (existingForRenderer !== undefined) {
    globalItemsAtlasHandle = existingForRenderer
    return existingForRenderer
  }
  if (typeof fetch === 'undefined' || typeof createImageBitmap === 'undefined') return undefined
  const candidates = [
    '/ui/items-atlas.png',
    packBase ? `${packBase}/ui/items-atlas.png` : '',
    'ui/items-atlas.png',
    'public/ui/items-atlas.png',
  ].filter(Boolean)

  if (cachedItemsAtlasBlobPromise) {
    try {
      const blob = await cachedItemsAtlasBlobPromise
      const bitmap = await createImageBitmap(blob)
      try {
        const handle = renderer.addAtlas(bitmap, BAKED_UI_MANIFEST.atlasWidth, BAKED_UI_MANIFEST.atlasHeight)
        itemsAtlasHandleByRenderer.set(renderer, handle)
        globalItemsAtlasHandle = handle
        return handle
      } finally {
        bitmap.close()
      }
    } catch {
      cachedItemsAtlasBlobPromise = null
    }
  }

  const failures: string[] = []
  for (const url of candidates) {
    try {
      const resp = await fetch(url)
      if (!resp.ok) {
        failures.push(`${url} (HTTP ${resp.status})`)
        continue
      }
      const blob = await resp.blob()
      cachedItemsAtlasBlobPromise = Promise.resolve(blob)
      const bitmap = await createImageBitmap(blob)
      try {
        const handle = renderer.addAtlas(bitmap, BAKED_UI_MANIFEST.atlasWidth, BAKED_UI_MANIFEST.atlasHeight)
        itemsAtlasHandleByRenderer.set(renderer, handle)
        globalItemsAtlasHandle = handle
        return handle
      } finally {
        bitmap.close()
      }
    } catch (err) {
      failures.push(`${url}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const msg = `[loadItemsAtlas] Failed to load items-atlas.png from all candidates: ${failures.join('; ')}`
  console.error(msg)
  throw new Error(msg)
}
