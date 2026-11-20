/**
 * #808 — the generated 1.13c input tables must be exactly what the packer derives from the MPQs.
 * Re-derives Skills.txt / MonStats.txt / MonStats2.txt from the mounted archives (no skip).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getSharedMountedArchives } from '../../src/baker/mpq-archive-source.ts'
import {
  SKILL_FLAG_BITS_113C,
  SKILLS_MEMBER_113C,
  readInputTables113c,
  renderInputTables113cModule,
} from '../../src/baker/packers/pack-input-tables-113c.ts'
import * as generated from '../../src/client/input/generated/input-tables-113c.ts'
import { parseTable } from '../../src/common/world/acts.ts'

describe('input-tables-113c parity with the 1.13c MPQs', () => {
  it('generated module is byte-identical to the packer output', async () => {
    const archives = await getSharedMountedArchives()
    const tables = await readInputTables113c(archives)
    expect(generated.SKILL_INPUT_FLAGS_113C).toEqual(tables.skillFlags)
    expect(generated.SKILL_RANGE_113C).toEqual(tables.skillRange)
    expect(generated.SKILL_CLT_PRG_FUNC1_113C).toEqual(tables.skillCltPrgFunc1)
    expect(generated.NO_GFX_HIT_BOXES_113C).toEqual(tables.noGfxHitBoxes)
    const onDisk = readFileSync(
      new URL('../../src/client/input/generated/input-tables-113c.ts', import.meta.url),
      'utf8',
    )
    expect(onDisk).toBe(renderInputTables113cModule(tables))
  }, 60_000)

  it('flag bit constants match the packer layout', () => {
    expect(generated.SKILL_FLAG_INTERRUPT_113C).toBe(SKILL_FLAG_BITS_113C.interrupt)
    expect(generated.SKILL_FLAG_TARGET_ITEM_113C).toBe(SKILL_FLAG_BITS_113C.targetItem)
    expect(generated.SKILL_FLAG_TARGET_CORPSE_113C).toBe(SKILL_FLAG_BITS_113C.targetCorpse)
    expect(generated.SKILL_FLAG_TARGET_PET_113C).toBe(SKILL_FLAG_BITS_113C.targetPet)
    expect(generated.SKILL_FLAG_TARGET_ALLY_113C).toBe(SKILL_FLAG_BITS_113C.targetAlly)
    expect(generated.SKILL_FLAG_WARP_113C).toBe(SKILL_FLAG_BITS_113C.warp)
    expect(generated.SKILL_FLAG_PROGRESSIVE_113C).toBe(SKILL_FLAG_BITS_113C.progressive)
  })

  it('warp is set only on 54 Teleport and 275 Dragon Flight', () => {
    const warp: number[] = []
    generated.SKILL_INPUT_FLAGS_113C.forEach((flags, id) => {
      if (flags & generated.SKILL_FLAG_WARP_113C) warp.push(id)
    })
    expect(warp).toEqual([54, 275])
  })

  it('progressive is set only on the six assassin charge-up skills (S2C 0xA3 → 0x6fb52950)', () => {
    const progressive: number[] = []
    generated.SKILL_INPUT_FLAGS_113C.forEach((flags, id) => {
      if (flags & generated.SKILL_FLAG_PROGRESSIVE_113C) progressive.push(id)
    })
    expect(progressive).toEqual([254, 259, 265, 269, 274, 280])
  })

  it('cltprgfunc1 #84 (ForceLightning, Thunder Storm) is used only by row 57, which is not progressive', () => {
    const fn = generated.SKILL_CLT_PRG_FUNC1_113C
    expect(fn).toHaveLength(357)
    const used = new Map<number, number>()
    fn.forEach((v, id) => {
      if (v !== 0) used.set(id, v)
    })
    expect([...used]).toEqual([
      [57, 84],
      [244, 91],
      [249, 92],
      [254, 12],
      [265, 13],
      [280, 14],
      [307, 93],
      [325, 93],
      [349, 92],
    ])
    expect(generated.SKILL_INPUT_FLAGS_113C[57]! & generated.SKILL_FLAG_PROGRESSIVE_113C).toBe(0)
  })

  it("row 57's cltmissilea is a Missiles.txt row, so fn #84's range check (0x6fb24399 / 0x6fb243a5) passes", async () => {
    const archives = await getSharedMountedArchives()
    const skills = parseTable(await archives.read(SKILLS_MEMBER_113C))
    const missiles = parseTable(await archives.read('data\\global\\excel\\Missiles.txt'))
    const col = (t: typeof skills, name: string): number => {
      const index = t.header.indexOf(name)
      if (index < 0) throw new Error(`no column ${name}`)
      return index
    }
    const row57 = skills.rows[57]!
    expect(row57[col(skills, 'skill')]).toBe('Thunder Storm')
    expect(row57[col(skills, 'cltmissilea')]).toBe('thunderstorm1')
    const missileNames = missiles.rows.map(r => r[col(missiles, 'Missile')])
    expect(missileNames).toContain('thunderstorm1')
  }, 60_000)

  it('spot checks against well-known 1.13c rows', () => {
    const f = generated.SKILL_INPUT_FLAGS_113C
    const r = generated.SKILL_RANGE_113C
    expect(f).toHaveLength(357)
    // 0 Attack: interruptible; 1 Kick / 43 Telekinesis / 90 Iron Golem: TargetItem.
    expect(f[0]! & generated.SKILL_FLAG_INTERRUPT_113C).not.toBe(0)
    for (const id of [1, 43, 90]) expect(f[id]! & generated.SKILL_FLAG_TARGET_ITEM_113C).not.toBe(0)
    // Sequence skills are not interruptible (busy gate blocks hold while they run).
    for (const id of [10, 26, 30, 97, 106, 107, 144, 147, 151]) {
      expect(f[id]! & generated.SKILL_FLAG_INTERRUPT_113C).toBe(0)
    }
    // 101 Holy Bolt targets pets and allies; 74 Corpse Explosion targets corpses.
    expect(f[101]! & generated.SKILL_FLAG_TARGET_PET_113C).not.toBe(0)
    expect(f[101]! & generated.SKILL_FLAG_TARGET_ALLY_113C).not.toBe(0)
    expect(f[74]! & generated.SKILL_FLAG_TARGET_CORPSE_113C).not.toBe(0)
    // 147 Frenzy is melee (h2h); 6 Magic Arrow is a bow skill (rng); 0 Attack is both; spells are none.
    expect(r[147]).toBe('h2h')
    expect(r[6]).toBe('rng')
    expect(r[0]).toBe('both')
    expect(r[36]).toBe('none')
    // tyrael1 (hcIdx 251): MonStats2 ht box -100/-20/60x100.
    expect(generated.NO_GFX_HIT_BOXES_113C.find(([hc]) => hc === 251)?.[1]).toEqual({
      top: -100,
      left: -20,
      width: 60,
      height: 100,
    })
  })
})
