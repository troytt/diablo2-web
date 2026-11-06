import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_COMPLETED_NOW_113C,
  QUEST_FLAG_CUSTOM_5_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  computeQuestStatusByte113c,
  getVendorQuestDiscountPct113c,
  questWordIndex113c,
} from '../../src/server/engine/quests-113c.ts'
import { buildQuestLogPage } from '../../src/client/world/quest-log-state.ts'

describe('Issue #2011: ACT4Q1 The Fallen Angel 1.13c two-step Izual -> izualghost (#406) -> Tyrael (#367) turn-in', () => {
  it('sets 0x2002 and spawns izualghost (#406) on Izual (#256) death, sets bit 5 on spirit talk, and grants +2 skills + 10% vendor discount only on Tyrael (#367) turn-in', () => {
    const game = new GameInstance({ seed: 201101, areaId: 103 })
    const playerId = game.connectPlayer({
      name: 'FallenAngelSorc',
      charClass: 'sor',
      level: 26,
      x: 10,
      y: 10,
      areaId: 103,
    })

    const internal = game as unknown as {
      players: Map<number, { questFlags: Uint16Array; newSkills: number; areaId: number; x: number; y: number }>
      monsters: Map<number, { unitId: number; hcIdx: number; defId: string; areaId: number; isNpc: boolean; dead: boolean; x: number; y: number }>
      objects: Map<number, { unitId: number; classId: number; areaId: number; mode: number }>
    }
    const player = internal.players.get(playerId)!
    const qIdx = questWordIndex113c('a4q1')!
    const skills0 = player.newSkills

    // 1. Talking to Tyrael (#367) in Pandemonium Fortress (Area 103) before Izual initiates a4q1 (0x0004).
    const tyrael = game.spawnMonster({
      classId: 367,
      defId: 'tyrael2',
      name: 'Tyrael',
      x: 11,
      y: 10,
      areaId: 103,
      isNpc: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: tyrael } } as never)
    game.stepFrames(1)
    expect(player.questFlags[qIdx]).toBe(QUEST_FLAG_STARTED_113C)
    expect(computeQuestStatusByte113c('a4q1', player.questFlags, { playerAreaId: 103 })).toBe(1)
    expect(computeQuestStatusByte113c('a4q1', player.questFlags, { playerAreaId: 105 })).toBe(2)

    // 2. Move player to Plains of Despair (Area 105) and slay Izual (#256).
    player.areaId = 105
    player.x = 20
    player.y = 20
    const izual = game.spawnMonster({
      classId: 256,
      defId: 'izual',
      name: 'Izual',
      x: 21,
      y: 20,
      areaId: 105,
      hp: 50,
      maxHp: 50,
      experience: 0,
    })
    game.applyDamageToMonster(izual, 1000, playerId)

    // Reward is withheld on death: 0x2002 (REWARD_PENDING | COMPLETED_NOW), +0 skills, 0% Act 4 vendor discount.
    expect(player.questFlags[qIdx]).toBe(
      QUEST_FLAG_STARTED_113C | QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(player.newSkills).toBe(skills0)
    expect(getVendorQuestDiscountPct113c(player.questFlags, 257)).toBe(0)
    expect(getVendorQuestDiscountPct113c(player.questFlags, 405)).toBe(0)

    // Izual's Spirit (#406 izualghost) spawned at (21, 20) in Area 105.
    const ghost = [...internal.monsters.values()].find(
      (m) => m.areaId === 105 && m.hcIdx === 406 && !m.dead,
    )
    expect(ghost).toBeDefined()
    expect(ghost?.defId).toBe('izualghost')
    expect(ghost?.isNpc).toBe(true)
    expect({ x: ghost?.x, y: ghost?.y }).toEqual({ x: 21, y: 20 })

    // In Area 105 before talking to Izual's Spirit, quest log status is 3 ("Talk to Izual's Spirit.").
    const sBeforeGhost = computeQuestStatusByte113c('a4q1', player.questFlags, { playerAreaId: 105 })
    expect(sBeforeGhost).toBe(3)
    expect(
      buildQuestLogPage({ row: 25, playerWords: player.questFlags, status: sBeforeGhost, den: 0, barbs: 0 }),
    ).toEqual({
      text: { kind: 'tbl', key: 'qstsa4q13a' },
      speechKey: 'A4Q1InitTyrael',
    })

    // 3. Talking to Izual's Spirit (#406) sets bit 5 (0x0020) and advances status 3 -> 4 ("See Tyrael for reward.").
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: ghost!.unitId } } as never)
    game.stepFrames(1)
    expect(player.questFlags[qIdx]! & QUEST_FLAG_CUSTOM_5_113C).toBe(QUEST_FLAG_CUSTOM_5_113C)
    expect(player.newSkills).toBe(skills0)
    const sAfterGhost = computeQuestStatusByte113c('a4q1', player.questFlags, { playerAreaId: 105 })
    expect(sAfterGhost).toBe(4)
    expect(
      buildQuestLogPage({ row: 25, playerWords: player.questFlags, status: sAfterGhost, den: 0, barbs: 0 }),
    ).toEqual({
      text: { kind: 'tbl', key: 'qstsa4q13' },
      speechKey: 'A4Q1SuccessfulIzual',
    })

    // 4. Also simulate killing Diablo (a4q3 = 0x2001) before returning to Tyrael (#367):
    // a single talk to Tyrael must BOTH turn in a4q1 (+2 skills, 10% discount) AND open Harrogath portal (#566).
    const a4q3Idx = questWordIndex113c('a4q3')!
    player.questFlags[a4q3Idx] = QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C
    player.areaId = 103
    player.x = 10
    player.y = 10
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: tyrael } } as never)
    game.stepFrames(1)

    expect(player.questFlags[qIdx]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(player.questFlags[qIdx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(0)
    expect(player.newSkills).toBe(skills0 + 2)
    expect(getVendorQuestDiscountPct113c(player.questFlags, 257)).toBe(10)
    expect(getVendorQuestDiscountPct113c(player.questFlags, 405)).toBe(10)

    const harrogathPortal = [...internal.objects.values()].find(
      (o) => o.areaId === 103 && o.classId === 566 && o.mode === 2,
    )
    expect(harrogathPortal).toBeDefined()

    // Talking to Tyrael a second time does not double-grant +2 skills.
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: tyrael } } as never)
    game.stepFrames(1)
    expect(player.newSkills).toBe(skills0 + 2)
  })
})
