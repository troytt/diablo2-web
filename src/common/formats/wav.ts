/**
 * RIFF/WAVE reader for the 1.13c sound files (`d2sfx.mpq` `data\global\sfx\...`).
 *
 * Only what the port plays is accepted: format tag 1 (PCM), 16 bits per sample, mono or stereo.
 * Every other layout, a missing `fmt ` / `data` chunk or a chunk that runs past the end of the file
 * is an error. Chunks other than `fmt ` and `data` (e.g. the `smpl` loop chunk of rain2.wav) are
 * skipped.
 */

/** A 16-bit PCM WAVE file. */
export interface WavPcm16 {
  readonly channels: 1 | 2
  readonly sampleRate: number
  /** Sample frames (one sample per channel each). */
  readonly frames: number
  /** Byte offset of the `data` payload in the file. */
  readonly dataOffset: number
  /** Byte length of the `data` payload (`frames * channels * 2`). */
  readonly dataBytes: number
}

function fourCc(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!)
}

/**
 * Parses the RIFF chunks of a 16-bit PCM WAVE file.
 *
 * @param bytes - the whole file.
 * @param what - name used in error messages.
 */
export function parseWavPcm16(bytes: Uint8Array, what: string): WavPcm16 {
  const fail = (msg: string): never => {
    throw new Error(`wav ${what}: ${msg}`)
  }
  if (bytes.length < 12 || fourCc(bytes, 0) !== 'RIFF' || fourCc(bytes, 8) !== 'WAVE') fail('not a RIFF/WAVE file')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const riffEnd = 8 + view.getUint32(4, true)
  if (riffEnd > bytes.length) fail(`RIFF size ${String(riffEnd)} exceeds the file (${String(bytes.length)} bytes)`)
  let fmt: { channels: number; sampleRate: number; blockAlign: number; bits: number } | null = null
  let data: { offset: number; bytes: number } | null = null
  let at = 12
  while (at + 8 <= riffEnd) {
    const id = fourCc(bytes, at)
    const size = view.getUint32(at + 4, true)
    const body = at + 8
    if (body + size > riffEnd) fail(`chunk '${id}' at ${String(at)} runs past the RIFF end`)
    if (id === 'fmt ') {
      if (size < 16) fail(`fmt chunk of ${String(size)} bytes`)
      const tag = view.getUint16(body, true)
      if (tag !== 1) fail(`format tag ${String(tag)} (only PCM = 1)`)
      fmt = {
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        blockAlign: view.getUint16(body + 12, true),
        bits: view.getUint16(body + 14, true),
      }
      const byteRate = view.getUint32(body + 8, true)
      if (fmt.bits !== 16) fail(`${String(fmt.bits)} bits per sample (only 16)`)
      if (fmt.channels !== 1 && fmt.channels !== 2) fail(`${String(fmt.channels)} channels`)
      if (fmt.blockAlign !== fmt.channels * 2) fail(`block align ${String(fmt.blockAlign)}`)
      if (fmt.sampleRate <= 0 || byteRate !== fmt.sampleRate * fmt.blockAlign) fail(`byte rate ${String(byteRate)}`)
    } else if (id === 'data') {
      if (data !== null) fail('two data chunks')
      data = { offset: body, bytes: size }
    }
    at = body + size + (size & 1)
  }
  if (fmt === null) return fail('no fmt chunk')
  if (data === null) return fail('no data chunk')
  if (data.bytes % fmt.blockAlign !== 0) fail(`data size ${String(data.bytes)} is not a whole number of frames`)
  return {
    channels: fmt.channels as 1 | 2,
    sampleRate: fmt.sampleRate,
    frames: data.bytes / fmt.blockAlign,
    dataOffset: data.offset,
    dataBytes: data.bytes,
  }
}

/** The samples of each channel as floats in [-1, 1) (`s16 / 32768`), for an `AudioBuffer`. */
export function wavPcm16ChannelData(bytes: Uint8Array, wav: WavPcm16): Float32Array[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset + wav.dataOffset, wav.dataBytes)
  const out: Float32Array[] = []
  for (let c = 0; c < wav.channels; c += 1) out.push(new Float32Array(wav.frames))
  for (let f = 0; f < wav.frames; f += 1) {
    for (let c = 0; c < wav.channels; c += 1) {
      out[c]![f] = view.getInt16((f * wav.channels + c) * 2, true) / 32768
    }
  }
  return out
}
