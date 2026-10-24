/**
 * Diablo II v1.13c monster component-variant appearances that the generic `<token>-<weapon>` entity bake cannot
 * show, because the variant is chosen per unit at spawn time and sent in the S2C 0xAC component bytes.
 *
 * Ground truth:
 * - MonStats2.txt `necromage` (hcIdx 364, token `SK`, BaseW `hth`): `S4v = S5v = pos,cld,fir,lht` (the elemental
 *   glowing hands) — all other components use the shared skeleton variants.
 * - D2Game `D2GAME_SetUnitComponent_6FD0C3A0` (Raise Skeletal Mage #80): `nElem = RAND & 3`,
 *   `nComponent[11] = nComponent[12] = nElem` (S4 / S5), sent to clients in the 0xAC component bytes.
 * - D2Client `SKILLS_CltDo95_NecromageMissile` (0x6FB088B0) reads the same component to pick necromage1..4
 *   (#208..#211 = poison / cold / fire / lightning), so variant index n is element n.
 *
 * Each entry is baked once per variant into `entities/monster-<variantKey>.{json,r8}` (see pack-entity-assets),
 * and the client selects the atlas from `ClientUnit.compVariants[selectorComponent]`.
 */

/** COF component order (`HD TR LG RA LA RH LH SH S1..S8`) -> index in the 0xAC component array. */
export const MONSTER_COMPONENT_INDEX_113C: Readonly<Record<string, number>> = {
  hd: 0,
  tr: 1,
  lg: 2,
  ra: 3,
  la: 4,
  rh: 5,
  lh: 6,
  sh: 7,
  s1: 8,
  s2: 9,
  s3: 10,
  s4: 11,
  s5: 12,
  s6: 13,
  s7: 14,
  s8: 15,
}

export interface MonsterComponentVariantBake113c {
  /** MonStats.txt `hcIdx`. */
  readonly hcIdx: number
  /** MonStats2.txt `Id`. */
  readonly monStats2Id: string
  /** DCC token and weapon class of the base `<token>-<weapon>` pack. */
  readonly token: string
  readonly weapon: string
  /** COF components (lower-case) that take the selected variant together. */
  readonly components: readonly string[]
  /** MonStats2.txt `<comp>v` list: variant index -> DCC variant token (lower-case). */
  readonly variants: readonly string[]
  /** 0xAC component index whose value selects the variant. */
  readonly selectorComponent: number
}

export const MONSTER_COMPONENT_VARIANT_BAKES_113C: readonly MonsterComponentVariantBake113c[] = [
  {
    hcIdx: 364,
    monStats2Id: 'necromage',
    token: 'SK',
    weapon: 'hth',
    components: ['s4', 's5'],
    variants: ['pos', 'cld', 'fir', 'lht'],
    selectorComponent: 11,
  },
]

/** Entity pack key (without the `monster-` prefix) of `bake` with variant index `variantIdx`. */
export function monsterComponentVariantKey113c(bake: MonsterComponentVariantBake113c, variantIdx: number): string {
  const variant = bake.variants[variantIdx]
  if (variant === undefined) {
    throw new RangeError(
      `monster-component-variants: hcIdx ${String(bake.hcIdx)} has no variant ${String(variantIdx)} (0..${String(bake.variants.length - 1)})`,
    )
  }
  return `${bake.token}-${bake.weapon}-${bake.components.join('')}${variant}`.toLowerCase()
}

/** COF component -> DCC variant token map for compositing `bake` with variant index `variantIdx`. */
export function monsterComponentVariantOverrides113c(
  bake: MonsterComponentVariantBake113c,
  variantIdx: number,
): Readonly<Record<string, string>> {
  const variant = bake.variants[variantIdx]
  if (variant === undefined) {
    throw new RangeError(`monster-component-variants: hcIdx ${String(bake.hcIdx)} has no variant ${String(variantIdx)}`)
  }
  const out: Record<string, string> = {}
  for (const comp of bake.components) out[comp] = variant
  return out
}

const BAKE_BY_HCIDX = new Map<number, MonsterComponentVariantBake113c>(
  MONSTER_COMPONENT_VARIANT_BAKES_113C.map(b => [b.hcIdx, b]),
)

/**
 * Variant pack key for a monster unit, or `null` when the class has no per-unit variant bake or the unit carries
 * no 0xAC component bytes (then the shared `<token>-<weapon>` pack applies). Throws on an out-of-range component.
 */
export function resolveMonsterComponentVariantKey113c(
  classId: number,
  compVariants: readonly number[] | undefined,
): string | null {
  const bake = BAKE_BY_HCIDX.get(classId)
  if (bake === undefined || compVariants === undefined) return null
  const idx = compVariants[bake.selectorComponent]
  if (idx === undefined) return null
  return monsterComponentVariantKey113c(bake, idx)
}
