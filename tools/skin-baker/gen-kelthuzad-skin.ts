/**
 * Offline 3D-Projected Isometric Kel'Thuzad (Archlich) Skin Generator & Baker
 * (`tools/skin-baker/gen-kelthuzad-skin.ts`).
 *
 * Uses a deterministic Z-buffered 3D capsule/ellipsoid isometric rasterizer with
 * Lambertian + rim lighting and a separate emissive Frost Glow pass to bake the
 * Phase 1 built-in `ne-kelthuzad` true-color RGBA character skin across all 8
 * Diablo II directions (`S, SW, W, NW, N, NE, E, SE`) and 7 animation clips:
 *   - `nu` (8f): Hovering Archlich idle with swaying chains & pulsing frost aura
 *   - `wl` (8f): Forward-tilted spectral glide
 *   - `rn` (8f): Rapid frost-trail surge glide
 *   - `sc` (12f): Skyward two-arm Lich spell invocation with spiraling frost runes
 *   - `a1` (10f): Sweeping Frost Scepter cleave with icy arc trail
 *   - `gh` (6f): Stagger recoil with crackling phylactery sparks
 *   - `dt` (14f): Archlich collapse into hovering glowing Frost Phylactery (`dd` final frame)
 */

import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  packCharacterSkinBundle,
  writeSkinBundleToPublicSkinsDir,
  type PackCharacterSkinInput,
  type PackedCharacterSkinBundle,
  type RawRgbaSkinFrame,
  type RawSkinClipInput,
} from './pack-skin.ts'
import { generateScourgeMinionsInput } from './gen-scourge-minions.ts'

type Vec3 = readonly [number, number, number]
type Rgb = readonly [number, number, number]

interface MatProps {
  readonly color: Rgb
  readonly rimColor?: Rgb | undefined
  readonly rimStrength?: number | undefined
  readonly alpha?: number | undefined
  readonly glow?: Rgb | undefined
}

const CANVAS_W = 160
const CANVAS_H = 192
const FOOT_X = 80
const FOOT_Y = 158
/** Pixels per 3D model unit (at 2x HD `renderScale = 0.5`, 1.0 model unit = 56 px = 28 logical D2 px). */
const PX_SCALE = 56

// Normalized light direction in camera space (top-left-front gothic key light)
const LIGHT_DIR: Vec3 = (() => {
  const lx = -0.42
  const ly = -0.62
  const lz = 0.66
  const inv = 1 / Math.hypot(lx, ly, lz)
  return [lx * inv, ly * inv, lz * inv]
})()

// 2:1 isometric camera pitch: sin(pitch) = 0.5 (30 degrees)
const SIN_PITCH = 0.5
const COS_PITCH = Math.sqrt(1 - SIN_PITCH * SIN_PITCH)

function rotateYawAndIso(p: Vec3, cosYaw: number, sinYaw: number): Vec3 {
  // Model space: +X = character left->right, +Y = character forward (South at dir=0), +Z = up
  // Rotate around Z by -yaw for clockwise D2 screen directions (0=S, 1=SW, 2=W, 3=NW, 4=N, 5=NE, 6=E, 7=SE)
  const wx = p[0] * cosYaw - p[1] * sinYaw
  const wy = p[0] * sinYaw + p[1] * cosYaw
  const wz = p[2]

  // Camera looks from South (+Y) downward at 30 deg:
  // camX = right (+wx)
  // camY = screen-down = wy * SIN_PITCH - wz * COS_PITCH
  // camDepth = closer to viewer when wy is larger and wz is larger: wy * COS_PITCH + wz * SIN_PITCH
  const camX = wx
  const camY = wy * SIN_PITCH - wz * COS_PITCH
  const camDepth = wy * COS_PITCH + wz * SIN_PITCH
  return [camX, camY, camDepth]
}

class IsoZBufferCanvas {
  readonly width: number
  readonly height: number
  readonly footX: number
  readonly footY: number
  readonly pixels: Uint8Array
  readonly glowPixels: Uint8Array
  private readonly zbuf: Float32Array

  constructor(width = CANVAS_W, height = CANVAS_H, footX = FOOT_X, footY = FOOT_Y) {
    this.width = width
    this.height = height
    this.footX = footX
    this.footY = footY
    this.pixels = new Uint8Array(width * height * 4)
    this.glowPixels = new Uint8Array(width * height * 4)
    this.zbuf = new Float32Array(width * height)
    this.zbuf.fill(-1e9)
  }

  drawCapsule(
    aModel: Vec3,
    bModel: Vec3,
    radiusA: number,
    radiusB: number,
    cosYaw: number,
    sinYaw: number,
    mat: MatProps,
    scalePx = PX_SCALE,
  ): void {
    const a = rotateYawAndIso(aModel, cosYaw, sinYaw)
    const b = rotateYawAndIso(bModel, cosYaw, sinYaw)

    const ax = this.footX + a[0] * scalePx
    const ay = this.footY + a[1] * scalePx
    const az = a[2] * scalePx
    const bx = this.footX + b[0] * scalePx
    const by = this.footY + b[1] * scalePx
    const bz = b[2] * scalePx

    const ra = radiusA * scalePx
    const rb = radiusB * scalePx
    const maxR = Math.max(ra, rb) + 1.5

    const minX = Math.max(0, Math.floor(Math.min(ax, bx) - maxR))
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(ax, bx) + maxR))
    const minY = Math.max(0, Math.floor(Math.min(ay, by) - maxR))
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(ay, by) + maxR))

    const abx = bx - ax
    const aby = by - ay
    const abz = bz - az
    const abLenSq2d = abx * abx + aby * aby

    const rimR = mat.rimColor?.[0] ?? 110
    const rimG = mat.rimColor?.[1] ?? 185
    const rimB = mat.rimColor?.[2] ?? 245
    const rimStr = mat.rimStrength ?? 0.25
    const alpha = Math.round((mat.alpha ?? 1) * 255)

    for (let py = minY; py <= maxY; py += 1) {
      const cy = py + 0.5
      for (let px = minX; px <= maxX; px += 1) {
        const cx = px + 0.5
        let t = 0
        if (abLenSq2d > 1e-4) {
          t = ((cx - ax) * abx + (cy - ay) * aby) / abLenSq2d
          if (t < 0) t = 0
          else if (t > 1) t = 1
        }
        const qx = ax + abx * t
        const qy = ay + aby * t
        const qz = az + abz * t
        const r = ra + (rb - ra) * t
        if (r <= 0.25) continue

        const dx = cx - qx
        const dy = cy - qy
        const dSq = dx * dx + dy * dy
        const rSq = r * r
        if (dSq > rSq) continue

        const dz = Math.sqrt(Math.max(0, rSq - dSq))
        const z = qz + dz
        const idx = py * this.width + px

        if (alpha >= 245) {
          if (z < this.zbuf[idx]!) continue
          this.zbuf[idx] = z
        } else if (z < this.zbuf[idx]! - 2) {
          continue
        }

        const invR = 1 / r
        const nx = dx * invR
        const ny = dy * invR
        const nz = dz * invR

        const ndotl = Math.max(0, nx * LIGHT_DIR[0] + (-ny) * LIGHT_DIR[1] + nz * LIGHT_DIR[2])
        const shade = 0.34 + 0.72 * ndotl
        const rim = Math.pow(Math.max(0, 1 - nz), 2.2) * rimStr
        // Dark gothic outline silhouette tightening on grazing edges
        const edgeDarken = nz < 0.28 ? 0.55 + 0.45 * (nz / 0.28) : 1.0

        const cr = Math.min(255, Math.max(0, Math.round((mat.color[0] * shade + rimR * rim) * edgeDarken)))
        const cg = Math.min(255, Math.max(0, Math.round((mat.color[1] * shade + rimG * rim) * edgeDarken)))
        const cb = Math.min(255, Math.max(0, Math.round((mat.color[2] * shade + rimB * rim) * edgeDarken)))

        const o = idx * 4
        if (alpha >= 250 || this.pixels[o + 3] === 0) {
          this.pixels[o] = cr
          this.pixels[o + 1] = cg
          this.pixels[o + 2] = cb
          this.pixels[o + 3] = alpha
        } else {
          const aSrc = alpha / 255
          const aDst = this.pixels[o + 3]! / 255
          const outA = aSrc + aDst * (1 - aSrc)
          if (outA > 0) {
            this.pixels[o] = Math.round((cr * aSrc + this.pixels[o]! * aDst * (1 - aSrc)) / outA)
            this.pixels[o + 1] = Math.round((cg * aSrc + this.pixels[o + 1]! * aDst * (1 - aSrc)) / outA)
            this.pixels[o + 2] = Math.round((cb * aSrc + this.pixels[o + 2]! * aDst * (1 - aSrc)) / outA)
            this.pixels[o + 3] = Math.min(255, Math.round(outA * 255))
          }
        }

        if (mat.glow) {
          const gFalloff = 0.55 + 0.45 * nz
          this.glowPixels[o] = Math.min(255, this.glowPixels[o]! + Math.round(mat.glow[0] * gFalloff))
          this.glowPixels[o + 1] = Math.min(255, this.glowPixels[o + 1]! + Math.round(mat.glow[1] * gFalloff))
          this.glowPixels[o + 2] = Math.min(255, this.glowPixels[o + 2]! + Math.round(mat.glow[2] * gFalloff))
          this.glowPixels[o + 3] = Math.min(255, Math.max(this.glowPixels[o + 3]!, Math.round(220 * gFalloff)))
        }
      }
    }
  }

  drawGlowHalo(
    centerModel: Vec3,
    radiusModel: number,
    cosYaw: number,
    sinYaw: number,
    glowColor: Rgb,
    intensity = 1.0,
    ignoreDepth = false,
    scalePx = PX_SCALE,
  ): void {
    const c = rotateYawAndIso(centerModel, cosYaw, sinYaw)
    const cx = this.footX + c[0] * scalePx
    const cy = this.footY + c[1] * scalePx
    const cz = c[2] * scalePx
    const r = radiusModel * scalePx
    if (r < 1) return

    const minX = Math.max(0, Math.floor(cx - r))
    const maxX = Math.min(this.width - 1, Math.ceil(cx + r))
    const minY = Math.max(0, Math.floor(cy - r))
    const maxY = Math.min(this.height - 1, Math.ceil(cy + r))

    for (let py = minY; py <= maxY; py += 1) {
      for (let px = minX; px <= maxX; px += 1) {
        const d = Math.hypot(px + 0.5 - cx, py + 0.5 - cy) / r
        if (d >= 1) continue
        const idx = py * this.width + px
        if (!ignoreDepth && cz + r * 0.35 < this.zbuf[idx]!) continue
        const w = Math.pow(1 - d, 2.0) * intensity
        if (w <= 0.01) continue
        const o = idx * 4
        const addR = Math.round(glowColor[0] * w)
        const addG = Math.round(glowColor[1] * w)
        const addB = Math.round(glowColor[2] * w)
        this.glowPixels[o] = Math.min(255, this.glowPixels[o]! + addR)
        this.glowPixels[o + 1] = Math.min(255, this.glowPixels[o + 1]! + addG)
        this.glowPixels[o + 2] = Math.min(255, this.glowPixels[o + 2]! + addB)
        this.glowPixels[o + 3] = Math.min(255, Math.max(this.glowPixels[o + 3]!, Math.round(255 * Math.min(1, w * 1.2))))
      }
    }
  }
}

// Materials for Kel'Thuzad Archlich
const MAT_BONE: MatProps = { color: [212, 204, 184], rimColor: [130, 210, 255], rimStrength: 0.3 }
const MAT_DARK_BONE: MatProps = { color: [142, 136, 124], rimColor: [100, 170, 220], rimStrength: 0.2 }
const MAT_ROBE_ROYAL: MatProps = { color: [58, 30, 88], rimColor: [135, 95, 215], rimStrength: 0.34 }
const MAT_ROBE_SHADOW: MatProps = { color: [28, 18, 44], rimColor: [90, 140, 210], rimStrength: 0.28 }
const MAT_SASH_CRIMSON_VIOLET: MatProps = { color: [98, 28, 82], rimColor: [185, 95, 190], rimStrength: 0.3 }
const MAT_GOLD: MatProps = { color: [214, 172, 74], rimColor: [255, 236, 160], rimStrength: 0.42 }
const MAT_OBSIDIAN: MatProps = { color: [36, 42, 58], rimColor: [110, 195, 250], rimStrength: 0.38 }
const MAT_CHAIN: MatProps = { color: [96, 108, 126], rimColor: [150, 220, 255], rimStrength: 0.35 }
const MAT_BEARD: MatProps = { color: [218, 226, 238], rimColor: [150, 225, 255], rimStrength: 0.35 }
const MAT_FROST_CRYSTAL: MatProps = {
  color: [135, 232, 255],
  rimColor: [230, 252, 255],
  rimStrength: 0.6,
  glow: [95, 215, 255],
}
const MAT_EYE_FLAME: MatProps = {
  color: [165, 248, 255],
  glow: [120, 235, 255],
}

interface PoseParams {
  readonly clip: string
  readonly phase: number // 0..1
  readonly dirIdx: number
  readonly totalDirs: number
}

function renderKelthuzadPose(
  params: PoseParams,
  width = CANVAS_W,
  height = CANVAS_H,
  footX = FOOT_X,
  footY = FOOT_Y,
  scalePx = PX_SCALE,
): RawRgbaSkinFrame {
  const canvas = new IsoZBufferCanvas(width, height, footX, footY)
  const yaw = (params.dirIdx * 2 * Math.PI) / params.totalDirs
  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)

  const { clip, phase } = params
  const tau = phase * Math.PI * 2

  // Death collapse (`dt` -> final frame `dd` is the glowing hovering Frost Phylactery + scattered bones!)
  if (clip === 'dt') {
    const collapse = Math.min(1, phase * 1.25)
    const phylacteryZ = 0.42 + 0.05 * Math.sin(phase * Math.PI * 4)

    if (collapse < 0.85) {
      const dropZ = (1 - collapse) * 0.95
      const spread = collapse * 0.35
      canvas.drawCapsule([0, 0, 0.12], [0, -0.1, 0.12 + dropZ * 0.6], 0.32, 0.22, cosYaw, sinYaw, MAT_ROBE_SHADOW, scalePx)
      canvas.drawCapsule([-0.24 - spread, 0.05, 0.1 + dropZ * 0.5], [0.24 + spread, -0.05, 0.1 + dropZ * 0.5], 0.1, 0.1, cosYaw, sinYaw, MAT_ROBE_ROYAL, scalePx)
      canvas.drawCapsule([0, 0.08 + spread * 0.5, 0.14 + dropZ * 0.9], [0, 0.12 + spread * 0.5, 0.28 + dropZ * 0.9], 0.13, 0.11, cosYaw, sinYaw, MAT_BONE, scalePx)
    } else {
      // Collapsed tattered robe pool + scattered rib/skull fragments on ground
      canvas.drawCapsule([-0.24, 0.06, 0.05], [0.24, -0.04, 0.05], 0.2, 0.18, cosYaw, sinYaw, MAT_ROBE_SHADOW, scalePx)
      canvas.drawCapsule([-0.18, -0.12, 0.06], [0.2, 0.14, 0.06], 0.15, 0.14, cosYaw, sinYaw, MAT_ROBE_ROYAL, scalePx)
      canvas.drawCapsule([-0.26, 0.14, 0.07], [-0.12, 0.2, 0.07], 0.05, 0.04, cosYaw, sinYaw, MAT_BONE, scalePx)
      canvas.drawCapsule([0.15, -0.14, 0.07], [0.28, -0.06, 0.07], 0.05, 0.04, cosYaw, sinYaw, MAT_GOLD, scalePx)
    }

    // Iconic Warcraft III / Naxxramas Frost Phylactery (护命匣) hovering above remains!
    const phyScale = 0.4 + 0.6 * collapse
    canvas.drawCapsule(
      [0, 0, phylacteryZ - 0.14 * phyScale],
      [0, 0, phylacteryZ + 0.14 * phyScale],
      0.11 * phyScale,
      0.11 * phyScale,
      cosYaw,
      sinYaw,
      MAT_FROST_CRYSTAL,
      scalePx,
    )
    // Ornate golden phylactery cage bands & crown finials
    canvas.drawCapsule(
      [-0.13 * phyScale, 0, phylacteryZ + 0.12 * phyScale],
      [0.13 * phyScale, 0, phylacteryZ + 0.12 * phyScale],
      0.035 * phyScale,
      0.035 * phyScale,
      cosYaw,
      sinYaw,
      MAT_GOLD,
      scalePx,
    )
    canvas.drawCapsule(
      [-0.12 * phyScale, 0, phylacteryZ - 0.11 * phyScale],
      [0.12 * phyScale, 0, phylacteryZ - 0.11 * phyScale],
      0.035 * phyScale,
      0.035 * phyScale,
      cosYaw,
      sinYaw,
      MAT_GOLD,
      scalePx,
    )
    canvas.drawCapsule(
      [0, 0, phylacteryZ + 0.15 * phyScale],
      [0, 0, phylacteryZ + 0.24 * phyScale],
      0.04 * phyScale,
      0.015 * phyScale,
      cosYaw,
      sinYaw,
      MAT_GOLD,
      scalePx,
    )
    canvas.drawGlowHalo([0, 0, phylacteryZ], 0.34 * phyScale, cosYaw, sinYaw, [70, 210, 255], 0.85, false, scalePx)

    return {
      width,
      height,
      pixels: canvas.pixels,
      glowPixels: canvas.glowPixels,
      footX,
      footY,
    }
  }

  // Hovering height & body tilt per animation mode
  let hoverZ = 0.28 + 0.045 * Math.sin(tau)
  let leanY = 0.0
  let torsoTwist = 0.0
  let castLift = 0.0
  let slashSwing = 0.0
  let hitBack = 0.0

  if (clip === 'wl') {
    hoverZ = 0.3 + 0.04 * Math.sin(tau)
    leanY = 0.12
    torsoTwist = 0.12 * Math.sin(tau)
  } else if (clip === 'rn') {
    hoverZ = 0.33 + 0.05 * Math.sin(tau)
    leanY = 0.22
    torsoTwist = 0.18 * Math.sin(tau)
  } else if (clip === 'sc') {
    const bell = Math.sin(phase * Math.PI)
    hoverZ = 0.3 + 0.14 * bell
    castLift = bell
    leanY = -0.06 * bell
  } else if (clip === 'a1') {
    // Windup 0..0.35, cleave 0.35..0.75, recover 0.75..1.0
    if (phase < 0.35) {
      slashSwing = -0.6 * (phase / 0.35)
    } else if (phase < 0.75) {
      slashSwing = -0.6 + 1.65 * ((phase - 0.35) / 0.4)
    } else {
      slashSwing = 1.05 * (1 - (phase - 0.75) / 0.25)
    }
    leanY = 0.1 * Math.max(0, slashSwing)
    torsoTwist = -0.35 * slashSwing
  } else if (clip === 'gh') {
    const shock = Math.sin(phase * Math.PI)
    hitBack = shock * 0.18
    leanY = -shock * 0.22
  }

  // 1. Swirling necrotic frost-mist vortex beneath hovering robes (additive glow)
  canvas.drawGlowHalo([0, 0, 0.12], 0.34, cosYaw, sinYaw, [55, 165, 235], 0.42 + 0.25 * castLift, true, scalePx)
  for (let m = 0; m < 3; m += 1) {
    const ma = tau + (m * Math.PI * 2) / 3
    canvas.drawGlowHalo(
      [Math.cos(ma) * 0.18, Math.sin(ma) * 0.18, 0.16 + 0.04 * m],
      0.13,
      cosYaw,
      sinYaw,
      [75, 200, 255],
      0.38,
      true,
      scalePx,
    )
  }

  // 2. Lower tattered floating robes & trailing necrotic sashes (no legs — hovering Lich!)
  const swayX = 0.05 * Math.sin(tau)
  const trailY = -leanY * 0.9 - 0.06
  for (let s = 0; s < 5; s += 1) {
    const ang = (s / 5) * Math.PI * 2 + 0.3
    const topX = Math.cos(ang) * 0.14
    const topY = Math.sin(ang) * 0.12 + leanY * 0.3 - hitBack * 0.4
    const botX = Math.cos(ang) * 0.22 + swayX * (s % 2 === 0 ? 1 : -1)
    const botY = Math.sin(ang) * 0.18 + trailY + 0.04 * Math.cos(tau + s)
    canvas.drawCapsule(
      [topX, topY, hoverZ + 0.48],
      [botX, botY, hoverZ + 0.02 + (s % 2) * 0.05],
      0.11,
      0.045,
      cosYaw,
      sinYaw,
      s % 2 === 0 ? MAT_ROBE_SHADOW : MAT_ROBE_ROYAL,
      scalePx,
    )
  }

  // Grand trailing Archlich back cape
  canvas.drawCapsule(
    [-0.14, -0.1 + leanY * 0.4 - hitBack, hoverZ + 0.92],
    [-0.22 + swayX, -0.26 + trailY, hoverZ + 0.12],
    0.14,
    0.09,
    cosYaw,
    sinYaw,
    MAT_ROBE_ROYAL,
    scalePx,
  )
  canvas.drawCapsule(
    [0.14, -0.1 + leanY * 0.4 - hitBack, hoverZ + 0.92],
    [0.22 + swayX, -0.26 + trailY, hoverZ + 0.12],
    0.14,
    0.09,
    cosYaw,
    sinYaw,
    MAT_ROBE_ROYAL,
    scalePx,
  )

  // Front ceremonial crimson-violet tabard & gold rune trim
  canvas.drawCapsule(
    [0, 0.11 + leanY * 0.35 - hitBack * 0.5, hoverZ + 0.58],
    [swayX * 0.7, 0.13 + trailY * 0.4, hoverZ + 0.08],
    0.095,
    0.065,
    cosYaw,
    sinYaw,
    MAT_SASH_CRIMSON_VIOLET,
    scalePx,
  )
  canvas.drawCapsule(
    [0, 0.14 + leanY * 0.35 - hitBack * 0.5, hoverZ + 0.58],
    [swayX * 0.7, 0.16 + trailY * 0.4, hoverZ + 0.12],
    0.032,
    0.024,
    cosYaw,
    sinYaw,
    MAT_GOLD,
    scalePx,
  )

  // 3. Swaying Frost-Rune Chains (left & right hip chains)
  for (const side of [-1, 1] as const) {
    const chainBaseX = side * 0.18
    const chainEndX = side * 0.25 + swayX * 1.1
    const chainEndY = 0.04 + trailY * 0.6 + 0.05 * Math.sin(tau + side)
    canvas.drawCapsule(
      [chainBaseX, 0.05 + leanY * 0.3, hoverZ + 0.56],
      [chainEndX, chainEndY, hoverZ + 0.14],
      0.028,
      0.024,
      cosYaw,
      sinYaw,
      MAT_CHAIN,
      scalePx,
    )
    // Glowing frost rune link at chain tip
    canvas.drawCapsule(
      [chainEndX, chainEndY, hoverZ + 0.14],
      [chainEndX, chainEndY, hoverZ + 0.09],
      0.038,
      0.022,
      cosYaw,
      sinYaw,
      MAT_FROST_CRYSTAL,
      scalePx,
    )
  }

  // 4. Skeletal Spine, Golden Waist Girdle, & Exposed Ivory Ribcage
  const chestX = 0
  const chestY = leanY * 0.65 - hitBack
  const chestZ = hoverZ + 0.82

  // Golden waist belt + frost buckle
  canvas.drawCapsule(
    [-0.15, chestY * 0.6, hoverZ + 0.58],
    [0.15, chestY * 0.6, hoverZ + 0.58],
    0.065,
    0.065,
    cosYaw,
    sinYaw,
    MAT_GOLD,
    scalePx,
  )
  canvas.drawCapsule(
    [0, chestY * 0.6 + 0.13, hoverZ + 0.58],
    [0, chestY * 0.6 + 0.15, hoverZ + 0.58],
    0.052,
    0.045,
    cosYaw,
    sinYaw,
    MAT_FROST_CRYSTAL,
    scalePx,
  )

  // Dark inner necrotic core + spine + exposed ribs
  canvas.drawCapsule(
    [0, chestY * 0.6, hoverZ + 0.6],
    [chestX, chestY, chestZ + 0.12],
    0.13,
    0.17,
    cosYaw,
    sinYaw,
    MAT_OBSIDIAN,
    scalePx,
  )
  for (let r = 0; r < 3; r += 1) {
    const rz = hoverZ + 0.68 + r * 0.09
    const rw = 0.13 + r * 0.022
    canvas.drawCapsule(
      [-rw, chestY + 0.09, rz],
      [rw, chestY + 0.09, rz],
      0.032,
      0.032,
      cosYaw,
      sinYaw,
      MAT_BONE,
      scalePx,
    )
  }

  // 5. Towering Tiered Naxxramas Pauldrons & Gold Collar Mantle
  const rotShoulder = (sx: number, sy: number): [number, number] => {
    const c = Math.cos(torsoTwist)
    const s = Math.sin(torsoTwist)
    return [sx * c - sy * s, sx * s + sy * c + chestY]
  }

  // High Archlich collar behind skull
  canvas.drawCapsule(
    [-0.18, chestY - 0.08, chestZ + 0.18],
    [0.18, chestY - 0.08, chestZ + 0.18],
    0.09,
    0.09,
    cosYaw,
    sinYaw,
    MAT_GOLD,
    scalePx,
  )
  canvas.drawCapsule(
    [0, chestY - 0.14, chestZ + 0.2],
    [0, chestY - 0.2, chestZ + 0.44],
    0.13,
    0.06,
    cosYaw,
    sinYaw,
    MAT_ROBE_ROYAL,
    scalePx,
  )

  for (const side of [-1, 1] as const) {
    const [shX, shY] = rotShoulder(side * 0.28, 0.0)
    const shZ = chestZ + 0.14 + 0.06 * castLift
    // Lower royal violet pauldron
    canvas.drawCapsule(
      [shX * 0.75, shY, shZ - 0.03],
      [shX * 1.18, shY, shZ + 0.04],
      0.12,
      0.095,
      cosYaw,
      sinYaw,
      MAT_ROBE_ROYAL,
      scalePx,
    )
    // Gold trim arch
    canvas.drawCapsule(
      [shX * 0.8, shY + 0.02, shZ + 0.03],
      [shX * 1.24, shY - 0.01, shZ + 0.1],
      0.065,
      0.05,
      cosYaw,
      sinYaw,
      MAT_GOLD,
      scalePx,
    )
    // Sweeping frost-crystal shoulder spike
    canvas.drawCapsule(
      [shX * 1.12, shY, shZ + 0.08],
      [shX * 1.42, shY - 0.04, shZ + 0.25],
      0.052,
      0.018,
      cosYaw,
      sinYaw,
      MAT_FROST_CRYSTAL,
      scalePx,
    )
  }

  // 6. Skull Head, Glowing Lich Eyes, Long Braided Beard, & Iconic Winged Icecrown Headdress
  const headX = 0
  const headY = chestY + 0.03
  const headZ = chestZ + 0.3

  // Cranium & jaw
  canvas.drawCapsule(
    [headX, headY, headZ - 0.04],
    [headX, headY + 0.03, headZ + 0.09],
    0.125,
    0.135,
    cosYaw,
    sinYaw,
    MAT_BONE,
    scalePx,
  )
  canvas.drawCapsule(
    [headX, headY + 0.07, headZ - 0.09],
    [headX, headY + 0.09, headZ - 0.02],
    0.075,
    0.085,
    cosYaw,
    sinYaw,
    MAT_DARK_BONE,
    scalePx,
  )

  // Glowing cyan Lich eye sockets
  for (const side of [-1, 1] as const) {
    canvas.drawCapsule(
      [side * 0.052, headY + 0.125, headZ + 0.02],
      [side * 0.058, headY + 0.135, headZ + 0.025],
      0.028,
      0.024,
      cosYaw,
      sinYaw,
      MAT_EYE_FLAME,
      scalePx,
    )
    canvas.drawGlowHalo(
      [side * 0.055, headY + 0.14, headZ + 0.022],
      0.075,
      cosYaw,
      sinYaw,
      [90, 230, 255],
      0.65,
      false,
      scalePx,
    )
  }

  // Iconic long braided white/silver Kel'Thuzad beard hanging down front of chest
  const beardSwayX = swayX * 0.8
  canvas.drawCapsule(
    [0, headY + 0.11, headZ - 0.09],
    [beardSwayX * 0.5, headY + 0.16, headZ - 0.32],
    0.052,
    0.038,
    cosYaw,
    sinYaw,
    MAT_BEARD,
    scalePx,
  )
  canvas.drawCapsule(
    [beardSwayX * 0.5, headY + 0.16, headZ - 0.32],
    [beardSwayX, headY + 0.18, headZ - 0.54],
    0.036,
    0.016,
    cosYaw,
    sinYaw,
    MAT_BEARD,
    scalePx,
  )
  // Golden beard clasp
  canvas.drawCapsule(
    [beardSwayX * 0.5, headY + 0.16, headZ - 0.31],
    [beardSwayX * 0.5, headY + 0.16, headZ - 0.35],
    0.044,
    0.044,
    cosYaw,
    sinYaw,
    MAT_GOLD,
    scalePx,
  )

  // Iconic towering twin-winged Gold & Obsidian Archlich Crown (Phylactery Headdress!)
  canvas.drawCapsule(
    [-0.14, headY + 0.01, headZ + 0.12],
    [0.14, headY + 0.01, headZ + 0.12],
    0.068,
    0.068,
    cosYaw,
    sinYaw,
    MAT_GOLD,
    scalePx,
  )
  // Central spire & Frost Sapphire Crown Gem
  canvas.drawCapsule(
    [0, headY + 0.04, headZ + 0.14],
    [0, headY + 0.02, headZ + 0.42],
    0.065,
    0.022,
    cosYaw,
    sinYaw,
    MAT_GOLD,
    scalePx,
  )
  canvas.drawCapsule(
    [0, headY + 0.09, headZ + 0.18],
    [0, headY + 0.1, headZ + 0.27],
    0.045,
    0.035,
    cosYaw,
    sinYaw,
    MAT_FROST_CRYSTAL,
    scalePx,
  )
  canvas.drawGlowHalo([0, headY + 0.1, headZ + 0.22], 0.13, cosYaw, sinYaw, [80, 215, 255], 0.7, false, scalePx)

  // Twin sweeping side crown wings (makes Kel'Thuzad's silhouette unmistakable from all 8 angles!)
  for (const side of [-1, 1] as const) {
    canvas.drawCapsule(
      [side * 0.12, headY, headZ + 0.13],
      [side * 0.34, headY - 0.05, headZ + 0.34],
      0.058,
      0.032,
      cosYaw,
      sinYaw,
      MAT_GOLD,
      scalePx,
    )
    canvas.drawCapsule(
      [side * 0.28, headY - 0.04, headZ + 0.28],
      [side * 0.38, headY - 0.08, headZ + 0.48],
      0.042,
      0.016,
      cosYaw,
      sinYaw,
      MAT_OBSIDIAN,
      scalePx,
    )
  }

  // 7. Skeletal Arms & Ornate Frost Runestaff / Scepter
  const [rShX, rShY] = rotShoulder(-0.27, 0.02)
  const [lShX, lShY] = rotShoulder(0.27, 0.02)
  const armShZ = chestZ + 0.08

  let rHand: Vec3 = [rShX - 0.08, rShY + 0.22, chestZ - 0.06 + 0.03 * Math.sin(tau)]
  let lHand: Vec3 = [lShX + 0.08, lShY + 0.18, chestZ - 0.08 - 0.03 * Math.sin(tau)]

  if (clip === 'sc') {
    // Dramatic skyward Lich invocation!
    rHand = [rShX - 0.12, rShY + 0.16, chestZ + 0.05 + 0.42 * castLift]
    lHand = [lShX + 0.14, lShY + 0.18, chestZ + 0.05 + 0.44 * castLift]
  } else if (clip === 'a1') {
    rHand = [
      rShX - 0.04 + slashSwing * 0.32,
      rShY + 0.26 + Math.abs(slashSwing) * 0.08,
      chestZ + 0.06 - slashSwing * 0.18,
    ]
    lHand = [lShX + 0.1, lShY + 0.12, chestZ - 0.05]
  } else if (clip === 'gh') {
    rHand = [rShX - 0.16, rShY - 0.04, chestZ + 0.12]
    lHand = [lShX + 0.16, lShY - 0.04, chestZ + 0.12]
  }

  // Draw right & left skeletal arms + draped wizard sleeves
  for (const [shPos, handPos] of [
    [[rShX, rShY, armShZ] as Vec3, rHand],
    [[lShX, lShY, armShZ] as Vec3, lHand],
  ] as const) {
    const mid: Vec3 = [
      (shPos[0] + handPos[0]) * 0.5,
      (shPos[1] + handPos[1]) * 0.5 - 0.03,
      (shPos[2] + handPos[2]) * 0.5 - 0.04,
    ]
    canvas.drawCapsule(shPos, mid, 0.062, 0.052, cosYaw, sinYaw, MAT_ROBE_SHADOW, scalePx)
    canvas.drawCapsule(mid, handPos, 0.044, 0.036, cosYaw, sinYaw, MAT_BONE, scalePx)
    // Tattered hanging sleeve cuff
    canvas.drawCapsule(mid, [mid[0], mid[1] - 0.03, mid[2] - 0.2], 0.05, 0.022, cosYaw, sinYaw, MAT_ROBE_ROYAL, scalePx)
  }

  // Left-hand necrotic frost orb when casting (`sc`) or idling
  if (clip === 'sc' && castLift > 0.15) {
    const orbPos: Vec3 = [lHand[0], lHand[1] + 0.04, lHand[2] + 0.1]
    canvas.drawCapsule(orbPos, [orbPos[0], orbPos[1], orbPos[2] + 0.04], 0.065 * castLift, 0.05 * castLift, cosYaw, sinYaw, MAT_FROST_CRYSTAL, scalePx)
    canvas.drawGlowHalo(orbPos, 0.32 * castLift, cosYaw, sinYaw, [85, 225, 255], 0.9 * castLift, true, scalePx)
    // Swirling arcane frost rune ring around Kel'Thuzad during spellcast!
    for (let k = 0; k < 6; k += 1) {
      const ra = phase * Math.PI * 4 + (k * Math.PI) / 3
      const rx = Math.cos(ra) * (0.38 + 0.08 * castLift)
      const ry = Math.sin(ra) * (0.38 + 0.08 * castLift)
      const rz = hoverZ + 0.35 + 0.45 * castLift * ((k % 2) * 0.35 + 0.3)
      canvas.drawCapsule([rx, ry, rz], [rx, ry, rz + 0.06], 0.036, 0.018, cosYaw, sinYaw, MAT_FROST_CRYSTAL, scalePx)
      canvas.drawGlowHalo([rx, ry, rz + 0.03], 0.14, cosYaw, sinYaw, [75, 215, 255], 0.7 * castLift, true, scalePx)
    }
  }

  // Right-hand Ornate Skull Frost Scepter / Phylactery Staff
  const staffDirX = clip === 'a1' ? slashSwing * 0.42 : -0.04
  const staffDirY = clip === 'a1' ? 0.28 : 0.08
  const staffBot: Vec3 = [rHand[0] - staffDirX * 0.55, rHand[1] - staffDirY * 0.4, rHand[2] - 0.38]
  const staffTop: Vec3 = [rHand[0] + staffDirX * 0.85, rHand[1] + staffDirY * 0.8, rHand[2] + 0.48]
  canvas.drawCapsule(staffBot, staffTop, 0.028, 0.034, cosYaw, sinYaw, MAT_OBSIDIAN, scalePx)
  // Gold scepter head prongs
  const headBase: Vec3 = [
    staffTop[0] - staffDirX * 0.12,
    staffTop[1] - staffDirY * 0.12,
    staffTop[2] - 0.08,
  ]
  canvas.drawCapsule(headBase, [staffTop[0] - 0.08, staffTop[1], staffTop[2] + 0.04], 0.038, 0.02, cosYaw, sinYaw, MAT_GOLD, scalePx)
  canvas.drawCapsule(headBase, [staffTop[0] + 0.08, staffTop[1], staffTop[2] + 0.04], 0.038, 0.02, cosYaw, sinYaw, MAT_GOLD, scalePx)
  // Levitating Frost Crystal at scepter apex
  const crystalCenter: Vec3 = [staffTop[0], staffTop[1], staffTop[2] + 0.09]
  canvas.drawCapsule(
    [crystalCenter[0], crystalCenter[1], crystalCenter[2] - 0.06],
    [crystalCenter[0], crystalCenter[1], crystalCenter[2] + 0.07],
    0.055,
    0.028,
    cosYaw,
    sinYaw,
    MAT_FROST_CRYSTAL,
    scalePx,
  )
  canvas.drawGlowHalo(
    crystalCenter,
    0.22 + 0.12 * castLift,
    cosYaw,
    sinYaw,
    [80, 220, 255],
    0.82,
    true,
    scalePx,
  )

  // Sweeping icy blade arc trail during `a1` melee swing
  if (clip === 'a1' && phase >= 0.3 && phase <= 0.8) {
    for (let step = 1; step <= 4; step += 1) {
      const trailT = slashSwing - step * 0.22
      const tx = rShX - 0.04 + trailT * 0.6
      const ty = rShY + 0.42
      const tz = chestZ + 0.35 - trailT * 0.25
      canvas.drawGlowHalo([tx, ty, tz], 0.16 - step * 0.025, cosYaw, sinYaw, [90, 225, 255], 0.65 - step * 0.12, true, scalePx)
    }
  }

  return {
    width,
    height,
    pixels: canvas.pixels,
    glowPixels: canvas.glowPixels,
    footX,
    footY,
  }
}

function buildPreviewPortrait(): { readonly width: number; readonly height: number; readonly pixels: Uint8Array } {
  const size = 128
  const frame = renderKelthuzadPose(
    { clip: 'sc', phase: 0.45, dirIdx: 0, totalDirs: 8 },
    size,
    size,
    64,
    112,
    50,
  )
  const out = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4
      // Subtle dark Naxxramas vignette backdrop
      const radial = Math.hypot(x - 64, y - 60) / 76
      const bg = Math.max(0, 1 - radial)
      let r = Math.round(12 + 18 * bg)
      let g = Math.round(14 + 26 * bg)
      let b = Math.round(24 + 44 * bg)

      const a = frame.pixels[idx + 3]! / 255
      if (a > 0) {
        r = Math.round(frame.pixels[idx]! * a + r * (1 - a))
        g = Math.round(frame.pixels[idx + 1]! * a + g * (1 - a))
        b = Math.round(frame.pixels[idx + 2]! * a + b * (1 - a))
      }
      r = Math.min(255, r + frame.glowPixels![idx]!)
      g = Math.min(255, g + frame.glowPixels![idx + 1]!)
      b = Math.min(255, b + frame.glowPixels![idx + 2]!)

      out[idx] = r
      out[idx + 1] = g
      out[idx + 2] = b
      out[idx + 3] = 255
    }
  }
  return { width: size, height: size, pixels: out }
}

export function generateKelthuzadSkinBundle(): PackedCharacterSkinBundle {
  const directions = 8
  const clipSpecs: readonly {
    readonly key: string
    readonly frames: number
    readonly speed: number
    readonly loop: boolean
  }[] = [
    { key: 'nu', frames: 8, speed: 128, loop: true },
    { key: 'wl', frames: 8, speed: 256, loop: true },
    { key: 'rn', frames: 8, speed: 256, loop: true },
    { key: 'sc', frames: 12, speed: 256, loop: false },
    { key: 'a1', frames: 10, speed: 256, loop: false },
    { key: 'gh', frames: 6, speed: 256, loop: false },
    { key: 'dt', frames: 14, speed: 176, loop: false },
  ]

  const clips: RawSkinClipInput[] = clipSpecs.map((spec) => {
    const dirArrays: RawRgbaSkinFrame[][] = []
    for (let d = 0; d < directions; d += 1) {
      const frames: RawRgbaSkinFrame[] = []
      for (let f = 0; f < spec.frames; f += 1) {
        const phase = spec.loop ? f / spec.frames : f / Math.max(1, spec.frames - 1)
        frames.push(
          renderKelthuzadPose({
            clip: spec.key,
            phase,
            dirIdx: d,
            totalDirs: directions,
          }),
        )
      }
      dirArrays.push(frames)
    }
    return {
      key: spec.key,
      speed: spec.speed,
      loop: spec.loop,
      directions: dirArrays,
    }
  })

  const input: PackCharacterSkinInput = {
    id: 'ne-kelthuzad',
    name: {
      zh: '巫妖克尔苏加德',
      en: "Kel'Thuzad (Archlich)",
    },
    description: {
      zh: '纳克萨玛斯大巫妖整套天灾军团外观：巫妖浮空飘行、双翼寒冰王冠、护命匣阵亡形态，并同步将死灵召唤物替换为魔兽争霸3天灾军团（食尸鬼、亡灵巫师、憎恶、血肉憎恶、地穴领主、地狱火）与专属头像。',
      en: "Archlich of Naxxramas + Warcraft III Scourge summon set: hovering Kel'Thuzad with Frost Crown & Phylactery death form, plus Ghoul, Necromancer, Abomination, Blood Abomination, Crypt Lord, and Infernal summons & HUD portraits.",
    },
    targetClass: 'ne',
    directions,
    renderScale: 0.72,
    floating: true,
    shadowOffsetY: 12,
    shadowScale: 0.72,
    respectMorph: false,
    clips,
    previewRgba: buildPreviewPortrait(),
    minions: generateScourgeMinionsInput(),
  }

  return packCharacterSkinBundle(input)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const outRoot = process.argv[2] ? resolve(process.argv[2]) : resolve(process.cwd(), 'public', 'skins')
  const t0 = performance.now()
  const bundle = generateKelthuzadSkinBundle()
  writeSkinBundleToPublicSkinsDir(bundle, outRoot, true)
  const elapsedMs = (performance.now() - t0).toFixed(0)
  const totalBytes = Object.values(bundle.files).reduce((s, b) => s + b.byteLength, 0)
  console.log(
    `Baked ${bundle.manifest.id} -> ${outRoot}/${bundle.manifest.id} (${String(bundle.manifest.groups.length)} groups, ${(totalBytes / 1024).toFixed(1)} KB unpacked, ${(bundle.zipBytes.byteLength / 1024).toFixed(1)} KB .d2skin.zip) in ${elapsedMs} ms`,
  )
}
