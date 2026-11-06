import { describe, expect, it } from 'vitest'
import {
  getMonsterModeBaseFrameCount113c,
  resolveMonsterSequenceFrame113c,
  resolveMonsterSkillAnimMode113c,
} from '../../../src/common/path/monster-anim-metrics-113c.ts'
import { doesNpcModeMove113c } from '../../../src/client/motion/npc-motion.ts'
import { ClientWorld } from '../../../src/client/world/client-world.ts'
import { buildRenderableUnits } from '../../../src/client/session/session-render-builder.ts'

describe('Mercenary and Skeleton 1.13c attack animations (initial & post-movement)', () => {
  it('resolves exact 1.13c AnimData.d2 / monseq.txt frame counts for mercenaries and skeletons', () => {
    // Act 1 Rogue Hireling (271): A1 = 15 frames
    expect(getMonsterModeBaseFrameCount113c(271, 4)).toBe(15)
    // Act 2 Desert Mercenary (338): A1 = 16 frames, Jab SQ(14) = 14 steps (seq_act2guardjab reaching A1 frame 15)
    expect(getMonsterModeBaseFrameCount113c(338, 4)).toBe(16)
    expect(getMonsterModeBaseFrameCount113c(338, 14, 10)).toBe(14)
    // Act 3 Iron Wolf (359): A1 = 15 frames, SC = 18 frames
    expect(getMonsterModeBaseFrameCount113c(359, 4)).toBe(15)
    expect(getMonsterModeBaseFrameCount113c(359, 7)).toBe(18)
    // Act 5 Barbarian Hireling (560 / 561): A1 = 17 / 16 frames, A2 = 17 / 16 frames
    expect(getMonsterModeBaseFrameCount113c(560, 4)).toBe(17)
    expect(getMonsterModeBaseFrameCount113c(560, 5)).toBe(17)
    expect(getMonsterModeBaseFrameCount113c(561, 4)).toBe(16)
    expect(getMonsterModeBaseFrameCount113c(561, 5)).toBe(16)
    // Necromancer Skeleton (363) & Skeleton Mage (364): A1 = 16, A2 = 16
    expect(getMonsterModeBaseFrameCount113c(363, 4)).toBe(16)
    expect(getMonsterModeBaseFrameCount113c(363, 5)).toBe(16)
    expect(getMonsterModeBaseFrameCount113c(364, 4)).toBe(16)
    // Skeleton Mage has mSC=0 in MonStats2.txt; SC(7) falls back to A1(4) = 16 frames
    expect(resolveMonsterSkillAnimMode113c(364, 64, 7)).toBe(4)
  })

  it('steps Act 2 Mercenary Jab sequence (seq_act2guardjab) across all 14 sequence steps up to A1 frame 15', () => {
    const seenFrames: number[] = []
    for (let tick = 0; tick < 14; tick++) {
      const step = resolveMonsterSequenceFrame113c(338, tick * 40, 256, 10)
      expect(step).toBeDefined()
      expect(step?.clipKey).toBe('a1')
      expect(step?.totalSequenceFrames).toBe(14)
      seenFrames.push(step!.frameIndex)
    }
    expect(seenFrames[0]).toBe(2)
    expect(seenFrames[13]).toBe(15)
  })

  it('doesNpcModeMove113c (0x6FAFBFA0) only returns true for locomotion modes (WL=2, RN=15, KB=13) and *mv modes', () => {
    for (const classId of [271, 338, 359, 363, 364, 560, 561]) {
      expect(doesNpcModeMove113c(classId, 2)).toBe(true)
      expect(doesNpcModeMove113c(classId, 15)).toBe(true)
      expect(doesNpcModeMove113c(classId, 4)).toBe(false)
      expect(doesNpcModeMove113c(classId, 5)).toBe(false)
      expect(doesNpcModeMove113c(classId, 7)).toBe(false)
      expect(doesNpcModeMove113c(classId, 14)).toBe(false)
    }
  })

  it('preserves full attack animation frames and speed after movement for Act 2 Mercenary (338) and Skeleton (363)', () => {
    const world = new ClientWorld()
    world.selfId = 1

    const mercId = 100
    const skelId = 101
    const targetId = 200

    // Spawn Act 2 Mercenary (338), Necromancer Skeleton (363), and target enemy (0)
    world.applyEvent(
      {
        type: 'UnitAssign',
        unit: {
          id: mercId,
          unitType: 'monster',
          classId: 338,
          x: 5000,
          y: 5000,
          mode: 1,
          direction: 0,
          lifePct: 128,
        },
      } as any,
      1000,
    )
    world.applyEvent(
      {
        type: 'UnitAssign',
        unit: {
          id: skelId,
          unitType: 'monster',
          classId: 363,
          x: 5010,
          y: 5000,
          mode: 1,
          direction: 0,
          lifePct: 128,
        },
      } as any,
      1000,
    )
    world.applyEvent(
      {
        type: 'UnitAssign',
        unit: {
          id: targetId,
          unitType: 'monster',
          classId: 0,
          x: 5004,
          y: 5004,
          mode: 1,
          direction: 0,
          lifePct: 128,
        },
      } as any,
      1000,
    )

    // 1. First attack: Mercenary casts Jab (0x4C skillId=10 -> SQ mode 14) and Skeleton attacks (0x6C cmd 0x0A -> mode 4)
    world.applyEvent(
      {
        type: 'SkillCast',
        caster: { unitType: 'monster', id: mercId },
        skillId: 10,
        level: 5,
        target: { unitType: 'monster', id: targetId },
      } as any,
      1100,
    )
    world.applyEvent(
      {
        type: 'UnitMode',
        id: skelId,
        unitType: 'monster',
        mode: 4,
        at: { x: 5010, y: 5000 },
        npc: {
          opcode: 0x6c,
          cmd: 0x0a,
          s: [1, targetId, 0, 2, 0, 4, 0],
          driftCheckAt: { x: 5010, y: 5000 },
        },
      } as any,
      1100,
    )

    const mercUnit = world.getUnit('monster', mercId)!
    const skelUnit = world.getUnit('monster', skelId)!
    const mercNpc = world.npcMotion.getUnit(mercId)!
    const skelNpc = world.npcMotion.getUnit(skelId)!

    expect(mercUnit.mode).toBe(14)
    expect(mercNpc.wFrameCount >> 8).toBe(14)
    expect(skelUnit.mode).toBe(4)
    expect(skelNpc.wFrameCount >> 8).toBe(16)
    const initialMercAttackSpeed = mercNpc.wAnimSpeed
    const initialSkelAttackSpeed = skelNpc.wAnimSpeed

    // Step through first attack to completion (25 ticks = 1000ms)
    for (let t = 1140; t <= 2200; t += 40) {
      world.tick(40, t)
    }
    expect(mercUnit.mode).toBe(1)
    expect(skelUnit.mode).toBe(1)

    // 2. Both Mercenary and Skeleton move via 0x67 (which sets pDynamicPath.dwVelocity > 0 and dwFlagEx |= 0x2000)
    world.applyEvent(
      {
        type: 'UnitMove',
        id: mercId,
        unitType: 'monster',
        mode: 'walk',
        from: { x: 5000, y: 5000 },
        to: { x: 5015, y: 5015 },
        velocityPercent: 100,
      } as any,
      2500,
    )
    world.applyEvent(
      {
        type: 'UnitMove',
        id: skelId,
        unitType: 'monster',
        mode: 'walk',
        from: { x: 5010, y: 5000 },
        to: { x: 5020, y: 5015 },
        velocityPercent: 100,
      } as any,
      2500,
    )

    // Step movement for a few ticks
    for (let t = 2540; t <= 2700; t += 40) {
      world.tick(40, t)
    }
    expect(mercNpc.pDynamicPath!.dwVelocity).toBeGreaterThan(0)
    expect(skelNpc.pDynamicPath!.dwVelocity).toBeGreaterThan(0)

    // 3. Second attack AFTER moving: Mercenary 0x6C normal attack (cmd 0x0A -> mode 4) & Skeleton 0x6C A2 attack (cmd 0x10 -> mode 5) at t = 3000ms
    world.applyEvent(
      {
        type: 'UnitMode',
        id: mercId,
        unitType: 'monster',
        mode: 4,
        at: { x: 5012, y: 5012 },
        npc: {
          opcode: 0x6c,
          cmd: 0x0a,
          s: [1, targetId, 0, 2, 0, 4, 0],
          driftCheckAt: { x: 5012, y: 5012 },
        },
      } as any,
      3000,
    )
    world.applyEvent(
      {
        type: 'UnitMode',
        id: skelId,
        unitType: 'monster',
        mode: 5,
        at: { x: 5016, y: 5012 },
        npc: {
          opcode: 0x6c,
          cmd: 0x10,
          s: [1, targetId, 0, 2, 0, 4, 0],
          driftCheckAt: { x: 5016, y: 5012 },
        },
      } as any,
      3000,
    )

    // Verify neither unit started a walk path during its attack mode!
    expect(mercNpc.moving).toBe(false)
    expect(skelNpc.moving).toBe(false)
    expect(mercUnit.moveMode).toBe('stop')
    expect(skelUnit.moveMode).toBe('stop')
    expect(mercUnit.mode).toBe(4)
    expect(skelUnit.mode).toBe(5)

    // Verify animStartedAtMs and modeStartedAtMs were updated to 3000ms (not stuck at 1100ms!)
    expect(mercUnit.animStartedAtMs).toBe(3000)
    expect(mercUnit.modeStartedAtMs).toBe(3000)
    expect(skelUnit.animStartedAtMs).toBe(3000)
    expect(skelUnit.modeStartedAtMs).toBe(3000)

    // Verify full 16 frames and unpolluted attack speed
    expect(mercNpc.wFrameCount >> 8).toBe(16)
    expect(skelNpc.wFrameCount >> 8).toBe(16)
    expect(mercNpc.wAnimSpeed).toBe(initialMercAttackSpeed)
    expect(skelNpc.wAnimSpeed).toBe(initialSkelAttackSpeed)

    // Verify session-render-builder outputs the attack mode (4 and 5, NOT 2 WL) and animStartedAtMs = 3000
    const renderUnits = buildRenderableUnits(
      {
        world,
        lastObjectLightBuildFrame: 0,
        selfAppearanceCache: null,
        predictor: { getSnapshot: () => ({ x: 5000, y: 5000, moving: false, running: false, dir64: 0 }) },
        interpolator: { getEntityState: () => null },
        automapView: { getLevelView: () => null },
        commandMapper: { currentHoveredUnit: null },
        hudManager: { hoveredUnitId: null },
        isSubTileInTown: () => false,
        drainWorldSoundRequests: () => {},
      } as any,
      3040,
    )
    const renderedMerc = renderUnits.find((u) => u.id === mercId)!
    const renderedSkel = renderUnits.find((u) => u.id === skelId)!
    expect(renderedMerc.mode).toBe(4)
    expect(renderedMerc.animStartedAtMs).toBe(3000)
    expect(renderedSkel.mode).toBe(5)
    expect(renderedSkel.animStartedAtMs).toBe(3000)

    // Step 4 ticks (160ms) into the attack: both must STILL be in their attack mode (not prematurely truncated!)
    for (let t = 3040; t <= 3200; t += 40) {
      world.tick(40, t)
    }
    expect(mercUnit.mode).toBe(4)
    expect(skelUnit.mode).toBe(5)
    expect(mercNpc.wFrame >> 8).toBeGreaterThan(0)
    expect(mercNpc.wFrame >> 8).toBeLessThan(15)

    // Step to completion of the 16-frame attack
    for (let t = 3240; t <= 4000; t += 40) {
      world.tick(40, t)
    }
    expect(mercUnit.mode).toBe(1)
    expect(skelUnit.mode).toBe(1)

    // 4. Third attack AFTER moving: Mercenary 0x4C Jab (mode 14) at t = 4200ms
    world.applyEvent(
      {
        type: 'SkillCast',
        caster: { unitType: 'monster', id: mercId },
        skillId: 10,
        level: 5,
        target: { unitType: 'monster', id: targetId },
      } as any,
      4200,
    )
    expect(mercUnit.mode).toBe(14)
    expect(mercUnit.moveMode).toBe('stop')
    expect(mercNpc.moving).toBe(false)
    expect(mercUnit.animStartedAtMs).toBe(4200)
    expect(mercNpc.wFrameCount >> 8).toBe(14)

    // Mid-Jab (at +240ms): still in mode 14
    for (let t = 4240; t <= 4440; t += 40) {
      world.tick(40, t)
    }
    expect(mercUnit.mode).toBe(14)

    // After full 14-step Jab completes: cleanly returns to mode 1 (NU)
    for (let t = 4480; t <= 5300; t += 40) {
      world.tick(40, t)
    }
    expect(mercUnit.mode).toBe(1)
  })
})
