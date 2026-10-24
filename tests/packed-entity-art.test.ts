import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ACT_MONSTER_SPECS, MONSTER_ART_MAP } from '../src/common/units/monster-mapping.ts'

describe('offline pre-baked entity atlases & full Act 1..5 pack index (Issues #30 & #33)', () => {
  const packRoot = join(process.cwd(), 'public', 'packs')
  const globalDir = join(process.cwd(), 'public', 'entities')
  const indexJsonPath = join(packRoot, 'index.json')
  const hasPacks = existsSync(indexJsonPath) && existsSync(join(globalDir, 'char-so.json'))
  const hasActEntityPngs = existsSync(join(packRoot, 'act1', 'entities', 'char-so.png'))

  it('maps 700+ monster IDs across Acts 1..5 in MONSTER_ART_MAP', () => {
    expect(Object.keys(MONSTER_ART_MAP).length).toBeGreaterThanOrEqual(700)
    expect(MONSTER_ART_MAP.fallen).toEqual({ token: 'FA', weapon: 'hth' })
    expect(MONSTER_ART_MAP.hellbovine).toEqual({ token: 'EC', weapon: 'hth' })
    expect(MONSTER_ART_MAP.skeleton).toEqual({ token: 'SK', weapon: 'hth' })
  })

  it.skipIf(!hasPacks)('includes all 5 acts and 136+ map scenes in public/packs/index.json (Issue #33)', () => {
    const index = JSON.parse(readFileSync(indexJsonPath, 'utf8'))
    expect(Array.isArray(index.levels)).toBe(true)
    expect(index.levels.length).toBeGreaterThanOrEqual(136)

    const actsPresent = new Set(index.levels.map((l: { act: number }) => l.act))
    expect(actsPresent.has(1)).toBe(true)
    expect(actsPresent.has(2)).toBe(true)
    expect(actsPresent.has(3)).toBe(true)
    expect(actsPresent.has(4)).toBe(true)
    expect(actsPresent.has(5)).toBe(true)
  })

  it.skipIf(!hasActEntityPngs)('bakes Sorceress char-so PNG + JSON for Acts 1..5', () => {
    for (let act = 1; act <= 5; act += 1) {
      const dir = join(packRoot, `act${act}`, 'entities')
      const jsonPath = join(dir, 'char-so.json')
      const pngPath = join(dir, 'char-so.png')
      expect(existsSync(jsonPath)).toBe(true)
      expect(existsSync(pngPath)).toBe(true)

      const meta = JSON.parse(readFileSync(jsonPath, 'utf8'))
      expect(meta.schema).toBe(2)
      expect(meta.file).toBe('char-so.png')
      expect(meta.directions).toBe(16)
      expect(meta.walk).toBe(0)
      expect(meta.stand).toBe(16)
      expect(meta.members).toBeGreaterThanOrEqual(16)
      expect(meta.groups.length).toBe(176) // 11 player modes * 16 directions
      expect(meta.groups[0]![0]!.length).toBe(6) // [x, y, w, h, ax, ay]

      const png = readFileSync(pngPath)
      expect(png[0]).toBe(137)
      expect(png[1]).toBe(80) // P
      expect(png[2]).toBe(78) // N
      expect(png[3]).toBe(71) // G
      const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
      expect(view.getUint32(16)).toBe(meta.width)
      expect(view.getUint32(20)).toBe(meta.height)
    }
  })

  it.skipIf(!hasActEntityPngs)('bakes monster PNG + JSON atlases for all per-Act monster specs across Acts 1..5', () => {
    for (let act = 1; act <= 5; act += 1) {
      const dir = join(packRoot, `act${act}`, 'entities')
      const specs = ACT_MONSTER_SPECS[act] ?? []
      expect(specs.length).toBeGreaterThan(0)
      for (const spec of specs) {
        const slug = `monster-${spec.token.toLowerCase()}-${spec.weapon.toLowerCase()}`
        const jsonPath = join(dir, `${slug}.json`)
        const pngPath = join(dir, `${slug}.png`)
        expect(existsSync(jsonPath), `missing ${jsonPath}`).toBe(true)
        expect(existsSync(pngPath), `missing ${pngPath}`).toBe(true)

        const meta = JSON.parse(readFileSync(jsonPath, 'utf8'))
        expect(meta.schema).toBe(2)
        expect(meta.token).toBe(spec.token)
        expect(meta.weapon).toBe(spec.weapon)
        expect([1, 4, 8, 16]).toContain(meta.directions)
        if (meta.clips?.wl) {
          expect(meta.walkOffset).toBe(0)
        }
        expect(meta.standOffset).toBe(meta.clips?.nu?.group ?? meta.directions)
        expect(meta.groups.length).toBeGreaterThanOrEqual(meta.directions)
        expect(meta.groups[0]![0]!.length).toBe(6) // [x, y, w, h, ax, ay]

        const png = readFileSync(pngPath)
        const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
        expect(view.getUint32(16)).toBe(meta.width)
        expect(view.getUint32(20)).toBe(meta.height)
      }
    }
  })

  it.skipIf(!hasPacks)('bakes global act-independent raw 8-bit (.r8) index textures into public/entities/ (Issue #34)', () => {
    const charJsonPath = join(globalDir, 'char-so.json')
    const charR8Path = join(globalDir, 'char-so.r8')
    expect(existsSync(charJsonPath)).toBe(true)
    expect(existsSync(charR8Path)).toBe(true)

    const charMeta = JSON.parse(readFileSync(charJsonPath, 'utf8'))
    expect(charMeta.schema).toBe(2)
    expect(charMeta.file).toBe('char-so.r8')
    expect(charMeta.format).toBe('r8')
    expect(charMeta.groups[0]![0]!.length).toBe(6)
    const charR8 = readFileSync(charR8Path)
    expect(charR8.byteLength).toBe(charMeta.width * charMeta.height)

    // Check all 67 unique drawable monster specs exist as global .r8 files (excluding placeholder token XX)
    const uniqueSpecs = new Set<string>()
    for (let act = 1; act <= 5; act += 1) {
      for (const spec of ACT_MONSTER_SPECS[act] ?? []) {
        if (!spec.token || spec.token.toUpperCase() === 'XX') continue
        uniqueSpecs.add(`${spec.token.toLowerCase()}-${spec.weapon.toLowerCase()}`)
      }
    }
    expect(uniqueSpecs.size).toBe(67)

    for (const key of uniqueSpecs) {
      const slug = `monster-${key}`
      const jsonPath = join(globalDir, `${slug}.json`)
      const r8Path = join(globalDir, `${slug}.r8`)
      expect(existsSync(jsonPath), `missing global ${jsonPath}`).toBe(true)
      expect(existsSync(r8Path), `missing global ${r8Path}`).toBe(true)

      const meta = JSON.parse(readFileSync(jsonPath, 'utf8'))
      expect(meta.schema).toBe(2)
      expect(meta.file).toBe(`${slug}.r8`)
      expect(meta.format).toBe('r8')
      expect(meta.groups[0]![0]!.length).toBe(6)
      const r8 = readFileSync(r8Path)
      expect(r8.byteLength).toBe(meta.width * meta.height)

      let nonZero = 0
      for (let i = 0; i < r8.length; i += 1) {
        if (r8[i] !== 0) nonZero += 1
      }
      expect(nonZero).toBeGreaterThan(0)
    }
  })

  it('EntityArtCache with canonical root packBase requests only /entities/* and never /assets/entities/* (Issue #911)', async () => {
    const { EntityArtCache } = await import('../src/client/scene/entity-art-loader.ts')
    const requestedUrls: string[] = []
    const fakeRenderer = {
      addIndexedAtlas: () => ({ id: 1 }) as any,
      addAtlas: () => ({ id: 1 }) as any,
    } as any
    const fakeFetch = (async (url: string) => {
      requestedUrls.push(String(url))
      if (url === '/entities/index.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            monsterByClassId: {
              '148': {
                key: 'monster-am-hth',
                slug: 'monster-am-hth',
                token: 'AM',
                file: 'monster-am-hth.r8',
                metaFile: 'monster-am-hth.json',
                packPath: 'monster-am-hth',
              },
            },
            objectByClassId: {
              '119': {
                id: 119,
                classId: 119,
                name: 'Waypoint',
                token: 'WP',
                slug: 'wp',
                draw: true,
              },
            },
          }),
        }
      }
      if (url.endsWith('.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schema: 2,
            token: 'AM',
            file: 'test.r8',
            width: 2,
            height: 2,
            directions: 1,
            standOffset: 0,
            standFrames: 1,
            groups: [[[0, 0, 2, 2, 0, 0]]],
          }),
        }
      }
      if (url.endsWith('.r8')) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => new Uint8Array(4).buffer,
        }
      }
      return { ok: false, status: 404 }
    }) as unknown as typeof fetch

    const cache = new EntityArtCache({ renderer: fakeRenderer, packBase: '', fetchFn: fakeFetch })
    await cache.loadIndex()
    cache.getMonsterArt(148, 1)
    cache.getObjectArt(119, 1)
    await cache.waitForInflight()

    expect(requestedUrls).toEqual([
      '/entities/index.json',
      '/entities/monster-am-hth.json',
      '/entities/monster-am-hth.r8',
      '/entities/object-wp.json',
      '/entities/object-wp.r8',
    ])
    expect(requestedUrls.some(u => u.includes('/assets/'))).toBe(false)
  })
})

