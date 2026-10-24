/**
 * Diablo II: Lord of Destruction v1.13c `AnimData.d2` Frame Dispatcher (`AnimDispatcher`).
 *
 * Implements:
 * - 1.13c `EIAS` (`floor((120 * IAS) / (120 + IAS)) + skillIas - WSM`, clamped `[-85, 75]`)
 *   and `EFCR` (`floor((120 * FCR) / (120 + FCR))`, clamped `[-85, 75]`) diminishing returns.
 * - `AnimData.d2` 8.8 fixed-point frame advancement (`speed = (animSpeed * (100 + effRate)) / 100`).
 * - Action frame flag (`0x01` melee/cast release, `0x02` missile launch) dispatching.
 * - `STATE_SKILLDELAY` global cooldown enforcement (`delay` ticks from `Skills.txt`).
 * - Shapeshift / weapon `restrict` validation (`restrict=1` any form, `restrict=2` shapeshift only,
 *   `restrict=0` human form only except Armageddon `249`).
 * - Mana (`manaCost256`) and ammo quantity (`decquant`) deduction on the action frame.
 */
import type { D2DataRegistry, SkillRecord } from '../../common/data/data-registry.ts'
import type { AnimDataRecord } from '../../common/formats/animdata.ts'
import { evaluateCalc, computeSkillManaCost256 } from '../../common/data/calc-ast.ts'
import { resolveSkillSequenceFrame } from '../../common/skills/skill-anim-modes.ts'
import { UnitStatList } from './stat-list.ts'
import { StateBus } from './state-bus.ts'

/**
 * 1.13c Diminishing returns conversion for IAS (`EIAS`) and FCR (`EFCR`):
 * `floor((120 * rate) / (120 + rate))`
 */
export function computeDiminishingRate113c(statRate: number): number {
  if (statRate <= 0) return Math.max(-85, Math.trunc(statRate))
  return Math.trunc((120 * statRate) / (120 + statRate))
}

export function computeEffectiveIas(params: {
  itemIas: number
  skillIas?: number // e.g. Fanaticism / Burst of Speed / Frenzy / Werewolf
  weaponWsm?: number // e.g. -20 for Phase Blade, +10 for Maul
}): number {
  const eias = computeDiminishingRate113c(params.itemIas) + (params.skillIas ?? 0) - (params.weaponWsm ?? 0)
  return Math.max(-85, Math.min(75, Math.trunc(eias)))
}

export function computeEffectiveFcr(itemFcr: number): number {
  const efcr = computeDiminishingRate113c(itemFcr)
  return Math.max(-85, Math.min(75, Math.trunc(efcr)))
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
  readonly targetX: number
  readonly targetY: number
  frameAcc256: number
  currentFrame: number
  actionTriggered: boolean
  completed: boolean
}

export interface CastAttemptResult {
  readonly allowed: boolean
  readonly reason?: 'skill_delay' | 'insufficient_mana' | 'restrict_shapeshift' | 'restrict_human' | 'passive_skill'
  readonly animState?: ActiveAnimationState
}

export class AnimDispatcher {
  readonly registry: D2DataRegistry
  readonly statList: UnitStatList
  readonly stateBus: StateBus
  readonly charToken: string // 'am' | 'so' | 'ne' | 'pa' | 'bar'->'ba' | 'dz' | 'ai'
  readonly weaponClass: string // 'hth' | '1hs' | 'bow' | 'jav' | 'h2h' | 'stf'
  private currentAnim: ActiveAnimationState | null = null
  private skillDelayExpireFrame = 0
  private ammoQuantity = 250

  constructor(params: {
    registry: D2DataRegistry
    statList: UnitStatList
    stateBus: StateBus
    charToken: string
    weaponClass?: string
  }) {
    this.registry = params.registry
    this.statList = params.statList
    this.stateBus = params.stateBus
    this.charToken = params.charToken.toUpperCase()
    this.weaponClass = (params.weaponClass ?? 'HTH').toUpperCase()
  }

  isSkillDelayActive(currentTick: number): boolean {
    return this.skillDelayExpireFrame > currentTick || this.stateBus.hasState('skilldelay')
  }

  getRemainingSkillDelay(currentTick: number): number {
    return Math.max(0, this.skillDelayExpireFrame - currentTick)
  }

  getAmmoQuantity(): number {
    return this.ammoQuantity
  }

  setAmmoQuantity(qty: number): void {
    this.ammoQuantity = Math.max(0, Math.trunc(qty))
  }

  /**
   * Validate shapeshift `restrict` rule from `Skills.txt`:
   * - `restrict = 0`: usable in human form only (except `Armageddon` 249 and `Werewolf` 223 / `Werebear` 228 unshift)
   * - `restrict = 1`: usable in both human and shapeshift forms
   * - `restrict = 2`: usable in shapeshift (`STATE_WOLF` / `STATE_BEAR`) form only!
   */
  validateRestriction(skill: SkillRecord): { ok: boolean; reason?: 'restrict_shapeshift' | 'restrict_human' } {
    const inWolf =
      this.stateBus.hasState('wolf') ||
      this.stateBus.hasState('wearwolf') ||
      this.stateBus.hasState(139)
    const inBear =
      this.stateBus.hasState('bear') ||
      this.stateBus.hasState('wearbear') ||
      this.stateBus.hasState(140)
    const inWolfOrBear = inWolf || inBear

    if (skill.restrict === 2) {
      if (!inWolfOrBear) {
        return { ok: false, reason: 'restrict_shapeshift' }
      }
      if ((skill.id === 232 || skill.id === 238 || skill.id === 248) && !inWolf) {
        return { ok: false, reason: 'restrict_shapeshift' }
      }
      if ((skill.id === 233 || skill.id === 243) && !inBear) {
        return { ok: false, reason: 'restrict_shapeshift' }
      }
    }
    if (
      skill.restrict === 0 &&
      inWolfOrBear &&
      skill.id !== 249 && // Armageddon usable in shapeshift
      skill.id !== 223 && // Werewolf toggle
      skill.id !== 228 && // Werebear toggle
      skill.id !== 0      // Attack usable in shapeshift
    ) {
      return { ok: false, reason: 'restrict_human' }
    }
    return { ok: true }
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
    onActionFrame?: (anim: ActiveAnimationState, tick: number) => void
  }): CastAttemptResult {
    const { skill, slvl, currentTick } = params
    if (skill.passive) {
      return { allowed: false, reason: 'passive_skill' }
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

    // Check mana cost before starting animation
    const { manaCost256 } = computeSkillManaCost256(skill, slvl)
    if (this.statList.getMana256() < manaCost256 && !skill.nocostinstate) {
      return { allowed: false, reason: 'insufficient_mana' }
    }

    // Resolve `AnimData.d2` COF record (`<TOKEN><MODE><WCLASS>`), honoring shapeshift morph tokens
    const inWolf = this.stateBus.hasState('wolf') || this.stateBus.hasState('wearwolf')
    const inBear = !inWolf && (this.stateBus.hasState('bear') || this.stateBus.hasState('wearbear'))
    const inVamp =
      !inWolf &&
      !inBear &&
      (this.stateBus.hasState('monsterset') || this.stateBus.hasState('vampire'))
    const activeToken = inWolf ? '40' : inBear ? 'TG' : inVamp ? 'VA' : this.charToken

    const rawMode = (skill.anim || 'SC').toUpperCase()
    const isSequence = rawMode === 'SQ'
    const mode = isSequence
      ? ((skill.seqTrans && skill.seqTrans.toUpperCase() !== 'SQ' ? skill.seqTrans : 'SC') || 'A1').toUpperCase()
      : rawMode
    const cofCandidates = [
      `${activeToken}${mode}${this.weaponClass}`,
      `${activeToken}${mode}HTH`,
      `${activeToken}${mode}1HS`,
      `${activeToken}SCHTH`,
      `${activeToken}A1HTH`,
      `${this.charToken}${mode}${this.weaponClass}`,
      `${this.charToken}${mode}HTH`,
      `${this.charToken}${mode}1HS`,
      `${this.charToken}SCHTH`,
      `${this.charToken}A1HTH`,
    ]

    let animRecord: AnimDataRecord | undefined
    let chosenCof = cofCandidates[0]!
    for (const cand of cofCandidates) {
      const rec = this.registry.getAnimDataRecord(cand)
      if (rec && rec.hasSpeed) {
        animRecord = rec
        chosenCof = cand
        break
      }
    }

    if (!animRecord) {
      animRecord = {
        name: chosenCof,
        framesPerDirection: 14,
        animationSpeed: 256,
        hasSpeed: true,
        events: [{ frame: 6, code: 1 }],
        block: 0,
      }
    }

    const seqTransUpper = (skill.seqTrans || '').toUpperCase()
    const isCastMode = mode === 'SC' || (isSequence && (seqTransUpper === 'SC' || seqTransUpper === 'SQ'))
    const effRate = isCastMode
      ? computeEffectiveFcr(this.statList.getAccruedStat('item_fastercastrate'))
      : computeEffectiveIas({
          itemIas: this.statList.getAccruedStat('item_fasterattackrate'),
          skillIas:
            (this.statList.getModifierBonus('attackrate') || this.statList.getModifierBonus('skill_ias')) -
            (isSequence ? 30 : 0),
          weaponWsm: this.statList.getAccruedStat('weapon_wsm'),
        })

    const stepSpeed256 = Math.max(32, Math.trunc((animRecord.animationSpeed * (100 + effRate)) / 100))
    const seq0 = isSequence
      ? resolveSkillSequenceFrame(skill.id, this.weaponClass, 0, stepSpeed256)
      : null
    const framesPerDirection = seq0 ? seq0.totalSequenceFrames : animRecord.framesPerDirection
    const actionEvt = animRecord.events.find(e => (e.code & (0x01 | 0x02)) !== 0)
    const actionFrame = actionEvt
      ? actionEvt.frame
      : Math.max(1, Math.trunc(framesPerDirection / 2))

    this.currentAnim = {
      skill,
      slvl,
      cofName: chosenCof,
      animRecord,
      framesPerDirection,
      stepSpeed256,
      actionFrame,
      isSequence,
      targetX: params.targetX ?? 0,
      targetY: params.targetY ?? 0,
      frameAcc256: 0,
      currentFrame: 0,
      actionTriggered: false,
      completed: false,
    }

    return {
      allowed: true,
      animState: this.currentAnim,
    }
  }

  /**
   * Advance the active animation by 1 tick (`25 Hz`), firing the action frame (`0x01`/`0x02`)
   * when `currentFrame >= actionFrame` and deducting mana / ammo / setting `STATE_SKILLDELAY`.
   */
  tick(
    currentTick: number,
    onActionFrame: (anim: ActiveAnimationState, tick: number) => void,
  ): { actionFired: boolean; anim: ActiveAnimationState | null } {
    if (!this.currentAnim || this.currentAnim.completed) {
      return { actionFired: false, anim: this.currentAnim }
    }

    const anim = this.currentAnim
    anim.frameAcc256 += anim.stepSpeed256
    anim.currentFrame = Math.trunc(anim.frameAcc256 / 256)

    let actionFired = false
    if (!anim.actionTriggered && anim.currentFrame >= anim.actionFrame) {
      anim.actionTriggered = true
      actionFired = true

      // Deduct mana cost (`manaCost256`) on the action frame
      const { manaCost256 } = computeSkillManaCost256(anim.skill, anim.slvl)
      if (!anim.skill.nocostinstate) {
        this.statList.setMana256(this.statList.getMana256() - manaCost256)
      }

      // Deduct ammo quantity (`decquant`) if applicable
      // D2MOO Parity: SKILLS_SrvSt08_Strafe (skillId 26) explicitly calls sub_6FD118C0 to deduct 1 arrow on cast
      if ((anim.skill.decquant || anim.skill.id === 26) && this.ammoQuantity > 0) {
        this.ammoQuantity -= 1
      }

      // Apply `STATE_SKILLDELAY` (`delay` ticks in `Skills.txt`, e.g. Hydra 40f, Frozen Orb 25f)
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

      onActionFrame(anim, currentTick)
    }

    // D2Common.dll #10426 (0x6FD7EF30):
    // - Sequence animations (0x6FD7EF57): complete when dwFrame >= dwFrameCount
    // - Standard one-shot animations (0x6FD7EF6D): complete when dwFrame + wAnimSpeed >= dwFrameCount
    if (anim.isSequence) {
      if (anim.currentFrame >= anim.framesPerDirection) {
        anim.completed = true
      }
    } else if (anim.frameAcc256 + anim.stepSpeed256 >= anim.framesPerDirection * 256) {
      anim.completed = true
    }

    return { actionFired, anim }
  }

  getCurrentAnimation(): ActiveAnimationState | null {
    return this.currentAnim
  }
}
