import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CANONICAL_ITEM_STAT_COST_BY_NAME,
  encodeByTimeStat113c,
  FIXED_ONE,
  UnitStatList,
} from '../../src/server/engine/stat-list.ts'

function collectTsFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...collectTsFiles(full))
    } else if (full.endsWith('.ts')) {
      results.push(full)
    }
  }
  return results
}

describe('Issue #1447: D2Common.dll 0x6FD89530 / 0x6FD89AF0 ItemStatCost op 1..13 dispatch & layering', () => {
  it('derives maxhp at level=30 with item_hp_perlevel=8 via op=2 ((8 * 30) >> 3 = +30 HP / +7680 Q8)', () => {
    // D2Common.dll 0x6FD8960D / 0x6FD89B62 (op=2): (opStatValue * (opBaseValue >> valShift)) >> opParam
    // item_hp_perlevel (ID 216): op=2, opParam=3, opBase=level (12), opStat1=maxhp (7, ValShift=8)
    // Wait: in ItemStatCost.txt, item_hp_perlevel (216) stores value in 256-fixed-point per 8 levels (or raw opStatValue):
    // When item_hp_perlevel = 8 * FIXED_ONE (1.0 HP/lvl in 8.8 fixed-point, or raw 8 for integer check):
    // Let's verify both raw (8 -> +30 in getAccruedStat('maxhp')) and 8.8 fixed-point (8 * FIXED_ONE -> +30 HP in getMaxHp())!
    const unitRaw = new UnitStatList(undefined, {
      level: 30,
      maxhp: 100,
    })
    unitRaw.addStat('item_hp_perlevel', 8)
    // (8 * 30) >> 3 = 240 >> 3 = 30 added to maxhp
    expect(unitRaw.getAccruedStat('maxhp')).toBe(130)

    const unitQ8 = new UnitStatList(undefined, {
      level: 30,
      maxhp: 100 * FIXED_ONE,
      hitpoints: 100 * FIXED_ONE,
    })
    expect(unitQ8.getMaxHp()).toBe(100)
    unitQ8.addStat('item_hp_perlevel', 8 * FIXED_ONE)
    // ((8 * 256) * 30) >> 3 = 30 * 256 = 7680 Q8 maxhp delta -> 130 HP
    expect(unitQ8.getMaxHp256()).toBe(130 * FIXED_ONE)
    expect(unitQ8.getMaxHp()).toBe(130)
  })

  it('implements D2Common.dll 0x6FD89530 / 0x6FD89AF0 op 1..13 formulas across ItemStatCost.txt columns', () => {
    const unit = new UnitStatList(
      undefined,
      {
        level: 40,
        vitality: 20,
        energy: 20,
        maxhp: 200 * FIXED_ONE,
        maxmana: 100 * FIXED_ONE,
        maxstamina: 80 * FIXED_ONE,
        armorclass: 500,
        tohit: 400,
        maxdamage: 50,
      },
      { ownerType: 'player', charClass: 'bar', periodOfDay: 0, timeInPeriod: 0 },
    )

    // op=1 (0x6FD895D0): skill_staminapercent (162) -> maxstamina += trunc(prev * opVal / 100)
    unit.addOrUpdateModifier({
      id: 'mod_stamina_pct',
      stateName: 'staminabuff',
      stateId: 1,
      sourceUnitId: 'self',
      sourceSkillId: 148,
      slvl: 5,
      expireFrame: 0,
      stats: { skill_staminapercent: 50 },
    })
    expect(unit.getAccruedStat('maxstamina')).toBe(120 * FIXED_ONE) // 80 + 50% = 120

    // op=2 (0x6FD8960D): item_find_magic_perlevel (240): op=2, opParam=3, opBase=level, opStat1=item_magicbonus (80)
    unit.addStat('item_find_magic_perlevel', 10) // (10 * 40) >> 3 = 50
    expect(unit.getAccruedStat('item_magicbonus')).toBe(50)

    // op=4 (0x6FD8974B): item_armor_perlevel (214): op=4, opParam=3, opBase=level, opStat1=armorclass (31)
    unit.addStat('item_armor_perlevel', 12) // (12 * 40) >> 3 = 60
    expect(unit.getAccruedStat('armorclass')).toBe(560)

    // op=5 (0x6FD897DD): item_armorpercent_perlevel (215): op=5, opParam=3, opBase=level, opStat1=armorclass (31)
    // At level 40, item_armorpercent_perlevel = 8 -> pct = (8 * 40) >> 3 = 40% of prev (500) = +200 -> 560 + 200 = 760
    unit.addStat('item_armorpercent_perlevel', 8)
    expect(unit.getAccruedStat('armorclass')).toBe(760)

    // op=6 (0x6FD89873): item_armor_bytime (268): op=6, opStat1=armorclass (31)
    const packedByTime = encodeByTimeStat113c(0, 10, 30)
    unit.addStat('item_armor_bytime', packedByTime)
    // Period 0 (Day) -> max=30 added to armorclass (760 + 30 = 790)
    expect(unit.getAccruedStat('armorclass')).toBe(790)

    // op=8 (0x6FD89947) & op=9 (0x6FD899C3): bonus energy / vitality from modifiers scale maxmana / maxhp / maxstamina
    // Barbarian: lifePerVitality = 16 (4 HP per vit), manaPerMagic = 4 (1 Mana per energy)
    unit.addOrUpdateModifier({
      id: 'mod_attr',
      stateName: 'attrbuff',
      stateId: 2,
      sourceUnitId: 'self',
      sourceSkillId: 0,
      slvl: 1,
      expireFrame: 0,
      stats: { vitality: 10, energy: 10 },
    })
    // +10 vitality -> (10 * 16) << 6 = 40 * 256 -> maxhp = 200 + 40 = 240 HP
    // +10 energy -> (10 * 4) << 6 = 10 * 256 -> maxmana = 100 + 10 = 110 Mana
    expect(unit.getMaxHp()).toBe(240)
    expect(unit.getMaxMana256()).toBe(110 * FIXED_ONE)

    // op=11 (0x6FD89A5C): item_maxhp_percent (76) -> maxhp += trunc(prev * pct / 100)
    unit.addOrUpdateModifier({
      id: 'mod_bo',
      stateName: 'battleorders',
      stateId: 32,
      sourceUnitId: 'self',
      sourceSkillId: 149,
      slvl: 10,
      expireFrame: 0,
      stats: { item_maxhp_percent: 50, item_maxmana_percent: 50 },
    })
    // 1.13c rule: item_maxhp_percent (op=11) scales prev (base maxhp = 200 -> +100 HP) and does NOT multiply
    // bonus vitality from op=9 (+40 HP), yielding 200 + 40 + 100 = 340 HP (and 100 + 10 + 50 = 160 Mana)!
    expect(unit.getMaxHp()).toBe(340)
    expect(unit.getMaxMana256()).toBe(160 * FIXED_ONE)

    // op=13 (0x6FD89A87): local item stat list (ownerType: 'item') scales only that item's base stats
    const bodyArmor = new UnitStatList(
      undefined,
      {
        armorclass: 400,
        maxdurability: 60,
        item_armor_percent: 150,
        item_maxdurability_percent: 15,
      },
      { ownerType: 'item' },
    )
    expect(bodyArmor.getAccruedStat('armorclass')).toBe(1000) // 400 + floor(400 * 150 / 100)
    expect(bodyArmor.getAccruedStat('maxdurability')).toBe(69) // 60 + floor(60 * 15 / 100)
  })

  it('separates item_armor_percent (ID 16, op=13 on item) from skill_armor_percent (ID 171, UNITS_GetDefense 0x6FD82890) and supports attachStatList/detachStatList', () => {
    // Player with 100 Dexterity -> floor(100 / 4) = 25 defense when includeDexterityBonus: true
    const player = new UnitStatList(
      undefined,
      {
        dexterity: 100,
        armorclass: 0,
      },
      { ownerType: 'player' },
    )

    // Helmet: base 100 defense, +50% Enhanced Defense (item_armor_percent = 50 -> 150 defense on helmet)
    const helmet = new UnitStatList(
      undefined,
      { armorclass: 100, item_armor_percent: 50 },
      { ownerType: 'item' },
    )
    expect(helmet.getAccruedStat('armorclass')).toBe(150)

    // Body armor: base 400 defense, +100% Enhanced Defense (item_armor_percent = 100 -> 800 defense on armor)
    const armor = new UnitStatList(
      undefined,
      { armorclass: 400, item_armor_percent: 100 },
      { ownerType: 'item' },
    )
    expect(armor.getAccruedStat('armorclass')).toBe(800)

    // Attach both item stat lists to player (D2StatListExStrc.pMyLastList)
    player.attachStatList(helmet)
    player.attachStatList(armor)

    // Total flat armorclass = 150 (helmet) + 800 (armor) = 950;
    // Notice helmet's +50% and armor's +100% do NOT cross-pollinate (which would falsely yield (100+400)*2.5 = 1250)!
    expect(player.getAccruedStat('armorclass')).toBe(950)
    expect(player.getDefense({ includeDexterityBonus: true })).toBe(975)

    // Apply Shout (+200% skill_armor_percent, ID 171):
    // UNITS_GetDefense (0x6FD82890): floor(975 * (100 + 200) / 100) = 2925
    player.addOrUpdateModifier({
      id: 'mod_shout',
      stateName: 'shout',
      stateId: 26,
      sourceUnitId: 'self',
      sourceSkillId: 138,
      slvl: 10,
      expireFrame: 0,
      stats: { skill_armor_percent: 200 },
    })
    expect(player.getDefense({ includeDexterityBonus: true })).toBe(2925)

    // Detaching helmet removes its 150 armorclass -> flat = 800 + 25 = 825 -> floor(825 * 300 / 100) = 2475
    expect(player.detachStatList(helmet)).toBe(true)
    expect(player.getDefense({ includeDexterityBonus: true })).toBe(2475)
  })

  it('rejects fabricated stat names not present in 1.13c ItemStatCost.txt and verifies src/server/** has zero non-ItemStatCost stat names', () => {
    const unit = new UnitStatList()
    expect(() => unit.getAccruedStat('maxhp_percent')).toThrow(/unknown ItemStatCost stat/)
    expect(() => unit.setBaseStat('skill_ias', 20)).toThrow(/unknown ItemStatCost stat/)
    expect(() =>
      unit.addOrUpdateModifier({
        id: 'bad',
        stateName: 'bad',
        stateId: 1,
        sourceUnitId: 'self',
        sourceSkillId: 1,
        slvl: 1,
        expireFrame: 0,
        stats: { amplify_phys_pierce: 100 },
      }),
    ).toThrow(/unknown ItemStatCost stat/)

    // Static scan of all src/server/**/*.ts files for getAccruedStat / getBaseStat / setBaseStat / addStat / getModifierBonus calls
    const serverDir = resolve(__dirname, '../../src/server')
    const tsFiles = collectTsFiles(serverDir)
    const callRegex = /\b(?:getAccruedStat|getBaseStat|setBaseStat|addStat|getModifierBonus)\s*\(\s*['"]([^'"]+)['"]/g

    const violations: string[] = []
    for (const file of tsFiles) {
      const src = readFileSync(file, 'utf8')
      for (const match of src.matchAll(callRegex)) {
        const statName = match[1]!.toLowerCase()
        if (!CANONICAL_ITEM_STAT_COST_BY_NAME.has(statName)) {
          violations.push(`${file}: ${statName}`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})
