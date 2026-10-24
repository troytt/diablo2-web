import { describe, expect, it } from 'vitest'
import {
  CHAR_ANIM_CLIPS_113C,
  computeActionFrameTicks,
  computeAnimFrameIndex,
  computeDiminishingRate113c,
  computeEffectiveFcr,
  computeEffectiveFhr,
  computeEffectiveIas,
  computeOneShotDurationMs,
  computeOneShotTicks,
  computeRollbackSkillTiming113c,
  computeSequenceDurationMs,
  computeSequenceTicks,
  computeShapeshiftWeaponDelay113c,
  computeStepSpeed256,
  computeWhirlwindCadenceTicks113c,
  getCharAnimClip113c,
  resolveCharacterAnimSpeedParams,
  resolveEquippedWeaponClass,
  resolvePrimaryWeaponIas113c,
  resolveWeaponWsm,
} from '../../src/common/units/char-anim-speed.ts'
import { SORCERESS_PLAYER_MODES } from '../../src/common/units/char-appearance.ts'
import {
  getSkillAnimModes,
  getSkillPlayerClipMode,
  resolveSkillSequenceFrame,
} from '../../src/common/skills/skill-anim-modes.ts'
import { dir64FromPoints, dir64ToClipDirection } from '../../src/common/units/direction.ts'
import type { AnimClipMeta } from '../../src/common/units/unit-types.ts'
import type { LoadedCharacter } from '../../src/client/scene/entity-art-loader.ts'
import {
  clearMissingArtEntries,
  renderSceneSourceFrame,
} from '../../src/client/scene/world-renderer.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import type { SpriteRenderer } from '../../src/client/render/renderer.ts'
import type { SceneFrameSnapshot, SceneSource } from '../../src/client/view/scene-source.ts'
import { buildSceneDrawables, type RenderableUnitInput } from '../../src/client/view/unit-drawables.ts'
import { getViewportProfile } from '../../src/client/view/viewport-profile.ts'
import type { ClientUnit } from '../../src/client/world/client-unit.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

type MockFrame = LoadedCharacter['groups'][number][number]

function toRenderableUnit(unit: ClientUnit): RenderableUnitInput {
  return {
    id: unit.id,
    kind: unit.unitType,
    classId: unit.classId,
    x: unit.x,
    y: unit.y,
    ...(unit.targetX !== undefined ? { targetX: unit.targetX } : {}),
    ...(unit.targetY !== undefined ? { targetY: unit.targetY } : {}),
    mode: unit.mode,
    direction: unit.direction,
    lifePct: unit.lifePct,
    ...(unit.castState !== undefined ? { castState: unit.castState } : {}),
    ...(unit.modeStartedAtMs !== undefined ? { animStartedAtMs: unit.modeStartedAtMs } : {}),
    ...(unit.animStepSpeed256 !== undefined ? { animStepSpeed256: unit.animStepSpeed256 } : {}),
    ...(unit.animEffRate !== undefined ? { animEffRate: unit.animEffRate } : {}),
    states: Array.from(unit.states.list()),
  }
}

function createMockCharacterArt(classId = 1): LoadedCharacter {
  const canonical = CHAR_ANIM_CLIPS_113C[classId] ?? CHAR_ANIM_CLIPS_113C[1]!
  const groups: MockFrame[][] = []
  const clips: Record<string, AnimClipMeta> = {}
  const numDirs = 16

  let groupCursor = 0
  for (const [clipKey, spec] of Object.entries(canonical)) {
    clips[clipKey] = {
      group: groupCursor,
      frames: spec.frames,
      directions: numDirs,
      speed: spec.speed,
      loop: spec.loop,
      events: [],
    }
    for (let dir = 0; dir < numDirs; dir++) {
      const dirFrames: MockFrame[] = []
      for (let f = 0; f < spec.frames; f++) {
        dirFrames.push({
          x: (groupCursor + dir) * 1000 + f,
          y: f,
          width: 48,
          height: 72,
          anchorX: -24,
          anchorY: -64,
        })
      }
      groups.push(dirFrames)
    }
    groupCursor += numDirs
  }

  return {
    handle: 1 as unknown as LoadedCharacter['handle'],
    stand: clips.nu!.group,
    walk: clips.wl!.group,
    directions: numDirs,
    members: 1,
    clips,
    groups,
  }
}

function createSpyRenderer(): {
  readonly renderer: SpriteRenderer
  readonly drawnFrames: MockFrame[]
} {
  const drawnFrames: MockFrame[] = []
  const renderer = {
    begin: () => {},
    flush: () => {},
    setPalette: () => {},
    setLighting: () => {},
    addIndexedAtlas: () => 1 as any,
    draw: (frame: MockFrame) => {
      drawnFrames.push(frame)
    },
  } as unknown as SpriteRenderer
  return { renderer, drawnFrames }
}

describe('1.13c character animation speed & one-shot lifecycle (#552, #936)', () => {
  it('computes 1.13c AnimData.d2 diminishing returns, EFCR/EIAS/EFHR, stepSpeed256, and durationMs', () => {
    expect(computeDiminishingRate113c(0)).toBe(0)
    expect(computeDiminishingRate113c(20)).toBe(17)
    expect(computeDiminishingRate113c(40)).toBe(30)
    expect(computeDiminishingRate113c(63)).toBe(41)
    expect(computeDiminishingRate113c(105)).toBe(56)
    expect(computeDiminishingRate113c(120)).toBe(60)
    expect(computeDiminishingRate113c(200)).toBe(75)
    expect(computeDiminishingRate113c(-30)).toBe(-30)

    expect(computeEffectiveFcr(0)).toBe(0)
    expect(computeEffectiveFcr(105)).toBe(56)
    expect(computeEffectiveFcr(500)).toBe(75)

    // Phase Blade (WSM -30) + 40% item IAS (diminished = 30) + 20% Fanaticism -> min(75, 30 + 20 - (-30)) = 75
    expect(computeEffectiveIas(40, 20, -30)).toBe(75)
    // Great Maul (WSM +20) + 0% IAS -> -20
    expect(computeEffectiveIas(0, 0, 20)).toBe(-20)

    expect(computeEffectiveFhr(0)).toBe(0)
    expect(computeEffectiveFhr(86)).toBe(50)

    // Sorceress SC: 14 frames, baseSpeed = 256 -> ceil(14*256/stepSpeed256) - 1 = 13 ticks (520ms) at 0% FCR
    const sorcSc = getCharAnimClip113c(1, 'sc')!
    expect(sorcSc.frames).toBe(14)
    expect(sorcSc.speed).toBe(256)
    expect(sorcSc.loop).toBe(false)

    const step0 = computeStepSpeed256(sorcSc.speed, computeEffectiveFcr(0))
    expect(step0).toBe(256)
    expect(computeOneShotTicks(sorcSc.frames, step0)).toBe(13)
    expect(computeOneShotDurationMs(sorcSc.frames, step0)).toBe(520)

    const step105 = computeStepSpeed256(sorcSc.speed, computeEffectiveFcr(105))
    expect(step105).toBe(399)
    expect(computeOneShotTicks(sorcSc.frames, step105)).toBe(8)
    expect(computeOneShotDurationMs(sorcSc.frames, step105)).toBe(320)
  })

  it('resolves 1.13c weapon WSM from Weapons.txt codes', () => {
    expect(resolveWeaponWsm('7cr')).toBe(-30) // Phase Blade
    expect(resolveWeaponWsm('hax')).toBe(0) // Hand Axe
    expect(resolveWeaponWsm('axe')).toBe(10) // Axe
    expect(resolveWeaponWsm('mau')).toBe(10) // Maul
    expect(resolveWeaponWsm('gma')).toBe(20) // Great Maul
  })

  it('drives spell cast speed and castState duration from FCR in StatList and equipped items', () => {
    const world = new ClientWorld()
    world.apply(
      {
        type: 'UnitAssign',
        isSelf: true,
        unit: {
          unitType: 'player',
          id: 1,
          classId: 1, // Sorceress
          name: 'Sorc',
          x: 5000,
          y: 5000,
          mode: 1,
          lifePct: 128,
        },
      },
      1000,
    )

    // Cast Fireball (skillId = 47) at 0% FCR -> 13 frames (520ms)
    world.apply(
      {
        type: 'SkillCast',
        caster: { unitType: 'player', id: 1 },
        skill: 47,
        level: 1,
        target: { x: 5020, y: 5000 },
      },
      1000,
    )

    const unit = world.getUnit('player', 1)!
    expect(unit.mode).toBe(10)
    expect(unit.castState).toBeDefined()
    expect(unit.castState!.stepSpeed256).toBe(256)
    expect(unit.castState!.durationMs).toBe(520)
    expect(unit.castState!.untilMs).toBe(1520)

    // Equip a weapon + shield totaling 105% FCR (statId = 105)
    world.apply({
      type: 'ItemAction',
      action: 0x06,
      item: {
        id: 101,
        code: 'obf',
        container: 'equipment',
        equipSlot: 4,
        x: 0,
        y: 0,
        stats: [{ id: 105, value: 40 }],
        runewordStats: [{ id: 105, value: 35 }],
      } as any,
    })
    world.apply({
      type: 'ItemAction',
      action: 0x06,
      item: {
        id: 102,
        code: 'uit',
        container: 'equipment',
        equipSlot: 5,
        x: 0,
        y: 0,
        stats: [{ id: 105, value: 30 }],
      } as any,
    })

    // Cast Fireball at 105% FCR -> 8 frames (320ms)
    world.apply(
      {
        type: 'SkillCast',
        caster: { unitType: 'player', id: 1 },
        skill: 47,
        level: 1,
        target: { x: 5020, y: 5000 },
      },
      2000,
    )

    expect(unit.castState).toBeDefined()
    expect(unit.castState!.effRate).toBe(56)
    expect(unit.castState!.stepSpeed256).toBe(399)
    expect(unit.castState!.durationMs).toBe(320)
    expect(unit.castState!.untilMs).toBe(2320)
  })

  it('drives melee attack speed and duration from IAS, skill IAS, and equipped weapon WSM', () => {
    const world = new ClientWorld()
    world.apply(
      {
        type: 'UnitAssign',
        isSelf: true,
        unit: {
          unitType: 'player',
          id: 1,
          classId: 3, // Paladin (A1: 14 frames, baseSpeed = 256)
          name: 'Pala',
          x: 5000,
          y: 5000,
          mode: 1,
          lifePct: 128,
        },
      },
      1000,
    )

    // 1) Equip slow Great Maul ('gma', WSM = +20) with 0% IAS
    world.apply({
      type: 'ItemAction',
      action: 0x06,
      item: {
        id: 201,
        code: 'gma',
        container: 'equipment',
        equipSlot: 4,
        x: 0,
        y: 0,
        stats: [],
      } as any,
    })

    world.apply(
      {
        type: 'SkillCast',
        caster: { unitType: 'player', id: 1 },
        skill: 0, // Normal Attack -> mode 7 (A1)
        level: 1,
        target: { x: 5005, y: 5000 },
      },
      1000,
    )

    const unit = world.getUnit('player', 1)!
    expect(unit.mode).toBe(7)
    expect(unit.castState!.effRate).toBe(-20)
    expect(unit.castState!.stepSpeed256).toBe(204)
    // Great Maul ('gma') is 2hs -> Paladin PA A1 2HS has 18 frames in 1.13c AnimData.d2 -> ceil(18*256/204)-1 = 22 ticks (880ms)
    expect(unit.castState!.durationMs).toBe(880)

    // 2) Replace with Phase Blade ('7cr', WSM = -30, +40% IAS) + 20% skill IAS (statId 68)
    world.apply({
      type: 'ItemAction',
      action: 0x06,
      item: {
        id: 202,
        code: '7cr',
        container: 'equipment',
        equipSlot: 4,
        x: 0,
        y: 0,
        stats: [{ id: 93, value: 40 }],
      } as any,
    })
    world.apply({ type: 'StatSet', stat: 68, value: 20, param: 0 }, 2000)

    world.apply(
      {
        type: 'SkillCast',
        caster: { unitType: 'player', id: 1 },
        skill: 0,
        level: 1,
        target: { x: 5005, y: 5000 },
      },
      2000,
    )

    expect(unit.castState!.effRate).toBe(75)
    expect(unit.castState!.stepSpeed256).toBe(448)
    // Phase Blade ('7cr') is 1hs -> Paladin PA A1 1HS has 15 frames in 1.13c AnimData.d2 -> ceil(15*256/448)-1 = 8 ticks (320ms)
    expect(unit.castState!.durationMs).toBe(320)
    expect(unit.castState!.untilMs).toBe(2320)
  })

  it('clamps non-looping one-shot clips at frameCount - 1 without modulo wrapping and wraps looping clips', () => {
    // Non-looping 14-frame clip at stepSpeed256 = 256 (1 frame per 40ms)
    const framesVisited: number[] = []
    for (let t = 0; t <= 1200; t += 40) {
      framesVisited.push(
        computeAnimFrameIndex({
          frameCount: 14,
          stepSpeed256: 256,
          loop: false,
          nowMs: 1000 + t,
          startedAtMs: 1000,
        }),
      )
    }
    expect(framesVisited[0]).toBe(0)
    expect(framesVisited[1]).toBe(1)
    expect(framesVisited[13]).toBe(13)
    // After 13 * 40 = 520ms, all subsequent samples stay clamped at 13 (never wrap to 0)
    for (let i = 13; i < framesVisited.length; i++) {
      expect(framesVisited[i]).toBe(13)
    }

    // Looping 8-frame clip wraps around
    expect(
      computeAnimFrameIndex({
        frameCount: 8,
        stepSpeed256: 256,
        loop: true,
        nowMs: 8 * 40,
      }),
    ).toBe(0)
    expect(
      computeAnimFrameIndex({
        frameCount: 8,
        stepSpeed256: 256,
        loop: true,
        nowMs: 9 * 40,
      }),
    ).toBe(1)
  })

  it('expires castState back to mode 1 (NU) without moving caster position, and interrupts cast on UnitMove', () => {
    const world = new ClientWorld()
    const castDir = dir64FromPoints(5100, 5100, 5200, 5100, 0)
    world.apply(
      {
        type: 'UnitAssign',
        isSelf: true,
        unit: {
          unitType: 'player',
          id: 1,
          classId: 1,
          name: 'Sorc',
          x: 5100,
          y: 5100,
          direction: castDir,
          mode: 1,
          lifePct: 128,
        },
      },
      1000,
    )

    // Cast ranged spell toward (5200, 5100)
    world.apply(
      {
        type: 'SkillCast',
        caster: { unitType: 'player', id: 1 },
        skill: 47,
        level: 1,
        target: { x: 5200, y: 5100 },
      },
      1000,
    )

    const unit = world.getUnit('player', 1)!
    expect(unit.mode).toBe(10)
    expect(unit.direction).toBe(castDir)

    // Mid-cast tick at t = 1280ms (280ms elapsed < 560ms duration)
    world.tick(280, 1280)
    expect(unit.x).toBe(5100)
    expect(unit.y).toBe(5100)
    expect(unit.castState).toBeDefined()
    expect(unit.mode).toBe(10)

    const midDrawables = buildSceneDrawables([toRenderableUnit(unit)]).unitDrawables
    expect(midDrawables[0]!.mode).toBe(10)
    expect(midDrawables[0]!.animMode).toBe('SC')
    expect(midDrawables[0]!.direction).toBe(castDir)

    // Tick past cast completion at t = 1560ms (560ms elapsed)
    world.tick(280, 1560)
    expect(unit.castState).toBeUndefined()
    expect(world.self.castState).toBeUndefined()
    expect(unit.mode).toBe(1)
    expect(unit.direction).toBe(castDir)

    const afterDrawables = buildSceneDrawables([toRenderableUnit(unit)]).unitDrawables
    expect(afterDrawables[0]!.mode).toBe(1)
    expect(afterDrawables[0]!.animMode).toBeUndefined()
    expect(afterDrawables[0]!.direction).toBe(castDir)

    // Start another cast at t = 2000ms and interrupt it with UnitMove at t = 2100ms
    world.apply(
      {
        type: 'SkillCast',
        caster: { unitType: 'player', id: 1 },
        skill: 47,
        level: 1,
        target: { x: 5200, y: 5100 },
      },
      2000,
    )
    expect(unit.castState).toBeDefined()
    expect(unit.mode).toBe(10)

    world.apply(
      {
        type: 'UnitMove',
        unitType: 'player',
        id: 1,
        mode: 'run',
        from: { x: 5100, y: 5100 },
        to: { x: 5120, y: 5120 },
      },
      2100,
    )
    expect(unit.castState).toBeUndefined()
    expect(world.self.castState).toBeUndefined()
    expect(unit.mode).toBe(3)
  })

  it('preserves local player cast facing direction on OnlineSession after cast expires into NU and clears cast on movement', () => {
    const session = new OnlineSession()
    const expectedDir = dir64FromPoints(5000, 5000, 5040, 5020, 0)
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Sorc',
        x: 5000,
        y: 5000,
        direction: expectedDir,
        mode: 1,
        lifePct: 128,
      },
    })

    session.handleServerEvent({
      type: 'SkillCast',
      caster: { unitType: 'player', id: 1 },
      skill: 47,
      level: 1,
      target: { x: 5040, y: 5020 },
    })

    const selfUnit = session.world.getUnit('player', 1)!
    expect(selfUnit.targetDirection).toBe(expectedDir)
    const duringUnits = session.buildRenderableUnits()
    const selfDuring = duringUnits.find((u) => u.isLocalPlayer)!
    expect(selfDuring.mode).toBe(10)
    expect(selfDuring.direction).toBe(expectedDir)
    expect(selfDuring.castState).toBeDefined()

    // Advance 600ms via session.tick so the 560ms Sorceress cast finishes
    for (let i = 1; i <= 15; i++) {
      session.tick(40, i * 40)
    }

    const afterUnits = session.buildRenderableUnits()
    const selfAfter = afterUnits.find((u) => u.isLocalPlayer)!
    expect(selfAfter.mode).toBe(1) // Returned to NU (idle)
    expect(selfAfter.castState).toBeUndefined()
    expect(selfAfter.direction).toBe(expectedDir) // Still facing cast target!

    session.destroy()
  })

  it('renders non-looping one-shot clip frames once (clamped at last frame) and switches back to NU clip after castState expires', () => {
    clearMissingArtEntries()
    const world = new ClientWorld()
    const castDir = dir64FromPoints(5000, 5000, 5030, 5000, 0)
    world.apply(
      {
        type: 'UnitAssign',
        isSelf: true,
        unit: {
          unitType: 'player',
          id: 1,
          classId: 1, // Sorceress
          name: 'Sorc',
          x: 5000,
          y: 5000,
          direction: castDir,
          mode: 1,
          lifePct: 128,
        },
      },
      1000,
    )
    world.apply(
      {
        type: 'SkillCast',
        caster: { unitType: 'player', id: 1 },
        skill: 47,
        level: 1,
        target: { x: 5030, y: 5000 },
      },
      1000,
    )

    const charArt = createMockCharacterArt(1)
    const characterArtByToken = new Map<string, LoadedCharacter>([['so', charArt]])
    const { renderer, drawnFrames } = createSpyRenderer()
    const vp = getViewportProfile('800x600')

    const makeSource = (): SceneSource => ({
      isWorldReady: () => true,
      getLevelView: () => null,
      getViewportProfile: () => vp,
      setViewportProfile: () => vp,
      buildLightingInputs: () => ({}) as any,
      buildFrameSnapshot: (): SceneFrameSnapshot => {
        const unit = world.getUnit('player', 1)!
        const entities = buildSceneDrawables([
          {
            id: unit.id,
            kind: 'player',
            classId: unit.classId,
            x: unit.x,
            y: unit.y,
            mode: unit.mode,
            direction: unit.direction,
            castState: unit.castState,
            animStartedAtMs: unit.castState?.startedAtMs ?? unit.modeStartedAtMs,
            animStepSpeed256: unit.castState?.stepSpeed256 ?? unit.animStepSpeed256,
            animEffRate: unit.castState?.effRate ?? unit.animEffRate,
            isLocalPlayer: true,
          },
        ])
        return {
          tick: 0,
          worldReady: true,
          actId: 1,
          levelId: 1,
          viewportProfile: vp,
          playerSubTile: { x: 5000, y: 5000 },
          playerLocalSubTile: { x: 5000, y: 5000 },
          playerWorld: { x: 0, y: 0 },
          cameraTopLeft: { x: -400, y: -300 },
          floorQuads: [],
          shadowQuads: [],
          lowerWallQuads: [],
          upperWallQuads: [],
          roofQuads: [],
          entities,
        }
      },
    }) as unknown as SceneSource

    const source = makeSource()
    const scClip = charArt.clips!.sc!
    const nuClip = charArt.clips!.nu!
    const unit = world.getUnit('player', 1)!
    const clipDir = dir64ToClipDirection(unit.direction, scClip.directions ?? 16)
    const expectedScGroup = scClip.group + clipDir
    const expectedNuGroup = nuClip.group + clipDir

    // At t = 1000ms (cast start), renders SC frame 0
    renderSceneSourceFrame({
      source,
      lightingPreset: 'day' as any,
      renderer,
      characterArtByToken,
      nowMs: 1000,
    })
    expect(drawnFrames.at(-1)!.x).toBe(expectedScGroup * 1000 + 0)
    expect(drawnFrames.at(-1)!.y).toBe(0)

    // At t = 1200ms (5 ticks into cast), renders SC frame 5
    renderSceneSourceFrame({
      source,
      lightingPreset: 'day' as any,
      renderer,
      characterArtByToken,
      nowMs: 1200,
    })
    expect(drawnFrames.at(-1)!.x).toBe(expectedScGroup * 1000 + 5)
    expect(drawnFrames.at(-1)!.y).toBe(5)

    // Even if world.tick hasn't been called yet at t = 1800ms, the one-shot SC clip clamps at frame 13 (never wraps to 0)
    renderSceneSourceFrame({
      source,
      lightingPreset: 'day' as any,
      renderer,
      characterArtByToken,
      nowMs: 1800,
    })
    expect(drawnFrames.at(-1)!.x).toBe(expectedScGroup * 1000 + 13)
    expect(drawnFrames.at(-1)!.y).toBe(13)

    // Once world.tick(600, 1600) expires castState, unit returns to NU clip while preserving clipDir
    world.tick(600, 1600)
    renderSceneSourceFrame({
      source,
      lightingPreset: 'day' as any,
      renderer,
      characterArtByToken,
      nowMs: 1600,
    })
    const finalFrame = drawnFrames.at(-1)!
    expect(Math.floor(finalFrame.x / 100)).toBe(expectedNuGroup * 10)
  })

  it('decouples discrete 25Hz simulation ticks from high display refresh rates (144Hz, 240Hz, and 0ms frames)', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Sorc',
        x: 5000,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })

    // Spawn a missile (e.g. Fireball) and a cast overlay
    const missile = world.spawnMissileByKey('fireball', 5000, 5000, 5050, 5000)
    const overlay = world.attachUnitOverlay(world.getUnit('player', 1)!, 'fire_cast_2', true)
    expect(world.frameCount).toBe(0)
    expect(missile.ageTicks).toBe(0)
    expect(overlay.ageTicks).toBe(0)

    // Simulate 1 second at 144Hz: 144 frames of ~6.944ms each = 1000ms
    const dt144 = 1000 / 144
    for (let frame = 1; frame <= 144; frame++) {
      world.tick(dt144, frame * dt144)
    }

    // In 1 second (1000ms), 25Hz simulation should advance by exactly 25 ticks, NOT 144 ticks!
    expect(world.frameCount).toBe(25)
    expect(missile.ageTicks).toBe(25)
    expect(overlay.ageTicks).toBe(25)

    // Simulate 0ms duplicate RAF callbacks
    for (let i = 0; i < 10; i++) {
      world.tick(0, 1000)
    }
    expect(world.frameCount).toBe(25)
    expect(missile.ageTicks).toBe(25)
    expect(overlay.ageTicks).toBe(25)

    // Advance 40ms more (1 tick)
    world.tick(40, 1040)
    expect(world.frameCount).toBe(26)
    expect(missile.ageTicks).toBe(26)
    expect(overlay.ageTicks).toBe(26)
  })

  it('prevents held mouse from interrupting active cast animation every 100ms via isPlayerBusyCasting', () => {
    const session = new OnlineSession()
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1, // Sorceress
        name: 'Sorc',
        x: 5000,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })
    session.world.self.rightSkill = 47 // Fireball

    // Player presses and holds right mouse button to cast at t = 1000ms
    const rec1 = session.commandMapper.handlePointerDown(400, 300, 2, 1000)
    expect(rec1).not.toBeNull()
    expect(rec1?.command.type).toBe('SkillAt')

    // Client world prediction has set up castState with duration ~520ms (until t = 1520ms)
    const selfUnit = session.world.getUnit('player', 1)!
    expect(selfUnit.castState).toBeDefined()
    expect(selfUnit.castState?.skillId).toBe(47)
    const untilMs = selfUnit.castState!.untilMs
    expect(untilMs).toBeGreaterThan(1500)

    // At t = 1100ms (100ms later, which is the 100ms skillMinIntervalMs rate limit cooldown),
    // player is still holding right mouse button.
    expect(session.commandMapper.isPlayerBusyCasting(1100)).toBe(true)
    const rec2 = session.commandMapper.tick(1100)
    expect(rec2).toBeNull() // Must NOT interrupt active cast!
    expect(selfUnit.castState?.startedAtMs).toBe(1000) // Cast start time intact!

    // Repeat tick at t = 1200, 1300, 1400, 1500ms
    for (let t = 1200; t <= 1500; t += 100) {
      expect(session.commandMapper.tick(t)).toBeNull()
      expect(selfUnit.castState?.startedAtMs).toBe(1000)
    }

    // Step world past untilMs so the cast finishes
    session.world.tick(untilMs - 1000 + 40, untilMs + 40)
    expect(selfUnit.castState).toBeUndefined()
    expect(session.commandMapper.isPlayerBusyCasting(untilMs + 40)).toBe(false)

    // Now that previous cast completed, held mouse initiates the next cast cleanly!
    const recNext = session.commandMapper.tick(untilMs + 40)
    expect(recNext).not.toBeNull()
    expect(recNext?.type).toBe('SkillAt')
    expect(selfUnit.castState).toBeDefined()
    expect(selfUnit.castState?.startedAtMs).toBe(untilMs + 40)

    session.destroy()
  })

  it('preserves locally-predicted cast timing and avoids restarting animation when server SkillCast echo arrives', () => {
    const world = new ClientWorld()
    world.apply(
      {
        type: 'UnitAssign',
        isSelf: true,
        unit: {
          unitType: 'player',
          id: 1,
          classId: 1,
          name: 'Sorc',
          x: 5000,
          y: 5000,
          mode: 1,
          lifePct: 128,
        },
      },
      1000,
    )
    world.self.rightSkill = 47

    // Local client predicts right skill cast at t = 1000ms
    world.noteOutgoingCommand(
      {
        type: 'SkillAt',
        hand: 'right',
        at: { x: 5030, y: 5000 },
        hold: false,
      },
      1000,
    )

    const unit = world.getUnit('player', 1)!
    expect(unit.castState).toBeDefined()
    expect(unit.castState?.startedAtMs).toBe(1000)
    const origUntilMs = unit.castState!.untilMs

    // Advance 80ms of local playback (2 simulation frames)
    world.tick(40, 1040)
    world.tick(40, 1080)
    expect(unit.castState?.elapsedMs).toBe(80)

    // At t = 1080ms (80ms RTT), server 0x4C SkillCast echo arrives
    world.apply(
      {
        type: 'SkillCast',
        caster: { unitType: 'player', id: 1 },
        skill: 47,
        level: 1,
        target: { x: 5030, y: 5000 },
      },
      1080,
    )

    // The cast timing must be preserved without resetting back to frame 0 or startedAtMs = 1080
    expect(unit.castState?.startedAtMs).toBe(1000)
    expect(unit.castState?.untilMs).toBe(origUntilMs)
    expect(unit.castState?.elapsedMs).toBe(80)
  })

  it('matches exact 1.13c FCR breakpoints across all 7 classes and 3 shapeshift forms (#936)', () => {
    const computeFcrBreakpoints = (classId: number, morphMonsterClassId?: number) => {
      const clip = getCharAnimClip113c(classId, 'sc', { morphMonsterClassId })!
      const bps: Array<{ fcr: number; frames: number; actionTick: number }> = []
      let prevFrames = -1
      for (let fcr = 0; fcr <= 300; fcr++) {
        const step = computeStepSpeed256(clip.speed, computeEffectiveFcr(fcr))
        const frames = computeOneShotTicks(clip.frames, step)
        const actionTick = computeActionFrameTicks(clip.actionFrame ?? Math.floor(clip.frames / 2), step)
        if (frames !== prevFrames) {
          bps.push({ fcr, frames, actionTick })
          prevFrames = frames
        }
      }
      return bps
    }

    // Sorceress (1): 13 -> 7 frames at 0, 9, 20, 37, 63, 105, 200% FCR (actionFrame = 7)
    const sorcBps = computeFcrBreakpoints(1)
    expect(sorcBps.map((b) => [b.fcr, b.frames, b.actionTick])).toEqual([
      [0, 13, 7],
      [9, 12, 7],
      [20, 11, 6],
      [37, 10, 6],
      [63, 9, 5],
      [105, 8, 5],
      [200, 7, 4],
    ])
    // Barbarian (4): 13 -> 7 frames at 0, 9, 20, 37, 63, 105, 200% FCR (actionFrame = 9)
    expect(computeFcrBreakpoints(4).map((b) => [b.fcr, b.frames, b.actionTick])).toEqual([
      [0, 13, 9],
      [9, 12, 9],
      [20, 11, 8],
      [37, 10, 8],
      [63, 9, 7],
      [105, 8, 6],
      [200, 7, 6],
    ])

    // Necromancer (2) & Paladin (3): 15 -> 9 frames at 0, 9, 18, 30, 48, 75, 125% FCR
    const necroBps = computeFcrBreakpoints(2)
    expect(necroBps.map((b) => [b.fcr, b.frames])).toEqual([
      [0, 15],
      [9, 14],
      [18, 13],
      [30, 12],
      [48, 11],
      [75, 10],
      [125, 9],
    ])
    expect(computeFcrBreakpoints(3).map((b) => [b.fcr, b.frames])).toEqual(
      necroBps.map((b) => [b.fcr, b.frames]),
    )

    // Druid Human (5): 18 -> 10 frames at 0, 4, 10, 19, 30, 46, 68, 99, 163% FCR
    expect(computeFcrBreakpoints(5).map((b) => [b.fcr, b.frames])).toEqual([
      [0, 18],
      [4, 17],
      [10, 16],
      [19, 15],
      [30, 14],
      [46, 13],
      [68, 12],
      [99, 11],
      [163, 10],
    ])

    // Assassin (6): 16 -> 9 frames at 0, 8, 16, 27, 42, 65, 102, 174% FCR
    expect(computeFcrBreakpoints(6).map((b) => [b.fcr, b.frames])).toEqual([
      [0, 16],
      [8, 15],
      [16, 14],
      [27, 13],
      [42, 12],
      [65, 11],
      [102, 10],
      [174, 9],
    ])

    // Amazon (0): 19 -> 11 frames at 0, 7, 14, 22, 32, 48, 68, 99, 152% FCR
    expect(computeFcrBreakpoints(0).map((b) => [b.fcr, b.frames])).toEqual([
      [0, 19],
      [7, 18],
      [14, 17],
      [22, 16],
      [32, 15],
      [48, 14],
      [68, 13],
      [99, 12],
      [152, 11],
    ])

    // Werewolf (430): 16 -> 9 frames at 0, 6, 14, 26, 40, 60, 95, 157% FCR
    expect(computeFcrBreakpoints(5, 430).map((b) => [b.fcr, b.frames])).toEqual([
      [0, 16],
      [6, 15],
      [14, 14],
      [26, 13],
      [40, 12],
      [60, 11],
      [95, 10],
      [157, 9],
    ])

    // Werebear (431): 16 -> 9 frames at 0, 7, 15, 26, 40, 63, 99, 163% FCR
    expect(computeFcrBreakpoints(5, 431).map((b) => [b.fcr, b.frames])).toEqual([
      [0, 16],
      [7, 15],
      [15, 14],
      [26, 13],
      [40, 12],
      [63, 11],
      [99, 10],
      [163, 9],
    ])

    // Necromancer Vampire / Trang-Oul (200): 23 -> 13 frames at 0, 6, 11, 18, 24, 35, 48, 65, 86, 120, 180% FCR
    expect(computeFcrBreakpoints(2, 200).map((b) => [b.fcr, b.frames])).toEqual([
      [0, 23],
      [6, 22],
      [11, 21],
      [18, 20],
      [24, 19],
      [35, 18],
      [48, 17],
      [65, 16],
      [86, 15],
      [120, 14],
      [180, 13],
    ])
  })

  it('scales SQ spell sequences (Lightning/Chain Lightning/Inferno/Arctic Blast) by EFCR and SQ attack sequences (Jab) by EIAS - 30 (#936)', () => {
    // Sorceress Lightning (#49, seqNum = 13, 19 frames, seqTrans = SC) -> 19..11 frames at 0, 7, 15, 23, 35, 52, 78, 117, 194% FCR
    const lightningBps: Array<[number, number]> = []
    let prevFrames = -1
    for (let fcr = 0; fcr <= 250; fcr++) {
      const params = resolveCharacterAnimSpeedParams(1, 18, {
        skillId: 49,
        unitStats: { get: (id: number) => (id === 105 ? fcr : 0) },
      })
      const frames = computeSequenceTicks(19, params.stepSpeed256)
      if (frames !== prevFrames) {
        lightningBps.push([fcr, frames])
        prevFrames = frames
      }
    }
    expect(lightningBps).toEqual([
      [0, 19],
      [7, 18],
      [15, 17],
      [23, 16],
      [35, 15],
      [52, 14],
      [78, 13],
      [117, 12],
      [194, 11],
    ])

    // Druid Arctic Blast (#230, seqNum = 22, 14 frames, seqTrans = SC) with 2hs weapon -> speed 208 + EFCR
    const arctic0 = resolveCharacterAnimSpeedParams(5, 18, {
      skillId: 230,
      weaponClass: '2hs',
    })
    expect(arctic0.baseSpeed).toBe(208)
    expect(arctic0.stepSpeed256).toBe(208)
    expect(computeSequenceDurationMs(14, arctic0.stepSpeed256)).toBe(720) // ceil(14*256/208) = 18 ticks = 720ms

    // Amazon Jab (#10, seqNum = 2, 18 frames, seqTrans = A1) scales with EIAS - 30 (NOT FCR)
    const jab0 = resolveCharacterAnimSpeedParams(0, 18, {
      skillId: 10,
      unitStats: { get: (id: number) => (id === 105 ? 200 : 0) }, // FCR must be ignored for seqTrans = A1!
      weaponWsmOverride: 0,
    })
    expect(jab0.effRate).toBe(-30)
    expect(jab0.stepSpeed256).toBe(Math.floor((256 * 70) / 100))

    const jabFast = resolveCharacterAnimSpeedParams(0, 18, {
      skillId: 10,
      unitStats: { get: (id: number) => (id === 93 ? 60 : 0) },
      weaponWsmOverride: -20,
    })
    expect(jabFast.effRate).toBe(Math.min(75, computeEffectiveIas(60, 0, -20) - 30))
    expect(jabFast.stepSpeed256).toBeGreaterThan(jab0.stepSpeed256)
  })

  it('guards non-SQ skills with leftover seqNum in Skills.txt (#123 Conviction, #223 Werewolf, #228 Werebear) as SC mode 10 (#936)', () => {
    for (const skillId of [123, 223, 228]) {
      expect(getSkillAnimModes(skillId).playerMode).toBe(10)
      expect(getSkillPlayerClipMode(skillId, 'hth', 0)).toBe('sc')
      expect(resolveSkillSequenceFrame(skillId, 'hth', 0)).toBeNull()
    }
    // True SQ skills still resolve sequence frames properly
    expect(getSkillAnimModes(49).playerMode).toBe(18)
    expect(resolveSkillSequenceFrame(49, 'hth', 0)?.totalSequenceFrames).toBe(19)
  })

  it('preserves PLRMODE_CAST (mode 10) and castState across S2C 0x15 ReassignPlayer during Teleport backswing (#936)', () => {
    const session = new OnlineSession()
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1, // Sorceress (0% FCR: 13 frames = 520ms total, Action Frame = 7 ticks = 280ms)
        name: 'Sorc',
        x: 5000,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })
    session.world.self.rightSkill = 54 // Teleport

    // 1) Start Teleport cast at t = 1000ms (0% FCR)
    const castCmd = session.commandMapper.handlePointerDown(450, 300, 2, 1000)
    expect(castCmd?.command.type).toBe('SkillAt')

    const selfUnit = session.world.getUnit('player', 1)!
    expect(selfUnit.mode).toBe(10)
    expect(selfUnit.castState).toBeDefined()
    expect(selfUnit.castState!.skillId).toBe(54)
    expect(selfUnit.castState!.durationMs).toBe(520) // 13 frames * 40ms
    expect(selfUnit.castState!.untilMs).toBe(1520)

    // 2) Advance to Action Frame (tick 7 = 280ms -> t = 1280ms), where server executes srvdofunc=19
    // and sends S2C 0x15 ReassignPlayer to teleport player to (5030, 5000)
    session.world.tick(280, 1280)
    session.world.apply(
      {
        type: 'UnitReassign',
        unitType: 'player',
        id: 1,
        at: { x: 5030, y: 5000 },
        snap: true,
      },
      1280,
    )

    // Coordinates must update immediately on Action Frame, but PLRMODE_CAST (mode 10)
    // and castState must remain intact for the remaining 6 frames (240ms) of backswing!
    expect(selfUnit.x).toBe(5030)
    expect(selfUnit.y).toBe(5000)
    expect(selfUnit.mode).toBe(10)
    expect(selfUnit.castState).toBeDefined()
    expect(selfUnit.castState!.untilMs).toBe(1520)
    expect(session.world.self.castState).toBeDefined()
    expect(session.world.self.castState!.untilMs).toBe(1520)

    // 3) While in backswing (t = 1300ms, 1400ms, 1500ms), held right mouse button MUST NOT trigger a premature recast!
    for (const t of [1300, 1400, 1500]) {
      expect(session.commandMapper.isPlayerBusyCasting(t)).toBe(true)
      expect(session.commandMapper.tick(t)).toBeNull()
    }

    // 4) Once all 13 frames (520ms) finish at t = 1520ms, castState expires cleanly to NU (mode 1)
    session.world.tick(240, 1520)
    expect(selfUnit.castState).toBeUndefined()
    expect(selfUnit.mode).toBe(1)
    expect(session.commandMapper.isPlayerBusyCasting(1520)).toBe(false)

    // And now the next held-mouse Teleport cast is permitted at t = 1520ms!
    const nextCast = session.commandMapper.tick(1520)
    expect(nextCast).not.toBeNull()
    expect(nextCast?.type).toBe('SkillAt')

    session.destroy()
  })

  it('resolves per-wclass AnimData.d2 clips and includes BL/KK/S2/S3/S4 in SORCERESS_PLAYER_MODES (#1259)', () => {
    for (const mode of ['bl', 'kk', 's2', 's3', 's4'] as const) {
      expect(SORCERESS_PLAYER_MODES).toContain(mode)
    }

    // Amazon (0) A1 varies by wclass: hth=13f, bow=14f, 1ht=15f, 1hs=16f, 2ht=18f, 2hs=20f, xbw=20f
    expect(getCharAnimClip113c(0, 'a1', { weaponClass: 'hth' }).frames).toBe(13)
    expect(getCharAnimClip113c(0, 'a1', { weaponClass: 'bow' }).frames).toBe(14)
    expect(getCharAnimClip113c(0, 'a1', { weaponClass: '1ht' }).frames).toBe(15)
    expect(getCharAnimClip113c(0, 'a1', { weaponClass: '1hs' }).frames).toBe(16)
    expect(getCharAnimClip113c(0, 'a1', { weaponClass: '2ht' }).frames).toBe(18)
    expect(getCharAnimClip113c(0, 'a1', { weaponClass: '2hs' }).frames).toBe(20)
    expect(getCharAnimClip113c(0, 'a1', { weaponClass: 'xbw' }).frames).toBe(20)
    expect(getCharAnimClip113c(0, 'bl', { weaponClass: '1hs' }).speed).toBe(88)

    // Assassin (6) A1/A2 with claws (ht1/ht2) has speed 208 vs 256 for hth, and 15f for 1hs/1ht, 23f for 2hs/2ht
    expect(getCharAnimClip113c(6, 'a1', { weaponClass: 'hth' })).toMatchObject({ frames: 11, speed: 256 })
    expect(getCharAnimClip113c(6, 'a1', { weaponClass: 'ht1' })).toMatchObject({ frames: 11, speed: 208 })
    expect(getCharAnimClip113c(6, 'a2', { weaponClass: 'ht2' })).toMatchObject({ frames: 12, speed: 208 })
    expect(getCharAnimClip113c(6, 'a1', { weaponClass: '1hs' })).toMatchObject({ frames: 15, speed: 256 })
    expect(getCharAnimClip113c(6, 'a1', { weaponClass: '2hs' })).toMatchObject({ frames: 23, speed: 256 })

    // Paladin (3) BL with 2hs has speed 168; GH with 2ht/stf has speed 192
    expect(getCharAnimClip113c(3, 'bl', { weaponClass: '2hs' }).speed).toBe(168)
    expect(getCharAnimClip113c(3, 'gh', { weaponClass: 'stf' }).speed).toBe(192)
  })

  it('resolves dual-wield wclass (1ss/1st/1js/1jt/ht2), twoHandedWClass, and Double Swing +50% EIAS (#1260)', () => {
    // 2H weapons use twoHandedWClass when wielded two-handed, or wclass (1hs) when wielded 1H with a shield
    expect(resolveEquippedWeaponClass([{ code: '2hs', equippedSlot: 4 }])).toBe('2hs')
    expect(
      resolveEquippedWeaponClass([
        { code: '2hs', equippedSlot: 4 },
        { code: 'buc', equippedSlot: 5 },
      ]),
    ).toBe('1hs')
    expect(resolveEquippedWeaponClass([{ code: 'gma', equippedSlot: 4 }])).toBe('stf')
    expect(resolveEquippedWeaponClass([{ code: 'spr', equippedSlot: 4 }])).toBe('2ht')
    expect(resolveEquippedWeaponClass([{ code: 'sbb', equippedSlot: 4 }])).toBe('bow')
    expect(resolveEquippedWeaponClass([{ code: 'lxb', equippedSlot: 4 }])).toBe('xbw')
    expect(resolveEquippedWeaponClass([{ code: 'sst', equippedSlot: 4 }])).toBe('stf')

    // Dual-wielding combinations (slots 4 and 5)
    expect(
      resolveEquippedWeaponClass([
        { code: '7cr', equippedSlot: 4 }, // 1hs
        { code: '7cr', equippedSlot: 5 }, // 1hs
      ]),
    ).toBe('1ss')
    expect(
      resolveEquippedWeaponClass([
        { code: 'dgr', equippedSlot: 4 }, // 1ht
        { code: 'dgr', equippedSlot: 5 }, // 1ht
      ]),
    ).toBe('1st')
    expect(
      resolveEquippedWeaponClass([
        { code: '7cr', equippedSlot: 4 }, // 1hs
        { code: 'dgr', equippedSlot: 5 }, // 1ht
      ]),
    ).toBe('1js')
    expect(
      resolveEquippedWeaponClass([
        { code: 'dgr', equippedSlot: 4 }, // 1ht
        { code: '7cr', equippedSlot: 5 }, // 1hs
      ]),
    ).toBe('1jt')
    expect(
      resolveEquippedWeaponClass([
        { code: 'ktr', equippedSlot: 4 }, // ht1
        { code: 'ktr', equippedSlot: 5 }, // ht1
      ]),
    ).toBe('ht2')

    // Barbarian (#133 Double Swing) gets +50% intrinsic skill EIAS - 30 sequence penalty = +20 net EIAS at 0 IAS / 0 WSM
    const doubleSwing = resolveCharacterAnimSpeedParams(4, 18, {
      skillId: 133,
      equipment: [
        { code: 'hax', equippedSlot: 4 }, // WSM 0, 1hs
        { code: 'hax', equippedSlot: 5 }, // WSM 0, 1hs -> 1ss
      ],
    })
    expect(doubleSwing.effRate).toBe(20)
    expect(doubleSwing.frames).toBe(17) // seqNum 6 (BAS31SS + BAS41SS = 17 frames)

    // Barbarian (#147 Frenzy) has no intrinsic +50% on cast start -> -30 sequence penalty at 0 IAS / 0 WSM
    const frenzy = resolveCharacterAnimSpeedParams(4, 18, {
      skillId: 147,
      equipment: [
        { code: 'hax', equippedSlot: 4 },
        { code: 'hax', equippedSlot: 5 },
      ],
    })
    expect(frenzy.effRate).toBe(-30)
  })

  it('computes 1.13c rollback multi-strike timing (Zeal/Fury/Strafe/Fend/Dragon Talon) and Whirlwind cadence (#1261)', () => {
    // Paladin Zeal (#106, slvl 4 -> 5 strikes, 100% rollback -> rollbackFrame = 0)
    // With Phase Blade (1hs: 15 frames, actionFrame 7) at +75 EIAS (stepSpeed256 = 448):
    // intervalTicks = ceil(7*256/448) = 4 ticks per strike; finalCycleTicks = ceil(15*256/448)-1 = 8 ticks
    // Total for 5 strikes = 4 * 4 + 8 = 24 ticks (960ms) — classic 4/4/4/4/8 Zeal!
    const zeal = resolveCharacterAnimSpeedParams(3, 'a1', {
      skillId: 106,
      skillLevel: 4,
      weaponCode: '7cr',
      unitStats: { get: (id: number) => (id === 93 ? 40 : id === 68 ? 20 : 0) },
    })
    expect(zeal.rollbackTiming).toBeDefined()
    expect(zeal.rollbackTiming!.strikes).toBe(5)
    expect(zeal.rollbackTiming!.rollbackFrame).toBe(0)
    expect(zeal.rollbackTiming!.intervalTicks).toBe(4)
    expect(zeal.rollbackTiming!.finalCycleTicks).toBe(8)
    expect(zeal.rollbackTiming!.totalTicks).toBe(24)
    expect(zeal.durationMs).toBe(960)

    // Verify computeAnimFrameIndex cycles through rollback frames during multi-strike Zeal
    const fTick3 = computeAnimFrameIndex({
      frameCount: 15,
      stepSpeed256: 448,
      loop: false,
      nowMs: 1000 + 3 * 40,
      startedAtMs: 1000,
      skillId: 106,
      skillLevel: 4,
      actionFrame: 7,
    })
    const fTick4 = computeAnimFrameIndex({
      frameCount: 15,
      stepSpeed256: 448,
      loop: false,
      nowMs: 1000 + 4 * 40, // Second strike winds back to rollbackFrame = 0!
      startedAtMs: 1000,
      skillId: 106,
      skillLevel: 4,
      actionFrame: 7,
    })
    expect(fTick3).toBeGreaterThanOrEqual(5)
    expect(fTick4).toBe(0)

    // Werewolf Fury (#248, 70% rollback -> rollbackFrame = floor(7 * 0.3) = 2)
    const furyRb = computeRollbackSkillTiming113c({
      skillId: 248,
      frames: 13,
      actionFrame: 7,
      stepSpeed256: 256,
      skillLevel: 4,
    })!
    expect(furyRb.strikes).toBe(5)
    expect(furyRb.rollbackFrame).toBe(2)
    expect(furyRb.intervalTicks).toBe(5) // 7 - 2 = 5 frames at 256

    // Whirlwind (#151) cadence breakpoints (SKILLS_GetWhirlwindFrame @ 0x6FC48A20)
    expect(computeWhirlwindCadenceTicks113c(-30, 4, false)).toBe(4) // +34 >= 34 -> 4f WW
    expect(computeWhirlwindCadenceTicks113c(20, 0, true)).toBe(12) // -20 on 2H maul -> 12f WW
    expect(computeWhirlwindCadenceTicks113c(0, 60, true)).toBe(4) // +60 >= 30 on 2H -> 4f WW
  })

  it('computes 1.13c Werewolf (430) & Werebear (431) compound weapon-delay attack speed (0x6FDA0CE0) (#1262)', () => {
    // Druid (5) in Werewolf (430) with Phase Blade ('7cr', 1hs, WSM = -30) and +90% on-weapon IAS (e.g. 6x Shael)
    // vs +90% off-weapon IAS (gloves/armor/amulet):
    // Human Druid A1 1hs = 19 frames, speed 256.
    // 1) With +90% ON-WEAPON IAS:
    //    weaponDelay = floor(19 * 256 / floor(256 * (100 + 90 - (-30)) / 100)) = floor(4864 / 563) = 8
    //    morphBaseSpeed = floor(13 * 256 / 8) = 416
    //    EIAS = min(75, floor(120*90/210) + 0 - (-30)) = 75
    //    stepSpeed256 = floor(416 * 175 / 100) = 728 -> ceil(13*256/728) - 1 = 4 ticks (160ms)!
    const wolfOnWeaponIas = resolveCharacterAnimSpeedParams(5, 'a1', {
      morphMonsterClassId: 430,
      equipment: [
        {
          id: 1,
          code: '7cr',
          equippedSlot: 4,
          stats: [{ id: 93, value: 90 }],
        },
      ],
    })
    expect(
      resolvePrimaryWeaponIas113c({
        equipment: [{ id: 1, code: '7cr', equippedSlot: 4, stats: [{ id: 93, value: 90 }] }],
      }),
    ).toBe(90)
    expect(computeShapeshiftWeaponDelay113c(5, '1hs', -30, 90, true)).toBe(8)
    expect(wolfOnWeaponIas.baseSpeed).toBe(416)
    expect(wolfOnWeaponIas.effRate).toBe(75)
    expect(wolfOnWeaponIas.stepSpeed256).toBe(728)
    expect(computeOneShotTicks(wolfOnWeaponIas.frames, wolfOnWeaponIas.stepSpeed256)).toBe(4)

    // 2) With 0% on-weapon IAS and +90% OFF-WEAPON IAS (gloves/armor in slot 3):
    //    weaponDelay only sees weaponIas = 0 -> floor(19 * 256 / floor(256 * 130 / 100)) = floor(4864 / 332) = 14
    //    morphBaseSpeed = floor(13 * 256 / 14) = 237 (much slower than 416!)
    const wolfOffWeaponIas = resolveCharacterAnimSpeedParams(5, 'a1', {
      morphMonsterClassId: 430,
      equipment: [
        { id: 1, code: '7cr', equippedSlot: 4, stats: [] },
        { id: 2, code: 'utg', equippedSlot: 10, stats: [{ id: 93, value: 90 }] },
      ],
    })
    expect(computeShapeshiftWeaponDelay113c(5, '1hs', -30, 0, true)).toBe(14)
    expect(wolfOffWeaponIas.baseSpeed).toBe(237)
    expect(wolfOffWeaponIas.stepSpeed256).toBeLessThan(wolfOnWeaponIas.stepSpeed256)
  })

  it('separates Amazon Dodge state 65 from Vampire morph 176, supports Delirium Bone Fetish state 177 (FK/212), and maps morph modes per 0x6FD9F780 (#1263)', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 0, // Amazon
        name: 'Ama',
        x: 5000,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })

    // 1) State 65 (Amazon passive Dodge) MUST NOT morph the player into a Vampire ('VA')!
    world.apply({ type: 'StateSet', unit: { unitType: 'player', id: 1 }, state: 65 })
    const unit = world.getUnit('player', 1)!
    const drawables65 = buildSceneDrawables([toRenderableUnit(unit)]).unitDrawables
    expect(drawables65[0]!.token).toBe('AM')
    expect(world.resolvePlayerAnimSpeed('sc', 1).frames).toBe(20) // Human Amazon SC (20f), NOT Vampire (15f)!

    // 2) State 177 (Delirium) morphs the player into Bone Fetish ('FK', MonStats 212, 12f A1/SC @ 256)
    world.apply({ type: 'StateSet', unit: { unitType: 'player', id: 1 }, state: 177 })
    const drawables177 = buildSceneDrawables([toRenderableUnit(unit)]).unitDrawables
    expect(drawables177[0]!.token).toBe('FK')
    const fetishAttack = world.resolvePlayerAnimSpeed('a1', 1)
    expect(fetishAttack.frames).toBe(12)
    expect(fetishAttack.baseSpeed).toBe(256)

    // 3) Werebear (431) S3 (Shock Wave) = 10f@208, S4 (Fire Claws/Hunger) = 7f@152, GH = 5f@184, BL = 5f@200
    expect(getCharAnimClip113c(5, 's3', { morphMonsterClassId: 431 })).toMatchObject({
      frames: 10,
      speed: 208,
      actionFrame: 6,
    })
    expect(getCharAnimClip113c(5, 's4', { morphMonsterClassId: 431 })).toMatchObject({
      frames: 7,
      speed: 152,
      actionFrame: 4,
    })
    expect(getCharAnimClip113c(5, 'gh', { morphMonsterClassId: 431 })).toMatchObject({
      frames: 5,
      speed: 184,
    })
    expect(getCharAnimClip113c(5, 'bl', { morphMonsterClassId: 431 })).toMatchObject({
      frames: 5,
      speed: 200,
    })
    // Shock Wave (#243) uses monsterMode 10 / monanim S3
    expect(getSkillAnimModes(243)).toMatchObject({
      playerMode: 10,
      monsterMode: 10,
      anim: 'SC',
      monanim: 'S3',
    })
  })
})
