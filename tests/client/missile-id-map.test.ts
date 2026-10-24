/**
 * Audit regression: `MISSILE_ID_TO_KEY` must match 1.13c Missiles.txt (row id <-> Missile name),
 * and unknown ids must not borrow another missile's art.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MISSILE_ID_TO_KEY, resolveMissileMetadata, resolveUnitToken } from '../../src/client/view/unit-drawables.ts'

function loadMissilesTxtIdToName(): Map<number, string> {
  const text = readFileSync(resolve(__dirname, '../../samples/fixtures/data/global/excel/Missiles.txt'), 'utf8')
  const lines = text.split(/\r?\n/)
  const header = lines[0]!.split('\t')
  const nameIdx = header.indexOf('Missile')
  const idIdx = header.indexOf('Id')
  const out = new Map<number, string>()
  for (const line of lines.slice(1)) {
    const cols = line.split('\t')
    const name = (cols[nameIdx] ?? '').trim()
    const id = Number(cols[idIdx])
    if (name && Number.isInteger(id)) out.set(id, name.toLowerCase())
  }
  return out
}

describe('MISSILE_ID_TO_KEY vs Missiles.txt', () => {
  const txt = loadMissilesTxtIdToName()

  it('every mapped id names the same Missiles.txt row', () => {
    const entries = Object.entries(MISSILE_ID_TO_KEY)
    expect(entries.length).toBeGreaterThan(40)
    for (const [id, key] of entries) {
      expect(txt.get(Number(id)), `id ${id}`).toBe(key)
    }
  })

  it('pins well-known 1.13c ids', () => {
    expect(MISSILE_ID_TO_KEY[0]).toBe('arrow')
    expect(MISSILE_ID_TO_KEY[56]).toBe('chargedbolt')
    expect(MISSILE_ID_TO_KEY[58]).toBe('firebolt')
    expect(MISSILE_ID_TO_KEY[59]).toBe('icebolt')
    expect(MISSILE_ID_TO_KEY[62]).toBe('fireball')
    expect(MISSILE_ID_TO_KEY[90]).toBe('nova')
    expect(MISSILE_ID_TO_KEY[92]).toBe('blessedhammer')
    expect(MISSILE_ID_TO_KEY[100]).toBe('meteor')
    expect(MISSILE_ID_TO_KEY[260]).toBe('frozenorb')
  })

  it('unknown missile ids are explicit (no firebolt / SO substitution)', () => {
    expect(resolveMissileMetadata(9999)).toBeNull()
    expect(
      resolveUnitToken({ id: 1, kind: 'missile', classId: 9999, x: 0, y: 0 } as any),
    ).toBe('MIS_9999')
    expect(() => resolveUnitToken({ id: 1, kind: 'player', classId: 7, x: 0, y: 0 } as any)).toThrow()
    expect(resolveUnitToken({ id: 1, kind: 'player', classId: 6, x: 0, y: 0 } as any)).toBe('AI')
  })
})
