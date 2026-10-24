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
import { tryGetSharedDataRegistry, type D2DataRegistry } from '../../common/data/data-registry.ts'
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
          (rawCleanName === 'venom' ? this.registry?.getStateById(31) : undefined))

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
            if (params.stats && Object.keys(params.stats).length > 0) {
              ;(existingCurse as { stats: Readonly<Record<string, number>> }).stats = params.stats
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
                stats: params.stats,
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
      const chg = params.stats?.charge ?? params.stats?.progressive_charges ?? 1
      const maxChg = Math.max(1, params.stats?.max_charges ?? 3)
      const stage = chg <= 1 ? 1 : chg >= maxChg ? 3 : 2
      const dynOv = `feralrage${stage}front`
      if (!overlays.includes(dynOv)) overlays.push(dynOv)
    } else if (stateName === 'maul' || stateId === 117) {
      const chg = params.stats?.charge ?? params.stats?.progressive_charges ?? 1
      const maxChg = Math.max(1, params.stats?.max_charges ?? 3)
      const stage = chg <= 1 ? 1 : chg >= maxChg ? 3 : 2
      const dynOv = `maul${stage}front`
      if (!overlays.includes(dynOv)) overlays.push(dynOv)
    }

    // Collect reactive `auraeventfunc` from the source skill if applicable
    const reactiveEvents: { event: string; funcId: number; skillId: number; slvl: number }[] = []
    const skillRec = sourceSkillId > 0 ? this.registry?.getSkillById(sourceSkillId) : undefined
    if (skillRec) {
      if (skillRec.auraEvent1 && skillRec.auraEventFunc1 > 0) {
        reactiveEvents.push({ event: skillRec.auraEvent1.toLowerCase(), funcId: skillRec.auraEventFunc1, skillId: sourceSkillId, slvl })
      }
      if (skillRec.auraEvent2 && skillRec.auraEventFunc2 > 0) {
        reactiveEvents.push({ event: skillRec.auraEvent2.toLowerCase(), funcId: skillRec.auraEventFunc2, skillId: sourceSkillId, slvl })
      }
      if (skillRec.auraEvent3 && skillRec.auraEventFunc3 > 0) {
        reactiveEvents.push({ event: skillRec.auraEvent3.toLowerCase(), funcId: skillRec.auraEventFunc3, skillId: sourceSkillId, slvl })
      }
    }

    const isWarcryBuff = ['shout', 'battleorders', 'battlecommand'].includes(stateName)
    const entryId =
      isAura && !isWarcryBuff
        ? `aura:${stateName}:${sourceUnitId}:${String(slvl)}`
        : `state:${stateName}`
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
      stats: params.stats ?? {},
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
      stats: params.stats ?? {},
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
   * Cleansing (Skill 109): Shorten active curse and poison durations proportionally by reductionPct.
   * `remainingFrames * (100 - reductionPct) / 100`.
   * Also updates corresponding modifier in statList.
   */
  reduceCurseAndPoisonDurations(currentFrame: number, reductionPct: number): void {
    if (reductionPct <= 0) return
    const factor = Math.max(0, (100 - Math.min(100, reductionPct)) / 100)
    for (const entry of this.entries) {
      const isCurse = entry.curseType > 0
      const isPoison = entry.stateName === 'poison' || entry.stateName.includes('poison')
      if ((isCurse || isPoison) && entry.expireFrame > currentFrame) {
        const remaining = entry.expireFrame - currentFrame
        const newRemaining = Math.max(1, Math.round(remaining * factor))
        entry.expireFrame = currentFrame + newRemaining
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
            const absorbPct = Math.min(95, entry.stats['energyshield_pct'] ?? calculateEnergyShieldAbsorbPct(entry.slvl))
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
        const shieldPool256 = (entry.stats['damagearmor'] ?? defaultCap) * FIXED_ONE
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
            stats: { ...entry.stats, damagearmor: newPool },
          })
        }
      }

      // 3. Cyclone Armor (`state = cyclonearmor` or `auraeventfunc = 25`) absorbs elemental damage
      // 1.13c Ground Truth: D2Game SkillDruid.cpp:1182-1222 (D2GAME_EventFunc25_6FD00140)
      // Absorbs Fire, Cold, and Lightning ONLY; strictly ignores Poison, Physical, and Magic damage.
      const isCycloneArmorEligibleElem =
        !params.isPoison &&
        (params.elemType === 'fire' ||
          params.elemType === 'cold' ||
          params.elemType === 'ltng' ||
          params.elemType === 'lightning')
      if (
        params.event === 'absorbdamage' &&
        stateName === 'cyclonearmor' &&
        isCycloneArmorEligibleElem &&
        remElem256 > 0
      ) {
        const defaultCap = 40 + (entry.slvl - 1) * 12
        const currentPool =
          entry.stats['cyclone_armor_absorb'] ?? entry.stats['magicarmor'] ?? defaultCap
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
              cyclone_armor_absorb: newPool,
              magicarmor: newPool,
            },
          })
        }
      }

      // 4. Chilling Armor (`state = chillingarmor`, `auraeventfunc = 1`) on `hitbymissile`
      if (params.event === 'hitbymissile' && (stateName === 'chillingarmor' || stateName === 'chillarmor')) {
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
      if (params.event === 'attackedinmelee' && stateName === 'shiverarmor') {
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

      // 7. Thorns & Spirit of Barbs (`state = thorns | barbs`, `auraeventfunc = 4`) on `damagedinmelee`
      if (
        params.event === 'damagedinmelee' &&
        (stateName === 'thorns' || stateName === 'barbs') &&
        remPhys256 > 0
      ) {
        const fallbackPct = stateName === 'barbs' ? 50 + (entry.slvl - 1) * 20 : 250 + (entry.slvl - 1) * 40
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
      if (params.event === 'domeleedamage' && stateName === 'ironmaiden' && remPhys256 > 0) {
        const basePct =
          entry.stats['ironmaiden_return_pct'] ??
          entry.stats['thorns_percent'] ??
          (200 + (entry.slvl - 1) * 25)
        const reflectPct = params.isPvP ? Math.floor(basePct / 4) : basePct
        reflectedPhys256 += Math.trunc((remPhys256 * reflectPct) / 100)
      }

      // 8. Life Tap (`state = lifetap`, `auraeventfunc = 5`) on `damagedinmelee` / `damagedbymissile`
      if (
        (params.event === 'damagedinmelee' || params.event === 'damagedbymissile') &&
        stateName === 'lifetap' &&
        remPhys256 > 0
      ) {
        attackerHealed256 += Math.trunc(remPhys256 / 2)
      }

      // 9. Blood Golem (`state = bloodgolem`, `auraeventfunc = 23/26`)
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

      // 10. Clay Golem (`state = claygolem`, `auraeventfunc = 27`) slows enemy on melee contact
      if (params.event === 'attackedinmelee' && stateName === 'claygolem') {
        attackerStatesApplied.push('slow')
        params.attackerStateBus?.applyState({
          stateNameOrId: 'slow',
          slvl: entry.slvl,
          durationFrames: 200,
          stats: { item_slow: Math.min(75, 15 + entry.slvl * 3) },
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
