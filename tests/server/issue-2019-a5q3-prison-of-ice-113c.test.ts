import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_COMPLETED_NOW_113C,
  QUEST_FLAG_CUSTOM_3_113C,
  QUEST_FLAG_CUSTOM_4_113C,
  QUEST_FLAG_CUSTOM_8_113C,
  QUEST_FLAG_CUSTOM_9_113C,
  QUEST_FLAG_CUSTOM_10_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  computeQuestStatusByte113c,
  questWordIndex113c,
} from '../../src/server/engine/quests-113c.ts'
import { getTownNpcDescriptorByHcIdx } from '../../src/common/units/npc-table.ts'
import { buildNpcMenuOptions } from '../../src/client/ui/panels/npc-dialog-menu.ts'
import { readD2sSave113c } from '../../src/server/save/d2s-reader.ts'

describe('Issue #2019 — A5Q3 Prison of Ice 1.13c Malah (513) & Anya (558/527/512) state machine', () => {
  it('does NOT grant Malah Potion (ice) on fresh Act 5 arrival or A5Q3Init, and follows full 1.13c Malah -> Town Anya completion order', () => {
    const game = new GameInstance({ seed: 201901, areaId: 109, difficulty: 0 })
    const pid = game.connectPlayer({ charClass: 'sor', name: 'IceSorc', x: 20, y: 20, areaId: 109, level: 26 })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          areaId: number
          questFlags: Uint16Array
          items: Array<{ unitId: number; code: string; quality: number }>
        }
      >
      groundItems: Map<number, { code: string }>
    }
    const player = internal.players.get(pid)!
    const a5q2Idx = questWordIndex113c('a5q2')!
    const a5q3Idx = questWordIndex113c('a5q3')!

    const malah = game.spawnMonster({
      classId: 513,
      name: 'Malah',
      x: 21,
      y: 20,
      areaId: 109,
      isNpc: true,
    })

    // 1. Fresh Act 5 arrival (a5q2 = 0, a5q3 = 0): talking to Malah must neither start a5q3 nor grant 'ice'.
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect(player.questFlags[a5q3Idx]).toBe(0)
    expect(player.items.some((i) => i.code === 'ice')).toBe(false)
    expect([...internal.groundItems.values()].some((g) => g.code === 'ice')).toBe(false)

    // 2. After a5q2 completion: talking to Malah (A5Q3Init, 0x6fc7f625) sets STARTED (0x0004, status 1) WITHOUT granting 'ice'.
    player.questFlags[a5q2Idx] = QUEST_FLAG_COMPLETED_113C
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect(player.questFlags[a5q3Idx]).toBe(QUEST_FLAG_STARTED_113C)
    expect(player.items.some((i) => i.code === 'ice')).toBe(false)
    expect(
      computeQuestStatusByte113c('a5q3', player.questFlags, {
        playerAreaId: 109,
        itemCodes: new Set(player.items.map((i) => i.code.trim().toLowerCase())),
      }),
    ).toBe(1)

    // In Frozen River (114) while searching: status byte is 2 (qstsa5q31a).
    expect(
      computeQuestStatusByte113c('a5q3', player.questFlags, {
        playerAreaId: 114,
        itemCodes: new Set(player.items.map((i) => i.code.trim().toLowerCase())),
      }),
    ).toBe(2)

    // 3. Discovering Frozen Anya (Object 558, 0x6fc7cd50) without 'ice' sets CUSTOM_4 (0x0010, status 3 "Talk to Malah.") and emits 20131.
    game.drainEvents(pid)
    const frozenAnya = game.spawnObject({ classId: 558, x: 21, y: 21, areaId: 109 })
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: frozenAnya })
    game.stepFrames(1)
    const foundEvents = game.drainEvents(pid)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_CUSTOM_4_113C).toBe(QUEST_FLAG_CUSTOM_4_113C)
    expect(
      foundEvents.some(
        (e) =>
          e.type === 'Npc' &&
          e.kind === 'info' &&
          (e.messages ?? []).some((m) => m.stringId === 20131),
      ),
    ).toBe(true)
    expect(
      computeQuestStatusByte113c('a5q3', player.questFlags, {
        playerAreaId: 109,
        itemCodes: new Set(player.items.map((i) => i.code.trim().toLowerCase())),
      }),
    ).toBe(3)

    // 4. Talking to Malah now grants 'ice', clears CUSTOM_4, and advances status to 4 (qstsa5q33).
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect(player.items.filter((i) => i.code === 'ice')).toHaveLength(1)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_CUSTOM_4_113C).toBe(0)
    expect(
      computeQuestStatusByte113c('a5q3', player.questFlags, {
        playerAreaId: 114,
        itemCodes: new Set(player.items.map((i) => i.code.trim().toLowerCase())),
      }),
    ).toBe(4)

    // 5. Thawing Frozen Anya consumes 'ice' and sets REWARD_PENDING | COMPLETED_NOW (status 5 "Talk to Malah for your reward.").
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: frozenAnya })
    game.stepFrames(1)
    expect(player.items.some((i) => i.code === 'ice')).toBe(false)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(
      QUEST_FLAG_REWARD_PENDING_113C,
    )
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_COMPLETED_NOW_113C).toBe(
      QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(
      computeQuestStatusByte113c('a5q3', player.questFlags, {
        playerAreaId: 109,
        itemCodes: new Set(player.items.map((i) => i.code.trim().toLowerCase())),
      }),
    ).toBe(5)

    // Town Anya (512) offers Trade & Gamble immediately while REWARD_PENDING (0x0002) is set, and Nihlathak (514) no longer offers Gamble.
    const anyaDesc = getTownNpcDescriptorByHcIdx(512)!
    const nihlDesc = getTownNpcDescriptorByHcIdx(514)!
    expect(buildNpcMenuOptions(anyaDesc, { questFlags: player.questFlags }).map((o) => o.id)).toEqual(
      expect.arrayContaining(['talk', 'trade', 'gamble']),
    )
    expect(
      buildNpcMenuOptions(nihlDesc, { questFlags: player.questFlags }).map((o) => o.id),
    ).not.toContain('gamble')

    // 6. Malah turn-in grants 'tr2' and sets CUSTOM_8 (0x0100), keeping REWARD_PENDING set (status 6 "Talk to Anya.").
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    const tr2First = player.items.find((i) => i.code === 'tr2')
    expect(tr2First).toBeDefined()
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_CUSTOM_8_113C).toBe(QUEST_FLAG_CUSTOM_8_113C)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(0)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(
      QUEST_FLAG_REWARD_PENDING_113C,
    )
    expect(
      computeQuestStatusByte113c('a5q3', player.questFlags, {
        playerAreaId: 109,
        itemCodes: new Set(player.items.map((i) => i.code.trim().toLowerCase())),
      }),
    ).toBe(6)

    // 7. Losing unconsumed 'tr2' allows Malah to replace it ONCE per game (0x6fc7f89f..0x6fc7f94a).
    player.items.splice(
      player.items.findIndex((i) => i.unitId === tr2First!.unitId),
      1,
    )
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    const tr2Replaced = player.items.find((i) => i.code === 'tr2')
    expect(tr2Replaced).toBeDefined()
    player.items.splice(
      player.items.findIndex((i) => i.unitId === tr2Replaced!.unitId),
      1,
    )
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect(player.items.some((i) => i.code === 'tr2')).toBe(false)

    // 8. Town Anya (512) grants Sorceress Rare Orb, sets CUSTOM_9 | CUSTOM_10, clears REWARD_PENDING, and sets COMPLETED (status 13).
    const townAnya = game.spawnMonster({
      classId: 512,
      name: 'Anya',
      x: 22,
      y: 20,
      areaId: 109,
      isNpc: true,
    })
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: townAnya } } as never)
    game.stepFrames(1)
    expect(player.items.some((i) => i.quality === 6)).toBe(true)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_CUSTOM_9_113C).toBe(QUEST_FLAG_CUSTOM_9_113C)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_CUSTOM_10_113C).toBe(QUEST_FLAG_CUSTOM_10_113C)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(0)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(
      computeQuestStatusByte113c('a5q3', player.questFlags, {
        playerAreaId: 109,
        itemCodes: new Set(player.items.map((i) => i.code.trim().toLowerCase())),
      }),
    ).toBe(13)
  })

  it('supports reverse reward order (Town Anya 512 -> Malah 513), NPC 527 drehyaiced, and clears transient CUSTOM_4 on .d2s reload', () => {
    const game = new GameInstance({ seed: 201902, areaId: 114, difficulty: 0 })
    const pid = game.connectPlayer({ charClass: 'pal', name: 'PalAnya', x: 20, y: 20, areaId: 114, level: 30 })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          questFlags: Uint16Array
          items: Array<{ unitId: number; code: string; quality: number }>
        }
      >
    }
    const player = internal.players.get(pid)!
    const a5q3Idx = questWordIndex113c('a5q3')!

    const drehyaIced = game.spawnMonster({
      classId: 527,
      name: 'Anya',
      x: 21,
      y: 20,
      areaId: 114,
      isNpc: true,
    })
    const malah = game.spawnMonster({
      classId: 513,
      name: 'Malah',
      x: 21,
      y: 21,
      areaId: 114,
      isNpc: true,
    })
    const townAnya = game.spawnMonster({
      classId: 512,
      name: 'Anya',
      x: 19,
      y: 20,
      areaId: 114,
      isNpc: true,
    })

    // 1. Discover NPC 527 without 'ice' -> sets CUSTOM_4; export .d2s and verify a new game session clears transient CUSTOM_4 (0x6fc781bd).
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: drehyaIced } } as never)
    game.stepFrames(1)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_CUSTOM_4_113C).toBe(QUEST_FLAG_CUSTOM_4_113C)

    const d2sMid = game.exportPlayerD2s(pid)!
    expect(readD2sSave113c(d2sMid).quests[0][a5q3Idx]! & QUEST_FLAG_CUSTOM_4_113C).toBe(
      QUEST_FLAG_CUSTOM_4_113C,
    )
    const freshGame = new GameInstance({ seed: 201903, areaId: 109, difficulty: 0 })
    const freshPid = freshGame.connectPlayer({ d2s: d2sMid, x: 20, y: 20, areaId: 109 })
    const freshPlayer = (
      freshGame as unknown as { players: Map<number, { questFlags: Uint16Array; items: Array<{ code: string }> }> }
    ).players.get(freshPid)!
    expect(freshPlayer.questFlags[a5q3Idx]! & QUEST_FLAG_CUSTOM_4_113C).toBe(0)
    const freshMalah = freshGame.spawnMonster({
      classId: 513,
      name: 'Malah',
      x: 21,
      y: 20,
      areaId: 109,
      isNpc: true,
    })
    freshGame.enqueueCommand(freshPid, { type: 'NpcInit', target: { unitType: 1, id: freshMalah } } as never)
    freshGame.stepFrames(1)
    expect(freshPlayer.items.some((i) => i.code === 'ice')).toBe(false)

    // 2. Back in original game: Malah grants 'ice' -> NPC 527 thaws -> talk to Town Anya FIRST -> then Malah completes!
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect(player.items.some((i) => i.code === 'ice')).toBe(true)

    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: drehyaIced } } as never)
    game.stepFrames(1)
    expect(player.items.some((i) => i.code === 'ice')).toBe(false)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(
      QUEST_FLAG_REWARD_PENDING_113C,
    )

    // Talk to Town Anya (512) BEFORE Malah: grants Paladin Rare Shield, sets CUSTOM_9 | CUSTOM_10, keeps REWARD_PENDING (status 5)!
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: townAnya } } as never)
    game.stepFrames(1)
    expect(player.items.some((i) => i.quality === 6)).toBe(true)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_CUSTOM_9_113C).toBe(QUEST_FLAG_CUSTOM_9_113C)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(0)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(
      QUEST_FLAG_REWARD_PENDING_113C,
    )
    expect(
      computeQuestStatusByte113c('a5q3', player.questFlags, {
        playerAreaId: 109,
        itemCodes: new Set(player.items.map((i) => i.code.trim().toLowerCase())),
      }),
    ).toBe(5)

    // Now talk to Malah (513): grants 'tr2', sees CUSTOM_9 already set (0x6fc7f7cb), clears REWARD_PENDING, and sets COMPLETED!
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect(player.items.some((i) => i.code === 'tr2')).toBe(true)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(0)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(
      computeQuestStatusByte113c('a5q3', player.questFlags, {
        playerAreaId: 109,
        itemCodes: new Set(player.items.map((i) => i.code.trim().toLowerCase())),
      }),
    ).toBe(13)
  })

  it('starts a5q3 with STARTED | CUSTOM_3 (0x000C) on entering Area 112..114 and updates status 1 <-> 2 across Area 114', () => {
    const game = new GameInstance({ seed: 201904, areaId: 109, difficulty: 0 })
    const pid = game.connectPlayer({ charClass: 'sor', name: 'PassageSorc', x: 20, y: 20, areaId: 109 })
    const internal = game as unknown as {
      players: Map<number, { areaId: number; questFlags: Uint16Array; items: Array<{ code: string }> }>
      loadedAreas: Map<number, unknown>
      transitionPlayerArea: (player: unknown, destAreaId: number, arrival: { kind: string }) => boolean
    }
    const player = internal.players.get(pid)!
    const a5q3Idx = questWordIndex113c('a5q3')!

    expect(player.questFlags[a5q3Idx]).toBe(0)
    internal.transitionPlayerArea(player, 112, { kind: 'warp' })
    expect(player.questFlags[a5q3Idx]).toBe(QUEST_FLAG_STARTED_113C | QUEST_FLAG_CUSTOM_3_113C)
    expect(
      computeQuestStatusByte113c('a5q3', player.questFlags, {
        playerAreaId: player.areaId,
        itemCodes: new Set<string>(),
      }),
    ).toBe(1)

    internal.transitionPlayerArea(player, 114, { kind: 'warp' })
    expect(
      computeQuestStatusByte113c('a5q3', player.questFlags, {
        playerAreaId: player.areaId,
        itemCodes: new Set<string>(),
      }),
    ).toBe(2)
  })
})
