/**
 * 1.13c `SUNITDMG` helpers for a monster melee swing that lands on a PLAYER defender
 * (`kb/combat/d2game-sunitdmg-player-defender-113c.md`).
 *
 * - `monsterFillPacketPhysRange113c`: `SUNITDMG_FillPacket` (`D2Game.dll` `0x6FCFC530`) no-weapon branch.
 * - `monStatsCritPct113c`: `MonStats.txt` `crit` byte read by `0x6FC970E0`.
 * - `rollPlayerDefenderArmorDurability113c`: defender branch of `SUNITDMG_ItemDurability` (`0x6FCFEBA0`) and
 *   `ITEMS_DamageDurability` (`0x6FC32EE0`) — the three player-seed draws that follow a landed hit.
 */

import type { D2SeedStrc } from '../../../common/rng/d2-rng.ts'
import { itemTypeIsA } from '../../../common/items/item-types.ts'
import { MONSTATS_113C_ROWS } from '../../../common/units/monstats-113c-data.ts'
import { decodeCtcParam113c } from '../../skills/passives-procs-113c.ts'
import {
  computeRawDamagePipe113c,
  mulDiv113c,
  type SUnitDmgTraceEvent113c,
} from '../combat-pipeline.ts'
import { FIXED_ONE } from '../stat-list.ts'
import { collectItemStats, getBaseSizeTable } from './constants-and-helpers.ts'
import type { ServerItemEntry } from './types.ts'
import { rollLimitedSeed113c } from './unit-seeds-113c.ts'

/**
 * `SUNITDMG_FillPacket` (`0x6FCFC530`) for an attacker without a weapon (`0x6FCFC5A2..0x6FCFC5F8`):
 * `min = STAT_MINDAMAGE (21)` (`<= 0 -> 1`), `max = STAT_MAXDAMAGE (22)` (`<= 1 -> 2`), both `<< 8`, plus
 * `item_normaldamage (111) << 8`; `min < 1 -> 0x100`; `max <= min -> min + 0x100`.
 * `min`/`max` are the monster's current mode damage (A1 / A2 / S1 MonStats columns, MonLvl-scaled).
 */
export function monsterFillPacketPhysRange113c(
  statMinDamage: number,
  statMaxDamage: number,
  itemNormalDamage: number,
): { readonly min256: number; readonly max256: number } {
  const min = Math.trunc(statMinDamage) <= 0 ? 1 : Math.trunc(statMinDamage)
  const max = Math.trunc(statMaxDamage) <= 1 ? 2 : Math.trunc(statMaxDamage)
  const normal256 = Math.trunc(itemNormalDamage) * FIXED_ONE
  let min256 = min * FIXED_ONE + normal256
  let max256 = max * FIXED_ONE + normal256
  if (min256 < 1) min256 = 0x100
  if (max256 <= min256) max256 = min256 + 0x100
  return { min256, max256 }
}

/** `MonStats.txt` `crit` (`pMonStatsTxt + 0xA6`, read by `0x6FC9712A`). Throws on an unknown class. */
export function monStatsCritPct113c(hcIdx: number): number {
  const row = MONSTATS_113C_ROWS[hcIdx]
  if (row === undefined || row.hcIdx !== hcIdx) {
    throw new Error(`monStatsCritPct113c: no MonStats row for hcIdx ${hcIdx}`)
  }
  const crit = (row as { crit?: unknown }).crit
  if (typeof crit !== 'number') {
    throw new Error(`monStatsCritPct113c: MonStats row ${hcIdx} has no crit column`)
  }
  return crit
}

/**
 * `D2Game.dll` `0x6FD2E628` / `0x6FD2E62C` table used by `0x6FCFEBA0`: 7 body locations and their weights
 * (head 3, torso 5, right arm 4, left arm 4, belt 2, feet 2, gloves 2).
 */
export const ARMOR_DURABILITY_BODYLOC_WEIGHTS_113C: readonly (readonly [bodyLoc: number, weight: number])[] = [
  [1, 3],
  [3, 5],
  [4, 4],
  [5, 4],
  [8, 2],
  [9, 2],
  [10, 2],
]

/** `ITEMS_HasDurability` (`D2Common #10865` `0x6FD76D40`). Armor rows never set `nodurability`. */
function itemHasDurability113c(item: ServerItemEntry): boolean {
  const base = getBaseSizeTable().get(item.code.trim())
  if (base === undefined) {
    throw new Error(`itemHasDurability113c: unknown item code ${item.code}`)
  }
  if (base.maxDurability <= 0) return false
  if (item.maxDurability <= 0) return false
  return !collectItemStats(item).some((s) => s.statId === 152 && s.value > 0)
}

function itemIsArmor113c(item: ServerItemEntry): boolean {
  const base = getBaseSizeTable().get(item.code.trim())
  if (base === undefined) {
    throw new Error(`itemIsArmor113c: unknown item code ${item.code}`)
  }
  return itemTypeIsA(base.itemType, 'armo')
}

/**
 * Defender branch of `SUNITDMG_ItemDurability` (`0x6FCFEBD7..0x6FCFED15`), called from
 * `SUNITDMG_ExecuteCombat` (`0x6FCFEE2B`) after a landed (`wResultFlags & 1`) hit on a player:
 *
 * 1. For each of the 7 body locations, take the equipped item if it is `armo` (`#10744(item, 0x32)`);
 *    `sum` = total weight of those slots. `sum == 0` -> no draw.
 * 2. `start = RAND(&pDefender->pSeed, 7)`, `r = RAND(&pDefender->pSeed, sum)`; walk the slots from `start`
 *    (wrapping), subtracting the weight of present slots until `r < weight` -> that item.
 * 3. `ITEMS_DamageDurability` (`0x6FC32EE0`): if the item has durability (`#10865`) roll
 *    `pDefender->pSeed % 100 < 10` (armor threshold `0x6FC32F35`) -> durability `- 1` (`STAT 72`).
 *
 * Returns the number of player-seed draws taken (0, 2 or 3).
 */
export function rollPlayerDefenderArmorDurability113c(
  seed: D2SeedStrc,
  equippedActive: readonly ServerItemEntry[],
): number {
  const table = ARMOR_DURABILITY_BODYLOC_WEIGHTS_113C
  const slots: (ServerItemEntry | undefined)[] = []
  let sum = 0
  for (const [bodyLoc, weight] of table) {
    const item = equippedActive.find((i) => i.bodyLoc === bodyLoc)
    const armor = item !== undefined && itemIsArmor113c(item) ? item : undefined
    slots.push(armor)
    if (armor !== undefined) sum += weight
  }
  if (sum <= 0) return 0
  let idx = rollLimitedSeed113c(seed, table.length)
  let r = rollLimitedSeed113c(seed, sum)
  let picked: ServerItemEntry | undefined
  for (;;) {
    const item = slots[idx]
    if (item !== undefined) {
      const weight = table[idx]![1]
      if (r < weight) {
        picked = item
        break
      }
      r -= weight
    }
    idx = (idx + 1) % table.length
    if (r < 0) break
  }
  if (picked === undefined || !itemHasDurability113c(picked)) return 2
  if (rollLimitedSeed113c(seed, 100) < 10) {
    const nextDur = Math.max(0, picked.durability - 1)
    picked.durability = nextDur
    picked.stats.set(72, nextDur)
    if (picked.rawItemData !== undefined) {
      ;(picked.rawItemData as { durability?: number }).durability = nextDur
    }
  }
  return 3
}

/**
 * `ITEMEVENTS_Fn13_DamageToMana` (`D2Game.dll` `0x6FCCCDA0`, `kb/combat/d2game-item-defense-absorb-thorns-ctc-113c.md` §3.2):
 * Requires `dwDmgTotal > 0`, `stat 114 > 0`, and `curMana256 < maxMana256`.
 * Adds `mulDiv113c(dtmPct, dwDmgTotal, 100)` to `STAT_MANA (8)` clamped at `maxMana256`.
 */
export function computeDamageToManaGain256_113c(
  signedTotalDmg256: number,
  dtmPct: number,
  curMana256: number,
  maxMana256: number,
): { readonly gain256: number; readonly nextMana256: number } {
  const dmg = signedTotalDmg256 | 0
  const pct = dtmPct | 0
  const cur = curMana256 | 0
  const max = maxMana256 | 0
  if (dmg <= 0 || pct <= 0 || cur >= max) {
    return { gain256: 0, nextMana256: cur }
  }
  const rawGain256 = mulDiv113c(pct, dmg, 100)
  if (rawGain256 <= 0) {
    return { gain256: 0, nextMana256: cur }
  }
  const nextMana256 = cur + rawGain256 > max ? max : (cur + rawGain256) | 0
  return { gain256: (nextMana256 - cur) | 0, nextMana256 }
}

/**
 * `SUNITDMG_ApplyDamageLife` (`D2Game.dll` `0x6FCFE200..0x6FCFE269`, `kb/combat/d2game-item-defense-absorb-thorns-ctc-113c.md` §1):
 * 1. `0x6FCFE20C`: clamps `pDmg->dwPhysDamage = min(signedPhys256, hpBefore256)` BEFORE absorb heal (used by leech & `0x6FCB8A70` `thorns_percent`).
 * 2. `0x6FCFE23D` (`SUNITDMG_AddLife` `0x6FCFB570`): heals `STAT_HITPOINTS (6)` by `dwAbsorbLife` (`> 0`, `!death_delay`) clamped at `maxHp256`.
 * 3. `0x6FCFE242..0x6FCFE264`: if `signedTotalInstant256 > 0`, subtracts it from `STAT_HITPOINTS (6)`, clamping `< 0x100` to `0`.
 */
export function computePreDamageAbsorbAndLife113c(params: {
  readonly hpBefore256: number
  readonly maxHp256: number
  readonly signedPhys256: number
  readonly signedTotalInstant256: number
  readonly absorbHeal256: number
  readonly hasDeathDelayState?: boolean | undefined
}): {
  readonly lifeClampedPhys256: number
  readonly hpAfterAbsorb256: number
  readonly hpAfter256: number
  readonly killed: boolean
} {
  const hp0 = params.hpBefore256 | 0
  const maxHp = params.maxHp256 | 0
  const phys = params.signedPhys256 | 0
  const total = params.signedTotalInstant256 | 0
  const absHeal = params.absorbHeal256 | 0
  const lifeClampedPhys256 = phys > hp0 ? hp0 : phys
  let hpAfterAbsorb256 = hp0
  if (absHeal > 0 && hp0 > 0 && !params.hasDeathDelayState) {
    const healed = (hp0 + absHeal) | 0
    hpAfterAbsorb256 = healed > maxHp ? maxHp : healed
  }
  let hpAfter256 = hpAfterAbsorb256
  if (total > 0) {
    const sub = (hpAfterAbsorb256 - total) | 0
    hpAfter256 = sub < FIXED_ONE ? 0 : sub
  }
  return {
    lifeClampedPhys256,
    hpAfterAbsorb256,
    hpAfter256,
    killed: hpAfter256 === 0 && hp0 > 0,
  }
}

/**
 * `SKILLS_AuraEventFunc04_IronMaiden` (`D2Game.dll` `0x6FC6F090`, event `5` `domeleedamage`,
 * `kb/combat/d2game-item-defense-absorb-thorns-ctc-113c.md` §3.2):
 * Reflects `mulDiv113c(effPct, postResPhys256, 100)` using pre-life-clamp `dwPhysDamage` (`>> 2` vs player/hireling).
 */
export function computeIronMaidenReflectRawPhys256_113c(
  postResPhys256: number,
  imPct: number,
  attackerIsPlayerOrHireling = false,
): number {
  const phys = postResPhys256 | 0
  const rawPct = imPct | 0
  if (phys <= 0 || rawPct <= 0) return 0
  const effPct = attackerIsPlayerOrHireling ? rawPct >> 2 : rawPct
  if (effPct <= 0) return 0
  return Math.max(0, mulDiv113c(effPct, phys, 100))
}

/**
 * `SUNITDMG_ApplyThornsPercent` (`D2Game.dll` `0x6FCB8A70`, called at `0x6FCFEE8E` after durability,
 * `kb/combat/d2game-item-defense-absorb-thorns-ctc-113c.md` §3.2):
 * Reflects `mulDiv113c(lifeClampedPhys256, thornsPct, 100)` (`>> 3` vs player/hireling).
 */
export function computeThornsAuraReflectRawPhys256_113c(
  lifeClampedPhys256: number,
  thornsPct: number,
  attackerIsPlayerOrHireling = false,
): number {
  const phys = lifeClampedPhys256 | 0
  const pct = thornsPct | 0
  if (phys <= 0 || pct <= 0) return 0
  const effPct = attackerIsPlayerOrHireling ? (pct + 4) >> 3 : pct
  if (effPct <= 0) return 0
  const refl = mulDiv113c(effPct, phys, 100)
  return refl > 0 ? refl : 0
}

/**
 * `SKILLS_StaticFieldCallback` (`D2Game.dll` `0x6FC62EC0..0x6FC63060`, `kb/combat/d2game-item-defense-absorb-thorns-ctc-113c.md` §4):
 * Computes raw `dwLtngDamage` passed to `0x6FCFE0C0(..., wResultFlags = 0x4001, bCallCalcResist = 1)`,
 * or `null` when the target is skipped (`curHp < 1` or `curHp <= floorHp`).
 */
export function computeStaticFieldTargetLtng256_113c(params: {
  readonly curHp256: number
  readonly maxHp256: number
  readonly staticFieldMinPct: number
  readonly pct?: number | undefined
  readonly minElemDmg256?: number | undefined
  readonly rawTargetLtngRes: number
}): number | null {
  const curHp = (params.curHp256 | 0) >> 8
  if (curHp < 1) return null
  const minPct = params.staticFieldMinPct | 0
  if (minPct !== 0) {
    const floorHp = mulDiv113c(minPct, (params.maxHp256 | 0) >> 8, 100)
    if (curHp <= floorHp) return null
  }
  const pct = (params.pct ?? 25) | 0
  let esi = mulDiv113c(curHp, pct, 100)
  if (curHp - esi < 1) {
    esi = (curHp - 1) | 0
  }
  esi = (esi << 8) | 0
  const minElem256 = (params.minElemDmg256 ?? 0) | 0
  if (esi < minElem256) {
    esi = minElem256
  }
  const ltngRes = params.rawTargetLtngRes | 0
  if (ltngRes < 0) {
    const denom = (100 - ltngRes) | 0
    esi = denom === 0 ? 0 : mulDiv113c(esi, 100, denom)
  }
  return esi
}

/**
 * Secondary `SUNITDMG_ApplyDamageLife` (`D2Game.dll` `0x6FCFE0C0` with `bCallCalcResist = 1` at `0x6FCFE1A0`)
 * for player-to-monster reactive hits (`Iron Maiden` `0x0021`, `ATD` `0x4021`, `ATLD` `0x4021`,
 * `#42 Static Field` `0x4001`, `Thorns` `0x4021`).
 */
export function resolveSecondaryMonsterSUnitDmg113c(params: {
  readonly playerUnitId: number
  readonly monsterUnitId: number
  readonly monsterHpBefore256: number
  readonly monsterMaxHp256: number
  readonly resultFlags: number
  readonly rawPhys256?: number | undefined
  readonly rawLtng256?: number | undefined
  readonly monsterDr?: number | undefined
  readonly monsterMdr?: number | undefined
  readonly monsterPhysRes: number
  readonly monsterLtngRes: number
  readonly monsterLtngAbsPct?: number | undefined
  readonly monsterLtngAbsFlat?: number | undefined
  readonly casterLtngPierce?: number | undefined
}): {
  readonly traceEvent: SUnitDmgTraceEvent113c
  readonly dealt256: number
  readonly monsterHpAfter256: number
  readonly killed: boolean
} {
  const pipe = computeRawDamagePipe113c({
    defenderIsPlayer: false,
    phys256: (params.rawPhys256 ?? 0) | 0,
    elem256: (params.rawLtng256 ?? 0) | 0,
    rate54: 0,
    dr: (params.monsterDr ?? 0) | 0,
    mdr: (params.monsterMdr ?? 0) | 0,
    physRes: params.monsterPhysRes | 0,
    elemResStatId: 41,
    elemMaxStatId: 42,
    elemPierceStatId: 334,
    res: params.monsterLtngRes | 0,
    maxRes: 0,
    absPct: (params.monsterLtngAbsPct ?? 0) | 0,
    absFlat: (params.monsterLtngAbsFlat ?? 0) | 0,
    pierce: (params.casterLtngPierce ?? 0) | 0,
    penalty: 0,
  })
  const hp0 = params.monsterHpBefore256 | 0
  const ret = pipe.totalDamage256 | 0
  const traceEvent: SUnitDmgTraceEvent113c = {
    att: [0, params.playerUnitId],
    def: [1, params.monsterUnitId],
    hp: [hp0 >>> 0, hp0 >>> 0],
    ret,
    raw: [
      0,
      params.resultFlags >>> 0,
      pipe.physDamage256 >>> 0,
      0,
      0,
      0,
      0,
      pipe.elemDamage256 >>> 0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ],
  }
  const lifeOut = computePreDamageAbsorbAndLife113c({
    hpBefore256: hp0,
    maxHp256: params.monsterMaxHp256 | 0,
    signedPhys256: pipe.physDamage256,
    signedTotalInstant256: ret,
    absorbHeal256: pipe.absorb256,
  })
  return {
    traceEvent,
    dealt256: ret > 0 ? ret : 0,
    monsterHpAfter256: lifeOut.hpAfter256,
    killed: lifeOut.killed,
  }
}

export type DefenderItemEventStatId113c = 78 | 114 | 128 | 201

export interface DefenderItemEventNode113c {
  readonly statId: DefenderItemEventStatId113c
  readonly layer: number
  /** Bit `1 << 1` (`0x02`) = `damagedinmelee` (`event 1`), bit `1 << 2` (`0x04`) = `damagedbymissile` (`event 2`). */
  readonly eventMask: number
}

/**
 * Simulates `D2Game.dll` `0x6FC6FE80` -> `0x6FC57110` (`ITEMEVENTS_RegisterStat`) across active equipped items:
 * - Each item's defensive event stats (`78 ATD`, `114 DamageToMana`, `128 ATLD`, `201 CtC When Struck`) are
 *   iterated in ascending `(statId, layer)` StatList order.
 * - Distinct `(statId, layer)` nodes are prepended to the head of `pItemEventList` (**LIFO** order);
 *   duplicate `(statId, layer)` entries reuse the existing node (`0x6FC5713B`) while summing `stat 201` chance.
 */
export function collectPlayerDefenderItemEventsLifo113c(
  items: readonly ServerItemEntry[],
): {
  readonly nodes: readonly DefenderItemEventNode113c[]
  readonly ctcChanceByLayer: ReadonlyMap<number, { readonly skillId: number; readonly slvl: number; readonly chance: number }>
} {
  const nodes: DefenderItemEventNode113c[] = []
  const ctcChanceByLayer = new Map<number, { readonly skillId: number; readonly slvl: number; readonly chance: number }>()
  for (const item of items) {
    if (item.location !== 'equipped' || item.bodyLoc === 11 || item.bodyLoc === 12) continue
    if (item.identified === false || item.rawItemData?.identified === false) continue
    const broken =
      item.rawItemData?.broken === true ||
      (item.maxDurability > 0 && item.durability <= 0 && (item.stats.get(152) ?? 0) <= 0)
    if (broken) continue
    const rawStats = collectItemStats(item)
      .filter(
        (st) =>
          st.value > 0 &&
          (st.statId === 78 || st.statId === 114 || st.statId === 128 || st.statId === 201),
      )
      .map((st) => ({
        statId: st.statId as DefenderItemEventStatId113c,
        layer: st.statId === 201 ? (st.param ?? 0) >>> 0 : 0,
        value: Math.trunc(st.value),
      }))
      .sort((a, b) => (a.statId !== b.statId ? a.statId - b.statId : a.layer - b.layer))
    for (const st of rawStats) {
      if (st.statId === 201) {
        const { skillId, slvl } = decodeCtcParam113c(st.layer)
        if (skillId <= 0) continue
        const prev = ctcChanceByLayer.get(st.layer)
        ctcChanceByLayer.set(st.layer, {
          skillId,
          slvl,
          chance: (prev?.chance ?? 0) + st.value,
        })
      }
      const eventMask = st.statId === 78 || st.statId === 128 ? 0x02 : 0x06
      const exists = nodes.some((n) => n.statId === st.statId && n.layer === st.layer)
      if (!exists) {
        nodes.unshift({ statId: st.statId, layer: st.layer, eventMask })
      }
    }
  }
  return { nodes, ctcChanceByLayer }
}

/**
 * `ITEMEVENTS_Fn21_CtCWhenStruck` (`D2Game.dll` `0x6FCCDCE0..0x6FCCDD50`):
 * Requires `(resultFlags113c & 0x04) !== 0` and `chance > 0`.
 * Unconditionally consumes `rollLimitedSeed113c(seed, 100)` (`0x6FCCDD45`), even when `chance >= 100`.
 */
export function rollPlayerDefenderCtcEntry113c(
  seed: D2SeedStrc,
  resultFlags113c: number,
  chance: number,
): boolean {
  if ((resultFlags113c & 0x04) === 0 || (chance | 0) <= 0) return false
  return rollLimitedSeed113c(seed, 100) < (chance | 0)
}
