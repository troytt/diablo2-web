import { characterBuild, type CharacterBuild } from './character-build.ts'
import { RUNE_INFO } from './gems-data.ts'
import { fitScore, propStats, weaponFit } from './item-score.ts'
import { CANONICAL_RUNES_TABLE } from './runeword.ts'
import PLAY_STYLES from './data/play-styles.json'

export interface RunewordPick {
  readonly name: string
  readonly runes: readonly string[]
  readonly itypes: readonly string[]
  readonly levelreq: number
  readonly score: number
  readonly forMerc: boolean
}

const LEVEL_HEADROOM = 20
const MIN_SCORE = 60
const OWN_PICKS = 8
const MERC_PICKS = 2
const MERC_TYPES = new Set(PLAY_STYLES.mercWeaponTypes)

const runeLevel = (code: string) => RUNE_INFO[code]?.reqLevel ?? 1

const ALL = CANONICAL_RUNES_TABLE.complete.map((rw) => ({
  name: rw.runeName,
  runes: rw.runes.filter(Boolean),
  itypes: rw.itypes.filter(Boolean),
  levelreq: Math.max(...rw.runes.filter(Boolean).map(runeLevel)),
  stats: propStats(rw.properties),
}))

const cache = new Map<string, readonly RunewordPick[]>()

const buildKey = (build: CharacterBuild) => `${build.classIndex}|${build.level}|${build.style}|${[...build.elements].join()}|${[...build.investedTabs].join()}|${build.mainSkills.slice(0, 3).join()}`

export function runewordsFor(build: CharacterBuild): readonly RunewordPick[] {
  const key = buildKey(build)
  const cached = cache.get(key)
  if (cached) return cached
  const merc = characterBuild({ classIndex: -1, level: build.level, strength: 0, dexterity: 0, skillPoints: new Map() })
  const reachable = ALL.filter((rw) => rw.levelreq <= build.level + LEVEL_HEADROOM)
  const ranked = (picks: readonly RunewordPick[], limit: number) => [...picks].filter((p) => p.score >= MIN_SCORE).sort((a, b) => b.score - a.score).slice(0, limit)
  const own = ranked(reachable.map(({ stats, ...rw }) => ({ ...rw, score: Math.round(Math.max(...rw.itypes.map((t) => fitScore(stats, build, weaponFit(t, build))))), forMerc: false })), OWN_PICKS)
  const forMerc = ranked(
    reachable.filter((rw) => rw.itypes.some((t) => MERC_TYPES.has(t)) && !own.some((p) => p.name === rw.name)).map(({ stats, ...rw }) => ({ ...rw, score: Math.round(fitScore(stats, merc, 'full')), forMerc: true })),
    MERC_PICKS,
  )
  const picks = [...own, ...forMerc]
  cache.set(key, picks)
  return picks
}
