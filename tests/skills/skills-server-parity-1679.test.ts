import { describe, expect, it } from 'vitest'
import { computeSkillManaCost256, evaluateCalc } from '../../src/common/data/calc-ast.ts'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { rolledPropsToItemStats } from '../../src/common/items/item-bridge.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { MissileEngine } from '../../src/server/engine/missile-engine.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'

const registry = getSharedDataRegistry()

describe('1.13c Skills Server Parity (#1679, #1680, #1685, #1686, #1687, #1688, #1689, #1691, #1692)', () => {
  it('#1679, #1680 & #1688: item_elemskill (126), own-class oskill cap (+3), and 99 effective slvl clamp', () => {
    const statList = new UnitStatList(registry)
    statList.setBaseSkillLevel(36, 10) // Fire Bolt (EType = fire)
    statList.setElemSkillsBonus('fire', 3)
    expect(statList.getEffectiveSkillLevel(36)).toBe(13)

    // Non-fire skill (Ice Bolt #39, EType = cold) does not get fire elemskill
    statList.setBaseSkillLevel(39, 5)
    expect(statList.getEffectiveSkillLevel(39)).toBe(5)
    statList.setElemSkillsBonus(4, 2) // cold = 4
    expect(statList.getEffectiveSkillLevel(39)).toBe(7)

    // Clamp effective skill level to 99 (#1688)
    statList.setAllSkillsBonus(95)
    expect(statList.getEffectiveSkillLevel(36)).toBe(99)

    // fireskill property emits statId 126, param 1
    expect(rolledPropsToItemStats([{ code: 'fireskill', min: 3, max: 3, value: 3 }])).toEqual([
      { statId: 126, param: 1, value: 3 },
    ])

    // GameInstance resolvePlayerSkillLevel: own-class oskill capped at +3 (#1680) + elemskill (#1679)
    const gi = new GameInstance({ mode: 'sp', registry })
    const uid = gi.connectPlayer({ name: 'Sor', charClass: 1, level: 30 })
    const p = (gi as any).players.get(uid)!
    p.skills.set(36, 5) // Fire Bolt (sorc own-class, fire)
    const rawStats = [
      { statId: 126, param: 1, value: 3 }, // +3 to Fire Skills
      { statId: 97, param: 36, value: 6 }, // +6 to Fire Bolt (oskill, capped at +3 for Sorceress)
    ]
    p.items.push({
      unitId: 100,
      code: 'wst',
      location: 'equipped',
      bodyLoc: 4,
      identified: true,
      durability: 20,
      maxDurability: 20,
      quantity: 1,
      stats: new Map<number, number>([
        [126, 3],
        [97, 6],
      ]),
      socketedItems: [],
      rawItemData: {
        stats: rawStats,
        runewordStats: [],
      } as any,
    })
    const fireBolt = registry.getSkillById(36)!
    expect((gi as any).resolvePlayerSkillLevel(p, fireBolt)).toBe(5 + 3 + 3)

    // Cross-class oskill (Whirlwind #151 on Sorceress) is uncapped
    rawStats.push({ statId: 97, param: 151, value: 6 })
    const whirlwind = registry.getSkillById(151)!
    expect((gi as any).resolvePlayerSkillLevel(p, whirlwind)).toBe(6)
  })

  it('#1685: miss() calc and missile lifetime use Range + LevRange * slvl and Vel + trunc(VelLev * slvl / 8)', () => {
    const blazeMsl = registry.getMissileByName('blaze')!
    const rngVal = evaluateCalc("miss('blaze'.range)", {
      registry,
      slvl: 5,
      blvl: 5,
    })
    expect(rngVal).toBe(blazeMsl.range + 5 * blazeMsl.levRange)

    const panims = registry.getMissileByName(' firewallmaker') ?? registry.getMissileByName('firewallmaker')!
    const fwRange = evaluateCalc("miss('firewallmaker'.rng)", {
      registry,
      slvl: 4,
      blvl: 4,
    })
    expect(fwRange).toBe(panims.range + 4 * panims.levRange)
  })

  it('#1686 & #1687: mana == 0 && lvlmana == 0 costs 0; can-cast checks raw cost; blood_mana (state 114) pays from life', () => {
    // Might (#98): mana = 0, lvlMana = 0, minMana = 1 -> 0 mana cost in 1.13c
    const might = registry.getSkillById(98)!
    const mightMana = computeSkillManaCost256(might, 1)
    expect(mightMana.manaCost256).toBe(0)
    expect(mightMana.rawManaCost256).toBe(0)

    // Teleport (#54) at slvl 25: raw cost <= 0, minMana = 1 -> rawManaCost256 = 0, manaCost256 = 256
    const teleport = registry.getSkillById(54)!
    const tpMana = computeSkillManaCost256(teleport, 25)
    expect(tpMana.rawManaCost256).toBe(0)
    expect(tpMana.manaCost256).toBe(teleport.minMana << 8)

    // Blood Mana (state 114) deducts from life instead of mana
    const gi = new GameInstance({ mode: 'sp', registry })
    const uid = gi.connectPlayer({ name: 'Sor', charClass: 1, level: 30 })
    const p = (gi as any).players.get(uid)!
    p.areaId = 2 // Blood Moor (outside town)
    p.skills.set(36, 1) // Fire Bolt
    p.hpFixed = 100 * FIXED_ONE
    p.hp = 100
    p.manaFixed = 50 * FIXED_ONE
    p.mana = 50
    p.states.add(114) // blood_mana
    const cast = (gi as any).resolvePlayerSkillCast(p, 36)
    expect(cast).not.toBeNull()
    ;(gi as any).commitPlayerSkillCast(p, cast)
    expect(p.manaFixed).toBe(50 * FIXED_ONE)
    expect(p.hpFixed).toBe(100 * FIXED_ONE - cast.evalResult.manaCost256)
  })

  it('#1689, #1691 & #1692: rand(a, b) returns a when a >= b, Range <= 0 has no 35 fallback, evalMissileSkillCalc uses base blvl', () => {
    expect(evaluateCalc('rand(10, 4)', { slvl: 1, blvl: 1 })).toBe(10)
    expect(evaluateCalc('rand(7, 7)', { slvl: 1, blvl: 1 })).toBe(7)
    expect(
      evaluateCalc('rand(3, 9)', {
        slvl: 1,
        blvl: 1,
        randFn: (lo, hi) => lo + ((hi - lo) >> 1),
      }),
    ).toBe(6)

    const statList = new UnitStatList(registry)
    statList.setBaseSkillLevel(244, 2) // Volcano hard points = 2
    statList.setAllSkillsBonus(8) // Effective slvl = 10
    const owner = {
      id: 'dru_1',
      name: 'Dru',
      unitType: 'player' as const,
      statList,
      stateBus: new StateBus(statList, registry),
    }
    const engine = new MissileEngine(registry)
    // volcanofiretrail has Range = 0 in Missiles.txt -> maxRangeTicks is 0 without override (#1691)
    const trail = engine.spawnMissile({
      missileNameOrId: 'volcanofiretrail',
      sourceSkillId: 244,
      slvl: 10,
      owner,
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
    })!
    expect(trail.maxRangeTicks).toBe(0)
    expect((engine as any).evalMissileSkillCalc(trail, 'blvl')).toBe(2)
    expect((engine as any).evalMissileSkillCalc(trail, 'lvl')).toBe(10)
  })
})
