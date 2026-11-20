import { describe, expect, it } from 'vitest'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import {
  computeToHitChance,
  damagePercentModifier113c,
  executeSUnitDmg,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'

function makeUnit(
  unitType: CombatUnitContext['unitType'] = 'player',
  overrides: Partial<CombatUnitContext> = {},
): CombatUnitContext {
  const statList = new UnitStatList()
  const stateBus = new StateBus(statList)
  statList.setBaseStat('level', 80)
  statList.setBaseStat('maxhp', 2000 * FIXED_ONE)
  statList.setHp256(2000 * FIXED_ONE)
  return {
    id: `${unitType}_1`,
    name: `${unitType}_1`,
    unitType,
    statList,
    stateBus,
    ...overrides,
  }
}

describe('1.13c Combat Server Parity (#1625, #1626, #1628..#1635)', () => {
  it('#1625 & #1626: single additive %AR pool, ITD/fractional target AC, and negative defense/AR adjustment', () => {
    const atk = makeUnit('player')
    atk.statList.setBaseStat('tohit', 1000)
    atk.statList.setBaseStat('item_tohit_percent', 50)
    atk.statList.setBaseStat('item_demon_tohit', 200)

    // Standalone getAccruedStat('tohit') still applies +50% = 1500, while getRawToHit113c() returns 1000
    expect(atk.statList.getAccruedStat('tohit')).toBe(1500)
    expect(atk.statList.getRawToHit113c()).toBe(1000)

    // With +50% item_tohit_percent and +100% skillArBonusPct vs Demon (+200 flat AR):
    // baseAr = 1000 + 200 = 1200; single additive pool = +150% -> effAr = 1200 * 250 / 100 = 3000
    // (NOT 1500 * 200 / 100 = 3000 when demonToHit=0; with demonToHit=200: 1200 * 2.5 = 3000).
    // With defenderDef = 3000: effAr / (effAr + effDef) = 50% -> toHitChance = 50.
    const chance = computeToHitChance({
      attackerAr: atk.statList.getRawToHit113c(),
      defenderDef: 3000,
      attackerLvl: 80,
      defenderLvl: 80,
      itemArBonusPct: 50,
      skillArBonusPct: 100,
      demonToHit: 200,
      isTargetDemon: true,
    })
    expect(chance).toBe(50)

    // ITD (item_ignoretargetac) zeroes defense vs normal monsters, but NOT vs bosses/players:
    expect(
      computeToHitChance({
        attackerAr: 100,
        defenderDef: 5000,
        attackerLvl: 80,
        defenderLvl: 80,
        ignoreTargetAc: true,
        isTargetPlayerOrBossOrMerc: false,
      }),
    ).toBe(95)
    expect(
      computeToHitChance({
        attackerAr: 100,
        defenderDef: 5000,
        attackerLvl: 80,
        defenderLvl: 80,
        ignoreTargetAc: true,
        isTargetPlayerOrBossOrMerc: true,
      }),
    ).toBe(5)

    // Negative defense adds to AR (`if (def < 0) { ar -= def; def = 0 }`):
    expect(
      computeToHitChance({
        attackerAr: 100,
        defenderDef: -400,
        attackerLvl: 80,
        defenderLvl: 80,
      }),
    ).toBe(95)
  })

  it('#1628: clamps combined physical %ED pool at -90% minimum in executeSUnitDmg', () => {
    const atk = makeUnit('player', { weaponMinPhys: 100, weaponMaxPhys: 100 })
    const def = makeUnit('monster', { drain: 100 })
    // -200% ED (e.g. Battle Cry + Weakened) clamps to -90% -> 10% of 100 = 10 damage (2560 in 256-fixed)
    const out = executeSUnitDmg(
      atk,
      def,
      {
        skillId: 0,
        attackKind: 'melee',
        srcDam: 128,
        physDamagePct: -200,
        autoHit: true,
      },
      new D2Rng(42),
    )
    expect(out.physDamage256).toBe(10 * FIXED_ONE)
  })

  it('#1629 & #1630: sumPlayerItemStat excludes swap slots 11/12, includes charms/sockets, and shifts 224/225 by >> 1 (/ 2)', () => {
    const game = new GameInstance({ seed: 1629, areaId: 1 })
    const pid = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
    const g = game as unknown as Record<string, any>
    const player = g.players.get(pid)
    player.level = 80
    player.dexterity = 20

    // Active weapon with socketed gem (+50 AR), Grand Charm (+100 AR), Fool's mod 224 (16 -> 16*80 >> 1 = 640 AR),
    // Visionary mod 225 (2 -> 2*80 >> 1 = 80% AR), and swap slot 11 weapon (+9999 AR, must be ignored!).
    player.items.push(
      {
        unitId: 101,
        code: 'crs',
        location: 'equipped',
        bodyLoc: 4,
        durability: 20,
        maxDurability: 20,
        stats: new Map([
          [224, 16],
          [225, 2],
        ]),
        socketedItems: [{ stats: new Map([[19, 50]]), socketedItems: [] }],
      },
      {
        unitId: 102,
        code: 'cm3',
        location: 'inventory',
        bodyLoc: 0,
        stats: new Map([[19, 100]]),
        socketedItems: [],
      },
      {
        unitId: 103,
        code: 'crs',
        location: 'equipped',
        bodyLoc: 11,
        durability: 20,
        maxDurability: 20,
        stats: new Map([[19, 9999]]),
        socketedItems: [],
      },
    )

    expect(g.sumPlayerItemStat(player, 19)).toBe(50 + 100 + ((16 * 80) >> 1))
    expect(g.computePlayerToHitPctBonus113c(player)).toBe((2 * 80) >> 1)
  })

  it('#1631: damagePercentModifier113c scales Player/Merc/Minion vs Player by 17% and Merc vs Merc by 25%', () => {
    const p1 = makeUnit('player')
    const p2 = makeUnit('player')
    const merc1 = makeUnit('mercenary')
    const merc2 = makeUnit('mercenary')
    const minion = makeUnit('minion', { ownerUnitId: 'player_1' })
    const mon = makeUnit('monster')

    expect(damagePercentModifier113c(p1, p2)).toBe(17)
    expect(damagePercentModifier113c(merc1, p2)).toBe(17)
    expect(damagePercentModifier113c(minion, p2)).toBe(17)
    expect(damagePercentModifier113c(merc1, merc2)).toBe(25)
    expect(damagePercentModifier113c(p1, mon)).toBe(100)

    const outPvP = executeSUnitDmg(
      { ...p1, weaponMinPhys: 100, weaponMaxPhys: 100 },
      p2,
      { skillId: 0, attackKind: 'melee', srcDam: 128, autoHit: true },
      new D2Rng(7),
    )
    expect(outPvP.physDamage256).toBe(Math.trunc((100 * FIXED_ONE * 17) / 100))
  })

  it('#1633: player life regeneration only runs from stat 74 hpregen and clamps negative hpregen at 256 (1 HP)', () => {
    const game = new GameInstance({ seed: 1633, areaId: 1 })
    const pid = game.connectPlayer({ charClass: 'nec', name: 'Nec', x: 10, y: 10, areaId: 1 })
    const g = game as unknown as Record<string, any>
    const player = g.players.get(pid)
    player.maxHpFixed = 1000 * 256
    player.hpFixed = 500 * 256
    player.hp = 500

    // Without stat 74 hpregen, player HP does NOT naturally regenerate
    game.stepFrames(20)
    expect(player.hpFixed).toBe(500 * 256)

    // With negative hpregen (-200 per frame), HP drains down to 256 (1 HP) and never kills the player
    player.hpFixed = 500
    player.items.push({
      unitId: 201,
      code: 'rin',
      location: 'equipped',
      bodyLoc: 6,
      stats: new Map([[74, -200]]),
      socketedItems: [],
    })
    game.stepFrames(5)
    expect(player.hpFixed).toBe(256)
    expect(player.dead).toBe(false)
  })

  it('#1634 & #1635: getDefense keeps sheet defense while running, and multiElemPacket applies flat MDR per channel', () => {
    const defUnit = makeUnit('player', { isRunning: true })
    defUnit.statList.setBaseStat('armorclass', 500)
    defUnit.statList.setBaseStat('skill_armor_percent', 100)
    expect(defUnit.statList.getDefense({ isRunningPlayer: true })).toBe(1000)

    // Running player defender bypasses RollToHit in executeSUnitDmg (auto-hits even with low AR)
    const lowArAtk = makeUnit('monster', { weaponMinPhys: 50, weaponMaxPhys: 50 })
    lowArAtk.statList.setBaseStat('tohit', 1)
    lowArAtk.statList.setBaseStat('level', 1)
    const runHit = executeSUnitDmg(
      lowArAtk,
      defUnit,
      { skillId: 0, attackKind: 'melee', srcDam: 128, roll100: 99 },
      new D2Rng(9),
    )
    expect(runHit.hit).toBe(true)

    // Vengeance multiElemPacket applies flat magic_damage_reduction (10) independently to fire, cold, and ltng
    const vengAtk = makeUnit('player', { weaponMinPhys: 100, weaponMaxPhys: 100 })
    const mdrDef = makeUnit('monster', { drain: 100 })
    mdrDef.statList.setBaseStat('magic_damage_reduction', 10)
    const vengOut = executeSUnitDmg(
      vengAtk,
      mdrDef,
      {
        skillId: 111,
        attackKind: 'melee',
        srcDam: 128,
        autoHit: true,
        multiElemPacket: { firePct: 50, coldPct: 50, ltngPct: 50 },
      },
      new D2Rng(11),
    )
    // Each channel gets 50 - 10 = 40 -> 3 * 40 = 120 elemental damage (instead of 150 without MDR)
    expect(vengOut.elemDamage256).toBe(120 * FIXED_ONE)
  })
})
