/**
 * Weapon hit-class sound / frame table used by the skill start sounds (`D2Client.dll`).
 *
 * `D2Common#10862` (`0x6FD821E0`) returns the unit's hit class: a player's weapon `ItemsTxt +0x13C` (Weapons.txt
 * `hit class`, `0x6FD72380`) or 1 (`hth`) without a weapon (`0x6FD821FF`); a monster's MonStats2 `HitClass`
 * (`0x6FD513B0` → `byte +0x14`). The index runs over HitClass.txt: 0 none, 1 hth, 2 1hss, 3 1hsl, 4 2hss, 5 2hsl,
 * 6 1ht, 7 2ht, 8 club, 9 staf, 10 bow, 11 xbow, 12 claw, 13 over.
 *
 * Table `0x6FBA5538` (`{ soundId, frames }` per index, `and eax,0xf` + `< 14` bound):
 * - `0x6FAD2280`: the weapon swing sound (`weaponsnd`, `0x6FB520F2`).
 * - `0x6FAD2220`: `(frames * 256 + 128) / unit->animSpeed` (`word [unit+0x4C]`, 0 → 1): the frame delay; the
 *   `stsounddelay` start sound uses `max(0, delay - 3)` (`0x6FB520BC..0x6FB520CC`), `weaponsnd` `max(0, delay)`.
 */

import { resolveWeaponBase113c, type EquippedItemLike } from '../units/char-anim-speed.ts'

export const HIT_CLASS_CODES_113C: readonly string[] = Object.freeze([
  '', 'hth', '1hss', '1hsl', '2hss', '2hsl', '1ht', '2ht', 'club', 'staf', 'bow', 'xbow', 'claw', 'over',
])

/** `0x6FBA5538`: `[soundId, frames]` by hit class index. */
export const HIT_CLASS_SOUND_TABLE_0x6FBA5538: readonly (readonly [number, number])[] = Object.freeze([
  [0, 0], [251, 6], [262, 6], [268, 6], [274, 8], [280, 8], [286, 6], [292, 8], [268, 6], [298, 6],
  [0, 0], [0, 0], [0, 0], [0, 0],
])

/** HitClass.txt index of a Weapons.txt `hit class` code; throws on an unknown code. */
export function hitClassIndex113c(code: string): number {
  const i = HIT_CLASS_CODES_113C.indexOf(code.trim().toLowerCase())
  if (i < 0) throw new Error(`'${code}' is not a HitClass.txt code`)
  return i
}

/** `0x6FAD2220`: frame delay of hit class `idx` for a unit animation speed (`animSpeed256`, 0 → 1). */
export function hitClassFrameDelay113c(idx: number, animSpeed256: number): number {
  const i = idx & 0xf
  if (i >= 14) throw new Error(`hit class index ${String(idx)} out of range`)
  const frames = HIT_CLASS_SOUND_TABLE_0x6FBA5538[i]![1]
  const speed = Math.trunc(animSpeed256) || 1
  return Math.floor((frames * 256 + 128) / speed)
}

/** `stsounddelay` start-sound delay in frames (`max(0, delay - 3)`). */
export function stSoundDelayFrames113c(idx: number, animSpeed256: number): number {
  return Math.max(0, hitClassFrameDelay113c(idx, animSpeed256) - 3)
}

/**
 * Player hit class (`D2Common#10862` player branch): the right-hand (slot 4) weapon's Weapons.txt `hit class`, else
 * the left-hand (slot 5) weapon's, else 1 (`hth`, `0x6FD821FF`).
 */
export function resolvePlayerHitClassIndex113c(equipment: Iterable<EquippedItemLike> | null | undefined): number {
  let left: string | undefined
  for (const item of equipment ?? []) {
    if (!item || item.broken || item.inSocket) continue
    const slot = item.equippedSlot ?? item.equipSlot ?? item.bodyLoc ?? 0
    const hc = resolveWeaponBase113c(item.code)?.hitClass
    if (!hc) continue
    if (slot === 4) return hitClassIndex113c(hc)
    if (slot === 5 && left === undefined) left = hc
  }
  return left !== undefined ? hitClassIndex113c(left) : 1
}
