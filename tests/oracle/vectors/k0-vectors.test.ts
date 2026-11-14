/**
 * Plan §3.6.2 & §4.1 #4 K0 Subsystem Vector Gate (`npx vitest run tests/oracle/vectors/*.test.ts`).
 *
 * Verifies frozen DLL-emitted `.d2tv` vector files in `tests/fixtures/oracle/vectors/`
 * (`prng-10k.d2tv` and `eventwheel-113c.d2tv`) against `src/d2kern-113c/`.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EVTWHEEL_RECORD_SIZE,
  verifyEventWheelVectors,
} from '../../../tools/oracle/vectors/eventwheel-vector.ts'
import {
  PRNG_RECORD_SIZE,
  verifyPrngVectors,
} from '../../../tools/oracle/vectors/prng-vector.ts'

const FIXTURE_DIR = resolve(import.meta.dirname, '../../fixtures/oracle/vectors')
const TOOL_VECTOR_DIR = resolve(import.meta.dirname, '../../../tools/oracle/vectors')

function sha256Hex(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex')
}

describe('Plan §3.6.2 / §4.1 #4: K0 Subsystem Vectors (tests/fixtures/oracle/vectors/)', () => {
  it('verifies prng-10k.d2tv (10,000 D2Game.dll/D2Common.dll PRNG records) with 0 errors', () => {
    const fixturePath = resolve(FIXTURE_DIR, 'prng-10k.d2tv')
    const emitterPath = resolve(TOOL_VECTOR_DIR, 'prng-10k.d2tv')
    expect(existsSync(fixturePath)).toBe(true)
    expect(existsSync(emitterPath)).toBe(true)

    const raw = readFileSync(fixturePath)
    expect(sha256Hex(raw)).toBe('257e65050dd758de0cdd1f808c456910b29a933f7da3f1d1d6b25650d4df599e')
    expect(Buffer.compare(raw, readFileSync(emitterPath))).toBe(0)

    const u8 = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
    expect(u8.byteLength).toBe(32 + 10_000 * PRNG_RECORD_SIZE)

    const res = verifyPrngVectors(u8)
    expect(res.errors).toEqual([])
    expect(res.passed).toBe(10_000)
    expect(res.total).toBe(10_000)
  })

  it('verifies eventwheel-113c.d2tv (256 D2Game.dll multi-frame scenarios, 45,101 fired events) with 0 errors', () => {
    const fixturePath = resolve(FIXTURE_DIR, 'eventwheel-113c.d2tv')
    const emitterPath = resolve(TOOL_VECTOR_DIR, 'eventwheel-113c.d2tv')
    expect(existsSync(fixturePath)).toBe(true)
    expect(existsSync(emitterPath)).toBe(true)

    const raw = readFileSync(fixturePath)
    expect(sha256Hex(raw)).toBe('716404b144a4fbd0d5b7c3cd13622a9ce7b759e303650b7895eddc8c90ea7993')
    expect(Buffer.compare(raw, readFileSync(emitterPath))).toBe(0)

    const u8 = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
    expect(u8.byteLength).toBe(32 + 256 * EVTWHEEL_RECORD_SIZE)

    const res = verifyEventWheelVectors(u8)
    expect(res.errors).toEqual([])
    expect(res.passed).toBe(256)
    expect(res.total).toBe(256)
    expect(res.totalFired).toBe(45_101)
  })
})
