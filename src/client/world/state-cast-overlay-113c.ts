/**
 * States.txt `castoverlay` on the inactive → active state transition (Issue #1063).
 *
 * D2Client 1.13c state-on routine `0x6FB23760` (onsound only when the state was not set, `0x6FB237FC`; state toggle
 * `#10945` at `0x6FB23818`) calls `0x6FB22C80(state)` at `0x6FB2382D`, which:
 *  1. returns at once when the States.txt `nooverlays` flag is set (`0x6FB22CB6`-`0x6FB22CC2`);
 *  2. reads `wCastOverlay` (+0x0A, `0x6FB22CC8`) and overlay1/overlay2 (+0x02/+0x04);
 *  3. for an `aura` state (`#10190`), drops the cast overlay when the unit already carries ANOTHER aura state
 *     (`#10625`, `0x6FB22D75`-`0x6FB22D94`);
 *  4. plays the cast overlay once via `0x6FB1B300` as LOOPEX (4) / AURAEX (9, aura states), after which overlay1/2
 *     take over (the persistent `STATE_OVERLAYS` loop in unit-drawables is held back while the cast overlay lives).
 * `0x6FB22A50` (state off) removes the cast overlay together with overlay1..4.
 *
 * Data: generated `STATE_OVERLAY_ROWS_113C` (States.txt), see `src/baker/packers/pack-skill-state-overlays.ts`.
 */
import {
  STATE_OVERLAY_ROWS_113C,
  type StateOverlayRow113c,
} from '../../common/skills/skill-state-overlays-113c.ts'
import type { ClientUnitOverlay } from './client-unit.ts'

export const STATE_OVERLAY_ROW_BY_ID_113C: ReadonlyMap<number, StateOverlayRow113c> = new Map(
  STATE_OVERLAY_ROWS_113C.map((r) => [r.id, r] as const),
)

interface StateHolder {
  readonly states: Iterable<number> & { has(stateId: number): boolean }
}

/**
 * The States.txt `castoverlay` row name to play when `stateId` has just turned on for `unit` (call AFTER the state was
 * added, only on the inactive → active transition), or `undefined` when 0x6FB22C80 would not play one.
 */
export function stateCastOverlay113c(unit: StateHolder, stateId: number): string | undefined {
  const row = STATE_OVERLAY_ROW_BY_ID_113C.get(stateId)
  if (row === undefined || row.noOverlays || row.castOverlay === '') return undefined
  if (row.aura) {
    for (const other of unit.states) {
      if (other !== stateId && STATE_OVERLAY_ROW_BY_ID_113C.get(other)?.aura === true) return undefined
    }
  }
  return row.castOverlay
}

interface CastOverlayUnit extends StateHolder {
  overlays: ClientUnitOverlay[]
}

/**
 * Plays the States.txt `castoverlay` (one-shot, tagged with `castForStateId` for the overlay1/2 hand-over and the
 * StateEnd removal) when `stateId` just turned on for `unit`. Returns the attached overlay, if any.
 */
export function playStateCastOverlay113c<U extends CastOverlayUnit>(
  world: { attachUnitOverlay(unit: U, token: string, loop?: boolean): ClientUnitOverlay },
  unit: U,
  stateId: number,
): ClientUnitOverlay | undefined {
  const token = stateCastOverlay113c(unit, stateId)
  if (token === undefined) return undefined
  const ov = world.attachUnitOverlay(unit, token, false)
  if (!ov || !unit.overlays.includes(ov)) return undefined // MonStats2 NOOVLY or unknown overlay: nothing was attached
  const tagged: ClientUnitOverlay = { ...ov, castForStateId: stateId }
  unit.overlays = unit.overlays.map((o) => (o === ov ? tagged : o))
  return tagged
}

/** True while a live States.txt cast overlay of `stateId` holds back the state's overlay1/2 loop. */
export function isStateCastOverlayPlaying113c(
  overlays: readonly ClientUnitOverlay[] | undefined,
  stateId: number,
): boolean {
  return overlays?.some((o) => o.castForStateId === stateId && o.ageTicks < o.maxTicks) === true
}

/** StateEnd (`0x6FB22A50`): drops the state's cast overlay. */
export function removeStateCastOverlay113c(unit: CastOverlayUnit, stateId: number): void {
  unit.overlays = unit.overlays.filter((o) => o.castForStateId !== stateId)
}

/**
 * Canonical 1.13c `States.txt` `removerlay` column (played by `D2Client.dll` `0x6FB22A50` when an active state is removed).
 * In 1.13c `States.txt`, `#177 delerium` has `removerlay = "teleport"`.
 */
export const STATE_REM_OVERLAYS_113C: Readonly<Record<number, string>> = Object.freeze({
  177: 'teleport',
})

/**
 * Returns the `States.txt` `removerlay` token for `stateId` when an active state is removed, or `undefined`.
 */
export function stateRemOverlay113c(stateId: number): string | undefined {
  const row = STATE_OVERLAY_ROW_BY_ID_113C.get(stateId)
  if (row && 'remOverlay' in row && typeof (row as { remOverlay?: unknown }).remOverlay === 'string') {
    const rem = (row as { remOverlay: string }).remOverlay
    if (rem !== '') return rem
  }
  return STATE_REM_OVERLAYS_113C[stateId]
}

/**
 * Plays the `States.txt` `removerlay` one-shot when an active `stateId` is removed from `unit` (`0x6FB22A50`).
 */
export function playStateRemOverlay113c<U extends CastOverlayUnit>(
  world: { attachUnitOverlay(unit: U, token: string, loop?: boolean): ClientUnitOverlay },
  unit: U,
  stateId: number,
): ClientUnitOverlay | undefined {
  const token = stateRemOverlay113c(stateId)
  if (token === undefined) return undefined
  return world.attachUnitOverlay(unit, token, false)
}
