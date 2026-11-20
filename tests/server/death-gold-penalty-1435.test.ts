/**
 * Issue #1435: 1.13c player death gold penalty (`D2Game.dll` `0x6FC583A0` -> `0x6FC58180`
 * `PLAYER_ApplyDeathGoldPenalty` & `0x6FC57F80` `PLAYER_DropGoldPile`) and town respawn position.
 *
 * Ground-truth citations:
 * - `samples/d2/D2Game.dll` `0x6FC58180` (`PLAYER_ApplyDeathGoldPenalty`):
 *   - `pct = Math.min(clvl, 20)` (`0x6FC581B3..0x6FC581BD`: `cmp edi, 0x14; jl; mov eax, 0x14`).
 *   - `total = gold (stat 14) + bank (stat 15)`, `loss = Math.trunc((total * pct) / 100)` (`0x6FC581AA..0x6FC581E5`).
 *   - `[pGame + 0x6A] == 3` (`gameType === 3`, `0x6FC5822E..0x6FC58250`):
 *     floor `clvl * 500` (`0x1F4`), `loss = Math.min(loss, gold)`, no stash deduction (`0x6FC58313`).
 *   - PK branch (`0x6FC58256..0x6FC582E7`): drops `loss` on the ground (`0x6FC57F80`), deducts any
 *     shortfall `loss - gold` from `bank`, or leaves `gold - loss` in inventory when `loss <= gold`.
 *   - Non-PK branch (`0x6FC582E9..0x6FC58360`):
 *     - If `loss <= gold`: calls `0x6FC57F80(pGame, pVictim, gold - loss)` to drop `gold - loss` on the
 *       ground; `bank` is untouched.
 *     - If `loss > gold`: deducts `loss - gold` from `bank` (`stat 15`, clamped `>= 0`); nothing drops.
 *     - Always sets carried `STAT_GOLD (14)` to `0` (`0x6FC5834A..0x6FC58360`).
 */

import { describe, expect, it } from 'vitest'
import { applyDeathGoldPenalty113c } from '../../src/common/progression/experience-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { writeD2s } from '../../src/server/index.ts'
import { createSampleD2sCharacterData } from '../e2e/server-reuse/helpers.ts'

describe('Issue #1435: 1.13c player death gold penalty (D2Game.dll 0x6FC58180) & town respawn', () => {
  it('computes min(clvl, 20)% of (gold + bank) and drops gold - loss on the ground when loss <= gold (0x6FC582ED..0x6FC58311)', () => {
    // clvl = 30 -> pct = min(30, 20) = 20%; total = 50,000 + 100,000 = 150,000; loss = 30,000.
    // Since loss (30,000) <= gold (50,000): dropAmount = 20,000, newGold = 0, newBank = 100,000.
    const res = applyDeathGoldPenalty113c(30, 50_000, 100_000)
    expect(res).toEqual({
      newGold: 0,
      newBank: 100_000,
      dropAmount: 20_000,
      goldLost: 30_000,
      penaltyPct: 20,
    })
  })

  it('deducts shortfall (loss - gold) from bank and drops 0 when loss > gold (0x6FC58313..0x6FC58360)', () => {
    // clvl = 30 -> 20%; gold = 10,000, bank = 100,000 -> total = 110,000, loss = 22,000.
    // Shortfall = 22,000 - 10,000 = 12,000 deducted from bank -> newBank = 88,000, dropAmount = 0, newGold = 0.
    const res110k = applyDeathGoldPenalty113c(30, 10_000, 100_000)
    expect(res110k).toEqual({
      newGold: 0,
      newBank: 88_000,
      dropAmount: 0,
      goldLost: 22_000,
      penaltyPct: 20,
    })

    // When gold = 0 and bank = 100,000 at clvl = 30 -> loss = 20,000 deducted from bank -> newBank = 80,000.
    const resBankOnly = applyDeathGoldPenalty113c(30, 0, 100_000)
    expect(resBankOnly).toEqual({
      newGold: 0,
      newBank: 80_000,
      dropAmount: 0,
      goldLost: 20_000,
      penaltyPct: 20,
    })
  })

  it('uses clvl% when clvl < 20 (e.g. clvl = 5 -> 5% penalty, 0x6FC581B3..0x6FC581BD)', () => {
    const res = applyDeathGoldPenalty113c(5, 1_000, 3_000)
    // total = 4,000, pct = 5% -> loss = 200 <= gold (1,000) -> dropAmount = 800, newGold = 0, newBank = 3,000
    expect(res).toEqual({
      newGold: 0,
      newBank: 3_000,
      dropAmount: 800,
      goldLost: 200,
      penaltyPct: 5,
    })
  })

  it('supports PK branch (0x6FC58256..0x6FC582E7) and gameType=3 floor protection clvl*500 (0x6FC5822E..0x6FC58250)', () => {
    // PK with loss <= gold: victim keeps gold - loss in inventory and drops loss on the ground.
    const pvpEnoughCarry = applyDeathGoldPenalty113c(30, 50_000, 100_000, { killerType: 'player' })
    expect(pvpEnoughCarry).toEqual({
      newGold: 20_000,
      newBank: 100_000,
      dropAmount: 30_000,
      goldLost: 30_000,
      penaltyPct: 20,
    })

    // PK with loss > gold: shortfall comes from bank, carried gold becomes 0, full loss drops on ground.
    const pvpShortCarry = applyDeathGoldPenalty113c(30, 10_000, 100_000, { killerType: 'player_pet' })
    expect(pvpShortCarry).toEqual({
      newGold: 0,
      newBank: 88_000,
      dropAmount: 22_000,
      goldLost: 22_000,
      penaltyPct: 20,
    })

    // gameType = 3 (`[pGame + 0x6A] == 3`): clvl * 500 floor protection and loss capped at carried gold.
    // clvl = 10 -> floorGold = 5,000. If gold = 2,000 and bank = 3,200 (total = 5,200),
    // raw 10% loss = 520 would leave 4,680 < 5,000, so loss is clamped to 5,200 - 5,000 = 200.
    const gameType3Floor = applyDeathGoldPenalty113c(10, 2_000, 3_200, { gameType: 3 })
    expect(gameType3Floor).toEqual({
      newGold: 0,
      newBank: 3_200,
      dropAmount: 1_800,
      goldLost: 200,
      penaltyPct: 10,
    })
  })

  it('GameInstance.killPlayer zeroes carried gold, spawns a ground gld pile for gold - loss, and deducts shortfall from goldBank', () => {
    // Case 1: clvl=30, gold=50000, goldBank=100000 -> gold=0, goldBank=100000, ground gld=20000
    const d2sRichCarry = writeD2s(
      createSampleD2sCharacterData({
        name: 'GoldRich',
        charClass: 0,
        level: 30,
        attributesOverrides: {
          gold: 50_000,
          goldBank: 100_000,
        },
      }),
    )
    const g1 = new GameInstance({ difficulty: 0, areaId: 2 })
    const p1 = g1.connectPlayer({
      name: 'GoldRich',
      classId: 0,
      level: 30,
      areaId: 2,
      x: 110,
      y: 112,
      hp: 50,
      maxHp: 50,
      d2sBytes: d2sRichCarry,
    })
    g1.drainPlayerEvents(p1)

    g1.applyDamageToPlayer(p1, 500, { killerType: 'monster' })
    const snap1 = g1.getPlayerState(p1)!
    expect(snap1.dead).toBe(true)
    expect(snap1.gold).toBe(0)
    expect(snap1.goldBank).toBe(100_000)

    const groundGold1 = g1.getGroundItems().find((it) => it.code === 'gld')
    expect(groundGold1).toBeDefined()
    expect(groundGold1?.quantity).toBe(20_000)
    expect(groundGold1?.stats.get(14)).toBe(20_000)

    const events1 = g1.drainPlayerEvents(p1)
    expect(events1).toContainEqual({
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: p1,
      statId: 14,
      value: 0,
    })
    expect(
      events1.some(
        (e) =>
          e.type === 'ItemEvent' &&
          e.action === 'groundSpawn' &&
          e.code === 'gld' &&
          e.item.quantity === 20_000 &&
          e.item.goldAmount === 20_000,
      ),
    ).toBe(true)

    // Case 2: clvl=30, gold=10000, goldBank=100000 -> loss=22000 > gold -> gold=0, goldBank=88000, no ground gld
    const d2sShortCarry = writeD2s(
      createSampleD2sCharacterData({
        name: 'GoldBank',
        charClass: 0,
        level: 30,
        attributesOverrides: {
          gold: 10_000,
          goldBank: 100_000,
        },
      }),
    )
    const g2 = new GameInstance({ difficulty: 0, areaId: 2 })
    const p2 = g2.connectPlayer({
      name: 'GoldBank',
      classId: 0,
      level: 30,
      areaId: 2,
      x: 110,
      y: 112,
      hp: 50,
      maxHp: 50,
      d2sBytes: d2sShortCarry,
    })
    g2.drainPlayerEvents(p2)

    g2.applyDamageToPlayer(p2, 500, { killerType: 'monster' })
    const snap2 = g2.getPlayerState(p2)!
    expect(snap2.dead).toBe(true)
    expect(snap2.gold).toBe(0)
    expect(snap2.goldBank).toBe(88_000)
    expect(g2.getGroundItems().find((it) => it.code === 'gld')).toBeUndefined()

    const events2 = g2.drainPlayerEvents(p2)
    expect(events2).toContainEqual({
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: p2,
      statId: 14,
      value: 0,
    })
    expect(events2).toContainEqual({
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: p2,
      statId: 15,
      value: 88_000,
    })
  })

  it('handleRespawn transitions the player to the Act town spawn instead of hardcoded (128, 128)', () => {
    const g = new GameInstance({ difficulty: 0, areaId: 2 })
    const pid = g.connectPlayer({
      name: 'RespawnHero',
      classId: 0,
      level: 10,
      areaId: 2,
      x: 90,
      y: 95,
      hp: 40,
      maxHp: 40,
    })
    g.applyDamageToPlayer(pid, 100, { killerType: 'monster' })
    expect(g.getPlayerState(pid)?.dead).toBe(true)

    g.enqueueCommand(pid, { type: 'Respawn' })
    g.stepFrame()

    const after = g.getPlayerState(pid)!
    expect(after.dead).toBe(false)
    expect(after.areaId).toBe(1)
    // Resolver-less synthetic test grid (#1698): no DRLG town exists, so the legacy grid spawn is used.
    expect({ x: after.x, y: after.y }).toEqual({ x: 128, y: 128 })
  })
})
