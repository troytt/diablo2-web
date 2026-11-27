import { describe, expect, it } from 'vitest'
import { parseGlbContainer } from '../../../src/common/formats/glb-reader.ts'
import { resolveMeshWeaponClipKey, validateCharacterSkinManifest } from '../../../src/common/units/character-skin.ts'
import {
  computeMeshSkinJointMatrices,
  createMeshSkinPose,
  meshSkinBillboardBasis,
  meshSkinCameraRotation,
  parseMeshSkinModel,
  resolveMeshSkinLook,
  resolveMeshSkinOneShotTimeMs,
  sampleMeshSkinClip,
  shortestDir64Delta,
  skinMeshSkinAttachment,
  skinMeshSkinGeoset,
  type MeshSkinGeoset,
} from '../../../src/common/units/mesh-skin-model.ts'
import { MESH_SKIN_BLEND_MS, MeshSkinAnimator } from '../../../src/client/render/mesh-skin-animator.ts'
import { compositeMeshSkinCanvasPixels } from '../../../src/client/render/mesh-skin-renderer.ts'
import { getEmbeddedDropTables } from '../../../src/common/items/embedded-drop-tables.ts'
import {
  MESH_PAPERDOLL_GLOW_RGB,
  applyMeshPaperdollUniqueLooks,
  decodeMeshPaperdollSelection,
  encodeMeshPaperdollSelection,
  meshPaperdollGlowBySlot,
  meshPaperdollGlowForQuality,
  meshPaperdollUniqueWeapons,
  resolveMeshPaperdollKeyFromSlots,
  resolveMeshPaperdollSelection,
} from '../../../src/common/units/mesh-skin-paperdoll.ts'
import { CharacterSkinService } from '../../../src/client/render/character-skin-cache.ts'
import { PLR_MODES } from '../../../src/common/units/plr-mode.ts'

const PLAYER_MODE_TOKENS_FOR_TEST = PLR_MODES.map((m) => m.token.toLowerCase()).filter((t) => t !== 'sq')
const MONSTER_MODES_FOR_TEST = ['dt', 'nu', 'wl', 'gh', 'a1', 'a2', 'bl', 'sc', 's1', 's2', 's3', 's4', 'dd', 'xx', 'rn']

/**
 * Builds a tiny valid mesh skin GLB: a root joint and a child joint at pivot (0, 0, 10), one
 * triangle bound to the child, and clips that rotate / move the child.
 */
function buildTestGlb(
  options: {
    readonly clipNames?: readonly string[]
    readonly billboardChild?: boolean
    /** Adds a second geoset, three images and this root `extras.paperdoll` block. */
    readonly paperdoll?: Record<string, unknown>
  } = {},
): Uint8Array {
  const chunks: Uint8Array[] = []
  const views: { buffer: 0; byteOffset: number; byteLength: number }[] = []
  const accessors: Record<string, unknown>[] = []
  let offset = 0
  const push = (bytes: Uint8Array): number => {
    const pad = (4 - (offset % 4)) % 4
    if (pad > 0) {
      chunks.push(new Uint8Array(pad))
      offset += pad
    }
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength })
    chunks.push(bytes)
    offset += bytes.byteLength
    return views.length - 1
  }
  const f32 = (values: readonly number[], type: string, count: number): number => {
    accessors.push({
      bufferView: push(new Uint8Array(new Float32Array(values).buffer)),
      componentType: 5126,
      count,
      type,
    })
    return accessors.length - 1
  }
  const u16 = (values: readonly number[], type: string, count: number): number => {
    accessors.push({
      bufferView: push(new Uint8Array(new Uint16Array(values).buffer)),
      componentType: 5123,
      count,
      type,
    })
    return accessors.length - 1
  }

  const identityAt = (tx: number, ty: number, tz: number): number[] => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1]
  const ibm = f32([...identityAt(0, 0, 0), ...identityAt(0, 0, -10)], 'MAT4', 2)
  const position = f32([1, 0, 10, 0, 1, 10, 0, 0, 12], 'VEC3', 3)
  const normal = f32([1, 0, 0, 1, 0, 0, 1, 0, 0], 'VEC3', 3)
  const uv = f32([0, 0, 1, 0, 0, 1], 'VEC2', 3)
  const joints = u16([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 'VEC4', 3)
  const weights = f32([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 'VEC4', 3)
  const indices = u16([0, 1, 2], 'SCALAR', 3)

  const half = Math.SQRT1_2
  const animations = (options.clipNames ?? ['nu', 'wl', 'a1', 'gh', 'dt']).map((name) => {
    const input = f32([0, 1], 'SCALAR', 2)
    // 90 degrees about +Z over one second.
    const rotation = f32([0, 0, 0, 1, 0, 0, half, half], 'VEC4', 2)
    const alphaIn = f32([0, 0.5], 'SCALAR', 2)
    const alphaOut = f32([1, 0], 'SCALAR', 2)
    return {
      name,
      samplers: [{ input, output: rotation, interpolation: 'LINEAR' }],
      channels: [{ sampler: 0, target: { node: 1, path: 'rotation' } }],
      extras: {
        durationMs: 1000,
        loop: name === 'nu' || name === 'wl',
        geosetAlpha: name === 'dt' ? [{ geoset: 0, input: alphaIn, output: alphaOut, interpolation: 'STEP' }] : [],
      },
    }
  })

  const imageViews = options.paperdoll ? [push(new Uint8Array([1])), push(new Uint8Array([2])), push(new Uint8Array([3]))] : []
  const json = {
    ...(options.paperdoll
      ? {
          extras: { paperdoll: options.paperdoll },
          images: imageViews.map((bufferView) => ({ bufferView, mimeType: 'image/png' })),
        }
      : {}),
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0, 2] }],
    nodes: [
      { name: 'root', translation: [0, 0, 0], children: [1] },
      {
        name: 'child',
        translation: [0, 0, 10],
        ...(options.billboardChild ? { extras: { billboard: true } } : {}),
      },
      { name: 'mesh', mesh: 0, skin: 0 },
    ],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: position, NORMAL: normal, TEXCOORD_0: uv, JOINTS_0: joints, WEIGHTS_0: weights },
            indices,
            material: 0,
            extras: { geoset: 0, layer: 0, alpha: 1, color: [1, 1, 1] },
          },
          ...(options.paperdoll
            ? [
                {
                  attributes: { POSITION: position, NORMAL: normal, TEXCOORD_0: uv, JOINTS_0: joints, WEIGHTS_0: weights },
                  indices,
                  material: 0,
                  extras: { geoset: 1, layer: 0, alpha: 1, color: [1, 1, 1] },
                },
              ]
            : []),
        ],
      },
    ],
    skins: [{ joints: [0, 1], inverseBindMatrices: ibm }],
    materials: [
      {
        pbrMetallicRoughness: { baseColorFactor: [1, 0.5, 0.25, 1] },
        extras: { filterMode: 0, unshaded: false, texAnim: -1 },
      },
    ],
    animations,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: 0 }],
  }

  const binLength = offset + ((4 - (offset % 4)) % 4)
  const bin = new Uint8Array(binLength)
  let at = 0
  for (const c of chunks) {
    bin.set(c, at)
    at += c.byteLength
  }
  json.buffers[0]!.byteLength = binLength
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json))
  if (jsonBytes.byteLength % 4 !== 0) {
    const padded = new Uint8Array(jsonBytes.byteLength + (4 - (jsonBytes.byteLength % 4))).fill(0x20)
    padded.set(jsonBytes)
    jsonBytes = padded
  }
  const total = 12 + 8 + jsonBytes.byteLength + 8 + bin.byteLength
  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, 0x46546c67, true)
  dv.setUint32(4, 2, true)
  dv.setUint32(8, total, true)
  dv.setUint32(12, jsonBytes.byteLength, true)
  dv.setUint32(16, 0x4e4f534a, true)
  out.set(jsonBytes, 20)
  const binAt = 20 + jsonBytes.byteLength
  dv.setUint32(binAt, bin.byteLength, true)
  dv.setUint32(binAt + 4, 0x004e4942, true)
  out.set(bin, binAt + 8)
  return out
}

function meshManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const clip = (loop: boolean, extra: Record<string, unknown> = {}) => ({ anim: 'nu', loop, durationMs: 1000, ...extra })
  const mesh = (clips: Record<string, unknown>) => ({
    file: 'model.glb',
    pxPerUnit: 0.5,
    box: { width: 150, height: 160, footX: 75, footY: 120 },
    clips,
  })
  return {
    schema: 2,
    id: 'ne-test-mesh',
    name: { zh: '测试', en: 'Test' },
    targetClass: 'ne',
    format: 'mesh',
    directions: 64,
    mesh: mesh({ nu: clip(true), wl: clip(true, { moveSpeed: 200 }), a1: clip(false, { actionAt: 0.46 }), dt: clip(false) }),
    minions: {
      claygolem: {
        name: { zh: '憎恶', en: 'Abomination' },
        directions: 64,
        portraitFile: 'portrait.png',
        mesh: mesh({ nu: clip(true), wl: clip(true), a1: clip(false), gh: clip(false), dt: clip(false) }),
      },
    },
    ...overrides,
  }
}

describe('Mesh skin GLB model, pose sampling and CPU skinning', () => {
  it('parses the GLB layout and rejects malformed containers and models', () => {
    const model = parseMeshSkinModel(buildTestGlb())
    expect(model.nodeCount).toBe(2)
    expect([...model.parents]).toEqual([-1, 0])
    expect([...model.order]).toEqual([0, 1])
    expect([...model.pivots]).toEqual([0, 0, 0, 0, 0, 10])
    expect(model.geosets).toHaveLength(1)
    expect(model.geosets[0]!.layers[0]!.color).toEqual([1, 0.5, 0.25])
    expect(Object.keys(model.clips).sort()).toEqual(['a1', 'dt', 'gh', 'nu', 'wl'])
    expect(model.clips.nu!.loop).toBe(true)
    expect(model.clips.a1!.loop).toBe(false)

    expect(() => parseGlbContainer(new Uint8Array(8))).toThrow(/shorter than its header/)
    const badMagic = buildTestGlb()
    badMagic[0] = 0
    expect(() => parseMeshSkinModel(badMagic)).toThrow(/bad magic/)
    expect(() => parseMeshSkinModel(buildTestGlb({ clipNames: [] }))).toThrow(/no animations/)
    expect(() => parseMeshSkinModel(buildTestGlb({ clipNames: ['nu', 'nu'] }))).toThrow(/duplicate animation name/)
  })

  it('samples clips, rotates joints about their pivot and skins vertices', () => {
    const model = parseMeshSkinModel(buildTestGlb())
    const pose = createMeshSkinPose(model)
    const globals = new Float32Array(model.nodeCount * 12)
    const joints = new Float32Array(model.nodeCount * 12)
    const out = new Float32Array(model.maxVertexCount * 8)
    const skinAt = (clip: string, timeMs: number): number[] => {
      sampleMeshSkinClip(model, model.clips[clip]!, timeMs, pose)
      computeMeshSkinJointMatrices(model, pose, null, globals, joints)
      skinMeshSkinGeoset(model.geosets[0]!, joints, out)
      return [...out.subarray(0, 3)].map((v) => Math.round(v * 1000) / 1000)
    }
    // Rest pose: vertex 0 stays at (1, 0, 10).
    expect(skinAt('nu', 0)).toEqual([1, 0, 10])
    // End of clip: 90 degrees about +Z around the pivot moves +X to +Y at the same height.
    expect(skinAt('nu', 1000)).toEqual([0, 1, 10])
    // Halfway is a 45 degree turn (spherical interpolation keeps the radius).
    expect(skinAt('nu', 500)).toEqual([0.707, 0.707, 10])
    // Times outside the clip clamp instead of extrapolating.
    expect(skinAt('nu', 5000)).toEqual([0, 1, 10])
    expect(skinAt('nu', -50)).toEqual([1, 0, 10])

    // STEP visibility track: visible before 500 ms, hidden from 500 ms on.
    sampleMeshSkinClip(model, model.clips.dt!, 499, pose)
    expect(pose.geosetAlpha[0]).toBe(1)
    sampleMeshSkinClip(model, model.clips.dt!, 500, pose)
    expect(pose.geosetAlpha[0]).toBe(0)
    // Clips without the track keep the static geoset alpha.
    sampleMeshSkinClip(model, model.clips.nu!, 900, pose)
    expect(pose.geosetAlpha[0]).toBe(1)
  })

  it('orients billboard nodes towards the camera for every facing', () => {
    const model = parseMeshSkinModel(buildTestGlb({ billboardChild: true }))
    const pose = createMeshSkinPose(model)
    const globals = new Float32Array(model.nodeCount * 12)
    const joints = new Float32Array(model.nodeCount * 12)
    const rot = new Float32Array(9)
    const basis = new Float32Array(9)
    for (const dir64 of [0, 7, 16, 23.5, 32, 48, 63]) {
      meshSkinCameraRotation(dir64, rot)
      // The camera rotation must be orthonormal for every facing.
      for (let r = 0; r < 3; r += 1) {
        expect(Math.hypot(rot[r * 3]!, rot[r * 3 + 1]!, rot[r * 3 + 2]!)).toBeCloseTo(1, 5)
      }
      meshSkinBillboardBasis(rot, basis)
      sampleMeshSkinClip(model, model.clips.nu!, 300, pose)
      computeMeshSkinJointMatrices(model, pose, basis, globals, joints)
      // The billboard joint's local +X axis, taken to camera space, points straight at the viewer.
      const ax = joints[12]!, ay = joints[16]!, az = joints[20]!
      const camX = rot[0]! * ax + rot[1]! * ay + rot[2]! * az
      const camY = rot[3]! * ax + rot[4]! * ay + rot[5]! * az
      const camZ = rot[6]! * ax + rot[7]! * ay + rot[8]! * az
      expect(camX).toBeCloseTo(0, 5)
      expect(camY).toBeCloseTo(0, 5)
      expect(camZ).toBeCloseTo(1, 5)
    }
    // dir64 0 faces screen south: model forward (+X) projects straight down the screen, towards the viewer.
    meshSkinCameraRotation(0, rot)
    expect(rot[0]).toBeCloseTo(0, 6)
    expect(rot[3]!).toBeGreaterThan(0)
    expect(rot[6]!).toBeGreaterThan(0)
  })
})

describe('Mesh skin timing', () => {
  it('maps one-shot progress monotonically and lands the action point on the gameplay hit', () => {
    expect(resolveMeshSkinOneShotTimeMs(1000, 0.5)).toBe(500)
    expect(resolveMeshSkinOneShotTimeMs(1000, -1)).toBe(0)
    expect(resolveMeshSkinOneShotTimeMs(1000, 7)).toBe(1000)
    // Gameplay hits at 60% of the action; the clip's impact is at 46% of the animation.
    expect(resolveMeshSkinOneShotTimeMs(1000, 0.6, 0.6, 0.46)).toBeCloseTo(460, 6)
    expect(resolveMeshSkinOneShotTimeMs(1000, 0, 0.6, 0.46)).toBe(0)
    expect(resolveMeshSkinOneShotTimeMs(1000, 1, 0.6, 0.46)).toBeCloseTo(1000, 6)
    let prev = -1
    for (let i = 0; i <= 200; i += 1) {
      const t = resolveMeshSkinOneShotTimeMs(1000, i / 200, 0.6, 0.46)
      expect(t).toBeGreaterThanOrEqual(prev)
      prev = t
    }
    // An action point at the very start or end cannot be aligned and falls back to linear.
    expect(resolveMeshSkinOneShotTimeMs(1000, 0.25, 0, 0.46)).toBe(250)
    expect(resolveMeshSkinOneShotTimeMs(1000, 0.25, 0.6, 1)).toBe(250)

    expect(shortestDir64Delta(60, 2)).toBe(6)
    expect(shortestDir64Delta(2, 60)).toBe(-6)
    expect(shortestDir64Delta(0, 32)).toBe(32)
  })

  it('advances loops every display frame, cross-fades clip changes and smooths facing', () => {
    const model = parseMeshSkinModel(buildTestGlb())
    const animator = new MeshSkinAnimator()
    const base = { unitKey: 'player:1', model, worldX: 100, worldY: 100, dir64: 0 }

    // 60 Hz for one second: every frame samples a new pose (the old sprites managed 12.5 to 25).
    const times = new Set<number>()
    for (let i = 0; i <= 60; i += 1) {
      const res = animator.play({ ...base, clip: model.clips.nu!, mode: 'loop', nowMs: 1000 + (i * 1000) / 60 })
      if (i > 0) times.add(Math.round(res.timeMs * 100))
    }
    expect(times.size).toBe(60)

    // Switching clips keeps part of the previous pose for MESH_SKIN_BLEND_MS, then follows the new clip.
    const idleEnd = animator.play({ ...base, clip: model.clips.nu!, mode: 'loop', nowMs: 2010 })
    const idleRotZ = idleEnd.pose.rotation[1 * 4 + 2]!
    const justSwitched = animator.play({ ...base, clip: model.clips.a1!, mode: 'oneshot', timeMs: 0, nowMs: 2020 })
    const blendedRotZ = justSwitched.pose.rotation[1 * 4 + 2]!
    expect(blendedRotZ).toBeGreaterThan(0)
    expect(blendedRotZ).toBeLessThanOrEqual(idleRotZ + 1e-6)
    const settled = animator.play({
      ...base,
      clip: model.clips.a1!,
      mode: 'oneshot',
      timeMs: 0,
      nowMs: 2020 + MESH_SKIN_BLEND_MS + 1,
    })
    expect(settled.pose.rotation[1 * 4 + 2]).toBeCloseTo(0, 6)

    // 'hold-end' pins the final frame (corpses).
    const held = animator.play({ ...base, clip: model.clips.dt!, mode: 'hold-end', nowMs: 2200 })
    expect(held.timeMs).toBe(1000)

    // Facing turns through intermediate angles instead of snapping between 8 directions.
    const turning = animator.play({ ...base, clip: model.clips.dt!, mode: 'hold-end', nowMs: 2216, dir64: 32 })
    expect(turning.dir64).toBeGreaterThan(0)
    expect(turning.dir64).toBeLessThan(32)
    let facing = turning.dir64
    for (let i = 1; i <= 40; i += 1) {
      facing = animator.play({ ...base, clip: model.clips.dt!, mode: 'hold-end', nowMs: 2216 + i * 16, dir64: 32 }).dir64
    }
    expect(facing).toBeCloseTo(32, 6)

    // A slow display (5 frames per second) still advances loops by the real elapsed time.
    const slow = new MeshSkinAnimator()
    slow.play({ ...base, unitKey: 'slow', clip: model.clips.nu!, mode: 'loop', nowMs: 0 })
    expect(slow.play({ ...base, unitKey: 'slow', clip: model.clips.nu!, mode: 'loop', nowMs: 200 }).timeMs).toBe(200)
    expect(slow.play({ ...base, unitKey: 'slow', clip: model.clips.nu!, mode: 'loop', nowMs: 400 }).timeMs).toBe(400)

    // A unit that was off screen for a while restarts cleanly (no blend, facing snaps).
    const back = animator.play({ ...base, clip: model.clips.nu!, mode: 'loop', nowMs: 9000, dir64: 8 })
    expect(back.dir64).toBe(8)
    expect(back.timeMs).toBe(0)
  })

  it('plays locomotion at the rate that matches measured ground speed', () => {
    const model = parseMeshSkinModel(buildTestGlb())
    const clip = model.clips.wl!
    const advance = (speedPxPerSec: number): number => {
      const animator = new MeshSkinAnimator()
      let last = 0
      let lastTime = 0
      // Warm the speed estimate up for a second, then measure clip time gained over 320 ms.
      for (let i = 0; i <= 80; i += 1) {
        const nowMs = 1000 + i * 16
        const res = animator.play({
          unitKey: 'monster:5',
          model,
          clip,
          mode: 'loop',
          naturalSpeedPx: 100,
          nowMs,
          dir64: 48,
          worldX: (speedPxPerSec * (nowMs - 1000)) / 1000,
          worldY: 0,
        })
        if (i === 60) lastTime = res.timeMs
        if (i === 80) last = (res.timeMs - lastTime + 1000) % 1000
      }
      return last / 320
    }
    // Moving exactly at the authored speed plays at rate 1; twice as fast plays at rate 2.
    expect(advance(100)).toBeCloseTo(1, 1)
    expect(advance(200)).toBeCloseTo(2, 1)
    // The rate is clamped so a nearly stationary unit does not freeze mid-stride.
    expect(advance(5)).toBeCloseTo(0.5, 1)
  })
})

describe('Mesh skin manifest (schema 2) and service wiring', () => {
  it('accepts mesh manifests and rejects inconsistent ones', () => {
    const manifest = validateCharacterSkinManifest(meshManifest())
    expect(manifest.schema).toBe(2)
    expect(manifest.format).toBe('mesh')
    expect(manifest.pages).toEqual([])
    expect(manifest.mesh?.clips.a1?.actionAt).toBe(0.46)
    expect(manifest.mesh?.clips.wl?.moveSpeed).toBe(200)
    expect(manifest.minions?.claygolem?.mesh?.file).toBe('model.glb')

    expect(() => validateCharacterSkinManifest(meshManifest({ schema: 1 }))).toThrow(/does not match schema/)
    expect(() => validateCharacterSkinManifest(meshManifest({ mesh: undefined }))).toThrow(/expected mesh object/)
    const noDeath = meshManifest()
    delete ((noDeath.mesh as { clips: Record<string, unknown> }).clips as Record<string, unknown>).dt
    expect(() => validateCharacterSkinManifest(noDeath)).toThrow(/missing required clip "dt"/)
    const badFile = meshManifest()
    ;(badFile.mesh as { file: string }).file = '../evil.glb'
    expect(() => validateCharacterSkinManifest(badFile)).toThrow(/expected a relative \.glb file/)
    const badAction = meshManifest()
    ;((badAction.mesh as { clips: Record<string, { actionAt?: number }> }).clips.a1 as { actionAt?: number }).actionAt = 1
    expect(() => validateCharacterSkinManifest(badAction)).toThrow(/actionAt/)
    const minionNoHit = meshManifest()
    const golem = (minionNoHit.minions as Record<string, { mesh: { clips: Record<string, unknown> } }>).claygolem!
    delete golem.mesh.clips.gh
    expect(() => validateCharacterSkinManifest(minionNoHit)).toThrow(/missing required clip "gh"/)

    // Reserved fields for future art sources are validated and carried, not dropped.
    const reserved = meshManifest()
    ;(reserved.mesh as Record<string, unknown>).components = { helm: 'helm.glb' }
    ;(reserved.mesh as Record<string, unknown>).materialMaps = { normal: 'body_n.png' }
    const withReserved = validateCharacterSkinManifest(reserved)
    expect(withReserved.mesh?.components).toEqual({ helm: 'helm.glb' })
    expect(withReserved.mesh?.materialMaps).toEqual({ normal: 'body_n.png' })
  })

  it('covers every player and monster mode token through the mesh clip tables', async () => {
    const { resolveSkinClipKey, resolveMinionClipKey } = await import('../../../src/common/units/character-skin.ts')
    const manifest = validateCharacterSkinManifest(meshManifest())
    for (const token of PLAYER_MODE_TOKENS_FOR_TEST) {
      const key = resolveSkinClipKey('ne', token, manifest.mesh!.clips)
      expect(key, `player mode ${token}`).not.toBeNull()
      expect(manifest.mesh!.clips[key!]).toBeDefined()
    }
    const minionClips = manifest.minions!.claygolem!.mesh!.clips
    for (const token of MONSTER_MODES_FOR_TEST) {
      const key = resolveMinionClipKey(token, minionClips)
      expect(key, `monster mode ${token}`).not.toBeNull()
      expect(minionClips[key!]).toBeDefined()
    }
  })

  it('reports mesh manifests to the render loop and never builds sprite atlases for them', async () => {
    const manifest = validateCharacterSkinManifest(meshManifest({ id: 'ne-kelthuzad' }))
    const fetched: string[] = []
    const service = new CharacterSkinService({
      skinsBaseUrl: '/skins',
      disableIndexedDb: true,
      fetchFn: (async (url: string | URL | Request) => {
        const u = String(url)
        fetched.push(u)
        if (u.endsWith('/skins/index.json')) return new Response('missing', { status: 404 })
        if (u.endsWith('/skins/ne-kelthuzad/skin.json')) return new Response(JSON.stringify(manifest), { status: 200 })
        return new Response('missing', { status: 404 })
      }) as typeof fetch,
    })

    // Disabled: nothing is fetched and nothing is selected.
    expect(service.peekSelectedManifest('ne')).toBeNull()
    expect(fetched).toEqual([])

    service.setConfig({ enabled: true, selectedByClass: { ne: 'ne-kelthuzad' } })
    expect(service.peekSelectedManifest('ne')).toBe('loading')
    for (let i = 0; i < 20 && service.peekSelectedManifest('ne') === 'loading'; i += 1) {
      await new Promise((r) => setTimeout(r, 5))
    }
    const peeked = service.peekSelectedManifest('ne')
    expect(peeked).not.toBe('loading')
    expect(peeked !== null && peeked !== 'loading' ? peeked.format : null).toBe('mesh')
    // Only the manifest was fetched: no model, texture or portrait before a unit is drawn.
    expect(fetched.filter((u) => u.endsWith('.glb') || u.endsWith('.png'))).toEqual([])

    // Summon names and portraits still come from the same minion entries.
    expect(service.getSelectedMinionSpec('ne', 'claygolem')?.name.zh).toBe('憎恶')
    // The campfire avatar is a sprite feature; mesh skins opt out instead of crashing on empty atlases.
    expect(await service.ensureSkinAvatar('ne')).toBeNull()
  })
})

describe('Mesh skin paper-doll', () => {
  const paperdoll = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    canvas: 0,
    hidden: [1],
    defaults: { armor: 'none', weapon: 'none' },
    slots: {
      weapon: { none: {}, staff: { show: [1] } },
      armor: {
        none: {},
        cloth: { layers: [{ image: 1, x: 0, y: 0, w: 2, h: 1, order: 30 }, { image: 2, x: 0, y: 1, w: 2, h: 1, order: 10 }] },
        bare: { hide: [0] },
      },
    },
    ...overrides,
  })

  it('parses the paper-doll block and resolves looks with defaults for unknown choices', () => {
    expect(parseMeshSkinModel(buildTestGlb()).paperdoll).toBeNull()
    expect(resolveMeshSkinLook(parseMeshSkinModel(buildTestGlb()), { weapon: 'staff' })).toBeNull()

    const model = parseMeshSkinModel(buildTestGlb({ paperdoll: paperdoll() }))
    expect(model.geosets).toHaveLength(2)
    expect(model.paperdoll?.slots.weapon?.staff?.show).toEqual([1])

    const bare = resolveMeshSkinLook(model, {})!
    expect([...bare.visible]).toEqual([1, 0])
    expect(bare.layers).toEqual([])
    expect(bare.key).toBe('armor=none,weapon=none')
    expect(bare.canvasKey).toBe('')

    const dressed = resolveMeshSkinLook(model, { weapon: 'staff', armor: 'cloth', boots: 'ignored' })!
    expect([...dressed.visible]).toEqual([1, 1])
    // Layers are ordered by `order`, not by declaration.
    expect(dressed.layers.map((l) => l.image)).toEqual([2, 1])
    expect(dressed.key).toBe('armor=cloth,weapon=staff')
    // The canvas identity ignores slots that add no texture layer, so they share one texture.
    expect(dressed.canvasKey).toBe('armor=cloth')
    expect(resolveMeshSkinLook(model, { armor: 'cloth' })!.canvasKey).toBe('armor=cloth')

    expect([...resolveMeshSkinLook(model, { armor: 'bare', weapon: 'staff' })!.visible]).toEqual([0, 1])
    // An option the model does not have falls back to the slot default.
    expect(resolveMeshSkinLook(model, { weapon: 'bow', armor: 'plate' })!.key).toBe(bare.key)
  })

  it('rejects paper-doll blocks that reference missing geosets, images or defaults', () => {
    expect(() => parseMeshSkinModel(buildTestGlb({ paperdoll: paperdoll({ hidden: [2] }) }))).toThrow(/missing geoset 2/)
    expect(() => parseMeshSkinModel(buildTestGlb({ paperdoll: paperdoll({ canvas: 3 }) }))).toThrow(/missing image 3/)
    expect(() =>
      parseMeshSkinModel(buildTestGlb({ paperdoll: paperdoll({ defaults: { armor: 'none', weapon: 'sword' } }) })),
    ).toThrow(/no valid default option/)
    expect(() =>
      parseMeshSkinModel(
        buildTestGlb({
          paperdoll: paperdoll({
            slots: { weapon: { none: {} }, armor: { none: { layers: [{ image: 1, x: 0, y: 0, w: 0, h: 1 }] } } },
          }),
        }),
      ),
    ).toThrow(/invalid layer rectangle/)
  })

  it('composites layers over the canvas with straight alpha and nearest scaling', () => {
    const base = { pixels: new Uint8Array([10, 20, 30, 255, 10, 20, 30, 255, 10, 20, 30, 255, 10, 20, 30, 255]), width: 2, height: 2 }
    const opaque = { pixels: new Uint8Array([200, 100, 50, 255]), width: 1, height: 1, x: 0, y: 0, w: 2, h: 1 }
    const half = { pixels: new Uint8Array([110, 220, 130, 128]), width: 1, height: 1, x: 1, y: 1, w: 1, h: 1 }
    const out = compositeMeshSkinCanvasPixels(base, [opaque, half])
    expect([...out.subarray(0, 8)]).toEqual([200, 100, 50, 255, 200, 100, 50, 255])
    expect([...out.subarray(8, 12)]).toEqual([10, 20, 30, 255])
    expect([...out.subarray(12, 16)]).toEqual([60, 120, 80, 255])
    // The input canvas is left untouched.
    expect(base.pixels[0]).toBe(10)
  })

  const NONE = { weapon: 'none', offhand: 'none', helm: 'none', armor: 'none', weaponGlow: 'none', offhandGlow: 'none' }

  it('classifies every 1.13c body armour, helm and shield row; boots, belts and gloves are ignored', () => {
    const tables = getEmbeddedDropTables() as unknown as {
      armor: { all: readonly { code: string; type: string; name: string; normcode?: string; ubercode?: string; ultracode?: string }[] }
    }
    const armors = new Map<string, number>()
    const helms = new Map<string, number>()
    const offhands = new Map<string, number>()
    for (const row of tables.armor.all) {
      if (row.type === 'tors') {
        const got = resolveMeshPaperdollSelection({ armor: row.code }).armor
        expect(got, row.name).toMatch(/^(quilted|leather|studded|ring|scale|breast|plate|gothic)[123]$/)
        // The tier digit is the row's position in its normal / exceptional / elite chain.
        const tier = row.code === row.ultracode ? 3 : row.code === row.ubercode ? 2 : 1
        expect(got.endsWith(String(tier)), row.name).toBe(true)
        armors.set(got, (armors.get(got) ?? 0) + 1)
        // Body armour never reads as another slot.
        expect(resolveMeshPaperdollSelection({ helm: row.code, hand1: row.code })).toEqual(NONE)
      } else if (['helm', 'circ', 'pelt', 'phlm'].includes(row.type)) {
        const got = resolveMeshPaperdollSelection({ helm: row.code }).helm
        expect(got, row.name).not.toBe('none')
        helms.set(got, (helms.get(got) ?? 0) + 1)
        expect(resolveMeshPaperdollSelection({ armor: row.code, hand1: row.code })).toEqual(NONE)
      } else if (['shie', 'ashd', 'head'].includes(row.type)) {
        const got = resolveMeshPaperdollSelection({ hand2: row.code }).offhand
        expect(got).not.toBe('none')
        offhands.set(got, (offhands.get(got) ?? 0) + 1)
        // A shield is never the weapon, whichever hand holds it.
        expect(resolveMeshPaperdollSelection({ hand1: row.code }).weapon).toBe('none')
      } else {
        // Gloves, boots and belts do not change the model in any slot.
        expect(['glov', 'boot', 'belt']).toContain(row.type)
        expect(resolveMeshPaperdollSelection({ helm: row.code, armor: row.code, hand1: row.code, hand2: row.code }), row.name).toEqual(NONE)
      }
    }
    // 15 base armours x 3 tiers: families of 1, 2 or 3 base items, one look per tier.
    const perTier = { quilted: 1, leather: 2, studded: 1, ring: 2, scale: 2, breast: 2, plate: 2, gothic: 3 }
    expect(Object.fromEntries(armors)).toEqual(
      Object.fromEntries(Object.entries(perTier).flatMap(([fam, n]) => [1, 2, 3].map((t) => [`${fam}${String(t)}`, n]))),
    )
    // 8 helm families x 3 tiers, 4 circlets, 15 druid pelts, 15 barbarian helms.
    expect(Object.fromEntries(helms)).toEqual({
      cap: 3, skullcap: 3, helm: 3, fullhelm: 3, greathelm: 3, crown: 3, mask: 3, bone: 3, circlet: 4, pelt: 15, barbarian: 15,
    })
    // 8 shield families x 3 tiers by shape, 15 paladin shields, 15 necromancer heads.
    expect(Object.fromEntries(offhands)).toEqual({ buckler: 3, shield: 6, kite: 6, tower: 3, spiked: 6, paladin: 15, head: 15 })
    expect(resolveMeshPaperdollSelection({ armor: 'qui' }).armor).toBe('quilted1')
    expect(resolveMeshPaperdollSelection({ armor: 'xui' }).armor).toBe('quilted2')
    expect(resolveMeshPaperdollSelection({ armor: 'uui' }).armor).toBe('quilted3')
    expect(resolveMeshPaperdollSelection({ armor: 'aar' }).armor).toBe('gothic1')
    expect(resolveMeshPaperdollSelection({ armor: 'utp' }).armor).toBe('breast3')
  })

  it('classifies every 1.13c weapon row into one weapon family', () => {
    const tables = getEmbeddedDropTables() as unknown as {
      weapons: { all: readonly { code: string; type: string; name: string; normcode?: string; twoHanded?: boolean }[] }
    }
    const byFamily = new Map<string, Set<string>>()
    for (const row of tables.weapons.all) {
      const got = resolveMeshPaperdollSelection({ hand1: row.code })
      expect(got.weapon, `${row.code} ${row.name}`).not.toBe('none')
      expect(got.offhand).toBe('none')
      // Either hand gives the same answer.
      expect(resolveMeshPaperdollSelection({ hand2: row.code }).weapon).toBe(got.weapon)
      // All three tiers of a base item share one family.
      const set = byFamily.get(row.normcode ?? row.code) ?? new Set<string>()
      set.add(got.weapon)
      byFamily.set(row.normcode ?? row.code, set)
    }
    for (const [family, set] of byFamily) expect([...set], family).toHaveLength(1)
    const expectFamily = (codes: readonly string[], want: string): void => {
      for (const code of codes) expect(resolveMeshPaperdollSelection({ hand1: code }).weapon, code).toBe(want)
    }
    expectFamily(['hax', 'axe', '2ax', 'wax', '9ha', '7ha'], 'axe')
    expectFamily(['mpi', '9mp', '7mp'], 'pick')
    expectFamily(['lax', 'bax', 'btx', 'gax', 'gix'], 'axe2h')
    expectFamily(['clb', 'spc', 'leg'], 'club')
    expectFamily(['mac', 'mst', 'fla'], 'mace')
    expectFamily(['whm', 'hdm', 'hfh'], 'hammer')
    expectFamily(['mau', 'gma'], 'hammer2h')
    expectFamily(['scp', 'gsc', 'wsp'], 'scepter')
    expectFamily(['ssd', 'crs', 'bsd', 'lsd', 'wsd'], 'sword')
    expectFamily(['scm', 'sbr', 'flc'], 'saber')
    expectFamily(['2hs', 'clm', 'gis', 'bsw', 'flb', 'gsd'], 'sword2h')
    expectFamily(['dgr', 'dir', 'kri', 'bld'], 'dagger')
    expectFamily(['spr', 'brn', 'spt', 'pik', 'am3', 'am4'], 'spear')
    expectFamily(['tri'], 'trident')
    expectFamily(['bar', 'vou', 'pax', 'hal'], 'polearm')
    expectFamily(['scy', 'wsc'], 'scythe')
    expectFamily(['ktr', 'wrb', 'axf', 'ces', 'clw', 'btl', 'skr'], 'claw')
    expectFamily(['sst', 'lst', 'cst', 'bst', 'wst', 'hst', 'msf'], 'staff')
    expectFamily(['wnd', 'ywn', 'bwn', 'gwn'], 'wand')
    expectFamily(['ob1', 'ob5', 'obf'], 'orb')
    expectFamily(['sbw', 'lwb', 'am1', 'am2'], 'bow')
    expectFamily(['lxb', 'mxb', 'hxb', 'rxb'], 'crossbow')
    expectFamily(['jav', 'pil', 'ssp', 'glv', 'tsp', 'am5'], 'javelin')
    expectFamily(['tkf', 'bkf'], 'tknife')
    expectFamily(['tax', 'bal'], 'taxe')
    expectFamily(['gps', 'ops', 'opl'], 'tpotion')
  })

  it('combines slots, shows one weapon and reports quality glow per hand item', () => {
    expect(resolveMeshPaperdollSelection({ helm: 'ci2', armor: 'uui', hand1: 'obf', hand2: 'uit' })).toEqual({
      ...NONE, weapon: 'orb', offhand: 'kite', helm: 'circlet', armor: 'quilted3',
    })
    expect(resolveMeshPaperdollSelection({ helm: ' UAP ', armor: 'utp', hand1: '6ws' })).toEqual({
      ...NONE, weapon: 'staff', helm: 'cap', armor: 'breast3',
    })
    expect(resolveMeshPaperdollSelection({ helm: 'zzz', armor: '', hand1: 'nope' })).toEqual(NONE)
    // Dual wielding: the first hand's weapon is the main weapon, the second one the off-hand `w-<family>`.
    expect(resolveMeshPaperdollSelection({ hand1: 'ssd', hand1Quality: 4, hand2: 'hax', hand2Quality: 7 })).toEqual({
      ...NONE, weapon: 'sword', weaponGlow: 'magic', offhand: 'w-axe', offhandGlow: 'unique',
    })
    expect(resolveMeshPaperdollSelection({ hand1: 'ktr', hand2: 'ktr' })).toMatchObject({ weapon: 'claw', offhand: 'w-claw' })
    // A Barbarian holds a two-handed sword in one hand whenever the other hand is occupied.
    expect(resolveMeshPaperdollSelection({ hand1: 'clm' }).weapon).toBe('sword2h')
    expect(resolveMeshPaperdollSelection({ hand1: 'clm', hand2: 'tow' })).toMatchObject({ weapon: 'sword2h1', offhand: 'tower' })
    expect(resolveMeshPaperdollSelection({ hand1: 'clm', hand2: '2hs' })).toMatchObject({ weapon: 'sword2h1', offhand: 'w-sword2h' })
    expect(resolveMeshPaperdollSelection({ hand1: 'buc', hand2: 'hax' })).toMatchObject({ weapon: 'axe', offhand: 'buckler' })

    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, undefined].map(meshPaperdollGlowForQuality)).toEqual([
      'none', 'none', 'none', 'magic', 'set', 'rare', 'unique', 'crafted', 'none', 'none',
    ])
    expect(
      resolveMeshPaperdollSelection({ hand1: 'tow', hand1Quality: 7, hand2: 'mac', hand2Quality: 6 }),
    ).toMatchObject({ weapon: 'mace', weaponGlow: 'rare', offhand: 'tower', offhandGlow: 'unique' })
    // Unique weapons carry their `UniqueItems.txt` row id; other qualities and non-weapons do not.
    const windforce = resolveMeshPaperdollSelection({ hand1: '6lw', hand1Quality: 7, hand1Unique: 266 })
    expect(windforce).toEqual({ ...NONE, weapon: 'bow', weaponGlow: 'unique', weaponUnique: 266 })
    expect(resolveMeshPaperdollSelection({ hand1: '6lw', hand1Quality: 6, hand1Unique: 266 }).weaponUnique).toBeUndefined()
    expect(resolveMeshPaperdollSelection({ hand1: '6lw', hand1Quality: 7, hand1Unique: 0xfff }).weaponUnique).toBeUndefined()
    expect(resolveMeshPaperdollSelection({ hand1: 'tow', hand1Quality: 7, hand1Unique: 5 })).toMatchObject({ offhand: 'tower', offhandGlow: 'unique' })
    expect(resolveMeshPaperdollSelection({ hand1: 'tow', hand1Quality: 7, hand1Unique: 5 }).offhandUnique).toBeUndefined()
    const dual = resolveMeshPaperdollSelection({ hand1: '7wa', hand1Quality: 7, hand1Unique: 314, hand2: '7cr', hand2Quality: 7, hand2Unique: 259 })
    expect(dual).toMatchObject({ weapon: 'axe', weaponUnique: 314, offhand: 'w-sword', offhandUnique: 259 })
    const dualKey = encodeMeshPaperdollSelection(dual)
    expect(dualKey).toBe('armor=none,helm=none,offhand=w-sword,weapon=axe,offhandGlow=unique,weaponGlow=unique,offhandUnique=259,weaponUnique=314')
    // A hand whose weapon pack model is attached takes its family model and glow off; the other keeps both.
    const decodedDual = decodeMeshPaperdollSelection(dualKey)
    expect(meshPaperdollUniqueWeapons(decodedDual)).toEqual({ weapon: 314, offhand: 259 })
    const all = applyMeshPaperdollUniqueLooks(decodedDual, { weapon: true, offhand: true })
    expect(all).toMatchObject({ weapon: 'none', offhand: 'none' })
    expect(all.weaponGlow).toBeUndefined()
    expect(all.offhandGlow).toBeUndefined()
    const onlyWeapon = applyMeshPaperdollUniqueLooks(decodedDual, { weapon: true, offhand: false })
    expect(onlyWeapon).toMatchObject({ weapon: 'none', offhand: 'w-sword', offhandGlow: 'unique' })
    expect(applyMeshPaperdollUniqueLooks(decodedDual, { weapon: false, offhand: false })).toBe(decodedDual)
    // A unique shield never asks for a pack model, and a malformed id is ignored.
    expect(meshPaperdollUniqueWeapons({ offhand: 'tower', offhandUnique: '5', weaponUnique: 'x' })).toEqual({ weapon: null, offhand: null })
    expect(resolveMeshPaperdollKeyFromSlots((l) => (l === 4 ? '6lw' : undefined), 0, () => 7, () => 266)).toContain('weaponUnique=266')
    // Quality of an item that is not shown is ignored.
    expect(resolveMeshPaperdollSelection({ hand1: 'qui', hand1Quality: 7 })).toEqual(NONE)
  })

  it('skins a rigid attachment onto one joint, optionally mirrored across its XZ plane', () => {
    const geo = {
      positions: new Float32Array([1, 2, 3]),
      normals: new Float32Array([0, 1, 0]),
      uvs: new Float32Array([0.25, 0.75]),
    } as unknown as MeshSkinGeoset
    // Joint 1: rotate 90 degrees about Z (x -> y, y -> -x), then translate by (10, 20, 30).
    const joints = new Float32Array(24)
    joints.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], 0)
    joints.set([0, -1, 0, 10, 1, 0, 0, 20, 0, 0, 1, 30], 12)
    const point = { joint: 1, offset: [100, 200, 300] as const }
    const out = new Float32Array(8)
    skinMeshSkinAttachment(geo, joints, point, false, out)
    // (1, 2, 3) + offset = (101, 202, 303) -> (-202 + 10, 101 + 20, 303 + 30); normal (0, 1, 0) -> (-1, 0, 0).
    expect([...out]).toEqual([-192, 121, 333, -1, 0, 0, 0.25, 0.75])
    skinMeshSkinAttachment(geo, joints, point, true, out)
    // Mirrored: (1, -2, 3) + offset = (101, 198, 303); normal (0, -1, 0) -> (1, 0, 0).
    expect([...out]).toEqual([-188, 121, 333, 1, 0, 0, 0.25, 0.75])
  })

  it('encodes selections, honours the active weapon set and picks weapon clip variants', () => {
    const sel = resolveMeshPaperdollSelection({ armor: 'qui', hand1: 'sst' })
    const key = encodeMeshPaperdollSelection(sel)
    expect(key).toBe('armor=quilted1,helm=none,offhand=none,weapon=staff')
    expect(decodeMeshPaperdollSelection(key)).toEqual({ armor: 'quilted1', helm: 'none', offhand: 'none', weapon: 'staff' })
    expect(meshPaperdollGlowBySlot(decodeMeshPaperdollSelection(key))).toEqual({})

    const slots = new Map<number, string>([[1, 'cap'], [3, 'chn'], [10, 'hgl'], [11, 'ob1'], [12, 'buc']])
    const qualities = new Map<number, number>([[11, 4], [12, 8], [4, 6]])
    const at = (bodyLoc: number): string | undefined => slots.get(bodyLoc)
    const q = (bodyLoc: number): number | undefined => qualities.get(bodyLoc)
    // Set 0 with empty hands: the swap-set items are not worn.
    expect(resolveMeshPaperdollKeyFromSlots(at, 0, q)).toBe('armor=ring1,helm=cap,offhand=none,weapon=none')
    const swapKey = resolveMeshPaperdollKeyFromSlots(at, 1, q)
    expect(swapKey).toBe('armor=ring1,helm=cap,offhand=buckler,weapon=orb,offhandGlow=crafted,weaponGlow=magic')
    expect(meshPaperdollGlowBySlot(decodeMeshPaperdollSelection(swapKey))).toEqual({
      weapon: MESH_PAPERDOLL_GLOW_RGB.magic,
      offhand: MESH_PAPERDOLL_GLOW_RGB.crafted,
    })
    slots.set(4, 'sst')
    expect(resolveMeshPaperdollKeyFromSlots(at, 1, q)).toBe('armor=ring1,helm=cap,offhand=none,weapon=staff,weaponGlow=rare')
    // Without a quality source nothing glows.
    expect(resolveMeshPaperdollKeyFromSlots(at, 1)).toBe('armor=ring1,helm=cap,offhand=none,weapon=staff')

    const clips = { a1: {}, 'a1:staff': {}, nu: {} }
    expect(resolveMeshWeaponClipKey('a1', 'staff', clips)).toBe('a1:staff')
    expect(resolveMeshWeaponClipKey('a1', 'orb', clips)).toBe('a1')
    expect(resolveMeshWeaponClipKey('nu', 'staff', clips)).toBe('nu')
    expect(resolveMeshWeaponClipKey('a1', undefined, clips)).toBe('a1')
  })

  it('makes the item geosets of glowing slots emit their colour', () => {
    const model = parseMeshSkinModel(buildTestGlb({ paperdoll: paperdoll() }))
    const plain = resolveMeshSkinLook(model, { weapon: 'staff' })!
    expect(plain.glow).toEqual([])
    const glowing = resolveMeshSkinLook(model, { weapon: 'staff' }, { weapon: [0.2, 0.4, 1], armor: [1, 0, 0] })!
    // Only slots whose option shows item geosets can glow (armour is texture layers here).
    expect(glowing.glow).toEqual([{ geosets: [1], color: [0.2, 0.4, 1] }])
    expect(glowing.key).not.toBe(plain.key)
    expect(glowing.canvasKey).toBe(plain.canvasKey)
    // An empty slot has nothing to glow.
    expect(resolveMeshSkinLook(model, {}, { weapon: [0.2, 0.4, 1] })!.glow).toEqual([])
  })

  it('accepts shape-shift models keyed by morph token and rejects unknown tokens', () => {
    const base = meshManifest()
    const heroMesh = base.mesh as Record<string, unknown>
    const clip = { anim: 'nu', loop: false, durationMs: 1000 }
    const morphMesh = { ...heroMesh, clips: { nu: clip, wl: clip, a1: clip, gh: clip, dt: clip } }
    const ok = validateCharacterSkinManifest({ ...base, morphs: { '40': { mesh: morphMesh, shadowScale: 1.2 }, VA: { mesh: morphMesh } } })
    expect(Object.keys(ok.morphs ?? {}).sort()).toEqual(['40', 'va'])
    expect(ok.morphs?.['40']?.shadowScale).toBe(1.2)
    expect(ok.morphs?.va?.mesh.clips.a1).toMatchObject({ anim: 'nu' })
    expect(validateCharacterSkinManifest(base).morphs).toBeUndefined()
    expect(() => validateCharacterSkinManifest({ ...base, morphs: { zz: { mesh: morphMesh } } })).toThrow(/morphs key/)
    // A morph model needs the core clips, like a minion.
    expect(() => validateCharacterSkinManifest({ ...base, morphs: { '40': { mesh: heroMesh } } })).toThrow(/missing required clip "gh"/)
    expect(() => validateCharacterSkinManifest({ ...base, morphs: { '40': { mesh: morphMesh, shadowScale: 9 } } })).toThrow(/shadowScale/)
  })

  it('accepts weapon-specific clip keys in mesh manifests and rejects malformed ones', () => {
    const clip = { anim: 'nu', loop: false, durationMs: 1000 }
    const withClip = (key: string): Record<string, unknown> => {
      const base = meshManifest()
      const mesh = base.mesh as Record<string, unknown>
      return { ...base, mesh: { ...mesh, clips: { ...(mesh.clips as Record<string, unknown>), [key]: clip } } }
    }
    expect(validateCharacterSkinManifest(withClip('a1:staff')).mesh?.clips['a1:staff']).toMatchObject({ anim: 'nu' })
    expect(() => validateCharacterSkinManifest(withClip('a1:'))).toThrow(/clips key/)
    expect(() => validateCharacterSkinManifest(withClip('attack:staff'))).toThrow(/clips key/)
  })
})
