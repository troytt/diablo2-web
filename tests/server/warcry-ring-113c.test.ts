/**
 * Diablo II 1.13c Warcry Ring (`srvdofunc = 68` / `22`, `pSrvHitFunc = 17, 18, 21`, `pSrvDmgFunc = 7`)
 * and `SKILLS_ApplyWarcryStats` (`0x6FC49240`) / `SKILLS_DoSkillDo` (`0x6FCC19A0`) parity tests.
 *
 * Ground truth: `D2Game.dll` (`0x6FC49240`, `0x6FC49330`, `0x6FC49AC0`, `0x6FC58C70`, `0x6FC58EC0`,
 * `0x6FC5A890`, `0x6FC5AA00`, `0x6FC5AA90`, `0x6FCC19A0`, `0x6FD1B770`, `0x6FD1B870`).
 * Documented in `kb/skills/player/skills-bar-warcries.md` and `kb/ui/oracle-client-display-113c.md` §9.
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { createLinearMissilePath113c, stepLinearMissilePath113c } from '../../src/server/engine/missile-path-113c.ts'
import {
  srvdoRing64Targets113c,
  WARCRY_RING_DX_64,
  WARCRY_RING_DY_64,
} from '../../src/server/engine/player-srvdo-113c.ts'
import { FIXED_ONE, type UnitStatList } from '../../src/server/engine/stat-list.ts'
import { writeD2sSave113c } from '../../src/server/save/d2s-writer.ts'
import { createSampleD2sCharacterData } from '../e2e/server-reuse/helpers.ts'

type AnyEvent = ServerEvent & Record<string, unknown>

interface InternalPlayerView {
  readonly manaFixed: number
  readonly hpFixed: number
  readonly staminaFixed: number
}

interface InternalGameView {
  readonly players: Map<number, InternalPlayerView>
  playerCombatContext(p: InternalPlayerView): { readonly statList: UnitStatList }
  getPlayerAccruedMaxManaFixed(p: InternalPlayerView): number
  getPlayerAccruedMaxStaminaFixed(p: InternalPlayerView): number
}

function setupBarbarianGame(
  seed: number,
  skills: Readonly<Record<number, number>>,
  opts: { level?: number; mana?: number; maxMana?: number; hp?: number; maxHp?: number; stamina?: number; maxStamina?: number } = {},
) {
  const level = opts.level ?? 40
  const maxHp = opts.maxHp ?? 533
  const hp = opts.hp ?? maxHp
  const maxMana = opts.maxMana ?? 49
  const mana = opts.mana ?? maxMana
  const maxStamina = opts.maxStamina ?? 231
  const stamina = opts.stamina ?? maxStamina
  const game = new GameInstance({ seed, difficulty: 0, areaId: 2, mode: 'multiplayer', maxPlayers: 8 })
  const playerId = game.connectPlayer({
    d2sBytes: writeD2sSave113c(
      createSampleD2sCharacterData({
        name: 'WarcryBarb',
        charClass: 4,
        level,
        skillLevels: new Uint8Array(30),
        attributesOverrides: {
          maxHpFixed: maxHp * FIXED_ONE,
          hitpointsFixed: hp * FIXED_ONE,
          maxManaFixed: maxMana * FIXED_ONE,
          manaFixed: mana * FIXED_ONE,
          maxStaminaFixed: maxStamina * FIXED_ONE,
          staminaFixed: stamina * FIXED_ONE,
        },
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

describe('1.13c Warcry 64-missile ring & hit/damage handlers', () => {
  it('WARCRY_RING_DX_64 / WARCRY_RING_DY_64 match the 64-spoke radius-30 circle at 0x6FD1B870 / 0x6FD1B770', () => {
    expect(WARCRY_RING_DX_64).toHaveLength(64)
    expect(WARCRY_RING_DY_64).toHaveLength(64)
    expect([WARCRY_RING_DX_64[0], WARCRY_RING_DY_64[0]]).toEqual([30, 0])
    expect([WARCRY_RING_DX_64[16], WARCRY_RING_DY_64[16]]).toEqual([0, 30])
    expect([WARCRY_RING_DX_64[32], WARCRY_RING_DY_64[32]]).toEqual([-30, 0])
    expect([WARCRY_RING_DX_64[48], WARCRY_RING_DY_64[48]]).toEqual([0, -30])
    const targets = srvdoRing64Targets113c(100, 200)
    expect(targets).toHaveLength(64)
    expect(targets[0]).toEqual({ x: 130, y: 200 })
    expect(targets[32]).toEqual({ x: 70, y: 200 })
  })

  it('spawns 64 carrier missiles for #130 Howl, #138 Shout, #146 Battle Cry, #149 Battle Orders, #154 War Cry, #155 Battle Command', () => {
    const registry = getSharedDataRegistry()
    const cases = [
      [130, 'howl'],
      [138, 'shout'],
      [146, 'battlecry'],
      [149, 'battleorders'],
      [154, 'warcry'],
      [155, 'battlecommand'],
    ] as const
    for (const [skillId, missileName] of cases) {
      const { game, playerId } = setupBarbarianGame(0x900 + skillId, { [skillId]: 5 }, { mana: 500, maxMana: 500 })
      game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId, x: 105, y: 100, hand: 'right' })
      game.stepFrames(10)
      const created = (game.drainEvents(playerId) as AnyEvent[]).filter((e) => e.type === 'CreateMissile')
      expect(created, `skill ${skillId} (${missileName})`).toHaveLength(64)
      expect(created[0]!.missileClassId).toBe(registry.getMissileByName(missileName)!.id)
    }
  })

  it('#149 Battle Orders + #155 Battle Command: applies ISC 162 stamina%, scales vitals via 64-ring hit, and anti-downgrade blocks lower slvl', () => {
    // Battle Command (slvl 1 -> +1 all skills), then Battle Orders (hard 10 + 1 BC = slvl 11 -> +65% life/mana/stamina).
    const { game, playerId } = setupBarbarianGame(0x149, { 138: 10, 149: 10, 155: 1 })
    const internal = game as unknown as InternalGameView
    const pRec = internal.players.get(playerId)!
    const pCtx = internal.playerCombatContext(pRec)
    const baseMaxManaFixed = internal.getPlayerAccruedMaxManaFixed(pRec)
    const baseMaxStamFixed = internal.getPlayerAccruedMaxStaminaFixed(pRec)

    // Cast Battle Command (155) and step until ring hits caster
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 155, x: 100, y: 100, hand: 'right' })
    game.stepFrames(2)
    expect(game.getPlayerState(playerId)!.states.has(51)).toBe(true)
    expect(pCtx.statList.getAccruedStat(127)).toBe(1)

    const manaBeforeBoFixed = pRec.manaFixed

    // Cast Battle Orders (149, effective slvl 11 -> +65%)
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 149, x: 100, y: 100, hand: 'right' })
    game.stepFrames(1)
    expect(game.getPlayerState(playerId)!.states.has(32)).toBe(true)
    expect(pCtx.statList.getAccruedStat(76)).toBe(65)
    expect(pCtx.statList.getAccruedStat(77)).toBe(65)
    expect(pCtx.statList.getAccruedStat(162)).toBe(65)
    expect(pCtx.statList.getAccruedStat(163)).toBe(0)

    const newMaxManaFixed = internal.getPlayerAccruedMaxManaFixed(pRec)
    const newMaxStamFixed = internal.getPlayerAccruedMaxStaminaFixed(pRec)
    expect(newMaxStamFixed).toBe(baseMaxStamFixed + Math.trunc((baseMaxStamFixed * 65) / 100))

    // SrvDo068 (0x6FC49720) calls SKILLS_ApplyWarcryStats on caster BEFORE SKILLS_DoSkillDo (0x6FCC19A0 -> 0x6FCC1A35) deducts 7 mana (+1 tick regen).
    const scaledBeforeCostMana = Math.trunc((manaBeforeBoFixed * newMaxManaFixed) / baseMaxManaFixed) - 7 * FIXED_ONE
    expect(pRec.manaFixed).toBeGreaterThanOrEqual(scaledBeforeCostMana)
    expect(pRec.manaFixed).toBeLessThanOrEqual(scaledBeforeCostMana + 16)

    // Anti-downgrade: a second Barbarian casting slvl 1 Battle Orders (+35%) cannot overwrite slvl 11 (+65%)
    const p2Id = game.connectPlayer({
      d2sBytes: writeD2sSave113c(
        createSampleD2sCharacterData({
          name: 'WeakBarb',
          charClass: 4,
          level: 40,
          skillLevels: new Uint8Array(30),
          attributesOverrides: { maxManaFixed: 500 * FIXED_ONE, manaFixed: 500 * FIXED_ONE },
        }),
      ),
      x: 101,
      y: 100,
      areaId: 2,
      skills: { 149: 1 },
    })
    game.enqueueCommand(playerId, { type: 'PartyAction', action: 0x06, targetPlayerId: p2Id })
    game.enqueueCommand(p2Id, { type: 'PartyAction', action: 0x08, targetPlayerId: playerId })
    game.stepFrames(2)
    game.enqueueCommand(p2Id, { type: 'CastSkillAtLocation', skillId: 149, x: 100, y: 100, hand: 'right' })
    game.stepFrames(15)
    expect(pCtx.statList.getAccruedStat(76)).toBe(65)
  })

  it('#130 Howl checks slvl + 1 + clvl > mlvl and skips bosses; #146 Battle Cry debuffs bosses (0xA783)', () => {
    const registry = getSharedDataRegistry()
    const terrorId = registry.getStateByName('terror')!.id
    const battleCryId = registry.getStateByName('battlecry')!.id
    const { game, playerId } = setupBarbarianGame(0x130, { 130: 1, 146: 5 }, { level: 10, mana: 500, maxMana: 500 })
    // Normal monster mlvl 5 (< 1 + 1 + 10 = 12): terrified by Howl
    const lowMon = game.spawnMonster({ defId: 'fallen1', x: 103, y: 100, areaId: 2, level: 5, hp: 2000, maxHp: 2000, aiDisabled: true })
    // Normal monster mlvl 15 (>= 12): resists Howl
    const highMon = game.spawnMonster({ defId: 'fallen1', x: 100, y: 103, areaId: 2, level: 15, hp: 2000, maxHp: 2000, aiDisabled: true })
    // Boss monster (Andariel): immune to Howl (`0x8583`), legal target for Battle Cry (`0xA783`)
    const bossMon = game.spawnMonster({ defId: 'andariel', x: 97, y: 100, areaId: 2, level: 5, hp: 5000, maxHp: 5000, aiDisabled: true })

    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 130, x: 100, y: 100, hand: 'right' })
    game.stepFrames(15)
    expect(game.getMonster(lowMon)!.states.has(terrorId)).toBe(true)
    expect(game.getMonster(highMon)!.states.has(terrorId)).toBe(false)
    expect(game.getMonster(bossMon)!.states.has(terrorId)).toBe(false)

    // Battle Cry (#146) applies `battlecry` state even to boss monsters
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 146, x: 100, y: 100, hand: 'right' })
    game.stepFrames(15)
    expect(game.getMonster(bossMon)!.states.has(battleCryId)).toBe(true)
  })

  it('#154 War Cry deals physical damage via ring missiles and stuns non-boss monsters (immune on bosses)', () => {
    const registry = getSharedDataRegistry()
    const stunnedId = registry.getStateByName('stunned')!.id
    const { game, playerId } = setupBarbarianGame(0x154, { 154: 5 }, { level: 40, mana: 500, maxMana: 500 })
    const normalMon = game.spawnMonster({ defId: 'fallen1', x: 103, y: 100, areaId: 2, hp: 2000, maxHp: 2000, aiDisabled: true })
    const bossMon = game.spawnMonster({ defId: 'andariel', x: 97, y: 100, areaId: 2, hp: 5000, maxHp: 5000, aiDisabled: true })

    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 154, x: 100, y: 100, hand: 'right' })
    game.stepFrames(15)

    expect(game.getMonster(normalMon)!.hp).toBeLessThan(2000)
    expect(game.getMonster(normalMon)!.states.has(stunnedId)).toBe(true)
    expect(game.getMonster(bossMon)!.hp).toBeLessThan(5000)
    expect(game.getMonster(bossMon)!.states.has(stunnedId)).toBe(false)
  })

  it('PATH_StepVelocity (0x6FD5CEB0) steps warcry Accel=-600 every 5th tick matching 1.13c oracle sub-tiles', () => {
    // Missiles.txt #235 warcry: Vel=12, MaxVel=12, Accel=-600, Range=16 -> initial vel256 = 2304 (speed = 2304/4096)
    const path = createLinearMissilePath113c(5661, 5806, 5691, 5806, 2304 / 4096, -600, 12)
    let x = 5661
    const subTiles = [Math.round(x)]
    for (let tick = 1; tick <= 15; tick++) {
      const step = stepLinearMissilePath113c(path)
      x += step.vx
      subTiles.push(Math.round(x))
    }
    expect(subTiles).toEqual([
      5661, 5662, 5662, 5663, 5663, 5664, 5664, 5664, 5665, 5665, 5666, 5666, 5666, 5666, 5667, 5667,
    ])
    expect(path.vel256).toBe(504)
  })
})
