/**
 * IndexedDB persistence repository (`d2web-kill-stats` v1) for monster kill statistics.
 *
 * Object stores:
 * - `meta` (`keyPath: 'key'`) — stores `{ key: 'replicaId', value: string }`
 * - `characters` (`keyPath: 'charKey'`) — stores `KillCharacterRecord`
 * - `tallies` (`keyPath: 'id'`, index `'charKey'`) — stores `KillTallyRecord`
 */

import {
  KILL_STATS_DB_NAME,
  KILL_STATS_DB_VERSION,
  applyDeltaToTallyRecord,
  buildExportPayload,
  computeTallyId,
  generateReplicaId,
  isValidUuid,
  mergeImportPayload,
  upsertCharacterRecord,
  validateImportPayload,
  type KillCharacterProfile,
  type KillCharacterRecord,
  type KillStatsExportPayload,
  type KillStatsImportSummary,
  type KillStatsSnapshot,
  type KillTallyDelta,
  type KillTallyRecord,
} from './kill-stats-model.ts'

export interface KillStatsBatchInput {
  readonly character: KillCharacterProfile
  readonly deltas: readonly KillTallyDelta[]
  readonly at?: number | undefined
}

export interface KillStatsRepository {
  loadAll(): Promise<KillStatsSnapshot>
  applyBatch(batch: KillStatsBatchInput): Promise<void>
  applyBatch(
    character: KillCharacterProfile,
    deltas: readonly KillTallyDelta[],
    at?: number,
  ): Promise<void>
  applyBatch(
    replicaId: string,
    character: KillCharacterProfile,
    deltas: readonly KillTallyDelta[],
    at?: number,
  ): Promise<void>
  exportPayload(exportedAt?: number): Promise<KillStatsExportPayload>
  importPayload(raw: unknown): Promise<KillStatsImportSummary>
  deleteCharacter(charKey: string): Promise<void>
  clearAll(): Promise<void>
  close?(): void
}

export function normalizeApplyBatchArgs(
  arg0: KillStatsBatchInput | KillCharacterProfile | string,
  arg1?: readonly KillTallyDelta[] | KillCharacterProfile,
  arg2?: number | readonly KillTallyDelta[],
  arg3?: number,
): {
  readonly explicitReplicaId?: string | undefined
  readonly character: KillCharacterProfile
  readonly deltas: readonly KillTallyDelta[]
  readonly at?: number | undefined
} {
  if (typeof arg0 === 'string') {
    return {
      explicitReplicaId: arg0,
      character: arg1 as KillCharacterProfile,
      deltas: (arg2 as readonly KillTallyDelta[]) ?? [],
      at: arg3,
    }
  }
  if ('character' in arg0 && 'deltas' in arg0) {
    return {
      character: arg0.character,
      deltas: arg0.deltas,
      at: arg0.at,
    }
  }
  return {
    character: arg0,
    deltas: (arg1 as readonly KillTallyDelta[]) ?? [],
    at: typeof arg2 === 'number' ? arg2 : undefined,
  }
}

export interface IndexedDbKillStatsRepositoryOptions {
  readonly dbName?: string | undefined
  readonly indexedDB?: IDBFactory | null | undefined
  readonly now?: (() => number) | undefined
  readonly generateId?: (() => string) | undefined
  readonly onBlocked?: (() => void) | undefined
  readonly onVersionChange?: (() => void) | undefined
}

interface MetaRecord {
  readonly key: string
  readonly value: string
}

export class IndexedDbKillStatsRepository implements KillStatsRepository {
  private readonly dbName: string
  private readonly idbFactory: IDBFactory | null
  private readonly now: () => number
  private readonly generateId: () => string
  private readonly onBlocked?: (() => void) | undefined
  private readonly onVersionChange?: (() => void) | undefined
  private dbPromise: Promise<IDBDatabase> | null = null
  private activeDb: IDBDatabase | null = null

  constructor(options: IndexedDbKillStatsRepositoryOptions = {}) {
    this.dbName = options.dbName ?? KILL_STATS_DB_NAME
    this.idbFactory =
      options.indexedDB !== undefined
        ? options.indexedDB
        : typeof globalThis.indexedDB !== 'undefined'
          ? globalThis.indexedDB
          : null
    this.now = options.now ?? (() => Date.now())
    this.generateId = options.generateId ?? (() => generateReplicaId())
    this.onBlocked = options.onBlocked
    this.onVersionChange = options.onVersionChange
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise
    if (!this.idbFactory) {
      return Promise.reject(new Error('IndexedDB is not available in this browser environment'))
    }

    const factory = this.idbFactory
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      let req: IDBOpenDBRequest
      try {
        req = factory.open(this.dbName, KILL_STATS_DB_VERSION)
      } catch (err) {
        this.dbPromise = null
        reject(err instanceof Error ? err : new Error(String(err)))
        return
      }

      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('characters')) {
          db.createObjectStore('characters', { keyPath: 'charKey' })
        }
        if (!db.objectStoreNames.contains('tallies')) {
          const tallies = db.createObjectStore('tallies', { keyPath: 'id' })
          tallies.createIndex('charKey', 'charKey', { unique: false })
        }
      }

      req.onblocked = () => {
        this.onBlocked?.()
        this.dbPromise = null
        reject(new Error(`IndexedDB "${this.dbName}" open request is blocked by another tab`))
      }

      req.onerror = () => {
        this.dbPromise = null
        reject(req.error ?? new Error(`Failed to open IndexedDB "${this.dbName}"`))
      }

      req.onsuccess = () => {
        const db = req.result
        this.activeDb = db
        db.onversionchange = () => {
          db.close()
          if (this.activeDb === db) {
            this.activeDb = null
          }
          this.dbPromise = null
          this.onVersionChange?.()
        }
        db.onclose = () => {
          if (this.activeDb === db) {
            this.activeDb = null
          }
          this.dbPromise = null
        }
        resolve(db)
      }
    })

    return this.dbPromise
  }

  close(): void {
    if (this.activeDb) {
      this.activeDb.close()
      this.activeDb = null
    }
    this.dbPromise = null
  }

  async loadAll(): Promise<KillStatsSnapshot> {
    const db = await this.openDb()
    return await new Promise<KillStatsSnapshot>((resolve, reject) => {
      const tx = db.transaction(['meta', 'characters', 'tallies'], 'readwrite')
      const metaStore = tx.objectStore('meta')
      const charStore = tx.objectStore('characters')
      const talliesStore = tx.objectStore('tallies')

      let replicaId = ''
      let characters: KillCharacterRecord[] = []
      let tallies: KillTallyRecord[] = []

      const metaReq = metaStore.get('replicaId')
      metaReq.onsuccess = () => {
        const record = metaReq.result as MetaRecord | undefined
        if (record && isValidUuid(record.value)) {
          replicaId = record.value
        } else {
          replicaId = this.generateId()
          metaStore.put({ key: 'replicaId', value: replicaId } satisfies MetaRecord)
        }
      }

      const charsReq = charStore.getAll()
      charsReq.onsuccess = () => {
        characters = (charsReq.result as KillCharacterRecord[]) ?? []
      }

      const talliesReq = talliesStore.getAll()
      talliesReq.onsuccess = () => {
        tallies = (talliesReq.result as KillTallyRecord[]) ?? []
      }

      tx.oncomplete = () => {
        resolve({
          replicaId,
          characters: [...characters].sort((a, b) =>
            a.charKey < b.charKey ? -1 : a.charKey > b.charKey ? 1 : 0,
          ),
          tallies: [...tallies].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
        })
      }
      tx.onerror = () => {
        reject(tx.error ?? new Error('IndexedDB loadAll transaction failed'))
      }
      tx.onabort = () => {
        reject(tx.error ?? new Error('IndexedDB loadAll transaction aborted'))
      }
    })
  }

  async applyBatch(batch: KillStatsBatchInput): Promise<void>
  async applyBatch(
    character: KillCharacterProfile,
    deltas: readonly KillTallyDelta[],
    at?: number,
  ): Promise<void>
  async applyBatch(
    replicaId: string,
    character: KillCharacterProfile,
    deltas: readonly KillTallyDelta[],
    at?: number,
  ): Promise<void>
  async applyBatch(
    arg0: KillStatsBatchInput | KillCharacterProfile | string,
    arg1?: readonly KillTallyDelta[] | KillCharacterProfile,
    arg2?: number | readonly KillTallyDelta[],
    arg3?: number,
  ): Promise<void> {
    const { explicitReplicaId, character, deltas, at } = normalizeApplyBatchArgs(
      arg0,
      arg1,
      arg2,
      arg3,
    )
    const db = await this.openDb()
    const effectiveAt = at ?? this.now()

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['meta', 'characters', 'tallies'], 'readwrite')
      const metaStore = tx.objectStore('meta')
      const charStore = tx.objectStore('characters')
      const talliesStore = tx.objectStore('tallies')

      const metaReq = metaStore.get('replicaId')
      metaReq.onsuccess = () => {
        const record = metaReq.result as MetaRecord | undefined
        let replicaId: string
        if (record && isValidUuid(record.value)) {
          replicaId = record.value
        } else {
          replicaId =
            explicitReplicaId && isValidUuid(explicitReplicaId)
              ? explicitReplicaId
              : this.generateId()
          metaStore.put({ key: 'replicaId', value: replicaId } satisfies MetaRecord)
        }

        const charReq = charStore.get(character.charKey)
        charReq.onsuccess = () => {
          const existingChar = charReq.result as KillCharacterRecord | undefined
          let maxDeltaAt = effectiveAt
          for (const d of deltas) {
            if (d.lastAt > maxDeltaAt) maxDeltaAt = d.lastAt
          }
          const nextChar = upsertCharacterRecord(existingChar, character, maxDeltaAt)
          charStore.put(nextChar)

          for (const delta of deltas) {
            if (delta.count <= 0) continue
            const id = computeTallyId(
              replicaId,
              delta.charKey,
              delta.kind,
              delta.difficulty,
              delta.subject,
            )
            const tallyReq = talliesStore.get(id)
            tallyReq.onsuccess = () => {
              const existingTally = tallyReq.result as KillTallyRecord | undefined
              const nextTally = applyDeltaToTallyRecord(existingTally, replicaId, delta)
              talliesStore.put(nextTally)
            }
          }
        }
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB applyBatch transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB applyBatch transaction aborted'))
    })
  }

  async exportPayload(exportedAt?: number): Promise<KillStatsExportPayload> {
    const snapshot = await this.loadAll()
    return buildExportPayload(snapshot, exportedAt ?? this.now())
  }

  async importPayload(raw: unknown): Promise<KillStatsImportSummary> {
    // Strictly validate the entire payload before opening any write transaction
    const validated = validateImportPayload(raw)
    const db = await this.openDb()

    return await new Promise<KillStatsImportSummary>((resolve, reject) => {
      const tx = db.transaction(['meta', 'characters', 'tallies'], 'readwrite')
      const metaStore = tx.objectStore('meta')
      const charStore = tx.objectStore('characters')
      const talliesStore = tx.objectStore('tallies')

      let replicaId = ''
      let existingChars: KillCharacterRecord[] = []
      let existingTallies: KillTallyRecord[] = []
      let pendingReads = 3
      let summaryResult: KillStatsImportSummary = {
        addedCharacters: 0,
        updatedCharacters: 0,
        addedTallies: 0,
        updatedTallies: 0,
        unchangedTallies: 0,
      }

      const onReadDone = (): void => {
        pendingReads--
        if (pendingReads > 0) return

        const current: KillStatsSnapshot = {
          replicaId,
          characters: existingChars,
          tallies: existingTallies,
        }
        const { next, summary } = mergeImportPayload(current, validated)
        summaryResult = summary

        for (const c of next.characters) {
          charStore.put(c)
        }
        for (const t of next.tallies) {
          talliesStore.put(t)
        }
      }

      const metaReq = metaStore.get('replicaId')
      metaReq.onsuccess = () => {
        const record = metaReq.result as MetaRecord | undefined
        if (record && isValidUuid(record.value)) {
          replicaId = record.value
        } else {
          replicaId = this.generateId()
          metaStore.put({ key: 'replicaId', value: replicaId } satisfies MetaRecord)
        }
        onReadDone()
      }

      const charsReq = charStore.getAll()
      charsReq.onsuccess = () => {
        existingChars = (charsReq.result as KillCharacterRecord[]) ?? []
        onReadDone()
      }

      const talliesReq = talliesStore.getAll()
      talliesReq.onsuccess = () => {
        existingTallies = (talliesReq.result as KillTallyRecord[]) ?? []
        onReadDone()
      }

      tx.oncomplete = () => resolve(summaryResult)
      tx.onerror = () =>
        reject(tx.error ?? new Error('IndexedDB importPayload transaction failed'))
      tx.onabort = () =>
        reject(tx.error ?? new Error('IndexedDB importPayload transaction aborted'))
    })
  }

  private rotateReplicaId(prevReplicaId?: string): string {
    let next = this.generateId()
    if (prevReplicaId && next === prevReplicaId) {
      next = generateReplicaId()
    }
    return next
  }

  async deleteCharacter(charKey: string): Promise<void> {
    const db = await this.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['meta', 'characters', 'tallies'], 'readwrite')
      const metaStore = tx.objectStore('meta')
      const charStore = tx.objectStore('characters')
      const talliesStore = tx.objectStore('tallies')

      charStore.delete(charKey)

      const index = talliesStore.index('charKey')
      const keysReq = index.getAllKeys(IDBKeyRange.only(charKey))
      keysReq.onsuccess = () => {
        const keys = keysReq.result ?? []
        for (const key of keys) {
          talliesStore.delete(key)
        }
      }

      const metaReq = metaStore.get('replicaId')
      metaReq.onsuccess = () => {
        const prev = (metaReq.result as MetaRecord | undefined)?.value
        const nextReplicaId = this.rotateReplicaId(prev)
        metaStore.put({ key: 'replicaId', value: nextReplicaId } satisfies MetaRecord)
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () =>
        reject(tx.error ?? new Error('IndexedDB deleteCharacter transaction failed'))
      tx.onabort = () =>
        reject(tx.error ?? new Error('IndexedDB deleteCharacter transaction aborted'))
    })
  }

  async clearAll(): Promise<void> {
    const db = await this.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['meta', 'characters', 'tallies'], 'readwrite')
      const metaStore = tx.objectStore('meta')
      const charStore = tx.objectStore('characters')
      const talliesStore = tx.objectStore('tallies')

      charStore.clear()
      talliesStore.clear()

      const metaReq = metaStore.get('replicaId')
      metaReq.onsuccess = () => {
        const prev = (metaReq.result as MetaRecord | undefined)?.value
        const nextReplicaId = this.rotateReplicaId(prev)
        metaStore.put({ key: 'replicaId', value: nextReplicaId } satisfies MetaRecord)
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB clearAll transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB clearAll transaction aborted'))
    })
  }
}
