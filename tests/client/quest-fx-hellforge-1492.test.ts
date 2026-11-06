import { describe, expect, it, vi } from 'vitest'
import { SEED_RollLimitedRandomNumber } from '../../src/common/rng/d2-rng.ts'
import { CANONICAL_113C_MISSILES } from '../../src/common/skills/missiles-data.ts'
import { missileCltColsByName113c } from '../../src/common/skills/missile-clt-cols-113c.ts'
import {
  HF_CONTROL_MISSILE,
  HF_FRAGMENT1_MISSILE,
  HF_FRAGMENT2_MISSILE,
  HF_FRAGMENT3_MISSILE,
  HF_FRAGMENT_DX,
  HF_FRAGMENT_DY,
  HF_SPIRIT1_MISSILE,
  hfFragment3Tick,
  hfFragmentDelay,
  hfFragmentRange,
  hfSpiritTick,
} from '../../src/client/world/quest-fx-hellforge-113c.ts'
import { QuestFxLight } from '../../src/client/world/quest-fx-light.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

describe('Hell Forge show (special quest event 14, 0x6fb03220, #1492)', () => {
  it('uses Missiles.txt 373..377 with CltDoFunc 38..41 and CltHitFunc 42 / 43', () => {
    const rows = ['hfcontrol', 'hffragment1', 'hffragment2', 'hffragment3', 'hfspirit1'].map(n => missileCltColsByName113c(n)!)
    expect(rows.map(r => r.id)).toEqual([HF_CONTROL_MISSILE, HF_FRAGMENT1_MISSILE, HF_FRAGMENT2_MISSILE, HF_FRAGMENT3_MISSILE, HF_SPIRIT1_MISSILE])
    expect(rows.map(r => r.pCltDoFunc)).toEqual([38, 39, 39, 40, 41])
    expect(rows.map(r => r.pCltHitFunc)).toEqual([0, 42, 43, 0, 0])
  })

  it('0x6fb64fb0 fragment tables and range override Range(374) * d / 6', () => {
    expect(HF_FRAGMENT_DX).toHaveLength(14)
    expect(HF_FRAGMENT_DY).toHaveLength(14)
    const r = CANONICAL_113C_MISSILES.hffragment1!.range
    expect(r).toBe(16)
    // i = 0: dx -4 < dy 6 -> (6 + 2*4) >> 1 = 7 -> 16 * 7 / 6 = 18
    expect(hfFragmentRange(0, r)).toBe(18)
    // i = 12: dx 0 < dy 5 -> (5 + 0) >> 1 = 2 -> 5
    expect(hfFragmentRange(12, r)).toBe(5)
  })

  it('RAND(35) + 10 delays and the hffragment3 countdown', () => {
    const s = { lo: 1234, hi: 666 }
    const ref = { ...s }
    expect(hfFragmentDelay(s)).toBe(SEED_RollLimitedRandomNumber(ref, 35) + 10)
    expect(hfFragment3Tick(3, { lo: 1, hi: 666 })).toEqual({ spawn: false, nextTargetY: 2 })
    const t = hfFragment3Tick(0, { lo: 1, hi: 666 })
    expect(t.spawn).toBe(true)
    expect(t.nextTargetY).toBeGreaterThanOrEqual(9)
    expect(t.nextTargetY).toBeLessThanOrEqual(43)
  })

  it('CltDo41 hfspirit1 timeline', () => {
    expect(hfSpiritTick(8)).toEqual({ accelerate: true, animSpeedFactor: 0.5 })
    expect(hfSpiritTick(35)).toEqual({ accelerate: false, animSpeedFactor: 2 })
    expect(hfSpiritTick(9)).toEqual({ accelerate: false, animSpeedFactor: null })
  })

  it('QuestFxLight routes event 14 to the forge show', () => {
    const fx = new QuestFxLight()
    const spawn = vi.fn()
    fx.onSpecialQuestEvent(14, { findStoneAlpha: () => null, spawnHellforgeShowIfForgeNear: spawn })
    expect(spawn).toHaveBeenCalledTimes(1)
  })

  it('ClientWorld: hfcontrol bursts 14 hffragment1 on frame 10 and fragments chain to hffragment2 / hffragment3', () => {
    const world = new ClientWorld() as any
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'P', x: 100, y: 100 })
    const forge = { unitType: 'object', id: 77, classId: 0x178, x: 120, y: 120, key: 'object:77', overlays: [] }
    const realGetUnit = world.getUnit.bind(world)
    world.getUnit = (t: string, id: number) => (t === 'object' && id === 77 ? forge : realGetUnit(t, id))
    const ctl = world.spawnHellforgeShowAtForge(forge)
    expect(ctl.missileKey).toBe('hfcontrol')
    expect(ctl.cltCountdown).toBe(77)
    for (let i = 0; i <= 10; i++) world.stepMissileUnit(ctl)
    const frags = Array.from(world.units.values()).filter((u: any) => u.missileKey === 'hffragment1') as any[]
    expect(frags).toHaveLength(14)
    for (const f of frags) expect(f.cltCountdown).toBe(77)
    const f = frags[0]
    while (world.units.has(f.key)) world.stepMissileUnit(f)
    const f2 = Array.from(world.units.values()).find((u: any) => u.missileKey === 'hffragment2') as any
    expect(f2).toBeDefined()
    while (world.units.has(f2.key)) world.stepMissileUnit(f2)
    const f3 = Array.from(world.units.values()).find((u: any) => u.missileKey === 'hffragment3') as any
    expect(f3).toBeDefined()
    expect(f3.maxTicks).toBe(CANONICAL_113C_MISSILES.hfcontrol!.range)
  })
})
