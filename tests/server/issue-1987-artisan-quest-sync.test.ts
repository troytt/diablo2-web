/**
 * Issue #1987 — Artisan quest reward lifecycle parity (`a1q5` Charsi Imbue,
 * `a5q1` Larzuk Add Sockets, `a5q4` Anya Personalize):
 * 1. Shenk (`a5q1`) and Nihlathak (`a5q4`) kills set `QFLAG_REWARDPENDING | QFLAG_COMPLETEDNOW`
 *    (`0x2002`) without `QFLAG_REWARDGRANTED` (`0x0001`), so `buildNpcMenuOptions` exposes
 *    `add_sockets` on Larzuk (`511`) and `personalize` on Anya (`512`).
 * 2. `handleArtisanService` emits `emitQuestFlagSync113c` (`S2C 0x28 QuestInfo` + `0x29` + `0x5D` + `0x5E`)
 *    on reward redemption, immediately updating `ClientWorld.quests` even after `NpcInit` (`_hasPlayerQuests = true`).
 * 3. `buildNpcMenuOptions` for Anya (`512`) gates `personalize` strictly on `q[38]` (`a5q4`),
 *    never falsely exposing it when `q[37]` (`a5q3`) is reward-pending.
 * 4. Nihlathak's Temple red portal (`109 -> 121`) closes once `a5q4` has `0x0001 | 0x0002` and
 *    Halls of Pain WP (`123`) is unlocked (`D2Game.dll` `0x6FC77F85..0x6FC77FAD`).
 */
import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { buildNpcMenuOptions } from '../../src/client/ui/panels/npc-dialog-menu.ts'
import { getTownNpcDescriptorByHcIdx } from '../../src/common/units/npc-table.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_COMPLETED_NOW_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  questWordIndex113c,
} from '../../src/server/engine/quests-113c.ts'

function makeServerItem(unitId: number, ownerId: number, areaId: number, code = 'cap', quality = 2, level = 35) {
  return {
    unitId,
    code,
    name: code,
    quality,
    level,
    location: 'inventory' as const,
    x: 0,
    y: 0,
    width: 2,
    height: 2,
    areaId,
    ownerId,
    bodyLoc: 0,
    storePage: 0,
    cost: 100,
    gamble: false,
    identified: true,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: 12,
    maxDurability: 12,
    quantity: 1,
    stats: new Map<number, number>(),
    socketedItems: [],
    rawItemData: { flags: 0x10, rawFlags: 0x10, ilvl: level, quality },
  }
}

function drainIntoWorld(game: GameInstance, playerId: number, world: ClientWorld, frames = 1) {
  const all = []
  for (let i = 0; i < frames; i++) {
    const out = game.stepFrame().get(playerId) ?? []
    for (const ev of out) {
      all.push(ev)
      world.apply(ev)
    }
  }
  return all
}

describe('issue #1987 artisan quest reward lifecycle and S2C 0x28 sync', () => {
  it('syncs Charsi (a1q5), Larzuk (a5q1), and Anya (a5q4) menu gates before and after redemption over ClientWorld', () => {
    const game = new GameInstance({ seed: 198701, areaId: 1 })
    const world = new ClientWorld()
    const playerId = game.connectPlayer({
      charClass: 'sor',
      name: 'ArtisanHero',
      level: 35,
      x: 10,
      y: 10,
      areaId: 1,
    })
    drainIntoWorld(game, playerId, world, 1)

    const internal = game as unknown as {
      players: Map<
        number,
        {
          questFlags: Uint16Array
          waypoints: Set<number>
          items: ReturnType<typeof makeServerItem>[]
          activeNpcId: number | undefined
        }
      >
    }
    const player = internal.players.get(playerId)!

    const charsiDesc = getTownNpcDescriptorByHcIdx(154)!
    const larzukDesc = getTownNpcDescriptorByHcIdx(511)!
    const anyaDesc = getTownNpcDescriptorByHcIdx(512)!

    const charsiId = game.spawnMonster({
      classId: 154,
      name: 'Charsi',
      x: 11,
      y: 10,
      areaId: 1,
      isNpc: true,
      isVendor: true,
    })
    const larzukId = game.spawnMonster({
      classId: 511,
      name: 'Larzuk',
      x: 12,
      y: 10,
      areaId: 1,
      isNpc: true,
      isVendor: true,
    })
    const anyaId = game.spawnMonster({
      classId: 512,
      name: 'Anya',
      x: 10,
      y: 11,
      areaId: 1,
      isNpc: true,
      isVendor: true,
    })
    drainIntoWorld(game, playerId, world, 1)

    // Initially none of the artisan rewards are unlocked
    expect(buildNpcMenuOptions(charsiDesc, { questFlags: world.quests, playerLevel: 35 }).map((o) => o.id)).not.toContain('imbue')
    expect(buildNpcMenuOptions(larzukDesc, { questFlags: world.quests, playerLevel: 35 }).map((o) => o.id)).not.toContain('add_sockets')
    expect(buildNpcMenuOptions(anyaDesc, { questFlags: world.quests, playerLevel: 35 }).map((o) => o.id)).not.toContain('personalize')

    // A5Q3 (q[37] reward pending) must NEVER falsely unlock Anya's Personalize menu (requires q[38] bit 1)
    const fakeA5q3Pending = new Uint16Array(48)
    fakeA5q3Pending[questWordIndex113c('a5q3')!] = QUEST_FLAG_REWARD_PENDING_113C
    expect(buildNpcMenuOptions(anyaDesc, { questFlags: fakeA5q3Pending, playerLevel: 35 }).map((o) => o.id)).not.toContain('personalize')

    // 1. Charsi A1Q5: turn in Horadric Malus ('hdm') via NpcInit -> sets _hasPlayerQuests = true on ClientWorld
    player.items.push(makeServerItem(9100, playerId, 1, 'hdm', 2, 12))
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: charsiId } })
    drainIntoWorld(game, playerId, world, 2)
    expect(world.quests[3]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(QUEST_FLAG_REWARD_PENDING_113C)
    expect(world.quests[3]! & QUEST_FLAG_COMPLETED_113C).toBe(0)
    expect(buildNpcMenuOptions(charsiDesc, { questFlags: world.quests, playerLevel: 35 }).map((o) => o.id)).toContain('imbue')

    // Redeem Charsi Imbue -> must emit S2C 0x28 QuestInfo immediately and hide 'imbue' without re-clicking Charsi
    player.items.push(makeServerItem(9101, playerId, 1, 'cap', 2, 35))
    game.enqueueCommand(playerId, {
      type: 'NpcEntityAction',
      npcId: charsiId,
      action: 0,
      complement: 9101,
    })
    const imbueEvents = drainIntoWorld(game, playerId, world, 1)
    expect(imbueEvents.some((e) => e.type === 'QuestState' && e.source === 0x28)).toBe(true)
    expect(world.quests[3]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(0)
    expect(world.quests[3]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(buildNpcMenuOptions(charsiDesc, { questFlags: world.quests, playerLevel: 35 }).map((o) => o.id)).not.toContain('imbue')

    // 2. Larzuk A5Q1: kill Shenk -> sets 0x2002 (NOT 0x0001) so Larzuk menu offers 'add_sockets'
    const shenkId = game.spawnMonster({
      defId: 'overseer1',
      superUniqueId: 'Siege Boss',
      x: 13,
      y: 10,
      areaId: 1,
      hp: 10,
      maxHp: 10,
    })
    game.applyDamageToMonster(shenkId, 1000, playerId)
    drainIntoWorld(game, playerId, world, 1)
    const a5q1Idx = questWordIndex113c('a5q1')!
    expect(player.questFlags[a5q1Idx]).toBe(
      QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(world.quests[a5q1Idx]).toBe(
      QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(buildNpcMenuOptions(larzukDesc, { questFlags: world.quests, playerLevel: 35 }).map((o) => o.id)).toContain('add_sockets')

    // Interact with Larzuk and redeem Add Sockets -> transitions 0x2002 -> 0x2001 and hides 'add_sockets'
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: larzukId } })
    drainIntoWorld(game, playerId, world, 2)
    const socketCap = makeServerItem(9102, playerId, 1, 'cap', 2, 50)
    player.items.push(socketCap)
    game.enqueueCommand(playerId, {
      type: 'NpcEntityAction',
      npcId: larzukId,
      action: 0,
      complement: 9102,
    })
    const socketEvents = drainIntoWorld(game, playerId, world, 1)
    expect(socketCap.totalSockets).toBe(2)
    expect(socketEvents.some((e) => e.type === 'QuestState' && e.source === 0x28)).toBe(true)
    expect(world.quests[a5q1Idx]).toBe(
      QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(buildNpcMenuOptions(larzukDesc, { questFlags: world.quests, playerLevel: 35 }).map((o) => o.id)).not.toContain('add_sockets')

    // 3. Anya A5Q4: kill Nihlathak -> sets 0x2002 (NOT 0x0001) so Anya menu offers 'personalize'
    const nihlId = game.spawnMonster({
      defId: 'nihlathakboss',
      superUniqueId: 'Nihlathak Boss',
      x: 14,
      y: 10,
      areaId: 1,
      hp: 10,
      maxHp: 10,
    })
    game.applyDamageToMonster(nihlId, 1000, playerId)
    drainIntoWorld(game, playerId, world, 1)
    const a5q4Idx = questWordIndex113c('a5q4')!
    expect(player.questFlags[a5q4Idx]).toBe(
      QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(world.quests[a5q4Idx]).toBe(
      QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(buildNpcMenuOptions(anyaDesc, { questFlags: world.quests, playerLevel: 35 }).map((o) => o.id)).toContain('personalize')

    // Interact with Anya and redeem Personalize -> transitions 0x2002 -> 0x2001 and hides 'personalize'
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: anyaId } })
    drainIntoWorld(game, playerId, world, 2)
    const persCap = makeServerItem(9103, playerId, 1, 'cap', 2, 50)
    player.items.push(persCap)
    game.enqueueCommand(playerId, {
      type: 'NpcEntityAction',
      npcId: anyaId,
      action: 0,
      complement: 9103,
    })
    const persEvents = drainIntoWorld(game, playerId, world, 1)
    expect(
      (persCap.rawItemData as { personalized?: boolean }).personalized,
    ).toBe(true)
    expect(persEvents.some((e) => e.type === 'QuestState' && e.source === 0x28)).toBe(true)
    expect(world.quests[a5q4Idx]).toBe(
      QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(buildNpcMenuOptions(anyaDesc, { questFlags: world.quests, playerLevel: 35 }).map((o) => o.id)).not.toContain('personalize')
  })

  it('closes Nihlathak red portal (109 -> 121) when a5q4 is reward-pending (0x2002) and Halls of Pain WP (123) is unlocked', () => {
    const game = new GameInstance({ seed: 198702, areaId: 109 })
    const playerId = game.connectPlayer({
      charClass: 'sor',
      name: 'PortalHero',
      level: 38,
      areaId: 109,
    })
    const internal = game as unknown as {
      players: Map<number, { questFlags: Uint16Array; waypoints: Set<number> }>
      objects: Map<number, { areaId: number; classId: number; destAreaId?: number }>
      syncHarrogathA5Q3State113c: (p?: unknown) => void
    }
    const player = internal.players.get(playerId)!
    player.questFlags[questWordIndex113c('a5q3')!] = QUEST_FLAG_COMPLETED_113C
    internal.syncHarrogathA5Q3State113c(player)

    const hasPindlePortal = () =>
      [...internal.objects.values()].some(
        (o) => o.areaId === 109 && o.classId === 60 && o.destAreaId === 121,
      )
    expect(hasPindlePortal()).toBe(true)

    // Kill Nihlathak (sets 0x2002 without redeeming Anya Personalize yet) without WP 123 -> portal stays open
    const nihlId = game.spawnMonster({
      defId: 'nihlathakboss',
      superUniqueId: 'Nihlathak Boss',
      x: 5110,
      y: 5050,
      areaId: 109,
      hp: 10,
      maxHp: 10,
    })
    game.applyDamageToMonster(nihlId, 1000, playerId)
    expect(hasPindlePortal()).toBe(true)

    // Unlock Halls of Pain WP (123) -> portal closes even while Personalize is still pending (0x2002)
    player.waypoints.add(123)
    internal.syncHarrogathA5Q3State113c(player)
    expect(hasPindlePortal()).toBe(false)
  })
})
