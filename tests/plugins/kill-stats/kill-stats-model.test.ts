import { describe, expect, it } from 'vitest'
import {
  KILL_STATS_FORMAT,
  KILL_STATS_VERSION,
  KillStatsImportError,
  applyDeltasToState,
  buildExportPayload,
  computeCharKey,
  computeTallyId,
  generateReplicaId,
  isValidUuid,
  mergeCharacterRecords,
  mergeImportPayload,
  mergeTallyRecords,
  validateImportPayload,
  type KillCharacterProfile,
  type KillCharacterRecord,
  type KillStatsExportPayload,
  type KillStatsSnapshot,
  type KillTallyDelta,
  type KillTallyRecord,
} from '../../../plugins/kill-stats/kill-stats-model.ts'
import { MemoryKillStatsRepository } from './memory-repository.ts'

const REPLICA_A = '11111111-1111-4111-8111-111111111111'
const REPLICA_B = '22222222-2222-4222-8222-222222222222'
const REPLICA_C = '33333333-3333-4333-8333-333333333333'

function makeCharProfile(overrides: Partial<KillCharacterProfile> = {}): KillCharacterProfile {
  const host = overrides.host ?? 'www.laiseek.xyz'
  const realm = overrides.realm ?? 'D2CS'
  const account = overrides.account ?? 'MyAccount'
  const charName = overrides.charName ?? 'BlizzSorc'
  return {
    charKey: overrides.charKey ?? computeCharKey(host, realm, account, charName),
    host,
    realm,
    account,
    charName,
    charClass: overrides.charClass ?? 1,
    level: overrides.level ?? 85,
    hardcore: overrides.hardcore ?? true,
    expansion: overrides.expansion ?? true,
    ladder: overrides.ladder ?? true,
  }
}

function makeCharRecord(overrides: Partial<KillCharacterRecord> = {}): KillCharacterRecord {
  const profile = makeCharProfile(overrides)
  return {
    ...profile,
    firstSeenAt: overrides.firstSeenAt ?? 1000,
    lastSeenAt: overrides.lastSeenAt ?? 2000,
  }
}

function makeTallyRecord(
  overrides: Partial<KillTallyRecord> & { readonly charKey: string },
): KillTallyRecord {
  const replicaId = overrides.replicaId ?? REPLICA_A
  const kind = overrides.kind ?? 'monster'
  const difficulty = overrides.difficulty ?? 2
  const subject = overrides.subject ?? 156
  return {
    id:
      overrides.id ??
      computeTallyId(replicaId, overrides.charKey, kind, difficulty, subject),
    replicaId,
    charKey: overrides.charKey,
    kind,
    difficulty,
    subject,
    count: overrides.count ?? 5,
    soloCount: overrides.soloCount ?? 3,
    firstAt: overrides.firstAt ?? 1000,
    lastAt: overrides.lastAt ?? 2000,
  }
}

describe('kill-stats-model: Key Normalization & UUID Generation', () => {
  it('normalizes computeCharKey by trimming and lowercasing all 4 components', () => {
    const key1 = computeCharKey(' WWW.LAISEEK.XYZ ', ' D2CS ', ' MyAcct ', ' Sorc_One ')
    const key2 = computeCharKey('www.laiseek.xyz', 'd2cs', 'myacct', 'sorc_one')
    expect(key1).toBe(key2)
    expect(key1).toBe('["www.laiseek.xyz","d2cs","myacct","sorc_one"]')
  })

  it('computes deterministic tally IDs and generates valid RFC 4122 v4 UUIDs via getRandomValues', () => {
    const charKey = computeCharKey('host', 'realm', 'acct', 'hero')
    const id = computeTallyId(REPLICA_A, charKey, 'monster', 2, 156)
    expect(id).toBe(JSON.stringify([REPLICA_A, charKey, 'monster', 2, 156]))

    const uuid1 = generateReplicaId()
    const uuid2 = generateReplicaId()
    expect(isValidUuid(uuid1)).toBe(true)
    expect(isValidUuid(uuid2)).toBe(true)
    expect(uuid1).not.toBe(uuid2)
    expect(uuid1[14]).toBe('4')
    expect(['8', '9', 'a', 'b']).toContain(uuid1[19])
  })
})

describe('kill-stats-model: G-Counter & LWW Merge Algebra', () => {
  it('satisfies commutativity, associativity, and idempotency for mergeTallyRecords', () => {
    const charKey = computeCharKey('host', 'realm', 'acct', 'hero')
    const t1 = makeTallyRecord({
      charKey,
      count: 4,
      soloCount: 2,
      firstAt: 1500,
      lastAt: 2500,
    })
    const t2 = makeTallyRecord({
      charKey,
      count: 7,
      soloCount: 1,
      firstAt: 1200,
      lastAt: 2200,
    })
    const t3 = makeTallyRecord({
      charKey,
      count: 6,
      soloCount: 5,
      firstAt: 1800,
      lastAt: 3000,
    })

    // Idempotency: merge(a, a) === a
    expect(mergeTallyRecords(t1, t1)).toEqual(t1)

    // Commutativity: merge(a, b) === merge(b, a)
    expect(mergeTallyRecords(t1, t2)).toEqual(mergeTallyRecords(t2, t1))

    // Associativity: merge(merge(a, b), c) === merge(a, merge(b, c))
    const left = mergeTallyRecords(mergeTallyRecords(t1, t2), t3)
    const right = mergeTallyRecords(t1, mergeTallyRecords(t2, t3))
    expect(left).toEqual(right)
    expect(left.count).toBe(7)
    expect(left.soloCount).toBe(5)
    expect(left.firstAt).toBe(1200)
    expect(left.lastAt).toBe(3000)
  })

  it('satisfies LWW commutativity, associativity, and idempotency for mergeCharacterRecords', () => {
    const c1 = makeCharRecord({ level: 80, firstSeenAt: 1000, lastSeenAt: 2000 })
    const c2 = makeCharRecord({ level: 88, firstSeenAt: 1500, lastSeenAt: 3000 })
    const c3 = makeCharRecord({ level: 85, firstSeenAt: 800, lastSeenAt: 2500 })

    expect(mergeCharacterRecords(c1, c1)).toEqual(c1)
    expect(mergeCharacterRecords(c1, c2)).toEqual(mergeCharacterRecords(c2, c1))

    const left = mergeCharacterRecords(mergeCharacterRecords(c1, c2), c3)
    const right = mergeCharacterRecords(c1, mergeCharacterRecords(c2, c3))
    expect(left).toEqual(right)
    expect(left.level).toBe(88)
    expect(left.firstSeenAt).toBe(800)
    expect(left.lastSeenAt).toBe(3000)
  })
})

describe('kill-stats-model: Export/Import Round-Trip, Multi-Replica Summation & Replica Rotation', () => {
  it('round-trips export -> import idempotently and accumulates counts across distinct replicas', async () => {
    const repoA = new MemoryKillStatsRepository({
      initialReplicaId: REPLICA_A,
      now: () => 5000,
    })
    const profile = makeCharProfile()
    const deltasA: KillTallyDelta[] = [
      {
        charKey: profile.charKey,
        kind: 'monster',
        difficulty: 2,
        subject: 156,
        count: 3,
        soloCount: 2,
        firstAt: 1000,
        lastAt: 4000,
      },
      {
        charKey: profile.charKey,
        kind: 'boss',
        difficulty: 2,
        subject: 156,
        count: 3,
        soloCount: 2,
        firstAt: 1000,
        lastAt: 4000,
      },
    ]
    await repoA.applyBatch(profile, deltasA, 4000)

    const exportedA = await repoA.exportPayload(5000)
    expect(exportedA.format).toBe(KILL_STATS_FORMAT)
    expect(exportedA.version).toBe(KILL_STATS_VERSION)
    expect(exportedA.replicaId).toBe(REPLICA_A)
    expect(exportedA.characters).toHaveLength(1)
    expect(exportedA.tallies).toHaveLength(2)

    // Re-importing the exact same payload into repoA is a no-op (unchangedTallies = 2)
    const reimportSummary = await repoA.importPayload(JSON.stringify(exportedA))
    expect(reimportSummary).toEqual({
      addedCharacters: 0,
      updatedCharacters: 0,
      addedTallies: 0,
      updatedTallies: 0,
      unchangedTallies: 2,
    })

    // Second browser (REPLICA_B) records 4 more kills of Andariel (156) and imports exportedA
    const repoB = new MemoryKillStatsRepository({
      initialReplicaId: REPLICA_B,
      now: () => 6000,
    })
    await repoB.applyBatch(
      { ...profile, level: 86 },
      [
        {
          charKey: profile.charKey,
          kind: 'monster',
          difficulty: 2,
          subject: 156,
          count: 4,
          soloCount: 4,
          firstAt: 4500,
          lastAt: 5500,
        },
        {
          charKey: profile.charKey,
          kind: 'boss',
          difficulty: 2,
          subject: 156,
          count: 4,
          soloCount: 4,
          firstAt: 4500,
          lastAt: 5500,
        },
      ],
      5500,
    )

    const mergeSummary = await repoB.importPayload(exportedA)
    expect(mergeSummary).toEqual({
      addedCharacters: 0,
      updatedCharacters: 1, // firstSeenAt updated from 4500 -> 1000
      addedTallies: 2,
      updatedTallies: 0,
      unchangedTallies: 0,
    })

    const snapB = await repoB.loadAll()
    const monsterTallies = snapB.tallies.filter(
      (t) => t.charKey === profile.charKey && t.kind === 'monster' && t.subject === 156,
    )
    expect(monsterTallies).toHaveLength(2)
    const totalKills = monsterTallies.reduce((acc, t) => acc + t.count, 0)
    const totalSolo = monsterTallies.reduce((acc, t) => acc + t.soloCount, 0)
    expect(totalKills).toBe(7)
    expect(totalSolo).toBe(6)
  })

  it('rotates replicaId on deleteCharacter and clearAll so post-delete kills add to re-imported backups', async () => {
    let nextIdIdx = 0
    const ids = [REPLICA_A, REPLICA_B, REPLICA_C]
    const repo = new MemoryKillStatsRepository({
      initialReplicaId: ids[nextIdIdx++],
      generateId: () => ids[nextIdIdx++] ?? generateReplicaId(),
    })

    const profile = makeCharProfile()
    await repo.applyBatch(
      profile,
      [
        {
          charKey: profile.charKey,
          kind: 'monster',
          difficulty: 2,
          subject: 19,
          count: 10,
          soloCount: 10,
          firstAt: 1000,
          lastAt: 2000,
        },
      ],
      2000,
    )

    // Take backup before deletion (under REPLICA_A)
    const backup = await repo.exportPayload(2500)
    expect(backup.replicaId).toBe(REPLICA_A)

    // Delete character -> deletes records AND rotates replicaId to REPLICA_B
    await repo.deleteCharacter(profile.charKey)
    const afterDelete = await repo.loadAll()
    expect(afterDelete.replicaId).toBe(REPLICA_B)
    expect(afterDelete.characters).toHaveLength(0)
    expect(afterDelete.tallies).toHaveLength(0)

    // Record 3 new kills after deletion (stored under REPLICA_B)
    await repo.applyBatch(
      profile,
      [
        {
          charKey: profile.charKey,
          kind: 'monster',
          difficulty: 2,
          subject: 19,
          count: 3,
          soloCount: 3,
          firstAt: 3000,
          lastAt: 3500,
        },
      ],
      3500,
    )

    // Re-import old backup -> REPLICA_A (10) + REPLICA_B (3) = 13 total kills (not swallowed by max(10, 3))
    await repo.importPayload(backup)
    const afterRestore = await repo.loadAll()
    const total = afterRestore.tallies
      .filter((t) => t.kind === 'monster' && t.subject === 19)
      .reduce((sum, t) => sum + t.count, 0)
    expect(total).toBe(13)

    // clearAll also rotates replicaId to REPLICA_C
    await repo.clearAll()
    const afterClear = await repo.loadAll()
    expect(afterClear.replicaId).toBe(REPLICA_C)
    expect(afterClear.characters).toHaveLength(0)
    expect(afterClear.tallies).toHaveLength(0)
  })
})

describe('kill-stats-model: Strict Import Validation (Table-Driven KillStatsImportError)', () => {
  const baseChar = makeCharRecord()
  const baseTally = makeTallyRecord({ charKey: baseChar.charKey })
  const validPayload: KillStatsExportPayload = {
    format: KILL_STATS_FORMAT,
    version: KILL_STATS_VERSION,
    exportedAt: 5000,
    replicaId: REPLICA_A,
    characters: [baseChar],
    tallies: [baseTally],
  }

  const cases: ReadonlyArray<{
    readonly name: string
    readonly input: unknown
    readonly expectedPath: string
  }> = [
    {
      name: 'malformed JSON string',
      input: '{not-valid-json',
      expectedPath: '$',
    },
    {
      name: 'non-object root',
      input: null,
      expectedPath: '$',
    },
    {
      name: 'wrong format string',
      input: { ...validPayload, format: 'wrong-format' },
      expectedPath: 'format',
    },
    {
      name: 'wrong version number',
      input: { ...validPayload, version: 2 },
      expectedPath: 'version',
    },
    {
      name: 'negative exportedAt',
      input: { ...validPayload, exportedAt: -1 },
      expectedPath: 'exportedAt',
    },
    {
      name: 'invalid root replicaId UUID',
      input: { ...validPayload, replicaId: 'not-a-uuid' },
      expectedPath: 'replicaId',
    },
    {
      name: 'characters not an array',
      input: { ...validPayload, characters: {} },
      expectedPath: 'characters',
    },
    {
      name: 'tallies not an array',
      input: { ...validPayload, tallies: null },
      expectedPath: 'tallies',
    },
    {
      name: 'empty character host',
      input: {
        ...validPayload,
        characters: [{ ...baseChar, host: '   ' }],
      },
      expectedPath: 'characters[0].host',
    },
    {
      name: 'mismatched recomputed charKey',
      input: {
        ...validPayload,
        characters: [{ ...baseChar, charKey: '["tampered","d2cs","myaccount","blizzsorc"]' }],
      },
      expectedPath: 'characters[0].charKey',
    },
    {
      name: 'duplicate charKey in characters[]',
      input: {
        ...validPayload,
        characters: [baseChar, baseChar],
      },
      expectedPath: 'characters[1].charKey',
    },
    {
      name: 'out-of-range charClass (7)',
      input: {
        ...validPayload,
        characters: [{ ...baseChar, charClass: 7 }],
      },
      expectedPath: 'characters[0].charClass',
    },
    {
      name: 'out-of-range character level (100)',
      input: {
        ...validPayload,
        characters: [{ ...baseChar, level: 100 }],
      },
      expectedPath: 'characters[0].level',
    },
    {
      name: 'character firstSeenAt > lastSeenAt',
      input: {
        ...validPayload,
        characters: [{ ...baseChar, firstSeenAt: 3000, lastSeenAt: 2000 }],
      },
      expectedPath: 'characters[0].firstSeenAt',
    },
    {
      name: 'invalid tally replicaId UUID',
      input: {
        ...validPayload,
        tallies: [{ ...baseTally, replicaId: 'bad-uuid' }],
      },
      expectedPath: 'tallies[0].replicaId',
    },
    {
      name: 'tally charKey missing from characters[] (referential integrity)',
      input: {
        ...validPayload,
        tallies: [
          {
            ...baseTally,
            charKey: computeCharKey('other', 'realm', 'acct', 'ghost'),
          },
        ],
      },
      expectedPath: 'tallies[0].charKey',
    },
    {
      name: 'invalid tally kind',
      input: {
        ...validPayload,
        tallies: [{ ...baseTally, kind: 'area' }],
      },
      expectedPath: 'tallies[0].kind',
    },
    {
      name: 'invalid tally difficulty (3)',
      input: {
        ...validPayload,
        tallies: [{ ...baseTally, difficulty: 3 }],
      },
      expectedPath: 'tallies[0].difficulty',
    },
    {
      name: 'non-countable monster hcIdx (363 = necroskeleton Align=1)',
      input: {
        ...validPayload,
        tallies: [
          makeTallyRecord({
            charKey: baseChar.charKey,
            kind: 'monster',
            subject: 363,
          }),
        ],
      },
      expectedPath: 'tallies[0].subject',
    },
    {
      name: 'boss tally for non-boss monster hcIdx (19 = fallen1)',
      input: {
        ...validPayload,
        tallies: [
          makeTallyRecord({
            charKey: baseChar.charKey,
            kind: 'boss',
            subject: 19,
          }),
        ],
      },
      expectedPath: 'tallies[0].subject',
    },
    {
      name: 'superunique tally out of range (66)',
      input: {
        ...validPayload,
        tallies: [
          makeTallyRecord({
            charKey: baseChar.charKey,
            kind: 'superunique',
            subject: 66,
          }),
        ],
      },
      expectedPath: 'tallies[0].subject',
    },
    {
      name: 'mismatched recomputed tally id',
      input: {
        ...validPayload,
        tallies: [{ ...baseTally, id: '["tampered-id"]' }],
      },
      expectedPath: 'tallies[0].id',
    },
    {
      name: 'duplicate tally id in tallies[]',
      input: {
        ...validPayload,
        tallies: [baseTally, baseTally],
      },
      expectedPath: 'tallies[1].id',
    },
    {
      name: 'tally count < 1 (0)',
      input: {
        ...validPayload,
        tallies: [{ ...baseTally, count: 0, soloCount: 0 }],
      },
      expectedPath: 'tallies[0].count',
    },
    {
      name: 'tally soloCount > count',
      input: {
        ...validPayload,
        tallies: [{ ...baseTally, count: 5, soloCount: 6 }],
      },
      expectedPath: 'tallies[0].soloCount',
    },
    {
      name: 'tally firstAt > lastAt',
      input: {
        ...validPayload,
        tallies: [{ ...baseTally, firstAt: 5000, lastAt: 4000 }],
      },
      expectedPath: 'tallies[0].firstAt',
    },
  ]

  for (const tc of cases) {
    it(`rejects ${tc.name} with KillStatsImportError at path "${tc.expectedPath}"`, () => {
      let caught: unknown = null
      try {
        validateImportPayload(tc.input)
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(KillStatsImportError)
      expect((caught as KillStatsImportError).path).toBe(tc.expectedPath)
    })
  }
})
