/**
 * Platform fakes for the browser Web Audio API (M21 E2E, P2+).
 *
 * These stand in for the BROWSER, never for product code: the product's own modules
 * (`SfxChunkLoader`, `WebAudioSoundVoices`, `AudioRuntime113c`) run unmodified on top of them.
 * Behaviour mirrors the Web Audio spec where the product can observe it:
 * - `decodeAudioData(buf)` detaches (transfers) its input ArrayBuffer synchronously — exactly what
 *   makes PROJECT.md D5's per-chunk `ArrayBuffer.prototype.slice` necessary — and rejects input that
 *   is not one complete Ogg Opus stream (checked with the harness's independent RFC 3533/7845
 *   reader). Decoded buffers come back at the CONTEXT rate (48 kHz), not the 22,050 Hz source rate
 *   (the reason for the F9 offset fix).
 * - `AudioBufferSourceNode.start()` may be called once; `stop()` before `start()` throws.
 * - Nodes keep an explicit connection graph so tests can check reachability (voice → sfx → master).
 * Test-only metadata (e.g. `sourceSha256`) lets a test map a decoded buffer back to its pack chunk;
 * the product never sees or relies on it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPO_ROOT, sha256Hex, oggOpusFacts } from './harness-113c.ts'

/** Browser `fetch` stand-in for the client's `fetchPack(packId, url)`: serves the baked files from `public/`. */
export class FakePackServer {
  readonly calls: { readonly packId: string; readonly url: string }[] = []
  /** packId → number of upcoming fetches that fail with a network error. */
  readonly failures = new Map<string, number>()
  /** packId → byte mutation applied to the served copy. */
  readonly corrupt = new Map<string, (b: Uint8Array) => Uint8Array>()
  /** When set, every fetch waits for this promise (to observe in-flight behaviour). */
  hold: Promise<void> | null = null
  constructor(private readonly metas: readonly { readonly packId: string; readonly url: string }[]) {}
  readonly fetchPack = async (packId: string, url: string): Promise<ArrayBuffer> => {
    this.calls.push({ packId, url })
    if (this.hold !== null) await this.hold
    const left = this.failures.get(packId) ?? 0
    if (left > 0) {
      this.failures.set(packId, left - 1)
      throw new Error(`net::ERR_FAILED ${url}`)
    }
    const meta = this.metas.find((m) => m.packId === packId)
    if (meta === undefined) throw new Error(`404 ${url}`)
    const file: Uint8Array = new Uint8Array(readFileSync(join(REPO_ROOT, 'public', meta.url.replace(/^\/+/, ''))))
    const c = this.corrupt.get(packId)
    const served = new Uint8Array(c !== undefined ? c(file) : file) // fresh ArrayBuffer, like a network body
    return served.buffer
  }
  fetchesOf(packId: string): number {
    return this.calls.filter((c) => c.packId === packId).length
  }
}

export class FakeAudioParam {
  value: number
  readonly history: { readonly op: string; readonly value: number; readonly time: number }[] = []
  constructor(initial: number) {
    this.value = initial
  }
  setValueAtTime(value: number, time: number): this {
    this.history.push({ op: 'setValueAtTime', value, time })
    this.value = value
    return this
  }
  linearRampToValueAtTime(value: number, time: number): this {
    this.history.push({ op: 'linearRampToValueAtTime', value, time })
    this.value = value
    return this
  }
  exponentialRampToValueAtTime(value: number, time: number): this {
    this.history.push({ op: 'exponentialRampToValueAtTime', value, time })
    this.value = value
    return this
  }
  setTargetAtTime(value: number, time: number, _timeConstant: number): this {
    this.history.push({ op: 'setTargetAtTime', value, time })
    this.value = value
    return this
  }
  cancelScheduledValues(_time: number): this {
    return this
  }
  cancelAndHoldAtTime(_time: number): this {
    return this
  }
}

export interface FakeEdge {
  readonly node: FakeAudioNode
  readonly output: number
  readonly input: number
}

export class FakeAudioNode {
  readonly outputs: FakeEdge[] = []
  disconnectCalls = 0
  constructor(
    readonly context: FakeAudioContext,
    readonly kind: string,
    readonly numberOfInputs = 1,
    readonly numberOfOutputs = 1,
  ) {
    context.nodes.push(this)
  }
  connect<T extends FakeAudioNode>(dest: T, output = 0, input = 0): T {
    if (!(dest instanceof FakeAudioNode)) throw new TypeError(`${this.kind}.connect: destination is not an AudioNode`)
    if (dest.context !== this.context) throw new Error('InvalidAccessError: nodes belong to different AudioContexts')
    if (output < 0 || output >= this.numberOfOutputs) throw new Error(`IndexSizeError: ${this.kind} has no output ${String(output)}`)
    if (input < 0 || input >= dest.numberOfInputs) throw new Error(`IndexSizeError: ${dest.kind} has no input ${String(input)}`)
    this.outputs.push({ node: dest, output, input })
    return dest
  }
  disconnect(dest?: FakeAudioNode): void {
    this.disconnectCalls += 1
    if (dest === undefined) this.outputs.length = 0
    else for (let i = this.outputs.length - 1; i >= 0; i -= 1) if (this.outputs[i]!.node === dest) this.outputs.splice(i, 1)
  }
}

export class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam(1)
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'GainNode')
  }
}

export class FakeStereoPannerNode extends FakeAudioNode {
  readonly pan = new FakeAudioParam(0)
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'StereoPannerNode')
  }
}

export class FakeChannelMergerNode extends FakeAudioNode {
  constructor(ctx: FakeAudioContext, inputs: number) {
    super(ctx, 'ChannelMergerNode', inputs, 1)
  }
}

export class FakeChannelSplitterNode extends FakeAudioNode {
  constructor(ctx: FakeAudioContext, outputs: number) {
    super(ctx, 'ChannelSplitterNode', 1, outputs)
  }
}

export class FakeAudioDestinationNode extends FakeAudioNode {
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'AudioDestinationNode', 1, 0)
  }
}

export class FakeAudioBuffer {
  readonly duration: number
  private data: Float32Array[] | null = null
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
    /** Test-only: SHA-256 of the encoded chunk this buffer was decoded from. */
    readonly sourceSha256: string | null = null,
  ) {
    this.duration = length / sampleRate
  }
  getChannelData(channel: number): Float32Array {
    if (channel < 0 || channel >= this.numberOfChannels) throw new Error(`IndexSizeError: channel ${String(channel)}`)
    if (this.data === null) this.data = Array.from({ length: this.numberOfChannels }, () => new Float32Array(this.length))
    return this.data[channel]!
  }
}

export class FakeAudioBufferSourceNode extends FakeAudioNode {
  buffer: FakeAudioBuffer | null = null
  loop = false
  loopStart = 0
  loopEnd = 0
  readonly playbackRate = new FakeAudioParam(1)
  readonly detune = new FakeAudioParam(0)
  onended: ((ev?: unknown) => void) | null = null
  started: { readonly when: number; readonly offset: number; readonly duration: number | undefined } | null = null
  stopped: { readonly when: number } | null = null
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'AudioBufferSourceNode', 0, 1)
  }
  start(when = 0, offset = 0, duration?: number): void {
    if (this.started !== null) throw new Error('InvalidStateError: AudioBufferSourceNode.start called twice')
    if (!(offset >= 0) || !(when >= 0)) throw new RangeError(`start(${String(when)}, ${String(offset)}): negative/NaN argument`)
    this.started = { when, offset, duration }
  }
  stop(when = 0): void {
    if (this.started === null) throw new Error('InvalidStateError: stop() before start()')
    this.stopped = { when }
  }
  addEventListener(type: string, cb: (ev?: unknown) => void): void {
    if (type === 'ended') this.onended = cb
  }
  removeEventListener(): void {
    /* no-op */
  }
}

export class FakeMediaElementAudioSourceNode extends FakeAudioNode {
  constructor(
    ctx: FakeAudioContext,
    readonly mediaElement: FakeHTMLAudioElement,
  ) {
    super(ctx, 'MediaElementAudioSourceNode', 0, 1)
  }
}

export class FakeHTMLAudioElement {
  static readonly instances: FakeHTMLAudioElement[] = []
  private _src = ''
  private _currentTime = 0
  volume = 1
  loop = false
  paused = true
  muted = false
  preload = 'auto'
  crossOrigin: string | null = null
  readyState = 4
  duration = 180
  playCalls = 0
  pauseCalls = 0
  loadCalls = 0
  readonly srcHistory: string[] = []
  readonly seekHistory: number[] = []
  onended: ((ev?: unknown) => void) | null = null
  ontimeupdate: ((ev?: unknown) => void) | null = null
  onloadedmetadata: ((ev?: unknown) => void) | null = null
  oncanplay: ((ev?: unknown) => void) | null = null
  onerror: ((ev?: unknown) => void) | null = null
  private readonly listeners = new Map<string, Set<(ev?: unknown) => void>>()

  constructor(src?: string) {
    if (typeof src === 'string' && src.length > 0) {
      this._src = src
      this.srcHistory.push(src)
    }
    FakeHTMLAudioElement.instances.push(this)
  }

  get src(): string {
    return this._src
  }
  set src(next: string) {
    this._src = next
    if (next.length > 0) this.srcHistory.push(next)
  }

  get currentTime(): number {
    return this._currentTime
  }
  set currentTime(sec: number) {
    if (!Number.isFinite(sec) || sec < 0) throw new RangeError(`HTMLAudioElement.currentTime: invalid value ${String(sec)}`)
    this._currentTime = sec
    this.seekHistory.push(sec)
  }

  play(): Promise<void> {
    this.playCalls += 1
    this.paused = false
    return Promise.resolve()
  }

  pause(): void {
    this.pauseCalls += 1
    this.paused = true
  }

  load(): void {
    this.loadCalls += 1
  }

  addEventListener(type: string, cb: (ev?: unknown) => void): void {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(cb)
  }

  removeEventListener(type: string, cb: (ev?: unknown) => void): void {
    this.listeners.get(type)?.delete(cb)
  }

  dispatchEvent(ev: { type: string }): boolean {
    const set = this.listeners.get(ev.type)
    if (set) for (const cb of [...set]) cb(ev)
    if (ev.type === 'ended') this.onended?.(ev)
    else if (ev.type === 'timeupdate') this.ontimeupdate?.(ev)
    else if (ev.type === 'loadedmetadata') this.onloadedmetadata?.(ev)
    else if (ev.type === 'canplay') this.oncanplay?.(ev)
    else if (ev.type === 'error') this.onerror?.(ev)
    return true
  }

  triggerTimeUpdate(sec: number): void {
    this._currentTime = sec
    this.dispatchEvent({ type: 'timeupdate' })
  }

  triggerEnded(): void {
    this.paused = true
    this.dispatchEvent({ type: 'ended' })
  }
}

export interface DecodeRecord {
  readonly byteLength: number
  readonly sha256: string
  readonly ok: boolean
}

export class FakeAudioContext {
  /** Every context constructed while this fake is installed (newest last). */
  static readonly instances: FakeAudioContext[] = []
  /** Optional failure injection for `decodeAudioData` (platform EncodingError), by input SHA-256. */
  static failDecodeSha: Set<string> = new Set()

  readonly sampleRate = 48_000
  currentTime = 0
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  resumeCalls = 0
  readonly nodes: FakeAudioNode[] = []
  readonly decodes: DecodeRecord[] = []
  readonly destination: FakeAudioDestinationNode
  private readonly boundElements = new WeakSet<FakeHTMLAudioElement>()
  constructor(_opts?: unknown) {
    this.destination = new FakeAudioDestinationNode(this)
    FakeAudioContext.instances.push(this)
  }
  createGain(): FakeGainNode {
    return new FakeGainNode(this)
  }
  createBufferSource(): FakeAudioBufferSourceNode {
    return new FakeAudioBufferSourceNode(this)
  }
  createMediaElementSource(el: FakeHTMLAudioElement): FakeMediaElementAudioSourceNode {
    if (!(el instanceof FakeHTMLAudioElement)) {
      throw new TypeError('createMediaElementSource: argument is not an HTMLAudioElement')
    }
    if (this.boundElements.has(el)) {
      throw new Error('InvalidStateError: HTMLMediaElement already connected to a MediaElementSourceNode')
    }
    this.boundElements.add(el)
    return new FakeMediaElementAudioSourceNode(this, el)
  }
  createChannelMerger(n = 6): FakeChannelMergerNode {
    return new FakeChannelMergerNode(this, n)
  }
  createChannelSplitter(n = 6): FakeChannelSplitterNode {
    return new FakeChannelSplitterNode(this, n)
  }
  createStereoPanner(): FakeStereoPannerNode {
    return new FakeStereoPannerNode(this)
  }
  createBuffer(channels: number, length: number, rate: number): FakeAudioBuffer {
    return new FakeAudioBuffer(channels, length, rate)
  }
  createDynamicsCompressor(): FakeAudioNode {
    const n = new FakeAudioNode(this, 'DynamicsCompressorNode') as FakeAudioNode & Record<string, FakeAudioParam>
    for (const p of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[p] = new FakeAudioParam(0)
    return n
  }
  createBiquadFilter(): FakeAudioNode {
    const n = new FakeAudioNode(this, 'BiquadFilterNode') as FakeAudioNode & Record<string, unknown>
    for (const p of ['frequency', 'Q', 'gain', 'detune']) n[p] = new FakeAudioParam(0)
    n.type = 'lowpass'
    return n
  }
  onstatechange: ((ev?: unknown) => void) | null = null
  addEventListener(_type: string, _cb: (ev?: unknown) => void): void {
    /* statechange listeners are accepted; the fake changes state only via resume/suspend/close */
  }
  removeEventListener(): void {
    /* no-op */
  }
  resume(): Promise<void> {
    this.resumeCalls += 1
    if (this.state !== 'closed') this.state = 'running'
    return Promise.resolve()
  }
  suspend(): Promise<void> {
    if (this.state !== 'closed') this.state = 'suspended'
    return Promise.resolve()
  }
  close(): Promise<void> {
    this.state = 'closed'
    return Promise.resolve()
  }
  /**
   * Web Audio `decodeAudioData`: the input buffer is DETACHED synchronously (transferred to the
   * decoder), then decoding completes asynchronously. Accepts only a whole Ogg Opus stream.
   */
  decodeAudioData(input: ArrayBuffer, ok?: (b: FakeAudioBuffer) => void, err?: (e: Error) => void): Promise<FakeAudioBuffer> {
    if (!(input instanceof ArrayBuffer)) {
      const e = new TypeError('decodeAudioData: argument is not an ArrayBuffer')
      err?.(e)
      return Promise.reject(e)
    }
    if (input.byteLength === 0) {
      const e = new TypeError('decodeAudioData: ArrayBuffer is detached or empty')
      err?.(e)
      return Promise.reject(e)
    }
    const bytes = new Uint8Array(input.slice(0))
    structuredClone(input, { transfer: [input] }) // detach, as browsers do
    const sha = sha256Hex(bytes)
    return new Promise<FakeAudioBuffer>((resolve, reject) => {
      queueMicrotask(() => {
        try {
          if (FakeAudioContext.failDecodeSha.has(sha)) throw new Error('injected platform decode failure')
          const f = oggOpusFacts(bytes, 'decodeAudioData input')
          const ab = new FakeAudioBuffer(f.channels, Math.round(f.decodedSeconds * this.sampleRate), this.sampleRate, sha)
          this.decodes.push({ byteLength: bytes.length, sha256: sha, ok: true })
          ok?.(ab)
          resolve(ab)
        } catch (e) {
          this.decodes.push({ byteLength: bytes.length, sha256: sha, ok: false })
          const ex = new Error(`EncodingError: ${String((e as Error).message)}`)
          ex.name = 'EncodingError'
          err?.(ex)
          reject(ex)
        }
      })
    })
  }
  /** Sources created on this context (in creation order). */
  sources(): FakeAudioBufferSourceNode[] {
    return this.nodes.filter((n): n is FakeAudioBufferSourceNode => n instanceof FakeAudioBufferSourceNode)
  }
  /** MediaElementAudioSourceNodes created on this context (in creation order). */
  mediaElementSources(): FakeMediaElementAudioSourceNode[] {
    return this.nodes.filter((n): n is FakeMediaElementAudioSourceNode => n instanceof FakeMediaElementAudioSourceNode)
  }
}

/** Every node reachable downstream of `from` (inclusive). */
export function downstream(from: FakeAudioNode): Set<FakeAudioNode> {
  const seen = new Set<FakeAudioNode>()
  const stack = [from]
  while (stack.length > 0) {
    const n = stack.pop()!
    if (seen.has(n)) continue
    seen.add(n)
    for (const e of n.outputs) stack.push(e.node)
  }
  return seen
}

/** True when `to` is reachable from `from` through the current connection graph. */
export function reaches(from: FakeAudioNode, to: FakeAudioNode): boolean {
  return downstream(from).has(to)
}

/** Installs `FakeAudioContext` and `FakeHTMLAudioElement` as browser globals; returns an uninstaller. */
export function installFakeAudioContext(): () => void {
  const g = globalThis as Record<string, unknown>
  const prev = {
    AudioContext: g.AudioContext,
    webkitAudioContext: g.webkitAudioContext,
    Audio: g.Audio,
    HTMLAudioElement: g.HTMLAudioElement,
  }
  FakeAudioContext.instances.length = 0
  FakeAudioContext.failDecodeSha = new Set()
  FakeHTMLAudioElement.instances.length = 0
  g.AudioContext = FakeAudioContext
  g.webkitAudioContext = FakeAudioContext
  g.Audio = FakeHTMLAudioElement
  g.HTMLAudioElement = FakeHTMLAudioElement
  return () => {
    g.AudioContext = prev.AudioContext
    g.webkitAudioContext = prev.webkitAudioContext
    g.Audio = prev.Audio
    g.HTMLAudioElement = prev.HTMLAudioElement
  }
}

/** Lets pending promise callbacks / microtasks / immediate macrotasks run. */
export async function flushAsync(rounds = 12): Promise<void> {
  for (let i = 0; i < rounds; i += 1) await new Promise<void>((r) => setImmediate(r))
}

