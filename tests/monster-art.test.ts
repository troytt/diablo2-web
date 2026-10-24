import { existsSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { MONSTER_COMPONENTS, findMonsterLayerSprite } from '../src/client/render/monster-art.ts'

describe('monster-art', () => {
  it('covers all 16 monster composite component folders', () => {
    expect(MONSTER_COMPONENTS.length).toBe(16)
    expect(MONSTER_COMPONENTS[0]).toBe('hd')
    expect(MONSTER_COMPONENTS[1]).toBe('tr')
    expect(MONSTER_COMPONENTS[8]).toBe('s1')
    expect(MONSTER_COMPONENTS[15]).toBe('s8')
  })

  it('finds monster layer sprites by convention', () => {
    const names = [
      'data\\global\\monsters\\fa\\tr\\fatrlitwlhth.dcc',
      'data\\global\\monsters\\fa\\s1\\fas1litwlhth.dcc',
      'data\\global\\monsters\\fa\\rh\\farhaxewlhth.dcc',
      'data\\global\\monsters\\fa\\sh\\fashbucwlhth.dcc',
    ]
    const root = 'data\\global\\monsters\\fa\\'
    const hit = findMonsterLayerSprite(names, root, 'fa', 'wl', 'hth', 'tr')
    expect(hit).toBe('data\\global\\monsters\\fa\\tr\\fatrlitwlhth.dcc')

    const missing = findMonsterLayerSprite(names, root, 'fa', 'wl', 'hth', 'hd')
    expect(missing).toBeUndefined()
  })

  it('correctly maps 8 COF directions to permuted DCC directions via dir64ToDcc', async () => {
    const { dir64ToDcc } = await import('../src/common/units/character.ts')
    // In D2 DCC files with 8 directions, order is permuted: [4, 0, 5, 1, 6, 2, 7, 3]
    const cofDirections = 8
    const dccDirs = Array.from({ length: cofDirections }, (_, dir) => {
      const dir64 = Math.round((dir * 64) / cofDirections)
      return dir64ToDcc(dir64, 8)
    })
    expect(dccDirs).toEqual([4, 0, 5, 1, 6, 2, 7, 3])
  })

  it('calculates 8-direction facing correctly from dx, dy in combat.ts', async () => {
    const { facingOf } = await import('../src/server/ai/monster-ai.ts')
    // 0: South (dx=0, dy>0)
    expect(facingOf(0, 10)).toBe(0)
    // 1: South-West (dx<0, dy>0)
    expect(facingOf(-10, 10)).toBe(1)
    // 2: West (dx<0, dy=0)
    expect(facingOf(-10, 0)).toBe(2)
    // 3: North-West (dx<0, dy<0)
    expect(facingOf(-10, -10)).toBe(3)
    // 4: North (dx=0, dy<0)
    expect(facingOf(0, -10)).toBe(4)
    // 5: North-East (dx>0, dy<0)
    expect(facingOf(10, -10)).toBe(5)
    // 6: East (dx>0, dy=0)
    expect(facingOf(10, 0)).toBe(6)
    // 7: South-East (dx>0, dy>0)
    expect(facingOf(10, 10)).toBe(7)
    // Stationary
    expect(facingOf(0, 0)).toBe(0)
  })

  it('declares and re-exports ADDITIVE_MONSTER_TOKENS with ground truth tokens', async () => {
    const { ADDITIVE_MONSTER_TOKENS } = await import('../src/client/render/monster-art.ts')
    const { ADDITIVE_MONSTER_TOKENS: SCENE_TOKENS } = await import('../src/client/scene/entity-art-loader.ts')

    expect(ADDITIVE_MONSTER_TOKENS).toBe(SCENE_TOKENS)
    const expected = ['WR', 'WW', 'FR', 'K9', '17', '46', 'FI', 'X3', 'X4', 'XW']
    for (const token of expected) {
      expect(ADDITIVE_MONSTER_TOKENS.has(token)).toBe(true)
    }
    expect(ADDITIVE_MONSTER_TOKENS.size).toBe(expected.length)
  })

  describe('layer separation and blendMode compositing (Milestone 2)', () => {
    const hasD2 = existsSync('samples/d2/d2data.mpq') && existsSync('samples/d2/Patch_D2.mpq')

    it.skipIf(!hasD2)('classifies pure additive monsters (WR, WW) with blendMode additive and no glowSheet', async () => {
      const { MountedArchives } = await import('../src/common/mpq/mount.ts')
      const { MpqArchive } = await import('../src/common/mpq/archive.ts')
      const { fileSource } = await import('../src/baker/io/file-source.ts')
      const { compositeMonsterAnimation } = await import('../src/client/render/monster-art.ts')

      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2char.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }

      // WR (Wraith)
      const wr = await compositeMonsterAnimation(archives, 'WR', 'wl', 'hth')
      expect(wr.blendMode).toBe('additive')
      expect(wr.glowSheet).toBeUndefined()
      expect(wr.sheet.groups.length).toBe(wr.directions)

      // WW (Willowisp)
      const ww = await compositeMonsterAnimation(archives, 'WW', 'wl', 'hth')
      expect(ww.blendMode).toBe('additive')
      expect(ww.glowSheet).toBeUndefined()
      expect(ww.sheet.groups.length).toBe(ww.directions)
    })

    it.skipIf(!hasD2)('separates composite monster FR into base and glow sheets with zero-drift alignment', async () => {
      const { MountedArchives } = await import('../src/common/mpq/mount.ts')
      const { MpqArchive } = await import('../src/common/mpq/archive.ts')
      const { fileSource } = await import('../src/baker/io/file-source.ts')
      const { compositeMonsterAnimation } = await import('../src/client/render/monster-art.ts')

      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2char.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }

      // FR (Finger Mage)
      const fr = await compositeMonsterAnimation(archives, 'FR', 'wl', 'hth')
      expect(fr.blendMode).toBe('normal')
      expect(fr.glowSheet).toBeDefined()
      expect(fr.glowSheet?.groups.length).toBe(fr.sheet.groups.length)

      for (let g = 0; g < fr.sheet.groups.length; g += 1) {
        const baseGroup = fr.sheet.groups[g]!
        const glowGroup = fr.glowSheet!.groups[g]!
        expect(baseGroup.frames.length).toBe(glowGroup.frames.length)

        for (let f = 0; f < baseGroup.frames.length; f += 1) {
          const bf = baseGroup.frames[f]!
          const gf = glowGroup.frames[f]!
          // Dimensions must be strictly identical
          expect(bf.width).toBe(gf.width)
          expect(bf.height).toBe(gf.height)
          // Anchors must guarantee zero drift
          expect(bf.anchorX).toBeDefined()
          expect(bf.anchorY).toBeDefined()
          expect(bf.anchorX).toBe(gf.anchorX)
          expect(bf.anchorY).toBe(gf.anchorY)
        }
      }
    })

    it.skipIf(!hasD2)('classifies pure normal monsters (FA) with blendMode normal and no glowSheet', async () => {
      const { MountedArchives } = await import('../src/common/mpq/mount.ts')
      const { MpqArchive } = await import('../src/common/mpq/archive.ts')
      const { fileSource } = await import('../src/baker/io/file-source.ts')
      const { compositeMonsterAnimation } = await import('../src/client/render/monster-art.ts')

      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2char.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }

      const fa = await compositeMonsterAnimation(archives, 'FA', 'wl', 'hth')
      expect(fa.blendMode).toBe('normal')
      expect(fa.glowSheet).toBeUndefined()
    })

    it.skipIf(!hasD2)('packs both base and glow sheets into single atlas in loadMonsterAtlas', async () => {
      const { MountedArchives } = await import('../src/common/mpq/mount.ts')
      const { MpqArchive } = await import('../src/common/mpq/archive.ts')
      const { fileSource } = await import('../src/baker/io/file-source.ts')
      const { loadMonsterAtlas } = await import('../src/client/render/monster-art.ts')

      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2char.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }

      const mockRenderer = {
        addIndexedAtlas: () => 101,
      } as any

      // FR: composite monster
      const frArt = await loadMonsterAtlas(archives, 'FR', 'hth', null as any, mockRenderer)
      expect(frArt.blendMode).toBe('normal')
      expect(frArt.glowGroups).toBeDefined()
      expect(frArt.glowGroups?.length).toBe(frArt.groups.length)
      expect(frArt.groups.length).toBe(16) // 8 walk + 8 stand

      for (let g = 0; g < frArt.groups.length; g += 1) {
        const bg = frArt.groups[g]!
        const gg = frArt.glowGroups![g]!
        expect(bg.length).toBe(gg.length)
        for (let f = 0; f < bg.length; f += 1) {
          const bf = bg[f]!
          const gf = gg[f]!
          expect(bf.width).toBe(gf.width)
          expect(bf.height).toBe(gf.height)
          expect(bf.anchorX).toBe(gf.anchorX)
          expect(bf.anchorY).toBe(gf.anchorY)
        }
      }

      // WR: pure additive monster
      const wrArt = await loadMonsterAtlas(archives, 'WR', 'hth', null as any, mockRenderer)
      expect(wrArt.blendMode).toBe('additive')
      expect(wrArt.glowGroups).toBeUndefined()
      expect(wrArt.groups.length).toBe(16)
    })
  })
})

