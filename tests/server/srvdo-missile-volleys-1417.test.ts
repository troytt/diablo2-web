/**
 * #1417: production `GameInstance` player casts follow the 1.13c `Skills.txt` `srvdofunc` missile
 * volleys of `D2Game.dll` (`gpSkillSrvDoFnTable` @ `0x6FD274A8`) instead of launching one
 * `srvmissile` for every missile skill. Ground truth: `samples/d2/D2Game.dll` and
 * `samples/d2/excel/Skills.txt`; see `kb/skills/player-srvdo-missile-volleys-113c.md`.
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry, type SkillRecord } from '../../src/common/data/data-registry.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  classifyPlayerSrvDoMissile113c,
  srvdo008FanTargets113c,
  srvdo008StepVector113c,
  strafeShotCount113c,
} from '../../src/server/engine/player-srvdo-113c.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'
import { writeD2sSave113c } from '../../src/server/save/d2s-writer.ts'
import { createSampleD2sCharacterData } from '../e2e/server-reuse/helpers.ts'

type AnyEvent = ServerEvent & Record<string, unknown>

const CLASS_CODES = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'] as const

function setupGame(seed: number, charClass: number, skills: Readonly<Record<number, number>>) {
  const game = new GameInstance({ seed, difficulty: 0, areaId: 2 })
  const playerId = game.connectPlayer({
    d2sBytes: writeD2sSave113c(
      createSampleD2sCharacterData({
        name: `Volley${charClass}`,
        charClass,
        level: 30,
        skillLevels: new Uint8Array(30),
        attributesOverrides: { maxManaFixed: 5000 * FIXED_ONE, manaFixed: 5000 * FIXED_ONE },
      }),
    ),
    x: 100,
    y: 100,
    areaId: 2,
    skills,
  })
  game.drainEvents(playerId)
  return { game, playerId }
}

function castAt(game: GameInstance, playerId: number, skillId: number, x: number, y: number): AnyEvent[] {
  game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId, x, y, hand: 'right' })
  game.stepFrames(1)
  return (game.drainEvents(playerId) as AnyEvent[]).filter((e) => e.type === 'CreateMissile')
}

function missileId(name: string): number {
  return getSharedDataRegistry().getMissileByName(name)!.id
}

describe('#1417 SrvDo008 fan math (0x6FC6D420, 0x6FCBE490 / 0x6FCBE450)', () => {
  it('step vector: scale short aim vectors, rotate 90 degrees, halve until |step|^2 <= 3', () => {
    expect(srvdo008StepVector113c(10, 0)).toEqual({ sx: 0, sy: -1 })
    expect(srvdo008StepVector113c(0, 10)).toEqual({ sx: 1, sy: -0 })
    expect(srvdo008StepVector113c(10, 10)).toEqual({ sx: 1, sy: -1 })
    // |d|^2 = 1 < 4 -> x4 = (4,0), 16 is not < 16 -> rotate (0,-4) -> halve to (0,-1)
    expect(srvdo008StepVector113c(1, 0)).toEqual({ sx: 0, sy: -1 })
  })

  it('Multiple Shot slvl 1: 2 arrows (calc1 min(24,ln12), Param1=2), both proc-capable (calc3 = 2)', () => {
    const t = srvdo008FanTargets113c(100, 100, 110, 100, 2, 2)
    expect(t).toEqual([
      { x: 110, y: 101, canTriggerProcs: true },
      { x: 110, y: 100, canTriggerProcs: true },
    ])
  })

  it('Multiple Shot slvl 20: 21 arrows, middle 2 (calc3) may proc, line centred on the target', () => {
    const t = srvdo008FanTargets113c(100, 100, 110, 100, 21, 2)
    expect(t).toHaveLength(21)
    // start = target - trunc(step * 21 / 2) = 100 - trunc(-21/2) = 110
    expect(t[0]).toEqual({ x: 110, y: 110, canTriggerProcs: false })
    expect(t[20]).toEqual({ x: 110, y: 90, canTriggerProcs: false })
    expect(t.map((m) => m.canTriggerProcs).indexOf(true)).toBe(9)
    expect(t.filter((m) => m.canTriggerProcs)).toHaveLength(2)
  })

  it('calc3 = 0 (Teeth, empty cell) makes every missile proc-capable', () => {
    expect(srvdo008FanTargets113c(100, 100, 100, 120, 5, 0).every((m) => m.canTriggerProcs)).toBe(true)
  })
})

describe('#1417 SrvSt008 Strafe shot count (0x6FC6C870)', () => {
  it('min(max(min(calc3, calc1), targets), calc1)', () => {
    // slvl 1: calc1 = min(par3 + lvl - 1, par4) = 4, calc3 = 2 + lvl/4 = 2
    expect(strafeShotCount113c(4, 2, 0)).toBe(2)
    expect(strafeShotCount113c(4, 2, 1)).toBe(2)
    expect(strafeShotCount113c(4, 2, 3)).toBe(3)
    expect(strafeShotCount113c(4, 2, 9)).toBe(4)
    // slvl 20: calc1 = min(23, 10) = 10, calc3 = 7
    expect(strafeShotCount113c(10, 7, 3)).toBe(7)
    expect(strafeShotCount113c(10, 7, 15)).toBe(10)
    expect(strafeShotCount113c(3, 7, 0)).toBe(3)
  })
})

describe('#1417 GameInstance missile volleys per Skills.txt srvdofunc', () => {
  it('Multiple Shot (12, srvdo 8): slvl 1 fires 2 multipleshotarrow, slvl 20 fires 21', () => {
    for (const [slvl, expected] of [
      [1, 2],
      [20, 21],
    ] as const) {
      const { game, playerId } = setupGame(0x1417 + slvl, 0, { 12: slvl })
      const created = castAt(game, playerId, 12, 110, 100)
      expect(created).toHaveLength(expected)
      expect(created.every((e) => e.missileClassId === missileId('multipleshotarrow'))).toBe(true)
      const targets = created.map((e) => `${String(e.targetX)},${String(e.targetY)}`)
      expect(new Set(targets).size).toBe(expected)
    }
  })

  it('Teeth (67, srvdo 8): slvl 1 fires 2 teeth, slvl 5 fires 6', () => {
    for (const [slvl, expected] of [
      [1, 2],
      [5, 6],
    ] as const) {
      const { game, playerId } = setupGame(0x1467 + slvl, 2, { 67: slvl })
      const created = castAt(game, playerId, 67, 110, 104)
      expect(created).toHaveLength(expected)
      expect(created.every((e) => e.missileClassId === missileId('teeth'))).toBe(true)
    }
  })

  it('Shock Wave (243, srvdo 8) is bear-only (Skills.txt restrict = 2, State1 = bear): refused in human form', () => {
    const { game, playerId } = setupGame(0x14f3, 5, { 243: 1 })
    expect(castAt(game, playerId, 243, 110, 100)).toHaveLength(0)
    // its fan is calc1 = 5 missiles once cast
    expect(srvdo008FanTargets113c(100, 100, 110, 100, 5, 0)).toHaveLength(5)
  })

  it('Charged Bolt (38, srvdo 17): slvl 1 fires 3 chargedbolt (Param1=3), slvl 30 caps at 24', () => {
    for (const [slvl, expected] of [
      [1, 3],
      [10, 12],
      [30, 24],
    ] as const) {
      const { game, playerId } = setupGame(0x1438 + slvl, 1, { 38: slvl })
      const created = castAt(game, playerId, 38, 110, 100)
      expect(created).toHaveLength(expected)
      expect(created.every((e) => e.missileClassId === missileId('chargedbolt'))).toBe(true)
    }
  })

  it('Twister (240, srvdo 118): calc1 = par1 = 3 twisters; Tornado (245) calc1 = 1; Firestorm (225, srvdo 117) calc1 = 3', () => {
    const cases = [
      [240, 'twister', 3],
      [245, 'tornado', 1],
      [225, 'firestormmaker', 3],
    ] as const
    for (const [skillId, name, expected] of cases) {
      const { game, playerId } = setupGame(0x1500 + skillId, 5, { [skillId]: 1 })
      const created = castAt(game, playerId, skillId, 110, 100)
      expect(created, `skill ${skillId}`).toHaveLength(expected)
      expect(created.every((e) => e.missileClassId === missileId(name))).toBe(true)
    }
  })

  it('Strafe (26, srvdo 12): one arrow per target inside aurarangecalc (par5 = 35), min calc3 shots, max calc1', () => {
    const { game, playerId } = setupGame(0x1426, 0, { 26: 1 })
    const monIds = [0, 1, 2].map((i) =>
      game.spawnMonster({ defId: 'fallen1', x: 105 + i * 3, y: 100, areaId: 2, hp: 5000, maxHp: 5000, aiDisabled: true }),
    )
    // Out of range (> 35 sub-tiles): never targeted.
    game.spawnMonster({ defId: 'fallen1', x: 160, y: 100, areaId: 2, hp: 5000, maxHp: 5000, aiDisabled: true })
    game.enqueueCommand(playerId, { type: 'CastSkillOnTarget', skillId: 26, targetType: 'monster', targetId: monIds[2]! })
    game.stepFrames(1)
    const created = (game.drainEvents(playerId) as AnyEvent[]).filter((e) => e.type === 'CreateMissile')
    // slvl 1: calc1 = min(4 + 1 - 1, 10) = 4, calc3 = 2 + 1/4 = 2, 3 targets -> 3 shots
    expect(created).toHaveLength(3)
    expect(created.every((e) => e.missileClassId === missileId('strafearrow'))).toBe(true)
    // the clicked monster is shot first, then nearest-first
    expect(created.map((e) => e.targetX)).toEqual([111, 105, 108])
  })

  it('Strafe with a single target in range still fires calc3 = 2 shots at it', () => {
    const { game, playerId } = setupGame(0x1427, 0, { 26: 1 })
    const mon = game.spawnMonster({ defId: 'fallen1', x: 106, y: 100, areaId: 2, hp: 5000, maxHp: 5000, aiDisabled: true })
    game.enqueueCommand(playerId, { type: 'CastSkillOnTarget', skillId: 26, targetType: 'monster', targetId: mon })
    game.stepFrames(1)
    const created = (game.drainEvents(playerId) as AnyEvent[]).filter((e) => e.type === 'CreateMissile')
    expect(created).toHaveLength(2)
    expect(created.every((e) => e.targetX === 106)).toBe(true)
  })
})

describe('#1417 class-of-bug sweep: every player missile srvdofunc is classified', () => {
  it('maps each Skills.txt class-skill srvdofunc that carries a server missile to a D2Game volley mode', () => {
    const registry = getSharedDataRegistry()
    const byMode = new Map<string, Set<number>>()
    for (let id = 0; id <= 280; id++) {
      const s: SkillRecord | undefined = registry.getSkillById(id)
      if (!s || !(CLASS_CODES as readonly string[]).includes(s.charClass)) continue
      if (s.srvMissile === '' && s.srvMissileA === '') continue
      const mode = classifyPlayerSrvDoMissile113c(s.srvDoFunc)
      if (!byMode.has(mode)) byMode.set(mode, new Set())
      byMode.get(mode)!.add(s.srvDoFunc)
    }
    const sorted = (mode: string) => [...(byMode.get(mode) ?? [])].sort((a, b) => a - b)
    expect(sorted('fan')).toEqual([8])
    expect(sorted('strafe')).toEqual([12])
    expect(sorted('volley')).toEqual([17, 117, 118])
    // 74 Double Throw is also a single-create srvdofunc, but its row has no srvmissile (weapon missile).
    expect(sorted('single')).toEqual([0, 10, 14, 26, 28, 73, 80])
    // Known srvdofuncs still lacking a GameInstance volley runtime; reported at cast time, never
    // silently treated as a verified single missile (22 Nova and 77 Leap have dedicated GameInstance paths).
    expect(sorted('unmodeled')).toEqual([11, 18, 19, 22, 23, 24, 29, 34, 43, 44, 48, 50, 54, 60, 63, 68, 75, 77, 121, 123, 124])
  })

  it('reports an unmodeled srvdofunc instead of silently treating it as a single missile', () => {
    const { game, playerId } = setupGame(0x1451, 1, { 51: 1 })
    castAt(game, playerId, 51, 110, 100)
    expect(game.getUnmodeledPlayerSrvDoFuncs()).toEqual([24])
  })
})
