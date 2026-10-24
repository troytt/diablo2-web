/**
 * Diablo II v1.13c Bone Armor (#68, `States.txt` row 14 `bonearmor`) orbiting bone-shield overlays.
 *
 * Ground truth (D2Client.dll 1.13c, ImageBase 0x6FAB0000):
 * - `States.txt` bonearmor: `nooverlays=1`, `setfunc=6`, `remfunc=3`, overlay1..4 = bonearmor_front (#141),
 *   bonearmor_back (#142), bonearmor_null1 (#143), bonearmor_null2 (#144), castoverlay = bonearmor_cast (#140).
 *   `nooverlays` keeps the generic state-overlay path from drawing them; the set function owns them.
 * - StateSetFunc table `0x6FB9267C`, entry [6] = `0x6FB23230`:
 *   1. reads the state's stat list: `cur = STAT bonearmor (132)`, `max = STAT bonearmormax (133)`
 *      (ItemStatCost.txt; both `Send Bits = 32`, sent with S2C 0xA8 / 0xAA) and the previous bone count
 *      `old = STAT shortparam1 (355)`;
 *   2. `n = 3; if (cur < max/3) n = 2; if (cur < 2*(max/3)) n--` (max/3 = signed `imul 0x55555556`), and
 *      stores `n` back into stat 355;
 *   3. `n > old`: runs remfunc[3] `0x6FB22A50` (removes cast/front/back/null overlays), then creates
 *      bonearmor_null1 as an overlay of type 7 when `n >= 3`, bonearmor_null2 as type 7 when `n >= 2`, and
 *      bonearmor_cast as type 4 with follow-ups (bonearmor_front, bonearmor_back);
 *   4. `n < old`: removes `old - n` (bonearmor_front, bonearmor_back) pairs (`0x6FB227F0` → `0x6FB19660`).
 * - Overlay completion switch `0x6FB1C1D7` (table `0x6FB1C384`): type 4 (`0x6FB1C26F`) replaces itself by its
 *   two follow-ups as looping type 3 overlays; type 7 (`0x6FB1C337`) replaces itself by bonearmor_cast type 4
 *   with follow-ups (bonearmor_front, bonearmor_back). The null rows (Frames=2, AnimRate 4 / 2) are therefore
 *   8- and 16-tick delays, giving the 3 bone pairs a 0 / 8 / 16 frame phase offset in the 24-frame orbit.
 * - Overlay.txt rows 0x8C..0x8E are created without replacing an existing overlay of the same index
 *   (`OVERLAY_INDICES_NOT_REPLACED`), so up to three front/back pairs coexist.
 */
import type { ItemStat } from '../../netproto/index.ts'
import { OVERLAY_TXT_ROWS } from '../render/overlay-txt-rows.ts'
import type { ClientUnit, ClientUnitOverlay, ClientUnitOverlayChainStep } from './client-unit.ts'

export const STATE_BONEARMOR = 14
export const STAT_BONEARMOR = 132
export const STAT_BONEARMORMAX = 133

export const OVERLAY_BONEARMOR_CAST = 140
export const OVERLAY_BONEARMOR_FRONT = 141
export const OVERLAY_BONEARMOR_BACK = 142
export const OVERLAY_BONEARMOR_NULL1 = 143
export const OVERLAY_BONEARMOR_NULL2 = 144

const BONEARMOR_OVERLAY_INDICES = [
  OVERLAY_BONEARMOR_CAST,
  OVERLAY_BONEARMOR_FRONT,
  OVERLAY_BONEARMOR_BACK,
  OVERLAY_BONEARMOR_NULL1,
  OVERLAY_BONEARMOR_NULL2,
] as const

/** Emulates the per-unit STAT shortparam1 (355) bone counter of the bonearmor stat list. */
const boneCountByUnit = new WeakMap<ClientUnit, number>()

function overlayRow(index: number) {
  const row = OVERLAY_TXT_ROWS[index]
  if (row === undefined) {
    throw new Error(`Overlay.txt row ${String(index)} missing from overlay.bin`)
  }
  return row
}

function overlayToken(index: number): string {
  return overlayRow(index).name.trim().toLowerCase()
}

/** `0x6FB23230` bone count from the remaining / maximum absorb (8.8 fixed point; only the ratio matters). */
export function computeBoneArmorOverlayCount113c(cur: number, max: number): 1 | 2 | 3 {
  const third = Math.trunc(max / 3)
  let n = cur < third ? 2 : 3
  if (cur < third * 2) n -= 1
  return n as 1 | 2 | 3
}

function readStateStat(stats: readonly ItemStat[] | undefined, statId: number): number {
  if (stats === undefined) return 0
  for (const s of stats) {
    if (s.statId === statId && (s.param ?? 0) === 0) return s.value
  }
  return 0
}

/** Creates a unit overlay from its Overlay.txt row (fields as `attachServerOverlayImpl`). */
export function createOverlayFromTxtRow113c(
  overlayId: number,
  overlayIndex: number,
  loop: boolean,
  onExpire?: readonly ClientUnitOverlayChainStep[],
): ClientUnitOverlay {
  const row = overlayRow(overlayIndex)
  return {
    overlayId,
    token: row.name.trim().toLowerCase(),
    frame: 0,
    totalFrames: row.frames,
    animRate: row.animRate,
    loop,
    blendMode: row.trans,
    xOffset: row.xOffset,
    yOffset: row.yOffset,
    preDraw: row.preDraw !== 0,
    startedAtMs: Date.now(),
    ageTicks: 0,
    maxTicks: row.animRate > 0 ? Math.ceil((row.frames * 16) / row.animRate) : Number.POSITIVE_INFINITY,
    lightRadius: row.radius,
    lightColor: [row.red, row.green, row.blue] as const,
    ...(onExpire !== undefined && onExpire.length > 0 ? { onExpire } : {}),
  }
}

const FRONT_BACK_LOOP: readonly ClientUnitOverlayChainStep[] = Object.freeze([
  { overlayIndex: OVERLAY_BONEARMOR_FRONT, loop: true },
  { overlayIndex: OVERLAY_BONEARMOR_BACK, loop: true },
])

/** Type 4: bonearmor_cast, then front/back as looping overlays. */
const CAST_THEN_FRONT_BACK: ClientUnitOverlayChainStep = Object.freeze({
  overlayIndex: OVERLAY_BONEARMOR_CAST,
  loop: false,
  onExpire: FRONT_BACK_LOOP,
})

function removeFirstOverlayWithToken(unit: ClientUnit, token: string): void {
  const idx = unit.overlays.findIndex((o) => o.token === token)
  if (idx >= 0) unit.overlays = unit.overlays.filter((_, i) => i !== idx)
}

/** remfunc[3] `0x6FB22A50` body: drops every bonearmor cast/front/back/null overlay of the unit. */
function removeBoneArmorOverlays(unit: ClientUnit): void {
  const tokens = new Set(BONEARMOR_OVERLAY_INDICES.map(overlayToken))
  unit.overlays = unit.overlays.filter((o) => !tokens.has(o.token))
}

/** State 14 ended (remfunc[3]): removes the bone overlays and the stat-355 bone counter with the stat list. */
export function clearBoneArmorOverlays113c(unit: ClientUnit): void {
  removeBoneArmorOverlays(unit)
  boneCountByUnit.delete(unit)
}

/**
 * StateSetFunc[6] `0x6FB23230` for `bonearmor` (state 14): keeps 1..3 orbiting bone pairs in step with the
 * remaining absorb. `nextOverlayId` allocates client overlay ids.
 */
export function syncBoneArmorOverlays113c(unit: ClientUnit, nextOverlayId: () => number): void {
  const stats = unit.stats.getStateStats(STATE_BONEARMOR)
  const cur = readStateStat(stats, STAT_BONEARMOR)
  const max = readStateStat(stats, STAT_BONEARMORMAX)
  const n = computeBoneArmorOverlayCount113c(cur, max)
  const old = boneCountByUnit.get(unit) ?? 0
  boneCountByUnit.set(unit, n)
  if (n > old) {
    removeBoneArmorOverlays(unit)
    const added: ClientUnitOverlay[] = []
    if (n >= 3) {
      added.push(createOverlayFromTxtRow113c(nextOverlayId(), OVERLAY_BONEARMOR_NULL1, false, [CAST_THEN_FRONT_BACK]))
    }
    if (n >= 2) {
      added.push(createOverlayFromTxtRow113c(nextOverlayId(), OVERLAY_BONEARMOR_NULL2, false, [CAST_THEN_FRONT_BACK]))
    }
    added.push(createOverlayFromTxtRow113c(nextOverlayId(), OVERLAY_BONEARMOR_CAST, false, FRONT_BACK_LOOP))
    unit.overlays = [...unit.overlays, ...added]
  } else if (n < old) {
    const front = overlayToken(OVERLAY_BONEARMOR_FRONT)
    const back = overlayToken(OVERLAY_BONEARMOR_BACK)
    for (let i = old - n; i > 0; i--) {
      removeFirstOverlayWithToken(unit, front)
      removeFirstOverlayWithToken(unit, back)
    }
  }
}
