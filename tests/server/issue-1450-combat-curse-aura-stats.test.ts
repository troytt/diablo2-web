/**
 * Issue #1450 — Combat curse & aura `aurastat` parity (`D2Game.dll` + `Skills.txt`).
 *
 * Verifies:
 * 1. `GameInstance.applyDamageToMonster` and `applyMonsterPoisonDot` no longer overwrite the
 *    monster's persistent `StateBus` entries with hardcoded `slvl: 10, conviction_pierce: 75` or
 *    `slvl: 10` Lower Resist before `mirrorPersistentStates`.
 * 2. `slvl 20` Conviction (`Skills.txt` #123: `aurastat2..4 = fireresist/lightresist/coldresist`,
 *    `-min(150, ln56)` with `Param5=30, Param6=5` -> `-125%`) on a monster with `fireresist = 50`
 *    yields effective fire resist `50 - 125 = -75%` (subject to `-100%` floor).
 * 3. `Lower Resist` (`Skills.txt` #91: `aurastat2..5 = -dm56` with `Param5=25, Param6=70`) at
 *    `slvl 1 / 10 / 20` yields `31 / 55 / 62 (D2Common 0x6FD9DC30, #1678)` in both `executeSUnitDmg` and `GameInstance`.
 * 4. `Amplify Damage` (`-100%`) and `Decrepify` (`-50%` phys res, `-50%` damage) read their
 *    evaluated `aurastat` values from `StateBus` without double-counting or bypassing `1/5`
 *    immunity breaking when `baseRes >= 100`.
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import {
  executeSUnitDmg,
  resolveConvictionPierce113c,
  resolveLowerResistPierce113c,
  resolvePhysCursePierce113c,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

describe('Issue #1450 — Combat curse & aura StateBus aurastat parity', async () => {
  const registry = await getSharedDataRegistry()

  it('1. slvl 20 Conviction on a monster with fireresist = 50 yields effective fire resist 50 - 125 = -75 (and -100 floor)', () => {
    const atkStats = new UnitStatList(registry, {
      level: 80,
      maxhp: 1000 * FIXED_ONE,
      hitpoints: 1000 * FIXED_ONE,
    })
    const attacker: CombatUnitContext = {
      id: 'sorc_1',
      name: 'Sorceress',
      unitType: 'player',
      statList: atkStats,
      stateBus: new StateBus(atkStats, registry),
    }

    const defStats = new UnitStatList(registry, {
      level: 80,
      maxhp: 2000 * FIXED_ONE,
      hitpoints: 2000 * FIXED_ONE,
      fireresist: 50,
    })
    const defBus = new StateBus(defStats, registry)
    defBus.applyState({
      stateNameOrId: 'conviction',
      sourceSkillId: 123,
      slvl: 20,
      durationFrames: 100,
    })
    expect(resolveConvictionPierce113c({ statList: defStats, stateBus: defBus }, 'fireresist')).toBe(125)

    const defender: CombatUnitContext = {
      id: 'mon_1',
      name: 'Fallen',
      unitType: 'monster',
      statList: defStats,
      stateBus: defBus,
    }

    // 100 fire damage against 50 - 125 = -75% effective fire resist -> 175 fire damage
    const out = executeSUnitDmg(
      attacker,
      defender,
      {
        skillId: 36,
        attackKind: 'spell',
        srcDam: 0,
        elemType: 'fire',
        elemMin256: 100 * FIXED_ONE,
        elemMax256: 100 * FIXED_ONE,
        autoHit: true,
        unblockable: true,
      },
      { rand: () => 0 },
    )
    expect(out.elemDamage256).toBe(175 * FIXED_ONE)

    // With base fireresist = 0, 0 - 125 clamps to -100% floor -> 200 fire damage
    defStats.setBaseStat('fireresist', 0)
    const outFloor = executeSUnitDmg(
      attacker,
      defender,
      {
        skillId: 36,
        attackKind: 'spell',
        srcDam: 0,
        elemType: 'fire',
        elemMin256: 100 * FIXED_ONE,
        elemMax256: 100 * FIXED_ONE,
        autoHit: true,
        unblockable: true,
      },
      { rand: () => 0 },
    )
    expect(outFloor.elemDamage256).toBe(200 * FIXED_ONE)
  })

  it('2. Lower Resist at slvl 1 / 10 / 20 yields dm56(25, 70) values 31 / 55 / 62 (D2Common 0x6FD9DC30, #1678) in executeSUnitDmg and GameInstance', () => {
    const expectedBySlvl: ReadonlyArray<readonly [number, number]> = [
      [1, 31],
      [10, 55],
      [20, 62],
    ]

    for (const [slvl, expectedPierce] of expectedBySlvl) {
      const defStats = new UnitStatList(registry, {
        level: 80,
        maxhp: 2000 * FIXED_ONE,
        hitpoints: 2000 * FIXED_ONE,
        fireresist: 50,
        poisonresist: 50,
      })
      const defBus = new StateBus(defStats, registry)
      defBus.applyState({
        stateNameOrId: 'lowerresist',
        sourceSkillId: 91,
        slvl,
        durationFrames: 500,
      })

      expect(resolveLowerResistPierce113c({ statList: defStats, stateBus: defBus }, 'fireresist')).toBe(expectedPierce)
      expect(resolveLowerResistPierce113c({ statList: defStats, stateBus: defBus }, 'poisonresist')).toBe(expectedPierce)

      // GameInstance.applyDamageToMonster preserves the monster's real Lower Resist slvl
      const gi = new GameInstance({ seed: 1450, difficulty: 0, areaId: 2 })
      const playerId = gi.connectPlayer({
        charClass: 'nec',
        name: 'Necro',
        x: 100,
        y: 100,
        areaId: 2,
        level: 80,
        skills: { 91: slvl },
      })
      const monId = gi.spawnMonster({
        defId: 'fallen1',
        x: 102,
        y: 100,
        areaId: 2,
        hp: 1000,
        maxHp: 1000,
        resistances: { phys: 0, magic: 0, fire: 50, light: 50, cold: 50, poison: 50 },
        aiDisabled: true,
      })

      // Cast Lower Resist (#91) at `slvl` onto the monster
      gi.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: 91,
        targetType: 'monster',
        targetId: monId,
      })
      gi.stepFrames(2)

      const hpBefore = gi.getMonster(monId)!.hp
      gi.applyDamageToMonster(monId, 100, playerId, 36, 'fire')
      const dealt = hpBefore - gi.getMonster(monId)!.hp
      // Base 50% fire res - expectedPierce -> effectiveRes = 50 - expectedPierce
      // 100 * (100 - (50 - expectedPierce)) / 100 = 50 + expectedPierce
      expect(dealt).toBe(50 + expectedPierce)
    }
  })

  it('3. GameInstance.applyDamageToMonster uses real Conviction slvl (e.g. slvl 20 = -125%, slvl 12 = -85%) instead of hardcoded 75%', () => {
    for (const [slvl, expectedPierce] of [
      [12, 85],
      [20, 125],
    ] as const) {
      const gi = new GameInstance({ seed: 1450, difficulty: 0, areaId: 2 })
      const palId = gi.connectPlayer({
        charClass: 'pal',
        name: 'Paladin',
        x: 100,
        y: 100,
        areaId: 2,
        level: 80,
        skills: { 123: slvl },
      })
      const monId = gi.spawnMonster({
        defId: 'fallen1',
        x: 102,
        y: 100,
        areaId: 2,
        hp: 1000,
        maxHp: 1000,
        resistances: { phys: 0, magic: 0, fire: 50, light: 50, cold: 50, poison: 0 },
        aiDisabled: true,
      })

      // Activate Conviction (#123) at `slvl`
      gi.enqueueCommand(palId, {
        type: 'CastSkillAtLocation',
        skillId: 123,
        hand: 'right',
        x: 100,
        y: 100,
      })
      gi.stepFrames(2)

      // Monster must carry state 28 (`conviction`) and take 100 * (100 - (50 - expectedPierce)) / 100 fire damage
      expect(gi.getMonster(monId)!.states.has(28)).toBe(true)
      const hpBefore = gi.getMonster(monId)!.hp
      gi.applyDamageToMonster(monId, 100, palId, 36, 'fire')
      const dealt = hpBefore - gi.getMonster(monId)!.hp
      const effectiveRes = Math.max(-100, 50 - expectedPierce)
      expect(dealt).toBe(Math.floor((100 * (100 - effectiveRes)) / 100))
    }
  })

  it('4. Amplify Damage (-100%) and Decrepify (-50%) break physical immunity at 1/5 effectiveness without double-counting', () => {
    const atkStats = new UnitStatList(registry, {
      level: 80,
      maxhp: 1000 * FIXED_ONE,
      hitpoints: 1000 * FIXED_ONE,
    })
    const attacker: CombatUnitContext = {
      id: 'nec_1',
      name: 'Necromancer',
      unitType: 'player',
      statList: atkStats,
      stateBus: new StateBus(atkStats, registry),
      weaponMinPhys: 100,
      weaponMaxPhys: 100,
    }

    // Monster with 100% physical resistance (Physical Immune)
    const defStats = new UnitStatList(registry, {
      level: 80,
      maxhp: 2000 * FIXED_ONE,
      hitpoints: 2000 * FIXED_ONE,
      damageresist: 100,
    })
    const defBus = new StateBus(defStats, registry)
    defBus.applyState({
      stateNameOrId: 'amplifydamage',
      sourceSkillId: 66,
      slvl: 5,
      durationFrames: 500,
    })
    expect(resolvePhysCursePierce113c({ statList: defStats, stateBus: defBus })).toBe(100)

    const defender: CombatUnitContext = {
      id: 'ghost_1',
      name: 'Wraith',
      unitType: 'monster',
      statList: defStats,
      stateBus: defBus,
    }

    // 100% base phys res broken by Amplify Damage (-100% / 5 = -20%) -> 80% effective phys res -> 20 phys damage
    const outAmp = executeSUnitDmg(
      attacker,
      defender,
      {
        skillId: 0,
        attackKind: 'melee',
        autoHit: true,
        unblockable: true,
      },
      { rand: () => 50 },
    )
    expect(outAmp.immuneToPhys).toBe(false)
    expect(outAmp.physDamage256).toBe(20 * FIXED_ONE)

    // Replace with Decrepify (-50% / 5 = -10%) -> 90% effective phys res -> 10 phys damage
    defBus.applyState({
      stateNameOrId: 'decrepify',
      sourceSkillId: 87,
      slvl: 5,
      durationFrames: 500,
    })
    expect(resolvePhysCursePierce113c({ statList: defStats, stateBus: defBus })).toBe(50)
    const outDec = executeSUnitDmg(
      attacker,
      defender,
      {
        skillId: 0,
        attackKind: 'melee',
        autoHit: true,
        unblockable: true,
      },
      { rand: () => 50 },
    )
    expect(outDec.immuneToPhys).toBe(false)
    expect(outDec.physDamage256).toBe(10 * FIXED_ONE)
  })
})
