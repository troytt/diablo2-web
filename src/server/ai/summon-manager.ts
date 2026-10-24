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
import { PET_SUB_SKILL_IDS, type D2DataRegistry, type SkillRecord } from '../../common/data/data-registry.ts'
import { evaluateCalc } from '../../common/data/calc-ast.ts'
import { SKILLS_BY_ID } from '../../common/data/skills-catalog.ts'
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
    | undefined
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
  shadowEquipment?: ShadowEquipmentLoadout | undefined
  shadowSkills?: ReadonlyMap<number, number> | undefined
  targetId?: string | number | undefined
}

export interface CreatePetOutcome {
  readonly created: boolean
  readonly reason?: 'missing_corpse' | 'invalid_skill' | 'invalid_item'
  readonly pet?: SummonedPetUnit
  readonly evictedPetUids: string[]
  readonly activeCountForType: number
}

const FALLBACK_SUMMON_SKILL_META: Readonly<
  Record<number, { readonly name: string; readonly petType: string; readonly summon: string; readonly petMax: string }>
> = {
  28: { name: 'Dopplezon', petType: 'dopplezon', summon: 'dopplezon', petMax: '1' },
  32: { name: 'Valkyrie', petType: 'valkyrie', summon: 'valkyrie', petMax: '1' },
  62: { name: 'Hydra', petType: 'hydra', summon: 'hydra1', petMax: '' },
  70: { name: 'Raise Skeleton', petType: 'skeleton', summon: 'necromancerskeleton', petMax: '(lvl < 4) ? lvl : ((lvl / 3) + 2)' },
  75: { name: 'Clay Golem', petType: 'golem', summon: 'claygolem', petMax: '1' },
  78: { name: 'Bone Wall', petType: 'bonewall', summon: 'bonewall', petMax: '' },
  80: { name: 'Raise Skeletal Mage', petType: 'skeletonmage', summon: 'necromage', petMax: '(lvl < 4) ? lvl : ((lvl / 3) + 2)' },
  85: { name: 'BloodGolem', petType: 'golem', summon: 'bloodgolem', petMax: '1' },
  88: { name: 'Bone Prison', petType: 'bonewall', summon: 'bonewall', petMax: '' },
  90: { name: 'IronGolem', petType: 'golem', summon: 'irongolem', petMax: '1' },
  94: { name: 'FireGolem', petType: 'golem', summon: 'firegolem', petMax: '1' },
  95: { name: 'Revive', petType: 'revive', summon: '', petMax: 'lvl' },
  221: { name: 'Raven', petType: 'raven', summon: 'druidhawk', petMax: 'min(lvl, 5)' },
  222: { name: 'Plague Poppy', petType: 'vine', summon: 'plaguepoppy', petMax: '1' },
  226: { name: 'Oak Sage', petType: 'spirit', summon: 'oaksage', petMax: '1' },
  227: { name: 'Summon Spirit Wolf', petType: 'fenris', summon: 'spiritwolf', petMax: 'min(lvl, 5)' },
  231: { name: 'Cycle of Life', petType: 'vine', summon: 'cycleoflife', petMax: '1' },
  236: { name: 'Heart of Wolverine', petType: 'spirit', summon: 'heartofwolverine', petMax: '1' },
  237: { name: 'Summon Fenris', petType: 'fenris', summon: 'fenris', petMax: 'min(lvl, 3)' },
  241: { name: 'Vines', petType: 'vine', summon: 'vines', petMax: '1' },
  246: { name: 'Spirit of Barbs', petType: 'spirit', summon: 'spiritofbarbs', petMax: '1' },
  247: { name: 'Summon Grizzly', petType: 'grizzly', summon: 'druidbear', petMax: '1' },
  257: { name: 'Blade Sentinel', petType: 'bladesentinel', summon: 'bladesentinel', petMax: '' },
  261: { name: 'Charged Bolt Sentry', petType: 'assassintrap', summon: 'Wake Of Destruction', petMax: '5' },
  262: { name: 'Wake of Fire Sentry', petType: 'assassintrap', summon: 'Charts', petMax: '5' },
  268: { name: 'Shadow Warrior', petType: 'shadowwarrior', summon: 'shadowwarrior', petMax: '1' },
  271: { name: 'Lightning Sentry', petType: 'assassintrap', summon: 'Lightning Sentry', petMax: '5' },
  272: { name: 'Inferno Sentry', petType: 'assassintrap', summon: 'Inferno Sentry', petMax: '5' },
  276: { name: 'Death Sentry', petType: 'assassintrap', summon: 'Death Sentry', petMax: '5' },
  279: { name: 'Shadow Master', petType: 'shadowwarrior', summon: 'shadowmaster', petMax: '1' },
}

export class SummonManager {
  readonly registry: D2DataRegistry
  private readonly pets: SummonedPetUnit[] = []
  private uidCounter = 1
  private readonly rng = new D2Rng(0x53554d4e)

  constructor(registry: D2DataRegistry) {
    this.registry = registry
  }

  private resolveSkillRecordFallback(skillId: number): SkillRecord | undefined {
    const regSkill = this.registry?.getSkillById(skillId)
    if (regSkill) return regSkill
    const cat = SKILLS_BY_ID[skillId]
    const meta = FALLBACK_SUMMON_SKILL_META[skillId]
    const isSubSkill = (PET_SUB_SKILL_IDS as readonly number[]).includes(skillId)
    if (!cat && !meta && !isSubSkill) return undefined
    const name = meta?.name ?? cat?.name ?? `Skill_${skillId}`
    return {
      id: skillId,
      name,
      skill: name,
      charClass: cat?.classCode ?? '',
      skillDesc: '',
      srvStFunc: 0,
      srvDoFunc: 0,
      srvPrgFunc1: 0,
      srvPrgFunc2: 0,
      srvPrgFunc3: 0,
      prgCalc1: '',
      prgCalc2: '',
      prgCalc3: '',
      prgDam: 0,
      srvMissile: '',
      srvMissileA: '',
      srvMissileB: '',
      srvMissileC: '',
      cltStFunc: 0,
      cltDoFunc: 0,
      cltMissile: '',
      cltMissileA: '',
      cltMissileB: '',
      cltMissileC: '',
      cltMissileD: '',
      passive: false,
      passiveState: '',
      passiveStat1: '',
      passiveCalc1: '',
      passiveStat2: '',
      passiveCalc2: '',
      passiveStat3: '',
      passiveCalc3: '',
      passiveStat4: '',
      passiveCalc4: '',
      passiveStat5: '',
      passiveCalc5: '',
      aura: false,
      auraFilter: 0,
      auraState: '',
      auraTgtState: '',
      auraLenCalc: cat?.auraLenCalc ?? '',
      auraRangeCalc: '',
      auraStat1: '',
      auraStatCalc1: '',
      auraStat2: '',
      auraStatCalc2: '',
      auraStat3: '',
      auraStatCalc3: '',
      auraStat4: '',
      auraStatCalc4: '',
      auraStat5: '',
      auraStatCalc5: '',
      auraStat6: '',
      auraStatCalc6: '',
      auraEvent1: '',
      auraEventFunc1: 0,
      auraEvent2: '',
      auraEventFunc2: 0,
      auraEvent3: '',
      auraEventFunc3: 0,
      summon: meta?.summon ?? '',
      petType: meta?.petType ?? '',
      petMax: meta?.petMax ?? '',
      sumMode: '',
      sumSkill1: '',
      sumSk1Calc: '',
      sumSkill2: '',
      sumSk2Calc: '',
      sumSkill3: '',
      sumSk3Calc: '',
      sumSkill4: '',
      sumSk4Calc: '',
      sumSkill5: '',
      sumSk5Calc: '',
      sumUMod: 0,
      sumOverlay: '',
      anim: '',
      seqTrans: '',
      monAnim: '',
      seqNum: 0,
      seqInput: 0,
      range: '',
      selectProc: 0,
      reqLevel: cat?.reqlevel ?? 1,
      reqStr: 0,
      reqDex: 0,
      reqInt: 0,
      reqVit: 0,
      reqSkill1: cat?.reqskills?.[0] !== undefined ? String(cat.reqskills[0]) : '',
      reqSkill2: cat?.reqskills?.[1] !== undefined ? String(cat.reqskills[1]) : '',
      reqSkill3: cat?.reqskills?.[2] !== undefined ? String(cat.reqskills[2]) : '',
      restrict: 0,
      state1: '',
      state2: '',
      state3: '',
      delay: String(cat?.delay ?? 0),
      checkFunc: 0,
      nocostinstate: false,
      decquant: false,
      manaShift: cat?.manashift ?? 8,
      mana: cat?.mana ?? 0,
      lvlMana: cat?.lvlmana ?? 0,
      minMana: cat?.minmana ?? 0,
      interrupt: true,
      inTown: true,
      periodic: false,
      perDelay: '',
      finishing: false,
      progressive: false,
      calc1: '',
      calc2: '',
      calc3: '',
      calc4: '',
      param1: cat?.params?.par1 ?? 0,
      param2: cat?.params?.par2 ?? 0,
      param3: cat?.params?.par3 ?? 0,
      param4: cat?.params?.par4 ?? 0,
      param5: cat?.params?.par5 ?? 0,
      param6: cat?.params?.par6 ?? 0,
      param7: cat?.params?.par7 ?? 0,
      param8: cat?.params?.par8 ?? 0,
      toHit: cat?.toHit ?? 0,
      toHitLev: cat?.toHitLev ?? 0,
      toHitCalc: cat?.toHitCalc ?? '',
      resultFlags: 0,
      hitFlags: 0,
      hitClass: 0,
      kick: false,
      hitShift: cat?.hitshift ?? 8,
      srcDam: cat?.srcDamage ?? 0,
      minDam: cat?.minDam ?? 0,
      minLevDam1: cat?.minLevDam?.[0] ?? 0,
      minLevDam2: cat?.minLevDam?.[1] ?? 0,
      minLevDam3: cat?.minLevDam?.[2] ?? 0,
      minLevDam4: cat?.minLevDam?.[3] ?? 0,
      minLevDam5: cat?.minLevDam?.[4] ?? 0,
      maxDam: cat?.maxDam ?? 0,
      maxLevDam1: cat?.maxLevDam?.[0] ?? 0,
      maxLevDam2: cat?.maxLevDam?.[1] ?? 0,
      maxLevDam3: cat?.maxLevDam?.[2] ?? 0,
      maxLevDam4: cat?.maxLevDam?.[3] ?? 0,
      maxLevDam5: cat?.maxLevDam?.[4] ?? 0,
      dmgSymPerCalc: cat?.synergyFormulas?.physical ?? '',
      eType: cat?.eType ?? '',
      eMin: cat?.eMin ?? 0,
      eMinLev1: cat?.eMinLev?.[0] ?? 0,
      eMinLev2: cat?.eMinLev?.[1] ?? 0,
      eMinLev3: cat?.eMinLev?.[2] ?? 0,
      eMinLev4: cat?.eMinLev?.[3] ?? 0,
      eMinLev5: cat?.eMinLev?.[4] ?? 0,
      eMax: cat?.eMax ?? 0,
      eMaxLev1: cat?.eMaxLev?.[0] ?? 0,
      eMaxLev2: cat?.eMaxLev?.[1] ?? 0,
      eMaxLev3: cat?.eMaxLev?.[2] ?? 0,
      eMaxLev4: cat?.eMaxLev?.[3] ?? 0,
      eMaxLev5: cat?.eMaxLev?.[4] ?? 0,
      eDmgSymPerCalc: cat?.synergyFormulas?.elemental ?? '',
      eLen: cat?.eLen ?? 0,
      eLevLen1: cat?.eLevLen?.[0] ?? 0,
      eLevLen2: cat?.eLevLen?.[1] ?? 0,
      eLevLen3: cat?.eLevLen?.[2] ?? 0,
      eLenSymPerCalc: cat?.synergyFormulas?.duration ?? '',
      aiType: 0,
      aiBonus: 0,
      castOverlay: '',
      cltOverlayA: '',
      cltOverlayB: '',
      prgOverlay: '',
      raw: {},
    }
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
  }): CreatePetOutcome {
    const skill = this.resolveSkillRecordFallback(params.skillId)
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

    const petTypeName = (
      params.skillId === 257
        ? 'bladesentinel'
        : skill.petType ||
          (params.skillId === 261 || params.skillId === 262 || params.skillId === 271 || params.skillId === 272 || params.skillId === 276
            ? 'assassintrap'
            : params.skillId === 62
              ? 'hydra'
              : params.skillId === 78 || params.skillId === 88
                ? 'bonewall'
                : 'summon')
    ).toLowerCase()

    const petTypeRec = this.registry?.getPetType(petTypeName)
    const isGolemSkill = [75, 85, 90, 94].includes(params.skillId)
    const petGroup =
      isGolemSkill
        ? 3 // Golem Group 3 exclusivity
        : (petTypeRec?.group ??
          ([226, 236, 246].includes(params.skillId)
            ? 1 // Druid Oak Sage / Wolverine / Barbs totem group
            : [222, 231, 241].includes(params.skillId)
              ? 2 // Druid Vine group
              : [227, 237, 247].includes(params.skillId)
                ? 3 // Druid Spirit Wolf / Dire Wolf / Grizzly group
                : [268, 279].includes(params.skillId)
                  ? 4 // Assassin Shadow Warrior / Master group
                  : 0))

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

    // 1. Evict any existing pets in the same `petGroup` (`group > 0`) that have a different `petType`
    // (e.g. summoning Grizzly evicts Spirit Wolves / Dire Wolves; summoning Shadow Master evicts Shadow Warrior)
    // For Golems (Group 3): Any new Golem evicts any existing Golem!
    if (petGroup > 0) {
      for (let i = this.pets.length - 1; i >= 0; i -= 1) {
        const p = this.pets[i]!
        const pIsGolem = [75, 85, 90, 94].includes(p.sourceSkillId)
        if (
          p.petGroup === petGroup &&
          pIsGolem === isGolemSkill &&
          (p.petType !== petTypeName || isGolemSkill)
        ) {
          this.clearTotemAurasForPet(p, params.owner)
          evictedPetUids.push(p.uid)
          this.pets.splice(i, 1)
        }
      }
    }

    // 2. Determine max cap (`petmax` calc from `Skills.txt`, or `PetType.txt` `basemax`, or `5` for Assassin traps)
    const calcCtx = {
      registry: this.registry,
      activeSkill: skill,
      slvl: params.slvl,
      blvl: params.owner.statList.getBaseSkillLevel(params.skillId),
      getBaseSkillLevel: (id: number) => params.owner.statList.getBaseSkillLevel(id),
      getEffectiveSkillLevel: (id: number) => params.owner.statList.getEffectiveSkillLevel(id),
    }

    let maxPets = 1
    if (petTypeName === 'assassintrap') {
      maxPets = 5 // 1.13c Assassin trap cap = 5 active traps
    } else if (petTypeName === 'bladesentinel' || params.skillId === 257) {
      maxPets = Number.POSITIVE_INFINITY
    } else if (petTypeName === 'bonewall' || params.skillId === 78 || params.skillId === 88) {
      maxPets = Number.POSITIVE_INFINITY // 1.13c Bone Wall & Bone Prison spawn bonewall (#344) monsters with no summon cap
    } else if (isGolemSkill) {
      maxPets = 1 // Golems: exactly 1 active golem
    } else if (params.skillId === 70 || params.skillId === 80) {
      maxPets = params.slvl < 4 ? params.slvl : 2 + Math.floor(params.slvl / 3)
    } else if (params.skillId === 95) {
      maxPets = Math.max(1, params.slvl)
    } else if (skill.petMax) {
      maxPets = Math.max(1, evaluateCalc(skill.petMax, calcCtx))
    } else if (petTypeRec && petTypeRec.baseMax > 0) {
      maxPets = petTypeRec.baseMax
    }

    // 3. Enforce FIFO eviction when `activeCount >= maxPets`
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
    const skelMasteryLvl = params.owner.statList.getEffectiveSkillLevel(69)
    const golemMasteryLvl = params.owner.statList.getEffectiveSkillLevel(79)
    const summonResLvl = params.owner.statList.getEffectiveSkillLevel(89)
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
      thornsReturnPct = igStats.thornsReturnPct
      inheritedAuras = igStats.inheritedAuras
      baseHp = igStats.maxHp
      petDef = igStats.defense
      golemAr = igStats.attackRating
      golemDmgBonusPct = igStats.damageBonusPct
      golemVelPct = gmStats.speedBonusPct
      golemFade = igStats.translucentFade
      golemFireRes = sumResPct
      golemLtngRes = 50 + sumResPct
      golemColdRes = sumResPct
      golemPoisRes = 100 + sumResPct
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

    if (params.skillId === 78) {
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
      })
      baseHp = valkStats.finalHp
      valkRes = valkStats.allResistancesPct
      equipmentTier = valkStats.equipmentTier
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
      shadowEquipment = generateShadowEquipment(params.skillId as 268 | 279, params.slvl)
    }

    const effectiveRes = decoyRes || valkRes || sumResPct
    const petLevel =
      druidPetLevelOverride !== undefined
        ? druidPetLevelOverride
        : params.skillId === 95 && reviveMonsterLevel !== undefined && ownerLevel > 0
          ? Math.min(ownerLevel, reviveMonsterLevel)
          : ownerLevel

    const petStatList = new UnitStatList(this.registry, {
      level: petLevel,
      maxhp: baseHp * FIXED_ONE,
      hitpoints: baseHp * FIXED_ONE,
      armorclass: petDef,
      ...(golemPhysRes ? { damageresist: golemPhysRes } : {}),
      ...(golemMagRes ? { magicresist: golemMagRes } : {}),
      fireresist: golemFireRes ?? effectiveRes,
      lightresist: golemLtngRes ?? effectiveRes,
      coldresist: golemColdRes ?? effectiveRes,
      poisonresist: golemPoisRes ?? effectiveRes,
      ...(skelAr ? { tohit: skelAr } : {}),
      ...(golemAr ? { tohit: golemAr } : {}),
      ...(reviveAr ? { tohit: reviveAr } : {}),
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
      ...(golemFireMinDam ? { firemindam: golemFireMinDam, firemaxdam: golemFireMaxDam } : {}),
      ...(golemFade ? { fade: golemFade } : {}),
      ...(druidPetArPct ? { item_tohit_percent: druidPetArPct } : {}),
      ...(druidPetDefPct ? { item_armor_percent: druidPetDefPct } : {}),
      ...(druidPetDmgPct ? { damagepercent: druidPetDmgPct } : {}),
      ...(params.skillId === 32 && valkStats ? {
        strength: valkStats.strength,
        dexterity: valkStats.dexterity,
        item_armor_percent: valkStats.defenseBonusPct,
        tohit: valkStats.attackRatingBonus,
        passive_critical_strike: valkStats.inheritedCriticalStrikeLvl > 0 ? calculateCriticalStrikeStats(valkStats.inheritedCriticalStrikeLvl).chancePct : 0,
        passive_dodge: valkStats.inheritedDodgeLvl > 0 ? calculateDodgeStats(valkStats.inheritedDodgeLvl).chancePct : 0,
        passive_avoid: valkStats.inheritedAvoidLvl > 0 ? calculateAvoidStats(valkStats.inheritedAvoidLvl).chancePct : 0,
        passive_evade: valkStats.inheritedEvadeLvl > 0 ? calculateEvadeStats(valkStats.inheritedEvadeLvl).chancePct : 0,
      } : {}),
      ...(slowPct ? { clay_golem_slow: slowPct } : {}),
      ...(thornsReturnPct ? { thorns_percent: thornsReturnPct } : {}),
      ...(fireAbsorbPct ? { fire_golem_absorb: fireAbsorbPct, item_absorbfire_percent: fireAbsorbPct } : {}),
      ...(bloodGolemDamageShare ? { blood_golem_damage_share: bloodGolemDamageShare } : {}),
    })
    const petStateBus = new StateBus(petStatList, this.registry)

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
      unsummonable:
        params.skillId === 78 || params.skillId === 88 || petTypeName === 'bonewall'
          ? false
          : petTypeRec
            ? Boolean(petTypeRec.unsummon)
            : petTypeName !== 'raven' && params.skillId !== 221,
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
      ...(shadowEquipment ? { shadowEquipment } : {}),
      ...(shadowSkills.size > 0 ? { shadowSkills } : {}),
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
    corpses?: { id: string; consumed: boolean; baseMaxHp?: number; isBoss?: boolean; shattered?: boolean; isCorpse?: boolean }[]
    missileEngine: MissileEngine
    auraScanner: AuraScanner
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

      const isStationary =
        Boolean(pet.isStationary) ||
        stationaryKinds.has(pet.kind ?? '') ||
        pet.petType === 'assassintrap' ||
        pet.petType === 'hydra' ||
        pet.petType === 'totem' ||
        pet.petType === 'vine'

      let leashTeleported = false
      if (!isStationary && params.owner.x !== undefined && params.owner.y !== undefined) {
        const ownerDx = params.owner.x - pet.x
        const ownerDy = params.owner.y - pet.y
        const ownerDist = Math.hypot(ownerDx, ownerDy)
        if (ownerDist > 480) {
          pet.x = params.owner.x
          pet.y = params.owner.y
          leashTeleported = true
        } else if (targetableEnemies.length === 0 && ownerDist > 96) {
          const step = Math.min(8, ownerDist - 64)
          pet.x += (ownerDx / ownerDist) * step
          pet.y += (ownerDy / ownerDist) * step
        }
      }

      let primaryTarget: CombatUnitContext | undefined
      let primaryPos = { x: 0, y: 120 }
      let bestEnemyDist = Infinity
      for (const enemy of targetableEnemies) {
        const pos = params.enemyPositions.get(enemy.id) ?? {
          x: enemy.x ?? 0,
          y: enemy.y ?? 120,
        }
        const d = Math.hypot(pos.x - pet.x, pos.y - pet.y)
        if (d < bestEnemyDist) {
          bestEnemyDist = d
          primaryTarget = enemy
          primaryPos = pos
        }
      }
      pet.targetId = primaryTarget?.id

      const skelMasteryLvl = params.owner.statList.getEffectiveSkillLevel(69)
      const golemMasteryLvl = params.owner.statList.getEffectiveSkillLevel(79)
      const golemSynergies = {
        clayGolemBlvl: params.owner.statList.getBaseSkillLevel(75),
        bloodGolemBlvl: params.owner.statList.getBaseSkillLevel(85),
        ironGolemBlvl: params.owner.statList.getBaseSkillLevel(90),
        fireGolemBlvl: params.owner.statList.getBaseSkillLevel(94),
      }

      // Fire Golem Holy Fire pulse every 50 ticks (2.0s)
      if (pet.kind === 'fire_golem' && params.currentTick % 50 === 0) {
        const fgStats = calculateFireGolemStats(pet.slvl, golemMasteryLvl, golemSynergies)
        const pulseRadiusPx = fgStats.holyFireRadiusSubtiles * 32
        for (const enemy of aliveEnemies) {
          const ePos = params.enemyPositions.get(enemy.id) ?? { x: 0, y: 120 }
          const dx = ePos.x - pet.x
          const dy = ePos.y - pet.y
          // 2:1 isometric ground geometry
          if (dx * dx + 4 * dy * dy <= pulseRadiusPx * pulseRadiusPx) {
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

      // Execute pet's AI sub-skills (`IDs 281..338`)
      for (const subId of pet.subSkillIds) {
        const subSkill = this.resolveSkillRecordFallback(subId)
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
              poison_bitrate_256: rollDamageRange256(pcStats.poisonMinRate256, pcStats.poisonMaxRate256, this.rng),
            },
          })
          damageDealt += out.totalDamage
          subSkillsExecuted.push(294)
          petAttacks += 1
          continue
        }

        // Spirit Wolf / Shadow Teleport (`#292` — suppressed on the same tick as a > 480 px leash teleport)
        if (subId === 292) {
          if (!leashTeleported && primaryTarget) {
            const dx = primaryPos.x - pet.x
            const dy = primaryPos.y - pet.y
            if (Math.hypot(dx, dy * 2) > 80) {
              pet.x = primaryPos.x
              pet.y = primaryPos.y
              subSkillsExecuted.push(292)
            }
          }
          continue
        }

        // Death Sentry (`312` `mon death sentry`): explodes an available corpse if present!
        if (subId === 312 && params.corpses) {
          const ceRadiusSubtiles = 10 + (pet.slvl - 1)
          const ceRadiusPx = ceRadiusSubtiles * 16
          // 1.13c Ground Truth: Rejects consumed, boss, and shattered (frozen) corpses
          const corpse = params.corpses.find(
            c => c && !c.consumed && !c.isBoss && !c.shattered && c.isCorpse !== false
          )
          if (corpse && primaryTarget) {
            corpse.consumed = true
            corpsesConsumedByPets += 1
            subSkillsExecuted.push(subId)
            pet.shotsRemaining -= 1

            // 1.13c Corpse Explosion: 40% to 80% (or 70% to 120% in 1.13c) base monster HP (50% phys / 50% fire)
            const baseHp = corpse.baseMaxHp ?? 1000
            const minDmg = Math.trunc((baseHp * 70) / 100) * FIXED_ONE
            const maxDmg = Math.trunc((baseHp * 120) / 100) * FIXED_ONE

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
                    : subSkill.srvMissile || subSkill.srvMissileA || 'sentrylightningbolt'

          const minElem = mageMsl
            ? mageMsl.minDamage256
            : trapDmg
              ? trapDmg.minDmg * FIXED_ONE
              : (25 + pet.slvl * 12) * FIXED_ONE
          const maxElem = mageMsl
            ? mageMsl.maxDamage256
            : trapDmg
              ? trapDmg.maxDmg * FIXED_ONE
              : (45 + pet.slvl * 18) * FIXED_ONE

          // 1.13c Sentry owner isolation: ground sentries are independent minion units and do NOT inherit
          // player +% Elemental Skill Damage or -% Enemy Resistance.
          const mslOwner: CombatUnitContext =
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

          if (subId === 306) {
            // #261 Charged Bolt Sentry: fires 5 + floor(ShockWeb.blvl / 3) bolts of 'sentrychargedbolt' per shot
            const boltCount = 5 + Math.floor(params.owner.statList.getBaseSkillLevel(256) / 3)
            const baseAngle = Math.atan2(primaryPos.y - pet.y, primaryPos.x - pet.x)
            const dist = Math.max(80, Math.hypot(primaryPos.x - pet.x, primaryPos.y - pet.y))
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
          if (pet.petType === 'assassintrap') {
            pet.shotsRemaining -= 1
          }
        }
      }

      if (!leashTeleported && !isStationary && pet.kind !== 'skeleton_mage' && primaryTarget) {
        const curDx = primaryPos.x - pet.x
        const curDy = primaryPos.y - pet.y
        const curDist = Math.hypot(curDx, curDy)
        if (curDist > 36) {
          const step = Math.min(8, curDist - 24)
          pet.x += (curDx / curDist) * step
          pet.y += (curDy / curDist) * step
        }
      }

      // Standard melee attack for non-totem, non-vine combat pets (`Skeleton`, `Golem`, `Raven`, `Wolf`, `Grizzly`, `Valkyrie`, `Shadow`)
      // Stationary Decoy (dopplezon), Totems (`totem`), and Vines (`vine`) cannot execute standard melee attacks
      if (
        primaryTarget &&
        !isStationary &&
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
          const baseValkPhys = Math.floor(
            (20 + pet.slvl * 10) * (1 + valkStr / 100) * critMult * (pet.rageBuffActive ? 2 : 1) * FIXED_ONE,
          )
          physMin256 = baseValkPhys
          physMax256 = baseValkPhys
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
          if (pet.subSkillIds.includes(326)) {
            const bearSmite = calculateBearSmiteStats(pet.slvl)
            stunDurationFrames = bearSmite.stunLengthFrames
            knockback = true
            subSkillsExecuted.push(326)
          }
        } else if (pet.kind === 'shadow_warrior' || pet.kind === 'shadow_master' || pet.sourceSkillId === 268 || pet.sourceSkillId === 279) {
          const basePetPhys = Math.floor(
            (20 + pet.slvl * 10) * (pet.rageBuffActive ? 2 : 1) * FIXED_ONE,
          )
          physMin256 = basePetPhys
          physMax256 = basePetPhys
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

        const out = executeSUnitDmg(params.owner, primaryTarget, {
          skillId: pet.sourceSkillId,
          attackKind: 'melee',
          srcDam: 0,
          flatPhysMin256: physMin256,
          flatPhysMax256: physMax256,
          ...(elemType !== undefined && elemMin256 !== undefined && elemMax256 !== undefined
            ? { elemType, elemMin256, elemMax256 }
            : {}),
          ...(stunDurationFrames !== undefined ? { stunDurationFrames } : {}),
          ...(knockback ? { knockback: true } : {}),
          autoHit: true,
        }, this.rng)
        damageDealt += out.totalDamage
        petAttacks += 1
        if (stunDurationFrames !== undefined && stunDurationFrames > 0 && !primaryTarget.isBoss) {
          primaryTarget.stateBus.applyState({
            stateNameOrId: 'stun',
            sourceUnitId: pet.id,
            sourceSkillId: 326,
            slvl: pet.slvl,
            durationFrames: stunDurationFrames,
            currentFrame: params.currentTick,
          })
        }
        if (knockback && !primaryTarget.isBoss) {
          const targetPos = params.enemyPositions.get(primaryTarget.id) as { x: number; y: number } | undefined
          if (targetPos) {
            const kdx = targetPos.x - pet.x
            const kdy = targetPos.y - pet.y
            const klen = Math.hypot(kdx, kdy) || 1
            targetPos.x = Math.round(targetPos.x + (kdx / klen) * 24)
            targetPos.y = Math.round(targetPos.y + (kdy / klen) * 24)
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
          if (!isSpecialTarget) {
            const ownerLvl = params.owner.statList.getAccruedStat('level') || 80
            const targetLvl = primaryTarget.statList.getAccruedStat('level') || 80
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
        if (pet.kind === 'clay_golem' && pet.slowPct) {
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


