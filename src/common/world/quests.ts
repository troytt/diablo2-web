/**
 * Quests and NPCs.
 *
 * Diablo II's quests are a small state machine per act: talk to an NPC to accept,
 * do the thing, talk again to be rewarded. `Quest.txt` holds the names and
 * descriptions (through the string table) and the objective; the dialogue itself
 * lives in code with its text in the TBL. This module models the part that is
 * structural — the states, the objective counter, the reward, and the dialogue
 * *selection* — and leaves the actual lines to the data.
 *
 * The dialogue is chosen by state rather than listed blindly, because that is the
 * behaviour that matters: an NPC who offers a quest already in progress, or who
 * forgets a completed one, is the classic quest bug.
 */
/** One NPC. */
export interface NpcDef {
  /** Table id. */
  readonly id: string
  /** Display name. */
  readonly name: string
  /** The quest this NPC offers, when any. */
  readonly questId: string | null
  /** Lines offered while the quest is available. */
  readonly offerLines: readonly string[]
  /** Lines offered while the quest is in progress. */
  readonly progressLines: readonly string[]
  /** Lines offered once the quest is done. */
  readonly doneLines: readonly string[]
}

/** One quest. */
export interface QuestDef {
  /** Table id. */
  readonly id: string
  /** Display name. */
  readonly name: string
  /** Description, for the quest log. */
  readonly description: string
  /** Monster id to kill, or `*` for any. */
  readonly monsterId: string
  /** How many kills complete it. */
  readonly killCount: number
  /** Experience awarded on completion. */
  readonly rewardXp: number
  /** Gold awarded on completion. */
  readonly rewardGold: number
}

/** A quest's live state. */
export interface QuestProgress {
  /** The definition. */
  readonly def: QuestDef
  /** Where it stands. */
  status: 'inactive' | 'active' | 'complete'
  /** Kills recorded so far. */
  kills: number
}

/** Raised when a quest id is used that the log does not know. */
export class QuestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuestError'
  }
}

/** A reward handed out when a quest completes. */
export interface QuestReward {
  /** Quest that completed. */
  readonly questId: string
  /** Experience awarded. */
  readonly xp: number
  /** Gold awarded. */
  readonly gold: number
}

/**
 * The player's quest log.
 */
export class QuestLog {
  private readonly progress = new Map<string, QuestProgress>()

  /**
   * @param quests - the quests the log tracks.
   */
  constructor(quests: readonly QuestDef[] = []) {
    for (const quest of quests) {
      this.progress.set(quest.id, { def: quest, status: 'inactive', kills: 0 })
    }
  }

  /**
   * Rebuild a log from saved progress.
   *
   * @param quests - the quest definitions.
   * @param states - saved status and counters, matched by id.
   * @returns the log.
   */
  static restore(
    quests: readonly QuestDef[],
    states: readonly { readonly id: string; readonly status: QuestProgress['status']; readonly kills: number }[],
  ): QuestLog {
    const log = new QuestLog(quests)
    for (const saved of states) {
      const entry = log.progress.get(saved.id)
      if (entry !== undefined) {
        entry.status = saved.status
        entry.kills = Math.max(0, saved.kills)
      } else if (saved.id.startsWith('boss_kill:')) {
        const parts = saved.id.split(':')
        const monsterId = parts.slice(2).join(':') || saved.id
        log.progress.set(saved.id, {
          def: {
            id: saved.id,
            name: `Boss First Kill (${monsterId})`,
            description: '',
            monsterId,
            killCount: 1,
            rewardXp: 0,
            rewardGold: 0,
          },
          status: saved.status,
          kills: Math.max(0, saved.kills),
        })
      }
    }
    return log
  }

  /** Every quest's progress, in table order. */
  get all(): readonly QuestProgress[] {
    return [...this.progress.values()]
  }

  /** The quests currently in progress. */
  get active(): readonly QuestProgress[] {
    return this.all.filter(entry => entry.status === 'active')
  }

  /**
    * Read one quest's progress.
    *
    * @param id - the quest id.
    * @returns the progress, or undefined when unknown.
    */
  get(id: string): QuestProgress | undefined {
    return this.progress.get(id)
  }

  /**
    * Accept a quest.
    *
    * @param id - the quest id.
    * @returns true when it moved from inactive to active.
    */
  accept(id: string): boolean {
    const entry = this.progress.get(id)
    if (entry === undefined) throw new QuestError(`unknown quest "${id}"`)
    if (entry.status !== 'inactive') return false
    entry.status = 'active'
    return true
  }

  /**
    * Record a kill, advancing every active quest that wants that monster.
    *
    * @param monsterId - the monster's table id.
    * @returns the quests this kill completed.
    */
  recordKill(monsterId: string): QuestReward[] {
    const rewards: QuestReward[] = []
    for (const entry of this.progress.values()) {
      if (entry.status !== 'active') continue
      const wanted = entry.def.monsterId
      // `*` means any monster, which is how a "kill N of anything" quest reads.
      if (wanted !== '*' && wanted !== monsterId) continue
      entry.kills += 1
      if (entry.kills >= entry.def.killCount) {
        entry.status = 'complete'
        rewards.push({ questId: entry.def.id, xp: entry.def.rewardXp, gold: entry.def.rewardGold })
      }
    }
    return rewards
  }

  /**
   * Checks whether an Act Boss's quest first-kill has already been completed
   * on the given difficulty (either via an explicit QuestDef targeting monsterId
   * or a persisted boss_kill:<difficulty>:<monsterId> entry).
   */
  isBossFirstKillCompleted(arg1: string, arg2: string = 'normal'): boolean {
    const a1 = arg1.trim().toLowerCase()
    const a2 = arg2.trim().toLowerCase()
    const isFirstDiff = a1 === 'normal' || a1 === 'nightmare' || a1 === 'hell'
    const normalizedId = isFirstDiff ? a2 : a1
    const diff = isFirstDiff ? a1 : (a2 || 'normal')
    if (!normalizedId) return false
    const key = `boss_kill:${diff}:${normalizedId}`
    const synthetic = this.progress.get(key)
    if (synthetic?.status === 'complete') {
      return true
    }
    for (const entry of this.progress.values()) {
      if (
        !entry.def.id.startsWith('boss_kill:') &&
        entry.def.monsterId.toLowerCase() === normalizedId &&
        entry.status === 'complete'
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Marks an Act Boss's quest first-kill as completed on the given difficulty,
   * persisting it in `this.progress` so `save.ts` serializes it across sessions.
   */
  markBossFirstKillCompleted(arg1: string, arg2: string = 'normal'): void {
    const a1 = arg1.trim().toLowerCase()
    const a2 = arg2.trim().toLowerCase()
    const isFirstDiff = a1 === 'normal' || a1 === 'nightmare' || a1 === 'hell'
    const normalizedId = isFirstDiff ? a2 : a1
    const diff = isFirstDiff ? a1 : (a2 || 'normal')
    if (!normalizedId) return
    const key = `boss_kill:${diff}:${normalizedId}`
    const existing = this.progress.get(key)
    if (existing) {
      existing.status = 'complete'
      existing.kills = Math.max(1, existing.kills + 1)
      return
    }
    this.progress.set(key, {
      def: {
        id: key,
        name: `Boss First Kill (${normalizedId})`,
        description: '',
        monsterId: normalizedId,
        killCount: 1,
        rewardXp: 0,
        rewardGold: 0,
      },
      status: 'complete',
      kills: 1,
    })
  }
}

/**
 * The lines an NPC says right now.
 *
 * @param npc - the NPC.
 * @param log - the quest log.
 * @returns the lines, empty when there is nothing to say.
 */
export function npcDialog(npc: NpcDef, log: QuestLog): string[] {
  if (npc.questId === null) return [...npc.offerLines]
  const entry = log.get(npc.questId)
  if (entry === undefined) return [...npc.offerLines]
  switch (entry.status) {
    case 'inactive': return [...npc.offerLines]
    case 'active': return [...npc.progressLines]
    case 'complete': return [...npc.doneLines]
    /* v8 ignore next -- the status union is closed above. */
    default: return []
  }
}

export {
  HELLFORGE_RUNES_BY_DIFFICULTY,
  HELLFORGE_NORMAL_GEMS,
  HELLFORGE_FLAWLESS_GEMS,
  HELLFORGE_PERFECT_GEMS,
  type HellforgeDropResult,
  rollHellforgeDrop,
} from '../items/drop-tables.ts'
