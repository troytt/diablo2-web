/**
 * Issue #1301 — 1.13c Stamina Exhaustion Run-to-Walk Fallback (`STAT_STAMINA == 0`).
 *
 * Verified against 1.13c assembly:
 * - `D2Client.dll` `ProcessClick` (`0x6facbf20` @ `0x6facbfd5..0x6facbfee`):
 *   Checks `D2Common_GetUnitStat(pPlayer, STAT_STAMINA = 10, 0)`. When `0`, suppresses
 *   `ClickInfo` run flag `0x40` so movement dispatches walk packets (`0x01`/`0x02`) and walk
 *   `minStep` (`3`/`4` instead of `5`), while preserving the HUD Always-Run toggle state.
 * - `D2Client.dll` `0x6facc50c -> 0x6fac9d80` (`Player_CheckRunStaminaExhausted`):
 *   Every tick while `pPlayer->dwAnimMode == 3` (`PLRMODE_RUN`), if `STAT_STAMINA == 0`,
 *   immediately transitions the local player into `PLRMODE_WALK (2)` (or `PLRMODE_TWALK (6)` in town).
 * - `D2Client.dll` `0x6faeae40` (`0x6faeae73`) & `D2Game.dll` `0x6fc98610` (`0x6fc9865e..0x6fc98684`):
 *   Prevents entering `PLRMODE_RUN (3)` while `STAT_STAMINA == 0`.
 */

import { describe, expect, it } from 'vitest'
import { CommandMapper, ViewportCamera } from '../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { OutboundRateLimiter } from '../../src/client/session/rate-limiter.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { D2StatId } from '../../src/client/world/stat-list.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'

describe('Issue #1301 — Stamina exhaustion forces walk mode and walk packets (1.13c ground truth)', () => {
  it('suppresses running on ground click, hold, and Ctrl-hold when stamina is 0 while preserving Always-Run toggle', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'LoadAct',
      act: 0,
      mapSeed: 12345,
      areaId: 2, // Blood Moor (outside town)
    })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 1, name: 'Runner', x: 5000, y: 5000 },
      isSelf: true,
    })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxHp, value: 100 << 8 })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxMana, value: 100 << 8 })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxStamina, value: 100 << 8 })
    world.apply({
      type: 'LifeMana',
      life: 100,
      mana: 100,
      stamina: 0,
      at: { x: 5000, y: 5000 },
    })

    const camera = new ViewportCamera(800, 600)
    camera.snapTo(5000, 5000)
    const hudManager = new HudManager()
    hudManager.isRunning = true
    const predictor = new LocalMovementPredictor({ initialX: 5000, initialY: 5000 })
    const commands: ClientCommand[] = []
    const hudModel = new HudModel({
      world,
      hudManager,
      predictor,
      onCommand: (cmd) => commands.push(cmd),
    })
    hudModel.syncFromWorld()

    const mapper = new CommandMapper({
      world,
      camera,
      hudManager,
      hudModel,
      predictor,
      rateLimiter: new OutboundRateLimiter(),
      sendCommand: (cmd) => {
        commands.push(cmd)
      },
    })

    expect(hudModel.isRunMode).toBe(true)
    expect(mapper.isStaminaExhausted()).toBe(true)

    // Click ground while stamina === 0 -> must dispatch Move with run: false (WalkToLocation)
    const rec1 = mapper.triggerPrimaryWorldAction(5010, 5000, null, 1000, false)
    expect(rec1?.command).toEqual({
      type: 'Move',
      to: { x: 5010, y: 5000 },
      run: false,
    })
    expect(predictor.getSnapshot().running).toBe(false)
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBeCloseTo(9.0, 5)
    expect(world.getUnit('player', 1)?.mode).toBe(2) // PLRMODE_WALK
    expect(world.getUnit('player', 1)?.moveMode).toBe('walk')
    // Always-Run toggle itself remains ON so running resumes once stamina recovers
    expect(hudModel.isRunMode).toBe(true)

    // Hold Ctrl while stamina === 0 -> still cannot run
    mapper.handleKeyDown({ key: 'Control', code: 'ControlLeft' }, 1100)
    const rec2 = mapper.triggerPrimaryWorldAction(5015, 5000, null, 1200, true)
    expect(rec2?.command).toEqual({
      type: 'Move',
      to: { x: 5015, y: 5000 },
      run: false,
    })
    expect(predictor.getSnapshot().running).toBe(false)
    mapper.handleKeyUp({ key: 'Control', code: 'ControlLeft' }, 1250)

    // Stamina recovers > 0 -> running resumes automatically with Always-Run still ON
    world.apply({
      type: 'LifeMana',
      life: 100,
      mana: 100,
      stamina: 40,
      at: { x: 5000, y: 5000 },
    })
    hudModel.syncVitalsFromWorld()
    expect(mapper.isStaminaExhausted()).toBe(false)

    const rec3 = mapper.triggerPrimaryWorldAction(5020, 5000, null, 1500, false)
    expect(rec3?.command).toEqual({
      type: 'Move',
      to: { x: 5020, y: 5000 },
      run: true,
    })
    expect(predictor.getSnapshot().running).toBe(true)
    expect(predictor.getEffectiveSpeedSubTilesPerSec()).toBeCloseTo(13.5, 5)
    expect(world.getUnit('player', 1)?.mode).toBe(3) // PLRMODE_RUN
    expect(world.getUnit('player', 1)?.moveMode).toBe('run')
  })

  it('transitions an actively running local player from PLRMODE_RUN (3) to PLRMODE_WALK (2) mid-run when stamina drains to 0', () => {
    const session = new OnlineSession()
    session.handleServerEvent({
      type: 'LoadAct',
      act: 0,
      mapSeed: 12345,
      areaId: 2, // Blood Moor (outside town)
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 1, name: 'Runner', x: 5000, y: 5000 },
      isSelf: true,
    })
    session.handleServerEvent({ type: 'StatSet', stat: D2StatId.MaxHp, value: 100 << 8 })
    session.handleServerEvent({ type: 'StatSet', stat: D2StatId.MaxMana, value: 100 << 8 })
    session.handleServerEvent({ type: 'StatSet', stat: D2StatId.MaxStamina, value: 100 << 8 })
    session.handleServerEvent({
      type: 'LifeMana',
      life: 100,
      mana: 100,
      stamina: 50,
      at: { x: 5000, y: 5000 },
      vx: 0,
      vy: 0,
    })

    // Start running toward (5030, 5000)
    session.commandMapper.triggerPrimaryWorldAction(5030, 5000, null, 1000, false)
    session.tick(40, 1040)

    const selfUnit = session.world.getUnit('player', 1)!
    expect(selfUnit.mode).toBe(3) // PLRMODE_RUN
    expect(selfUnit.moveMode).toBe('run')
    expect(session.predictor.getSnapshot().running).toBe(true)
    expect(session.predictor.getEffectiveSpeedSubTilesPerSec()).toBeCloseTo(13.5, 5)

    // Server drains stamina to 0 mid-run via LifeMana
    session.handleServerEvent({
      type: 'LifeMana',
      life: 100,
      mana: 100,
      stamina: 0,
      at: { x: Math.round(session.predictor.getSnapshot().x), y: 5000 },
      vx: 0,
      vy: 0,
    })

    expect(session.predictor.isStaminaExhausted()).toBe(true)
    expect(session.predictor.getSnapshot().running).toBe(false)
    expect(session.predictor.getEffectiveSpeedSubTilesPerSec()).toBeCloseTo(9.0, 5)
    expect(selfUnit.mode).toBe(2) // PLRMODE_WALK
    expect(selfUnit.moveMode).toBe('walk')
    expect(session.world.self.mode).toBe(2)

    // Advancing frames keeps the player walking (mode 2), never reverting to mode 3 while stamina is 0
    session.tick(40, 1080)
    expect(selfUnit.mode).toBe(2)
    expect(selfUnit.moveMode).toBe('walk')
  })

  it('also downgrades mid-run to walk when StatSet updates STAT_STAMINA (10) to 0', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'LoadAct',
      act: 0,
      mapSeed: 12345,
      areaId: 2,
    })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 1, name: 'Runner', x: 5000, y: 5000 },
      isSelf: true,
    })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxStamina, value: 80 << 8 })
    world.apply({ type: 'StatSet', stat: D2StatId.Stamina, value: 40 << 8 })
    world.noteOutgoingCommand({
      type: 'Move',
      to: { x: 5020, y: 5000 },
      run: true,
    })
    expect(world.getUnit('player', 1)?.mode).toBe(3)
    expect(world.getUnit('player', 1)?.moveMode).toBe('run')

    // Drain stamina to 0 via StatSet
    world.apply({ type: 'StatSet', stat: D2StatId.Stamina, value: 0 })
    expect(world.getUnit('player', 1)?.mode).toBe(2)
    expect(world.getUnit('player', 1)?.moveMode).toBe('walk')
    expect(world.self.mode).toBe(2)
  })
})
