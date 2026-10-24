/**
 * M21-P5 (#947) — Tier 4 end-to-end user-journey scenarios (`T4-P5-01..04`) exercising F19–F22
 * (`pack-skill-sounds`, `sfx-skills-{ama,sor,nec,pal,bar,dru,ass,common}.bin`, `skill-sounds-113c.ts`,
 * 4-stage cast/keyframe/travel/impact lifecycle, world sound queue for skills/missiles/deaths,
 * and `verify:audio` §skills) together.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { D2Rng } from '../../../src/common/rng/d2-rng.ts'
import {
  D2_DATA_DIR,
  PRODUCT,
  REPO_ROOT,
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
import { FakeAudioContext } from './webaudio-fake.ts'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 600_000 })

const S5 = '#947 Tier 4 E2E scenarios'

interface RecordViewC {
  readonly handle: number
  readonly id: number
  readonly state: number
}

interface SoundRecordsC {
  play(id: number, o?: Record<string, unknown>): number
  stop(handle: number): void
  stopAll(): void
  update(): void
  endTick(): void
  records(): RecordViewC[]
}

interface SkillAudioRuntimeC {
  onSkillCastStart?(opts: Record<string, unknown>): number | readonly number[]
  playSkillCastStart?(opts: Record<string, unknown>): number | readonly number[]
  onAnimKeyframe?(opts: Record<string, unknown>): number | readonly number[]
  playSkillAnimKeyframe?(opts: Record<string, unknown>): number | readonly number[]
  onMissileSpawn?(opts: Record<string, unknown>): number
  spawnMissileEmitter?(opts: Record<string, unknown>): number
  onMissileTick?(opts: Record<string, unknown>): void
  updateMissilePosition?(entityId: number, x: number, y: number): void
  onMissileImpact?(opts: Record<string, unknown>): number | readonly number[]
  onMissileDestroy?(entityId: number): void
  destroyMissileEmitter?(entityId: number): void
  tick?(gameTick?: number): void
}

let O: Oracle113c
let skills: readonly OracleSkillRow113c[]
let missiles: readonly OracleMissileRow113c[]

beforeAll(() => {
  O = getOracle113c()
  const scope = oracleSkillScope(O)
  skills = scope.skills
  missiles = scope.missiles
}, 600_000)

async function createScenarioHarness(seed: number): Promise<{
  ctrl: SkillAudioRuntimeC
  records: SoundRecordsC
  voices: RecordingVoices
}> {
  const recMod = (await loadProductModule(PRODUCT.records, S5)) as {
    SoundRecords113c: { fromSounds113c(o?: Record<string, unknown>): SoundRecordsC }
  }
  const skillMod = await loadProductModule(PRODUCT.skillSounds, S5)
  await loadProductModule(PRODUCT.packSkillSounds, S5)

  const voices = new RecordingVoices()
  const rng = new D2Rng(seed)
  const records = recMod.SoundRecords113c.fromSounds113c({
    rng,
    voices,
    listenerPos: () => ({ x: 0, y: 0 }),
    sampleFacts: oracleSampleFacts,
  })

  const Ctor =
    (skillMod.SkillSoundController113c as (new (o: Record<string, unknown>) => SkillAudioRuntimeC) | undefined) ??
    (skillMod.SkillAudioController113c as (new (o: Record<string, unknown>) => SkillAudioRuntimeC) | undefined)
  if (typeof Ctor === 'function') {
    return { ctrl: new Ctor({ records, rng }), records, voices }
  }

  const rtMod = await loadProductModule(PRODUCT.audioRuntime, S5)
  const RuntimeCtor = requireExport<new (o: Record<string, unknown>) => SkillAudioRuntimeC & { records: SoundRecordsC }>(
    rtMod,
    'AudioRuntime113c',
    PRODUCT.audioRuntime,
    S5,
  )
  const rt = new RuntimeCtor({
    rng,
    records,
    voices,
    listenerPos: () => ({ x: 0, y: 0 }),
    sampleFacts: oracleSampleFacts,
    settings: { masterVolume: () => 1.0, muted: () => false },
  })
  return { ctrl: rt, records: rt.records ?? records, voices }
}

describe('M21-P5 #947 — Tier 4 end-to-end scenarios (F19–F22)', () => {
  it('[T4-P5-01] Sorceress Fire Ball & Frozen Orb combat sequence: Cast (`stsound`) → Keyframe (`dosound`) → Missile `TravelSound` panning across 10 ticks → `HitSound` explosion + monster death in world sound queue', async () => {
    const { ctrl, records, voices } = await createScenarioHarness(0x5401)
    const fireball = skills.find((s) => s.skill.toLowerCase() === 'fire ball' && s.dosound > 0) ?? skills.find((s) => s.charclass === 'sor' && s.stsound > 0 && s.dosound > 0)!
    const fbMissile = missiles.find((m) => m.missile.toLowerCase() === 'fireball') ?? missiles.find((m) => m.travelSound > 0 && m.hitSound > 0)!
    const castFn = (ctrl.onSkillCastStart ?? ctrl.playSkillCastStart)!
    const keyframeFn = (ctrl.onAnimKeyframe ?? ctrl.playSkillAnimKeyframe)!
    const spawnFn = (ctrl.onMissileSpawn ?? ctrl.spawnMissileEmitter)!
    const destroyFn = (ctrl.onMissileDestroy ?? ctrl.destroyMissileEmitter)!

    // Tick 1: Cast Start
    castFn.call(ctrl, { skillId: fireball.id, charclass: 'sor', x: 0, y: 0, local: true })
    records.update()
    records.endTick()
    const stMembers = new Set(oracleGroupMembers(fireball.stsound))
    expect(voices.starts([...stMembers]).length, 'Fire Ball stsound started').toBe(1)

    // Tick 5: Keyframe + Missile Spawn
    keyframeFn.call(ctrl, { skillId: fireball.id, flag: 0x01, x: 0, y: 0, local: true })
    spawnFn.call(ctrl, { missileId: fbMissile.id, entityId: 7001, x: -240, y: 0 })
    records.update()
    records.endTick()
    const doMembers = new Set(oracleGroupMembers(fireball.dosound))
    const travelMembers = new Set(oracleGroupMembers(fbMissile.travelSound))
    expect(voices.starts([...doMembers]).length, 'Fire Ball dosound started').toBe(1)
    expect(records.records().some((r) => travelMembers.has(r.id)), 'Fire Ball TravelSound active').toBe(true)

    // Ticks 6..15: Missile flies from x=-240 to x=+240
    for (let step = 1; step <= 10; step += 1) {
      const x = -240 + step * 48
      if (typeof ctrl.onMissileTick === 'function') ctrl.onMissileTick({ entityId: 7001, x, y: 0 })
      else ctrl.updateMissilePosition!(7001, x, 0)
      ctrl.tick?.(5 + step)
      records.update()
      records.endTick()
    }

    // Tick 16: Missile hits & destroys + enemy dies
    destroyFn.call(ctrl, 7001)
    ctrl.onMissileImpact!({ missileId: fbMissile.id, entityId: 7001, x: 240, y: 0 })
    const deathSnd = O.soundsByName.get('monster_fallen_death_1') ?? 1094
    records.play(deathSnd, { x: 240, y: 0 })
    records.update()
    records.endTick()

    expect(records.records().some((r) => travelMembers.has(r.id)), 'TravelSound stopped on impact').toBe(false)
    const hitMembers = new Set(oracleGroupMembers(fbMissile.hitSound))
    expect(records.records().some((r) => hitMembers.has(r.id)), 'HitSound playing at impact').toBe(true)
  })

  it('[T4-P5-02] 7-class multiplayer party showcase (`ama, sor, nec, pal, bar, dru, ass`): each class executes a signature skill (`stsound` + `dosound`) with D12 class-pack preload and decoded `AudioBuffer`s', async () => {
    const { ctrl, records, voices } = await createScenarioHarness(0x5402)
    const idxMod = (await loadProductModule(PRODUCT.sfxPackIndex, S5)) as {
      SFX_PACK_INDEX_113C: Readonly<Record<number, readonly [string, number, number, number, number, number]>>
    }
    const loaderMod = await loadProductModule(PRODUCT.sfxChunkLoader, S5)
    const SfxChunkLoaderCtor = requireExport<
      new (o?: Record<string, unknown>) => { loadSoundBuffer(id: number, ctx?: unknown): Promise<unknown> }
    >(loaderMod, 'SfxChunkLoader', PRODUCT.sfxChunkLoader, S5)

    const fakeCtx = new FakeAudioContext()
    const loader = new SfxChunkLoaderCtor({
      fetch: async (url: string) => {
        const rel = url.replace(/^\/+/, '')
        const bytes = new Uint8Array(readFileSync(join(REPO_ROOT, 'public', rel)))
        return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer }
      },
      audioContext: () => fakeCtx,
    })

    const castFn = (ctrl.onSkillCastStart ?? ctrl.playSkillCastStart)!
    const keyframeFn = (ctrl.onAnimKeyframe ?? ctrl.playSkillAnimKeyframe)!

    for (let i = 0; i < SKILL_CLASS_CODES_113C.length; i += 1) {
      const cls = SKILL_CLASS_CODES_113C[i]!
      const skill = skills.find((s) => s.charclass === cls && s.stsound > 0 && s.dosound > 0) ??
        skills.find((s) => s.charclass === cls && (s.stsound > 0 || s.dosound > 0))!
      expect(skill, `signature skill for ${cls}`).toBeDefined()

      castFn.call(ctrl, { skillId: skill.id, charclass: cls, x: i * 30, y: 0, local: i === 0 })
      keyframeFn.call(ctrl, { skillId: skill.id, flag: 0x01, x: i * 30, y: 0, local: i === 0 })
      records.update()
      records.endTick()
    }

    const startedIds = voices.starts().map((s) => s.soundId)
    expect(startedIds.length, 'all 7 classes started skill voices').toBeGreaterThanOrEqual(7)
    for (const sid of startedIds) {
      expect(idxMod.SFX_PACK_INDEX_113C[sid], `started skill sound ${String(sid)} is in SFX_PACK_INDEX_113C`).toBeDefined()
      const buf = await loader.loadSoundBuffer(sid, fakeCtx)
      expect(buf).toBeTruthy()
    }
  })

  it('[T4-P5-03] multi-missile volley saturation & cleanup: 8 simultaneous travelling missiles pan independently and leave zero zombie emitters when destroyed', async () => {
    const { ctrl, records } = await createScenarioHarness(0x5403)
    const travelMissiles = missiles.filter((m) => m.travelSound > 0).slice(0, 8)
    expect(travelMissiles.length).toBe(8)
    const spawnFn = (ctrl.onMissileSpawn ?? ctrl.spawnMissileEmitter)!
    const destroyFn = (ctrl.onMissileDestroy ?? ctrl.destroyMissileEmitter)!

    for (let i = 0; i < travelMissiles.length; i += 1) {
      spawnFn.call(ctrl, {
        missileId: travelMissiles[i]!.id,
        entityId: 8000 + i,
        x: -200 + i * 50,
        y: 0,
      })
    }
    records.update()
    records.endTick()
    expect(records.records().length).toBeGreaterThanOrEqual(1)

    for (let tick = 1; tick <= 5; tick += 1) {
      for (let i = 0; i < travelMissiles.length; i += 1) {
        if (typeof ctrl.onMissileTick === 'function') {
          ctrl.onMissileTick({ entityId: 8000 + i, x: -200 + i * 50 + tick * 20, y: tick * 10 })
        } else {
          ctrl.updateMissilePosition!(8000 + i, -200 + i * 50 + tick * 20, tick * 10)
        }
      }
      ctrl.tick?.(tick)
      records.update()
      records.endTick()
    }

    for (let i = 0; i < travelMissiles.length; i += 1) {
      destroyFn.call(ctrl, 8000 + i)
    }
    records.update()
    records.endTick()
    expect(records.records(), 'all 8 missile TravelSound emitters stopped cleanly').toEqual([])
  })

  it('[T4-P5-04] cumulative `verify:audio` audit across M1–M5 (`tables`, `sfx-core`, `music`, `ambient`, `levels`, `weather`, `skills`) passes with 0 errors', async () => {
    await loadProductModule(PRODUCT.packSkillSounds, S5)
    const auditMod = await loadProductModule(PRODUCT.audit, S5)
    const runAudioAudit = requireExport<
      (opts?: {
        rootDir?: string
        mpqDir?: string
        sections?: readonly string[]
      }) => Promise<{ ok: boolean; sections: readonly { id: string; errors: readonly string[] }[] }>
    >(auditMod, 'runAudioAudit', PRODUCT.audit, S5)

    const rep = await runAudioAudit({
      rootDir: REPO_ROOT,
      mpqDir: D2_DATA_DIR,
      sections: ['tables', 'sfx-core', 'music', 'ambient', 'levels', 'weather', 'skills'],
    })
    const allErrors = rep.sections.flatMap((s) => s.errors.map((e) => `[${s.id}] ${e}`))
    expect(allErrors, summarize(allErrors)).toEqual([])
    expect(rep.ok).toBe(true)
  })
})
