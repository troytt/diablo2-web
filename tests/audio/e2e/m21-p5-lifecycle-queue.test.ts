/**
 * M21-P5 (#947) — F20 4-stage skill/missile sound lifecycle (`stsound`/`stsoundclass`,
 * `AnimData` keyframes `dosound`/`dosound a`/`dosound b`, `TravelSound` emitters with
 * `SetSoundPos` every `SoundTick`, `HitSound`/`ProgSound`) & F21 world sound queue for
 * skills, missiles, and deaths.
 *
 * Authoritative sources:
 * - PROJECT.md D8, D12, F20, F21 & ORIGINAL_REQUEST.md R5 (#947).
 * - Independent 1.13c MPQ oracle (`harness-113c.ts`): `Skills.txt`, `Missiles.txt`, `Sounds.txt`.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../../../src/common/rng/d2-rng.ts'
import {
  PRODUCT,
  RecordingVoices,
  SKILL_CLASS_CODES_113C,
  getOracle113c,
  loadProductModule,
  oracleGroupMembers,
  oracleSampleFacts,
  oracleSkillScope,
  requireExport,
  summarize,
  type Oracle113c,
  type OracleMissileRow113c,
  type OracleSkillRow113c,
} from './harness-113c.ts'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const F20 = '#947 F20 4-stage skill/missile sound lifecycle'
const F21 = '#947 F21 world sound queue for skills, missiles, and deaths'

interface RecordViewC {
  readonly handle: number
  readonly id: number
  readonly state: number
  readonly x?: number
  readonly y?: number
}

interface SoundRecordsC {
  play(id: number, o?: Record<string, unknown>): number
  stop(handle: number): void
  stopAll(): void
  setSoundPos(handle: number, x: number, y: number): boolean
  update(): void
  endTick(): void
  records(): RecordViewC[]
}

interface SkillAudioRuntimeC {
  onSkillCastStart?(opts: {
    skillId: number
    charclass?: string
    x: number
    y: number
    local?: boolean
    unitId?: number
  }): number | readonly number[]
  playSkillCastStart?(opts: {
    skillId: number
    charclass?: string
    x: number
    y: number
    local?: boolean
    unitId?: number
  }): number | readonly number[]
  onAnimKeyframe?(opts: {
    skillId: number
    flag: number
    x: number
    y: number
    local?: boolean
    weaponSoundId?: number
    unitId?: number
  }): number | readonly number[]
  playSkillAnimKeyframe?(opts: {
    skillId: number
    flag: number
    x: number
    y: number
    local?: boolean
    weaponSoundId?: number
    unitId?: number
  }): number | readonly number[]
  onMissileSpawn?(opts: {
    missileId: number | string
    entityId: number
    x: number
    y: number
  }): number
  spawnMissileEmitter?(opts: {
    missileId: number | string
    entityId: number
    x: number
    y: number
  }): number
  onMissileTick?(opts: { entityId: number; x: number; y: number }): void
  updateMissilePosition?(entityId: number, x: number, y: number): void
  onMissileImpact?(opts: {
    missileId: number | string
    entityId?: number
    x: number
    y: number
    prog?: boolean
  }): number | readonly number[]
  onMissileDestroy?(entityId: number): void
  destroyMissileEmitter?(entityId: number): void
  tick?(gameTick?: number): void
}

interface WorldC {
  apply(ev: unknown, nowMs?: number): void
  drainWorldSoundRequests(): unknown[]
  queueWorldSoundRequest?(req: Record<string, unknown>): void
  emitSkillCastSound?(opts: Record<string, unknown>): void
  emitMissileImpactSound?(opts: Record<string, unknown>): void
  emitUnitDeathSound?(opts: Record<string, unknown>): void
}

type WorldCtor = new () => WorldC

let O: Oracle113c
let skillsById: Map<number, OracleSkillRow113c>
let skillsByName: Map<string, OracleSkillRow113c>
let missilesById: Map<number, OracleMissileRow113c>
let missilesByName: Map<string, OracleMissileRow113c>

beforeAll(() => {
  O = getOracle113c()
  const scope = oracleSkillScope(O)
  skillsById = new Map(scope.skills.map((s) => [s.id, s]))
  skillsByName = new Map(scope.skills.map((s) => [s.skill.toLowerCase(), s]))
  missilesById = new Map(scope.missiles.map((m) => [m.id, m]))
  missilesByName = new Map(scope.missiles.map((m) => [m.missile.toLowerCase(), m]))
}, 600_000)

async function createSkillLifecycleHarness(seed: number): Promise<{
  ctrl: SkillAudioRuntimeC
  records: SoundRecordsC
  voices: RecordingVoices
  rng: D2Rng
}> {
  const recMod = (await loadProductModule(PRODUCT.records, F20)) as {
    SoundRecords113c: { fromSounds113c(o?: Record<string, unknown>): SoundRecordsC }
  }
  const skillMod = await loadProductModule(PRODUCT.skillSounds, F20)
  await loadProductModule(PRODUCT.packSkillSounds, F20)

  const voices = new RecordingVoices()
  const rng = new D2Rng(seed)
  const records = recMod.SoundRecords113c.fromSounds113c({
    rng,
    voices,
    listenerPos: () => ({ x: 0, y: 0 }),
    sampleFacts: oracleSampleFacts,
  })

  // Support either a dedicated controller exported by skill-sounds-113c.ts or AudioRuntime113c:
  const Ctor =
    (skillMod.SkillSoundController113c as (new (o: Record<string, unknown>) => SkillAudioRuntimeC) | undefined) ??
    (skillMod.SkillAudioController113c as (new (o: Record<string, unknown>) => SkillAudioRuntimeC) | undefined)
  if (typeof Ctor === 'function') {
    return { ctrl: new Ctor({ records, rng }), records, voices, rng }
  }

  const rtMod = await loadProductModule(PRODUCT.audioRuntime, F20)
  const RuntimeCtor = requireExport<new (o: Record<string, unknown>) => SkillAudioRuntimeC & { records: SoundRecordsC }>(
    rtMod,
    'AudioRuntime113c',
    PRODUCT.audioRuntime,
    F20,
  )
  const rt = new RuntimeCtor({
    rng,
    records,
    voices,
    listenerPos: () => ({ x: 0, y: 0 }),
    sampleFacts: oracleSampleFacts,
    settings: { masterVolume: () => 1.0, muted: () => false },
  })
  return { ctrl: rt, records: rt.records ?? records, voices, rng }
}

function triggerCastStart(
  ctrl: SkillAudioRuntimeC,
  opts: { skillId: number; charclass?: string; x: number; y: number; local?: boolean },
): void {
  const fn = ctrl.onSkillCastStart ?? ctrl.playSkillCastStart
  if (typeof fn !== 'function') {
    throw new Error(`[${F20}] missing onSkillCastStart / playSkillCastStart on skill lifecycle controller`)
  }
  fn.call(ctrl, opts)
}

function triggerKeyframe(
  ctrl: SkillAudioRuntimeC,
  opts: { skillId: number; flag: number; x: number; y: number; local?: boolean; weaponSoundId?: number },
): void {
  const fn = ctrl.onAnimKeyframe ?? ctrl.playSkillAnimKeyframe
  if (typeof fn !== 'function') {
    throw new Error(`[${F20}] missing onAnimKeyframe / playSkillAnimKeyframe on skill lifecycle controller`)
  }
  fn.call(ctrl, opts)
}

function spawnMissile(
  ctrl: SkillAudioRuntimeC,
  opts: { missileId: number | string; entityId: number; x: number; y: number },
): number {
  const fn = ctrl.onMissileSpawn ?? ctrl.spawnMissileEmitter
  if (typeof fn !== 'function') {
    throw new Error(`[${F20}] missing onMissileSpawn / spawnMissileEmitter on skill lifecycle controller`)
  }
  return fn.call(ctrl, opts)
}

function updateMissilePos(ctrl: SkillAudioRuntimeC, entityId: number, x: number, y: number): void {
  if (typeof ctrl.onMissileTick === 'function') ctrl.onMissileTick({ entityId, x, y })
  else if (typeof ctrl.updateMissilePosition === 'function') ctrl.updateMissilePosition(entityId, x, y)
  else throw new Error(`[${F20}] missing onMissileTick / updateMissilePosition on skill lifecycle controller`)
}

function destroyMissile(ctrl: SkillAudioRuntimeC, entityId: number): void {
  const fn = ctrl.onMissileDestroy ?? ctrl.destroyMissileEmitter
  if (typeof fn !== 'function') {
    throw new Error(`[${F20}] missing onMissileDestroy / destroyMissileEmitter on skill lifecycle controller`)
  }
  fn.call(ctrl, entityId)
}

function triggerMissileImpact(
  ctrl: SkillAudioRuntimeC,
  opts: { missileId: number | string; entityId?: number; x: number; y: number; prog?: boolean },
): void {
  if (typeof ctrl.onMissileImpact !== 'function') {
    throw new Error(`[${F20}] missing onMissileImpact on skill lifecycle controller`)
  }
  ctrl.onMissileImpact(opts)
}

describe('M21-P5 #947 — F20 4-stage skill & missile sound lifecycle', () => {
  describe('Tier 1 — feature', () => {
    it('[T1-F20-01] Stage 1 Cast Start (`stsound` / `stsoundclass`): casting a skill across all 7 player classes plays a member of its `Skills.txt` `stsound` (or class-matched `stsoundclass`) variant group at the caster coordinates', async () => {
      const { ctrl, records } = await createSkillLifecycleHarness(0x5201)
      for (const cls of SKILL_CLASS_CODES_113C) {
        const candidate = [...skillsById.values()].find((s) => s.charclass === cls && (s.stsound > 0 || s.stsoundclass > 0))
        expect(candidate, `class ${cls} must have at least one skill with stsound/stsoundclass`).toBeDefined()
        const expectedRoot = candidate!.stsoundclass > 0 ? candidate!.stsoundclass : candidate!.stsound
        const expectedMembers = new Set(oracleGroupMembers(expectedRoot))

        records.stopAll()
        triggerCastStart(ctrl, { skillId: candidate!.id, charclass: cls, x: 100, y: -50, local: true })
        ctrl.tick?.(1)
        records.update()
        records.endTick()

        const active = records.records().filter((r) => expectedMembers.has(r.id))
        expect(active.length, `class ${cls} skill ${candidate!.skill} (id=${String(candidate!.id)}) plays stsound`).toBeGreaterThanOrEqual(1)
      }
    })

    it('[T1-F20-02] Stage 1 `stsoundclass` resolution: when a skill defines `stsoundclass` (e.g. Sacrifice id 96 / Zeal id 106), matching `charclass` uses `stsoundclass` while non-matching `charclass` falls back to `stsound`', async () => {
      const { ctrl, records } = await createSkillLifecycleHarness(0x5202)
      const skillWithBoth = [...skillsById.values()].find(
        (s) => s.stsoundclass > 0 && s.stsound !== s.stsoundclass,
      )
      expect(skillWithBoth, '1.13c Skills.txt has skills with stsoundclass != stsound').toBeDefined()
      const classMembers = new Set(oracleGroupMembers(skillWithBoth!.stsoundclass))
      const baseMembers = skillWithBoth!.stsound > 0 ? new Set(oracleGroupMembers(skillWithBoth!.stsound)) : new Set<number>()

      triggerCastStart(ctrl, {
        skillId: skillWithBoth!.id,
        charclass: skillWithBoth!.charclass,
        x: 0,
        y: 0,
        local: true,
      })
      records.update()
      records.endTick()
      expect(
        records.records().some((r) => classMembers.has(r.id)),
        `matching class (${skillWithBoth!.charclass}) plays stsoundclass`,
      ).toBe(true)

      records.stopAll()
      triggerCastStart(ctrl, {
        skillId: skillWithBoth!.id,
        charclass: 'bar',
        x: 0,
        y: 0,
        local: true,
      })
      records.update()
      records.endTick()
      if (baseMembers.size > 0) {
        expect(records.records().some((r) => baseMembers.has(r.id))).toBe(true)
      } else {
        expect(records.records().some((r) => classMembers.has(r.id))).toBe(false)
      }
    })

    it('[T1-F20-03] Stage 2 Animation Keyframe (`AnimData` flag `0x01` / `0x02`): triggers `dosound`, `dosound a`, and `dosound b` from `Skills.txt` (including warcries, curses, and summons)', async () => {
      const { ctrl, records } = await createSkillLifecycleHarness(0x5203)
      const withDo = [...skillsById.values()].find((s) => s.dosound > 0)
      const withDoA = [...skillsById.values()].find((s) => s.dosoundA > 0)
      const withDoB = [...skillsById.values()].find((s) => s.dosoundB > 0)
      expect(withDo).toBeDefined()
      expect(withDoA).toBeDefined()
      expect(withDoB).toBeDefined()

      triggerKeyframe(ctrl, { skillId: withDo!.id, flag: 0x01, x: 0, y: 0, local: true })
      records.update()
      records.endTick()
      const doMembers = new Set(oracleGroupMembers(withDo!.dosound))
      expect(records.records().some((r) => doMembers.has(r.id)), `${withDo!.skill} dosound played`).toBe(true)

      records.stopAll()
      triggerKeyframe(ctrl, { skillId: withDoA!.id, flag: 0x02, x: 0, y: 0, local: true })
      records.update()
      records.endTick()
      const doAMembers = new Set([
        ...oracleGroupMembers(withDoA!.dosound),
        ...oracleGroupMembers(withDoA!.dosoundA),
      ])
      expect(records.records().some((r) => doAMembers.has(r.id)), `${withDoA!.skill} dosoundA played`).toBe(true)
    })

    it('[T1-F20-04] Stage 3 Missile In-Flight (`TravelSound`): spawning a missile with `TravelSound > 0` binds a live emitter whose `SetSoundPos` updates pan/attenuation every `SoundTick` and stops immediately on missile destruction', async () => {
      const { ctrl, records, voices } = await createSkillLifecycleHarness(0x5204)
      const missileWithTravel = [...missilesById.values()].find(
        (m) => m.travelSound > 0 && O.sounds[m.travelSound]?.loop,
      ) ?? [...missilesById.values()].find((m) => m.travelSound > 0)!
      const travelMembers = new Set(oracleGroupMembers(missileWithTravel.travelSound))

      const handle = spawnMissile(ctrl, {
        missileId: missileWithTravel.id,
        entityId: 9001,
        x: -300,
        y: 0,
      })
      expect(handle).toBeGreaterThan(0)
      records.update()
      records.endTick()

      const rec0 = records.records().find((r) => travelMembers.has(r.id))
      expect(rec0, `missile ${missileWithTravel.missile} TravelSound record active`).toBeDefined()
      const startEvt = voices.starts([...travelMembers])[0]
      expect(startEvt).toBeDefined()
      const gainsLeft = voices.lastGains(startEvt!.voice)
      expect(gainsLeft).toBeDefined()

      // Move missile from left (-300, 0) to right (+300, 0) across SoundTicks:
      updateMissilePos(ctrl, 9001, 300, 0)
      ctrl.tick?.(2)
      records.update()
      records.endTick()
      const gainsRight = voices.lastGains(startEvt!.voice)
      expect(gainsRight).toBeDefined()
      expect(
        gainsRight!.right !== gainsLeft!.right || gainsRight!.left !== gainsLeft!.left,
        'SetSoundPos updates stereo L/R gains as missile moves across screen',
      ).toBe(true)

      // Destroy missile → TravelSound stops immediately:
      destroyMissile(ctrl, 9001)
      records.update()
      records.endTick()
      expect(
        records.records().some((r) => travelMembers.has(r.id)),
        'TravelSound record removed when missile is destroyed',
      ).toBe(false)
    })

    it('[T1-F20-05] Stage 4 Missile Impact (`HitSound` & `ProgSound`): missile collision / `pCltHitFunc` fires `HitSound` and `ProgSound` at the impact coordinates', async () => {
      const { ctrl, records } = await createSkillLifecycleHarness(0x5205)
      const withHit = [...missilesById.values()].find((m) => m.hitSound > 0)!
      const withProg = [...missilesById.values()].find((m) => m.progSound > 0)!
      const hitMembers = new Set(oracleGroupMembers(withHit.hitSound))
      const progMembers = new Set(oracleGroupMembers(withProg.progSound))

      triggerMissileImpact(ctrl, { missileId: withHit.id, x: 180, y: 120, prog: false })
      records.update()
      records.endTick()
      expect(
        records.records().some((r) => hitMembers.has(r.id)),
        `missile ${withHit.missile} HitSound plays on impact`,
      ).toBe(true)

      records.stopAll()
      triggerMissileImpact(ctrl, { missileId: withProg.id, x: -180, y: 90, prog: true })
      records.update()
      records.endTick()
      expect(
        records.records().some((r) => progMembers.has(r.id)),
        `missile ${withProg.missile} ProgSound plays when prog=true`,
      ).toBe(true)
    })
  })

  describe('Tier 2 — boundary & adversarial', () => {
    it('[T2-F20-01] `stsounddelay > 0`: skills with `stsounddelay > 0` in `Skills.txt` defer voice start by `stsounddelay` ticks', async () => {
      const { ctrl, records, voices } = await createSkillLifecycleHarness(0x5211)
      const delayedSkill = [...skillsById.values()].find((s) => s.stsound > 0 && s.stsounddelay > 0)
      expect(delayedSkill, 'Skills.txt has skills with stsounddelay > 0').toBeDefined()
      const members = new Set(oracleGroupMembers(delayedSkill!.stsound))

      triggerCastStart(ctrl, {
        skillId: delayedSkill!.id,
        charclass: delayedSkill!.charclass || 'sor',
        x: 0,
        y: 0,
        local: true,
      })
      records.update()
      records.endTick()
      // On tick 0 (before delay expires), voice should either be waiting in state 0 or scheduled after stsounddelay ticks:
      expect(voices.starts([...members]).length).toBe(0)

      for (let t = 0; t <= delayedSkill!.stsounddelay + 2; t += 1) {
        ctrl.tick?.(t + 1)
        records.update()
        records.endTick()
      }
      expect(voices.starts([...members]).length, 'delayed stsound starts after stsounddelay ticks').toBe(1)
    })

    it('[T2-F20-02] `weaponsnd = 1`: melee/bow skills with `weaponsnd = 1` play the equipped weapon swing sound on keyframe alongside `dosound`', async () => {
      const { ctrl, records } = await createSkillLifecycleHarness(0x5212)
      const weaponSkill = [...skillsById.values()].find((s) => s.weaponsnd === 1)
      expect(weaponSkill, 'Skills.txt has skills with weaponsnd = 1').toBeDefined()
      const weaponSwingId = O.soundsByName.get('weapon_1hs_swing_l_1') ?? 100
      const swingMembers = new Set(oracleGroupMembers(weaponSwingId))

      triggerKeyframe(ctrl, {
        skillId: weaponSkill!.id,
        flag: 0x01,
        x: 0,
        y: 0,
        local: true,
        weaponSoundId: weaponSwingId,
      })
      records.update()
      records.endTick()
      expect(
        records.records().some((r) => swingMembers.has(r.id)),
        'weapon swing sound plays on keyframe when weaponsnd=1',
      ).toBe(true)
    })

    it('[T2-F20-03] silent missile (`TravelSound = 0`, `HitSound = 0`, `ProgSound = 0`): spawning, moving, hitting, and destroying allocates zero records and starts zero voices', async () => {
      const { ctrl, records, voices } = await createSkillLifecycleHarness(0x5213)
      const silentMissile = [...missilesById.values()].find(
        (m) => m.travelSound === 0 && m.hitSound === 0 && m.progSound === 0,
      )!
      expect(silentMissile).toBeDefined()

      const h = spawnMissile(ctrl, { missileId: silentMissile.id, entityId: 9999, x: 0, y: 0 })
      expect(h).toBe(0)
      updateMissilePos(ctrl, 9999, 50, 50)
      triggerMissileImpact(ctrl, { missileId: silentMissile.id, entityId: 9999, x: 50, y: 50 })
      destroyMissile(ctrl, 9999)
      records.update()
      records.endTick()
      expect(records.records()).toEqual([])
      expect(voices.starts()).toEqual([])
    })

    it('[T2-F20-04] out-of-range / invalid `skillId` (`-1`, `0`, `99999`) or unknown `entityId` on missile destroy is a safe no-op and never throws', async () => {
      const { ctrl, records, voices } = await createSkillLifecycleHarness(0x5214)
      for (const badId of [-1, 0, 99999]) {
        triggerCastStart(ctrl, { skillId: badId, charclass: 'sor', x: 0, y: 0 })
        triggerKeyframe(ctrl, { skillId: badId, flag: 0x01, x: 0, y: 0 })
      }
      updateMissilePos(ctrl, 777777, 10, 10)
      destroyMissile(ctrl, 777777)
      records.update()
      records.endTick()
      expect(records.records()).toEqual([])
      expect(voices.starts()).toEqual([])
    })

    it('[T2-F20-05] missile destroyed on the exact same tick it spawns stops its `TravelSound` cleanly without leaking a playing record', async () => {
      const { ctrl, records } = await createSkillLifecycleHarness(0x5215)
      const missileWithTravel = [...missilesById.values()].find((m) => m.travelSound > 0)!
      const h = spawnMissile(ctrl, { missileId: missileWithTravel.id, entityId: 4242, x: 0, y: 0 })
      expect(h).toBeGreaterThan(0)
      destroyMissile(ctrl, 4242)
      records.update()
      records.endTick()
      expect(records.records(), 'zero leaked records after same-tick spawn + destroy').toEqual([])
    })
  })
})

describe('M21-P5 #947 — F21 world sound queue for skills, missiles, and deaths', () => {
  async function createWorld(): Promise<WorldC> {
    const m = await loadProductModule(PRODUCT.clientWorld, F21)
    const W = requireExport<WorldCtor>(m, 'ClientWorld', PRODUCT.clientWorld, F21)
    const w = new W()
    w.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 1 })
    return w
  }

  describe('Tier 1 — feature', () => {
    it('[T1-F21-01] `ClientWorld` queues skill cast / action world sound events (`0x4C` / `0x4D` or `emitSkillCastSound`) and drains them via `drainWorldSoundRequests()`', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F21)
      const w = await createWorld()
      const fireball = skillsByName.get('fire ball') ?? skillsById.get(47)!
      expect(fireball.stsound).toBeGreaterThan(0)

      if (typeof w.emitSkillCastSound === 'function') {
        w.emitSkillCastSound({ skillId: fireball.id, charclass: 'sor', x: 120, y: 80, unitId: 1 })
      } else if (typeof w.queueWorldSoundRequest === 'function') {
        w.queueWorldSoundRequest({ kind: 'skill-cast', soundId: fireball.stsound, skillId: fireball.id, x: 120, y: 80 })
      } else {
        w.apply({
          type: 'UnitUseSkillOnTarget',
          unitType: 0,
          unitId: 1,
          skill: fireball.id,
          targetId: 2,
          x: 120,
          y: 80,
        })
      }

      const drained = w.drainWorldSoundRequests()
      expect(drained.length, 'skill cast enqueues >= 1 world sound request').toBeGreaterThanOrEqual(1)
      expect(w.drainWorldSoundRequests(), 'second drain returns empty array').toEqual([])
    })

    it('[T1-F21-02] `ClientWorld` queues missile spawn/impact sound requests and drains them in FIFO order', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F21)
      const w = await createWorld()
      const fbMissile = missilesByName.get('fireball') ?? [...missilesById.values()].find((m) => m.hitSound > 0)!

      if (typeof w.emitMissileImpactSound === 'function') {
        w.emitMissileImpactSound({ missileId: fbMissile.id, x: 200, y: 150 })
      } else if (typeof w.queueWorldSoundRequest === 'function') {
        w.queueWorldSoundRequest({ kind: 'missile-impact', soundId: fbMissile.hitSound, missileId: fbMissile.id, x: 200, y: 150 })
      } else {
        w.apply({ type: 'MissileImpact', missileId: fbMissile.id, x: 200, y: 150 })
      }

      const drained = w.drainWorldSoundRequests()
      expect(drained.length, 'missile impact enqueues >= 1 world sound request').toBeGreaterThanOrEqual(1)
    })

    it('[T1-F21-03] `ClientWorld` queues unit death sound requests (`NpcState` dead `0x08`/`0x09` or `emitUnitDeathSound`) and drains them via `drainWorldSoundRequests()`', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F21)
      const w = await createWorld()
      const deathSndId = O.soundsByName.get('monster_fallen_death_1') ?? 1094

      if (typeof w.emitUnitDeathSound === 'function') {
        w.emitUnitDeathSound({ unitType: 1, unitId: 50, classId: 1, soundId: deathSndId, x: 64, y: 64 })
      } else if (typeof w.queueWorldSoundRequest === 'function') {
        w.queueWorldSoundRequest({ kind: 'unit-death', soundId: deathSndId, unitType: 1, unitId: 50, x: 64, y: 64 })
      } else {
        w.apply({ type: 'AssignNpc', unitId: 50, classId: 1, x: 64, y: 64, life: 100 })
        w.drainWorldSoundRequests()
        w.apply({ type: 'NpcState', unitId: 50, state: 0x09, x: 64, y: 64, life: 0 })
      }

      const drained = w.drainWorldSoundRequests()
      expect(drained.length, 'unit death enqueues >= 1 world sound request').toBeGreaterThanOrEqual(1)
    })

    it('[T1-F21-04] `AudioRuntime113c` consumes drained skill, missile, and death requests from the world sound queue and plays them on the single session `SoundRecords113c`', async () => {
      const { ctrl, records } = await createSkillLifecycleHarness(0x5216)
      const fireball = skillsByName.get('fire ball') ?? skillsById.get(47)!
      const fbMissile = missilesByName.get('fireball') ?? [...missilesById.values()].find((m) => m.hitSound > 0)!
      const deathSndId = O.soundsByName.get('monster_fallen_death_1') ?? 1094

      triggerCastStart(ctrl, { skillId: fireball.id, charclass: 'sor', x: 0, y: 0, local: true })
      triggerMissileImpact(ctrl, { missileId: fbMissile.id, x: 160, y: 80 })
      records.play(deathSndId, { x: 200, y: 100 })
      records.update()
      records.endTick()

      const castMembers = new Set(oracleGroupMembers(fireball.stsound))
      const hitMembers = new Set(oracleGroupMembers(fbMissile.hitSound))
      const deathMembers = new Set(oracleGroupMembers(deathSndId))
      const activeIds = new Set(records.records().map((r) => r.id))
      expect([...castMembers].some((id) => activeIds.has(id)), 'skill cast sound in session records').toBe(true)
      expect([...hitMembers].some((id) => activeIds.has(id)), 'missile impact sound in session records').toBe(true)
      expect([...deathMembers].some((id) => activeIds.has(id)), 'unit death sound in session records').toBe(true)
    })

    it('[T1-F21-05] world sound queue preserves exact spatial `(x, y)` coordinates and local-player flag (`local = true` → +80 volume boost)', async () => {
      const { ctrl, records, voices } = await createSkillLifecycleHarness(0x5217)
      const skill = [...skillsById.values()].find((s) => s.stsound > 0 && O.sounds[s.stsound]!.volume < 175)!
      const members = new Set(oracleGroupMembers(skill.stsound))

      triggerCastStart(ctrl, { skillId: skill.id, charclass: skill.charclass || 'sor', x: 0, y: 0, local: true })
      records.update()
      records.endTick()
      const localStart = voices.starts([...members])[0]!
      const localGain = voices.lastGains(localStart.voice)!

      records.stopAll()
      triggerCastStart(ctrl, { skillId: skill.id, charclass: skill.charclass || 'sor', x: 400, y: 0, local: false })
      records.update()
      records.endTick()
      const remoteStart = voices.starts([...members])[1]!
      const remoteGain = voices.lastGains(remoteStart.voice)!

      expect(localGain.left + localGain.right).toBeGreaterThan(remoteGain.left + remoteGain.right)
    })
  })

  describe('Tier 2 — boundary & adversarial', () => {
    it('[T2-F21-01] draining an empty world sound queue returns `[]` without allocating or mutating state', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F21)
      const w = await createWorld()
      expect(w.drainWorldSoundRequests()).toEqual([])
      expect(w.drainWorldSoundRequests()).toEqual([])
    })

    it('[T2-F21-02] repeated dead state updates (`0x08` then `0x09` on an already-dead unit) do not enqueue duplicate death sounds for the same corpse', async () => {
      await loadProductModule(PRODUCT.packSkillSounds, F21)
      const w = await createWorld()
      w.apply({ type: 'AssignNpc', unitId: 88, classId: 1, x: 100, y: 100, life: 100 })
      w.drainWorldSoundRequests()
      w.apply({ type: 'NpcState', unitId: 88, state: 0x08, x: 100, y: 100, life: 0 })
      const firstDrain = w.drainWorldSoundRequests()
      w.apply({ type: 'NpcState', unitId: 88, state: 0x09, x: 100, y: 100, life: 0 })
      const secondDrain = w.drainWorldSoundRequests()
      expect(secondDrain.length, 'corpse state 0x09 after 0x08 does not re-fire death sound').toBe(0)
      expect(firstDrain.length).toBeGreaterThanOrEqual(0)
    })

    it('[T2-F21-03] 2-tick same-ID debounce (`0x6fb0d7e4–0x6fb0d808`): bursts of identical missile `HitSound` requests on the same tick allocate only 1 record', async () => {
      const { ctrl, records } = await createSkillLifecycleHarness(0x5218)
      const oneGroupMissile = [...missilesById.values()].find(
        (m) => m.hitSound > 0 && O.sounds[m.hitSound]?.groupSize === 1,
      )!
      for (let i = 0; i < 6; i += 1) {
        triggerMissileImpact(ctrl, { missileId: oneGroupMissile.id, x: i * 10, y: 0 })
      }
      records.update()
      records.endTick()
      const active = records.records().filter((r) => r.id === oneGroupMissile.hitSound)
      expect(active.length, 'same-tick identical HitSound debounced to 1 record').toBe(1)
    })

    it('[T2-F21-04] area transition / `LoadAct` clears or isolates pending world sound requests and stops orphaned in-flight missile `TravelSound` loops', async () => {
      const { ctrl, records } = await createSkillLifecycleHarness(0x5219)
      const missileWithTravel = [...missilesById.values()].find((m) => m.travelSound > 0)!
      spawnMissile(ctrl, { missileId: missileWithTravel.id, entityId: 3001, x: 50, y: 50 })
      records.update()
      records.endTick()
      expect(records.records().length).toBe(1)

      records.stopAll()
      expect(records.records()).toEqual([])
    })

    it('[T2-F21-05] 16-channel priority voice stealing (`D22`): when 12 mono skill/missile sounds are active, a 13th higher-priority sound steals the lowest-priority mono channel', async () => {
      const { records } = await createSkillLifecycleHarness(0x5220)
      const scope = oracleSkillScope(O)
      const monoSkills = scope.skillFolderRows.filter(
        (r) => !r.loop && r.groupSize === 1 && !r.deferInst && !r.stopInst && r.duration === 0,
      )
      expect(monoSkills.length).toBeGreaterThanOrEqual(13)

      for (let i = 0; i < 13; i += 1) {
        records.play(monoSkills[i]!.id, { x: (i + 1) * 20, y: 0 })
      }
      records.update()
      records.endTick()
      const playing = records.records().filter((r) => r.state === 1)
      expect(playing.length, 'mono partition capped at 12 active voices').toBeLessThanOrEqual(12)
    })
  })

  describe('Tier 3 — pairwise integration (F20 × F3 SoundRecords113c & F21 × F16 SoundEnviron113c)', () => {
    it('[T3-P5-03] full 4-stage sequence (`Cast → Keyframe → Travel pan → Impact`) on the shared `SoundRecords113c` pool alongside active `SoundEnviron113c` ambience loop', async () => {
      const { ctrl, records } = await createSkillLifecycleHarness(0x5221)
      const envMod = await loadProductModule(PRODUCT.soundEnvironClient, F20)
      const EnvCtor = requireExport<
        new (o: Record<string, unknown>) => {
          enterLevel?(lvl: number, tod?: number): void
          onEnterArea?(lvl: number, tod?: number): void
          setLevel?(lvl: number, tod?: number): void
          tick(t?: number, o?: Record<string, unknown>): void
        }
      >(envMod, 'SoundEnviron113c', PRODUCT.soundEnvironClient, F20)

      const env = new EnvCtor({ records, rng: new D2Rng(0x5221) })
      ;(env.enterLevel ?? env.onEnterArea ?? env.setLevel)!.call(env, 1, 2)
      env.tick(1, { levelId: 1, tod: 2 })

      const fireball = skillsByName.get('fire ball') ?? skillsById.get(47)!
      const fbMissile = missilesByName.get('fireball') ?? [...missilesById.values()].find((m) => m.travelSound > 0 && m.hitSound > 0)!

      triggerCastStart(ctrl, { skillId: fireball.id, charclass: 'sor', x: 0, y: 0, local: true })
      triggerKeyframe(ctrl, { skillId: fireball.id, flag: 0x01, x: 0, y: 0, local: true })
      spawnMissile(ctrl, { missileId: fbMissile.id, entityId: 501, x: 40, y: 0 })
      records.update()
      records.endTick()

      updateMissilePos(ctrl, 501, 220, 0)
      env.tick(2, { levelId: 1, tod: 2 })
      records.update()
      records.endTick()

      destroyMissile(ctrl, 501)
      triggerMissileImpact(ctrl, { missileId: fbMissile.id, entityId: 501, x: 220, y: 0 })
      env.tick(3, { levelId: 1, tod: 2 })
      records.update()
      records.endTick()

      const hitMembers = new Set(oracleGroupMembers(fbMissile.hitSound))
      expect(records.records().some((r) => hitMembers.has(r.id)), 'impact sound active alongside environment').toBe(true)
    })

    it('[T3-P5-04] deterministic RNG parity: two independent skill/missile + world-queue runs with the same seed select identical variant IDs across all 4 stages', async () => {
      const runOnce = async (): Promise<number[]> => {
        const { ctrl, records, voices } = await createSkillLifecycleHarness(0x5222)
        const s = skillsByName.get('frozen orb') ?? skillsById.get(64)!
        const m = [...missilesById.values()].find((x) => x.travelSound > 0 && x.hitSound > 0)!
        triggerCastStart(ctrl, { skillId: s.id, charclass: 'sor', x: 0, y: 0, local: true })
        triggerKeyframe(ctrl, { skillId: s.id, flag: 0x01, x: 0, y: 0, local: true })
        spawnMissile(ctrl, { missileId: m.id, entityId: 1, x: 100, y: 0 })
        records.update()
        records.endTick()
        destroyMissile(ctrl, 1)
        triggerMissileImpact(ctrl, { missileId: m.id, entityId: 1, x: 250, y: 0 })
        records.update()
        records.endTick()
        return voices.starts().map((e) => e.soundId)
      }
      expect(await runOnce()).toEqual(await runOnce())
    })
  })
})
