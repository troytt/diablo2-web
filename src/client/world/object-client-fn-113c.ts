/**
 * Diablo II v1.13c Objects.txt `ClientFn` handlers (D2Client.dll), issues #1518..#1522.
 *
 * The per-object 25 Hz update 0x6fad5b40 → 0x6fad4680 calls `ClientFn` (objects.bin +0x1B4, 1..18) through the
 * table at 0x6fba54e8 (1-based; `cmp al, 0x13`). `[unit+0xD4]` is the handlers' timer (0 for a new unit, 0x6fb57444)
 * and `[unit+0xC8]` an init flag. Ported here:
 *
 * | ClientFn | VA         | Objects                         | Behaviour                                                |
 * |----------|------------|---------------------------------|----------------------------------------------------------|
 * | 2        | 0x6fad4870 | 67..70 light rays 1R..4R        | random 0 → 1 (→ 2 by the one-shot anim) → 0 cycle         |
 * | 3        | 0x6fad4ae0 | (none in 1.13c)                 | ClientFn 2 + the object sound handler 0x6fad37e0          |
 * | 7        | 0x6fad4da0 | 259 QS, 373 QT                  | mode 0 → 1 after 10 s, back to 0 after 4.5..7.5 s          |
 * | 9        | 0x6fad58f0 | 478 clientsmoke (OZ)            | removed once farther than 25 from the local player        |
 * | 10       | 0x6fad4d10 | 528 Shrub (2S)                  | mode 0 → 1 after 3 s, back to 0 after 2.5..7.5 s           |
 * | 15       | 0x6fad5890 | 558 Frozen Anya (2N)            | every 500 ms: mode 0 → npcalert overlay (72) on, else off  |
 * | 18       | 0x6fad49e0 | 568 Keeper (7Z)                 | every 0..59 s: 10 % chance of Sounds 2505                  |
 *
 * Elsewhere: 14 (EnvEffect, env-effect.ts), 4/5 (object sounds, object-sound-113c.ts). 1 and 11 are empty
 * (0x6fad46d0 / 0x6fad46e0). 8 (orifice) and 12 (ancientsaltar) only preload monster art (0x6fb1a0c0), which the
 * web client loads on demand. Not yet ported: 6 (0x6fad4e30, unused object 114), 13 (0x6fad61f0, object 561),
 * 16 (0x6fad4cd0, Baal portals 563/569) and 17 (0x6fad5d30, object 567).
 */

import { SEED_RollLimitedRandomNumber, SEED_RollRandomNumber, type D2SeedStrc } from '../../common/rng/d2-rng.ts'

/** Overlay.txt row 72 `npcalert` (NPCSpeechBalloon) added by ClientFn 15 (`mov eax, 0x48`). */
export const CLIENTFN_NPCALERT_OVERLAY = 72
/** Sounds.txt 2505 `barbarian_grunt_small_1` played by ClientFn 18 (`mov ebx, 0x9c9`). */
export const CLIENTFN_KEEPER_SOUND = 0x9c9
/** ClientFn 9 removal distance (`cmp eax, 0x19`) and check period (`cmp ecx, 0x3e8`). */
export const CLIENTFN_SMOKE_MAX_DISTANCE = 0x19
const CLIENTFN_SMOKE_PERIOD_MS = 0x3e8

/** The object fields the handlers read and write. */
export interface ClientFnObject {
  readonly classId: number
  mode: number
  readonly seed: D2SeedStrc
  /** `[unit+0xD4]`, 0 for a new unit. */
  clientFnTimer: number
  /** `[unit+0xC8]`, 0 for a new unit. */
  clientFnInit: number
}

export type ClientFnEffect =
  | { readonly kind: 'setMode'; readonly mode: number }
  | { readonly kind: 'addOverlay'; readonly overlay: number }
  | { readonly kind: 'removeOverlay'; readonly overlay: number }
  | { readonly kind: 'removeUnit' }
  | { readonly kind: 'playSound'; readonly soundId: number }
  | { readonly kind: 'modeSound' }

export interface ClientFnContext {
  /** GetTickCount() of the frame. */
  readonly nowMs: number
  /** D2Common #10522 distance between the object and the local player (0x6fabc190). */
  distanceToLocalPlayer(): number
}

/** `[unit+0x20]` LCG roll, low 32 bits (`mul 0x6ac690c5; add hi`). */
function roll(seed: D2SeedStrc): number {
  return SEED_RollRandomNumber(seed) >>> 0
}

/** 0x6fab2dc0: `max > min ? min + RAND(seed, max - min) : min`. */
function randRange(seed: D2SeedStrc, min: number, max: number): number {
  return max > min ? min + SEED_RollLimitedRandomNumber(seed, max - min) : min
}

function lightRayCycle(unit: ClientFnObject, out: ClientFnEffect[]): void {
  if (unit.clientFnInit === 0) {
    unit.clientFnTimer = roll(unit.seed) & 0x3f
    unit.clientFnInit = 1
  }
  if ((unit.clientFnTimer & 0x3f) === 0 && unit.mode !== 1) {
    out.push({ kind: 'setMode', mode: 1 })
    unit.mode = 1
  }
  unit.clientFnTimer += 1
  if (unit.mode === 2) {
    unit.clientFnTimer += roll(unit.seed) & 0x3f
    out.push({ kind: 'setMode', mode: 0 })
    unit.mode = 0
  }
}

function timedToggle(unit: ClientFnObject, nowMs: number, firstMs: number, minMs: number, maxMs: number, out: ClientFnEffect[]): void {
  if (unit.mode === 0) {
    if (unit.clientFnTimer >= nowMs) return
    unit.clientFnTimer = nowMs + firstMs
    out.push({ kind: 'setMode', mode: 1 })
    unit.mode = 1
    return
  }
  if (unit.clientFnTimer >= nowMs) return
  unit.clientFnTimer = nowMs + randRange(unit.seed, minMs, maxMs)
  out.push({ kind: 'setMode', mode: 0 })
  unit.mode = 0
}

/** Run one object's ClientFn for one 25 Hz frame; returns the side effects for the caller to apply in order. */
export function runObjectClientFn113c(unit: ClientFnObject, clientFn: number, ctx: ClientFnContext): ClientFnEffect[] {
  const out: ClientFnEffect[] = []
  switch (clientFn) {
    case 2:
      lightRayCycle(unit, out)
      break
    case 3:
      lightRayCycle(unit, out)
      out.push({ kind: 'modeSound' })
      break
    case 7:
      timedToggle(unit, ctx.nowMs, 0x2710, 0x1194, 0x1d4c, out)
      break
    case 9: {
      if (unit.clientFnTimer !== 0) {
        if (ctx.nowMs - unit.clientFnTimer <= CLIENTFN_SMOKE_PERIOD_MS) break
        if (ctx.distanceToLocalPlayer() > CLIENTFN_SMOKE_MAX_DISTANCE) {
          out.push({ kind: 'removeUnit' })
          break
        }
      }
      unit.clientFnTimer = ctx.nowMs
      break
    }
    case 10:
      timedToggle(unit, ctx.nowMs, 0xbb8, 0x9c4, 0x1d4c, out)
      break
    case 15:
      if (ctx.nowMs <= unit.clientFnTimer) break
      out.push(
        unit.mode === 0
          ? { kind: 'addOverlay', overlay: CLIENTFN_NPCALERT_OVERLAY }
          : { kind: 'removeOverlay', overlay: CLIENTFN_NPCALERT_OVERLAY },
      )
      unit.clientFnTimer = ctx.nowMs + 0x1f4
      break
    case 18:
      if (ctx.nowMs <= unit.clientFnTimer) break
      if (roll(unit.seed) % 100 < 10) out.push({ kind: 'playSound', soundId: CLIENTFN_KEEPER_SOUND })
      unit.clientFnTimer = ctx.nowMs + (roll(unit.seed) % 60) * 1000
      break
    default:
      break
  }
  return out
}
