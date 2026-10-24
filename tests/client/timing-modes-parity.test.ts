/**
 * Parity Test Suite for Batch 1 Phase 3 Issues: #565, #566, #573, #575.
 *
 * Ground truth parity verified against:
 * - #565: Skills.txt anim / monanim mode mapping (PlrMode / MonMode)
 * - #566: Monster knockback MonMode 13 (KB) vs 9 (S2), arrival reset, and clip mapping
 * - #573: Warp hover parity (Levels.txt LevelWarp -> tbl string, LvlWarp.txt SelectDX/DY bounds)
 * - #575: 1.13c non-movement rate limiter bypass and 200ms tick delta clamping
 */

import { describe, expect, it, vi } from 'vitest'
import { getSkillAnimModes } from '../../src/common/skills/skill-anim-modes.ts'
import { resolveLevelWarpName, resolveLvlWarpBounds } from '../../src/common/world/level-warps-meta.ts'
import { OutboundRateLimiter, DEFAULT_RATE_LIMITS } from '../../src/client/session/rate-limiter.ts'
import { ClientUnit } from '../../src/client/world/client-unit.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import type { ClientCommand } from '../../src/netproto/domain/client-command.ts'

describe('Batch 1 Phase 3 Parity (#565, #566, #573, #575)', () => {
  // ─── #565: Skills.txt anim / monanim mode mapping ─────────────────────────
  describe('#565: Skills.txt anim / monanim mode mapping', () => {
    it('maps skill animations to 1.13c PlrMode and MonMode values without hardcoded physical sets', () => {
      // Throw (2) -> anim: TH (PlrMode 11)
      const throwModes = getSkillAnimModes(2)
      expect(throwModes.playerMode).toBe(11)

      // Kick (1) -> anim: KK (PlrMode 12)
      const kickModes = getSkillAnimModes(1)
      expect(kickModes.playerMode).toBe(12)

      // Smite (97) -> anim: S1 (PlrMode 13)
      const smiteModes = getSkillAnimModes(97)
      expect(smiteModes.playerMode).toBe(13)

      // Charge (107) -> anim: SQ (PlrMode 18)
      const chargeModes = getSkillAnimModes(107)
      expect(chargeModes.playerMode).toBe(18)

      // Teleport (54) -> anim: SC (PlrMode 10)
      const tpModes = getSkillAnimModes(54)
      expect(tpModes.playerMode).toBe(10)

      // Standard Attack (0) -> anim: A1 (PlrMode 7)
      const attackModes = getSkillAnimModes(0)
      expect(attackModes.playerMode).toBe(7)
    })

    it('sets player unit mode according to Skills.txt anim in ClientWorld SkillCast', () => {
      const world = new ClientWorld()
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 0, id: 1, classId: 0, name: 'Amazon', x: 100, y: 100 },
        isSelf: true,
      })
      world.selfId = 1
      const player = world.getUnit('player', 1)!
      expect(player).toBeDefined()

      // Cast Throw (skillId 2) -> should set mode 11 (TH), not attack (7) or cast (10)
      world.apply({
        type: 'SkillCast',
        caster: { unitType: 0, id: 1 },
        skillId: 2,
        target: { x: 105, y: 100 },
      })
      expect(player.mode).toBe(11)

      // Cast Smite (skillId 97) -> should set mode 13 (S1)
      world.apply({
        type: 'SkillCast',
        caster: { unitType: 0, id: 1 },
        skillId: 97,
        target: { x: 105, y: 100 },
      })
      expect(player.mode).toBe(13)
    })
  })

  // ─── #566: Monster knockback mode 13 vs 9 ─────────────────────────────────
  describe('#566: Monster knockback MonMode 13 (KB) parity', () => {
    it('sets monster mode to 13 (KB) on knockback in ClientUnit.applyMove', () => {
      const monster = new ClientUnit({
        id: 10,
        unitType: 'monster',
        classId: 1,
        x: 50,
        y: 50,
        name: 'Zombie',
      })
      monster.applyMove('knockback', { x: 55, y: 50 }, { x: 50, y: 50 })
      expect(monster.mode).toBe(13)

      const player = new ClientUnit({
        id: 1,
        unitType: 'player',
        classId: 0,
        x: 10,
        y: 10,
        name: 'Barbarian',
      })
      player.applyMove('knockback', { x: 15, y: 10 }, { x: 10, y: 10 })
      expect(player.mode).toBe(19) // PlrMode KB is 19
    })

    it('resets monster mode 13 (KB) to 1 (NU) upon destination arrival, but preserves mode 9 (S2)', () => {
      const world = new ClientWorld()
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 101, classId: 1, x: 49.95, y: 50 },
      })
      const monsterKb = world.getUnit('monster', 101)!
      monsterKb.mode = 13
      monsterKb.moveMode = 'knockback'
      monsterKb.targetX = 50
      monsterKb.targetY = 50

      // Monster in mode 9 (legitimate skill 2 cast)
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 102, classId: 1, x: 60, y: 60 },
      })
      const monsterS2 = world.getUnit('monster', 102)!
      monsterS2.mode = 9
      monsterS2.moveMode = 'stop'
      monsterS2.targetX = 60
      monsterS2.targetY = 60

      // Step tick (simulating arrival at destination)
      world.tick(40, 1000)

      // Knockback monster arrived: mode 13 resets to 1 (NU)
      expect(monsterKb.mode).toBe(1)
      expect(monsterKb.moveMode).toBe('stop')

      // S2 monster: mode 9 MUST NOT be reset to 1!
      expect(monsterS2.mode).toBe(9)
    })
  })

  // ─── #573: Warp hover parity ──────────────────────────────────────────────
  describe('#573: Warp hover localized naming & geometry hitbox', () => {
    it('resolves localized level warp names from Levels.txt LevelWarp and .tbl', () => {
      const denNames = resolveLevelWarpName(8)
      expect(denNames).toBeDefined()
      expect(denNames?.name).toBe('To The Den of Evil')
      expect(denNames?.nameZh).toBeTruthy()

      const bloodMoorNames = resolveLevelWarpName(2)
      expect(bloodMoorNames).toBeDefined()
      expect(bloodMoorNames?.name).toBe('To The Blood Moor')
    })

    it('resolves accurate selection bounds from LvlWarp.txt SelectDX/SelectDY', () => {
      // Warp 0: SelectDX=90, SelectDY=110 -> radiusX=45, radiusY=55
      const b0 = resolveLvlWarpBounds(0)
      expect(b0.selectDX).toBe(90)
      expect(b0.selectDY).toBe(110)
      expect(b0.radiusX).toBe(45)
      expect(b0.radiusY).toBe(55)

      // Warp 10: SelectDX=150, SelectDY=80 -> radiusX=75, radiusY=40
      const b10 = resolveLvlWarpBounds(10)
      expect(b10.selectDX).toBe(150)
      expect(b10.selectDY).toBe(80)
      expect(b10.radiusX).toBe(75)
      expect(b10.radiusY).toBe(40)
    })

    it('populates accurate warp name and bounds in OnlineSession.buildRenderableUnits', () => {
      const session = new OnlineSession()
      session.levelView = {
        act: 0,
        areaId: 2,
        subOriginX: 5000,
        subOriginY: 5000,
        subWidth: 100,
        subHeight: 100,
        isoOriginX: 0,
        isoOriginY: 0,
        cellsX: 20,
        cellsY: 20,
        gridWidth: 100,
        blocked: new Uint8Array(100),
        walkable: new Uint8Array(100).fill(1),
        collisionMasks: new Uint16Array(100),
        rooms: [],
        floors: [],
        shadows: [],
        walls: [],
        roofs: [],
        warps: [{ lvlWarpId: 4, toLevelId: 8 }],
        presets: [],
      } as any

      session.handleServerEvent({
        type: 'UnitAssign',
        unit: { unitType: 5, id: 301, classId: 4, warpId: 4, x: 5020, y: 5020 } as any,
      })

      const renderables = session.buildRenderableUnits()
      const warp = renderables.find((u) => u.id === 301)
      expect(warp).toBeDefined()
      expect(warp?.name).toBe('To The Den of Evil')
      expect(warp?.nameZh).toBeTruthy()
      expect(warp?.radiusX).toBeGreaterThan(0)
      expect(warp?.radiusY).toBeGreaterThan(0)
      session.destroy()
    })
  })

  // ─── #575: Non-movement rate limiter bypass & tick clamp ────────────────────
  describe('#575: Rate limiter non-movement bypass & tick clamp', () => {
    it('does not throttle consecutive non-movement commands with DEFAULT_RATE_LIMITS', () => {
      const limiter = new OutboundRateLimiter()
      expect(DEFAULT_RATE_LIMITS.skillMinIntervalMs).toBe(0)
      expect(DEFAULT_RATE_LIMITS.interactionMinIntervalMs).toBe(0)

      const interactCmd: ClientCommand = {
        type: 'Interact',
        target: { unitType: 2, id: 50 },
      }

      // Consecutive rapid interaction clicks within 10ms
      const first = limiter.tryAcquire(interactCmd, 1000)
      const second = limiter.tryAcquire(interactCmd, 1010)
      const third = limiter.tryAcquire(interactCmd, 1020)

      expect(first.allowed).toBe(true)
      expect(second.allowed).toBe(true)
      expect(third.allowed).toBe(true)
    })

    it('always allows non-movement commands in OnlineSession.dispatchCommand without swallowing', () => {
      const session = new OnlineSession()
      const noteSpy = vi.spyOn(session.world, 'noteOutgoingCommand')

      const cmd1: ClientCommand = { type: 'Interact', target: { unitType: 2, id: 10 } }
      const cmd2: ClientCommand = { type: 'Interact', target: { unitType: 2, id: 10 } }

      expect(session.dispatchCommand(cmd1, 1000)).toBe(true)
      expect(session.dispatchCommand(cmd2, 1005)).toBe(true)
      expect(noteSpy).toHaveBeenCalledTimes(2)

      session.destroy()
    })

    it('clamps delta-time accumulator to 200ms in OnlineSession.tick to prevent death spiral', () => {
      const session = new OnlineSession()
      const worldTickSpy = vi.spyOn(session.world, 'tick')

      // Tick with huge dtMs = 5000 (e.g. background tab or lag spike)
      session.tick(5000, 6000)

      // World tick should have received clampedDt = 200
      expect(worldTickSpy).toHaveBeenCalledWith(200, 6000)

      session.destroy()
    })
  })
})
