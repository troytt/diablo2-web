/**
 * Tier 5 — White-Box Adversarial Coverage Hardening Tests (`T5.A1`–`T5.A15` & `T5.B1`–`T5.B15`).
 *
 * Produced by Milestone M4 Phase 2 White-Box Adversarial Challengers (`challenger_m4_1` & `challenger_m4_2`)
 * after inspecting the implementation source code of `F1`–`F12` (`src/server/**`, `src/netproto/**`,
 * `src/client/**`, and `src/common/**`) to exercise internal state transitions, edge branches,
 * corruption guards, protocol framing limits, fault isolation, and determinism invariants not
 * covered by the opaque-box Tiers 1–4 suite.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import * as Server from '../../../src/server/index.ts'
import * as Netproto from '../../../src/netproto/index.ts'
import { D2Rng } from '../../../src/common/rng/d2-rng.ts'
import {
  defaultD2gsHuffmanCodec,
  wrapD2gsCompressedBlock,
} from '../../../src/netproto/d2gs/compression.ts'
import { extractCharSummaryFromD2s } from '../../../src/server/save/d2s-reader.ts'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import { ClientWorld } from '../../../src/client/world/client-world.ts'
import {
  collectTsFilesRecursive,
  createSampleD2sCharacterData,
  FIXED_ONE,
  getSharedDataRegistry,
  readRepoFile,
  recordAdapterEvents,
  repoPathExists,
  SRC_DIR,
  toRepoRelative,
} from './helpers.ts'

/** #1337: NpcBuy now requires a real vendor-pool entry instead of the old `cap` fallback. */
function giveVendorPool(game: Server.GameInstance, npcId: number, costs: readonly number[]): number[] {
  const monsters = (game as unknown as {
    monsters: Map<number, { vendorPool: unknown[]; areaId: number }>
  }).monsters
  const npc = monsters.get(npcId)!
  const unitIds: number[] = []
  npc.vendorPool = costs.map((cost, i) => {
    const unitId = 9100 + i
    unitIds.push(unitId)
    return {
      unitId,
      code: 'cap',
      name: 'Cap',
      quality: 2,
      level: 1,
      location: 'vendor',
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      areaId: npc.areaId,
      ownerId: npcId,
      bodyLoc: 0,
      storePage: 1,
      cost,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 0,
      maxDurability: 0,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    }
  })
  return unitIds
}

describe('Tier 5 Part A — White-Box Adversarial Tests (F1–F6, F10, F12)', () => {
  // T5.A1: GameInstance paused command deferral FIFO replay & control-command pass-through
  it('T5.A1: GameInstance executes /players N while paused and replays deferred gameplay commands in exact FIFO order on unpause', () => {
    const d2sBytes = Server.writeD2s(
      createSampleD2sCharacterData({
        name: 'PauseHero',
        charClass: 1,
        level: 20,
        attributesOverrides: {
          strength: 40,
          vitality: 60,
          statPts: 10,
        },
      }),
    )
    const game = new Server.GameInstance({
      policy: Server.SINGLE_PLAYER_POLICY,
      mapSeed: 0x5101,
    })
    const p1 = game.addPlayer({ charName: 'PauseHero', classId: 1, level: 20, d2sBytes })
    const beforeSnap = game.getPlayerState(p1)!
    const initialStr = beforeSnap.strength
    const initialVit = beforeSnap.vitality
    const initialX = beforeSnap.x
    const initialY = beforeSnap.y

    // Pause the singleplayer game
    game.enqueueCommand(p1, { type: 'PauseGame', paused: true })
    game.stepFrame()
    expect(game.paused).toBe(true)

    // Control command (/players 5) executes immediately while paused; gameplay commands defer in FIFO order
    game.enqueueCommand(p1, { type: 'Chat', text: '/players 5' })
    game.enqueueCommand(p1, { type: 'AllocateStat', statId: 0, amount: 2 }) // +2 Strength
    game.enqueueCommand(p1, { type: 'AllocateStat', statId: 3, amount: 3 }) // +3 Vitality
    game.enqueueCommand(p1, { type: 'Move', x: initialX + 6, y: initialY, run: true })
    game.enqueueCommand(p1, { type: 'SelectSkill', skillId: 36, hand: 'right' })

    game.stepFrame()
    expect(game.playersX).toBe(5)

    // Gameplay state remains completely frozen while paused
    const midSnap = game.getPlayerState(p1)!
    expect(midSnap.strength).toBe(initialStr)
    expect(midSnap.vitality).toBe(initialVit)
    expect(midSnap.x).toBe(initialX)
    expect(midSnap.y).toBe(initialY)

    // Unpause: frame 1 processes PauseGame(false) after re-deferring items ahead of it; frame 2 replays deferred commands in FIFO order
    game.enqueueCommand(p1, { type: 'PauseGame', paused: false })
    game.stepFrames(2)
    expect(game.paused).toBe(false)

    const afterSnap = game.getPlayerState(p1)!
    expect(afterSnap.strength).toBe(initialStr + 2)
    expect(afterSnap.vitality).toBe(initialVit + 3)
    expect(afterSnap.rightSkill).toBe(36)
    expect(afterSnap.x).toBeGreaterThan(initialX)
  })

  // T5.A2: GameInstance player lethal damage -> 10% gold loss, equipped-only transfer to corpseItems, Respawn, and corpse recovery
  it('T5.A2: GameInstance lethal player damage transfers only equipped items to corpseItems with 10% gold penalty and restores them on corpse recovery', () => {
    const d2sBytes = Server.writeD2s(
      createSampleD2sCharacterData({
        name: 'CorpseHero',
        charClass: 4,
        level: 15,
        attributesOverrides: {
          gold: 1000,
          hitpointsFixed: 10 * FIXED_ONE,
          maxHpFixed: 200 * FIXED_ONE,
        },
      }),
    )

    const game = new Server.GameInstance({
      policy: Server.SINGLE_PLAYER_POLICY,
      mapSeed: 0x5102,
      areaId: 2,
    })
    const p1 = game.addPlayer({ charName: 'CorpseHero', classId: 4, level: 15, d2sBytes })

    // Buy an armor piece and equip it to slot 1 (Helm), plus keep a second item in inventory
    const vendorId = game.spawnMonster({
      classId: 154,
      x: 120,
      y: 120,
      areaId: 2,
      isNpc: true,
      isVendor: true,
      isKillable: false,
      aiDisabled: true,
    })
    const [firstId, secondId] = giveVendorPool(game, vendorId, [0, 0])
    game.enqueueCommand(p1, { type: 'NpcBuy', npcId: vendorId, itemId: firstId, cost: 0 })
    game.enqueueCommand(p1, { type: 'NpcBuy', npcId: vendorId, itemId: secondId, cost: 0 })
    game.stepFrame()

    const boughtSnap = game.getPlayerState(p1)!
    const helmItem = boughtSnap.items[0]!
    const invItem = boughtSnap.items[1]!
    game.enqueueCommand(p1, { type: 'ItemEquip', itemId: helmItem.unitId, slot: 1 })
    game.stepFrame()

    const equippedSnap = game.getPlayerState(p1)!
    expect(equippedSnap.items.find((it) => it.unitId === helmItem.unitId)?.location).toBe('equipped')
    expect(equippedSnap.items.find((it) => it.unitId === invItem.unitId)?.location).toBe('inventory')

    // Position a lethal monster right next to the player
    const monsterId = game.spawnMonster({
      defId: 'zombie1',
      name: 'Lethal Zombie',
      level: 30,
      x: equippedSnap.x + 1,
      y: equippedSnap.y,
      hp: 100,
      minDmg: 50,
      maxDmg: 50,
      ar: 99999,
      ac: 0,
      experience: 50,
      areaId: 2,
    })
    expect(monsterId).toBeGreaterThan(0)
    game.drainPlayerEvents(p1)

    // Step frames until the zombie's melee swing kills the player
    let died = false
    for (let i = 0; i < 60; i += 1) {
      game.stepFrame()
      if (game.getPlayerState(p1)!.mode === 17) {
        died = true
        break
      }
    }
    expect(died).toBe(true)

    const deadSnap = game.getPlayerState(p1)!
    expect(deadSnap.hp).toBe(0)
    expect(deadSnap.dead).toBe(true)
    expect(deadSnap.gold).toBe(900) // 10% of 1000 lost
    expect(deadSnap.corpseId).not.toBeNull()
    expect(deadSnap.items.some((it) => it.unitId === invItem.unitId)).toBe(true)
    expect(deadSnap.items.some((it) => it.unitId === helmItem.unitId)).toBe(false)

    const deathEvents = game.drainPlayerEvents(p1)
    expect(
      deathEvents.some((e) => e.type === 'CorpseAssign' && e.assign === 1 && e.ownerId === p1),
    ).toBe(true)

    // Export .d2s while dead with corpse items and verify corpseItems persist in .d2s
    const deadD2s = Server.readD2s(game.exportPlayerD2s(p1))
    expect(deadD2s.corpseItems.length).toBe(1)
    expect(deadD2s.corpseItems[0]?.code.trim()).toBe('cap')

    // Respawn returns player to town with full HP and dead=false while corpse items remain on corpse
    const corpseId = deadSnap.corpseId!
    game.enqueueCommand(p1, { type: 'Respawn' })
    game.stepFrame()
    const respawnedSnap = game.getPlayerState(p1)!
    expect(respawnedSnap.hp).toBe(respawnedSnap.maxHp)
    expect(respawnedSnap.dead).toBe(false)
    expect(Server.readD2s(game.exportPlayerD2s(p1)).corpseItems.length).toBe(1)

    // Interacting with corpseId recovers equipped items and emits CorpseAssign(assign=0)
    game.enqueueCommand(p1, { type: 'InteractEntity', targetType: 'player', targetId: corpseId })
    game.stepFrame()
    const recoveredSnap = game.getPlayerState(p1)!
    expect(recoveredSnap.corpseId).toBeUndefined()
    expect(Server.readD2s(game.exportPlayerD2s(p1)).corpseItems.length).toBe(0)
    expect(
      recoveredSnap.items.some((it) => it.unitId === helmItem.unitId && it.location === 'equipped'),
    ).toBe(true)

    const recoveryEvents = game.drainPlayerEvents(p1)
    expect(
      recoveryEvents.some((e) => e.type === 'CorpseAssign' && e.assign === 0 && e.corpseId === corpseId),
    ).toBe(true)
  })

  // T5.A3: GameInstance dynamic /players X active monster HP ratio preservation & party XP split + multi-level-up
  it('T5.A3: GameInstance rescales living monster HP preserving HP ratio on /players change and splits kill XP evenly across same-area party members', () => {
    const game = new Server.GameInstance({
      policy: Server.OPEN_BNET_POLICY,
      mapSeed: 0x5103,
      areaId: 2,
    })
    const p1 = game.addPlayer({ charName: 'PartyLeader', classId: 1, level: 1, x: 100, y: 100 })
    const p2 = game.addPlayer({ charName: 'PartyMate', classId: 2, level: 1, x: 102, y: 100 })
    const p3 = game.addPlayer({ charName: 'SoloOutsider', classId: 3, level: 1, x: 104, y: 100 })

    // Put p1 and p2 in Party 1 (action 0x06 = invite/join, 0x08 = accept), leave p3 unpartied
    game.enqueueCommand(p1, { type: 'PartyAction', action: 0x06, targetPlayerId: p2 })
    game.stepFrame()
    expect(game.getPlayerState(p1)!.partyId).toBe(p1)
    expect(game.getPlayerState(p2)!.partyId).toBe(p1)
    expect(game.getPlayerState(p3)!.partyId).toBe(0xffff)

    // With 3 connected players, initial playersX = 3 -> mult = (3+1)/2 = 2x -> baseMaxHp 15 scales to maxHp = 30
    const monId = game.spawnMonster({
      defId: 'fallen1',
      name: 'Ratio Fallen',
      x: 101,
      y: 100,
      maxHp: 15,
      aiDisabled: true,
      areaId: 2,
      experience: 1500,
    })
    expect(game.getMonsterState(monId)!.maxHp).toBe(30)
    expect(game.getMonsterState(monId)!.hp).toBe(30)

    // A deterministic 15-point physical hit from p1 reduces HP to 15/30 (50%). (Player Attack damage is
    // now the rolled equipped-weapon / unarmed 1-2 hit, so the ratio test uses an exact hit.)
    game.applyDamageToMonster(monId, 15, p1)
    expect(game.getMonsterState(monId)!.hp).toBe(15)
    expect(game.getMonsterState(monId)!.maxHp).toBe(30)

    // Switch to /players 7 -> multiplier (7 + 1) / 2 = 4x -> maxHp = 60, hp = 30 (50% ratio preserved)
    game.setPlayersX(7)
    expect(game.getMonsterState(monId)!.maxHp).toBe(60)
    expect(game.getMonsterState(monId)!.hp).toBe(30)

    // Deal 2 more 15-damage hits (30 total) to kill the monster
    game.applyDamageToMonster(monId, 15, p1)
    game.applyDamageToMonster(monId, 15, p1)
    expect(game.getMonsterState(monId)!.hp).toBe(0)
    expect(game.getMonsterState(monId)!.dead).toBe(true)

    // Total XP at /players 7 = floor(1500 * (7 + 1) / 2) = 6000; 2-player party pool = 6000 + floor(6000*89/256) = 8085 -> 4042 each
    // Level 1 -> Level 4 threshold is 3750 XP (Level 2 = 500, Level 3 = 1500, Level 4 = 3750, Level 5 = 7875)
    const s1 = game.getPlayerState(p1)!
    const s2 = game.getPlayerState(p2)!
    const s3 = game.getPlayerState(p3)!
    expect(s1.experience).toBe(4042)
    expect(s2.experience).toBe(4042)
    expect(s3.experience).toBe(0)
    expect(s1.level).toBe(4)
    expect(s2.level).toBe(4)
    expect(s1.statPts).toBe(15) // +5 per level * 3 levels gained
    expect(s1.newSkills).toBe(3) // +1 per level * 3 levels gained
  })

  // T5.A4: resolveGameModePolicy clamping & overrides, duplicate case-insensitive character name rejection, and whisper chat isolation
  it('T5.A4: resolveGameModePolicy clamps bounds, connectPlayer rejects case-insensitive duplicate names, and whisperTo isolates chat events', () => {
    const customSingle = Server.resolveGameModePolicy('sp', {
      maxPlayers: 99,
      defaultPlayersX: 0,
      allowPause: false,
      persistMapSeedAndFog: false,
    })
    expect(customSingle.maxPlayers).toBe(8)
    expect(customSingle.defaultPlayersX).toBe(1)
    expect(customSingle.allowPause).toBe(false)
    expect(customSingle.persistMapSeedAndFog).toBe(false)

    const game = new Server.GameInstance({
      policy: Server.OPEN_BNET_POLICY,
      mapSeed: 0x5104,
    })
    const pA = game.addPlayer({ charName: 'AlphaHero', classId: 0 })
    const pB = game.addPlayer({ charName: 'BravoHero', classId: 1 })
    const pC = game.addPlayer({ charName: 'CharlieHero', classId: 2 })

    // Duplicate case-insensitive character name must be rejected
    expect(() => game.addPlayer({ charName: 'alphahero', classId: 3 })).toThrow(/already in the game/i)

    // Clear initial join events
    game.drainPlayerEvents(pA)
    game.drainPlayerEvents(pB)
    game.drainPlayerEvents(pC)

    // Whisper from AlphaHero to 'bravohero' (case-insensitive target match)
    game.enqueueCommand(pA, {
      type: 'Chat',
      text: 'Top secret coordinates',
      whisperTo: 'bravohero',
    })
    game.stepFrame()

    const eventsA = game.drainPlayerEvents(pA).filter((e) => e.type === 'Chat')
    const eventsB = game.drainPlayerEvents(pB).filter((e) => e.type === 'Chat')
    const eventsC = game.drainPlayerEvents(pC).filter((e) => e.type === 'Chat')

    expect(eventsA.length).toBe(1)
    expect(eventsA[0]?.type === 'Chat' && eventsA[0].kind).toBe('whisper')
    expect(eventsB.length).toBe(1)
    expect(eventsB[0]?.type === 'Chat' && eventsB[0].text).toBe('Top secret coordinates')
    expect(eventsC.length).toBe(0) // CharlieHero must not receive the whisper
  })

  // T5.A5: RoomStreamer & streamActiveRooms113c multi-player hysteresis band (1600, 2400] and tuple coordinate support
  it('T5.A5: RoomStreamer and streamActiveRooms113c enforce multi-player (1600, 2400] hysteresis and keep dead monsters non-sleeping', () => {
    const monsterStats = Server.DEMO_MONSTERS[0]!
    const farPlayer: Server.CombatPlayer = {
      x: 3000,
      y: 0,
      hp: 100,
      maxHp: 100,
      mana: 100,
      maxMana: 100,
      level: 1,
      xp: 0,
      alive: true,
      cooldown: 0,
      facing: 0,
      respawnIn: 0,
      swingTicks: 0,
    }
    const world: Server.CombatWorld = {
      player: farPlayer,
      players: [farPlayer],
      monsters: [],
      events: [],
      tick: 0,
      kills: 0,
      xp: 0,
      level: 1,
    }
    const terrain: Server.CombatTerrain = { overlap: () => 0 }
    const streamer = new Server.RoomStreamer(
      world,
      terrain,
      [
        {
          id: 'room-origin',
          minX: -10,
          minY: -10,
          maxX: 10,
          maxY: 10,
          packs: [{ members: [monsterStats, monsterStats] }],
        },
      ],
      { activationRadius: 1600, deactivationRadius: 2400 },
    )

    // Step 1: Single player at distance 1800 from bounds [-10..10] (d = 1790, inside hysteresis band before activation) -> should NOT activate
    const s1 = streamer.updateForPlayers([{ x: 1800, y: 0 }])
    expect(s1.populatedRooms.length).toBe(0)
    expect(s1.activeRoomIds).toEqual([])
    expect(world.monsters.length).toBe(0)

    // Step 2: Second player enters at tuple [1200, 0] (d = 1190 <= 1600) -> lazily populates and wakes room
    const s2 = Server.streamActiveRooms113c(streamer, [{ x: 2600, y: 0 }, [1200, 0]])
    expect(s2.populatedRooms.length).toBe(1)
    expect(s2.activeRoomIds).toEqual(['room-origin'])
    expect(world.monsters.length).toBe(2)
    expect(world.monsters[0]?.sleeping).toBe(false)

    // Mark monster[1] as dead to verify hibernation does not mark dead monsters as sleeping
    world.monsters[1]!.state = 'dead'
    world.monsters[1]!.hp = 0
    world.monsters[1]!.sleeping = false

    // Step 3: Both players move into the hysteresis band (1600 < d <= 2400) -> room stays active!
    const s3 = streamer.updateForPlayers([[2000, 0], { x: 0, y: 2300 }])
    expect(s3.activeRoomIds).toEqual(['room-origin'])
    expect(world.monsters[0]?.sleeping).toBe(false)

    // Step 4: All players move outside deactivationRadius (d > 2400) -> room hibernates, alive monster sleeps, dead monster stays non-sleeping
    const s4 = streamer.updateForPlayers([[2500, 0], [0, 3000]])
    expect(s4.activeRoomIds).toEqual([])
    expect(world.monsters[0]?.sleeping).toBe(true)
    expect(world.monsters[1]?.sleeping).toBe(false)
  })

  // T5.A6: SummonManager group exclusivity, 5-trap FIFO eviction, Iron Golem metallic item check, corpse validation, and Paladin Revive 12.5% HP backlash
  it('T5.A6: SummonManager enforces golem exclusivity, 5-trap FIFO eviction, metallic/corpse requirements, and Paladin Revive 12.5% life backlash', () => {
    const registry = getSharedDataRegistry()
    const manager = new Server.SummonManager(registry)
    const statList = new Server.UnitStatList(registry, {
      level: 80,
      maxhp: 1600 * FIXED_ONE,
      hitpoints: 1600 * FIXED_ONE,
    })
    const stateBus = new Server.StateBus(statList, registry)
    const palOwner = {
      id: 'pal_caster',
      name: 'PaladinHero',
      charClass: 'pal',
      statList,
      stateBus,
    }

    // 1. Golem group exclusivity: casting Blood Golem (85) replaces Clay Golem (75)
    const clay = manager.createPet({ owner: palOwner, skillId: 75, slvl: 10 })
    expect(clay.created).toBe(true)
    const blood = manager.createPet({ owner: palOwner, skillId: 85, slvl: 10 })
    expect(blood.created).toBe(true)
    expect(blood.evictedPetUids).toEqual([clay.pet!.uid])
    expect(manager.getActivePets().filter((p) => p.petType === 'golem').length).toBe(1)
    expect(manager.getActivePets().find((p) => p.petType === 'golem')?.sourceSkillId).toBe(85)

    // 2. Iron Golem (90) rejects non-metallic item and consumes metallic ground item
    const nonMetalItem = { id: 'bow-1', isMetallic: false, consumed: false }
    const badIron = manager.createPet({
      owner: palOwner,
      skillId: 90,
      slvl: 10,
      groundItems: [nonMetalItem],
    })
    expect(badIron.created).toBe(false)
    expect(badIron.reason).toBe('invalid_item')

    const metalItem = { id: 'plate-1', isMetallic: true, consumed: false, defense: 250 }
    const goodIron = manager.createPet({
      owner: palOwner,
      skillId: 90,
      slvl: 10,
      groundItems: [metalItem],
    })
    expect(goodIron.created).toBe(true)
    expect(metalItem.consumed).toBe(true)
    expect(manager.getActivePets().find((p) => p.petType === 'golem')?.sourceSkillId).toBe(90)

    // 3. Corpse validation & Paladin Revive (95) 12.5% (1600 >> 3 = 200 HP) life backlash
    const bossCorpse = { id: 'c-boss', consumed: false, baseMaxHp: 5000, isBoss: true }
    const rejectedBoss = manager.createPet({
      owner: palOwner,
      skillId: 95,
      slvl: 10,
      corpses: [bossCorpse],
    })
    expect(rejectedBoss.created).toBe(false)
    expect(rejectedBoss.reason).toBe('missing_corpse')

    const validCorpse = { id: 'c-1', consumed: false, baseMaxHp: 1000 }
    const hpBeforeRevive = statList.getHp()
    const revived = manager.createPet({
      owner: palOwner,
      skillId: 95,
      slvl: 10,
      corpses: [validCorpse],
    })
    expect(revived.created).toBe(true)
    expect(validCorpse.consumed).toBe(true)
    expect(statList.getHp()).toBe(hpBeforeRevive - 200)

    // 4. Assassin 5-trap cap across mixed trap skills with FIFO eviction on the 6th trap
    const trapSkills = [261, 262, 271, 272, 276, 271]
    const spawnedTrapIds: string[] = []
    for (const sk of trapSkills) {
      const res = manager.createPet({ owner: palOwner, skillId: sk, slvl: 10 })
      expect(res.created).toBe(true)
      spawnedTrapIds.push(res.pet!.uid)
    }
    const activeTraps = manager.getActivePets().filter((p) => p.petType === 'assassintrap')
    expect(activeTraps.length).toBe(5)
    expect(activeTraps.map((t) => t.uid)).toEqual(spawnedTrapIds.slice(1))
  })

  // T5.A7: unsummonOwnPetAt 3-arg & 4-arg overloads, owner isolation, non-unsummonable rejection, and Druid spirit aura cleanup
  it('T5.A7: unsummonOwnPetAt enforces owner isolation and unsummonable flags and strips Druid spirit aura state on dismissal', () => {
    const registry = getSharedDataRegistry()
    const manager = new Server.SummonManager(registry)
    const statListA = new Server.UnitStatList(registry, {
      level: 50,
      maxhp: 500 * FIXED_ONE,
      hitpoints: 500 * FIXED_ONE,
    })
    const stateBusA = new Server.StateBus(statListA, registry)
    const ownerA = { id: 'player-A', name: 'DruidA', statList: statListA, stateBus: stateBusA }

    // Spawn a Raven (skill 221, unsummon = 0) and a Clay Golem (skill 75, unsummon = 1)
    const raven = manager.createPet({ owner: ownerA, skillId: 221, slvl: 5, x: 50, y: 50 })
    expect(raven.created).toBe(true)

    // Attempting to unsummon Raven via 4-arg overload must return null
    expect(Server.unsummonOwnPetAt(manager, 'player-A', 50, 50, 100)).toBeNull()

    const golem = manager.createPet({ owner: ownerA, skillId: 75, slvl: 5, x: 120, y: 120 })
    expect(golem.created).toBe(true)

    // Player B attempting to unsummon Player A's golem must fail (owner isolation)
    expect(Server.unsummonOwnPetAt(manager, 'player-B', 120, 120, 100)).toBeNull()
    // Player A unsummoning their own golem succeeds
    const dismissedGolem = Server.unsummonOwnPetAt(manager, 'player-A', 120, 120, 100)
    expect(dismissedGolem?.uid).toBe(golem.pet!.uid)

    // 3-arg overload with player.summons + stateBus cleanup for Oak Sage (petType: 'totem' -> removes 'oaksage')
    stateBusA.applyState({ stateNameOrId: 'oaksage', slvl: 10, durationFrames: 1000 })
    expect(stateBusA.hasState('oaksage')).toBe(true)
    const playerWithSummons = {
      summons: [{ uid: 'oak-1', petType: 'totem', skillId: 226, x: 200, y: 100, hp: 150, alive: true }],
      combatContext: { stateBus: stateBusA },
      activeDruidTotemAura: 'oaksage' as unknown,
    }
    const dismissedOak = Server.unsummonOwnPetAt(playerWithSummons, 210, 105, 48)
    expect(dismissedOak?.uid).toBe('oak-1')
    expect(playerWithSummons.summons.length).toBe(0)
    expect(stateBusA.hasState('oaksage')).toBe(false)
    expect(playerWithSummons.activeDruidTotemAura).toBeUndefined()

    // WorldArena pre-spawns Clay Golem for Unsummon (skillId = 3) and dismisses it on triggerCast
    const arena = new Server.WorldArena({ registry, skillId: 3, slvl: 1 })
    expect(arena.summonManager.getActivePets().length).toBe(1)
    arena.triggerCast(0, 80)
    expect(arena.summonManager.getActivePets().length).toBe(0)
  })

  // T5.A8: resolveMonsterDropPending113c, queueMonsterDeathDrop113c, and tickPendingMonsterDrops113c
  it('T5.A8: resolveMonsterDropPending113c selects Quest TC4 on Act Boss first kill vs TC1 on repeat kill and gates drops behind deathTicks', () => {
    const dropTables = Server.getEmbeddedDropTables()

    // Fail-fast validation on invalid monsterLevel or unknown subjectId
    expect(() =>
      Server.resolveMonsterDropPending113c(
        undefined,
        { kind: 'kill', subjectId: 'andariel', monsterRank: 'boss', monsterLevel: 0, x: 100, y: 100 },
        { dropTables, difficulty: 'normal' },
      ),
    ).toThrow(/Invalid monsterLevel/i)

    expect(() =>
      Server.resolveMonsterDropPending113c(
        undefined,
        { kind: 'kill', subjectId: 'nonexistent_monster_xyz', monsterRank: 'normal', monsterLevel: 12, x: 100, y: 100 },
        { dropTables, difficulty: 'normal' },
      ),
    ).toThrow(/unknown monster/i)

    const killEvent: Server.CombatEvent = {
      kind: 'kill',
      subjectId: 'andariel',
      monsterRank: 'boss',
      monsterLevel: 12,
      x: 100,
      y: 100,
    }

    // First kill of Act Boss Andariel -> uses Quest TC (monsterType = 4) and fires onMarkBossFirstKill callback
    let markedBoss = ''
    const firstKill = Server.resolveMonsterDropPending113c(undefined, killEvent, {
      dropTables,
      difficulty: 'normal',
      wasBossAlreadyKilled: false,
      onMarkBossFirstKill: (id, diff) => {
        markedBoss = `${id}:${diff}`
      },
    })
    expect(firstKill).not.toBeNull()
    expect(firstKill!.isBoss).toBe(true)
    expect(firstKill!.monsterType).toBe(4)
    expect(markedBoss).toBe('andariel:normal')

    // Repeat kill of Act Boss Andariel -> uses normal TC (monsterType = 1)
    const repeatKill = Server.resolveMonsterDropPending113c(undefined, killEvent, {
      dropTables,
      difficulty: 'normal',
      wasBossAlreadyKilled: true,
    })
    expect(repeatKill).not.toBeNull()
    expect(repeatKill!.isBoss).toBe(true)
    expect(repeatKill!.monsterType).toBe(1)

    // Death animation tick gating via queueMonsterDeathDrop113c & tickPendingMonsterDrops113c
    const bossMonster: Server.CombatMonster = {
      index: 1,
      stats: Server.DEMO_MONSTERS[0]!,
      x: 100,
      y: 100,
      hp: 0,
      state: 'dead',
      cooldown: 0,
      facing: 0,
      hitFlash: 0,
      corpseTicks: 0,
      deathGated: true,
      deathTicks: 4,
      animMode: 'dt',
      dropRolled: false,
      dwInitSeed: 0x13572468,
    }
    const triggeredDrops: Array<readonly unknown[]> = []
    const queuedPending = Server.queueMonsterDeathDrop113c(
      bossMonster,
      killEvent,
      { dropTables, difficulty: 'normal', wasBossAlreadyKilled: false },
      (_mon, items) => triggeredDrops.push(items),
    )
    expect(queuedPending?.tcName).toBe('Andarielq')
    expect(triggeredDrops.length).toBe(0)
    expect(bossMonster.dropRolled).toBe(false)
    expect(bossMonster.pendingDrop).toBeDefined()

    for (let tick = 1; tick <= 3; tick += 1) {
      const fired = Server.tickPendingMonsterDrops113c(
        [bossMonster],
        dropTables,
        'normal',
        (_mon, items) => triggeredDrops.push(items),
      )
      expect(fired.length).toBe(0)
      expect(bossMonster.animMode).toBe('dt')
      expect(bossMonster.dropRolled).toBe(false)
    }

    const finalFired = Server.tickPendingMonsterDrops113c(
      [bossMonster],
      dropTables,
      'normal',
      (_mon, items) => triggeredDrops.push(items),
    )
    expect(finalFired.length).toBe(1)
    expect(triggeredDrops.length).toBe(1)
    expect(bossMonster.animMode).toBe('dd')
    expect(bossMonster.dropRolled).toBe(true)
    expect(bossMonster.pendingDrop).toBeUndefined()
  })

  // T5.A9: computeCharsiImbueIlvl, isEligibleForCharsiImbue113c, and imbueItemCharsi
  it('T5.A9: imbueItemCharsi rejects non-normal, socketed, or non-equipable items and upgrades eligible normal items to rare with ilvl = min(99, clvl + 4)', () => {
    expect(Server.computeCharsiImbueIlvl(4)).toBe(4) // clvl <= 5 keeps clvl
    expect(Server.computeCharsiImbueIlvl(25)).toBe(29) // clvl > 5 adds +4
    expect(Server.computeCharsiImbueIlvl(98)).toBe(99) // capped at 99
    expect(Server.computeCharsiImbueIlvl(-10)).toBe(1) // clamped to >= 1
    expect(Server.computeCharsiImbueIlvl(Number.NaN)).toBe(1) // non-finite fallback to 1

    // Rejection cases: magic quality, socketed normal item, non-weapon/non-armor item (ring)
    expect(
      Server.isEligibleForCharsiImbue113c({ code: 'cap', type: 'helm', quality: 'magic', sockets: 0, isArmor: true }),
    ).toBe(false)
    expect(
      Server.isEligibleForCharsiImbue113c({ code: 'cap', type: 'helm', quality: 'normal', sockets: 2, isArmor: true }),
    ).toBe(false)
    expect(
      Server.isEligibleForCharsiImbue113c({
        code: 'rin',
        type: 'ring',
        quality: 'normal',
        sockets: 0,
        isWeapon: false,
        isArmor: false,
      }),
    ).toBe(false)
    expect(() =>
      Server.imbueItemCharsi({ code: 'cap', type: 'helm', quality: 'magic', sockets: 0, isArmor: true }, 30, {
        seed: 0x12345678,
      }),
    ).toThrow(/not eligible for Charsi Imbue/i)

    // Valid normal armor imbue at clvl 70 -> rare quality, ilvl 74, rolled affixes
    const imbued = Server.imbueItemCharsi(
      { code: 'cap', type: 'helm', quality: 'normal', sockets: 0, isArmor: true },
      70,
      { seed: 0x13579bdf },
    )
    expect(imbued.quality).toBe('rare')
    expect(imbued.ilvl).toBe(74)
    expect(imbued.prefixes.length + imbued.suffixes.length).toBeGreaterThanOrEqual(1)
  })

  // T5.A10: GameInstance vendor buy with inventory+bank gold split, vendor sell, grid overlap rejection, and belt potion healing
  it('T5.A10: GameInstance splits NpcBuy cost across inventory and stash gold, credits floor(cost/4) on NpcSell, rejects grid collisions, and heals on BeltUse', () => {
    // Obtain a default belt potion item from a fresh player export so d2sBytes includes a belt healing potion alongside custom gold/goldBank/HP
    const seedGame = new Server.GameInstance({ policy: Server.SINGLE_PLAYER_POLICY, mapSeed: 0x5100 })
    const seedPid = seedGame.addPlayer({ charName: 'SeedPot', classId: 6, level: 20 })
    const defaultBeltItems = Server.readD2s(seedGame.exportPlayerD2s(seedPid)).items

    const d2sBytes = Server.writeD2s(
      createSampleD2sCharacterData({
        name: 'EconomyHero',
        charClass: 6,
        level: 20,
        items: defaultBeltItems,
        attributesOverrides: {
          gold: 400,
          goldBank: 2000,
          hitpointsFixed: 150 * FIXED_ONE,
          maxHpFixed: 200 * FIXED_ONE,
        },
      }),
    )

    const game = new Server.GameInstance({
      policy: Server.SINGLE_PLAYER_POLICY,
      mapSeed: 0x5110,
      areaId: 1,
    })
    const p1 = game.addPlayer({ charName: 'EconomyHero', classId: 6, level: 20, d2sBytes })
    const vendorId = game.spawnMonster({
      classId: 154,
      x: 120,
      y: 120,
      areaId: 1,
      isNpc: true,
      isVendor: true,
      isKillable: false,
      aiDisabled: true,
    })
    const [vendorItemA, vendorItemB] = giveVendorPool(game, vendorId, [1200, 200])

    // 1. NpcBuy costing 1200 gold drains 400 from player.gold and 800 from player.goldBank, then 200 more drains from goldBank -> 1000 left
    game.enqueueCommand(p1, { type: 'NpcBuy', npcId: vendorId, itemId: vendorItemA, cost: 1200 })
    game.enqueueCommand(p1, { type: 'NpcBuy', npcId: vendorId, itemId: vendorItemB, cost: 200 })
    game.stepFrame()

    const afterBuy = game.getPlayerState(p1)!
    expect(afterBuy.gold).toBe(0)
    expect(afterBuy.goldBank).toBe(1000)

    const invItems = afterBuy.items.filter((it) => it.location === 'inventory')
    expect(invItems.length).toBe(2)
    const capA = invItems[0]!
    const capB = invItems[1]!

    // 2. ItemMove grid collision: attempting to move capB onto capA's occupied 2x2 grid slot must be rejected
    const origBx = capB.x
    const origBy = capB.y
    game.enqueueCommand(p1, {
      type: 'ItemMove',
      itemId: capB.unitId,
      container: 'inventory',
      x: capA.x,
      y: capA.y,
    })
    game.stepFrame()
    const afterBlockedMove = game.getPlayerState(p1)!
    const movedCapB = afterBlockedMove.items.find((it) => it.unitId === capB.unitId)!
    expect(movedCapB.x).toBe(origBx)
    expect(movedCapB.y).toBe(origBy)

    // 3. NpcSell on capA removes capA and credits floor(cost / 4) gold
    const expectedSellGold = Math.max(1, Math.floor(capA.cost / 4))
    game.enqueueCommand(p1, { type: 'NpcSell', npcId: 1, itemId: capA.unitId })
    game.stepFrame()
    const afterSell = game.getPlayerState(p1)!
    expect(afterSell.gold).toBe(expectedSellGold)
    expect(afterSell.items.some((it) => it.unitId === capA.unitId)).toBe(false)

    // 4. BeltUse on a belt healing potion consumes the potion and restores +30 HP (150 -> 180)
    const beltPot = afterSell.items.find((it) => it.location === 'belt')!
    expect(afterSell.hp).toBe(150)
    game.enqueueCommand(p1, { type: 'BeltUse', itemId: beltPot.unitId })
    game.stepFrame()
    const afterBeltUse = game.getPlayerState(p1)!
    expect(afterBeltUse.hp).toBe(180)
    expect(afterBeltUse.items.some((it) => it.unitId === beltPot.unitId)).toBe(false)
  })

  // T5.A11: GameInstance interactive world objects: Shrine 75-frame buff lifecycle, Chest loot drop, and Waypoint object activation
  it('T5.A11: GameInstance OperateObject activates Shrine 75-frame buff with expiration, opens Chest once to drop loot, and unlocks Waypoint object', () => {
    const d2sBytes = Server.writeD2s(
      createSampleD2sCharacterData({
        name: 'ObjectHero',
        charClass: 0,
        level: 15,
      }),
    )
    const game = new Server.GameInstance({
      policy: Server.SINGLE_PLAYER_POLICY,
      mapSeed: 0x5111,
      areaId: 3,
    })
    const p1 = game.addPlayer({ charName: 'ObjectHero', classId: 0, level: 15, d2sBytes })
    const pState = game.getPlayerState(p1)!

    const shrineId = game.spawnObject({
      classId: 2,
      name: 'Refilling Shrine',
      x: pState.x + 1,
      y: pState.y,
      areaId: 3,
      isShrine: true,
      shrineType: 12,
    })
    const chestId = game.spawnObject({
      classId: 5,
      name: 'Treasure Chest',
      x: pState.x + 2,
      y: pState.y,
      areaId: 3,
    })
    const wpObjId = game.spawnObject({
      classId: 119,
      name: 'Cold Plains Waypoint',
      x: pState.x + 3,
      y: pState.y,
      areaId: 3,
      isWaypoint: true,
    })

    game.drainPlayerEvents(p1)

    // 1. Operate Shrine -> Shrines.txt Code 12 (Skill Shrine) applies State 134, expires after 2400 frames
    game.enqueueCommand(p1, { type: 'OperateObject', objectId: shrineId })
    game.stepFrame()
    const shrineStartEvents = game.drainPlayerEvents(p1)
    expect(shrineStartEvents.some((e) => e.type === 'StateSet' && e.state === 134)).toBe(true)
    expect(game.getPlayerState(p1)!.states.has(134)).toBe(true)

    game.stepFrames(2400)
    const shrineEndEvents = game.drainPlayerEvents(p1)
    expect(shrineEndEvents.some((e) => e.type === 'StateEnd' && e.state === 134)).toBe(true)
    expect(game.getPlayerState(p1)!.states.has(134)).toBe(false)

    // 2. Operate Chest -> opens chest (UnitMode unitType=2 mode=2); Objects.txt OperateFn 4 rolls the 1.13c
    //    'Act 1 Chest A' TreasureClassEx drop (#1326), one groundSpawn per dropped item; second interaction drops nothing
    game.enqueueCommand(p1, { type: 'OperateObject', objectId: chestId })
    game.stepFrame()
    const chestFirstEvents = game.drainPlayerEvents(p1)
    expect(
      chestFirstEvents.some(
        (e) => e.type === 'UnitMode' && e.unitType === 2 && e.id === chestId && e.mode === 2,
      ),
    ).toBe(true)
    const chestSpawns = chestFirstEvents.filter((e) => e.type === 'ItemEvent' && e.action === 'groundSpawn')
    expect(chestSpawns.length).toBe(game.getGroundItems().length)
    expect(game.getGroundItems().every((g) => g.rawItemData !== undefined)).toBe(true)

    game.enqueueCommand(p1, { type: 'OperateObject', objectId: chestId })
    game.stepFrame()
    const chestSecondEvents = game.drainPlayerEvents(p1)
    expect(chestSecondEvents.filter((e) => e.type === 'ItemEvent' && e.action === 'groundSpawn').length).toBe(0)

    // 3. Before touching Waypoint object, area 3 is not unlocked in waypoints; operating Waypoint object unlocks area 3
    expect(game.getPlayerState(p1)!.waypoints.has(3)).toBe(false)
    game.enqueueCommand(p1, { type: 'OperateObject', objectId: wpObjId })
    game.stepFrame()
    expect(game.getPlayerState(p1)!.waypoints.has(3)).toBe(true)
  })

  // T5.A12: d2s-writer & d2s-reader round-trip with Expansion corpseItems, merc items ("jf" + "JM"), and Iron Golem ("kf") with socketed children
  it('T5.A12: writeD2s and readD2s losslessly round-trip Expansion corpseItems, mercenary items, and Iron Golem with socketed child items', () => {
    // Obtain a canonical valid ItemData from GameInstance export, then construct corpse, merc, and socketed Iron Golem items
    const game = new Server.GameInstance({ policy: Server.SINGLE_PLAYER_POLICY, mapSeed: 0x5112 })
    const p1 = game.addPlayer({ charName: 'ItemSource', classId: 2, level: 30 })
    const baseExport = Server.readD2s(game.exportPlayerD2s(p1))
    const templatePot = baseExport.items[0]!

    const corpseHelm = {
      ...templatePot,
      code: 'cap',
      rawCode: 'cap ',
      location: 1,
      bodyLoc: 1,
      equippedSlot: 1,
      storePage: 0,
      storagePage: 0,
      x: 0,
      y: 0,
      gridX: 0,
      gridY: 0,
    }
    const mercArmor = {
      ...templatePot,
      code: 'lea',
      rawCode: 'lea ',
      location: 1,
      bodyLoc: 3,
      equippedSlot: 3,
      storePage: 0,
      storagePage: 0,
      x: 0,
      y: 0,
      gridX: 0,
      gridY: 0,
    }
    const socketedRune = {
      ...templatePot,
      code: 'r01',
      rawCode: 'r01 ',
      location: 6,
      inSocket: true,
      simple: true,
      compact: true,
    }
    const golemArmor = {
      ...templatePot,
      code: 'chn',
      rawCode: 'chn ',
      flags: 0x00000810, // ITEM_FLAG_IDENTIFIED | ITEM_FLAG_SOCKETED (non-compact)
      rawFlags: 0x00000810,
      simple: false,
      compact: false,
      quality: 2,
      ilvl: 40,
      durability: 30,
      curDurability: 30,
      maxDurability: 45,
      defense: 75,
      socketed: true,
      totalSockets: 1,
      usedSockets: 1,
      socketedChildCount: 1,
      stats: [],
      socketedItems: [socketedRune],
    }

    const saveWithTail = {
      ...createSampleD2sCharacterData({
        name: 'FullTailHero',
        charClass: 2,
        statusFlags: 0x20, // Expansion
        corpseItems: [corpseHelm],
        mercOverrides: {
          dead: false,
          seed: 0xdeadbeef,
          nameId: 3,
          typeId: 11,
          experience: 45000,
          items: [mercArmor],
        },
      }),
      ironGolem: golemArmor,
    }

    const encoded = Server.writeD2s(saveWithTail)
    const decoded = Server.readD2s(encoded)

    expect(decoded.corpseItems.length).toBe(1)
    expect(decoded.corpseItems[0]?.code.trim()).toBe('cap')

    expect(decoded.merc.seed).toBe(0xdeadbeef)
    expect(decoded.merc.items.length).toBe(1)
    expect(decoded.merc.items[0]?.code.trim()).toBe('lea')

    expect(decoded.ironGolem).not.toBeNull()
    expect(decoded.ironGolem?.code.trim()).toBe('chn')
    expect(decoded.ironGolem?.socketed).toBe(true)
    expect(decoded.ironGolem?.socketedItems?.length).toBe(1)
    expect(decoded.ironGolem?.socketedItems?.[0]?.code.trim()).toBe('r01')

    // Classic save (statusFlags: 0x00, isExpansion: false) omits "jf" and "kf" tail sections
    const classicEncoded = Server.writeD2s({
      ...createSampleD2sCharacterData({ name: 'ClassicHero', charClass: 4, statusFlags: 0x00 }),
      isExpansion: false,
    })
    const classicDecoded = Server.readD2s(classicEncoded)
    expect(classicDecoded.isExpansion).toBe(false)
    expect(classicDecoded.merc.items).toEqual([])
    expect(classicDecoded.ironGolem).toBeNull()
  })

  // T5.A13: readD2s structural corruption guards (fileSize, "Woo!", "WS", "gf", "if") & extractCharSummaryFromD2s
  it('T5.A13: readD2s rejects corrupted fileSize, "Woo!", "WS", "gf", and "if" section headers and extractCharSummaryFromD2s parses header metadata', () => {
    const validBytes = Server.writeD2s(
      createSampleD2sCharacterData({
        name: 'HeaderGuard',
        charClass: 4,
        level: 42,
        statusFlags: 0x20 | 0x04 | 0x08, // Expansion + Hardcore + Dead
        progression: 10,
      }),
    )

    // Summary extractor parses header fields directly and throws on truncated buffers
    const summary = extractCharSummaryFromD2s(validBytes)
    expect(summary.name).toBe('HeaderGuard')
    expect(summary.classId).toBe(4)
    expect(summary.level).toBe(42)
    expect(summary.expansion).toBe(true)
    expect(summary.hardcore).toBe(true)
    expect(summary.dead).toBe(true)
    expect(summary.progression).toBe(10)
    expect(() => extractCharSummaryFromD2s(validBytes.slice(0, 100))).toThrow()

    // Helper to recompute checksum at 0x0c after mutating a copy of validBytes
    const withChecksum = (mutator: (buf: Uint8Array) => void): Uint8Array => {
      const copy = new Uint8Array(validBytes)
      mutator(copy)
      const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength)
      view.setUint32(0x0c, 0, true)
      let sum = 0
      for (let i = 0; i < copy.byteLength; i += 1) {
        const msb = (sum >>> 31) & 1
        sum = (((sum << 1) >>> 0) + copy[i]! + msb) >>> 0
      }
      view.setUint32(0x0c, sum >>> 0, true)
      return copy
    }

    // 1. Corrupted fileSize at 0x08
    const badSize = withChecksum((buf) => {
      new DataView(buf.buffer, buf.byteOffset, buf.byteLength).setUint32(0x08, buf.byteLength + 16, true)
    })
    expect(() => Server.readD2s(badSize)).toThrow(/size mismatch/i)

    // 2. Corrupted "Woo!" quest header at 0x14f
    const badWoo = withChecksum((buf) => {
      buf[0x14f] = 0x58
    })
    expect(() => Server.readD2s(badWoo)).toThrow(/Woo!/i)

    // 3. Corrupted "WS" waypoint header at 0x279
    const badWs = withChecksum((buf) => {
      buf[0x279] = 0x58
    })
    expect(() => Server.readD2s(badWs)).toThrow(/WS/i)

    // 4. Corrupted "gf" stat header at 0x2fd
    const badGf = withChecksum((buf) => {
      buf[0x2fd] = 0x58
    })
    expect(() => Server.readD2s(badGf)).toThrow(/"gf"/i)

    // 5. Corrupted "if" skills header right before the 30-byte skills block
    const badIf = withChecksum((buf) => {
      for (let i = 0x300; i < buf.length - 32; i += 1) {
        if (buf[i] === 0x69 && buf[i + 1] === 0x66) {
          buf[i] = 0x58
          break
        }
      }
    })
    expect(() => Server.readD2s(badIf)).toThrow(/"if"/i)
  })

  // T5.A14: LockstepSession full multi-peer state machine (submit validation, waiting/stalls, stepped, recordRemoteHash desyncReport)
  it('T5.A14: LockstepSession validates peer input bounds, counts stalls while waiting, steps when all peers submit, and reports remote hash desyncs', () => {
    const game = new Server.GameInstance({
      policy: Server.OPEN_BNET_POLICY,
      mapSeed: 0x5114,
    })
    const p1 = game.addPlayer({ charName: 'LockPeerA', classId: 1 })
    const p2 = game.addPlayer({ charName: 'LockPeerB', classId: 2 })
    const peerIds = [p1, p2]

    const session = new Server.LockstepSession(
      {
        peers: 2,
        inputDelayTicks: 0,
        maxFutureTicks: 4,
      },
      {
        advance: (inputs) => {
          inputs.forEach((input, idx) => {
            const pid = peerIds[idx]!
            if (input.movement.x !== 0 || input.movement.y !== 0) {
              const snap = game.getPlayerState(pid)!
              game.enqueueCommand(pid, {
                type: 'Move',
                x: snap.x + input.movement.x * 2,
                y: snap.y + input.movement.y * 2,
                run: true,
              })
            }
          })
          game.stepFrame()
        },
        hash: () => game.getStateHash(),
      },
    )

    // 1. Input validation rejections: unknown peer, past/too-far-future tick, non-normalized move, duplicate submission
    expect(
      session.submit(99, { tick: 0, movement: { x: 0, y: 0 }, attack: false, pickup: false }),
    ).toBe(false)
    expect(
      session.submit(0, { tick: 5, movement: { x: 0, y: 0 }, attack: false, pickup: false }),
    ).toBe(false)
    expect(
      session.submit(0, { tick: 0, movement: { x: 2, y: 0 }, attack: false, pickup: false }),
    ).toBe(false)

    expect(
      session.submit(0, { tick: 0, movement: { x: 1, y: 0 }, attack: false, pickup: false }),
    ).toBe(true)
    expect(
      session.submit(0, { tick: 0, movement: { x: 0, y: 0 }, attack: false, pickup: false }),
    ).toBe(false)

    // 2. Step while peer 1 has not submitted for tick 0 -> waiting + stalls incremented
    const waitOutcome = session.step()
    expect(waitOutcome).toEqual({ kind: 'waiting', tick: 0, missing: [1] })
    expect(session.stalls).toBe(1)
    expect(session.tick).toBe(0)

    // 3. Peer 1 submits for tick 0 -> step advances tick to 1 and resets stalls to 0
    expect(
      session.submit(1, { tick: 0, movement: { x: 0, y: 1 }, attack: false, pickup: false }),
    ).toBe(true)
    const step0 = session.step()
    expect(step0.kind).toBe('stepped')
    expect(session.stalls).toBe(0)
    expect(session.tick).toBe(1)

    // 4. Both peers submit for tick 1, but peer 1 reports a divergent remote hash -> desync outcome & desyncReport
    expect(
      session.submit(0, { tick: 1, movement: { x: 0, y: 0 }, attack: false, pickup: false }),
    ).toBe(true)
    expect(
      session.submit(1, { tick: 1, movement: { x: 0, y: 0 }, attack: false, pickup: false }),
    ).toBe(true)
    expect(session.recordRemoteHash(1, 1, 0xdeadbeef)).toBe(true)

    const step1 = session.step()
    expect(step1.kind).toBe('desync')
    if (step1.kind === 'desync') {
      expect(step1.tick).toBe(1)
      expect(step1.remote).toBe(0xdeadbeef)
      expect(step1.local).not.toBe(0xdeadbeef)
    }
    expect(session.desyncReport?.tick).toBe(1)
    expect(session.desyncReport?.remote).toBe(0xdeadbeef)
  })

  // T5.A15: computeLockstepHash order-independent ground-item & quest hashing + castSkill 7-arg castSkillDef outcomes
  it('T5.A15: computeLockstepHash is invariant to ground-item and quest array permutation while castSkill 7-arg overload enforces cooldown, mana, and zero-distance instant fallback', () => {
    const itemA = {
      x: 10,
      y: 20,
      item: {
        name: 'Cap',
        stack: 1,
        value: 50,
        quality: 'magic',
        dwInitSeed: 0x1111,
      },
    }
    const itemB = {
      x: 30,
      y: 40,
      item: {
        name: 'Minor Healing Potion',
        stack: 1,
        value: 15,
        quality: 'normal',
        dwInitSeed: 0x2222,
      },
    }
    const questA = { def: { id: 'q1' }, status: 'active' as const, kills: 3 }
    const questB = { def: { id: 'q2' }, status: 'complete' as const, kills: 1 }

    const baseWorld = {
      tick: 10,
      kills: 2,
      players: [{ x: 50, y: 60, hp: 100, xp: 5000, level: 12, alive: true }],
      monsters: [],
    }

    // Order-independent sum folding must yield identical hash under ground-item & quest permutation,
    // but produce a distinct hash when an item's dwInitSeed or quest kills count mutates
    const hashOriginalOrder = Server.computeLockstepHash(baseWorld, [], [itemA, itemB], [questA, questB])
    const hashPermutedOrder = Server.computeLockstepHash(baseWorld, [], [itemB, itemA], [questB, questA])
    const hashMutatedSeed = Server.computeLockstepHash(
      baseWorld,
      [],
      [itemA, { ...itemB, item: { ...itemB.item, dwInitSeed: 0x2223 } }],
      [questA, questB],
    )
    expect(hashOriginalOrder).toBe(hashPermutedOrder)
    expect(hashOriginalOrder).not.toBe(hashMutatedSeed)

    // Verify castSkill 7-arg (castSkillDef) branches: cooldown, insufficient mana, zero-distance instant fallback, and projectile launch
    const projSkill: Server.SkillDef = {
      id: 'firebolt',
      name: 'Fire Bolt',
      baseMinDamage: 8,
      baseMaxDamage: 16,
      damagePerLevel: 4,
      manaCost: 7,
      cooldownTicks: 10,
      projectile: true,
      speed: 125,
      range: 250,
      radius: 4,
    }
    const caster = { id: 1, x: 100, y: 100, facing: 0, team: 'player' as const }
    const rng = new D2Rng(42)

    // 1. Cooldown active (> 0)
    expect(Server.castSkill(projSkill, caster, 3, rng, 2, 100, { x: 150, y: 100 }).kind).toBe('cooldown')
    // 2. Insufficient mana (manaCost 7 > currentMana 4)
    expect(Server.castSkill(projSkill, caster, 3, rng, 0, 4, { x: 150, y: 100 }).kind).toBe('mana')
    // 3. Zero-distance aim (aim == caster position) falls back to 'instant' even on a projectile skill
    const zeroAim = Server.castSkill(projSkill, caster, 3, rng, 0, 50, { x: 100, y: 100 })
    expect(zeroAim.kind).toBe('instant')
    // 4. Displaced aim spawns a projectile with velocity = (speed / 25, 0) = (5, 0)
    const projOut = Server.castSkill(projSkill, caster, 3, rng, 0, 50, { x: 150, y: 100 })
    expect(projOut.kind).toBe('projectile')
    if (projOut.kind === 'projectile') {
      expect(projOut.projectile.vx).toBeCloseTo(5, 5)
      expect(projOut.projectile.vy).toBeCloseTo(0, 5)
    }
  })
})

describe('Tier 5 Part B — White-Box Adversarial Tests (F7–F12)', () => {
  const registry = getSharedDataRegistry()

  it('T5.B1: F7 TsFramer preserves deeply nested TypedArray subarray views across partial 4-byte header splits, ignores spoofed __d2TypedArray envelopes, and rejects 0-length / >1MB frames', () => {
    const backingU8 = new Uint8Array([0xaa, 0xbb, 0x11, 0x22, 0x33, 0xff])
    const subU8 = backingU8.subarray(2, 5) // [0x11, 0x22, 0x33] with byteOffset=2
    const backingU16 = new Uint16Array([0x9999, 0x1234, 0x5678, 0xabcd, 0xeeee])
    const subU16 = backingU16.subarray(1, 4) // [0x1234, 0x5678, 0xabcd] with byteOffset=2

    const payload = {
      type: 'ComplexNestedFrame',
      nested: [
        { tag: 'sliceU8', bytes: subU8 },
        { tag: 'sliceU16', words: subU16 },
      ],
      spoofedEnvelopeNonArray: { __d2TypedArray: 'u8', data: 'not-an-array' },
      spoofedEnvelopeUnknownKind: { __d2TypedArray: 'f64', data: [1, 2, 3] },
    }

    const frame1 = Netproto.encodeTsFrame(payload)
    const frame2 = Netproto.encodeTsFrame({ type: 'SecondFrame', seq: 2 })
    const combined = new Uint8Array(frame1.byteLength + frame2.byteLength)
    combined.set(frame1, 0)
    combined.set(frame2, frame1.byteLength)

    const framer = new Netproto.TsFramer<{ type: string; [k: string]: unknown }>()
    expect(framer.bufferedBytes).toBe(0)

    // Empty chunk is a no-op
    expect(framer.push(new Uint8Array(0))).toEqual([])
    expect(framer.bufferedBytes).toBe(0)

    // Push only 2 bytes of the 4-byte length header
    expect(framer.push(combined.subarray(0, 2))).toEqual([])
    expect(framer.bufferedBytes).toBe(2)

    // Push remaining 2 bytes of header + 3 payload bytes
    expect(framer.push(combined.subarray(2, 7))).toEqual([])
    expect(framer.bufferedBytes).toBe(7)

    // Push rest of frame1 + first 3 bytes of frame2 header
    const splitAt = frame1.byteLength + 3
    const out1 = framer.push(combined.subarray(7, splitAt))
    expect(out1).toHaveLength(1)
    expect(framer.bufferedBytes).toBe(3)

    const decoded1 = out1[0]! as typeof payload
    expect(decoded1.type).toBe('ComplexNestedFrame')
    expect(decoded1.nested[0]!.bytes).toBeInstanceOf(Uint8Array)
    expect(Array.from(decoded1.nested[0]!.bytes!)).toEqual([0x11, 0x22, 0x33])
    expect(decoded1.nested[1]!.words).toBeInstanceOf(Uint16Array)
    expect(Array.from(decoded1.nested[1]!.words!)).toEqual([0x1234, 0x5678, 0xabcd])
    expect(decoded1.spoofedEnvelopeNonArray).toEqual({ __d2TypedArray: 'u8', data: 'not-an-array' })
    expect(decoded1.spoofedEnvelopeUnknownKind).toEqual({ __d2TypedArray: 'f64', data: [1, 2, 3] })

    // Push remainder of frame2 via feed() alias
    const out2 = framer.feed(combined.subarray(splitAt))
    expect(out2).toHaveLength(1)
    expect(out2[0]!.type).toBe('SecondFrame')
    expect(framer.bufferedBytes).toBe(0)

    // 0-length frame header and >1MB frame header must throw ProtocolError
    const zeroLenFramer = new Netproto.TsFramer()
    expect(() => zeroLenFramer.push(new Uint8Array([0, 0, 0, 0]))).toThrow(Netproto.ProtocolError)
    const hugeLenFramer = new Netproto.TsFramer()
    expect(() => hugeLenFramer.push(new Uint8Array([1, 0, 0x20, 0]))).toThrow(Netproto.ProtocolError)
  })

  it('T5.B2: F7 D2gsC2sFramer frames variable-length opcodes (0x14, 0x15, 0x39 dual-size, 0x66, 0x6C), compacts/grows its ring buffer past 4096 bytes, and throws ProtocolError on invalid opcodes', () => {
    const framer = new Netproto.D2gsC2sFramer()

    // 1. 0x14 OverheadChat: [0x14, 0x00, 0x00, ...msg\0, 0x00, 0x00]
    const overheadPkt = Netproto.encodeC2sOverheadChat('Taunt!')
    expect(overheadPkt[0]).toBe(0x14)
    expect(Netproto.validateC2sPacket(overheadPkt).valid).toBe(true)

    // 2. 0x15 Chat with message + target null-terminated strings
    const chatPkt = Netproto.encodeC2sChat('Hello world', 'Deckard')
    expect(chatPkt[0]).toBe(0x15)
    expect(Netproto.validateC2sPacket(chatPkt).valid).toBe(true)

    // 3. 0x66 Warden response: [0x66, lenLE_lo, lenLE_hi, ...payload]
    const wardenPayload = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    const wardenPkt = new Uint8Array(3 + wardenPayload.byteLength)
    wardenPkt[0] = 0x66
    wardenPkt[1] = wardenPayload.byteLength & 0xff
    wardenPkt[2] = (wardenPayload.byteLength >> 8) & 0xff
    wardenPkt.set(wardenPayload, 3)
    expect(Netproto.resolveC2sPacketSize(wardenPkt, 0)).toBe(7)

    // 4. 0x6C SaveChunk: [0x6C, sizeByte, ...chunk] -> total size = sizeByte + 6
    const saveChunkPkt = new Uint8Array(10 + 6)
    saveChunkPkt[0] = 0x6c
    saveChunkPkt[1] = 10
    expect(Netproto.resolveC2sPacketSize(saveChunkPkt, 0)).toBe(16)

    // 5. 0x39 dual-length packet: 5 bytes when standalone (remaining < 9), 9 bytes in a stream when remaining >= 9
    const pkt39Five = new Uint8Array([0x39, 0x01, 0x02, 0x03, 0x04])
    expect(Netproto.resolveC2sPacketSize(pkt39Five, 0)).toBe(5)
    expect(framer.push(pkt39Five)).toEqual([pkt39Five])
    expect(framer.bufferedBytes).toBe(0)

    const pkt39Nine = new Uint8Array([0x39, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])
    expect(Netproto.resolveC2sPacketSize(pkt39Nine, 0)).toBe(9)

    // Feed partial chunks & force ring-buffer growth beyond initial 4096-byte capacity
    const runPkt = new Uint8Array(
      Netproto.encodeC2sMove(true, { x: Netproto.asSubTile(5120), y: Netproto.asSubTile(5140) }),
    )
    expect(runPkt.byteLength).toBe(5)
    const manyPackets: Uint8Array[] = [
      new Uint8Array(overheadPkt),
      new Uint8Array(chatPkt),
      wardenPkt,
      saveChunkPkt,
      pkt39Nine,
    ]
    for (let i = 0; i < 900; i++) {
      manyPackets.push(runPkt)
    }
    const totalLen = manyPackets.reduce((acc, p) => acc + p.byteLength, 0)
    expect(totalLen).toBeGreaterThan(4500)

    const streamBuf = new Uint8Array(totalLen)
    let cursor = 0
    for (const p of manyPackets) {
      streamBuf.set(p, cursor)
      cursor += p.byteLength
    }

    const decoded: Uint8Array[] = []
    for (let offset = 0; offset < streamBuf.byteLength; offset += 137) {
      const slice = streamBuf.subarray(offset, Math.min(offset + 137, streamBuf.byteLength))
      for (const pkt of framer.push(slice)) {
        decoded.push(new Uint8Array(pkt))
      }
    }
    expect(decoded).toHaveLength(manyPackets.length)
    expect(decoded[0]).toEqual(new Uint8Array(overheadPkt))
    expect(decoded[1]).toEqual(new Uint8Array(chatPkt))
    expect(decoded[2]).toEqual(wardenPkt)
    expect(decoded[3]).toEqual(saveChunkPkt)
    expect(decoded[4]).toEqual(pkt39Nine)
    expect(framer.bufferedBytes).toBe(0)

    // Verify ProtocolError on unused/invalid C2S opcodes (0x00 and 0xFE)
    expect(() => framer.push(new Uint8Array([0x00]))).toThrow(Netproto.ProtocolError)
    framer.reset()
    expect(() => framer.push(new Uint8Array([0xfe, 0x01, 0x02]))).toThrow(Netproto.ProtocolError)
  })

  it('T5.B3: F7 D2gsS2cFramer transitions from uncompressed [0xAF, 0x01] handshake to Fog.10222 Huffman-compressed blocks and splits multi-packet S2C payloads', () => {
    const s2cFramer = new Netproto.D2gsS2cFramer()
    expect(s2cFramer.isCompressedMode).toBe(false)

    const greeting = new Uint8Array([0xaf, 0x01])
    const logonAck = new Uint8Array([0x04]) // 1-byte S2C 0x04 LoadDone / GameLogonAck
    const loadAct = Netproto.serverEventToS2cPackets({
      type: 'LoadAct',
      act: 0,
      mapSeed: 0x12345678,
      areaId: 1,
    })[0]!
    expect(loadAct.byteLength).toBe(12)

    const combinedDecompressed = new Uint8Array(logonAck.byteLength + loadAct.byteLength)
    combinedDecompressed.set(logonAck, 0)
    combinedDecompressed.set(loadAct, logonAck.byteLength)

    // Verify splitDecompressedBlock splits concatenated S2C packets into D2gsFramedS2cPacket entries
    const splitPkts = s2cFramer.splitDecompressedBlock(combinedDecompressed)
    expect(splitPkts).toHaveLength(2)
    expect(splitPkts[0]!.packetId).toBe(0x04)
    expect(splitPkts[0]!.bytes).toEqual(logonAck)
    expect(splitPkts[0]!.isSystemPacket).toBe(false)
    expect(splitPkts[1]!.packetId).toBe(0x03)
    expect(splitPkts[1]!.bytes).toEqual(loadAct)

    // Compress the combined S2C payload with Fog.10222 Huffman codec and wrap with D2GS block header
    const compressedPayload = defaultD2gsHuffmanCodec.compress(combinedDecompressed)
    const compressedBlock = wrapD2gsCompressedBlock(compressedPayload)
    const wire = new Uint8Array(greeting.byteLength + compressedBlock.byteLength)
    wire.set(greeting, 0)
    wire.set(compressedBlock, greeting.byteLength)

    // Push first 1 byte of greeting
    expect(s2cFramer.push(wire.subarray(0, 1))).toEqual([])
    expect(s2cFramer.isCompressedMode).toBe(false)
    expect(s2cFramer.bufferedTcpBytes).toBe(1)

    // Push rest of greeting + first 2 bytes of compressed block
    const mid = s2cFramer.push(wire.subarray(1, 4))
    expect(mid).toHaveLength(1)
    expect(mid[0]!.packetId).toBe(0xaf)
    expect(mid[0]!.bytes).toEqual(greeting)
    expect(mid[0]!.isSystemPacket).toBe(true)
    expect(s2cFramer.isCompressedMode).toBe(true)

    // Push remaining bytes of compressed block
    const tail = s2cFramer.push(wire.subarray(4))
    expect(tail).toHaveLength(2)
    expect(tail[0]!.bytes).toEqual(logonAck)
    expect(tail[1]!.bytes).toEqual(loadAct)
    expect(s2cFramer.bufferedTcpBytes).toBe(0)
    expect(s2cFramer.bufferedPacketBytes).toBe(0)

    // Verify reset() restores uncompressed mode and invalid S2C opcode >= 0xB5 throws ProtocolError
    s2cFramer.reset()
    expect(s2cFramer.isCompressedMode).toBe(false)
    expect(() => s2cFramer.push(new Uint8Array([0xff, 0x00]))).toThrow(Netproto.ProtocolError)
  })

  it('T5.B4: F7 registerLocalServerFactory and registerLocalLobbyProvider handle null unregistration, lazy factory-function resolution, and default hook restoration', () => {
    try {
      Netproto.registerLocalServerFactory(null)
      Netproto.registerLocalLobbyProvider(null)
      expect(Netproto.getLocalServerFactory()).toBeNull()
      expect(Netproto.getLocalLobbyProvider()).toBeNull()

      expect(() => Netproto.createLocalServerSession({ charName: 'NoFactoryHero' })).toThrow(
        /No LocalServerFactory registered/,
      )

      let factoryCallCount = 0
      const customProvider = new Server.LocalLobbyProvider({ registry })
      Netproto.registerLocalLobbyProvider(() => {
        factoryCallCount += 1
        return customProvider
      })
      expect(Netproto.getLocalLobbyProvider()).toBe(customProvider)
      expect(Netproto.getLocalLobbyProvider()).toBe(customProvider)
      expect(factoryCallCount).toBe(2)

      Netproto.registerLocalLobbyProvider(customProvider)
      expect(Netproto.getLocalLobbyProvider()).toBe(customProvider)
    } finally {
      Server.registerDefaultLocalServerHooks()
      expect(Netproto.getLocalServerFactory()).not.toBeNull()
      expect(Netproto.getLocalLobbyProvider()).not.toBeNull()
    }
  })

  it('T5.B5: F8 LocalLobbyProvider encodes classic/hardcore/ladder statusFlags bits in .d2s, rejects trimmed case-insensitive duplicates, and supports selectCharacter -> parameterless enterGame()', async () => {
    const lobby = new Server.LocalLobbyProvider({ registry })

    const hcSummary = await lobby.createCharacter({
      name: '  HardcoreKing  ',
      classId: 4, // Barbarian
      hardcore: true,
      expansion: false,
      ladder: true,
    })
    expect(hcSummary.name).toBe('HardcoreKing')
    expect(hcSummary.hardcore).toBe(true)
    expect(hcSummary.expansion).toBe(false)
    expect(hcSummary.ladder).toBe(true)

    const hcD2sBytes = lobby.getCharacterD2s('hardcoreking')
    expect(hcD2sBytes).toBeDefined()
    const parsedHc = Server.readD2sSave113c(hcD2sBytes!)
    // Classic (0x00) | Hardcore (0x04) | Ladder (0x40) = 0x44
    expect(parsedHc.statusFlags).toBe(0x44)

    await expect(lobby.createCharacter({ name: 'HARDCOREKING', classId: 1 })).rejects.toThrow(
      /already exists/,
    )
    await expect(lobby.createCharacter({ name: '   ', classId: 1 })).rejects.toThrow(
      /must not be empty/,
    )

    await lobby.selectCharacter('HARDCOREKING')
    const adapter = await lobby.enterGame()
    const rec = recordAdapterEvents(adapter)
    adapter.connect()
    expect(rec.events.some((e) => e.type === 'GameLogonAck')).toBe(true)
    adapter.close()

    expect(await lobby.deleteCharacter('hardcoreking')).toBe(true)
    await expect(lobby.enterGame()).rejects.toThrow(/no character specified or selected/)
  })

  it('T5.B6: F8 LocalLoopbackAdapter buffers early handshake events until connect(), clamps tick(dtMs) catch-up to MAX_CATCHUP_FRAMES=5, and auto-saves + closes on LeaveGame command', () => {
    const savedSnapshots: Uint8Array[] = []
    const adapter = new Server.LocalLoopbackAdapter({
      charName: 'LoopbackEdge',
      classId: 1,
      level: 18,
      registry,
      onAutoSave: (d2sBytes) => {
        savedSnapshots.push(d2sBytes)
      },
    })

    expect(adapter.gameInstance.tickCount).toBe(0)
    const lateEvents: Netproto.ServerEvent[] = []
    adapter.onEvent((ev) => lateEvents.push(ev))
    expect(lateEvents).toHaveLength(0)
    adapter.connect()
    expect(lateEvents.some((e) => e.type === 'GameLogonAck')).toBe(true)
    expect(lateEvents.some((e) => e.type === 'PlayerAssign')).toBe(true)

    // tick(1000ms) = 25 frames worth of dt, must clamp to MAX_CATCHUP_FRAMES = 5 frames (200ms)
    expect(adapter.tick(1000)).toBe(5)
    expect(adapter.gameInstance.tickCount).toBe(5)

    // Partial sub-frame dt accumulation: 15ms + 25ms = 40ms -> 1 frame
    expect(adapter.tick(15)).toBe(0)
    expect(adapter.tick(25)).toBe(1)
    expect(adapter.gameInstance.tickCount).toBe(6)

    // Sending { type: 'LeaveGame' } via send() must trigger onAutoSave, close adapter, and notify onClose
    const closeReasons: Netproto.CloseReason[] = []
    adapter.onClose((r) => closeReasons.push(r))
    adapter.send({ type: 'LeaveGame' })

    expect(adapter.state).toBe('closed')
    expect(savedSnapshots).toHaveLength(1)
    expect(Server.readD2sSave113c(savedSnapshots[0]!).name).toBe('LoopbackEdge')
    expect(closeReasons).toHaveLength(1)
    expect(closeReasons[0]!.kind).toBe('local')

    adapter.stepFrames(3)
    expect(adapter.gameInstance.tickCount).toBe(6)
  })

  it('T5.B7: F9 MultiClientRoomHost supports concurrent mixed-protocol clients (ts + auto-detected binary d2gs on [0x6B]) with bidirectional movement and chat broadcast', () => {
    const room = new Server.MultiClientRoomHost({
      registry,
      mapSeed: 0x2468ace0,
      act: 0,
      difficulty: 0,
    })

    // Client A connects using TsServerAdapter ('ts' protocol)
    const [clientStreamA, serverStreamA] = Netproto.createMemoryStreamPair()
    const sessionA = room.attachClient(serverStreamA, {
      charName: 'TsHeroA',
      classId: 1,
      protocol: 'ts',
    })
    const tsAdapterA = new Netproto.TsServerAdapter(clientStreamA)
    const eventsA: Netproto.ServerEvent[] = []
    tsAdapterA.onEvent((ev) => eventsA.push(ev))

    // Client B attaches without explicit protocol; constructing D2gsServerAdapter sends [0x6B] which auto-detects 'd2gs'
    const [clientStreamB, serverStreamB] = Netproto.createMemoryStreamPair()
    const sessionB = room.attachClient(serverStreamB, {
      charName: 'D2gsHeroB',
      classId: 4,
    })
    const d2gsAdapterB = new Netproto.D2gsServerAdapter(clientStreamB)
    const eventsB: Netproto.ServerEvent[] = []
    d2gsAdapterB.onEvent((ev) => eventsB.push(ev))

    expect(sessionA.protocol).toBe('ts')
    expect(sessionB.protocol).toBe('d2gs')
    expect(room.clientCount).toBe(2)

    // Step 1 frame to flush initial handshake events to both clients
    room.stepFrame()
    expect(eventsA.some((e) => e.type === 'GameLogonAck')).toBe(true)
    expect(eventsB.some((e) => e.type === 'LoadComplete' || e.type === 'LoadAct')).toBe(true)

    // Client B (binary D2GS) sends a Move command; Client A (TS) receives B's UnitMove, while B itself
    // does not (1.13c D2Game skips the moving player's own client, issue #1329)
    eventsA.length = 0
    eventsB.length = 0
    const spawnB = room.gameInstance.getPlayerState(sessionB.playerUnitId)!
    d2gsAdapterB.send({
      type: 'Move',
      x: Netproto.asSubTile(spawnB.x + 8),
      y: Netproto.asSubTile(spawnB.y + 6),
      run: true,
    })
    room.stepFrame()

    expect(
      eventsA.some(
        (e) =>
          e.type === 'UnitMove' &&
          ((e as { id?: number; unitId?: number }).id === sessionB.playerUnitId ||
            (e as { id?: number; unitId?: number }).unitId === sessionB.playerUnitId),
      ),
    ).toBe(true)
    expect(
      eventsB.some(
        (e) =>
          e.type === 'UnitMove' &&
          ((e as { id?: number; unitId?: number }).id === sessionB.playerUnitId ||
            (e as { id?: number; unitId?: number }).unitId === sessionB.playerUnitId),
      ),
    ).toBe(false)

    // Client A (TS) sends a Chat command; Client B (binary D2GS) decodes 0x26 ChatMessage
    eventsB.length = 0
    tsAdapterA.send({ type: 'Chat', text: 'CrossProtocolHello' } as unknown as Netproto.ClientCommand)
    room.stepFrame()
    expect(
      eventsB.some(
        (e) =>
          ((e.type as string) === 'ChatMessage' || e.type === 'Chat') &&
          String((e as { text?: string }).text).includes('CrossProtocolHello'),
      ),
    ).toBe(true)

    room.close()
  })

  it('T5.B8: F9 MultiClientRoomHost + AoiFilter synthesizes UnitRemove when a same-area peer moves outside aoiRadius and synthesizes UnitAssign upon re-entry', () => {
    const room = new Server.MultiClientRoomHost({
      registry,
      mapSeed: 0x11223344,
      act: 0,
      difficulty: 0,
      aoiRadius: 20,
    })

    const [clientStream1, serverStream1] = Netproto.createMemoryStreamPair()
    const [clientStream2, serverStream2] = Netproto.createMemoryStreamPair()
    const s1 = room.attachClient(serverStream1, { charName: 'AoiObserver', classId: 1, protocol: 'ts' })
    const s2 = room.attachClient(serverStream2, { charName: 'AoiRunner', classId: 2, protocol: 'ts' })
    const adapter1 = new Netproto.TsServerAdapter(clientStream1)
    const adapter2 = new Netproto.TsServerAdapter(clientStream2)

    const events1: Netproto.ServerEvent[] = []
    adapter1.onEvent((ev) => events1.push(ev))

    room.stepFrame()
    expect(room.aoiFilter.isVisible(s1.playerUnitId, 'player', s2.playerUnitId)).toBe(true)

    const origin = {
      x: room.gameInstance.getPlayerState(s1.playerUnitId)!.x,
      y: room.gameInstance.getPlayerState(s1.playerUnitId)!.y,
    }
    events1.length = 0

    // Move s2 35 subtiles away in the SAME area (distance > aoiRadius 20)
    adapter2.send({
      type: 'Move',
      x: Netproto.asSubTile(origin.x + 35),
      y: Netproto.asSubTile(origin.y),
      run: true,
    })
    // 1.13c run = 13.5 sub-tiles/s (0.54 per 25Hz tick, issue #1329): ~70 ticks for 35+ sub-tiles.
    room.stepFrames(90)

    expect(room.aoiFilter.isVisible(s1.playerUnitId, 'player', s2.playerUnitId)).toBe(false)
    expect(
      events1.some(
        (e) =>
          (e.type === 'UnitRemove' || (e.type as string) === 'EntityRemove') &&
          ((e as { id?: number; unitId?: number }).id === s2.playerUnitId ||
            (e as { id?: number; unitId?: number }).unitId === s2.playerUnitId),
      ),
    ).toBe(true)

    // Move s2 back to origin (within aoiRadius <= 20): s1 must receive a synthesized UnitAssign
    events1.length = 0
    adapter2.send({
      type: 'Move',
      x: Netproto.asSubTile(origin.x),
      y: Netproto.asSubTile(origin.y),
      run: true,
    })
    room.stepFrames(90)

    expect(room.aoiFilter.isVisible(s1.playerUnitId, 'player', s2.playerUnitId)).toBe(true)
    expect(
      events1.some(
        (e) =>
          (e.type === 'UnitAssign' || e.type === 'PlayerAssign') &&
          ((e as { unit?: { id?: number }; unitId?: number; id?: number }).unit?.id === s2.playerUnitId ||
            (e as { unitId?: number }).unitId === s2.playerUnitId ||
            (e as { id?: number }).id === s2.playerUnitId),
      ),
    ).toBe(true)

    room.close()
  })

  it('T5.B9: F9 PartyManager & MultiClientRoomHost handle invite (0x06), accept (0x08), level-weighted same-area splitExperience, and setHostile breaking party alliance', () => {
    const room = new Server.MultiClientRoomHost({
      registry,
      mapSeed: 0x55667788,
      act: 0,
      difficulty: 0,
    })

    const [c1, s1Stream] = Netproto.createMemoryStreamPair()
    const [c2, s2Stream] = Netproto.createMemoryStreamPair()
    const [c3, s3Stream] = Netproto.createMemoryStreamPair()
    const p1 = room.attachClient(s1Stream, { charName: 'LeaderP1', classId: 1, level: 20, protocol: 'ts' })
    const p2 = room.attachClient(s2Stream, { charName: 'MemberP2', classId: 4, level: 60, protocol: 'ts' })
    const p3 = room.attachClient(s3Stream, { charName: 'SoloP3', classId: 2, level: 40, protocol: 'ts' })
    const a1 = new Netproto.TsServerAdapter(c1)
    const a2 = new Netproto.TsServerAdapter(c2)
    const _a3 = new Netproto.TsServerAdapter(c3)

    a1.send({ type: 'PartyAction', action: 0x06, targetPlayerId: p2.playerUnitId } as unknown as Netproto.ClientCommand)
    room.stepFrame()
    expect(room.partyManager.getPendingInvitesFor(p2.playerUnitId)).toEqual([p1.playerUnitId])

    a2.send({ type: 'PartyAction', action: 0x08, targetPlayerId: p1.playerUnitId } as unknown as Netproto.ClientCommand)
    room.stepFrame()
    expect(room.partyManager.areAllied(p1.playerUnitId, p2.playerUnitId)).toBe(true)
    expect(room.partyManager.areAllied(p1.playerUnitId, p3.playerUnitId)).toBe(false)

    const candidatesSameArea = [
      { unitId: p1.playerUnitId, areaId: 1, level: 20 },
      { unitId: p2.playerUnitId, areaId: 1, level: 60 },
      { unitId: p3.playerUnitId, areaId: 1, level: 40 },
    ]
    const shares = room.partyManager.splitExperience(p1.playerUnitId, 1000, candidatesSameArea)
    expect(shares.size).toBe(2)
    expect(shares.get(p1.playerUnitId)).toBe(250)
    expect(shares.get(p2.playerUnitId)).toBe(750)
    expect(shares.has(p3.playerUnitId)).toBe(false)

    const candidatesDiffArea = [
      { unitId: p1.playerUnitId, areaId: 1, level: 20 },
      { unitId: p2.playerUnitId, areaId: 2, level: 60 },
    ]
    const soloShares = room.partyManager.splitExperience(p1.playerUnitId, 1000, candidatesDiffArea)
    expect(soloShares.size).toBe(1)
    expect(soloShares.get(p1.playerUnitId)).toBe(1000)

    expect(room.partyManager.canDamagePlayer(p1.playerUnitId, p2.playerUnitId)).toBe(false)
    room.partyManager.setHostile(p1.playerUnitId, p2.playerUnitId, true)
    expect(room.partyManager.areAllied(p1.playerUnitId, p2.playerUnitId)).toBe(false)
    expect(room.partyManager.areHostile(p1.playerUnitId, p2.playerUnitId)).toBe(true)
    expect(room.partyManager.canDamagePlayer(p1.playerUnitId, p2.playerUnitId)).toBe(true)

    room.close()
  })

  it('T5.B10: F9 RoomClientSession isolates malformed/invalid C2S opcode faults: increments protocolErrors, closes offending stream with kind=error, saves .d2s, and leaves peer unaffected', () => {
    const savedOnDisconnect: Array<{ name: string; bytes: Uint8Array; playerUnitId: number }> = []
    const room = new Server.MultiClientRoomHost({
      registry,
      mapSeed: 0x99aabbcc,
      onPlayerSave: (name, bytes, playerUnitId) => {
        savedOnDisconnect.push({ name, bytes, playerUnitId })
      },
    })

    const [badClientStream, badServerStream] = Netproto.createMemoryStreamPair()
    const [goodClientStream, goodServerStream] = Netproto.createMemoryStreamPair()

    const badSession = room.attachClient(badServerStream, {
      charName: 'MalformedPeer',
      classId: 0,
      protocol: 'd2gs',
    })
    const goodSession = room.attachClient(goodServerStream, {
      charName: 'HealthyPeer',
      classId: 1,
      protocol: 'ts',
    })
    const goodAdapter = new Netproto.TsServerAdapter(goodClientStream)
    expect(room.clientCount).toBe(2)

    const badCloseReasons: Netproto.CloseReason[] = []
    badClientStream.onClose((r) => badCloseReasons.push(r))

    badClientStream.write(new Uint8Array([0xfe, 0x00, 0x00]))

    expect(badSession.protocolErrors).toBe(1)
    expect(badSession.isClosed).toBe(true)
    expect(badCloseReasons).toHaveLength(1)
    expect(badCloseReasons[0]!.kind).toBe('error')
    expect(room.clientCount).toBe(1)
    expect(savedOnDisconnect.some((s) => s.name === 'MalformedPeer')).toBe(true)

    const goodEvents: Netproto.ServerEvent[] = []
    goodAdapter.onEvent((ev) => goodEvents.push(ev))
    goodAdapter.send({ type: 'Ping', tickCount: 42 } as unknown as Netproto.ClientCommand)
    room.stepFrame()
    expect(goodEvents.some((e) => e.type === 'Pong')).toBe(true)
    expect(goodSession.isClosed).toBe(false)

    room.close()
  })

  it('T5.B11: F10 computeLockstepHash is order-independent for ground items and quests while detecting single-field perturbations in inventory coordinates, loot stacks, quest kills, and monster AI state', () => {
    const baseWorld: Server.HashableWorld = {
      tick: 120,
      kills: 3,
      players: [
        {
          x: 5100,
          y: 5200,
          hp: 200,
          xp: 50000,
          level: 12,
          alive: true,
        },
      ],
      monsters: [
        {
          id: 101,
          x: 5150,
          y: 5250,
          hp: 80,
          state: 'idle',
        },
      ],
    }

    const baseInventories: readonly Server.HashableInventory[] = [
      {
        contents: [
          {
            x: 0,
            y: 0,
            item: { name: 'Shako', stack: 1, value: 5000, quality: 'unique', uniqueId: 123 },
          },
        ],
      },
    ]

    const groundItemA: Server.HashableGroundItem = {
      x: 5110,
      y: 5210,
      item: { name: 'Super Healing Potion', stack: 1, value: 150, quality: 'normal', uniqueId: 501 },
    }
    const groundItemB: Server.HashableGroundItem = {
      x: 5112,
      y: 5212,
      item: { name: 'Gold', stack: 250, value: 250, quality: 'normal', uniqueId: 502 },
    }

    const baseQuests: readonly Server.HashableQuest[] = [
      { def: { id: 'a1q1' }, status: 'active', kills: 3 },
      { def: { id: 'a1q2' }, status: 'completed', kills: 1 },
    ]

    const baseHash = Server.computeLockstepHash(
      baseWorld,
      baseInventories,
      [groundItemA, groundItemB],
      baseQuests,
    )

    const reorderedHash = Server.computeLockstepHash(
      baseWorld,
      baseInventories,
      [groundItemB, groundItemA],
      [baseQuests[1]!, baseQuests[0]!],
    )
    expect(reorderedHash).toBe(baseHash)

    const mutatedLootHash = Server.computeLockstepHash(
      baseWorld,
      baseInventories,
      [groundItemA, { ...groundItemB, item: { ...groundItemB.item, stack: 251 } }],
      baseQuests,
    )
    expect(mutatedLootHash).not.toBe(baseHash)

    const mutatedInvHash = Server.computeLockstepHash(
      baseWorld,
      [
        {
          contents: [
            {
              x: 1,
              y: 0,
              item: { name: 'Shako', stack: 1, value: 5000, quality: 'unique', uniqueId: 123 },
            },
          ],
        },
      ],
      [groundItemA, groundItemB],
      baseQuests,
    )
    expect(mutatedInvHash).not.toBe(baseHash)

    const mutatedQuestHash = Server.computeLockstepHash(
      baseWorld,
      baseInventories,
      [groundItemA, groundItemB],
      [{ def: { id: 'a1q1' }, status: 'active', kills: 4 }, baseQuests[1]!],
    )
    expect(mutatedQuestHash).not.toBe(baseHash)

    const mutatedMonsterHash = Server.computeLockstepHash(
      {
        ...baseWorld,
        monsters: [{ id: 101, x: 5150, y: 5250, hp: 80, state: 'chasing' }],
      },
      baseInventories,
      [groundItemA, groundItemB],
      baseQuests,
    )
    expect(mutatedMonsterHash).not.toBe(baseHash)
  })

  it('T5.B12: F10 LockstepSession validates submit() bounds, tracks waiting/stalls on missing peer inputs, and produces a desync report on remote hash mismatch', () => {
    let simHash = 0x1000
    const lockstep = new Server.LockstepSession(
      {
        peers: 2,
        inputDelayTicks: 0,
        maxFutureTicks: 4,
        historyTicks: 8,
      },
      {
        advance(frames) {
          for (const f of frames) {
            simHash = (simHash * 31 + Math.round(f.movement.x * 10) + Math.round(f.movement.y * 10) + f.tick) >>> 0
          }
        },
        hash() {
          return simHash >>> 0
        },
      },
    )

    expect(lockstep.submit(0, { tick: 0, movement: { x: 2, y: 0 }, attack: false, pickup: false })).toBe(false)
    expect(lockstep.submit(99, { tick: 0, movement: { x: 0, y: 0 }, attack: false, pickup: false })).toBe(false)
    expect(lockstep.submit(0, { tick: -1, movement: { x: 0, y: 0 }, attack: false, pickup: false })).toBe(false)
    expect(lockstep.submit(0, { tick: 5, movement: { x: 0, y: 0 }, attack: false, pickup: false })).toBe(false)

    expect(lockstep.submit(0, { tick: 0, movement: { x: 1, y: 0 }, attack: false, pickup: false })).toBe(true)
    expect(lockstep.submit(0, { tick: 0, movement: { x: 1, y: 0 }, attack: false, pickup: false })).toBe(false)

    const waitOutcome = lockstep.step()
    expect(waitOutcome).toEqual({ kind: 'waiting', tick: 0, missing: [1] })
    expect(lockstep.stalls).toBe(1)

    expect(lockstep.submit(1, { tick: 0, movement: { x: 0, y: -1 }, attack: false, pickup: false })).toBe(true)
    const step0 = lockstep.step()
    expect(step0.kind).toBe('stepped')
    expect(lockstep.stalls).toBe(0)
    expect(lockstep.tick).toBe(1)

    expect(lockstep.submit(0, { tick: 1, movement: { x: 0, y: 0 }, attack: false, pickup: false })).toBe(true)
    expect(lockstep.submit(1, { tick: 1, movement: { x: 0, y: 0 }, attack: false, pickup: false })).toBe(true)
    expect(lockstep.recordRemoteHash(1, 1, 0xdeadbeef)).toBe(true)

    const step1 = lockstep.step()
    expect(step1.kind).toBe('desync')
    expect(lockstep.desyncReport).not.toBeNull()
    expect(lockstep.desyncReport!.tick).toBe(1)
    expect(lockstep.desyncReport!.remoteHash).toBe(0xdeadbeef)
  })

  it('T5.B13: F11 OnlineSession + ClientWorld attach to binary D2gsServerAdapter connected to MultiClientRoomHost and route handshake, UnitReassign, and Chat events end-to-end', () => {
    const room = new Server.MultiClientRoomHost({
      registry,
      mapSeed: 0x13579bdf,
      act: 0,
      difficulty: 0,
    })

    const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
    const roomSession = room.attachClient(serverStream, {
      charName: 'BinaryClientHero',
      classId: 1,
      protocol: 'd2gs',
    })
    const d2gsAdapter = new Netproto.D2gsServerAdapter(clientStream)
    const world = new ClientWorld()
    const session = new OnlineSession({ world })
    session.attachGameServer(d2gsAdapter)

    const rawEvents: Netproto.ServerEvent[] = []
    const chatMessages: Array<{ from: string; text: string }> = []
    const unsubEvents = session.onServerEvent((ev) => rawEvents.push(ev))
    const unsubChat = session.onChatMessage((msg) =>
      chatMessages.push({
        from: String((msg as { from?: string; speaker?: string }).from ?? (msg as { speaker?: string }).speaker ?? ''),
        text: msg.text,
      }),
    )

    room.stepFrame()

    // ClientWorld transitions loading -> false, sets areaId=1, and spawns player unit from binary D2GS packets (0x04, 0x03, 0x59)
    expect(world.loading).toBe(false)
    expect(world.areaId).toBe(1)
    const spawnedPlayer = world.getUnit('player', roomSession.playerUnitId)
    expect(spawnedPlayer).toBeDefined()
    // 1.13c S2C 0x59 AssignPlayer stores charName in a 16-byte null-terminated char[16] field (max 15 chars)
    expect(spawnedPlayer!.name).toBe('BinaryClientHer')
    expect(spawnedPlayer!.classId).toBe(1)
    expect(rawEvents.some((e) => e.type === 'LoadComplete' || e.type === 'LoadAct')).toBe(true)

    // When a binary S2C 0x15 ReassignPlayer arrives for the player, ClientWorld binds localPlayerId (selfId) and snaps position
    roomSession.sendEvent({
      type: 'UnitReassign',
      unitType: 0,
      id: roomSession.playerUnitId,
      at: { x: 140, y: 145 },
      snap: true,
    })
    expect(world.localPlayerId).toBe(roomSession.playerUnitId)
    expect(world.self.x).toBe(140)
    expect(world.self.y).toBe(145)

    // Send Chat over OnlineSession -> D2gsServerAdapter -> RoomHost -> 0x26 S2C -> onChatMessage listener
    session.sendCommand({ type: 'Chat', text: 'BinaryWireChat' } as unknown as Netproto.ClientCommand)
    room.stepFrame()

    expect(chatMessages).toHaveLength(1)
    expect(chatMessages[0]!.text).toContain('BinaryWireChat')
    expect(world.chatLog).toHaveLength(1)
    expect(world.chatLog[0]!.text).toContain('BinaryWireChat')

    unsubEvents()
    unsubChat()
    session.destroy()
    room.close()
  })

  it('T5.B14: F11 ClientWorld enforces fail-fast errors on malformed ActDataLoaded/PlayerAssign, downgrades run to walk when 8.8 fixed-point stamina is exhausted, and applies ReassignPlayer/EntityRemove', () => {
    const world = new ClientWorld()

    // 1. Anti-silent-failure: ActDataLoaded without valid areaId/townAreaId must throw fast
    expect(() =>
      world.applyEvent({ type: 'ActDataLoaded', act: 0, mapSeed: 123 } as unknown as Netproto.ServerEvent),
    ).toThrow(/ActDataLoaded missing areaId/)

    // 2. Anti-silent-failure: PlayerAssign without valid unitId must throw fast
    expect(() =>
      world.applyEvent({ type: 'PlayerAssign', classId: 1, name: 'Bad' } as unknown as Netproto.ServerEvent),
    ).toThrow(/PlayerAssign missing unitId/)

    // 3. Valid PlayerAssign + 8.8 fixed-point stamina exhaustion causes outgoing Move({ run: true }) to downgrade moveMode to 'walk'
    world.applyEvent({
      type: 'PlayerAssign',
      unitId: Netproto.asUnitId(1),
      classId: 1,
      name: 'TiredRunner',
      x: Netproto.asSubTile(5000),
      y: Netproto.asSubTile(5000),
    })
    world.applyEvent({
      type: 'StatChange',
      statId: 10, // STAT_STAMINA (8.8 fixed-point)
      value: 0,
    } as unknown as Netproto.ServerEvent)
    world.applyEvent({
      type: 'StatChange',
      statId: 11, // STAT_MAXSTAMINA (8.8 fixed-point: 100 << 8 = 25600)
      value: 100 << 8,
    } as unknown as Netproto.ServerEvent)
    expect(world.self.stamina).toBe(0)
    expect(world.self.maxStamina).toBe(100)

    world.noteOutgoingCommand({
      type: 'Move',
      x: Netproto.asSubTile(5010),
      y: Netproto.asSubTile(5010),
      run: true,
    })
    const playerEntity = world.getUnit('player', 1)!
    expect(playerEntity.moveMode).toBe('walk')

    // 4. ReassignPlayer snaps entity position
    world.applyEvent({
      type: 'ReassignPlayer',
      unitType: 0,
      unitId: 1,
      x: 5200,
      y: 5300,
      snap: true,
    } as unknown as Netproto.ServerEvent)
    expect(world.getUnit('player', 1)!.x).toBe(5200)
    expect(world.getUnit('player', 1)!.y).toBe(5300)

    // 5. Spawn a monster via EntitySpawn and remove it via EntityRemove
    world.applyEvent({
      type: 'EntitySpawn',
      unitType: 1,
      unitId: 202,
      classId: 5,
      x: 5210,
      y: 5310,
    } as unknown as Netproto.ServerEvent)
    expect(world.getUnit('monster', 202)).toBeDefined()
    world.applyEvent({
      type: 'EntityRemove',
      unitType: 1,
      unitId: 202,
    } as unknown as Netproto.ServerEvent)
    expect(world.getUnit('monster', 202)).toBeUndefined()
  })

  it('T5.B15: F12 src/server/README.md documents all 24 on-disk server modules and TypeScript AST scan confirms zero deep netproto imports and zero Math.random/Date.now calls in src/server/**', () => {
    const readmeText = readRepoFile('src/server/README.md')

    const documentedServerModules = [
      'src/server/index.ts',
      'src/server/engine.ts',
      'src/server/loopback-adapter.ts',
      'src/server/room-host.ts',
      'src/server/net/aoi.ts',
      'src/server/net/party.ts',
      'src/server/net/session.ts',
      'src/server/engine/game-instance.ts',
      'src/server/engine/game-engine.ts',
      'src/server/engine/aura-scanner.ts',
      'src/server/engine/missile-engine.ts',
      'src/server/engine/state-bus.ts',
      'src/server/engine/combat-pipeline.ts',
      'src/server/engine/stat-list.ts',
      'src/server/engine/state-hash.ts',
      'src/server/skills/registry.ts',
      'src/server/skills/skills.ts',
      'src/server/ai/monster-ai.ts',
      'src/server/ai/room-streamer.ts',
      'src/server/ai/summon-manager.ts',
      'src/server/items/drop-pipeline.ts',
      'src/server/items/imbue.ts',
      'src/server/save/d2s-reader.ts',
      'src/server/save/d2s-writer.ts',
    ]
    for (const relPath of documentedServerModules) {
      const baseName = relPath.split('/').pop()!
      const stem = baseName.replace(/\.ts$/, '')
      expect(readmeText.includes(baseName) || readmeText.includes(stem)).toBe(true)
      expect(repoPathExists(relPath)).toBe(true)
    }

    const serverFiles = collectTsFilesRecursive(resolve(SRC_DIR, 'server'))
    const violations: string[] = []

    for (const file of serverFiles) {
      const rel = toRepoRelative(file)
      const content = readFileSync(file, 'utf8')
      const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true)

      const visit = (node: ts.Node): void => {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const spec = node.moduleSpecifier.text
          if (spec.includes('netproto') && !/netproto(\/index(\.ts)?)?$/.test(spec)) {
            violations.push(`${rel}: deep netproto import "${spec}"`)
          }
        }
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const obj = node.expression.expression.getText(sf)
          const prop = node.expression.name.text
          if ((obj === 'Math' && prop === 'random') || (obj === 'Date' && prop === 'now')) {
            violations.push(`${rel}: nondeterministic call ${obj}.${prop}()`)
          }
        }
        ts.forEachChild(node, visit)
      }
      ts.forEachChild(sf, visit)
    }

    expect(violations).toEqual([])
  })
})
