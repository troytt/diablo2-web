import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { ADDITIVE_OBJECT_TOKENS, loadObjectsTable, resolveDs1Object } from '../src/common/units/objects.ts'
import { ADDITIVE_MONSTER_TOKENS, compositeMonsterAnimation } from '../src/client/render/monster-art.ts'
import { packSheetToR8 } from '../src/baker/packers/pack-entity-assets.ts'
import type { SpriteSheet, SpriteGroup } from '../src/common/formats/sprite.ts'
import { decodeCof } from '../src/common/formats/cof.ts'

describe('Offline Asset Packing Pipelines Transparency (Milestone 3)', () => {
  const hasD2 = existsSync('samples/d2/d2data.mpq') && existsSync('samples/d2/Patch_D2.mpq')

  describe('Act Asset Packing (pack-act-assets.ts)', () => {
    it.skipIf(!hasD2)('resolves objects with Trans=7 or in ADDITIVE_OBJECT_TOKENS with blendMode: additive', async () => {
      const { MountedArchives } = await import('../src/common/mpq/mount.ts')
      const { MpqArchive } = await import('../src/common/mpq/archive.ts')
      const { fileSource } = await import('../src/baker/io/file-source.ts')

      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2char.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      const objectsTable = await loadObjectsTable(archives)

      // Token 11 & 12 (Chaos Sanctuary cathedral window light beams in Act 4)
      for (const token of ['11', '12']) {
        expect(ADDITIVE_OBJECT_TOKENS.has(token)).toBe(true)
        const row = objectsTable.rows.find(r => r.token.toUpperCase() === token)
        const isAdditive = (row !== undefined && (row.trans === 7 || row.trans === 1)) || ADDITIVE_OBJECT_TOKENS.has(token)
        expect(isAdditive).toBe(true)
      }

      // Tokens R1..R5, 1R..4R (Trans=7 directional light beams)
      const beamTokens = ['R1', 'R2', 'R3', 'R4', 'R5', '1R', '2R', '3R', '4R']
      for (const token of beamTokens) {
        expect(ADDITIVE_OBJECT_TOKENS.has(token)).toBe(true)
        const row = objectsTable.rows.find(r => r.token.toUpperCase() === token)
        expect(row).toBeDefined()
        expect(row?.trans).toBe(7)
      }

      // Token HA (Trans=1 arcane orifice)
      const haRow = objectsTable.rows.find(r => r.token.toUpperCase() === 'HA')
      expect(haRow).toBeDefined()
      expect(haRow?.trans).toBe(1)
      expect(ADDITIVE_OBJECT_TOKENS.has('HA')).toBe(true)
    })

    it.skipIf(!hasD2)('verifies COF layers for token 11 have drawEffect=3 and transparent=true', async () => {
      const { MountedArchives } = await import('../src/common/mpq/mount.ts')
      const { MpqArchive } = await import('../src/common/mpq/archive.ts')
      const { fileSource } = await import('../src/baker/io/file-source.ts')

      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2char.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }

      const cofBytes = await archives.read('data\\global\\objects\\11\\cof\\11nuhth.cof')
      const cof = decodeCof(cofBytes)
      expect(cof.layers.length).toBeGreaterThan(0)
      const layer0 = cof.layers[0]!
      expect(layer0.drawEffect).toBe(3)
      expect(layer0.transparent).toBe(true)
    })
  })

  describe('Entity Asset Packing (pack-entity-assets.ts)', () => {
    it.skipIf(!hasD2)('packs pure additive monster (WR) into R8 with blendMode: additive and no glowSheet', async () => {
      const { MountedArchives } = await import('../src/common/mpq/mount.ts')
      const { MpqArchive } = await import('../src/common/mpq/archive.ts')
      const { fileSource } = await import('../src/baker/io/file-source.ts')

      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2char.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }

      const wr = await compositeMonsterAnimation(archives, 'WR', 'wl', 'hth')
      expect(wr.blendMode).toBe('additive')
      expect(wr.glowSheet).toBeUndefined()

      const packed = packSheetToR8(wr.sheet, 172)
      expect(packed.width).toBeGreaterThan(0)
      expect(packed.height).toBeGreaterThan(0)
      expect(packed.r8.byteLength).toBe(packed.width * packed.height)
      expect(packed.groups.length).toBe(wr.sheet.groups.length)
    })

    it.skipIf(!hasD2)('packs composite monster (FR) combining base and glow groups into single R8 atlas', async () => {
      const { MountedArchives } = await import('../src/common/mpq/mount.ts')
      const { MpqArchive } = await import('../src/common/mpq/archive.ts')
      const { fileSource } = await import('../src/baker/io/file-source.ts')

      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2char.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }

      const fr = await compositeMonsterAnimation(archives, 'FR', 'wl', 'hth')
      expect(fr.blendMode).toBe('normal')
      expect(fr.glowSheet).toBeDefined()
      expect(fr.glowSheet?.groups.length).toBe(fr.sheet.groups.length)

      const baseGroups = fr.sheet.groups
      const glowGroups = fr.glowSheet!.groups
      const baseCount = baseGroups.length

      const joinedSheet: SpriteSheet = {
        groups: [...baseGroups, ...glowGroups],
        width: null,
      }

      const packed = packSheetToR8(joinedSheet, 172)
      expect(packed.groups.length).toBe(baseCount * 2)

      const packedBaseGroups = packed.groups.slice(0, baseCount)
      const packedGlowGroups = packed.groups.slice(baseCount)

      expect(packedBaseGroups.length).toBe(baseCount)
      expect(packedGlowGroups.length).toBe(baseCount)

      // Ensure every base and glow frame has valid coords in the packed R8 buffer
      for (let g = 0; g < baseCount; g += 1) {
        const bg = packedBaseGroups[g]!
        const gg = packedGlowGroups[g]!
        expect(bg.length).toBe(gg.length)

        for (let f = 0; f < bg.length; f += 1) {
          const [bx, by, bw, bh, bax, bay] = bg[f]!
          const [gx, gy, gw, gh, gax, gay] = gg[f]!

          // Valid dimensions within atlas
          expect(bx + bw).toBeLessThanOrEqual(packed.width)
          expect(by + bh).toBeLessThanOrEqual(packed.height)
          expect(gx + gw).toBeLessThanOrEqual(packed.width)
          expect(gy + gh).toBeLessThanOrEqual(packed.height)

          // Anchors must match between base frame and glow frame
          expect(bax).toBe(gax)
          expect(bay).toBe(gay)
        }
      }
    })
  })
})
