/**
 * Fog.dll 1.13c sine table (src/client/weather/fog-sin-table.ts): exact f32 bit patterns from Fog
 * file offset 0x2f470, read by Fog #10084 (sin) and #10083 (cos).
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readFogSinTable, renderFogSinTable } from '../../src/baker/extract/gen-fog-sin-table.ts'
import { FOG_SIN_TABLE, fogCos, fogSin } from '../../src/client/weather/fog-sin-table.ts'

function bitsOf(value: number): number {
  const view = new DataView(new ArrayBuffer(4))
  view.setFloat32(0, value, true)
  return view.getUint32(0, true)
}

const DATA_DIR = existsSync('samples/d2/Fog.dll') ? 'samples/d2' : (process.env.D2_DATA_DIR ?? 'samples/d2')
const FOG_DLL = join(DATA_DIR, 'Fog.dll')

describe('Fog sine table', () => {
  it('has 512 f32 entries with the 1.13c anchors', () => {
    expect(FOG_SIN_TABLE.length).toBe(512)
    for (const v of FOG_SIN_TABLE) expect(Math.fround(v)).toBe(v)
    expect(bitsOf(FOG_SIN_TABLE[0]!)).toBe(0)
    expect(bitsOf(FOG_SIN_TABLE[7]!)).toBe(0x3dafb681)
    expect(FOG_SIN_TABLE[128]).toBe(1)
    expect(bitsOf(FOG_SIN_TABLE[256]!)).toBe(0xb3bbbd2e)
    expect(FOG_SIN_TABLE[384]).toBe(-1)
  })

  it('is not fround(sin): 328 entries differ', () => {
    let differing = 0
    for (let i = 0; i < 512; i += 1) {
      if (FOG_SIN_TABLE[i] !== Math.fround(Math.sin((2 * Math.PI * i) / 512))) differing += 1
    }
    expect(differing).toBe(328)
  })

  it('indexes with a & 511, cos = sin(a + 128)', () => {
    expect(fogSin(128)).toBe(1)
    expect(fogSin(128 + 512)).toBe(1)
    expect(fogSin(-384)).toBe(1)
    expect(fogCos(0)).toBe(1)
    expect(fogCos(256)).toBe(-1)
    for (const a of [0, 7, 28, 92, 162, 211, 300, 511]) expect(fogCos(a)).toBe(fogSin(a + 128))
  })

  it.skipIf(!existsSync(FOG_DLL))('matches Fog.dll byte for byte (needs Fog.dll next to the MPQs)', () => {
    const bits = readFogSinTable(new Uint8Array(readFileSync(FOG_DLL)))
    expect(bits.length).toBe(512)
    for (let i = 0; i < 512; i += 1) expect(bitsOf(FOG_SIN_TABLE[i]!), `T[${i}]`).toBe(bits[i])
    // The checked-in module is exactly what `npm run extract:fog-sin` writes.
    expect(readFileSync('src/client/weather/fog-sin-table.ts', 'utf8')).toBe(renderFogSinTable(bits))
  })
})
