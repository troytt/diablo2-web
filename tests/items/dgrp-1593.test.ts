import { describe, expect, it } from 'vitest'
import { aggregateAndSortProperties, formatPropertyCode } from '../../src/common/items/item-tooltip.ts'
import type { RolledItemProp } from '../../src/common/items/items.ts'

const p = (code: string, value: number): RolledItemProp => ({ code, value, min: value, max: value })
const lines = (props: RolledItemProp[], loc: 'en' | 'zh' = 'en') =>
  aggregateAndSortProperties(props).map(x => formatPropertyCode(x.code, x.value, x.min, x.max, x.param, loc))

/** Issue #1593: D2Client.dll 0x6FB04AC0 folds dgrp groups on equal displayed values regardless of sign. */
describe('dgrp folding (D2Client.dll 0x6FB04AC0)', () => {
  it('folds equal positive and equal negative resistances', () => {
    expect(lines([p('res-fire', 15), p('res-cold', 15), p('res-ltng', 15), p('res-pois', 15)])).toEqual(['All Resistances +15'])
    // dgrpfunc 19 sprintf("All Resistances +%d", -10) — the tbl literal '+' stays
    expect(lines([p('res-fire', -10), p('res-cold', -10), p('res-ltng', -10), p('res-pois', -10)])).toEqual(['All Resistances +-10'])
    expect(lines([p('res-fire', 10), p('res-cold', 10), p('res-ltng', 10)]).length).toBe(3)
  })

  it('folds equal attributes with descfunc 1 / Moditem2allattrib', () => {
    expect(lines([p('str', 5), p('dex', 5), p('vit', 5), p('enr', 5)])).toEqual(['+5 to all Attributes'])
    expect(lines([p('str', -3), p('dex', -3), p('vit', -3), p('enr', -3)])).toEqual(['-3 to all Attributes'])
    expect(lines([p('all-stats', 2)], 'zh')).toEqual(['+2 轉為所有的屬性'])
  })
})
