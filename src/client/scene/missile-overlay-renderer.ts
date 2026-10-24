import {
  getMissileTxtData,
} from '../../common/skills/missiles-data.ts'
import type { AtlasFrame } from '../render/atlas.ts'
import {
  MISSILE_METAS,
  velocityToDccDirection,
  type MissileFrameTuple,
  type MissileMeta,
} from '../render/missiles-meta.ts'
import {
  OVERLAY_METAS,
  type OverlayMeta,
} from '../render/overlays-meta.ts'
import type {
  AtlasHandle,
  SpriteRenderer,
} from '../render/renderer.ts'
import { reportMissingArt } from './world-renderer.ts'
import { celFileArtKey } from '../render/cel-file-key.ts'

export {
  MISSILE_METAS,
  OVERLAY_METAS,
  getMissileTxtData,
  velocityToDccDirection,
  type MissileFrameTuple,
  type MissileMeta,
  type OverlayMeta,
}

/**
 * Packed missile animation asset loaded into GPU memory.
 */
export interface LoadedMissileArt {
  readonly meta: MissileMeta
  readonly handle: AtlasHandle
  readonly frames: AtlasFrame[][]
}

/**
 * Packed overlay animation asset loaded into GPU memory.
 */
export interface LoadedOverlayArt {
  readonly meta: OverlayMeta
  readonly handle: AtlasHandle
  readonly frames: AtlasFrame[][]
}

interface PackedSpriteMetaBase {
  readonly name: string
  readonly celFile?: string | undefined
  readonly width: number
  readonly height: number
  readonly groups: readonly (readonly MissileFrameTuple[])[]
}

async function loadPackedSpriteArtMap<M extends PackedSpriteMetaBase>(options: {
  readonly label: string
  readonly subdir: 'missiles' | 'overlays'
  readonly metas: Readonly<Record<string, M>>
  readonly renderer: SpriteRenderer
  readonly packBase?: string | undefined
  readonly filterTarget?: ((meta: M) => boolean) | undefined
  readonly extraStems?: ((name: string, metaHint: M | undefined) => readonly string[]) | undefined
  readonly overrideNameOnStemMismatch?: boolean | undefined
  readonly fallbackAliasKey?: ((meta: M, map: ReadonlyMap<string, { readonly meta: M; readonly handle: AtlasHandle; readonly frames: AtlasFrame[][] }>) => { readonly meta: M; readonly handle: AtlasHandle; readonly frames: AtlasFrame[][] } | undefined) | undefined
}): Promise<Map<string, { readonly meta: M; readonly handle: AtlasHandle; readonly frames: AtlasFrame[][] }>> {
  type ArtEntry = { readonly meta: M; readonly handle: AtlasHandle; readonly frames: AtlasFrame[][] }
  const map = new Map<string, ArtEntry>()
  if (typeof fetch === 'undefined' || typeof createImageBitmap === 'undefined') return map
  const allMetas = Object.values(options.metas)
  const filteredMetas = options.filterTarget ? allMetas.filter(options.filterTarget) : allMetas
  const targets = Array.from(new Set(filteredMetas.map(m => m.name.toLowerCase())))
  const cleanBase = options.packBase ? options.packBase.replace(/\/+$/, '') : ''
  const baseCandidates = [
    `/${options.subdir}`,
    cleanBase ? `${cleanBase}/${options.subdir}` : '',
  ].filter(Boolean)

  const failures: string[] = []

  await Promise.all(
    targets.map(async name => {
      let loaded = false
      let lastReason = ''
      const metaHint = options.metas[name]
      const extra = options.extraStems ? options.extraStems(name, metaHint) : []
      const candidateStems = Array.from(
        new Set(
          [name.toLowerCase(), metaHint?.celFile?.toLowerCase() ?? '', ...extra].filter(
            (s): s is string => Boolean(s) && s !== 'null',
          ),
        ),
      )
      for (const base of baseCandidates) {
        for (const stem of candidateStems) {
          try {
            const [jsonResp, pngResp] = await Promise.all([
              fetch(`${base}/${stem}.json`),
              fetch(`${base}/${stem}.png`),
            ])
            if (jsonResp.ok && pngResp.ok) {
              const rawMeta = (await jsonResp.json()) as M
              const meta: M =
                options.overrideNameOnStemMismatch && metaHint && stem !== name
                  ? { ...rawMeta, name }
                  : rawMeta
              const blob = await pngResp.blob()
              const bitmap = await createImageBitmap(blob)
              let handle: AtlasHandle
              try {
                handle = options.renderer.addAtlas(bitmap, meta.width, meta.height)
              } finally {
                bitmap.close()
              }
              const frames: AtlasFrame[][] = meta.groups.map((group: readonly MissileFrameTuple[]) =>
                group.map(([x, y, width, height, anchorX, anchorY]: MissileFrameTuple) => ({
                  x,
                  y,
                  width,
                  height,
                  ...(anchorX !== undefined ? { anchorX } : {}),
                  ...(anchorY !== undefined ? { anchorY } : {}),
                })),
              )
              const art: ArtEntry = { meta, handle, frames }
              map.set(name, art)
              map.set(name.toLowerCase(), art)
              if (extra.includes(stem)) {
                map.set(stem, art)
                map.set(stem.toLowerCase(), art)
              }
              if (meta.celFile) {
                // Missiles.txt / Overlay.txt name the DCC with '\' (Issue #1043): one normalised key for both sides.
                map.set(celFileArtKey(meta.celFile), art)
              }
              loaded = true
              break
            }
            lastReason = `${base}/${stem}.json (HTTP ${jsonResp.status}), ${base}/${stem}.png (HTTP ${pngResp.status})`
          } catch (err) {
            lastReason = `${base}/${stem}: ${err instanceof Error ? err.message : String(err)}`
          }
        }
        if (loaded) break
      }
      if (!loaded) {
        failures.push(`${name} [${lastReason || `tried: ${baseCandidates.join(', ')}`}]`)
      }
    }),
  )

  if (failures.length > 0) {
    console.error(
      `[${options.label}] ${failures.length} ${options.subdir.slice(0, -1)} atlas(es) unavailable (loaded ${map.size} keys): ${failures.slice(0, 8).join('; ')}`,
    )
  }

  for (const [alias, meta] of Object.entries(options.metas)) {
    const art =
      (meta.celFile ? map.get(celFileArtKey(meta.celFile)) : undefined) ??
      map.get(meta.name) ??
      map.get(meta.name.toLowerCase()) ??
      options.fallbackAliasKey?.(meta, map)
    if (art) {
      map.set(alias, art)
      map.set(alias.toLowerCase(), art)
    }
  }

  for (const meta of Object.values(options.metas)) {
    if (!meta.celFile) continue
    const art = map.get(celFileArtKey(meta.celFile))
    if (art) {
      if (!map.has(meta.celFile)) map.set(meta.celFile, art)
      if (!map.has(meta.celFile.toLowerCase())) map.set(meta.celFile.toLowerCase(), art)
    }
  }

  return map
}

/**
 * Load authentic 1.13c baked missile atlases from /missiles/*.png or packBase.
 */
export async function loadMissileArtMap(
  renderer: SpriteRenderer,
  packBase?: string,
): Promise<Map<string, LoadedMissileArt>> {
  return loadPackedSpriteArtMap<MissileMeta>({
    label: 'loadMissileArtMap',
    subdir: 'missiles',
    metas: MISSILE_METAS,
    renderer,
    packBase,
    overrideNameOnStemMismatch: true,
  })
}

/**
 * Load authentic 1.13c baked cast overlay atlases from /overlays/*.png or packBase.
 */
export async function loadOverlayArtMap(
  renderer: SpriteRenderer,
  packBase?: string,
): Promise<Map<string, LoadedOverlayArt>> {
  return loadPackedSpriteArtMap<OverlayMeta>({
    label: 'loadOverlayArtMap',
    subdir: 'overlays',
    metas: OVERLAY_METAS,
    renderer,
    packBase,
    overrideNameOnStemMismatch: true,
    filterTarget: m => m.celFile?.toLowerCase() !== 'null',
    extraStems: name => (name.toLowerCase() === 'cursecast' ? ['curse_hit'] : []),
    fallbackAliasKey: (meta, map) =>
      meta.name.toLowerCase() === 'cursecast' ? map.get('curse_hit') : undefined,
  })
}

/**
 * Render an active Diablo II 1.13c Town Portal (`Objects.txt` ID 59, Token `TP`):
 * - Plays 15-frame opening sequence (`OP`: `tptrlitophth` + `tphdlitophth`) at 200/256 * 25 fps (51.2 ms/frame, 768 ms total),
 *   then loops 15-frame operating sequence (`ON`: `tptrlitonhth` + `tphdlitonhth`).
 * - Draws `TR` ground shadow layer with normal blending and `HD` blue vortex layer with additive blending.
 */
export function drawTownPortal(
  renderer: SpriteRenderer,
  x: number,
  y: number,
  elapsedMs: number,
  overlayArtMap: ReadonlyMap<string, LoadedOverlayArt>,
  mode = 1,
): void {
  const frameDurationMs = 51.2 // 1000 / (25 * 200 / 256)
  const openDurationMs = 15 * frameDurationMs // 768 ms
  const isOpening = mode !== 2 && elapsedMs < openDurationMs
  const trArt = overlayArtMap.get(isOpening ? 'town_portal_op_tr' : 'town_portal_on_tr')
  const hdArt = overlayArtMap.get(isOpening ? 'town_portal_op_hd' : 'town_portal_on_hd')
  const onElapsedMs = mode === 2 ? elapsedMs : elapsedMs - openDurationMs
  const rawFrameIdx = isOpening
    ? Math.min(14, Math.max(0, Math.floor(elapsedMs / frameDurationMs)))
    : Math.max(0, Math.floor(onElapsedMs / frameDurationMs)) % 15

  let drewSprite = false
  if (trArt !== undefined) {
    const group = trArt.frames[0]
    const frame = group?.[rawFrameIdx] ?? group?.[0]
    if (frame !== undefined) {
      const drawX = frame.anchorX !== undefined ? x + frame.anchorX : x - frame.width / 2
      const drawY = frame.anchorY !== undefined ? y + frame.anchorY : y - frame.height / 2
      renderer.draw(frame, drawX, drawY, {
        atlas: trArt.handle,
        blendMode: 'trans25',
      })
      drewSprite = true
    }
  }
  if (hdArt !== undefined) {
    const group = hdArt.frames[0]
    const frame = group?.[rawFrameIdx] ?? group?.[0]
    if (frame !== undefined) {
      const drawX = frame.anchorX !== undefined ? x + frame.anchorX : x - frame.width / 2
      const drawY = frame.anchorY !== undefined ? y + frame.anchorY : y - frame.height / 2
      renderer.draw(frame, drawX, drawY, {
        atlas: hdArt.handle,
        blendMode: 'additive',
        elevationY: Math.max(0, frame.height - 16),
      })
      renderer.setBlendMode('normal')
      drewSprite = true
    }
  }
  if (!drewSprite) {
    reportMissingArt(
      'overlay',
      isOpening ? 'town_portal_op' : 'town_portal_on',
      'Missing town portal sprite atlas in overlayArtMap',
    )
  }
}
