/**
 * Authoritative Diablo II: Lord of Destruction v1.13c `MonProp.txt` table & runtime resolver (`#1897`).
 *
 * Ground truth:
 * - `Patch_D2.mpq` -> `data\global\excel\MonProp.txt` (13 rows)
 * - Bound via `MonStats.txt` `MonProp` column (`MONSTATS_113C_ROWS[hcIdx].monProp`)
 *   plus pet rows (`irongolem` `hcIdx 291`).
 * - `D2Game.dll` `MONSTER_ApplyMonProp` (`0x6FC62130`): on monster spawn, iterates the
 *   6 property slots for the active game difficulty (`prop1..6`, `prop1..6 (N)`, `prop1..6 (H)`),
 *   rolls `chance` (`100%` when blank/`0`), rolls `val` uniformly in `[min, max]`, and
 *   injects the resolved `Properties.txt` stats onto the monster's `statList`.
 */

import { MONSTATS_113C_ROWS } from '../../common/units/monstats-113c-data.ts'

export interface MonPropEntry113c {
  readonly prop: string
  readonly chance?: number | undefined
  readonly par?: string | undefined
  readonly min: number
  readonly max: number
}

export interface MonPropRow113c {
  readonly id: string
  readonly normal: readonly MonPropEntry113c[]
  readonly nightmare: readonly MonPropEntry113c[]
  readonly hell: readonly MonPropEntry113c[]
}

/**
 * Exact 13-row `MonProp.txt` table from Diablo II: Lord of Destruction v1.13c (`Patch_D2.mpq`).
 */
export const MON_PROP_ROWS_113C: readonly MonPropRow113c[] = Object.freeze([
  {
    id: 'baboon6',
    normal: [{ prop: 'fade', min: 1, max: 1 }],
    nightmare: [{ prop: 'fade', min: 2, max: 2 }],
    hell: [{ prop: 'fade', min: 2, max: 2 }],
  },
  {
    id: 'irongolem',
    normal: [{ prop: 'fade', min: 16, max: 16 }],
    nightmare: [{ prop: 'fade', min: 16, max: 16 }],
    hell: [{ prop: 'fade', min: 16, max: 16 }],
  },
  {
    id: 'mephisto',
    normal: [],
    nightmare: [
      { prop: 'cast2', min: 15, max: 15 },
      { prop: 'swing2', min: 15, max: 15 },
    ],
    hell: [
      { prop: 'cast2', min: 30, max: 30 },
      { prop: 'swing2', min: 30, max: 30 },
    ],
  },
  {
    id: 'blunderbore',
    normal: [],
    nightmare: [{ prop: 'crush', min: 15, max: 15 }],
    hell: [{ prop: 'crush', min: 25, max: 25 }],
  },
  {
    id: 'councilmember1',
    normal: [],
    nightmare: [{ prop: 'extra-fire', min: 40, max: 40 }],
    hell: [{ prop: 'extra-fire', min: 100, max: 100 }],
  },
  {
    id: 'councilmember2',
    normal: [],
    nightmare: [{ prop: 'extra-fire', min: 40, max: 40 }],
    hell: [{ prop: 'extra-fire', min: 100, max: 100 }],
  },
  {
    id: 'councilmember3',
    normal: [],
    nightmare: [{ prop: 'extra-fire', min: 40, max: 40 }],
    hell: [{ prop: 'extra-fire', min: 100, max: 100 }],
  },
  {
    id: 'baalhighpriest',
    normal: [],
    nightmare: [{ prop: 'extra-fire', min: 60, max: 60 }],
    hell: [{ prop: 'extra-fire', min: 120, max: 120 }],
  },
  {
    id: 'bloodraven',
    normal: [],
    nightmare: [],
    hell: [{ prop: 'knock', min: 1, max: 1 }],
  },
  {
    id: 'quillrat6',
    normal: [],
    nightmare: [{ prop: 'thorns', min: 15, max: 20 }],
    hell: [{ prop: 'thorns', min: 30, max: 40 }],
  },
  {
    id: 'quillrat7',
    normal: [],
    nightmare: [{ prop: 'thorns', min: 15, max: 20 }],
    hell: [{ prop: 'thorns', min: 30, max: 40 }],
  },
  {
    id: 'quillrat8',
    normal: [],
    nightmare: [{ prop: 'thorns', min: 15, max: 20 }],
    hell: [{ prop: 'thorns', min: 30, max: 40 }],
  },
  {
    id: 'druidhawk',
    normal: [{ prop: 'stupidity', min: -1, max: -1 }],
    nightmare: [{ prop: 'stupidity', min: -1, max: -1 }],
    hell: [{ prop: 'stupidity', min: -1, max: -1 }],
  },
])

const MON_PROP_BY_ID: ReadonlyMap<string, MonPropRow113c> = new Map(
  MON_PROP_ROWS_113C.map((row) => [row.id.toLowerCase(), row]),
)

const MONSTATS_BY_ID_LOWER: ReadonlyMap<string, (typeof MONSTATS_113C_ROWS)[number]> = new Map(
  MONSTATS_113C_ROWS.map((row) => [row.id.toLowerCase(), row]),
)

export interface ResolvedMonsterMonProps113c {
  readonly monPropId: string | undefined
  /** `stat 136` (`item_crushingblow`): % chance to deal Crushing Blow on physical hit (`blunderbore1..6`). */
  readonly crushingBlowPct: number
  /** `stat 81` (`item_knockback`): knockback on physical hit (`bloodraven` in Hell). */
  readonly knockback: boolean
  /** `stat 329` (`passive_fire_mastery`): +% fire skill/attack damage (`councilmember1..3`, `baalhighpriest`). */
  readonly extraFirePct: number
  /** `stat 93` (`item_fasterattackrate` / `swing2`): +% increased attack speed (`mephisto`, `ubermephisto`). */
  readonly iasPct: number
  /** `stat 105` (`item_fastercastrate` / `cast2`): +% faster cast rate (`mephisto`, `ubermephisto`). */
  readonly fcrPct: number
  /** `stat 78` (`att_skill` / `thorns`): flat physical damage returned to melee attackers (`quillrat6..8`). */
  readonly thornsFlat: number
  /** `stat 304` (`item_fade`): visual/ethereal fade parameter (`baboon6`, `irongolem`). */
  readonly fadeLevel: number
  /** `stat 114` / `item_stupidity`: Hit Blinds Target (`druidhawk`). */
  readonly blindTarget: number
  readonly applied: readonly { readonly prop: string; readonly value: number }[]
}

const EMPTY_MON_PROPS_113C: ResolvedMonsterMonProps113c = Object.freeze({
  monPropId: undefined,
  crushingBlowPct: 0,
  knockback: false,
  extraFirePct: 0,
  iasPct: 0,
  fcrPct: 0,
  thornsFlat: 0,
  fadeLevel: 0,
  blindTarget: 0,
  applied: [],
})

export function resolveMonPropIdForMonster113c(
  monPropOrMonster: string | number | undefined,
): string | undefined {
  if (monPropOrMonster === undefined) return undefined
  if (typeof monPropOrMonster === 'number') {
    const row = MONSTATS_113C_ROWS[monPropOrMonster | 0]
    if (!row) return undefined
    if (row.monProp && MON_PROP_BY_ID.has(row.monProp.toLowerCase())) {
      return row.monProp.toLowerCase()
    }
    if (MON_PROP_BY_ID.has(row.id.toLowerCase())) {
      return row.id.toLowerCase()
    }
    return undefined
  }
  const clean = monPropOrMonster.trim().toLowerCase()
  if (!clean) return undefined
  if (MON_PROP_BY_ID.has(clean)) return clean
  const monRow = MONSTATS_BY_ID_LOWER.get(clean)
  if (monRow?.monProp && MON_PROP_BY_ID.has(monRow.monProp.toLowerCase())) {
    return monRow.monProp.toLowerCase()
  }
  return undefined
}

/**
 * Resolves innate `MonProp.txt` stats for a monster or revived pet (`#1897`).
 */
export function resolveMonsterMonProps113c(
  monPropOrMonster: string | number | undefined,
  difficulty: 0 | 1 | 2 | 'normal' | 'nightmare' | 'hell' = 'normal',
  rollInclusive?: (min: number, max: number) => number,
  rollPercent0To99?: () => number,
): ResolvedMonsterMonProps113c {
  const propId = resolveMonPropIdForMonster113c(monPropOrMonster)
  if (!propId) return EMPTY_MON_PROPS_113C
  const row = MON_PROP_BY_ID.get(propId)
  if (!row) return EMPTY_MON_PROPS_113C

  const entries =
    difficulty === 2 || difficulty === 'hell'
      ? row.hell
      : difficulty === 1 || difficulty === 'nightmare'
        ? row.nightmare
        : row.normal
  if (entries.length === 0) {
    return { ...EMPTY_MON_PROPS_113C, monPropId: row.id }
  }

  let crushingBlowPct = 0
  let knockback = false
  let extraFirePct = 0
  let iasPct = 0
  let fcrPct = 0
  let thornsFlat = 0
  let fadeLevel = 0
  let blindTarget = 0
  const applied: { readonly prop: string; readonly value: number }[] = []

  for (const entry of entries) {
    if (entry.chance !== undefined && entry.chance > 0 && entry.chance < 100) {
      const pctRoll = rollPercent0To99 ? rollPercent0To99() : 0
      if (pctRoll >= entry.chance) continue
    }
    const lo = Math.min(entry.min, entry.max)
    const hi = Math.max(entry.min, entry.max)
    const val =
      lo === hi
        ? lo
        : rollInclusive
          ? rollInclusive(lo, hi)
          : Math.floor((lo + hi) / 2)
    applied.push({ prop: entry.prop, value: val })
    switch (entry.prop) {
      case 'crush':
        crushingBlowPct += Math.max(0, val)
        break
      case 'knock':
        if (val > 0) knockback = true
        break
      case 'extra-fire':
        extraFirePct += val
        break
      case 'swing1':
      case 'swing2':
      case 'swing3':
        iasPct += val
        break
      case 'cast1':
      case 'cast2':
      case 'cast3':
        fcrPct += val
        break
      case 'thorns':
        thornsFlat += Math.max(0, val)
        break
      case 'fade':
        fadeLevel = Math.max(fadeLevel, val)
        break
      case 'stupidity':
        blindTarget = val
        break
    }
  }

  return {
    monPropId: row.id,
    crushingBlowPct,
    knockback,
    extraFirePct,
    iasPct,
    fcrPct,
    thornsFlat,
    fadeLevel,
    blindTarget,
    applied,
  }
}
