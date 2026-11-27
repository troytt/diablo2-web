/**
 * 1.13c D2Client MissCltHitFunc[16] (0x6fb667d0): chainlightning #93, lightningstrike #232, chainlightning2 #267.
 *
 * ```
 * 0x6fb66835  ProgOverlay (+0x36) -> 0x6fb1b300 on the hit unit
 * 0x6fb66853  cnt = #11018(m) (missile data +0x28, "TargetX"); cnt <= 1 -> return 1 (no bounce)
 * 0x6fb66878  r = cHitPar1 (+0x6c); r <= 0 -> r = max(1, #10786(owner, Skills.txt aurarangecalc, skill, slvl))
 * 0x6fb668ce  next = 0x6fb51a50(filter 0x88583, r, owner, hit unit x/y, excluded = hit unit id)
 *             next == NULL or next == hit unit -> return 1
 * 0x6fb6690e  create { flags 0x21, owner, source = hit unit, missile = same class, start = hit unit, target = next }
 * 0x6fb66961  #10637(new, cnt - 1); #10024(new, hit unit)   (the child ignores the unit it starts on)
 *             return 1
 * ```
 * The count is written by the creator: Skills.txt calc1 of Chain Lightning (SkillCltDoFunc[27] 0x6fb23e80,
 * skills.bin +0x138) and calc2 of Lightning Strike (SkillCltDoFunc[22] 0x6fac5660, skills.bin +0x13c).
 */

/** Skills.txt #53 Chain Lightning calc1 = `ln34 / 5` (Param3 = 26, Param4 = 1): (26 + (slvl - 1)) / 5, truncated. */
export function chainLightningHits113c(slvl: number): number {
  return Math.trunc((26 + (Math.max(1, slvl) - 1) * 1) / 5)
}

/** Skills.txt #34 Lightning Strike calc2 = `ln34` (Param3 = 2, Param4 = 1): 2 + (slvl - 1). */
export function lightningStrikeHits113c(slvl: number): number {
  return 2 + (Math.max(1, slvl) - 1) * 1
}

/** Skills.txt aurarangecalc of the skills whose missiles use CltHitFunc 16 with cHitPar1 = 0 (both `par1`, Param1 = 20). */
const CLTHIT16_SKILL_AURARANGE_113C: Readonly<Record<number, number>> = Object.freeze({ 34: 20, 53: 20 })

/** Bounce search radius in sub-tiles (0x6fb66878-b9). An unknown skill with cHitPar1 = 0 throws (no invented radius). */
export function cltHit16Radius113c(cHitPar1: number, sourceSkillId: number | undefined): number {
  if (cHitPar1 > 0) return cHitPar1
  const r = sourceSkillId === undefined ? undefined : CLTHIT16_SKILL_AURARANGE_113C[sourceSkillId]
  if (r === undefined) {
    throw new Error(`CltHitFunc 16: no Skills.txt aurarangecalc known for skill ${String(sourceSkillId)}`)
  }
  return Math.max(1, r)
}
