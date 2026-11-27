/**
 * #1595 / #1612 — client Do tail (D2Client.dll 0x6FB52C90): after the SkillCltDoFunc, `tgtsound` (+0x10A) is played
 * on the target unit (0x6FB52E7A) and `tgtoverlay` (+0x108) is attached to it (0x6FB52EA4). The cast start
 * (0x6FB51CF0) reads neither column.
 */

import { describe, expect, it } from 'vitest'
import { getSkillClientRow113c, SKILL_CLIENT_ROWS_113C } from '../../src/common/skills/skill-client-113c.ts'
import { getSkillTgtOverlay113c } from '../../src/client/world/world-skill-state-tables.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

function setup() {
  const world = new ClientWorld()
  world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Nec', x: 100, y: 100 } as any)
  const caster = (world as any).getUnit('player', 1)
  const mon = (world as any).ensureUnit('monster', 42)
  mon.x = 103
  mon.y = 100
  world.drainWorldSoundRequests()
  return { world, caster, mon }
}

describe('client Do tail: tgtsound / tgtoverlay (#1595, #1612)', () => {
  it('getSkillTgtOverlay113c mirrors Skills.txt tgtoverlay exactly (no invented rows)', () => {
    const fromTxt = SKILL_CLIENT_ROWS_113C.filter(r => r.tgtOverlay !== '').map(r => r.id)
    expect(fromTxt).toEqual([179, 253, 254, 273, 275])
    for (const id of [14, 24, 34]) expect(getSkillTgtOverlay113c(id)).toBeUndefined()
  })

  it('Skills.txt tgtsound rows', () => {
    expect(SKILL_CLIENT_ROWS_113C.filter(r => r.tgtSound > 0).map(r => r.id)).toEqual([74, 83, 95, 131, 150, 253, 351])
  })

  it('Corpse Explosion plays tgtsound on the explicit target unit at the Do (spawnMissilesForSkill), not the caster', () => {
    const { world, caster, mon } = setup()
    mon.dead = true
    caster.targetUnit = { unitType: 'monster', id: 42 }
    ;(world as any).spawnMissilesForSkill(caster, 74, mon.x, mon.y, 1)
    const row = getSkillClientRow113c(74)!
    const snd = world.drainWorldSoundRequests().filter(r => r.soundId === row.tgtSound)
    expect(snd).toHaveLength(1)
    expect(snd[0]!.unit).toMatchObject({ unitType: 'monster', id: 42 })
  })

  it('no target unit -> no tgtsound', () => {
    const { world, caster } = setup()
    ;(world as any).spawnMissilesForSkill(caster, 74, 140, 140, 1)
    const row = getSkillClientRow113c(74)!
    expect(world.drainWorldSoundRequests().some(r => r.soundId === row.tgtSound)).toBe(false)
  })

  it('Psychic Hammer: tgtoverlay is not attached at cast start, but at the Do', () => {
    const { world, caster, mon } = setup()
    caster.targetUnit = { unitType: 'monster', id: 42 }
    // cast start only (spawnVisuals) — the Do runs later at the action frame
    ;(world as any).applySkillCastToUnit(caster, 253, mon.x, mon.y, 1, true, 1000)
    const castState = caster.castState
    if (castState && castState.missileFireDelayMs !== undefined && castState.missileSpawned === false) {
      expect(mon.overlays.some((o: any) => o.token === 'psychic_hammer_hit')).toBe(false)
    }
    ;(world as any).spawnMissilesForSkill(caster, 253, mon.x, mon.y, 1)
    expect(mon.overlays.some((o: any) => o.token === 'psychic_hammer_hit')).toBe(true)
    const row = getSkillClientRow113c(253)!
    expect(world.drainWorldSoundRequests().some(r => r.soundId === row.tgtSound && r.unit?.id === 42)).toBe(true)
  })

  it('the second-hand Do (Double Throw) does not repeat the tail', () => {
    const { world, caster, mon } = setup()
    caster.targetUnit = { unitType: 'monster', id: 42 }
    ;(world as any).spawnMissilesForSkill(caster, 253, mon.x, mon.y, 1, true)
    expect(mon.overlays.some((o: any) => o.token === 'psychic_hammer_hit')).toBe(false)
  })
})
