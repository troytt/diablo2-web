/**
 * Authoritative Diablo II: Lord of Destruction v1.13c `MonEquip.txt` runtime item roller
 * and combat stat aggregator (`#1898`).
 *
 * Ground truth:
 * - `Patch_D2.mpq` -> `data\global\excel\MonEquip.txt` (`src/common/data/mon-equip-113c.ts`)
 * - `D2Game.dll` `D2GAME_CreateMonsterEquipment` (`0x6FCB2ED0`) & `D2GAME_EquipMonsterItem` (`0x6FCCFCE0`):
 *   - World monsters (`oninit = 1`, `nLevel = mlvl`, `ilvl = mlvl`):
 *     - `#267 bloodraven`: Rare Short Bow (`sbw`, `rarm`)
 *     - `#234 flyingscimitar`: Rare Scimitar (`scm`, `rarm`; dropped on monster death!)
 *   - Summoned pets (`oninit = 0`, `nLevel = slvl`):
 *     - `#357 valkyrie` (`#32 Valkyrie`, `ilvl = min(99, 25 + 3 * (slvl - 1))`): full Rare/Magic
 *       loadout scaling up to Rare War Pike (`7p7` @ slvl 17), Rare Sacred Armor (`uar` @ slvl 16),
 *       gloves/boots/belt/amulet/tiara (`slvl 2..27`).
 *     - `#417 shadowwarrior` (`#268 Shadow Warrior`, `ilvl = min(99, 20 + 2 * slvl)`): Magic claws/armor/helm.
 *     - `#418 shadowmaster` (`#279 Shadow Master`, `ilvl = min(99, 20 + 2 * slvl)`): Superior -> Magic -> Rare
 *       Elite claws (`7ar`/`7xf`/`7qr`/`7cs`/`7tw`), armor, helm, gloves, rings, amulet (`slvl 1..17`).
 *   - Pet equipment NEVER drops on pet death (`D2Game.dll` `0x6FC627B0`).
 */

import {
  resolveMonsterEquipment113c,
  type MonEquipBodyLoc,
  type MonsterEquippedItem113c,
} from '../../common/data/mon-equip-113c.ts'
import { executeDropPipeline } from '../../common/items/drop-tables.ts'
import { rolledPropsToItemStats } from '../../common/items/item-bridge.ts'
import type { Item } from '../../common/items/items.ts'
import { Rng } from '../../common/rng/d2-rng.ts'
import type { ItemStat } from '../../netproto/index.ts'
import {
  extractMercenaryStrikeProcs113c,
  type MercenaryCtcProcSpec113c,
} from './mercenary-ai.ts'

export interface RolledMonsterEquipmentSlot113c {
  readonly spec: MonsterEquippedItem113c
  readonly item: Item
  readonly itemStats: readonly ItemStat[]
}

export interface RolledMonsterLoadout113c {
  readonly equippedSpecs: readonly MonsterEquippedItem113c[]
  readonly slots: readonly RolledMonsterEquipmentSlot113c[]
  readonly allItemStats: readonly ItemStat[]
  readonly ctcProcs: readonly MercenaryCtcProcSpec113c[]
  readonly primaryWeaponCode: string | undefined
  readonly offhandWeaponCode: string | undefined
  readonly torsoArmorCode: string | undefined
  readonly helmArmorCode: string | undefined
  readonly weaponMinDamage: number
  readonly weaponMaxDamage: number
  readonly offWeapDamagePct: number
  readonly flatAttackRating: number
  readonly attackRatingPct: number
  readonly defenseBonus: number
  readonly maxHpBonus: number
  readonly strBonus: number
  readonly dexBonus: number
  readonly iasPct: number
  readonly fhrPct: number
  readonly resistFire: number
  readonly resistLightning: number
  readonly resistCold: number
  readonly resistPoison: number
  readonly resistMagic: number
  readonly crushingBlowPct: number
  readonly deadlyStrikePct: number
  readonly openWoundsPct: number
  readonly lifeStealPct: number
  readonly knockback: boolean
  readonly fireMinDamage: number
  readonly fireMaxDamage: number
  readonly ltngMinDamage: number
  readonly ltngMaxDamage: number
  readonly magicMinDamage: number
  readonly magicMaxDamage: number
  readonly coldMinDamage: number
  readonly coldMaxDamage: number
  readonly coldLengthFrames: number
  readonly poisMinDamage: number
  readonly poisMaxDamage: number
  readonly poisLengthFrames: number
}

export interface RollMonsterOrPetLoadoutOptions113c {
  readonly monster: string
  readonly level: number
  readonly ilvl: number
  readonly onInitOnly?: boolean | undefined
  readonly seed?: number | undefined
  readonly ownerEquippedBaseCodes?: Readonly<Partial<Record<MonEquipBodyLoc, string>>> | undefined
}

function resolveRawWeaponDamageBand113c(base: Item['base']): { readonly min: number; readonly max: number } {
  const wb = base as Item['base'] & {
    readonly mindam?: number
    readonly maxdam?: number
    readonly twoHandedMindam?: number
    readonly twoHandedMaxdam?: number
    readonly minMisDam?: number
    readonly maxMisDam?: number
    readonly twoHanded?: boolean
    readonly oneOrTwoHanded?: boolean
  }
  if (
    wb.twoHanded &&
    !wb.oneOrTwoHanded &&
    typeof wb.twoHandedMindam === 'number' &&
    typeof wb.twoHandedMaxdam === 'number' &&
    wb.twoHandedMaxdam > 0
  ) {
    return { min: wb.twoHandedMindam, max: wb.twoHandedMaxdam }
  }
  if (typeof wb.mindam === 'number' && typeof wb.maxdam === 'number' && wb.maxdam > 0) {
    return { min: wb.mindam, max: wb.maxdam }
  }
  if (typeof wb.minMisDam === 'number' && typeof wb.maxMisDam === 'number' && wb.maxMisDam > 0) {
    return { min: wb.minMisDam, max: wb.maxMisDam }
  }
  if (base.damage > 0) {
    return {
      min: Math.max(1, Math.floor(base.damage * 0.7)),
      max: Math.max(2, Math.ceil(base.damage * 1.3)),
    }
  }
  return { min: 0, max: 0 }
}

/**
 * Rolls concrete `Item` instances and aggregates combat stats + CtC strike procs for any
 * `MonEquip.txt` monster or pet (`#1898`).
 */
export function rollMonsterOrPetLoadout113c(
  options: RollMonsterOrPetLoadoutOptions113c,
): RolledMonsterLoadout113c {
  const baseSeed = ((options.seed ?? 0x9e3779b9) >>> 0) || 0x9e3779b9
  const equipRng = new Rng(baseSeed)
  const equippedSpecs = resolveMonsterEquipment113c({
    monster: options.monster,
    level: options.level,
    ilvl: options.ilvl,
    onInitOnly: options.onInitOnly,
    rng: () => equipRng.int(0, 0xffff) / 0x10000,
    ownerEquippedBaseCodes: options.ownerEquippedBaseCodes,
  })

  const slots: RolledMonsterEquipmentSlot113c[] = []
  const allItemStats: ItemStat[] = []

  let primaryWeaponCode: string | undefined
  let offhandWeaponCode: string | undefined
  let torsoArmorCode: string | undefined
  let helmArmorCode: string | undefined

  let mainWeapMin = 0
  let mainWeapMax = 0
  let offWeapMin = 0
  let offWeapMax = 0
  let hasMainWeap = false
  let hasOffWeap = false

  let offWeapDamagePct = 0
  let flatMinAll = 0
  let flatMaxAll = 0
  let flatAttackRating = 0
  let attackRatingPct = 0
  let defenseBonus = 0
  let maxHpBonus = 0
  let strBonus = 0
  let dexBonus = 0
  let iasPct = 0
  let fhrPct = 0
  let resistFire = 0
  let resistLightning = 0
  let resistCold = 0
  let resistPoison = 0
  let resistMagic = 0
  let crushingBlowPct = 0
  let deadlyStrikePct = 0
  let openWoundsPct = 0
  let lifeStealPct = 0
  let knockback = false
  let fireMinDamage = 0
  let fireMaxDamage = 0
  let ltngMinDamage = 0
  let ltngMaxDamage = 0
  let magicMinDamage = 0
  let magicMaxDamage = 0
  let coldMinDamage = 0
  let coldMaxDamage = 0
  let coldLengthFrames = 0
  let poisMinDamage = 0
  let poisMaxDamage = 0
  let poisLengthFrames = 0

  for (let idx = 0; idx < equippedSpecs.length; idx += 1) {
    const spec = equippedSpecs[idx]!
    const itemSeed = (Math.imul(baseSeed ^ (idx + 1), 0x85ebca6b) ^ (spec.locId * 0xc2b2ae35)) >>> 0 || 1
    const dropped = executeDropPipeline({
      tcName: spec.itemCode,
      mlvl: spec.ilvl,
      difficulty: 'normal',
      forcedQuality: spec.quality,
      forbidEthereal: true,
      seed: itemSeed,
    })
    const item = dropped[0]
    if (!item) continue

    const itemStats: ItemStat[] = []
    for (const s of rolledPropsToItemStats(item.rolledProps)) {
      const statId = s.statId ?? s.id
      if (typeof statId === 'number') {
        itemStats.push({ statId, param: s.param ?? 0, value: s.value })
      }
    }
    slots.push({ spec, item, itemStats })
    allItemStats.push(...itemStats)

    if (spec.slot === 'rarm') primaryWeaponCode = item.base.id
    else if (spec.slot === 'larm' && item.base.kind === 'weapon') offhandWeaponCode = item.base.id
    else if (spec.slot === 'tors') torsoArmorCode = item.base.id
    else if (spec.slot === 'head') helmArmorCode = item.base.id

    const isWeaponSlot = item.base.kind === 'weapon' && (spec.slot === 'rarm' || spec.slot === 'larm')
    let localWeapEdPct = 0
    let localFlatMin = 0
    let localFlatMax = 0
    let localAcPct = 0
    let localFlatAc = 0

    for (const st of itemStats) {
      switch (st.statId) {
        case 0:
          strBonus += st.value
          break
        case 2:
          dexBonus += st.value
          break
        case 3:
          // Vitality -> +2 HP per vit on pet/monster
          maxHpBonus += st.value * 2
          break
        case 7:
          maxHpBonus += st.value >= 256 ? Math.floor(st.value / 256) : st.value
          break
        case 16:
          localAcPct += st.value
          break
        case 17:
        case 18:
          if (st.statId === 17) {
            if (isWeaponSlot) localWeapEdPct += st.value
            else offWeapDamagePct += st.value
          }
          break
        case 19:
          flatAttackRating += st.value
          break
        case 21:
        case 23:
          if (isWeaponSlot) localFlatMin += st.value
          else flatMinAll += st.value
          break
        case 22:
        case 24:
          if (isWeaponSlot) localFlatMax += st.value
          else flatMaxAll += st.value
          break
        case 31:
          localFlatAc += st.value
          break
        case 37:
          resistMagic += st.value
          break
        case 39:
          resistFire += st.value
          break
        case 41:
          resistLightning += st.value
          break
        case 43:
          resistCold += st.value
          break
        case 45:
          resistPoison += st.value
          break
        case 48:
          fireMinDamage += st.value
          break
        case 49:
          fireMaxDamage += st.value
          break
        case 50:
          ltngMinDamage += st.value
          break
        case 51:
          ltngMaxDamage += st.value
          break
        case 52:
          magicMinDamage += st.value
          break
        case 53:
          magicMaxDamage += st.value
          break
        case 54:
          coldMinDamage += st.value
          break
        case 55:
          coldMaxDamage += st.value
          break
        case 56:
          coldLengthFrames += st.value
          break
        case 57:
          poisMinDamage += st.value
          break
        case 58:
          poisMaxDamage += st.value
          break
        case 59:
          poisLengthFrames = Math.max(poisLengthFrames, st.value)
          break
        case 60:
          lifeStealPct += st.value
          break
        case 81:
          if (st.value > 0) knockback = true
          break
        case 93:
          iasPct += st.value
          break
        case 99:
          fhrPct += st.value
          break
        case 119:
          attackRatingPct += st.value
          break
        case 135:
          openWoundsPct += st.value
          break
        case 136:
          crushingBlowPct += st.value
          break
        case 141:
          deadlyStrikePct += st.value
          break
      }
    }

    if (isWeaponSlot) {
      const band = resolveRawWeaponDamageBand113c(item.base)
      const enhancedMin = Math.max(1, Math.floor((band.min * (100 + localWeapEdPct)) / 100) + localFlatMin)
      const enhancedMax = Math.max(
        enhancedMin,
        Math.floor((band.max * (100 + localWeapEdPct)) / 100) + localFlatMax,
      )
      if (spec.slot === 'rarm') {
        mainWeapMin = enhancedMin
        mainWeapMax = enhancedMax
        hasMainWeap = true
      } else {
        offWeapMin = enhancedMin
        offWeapMax = enhancedMax
        hasOffWeap = true
      }
    }

    if (item.base.kind === 'armor') {
      const rawAc = Math.max(0, item.stats.defense ?? item.base.defense ?? 0)
      const baseWithPct =
        localAcPct > 0 ? Math.floor(((rawAc + 1) * (100 + localAcPct)) / 100) : rawAc
      defenseBonus += baseWithPct + localFlatAc
    } else if (localFlatAc > 0) {
      defenseBonus += localFlatAc
    }
  }

  let weaponMinDamage = 0
  let weaponMaxDamage = 0
  if (hasMainWeap && hasOffWeap) {
    weaponMinDamage = Math.floor((mainWeapMin + offWeapMin) / 2) + flatMinAll
    weaponMaxDamage = Math.max(
      weaponMinDamage,
      Math.floor((mainWeapMax + offWeapMax) / 2) + flatMaxAll,
    )
  } else if (hasMainWeap) {
    weaponMinDamage = mainWeapMin + flatMinAll
    weaponMaxDamage = Math.max(weaponMinDamage, mainWeapMax + flatMaxAll)
  } else if (hasOffWeap) {
    weaponMinDamage = offWeapMin + flatMinAll
    weaponMaxDamage = Math.max(weaponMinDamage, offWeapMax + flatMaxAll)
  }

  const ctcProcs = extractMercenaryStrikeProcs113c(allItemStats)

  return {
    equippedSpecs,
    slots,
    allItemStats,
    ctcProcs,
    primaryWeaponCode,
    offhandWeaponCode,
    torsoArmorCode,
    helmArmorCode,
    weaponMinDamage,
    weaponMaxDamage,
    offWeapDamagePct,
    flatAttackRating,
    attackRatingPct,
    defenseBonus,
    maxHpBonus,
    strBonus,
    dexBonus,
    iasPct,
    fhrPct,
    resistFire,
    resistLightning,
    resistCold,
    resistPoison,
    resistMagic,
    crushingBlowPct,
    deadlyStrikePct,
    openWoundsPct,
    lifeStealPct,
    knockback,
    fireMinDamage,
    fireMaxDamage,
    ltngMinDamage,
    ltngMaxDamage,
    magicMinDamage,
    magicMaxDamage,
    coldMinDamage,
    coldMaxDamage,
    coldLengthFrames,
    poisMinDamage,
    poisMaxDamage,
    poisLengthFrames,
  }
}

/**
 * Computes canonical 1.13c `MonEquip` `ilvl` for Valkyrie (`#32`) and Shadow Warrior/Master (`#268`/`#279`):
 * - Valkyrie (`D2Game.dll` `0x6FC7004C`): `ilvl = min(99, 25 + 3 * (slvl - 1))`
 * - Shadow Warrior / Shadow Master (`D2Game.dll` `0x6FCB5ADD`): `ilvl = min(99, 20 + 2 * slvl)`
 */
export function computeSummonMonEquipIlvl113c(
  petKind: 'valkyrie' | 'shadow_warrior' | 'shadow_master',
  slvl: number,
): number {
  const s = Math.max(1, Math.floor(slvl))
  if (petKind === 'valkyrie') {
    return Math.max(1, Math.min(99, 25 + 3 * (s - 1)))
  }
  return Math.max(1, Math.min(99, 20 + 2 * s))
}
