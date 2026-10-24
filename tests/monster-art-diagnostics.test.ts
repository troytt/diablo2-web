/**
 * Monster art failures must be observable (issue #58 item 3).
 *
 * Three `catch` blocks used to turn "the monster art system is broken" into "the
 * scene is ready and every monster is a red box", with at most one
 * `console.warn`. These tests pin the two halves of the fix:
 *
 * - `compositeMonsterAnimation` reports every COF layer it drops, rather than
 *   rendering a monster without its head and saying nothing.
 * - `act-scene` can tell which monster ids ended up with no art, and says so in
 *   the HUD.
 */
import { describe, expect, it, vi } from 'vitest'
import { compositeMonsterAnimation } from '../src/client/render/monster-art.ts'
import type { MountedArchives } from '../src/common/mpq/mount.ts'
import { missingMonsterArtIds } from '../src/client/scene/entity-art-loader.ts'

/**
 * A COF with `layerCount` layers, one frame, one direction.
 *
 * Mirrors `decodeCof`'s reader: a 28-byte header followed by one 9-byte layer
 * record each, then the frame-duration table and the per-direction layer order.
 */
function makeCof(layerCount: number): Uint8Array {
  const directions = 1
  const frames = 1
  const size = 28 + layerCount * 9 + frames * 4 + directions * frames * layerCount
  const bytes = new Uint8Array(size)
  const view = new DataView(bytes.buffer)
  bytes[0] = layerCount
  bytes[1] = frames
  bytes[2] = directions
  let at = 28
  for (let layer = 0; layer < layerCount; layer += 1) {
    bytes[at] = layer // composite type: 0 = hd, 1 = tr, ...
    bytes[at + 1] = 0 // shadow
    bytes[at + 2] = 0 // selectable
    bytes[at + 3] = 0 // override transparency
    // weapon class, 4 characters, 'hth\0'
    bytes[at + 4] = 0x68
    bytes[at + 5] = 0x74
    bytes[at + 6] = 0x68
    bytes[at + 7] = 0
    at += 9
  }
  for (let frame = 0; frame < frames; frame += 1) {
    view.setInt32(at, 256, true)
    at += 4
  }
  for (let i = 0; i < directions * frames * layerCount; i += 1) {
    bytes[at] = i % layerCount
    at += 1
  }
  return bytes
}

/** An archive holding only the COF: every DCC layer will fail to resolve. */
function archivesWithOnlyCof(cof: Uint8Array): MountedArchives {
  const cofName = 'data\\global\\monsters\\fa\\cof\\fawlhth.cof'
  return {
    listFiles: async () => [cofName],
    read: async (name: string) => {
      if (name === cofName) return cof
      throw new Error(`not found: ${name}`)
    },
  } as unknown as MountedArchives
}

describe('compositeMonsterAnimation layer failures', () => {
  it('reports and logs every dropped COF layer instead of swallowing it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const sheet = await compositeMonsterAnimation(archivesWithOnlyCof(makeCof(3)), 'fa', 'wl', 'hth')
      // Three layers, no DCC members in the archive: three honest failures.
      expect(sheet.layers).toBe(3)
      expect(sheet.layerFailures.length).toBe(3)
      expect(sheet.layerFailures.map(f => f.component)).toEqual(['hd', 'tr', 'lg'])
      expect(sheet.layerFailures.every(f => f.reason === 'no-member')).toBe(true)
      expect(sheet.decodedMembers).toEqual([])
      // Silence was the bug; the log is part of the fix.
      expect(error).toHaveBeenCalledTimes(3)
    } finally {
      error.mockRestore()
    }
  })

  it('reports a layer whose DCC is present but undecodable', async () => {
    const cofName = 'data\\global\\monsters\\fa\\cof\\fawlhth.cof'
    const dccName = 'data\\global\\monsters\\fa\\hd\\fahdlitwlhth.dcc'
    const cof = makeCof(1)
    const archives = {
      listFiles: async () => [cofName, dccName],
      read: async (name: string) => {
        if (name === cofName) return cof
        // A truncated DCC: found, but `decodeDcc` cannot read it.
        if (name === dccName) return new Uint8Array([0, 0, 0])
        throw new Error(`not found: ${name}`)
      },
    } as unknown as MountedArchives

    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const sheet = await compositeMonsterAnimation(archives, 'fa', 'wl', 'hth')
      expect(sheet.layerFailures.length).toBe(1)
      expect(sheet.layerFailures[0]?.reason).toBe('decode')
      expect(sheet.layerFailures[0]?.member).toBe(dccName)
      expect(error).toHaveBeenCalledTimes(1)
    } finally {
      error.mockRestore()
    }
  })
})

describe('act scene monster art diagnostics', () => {
  it('names the monster ids that will draw as red boxes', () => {
    expect(missingMonsterArtIds(['Fallen1', 'zombie1'], new Set(['fallen1'])))
      .toEqual(['zombie1'])
    expect(missingMonsterArtIds(['fallen1', 'fallen1'], new Set()))
      .toEqual(['fallen1'])
    expect(missingMonsterArtIds(['fallen1'], new Set(['fallen1']))).toEqual([])
  })
})
