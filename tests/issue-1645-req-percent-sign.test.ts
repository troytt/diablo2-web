/**
 * Issue #1645: Required Str/Dex with item_req_percent (stat 91, property `ease`).
 *
 * 1.13c ground truth (samples/d2/D2Common.dll, `objdump -d -M intel`):
 *  - #10244 0x6fd76db0: stat 91 read at 0x6fd76e74, then `delta = 0x6fd511e0(stat91, reqstr|reqdex, 100)`
 *    (0x6fd76e88 / 0x6fd76e9a). 0x6fd511e0 is a signed `imul`/`idiv` MulDiv: it truncates toward zero.
 *  - ethereal (`and eax,0x400000`) subtracts 10 from both (0x6fd76ec3 / 0x6fd76ec6); the stat sign is kept,
 *    so UniqueItems.txt The Humongous (`ease` +20) raises the requirement.
 */
import { describe, expect, it } from 'vitest'
import { createDroppedItem } from '../src/common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { formatItemTooltip } from '../src/common/items/item-tooltip.ts'

const tables = getEmbeddedDropTables()

function reqStrWith(ease: number, ethereal = false): { reqStr?: number | undefined; base: number } {
  const base = tables.getBase('uit')! // Monarch, reqstr 156
  const item = createDroppedItem(base, 'superior', {
    ilvl: 85,
    dwInitSeed: 42,
    ethereal,
    rolledProps: [{ code: 'ease', min: ease, max: ease, value: ease }],
  })
  return { reqStr: formatItemTooltip(item).reqStr, base: (base as unknown as { reqstr: number }).reqstr }
}

describe('issue #1645: item_req_percent keeps its sign and truncates (D2Common 0x6fd76db0)', () => {
  it('uses the Monarch reqstr from Armor.txt', () => {
    expect(reqStrWith(0).base).toBe(156)
  })

  it('negative ease truncates toward zero: 156 + trunc(-31.2) = 125 (floor would give 124)', () => {
    expect(reqStrWith(-20).reqStr).toBe(125)
  })

  it('positive ease (The Humongous +20) raises the requirement: 156 + 31 = 187', () => {
    expect(reqStrWith(20).reqStr).toBe(187)
  })

  it('ethereal subtracts 10 after the percentage: 125 - 10 = 115', () => {
    expect(reqStrWith(-20, true).reqStr).toBe(115)
  })
})
