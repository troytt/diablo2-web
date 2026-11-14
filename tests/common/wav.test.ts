/**
 * #943 F4: the shared RIFF/WAVE PCM16 reader (`src/common/formats/wav.ts`) used by the audio audit and the sample
 * facts of the record layer. Synthetic files are built byte by byte below; the last test parses real 1.13c WAVs
 * from the MPQs (BuildSoundPath 0x6fb0db30 members).
 */
import { describe, expect, it } from 'vitest'
import { parseWavPcm16, wavPcm16ChannelData } from '../../src/common/formats/wav.ts'
import { buildSoundMpqPath113c } from '../../src/common/audio/sounds-113c.ts'
import { audioArchives113c } from '../audio/mpq-sample-facts.ts'

const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0))

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** A RIFF chunk with its pad byte for odd sizes. */
function chunk(id: string, body: Uint8Array, declaredSize = body.length): Uint8Array {
  const out = new Uint8Array(8 + body.length + (body.length & 1))
  out.set(ascii(id), 0)
  new DataView(out.buffer).setUint32(4, declaredSize, true)
  out.set(body, 8)
  return out
}

interface FmtFields {
  tag?: number
  channels?: number
  rate?: number
  bits?: number
  blockAlign?: number
  byteRate?: number
  size?: number
}

function fmt(f: FmtFields = {}): Uint8Array {
  const channels = f.channels ?? 1
  const rate = f.rate ?? 22050
  const bits = f.bits ?? 16
  const blockAlign = f.blockAlign ?? (channels * bits) / 8
  const body = new Uint8Array(f.size ?? 16)
  const v = new DataView(body.buffer)
  v.setUint16(0, f.tag ?? 1, true)
  if (body.length >= 16) {
    v.setUint16(2, channels, true)
    v.setUint32(4, rate, true)
    v.setUint32(8, f.byteRate ?? rate * blockAlign, true)
    v.setUint16(12, blockAlign, true)
    v.setUint16(14, bits, true)
  }
  return chunk('fmt ', body)
}

/** Interleaved signed 16-bit little-endian samples. */
function s16(samples: readonly number[]): Uint8Array {
  const body = new Uint8Array(samples.length * 2)
  const v = new DataView(body.buffer)
  samples.forEach((s, i) => v.setInt16(i * 2, s, true))
  return body
}

function riff(chunks: readonly Uint8Array[], opts: { magic?: string; form?: string; sizeDelta?: number } = {}): Uint8Array {
  const payload = concat(chunks)
  const out = new Uint8Array(12 + payload.length)
  out.set(ascii(opts.magic ?? 'RIFF'), 0)
  new DataView(out.buffer).setUint32(4, 4 + payload.length + (opts.sizeDelta ?? 0), true)
  out.set(ascii(opts.form ?? 'WAVE'), 8)
  out.set(payload, 12)
  return out
}

describe('parseWavPcm16 (RIFF/WAVE, PCM tag 1, 16-bit, mono / stereo)', () => {
  it('accepts mono PCM16 and skips foreign chunks with their pad byte (e.g. the smpl chunk of rain2.wav)', () => {
    const smpl = chunk('smpl', new Uint8Array(7)) // odd size → one pad byte
    const bytes = riff([fmt(), smpl, chunk('data', s16([0, 1, -1, 2, -2]))])
    const wav = parseWavPcm16(bytes, 'mono.wav')
    expect(wav).toEqual({ channels: 1, sampleRate: 22050, frames: 5, dataOffset: 12 + 24 + 16 + 8, dataBytes: 10 })
  })

  it('accepts stereo PCM16 (block align 4, byte rate = rate · 4)', () => {
    const bytes = riff([fmt({ channels: 2, rate: 44100 }), chunk('data', s16([1, 2, 3, 4, 5, 6]))])
    expect(parseWavPcm16(bytes, 'stereo.wav')).toMatchObject({ channels: 2, sampleRate: 44100, frames: 3, dataBytes: 12 })
  })

  it('accepts a fmt chunk longer than 16 bytes (WAVEFORMATEX cbSize)', () => {
    const bytes = riff([fmt({ size: 18 }), chunk('data', s16([7, 8]))])
    expect(parseWavPcm16(bytes, 'ex.wav')).toMatchObject({ channels: 1, frames: 2 })
  })

  it('rejects anything that is not a RIFF/WAVE file', () => {
    const data = chunk('data', s16([0]))
    expect(() => parseWavPcm16(new Uint8Array(8), 'short.wav')).toThrow(/wav short\.wav: not a RIFF\/WAVE file/)
    expect(() => parseWavPcm16(riff([fmt(), data], { magic: 'RIFX' }), 'rifx.wav')).toThrow(/not a RIFF\/WAVE file/)
    expect(() => parseWavPcm16(riff([fmt(), data], { form: 'AVI ' }), 'avi.wav')).toThrow(/not a RIFF\/WAVE file/)
  })

  it('rejects non-PCM, 8-bit, 3-channel and inconsistent fmt chunks', () => {
    const data = chunk('data', s16([0, 0]))
    expect(() => parseWavPcm16(riff([fmt({ tag: 2 }), data]), 'adpcm.wav')).toThrow(/format tag 2 \(only PCM = 1\)/)
    expect(() => parseWavPcm16(riff([fmt({ tag: 3, bits: 32 }), data]), 'float.wav')).toThrow(/format tag 3/)
    expect(() => parseWavPcm16(riff([fmt({ bits: 8 }), data]), 'u8.wav')).toThrow(/8 bits per sample \(only 16\)/)
    expect(() => parseWavPcm16(riff([fmt({ channels: 3 }), data]), '3ch.wav')).toThrow(/3 channels/)
    expect(() => parseWavPcm16(riff([fmt({ blockAlign: 4 }), data]), 'align.wav')).toThrow(/block align 4/)
    expect(() => parseWavPcm16(riff([fmt({ byteRate: 1234 }), data]), 'rate.wav')).toThrow(/byte rate 1234/)
    expect(() => parseWavPcm16(riff([fmt({ size: 14 }), data]), 'tiny.wav')).toThrow(/fmt chunk of 14 bytes/)
  })

  it('rejects truncated files, missing chunks, duplicate data and partial frames', () => {
    const good = riff([fmt(), chunk('data', s16([1, 2, 3]))])
    expect(() => parseWavPcm16(good.subarray(0, good.length - 2), 'cut.wav')).toThrow(/RIFF size \d+ exceeds the file/)
    const lying = riff([fmt(), chunk('data', s16([1, 2]), 400)])
    expect(() => parseWavPcm16(lying, 'lying.wav')).toThrow(/chunk 'data' at 36 runs past the RIFF end/)
    expect(() => parseWavPcm16(riff([fmt()]), 'nodata.wav')).toThrow(/no data chunk/)
    expect(() => parseWavPcm16(riff([chunk('data', s16([1]))]), 'nofmt.wav')).toThrow(/no fmt chunk/)
    expect(() => parseWavPcm16(riff([fmt(), chunk('data', s16([1])), chunk('data', s16([2]))]), 'two.wav')).toThrow(/two data chunks/)
    expect(() => parseWavPcm16(riff([fmt(), chunk('data', new Uint8Array(3))]), 'odd.wav')).toThrow(/data size 3 is not a whole number of frames/)
    expect(() => parseWavPcm16(riff([fmt({ channels: 2 }), chunk('data', s16([1, 2, 3]))]), 'half.wav')).toThrow(/data size 6/)
  })
})

describe('wavPcm16ChannelData', () => {
  it('returns one Float32Array of `frames` samples per channel, s16 / 32768 in [−1, 1)', () => {
    const bytes = riff([fmt(), chunk('data', s16([0, 16384, -32768, 32767, -1]))])
    const wav = parseWavPcm16(bytes, 'mono.wav')
    const [mono, ...rest] = wavPcm16ChannelData(bytes, wav)
    expect(rest).toEqual([])
    expect(Array.from(mono!)).toEqual([0, 0.5, -1, Math.fround(32767 / 32768), Math.fround(-1 / 32768)])
  })

  it('de-interleaves stereo frames', () => {
    const bytes = riff([fmt({ channels: 2 }), chunk('data', s16([100, -100, 200, -200, 300, -300]))])
    const channels = wavPcm16ChannelData(bytes, parseWavPcm16(bytes, 'stereo.wav'))
    expect(channels.map((c) => Array.from(c, (s) => Math.round(s * 32768)))).toEqual([
      [100, 200, 300],
      [-100, -200, -300],
    ])
  })

  it('reads through a Uint8Array view at a non-zero byteOffset', () => {
    const file = riff([fmt(), chunk('data', s16([-32768, 32767, 1234]))])
    const host = new Uint8Array(file.length + 11)
    host.set(file, 7)
    const view = host.subarray(7, 7 + file.length)
    const wav = parseWavPcm16(view, 'view.wav')
    expect(Array.from(wavPcm16ChannelData(view, wav)[0]!, (s) => Math.round(s * 32768))).toEqual([-32768, 32767, 1234])
  })

  it('parses real 1.13c WAVs from the MPQs: rain2.wav (stereo, smpl chunk) and thunder_norm_1.wav (mono)', () => {
    const archives = audioArchives113c()
    for (const [id, channels] of [[64, 2], [202, 1]] as const) {
      const path = buildSoundMpqPath113c(id)!
      const bytes = archives.readSync(path)
      const wav = parseWavPcm16(bytes, path)
      expect(wav.channels).toBe(channels)
      expect(wav.sampleRate).toBe(22050)
      expect(wav.dataBytes).toBe(wav.frames * channels * 2)
      expect(wav.dataOffset + wav.dataBytes).toBeLessThanOrEqual(bytes.length)
      const data = wavPcm16ChannelData(bytes, wav)
      expect(data).toHaveLength(channels)
      for (const c of data) {
        expect(c).toHaveLength(wav.frames)
        let min = 0
        let max = 0
        for (const s of c) {
          if (s < min) min = s
          if (s > max) max = s
        }
        expect(min).toBeGreaterThanOrEqual(-1)
        expect(max).toBeLessThan(1)
        expect(max - min).toBeGreaterThan(0) // not silence
      }
    }
  })
})
