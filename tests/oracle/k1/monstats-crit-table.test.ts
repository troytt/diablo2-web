/**
 * `MON_CRIT_113C` (the `MonStats.txt` `Crit` column rolled by `D2Game:0x6FC970E0`) checked row by row
 * against `D2MonStatsTxt.bCrit` (`+0xA6`) in the data-table image dumped from the original 1.13c DLLs
 * (tests/fixtures/oracle/k1/d2game-datatbls-113c.img.gz).
 */
import { describe, expect, it } from 'vitest'
import { getMonsterCritPure113c } from '../../../src/d2kern-113c/game/tables-bootstrap-113c.ts'
import { D2GAME_IAT_SGPT_DATATABLES_VA_113C } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { createK2DatatblsMemory113c } from '../../../tools/oracle/vectors/monspawn-vector.ts'

const MONSTATS_RECORD_SIZE = 0x1a8
const MONSTATS_CRIT_OFFSET = 0xa6
const MONSTATS_ROWS = 734

describe('[K1] MonStats.txt Crit table parity with the 1.13c data-table image', () => {
  const m = createK2DatatblsMemory113c()
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  const pMonStats = m.u32((pTables + 0xa78) >>> 0)
  const nMonStats = m.u32((pTables + 0xa80) >>> 0)

  it('matches bCrit on every loaded MonStats row', () => {
    expect(nMonStats).toBe(MONSTATS_ROWS)
    const mismatches: string[] = []
    let nonZero = 0
    for (let i = 0; i < nMonStats; i++) {
      const expected = m.u8((pMonStats + i * MONSTATS_RECORD_SIZE + MONSTATS_CRIT_OFFSET) >>> 0)
      const actual = getMonsterCritPure113c(i)
      if (expected !== 0) nonZero++
      if (actual !== expected) mismatches.push(`row ${i}: table ${actual}, image ${expected}`)
    }
    expect(mismatches).toEqual([])
    // Guards against an image whose bCrit column is unpopulated, which would make the loop vacuous.
    expect(nonZero).toBeGreaterThan(0)
  })

  it('reports a class id outside the loaded rows instead of reading it as zero', () => {
    expect(() => getMonsterCritPure113c(MONSTATS_ROWS)).toThrow(RangeError)
    expect(() => getMonsterCritPure113c(-1)).toThrow(RangeError)
  })
})
