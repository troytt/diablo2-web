import { describe, expect, it } from 'vitest'
import { aggregateAndSortProperties, formatPropertyCode } from '../../src/common/items/item-tooltip.ts'
import { computePoisonPair, formatElementalPair, formatPoisonPair } from '../../src/common/items/damage-merge.ts'
import type { RolledItemProp } from '../../src/common/items/items.ts'

const p = (code: string, value: number, min = value, max = value, param?: number): RolledItemProp => ({ code, value, min, max, ...(param !== undefined ? { param } : {}) })
const codes = (props: RolledItemProp[]) => aggregateAndSortProperties(props).map(x => x.code)
const lines = (props: RolledItemProp[]) =>
  aggregateAndSortProperties(props).map(x => formatPropertyCode(x.code, x.value, x.min, x.max, x.param, 'en'))

/** Issues #1594 / #1596 / #1597: D2Client.dll 0x6FB04000 + 0x6FB04280 damage pair merging. */
describe('item tooltip damage-pair merging (D2Client.dll 0x6FB04280)', () => {
  it('#1594 physical: combines only when min < max, otherwise keeps both lines', () => {
    expect(lines([p('dmg-min', 5), p('dmg-max', 9)])).toContain('Adds 5-9 damage')
    expect(codes([p('dmg-min', 9), p('dmg-max', 5)]).sort()).toEqual(['dmg-max', 'dmg-min'])
    expect(codes([p('dmg-min', 7), p('dmg-max', 7)]).sort()).toEqual(['dmg-max', 'dmg-min'])
    expect(codes([p('dmg-max', 7)])).toEqual(['dmg-max'])
  })

  it('#1596 elemental: min < max -> "Adds a-b", min >= max -> "+max" (strMod<E>Damage)', () => {
    expect(lines([p('fire-min', 3), p('fire-max', 8)])).toContain('Adds 3-8 fire damage')
    expect(lines([p('fire-min', 8), p('fire-max', 8)])).toContain('+8 fire damage')
    expect(lines([p('ltng-min', 9), p('ltng-max', 4)])).toContain('+4 lightning damage')
    expect(lines([p('dmg-cold', 2, 2, 6, 50)])).toContain('Adds 2-6 cold damage')
    expect(codes([p('fire-min', 5)])).toEqual(['fire-min'])
    expect(formatElementalPair('mag', 2, 2, 'en')).toBe('+2 magic damage')
    expect(formatElementalPair('fire', 1, 4, 'zh')).toBe('增加 1-4 火焰傷害')
  })

  it('#1597 poison: (v*len/count + 128) >> 8, seconds = len/25, range when min < max', () => {
    // MagicSuffix "of Blight": dmg-pois par 50 min 8 max 8 -> (8*50+128)>>8 = 2 over 2 seconds
    expect(lines([p('dmg-pois', 8, 8, 8, 50)])).toContain('+2 poison damage over 2 seconds')
    // Runeword Venom: dmg-pois 175 / 312 / 312 -> (312*175+128)>>8 = 213 over 7 seconds
    expect(computePoisonPair(312, 312, 175, 1)).toEqual({ min: 213, max: 213, seconds: 7 })
    // two dmg-pois sources: lengths summed then divided by poison_count
    const merged = aggregateAndSortProperties([p('dmg-pois', 8, 8, 8, 50), p('dmg-pois', 16, 16, 48, 75)])
    const pois = merged.find(x => x.code === 'dmg-pois')!
    expect(pois.param).toBe(62)
    expect(formatPropertyCode('dmg-pois', pois.value, pois.min, pois.max, pois.param, 'en')).toBe(
      formatPoisonPair(24, 56, 125, 2, 'en'),
    )
    expect(formatPoisonPair(24, 56, 125, 2, 'en')).toBe('Adds 6-14 poison damage over 2 seconds')
    // only one half present -> no combined line
    expect(codes([p('pois-min', 32), p('pois-len', 75)])).toEqual(['pois-min'])
  })
})
