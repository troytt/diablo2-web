/**
 * Character-select avatar compositor (Issue #926).
 *
 * The char list must show the saved equipment look (statstring components +
 * weapon class) exactly like the in-game paperdoll does. Instead of the
 * never-implemented `avatar-layers/*.png` baked-sprite convention, this module
 * reuses the runtime `SorceressLayerCompositor` with the shipped
 * `public/chars/<class>/` layer packs and the Act 1 palette
 * (`/act-packs/tiles/act1/palette.bin`), producing direction-0 TN frames as an
 * RGBA sheet the menu 2D context can blit. No new baked assets.
 */
import {
  SorceressLayerCompositor,
  type SorceressAppearanceSpec,
  type SorceressComponent,
  type LayerAppearance,
  type LayerTintSpec,
} from '../../common/units/char-appearance.ts'
import { decodePaletteBin } from '../../common/formats/pl2.ts'
import { getEmbeddedDropTables } from '../../common/items/embedded-drop-tables.ts'
import type { ParsedMcpAvatarStatstring } from './statstring-avatar.ts'

export interface AvatarCompositeFrame {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly anchorX: number
  readonly anchorY: number
}

export interface AvatarComposite {
  /** Full composited sheet in RGBA form, ready for `drawImage` subrect blits. */
  readonly sheet: HTMLCanvasElement
  /** Direction-0 (South) TN frames in animation order. */
  readonly frames: readonly AvatarCompositeFrame[]
}

const PALETTE_URL_CANDIDATES = [
  '/act-packs/tiles/act1/palette.bin',
]

const isBrowser =
  typeof document !== 'undefined' &&
  typeof document.createElement === 'function' &&
  typeof fetch !== 'undefined'

const inflight = new Map<string, Promise<AvatarComposite | null>>()
const ready = new Map<string, AvatarComposite>()
const compositorsByClass = new Map<string, SorceressLayerCompositor>()
let palettePromise: Promise<Uint8Array | null> | null = null
/** Class retained after entering the game; `null` while the menu still needs every slot. */
let retainedClassToken: string | null = null

function keyClassToken(key: string): string {
  const sep = key.indexOf(':')
  return (sep > 0 ? key.slice(0, sep) : key).toLowerCase()
}

/**
 * Return the process-wide shared `SorceressLayerCompositor` for a hero class token (`'am'`, `'so'`, `'ne'`, `'pa'`, `'ba'`, `'dz'`, `'ai'`).
 * Shared between the character-select 2D avatar compositor and the in-game `PlayerPaperdollGpuCache`
 * so `manifest.json`, `meta.bin`, and layer `.bin` files fetched in the lobby are already in memory in-game.
 */
export function getSharedClassLayerCompositor(heroToken: string): SorceressLayerCompositor {
  const key = heroToken.toLowerCase()
  let compositor = compositorsByClass.get(key)
  if (!compositor) {
    compositor = new SorceressLayerCompositor('', key as never)
    compositorsByClass.set(key, compositor)
  }
  return compositor
}

function getOrCreateAvatarCompositor(heroToken: string): SorceressLayerCompositor {
  return getSharedClassLayerCompositor(heroToken)
}

async function loadAct1Palette(): Promise<Uint8Array | null> {
  for (const url of PALETTE_URL_CANDIDATES) {
    try {
      const resp = await fetch(url)
      if (!resp.ok) continue
      const bytes = new Uint8Array(await resp.arrayBuffer())
      if (bytes.byteLength < 768) continue
      // `palette.bin` ships packed (e.g. 13,056-byte 17-row form) — the same
      // decodePaletteBin the world renderer's setPalette uses yields the base
      // 768-byte RGB triplets (row 0 = normal Act palette).
      return decodePaletteBin(bytes).rgb
    } catch {
      // try next candidate
    }
  }
  return null
}

function ensurePalette(): Promise<Uint8Array | null> {
  if (palettePromise === null) palettePromise = loadAct1Palette()
  return palettePromise
}

/**
 * Build a compositor spec straight from the parsed MCP statstring: component
 * variant tokens become layer variants, `weaponClass` picks the TN COF family
 * (`<CLASS>TN<WCLASS>`), unequipped slots stay `null`.
 *
 * Dye tints: the statstring's `[14..24]` per-component color bytes (already
 * parsed into `equippedLayers[].colorCode`, a `Colors.txt` code) are wired into
 * the layer specs so the char-select paperdoll matches the in-game one — a set
 * (e.g. Tal Rasha's dpur armor) no longer renders as its undyed base graphic.
 * `transform` mirrors `getLayerTint`'s per-slot fallbacks (hd 5, torso group 7,
 * shield/hands 1): the same tables the in-game paperdoll uses when Armor.txt
 * declares no explicit transform for the base item.
 */
export function buildAvatarSpecFromStatstring(
  heroToken: string,
  desc: ParsedMcpAvatarStatstring,
): SorceressAppearanceSpec {
  const colorByComponent = new Map<string, string>()
  for (const equipped of desc.equippedLayers) {
    if (equipped.colorCode) colorByComponent.set(equipped.component, equipped.colorCode)
  }
  // Per-component palette table: the statstring carries one dye byte per
  // component (the torso dye rides on TR alone). The dye's transform table
  // number comes from the BASE item (Armor.txt / Weapons.txt Transform @+0x141) —
  // the statstring component token IS the base's alternategfx, so resolve it the
  // same way `resolveCharacterAppearance` does in-game. Dyes with Transform 0
  // stay undyed, exactly like the in-game paperdoll (Lacquered Plate gth = 8,
  // Death Mask msk = 1, Swirling Crystal ob4 = 5; measured from 1.13c Armor.txt/Weapons.txt).
  let transformByGfx: Map<string, number> | null = null
  const resolveTransform = (token: string): number => {
    if (transformByGfx === null) {
      transformByGfx = new Map<string, number>()
      const tables = getEmbeddedDropTables()
      for (const base of tables.armor.all) {
        const gfx = base.alternategfx?.toLowerCase()
        const tf = base.transform ?? 0
        if (gfx && tf > 0 && !transformByGfx.has(gfx)) transformByGfx.set(gfx, tf)
      }
      for (const base of tables.weapons.all) {
        const gfx = base.alternateGfx?.toLowerCase() ?? base.code.toLowerCase()
        const tf = base.transform ?? 0
        if (gfx && tf > 0 && !transformByGfx.has(gfx)) transformByGfx.set(gfx, tf)
      }
    }
    return transformByGfx.get(token) ?? 0
  }
  // The BNCS statstring encodes the TORSO (and limb/shoulder) components as the
  // armor CLASS gfx tokens ('lit'/'med'/'hvy'), not the specific base's
  // alternategfx (vanilla char select also renders the generic class torso).
  // Class tokens ('lit'/'med'/'hvy') are not in Armor.txt and use remap table 5
  // (greybrown.dat); specific tokens (helm 'msk' -> 1, armor 'gth' -> 8, weapon 'ob4' -> 5)
  // resolve their real Transform (+0x141) from the base tables.
  const TORSO_CLASS_TOKEN_TRANSFORM: ReadonlyMap<string, number> = new Map([
    ['lit', 5],
    ['med', 5],
    ['hvy', 5],
  ])
  const layer = (token: string | undefined, comp: SorceressComponent): LayerAppearance => {
    if (!token || token === 'nil') return { variant: null, transform: 0, color: null }
    const color = colorByComponent.get(comp.toUpperCase()) ?? null
    let transform = 0
    if (color !== null) {
      if (comp !== 'hd' && comp !== 'rh' && comp !== 'lh' && comp !== 'sh' && TORSO_CLASS_TOKEN_TRANSFORM.has(token)) {
        transform = TORSO_CLASS_TOKEN_TRANSFORM.get(token)!
      } else {
        transform = resolveTransform(token)
      }
    }
    return transform > 0 ? { variant: token, transform, color } : { variant: token, transform: 0, color: null }
  }
  const c = desc.components
  const layers = {
    hd: layer(c.HD, 'hd'),
    tr: layer(c.TR, 'tr'),
    lg: layer(c.LG, 'lg'),
    ra: layer(c.RA, 'ra'),
    la: layer(c.LA, 'la'),
    rh: layer(c.RH, 'rh'),
    lh: layer(c.LH, 'lh'),
    sh: layer(c.SH, 'sh'),
    s1: layer(c.S1, 's1'),
    s2: layer(c.S2, 's2'),
  } as Record<SorceressComponent, LayerAppearance>
  // Spec-level tints mirror the in-game construction: each tint is the layer's
  // own {transform, color}; getLayerTint then propagates armorTint onto the
  // whole torso group (tr/lg/ra/la/s1/s2), exactly like resolveCharacterAppearance.
  const specTint = (l: LayerAppearance): LayerTintSpec | null =>
    l.transform > 0 && l.color ? { transform: l.transform, color: l.color } : null
  return {
    classToken: heroToken as SorceressAppearanceSpec['classToken'],
    wclass: desc.weaponClass,
    layers,
    helmTint: specTint(layers.hd),
    armorTint: specTint(layers.tr),
    shieldTint: specTint(layers.sh),
    weaponTint: specTint(layers.rh) ?? specTint(layers.lh),
  }
}

async function compositeAvatar(
  heroToken: string,
  desc: ParsedMcpAvatarStatstring,
): Promise<AvatarComposite | null> {
  if (!isBrowser) return null
  const palette = await ensurePalette()
  if (!palette) return null
  const compositor = getOrCreateAvatarCompositor(heroToken)
  const spec = buildAvatarSpecFromStatstring(heroToken, desc)
  // Char select only ever shows the TN clip — compositing the full in-game mode
  // set costs ~13x more DCC decode time (measured 36s for a paladin) and the
  // menu can't wait for that.
  const composited = await compositor.composite(spec, ['tn'], { directions: [0] })
  const tnClip = composited.clips.tn
  if (!tnClip) return null
  // Direction 0 (dir64=0 → straight South towards camera), matching the baked
  // char-<class>-tn.png strips from pack-frontend-ui.
  const group = composited.groups[tnClip.group + 0]
  if (!group || group.length === 0) return null

  const sheet = document.createElement('canvas')
  sheet.width = composited.width
  sheet.height = composited.height
  const sctx = sheet.getContext('2d')
  if (!sctx) return null
  const image = sctx.createImageData(composited.width, composited.height)
  const rgba = image.data
  const r8 = composited.r8
  for (let i = 0; i < r8.length; i++) {
    const idx = r8[i]!
    const o = i * 4
    if (idx === 0) {
      rgba[o + 3] = 0
      continue
    }
    rgba[o] = palette[idx * 3]!
    rgba[o + 1] = palette[idx * 3 + 1]!
    rgba[o + 2] = palette[idx * 3 + 2]!
    rgba[o + 3] = 255
  }
  sctx.putImageData(image, 0, 0)
  return {
    sheet,
    frames: group.map(([x, y, w, h, anchorX, anchorY]) => ({ x, y, w, h, anchorX, anchorY })),
  }
}

function cacheKey(heroToken: string, desc: ParsedMcpAvatarStatstring): string {
  return `${heroToken}:${desc.cofSignature}`
}

/**
 * Kick (and cache by class + statstring signature) the composite for a roster
 * character. Resolves to `null` outside the browser or when the layer packs /
 * palette cannot be fetched — callers keep the baked naked strip as fallback.
 */
export function ensureAvatarComposite(
  heroToken: string,
  desc: ParsedMcpAvatarStatstring,
): Promise<AvatarComposite | null> {
  const key = cacheKey(heroToken, desc)
  const done = ready.get(key)
  if (done) return Promise.resolve(done)
  let pending = inflight.get(key)
  if (!pending) {
    pending = compositeAvatar(heroToken, desc)
      .catch(() => null)
      .then((composite) => {
        inflight.delete(key)
        // Do not latch a null result: a transient fetch failure must be
        // retriable by the next render frame instead of pinning the menu to
        // the naked strip until reload. A composite that was still streaming
        // when the game started is dropped if its class is no longer retained.
        if (composite && (retainedClassToken === null || keyClassToken(key) === retainedClassToken)) {
          ready.set(key, composite)
        }
        return composite
      })
    inflight.set(key, pending)
  }
  return pending
}

/** Synchronous peek for render-time blits; `undefined` while still loading. */
export function getReadyAvatarComposite(
  heroToken: string,
  desc: ParsedMcpAvatarStatstring,
): AvatarComposite | undefined {
  return ready.get(cacheKey(heroToken, desc))
}

/**
 * Drop the other six classes' TN canvases and layer-pack compositors once the
 * player has entered the game (#1317). Only the selected hero needs to stay
 * warm; the rest re-stream if the player returns to character select.
 */
export function releaseUnselectedAvatarComposites(heroToken: string): void {
  const keep = heroToken.trim().toLowerCase()
  if (keep.length === 0) return
  retainedClassToken = keep
  for (const key of [...ready.keys()]) {
    if (keyClassToken(key) !== keep) ready.delete(key)
  }
  for (const key of [...inflight.keys()]) {
    if (keyClassToken(key) !== keep) inflight.delete(key)
  }
  for (const key of [...compositorsByClass.keys()]) {
    if (key !== keep) compositorsByClass.delete(key)
  }
}
