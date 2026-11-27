/**
 * Issue #1484:
 * 1. Ground gold pickup (`D2Game.dll` `0x6FCF6C80` -> `0x6FC32B90`) caps player inventory gold
 *    at `D2Common_GetInventoryGoldLimit` (`0x6FD81940`, ordinal #10049: `clvl * 10000`) and drops
 *    any leftover gold back onto the ground.
 * 2. Monster `STAT_EXPERIENCE` (`stat 13` / `0xD`, `D2Common #11089` `0x6FDA4A00`, `D2Game.dll`
 *    `0x6FCCF840` & `0x6FCCFDB0`) has no `level * 45` fallback, throws when `Exp` data is missing,
 *    and is stored at spawn/promotion time so `getMonsterState` and `onMonsterKilled` (`0x6FCFEA34`)
 *    use the exact same value across `playersX`, `noRatio`, and rank multipliers.
 */
import { describe, expect, it } from 'vitest'
import { getInventoryGoldLimit } from '../../src/common/items/inventory-model.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

describe('Issue #1484 — ground gold pickup cap & unified monster stat 13 XP', () => {
  it('caps ground gold pickup at clvl * 10000 (0x6FD81940) and leaves excess gold on the ground (0x6FCF6C80 -> 0x6FC32B90)', () => {
    const game = new GameInstance({ seed: 148401, areaId: 1 })
    const playerId = game.connectPlayer({
      charClass: 'pal',
      name: 'GoldCapHero',
      level: 10,
      x: 100,
      y: 100,
      areaId: 1,
    })

    expect(getInventoryGoldLimit(10)).toBe(100_000)

    const g = game as unknown as {
      players: Map<number, { gold: number; level: number; x: number; y: number; areaId: number; unitId: number }>
      groundItems: Map<number, { unitId: number; code: string; quantity: number; areaId: number }>
    }
    const player = g.players.get(playerId)!
    player.gold = 99_000

    const goldItemId = game.spawnGroundItem({
      code: 'gld',
      x: 100,
      y: 100,
      areaId: 1,
      quantity: 5_000,
    })
    game.drainEvents(playerId)

    game.enqueueCommand(playerId, {
      type: 'ItemPickup',
      itemId: goldItemId,
      toCursor: false,
    })
    game.stepFrame()

    // Inventory gold is capped at 10 * 10000 = 100000
    expect(game.getPlayerState(playerId)!.gold).toBe(100_000)

    // Original 5000-gold ground pile was removed and replaced by a 4000-gold leftover pile
    expect(g.groundItems.has(goldItemId)).toBe(false)
    const remainingGoldPiles = [...g.groundItems.values()].filter((item) => item.code === 'gld')
    expect(remainingGoldPiles).toHaveLength(1)
    expect(remainingGoldPiles[0]!.quantity).toBe(4_000)

    // Picking up the 4000-gold pile while already at 100000 cap keeps 100000 in inventory and 4000 on ground
    const leftoverId = remainingGoldPiles[0]!.unitId
    game.enqueueCommand(playerId, {
      type: 'ItemPickup',
      itemId: leftoverId,
      toCursor: false,
    })
    game.stepFrame()

    expect(game.getPlayerState(playerId)!.gold).toBe(100_000)
    const afterFullPiles = [...g.groundItems.values()].filter((item) => item.code === 'gld')
    expect(afterFullPiles).toHaveLength(1)
    expect(afterFullPiles[0]!.quantity).toBe(4_000)
  })

  it('throws an explicit error in spawnMonster when monster experience data is missing instead of falling back to level * 45', () => {
    const game = new GameInstance({ seed: 148402, areaId: 1 })
    expect(() =>
      game.spawnMonster({
        defId: 'nonexistent_monster_def_1484',
        classId: 99999,
        x: 50,
        y: 50,
        areaId: 1,
      }),
    ).toThrow(/missing experience data/i)
  })

  it('stores STAT_EXPERIENCE (stat 13) on monster spawn and uses the identical value in getMonsterState and onMonsterKilled across playersX and noRatio', () => {
    const game = new GameInstance({ seed: 148403, areaId: 2, playersX: 3 })
    const playerId = game.connectPlayer({
      charClass: 'bar',
      name: 'XpTester',
      level: 25,
      x: 100,
      y: 100,
      areaId: 2,
    })
    const g = game as unknown as {
      players: Map<number, { experience: number; level: number }>
      monsters: Map<number, { level: number; experience: number }>
      onMonsterKilled: (killer: unknown, monster: unknown) => void
    }
    const player = g.players.get(playerId)!

    // 1. Normal monster at playersX = 3: experience = floor(1000 * (3 + 1) / 2) = 2000
    const normalMonId = game.spawnMonster({
      defId: 'fallen1',
      x: 102,
      y: 100,
      areaId: 2,
      level: 25,
      experience: 1_000,
    })
    const normalSnap = game.getMonsterState(normalMonId)!
    expect(normalSnap.experience).toBe(2_000)

    player.experience = 0
    g.onMonsterKilled(player, g.monsters.get(normalMonId)!)
    expect(player.experience).toBe(2_000)

    // 2. noRatio monster at playersX = 3: experience remains unscaled (1000) in both snapshot and kill
    const noRatioMonId = game.spawnMonster({
      defId: 'fallen1',
      x: 104,
      y: 100,
      areaId: 2,
      level: 25,
      experience: 1_000,
      noRatio: true,
    })
    const noRatioSnap = game.getMonsterState(noRatioMonId)!
    expect(noRatioSnap.experience).toBe(1_000)

    player.experience = 0
    g.onMonsterKilled(player, g.monsters.get(noRatioMonId)!)
    expect(player.experience).toBe(1_000)

    // 3. Zero-XP monster (0x6FCFEA39: test eax, eax; jle) grants 0 XP instead of clamping to 1
    const zeroXpMonId = game.spawnMonster({
      defId: 'fallen1',
      x: 106,
      y: 100,
      areaId: 2,
      level: 25,
      experience: 0,
    })
    expect(game.getMonsterState(zeroXpMonId)!.experience).toBe(0)
    player.experience = 0
    g.onMonsterKilled(player, g.monsters.get(zeroXpMonId)!)
    expect(player.experience).toBe(0)
  })
})
