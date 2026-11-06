/**
 * Audio Focus Policy & Background Survival Alert Controller (`#1363`).
 *
 * Manages:
 * 1. Automatic audio focus following (`focus-only` vs `all`), with per-slot
 *    manual speaker override (`auto` | `mute` | `unmute`).
 * 2. Background instance vital state monitoring (HP drop / low HP < 35% / death),
 *    triggering visual tab alert badges and optional cooldown-gated warning cues
 *    through the active instance's audio runtime so background characters never
 *    die silently while muted.
 */

import type { MultiboxAudioFocusPolicy } from '../settings/client-settings';

export type SlotAudioOverride = 'auto' | 'mute' | 'unmute';

export type SlotAlertState = 'none' | 'damage' | 'low-hp' | 'dead';

export interface SlotVitalSnapshot {
  readonly slotId: number;
  readonly inGame: boolean;
  readonly hp: number;
  readonly maxHp: number;
}

export interface SlotAlertEvaluation {
  readonly alertState: SlotAlertState;
  readonly shouldTriggerAlertSound: boolean;
  readonly hpRatio: number;
}

export interface AudioFocusSlotRuntime {
  readonly slotId: number;
  setFocusMuted(muted: boolean): void;
  isFocusMuted(): boolean;
  playBackgroundAlertCue?(kind: 'damage' | 'low-hp' | 'dead'): void;
}

const ALERT_SOUND_COOLDOWN_MS = 1800;
const DAMAGE_BADGE_HOLD_MS = 3500;
const LOW_HP_THRESHOLD = 0.35;

export class AudioFocusController {
  private policy: MultiboxAudioFocusPolicy = 'focus-only';
  private alertSoundEnabled = true;
  private activeSlotId = 1;
  private readonly overrides = new Map<number, SlotAudioOverride>();
  private readonly prevVitals = new Map<number, { hp: number; maxHp: number }>();
  private readonly alertStates = new Map<number, SlotAlertState>();
  private readonly lastDamageAtMs = new Map<number, number>();
  private readonly lastAlertSoundAtMs = new Map<number, number>();

  constructor(
    initialPolicy: MultiboxAudioFocusPolicy = 'focus-only',
    alertSoundEnabled = true,
  ) {
    this.policy = initialPolicy;
    this.alertSoundEnabled = alertSoundEnabled;
  }

  getPolicy(): MultiboxAudioFocusPolicy {
    return this.policy;
  }

  setPolicy(policy: MultiboxAudioFocusPolicy): void {
    this.policy = policy;
  }

  isAlertSoundEnabled(): boolean {
    return this.alertSoundEnabled;
  }

  setAlertSoundEnabled(enabled: boolean): void {
    this.alertSoundEnabled = enabled;
  }

  getActiveSlotId(): number {
    return this.activeSlotId;
  }

  setActiveSlotId(slotId: number): void {
    this.activeSlotId = slotId;
    // Focusing a slot clears transient damage alert (unless still low-hp/dead on next check,
    // though focused slot never shows background alert badge).
    this.alertStates.set(slotId, 'none');
    this.lastDamageAtMs.delete(slotId);
  }

  getSlotOverride(slotId: number): SlotAudioOverride {
    return this.overrides.get(slotId) ?? 'auto';
  }

  setSlotOverride(slotId: number, override: SlotAudioOverride): void {
    if (override === 'auto') {
      this.overrides.delete(slotId);
    } else {
      this.overrides.set(slotId, override);
    }
  }

  /**
   * Cycles or toggles the per-slot speaker button on the multibox tab bar:
   * - If currently effective-muted -> `'unmute'`
   * - If currently effective-unmuted -> `'mute'`
   * (Or if overriding back to the natural default for its focus state, resets to `'auto'`).
   */
  toggleSlotSpeaker(slotId: number): SlotAudioOverride {
    const currentlyMuted = this.shouldMuteSlot(slotId);
    const nextMuted = !currentlyMuted;
    const naturalMuted = this.policy === 'focus-only' && slotId !== this.activeSlotId;
    if (nextMuted === naturalMuted) {
      this.overrides.delete(slotId);
      return 'auto';
    }
    const nextOverride: SlotAudioOverride = nextMuted ? 'mute' : 'unmute';
    this.overrides.set(slotId, nextOverride);
    return nextOverride;
  }

  /**
   * Computes whether `slotId` should be focus-muted given the current policy,
   * active slot, and per-slot override.
   */
  shouldMuteSlot(slotId: number): boolean {
    const override = this.overrides.get(slotId) ?? 'auto';
    if (override === 'mute') return true;
    if (override === 'unmute') return false;
    if (this.policy === 'all') return false;
    return slotId !== this.activeSlotId;
  }

  /**
   * Applies focus mute state across all registered slot audio runtimes.
   */
  applyToRuntimes(runtimes: Iterable<AudioFocusSlotRuntime>): void {
    for (const rt of runtimes) {
      rt.setFocusMuted(this.shouldMuteSlot(rt.slotId));
    }
  }

  getSlotAlertState(slotId: number): SlotAlertState {
    if (slotId === this.activeSlotId) return 'none';
    return this.alertStates.get(slotId) ?? 'none';
  }

  removeSlot(slotId: number): void {
    this.overrides.delete(slotId);
    this.prevVitals.delete(slotId);
    this.alertStates.delete(slotId);
    this.lastDamageAtMs.delete(slotId);
    this.lastAlertSoundAtMs.delete(slotId);
  }

  /**
   * Evaluates a slot's vital snapshot at 25Hz/60Hz.
   * For background (`slotId !== activeSlotId`) in-game slots:
   * - Detects HP loss (`hp < prevHp`), low HP (`hp / maxHp < 0.35`), and death (`hp <= 0 && maxHp > 0`).
   * - Updates the visual alert badge state (`none` | `damage` | `low-hp` | `dead`).
   * - Determines whether to play a cooldown-gated warning cue on the active instance.
   */
  evaluateSlotVital(
    snapshot: SlotVitalSnapshot,
    nowMs = performance.now(),
  ): SlotAlertEvaluation {
    const { slotId, inGame, hp, maxHp } = snapshot;
    if (!inGame || maxHp <= 0) {
      this.prevVitals.delete(slotId);
      this.alertStates.set(slotId, 'none');
      this.lastDamageAtMs.delete(slotId);
      return { alertState: 'none', shouldTriggerAlertSound: false, hpRatio: 1 };
    }

    const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
    const prev = this.prevVitals.get(slotId);
    this.prevVitals.set(slotId, { hp, maxHp });

    // Focused slot never triggers background alerts
    if (slotId === this.activeSlotId) {
      this.alertStates.set(slotId, 'none');
      return { alertState: 'none', shouldTriggerAlertSound: false, hpRatio };
    }

    const tookDamage = prev !== undefined && hp < prev.hp && prev.hp > 0;
    const justDied = prev !== undefined && prev.hp > 0 && hp <= 0;
    const isDead = hp <= 0;
    const isLowHp = !isDead && hpRatio < LOW_HP_THRESHOLD;

    if (tookDamage) {
      this.lastDamageAtMs.set(slotId, nowMs);
    }

    const lastDamageAt = this.lastDamageAtMs.get(slotId);
    const hasRecentDamageBadge =
      lastDamageAt !== undefined && nowMs - lastDamageAt <= DAMAGE_BADGE_HOLD_MS;

    let alertState: SlotAlertState = 'none';
    if (isDead) {
      alertState = 'dead';
    } else if (isLowHp) {
      alertState = 'low-hp';
    } else if (tookDamage || hasRecentDamageBadge) {
      alertState = 'damage';
    }

    this.alertStates.set(slotId, alertState);

    let shouldTriggerAlertSound = false;
    if (this.alertSoundEnabled && (justDied || tookDamage)) {
      const lastSoundAt = this.lastAlertSoundAtMs.get(slotId) ?? -Infinity;
      const isUrgent = justDied || isLowHp || (prev ? (prev.hp - hp) / maxHp >= 0.08 : false);
      const cooldown = isUrgent ? ALERT_SOUND_COOLDOWN_MS * 0.6 : ALERT_SOUND_COOLDOWN_MS;
      if (nowMs - lastSoundAt >= cooldown) {
        this.lastAlertSoundAtMs.set(slotId, nowMs);
        shouldTriggerAlertSound = true;
      }
    }

    return {
      alertState,
      shouldTriggerAlertSound,
      hpRatio,
    };
  }
}
