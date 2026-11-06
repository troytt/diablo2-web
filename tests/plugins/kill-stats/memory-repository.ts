/**
 * In-memory `KillStatsRepository` implementation for unit & integration tests.
 * Reuses pure functions from `plugins/kill-stats/kill-stats-model.ts`.
 */

import {
  applyDeltasToState,
  buildExportPayload,
  generateReplicaId,
  mergeImportPayload,
  validateImportPayload,
  type KillCharacterProfile,
  type KillStatsExportPayload,
  type KillStatsImportSummary,
  type KillStatsSnapshot,
  type KillTallyDelta,
} from '../../../plugins/kill-stats/kill-stats-model.ts'
import {
  normalizeApplyBatchArgs,
  type KillStatsBatchInput,
  type KillStatsRepository,
} from '../../../plugins/kill-stats/kill-stats-store.ts'

export interface MemoryKillStatsRepositoryOptions {
  readonly initialReplicaId?: string | undefined
  readonly now?: (() => number) | undefined
  readonly generateId?: (() => string) | undefined
}

export class MemoryKillStatsRepository implements KillStatsRepository {
  private state: KillStatsSnapshot
  private readonly now: () => number
  private readonly generateId: () => string
  public failNextApplyCount = 0
  public failApplyError: Error = new Error('Simulated repository write failure')
  public applyCallCount = 0

  constructor(options: MemoryKillStatsRepositoryOptions = {}) {
    this.now = options.now ?? (() => Date.now())
    this.generateId = options.generateId ?? (() => generateReplicaId())
    this.state = {
      replicaId: options.initialReplicaId ?? this.generateId(),
      characters: [],
      tallies: [],
    }
  }

  getSnapshotSync(): KillStatsSnapshot {
    return this.state
  }

  async loadAll(): Promise<KillStatsSnapshot> {
    return this.state
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
    this.applyCallCount++
    if (this.failNextApplyCount > 0) {
      this.failNextApplyCount--
      throw this.failApplyError
    }
    const { explicitReplicaId, character, deltas, at } = normalizeApplyBatchArgs(
      arg0,
      arg1,
      arg2,
      arg3,
    )
    const baseState: KillStatsSnapshot =
      explicitReplicaId && !this.state.replicaId
        ? { ...this.state, replicaId: explicitReplicaId }
        : this.state
    this.state = applyDeltasToState(baseState, character, deltas, at ?? this.now())
  }

  async exportPayload(exportedAt?: number): Promise<KillStatsExportPayload> {
    return buildExportPayload(this.state, exportedAt ?? this.now())
  }

  async importPayload(raw: unknown): Promise<KillStatsImportSummary> {
    const validated = validateImportPayload(raw)
    const { next, summary } = mergeImportPayload(this.state, validated)
    this.state = next
    return summary
  }

  private rotateReplicaId(): string {
    let next = this.generateId()
    if (next === this.state.replicaId) {
      next = generateReplicaId()
    }
    return next
  }

  async deleteCharacter(charKey: string): Promise<void> {
    const nextReplicaId = this.rotateReplicaId()
    this.state = {
      replicaId: nextReplicaId,
      characters: this.state.characters.filter((c) => c.charKey !== charKey),
      tallies: this.state.tallies.filter((t) => t.charKey !== charKey),
    }
  }

  async clearAll(): Promise<void> {
    const nextReplicaId = this.rotateReplicaId()
    this.state = {
      replicaId: nextReplicaId,
      characters: [],
      tallies: [],
    }
  }
}
