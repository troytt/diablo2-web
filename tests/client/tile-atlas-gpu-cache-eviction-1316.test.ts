/**
 * Issue #1316: TileAtlasGpuCache must release R8 tile pages outside the active
 * level's keep set instead of letting every visited act accumulate GPU textures.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TileAtlasGpuCache } from '../../src/client/scene/world-renderer.ts'
import type { AtlasHandle, SpriteRenderer } from '../../src/client/render/renderer.ts'

const PAGE_BYTES = 2048 * 4

function createFakeRenderer(): {
  renderer: SpriteRenderer
  addIndexedAtlas: ReturnType<typeof vi.fn>
  deleteAtlas: ReturnType<typeof vi.fn>
} {
  const addIndexedAtlas = vi.fn((_indices: Uint8Array, width: number, height: number): AtlasHandle => ({
    texture: {} as WebGLTexture,
    width,
    height,
    indexed: true,
  }))
  const deleteAtlas = vi.fn(() => true)
  const renderer = {
    addIndexedAtlas,
    deleteAtlas,
    setPalette: vi.fn(),
  } as unknown as SpriteRenderer
  return { renderer, addIndexedAtlas, deleteAtlas }
}

async function flushPageLoads(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('Issue #1316 TileAtlasGpuCache page eviction', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deletes pages outside the retained set after the grace period', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new Uint8Array(PAGE_BYTES).buffer })),
    )
    const { renderer, deleteAtlas } = createFakeRenderer()
    const cache = new TileAtlasGpuCache(renderer)

    cache.getPageHandle(1, 0)
    cache.getPageHandle(1, 1)
    await flushPageLoads()
    expect(cache.loadedPageCount).toBe(2)

    cache.retainPages([{ act: 1, page: 0 }], 0)
    await flushPageLoads()

    expect(cache.loadedPageCount).toBe(1)
    expect(deleteAtlas).toHaveBeenCalledTimes(1)
  })

  it('releases pages from other acts when the active area changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new Uint8Array(PAGE_BYTES).buffer })),
    )
    const { renderer, deleteAtlas } = createFakeRenderer()
    const cache = new TileAtlasGpuCache(renderer)

    cache.getPageHandle(1, 0)
    cache.getPageHandle(2, 0)
    await flushPageLoads()
    expect(cache.loadedPageCount).toBe(2)

    cache.retainPages([{ act: 1, page: 0 }], 0)
    await flushPageLoads()

    expect(cache.loadedPageCount).toBe(1)
    expect(deleteAtlas).toHaveBeenCalledTimes(1)
  })

  it('drops a page that finishes streaming after it left the retain set', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new Uint8Array(PAGE_BYTES).buffer })),
    )
    const { renderer, deleteAtlas } = createFakeRenderer()
    const cache = new TileAtlasGpuCache(renderer)

    cache.retainPages([{ act: 1, page: 0 }], 0)
    cache.getPageHandle(3, 0)
    await flushPageLoads()

    expect(cache.loadedPageCount).toBe(0)
    expect(deleteAtlas).toHaveBeenCalledTimes(1)
  })

  it('can stream an evicted page again when the player returns', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new Uint8Array(PAGE_BYTES).buffer })),
    )
    const { renderer, addIndexedAtlas } = createFakeRenderer()
    const cache = new TileAtlasGpuCache(renderer)

    cache.getPageHandle(1, 0)
    await flushPageLoads()
    expect(cache.loadedPageCount).toBe(1)

    cache.retainPages([], 0)
    await flushPageLoads()
    expect(cache.loadedPageCount).toBe(0)

    cache.retainPages([{ act: 1, page: 0 }], 0)
    cache.getPageHandle(1, 0)
    await flushPageLoads()
    expect(cache.loadedPageCount).toBe(1)
    expect(addIndexedAtlas).toHaveBeenCalledTimes(2)
  })

  it('keeps retained pages that are loaded later', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new Uint8Array(PAGE_BYTES).buffer })),
    )
    const { renderer, deleteAtlas } = createFakeRenderer()
    const cache = new TileAtlasGpuCache(renderer)

    cache.retainPages([{ act: 1, page: 0 }], 0)
    cache.getPageHandle(1, 0)
    await flushPageLoads()

    expect(cache.loadedPageCount).toBe(1)
    expect(deleteAtlas).not.toHaveBeenCalled()
  })
})