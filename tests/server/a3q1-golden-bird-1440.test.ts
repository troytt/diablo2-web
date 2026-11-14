/**
 * Issue #1440 — 1.13c A3Q1 (The Golden Bird, word 20 / questId 0x12) full quest chain:
 * - Objects 244 & 246 (`ratnest` in `Objects.txt`, `OperateFn = 14 / 4`, `Parm0 = 18`) are ordinary
 *   Act 3 containers and must NOT drop `j34` or advance `a3q1`.
 * - First unique/superunique/boss monster killed in Act 3 (`areaId` 75..102, excluding `hcIdx === 407`
 *   Fetish Gidbinn boss) drops Jade Figurine (`j34`) once per game (`D2Game.dll` @ `0x6fc56140 -> 0x6fd08200 -> 0x6fd08010`).
 * - Picking up `j34` (`0x6fd076ee..0x6fd07741`) sets bit 6 (`0x0040`, `QUEST_FLAG_CUSTOM_6_113C`),
 *   plays sound 72 (`0x48`), and emits `filterStatus = 1` (`qstsa3q41`).
 * - Talking to Cain (`hcIdx === 245`) holding `j34` (`0x6fd08bb4..0x6fd08bf4`, scroll `0x20f`) sets bit 2
 *   (`0x0004`, `QUEST_FLAG_STARTED_113C`, `filterStatus = 2` = `qstsa3q42`).
 * - Talking to Meshif (`hcIdx === 264`, `0x6fd08e1e..0x6fd08ea0`, scroll `0x211`) holding `j34` deletes `j34`
 *   and mints Golden Bird (`g34`, `filterStatus = 3` = `qstsa3q43`).
 * - Talking to Cain (`hcIdx === 245`) holding `g34` (`0x6fd08bf7..0x6fd08c32`, scroll `0x213`) sets bit 4
 *   (`0x0010`, `QUEST_FLAG_CUSTOM_4_113C`, `filterStatus = 4` = `qstsa3q44`).
 * - Talking to Alkor (`hcIdx === 254`, `0x6fd08c5a..0x6fd08dc0`) does NOT accept `j34`; holding `g34`
 *   executes stage `0x216` (removes `g34`, sets bit 1 `REWARD_PENDING`, `filterStatus = 5` = `qstsa3q45`)
 *   and stage `0x21a` (clears bit 1, sets bits `0 | 13 | 5`, and mints Potion of Life `xyz`).
 * - Consuming `xyz` (`0x6fcf9ec5..0x6fcf9efb`) clears bit 5 (`0x0020`), removes `xyz`, and grants +20 Max HP.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_COMPLETED_NOW_113C,
  QUEST_FLAG_CUSTOM_4_113C,
  QUEST_FLAG_CUSTOM_5_113C,
  QUEST_FLAG_CUSTOM_6_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  QUEST_OBJECT_TO_QUEST_113C,
  computeA3Q1StatusByte113c,
  questWordIndex113c,
} from '../../src/server/engine/quests-113c.ts'
import { buildQuestLogPage } from '../../src/client/world/quest-log-state.ts'

function setupAct3Game(seed: number, areaId = 76) {
  const game = new GameInstance({ seed, areaId })
  const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId })
  const internal = game as unknown as {
    players: Map<
      number,
      {
        unitId: number
        areaId: number
        questFlags: Uint16Array
        items: any[]
        hp: number
        maxHp: number
        hpFixed: number
        maxHpFixed: number
      }
    >
    groundItems: Map<number, { unitId: number; code: string; areaId: number; x: number; y: number }>
  }
  const player = internal.players.get(playerId)!
  return { game, playerId, player, groundItems: internal.groundItems }
}

describe('issue #1440: 1.13c A3Q1 The Golden Bird (j34 -> g34 -> xyz) full chain', () => {
  it('Objects 244 and 246 (ratnest) are ordinary containers and do NOT drop j34 or advance a3q1', () => {
    expect(QUEST_OBJECT_TO_QUEST_113C[244]).toBeUndefined()
    expect(QUEST_OBJECT_TO_QUEST_113C[246]).toBeUndefined()

    const { game, playerId, player, groundItems } = setupAct3Game(14401, 76)
    const a3q1Idx = questWordIndex113c('a3q1')!
    for (const classId of [244, 246]) {
      const objId = game.spawnObject({ classId, x: 11, y: 10, areaId: 76 })
      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: objId })
      game.stepFrames(1)
    }

    expect(player.questFlags[a3q1Idx]).toBe(0)
    expect([...groundItems.values()].some((g) => g.code.trim().toLowerCase() === 'j34')).toBe(false)
  })

  it('drops Jade Figurine (j34) on the first Act 3 unique/superunique monster kill once per game, excluding normal monsters and hcIdx 407', () => {
    const { game, playerId, groundItems } = setupAct3Game(14402, 76)

    // 1. Normal monster in Act 3 does not drop j34.
    const normalMon = game.spawnMonster({
      defId: 'fetish1',
      rank: 'normal',
      x: 12,
      y: 10,
      areaId: 76,
      hp: 10,
      maxHp: 10,
    })
    game.applyDamageToMonster(normalMon, 1000, playerId)
    expect([...groundItems.values()].some((g) => g.code.trim().toLowerCase() === 'j34')).toBe(false)

    // 2. Fetish Gidbinn boss (classId/hcIdx 407, 0x197) is excluded at D2Game.dll 0x6fc561b6.
    const gidbinnBoss = game.spawnMonster({
      classId: 407,
      rank: 'unique',
      x: 12,
      y: 11,
      areaId: 76,
      hp: 10,
      maxHp: 10,
    })
    game.applyDamageToMonster(gidbinnBoss, 1000, playerId)
    expect([...groundItems.values()].some((g) => g.code.trim().toLowerCase() === 'j34')).toBe(false)

    // 3. First Act 3 unique monster drops j34 (D2Game.dll 0x6fd08010).
    const unique1 = game.spawnMonster({
      defId: 'arach1',
      rank: 'unique',
      x: 13,
      y: 10,
      areaId: 76,
      hp: 10,
      maxHp: 10,
    })
    game.applyDamageToMonster(unique1, 1000, playerId)
    const j34DropsAfterFirst = [...groundItems.values()].filter(
      (g) => g.code.trim().toLowerCase() === 'j34',
    )
    expect(j34DropsAfterFirst).toHaveLength(1)

    // 4. Remove ground item to verify per-game flag (a3q1JadeFigurineDropped) prevents a second drop.
    groundItems.delete(j34DropsAfterFirst[0]!.unitId)
    const unique2 = game.spawnMonster({
      defId: 'arach1',
      rank: 'superunique',
      superUniqueId: 'Sszark the Burning',
      x: 14,
      y: 10,
      areaId: 76,
      hp: 10,
      maxHp: 10,
    })
    game.applyDamageToMonster(unique2, 1000, playerId)
    expect([...groundItems.values()].some((g) => g.code.trim().toLowerCase() === 'j34')).toBe(false)
  })

  it('executes the full 1.13c A3Q1 chain: j34 pickup -> Alkor rejects j34 -> Cain (0x20f) -> Meshif (0x211 j34->g34) -> Cain (0x213) -> Alkor (0x216->0x21a g34->xyz) -> BeltUse xyz (+20 Max HP)', () => {
    const { game, playerId, player, groundItems } = setupAct3Game(14403, 76)
    const a3q1Idx = questWordIndex113c('a3q1')!
    const maxHp0 = player.maxHp
    const maxHpFixed0 = player.maxHpFixed

    // Step 1: Kill first Act 3 unique monster -> drops j34.
    const uniqueMon = game.spawnMonster({
      defId: 'arach1',
      rank: 'unique',
      x: 12,
      y: 10,
      areaId: 76,
      hp: 10,
      maxHp: 10,
    })
    game.applyDamageToMonster(uniqueMon, 1000, playerId)
    const droppedJ34 = [...groundItems.values()].find((g) => g.code.trim().toLowerCase() === 'j34')
    expect(droppedJ34).toBeDefined()

    // Step 2: Pick up j34 (0x6fd076ee..0x6fd07741) -> sets bit 6 (0x0040), plays sound 72, filterStatus = 1 (qstsa3q41).
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, {
      type: 'ItemPickup',
      itemId: droppedJ34!.unitId,
      toCursor: false,
    } as never)
    game.stepFrames(1)

    const pickupEvents = game.drainEvents(playerId)
    expect(pickupEvents.some((e) => e.type === 'PlaySound' && e.sound === 72)).toBe(true)
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_CUSTOM_6_113C).toBe(QUEST_FLAG_CUSTOM_6_113C)
    expect(computeA3Q1StatusByte113c(player.questFlags, true, false)).toBe(1)
    expect(
      buildQuestLogPage({
        row: a3q1Idx,
        playerWords: player.questFlags,
        status: computeA3Q1StatusByte113c(player.questFlags, true, false),
        den: 0,
        barbs: 0,
      })?.text,
    ).toEqual({ kind: 'tbl', key: 'qstsa3q41' })

    // Step 3: Talking to Alkor (hcIdx 254) while holding j34 must NOT consume j34 or advance a3q1!
    const alkor = game.spawnMonster({
      classId: 254,
      name: 'Alkor',
      x: 11,
      y: 10,
      areaId: 76,
      isNpc: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: alkor } } as never)
    game.stepFrames(1)
    expect(player.items.some((i) => i.code.trim().toLowerCase() === 'j34')).toBe(true)
    expect(player.items.some((i) => i.code.trim().toLowerCase() === 'xyz')).toBe(false)
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(0)
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(0)

    // Step 4: Talk to Cain (hcIdx 245, 0x6fd08bb4..0x6fd08bf4, scroll 0x20f) holding j34 -> sets bit 2 (STARTED), status = 2 (qstsa3q42).
    const cain = game.spawnMonster({
      classId: 245,
      name: 'Deckard Cain',
      x: 11,
      y: 10,
      areaId: 76,
      isNpc: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: cain } } as never)
    game.stepFrames(1)
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_STARTED_113C).toBe(QUEST_FLAG_STARTED_113C)
    expect(computeA3Q1StatusByte113c(player.questFlags, true, false)).toBe(2)
    expect(
      buildQuestLogPage({
        row: a3q1Idx,
        playerWords: player.questFlags,
        status: computeA3Q1StatusByte113c(player.questFlags, true, false),
        den: 0,
        barbs: 0,
      })?.text,
    ).toEqual({ kind: 'tbl', key: 'qstsa3q42' })

    // Step 5: Talk to Meshif (hcIdx 264, 0x6fd08e1e..0x6fd08ea0, scroll 0x211) holding j34 -> removes j34, mints g34, status = 3 (qstsa3q43).
    const meshif = game.spawnMonster({
      classId: 264,
      name: 'Meshif',
      x: 11,
      y: 10,
      areaId: 76,
      isNpc: true,
    })
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: meshif } } as never)
    game.stepFrames(1)
    expect(player.items.some((i) => i.code.trim().toLowerCase() === 'j34')).toBe(false)
    expect(player.items.some((i) => i.code.trim().toLowerCase() === 'g34')).toBe(true)
    expect(computeA3Q1StatusByte113c(player.questFlags, false, true)).toBe(3)
    expect(
      buildQuestLogPage({
        row: a3q1Idx,
        playerWords: player.questFlags,
        status: computeA3Q1StatusByte113c(player.questFlags, false, true),
        den: 0,
        barbs: 0,
      })?.text,
    ).toEqual({ kind: 'tbl', key: 'qstsa3q43' })

    // Step 6: Talk to Cain (hcIdx 245, 0x6fd08bf7..0x6fd08c32, scroll 0x213) holding g34 -> sets bit 4 (0x0010), status = 4 (qstsa3q44).
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: cain } } as never)
    game.stepFrames(1)
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_CUSTOM_4_113C).toBe(QUEST_FLAG_CUSTOM_4_113C)
    expect(computeA3Q1StatusByte113c(player.questFlags, false, true)).toBe(4)
    expect(
      buildQuestLogPage({
        row: a3q1Idx,
        playerWords: player.questFlags,
        status: computeA3Q1StatusByte113c(player.questFlags, false, true),
        den: 0,
        barbs: 0,
      })?.text,
    ).toEqual({ kind: 'tbl', key: 'qstsa3q44' })

    // Step 7: Talk to Alkor (hcIdx 254, 0x6fd08c5a..0x6fd08dc0, scrolls 0x216 -> 0x21a) holding g34 ->
    // removes g34, transitions through REWARD_PENDING (status 5 = qstsa3q45) to COMPLETED | COMPLETED_NOW | CUSTOM_5 (status 13 = qstsComplete),
    // and mints Potion of Life ('xyz') without adding Max HP directly.
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: alkor } } as never)
    game.stepFrames(1)
    const alkorEvents = game.drainEvents(playerId)
    const statusEvents = alkorEvents.filter(
      (e) => e.type === 'QuestState' && (e as { source?: number }).source === 0x5d,
    ) as { questStatus?: { filterStatus: number } }[]
    expect(statusEvents.map((e) => e.questStatus?.filterStatus)).toEqual([5, 13])

    expect(player.items.some((i) => i.code.trim().toLowerCase() === 'g34')).toBe(false)
    const xyzItem = player.items.find((i) => i.code.trim().toLowerCase() === 'xyz')
    expect(xyzItem).toBeDefined()
    expect(player.maxHp).toBe(maxHp0)
    expect(player.maxHpFixed).toBe(maxHpFixed0)
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(0)
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_COMPLETED_NOW_113C).toBe(
      QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_CUSTOM_5_113C).toBe(QUEST_FLAG_CUSTOM_5_113C)
    expect(computeA3Q1StatusByte113c(player.questFlags, false, false)).toBe(13)
    expect(
      buildQuestLogPage({
        row: a3q1Idx,
        playerWords: player.questFlags,
        status: computeA3Q1StatusByte113c(player.questFlags, false, false),
        den: 0,
        barbs: 0,
      })?.text,
    ).toEqual({ kind: 'tbl', key: 'qstsComplete' })

    // Step 8: Consume xyz (0x6fcf9ec5..0x6fcf9efb) -> clears bit 5 (0x0020), removes xyz, grants +20 Max HP (+0x1400 fixed).
    game.enqueueCommand(playerId, { type: 'BeltUse', itemId: xyzItem!.unitId } as never)
    game.stepFrames(1)
    expect(player.items.some((i) => i.code.trim().toLowerCase() === 'xyz')).toBe(false)
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_CUSTOM_5_113C).toBe(0)
    expect(player.maxHp).toBe(maxHp0 + 20)
    expect(player.maxHpFixed).toBe(maxHpFixed0 + (20 << 8))
  })

  it('completes stage 0x21a when talking to Alkor with REWARD_PENDING (bit 1 = 0x0002, qstsa3q45) already set', () => {
    const { game, playerId, player } = setupAct3Game(14404, 75)
    const a3q1Idx = questWordIndex113c('a3q1')!
    player.questFlags[a3q1Idx] = QUEST_FLAG_REWARD_PENDING_113C

    expect(computeA3Q1StatusByte113c(player.questFlags, false, false)).toBe(5)
    expect(
      buildQuestLogPage({
        row: a3q1Idx,
        playerWords: player.questFlags,
        status: computeA3Q1StatusByte113c(player.questFlags, false, false),
        den: 0,
        barbs: 0,
      })?.text,
    ).toEqual({ kind: 'tbl', key: 'qstsa3q45' })

    const alkor = game.spawnMonster({
      classId: 254,
      name: 'Alkor',
      x: 11,
      y: 10,
      areaId: 75,
      isNpc: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: alkor } } as never)
    game.stepFrames(1)

    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(0)
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_CUSTOM_5_113C).toBe(QUEST_FLAG_CUSTOM_5_113C)
    expect(player.items.some((i) => i.code.trim().toLowerCase() === 'xyz')).toBe(true)
  })
})
