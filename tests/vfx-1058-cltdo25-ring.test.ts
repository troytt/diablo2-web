/**
 * Issues #1058 / #1059 / #1061: SkillCltDoFunc 25 (D2Client 0x6FB23CB0 -> 0x6FB51020(-1) -> 0x6FB50DB0) is one
 * data-driven 64-way ring for every Skills.txt row with cltdofunc = 25:
 *   - 64 creates of Skills.txt `cltmissilea`, target offsets = the 64-entry radius-30 tables 0x6FB84390 / 0x6FB84290;
 *   - velocity = Missiles.txt Vel + VelLev*lvl/8 + Skills.txt cltcalc1 (param flag 4, no MaxVel clamp);
 *   - lifetime = Missiles.txt Range + LevRange*lvl;
 *   - diabfire (id 176) toggles param flag 0x4000 (no light) before every create (0x6FB50E47).
 */
import { homedir } from 'node:os'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { spawnMissilesForSkillImpl } from '../src/client/world/world-skill-missiles.ts'
import { getSharedDataRegistry } from '../src/common/data/data-registry.ts'
import {
  CLTDO25_RING_X_113C,
  CLTDO25_RING_Y_113C,
  CLTDO25_SKILLS_113C,
  cltDo25RingEntries113c,
  evalCltDo25Calc113c,
} from '../src/common/skills/cltdo25-ring-113c.ts'
import { CANONICAL_113C_MISSILES } from '../src/common/skills/missiles-data.ts'

/** D2Client.dll image-base relative reads of the two 64-entry int32 tables. */
function readD2ClientTable(va: number): number[] | null {
  let buf: Buffer
  try {
    buf = readFileSync(join(homedir(), 'd2-data', 'D2Client.dll'))
  } catch {
    return null
  }
  const pe = buf.readUInt32LE(0x3c)
  const nSections = buf.readUInt16LE(pe + 6)
  const optSize = buf.readUInt16LE(pe + 20)
  const rva = va - 0x6fab0000
  for (let i = 0; i < nSections; i++) {
    const s = pe + 24 + optSize + i * 40
    const vaddr = buf.readUInt32LE(s + 12)
    const vsize = Math.max(buf.readUInt32LE(s + 8), buf.readUInt32LE(s + 16))
    if (rva >= vaddr && rva < vaddr + vsize) {
      const off = rva - vaddr + buf.readUInt32LE(s + 20)
      return Array.from({ length: 64 }, (_, k) => buf.readInt32LE(off + k * 4))
    }
  }
  return null
}

function speedFromVel(vel: number): number {
  const dw = vel > 0 ? Math.floor(((vel << 8) * 75) / 100) : 0
  return (16 * dw) / 65536
}

function castRing(skillId: number, lvl: number, casterType: 'player' | 'monster' = 'player') {
  const world = new ClientWorld()
  const caster = new ClientUnit({ unitType: casterType, id: 77, classId: casterType === 'monster' ? 243 : 0, x: 100, y: 200, mode: 1 })
  spawnMissilesForSkillImpl.call(world as never, caster, skillId, 110, 200, lvl)
  const missiles = world.getUnitsByType('missile').filter(m => m.sourceSkillId === skillId)
  return { world, caster, missiles }
}

function expectRing(skillId: number, lvl: number, key: string, vel: number, range: number) {
  const { missiles } = castRing(skillId, lvl)
  expect(missiles).toHaveLength(64)
  expect(new Set(missiles.map(m => m.missileKey))).toEqual(new Set([key]))
  missiles.forEach((m, i) => {
    // aim offsets are the 64-entry table, in table order
    expect([m.targetX! - 100, m.targetY! - 200]).toEqual([CLTDO25_RING_X_113C[i], CLTDO25_RING_Y_113C[i]])
    expect(m.maxTicks).toBe(range)
    expect(Math.hypot(m.vx ?? 0, m.vy ?? 0)).toBeCloseTo(speedFromVel(vel), 9)
  })
  return missiles
}

const DLL_X = readD2ClientTable(0x6fb84390)
const DLL_Y = readD2ClientTable(0x6fb84290)

describe('CltDoFunc 25 ring tables / Skills.txt rows', () => {
  it.skipIf(DLL_X === null || DLL_Y === null)('64-entry tables equal D2Client 0x6FB84390 / 0x6FB84290', () => {
    expect([...CLTDO25_RING_X_113C]).toEqual(DLL_X)
    expect([...CLTDO25_RING_Y_113C]).toEqual(DLL_Y)
  })

  it('every table row names a real Missiles.txt row', () => {
    for (const row of Object.values(CLTDO25_SKILLS_113C)) {
      const m = CANONICAL_113C_MISSILES[row.cltMissileA]
      expect(m, row.skill).toBeDefined()
      expect(m!.name).toBe(row.cltMissileA)
    }
  })

  let skills: readonly Readonly<Record<string, string>>[] | null = null
  try {
    skills = getSharedDataRegistry().skillsTable.rows
  } catch {
    skills = null
  }
  it.skipIf(skills === null)('CLTDO25_SKILLS_113C == every MPQ Skills.txt row with cltdofunc 25', () => {
    const fromTxt = skills!.filter(r => (r['cltdofunc'] ?? '').trim() === '25')
    expect(fromTxt.map(r => Number(r['Id'])).sort((a, b) => a - b)).toEqual(
      Object.keys(CLTDO25_SKILLS_113C).map(Number).sort((a, b) => a - b),
    )
    for (const r of fromTxt) {
      const row = CLTDO25_SKILLS_113C[Number(r['Id'])]!
      expect(row.cltMissileA).toBe(r['cltmissilea'])
      expect(row.cltCalc1).toBe((r['cltcalc1'] ?? '').trim())
      for (let p = 1; p <= 8; p++) {
        const cell = (r[`Param${String(p)}`] ?? '').trim()
        expect(row.params[p - 1], `${row.skill} Param${String(p)}`).toBe(cell === '' ? 0 : Number(cell))
      }
    }
  })

  it('cltcalc1 evaluator: Howl par1 * (lvl-1), unsupported tokens throw', () => {
    expect(evalCltDo25Calc113c('par1 * (lvl-1)', [2, 1], 5)).toBe(8)
    expect(evalCltDo25Calc113c('', [2], 5)).toBe(0)
    expect(() => evalCltDo25Calc113c('skill(\'Howl\'.blvl)', [], 1)).toThrow()
  })
})

describe('Issue #1058: Frost Nova / Nova / Poison Nova fire 64 missiles', () => {
  it('#44 frostnova: 64, table aim, maxTicks = Range 14, speed = Vel 24', () => expectRing(44, 7, 'frostnova', 24, 14))
  it('#48 nova: 64, table aim, maxTicks = Range 13, speed = Vel 24', () => expectRing(48, 7, 'nova', 24, 13))
  it('#92 poisonnova: 64, every dir64 slot once, maxTicks = Range 30, speed = Vel 12', () => {
    const ring = expectRing(92, 3, 'poisonnova', 12, 30)
    // entry i points at world-plane slot i of the 64-direction circle (each slot exactly once)
    const slots = ring.map(m => {
      const a = Math.atan2(m.targetY! - 200, m.targetX! - 100)
      return ((Math.round((a / (2 * Math.PI)) * 64) % 64) + 64) % 64
    })
    expect(slots).toEqual(Array.from({ length: 64 }, (_, i) => i))
  })
})

describe('Issue #1059: warcry rings are CltDoFunc 25 (64, Missiles.txt Range, Howl speed from cltcalc1)', () => {
  const cases: [number, string, number, number][] = [
    [130, 'howl', 12, 12],
    [138, 'shout', 30, 15],
    [146, 'battlecry', 12, 12],
    [149, 'battleorders', 30, 15],
    [154, 'warcry', 12, 16],
    [155, 'battlecommand', 30, 15],
  ]
  for (const [skillId, key, vel, range] of cases) {
    it(`#${String(skillId)} ${key}: 64 missiles, maxTicks ${String(range)}, Vel ${String(vel)} at lvl 1`, () => {
      expectRing(skillId, 1, key, vel, range)
    })
  }

  it('Howl lvl 5: speed = 12 + par1 * 4 = 20 (unclamped by MaxVel 12), lifetime still Range 12', () => {
    expectRing(130, 5, 'howl', 12 + 2 * 4, 12)
  })

  it('warcry side effects are kept: Shout still sets state 26 on the caster', () => {
    const { caster } = castRing(138, 3)
    expect(caster.states.has(26)).toBe(true)
  })
})

describe('Issue #1061: monster CltDoFunc 25 rings', () => {
  it('#346 MephFrostNova fires 64 frostnova (cltmissilea), #190 PrimeIceNova too', () => {
    for (const id of [346, 190]) {
      const { missiles } = castRing(id, 1, 'monster')
      expect(missiles).toHaveLength(64)
      expect(missiles.every(m => m.missileKey === 'frostnova')).toBe(true)
    }
  })

  it("#316 Baal Nova fires 64 'baal nova' (maxTicks 40, Vel 20) and the row has its own CelFile atlas meta", () => {
    expectRing(316, 1, 'baal nova', 20, 40)
    expect(MISSILE_METAS['baal nova']?.celFile.toLowerCase()).toBe('expansion/baalsummonmissile')
  })

  it('#353 Trap Nova fires 64 trapnova (Range 13, Vel 24)', () => expectRing(353, 1, 'trapnova', 24, 13))

  it('#195 DiabFire fires 64 diabfire; param flag 0x4000 (no light) alternates, starting set on entry 0', () => {
    const missiles = expectRing(195, 1, 'diabfire', 30, 50)
    missiles.forEach((m, i) => expect(m.missileNoLight === true, `entry ${String(i)}`).toBe(i % 2 === 0))
    expect(cltDo25RingEntries113c(176).filter(e => e.noLight)).toHaveLength(32)
    // no other missile id toggles the bit
    expect(cltDo25RingEntries113c(90).some(e => e.noLight)).toBe(false)
  })
})

describe('client source no longer carries a hand-made ring', () => {
  it('world-skill-missiles.ts has no 32-ray warcry loop / RADIAL_RING_SKILLS', () => {
    const src = readFileSync(join(__dirname, '../src/client/world/world-skill-missiles.ts'), 'utf8')
    expect(src).not.toMatch(/RADIAL_RING_SKILLS|computeIsoRadialRingVectors\(32|const rayCount = 32/)
  })
})
