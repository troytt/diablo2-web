/**
 * Diablo II: Lord of Destruction v1.13c `AnimData.d2` Frame Dispatcher (`AnimDispatcher`).
 *
 * Implements:
 * - 1.13c `EIAS` (`floor((120 * IAS) / (120 + IAS)) + skillIas - WSM`, clamped `[-85, 75]`),
 *   `EFCR` (`floor((120 * FCR) / (120 + FCR))`, clamped `[-85, 75]`),
 *   `EFHR` (`50 + floor((120 * FHR) / (120 + FHR))`), and
 *   `EFBR` (`(holyShield ? 100 : 50) + floor((120 * FBR) / (120 + FBR))`).
 * - `AnimData.d2` 8.8 fixed-point frame advancement (`speed = (animSpeed * (100 + effRate)) / 100`).
 * - Action frame flag (`0x01` melee/cast release, `0x02` missile launch) dispatching.
 * - Multi-hit `ROLLBACK_SKILLS_113C` (`#26 Strafe` 50%, `#30 Fend` 60%, `#106 Zeal` 100%,
 *   `#248 Fury` 70%, `#255 Dragon Talon` 100%) and `SequenceTbls` (`anim = SQ`: `#10 Jab`,
 *   `#133 Double Swing`, `#140 Double Throw`, `#147 Frenzy`, `#260 Dragon Claw`, `#19 Impale`)
 *   per-keyframe strike dispatching (#1862).
 * - Frame-lock (`anim_locked`) and pre-`ActionFlag` interruption on `PLRMODE_GETHIT` (`GH`, mode 4)
 *   and `PLRMODE_BLOCK` (`BL`, mode 9), honoring uninterruptible skills (`Skills.txt` `interrupt=0`,
 *   `#144 Concentrate`, `#106 Zeal`, `#248 Fury`, `#151 Whirlwind`, `#132/#143 Leap`, `#275 Dragon Flight`) (#1789).
 * - `STATE_SKILLDELAY` (`state 121`) global cooldown enforcement (`delay` ticks from `Skills.txt`) (#1877).
 * - Shapeshift / weapon `restrict` validation (`restrict=1` any form, `restrict=2` shapeshift only,
 *   `restrict=0` human form only except Armageddon `249`).
 * - Mana (`manaCost256`) and ammo quantity (`decquant`) deduction on the action frame.
 */
import type { D2DataRegistry, SkillRecord } from '../../common/data/data-registry.ts'
import type { AnimDataRecord } from '../../common/formats/animdata.ts'
import { evaluateCalc, computeSkillManaCost256 } from '../../common/data/calc-ast.ts'
import { cltStAttackRate113c } from '../../common/skills/clt-st-attackrate-113c.ts'
import { resolveSkillSequenceFrame } from '../../common/skills/skill-anim-modes.ts'
import {
  ROLLBACK_SKILLS_113C,
  computeBlockEffRate113c,
  computeGetHitEffRate113c,
  computeOneShotTicks,
  computeShapeshiftWeaponDelay113c,
  computeStepSpeed256,
  getCharAnimClip113c,
  playerAnimStartFrame113c,
  type CharAnimClipKey,
} from '../../common/units/char-anim-speed.ts'

/** `PlrType.txt` token -> player class id (`unit+0x04`) for `0x6FD82220`. */
const PLAYER_CLASS_ID_BY_TOKEN_113C: Readonly<Record<string, number>> = {
  AM: 0, SO: 1, NE: 2, PA: 3, BA: 4, DZ: 5, AI: 6,
}
import { UnitStatList } from './stat-list.ts'
import { StateBus } from './state-bus.ts'

/** Multi-strike `anim === 'SQ'` player skills whose `SequenceTbls` entries contain multiple strike events (#1862). */
const SQ_MULTI_STRIKE_SKILL_IDS_113C: ReadonlySet<number> = new Set([10, 133, 140, 147, 260])

/**
 * 1.13c Diminishing returns conversion for IAS (`EIAS`), FCR (`EFCR`), FHR (`EFHR`), and FBR (`EFBR`):
 * `floor((120 * rate) / (120 + rate))`
 */
export function computeDiminishingRate113c(statRate: number): number {
  if (!Number.isFinite(statRate)) return 0
  const v = Math.trunc(statRate)
  if (v <= 0) return Math.max(-85, v)
  return Math.trunc((120 * v) / (120 + v))
}

export function computeEffectiveIas(params: {
  itemIas: number
  skillIas?: number // e.g. Fanaticism / Burst of Speed / Frenzy / Werewolf / Double Swing (+50)
  weaponWsm?: number // e.g. -30 for Phase Blade, +20 for Thunder Maul
}): number {
  const eias =
    computeDiminishingRate113c(params.itemIas) + (params.skillIas ?? 0) - (params.weaponWsm ?? 0)
  return Math.max(-85, Math.min(75, Math.trunc(eias)))
}

export function computeEffectiveFcr(itemFcr: number): number {
  const efcr = computeDiminishingRate113c(itemFcr)
  return Math.max(-85, Math.min(75, Math.trunc(efcr)))
}

export function computeEffectiveFhr(itemFhr: number): number {
  return computeDiminishingRate113c(itemFhr)
}

export function computeEffectiveFbr(itemFbr: number): number {
  return computeDiminishingRate113c(itemFbr)
}

/**
 * 1.13c `Skills.txt` `interrupt` + `SkillFlags` (`D2Game.dll` `SUNITDMG_ExecuteEvents` @ `0x6FCFD0FC`,
 * `SKILLS_SrvSt32_Concentrate`, `SKILLS_SrvSt37_Zeal_Fury` `SKILLS_SetFlags(0x200)`):
 * Returns `false` when the active skill cannot be interrupted by `PLRMODE_GETHIT` (`GH`) or `PLRMODE_BLOCK` (`BL`):
 * - `Skills.txt` `interrupt = 0` (`#1 Kick, #10 Jab, #26 Strafe, #30 Fend, #97 Smite, #106 Zeal, #107 Charge,
 *   #144 Concentrate, #147 Frenzy, #151 Whirlwind, #223 Wearwolf, #228 Wearbear`)
 * - Airborne / teleport / `0x200`-flagged attacks: `#132 Leap`, `#143 Leap Attack`, `#248 Fury`, `#275 Dragon Flight`.
 */
export function isSkillInterruptible113c(skill: Pick<SkillRecord, 'id' | 'interrupt'>): boolean {
  if (!skill.interrupt) return false
  if (
    skill.id === 132 ||
    skill.id === 143 ||
    skill.id === 248 ||
    skill.id === 275
  ) {
    return false
  }
  return true
}

export interface ActiveAnimationState {
  readonly skill: SkillRecord
  readonly slvl: number
  readonly cofName: string
  readonly animRecord: AnimDataRecord
  readonly framesPerDirection: number
  readonly stepSpeed256: number
  readonly actionFrame: number
  readonly isSequence?: boolean
  readonly sequenceEventFrames?: readonly number[] | undefined
  readonly rollbackFrame: number | null
  readonly totalStrikes: number
  readonly targetX: number
  readonly targetY: number
  readonly manaDeductedOnStart?: boolean
  frameAcc256: number
  currentFrame: number
  strikesFired: number
  actionTriggered: boolean
  aborted?: boolean | undefined
  completed: boolean
}

export interface RecoveryAnimationState {
  readonly mode: 'GH' | 'BL'
  readonly cofName: string
  readonly framesPerDirection: number
  readonly stepSpeed256: number
  frameAcc256: number
  currentFrame: number
  completed: boolean
}

export interface RecoveryTransitionResult {
  readonly entered: boolean
  readonly interrupted: boolean
  readonly recoveryTicks: number
  readonly stepSpeed256: number
  readonly framesPerDirection: number
}

export interface CastAttemptResult {
  readonly allowed: boolean
  readonly reason?:
    | 'skill_delay'
    | 'insufficient_mana'
    | 'restrict_shapeshift'
    | 'restrict_human'
    | 'passive_skill'
    | 'anim_locked'
  readonly animState?: ActiveAnimationState
}

export class AnimDispatcher {
  readonly registry: D2DataRegistry
  readonly statList: UnitStatList
  readonly stateBus: StateBus
  readonly charToken: string // 'AM' | 'SO' | 'NE' | 'PA' | 'BA' | 'DZ' | 'AI'
  private weaponClass: string // 'HTH' | '1HS' | 'BOW' | '1HT' | 'HT1' | 'HT2' | 'STF' ...
  private weaponWsm: number
  private primaryWeaponWsm: number
  private primaryWeaponIas: number
  private enforceFrameLock: boolean
  private currentAnim: ActiveAnimationState | null = null
  private currentRecovery: RecoveryAnimationState | null = null
  private skillDelayExpireFrame = 0
  private ammoQuantity = 250

  constructor(params: {
    registry: D2DataRegistry
    statList: UnitStatList
    stateBus: StateBus
    charToken: string
    weaponClass?: string
    weaponWsm?: number
    primaryWeaponWsm?: number
    primaryWeaponIas?: number
    enforceFrameLock?: boolean
  }) {
    this.registry = params.registry
    this.statList = params.statList
    this.stateBus = params.stateBus
    this.charToken = params.charToken.toUpperCase()
    const norm = (params.weaponClass ?? 'HTH').trim().toUpperCase()
    this.weaponClass = norm === 'H2H' ? 'HT1' : norm
    this.weaponWsm = Math.trunc(params.weaponWsm ?? 0)
    this.primaryWeaponWsm = Math.trunc(params.primaryWeaponWsm ?? params.weaponWsm ?? 0)
    this.primaryWeaponIas = Math.trunc(params.primaryWeaponIas ?? 0)
    this.enforceFrameLock = Boolean(params.enforceFrameLock)
  }

  getWeaponClass(): string {
    return this.weaponClass
  }

  setWeaponClass(wclass: string): void {
    const norm = (wclass || 'HTH').trim().toUpperCase()
    this.weaponClass = norm === 'H2H' ? 'HT1' : norm
  }

  getWeaponWsm(): number {
    return this.weaponWsm
  }

  setWeaponWsm(wsm: number): void {
    this.weaponWsm = Math.trunc(wsm || 0)
  }

  getPrimaryWeaponWsm(): number {
    return this.primaryWeaponWsm
  }

  setPrimaryWeaponWsm(wsm: number): void {
    this.primaryWeaponWsm = Math.trunc(wsm || 0)
  }

  getPrimaryWeaponIas(): number {
    return this.primaryWeaponIas
  }

  setPrimaryWeaponIas(ias: number): void {
    this.primaryWeaponIas = Math.trunc(ias || 0)
  }

  setEnforceFrameLock(enabled: boolean): void {
    this.enforceFrameLock = enabled
  }

  isEnforceFrameLockEnabled(): boolean {
    return this.enforceFrameLock
  }

  isInRecovery(): boolean {
    return this.currentRecovery !== null && !this.currentRecovery.completed
  }

  getCurrentRecovery(): RecoveryAnimationState | null {
    return this.currentRecovery
  }

  isActionLocked(): boolean {
    if (this.isInRecovery()) return true
    return this.currentAnim !== null && !this.currentAnim.completed
  }

  clearAnimation(): void {
    if (this.currentAnim && !this.currentAnim.completed) {
      this.currentAnim.completed = true
    }
    this.currentAnim = null
  }

  clearRecovery(): void {
    if (this.currentRecovery && !this.currentRecovery.completed) {
      this.currentRecovery.completed = true
    }
    this.currentRecovery = null
  }

  syncSkillDelayExpireFrame(expireFrame: number): void {
    this.skillDelayExpireFrame = Math.max(0, Math.trunc(expireFrame))
  }

  isSkillDelayActive(currentTick: number): boolean {
    return (
      this.skillDelayExpireFrame > currentTick ||
      this.stateBus.hasState('skilldelay') ||
      this.stateBus.hasState(121)
    )
  }

  getRemainingSkillDelay(currentTick: number): number {
    return Math.max(0, this.skillDelayExpireFrame - currentTick)
  }

  getAmmoQuantity(): number {
    const statQty = this.statList.getAccruedStat('quantity')
    if (statQty > 0) {
      return statQty
    }
    return this.ammoQuantity
  }

  setAmmoQuantity(qty: number): void {
    const val = Math.max(0, Math.trunc(qty))
    this.ammoQuantity = val
    if (this.statList.getAccruedStat('quantity') > 0 || this.statList.getBaseStat('quantity') > 0) {
      this.statList.setBaseStat('quantity', val)
    }
  }

  private resolveActiveMorphState(): {
    readonly inWolf: boolean
    readonly inBear: boolean
    readonly inVamp: boolean
    readonly activeToken: string
    readonly activeWclass: string
    readonly morphMonsterClassId: number | undefined
  } {
    const inWolf =
      this.stateBus.hasState('wolf') ||
      this.stateBus.hasState('wearwolf') ||
      this.stateBus.hasState(139)
    const inBear =
      !inWolf &&
      (this.stateBus.hasState('bear') ||
        this.stateBus.hasState('wearbear') ||
        this.stateBus.hasState(140))
    const inVamp =
      !inWolf &&
      !inBear &&
      (this.stateBus.hasState('monsterset') ||
        this.stateBus.hasState('vampire') ||
        // States.txt 176 `monsterset` (Vampire morph); 65 is the Amazon `dodge` passive state.
        this.stateBus.hasState(176))
    const activeToken = inWolf ? '40' : inBear ? 'TG' : inVamp ? 'VA' : this.charToken
    const activeWclass = inWolf || inBear || inVamp ? 'HTH' : this.weaponClass
    const morphMonsterClassId = inWolf ? 430 : inBear ? 431 : inVamp ? 135 : undefined
    return { inWolf, inBear, inVamp, activeToken, activeWclass, morphMonsterClassId }
  }

  private resolveAnimRecord113c(
    cofName: string,
    modeUpper: string,
    activeWclass: string,
    morphMonsterClassId: number | undefined,
  ): AnimDataRecord | undefined {
    const fromRegistry = this.registry.getAnimDataRecord(cofName)
    if (fromRegistry !== undefined) {
      return fromRegistry
    }
    if (modeUpper !== 'S4' && activeWclass !== 'HTH') {
      const fromHth = this.registry.getAnimDataRecord(`${cofName.slice(0, 2)}${modeUpper}HTH`)
      if (fromHth !== undefined) {
        return fromHth
      }
    }
    // If the registry has real AnimData.d2 records loaded (e.g. MPQ-backed D2DataRegistry),
    // missing COF names are genuinely non-existent in 1.13c (such as `AIS4BOW`, #1478).
    if (this.registry.getAnimDataRecord('SOSCHTH') !== undefined) {
      return undefined
    }
    // Embedded isomorphic fallback (`GameInstance` when constructed without raw AnimData.d2 bytes):
    // synthesize the exact canonical 1.13c AnimDataRecord from `CHAR_ANIM_CLIPS_113C`.
    if (modeUpper === 'S4' && (this.charToken !== 'AI' || (activeWclass !== 'HT1' && activeWclass !== 'HT2'))) {
      return undefined
    }
    const clipKey = modeUpper.toLowerCase() as CharAnimClipKey
    const clip = getCharAnimClip113c(this.charToken, clipKey, {
      weaponClass: activeWclass,
      morphMonsterClassId,
    })
    const events = clip.events.map((e) => ({ frame: e.f, code: e.c }))
    let nameHash = 0
    for (let i = 0; i < cofName.length; i++) {
      nameHash = (nameHash + cofName.toUpperCase().charCodeAt(i)) & 0xff
    }
    return {
      name: cofName.toUpperCase(),
      framesPerDirection: clip.frames,
      animationSpeed: clip.speed,
      hasSpeed: clip.speed > 0,
      events,
      block: nameHash,
    }
  }

  /**
   * Validate shapeshift `restrict` rule from `Skills.txt` (`States.txt` `restrict = 1`: `wolf` 139, `bear` 140, `delerium` 177):
   * - `restrict = 0`: usable in human form only (except `Armageddon` 249 and `Werewolf` 223 / `Werebear` 228 unshift)
   * - `restrict = 1`: usable in both human and shapeshift forms (unless `state1..3` restricts to specific morph states)
   * - `restrict = 2`: usable in specified shapeshift (`STATE_WOLF` / `STATE_BEAR`) form only!
   */
  validateRestriction(skill: SkillRecord): { ok: boolean; reason?: 'restrict_shapeshift' | 'restrict_human' } {
    const { inWolf, inBear } = this.resolveActiveMorphState()
    const inDelerium =
      this.stateBus.hasState('delerium') ||
      this.stateBus.hasState('delirium') ||
      this.stateBus.hasState(177)
    const inWolfOrBear = inWolf || inBear
    const inMorphed = inWolfOrBear || inDelerium
    const matchesAllowedState = (name: string): boolean => {
      const n = name.trim().toLowerCase()
      if (!n) return false
      if (n === 'wolf' || n === 'werewolf' || n === 'wearwolf') return inWolf
      if (n === 'bear' || n === 'werebear' || n === 'wearbear') return inBear
      if (n === 'delerium' || n === 'delirium') return inDelerium
      return this.stateBus.hasState(n)
    }
    const allowedStates = [skill.state1, skill.state2, skill.state3].filter((s) => Boolean(s && s.trim()))

    if (skill.restrict === 2) {
      if (allowedStates.length > 0) {
        if (!allowedStates.some(matchesAllowedState)) {
          return { ok: false, reason: 'restrict_shapeshift' }
        }
      } else if (!inWolfOrBear) {
        return { ok: false, reason: 'restrict_shapeshift' }
      }
      if ((skill.id === 232 || skill.id === 238 || skill.id === 248) && !inWolf) {
        return { ok: false, reason: 'restrict_shapeshift' }
      }
      if ((skill.id === 233 || skill.id === 243) && !inBear) {
        return { ok: false, reason: 'restrict_shapeshift' }
      }
    }
    if (skill.restrict === 1 && inMorphed && allowedStates.length > 0) {
      if (!allowedStates.some(matchesAllowedState)) {
        return { ok: false, reason: 'restrict_human' }
      }
    }
    if (
      skill.restrict === 0 &&
      inMorphed &&
      skill.id !== 249 && // Armageddon usable in shapeshift
      skill.id !== 223 && // Werewolf toggle
      skill.id !== 228 && // Werebear toggle
      skill.id !== 0 // Attack usable in shapeshift
    ) {
      return { ok: false, reason: 'restrict_human' }
    }
    return { ok: true }
  }

  /**
   * 1.13c `D2Common.dll` `SKILLS_CheckSkillMana` (`0x6FDA0AF0` @ `0x6FDA0BEB`) & `D2Game.dll`
   * `SKILLS_CheckSkillMana` (`0x6FCBEC80` @ `0x6FCBECEF`) / `SKILLS_SrvDo116_Wearwolf_Wearbear` (`0x6FC66210`):
   * `nocostinstate = 1` (`Wearwolf` #223 `aurastate = wolf` #139, `Wearbear` #228 `aurastate = bear` #140)
   * waives mana cost only when the unit is already in the skill's shapeshift state (`auraState`).
   */
  private isNoCostInActiveState(skill: SkillRecord): boolean {
    if (!skill.noCostInState && !skill.nocostinstate) return false
    if (skill.auraState === 'wolf' || skill.id === 223) {
      return (
        this.stateBus.hasState('wolf') ||
        this.stateBus.hasState('wearwolf') ||
        this.stateBus.hasState(139)
      )
    }
    if (skill.auraState === 'bear' || skill.id === 228) {
      return (
        this.stateBus.hasState('bear') ||
        this.stateBus.hasState('wearbear') ||
        this.stateBus.hasState(140)
      )
    }
    return skill.auraState !== '' && this.stateBus.hasState(skill.auraState)
  }

  /**
   * Resolve all `SequenceTbls` action event frame indices (`event === 1 | 2 | 4`) for an `SQ` skill (#1862).
   */
  private resolveSequenceEventFrames113c(
    skillId: number,
    weaponClass: string,
    strikeCountOverride?: number,
  ): { readonly totalSequenceFrames: number; readonly eventFrames: readonly number[] } | null {
    const seqWclass =
      skillId === 10 && weaponClass !== '1HT' && weaponClass !== '2HT'
        ? '1HT'
        : skillId === 260 && weaponClass === 'HTH' && (strikeCountOverride === undefined || strikeCountOverride >= 2)
          ? 'HT2'
          : weaponClass
    const f0 = resolveSkillSequenceFrame(skillId, seqWclass, 0, 256)
    if (!f0) return null
    const rawEvents: number[] = []
    for (let i = 0; i < f0.totalSequenceFrames; i++) {
      const fi = resolveSkillSequenceFrame(skillId, seqWclass, i, 256)
      if (fi && (fi.event === 1 || fi.event === 2 || fi.event === 4)) {
        rawEvents.push(i)
      }
    }
    if (SQ_MULTI_STRIKE_SKILL_IDS_113C.has(skillId)) {
      const events =
        rawEvents.length > 0 ? rawEvents : [Math.max(1, f0.totalSequenceFrames - 1)]
      return { totalSequenceFrames: f0.totalSequenceFrames, eventFrames: events }
    }
    // Single-action SQ skills:
    // - #41 Inferno / #230 Arctic Blast hold on channel frame 10
    // - #107 Charge / #132 Leap / #143 Leap Attack resolve impact/landing on frame 11
    // - #275 Dragon Flight resolves arrival kick on frame 14
    let triggerFrame: number
    if (skillId === 41 || skillId === 230) {
      triggerFrame = Math.min(f0.totalSequenceFrames - 1, 10)
    } else if (skillId === 107 || skillId === 132 || skillId === 143) {
      triggerFrame = Math.min(f0.totalSequenceFrames - 1, 11)
    } else if (skillId === 275) {
      triggerFrame = Math.min(f0.totalSequenceFrames - 1, 14)
    } else if (rawEvents.length > 0) {
      triggerFrame = rawEvents[0]!
    } else {
      triggerFrame = Math.max(1, f0.totalSequenceFrames - 1)
    }
    return { totalSequenceFrames: f0.totalSequenceFrames, eventFrames: [triggerFrame] }
  }

  /**
   * Initiate a skill animation (`srvstfunc` phase).
   */
  startSkillAnimation(params: {
    skill: SkillRecord
    slvl: number
    currentTick: number
    targetX?: number
    targetY?: number
    strikeCountOverride?: number
    allowOverride?: boolean
    skipResourceCommit?: boolean
    onActionFrame?: (anim: ActiveAnimationState, tick: number, strikeIndex: number) => void
  }): CastAttemptResult {
    const { skill, slvl, currentTick } = params
    if (skill.passive) {
      return { allowed: false, reason: 'passive_skill' }
    }

    if (this.enforceFrameLock && !params.allowOverride) {
      if (this.isInRecovery()) {
        return { allowed: false, reason: 'anim_locked' }
      }
      if (this.currentAnim && !this.currentAnim.completed) {
        const canRefreshChannel =
          skill.startMana > 0 &&
          this.currentAnim.skill.id === skill.id &&
          this.currentAnim.actionTriggered
        if (!canRefreshChannel) {
          return { allowed: false, reason: 'anim_locked' }
        }
      }
    }

    // Check `STATE_SKILLDELAY` cooldown if the skill itself has a `delay` (`cd` skills)
    const delayTicks = skill.delay
      ? evaluateCalc(skill.delay, {
          registry: this.registry,
          activeSkill: skill,
          slvl,
          blvl: this.statList.getBaseSkillLevel(skill.id),
        })
      : 0

    if (delayTicks > 0 && this.isSkillDelayActive(currentTick)) {
      return { allowed: false, reason: 'skill_delay' }
    }

    // Check shapeshift `restrict`
    const restrictCheck = this.validateRestriction(skill)
    if (!restrictCheck.ok) {
      return { allowed: false, reason: restrictCheck.reason ?? 'restrict_shapeshift' }
    }

    // Check `startmana` & `manaCost256` before starting animation
    const isFreeInState = this.isNoCostInActiveState(skill)
    const { manaCost256 } = computeSkillManaCost256(skill, slvl)
    const inInfernoChannel =
      this.stateBus.hasState('inferno') || this.stateBus.hasState(12)
    if (!params.skipResourceCommit && !isFreeInState) {
      if (
        skill.startMana > 0 &&
        !inInfernoChannel &&
        this.statList.getMana256() < (skill.startMana << 8)
      ) {
        return { allowed: false, reason: 'insufficient_mana' }
      }
      if (this.statList.getMana256() < manaCost256) {
        if (skill.startMana > 0 && inInfernoChannel) {
          this.stateBus.removeState('inferno')
          this.stateBus.removeState(12)
        }
        return { allowed: false, reason: 'insufficient_mana' }
      }
    }

    const { inWolf, inBear, activeToken, activeWclass, morphMonsterClassId } =
      this.resolveActiveMorphState()

    const rawMode = (skill.anim || 'SC').toUpperCase()
    const isSequence = rawMode === 'SQ'
    const mode = isSequence
      ? ((skill.seqTrans && skill.seqTrans.toUpperCase() !== 'SQ' ? skill.seqTrans : 'SC') || 'A1').toUpperCase()
      : rawMode

    const cofWclass =
      skill.id === 10 && activeWclass === 'HTH' && !(inWolf || inBear)
        ? '1HT'
        : activeWclass
    const cofName = `${activeToken}${mode}${cofWclass}`
    const animRecord = this.resolveAnimRecord113c(cofName, mode, cofWclass, morphMonsterClassId)
    if (!animRecord || !animRecord.hasSpeed) {
      return { allowed: false, reason: 'passive_skill' }
    }

    if (!params.skipResourceCommit && skill.startMana > 0) {
      const channelDuration =
        skill.id === 266 ? (inInfernoChannel ? 7 : 21) : inInfernoChannel ? 6 : 20
      this.stateBus.applyState({
        stateNameOrId: 'inferno',
        sourceSkillId: skill.id,
        slvl,
        durationFrames: channelDuration,
        currentFrame: currentTick,
      })
    }

    let manaDeductedOnStart = false
    if (!params.skipResourceCommit && !isFreeInState && skill.srvStFunc > 0 && !skill.useManaOnDo) {
      this.statList.setMana256(this.statList.getMana256() - manaCost256)
      manaDeductedOnStart = true
    }

    const seqTransUpper = (skill.seqTrans || '').toUpperCase()
    const isCastMode = mode === 'SC' || (isSequence && (seqTransUpper === 'SC' || seqTransUpper === 'SQ'))
    const skillCltIas = cltStAttackRate113c(skill.id)

    let stepSpeed256: number
    if ((inWolf || inBear) && !isCastMode) {
      // 1.13c D2Common shapeshift attack speed formula
      const weaponDelay = computeShapeshiftWeaponDelay113c(
        this.charToken,
        this.weaponClass,
        this.primaryWeaponWsm,
        this.primaryWeaponIas,
        this.weaponClass !== 'HTH',
      )
      const baseSpeed = Math.max(1, Math.floor((animRecord.framesPerDirection * 256) / weaponDelay))
      const effIas = computeEffectiveIas({
        itemIas: this.statList.getAccruedStat('item_fasterattackrate'),
        skillIas:
          this.statList.getModifierBonus('attackrate') + skillCltIas - (isSequence ? 30 : 0),
        weaponWsm: this.weaponWsm,
      })
      stepSpeed256 = Math.max(32, Math.trunc((baseSpeed * (100 + effIas)) / 100))
    } else {
      const effRate = isCastMode
        ? computeEffectiveFcr(this.statList.getAccruedStat('item_fastercastrate'))
        : computeEffectiveIas({
            itemIas: this.statList.getAccruedStat('item_fasterattackrate'),
            skillIas:
              this.statList.getModifierBonus('attackrate') + skillCltIas - (isSequence ? 30 : 0),
            weaponWsm: this.weaponWsm,
          })
      stepSpeed256 = Math.max(32, Math.trunc((animRecord.animationSpeed * (100 + effRate)) / 100))
    }

    const seqInfo = isSequence
      ? this.resolveSequenceEventFrames113c(skill.id, this.weaponClass, params.strikeCountOverride)
      : null
    const framesPerDirection = seqInfo ? seqInfo.totalSequenceFrames : animRecord.framesPerDirection
    const actionEvt = animRecord.events.find((e) => (e.code & (0x01 | 0x02)) !== 0)
    const baseActionFrame = actionEvt
      ? actionEvt.frame
      : Math.max(1, framesPerDirection - 1)
    const sequenceEventFrames = seqInfo ? seqInfo.eventFrames : undefined
    const actionFrame =
      sequenceEventFrames && sequenceEventFrames.length > 0
        ? sequenceEventFrames[0]!
        : baseActionFrame

    const rollbackSpec = !isSequence ? ROLLBACK_SKILLS_113C[skill.id] : undefined
    let totalStrikes = 1
    let rollbackFrame: number | null = null
    if (sequenceEventFrames) {
      totalStrikes = sequenceEventFrames.length
    } else if (rollbackSpec) {
      totalStrikes = Math.max(
        1,
        Math.trunc(params.strikeCountOverride ?? rollbackSpec.computeStrikes(slvl)),
      )
      if (totalStrikes > 1) {
        rollbackFrame = Math.max(
          0,
          Math.min(
            actionFrame - 1,
            Math.floor((actionFrame * (100 - rollbackSpec.rollbackPct)) / 100),
          ),
        )
      }
    }

    // 1.13c `0x6FD835F0` mode-start init: `dwFrame = UNITS_GetAnimStartFrame(unit) << 8` (`0x6FD8363C`).
    // Only an unmorphed player in A1 / A2 can start late (Amazon / Sorceress weapon classes, `0x6FDE4480`);
    // a sequence (`PLRMODE_SEQUENCE` 18) and a morphed (monster-type) unit start at frame 0.
    const playerClassId = PLAYER_CLASS_ID_BY_TOKEN_113C[this.charToken]
    if (playerClassId === undefined) throw new Error(`AnimDispatcher: unknown player token '${this.charToken}'`)
    const startFrame =
      isSequence || inWolf || inBear || morphMonsterClassId !== undefined
        ? 0
        : playerAnimStartFrame113c(playerClassId, mode === 'A1' ? 7 : mode === 'A2' ? 8 : -1, activeWclass)

    this.currentAnim = {
      skill,
      slvl,
      cofName,
      animRecord,
      framesPerDirection,
      stepSpeed256,
      actionFrame,
      isSequence,
      ...(sequenceEventFrames !== undefined ? { sequenceEventFrames } : {}),
      rollbackFrame,
      totalStrikes,
      targetX: params.targetX ?? 0,
      targetY: params.targetY ?? 0,
      manaDeductedOnStart: params.skipResourceCommit ? true : manaDeductedOnStart,
      frameAcc256: startFrame * 256,
      currentFrame: startFrame,
      strikesFired: 0,
      actionTriggered: false,
      completed: false,
    }

    return {
      allowed: true,
      animState: this.currentAnim,
    }
  }

  /**
   * Enter `PLRMODE_GETHIT` (`GH`, mode 4) recovery, interrupting any active interruptible skill
   * whose first `ActionFlag` has not yet fired (#1789).
   */
  enterGetHit(params?: { readonly fhrOverride?: number }): RecoveryTransitionResult {
    if (
      this.currentAnim &&
      !this.currentAnim.completed &&
      !isSkillInterruptible113c(this.currentAnim.skill)
    ) {
      return {
        entered: false,
        interrupted: false,
        recoveryTicks: 0,
        stepSpeed256: 0,
        framesPerDirection: 0,
      }
    }

    const { activeToken, activeWclass, morphMonsterClassId } = this.resolveActiveMorphState()
    const cofPrimary = `${activeToken}GH${activeWclass}`
    const rec =
      this.resolveAnimRecord113c(cofPrimary, 'GH', activeWclass, morphMonsterClassId) ??
      this.resolveAnimRecord113c(`${activeToken}GHHTH`, 'GH', 'HTH', morphMonsterClassId)
    const framesPerDirection = Math.max(1, rec?.framesPerDirection ?? 6)
    const baseSpeed = rec?.animationSpeed && rec.animationSpeed > 0 ? rec.animationSpeed : 256
    const fhr =
      params?.fhrOverride !== undefined
        ? Math.trunc(params.fhrOverride)
        : Math.trunc(this.statList.getAccruedStat('item_fastergethitrate'))
    const stepSpeed256 = computeStepSpeed256(baseSpeed, computeGetHitEffRate113c(fhr))
    const recoveryTicks = computeOneShotTicks(framesPerDirection, stepSpeed256)

    let interrupted = false
    if (this.currentAnim && !this.currentAnim.completed) {
      if (!this.currentAnim.actionTriggered) {
        interrupted = true
        this.currentAnim.aborted = true
      }
      this.currentAnim.completed = true
    }

    this.currentRecovery = {
      mode: 'GH',
      cofName: rec?.name ?? cofPrimary,
      framesPerDirection,
      stepSpeed256,
      frameAcc256: 0,
      currentFrame: 0,
      completed: false,
    }

    return {
      entered: true,
      interrupted,
      recoveryTicks,
      stepSpeed256,
      framesPerDirection,
    }
  }

  /**
   * Enter `PLRMODE_BLOCK` (`BL`, mode 9) recovery (`50 + EFBR`, or `100 + EFBR` with Holy Shield),
   * interrupting any active interruptible skill whose first `ActionFlag` has not yet fired (#1789).
   */
  enterBlock(params?: {
    readonly fbrOverride?: number
    readonly holyShield?: boolean
  }): RecoveryTransitionResult {
    if (
      this.currentAnim &&
      !this.currentAnim.completed &&
      !isSkillInterruptible113c(this.currentAnim.skill)
    ) {
      return {
        entered: false,
        interrupted: false,
        recoveryTicks: 0,
        stepSpeed256: 0,
        framesPerDirection: 0,
      }
    }

    const { activeToken, activeWclass, morphMonsterClassId } = this.resolveActiveMorphState()
    const cofPrimary = `${activeToken}BL${activeWclass}`
    const rec =
      this.resolveAnimRecord113c(cofPrimary, 'BL', activeWclass, morphMonsterClassId) ??
      this.resolveAnimRecord113c(`${activeToken}BLHTH`, 'BL', 'HTH', morphMonsterClassId)
    const framesPerDirection = Math.max(1, rec?.framesPerDirection ?? 4)
    const baseSpeed = rec?.animationSpeed && rec.animationSpeed > 0 ? rec.animationSpeed : 256
    const fbr =
      params?.fbrOverride !== undefined
        ? Math.trunc(params.fbrOverride)
        : Math.trunc(this.statList.getAccruedStat('item_fasterblockrate'))
    const holyShield =
      params?.holyShield ??
      (this.stateBus.hasState('holyshield') || this.stateBus.hasState(101))
    const stepSpeed256 = computeStepSpeed256(baseSpeed, computeBlockEffRate113c(fbr, holyShield))
    const recoveryTicks = computeOneShotTicks(framesPerDirection, stepSpeed256)

    let interrupted = false
    if (this.currentAnim && !this.currentAnim.completed) {
      if (!this.currentAnim.actionTriggered) {
        interrupted = true
        this.currentAnim.aborted = true
      }
      this.currentAnim.completed = true
    }

    this.currentRecovery = {
      mode: 'BL',
      cofName: rec?.name ?? cofPrimary,
      framesPerDirection,
      stepSpeed256,
      frameAcc256: 0,
      currentFrame: 0,
      completed: false,
    }

    return {
      entered: true,
      interrupted,
      recoveryTicks,
      stepSpeed256,
      framesPerDirection,
    }
  }

  private commitFirstActionFrameResources(anim: ActiveAnimationState, currentTick: number): boolean {
    const isFreeInState = this.isNoCostInActiveState(anim.skill)
    const { manaCost256 } = computeSkillManaCost256(anim.skill, anim.slvl)
    if (!isFreeInState && !anim.manaDeductedOnStart) {
      if (anim.skill.useManaOnDo && this.statList.getMana256() < manaCost256) {
        if (anim.skill.startMana > 0) {
          this.stateBus.removeState('inferno')
          this.stateBus.removeState(12)
        }
        anim.aborted = true
        anim.completed = true
        return false
      }
      this.statList.setMana256(this.statList.getMana256() - manaCost256)
    }

    // Deduct ammo quantity (`decquant`) if applicable (Strafe #26 deducts 1 arrow on initial release)
    if ((anim.skill.decquant || anim.skill.id === 26) && this.getAmmoQuantity() > 0) {
      this.setAmmoQuantity(this.getAmmoQuantity() - 1)
    }

    // Apply global `STATE_SKILLDELAY` (`state 121`, `delay` ticks in `Skills.txt`, #1877)
    const delayTicks = anim.skill.delay
      ? evaluateCalc(anim.skill.delay, {
          registry: this.registry,
          activeSkill: anim.skill,
          slvl: anim.slvl,
          blvl: this.statList.getBaseSkillLevel(anim.skill.id),
        })
      : 0
    if (delayTicks > 0) {
      this.skillDelayExpireFrame = currentTick + delayTicks
      this.stateBus.applyState({
        stateNameOrId: 'skilldelay',
        slvl: 1,
        durationFrames: delayTicks,
        currentFrame: currentTick,
      })
    }

    return true
  }

  /**
   * Advance active recovery (`GH`/`BL`) or skill animation by 1 tick (`25 Hz`), firing action
   * keyframes (`0x01`/`0x02`, rollback strikes, and `SequenceTbls` events) on their exact ticks.
   */
  tick(
    currentTick: number,
    onActionFrame: (anim: ActiveAnimationState, tick: number, strikeIndex: number) => void,
  ): { actionFired: boolean; strikesFiredThisTick: number; anim: ActiveAnimationState | null } {
    if (this.currentRecovery && !this.currentRecovery.completed) {
      const rec = this.currentRecovery
      rec.frameAcc256 += rec.stepSpeed256
      rec.currentFrame = Math.trunc(rec.frameAcc256 / 256)
      if (rec.frameAcc256 + rec.stepSpeed256 >= rec.framesPerDirection * 256) {
        rec.completed = true
      }
    }

    if (!this.currentAnim || this.currentAnim.completed) {
      return { actionFired: false, strikesFiredThisTick: 0, anim: this.currentAnim }
    }

    const anim = this.currentAnim
    anim.frameAcc256 += anim.stepSpeed256
    anim.currentFrame = Math.trunc(anim.frameAcc256 / 256)

    let actionFired = false
    let strikesFiredThisTick = 0

    if (anim.sequenceEventFrames && anim.sequenceEventFrames.length > 0) {
      while (
        anim.strikesFired < anim.sequenceEventFrames.length &&
        anim.currentFrame >= anim.sequenceEventFrames[anim.strikesFired]!
      ) {
        if (anim.strikesFired === 0) {
          if (!this.commitFirstActionFrameResources(anim, currentTick)) {
            return { actionFired: false, strikesFiredThisTick: 0, anim }
          }
          anim.actionTriggered = true
        }
        const strikeIndex = anim.strikesFired
        anim.strikesFired += 1
        actionFired = true
        strikesFiredThisTick += 1
        onActionFrame(anim, currentTick, strikeIndex)
        if (anim.completed) break
      }
      // Player SQ (mode 18) sequences end one advance before the remaining counter reaches 0
      // (oracle-derived: Chain Lightning seq 12 = 19 entries is visible 18 frames, like a 14-frame SC
      // cast is visible 13). D2Common `0x6FD82820` sets remaining `+0x48 = count << 8`, `0x6FD82460`
      // subtracts `+0x3C` each advance and #10426 `0x6FD7EF5E` tests `remaining <= 0`; the SQ mode-end
      // site in D2Game (`0x6FC95CE0` skill path) is pending. kb/engine/d2game-plrmode-gethit-113c.md §5.
      if (anim.frameAcc256 + anim.stepSpeed256 >= anim.framesPerDirection * 256) {
        anim.completed = true
      }
      return { actionFired, strikesFiredThisTick, anim }
    }

    if (anim.rollbackFrame !== null && anim.totalStrikes > 1) {
      if (anim.strikesFired < anim.totalStrikes && anim.currentFrame >= anim.actionFrame) {
        if (anim.strikesFired === 0) {
          if (!this.commitFirstActionFrameResources(anim, currentTick)) {
            return { actionFired: false, strikesFiredThisTick: 0, anim }
          }
          anim.actionTriggered = true
        }
        const strikeIndex = anim.strikesFired
        anim.strikesFired += 1
        actionFired = true
        strikesFiredThisTick = 1
        onActionFrame(anim, currentTick, strikeIndex)
        if (!anim.completed && anim.strikesFired < anim.totalStrikes) {
          anim.frameAcc256 = anim.rollbackFrame * 256
          anim.currentFrame = anim.rollbackFrame
          return { actionFired: true, strikesFiredThisTick: 1, anim }
        }
      }
      if (
        anim.strikesFired >= anim.totalStrikes &&
        anim.frameAcc256 + anim.stepSpeed256 >= anim.framesPerDirection * 256
      ) {
        anim.completed = true
      }
      return { actionFired, strikesFiredThisTick, anim }
    }

    if (!anim.actionTriggered && anim.currentFrame >= anim.actionFrame) {
      if (!this.commitFirstActionFrameResources(anim, currentTick)) {
        return { actionFired: false, strikesFiredThisTick: 0, anim }
      }
      anim.actionTriggered = true
      anim.strikesFired = 1
      actionFired = true
      strikesFiredThisTick = 1
      onActionFrame(anim, currentTick, 0)
    }

    // D2Common.dll #10426 (0x6FD7EF30):
    // - Sequence animations (0x6FD7EF57): complete when remaining (+0x48) <= 0 (event-less sequences only;
    //   sequences with event frames use the branch above, kb/engine/d2game-plrmode-gethit-113c.md §5)
    // - Standard one-shot animations (0x6FD7EF6D): complete when dwFrame + wAnimSpeed >= dwFrameCount
    if (anim.isSequence) {
      if (anim.currentFrame >= anim.framesPerDirection) {
        anim.completed = true
      }
    } else if (anim.frameAcc256 + anim.stepSpeed256 >= anim.framesPerDirection * 256) {
      anim.completed = true
    }

    return { actionFired, strikesFiredThisTick, anim }
  }

  getCurrentAnimation(): ActiveAnimationState | null {
    return this.currentAnim
  }
}
