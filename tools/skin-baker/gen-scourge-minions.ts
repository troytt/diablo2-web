/**
 * Offline Warcraft III Undead Scourge Summon Set & HUD Portrait Generator
 * (`tools/skin-baker/gen-scourge-minions.ts`).
 *
 * Generates the 6 bundled Necromancer summon skins + 6 WC3-framed `92x82` top-left HUD
 * portraits for `ne-kelthuzad` using a stylized chunky low-poly 3D isometric Z-buffer
 * rasterizer (quantized hand-painted facet bands + depth-crease & silhouette ink pass):
 *   - `necroskeleton` (363) -> 食尸鬼 (Ghoul)
 *   - `necromage`     (364) -> 亡灵巫师 (Necromancer, neutral-core orb tinted 4-way at runtime)
 *   - `claygolem`     (289) -> 憎恶 (Abomination)
 *   - `bloodgolem`    (290) -> 血肉憎恶 (Blood Abomination)
 *   - `irongolem`     (291) -> 地穴领主 (Crypt Lord)
 *   - `firegolem`     (292) -> 地狱火 (Infernal)
 */

import type { PackMinionSkinInput, RawRgbaSkinFrame, RawSkinClipInput } from './pack-skin.ts'

type Vec3 = readonly [number, number, number]
type Rgb = readonly [number, number, number]

interface Wc3Mat {
  readonly color: Rgb
  readonly rimColor?: Rgb | undefined
  readonly rimStrength?: number | undefined
  readonly glow?: Rgb | undefined
  readonly flatGlow?: boolean | undefined
}

const SIN_PITCH = 0.5
const COS_PITCH = Math.sqrt(1 - SIN_PITCH * SIN_PITCH)

const KEY_LIGHT: Vec3 = (() => {
  const lx = -0.45
  const ly = -0.58
  const lz = 0.68
  const inv = 1 / Math.hypot(lx, ly, lz)
  return [lx * inv, ly * inv, lz * inv]
})()

function rotateYawAndProject(
  p: Vec3,
  cosYaw: number,
  sinYaw: number,
  sinPitch = SIN_PITCH,
  cosPitch = COS_PITCH,
): Vec3 {
  const wx = p[0] * cosYaw - p[1] * sinYaw
  const wy = p[0] * sinYaw + p[1] * cosYaw
  const wz = p[2]
  return [wx, wy * sinPitch - wz * cosPitch, wy * cosPitch + wz * sinPitch]
}

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function clampByte(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v)
}

/**
 * Stylized WC3 chunky low-poly Z-buffer canvas with quantized hand-painted shading,
 * planar triangle/prism support, emissive glow buffer, and crease/outline ink pass.
 */
class Wc3ZBufferCanvas {
  readonly width: number
  readonly height: number
  readonly footX: number
  readonly footY: number
  readonly scalePx: number
  readonly pixels: Uint8Array
  readonly glowPixels: Uint8Array
  private readonly zbuf: Float32Array
  private sinPitch = SIN_PITCH
  private cosPitch = COS_PITCH

  constructor(width: number, height: number, footX: number, footY: number, scalePx: number) {
    this.width = width
    this.height = height
    this.footX = footX
    this.footY = footY
    this.scalePx = scalePx
    this.pixels = new Uint8Array(width * height * 4)
    this.glowPixels = new Uint8Array(width * height * 4)
    this.zbuf = new Float32Array(width * height)
    this.zbuf.fill(-1e9)
  }

  setCameraPitchDegrees(deg: number): void {
    const rad = (deg * Math.PI) / 180
    this.sinPitch = Math.sin(rad)
    this.cosPitch = Math.cos(rad)
  }

  private shadeWc3Facet(nx: number, ny: number, nz: number, mat: Wc3Mat): Rgb {
    if (mat.flatGlow) return mat.color
    const ndotl = Math.max(0, nx * KEY_LIGHT[0] + ny * KEY_LIGHT[1] + nz * KEY_LIGHT[2])
    // Quantized 4-step WC3 hand-painted facet bands for crisp chunky readability
    const band =
      ndotl > 0.78 ? 1.24 : ndotl > 0.48 ? 1.02 : ndotl > 0.22 ? 0.76 : 0.52
    const rim = Math.pow(1 - Math.max(0, nz), 2.1) * (mat.rimStrength ?? 0.32)
    const rimCol = mat.rimColor ?? [155, 195, 235]
    return [
      clampByte(mat.color[0] * band + rimCol[0] * rim),
      clampByte(mat.color[1] * band + rimCol[1] * rim),
      clampByte(mat.color[2] * band + rimCol[2] * rim),
    ]
  }

  private writeGlowPixel(idx4: number, glow: Rgb, intensity: number): void {
    const gr = clampByte(glow[0] * intensity)
    const gg = clampByte(glow[1] * intensity)
    const gb = clampByte(glow[2] * intensity)
    const ga = clampByte(Math.max(gr, gg, gb))
    if (gr > this.glowPixels[idx4]!) this.glowPixels[idx4] = gr
    if (gg > this.glowPixels[idx4 + 1]!) this.glowPixels[idx4 + 1] = gg
    if (gb > this.glowPixels[idx4 + 2]!) this.glowPixels[idx4 + 2] = gb
    if (ga > this.glowPixels[idx4 + 3]!) this.glowPixels[idx4 + 3] = ga
  }

  drawCapsule(
    aModel: Vec3,
    bModel: Vec3,
    radiusA: number,
    radiusB: number,
    cosYaw: number,
    sinYaw: number,
    mat: Wc3Mat,
  ): void {
    const a = rotateYawAndProject(aModel, cosYaw, sinYaw, this.sinPitch, this.cosPitch)
    const b = rotateYawAndProject(bModel, cosYaw, sinYaw, this.sinPitch, this.cosPitch)
    const s = this.scalePx

    const ax = this.footX + a[0] * s
    const ay = this.footY + a[1] * s
    const az = a[2] * s
    const bx = this.footX + b[0] * s
    const by = this.footY + b[1] * s
    const bz = b[2] * s

    const ra = radiusA * s
    const rb = radiusB * s
    const maxR = Math.max(ra, rb) + 1.5

    const minX = Math.max(0, Math.floor(Math.min(ax, bx) - maxR))
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(ax, bx) + maxR))
    const minY = Math.max(0, Math.floor(Math.min(ay, by) - maxR))
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(ay, by) + maxR))

    const abx = bx - ax
    const aby = by - ay
    const abz = bz - az
    const abLenSq = abx * abx + aby * aby

    for (let py = minY; py <= maxY; py += 1) {
      const cy = py + 0.5
      for (let px = minX; px <= maxX; px += 1) {
        const cx = px + 0.5
        let t = 0
        if (abLenSq > 1e-4) {
          t = ((cx - ax) * abx + (cy - ay) * aby) / abLenSq
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
        const pIdx = py * this.width + px
        if (z < this.zbuf[pIdx]!) continue
        this.zbuf[pIdx] = z

        const invR = 1 / r
        const rgb = this.shadeWc3Facet(dx * invR, dy * invR, dz * invR, mat)
        const off = pIdx * 4
        this.pixels[off] = rgb[0]
        this.pixels[off + 1] = rgb[1]
        this.pixels[off + 2] = rgb[2]
        this.pixels[off + 3] = 255

        if (mat.glow) {
          this.writeGlowPixel(off, mat.glow, 0.7 + 0.3 * (dz * invR))
        }
      }
    }
  }

  drawSphere(center: Vec3, radius: number, cosYaw: number, sinYaw: number, mat: Wc3Mat): void {
    this.drawCapsule(center, center, radius, radius, cosYaw, sinYaw, mat)
  }

  /**
   * Rasterizes a 3D double-sided planar triangle with flat low-poly normal shading
   * (ideal for WC3 cleavers, chitin horns, angular meteor boulders, spikes, and pauldrons).
   */
  drawTriangle3D(
    p0Model: Vec3,
    p1Model: Vec3,
    p2Model: Vec3,
    cosYaw: number,
    sinYaw: number,
    mat: Wc3Mat,
  ): void {
    const p0 = rotateYawAndProject(p0Model, cosYaw, sinYaw, this.sinPitch, this.cosPitch)
    const p1 = rotateYawAndProject(p1Model, cosYaw, sinYaw, this.sinPitch, this.cosPitch)
    const p2 = rotateYawAndProject(p2Model, cosYaw, sinYaw, this.sinPitch, this.cosPitch)
    const s = this.scalePx

    const x0 = this.footX + p0[0] * s
    const y0 = this.footY + p0[1] * s
    const z0 = p0[2] * s
    const x1 = this.footX + p1[0] * s
    const y1 = this.footY + p1[1] * s
    const z1 = p1[2] * s
    const x2 = this.footX + p2[0] * s
    const y2 = this.footY + p2[1] * s
    const z2 = p2[2] * s

    const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0)
    if (Math.abs(area) < 1e-3) return
    const invArea = 1 / area

    let n = cross3(sub3(p1, p0), sub3(p2, p0))
    const nLen = Math.hypot(n[0], n[1], n[2]) || 1
    const sign = n[2] < 0 ? -1 : 1
    n = [(n[0] / nLen) * sign, (n[1] / nLen) * sign, Math.abs(n[2] / nLen)]
    const rgb = this.shadeWc3Facet(n[0], n[1], n[2], mat)

    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)))
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(x0, x1, x2)))
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)))
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(y0, y1, y2)))

    for (let py = minY; py <= maxY; py += 1) {
      const cy = py + 0.5
      for (let px = minX; px <= maxX; px += 1) {
        const cx = px + 0.5
        const w0 = ((x1 - cx) * (y2 - cy) - (y1 - cy) * (x2 - cx)) * invArea
        const w1 = ((x2 - cx) * (y0 - cy) - (y2 - cy) * (x0 - cx)) * invArea
        const w2 = 1 - w0 - w1
        if (w0 < -0.002 || w1 < -0.002 || w2 < -0.002) continue

        const z = w0 * z0 + w1 * z1 + w2 * z2
        const pIdx = py * this.width + px
        if (z < this.zbuf[pIdx]!) continue
        this.zbuf[pIdx] = z
        const off = pIdx * 4
        this.pixels[off] = rgb[0]
        this.pixels[off + 1] = rgb[1]
        this.pixels[off + 2] = rgb[2]
        this.pixels[off + 3] = 255
        if (mat.glow) {
          this.writeGlowPixel(off, mat.glow, 0.85)
        }
      }
    }
  }

  drawQuad3D(
    a: Vec3,
    b: Vec3,
    c: Vec3,
    d: Vec3,
    cosYaw: number,
    sinYaw: number,
    mat: Wc3Mat,
  ): void {
    this.drawTriangle3D(a, b, c, cosYaw, sinYaw, mat)
    this.drawTriangle3D(a, c, d, cosYaw, sinYaw, mat)
  }

  /**
   * Renders an angular 8-face low-poly crystal/boulder chunk (signature WC3 Infernal/Armor block).
   */
  drawChunkyOctaRock(
    center: Vec3,
    rx: number,
    ry: number,
    rz: number,
    cosYaw: number,
    sinYaw: number,
    mat: Wc3Mat,
  ): void {
    const top: Vec3 = [center[0], center[1], center[2] + rz]
    const bot: Vec3 = [center[0], center[1], center[2] - rz]
    const px: Vec3 = [center[0] + rx, center[1], center[2]]
    const nx: Vec3 = [center[0] - rx, center[1], center[2]]
    const py: Vec3 = [center[0], center[1] + ry, center[2]]
    const ny: Vec3 = [center[0], center[1] - ry, center[2]]
    this.drawTriangle3D(top, px, py, cosYaw, sinYaw, mat)
    this.drawTriangle3D(top, py, nx, cosYaw, sinYaw, mat)
    this.drawTriangle3D(top, nx, ny, cosYaw, sinYaw, mat)
    this.drawTriangle3D(top, ny, px, cosYaw, sinYaw, mat)
    this.drawTriangle3D(bot, py, px, cosYaw, sinYaw, mat)
    this.drawTriangle3D(bot, nx, py, cosYaw, sinYaw, mat)
    this.drawTriangle3D(bot, ny, nx, cosYaw, sinYaw, mat)
    this.drawTriangle3D(bot, px, ny, cosYaw, sinYaw, mat)
  }

  drawGlowHalo(
    centerModel: Vec3,
    radius: number,
    cosYaw: number,
    sinYaw: number,
    color: Rgb,
    strength = 1.0,
    ignoreOcclusion = false,
  ): void {
    const c = rotateYawAndProject(centerModel, cosYaw, sinYaw, this.sinPitch, this.cosPitch)
    const cx = this.footX + c[0] * this.scalePx
    const cy = this.footY + c[1] * this.scalePx
    const cz = c[2] * this.scalePx
    const rPx = Math.max(1.5, radius * this.scalePx)

    const minX = Math.max(0, Math.floor(cx - rPx))
    const maxX = Math.min(this.width - 1, Math.ceil(cx + rPx))
    const minY = Math.max(0, Math.floor(cy - rPx))
    const maxY = Math.min(this.height - 1, Math.ceil(cy + rPx))

    for (let py = minY; py <= maxY; py += 1) {
      for (let px = minX; px <= maxX; px += 1) {
        const d = Math.hypot(px + 0.5 - cx, py + 0.5 - cy)
        if (d > rPx) continue
        const pIdx = py * this.width + px
        if (!ignoreOcclusion && this.zbuf[pIdx]! > cz + rPx * 0.45) continue
        const falloff = Math.pow(1 - d / rPx, 1.65) * strength
        this.writeGlowPixel(pIdx * 4, color, falloff)
      }
    }
  }

  /**
   * Applies a classic WC3 dark silhouette edge & internal depth-jump crease darkening pass
   * so chunky body parts, weapons, claws, and armor plates pop cleanly at D2 zoom.
   */
  applyWc3InkAndCreasePass(inkRgb: Rgb = [16, 14, 24], creaseThreshold = 9.5): void {
    const w = this.width
    const h = this.height
    const src = new Uint8Array(this.pixels)
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const

    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const idx = y * w + x
        const off = idx * 4
        if (src[off + 3]! === 0) continue

        let touchesEmpty = false
        let maxDepthDrop = 0
        const myZ = this.zbuf[idx]!
        for (const [dx, dy] of dirs) {
          const nIdx = (y + dy) * w + (x + dx)
          if (src[nIdx * 4 + 3]! === 0) {
            touchesEmpty = true
          } else {
            const dz = this.zbuf[nIdx]! - myZ
            if (dz > maxDepthDrop) maxDepthDrop = dz
          }
        }

        if (touchesEmpty) {
          this.pixels[off] = clampByte(src[off]! * 0.34 + inkRgb[0] * 0.66)
          this.pixels[off + 1] = clampByte(src[off + 1]! * 0.34 + inkRgb[1] * 0.66)
          this.pixels[off + 2] = clampByte(src[off + 2]! * 0.34 + inkRgb[2] * 0.66)
        } else if (maxDepthDrop > creaseThreshold) {
          this.pixels[off] = clampByte(src[off]! * 0.62)
          this.pixels[off + 1] = clampByte(src[off + 1]! * 0.62)
          this.pixels[off + 2] = clampByte(src[off + 2]! * 0.62)
        }
      }
    }
  }
}

interface PoseParams {
  readonly clip: string
  readonly phase: number
  readonly cosYaw: number
  readonly sinYaw: number
}

// ============================================================================
// 1. GHOUL (食尸鬼 — replaces Necro Skeleton #363)
// ============================================================================

const MAT_GHOUL_SKIN: Wc3Mat = { color: [132, 142, 126], rimColor: [185, 215, 195], rimStrength: 0.35 }
const MAT_GHOUL_BONE: Wc3Mat = { color: [208, 198, 172], rimColor: [245, 240, 220], rimStrength: 0.3 }
const MAT_GHOUL_CLAW: Wc3Mat = { color: [220, 226, 234], rimColor: [180, 255, 230], rimStrength: 0.45 }
const MAT_GHOUL_CLOTH: Wc3Mat = { color: [86, 44, 128], rimColor: [150, 95, 210], rimStrength: 0.3 }
const MAT_GHOUL_EYE: Wc3Mat = {
  color: [120, 255, 165],
  glow: [80, 255, 140],
  flatGlow: true,
}

function drawGhoulModel(cv: Wc3ZBufferCanvas, p: PoseParams): void {
  const { clip, phase, cosYaw, sinYaw } = p
  const tau = phase * Math.PI * 2
  let sinkZ = 0
  let collapse = 0
  let hunch = 0.22
  let slashR = 0
  let slashL = 0
  let walkSwing = 0
  let hitBack = 0

  if (clip === 'nu') {
    hunch += Math.sin(tau) * 0.03
  } else if (clip === 'wl') {
    walkSwing = Math.sin(tau) * 0.28
    hunch = 0.28
  } else if (clip === 'a1') {
    // WC3 Ghoul Frenzy double-claw alternating tear
    const s = Math.sin(phase * Math.PI)
    slashR = Math.sin(Math.min(1, phase * 1.6) * Math.PI) * 0.55
    slashL = Math.sin(Math.max(0, (phase - 0.25) * 1.33) * Math.PI) * 0.55
    hunch = 0.26 + s * 0.08
  } else if (clip === 'gh') {
    hitBack = Math.sin(phase * Math.PI) * 0.2
  } else if (clip === 's1') {
    sinkZ = -(1 - phase) * 0.95
    slashR = Math.sin(phase * Math.PI) * 0.35
  } else if (clip === 'dt') {
    collapse = Math.min(1, phase * 1.15)
  }

  if (collapse > 0.88) {
    // Collapsed skeleton/ghoul corpse pile with protruding spine & claws
    cv.drawCapsule([-0.24, -0.06, 0.08], [0.24, 0.08, 0.09], 0.11, 0.09, cosYaw, sinYaw, MAT_GHOUL_SKIN)
    cv.drawCapsule([-0.15, 0.05, 0.14], [0.16, -0.04, 0.14], 0.06, 0.06, cosYaw, sinYaw, MAT_GHOUL_BONE)
    cv.drawTriangle3D([0.22, 0.12, 0.06], [0.44, 0.2, 0.04], [0.26, 0.02, 0.11], cosYaw, sinYaw, MAT_GHOUL_CLAW)
    cv.drawTriangle3D([-0.22, 0.12, 0.06], [-0.42, 0.22, 0.04], [-0.26, 0.02, 0.11], cosYaw, sinYaw, MAT_GHOUL_CLAW)
    return
  }

  const baseZ = sinkZ - collapse * 0.55
  const hip: Vec3 = [0, -0.08 - hitBack * 0.4, Math.max(0.06, 0.42 + baseZ)]
  const chest: Vec3 = [0, 0.12 + hunch * 0.45 - hitBack, Math.max(0.1, 0.72 + baseZ - collapse * 0.2)]
  const head: Vec3 = [0, chest[1] + 0.2, Math.max(0.14, chest[2] + 0.12)]

  // Digitigrade hunched legs
  for (const side of [-1, 1] as const) {
    const stride = side * walkSwing
    const knee: Vec3 = [side * 0.17, hip[1] + 0.1 + stride * 0.5, Math.max(0.05, hip[2] - 0.16)]
    const foot: Vec3 = [side * 0.19, stride * 0.75, Math.max(0.02, 0.05 + sinkZ * 0.4)]
    cv.drawCapsule(hip, knee, 0.09, 0.075, cosYaw, sinYaw, MAT_GHOUL_SKIN)
    cv.drawCapsule(knee, foot, 0.07, 0.055, cosYaw, sinYaw, MAT_GHOUL_BONE)
  }

  // Tattered Scourge purple loincloth
  cv.drawQuad3D(
    [-0.16, hip[1] - 0.04, hip[2] + 0.04],
    [0.16, hip[1] - 0.04, hip[2] + 0.04],
    [0.13, hip[1] + 0.08, hip[2] - 0.2],
    [-0.13, hip[1] + 0.08, hip[2] - 0.2],
    cosYaw,
    sinYaw,
    MAT_GHOUL_CLOTH,
  )

  // Gaunt ribcage + hunched torso
  cv.drawCapsule(hip, chest, 0.13, 0.18, cosYaw, sinYaw, MAT_GHOUL_SKIN)
  for (let r = 0; r < 3; r += 1) {
    const rz = hip[2] + 0.1 + r * 0.08
    cv.drawCapsule([-0.15, hip[1] + 0.08, rz], [0.15, hip[1] + 0.08, rz], 0.032, 0.032, cosYaw, sinYaw, MAT_GHOUL_BONE)
  }

  // Signature WC3 Ghoul dorsal spine spikes!
  for (let i = 0; i < 4; i += 1) {
    const t = i / 3
    const sx = 0
    const sy = hip[1] + (chest[1] - hip[1]) * t - 0.08
    const sz = hip[2] + (chest[2] - hip[2]) * t + 0.08
    cv.drawTriangle3D(
      [sx - 0.04, sy, sz],
      [sx + 0.04, sy, sz],
      [sx, sy - 0.16, sz + 0.19],
      cosYaw,
      sinYaw,
      MAT_GHOUL_BONE,
    )
  }

  // Snarling skull-jaw head + glowing eyes
  cv.drawSphere(head, 0.145, cosYaw, sinYaw, MAT_GHOUL_BONE)
  cv.drawCapsule(
    [head[0] - 0.07, head[1] + 0.08, head[2] - 0.09],
    [head[0] + 0.07, head[1] + 0.08, head[2] - 0.09],
    0.055,
    0.055,
    cosYaw,
    sinYaw,
    MAT_GHOUL_SKIN,
  )
  for (const side of [-1, 1] as const) {
    const eye: Vec3 = [side * 0.055, head[1] + 0.125, head[2] + 0.015]
    cv.drawSphere(eye, 0.028, cosYaw, sinYaw, MAT_GHOUL_EYE)
    cv.drawGlowHalo(eye, 0.08, cosYaw, sinYaw, [70, 255, 140], 0.9)
  }

  // Oversized WC3 forearms + 3 long curved claws per hand
  for (const side of [-1, 1] as const) {
    const slash = side > 0 ? slashR : slashL
    const sh: Vec3 = [side * 0.23, chest[1] - 0.02, chest[2] + 0.03]
    const elbow: Vec3 = [
      side * (0.29 - slash * 0.12),
      chest[1] + 0.1 + slash * 0.25 - side * walkSwing * 0.35,
      chest[2] - 0.14 + slash * 0.18,
    ]
    const hand: Vec3 = [
      side * (0.22 - slash * 0.28),
      elbow[1] + 0.18 + slash * 0.26,
      elbow[2] - 0.12 - slash * 0.08,
    ]
    cv.drawCapsule(sh, elbow, 0.085, 0.075, cosYaw, sinYaw, MAT_GHOUL_SKIN)
    cv.drawCapsule(elbow, hand, 0.085, 0.095, cosYaw, sinYaw, MAT_GHOUL_SKIN)
    for (let c = -1; c <= 1; c += 1) {
      const base: Vec3 = [hand[0] + c * 0.045, hand[1] + 0.03, hand[2]]
      const tip: Vec3 = [
        hand[0] + c * 0.055 - side * slash * 0.12,
        hand[1] + 0.26 + slash * 0.12,
        hand[2] - 0.12,
      ]
      cv.drawTriangle3D(
        [base[0] - 0.022, base[1], base[2] + 0.02],
        [base[0] + 0.022, base[1], base[2] - 0.02],
        tip,
        cosYaw,
        sinYaw,
        MAT_GHOUL_CLAW,
      )
      if (slash > 0.25) {
        cv.drawGlowHalo(tip, 0.09, cosYaw, sinYaw, [120, 255, 190], slash * 0.85)
      }
    }
  }
}

// ============================================================================
// 2. WC3 NECROMANCER (亡灵巫师 — replaces Skeletal Mage #364)
//    Neutral bright glow on orb & staff gem so runtime tints 4-way by S4 element!
// ============================================================================

const MAT_NECRO_ROBE: Wc3Mat = { color: [76, 26, 62], rimColor: [168, 72, 145], rimStrength: 0.35 }
const MAT_NECRO_TRIM: Wc3Mat = { color: [198, 158, 68], rimColor: [255, 228, 130], rimStrength: 0.42 }
const MAT_NECRO_PAULDRON: Wc3Mat = { color: [52, 38, 74], rimColor: [145, 118, 205], rimStrength: 0.4 }
const MAT_NECRO_BEARD: Wc3Mat = { color: [216, 222, 232], rimColor: [255, 255, 255], rimStrength: 0.3 }
const MAT_NECRO_WOOD: Wc3Mat = { color: [92, 62, 42], rimColor: [155, 115, 84], rimStrength: 0.25 }
const MAT_NECRO_ORB_NEUTRAL: Wc3Mat = {
  color: [242, 246, 255],
  glow: [255, 255, 255],
  flatGlow: true,
}

function drawWc3NecromancerModel(cv: Wc3ZBufferCanvas, p: PoseParams): void {
  const { clip, phase, cosYaw, sinYaw } = p
  const tau = phase * Math.PI * 2
  const breathe = clip === 'nu' ? Math.sin(tau) * 0.03 : 0
  const stride = clip === 'wl' ? Math.sin(tau) * 0.2 : 0
  const castPulse = clip === 'a1' || clip === 'sc' ? Math.sin(phase * Math.PI) : 0
  const riseZ = clip === 's1' ? -(1 - phase) * 0.9 : 0
  const hitBack = clip === 'gh' ? Math.sin(phase * Math.PI) * 0.16 : 0
  const collapse = clip === 'dt' ? Math.min(1, phase * 1.15) : 0

  if (collapse > 0.88) {
    // Fallen crimson-violet robe & crooked skull staff on ground
    cv.drawCapsule([-0.26, -0.05, 0.07], [0.24, 0.06, 0.08], 0.14, 0.12, cosYaw, sinYaw, MAT_NECRO_ROBE)
    cv.drawCapsule([-0.34, 0.14, 0.05], [0.36, -0.14, 0.06], 0.035, 0.035, cosYaw, sinYaw, MAT_NECRO_WOOD)
    cv.drawSphere([0.38, -0.15, 0.08], 0.065, cosYaw, sinYaw, MAT_GHOUL_BONE)
    return
  }

  const baseZ = riseZ - collapse * 0.65
  const hemZ = Math.max(0.02, 0.05 + baseZ)
  const waistZ = Math.max(0.1, 0.56 + baseZ + breathe * 0.5)
  const chestZ = Math.max(0.16, 0.96 + baseZ + breathe)
  const headZ = chestZ + 0.24

  // Flowing flared WC3 robe skirt + gold front tabard
  cv.drawCapsule([0, -0.02, hemZ], [0, -hitBack * 0.5, waistZ], 0.28, 0.19, cosYaw, sinYaw, MAT_NECRO_ROBE)
  cv.drawCapsule([0, -hitBack * 0.5, waistZ], [0, -hitBack, chestZ], 0.18, 0.21, cosYaw, sinYaw, MAT_NECRO_ROBE)
  cv.drawQuad3D(
    [-0.08, 0.19, waistZ + 0.06],
    [0.08, 0.19, waistZ + 0.06],
    [0.11, 0.26 + stride * 0.2, hemZ + 0.04],
    [-0.11, 0.26 - stride * 0.2, hemZ + 0.04],
    cosYaw,
    sinYaw,
    MAT_NECRO_TRIM,
  )

  // Oversized WC3 horned skull pauldrons
  for (const side of [-1, 1] as const) {
    const pCenter: Vec3 = [side * 0.27, -hitBack, chestZ + 0.04]
    cv.drawChunkyOctaRock(pCenter, 0.13, 0.13, 0.09, cosYaw, sinYaw, MAT_NECRO_PAULDRON)
    cv.drawTriangle3D(
      [side * 0.24, -hitBack - 0.04, chestZ + 0.1],
      [side * 0.24, -hitBack + 0.06, chestZ + 0.1],
      [side * 0.44, -hitBack, chestZ + 0.24],
      cosYaw,
      sinYaw,
      MAT_NECRO_TRIM,
    )
  }

  // Hooded cowl + pale face + long white WC3 Necromancer beard
  cv.drawSphere([0, -hitBack, headZ + 0.02], 0.155, cosYaw, sinYaw, MAT_NECRO_ROBE)
  cv.drawTriangle3D(
    [-0.12, -hitBack - 0.04, headZ + 0.12],
    [0.12, -hitBack - 0.04, headZ + 0.12],
    [0, -hitBack - 0.12, headZ + 0.3],
    cosYaw,
    sinYaw,
    MAT_NECRO_ROBE,
  )
  // Flowing white beard down chest
  cv.drawTriangle3D(
    [-0.08, -hitBack + 0.13, headZ - 0.04],
    [0.08, -hitBack + 0.13, headZ - 0.04],
    [0, -hitBack + 0.19, headZ - 0.32],
    cosYaw,
    sinYaw,
    MAT_NECRO_BEARD,
  )
  // Glowing eyes (neutral white so elemental tint colors them too!)
  for (const side of [-1, 1] as const) {
    cv.drawSphere([side * 0.048, -hitBack + 0.14, headZ + 0.02], 0.024, cosYaw, sinYaw, MAT_NECRO_ORB_NEUTRAL)
  }

  // Right arm + tall crooked Skull Staff
  const staffThrust = castPulse * 0.24
  const rHand: Vec3 = [0.3, 0.14 + staffThrust - stride * 0.3, chestZ - 0.12 + castPulse * 0.14]
  cv.drawCapsule([0.24, -hitBack, chestZ], rHand, 0.075, 0.065, cosYaw, sinYaw, MAT_NECRO_ROBE)
  const staffBot: Vec3 = [rHand[0] + 0.02, rHand[1] - 0.04, Math.max(0.02, hemZ + 0.02)]
  const staffTop: Vec3 = [rHand[0] - 0.02, rHand[1] + 0.08, chestZ + 0.52 + castPulse * 0.08]
  cv.drawCapsule(staffBot, staffTop, 0.034, 0.04, cosYaw, sinYaw, MAT_NECRO_WOOD)
  cv.drawSphere(staffTop, 0.085, cosYaw, sinYaw, MAT_GHOUL_BONE)
  // Winged horns on staff skull + glowing elemental crystal above skull
  cv.drawTriangle3D(
    [staffTop[0] - 0.05, staffTop[1], staffTop[2] + 0.02],
    [staffTop[0] - 0.2, staffTop[1] - 0.03, staffTop[2] + 0.16],
    [staffTop[0] - 0.06, staffTop[1], staffTop[2] + 0.09],
    cosYaw,
    sinYaw,
    MAT_NECRO_TRIM,
  )
  cv.drawTriangle3D(
    [staffTop[0] + 0.05, staffTop[1], staffTop[2] + 0.02],
    [staffTop[0] + 0.2, staffTop[1] - 0.03, staffTop[2] + 0.16],
    [staffTop[0] + 0.06, staffTop[1], staffTop[2] + 0.09],
    cosYaw,
    sinYaw,
    MAT_NECRO_TRIM,
  )
  const gemPos: Vec3 = [staffTop[0], staffTop[1] + 0.02, staffTop[2] + 0.13]
  cv.drawSphere(gemPos, 0.055 + castPulse * 0.025, cosYaw, sinYaw, MAT_NECRO_ORB_NEUTRAL)
  cv.drawGlowHalo(gemPos, 0.2 + castPulse * 0.12, cosYaw, sinYaw, [255, 255, 255], 0.95)

  // Left arm + floating Elemental Spell Orb in palm!
  const lHand: Vec3 = [-0.28, 0.18 + castPulse * 0.3 + stride * 0.3, chestZ - 0.08 + castPulse * 0.2]
  cv.drawCapsule([-0.24, -hitBack, chestZ], lHand, 0.075, 0.065, cosYaw, sinYaw, MAT_NECRO_ROBE)
  const orbPos: Vec3 = [lHand[0] - 0.02, lHand[1] + 0.08, lHand[2] + 0.11]
  cv.drawSphere(orbPos, 0.075 + castPulse * 0.04, cosYaw, sinYaw, MAT_NECRO_ORB_NEUTRAL)
  cv.drawGlowHalo(orbPos, 0.26 + castPulse * 0.16, cosYaw, sinYaw, [255, 255, 255], 1.0)
}

// ============================================================================
// 3 & 4. ABOMINATION & BLOOD ABOMINATION (憎恶 #289 / 血肉憎恶 #290)
// ============================================================================

function drawAbominationVariant(cv: Wc3ZBufferCanvas, p: PoseParams, isBlood: boolean): void {
  const { clip, phase, cosYaw, sinYaw } = p
  const tau = phase * Math.PI * 2

  const fleshMat: Wc3Mat = isBlood
    ? { color: [146, 38, 46], rimColor: [235, 95, 95], rimStrength: 0.38 }
    : { color: [138, 156, 132], rimColor: [195, 222, 185], rimStrength: 0.32 }
  const stitchMat: Wc3Mat = isBlood
    ? { color: [48, 16, 22], rimColor: [180, 40, 50], rimStrength: 0.25 }
    : { color: [58, 44, 52], rimColor: [110, 95, 105], rimStrength: 0.2 }
  const mawMat: Wc3Mat = isBlood
    ? { color: [220, 42, 52], glow: [255, 45, 55] }
    : { color: [96, 32, 38], glow: [95, 235, 85] }
  const ironMat: Wc3Mat = isBlood
    ? { color: [72, 62, 70], rimColor: [240, 85, 85], rimStrength: 0.45 }
    : { color: [148, 156, 168], rimColor: [225, 235, 245], rimStrength: 0.45 }
  const glowRgb: Rgb = isBlood ? [255, 48, 58] : [95, 245, 90]

  const heave = clip === 'nu' ? Math.sin(tau) * 0.035 : 0
  const waddle = clip === 'wl' ? Math.sin(tau) * 0.22 : 0
  const chop = clip === 'a1' ? Math.sin(phase * Math.PI) : 0
  const riseZ = clip === 's1' ? -(1 - phase) * 1.15 : 0
  const hitBack = clip === 'gh' ? Math.sin(phase * Math.PI) * 0.18 : 0
  const collapse = clip === 'dt' ? Math.min(1, phase * 1.15) : 0

  if (collapse > 0.88) {
    // Massive stitched flesh mound + embedded butcher cleaver
    cv.drawCapsule([-0.34, -0.05, 0.14], [0.34, 0.08, 0.15], 0.24, 0.22, cosYaw, sinYaw, fleshMat)
    cv.drawQuad3D([0.28, 0.12, 0.12], [0.58, 0.2, 0.08], [0.56, 0.22, 0.34], [0.26, 0.12, 0.32], cosYaw, sinYaw, ironMat)
    cv.drawGlowHalo([0, 0.06, 0.2], 0.24, cosYaw, sinYaw, glowRgb, 0.65)
    return
  }

  const baseZ = riseZ - collapse * 0.72
  const bellyZ = Math.max(0.14, 0.62 + baseZ + heave * 0.5)
  const chestZ = Math.max(0.22, 1.04 + baseZ + heave)

  // Stumpy tree-trunk stitched legs
  for (const side of [-1, 1] as const) {
    const step = side * waddle
    cv.drawCapsule(
      [side * 0.24, step * 0.35, Math.max(0.08, 0.44 + baseZ)],
      [side * 0.26, step * 0.65, Math.max(0.02, 0.06 + riseZ * 0.3)],
      0.16,
      0.14,
      cosYaw,
      sinYaw,
      fleshMat,
    )
  }

  // Massive bloated WC3 Abomination belly + wide patchwork shoulders
  cv.drawSphere([0, 0.06 - hitBack * 0.5, bellyZ], 0.38, cosYaw, sinYaw, fleshMat)
  cv.drawCapsule([-0.24, -hitBack, chestZ], [0.24, -hitBack, chestZ], 0.28, 0.28, cosYaw, sinYaw, fleshMat)

  // Gaping jagged belly maw + glowing bile / arterial blood heart + rib teeth!
  const mawCenter: Vec3 = [0.02, 0.34 - hitBack * 0.5, bellyZ + 0.02]
  cv.drawCapsule([-0.14, mawCenter[1], mawCenter[2]], [0.16, mawCenter[1], mawCenter[2]], 0.11, 0.11, cosYaw, sinYaw, mawMat)
  cv.drawGlowHalo(mawCenter, 0.26, cosYaw, sinYaw, glowRgb, isBlood ? 0.95 : 0.75)
  for (let t = -1; t <= 1; t += 1) {
    cv.drawTriangle3D(
      [t * 0.09 - 0.025, mawCenter[1] + 0.04, mawCenter[2] + 0.09],
      [t * 0.09 + 0.025, mawCenter[1] + 0.04, mawCenter[2] + 0.09],
      [t * 0.09, mawCenter[1] + 0.06, mawCenter[2] + 0.01],
      cosYaw,
      sinYaw,
      MAT_GHOUL_BONE,
    )
  }

  // Dark diagonal X-stitch seams across shoulder & chest (or iron blood-bands)
  cv.drawCapsule([-0.28, 0.18 - hitBack, chestZ + 0.12], [0.22, 0.26 - hitBack, bellyZ + 0.18], 0.028, 0.028, cosYaw, sinYaw, stitchMat)
  if (isBlood) {
    // Spiked black-iron shoulder cages + glowing crimson runes on Blood Abomination
    for (const side of [-1, 1] as const) {
      cv.drawChunkyOctaRock([side * 0.38, -hitBack, chestZ + 0.1], 0.14, 0.14, 0.1, cosYaw, sinYaw, stitchMat)
      cv.drawTriangle3D(
        [side * 0.36, -hitBack - 0.04, chestZ + 0.18],
        [side * 0.36, -hitBack + 0.05, chestZ + 0.18],
        [side * 0.52, -hitBack, chestZ + 0.38],
        cosYaw,
        sinYaw,
        ironMat,
      )
    }
  } else {
    // Classic WC3 Abomination extra 3rd stitched arm stub sprouting from left shoulder!
    cv.drawCapsule([-0.34, -0.08 - hitBack, chestZ + 0.16], [-0.5, -0.14, chestZ + 0.34], 0.08, 0.06, cosYaw, sinYaw, fleshMat)
  }

  // Small hunched Stitch-head nestled between massive traps
  const headPos: Vec3 = [0.04, 0.18 - hitBack, chestZ + 0.22]
  cv.drawSphere(headPos, 0.15, cosYaw, sinYaw, fleshMat)
  for (const side of [-1, 1] as const) {
    const eye: Vec3 = [headPos[0] + side * 0.055, headPos[1] + 0.13, headPos[2] + 0.02]
    cv.drawSphere(eye, 0.028, cosYaw, sinYaw, { color: glowRgb, glow: glowRgb, flatGlow: true })
  }

  // Right Arm + GIANT WC3 Butcher Meat Cleaver!
  const rShoulder: Vec3 = [0.38, -hitBack, chestZ + 0.02]
  const chopAngle = chop * 1.15
  const rHand: Vec3 = [
    0.46 - chop * 0.18,
    0.16 + Math.sin(chopAngle) * 0.34 - waddle * 0.3,
    chestZ - 0.18 + (chop > 0 ? Math.cos(chop * Math.PI) * 0.28 : 0),
  ]
  cv.drawCapsule(rShoulder, rHand, 0.15, 0.13, cosYaw, sinYaw, fleshMat)
  // Rectangular heavy Butcher Cleaver blade
  const bladeA: Vec3 = [rHand[0], rHand[1] + 0.06, rHand[2] + 0.04]
  const bladeB: Vec3 = [rHand[0] - 0.06, rHand[1] + 0.46, rHand[2] - 0.08 - chop * 0.22]
  const bladeC: Vec3 = [rHand[0] - 0.06, rHand[1] + 0.44, rHand[2] + 0.24 - chop * 0.22]
  const bladeD: Vec3 = [rHand[0], rHand[1] + 0.06, rHand[2] + 0.28]
  cv.drawQuad3D(bladeA, bladeB, bladeC, bladeD, cosYaw, sinYaw, ironMat)
  if (isBlood || chop > 0.3) {
    cv.drawGlowHalo(bladeB, 0.16, cosYaw, sinYaw, glowRgb, isBlood ? 0.75 : chop * 0.7)
  }

  // Left Arm + Iron Meathook on Chain!
  const lShoulder: Vec3 = [-0.38, -hitBack, chestZ + 0.02]
  const lHand: Vec3 = [-0.46, 0.14 + waddle * 0.3 + chop * 0.2, chestZ - 0.22]
  cv.drawCapsule(lShoulder, lHand, 0.15, 0.13, cosYaw, sinYaw, fleshMat)
  const hookBase: Vec3 = [lHand[0], lHand[1] + 0.12, lHand[2] - 0.14]
  cv.drawCapsule(lHand, hookBase, 0.035, 0.035, cosYaw, sinYaw, stitchMat)
  cv.drawCapsule(hookBase, [hookBase[0] + 0.12, hookBase[1] + 0.14, hookBase[2] - 0.1], 0.042, 0.03, cosYaw, sinYaw, ironMat)
  cv.drawTriangle3D(
    [hookBase[0] + 0.12, hookBase[1] + 0.14, hookBase[2] - 0.1],
    [hookBase[0] + 0.02, hookBase[1] + 0.22, hookBase[2] + 0.05],
    [hookBase[0] + 0.15, hookBase[1] + 0.18, hookBase[2] - 0.02],
    cosYaw,
    sinYaw,
    ironMat,
  )
}

// ============================================================================
// 5. CRYPT LORD / ANUB'ARAK (地穴领主 — replaces Iron Golem #291)
// ============================================================================

const MAT_NERUB_SHELL: Wc3Mat = { color: [52, 62, 138], rimColor: [115, 165, 255], rimStrength: 0.45 }
const MAT_NERUB_DARK: Wc3Mat = { color: [34, 32, 66], rimColor: [95, 110, 195], rimStrength: 0.3 }
const MAT_NERUB_GOLD: Wc3Mat = { color: [212, 172, 74], rimColor: [255, 236, 145], rimStrength: 0.48 }
const MAT_NERUB_SPIKE: Wc3Mat = { color: [196, 206, 224], rimColor: [245, 252, 255], rimStrength: 0.4 }
const MAT_NERUB_GLOW: Wc3Mat = { color: [90, 235, 255], glow: [70, 225, 255], flatGlow: true }

function drawCryptLordModel(cv: Wc3ZBufferCanvas, p: PoseParams): void {
  const { clip, phase, cosYaw, sinYaw } = p
  const tau = phase * Math.PI * 2
  const breathe = clip === 'nu' ? Math.sin(tau) * 0.025 : 0
  const scuttle = clip === 'wl' ? Math.sin(tau) * 0.24 : 0
  const impale = clip === 'a1' ? Math.sin(phase * Math.PI) : 0
  const unburrowZ = clip === 's1' ? -(1 - phase) * 1.05 : 0
  const hitBack = clip === 'gh' ? Math.sin(phase * Math.PI) * 0.15 : 0
  const collapse = clip === 'dt' ? Math.min(1, phase * 1.15) : 0

  if (collapse > 0.88) {
    // Cracked upturned indigo-gold scarab carapace + curled legs
    cv.drawChunkyOctaRock([0, -0.04, 0.16], 0.38, 0.42, 0.16, cosYaw, sinYaw, MAT_NERUB_SHELL)
    cv.drawTriangle3D([0, 0.24, 0.14], [-0.06, 0.54, 0.08], [0.06, 0.5, 0.22], cosYaw, sinYaw, MAT_NERUB_GOLD)
    return
  }

  const baseZ = unburrowZ - collapse * 0.48
  const bodyZ = Math.max(0.14, 0.54 + baseZ + breathe)

  // 6 Segmented Chitinous Spider-Beetle Legs (3 per side, alternating gait)
  for (const side of [-1, 1] as const) {
    for (let legIdx = 0; legIdx < 3; legIdx += 1) {
      const yOff = (legIdx - 1) * 0.24
      const gait = ((legIdx % 2 === 0 ? 1 : -1) * side * scuttle) * 0.65
      const hip: Vec3 = [side * 0.28, yOff - hitBack * 0.5, bodyZ - 0.06]
      const knee: Vec3 = [side * 0.52, yOff + gait * 0.4, bodyZ + 0.14]
      const tip: Vec3 = [side * 0.58, yOff + gait, Math.max(0.02, 0.04 + unburrowZ * 0.3)]
      cv.drawCapsule(hip, knee, 0.065, 0.055, cosYaw, sinYaw, MAT_NERUB_DARK)
      cv.drawCapsule(knee, tip, 0.055, 0.03, cosYaw, sinYaw, MAT_NERUB_SHELL)
    }
  }

  // Massive domed Nerubian Wing-Carapace (Abdomen) + Gold trim + Thorns Spikes!
  const abdCenter: Vec3 = [0, -0.18 - hitBack, bodyZ + 0.14]
  cv.drawSphere(abdCenter, 0.38, cosYaw, sinYaw, MAT_NERUB_SHELL)
  cv.drawCapsule([-0.3, abdCenter[1], abdCenter[2] + 0.08], [0.3, abdCenter[1], abdCenter[2] + 0.08], 0.06, 0.06, cosYaw, sinYaw, MAT_NERUB_GOLD)

  // Dorsal Spiked Carapace thorns (matching Iron Golem Thorns aura!)
  for (const sx of [-0.18, 0, 0.18]) {
    for (const sy of [-0.3, -0.08]) {
      cv.drawTriangle3D(
        [sx - 0.045, sy - hitBack, bodyZ + 0.42],
        [sx + 0.045, sy - hitBack, bodyZ + 0.42],
        [sx * 1.35, sy - 0.08 - hitBack, bodyZ + 0.72],
        cosYaw,
        sinYaw,
        MAT_NERUB_SPIKE,
      )
    }
  }

  // Armored Cephalothorax + Pharaoh-Gold Crown Crest + Giant Curved Scarab Horn!
  const headPos: Vec3 = [0, 0.26 - hitBack, bodyZ + 0.12 + impale * 0.08]
  cv.drawChunkyOctaRock(headPos, 0.28, 0.24, 0.2, cosYaw, sinYaw, MAT_NERUB_SHELL)
  cv.drawChunkyOctaRock([0, headPos[1] - 0.02, headPos[2] + 0.18], 0.2, 0.14, 0.1, cosYaw, sinYaw, MAT_NERUB_GOLD)

  // Iconic upswept curved Scarab Rhinoceros Horn!
  const hornMid: Vec3 = [0, headPos[1] + 0.28 + impale * 0.14, headPos[2] + 0.14 + impale * 0.18]
  const hornTip: Vec3 = [0, headPos[1] + 0.44 + impale * 0.22, headPos[2] + 0.48 + impale * 0.26]
  cv.drawCapsule([0, headPos[1] + 0.12, headPos[2] + 0.02], hornMid, 0.095, 0.065, cosYaw, sinYaw, MAT_NERUB_GOLD)
  cv.drawTriangle3D(
    [-0.06, hornMid[1], hornMid[2]],
    [0.06, hornMid[1], hornMid[2]],
    hornTip,
    cosYaw,
    sinYaw,
    MAT_NERUB_SPIKE,
  )

  // Glowing cyan Nerubian cluster eyes
  for (const side of [-1, 1] as const) {
    const eye: Vec3 = [side * 0.12, headPos[1] + 0.19, headPos[2] + 0.03]
    cv.drawSphere(eye, 0.036, cosYaw, sinYaw, MAT_NERUB_GLOW)
    cv.drawGlowHalo(eye, 0.11, cosYaw, sinYaw, [70, 225, 255], 0.9)
  }

  // Twin Massive Raptorial Foreleg Scythe-Claws!
  for (const side of [-1, 1] as const) {
    const sh: Vec3 = [side * 0.34, headPos[1] + 0.02, bodyZ + 0.08]
    const elbow: Vec3 = [
      side * (0.48 - impale * 0.1),
      headPos[1] + 0.22 + impale * 0.2,
      bodyZ + 0.06 + impale * 0.22,
    ]
    const clawTip: Vec3 = [
      side * (0.24 - impale * 0.14),
      elbow[1] + 0.28 + impale * 0.16,
      bodyZ - 0.14 - impale * 0.1,
    ]
    cv.drawCapsule(sh, elbow, 0.11, 0.095, cosYaw, sinYaw, MAT_NERUB_SHELL)
    cv.drawTriangle3D(
      [elbow[0] - side * 0.06, elbow[1], elbow[2] + 0.08],
      [elbow[0] + side * 0.06, elbow[1], elbow[2] - 0.06],
      clawTip,
      cosYaw,
      sinYaw,
      MAT_NERUB_GOLD,
    )
    if (impale > 0.35) {
      // Impale ground chitin spike!
      cv.drawTriangle3D(
        [side * 0.18 - 0.05, 0.58, 0.02],
        [side * 0.18 + 0.05, 0.58, 0.02],
        [side * 0.18, 0.62, 0.42 * impale],
        cosYaw,
        sinYaw,
        MAT_NERUB_SPIKE,
      )
      cv.drawGlowHalo([side * 0.18, 0.58, 0.2], 0.14, cosYaw, sinYaw, [80, 235, 255], impale * 0.8)
    }
  }
}

// ============================================================================
// 6. INFERNAL (地狱火 — replaces Fire Golem #292)
// ============================================================================

const MAT_INF_OBSIDIAN: Wc3Mat = {
  color: [44, 46, 52],
  rimColor: [110, 255, 95],
  rimStrength: 0.52,
}
const MAT_INF_FEL_CORE: Wc3Mat = {
  color: [145, 255, 90],
  glow: [85, 255, 55],
  flatGlow: true,
}

function drawInfernalModel(cv: Wc3ZBufferCanvas, p: PoseParams): void {
  const { clip, phase, cosYaw, sinYaw } = p
  const tau = phase * Math.PI * 2
  const pulse = Math.sin(tau) * 0.04
  const stride = clip === 'wl' ? Math.sin(tau) * 0.26 : 0
  const smash = clip === 'a1' ? Math.sin(phase * Math.PI) : 0
  const meteorDropZ = clip === 's1' ? (1 - phase) * 0.85 : 0
  const hitBack = clip === 'gh' ? Math.sin(phase * Math.PI) * 0.16 : 0
  const collapse = clip === 'dt' ? Math.min(1, phase * 1.15) : 0

  if (collapse > 0.88) {
    // Shattered obsidian meteor boulders with fading fel-green embers
    for (const [bx, by] of [[-0.26, 0.06], [0.24, -0.05], [0.02, 0.18]] as const) {
      cv.drawChunkyOctaRock([bx, by, 0.11], 0.18, 0.16, 0.12, cosYaw, sinYaw, MAT_INF_OBSIDIAN)
    }
    cv.drawGlowHalo([0, 0.06, 0.12], 0.28, cosYaw, sinYaw, [75, 255, 55], 0.7)
    return
  }

  const baseZ = meteorDropZ - collapse * 0.68
  const pelvisZ = Math.max(0.16, 0.58 + baseZ)
  const chestZ = Math.max(0.26, 1.06 + baseZ + pulse)

  // Immolation fel-fire aura at feet
  cv.drawGlowHalo([0, 0, Math.max(0.05, 0.12 + baseZ)], 0.42, cosYaw, sinYaw, [65, 255, 45], 0.55)

  // Floating boulder legs bridged by blazing fel fire
  for (const side of [-1, 1] as const) {
    const step = side * stride
    const thigh: Vec3 = [side * 0.22, step * 0.4 - hitBack * 0.3, pelvisZ - 0.14]
    const shin: Vec3 = [side * 0.25, step * 0.8, Math.max(0.06, 0.18 + baseZ)]
    cv.drawSphere([side * 0.22, step * 0.5 - 0.04, pelvisZ - 0.02], 0.048, cosYaw, sinYaw, MAT_INF_FEL_CORE)
    cv.drawChunkyOctaRock(thigh, 0.16, 0.16, 0.16, cosYaw, sinYaw, MAT_INF_OBSIDIAN)
    cv.drawChunkyOctaRock(shin, 0.18, 0.18, 0.17, cosYaw, sinYaw, MAT_INF_OBSIDIAN)
    cv.drawGlowHalo(shin, 0.18, cosYaw, sinYaw, [80, 255, 55], 0.65)
  }

  // Blazing Fel-Fire Waist Core + V-Tapered Angular Obsidian Chest Boulders
  const corePos: Vec3 = [0, -0.04 - hitBack * 0.6, (pelvisZ + chestZ) * 0.48]
  cv.drawSphere(corePos, 0.11, cosYaw, sinYaw, MAT_INF_FEL_CORE)
  cv.drawGlowHalo(corePos, 0.34, cosYaw, sinYaw, [85, 255, 55], 0.9)

  cv.drawChunkyOctaRock([-0.17, 0.04 - hitBack, chestZ], 0.26, 0.24, 0.25, cosYaw, sinYaw, MAT_INF_OBSIDIAN)
  cv.drawChunkyOctaRock([0.17, 0.04 - hitBack, chestZ], 0.26, 0.24, 0.25, cosYaw, sinYaw, MAT_INF_OBSIDIAN)
  // Glowing fel-lava fissure between chest plates
  cv.drawCapsule([0, 0.2 - hitBack, pelvisZ + 0.14], [0, 0.22 - hitBack, chestZ + 0.12], 0.032, 0.042, cosYaw, sinYaw, MAT_INF_FEL_CORE)

  // Towering Jagged Meteor Shoulder Pauldrons + Fel Spikes
  for (const side of [-1, 1] as const) {
    const sh: Vec3 = [side * 0.43, 0.02 - hitBack, chestZ + 0.17 + pulse * 0.5]
    cv.drawSphere([side * 0.31, -0.03 - hitBack, chestZ + 0.08], 0.048, cosYaw, sinYaw, MAT_INF_FEL_CORE)
    cv.drawChunkyOctaRock(sh, 0.22, 0.21, 0.24, cosYaw, sinYaw, MAT_INF_OBSIDIAN)
    cv.drawGlowHalo(sh, 0.24, cosYaw, sinYaw, [80, 255, 55], 0.72)
  }

  // Angular Crag Head + Blazing Fel Eyes + Crown Flames
  const headPos: Vec3 = [0, 0.14 - hitBack, chestZ + 0.3]
  cv.drawChunkyOctaRock(headPos, 0.19, 0.19, 0.19, cosYaw, sinYaw, MAT_INF_OBSIDIAN)
  for (const side of [-1, 1] as const) {
    const eye: Vec3 = [side * 0.068, headPos[1] + 0.15, headPos[2] + 0.02]
    cv.drawSphere(eye, 0.034, cosYaw, sinYaw, MAT_INF_FEL_CORE)
  }
  cv.drawGlowHalo([0, headPos[1], headPos[2] + 0.14], 0.26, cosYaw, sinYaw, [95, 255, 60], 0.9)

  // Huge Floating Meteor Forearms & Stone Fists!
  for (const side of [-1, 1] as const) {
    const fist: Vec3 = [
      side * (0.47 - smash * 0.18),
      0.18 + smash * 0.34 - side * stride * 0.4,
      chestZ - 0.22 + (smash > 0 ? Math.cos(smash * Math.PI) * 0.34 : 0),
    ]
    const midJoint: Vec3 = add3([side * 0.42, -0.02 - hitBack, chestZ + 0.04], [
      (fist[0] - side * 0.42) * 0.45,
      fist[1] * 0.45,
      (fist[2] - chestZ) * 0.45,
    ])
    cv.drawSphere(midJoint, 0.048, cosYaw, sinYaw, MAT_INF_FEL_CORE)
    cv.drawChunkyOctaRock(fist, 0.21, 0.21, 0.21, cosYaw, sinYaw, MAT_INF_OBSIDIAN)
    cv.drawGlowHalo(fist, 0.26 + smash * 0.14, cosYaw, sinYaw, [85, 255, 55], 0.9)
  }
}

// ============================================================================
// Portrait Renderer (92x82 RGBA -> drawn into 46x41 HUD summon slot)
// ============================================================================

function renderWc3MinionPortrait(
  drawFn: (cv: Wc3ZBufferCanvas, p: PoseParams) => void,
  focusZ: number,
  zoomScalePx: number,
  bgAccent: Rgb,
): { readonly width: number; readonly height: number; readonly pixels: Uint8Array } {
  const width = 92
  const height = 82
  const footX = 46
  const footY = Math.round(44 + focusZ * zoomScalePx * 0.85)
  const cv = new Wc3ZBufferCanvas(width, height, footX, footY, zoomScalePx)
  cv.setCameraPitchDegrees(14)

  // Dramatic 3/4 WC3 unit portrait yaw (-28 degrees)
  const yaw = (-28 * Math.PI) / 180
  drawFn(cv, {
    clip: 'nu',
    phase: 0.15,
    cosYaw: Math.cos(yaw),
    sinYaw: Math.sin(yaw),
  })
  cv.applyWc3InkAndCreasePass([12, 10, 18], 8.0)

  const out = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4
      const radial = Math.hypot((x - 46) / 46, (y - 38) / 41)
      const vig = Math.max(0, 1 - radial * 0.78)
      // Dark Scourge necropolis backdrop + colored rim vignette
      let r = clampByte(12 + bgAccent[0] * 0.24 * vig)
      let g = clampByte(12 + bgAccent[1] * 0.24 * vig)
      let b = clampByte(18 + bgAccent[2] * 0.28 * vig)

      const sa = cv.pixels[idx + 3]! / 255
      if (sa > 0) {
        r = clampByte(cv.pixels[idx]! * sa + r * (1 - sa))
        g = clampByte(cv.pixels[idx + 1]! * sa + g * (1 - sa))
        b = clampByte(cv.pixels[idx + 2]! * sa + b * (1 - sa))
      }
      // Composite emissive glow onto portrait
      r = clampByte(r + cv.glowPixels[idx]! * 0.75)
      g = clampByte(g + cv.glowPixels[idx + 1]! * 0.75)
      b = clampByte(b + cv.glowPixels[idx + 2]! * 0.75)

      // Subtle beveled inner metallic WC3 undead border
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        const hi = x === 0 || y === 0 ? 1.25 : 0.55
        r = clampByte(68 * hi)
        g = clampByte(76 * hi)
        b = clampByte(96 * hi)
      }

      out[idx] = r
      out[idx + 1] = g
      out[idx + 2] = b
      out[idx + 3] = 255
    }
  }
  return { width, height, pixels: out }
}

// ============================================================================
// Full 6-Minion Clip & Portrait Bundle Builder
// ============================================================================

interface ScourgeUnitRecipe {
  readonly key: string
  readonly name: { readonly zh: string; readonly en: string }
  readonly renderScale: number
  readonly shadowScale: number
  readonly canvasW: number
  readonly canvasH: number
  readonly footX: number
  readonly footY: number
  readonly pxScale: number
  readonly portraitFocusZ: number
  readonly portraitZoomPx: number
  readonly portraitAccent: Rgb
  readonly draw: (cv: Wc3ZBufferCanvas, p: PoseParams) => void
}

const SCOURGE_RECIPES: readonly ScourgeUnitRecipe[] = [
  {
    key: 'necroskeleton',
    name: { zh: '食尸鬼', en: 'Ghoul' },
    renderScale: 0.68,
    shadowScale: 0.85,
    canvasW: 144,
    canvasH: 156,
    footX: 72,
    footY: 128,
    pxScale: 54,
    portraitFocusZ: 0.8,
    portraitZoomPx: 88,
    portraitAccent: [70, 210, 145],
    draw: drawGhoulModel,
  },
  {
    key: 'necromage',
    name: { zh: '亡灵巫师', en: 'Necromancer' },
    renderScale: 0.7,
    shadowScale: 0.85,
    canvasW: 156,
    canvasH: 176,
    footX: 78,
    footY: 146,
    pxScale: 54,
    portraitFocusZ: 1.12,
    portraitZoomPx: 78,
    portraitAccent: [165, 85, 225],
    draw: drawWc3NecromancerModel,
  },
  {
    key: 'claygolem',
    name: { zh: '憎恶', en: 'Abomination' },
    renderScale: 0.78,
    shadowScale: 0.95,
    canvasW: 184,
    canvasH: 196,
    footX: 92,
    footY: 162,
    pxScale: 54,
    portraitFocusZ: 1.1,
    portraitZoomPx: 62,
    portraitAccent: [95, 195, 95],
    draw: (cv, p) => drawAbominationVariant(cv, p, false),
  },
  {
    key: 'bloodgolem',
    name: { zh: '血肉憎恶', en: 'Blood Abomination' },
    renderScale: 0.78,
    shadowScale: 0.95,
    canvasW: 184,
    canvasH: 196,
    footX: 92,
    footY: 162,
    pxScale: 54,
    portraitFocusZ: 1.1,
    portraitZoomPx: 62,
    portraitAccent: [220, 48, 58],
    draw: (cv, p) => drawAbominationVariant(cv, p, true),
  },
  {
    key: 'irongolem',
    name: { zh: '地穴领主', en: 'Crypt Lord' },
    renderScale: 0.76,
    shadowScale: 0.95,
    canvasW: 188,
    canvasH: 188,
    footX: 94,
    footY: 152,
    pxScale: 52,
    portraitFocusZ: 0.76,
    portraitZoomPx: 66,
    portraitAccent: [85, 165, 255],
    draw: drawCryptLordModel,
  },
  {
    key: 'firegolem',
    name: { zh: '地狱火', en: 'Infernal' },
    renderScale: 0.8,
    shadowScale: 0.95,
    canvasW: 188,
    canvasH: 204,
    footX: 94,
    footY: 168,
    pxScale: 54,
    portraitFocusZ: 1.18,
    portraitZoomPx: 60,
    portraitAccent: [75, 245, 60],
    draw: drawInfernalModel,
  },
]

const MINION_CLIP_SPECS = [
  { key: 'nu', frames: 6, speed: 128, loop: true },
  { key: 'wl', frames: 8, speed: 224, loop: true },
  { key: 'a1', frames: 8, speed: 256, loop: false },
  { key: 's1', frames: 8, speed: 192, loop: false },
  { key: 'gh', frames: 5, speed: 256, loop: false },
  { key: 'dt', frames: 10, speed: 176, loop: false },
] as const

export function generateScourgeMinionsInput(): Readonly<Record<string, PackMinionSkinInput>> {
  const directions = 8
  const out: Record<string, PackMinionSkinInput> = {}

  for (const recipe of SCOURGE_RECIPES) {
    const clips: RawSkinClipInput[] = MINION_CLIP_SPECS.map((spec) => {
      const dirFramesList: RawRgbaSkinFrame[][] = []
      for (let d = 0; d < directions; d += 1) {
        const yaw = (d / directions) * Math.PI * 2
        const cosYaw = Math.cos(yaw)
        const sinYaw = Math.sin(yaw)
        const frames: RawRgbaSkinFrame[] = []
        for (let f = 0; f < spec.frames; f += 1) {
          const phase = spec.loop ? f / spec.frames : f / Math.max(1, spec.frames - 1)
          const cv = new Wc3ZBufferCanvas(
            recipe.canvasW,
            recipe.canvasH,
            recipe.footX,
            recipe.footY,
            recipe.pxScale,
          )
          recipe.draw(cv, { clip: spec.key, phase, cosYaw, sinYaw })
          cv.applyWc3InkAndCreasePass()
          frames.push({
            width: recipe.canvasW,
            height: recipe.canvasH,
            pixels: cv.pixels,
            glowPixels: cv.glowPixels,
            footX: recipe.footX,
            footY: recipe.footY,
          })
        }
        dirFramesList.push(frames)
      }
      return {
        key: spec.key,
        speed: spec.speed,
        loop: spec.loop,
        directions: dirFramesList,
      }
    })

    out[recipe.key] = {
      name: recipe.name,
      directions,
      renderScale: recipe.renderScale,
      shadowScale: recipe.shadowScale,
      clips,
      portraitRgba: renderWc3MinionPortrait(
        recipe.draw,
        recipe.portraitFocusZ,
        recipe.portraitZoomPx,
        recipe.portraitAccent,
      ),
    }
  }

  return out
}
