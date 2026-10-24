/**
 * Issues #1045..#1049 (VFX-B2 状态 ID 错位): client skill prediction must write the real 1.13c States.txt row.
 *
 * - #1045 Blaze: Skills.txt #46 aurastate=blaze -> state 13 (12 is inferno, nosend); the trail only runs on 13.
 * - #1046 Conviction / Redemption: aurastate conviction 28 / redemption 50 (51 is battlecommand).
 * - #1047 War Cry: stunned 21 for Param1 + (lvl-1)*Param2 frames (28 is conviction).
 * - #1048 Hurricane / Arctic Blast: cold 11 (29 is convicted -> Conviction overlays).
 * - #1049 Assassin charge-ups: only aurastate progressive_* 122..127, never the Druid rows 147..152.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import { buildSceneDrawables } from '../src/client/view/unit-drawables.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import type { ClientUnit } from '../src/client/world/client-unit.ts'
import {
  blazeStateDurationFrames113c,
  hurricaneColdFrames113c,
  warCryStunFrames113c,
} from '../src/client/world/state-ids-113c.ts'
import { SELF_BUFF_SKILL_STATES } from '../src/client/world/world-skill-state-tables.ts'
import { PALADIN_AURA_SKILL_IDS, PALADIN_AURA_STATE_BY_SKILL_ID } from '../src/common/skills/paladin-auras.ts'

const ROOT = join(__dirname, '..')

async function tables() {
  const registry = await getSharedDataRegistry()
  const stateIdByName = new Map<string, number>()
  for (const row of registry.statesTable.rows as ReadonlyArray<Record<string, string>>) {
    const name = row['state'] ?? ''
    if (name !== '' && (row['id'] ?? '') !== '') stateIdByName.set(name, Number(row['id']))
  }
  const skillById = new Map<number, Record<string, string>>()
  for (const row of registry.skillsTable.rows as ReadonlyArray<Record<string, string>>) {
    if ((row['Id'] ?? '') !== '') skillById.set(Number(row['Id']), row)
  }
  const auraState = (skillId: number): number => {
    const name = skillById.get(skillId)?.['aurastate'] ?? ''
    const id = stateIdByName.get(name)
    if (id === undefined) throw new Error(`Skills.txt #${skillId} aurastate '${name}' not in States.txt`)
    return id
  }
  const param = (skillId: number, col: string): number => Number(skillById.get(skillId)?.[col] || 0)
  return { stateIdByName, auraState, param }
}

function tick(world: ClientWorld, n = 1): void {
  for (let i = 0; i < n; i++) (world as any).stepDiscreteSimulationTick(40)
}

function frameCount(world: ClientWorld): number {
  return (world as any).frameCount as number
}

function missiles(world: ClientWorld, key: string): ClientUnit[] {
  return Array.from(world.units.values()).filter((u) => u.unitType === 'missile' && u.missileKey === key)
}

function overlayTokens(unit: ClientUnit): string[] {
  return buildSceneDrawables([unit]).overlayDrawables.map((d) => d.token.toLowerCase())
}

function spawnPlayer(charClass: number, x = 100, y = 100): { world: ClientWorld; caster: ClientUnit } {
  const world = new ClientWorld()
  world.apply({ type: 'PlayerAssign', unitId: 1, charClass, name: 'P', x, y })
  return { world, caster: world.getUnit('player', 1)! }
}

function spawnMonster(world: ClientWorld, id: number, x: number, y: number, classId = 0): ClientUnit {
  world.apply({ type: 'UnitAssign', unit: { unitType: 1, id, classId, x, y, lifePct: 128, mode: 1 } } as any)
  return world.getUnit('monster', id)!
}

describe('#1045 Blaze state 13 (not 12 inferno)', () => {
  it('maps Skills.txt #46 aurastate to States.txt blaze (13) and the dm12 duration', async () => {
    const t = await tables()
    expect(t.auraState(46)).toBe(13)
    expect(t.stateIdByName.get('inferno')).toBe(12)
    expect(SELF_BUFF_SKILL_STATES[46]).toBe(13)
    const p1 = t.param(46, 'Param1')
    const p2 = t.param(46, 'Param2')
    for (const lvl of [1, 10, 20]) {
      expect(blazeStateDurationFrames113c(lvl)).toBe(Math.trunc((110 * lvl * (p2 - p1)) / (100 * (lvl + 6))) + p1)
    }
    expect(blazeStateDurationFrames113c(1)).toBe(120)
  })

  it('has no states.add(12) in the Blaze cast path', () => {
    const src = readFileSync(join(ROOT, 'src/client/world/world-skill-missiles.ts'), 'utf8')
    expect(src).not.toMatch(/states\.add\(12\)/)
    const stepper = readFileSync(join(ROOT, 'src/client/world/world-missile-stepper.ts'), 'utf8')
    expect(stepper).not.toMatch(/states\.has\(12\)/)
  })

  it('a unit with state 12 only moving 5 subtiles spawns 0 blaze missiles', () => {
    const { world, caster } = spawnPlayer(1)
    caster.states.add(12)
    tick(world)
    for (let i = 0; i < 5; i++) {
      caster.x += 1
      tick(world)
    }
    expect(missiles(world, 'blaze')).toHaveLength(0)
  })

  it('a unit with state 13 moving 5 subtiles spawns blaze missiles', () => {
    const { world, caster } = spawnPlayer(1)
    caster.states.add(13)
    tick(world)
    for (let i = 0; i < 5; i++) {
      caster.x += 1
      tick(world)
    }
    expect(missiles(world, 'blaze').length).toBeGreaterThan(0)
  })

  it('casting Blaze sets 13 (never 12) and the predicted state ends after the dm12 duration', () => {
    const { world, caster } = spawnPlayer(1)
    ;(world as any).spawnMissilesForSkill(caster, 46, 100, 100, 1)
    expect(caster.states.has(13)).toBe(true)
    expect(caster.states.has(12)).toBe(false)
    tick(world, blazeStateDurationFrames113c(1) + 1)
    expect(caster.states.has(13)).toBe(false)
    const before = missiles(world, 'blaze').length
    for (let i = 0; i < 5; i++) {
      caster.x += 1
      tick(world)
    }
    expect(missiles(world, 'blaze').length).toBe(before)
  })
})

describe('#1046 Paladin aura states: Conviction 28 / Redemption 50', () => {
  it('every Paladin aura maps to the States.txt row of its Skills.txt aurastate', async () => {
    const t = await tables()
    for (const skillId of PALADIN_AURA_SKILL_IDS) {
      expect(PALADIN_AURA_STATE_BY_SKILL_ID[skillId], `skill ${skillId}`).toBe(t.auraState(skillId))
    }
    expect(PALADIN_AURA_STATE_BY_SKILL_ID[123]).toBe(28)
    expect(PALADIN_AURA_STATE_BY_SKILL_ID[124]).toBe(50)
    expect(Object.values(PALADIN_AURA_STATE_BY_SKILL_ID)).not.toContain(51)
  })

  it('Conviction sets 28 and draws only convictionfront/back; Redemption sets 50 and draws redemptionfront/back', () => {
    const { world, caster } = spawnPlayer(3)
    ;(world as any).syncSelfRightHandAuraState(123)
    expect(caster.states.has(28)).toBe(true)
    expect(caster.states.has(50)).toBe(false)
    expect(caster.states.has(51)).toBe(false)
    expect(world.self.states.has(28)).toBe(true)
    // Overlay.txt convictionfront / redemptionfront have Filename=null (no drawable); the back rows draw.
    const convTokens = overlayTokens(caster)
    expect(convTokens).toContain('convictionback')
    for (const tk of convTokens) expect(['convictionfront', 'convictionback']).toContain(tk)

    ;(world as any).syncSelfRightHandAuraState(124)
    expect(caster.states.has(50)).toBe(true)
    expect(caster.states.has(28)).toBe(false)
    expect(caster.states.has(51)).toBe(false)
    const tokens = overlayTokens(caster)
    expect(tokens).toContain('redemptionback')
    for (const tk of tokens) expect(['redemptionfront', 'redemptionback']).toContain(tk)
    expect(tokens).not.toContain('battlecommand')
  })

  it('switching aura keeps a server-set Battle Command (51)', () => {
    const { world, caster } = spawnPlayer(3)
    world.applyServerEvent({
      type: 'StateSet',
      unit: { unitType: 'player', id: 1 },
      state: 51,
      origin: 0xa8,
      complete: true,
    } as any)
    ;(world as any).syncSelfRightHandAuraState(123)
    ;(world as any).syncSelfRightHandAuraState(124)
    ;(world as any).syncSelfRightHandAuraState(98)
    expect(caster.states.has(51)).toBe(true)
  })
})

describe('#1047 War Cry stuns with state 21', () => {
  it('stun length is Skills.txt #154 Param1 + (lvl-1) * Param2', async () => {
    const t = await tables()
    expect(t.stateIdByName.get('stunned')).toBe(21)
    const p1 = t.param(154, 'Param1')
    const p2 = t.param(154, 'Param2')
    for (const lvl of [1, 5, 20]) expect(warCryStunFrames113c(lvl)).toBe(p1 + (lvl - 1) * p2)
  })

  it('affected monsters get state 21 (never 28) and no Conviction overlay', () => {
    const { world, caster } = spawnPlayer(4)
    const mon = spawnMonster(world, 500, 103, 100)
    ;(world as any).spawnMissilesForSkill(caster, 154, 103, 100, 1)
    expect(mon.states.has(21)).toBe(true)
    expect(mon.states.has(28)).toBe(false)
    const tokens = overlayTokens(mon)
    expect(tokens).toContain('stun')
    expect(tokens).not.toContain('convictionfront')
    expect(tokens).not.toContain('convictionback')
    tick(world, warCryStunFrames113c(1) + 1)
    expect(mon.states.has(21)).toBe(false)
  })
})

describe('#1048 Hurricane chills with state 11', () => {
  it('Hurricane cold length is Skills.txt #250 ELen', async () => {
    const t = await tables()
    expect(t.stateIdByName.get('cold')).toBe(11)
    expect(hurricaneColdFrames113c(1)).toBe(t.param(250, 'ELen'))
  })

  it('monsters inside the Hurricane get state 11 and never 29', () => {
    const { world, caster } = spawnPlayer(5)
    ;(world as any).areaId = 2
    const mon = spawnMonster(world, 501, 103, 100)
    caster.states.add(144)
    caster.hurricaneSkillLevel = 1
    caster.hurricaneUntilTick = frameCount(world) + 200
    tick(world, 25)
    expect(mon.states.has(11)).toBe(true)
    expect(mon.states.has(29)).toBe(false)
    expect(overlayTokens(mon)).not.toContain('convictionfront')
  })

  it('no client code writes States.txt convicted (29) as a chill', () => {
    for (const f of ['src/client/world/world-missile-stepper.ts', 'src/client/world/world-skill-missiles.ts']) {
      expect(readFileSync(join(ROOT, f), 'utf8')).not.toMatch(/states\.add\(29\)/)
    }
  })
})

describe('#1049 Assassin charge-ups only set progressive_* 122..127', () => {
  const DRUID_STATES = [147, 148, 149, 150, 151, 152]

  it('charge-up skills map to their Skills.txt aurastate', async () => {
    const t = await tables()
    expect([254, 265, 280, 259, 274, 269].map((id) => t.auraState(id))).toEqual([122, 123, 124, 125, 126, 127])
  })

  it('one Tiger Strike charge sets 122 and none of 147..152; no spirit_of_barbs drawable', () => {
    const { world, caster } = spawnPlayer(6)
    ;(world as any).applySkillCastToUnit(caster, 254, 101, 100, 1, true, 0)
    expect(caster.states.has(122)).toBe(true)
    for (const s of DRUID_STATES) expect(caster.states.has(s), `state ${s}`).toBe(false)
    for (const s of DRUID_STATES) expect(world.self.states.has(s), `self state ${s}`).toBe(false)
    const tokens = overlayTokens(caster)
    expect(tokens).not.toContain('spirit_of_barbs')
    expect(tokens).not.toContain('heart_of_wolverine')
    expect(tokens).not.toContain('oak_sage')
  })

  it('Blades of Ice (274) adds only 126, not 151 cyclonearmor', () => {
    const { world, caster } = spawnPlayer(6)
    const before = new Set(caster.states.list())
    ;(world as any).applySkillCastToUnit(caster, 274, 101, 100, 1, true, 0)
    const added = caster.states.list().filter((s) => !before.has(s) && s !== 121)
    expect(added).toEqual([126])
    expect(overlayTokens(caster).some((t) => t.startsWith('cyclonearmor'))).toBe(false)
  })
})
