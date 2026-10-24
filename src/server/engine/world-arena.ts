/**
 * Diablo II: Lord of Destruction v1.13c Deterministic Skill Verification Arena (`WorldArena`).
 *
 * Pre-spawns:
 * - Player Unit configured to any of the 7 classes (`ama`, `sor`, `nec`, `pal`, `bar`, `dru`, `ass`),
 *   with exact 1.13c `UnitStatList`, `StateBus`, and `AnimDispatcher`.
 * - 4 Target Dummies (`dummy-normal`, `dummy-undead`, `dummy-demon`, `dummy-immune`)
 *   and 3 Targetable Monster Corpses (`corpse-1`, `corpse-2`, `corpse-3`).
 * - Exposes the `ArenaDebugState` (`__d2webArena`) inspection & `triggerCast()` API.
 */
import type { D2DataRegistry } from '../../common/data/data-registry.ts'
import { FIXED_ONE, UnitStatList } from './stat-list.ts'
import { StateBus } from './state-bus.ts'
import type { CombatUnitContext } from './combat-pipeline.ts'
import { AnimDispatcher } from './anim-dispatcher.ts'
import { MissileEngine } from './missile-engine.ts'
import { AuraScanner } from './aura-scanner.ts'
import { SummonManager } from '../ai/summon-manager.ts'
import { evaluateSkill113c, executeSkill113c } from '../skills/registry.ts'
import type { SkillEvalResult, SkillExecOutcome } from '../skills/types.ts'
import { resolvePlayerCharToken } from '../../common/units/classes.ts'
import { MISSILE_SUBTILE_FLAT_PX } from './missile-engine.ts'

/** 2:1 isometric ground squash of the arena's missile-space `targetPositions` (y axis). */
const ARENA_ISO_GROUND_ASPECT_RATIO = 0.5

/**
 * Arena missile-space position (player at the origin) -> sub-tile coordinates on the unit context,
 * which the 1.13c aura scan 0x6FCC0C70 measures (`dx² + dy² <= r²` in sub-tiles).
 */
function arenaPxToSubtiles(pos: { x: number; y: number }): { x: number; y: number } {
  return {
    x: pos.x / MISSILE_SUBTILE_FLAT_PX,
    y: pos.y / ARENA_ISO_GROUND_ASPECT_RATIO / MISSILE_SUBTILE_FLAT_PX,
  }
}

export interface ArenaDebugState {
  ready: boolean
  classCode: string // 'ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass'
  charToken: string // 'am' | 'so' | 'ne' | 'pa' | 'ba' | 'dz' | 'ai'
  skillId: number
  skillName: string
  slvl: number
  tick: number
  castCount: number
  actionFrameTriggered: boolean
  playerAnimMode: string
  playerAnimFrame: number
  activeStates: string[]
  activeOverlays: string[]
  missilesSpawned: number
  missilesActive: { id: string; celFile: string; x: number; y: number }[]
  petsActive: { monId: string; code: string; petType: string; hp: number }[]
  corpsesRemaining: number
  totalDamageDealt: number
  targetLog: {
    targetId: string
    hp: number
    maxHp: number
    states: string[]
    lastDamage: number
  }[]
  tooltipStats: {
    minDmg: number
    maxDmg: number
    manaCost: number
    toHit: number
    radius: number
    durationFrames: number
  }
  triggerCast: (targetX?: number, targetY?: number) => SkillExecOutcome | null
  stepTicks: (count: number) => void
}

export class WorldArena {
  readonly registry: D2DataRegistry
  readonly classCode: string
  readonly charToken: string
  readonly skillId: number
  readonly slvl: number
  readonly player: CombatUnitContext
  readonly targets: CombatUnitContext[] = []
  readonly allies: CombatUnitContext[] = []
  readonly targetPositions = new Map<string, { x: number; y: number }>()
  readonly corpses: { id: string; consumed: boolean; baseMaxHp: number; x: number; y: number }[] = []
  readonly animDispatcher: AnimDispatcher
  readonly missileEngine: MissileEngine
  readonly auraScanner: AuraScanner
  readonly summonManager: SummonManager

  isTown = false
  tickCount = 0
  castCount = 0
  actionFrameTriggered = false
  totalMissilesSpawned = 0
  totalDamageDealt = 0
  lastOutcome: SkillExecOutcome | null = null
  lastEval: SkillEvalResult

  constructor(params: {
    registry: D2DataRegistry
    classCode?: string
    skillId: number
    slvl?: number
    blvl?: number
    synergies?: readonly [number, number][]
    isTown?: boolean
  }) {
    this.registry = params.registry
    this.skillId = params.skillId
    this.isTown = params.isTown ?? false
    this.slvl = Math.max(1, params.slvl ?? 20)
    const blvl = Math.max(1, params.blvl ?? this.slvl)

    const skillRec = this.registry.getSkillById(this.skillId) ?? this.registry.getSkillById(0)!
    this.classCode = (params.classCode || skillRec.charClass || 'sor').toLowerCase()
    this.charToken = resolvePlayerCharToken(this.classCode)

    const playerStats = new UnitStatList(this.registry, {
      level: 85,
      strength: 150,
      dexterity: 150,
      vitality: 200,
      energy: 200,
      maxhp: 2500 * FIXED_ONE,
      hitpoints: 2500 * FIXED_ONE,
      maxmana: 2500 * FIXED_ONE,
      mana: 2500 * FIXED_ONE,
      tohit: 8000,
      armorclass: 1200,
    })
    playerStats.setBaseSkillLevel(this.skillId, blvl)
    if (this.slvl > blvl) {
      playerStats.setBonusSkillLevel(this.skillId, this.slvl - blvl)
    }
    if (params.synergies) {
      for (const [synId, synBlvl] of params.synergies) {
        playerStats.setBaseSkillLevel(synId, synBlvl)
      }
    }

    const playerStateBus = new StateBus(playerStats, this.registry)
    this.player = {
      id: 'player',
      name: `Hero_${this.classCode.toUpperCase()}`,
      statList: playerStats,
      stateBus: playerStateBus,
      isDualClaw: this.classCode === 'ass',
      hasShield: this.classCode === 'pal',
      weaponMinPhys: 45,
      weaponMaxPhys: 85,
      // The arena player stands at the origin (sub-tile 0,0) for radius scans.
      x: 0,
      y: 0,
    }

    // If the skill requires shapeshift (`restrict === 2`: Feral Rage, Maul, Rabies, Fire Claws, Hunger, Shock Wave, Fury),
    // automatically enter Werewolf/Werebear form so it can be cast immediately in the arena
    if (skillRec.restrict === 2) {
      const form = skillRec.id === 233 || skillRec.id === 243 ? 'bear' : 'wolf'
      playerStateBus.applyState({ stateNameOrId: form, slvl: 20, durationFrames: 5000 })
    }

    this.animDispatcher = new AnimDispatcher({
      registry: this.registry,
      statList: playerStats,
      stateBus: playerStateBus,
      charToken: this.charToken,
      weaponClass:
        this.classCode === 'ama'
          ? 'bow'
          : this.classCode === 'ass'
            ? 'h2h'
            : this.classCode === 'pal' || this.classCode === 'bar'
              ? '1hs'
              : 'hth',
    })
    this.missileEngine = new MissileEngine(this.registry)
    this.auraScanner = new AuraScanner(this.registry)
    this.summonManager = new SummonManager(this.registry)

    // When testing Unsummon (Skill 3) in the arena, pre-spawn a valid unsummonable minion
    // owned by the player so that triggerCast() has a real pet to dismiss.
    if (this.skillId === 3) {
      this.summonManager.createPet({
        owner: this.player,
        skillId: 75, // Clay Golem (unsummon = 1)
        slvl: 1,
      })
    }

    // Spawn Target Dummy Cluster:
    // 1. `dummy-normal`: Normal Beast Monster (10,000 HP, 0% resists)
    this.spawnDummy('dummy-normal', 'Fallen Dummy', { x: 0, y: 110 }, { isUndead: false, isDemon: false, res: 0 })
    // 2. `dummy-undead`: Undead Monster (10,000 HP, Undead=true)
    this.spawnDummy('dummy-undead', 'Skeleton Dummy', { x: -65, y: 115 }, { isUndead: true, isDemon: false, res: 0 })
    // 3. `dummy-demon`: Demon Monster (10,000 HP, Demon=true)
    this.spawnDummy('dummy-demon', 'Balrog Dummy', { x: 65, y: 115 }, { isUndead: false, isDemon: true, res: 0 })
    // 4. `dummy-immune`: Elemental Immune Monster (10,000 HP, 110% resists)
    this.spawnDummy('dummy-immune', 'Immune Dummy', { x: 130, y: 120 }, { isUndead: false, isDemon: true, res: 110 })

    // Spawn 3 Targetable Monster Corpses (`corpse-1..3`)
    this.corpses.push(
      { id: 'corpse-1', consumed: false, baseMaxHp: 1200, x: -35, y: 80 },
      { id: 'corpse-2', consumed: false, baseMaxHp: 1200, x: 0, y: 80 },
      { id: 'corpse-3', consumed: false, baseMaxHp: 1200, x: 35, y: 80 },
    )

    this.lastEval = evaluateSkill113c({
      registry: this.registry,
      skill: skillRec,
      slvl: this.slvl,
      blvl: playerStats.getBaseSkillLevel(this.skillId),
      statList: playerStats,
      stateBus: playerStateBus,
    })
  }

  private spawnDummy(
    id: string,
    name: string,
    pos: { x: number; y: number },
    opts: { isUndead: boolean; isDemon: boolean; res: number },
  ): void {
    const st = new UnitStatList(this.registry, {
      level: 80,
      maxhp: 10000 * FIXED_ONE,
      hitpoints: 10000 * FIXED_ONE,
      armorclass: 400,
      fireresist: opts.res,
      lightresist: opts.res,
      coldresist: opts.res,
      poisonresist: opts.res,
      magicresist: 0,
      damageresist: 0,
    })
    const sb = new StateBus(st, this.registry)
    const dummy: CombatUnitContext = {
      id,
      name,
      statList: st,
      stateBus: sb,
      isUndead: opts.isUndead,
      isDemon: opts.isDemon,
      ...arenaPxToSubtiles(pos),
    }
    this.targets.push(dummy)
    this.targetPositions.set(id, pos)
  }

  addDummyAlly(
    id: string,
    name: string,
    pos: { x: number; y: number } = { x: 0, y: 0 },
    opts: { unitType?: 'mercenary' | 'party' | 'party_mercenary' | 'minion' } = {},
  ): CombatUnitContext {
    const st = new UnitStatList(this.registry, {
      level: 80,
      hitpoints: 1000 * FIXED_ONE,
      maxhp: 1000 * FIXED_ONE,
      armorclass: 500,
    })
    const sb = new StateBus(st, this.registry)
    const ally: CombatUnitContext = {
      id,
      name,
      statList: st,
      stateBus: sb,
      unitType: opts.unitType ?? 'mercenary',
      ...arenaPxToSubtiles(pos),
    }
    this.allies.push(ally)
    return ally
  }

  /**
   * Cast or activate `this.skillId` (or an explicit `overrideSkillId`), stepping through
   * the `AnimData.d2` action frame and missile/pet ticks so gameplay effects take place immediately.
   */
  triggerCast(targetX = 0, targetY = 110, overrideSkillId?: number): SkillExecOutcome {
    const idToCast = overrideSkillId ?? this.skillId
    const skillRec = this.registry.getSkillById(idToCast) ?? this.registry.getSkillById(0)!
    const effSlvl = Math.max(1, this.player.statList.getEffectiveSkillLevel(idToCast) || this.slvl)
    const effBlvl = this.player.statList.getBaseSkillLevel(idToCast) || effSlvl

    // Ensure infinite mana refill in arena before casting
    this.player.statList.setMana256(this.player.statList.getMaxMana256())

    const evalRes = evaluateSkill113c({
      registry: this.registry,
      skill: skillRec,
      slvl: effSlvl,
      blvl: effBlvl,
      statList: this.player.statList,
      stateBus: this.player.stateBus,
    })
    this.lastEval = evalRes

    let outcome: SkillExecOutcome | null = null

    if (skillRec.passive || skillRec.aura) {
      this.actionFrameTriggered = true
      this.castCount += 1
      outcome = executeSkill113c({
        registry: this.registry,
        skill: skillRec,
        evalResult: evalRes,
        caster: this.player,
        targets: this.targets,
        targetPositions: this.targetPositions,
        corpses: this.corpses,
        missileEngine: this.missileEngine,
        auraScanner: this.auraScanner,
        summonManager: this.summonManager,
        currentTick: this.tickCount,
        targetX,
        targetY,
        isTown: this.isTown,
        allies: [this.player, ...this.allies],
      })
    } else {
      const attempt = this.animDispatcher.startSkillAnimation({
        skill: skillRec,
        slvl: effSlvl,
        currentTick: this.tickCount,
        targetX,
        targetY,
      })

      if (attempt.allowed) {
        // Step animation until action frame fires
        for (let i = 0; i < 25; i += 1) {
          this.tickCount += 1
          const step = this.animDispatcher.tick(this.tickCount, (_anim, tick) => {
            this.actionFrameTriggered = true
            this.castCount += 1
            outcome = executeSkill113c({
              registry: this.registry,
              skill: skillRec,
              evalResult: evalRes,
              caster: this.player,
              targets: this.targets,
              targetPositions: this.targetPositions,
              corpses: this.corpses,
              missileEngine: this.missileEngine,
              auraScanner: this.auraScanner,
              summonManager: this.summonManager,
              currentTick: tick,
              targetX,
              targetY,
              isTown: this.isTown,
              allies: [this.player, ...this.allies],
            })
          })
          if (step.actionFired) break
        }
      }

      if (!outcome) {
        // Fallback immediate execution if skill was on cooldown
        this.actionFrameTriggered = true
        this.castCount += 1
        outcome = executeSkill113c({
          registry: this.registry,
          skill: skillRec,
          evalResult: evalRes,
          caster: this.player,
          targets: this.targets,
          targetPositions: this.targetPositions,
          corpses: this.corpses,
          missileEngine: this.missileEngine,
          auraScanner: this.auraScanner,
          summonManager: this.summonManager,
          currentTick: this.tickCount,
          targetX,
          targetY,
          isTown: this.isTown,
          allies: [this.player, ...this.allies],
        })
      }
    }

    this.totalMissilesSpawned += outcome.missilesSpawned.length
    this.totalDamageDealt += outcome.totalDamageDealt
    this.lastOutcome = outcome

    // Step 12 simulation ticks so spawned missiles/pets/auras travel and impact dummies
    this.stepTicks(12)

    return outcome
  }

  /**
   * Advance the simulation arena by `count` ticks (`25 Hz`).
   */
  stepTicks(count: number): void {
    const steps = Math.max(0, Math.trunc(count))
    for (let i = 0; i < steps; i += 1) {
      this.tickCount += 1
      this.player.stateBus.tick(this.tickCount)
      for (const t of this.targets) {
        t.stateBus.tick(this.tickCount)
      }
      for (const a of this.allies) {
        a.stateBus.tick(this.tickCount)
      }

      const mStep = this.missileEngine.tick(this.tickCount, this.targets, this.targetPositions)
      for (const h of mStep.hits) {
        this.totalDamageDealt += h.damage
      }
      this.totalMissilesSpawned += mStep.subMissilesSpawned.length

      const auraStep = this.auraScanner.tick(
        this.tickCount,
        [this.player, ...this.allies],
        this.targets,
        this.corpses,
        { isTown: this.isTown },
      )
      for (const a of auraStep) {
        this.totalDamageDealt += a.pulseDamageDealt
      }

      const petStep = this.summonManager.tickPets({
        currentTick: this.tickCount,
        owner: this.player,
        allies: this.allies,
        enemies: this.targets,
        enemyPositions: this.targetPositions,
        corpses: this.corpses,
        missileEngine: this.missileEngine,
        auraScanner: this.auraScanner,
      })
      this.totalDamageDealt += petStep.damageDealt
    }
  }

  /**
   * Return the complete `ArenaDebugState` snapshot for `__d2webArena` & automated tests.
   */
  getDebugState(): ArenaDebugState {
    const anim = this.animDispatcher.getCurrentAnimation()
    const skillRec = this.registry.getSkillById(this.skillId) ?? this.registry.getSkillById(0)!
    const activeStates = new Set<string>(this.player.stateBus.getActiveStateNames())
    const activeOverlays = new Set<string>(this.player.stateBus.getActiveOverlays())

    for (const t of this.targets) {
      for (const st of t.stateBus.getActiveStateNames()) activeStates.add(st)
      for (const ov of t.stateBus.getActiveOverlays()) activeOverlays.add(ov)
    }
    if (skillRec.castOverlay) activeOverlays.add(skillRec.castOverlay)
    if (skillRec.cltOverlayA) activeOverlays.add(skillRec.cltOverlayA)

    const targetLog = this.targets.map(t => {
      const maxHp = t.statList.getMaxHp()
      const hp = t.statList.getHp()
      return {
        targetId: t.id,
        hp,
        maxHp,
        states: t.stateBus.getActiveStateNames(),
        lastDamage: Math.max(0, maxHp - hp),
      }
    })

    const minDmg = Math.max(this.lastEval.minElemDmg, this.lastEval.minPhysDmg)
    const maxDmg = Math.max(this.lastEval.maxElemDmg, this.lastEval.maxPhysDmg)

    return {
      ready: true,
      classCode: this.classCode,
      charToken: this.charToken,
      skillId: this.skillId,
      skillName: skillRec.name,
      slvl: this.slvl,
      tick: this.tickCount,
      castCount: this.castCount,
      actionFrameTriggered: this.actionFrameTriggered,
      playerAnimMode: anim ? anim.skill.anim || 'SC' : skillRec.anim || 'SC',
      playerAnimFrame: anim ? anim.currentFrame : 6,
      activeStates: Array.from(activeStates),
      activeOverlays: Array.from(activeOverlays),
      missilesSpawned: this.totalMissilesSpawned,
      missilesActive: this.missileEngine.getActiveMissiles().map(m => ({
        id: m.uid,
        celFile: m.celFile,
        x: Math.round(m.x),
        y: Math.round(m.y),
      })),
      petsActive: this.summonManager.getActivePets().map(p => ({
        monId: p.monId,
        code: p.code,
        petType: p.petType,
        hp: p.hp,
      })),
      corpsesRemaining: this.corpses.filter(c => !c.consumed).length,
      totalDamageDealt: this.totalDamageDealt,
      targetLog,
      tooltipStats: {
        minDmg,
        maxDmg,
        manaCost: this.lastEval.manaCost,
        toHit: this.lastEval.toHitBonusPct,
        radius: this.lastEval.radiusSubtiles,
        durationFrames: this.lastEval.durationFrames,
      },
      triggerCast: (tx?: number, ty?: number) => this.triggerCast(tx, ty),
      stepTicks: (cnt: number) => this.stepTicks(cnt),
    }
  }
}
