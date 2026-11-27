/**
 * Issue #1670: the client merc panel must scale Hireling.txt per-level stats exactly like
 * `D2Game.dll` `MERCS_SetStats` (`0x6FC68BA0`): HP / Def / AR gain the full per-level value
 * (`0x6FC68DEC`, `0x6FC68E20`, `0x6FC68E86`), resists `trunc(Resist/Lvl * d / 4)` (`0x6FC68EA0`:
 * `cdq; and edx,3; sar 2`), str/dex/dmg `trunc(perLvl * d / 8)`.
 */
import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { computeEffectiveMercenaryStats } from '../../src/client/ui-model/derived-stats.ts'
import {
  computeHirelingLevelStats113c,
  HIRELING_RECORDS,
  resolveHirelingStatsAtLevel,
} from '../../src/common/units/hireling-table.ts'

if (typeof globalThis.window === 'undefined') {
  ;(globalThis as unknown as { window: Record<string, unknown> }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

describe('issue #1670: client merc per-level stats match MERCS_SetStats', () => {
  it('computeHirelingLevelStats113c applies full HP/Def/AR, resist /4 and str/dex/dmg /8', () => {
    const row = HIRELING_RECORDS.find((r) => r.version === 100 && r.classId === 271 && r.difficulty === 1)!
    expect(row).toBeDefined()
    const d = 20
    const s = computeHirelingLevelStats113c(row, row.level + d)
    expect(s.hp).toBe(Math.max(40, row.hp + d * row.hpPerLvl))
    expect(s.defense).toBe(Math.max(0, row.defense + d * row.defPerLvl))
    expect(s.ar).toBe(Math.max(0, row.ar + d * row.arPerLvl))
    expect(s.resist).toBe(Math.max(0, row.resist + Math.trunc((d * row.resistPerLvl) / 4)))
    expect(s.str).toBe(Math.max(10, row.str + Math.trunc((d * row.strPerLvl) / 8)))
    expect(s.dex).toBe(Math.max(10, row.dex + Math.trunc((d * row.dexPerLvl) / 8)))
    // Shared with the server-side resolver.
    const srv = resolveHirelingStatsAtLevel(row.subTypeId, row.level + d, true)!
    expect(srv.defense).toBe(s.defense)
    expect(srv.ar).toBe(s.ar)
    expect(srv.resist).toBe(s.resist)
  })

  it('merc panel Defense / AR / Resist / Life use the full per-level gain (Act 1 Rogue, Normal)', () => {
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 1, name: 'Sorceress', x: 5100, y: 5100 })
    world.apply({ type: 'Merc', kind: 'assign', ownerId: 1, mercId: 901, classId: 271, nameId: 1 } as any)
    const lowRow = HIRELING_RECORDS.filter((r) => r.version === 100 && r.classId === 271 && r.difficulty === 1)
      .reduce((a, b) => (b.level > a.level && b.level <= 30 ? b : a))
    ;(world.merc as any).level = 30
    const s30 = computeEffectiveMercenaryStats(world)!
    ;(world.merc as any).level = 31
    const s31 = computeEffectiveMercenaryStats(world)!
    const t30 = computeHirelingLevelStats113c(lowRow, 30)
    const t31 = computeHirelingLevelStats113c(lowRow, 31)
    expect(s30.level).toBe(30)
    // Naked panel: defense = table Def + dex/4, AR = table AR + dex*5 (client display formula).
    expect(s30.defense).toBe(t30.defense + Math.floor(t30.dex / 4))
    expect(s30.attackRating).toBe(t30.ar + t30.dex * 5)
    expect(s31.defense - s30.defense).toBe(
      t31.defense - t30.defense + Math.floor(t31.dex / 4) - Math.floor(t30.dex / 4),
    )
    expect(s30.maxHp).toBe(t30.hp)
    expect(t31.defense - t30.defense).toBe(lowRow.defPerLvl)
  })
})
