import type { LootItem } from './loot-item.ts'
import { characterBuild } from './character-build.ts'
import type { AppraisalContext } from './loot-appraisal.ts'
import KNOWLEDGE from './data/loot-knowledge.json'

const [STRENGTH, DEXTERITY] = [0, 2]

export interface CharacterView {
  readonly self: {
    readonly charClass: number | null
    readonly level: number
    readonly stats: { get(statId: number): number }
    readonly skillEntries: ReadonlyMap<number, { readonly skillId: number; readonly level: number; readonly baseLevel?: number | undefined }>
  }
  readonly containers: {
    readonly equipment: ReadonlyMap<number, LootItem>
    readonly inventory: ReadonlyMap<number, LootItem>
    readonly stash: ReadonlyMap<number, LootItem>
    readonly cube: ReadonlyMap<number, LootItem>
    readonly revision?: number | undefined
  }
  readonly quests?: ArrayLike<number> | undefined
}

const NEUTRAL: AppraisalContext = { build: characterBuild({ classIndex: -1, level: 1, strength: 0, dexterity: 0, skillPoints: new Map() }), equipped: [], owned: [] }

const cache = new WeakMap<object, { readonly key: string; readonly context: AppraisalContext }>()

export function appraisalContextOf(view: Partial<CharacterView> | null | undefined): AppraisalContext {
  if (!view?.self || !view.containers) return NEUTRAL
  const { self, containers } = view
  const skillPoints = new Map([...self.skillEntries.values()].map((skill) => [skill.skillId, skill.baseLevel ?? skill.level]))
  const sheet = { classIndex: self.charClass ?? -1, level: Math.max(1, self.level), strength: self.stats.get(STRENGTH), dexterity: self.stats.get(DEXTERITY), skillPoints }
  const imbueReady = ((view.quests?.[KNOWLEDGE.imbue.questWord] ?? 0) & KNOWLEDGE.imbue.rewardPending) !== 0
  const key = `${containers.revision ?? -1}|${imbueReady}|${JSON.stringify({ ...sheet, skillPoints: [...skillPoints] })}`
  const hit = cache.get(view)
  if (hit?.key === key) return hit.context
  const context: AppraisalContext = {
    build: characterBuild(sheet),
    equipped: [...containers.equipment.values()],
    owned: [...containers.inventory.values(), ...containers.stash.values(), ...containers.cube.values()],
    carried: [...containers.inventory.values()],
    imbueReady,
  }
  cache.set(view, { key, context })
  return context
}
