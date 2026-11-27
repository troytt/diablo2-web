import { describe, expect, it } from 'vitest'
import {
  MONSTER_BLOCK_NO_MODE_CHANGE_HCIDX_113C,
  shouldMonsterEnterBlockMode113c,
} from '../../src/server/engine/combat-pipeline.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { MONSTER_PATH_DATA, MONSTER_PATH_DATA_STRIDE } from '../../src/common/path/monster-path-data.ts'
import { MONMODE_BLOCK } from '../../src/common/path/types.ts'

const MON_MODE_SKILL3 = 10

function hasModeBL(hcIdx: number): boolean {
  return (MONSTER_PATH_DATA[hcIdx * MONSTER_PATH_DATA_STRIDE + 12]! & (1 << MONMODE_BLOCK)) !== 0
}

type MonsterRec = Record<string, unknown> & { mode: number; unitId: number }

/** Spawn `hcIdx`, put it in S3 (a boss skill), force a block roll and return the resulting mode + events. */
function blockOnceDuringSkill(hcIdx: number): {
  readonly mode: number
  readonly modeEvents: ReadonlyArray<Record<string, unknown>>
  readonly dealt: boolean
} {
  const game = new GameInstance({ difficulty: 0, mapSeed: 4242 })
  const playerId = game.addPlayer({
    name: 'Blocker',
    classId: 4,
    level: 30,
    strength: 80,
    dexterity: 60,
    vitality: 80,
    energy: 20,
    areaId: 3,
    x: 100,
    y: 100,
  })
  const internals = game as unknown as {
    players: Map<number, Record<string, unknown>>
    monsters: Map<number, MonsterRec>
    rng: { rand: (max: number) => number }
    outbox: Map<number, Array<Record<string, unknown>>>
    applyDamageToMonster: (
      attacker: unknown,
      monster: unknown,
      damage: number,
      skillId?: number,
      channel?: string,
    ) => boolean
  }
  const player = internals.players.get(playerId)!
  const monId = game.spawnMonster({ classId: hcIdx, x: 101, y: 100, areaId: 3 })
  const mon = internals.monsters.get(monId)!
  mon.toBlock = 75
  mon.mode = MON_MODE_SKILL3

  // Roll 0 -> hit lands on the to-hit roll, roll 0 -> block (0 < 75).
  const origRand = internals.rng.rand.bind(internals.rng)
  const rolls = [0, 0]
  internals.rng.rand = (max: number) => (rolls.length > 0 ? rolls.shift()! : origRand(max))

  internals.outbox.set(playerId, [])
  const dealt = internals.applyDamageToMonster(player, mon, 25, 0, 'phys')
  const modeEvents = (internals.outbox.get(playerId) ?? []).filter(
    (e) => e.type === 'UnitMode' && e.unitType === 1 && e.id === monId,
  )
  return { mode: mon.mode, modeEvents, dealt }
}

describe('1.13c SUNITDMG_ExecuteEvents blocked-hit mode change (D2Game.dll 0x6FCFD092..0x6FCFD0E9)', () => {
  it('lists exactly the Diablo hcIdx rows special-cased at 0x6FCFD0AE..0x6FCFD0BD', () => {
    expect([...MONSTER_BLOCK_NO_MODE_CHANGE_HCIDX_113C].sort((a, b) => a - b)).toEqual([243, 333, 705])
  })

  it('reads MonStats2.mBL from packed data: Diablo has BL, Baal does not, skeleton1 does', () => {
    for (const hc of [243, 333, 705]) expect(hasModeBL(hc)).toBe(true)
    for (const hc of [544, 570, 709]) expect(hasModeBL(hc)).toBe(false)
    expect(hasModeBL(0)).toBe(true)
  })

  it('never enters MONMODE_BLOCK for Diablo, Baal, or the 0x4000 result flag', () => {
    for (const hc of [243, 333, 705, 544, 570, 709]) {
      expect(shouldMonsterEnterBlockMode113c(hc, hasModeBL(hc))).toBe(false)
    }
    expect(shouldMonsterEnterBlockMode113c(0, true)).toBe(true)
    expect(shouldMonsterEnterBlockMode113c(0, false)).toBe(false)
    expect(shouldMonsterEnterBlockMode113c(0, true, 0x4000)).toBe(false)
  })

  it('keeps Diablo / Baal skill mode and sends no UnitMode when their block roll succeeds', () => {
    for (const hc of [243, 544]) {
      const r = blockOnceDuringSkill(hc)
      expect(r.dealt).toBe(false)
      expect(r.mode).toBe(MON_MODE_SKILL3)
      expect(r.modeEvents).toEqual([])
    }
  })

  it('still switches a normal mBL monster (skeleton1) to MONMODE_BLOCK and broadcasts it', () => {
    const r = blockOnceDuringSkill(0)
    expect(r.dealt).toBe(false)
    expect(r.mode).toBe(MONMODE_BLOCK)
    expect(r.modeEvents.map((e) => e.mode)).toEqual([MONMODE_BLOCK])
  })
})
