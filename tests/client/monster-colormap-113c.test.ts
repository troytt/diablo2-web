import { describe, expect, it } from 'vitest'
import { RAND_TRANSFORMS_113C } from '../../src/common/formats/pl2.ts'
import {
  MONFLAG_SUPERUNIQUE,
  MONFLAG_UNIQUE,
  resolveMonsterColormap113c,
  resolveMonsterPaletteIndex113c,
  rollUniquePaletteIndex113c,
} from '../../src/common/units/monster-colormap-113c.ts'
import { MONSTER_PALETTE_COLUMNS_113C, MONSTER_PALSHIFT_BY_TOKEN } from '../../src/common/units/monster-palshift-113c.ts'
import { colormapPaletteRow, EXTRA_COLORMAP_FIRST_ROW, extraColormapTables } from '../../src/client/render/colormap-rows.ts'

const hc = (name: string): number => {
  // MonStats Id order == hcIdx; locate by the generated token/TransLvl columns of a few known rows.
  const ids: Record<string, number> = { fallen1: 19, fallen2: 20, fallen3: 21, andariel: 156, necroskeleton: 363, cain1: 146 }
  const id = ids[name]
  if (id === undefined) throw new Error(name)
  return id
}

const base = { flags: 0, difficulty: 0 as const, hasFriendlyOwner: false }
const seed = (): { lo: number; hi: number } => ({ lo: 1, hi: 666 })

describe('monster palette index (D2Client 0x6fb57780, #1516 / #1517)', () => {
  it('generated columns carry MonStats TransLvl for the Fallen variants (token fa)', () => {
    expect(MONSTER_PALETTE_COLUMNS_113C[hc('fallen1')]!.slice(0, 2)).toEqual(['fa', 0])
    expect(MONSTER_PALETTE_COLUMNS_113C[hc('fallen2')]!.slice(0, 2)).toEqual(['fa', 1])
    expect(MONSTER_PALETTE_COLUMNS_113C[hc('fallen3')]!.slice(0, 2)).toEqual(['fa', 2])
  })

  it('normal monsters use TransLvl + 2 and draw palshift.dat[idx] (identity tables draw nothing)', () => {
    const i1 = resolveMonsterPaletteIndex113c({ ...base, classId: hc('fallen1'), seed: seed() })
    const i2 = resolveMonsterPaletteIndex113c({ ...base, classId: hc('fallen2'), seed: seed() })
    expect(i1).toBe(2)
    expect(i2).toBe(3)
    expect(resolveMonsterColormap113c(hc('fallen1'), i1)).toBeNull()
    const c2 = resolveMonsterColormap113c(hc('fallen2'), i2)
    expect(c2).not.toBeNull()
    // fa palshift.dat entry 3 maps index 1 -> 175 (first bytes 0 175 2 3 4 117).
    expect(Array.from(c2!.subarray(0, 6))).toEqual([0, 175, 2, 3, 4, 117])
  })

  it('a token without palshift.dat never gets a colormap, whatever the index', () => {
    const noFile = MONSTER_PALETTE_COLUMNS_113C.findIndex(([token]) => token !== '' && MONSTER_PALSHIFT_BY_TOKEN[token] === undefined)
    expect(noFile).toBeGreaterThanOrEqual(0)
    for (const idx of [0, 2, 5, 9, 29]) expect(resolveMonsterColormap113c(noFile, idx)).toBeNull()
  })

  it('uniques roll classId + (nameSeed & 0xFF) on the unit seed: idx = lo % 30 + 9, re-seeding the unit', () => {
    const s = seed()
    const idx = resolveMonsterPaletteIndex113c({ ...base, classId: hc('fallen1'), flags: MONFLAG_UNIQUE, nameSeed: 0x1234, seed: s })
    const expected = { lo: 0, hi: 0 }
    expect(idx).toBe(rollUniquePaletteIndex113c(expected, hc('fallen1'), 0x34))
    expect(s).toEqual(expected)
    // Manual LCG: lo = (19 + 0x34) * 0x6AC690C5 + 666 (mod 2^32).
    const lo = Number((BigInt(19 + 0x34) * 0x6ac690c5n + 666n) & 0xffffffffn)
    const raw = (lo % 30) + 9
    expect(idx).toBe(raw >= 30 ? 2 : raw)
  })

  it('uniques whose roll lands at >= 30 fall back to 2; 9..29 draw RandTransforms[idx - 8]', () => {
    for (let nameSeed = 0; nameSeed < 256; nameSeed += 1) {
      const idx = resolveMonsterPaletteIndex113c({ ...base, classId: hc('fallen1'), flags: MONFLAG_UNIQUE, nameSeed, seed: seed() })
      expect(idx === 2 || (idx >= 9 && idx <= 29)).toBe(true)
      if (idx >= 9) expect(resolveMonsterColormap113c(hc('fallen1'), idx)).toBe(RAND_TRANSFORMS_113C[idx - 8])
    }
  })

  it('noUniqueShift monsters keep their base index even with the unique flag', () => {
    const idx = resolveMonsterPaletteIndex113c({ ...base, classId: hc('cain1'), flags: MONFLAG_UNIQUE, nameSeed: 7, seed: seed() })
    expect(idx).toBe(MONSTER_PALETTE_COLUMNS_113C[hc('cain1')]![1] + 2)
  })

  it('MonStats2 Utrans per difficulty overrides (Andariel 2/3/4) and 0xFF resolves through the owner', () => {
    for (const difficulty of [0, 1, 2] as const) {
      expect(resolveMonsterPaletteIndex113c({ ...base, difficulty, classId: hc('andariel'), seed: seed() })).toBe(2 + difficulty)
    }
    expect(resolveMonsterPaletteIndex113c({ ...base, classId: hc('necroskeleton'), seed: seed() })).toBe(0)
    expect(resolveMonsterPaletteIndex113c({ ...base, classId: hc('necroskeleton'), seed: seed(), hasFriendlyOwner: true })).toBe(1)
  })

  it('SuperUniques Utrans overrides; values >= 30 reset to 2', () => {
    // SuperUniques hcIdx 19: Utrans 11/11/11; hcIdx 27: 37/37/37 (>= 30 -> 2).
    expect(resolveMonsterPaletteIndex113c({ ...base, classId: hc('fallen1'), flags: MONFLAG_SUPERUNIQUE, superUniqueId: 19, seed: seed() })).toBe(11)
    expect(resolveMonsterPaletteIndex113c({ ...base, classId: hc('fallen1'), flags: MONFLAG_SUPERUNIQUE, superUniqueId: 27, seed: seed() })).toBe(2)
  })

  it('colormap rows are appended after the fixed palette rows and deduplicated', () => {
    const table = RAND_TRANSFORMS_113C[3]!
    const row = colormapPaletteRow(table)
    expect(row).toBeGreaterThanOrEqual(EXTRA_COLORMAP_FIRST_ROW)
    expect(colormapPaletteRow(table)).toBe(row)
    expect(extraColormapTables()[row - EXTRA_COLORMAP_FIRST_ROW]).toBe(table)
  })
})
