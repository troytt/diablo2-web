/**
 * Real-time mesh skin model: GLB loading, skeletal pose sampling, and CPU skinning
 * (`src/common/units/mesh-skin-model.ts`).
 *
 * Pure deterministic module (zero DOM globals, zero `node:*` imports, zero wall-clock/RNG).
 * The model is source-neutral: any art pipeline that emits the documented GLB layout
 * (`tools/skin-baker/convert_war3_mdx_to_glb.py`) drives the same runtime.
 */

import {
  parseGlbContainer,
  readGlbBufferView,
  readGlbFloatAccessor,
  readGlbUintAccessor,
  type GlbContainer,
} from '../formats/glb-reader.ts'

/** 0 opaque, 1 alpha cutout, 2 alpha blend, 3 additive, 4 additive weighted by texture alpha. */
export type MeshSkinFilterMode = 0 | 1 | 2 | 3 | 4

export interface MeshSkinLayer {
  readonly filterMode: MeshSkinFilterMode
  readonly unshaded: boolean
  /** Index into {@link MeshSkinModel.images}, or `-1` for an untextured (flat colour) layer. */
  readonly image: number
  readonly color: readonly [number, number, number]
  readonly alpha: number
  /** Texture-offset animation target, or `-1`. */
  readonly texAnim: number
  /** Dense index of this layer across the whole model (addresses `MeshSkinPose.layerAlpha`). */
  readonly slot: number
}

export interface MeshSkinGeoset {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  /** Joint influences per vertex: 4, or 8 when the model carries a second JOINTS/WEIGHTS set. */
  readonly influences: number
  /** `influences` joint indices per vertex. */
  readonly joints: Uint16Array
  /** `influences` weights per vertex. */
  readonly weights: Float32Array
  readonly indices: Uint16Array
  readonly alpha: number
  readonly color: readonly [number, number, number]
  readonly layers: readonly MeshSkinLayer[]
}

export interface MeshSkinTrack {
  /** Key times in milliseconds, ascending. */
  readonly times: Float32Array
  readonly values: Float32Array
  readonly stride: number
  readonly step: boolean
}

export interface MeshSkinNodeChannel extends MeshSkinTrack {
  readonly node: number
  /** 0 translation, 1 rotation, 2 scale. */
  readonly path: 0 | 1 | 2
}

export interface MeshSkinClip {
  readonly name: string
  readonly durationMs: number
  readonly loop: boolean
  readonly nodeChannels: readonly MeshSkinNodeChannel[]
  readonly geosetAlpha: readonly (MeshSkinTrack & { readonly geoset: number })[]
  readonly geosetColor: readonly (MeshSkinTrack & { readonly geoset: number })[]
  readonly layerAlpha: readonly (MeshSkinTrack & { readonly slot: number })[]
  readonly texOffset: readonly (MeshSkinTrack & { readonly texAnim: number })[]
}

export interface MeshSkinImage {
  readonly mimeType: string
  readonly bytes: Uint8Array
}

/** One texture layer an equipment option composites onto the paper-doll canvas. */
export interface MeshSkinPaperdollLayer {
  /** Index into {@link MeshSkinModel.images}. */
  readonly image: number
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  /** Compositing order across all worn options (ascending). */
  readonly order: number
}

export interface MeshSkinPaperdollOption {
  readonly show: readonly number[]
  readonly hide: readonly number[]
  readonly layers: readonly MeshSkinPaperdollLayer[]
}

/**
 * Equipment-driven appearance of a model: every slot has named options, each of which shows or
 * hides geosets and adds texture layers on top of the canvas image.
 */
export interface MeshSkinPaperdoll {
  /** Image that worn layers are composited onto (the body texture). */
  readonly canvas: number
  /** Geosets hidden unless a worn option shows them. */
  readonly hidden: readonly number[]
  readonly slots: Readonly<Record<string, Readonly<Record<string, MeshSkinPaperdollOption>>>>
  readonly defaults: Readonly<Record<string, string>>
  /** Where weapons of a shared weapon pack attach, or `null` when the model takes none. */
  readonly attachments: MeshSkinAttachments | null
}

/** One hand of a model: the joint an attached weapon follows and its offset in bind space. */
export interface MeshSkinAttachPoint {
  readonly joint: number
  readonly offset: readonly [number, number, number]
}

export interface MeshSkinAttachments {
  /** Id of the weapon pack (a directory next to the skins) whose models fit these points. */
  readonly pack: string
  readonly right: MeshSkinAttachPoint
  readonly left: MeshSkinAttachPoint
}

/** A resolved paper-doll state: which geosets are drawn and which layers dress the canvas. */
export interface MeshSkinLook {
  /** Stable identity of the look (slot=option pairs in slot order). */
  readonly key: string
  /** Identity of the composited canvas alone (looks that share it share one texture). */
  readonly canvasKey: string
  /** 1 per drawn geoset. */
  readonly visible: Uint8Array
  readonly layers: readonly MeshSkinPaperdollLayer[]
  /** Geosets that emit a coloured glow (the item models of glowing slots). */
  readonly glow: readonly { readonly geosets: readonly number[]; readonly color: readonly [number, number, number] }[]
}

export interface MeshSkinModel {
  readonly nodeCount: number
  readonly nodeNames: readonly string[]
  readonly parents: Int32Array
  /** Node indices ordered so every parent precedes its children. */
  readonly order: Int32Array
  readonly restTranslation: Float32Array
  readonly restRotation: Float32Array
  readonly restScale: Float32Array
  /** Bind pivot per joint (`inverseBind = translate(-pivot)`). */
  readonly pivots: Float32Array
  readonly billboard: Uint8Array
  readonly geosets: readonly MeshSkinGeoset[]
  readonly layerCount: number
  readonly texAnimCount: number
  readonly images: readonly MeshSkinImage[]
  readonly clips: Readonly<Record<string, MeshSkinClip>>
  readonly maxVertexCount: number
  /** Equipment-driven appearance, or `null` for a model with one fixed look. */
  readonly paperdoll: MeshSkinPaperdoll | null
}

interface RawNode {
  readonly name?: string
  readonly translation?: readonly number[]
  readonly rotation?: readonly number[]
  readonly scale?: readonly number[]
  readonly children?: readonly number[]
  readonly extras?: { readonly billboard?: boolean }
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid mesh skin GLB: ${what} must be an object`)
  }
  return value as Record<string, unknown>
}

function asArray(value: unknown, what: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid mesh skin GLB: ${what} must be an array`)
  return value
}

function finiteNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid mesh skin GLB: ${what} must be a finite number`)
  }
  return value
}

function readTrack(glb: GlbContainer, raw: Record<string, unknown>, type: string, what: string): MeshSkinTrack {
  const input = readGlbFloatAccessor(glb, finiteNumber(raw.input, `${what}.input`), 'SCALAR')
  const values = readGlbFloatAccessor(glb, finiteNumber(raw.output, `${what}.output`), type)
  const stride = type === 'SCALAR' ? 1 : type === 'VEC2' ? 2 : type === 'VEC3' ? 3 : 4
  if (input.length === 0 || values.length !== input.length * stride) {
    throw new Error(`Invalid mesh skin GLB: ${what} has mismatched key counts`)
  }
  const times = new Float32Array(input.length)
  for (let i = 0; i < input.length; i += 1) {
    times[i] = input[i]! * 1000
    if (i > 0 && times[i]! < times[i - 1]!) {
      throw new Error(`Invalid mesh skin GLB: ${what} key times are not ascending`)
    }
  }
  const interpolation = raw.interpolation ?? 'LINEAR'
  if (interpolation !== 'LINEAR' && interpolation !== 'STEP') {
    throw new Error(`Unsupported mesh skin GLB interpolation "${String(interpolation)}" in ${what}`)
  }
  return { times, values, stride, step: interpolation === 'STEP' }
}

export function parseMeshSkinModel(bytes: Uint8Array): MeshSkinModel {
  const glb = parseGlbContainer(bytes)
  const json = glb.json as Record<string, unknown>
  const rawNodes = asArray(json.nodes, 'nodes') as readonly RawNode[]
  const skins = asArray(json.skins, 'skins')
  if (skins.length !== 1) throw new Error('Invalid mesh skin GLB: expected exactly one skin')
  const skin = asRecord(skins[0], 'skins[0]')
  const joints = asArray(skin.joints, 'skins[0].joints') as readonly number[]
  const nodeCount = joints.length
  if (nodeCount === 0 || nodeCount > 1024) {
    throw new Error(`Invalid mesh skin GLB: joint count ${String(nodeCount)} outside 1..1024`)
  }
  joints.forEach((j, i) => {
    if (j !== i) throw new Error('Invalid mesh skin GLB: skin joints must be the leading nodes in order')
  })

  const parents = new Int32Array(nodeCount).fill(-1)
  const restTranslation = new Float32Array(nodeCount * 3)
  const restRotation = new Float32Array(nodeCount * 4)
  const restScale = new Float32Array(nodeCount * 3).fill(1)
  const billboard = new Uint8Array(nodeCount)
  const nodeNames: string[] = []
  for (let i = 0; i < nodeCount; i += 1) {
    const nd = rawNodes[i]
    if (!nd) throw new Error(`Invalid mesh skin GLB: joint node ${String(i)} does not exist`)
    nodeNames.push(typeof nd.name === 'string' ? nd.name : `node${String(i)}`)
    restRotation[i * 4 + 3] = 1
    if (nd.translation) for (let k = 0; k < 3; k += 1) restTranslation[i * 3 + k] = finiteNumber(nd.translation[k], 'node.translation')
    if (nd.rotation) for (let k = 0; k < 4; k += 1) restRotation[i * 4 + k] = finiteNumber(nd.rotation[k], 'node.rotation')
    if (nd.scale) for (let k = 0; k < 3; k += 1) restScale[i * 3 + k] = finiteNumber(nd.scale[k], 'node.scale')
    if (nd.extras?.billboard === true) billboard[i] = 1
    for (const child of nd.children ?? []) {
      if (!Number.isInteger(child) || child < 0 || child >= nodeCount || child === i) {
        throw new Error(`Invalid mesh skin GLB: node ${String(i)} has out-of-range child ${String(child)}`)
      }
      if (parents[child] !== -1) throw new Error(`Invalid mesh skin GLB: node ${String(child)} has two parents`)
      parents[child] = i
    }
  }

  // Parent-before-child order; a cycle leaves nodes unvisited and is rejected.
  const order = new Int32Array(nodeCount)
  const depthDone = new Uint8Array(nodeCount)
  let written = 0
  for (let pass = 0; pass < nodeCount && written < nodeCount; pass += 1) {
    for (let i = 0; i < nodeCount; i += 1) {
      if (depthDone[i] === 1) continue
      const p = parents[i]!
      if (p === -1 || depthDone[p] === 1) {
        depthDone[i] = 1
        order[written] = i
        written += 1
      }
    }
  }
  if (written !== nodeCount) throw new Error('Invalid mesh skin GLB: node hierarchy contains a cycle')

  const ibm = readGlbFloatAccessor(glb, finiteNumber(skin.inverseBindMatrices, 'skins[0].inverseBindMatrices'), 'MAT4')
  if (ibm.length !== nodeCount * 16) throw new Error('Invalid mesh skin GLB: inverse bind matrix count mismatch')
  const pivots = new Float32Array(nodeCount * 3)
  for (let i = 0; i < nodeCount; i += 1) {
    // Column-major translation column; this runtime only supports pure-translation inverse binds.
    const o = i * 16
    const pure =
      Math.abs(ibm[o]! - 1) < 1e-4 && Math.abs(ibm[o + 5]! - 1) < 1e-4 && Math.abs(ibm[o + 10]! - 1) < 1e-4 &&
      Math.abs(ibm[o + 1]!) < 1e-4 && Math.abs(ibm[o + 2]!) < 1e-4 && Math.abs(ibm[o + 4]!) < 1e-4 &&
      Math.abs(ibm[o + 6]!) < 1e-4 && Math.abs(ibm[o + 8]!) < 1e-4 && Math.abs(ibm[o + 9]!) < 1e-4
    if (!pure) throw new Error('Unsupported mesh skin GLB: inverse bind matrices must be pure translations')
    pivots[i * 3] = 0 - ibm[o + 12]!
    pivots[i * 3 + 1] = 0 - ibm[o + 13]!
    pivots[i * 3 + 2] = 0 - ibm[o + 14]!
  }

  // ---- images / materials ---------------------------------------------------
  const rawImages = json.images === undefined ? [] : asArray(json.images, 'images')
  const images: MeshSkinImage[] = rawImages.map((raw, i) => {
    const img = asRecord(raw, `images[${String(i)}]`)
    if (typeof img.bufferView !== 'number') throw new Error('Unsupported mesh skin GLB: images must be embedded')
    const mimeType = typeof img.mimeType === 'string' ? img.mimeType : 'image/png'
    return { mimeType, bytes: readGlbBufferView(glb, img.bufferView) }
  })
  const rawTextures = json.textures === undefined ? [] : asArray(json.textures, 'textures')
  const rawMaterials = asArray(json.materials, 'materials')

  // ---- geosets ----------------------------------------------------------------
  const meshes = asArray(json.meshes, 'meshes')
  if (meshes.length !== 1) throw new Error('Invalid mesh skin GLB: expected exactly one mesh')
  const prims = asArray(asRecord(meshes[0], 'meshes[0]').primitives, 'meshes[0].primitives')
  const geosetByIndex = new Map<number, { geo: Omit<MeshSkinGeoset, 'layers'>; layers: MeshSkinLayer[] }>()
  let layerCount = 0
  let texAnimCount = 0
  let maxVertexCount = 0
  for (let pi = 0; pi < prims.length; pi += 1) {
    const prim = asRecord(prims[pi], `primitives[${String(pi)}]`)
    const extras = asRecord(prim.extras, `primitives[${String(pi)}].extras`)
    const gi = finiteNumber(extras.geoset, 'primitive.extras.geoset')
    let entry = geosetByIndex.get(gi)
    if (!entry) {
      const attrs = asRecord(prim.attributes, 'primitive.attributes')
      const positions = readGlbFloatAccessor(glb, finiteNumber(attrs.POSITION, 'POSITION'), 'VEC3')
      const vertexCount = positions.length / 3
      const normals = readGlbFloatAccessor(glb, finiteNumber(attrs.NORMAL, 'NORMAL'), 'VEC3')
      const uvs = readGlbFloatAccessor(glb, finiteNumber(attrs.TEXCOORD_0, 'TEXCOORD_0'), 'VEC2')
      let jointIdx = readGlbUintAccessor(glb, finiteNumber(attrs.JOINTS_0, 'JOINTS_0'), 'VEC4')
      let weights = readGlbFloatAccessor(glb, finiteNumber(attrs.WEIGHTS_0, 'WEIGHTS_0'), 'VEC4')
      let influences = 4
      if (attrs.JOINTS_1 !== undefined || attrs.WEIGHTS_1 !== undefined) {
        const joints1 = readGlbUintAccessor(glb, finiteNumber(attrs.JOINTS_1, 'JOINTS_1'), 'VEC4')
        const weights1 = readGlbFloatAccessor(glb, finiteNumber(attrs.WEIGHTS_1, 'WEIGHTS_1'), 'VEC4')
        if (
          jointIdx.length !== vertexCount * 4 || weights.length !== vertexCount * 4 ||
          joints1.length !== vertexCount * 4 || weights1.length !== vertexCount * 4
        ) {
          throw new Error(`Invalid mesh skin GLB: geoset ${String(gi)} has mismatched vertex attribute counts`)
        }
        influences = 8
        const mergedJoints = new Uint16Array(vertexCount * 8)
        const mergedWeights = new Float32Array(vertexCount * 8)
        for (let v = 0; v < vertexCount; v += 1) {
          mergedJoints.set(jointIdx.subarray(v * 4, v * 4 + 4), v * 8)
          mergedJoints.set(joints1.subarray(v * 4, v * 4 + 4), v * 8 + 4)
          mergedWeights.set(weights.subarray(v * 4, v * 4 + 4), v * 8)
          mergedWeights.set(weights1.subarray(v * 4, v * 4 + 4), v * 8 + 4)
        }
        jointIdx = mergedJoints
        weights = mergedWeights
      }
      const indices = readGlbUintAccessor(glb, finiteNumber(prim.indices, 'primitive.indices'), 'SCALAR')
      if (
        normals.length !== vertexCount * 3 || uvs.length !== vertexCount * 2 ||
        jointIdx.length !== vertexCount * influences || weights.length !== vertexCount * influences ||
        indices.length % 3 !== 0
      ) {
        throw new Error(`Invalid mesh skin GLB: geoset ${String(gi)} has mismatched vertex attribute counts`)
      }
      for (let k = 0; k < jointIdx.length; k += 1) {
        if (jointIdx[k]! >= nodeCount) throw new Error(`Invalid mesh skin GLB: geoset ${String(gi)} joint out of range`)
      }
      for (let k = 0; k < indices.length; k += 1) {
        if (indices[k]! >= vertexCount) throw new Error(`Invalid mesh skin GLB: geoset ${String(gi)} index out of range`)
      }
      const colorRaw = Array.isArray(extras.color) ? (extras.color as readonly unknown[]) : [1, 1, 1]
      entry = {
        geo: {
          positions,
          normals,
          uvs,
          influences,
          joints: jointIdx,
          weights,
          indices,
          alpha: extras.alpha === undefined ? 1 : finiteNumber(extras.alpha, 'primitive.extras.alpha'),
          color: [
            finiteNumber(colorRaw[0], 'primitive.extras.color'),
            finiteNumber(colorRaw[1], 'primitive.extras.color'),
            finiteNumber(colorRaw[2], 'primitive.extras.color'),
          ],
        },
        layers: [],
      }
      geosetByIndex.set(gi, entry)
      maxVertexCount = Math.max(maxVertexCount, vertexCount)
    }
    const mat = asRecord(rawMaterials[finiteNumber(prim.material, 'primitive.material')], 'material')
    const matExtras = asRecord(mat.extras, 'material.extras')
    const filterMode = finiteNumber(matExtras.filterMode, 'material.extras.filterMode')
    if (!Number.isInteger(filterMode) || filterMode < 0 || filterMode > 4) {
      throw new Error(`Unsupported mesh skin GLB material filterMode ${String(filterMode)}`)
    }
    const pbr = asRecord(mat.pbrMetallicRoughness ?? {}, 'material.pbrMetallicRoughness')
    const factor = Array.isArray(pbr.baseColorFactor) ? (pbr.baseColorFactor as readonly unknown[]) : [1, 1, 1, 1]
    let image = -1
    if (pbr.baseColorTexture !== undefined) {
      const texIndex = finiteNumber(asRecord(pbr.baseColorTexture, 'baseColorTexture').index, 'baseColorTexture.index')
      const tex = asRecord(rawTextures[texIndex], `textures[${String(texIndex)}]`)
      image = finiteNumber(tex.source, 'texture.source')
      if (!Number.isInteger(image) || image < 0 || image >= images.length) {
        throw new Error(`Invalid mesh skin GLB: texture source ${String(image)} out of range`)
      }
    }
    const texAnim = matExtras.texAnim === undefined ? -1 : finiteNumber(matExtras.texAnim, 'material.extras.texAnim')
    if (texAnim >= 0) texAnimCount = Math.max(texAnimCount, texAnim + 1)
    entry.layers.push({
      filterMode: filterMode as MeshSkinFilterMode,
      unshaded: matExtras.unshaded === true,
      image,
      color: [
        finiteNumber(factor[0], 'baseColorFactor'),
        finiteNumber(factor[1], 'baseColorFactor'),
        finiteNumber(factor[2], 'baseColorFactor'),
      ],
      alpha: finiteNumber(factor[3], 'baseColorFactor'),
      texAnim,
      slot: layerCount,
    })
    layerCount += 1
  }
  const geosetIds = [...geosetByIndex.keys()].sort((a, b) => a - b)
  geosetIds.forEach((id, i) => {
    if (id !== i) throw new Error('Invalid mesh skin GLB: geoset ids must be dense and start at 0')
  })
  const geosets: MeshSkinGeoset[] = geosetIds.map((id) => {
    const e = geosetByIndex.get(id)!
    return { ...e.geo, layers: e.layers }
  })
  const slotOf = (geoset: number, layer: number, what: string): number => {
    const l = geosets[geoset]?.layers[layer]
    if (!l) throw new Error(`Invalid mesh skin GLB: ${what} targets missing geoset ${String(geoset)} layer ${String(layer)}`)
    return l.slot
  }

  // ---- clips ------------------------------------------------------------------
  const clips: Record<string, MeshSkinClip> = {}
  for (const rawAnim of asArray(json.animations, 'animations')) {
    const anim = asRecord(rawAnim, 'animation')
    const name = typeof anim.name === 'string' ? anim.name.trim().toLowerCase() : ''
    if (name.length === 0 || clips[name]) throw new Error(`Invalid mesh skin GLB: missing or duplicate animation name "${name}"`)
    const extras = asRecord(anim.extras, `animation "${name}" extras`)
    const durationMs = finiteNumber(extras.durationMs, `animation "${name}" durationMs`)
    if (!(durationMs > 0)) throw new Error(`Invalid mesh skin GLB: animation "${name}" has non-positive duration`)
    const samplers = asArray(anim.samplers ?? [], 'animation.samplers')
    const nodeChannels: MeshSkinNodeChannel[] = []
    for (const rawCh of asArray(anim.channels ?? [], 'animation.channels')) {
      const ch = asRecord(rawCh, 'animation.channel')
      const target = asRecord(ch.target, 'animation.channel.target')
      const node = finiteNumber(target.node, 'channel.target.node')
      if (!Number.isInteger(node) || node < 0 || node >= nodeCount) {
        throw new Error(`Invalid mesh skin GLB: animation "${name}" targets node ${String(node)} out of range`)
      }
      const path = target.path === 'translation' ? 0 : target.path === 'rotation' ? 1 : target.path === 'scale' ? 2 : -1
      if (path < 0) throw new Error(`Unsupported mesh skin GLB channel path "${String(target.path)}"`)
      const sampler = asRecord(samplers[finiteNumber(ch.sampler, 'channel.sampler')], 'animation.sampler')
      const track = readTrack(glb, sampler, path === 1 ? 'VEC4' : 'VEC3', `animation "${name}" node channel`)
      nodeChannels.push({ ...track, node, path: path as 0 | 1 | 2 })
    }
    const list = (key: string): readonly Record<string, unknown>[] =>
      extras[key] === undefined ? [] : asArray(extras[key], `animation.extras.${key}`).map((r) => asRecord(r, key))
    const geosetTarget = (raw: Record<string, unknown>, what: string): number => {
      const g = finiteNumber(raw.geoset, `${what}.geoset`)
      if (!geosets[g]) throw new Error(`Invalid mesh skin GLB: ${what} targets missing geoset ${String(g)}`)
      return g
    }
    clips[name] = {
      name,
      durationMs,
      loop: extras.loop === true,
      nodeChannels,
      geosetAlpha: list('geosetAlpha').map((r) => ({
        ...readTrack(glb, r, 'SCALAR', 'geosetAlpha'),
        geoset: geosetTarget(r, 'geosetAlpha'),
      })),
      geosetColor: list('geosetColor').map((r) => ({
        ...readTrack(glb, r, 'VEC3', 'geosetColor'),
        geoset: geosetTarget(r, 'geosetColor'),
      })),
      layerAlpha: list('layerAlpha').map((r) => ({
        ...readTrack(glb, r, 'SCALAR', 'layerAlpha'),
        slot: slotOf(finiteNumber(r.geoset, 'layerAlpha.geoset'), finiteNumber(r.layer, 'layerAlpha.layer'), 'layerAlpha'),
      })),
      texOffset: list('texOffset').map((r) => {
        const texAnim = finiteNumber(r.texAnim, 'texOffset.texAnim')
        if (!Number.isInteger(texAnim) || texAnim < 0) throw new Error('Invalid mesh skin GLB: texOffset.texAnim')
        texAnimCount = Math.max(texAnimCount, texAnim + 1)
        return { ...readTrack(glb, r, 'VEC2', 'texOffset'), texAnim }
      }),
    }
  }
  if (Object.keys(clips).length === 0) throw new Error('Invalid mesh skin GLB: no animations')

  const rootExtras = json.extras === undefined ? {} : asRecord(json.extras, 'extras')
  const paperdoll =
    rootExtras.paperdoll === undefined
      ? null
      : parsePaperdoll(rootExtras.paperdoll, geosets.length, images.length, nodeCount)

  return {
    nodeCount,
    nodeNames,
    parents,
    order,
    restTranslation,
    restRotation,
    restScale,
    pivots,
    billboard,
    geosets,
    layerCount,
    texAnimCount,
    images,
    clips,
    maxVertexCount,
    paperdoll,
  }
}

function parsePaperdoll(raw: unknown, geosetCount: number, imageCount: number, nodeCount: number): MeshSkinPaperdoll {
  const obj = asRecord(raw, 'extras.paperdoll')
  const geosetList = (value: unknown, what: string): number[] =>
    asArray(value ?? [], what).map((v) => {
      const g = finiteNumber(v, what)
      if (!Number.isInteger(g) || g < 0 || g >= geosetCount) {
        throw new Error(`Invalid mesh skin GLB: ${what} references missing geoset ${String(g)}`)
      }
      return g
    })
  const imageIndex = (value: unknown, what: string): number => {
    const i = finiteNumber(value, what)
    if (!Number.isInteger(i) || i < 0 || i >= imageCount) {
      throw new Error(`Invalid mesh skin GLB: ${what} references missing image ${String(i)}`)
    }
    return i
  }
  const slots: Record<string, Record<string, MeshSkinPaperdollOption>> = {}
  const defaults: Record<string, string> = {}
  const rawDefaults = asRecord(obj.defaults, 'paperdoll.defaults')
  for (const [slot, rawOptions] of Object.entries(asRecord(obj.slots, 'paperdoll.slots'))) {
    const options: Record<string, MeshSkinPaperdollOption> = {}
    for (const [name, rawOption] of Object.entries(asRecord(rawOptions, `paperdoll.slots.${slot}`))) {
      const what = `paperdoll.slots.${slot}.${name}`
      const opt = asRecord(rawOption, what)
      options[name] = {
        show: geosetList(opt.show, `${what}.show`),
        hide: geosetList(opt.hide, `${what}.hide`),
        layers: asArray(opt.layers ?? [], `${what}.layers`).map((rawLayer) => {
          const layer = asRecord(rawLayer, `${what}.layers[]`)
          const rect = (['x', 'y', 'w', 'h'] as const).map((k) => finiteNumber(layer[k], `${what}.layers[].${k}`))
          if (rect.some((v) => !Number.isInteger(v) || v < 0) || rect[2] === 0 || rect[3] === 0) {
            throw new Error(`Invalid mesh skin GLB: ${what} has an invalid layer rectangle`)
          }
          return {
            image: imageIndex(layer.image, `${what}.layers[].image`),
            x: rect[0]!, y: rect[1]!, w: rect[2]!, h: rect[3]!,
            order: finiteNumber(layer.order ?? 0, `${what}.layers[].order`),
          }
        }),
      }
    }
    const def = rawDefaults[slot]
    if (typeof def !== 'string' || !options[def]) {
      throw new Error(`Invalid mesh skin GLB: paperdoll slot "${slot}" has no valid default option`)
    }
    slots[slot] = options
    defaults[slot] = def
  }
  let attachments: MeshSkinAttachments | null = null
  if (obj.attachments !== undefined) {
    const rawAtt = asRecord(obj.attachments, 'paperdoll.attachments')
    const pack = rawAtt.pack
    if (typeof pack !== 'string' || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(pack)) {
      throw new Error('Invalid mesh skin GLB: paperdoll.attachments.pack')
    }
    const point = (hand: 'right' | 'left'): MeshSkinAttachPoint => {
      const what = `paperdoll.attachments.${hand}`
      const rawPoint = asRecord(rawAtt[hand], what)
      const joint = finiteNumber(rawPoint.joint, `${what}.joint`)
      if (!Number.isInteger(joint) || joint < 0 || joint >= nodeCount) {
        throw new Error(`Invalid mesh skin GLB: ${what} references missing joint ${String(joint)}`)
      }
      const offset = asArray(rawPoint.offset, `${what}.offset`).map((v) => finiteNumber(v, `${what}.offset`))
      if (offset.length !== 3) throw new Error(`Invalid mesh skin GLB: ${what}.offset must have 3 numbers`)
      return { joint, offset: [offset[0]!, offset[1]!, offset[2]!] }
    }
    attachments = { pack, right: point('right'), left: point('left') }
  }
  return {
    canvas: imageIndex(obj.canvas, 'paperdoll.canvas'),
    hidden: geosetList(obj.hidden, 'paperdoll.hidden'),
    slots,
    defaults,
    attachments,
  }
}

/**
 * Resolve the options worn per slot into a look. Unknown slots are ignored and a missing or unknown
 * option falls back to the slot's default, so a look always describes a complete model.
 *
 * @param glowBySlot - glow colour per slot; the geosets shown by that slot's option emit it.
 */
export function resolveMeshSkinLook(
  model: MeshSkinModel,
  selection: Readonly<Record<string, string | undefined>>,
  glowBySlot: Readonly<Record<string, readonly [number, number, number]>> = {},
): MeshSkinLook | null {
  const doll = model.paperdoll
  if (doll === null) return null
  const slotNames = Object.keys(doll.slots).sort()
  const worn: MeshSkinPaperdollOption[] = []
  const keyParts: string[] = []
  const canvasParts: string[] = []
  const glow: { geosets: readonly number[]; color: readonly [number, number, number] }[] = []
  for (const slot of slotNames) {
    const options = doll.slots[slot]!
    const picked = selection[slot]
    const name = picked !== undefined && options[picked] ? picked : doll.defaults[slot]!
    const option = options[name]!
    worn.push(option)
    keyParts.push(`${slot}=${name}`)
    if (option.layers.length > 0) canvasParts.push(`${slot}=${name}`)
    const color = glowBySlot[slot]
    if (color !== undefined && option.show.length > 0) {
      glow.push({ geosets: option.show, color })
      keyParts.push(`${slot}Glow=${color.join('/')}`)
    }
  }
  const visible = new Uint8Array(model.geosets.length).fill(1)
  for (const g of doll.hidden) visible[g] = 0
  for (const option of worn) for (const g of option.hide) visible[g] = 0
  for (const option of worn) for (const g of option.show) visible[g] = 1
  const layers = worn
    .flatMap((option, slotIndex) => option.layers.map((layer, i) => ({ layer, tie: slotIndex * 1024 + i })))
    .sort((a, b) => a.layer.order - b.layer.order || a.tie - b.tie)
    .map((e) => e.layer)
  return { key: keyParts.join(','), canvasKey: canvasParts.join(','), visible, layers, glow }
}

// ============================================================================
// Pose sampling
// ============================================================================

export interface MeshSkinPose {
  readonly translation: Float32Array
  readonly rotation: Float32Array
  readonly scale: Float32Array
  readonly geosetAlpha: Float32Array
  readonly geosetColor: Float32Array
  readonly layerAlpha: Float32Array
  readonly texOffset: Float32Array
}

export function createMeshSkinPose(model: MeshSkinModel): MeshSkinPose {
  return {
    translation: new Float32Array(model.nodeCount * 3),
    rotation: new Float32Array(model.nodeCount * 4),
    scale: new Float32Array(model.nodeCount * 3),
    geosetAlpha: new Float32Array(model.geosets.length),
    geosetColor: new Float32Array(model.geosets.length * 3),
    layerAlpha: new Float32Array(model.layerCount),
    texOffset: new Float32Array(Math.max(1, model.texAnimCount) * 2),
  }
}

function sampleTrackInto(track: MeshSkinTrack, tMs: number, out: Float32Array, outOffset: number, slerp: boolean): void {
  const { times, values, stride } = track
  const n = times.length
  let lo = 0
  if (tMs <= times[0]!) {
    lo = 0
  } else if (tMs >= times[n - 1]!) {
    lo = n - 1
  } else {
    let hi = n - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (times[mid]! <= tMs) lo = mid
      else hi = mid
    }
    const t0 = times[lo]!
    const t1 = times[hi]!
    if (!track.step && t1 > t0) {
      const u = (tMs - t0) / (t1 - t0)
      const a = lo * stride
      const b = hi * stride
      if (slerp) {
        let ax = values[a]!, ay = values[a + 1]!, az = values[a + 2]!, aw = values[a + 3]!
        let bx = values[b]!, by = values[b + 1]!, bz = values[b + 2]!, bw = values[b + 3]!
        let dot = ax * bx + ay * by + az * bz + aw * bw
        if (dot < 0) {
          bx = -bx; by = -by; bz = -bz; bw = -bw
          dot = -dot
        }
        let s0 = 1 - u
        let s1 = u
        if (dot <= 0.9995) {
          const theta0 = Math.acos(Math.min(1, dot))
          const sin0 = Math.sin(theta0)
          const theta = theta0 * u
          s0 = Math.cos(theta) - (dot * Math.sin(theta)) / sin0
          s1 = Math.sin(theta) / sin0
        }
        ax = s0 * ax + s1 * bx; ay = s0 * ay + s1 * by; az = s0 * az + s1 * bz; aw = s0 * aw + s1 * bw
        const len = Math.hypot(ax, ay, az, aw)
        if (len > 1e-8) {
          out[outOffset] = ax / len; out[outOffset + 1] = ay / len; out[outOffset + 2] = az / len; out[outOffset + 3] = aw / len
        } else {
          out[outOffset] = 0; out[outOffset + 1] = 0; out[outOffset + 2] = 0; out[outOffset + 3] = 1
        }
        return
      }
      for (let k = 0; k < stride; k += 1) {
        const va = values[a + k]!
        out[outOffset + k] = va + (values[b + k]! - va) * u
      }
      return
    }
  }
  const base = lo * stride
  for (let k = 0; k < stride; k += 1) out[outOffset + k] = values[base + k]!
}

/** Evaluate `clip` at `timeMs` (clamped to `[0, durationMs]`) into `pose`. */
export function sampleMeshSkinClip(model: MeshSkinModel, clip: MeshSkinClip, timeMs: number, pose: MeshSkinPose): void {
  const t = timeMs <= 0 ? 0 : timeMs >= clip.durationMs ? clip.durationMs : timeMs
  pose.translation.set(model.restTranslation)
  pose.rotation.set(model.restRotation)
  pose.scale.set(model.restScale)
  for (let g = 0; g < model.geosets.length; g += 1) {
    const geo = model.geosets[g]!
    pose.geosetAlpha[g] = geo.alpha
    pose.geosetColor[g * 3] = geo.color[0]
    pose.geosetColor[g * 3 + 1] = geo.color[1]
    pose.geosetColor[g * 3 + 2] = geo.color[2]
    for (const layer of geo.layers) pose.layerAlpha[layer.slot] = layer.alpha
  }
  pose.texOffset.fill(0)

  for (const ch of clip.nodeChannels) {
    if (ch.path === 0) sampleTrackInto(ch, t, pose.translation, ch.node * 3, false)
    else if (ch.path === 1) sampleTrackInto(ch, t, pose.rotation, ch.node * 4, true)
    else sampleTrackInto(ch, t, pose.scale, ch.node * 3, false)
  }
  for (const tr of clip.geosetAlpha) sampleTrackInto(tr, t, pose.geosetAlpha, tr.geoset, false)
  for (const tr of clip.geosetColor) sampleTrackInto(tr, t, pose.geosetColor, tr.geoset * 3, false)
  for (const tr of clip.layerAlpha) sampleTrackInto(tr, t, pose.layerAlpha, tr.slot, false)
  for (const tr of clip.texOffset) sampleTrackInto(tr, t, pose.texOffset, tr.texAnim * 2, false)
}

export function copyMeshSkinPose(src: MeshSkinPose, dst: MeshSkinPose): void {
  dst.translation.set(src.translation)
  dst.rotation.set(src.rotation)
  dst.scale.set(src.scale)
  dst.geosetAlpha.set(src.geosetAlpha)
  dst.geosetColor.set(src.geosetColor)
  dst.layerAlpha.set(src.layerAlpha)
  dst.texOffset.set(src.texOffset)
}

/**
 * Blend the skeleton of `pose` towards `from` (`weight` = how much of `from` remains, 0..1).
 * Only bone transforms cross-fade; visibility, colour and texture tracks follow the new clip.
 */
export function blendMeshSkinPoseFrom(pose: MeshSkinPose, from: MeshSkinPose, weight: number): void {
  if (!(weight > 0)) return
  const w = weight >= 1 ? 1 : weight
  const k = 1 - w
  const t = pose.translation
  const ft = from.translation
  for (let i = 0; i < t.length; i += 1) t[i] = t[i]! * k + ft[i]! * w
  const s = pose.scale
  const fs = from.scale
  for (let i = 0; i < s.length; i += 1) s[i] = s[i]! * k + fs[i]! * w
  const r = pose.rotation
  const fr = from.rotation
  for (let i = 0; i < r.length; i += 4) {
    let bx = fr[i]!, by = fr[i + 1]!, bz = fr[i + 2]!, bw = fr[i + 3]!
    const ax = r[i]!, ay = r[i + 1]!, az = r[i + 2]!, aw = r[i + 3]!
    if (ax * bx + ay * by + az * bz + aw * bw < 0) {
      bx = -bx; by = -by; bz = -bz; bw = -bw
    }
    const x = ax * k + bx * w, y = ay * k + by * w, z = az * k + bz * w, q = aw * k + bw * w
    const len = Math.hypot(x, y, z, q)
    if (len > 1e-8) {
      r[i] = x / len; r[i + 1] = y / len; r[i + 2] = z / len; r[i + 3] = q / len
    }
  }
}

// ============================================================================
// Joint matrices and CPU skinning
// ============================================================================

/**
 * Compute skinning matrices (`global * translate(-pivot)`) as row-major 3x4 blocks (12 floats per joint).
 *
 * @param billboardBasis - optional model-space camera basis (9 floats, columns X, Y, Z). Billboard
 *   nodes keep their position and scale but take this orientation, so their local +X faces the camera.
 * @param globals - scratch buffer of `nodeCount * 12` floats.
 */
export function computeMeshSkinJointMatrices(
  model: MeshSkinModel,
  pose: MeshSkinPose,
  billboardBasis: Float32Array | null,
  globals: Float32Array,
  out: Float32Array,
): void {
  const { order, parents, pivots, billboard } = model
  const T = pose.translation
  const R = pose.rotation
  const S = pose.scale
  for (let oi = 0; oi < order.length; oi += 1) {
    const i = order[oi]!
    const x = R[i * 4]!, y = R[i * 4 + 1]!, z = R[i * 4 + 2]!, w = R[i * 4 + 3]!
    const sx = S[i * 3]!, sy = S[i * 3 + 1]!, sz = S[i * 3 + 2]!
    const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z
    // local = R * diag(S), translation T
    const l00 = (1 - 2 * (yy + zz)) * sx, l01 = 2 * (xy - wz) * sy, l02 = 2 * (xz + wy) * sz
    const l10 = 2 * (xy + wz) * sx, l11 = (1 - 2 * (xx + zz)) * sy, l12 = 2 * (yz - wx) * sz
    const l20 = 2 * (xz - wy) * sx, l21 = 2 * (yz + wx) * sy, l22 = (1 - 2 * (xx + yy)) * sz
    const tx = T[i * 3]!, ty = T[i * 3 + 1]!, tz = T[i * 3 + 2]!
    const g = i * 12
    const p = parents[i]!
    if (p < 0) {
      globals[g] = l00; globals[g + 1] = l01; globals[g + 2] = l02; globals[g + 3] = tx
      globals[g + 4] = l10; globals[g + 5] = l11; globals[g + 6] = l12; globals[g + 7] = ty
      globals[g + 8] = l20; globals[g + 9] = l21; globals[g + 10] = l22; globals[g + 11] = tz
    } else {
      const q = p * 12
      for (let row = 0; row < 3; row += 1) {
        const a = globals[q + row * 4]!, b = globals[q + row * 4 + 1]!, c = globals[q + row * 4 + 2]!
        globals[g + row * 4] = a * l00 + b * l10 + c * l20
        globals[g + row * 4 + 1] = a * l01 + b * l11 + c * l21
        globals[g + row * 4 + 2] = a * l02 + b * l12 + c * l22
        globals[g + row * 4 + 3] = a * tx + b * ty + c * tz + globals[q + row * 4 + 3]!
      }
    }
    if (billboardBasis !== null && billboard[i] === 1) {
      const cx = Math.hypot(globals[g]!, globals[g + 4]!, globals[g + 8]!)
      const cy = Math.hypot(globals[g + 1]!, globals[g + 5]!, globals[g + 9]!)
      const cz = Math.hypot(globals[g + 2]!, globals[g + 6]!, globals[g + 10]!)
      for (let row = 0; row < 3; row += 1) {
        globals[g + row * 4] = billboardBasis[row]! * cx
        globals[g + row * 4 + 1] = billboardBasis[3 + row]! * cy
        globals[g + row * 4 + 2] = billboardBasis[6 + row]! * cz
      }
    }
  }
  for (let i = 0; i < model.nodeCount; i += 1) {
    const g = i * 12
    const px = pivots[i * 3]!, py = pivots[i * 3 + 1]!, pz = pivots[i * 3 + 2]!
    for (let row = 0; row < 3; row += 1) {
      const a = globals[g + row * 4]!, b = globals[g + row * 4 + 1]!, c = globals[g + row * 4 + 2]!
      out[g + row * 4] = a
      out[g + row * 4 + 1] = b
      out[g + row * 4 + 2] = c
      out[g + row * 4 + 3] = globals[g + row * 4 + 3]! - (a * px + b * py + c * pz)
    }
  }
}

/** Skin one geoset on the CPU into interleaved `[x, y, z, nx, ny, nz, u, v]` vertices. */
export function skinMeshSkinGeoset(geoset: MeshSkinGeoset, jointMatrices: Float32Array, out: Float32Array): void {
  const { positions, normals, uvs, joints, weights, influences } = geoset
  const count = positions.length / 3
  for (let v = 0; v < count; v += 1) {
    const px = positions[v * 3]!, py = positions[v * 3 + 1]!, pz = positions[v * 3 + 2]!
    const nx = normals[v * 3]!, ny = normals[v * 3 + 1]!, nz = normals[v * 3 + 2]!
    let ox = 0, oy = 0, oz = 0, onx = 0, ony = 0, onz = 0
    for (let k = 0; k < influences; k += 1) {
      const wgt = weights[v * influences + k]!
      if (wgt === 0) continue
      const m = joints[v * influences + k]! * 12
      const m0 = jointMatrices[m]!, m1 = jointMatrices[m + 1]!, m2 = jointMatrices[m + 2]!
      const m4 = jointMatrices[m + 4]!, m5 = jointMatrices[m + 5]!, m6 = jointMatrices[m + 6]!
      const m8 = jointMatrices[m + 8]!, m9 = jointMatrices[m + 9]!, m10 = jointMatrices[m + 10]!
      ox += wgt * (m0 * px + m1 * py + m2 * pz + jointMatrices[m + 3]!)
      oy += wgt * (m4 * px + m5 * py + m6 * pz + jointMatrices[m + 7]!)
      oz += wgt * (m8 * px + m9 * py + m10 * pz + jointMatrices[m + 11]!)
      onx += wgt * (m0 * nx + m1 * ny + m2 * nz)
      ony += wgt * (m4 * nx + m5 * ny + m6 * nz)
      onz += wgt * (m8 * nx + m9 * ny + m10 * nz)
    }
    const len = Math.hypot(onx, ony, onz)
    const inv = len > 1e-8 ? 1 / len : 0
    const o = v * 8
    out[o] = ox; out[o + 1] = oy; out[o + 2] = oz
    out[o + 3] = onx * inv; out[o + 4] = ony * inv; out[o + 5] = onz * inv
    out[o + 6] = uvs[v * 2]!; out[o + 7] = uvs[v * 2 + 1]!
  }
}

/**
 * Skin a rigid attachment (a weapon model in its own space) onto one joint of another model:
 * `joint * (position [mirrored across the XZ plane] + offset)`, written like {@link skinMeshSkinGeoset}.
 *
 * @param jointMatrices - skinning matrices of the model that holds the attachment.
 */
export function skinMeshSkinAttachment(
  geoset: MeshSkinGeoset,
  jointMatrices: Float32Array,
  point: MeshSkinAttachPoint,
  mirror: boolean,
  out: Float32Array,
): void {
  const { positions, normals, uvs } = geoset
  const count = positions.length / 3
  const m = point.joint * 12
  const m0 = jointMatrices[m]!, m1 = jointMatrices[m + 1]!, m2 = jointMatrices[m + 2]!, m3 = jointMatrices[m + 3]!
  const m4 = jointMatrices[m + 4]!, m5 = jointMatrices[m + 5]!, m6 = jointMatrices[m + 6]!, m7 = jointMatrices[m + 7]!
  const m8 = jointMatrices[m + 8]!, m9 = jointMatrices[m + 9]!, m10 = jointMatrices[m + 10]!, m11 = jointMatrices[m + 11]!
  const ySign = mirror ? -1 : 1
  const [ox, oy, oz] = point.offset
  for (let v = 0; v < count; v += 1) {
    const px = positions[v * 3]! + ox, py = positions[v * 3 + 1]! * ySign + oy, pz = positions[v * 3 + 2]! + oz
    const nx = normals[v * 3]!, ny = normals[v * 3 + 1]! * ySign, nz = normals[v * 3 + 2]!
    const onx = m0 * nx + m1 * ny + m2 * nz
    const ony = m4 * nx + m5 * ny + m6 * nz
    const onz = m8 * nx + m9 * ny + m10 * nz
    const len = Math.hypot(onx, ony, onz)
    const inv = len > 1e-8 ? 1 / len : 0
    const o = v * 8
    out[o] = m0 * px + m1 * py + m2 * pz + m3
    out[o + 1] = m4 * px + m5 * py + m6 * pz + m7
    out[o + 2] = m8 * px + m9 * py + m10 * pz + m11
    out[o + 3] = onx * inv; out[o + 4] = ony * inv; out[o + 5] = onz * inv
    out[o + 6] = uvs[v * 2]!; out[o + 7] = uvs[v * 2 + 1]!
  }
}

// ============================================================================
// Camera and timing helpers
// ============================================================================

/** Camera pitch of the 2:1 isometric projection (sin = 0.5). */
const SIN_PITCH = 0.5
const COS_PITCH = Math.sqrt(1 - SIN_PITCH * SIN_PITCH)

/**
 * Model -> camera rotation (row-major 3x3) for a unit facing `dir64` (fractional values allowed).
 *
 * Model space is +X forward, +Y left, +Z up. Camera space is +X screen right, +Y screen down,
 * +Z towards the viewer. dir64 0 faces screen south and grows clockwise on screen.
 */
export function meshSkinCameraRotation(dir64: number, out: Float32Array): void {
  const yaw = (dir64 / 64) * Math.PI * 2
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  // World: wx = y*c - x*s, wy = y*s + x*c, wz = z; then pitch about the screen X axis.
  out[0] = -s; out[1] = c; out[2] = 0
  out[3] = c * SIN_PITCH; out[4] = s * SIN_PITCH; out[5] = -COS_PITCH
  out[6] = c * COS_PITCH; out[7] = s * COS_PITCH; out[8] = SIN_PITCH
}

/**
 * Model-space basis (columns X, Y, Z as 9 floats) that makes a billboard node face the camera:
 * local +X towards the viewer, +Y screen right, +Z screen up.
 */
export function meshSkinBillboardBasis(cameraRotation: Float32Array, out: Float32Array): void {
  // The camera rotation is orthogonal, so its rows are the camera axes expressed in model space.
  out[0] = cameraRotation[6]!; out[1] = cameraRotation[7]!; out[2] = cameraRotation[8]!
  out[3] = cameraRotation[0]!; out[4] = cameraRotation[1]!; out[5] = cameraRotation[2]!
  out[6] = -cameraRotation[3]!; out[7] = -cameraRotation[4]!; out[8] = -cameraRotation[5]!
}

/**
 * Clip time for a one-shot action whose gameplay progress is `progress` (0..1).
 *
 * When both the gameplay action point (`gameActionAt`, e.g. hit frame / total frames) and the
 * clip's own action point (`clipActionAt`) are known, the mapping is piecewise linear so the
 * visible impact lands exactly on the gameplay hit; otherwise it is linear.
 */
export function resolveMeshSkinOneShotTimeMs(
  durationMs: number,
  progress: number,
  gameActionAt?: number,
  clipActionAt?: number,
): number {
  const p = progress <= 0 ? 0 : progress >= 1 ? 1 : progress
  if (
    gameActionAt !== undefined && clipActionAt !== undefined &&
    gameActionAt > 0 && gameActionAt < 1 && clipActionAt > 0 && clipActionAt < 1
  ) {
    const q = p < gameActionAt
      ? (p / gameActionAt) * clipActionAt
      : clipActionAt + ((p - gameActionAt) / (1 - gameActionAt)) * (1 - clipActionAt)
    return q * durationMs
  }
  return p * durationMs
}

/** Shortest signed step from `from` to `to` in dir64 units (result in `-32..32`). */
export function shortestDir64Delta(from: number, to: number): number {
  let d = (to - from) % 64
  if (d > 32) d -= 64
  if (d < -32) d += 64
  return d
}
