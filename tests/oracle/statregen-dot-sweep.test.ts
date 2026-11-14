/**
 * Offline 1.13c sweep tests for `MONSTER_Event3_HpRegen` (`0x6FC96740`), `PLAYER_UpdateHpRegen`
 * (`0x6FC97CB0`), `MONSTER_InitStats` (`0x6FCD00ED`), `D2Common.#10372` (`0x6FD83D80`), and the
 * `DotTraceEvent113c` observer (`kb/combat/d2game-statregen-dot-113c.md`).
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry, DEFAULT_NODE_MPQ_DIR } from '../../src/baker/mpq-archive-source.ts'
import {
  LIFE_MASK_STATE_IDS_113C,
  computeMonsterBaseDamageRegen113c,
  emitDotTraceEvent113c,
  hasLifeMaskState113c,
  setDotTraceObserver113c,
  stepMonsterEvent3HpRegen113c,
  stepPlayerUpdateHpRegen113c,
  type DotTraceEvent113c,
} from '../../src/server/engine/statregen-dot-113c.ts'

describe('1.13c StatRegen / DoT sweep (D2Game 0x6FC96740 & 0x6FC97CB0)', () => {
  it('matches MPQ States.txt life=1 mask (#10372, sgptDataTables+0x14C = pStateMasks[32])', () => {
    const reg = getSharedDataRegistry(DEFAULT_NODE_MPQ_DIR)
    const lifeMaskIds: number[] = []
    for (let id = 0; id < 200; id++) {
      const st = reg.getStateById(id)
      if (st && Number(st.raw['life'] ?? 0) === 1) {
        lifeMaskIds.push(id)
      }
    }
    expect(lifeMaskIds).toEqual([...LIFE_MASK_STATE_IDS_113C])
    expect(hasLifeMaskState113c((id) => id === 2)).toBe(true)
    expect(hasLifeMaskState113c((id) => id === 52)).toBe(true)
    expect(hasLifeMaskState113c((id) => id === 62)).toBe(true)
    expect(hasLifeMaskState113c((id) => id === 1 || id === 11 || id === 105)).toBe(false)
  })

  it('computes MONSTER_InitStats base stat 74 ((maxHp256 * dmgRegen) >> 12) and zeroes summoned pets (0x6FC669BE)', () => {
    // Blood Moor Zombie: maxHp = 9 (2304 in 256ths), DamageRegen = 2 -> (2304 * 2) >> 12 = 1
    expect(computeMonsterBaseDamageRegen113c(2304, 2, false)).toBe(1)
    // Fallen: maxHp = 4 (1024 in 256ths), DamageRegen = 2 -> (1024 * 2) >> 12 = 0
    expect(computeMonsterBaseDamageRegen113c(1024, 2, false)).toBe(0)
    // High-HP boss overflow guard (`maxHp > 0x7fffffff / dmgRegen` at 0x6FCD00F5)
    expect(computeMonsterBaseDamageRegen113c(0x4000_1000, 4, false)).toBe((0x4000_1000 >> 12) * 4)
    // Summoned pet override (`STATLIST_SetUnitStat(pPet, 74, 0, 0)` at 0x6FC669BE)
    expect(computeMonsterBaseDamageRegen113c(50_000, 12, true)).toBe(0)
  })

  it('suppresses innate damageRegen under #10372 (states 2, 52, 62) while preserving negative DoT bitrate', () => {
    // Unpoisoned Zombie at 1282/2304 ticks +1 per frame and reschedules Event 3
    const heal = stepMonsterEvent3HpRegen113c({
      hp0: 1282,
      maxHp256: 2304,
      baseRegen256: 1,
      modRegen256: 0,
      hasLifeMaskState: false,
      hasPreventHeal: false,
      inTown: false,
    })
    expect(heal).toEqual({
      hp1: 1283,
      effectiveRegen256: 1,
      calledSetStat: true,
      changed: true,
      reschedule: true,
      clampedToMax: false,
      killed: false,
    })

    // Poisoned Zombie (state 2, -603/frame): #10372 subtracts base +1 so effective74 is -603 (not -602)
    const pois = stepMonsterEvent3HpRegen113c({
      hp0: 920,
      maxHp256: 2304,
      baseRegen256: 1,
      modRegen256: -603,
      hasLifeMaskState: true,
      hasPreventHeal: false,
      inTown: false,
    })
    expect(pois).toEqual({
      hp1: 317,
      effectiveRegen256: -603,
      calledSetStat: true,
      changed: true,
      reschedule: true,
      clampedToMax: false,
      killed: false,
    })

    // Prevent Monster Heal (state 52) with no negative DoT: #10372 zeroes baseRegen, #10871(52) exits without reschedule
    const pmhOnly = stepMonsterEvent3HpRegen113c({
      hp0: 1282,
      maxHp256: 2304,
      baseRegen256: 10,
      modRegen256: 0,
      hasLifeMaskState: true,
      hasPreventHeal: true,
      inTown: false,
    })
    expect(pmhOnly.changed).toBe(false)
    expect(pmhOnly.calledSetStat).toBe(false)
    expect(pmhOnly.reschedule).toBe(false)

    // Prevent Monster Heal (state 52) + Poison (-603): negative ebx < 0 still ticks!
    const pmhAndPois = stepMonsterEvent3HpRegen113c({
      hp0: 920,
      maxHp256: 2304,
      baseRegen256: 10,
      modRegen256: -603,
      hasLifeMaskState: true,
      hasPreventHeal: true,
      inTown: false,
    })
    expect(pmhAndPois.hp1).toBe(317)
    expect(pmhAndPois.changed).toBe(true)
    expect(pmhAndPois.reschedule).toBe(true)
  })

  it('distinguishes wilderness fractional survival (1..255 alive, <1 -> 0 death) vs town <0x100 survival (#10057)', () => {
    // Sub-integer HP (97/256 < 1 whole HP) survives in Event 3 (`cmp edi, 1` at 0x6FC9683D)
    const subIntAlive = stepMonsterEvent3HpRegen113c({
      hp0: 700,
      maxHp256: 2304,
      baseRegen256: 1,
      modRegen256: -603,
      hasLifeMaskState: true,
      hasPreventHeal: false,
      inTown: false,
    })
    expect(subIntAlive.hp1).toBe(97)
    expect(subIntAlive.killed).toBe(false)

    // Next wilderness tick: 97 - 603 = -506 < 1 -> clamped to 0 and killed (`test edi, edi` at 0x6FC968BD)
    const wildKill = stepMonsterEvent3HpRegen113c({
      hp0: 97,
      maxHp256: 2304,
      baseRegen256: 1,
      modRegen256: -603,
      hasLifeMaskState: true,
      hasPreventHeal: false,
      inTown: false,
    })
    expect(wildKill.hp1).toBe(0)
    expect(wildKill.killed).toBe(true)
    expect(wildKill.changed).toBe(true)

    // In town (`#10057` != 0) with `hp0 < 0x100` (97 < 256): skips SetUnitStat and survives (`0x6FC967EC..0x6FC9680A`)
    const townSurvive = stepMonsterEvent3HpRegen113c({
      hp0: 97,
      maxHp256: 2304,
      baseRegen256: 0,
      modRegen256: -603,
      hasLifeMaskState: true,
      hasPreventHeal: false,
      inTown: true,
    })
    expect(townSurvive).toEqual({
      hp1: 97,
      effectiveRegen256: -603,
      calledSetStat: false,
      changed: false,
      reschedule: true,
      clampedToMax: false,
      killed: false,
    })

    // Clamping above maxHp256 deletes Event 3 (`reschedule: false` at 0x6FC96814..0x6FC9683B)
    const maxClamp = stepMonsterEvent3HpRegen113c({
      hp0: 2300,
      maxHp256: 2304,
      baseRegen256: 10,
      modRegen256: 0,
      hasLifeMaskState: false,
      hasPreventHeal: false,
      inTown: false,
    })
    expect(maxClamp.hp1).toBe(2304)
    expect(maxClamp.clampedToMax).toBe(true)
    expect(maxClamp.reschedule).toBe(false)
  })

  it('clamps player negative hpregen to 0x100 (1 HP) and clears state 100 above maxHp (0x6FC97CB0)', () => {
    expect(
      stepPlayerUpdateHpRegen113c({ hp0: 5000, maxHp256: 10000, hpRegen256: 0 }),
    ).toEqual({ hp1: 5000, calledSetStat: false, changed: false, clearHealthPot: false })

    expect(
      stepPlayerUpdateHpRegen113c({ hp0: 400, maxHp256: 10000, hpRegen256: -300 }),
    ).toEqual({ hp1: 256, calledSetStat: true, changed: true, clearHealthPot: false })

    // Already at 256 under negative poison: SetUnitStat(pPlayer, 6, 256, 0) called, but hp1 == hp0 -> changed: false
    expect(
      stepPlayerUpdateHpRegen113c({ hp0: 256, maxHp256: 10000, hpRegen256: -300 }),
    ).toEqual({ hp1: 256, calledSetStat: true, changed: false, clearHealthPot: false })

    expect(
      stepPlayerUpdateHpRegen113c({ hp0: 9950, maxHp256: 10000, hpRegen256: 100 }),
    ).toEqual({ hp1: 10000, calledSetStat: true, changed: true, clearHealthPot: true })

    // Observer records only non-zero HP deltas
    const seen: DotTraceEvent113c[] = []
    setDotTraceObserver113c((ev) => seen.push(ev))
    try {
      emitDotTraceEvent113c({ unitType: 0, unitId: 1, hp0: 256, hp1: 256 })
      emitDotTraceEvent113c({ unitType: 0, unitId: 1, hp0: 400, hp1: 256 })
      emitDotTraceEvent113c({ unitType: 1, unitId: 9, hp0: 920, hp1: 317 })
    } finally {
      setDotTraceObserver113c(null)
    }
    expect(seen).toEqual([
      { unitType: 0, unitId: 1, hp0: 400, hp1: 256 },
      { unitType: 1, unitId: 9, hp0: 920, hp1: 317 },
    ])
  })
})
