/**
 * Diablo II: Lord of Destruction v1.13c Unit `StateBus` (`States.txt` & `auraeventfunc` Parity).
 *
 * Enforces:
 * - Curse Exclusivity (`cursetype === 1` states overwrite each other).
 * - 1.13c `STATE_ATTRACT` (`cursetype === 2`) Overwrite Immunity: `attract` cannot be
 *   overwritten by any `cursetype === 1` curse (`Amplify Damage`, `Decrepify`, `Lower Resist`, etc.).
 * - Aura Stacking & Level Override: distinct auras coexist on a unit; duplicate aura states
 *   apply the highest `slvl` modifier while retaining lower-level pulses until expiration.
 * - Reactive `auraeventfunc` triggers (`1..5`, `22..27` from `Events.txt` & `Skills.txt`).
 */
import { tryGetSharedDataRegistry, type D2DataRegistry, type SkillRecord } from '../../common/data/data-registry.ts'
import { evaluateCalc } from '../../common/data/calc-ast.ts'
import { UnitStatList, FIXED_ONE } from './stat-list.ts'
import {
  calculateBoneArmorCapacity,
  calculateEnergyShieldAbsorbPct,
  calculateFrozenArmorFreezeLength,
  calculateShiverArmorDamage,
  calculateShiverArmorChillLength,
} from './missile-engine.ts'
import {
  OVERLAY_INDEX_CHILL_ARMOR_HIT,
  OVERLAY_INDEX_ENERGY_SHIELD_HIT_BASE,
  OVERLAY_INDEX_FROZEN_ARMOR_HIT,
  OVERLAY_INDEX_SHIVER_ARMOR_HIT,
  computeEnergyShieldHitOverlay113c,
} from '../../common/path/direction.ts'
import { encode0x11UnitOverlay } from '../../netproto/index.ts'

export interface ActiveStateEntry {
  readonly stateId: number
  readonly stateName: string
  readonly group?: number
  readonly sourceUnitId: string
  readonly sourceSkillId: number
  readonly slvl: number
  readonly curseType: number
  readonly isAura: boolean
  expireFrame: number
  readonly durationFrames?: number
  readonly overlays: readonly string[]
  readonly stats: Readonly<Record<string, number>>
  readonly reactiveEvents?: readonly {
    readonly event: string
    readonly funcId: number
    readonly skillId: number
    readonly slvl: number
  }[]
}

export interface ApplyStateResult {
  readonly applied: boolean
  readonly stateName: string
  readonly stateId: number
  readonly blockedByAttract?: boolean
  readonly evictedState?: string
  readonly activeSlvl: number
}

export interface ReactiveUnitOverlayEvent {
  readonly target: 'attacker' | 'defender'
  readonly overlayToken: string
  readonly overlayIndex: number
  readonly packet0x11: Uint8Array
  readonly unitOverlay: {
    readonly type: 'UnitOverlay'
    readonly rawUnitType: number
    readonly id: number
    readonly overlayIndex: number
  }
}

export interface ReactiveEventOutcome {
  readonly absorbedPhys256: number
  readonly absorbedElem256: number
  readonly manaDrained256: number
  readonly reflectedPhys256: number
  readonly attackerHealed256: number
  readonly ownerHealed256: number
  readonly spawnedMissiles: string[]
  readonly attackerStatesApplied: string[]
  readonly attackerColdDamage256: number
  readonly attackerOverlaysApplied?: string[]
  readonly defenderOverlaysApplied?: string[]
  readonly unitOverlays?: ReactiveUnitOverlayEvent[]
}

const REACTIVE_STATE_TO_SKILL_ID_113C: Readonly<Record<string, number>> = {
  frozenarmor: 40,
  shiverarmor: 50,
  energyshield: 58,
  chillingarmor: 60,
  chillarmor: 60,
  bonearmor: 68,
  claygolem: 75,
  ironmaiden: 76,
  lifetap: 82,
  bloodgolem: 85,
  irongolem: 90,
  thorns: 103,
  cyclonearmor: 235,
  barbs: 296,
}

const DEFAULT_STATE_TO_SKILL_ID_113C: Readonly<Record<string, number>> = {
  amplifydamage: 66,
  weaken: 72,
  decrepify: 87,
  lowerresist: 91,
  might: 98,
  concentration: 113,
  sanctuary: 119,
  fanaticism: 122,
  conviction: 123,
  battlecry: 146,
}

const REACTIVE_FALLBACK_SKILLS_113C = new Map<number, SkillRecord>([
  [40, { id: 40, name: 'Frozen Armor', auraState: 'frozenarmor', auraEvent1: 'damagedinmelee', auraEventFunc1: 2, auraStat1: 'skill_armor_percent', auraStatCalc1: 'ln12', param1: 30, param2: 5, param3: 3000, param4: 300, param5: 30, param6: 3, param7: 250, param8: 5 } as unknown as SkillRecord],
  [50, { id: 50, name: 'Shiver Armor', auraState: 'shiverarmor', auraEvent1: 'attackedinmelee', auraEventFunc1: 3, auraStat1: 'skill_armor_percent', auraStatCalc1: 'ln12', param1: 45, param2: 6, param3: 3000, param4: 300, param5: 100, param6: 0, param7: 250, param8: 9 } as unknown as SkillRecord],
  [58, { id: 58, name: 'Energy Shield', auraState: 'energyshield', auraEvent1: 'absorbdamage', auraEventFunc1: 19, param1: 3500, param2: 1500, param5: 20, param6: 95, param7: 1 } as unknown as SkillRecord],
  [60, { id: 60, name: 'Chilling Armor', auraState: 'chillingarmor', auraEvent1: 'hitbymissile', auraEventFunc1: 1, auraStat1: 'skill_armor_percent', auraStatCalc1: 'ln12', param1: 45, param2: 5, param3: 3600, param4: 150, param7: 250, param8: 9 } as unknown as SkillRecord],
  [68, { id: 68, name: 'Bone Armor', auraState: 'bonearmor', auraEvent1: 'absorbdamage', auraEventFunc1: 22, auraStat1: 'bonearmor', auraStatCalc1: "ln12 + (skill('Bone Wall'.blvl) + skill('Bone Prison'.blvl)) * par8", param1: 20, param2: 10, param8: 15 } as unknown as SkillRecord],
  [75, { id: 75, name: 'Clay Golem', auraState: 'claygolem', auraEvent1: 'damagedinmelee', auraEventFunc1: 27, auraStat1: 'item_slow', auraStatCalc1: 'dm34', param3: 0, param4: 75 } as unknown as SkillRecord],
  [76, { id: 76, name: 'Iron Maiden', auraState: 'ironmaiden', auraEvent1: 'domeleedamage', auraEventFunc1: 4, auraStat1: 'thorns_percent', auraStatCalc1: 'ln56', calc1: 'ln56', param5: 200, param6: 25 } as unknown as SkillRecord],
  [82, { id: 82, name: 'Life Tap', auraState: 'lifetap', auraEvent1: 'damagedinmelee', auraEventFunc1: 5, auraEvent2: 'damagedbymissile', auraEventFunc2: 5, param1: 400, param2: 60, param5: 50 } as unknown as SkillRecord],
  [85, { id: 85, name: 'BloodGolem', auraState: 'bloodgolem', auraEvent1: 'domeleedamage', auraEventFunc1: 23, auraEvent2: 'damagedinmelee', auraEventFunc2: 26, param1: 70, param2: 30 } as unknown as SkillRecord],
  [90, { id: 90, name: 'IronGolem', auraState: 'irongolem', auraEvent1: 'damagedinmelee', auraEventFunc1: 4, auraStat1: 'thorns_percent', auraStatCalc1: '(lvl > 1) ? dm34 : 0', param3: 100, param4: 750 } as unknown as SkillRecord],
  [103, { id: 103, name: 'Thorns', auraState: 'thorns', auraEvent1: 'damagedinmelee', auraEventFunc1: 4, auraStat1: 'thorns_percent', auraStatCalc1: 'ln34', param3: 250, param4: 40 } as unknown as SkillRecord],
  [235, { id: 235, name: 'Cyclone Armor', auraState: 'cyclonearmor', auraEvent1: 'absorbdamage', auraEventFunc1: 25, auraStat1: 'bonearmor', auraStatCalc1: "(ln12*(100+(skill('Twister'.blvl)+skill('Tornado'.blvl)+skill('Hurricane'.blvl))*par8)/100)*256", param1: 40, param2: 12, param8: 7, param5: 25, param6: 50 } as unknown as SkillRecord],
  [240, { id: 240, name: 'Twister' } as unknown as SkillRecord],
  [245, { id: 245, name: 'Tornado' } as unknown as SkillRecord],
  [250, { id: 250, name: 'Hurricane' } as unknown as SkillRecord],
  [78, { id: 78, name: 'Bone Wall' } as unknown as SkillRecord],
  [88, { id: 88, name: 'Bone Prison' } as unknown as SkillRecord],
  [296, { id: 296, name: 'Barbs Aura', auraState: 'barbs', auraEvent1: 'damagedinmelee', auraEventFunc1: 4, auraStat1: 'thorns_percent', auraStatCalc1: 'ln34', param3: 50, param4: 10 } as unknown as SkillRecord],
  [66, { id: 66, name: 'Amplify Damage', auraTgtState: 'amplifydamage', auraStat1: 'damageresist', auraStatCalc1: '-par5', param5: 100 } as unknown as SkillRecord],
  [72, { id: 72, name: 'Weaken', auraTgtState: 'weaken', auraStat1: 'damagepercent', auraStatCalc1: '-par5', param5: 33 } as unknown as SkillRecord],
  [87, { id: 87, name: 'Decrepify', auraTgtState: 'decrepify', auraStat1: 'velocitypercent', auraStatCalc1: 'par5', auraStat2: 'damagepercent', auraStatCalc2: 'par5', auraStat3: 'damageresist', auraStatCalc3: 'par5', auraStat4: 'attackrate', auraStatCalc4: 'par5', param5: -50 } as unknown as SkillRecord],
  [91, { id: 91, name: 'Lower Resist', auraTgtState: 'lowerresist', auraStat1: 'fireresist', auraStatCalc1: '-dm56', auraStat2: 'lightresist', auraStatCalc2: '-dm56', auraStat3: 'coldresist', auraStatCalc3: '-dm56', auraStat4: 'poisonresist', auraStatCalc4: '-dm56', param5: 25, param6: 70 } as unknown as SkillRecord],
  [98, { id: 98, name: 'Might', auraState: 'might', auraTgtState: 'might', auraStat1: 'damagepercent', auraStatCalc1: 'ln34', param3: 40, param4: 10 } as unknown as SkillRecord],
  [113, { id: 113, name: 'Concentration', auraState: 'concentration', auraTgtState: 'concentration', auraStat1: 'damagepercent', auraStatCalc1: 'ln34', auraStat2: 'skill_concentration', auraStatCalc2: 'par5', param3: 60, param4: 15, param5: 20 } as unknown as SkillRecord],
  [119, { id: 119, name: 'Sanctuary', auraState: 'sanctuary', auraStat1: 'item_undeaddamage_percent', auraStatCalc1: 'ln34', auraStat2: 'item_undead_tohit', auraStatCalc2: 'ln56', auraStat3: 'skill_bypass_undead', auraStatCalc3: '1', param3: 150, param4: 30, param5: 100, param6: 50 } as unknown as SkillRecord],
  [122, { id: 122, name: 'Fanaticism', auraState: 'fanaticism', auraTgtState: 'fanaticism', auraStat1: 'attackrate', auraStatCalc1: 'dm34', auraStat2: 'item_tohit_percent', auraStatCalc2: 'toht', auraStat3: 'damagepercent', auraStatCalc3: 'ln56/2', passiveStat1: 'damagepercent', passiveCalc1: 'ln56', param3: 10, param4: 40, param5: 50, param6: 17, toHit: 40, levToHit: 5 } as unknown as SkillRecord],
  [123, { id: 123, name: 'Conviction', auraState: 'conviction', auraTgtState: 'conviction', auraStat1: 'skill_armor_percent', auraStatCalc1: '-dm56', auraStat2: 'fireresist', auraStatCalc2: '-min(ln34,150)', auraStat3: 'coldresist', auraStatCalc3: '-min(ln34,150)', auraStat4: 'lightresist', auraStatCalc4: '-min(ln34,150)', param3: 30, param4: 5, param5: 40, param6: 100 } as unknown as SkillRecord],
  [146, { id: 146, name: 'Battle Cry', auraTgtState: 'battlecry', auraStat1: 'skill_armor_percent', auraStatCalc1: 'ln12', auraStat2: 'damagepercent', auraStatCalc2: 'ln34', param1: -50, param2: -6, param3: -25, param4: -3 } as unknown as SkillRecord],
])

const REACTIVE_FALLBACK_BY_NAME = new Map<string, SkillRecord>(
  Array.from(REACTIVE_FALLBACK_SKILLS_113C.values()).map(s => [s.name.toLowerCase(), s]),
)
const REACTIVE_FALLBACK_REGISTRY = {
  getSkillById: (id: number) => REACTIVE_FALLBACK_SKILLS_113C.get(id),
  getSkillByName: (name: string) => REACTIVE_FALLBACK_BY_NAME.get(name.trim().toLowerCase()),
} as unknown as D2DataRegistry

export class StateBus {
  readonly registry: D2DataRegistry | undefined
  readonly statList: UnitStatList
  private readonly entries: ActiveStateEntry[] = []

  constructor(
    statListOrRegistry: UnitStatList | D2DataRegistry,
    registryOrStatList?: D2DataRegistry | UnitStatList,
  ) {
    if (statListOrRegistry instanceof UnitStatList) {
      this.statList = statListOrRegistry
      this.registry =
        (registryOrStatList as D2DataRegistry | undefined) ??
        statListOrRegistry.registry ??
        tryGetSharedDataRegistry()
    } else {
      this.statList = registryOrStatList as UnitStatList
      this.registry = statListOrRegistry ?? tryGetSharedDataRegistry()
    }
  }

  /**
   * Apply a state (`States.txt`) to the unit with optional stats and frame expiration.
   */
  applyState(params: {
    stateNameOrId: string | number
    sourceUnitId?: string
    sourceSkillId?: number
    slvl?: number
    durationFrames?: number
    currentFrame?: number
    stats?: Readonly<Record<string, number>>
    curseTypeOverride?: number
    isAuraOverride?: boolean
  }): ApplyStateResult {
    const rawCleanName =
      typeof params.stateNameOrId === 'string'
        ? params.stateNameOrId.trim().toLowerCase().replace(/^state_/, '')
        : undefined
    const stateRec =
      typeof params.stateNameOrId === 'number'
        ? this.registry?.getStateById(params.stateNameOrId)
        : (this.registry?.getStateByName(rawCleanName!) ??
          (rawCleanName === 'venom' ? this.registry?.getStateById(31) : undefined) ??
          (rawCleanName === 'slow' ? this.registry?.getStateByName('slowed') : undefined) ??
          (rawCleanName === 'chill' ? this.registry?.getStateByName('cold') : undefined))

    const stateName =
      rawCleanName === 'venom'
        ? 'venom'
        : stateRec
          ? stateRec.state.toLowerCase()
          : (rawCleanName ?? String(params.stateNameOrId))
    const stateId =
      stateRec?.id ??
      (typeof params.stateNameOrId === 'number' ? params.stateNameOrId : 0)
    const slvl = Math.max(1, params.slvl ?? 1)
    const currentFrame = params.currentFrame ?? 0
    let durationFrames = params.durationFrames ?? 0
    const sourceUnitId = params.sourceUnitId ?? 'player'
    const sourceSkillId = params.sourceSkillId ?? 0

    // 1.13c sub_6FCC00B0 (0x6FCC00B0, D2Game.dll) + D2Common #10033 (0x6FD83B40):
    // Curse states are determined by States.txt `curse` boolean column (`fStateMasks[11]`).
    // All 26 `curse=1` states (`9, 19, 23, 27, 55..61, 89, 113, 114, 128..137, 141, 156`) share
    // the single STATLIST_CURSE (0x20) slot; STATE_ATTRACT (57) has overwrite immunity (`curseType = 2`).
    const isCurseFromTable = Boolean(stateRec?.curse)
    const curseType =
      params.curseTypeOverride !== undefined
        ? params.curseTypeOverride
        : isCurseFromTable
          ? stateId === 57
            ? 2
            : 1
          : 0

    // 1.13c sub_6FCC00B0 (0x6FCC0192..0x6FCC01BF): STAT_CURSE_RESISTANCE (stat 109)
    // Rejects incoming curse if curse_resistance >= 100; otherwise subtracts (duration * curseRes / 100).
    if (curseType > 0) {
      const curseResPct = Math.min(100, Math.max(0, this.statList.getAccruedStat('curse_resistance')))
      if (curseResPct >= 100) {
        return {
          applied: false,
          stateName,
          stateId,
          activeSlvl: 0,
        }
      }
      if (curseResPct > 0 && durationFrames > 0) {
        durationFrames = Math.max(1, durationFrames - Math.trunc((durationFrames * curseResPct) / 100))
      }
    }

    const expireFrame = durationFrames > 0 ? currentFrame + durationFrames : 0

    const isAura = params.isAuraOverride ?? stateRec?.aura ?? false

    // 1.13c sub_6FCC00B0 (0x6FCC01C1): if bIsCurse and STATES_CheckState(pTarget, STATE_ATTRACT = 57), reject!
    if (curseType > 0 || stateId === 57 || stateName === 'attract') {
      const existingAttract = this.entries.find(
        e => e.stateId === 57 || e.curseType === 2 || e.stateName === 'attract',
      )
      if (existingAttract) {
        return {
          applied: false,
          stateName,
          stateId,
          blockedByAttract: true,
          activeSlvl: existingAttract.slvl,
        }
      }
    }

    let evictedState: string | undefined

    // 1.13c sub_6FCC00B0 (0x6FCC01DD..0x6FCC0263, D2Game.dll):
    // All `curse=1` states occupy the single STATLIST_CURSE (0x20) slot (`STATLIST_GetStatListFromUnitAndFlag(pTarget, 0x20)`).
    // - If existing curse has the SAME stateId and SAME skillId:
    //   * newSlvl < oldSlvl (0x6FCC0257): reject (0x6FCC0259: xor eax, eax; ret).
    //   * newSlvl == oldSlvl (0x6FCC021B): refresh expireFrame in-place via STATLIST_SetExpireFrame (0x6FCC0233) and return existing StatList.
    //   * newSlvl > oldSlvl (0x6FCC0257: jge 0x6FCC0263): unlink old StatList and replace with higher-level instance.
    // - If existing curse has a DIFFERENT stateId or DIFFERENT skillId: unlink old StatList and replace regardless of slvl.
    if (curseType > 0) {
      const existingCurse = this.entries.find(e => e.curseType > 0)
      if (existingCurse) {
        const sameState =
          (stateId > 0 && existingCurse.stateId === stateId) ||
          existingCurse.stateName === stateName
        const sameSkill =
          existingCurse.sourceSkillId === sourceSkillId ||
          existingCurse.sourceSkillId === 0 ||
          sourceSkillId === 0
        if (sameState && sameSkill) {
          if (slvl < existingCurse.slvl) {
            return {
              applied: false,
              stateName,
              stateId,
              activeSlvl: existingCurse.slvl,
            }
          }
          if (slvl === existingCurse.slvl) {
            existingCurse.expireFrame = expireFrame
            ;(existingCurse as { durationFrames?: number }).durationFrames = durationFrames
            const refreshedStats = this.resolveDefaultStateStats113c(stateName, sourceSkillId, slvl, params.stats)
            if (Object.keys(refreshedStats).length > 0) {
              ;(existingCurse as { stats: Readonly<Record<string, number>> }).stats = refreshedStats
              this.statList.addOrUpdateModifier({
                id: `state:${stateName}`,
                stateName,
                stateId,
                sourceUnitId,
                sourceSkillId,
                slvl,
                expireFrame,
                isAura,
                isCurse: true,
                curseType,
                stats: refreshedStats,
              })
            } else {
              for (const mod of this.statList.getActiveModifiers()) {
                if (mod.stateName === stateName || (stateId > 0 && mod.stateId === stateId)) {
                  mod.expireFrame = expireFrame
                }
              }
            }
            return {
              applied: true,
              stateName,
              stateId,
              activeSlvl: existingCurse.slvl,
            }
          }
        }
      }

      for (let i = this.entries.length - 1; i >= 0; i -= 1) {
        const prev = this.entries[i]!
        if (prev.curseType > 0) {
          if (prev.stateName !== stateName) {
            evictedState = prev.stateName
          }
          this.statList.removeModifiersByState(prev.stateName)
          if (prev.stateId > 0) {
            this.statList.removeModifiersByState(prev.stateId)
          }
          this.entries.splice(i, 1)
        }
      }
    }

    // 1.13c State Group mutual exclusion
    // Group 1: Cold Armors (frozenarmor, shiverarmor, chillingarmor)
    // Group 2: Assassin Speed/Defense buffs (quickness, fade)
    // Group 3: Shapeshift / Morph forms (wolf, bear, delerium). Note: feralrage (#120) and maul (#117)
    // also have group=3 in States.txt so that sub_6FD11C90(pUnit, 3, 0) during morph/unmorph strips them,
    // but SKILLS_SrvDo120_FeralRage_Maul (0x6FC66000) does NOT call sub_6FD11C90 when adding charges!
    const isDruidChargeState = stateName === 'feralrage' || stateName === 'maul' || stateId === 120 || stateId === 117
    const stateGroup =
      stateRec?.group ??
      (['frozenarmor', 'shiverarmor', 'chillingarmor', 'chillarmor'].includes(stateName)
        ? 1
        : ['quickness', 'fade'].includes(stateName)
          ? 2
          : ['wolf', 'bear', 'wearwolf', 'wearbear', 'delerium', 'delirium', 'feralrage', 'maul'].includes(stateName)
            ? 3
            : 0)

    if (stateGroup > 0 && !isDruidChargeState) {
      for (let i = this.entries.length - 1; i >= 0; i -= 1) {
        const prev = this.entries[i]!
        const prevGroup =
          prev.group ??
          this.registry?.getStateById(prev.stateId)?.group ??
          this.registry?.getStateByName(prev.stateName)?.group ??
          (['frozenarmor', 'shiverarmor', 'chillingarmor', 'chillarmor'].includes(prev.stateName)
            ? 1
            : ['quickness', 'fade'].includes(prev.stateName)
              ? 2
              : ['wolf', 'bear', 'wearwolf', 'wearbear', 'delerium', 'delirium', 'feralrage', 'maul'].includes(prev.stateName)
                ? 3
                : 0)
        if (prev.stateName !== stateName && prevGroup === stateGroup) {
          evictedState = prev.stateName
          this.statList.removeModifiersByState(prev.stateName)
          this.entries.splice(i, 1)
        }
      }
      // 1.13c sub_6FD11C90(pUnit, 3, 0): morphing into wolf/bear/delerium strips all other group=3 states
      if (stateName === 'wolf' || stateName === 'wearwolf' || stateId === 139) {
        this.removeState('maul')
        this.removeState('feralrage')
      } else if (stateName === 'bear' || stateName === 'wearbear' || stateId === 140) {
        this.removeState('feralrage')
        this.removeState('maul')
      } else if (stateName === 'delerium' || stateName === 'delirium' || stateId === 177) {
        this.removeState('feralrage')
        this.removeState('maul')
      }
    }

    // Collect overlays from States.txt (persistent overlay1..4 only; castoverlay is one-shot on inactive->active transition)
    const overlays: string[] = []
    if (stateRec) {
      for (const ov of [stateRec.overlay1, stateRec.overlay2, stateRec.overlay3, stateRec.overlay4]) {
        if (ov) overlays.push(ov)
      }
    }
    if (stateName === 'feralrage' || stateId === 120) {
      const chg =
        params.stats?.skill_frenzy ??
        params.stats?.progressive_other ??
        params.stats?.progressive_damage ??
        1
      const effLvl = params.stats?.modifierlist_level ?? slvl
      const maxChg = Math.max(
        1,
        params.stats?.progressive_tohit ?? (effLvl > 0 ? Math.floor(effLvl / 2) + 3 : 3),
      )
      const stage = chg <= 1 ? 1 : chg >= maxChg ? 3 : 2
      const dynOv = `feralrage${stage}front`
      if (!overlays.includes(dynOv)) overlays.push(dynOv)
    } else if (stateName === 'maul' || stateId === 117) {
      const chg =
        params.stats?.skill_frenzy ??
        params.stats?.progressive_other ??
        params.stats?.progressive_damage ??
        1
      const effLvl = params.stats?.modifierlist_level ?? slvl
      const maxChg = Math.max(
        1,
        params.stats?.progressive_tohit ?? (effLvl > 0 ? Math.floor(effLvl / 2) + 3 : 3),
      )
      const stage = chg <= 1 ? 1 : chg >= maxChg ? 3 : 2
      const dynOv = `maul${stage}front`
      if (!overlays.includes(dynOv)) overlays.push(dynOv)
    }

    // Collect reactive `auraeventfunc` from the source skill if applicable
    const effectiveSkillId =
      sourceSkillId > 0 ? sourceSkillId : (REACTIVE_STATE_TO_SKILL_ID_113C[stateName] ?? 0)
    const reactiveEvents: { event: string; funcId: number; skillId: number; slvl: number }[] = []
    const skillRec =
      effectiveSkillId > 0 ? this.registry?.getSkillById(effectiveSkillId) : undefined
    const fallbackRec =
      effectiveSkillId > 0 ? REACTIVE_FALLBACK_SKILLS_113C.get(effectiveSkillId) : undefined
    if (skillRec || fallbackRec) {
      const ev1 = skillRec?.auraEvent1 || fallbackRec?.auraEvent1 || ''
      const fn1 =
        skillRec?.auraEventFunc1 && skillRec.auraEventFunc1 > 0
          ? skillRec.auraEventFunc1
          : (fallbackRec?.auraEventFunc1 ?? 0)
      const ev2 = skillRec?.auraEvent2 || fallbackRec?.auraEvent2 || ''
      const fn2 =
        skillRec?.auraEventFunc2 && skillRec.auraEventFunc2 > 0
          ? skillRec.auraEventFunc2
          : (fallbackRec?.auraEventFunc2 ?? 0)
      const ev3 = skillRec?.auraEvent3 || fallbackRec?.auraEvent3 || ''
      const fn3 =
        skillRec?.auraEventFunc3 && skillRec.auraEventFunc3 > 0
          ? skillRec.auraEventFunc3
          : (fallbackRec?.auraEventFunc3 ?? 0)
      if (ev1 && fn1 > 0) {
        reactiveEvents.push({ event: ev1.toLowerCase(), funcId: fn1, skillId: effectiveSkillId, slvl })
      }
      if (ev2 && fn2 > 0) {
        reactiveEvents.push({ event: ev2.toLowerCase(), funcId: fn2, skillId: effectiveSkillId, slvl })
      }
      if (ev3 && fn3 > 0) {
        reactiveEvents.push({ event: ev3.toLowerCase(), funcId: fn3, skillId: effectiveSkillId, slvl })
      }
    }

    const isWarcryBuff = ['shout', 'battleorders', 'battlecommand'].includes(stateName)
    const entryId =
      isAura && !isWarcryBuff
        ? `aura:${stateName}:${sourceUnitId}:${String(slvl)}`
        : `state:${stateName}`
    const resolvedStats = this.resolveDefaultStateStats113c(stateName, sourceSkillId, slvl, params.stats)
    const newEntry: ActiveStateEntry = {
      stateId,
      stateName,
      group: stateGroup,
      sourceUnitId,
      sourceSkillId,
      slvl,
      curseType,
      isAura,
      expireFrame,
      durationFrames,
      overlays,
      stats: resolvedStats,
      reactiveEvents,
    }

    if (isAura && !isWarcryBuff) {
      // Replace entry from the same source + state, or keep alongside other sources for lingering pulse
      const idx = this.entries.findIndex(
        e => e.stateName === stateName && e.sourceUnitId === sourceUnitId && e.slvl === slvl,
      )
      if (idx !== -1) {
        this.entries[idx] = newEntry
      } else {
        this.entries.push(newEntry)
      }
    } else {
      const idx = this.entries.findIndex(e => e.stateName === stateName)
      if (idx !== -1) {
        if (this.entries[idx]!.slvl > slvl && (expireFrame > 0 || isWarcryBuff)) {
          // Higher level buff remains active
          return {
            applied: false,
            stateName,
            stateId,
            activeSlvl: this.entries[idx]!.slvl,
          }
        }
        this.entries[idx] = newEntry
      } else {
        this.entries.push(newEntry)
      }
    }

    this.statList.addOrUpdateModifier({
      id: entryId,
      stateName,
      stateId,
      sourceUnitId,
      sourceSkillId,
      slvl,
      expireFrame,
      isAura,
      isCurse: curseType > 0,
      curseType,
      stats: resolvedStats,
    })

    const maxActiveSlvl = Math.max(
      ...this.entries.filter(e => e.stateName === stateName).map(e => e.slvl),
      slvl,
    )

    return {
      applied: true,
      stateName,
      stateId,
      ...(evictedState !== undefined ? { evictedState } : {}),
      activeSlvl: maxActiveSlvl,
    }
  }

  /**
   * 1.13c (`samples/d2/D2Game.dll` `0x6FCC00B0` / `0x6FCBA1A0` + `samples/d2/excel/Skills.txt`):
   * When a curse or aura state is applied without an explicit `stats` map (or for Fanaticism with
   * only `{ is_ally: 1 }`), evaluate `aurastat1..6` / `aurastatcalc1..6` (or `passivestat1..5` for
   * Fanaticism caster) from `Skills.txt` at `slvl` so the attached `StatList` modifier carries
   * the authoritative `Skills.txt` stat deltas (`damageresist`, `fireresist`, `lightresist`,
   * `coldresist`, `poisonresist`, `damagepercent`, `item_undeaddamage_percent`, `skill_armor_percent`).
   * Note: if a caller explicitly passes `{}` (e.g. `SKILLS_SrvDo066` caster self-state on Sanctuary/Conviction),
   * it is preserved untouched.
   */
  private resolveDefaultStateStats113c(
    stateName: string,
    sourceSkillId: number,
    slvl: number,
    explicitStats: Readonly<Record<string, number>> | undefined,
  ): Readonly<Record<string, number>> {
    const isFanatPartialAlly =
      stateName === 'fanaticism' &&
      explicitStats !== undefined &&
      Object.keys(explicitStats).length > 0 &&
      explicitStats.damagepercent === undefined
    if (explicitStats !== undefined && !isFanatPartialAlly) {
      return explicitStats
    }
    const skillId = sourceSkillId > 0 ? sourceSkillId : (DEFAULT_STATE_TO_SKILL_ID_113C[stateName] ?? 0)
    if (skillId <= 0 || !(stateName in DEFAULT_STATE_TO_SKILL_ID_113C)) {
      return explicitStats ?? {}
    }
    const registry = this.registry ?? tryGetSharedDataRegistry() ?? REACTIVE_FALLBACK_REGISTRY
    const skill = registry?.getSkillById(skillId) ?? REACTIVE_FALLBACK_SKILLS_113C.get(skillId)
    if (!skill) {
      return explicitStats ?? {}
    }
    const calcCtx = {
      activeSkill: skill,
      slvl,
      blvl: slvl,
      registry,
    }
    const resolved: Record<string, number> = explicitStats ? { ...explicitStats } : {}
    const pairs: [string, string][] = [
      [skill.auraStat1, skill.auraStatCalc1],
      [skill.auraStat2, skill.auraStatCalc2],
      [skill.auraStat3, skill.auraStatCalc3],
      [skill.auraStat4, skill.auraStatCalc4],
      [skill.auraStat5, skill.auraStatCalc5],
      [skill.auraStat6, skill.auraStatCalc6],
    ]
    for (const [statName, statCalc] of pairs) {
      if (statName && statCalc) {
        resolved[statName.toLowerCase()] = evaluateCalc(statCalc, calcCtx)
      }
    }
    if (skill.id === 122) {
      const isAlly = resolved.is_ally === 1
      if (!isAlly && skill.passiveStat1 && skill.passiveCalc1) {
        resolved[skill.passiveStat1.toLowerCase()] = evaluateCalc(skill.passiveCalc1, calcCtx)
      }
    }
    return resolved
  }

  /**
   * Remove a specific state by name or ID.
   */
  removeState(stateNameOrId: string | number): void {
    const targetName =
      typeof stateNameOrId === 'string'
        ? stateNameOrId.trim().toLowerCase().replace(/^state_/, '')
        : undefined
    let removedMorph = false
    for (let i = this.entries.length - 1; i >= 0; i -= 1) {
      const e = this.entries[i]!
      if (
        (typeof stateNameOrId === 'number' && e.stateId === stateNameOrId) ||
        (targetName !== undefined && e.stateName === targetName)
      ) {
        if (['wolf', 'wearwolf', 'bear', 'wearbear'].includes(e.stateName) || e.stateId === 139 || e.stateId === 140) {
          removedMorph = true
        }
        this.entries.splice(i, 1)
      }
    }
    this.statList.removeModifiersByState(targetName ?? stateNameOrId)
    if (removedMorph) {
      if (!this.hasState('wolf') && !this.hasState('wearwolf') && !this.hasState(139)) {
        for (let i = this.entries.length - 1; i >= 0; i -= 1) {
          if (this.entries[i]!.stateName === 'feralrage' || this.entries[i]!.stateId === 120) {
            this.entries.splice(i, 1)
          }
        }
        this.statList.removeModifiersByState('feralrage')
        this.statList.removeModifiersByState(120)
      }
      if (!this.hasState('bear') && !this.hasState('wearbear') && !this.hasState(140)) {
        for (let i = this.entries.length - 1; i >= 0; i -= 1) {
          if (this.entries[i]!.stateName === 'maul' || this.entries[i]!.stateId === 117) {
            this.entries.splice(i, 1)
          }
        }
        this.statList.removeModifiersByState('maul')
        this.statList.removeModifiersByState(117)
      }
      // 1.13c unshift HP clamp: never kill the player on unshift (floor at 1 HP = 256) and clamp to new maxHp256
      if (this.statList.getHp256() > 0) {
        this.statList.setHp256(
          Math.max(FIXED_ONE, Math.min(this.statList.getHp256(), this.statList.getMaxHp256())),
        )
      }
    }
  }

  /**
   * Advance clock to `currentFrame` and expire any state whose `expireFrame <= currentFrame`.
   */
  tick(currentFrame: number): string[] {
    const expiredStates: string[] = []
    let expiredMorph = false
    for (let i = this.entries.length - 1; i >= 0; i -= 1) {
      const e = this.entries[i]!
      if (e.expireFrame > 0 && e.expireFrame <= currentFrame) {
        if (['wolf', 'wearwolf', 'bear', 'wearbear'].includes(e.stateName) || e.stateId === 139 || e.stateId === 140) {
          expiredMorph = true
        }
        expiredStates.push(e.stateName)
        this.entries.splice(i, 1)
      }
    }
    this.statList.expireAtFrame(currentFrame)
    if (expiredMorph && this.statList.getHp256() > 0) {
      this.statList.setHp256(
        Math.max(FIXED_ONE, Math.min(this.statList.getHp256(), this.statList.getMaxHp256())),
      )
    }
    return expiredStates
  }

  hasState(stateNameOrId: string | number): boolean {
    if (typeof stateNameOrId === 'number') {
      return this.entries.some(e => e.stateId === stateNameOrId)
    }
    const clean = stateNameOrId.trim().toLowerCase().replace(/^state_/, '')
    if (clean === 'chill' || clean === 'cold') {
      return this.entries.some(e => e.stateName === 'chill' || e.stateName === 'cold')
    }
    if (clean === 'slow' || clean === 'slowed') {
      return this.entries.some(
        e => e.stateName === 'slow' || e.stateName === 'slowed' || e.stateId === 29,
      )
    }
    if (clean === 'venom' || clean === 'venomclaws') {
      return this.entries.some(
        e => e.stateName === 'venom' || e.stateName === 'venomclaws' || e.stateId === 31,
      )
    }
    return this.entries.some(e => e.stateName === clean)
  }

  getActiveEntries(): readonly ActiveStateEntry[] {
    return [...this.entries]
  }

  getState(stateNameOrId: string | number): ActiveStateEntry | undefined {
    if (typeof stateNameOrId === 'number') {
      return this.entries.find(e => e.stateId === stateNameOrId)
    }
    const clean = stateNameOrId.trim().toLowerCase().replace(/^state_/, '')
    if (clean === 'chill' || clean === 'cold') {
      return this.entries.find(e => e.stateName === 'chill' || e.stateName === 'cold')
    }
    if (clean === 'slow' || clean === 'slowed') {
      return this.entries.find(
        e => e.stateName === 'slow' || e.stateName === 'slowed' || e.stateId === 29,
      )
    }
    if (clean === 'venom' || clean === 'venomclaws') {
      return this.entries.find(
        e => e.stateName === 'venom' || e.stateName === 'venomclaws' || e.stateId === 31,
      )
    }
    return this.entries.find(e => e.stateName === clean)
  }

  getActiveStateNames(): string[] {
    return Array.from(new Set(this.entries.map(e => `STATE_${e.stateName.toUpperCase()}`)))
  }

  getActiveOverlays(): string[] {
    const set = new Set<string>()
    for (const e of this.entries) {
      for (const ov of e.overlays) {
        set.add(ov)
      }
    }
    return Array.from(set)
  }

  getEffectiveAuraSlvl(stateName: string): number {
    const clean = stateName.trim().toLowerCase().replace(/^state_/, '')
    let best = 0
    for (const e of this.entries) {
      if (e.stateName === clean && e.slvl > best) {
        best = e.slvl
      }
    }
    return best
  }

  /**
   * Cleansing (Skill 109): Shorten active `curable = 1` curse and poison durations proportionally
   * by `reductionPct` (`floor(remainingFrames * (100 - reductionPct) / 100)`, `#1935`).
   * Positive shrines (`128..137`, `curable = 0`) and Cloak of Shadows `cloaked` (`156`, `curable = 0`)
   * are NOT shortened by Cleansing.
   */
  reduceCurseAndPoisonDurations(currentFrame: number, reductionPct: number): void {
    if (reductionPct <= 0) return
    const clampedPct = Math.min(100, reductionPct)
    for (const entry of [...this.entries]) {
      const stateRec = this.registry?.getStateById(entry.stateId)
      const isCurableCurse =
        entry.curseType > 0 &&
        (stateRec !== undefined
          ? stateRec.curable
          : (entry.stateId < 128 || entry.stateId > 137) && entry.stateId !== 156)
      const isPoison =
        entry.stateId === 2 || entry.stateName === 'poison' || entry.stateName.includes('poison')
      if ((isCurableCurse || isPoison) && entry.expireFrame > currentFrame) {
        const remaining = entry.expireFrame - currentFrame
        const newRemaining = Math.floor((remaining * (100 - clampedPct)) / 100)
        if (newRemaining <= 0) {
          this.removeState(entry.stateId)
          continue
        }
        entry.expireFrame = currentFrame + newRemaining
        ;(entry as { durationFrames?: number }).durationFrames = newRemaining
        for (const mod of this.statList.getActiveModifiers()) {
          if (mod.stateName === entry.stateName) {
            mod.expireFrame = currentFrame + newRemaining
          }
        }
      }
    }
  }


  /**
   * Trigger reactive `auraeventfunc` handlers (`Chilling/Frozen/Shiver Armor`,
   * `Bone Armor`, `Cyclone Armor`, `Energy Shield`, `Iron Maiden`, `Life Tap`,
   * `Clay/Blood Golem`) for a combat event.
   */
  triggerReactiveEvents(params: {
    event: 'hitbymissile' | 'attackedinmelee' | 'damagedinmelee' | 'damagedbymissile' | 'absorbdamage' | 'domeleedamage'
    incomingPhys256?: number
    incomingElem256?: number
    attackerStateBus?: StateBus
    attackerStatList?: UnitStatList
    ownerUnitStatList?: UnitStatList
    isPvP?: boolean
    elemType?: string
    isPoison?: boolean
    isOpenWounds?: boolean
    returnFire?: boolean | number
    defenderX?: number
    defenderY?: number
    attackerX?: number
    attackerY?: number
    defenderRawUnitType?: number
    defenderUnitId?: number
    attackerRawUnitType?: number
    attackerUnitId?: number
  }): ReactiveEventOutcome {
    let remPhys256 = params.incomingPhys256 ?? 0
    let remElem256 = params.incomingElem256 ?? 0
    let absorbedPhys256 = 0
    let absorbedElem256 = 0
    let manaDrained256 = 0
    let reflectedPhys256 = 0
    let attackerHealed256 = 0
    let ownerHealed256 = 0
    const spawnedMissiles: string[] = []
    const attackerStatesApplied: string[] = []
    let attackerColdDamage256 = 0
    const attackerOverlaysApplied: string[] = []
    const defenderOverlaysApplied: string[] = []
    const unitOverlays: ReactiveUnitOverlayEvent[] = []
    const defRawType = params.defenderRawUnitType ?? 0
    const defUnitId = (params.defenderUnitId ?? 1) >>> 0
    const atkRawType = params.attackerRawUnitType ?? 1
    const atkUnitId = (params.attackerUnitId ?? 1) >>> 0

    for (const entry of [...this.entries]) {
      const stateName = entry.stateName

      // 1. Energy Shield (`state = energyshield` or `auraeventfunc = 24`) on `absorbdamage`
      if (
        params.event === 'absorbdamage' &&
        (stateName === 'energyshield' || entry.reactiveEvents?.some(r => r.funcId === 24))
      ) {
        const isOpenWounds = Boolean(params.isOpenWounds)
        const isPoison = params.elemType === 'pois' || Boolean(params.isPoison)
        if (!isOpenWounds) {
          const eligibleElem256 = isPoison ? 0 : remElem256
          const totalIncoming256 = remPhys256 + eligibleElem256
          if (totalIncoming256 > 0) {
            const absorbPct = Math.min(95, entry.stats['item_damagetomana'] ?? calculateEnergyShieldAbsorbPct(entry.slvl))
            const tkBlvl = this.statList.getBaseSkillLevel(43) // Telekinesis (skillId = 43) blvl only!
            // 1.13c Telekinesis synergy: base 200% (32/16 = 2.0 mana per HP), -6.25% (1/16) per blvl in Telekinesis, floor 0.75 (12/16)
            const manaRatio16 = 32 - Math.min(20, Math.max(0, tkBlvl))
            const desiredRedirect256 = Math.trunc((totalIncoming256 * absorbPct) / 100)
            const requiredMana256 = Math.trunc((desiredRedirect256 * manaRatio16) / 16)
            const currentMana256 = this.statList.getMana256()

            let esAbsorbed256 = 0
            if (currentMana256 >= requiredMana256) {
              this.statList.setMana256(currentMana256 - requiredMana256)
              manaDrained256 += requiredMana256
              const physPart = Math.trunc((remPhys256 * absorbPct) / 100)
              const elemPart = isPoison ? 0 : Math.trunc((remElem256 * absorbPct) / 100)
              absorbedPhys256 += physPart
              absorbedElem256 += elemPart
              remPhys256 -= physPart
              remElem256 -= elemPart
              esAbsorbed256 = physPart + elemPart
            } else {
              // Partial absorb and Energy Shield collapses
              const actualRedirect256 = Math.trunc((currentMana256 * 16) / manaRatio16)
              this.statList.setMana256(0)
              manaDrained256 += currentMana256
              const physPart = Math.min(remPhys256, actualRedirect256)
              const elemPart = isPoison ? 0 : Math.min(eligibleElem256, actualRedirect256 - physPart)
              absorbedPhys256 += physPart
              absorbedElem256 += elemPart
              remPhys256 -= physPart
              remElem256 -= elemPart
              esAbsorbed256 = physPart + elemPart
              this.removeState('energyshield')
              this.removeState(60)
            }
            // 1.13c SKILLS_EventFunc24_EnergyShield (0x6FD17820, SkillSor.cpp:1065-1069):
            // when nAbsorbedDamage > 0, sets prgoverlay + D2Common_11053(UNITS_GetDirectionToCoords(defender, attackerX, attackerY)) on defender
            if (esAbsorbed256 > 0) {
              const esHit = computeEnergyShieldHitOverlay113c(
                params.defenderX ?? 0,
                params.defenderY ?? 0,
                params.attackerX ?? 0,
                params.attackerY ?? 0,
                OVERLAY_INDEX_ENERGY_SHIELD_HIT_BASE,
              )
              defenderOverlaysApplied.push(esHit.overlayToken)
              const unitOverlay = {
                type: 'UnitOverlay' as const,
                rawUnitType: defRawType,
                id: defUnitId,
                overlayIndex: esHit.overlayIndex,
              }
              unitOverlays.push({
                target: 'defender',
                overlayToken: esHit.overlayToken,
                overlayIndex: esHit.overlayIndex,
                packet0x11: encode0x11UnitOverlay(unitOverlay),
                unitOverlay,
              })
            }
          }
        }
      }

      const evaluateReactiveFormula = (skillId: number, slvl: number, field: 'auraStatCalc1' | 'calc1'): number => {
        const reg = this.registry ?? REACTIVE_FALLBACK_REGISTRY
        const skillRec = this.registry?.getSkillById(skillId) ?? REACTIVE_FALLBACK_SKILLS_113C.get(skillId)
        const fallbackRec = REACTIVE_FALLBACK_SKILLS_113C.get(skillId)
        if (!skillRec) return 0
        const expr =
          field === 'auraStatCalc1'
            ? (skillRec.auraStatCalc1 || skillRec.calc1 || fallbackRec?.auraStatCalc1 || fallbackRec?.calc1 || '')
            : (skillRec.calc1 || skillRec.auraStatCalc1 || fallbackRec?.calc1 || fallbackRec?.auraStatCalc1 || '')
        return evaluateCalc(expr, {
          registry: reg,
          activeSkill: skillRec,
          slvl,
          blvl: this.statList.getBaseSkillLevel(skillId),
          getBaseSkillLevel: (id: number) => this.statList.getBaseSkillLevel(id),
          getEffectiveSkillLevel: (id: number) => this.statList.getEffectiveSkillLevel(id),
        })
      }

      const hasEventTrigger = (skillId: number, expectedEvent: string): boolean => {
        if (entry.reactiveEvents && entry.reactiveEvents.length > 0) {
          return entry.reactiveEvents.some(r => r.event === expectedEvent)
        }
        const skillRec = this.registry?.getSkillById(skillId)
        const fallbackRec = REACTIVE_FALLBACK_SKILLS_113C.get(skillId)
        if (!skillRec && !fallbackRec) return false
        const ev1 = (skillRec?.auraEvent1 || fallbackRec?.auraEvent1 || '').toLowerCase()
        const ev2 = (skillRec?.auraEvent2 || fallbackRec?.auraEvent2 || '').toLowerCase()
        const ev3 = (skillRec?.auraEvent3 || fallbackRec?.auraEvent3 || '').toLowerCase()
        return ev1 === expectedEvent || ev2 === expectedEvent || ev3 === expectedEvent
      }

      // 2. Bone Armor (`state = bonearmor` or `auraeventfunc = 22`) absorbs physical damage
      if (
        (params.event === 'damagedinmelee' || params.event === 'absorbdamage') &&
        stateName === 'bonearmor' &&
        remPhys256 > 0
      ) {
        const defaultCap = calculateBoneArmorCapacity(entry.slvl, {
          boneWall: this.statList.getBaseSkillLevel(78),
          bonePrison: this.statList.getBaseSkillLevel(88),
        })
        const shieldPool256 = (entry.stats['bonearmor'] ?? defaultCap) * FIXED_ONE
        const absorb = Math.min(remPhys256, shieldPool256)
        absorbedPhys256 += absorb
        remPhys256 -= absorb
        const newPool = Math.floor((shieldPool256 - absorb) / FIXED_ONE)
        if (newPool <= 0) {
          this.removeState('bonearmor')
        } else {
          this.applyState({
            stateNameOrId: 'bonearmor',
            slvl: entry.slvl,
            stats: { ...entry.stats, bonearmor: newPool },
          })
        }
      }

      // 3. Cyclone Armor (`state = cyclonearmor` or `auraeventfunc = 25`) absorbs elemental damage
      // 1.13c Ground Truth: D2Game SkillDruid.cpp:1182-1222 (D2GAME_EventFunc25_6FD00140)
      // Absorbs Fire, Cold, and Lightning ONLY; strictly ignores Poison, Physical, and Magic damage.
      // Default shield capacity evaluates Skills.txt #235 `aurastatcalc1` (divided by 256):
      // `(ln12*(100+(skill('Twister'.blvl)+skill('Tornado'.blvl)+skill('Hurricane'.blvl))*par8)/100)*256`
      const isCycloneArmorEligibleElem =
        !params.isPoison &&
        (params.elemType === 'fire' ||
          params.elemType === 'cold' ||
          params.elemType === 'ltng' ||
          params.elemType === 'lightning')
      if (
        stateName === 'cyclonearmor' &&
        hasEventTrigger(235, params.event) &&
        isCycloneArmorEligibleElem &&
        remElem256 > 0
      ) {
        const defaultCap = Math.trunc(
          evaluateReactiveFormula(235, entry.slvl, 'auraStatCalc1') / FIXED_ONE,
        )
        const currentPool = entry.stats['bonearmor'] ?? defaultCap
        const shieldPool256 = currentPool * FIXED_ONE
        const absorb = Math.min(remElem256, shieldPool256)
        absorbedElem256 += absorb
        remElem256 -= absorb
        const newPool = Math.floor((shieldPool256 - absorb) / FIXED_ONE)
        if (newPool <= 0) {
          this.removeState('cyclonearmor')
        } else {
          this.applyState({
            stateNameOrId: 'cyclonearmor',
            slvl: entry.slvl,
            stats: {
              ...entry.stats,
              bonearmor: newPool,
            },
          })
        }
      }

      // 4. Chilling Armor (`state = chillingarmor`, `auraeventfunc = 1`) on `hitbymissile`
      if (
        (stateName === 'chillingarmor' || stateName === 'chillarmor') &&
        hasEventTrigger(60, params.event)
      ) {
        const returnFire = params.returnFire !== undefined ? Boolean(params.returnFire) : true
        if (returnFire) {
          spawnedMissiles.push('chillingarmorbolt')
          const overlayToken =
            this.registry?.getSkillById(60)?.cltOverlayA.trim().toLowerCase() || 'chillarmor_hit'
          defenderOverlaysApplied.push(overlayToken)
          const unitOverlay = {
            type: 'UnitOverlay' as const,
            rawUnitType: defRawType,
            id: defUnitId,
            overlayIndex: OVERLAY_INDEX_CHILL_ARMOR_HIT,
          }
          unitOverlays.push({
            target: 'defender',
            overlayToken,
            overlayIndex: OVERLAY_INDEX_CHILL_ARMOR_HIT,
            packet0x11: encode0x11UnitOverlay(unitOverlay),
            unitOverlay,
          })
        }
      }

      // 5. Frozen Armor (`state = frozenarmor`, `auraeventfunc = 2`) on melee physical hit
      if (
        (params.event === 'damagedinmelee' || params.event === 'attackedinmelee') &&
        stateName === 'frozenarmor'
      ) {
        // Authentic 1.13c: triggered on melee physical damage (`dwPhysDamage > 0`), deals 0 damage
        const hasPhysDamage =
          params.event === 'damagedinmelee'
            ? remPhys256 > 0
            : (params.incomingPhys256 === undefined || params.incomingPhys256 > 0)
        if (hasPhysDamage) {
          attackerStatesApplied.push('freeze')
          const overlayToken =
            this.registry?.getSkillById(40)?.cltOverlayA.trim().toLowerCase() || 'frozenarmor_hit'
          attackerOverlaysApplied.push(overlayToken)
          const unitOverlay = {
            type: 'UnitOverlay' as const,
            rawUnitType: atkRawType,
            id: atkUnitId,
            overlayIndex: OVERLAY_INDEX_FROZEN_ARMOR_HIT,
          }
          unitOverlays.push({
            target: 'attacker',
            overlayToken,
            overlayIndex: OVERLAY_INDEX_FROZEN_ARMOR_HIT,
            packet0x11: encode0x11UnitOverlay(unitOverlay),
            unitOverlay,
          })
          const shiverBlvl = this.statList.getBaseSkillLevel(50)
          const chillingBlvl = this.statList.getBaseSkillLevel(60)
          const synPoints = shiverBlvl + chillingBlvl
          const freezeFrames = calculateFrozenArmorFreezeLength(entry.slvl, synPoints)
          params.attackerStateBus?.applyState({
            stateNameOrId: 'freeze',
            slvl: entry.slvl,
            durationFrames: freezeFrames,
          })
        }
      }

      // 6. Shiver Armor (`state = shiverarmor`, `auraeventfunc = 3`) on `attackedinmelee`
      if (stateName === 'shiverarmor' && hasEventTrigger(50, params.event)) {
        attackerStatesApplied.push('cold')
        const overlayToken =
          this.registry?.getSkillById(50)?.cltOverlayA.trim().toLowerCase() || 'shiverarmor_hit'
        attackerOverlaysApplied.push(overlayToken)
        const unitOverlay = {
          type: 'UnitOverlay' as const,
          rawUnitType: atkRawType,
          id: atkUnitId,
          overlayIndex: OVERLAY_INDEX_SHIVER_ARMOR_HIT,
        }
        unitOverlays.push({
          target: 'attacker',
          overlayToken,
          overlayIndex: OVERLAY_INDEX_SHIVER_ARMOR_HIT,
          packet0x11: encode0x11UnitOverlay(unitOverlay),
          unitOverlay,
        })
        const frozenBlvl = this.statList.getBaseSkillLevel(40)
        const chillingBlvl = this.statList.getBaseSkillLevel(60)
        const synPoints = frozenBlvl + chillingBlvl
        const dmgRange = calculateShiverArmorDamage(entry.slvl, synPoints)
        const coldDmg = (dmgRange.min + dmgRange.max) / 2
        attackerColdDamage256 += Math.round(coldDmg * FIXED_ONE)
        const chillFrames = calculateShiverArmorChillLength(entry.slvl, synPoints)
        params.attackerStateBus?.applyState({
          stateNameOrId: 'cold',
          slvl: entry.slvl,
          durationFrames: chillFrames,
        })
      }

      // 7. Thorns (#103), Spirit of Barbs (#296), and Iron Golem (#90) (`auraeventfunc = 4`) on `damagedinmelee`
      if (
        (stateName === 'thorns' || stateName === 'barbs' || stateName === 'irongolem') &&
        hasEventTrigger(stateName === 'barbs' ? 296 : stateName === 'irongolem' ? 90 : 103, params.event) &&
        remPhys256 > 0
      ) {
        const thornsSkillId = stateName === 'barbs' ? 296 : stateName === 'irongolem' ? 90 : 103
        const fallbackPct = evaluateReactiveFormula(thornsSkillId, entry.slvl, 'auraStatCalc1')
        const reflectPct = entry.stats['thorns_percent'] ?? fallbackPct
        let rawReflect = Math.trunc((remPhys256 * reflectPct) / 100)
        if (params.isPvP) {
          rawReflect = Math.trunc(rawReflect / 4)
        }
        if (params.attackerStatList) {
          const physRes = params.attackerStatList.getAccruedStat('damageresist')
          if (physRes >= 100) {
            rawReflect = 0
          } else {
            rawReflect = Math.max(0, Math.trunc((rawReflect * (100 - physRes)) / 100))
          }
        }
        reflectedPhys256 += rawReflect
      }

      // 8. Iron Maiden (`state = ironmaiden`, `auraevent1 = domeleedamage`, `auraeventfunc = 4`)
      if (stateName === 'ironmaiden' && hasEventTrigger(76, params.event) && remPhys256 > 0) {
        const basePct =
          entry.stats['thorns_percent'] ??
          evaluateReactiveFormula(76, entry.slvl, 'auraStatCalc1')
        const reflectPct = params.isPvP ? Math.floor(basePct / 4) : basePct
        reflectedPhys256 += Math.trunc((remPhys256 * reflectPct) / 100)
      }

      // 9. Life Tap (`state = lifetap`, `auraeventfunc = 5`) on `damagedinmelee` / `damagedbymissile`
      if (stateName === 'lifetap' && hasEventTrigger(82, params.event) && remPhys256 > 0) {
        attackerHealed256 += Math.trunc(remPhys256 / 2)
      }

      // 10. Blood Golem (`state = bloodgolem`, `auraeventfunc = 23/26`)
      // CRITICAL 1.13c RULE (`patch.txt` line 124): Blood Golem no longer has negative shared life
      // when taking damage (`damagedinmelee` does NOT drain owner HP!), while positive life steal
      // on `domeleedamage` heals the Necromancer (`30%`).
      if (params.event === 'domeleedamage' && stateName === 'bloodgolem' && remPhys256 > 0) {
        const heal = Math.trunc((remPhys256 * 30) / 100)
        ownerHealed256 += heal
        if (params.ownerUnitStatList) {
          params.ownerUnitStatList.setHp256(params.ownerUnitStatList.getHp256() + heal)
        }
      }

      // 11. Clay Golem (`state = claygolem`, `auraevent1 = damagedinmelee`, `auraeventfunc = 27`)
      // 1.13c Ground Truth (`D2Game.dll` `0x6FC6EF70` `SKILLS_EventFunc27_ClayGolem`):
      // Triggered ONLY on `damagedinmelee` (not `attackedinmelee`), applies `STATE_SLOWED` (`slow`)
      // for 750 frames (`0x2EE`) with `item_slow = dm34(0, 75)`.
      if (stateName === 'claygolem' && hasEventTrigger(75, params.event)) {
        const slowPct =
          entry.stats['item_slow'] ?? evaluateReactiveFormula(75, entry.slvl, 'auraStatCalc1')
        attackerStatesApplied.push('slow')
        params.attackerStateBus?.applyState({
          stateNameOrId: 'slow',
          slvl: entry.slvl,
          durationFrames: 750,
          stats: { item_slow: slowPct },
        })
      }
    }

    return {
      absorbedPhys256,
      absorbedElem256,
      manaDrained256,
      reflectedPhys256,
      attackerHealed256,
      ownerHealed256,
      spawnedMissiles,
      attackerStatesApplied,
      attackerColdDamage256,
      ...(attackerOverlaysApplied.length > 0 ? { attackerOverlaysApplied } : {}),
      ...(defenderOverlaysApplied.length > 0 ? { defenderOverlaysApplied } : {}),
      ...(unitOverlays.length > 0 ? { unitOverlays } : {}),
    }
  }
}
