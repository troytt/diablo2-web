/**
 * Unit State Set (`src/client/world/states.ts`).
 *
 * Tracks active 1.13c `States.txt` IDs (`0..183`) on a unit from `0xA7` (DelayedState),
 * `0xA8` (SetState), `0xA9` (EndState), and `0xAA` (AddUnit state bitmasks).
 */

import type { ItemStat } from '../../netproto/index.ts'

export class UnitStateSet {
  private readonly active = new Set<number>()
  private readonly stateStatLists = new Map<number, readonly ItemStat[]>()

  has(stateId: number): boolean {
    return this.active.has(stateId)
  }

  add(stateId: number, stats?: readonly ItemStat[]): void {
    this.active.add(stateId)
    if (stats !== undefined) {
      this.stateStatLists.set(stateId, stats)
    }
  }

  remove(stateId: number): void {
    this.active.delete(stateId)
    this.stateStatLists.delete(stateId)
  }

  replaceAll(states: readonly number[]): void {
    this.active.clear()
    for (const s of states) {
      this.active.add(s)
    }
  }

  getStateStats(stateId: number): readonly ItemStat[] | undefined {
    return this.stateStatLists.get(stateId)
  }

  values(): ReadonlySet<number> {
    return this.active
  }

  list(): number[] {
    return Array.from(this.active).sort((a, b) => a - b)
  }

  [Symbol.iterator](): IterableIterator<number> {
    return this.active.values()
  }

  get size(): number {
    return this.active.size
  }

  clear(): void {
    this.active.clear()
    this.stateStatLists.clear()
  }
}
