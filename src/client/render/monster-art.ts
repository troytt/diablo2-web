/**
 * Runtime monster atlas loader + re-exports of pure monster layer compositing from `src/common/units/monster-art.ts`.
 */
import type { MountedArchives } from '../../common/mpq/mount.ts'
import type { SpriteGroup, SpriteSheet } from '../../common/formats/sprite.ts'
import {
  ADDITIVE_MONSTER_TOKENS,
  MONSTER_COMPONENTS,
  cofLayerDrawModeAlphaByte,
  compositeMonsterAnimation as compositeCommonMonsterAnimation,
  findMonsterLayerSprite,
  resolveCofLayerDrawMode,
  type CofLayerDrawBlendMode,
  type MonsterAnimationSheet,
  type MonsterLayerFailure,
} from '../../common/units/monster-art.ts'
import { buildIndexedAtlas, type AtlasFrame } from './atlas.ts'
import type { AtlasHandle, SpriteRenderer } from './renderer.ts'
import type { Palette } from '../../common/formats/pal.ts'
import type { AnimClipMeta } from '../../common/units/unit-types.ts'

export {
  ADDITIVE_MONSTER_TOKENS,
  MONSTER_COMPONENTS,
  cofLayerDrawModeAlphaByte,
  findMonsterLayerSprite,
  resolveCofLayerDrawMode,
  type CofLayerDrawBlendMode,
  type MonsterAnimationSheet,
  type MonsterLayerFailure,
}

export async function compositeMonsterAnimation(
  archives: MountedArchives,
  token: string,
  animation: string,
  weapon = 'hth',
): Promise<MonsterAnimationSheet> {
  const res = await compositeCommonMonsterAnimation(archives, token, animation, weapon)
  for (const f of res.layerFailures) {
    console.error(
      `[monster-art] ${f.token}/${f.animation} dropped layer ${f.component} (${f.reason})${f.member ? `: ${f.member}` : ''}${f.message ? ` — ${f.message}` : ''}`,
    )
  }
  return res
}

export interface LoadedMonsterArt {
  readonly token: string
  readonly handle: AtlasHandle
  readonly groups: readonly (readonly AtlasFrame[])[]
  readonly glowGroups?: readonly (readonly AtlasFrame[])[]
  readonly blendMode?: CofLayerDrawBlendMode
  readonly directions: number
  readonly walkOffset: number
  readonly standOffset: number
  readonly walkFrames: number
  readonly standFrames: number
  readonly clips?: Readonly<Record<string, AnimClipMeta>>
  readonly glowClips?: Readonly<Record<string, AnimClipMeta>>
  readonly scale?: number
  readonly layerFailures: readonly MonsterLayerFailure[]
}

/**
 * Load and composite a monster's walk and neutral sprite sheets, packing them into an 8-bit R8 atlas.
 */
export async function loadMonsterAtlas(
  archives: MountedArchives,
  token: string,
  weapon: string,
  _palette: Palette,
  renderer: SpriteRenderer,
): Promise<LoadedMonsterArt> {
  const [walk, stand] = await Promise.all([
    compositeMonsterAnimation(archives, token, 'wl', weapon),
    compositeMonsterAnimation(archives, token, 'nu', weapon),
  ])

  const hasGlow = walk.glowSheet !== undefined || stand.glowSheet !== undefined
  const baseGroups = [...walk.sheet.groups, ...stand.sheet.groups]
  const baseCount = baseGroups.length

  const blendMode: CofLayerDrawBlendMode =
    walk.blendMode && walk.blendMode !== 'normal'
      ? walk.blendMode
      : stand.blendMode ?? 'normal'

  let combined: SpriteSheet
  if (hasGlow) {
    const makeEmptyGlowGroups = (sheet: SpriteSheet): SpriteGroup[] =>
      sheet.groups.map(g => ({
        frames: g.frames.map(f => ({
          width: 1,
          height: 1,
          indices: new Uint8Array(1),
          mask: new Uint8Array(1),
          ...(f.anchorX !== undefined ? { anchorX: f.anchorX } : {}),
          ...(f.anchorY !== undefined ? { anchorY: anchorYOf(f) } : {}),
        })),
      }))
    const walkGlow = walk.glowSheet?.groups ?? makeEmptyGlowGroups(walk.sheet)
    const standGlow = stand.glowSheet?.groups ?? makeEmptyGlowGroups(stand.sheet)
    const allGlowGroups = [...walkGlow, ...standGlow]
    combined = {
      groups: [...baseGroups, ...allGlowGroups],
      width: null,
    }
  } else {
    combined = {
      groups: baseGroups,
      width: null,
    }
  }

  const atlas = buildIndexedAtlas(combined, undefined, { width: 1024 })
  const handle = renderer.addIndexedAtlas(atlas.r8, atlas.width, atlas.height)

  const groups = atlas.groups.slice(0, baseCount)
  const glowGroups = hasGlow ? atlas.groups.slice(baseCount) : undefined

  return {
    token,
    handle,
    groups,
    ...(glowGroups !== undefined ? { glowGroups } : {}),
    blendMode,
    directions: walk.directions,
    walkOffset: 0,
    standOffset: walk.sheet.groups.length,
    walkFrames: walk.framesPerDirection,
    standFrames: stand.framesPerDirection,
    layerFailures: [...walk.layerFailures, ...stand.layerFailures],
  }
}

function anchorYOf(f: { anchorY?: number | undefined }): number {
  return f.anchorY ?? 0
}
