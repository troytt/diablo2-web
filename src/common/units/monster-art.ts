/**
 * Pure COF + DCC layer resolution and compositing for Diablo II monster animations.
 */
import type { MountedArchives } from '../mpq/mount.ts'
import { decodeCof, cofLayerOrder } from '../formats/cof.ts'
import type { CofFile } from '../formats/cof.ts'
import { decodeDc6 } from '../formats/dc6.ts'
import type { Dc6Frame, Dc6Sheet } from '../formats/dc6.ts'
import { decodeDcc } from '../formats/dcc.ts'
import type { DccDirection, DccFile, DccFrame } from '../formats/dcc.ts'
import type { SpriteFrame, SpriteSheet } from '../formats/sprite.ts'
import { dir64ToDcc } from './character.ts'

/** Composite type index -> component folder name in MPQ archives. */
export const MONSTER_COMPONENTS: readonly string[] = [
  'hd', 'tr', 'lg', 'ra', 'la', 'rh', 'lh', 'sh',
  's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'
]

/**
 * Canonical 1.13c monster animation modes baked for full-spectrum monster & Town NPC packs.
 */
export const TARGET_MONSTER_MODES = [
  'wl', 'nu', 'rn', 'a1', 'a2', 'sc', 'gh', 'dt', 'dd',
  's1', 's2', 's3', 's4', 'on', 'op',
  // MonMode 6 `BL` (block). Appended so existing group offsets stay stable;
  // MonStats2 `mBL` is set for e.g. Diablo and `DIBLHTH.cof` ships in d2data.mpq.
  'bl',
] as const

/**
 * Canonical 1.13c object animation modes (`objmode.txt` / `Objects.txt` Mode0..Mode7).
 */
export const TARGET_OBJECT_MODES = [
  'nu', 'op', 'on', 's1', 's2', 's3', 's4', 's5',
] as const

/**
 * Tokens of monsters that require additive blending for their ghostly or energy appearance.
 */
export const ADDITIVE_MONSTER_TOKENS: ReadonlySet<string> = new Set([
  'WR', 'WW', 'FR', 'K9', '17', '46', 'FI', 'X3', 'X4', 'XW',
])

interface ArchiveFileIndex {
  readonly allFiles: readonly string[]
  readonly byLower: ReadonlyMap<string, string>
  readonly byRootPrefix: ReadonlyMap<string, readonly string[]>
}

const archiveIndexCache = new WeakMap<MountedArchives, Promise<ArchiveFileIndex>>()

async function getArchiveFileIndex(archives: MountedArchives): Promise<ArchiveFileIndex> {
  let promise = archiveIndexCache.get(archives)
  if (!promise) {
    promise = (async () => {
      const allFiles = await archives.listFiles()
      const byLower = new Map<string, string>()
      const byRootPrefix = new Map<string, string[]>()
      for (const name of allFiles) {
        const lower = name.toLowerCase()
        if (!byLower.has(lower)) {
          byLower.set(lower, name)
        }
        if (lower.startsWith('data\\global\\monsters\\') || lower.startsWith('data\\global\\objects\\')) {
          const parts = lower.split('\\')
          if (parts.length >= 4) {
            const rootKey = `${parts[0]}\\${parts[1]}\\${parts[2]}\\${parts[3]}\\`
            let list = byRootPrefix.get(rootKey)
            if (!list) {
              list = []
              byRootPrefix.set(rootKey, list)
            }
            list.push(name)
          }
        }
      }
      return { allFiles, byLower, byRootPrefix }
    })()
    archiveIndexCache.set(archives, promise)
  }
  return promise
}

/**
 * Find the DCC or DC6 sprite member for a specific monster/object COF layer.
 */
export function findMonsterLayerSprite(
  names: readonly string[],
  root: string,
  token: string,
  animation: string,
  weapon: string,
  component: string,
  layerWeaponClass?: string,
  /** MonStats2 `<comp>v` token to composite (e.g. `pos`); when set only that exact variant member matches. */
  variant?: string,
): string | undefined {
  const prefix = `${root}${component}\\${token}${component}`.toLowerCase()
  const weapons = Array.from(new Set([layerWeaponClass, weapon, 'hth'].filter((w): w is string => Boolean(w))))
  const anims = animation.toLowerCase() === 'wl' ? ['wl', 'nu'] : [animation.toLowerCase()]

  for (const ext of ['.dcc', '.dc6']) {
    for (const anim of anims) {
      for (const w of weapons) {
        const suffix = `${anim}${w.toLowerCase()}${ext}`
        if (variant !== undefined) {
          const exact = `${prefix}${variant.toLowerCase()}${suffix}`
          const hit = names.find(name => name.toLowerCase() === exact)
          if (hit !== undefined) return hit
          continue
        }
        const hits = names.filter(name => {
          const lowerName = name.toLowerCase()
          return lowerName.startsWith(prefix) && lowerName.endsWith(suffix)
        })
        if (hits.length > 0) {
          hits.sort()
          return hits[0]
        }
      }
    }
  }
  return undefined
}

export type CofLayerDrawBlendMode =
  | 'normal'
  | 'trans25'
  | 'trans50'
  | 'trans75'
  | 'additive'

/**
 * Resolve a COF layer's draw blend mode per 1.13c `D2Client.dll` `GetLayerDrawMode` (`0x6FB6CB70`)
 * and `D2Gfx.dll` `eDrawMode` (`sub_6F61A100`):
 * - COF byte `+0x03` (`layer.transparent` / `bTransOverride`) indicates whether byte `+0x04`
 *   (`layer.drawEffect` / `nDrawEffect`) overrides the unit's default `Trans` draw mode.
 * - When `layer.transparent` is true, `layer.drawEffect` maps as `eDrawMode`:
 *   `0 -> 'trans25'`, `1 -> 'trans50'`, `2 -> 'trans75'`, `3 -> 'additive'`, `4 -> 'normal'` (multiply), `5 -> 'normal'`.
 * - When `layer.transparent` is false, returns `unitDefaultDrawMode`.
 */
export function resolveCofLayerDrawMode(
  layer: Pick<CofFile['layers'][number], 'transparent' | 'drawEffect'> | undefined,
  unitDefaultDrawMode: CofLayerDrawBlendMode = 'normal',
): CofLayerDrawBlendMode {
  if (!layer || !layer.transparent) {
    return unitDefaultDrawMode
  }
  switch (layer.drawEffect) {
    case 0:
      return 'trans25'
    case 1:
      return 'trans50'
    case 2:
      return 'trans75'
    case 3:
      return 'additive'
    case 4:
    case 5:
      return 'normal'
    default:
      return unitDefaultDrawMode
  }
}

export function cofLayerDrawModeAlphaByte(mode: CofLayerDrawBlendMode): number {
  switch (mode) {
    case 'trans25':
      return 64
    case 'trans50':
      return 128
    case 'trans75':
      return 192
    default:
      return 255
  }
}

/**
 * Masked blit of a layer frame onto a combined canvas frame.
 */
function blit(
  target: { indices: Uint8Array; mask: Uint8Array; width: number; height: number },
  source: SpriteFrame,
  atX: number,
  atY: number,
  alphaByte = 255,
  occludeGlowTarget: { indices: Uint8Array; mask: Uint8Array } | null = null,
): void {
  for (let y = 0; y < source.height; y += 1) {
    const ty = atY + y
    if (ty < 0 || ty >= target.height) continue
    for (let x = 0; x < source.width; x += 1) {
      const at = y * source.width + x
      if (source.mask[at] === 0) continue
      const tx = atX + x
      if (tx < 0 || tx >= target.width) continue
      const to = ty * target.width + tx
      const srcIdx = source.indices[at]!
      if (alphaByte < 255 && (srcIdx === 0 || srcIdx === 172)) {
        continue
      }
      target.indices[to] = srcIdx
      target.mask[to] = Math.max(target.mask[to]!, alphaByte)
      if (alphaByte === 255 && occludeGlowTarget !== null) {
        occludeGlowTarget.indices[to] = 0
        occludeGlowTarget.mask[to] = 0
      }
    }
  }
}

/**
 * Adapts a decoded DC6 sprite sheet into a DccFile-compatible directional structure
 * so COF layer compositing handles both .dcc and .dc6 layers identically.
 */
export function dc6ToDccFile(
  sheet: Dc6Sheet,
  cofDirections = sheet.header.directions,
  cofFramesPerDir = sheet.header.framesPerDirection,
): DccFile {
  let dirFrameLists: (readonly Dc6Frame[])[] = []
  if (sheet.groups.length === cofDirections) {
    dirFrameLists = sheet.groups.map(g => g.frames)
  } else if (
    sheet.groups.length === 1 &&
    cofDirections > 1 &&
    (sheet.groups[0]?.frames.length ?? 0) >= cofDirections * cofFramesPerDir
  ) {
    const allFrames = sheet.groups[0]!.frames
    for (let d = 0; d < cofDirections; d += 1) {
      dirFrameLists.push(allFrames.slice(d * cofFramesPerDir, (d + 1) * cofFramesPerDir))
    }
  } else {
    dirFrameLists = sheet.groups.map(g => g.frames)
  }

  const directions: DccDirection[] = []
  for (const dirFrames of dirFrameLists) {
    if (dirFrames.length === 0) {
      directions.push({
        box: { left: 0, top: 0, width: 1, height: 1 },
        frames: [],
      })
      continue
    }

    let left = Number.POSITIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    for (const f of dirFrames) {
      const fLeft = f.offsetX
      const fTop = f.offsetY - f.height + 1
      left = Math.min(left, fLeft)
      top = Math.min(top, fTop)
      right = Math.max(right, fLeft + f.width)
      bottom = Math.max(bottom, fTop + f.height)
    }

    const boxLeft = Number.isFinite(left) ? Math.round(left) : 0
    const boxTop = Number.isFinite(top) ? Math.round(top) : 0
    const boxWidth = Number.isFinite(right) ? Math.max(1, Math.round(right) - boxLeft) : 1
    const boxHeight = Number.isFinite(bottom) ? Math.max(1, Math.round(bottom) - boxTop) : 1
    const dirBox = { left: boxLeft, top: boxTop, width: boxWidth, height: boxHeight }

    const dccFrames: DccFrame[] = []
    for (const f of dirFrames) {
      const fLeft = f.offsetX
      const fTop = f.offsetY - f.height + 1
      let canvas: SpriteFrame
      if (fLeft === boxLeft && fTop === boxTop && f.width === boxWidth && f.height === boxHeight) {
        canvas = {
          width: boxWidth,
          height: boxHeight,
          indices: f.indices,
          mask: f.mask,
        }
      } else {
        const indices = new Uint8Array(boxWidth * boxHeight)
        const mask = new Uint8Array(boxWidth * boxHeight)
        const target = { width: boxWidth, height: boxHeight, indices, mask }
        blit(target, f, fLeft - boxLeft, fTop - boxTop)
        canvas = target
      }
      dccFrames.push({
        width: f.width,
        height: f.height,
        offsetX: f.offsetX,
        offsetY: f.offsetY,
        frame: canvas,
        bottomUp: false,
      })
    }

    directions.push({
      box: dirBox,
      frames: dccFrames,
    })
  }

  return {
    version: 6,
    directions,
  }
}

function decodeLayerSpriteBytes(
  member: string,
  bytes: Uint8Array,
  cofDirections: number,
  cofFramesPerDir: number,
): DccFile {
  if (member.toLowerCase().endsWith('.dc6')) {
    return dc6ToDccFile(decodeDc6(bytes), cofDirections, cofFramesPerDir)
  }
  return decodeDcc(bytes)
}

export interface MonsterLayerFailure {
  readonly token: string
  readonly animation: string
  readonly component: string | null
  readonly member: string | null
  readonly reason: 'unknown-component' | 'no-member' | 'decode'
  readonly message?: string
}

export interface MonsterAnimationSheet {
  readonly sheet: SpriteSheet
  readonly glowSheet?: SpriteSheet | undefined
  readonly blendMode: CofLayerDrawBlendMode
  readonly directions: number
  readonly framesPerDirection: number
  readonly layers: number
  readonly decodedMembers: readonly string[]
  readonly layerFailures: readonly MonsterLayerFailure[]
}

/**
 * Load and composite a single monster animation (e.g. walk 'wl' or stand 'nu').
 */
export async function compositeMonsterAnimation(
  archives: MountedArchives,
  token: string,
  animation: string,
  weapon: string = 'hth',
  /** COF component (lower-case) -> MonStats2 `<comp>v` token; a requested variant member must exist. */
  componentVariants?: Readonly<Record<string, string>>,
): Promise<MonsterAnimationSheet> {
  const lower = token.trim().toLowerCase()
  const root = `data\\global\\monsters\\${lower}\\`

  const fileIndex = await getArchiveFileIndex(archives)
  const tokenFiles = fileIndex.byRootPrefix.get(root) ?? fileIndex.allFiles
  let usedAnim = animation.toLowerCase()
  let usedWeapon = weapon.toLowerCase()
  const candidates = [
    `${root}cof\\${lower}${usedAnim}${usedWeapon}.cof`,
    `${root}cof\\${lower}${usedAnim}hth.cof`,
    ...(usedAnim === 'wl'
      ? [
          `${root}cof\\${lower}nu${usedWeapon}.cof`,
          `${root}cof\\${lower}nuhth.cof`,
        ]
      : []),
  ]

  let matchedCof: string | undefined
  for (const cand of candidates) {
    matchedCof = fileIndex.byLower.get(cand.toLowerCase())
    if (matchedCof) {
      if (cand.endsWith(`nu${usedWeapon}.cof`) || cand.endsWith('nuhth.cof')) usedAnim = 'nu'
      if (cand.endsWith('hth.cof')) usedWeapon = 'hth'
      break
    }
  }

  if (!matchedCof) {
    const cofPrefix = `${root}cof\\${lower}${usedAnim}`.toLowerCase()
    const altCofs = tokenFiles
      .filter(n => {
        const ln = n.toLowerCase()
        return ln.startsWith(cofPrefix) && ln.endsWith('.cof') && ln.length === cofPrefix.length + 7
      })
      .sort()
    if (altCofs.length > 0) {
      matchedCof = altCofs[0]
      usedWeapon = matchedCof!.slice(-7, -4).toLowerCase()
    }
  }

  let cof: CofFile
  if (matchedCof) {
    const cofBytes = await archives.read(matchedCof)
    cof = decodeCof(cofBytes)
  } else {
    const standaloneTr = findMonsterLayerSprite(
      tokenFiles,
      root,
      lower,
      usedAnim,
      usedWeapon,
      'tr',
      usedWeapon,
    )
    if (!standaloneTr) {
      throw new Error(`Monster COF not found: ${candidates[0]}`)
    }
    const trBytes = await archives.read(standaloneTr)
    const trSprite = decodeLayerSpriteBytes(standaloneTr, trBytes, 8, 8)
    const numDirs = Math.max(1, trSprite.directions.length)
    const framesPerDir = Math.max(1, trSprite.directions[0]?.frames.length ?? 1)
    cof = {
      numberOfLayers: 1,
      framesPerDirection: framesPerDir,
      numberOfDirections: numDirs,
      speed: 256,
      layers: [{ type: 1, shadow: 1, selectable: true, transparent: false, drawEffect: 0, weaponClass: usedWeapon }],
      animationFrames: new Uint8Array(framesPerDir),
      priority: Array.from({ length: numDirs }, () => Array.from({ length: framesPerDir }, () => [1])),
    }
  }

  const layerResults = await Promise.all(cof.layers.map(async (layer) => {
    const component = MONSTER_COMPONENTS[layer.type]
    if (component === undefined) {
      return {
        sprite: null,
        member: undefined,
        failure: { token: lower, animation: usedAnim, component: null, member: null, reason: 'unknown-component' } as MonsterLayerFailure,
      }
    }
    const variant = componentVariants?.[component]
    const member = findMonsterLayerSprite(
      tokenFiles,
      root,
      lower,
      usedAnim,
      usedWeapon,
      component,
      layer.weaponClass,
      variant,
    )
    if (
      member === undefined &&
      variant !== undefined &&
      findMonsterLayerSprite(tokenFiles, root, lower, usedAnim, usedWeapon, component, layer.weaponClass) !== undefined
    ) {
      throw new Error(
        `Monster ${lower} ${usedAnim}/${usedWeapon}: component ${component} variant ${variant} has no DCC member`,
      )
    }
    if (member === undefined) {
      return {
        sprite: null,
        member: undefined,
        failure: { token: lower, animation: usedAnim, component, member: null, reason: 'no-member' } as MonsterLayerFailure,
      }
    }
    try {
      const bytes = await archives.read(member)
      return {
        sprite: decodeLayerSpriteBytes(member, bytes, cof.numberOfDirections, cof.framesPerDirection),
        member,
        failure: undefined,
      }
    } catch (err) {
      return {
        sprite: null,
        member: undefined,
        failure: {
          token: lower,
          animation: usedAnim,
          component,
          member,
          reason: 'decode',
          message: (err as Error).message,
        } as MonsterLayerFailure,
      }
    }
  }))

  const sprites: (DccFile | null)[] = layerResults.map(r => r.sprite)
  const decodedMembers: string[] = layerResults.flatMap(r => r.member ? [r.member] : [])
  const layerFailures: MonsterLayerFailure[] = layerResults.flatMap(r => r.failure ? [r.failure] : [])

  return compositeLoadedLayers(cof, sprites, decodedMembers, layerFailures, 0, 0)
}

/**
 * Load and composite a single object animation (`nu`, `op`, `on`, `s1..s5`) across all directions and frames.
 * Uses `objectDrawAnchor` offsets (`anchorX = -16 + boxLeft`, `anchorY = 16 + boxTop`).
 */
export async function compositeObjectAnimation(
  archives: MountedArchives,
  token: string,
  animation: string,
  baseIsMonsters = false,
): Promise<MonsterAnimationSheet> {
  const lower = token.trim().toLowerCase()
  const usedAnim = animation.trim().toLowerCase()
  const root = baseIsMonsters
    ? `data\\global\\monsters\\${lower}\\`
    : `data\\global\\objects\\${lower}\\`

  const fileIndex = await getArchiveFileIndex(archives)
  const tokenFiles = fileIndex.byRootPrefix.get(root) ?? fileIndex.allFiles

  const exactCof = `${root}cof\\${lower}${usedAnim}hth.cof`.toLowerCase()
  let matchedCof = fileIndex.byLower.get(exactCof)
  let usedWeapon = 'hth'

  if (!matchedCof) {
    const cofPrefix = `${root}cof\\${lower}${usedAnim}`.toLowerCase()
    const altCofs = tokenFiles
      .filter(n => {
        const ln = n.toLowerCase()
        return ln.startsWith(cofPrefix) && ln.endsWith('.cof') && ln.length === cofPrefix.length + 7
      })
      .sort()
    if (altCofs.length > 0) {
      matchedCof = altCofs[0]
      usedWeapon = matchedCof!.slice(-7, -4).toLowerCase()
    }
  }

  if (!matchedCof) {
    throw new Error(`Object COF not found: ${exactCof}`)
  }

  const cofBytes = await archives.read(matchedCof)
  const cof: CofFile = decodeCof(cofBytes)

  const layerResults = await Promise.all(cof.layers.map(async (layer) => {
    const component = MONSTER_COMPONENTS[layer.type]
    if (component === undefined) {
      return {
        sprite: null,
        member: undefined,
        failure: { token: lower, animation: usedAnim, component: null, member: null, reason: 'unknown-component' } as MonsterLayerFailure,
      }
    }
    const litDcc = fileIndex.byLower.get(`${root}${component}\\${lower}${component}lit${usedAnim}${usedWeapon}.dcc`)
    const litDc6 = fileIndex.byLower.get(`${root}${component}\\${lower}${component}lit${usedAnim}${usedWeapon}.dc6`)
    const member =
      litDcc ??
      litDc6 ??
      findMonsterLayerSprite(
        tokenFiles,
        root,
        lower,
        usedAnim,
        usedWeapon,
        component,
        layer.weaponClass,
      )

    if (member === undefined) {
      return {
        sprite: null,
        member: undefined,
        failure: { token: lower, animation: usedAnim, component, member: null, reason: 'no-member' } as MonsterLayerFailure,
      }
    }
    try {
      const bytes = await archives.read(member)
      return {
        sprite: decodeLayerSpriteBytes(member, bytes, cof.numberOfDirections, cof.framesPerDirection),
        member,
        failure: undefined,
      }
    } catch (err) {
      return {
        sprite: null,
        member: undefined,
        failure: {
          token: lower,
          animation: usedAnim,
          component,
          member,
          reason: 'decode',
          message: (err as Error).message,
        } as MonsterLayerFailure,
      }
    }
  }))

  const sprites: (DccFile | null)[] = layerResults.map(r => r.sprite)
  const decodedMembers: string[] = layerResults.flatMap(r => r.member ? [r.member] : [])
  const layerFailures: MonsterLayerFailure[] = layerResults.flatMap(r => r.failure ? [r.failure] : [])

  // Object COF/DCC frames use unshifted 1.13c bounding box origins (0, 0); per-object Xoffset/Yoffset from Objects.txt is applied at draw time
  return compositeLoadedLayers(cof, sprites, decodedMembers, layerFailures, 0, 0)
}

export function compositeLoadedLayers(
  cof: CofFile,
  sprites: readonly (DccFile | null)[],
  decodedMembers: readonly string[],
  layerFailures: readonly MonsterLayerFailure[],
  anchorOffsetX: number,
  anchorOffsetY: number,
  unitDefaultDrawMode: CofLayerDrawBlendMode = 'normal',
): MonsterAnimationSheet {
  const layerDrawMode = (layerIdx: number): CofLayerDrawBlendMode =>
    resolveCofLayerDrawMode(cof.layers[layerIdx], unitDefaultDrawMode)
  const isAdditiveLayer = (layerIdx: number): boolean => layerDrawMode(layerIdx) === 'additive'

  const hasAdditive = cof.layers.some((_, idx) => isAdditiveLayer(idx))
  const hasNormal = cof.layers.some((_, idx) => !isAdditiveLayer(idx))
  const isComposite = hasAdditive && hasNormal
  const isPureAdditive = hasAdditive && !hasNormal
  const nonAdditiveModes = cof.layers
    .map((_, idx) => layerDrawMode(idx))
    .filter(m => m !== 'additive')
  const uniformNonAdditiveMode: CofLayerDrawBlendMode =
    nonAdditiveModes.length > 0 && nonAdditiveModes.every(m => m === nonAdditiveModes[0])
      ? nonAdditiveModes[0]!
      : unitDefaultDrawMode

  const groups: { frames: SpriteFrame[] }[] = []
  const glowGroups: { frames: SpriteFrame[] }[] = []
  let anyPlaced = false

  for (let dir = 0; dir < cof.numberOfDirections; dir += 1) {
    const dir64 = Math.round((dir * 64) / cof.numberOfDirections)
    const baseFrames: SpriteFrame[] = []
    const glowFrames: SpriteFrame[] = []

    for (let f = 0; f < cof.framesPerDirection; f += 1) {
      let left = Number.POSITIVE_INFINITY
      let top = Number.POSITIVE_INFINITY
      let right = Number.NEGATIVE_INFINITY
      let bottom = Number.NEGATIVE_INFINITY
      let placedCount = 0

      for (let layerIdx = 0; layerIdx < cof.layers.length; layerIdx += 1) {
        const dcc = sprites[layerIdx]
        if (!dcc || dcc.directions.length === 0) continue
        const dccDir = dir64ToDcc(dir64, dcc.directions.length)
        const dirData = dcc.directions[dccDir] ?? dcc.directions[0]
        if (!dirData || dirData.frames.length === 0) continue
        const frameData = dirData.frames[f] ?? dirData.frames[f % dirData.frames.length]
        if (!frameData) continue
        left = Math.min(left, dirData.box.left)
        top = Math.min(top, dirData.box.top)
        right = Math.max(right, dirData.box.left + dirData.box.width)
        bottom = Math.max(bottom, dirData.box.top + dirData.box.height)
        placedCount += 1
      }

      if (placedCount === 0) {
        const emptyFrame: SpriteFrame = {
          width: 1,
          height: 1,
          indices: new Uint8Array(1),
          mask: new Uint8Array(1),
          anchorX: anchorOffsetX,
          anchorY: anchorOffsetY,
        }
        baseFrames.push(emptyFrame)
        if (isComposite) glowFrames.push(emptyFrame)
        continue
      }

      const boxLeft = Math.round(left)
      const boxTop = Math.round(top)
      const frameWidth = Math.max(1, Math.round(right) - boxLeft)
      const frameHeight = Math.max(1, Math.round(bottom) - boxTop)
      if (frameWidth > 1 || frameHeight > 1) {
        anyPlaced = true
      }
      const baseTarget = {
        indices: new Uint8Array(frameWidth * frameHeight),
        mask: new Uint8Array(frameWidth * frameHeight),
        width: frameWidth,
        height: frameHeight,
      }
      const glowTarget = isComposite
        ? {
            indices: new Uint8Array(frameWidth * frameHeight),
            mask: new Uint8Array(frameWidth * frameHeight),
            width: frameWidth,
            height: frameHeight,
          }
        : null

      const order = cofLayerOrder(cof, dir, f)
      for (const layerIdx of order) {
        const dcc = sprites[layerIdx]
        if (!dcc || dcc.directions.length === 0) continue
        const dccDir = dir64ToDcc(dir64, dcc.directions.length)
        const dirData = dcc.directions[dccDir] ?? dcc.directions[0]
        if (!dirData || dirData.frames.length === 0) continue
        const frameData = dirData.frames[f] ?? dirData.frames[f % dirData.frames.length]
        if (!frameData) continue
        const atX = Math.round(dirData.box.left) - boxLeft
        const atY = Math.round(dirData.box.top) - boxTop
        if (glowTarget !== null && isAdditiveLayer(layerIdx)) {
          blit(glowTarget, frameData.frame, atX, atY, 255, null)
        } else {
          const mode = layerDrawMode(layerIdx)
          const alphaByte = cofLayerDrawModeAlphaByte(mode)
          blit(baseTarget, frameData.frame, atX, atY, alphaByte, glowTarget)
        }
      }

      baseFrames.push({
        width: frameWidth,
        height: frameHeight,
        indices: baseTarget.indices,
        mask: baseTarget.mask,
        anchorX: anchorOffsetX + boxLeft,
        anchorY: anchorOffsetY + boxTop,
      })
      if (glowTarget !== null) {
        glowFrames.push({
          width: frameWidth,
          height: frameHeight,
          indices: glowTarget.indices,
          mask: glowTarget.mask,
          anchorX: anchorOffsetX + boxLeft,
          anchorY: anchorOffsetY + boxTop,
        })
      }
    }
    groups.push({ frames: baseFrames })
    if (isComposite) glowGroups.push({ frames: glowFrames })
  }

  return {
    sheet: { groups, width: null },
    glowSheet: isComposite ? { groups: glowGroups, width: null } : undefined,
    blendMode: !anyPlaced ? 'normal' : isPureAdditive ? 'additive' : uniformNonAdditiveMode,
    directions: cof.numberOfDirections,
    framesPerDirection: cof.framesPerDirection,
    layers: cof.layers.length,
    decodedMembers,
    layerFailures,
  }
}

export interface MonsterPaletteInput {
  readonly classId?: number | undefined
  readonly isChampion?: boolean | undefined
  readonly isUnique?: boolean | undefined
  readonly isSuperUnique?: boolean | undefined
  readonly superUniqueId?: number | undefined
  readonly bossPaletteRow?: number | undefined
  readonly utrans?: number | undefined
  readonly transLvl?: number | undefined
  readonly paletteRow?: number | undefined
}

/**
 * Resolve the 1.13c hardware palette row (`0..16`) for a Boss / Unique / SuperUnique monster.
 */
export function getBossPaletteRow(
  classIdOrTokenOrUtrans?: number | string,
  superUniqueIdOrVariantIndex?: number,
  utrans?: number,
): number {
  if (typeof classIdOrTokenOrUtrans === 'string') {
    if (typeof utrans === 'number' && Number.isFinite(utrans) && utrans > 0) {
      return Math.min(16, 4 + ((Math.floor(utrans) - 1) % 12) + 1)
    }
    if (
      typeof superUniqueIdOrVariantIndex === 'number' &&
      Number.isFinite(superUniqueIdOrVariantIndex) &&
      superUniqueIdOrVariantIndex > 0
    ) {
      return Math.min(16, 4 + ((Math.floor(superUniqueIdOrVariantIndex) - 1) % 12) + 1)
    }
    return 3
  }
  if (
    typeof classIdOrTokenOrUtrans === 'number' &&
    Number.isFinite(classIdOrTokenOrUtrans) &&
    typeof superUniqueIdOrVariantIndex === 'number' &&
    Number.isFinite(superUniqueIdOrVariantIndex)
  ) {
    const suId = Math.max(0, Math.floor(superUniqueIdOrVariantIndex))
    if (suId === 0) return 3
    return Math.min(16, 4 + ((suId - 1) % 12) + 1)
  }
  if (
    typeof classIdOrTokenOrUtrans === 'number' &&
    Number.isFinite(classIdOrTokenOrUtrans) &&
    classIdOrTokenOrUtrans > 0
  ) {
    return Math.min(16, 4 + ((Math.floor(classIdOrTokenOrUtrans) - 1) % 12) + 1)
  }
  return 3
}

/**
 * Resolve the 1.13c hardware palette row (`0..16`) for a monster unit (`MonStats.txt` `TransLvl`,
 * Champion row 4, Unique/SuperUnique row 3 or `Utrans` rows `5..16`).
 */
export function getMonsterPaletteRow(
  inputOrToken?: MonsterPaletteInput | string | null,
  variantIndex?: number,
): number {
  if (typeof inputOrToken === 'string') {
    if (typeof variantIndex === 'number' && Number.isFinite(variantIndex) && variantIndex > 0) {
      return Math.min(16, 4 + ((Math.floor(variantIndex) - 1) % 12) + 1)
    }
    return 0
  }
  if (!inputOrToken || typeof inputOrToken !== 'object') {
    return 0
  }
  if (
    typeof inputOrToken.paletteRow === 'number' &&
    Number.isFinite(inputOrToken.paletteRow) &&
    inputOrToken.paletteRow >= 0
  ) {
    return Math.max(0, Math.min(16, Math.floor(inputOrToken.paletteRow)))
  }
  if (inputOrToken.isChampion) {
    return 4
  }
  if (
    typeof inputOrToken.bossPaletteRow === 'number' &&
    Number.isFinite(inputOrToken.bossPaletteRow) &&
    inputOrToken.bossPaletteRow >= 1
  ) {
    return Math.max(1, Math.min(16, Math.floor(inputOrToken.bossPaletteRow)))
  }
  if (
    typeof inputOrToken.utrans === 'number' &&
    Number.isFinite(inputOrToken.utrans) &&
    inputOrToken.utrans > 0
  ) {
    return Math.min(16, 4 + ((Math.floor(inputOrToken.utrans) - 1) % 12) + 1)
  }
  if (
    typeof inputOrToken.superUniqueId === 'number' &&
    Number.isFinite(inputOrToken.superUniqueId) &&
    inputOrToken.superUniqueId >= 0
  ) {
    return getBossPaletteRow(inputOrToken.classId ?? 0, inputOrToken.superUniqueId)
  }
  if (inputOrToken.isUnique || inputOrToken.isSuperUnique) {
    return 3
  }
  if (
    typeof inputOrToken.transLvl === 'number' &&
    Number.isFinite(inputOrToken.transLvl) &&
    inputOrToken.transLvl > 0
  ) {
    return Math.min(16, 4 + Math.floor(inputOrToken.transLvl))
  }
  return 0
}

export const resolveMonsterPaletteRow = getMonsterPaletteRow
