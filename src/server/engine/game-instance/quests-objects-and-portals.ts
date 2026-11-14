/**
 * GameInstance Subsystem: World Object Operation, Quest Items/Rewards/Flags, Waypoints, Portals & Area Transitions (`src/server/engine/game-instance/quests-objects-and-portals.ts`).
 */

import { getEmbeddedDropTables } from '../../../common/items/embedded-drop-tables.ts'
import { ACT_SPAWN_TILE_ENTRY, ACT_SPAWN_TILE_TOWN_PORTAL } from '../../../common/world/act-spawn-location.ts'
import type { Item } from '../../../common/items/items.ts'
import { D2Common_10399_AtSubtiles } from '../../../common/path/step.ts'
import { CANONICAL_113C_OBJECTS, CANONICAL_113C_SHRINES, getShrineMeta113c, isObjectInInteractRange113c } from '../../../common/world/objects-meta.ts'
import { ONE_WAY_DOOR_OPERATE_FNS_113C, QUEST_CHEST_OPERATE_FNS_113C, classifyObjectOperate113c, computeShrineResetFrame113c, getContainerOperateDropChance113c, getObjectOperatingTicks113c } from '../../../common/world/object-operate-113c.ts'
import { PANDEMONIUM_FINALE_AREA_ID_113C } from '../../world/pandemonium-113c.ts'
import { QUEST_AREA_GATES_113C, QUEST_FLAG_COMPLETED_113C, QUEST_FLAG_COMPLETED_NOW_113C, QUEST_FLAG_CUSTOM_3_113C, QUEST_FLAG_CUSTOM_4_113C, QUEST_FLAG_CUSTOM_5_113C, QUEST_FLAG_CUSTOM_7_113C, QUEST_FLAG_CUSTOM_8_113C, QUEST_FLAG_PRIMARY_GOAL_DONE_113C, QUEST_FLAG_REWARD_PENDING_113C, QUEST_FLAG_STARTED_113C, QUEST_OBJECT_TO_QUEST_113C, clearQuestFlag113c, computeQuestStatusByte113c, computeQuestStatusBytes113c, hasQuestFlag113c, questProtocolId113c, questWordIndex113c, setQuestFlag113c } from '../quests-113c.ts'
import { rollHellforgeDrop } from '../../../common/items/drop-tables.ts'
import { canEnterPortalInPvp113c, canLootPlayerCorpse113c, canUseWaypointInPvp113c, isPlayerHardcore113c } from '../../combat/pvp-engine-113c.ts'
import { CANONICAL_CHARSTATS } from '../../../common/units/classes.ts'
import { getObjectsTxtRecord113c } from '../../../common/world/objects-txt-113c.ts'
import { findStandableNear, resolvePresetPortalDestArea113c } from '../../world/area-bootstrap.ts'
import { rollArmorStandDrop113c, rollBookshelfDrop113c, rollQuestChestBonusDrops113c, rollTrappedSoulDrops113c, rollWeaponRackDrop113c, rollWirtsBodyDrops113c } from '../../world/object-drops-113c.ts'
import { CONTAINER_OPERATE_DROP_CHANCE_113C } from '../../items/server-item-data.ts'
import { FIXED_ONE } from '../stat-list.ts'
import { TRADE_INTERACT_RANGE_SUBTILES_113C } from '../../net/trade-manager-113c.ts'
import type { GameInstanceHost } from './host.ts'
import type { AreaArrival, InternalObjectRecord, InternalPlayerRecord, LoadedAreaRecord, ServerItemEntry } from './types.ts'
import { ACT_TOWN_AREA, ACT_TOWN_AREAS, ANCIENT_BARBARIANS_113C, LEGACY_TEST_GRID_SPAWN, MAX_PLAYER_LEVEL_113C, NPC_INTERACT_DISTANCE_SUBTILES, PLAYER_SIZE_X_113C, QUEST_ITEM_EQUIVALENT_CODES_113C, QUEST_ITEM_SUPERSEDING_CODES_113C, QUEST_OBJECT_DROP_ITEM_CODE_113C, SEAL_BOSS_113C, TOWN_AREAS, WARP_INTERACT_DISTANCE_SUBTILES, WAYPOINT_AREA_IDS, WAYPOINT_INTERACT_DISTANCE_SUBTILES, areaToAct, computeObjectApproachSearchRadius113c, experienceForLevel113c, findBestInteractApproachSubTile113c, lookupBaseInfo, playerWirePosition, toItemContainer, UNIT_TYPE_113C, type UnitType113c } from './constants-and-helpers.ts'


function operateObject(this: GameInstanceHost, player: InternalPlayerRecord, obj: InternalObjectRecord): void {
  // 1.13c `D2Game.dll` `OBJECTS_OperateHandler` (`0x6FC8A330` @ `0x6FC8A394`, #1955):
  // holding an item on cursor blocks all world object operations EXCEPT Town Stash (`267`).
  if (obj.classId !== 267 && this.hasCursorItem113c(player)) return

  // Objects.txt 474/475/476 Ancient Statues (OperateFn 62/63/64, D2Game 0x6FC79A60..0x6FC79AC0):
  // clicking statues directly plays reject sound 19 and NEVER transitions mode 0 -> 2 (#1843).
  if (obj.classId === 474 || obj.classId === 475 || obj.classId === 476) {
    this.emitToPlayer(player.unitId, {
      type: 'PlaySound',
      unit: { unitType: 0, id: player.unitId },
      sound: 19,
    })
    return
  }

  // Objects.txt 546 Ancients' Altar (OperateFn 65, D2Game 0x6FC7E560 -> 0x6FC7E420):
  // requires clvl 20/40/60, closes SummitDoor 564 & any Summit Town Portals, sets Altar 546 to mode 2,
  // transitions Ancient Statues 475/476/474 to mode 4 (empty pedestal), and spawns SuperUniques 43/44/45.
  if (obj.classId === 546) {
    const requiredLevel = (this.difficulty + 1) * 20
    if (player.level < requiredLevel) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }
    if (obj.useCount === 0) {
      obj.useCount = 1
      this.setObjectMode(obj, 2)
      this.ancientDeaths.delete(obj.areaId)
      this.setPlayerQuestFlag(player, 'a5q5', QUEST_FLAG_STARTED_113C)
      // D2Game.dll 0x6FC7D0A0: close SummitDoor (564) and despawn any Town Portals in this arena.
      const ownersToClose = new Set<number>()
      for (const candidate of this.objects.values()) {
        if (candidate.areaId === obj.areaId && candidate.classId === 564 && candidate.mode !== 0) {
          this.setObjectMode(candidate, 0)
        }
        if (
          candidate.areaId === obj.areaId &&
          candidate.classId === 59 &&
          candidate.portalOwnerId !== undefined
        ) {
          ownersToClose.add(candidate.portalOwnerId)
        }
      }
      for (const [oid, oRec] of [...this.objects.entries()]) {
        if (oRec.portalOwnerId !== undefined && ownersToClose.has(oRec.portalOwnerId)) {
          this.objects.delete(oid)
          this.broadcastToArea(oRec.areaId, {
            type: 'UnitRemove',
            unitType: 2,
            id: oid,
            unitId: oid,
          })
        }
      }
      const offsets = [
        { dx: 2, dy: 0 },
        { dx: -2, dy: 0 },
        { dx: 0, dy: 2 },
      ]
      for (let i = 0; i < ANCIENT_BARBARIANS_113C.length; i++) {
        const spec = ANCIENT_BARBARIANS_113C[i]!
        let statue: InternalObjectRecord | undefined
        for (const candidate of this.objects.values()) {
          if (candidate.areaId === obj.areaId && candidate.classId === spec.statueClassId) {
            statue = candidate
            break
          }
        }
        if (statue) {
          this.setObjectMode(statue, 4)
        }
        this.spawnSuperUnique({
          superUniqueIndex: spec.superUniqueIndex,
          x: statue ? statue.x : obj.x + offsets[i]!.dx,
          y: statue ? statue.y : obj.y + offsets[i]!.dy,
          areaId: obj.areaId,
        })
      }
    }
    return
  }

  // Objects.txt 564 SummitDoor (InitFn 76 @ 0x6FC773D0, OperateFn 71 @ 0x6FC7D690, #1843, #2020):
  // locked in mode 0 while the Ancients encounter is active; otherwise opens (0 -> 1 -> 2)
  // or warps back to The Ancients' Way (Area 118) when already open (mode 2).
  if (obj.classId === 564) {
    if (this.isAncientsEncounterActive(obj.areaId)) {
      if (obj.mode !== 0) this.setObjectMode(obj, 0)
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }
    if (obj.mode === 0) {
      const gateOperatingTicks = getObjectOperatingTicks113c(564)
      this.setObjectMode(obj, 1)
      if (gateOperatingTicks > 0) {
        this.pendingObjectModeTransitions.push({
          frame: this.currentFrame + gateOperatingTicks,
          unitId: obj.unitId,
          mode: 2,
        })
      } else {
        this.setObjectMode(obj, 2)
      }
      return
    }
    if (obj.mode === 2 && this.consumeWarpCooldown(player)) {
      const destAreaId =
        obj.destAreaId ?? resolvePresetPortalDestArea113c(564, obj.areaId) ?? 118
      this.transitionPlayerArea(player, destAreaId, {
        kind: 'warp',
        fromAreaId: obj.areaId,
      })
    }
    return
  }

  // Objects.txt 547 Ancient's Way / Worldstone Keep Entrance (OperateFn 66, D2Game 0x6FC7E2E0):
  // requires A5Q5 Rite of Passage completion (bit 0 or bit 13) and no active Ancients encounter;
  // first click opens (0 -> 1 -> 2), subsequent click in mode 2 warps to Worldstone Keep L1 (128).
  if (obj.classId === 547) {
    if (
      this.isAncientsEncounterActive(obj.areaId) ||
      !hasQuestFlag113c(
        player.questFlags,
        'a5q5',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
      )
    ) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }
    if (obj.mode === 0) {
      const gateOperatingTicks = getObjectOperatingTicks113c(547)
      this.setObjectMode(obj, 1)
      if (gateOperatingTicks > 0) {
        this.pendingObjectModeTransitions.push({
          frame: this.currentFrame + gateOperatingTicks,
          unitId: obj.unitId,
          mode: 2,
        })
      } else {
        this.setObjectMode(obj, 2)
      }
      return
    }
    if (obj.mode === 2 && this.consumeWarpCooldown(player)) {
      this.transitionPlayerArea(player, obj.destAreaId ?? 128, {
        kind: 'warp',
        fromAreaId: obj.areaId,
      })
    }
    return
  }

  // Chaos Sanctuary seals (`392, 394, 396`) spawn their SuperUnique boss + minion pack on first use (#1928, #2018).
  // D2Game.dll OperateFn 54/55/56 (`0x6FCDC580`, `0x6FCDC510`, `0x6FCDC4A0`) -> `0x6FCDC050`:
  // calls `D2GAME_FindFreeCoords(..., nSize = 3, mask = 0x3F11, maxRadius = 0x64 = 100)` (`0x6FCDC0A2..0x6FCDC0BD`)
  // and aborts void placement if `pOutRoom == NULL` (e.g., North Wing West-seal DS1 where `rawX = seal.x - 39` is 33 subtiles in void).
  const sealBoss = SEAL_BOSS_113C[obj.classId]
  if (sealBoss !== undefined && obj.useCount === 0) {
    obj.useCount = 1
    const hasLoadedArea = this.loadedAreas.has(obj.areaId)
    const rawX = hasLoadedArea ? obj.x + sealBoss.dx : Math.max(2, obj.x + 2)
    const rawY = hasLoadedArea ? obj.y + sealBoss.dy : Math.max(2, obj.y)
    const stand = hasLoadedArea
      ? findStandableNear(
          (x, y) => this.isWorldWalkableForPlayer(obj.areaId, x, y),
          rawX,
          rawY,
          100,
        )
      : null
    if (!hasLoadedArea || stand !== null) {
      const sx = stand?.x ?? rawX
      const sy = stand?.y ?? rawY
      const spawnedIds = this.spawnSuperUnique({
        superUniqueIndex: sealBoss.superUniqueIndex,
        x: sx,
        y: sy,
        areaId: obj.areaId,
      })
      const bossId = spawnedIds[0]
      if (bossId !== undefined) {
        const bossRec = this.monsters.get(bossId)
        this.broadcastToArea(obj.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: bossId,
          mode: 1,
          at: { x: Math.round(bossRec?.x ?? sx), y: Math.round(bossRec?.y ?? sy) },
          lifePct: 128,
        })
      }
    }
  }

  // Objects.txt 376 Hellforge (OperateFn 49, D2Game 0x6fcdb8d0):
  // 1. If a4q2 already has bit 0 (0x0001 COMPLETED) or bit 1 (0x0002 REWARD_PENDING) set, no-op (0x6fcdb92d..0x6fcdb952).
  // 2. Stage 1 (wForgeMode == 0 / obj.mode === 0, 0x6fcdbaf8..0x6fcdbb78): requires Mephisto's Soulstone ('mss '),
  //    removes 'mss ', sets obj.mode = 1 (0x6fcdbb16) and wForgeMode = 2 (0x6fcdbb4b).
  // 3. Stage 2 (wForgeMode == 2 / obj.mode === 1 || obj.mode === 2, 0x6fcdb988..0x6fcdbae7): requires equipped
  //    Hellforge Hammer ('hfh '), increments game-level hit counter (3 hits total; <= 2 returns at 0x6fcdb9e6).
  //    On 3rd hit (> 2), sets obj.mode = 3 (0x6fcdb9ee), removes 'hfh ' (0x6fcdba03), sets a4q2 to
  //    QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C (0x2002, bits 1 & 13, 0x6fcdba14..0x6fcdba25),
  //    triggers specialEventId 14 (0x6fcdbae7), and rolls/spawns the Hellforge rune + 4 gems drop.
  if (obj.classId === 376) {
    if (
      hasQuestFlag113c(
        player.questFlags,
        'a4q2',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      )
    ) {
      return
    }
    if (obj.mode === 0) {
      const soulstone = player.items.find(
        (item) => item.code.toLowerCase().trim() === 'mss',
      )
      if (soulstone === undefined) return
      this.removePlayerQuestItem(player, soulstone)
      this.hellforgeState = 2
      this.hellforgeHits = 0
      obj.useCount = 0
      this.setObjectMode(obj, 1)
      return
    }
    if (obj.mode === 1 || obj.mode === 2 || (this.hellforgeState === 2 && obj.mode !== 3)) {
      const hammer = player.items.find(
        (item) => item.location === 'equipped' && item.code.toLowerCase().trim() === 'hfh',
      )
      if (hammer === undefined) return
      const nextHits =
        (obj.useCount === this.hellforgeHits ? this.hellforgeHits : obj.useCount) + 1
      this.hellforgeHits = nextHits
      obj.useCount = nextHits
      if (this.hellforgeHits <= 2) return
      this.hellforgeState = 3
      this.setObjectMode(obj, 3)
      this.removePlayerQuestItem(player, hammer)
      const partyCandidates = this.getQuestEligiblePartyRecipients113c(player, obj.areaId, {
        includeSameActTown: false,
      })
      const eligibleRecipients: InternalPlayerRecord[] = []
      for (const candidate of partyCandidates) {
        if (
          hasQuestFlag113c(
            candidate.questFlags,
            'a4q2',
            QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
          )
        ) {
          continue
        }
        eligibleRecipients.push(candidate)
      }
      if (
        eligibleRecipients.length === 0 &&
        !hasQuestFlag113c(
          player.questFlags,
          'a4q2',
          QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
        )
      ) {
        eligibleRecipients.push(player)
      }
      for (const recipient of eligibleRecipients) {
        this.setPlayerQuestFlag(
          recipient,
          'a4q2',
          QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C,
        )
        for (const extraStone of recipient.items.filter(
          (it) => it.code.toLowerCase().trim() === 'mss',
        )) {
          this.removePlayerQuestItem(recipient, extraStone)
        }
        if (recipient.unitId !== player.unitId) {
          this.emitToPlayer(recipient.unitId, {
            type: 'QuestState',
            kind: 'special',
            source: 0x89,
            quests: new Uint16Array(recipient.questFlags),
            specialEventId: 14,
          })
        }
      }
      this.emitToPlayer(player.unitId, {
        type: 'QuestState',
        kind: 'special',
        source: 0x89,
        quests: new Uint16Array(player.questFlags),
        specialEventId: 14,
      })
      // 1.13c `D2Game.dll` `a4q2.cpp` (`0x6FCDB6E4..0x6FCDB8C0` / `0x6FCDBE70`, #1962):
      // scales gem sets by eligible same-area party count `N` (`N` normal + `2N` flawless + `N` perfect)
      // while keeping `1` difficulty rune, staggering drops across 4 x 20-frame `Event 7` beats.
      const difficulty =
        this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal'
      const partyCount = Math.max(1, eligibleRecipients.length)
      const tables = getEmbeddedDropTables()
      const normalGems: Item[] = []
      const flawlessGems: Item[] = []
      const perfectGems: Item[] = []
      let runeItem: Item | undefined
      for (let i = 0; i < partyCount; i++) {
        const drop = rollHellforgeDrop(difficulty, this.rng, tables)
        if (i === 0) {
          runeItem = drop.rune
        }
        normalGems.push(drop.normalGem)
        flawlessGems.push(drop.flawlessGems[0], drop.flawlessGems[1])
        perfectGems.push(drop.perfectGem)
      }
      this.pendingHellforgeDrops.push(
        { frame: this.currentFrame + 20, areaId: obj.areaId, x: obj.x, y: obj.y, items: normalGems },
        { frame: this.currentFrame + 40, areaId: obj.areaId, x: obj.x, y: obj.y, items: flawlessGems },
        { frame: this.currentFrame + 60, areaId: obj.areaId, x: obj.x, y: obj.y, items: perfectGems },
        ...(runeItem !== undefined
          ? [{ frame: this.currentFrame + 80, areaId: obj.areaId, x: obj.x, y: obj.y, items: [runeItem] }]
          : []),
      )
    }
    return
  }

  // Objects.txt 404 Compelling Orb (D2Game OperateFn 53 @ 0x6fd0a140): requires Khalim's
  // Will ('qf2 ') and two hits before the orb breaks.
  if (obj.classId === 404) {
    if (obj.mode !== 0) return
    const flail = player.items.find(
      (item) => item.location === 'equipped' && item.code.toLowerCase().trim() === 'qf2',
    )
    if (flail === undefined) {
      return
    }
    obj.useCount += 1
    if (obj.useCount < 2) return
    const flailDeletedBase = this.serverEntryToItemData(flail)
    const flailDeletedFlags = ((flailDeletedBase.rawFlags ?? 0x10) | 0x20) >>> 0
    player.items = player.items.filter((item) => item !== flail)
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'remove',
      itemId: flail.unitId,
      code: flail.code,
      container: 'equipment',
      item: {
        ...flailDeletedBase,
        flags: flailDeletedFlags,
        rawFlags: flailDeletedFlags,
      },
    })
    for (const recipient of this.getQuestEligiblePartyRecipients113c(player, obj.areaId)) {
      this.setPlayerQuestFlag(
        recipient,
        'a3q3',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
      )
      // 1.13c ACT3Q3_OperateCompellingOrb (`D2Game.dll` `0x6FD0A1EE..0x6FD0A262`, #1984 / #1998):
      // smashing Compelling Orb (`404`) sets `0x2001` (`COMPLETED | COMPLETED_NOW`) and also completes `a3q5`.
      if (!hasQuestFlag113c(recipient.questFlags, 'a3q5', QUEST_FLAG_COMPLETED_113C)) {
        this.setPlayerQuestFlag(
          recipient,
          'a3q5',
          QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
        )
      }
    }
    // Kill the invisible MonStats 366 compellingorb monster in MONMODE_DEATH (0) so
    // D2Client MonUMod 22 event 1 (0x6fad0fb0 -> 0x6fb030d0) spawns the client orbmist.
    const orbMonster =
      (obj.linkedMonsterId !== undefined ? this.monsters.get(obj.linkedMonsterId) : undefined) ??
      [...this.monsters.values()].find(
        (m) => m.areaId === obj.areaId && m.classId === 366 && !m.dead,
      )
    if (orbMonster !== undefined && !orbMonster.dead) {
      orbMonster.dead = true
      orbMonster.hp = 0
      orbMonster.mode = 0
      this.broadcastToArea(obj.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: orbMonster.unitId,
        mode: 0,
        at: { x: Math.round(orbMonster.x), y: Math.round(orbMonster.y) },
        lifePct: 0,
      })
    }
    // Enter OBJMODE_OPERATING (1) so client plays the 29-frame smash animation + sound,
    // then settle into OBJMODE_OPENED (2) after FrameCnt1 (29) at FrameDelta1 (128) = 58 ticks.
    const orbOperatingTicks = getObjectOperatingTicks113c(404)
    this.setObjectMode(obj, 1)
    this.pendingObjectModeTransitions.push({
      frame: this.currentFrame + orbOperatingTicks,
      unitId: obj.unitId,
      mode: 2,
    })
    // Server-side orbmist (Missiles.txt 368: Vel = 2 -> 3/32 sub-tiles/tick, Range = 400):
    // when it hits Durance of Hate Stairs (Objects.txt 386), SrvHitFunc 35 (0x6fc5e670)
    // sets stairs to OBJMODE_OPERATING (1) for its FrameCnt1 (9) / FrameDelta1 (120) = 19 ticks
    // opening animation before settling into OBJMODE_OPENED (2).
    const orbMistMeta = this.registry.getMissileById(368)
    const orbMistRange = orbMistMeta?.range ?? 400
    const stairsOperatingTicks = getObjectOperatingTicks113c(386)
    for (const stairs of this.objects.values()) {
      if (stairs.areaId !== obj.areaId || stairs.classId !== 386 || stairs.mode !== 0) continue
      const dist = Math.hypot(stairs.x - obj.x, stairs.y - obj.y)
      const mistFrames = Math.max(1, Math.min(orbMistRange, Math.round(dist / (3 / 32))))
      this.pendingObjectModeTransitions.push(
        {
          frame: this.currentFrame + mistFrames,
          unitId: stairs.unitId,
          mode: 1,
        },
        {
          frame: this.currentFrame + mistFrames + stairsOperatingTicks,
          unitId: stairs.unitId,
          mode: 2,
        },
      )
    }
    this.emitToPlayer(player.unitId, {
      type: 'QuestState',
      kind: 'special',
      source: 0x89,
      quests: new Uint16Array(player.questFlags),
      specialEventId: 10,
    })
    return
  }
  // Objects.txt 367 Kurast Sewers Lever (D2Game OperateFn 45 @ 0x6FD09F60, #1983):
  // Operates only in mode === 0; transitions lever 0 -> 1 -> 2 (32 ticks) and schedules +30 ticks (0x1E,
  // timer 0x6FC559C0) to open Sewer Stairs (Objects.txt 366) 0 -> 1 -> 2 (34 ticks) + S2C 0x89 specialEventId 9.
  if (obj.classId === 367) {
    if (obj.mode !== 0) return
    const leverTicks = getObjectOperatingTicks113c(367)
    this.setObjectMode(obj, 1)
    if (leverTicks > 0) {
      this.pendingObjectModeTransitions.push({
        frame: this.currentFrame + leverTicks,
        unitId: obj.unitId,
        mode: 2,
      })
    } else {
      this.setObjectMode(obj, 2)
    }
    const stairsTicks = getObjectOperatingTicks113c(366)
    for (const stairs of this.objects.values()) {
      if (stairs.areaId !== obj.areaId || stairs.classId !== 366 || stairs.mode !== 0) continue
      this.pendingObjectModeTransitions.push(
        {
          frame: this.currentFrame + 30,
          unitId: stairs.unitId,
          mode: 1,
        },
        {
          frame: this.currentFrame + 30 + Math.max(1, stairsTicks),
          unitId: stairs.unitId,
          mode: 2,
        },
      )
    }
    this.emitToPlayer(player.unitId, {
      type: 'QuestState',
      kind: 'special',
      source: 0x89,
      quests: new Uint16Array(player.questFlags),
      specialEventId: 9,
    })
    return
  }
  // Objects.txt 366 Kurast Sewers Stairs (D2Game OperateFn 44 @ 0x6FD095E0, #1983):
  // Sealed (mode !== 2) ignores interaction; once opened (mode === 2), warps to Sewers Level 2 (93).
  if (obj.classId === 366) {
    if (obj.mode !== 2) return
    const destArea = obj.destAreaId ?? resolvePresetPortalDestArea113c(366, obj.areaId) ?? 93
    if (this.consumeWarpCooldown(player)) {
      this.transitionPlayerArea(player, destArea, { kind: 'warp', fromAreaId: obj.areaId })
    }
    return
  }
  // Objects.txt 386 Durance of Hate Stairs (D2Game OperateFn 50 @ 0x6fc8f4f0):
  // sealed (mode !== 2) ignores interaction; once opened (mode === 2), warps to destAreaId.
  if (obj.classId === 386) {
    if (obj.mode !== 2) return
    if (obj.destAreaId !== undefined && this.consumeWarpCooldown(player)) {
      this.transitionPlayerArea(player, obj.destAreaId, { kind: 'warp', fromAreaId: obj.areaId })
    }
    return
  }
  // Objects.txt 563 & 569 Worldstone Chamber / Throne of Destruction Portals (D2Game OperateFn 70 @ 0x6FC7DF70, #1983):
  // 563 requires mode === 2 (opened when #559 baalcrabstairs retreats) and calls LEVEL_WarpUnit(..., 132, 11);
  // 569 spawns in mode === 2 (InitFn 75 @ 0x6FC76520) and calls LEVEL_WarpUnit(..., 131, 0).
  if (obj.classId === 563 || obj.classId === 569) {
    if (obj.mode !== 2) return
    const destArea =
      obj.destAreaId ?? resolvePresetPortalDestArea113c(obj.classId, obj.areaId) ?? (obj.classId === 563 ? 132 : 131)
    if (!this.playerCanEnterArea(player, destArea)) {
      this.notifyAreaTransitionFailure(player, destArea)
      return
    }
    if (this.consumeWarpCooldown(player)) {
      this.transitionPlayerArea(player, destArea, {
        kind: 'levelSpawn',
        tileIndex: obj.classId === 563 ? ACT_SPAWN_TILE_TOWN_PORTAL : ACT_SPAWN_TILE_ENTRY,
        fallbackFromAreaId: obj.areaId,
      })
    }
    return
  }
  // Objects.txt 565 LastPortal ("Destruction's End", D2Game OperateFn 72 @ 0x6fc7fd00):
  // Requires mode === 2 (OBJMODE_OPENED) and A5Q6 completion (bit 0 or bit 13); otherwise
  // attaches reject sound 19 (0x13) and returns. On success: warps player to Harrogath (109),
  // sets bit 10 (0x0400) on a5q6, and sends S2C 0x61 07 (CanGoToAct { act: 7 }).
  if (obj.classId === 565) {
    if (obj.mode !== 2) return
    if (
      !hasQuestFlag113c(
        player.questFlags,
        'a5q6',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
      )
    ) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }
    this.transitionPlayerArea(player, 109, { kind: 'townPortal' })
    this.setPlayerQuestFlag(player, 'a5q6', 0x0400)
    this.emitToPlayer(player.unitId, { type: 'CanGoToAct', act: 7 })
    return
  }
  // Objects.txt 566 Harrogath portal (D2Game OperateFn 73 @ 0x6fcdb550):
  // Requires mode === 2 (OBJMODE_OPENED) and A4Q3 completion (bit 0 or bit 13); otherwise
  // attaches reject sound 19 (0x13) and returns. On success: unlocks Act 5 + Harrogath WP 109,
  // sends S2C 0x61 05 (CanGoToAct { act: 5 }), and warps player to Harrogath (109).
  if (obj.classId === 566) {
    if (obj.mode !== 2) return
    if (
      !hasQuestFlag113c(
        player.questFlags,
        'a4q3',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
      )
    ) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }
    player.unlockedAct = Math.max(player.unlockedAct, 4)
    player.waypoints.add(109)
    this.emitToPlayer(player.unitId, { type: 'CanGoToAct', act: 5 })
    this.transitionPlayerArea(player, 109, { kind: 'townPortal' })
    return
  }
  // Objects.txt 342 Mephisto Hellgate (D2Game OperateFn 46 @ 0x6FC8CD40, #1836):
  // Requires mode === 2 (opened on Mephisto death) and A3Q6 completion; unlocks Act 4 + WP 103
  // and warps player + followers to Pandemonium Fortress (103).
  if (obj.classId === 342) {
    if (
      obj.mode !== 2 ||
      !hasQuestFlag113c(
        player.questFlags,
        'a3q6',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
      )
    ) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }
    player.unlockedAct = Math.max(player.unlockedAct, 3)
    player.waypoints.add(103)
    this.emitToPlayer(player.unitId, { type: 'CanGoToAct', act: 4 })
    this.transitionPlayerArea(player, obj.destAreaId ?? 103, { kind: 'townPortal' })
    return
  }
  // Objects.txt 298 Arcane Sanctuary Portal (D2Game OperateFn 34 @ 0x6FC8D620, #1835 / #1983):
  // Sets both paired 298 portals to mode 2 ([pQuestData+0x42/+0x44] = 2), then calls LEVEL_WarpUnit:
  // 54 -> 74 uses nTileIndex = 11 (ACT_SPAWN_TILE_TOWN_PORTAL, 0x6FC8D6E7);
  // 74 -> 54 uses nTileIndex = 0 (ACT_SPAWN_TILE_ENTRY, 0x6FC8D684).
  if (obj.classId === 298) {
    const destArea = obj.destAreaId ?? resolvePresetPortalDestArea113c(298, obj.areaId) ?? 74
    if (!this.playerCanEnterArea(player, destArea)) {
      this.notifyAreaTransitionFailure(player, destArea)
      return
    }
    if (obj.mode === 0) {
      this.setObjectMode(obj, 1)
      this.setObjectMode(obj, 2)
    }
    if (this.consumeWarpCooldown(player)) {
      const moved = this.transitionPlayerArea(player, destArea, {
        kind: 'levelSpawn',
        tileIndex: destArea === 74 ? ACT_SPAWN_TILE_TOWN_PORTAL : ACT_SPAWN_TILE_ENTRY,
        fallbackFromAreaId: obj.areaId,
      })
      if (moved) {
        for (const other of this.objects.values()) {
          if (other.areaId === destArea && other.classId === 298 && other.mode === 0) {
            this.setObjectMode(other, 2)
          }
        }
      }
    }
    return
  }
  const record = getObjectsTxtRecord113c(obj.classId)
  // 1.13c `D2Game.dll` `OBJECTS_OperateHandler` (`0x6FC8A330`): `gpObjectOperateFnTable[0]` is NULL,
  // so scripted/decorative objects with `OperateFn === 0` (such as `Objects.txt 153` Tyrael's Door)
  // cannot be operated by player click (#1982).
  if (record.operateFn === 0 && QUEST_OBJECT_TO_QUEST_113C[obj.classId] === undefined) return
  // Objects.txt 192, 304..306 Arcane Sanctuary Teleportation Pad (D2Game OperateFn 27 @ 0x6FC8BE40, #1835):
  // Re-usable paired pad teleporting the player, mercenaries, and mobile summons to the nearest matching pad.
  if (record.operateFn === 27) {
    let bestOther: InternalObjectRecord | undefined
    let bestDistSq = Number.POSITIVE_INFINITY
    for (const candidate of this.objects.values()) {
      if (
        candidate.unitId === obj.unitId ||
        candidate.areaId !== obj.areaId ||
        candidate.classId !== obj.classId
      ) {
        continue
      }
      const dSq = (candidate.x - obj.x) ** 2 + (candidate.y - obj.y) ** 2
      if (dSq < bestDistSq) {
        bestDistSq = dSq
        bestOther = candidate
      }
    }
    if (bestOther !== undefined && this.consumeWarpCooldown(player)) {
      this.setObjectMode(obj, 1)
      this.setObjectMode(obj, 2)
      this.setObjectMode(bestOther, 1)
      this.setObjectMode(bestOther, 2)
      const stand = this.loadedAreas.has(player.areaId)
        ? findStandableNear(
            (x, y) => this.isWorldWalkableForPlayer(player.areaId, x, y),
            bestOther.x,
            bestOther.y,
            6,
          )
        : null
      const destX = stand?.x ?? bestOther.x
      const destY = stand?.y ?? bestOther.y
      this.movePlayer(player.unitId, destX, destY)
      this.activatePresetRoomsNearPlayer113c(player)
      this.streamWildernessRoomsForPlayer(player)
      this.revealAreaRoomsNearPlayer(player, true)
      this.emitToPlayer(player.unitId, {
        type: 'UnitReassign',
        unitType: 0,
        id: player.unitId,
        unitId: player.unitId,
        at: playerWirePosition(player),
        x: player.x,
        y: player.y,
        snap: true,
        areaId: player.areaId,
      })
      this.relocatePlayerFollowersToPlayer(player, true)
    }
    return
  }
  const kind = classifyObjectOperate113c(obj.classId)
  if (kind === 'door') {
    if (ONE_WAY_DOOR_OPERATE_FNS_113C.has(record.operateFn)) {
      if (obj.mode !== 0) return
      this.setObjectMode(obj, 2)
      return
    }
    if (obj.mode === 2 && this.isDoorBlockedByUnit113c(obj)) {
      return
    }
    this.setObjectMode(obj, obj.mode === 2 ? 0 : 2)
    return
  }
  if (kind === 'shrine') {
    if (obj.mode !== 0) return
    const shrineMeta = CANONICAL_113C_SHRINES[obj.shrineType] ?? getShrineMeta113c(obj.shrineType)
    this.setObjectMode(obj, 1)
    this.applyShrineEffect(player, obj.shrineType, obj.unitId)
    this.setObjectMode(obj, 2)
    obj.shrineResetFrame = computeShrineResetFrame113c(obj.shrineType, this.currentFrame)
    this.emitToPlayer(player.unitId, {
      type: 'Chat',
      kind: 'system',
      text: `${shrineMeta.name}: ${shrineMeta.phrase}`,
    })
    return
  }
  // Stash is re-usable in 1.13c (ONLY Objects.txt 267, OperateFn 32 @ 0x6FC91290, #1834).
  if (kind === 'stash') {
    this.emitToPlayer(player.unitId, { type: 'Trade', action: 0x10 })
    return
  }
  if (kind === 'well') {
    this.operateWell113c(player, obj)
    return
  }
  // Objects.txt 194, 195 Stair (D2Game OperateFn 47 @ 0x6FC8DFC0, #1983):
  // First click in mode 0 opens 0 -> 1 -> 2; subsequent click in mode 2 warps via destAreaId or nearest warpTile.
  if (record.operateFn === 47) {
    if (obj.mode === 0) {
      const stairTicks = getObjectOperatingTicks113c(obj.classId)
      this.setObjectMode(obj, 1)
      if (stairTicks > 0) {
        this.pendingObjectModeTransitions.push({
          frame: this.currentFrame + stairTicks,
          unitId: obj.unitId,
          mode: 2,
        })
      } else {
        this.setObjectMode(obj, 2)
      }
      return
    }
    if (obj.mode === 2) {
      let destArea = obj.destAreaId
      if (destArea === undefined) {
        let bestDistSq = Number.POSITIVE_INFINITY
        for (const tile of this.warpTiles.values()) {
          if (tile.areaId !== obj.areaId) continue
          const dSq = (tile.x - obj.x) ** 2 + (tile.y - obj.y) ** 2
          if (dSq < bestDistSq) {
            bestDistSq = dSq
            destArea = tile.destAreaId
          }
        }
      }
      if (destArea !== undefined && this.consumeWarpCooldown(player)) {
        this.transitionPlayerArea(player, destArea, { kind: 'warp', fromAreaId: obj.areaId })
      }
    }
    return
  }
  // Portal objects (`kind === 'portal'`) must never fall through into the generic container drop path (#1983).
  if (kind === 'portal') return
  if (obj.mode !== 0) return

  // D2Game.dll OBJECTS_Operate04_Chest (0x6FC8F040 @ 0x6FC8F083, #1832):
  // Key check & consumption ONLY runs on OperateFn === 4 non-sparkling locked chests,
  // and Assassin (classId === 6 / 'ass') bypasses key consumption (0x6FC8F08B).
  let unlockedChestThisOperate = false
  if (record.operateFn === 4 && !obj.isSparkling && obj.isLocked) {
    const isAssassin = player.classId === 6 || player.classCode === 'ass'
    if (!isAssassin && !this.consumeKey(player)) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 22,
      })
      this.emitToPlayer(player.unitId, { type: 'Chat', kind: 'system', text: 'Locked' })
      return
    }
    unlockedChestThisOperate = true
    this.emitToPlayer(player.unitId, {
      type: 'PlaySound',
      unit: { unitType: 0, id: player.unitId },
      sound: 11,
    })
  }
  // Objects.txt 152 Horadric Orifice (OperateFn 25, D2Game 0x6fce6240, #1961):
  // requires assembled Horadric Staff ('hst' ONLY — rejects incomplete 'msf' / 'vip'),
  // emitting cant-use sound 19 (0x6fce6318) and keeping mode 0.
  if (obj.classId === 152) {
    const hasFullStaff = player.items.some(
      (item) => item.code.toLowerCase().trim() === 'hst',
    )
    if (!hasFullStaff) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }
  }
  // Objects.txt 558 Frozen Anya (OperateFn 67, D2Game 0x6fc7cd50, #2019):
  // without Malah's Potion ('ice'), records Frozen Anya discovered (`CUSTOM_4` = `0x0010`, status 3 `qstsa5q32` "Talk to Malah."),
  // emits A5Q3FoundAnyaAnya (20131), and keeps mode 0 so she can be thawed after receiving 'ice' from Malah (513).
  if (obj.classId === 558) {
    if (
      hasQuestFlag113c(
        player.questFlags,
        'a5q3',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      )
    ) {
      return
    }
    const hasPotion = player.items.some(
      (item) => item.code.toLowerCase().trim() === 'ice',
    )
    if (!hasPotion) {
      for (const recipient of this.getQuestEligiblePartyRecipients113c(player, obj.areaId)) {
        if (
          hasQuestFlag113c(
            recipient.questFlags,
            'a5q3',
            QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
          )
        ) {
          continue
        }
        this.setPlayerQuestFlag(
          recipient,
          'a5q3',
          QUEST_FLAG_STARTED_113C | QUEST_FLAG_CUSTOM_4_113C,
        )
      }
      // D2Game.dll 0x6fc7cdae..0x6fc7cdb3: QUESTS_NPCMessage(pGame, pPlayer, pObject, 0x4EA3) -> 20131 (A5Q3FoundAnyaAnya)
      this.emitToPlayer(player.unitId, {
        type: 'Npc',
        kind: 'info',
        unitType: 2,
        npcId: obj.unitId,
        unitId: obj.unitId,
        count: 1,
        messages: [{ menu: 0, stringId: 20131 }],
        allMessages: [{ menu: 0, stringId: 20131 }],
      })
      return
    }
  }
  // Objects.txt 17..21 Cairn Stones (OperateFn 9, D2Game 0x6FC9CB50, #1926):
  // Requires deciphered Scroll of Inifuss (`'bkd'`) in `player.items` and activating all 5
  // distinct Cairn Stones before opening Tristram red portal (`Objects.txt 60`, `destAreaId 38`).
  // If `'bkd'` is missing, plays reject sound 19 and leaves the stone unlit (`mode 0`).
  // If a stone is touched out of `this.cairnStoneOrder` sequence, resets the partial sequence
  // ONLY when all 5 distinct stones `17..21` exist in the area; otherwise requires activating
  // all 5 distinct stones `17..21` with `'bkd'`!
  if (obj.classId >= 17 && obj.classId <= 21) {
    if (this.cairnPortalAreas.has(obj.areaId)) return
    const keyScroll = player.items.find(
      (item) => item.code.toLowerCase().trim() === 'bkd',
    )
    if (keyScroll === undefined) {
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }
    const areaStones = [...this.objects.values()].filter(
      (candidate) =>
        candidate.areaId === obj.areaId && candidate.classId >= 17 && candidate.classId <= 21,
    )
    const distinctPresent = new Set(areaStones.map((s) => s.classId))
    const step = this.cairnStoneStepByArea.get(obj.areaId) ?? 0
    const expectedClassId = this.cairnStoneOrder[step]
    if (distinctPresent.size >= 5 && expectedClassId !== undefined && obj.classId !== expectedClassId) {
      // Out-of-order Cairn Stone touch: reset active stones back to mode 0 so the player can retry.
      this.cairnStoneStepByArea.set(obj.areaId, 0)
      for (const s of areaStones) {
        s.useCount = 0
        if (s.mode !== 0) this.setObjectMode(s, 0)
      }
      this.emitToPlayer(player.unitId, {
        type: 'PlaySound',
        unit: { unitType: 0, id: player.unitId },
        sound: 19,
      })
      return
    }
    this.setObjectMode(obj, 1)
    this.setObjectMode(obj, 2)
    obj.useCount = 1
    this.setPlayerQuestFlag(player, 'a1q3', QUEST_FLAG_STARTED_113C)
    const nextStep = step + 1
    this.cairnStoneStepByArea.set(obj.areaId, nextStep)
    const activatedClasses = new Set(
      [...this.objects.values()]
        .filter(
          (candidate) =>
            candidate.areaId === obj.areaId &&
            candidate.classId >= 17 &&
            candidate.classId <= 21 &&
            candidate.useCount > 0 &&
            candidate.mode === 2,
        )
        .map((s) => s.classId),
    )
    if (activatedClasses.size >= 5 && !this.cairnPortalAreas.has(obj.areaId)) {
      this.cairnPortalAreas.add(obj.areaId)
      this.removePlayerQuestItem(player, keyScroll)
      const anchor = areaStones[0] ?? obj
      const hasLoadedArea = this.loadedAreas.has(obj.areaId)
      const stand = hasLoadedArea
        ? findStandableNear(
            (x, y) => this.isWorldWalkableForPlayer(obj.areaId, x, y),
            anchor.x + 2,
            anchor.y,
            100,
          )
        : null
      if (!hasLoadedArea || stand !== null) {
        this.spawnObject({
          classId: 60,
          x: stand?.x ?? anchor.x + 2,
          y: stand?.y ?? anchor.y,
          areaId: obj.areaId,
          mode: 2,
          destAreaId: 38,
        })
      }
    }
    return
  }
  this.setObjectMode(obj, 1)
  switch (kind) {
    case 'trap':
      this.operateTrapObject113c(player, obj)
      break
    case 'destructible': {
      if (record.operateFn === 7) {
        this.detonateExplodingBarrel113c(obj, player)
      } else if (
        record.operateFn === 5 &&
        this.rng.rand(10_000) < 1808 &&
        this.spawnContainerAmbushMonster113c(obj) !== undefined
      ) {
        // #1918: Barrel (OperateFn 5, 0x6FC8B150) 18.08% monster ambush replaces item drop.
      } else {
        const dropChance =
          CONTAINER_OPERATE_DROP_CHANCE_113C[record.operateFn] ??
          getContainerOperateDropChance113c(record.operateFn)
        this.rollContainerDrop(player, obj, dropChance)
      }
      break
    }
    case 'container': {
      if (obj.trapType > 0) {
        this.triggerContainerTrap113c(player, obj)
      }
      if (record.operateFn === 19) {
        // #1837: Armor Stand (0x6FC8B2E0 -> 0x6FC31FB0)
        const dropped = rollArmorStandDrop113c({
          areaId: obj.areaId,
          difficulty: this.difficulty,
          playerMf: this.sumPlayerItemStat(player, 80),
          rng: this.rng,
          spawnedUniqueIds: this.spawnedUniqueIds,
        })
        if (dropped.length > 0) this.spawnDroppedItems(dropped, obj.areaId, obj.x, obj.y)
      } else if (record.operateFn === 20) {
        // #1837: Weapon Rack (0x6FC8B280 -> 0x6FC31E20 + D2Common.#10731 metal check)
        const dropped = rollWeaponRackDrop113c({
          areaId: obj.areaId,
          difficulty: this.difficulty,
          playerMf: this.sumPlayerItemStat(player, 80),
          rng: this.rng,
          spawnedUniqueIds: this.spawnedUniqueIds,
        })
        if (dropped.length > 0) this.spawnDroppedItems(dropped, obj.areaId, obj.x, obj.y)
      } else if (record.operateFn === 26) {
        // #1837: Monastery Bookshelf (0x6FC8B340)
        const dropped = rollBookshelfDrop113c(obj.areaId, this.difficulty, this.rng)
        if (dropped.length > 0) this.spawnDroppedItems(dropped, obj.areaId, obj.x, obj.y)
      } else if (record.operateFn === 33) {
        // #1839: Tristram Wirt's Body 268 (0x6FC8D960 -> 'leg' + 15 gold piles)
        const includeLeg = !this.playerOrGroundHasQuestItem(player, 'leg')
        const dropped = rollWirtsBodyDrops113c(
          obj.areaId,
          this.difficulty,
          this.sumPlayerItemStat(player, 79),
          includeLeg,
          this.rng,
        )
        if (dropped.length > 0) this.spawnDroppedItems(dropped, obj.areaId, obj.x, obj.y)
      } else if (QUEST_CHEST_OPERATE_FNS_113C.has(record.operateFn)) {
        // #1833: Act 2 & Act 3 Quest Chests (5..9 gold piles + forced-Magic Chest TC drop)
        const dropped = rollQuestChestBonusDrops113c({
          areaId: obj.areaId,
          difficulty: this.difficulty,
          gamePlayers: this.playersX,
          partyPlayers: this.countPartyPlayersInArea(player, obj.areaId),
          playerMf: this.sumPlayerItemStat(player, 80),
          playerGf: this.sumPlayerItemStat(player, 79),
          rng: this.rng,
          spawnedUniqueIds: this.spawnedUniqueIds,
        })
        if (dropped.length > 0) this.spawnDroppedItems(dropped, obj.areaId, obj.x, obj.y)
      } else if (record.operateFn === 48) {
        // #1957: Act 4 Trapped Soul 380/381 (0x6FC8CE10 -> 1..2 healing/mana potions or gold piles, NEVER Act 4 Chest TC)
        const dropped = rollTrappedSoulDrops113c(
          obj.areaId,
          this.difficulty,
          this.sumPlayerItemStat(player, 79),
          this.rng,
        )
        if (dropped.length > 0) this.spawnDroppedItems(dropped, obj.areaId, obj.x, obj.y)
      } else if (record.operateFn === 68) {
        // #1838: Act 5 Evil Urn 466 (0x6FC8EDB0 -> 100% Chest TC + Unique/Champion pack)
        this.rollContainerDrop(player, obj, 100)
        this.spawnEvilUrnAmbush113c(obj)
      } else if (
        record.operateFn === 1 &&
        this.rng.rand(10_000) < 1808 &&
        this.spawnContainerAmbushMonster113c(obj) !== undefined
      ) {
        // #1918: Sarcophagus / Casket (OperateFn 1, 0x6FC8AEF0) 18.08% monster ambush replaces item drop.
      } else {
        // #1834: includes OperateFn 51 (Act 3 Jungle Stash 185..188 -> 75% Chest TC)
        const dropChance = getContainerOperateDropChance113c(record.operateFn)
        this.rollContainerDrop(player, obj, dropChance)
      }
      break
    }
    default:
      break
  }
  if (unlockedChestThisOperate) {
    obj.isLocked = false
  }
  this.setObjectMode(obj, 2)
  this.advanceQuestObject(player, obj)
}



function getEquivalentQuestItemCodes(this: GameInstanceHost, code: string): readonly string[] {
  const clean = code.trim().toLowerCase()
  return QUEST_ITEM_SUPERSEDING_CODES_113C[clean] ?? [clean]
}



/**
 * 1.13c `ITEMS_CheckQuestItemPickup` (`D2Game.dll` @ `0x6fcf2f00`):
 * all quest items (`ItemsTxt.nQuest != 0`, except `leg` which is explicitly exempted)
 * enforce one-per-player ownership and post-quest pickup gates.
 */
function isOnePerPlayerQuestItem(this: GameInstanceHost, code: string): boolean {
  const clean = code.trim().toLowerCase()
  if (clean === 'leg') return false
  return (
    lookupBaseInfo(clean).quest ||
    QUEST_ITEM_EQUIVALENT_CODES_113C[clean] !== undefined ||
    QUEST_ITEM_SUPERSEDING_CODES_113C[clean] !== undefined
  )
}



function resolveCarry1UniqueId113c(this: GameInstanceHost, item: ServerItemEntry): number | undefined {
  if (item.quality !== 7) return undefined
  const tables = getEmbeddedDropTables()
  const explicitId = item.rawItemData?.uniqueItemId
  if (explicitId !== undefined) {
    const def = tables.uniques.getById(explicitId)
    return def?.carry1 ? def.id : undefined
  }
  const candidates = tables.uniques.getEnabledByCode(item.code.trim().toLowerCase())
  if (candidates.length === 1 && candidates[0]!.carry1) {
    return candidates[0]!.id
  }
  return undefined
}



function playerHasQuestItem(this: GameInstanceHost, player: InternalPlayerRecord, code: string): boolean {
  const superseding = this.getEquivalentQuestItemCodes(code)
  return player.items.some((item) => {
    if (item.location === 'vendor') return false
    const clean = item.code.trim().toLowerCase()
    if (!superseding.includes(clean)) return false
    if (item.stats.has(356) && clean !== 'box' && (item.stats.get(356) ?? this.difficulty) < this.difficulty) {
      return false
    }
    return true
  })
}



function playerOrGroundHasQuestItem(this: GameInstanceHost, player: InternalPlayerRecord, code: string): boolean {
  if (this.playerHasQuestItem(player, code)) return true
  const superseding = this.getEquivalentQuestItemCodes(code)
  for (const gItem of this.groundItems.values()) {
    if (gItem.areaId === player.areaId && superseding.includes(gItem.code.trim().toLowerCase())) {
      return true
    }
  }
  return false
}



/**
 * 1.13c `ITEMS_CheckQuestItemPickup` (`D2Game.dll` @ `0x6FCF2F00..0x6FCF31AD`)
 * + `ITEMS_HasConflictingQuestItem` (`0x6FCF2070..0x6FCF22B8`, `#2002`):
 * 1. Enforces custom-bit / completed-quest ground-pickup gates (`0x6FCF2FA2..0x6FCF3117`
 *    + `.data` table `0x6FD22CC0`), explicitly exempting Horadric Cube (`'box'`, `0x6FCF3098`)
 *    and Wirt's Leg (`'leg'`, `0x6FCF30C7`).
 * 2. Enforces symmetric conflict pairs (`QUEST_ITEM_EQUIVALENT_CODES_113C`) across both
 *    the player's inventory (`0x6FCF3124`) and alive hired mercenary equipment (`0x6FCF318B`).
 */
function canPickupQuestItem113c(
  this: GameInstanceHost,
  player: InternalPlayerRecord,
  gItem: ServerItemEntry,
): boolean {
  const clean = gItem.code.trim().toLowerCase()
  if (!this.isOnePerPlayerQuestItem(clean)) return true

  const qf = player.questFlags
  if (clean === 'ass') {
    // 0x6FCF2FA8..0x6FCF2FCF: requires A2Q1 Radament custom bit 5 (0x0020) armed & unconsumed.
    if (!hasQuestFlag113c(qf, 'a2q1', QUEST_FLAG_CUSTOM_5_113C)) return false
  } else if (clean === 'j34') {
    // 0x6FCF2FD8..0x6FCF2FFB: blocked once A3Q1 The Golden Bird is completed (bit 0).
    if (hasQuestFlag113c(qf, 'a3q1', QUEST_FLAG_COMPLETED_113C)) return false
  } else if (clean === 'xyz') {
    // 0x6FCF2FFE..0x6FCF3011: requires A3Q1 Alkor custom bit 5 (0x0020) armed & unconsumed.
    if (!hasQuestFlag113c(qf, 'a3q1', QUEST_FLAG_CUSTOM_5_113C)) return false
  } else if (clean === 'tr2') {
    // 0x6FCF3036..0x6FCF306B: requires A5Q3 Malah bit 8 (0x0100) armed and bit 7 (0x0080) unconsumed.
    if (
      !hasQuestFlag113c(qf, 'a5q3', QUEST_FLAG_CUSTOM_8_113C) ||
      hasQuestFlag113c(qf, 'a5q3', QUEST_FLAG_CUSTOM_7_113C)
    ) {
      return false
    }
  } else if (clean === 'msf' || clean === 'vip' || clean === 'hst' || clean === 'tr1') {
    // 0x6FCF3078..0x6FCF30AA: nQuest == 10 blocked after A2Q2 completed; 'box' exempted at 0x6FCF3098.
    if (hasQuestFlag113c(qf, 'a2q2', QUEST_FLAG_COMPLETED_113C)) return false
  } else if (clean === 'bks' || clean === 'bkd') {
    // 0x6FCF30AD..0x6FCF30D9: nQuest == 5 blocked after A1Q3 completed; 'leg' exempted at 0x6FCF30C7.
    if (hasQuestFlag113c(qf, 'a1q3', QUEST_FLAG_COMPLETED_113C)) return false
  } else if (clean === 'hdm') {
    // 0x6FD22CC0[0] {0x03, 0x04}: Horadric Malus blocked after A1Q5 completed.
    if (hasQuestFlag113c(qf, 'a1q5', QUEST_FLAG_COMPLETED_113C)) return false
  } else if (
    clean === 'qey' ||
    clean === 'qhr' ||
    clean === 'qbr' ||
    clean === 'qf1' ||
    clean === 'qf2'
  ) {
    // 0x6FD22CC0[1] {0x12, 0x11}: Khalim organs/flails blocked after A3Q3 completed.
    if (hasQuestFlag113c(qf, 'a3q3', QUEST_FLAG_COMPLETED_113C)) return false
  } else if (clean === 'g33' || clean === 'd33') {
    // 0x6FD22CC0[2] {0x13, 0x12}: Gidbinn / Decoy Gidbinn blocked after A3Q2 completed.
    if (hasQuestFlag113c(qf, 'a3q2', QUEST_FLAG_COMPLETED_113C)) return false
  } else if (clean === 'hfh') {
    // 0x6FD22CC0[3] {0x1B, 0x19}: Hellforge Hammer blocked after A4Q2 completed.
    if (hasQuestFlag113c(qf, 'a4q2', QUEST_FLAG_COMPLETED_113C)) return false
  }

  const conflicting = QUEST_ITEM_EQUIVALENT_CODES_113C[clean] ?? [clean]
  if (
    player.items.some(
      (owned) =>
        owned.location !== 'vendor' && conflicting.includes(owned.code.trim().toLowerCase()),
    )
  ) {
    return false
  }
  for (const merc of this.mercenaries.values()) {
    if (merc.ownerPlayerId !== player.unitId || !merc.alive) continue
    if (merc.equipment.some((eq) => conflicting.includes(eq.code.trim().toLowerCase()))) {
      return false
    }
  }
  return true
}



/**
 * 1.13c `QUESTS_CreateItem` (`D2Game.dll` @ `0x6fc95df0`, `bDropIfFull = 1`):
 * attempts to place the quest/reward item in the player's inventory; if the
 * inventory has no free grid slot, drops the item on the ground at a free
 * subtile near `dropOrigin` / `player` and plays sound `23` (`cantCarry1`).
 */
function givePlayerInventoryQuestItem(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  code: string,
  dropOrigin?: { readonly x: number; readonly y: number },
): ServerItemEntry {
  const info = lookupBaseInfo(code)
  const free = this.findFreeGridSlot(player, 'inventory', info.width, info.height, 10, 4)
  const entry: ServerItemEntry = {
    unitId: this.allocateUnitId(UNIT_TYPE_113C.item),
    code: info.code,
    name: info.name,
    quality: 2,
    level: 1,
    location: free !== undefined ? 'inventory' : 'ground',
    x: free !== undefined ? free.x : 0,
    y: free !== undefined ? free.y : 0,
    width: info.width,
    height: info.height,
    areaId: player.areaId,
    ownerId: free !== undefined ? player.unitId : 0,
    bodyLoc: 0,
    storePage: free !== undefined ? 1 : 0,
    cost: info.cost,
    gamble: false,
    identified: true,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: info.maxDurability,
    maxDurability: info.maxDurability,
    quantity: 1,
    stats: new Map(),
    socketedItems: [],
  }
  if (free !== undefined) {
    player.items.push(entry)
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'add',
      itemId: entry.unitId,
      code: entry.code,
      x: entry.x,
      y: entry.y,
      container: 'inventory',
      item: this.serverEntryToItemData(entry),
    })
    return entry
  }

  const pos = this.findDropPosition(
    player.areaId,
    dropOrigin?.x ?? player.x,
    dropOrigin?.y ?? player.y,
    new Set(),
  )
  entry.x = pos.x
  entry.y = pos.y
  this.registerGroundItem113c(entry)
  this.broadcastToArea(player.areaId, {
    type: 'ItemEvent',
    action: 'drop',
    itemId: entry.unitId,
    code: entry.code,
    x: entry.x,
    y: entry.y,
    container: 'ground',
    item: { ...this.serverEntryToItemData(entry), action: 0x02 },
  })
  this.emitToPlayer(player.unitId, {
    type: 'PlaySound',
    unit: { unitType: 0, id: player.unitId },
    sound: 23,
  })
  return entry
}



function removePlayerQuestItem(this: GameInstanceHost, player: InternalPlayerRecord, item: ServerItemEntry): void {
  const deletedBase = this.serverEntryToItemData(item)
  const deletedFlags = ((deletedBase.rawFlags ?? 0x10) | 0x20) >>> 0
  player.items = player.items.filter((candidate) => candidate !== item)
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 'remove',
    itemId: item.unitId,
    code: item.code,
    x: item.x,
    y: item.y,
    container: toItemContainer(item.location),
    item: {
      ...deletedBase,
      flags: deletedFlags,
      rawFlags: deletedFlags,
    },
  })
}



/** Quest objects set STARTED; the canonical single-use objects also complete. */
function advanceQuestObject(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  obj: InternalObjectRecord,
): void {
  // 1.13c gpObjectOperateFnTable quest item drops (30, 108, 149, 193, 252, 354, 355, 356, 405, 406, 407).
  const questItemCode = QUEST_OBJECT_DROP_ITEM_CODE_113C[obj.classId]
  if (questItemCode !== undefined && !this.playerOrGroundHasQuestItem(player, questItemCode)) {
    const item = this.createQuestDropItem(questItemCode)
    if (item) {
      this.spawnDroppedItems([item], obj.areaId, obj.x, obj.y)
    }
  }
  if (obj.classId === 473) {
    this.breachArreatPrisonPen113c(obj, player)
    return
  }
  if (obj.classId === 26) {
    // #1926: Objects.txt 26 Cain's Gibbet (`OperateFn 10`, `D2Game.dll` `0x6FC9CCF0`)
    // releases Deckard Cain (`#265 cain1`) without dropping container loot and completes `a1q3`
    // for eligible party members.
    for (const recipient of this.getQuestEligiblePartyRecipients113c(player, obj.areaId)) {
      this.setPlayerQuestFlag(
        recipient,
        'a1q3',
        QUEST_FLAG_STARTED_113C |
          QUEST_FLAG_COMPLETED_113C |
          QUEST_FLAG_COMPLETED_NOW_113C |
          QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
      )
    }
    const hasRescuedCain = [...this.monsters.values()].some(
      (m) => m.areaId === obj.areaId && m.hcIdx === 265 && !m.dead,
    )
    if (!hasRescuedCain) {
      const hasLoadedArea = this.loadedAreas.has(obj.areaId)
      const stand = hasLoadedArea
        ? findStandableNear(
            (x, y) => this.isWorldWalkableForPlayer(obj.areaId, x, y),
            obj.x + 2,
            obj.y,
            100,
          )
        : null
      if (!hasLoadedArea || stand !== null) {
        this.spawnMonster({
          classId: 265,
          name: 'Deckard Cain',
          x: stand?.x ?? obj.x + 2,
          y: stand?.y ?? obj.y,
          areaId: obj.areaId,
          isNpc: true,
          isKillable: false,
          aiDisabled: true,
        })
      }
    }
    this.syncRogueEncampmentA1Q3State113c(player)
  }
  if (obj.classId === 8) {
    // #1925: Stony Field Moldy Tome (`Objects.txt 8 TowerTome`, `OperateFn 6`, `D2Game.dll` `0x6FC9D870`)
    // reveals Forgotten Tower quest (`a1q4`, NOT `a1q3`) and emits quest scroll message `127`.
    this.setPlayerQuestFlag(player, 'a1q4', QUEST_FLAG_STARTED_113C)
    this.emitToPlayer(player.unitId, {
      type: 'Npc',
      kind: 'info',
      unitType: 2,
      npcId: obj.unitId,
      unitId: obj.unitId,
      count: 1,
      messages: [{ menu: 0, stringId: 127 }],
      allMessages: [{ menu: 0, stringId: 127 }],
    })
    return
  }

  // A2Q6: the Horadric Staff in the orifice (D2Game 0x6fce9dae..0x6fce9dcd, #1961) consumes ONLY
  // the assembled 'hst' (never incomplete 'msf' / 'vip') and schedules QUESTS_CreateTimer(..., 18 ticks)
  // to spawn Duriel's Lair (Objects.txt 100) at (x-13, y+3).
  if (obj.classId === 152) {
    const assembledStaff = player.items.find(
      (item) => item.code.toLowerCase().trim() === 'hst',
    )
    if (assembledStaff === undefined) return
    this.removePlayerQuestItem(player, assembledStaff)
    for (const recipient of this.getQuestEligiblePartyRecipients113c(player, obj.areaId)) {
      this.setPlayerQuestFlag(
        recipient,
        'a2q2',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
      )
    }
    const horadricStaffMeta = this.registry.getMissileById(338)
    const orificeDelayTicks = Math.max(
      1,
      Math.trunc(((horadricStaffMeta?.range ?? 440) - 75) / 20),
    )
    this.pendingObjectSpawns.push({
      frame: this.currentFrame + orificeDelayTicks,
      classId: 100,
      x: obj.x - 13,
      y: obj.y + 3,
      areaId: obj.areaId,
      destAreaId: 73,
    })
    this.emitToPlayer(player.unitId, {
      type: 'QuestState',
      kind: 'special',
      source: 0x89,
      quests: new Uint16Array(player.questFlags),
      specialEventId: 3,
    })
  }
  const questId = QUEST_OBJECT_TO_QUEST_113C[obj.classId]
  if (questId === undefined) return
  // A5Q3: thawing Anya requires Malah's potion ('ice', D2Game.dll 0x6fc7ce39..0x6fc7ce95, #2019).
  if (obj.classId === 558) {
    if (
      hasQuestFlag113c(
        player.questFlags,
        'a5q3',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      )
    ) {
      return
    }
    const potion = player.items.find(
      (item) => item.code.toLowerCase().trim() === 'ice',
    )
    if (potion === undefined) return
    this.removePlayerQuestItem(player, potion)
    for (const recipient of this.getQuestEligiblePartyRecipients113c(player, obj.areaId)) {
      if (hasQuestFlag113c(recipient.questFlags, 'a5q3', QUEST_FLAG_COMPLETED_113C)) continue
      clearQuestFlag113c(
        recipient.questFlags,
        'a5q3',
        QUEST_FLAG_CUSTOM_4_113C | QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
      )
      this.setPlayerQuestFlag(
        recipient,
        'a5q3',
        QUEST_FLAG_STARTED_113C | QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C,
      )
      // D2Game.dll ACT5Q3_Timer_ThawAnya (0x6fc7c4fb..0x6fc7c50d, #2020):
      // broadcast S2C 0x89 SpecialQuestEvent 16 so D2Client spawns `anya center` (#528) steam/shake FX.
      this.emitToPlayer(recipient.unitId, {
        type: 'QuestState',
        kind: 'special',
        source: 0x89,
        quests: new Uint16Array(recipient.questFlags),
        specialEventId: 16,
      })
    }
    this.syncHarrogathA5Q3State113c(player)
    return
  }
  this.setPlayerQuestFlag(player, questId, QUEST_FLAG_STARTED_113C)
  const sealIds = [392, 393, 394, 395, 396]
  if (sealIds.includes(obj.classId)) {
    const opened = [...this.objects.values()].filter(
      (candidate) =>
        candidate.areaId === obj.areaId &&
        sealIds.includes(candidate.classId) &&
        candidate.mode === 2,
    )
    if (opened.length >= sealIds.length) {
      this.setPlayerQuestFlag(player, 'a4q3', QUEST_FLAG_PRIMARY_GOAL_DONE_113C)
    }
    this.tryTriggerChaosDiabloSpawn113c(obj.areaId)
    return
  }
  if (obj.classId === 252) {
    return
  }

  // Reward-pending quest objects consumed by their NPC (`193` Lam Esen's Tome only sets
  // `REWARD_PENDING` upon picking up `'bbb'`, and Alkor verifies & consumes `'bbb'` on turn-in, #1927).
  const pendingQuest = obj.classId === 108 ? 'a1q5' : undefined
  if (pendingQuest !== undefined) {
    this.setPlayerQuestFlag(player, pendingQuest, QUEST_FLAG_REWARD_PENDING_113C)
    return
  }
  // 1.13c objects whose operation itself completes the objective (`149` Tainted Sun Altar, `357` Horazon's Journal, `0x6fce5ca8`).
  if ([149, 357].includes(obj.classId)) {
    for (const recipient of this.getQuestEligiblePartyRecipients113c(player, obj.areaId)) {
      this.setPlayerQuestFlag(
        recipient,
        questId,
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
      )
    }
    // #1961: Smashing Tainted Sun Altar (`149`, `a2q3.cpp` `0x6fce76b0..0x6fce7a40`) clears the
    // solar eclipse across Act 2 (`S2C 0x53 EnvironmentSync` with `eclipse: false`).
    if (obj.classId === 149) {
      for (const actPlayer of this.players.values()) {
        if (areaToAct(actPlayer.areaId) === 1) {
          this.emitToPlayer(actPlayer.unitId, {
            type: 'EnvironmentSync',
            cycleIndex: 0,
            ticks: 0,
            eclipse: false,
          })
        }
      }
    }
  }
  // #1835: Objects.txt 357 Horazon's Journal (OperateFn 42, D2Game 0x6FCE9A80)
  // starts A2Q6 (The Seven Tombs) and opens permanent Red Portal (Objects.txt 60 -> Canyon of the Magi 46).
  if (obj.classId === 357) {
    for (const recipient of this.getQuestEligiblePartyRecipients113c(player, obj.areaId)) {
      this.setPlayerQuestFlag(recipient, 'a2q6', QUEST_FLAG_STARTED_113C)
    }
    const existingPortal = [...this.objects.values()].find(
      (candidate) =>
        candidate.areaId === obj.areaId &&
        candidate.classId === 60 &&
        candidate.destAreaId === 46,
    )
    if (existingPortal === undefined) {
      const hasLoadedArea = this.loadedAreas.has(obj.areaId)
      const stand = hasLoadedArea
        ? findStandableNear(
            (x, y) => this.isWorldWalkableForPlayer(obj.areaId, x, y),
            obj.x + 3,
            obj.y,
            100,
          )
        : null
      if (!hasLoadedArea || stand !== null) {
        this.spawnObject({
          classId: 60,
          x: stand?.x ?? obj.x + 3,
          y: stand?.y ?? obj.y,
          areaId: obj.areaId,
          mode: 2,
          destAreaId: 46,
        })
      }
    }
  }
}



function emitQuestLog(this: GameInstanceHost, player: InternalPlayerRecord): void {
  this.emitToPlayer(player.unitId, {
    type: 'QuestState',
    kind: 'log',
    source: 0x29,
    quests: new Uint16Array(player.questFlags),
    flags: Array.from(player.questFlags),
  })
}



/** S2C 0x5E GameQuestAvailability: 37-byte per-quest availability bitmap. */
function emitQuestAvailability(this: GameInstanceHost, player: InternalPlayerRecord): void {
  const availabilityBytes = new Uint8Array(37)
  for (let i = 0; i < availabilityBytes.length; i++) {
    availabilityBytes[i] = (player.questFlags[i] ?? 0) === 0 ? 0 : 1
  }
  const quests = new Uint16Array(18)
  for (let i = 0; i < quests.length; i++) {
    quests[i] = ((availabilityBytes[i * 2] ?? 0) << 8) | (availabilityBytes[i * 2 + 1] ?? 0)
  }
  this.emitToPlayer(player.unitId, {
    type: 'QuestState',
    kind: 'availability',
    source: 0x5e,
    quests,
    availabilityBytes,
  })
}



/**
 * 1.13c direct character / item rewards granted when a non-consumable quest
 * transitions to `QFLAG_REWARDGRANTED` (`0x0001`).
 *
 * Note: Consumable quest items (`'ass'` for `a2q1`, `'xyz'` for `a3q1`, and
 * `'tr2'` for `a5q3`) do NOT grant stats on boss kill or NPC turn-in; their
 * stats are granted exclusively when the item is consumed in `handleBeltUse`
 * (`D2Game.dll` @ `0x6fcf9e73..0x6fcf9f52`).
 */
function grantQuestCompletionReward113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  questId: string,
): void {
  if (questId === 'a1q1') {
    player.newSkills += 1
    // D2Game.dll 0x6fc82340 (called from A1Q1 reward 0x6fc82a80): sets Quest 41 (0x29) bits 13 (0x2000) and 1 (0x0002).
    player.questFlags[41] = (player.questFlags[41] ?? 0) | 0x2002
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 5,
      value: player.newSkills,
    })
  } else if (questId === 'a4q1') {
    player.newSkills += 2
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 5,
      value: player.newSkills,
    })
  } else if (questId === 'a3q4') {
    player.statPts += 5
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 4,
      value: player.statPts,
    })
  } else if (questId === 'a5q2') {
    // D2Game.dll 0x6fc7ca76..0x6fc7cb7f (#2021): Qual-Kehk awards Ral (`r08`), Ort (`r09`), Tal (`r07`)
    // scaled by rescued count bits on `questFlags[36]` (`0x0080 -> 1`, `0x0040 -> 2`, default/`0x0020 -> 3`).
    const w36 = player.questFlags[36] ?? 0
    const runeCount = (w36 & 0x0080) !== 0 ? 1 : (w36 & 0x0040) !== 0 ? 2 : 3
    for (const runeCode of ['r08', 'r09', 'r07'].slice(0, runeCount)) {
      this.givePlayerInventoryQuestItem(player, runeCode)
    }
  } else if (questId === 'a5q5') {
    // #1843: D2Game.dll ACT5Q5_GrantReward (0x6FC7BF70..0x6FC7C07E):
    // Requires clvl >= 20 (Norm) / 40 (NM) / 60 (Hell). Raw XP pool is 1,400,000 / 20,000,000 / 40,000,000,
    // clamped to the single-level XP span `MinExp(clvl + 1) - MinExp(clvl)` so the character gains at most +1 level.
    const requiredLevel = (this.difficulty + 1) * 20
    if (player.level >= requiredLevel && player.level < MAX_PLAYER_LEVEL_113C) {
      const rawPool =
        this.difficulty === 2 ? 40_000_000 : this.difficulty === 1 ? 20_000_000 : 1_400_000
      const curFloor = experienceForLevel113c(player.level)
      const nextFloor = experienceForLevel113c(player.level + 1)
      const maxGain = Math.max(0, nextFloor - curFloor)
      const xpAward = Math.min(rawPool, maxGain)
      if (xpAward > 0) {
        const baseExp = Math.max(player.experience, curFloor)
        player.experience = Math.min(
          experienceForLevel113c(MAX_PLAYER_LEVEL_113C),
          baseExp + xpAward,
        )
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId: 13,
          value: player.experience,
        })
        this.emitToPlayer(player.unitId, {
          type: 'Experience',
          value: player.experience,
          isDelta: false,
        })
        if (
          player.level < MAX_PLAYER_LEVEL_113C &&
          player.experience >= experienceForLevel113c(player.level + 1)
        ) {
          player.level += 1
          player.statPts += 5
          player.newSkills += 1
          const base = CANONICAL_CHARSTATS[player.classCode]
          player.maxHpFixed += Math.round(base.perLevel.life * FIXED_ONE)
          player.maxManaFixed += Math.round(base.perLevel.mana * FIXED_ONE)
          player.maxStaminaFixed += Math.round(base.perLevel.stamina * FIXED_ONE)

          const accruedMaxHpFixed = this.getPlayerAccruedMaxHpFixed(player)
          const accruedMaxManaFixed = this.getPlayerAccruedMaxManaFixed(player)
          const accruedMaxStaminaFixed = this.getPlayerAccruedMaxStaminaFixed(player)

          player.maxHp = Math.max(1, Math.floor(accruedMaxHpFixed / FIXED_ONE))
          if (player.hpFixed > 0 && !player.dead) {
            player.hpFixed = accruedMaxHpFixed
            player.hp = player.maxHp
          }
          player.maxMana = Math.max(0, Math.floor(accruedMaxManaFixed / FIXED_ONE))
          player.manaFixed = accruedMaxManaFixed
          player.mana = player.maxMana
          player.maxStamina = Math.max(1, Math.floor(accruedMaxStaminaFixed / FIXED_ONE))
          player.staminaFixed = accruedMaxStaminaFixed
          player.staminaExhausted = false
          player.stamina = player.maxStamina

          const nextExp =
            player.level < MAX_PLAYER_LEVEL_113C
              ? experienceForLevel113c(player.level + 1)
              : experienceForLevel113c(MAX_PLAYER_LEVEL_113C)
          for (const [statId, value] of [
            [12, player.level],
            [30, nextExp],
            [4, player.statPts],
            [5, player.newSkills],
            [6, player.hpFixed],
            [7, player.maxHpFixed],
            [8, player.manaFixed],
            [9, player.maxManaFixed],
            [10, player.staminaFixed],
            [11, player.maxStaminaFixed],
          ] as const) {
            this.emitToPlayer(player.unitId, {
              type: 'UnitStatUpdate',
              unitType: 'player',
              unitId: player.unitId,
              statId,
              value,
            })
            this.emitToPlayer(player.unitId, {
              type: 'StatSet',
              stat: statId,
              value,
            })
          }
        }
      }
    }
  }
}



function getDenMonstersRemaining113c(this: GameInstanceHost): number {
  const population = this.areaPopulations.get(8)
  const allRoomsVisited =
    population === undefined || population.populated.size >= population.rooms.length
  if (!allRoomsVisited) return 0
  let count = 0
  for (const m of this.monsters.values()) {
    if (m.dead || m.isNpc || !m.isKillable || m.areaId !== 8) continue
    count++
  }
  return count
}



function breachArreatPrisonPen113c(
  this: GameInstanceHost,
  obj: InternalObjectRecord,
  actorPlayer: InternalPlayerRecord | undefined,
  portalAnchor?: { readonly x: number; readonly y: number } | undefined,
): void {
  // Rescue on Mount Arreat (`D2Game.dll` `0x6fc76b80`, `0x6fc7a310..0x6fc7a4ff`, `0x6fc7ba40..0x6fc7bd83`, #2021):
  // Breaching a pen (`prisondoor` `#434` death or synthetic `#473` operation) marks `cagedwussie1` (`#473`)
  // opened (`mode = 2`), spawns rescue Town Portal (`Objects.txt 189`, `mode = 2`), rescues surviving
  // `act5pow` (`#534`) soldiers in the pen, and advances `questFlags[36]`.
  if (obj.useCount > 0) return
  obj.useCount = 1
  if (obj.mode !== 2) {
    this.setObjectMode(obj, 2)
  }
  if (portalAnchor !== undefined) {
    const hasLoadedArea = this.loadedAreas.has(obj.areaId)
    const rawPortalX = Math.round(portalAnchor.x)
    const rawPortalY = Math.round(portalAnchor.y)
    const portalStand = hasLoadedArea
      ? findStandableNear(
          (x, y) => this.isWorldWalkableForPlayer(obj.areaId, x, y),
          rawPortalX,
          rawPortalY,
          12,
        )
      : null
    this.spawnObject({
      classId: 189,
      x: portalStand?.x ?? rawPortalX,
      y: portalStand?.y ?? rawPortalY,
      areaId: obj.areaId,
      mode: 2,
    })
    for (const m of [...this.monsters.values()]) {
      if (
        m.areaId === obj.areaId &&
        m.hcIdx === 534 &&
        !m.dead &&
        Math.hypot(m.x - obj.x, m.y - obj.y) <= 20
      ) {
        this.monsters.delete(m.unitId)
        this.monsterCombat.delete(m.unitId)
        this.broadcastToArea(obj.areaId, {
          type: 'UnitRemove',
          unitType: 1,
          id: m.unitId,
          unitId: m.unitId,
        })
      }
    }
  }

  const cages = [...this.objects.values()].filter(
    (candidate) =>
      candidate.areaId === obj.areaId && candidate.classId === 473 && candidate.useCount > 0,
  )
  const barbsRemaining = Math.max(0, (3 - Math.min(3, cages.length)) * 5)
  const recipients =
    actorPlayer !== undefined
      ? this.getQuestEligiblePartyRecipients113c(actorPlayer, obj.areaId)
      : [...this.players.values()].filter((p) => !p.dead && p.areaId === obj.areaId)

  if (cages.length >= 3) {
    const rescuedCount = Math.max(0, 15 - this.arreatDeadPowCount)
    // D2Game.dll 0x6fc7bc20: >= 15 rescued -> 0x0020 (3 runes), 14 -> 0x0040 (2 runes), 12..13 -> 0x0080 (1 rune); < 12 fails.
    if (rescuedCount < 12) return
    const countBit = rescuedCount >= 15 ? 0x0020 : rescuedCount === 14 ? 0x0040 : 0x0080
    for (const recipient of recipients) {
      if (hasQuestFlag113c(recipient.questFlags, 'a5q2', QUEST_FLAG_COMPLETED_113C)) continue
      this.setPlayerQuestFlag(
        recipient,
        'a5q2',
        QUEST_FLAG_STARTED_113C | QUEST_FLAG_REWARD_PENDING_113C | countBit,
      )
    }
  } else {
    const a5q2Proto = questProtocolId113c('a5q2') ?? 0x20
    for (const recipient of recipients) {
      if (
        hasQuestFlag113c(
          recipient.questFlags,
          'a5q2',
          QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
        )
      ) {
        continue
      }
      setQuestFlag113c(recipient.questFlags, 'a5q2', QUEST_FLAG_STARTED_113C)
      this.emitQuestLog(recipient)
      this.emitToPlayer(recipient.unitId, {
        type: 'QuestState',
        kind: 'update',
        source: 0x28,
        updateType: 6,
        unitId: 0,
        timer: 0,
        quests: new Uint16Array(recipient.questFlags),
        flags: Array.from(recipient.questFlags),
      })
      this.emitToPlayer(recipient.unitId, {
        type: 'QuestState',
        kind: 'status',
        source: 0x5d,
        quests: new Uint16Array([a5q2Proto]),
        questStatus: {
          questId: a5q2Proto,
          alertFlags: 0x20,
          filterStatus: 2,
          extra: barbsRemaining,
        },
      })
      this.emitQuestAvailability(recipient)
    }
  }
}

function getArreatSoldiersRemaining113c(this: GameInstanceHost): number {
  let openedCages = 0
  for (const candidate of this.objects.values()) {
    if (candidate.areaId === 111 && candidate.classId === 473 && candidate.useCount > 0) {
      openedCages++
    }
  }
  return Math.max(0, (3 - Math.min(3, openedCages)) * 5)
}



/**
 * 1.13c `PACKET_Recv40_QuestLogRequest` (`D2Game.dll` `0x6fcebd30`) ->
 * `QUESTS_SendLogUpdate` (`0x6fc55640..0x6fc55880`):
 * 1) `QUESTS_SendPlayerQuestFlags` (`0x6fc54c00`): `103B` `S2C 0x28` with `updateType = 6`, `unitId = 0`, `timer = 0`.
 * 2) Compute `41B` status filter array (`statusBytes[0..40]`).
 * 3) Conditionally send `15B` `S2C 0x50` type `1` (`[1, den, tombOffset, barbs, 0, 0, 0]`) when
 *    `statusBytes[1] !== 0`, `statusBytes[36] !== 0`, or `(player.questFlags[12] & 0x2001) !== 0`.
 * 4) Send `42B` `S2C 0x52` (`statusBytes[0..40]`).
 */
function sendQuestLogUpdate113c(this: GameInstanceHost, player: InternalPlayerRecord): void {
  this.emitToPlayer(player.unitId, {
    type: 'QuestState',
    source: 0x28,
    kind: 'update',
    updateType: 6,
    unitId: 0,
    timer: 0,
    quests: new Uint16Array(player.questFlags),
    flags: Array.from(player.questFlags),
  })

  const itemCodes = new Set<string>()
  for (const item of player.items) {
    itemCodes.add(item.code.toLowerCase().trim())
  }
  const denRaw = this.getDenMonstersRemaining113c()
  const barbsRemaining = this.getArreatSoldiersRemaining113c()
  const statusBytes = computeQuestStatusBytes113c(player.questFlags, {
    playerAreaId: player.areaId,
    itemCodes,
    denRemaining: denRaw >= 1 && denRaw <= 5 ? denRaw : undefined,
    barbsRemaining,
  })

  let send50 = false
  let denWord = 0
  let tombOffsetWord = 0
  let barbsWord = 0
  if ((statusBytes[1] ?? 0) !== 0) {
    denWord = denRaw & 0xffff
    send50 = true
  }
  if ((statusBytes[36] ?? 0) !== 0) {
    barbsWord = barbsRemaining & 0xffff
    send50 = true
  }
  const a2q4Word = (player.questFlags[12] ?? 0) & 0xffff
  if ((a2q4Word & 0x2001) !== 0) {
    tombOffsetWord = Math.max(0, Math.min(6, this.getTrueTalRashaTombAreaId() - 66))
    send50 = true
  }
  if (send50) {
    const words = new Uint16Array([1, denWord, tombOffsetWord, barbsWord, 0, 0, 0])
    this.emitToPlayer(player.unitId, {
      type: 'QuestState',
      source: 0x50,
      kind: 'item',
      quests: words,
      flags: Array.from(words),
    })
  }

  this.emitToPlayer(player.unitId, {
    type: 'QuestState',
    source: 0x52,
    kind: 'history',
    quests: new Uint16Array(0),
    statusBytes,
  })
}



function emitQuestFlagSync113c(this: GameInstanceHost, player: InternalPlayerRecord, questId: string): void {
  const questIndex = questWordIndex113c(questId)
  const protocolId = questProtocolId113c(questId)
  this.emitQuestLog(player)
  // S2C 0x28 QuestInfo (`D2Game.dll` `0x6fc54c00` `QUESTS_SendPlayerQuestFlags`: `updateType = 6, unitId = 0`).
  this.emitToPlayer(player.unitId, {
    type: 'QuestState',
    kind: 'update',
    source: 0x28,
    updateType: 6,
    unitId: 0,
    timer: 0,
    quests: new Uint16Array(player.questFlags),
    flags: Array.from(player.questFlags),
  })
  // S2C 0x5D QuestStatus (`D2Game.dll` `0x6fc554f0` `QUESTS_StatusCallback`: `pkt5D[1] = nQuest` `0x01..0x24`).
  if (questIndex !== undefined && protocolId !== undefined) {
    const itemCodes = new Set<string>()
    for (const item of player.items) {
      itemCodes.add(item.code.toLowerCase().trim())
    }
    const denRaw = questId === 'a1q1' ? this.getDenMonstersRemaining113c() : 0
    const barbsRemaining = questId === 'a5q2' ? this.getArreatSoldiersRemaining113c() : 0
    const computedStatus = computeQuestStatusByte113c(questId, player.questFlags, {
      playerAreaId: player.areaId,
      itemCodes,
      denRemaining: denRaw >= 1 && denRaw <= 5 ? denRaw : undefined,
      barbsRemaining,
    })
    const filterStatus =
      questId === 'a3q1' || questId === 'a2q6' || computedStatus !== 0 ? computedStatus : 1
    const extra =
      questId === 'a1q1'
        ? denRaw & 0xffff
        : questId === 'a5q2'
          ? barbsRemaining & 0xffff
          : 0
    this.emitToPlayer(player.unitId, {
      type: 'QuestState',
      kind: 'status',
      source: 0x5d,
      quests: new Uint16Array([protocolId]),
      questStatus: {
        questId: protocolId,
        alertFlags: 0,
        filterStatus,
        extra,
      },
    })
  }
  this.emitQuestAvailability(player)
}



function setPlayerQuestFlag(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  questId: string,
  mask: number,
): boolean {
  const questIndex = questWordIndex113c(questId)
  const wasCompleted =
    questIndex !== undefined &&
    ((player.questFlags[questIndex] ?? 0) & QUEST_FLAG_COMPLETED_113C) !== 0
  if (!setQuestFlag113c(player.questFlags, questId, mask)) return false
  const nowCompleted =
    questIndex !== undefined &&
    ((player.questFlags[questIndex] ?? 0) & QUEST_FLAG_COMPLETED_113C) !== 0
  if (!wasCompleted && nowCompleted) {
    this.grantQuestCompletionReward113c(player, questId)
  }
  if (questId === 'a1q3') {
    this.syncRogueEncampmentA1Q3State113c(player)
  } else if (questId.startsWith('a2q')) {
    this.syncLutGholeinAct2NpcState113c(player)
  } else if (questId.startsWith('a3q')) {
    this.syncKurastDocksAct3NpcState113c(player)
  } else if (questId === 'a5q3' || questId === 'a5q4') {
    this.syncHarrogathA5Q3State113c(player)
  }
  this.emitQuestFlagSync113c(player, questId)
  return true
}



function playerCanEnterArea(this: GameInstanceHost, player: InternalPlayerRecord, areaId: number): boolean {
  if (areaId >= 128 && areaId <= 132 && this.isAncientsEncounterActive(120)) {
    return false
  }
  if (areaId === 46) {
    return (
      hasQuestFlag113c(player.questFlags, 'a2q5', QUEST_FLAG_COMPLETED_113C) ||
      hasQuestFlag113c(player.questFlags, 'a2q4', QUEST_FLAG_COMPLETED_113C)
    )
  }
  if (areaId === 50) {
    return (
      hasQuestFlag113c(
        player.questFlags,
        'a2q4',
        QUEST_FLAG_STARTED_113C | QUEST_FLAG_COMPLETED_113C,
      ) ||
      hasQuestFlag113c(
        player.questFlags,
        'a2q5',
        QUEST_FLAG_STARTED_113C | QUEST_FLAG_COMPLETED_113C,
      ) ||
      hasQuestFlag113c(
        player.questFlags,
        'a2q6',
        QUEST_FLAG_STARTED_113C | QUEST_FLAG_COMPLETED_113C,
      )
    )
  }
  if (areaId === 73) {
    return (
      hasQuestFlag113c(player.questFlags, 'a2q2', QUEST_FLAG_COMPLETED_113C) ||
      hasQuestFlag113c(
        player.questFlags,
        'a2q6',
        QUEST_FLAG_COMPLETED_113C |
          QUEST_FLAG_CUSTOM_3_113C |
          QUEST_FLAG_CUSTOM_4_113C |
          QUEST_FLAG_PRIMARY_GOAL_DONE_113C |
          QUEST_FLAG_COMPLETED_NOW_113C,
      )
    )
  }
  const gate = QUEST_AREA_GATES_113C[areaId]
  if (gate === undefined) return true
  return hasQuestFlag113c(player.questFlags, gate.quest, gate.mask)
}



/**
 * 1.13c interaction sight: the player must have a clear walkability ray to the
 * object/NPC/corpse. Without a terrain callback (synthetic tests) the ray is
 * treated as open unless blocked by a closed door object. Adjacent / wall-embedded
 * targets (staircase warps, wall torches, chests or items touching a wall) are
 * reachable within interaction range without requiring the target's own wall sub-tile
 * to be walkable (#1373).
 */
function hasInteractionLineOfSight(this: GameInstanceHost, 
  areaId: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  targetObjectUnitId?: number,
): boolean {
  // 1.13c `D2Game.dll` `SUNIT_Interact` (`0x6fcf01d0` / `0x6fcf025a`) calls
  // `D2Common #10324` (`0x6fd819c0`) with collision mask `0x0804` (`isFlying = true`:
  // `COLLIDE_DOOR | COLLIDE_MISSILE_BARRIER`), NOT walk-only `COLLIDE_WALL` (`0x0001`, #1986).
  if (this.isMonsterStepWalkable(areaId, fromX, fromY, toX, toY, true, targetObjectUnitId)) {
    return true
  }
  const check = this.terrainWalkableCheck
  if (!check) return false
  // Wall-embedded targets (staircase warps, wall torches, preset objects like `547` Ancients'
  // Way Stairs whose anchor sub-tile sits on a `0x0004` wall face) have a non-sight-open
  // `(toX, toY)` even when the player is standing right against the wall face (#1373, #1986).
  // Allow interaction only when `(toX, toY)` itself is sight-blocked and the ray to the adjacent
  // floor face within the object's footprint toward the player is completely clear.
  const tFloorArea = this.areaIdAtWorldPoint(Math.floor(toX), Math.floor(toY), areaId) ?? areaId
  const tRoundX = Math.round(toX)
  const tRoundY = Math.round(toY)
  const tRoundArea = this.areaIdAtWorldPoint(tRoundX, tRoundY, areaId) ?? areaId
  const targetSightOpen =
    check(tFloorArea, toX, toY, true) &&
    check(tRoundArea, tRoundX, tRoundY, true)
  if (targetSightOpen) return false
  const dist = Math.hypot(toX - fromX, toY - fromY)
  if (dist <= 1.5) return true
  const targetObj =
    targetObjectUnitId !== undefined ? this.objects.get(targetObjectUnitId) : undefined
  const objMeta =
    targetObj !== undefined ? CANONICAL_113C_OBJECTS[targetObj.classId] : undefined
  const objSizeX = Math.max(0, objMeta?.sizeX ?? 0)
  const objSizeY = Math.max(0, objMeta?.sizeY ?? 0)
  const objMinX = targetObj !== undefined ? Math.round(toX) - Math.trunc(objSizeX / 2) : 0
  const objMinY = targetObj !== undefined ? Math.round(toY) - Math.trunc(objSizeY / 2) : 0
  const embedAllowance =
    targetObj !== undefined && objSizeX >= 1 && objSizeY >= 1
      ? Math.max(
          3.5,
          Math.hypot(Math.ceil(objSizeX / 2) + 1, Math.ceil(objSizeY / 2) + 1),
        )
      : 3.5
  const maxEmbedDepth = Math.min(dist, embedAllowance)
  for (let stepIdx = 1; ; stepIdx += 1) {
    const d = Math.min(maxEmbedDepth, stepIdx * 0.25)
    const px = toX + ((fromX - toX) / dist) * d
    const py = toY + ((fromY - toY) / dist) * d
    const rx = Math.round(px)
    const ry = Math.round(py)
    const pArea = this.areaIdAtWorldPoint(Math.floor(px), Math.floor(py), areaId) ?? areaId
    const rArea = this.areaIdAtWorldPoint(rx, ry, areaId) ?? areaId
    if (this.isClosedDoorAt(rArea, rx, ry, targetObjectUnitId)) return false
    if (
      d > 3.5 &&
      targetObj !== undefined &&
      (rx < objMinX - 1 ||
        rx > objMinX + objSizeX ||
        ry < objMinY - 1 ||
        ry > objMinY + objSizeY)
    ) {
      return false
    }
    if (check(pArea, px, py, true) && check(rArea, rx, ry, true)) {
      return this.isMonsterStepWalkable(
        areaId,
        fromX,
        fromY,
        px,
        py,
        true,
        targetObjectUnitId,
      )
    }
    if (d >= maxEmbedDepth) break
  }
  return false
}



/** 1.13c PLAYER_ProcessInteract: approach a queued target, then operate it. */
function stepPendingInteractions(this: GameInstanceHost): void {
  for (const player of this.players.values()) {
    const pending = player.pendingInteraction
    if (pending === undefined || player.dead || this.isPlayerInHitRecovery(player)) continue
    let tx: number
    let ty: number
    let inRangeAndSight = false
    let targetObjectUnitId: number | undefined
    let searchRadius = 4
    let canInteractFrom: (x: number, y: number) => boolean
    if (pending.kind === 'object') {
      const obj = this.objects.get(pending.id)
      if (obj === undefined || obj.areaId !== player.areaId) {
        player.pendingInteraction = undefined
        player.pendingInteractionSteps = 0
        continue
      }
      tx = obj.x
      ty = obj.y
      targetObjectUnitId = obj.unitId
      searchRadius = computeObjectApproachSearchRadius113c(obj.classId)
      canInteractFrom = (x, y) =>
        isObjectInInteractRange113c(x, y, PLAYER_SIZE_X_113C, obj.x, obj.y, obj.classId) &&
        this.hasInteractionLineOfSight(player.areaId, x, y, obj.x, obj.y, obj.unitId)
      inRangeAndSight =
        this.playerInObjectRange(player, obj) &&
        this.hasInteractionLineOfSight(player.areaId, player.x, player.y, obj.x, obj.y, obj.unitId)
    } else if (pending.kind === 'warp') {
      const tile = this.warpTiles.get(pending.id)
      if (tile === undefined || tile.areaId !== player.areaId) {
        player.pendingInteraction = undefined
        player.pendingInteractionSteps = 0
        continue
      }
      tx = tile.x
      ty = tile.y
      searchRadius = WARP_INTERACT_DISTANCE_SUBTILES + 2
      canInteractFrom = (x, y) =>
        D2Common_10399_AtSubtiles(tile.x, tile.y, 0, x, y, PLAYER_SIZE_X_113C) <=
          WARP_INTERACT_DISTANCE_SUBTILES &&
        this.hasInteractionLineOfSight(player.areaId, x, y, tile.x, tile.y)
      inRangeAndSight =
        D2Common_10399_AtSubtiles(
          tile.x,
          tile.y,
          0,
          Math.round(player.x),
          Math.round(player.y),
          PLAYER_SIZE_X_113C,
        ) <= WARP_INTERACT_DISTANCE_SUBTILES &&
        this.hasInteractionLineOfSight(player.areaId, player.x, player.y, tile.x, tile.y)
    } else if (pending.kind === 'waypoint') {
      const wp = this.objects.get(pending.id)
      if (wp === undefined || !wp.isWaypoint || wp.areaId !== player.areaId) {
        player.pendingInteraction = undefined
        player.pendingInteractionSteps = 0
        continue
      }
      tx = wp.x
      ty = wp.y
      targetObjectUnitId = wp.unitId
      searchRadius = WAYPOINT_INTERACT_DISTANCE_SUBTILES + 2
      canInteractFrom = (x, y) =>
        Math.hypot(wp.x - x, wp.y - y) <= WAYPOINT_INTERACT_DISTANCE_SUBTILES &&
        this.hasInteractionLineOfSight(player.areaId, x, y, wp.x, wp.y, wp.unitId)
      inRangeAndSight =
        Math.hypot(wp.x - player.x, wp.y - player.y) <= WAYPOINT_INTERACT_DISTANCE_SUBTILES &&
        this.hasInteractionLineOfSight(player.areaId, player.x, player.y, wp.x, wp.y, wp.unitId)
    } else if (pending.kind === 'corpse') {
      const ownExtra = (player.extraCorpses ?? []).find(
        (c) => c.corpseId === pending.id && c.areaId === player.areaId,
      )
      const corpseOwner =
        player.corpseId === pending.id || ownExtra !== undefined
          ? player
          : Array.from(this.players.values()).find((p) => p.corpseId === pending.id)
      if (
        corpseOwner === undefined ||
        (ownExtra === undefined && corpseOwner.corpseId === undefined)
      ) {
        player.pendingInteraction = undefined
        player.pendingInteractionSteps = 0
        continue
      }
      tx = ownExtra !== undefined ? ownExtra.x : corpseOwner.corpseX
      ty = ownExtra !== undefined ? ownExtra.y : corpseOwner.corpseY
      const corpseX = tx
      const corpseY = ty
      searchRadius = 4
      canInteractFrom = (x, y) =>
        Math.hypot(x - corpseX, y - corpseY) <= 3 &&
        this.hasInteractionLineOfSight(player.areaId, x, y, corpseX, corpseY)
      inRangeAndSight =
        Math.hypot(player.x - tx, player.y - ty) <= 3 &&
        this.hasInteractionLineOfSight(player.areaId, player.x, player.y, tx, ty)
    } else if (pending.kind === 'player') {
      const targetPlayer = this.players.get(pending.id)
      if (
        targetPlayer === undefined ||
        targetPlayer.dead ||
        targetPlayer.areaId !== player.areaId ||
        !TOWN_AREAS.has(player.areaId)
      ) {
        player.pendingInteraction = undefined
        player.pendingInteractionSteps = 0
        continue
      }
      tx = targetPlayer.x
      ty = targetPlayer.y
      searchRadius = TRADE_INTERACT_RANGE_SUBTILES_113C + 2
      canInteractFrom = (x, y) =>
        Math.hypot(x - targetPlayer.x, y - targetPlayer.y) <= TRADE_INTERACT_RANGE_SUBTILES_113C &&
        this.hasInteractionLineOfSight(player.areaId, x, y, targetPlayer.x, targetPlayer.y)
      inRangeAndSight =
        Math.hypot(player.x - targetPlayer.x, player.y - targetPlayer.y) <=
          TRADE_INTERACT_RANGE_SUBTILES_113C &&
        this.hasInteractionLineOfSight(
          player.areaId,
          player.x,
          player.y,
          targetPlayer.x,
          targetPlayer.y,
        )
    } else {
      const npc = this.monsters.get(pending.id)
      if (npc === undefined || !npc.isNpc || npc.areaId !== player.areaId) {
        player.pendingInteraction = undefined
        player.pendingInteractionSteps = 0
        player.pendingNpcGamble = undefined
        player.moveTargetUnitId = undefined
        continue
      }
      tx = npc.x
      ty = npc.y
      searchRadius = Math.max(4, npc.sizeX + 3)
      canInteractFrom = (x, y) =>
        D2Common_10399_AtSubtiles(Math.floor(npc.x), Math.floor(npc.y), npc.sizeX, x, y, PLAYER_SIZE_X_113C) <=
          NPC_INTERACT_DISTANCE_SUBTILES &&
        this.hasInteractionLineOfSight(player.areaId, x, y, npc.x, npc.y)
      inRangeAndSight =
        this.playerInNpcRange(player, npc) &&
        this.hasInteractionLineOfSight(player.areaId, player.x, player.y, npc.x, npc.y)
    }
    if (inRangeAndSight) {
      const gamble = player.pendingNpcGamble
      player.pendingInteraction = undefined
      player.pendingInteractionSteps = 0
      player.pendingNpcGamble = undefined
      player.moveTargetUnitId = undefined
      if (pending.kind === 'object') this.handleInteract(player, pending.id, UNIT_TYPE_113C.object)
      else if (pending.kind === 'warp') this.handleWarpTileInteract(player, pending.id)
      else if (pending.kind === 'player') this.handlePlayerTradeInteract(player, pending.id)
      else if (pending.kind === 'waypoint') {
        const wp = this.objects.get(pending.id)
        if (
          wp !== undefined &&
          pending.destAreaId !== undefined &&
          !this.hasCursorItem113c(player) &&
          canUseWaypointInPvp113c(this.currentFrame, player.hostilePortalLockUntilFrame)
        ) {
          this.openWaypointMenu(player, wp)
          this.transitionPlayerArea(player, pending.destAreaId, { kind: 'waypoint' })
        }
      } else if (pending.kind === 'corpse') {
        if (player.corpseId === pending.id) {
          this.recoverPlayerCorpse(player)
        } else if (
          player.extraCorpses?.some(
            (c) => c.corpseId === pending.id && c.areaId === player.areaId,
          )
        ) {
          this.handleInteract(player, pending.id, UNIT_TYPE_113C.player)
        } else {
          const victim = Array.from(this.players.values()).find((p) => p.corpseId === pending.id)
          if (
            victim &&
            canLootPlayerCorpse113c({
              looterUnitId: player.unitId,
              victimUnitId: victim.unitId,
              looterIsHardcore: isPlayerHardcore113c(player),
              victimIsHardcore: isPlayerHardcore113c(victim),
              hasLootPermission: this.partyManager.hasLootPermission(victim.unitId, player.unitId),
            })
          ) {
            this.lootOtherPlayerCorpse(player, victim)
          }
        }
      } else if (gamble !== undefined) {
        this.handleNpcAction(player, pending.id, gamble)
      } else {
        this.handleNpcInteract(player, pending.id, false, true)
      }
      continue
    }
    const steps = (player.pendingInteractionSteps ?? 0) + 1
    player.pendingInteractionSteps = steps
    if (this.loadedAreas.has(player.areaId) && steps >= 3) {
      const stand = findBestInteractApproachSubTile113c({
        isWalkable: (x, y) => this.isWorldWalkableForPlayer(player.areaId, x, y),
        canInteractFrom,
        anchorX: tx,
        anchorY: ty,
        playerX: player.x,
        playerY: player.y,
        maxRadius: searchRadius,
      })
      if (stand !== null) {
        this.movePlayer(player.unitId, stand.x, stand.y)
        continue
      }
    }
    const dist = Math.hypot(tx - player.x, ty - player.y)
    if (dist <= 0.01) continue
    const stopRange = 1.5
    const step = Math.min(0.6, Math.max(0.15, dist - stopRange))
    const nx = player.x + ((tx - player.x) / dist) * step
    const ny = player.y + ((ty - player.y) / dist) * step
    const stepWalkable = this.loadedAreas.has(player.areaId)
      ? this.isWorldWalkableForPlayer(player.areaId, Math.floor(nx), Math.floor(ny)) &&
        this.isWorldWalkableForPlayer(player.areaId, Math.round(nx), Math.round(ny))
      : !this.terrainWalkableCheck || this.terrainWalkableCheck(player.areaId, nx, ny, false)
    if (
      !this.isClosedDoorAt(player.areaId, Math.round(nx), Math.round(ny), targetObjectUnitId) &&
      stepWalkable
    ) {
      this.movePlayer(player.unitId, nx, ny)
    }
  }
}



function handleInteract(
  this: GameInstanceHost,
  player: InternalPlayerRecord,
  targetId: number,
  targetType?: UnitType113c,
): void {
  // Unit ids are per type in 1.13c (`SUNIT_GetNewUnitId` 0x6FCFF9C0): resolve only the clicked type
  // (C2S 0x13 carries it). `undefined` keeps the legacy any-kind search for internal callers.
  const isType = (t: UnitType113c): boolean => targetType === undefined || targetType === t
  if (
    isType(UNIT_TYPE_113C.player) &&
    player.corpseId === targetId &&
    (player.corpseAreaId ?? player.areaId) === player.areaId
  ) {
    // 1.13c corpse recovery: the same 3-sub-tile reach used by the walk-over pickup.
    if (
      Math.hypot(player.x - player.corpseX, player.y - player.corpseY) <= 3 &&
      this.hasInteractionLineOfSight(player.areaId, player.x, player.y, player.corpseX, player.corpseY)
    ) {
      player.pendingInteraction = undefined
      player.pendingInteractionSteps = 0
      this.recoverPlayerCorpse(player)
      return
    }
    if (player.pendingInteraction === undefined) {
      player.pendingInteraction = { kind: 'corpse', id: targetId }
      player.pendingInteractionSteps = 0
    }
    return
  }
  if (isType(UNIT_TYPE_113C.player) && player.extraCorpses && player.extraCorpses.length > 0) {
    const extraIdx = player.extraCorpses.findIndex(
      (c) => c.corpseId === targetId && c.areaId === player.areaId,
    )
    if (extraIdx >= 0) {
      const chosen = player.extraCorpses[extraIdx]!
      if (
        Math.hypot(player.x - chosen.x, player.y - chosen.y) <= 3 &&
        this.hasInteractionLineOfSight(player.areaId, player.x, player.y, chosen.x, chosen.y)
      ) {
        player.extraCorpses.splice(extraIdx, 1)
        if (player.corpseId !== undefined && this.hasLivePrimaryCorpse113c(player)) {
          player.extraCorpses.push({
            corpseId: player.corpseId,
            areaId: player.corpseAreaId ?? player.areaId,
            x: player.corpseX,
            y: player.corpseY,
            items: player.corpseItems,
            lostExp: player.corpseLostExp ?? 0,
          })
        }
        player.corpseId = chosen.corpseId
        player.corpseAreaId = chosen.areaId
        player.corpseX = chosen.x
        player.corpseY = chosen.y
        player.corpseItems = chosen.items
        player.corpseLostExp = chosen.lostExp ?? 0
        player.pendingInteraction = undefined
        player.pendingInteractionSteps = 0
        this.recoverPlayerCorpse(player)
        return
      }
      if (player.pendingInteraction === undefined) {
        player.pendingInteraction = { kind: 'corpse', id: targetId }
        player.pendingInteractionSteps = 0
      }
      return
    }
  }

  for (const otherPlayer of isType(UNIT_TYPE_113C.player) ? this.players.values() : []) {
    if (otherPlayer.unitId === player.unitId) continue
    if (
      otherPlayer.corpseId === targetId &&
      (otherPlayer.corpseAreaId ?? otherPlayer.areaId) === player.areaId
    ) {
      if (
        Math.hypot(player.x - otherPlayer.corpseX, player.y - otherPlayer.corpseY) <= 3 &&
        this.hasInteractionLineOfSight(player.areaId, player.x, player.y, otherPlayer.corpseX, otherPlayer.corpseY)
      ) {
        player.pendingInteraction = undefined
        player.pendingInteractionSteps = 0
        if (
          canLootPlayerCorpse113c({
            looterUnitId: player.unitId,
            victimUnitId: otherPlayer.unitId,
            looterIsHardcore: isPlayerHardcore113c(player),
            victimIsHardcore: isPlayerHardcore113c(otherPlayer),
            hasLootPermission: this.partyManager.hasLootPermission(otherPlayer.unitId, player.unitId),
          })
        ) {
          this.lootOtherPlayerCorpse(player, otherPlayer)
        }
        return
      }
      if (player.pendingInteraction === undefined) {
        player.pendingInteraction = { kind: 'corpse', id: targetId }
        player.pendingInteractionSteps = 0
      }
      return
    }
  }

  const obj = isType(UNIT_TYPE_113C.object) ? this.objects.get(targetId) : undefined
  if (obj && obj.areaId === player.areaId && obj.classId !== 267 && this.hasCursorItem113c(player)) {
    player.pendingInteraction = undefined
    player.pendingInteractionSteps = 0
    return
  }
  if (
    obj &&
    obj.areaId === player.areaId &&
    this.playerInObjectRange(player, obj) &&
    this.hasInteractionLineOfSight(player.areaId, player.x, player.y, obj.x, obj.y, obj.unitId)
  ) {
    player.pendingInteraction = undefined
    player.pendingInteractionSteps = 0
    if (
      obj.destAreaId !== undefined &&
      obj.classId !== 194 &&
      obj.classId !== 195 &&
      obj.classId !== 298 &&
      obj.classId !== 342 &&
      obj.classId !== 547 &&
      obj.classId !== 564 &&
      obj.classId !== 565 &&
      obj.classId !== 566
    ) {
      // D2Game OperateFn 44 (0x6FD095E0, Sewer Stairs 366), OperateFn 50 (0x6FC8F4F0, Durance Stairs 386),
      // and OperateFn 70 (0x6FC7DF70, Worldstone Chamber 563 / 569): sealed (mode !== 2) cannot be entered (#1983).
      if (
        (obj.classId === 366 || obj.classId === 386 || obj.classId === 563 || obj.classId === 569) &&
        obj.mode !== 2
      ) {
        return
      }
      if (
        !canEnterPortalInPvp113c({
          currentFrame: this.currentFrame,
          playerUnitId: player.unitId,
          hostilePortalLockUntilFrame: player.hostilePortalLockUntilFrame,
          portalClassId: obj.classId,
          portalOwnerId: obj.portalOwnerId,
          isAlliedWithOwner:
            obj.portalOwnerId !== undefined && obj.portalOwnerId > 0
              ? this.partyManager.areAllied(obj.portalOwnerId, player.unitId)
              : false,
        })
      ) {
        return
      }
      // Warp / portal interactions share the 1.13c 500 ms click cooldown.
      if (!this.consumeWarpCooldown(player)) return
      const arrival = this.resolvePortalArrival113c(obj)
      const wasTownMouth = TOWN_AREAS.has(obj.areaId) && obj.portalOwnerId !== undefined
      const moved = this.transitionPlayerArea(player, obj.destAreaId, arrival)
      if (moved && wasTownMouth) this.closeTownPortal(player)
      return
    }
    if (obj.isWaypoint) {
      this.openWaypointMenu(player, obj)
      return
    }
    this.operateObject(player, obj)
    return
  }
  if (obj && obj.areaId === player.areaId && player.pendingInteraction === undefined) {
    player.pendingInteraction = { kind: 'object', id: targetId }
    player.pendingInteractionSteps = 0
  }

  const npc = isType(UNIT_TYPE_113C.monster) ? this.monsters.get(targetId) : undefined
  if (npc && npc.isNpc && npc.areaId === player.areaId) {
    this.handleNpcInteract(player, targetId, false, true)
    return
  }
  if (isType(UNIT_TYPE_113C.player) && targetId !== player.unitId && this.players.has(targetId)) {
    this.handlePlayerTradeInteract(player, targetId)
  }
}



/**
 * Waypoint operate (D2Game waypoint OperateFn -> S2C `0x63 WaypointMenu`, D2Client 0x6fb5f8b0):
 * activate the waypoint of the player's current level, then send the waypoint object's unit id
 * plus the player's unlocked waypoint bit indices (0..38, `WAYPOINT_AREA_IDS`) so the client
 * opens the waypoint panel and can answer with `0x49 WaypointGo { waypoint, level }`.
 */
function openWaypointMenu(this: GameInstanceHost, player: InternalPlayerRecord, obj: InternalObjectRecord): void {
  // Only the 39 canonical waypoint levels own a waypoint bit; any other level id has none to set.
  if (WAYPOINT_AREA_IDS.includes(player.areaId)) {
    player.waypoints.add(player.areaId)
  }
  // 1.13c remembers the operated waypoint object; `0x49 WaypointGo` is only
  // accepted while the player is still standing next to it.
  player.activeWaypointUnitId = obj.unitId
  if (obj.mode === 0) {
    obj.mode = 2
    this.broadcastToArea(obj.areaId, {
      type: 'UnitMode',
      unitType: 2,
      id: obj.unitId,
      mode: 2,
    })
  }
  const open: number[] = []
  for (let bitIndex = 0; bitIndex < WAYPOINT_AREA_IDS.length; bitIndex++) {
    if (player.waypoints.has(WAYPOINT_AREA_IDS[bitIndex]!)) {
      open.push(bitIndex)
    }
  }
  this.emitToPlayer(player.unitId, {
    type: 'WaypointMenu',
    unitId: obj.unitId,
    open,
  })
}



/**
 * 1.13c C2S 0x49 validity: the player must still be at the operated waypoint, the
 * destination must be one of the 39 waypoint levels, already activated, and its act
 * must have been reached (quest progression proxy).
 */
function canUseWaypoint(this: GameInstanceHost, player: InternalPlayerRecord, destAreaId: number): boolean {
  if (!canUseWaypointInPvp113c(this.currentFrame, player.hostilePortalLockUntilFrame)) return false
  if (!WAYPOINT_AREA_IDS.includes(destAreaId)) return false
  if (!player.waypoints.has(destAreaId)) return false
  if (areaToAct(destAreaId) > player.unlockedAct) return false
  if (player.activeWaypointUnitId === 0) return false
  const obj = this.objects.get(player.activeWaypointUnitId)
  if (!obj || !obj.isWaypoint || obj.areaId !== player.areaId) return false
  return (
    Math.hypot(obj.x - player.x, obj.y - player.y) <=
      WAYPOINT_INTERACT_DISTANCE_SUBTILES &&
    this.hasInteractionLineOfSight(player.areaId, player.x, player.y, obj.x, obj.y, obj.unitId)
  )
}



/**
 * C2S 0x13 InteractUnit(5, warpId) on a level warp (`UNIT_TILE`): D2Game takes the warp to its
 * destination level and lands the player at the warp there that leads back.
 */
function handleWarpTileInteract(this: GameInstanceHost, player: InternalPlayerRecord, warpUnitId: number): void {
  if (this.hasCursorItem113c(player)) return
  const tile = this.warpTiles.get(warpUnitId)
  if (!tile || tile.areaId !== player.areaId) return
  if (
    D2Common_10399_AtSubtiles(
      tile.x,
      tile.y,
      0,
      Math.round(player.x),
      Math.round(player.y),
      PLAYER_SIZE_X_113C,
    ) > WARP_INTERACT_DISTANCE_SUBTILES
  ) {
    // 1.13c PLAYER_ProcessInteract: queue the warp and walk into range.
    if (player.pendingInteraction === undefined) {
      player.pendingInteraction = { kind: 'warp', id: warpUnitId }
      player.pendingInteractionSteps = 0
    }
    return
  }
  player.pendingInteraction = undefined
  player.pendingInteractionSteps = 0
  // #1983, #2020: Refuse DS1 `UNIT_TILE` warps co-located with sealed quest stair/portal objects
  // (`366` Kurast Sewers Stairs, `386` Durance Stairs, `547` Ancients' Door, `563` Baal's Portal, `564` SummitDoor)
  // while the gating object in `tile.areaId` has not yet opened (`mode !== 2`).
  for (const gateObj of this.objects.values()) {
    if (gateObj.areaId !== tile.areaId) continue
    if (
      gateObj.classId !== 366 &&
      gateObj.classId !== 386 &&
      gateObj.classId !== 547 &&
      gateObj.classId !== 563 &&
      gateObj.classId !== 564
    ) {
      continue
    }
    const gateDest =
      gateObj.destAreaId ?? resolvePresetPortalDestArea113c(gateObj.classId, gateObj.areaId)
    if (gateDest === tile.destAreaId && gateObj.mode !== 2) {
      return
    }
  }
  if (!this.hasInteractionLineOfSight(player.areaId, player.x, player.y, tile.x, tile.y)) return
  if (!this.consumeWarpCooldown(player)) return
  this.transitionPlayerArea(player, tile.destAreaId, { kind: 'warp', fromAreaId: tile.areaId })
}



/** Level warps (`UNIT_TILE`) of a loaded area. */
function listWarpTiles(this: GameInstanceHost, areaId: number): readonly {
  readonly unitId: number
  readonly lvlWarpId: number
  readonly x: number
  readonly y: number
  readonly destAreaId: number
}[] {
  const out: { unitId: number; lvlWarpId: number; x: number; y: number; destAreaId: number }[] = []
  for (const t of this.warpTiles.values()) {
    if (t.areaId !== areaId) continue
    out.push({ unitId: t.unitId, lvlWarpId: t.lvlWarpId, x: t.x, y: t.y, destAreaId: t.destAreaId })
  }
  return out
}



/**
 * 1.13c `PLR_ConsumeScrollOrTome`: a Town Portal cast consumes one `tsc`
 * scroll, or one charge from a `tbk` tome. When `preferredItem` is provided
 * (`C2S 0x20 ItemUse` or `C2S 0x26 BeltUse`), consumes that exact scroll/tome
 * first. Consuming a belt-carried `'tsc'` (`ITEMMODE_BELT == 2`, `0x6FCF8DBD -> 0x6FCF3950`)
 * emits `0x9C` `action = 0x0F` (`RemoveFromBelt`) and shifts upper belt column rows down.
 */
function consumeTownPortalScrollOrTome(
  this: GameInstanceHost,
  player: InternalPlayerRecord,
  preferredItem?: ServerItemEntry,
): boolean {
  const carried = (item: ServerItemEntry): boolean =>
    item.location === 'inventory' || item.location === 'belt'

  const consumeScrollEntry = (scroll: ServerItemEntry): true => {
    const wasBelt = scroll.location === 'belt'
    const beltPos = wasBelt ? this.getBeltColRow(scroll) : undefined
    const scrollDeletedBase = this.serverEntryToItemData(scroll)
    const scrollDeletedFlags = ((scrollDeletedBase.rawFlags ?? 0x10) | 0x20) >>> 0
    player.items = player.items.filter((item) => item !== scroll)
    if (wasBelt && beltPos !== undefined) {
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 0x0f,
        itemId: scroll.unitId,
        code: scroll.code,
        x: scrollDeletedBase.gridX,
        y: 0,
        container: 'belt',
        item: {
          ...scrollDeletedBase,
          flags: scrollDeletedFlags,
          rawFlags: scrollDeletedFlags,
        },
      })
      this.shiftBeltColumnDown(player, beltPos.col, beltPos.row)
    } else {
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'remove',
        itemId: scroll.unitId,
        code: scroll.code,
        x: scroll.x,
        y: scroll.y,
        container: 'inventory',
        item: {
          ...scrollDeletedBase,
          flags: scrollDeletedFlags,
          rawFlags: scrollDeletedFlags,
        },
      })
    }
    return true
  }

  const consumeTomeEntry = (tome: ServerItemEntry): true => {
    this.syncServerItemQuantity(tome, Math.max(0, (tome.quantity ?? 0) - 1))
    this.emitToPlayer(player.unitId, {
      type: 'StatSet',
      unit: { unitType: 4, id: tome.unitId },
      stat: 70,
      value: tome.quantity,
    })
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'update',
      itemId: tome.unitId,
      code: tome.code,
      x: tome.x,
      y: tome.y,
      container: tome.location === 'belt' ? 'belt' : 'inventory',
      item: this.serverEntryToItemData(tome),
    })
    return true
  }

  if (preferredItem !== undefined && carried(preferredItem) && player.items.includes(preferredItem)) {
    const prefCode = preferredItem.code.trim().toLowerCase()
    if (prefCode === 'tsc') {
      return consumeScrollEntry(preferredItem)
    }
    if (prefCode === 'tbk' && (preferredItem.quantity ?? 0) > 0) {
      return consumeTomeEntry(preferredItem)
    }
  }

  const scroll = player.items.find(
    (item) => carried(item) && item.code.trim().toLowerCase() === 'tsc',
  )
  if (scroll !== undefined) {
    return consumeScrollEntry(scroll)
  }
  const tome = player.items.find(
    (item) =>
      carried(item) &&
      item.code.trim().toLowerCase() === 'tbk' &&
      (item.quantity ?? 0) > 0,
  )
  if (tome === undefined) return false
  return consumeTomeEntry(tome)
}



/**
 * Town mouth of a town portal (#1698): D2Game `0x6FCC2318` / `0x6FCC23C8` call D2Common `#10816`
 * with `nTileIndex = 11` (the style-33 DS1 marker picked by `sub_6FD69B60`) and unit size 3, then
 * `COLLISION_GetFreeCoordinates` (mask `0x1C09`, radius 50). `null` when the town cannot be built.
 * A resolver-less GameInstance is the synthetic legacy test grid (no DRLG level exists): its town
 * mouth is the legacy grid spawn used by `connectPlayer`.
 */
function resolveTownPortalMouth(this: GameInstanceHost, townArea: number): { readonly x: number; readonly y: number } | null {
  const area = this.loadArea(townArea)
  if (area === null) {
    return this.areaBootstrapResolver ? null : { x: LEGACY_TEST_GRID_SPAWN, y: LEGACY_TEST_GRID_SPAWN }
  }
  if (area.findActSpawnLocation === undefined) {
    throw new Error(`GameInstance: town ${String(townArea)} has no DUNGEON_FindActSpawnLocationEx data`)
  }
  return area.findActSpawnLocation(ACT_SPAWN_TILE_TOWN_PORTAL, 3)
}



/**
 * Resolves destination `AreaArrival` for owned Town Portals (`classId = 59`), permanent linked
 * red portals (`classId = 60`, e.g. Moo Moo Farm `39` & Pandemonium `133..136`), or staircase warps.
 */
function resolvePortalArrival113c(this: GameInstanceHost, obj: InternalObjectRecord): AreaArrival {
  if (obj.portalOwnerId !== undefined) {
    const paired = [...this.objects.values()].find(
      (other) =>
        other.unitId !== obj.unitId &&
        other.areaId === obj.destAreaId &&
        other.portalOwnerId === obj.portalOwnerId,
    )
    return paired ? { kind: 'townPortal', x: paired.x, y: paired.y } : { kind: 'townPortal' }
  }
  if ((obj.classId === 60 || obj.classId === 59) && obj.destAreaId !== undefined) {
    const linked =
      (obj.linkedPortalId !== undefined ? this.objects.get(obj.linkedPortalId) : undefined) ??
      [...this.objects.values()].find(
        (other) =>
          other.unitId !== obj.unitId &&
          other.classId === obj.classId &&
          other.areaId === obj.destAreaId &&
          other.destAreaId === obj.areaId,
      )
    return linked ? { kind: 'townPortal', x: linked.x, y: linked.y } : { kind: 'townPortal' }
  }
  // #1983: `D2Game.dll` `OperateFn 43` (`0x6FC8BB60`, `Objects.txt 100` `Duriel's Lair` -> `Area 73`)
  // and `OperateFn 70` (`0x6FC7DF70`, `Objects.txt 563` -> `Area 132` & `569` -> `Area 131`)
  // invoke `LEVEL_WarpUnit` (`0x6FCBE170`) with `nTileIndex = 0` (`100`, `569`) or `11` (`563`).
  if (obj.classId === 100 || obj.classId === 569) {
    return { kind: 'levelSpawn', tileIndex: ACT_SPAWN_TILE_ENTRY, fallbackFromAreaId: obj.areaId }
  }
  if (obj.classId === 563) {
    return {
      kind: 'levelSpawn',
      tileIndex: ACT_SPAWN_TILE_TOWN_PORTAL,
      fallbackFromAreaId: obj.areaId,
    }
  }
  return { kind: 'warp', fromAreaId: obj.areaId }
}



function openTownPortal(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  consumeScroll = true,
  ownerKey: number = player.unitId,
  ownerName: string = player.name,
  preferredItem?: ServerItemEntry,
): number {
  // Reject Town Portal cast while in Town (F5.B3)
  if (TOWN_AREAS.has(player.areaId)) {
    return 0
  }
  // 1.13c `D2Game.dll` (`0x6FCCF4B5`, `cmp eax, 0x88`): Town Portal is forbidden inside Uber Tristram (`136`, #1841).
  if (player.areaId === PANDEMONIUM_FINALE_AREA_ID_113C) {
    this.emitToPlayer(player.unitId, {
      type: 'PlaySound',
      unit: { unitType: 0, id: player.unitId },
      sound: 19,
    })
    return 0
  }
  if (consumeScroll && !this.consumeTownPortalScrollOrTome(player, preferredItem)) return 0

  // Replace any existing portal owned by this player (F5.B4)
  for (const [objId, obj] of this.objects.entries()) {
    if (obj.portalOwnerId === ownerKey) {
      this.objects.delete(objId)
      this.broadcastToArea(obj.areaId, {
        type: 'UnitRemove',
        unitType: 2,
        id: objId,
        unitId: objId,
      })
    }
  }

  const townArea = ACT_TOWN_AREA[player.act] ?? 1
  const fromArea = player.areaId
  // 1.13c creates both mouths: the caster's position in the wilderness and the town mouth from
  // DUNGEON_FindActSpawnLocationEx(pAct, town, 11, &x, &y, 3) (D2Game 0x6FCC2318 / 0x6FCC23C8, #1698).
  const townPos = this.resolveTownPortalMouth(townArea)
  if (townPos === null) return 0

  // D2Game.dll 0x6FC7E3C0 -> 0x6FC7E0E0 (a5q5.cpp Town Portal callback on Arreat Summit):
  // Opening a Town Portal while the Ancients encounter is active (before all 3 die)
  // despawns all Ancient Barbarians and resets Statues 474..476 and Altar 546 back to stone (mode 0).
  if (this.isAncientsEncounterActive(fromArea)) {
    const activeAncients = [...this.monsters.values()].filter(
      (m) =>
        m.areaId === fromArea &&
        m.superUniqueId !== undefined &&
        ANCIENT_BARBARIANS_113C.some((b) => b.superUniqueId === m.superUniqueId),
    )
    for (const m of activeAncients) {
      this.monsters.delete(m.unitId)
      this.monsterCombat.delete(m.unitId)
      this.broadcastToArea(fromArea, {
        type: 'UnitRemove',
        unitType: 1,
        id: m.unitId,
        unitId: m.unitId,
        areaId: fromArea,
      })
    }
    this.ancientDeaths.delete(fromArea)
    for (const obj of this.objects.values()) {
      if (obj.areaId !== fromArea) continue
      if (
        obj.classId === 546 ||
        obj.classId === 474 ||
        obj.classId === 475 ||
        obj.classId === 476
      ) {
        obj.useCount = 0
        this.setObjectMode(obj, 0)
      } else if (obj.classId === 564 && obj.mode !== 2) {
        this.setObjectMode(obj, 2)
      }
    }
  }
  const rawFieldX = Math.round(player.x) + 1
  const rawFieldY = Math.round(player.y) + 1
  const fieldStand = this.loadedAreas.has(fromArea)
    ? findStandableNear(
        (x, y) => this.isWorldWalkableForPlayer(fromArea, x, y),
        rawFieldX,
        rawFieldY,
        100,
      )
    : null
  const portalId = this.spawnObject({
    classId: 59,
    x: fieldStand?.x ?? rawFieldX,
    y: fieldStand?.y ?? rawFieldY,
    areaId: fromArea,
    mode: 2,
    destAreaId: townArea,
  })
  const townPortalId = this.spawnObject({
    classId: 59,
    x: townPos.x,
    y: townPos.y,
    areaId: townArea,
    mode: 2,
    destAreaId: fromArea,
  })
  const fromObj = this.objects.get(portalId)
  if (fromObj) fromObj.portalOwnerId = ownerKey
  const townObj = this.objects.get(townPortalId)
  if (townObj) townObj.portalOwnerId = ownerKey

  const eventOwnerId = ownerKey > 0 ? ownerKey : 0
  this.broadcastToArea(fromArea, {
    type: 'Portal',
    portalId,
    ownerId: eventOwnerId,
    ownerName,
    areaId: fromArea,
    destAreaId: townArea,
    localId: portalId,
    remoteId: townPortalId,
    flags: 1,
  })
  this.broadcastToArea(townArea, {
    type: 'Portal',
    portalId: townPortalId,
    ownerId: eventOwnerId,
    ownerName,
    areaId: townArea,
    destAreaId: fromArea,
    localId: townPortalId,
    remoteId: portalId,
    flags: 1,
  })
  return portalId
}



/** Remove both linked mouths of `player`'s town portal (town entry closes it in 1.13c). */
function closeTownPortal(this: GameInstanceHost, player: InternalPlayerRecord): void {
  for (const [objId, obj] of [...this.objects.entries()]) {
    if (obj.portalOwnerId !== player.unitId) continue
    this.objects.delete(objId)
    this.broadcastToArea(obj.areaId, {
      type: 'UnitRemove',
      unitType: 2,
      id: objId,
      unitId: objId,
    })
  }
}



/**
 * Seamless outdoor seam (#1335): when the player's world position leaves the active area's
 * room rectangles and enters a loaded neighbour's room, switch `player.areaId` in place.
 * No LoadAct/warp: the coordinate is continuous, like 1.13c `DRLG_LinkLevels` rooms.
 */
function maybeSwitchPlayerAreaSeamless(this: GameInstanceHost, player: InternalPlayerRecord): void {
  const current = this.loadedAreas.get(player.areaId)
  if (!current || current.roomRects.length === 0) return
  const x = Math.floor(player.x)
  const y = Math.floor(player.y)
  const inside = (r: { x: number; y: number; w: number; h: number }): boolean =>
    x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
  if (current.roomRects.some(inside)) return
  for (const id of current.adjacentAreaIds) {
    const area = this.loadedAreas.get(id)
    if (!area || !area.roomRects.some(inside)) continue
    if (!this.isWorldWalkableForPlayer(id, x, y)) continue
    this.switchPlayerAreaSeamless(player, id)
    return
  }
}



function switchPlayerAreaSeamless(this: GameInstanceHost, player: InternalPlayerRecord, destAreaId: number): void {
  const prevArea = player.areaId
  if (prevArea === destAreaId) return
  const dest = this.loadedAreas.get(destAreaId)
  if (!dest) return
  const prevX = player.x
  const prevY = player.y
  this.abortPlayerTrade(player.unitId)
  player.areaId = destAreaId
  this.partyManager.updatePlayer(player.unitId, {
    areaId: destAreaId,
    level: player.level,
  })
  this.clearVendorPools(player, prevArea)
  player.act = areaToAct(destAreaId)
  player.unlockedAct = Math.max(player.unlockedAct, player.act)
  player.activeWaypointUnitId = 0
  if (destAreaId === 1) {
    this.syncRogueEncampmentA1Q3State113c(player)
  }
  if (destAreaId === 40) {
    this.syncLutGholeinAct2NpcState113c(player)
  }
  if (destAreaId === 75) {
    this.syncKurastDocksAct3NpcState113c(player)
  }
  if (destAreaId === 109 || (destAreaId >= 121 && destAreaId <= 124)) {
    this.syncHarrogathA5Q3State113c(player)
  }
  if (destAreaId === 114) {
    this.syncFrozenRiverA5Q3State113c(player)
  }
  // D2Game.dll ACT5Q3_Callback03_ChangedLevel (0x6fc7f3f0..0x6fc7f495, #2019):
  // entering Area 112..114 starts a5q3 with CUSTOM_3 (0x0008), and entering/leaving 114 refreshes status 2 <-> 1.
  if (destAreaId >= 112 && destAreaId <= 114) {
    if (
      !hasQuestFlag113c(
        player.questFlags,
        'a5q3',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      )
    ) {
      setQuestFlag113c(
        player.questFlags,
        'a5q3',
        QUEST_FLAG_STARTED_113C | QUEST_FLAG_CUSTOM_3_113C,
      )
      this.emitQuestFlagSync113c(player, 'a5q3')
    }
  } else if (
    prevArea === 114 &&
    hasQuestFlag113c(
      player.questFlags,
      'a5q3',
      QUEST_FLAG_STARTED_113C | QUEST_FLAG_CUSTOM_3_113C,
    ) &&
    !hasQuestFlag113c(
      player.questFlags,
      'a5q3',
      QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
    )
  ) {
    this.emitQuestFlagSync113c(player, 'a5q3')
  }
  if (destAreaId === 73) {
    this.syncDurielsLairA2Q6State113c(73, undefined, undefined, player)
    if (
      !hasQuestFlag113c(
        player.questFlags,
        'a2q6',
        QUEST_FLAG_COMPLETED_113C |
          QUEST_FLAG_PRIMARY_GOAL_DONE_113C |
          QUEST_FLAG_CUSTOM_3_113C |
          QUEST_FLAG_CUSTOM_4_113C,
      )
    ) {
      setQuestFlag113c(player.questFlags, 'a2q6', QUEST_FLAG_STARTED_113C)
      this.emitQuestFlagSync113c(player, 'a2q6')
    }
  } else if (
    prevArea === 73 &&
    hasQuestFlag113c(player.questFlags, 'a2q6', QUEST_FLAG_STARTED_113C) &&
    !hasQuestFlag113c(
      player.questFlags,
      'a2q6',
      QUEST_FLAG_COMPLETED_113C |
        QUEST_FLAG_PRIMARY_GOAL_DONE_113C |
        QUEST_FLAG_CUSTOM_3_113C |
        QUEST_FLAG_CUSTOM_4_113C,
    )
  ) {
    this.emitQuestFlagSync113c(player, 'a2q6')
  }
  this.ensureAdjacentAreasLoaded(destAreaId)

  const motion = this.getPlayerMotion(player)
  // 1.13c PLAYER_UpdateRoom keeps `pPath` and the current walk/run action
  // across a same-act outdoor seam; only the collision domain changes.
  motion.mover.setCollisionChecker(
    this.terrainWalkableCheck ? (sx, sy) => this.isPlayerSubTileBlocked(destAreaId, sx, sy) : null,
  )

  // #1857: preserve seam-adjacent rooms still inside AOI; stream newly revealed rooms + units,
  // and sync viewer AOI enter/leave across the stitched outdoor boundary instead of dropping Units.
  this.syncUnitMoveAcrossViewerAoi113c(
    'player',
    player.unitId,
    prevArea,
    prevX,
    prevY,
    destAreaId,
    player.x,
    player.y,
    player.unitId,
  )
  if (dest.rooms.length > 0) {
    this.revealAreaRoomsNearPlayer(player, true)
  } else {
    this.emitAreaSnapshotToPlayer(player)
  }
  if (this.partyManager.getPartyId(player.unitId) !== 0xffff) {
    for (const member of this.players.values()) {
      if (this.partyManager.areAllied(player.unitId, member.unitId)) {
        this.emitPartyMemberPulsesForPlayer(member)
      }
    }
  }
}



/**
 * Move `player` into `destAreaId` (D2Game `LEVEL_WarpUnit`). Same-act transitions
 * send RoomHide/RoomReveal + UnitReassign only; an act change sends UnloadAct →
 * LoadAct first. Build/landing failures roll back and notify the client instead of
 * throwing into the 25 Hz frame loop.
 */
function transitionPlayerArea(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  destAreaId: number,
  arrival: AreaArrival,
): boolean {
  const prevArea = player.areaId
  const prevX = player.x
  const prevY = player.y
  const prevAct = areaToAct(prevArea)
  const destAct = areaToAct(destAreaId)
  if (!this.playerCanEnterArea(player, destAreaId)) {
    this.notifyAreaTransitionFailure(player, destAreaId)
    return false
  }
  let landing: { readonly x: number; readonly y: number } | null = null
  if (this.areaBootstrapResolver) {
    let area: LoadedAreaRecord | null = null
    try {
      area = this.loadArea(destAreaId)
    } catch {
      area = null
    }
    if (!area) {
      this.notifyAreaTransitionFailure(player, destAreaId)
      return false
    }
    landing = this.resolveArrivalPosition(area, arrival)
    if (!landing) {
      this.notifyAreaTransitionFailure(player, destAreaId)
      return false
    }
  } else {
    const loadedArea = this.loadedAreas.get(destAreaId)
    if (loadedArea) {
      landing = this.resolveArrivalPosition(loadedArea, arrival)
    } else if (arrival.kind === 'townPortal' && arrival.x !== undefined && arrival.y !== undefined) {
      landing =
        findStandableNear(
          (x, y) => this.isWorldWalkableForPlayer(destAreaId, x, y),
          arrival.x,
          arrival.y,
        ) ?? { x: arrival.x, y: arrival.y }
    } else if (arrival.kind === 'respawn' && ACT_TOWN_AREAS.includes(destAreaId)) {
      // Resolver-less synthetic test grid: no DRLG town exists, respawn on the legacy grid spawn.
      landing =
        findStandableNear(
          (x, y) => this.isWorldWalkableForPlayer(destAreaId, x, y),
          LEGACY_TEST_GRID_SPAWN,
          LEGACY_TEST_GRID_SPAWN,
        ) ?? { x: LEGACY_TEST_GRID_SPAWN, y: LEGACY_TEST_GRID_SPAWN }
    }
  }

  if (prevArea !== destAreaId) {
    this.abortPlayerTrade(player.unitId)
    this.hidePlayerAreaRooms(player, prevArea)
    if (
      (destAreaId === 44 || destAreaId === 45 || destAreaId === 58 || destAreaId === 61) &&
      !hasQuestFlag113c(
        player.questFlags,
        'a2q3',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_STARTED_113C,
      )
    ) {
      this.setPlayerQuestFlag(player, 'a2q3', QUEST_FLAG_STARTED_113C)
    }
    const isTaintedSunEclipse =
      destAct === 1 &&
      !hasQuestFlag113c(player.questFlags, 'a2q3', QUEST_FLAG_COMPLETED_113C) &&
      (destAreaId === 44 ||
        destAreaId === 45 ||
        destAreaId === 58 ||
        destAreaId === 61 ||
        hasQuestFlag113c(player.questFlags, 'a2q3', QUEST_FLAG_STARTED_113C))
    this.emitToPlayer(player.unitId, {
      type: 'EnvironmentSync',
      cycleIndex: 0,
      ticks: 0,
      eclipse: isTaintedSunEclipse,
    })
  }
  if (destAct !== prevAct) {
    this.emitToPlayer(player.unitId, { type: 'UnloadAct' })
  }
  player.areaId = destAreaId
  this.partyManager.updatePlayer(player.unitId, {
    areaId: destAreaId,
    level: player.level,
  })
  this.clearVendorPools(player, prevArea)
  player.act = destAct
  player.unlockedAct = Math.max(player.unlockedAct, destAct)
  player.activeWaypointUnitId = 0
  if (landing) {
    player.x = landing.x
    player.y = landing.y
    player.targetX = landing.x
    player.targetY = landing.y
  }
  if (destAreaId === 1) {
    this.syncRogueEncampmentA1Q3State113c(player)
  }
  if (destAreaId === 40) {
    this.syncLutGholeinAct2NpcState113c(player)
  }
  if (destAreaId === 75) {
    this.syncKurastDocksAct3NpcState113c(player)
  }
  if (destAreaId === 109 || (destAreaId >= 121 && destAreaId <= 124)) {
    this.syncHarrogathA5Q3State113c(player)
  }
  if (destAreaId === 114) {
    this.syncFrozenRiverA5Q3State113c(player)
  }
  // D2Game.dll ACT5Q3_Callback03_ChangedLevel (0x6fc7f3f0..0x6fc7f495, #2019):
  // entering Area 112..114 starts a5q3 with CUSTOM_3 (0x0008), and entering/leaving 114 refreshes status 2 <-> 1.
  if (destAreaId >= 112 && destAreaId <= 114) {
    if (
      !hasQuestFlag113c(
        player.questFlags,
        'a5q3',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      )
    ) {
      setQuestFlag113c(
        player.questFlags,
        'a5q3',
        QUEST_FLAG_STARTED_113C | QUEST_FLAG_CUSTOM_3_113C,
      )
      this.emitQuestFlagSync113c(player, 'a5q3')
    }
  } else if (
    prevArea === 114 &&
    hasQuestFlag113c(
      player.questFlags,
      'a5q3',
      QUEST_FLAG_STARTED_113C | QUEST_FLAG_CUSTOM_3_113C,
    ) &&
    !hasQuestFlag113c(
      player.questFlags,
      'a5q3',
      QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
    )
  ) {
    this.emitQuestFlagSync113c(player, 'a5q3')
  }
  if (destAreaId === 73) {
    this.syncDurielsLairA2Q6State113c(73, undefined, undefined, player)
    if (
      !hasQuestFlag113c(
        player.questFlags,
        'a2q6',
        QUEST_FLAG_COMPLETED_113C |
          QUEST_FLAG_PRIMARY_GOAL_DONE_113C |
          QUEST_FLAG_CUSTOM_3_113C |
          QUEST_FLAG_CUSTOM_4_113C,
      )
    ) {
      setQuestFlag113c(player.questFlags, 'a2q6', QUEST_FLAG_STARTED_113C)
      this.emitQuestFlagSync113c(player, 'a2q6')
    }
  } else if (
    prevArea === 73 &&
    hasQuestFlag113c(player.questFlags, 'a2q6', QUEST_FLAG_STARTED_113C) &&
    !hasQuestFlag113c(
      player.questFlags,
      'a2q6',
      QUEST_FLAG_COMPLETED_113C |
        QUEST_FLAG_PRIMARY_GOAL_DONE_113C |
        QUEST_FLAG_CUSTOM_3_113C |
        QUEST_FLAG_CUSTOM_4_113C,
    )
  ) {
    this.emitQuestFlagSync113c(player, 'a2q6')
  }
  this.ensureAdjacentAreasLoaded(destAreaId)
  const landedX = Math.floor(player.x + 0.5)
  const landedY = Math.floor(player.y + 0.5)
  player.lastWarpPos113c = { x: landedX, y: landedY }
  player.breadcrumbs113c = [{ x: landedX, y: landedY }]
  this.areaPathWorld.spawnOrSyncPlayer(
    player.areaId,
    player.unitId,
    player.classId,
    player.x,
    player.y,
    player.mode,
  )
  this.relocatePlayerFollowersToPlayer(player, false)

  if (prevArea !== destAreaId) {
    this.syncUnitMoveAcrossViewerAoi113c(
      'player',
      player.unitId,
      prevArea,
      prevX,
      prevY,
      destAreaId,
      player.x,
      player.y,
      player.unitId,
    )
  }

  if (destAct !== prevAct) {
    this.emitToPlayer(player.unitId, {
      type: 'LoadAct',
      act: player.act,
      mapSeed: this.currentMapSeed,
      areaId: destAreaId,
    })
  }
  this.activatePresetRoomsNearPlayer113c(player)
  this.revealAreaRoomsNearPlayer(player)
  this.emitToPlayer(player.unitId, {
    type: 'UnitReassign',
    unitType: 0,
    id: player.unitId,
    unitId: player.unitId,
    at: playerWirePosition(player),
    x: player.x,
    y: player.y,
    snap: true,
    areaId: player.areaId,
  })
  this.emitAreaSnapshotToPlayer(player)
  if (prevArea !== destAreaId && this.partyManager.getPartyId(player.unitId) !== 0xffff) {
    for (const member of this.players.values()) {
      if (this.partyManager.areAllied(player.unitId, member.unitId)) {
        this.emitPartyMemberPulsesForPlayer(member)
      }
    }
  }
  return true
}



/** Non-fatal transition failure: keep the player in place and tell the client. */
function notifyAreaTransitionFailure(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  destAreaId: number,
): void {
  this.emitToPlayer(player.unitId, {
    type: 'Chat',
    kind: 'system',
    text: `Unable to enter area ${destAreaId}`,
  })
  this.emitToPlayer(player.unitId, {
    type: 'UnitReassign',
    unitType: 0,
    id: player.unitId,
    unitId: player.unitId,
    at: playerWirePosition(player),
    x: player.x,
    y: player.y,
    snap: true,
    areaId: player.areaId,
  })
}

export interface QuestsObjectsAndPortalsMethods {
  operateObject(player: InternalPlayerRecord, obj: InternalObjectRecord): void
  getEquivalentQuestItemCodes(code: string): readonly string[]
  isOnePerPlayerQuestItem(code: string): boolean
  resolveCarry1UniqueId113c(item: ServerItemEntry): number | undefined
  playerHasQuestItem(player: InternalPlayerRecord, code: string): boolean
  playerOrGroundHasQuestItem(player: InternalPlayerRecord, code: string): boolean
  canPickupQuestItem113c(player: InternalPlayerRecord, gItem: ServerItemEntry): boolean
  givePlayerInventoryQuestItem(player: InternalPlayerRecord, code: string, dropOrigin?: { readonly x: number; readonly y: number }): ServerItemEntry
  removePlayerQuestItem(player: InternalPlayerRecord, item: ServerItemEntry): void
  advanceQuestObject(player: InternalPlayerRecord, obj: InternalObjectRecord): void
  emitQuestLog(player: InternalPlayerRecord): void
  emitQuestAvailability(player: InternalPlayerRecord): void
  getDenMonstersRemaining113c(): number
  breachArreatPrisonPen113c(
    obj: InternalObjectRecord,
    actorPlayer: InternalPlayerRecord | undefined,
    portalAnchor?: { readonly x: number; readonly y: number } | undefined,
  ): void
  getArreatSoldiersRemaining113c(): number
  sendQuestLogUpdate113c(player: InternalPlayerRecord): void
  grantQuestCompletionReward113c(player: InternalPlayerRecord, questId: string): void
  emitQuestFlagSync113c(player: InternalPlayerRecord, questId: string): void
  setPlayerQuestFlag(player: InternalPlayerRecord, questId: string, mask: number): boolean
  playerCanEnterArea(player: InternalPlayerRecord, areaId: number): boolean
  hasInteractionLineOfSight(areaId: number, fromX: number, fromY: number, toX: number, toY: number, targetObjectUnitId?: number): boolean
  stepPendingInteractions(): void
  handleInteract(player: InternalPlayerRecord, targetId: number, targetType?: UnitType113c): void
  openWaypointMenu(player: InternalPlayerRecord, obj: InternalObjectRecord): void
  canUseWaypoint(player: InternalPlayerRecord, destAreaId: number): boolean
  handleWarpTileInteract(player: InternalPlayerRecord, warpUnitId: number): void
  listWarpTiles(areaId: number): readonly {
  readonly unitId: number
  readonly lvlWarpId: number
  readonly x: number
  readonly y: number
  readonly destAreaId: number
}[]
  consumeTownPortalScrollOrTome(player: InternalPlayerRecord, preferredItem?: ServerItemEntry | undefined): boolean
  resolveTownPortalMouth(townArea: number): { readonly x: number; readonly y: number } | null
  resolvePortalArrival113c(obj: InternalObjectRecord): AreaArrival
  openTownPortal(player: InternalPlayerRecord, consumeScroll?: boolean | undefined, ownerKey?: number | undefined, ownerName?: string | undefined, preferredItem?: ServerItemEntry | undefined): number
  closeTownPortal(player: InternalPlayerRecord): void
  maybeSwitchPlayerAreaSeamless(player: InternalPlayerRecord): void
  switchPlayerAreaSeamless(player: InternalPlayerRecord, destAreaId: number): void
  transitionPlayerArea(player: InternalPlayerRecord, destAreaId: number, arrival: AreaArrival): boolean
  notifyAreaTransitionFailure(player: InternalPlayerRecord, destAreaId: number): void
}

export const questsObjectsAndPortalsMethods: Record<keyof QuestsObjectsAndPortalsMethods, unknown> = {
  operateObject,
  getEquivalentQuestItemCodes,
  isOnePerPlayerQuestItem,
  resolveCarry1UniqueId113c,
  playerHasQuestItem,
  playerOrGroundHasQuestItem,
  canPickupQuestItem113c,
  givePlayerInventoryQuestItem,
  removePlayerQuestItem,
  advanceQuestObject,
  emitQuestLog,
  emitQuestAvailability,
  getDenMonstersRemaining113c,
  breachArreatPrisonPen113c,
  getArreatSoldiersRemaining113c,
  sendQuestLogUpdate113c,
  grantQuestCompletionReward113c,
  emitQuestFlagSync113c,
  setPlayerQuestFlag,
  playerCanEnterArea,
  hasInteractionLineOfSight,
  stepPendingInteractions,
  handleInteract,
  openWaypointMenu,
  canUseWaypoint,
  handleWarpTileInteract,
  listWarpTiles,
  consumeTownPortalScrollOrTome,
  resolveTownPortalMouth,
  resolvePortalArrival113c,
  openTownPortal,
  closeTownPortal,
  maybeSwitchPlayerAreaSeamless,
  switchPlayerAreaSeamless,
  transitionPlayerArea,
  notifyAreaTransitionFailure,
}
