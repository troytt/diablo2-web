import { describe, expect, it } from 'vitest'
import {
  decodeD2gsItemPacket,
  decodePacket,
  encodeC2sHostile,
  getDefault113cItemDataTables,
  serverEventToS2cPackets,
} from '../../src/netproto/index.ts'
import {
  D2GS_0X5D_BUTTON_113C,
  PVP_HOSTILE_PORTAL_LOCKOUT_FRAMES_113C,
  PVP_MERC_VS_MERC_DAMAGE_PERCENT_113C,
  PVP_MIN_HOSTILE_LEVEL_113C,
  PVP_PLAYER_DAMAGE_PERCENT_113C,
  buildHostileRelationEvent0x5A113c,
  buildPvpPlayerEarItemData113c,
  buildPvpSlainEvent0x5A113c,
  canEnterPortalInPvp113c,
  canLootPlayerCorpse113c,
  canUseWaypointInPvp113c,
  computePvpDamagePercent113c,
  isHostilePvpCombatAllowed113c,
  isTownArea113c,
  scalePvpDamageValue113c,
  validatePlayerRelation0x5D113c,
} from '../../src/server/combat/pvp-engine-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { decodeD2gsC2sPacketToCommand } from '../../src/server/net/session.ts'

describe('1.13c Hostile PvP Combat, C2S 0x5D Gates, Lockout, Ear Drop & S2C 0x5A (#1784, #1858)', () => {
  describe('Pure 1.13c PvP Rule & SUnitDmg Scaling Matrix', () => {
    it('matches D2Game 0x6FCFAC10 SUnitDmg PvP scaling table', () => {
      expect(PVP_PLAYER_DAMAGE_PERCENT_113C).toBe(17)
      expect(PVP_MERC_VS_MERC_DAMAGE_PERCENT_113C).toBe(25)

      // Player, Mercenary, and Player-Owned Minion -> Player defender: 17% (1/6)
      expect(computePvpDamagePercent113c('player', 'player')).toBe(17)
      expect(computePvpDamagePercent113c('mercenary', 'player')).toBe(17)
      expect(computePvpDamagePercent113c('minion', 'player')).toBe(17)

      // Mercenary -> Mercenary defender: 25% (1/4)
      expect(computePvpDamagePercent113c('mercenary', 'mercenary')).toBe(25)

      // Player / Minion -> Mercenary or Minion defender: 100%
      expect(computePvpDamagePercent113c('player', 'mercenary')).toBe(100)
      expect(computePvpDamagePercent113c('player', 'minion')).toBe(100)
      expect(computePvpDamagePercent113c('minion', 'mercenary')).toBe(100)
      expect(computePvpDamagePercent113c('minion', 'minion')).toBe(100)

      expect(scalePvpDamageValue113c(100, 'player', 'player')).toBe(17)
      expect(scalePvpDamageValue113c(100, 'mercenary', 'mercenary')).toBe(25)
      expect(scalePvpDamageValue113c(100, 'player', 'mercenary')).toBe(100)
    })

    it('enforces Town areas, level >= 9, allowPvpHostile, and Hardcore-only 0x02 in validatePlayerRelation0x5D113c', () => {
      expect(PVP_MIN_HOSTILE_LEVEL_113C).toBe(9)
      expect(PVP_HOSTILE_PORTAL_LOCKOUT_FRAMES_113C).toBe(1500)
      for (const townId of [1, 40, 75, 103, 109]) {
        expect(isTownArea113c(townId)).toBe(true)
      }
      expect(isTownArea113c(2)).toBe(false)

      // Reject hostility outside Town (Blood Moor = 2)
      expect(
        validatePlayerRelation0x5D113c({
          allowPvpHostile: true,
          actorPlayerId: 1,
          actorAreaId: 2,
          actorLevel: 20,
          actorIsHardcore: false,
          targetPlayerId: 2,
          targetLevel: 20,
          targetIsHardcore: false,
          state: true,
          button: D2GS_0X5D_BUTTON_113C.HOSTILE,
        }),
      ).toEqual({ kind: 'reject', reason: 'not_in_town' })

      // Reject loot permit (0x02) on Softcore
      expect(
        validatePlayerRelation0x5D113c({
          allowPvpHostile: true,
          actorPlayerId: 1,
          actorAreaId: 1,
          actorLevel: 20,
          actorIsHardcore: false,
          targetPlayerId: 2,
          targetLevel: 20,
          targetIsHardcore: false,
          state: true,
          button: D2GS_0X5D_BUTTON_113C.LOOT_PERMIT,
        }),
      ).toEqual({ kind: 'reject', reason: 'loot_requires_hardcore' })

      // Accept loot permit (0x02) when both players are Hardcore
      expect(
        validatePlayerRelation0x5D113c({
          allowPvpHostile: true,
          actorPlayerId: 1,
          actorAreaId: 2,
          actorLevel: 1,
          actorIsHardcore: true,
          targetPlayerId: 2,
          targetLevel: 1,
          targetIsHardcore: true,
          state: true,
          button: D2GS_0X5D_BUTTON_113C.LOOT_PERMIT,
        }),
      ).toEqual({ kind: 'loot_permit', permitted: true })

      // Hostile combat requires both outside Town and hostile relation
      expect(
        isHostilePvpCombatAllowed113c({
          allowPvpHostile: true,
          attackerOwnerPlayerId: 1,
          attackerAreaId: 1,
          defenderOwnerPlayerId: 2,
          defenderAreaId: 2,
          areHostile: true,
          sameAreaOrSeamAdjacent: true,
        }),
      ).toBe(false)
      expect(
        isHostilePvpCombatAllowed113c({
          allowPvpHostile: true,
          attackerOwnerPlayerId: 1,
          attackerAreaId: 2,
          defenderOwnerPlayerId: 2,
          defenderAreaId: 2,
          areHostile: true,
          sameAreaOrSeamAdjacent: true,
        }),
      ).toBe(true)
    })

    it('gates blue/red portals and waypoints during 1500-frame hostility lockout and enforces party portal rule', () => {
      // Locked out at frame 1499, unlocked at frame 1500
      expect(
        canEnterPortalInPvp113c({
          currentFrame: 1499,
          playerUnitId: 1,
          hostilePortalLockUntilFrame: 1500,
          portalClassId: 59,
          portalOwnerId: 1,
          isAlliedWithOwner: true,
        }),
      ).toBe(false)
      expect(
        canEnterPortalInPvp113c({
          currentFrame: 1499,
          playerUnitId: 1,
          hostilePortalLockUntilFrame: 1500,
          portalClassId: 60,
          portalOwnerId: undefined,
          isAlliedWithOwner: false,
        }),
      ).toBe(false)
      expect(canUseWaypointInPvp113c(1499, 1500)).toBe(false)
      expect(canUseWaypointInPvp113c(1500, 1500)).toBe(true)

      // Blue Town Portal (59): unpartied non-owner blocked, allied member allowed
      expect(
        canEnterPortalInPvp113c({
          currentFrame: 2000,
          playerUnitId: 3,
          hostilePortalLockUntilFrame: 0,
          portalClassId: 59,
          portalOwnerId: 2,
          isAlliedWithOwner: false,
        }),
      ).toBe(false)
      expect(
        canEnterPortalInPvp113c({
          currentFrame: 2000,
          playerUnitId: 3,
          hostilePortalLockUntilFrame: 0,
          portalClassId: 59,
          portalOwnerId: 2,
          isAlliedWithOwner: true,
        }),
      ).toBe(true)
    })
  })

  describe('C2S 0x5D Wire Codec, Town Gate, TP Destruction, 1500-Frame Lockout & Party Portal Gate (#1858)', () => {
    it('encodes C2S 0x5D with default button 0x04 and roundtrips buttons 0x01..0x04', () => {
      const defaultPkt = encodeC2sHostile(42, true)
      expect(Array.from(defaultPkt)).toEqual([0x5d, 0x04, 0x01, 42, 0x00, 0x00, 0x00])
      expect(decodeD2gsC2sPacketToCommand(defaultPkt)).toEqual({
        type: 'Hostile',
        targetPlayerId: 42,
        hostile: true,
        button: 4,
      })

      for (const button of [0x01, 0x02, 0x03, 0x04] as const) {
        const pkt = encodeC2sHostile(99, false, button)
        expect(pkt[1]).toBe(button)
        expect(pkt[2]).toBe(0)
        expect(decodeD2gsC2sPacketToCommand(pkt)).toEqual({
          type: 'Hostile',
          targetPlayerId: 99,
          hostile: false,
          button,
        })
      }
    })

    it('rejects declaring hostility when initiator is outside Town (D2Game 0x6FD11146)', () => {
      const game = new GameInstance({
        mapSeed: 7001,
        maxPlayers: 8,
        policy: { allowPvpHostile: true },
      })
      const aId = game.addPlayer({ name: 'Alice', classId: 1, level: 20, areaId: 2, x: 50, y: 50 })
      const bId = game.addPlayer({ name: 'Bob', classId: 4, level: 20, areaId: 1, x: 50, y: 50 })
      game.drainEvents(aId)

      game.enqueueCommand(aId, {
        type: 'Hostile',
        targetPlayerId: bId,
        hostile: true,
        button: 4,
      })
      game.stepFrame()

      expect(game.partyManager.areHostile(aId, bId)).toBe(false)
      expect(game.drainEvents(aId).filter((e) => e.type === 'Party' && e.kind === 'relation')).toHaveLength(0)
    })

    it('destroys initiator blue TP on hostility, broadcasts 0x8C + 0x5A, and enforces 1500-frame TP/red-portal/WP lockout', () => {
      const game = new GameInstance({
        mapSeed: 7002,
        maxPlayers: 8,
        policy: { allowPvpHostile: true },
      })
      // Alice starts in Blood Moor (area 2), picks up a TP scroll, opens her blue TP, and enters Town (area 1)
      const aId = game.addPlayer({ name: 'Alice', classId: 1, level: 20, areaId: 2, x: 50, y: 50 })
      const bId = game.addPlayer({ name: 'Bob', classId: 4, level: 20, areaId: 2, x: 60, y: 60 })

      // Form a shared party first
      game.partyManager.invite(aId, bId)
      game.partyManager.acceptInvite(bId, aId)
      expect(game.partyManager.areAllied(aId, bId)).toBe(true)

      const tscId = game.spawnGroundItem({ code: 'tsc', x: 50, y: 50, areaId: 2 })
      game.enqueueCommand(aId, { type: 'ItemPickup', itemId: tscId })
      game.stepFrame()
      game.enqueueCommand(aId, { type: 'TownPortal' })
      game.stepFrame()

      // Both wilderness and town mouths of Alice's blue TP (classId 59) exist
      const aliceWildTp = game
        .getAllUnits()
        .find((u) => u.unitType === 'object' && u.classId === 59 && u.areaId === 2)
      const aliceTownTp = game
        .getAllUnits()
        .find((u) => u.unitType === 'object' && u.classId === 59 && u.areaId === 1)
      expect(aliceWildTp).toBeDefined()
      expect(aliceTownTp).toBeDefined()

      // Advance past warp cooldown and step through wilderness mouth into Town (area 1); TP stays open!
      game.stepFrames(15)
      game.movePlayer(aId, aliceWildTp!.x, aliceWildTp!.y)
      game.enqueueCommand(aId, {
        type: 'Interact',
        target: { unitType: 2, id: aliceWildTp!.unitId },
      })
      game.stepFrame()
      expect(game.getPlayerState(aId)?.areaId).toBe(1)
      expect(
        game.getAllUnits().filter((u) => u.unitType === 'object' && u.classId === 59),
      ).toHaveLength(2)

      // Bob also opens a blue TP in Blood Moor so there is a second player's blue TP in Town
      const bobTscId = game.spawnGroundItem({ code: 'tsc', x: 60, y: 60, areaId: 2 })
      game.enqueueCommand(bId, { type: 'ItemPickup', itemId: bobTscId })
      game.stepFrame()
      game.enqueueCommand(bId, { type: 'TownPortal' })
      game.stepFrame()
      const bobTownTp = game
        .getAllUnits()
        .find(
          (u) =>
            u.unitType === 'object' &&
            u.classId === 59 &&
            u.areaId === 1 &&
            u.unitId !== aliceTownTp!.unitId,
        )
      expect(bobTownTp).toBeDefined()

      // Spawn a red portal (classId 60 -> Cow Level 39) and Town Waypoint (classId 119) + Cold Plains WP (area 3)
      const redPortalId = game.spawnObject({
        classId: 60,
        x: 52,
        y: 52,
        areaId: 1,
        mode: 2,
        destAreaId: 39,
      })
      const townWpId = game.spawnObject({
        classId: 119,
        x: 50,
        y: 50,
        areaId: 1,
        mode: 2,
        isWaypoint: true,
      })

      // Unlock Cold Plains (area 3) on Alice before hostility by briefly visiting & clicking WP in area 3
      const cpWpId = game.spawnObject({
        classId: 119,
        x: 50,
        y: 50,
        areaId: 3,
        mode: 2,
        isWaypoint: true,
      })
      const cpToTownPortal = game.spawnObject({
        classId: 60,
        x: 50,
        y: 50,
        areaId: 1,
        mode: 2,
        destAreaId: 3,
      })
      const backToTownPortal = game.spawnObject({
        classId: 60,
        x: 50,
        y: 50,
        areaId: 3,
        mode: 2,
        destAreaId: 1,
      })
      game.stepFrames(15)
      game.movePlayer(aId, 50, 50)
      game.enqueueCommand(aId, { type: 'Interact', target: { unitType: 2, id: cpToTownPortal } })
      game.stepFrame()
      expect(game.getPlayerState(aId)?.areaId).toBe(3)
      game.enqueueCommand(aId, { type: 'Interact', target: { unitType: 2, id: cpWpId } })
      game.stepFrame()
      expect(game.getPlayerState(aId)?.waypoints.has(3)).toBe(true)
      game.stepFrames(15)
      game.enqueueCommand(aId, { type: 'Interact', target: { unitType: 2, id: backToTownPortal } })
      game.stepFrame()
      expect(game.getPlayerState(aId)?.areaId).toBe(1)

      game.drainEvents(aId)
      game.drainEvents(bId)

      // Alice declares hostility on Bob in Town!
      game.enqueueCommand(aId, {
        type: 'Hostile',
        targetPlayerId: bId,
        hostile: true,
        button: 4,
      })
      game.stepFrame()

      expect(game.partyManager.areHostile(aId, bId)).toBe(true)
      expect(game.partyManager.areAllied(aId, bId)).toBe(false)

      // Alice's blue TP mouths are immediately destroyed, while Bob's blue TP remains intact
      const remainingBlueTps = game
        .getAllUnits()
        .filter((u) => u.unitType === 'object' && u.classId === 59)
      expect(remainingBlueTps.some((u) => u.unitId === aliceTownTp!.unitId)).toBe(false)
      expect(remainingBlueTps.some((u) => u.unitId === aliceWildTp!.unitId)).toBe(false)
      expect(remainingBlueTps.some((u) => u.unitId === bobTownTp!.unitId)).toBe(true)

      // S2C 0x8C relation + S2C 0x5A eventType 0x07 subType 0x03 broadcast and wire-decodable
      const outA = game.drainEvents(aId)
      const hostileEvent5A = outA.find(
        (e) => e.type === 'Chat' && e.kind === 'event' && e.eventType === 0x07,
      )
      expect(hostileEvent5A).toBeDefined()
      const wire5A = serverEventToS2cPackets(hostileEvent5A!)
      expect(wire5A.length).toBeGreaterThan(0)
      expect(wire5A[0]![0]).toBe(0x5a)
      const decoded5A = decodePacket(wire5A[0]!, 'S2C')
      expect(decoded5A.ok).toBe(true)
      expect(decoded5A.event).toMatchObject({
        type: 'Chat',
        kind: 'event',
        eventType: 0x07,
        subType: 0x03,
        name1: 'Alice',
        name2: 'Bob',
      })

      // Even if Alice un-hostiles and re-parties with Bob, her 1500-frame lockout still blocks portals & WPs!
      game.enqueueCommand(aId, {
        type: 'Hostile',
        targetPlayerId: bId,
        hostile: false,
        button: 4,
      })
      game.stepFrame()
      game.partyManager.invite(aId, bId)
      game.partyManager.acceptInvite(bId, aId)
      expect(game.partyManager.areAllied(aId, bId)).toBe(true)

      // Advance 1480 frames (total elapsed since hostility < 1500): blue TP, red portal, and WP are ALL blocked
      game.stepFrames(1480)
      game.movePlayer(aId, bobTownTp!.x, bobTownTp!.y)
      game.enqueueCommand(aId, {
        type: 'Interact',
        target: { unitType: 2, id: bobTownTp!.unitId },
      })
      game.stepFrame()
      expect(game.getPlayerState(aId)?.areaId).toBe(1)

      game.movePlayer(aId, 52, 52)
      game.enqueueCommand(aId, {
        type: 'Interact',
        target: { unitType: 2, id: redPortalId },
      })
      game.stepFrame()
      expect(game.getPlayerState(aId)?.areaId).toBe(1)

      game.movePlayer(aId, 50, 50)
      game.enqueueCommand(aId, {
        type: 'Interact',
        target: { unitType: 2, id: townWpId },
      })
      game.stepFrame()
      game.enqueueCommand(aId, {
        type: 'WaypointGo',
        waypointId: townWpId,
        destAreaId: 3,
      })
      game.stepFrame()
      expect(game.getPlayerState(aId)?.areaId).toBe(1)

      // Advance past frame + 1500: lockout expires, WaypointGo and allied blue TP now succeed!
      game.stepFrames(25)
      game.enqueueCommand(aId, {
        type: 'Interact',
        target: { unitType: 2, id: townWpId },
      })
      game.stepFrame()
      game.enqueueCommand(aId, {
        type: 'WaypointGo',
        waypointId: townWpId,
        destAreaId: 3,
      })
      game.stepFrame()
      expect(game.getPlayerState(aId)?.areaId).toBe(3)
    })

    it('blocks unpartied/hostile players from entering another player blue Town Portal while allowing party allies', () => {
      const game = new GameInstance({
        mapSeed: 7003,
        maxPlayers: 8,
        policy: { allowPvpHostile: true },
      })
      const ownerId = game.addPlayer({ name: 'Owner', classId: 0, level: 20, areaId: 2, x: 50, y: 50 })
      const strangerId = game.addPlayer({ name: 'Stranger', classId: 2, level: 20, areaId: 1, x: 50, y: 50 })

      const tscId = game.spawnGroundItem({ code: 'tsc', x: 50, y: 50, areaId: 2 })
      game.enqueueCommand(ownerId, { type: 'ItemPickup', itemId: tscId })
      game.stepFrame()
      game.enqueueCommand(ownerId, { type: 'TownPortal' })
      game.stepFrame()

      const townTp = game
        .getAllUnits()
        .find((u) => u.unitType === 'object' && u.classId === 59 && u.areaId === 1)
      expect(townTp).toBeDefined()

      // Unpartied Stranger cannot enter Owner's blue TP
      game.stepFrames(15)
      game.movePlayer(strangerId, townTp!.x, townTp!.y)
      game.enqueueCommand(strangerId, {
        type: 'Interact',
        target: { unitType: 2, id: townTp!.unitId },
      })
      game.stepFrame()
      expect(game.getPlayerState(strangerId)?.areaId).toBe(1)

      // Once allied in a party, Stranger enters Owner's blue TP into Blood Moor (area 2)
      game.partyManager.invite(ownerId, strangerId)
      game.partyManager.acceptInvite(strangerId, ownerId)
      game.stepFrames(15)
      game.enqueueCommand(strangerId, {
        type: 'Interact',
        target: { unitType: 2, id: townTp!.unitId },
      })
      game.stepFrame()
      expect(game.getPlayerState(strangerId)?.areaId).toBe(2)
    })

    it('restricts Corpse Loot permission (0x5D button 0x02) and corpse looting to Hardcore players with permission', () => {
      // 1) Softcore game rejects button 0x02
      const scGame = new GameInstance({
        mapSeed: 7004,
        maxPlayers: 8,
        policy: { allowPvpHostile: true },
      })
      const scA = scGame.addPlayer({ name: 'ScA', classId: 0, level: 20, areaId: 1 })
      const scB = scGame.addPlayer({ name: 'ScB', classId: 1, level: 20, areaId: 1 })
      scGame.enqueueCommand(scA, {
        type: 'Hostile',
        targetPlayerId: scB,
        hostile: true,
        button: 2,
      })
      scGame.stepFrame()
      expect(scGame.partyManager.hasLootPermission(scA, scB)).toBe(false)

      // 2) Hardcore game allows button 0x02 and transfers equipped items ONLY to permitted Hardcore looter
      const hcGame = new GameInstance({
        mapSeed: 7005,
        maxPlayers: 8,
        policy: { allowPvpHostile: true },
      })
      const victimId = hcGame.addPlayer({
        name: 'HcVictim',
        classId: 3,
        level: 20,
        hardcore: true,
        areaId: 2,
        x: 50,
        y: 50,
      })
      const looterId = hcGame.addPlayer({
        name: 'HcFriend',
        classId: 4,
        level: 20,
        hardcore: true,
        areaId: 2,
        x: 51,
        y: 50,
      })
      const strangerId = hcGame.addPlayer({
        name: 'HcStranger',
        classId: 2,
        level: 20,
        hardcore: true,
        areaId: 2,
        x: 50,
        y: 51,
      })

      // Equip a Cap ('cap', head slot = 1) on HcVictim
      const capId = hcGame.spawnGroundItem({ code: 'cap', x: 50, y: 50, areaId: 2 })
      hcGame.enqueueCommand(victimId, { type: 'ItemPickup', itemId: capId, toCursor: true })
      hcGame.stepFrame()
      hcGame.enqueueCommand(victimId, { type: 'ItemEquip', itemId: capId, slot: 1 })
      hcGame.stepFrame()
      expect(
        hcGame.getPlayerState(victimId)?.items.some((i) => i.code === 'cap' && i.location === 'equipped'),
      ).toBe(true)

      // HcVictim grants corpse loot permission ONLY to HcFriend
      hcGame.enqueueCommand(victimId, {
        type: 'Hostile',
        targetPlayerId: looterId,
        hostile: true,
        button: 2,
      })
      hcGame.stepFrame()
      expect(hcGame.partyManager.hasLootPermission(victimId, looterId)).toBe(true)
      expect(hcGame.partyManager.hasLootPermission(victimId, strangerId)).toBe(false)

      // HcVictim dies
      hcGame.applyDamageToPlayer(victimId, 10_000, { killerType: 'monster' })
      const corpseId = hcGame.getPlayerState(victimId)?.corpseId
      expect(corpseId).toBeDefined()

      // Unpermitted HcStranger clicks corpse -> denied, cap stays on corpse
      hcGame.enqueueCommand(strangerId, {
        type: 'Interact',
        target: { unitType: 0, id: corpseId! },
      })
      hcGame.stepFrame()
      expect(hcGame.getPlayerState(strangerId)?.items.some((i) => i.code === 'cap')).toBe(false)
      expect(hcGame.getPlayerState(victimId)?.corpseId).toBe(corpseId)

      // Permitted HcFriend clicks corpse -> receives 'cap' in inventory and corpse is cleared
      hcGame.enqueueCommand(looterId, {
        type: 'Interact',
        target: { unitType: 0, id: corpseId! },
      })
      hcGame.stepFrame()
      expect(hcGame.getPlayerState(looterId)?.items.some((i) => i.code === 'cap')).toBe(true)
      expect(hcGame.getPlayerState(victimId)?.corpseId).toBeUndefined()
    })
  })

  describe('Hostile PvP Combat, Skills, Missiles, Auras, Mercenaries & Pets (#1784)', () => {
    it('prevents PvP damage inside Town and applies 17% PvP scaling on Smite, Static Field, Nova, Fire Ball & Holy Fire/Conviction outside Town', () => {
      const game = new GameInstance({
        mapSeed: 8001,
        maxPlayers: 8,
        policy: { allowPvpHostile: true },
      })
      const palId = game.addPlayer({
        name: 'Paladin',
        classId: 3,
        level: 30,
        strength: 120,
        dexterity: 100,
        mana: 500,
        maxMana: 500,
        skills: { 97: 20, 102: 20, 123: 15 },
        areaId: 1,
        x: 50,
        y: 50,
      })
      const sorcId = game.addPlayer({
        name: 'Sorceress',
        classId: 1,
        level: 30,
        hp: 600,
        maxHp: 600,
        mana: 600,
        maxMana: 600,
        skills: { 42: 15, 47: 20, 48: 20 },
        areaId: 1,
        x: 51,
        y: 50,
      })
      const allyId = game.addPlayer({
        name: 'PalAlly',
        classId: 0,
        level: 30,
        hp: 500,
        maxHp: 500,
        areaId: 1,
        x: 50,
        y: 51,
      })

      // Equip a Buckler ('buc', shield slot = 5) on Paladin for Smite (#97)
      const bucId = game.spawnGroundItem({ code: 'buc', x: 50, y: 50, areaId: 1 })
      game.enqueueCommand(palId, { type: 'ItemPickup', itemId: bucId, toCursor: true })
      game.stepFrame()
      game.enqueueCommand(palId, { type: 'ItemEquip', itemId: bucId, slot: 5 })
      game.stepFrame()

      // Paladin allies with PalAlly, and Sorceress declares hostility on Paladin in Town
      game.partyManager.invite(palId, allyId)
      game.partyManager.acceptInvite(allyId, palId)
      game.enqueueCommand(sorcId, {
        type: 'Hostile',
        targetPlayerId: palId,
        hostile: true,
        button: 4,
      })
      game.stepFrame()
      expect(game.partyManager.areHostile(palId, sorcId)).toBe(true)

      // 1) Inside Town (area 1): attacks/casts deal 0 damage
      game.enqueueCommand(palId, {
        type: 'CastSkillOnTarget',
        skillId: 97,
        targetType: 0,
        targetId: sorcId,
      })
      game.stepFrame()
      expect(game.getPlayerState(sorcId)?.hp).toBe(600)

      // Warp everyone past lockout into Blood Moor (area 2) via a level warp / portal after 1505 frames
      game.stepFrames(1505)
      const toMoor = game.spawnObject({
        classId: 60,
        x: 50,
        y: 50,
        areaId: 1,
        mode: 2,
        destAreaId: 2,
      })
      for (const pid of [palId, sorcId, allyId]) {
        game.movePlayer(pid, 50, 50)
        game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: toMoor } })
        game.stepFrame()
        game.stepFrames(15)
      }
      game.movePlayer(palId, 50, 50)
      game.movePlayer(sorcId, 51, 50)
      game.movePlayer(allyId, 50, 51)
      expect(game.getPlayerState(palId)?.areaId).toBe(2)
      expect(game.getPlayerState(sorcId)?.areaId).toBe(2)
      expect(game.getPlayerState(allyId)?.areaId).toBe(2)

      // 2) Paladin Smite (#97) auto-hits hostile Sorceress with 17% PvP scaling and applies stun (state 21)
      const hpBeforeSmite = game.getPlayerState(sorcId)!.hp
      game.enqueueCommand(palId, {
        type: 'CastSkillOnTarget',
        skillId: 97,
        targetType: 0,
        targetId: sorcId,
      })
      game.stepFrame()
      const afterSmite = game.getPlayerState(sorcId)!
      expect(afterSmite.hp).toBeLessThan(hpBeforeSmite)
      expect(hpBeforeSmite - afterSmite.hp).toBeLessThan(80) // 17% PvP scaled, never unscaled PvM
      expect(afterSmite.states.has(21)).toBe(true)

      // 3) Sorceress Static Field (#42) damages hostile Paladin and never kills at low HP
      const palHpBeforeSf = game.getPlayerState(palId)!.hp
      game.enqueueCommand(sorcId, {
        type: 'CastSkillAtLocation',
        skillId: 42,
        x: 50,
        y: 50,
      })
      game.stepFrame()
      const palHpAfterSf = game.getPlayerState(palId)!.hp
      expect(palHpAfterSf).toBeLessThan(palHpBeforeSf)
      expect(palHpAfterSf).toBeGreaterThanOrEqual(1)

      // 4) Sorceress Nova (#48) radial AoE damages hostile Paladin
      const palHpBeforeNova = game.getPlayerState(palId)!.hp
      game.enqueueCommand(sorcId, {
        type: 'CastSkillAtLocation',
        skillId: 48,
        x: 51,
        y: 50,
      })
      game.stepFrame()
      expect(game.getPlayerState(palId)!.hp).toBeLessThan(palHpBeforeNova)

      // 5) Sorceress Fire Ball (#47) projectile impacts hostile Paladin across distance
      game.movePlayer(sorcId, 56, 50)
      const palHpBeforeFb = game.getPlayerState(palId)!.hp
      game.enqueueCommand(sorcId, {
        type: 'CastSkillAtLocation',
        skillId: 47,
        x: 50,
        y: 50,
      })
      game.stepFrames(20)
      expect(game.getPlayerState(palId)!.hp).toBeLessThan(palHpBeforeFb)

      // 6) Paladin Holy Fire (#102) radial pulse damages hostile Sorceress, NOT allied PalAlly
      game.movePlayer(sorcId, 52, 50)
      const sorcHpBeforeAura = game.getPlayerState(sorcId)!.hp
      const allyHpBeforeAura = game.getPlayerState(allyId)!.hp
      game.enqueueCommand(palId, {
        type: 'SelectSkill',
        hand: 'right',
        skill: 102,
      })
      game.stepFrames(60)
      expect(game.getPlayerState(sorcId)!.hp).toBeLessThan(sorcHpBeforeAura)
      expect(game.getPlayerState(allyId)!.hp).toBe(allyHpBeforeAura)

      // 7) Paladin Conviction (#123) applies state 28 debuff to hostile Sorceress, NOT allied PalAlly
      game.enqueueCommand(palId, {
        type: 'SelectSkill',
        hand: 'right',
        skill: 123,
      })
      game.stepFrames(60)
      expect(game.getPlayerState(sorcId)!.states.has(28)).toBe(true)
      expect(game.getPlayerState(allyId)!.states.has(28)).toBe(false)
    })

    it('lets Mercenaries and Summoned Pets engage hostile Players and hostile Mercenaries outside Town', () => {
      const game = new GameInstance({
        mapSeed: 8002,
        maxPlayers: 8,
        policy: { allowPvpHostile: true },
      })
      const aId = game.addPlayer({
        name: 'NecroA',
        classId: 2,
        level: 30,
        skills: { 75: 20 },
        areaId: 1,
        x: 50,
        y: 50,
      })
      const bId = game.addPlayer({
        name: 'TargetB',
        classId: 4,
        level: 25,
        hp: 800,
        maxHp: 800,
        areaId: 1,
        x: 52,
        y: 50,
      })

      game.enqueueCommand(aId, {
        type: 'Hostile',
        targetPlayerId: bId,
        hostile: true,
        button: 4,
      })
      game.stepFrame()
      game.stepFrames(1505)

      const toMoor = game.spawnObject({
        classId: 60,
        x: 50,
        y: 50,
        areaId: 1,
        mode: 2,
        destAreaId: 2,
      })
      for (const pid of [aId, bId]) {
        game.movePlayer(pid, 50, 50)
        game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: toMoor } })
        game.stepFrame()
        game.stepFrames(15)
      }
      game.movePlayer(aId, 50, 50)
      game.movePlayer(bId, 52, 50)

      // Summon Clay Golem (#75, corpse-free summon) for NecroA -> attacks hostile TargetB
      const golem = game.summonPet(aId, { skillId: 75, slvl: 20, x: 51, y: 50 })
      expect(golem.created).toBe(true)
      const hpBeforePet = game.getPlayerState(bId)!.hp
      game.stepFrames(40)
      expect(game.getPlayerState(bId)!.hp).toBeLessThan(hpBeforePet)

      // Hire Act 2 Mercenaries for both NecroA and TargetB -> MercA damages MercB / TargetB
      const mercAId = game.hireMercenary(aId, { act: 2, level: 30 })
      const mercBId = game.hireMercenary(bId, { act: 2, level: 20 })
      const mercBBefore = game.getMercenaryState(mercBId)!.hp
      const bBeforeMerc = game.getPlayerState(bId)!.hp
      game.stepFrames(50)
      const mercBAfter = game.getMercenaryState(mercBId)?.hp ?? 0
      const bAfterMerc = game.getPlayerState(bId)!.hp
      expect(mercAId).toBeGreaterThan(0)
      expect(mercBAfter < mercBBefore || bAfterMerc < bBeforeMerc).toBe(true)
    })
  })

  describe('PvP Victim Death: Zero XP Loss, PK Gold Pile, Compact S2C 0x9C Ear & S2C 0x5A Broadcast (#1784)', () => {
    it('preserves 100% XP in Hell, drops PK gold + wire-valid 0x9C personalized ear, and broadcasts 0x5A to all players', () => {
      const game = new GameInstance({
        mapSeed: 9001,
        difficulty: 2, // Hell (10% PvM XP loss, 0% PvP XP loss!)
        maxPlayers: 8,
        policy: { allowPvpHostile: true },
      })
      const killerId = game.addPlayer({
        name: 'SlayerSorc',
        classId: 1,
        level: 40,
        mana: 600,
        maxMana: 600,
        skills: { 48: 25 },
        areaId: 1,
        x: 50,
        y: 50,
      })
      const victimId = game.addPlayer({
        name: 'BarbVictim',
        classId: 4, // Barbarian
        level: 25,
        experience: 1_850_000,
        gold: 10_000,
        goldBank: 40_000, // total 50,000 -> min(25,20)% = 20% -> 10,000 PK gold drop!
        hp: 5,
        maxHp: 500,
        areaId: 1,
        x: 51,
        y: 50,
      })
      const observerId = game.addPlayer({
        name: 'TownObserver',
        classId: 0,
        level: 10,
        areaId: 1, // Stays in Rogue Encampment!
        x: 55,
        y: 55,
      })

      game.enqueueCommand(killerId, {
        type: 'Hostile',
        targetPlayerId: victimId,
        hostile: true,
        button: 4,
      })
      game.stepFrame()
      game.stepFrames(1505)

      const toMoor = game.spawnObject({
        classId: 60,
        x: 50,
        y: 50,
        areaId: 1,
        mode: 2,
        destAreaId: 2,
      })
      for (const pid of [killerId, victimId]) {
        game.movePlayer(pid, 50, 50)
        game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: toMoor } })
        game.stepFrame()
        game.stepFrames(15)
      }
      game.movePlayer(killerId, 50, 50)
      game.movePlayer(victimId, 51, 50)

      game.drainEvents(killerId)
      game.drainEvents(victimId)
      game.drainEvents(observerId)

      // SlayerSorc kills BarbVictim with Nova (#48)
      game.enqueueCommand(killerId, {
        type: 'CastSkillAtLocation',
        skillId: 48,
        x: 50,
        y: 50,
      })
      game.stepFrame()

      const victimAfter = game.getPlayerState(victimId)!
      expect(victimAfter.dead).toBe(true)
      // 1) Zero XP lost in Hell PvP death!
      expect(victimAfter.experience).toBe(1_850_000)

      // 2) PK gold penalty: 20% of (10,000 + 40,000) = 10,000 dropped on ground
      expect(victimAfter.gold).toBe(0)
      expect(victimAfter.goldBank).toBe(40_000)
      const groundItems = game.getGroundItems()
      const pkGoldPile = groundItems.find((g) => g.code === 'gld' && g.areaId === 2)
      expect(pkGoldPile).toBeDefined()
      expect(pkGoldPile!.quantity).toBe(10_000)

      // 3) Personalized compact 'ear ' spawned and decodes cleanly via S2C 0x9C bitstream!
      const earEntry = groundItems.find((g) => g.code === 'ear' && g.areaId === 2)
      expect(earEntry).toBeDefined()

      const killerOut = game.drainEvents(killerId)
      const victimOut = game.drainEvents(victimId)
      const observerOut = game.drainEvents(observerId)

      const earSpawnEv = killerOut.find(
        (e) => e.type === 'ItemEvent' && e.code === 'ear',
      )
      expect(earSpawnEv).toBeDefined()
      const earWirePkts = serverEventToS2cPackets(earSpawnEv!)
      expect(earWirePkts.length).toBeGreaterThan(0)
      expect(earWirePkts[0]![0]).toBe(0x9c)

      const decodedEar = decodeD2gsItemPacket(earWirePkts[0]!, getDefault113cItemDataTables())
      expect(decodedEar.code).toBe('ear')
      expect(decodedEar.isEar).toBe(true)
      expect(decodedEar.compact).toBe(true)
      expect(decodedEar.earClass).toBe(4) // Barbarian
      expect(decodedEar.earLevel).toBe(25)
      expect(decodedEar.earName).toBe('BarbVictim')

      // 4) S2C 0x5A (eventType 0x06, color 4, victim=BarbVictim, killer=SlayerSorc) delivered to ALL players!
      for (const outbox of [killerOut, victimOut, observerOut]) {
        const slainEv = outbox.find(
          (e) => e.type === 'Chat' && e.kind === 'event' && e.eventType === 0x06,
        )
        expect(slainEv).toBeDefined()
        const wire = serverEventToS2cPackets(slainEv!)
        expect(wire[0]![0]).toBe(0x5a)
        const decoded = decodePacket(wire[0]!, 'S2C')
        expect(decoded.ok).toBe(true)
        expect(decoded.event).toMatchObject({
          type: 'Chat',
          kind: 'event',
          eventType: 0x06,
          color: 4,
          name1: 'BarbVictim',
          name2: 'SlayerSorc',
        })
      }
    })

    it('attributes pet and mercenary PvP kills to the owning player in S2C 0x5A and drops victim ear with 0 XP loss', () => {
      const game = new GameInstance({
        mapSeed: 9002,
        difficulty: 2,
        maxPlayers: 8,
        policy: { allowPvpHostile: true },
      })
      const ownerId = game.addPlayer({
        name: 'SummonLord',
        classId: 2,
        level: 35,
        skills: { 75: 25 },
        areaId: 1,
        x: 50,
        y: 50,
      })
      const victimId = game.addPlayer({
        name: 'AmaVictim',
        classId: 0, // Amazon
        level: 22,
        experience: 950_000,
        hp: 2,
        maxHp: 400,
        areaId: 1,
        x: 52,
        y: 50,
      })

      game.enqueueCommand(ownerId, {
        type: 'Hostile',
        targetPlayerId: victimId,
        hostile: true,
        button: 4,
      })
      game.stepFrame()
      game.stepFrames(1505)

      const toMoor = game.spawnObject({
        classId: 60,
        x: 50,
        y: 50,
        areaId: 1,
        mode: 2,
        destAreaId: 2,
      })
      for (const pid of [ownerId, victimId]) {
        game.movePlayer(pid, 50, 50)
        game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: toMoor } })
        game.stepFrame()
        game.stepFrames(15)
      }
      game.movePlayer(ownerId, 45, 50)
      game.movePlayer(victimId, 52, 50)

      // Summon Clay Golem (#75) right next to low-HP AmaVictim so the Golem deals the lethal blow
      const golem = game.summonPet(ownerId, { skillId: 75, slvl: 25, x: 51, y: 50 })
      expect(golem.created).toBe(true)

      game.drainEvents(ownerId)
      game.drainEvents(victimId)
      game.stepFrames(45)

      const victimAfter = game.getPlayerState(victimId)!
      expect(victimAfter.dead).toBe(true)
      expect(victimAfter.experience).toBe(950_000) // Zero XP loss on pet PvP kill!

      const earEntry = game.getGroundItems().find((g) => g.code === 'ear' && g.areaId === 2)
      expect(earEntry).toBeDefined()
      expect(earEntry!.rawItemData?.earName).toBe('AmaVictim')
      expect(earEntry!.rawItemData?.earClass).toBe(0)
      expect(earEntry!.rawItemData?.earLevel).toBe(22)

      const ownerOut = game.drainEvents(ownerId)
      const slainEv = ownerOut.find(
        (e) => e.type === 'Chat' && e.kind === 'event' && e.eventType === 0x06,
      )
      expect(slainEv).toMatchObject({
        type: 'Chat',
        kind: 'event',
        eventType: 0x06,
        color: 4,
        name1: 'AmaVictim',
        name2: 'SummonLord', // Root owner player, NOT "Clay Golem"!
      })

      // Also verify pure helper wire codecs directly
      expect(
        canLootPlayerCorpse113c({
          looterUnitId: 2,
          victimUnitId: 1,
          looterIsHardcore: true,
          victimIsHardcore: true,
          hasLootPermission: true,
        }),
      ).toBe(true)
      expect(
        buildPvpPlayerEarItemData113c({
          itemId: 500,
          victimClassId: 6,
          victimLevel: 99,
          victimName: 'ShadowMaster',
          x: 10,
          y: 20,
        }).earName,
      ).toBe('ShadowMaster')
      expect(
        buildHostileRelationEvent0x5A113c({
          actorPlayerUnitId: 1,
          actorName: 'A',
          targetName: 'B',
          hostile: false,
        }),
      ).toMatchObject({ eventType: 0x07, subType: 0x04 })
      expect(
        buildPvpSlainEvent0x5A113c({
          victimName: 'V',
          victimLevel: 50,
          victimIsHardcore: true,
          killerPlayerUnitId: 2,
          killerPlayerName: 'K',
        }),
      ).toMatchObject({ eventType: 0x06, color: 4, arg: 50 })
    })
  })
})
