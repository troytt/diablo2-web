/**
 * Issue #1637: attack rating is `D2Common.dll` #10621 @ `0x6FD81EA0`; `0x6FD82B10` lies inside
 * `UNITS_GetDefense` (#10672 @ `0x6FD82890`) and must not be cited as an attack-rate function.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')

describe('issue #1637: attack-rating address citations', () => {
  it('no source cites 0x6FD82B10 as UNITS_GetAttackRate; stat-list cites #10621 @ 0x6FD81EA0', () => {
    for (const rel of ['src/server/engine/stat-list.ts', 'src/client/ui-model/combat-stats.ts']) {
      const src = readFileSync(resolve(ROOT, rel), 'utf8')
      expect(src, rel).not.toMatch(/GetAttackRate[^\n]*0x6FD82B10/i)
    }
    const statList = readFileSync(resolve(ROOT, 'src/server/engine/stat-list.ts'), 'utf8')
    expect(statList).toContain('#10621 @ `0x6FD81EA0`')
  })
})
