/**
 * Character Skin Pack Contract, Validation, & Animation Fallback Resolver
 * (`src/common/units/character-skin.ts`).
 *
 * Pure deterministic module (zero DOM globals, zero `node:*` imports, zero wall-clock/RNG).
 */

import { PLAYER_CLASS_TOKENS, type PlayerClassToken } from './char-appearance.ts'
import type { AnimClipMeta } from './unit-types.ts'

export type CharacterSkinScope = 'self' | 'class'

/**
 * Controls how a character skin interacts with in-game morph states
 * (e.g. Necromancer Trang-Oul Vampire `tg`, Druid Werewolf/Werebear `40`/`va`, Delirium `fk`):
 * - `'keep-skin'` (default): keep the equipped character skin appearance (do not morph).
 * - `'vanilla-morph'`: show the vanilla morph monster sprite when morphed.
 * - `'skin'`: defer to each skin manifest's own `respectMorph` boolean.
 */
export type CharacterSkinMorphPolicy = 'keep-skin' | 'vanilla-morph' | 'skin'

export interface CharacterSkinLocalizedText {
  readonly zh: string
  readonly en: string
}

export interface CharacterSkinPageSpec {
  readonly file: string
  readonly width: number
  readonly height: number
}

/**
 * `[x, y, width, height, anchorX?, anchorY?, pageIndex?]`
 */
export type CharacterSkinFrameTuple = readonly [
  number,
  number,
  number,
  number,
  number?,
  number?,
  number?,
]

/**
 * Authoritative allowlist of skinnable summoned monster `MonStats.txt` IDs (`hcIdx`) per player class.
 * Unknown or cross-class keys in `manifest.minions` are rejected fail-fast during manifest validation.
 */
export const SKINNABLE_MINIONS_BY_CLASS: Readonly<
  Record<PlayerClassToken, Readonly<Record<string, number>>>
> = Object.freeze({
  am: Object.freeze({
    valkyrie: 357,
  }),
  so: Object.freeze({}),
  ne: Object.freeze({
    necroskeleton: 363,
    necromage: 364,
    claygolem: 289,
    bloodgolem: 290,
    irongolem: 291,
    firegolem: 292,
  }),
  pa: Object.freeze({}),
  ba: Object.freeze({}),
  dz: Object.freeze({
    raven: 419,
    spiritwolf: 420,
    fenris: 421,
    spiritofbarbs: 422,
    heartofwolverine: 423,
    oaksage: 424,
    grizzly: 428,
  }),
  ai: Object.freeze({
    shadowwarrior: 417,
    shadowmaster: 418,
  }),
})

export const REQUIRED_MINION_CLIP_KEYS = ['nu', 'wl', 'a1', 'gh', 'dt'] as const

export interface CharacterSkinMinionSpec {
  readonly name: CharacterSkinLocalizedText
  readonly directions: number
  readonly renderScale?: number | undefined
  readonly floating?: boolean | undefined
  readonly shadowOffsetY?: number | undefined
  readonly shadowScale?: number | undefined
  /** Optional RGBA top-left HUD portrait image (`46x41` or `92x82`) relative to the skin directory. */
  readonly portraitFile?: string | undefined
  readonly pages: readonly CharacterSkinPageSpec[]
  readonly glowPages?: readonly CharacterSkinPageSpec[] | undefined
  readonly clips: Readonly<Record<string, AnimClipMeta>>
  readonly glowClips?: Readonly<Record<string, AnimClipMeta>> | undefined
  readonly groups: readonly (readonly CharacterSkinFrameTuple[])[]
  readonly glowGroups?: readonly (readonly CharacterSkinFrameTuple[])[] | undefined
}

export interface CharacterSkinManifest {
  readonly schema: 1
  readonly id: string
  readonly name: CharacterSkinLocalizedText
  readonly description?: CharacterSkinLocalizedText | undefined
  readonly author?: string | undefined
  readonly targetClass: PlayerClassToken
  readonly format: 'rgba'
  readonly directions: number
  /** Logical scale multiplier applied at draw time (e.g. `0.5` for 2x HD sprites). Defaults to `1`. */
  readonly renderScale?: number | undefined
  /** Whether the character hovers above the ground (e.g. Kel'Thuzad Lich). */
  readonly floating?: boolean | undefined
  /** Vertical scene-pixel offset applied to the ground perspective shadow (default `0`). */
  readonly shadowOffsetY?: number | undefined
  /** Scale multiplier applied to the ground perspective shadow relative to the drawn sprite (default `1`). */
  readonly shadowScale?: number | undefined
  /** When `true`, morph states (such as Trang-Oul Vampire) take priority unless overridden by user policy. */
  readonly respectMorph?: boolean | undefined
  readonly previewFile?: string | undefined
  readonly pages: readonly CharacterSkinPageSpec[]
  readonly glowPages?: readonly CharacterSkinPageSpec[] | undefined
  readonly clips: Readonly<Record<string, AnimClipMeta>>
  readonly glowClips?: Readonly<Record<string, AnimClipMeta>> | undefined
  readonly groups: readonly (readonly CharacterSkinFrameTuple[])[]
  readonly glowGroups?: readonly (readonly CharacterSkinFrameTuple[])[] | undefined
  /** Optional class-owned summoned minion skin replacements bundled with this character skin. */
  readonly minions?: Readonly<Record<string, CharacterSkinMinionSpec>> | undefined
}

export interface CharacterSkinCatalogEntry {
  readonly id: string
  readonly name: CharacterSkinLocalizedText
  readonly description?: CharacterSkinLocalizedText | undefined
  readonly author?: string | undefined
  readonly targetClass: PlayerClassToken
  readonly source: 'builtin' | 'custom'
  /** Relative path under `/skins/` for built-in skins (e.g. `'ne-kelthuzad/skin.json'`). */
  readonly manifestPath?: string | undefined
  /** Relative path under `/skins/` for built-in preview thumbnail (e.g. `'ne-kelthuzad/preview.png'`). */
  readonly previewPath?: string | undefined
}

export interface CharacterSkinIndexJson {
  readonly schema: 1
  readonly skins: readonly CharacterSkinCatalogEntry[]
}

export interface CharacterSkinRuntimeConfig {
  readonly enabled: boolean
  readonly scope: CharacterSkinScope
  readonly morphPolicy: CharacterSkinMorphPolicy
  /** Whether summoned minions of the skinned class also adopt bundled `minions` appearances. */
  readonly minionsEnabled: boolean
  readonly selectedByClass: Readonly<Partial<Record<PlayerClassToken, string | null>>>
}

export const DEFAULT_CHARACTER_SKIN_CONFIG: CharacterSkinRuntimeConfig = Object.freeze({
  enabled: false,
  scope: 'self',
  morphPolicy: 'keep-skin',
  minionsEnabled: true,
  selectedByClass: Object.freeze({}),
})

const SKIN_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const VALID_DIRECTIONS = new Set<number>([1, 2, 4, 8, 16, 32, 64])
const CASTER_CLASSES = new Set<PlayerClassToken>(['ne', 'so', 'dz'])

export function isValidSkinRelativeFile(file: unknown): file is string {
  if (typeof file !== 'string') return false
  const trimmed = file.trim()
  if (trimmed.length === 0 || trimmed.length > 180) return false
  if (trimmed.startsWith('/') || trimmed.includes('..') || trimmed.includes('\\') || trimmed.includes(':')) {
    return false
  }
  return /^[a-zA-Z0-9._/-]+$/.test(trimmed)
}

function validateLocalizedText(raw: unknown, label: string): CharacterSkinLocalizedText {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Invalid character skin ${label}: expected { zh, en } object`)
  }
  const obj = raw as Record<string, unknown>
  if (typeof obj.zh !== 'string' || obj.zh.trim().length === 0) {
    throw new Error(`Invalid character skin ${label}.zh: expected non-empty string`)
  }
  if (typeof obj.en !== 'string' || obj.en.trim().length === 0) {
    throw new Error(`Invalid character skin ${label}.en: expected non-empty string`)
  }
  return { zh: obj.zh.trim(), en: obj.en.trim() }
}

function validatePages(raw: unknown, label: string): readonly CharacterSkinPageSpec[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 16) {
    throw new Error(`Invalid character skin ${label}: expected 1..16 atlas pages`)
  }
  return raw.map((entry, idx) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Invalid character skin ${label}[${String(idx)}]: expected object`)
    }
    const obj = entry as Record<string, unknown>
    if (!isValidSkinRelativeFile(obj.file)) {
      throw new Error(`Invalid character skin ${label}[${String(idx)}].file: "${String(obj.file)}"`)
    }
    const width = Number(obj.width)
    const height = Number(obj.height)
    if (!Number.isInteger(width) || width < 1 || width > 8192) {
      throw new Error(`Invalid character skin ${label}[${String(idx)}].width: ${String(obj.width)}`)
    }
    if (!Number.isInteger(height) || height < 1 || height > 8192) {
      throw new Error(`Invalid character skin ${label}[${String(idx)}].height: ${String(obj.height)}`)
    }
    return { file: obj.file.trim(), width, height }
  })
}

function validateGroups(
  raw: unknown,
  pageCount: number,
  label: string,
): readonly (readonly CharacterSkinFrameTuple[])[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`Invalid character skin ${label}: expected non-empty groups array`)
  }
  return raw.map((group, gIdx) => {
    if (!Array.isArray(group) || group.length === 0) {
      throw new Error(`Invalid character skin ${label}[${String(gIdx)}]: expected non-empty frame array`)
    }
    return group.map((tuple, fIdx) => {
      if (!Array.isArray(tuple) || tuple.length < 4) {
        throw new Error(`Invalid character skin ${label}[${String(gIdx)}][${String(fIdx)}]: expected >=4 numbers`)
      }
      const x = Number(tuple[0])
      const y = Number(tuple[1])
      const w = Number(tuple[2])
      const h = Number(tuple[3])
      const ax = tuple[4] !== undefined ? Number(tuple[4]) : undefined
      const ay = tuple[5] !== undefined ? Number(tuple[5]) : undefined
      const pageIdx = tuple[6] !== undefined ? Number(tuple[6]) : undefined
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(w) ||
        !Number.isFinite(h) ||
        w < 1 ||
        h < 1
      ) {
        throw new Error(`Invalid frame rect in ${label}[${String(gIdx)}][${String(fIdx)}]`)
      }
      if ((ax !== undefined && !Number.isFinite(ax)) || (ay !== undefined && !Number.isFinite(ay))) {
        throw new Error(`Invalid frame anchor in ${label}[${String(gIdx)}][${String(fIdx)}]`)
      }
      if (pageIdx !== undefined && (!Number.isInteger(pageIdx) || pageIdx < 0 || pageIdx >= pageCount)) {
        throw new Error(`Out-of-range pageIndex ${String(pageIdx)} in ${label}[${String(gIdx)}][${String(fIdx)}]`)
      }
      const out: number[] = [x, y, w, h]
      if (ax !== undefined || ay !== undefined || pageIdx !== undefined) {
        out.push(ax ?? 0, ay ?? 0)
      }
      if (pageIdx !== undefined) {
        out.push(pageIdx)
      }
      return out as unknown as CharacterSkinFrameTuple
    })
  })
}

function validateClips(
  raw: unknown,
  groupCount: number,
  label: string,
): Readonly<Record<string, AnimClipMeta>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Invalid character skin ${label}: expected clips record`)
  }
  const obj = raw as Record<string, unknown>
  const keys = Object.keys(obj)
  if (keys.length === 0) {
    throw new Error(`Invalid character skin ${label}: clips must contain at least one clip`)
  }
  const out: Record<string, AnimClipMeta> = {}
  for (const rawKey of keys) {
    const key = rawKey.trim().toLowerCase()
    const c = obj[rawKey]
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      throw new Error(`Invalid character skin ${label}.${rawKey}: expected clip object`)
    }
    const rec = c as Record<string, unknown>
    const group = Number(rec.group)
    const directions = Number(rec.directions)
    const frames = Number(rec.frames)
    const speed = Number(rec.speed)
    if (!Number.isInteger(group) || group < 0 || !VALID_DIRECTIONS.has(directions) || group + directions > groupCount) {
      throw new Error(
        `Invalid character skin ${label}.${rawKey}: group=${String(rec.group)} directions=${String(rec.directions)} exceeds groupCount=${String(groupCount)}`,
      )
    }
    if (!Number.isInteger(frames) || frames < 1 || !Number.isFinite(speed) || speed <= 0) {
      throw new Error(
        `Invalid character skin ${label}.${rawKey}: frames=${String(rec.frames)} speed=${String(rec.speed)}`,
      )
    }
    const eventsRaw = Array.isArray(rec.events) ? rec.events : undefined
    const events = eventsRaw?.map((ev) => {
      const e = ev as Record<string, unknown>
      return { f: Number(e.f ?? 0), c: Number(e.c ?? 0) }
    })
    out[key] = {
      group,
      directions,
      frames,
      speed,
      loop: typeof rec.loop === 'boolean' ? rec.loop : false,
      events: events ?? [],
    }
  }
  return out
}

export function validateCharacterSkinManifest(raw: unknown): CharacterSkinManifest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Character skin manifest validation failed: expected JSON object')
  }
  const obj = raw as Record<string, unknown>
  if (obj.schema !== 1) {
    throw new Error(`Unsupported character skin manifest schema=${String(obj.schema)} (expected 1)`)
  }
  if (typeof obj.id !== 'string' || !SKIN_ID_RE.test(obj.id)) {
    throw new Error(`Invalid character skin id "${String(obj.id)}" (expected kebab-case)`)
  }
  const name = validateLocalizedText(obj.name, 'name')
  const description = obj.description !== undefined ? validateLocalizedText(obj.description, 'description') : undefined
  const author = typeof obj.author === 'string' && obj.author.trim().length > 0 ? obj.author.trim() : undefined

  const targetClass = typeof obj.targetClass === 'string' ? obj.targetClass.trim().toLowerCase() : ''
  if (!(PLAYER_CLASS_TOKENS as readonly string[]).includes(targetClass)) {
    throw new Error(`Invalid character skin targetClass "${String(obj.targetClass)}"`)
  }
  if (obj.format !== 'rgba') {
    throw new Error(`Unsupported character skin format "${String(obj.format)}" (expected "rgba")`)
  }
  const directions = Number(obj.directions)
  if (!VALID_DIRECTIONS.has(directions)) {
    throw new Error(`Invalid character skin directions=${String(obj.directions)}`)
  }

  let renderScale: number | undefined
  if (obj.renderScale !== undefined) {
    const s = Number(obj.renderScale)
    if (!Number.isFinite(s) || s < 0.125 || s > 4) {
      throw new Error(`Invalid character skin renderScale=${String(obj.renderScale)} (expected 0.125..4)`)
    }
    renderScale = s
  }

  let shadowOffsetY: number | undefined
  if (obj.shadowOffsetY !== undefined) {
    const off = Number(obj.shadowOffsetY)
    if (!Number.isFinite(off) || off < -128 || off > 128) {
      throw new Error(`Invalid character skin shadowOffsetY=${String(obj.shadowOffsetY)}`)
    }
    shadowOffsetY = off
  }

  let shadowScale: number | undefined
  if (obj.shadowScale !== undefined) {
    const ss = Number(obj.shadowScale)
    if (!Number.isFinite(ss) || ss < 0 || ss > 4) {
      throw new Error(`Invalid character skin shadowScale=${String(obj.shadowScale)}`)
    }
    shadowScale = ss
  }

  const previewFile =
    obj.previewFile !== undefined
      ? (() => {
          if (!isValidSkinRelativeFile(obj.previewFile)) {
            throw new Error(`Invalid character skin previewFile "${String(obj.previewFile)}"`)
          }
          return obj.previewFile.trim()
        })()
      : undefined

  const pages = validatePages(obj.pages, 'pages')
  const groups = validateGroups(obj.groups, pages.length, 'groups')
  const clips = validateClips(obj.clips, groups.length, 'clips')
  if (!clips.nu && !clips.tn && !clips.wl) {
    throw new Error(`Character skin "${obj.id}" must provide at least one baseline idle/walk clip (nu, tn, or wl)`)
  }

  let glowPages: readonly CharacterSkinPageSpec[] | undefined
  let glowGroups: readonly (readonly CharacterSkinFrameTuple[])[] | undefined
  let glowClips: Readonly<Record<string, AnimClipMeta>> | undefined
  if (obj.glowPages !== undefined || obj.glowGroups !== undefined) {
    glowPages = validatePages(obj.glowPages, 'glowPages')
    glowGroups = validateGroups(obj.glowGroups, glowPages.length, 'glowGroups')
    glowClips =
      obj.glowClips !== undefined
        ? validateClips(obj.glowClips, glowGroups.length, 'glowClips')
        : clips
  }

  let minions: Readonly<Record<string, CharacterSkinMinionSpec>> | undefined
  if (obj.minions !== undefined) {
    if (!obj.minions || typeof obj.minions !== 'object' || Array.isArray(obj.minions)) {
      throw new Error('Invalid character skin minions: expected JSON object')
    }
    const allowedMap = SKINNABLE_MINIONS_BY_CLASS[targetClass as PlayerClassToken]
    const rawMinions = obj.minions as Record<string, unknown>
    const validatedMinions: Record<string, CharacterSkinMinionSpec> = {}
    for (const rawKey of Object.keys(rawMinions)) {
      const mKey = rawKey.trim().toLowerCase()
      if (allowedMap[mKey] === undefined) {
        throw new Error(
          `Invalid character skin minions.${rawKey}: "${rawKey}" is not an allowed summon for targetClass="${targetClass}"`,
        )
      }
      const mRaw = rawMinions[rawKey]
      if (!mRaw || typeof mRaw !== 'object' || Array.isArray(mRaw)) {
        throw new Error(`Invalid character skin minions.${rawKey}: expected object`)
      }
      const mObj = mRaw as Record<string, unknown>
      const mName = validateLocalizedText(mObj.name, `minions.${rawKey}.name`)
      const mDirs = Number(mObj.directions)
      if (!VALID_DIRECTIONS.has(mDirs)) {
        throw new Error(`Invalid character skin minions.${rawKey}.directions=${String(mObj.directions)}`)
      }
      let mScale: number | undefined
      if (mObj.renderScale !== undefined) {
        const s = Number(mObj.renderScale)
        if (!Number.isFinite(s) || s < 0.125 || s > 4) {
          throw new Error(`Invalid character skin minions.${rawKey}.renderScale=${String(mObj.renderScale)}`)
        }
        mScale = s
      }
      let mShadowOffY: number | undefined
      if (mObj.shadowOffsetY !== undefined) {
        const off = Number(mObj.shadowOffsetY)
        if (!Number.isFinite(off) || off < -128 || off > 128) {
          throw new Error(`Invalid character skin minions.${rawKey}.shadowOffsetY=${String(mObj.shadowOffsetY)}`)
        }
        mShadowOffY = off
      }
      let mShadowScale: number | undefined
      if (mObj.shadowScale !== undefined) {
        const ss = Number(mObj.shadowScale)
        if (!Number.isFinite(ss) || ss < 0 || ss > 4) {
          throw new Error(`Invalid character skin minions.${rawKey}.shadowScale=${String(mObj.shadowScale)}`)
        }
        mShadowScale = ss
      }
      let mPortraitFile: string | undefined
      if (mObj.portraitFile !== undefined) {
        if (!isValidSkinRelativeFile(mObj.portraitFile)) {
          throw new Error(`Invalid character skin minions.${rawKey}.portraitFile="${String(mObj.portraitFile)}"`)
        }
        mPortraitFile = mObj.portraitFile.trim()
      }
      const mPages = validatePages(mObj.pages, `minions.${rawKey}.pages`)
      const mGroups = validateGroups(mObj.groups, mPages.length, `minions.${rawKey}.groups`)
      const mClips = validateClips(mObj.clips, mGroups.length, `minions.${rawKey}.clips`)
      for (const reqClip of REQUIRED_MINION_CLIP_KEYS) {
        if (!mClips[reqClip]) {
          throw new Error(
            `Character skin "${obj.id}" minions.${rawKey} is missing required core clip "${reqClip}" (expected nu, wl, a1, gh, dt)`,
          )
        }
      }
      let mGlowPages: readonly CharacterSkinPageSpec[] | undefined
      let mGlowGroups: readonly (readonly CharacterSkinFrameTuple[])[] | undefined
      let mGlowClips: Readonly<Record<string, AnimClipMeta>> | undefined
      if (mObj.glowPages !== undefined || mObj.glowGroups !== undefined) {
        mGlowPages = validatePages(mObj.glowPages, `minions.${rawKey}.glowPages`)
        mGlowGroups = validateGroups(mObj.glowGroups, mGlowPages.length, `minions.${rawKey}.glowGroups`)
        mGlowClips =
          mObj.glowClips !== undefined
            ? validateClips(mObj.glowClips, mGlowGroups.length, `minions.${rawKey}.glowClips`)
            : mClips
      }
      validatedMinions[mKey] = {
        name: mName,
        directions: mDirs,
        ...(mScale !== undefined ? { renderScale: mScale } : {}),
        ...(typeof mObj.floating === 'boolean' ? { floating: mObj.floating } : {}),
        ...(mShadowOffY !== undefined ? { shadowOffsetY: mShadowOffY } : {}),
        ...(mShadowScale !== undefined ? { shadowScale: mShadowScale } : {}),
        ...(mPortraitFile !== undefined ? { portraitFile: mPortraitFile } : {}),
        pages: mPages,
        ...(mGlowPages !== undefined ? { glowPages: mGlowPages } : {}),
        clips: mClips,
        ...(mGlowClips !== undefined ? { glowClips: mGlowClips } : {}),
        groups: mGroups,
        ...(mGlowGroups !== undefined ? { glowGroups: mGlowGroups } : {}),
      }
    }
    if (Object.keys(validatedMinions).length > 0) {
      minions = validatedMinions
    }
  }

  return {
    schema: 1,
    id: obj.id,
    name,
    ...(description !== undefined ? { description } : {}),
    ...(author !== undefined ? { author } : {}),
    targetClass: targetClass as PlayerClassToken,
    format: 'rgba',
    directions,
    ...(renderScale !== undefined ? { renderScale } : {}),
    ...(typeof obj.floating === 'boolean' ? { floating: obj.floating } : {}),
    ...(shadowOffsetY !== undefined ? { shadowOffsetY } : {}),
    ...(shadowScale !== undefined ? { shadowScale } : {}),
    ...(typeof obj.respectMorph === 'boolean' ? { respectMorph: obj.respectMorph } : {}),
    ...(previewFile !== undefined ? { previewFile } : {}),
    pages,
    ...(glowPages !== undefined ? { glowPages } : {}),
    clips,
    ...(glowClips !== undefined ? { glowClips } : {}),
    groups,
    ...(glowGroups !== undefined ? { glowGroups } : {}),
    ...(minions !== undefined ? { minions } : {}),
  }
}

export function validateCharacterSkinIndex(raw: unknown): CharacterSkinIndexJson {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Character skin index validation failed: expected JSON object')
  }
  const obj = raw as Record<string, unknown>
  if (obj.schema !== 1 || !Array.isArray(obj.skins)) {
    throw new Error('Character skin index validation failed: expected { schema: 1, skins: [...] }')
  }
  const skins: CharacterSkinCatalogEntry[] = obj.skins.map((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Invalid skin catalog entry[${String(idx)}]`)
    }
    const rec = item as Record<string, unknown>
    if (typeof rec.id !== 'string' || !SKIN_ID_RE.test(rec.id)) {
      throw new Error(`Invalid skin catalog entry[${String(idx)}].id "${String(rec.id)}"`)
    }
    const name = validateLocalizedText(rec.name, `skins[${String(idx)}].name`)
    const description =
      rec.description !== undefined
        ? validateLocalizedText(rec.description, `skins[${String(idx)}].description`)
        : undefined
    const author = typeof rec.author === 'string' && rec.author.trim().length > 0 ? rec.author.trim() : undefined
    const targetClass = typeof rec.targetClass === 'string' ? rec.targetClass.trim().toLowerCase() : ''
    if (!(PLAYER_CLASS_TOKENS as readonly string[]).includes(targetClass)) {
      throw new Error(`Invalid skin catalog entry[${String(idx)}].targetClass "${String(rec.targetClass)}"`)
    }
    const manifestPath =
      rec.manifestPath !== undefined
        ? (() => {
            if (!isValidSkinRelativeFile(rec.manifestPath)) {
              throw new Error(`Invalid skin catalog entry[${String(idx)}].manifestPath`)
            }
            return rec.manifestPath.trim()
          })()
        : `${rec.id}/skin.json`
    const previewPath =
      rec.previewPath !== undefined && isValidSkinRelativeFile(rec.previewPath)
        ? rec.previewPath.trim()
        : undefined
    return {
      id: rec.id,
      name,
      ...(description !== undefined ? { description } : {}),
      ...(author !== undefined ? { author } : {}),
      targetClass: targetClass as PlayerClassToken,
      source: 'builtin',
      manifestPath,
      ...(previewPath !== undefined ? { previewPath } : {}),
    }
  })
  return { schema: 1, skins }
}

/**
 * Resolve the canonical 2-letter player class token (`'am'..'ai'`) for a player unit,
 * prioritizing `unitClassId` (`0..6`) so morphed players (e.g. Necromancer `classId = 2`
 * wearing full Trang-Oul's Avatar where `unitToken === 'tg'`) still resolve to `'ne'`.
 */
export function resolvePlayerClassTokenForUnit(
  unitClassId: number,
  unitToken: string,
): PlayerClassToken | null {
  if (Number.isInteger(unitClassId) && unitClassId >= 0 && unitClassId < PLAYER_CLASS_TOKENS.length) {
    return PLAYER_CLASS_TOKENS[unitClassId]!
  }
  const lower = unitToken.trim().toLowerCase()
  if ((PLAYER_CLASS_TOKENS as readonly string[]).includes(lower)) {
    return lower as PlayerClassToken
  }
  return null
}

/**
 * Determine whether an active character skin overrides a player's morph appearance
 * (such as Trang-Oul's Vampire `tg`, Werewolf `40`, Werebear `va`, or Fetish `fk`).
 */
export function shouldSkinOverrideMorph(
  manifest: Pick<CharacterSkinManifest, 'respectMorph'> | null | undefined,
  morphPolicy: CharacterSkinMorphPolicy,
): boolean {
  if (morphPolicy === 'keep-skin') return true
  if (morphPolicy === 'vanilla-morph') return false
  return !Boolean(manifest?.respectMorph)
}

/**
 * Resolve the best matching clip key inside a skin's `clips` dictionary for any of the
 * 18 canonical 1.13c player animation modes (`PlrMode.txt`), using class-aware fallbacks.
 */
export function resolveSkinClipKey(
  classToken: PlayerClassToken,
  requestedClip: string,
  clips: Readonly<Record<string, AnimClipMeta>>,
): string | null {
  const req = requestedClip.trim().toLowerCase()
  if (clips[req]) return req

  const isCaster = CASTER_CLASSES.has(classToken)
  const fallbackMap: Readonly<Record<string, readonly string[]>> = {
    nu: ['nu', 'tn', 'wl'],
    tn: ['tn', 'nu', 'wl'],
    wl: ['wl', 'tw', 'rn', 'nu'],
    tw: ['tw', 'wl', 'rn', 'tn', 'nu'],
    rn: ['rn', 'wl', 'tw', 'nu'],
    sc: ['sc', 's1', 's2', 'a1', 'nu'],
    s1: isCaster ? ['s1', 'sc', 's2', 'a1', 'nu'] : ['s1', 'a1', 'a2', 'sc', 'nu'],
    s2: isCaster ? ['s2', 'sc', 's1', 'a1', 'nu'] : ['s2', 's1', 'sc', 'a1', 'nu'],
    s3: isCaster ? ['s3', 'sc', 's1', 'a1', 'nu'] : ['s3', 's1', 'a1', 'sc', 'nu'],
    s4: isCaster ? ['s4', 'sc', 's1', 'a1', 'nu'] : ['s4', 's1', 'a2', 'a1', 'nu'],
    a1: ['a1', 'a2', 's1', 'sc', 'nu'],
    a2: ['a2', 'a1', 's1', 'sc', 'nu'],
    th: ['th', 'a1', 'sc', 'nu'],
    kk: ['kk', 'a1', 's1', 'nu'],
    bl: ['bl', 'gh', 'nu'],
    gh: ['gh', 'bl', 'nu'],
    dt: ['dt', 'dd', 'gh', 'nu'],
    dd: ['dd', 'dt', 'nu'],
  }

  const candidates = fallbackMap[req] ?? [req, isCaster ? 'sc' : 'a1', 'nu', 'tn', 'wl']
  for (const cand of candidates) {
    if (clips[cand]) return cand
  }
  const firstKey = Object.keys(clips)[0]
  return firstKey ?? null
}

/**
 * Multiplicative RGB tint equivalent of 1.13c hardware palette row shifts (`u_palette` rows 1..4)
 * for non-indexed 32-bit RGBA skin textures where `paletteRow` is `-1` in the shader:
 * - Row 1: Cold / Chilled blue shift
 * - Row 2: Poisoned green shift
 * - Row 3: Unique golden shift
 * - Row 4: Champion blue shift
 */
export function resolveRgbaPaletteRowTint(
  paletteRow: number | undefined,
): readonly [number, number, number] | null {
  if (paletteRow === 1) return [0.52, 0.72, 1.0]
  if (paletteRow === 2) return [0.48, 0.96, 0.52]
  if (paletteRow === 3) return [1.0, 0.88, 0.52]
  if (paletteRow === 4) return [0.65, 0.78, 1.0]
  return null
}

/**
 * Reverse lookup from `(ownerClassToken, monsterClassId)` to canonical minion key
 * (e.g. `('ne', 363) -> 'necroskeleton'`, `('ne', 289) -> 'claygolem'`).
 */
export function resolveMinionKeyForMonsterClassId(
  ownerClassToken: PlayerClassToken,
  monsterClassId: number,
): string | null {
  const map = SKINNABLE_MINIONS_BY_CLASS[ownerClassToken]
  if (!map) return null
  for (const [key, hcIdx] of Object.entries(map)) {
    if (hcIdx === monsterClassId) return key
  }
  return null
}

/**
 * Resolve the best matching clip key inside a minion skin's `clips` dictionary for any of the
 * 16 canonical 1.13c monster animation modes (`MonMode.txt`).
 */
export function resolveMinionClipKey(
  requestedClip: string,
  clips: Readonly<Record<string, AnimClipMeta>>,
): string | null {
  const req = requestedClip.trim().toLowerCase()
  if (clips[req]) return req

  const fallbackMap: Readonly<Record<string, readonly string[]>> = {
    nu: ['nu', 'wl'],
    wl: ['wl', 'nu'],
    rn: ['rn', 'wl', 'nu'],
    s1: ['s1', 'sc', 'nu', 'a1'],
    s2: ['s2', 'sc', 'a1', 'nu'],
    s3: ['s3', 'sc', 'a1', 'nu'],
    s4: ['s4', 'sc', 'a1', 'nu'],
    sc: ['sc', 'a1', 's1', 'nu'],
    a1: ['a1', 'a2', 'sc', 'nu'],
    a2: ['a2', 'a1', 'sc', 'nu'],
    xx: ['xx', 'a1', 'sc', 'nu'],
    gh: ['gh', 'nu'],
    bl: ['bl', 'gh', 'nu'],
    dt: ['dt', 'dd', 'gh', 'nu'],
    dd: ['dd', 'dt', 'nu'],
  }

  const candidates = fallbackMap[req] ?? [req, 'a1', 'nu', 'wl']
  for (const cand of candidates) {
    if (clips[cand]) return cand
  }
  const firstKey = Object.keys(clips)[0]
  return firstKey ?? null
}

export interface MinionSkinApplicabilityInput {
  readonly config: CharacterSkinRuntimeConfig
  readonly monsterClassId: number
  readonly ownerType: string | undefined
  readonly ownerId: number | undefined
  readonly localPlayerId: number | undefined
  readonly ownerClassToken: PlayerClassToken | null | undefined
  readonly isRevive?: boolean | undefined
}

/**
 * Pure 4-rule predicate deciding whether a monster unit should be rendered with its owner's
 * bundled summon skin (`minions` section):
 * 1. Skin plugin & `minionsEnabled` are both enabled.
 * 2. Monster is NOT a Revive (`State 96` preserves original monster appearance).
 * 3. Monster is player-owned (`ownerType === 'player'` with positive `ownerId`).
 * 4. Scope matches (`'self'` requires `ownerId === localPlayerId`; `'class'` allows any player
 *    whose resolved class has an active skin covering `monsterClassId`).
 */
export function shouldMinionSkinApply(
  input: MinionSkinApplicabilityInput,
): { readonly ownerClassToken: PlayerClassToken; readonly minionKey: string; readonly skinId: string } | null {
  const { config, monsterClassId, ownerType, ownerId, localPlayerId, ownerClassToken, isRevive } = input
  if (!config.enabled || !config.minionsEnabled) return null
  if (isRevive === true) return null
  if (ownerType !== 'player' || typeof ownerId !== 'number' || !(ownerId > 0)) return null
  if (config.scope === 'self') {
    if (localPlayerId === undefined || ownerId !== localPlayerId) return null
  }
  if (!ownerClassToken) return null
  const skinId = config.selectedByClass[ownerClassToken] ?? null
  if (!skinId) return null
  const minionKey = resolveMinionKeyForMonsterClassId(ownerClassToken, monsterClassId)
  if (!minionKey) return null
  return { ownerClassToken, minionKey, skinId }
}

/**
 * Resolve elemental additive glow RGB multiplier for Skeletal Mage (`necromage`, classId `364`)
 * per `D2Client.dll` `SKILLS_CltDo95_NecromageMissile` (`0x6FB088B0`, `compVariants[11]` = `S4`):
 * - `0`: Poison (`necromage1`)
 * - `1`: Cold (`necromage2`)
 * - `2`: Fire (`necromage3`)
 * - `3`: Lightning (`necromage4`)
 */
export function resolveNecromageElementGlowTint(
  compVariants: readonly number[] | undefined,
): readonly [number, number, number] {
  const elem = compVariants?.[11]
  if (elem === 0) return [0.35, 1.0, 0.38]
  if (elem === 1) return [0.42, 0.88, 1.0]
  if (elem === 2) return [1.0, 0.48, 0.18]
  if (elem === 3) return [1.0, 0.92, 0.42]
  return [0.76, 0.52, 1.0]
}
