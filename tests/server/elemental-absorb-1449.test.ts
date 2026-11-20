import { describe, expect, it } from 'vitest'
import {
  ELEM_ABSORB_STAT_MAP,
  applyElementalAbsorb113c,
  executeSUnitDmg,
  type CombatRng,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

const rng: CombatRng = { rand: () => 0 }

function makeUnit(
  id: string,
  stats: Record<string, number>,
  unitType: CombatUnitContext['unitType'] = 'player',
): CombatUnitContext {
  const statList = new UnitStatList(undefined, {
    level: 80,
    maxhp: 1000 * FIXED_ONE,
    hitpoints: 1000 * FIXED_ONE,
    ...stats,
  })
  const stateBus = new StateBus(statList)
  return {
    id,
    name: id,
    unitType,
    statList,
    stateBus,
  }
}

describe('Issue #1449: 1.13c Elemental Absorb stat names, SUNITDMG_ApplyAbsorb (0x6FCFAD00), and player defense stats 142-149', () => {
  it('maps fire/ltng/mag/cold to official ItemStatCost.txt stat names (142..149) and excludes poison', () => {
    expect(ELEM_ABSORB_STAT_MAP.fire).toEqual({
      pct: 'item_absorbfire_percent',
      flat: 'item_absorbfire',
    })
    expect(ELEM_ABSORB_STAT_MAP.ltng).toEqual({
      pct: 'item_absorblight_percent',
      flat: 'item_absorblight',
    })
    expect(ELEM_ABSORB_STAT_MAP.mag).toEqual({
      pct: 'item_absorbmagic_percent',
      flat: 'item_absorbmagic',
    })
    expect(ELEM_ABSORB_STAT_MAP.cold).toEqual({
      pct: 'item_absorbcold_percent',
      flat: 'item_absorbcold',
    })
    expect(ELEM_ABSORB_STAT_MAP.pois).toBeUndefined()
  })

  it('caps % absorb at 40% (0x6FCFAD37 cmp eax, 0x28) and applies 1x damage reduction + pre-damage heal (0x6FCFE237 -> 0x6FCFB570)', () => {
    const attacker = makeUnit('attacker', {}, 'monster')

    // Case 1: Defender at full HP (200/200), 0 fire resist, 50% fire absorb (capped to 40%).
    // Incoming 100 fire damage -> 40 absorbed, 60 remaining damage.
    // Pre-damage heal +40 clamps at maxHP (200), then 60 damage subtracted -> 140 HP (NOT 2x reduction to 180!).
    const fullHpDef = makeUnit('defender_full', {
      maxhp: 200 * FIXED_ONE,
      hitpoints: 200 * FIXED_ONE,
      item_absorbfire_percent: 50,
    })
    const outFull = executeSUnitDmg(
      attacker,
      fullHpDef,
      {
        skillId: 0,
        attackKind: 'spell',
        elemType: 'fire',
        elemMin256: 100 * FIXED_ONE,
        elemMax256: 100 * FIXED_ONE,
        autoHit: true,
      },
      rng,
    )
    expect(outFull.elemDamage256).toBe(60 * FIXED_ONE)
    expect(outFull.totalDamage256).toBe(60 * FIXED_ONE)
    expect(outFull.absorbHeal256).toBe(40 * FIXED_ONE)
    expect(outFull.targetHpAfter256).toBe(140 * FIXED_ONE)

    // Case 2: Defender missing life (100/200 HP), 0 fire resist, 30% fire absorb.
    // Incoming 100 fire damage -> 30 absorbed, 70 remaining damage.
    // Pre-damage heal: 100 + 30 = 130 HP, then subtract 70 -> 60 HP.
    const woundedDef = makeUnit('defender_wounded', {
      maxhp: 200 * FIXED_ONE,
      hitpoints: 100 * FIXED_ONE,
      item_absorbfire_percent: 30,
    })
    const outWounded = executeSUnitDmg(
      attacker,
      woundedDef,
      {
        skillId: 0,
        attackKind: 'spell',
        elemType: 'fire',
        elemMin256: 100 * FIXED_ONE,
        elemMax256: 100 * FIXED_ONE,
        autoHit: true,
      },
      rng,
    )
    expect(outWounded.elemDamage256).toBe(70 * FIXED_ONE)
    expect(outWounded.absorbHeal256).toBe(30 * FIXED_ONE)
    expect(outWounded.targetHpAfter256).toBe(60 * FIXED_ONE)
  })

  it('clamps flat absorb to remaining post-% damage (0x6FCFAD6D..0x6FCFAD75): flat absorb 15 vs damage 10 -> 0 damage, 10 heal', () => {
    const attacker = makeUnit('attacker', {}, 'monster')
    const defender = makeUnit('defender', {
      maxhp: 200 * FIXED_ONE,
      hitpoints: 100 * FIXED_ONE,
      item_absorbfire: 15,
    })

    const out = executeSUnitDmg(
      attacker,
      defender,
      {
        skillId: 0,
        attackKind: 'spell',
        elemType: 'fire',
        elemMin256: 10 * FIXED_ONE,
        elemMax256: 10 * FIXED_ONE,
        autoHit: true,
      },
      rng,
    )
    expect(out.elemDamage256).toBe(0)
    expect(out.totalDamage256).toBe(0)
    expect(out.absorbHeal256).toBe(10 * FIXED_ONE)
    expect(out.targetHpAfter256).toBe(110 * FIXED_ONE)

    // Combined % + flat absorb: 100 damage, 25% absorb (absorbs 25 -> 75 left), 80 flat absorb (clamped to 75 -> 0 left, 100 total heal)
    const comboOut = applyElementalAbsorb113c(100 * FIXED_ONE, 25, 80 * FIXED_ONE)
    expect(comboOut.remainingDamage256).toBe(0)
    expect(comboOut.absorbHeal256).toBe(100 * FIXED_ONE)
  })

  it('supports ltng, mag, cold absorb, per-level absorb (stats 234..237), and ignores absorb on poison', () => {
    const attacker = makeUnit('attacker', {}, 'monster')

    // Lightning % + flat absorb
    const ltngDef = makeUnit('ltng_def', {
      maxhp: 200 * FIXED_ONE,
      hitpoints: 100 * FIXED_ONE,
      item_absorblight_percent: 25,
      item_absorblight: 10,
    })
    const ltngOut = executeSUnitDmg(
      attacker,
      ltngDef,
      {
        skillId: 0,
        attackKind: 'spell',
        elemType: 'ltng',
        elemMin256: 100 * FIXED_ONE,
        elemMax256: 100 * FIXED_ONE,
        autoHit: true,
      },
      rng,
    )
    // 100 -> -25% (25) = 75 -> -10 flat = 65 damage; heal = 35; 100 + 35 - 65 = 70 HP
    expect(ltngOut.elemDamage256).toBe(65 * FIXED_ONE)
    expect(ltngOut.absorbHeal256).toBe(35 * FIXED_ONE)
    expect(ltngOut.targetHpAfter256).toBe(70 * FIXED_ONE)

    // Cold per-level absorb (stat 234 item_absorb_cold_perlevel, op=2 param=3: floor(perLvl * clvl / 8))
    const coldDef = makeUnit('cold_def', {
      level: 80,
      maxhp: 200 * FIXED_ONE,
      hitpoints: 100 * FIXED_ONE,
      item_absorb_cold_perlevel: 2, // floor(2 * 80 / 8) = 20 flat cold absorb
    })
    expect(coldDef.statList.getAccruedStat('item_absorbcold')).toBe(20)
    const coldOut = executeSUnitDmg(
      attacker,
      coldDef,
      {
        skillId: 0,
        attackKind: 'spell',
        elemType: 'cold',
        elemMin256: 50 * FIXED_ONE,
        elemMax256: 50 * FIXED_ONE,
        autoHit: true,
      },
      rng,
    )
    expect(coldOut.elemDamage256).toBe(30 * FIXED_ONE)
    expect(coldOut.absorbHeal256).toBe(20 * FIXED_ONE)
    expect(coldOut.targetHpAfter256).toBe(90 * FIXED_ONE)

    // Magic absorb (stat 146/147)
    const magDef = makeUnit('mag_def', {
      maxhp: 200 * FIXED_ONE,
      hitpoints: 100 * FIXED_ONE,
      item_absorbmagic_percent: 10,
      item_absorbmagic: 11,
    })
    const magOut = executeSUnitDmg(
      attacker,
      magDef,
      {
        skillId: 0,
        attackKind: 'spell',
        elemType: 'mag',
        elemMin256: 100 * FIXED_ONE,
        elemMax256: 100 * FIXED_ONE,
        autoHit: true,
      },
      rng,
    )
    expect(magOut.elemDamage256).toBe(79 * FIXED_ONE)
    expect(magOut.absorbHeal256).toBe(21 * FIXED_ONE)
    expect(magOut.targetHpAfter256).toBe(42 * FIXED_ONE)

    // Poison has NO absorb in 1.13c (descriptor row 8 at 0x6FD22C10 has absPct = -1, absFlat = -1)
    const poisDef = makeUnit('pois_def', {
      maxhp: 200 * FIXED_ONE,
      hitpoints: 100 * FIXED_ONE,
      item_absorbfire_percent: 40,
      item_absorbmagic_percent: 40,
      item_absorbmagic: 50,
    })
    const poisOut = executeSUnitDmg(
      attacker,
      poisDef,
      {
        skillId: 0,
        attackKind: 'spell',
        elemType: 'pois',
        elemMin256: 40 * FIXED_ONE,
        elemMax256: 40 * FIXED_ONE,
        autoHit: true,
      },
      rng,
    )
    expect(poisOut.elemDamage256).toBe(40 * FIXED_ONE)
    expect(poisOut.absorbHeal256).toBeUndefined()
  })

  it('wires equipped item stats 142..149 and 234..237 into GameInstance player defense and applies absorb healing', () => {
    const game = new GameInstance({ seed: 1449 })
    const pid = game.connectPlayer({
      name: 'AbsorbPaladin',
      charClass: 'pal',
      level: 80,
      hp: 100,
      maxHp: 200,
      x: 100,
      y: 100,
    })
    const internal = game as unknown as {
      players: Map<number, { hp: number; hpFixed: number; maxHpFixed: number; items: Record<string, unknown>[] }>
      monsters: Map<number, unknown>
      resolveMonsterAttackOnPlayer: (
        monster: unknown,
        player: unknown,
        swing: {
          minDmg: number
          maxDmg: number
          skillMode: 'A1'
          attackKind: 'missile'
          elementType: 'fire'
          elemMin: number
          elemMax: number
          fromMissile: true
          autoHit: true
        },
      ) => void
    }
    const playerRec = internal.players.get(pid)!
    const absorbRing = {
      unitId: 9101,
      code: 'rin',
      name: 'Absorb Ring',
      quality: 7,
      level: 60,
      location: 'equipped',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      areaId: 1,
      ownerId: pid,
      bodyLoc: 6,
      storePage: 0,
      cost: 1000,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 0,
      maxDurability: 0,
      quantity: 1,
      stats: new Map([[142, 30]]),
      socketedItems: [],
    }
    playerRec.items.push(absorbRing)

    const monId = game.spawnMonster({
      hcIdx: 1,
      x: 101,
      y: 100,
      areaId: 1,
      hp: 100,
      maxHp: 100,
    })
    const monRec = internal.monsters.get(monId)!

    // Hit player (100/200 HP, 0 fire res, 30% fire absorb) with 100 fire missile:
    // Heal +30 -> 130 HP, then subtract 70 fire damage -> 60 HP
    internal.resolveMonsterAttackOnPlayer(monRec, playerRec, {
      minDmg: 0,
      maxDmg: 0,
      skillMode: 'A1',
      attackKind: 'missile',
      elementType: 'fire',
      elemMin: 100,
      elemMax: 100,
      fromMissile: true,
      autoHit: true,
    })
    expect(playerRec.hp).toBe(60)

    // Switch ring to flat fire absorb 15 (stat 143), hit with 10 fire damage -> 0 damage, +10 heal (70 HP)
    absorbRing.stats = new Map([[143, 15]])
    internal.resolveMonsterAttackOnPlayer(monRec, playerRec, {
      minDmg: 0,
      maxDmg: 0,
      skillMode: 'A1',
      attackKind: 'missile',
      elementType: 'fire',
      elemMin: 10,
      elemMax: 10,
      fromMissile: true,
      autoHit: true,
    })
    expect(playerRec.hp).toBe(70)
  })
})
