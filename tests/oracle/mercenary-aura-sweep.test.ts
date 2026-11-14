import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_NODE_MPQ_DIR, getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { evaluateCalc } from '../../src/common/data/calc-ast.ts'
import {
  HIRELING_RECORDS,
  chooseMercSkill113c,
  computeMercSetStats113c,
  resolveHirelingLevelFromExp113c,
  resolveHirelingRecord113c,
} from '../../src/common/units/hireling-table.ts'
import { AuraScanner, computeAuraStateDurationFrames } from '../../src/server/engine/aura-scanner.ts'
import type { CombatUnitContext } from '../../src/server/engine/combat-pipeline.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'

const HAVE_DATA = existsSync(DEFAULT_NODE_MPQ_DIR)

describe('mercenary Hireling.txt & radial party aura sweep (1.13c)', () => {
  it('resolves exact golden-trace L35 Act 1 Cold Arrow Rogue stats & dynamic-bracket level from 4,630,500 XP', () => {
    const mercLevel = resolveHirelingLevelFromExp113c(1, 4_630_500, true, 40)
    expect(mercLevel).toBe(35)

    // Verify dynamic-bracket boundary around L35 (Expansion L3 row has Exp/Lvl = 105):
    // threshold(35) = 36 * 35 * 35 * 105 = 4,630,500; threshold(36) = 37 * 36 * 36 * 105 = 5,034,960
    expect(resolveHirelingLevelFromExp113c(1, 4_630_499, true, 98)).toBe(34)
    expect(resolveHirelingLevelFromExp113c(1, 4_630_500, true, 98)).toBe(35)
    expect(resolveHirelingLevelFromExp113c(1, 5_034_959, true, 98)).toBe(35)
    expect(resolveHirelingLevelFromExp113c(1, 5_034_960, true, 98)).toBe(36)

    const stats = computeMercSetStats113c(1, mercLevel, true)
    expect(stats).not.toBeNull()
    expect(stats!.row.level).toBe(3)
    expect(stats!.delta).toBe(32)
    expect(stats!.strength).toBe(75)
    expect(stats!.dexterity).toBe(109)
    expect(stats!.energy).toBe(0)
    expect(stats!.vitality).toBe(0)
    expect(stats!.maxHp256).toBe(85248)
    expect(stats!.hp256).toBe(85248)
    expect(stats!.hpRegen256).toBe(42)
    expect(stats!.defense).toBe(271)
    expect(stats!.toHit).toBe(394)
    expect(stats!.secondaryMinDamage).toBe(9)
    expect(stats!.secondaryMaxDamage).toBe(11)
    expect(stats!.baseResist).toBe(64)
    expect(stats!.skills.map((s) => [s.skillId, s.slvl])).toEqual([
      [8, 11],
      [11, 11],
    ])
  })

  it('sweeps MERCS_SetStats (0x6FC68BA0) across all Expansion subTypeIds and levels L3..L98', () => {
    const expansionSubTypes = [...new Set(HIRELING_RECORDS.filter((r) => r.version === 100).map((r) => r.subTypeId))].sort(
      (a, b) => a - b,
    )
    expect(expansionSubTypes.length).toBeGreaterThanOrEqual(24)

    for (const subTypeId of expansionSubTypes) {
      let prevHp = 0
      for (const lvl of [3, 12, 24, 25, 35, 49, 50, 75, 98]) {
        const rec = resolveHirelingRecord113c(subTypeId, lvl, true, true)
        expect(rec).not.toBeNull()
        const stats = computeMercSetStats113c(subTypeId, lvl, true)!
        const delta = Math.max(0, lvl - rec!.level)

        expect(stats.strength).toBe(Math.max(10, rec!.str + Math.trunc((delta * rec!.strPerLvl) / 8)))
        expect(stats.dexterity).toBe(Math.max(10, rec!.dex + Math.trunc((delta * rec!.dexPerLvl) / 8)))
        expect(stats.maxHp256).toBe(Math.max(0x2800, (rec!.hp << 8) + (rec!.hpPerLvl << 8) * delta))
        expect(stats.hpRegen256).toBe(Math.max(0, Math.trunc(stats.maxHp256 / 2000)))
        expect(stats.defense).toBe(Math.max(0, rec!.defense + delta * rec!.defPerLvl))
        expect(stats.toHit).toBe(Math.max(0, rec!.ar + delta * rec!.arPerLvl))
        expect(stats.secondaryMinDamage).toBe(Math.max(0, rec!.dmgMin + Math.trunc((delta * rec!.dmgPerLvl) / 8)))
        expect(stats.secondaryMaxDamage).toBe(Math.max(1, rec!.dmgMax + Math.trunc((delta * rec!.dmgPerLvl) / 8)))
        expect(stats.baseResist).toBe(Math.max(0, rec!.resist + Math.trunc((delta * rec!.resistPerLvl) / 4)))

        for (const sk of stats.skills) {
          expect(sk.slvl).toBeGreaterThanOrEqual(0)
          expect(sk.slvl).toBeLessThanOrEqual(32)
        }
        expect(stats.maxHp256).toBeGreaterThanOrEqual(prevHp)
        prevHp = stats.maxHp256
      }
    }
  })

  it('verifies AIMERC_ChooseSkill (0x6FC3C4E0) inclusive [0..totalWeight] boundaries, aura suppression, and Inferno gate', () => {
    // L35 Expansion Rogue Cold Arrow (subTypeId = 1, row.level = 3, delta = 32):
    // defaultChance = 75, slot1 (#8) = 10 -> cum[0]=85, slot2 (#11) = 25 + trunc(32*5/4) = 65 -> cum[1]=150
    let capturedLimit = 0
    const pickAt = (val: number) =>
      chooseMercSkill113c(
        1,
        35,
        true,
        (limit) => {
          capturedLimit = limit
          return val
        },
        { defaultRogueSkillId: 6 },
      )!

    const c74 = pickAt(74)
    expect(capturedLimit).toBe(151) // totalWeight (150) + 1 inclusive!
    expect(c74.kind).toBe('default')
    expect(c74.skillId).toBe(6)

    const c75 = pickAt(75)
    expect(c75.kind).toBe('skill')
    expect(c75.skillId).toBe(8) // Inner Sight

    const c85 = pickAt(85)
    expect(c85.kind).toBe('skill')
    expect(c85.skillId).toBe(8) // <= cum[0] (85)

    const c86 = pickAt(86)
    expect(c86.kind).toBe('skill')
    expect(c86.skillId).toBe(11) // Cold Arrow

    const c150 = pickAt(150)
    expect(c150.kind).toBe('skill')
    expect(c150.skillId).toBe(11) // <= cum[1] (150)

    // Act 2 Nightmare Offensive Desert Mercenary (Might #98 + Jab #10):
    // When Might (#98) is already active, its slot weight is suppressed to 0.
    const a2Off = HIRELING_RECORDS.find((r) => r.version === 100 && r.act === 2 && r.skills.includes(98))!
    const withoutActive = chooseMercSkill113c(a2Off.subTypeId, 45, true, () => 0)!
    const withActive = chooseMercSkill113c(a2Off.subTypeId, 45, true, () => 0, {
      activeAuraSkillIds: new Set([98]),
    })!
    expect(withActive.totalWeight).toBeLessThan(withoutActive.totalWeight)

    // Act 3 Fire Iron Wolf (Inferno #41 + Fire Ball #47):
    const a3Fire = HIRELING_RECORDS.find((r) => r.version === 100 && r.act === 3 && r.skills.includes(41))!
    const nearInferno = chooseMercSkill113c(a3Fire.subTypeId, 35, true, () => 0, { targetDistanceSubtiles: 4 })!
    const farInferno = chooseMercSkill113c(a3Fire.subTypeId, 35, true, () => 0, { targetDistanceSubtiles: 25 })!
    expect(farInferno.totalWeight).toBeLessThan(nearInferno.totalWeight)
  })

  it.skipIf(!HAVE_DATA)(
    'sweeps Paladin radial party auras (#113 Concentration, #122 Fanaticism, #98 Might, #120 Meditation) onto hired mercenary',
    () => {
      const reg = getSharedDataRegistry()
      const scanner = new AuraScanner(reg, 12345)

      const makeUnits = (mercDx: number, mercDy: number) => {
        const palStats = new UnitStatList(reg, undefined, { ownerType: 'player', charClass: 'pal' })
        palStats.setBaseStat('level', 40)
        palStats.setBaseStat('maxhp', 500 * FIXED_ONE)
        palStats.setHp256(500 * FIXED_ONE)
        palStats.setBaseStat('maxmana', 200 * FIXED_ONE)
        palStats.setMana256(200 * FIXED_ONE)
        palStats.setBaseSkillLevel(98, 5)
        palStats.setBaseSkillLevel(113, 12)
        palStats.setBaseSkillLevel(120, 5)
        palStats.setBaseSkillLevel(122, 10)
        const palBus = new StateBus(palStats)

        const mercStats = new UnitStatList(reg, undefined, { ownerType: 'monster' })
        const mBase = computeMercSetStats113c(1, 35, true)!
        mercStats.setBaseStat('level', mBase.level)
        mercStats.setBaseStat('strength', mBase.strength)
        mercStats.setBaseStat('dexterity', mBase.dexterity)
        mercStats.setBaseStat('maxhp', mBase.maxHp256)
        mercStats.setHp256(mBase.hp256)
        mercStats.setBaseStat('tohit', mBase.toHit)
        const mercBus = new StateBus(mercStats)

        const paladin: CombatUnitContext = {
          id: 'player-1',
          name: 'Oracle',
          charClass: 'pal',
          unitType: 'player',
          x: 5662,
          y: 5797,
          statList: palStats,
          stateBus: palBus,
        }
        const merc: CombatUnitContext = {
          id: 'merc-1',
          name: 'Merc',
          unitType: 'mercenary',
          petType: 'hire',
          x: 5662 + mercDx,
          y: 5797 + mercDy,
          statList: mercStats,
          stateBus: mercBus,
        }
        return { paladin, merc }
      }

      // 1. Town suppression (aurafilter 0x12003 includes 0x2000 town-room skip)
      {
        const { paladin, merc } = makeUnits(3, 0)
        const src = scanner.setActiveAura(paladin, 113, 12, 100)!
        scanner.pulseAura(src, 100, [paladin, merc], [], [], { isTown: true })
        expect(paladin.stateBus.hasState('concentration')).toBe(true)
        expect(merc.stateBus.hasState('concentration')).toBe(false)
      }

      // 2. Sweep slvl 1..20 for Concentration (#113), Fanaticism (#122), and Might (#98)
      for (let slvl = 1; slvl <= 20; slvl++) {
        const concSkill = reg.getSkillById(113)!
        const fanatSkill = reg.getSkillById(122)!
        const mightSkill = reg.getSkillById(98)!

        const concRange = evaluateCalc(concSkill.auraRangeCalc, {
          registry: reg,
          activeSkill: concSkill,
          slvl,
          blvl: slvl,
        })
        const { paladin: pIn, merc: mIn } = makeUnits(concRange, 0)
        const { paladin: pOut, merc: mOut } = makeUnits(concRange + 1, 0)

        scanner.clearUnitAuras('player-1')
        const sIn = scanner.setActiveAura(pIn, 113, slvl, 620)!
        scanner.pulseAura(sIn, 620, [pIn, mIn], [], [], { isTown: false })
        expect(mIn.stateBus.hasState('concentration')).toBe(true)
        expect(mIn.statList.getAccruedStat('damagepercent')).toBe(pIn.statList.getAccruedStat('damagepercent'))

        scanner.clearUnitAuras('player-1')
        const sOut = scanner.setActiveAura(pOut, 113, slvl, 620)!
        scanner.pulseAura(sOut, 620, [pOut, mOut], [], [], { isTown: false })
        expect(mOut.stateBus.hasState('concentration')).toBe(false)

        // Fanaticism (#122): self gets ln56, mercenary ally gets trunc(ln56 / 2)
        const { paladin: pFan, merc: mFan } = makeUnits(5, 0)
        scanner.clearUnitAuras('player-1')
        const sFan = scanner.setActiveAura(pFan, 122, slvl, 1120)!
        scanner.pulseAura(sFan, 1120, [pFan, mFan], [], [], { isTown: false })
        const expectedSelfEd = evaluateCalc(fanatSkill.passiveCalc1, {
          registry: reg,
          activeSkill: fanatSkill,
          slvl,
          blvl: slvl,
        })
        const expectedAllyEd = evaluateCalc(fanatSkill.auraStatCalc3, {
          registry: reg,
          activeSkill: fanatSkill,
          slvl,
          blvl: slvl,
        })
        expect(pFan.statList.getAccruedStat('damagepercent')).toBe(expectedSelfEd)
        expect(mFan.statList.getAccruedStat('damagepercent')).toBe(expectedAllyEd)
        expect(expectedAllyEd).toBe(Math.trunc(expectedSelfEd / 2))
        expect(mFan.statList.getAccruedStat('attackrate')).toBe(pFan.statList.getAccruedStat('attackrate'))

        // Might (#98): identical damagepercent on caster and mercenary
        const { paladin: pMight, merc: mMight } = makeUnits(4, 0)
        scanner.clearUnitAuras('player-1')
        const sMight = scanner.setActiveAura(pMight, 98, slvl, 200)!
        scanner.pulseAura(sMight, 200, [pMight, mMight], [], [], { isTown: false })
        const expectedMightEd = evaluateCalc(mightSkill.auraStatCalc1, {
          registry: reg,
          activeSkill: mightSkill,
          slvl,
          blvl: slvl,
        })
        expect(mMight.statList.getAccruedStat('damagepercent')).toBe(expectedMightEd)
      }

      // 3. Meditation (#120, aurafilter = 0x12001 lacks 0x02 monster flag): never buffs mercenary
      {
        const { paladin, merc } = makeUnits(2, 0)
        scanner.clearUnitAuras('player-1')
        const sMed = scanner.setActiveAura(paladin, 120, 5, 300)!
        scanner.pulseAura(sMed, 300, [paladin, merc], [], [], { isTown: false })
        expect(paladin.stateBus.hasState('meditation')).toBe(true)
        expect(merc.stateBus.hasState('meditation')).toBe(false)
      }

      // 4. Golden-trace F1101 -> F1120 -> F1152 aura switch overlap ([42, 49] until F1152)
      {
        expect(computeAuraStateDurationFrames(1101, 50)).toBe(51) // expires on 1101 + 51 = F1152
        const { paladin, merc } = makeUnits(16, 0)
        scanner.clearUnitAuras('player-1')
        const concSrc = scanner.setActiveAura(paladin, 113, 12, 620)!
        scanner.pulseAura(concSrc, 1101, [paladin, merc], [], [], { isTown: false })
        expect(merc.stateBus.hasState('concentration')).toBe(true)

        // At F1120 Paladin switches active aura from #113 (42) to #122 (49):
        paladin.stateBus.removeState('concentration')
        scanner.clearUnitAuras('player-1')
        const fanatSrc = scanner.setActiveAura(paladin, 122, 10, 1120)!
        scanner.pulseAura(fanatSrc, 1120, [paladin, merc], [], [], { isTown: false })

        expect(paladin.stateBus.hasState('concentration')).toBe(false)
        expect(paladin.stateBus.hasState('fanaticism')).toBe(true)
        expect(merc.stateBus.hasState('concentration')).toBe(true)
        expect(merc.stateBus.hasState('fanaticism')).toBe(true)

        // At F1151, Fanaticism fires its global-aligned periodic pulse (refreshing 49 to F1202, leaving 42 at F1152):
        scanner.pulseAura(fanatSrc, 1151, [paladin, merc], [], [], { isTown: false })
        merc.stateBus.tick(1151)
        expect(merc.stateBus.hasState('concentration')).toBe(true)
        merc.stateBus.tick(1152)
        expect(merc.stateBus.hasState('concentration')).toBe(false)
        expect(merc.stateBus.hasState('fanaticism')).toBe(true)
      }
    },
  )
})
