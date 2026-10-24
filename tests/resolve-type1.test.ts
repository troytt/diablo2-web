/**
 * Type-1 (DS1 monster/NPC spawn) resolution.
 *
 * DS1 entries come in two flavours: `type` 2 is an `Objects.txt` object, `type` 1
 * is a spawn whose `id` indexes `MonPreset.txt` filtered by act. Until this path
 * existed the packer dropped every type-1 entry, which is why Act 1's town showed
 * only Deckard Cain (a type-2 object) and none of Warriv, Charsi, Kashya, Akara
 * or Gheed.
 */
import { describe, expect, test } from 'vitest'
import { resolveDs1Object } from '../src/common/units/objects.ts'
import type { MonstersTable, ObjectsTable } from '../src/common/units/objects.ts'
import { OBJECT_TYPE_MONSTER } from '../src/common/units/object-lookup.ts'

/** The type-1 path never consults `Objects.txt`, so an empty table is sufficient. */
const emptyObjectsTable: ObjectsTable = {
  table: { header: [], rows: [] },
  rows: [],
  byId: new Map(),
}

/**
 * A stand-in for the two shipped tables.
 *
 * Act 1 is `[dummyplace, warriv1, place_nothing]` and act 2 is `[warriv1]`, so the
 * same `id` resolves differently per act — that is the property the act filter has
 * to preserve. `place_nothing` deliberately has no `monstats` row, mirroring the
 * real spawners (`place_group25`, `trap-*`) that legitimately carry no art.
 * `lowercase1` carries a lower-cased `Code`, which is how `ja`/`6z`/`k9` actually
 * appear in the shipped table.
 */
function mockMonsters(): MonstersTable {
  const presetPlaceByAct = new Map<string, readonly string[]>([
    ['1', ['dummyplace', 'warriv1', 'place_nothing', 'lowercase1']],
    ['2', ['warriv1']],
  ])

  const stats = {
    header: ['Id', 'NameStr', 'Code'],
    rows: [
      ['warriv1', 'Warriv', 'WA'],
      ['dummyplace', '', 'DM'],
      ['lowercase1', 'Jamella', 'ja'],
    ],
  }

  const statsById = new Map<string, readonly string[]>([
    ['warriv1', stats.rows[0]!],
    ['dummyplace', stats.rows[1]!],
    ['lowercase1', stats.rows[2]!],
  ])

  return { stats, preset: { header: ['Act', 'Place'], rows: [] }, presetPlaceByAct, statsById }
}

describe('resolveDs1Object, type-1 spawns', () => {
  test('resolves a named NPC to its art token and name', () => {
    const res = resolveDs1Object(emptyObjectsTable, 1, OBJECT_TYPE_MONSTER, 1, mockMonsters())
    expect(res.kind).toBe('npc')
    expect(res.token).toBe('WA')
    expect(res.name).toBe('Warriv')
    expect(res.artless).toBe(false)
  })

  test('a Place with no monstats row is artless, not a guess', () => {
    const res = resolveDs1Object(emptyObjectsTable, 1, OBJECT_TYPE_MONSTER, 2, mockMonsters())
    expect(res.kind).toBe('npc')
    expect(res.token).toBe('')
    expect(res.name).toBe('place_nothing')
    expect(res.artless).toBe(true)
  })

  test('an out-of-range id falls back to a plain monster spawn', () => {
    const res = resolveDs1Object(emptyObjectsTable, 1, OBJECT_TYPE_MONSTER, 999, mockMonsters())
    expect(res.kind).toBe('monster')
    expect(res.token).toBe('')
    expect(res.artless).toBe(true)
  })

  test('the same id resolves differently per act', () => {
    const monsters = mockMonsters()
    expect(resolveDs1Object(emptyObjectsTable, 1, OBJECT_TYPE_MONSTER, 0, monsters).token).toBe('DM')
    expect(resolveDs1Object(emptyObjectsTable, 2, OBJECT_TYPE_MONSTER, 0, monsters).token).toBe('WA')
  })

  test('omitting the monsters table restores the legacy drop behaviour', () => {
    const res = resolveDs1Object(emptyObjectsTable, 1, OBJECT_TYPE_MONSTER, 1, undefined)
    expect(res.kind).toBe('monster')
    expect(res.token).toBe('')
    expect(res.artless).toBe(true)
  })

  test('a lower-cased Code is canonicalised to upper case', () => {
    // Regression guard: `monsterMembers` is keyed upper-cased, so a token left as
    // `ja` missed the map entirely and baked Jamella and the three Injured
    // Barbarians into the pack with no art at all.
    const res = resolveDs1Object(emptyObjectsTable, 1, OBJECT_TYPE_MONSTER, 3, mockMonsters())
    expect(res.token).toBe('JA')
    expect(res.artless).toBe(false)
    expect(res.name).toBe('Jamella')
  })
})
