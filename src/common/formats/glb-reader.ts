/**
 * Minimal glTF 2.0 binary (`.glb`) container reader (`src/common/formats/glb-reader.ts`).
 *
 * Pure module: no DOM globals, no `node:*` imports. Only what the mesh skin runtime needs is
 * implemented (one embedded BIN chunk, non-sparse accessors); anything else is rejected instead
 * of being half-read.
 */

const GLB_MAGIC = 0x46546c67 // 'glTF'
const CHUNK_JSON = 0x4e4f534a // 'JSON'
const CHUNK_BIN = 0x004e4942 // 'BIN\0'

const COMPONENT_COUNT: Readonly<Record<string, number>> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16,
}

export interface GlbAccessorJson {
  readonly bufferView?: number
  readonly byteOffset?: number
  readonly componentType: number
  readonly count: number
  readonly type: string
  readonly sparse?: unknown
}

export interface GlbBufferViewJson {
  readonly buffer: number
  readonly byteOffset?: number
  readonly byteLength: number
  readonly byteStride?: number
}

export interface GlbJson {
  readonly asset?: { readonly version?: string }
  readonly accessors?: readonly GlbAccessorJson[]
  readonly bufferViews?: readonly GlbBufferViewJson[]
  readonly [key: string]: unknown
}

export interface GlbContainer {
  readonly json: GlbJson
  readonly bin: Uint8Array
}

export function parseGlbContainer(bytes: Uint8Array): GlbContainer {
  if (bytes.byteLength < 20) throw new Error('Invalid GLB: file is shorter than its header')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('Invalid GLB: bad magic')
  const version = view.getUint32(4, true)
  if (version !== 2) throw new Error(`Unsupported GLB container version ${String(version)} (expected 2)`)
  const total = view.getUint32(8, true)
  if (total > bytes.byteLength) throw new Error('Invalid GLB: declared length exceeds file size')

  let json: GlbJson | null = null
  let bin: Uint8Array | null = null
  let off = 12
  while (off + 8 <= total) {
    const len = view.getUint32(off, true)
    const type = view.getUint32(off + 4, true)
    const start = off + 8
    if (start + len > total) throw new Error('Invalid GLB: chunk overruns file')
    if (type === CHUNK_JSON && json === null) {
      const text = new TextDecoder('utf-8').decode(bytes.subarray(start, start + len))
      json = JSON.parse(text) as GlbJson
    } else if (type === CHUNK_BIN && bin === null) {
      bin = bytes.subarray(start, start + len)
    }
    off = start + len
  }
  if (json === null) throw new Error('Invalid GLB: missing JSON chunk')
  if (json.asset?.version !== '2.0') {
    throw new Error(`Unsupported glTF asset version "${String(json.asset?.version)}" (expected "2.0")`)
  }
  return { json, bin: bin ?? new Uint8Array(0) }
}

function accessorRange(
  glb: GlbContainer,
  index: number,
  bytesPerComponent: number,
): { readonly offset: number; readonly count: number; readonly components: number } {
  const acc = glb.json.accessors?.[index]
  if (!acc) throw new Error(`Invalid GLB: accessor ${String(index)} does not exist`)
  if (acc.sparse !== undefined) throw new Error('Unsupported GLB: sparse accessors')
  const components = COMPONENT_COUNT[acc.type]
  if (components === undefined) throw new Error(`Unsupported GLB accessor type "${acc.type}"`)
  if (acc.bufferView === undefined) throw new Error(`Invalid GLB: accessor ${String(index)} has no bufferView`)
  const bv = glb.json.bufferViews?.[acc.bufferView]
  if (!bv) throw new Error(`Invalid GLB: bufferView ${String(acc.bufferView)} does not exist`)
  if (bv.byteStride !== undefined && bv.byteStride !== components * bytesPerComponent) {
    throw new Error('Unsupported GLB: interleaved buffer views')
  }
  const offset = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const length = acc.count * components * bytesPerComponent
  if (!Number.isInteger(acc.count) || acc.count < 0 || offset < 0 || offset + length > glb.bin.byteLength) {
    throw new Error(`Invalid GLB: accessor ${String(index)} is out of bounds`)
  }
  return { offset, count: acc.count, components }
}

/** Copy a float accessor out of the BIN chunk (the copy also removes any alignment constraint). */
export function readGlbFloatAccessor(glb: GlbContainer, index: number, expectedType?: string): Float32Array {
  const acc = glb.json.accessors?.[index]
  if (acc && acc.componentType !== 5126) {
    throw new Error(`Invalid GLB: accessor ${String(index)} is not FLOAT`)
  }
  if (acc && expectedType !== undefined && acc.type !== expectedType) {
    throw new Error(`Invalid GLB: accessor ${String(index)} is ${acc.type}, expected ${expectedType}`)
  }
  const r = accessorRange(glb, index, 4)
  const bytes = glb.bin.slice(r.offset, r.offset + r.count * r.components * 4)
  return new Float32Array(bytes.buffer, bytes.byteOffset, r.count * r.components)
}

/** Copy an unsigned 8/16-bit integer accessor out of the BIN chunk as `Uint16Array`. */
export function readGlbUintAccessor(glb: GlbContainer, index: number, expectedType?: string): Uint16Array {
  const acc = glb.json.accessors?.[index]
  if (!acc) throw new Error(`Invalid GLB: accessor ${String(index)} does not exist`)
  if (expectedType !== undefined && acc.type !== expectedType) {
    throw new Error(`Invalid GLB: accessor ${String(index)} is ${acc.type}, expected ${expectedType}`)
  }
  if (acc.componentType === 5123) {
    const r = accessorRange(glb, index, 2)
    const bytes = glb.bin.slice(r.offset, r.offset + r.count * r.components * 2)
    return new Uint16Array(bytes.buffer, bytes.byteOffset, r.count * r.components)
  }
  if (acc.componentType === 5121) {
    const r = accessorRange(glb, index, 1)
    const out = new Uint16Array(r.count * r.components)
    for (let i = 0; i < out.length; i += 1) out[i] = glb.bin[r.offset + i]!
    return out
  }
  throw new Error(`Unsupported GLB integer component type ${String(acc.componentType)}`)
}

/** Bytes of a buffer view (used for embedded images). */
export function readGlbBufferView(glb: GlbContainer, index: number): Uint8Array {
  const bv = glb.json.bufferViews?.[index]
  if (!bv) throw new Error(`Invalid GLB: bufferView ${String(index)} does not exist`)
  const offset = bv.byteOffset ?? 0
  if (offset < 0 || offset + bv.byteLength > glb.bin.byteLength) {
    throw new Error(`Invalid GLB: bufferView ${String(index)} is out of bounds`)
  }
  return glb.bin.slice(offset, offset + bv.byteLength)
}
