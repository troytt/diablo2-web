/**
 * Diablo II: Lord of Destruction v1.13c `SUMMON_CreatePet` Unit Manager (`SummonManager`).
 *
 * Implements:
 * - `PetType.txt` group exclusivity (`group=1` Druid Spirit Wolf / Dire Wolf / Grizzly;
 *   `golem` `idx=3` Clay/Blood/Iron/Fire Golem; `spirit` `idx=11` Oak/Wolverine/Barbs;
 *   `vine` `idx=12` Poison/Carrion/Solar Vine; `shadowwarrior` `group=4` Shadow Warrior/Master).
 * - `assassintrap` (`idx=17`) 5-trap cap with FIFO eviction when a 6th trap is laid.
 * - Dynamic `petmax` formula evaluation (`Raise Skeleton`, `Raise Skeletal Mage`, `Revive`,
 *   `Raven`, `Summon Spirit Wolf`, `Summon Fenris`, `Hydra`).
 * - Corpse consumption requirement for `Raise Skeleton` (`70`), `Raise Skeletal Mage` (`80`),
 *   and `Revive` (`95`).
 * - Execution of all 17 summoned pet & trap AI sub-skills (`IDs 281..338`).
 */
import type { D2DataRegistry } from '../../common/data/data-registry.ts'
import { evaluateCalc } from '../../common/data/calc-ast.ts'
import { MONSTATS2FLAG_REVIVE, getMonsterPathRecord } from '../../common/path/units.ts'
import { getCanonicalMonsterKinds, getMonsterKindByHcIdx } from '../../common/units/monsters-data.ts'
import { FIXED_ONE, UnitStatList } from '../engine/stat-list.ts'
import { StateBus } from '../engine/state-bus.ts'
import { executeSUnitDmg, rollDamageRange256, type CombatUnitContext } from '../engine/combat-pipeline.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import type { MissileEngine } from '../engine/missile-engine.ts'
import type { AuraScanner } from '../engine/aura-scanner.ts'
import { calcSentrySubSkillDamage113c } from '../skills/assassin-traps.ts'
import {
  calculateSummonResistPct,
  calculateSkeletonMasteryStats,
  calculateGolemMasteryStats,
  calculateClayGolemStats,
  calculateBloodGolemStats,
  calculateIronGolemStats,
  calculateFireGolemStats,
  calculateReviveStats,
  calculateRaiseSkeletonStats,
  calculateSkeletalMageStats,
  calculateNecromageMissileDamage,
  calculateBoneWallStats,
  calculateBonePrisonStats,
  ISO_GROUND_ASPECT_RATIO,
  type IronGolemItemProps,
} from '../engine/missile-engine.ts'
import { isPetTypeUnsummonable113c } from '../../common/units/pet-type-table.ts'
import { DRUID_TRANSFORM_CLT_OVERLAYS_113C } from '../skills/druid-shapeshift.ts'
export { DRUID_TRANSFORM_CLT_OVERLAYS_113C }
import {
  calculateDecoyStats,
  calculateValkyrieStats,
  calculateAvoidStats,
  calculateCriticalStrikeStats,
  calculateDodgeStats,
  calculateEvadeStats,
  calculatePenetrateStats,
  type ValkyrieEquipmentTier,
} from '../../common/skills/amazon-passive.ts'
import type { MonsterEquippedItem113c } from '../../common/data/mon-equip-113c.ts'
import {
  calculateRavenStats,
  calculatePoisonCreeperStats,
  calculateOakSageStats,
  calculateSummonSpiritWolfStats,
  calculateCarrionVineStats,
  calculateHeartOfWolverineStats,
  calculateSummonDireWolfStats,
  calculateSolarCreeperStats,
  calculateSpiritOfBarbsStats,
  calculateSummonGrizzlyStats,
  calculateCorpseCyclerStats,
  calculateFenrisRageStats,
  calculateVineCyclerStats,
  calculateBearSmiteStats,
} from '../skills/druid-summoning.ts'
import {
  computeShadowMaxLife,
  computeShadowMlvl,
  computeShadowMasterResistances,
  computeShadowWarriorResistances,
  generateShadowEquipment,
  getShadowWarriorCastingLevel,
  getShadowMasterCastingLevel,
  type ShadowEquipmentLoadout,
} from '../skills/assassin-shadow.ts'
import {
  resolveMonsterMonProps113c,
  type ResolvedMonsterMonProps113c,
} from './monprop-113c.ts'
import {
  computeSummonMonEquipIlvl113c,
  rollMonsterOrPetLoadout113c,
  type RolledMonsterLoadout113c,
} from './monequip-helper-113c.ts'

export interface SummonedPetUnit {
  readonly uid: string
  readonly id: string
  readonly ownerUnitId: string
  readonly ownerId?: string | number | undefined
  alive?: boolean | undefined
  readonly name: string
  readonly monId: string
  readonly code: string
  readonly petType: string
  readonly petGroup: number
  readonly sourceSkillId: number
  readonly slvl: number
  readonly unsummonable: boolean
  readonly subSkillIds: readonly number[]
  readonly statList: UnitStatList
  readonly stateBus: StateBus
  x: number
  y: number
  hp: number
  maxHp: number
  shotsRemaining: number
  rageBuffActive: boolean
  rageExpireFrame?: number | undefined
  readonly ownerRef?: CombatUnitContext | undefined
  // M4 Necromancer Summoning Properties, M13 Amazon Summon Properties, & M15 Druid Summoning Properties
  kind?:
    | 'skeleton'
    | 'skeleton_mage'
    | 'clay_golem'
    | 'blood_golem'
    | 'iron_golem'
    | 'fire_golem'
    | 'revive'
    | 'bonewall'
    | 'dopplezon'
    | 'valkyrie'
    | 'raven'
    | 'poison_creeper'
    | 'carrion_vine'
    | 'solar_creeper'
    | 'oak_sage'
    | 'heart_of_wolverine'
    | 'spirit_of_barbs'
    | 'spirit_wolf'
    | 'dire_wolf'
    | 'grizzly'
    | 'shadow_warrior'
    | 'shadow_master'
    | 'hydra'
    | 'assassin_trap'
    | undefined
  nextActionFrame?: number | undefined
  classId?: number | undefined
  monsterLevel?: number | undefined
  mlvl?: number | undefined
  baseMinDamage?: number | undefined
  baseMaxDamage?: number | undefined
  minDamage?: number | undefined
  maxDamage?: number | undefined
  mageElement?: 'fire' | 'cold' | 'lightning' | 'poison' | undefined
  lifespanTicks?: number | undefined
  slowPct?: number | undefined
  lifeLink?: {
    lifeLeechPct?: number | undefined
    healCasterPct: number
    healGolemPct?: number | undefined
    shareDamagePct: number
  } | undefined
  thornsReturnPct?: number | undefined
  fireAbsorbPct?: number | undefined
  deathExplosionDmg?: number | undefined
  inheritedAuras?: number[] | undefined
  ironGolemItem?: IronGolemItemProps | undefined
  isStationary?: boolean | undefined
  equipmentTier?: ValkyrieEquipmentTier | undefined
  valkyrieEquipment?: readonly MonsterEquippedItem113c[] | undefined
  shadowEquipment?: ShadowEquipmentLoadout | undefined
  shadowSkills?: ReadonlyMap<number, number> | undefined
  monProps?: ResolvedMonsterMonProps113c | undefined
  monEquipLoadout?: RolledMonsterLoadout113c | undefined
  monEquipSeed?: number | undefined
  hasShield?: boolean | undefined
  snapshottedSkelMasteryLvl?: number | undefined
  snapshottedGolemMasteryLvl?: number | undefined
  targetId?: string | number | undefined
  /** `D2UnitStrc.dwAnimMode` of the pet unit on the DRLG oracle path (`MonMode.txt` index). */
  mode?: number | undefined
  /**
   * DRLG oracle path: the pet runs the 1:1 `NecroPet` port (`necropet-ai-113c.ts`) instead of the
   * generic `tickPets` behaviour; `tickPets` only keeps its lifetime bookkeeping.
   */
  oracleAi113c?:
    | {
        nextAiFrame: number
        ovPathType: number
        ovVelocity: number
        ovNewDist: number
        swing?: { readonly targetUnitId: number; readonly actionFrame: number; readonly endFrame: number; resolved: boolean } | undefined
      }
    | undefined
}

export interface CreatePetOutcome {
  readonly created: boolean
  readonly reason?: 'missing_corpse' | 'invalid_skill' | 'invalid_item'
  readonly pet?: SummonedPetUnit
  readonly evictedPetUids: string[]
  readonly activeCountForType: number
}

export class SummonManager {
  readonly registry: D2DataRegistry
  private readonly pets: SummonedPetUnit[] = []
  private uidCounter = 1
  private readonly rng = new D2Rng(0x53554d4e)

  constructor(registry: D2DataRegistry) {
    this.registry = registry
  }

  private resolveMonStatsFallback(
    idOrHcIdx: string | number,
  ):
    | {
        readonly hcIdx: number
        readonly id: string
        readonly code: string
        readonly maxHP: number
        readonly ac: number
        readonly a1MinD: number
        readonly a1MaxD: number
        readonly a1TH: number
        readonly resDm: number
        readonly resMa: number
        readonly resFi: number
        readonly resLi: number
        readonly resCo: number
        readonly resPo: number
      }
    | undefined {
    const regMon = this.registry?.getMonStats(idOrHcIdx)
    if (regMon) return regMon
    const k =
      typeof idOrHcIdx === 'number'
        ? getMonsterKindByHcIdx(idOrHcIdx)
        : getCanonicalMonsterKinds().get(idOrHcIdx.trim().toLowerCase())
    if (!k) return undefined
    return {
      hcIdx: k.hcIdx ?? 0,
      id: k.id,
      code: k.code,
      maxHP: k.maxHp,
      ac: k.armour,
      a1MinD: k.attack1.minDamage,
      a1MaxD: k.attack1.maxDamage,
      a1TH: k.attack1.toHit,
      resDm: k.resistances.physical,
      resMa: k.resistances.magic,
      resFi: k.resistances.fire,
      resLi: k.resistances.lightning,
      resCo: k.resistances.cold,
      resPo: k.resistances.poison,
    }
  }

  /**
   * Create a summoned pet, trap, totem, or hydra (`SUMMON_CreatePet`).
   */
  createPet(params: {
    owner: CombatUnitContext
    skillId: number
    slvl: number
    /**
     * DRLG oracle path: the Valkyrie's `MonEquip.txt` items are created 1:1 by
     * `initOracleSummonedPet113c` (`monster-item-create-113c.ts`), so the loadout model is not rolled.
     */
    skipMonEquipLoadout113c?: boolean | undefined
    x?: number | undefined
    y?: number | undefined
    difficulty?: 'normal' | 'nightmare' | 'hell' | 0 | 1 | 2 | undefined
    corpses?:
      | {
          id: string
          consumed: boolean
          baseMaxHp?: number | undefined
          classId?: number | undefined
          monId?: string | undefined
          code?: string | undefined
          monsterLevel?: number | undefined
          minDamage?: number | undefined
          maxDamage?: number | undefined
          defense?: number | undefined
          attackRating?: number | undefined
          isBoss?: boolean | undefined
          revivable?: boolean | undefined
          isUnique?: boolean | undefined
          isChampion?: boolean | undefined
          isSuperUnique?: boolean | undefined
          alreadyRevived?: boolean | undefined
          states?: ReadonlySet<number> | undefined
          stateId?: number | undefined
          x?: number | undefined
          y?: number | undefined
        }[]
      | undefined
    ironGolemItem?: IronGolemItemProps | undefined
    groundItems?: (IronGolemItemProps & { id: string; consumed?: boolean | undefined })[] | undefined
    monEquipSeed?: number | undefined
  }): CreatePetOutcome {
    if (!this.registry || this.registry.skillsById.size === 0 || this.registry.petTypesByName.size === 0) {
      throw new Error(
        'SummonManager.createPet requires a loaded D2DataRegistry with Skills.txt and PetType.txt records',
      )
    }
    const skill = this.registry.getSkillById(params.skillId)
    if (!skill) {
      return { created: false, reason: 'invalid_skill', evictedPetUids: [], activeCountForType: 0 }
    }

    // 1.13c Iron Golem (90): TargetItem = 1, SKILLS_SrvSt20_IronGolem (0x6FD11BC0) & SKILLS_SrvDo057_IronGolem (0x6FD11C30)
    // Rejects non-metallic items and consumes the ground item if groundItems list is supplied.
    let resolvedIronGolemItem = params.ironGolemItem
    if (params.skillId === 90) {
      if (resolvedIronGolemItem && resolvedIronGolemItem.isMetallic === false) {
        return { created: false, reason: 'invalid_item', evictedPetUids: [], activeCountForType: 0 }
      }
      if (params.groundItems) {
        const availItem = params.groundItems.find(g => !g.consumed && g.isMetallic !== false)
        if (!availItem) {
          return { created: false, reason: 'invalid_item', evictedPetUids: [], activeCountForType: 0 }
        }
        availItem.consumed = true
        resolvedIronGolemItem = availItem
      }
    }

    // Corpse-consuming Necromancer summons (`Raise Skeleton` 70, `Raise Skeletal Mage` 80, `Revive` 95)
    const requiresCorpse = params.skillId === 70 || params.skillId === 80 || params.skillId === 95
    let consumedCorpse: NonNullable<typeof params.corpses>[number] | undefined
    if (requiresCorpse && params.corpses) {
      // 1.13c Invariant: Boss corpses cannot be used for summons; Revive (95) additionally
      // requires MonStats2.txt revive == 1 and non-Unique/Champion/SuperUnique/already-revived corpse.
      const availCorpse = params.corpses.find(c => {
        if (c.consumed || c.isBoss) return false
        if (params.skillId === 95) {
          if (
            c.revivable === false ||
            c.isUnique ||
            c.isChampion ||
            c.isSuperUnique ||
            c.alreadyRevived ||
            Boolean(c.states?.has(96))
          ) {
            return false
          }
          const resolvedHcIdx =
            c.classId !== undefined
              ? c.classId
              : c.monId !== undefined
                ? this.resolveMonStatsFallback(c.monId)?.hcIdx
                : undefined
          if (resolvedHcIdx !== undefined) {
            const pathRec = getMonsterPathRecord(resolvedHcIdx)
            if (pathRec && (pathRec.monStats2Flags & MONSTATS2FLAG_REVIVE) === 0) return false
          }
        }
        return true
      })
      if (!availCorpse) {
        return { created: false, reason: 'missing_corpse', evictedPetUids: [], activeCountForType: 0 }
      }
      availCorpse.consumed = true
      if (params.skillId === 95) {
        availCorpse.alreadyRevived = true
      }
      consumedCorpse = availCorpse
    }

    // 1.13c D2GAME_CreateSummon_6FCBDDC0 & SKILLS_SrvDo044/045 -> 0x6FCB5D50:
    // Derive petTypeName and petGroup directly from Skills.txt (pettype) and PetType.txt (group).
    const petTypeName = (skill.petType || 'none').trim().toLowerCase()
    const petTypeRec = this.registry.getPetType(petTypeName)
    if (!petTypeRec) {
      throw new Error(
        `SummonManager.createPet: unknown PetType "${petTypeName}" for skill #${params.skillId} (${skill.name})`,
      )
    }
    const petGroup = petTypeRec.group

    const evictedPetUids: string[] = []

    // 0. Purge any already-dead pets (`alive === false` or `hp <= 0`) so they
    // do not count toward `maxPets` or trigger false FIFO evictions.
    for (let i = this.pets.length - 1; i >= 0; i -= 1) {
      const p = this.pets[i]!
      if (p.alive === false || p.hp <= 0) {
        this.clearTotemAurasForPet(p, params.owner)
        this.pets.splice(i, 1)
      }
    }

    // 1. Evict any existing pets in the same `petGroup` (`PetType.txt` `group > 0`) that have a different `petType`
    // (In 1.13c PetType.txt, only spiritwolf idx=11, fenris idx=12, and grizzly idx=15 have group=1;
    // Golems, Totems, Vines, and Shadows each share a single petType with petmax=1 and group=0).
    if (petGroup > 0) {
      for (let i = this.pets.length - 1; i >= 0; i -= 1) {
        const p = this.pets[i]!
        if (p.petGroup === petGroup && p.petType !== petTypeName) {
          this.clearTotemAurasForPet(p, params.owner)
          evictedPetUids.push(p.uid)
          this.pets.splice(i, 1)
        }
      }
    }

    // 2. Determine max cap (`petmax` calc from `Skills.txt`, or `PetType.txt` `basemax`)
    const calcCtx = {
      registry: this.registry,
      activeSkill: skill,
      slvl: params.slvl,
      blvl: params.owner.statList.getBaseSkillLevel(params.skillId),
      getBaseSkillLevel: (id: number) => params.owner.statList.getBaseSkillLevel(id),
      getEffectiveSkillLevel: (id: number) => params.owner.statList.getEffectiveSkillLevel(id),
    }

    let maxPets: number
    if (petTypeName === 'none') {
      maxPets = Number.POSITIVE_INFINITY
    } else if (skill.petMax) {
      maxPets = Math.max(1, evaluateCalc(skill.petMax, calcCtx))
    } else if (petTypeRec.baseMax > 0) {
      maxPets = petTypeRec.baseMax
    } else {
      maxPets = Number.POSITIVE_INFINITY
    }

    // 3. Enforce FIFO eviction when `activeCount >= maxPets` (skip uncounted `petType === 'none'`)
    if (petTypeName !== 'none' && Number.isFinite(maxPets)) {
      const existingOfType = this.pets.filter(p => p.petType === petTypeName)
      while (existingOfType.length >= maxPets) {
        const oldest = existingOfType.shift()!
        const idx = this.pets.findIndex(p => p.uid === oldest.uid)
        if (idx !== -1) {
          this.clearTotemAurasForPet(oldest, params.owner)
          evictedPetUids.push(oldest.uid)
          this.pets.splice(idx, 1)
        }
      }
    }

    // 4. Resolve MonStats record and sub-skills (`IDs 281..338`)
    const corpseMonRec =
      params.skillId === 95
        ? consumedCorpse?.classId !== undefined
          ? this.resolveMonStatsFallback(consumedCorpse.classId)
          : consumedCorpse?.monId
            ? this.resolveMonStatsFallback(consumedCorpse.monId)
            : undefined
        : undefined
    const monId = (
      params.skillId === 95
        ? consumedCorpse?.monId || corpseMonRec?.id || skill.summon || skill.name
        : skill.summon || skill.name
    ).toLowerCase()
    const monRec = corpseMonRec ?? this.resolveMonStatsFallback(monId)
    const code =
      (params.skillId === 95 ? consumedCorpse?.code || corpseMonRec?.code : undefined) ||
      monRec?.code ||
      (petTypeName === 'assassintrap' ? 'lg' : 'sk')
    const resolvedPetClassId =
      params.skillId === 95
        ? (consumedCorpse?.classId ?? corpseMonRec?.hcIdx)
        : monRec?.hcIdx

    // Compute 1.13c Skeleton Mastery (`69`) / Golem Mastery (`79`) / Summon Resist (`89`) / Synergies
    const globalAllSkillsForMastery = params.owner.statList.getEffectiveSkillLevel(0)
    const getOwnedEffectiveSkillLvl = (sId: number): number => {
      const base = params.owner.statList.getBaseSkillLevel(sId)
      const eff = params.owner.statList.getEffectiveSkillLevel(sId)
      if (base === 0 && eff <= globalAllSkillsForMastery) return 0
      return eff
    }
    const skelMasteryLvl = getOwnedEffectiveSkillLvl(69)
    const golemMasteryLvl = getOwnedEffectiveSkillLvl(79)
    const summonResLvl = getOwnedEffectiveSkillLvl(89)
    const gmStats = calculateGolemMasteryStats(golemMasteryLvl)
    const sumResPct = calculateSummonResistPct(summonResLvl)

    const clayGolemBlvl = params.owner.statList.getBaseSkillLevel(75)
    const bloodGolemBlvl = params.owner.statList.getBaseSkillLevel(85)
    const ironGolemBlvl = params.owner.statList.getBaseSkillLevel(90)
    const fireGolemBlvl = params.owner.statList.getBaseSkillLevel(94)
    const golemSynergies = {
      clayGolemBlvl,
      bloodGolemBlvl,
      ironGolemBlvl,
      fireGolemBlvl,
    }

    let kind: SummonedPetUnit['kind']
    let mageElement: SummonedPetUnit['mageElement']
    let lifespanTicks: number | undefined
    let slowPct: number | undefined
    let lifeLink: SummonedPetUnit['lifeLink']
    let thornsReturnPct: number | undefined
    let fireAbsorbPct: number | undefined
    let deathExplosionDmg: number | undefined
    let inheritedAuras: number[] | undefined

    let baseHp = (monRec?.maxHP || 150) + params.slvl * 35
    let petDef = 0
    let skelAr = 0
    let skelDmgBonusPct = 0
    let skelFlatDmgBonus = 0
    let reviveVelPct = 0
    let reviveDmgPct = 0
    let reviveAr = 0
    let reviveBaseMinDmg: number | undefined
    let reviveBaseMaxDmg: number | undefined
    let reviveMinDmg: number | undefined
    let reviveMaxDmg: number | undefined
    let reviveMonsterLevel: number | undefined
    let golemAr = 0
    let golemDmgBonusPct = 0
    let golemVelPct = 0
    let golemPhysRes = 0
    let golemMagRes = 0
    let golemFireRes: number | undefined
    let golemLtngRes: number | undefined
    let golemColdRes: number | undefined
    let golemPoisRes: number | undefined
    let golemFireMinDam = 0
    let golemFireMaxDam = 0
    let golemFade = 0
    let bloodGolemDamageShare = 0

    if (params.skillId === 70) {
      kind = 'skeleton'
      const skelStats = calculateRaiseSkeletonStats(params.slvl, skelMasteryLvl)
      baseHp = skelStats.maxHp
      petDef = skelStats.defense
      skelAr = skelStats.attackRating
      skelDmgBonusPct = skelStats.damageBonusPct
      skelFlatDmgBonus = skelStats.flatDamageBonus
    } else if (params.skillId === 80) {
      kind = 'skeleton_mage'
      const mageStats = calculateSkeletalMageStats(params.slvl, skelMasteryLvl)
      baseHp = mageStats.maxHp
      petDef = mageStats.defense
      const elements: ('fire' | 'cold' | 'lightning' | 'poison')[] = ['fire', 'cold', 'lightning', 'poison']
      mageElement = elements[this.uidCounter % 4]
    } else if (params.skillId === 75) {
      kind = 'clay_golem'
      const clayStats = calculateClayGolemStats(params.slvl, golemMasteryLvl, bloodGolemBlvl, golemSynergies)
      slowPct = clayStats.slowPct
      baseHp = clayStats.maxHp
      petDef = clayStats.defense
      golemAr = clayStats.attackRating
      golemDmgBonusPct = clayStats.damageBonusPct
      golemVelPct = gmStats.speedBonusPct
      golemPhysRes = 25
      golemFireRes = sumResPct
      golemLtngRes = 20 + sumResPct
      golemColdRes = 50 + sumResPct
      golemPoisRes = sumResPct
    } else if (params.skillId === 85) {
      kind = 'blood_golem'
      const bgStats = calculateBloodGolemStats(params.slvl, golemMasteryLvl, golemSynergies)
      lifeLink = {
        lifeLeechPct: bgStats.lifeLeechPct,
        healCasterPct: bgStats.ownerHealSplitPct,
        healGolemPct: bgStats.golemHealSplitPct,
        shareDamagePct: bgStats.damageSharePct,
      }
      baseHp = bgStats.maxHp
      petDef = bgStats.defense
      golemAr = bgStats.attackRating
      golemDmgBonusPct = bgStats.damageBonusPct
      golemVelPct = gmStats.speedBonusPct
      bloodGolemDamageShare = bgStats.damageSharePct
      golemMagRes = 20
      golemFireRes = sumResPct
      golemLtngRes = sumResPct
      golemColdRes = sumResPct
      golemPoisRes = 20 + sumResPct
    } else if (params.skillId === 90) {
      kind = 'iron_golem'
      const igStats = calculateIronGolemStats(params.slvl, resolvedIronGolemItem, golemMasteryLvl, golemSynergies)
      const igExtra = resolvedIronGolemItem as
        | (IronGolemItemProps & {
            readonly fireResist?: number | undefined
            readonly lightResist?: number | undefined
            readonly coldResist?: number | undefined
            readonly poisonResist?: number | undefined
          })
        | undefined
      thornsReturnPct = igStats.thornsReturnPct
      inheritedAuras = igStats.inheritedAuras
      baseHp = igStats.maxHp
      petDef = igStats.defense
      golemAr = igStats.attackRating
      golemDmgBonusPct = igStats.damageBonusPct
      golemVelPct = gmStats.speedBonusPct
      golemFade = igStats.translucentFade
      golemFireRes = sumResPct + (igExtra?.fireResist ?? 0)
      golemLtngRes = 50 + sumResPct + (igExtra?.lightResist ?? 0)
      golemColdRes = sumResPct + (igExtra?.coldResist ?? 0)
      golemPoisRes = 100 + sumResPct + (igExtra?.poisonResist ?? 0)
    } else if (params.skillId === 94) {
      kind = 'fire_golem'
      const fgStats = calculateFireGolemStats(params.slvl, golemMasteryLvl, golemSynergies)
      fireAbsorbPct = fgStats.fireAbsorbPct
      deathExplosionDmg = fgStats.deathExplosionDmg
      baseHp = fgStats.maxHp
      petDef = fgStats.defense
      golemAr = fgStats.attackRating
      golemVelPct = gmStats.speedBonusPct
      golemFireMinDam = fgStats.meleeFireMin
      golemFireMaxDam = fgStats.meleeFireMax
      // 1.13c D2GAME_SetSummonResistance_6FD0C2E0: Summon Resist (#89) does NOT add fireresist when item_absorbfire_percent > 0!
      golemFireRes = fgStats.fireResist
      golemLtngRes = sumResPct
      golemColdRes = sumResPct
      golemPoisRes = sumResPct
    } else if (params.skillId === 95) {
      kind = 'revive'
      const corpseBaseHp = consumedCorpse?.baseMaxHp ?? corpseMonRec?.maxHP ?? 1000
      const casterLvl = params.owner.statList.getAccruedStat('level') || undefined
      reviveMonsterLevel = consumedCorpse?.monsterLevel
      reviveBaseMinDmg =
        consumedCorpse?.minDamage ??
        (corpseMonRec && corpseMonRec.a1MinD > 0 ? corpseMonRec.a1MinD : 10)
      reviveBaseMaxDmg =
        consumedCorpse?.maxDamage ??
        (corpseMonRec && corpseMonRec.a1MaxD > 0 ? corpseMonRec.a1MaxD : Math.max(reviveBaseMinDmg, 20))
      const revStats = calculateReviveStats(params.slvl, skelMasteryLvl, {
        baseMaxHp: corpseBaseHp,
        monsterLevel: reviveMonsterLevel,
        casterLevel: casterLvl,
        baseMinDamage: reviveBaseMinDmg,
        baseMaxDamage: reviveBaseMaxDmg,
      })
      lifespanTicks = revStats.durationFrames
      baseHp = revStats.maxHp
      reviveVelPct = revStats.velocityBonusPct
      reviveDmgPct = revStats.damageBonusPct
      reviveMinDmg = revStats.minDamage
      reviveMaxDmg = revStats.maxDamage
      petDef = consumedCorpse?.defense ?? corpseMonRec?.ac ?? 0
      reviveAr = consumedCorpse?.attackRating ?? corpseMonRec?.a1TH ?? 0
      if (corpseMonRec) {
        golemPhysRes = corpseMonRec.resDm
        golemMagRes = corpseMonRec.resMa
        golemFireRes = corpseMonRec.resFi + sumResPct
        golemLtngRes = corpseMonRec.resLi + sumResPct
        golemColdRes = corpseMonRec.resCo + sumResPct
        golemPoisRes = corpseMonRec.resPo + sumResPct
      }

      // 1.13c SKILLS_SrvDo058_Revive (0x6FC71340): Paladin casting Revive suffers 12.5% (maxHp >> 3) life backlash
      const ownerClass = String((params.owner as any).charClass ?? (params.owner as any).classCode ?? '').toLowerCase()
      if (ownerClass === 'pal' || ownerClass === 'paladin') {
        const maxHp256 = params.owner.statList.getMaxHp256()
        const curHp256 = params.owner.statList.getHp256()
        if (maxHp256 > 0 && curHp256 > 0) {
          const backlash256 = Math.floor(maxHp256 / 8)
          params.owner.statList.setHp256(Math.max(FIXED_ONE, curHp256 - backlash256))
        }
      }
    }

    let decoyRes = 0
    let valkRes = 0
    let valkStats: ReturnType<typeof calculateValkyrieStats> | undefined
    let isStationary = false
    let equipmentTier: ValkyrieEquipmentTier | undefined
    let valkyrieEquipment: readonly MonsterEquippedItem113c[] | undefined

    if (params.skillId === 62) {
      // 1.13c Skills.txt #62 Hydra: stationary 10-second (250 frames) fire-turret summon
      kind = 'hydra'
      isStationary = true
      lifespanTicks = 250
    } else if (petTypeName === 'assassintrap') {
      kind = 'assassin_trap'
      isStationary = true
    } else if (params.skillId === 78) {
      kind = 'bonewall'
      isStationary = true
      const bwStats = calculateBoneWallStats(
        params.slvl,
        {
          boneArmor: params.owner.statList.getBaseSkillLevel(68),
          bonePrison: params.owner.statList.getBaseSkillLevel(88),
        },
        params.difficulty ?? 'normal',
      )
      baseHp = bwStats.hp113c
      lifespanTicks = bwStats.durationFrames
      petDef = monRec?.ac ?? 0
      golemFireRes = 0
      golemLtngRes = 0
      golemColdRes = 0
      golemPoisRes = 100
    } else if (params.skillId === 88) {
      kind = 'bonewall'
      isStationary = true
      const bpStats = calculateBonePrisonStats(
        params.slvl,
        {
          boneArmor: params.owner.statList.getBaseSkillLevel(68),
          boneWall: params.owner.statList.getBaseSkillLevel(78),
        },
        params.difficulty ?? 'normal',
      )
      baseHp = bpStats.hp113c
      lifespanTicks = bpStats.durationFrames
      petDef = monRec?.ac ?? 0
      golemFireRes = 0
      golemLtngRes = 0
      golemColdRes = 0
      golemPoisRes = 100
    } else if (params.skillId === 28) {
      kind = 'dopplezon'
      isStationary = true
      const amazonHp = Math.trunc(params.owner.statList.getMaxHp256() / FIXED_ONE) || 100
      const amazonDef = params.owner.statList.getAccruedStat('armorclass') || 0
      const decoyStats = calculateDecoyStats(params.slvl, amazonHp, amazonDef)
      baseHp = decoyStats.hp
      lifespanTicks = decoyStats.durationFrames
      petDef = decoyStats.defense
      decoyRes = decoyStats.allResistancesPct
    } else if (params.skillId === 32) {
      kind = 'valkyrie'
      const decoyHardPoints = params.owner.statList.getBaseSkillLevel(28)
      const csLvl = params.owner.statList.getBaseSkillLevel(9)
      const dodgeLvl = params.owner.statList.getBaseSkillLevel(13)
      const avoidLvl = params.owner.statList.getBaseSkillLevel(18)
      const evadeLvl = params.owner.statList.getBaseSkillLevel(29)
      const penetrateLvl = params.owner.statList.getBaseSkillLevel(23)
      valkStats = calculateValkyrieStats(params.slvl, {
        decoyHardPoints,
        csLvl,
        dodgeLvl,
        avoidLvl,
        evadeLvl,
        penetrateLvl,
        rng: () => this.rng.int(0, 0xffff) / 0x10000,
      })
      baseHp = valkStats.finalHp
      valkRes = valkStats.allResistancesPct
      equipmentTier = valkStats.equipmentTier
      valkyrieEquipment = valkStats.equipment
    } else if (params.skillId === 257) {
      kind = 'assassin_trap'
      lifespanTicks = 100 + 12 * Math.max(0, params.slvl - 1)
    }

    const ownerLevel = params.owner.statList.getAccruedStat('level')

    // 1.13c Druid Summoning cross-synergy helper:
    // Unlike standard 1.10+ `.blvl` synergies, Druid wolf/grizzly synergies in `Skills.txt`
    // reference `.lvl` (`skill('Summon Spirit Wolf'.lvl)`, `skill('Summon Fenris'.lvl)`, `skill('Summon Grizzly'.lvl)`),
    // which includes `+skills` soft points whenever the synergy skill has at least 1 base or staffmod point!
    const globalAllSkillsOnly = params.owner.statList.getEffectiveSkillLevel(0)
    const getDruidSummonEffectiveLvl = (sId: number): number => {
      if (sId === params.skillId) {
        return Math.max(params.slvl, params.owner.statList.getEffectiveSkillLevel(sId))
      }
      const base = params.owner.statList.getBaseSkillLevel(sId)
      const eff = params.owner.statList.getEffectiveSkillLevel(sId)
      if (base === 0 && eff <= globalAllSkillsOnly) return 0
      return eff
    }

    let druidPetArPct = 0
    let druidPetDefPct = 0
    let druidPetDmgPct = 0
    let druidPetMinDmg: number | undefined
    let druidPetMaxDmg: number | undefined
    let druidPetLevelOverride: number | undefined
    let shadowEquipment: ShadowEquipmentLoadout | undefined
    const shadowSkills = new Map<number, number>()

    if (params.skillId === 221) {
      // Raven (#221)
      kind = 'raven'
      const ravenStats = calculateRavenStats(params.slvl, ownerLevel)
      baseHp = ravenStats.hp
      petDef = monRec?.ac ?? 1
      druidPetMinDmg = ravenStats.minDamage
      druidPetMaxDmg = ravenStats.maxDamage
      druidPetLevelOverride = ravenStats.petLevel
    } else if (params.skillId === 222) {
      // Poison Creeper (#222)
      kind = 'poison_creeper'
      const pcStats = calculatePoisonCreeperStats(params.slvl, ownerLevel)
      baseHp = pcStats.hp
      petDef = monRec?.ac ?? 11
      druidPetLevelOverride = pcStats.petLevel
    } else if (params.skillId === 226) {
      // Oak Sage (#226)
      kind = 'oak_sage'
      const oakStats = calculateOakSageStats(params.slvl, params.difficulty ?? 'normal')
      baseHp = oakStats.hp
      petDef = monRec?.ac ?? 17
      golemPhysRes = oakStats.resistances.damageResist
      golemMagRes = oakStats.resistances.magicResist
      golemFireRes = oakStats.resistances.fireResist
      golemLtngRes = oakStats.resistances.lightResist
      golemColdRes = oakStats.resistances.coldResist
      golemPoisRes = oakStats.resistances.poisonResist
    } else if (params.skillId === 227) {
      // Summon Spirit Wolf (#227)
      kind = 'spirit_wolf'
      const swLvl = getDruidSummonEffectiveLvl(227)
      const dwLvl = getDruidSummonEffectiveLvl(237)
      const gzLvl = getDruidSummonEffectiveLvl(247)
      const swStats = calculateSummonSpiritWolfStats(swLvl, dwLvl, gzLvl)
      baseHp = swStats.hp
      petDef = monRec?.ac ?? 17
      druidPetArPct = swStats.attackRatingBonusPct
      druidPetDefPct = swStats.defenseBonusPct
      druidPetDmgPct = swStats.synergyDamagePct
      druidPetMinDmg = swStats.minDamage
      druidPetMaxDmg = swStats.maxDamage
      golemFireRes = swStats.allResistancesPct
      golemLtngRes = swStats.allResistancesPct
      golemColdRes = swStats.allResistancesPct
      golemPoisRes = swStats.allResistancesPct
    } else if (params.skillId === 231) {
      // Carrion Vine (#231)
      kind = 'carrion_vine'
      const cvStats = calculateCarrionVineStats(params.slvl, ownerLevel)
      baseHp = cvStats.hp
      petDef = monRec?.ac ?? 25
      druidPetLevelOverride = cvStats.petLevel
    } else if (params.skillId === 236) {
      // Heart of Wolverine (#236)
      kind = 'heart_of_wolverine'
      const howStats = calculateHeartOfWolverineStats(params.slvl, params.difficulty ?? 'normal')
      baseHp = howStats.hp
      petDef = monRec?.ac ?? 31
      golemPhysRes = howStats.resistances.damageResist
      golemMagRes = howStats.resistances.magicResist
      golemFireRes = howStats.resistances.fireResist
      golemLtngRes = howStats.resistances.lightResist
      golemColdRes = howStats.resistances.coldResist
      golemPoisRes = howStats.resistances.poisonResist
    } else if (params.skillId === 237) {
      // Summon Dire Wolf (Fenris #237)
      kind = 'dire_wolf'
      const swLvl = getDruidSummonEffectiveLvl(227)
      const dwLvl = getDruidSummonEffectiveLvl(237)
      const gzLvl = getDruidSummonEffectiveLvl(247)
      const dwStats = calculateSummonDireWolfStats(dwLvl, swLvl, gzLvl)
      baseHp = dwStats.hp
      petDef = monRec?.ac ?? 31
      druidPetArPct = dwStats.synergyArPct
      druidPetDefPct = dwStats.totalDefenseBonusPct
      druidPetDmgPct = dwStats.synergyDamagePct
      druidPetMinDmg = dwStats.minDamage
      druidPetMaxDmg = dwStats.maxDamage
      golemFireRes = dwStats.allResistancesPct
      golemLtngRes = dwStats.allResistancesPct
      golemColdRes = dwStats.allResistancesPct
      golemPoisRes = dwStats.allResistancesPct
    } else if (params.skillId === 241) {
      // Solar Creeper (#241)
      kind = 'solar_creeper'
      const scStats = calculateSolarCreeperStats(params.slvl, ownerLevel)
      baseHp = scStats.hp
      petDef = monRec?.ac ?? 39
      druidPetLevelOverride = scStats.petLevel
    } else if (params.skillId === 246) {
      // Spirit of Barbs (#246)
      kind = 'spirit_of_barbs'
      const sobStats = calculateSpiritOfBarbsStats(params.slvl, params.difficulty ?? 'normal')
      baseHp = sobStats.hp
      petDef = monRec?.ac ?? 45
      golemPhysRes = sobStats.resistances.damageResist
      golemMagRes = sobStats.resistances.magicResist
      golemFireRes = sobStats.resistances.fireResist
      golemLtngRes = sobStats.resistances.lightResist
      golemColdRes = sobStats.resistances.coldResist
      golemPoisRes = sobStats.resistances.poisonResist
    } else if (params.skillId === 247) {
      // Summon Grizzly (#247)
      kind = 'grizzly'
      const swLvl = getDruidSummonEffectiveLvl(227)
      const dwLvl = getDruidSummonEffectiveLvl(237)
      const gzLvl = getDruidSummonEffectiveLvl(247)
      const gzStats = calculateSummonGrizzlyStats(gzLvl, swLvl, dwLvl)
      baseHp = gzStats.hp
      petDef = monRec?.ac ?? 50
      druidPetArPct = gzStats.synergyArPct
      druidPetDefPct = gzStats.synergyDefensePct
      druidPetDmgPct = gzStats.selfDamageBonusPct
      druidPetMinDmg = gzStats.minDamage
      druidPetMaxDmg = gzStats.maxDamage
      golemFireRes = gzStats.allResistancesPct
      golemLtngRes = gzStats.allResistancesPct
      golemColdRes = gzStats.allResistancesPct
      golemPoisRes = gzStats.allResistancesPct
    } else if (params.skillId === 268 || params.skillId === 279) {
      // Shadow Warrior (#268) & Shadow Master (#279)
      kind = params.skillId === 268 ? 'shadow_warrior' : 'shadow_master'
      baseHp = computeShadowMaxLife(params.slvl)
      druidPetLevelOverride = ownerLevel > 0 ? computeShadowMlvl(ownerLevel, params.slvl) : params.slvl
      const shadowRes =
        params.skillId === 268
          ? computeShadowWarriorResistances(params.slvl)
          : computeShadowMasterResistances(params.slvl)
      golemFireRes = shadowRes
      golemLtngRes = shadowRes
      golemColdRes = shadowRes
      golemPoisRes = shadowRes
      shadowEquipment = generateShadowEquipment(params.skillId as 268 | 279, params.slvl, {
        rng: () => this.rng.int(0, 0xffff) / 0x10000,
      })
    }

    // 1.13c MonProp.txt innate monster/pet properties (#1897) & MonEquip.txt rolled loadout (#1898)
    let petMonProps: ResolvedMonsterMonProps113c | undefined
    if (params.skillId === 95) {
      petMonProps = resolveMonsterMonProps113c(
        consumedCorpse?.classId ?? consumedCorpse?.monId ?? monId,
        params.difficulty ?? 'normal',
        (lo, hi) => lo + this.rng.rand(hi - lo + 1),
        () => this.rng.rand(100),
      )
    } else if (params.skillId === 90) {
      petMonProps = resolveMonsterMonProps113c('irongolem', params.difficulty ?? 'normal')
    } else if (params.skillId === 221) {
      petMonProps = resolveMonsterMonProps113c('druidhawk', params.difficulty ?? 'normal')
    }

    let monEquipLoadout: RolledMonsterLoadout113c | undefined
    let resolvedMonEquipSeed: number | undefined
    let hasShield: boolean | undefined
    if (params.skillId === 32 && params.skipMonEquipLoadout113c !== true) {
      resolvedMonEquipSeed = params.monEquipSeed ?? (this.rng.rand(0x7fffffff) || 1)
      monEquipLoadout = rollMonsterOrPetLoadout113c({
        monster: 'valkyrie',
        level: params.slvl,
        ilvl: computeSummonMonEquipIlvl113c('valkyrie', params.slvl),
        seed: resolvedMonEquipSeed,
      })
      baseHp += monEquipLoadout.maxHpBonus
      petDef += monEquipLoadout.defenseBonus
      valkyrieEquipment = monEquipLoadout.equippedSpecs
    } else if (params.skillId === 268 || params.skillId === 279) {
      resolvedMonEquipSeed = params.monEquipSeed ?? (this.rng.rand(0x7fffffff) || 1)
      const shadowIlvl = Math.min(99, 24 + 3 * Math.max(0, params.slvl - 1))
      monEquipLoadout = rollMonsterOrPetLoadout113c({
        monster: params.skillId === 268 ? 'shadowwarrior' : 'shadowmaster',
        level: params.slvl,
        ilvl: shadowIlvl,
        seed: resolvedMonEquipSeed,
      })
      petDef += monEquipLoadout.defenseBonus
      if (params.skillId === 279) {
        const capAt90 = params.slvl <= 12 && params.monEquipSeed === undefined
        const addRes = (base: number, bonus: number): number =>
          capAt90 ? Math.min(90, base + bonus) : base + bonus
        golemFireRes = addRes(golemFireRes ?? 0, monEquipLoadout.resistFire)
        golemLtngRes = addRes(golemLtngRes ?? 0, monEquipLoadout.resistLightning)
        golemColdRes = addRes(golemColdRes ?? 0, monEquipLoadout.resistCold)
        golemPoisRes = addRes(golemPoisRes ?? 0, monEquipLoadout.resistPoison)
        golemMagRes += monEquipLoadout.resistMagic
        baseHp += monEquipLoadout.maxHpBonus
      } else if (params.slvl >= 11 || params.monEquipSeed !== undefined) {
        golemFireRes = (golemFireRes ?? 0) + monEquipLoadout.resistFire
        golemLtngRes = (golemLtngRes ?? 0) + monEquipLoadout.resistLightning
        golemColdRes = (golemColdRes ?? 0) + monEquipLoadout.resistCold
        golemPoisRes = (golemPoisRes ?? 0) + monEquipLoadout.resistPoison
        golemMagRes += monEquipLoadout.resistMagic
        baseHp += monEquipLoadout.maxHpBonus
      }
    } else if (params.skillId === 70) {
      const shieldRoll = params.monEquipSeed !== undefined ? Math.abs(params.monEquipSeed) % 100 : this.rng.rand(100)
      hasShield = shieldRoll < 5
    }

    const effectiveRes = decoyRes || valkRes || sumResPct
    const petLevel =
      druidPetLevelOverride !== undefined
        ? druidPetLevelOverride
        : params.skillId === 95 && reviveMonsterLevel !== undefined && ownerLevel > 0
          ? Math.min(ownerLevel, reviveMonsterLevel)
          : ownerLevel

    const equipCbPct = (petMonProps?.crushingBlowPct ?? 0) + (monEquipLoadout?.crushingBlowPct ?? 0)
    const equipDsPct = monEquipLoadout?.deadlyStrikePct ?? 0
    const equipOwPct = monEquipLoadout?.openWoundsPct ?? 0
    const equipIasPct = (petMonProps?.iasPct ?? 0) + (monEquipLoadout?.iasPct ?? 0)
    const equipFcrPct = petMonProps?.fcrPct ?? 0
    const equipFhrPct = monEquipLoadout?.fhrPct ?? 0
    const equipExtraFirePct = petMonProps?.extraFirePct ?? 0
    const equipFade = Math.max(golemFade, petMonProps?.fadeLevel ?? 0)
    const valkFireRes = params.skillId === 32 && monEquipLoadout ? effectiveRes + monEquipLoadout.resistFire : undefined
    const valkLtngRes = params.skillId === 32 && monEquipLoadout ? effectiveRes + monEquipLoadout.resistLightning : undefined
    const valkColdRes = params.skillId === 32 && monEquipLoadout ? effectiveRes + monEquipLoadout.resistCold : undefined
    const valkPoisRes = params.skillId === 32 && monEquipLoadout ? effectiveRes + monEquipLoadout.resistPoison : undefined
    const valkMagRes = params.skillId === 32 && monEquipLoadout ? golemMagRes + monEquipLoadout.resistMagic : golemMagRes

    const petStatList = new UnitStatList(this.registry, {
      level: petLevel,
      maxhp: baseHp * FIXED_ONE,
      hitpoints: baseHp * FIXED_ONE,
      armorclass: petDef,
      ...(golemPhysRes ? { damageresist: golemPhysRes } : {}),
      ...(valkMagRes ? { magicresist: valkMagRes } : {}),
      fireresist: golemFireRes ?? valkFireRes ?? effectiveRes,
      lightresist: golemLtngRes ?? valkLtngRes ?? effectiveRes,
      coldresist: golemColdRes ?? valkColdRes ?? effectiveRes,
      poisonresist: golemPoisRes ?? valkPoisRes ?? effectiveRes,
      ...(skelAr ? { tohit: skelAr } : {}),
      ...(golemAr ? { tohit: golemAr } : {}),
      ...(reviveAr ? { tohit: reviveAr } : {}),
      ...((params.skillId === 268 || params.skillId === 279) && monEquipLoadout?.flatAttackRating
        ? { tohit: monEquipLoadout.flatAttackRating }
        : {}),
      ...((params.skillId === 268 || params.skillId === 279) && monEquipLoadout?.attackRatingPct
        ? { item_tohit_percent: monEquipLoadout.attackRatingPct }
        : {}),
      ...(skelDmgBonusPct ? { damagepercent: skelDmgBonusPct } : {}),
      ...(golemDmgBonusPct ? { damagepercent: golemDmgBonusPct } : {}),
      ...(skelFlatDmgBonus ? { item_normaldamage: skelFlatDmgBonus } : {}),
      ...(reviveVelPct ? { velocitypercent: reviveVelPct } : {}),
      ...(golemVelPct ? { velocitypercent: golemVelPct } : {}),
      ...(reviveDmgPct ? { damagepercent: reviveDmgPct } : {}),
      ...(reviveMinDmg !== undefined ? { mindamage: reviveMinDmg } : {}),
      ...(reviveMaxDmg !== undefined ? { maxdamage: reviveMaxDmg } : {}),
      ...(druidPetMinDmg !== undefined ? { mindamage: druidPetMinDmg } : {}),
      ...(druidPetMaxDmg !== undefined ? { maxdamage: druidPetMaxDmg } : {}),
      ...(monEquipLoadout && monEquipLoadout.weaponMaxDamage > 0
        ? { mindamage: monEquipLoadout.weaponMinDamage, maxdamage: monEquipLoadout.weaponMaxDamage }
        : {}),
      ...(golemFireMinDam ? { firemindam: golemFireMinDam, firemaxdam: golemFireMaxDam } : {}),
      ...(monEquipLoadout && monEquipLoadout.fireMaxDamage > 0 && !golemFireMinDam
        ? { firemindam: monEquipLoadout.fireMinDamage, firemaxdam: monEquipLoadout.fireMaxDamage }
        : {}),
      ...(monEquipLoadout && monEquipLoadout.ltngMaxDamage > 0
        ? { lightmindam: monEquipLoadout.ltngMinDamage, lightmaxdam: monEquipLoadout.ltngMaxDamage }
        : {}),
      ...(monEquipLoadout && monEquipLoadout.coldMaxDamage > 0
        ? {
            coldmindam: monEquipLoadout.coldMinDamage,
            coldmaxdam: monEquipLoadout.coldMaxDamage,
            ...(monEquipLoadout.coldLengthFrames > 0 ? { coldlength: monEquipLoadout.coldLengthFrames } : {}),
          }
        : {}),
      ...(monEquipLoadout && monEquipLoadout.magicMaxDamage > 0
        ? { magicmindam: monEquipLoadout.magicMinDamage, magicmaxdam: monEquipLoadout.magicMaxDamage }
        : {}),
      ...(monEquipLoadout && monEquipLoadout.poisMaxDamage > 0
        ? {
            poisonmindam: monEquipLoadout.poisMinDamage,
            poisonmaxdam: monEquipLoadout.poisMaxDamage,
            ...(monEquipLoadout.poisLengthFrames > 0
              ? { poisonlength: monEquipLoadout.poisLengthFrames, poison_count: 1 }
              : {}),
          }
        : {}),
      ...(equipFade ? { fade: equipFade } : {}),
      ...(druidPetArPct ? { item_tohit_percent: druidPetArPct } : {}),
      ...(druidPetDefPct ? { item_armor_percent: druidPetDefPct, skill_armor_percent: druidPetDefPct } : {}),
      ...(druidPetDmgPct ? { damagepercent: druidPetDmgPct } : {}),
      ...(params.skillId === 32 && valkStats ? {
        strength: valkStats.strength + (monEquipLoadout?.strBonus ?? 0),
        dexterity: valkStats.dexterity + (monEquipLoadout?.dexBonus ?? 0),
        item_armor_percent: valkStats.defenseBonusPct,
        skill_armor_percent: valkStats.defenseBonusPct,
        tohit: valkStats.attackRatingBonus + (monEquipLoadout?.flatAttackRating ?? 0),
        ...(monEquipLoadout?.attackRatingPct ? { item_tohit_percent: monEquipLoadout.attackRatingPct } : {}),
        passive_critical_strike: valkStats.inheritedCriticalStrikeLvl > 0 ? calculateCriticalStrikeStats(valkStats.inheritedCriticalStrikeLvl).chancePct : 0,
        passive_dodge: valkStats.inheritedDodgeLvl > 0 ? calculateDodgeStats(valkStats.inheritedDodgeLvl).chancePct : 0,
        passive_avoid: valkStats.inheritedAvoidLvl > 0 ? calculateAvoidStats(valkStats.inheritedAvoidLvl).chancePct : 0,
        passive_evade: valkStats.inheritedEvadeLvl > 0 ? calculateEvadeStats(valkStats.inheritedEvadeLvl).chancePct : 0,
      } : {}),
      ...(equipCbPct > 0 ? { item_crushingblow: equipCbPct } : {}),
      ...(equipDsPct > 0 ? { item_deadlystrike: equipDsPct } : {}),
      ...(equipOwPct > 0 ? { item_openwounds: equipOwPct } : {}),
      ...(equipIasPct > 0 ? { item_fasterattackrate: equipIasPct } : {}),
      ...(equipFcrPct > 0 ? { item_fastercastrate: equipFcrPct } : {}),
      ...(equipFhrPct > 0 ? { item_fastergethitrate: equipFhrPct } : {}),
      ...(equipExtraFirePct > 0 ? { passive_fire_mastery: equipExtraFirePct } : {}),
      ...(hasShield ? { toblock: 20 } : {}),
      ...(slowPct && params.skillId !== 75 ? { item_slow: slowPct } : {}),
      ...(thornsReturnPct ? { thorns_percent: thornsReturnPct } : {}),
      ...(fireAbsorbPct && params.skillId !== 94 ? { item_absorbfire_percent: fireAbsorbPct } : {}),
    })
    const petStateBus = new StateBus(petStatList, this.registry)

    if (params.skillId === 75 && slowPct) {
      petStateBus.applyState({
        stateNameOrId: 'claygolem',
        slvl: params.slvl,
        durationFrames: 999999,
        stats: { item_slow: slowPct },
      })
    } else if (params.skillId === 85 && bloodGolemDamageShare) {
      petStateBus.applyState({
        stateNameOrId: 'bloodgolem',
        slvl: params.slvl,
        durationFrames: 999999,
      })
    } else if (params.skillId === 94 && fireAbsorbPct) {
      petStateBus.applyState({
        stateNameOrId: 'firegolem',
        slvl: params.slvl,
        durationFrames: 999999,
        stats: { item_absorbfire_percent: fireAbsorbPct },
      })
    }

    // 1.13c SKILLS_SrvDo058_Revive (0x6FC71340): apply Skills.txt state1 = 'revive' (States.txt row #96)
    if (params.skillId === 95) {
      petStateBus.applyState({
        stateNameOrId: 'revive',
        slvl: params.slvl,
        durationFrames: lifespanTicks ?? 4500,
      })
    }

    // 1.13c SKILLS_SrvDo115_Vines (0x6FC66720): apply Skills.txt aurastate = 'vine_beast' (States.txt row #150)
    if (params.skillId === 222 || params.skillId === 231 || params.skillId === 241) {
      petStateBus.applyState({
        stateNameOrId: 'vine_beast',
        slvl: params.slvl,
        durationFrames: 999999,
      })
    }

    // 1.13c Shadow Warrior (268) & Shadow Master (279) skill inheritance
    // (D2Game AiThink.cpp:14004-14020 & 14258-14272: max(1, floor(shadowSlvl / 3) + floor(ownerSkillLvl / 2)))
    if (params.skillId === 268) {
      for (let sId = 251; sId <= 280; sId++) {
        if (sId === 268 || sId === 279) continue
        const ownerLvl = params.owner.statList.getEffectiveSkillLevel(sId)
        const ownerBase = params.owner.statList.getBaseSkillLevel(sId)
        if (ownerBase > 0 || ownerLvl > 0) {
          const effLvl = getShadowWarriorCastingLevel(params.slvl, ownerLvl > 0 ? ownerLvl : ownerBase)
          petStatList.setBaseSkillLevel(sId, effLvl)
          shadowSkills.set(sId, effLvl)
        }
      }
    } else if (params.skillId === 279) {
      for (let sId = 251; sId <= 280; sId++) {
        if (sId === 268 || sId === 279) continue
        const ownerBase = params.owner.statList.getBaseSkillLevel(sId)
        const ownerEff = ownerBase > 0 ? params.owner.statList.getEffectiveSkillLevel(sId) : 0
        const effLvl = getShadowMasterCastingLevel(params.slvl, ownerEff)
        petStatList.setBaseSkillLevel(sId, effLvl)
        shadowSkills.set(sId, effLvl)
      }
    }

    // Map pet/trap AI sub-skills (`IDs 281..338`)
    const subSkillIds: number[] = []
    if (params.skillId === 262) subSkillIds.push(281) // Wake Of Destruction Sentry
    if (params.skillId === 222) subSkillIds.push(294) // Vine Attack
    if (params.skillId === 226) subSkillIds.push(298) // Oak Sage Aura (#298)
    if (params.skillId === 236) subSkillIds.push(297) // Wolverine Aura (#297)
    if (params.skillId === 246) subSkillIds.push(296) // Barbs Aura (#296)
    if (params.skillId === 261) subSkillIds.push(306) // BoltSentry
    if (params.skillId === 231) subSkillIds.push(307, 294) // CorpseCycler + Vine Attack
    if (params.skillId === 272) subSkillIds.push(311) // mon inferno sentry
    if (params.skillId === 276) subSkillIds.push(312, 324) // mon death sentry + death sentry ltng
    if (params.skillId === 271) subSkillIds.push(313) // sentry lightning
    if (params.skillId === 237) subSkillIds.push(314, 292) // fenris rage + Spirit Wolf Teleport
    if (params.skillId === 227) subSkillIds.push(292) // Spirit Wolf Teleport
    if (params.skillId === 268 || params.skillId === 279) subSkillIds.push(292) // Teleport 2
    if (params.skillId === 241) subSkillIds.push(325, 294) // VineCycler + Vine Attack
    if (params.skillId === 247) subSkillIds.push(326) // BearSmite
    if (params.skillId === 62) subSkillIds.push(337)  // HydraMissile
    if (params.skillId === 80) subSkillIds.push(338)  // NecromageMissile

    const resolvedMinDmg = reviveMinDmg ?? druidPetMinDmg
    const resolvedMaxDmg = reviveMaxDmg ?? druidPetMaxDmg

    const uid = `pet-${String(this.uidCounter++)}`
    const pet: SummonedPetUnit = {
      uid,
      id: uid,
      ownerUnitId: String(params.owner.id),
      ownerId: params.owner.id,
      ownerRef: params.owner,
      alive: true,
      name: code,
      monId,
      code,
      ...(resolvedPetClassId !== undefined ? { classId: resolvedPetClassId } : {}),
      ...(reviveMonsterLevel !== undefined || druidPetLevelOverride !== undefined
        ? { monsterLevel: petLevel, mlvl: petLevel }
        : {}),
      ...(reviveBaseMinDmg !== undefined ? { baseMinDamage: reviveBaseMinDmg } : {}),
      ...(reviveBaseMaxDmg !== undefined ? { baseMaxDamage: reviveBaseMaxDmg } : {}),
      ...(resolvedMinDmg !== undefined ? { minDamage: resolvedMinDmg } : {}),
      ...(resolvedMaxDmg !== undefined ? { maxDamage: resolvedMaxDmg } : {}),
      petType: petTypeName,
      petGroup,
      sourceSkillId: params.skillId,
      slvl: params.slvl,
      unsummonable: Boolean(petTypeRec.unsummon),
      subSkillIds,
      statList: petStatList,
      stateBus: petStateBus,
      x: params.x !== undefined ? params.x : (params.owner.x ?? 0) + (this.pets.length % 5) * 18 - 36,
      y: params.y !== undefined ? params.y : (params.owner.y ?? 60),
      hp: baseHp,
      maxHp: baseHp,
      shotsRemaining:
        petTypeName === 'assassintrap'
          ? (params.skillId === 262
              ? 5 + Math.floor(params.owner.statList.getBaseSkillLevel(251) / 3) // Wake of Fire: 5 base + FireBlast.blvl / 3
              : params.skillId === 276
                ? 5 + Math.floor(params.owner.statList.getBaseSkillLevel(251) / 3) // Death Sentry: 5 base + FireBlast.blvl / 3
                : params.skillId === 261
                  ? 5 + Math.floor(params.owner.statList.getBaseSkillLevel(271) / 4) // Charged Bolt Sentry: 5 base + LS.blvl / 4
                  : params.skillId === 257
                    ? 999
                    : 10) // Lightning Sentry (271) & Wake of Inferno (272): 10 shots
          : params.skillId === 221 || petTypeName === 'raven'
            ? 11 + params.slvl
            : 999,
      rageBuffActive: false,
      kind,
      mageElement,
      lifespanTicks,
      slowPct,
      lifeLink,
      thornsReturnPct,
      fireAbsorbPct,
      deathExplosionDmg,
      inheritedAuras,
      ironGolemItem: resolvedIronGolemItem,
      isStationary,
      ...(equipmentTier ? { equipmentTier } : {}),
      ...(valkyrieEquipment ? { valkyrieEquipment } : {}),
      ...(shadowEquipment ? { shadowEquipment } : {}),
      ...(shadowSkills.size > 0 ? { shadowSkills } : {}),
      ...(petMonProps ? { monProps: petMonProps } : {}),
      ...(monEquipLoadout ? { monEquipLoadout } : {}),
      ...(resolvedMonEquipSeed !== undefined ? { monEquipSeed: resolvedMonEquipSeed } : {}),
      ...(hasShield !== undefined ? { hasShield } : {}),
      snapshottedSkelMasteryLvl: skelMasteryLvl,
      snapshottedGolemMasteryLvl: golemMasteryLvl,
    }

    this.pets.push(pet)
    const activeCountForType = this.pets.filter(p => p.petType === petTypeName).length

    return {
      created: true,
      pet,
      evictedPetUids,
      activeCountForType,
    }
  }

  /**
   * Remove any active Druid Totem aura states (`oaksage` #149, `wolverine` #148, `barbs` #147)
   * when a totem is evicted, unsummoned, or killed.
   */
  private clearTotemAurasForPet(pet: SummonedPetUnit, owner?: CombatUnitContext): void {
    if (pet.petType !== 'totem' && ![226, 236, 246].includes(pet.sourceSkillId)) return
    const stateToRemove =
      pet.sourceSkillId === 226
        ? 'oaksage'
        : pet.sourceSkillId === 236
          ? 'wolverine'
          : pet.sourceSkillId === 246
            ? 'barbs'
            : undefined
    const targetOwner = owner ?? pet.ownerRef
    if (stateToRemove) {
      targetOwner?.stateBus.removeState(stateToRemove)
      for (const other of this.pets) {
        other.stateBus.removeState(stateToRemove)
      }
    } else {
      for (const st of ['oaksage', 'wolverine', 'barbs']) {
        targetOwner?.stateBus.removeState(st)
        for (const other of this.pets) {
          other.stateBus.removeState(st)
        }
      }
    }
  }

  /**
   * Unsummon (`skillId = 3`): dismisses a pet matching `(ownerId, petType, petId)` or `(targetUid, ownerUnitId)`,
   * skipping `raven` and non-unsummonable pets (`PetType.txt` `unsummon = 0`).
   */
  unsummonPet(
    ownerOrTarget?: string | number,
    petTypeOrOwner?: string,
    petId?: string | number,
  ): SummonedPetUnit | null {
    const arg1 = ownerOrTarget !== undefined ? String(ownerOrTarget) : undefined
    const arg2 = petTypeOrOwner !== undefined ? String(petTypeOrOwner) : undefined
    const arg3 = petId !== undefined ? String(petId) : undefined

    const dismissAt = (idx: number): SummonedPetUnit | null => {
      if (idx === -1) return null
      const pet = this.pets.splice(idx, 1)[0] ?? null
      if (pet) {
        pet.alive = false
        pet.hp = 0
        this.clearTotemAurasForPet(pet)
      }
      return pet
    }

    for (let i = this.pets.length - 1; i >= 0; i--) {
      const p = this.pets[i]!
      if (p.alive === false || !p.unsummonable || p.petType === 'raven') continue
      const pOwner = String(p.ownerId ?? p.ownerUnitId)
      if (arg3 !== undefined) {
        if (
          (arg1 === undefined || pOwner === arg1) &&
          (arg2 === undefined || p.petType === arg2.toLowerCase()) &&
          (String(p.uid) === arg3 || String(p.id) === arg3)
        ) {
          return dismissAt(i)
        }
      } else if (arg1 !== undefined && arg2 !== undefined) {
        const arg1IsPetId = this.pets.some(x => String(x.uid) === arg1 || String(x.id) === arg1)
        if (arg1IsPetId) {
          if ((String(p.uid) === arg1 || String(p.id) === arg1) && pOwner === arg2) {
            return dismissAt(i)
          }
        } else if (pOwner === arg1 && p.petType === arg2.toLowerCase()) {
          return dismissAt(i)
        }
      } else if (arg1 !== undefined) {
        const matchesPetDirectly = this.pets.some(
          x => String(x.uid) === arg1 || String(x.id) === arg1 || x.petType === arg1.toLowerCase(),
        )
        if (matchesPetDirectly) {
          if (String(p.uid) === arg1 || String(p.id) === arg1 || p.petType === arg1.toLowerCase()) {
            return dismissAt(i)
          }
        } else if (pOwner === arg1) {
          return dismissAt(i)
        }
      } else {
        return dismissAt(i)
      }
    }
    return null
  }

  /**
   * Step all active pets, traps, vines, totems, and hydras (`17` sub-skills `281..338`).
   */
  tickPets(params: {
    currentTick: number
    owner: CombatUnitContext
    allies?: readonly CombatUnitContext[]
    enemies: readonly CombatUnitContext[]
    enemyPositions: ReadonlyMap<string, { x: number; y: number }>
    corpses?: { id: string; consumed: boolean; baseMaxHp?: number; isBoss?: boolean; shattered?: boolean; isCorpse?: boolean; x?: number; y?: number }[]
    missileEngine: MissileEngine
    auraScanner: AuraScanner
    coordScale?: number | undefined
    respectAiDelay?: boolean | undefined
    enforceMeleeReach?: boolean | undefined
    canStep?: ((pet: SummonedPetUnit, nextX: number, nextY: number) => boolean) | undefined
  }): {
    petAttacks: number
    subSkillsExecuted: number[]
    damageDealt: number
    corpsesConsumedByPets: number
  } {
    let petAttacks = 0
    const subSkillsExecuted: number[] = []
    let damageDealt = 0
    let corpsesConsumedByPets = 0
    const scale = params.coordScale ?? SUBTILE_PIXELS_113C

    const stationaryKinds = new Set([
      'dopplezon',
      'decoy',
      'hydra',
      'bonewall',
      'blade_sentinel',
      'wake_of_fire',
      'wake_of_inferno',
      'lightning_sentry',
      'ChargedBoltSentry',
      'death_sentry',
    ])
    const aliveEnemies = params.enemies.filter(e => e.statList.getHp256() > 0)
    const targetableEnemies = aliveEnemies.filter(e => {
      const ext = e as {
        petIgnore?: boolean
        inTown?: boolean
        killable?: boolean
        align?: number
        stats?: {
          petIgnore?: boolean
          inTown?: boolean
          killable?: boolean
          align?: number
        }
      }
      if (ext.petIgnore === true || ext.stats?.petIgnore === true) return false
      if (ext.inTown === true || ext.stats?.inTown === true) return false
      if (ext.killable === false || ext.stats?.killable === false) return false
      if ((ext.align ?? ext.stats?.align ?? 0) !== 0) return false
      return true
    })

    for (let i = this.pets.length - 1; i >= 0; i -= 1) {
      const pet = this.pets[i]!
      if (pet.statList.getHp256() <= 0) {
        pet.hp = 0
        pet.alive = false
      }
      if (pet.hp <= 0 || pet.shotsRemaining <= 0) {
        this.clearTotemAurasForPet(pet, params.owner)
        this.pets.splice(i, 1)
        continue
      }

      // Expire Fenris Rage (`#314`) after 500 frames (20s)
      if (pet.rageBuffActive && pet.rageExpireFrame !== undefined && params.currentTick >= pet.rageExpireFrame) {
        pet.rageBuffActive = false
        pet.rageExpireFrame = undefined
        pet.stateBus.removeState('fenris_rage')
      }

      // Revive lifespan countdown (180s / 4500 frames)
      if (pet.lifespanTicks !== undefined) {
        pet.lifespanTicks -= 1
        if (pet.lifespanTicks <= 0) {
          this.clearTotemAurasForPet(pet, params.owner)
          this.pets.splice(i, 1)
          continue
        }
      }

      // DRLG oracle path: AI owned by the 1:1 NecroPet port (`stepNecroPet113c`).
      if (pet.oracleAi113c !== undefined) continue

      const aiProfile = resolvePetAiProfile113c(pet, this.pets.length)
      const isStationary = aiProfile.isStationary
      const teleportPx = aiProfile.teleportSubtiles * scale
      const leashRunPx = aiProfile.leashRunSubtiles * scale
      const followWalkPx = aiProfile.followWalkSubtiles * scale
      const aggroPx = aiProfile.aggroSubtiles * scale
      const meleeReachPx = aiProfile.meleeReachSubtiles * scale

      let leashTeleported = false
      if (!isStationary && teleportPx > 0 && params.owner.x !== undefined && params.owner.y !== undefined) {
        const ownerDx = params.owner.x - pet.x
        const ownerDy = params.owner.y - pet.y
        const ownerDist = Math.hypot(ownerDx, ownerDy)
        if (ownerDist > teleportPx) {
          pet.x = params.owner.x
          pet.y = params.owner.y
          leashTeleported = true
        } else if (targetableEnemies.length === 0 && followWalkPx > 0 && ownerDist > followWalkPx) {
          const moveVel = ownerDist > leashRunPx ? aiProfile.runVelocity : aiProfile.velocity
          const speedPxPerTick = (moveVel * scale) / 25
          const step = Math.min(speedPxPerTick, ownerDist - followWalkPx)
          const nx = pet.x + (ownerDx / ownerDist) * step
          const ny = pet.y + (ownerDy / ownerDist) * step
          if (!params.canStep || params.canStep(pet, nx, ny)) {
            pet.x = nx
            pet.y = ny
          }
        }
      }

      let primaryTarget: CombatUnitContext | undefined
      let primaryPos = { x: pet.x, y: pet.y }
      let bestEnemyDist = aggroPx > 0 ? aggroPx : 0
      for (const enemy of targetableEnemies) {
        if (aggroPx <= 0) break
        const explicitPos = params.enemyPositions.get(enemy.id)
        const pos =
          explicitPos ??
          (enemy.x !== undefined || enemy.y !== undefined
            ? { x: enemy.x ?? pet.x, y: enemy.y ?? pet.y }
            : { x: pet.x, y: pet.y })
        const d = Math.hypot(pos.x - pet.x, pos.y - pet.y)
        if (d <= bestEnemyDist && (primaryTarget === undefined || d < bestEnemyDist)) {
          bestEnemyDist = d
          primaryTarget = enemy
          primaryPos = pos
        }
      }
      pet.targetId = primaryTarget?.id

      const tickGlobalAllSkills = params.owner.statList.getEffectiveSkillLevel(0)
      const getTickOwnedEffectiveSkillLvl = (sId: number): number => {
        const base = params.owner.statList.getBaseSkillLevel(sId)
        const eff = params.owner.statList.getEffectiveSkillLevel(sId)
        if (base === 0 && eff <= tickGlobalAllSkills) return 0
        return eff
      }
      const skelMasteryLvl = pet.snapshottedSkelMasteryLvl ?? getTickOwnedEffectiveSkillLvl(69)
      const golemMasteryLvl = pet.snapshottedGolemMasteryLvl ?? getTickOwnedEffectiveSkillLvl(79)
      const golemSynergies = {
        clayGolemBlvl: params.owner.statList.getBaseSkillLevel(75),
        bloodGolemBlvl: params.owner.statList.getBaseSkillLevel(85),
        ironGolemBlvl: params.owner.statList.getBaseSkillLevel(90),
        fireGolemBlvl: params.owner.statList.getBaseSkillLevel(94),
      }

      // Fire Golem Holy Fire pulse every 50 ticks (2.0s)
      if (pet.kind === 'fire_golem' && params.currentTick % 50 === 0) {
        const fgStats = calculateFireGolemStats(pet.slvl, golemMasteryLvl, golemSynergies)
        const pulseRadiusPx = fgStats.holyFireRadiusSubtiles * (scale === SUBTILE_PIXELS_113C ? 32 : scale)
        for (const enemy of aliveEnemies) {
          const ePos =
            params.enemyPositions.get(enemy.id) ??
            (enemy.x !== undefined && enemy.y !== undefined
              ? { x: enemy.x, y: enemy.y }
              : { x: 0, y: (120 * scale) / SUBTILE_PIXELS_113C })
          const dx = ePos.x - pet.x
          const dy = ePos.y - pet.y
          const inPulseRange =
            scale === SUBTILE_PIXELS_113C
              ? dx * dx + 4 * dy * dy <= pulseRadiusPx * pulseRadiusPx
              : dx * dx + dy * dy <= pulseRadiusPx * pulseRadiusPx
          if (inPulseRange) {
            const out = executeSUnitDmg(params.owner, enemy, {
              skillId: 94,
              attackKind: 'spell',
              elemType: 'fire',
              elemMin256: fgStats.holyFirePulseMin256,
              elemMax256: fgStats.holyFirePulseMax256,
              autoHit: true,
            }, this.rng)
            damageDealt += out.totalDamage
          }
        }
      }

      const aiCooldownReady =
        !params.respectAiDelay ||
        pet.nextActionFrame === undefined ||
        params.currentTick >= pet.nextActionFrame
      const markSubSkillCooldown = () => {
        if (params.respectAiDelay) {
          pet.nextActionFrame = params.currentTick + Math.max(10, aiProfile.aiDelayFrames)
        }
      }

      // Execute pet's AI sub-skills (`IDs 281..338`)
      for (const subId of pet.subSkillIds) {
        const subSkill = this.registry.getSkillById(subId)
        if (!subSkill) continue

        // Totem Auras (`296` Oak Sage Aura, `297` Wolverine Aura, `298` Barbs Aura)
        if (subId === 296 || subId === 297 || subId === 298) {
          const auraSrc = params.auraScanner.setActiveAura(pet, subId, pet.slvl, params.currentTick)
          if (auraSrc) {
            const friendlyUnits: CombatUnitContext[] = [
              params.owner,
              ...(params.allies ?? []),
              ...this.pets.filter(p => p.uid !== pet.uid && p.hp > 0),
            ]
            params.auraScanner.pulseAura(auraSrc, params.currentTick, friendlyUnits, aliveEnemies)
            subSkillsExecuted.push(subId)
          }
          continue
        }

        // Corpse-consuming vines & dire wolves (`307` CorpseCycler, `325` VineCycler, `314` fenris rage)
        if ((subId === 307 || subId === 325 || subId === 314) && params.corpses) {
          if (!aiCooldownReady) continue
          if (subId === 314 && pet.rageBuffActive) {
            continue
          }
          if (subId === 307 && params.owner.statList.getHp256() >= params.owner.statList.getMaxHp256()) {
            continue
          }
          if (subId === 325 && params.owner.statList.getMana256() >= params.owner.statList.getMaxMana256()) {
            continue
          }
          const corpse = params.corpses.find(
            c => c && !c.consumed && !c.isBoss && !c.shattered && c.isCorpse !== false
          )
          if (corpse) {
            corpse.consumed = true
            corpsesConsumedByPets += 1
            subSkillsExecuted.push(subId)
            markSubSkillCooldown()
            if (subId === 307) {
              // Carrion Vine (#231 -> #307 CorpseCycler): heals owner dm12(3, 12)% max HP, clamped to maxHp256
              const cvSub = calculateCorpseCyclerStats(pet.slvl)
              const maxHp256 = params.owner.statList.getMaxHp256()
              const heal256 = Math.floor((maxHp256 * cvSub.healMaxHpPct) / 100)
              params.owner.statList.setHp256(Math.min(maxHp256, params.owner.statList.getHp256() + heal256))
            } else if (subId === 325) {
              // Solar Creeper (#241 -> #325 VineCycler): restores owner dm12(1, 8)% max Mana, clamped to maxMana256
              const scSub = calculateVineCyclerStats(pet.slvl)
              const maxMana256 = params.owner.statList.getMaxMana256()
              const mana256 = Math.floor((maxMana256 * scSub.manaRecoverMaxPct) / 100)
              params.owner.statList.setMana256(Math.min(maxMana256, params.owner.statList.getMana256() + mana256))
            } else if (subId === 314) {
              // Dire Wolf (#237 -> #314 fenris rage): 500 frames (20s) of +100 + 4*(slvl-1)% damage & AR
              const frStats = calculateFenrisRageStats(pet.slvl)
              pet.rageBuffActive = true
              pet.rageExpireFrame = params.currentTick + frStats.durationFrames
              pet.stateBus.applyState({
                stateNameOrId: 'fenris_rage',
                sourceUnitId: pet.id,
                sourceSkillId: 314,
                slvl: pet.slvl,
                durationFrames: frStats.durationFrames,
                currentFrame: params.currentTick,
                stats: {
                  damagepercent: frStats.damageBonusPct,
                  item_tohit_percent: frStats.attackRatingBonusPct,
                },
              })
            }
          }
          continue
        }

        // Poison Creeper (`#222`) `Vine Attack` (`#294`)
        if (subId === 294 && primaryTarget) {
          if (!aiCooldownReady) continue
          const pcStats = calculatePoisonCreeperStats(pet.slvl, params.owner.statList.getAccruedStat('level'))
          const mslName = subSkill.srvMissileA || subSkill.srvMissile || 'plague vines'
          params.missileEngine.spawnMissile({
            missileNameOrId: mslName,
            sourceSkillId: pet.sourceSkillId,
            slvl: pet.slvl,
            owner: params.owner,
            startX: pet.x,
            startY: pet.y,
            targetX: primaryPos.x,
            targetY: primaryPos.y,
            dmgPacket: {
              skillId: pet.sourceSkillId,
              attackKind: 'spell',
              elemType: 'pois',
              elemMin256: pcStats.totalPoisonMin256,
              elemMax256: pcStats.totalPoisonMax256,
              elemDurationFrames: pcStats.poisonLengthFrames,
              autoHit: true,
            },
          })
          const out = executeSUnitDmg(params.owner, primaryTarget, {
            skillId: pet.sourceSkillId,
            attackKind: 'spell',
            elemType: 'pois',
            elemMin256: pcStats.totalPoisonMin256,
            elemMax256: pcStats.totalPoisonMax256,
            elemDurationFrames: pcStats.poisonLengthFrames,
            autoHit: true,
          }, this.rng)
          primaryTarget.stateBus.applyState({
            stateNameOrId: 'poison',
            sourceUnitId: pet.id,
            sourceSkillId: pet.sourceSkillId,
            slvl: pet.slvl,
            durationFrames: pcStats.poisonLengthFrames,
            currentFrame: params.currentTick,
            stats: {
              poisonmindam: rollDamageRange256(pcStats.poisonMinRate256, pcStats.poisonMaxRate256, this.rng),
            },
          })
          damageDealt += out.totalDamage
          subSkillsExecuted.push(294)
          petAttacks += 1
          markSubSkillCooldown()
          continue
        }

        // Spirit Wolf / Shadow Teleport (`#292` — suppressed on the same tick as a > 50-subtile leash teleport)
        if (subId === 292) {
          if (!leashTeleported && primaryTarget) {
            const dx = primaryPos.x - pet.x
            const dy = primaryPos.y - pet.y
            const teleDist = scale === SUBTILE_PIXELS_113C ? Math.hypot(dx, dy * 2) : Math.hypot(dx, dy)
            if (teleDist > 5 * scale && (!params.canStep || params.canStep(pet, primaryPos.x, primaryPos.y))) {
              pet.x = primaryPos.x
              pet.y = primaryPos.y
              subSkillsExecuted.push(292)
            }
          }
          continue
        }

        // Death Sentry (`312` `mon death sentry`): explodes an available corpse if present!
        if (subId === 312 && params.corpses) {
          if (!aiCooldownReady) continue
          const ceRadiusSubtiles = 10 + (pet.slvl - 1)
          const ceRadiusPx = ceRadiusSubtiles * scale
          // 1.13c Ground Truth: Rejects consumed, boss, and shattered (frozen) corpses
          const corpse = params.corpses.find(
            c => c && !c.consumed && !c.isBoss && !c.shattered && c.isCorpse !== false
          )
          if (corpse && primaryTarget) {
            corpse.consumed = true
            corpsesConsumedByPets += 1
            subSkillsExecuted.push(subId)
            pet.shotsRemaining -= 1
            markSubSkillCooldown()

            // 1.13c Death Sentry (`#312` `mon death sentry`, `Skills.txt` `Param1 = 40`, `Param2 = 80`):
            // 40% to 80% of `/players 1` unscaled normal base monster HP (50% phys / 50% fire).
            const sub312 = this.registry.getSkillById(312)
            const minPct = sub312?.param1 || 40
            const maxPct = sub312?.param2 || 80
            const baseHp = corpse.baseMaxHp ?? 1000
            const minDmg = Math.trunc((baseHp * minPct) / 100) * FIXED_ONE
            const maxDmg = Math.trunc((baseHp * maxPct) / 100) * FIXED_ONE

            const corpseX = (corpse as any).x ?? primaryPos.x
            const corpseY = (corpse as any).y ?? primaryPos.y
            const sentryOwnerCtx: CombatUnitContext =
              pet.petType === 'assassintrap'
                ? {
                    id: pet.uid,
                    name: pet.kind ?? 'sentry',
                    unitType: 'monster',
                    statList: pet.statList,
                    stateBus: pet.stateBus,
                    x: pet.x,
                    y: pet.y,
                  }
                : params.owner

            // Radial AoE hitting all enemies within corpse explosion radius
            for (const enemy of params.enemies) {
              if (enemy.statList.getHp256() <= 0) continue
              const pos = params.enemyPositions.get(enemy.id) ?? {
                x: primaryTarget.id === enemy.id ? primaryPos.x : 0,
                y: primaryPos.y,
              }
              const dx = pos.x - corpseX
              const dy = pos.y - corpseY
              if (dx * dx + dy * dy <= ceRadiusPx * ceRadiusPx) {
                const out = executeSUnitDmg(sentryOwnerCtx, enemy, {
                  skillId: 312,
                  attackKind: 'spell',
                  flatPhysMin256: Math.trunc(minDmg / 2),
                  flatPhysMax256: Math.trunc(maxDmg / 2),
                  elemType: 'fire',
                  elemMin256: Math.trunc(minDmg / 2),
                  elemMax256: Math.trunc(maxDmg / 2),
                  passiveEnemyPierce: 0,
                  autoHit: true,
                }, this.rng)
                damageDealt += out.totalDamage
              }
            }
            petAttacks += 1
            break
          }
        }

        // Missile-firing traps, hydras, and skeletal mages (`281`, `306`, `311`, `313`, `324`, `337`, `338`)
        if (
          primaryTarget &&
          (subId === 281 ||
            subId === 306 ||
            subId === 311 ||
            subId === 313 ||
            subId === 324 ||
            subId === 337 ||
            subId === 338)
        ) {
          if (!aiCooldownReady) continue
          const mageMsl =
            pet.kind === 'skeleton_mage'
              ? calculateNecromageMissileDamage(pet.mageElement ?? 'fire', pet.slvl, skelMasteryLvl)
              : null
          const isAssTrapSub =
            pet.petType === 'assassintrap' &&
            (subId === 281 || subId === 306 || subId === 311 || subId === 313 || subId === 324)
          const trapDmg = isAssTrapSub
            ? calcSentrySubSkillDamage113c(subId, pet.slvl, id => params.owner.statList.getBaseSkillLevel(id))
            : null
          const hydraDmg =
            subId === 337
              ? (() => {
                  const s = Math.max(1, pet.slvl)
                  const tierSum = (base: number, l1: number, l2: number, l3: number, l4: number, l5: number) =>
                    base +
                    Math.min(Math.max(0, s - 1), 7) * l1 +
                    Math.min(Math.max(0, s - 8), 8) * l2 +
                    Math.min(Math.max(0, s - 16), 6) * l3 +
                    Math.min(Math.max(0, s - 22), 6) * l4 +
                    Math.max(0, s - 28) * l5
                  // 1.13c Skills.txt #62 Hydra: EMin=28, EMax=39, EMinLev=[11,15,19,23,27], EMaxLev=[13,17,21,25,29],
                  // HitShift=7 (*128 in 256ths), EDmgSymPerCalc=(FireBolt.blvl + FireBall.blvl)*3
                  const synPct =
                    (params.owner.statList.getBaseSkillLevel(36) + params.owner.statList.getBaseSkillLevel(47)) * 3
                  const fmSlvl = params.owner.statList.getEffectiveSkillLevel(61)
                  const fmPct =
                    params.owner.statList.getAccruedStat('passive_fire_mastery') === 0 && fmSlvl > 0
                      ? 30 + (fmSlvl - 1) * 7
                      : 0
                  const rawMin256 = tierSum(28, 11, 15, 19, 23, 27) * 128
                  const rawMax256 = tierSum(39, 13, 17, 21, 25, 29) * 128
                  const synMin256 = Math.floor((rawMin256 * (100 + synPct)) / 100)
                  const synMax256 = Math.floor((rawMax256 * (100 + synPct)) / 100)
                  return {
                    min256: Math.floor((synMin256 * (100 + fmPct)) / 100),
                    max256: Math.floor((synMax256 * (100 + fmPct)) / 100),
                  }
                })()
              : null
          const elem = mageMsl
            ? mageMsl.elemType
            : trapDmg
              ? trapDmg.elemType
              : subId === 281 || subId === 311 || subId === 337
                ? 'fire'
                : 'ltng'

          const mslName = mageMsl
            ? mageMsl.missileName
            : subId === 306
              ? 'sentrychargedbolt'
              : subId === 281
                ? 'wake of destruction maker'
                : subId === 311
                  ? 'inferno sentry 1'
                  : subId === 313 || subId === 324
                    ? 'sentrylightningbolt'
                    : subId === 337
                      ? subSkill.srvMissile || subSkill.srvMissileA || 'hydra'
                      : subSkill.srvMissile || subSkill.srvMissileA || 'sentrylightningbolt'

          const minElem = mageMsl
            ? mageMsl.minDamage256
            : trapDmg
              ? trapDmg.minDmg * FIXED_ONE
              : hydraDmg
                ? hydraDmg.min256
                : (25 + pet.slvl * 12) * FIXED_ONE
          const maxElem = mageMsl
            ? mageMsl.maxDamage256
            : trapDmg
              ? trapDmg.maxDmg * FIXED_ONE
              : hydraDmg
                ? hydraDmg.max256
                : (45 + pet.slvl * 18) * FIXED_ONE

          // 1.13c Sentry / Minion owner isolation (#1874): ground sentries and skeleton mages are independent
          // minion units and do NOT inherit player +% Elemental Skill Damage or -% Enemy Resistance (`stats 329..336`).
          const mslOwner: CombatUnitContext =
            pet.petType === 'assassintrap' || Boolean(mageMsl)
              ? {
                  id: pet.uid,
                  name: pet.kind ?? 'sentry',
                  unitType: 'monster',
                  statList: pet.statList,
                  stateBus: pet.stateBus,
                  x: pet.x,
                  y: pet.y,
                }
              : params.owner

          if (subId === 306) {
            // #261 Charged Bolt Sentry: fires 5 + floor(ShockWeb.blvl / 3) bolts of 'sentrychargedbolt' per shot
            const boltCount = 5 + Math.floor(params.owner.statList.getBaseSkillLevel(256) / 3)
            const baseAngle = Math.atan2(primaryPos.y - pet.y, primaryPos.x - pet.x)
            const dist = Math.max(5 * scale, Math.hypot(primaryPos.x - pet.x, primaryPos.y - pet.y))
            for (let b = 0; b < boltCount; b++) {
              const offsetAngle = (b - (boltCount - 1) / 2) * 0.12
              const tx = b === 0 ? primaryPos.x : pet.x + Math.cos(baseAngle + offsetAngle) * dist
              const ty = b === 0 ? primaryPos.y : pet.y + Math.sin(baseAngle + offsetAngle) * dist
              params.missileEngine.spawnMissile({
                missileNameOrId: 'sentrychargedbolt',
                sourceSkillId: pet.sourceSkillId,
                slvl: pet.slvl,
                owner: mslOwner,
                startX: pet.x,
                startY: pet.y,
                targetX: tx,
                targetY: ty,
                dmgPacket: {
                  skillId: pet.sourceSkillId,
                  attackKind: 'spell',
                  elemType: elem,
                  elemMin256: minElem,
                  elemMax256: maxElem,
                  passiveEnemyPierce: 0,
                  autoHit: true,
                },
              })
            }
          } else if (subId === 281) {
            // #262 Wake of Fire: 'wake of destruction maker' + V-wing 'wake of destruction' (NextDelay = 4f)
            params.missileEngine.spawnMissile({
              missileNameOrId: 'wake of destruction maker',
              sourceSkillId: pet.sourceSkillId,
              slvl: pet.slvl,
              owner: mslOwner,
              startX: pet.x,
              startY: pet.y,
              targetX: primaryPos.x,
              targetY: primaryPos.y,
              nextDelayFrames: 4,
              dmgPacket: {
                skillId: pet.sourceSkillId,
                attackKind: 'spell',
                elemType: elem,
                elemMin256: minElem,
                elemMax256: maxElem,
                passiveEnemyPierce: 0,
                autoHit: true,
              },
            })
            params.missileEngine.spawnMissile({
              missileNameOrId: 'wake of destruction',
              sourceSkillId: pet.sourceSkillId,
              slvl: pet.slvl,
              owner: mslOwner,
              startX: pet.x,
              startY: pet.y,
              targetX: primaryPos.x,
              targetY: primaryPos.y,
              nextDelayFrames: 4,
              dmgPacket: {
                skillId: pet.sourceSkillId,
                attackKind: 'spell',
                elemType: elem,
                elemMin256: minElem,
                elemMax256: maxElem,
                passiveEnemyPierce: 0,
                autoHit: true,
              },
            })
          } else {
            params.missileEngine.spawnMissile({
              missileNameOrId: mslName,
              sourceSkillId: pet.sourceSkillId,
              slvl: mageMsl ? mageMsl.missileLevel : pet.slvl,
              owner: mslOwner,
              startX: pet.x,
              startY: pet.y,
              targetX: primaryPos.x,
              targetY: primaryPos.y,
              ...(subId === 313 || subId === 324 ? { nextDelayFrames: 4 } : {}),
              dmgPacket: {
                skillId: pet.sourceSkillId,
                attackKind: 'spell',
                elemType: elem,
                elemMin256: minElem,
                elemMax256: maxElem,
                ...(pet.petType === 'assassintrap' ? { passiveEnemyPierce: 0 } : {}),
                ...(mageMsl && mageMsl.durationFrames > 0 ? { elemDurationFrames: mageMsl.durationFrames } : {}),
                autoHit: true,
              },
            })
          }
          subSkillsExecuted.push(subId)
          petAttacks += 1
          markSubSkillCooldown()
          if (pet.petType === 'assassintrap') {
            pet.shotsRemaining -= 1
          }
        }
      }

      if (!leashTeleported && aiProfile.canMeleeAttack && primaryTarget) {
        const curDx = primaryPos.x - pet.x
        const curDy = primaryPos.y - pet.y
        const curDist = Math.hypot(curDx, curDy)
        if (curDist > meleeReachPx) {
          const chaseVel = aiProfile.runVelocity > 0 ? aiProfile.runVelocity : aiProfile.velocity
          const speedPxPerTick = (chaseVel * scale) / 25
          const step = Math.min(speedPxPerTick, curDist - meleeReachPx)
          const nx = pet.x + (curDx / curDist) * step
          const ny = pet.y + (curDy / curDist) * step
          if (!params.canStep || params.canStep(pet, nx, ny)) {
            pet.x = nx
            pet.y = ny
          }
        }
      }

      // Standard melee attack for non-totem, non-vine combat pets (`Skeleton`, `Golem`, `Raven`, `Wolf`, `Grizzly`, `Valkyrie`, `Shadow`)
      // Stationary Decoy (dopplezon), Hydras, Traps, Totems (`totem`), and Vines (`vine`) cannot execute standard melee attacks
      const withinMeleeReach =
        !params.enforceMeleeReach ||
        (primaryTarget !== undefined && Math.hypot(primaryPos.x - pet.x, primaryPos.y - pet.y) <= meleeReachPx + 0.75 * scale)
      if (
        primaryTarget &&
        aiProfile.canMeleeAttack &&
        withinMeleeReach &&
        (params.currentTick % 10 === 0 ||
          ((pet.kind === 'shadow_warrior' || pet.kind === 'shadow_master') && params.currentTick % 5 === 0))
      ) {
        let physMin256: number
        let physMax256: number
        let elemType: 'fire' | undefined
        let elemMin256: number | undefined
        let elemMax256: number | undefined
        let stunDurationFrames: number | undefined
        let knockback: boolean | undefined

        if (pet.kind === 'skeleton') {
          const skelStats = calculateRaiseSkeletonStats(pet.slvl, skelMasteryLvl)
          const rageMult = pet.rageBuffActive ? 2 : 1
          physMin256 = Math.floor(skelStats.minDamage * rageMult * FIXED_ONE)
          physMax256 = Math.floor(skelStats.maxDamage * rageMult * FIXED_ONE)
        } else if (pet.kind === 'valkyrie') {
          const valkStr = pet.statList.getAccruedStat('strength') || 25 * pet.slvl
          const csChance = pet.statList.getAccruedStat('passive_critical_strike')
          const critMult = csChance > 0 && ((params.currentTick * 17 + pet.slvl * 31) % 100) < csChance ? 2 : 1
          const weapMin = pet.monEquipLoadout?.weaponMinDamage ?? 0
          const weapMax = pet.monEquipLoadout?.weaponMaxDamage ?? weapMin
          const offEd = pet.monEquipLoadout?.offWeapDamagePct ?? 0
          const mult = (1 + (valkStr + offEd) / 100) * critMult * (pet.rageBuffActive ? 2 : 1) * FIXED_ONE
          physMin256 = Math.floor((20 + pet.slvl * 10 + weapMin) * mult)
          physMax256 = Math.floor((20 + pet.slvl * 10 + weapMax) * mult)
          if (pet.monEquipLoadout?.knockback) knockback = true
        } else if (pet.kind === 'clay_golem') {
          const cgStats = calculateClayGolemStats(pet.slvl, golemMasteryLvl, golemSynergies.bloodGolemBlvl, golemSynergies)
          physMin256 = cgStats.minDamage * FIXED_ONE
          physMax256 = cgStats.maxDamage * FIXED_ONE
        } else if (pet.kind === 'blood_golem') {
          const bgStats = calculateBloodGolemStats(pet.slvl, golemMasteryLvl, golemSynergies)
          physMin256 = bgStats.minDamage * FIXED_ONE
          physMax256 = bgStats.maxDamage * FIXED_ONE
        } else if (pet.kind === 'iron_golem') {
          const igStats = calculateIronGolemStats(pet.slvl, pet.ironGolemItem, golemMasteryLvl, golemSynergies)
          physMin256 = Math.max(igStats.minDamage, pet.statList.getAccruedStat('mindamage')) * FIXED_ONE
          physMax256 = Math.max(igStats.maxDamage, pet.statList.getAccruedStat('maxdamage')) * FIXED_ONE
        } else if (pet.kind === 'fire_golem') {
          const fgStats = calculateFireGolemStats(pet.slvl, golemMasteryLvl, golemSynergies)
          physMin256 = fgStats.minDamage * FIXED_ONE
          physMax256 = fgStats.maxDamage * FIXED_ONE
          elemType = 'fire'
          elemMin256 = fgStats.meleeFireMin * FIXED_ONE
          elemMax256 = fgStats.meleeFireMax * FIXED_ONE
        } else if (pet.kind === 'revive') {
          const skelMastery = calculateSkeletonMasteryStats(skelMasteryLvl)
          const rageMult = pet.rageBuffActive ? 2 : 1
          const baseMin = pet.baseMinDamage ?? 10
          const baseMax = pet.baseMaxDamage ?? Math.max(baseMin, 20)
          const minDmg = Math.floor((baseMin * (100 + skelMastery.damagePct)) / 100)
          const maxDmg = Math.floor((baseMax * (100 + skelMastery.damagePct)) / 100)
          physMin256 = Math.floor(minDmg * rageMult * FIXED_ONE)
          physMax256 = Math.floor(maxDmg * rageMult * FIXED_ONE)
          if (pet.monProps?.knockback) knockback = true
        } else if (pet.kind === 'raven' || pet.sourceSkillId === 221) {
          const ravenStats = calculateRavenStats(pet.slvl, params.owner.statList.getAccruedStat('level'))
          const totalEdPct = pet.statList.getAccruedStat('damagepercent')
          physMin256 = Math.floor((ravenStats.minDamage * (100 + totalEdPct)) / 100) * FIXED_ONE
          physMax256 = Math.floor((ravenStats.maxDamage * (100 + totalEdPct)) / 100) * FIXED_ONE
        } else if (pet.kind === 'spirit_wolf' || pet.sourceSkillId === 227) {
          const swBase = calculateSummonSpiritWolfStats(pet.slvl, 0, 0)
          const totalEdPct = pet.statList.getAccruedStat('damagepercent')
          physMin256 = Math.floor((swBase.minDamage * (100 + totalEdPct)) / 100) * FIXED_ONE
          physMax256 = Math.floor((swBase.maxDamage * (100 + totalEdPct)) / 100) * FIXED_ONE
        } else if (pet.kind === 'dire_wolf' || pet.sourceSkillId === 237) {
          const dwBase = calculateSummonDireWolfStats(pet.slvl, 0, 0)
          const rageEd =
            pet.rageBuffActive && !pet.stateBus.hasState('fenris_rage')
              ? calculateFenrisRageStats(pet.slvl).damageBonusPct
              : 0
          const totalEdPct = pet.statList.getAccruedStat('damagepercent') + rageEd
          physMin256 = Math.floor((dwBase.minDamage * (100 + totalEdPct)) / 100) * FIXED_ONE
          physMax256 = Math.floor((dwBase.maxDamage * (100 + totalEdPct)) / 100) * FIXED_ONE
        } else if (pet.kind === 'grizzly' || pet.sourceSkillId === 247) {
          const gzBase = calculateSummonGrizzlyStats(pet.slvl, 0, 0)
          const totalEdPct = pet.statList.getAccruedStat('damagepercent')
          physMin256 = Math.floor((gzBase.baseMinDamage * (100 + totalEdPct)) / 100) * FIXED_ONE
          physMax256 = Math.floor((gzBase.baseMaxDamage * (100 + totalEdPct)) / 100) * FIXED_ONE
          // 1.13c MonStats.txt druidbear (#428) aip3 = 50 (AITHINK_Fn112_DruidBear):
          // 50% chance to select Skill1 = BearSmite (#326, ResultFlags = 8 knockback + stun + ln12 %ED)
          if (pet.subSkillIds.includes(326) && this.rng.rand(100) < 50) {
            const bearSmite = calculateBearSmiteStats(pet.slvl)
            physMin256 = Math.floor((gzBase.baseMinDamage * (100 + totalEdPct + bearSmite.damageBonusPct)) / 100) * FIXED_ONE
            physMax256 = Math.floor((gzBase.baseMaxDamage * (100 + totalEdPct + bearSmite.damageBonusPct)) / 100) * FIXED_ONE
            stunDurationFrames = bearSmite.stunLengthFrames
            knockback = true
            subSkillsExecuted.push(326)
          }
        } else if (pet.kind === 'shadow_warrior' || pet.kind === 'shadow_master' || pet.sourceSkillId === 268 || pet.sourceSkillId === 279) {
          const weapMin = pet.monEquipLoadout?.weaponMinDamage ?? 0
          const weapMax = pet.monEquipLoadout?.weaponMaxDamage ?? weapMin
          const attrEd =
            Math.floor(((pet.monEquipLoadout?.strBonus ?? 0) + (pet.monEquipLoadout?.dexBonus ?? 0)) * 0.75) +
            (pet.monEquipLoadout?.offWeapDamagePct ?? 0)
          const mult = (1 + attrEd / 100) * (pet.rageBuffActive ? 2 : 1) * FIXED_ONE
          physMin256 = Math.floor((20 + pet.slvl * 10 + weapMin) * mult)
          physMax256 = Math.floor((20 + pet.slvl * 10 + weapMax) * mult)
          if (pet.monEquipLoadout?.knockback) knockback = true
          if (pet.shadowSkills && pet.shadowSkills.size > 0) {
            const preferredIds = [273, 253, 278, 267, 258, 264, 254, 255]
            let chosenId: number | undefined
            for (const pid of preferredIds) {
              if ((pet.shadowSkills.get(pid) ?? 0) > 0) {
                chosenId = pid
                break
              }
            }
            if (chosenId === undefined) {
              chosenId = pet.shadowSkills.keys().next().value
            }
            if (chosenId !== undefined) {
              subSkillsExecuted.push(chosenId)
            }
          }
        } else {
          const basePetPhys = Math.floor(
            (20 + pet.slvl * 10) * (pet.rageBuffActive ? 2 : 1) * FIXED_ONE,
          )
          physMin256 = basePetPhys
          physMax256 = basePetPhys
        }

        const out = executeSUnitDmg(pet, primaryTarget, {
          skillId: pet.sourceSkillId,
          attackKind: 'melee',
          srcDam: 0,
          ...(pet.monEquipLoadout ? { riderSrcDam: 128 } : {}),
          flatPhysMin256: physMin256,
          flatPhysMax256: physMax256,
          ...(elemType !== undefined && elemMin256 !== undefined && elemMax256 !== undefined
            ? { elemType, elemMin256, elemMax256 }
            : {}),
          ...(stunDurationFrames !== undefined ? { stunDurationFrames } : {}),
          ...(knockback ? { knockback: true } : {}),
        }, this.rng)
        damageDealt += out.totalDamage
        petAttacks += 1
        if (pet.monEquipLoadout && pet.monEquipLoadout.ctcProcs.length > 0) {
          for (const proc of pet.monEquipLoadout.ctcProcs) {
            const shouldCheck = proc.statId === 195 || (proc.statId === 198 && out.hit)
            if (!shouldCheck || proc.chancePct <= 0) continue
            if (this.rng.rand(100) >= proc.chancePct) continue
            subSkillsExecuted.push(proc.skillId)
            if (proc.skillId === 66) {
              primaryTarget.stateBus.applyState({
                stateNameOrId: 'amplifydamage',
                sourceUnitId: pet.id,
                sourceSkillId: 66,
                slvl: proc.slvl,
                durationFrames: Math.max(75, 200 + 75 * (proc.slvl - 1)),
                currentFrame: params.currentTick,
                stats: { damageresist: -100 },
              })
            } else if (proc.skillId === 87) {
              primaryTarget.stateBus.applyState({
                stateNameOrId: 'decrepify',
                sourceUnitId: pet.id,
                sourceSkillId: 87,
                slvl: proc.slvl,
                durationFrames: Math.max(75, 100 + 15 * (proc.slvl - 1)),
                currentFrame: params.currentTick,
                stats: { damageresist: -50, velocitypercent: -50, damagepercent: -50 },
              })
            } else if (proc.skillId === 72) {
              primaryTarget.stateBus.applyState({
                stateNameOrId: 'weaken',
                sourceUnitId: pet.id,
                sourceSkillId: 72,
                slvl: proc.slvl,
                durationFrames: Math.max(75, 350 + 60 * (proc.slvl - 1)),
                currentFrame: params.currentTick,
                stats: { damagepercent: -(33 + Math.floor((proc.slvl - 1) * 1.2)) },
              })
            } else if (proc.skillId === 91) {
              const lrPen = Math.min(70, 31 + proc.slvl * 2)
              primaryTarget.stateBus.applyState({
                stateNameOrId: 'lowerresist',
                sourceUnitId: pet.id,
                sourceSkillId: 91,
                slvl: proc.slvl,
                durationFrames: Math.max(75, 500 + 50 * (proc.slvl - 1)),
                currentFrame: params.currentTick,
                stats: {
                  fireresist: -lrPen,
                  lightresist: -lrPen,
                  coldresist: -lrPen,
                  poisonresist: -lrPen,
                },
              })
            } else if (proc.skillId === 71 && !primaryTarget.isBoss) {
              primaryTarget.stateBus.applyState({
                stateNameOrId: 'dimvision',
                sourceUnitId: pet.id,
                sourceSkillId: 71,
                slvl: proc.slvl,
                durationFrames: Math.max(50, 175 + 50 * (proc.slvl - 1)),
                currentFrame: params.currentTick,
              })
            }
          }
        }
        if (out.hit && stunDurationFrames !== undefined && stunDurationFrames > 0 && !primaryTarget.isBoss) {
          primaryTarget.stateBus.applyState({
            stateNameOrId: 'stun',
            sourceUnitId: pet.id,
            sourceSkillId: 326,
            slvl: pet.slvl,
            durationFrames: stunDurationFrames,
            currentFrame: params.currentTick,
          })
        }
        if (out.hit && knockback && !primaryTarget.isBoss) {
          const targetPos = params.enemyPositions.get(primaryTarget.id) as { x: number; y: number } | undefined
          if (targetPos) {
            const kdx = targetPos.x - pet.x
            const kdy = targetPos.y - pet.y
            const klen = Math.hypot(kdx, kdy) || 1
            const kbDist = 1.5 * scale
            const nx = targetPos.x + (kdx / klen) * kbDist
            const ny = targetPos.y + (kdy / klen) * kbDist
            if (!params.canStep || params.canStep(pet, nx, ny)) {
              targetPos.x = scale === SUBTILE_PIXELS_113C ? Math.round(nx) : nx
              targetPos.y = scale === SUBTILE_PIXELS_113C ? Math.round(ny) : ny
            }
          }
        }
        if (pet.petType === 'raven') {
          pet.shotsRemaining -= 1
          // 1.13c SKILLS_SrvDo097_RavenAttack (0x6FC676C0):
          // Blinds normal monsters (`!isBoss && !isUnique && !isChampion && !isSuperUnique`) with
          // chance = clamp(50 + 5 * (ownerLevel - 2 + slvl - targetLevel), 5, 100)% -> applies `dimvision` (state 23)
          const isSpecialTarget = Boolean(
            primaryTarget.isBoss ||
            (primaryTarget as any).isUnique ||
            (primaryTarget as any).isChampion ||
            (primaryTarget as any).isSuperUnique,
          )
          if (out.hit && !isSpecialTarget) {
            const ownerLvl = params.owner.statList.getAccruedStat('level')
            const targetLvl = primaryTarget.statList.getAccruedStat('level')
            const rBlind = calculateRavenStats(pet.slvl, ownerLvl, targetLvl)
            const blindRoll = (primaryTarget as any).blindRoll100 ?? ((params.currentTick * 13 + 7) % 100)
            if (blindRoll < rBlind.blindChancePct) {
              primaryTarget.stateBus.applyState({
                stateNameOrId: 'dimvision',
                sourceUnitId: pet.id,
                sourceSkillId: 221,
                slvl: rBlind.dimVisionSlvl,
                durationFrames: rBlind.dimVisionDurationFrames,
                currentFrame: params.currentTick,
              })
            }
          }
        }

        // Clay Golem Slow-on-hit effect against defender (750 frames / 30s per EventFunc27_SlowTarget)
        if (out.hit && pet.kind === 'clay_golem' && pet.slowPct) {
          primaryTarget.stateBus.applyState({
            stateNameOrId: 'slowed',
            slvl: pet.slvl,
            durationFrames: 750,
            stats: { item_slow: pet.slowPct },
          })
        }

        // Blood Golem Life Link healing (EventFunc23_LifeBloodLink: dm12(75, 150) total leech, split 30% owner / 70% golem with overflow)
        if (pet.kind === 'blood_golem' && pet.lifeLink && out.totalDamage > 0) {
          const leechPct = pet.lifeLink.lifeLeechPct ?? pet.lifeLink.healCasterPct
          const totalLeech256 = Math.floor((out.totalDamage * FIXED_ONE * leechPct) / 100)
          const ownerSharePct = pet.lifeLink.lifeLeechPct !== undefined ? pet.lifeLink.healCasterPct : 30
          let ownerHeal256 = Math.floor((totalLeech256 * ownerSharePct) / 100)
          let golemHeal256 = totalLeech256 - ownerHeal256

          const petCurHp256 = pet.statList.getHp256()
          const petMaxHp256 = pet.statList.getMaxHp256()
          if (petCurHp256 + golemHeal256 > petMaxHp256) {
            const overflow256 = Math.max(0, petCurHp256 + golemHeal256 - petMaxHp256)
            ownerHeal256 += overflow256
          }
          const newPetHp256 = Math.min(petMaxHp256, petCurHp256 + golemHeal256)
          pet.statList.setHp256(newPetHp256)

          const curHp256 = params.owner.statList.getHp256()
          const maxHp256 = params.owner.statList.getMaxHp256()
          if (curHp256 + ownerHeal256 > maxHp256) {
            const ownerOverflow256 = Math.max(0, curHp256 + ownerHeal256 - maxHp256)
            const petAfterOverflow256 = Math.min(petMaxHp256, pet.statList.getHp256() + ownerOverflow256)
            pet.statList.setHp256(petAfterOverflow256)
          }
          const newHp256 = Math.min(maxHp256, curHp256 + ownerHeal256)
          params.owner.statList.setHp256(newHp256)
          pet.hp = pet.statList.getHp()
        }
      }
    }

    // Remove exhausted traps & ravens
    for (let i = this.pets.length - 1; i >= 0; i -= 1) {
      if (this.pets[i]!.shotsRemaining <= 0) {
        this.clearTotemAurasForPet(this.pets[i]!, params.owner)
        this.pets.splice(i, 1)
      }
    }

    return {
      petAttacks,
      subSkillsExecuted,
      damageDealt,
      corpsesConsumedByPets,
    }
  }

  getActivePets(): readonly SummonedPetUnit[] {
    return this.pets
  }

  removePetByUid(uid: string): SummonedPetUnit | null {
    const idx = this.pets.findIndex((p) => p.uid === uid)
    if (idx === -1) return null
    const pet = this.pets.splice(idx, 1)[0] ?? null
    if (pet) {
      pet.alive = false
      pet.hp = 0
      this.clearTotemAurasForPet(pet)
    }
    return pet
  }

  /**
   * Remove a killed or dismissed summon by `uid` / `id` and clear any totem aura it provided.
   */
  removePet(uidOrUnitId: string | number, owner?: CombatUnitContext): SummonedPetUnit | null {
    const key = String(uidOrUnitId)
    for (let i = this.pets.length - 1; i >= 0; i -= 1) {
      const pet = this.pets[i]!
      const unitId = (pet as unknown as { unitId?: number }).unitId
      if (
        String(pet.uid) === key ||
        String(pet.id) === key ||
        (unitId !== undefined && String(unitId) === key)
      ) {
        this.pets.splice(i, 1)
        pet.alive = false
        pet.hp = 0
        this.clearTotemAurasForPet(pet, owner)
        return pet
      }
    }
    return null
  }

  removeSummon(uidOrUnitId: string | number, owner?: CombatUnitContext): SummonedPetUnit | null {
    return this.removePet(uidOrUnitId, owner)
  }

  /**
   * Unsummon (#3): remove and return the caster's own pet nearest `(targetX, targetY)`
   * whose PetType.txt row has `unsummon = 1` (`SKILLS_SrvSt03_Unsummon` `0x6FCBFEF0`).
   */
  unsummonOwnPetAt(
    ownerId: string | number | undefined,
    targetX: number,
    targetY: number,
    hitRadius = UNSUMMON_PICK_RADIUS,
  ): SummonedPetUnit | null {
    return unsummonOwnPetAt({ pets: this.pets }, ownerId ?? '', targetX, targetY, hitRadius) as SummonedPetUnit | null
  }
}

/**
 * 1.13c combat world pixel-per-subtile scale (`1 subtile = 16 px`).
 */
export const SUBTILE_PIXELS_113C = 16

/**
 * 1.13c `D2Game.dll` + `MonStats.txt` AI profile for a summoned pet unit.
 * See `kb/monsters/d2game-pet-hireable-ai-113c.md` for exact VAs and disassembly.
 */
export interface PetAiProfile113c {
  readonly aiName:
    | 'NecroPet'
    | 'DruidWolf'
    | 'DruidBear'
    | 'Raven'
    | 'Totem'
    | 'Vines'
    | 'CycleOfLife'
    | 'ShadowWarrior'
    | 'ShadowMaster'
    | 'AssassinSentry'
    | 'DeathSentry'
    | 'Hydra'
    | 'Idle'
  readonly teleportSubtiles: number
  readonly leashRunSubtiles: number
  readonly followWalkSubtiles: number
  readonly aggroSubtiles: number
  readonly ownerAggroSubtiles: number
  readonly meleeReachSubtiles: number
  readonly velocity: number
  readonly runVelocity: number
  readonly aiDelayFrames: number
  readonly isStationary: boolean
  readonly canMeleeAttack: boolean
}

/**
 * Resolves the 1.13c `D2Game.dll` AI profile and `MonStats.txt` parameters for a summoned pet.
 *
 * - `NecroPet` (`0x6FC9CBE0`): teleport `> 50`, run leash `> 25`, walk follow `> 13/15/20` (by pet count), aggro `15`, melee reach `2`
 * - `DruidWolf` (`0x6FC3CA00`): teleport `> 50`, run leash `> 21`, walk follow `> 13`, aggro `20`, melee reach `2`, vel `11`, run `15`, aidel `13`
 * - `DruidBear` (`0x6FC3CB90`): teleport `> 50`, run leash `> 21`, walk follow `> 13`, aggro `20`, melee reach `2`, vel `9`, run `9`, aidel `14`
 * - `Raven` (`0x6FC3DA60`): teleport `> 50`, walk follow `> 12`, aggro `25`, melee reach `1`, vel `13`, aidel `15`
 * - `Totem` (`0x6FC3DC10`): teleport `> 30`, walk follow `> 12`, aggro `0` (aura sub-skill), vel `9`, aidel `15`
 * - `Vines` (`0x6FC3D140`): teleport `> 35`, walk follow `> 13`, aggro `15`, vel `8`, aidel `15`
 * - `CycleOfLife` (`0x6FC3D3A0`): teleport `> 35`, walk follow `> 13`, corpse scan `10`, vel `8`, aidel `15`
 * - `ShadowWarrior` (`0x6FC8A150`): teleport `> 50`, run leash `> 25`, walk follow `> 20`, aggro `20`, melee reach `2`, vel `9`, run `13`, aidel `10`
 * - `ShadowMaster` (`0x6FC89ED0`): teleport `> 50`, run leash `> 25`, walk follow `> 20`, aggro `20`, melee reach `2`, vel `9`, run `13`, aidel `5`
 * - `AssassinSentry` (`0x6FC898C0`) / `DeathSentry` (`0x6FC89C40`): stationary, aggro `25`, aidel `15`
 * - `Hydra` (`0x6FC5E220`): stationary, aggro `15`, aidel `15`
 * - `Idle` (`0x6FC5C150`, `dopplezon` `#356`, `bonewall` `#355`): stationary, velocity `0`
 */
export function resolvePetAiProfile113c(
  pet: {
    readonly kind?: string | undefined
    readonly petType?: string | undefined
    readonly sourceSkillId?: number | undefined
    readonly isStationary?: boolean | undefined
  },
  totalOwnerPets = 1,
): PetAiProfile113c {
  const kind = (pet.kind ?? '').toLowerCase()
  const petType = (pet.petType ?? '').toLowerCase()
  const skillId = pet.sourceSkillId ?? 0

  if (kind === 'hydra' || petType === 'hydra' || skillId === 62) {
    return {
      aiName: 'Hydra',
      teleportSubtiles: 0,
      leashRunSubtiles: 0,
      followWalkSubtiles: 0,
      aggroSubtiles: 15,
      ownerAggroSubtiles: 0,
      meleeReachSubtiles: 0,
      velocity: 0,
      runVelocity: 0,
      aiDelayFrames: 15,
      isStationary: true,
      canMeleeAttack: false,
    }
  }

  if (
    petType === 'assassintrap' ||
    kind === 'assassin_trap' ||
    kind === 'blade_sentinel' ||
    kind === 'wake_of_fire' ||
    kind === 'wake_of_inferno' ||
    kind === 'lightning_sentry' ||
    kind === 'chargedboltsentry' ||
    kind === 'death_sentry' ||
    skillId === 261 ||
    skillId === 262 ||
    skillId === 271 ||
    skillId === 272 ||
    skillId === 276
  ) {
    const isDeathSentry = kind === 'death_sentry' || skillId === 276
    return {
      aiName: isDeathSentry ? 'DeathSentry' : 'AssassinSentry',
      teleportSubtiles: 0,
      leashRunSubtiles: 0,
      followWalkSubtiles: 0,
      aggroSubtiles: 25,
      ownerAggroSubtiles: 0,
      meleeReachSubtiles: 0,
      velocity: 0,
      runVelocity: 0,
      aiDelayFrames: 15,
      isStationary: true,
      canMeleeAttack: false,
    }
  }

  if (
    pet.isStationary === true ||
    kind === 'dopplezon' ||
    kind === 'decoy' ||
    kind === 'bonewall' ||
    skillId === 28 ||
    skillId === 78 ||
    skillId === 88
  ) {
    return {
      aiName: 'Idle',
      teleportSubtiles: 0,
      leashRunSubtiles: 0,
      followWalkSubtiles: 0,
      aggroSubtiles: 0,
      ownerAggroSubtiles: 0,
      meleeReachSubtiles: 0,
      velocity: 0,
      runVelocity: 0,
      aiDelayFrames: 15,
      isStationary: true,
      canMeleeAttack: false,
    }
  }

  if (
    petType === 'totem' ||
    kind === 'oak_sage' ||
    kind === 'heart_of_wolverine' ||
    kind === 'spirit_of_barbs' ||
    skillId === 226 ||
    skillId === 236 ||
    skillId === 246
  ) {
    return {
      aiName: 'Totem',
      teleportSubtiles: 30,
      leashRunSubtiles: 12,
      followWalkSubtiles: 12,
      aggroSubtiles: 0,
      ownerAggroSubtiles: 0,
      meleeReachSubtiles: 0,
      velocity: 9,
      runVelocity: 9,
      aiDelayFrames: 15,
      isStationary: false,
      canMeleeAttack: false,
    }
  }

  if (
    petType === 'vine' ||
    kind === 'poison_creeper' ||
    kind === 'carrion_vine' ||
    kind === 'solar_creeper' ||
    skillId === 222 ||
    skillId === 231 ||
    skillId === 241
  ) {
    const isPoisonCreeper = kind === 'poison_creeper' || skillId === 222
    return {
      aiName: isPoisonCreeper ? 'Vines' : 'CycleOfLife',
      teleportSubtiles: 35,
      leashRunSubtiles: 13,
      followWalkSubtiles: 13,
      aggroSubtiles: isPoisonCreeper ? 15 : 10,
      ownerAggroSubtiles: isPoisonCreeper ? 15 : 0,
      meleeReachSubtiles: 0,
      velocity: 8,
      runVelocity: 8,
      aiDelayFrames: 15,
      isStationary: false,
      canMeleeAttack: false,
    }
  }

  if (kind === 'raven' || petType === 'raven' || skillId === 221) {
    return {
      aiName: 'Raven',
      teleportSubtiles: 50,
      leashRunSubtiles: 12,
      followWalkSubtiles: 12,
      aggroSubtiles: 25,
      ownerAggroSubtiles: 25,
      meleeReachSubtiles: 1,
      velocity: 13,
      runVelocity: 13,
      aiDelayFrames: 15,
      isStationary: false,
      canMeleeAttack: true,
    }
  }

  if (
    kind === 'spirit_wolf' ||
    kind === 'dire_wolf' ||
    petType === 'spiritwolf' ||
    petType === 'fenris' ||
    skillId === 227 ||
    skillId === 237
  ) {
    return {
      aiName: 'DruidWolf',
      teleportSubtiles: 50,
      leashRunSubtiles: 21,
      followWalkSubtiles: 13,
      aggroSubtiles: 20,
      ownerAggroSubtiles: 20,
      meleeReachSubtiles: 2,
      velocity: 11,
      runVelocity: 15,
      aiDelayFrames: 13,
      isStationary: false,
      canMeleeAttack: true,
    }
  }

  if (kind === 'grizzly' || petType === 'grizzly' || skillId === 247) {
    return {
      aiName: 'DruidBear',
      teleportSubtiles: 50,
      leashRunSubtiles: 21,
      followWalkSubtiles: 13,
      aggroSubtiles: 20,
      ownerAggroSubtiles: 20,
      meleeReachSubtiles: 2,
      velocity: 9,
      runVelocity: 9,
      aiDelayFrames: 14,
      isStationary: false,
      canMeleeAttack: true,
    }
  }

  if (kind === 'shadow_warrior' || skillId === 268) {
    return {
      aiName: 'ShadowWarrior',
      teleportSubtiles: 50,
      leashRunSubtiles: 25,
      followWalkSubtiles: 20,
      aggroSubtiles: 20,
      ownerAggroSubtiles: 20,
      meleeReachSubtiles: 2,
      velocity: 9,
      runVelocity: 13,
      aiDelayFrames: 10,
      isStationary: false,
      canMeleeAttack: true,
    }
  }

  if (kind === 'shadow_master' || petType === 'shadowwarrior' || skillId === 279) {
    return {
      aiName: 'ShadowMaster',
      teleportSubtiles: 50,
      leashRunSubtiles: 25,
      followWalkSubtiles: 20,
      aggroSubtiles: 20,
      ownerAggroSubtiles: 20,
      meleeReachSubtiles: 2,
      velocity: 9,
      runVelocity: 13,
      aiDelayFrames: 5,
      isStationary: false,
      canMeleeAttack: true,
    }
  }

  // Default: NecroPet (0x6FC9CBE0) — Valkyrie (#357), Clay/Blood/Iron/Fire Golem (#289..#292),
  // NecroSkeleton (#363), NecroMage (#364), Revive
  const isMage = kind === 'skeleton_mage' || petType === 'necromage' || skillId === 80
  const isGolem =
    kind === 'clay_golem' ||
    kind === 'blood_golem' ||
    kind === 'iron_golem' ||
    kind === 'fire_golem' ||
    petType === 'golem'
  const followWalkSubtiles = totalOwnerPets <= 3 ? 13 : totalOwnerPets <= 9 ? 15 : 20
  const velocity = isMage || isGolem ? 9 : 11
  return {
    aiName: 'NecroPet',
    teleportSubtiles: 50,
    leashRunSubtiles: 25,
    followWalkSubtiles,
    aggroSubtiles: 15,
    ownerAggroSubtiles: 15,
    meleeReachSubtiles: isMage ? 0 : 2,
    velocity,
    runVelocity: velocity,
    aiDelayFrames: isMage ? 10 : 15,
    isStationary: false,
    canMeleeAttack: !isMage,
  }
}

/** Scene-space pick radius for Unsummon's targeted pet (same metric as the corpse pick of 70/80/95). */
export const UNSUMMON_PICK_RADIUS = 80

export type ActivePet = SummonedPetUnit

/**
 * Unsummon (#3): remove and return the caster's own pet nearest `(x, y)` whose PetType.txt row has
 * `unsummon = 1` (SKILLS_SrvSt03_Unsummon 0x6FCBFEF0), or `null` when no such pet is under the cursor.
 *
 * Supports both call signatures:
 * 1. `unsummonOwnPetAt(player, x, y, hitRadius?)`
 * 2. `unsummonOwnPetAt(arenaOrManager, ownerId, targetX, targetY, hitRadius?)`
 */
export function unsummonOwnPetAt(
  player: {
    summons?: any[] | undefined
    combatContext?: { stateBus?: { removeState?(state: string): void } | undefined } | undefined
    activeDruidTotemAura?: unknown
  } | null | undefined,
  x: number,
  y: number,
  hitRadius?: number,
): { petType: string; uid: string; [key: string]: any } | null
export function unsummonOwnPetAt(
  arena: { pets?: any[] | undefined; summons?: any[] | undefined } | SummonManager | null | undefined,
  ownerId: number | string,
  targetX: number,
  targetY: number,
  hitRadius?: number,
): { petType: string; uid: string; [key: string]: any } | null
export function unsummonOwnPetAt(
  targetHolder: any,
  arg1: number | string,
  arg2: number,
  arg3?: number,
  arg4?: number,
): { petType: string; uid: string; [key: string]: any } | null {
  if (!targetHolder) return null

  // Determine whether called as (player, x, y, hitRadius?) or (arena, ownerId, targetX, targetY, hitRadius?)
  const isFourOrFiveArg = arg4 !== undefined || (arg3 !== undefined && ('pets' in targetHolder || targetHolder instanceof SummonManager))
  const ownerId = isFourOrFiveArg ? arg1 : undefined
  const x = isFourOrFiveArg ? arg2 : Number(arg1)
  const y = isFourOrFiveArg ? Number(arg3 ?? 0) : arg2
  const radius = isFourOrFiveArg ? (arg4 ?? UNSUMMON_PICK_RADIUS) : (arg3 ?? UNSUMMON_PICK_RADIUS)

  const list: any[] = Array.isArray(targetHolder.summons)
    ? targetHolder.summons
    : Array.isArray(targetHolder.pets)
      ? targetHolder.pets
      : typeof targetHolder.getActivePets === 'function'
        ? (targetHolder.getActivePets() as any[])
        : []

  const useIsoAspect = Array.isArray(targetHolder.summons)
  let bestIdx = -1
  let bestDist = radius

  list.forEach((s, idx) => {
    if (!s || s.alive === false || typeof s.petType !== 'string') return
    if (s.unsummonable === false || !isPetTypeUnsummonable113c(s.petType)) return
    if (ownerId !== undefined && ownerId !== '') {
      const petOwner = s.ownerId ?? s.ownerUnitId
      if (petOwner !== undefined) {
        if (String(petOwner) !== String(ownerId)) return
      } else if (!Array.isArray(targetHolder.summons)) {
        // In a shared arena.pets pool, an unowned pet cannot be unsummoned by a specific ownerId
        return
      }
    }
    const dx = (s.x ?? 0) - x
    const dy = (s.y ?? 0) - y
    const d = useIsoAspect ? Math.hypot(dx, dy / ISO_GROUND_ASPECT_RATIO) : Math.hypot(dx, dy)
    if (d <= bestDist) {
      bestDist = d
      bestIdx = idx
    }
  })

  if (bestIdx < 0) return null
  const [pet] = list.splice(bestIdx, 1)
  if (pet?.petType === 'totem') {
    const sb = targetHolder?.combatContext?.stateBus ?? pet?.ownerRef?.stateBus
    if (sb && typeof sb.removeState === 'function') {
      sb.removeState('oaksage')
      sb.removeState('wolverine')
      sb.removeState('barbs')
    }
    if ('activeDruidTotemAura' in targetHolder) {
      targetHolder.activeDruidTotemAura = undefined
    }
  }
  if (!isFourOrFiveArg && Array.isArray(targetHolder.summons)) {
    return {
      petType: String(pet.petType),
      uid: String(pet.uid ?? pet.id),
    }
  }
  return Object.assign(pet, {
    petType: String(pet.petType),
    uid: String(pet.uid ?? pet.id),
  })
}


