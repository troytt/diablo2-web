/**
 * #1590 — S2C 0xA3 (D2Client.dll 0x6FB5EFB0) generic dispatch: Skills.txt `progressive` → 0x6FB52950, otherwise
 * `cltprgfunc1` (0x6FB51B10); a successful SkillCltDoFunc slot is followed by dosound (caster), tgtsound (target) and
 * tgtoverlay (target). Skills without a `cltprgfunc` do nothing (NULL slot 0).
 */

import { describe, expect, it } from 'vitest'
import { getSkillClientRow113c, SKILL_CLIENT_ROWS_113C } from '../../src/common/skills/skill-client-113c.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { CLT_PRG_FUNCS_113C, overlayNameAtOffset113c } from '../../src/client/world/skill-prg-dispatch-113c.ts'

function setup(): { world: ClientWorld; casterId: number } {
  const world = new ClientWorld()
  world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 6, name: 'Asn', x: 100, y: 100 } as any)
  const mon = (world as any).ensureUnit('monster', 42)
  mon.x = 104
  mon.y = 100
  world.drainWorldSoundRequests()
  return { world, casterId: 1 }
}

function ev(skill: number, extra: Partial<{ flag: number; target: number; x: number; y: number; level: number }> = {}) {
  return {
    type: 'UnitSkillEvent',
    flag: extra.flag ?? 0,
    skill,
    level: extra.level ?? 5,
    caster: { rawUnitType: 0, id: 1 },
    target: extra.target === undefined ? { rawUnitType: 1, id: 42 } : { rawUnitType: 1, id: extra.target },
    x: extra.x ?? 0,
    y: extra.y ?? 0,
  } as any
}

function missiles(world: ClientWorld, key: string): any[] {
  return [...(world as any)._units.values()].filter((u: any) => u.unitType === 'missile' && u.missileKey === key)
}

describe('S2C 0xA3 cltprgfunc dispatch (#1590)', () => {
  it('every cltprgfunc slot used by 1.13c Skills.txt has a TS implementation', () => {
    const used = new Set<number>()
    for (const r of SKILL_CLIENT_ROWS_113C) for (const s of r.cltPrgFunc) if (s > 0) used.add(s)
    expect([...used].sort((a, b) => a - b)).toEqual([9, 10, 11, 12, 13, 14, 15, 83, 84, 91, 92, 93])
    for (const s of used) expect(CLT_PRG_FUNCS_113C[s]).toBeTypeOf('function')
  })

  it('Thunder Storm (57, cltprgfunc1 = 84): thunderstorm1 above the target and prgoverlay lightning', () => {
    const { world } = setup()
    world.apply(ev(57))
    const m = missiles(world, 'thunderstorm1')
    expect(m).toHaveLength(1)
    expect(m[0].x).toBe(104)
    const mon = (world as any).getUnit('monster', 42)
    expect(mon.overlays.some((o: any) => o.token === 'lightning')).toBe(true)
  })

  it('skills without cltprgfunc (e.g. 38 Charged Bolt) do nothing', () => {
    const { world } = setup()
    const before = (world as any)._units.size
    world.apply(ev(38))
    expect((world as any)._units.size).toBe(before)
    expect(world.drainWorldSoundRequests()).toEqual([])
  })

  it('an unknown caster drops the event; an unknown target still runs caster-side slots', () => {
    const { world } = setup()
    world.apply({ ...ev(244, { target: 999, x: 120, y: 130 }), caster: { rawUnitType: 0, id: 77 } })
    expect(missiles(world, 'volcano')).toHaveLength(0)
    world.apply(ev(244, { target: 999, x: 120, y: 130 }))
    const v = missiles(world, 'volcano')
    expect(v).toHaveLength(1)
    expect([v[0].x, v[0].y]).toEqual([120, 130])
    expect(missiles(world, 'volcano overlay fire')).toHaveLength(1)
  })

  it('Armageddon (249, cltprgfunc1 = 92): tail + rock fall from (frames*slide)/32 left of the target', () => {
    const { world } = setup()
    world.apply(ev(249))
    const rock = missiles(world, 'armageddonrock')
    const tail = missiles(world, 'armageddontail')
    expect(rock).toHaveLength(1)
    expect(tail).toHaveLength(1)
    expect(rock[0].x).toBeCloseTo(104 - (25 * 15) / 32)
    expect(rock[0].vx).toBeCloseTo(15 / 32)
    expect(rock[0].altitude).toBe(625)
  })

  it('CorpseCycler (307, cltprgfunc1 = 93) needs the corpse target and spawns recycler delay on it', () => {
    const { world } = setup()
    world.apply(ev(307, { target: 999 }))
    expect(missiles(world, 'recycler delay')).toHaveLength(0)
    world.apply(ev(307))
    expect(missiles(world, 'recycler delay')).toHaveLength(1)
  })

  it('Tiger Strike (progressive, cltprgfunc 12): charge sets aurastate + count, prgoverlay+charge-1 on target, prgsound+charge-1 on caster', () => {
    const { world } = setup()
    const row = getSkillClientRow113c(254)!
    world.apply(ev(254, { flag: 2 }))
    const caster = (world as any).getUnit('player', 1)
    expect(caster.states.has(row.auraState)).toBe(true)
    expect(caster.chargeCounts.get(254)).toBe(2)
    const mon = (world as any).getUnit('monster', 42)
    expect(mon.overlays.some((o: any) => o.token === overlayNameAtOffset113c(row.prgOverlay, 1))).toBe(true)
    const snd = world.drainWorldSoundRequests()
    expect(snd.some(r => r.soundId === row.prgSound + 1 && r.unit?.id === 1)).toBe(true)
    // tail: tgtoverlay assassinfootimpact on the target
    expect(mon.overlays.some((o: any) => o.token === row.tgtOverlay)).toBe(true)
  })

  it('Fists of Fire (prgstack) charge 3 runs tiers 1..3; Royal Strike (no prgstack) runs only its tier', () => {
    const { world } = setup()
    world.apply(ev(259, { flag: 3 }))
    expect(missiles(world, 'fistsoffireexplode')).toHaveLength(1)
    expect(missiles(world, 'fistsoffirefirewall').length).toBeGreaterThan(0)
    world.apply(ev(280, { flag: 2 }))
    expect(missiles(world, 'royalstrikemeteorcenter')).toHaveLength(0)
    expect(missiles(world, 'royalstrikechainlightning')).toHaveLength(7)
  })
})
