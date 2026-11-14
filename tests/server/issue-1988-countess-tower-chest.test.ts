import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  hasQuestFlag113c,
  setQuestFlag113c,
} from '../../src/server/engine/quests-113c.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'

function collectPlayerEvents(
  frameOut: Map<number, readonly ServerEvent[]>,
  playerId: number,
): ServerEvent[] {
  return [...(frameOut.get(playerId) ?? [])]
}

describe('Issue #1988 — Act 1 Quest 4 (a1q4) Countess Tower Chest (371) & towerchestspawner (#332)', () => {
  it('blocks manual clicking on Objects.txt 371 (OperateFn = 0), then opens at +150 frames after first Countess kill with 3 Magic items, 2 HP + 2 MP potions, 31 gold piles, and PlaySound 92', () => {
    const game = new GameInstance({ mapSeed: 0x1988_01, difficulty: 0 })
    const p1 = game.connectPlayer({
      name: 'CountessSorc',
      classId: 1,
      level: 14,
      areaId: 25,
      x: 5000,
      y: 5000,
    })
    game.stepFrame()

    const chestId = game.spawnObject({
      classId: 371,
      areaId: 25,
      x: 5002,
      y: 5000,
      mode: 0,
    })

    // 1. Player cannot manually open Objects.txt 371 (`OperateFn === 0`, `Selectable0 === 0`).
    game.enqueueCommand(p1, { type: 'OperateObject', objectId: chestId })
    game.stepFrame()
    const chestBeforeKill = (game as unknown as { objects: Map<number, { mode: number }> }).objects.get(chestId)!
    expect(chestBeforeKill.mode).toBe(0)
    expect(game.getGroundItems().length).toBe(0)

    // 2. Spawn and slay The Countess (`SuperUniques.txt` index 12 / `defId: 'darkstalker'`, `superUniqueId: 'The Countess'`)
    //    40 sub-tiles away from the chest so corpse loot and chest loot are spatially distinct too.
    const countessId = game.spawnMonster({
      classId: 45,
      defId: 'darkstalker',
      name: 'The Countess',
      superUniqueId: 'The Countess',
      areaId: 25,
      x: 5042,
      y: 5000,
      hp: 10,
      maxHp: 10,
    })
    ;(game as unknown as {
      applyDamageToMonster(id: number, dmg: number, killerId: number): void
    }).applyDamageToMonster(countessId, 50, p1)

    const sp = (game as unknown as { players: Map<number, { questFlags: Uint16Array }> }).players.get(p1)!
    expect(hasQuestFlag113c(sp.questFlags, 'a1q4', QUEST_FLAG_COMPLETED_113C)).toBe(true)
    expect(chestBeforeKill.mode).toBe(0)

    // 3. Step 150 frames (remainingFrames: 400 -> 251): Countess finishes her DD death animation and drops
    //    her own corpse loot near x=5042, while chest at x=5002 remains closed (mode 0) with 0 items near x=5002.
    for (let f = 0; f < 150; f++) {
      game.stepFrame()
    }
    expect(chestBeforeKill.mode).toBe(0)
    expect(game.getGroundItems().filter((it) => Math.abs(it.x - 5002) <= 10).length).toBe(0)
    const preChestOpenItemIds = new Set(game.getGroundItems().map((it) => it.unitId))

    // 4. Frame 151 (remainingFrames === 250 = 400 - 150): chest opens (mode 1 -> 2), dropping 3 forced-Magic items + 2 'hp1' + 2 'mp1' (no gold yet at 250 since 250 % 8 !== 0).
    game.stepFrame()
    expect(chestBeforeKill.mode === 1 || chestBeforeKill.mode === 2).toBe(true)

    const burstItems = game.getGroundItems().filter((it) => !preChestOpenItemIds.has(it.unitId))
    const hpItems = burstItems.filter((it) => it.code.trim() === 'hp1')
    const mpItems = burstItems.filter((it) => it.code.trim() === 'mp1')
    const goldAtBurst = burstItems.filter((it) => it.code.trim() === 'gld')
    const equipBurst = burstItems.filter(
      (it) => it.code.trim() !== 'hp1' && it.code.trim() !== 'mp1' && it.code.trim() !== 'gld',
    )
    expect(hpItems.length).toBe(2)
    expect(mpItems.length).toBe(2)
    expect(goldAtBurst.length).toBe(0)
    expect(equipBurst.length).toBe(3)
    for (const eq of equipBurst) {
      expect(Number(eq.quality ?? 0)).toBeGreaterThanOrEqual(4)
    }

    // 5. Step remaining 249 frames (remainingFrames: 249 -> 1, total 400 frames):
    //    - 31 gold piles spawn at remainingFrames = 248, 240, ..., 8
    //    - chest settles in mode 2 (`OBJMODE_OPENED`)
    //    - S2C 0x2C PlaySound (sound = 92) fires on chest unit at remainingFrames = 1
    const allEvents: ServerEvent[] = []
    for (let f = 0; f < 249; f++) {
      allEvents.push(...collectPlayerEvents(game.stepFrame(), p1))
    }
    expect(chestBeforeKill.mode).toBe(2)

    const finalChestDrops = game.getGroundItems().filter((it) => !preChestOpenItemIds.has(it.unitId))
    const goldPiles = finalChestDrops.filter((it) => it.code.trim() === 'gld')
    expect(goldPiles.length).toBe(31)

    const sound92 = allEvents.filter(
      (e) =>
        e.type === 'PlaySound' &&
        e.sound === 92 &&
        e.unit?.unitType === 2 &&
        e.unit?.id === chestId,
    )
    expect(sound92.length).toBe(1)
  })

  it('initializes Objects.txt 371 in mode 2 when a1q4 is already completed and does not re-trigger spawner on repeat kills', () => {
    const completedFlags = new Uint16Array(48)
    setQuestFlag113c(completedFlags, 'a1q4', QUEST_FLAG_COMPLETED_113C)

    const game = new GameInstance({ mapSeed: 0x1988_02, difficulty: 1 })
    const chestId = game.spawnObject({
      classId: 371,
      areaId: 25,
      x: 5002,
      y: 5000,
      mode: 0,
    })

    const p1 = game.connectPlayer({
      name: 'RepeatSorc',
      classId: 1,
      level: 42,
      areaId: 1,
      x: 5000,
      y: 5000,
      questFlags: completedFlags,
    })
    game.stepFrame()

    const chest = (game as unknown as { objects: Map<number, { mode: number }> }).objects.get(chestId)!
    expect(chest.mode).toBe(2)

    // Repeat Countess kill when a1q4 is already completed must NOT schedule another towerchestspawner.
    ;(game as unknown as { movePlayer(id: number, x: number, y: number): void }).movePlayer(p1, 5000, 5000)
    ;(game as unknown as { players: Map<number, { areaId: number }> }).players.get(p1)!.areaId = 25
    const countessId = game.spawnMonster({
      classId: 45,
      defId: 'darkstalker',
      name: 'The Countess',
      superUniqueId: 'The Countess',
      areaId: 25,
      x: 5004,
      y: 5000,
      hp: 10,
      maxHp: 10,
    })
    ;(game as unknown as {
      applyDamageToMonster(id: number, dmg: number, killerId: number): void
    }).applyDamageToMonster(countessId, 50, p1)

    const spawners = (game as unknown as { activeTowerChestSpawners: unknown[] }).activeTowerChestSpawners
    expect(spawners.length).toBe(0)
  })
})
