/**
 * Offline 1:1 parameter sweep & whole-call-tree verification for 1.13c Item-Driven Defense:
 * - `SUNITDMG_CalcDamageResists` (`0x6FCFC0B0`) & `SUNITDMG_CalcChannel` (`0x6FCFBD00`):
 *   flat `DR` (`stat 34`), flat `MDR` (`stat 35`), `nOverlays` (`+0x54`) `1024`-scaling,
 *   signed negative `DR`/`MDR` overflow spill across channels, `%DR` (`stat 36`) / elemental
 *   resists, `%` Absorb (`<= 40%`, `esi > 0` guard at `0x6FCFAD16`), and flat Absorb (`<< 8`,
 *   including `MDR > rawElem` negative spill cancellation at `0x6FCFAD4D..0x6FCFAD7C`).
 * - `SUNITDMG_ApplyDamageLife` (`0x6FCFE0C0`):
 *   `event 5` (`#76 Iron Maiden` `0x6FC6F090`, `wResultFlags = 0x4021`, pre-life-clamp `dwPhysDamage`),
 *   LIFO `ITEMEVENTS_Dispatch` (`0x6FC57030` / `0x6FC57110`: `ATD` `stat 78`, `ATLD` `stat 128`,
 *   `DamageToMana` `stat 114`, `CtC When Struck` `stat 201` on `pDefender->pSeed` BEFORE durability),
 *   defender current-life clamp (`0x6FCFE200`), pre-damage `dwAbsorbLife` heal (`0x6FCFE23D`),
 *   exact `256ths` life subtraction (`< 0x100 -> 0` at `0x6FCFE255`), armor durability (`0x6FCFEE2B`),
 *   `#103 Thorns` / `stat 131` (`0x6FCB8A70` at `0x6FCFEE8E`, life-clamped `dwPhysDamage`, `(pct+4)>>3` PvP),
 *   and `#42 Static Field` (`0x6FC630D0` -> `0x6FCC0C70` -> `0x6FC62EC0`).
 *
 * Ground truth: `kb/combat/d2game-item-defense-absorb-thorns-ctc-113c.md`.
 */
import { describe, expect, it } from 'vitest'
import type { D2SeedStrc } from '../../src/common/rng/d2-rng.ts'
import {
  computeRawDamagePipe113c,
  mulDiv113c,
  setSUnitDmgTraceObserver113c,
  type SUnitDmgTraceEvent113c,
} from '../../src/server/engine/combat-pipeline.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  collectPlayerDefenderItemEventsLifo113c,
  computeDamageToManaGain256_113c,
  computeIronMaidenReflectRawPhys256_113c,
  computePreDamageAbsorbAndLife113c,
  computeStaticFieldTargetLtng256_113c,
  computeThornsAuraReflectRawPhys256_113c,
  resolveSecondaryMonsterSUnitDmg113c,
  rollPlayerDefenderCtcEntry113c,
} from '../../src/server/engine/game-instance/sunitdmg-player-defender-113c.ts'
import { rollLimitedSeed113c } from '../../src/server/engine/game-instance/unit-seeds-113c.ts'
import type { InternalMonsterRecord, InternalPlayerRecord, ServerItemEntry } from '../../src/server/engine/game-instance/types.ts'
import { decodeCtcParam113c, encodeCtcParam113c } from '../../src/server/skills/passives-procs-113c.ts'

/** Reference C-equivalent of `0x6FCFBD00` + `0x6FCFAD00` + `0x6FCFC4F7` for cross-checking sweeps. */
function refCalcPhysPlusElem113c(p: {
  defenderIsPlayer: boolean
  phys256: number
  elem256: number
  rate54: number
  dr: number
  mdr: number
  physRes: number
  elemResStatId: number
  elemMaxStatId: number
  elemPierceStatId: number
  res: number
  maxRes: number
  absPct: number
  absFlat: number
  pierce: number
  penalty: number
}): { physOut: number; elemOut: number; totalOut: number; absorb256: number } {
  let dr256 = (p.dr | 0) << 8
  if (dr256 > 0 && (p.rate54 | 0) > 0) dr256 = mulDiv113c(p.rate54 | 0, dr256, 1024)
  let mdr256 = (p.mdr | 0) << 8
  if (mdr256 > 0 && (p.rate54 | 0) > 0) mdr256 = mulDiv113c(p.rate54 | 0, mdr256, 1024)

  let physOut = 0
  if ((p.phys256 | 0) > 0) {
    let effPhysRes = p.physRes | 0
    if (p.defenderIsPlayer) {
      if (effPhysRes > 50) effPhysRes = 50
      if (effPhysRes < -100) effPhysRes = -100
    } else if (effPhysRes < -100) {
      effPhysRes = -100
    }
    let esi = ((p.phys256 | 0) - dr256) | 0
    if (esi > 0 && effPhysRes !== 0) {
      const r = effPhysRes >= 100 ? 100 : effPhysRes
      esi = mulDiv113c((100 - r) | 0, esi, 100)
    }
    physOut = esi
  }

  let elemOut = 0
  let absorb256 = 0
  if ((p.elem256 | 0) > 0) {
    let effRes = p.res | 0
    let cap = 75 + (p.maxRes | 0)
    if (cap >= 95) cap = 95
    if (effRes <= 0 || !p.defenderIsPlayer) cap = 100
    if (effRes < 100 || !p.defenderIsPlayer) {
      if (p.elemPierceStatId >= 0) effRes -= p.pierce | 0
    }
    if (p.defenderIsPlayer) {
      effRes += p.penalty | 0
    }
    if (effRes >= cap) effRes = cap
    if (effRes <= -100) effRes = -100

    let esi = ((p.elem256 | 0) - mdr256) | 0
    if (esi > 0 && effRes !== 0) {
      const r = effRes >= 100 ? 100 : effRes
      esi = mulDiv113c((100 - r) | 0, esi, 100)
    }
    let pct = p.absPct | 0
    if (pct >= 40) pct = 40
    if (pct > 0) {
      const a = mulDiv113c(pct, esi, 100)
      absorb256 = (absorb256 + a) | 0
      esi = (esi - a) | 0
    }
    const flat256 = (p.absFlat | 0) << 8
    if (flat256 > 0) {
      const f = flat256 < esi ? flat256 : esi
      absorb256 = (absorb256 + f) | 0
      esi = (esi - f) | 0
    }
    elemOut = esi
  }
  return {
    physOut,
    elemOut,
    totalOut: (physOut + elemOut) | 0,
    absorb256,
  }
}

function makeEquippedItem(
  unitId: number,
  code: string,
  bodyLoc: number,
  statsEntries: ReadonlyArray<readonly [number, number]>,
  rawStatEntries?: ReadonlyArray<{ statId: number; param?: number; value: number }>,
): ServerItemEntry {
  const rawStats =
    rawStatEntries?.map((s) => ({ statId: s.statId, param: s.param ?? 0, value: s.value })) ??
    statsEntries.map(([statId, value]) => ({ statId, param: 0, value }))
  return {
    unitId,
    code,
    name: code,
    quality: 7,
    level: 60,
    location: 'equipped',
    x: 0,
    y: 0,
    width: 2,
    height: 2,
    areaId: 2,
    ownerId: 1,
    bodyLoc,
    storePage: 0,
    cost: 1000,
    gamble: false,
    identified: true,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: 30,
    maxDurability: 30,
    quantity: 1,
    stats: new Map(statsEntries),
    socketedItems: [],
    rawItemData: {
      code,
      quality: 7,
      identified: true,
      stats: rawStats,
    } as unknown as NonNullable<ServerItemEntry['rawItemData']>,
  }
}

describe('1.13c Item-Driven Defense parameter sweep (DR/MDR, Absorb, ATD/Thorns/IM, DTM, CtC & Static Field)', () => {
  it('exhaustively matches 0x6FCFBD00 + 0x6FCFAD00 across DR/MDR, nOverlays, resists, %/flat absorb, and negative overflow spill', () => {
    const rawPhysVals = [0, 256, 768, 2560, 8000]
    const rawElemVals = [0, 256, 1280, 5120]
    const drVals = [0, 2, 7, 15]
    const mdrVals = [0, 3, 13, 25]
    const physResVals = [-100, 0, 15, 50, 75]
    const elemResVals = [-50, 0, 50, 75, 90]
    const absPctVals = [0, 15, 40, 55]
    const absFlatVals = [0, 5, 15]
    const rates = [0, 205, 512, 1024]

    let cases = 0
    for (const defenderIsPlayer of [true, false]) {
      for (const phys256 of rawPhysVals) {
        for (const elem256 of rawElemVals) {
          for (const dr of drVals) {
            for (const mdr of mdrVals) {
              for (const absPct of absPctVals) {
                for (const absFlat of absFlatVals) {
                  const physRes = physResVals[cases % physResVals.length]!
                  const res = elemResVals[(cases * 3) % elemResVals.length]!
                  const rate54 = rates[(cases * 5) % rates.length]!
                  const maxRes = cases % 2 === 0 ? 0 : 10
                  const pierce = cases % 3 === 0 ? 15 : 0
                  const penalty = defenderIsPlayer && cases % 4 === 0 ? -40 : 0
                  const args = {
                    defenderIsPlayer,
                    phys256,
                    elem256,
                    rate54,
                    dr,
                    mdr,
                    physRes,
                    elemResStatId: 39,
                    elemMaxStatId: 40,
                    elemPierceStatId: 333,
                    res,
                    maxRes,
                    absPct,
                    absFlat,
                    pierce,
                    penalty,
                  }
                  const got = computeRawDamagePipe113c(args)
                  const exp = refCalcPhysPlusElem113c(args)
                  expect(got.physDamage256).toBe(exp.physOut)
                  expect(got.elemDamage256).toBe(exp.elemOut)
                  expect(got.totalDamage256).toBe(exp.totalOut)
                  expect(got.absorb256).toBe(exp.absorb256)
                  cases++
                }
              }
            }
          }
        }
      }
    }
    expect(cases).toBeGreaterThan(5000)

    // Explicit binary edge case 1: MDR overflow spill (1 Fire + 10 Phys vs MDR 13, 0 flat absorb -> total -2 HP)
    const mdrSpill = computeRawDamagePipe113c({
      defenderIsPlayer: true,
      phys256: 10 * 256,
      elem256: 1 * 256,
      rate54: 0,
      dr: 0,
      mdr: 13,
      physRes: 0,
      elemResStatId: 39,
      elemMaxStatId: 40,
      elemPierceStatId: 333,
      res: 0,
      maxRes: 0,
      absPct: 15, // 0x6FCFAD26 tests pct > 0 (not edi > 0): mulDiv113c(15, -3072, 100) = -460 -> edi = -2612
      absFlat: 0,
      pierce: 0,
      penalty: 0,
    })
    expect(mdrSpill.elemDamage256).toBe(-2612)
    expect(mdrSpill.totalDamage256).toBe(10 * 256 - 2612)
    expect(mdrSpill.absorb256).toBe(-460)

    // Explicit binary edge case 2: MDR > rawElem WITH flatAbsorb > 0 cancels negative spill (`0x6FCFAD4D`)
    const mdrFlatCancel = computeRawDamagePipe113c({
      defenderIsPlayer: true,
      phys256: 10 * 256,
      elem256: 1 * 256,
      rate54: 0,
      dr: 0,
      mdr: 13,
      physRes: 0,
      elemResStatId: 39,
      elemMaxStatId: 40,
      elemPierceStatId: 333,
      res: 0,
      maxRes: 0,
      absPct: 15,
      absFlat: 15,
      pierce: 0,
      penalty: 0,
    })
    expect(mdrFlatCancel.elemDamage256).toBe(0)
    expect(mdrFlatCancel.totalDamage256).toBe(10 * 256)
    expect(mdrFlatCancel.absorb256).toBe(-12 * 256)
  })

  it('verifies pre-damage dwAbsorbLife heal order, maxHp cap, state 92 suppression, <0x100 death floor, and lifeClampedPhys256', () => {
    //Defender at 10/100 HP taking 25 post-absorb damage with +20 absorb heal -> heals 10->30 BEFORE 30-25 = 5 HP (survives!)
    const survivedByPreHeal = computePreDamageAbsorbAndLife113c({
      hpBefore256: 10 * FIXED_ONE,
      maxHp256: 100 * FIXED_ONE,
      signedPhys256: 40 * FIXED_ONE,
      signedTotalInstant256: 25 * FIXED_ONE,
      absorbHeal256: 20 * FIXED_ONE,
    })
    expect(survivedByPreHeal.lifeClampedPhys256).toBe(10 * FIXED_ONE) // clamped to pre-heal curHp256 (`0x6FCFE200`)
    expect(survivedByPreHeal.hpAfterAbsorb256).toBe(30 * FIXED_ONE)
    expect(survivedByPreHeal.hpAfter256).toBe(5 * FIXED_ONE)
    expect(survivedByPreHeal.killed).toBe(false)

    // Defender at 95/100 HP with +20 absorb heal -> capped at 100 BEFORE subtracting 25 -> 75 HP (NOT 95+20-25 = 90!)
    const cappedAtMax = computePreDamageAbsorbAndLife113c({
      hpBefore256: 95 * FIXED_ONE,
      maxHp256: 100 * FIXED_ONE,
      signedPhys256: 0,
      signedTotalInstant256: 25 * FIXED_ONE,
      absorbHeal256: 20 * FIXED_ONE,
    })
    expect(cappedAtMax.hpAfterAbsorb256).toBe(100 * FIXED_ONE)
    expect(cappedAtMax.hpAfter256).toBe(75 * FIXED_ONE)

    // Sub-1-HP remainder (`0xFF` = 255 < 0x100) zeroes life (`0x6FCFE255`)
    const subOneDeath = computePreDamageAbsorbAndLife113c({
      hpBefore256: 10 * FIXED_ONE,
      maxHp256: 100 * FIXED_ONE,
      signedPhys256: 9 * FIXED_ONE + 1,
      signedTotalInstant256: 9 * FIXED_ONE + 1,
      absorbHeal256: 0,
    })
    expect(subOneDeath.hpAfter256).toBe(0)
    expect(subOneDeath.killed).toBe(true)

    // `state 92` (`death_delay`) suppresses pre-damage absorb heal (`0x6FCFB58C`)
    const deathDelay = computePreDamageAbsorbAndLife113c({
      hpBefore256: 10 * FIXED_ONE,
      maxHp256: 100 * FIXED_ONE,
      signedPhys256: 0,
      signedTotalInstant256: 5 * FIXED_ONE,
      absorbHeal256: 20 * FIXED_ONE,
      hasDeathDelayState: true,
    })
    expect(deathDelay.hpAfterAbsorb256).toBe(10 * FIXED_ONE)
    expect(deathDelay.hpAfter256).toBe(5 * FIXED_ONE)
  })

  it('verifies DamageToMana (stat 114), Iron Maiden (0x6FC6F090), Thorns (0x6FCB8A70), and Static Field (0x6FC62EC0) math', () => {
    // DamageToMana (`0x6FCCCDA0`)
    expect(computeDamageToManaGain256_113c(2560, 15, 10 * 256, 50 * 256)).toEqual({
      gain256: 384,
      nextMana256: 10 * 256 + 384,
    })
    expect(computeDamageToManaGain256_113c(2560, 15, 50 * 256, 50 * 256)).toEqual({
      gain256: 0,
      nextMana256: 50 * 256,
    })
    expect(computeDamageToManaGain256_113c(-512, 15, 10 * 256, 50 * 256)).toEqual({
      gain256: 0,
      nextMana256: 10 * 256,
    })

    // Iron Maiden (`>> 2` PvP before mulDiv) vs Thorns (`(pct + 4) >> 3` PvP before mulDiv)
    expect(computeIronMaidenReflectRawPhys256_113c(1000, 200, false)).toBe(2000)
    expect(computeIronMaidenReflectRawPhys256_113c(1000, 200, true)).toBe(500)
    expect(computeThornsAuraReflectRawPhys256_113c(1000, 250, false)).toBe(2500)
    expect(computeThornsAuraReflectRawPhys256_113c(1000, 250, true)).toBe(
      mulDiv113c((250 + 4) >> 3, 1000, 100),
    )

    // Static Field (`0x6FC62EC0`): Normal (0%), Nightmare (33%), Hell (50%), non-lethal cap, and negative ltngRes compensation
    expect(
      computeStaticFieldTargetLtng256_113c({
        curHp256: 20 * 256,
        maxHp256: 20 * 256,
        staticFieldMinPct: 0,
        rawTargetLtngRes: 0,
      }),
    ).toBe(5 * 256)
    // Hell 50% floor: at 10/20 HP, floorHp = 10 -> curHp <= floorHp -> null (no SUNITDMG call!)
    expect(
      computeStaticFieldTargetLtng256_113c({
        curHp256: 10 * 256,
        maxHp256: 20 * 256,
        staticFieldMinPct: 50,
        rawTargetLtngRes: 0,
      }),
    ).toBeNull()
    // 1 HP monster: curHp = 1 -> cutHp = mulDiv(1, 25, 100) = 0, EMin = 0 -> 0 damage SUNITDMG packet
    expect(
      computeStaticFieldTargetLtng256_113c({
        curHp256: 1 * 256,
        maxHp256: 20 * 256,
        staticFieldMinPct: 0,
        rawTargetLtngRes: 0,
      }),
    ).toBe(0)
    // Negative lightning resistance (-50%): pre-divided by (100 - (-50)) = 150 so CalcDamageResists *150/100 yields <= 25%
    const preDivNegRes = computeStaticFieldTargetLtng256_113c({
      curHp256: 40 * 256,
      maxHp256: 40 * 256,
      staticFieldMinPct: 0,
      rawTargetLtngRes: -50,
    })!
    const resolvedNegRes = resolveSecondaryMonsterSUnitDmg113c({
      playerUnitId: 1,
      monsterUnitId: 2,
      monsterHpBefore256: 40 * 256,
      monsterMaxHp256: 40 * 256,
      resultFlags: 0x4001,
      rawLtng256: preDivNegRes,
      monsterPhysRes: 0,
      monsterLtngRes: -50,
    })
    expect(resolvedNegRes.dealt256).toBeLessThanOrEqual(10 * 256)
    expect(resolvedNegRes.dealt256).toBeGreaterThanOrEqual(10 * 256 - 2)
  })

  it('deduplicates identical (statId, layer) ITEMEVENTS nodes while preserving LIFO equip order and summing CtC chance%', () => {
    const sfL3 = encodeCtcParam113c(42, 3)
    const novaL3 = encodeCtcParam113c(44, 3)
    expect(decodeCtcParam113c(sfL3)).toEqual({ skillId: 42, slvl: 3 })

    // Equipped in order: Helm (ATD 5, SF L3 10%) -> Body (DTM 10, ATD 3, SF L3 15%) -> Belt (Frost Nova L3 20%)
    const helm = makeEquippedItem(
      1,
      'ghm',
      1,
      [[78, 5]],
      [
        { statId: 78, value: 5 },
        { statId: 201, param: sfL3, value: 10 },
      ],
    )
    const body = makeEquippedItem(
      2,
      'xrs',
      3,
      [
        [78, 3],
        [114, 10],
      ],
      [
        { statId: 78, value: 3 },
        { statId: 114, value: 10 },
        { statId: 201, param: sfL3, value: 15 },
      ],
    )
    const belt = makeEquippedItem(
      3,
      'zlb',
      8,
      [],
      [{ statId: 201, param: novaL3, value: 20 }],
    )
    const { nodes, ctcChanceByLayer } = collectPlayerDefenderItemEventsLifo113c([helm, body, belt])
    // Registration sequence:
    // helm: +78 -> [78], +201(sfL3) -> [201(sfL3), 78]
    // body: 78 dup (skip), +114 -> [114, 201(sfL3), 78], 201(sfL3) dup (summed to 25%, skip)
    // belt: +201(novaL3) -> [201(novaL3), 114, 201(sfL3), 78]
    expect(nodes.map((n) => `${n.statId}:${n.layer}`)).toEqual([
      `201:${novaL3}`,
      '114:0',
      `201:${sfL3}`,
      '78:0',
    ])
    expect(ctcChanceByLayer.get(sfL3)).toEqual({ skillId: 42, slvl: 3, chance: 25 })
    expect(ctcChanceByLayer.get(novaL3)).toEqual({ skillId: 44, slvl: 3, chance: 20 })

    // CtC roll checks `(resultFlags113c & 0x04) !== 0` and consumes 1 draw on `pDefender->pSeed`
    const seed: D2SeedStrc = { lo: 0x12345678, hi: 666 }
    const seedCopy: D2SeedStrc = { ...seed }
    expect(rollPlayerDefenderCtcEntry113c(seed, 0x0001, 100)).toBe(false)
    expect(seed).toEqual(seedCopy) // 0 draws when GETHIT flag (0x04) is absent
    const expectedRoll = rollLimitedSeed113c(seedCopy, 100) < 25
    expect(rollPlayerDefenderCtcEntry113c(seed, 0x0005, 25)).toBe(expectedRoll)
    expect(seed).toEqual(seedCopy) // exact 1 draw
  })

  it('executes exact 1:1 whole-call-tree trace & RNG draw order on a GameInstance monster melee hit', () => {
    const game = new GameInstance({ seed: 12345, areaId: 2 })
    const playerId = game.connectPlayer({ name: 'DefPaladin', classId: 3, areaId: 2, level: 40 })
    const player = (game as unknown as { players: Map<number, InternalPlayerRecord> }).players.get(playerId)!
    player.areaId = 2
    player.x = 5100
    player.y = 5100
    player.level = 40
    player.vitality = 100
    player.maxHp = 400
    player.hp = 350
    player.maxHpFixed = 400 * FIXED_ONE
    player.hpFixed = 350 * FIXED_ONE
    player.maxMana = 100
    player.mana = 20
    player.maxManaFixed = 100 * FIXED_ONE
    player.manaFixed = 20 * FIXED_ONE
    player.items.length = 0

    // Equip body armor with DR 2, %DR 10, MDR 1, Fire Absorb 10%, Fire Absorb 2 flat, ATD 4, DTM 20%, 100% CtC L3 Static Field
    const sfL3 = encodeCtcParam113c(42, 3)
    const armor = makeEquippedItem(
      101,
      'xrs',
      3,
      [
        [34, 2], // normal_damage_reduction
        [35, 1], // magic_damage_reduction
        [36, 10], // damageresist
        [78, 4], // item_attackertakesdamage
        [114, 20], // item_damagetomana
        [142, 10], // item_absorbfire_percent
        [143, 2], // item_absorbfire
      ],
      [
        { statId: 34, value: 2 },
        { statId: 35, value: 1 },
        { statId: 36, value: 10 },
        { statId: 78, value: 4 },
        { statId: 114, value: 20 },
        { statId: 142, value: 10 },
        { statId: 143, value: 2 },
        { statId: 201, param: sfL3, value: 100 },
      ],
    )
    player.items.push(armor)

    // Grant active #103 Thorns (`state 36`, `thorns_percent = 250`)
    player.skills.set(103, 1)
    player.states.add(36)
    player.stateTimers.set(36, 500)
    const pCtx = (game as unknown as { playerCombatContext: (p: unknown) => { stateBus: { applyState: (a: unknown) => void } } }).playerCombatContext(player)
    pCtx.stateBus.applyState({
      stateNameOrId: 'thorns',
      sourceSkillId: 103,
      slvl: 1,
      durationFrames: 500,
      stats: { thorns_percent: 250 },
    })

    const monId = game.spawnMonster({ hcIdx: 1, x: 5101, y: 5100, areaId: 2 })
    const mon = (game as unknown as { monsters: Map<number, InternalMonsterRecord> }).monsters.get(monId)!
    mon.maxHp = 100
    mon.hp = 100
    mon.hp256 = 100 * FIXED_ONE
    mon.hp256Whole = 100
    mon.minDmg = 10
    mon.maxDmg = 10
    mon.elementalAttacks = [
      { mode: 'A1', type: 'fire', minDamage: 10, maxDamage: 10, chancePct: 100, durationFrames: 0 },
    ]

    const pSeed: D2SeedStrc = { lo: 0x11223344, hi: 666 }
    const mSeed: D2SeedStrc = { lo: 0x55667788, hi: 666 }
    ;(game as unknown as { drlgRoomPopulator: object }).drlgRoomPopulator = {}
    const unitSeeds = (game as unknown as { unitSeeds: Map<string, D2SeedStrc> }).unitSeeds
    unitSeeds.set(`0:${player.unitId}`, pSeed)
    unitSeeds.set(`1:${mon.unitId}`, mSeed)

    const traceEvents: SUnitDmgTraceEvent113c[] = []
    setSUnitDmgTraceObserver113c((ev) => traceEvents.push(ev))
    try {
      ;(
        game as unknown as {
          resolveMonsterAttackOnPlayer: (
            m: unknown,
            p: unknown,
            swing: Record<string, unknown>,
          ) => void
        }
      ).resolveMonsterAttackOnPlayer(mon, player, {
        autoHit: true,
        minDmg: 10,
        maxDmg: 10,
      })
    } finally {
      setSUnitDmgTraceObserver113c(null)
    }

    // Exact 4 SUNITDMG trace events in 1.13c call-tree order:
    // [0] Primary Monster -> Player (`0x6FCFDE2D`)
    // [1] CtC L3 Static Field (`201` prepended after `78` in LIFO order -> fires BEFORE ATD!) (`0x4001`)
    // [2] ATD (`stat 78`, `4 << 8 = 1024`, `0x4021`)
    // [3] Thorns (`stat 131` `250%` at `0x6FCFEE8E` AFTER durability, `0x4021`)
    expect(traceEvents.map((e) => [e.att[0], e.def[0], e.raw[1]])).toEqual([
      [1, 0, 0x0005],
      [0, 1, 0x4001],
      [0, 1, 0x4021],
      [0, 1, 0x4021],
    ])
    // Primary damage math:
    // Phys: `monsterFillPacketPhysRange113c(10, 10, 0)` -> `[2560, 2816)` (`max<=min -> min+0x100` at `0x6FCFC5E8`),
    // `rollLimitedSeed113c(mSeed, 256) = 66` -> `2626` -> `- DR(512) = 2114` -> `10% DR` -> `mulDiv(90, 2114, 100) = 1902`
    // Fire: `(10 - 1) * 256 = 2304` -> `10% Abs (230, rem 2074)` -> `2 flat Abs (512, rem 1562)`, `absorbHeal = 742`
    // Total: `1902 + 1562 = 3464`
    expect(traceEvents[0]!.raw[2]).toBe(1902)
    expect(traceEvents[0]!.raw[4]).toBe(1562)
    expect(traceEvents[0]!.ret).toBe(3464)
    // Static Field cut 25% of 100 HP = 25 * 256 = 6400; ATD = 4 * 256 = 1024; Thorns = mulDiv(250, 1902, 100) = 4755
    expect(traceEvents[1]!.ret).toBe(6400)
    expect(traceEvents[2]!.ret).toBe(1024)
    expect(traceEvents[3]!.ret).toBe(4755)
    // Player life: 350*256 + 742 (absorb heal) - 3464 = 89600 + 742 - 3464 = 86878
    expect(player.hpFixed).toBe(86878)
    // Player mana: 20*256 + mulDiv(20, 3464, 100) = 5120 + 692 = 5812
    expect(player.manaFixed).toBe(5812)
  })
})
