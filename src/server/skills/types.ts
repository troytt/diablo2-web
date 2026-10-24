/**
 * Diablo II: Lord of Destruction v1.13c Skill Module Interface Contracts.
 *
 * Matches `PROJECT.md` Interface Contracts (`src/game/engine/` <-> `src/game/skills/`).
 */
import type { D2DataRegistry, SkillRecord } from '../../common/data/data-registry.ts'
import type { UnitStatList } from '../engine/stat-list.ts'
import type { StateBus } from '../engine/state-bus.ts'
import type { CombatUnitContext } from '../engine/combat-pipeline.ts'
import type { MissileEngine } from '../engine/missile-engine.ts'
import type { AuraScanner } from '../engine/aura-scanner.ts'
import type { SummonManager } from '../ai/summon-manager.ts'

export interface SkillEvalResult {
  readonly skillId: number
  readonly name: string
  readonly charClass: string
  readonly slvl: number
  readonly blvl: number
  /** Human-readable mana cost (and `manaCost256` in 256-fixed-point). */
  readonly manaCost: number
  readonly manaCost256: number
  readonly toHitBonusPct: number
  readonly physDamagePct: number
  /** 128 = 100% weapon damage. */
  readonly srcDam: number
  readonly minPhysDmg: number
  readonly maxPhysDmg: number
  readonly elemType: string
  /** Human-readable elemental/magic/poison damage (and 256-fixed-point). */
  readonly minElemDmg: number
  readonly maxElemDmg: number
  readonly minElemDmg256: number
  readonly maxElemDmg256: number
  readonly durationFrames: number
  readonly radiusSubtiles: number
  readonly missileA: string
  readonly auraState: string
  readonly curseType: number
  readonly summonMon: string
  readonly petMax: number
  readonly synergyBonusPct: number
  readonly cooldownFrames: number
}

export interface SkillEvalContext {
  readonly registry: D2DataRegistry
  readonly skill: SkillRecord
  readonly slvl: number
  readonly blvl: number
  readonly statList: UnitStatList
  readonly stateBus?: StateBus
  readonly difficulty?: 'normal' | 'nightmare' | 'hell' | 0 | 1 | 2 | undefined
}

export type SkillTargetUnit = CombatUnitContext

export interface SkillExecContext {
  readonly registry: D2DataRegistry
  readonly skill: SkillRecord
  readonly evalResult: SkillEvalResult
  readonly caster: CombatUnitContext
  readonly targets: readonly CombatUnitContext[]
  readonly targetPositions: ReadonlyMap<string, { x: number; y: number }>
  readonly corpses: {
    id: string
    consumed: boolean
    baseMaxHp?: number | undefined
    monsterLevel?: number | undefined
    stateId?: number | undefined
    x?: number | undefined
    y?: number | undefined
  }[]
  readonly missileEngine: MissileEngine
  readonly auraScanner: AuraScanner
  readonly summonManager: SummonManager
  readonly currentTick: number
  readonly targetX: number
  readonly targetY: number
  readonly isTown?: boolean | undefined
  readonly allies?: readonly CombatUnitContext[] | undefined
  readonly act?: 1 | 2 | 3 | 4 | 5 | undefined
  readonly actNo?: number | undefined
  readonly levelId?: number | undefined
  readonly difficulty?: 'normal' | 'nightmare' | 'hell' | 0 | 1 | 2 | undefined
  readonly casterPos?: { x: number; y: number } | undefined
  readonly targetPetId?: string | undefined
  readonly targetItem?: { id?: string | number; code?: string; identified?: boolean; name?: string } | undefined
  scrollCount?: number | undefined
  tomeQuantity?: number | undefined
  readonly townPortalSlot?: import('../../common/world/portal.ts').TownPortalSlot | { cast: (p: any) => any; current?: any } | undefined
  readonly rng?: { rand?(n: number): number; roll?(n: number): number } | (() => number) | undefined
}

export interface SkillExecOutcome {
  readonly skillId: number
  readonly name: string
  readonly executed: boolean
  readonly srvDoFuncUsed: number
  readonly manaSpent256: number
  readonly missilesSpawned: string[]
  readonly statesApplied: string[]
  readonly petsSummoned: string[]
  readonly corpsesConsumed: number
  readonly totalDamageDealt: number
  readonly notes: string[]
  readonly error?: string
}

export interface SkillModule {
  readonly skillId: number
  readonly name: string
  /** 'uni' | 'ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass' */
  readonly charClass: string
  readonly srvStFunc: number
  readonly srvDoFunc: number
  evaluate?(ctx: SkillEvalContext): SkillEvalResult
  executeDo?(ctx: SkillExecContext): SkillExecOutcome
}
