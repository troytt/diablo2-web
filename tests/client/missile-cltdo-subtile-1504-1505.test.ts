import { describe, expect, it } from 'vitest'
import { MISSILE_CLT_COLS_113C, missileCltColsByName113c } from '../../src/common/skills/missile-clt-cols-113c.ts'
import { subtileTrailSpawn } from '../../src/client/world/missile-cltdo-subtile-113c.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

const row = (n: string) => missileCltColsByName113c(n)!

describe('MissCltDoFunc 3 / 18 per-sub-tile trails (#1504, #1505)', () => {
  it('class sweep: every pCltDoFunc 3 / 18 row has a CltSubMissile1 and is handled by function id', () => {
    const rows = MISSILE_CLT_COLS_113C.filter(r => r.pCltDoFunc === 3 || r.pCltDoFunc === 18).map(r => r.name).sort()
    expect(rows).toEqual(
      ['bonespear', 'plaguejavelin', 'poisonjav', 'trap poison ball left', 'trap poison ball right', 'viper_bonespear', 'viper_poisjav'].sort(),
    )
    for (const n of rows) {
      const s = subtileTrailSpawn(row(n), 100, true)
      expect(s?.sub.id).toBe(row(n).cltSubMissile[0])
    }
  })

  it('nothing without a new sub-tile (no per-tick spawning)', () => {
    expect(subtileTrailSpawn(row('poisonjav'), 0, false)).toBeNull()
    expect(subtileTrailSpawn(row('bonespear'), 0, false)).toBeNull()
  })

  it('CltDo3 inherits the missile level; CltDo18 uses level 0 + CltParam1 loops and waits InitSteps (viper_bonespear 3)', () => {
    expect(subtileTrailSpawn(row('poisonjav'), 0, true)).toMatchObject({ inheritLevel: true })
    expect(subtileTrailSpawn(row('bonespear'), 0, true)).toMatchObject({ inheritLevel: false, loops: 3 })
    expect(subtileTrailSpawn(row('viper_bonespear'), 2, true)).toBeNull()
    expect(subtileTrailSpawn(row('viper_bonespear'), 3, true)?.sub.name).toBe('bonespeartrail')
  })

  it('CltDo68 sucfireball has no CltSubMissile1 (0x6fb630f0 returns NULL for id < 0)', () => {
    expect(row('sucfireball').pCltDoFunc).toBe(68)
    expect(row('sucfireball').cltSubMissile[0]).toBe(-1)
  })

  it('ClientWorld: viper_bonespear drops bonespeartrail (Range lifetime) only on new sub-tiles after InitSteps', () => {
    const world = new ClientWorld() as any
    const m = world.spawnMissileByKey('viper_bonespear', 100.5, 100.5, 140.5, 100.5, { ownerType: 'monster', ownerId: 3 })
    for (let i = 0; i < 6; i++) world.stepMissileUnit(m)
    const trails = Array.from(world.units.values()).filter((u: any) => u.missileKey === 'bonespeartrail') as any[]
    expect(trails.length).toBeGreaterThan(0)
    expect(trails.length).toBeLessThanOrEqual(3)
    for (const t of trails) expect(t.maxTicks).toBe(row('bonespeartrail').range)
  })
})
