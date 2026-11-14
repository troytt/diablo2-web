/**
 * Generic Data-Driven Real-DLL Function Vector Request Compiler (`M0b`).
 *
 * Validates a `.req.json` specification, expands field/register/stack sweeps,
 * resolves symbolic arena pointers (`&img`, `&img+0x10`), computes deterministic
 * image fill bytes (`zero` or `rand:<seed>` via SplitMix32), and compiles a flat
 * binary `.fnreq` stream consumed by `fn-emitter.c` under Wine.
 *
 * Can also be invoked as a CLI:
 *   npx tsx tools/oracle/vectors/fn-request.ts <in.req.json> <out.fnreq>
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export const FN_ARENA_IMAGE_BASE_113C = 0x20000000
export const FN_ARENA_IMAGE_MAX_113C = 0x21000000
export const FN_ARENA_ALLOC_BASE_113C = 0x21000000
export const FN_ARENA_TOTAL_SIZE_113C = 0x02000000

export type FnRegName113c = 'eax' | 'ecx' | 'edx' | 'ebx' | 'esi' | 'edi'
export const FN_REG_NAMES_113C: readonly FnRegName113c[] = ['eax', 'ecx', 'edx', 'ebx', 'esi', 'edi']

export type FnHostStubKind113c = 'assert' | 'arena-alloc' | 'arena-free' | 'arena-realloc'
export type FnTablesMode113c = 'none' | 'synthetic' | 'real'

export interface FnConvSpec113c {
  readonly stack: number
  readonly regs?: readonly FnRegName113c[]
  readonly calleePops: number
  readonly returns: 'eax' | 'void'
}

export interface FnImageSpec113c {
  readonly size: number
  readonly align?: number
}

export interface FnInitOpSpec113c {
  readonly img: string
  readonly off: number | string
  readonly u8?: number | string
  readonly u16?: number | string
  readonly u32?: number | string
  readonly i8?: number
  readonly i16?: number
  readonly i32?: number
  readonly hex?: string
  readonly u32s?: readonly (number | string)[]
}

export interface FnGlobalPatchSpec113c {
  readonly va: number | string
  readonly len?: number
  readonly u8?: number | string
  readonly u16?: number | string
  readonly u32?: number | string
  readonly i32?: number
  readonly hex?: string
}

export interface FnDumpSpec113c {
  readonly va?: number | string
  readonly deref?: readonly (number | string)[]
  readonly len: number
}

export interface FnVectorSpec113c {
  readonly label: string
  readonly fill?: string
  readonly init?: readonly FnInitOpSpec113c[]
  readonly regs?: Partial<Record<FnRegName113c, number | string>>
  readonly stack?: readonly (number | string)[]
  readonly globals?: readonly FnGlobalPatchSpec113c[]
  readonly dumps?: readonly FnDumpSpec113c[]
}

export interface FnSweepFieldSpec113c {
  readonly img: string
  readonly off: number | string
  readonly type: 'u8' | 'u16' | 'u32' | 'i8' | 'i16' | 'i32'
}

export interface FnSweepSpec113c {
  readonly base: string
  readonly labelPrefix?: string
  readonly field?: FnSweepFieldSpec113c
  readonly reg?: FnRegName113c
  readonly stackIdx?: number
  readonly values: readonly (number | string)[]
}

export interface FnRequestSpec113c {
  readonly fn: string
  readonly module: 'D2Common' | 'D2Game'
  readonly va: string
  readonly size: number
  readonly conv: FnConvSpec113c
  readonly tables?: FnTablesMode113c
  readonly fill?: string
  readonly allocFill?: number
  readonly images?: Readonly<Record<string, FnImageSpec113c>>
  readonly hostStubs?: Readonly<Record<string, FnHostStubKind113c>>
  readonly globals?: readonly FnGlobalPatchSpec113c[]
  readonly dumps?: readonly FnDumpSpec113c[]
  readonly vectors: readonly FnVectorSpec113c[]
  readonly sweeps?: readonly FnSweepSpec113c[]
}

export interface CompiledFnImage113c {
  readonly name: string
  readonly addr: number
  readonly size: number
}

export interface CompiledFnGlobal113c {
  readonly va: number
  readonly bytes: Uint8Array
}

export interface CompiledFnDump113c {
  readonly len: number
  readonly chain: readonly number[]
}

export interface CompiledFnVector113c {
  readonly idx: number
  readonly label: string
  readonly regs: Record<FnRegName113c, number>
  readonly stack: readonly number[]
  readonly imageBytes: readonly Uint8Array[]
  readonly globals: readonly CompiledFnGlobal113c[]
  readonly dumps: readonly CompiledFnDump113c[]
}

export interface FnFixtureHeader113c {
  readonly kind: 'D2FNVEC'
  readonly version: 1
  readonly fn: string
  readonly module: 'D2Common' | 'D2Game'
  readonly va: string
  readonly size: number
  readonly conv: FnConvSpec113c
  readonly tables: FnTablesMode113c
  readonly count: number
  readonly requestSha256: string
  readonly dllSha256: Readonly<Record<string, string>>
}

export interface CompiledFnRequest113c {
  readonly spec: FnRequestSpec113c
  readonly fn: string
  readonly module: 'D2Common' | 'D2Game'
  readonly va: string
  readonly vaNum: number
  readonly size: number
  readonly conv: FnConvSpec113c
  readonly tables: FnTablesMode113c
  readonly allocFill: number
  readonly images: readonly CompiledFnImage113c[]
  readonly imageMap: ReadonlyMap<string, CompiledFnImage113c>
  readonly vectors: readonly CompiledFnVector113c[]
  readonly header: FnFixtureHeader113c
  readonly headerJson: string
}

const VA_HEX_RE = /^0x[0-9A-Fa-f]{8}$/
const REF_EXPR_RE = /^&([A-Za-z_][A-Za-z0-9_]*)(?:\s*([+-])\s*(0x[0-9A-Fa-f]+|\d+))?$/

function parseIntLiteral(v: number | string, ctx: string): number {
  if (typeof v === 'number') {
    if (!Number.isInteger(v)) throw new Error(`${ctx}: expected integer, got ${v}`)
    return v >>> 0
  }
  const s = v.trim()
  if (/^-?0x[0-9A-Fa-f]+$/.test(s)) {
    const neg = s.startsWith('-')
    const mag = parseInt(neg ? s.slice(1) : s, 16)
    return (neg ? -mag : mag) >>> 0
  }
  if (/^-?\d+$/.test(s)) {
    return parseInt(s, 10) >>> 0
  }
  throw new Error(`${ctx}: invalid integer literal '${v}'`)
}

export function resolveValueExpr113c(
  v: number | string,
  imageMap: ReadonlyMap<string, CompiledFnImage113c>,
  ctx: string,
): number {
  if (typeof v === 'string' && v.trim().startsWith('&')) {
    const m = REF_EXPR_RE.exec(v.trim())
    if (!m) throw new Error(`${ctx}: invalid image reference '${v}'`)
    const imgName = m[1]!
    const img = imageMap.get(imgName)
    if (!img) throw new Error(`${ctx}: unknown image '${imgName}' in '${v}'`)
    let off = 0
    if (m[2] && m[3]) {
      const delta = m[3].startsWith('0x') || m[3].startsWith('0X') ? parseInt(m[3], 16) : parseInt(m[3], 10)
      off = m[2] === '-' ? -delta : delta
    }
    return (img.addr + off) >>> 0
  }
  return parseIntLiteral(v, ctx)
}

function splitMix32(state: number): [number, number] {
  const next = (state + 0x9e3779b9) >>> 0
  let z = next
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0
  z = (z ^ (z >>> 16)) >>> 0
  return [z, next]
}

function fillImageBuffer(size: number, fillSpec: string, vecIdx: number, imgIdx: number): Uint8Array {
  const buf = new Uint8Array(size)
  if (fillSpec === 'zero' || fillSpec === '') {
    return buf
  }
  const m = /^rand:(0x[0-9A-Fa-f]+|\d+)$/.exec(fillSpec.trim())
  if (!m) {
    throw new Error(`Invalid fill policy '${fillSpec}' (expected 'zero' or 'rand:<seed>')`)
  }
  const seed = parseIntLiteral(m[1]!, 'fill')
  let state = (seed ^ Math.imul(vecIdx + 1, 0x85ebca6b) ^ Math.imul(imgIdx + 1, 0xc2b2ae35)) >>> 0
  for (let i = 0; i < size; i += 4) {
    const [word, next] = splitMix32(state)
    state = next
    buf[i] = word & 0xff
    if (i + 1 < size) buf[i + 1] = (word >>> 8) & 0xff
    if (i + 2 < size) buf[i + 2] = (word >>> 16) & 0xff
    if (i + 3 < size) buf[i + 3] = (word >>> 24) & 0xff
  }
  return buf
}

function applyInitOp(
  op: FnInitOpSpec113c,
  imageMap: ReadonlyMap<string, CompiledFnImage113c>,
  imageBufs: ReadonlyMap<string, Uint8Array>,
  ctx: string,
): void {
  const buf = imageBufs.get(op.img)
  if (!buf) throw new Error(`${ctx}: unknown image '${op.img}'`)
  const off = parseIntLiteral(op.off, `${ctx}.off`)
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

  const checkBounds = (len: number) => {
    if (off < 0 || off + len > buf.byteLength) {
      throw new Error(`${ctx}: write at ${op.img}+0x${off.toString(16)} len ${len} exceeds size ${buf.byteLength}`)
    }
  }

  let matched = 0
  if (op.u8 !== undefined) {
    matched++
    checkBounds(1)
    dv.setUint8(off, resolveValueExpr113c(op.u8, imageMap, `${ctx}.u8`) & 0xff)
  }
  if (op.i8 !== undefined) {
    matched++
    checkBounds(1)
    dv.setInt8(off, op.i8)
  }
  if (op.u16 !== undefined) {
    matched++
    checkBounds(2)
    dv.setUint16(off, resolveValueExpr113c(op.u16, imageMap, `${ctx}.u16`) & 0xffff, true)
  }
  if (op.i16 !== undefined) {
    matched++
    checkBounds(2)
    dv.setInt16(off, op.i16, true)
  }
  if (op.u32 !== undefined) {
    matched++
    checkBounds(4)
    dv.setUint32(off, resolveValueExpr113c(op.u32, imageMap, `${ctx}.u32`) >>> 0, true)
  }
  if (op.i32 !== undefined) {
    matched++
    checkBounds(4)
    dv.setInt32(off, op.i32 | 0, true)
  }
  if (op.hex !== undefined) {
    matched++
    const clean = op.hex.replace(/\s+/g, '')
    if (clean.length % 2 !== 0 || !/^[0-9A-Fa-f]*$/.test(clean)) {
      throw new Error(`${ctx}: invalid hex string '${op.hex}'`)
    }
    const raw = Buffer.from(clean, 'hex')
    checkBounds(raw.length)
    buf.set(raw, off)
  }
  if (op.u32s !== undefined) {
    matched++
    checkBounds(op.u32s.length * 4)
    for (let i = 0; i < op.u32s.length; i++) {
      dv.setUint32(off + i * 4, resolveValueExpr113c(op.u32s[i]!, imageMap, `${ctx}.u32s[${i}]`) >>> 0, true)
    }
  }
  if (matched !== 1) {
    throw new Error(`${ctx}: init op must specify exactly one of u8/i8/u16/i16/u32/i32/hex/u32s`)
  }
}

function compileGlobalPatch(
  g: FnGlobalPatchSpec113c,
  imageMap: ReadonlyMap<string, CompiledFnImage113c>,
  ctx: string,
): CompiledFnGlobal113c {
  const va = parseIntLiteral(g.va, `${ctx}.va`)
  if (g.u32 !== undefined) {
    if (g.len !== undefined && g.len !== 4) throw new Error(`${ctx}: len must be 4 for u32`)
    const b = new Uint8Array(4)
    new DataView(b.buffer).setUint32(0, resolveValueExpr113c(g.u32, imageMap, `${ctx}.u32`) >>> 0, true)
    return { va, bytes: b }
  }
  if (g.i32 !== undefined) {
    if (g.len !== undefined && g.len !== 4) throw new Error(`${ctx}: len must be 4 for i32`)
    const b = new Uint8Array(4)
    new DataView(b.buffer).setInt32(0, g.i32 | 0, true)
    return { va, bytes: b }
  }
  if (g.u16 !== undefined) {
    if (g.len !== undefined && g.len !== 2) throw new Error(`${ctx}: len must be 2 for u16`)
    const b = new Uint8Array(2)
    new DataView(b.buffer).setUint16(0, resolveValueExpr113c(g.u16, imageMap, `${ctx}.u16`) & 0xffff, true)
    return { va, bytes: b }
  }
  if (g.u8 !== undefined) {
    if (g.len !== undefined && g.len !== 1) throw new Error(`${ctx}: len must be 1 for u8`)
    const b = new Uint8Array([resolveValueExpr113c(g.u8, imageMap, `${ctx}.u8`) & 0xff])
    return { va, bytes: b }
  }
  if (g.hex !== undefined) {
    const clean = g.hex.replace(/\s+/g, '')
    if (clean.length === 0 || clean.length % 2 !== 0 || !/^[0-9A-Fa-f]+$/.test(clean)) {
      throw new Error(`${ctx}: invalid hex '${g.hex}'`)
    }
    const b = Uint8Array.from(Buffer.from(clean, 'hex'))
    if (g.len !== undefined && g.len !== b.length) {
      throw new Error(`${ctx}: len ${g.len} does not match hex byte length ${b.length}`)
    }
    return { va, bytes: b }
  }
  throw new Error(`${ctx}: global patch must specify u8/u16/u32/i32/hex`)
}

function compileDumpSpec(
  d: FnDumpSpec113c,
  imageMap: ReadonlyMap<string, CompiledFnImage113c>,
  ctx: string,
): CompiledFnDump113c {
  if (!Number.isInteger(d.len) || d.len <= 0 || d.len > 65536) {
    throw new Error(`${ctx}: dump len must be in 1..65536`)
  }
  if (d.va !== undefined) {
    return { len: d.len, chain: [resolveValueExpr113c(d.va, imageMap, `${ctx}.va`)] }
  }
  if (d.deref !== undefined && d.deref.length >= 1 && d.deref.length <= 8) {
    const chain: number[] = [resolveValueExpr113c(d.deref[0]!, imageMap, `${ctx}.deref[0]`)]
    for (let i = 1; i < d.deref.length; i++) {
      chain.push(parseIntLiteral(d.deref[i]!, `${ctx}.deref[${i}]`) | 0)
    }
    return { len: d.len, chain }
  }
  throw new Error(`${ctx}: dump must specify va or deref (1..8 elements)`)
}

function expandVectors(spec: FnRequestSpec113c): FnVectorSpec113c[] {
  if (!Array.isArray(spec.vectors) || spec.vectors.length === 0) {
    throw new Error(`Request ${spec.fn}: vectors must be a non-empty array`)
  }
  const byLabel = new Map<string, FnVectorSpec113c>()
  const out: FnVectorSpec113c[] = []
  for (const v of spec.vectors) {
    if (!v.label || typeof v.label !== 'string') {
      throw new Error(`Request ${spec.fn}: every vector must have a non-empty string label`)
    }
    if (byLabel.has(v.label)) {
      throw new Error(`Request ${spec.fn}: duplicate vector label '${v.label}'`)
    }
    byLabel.set(v.label, v)
    out.push(v)
  }

  for (const [sIdx, sw] of (spec.sweeps ?? []).entries()) {
    const base = byLabel.get(sw.base)
    if (!base) {
      throw new Error(`Request ${spec.fn}: sweep[${sIdx}] references unknown base vector '${sw.base}'`)
    }
    if (!Array.isArray(sw.values) || sw.values.length === 0) {
      throw new Error(`Request ${spec.fn}: sweep[${sIdx}] must have non-empty values`)
    }
    const prefix = sw.labelPrefix ?? sw.base
    for (const val of sw.values) {
      let label: string
      let nextInit = [...(base.init ?? [])]
      let nextRegs = { ...(base.regs ?? {}) }
      let nextStack = [...(base.stack ?? [])]

      if (sw.field) {
        label = `${prefix}[${sw.field.img}+${sw.field.off}=${val}]`
        const op: Record<string, unknown> = { img: sw.field.img, off: sw.field.off }
        if (sw.field.type === 'i8' || sw.field.type === 'i16' || sw.field.type === 'i32') {
          op[sw.field.type] = Number(val)
        } else {
          op[sw.field.type] = val
        }
        nextInit.push(op as unknown as FnInitOpSpec113c)
      } else if (sw.reg) {
        label = `${prefix}[${sw.reg}=${val}]`
        nextRegs[sw.reg] = val
      } else if (sw.stackIdx !== undefined) {
        label = `${prefix}[arg${sw.stackIdx}=${val}]`
        while (nextStack.length <= sw.stackIdx) nextStack.push(0)
        nextStack[sw.stackIdx] = val
      } else {
        throw new Error(`Request ${spec.fn}: sweep[${sIdx}] must specify field, reg, or stackIdx`)
      }

      if (byLabel.has(label)) {
        throw new Error(`Request ${spec.fn}: sweep generated duplicate label '${label}'`)
      }
      const expanded: FnVectorSpec113c = {
        label,
        ...(base.fill !== undefined ? { fill: base.fill } : {}),
        init: nextInit,
        regs: nextRegs,
        stack: nextStack,
        ...(base.globals !== undefined ? { globals: base.globals } : {}),
        ...(base.dumps !== undefined ? { dumps: base.dumps } : {}),
      }
      byLabel.set(label, expanded)
      out.push(expanded)
    }
  }
  return out
}

export function resolveD2DataDir113c(): string {
  if (process.env.D2_DATA_DIR && existsSync(process.env.D2_DATA_DIR)) {
    return process.env.D2_DATA_DIR
  }
  const homeData = join(homedir(), 'd2-data')
  if (existsSync(homeData)) return homeData
  const repoSample = resolve(process.cwd(), 'samples', 'd2')
  if (existsSync(repoSample)) return repoSample
  return homeData
}

let cachedDllSha256: Readonly<Record<string, string>> | null = null

export function computeDllSha256Map113c(): Readonly<Record<string, string>> {
  if (cachedDllSha256) return cachedDllSha256
  const dir = resolveD2DataDir113c()
  const dlls = ['D2Common.dll', 'D2Game.dll', 'Fog.dll', 'Storm.dll']
  const out: Record<string, string> = {}
  for (const name of dlls) {
    const p = join(dir, name)
    if (!existsSync(p)) {
      throw new Error(`Missing required 1.13c DLL at ${p}`)
    }
    out[name] = createHash('sha256').update(readFileSync(p)).digest('hex')
  }
  cachedDllSha256 = out
  return out
}

export function compileFnRequestFromText113c(rawJson: string): CompiledFnRequest113c {
  const requestSha256 = createHash('sha256').update(rawJson, 'utf8').digest('hex')
  const spec = JSON.parse(rawJson) as FnRequestSpec113c

  if (!spec.fn || typeof spec.fn !== 'string') {
    throw new Error('Request missing valid fn name')
  }
  if (spec.module !== 'D2Common' && spec.module !== 'D2Game') {
    throw new Error(`Request ${spec.fn}: module must be D2Common or D2Game`)
  }
  if (typeof spec.va !== 'string' || !VA_HEX_RE.test(spec.va)) {
    throw new Error(`Request ${spec.fn}: va must be '0x' + 8 hex digits, got '${spec.va}'`)
  }
  const vaNum = parseInt(spec.va, 16) >>> 0
  if (!Number.isInteger(spec.size) || spec.size <= 0) {
    throw new Error(`Request ${spec.fn}: size must be a positive integer`)
  }
  if (!spec.conv || !Number.isInteger(spec.conv.stack) || spec.conv.stack < 0 || spec.conv.stack > 16) {
    throw new Error(`Request ${spec.fn}: conv.stack must be in 0..16`)
  }
  if (!Number.isInteger(spec.conv.calleePops) || spec.conv.calleePops < 0 || spec.conv.calleePops % 4 !== 0) {
    throw new Error(`Request ${spec.fn}: conv.calleePops must be a non-negative multiple of 4`)
  }
  if (spec.conv.returns !== 'eax' && spec.conv.returns !== 'void') {
    throw new Error(`Request ${spec.fn}: conv.returns must be 'eax' or 'void'`)
  }
  for (const r of spec.conv.regs ?? []) {
    if (!FN_REG_NAMES_113C.includes(r)) {
      throw new Error(`Request ${spec.fn}: unknown register '${r}' in conv.regs`)
    }
  }

  const tables: FnTablesMode113c = spec.tables ?? 'none'
  if (tables !== 'none' && tables !== 'synthetic' && tables !== 'real') {
    throw new Error(`Request ${spec.fn}: invalid tables mode '${tables}'`)
  }

  const images: CompiledFnImage113c[] = []
  const imageMap = new Map<string, CompiledFnImage113c>()
  let cursor = FN_ARENA_IMAGE_BASE_113C
  for (const [name, imgSpec] of Object.entries(spec.images ?? {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`Request ${spec.fn}: invalid image name '${name}'`)
    }
    if (!Number.isInteger(imgSpec.size) || imgSpec.size <= 0 || imgSpec.size > 0x100000) {
      throw new Error(`Request ${spec.fn}: image '${name}' size must be in 1..1048576`)
    }
    const align = imgSpec.align ?? 16
    if (align <= 0 || (align & (align - 1)) !== 0) {
      throw new Error(`Request ${spec.fn}: image '${name}' align must be a power of 2`)
    }
    cursor = ((cursor + align - 1) & ~(align - 1)) >>> 0
    if (cursor + imgSpec.size + 64 > FN_ARENA_IMAGE_MAX_113C) {
      throw new Error(`Request ${spec.fn}: arena image space exhausted at '${name}'`)
    }
    const compiledImg: CompiledFnImage113c = { name, addr: cursor, size: imgSpec.size }
    images.push(compiledImg)
    imageMap.set(name, compiledImg)
    // Leave a 64-byte unmapped guard gap between consecutive images so out-of-bounds reads/writes never alias.
    cursor = (cursor + imgSpec.size + 64) >>> 0
  }

  const defaultFill = spec.fill ?? 'zero'
  const expandedSpecs = expandVectors(spec)
  const topGlobals = (spec.globals ?? []).map((g, i) => compileGlobalPatch(g, imageMap, `globals[${i}]`))
  const topDumps = (spec.dumps ?? []).map((d, i) => compileDumpSpec(d, imageMap, `dumps[${i}]`))

  const vectors: CompiledFnVector113c[] = expandedSpecs.map((v, vIdx) => {
    const vCtx = `vectors[${vIdx}](${v.label})`
    const fillPolicy = v.fill ?? defaultFill
    const imgBufMap = new Map<string, Uint8Array>()
    const imgBufs: Uint8Array[] = images.map((img, imgIdx) => {
      const b = fillImageBuffer(img.size, fillPolicy, vIdx, imgIdx)
      imgBufMap.set(img.name, b)
      return b
    })

    for (const [opIdx, op] of (v.init ?? []).entries()) {
      applyInitOp(op, imageMap, imgBufMap, `${vCtx}.init[${opIdx}]`)
    }

    const regs: Record<FnRegName113c, number> = { eax: 0, ecx: 0, edx: 0, ebx: 0, esi: 0, edi: 0 }
    for (const r of FN_REG_NAMES_113C) {
      const rv = v.regs?.[r]
      if (rv !== undefined) {
        regs[r] = resolveValueExpr113c(rv, imageMap, `${vCtx}.regs.${r}`)
      }
    }

    const rawStack = v.stack ?? []
    if (rawStack.length !== spec.conv.stack) {
      throw new Error(`${vCtx}: stack has ${rawStack.length} args, expected conv.stack=${spec.conv.stack}`)
    }
    const stack = rawStack.map((sv, sIdx) => resolveValueExpr113c(sv, imageMap, `${vCtx}.stack[${sIdx}]`))

    // Merge top-level globals with per-vector overrides by VA
    const globalByVa = new Map<number, CompiledFnGlobal113c>()
    for (const g of topGlobals) globalByVa.set(g.va, g)
    for (const [gIdx, gSpec] of (v.globals ?? []).entries()) {
      const cg = compileGlobalPatch(gSpec, imageMap, `${vCtx}.globals[${gIdx}]`)
      globalByVa.set(cg.va, cg)
    }

    const vecDumps = [
      ...topDumps,
      ...(v.dumps ?? []).map((d, dIdx) => compileDumpSpec(d, imageMap, `${vCtx}.dumps[${dIdx}]`)),
    ]

    return {
      idx: vIdx,
      label: v.label,
      regs,
      stack,
      imageBytes: imgBufs,
      globals: [...globalByVa.values()],
      dumps: vecDumps,
    }
  })

  const header: FnFixtureHeader113c = {
    kind: 'D2FNVEC',
    version: 1,
    fn: spec.fn,
    module: spec.module,
    va: `0x${vaNum.toString(16).toUpperCase().padStart(8, '0')}`,
    size: spec.size,
    conv: {
      stack: spec.conv.stack,
      regs: [...(spec.conv.regs ?? [])],
      calleePops: spec.conv.calleePops,
      returns: spec.conv.returns,
    },
    tables,
    count: vectors.length,
    requestSha256,
    dllSha256: computeDllSha256Map113c(),
  }

  return {
    spec,
    fn: spec.fn,
    module: spec.module,
    va: header.va,
    vaNum,
    size: spec.size,
    conv: header.conv,
    tables,
    allocFill: (spec.allocFill ?? 0) & 0xff,
    images,
    imageMap,
    vectors,
    header,
    headerJson: JSON.stringify(header),
  }
}

export function compileFnRequest113c(requestPath: string): CompiledFnRequest113c {
  return compileFnRequestFromText113c(readFileSync(requestPath, 'utf8'))
}

function parseHostStubEntry(key: string, kind: FnHostStubKind113c): { dllId: number; ordinal: number; stubKind: number } {
  const m = /^(fog\.dll|storm\.dll|d2lang\.dll):(\d+)$/i.exec(key.trim())
  if (!m) {
    throw new Error(`Invalid hostStubs key '${key}' (expected '<dll>:<ordinal>', e.g. 'fog.dll:10024')`)
  }
  const dllName = m[1]!.toLowerCase()
  const dllId = dllName === 'fog.dll' ? 0 : dllName === 'storm.dll' ? 1 : 2
  const ordinal = parseInt(m[2]!, 10)
  const stubKind =
    kind === 'assert' ? 1 : kind === 'arena-alloc' ? 2 : kind === 'arena-free' ? 3 : kind === 'arena-realloc' ? 4 : 0
  if (stubKind === 0) {
    throw new Error(`Invalid hostStubs kind '${kind}' for '${key}'`)
  }
  return { dllId, ordinal, stubKind }
}

/**
 * Serializes a `CompiledFnRequest113c` into a flat binary `.fnreq` buffer for `fn-emitter.c`.
 */
export function encodeFnRequestBinary113c(compiled: CompiledFnRequest113c): Buffer {
  const chunks: Buffer[] = []
  const pushU32 = (v: number) => {
    const b = Buffer.allocUnsafe(4)
    b.writeUInt32LE(v >>> 0, 0)
    chunks.push(b)
  }
  const pushI32 = (v: number) => {
    const b = Buffer.allocUnsafe(4)
    b.writeInt32LE(v | 0, 0)
    chunks.push(b)
  }
  const pushBytes = (b: Uint8Array) => {
    chunks.push(Buffer.from(b.buffer, b.byteOffset, b.byteLength))
  }
  const pushStr = (s: string) => {
    const b = Buffer.from(s, 'utf8')
    pushU32(b.length)
    chunks.push(b)
  }

  chunks.push(Buffer.from('D2FR', 'ascii'))
  pushU32(1) // version
  pushU32(compiled.module === 'D2Game' ? 0 : 1)
  pushU32(compiled.vaNum)
  pushU32(compiled.size)
  pushU32(compiled.tables === 'none' ? 0 : compiled.tables === 'synthetic' ? 1 : 2)
  pushI32(compiled.conv.calleePops)
  pushU32(compiled.conv.returns === 'eax' ? 1 : 0)
  pushU32(compiled.allocFill)

  const stubs = Object.entries(compiled.spec.hostStubs ?? {}).map(([k, v]) => parseHostStubEntry(k, v))
  pushU32(stubs.length)
  for (const s of stubs) {
    pushU32(s.dllId)
    pushU32(s.ordinal)
    pushU32(s.stubKind)
  }

  pushU32(compiled.images.length)
  for (const img of compiled.images) {
    pushU32(img.addr)
    pushU32(img.size)
  }

  pushStr(compiled.headerJson)
  pushStr(compiled.fn)

  pushU32(compiled.vectors.length)
  for (const vec of compiled.vectors) {
    pushStr(vec.label)
    for (const r of FN_REG_NAMES_113C) {
      pushU32(vec.regs[r])
    }
    pushU32(vec.stack.length)
    for (const arg of vec.stack) {
      pushU32(arg)
    }
    for (const imgBytes of vec.imageBytes) {
      pushBytes(imgBytes)
    }
    pushU32(vec.globals.length)
    for (const g of vec.globals) {
      pushU32(g.va)
      pushU32(g.bytes.length)
      pushBytes(g.bytes)
    }
    pushU32(vec.dumps.length)
    for (const d of vec.dumps) {
      pushU32(d.len)
      pushU32(d.chain.length)
      for (const link of d.chain) {
        pushI32(link | 0)
      }
    }
  }

  return Buffer.concat(chunks)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , inPath, outPath] = process.argv
  if (!inPath || !outPath) {
    console.error('Usage: npx tsx tools/oracle/vectors/fn-request.ts <in.req.json> <out.fnreq>')
    process.exit(2)
  }
  const compiled = compileFnRequest113c(inPath)
  const bin = encodeFnRequestBinary113c(compiled)
  writeFileSync(outPath, bin)
}
