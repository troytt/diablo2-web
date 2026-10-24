import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MISSILE_METAS, type MissileMeta } from '../src/client/render/missiles-meta.ts'
import { normalizeCelFileKey, resolveArtByCelFile } from '../src/client/render/cel-file-key.ts'
import { loadMissileArtMap, type LoadedMissileArt } from '../src/client/scene/missile-overlay-renderer.ts'
import type { SpriteRenderer } from '../src/client/render/renderer.ts'
import { CANONICAL_113C_MISSILES } from '../src/common/skills/missiles-data.ts'

/** The 34 real Missiles.txt rows whose backslash CelFile missed the forward-slash art keys (Issue #1043). */
const ISSUE_1043_ROWS = [
  'bomb in air', 'bomb on ground', 'bomb explosion',
  'shock field in air', 'shock field on ground',
  'catapult spike in air', 'catapult spike on ground',
  'sucshockfield',
  'erruption crack 1', 'erruption smoke 1',
  'vines trail', 'vines wither', 'plague vines trail', 'plague vines wither',
  'volcano overlay fire', 'volcano debris 2', 'volcano explosion', 'volcano small fire',
  'lureprojectile',
  'frozenhorror arcticblast1', 'frozenhorror arcticblast2',
  'sentryspikeinair', 'sentryspikeonground',
  'recycler vine', 'recycler fade',
  'bladefragment1', 'bladefragment2', 'bladefragment3',
  'dragonflightmaker',
  'mindblast hit', 'mindblast center',
  'blade shield missile',
  'diablogeddonrock', 'diablogeddontail',
] as const

/** Baked atlases are written by pack-missiles under the meta name, with meta.celFile using '/'. */
const BAKED_BY_STEM = new Map<string, MissileMeta>()
for (const meta of Object.values(MISSILE_METAS)) BAKED_BY_STEM.set(meta.name.toLowerCase(), meta)

let artMap: Map<string, LoadedMissileArt>

beforeEach(async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    const m = /\/missiles\/(.+)\.(json|png)$/.exec(decodeURIComponent(url))
    const meta = m ? BAKED_BY_STEM.get(m[1]!) : undefined
    if (!meta) return { ok: false, status: 404 }
    return {
      ok: true,
      status: 200,
      json: async () => meta,
      blob: async () => ({}),
    }
  })
  vi.stubGlobal('createImageBitmap', async () => ({ close() {} }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  let handle = 0
  const renderer = { addAtlas: () => ({ id: ++handle }) } as unknown as SpriteRenderer
  artMap = await loadMissileArtMap(renderer)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Issue #1043: Missiles.txt CelFile art keys are normalised on both sides', () => {
  it('normalises backslash / case to the baker key', () => {
    expect(normalizeCelFileKey('expansion\\FireTraumaMissile')).toBe('expansion/firetraumamissile')
    expect(normalizeCelFileKey('Expansion/ShockField')).toBe('expansion/shockfield')
    expect(normalizeCelFileKey('expansion\\ArcticBlastIce')).toBe(normalizeCelFileKey('expansion/ArcticBlastIce'))
  })

  it('the loader registers each atlas under its normalised CelFile key', () => {
    const art = artMap.get('expansion/firetraumamissile')
    expect(art).toBeDefined()
    expect(normalizeCelFileKey(art!.meta.celFile)).toBe('expansion/firetraumamissile')
  })

  it('a backslash CelFile lookup resolves through the normalised key', () => {
    const row = CANONICAL_113C_MISSILES['frozenhorror arcticblast1']!
    expect(row.celFile).toBe('expansion\\ArcticBlastIce')
    const art = resolveArtByCelFile(artMap, row.name, row.celFile)
    expect(art).toBeDefined()
    expect(art!.meta.celFile).toBe('expansion/ArcticBlastIce')
  })

  it.each(ISSUE_1043_ROWS)('%s resolves to the atlas baked from its own CelFile', name => {
    const row = CANONICAL_113C_MISSILES[name]
    expect(row, name).toBeDefined()
    expect(row!.celFile).toMatch(/\\/)
    const art = resolveArtByCelFile(artMap, row!.name, row!.celFile)
    expect(art, `${name} (${row!.celFile})`).toBeDefined()
    expect(normalizeCelFileKey(art!.meta.celFile)).toBe(normalizeCelFileKey(row!.celFile))
  })

  it('never substitutes another DCC: every resolved row atlas has the row CelFile', () => {
    const wrong: string[] = []
    for (const row of Object.values(CANONICAL_113C_MISSILES)) {
      if (!row.celFile || row.celFile.toLowerCase() === 'null') continue
      const art = resolveArtByCelFile(artMap, row.name, row.celFile)
      if (art && normalizeCelFileKey(art.meta.celFile) !== normalizeCelFileKey(row.celFile)) wrong.push(row.name)
    }
    expect(wrong).toEqual([])
  })

  it('rejects a name-keyed atlas that was baked from another CelFile', () => {
    const map = new Map<string, { meta: { celFile: string } }>([['fireexplosion', { meta: { celFile: 'Fsexplode' } }]])
    expect(resolveArtByCelFile(map, 'fireexplosion', 'FireArrowExplode2')).toBeUndefined()
    expect(resolveArtByCelFile(map, 'fireexplosion', 'fsexplode')).toBeDefined()
  })
})
