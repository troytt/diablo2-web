/**
 * GameInstance Subsystem: Player Damage/Death/Corpse Recovery, Unit States, Shrines, Wells & Container Traps (`src/server/engine/game-instance/player-death-and-shrines.ts`).
 */

import { getEmbeddedDropTables } from '../../../common/items/embedded-drop-tables.ts'
import { D2Common_10399_AtSubtiles } from '../../../common/path/step.ts'
import { CANONICAL_113C_OBJECTS, CANONICAL_113C_SHRINES, getShrineMeta113c, isObjectInInteractRange113c } from '../../../common/world/objects-meta.ts'
import { WELL_CURABLE_STATE_IDS_113C, WELL_DEFAULT_PARMS_113C, computeWellHealDeltaFixed113c, computeWellModeForCharges113c, computeWellRegenFrame113c, getObjectOperatingTicks113c, rollObjectTrapDamage256_113c } from '../../../common/world/object-operate-113c.ts'
import { getLevelMonsterLevel113c } from '../../../common/world/levels-monlvl-113c.ts'
import { QUEST_FLAG_COMPLETED_113C, QUEST_FLAG_COMPLETED_NOW_113C, QUEST_FLAG_CUSTOM_4_113C, QUEST_FLAG_PRIMARY_GOAL_DONE_113C, QUEST_FLAG_REWARD_PENDING_113C, hasQuestFlag113c, questWordIndex113c } from '../quests-113c.ts'
import { createDroppedItem } from '../../../common/items/drop-tables.ts'
import { D2Rng } from '../../../common/rng/d2-rng.ts'
import { buildPvpPlayerEarItemData113c, buildPvpSlainEvent0x5A113c } from '../../combat/pvp-engine-113c.ts'
import { applyDeathGoldPenalty113c, evaluateDeathExperiencePenalty113c, type DeathKillerKind113c } from '../../../common/progression/experience-113c.ts'
import { rollAuraEnchanted113c } from '../../../common/units/monai-113c.ts'
import { MON_UMOD, resolveMonsterUModIds } from '../../../common/units/monster-death-fx.ts'
import { isAlwaysRunAiMonster113c, isMonsterUncursable113c } from '../../ai/monumod-113c.ts'
import { EXPLODING_POISON_SHRINE_OFFSETS_113C, buildArmorShrineStats113c, buildCombatShrineSnapshot113c, computeShrineMissileSlvl113c, isEligibleMonsterShrineTarget113c, isWithinShrineActiveRoomNeighborhood113c } from '../../world/shrines-113c.ts'
import { GEM_INFO } from '../../../common/items/gems-data.ts'
import { getMonsterKindByHcIdx, resolveMonsterStats, rollEliteModifiers, type MonsterRank } from '../../../common/units/monsters-data.ts'
import { PET_TYPE_IDX_BY_NAME_113C } from '../../../common/units/pet-type-table.ts'
import { getLevelMonsterPlan113c } from '../../../common/world/level-monster-plans.ts'
import { OBJECTS_TXT_113C, getObjectsTxtRecord113c } from '../../../common/world/objects-txt-113c.ts'
import type { ServerEvent, UnitId } from '../../../netproto/index.ts'
import { findStandableNear } from '../../world/area-bootstrap.ts'
import { createGoldPiles113c, planEvilUrnPack113c, rollCountessTowerChestDrops113c } from '../../world/object-drops-113c.ts'
import { canUnitEquipItem113c } from '../../../common/items/equip-req-113c.ts'
import { resolvePetAiProfile113c } from '../../ai/summon-manager.ts'
import { FIXED_ONE } from '../stat-list.ts'
import { compute3BandDuration, computeDiminishingReturns } from '../../../common/data/calc-ast.ts'
import { difficultyDeathExpPenalty } from '../difficulty-resist-penalty.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMercenaryRecord, InternalMissileRecord, InternalMonsterRecord, InternalObjectRecord, InternalPlayerRecord, MissileDamageChannel, ServerItemEntry } from './types.ts'
import { ACT_TOWN_AREA, ANCIENT_BARBARIANS_113C, MAX_PLAYER_LEVEL_113C, NPC_INTERACT_DISTANCE_SUBTILES, PLAYER_SIZE_X_113C, TOWN_AREAS, WARP_INTERACT_COOLDOWN_FRAMES, experienceForLevel113c, normalizeMissileElement, playerWirePosition, UNIT_TYPE_113C, missileSpeedSubtilesPerFrame113c } from './constants-and-helpers.ts'


function applyDamageToPlayer(this: GameInstanceHost, 
  playerUnitIdOrRecord: number | InternalPlayerRecord,
  damage: number,
  options?: {
    readonly dmg256?: number | undefined
    readonly hitClass?: number | string | undefined
    readonly isPurePoison?: boolean | undefined
    readonly skipGetHit?: boolean | undefined
    readonly killerType?: DeathKillerKind113c
    readonly killerUnitId?: number | undefined
  },
): void {
  const player =
    typeof playerUnitIdOrRecord === 'number'
      ? this.players.get(playerUnitIdOrRecord)
      : playerUnitIdOrRecord
  if (!player || player.dead) return

  const dmgInt = Math.max(1, Math.floor(damage))
  if (options?.dmg256 !== undefined) {
    // 1.13c `SUNITDMG_ExecuteMissileDamage` (`0x6FCFE242..0x6FCFE264`): `life = STAT_HITPOINTS - dwDmgTotal`
    // in 256ths, `life < 0x100 -> 0` (`kb/combat/d2game-sunitdmg-player-defender-113c.md` §5).
    const nextHpFixed = player.hpFixed - Math.max(0, Math.trunc(options.dmg256))
    player.hpFixed = nextHpFixed < FIXED_ONE ? 0 : nextHpFixed
  } else {
    player.hpFixed = Math.max(0, player.hpFixed - dmgInt * FIXED_ONE)
  }
  player.hp = Math.max(0, Math.ceil(player.hpFixed / FIXED_ONE))

  this.emitToPlayer(player.unitId, {
    type: 'UnitStatUpdate',
    unitType: 'player',
    unitId: player.unitId,
    statId: 6,
    value: player.hpFixed,
  })
  this.emitToPlayer(player.unitId, {
    type: 'LifeMana',
    life: player.hp,
    mana: player.mana,
    stamina: player.stamina,
    at: playerWirePosition(player),
    vx: 0,
    vy: 0,
  })

  if (player.hp <= 0) {
    // 1.13c `item_skillondeath` (197): rolled while the dying player's gear is still equipped (#1797).
    const killerMon =
      options?.killerUnitId !== undefined ? this.monsters.get(options.killerUnitId) : undefined
    this.triggerPlayerCtcProcs113c(player, 197, { target: killerMon })
    this.killPlayer(player, options)
  } else if (!options?.skipGetHit) {
    this.maybeEnterPlayerHitRecovery(player, dmgInt, options)
  }
}



function resolveKillerTypeForDeathPenalty(this: GameInstanceHost, options?: {
  readonly killerType?: DeathKillerKind113c
  readonly killerUnitId?: number | undefined
}): DeathKillerKind113c {
  if (options?.killerType !== undefined) return options.killerType
  const killerUnitId = options?.killerUnitId
  if (killerUnitId === undefined) return 'monster'
  if (this.players.has(killerUnitId)) return 'player'
  if (this.mercenaries.has(killerUnitId)) return 'player_pet'
  for (const petUnitId of this.petUnitIds.values()) {
    if (petUnitId === killerUnitId) return 'player_pet'
  }
  const mon = this.monsters.get(killerUnitId)
  if (mon && mon.convertedUntilFrame > this.currentFrame && mon.convertedByPlayerId > 0) {
    return 'player_pet'
  }
  if (this.objects.has(killerUnitId)) return 'object'
  return 'monster'
}



/**
 * 1.13c `D2Game.dll` `0x6FCEC390..0x6FCEC3A7` (`SUNITDMG_ResolveRootOwnerPlayer`):
 * resolves a killer unit ID (direct player, mercenary, summoned pet/trap/hydra, or converted monster)
 * back to its owning player record for PvP ear drops and `S2C 0x5A` kill announcements (#1784).
 */
function resolveRootKillerPlayer113c(this: GameInstanceHost, killerUnitId?: number): InternalPlayerRecord | undefined {
  if (killerUnitId === undefined) return undefined
  const direct = this.players.get(killerUnitId)
  if (direct !== undefined) return direct
  const merc = this.mercenaries.get(killerUnitId)
  if (merc !== undefined) return this.players.get(merc.ownerPlayerId)
  for (const [ownerId, mgr] of this.summonManagers.entries()) {
    for (const pet of mgr.getActivePets()) {
      const mappedId =
        this.petUnitIds.get(pet.uid) ?? (pet as unknown as { unitId?: number }).unitId
      if (mappedId === killerUnitId) {
        return this.players.get(ownerId)
      }
    }
  }
  for (const [petUid, mappedId] of this.petUnitIds.entries()) {
    if (mappedId === killerUnitId) {
      for (const [ownerId, mgr] of this.summonManagers.entries()) {
        if (mgr.getActivePets().some((p) => p.uid === petUid)) {
          return this.players.get(ownerId)
        }
      }
    }
  }
  const mon = this.monsters.get(killerUnitId)
  if (mon && mon.convertedUntilFrame > this.currentFrame && mon.convertedByPlayerId > 0) {
    return this.players.get(mon.convertedByPlayerId)
  }
  return undefined
}



/**
 * 1.13c `D2Game.dll` `0x6FC99E40` -> `0x6FC32AF0` (`ITEMS_CreatePlayerEar`):
 * spawns the slain victim's personalized compact `'ear '` on the ground (`S2C 0x9C`).
 */
function spawnPvpPlayerEar113c(this: GameInstanceHost, victim: InternalPlayerRecord): number {
  const pos = this.findDropPosition(victim.areaId, victim.x, victim.y, new Set())
  const unitId = this.allocateUnitId(UNIT_TYPE_113C.item)
  const earLevel = Math.max(1, Math.min(99, Math.trunc(victim.level || 1)))
  const rawItemData = buildPvpPlayerEarItemData113c({
    itemId: unitId,
    victimClassId: victim.classId,
    victimLevel: earLevel,
    victimName: victim.name,
    x: pos.x,
    y: pos.y,
  })
  const entry: ServerItemEntry = {
    unitId,
    code: 'ear',
    name: `${victim.name}'s Ear`,
    quality: 2,
    level: earLevel,
    location: 'ground',
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    width: 1,
    height: 1,
    areaId: victim.areaId,
    ownerId: 0,
    bodyLoc: 0,
    storePage: 0,
    cost: 1,
    gamble: false,
    identified: true,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: 0,
    maxDurability: 0,
    quantity: 1,
    stats: new Map<number, number>(),
    socketedItems: [],
    rawItemData,
  }
  this.registerGroundItem113c(entry)
  this.broadcastToArea(victim.areaId, {
    type: 'ItemEvent',
    action: 'groundSpawn',
    itemId: unitId,
    code: 'ear',
    x: entry.x,
    y: entry.y,
    container: 'ground',
    item: this.serverEntryToItemData(entry),
  })
  return unitId
}



/**
 * 1.13c `D2Game.dll` `0x6FC57F80` (`PLAYER_DropGoldPile(pGame, pPlayer, nGold)`):
 * spawns a ground `'gld'` pile at the player's position with `STAT_GOLD (14) = amount`.
 */
function dropPlayerGoldPile(this: GameInstanceHost, player: InternalPlayerRecord, amount: number): number | undefined {
  const goldAmount = Math.trunc(amount)
  if (goldAmount <= 0) return undefined
  const tables = getEmbeddedDropTables()
  const base = tables.getBase('gld')
  if (base !== undefined) {
    const seed = this.rng.rand(0x7fffffff) >>> 0
    const item = createDroppedItem(base, 'normal', {
      itemTypes: tables.itemTypes,
      ilvl: 1,
      dwInitSeed: seed,
      itemRng: new D2Rng(seed || 1),
    })
    const ids = this.spawnDroppedItems(
      [{ ...item, stack: goldAmount, quantity: goldAmount }],
      player.areaId,
      player.x,
      player.y,
    )
    return ids[0]
  }
  const pos = this.findDropPosition(player.areaId, player.x, player.y, new Set())
  return this.spawnGroundItem({
    code: 'gld',
    x: pos.x,
    y: pos.y,
    areaId: player.areaId,
    quantity: goldAmount,
  })
}



function killPlayer(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  options?: {
    readonly killerType?: DeathKillerKind113c
    readonly killerUnitId?: number | undefined
  },
): void {
  this.abortPlayerTrade(player.unitId)
  player.dead = true
  player.hasDied = true
  const isHardcorePlayer =
    player.isHardcore === true || ((player.statusFlags ?? 0) & 0x04) !== 0
  if (isHardcorePlayer) {
    player.isHardcore = true
    player.statusFlags = ((player.statusFlags ?? 0x24) | 0x04 | 0x08) & 0xff
  }
  player.hitRecoveryUntilFrame = 0
  player.activeWaypointUnitId = 0
  player.hp = 0
  player.hpFixed = 0
  player.mode = 17
  // 1.13c `D2Game.dll` `0x6FD0D880` / `0x6FC583A0` / `0x6FCB7730`: all player summons (including
  // Iron Golem) and any alive hireling (`petType = 7` via `0x6FCB7420`) perish on owner death.
  for (const merc of this.mercenaries.values()) {
    if (merc.ownerPlayerId === player.unitId && merc.alive && merc.hp > 0) {
      this.applyDamageToMerc(merc, merc.hp, merc.areaId, { skipGetHit: true })
    }
  }
  player.ironGolemItem = null
  const playerSummonMgr = this.summonManagers.get(player.unitId)
  if (playerSummonMgr) {
    for (const activePet of [...playerSummonMgr.getActivePets()]) {
      const pUnitId = this.petUnitIds.get(activePet.uid)
      activePet.hp = 0
      activePet.alive = false
      this.petAuraScanners.delete(activePet.uid)
      if (typeof (playerSummonMgr as { removePetByUid?: (u: string) => unknown }).removePetByUid === 'function') {
        ;(playerSummonMgr as { removePetByUid: (u: string) => unknown }).removePetByUid(activePet.uid)
      }
      if (pUnitId !== undefined) {
        this.petUnitIds.delete(activePet.uid)
        this.petVisualStates.delete(pUnitId)
        this.broadcastToArea(player.areaId, {
          type: 'UnitRemove',
          unitType: 1,
          id: pUnitId,
          unitId: pUnitId,
        })
        this.emitToPlayer(player.unitId, {
          type: 'Merc',
          kind: 'assign',
          isSummonAction: true,
          summonAction: 0,
          petType: PET_TYPE_IDX_BY_NAME_113C[activePet.petType] ?? 1,
          mercId: pUnitId,
          ownerId: player.unitId,
          classId: activePet.classId ?? 363,
        })
      }
    }
  }

  const equippedOnDeath: ServerItemEntry[] = []
  const remainingItems: ServerItemEntry[] = []
  for (const item of player.items) {
    if (item.location === 'equipped') {
      equippedOnDeath.push(item)
    } else {
      remainingItems.push(item)
    }
  }
  player.items = remainingItems
  this.stopPlayerAura(player)
  this.syncPlayerItemAuras113c(player, true)
  // 1.13c `PLAYER_Kill` (`D2Game.dll` `0x6FC583A0` -> `STATES_ClearDeathStates`, #1989):
  // Purge all `States.txt` rows with `plrstaydeath == 0` (only `105` `alignment`, `108` `sync_warped`,
  // and `118` `corpse_noselect` have `plrstaydeath == 1`), so the player never respawns in town still
  // poisoned, chilled, frozen, or cursed.
  const deathPlayerCombat = this.playerCombat.get(player.unitId)
  for (const activeStateId of [...player.states]) {
    if (activeStateId === 105 || activeStateId === 108 || activeStateId === 118) continue
    deathPlayerCombat?.stateBus.removeState(activeStateId)
    this.clearUnitState(
      player.states,
      player.stateTimers,
      'player',
      player.unitId,
      player.areaId,
      activeStateId,
    )
  }
  if (deathPlayerCombat !== undefined) {
    for (const entry of deathPlayerCombat.stateBus.getActiveEntries()) {
      if (entry.stateId === 105 || entry.stateId === 108 || entry.stateId === 118) continue
      deathPlayerCombat.stateBus.removeState(entry.stateId)
      deathPlayerCombat.stateBus.removeState(entry.stateName)
    }
  }
  this.playerBoneArmorPool.delete(player.unitId)
  this.playerCycloneArmorPool.delete(player.unitId)

  const killerType = this.resolveKillerTypeForDeathPenalty(options)

  // 1.13c D2Game.dll `0x6FC583A0` -> `0x6FC58180` (`PLAYER_ApplyDeathGoldPenalty`):
  // `pct = min(clvl, 20)%` of `gold (stat 14) + goldBank (stat 15)`.
  const prevGold = player.gold
  const prevBank = player.goldBank
  const goldPenalty = applyDeathGoldPenalty113c(player.level, prevGold, prevBank, {
    killerType,
  })
  player.gold = goldPenalty.newGold
  player.goldBank = goldPenalty.newBank
  player.lastDeathGoldLoss = goldPenalty.goldLost
  if (player.gold !== prevGold) {
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 14,
      value: player.gold,
    })
  }
  if (player.goldBank !== prevBank) {
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 15,
      value: player.goldBank,
    })
  }
  if (goldPenalty.dropAmount > 0) {
    this.dropPlayerGoldPile(player, goldPenalty.dropAmount)
  }

  // 1.13c D2Game.dll `0x6FC583A0` -> `0x6FC57730`: deduct `DeathExpPenalty` (0/5/10% of the
  // current level's XP span) when not killed by a player or a player-owned pet, clamped at
  // `Exp(clvl - 1) + 1` so the player never loses a character level on death.
  const expPenalty = evaluateDeathExperiencePenalty113c({
    clvl: player.level,
    currentExp: player.experience,
    penaltyPct: difficultyDeathExpPenalty(this.difficulty),
    killerType,
    charClass: player.classCode,
  })
  player.lastDeathExpLoss = expPenalty.expLost
  if (expPenalty.newExp !== player.experience) {
    player.experience = expPenalty.newExp
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
  }

  this.broadcastToArea(player.areaId, {
    type: 'UnitMode',
    unitType: 0,
    id: player.unitId,
    mode: 17,
    at: playerWirePosition(player),
    lifePct: 0,
  })

  // 1.13c `D2Game.dll` `PLAYER_CreateCorpse` (`0x6FC58460`, #1924):
  // supports up to 16 concurrent unrecovered player corpses (`1` primary + `15` `extraCorpses`).
  // If 16 unrecovered corpses already exist (`17th+` death), equipped items drop directly onto
  // the ground instead of overwriting any of the 16 existing corpses!
  const hasExistingPrimary =
    player.corpseId !== undefined && this.hasLivePrimaryCorpse113c(player)
  const extras = player.extraCorpses ?? []
  const existingCorpseCount = (hasExistingPrimary ? 1 : 0) + extras.length

  if (existingCorpseCount >= 16) {
    const usedPositions = new Set<string>()
    for (const item of equippedOnDeath) {
      const dropPos = this.findDropPosition(player.areaId, player.x, player.y, usedPositions)
      usedPositions.add(`${dropPos.x}:${dropPos.y}`)
      item.location = 'ground'
      item.ownerId = 0
      item.areaId = player.areaId
      item.x = dropPos.x
      item.y = dropPos.y
      item.bodyLoc = 0
      item.storePage = 0
      for (const child of item.socketedItems ?? []) {
        child.ownerId = item.unitId
      }
      if (item.rawItemData !== undefined) {
        const cleanFlags =
          Number(item.rawItemData.rawFlags ?? item.rawItemData.flags ?? 0x10) & ~0x20
        item.rawItemData = {
          ...item.rawItemData,
          opcode: 0x9c,
          action: 0x02,
          ownerType: 0,
          ownerId: 0 as UnitId,
          location: 3,
          container: 'ground',
          bodyLoc: 0,
          equippedSlot: 0,
          gridX: 0,
          gridY: 0,
          storePage: 0,
          storagePage: 0,
          worldX: dropPos.x,
          worldY: dropPos.y,
          x: dropPos.x,
          y: dropPos.y,
          flags: cleanFlags,
          rawFlags: cleanFlags,
        }
      }
      this.registerGroundItem113c(item)
      this.broadcastToArea(player.areaId, {
        type: 'ItemEvent',
        action: 'drop',
        itemId: item.unitId,
        code: item.code,
        x: item.x,
        y: item.y,
        container: 'ground',
        item: { ...this.serverEntryToItemData(item), action: 0x02 },
      })
    }
  } else {
    if (hasExistingPrimary && player.corpseId !== undefined) {
      extras.push({
        corpseId: player.corpseId,
        areaId: player.corpseAreaId ?? player.areaId,
        x: player.corpseX,
        y: player.corpseY,
        items: [...player.corpseItems],
        lostExp: player.corpseLostExp ?? 0,
      })
      player.extraCorpses = extras
    }
    const corpseId = this.allocateUnitId(UNIT_TYPE_113C.player)
    player.corpseId = corpseId
    player.corpseAreaId = player.areaId
    player.corpseX = player.x
    player.corpseY = player.y
    player.corpseRequiresClick = false
    player.corpseItems = equippedOnDeath
    player.corpseLostExp = expPenalty.expLost

    const cx = Math.round(player.corpseX)
    const cy = Math.round(player.corpseY)
    this.broadcastToArea(player.areaId, {
      type: 'UnitAssign',
      unitType: 'player',
      unitId: corpseId,
      classId: player.classId,
      name: player.name,
      x: cx,
      y: cy,
      areaId: player.areaId,
      unit: {
        unitType: 0,
        id: corpseId,
        classId: player.classId,
        name: player.name,
        x: cx,
        y: cy,
        mode: 17,
      },
    })
    this.broadcastToArea(player.areaId, {
      type: 'UnitMode',
      unitType: 0,
      id: corpseId,
      mode: 17,
      at: { x: cx, y: cy },
      lifePct: 0,
    })
    this.broadcastToArea(player.areaId, {
      type: 'CorpseAssign',
      assign: 1,
      ownerId: player.unitId,
      corpseId,
    })
  }
  const killerPlayer = this.resolveRootKillerPlayer113c(options?.killerUnitId)
  if (killerPlayer !== undefined && killerPlayer.unitId !== player.unitId) {
    this.spawnPvpPlayerEar113c(player)
    const pvpSlainChat = buildPvpSlainEvent0x5A113c({
      victimName: player.name,
      victimLevel: player.level,
      victimIsHardcore: isHardcorePlayer,
      killerPlayerUnitId: killerPlayer.unitId,
      killerPlayerName: killerPlayer.name,
    })
    for (const peer of this.players.values()) {
      this.emitToPlayer(peer.unitId, pvpSlainChat)
    }
  } else if (isHardcorePlayer) {
    const killerName =
      options?.killerUnitId !== undefined
        ? (this.monsters.get(options.killerUnitId)?.name ??
          this.players.get(options.killerUnitId)?.name ??
          'an evil force')
        : 'an evil force'
    const deathChat: ServerEvent = {
      type: 'Chat',
      kind: 'event',
      eventType: 6,
      subType: 0,
      arg: player.level,
      name1: player.name,
      name2: killerName,
      text: `${player.name} was slain by ${killerName}. Your deeds of valor will be remembered.`,
    }
    for (const peer of this.players.values()) {
      this.emitToPlayer(peer.unitId, deathChat)
    }
  }
}



function handleRespawn(this: GameInstanceHost, player: InternalPlayerRecord): void {
  if (!player.dead) return
  // 1.13c `D2Game.dll` `0x6FD0B400` (`Packet_0x41_Resurrect`): Hardcore (`status & 0x04`) characters
  // cannot resurrect in town after dying (#1788).
  if (player.isHardcore === true || ((player.statusFlags ?? 0) & 0x04) !== 0) {
    return
  }
  player.dead = false
  player.hitRecoveryUntilFrame = 0
  player.staminaExhausted = false
  // 1.13c town resurrect restores full accrued vitals (including inventory charms & passives, #1996).
  this.refreshPlayerAccruedMaxPools(player, {
    fillHpIfAtBaseMax: true,
    fillManaIfAtBaseMax: true,
    fillStaminaIfAtBaseMax: true,
  })

  const townArea = ACT_TOWN_AREA[player.act] ?? 1
  player.mode = 5
  this.transitionPlayerArea(player, townArea, { kind: 'respawn' })
  this.emitToPlayer(player.unitId, {
    type: 'UnitStatUpdate',
    unitType: 'player',
    unitId: player.unitId,
    statId: 6,
    value: player.hpFixed,
  })
  this.emitToPlayer(player.unitId, {
    type: 'UnitStatUpdate',
    unitType: 'player',
    unitId: player.unitId,
    statId: 8,
    value: player.manaFixed,
  })
  this.emitToPlayer(player.unitId, {
    type: 'UnitStatUpdate',
    unitType: 'player',
    unitId: player.unitId,
    statId: 10,
    value: player.staminaFixed,
  })
  this.emitToPlayer(player.unitId, {
    type: 'LifeMana',
    life: player.hp,
    mana: player.mana,
    stamina: player.stamina,
    at: playerWirePosition(player),
    vx: 0,
    vy: 0,
  })
}



function hasLivePrimaryCorpse113c(this: GameInstanceHost, player: InternalPlayerRecord): boolean {
  return (
    player.corpseId !== undefined &&
    (player.corpseItems.length > 0 || (player.corpseLostExp ?? 0) > 0)
  )
}



function recoverPlayerCorpse(this: GameInstanceHost, player: InternalPlayerRecord): void {
  if (player.corpseId === undefined) return
  const oldCorpseId = player.corpseId
  const oldCorpseArea = player.corpseAreaId ?? player.areaId
  const oldCorpseX = player.corpseX
  const oldCorpseY = player.corpseY

  // 1.13c `D2Game.dll` `PLAYER_LootCorpse` (`0x6FC57A80`, #1924):
  // recovering a corpse in the same game refunds `75%` (`Math.floor(lostExp * 75 / 100)`)
  // of the XP lost on that death (`5% -> 1.25%` net in Nightmare, `10% -> 2.5%` net in Hell).
  const lostExp = Math.max(0, Math.trunc(player.corpseLostExp ?? 0))
  if (lostExp > 0) {
    const refundExp = Math.floor((lostExp * 75) / 100)
    player.corpseLostExp = 0
    player.lastDeathExpLoss = 0
    if (refundExp > 0) {
      const maxExp = experienceForLevel113c(MAX_PLAYER_LEVEL_113C)
      player.experience = Math.min(maxExp, player.experience + refundExp)
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
    }
  }

  // Equip corpse items in a fixed-point pass so `+Strength`/`+Dexterity` gear unlocked
  // by one item allows dependent items on the same corpse to re-equip cleanly (#1924).
  const tables = getEmbeddedDropTables()
  const combat = this.playerCombat.get(player.unitId)
  const pendingItems = [...player.corpseItems]
  for (const item of pendingItems) {
    item.ownerId = player.unitId
  }
  const unequipped: ServerItemEntry[] = []
  let remainingToTry = pendingItems
  let madeProgress = true
  while (madeProgress && remainingToTry.length > 0) {
    madeProgress = false
    const deferred: ServerItemEntry[] = []
    for (const item of remainingToTry) {
      const slot = item.bodyLoc
      const slotOccupied =
        slot > 0 &&
        player.items.some((e) => e.location === 'equipped' && e.bodyLoc === slot)
      if (slot <= 0 || slotOccupied) {
        deferred.push(item)
        continue
      }
      const currentlyEquipped = player.items.filter((e) => e.location === 'equipped')
      const check = canUnitEquipItem113c(
        {
          kind: 'player',
          level: player.level,
          baseStrength: player.strength,
          baseDexterity: player.dexterity,
          classCode: player.classCode,
        },
        item,
        slot as Parameters<typeof canUnitEquipItem113c>[2],
        currentlyEquipped,
        {
          dropTables: tables,
          computeAttributesWithoutDisplaced: () => ({
            strength:
              player.strength +
              this.sumPlayerItemStat(player, 0) +
              (combat === undefined ? 0 : combat.statList.getModifierBonus('strength')),
            dexterity:
              player.dexterity +
              this.sumPlayerItemStat(player, 2) +
              (combat === undefined ? 0 : combat.statList.getModifierBonus('dexterity')),
          }),
        },
      )
      if (check.allowed && check.displacedItems.length === 0) {
        item.location = 'equipped'
        player.items.push(item)
        this.emitToPlayer(player.unitId, {
          type: 'ItemEvent',
          action: 'equip',
          itemId: item.unitId,
          code: item.code,
          x: item.x,
          y: item.y,
          container: 'equipment',
          item: {
            ...this.serverEntryToItemData(item),
            opcode: 0x9d,
            action: 0x06,
            ownerType: 0,
            ownerId: player.unitId as UnitId,
            location: 1,
            bodyLoc: item.bodyLoc,
            equippedSlot: item.bodyLoc,
            container: 'equipment',
          },
        })
        madeProgress = true
      } else {
        deferred.push(item)
      }
    }
    remainingToTry = deferred
  }
  unequipped.push(...remainingToTry)

  const leftover: ServerItemEntry[] = []
  for (const item of unequipped) {
    const freeSlot = this.findFreeGridSlot(
      player,
      'inventory',
      item.width,
      item.height,
      10,
      4,
    )
    if (freeSlot) {
      item.location = 'inventory'
      item.storePage = 1
      item.x = freeSlot.x
      item.y = freeSlot.y
      player.items.push(item)
      this.emitToPlayer(player.unitId, {
        type: 'ItemEvent',
        action: 'pickup',
        itemId: item.unitId,
        code: item.code,
        x: item.x,
        y: item.y,
        container: 'inventory',
        item: this.serverEntryToItemData(item),
      })
    } else {
      leftover.push(item)
    }
  }
  this.refreshPlayerAccruedMaxPools(player)
  this.syncPlayerItemAuras113c(player, true)
  if (leftover.length > 0) {
    player.corpseItems = leftover
    player.corpseRequiresClick = true
    this.emitToPlayer(player.unitId, {
      type: 'PlaySound',
      unit: { unitType: 0, id: player.unitId },
      sound: 23,
    })
    return
  }
  player.corpseId = undefined
  player.corpseAreaId = undefined
  player.corpseRequiresClick = false
  player.corpseItems = []
  player.corpseLostExp = 0
  this.broadcastToArea(oldCorpseArea, {
    type: 'CorpseAssign',
    assign: 0,
    ownerId: player.unitId,
    corpseId: oldCorpseId,
    x: Math.round(oldCorpseX),
    y: Math.round(oldCorpseY),
  } as ServerEvent)
  this.broadcastToArea(oldCorpseArea, {
    type: 'UnitRemove',
    unitType: 0,
    id: oldCorpseId,
    unitId: oldCorpseId,
    areaId: oldCorpseArea,
  })
  if (player.extraCorpses && player.extraCorpses.length > 0) {
    const nextCorpse = player.extraCorpses.pop()!
    player.corpseId = nextCorpse.corpseId
    player.corpseAreaId = nextCorpse.areaId
    player.corpseX = nextCorpse.x
    player.corpseY = nextCorpse.y
    player.corpseItems = nextCorpse.items
    player.corpseLostExp = nextCorpse.lostExp ?? 0
  }
}



function lootOtherPlayerCorpse(this: GameInstanceHost, looter: InternalPlayerRecord, victim: InternalPlayerRecord): void {
  if (victim.corpseId === undefined || victim.corpseItems.length === 0) return
  const oldCorpseId = victim.corpseId
  const oldCorpseArea = victim.corpseAreaId ?? victim.areaId
  victim.corpseId = undefined
  victim.corpseAreaId = undefined
  victim.corpseRequiresClick = false
  const items = [...victim.corpseItems]
  victim.corpseItems = []
  for (const item of items) {
    item.ownerId = looter.unitId
    item.location = 'inventory'
    looter.items.push(item)
    this.emitToPlayer(looter.unitId, {
      type: 'ItemEvent',
      action: 'pickup',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: 'inventory',
      item: this.serverEntryToItemData(item),
    })
  }
  this.broadcastToArea(oldCorpseArea, {
    type: 'CorpseAssign',
    assign: 0,
    ownerId: victim.unitId,
    corpseId: oldCorpseId,
  })
  this.broadcastToArea(oldCorpseArea, {
    type: 'UnitRemove',
    unitType: 0,
    id: oldCorpseId,
    unitId: oldCorpseId,
  })
  if (victim.extraCorpses && victim.extraCorpses.length > 0) {
    const nextCorpse = victim.extraCorpses.pop()!
    victim.corpseId = nextCorpse.corpseId
    victim.corpseAreaId = nextCorpse.areaId
    victim.corpseX = nextCorpse.x
    victim.corpseY = nextCorpse.y
    victim.corpseItems = nextCorpse.items
  }
}



/** Apply a state without a timer (auras, absorb-limited armors): it lasts until cleared. */
function applyPersistentUnitState(this: GameInstanceHost, 
  states: Set<number>,
  timers: Map<number, number>,
  unitType: 'player' | 'monster',
  unitId: number,
  areaId: number,
  stateId: number,
): void {
  this.applyUnitState(states, timers, unitType, unitId, areaId, stateId, 0)
  timers.delete(stateId)
}



/** Remove a state immediately and broadcast its end (`UnitState` off + `StateEnd`). */
function clearUnitState(this: GameInstanceHost, 
  states: Set<number>,
  timers: Map<number, number>,
  unitType: 'player' | 'monster',
  unitId: number,
  areaId: number,
  stateId: number,
): void {
  if (!states.delete(stateId)) return
  timers.delete(stateId)
  if (unitType === 'player') {
    this.playerCombat.get(unitId)?.stateBus.removeState(stateId)
  } else {
    this.monsterCombat.get(unitId)?.stateBus.removeState(stateId)
    this.mercCombat.get(unitId)?.stateBus.removeState(stateId)
    this.petVisualStates.get(unitId)?.pet.stateBus.removeState(stateId)
  }
  this.broadcastToArea(areaId, {
    type: 'UnitState',
    unitType,
    unitId,
    state: stateId,
    active: false,
    areaId,
  })
  this.broadcastToArea(areaId, {
    type: 'StateEnd',
    unit: { unitType: unitType === 'player' ? 0 : 1, id: unitId },
    state: stateId,
  })
}



/** Frame on which each timed state was (re)applied, per unit timer map (see `stepUnitStates`). */
const stateTimerAppliedFrame113c = new WeakMap<Map<number, number>, Map<number, number>>()

/**
 * Sync a unit timer directly from an authoritative `StateBus` `expireFrame - currentFrame` value
 * so a later `stepUnitStates` pass on the same frame (`stepMonsters` / `stepMercenaries`) does not
 * double-decrement `rem` and expire the state 1 frame before `expireFrame`.
 */
export function syncUnitStateTimerFromExpireFrame113c(
  timers: Map<number, number>,
  stateId: number,
  rem: number,
  currentFrame: number,
): void {
  timers.set(stateId, rem)
  let appliedFrames = stateTimerAppliedFrame113c.get(timers)
  if (appliedFrames === undefined) {
    appliedFrames = new Map()
    stateTimerAppliedFrame113c.set(timers, appliedFrames)
  }
  appliedFrames.set(stateId, currentFrame)
}

function applyUnitState(this: GameInstanceHost, 
  states: Set<number>,
  timers: Map<number, number>,
  unitType: 'player' | 'monster',
  unitId: number,
  areaId: number,
  stateId: number,
  durationFrames: number,
): void {
  // 1.13c `STAT_ITEM_CANNOTBEFROZEN` (`stat 153`) & `STAT_ITEM_HALFFREEZEDURATION` (`stat 118`, #1939):
  // Applies to `state 11` (`cold` chill) and `state 1` (`freeze`) on players and mercenaries
  // (leaving `#114 Holy Freeze` `state 44` `holywindcold` unaffected).
  if (stateId === 11 || stateId === 1) {
    if (unitType === 'player') {
      const p = this.players.get(unitId)
      if (p !== undefined) {
        if (this.sumPlayerItemStat(p, 153) > 0) return
        if (durationFrames > 0 && this.sumPlayerItemStat(p, 118) > 0) {
          durationFrames = Math.floor(durationFrames / 2)
          if (durationFrames <= 0) return
        }
      }
    } else {
      const m = this.mercenaries.get(unitId)
      if (m !== undefined) {
        if (this.sumMercItemStat(m, 153) > 0) return
        if (durationFrames > 0 && this.sumMercItemStat(m, 118) > 0) {
          durationFrames = Math.floor(durationFrames / 2)
          if (durationFrames <= 0) return
        }
      }
    }
  }
  const incomingIsCurse = this.registry.getStateById(stateId)?.curse === true
  if (incomingIsCurse) {
    // 1.13c sub_6FCC00B0 (0x6FCC01C1): STATE_ATTRACT (57) blocks any incoming curse=1 state
    if (states.has(57)) {
      return
    }
    // 1.13c `curse_resistance` (`stat 109`, e.g. `#267 Fade`, `#109 Cleansing` aura, #1935):
    // Scales incoming curse duration by `(100 - clamp(curse_resistance, 0, 100))%`.
    // Note: shrines (`128..137`) and `cloaked` (`156`) have `curable = false`; only `curable` curses
    // or hostile monster/PvP curses (`stateId < 128`) are shortened by `curse_resistance`.
    if (durationFrames > 0 && stateId < 128) {
      let curseRes = 0
      if (unitType === 'player') {
        const p = this.players.get(unitId)
        if (p !== undefined) {
          const pCtx = this.playerCombatContext(p)
          curseRes = Math.min(100, Math.max(0, Math.trunc(pCtx.statList.getAccruedStat('curse_resistance'))))
          if (
            curseRes <= 0 &&
            (p.states.has(159) ||
              (p.states.has(157) && (p.skills.get(267) ?? 0) > 0 && (p.skills.get(258) ?? 0) === 0))
          ) {
            const fadeSlvl = Math.max(1, this.resolvePlayerSkillLevelById(p, 267))
            curseRes = Math.min(100, computeDiminishingReturns(40, 90, fadeSlvl))
          }
        }
      } else {
        const m = this.mercenaries.get(unitId)
        if (m !== undefined) {
          const mCtx = this.mercCombatContext(m)
          curseRes = Math.min(100, Math.max(0, Math.trunc(mCtx.statList.getAccruedStat('curse_resistance'))))
        }
      }
      if (curseRes >= 100) return
      if (curseRes > 0) {
        durationFrames = Math.floor((durationFrames * (100 - curseRes)) / 100)
        if (durationFrames <= 0) return
      }
    }
    // 1.13c STATLIST_CURSE (0x20) single slot: evict any existing curse=1 state (including shrines 128..137)
    for (const prevStateId of [...states]) {
      if (prevStateId !== stateId && this.registry.getStateById(prevStateId)?.curse === true) {
        states.delete(prevStateId)
        timers.delete(prevStateId)
        if (unitType === 'player') {
          this.playerCombat.get(unitId)?.stateBus.removeState(prevStateId)
        } else {
          this.monsterCombat.get(unitId)?.stateBus.removeState(prevStateId)
          this.mercCombat.get(unitId)?.stateBus.removeState(prevStateId)
          this.petVisualStates.get(unitId)?.pet.stateBus.removeState(prevStateId)
        }
        this.broadcastToArea(areaId, {
          type: 'UnitState',
          unitType,
          unitId,
          state: prevStateId,
          active: false,
          areaId,
        })
        this.broadcastToArea(areaId, {
          type: 'StateEnd',
          unit: { unitType: unitType === 'player' ? 0 : 1, id: unitId },
          state: prevStateId,
        })
      }
    }
  }
  states.add(stateId)
  timers.set(stateId, durationFrames)
  let appliedFrames = stateTimerAppliedFrame113c.get(timers)
  if (appliedFrames === undefined) {
    appliedFrames = new Map()
    stateTimerAppliedFrame113c.set(timers, appliedFrames)
  }
  appliedFrames.set(stateId, this.currentFrame)
  if (
    unitType === 'monster' &&
    (stateId === 1 || stateId === 29 || stateId === 21 || stateId === 25)
  ) {
    const m = this.monsters.get(unitId)
    if (m !== undefined) {
      m.pendingAttack = undefined
      m.pendingAllyAttack = undefined
      m.pendingResurrection = undefined
    }
  }
  const combatUnit =
    unitType === 'player'
      ? this.playerCombat.get(unitId)
      : this.monsterCombat.get(unitId) ??
        this.mercCombat.get(unitId) ??
        this.petVisualStates.get(unitId)?.pet
  const stateEntry = combatUnit?.stateBus.getActiveEntries().find((e) => e.stateId === stateId)
  let packetStats: { statId: number; param: number; value: number }[] | undefined
  if (stateEntry?.stats) {
    const list: { statId: number; param: number; value: number }[] = []
    for (const [statName, val] of Object.entries(stateEntry.stats)) {
      const rec = this.registry.getStatByName(statName)
      if (rec && Number.isFinite(val)) {
        list.push({ statId: rec.id, param: 0, value: Math.trunc(val) })
      }
    }
    if (list.length > 0) packetStats = list
  }
  this.broadcastToArea(areaId, {
    type: 'UnitState',
    unitType,
    unitId,
    state: stateId,
    active: true,
    areaId,
    ...(packetStats !== undefined ? { stats: packetStats } : {}),
  })
  this.broadcastToArea(areaId, {
    type: 'StateSet',
    unit: { unitType: unitType === 'player' ? 0 : 1, id: unitId },
    state: stateId,
    complete: true,
    ...(packetStats !== undefined ? { stats: packetStats } : {}),
  })
}



function stepUnitStates(this: GameInstanceHost, 
  states: Set<number>,
  timers: Map<number, number>,
  unitType: 'player' | 'monster',
  unitId: number,
  areaId: number,
): void {
  const appliedFrames = this.drlgRoomPopulator !== null ? stateTimerAppliedFrame113c.get(timers) : undefined
  for (const [stateId, rem] of timers.entries()) {
    // 1.13c `STATES_SetTimer`: the removal event fires on `nGameFrame + duration`; a state set earlier in
    // this frame is not aged until the next frame (oracle `p52-necromancer-curses`: Decrepify on zombie #9
    // set on F=697 with 100 frames is still present on F=796 and gone on F=797).
    if (appliedFrames?.get(stateId) === this.currentFrame) continue
    if (rem <= 1) {
      timers.delete(stateId)
      states.delete(stateId)
      if (unitType === 'player') {
        this.playerCombat.get(unitId)?.stateBus.removeState(stateId)
        if (stateId === 12) {
          this.playerChannelSkillId.delete(unitId)
          this.playerCombat.get(unitId)?.stateBus.removeState('inferno')
        } else if (stateId === 136) {
          // 0x6fc8a900 (SHRINES_ExpireStamina): clamp/refill STAT_STAMINA (10) to updated STAT_MAXSTAMINA (11).
          const p = this.players.get(unitId)
          if (p !== undefined && !p.dead) {
            this.refreshPlayerAccruedMaxPools(p, { fillStaminaIfAtBaseMax: true })
            this.emitPlayerVitals(p)
          }
        } else if (stateId === 26 || stateId === 32 || stateId === 51 || stateId === 139 || stateId === 140) {
          const p = this.players.get(unitId)
          if (p !== undefined && !p.dead) {
            if (stateId === 51) {
              const pCtx = this.playerCombatContext(p)
              this.syncPlayerSkillLevelsToStatList113c(p, pCtx.statList, pCtx.stateBus)
            }
            this.refreshPlayerAccruedMaxPools(p)
            this.emitPlayerVitals(p)
          }
        }
      } else {
        this.monsterCombat.get(unitId)?.stateBus.removeState(stateId)
        this.mercCombat.get(unitId)?.stateBus.removeState(stateId)
        this.petVisualStates.get(unitId)?.pet.stateBus.removeState(stateId)
      }
      this.broadcastToArea(areaId, {
        type: 'UnitState',
        unitType,
        unitId,
        state: stateId,
        active: false,
        areaId,
      })
      this.broadcastToArea(areaId, {
        type: 'StateEnd',
        unit: { unitType: unitType === 'player' ? 0 : 1, id: unitId },
        state: stateId,
      })
    } else {
      timers.set(stateId, rem - 1)
    }
  }
}



/** 1.13c `D2Common #10594` object interaction reach (unit size + object footprint). */
function playerInObjectRange(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  obj: InternalObjectRecord,
): boolean {
  return isObjectInInteractRange113c(
    player.x,
    player.y,
    PLAYER_SIZE_X_113C,
    obj.x,
    obj.y,
    obj.classId,
  )
}



/** 1.13c `D2Common #10407` NPC reach (deferred 0x13 arrival: <= 2). */
function playerInNpcRange(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npc: InternalMonsterRecord,
): boolean {
  return (
    D2Common_10399_AtSubtiles(
      Math.floor(npc.x),
      Math.floor(npc.y),
      npc.sizeX,
      Math.round(player.x),
      Math.round(player.y),
      PLAYER_SIZE_X_113C,
    ) <= NPC_INTERACT_DISTANCE_SUBTILES
  )
}



/** 500 ms warp/portal click cooldown (`[0x6fbc9828]`, 25 ticks/s). */
function consumeWarpCooldown(this: GameInstanceHost, player: InternalPlayerRecord): boolean {
  if (
    this.currentFrame - player.lastWarpInteractFrame <
    WARP_INTERACT_COOLDOWN_FRAMES
  ) {
    return false
  }
  player.lastWarpInteractFrame = this.currentFrame
  return true
}



function emitPlayerVitals(this: GameInstanceHost, player: InternalPlayerRecord): void {
  this.emitToPlayer(player.unitId, {
    type: 'LifeMana',
    life: player.hp,
    mana: player.mana,
    stamina: player.stamina,
    at: playerWirePosition(player),
    vx: 0,
    vy: 0,
  })
}



function setObjectMode(this: GameInstanceHost, obj: InternalObjectRecord, mode: number): void {
  if (obj.mode === mode) return
  obj.mode = mode
  this.areaPathWorld.setObjectMode(obj.unitId, mode)
  this.broadcastToArea(obj.areaId, {
    type: 'UnitMode',
    unitType: 2,
    id: obj.unitId,
    mode,
  })
}



/**
 * D2Game.dll `0x6fc8b070` (`SHRINES_DropItem`): spawns a normal-quality ground item
 * (chipped gem or throwing potion) at the shrine/player location.
 */
function dropShrineItem(this: GameInstanceHost, code: string, areaId: number, x: number, y: number): void {
  const tables = getEmbeddedDropTables()
  const base = tables.getBase(code)
  if (base === undefined) return
  const seed = this.rng.rand(0x7fffffff) >>> 0
  const item = createDroppedItem(base, 'normal', {
    itemTypes: tables.itemTypes,
    ilvl: 1,
    dwInitSeed: seed,
    itemRng: new D2Rng(seed || 1),
  })
  this.spawnDroppedItems([item], areaId, x, y)
}



/**
 * D2Game.dll `0x6fc8f930` (`SHRINES_CreateShrineMissile`): launches a server missile from
 * `(shrineX, shrineY)` toward `(targetX, targetY)` with `slvl = clamp(clvl / 5, 1, 8)`
 * when `pPlayer` is provided (or `slvl = 1` when `pPlayer == NULL`).
 */
function spawnShrineMissile(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  shrineX: number,
  shrineY: number,
  areaId: number,
  missileClassId: number,
  targetX: number,
  targetY: number,
  skillLevel: number,
): number {
  const meta = this.registry.getMissileById(missileClassId)
  const resolvedClassId = meta?.id ?? missileClassId
  const slvl = Math.max(1, Math.min(8, Math.trunc(skillLevel)))
  const dx = targetX - shrineX
  const dy = targetY - shrineY
  const stationary = (dx === 0 && dy === 0) || (meta !== undefined && meta.vel <= 0)
  const dist = Math.max(0.5, Math.hypot(dx, dy))
  const rawVel = meta === undefined ? 0 : meta.vel + Math.trunc((meta.velLev * slvl) / 8)
  const speed = stationary ? 0 : meta === undefined ? 1.0 : missileSpeedSubtilesPerFrame113c(rawVel)
  const rangeTicks =
    meta === undefined ? 25 : Math.max(1, meta.range + meta.levRange * slvl)
  const element: MissileDamageChannel =
    normalizeMissileElement(meta?.eType) ??
    (resolvedClassId === 48 ? 'pois' : 'fire')
  const hitShift = meta?.hitShift ?? 8
  const elemDurationFrames =
    meta === undefined
      ? 0
      : Math.max(0, compute3BandDuration(slvl, meta.eLen, meta.eLevLen1, meta.eLevLen2, meta.eLevLen3))
  const eMinRaw = meta === undefined ? 1 : meta.eMin + meta.eMinLev1 * (slvl - 1)
  const eMaxRaw = meta === undefined ? 2 : Math.max(eMinRaw, meta.eMax + meta.eMaxLev1 * (slvl - 1))
  const elemDamage = Math.max(1, Math.floor((eMinRaw * (1 << hitShift)) / FIXED_ONE))
  const poisonBitrate256 =
    element === 'pois' ? Math.max(1, eMinRaw * (1 << hitShift)) : undefined
  const missileUnitId = this.allocateUnitId(UNIT_TYPE_113C.missile)
  const missile: InternalMissileRecord = {
    unitId: missileUnitId,
    missileId: resolvedClassId,
    skillId: 0,
    ownerType: 'player',
    ownerId: player.unitId,
    areaId,
    x: shrineX,
    y: shrineY,
    vx: stationary ? 0 : (dx / dist) * speed,
    vy: stationary ? 0 : (dy / dist) * speed,
    damage: elemDamage,
    remainingFrames: rangeTicks,
    collideType: meta?.collideType ?? 3,
    size: Math.max(1, meta?.size ?? 1),
    pierce: meta !== undefined ? !meta.collideKill : false,
    nextHit: meta?.nextHit === true,
    nextDelay: Math.max(0, meta?.nextDelay ?? 0),
    element,
    physDamage: 0,
    elemDamage:
      element === 'pois' && poisonBitrate256 !== undefined && elemDurationFrames > 0
        ? Math.max(1, Math.floor((poisonBitrate256 * elemDurationFrames) / FIXED_ONE))
        : elemDamage,
    elemDurationFrames,
    ...(poisonBitrate256 !== undefined ? { poisonBitrate256 } : {}),
    hitCooldowns: new Map(),
    guaranteedHit: !(meta?.toHit ?? false),
  }
  missile.createdFrame = this.currentFrame
  this.missiles.set(missileUnitId, missile)
  this.broadcastToArea(areaId, {
    type: 'CreateMissile',
    missileId: missileUnitId,
    missileClassId: resolvedClassId,
    at: { x: Math.round(shrineX), y: Math.round(shrineY) },
    target: { x: Math.round(targetX), y: Math.round(targetY) },
    x: Math.round(shrineX),
    y: Math.round(shrineY),
    targetX: Math.round(targetX),
    targetY: Math.round(targetY),
    skillId: 0,
    level: slvl,
    ownerType: 0,
    ownerUnitType: 'player',
    ownerId: player.unitId,
    sourceUnitId: player.unitId,
    areaId,
  } as ServerEvent)
  return missileUnitId
}



/**
 * 1.13c `D2Game.dll` `0x6fc8da00` (`OperateFn 2`) + `0x6fd1a5f8` shrine dispatch table
 * (`count = 24` at `0x6fd27d4c`) across `Shrines.txt` `Code 0..22`.
 */
function applyShrineEffect(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  code: number,
  shrineUnitId = 0,
): void {
  // 0x6fc8db1c..0x6fc8db2b: out-of-range or null-fn entry (Code 0) falls back to 0x6fc89c00 (Refilling).
  const effectiveCode =
    code >= 1 && code <= 22 && CANONICAL_113C_SHRINES[code] !== undefined ? code : 1
  const shrineMeta = getShrineMeta113c(effectiveCode)
  const shrineObj = shrineUnitId > 0 ? this.objects.get(shrineUnitId) : undefined
  const shrineX = shrineObj?.x ?? player.x
  const shrineY = shrineObj?.y ?? player.y
  const areaId = shrineObj?.areaId ?? player.areaId

  if (shrineMeta.stateId > 0) {
    const stateId = shrineMeta.stateId
    const duration = shrineMeta.durationFrames
    // 0x6fc8a960 (SHRINES_AllocClearPreviousShrineStats): clear any existing shrine state 128..137 first.
    const combatCtx = this.playerCombatContext(player)
    for (let prevState = 128; prevState <= 137; prevState++) {
      if (prevState !== stateId && player.states.has(prevState)) {
        combatCtx.stateBus.removeState(prevState)
        this.clearUnitState(
          player.states,
          player.stateTimers,
          'player',
          player.unitId,
          player.areaId,
          prevState,
        )
        if (prevState === 136) {
          this.refreshPlayerAccruedMaxPools(player, { fillStaminaIfAtBaseMax: true })
        }
      }
    }
    this.applyUnitState(
      player.states,
      player.stateTimers,
      'player',
      player.unitId,
      player.areaId,
      stateId,
      duration,
    )
    let stats: Record<string, number> | undefined
    if (effectiveCode === 6) {
      // 0x6FC8ABB0 Armor Shrine (#1919): attaches ONLY `skill_armor_percent` (`171`), NEVER `item_armor_percent` (`16`).
      stats = buildArmorShrineStats113c(shrineMeta.arg0)
    } else if (effectiveCode === 7) {
      // 0x6FC8ACE0 Combat Shrine (#1919): snapshots touch-time Attack Rating (`STAT_TOHIT = 19`) + `damagepercent` (`25`).
      combatCtx.stateBus.removeState(stateId)
      this.syncPlayerSkillLevelsToStatList113c(player, combatCtx.statList, combatCtx.stateBus)
      const rawTouchAr =
        this.computePlayerBaseToHit113c(player) +
        Math.trunc(combatCtx.statList.getModifierBonus('tohit'))
      const touchArPct =
        this.computePlayerToHitPctBonus113c(player) +
        Math.trunc(combatCtx.statList.getModifierBonus('item_tohit_percent')) +
        Math.trunc(combatCtx.statList.getModifierBonus('passive_mastery_melee_th'))
      const currentAttackRating = Math.max(
        0,
        rawTouchAr + Math.trunc((rawTouchAr * touchArPct) / 100),
      )
      stats = buildCombatShrineSnapshot113c({
        currentAttackRating,
        arg0: shrineMeta.arg0,
        arg1: shrineMeta.arg1,
      })
    } else if (effectiveCode === 8) {
      stats = { fireresist: shrineMeta.arg0 }
    } else if (effectiveCode === 9) {
      stats = { coldresist: shrineMeta.arg0 }
    } else if (effectiveCode === 10) {
      stats = { lightresist: shrineMeta.arg0 }
    } else if (effectiveCode === 11) {
      stats = { poisonresist: shrineMeta.arg0 }
    } else if (effectiveCode === 12) {
      stats = { item_allskills: shrineMeta.arg0 }
    } else if (effectiveCode === 13) {
      stats = { manarecoverybonus: shrineMeta.arg0 }
    } else if (effectiveCode === 14) {
      stats = {
        skill_staminapercent: shrineMeta.arg0,
        staminarecoverybonus: 1000,
        item_staminadrainpct: -100,
      }
    } else if (effectiveCode === 15) {
      stats = { item_addexperience: shrineMeta.arg0 }
    }
    if (stats !== undefined) {
      combatCtx.stateBus.applyState({
        stateNameOrId: stateId,
        sourceSkillId: 0,
        slvl: 1,
        durationFrames: duration,
        stats,
      })
    }
    if (effectiveCode === 14) {
      // 0x6fc8ac30 (0x6fc8ac6c..0x6fc8acc5): Stamina Shrine applies state 136 (+200% skill_staminapercent,
      // +1000 staminarecoverybonus) and refills STAT_STAMINA (10) to accrued STAT_MAXSTAMINA (11).
      player.staminaExhausted = false
      this.refreshPlayerAccruedMaxPools(player, { fillStaminaIfAtBaseMax: true })
      this.emitPlayerVitals(player)
    }
    return
  }

  switch (effectiveCode) {
    case 1: // 0x6fc89c00 Refilling Shrine (and Code 0 fallback): restores full accrued HP (#10913) and Mana (#10186) (#1996)
      player.hpFixed = this.getPlayerAccruedMaxHpFixed(player)
      player.manaFixed = this.getPlayerAccruedMaxManaFixed(player)
      this.refreshPlayerAccruedMaxPools(player)
      this.emitPlayerVitals(player)
      break
    case 2: // 0x6fc898a0 Health Shrine: adds (accruedMaxHp - hp) -> restores 100% full life (#10913, #1996)
      player.hpFixed = this.getPlayerAccruedMaxHpFixed(player)
      this.refreshPlayerAccruedMaxPools(player)
      this.emitPlayerVitals(player)
      break
    case 3: // 0x6fc89860 Mana Shrine: adds (accruedMaxMana - mana) -> restores 100% full mana (#10186, #1996)
      player.manaFixed = this.getPlayerAccruedMaxManaFixed(player)
      this.refreshPlayerAccruedMaxPools(player)
      this.emitPlayerVitals(player)
      break
    case 4: { // 0x6fc89800 Health Exchange Shrine: takes Arg0% (50%) of current whole HP and adds Arg1% (500% = 5x) to Mana (clamped at #10186, #1996)
      const accruedMaxManaFixed = this.getPlayerAccruedMaxManaFixed(player)
      const hpWhole = player.hpFixed >> 8
      const takeWhole = Math.trunc((hpWhole * shrineMeta.arg0) / 100)
      const takeFixed = takeWhole << 8
      player.hpFixed = Math.max(FIXED_ONE, player.hpFixed - takeFixed)
      const addManaFixed = Math.trunc((takeFixed * shrineMeta.arg1) / 100)
      player.manaFixed = Math.min(accruedMaxManaFixed, player.manaFixed + addManaFixed)
      player.maxMana = Math.max(0, Math.floor(accruedMaxManaFixed / FIXED_ONE))
      player.hp = Math.ceil(player.hpFixed / FIXED_ONE)
      player.mana = Math.floor(player.manaFixed / FIXED_ONE)
      this.emitPlayerVitals(player)
      break
    }
    case 5: { // 0x6fc897a0 Mana Exchange Shrine: takes Arg0% (50%) of current fixed Mana and adds Arg1% (500% = 5x) to HP (clamped at #10913, #1996)
      const accruedMaxHpFixed = this.getPlayerAccruedMaxHpFixed(player)
      const takeFixed = Math.trunc((player.manaFixed * shrineMeta.arg0) / 100)
      player.manaFixed = Math.max(0, player.manaFixed - takeFixed)
      const addHpFixed = Math.trunc((takeFixed * shrineMeta.arg1) / 100)
      player.hpFixed = Math.min(accruedMaxHpFixed, player.hpFixed + addHpFixed)
      player.maxHp = Math.max(1, Math.floor(accruedMaxHpFixed / FIXED_ONE))
      player.hp = Math.ceil(player.hpFixed / FIXED_ONE)
      player.mana = Math.floor(player.manaFixed / FIXED_ONE)
      this.emitPlayerVitals(player)
      break
    }
    case 16: // 0x6fc89770 Enirhs Shrine: _strrev + strncpy(..., 0x10) on player name (does NOT heal HP/Mana/Stamina)
      player.name = [...player.name].reverse().join('').slice(0, 15)
      break
    case 17: // 0x6fc8b9b0 Portal Shrine: opens a public town portal pair
      this.openTownPortal(player, false, -Math.max(1, shrineUnitId), 'Shrine')
      break
    case 18: { // 0x6fc8b430 Gem Shrine: upgrades first carried gem with Misc.txt BetterGem != 'non ' (tier < 5), else drops random chipped gem
      let chosenGem: ServerItemEntry | undefined
      let nextGemInfo: (typeof GEM_INFO)[string] | undefined
      for (const item of player.items) {
        if (item.location !== 'inventory') continue
        const info = GEM_INFO[item.code.toLowerCase()]
        if (info === undefined || info.tier >= 5) continue
        const candidateNext = Object.values(GEM_INFO).find(
          (candidate) =>
            candidate.gemType === info.gemType && candidate.tier === info.tier + 1,
        )
        if (candidateNext !== undefined) {
          chosenGem = item
          nextGemInfo = candidateNext
          break
        }
      }
      if (chosenGem !== undefined && nextGemInfo !== undefined) {
        chosenGem.code = nextGemInfo.code
        chosenGem.name = nextGemInfo.nameEn
        chosenGem.rawItemData = {
          ...chosenGem.rawItemData,
          code: nextGemInfo.code,
          rawCode: nextGemInfo.code,
        } as typeof chosenGem.rawItemData
        this.emitToPlayer(player.unitId, {
          type: 'ItemEvent',
          action: 'update',
          itemId: chosenGem.unitId,
          code: chosenGem.code,
          container: 'inventory',
          item: this.serverEntryToItemData(chosenGem),
        })
      } else {
        // 0x6fc8b554: table ['gcw', 'gcr', 'gcg', 'gcb', 'gcy', 'gcv'] indexed by rand(6).
        const chipped = ['gcw', 'gcr', 'gcg', 'gcb', 'gcy', 'gcv'][this.rng.rand(6)]!
        this.dropShrineItem(chipped, areaId, shrineX, shrineY)
      }
      break
    }
    case 19: { // 0x6fc8c900 Fire Shrine: cuts HP of living units in 3x3 active room neighborhood (D2Common.#10052) by Arg0% (50%, min 1 HP) + perimeter fireball ring (missileId 62) (#1953)
      const areaRooms = this.loadedAreas.get(areaId)?.roomRects
      for (const targetPlayer of this.players.values()) {
        if (targetPlayer.dead || targetPlayer.areaId !== areaId) continue
        if (!isWithinShrineActiveRoomNeighborhood113c(shrineX, shrineY, targetPlayer.x, targetPlayer.y, areaRooms)) {
          continue
        }
        const hpWhole = targetPlayer.hpFixed >> 8
        const lossFixed = Math.trunc((hpWhole * shrineMeta.arg0) / 100) << 8
        targetPlayer.hpFixed = Math.max(FIXED_ONE, targetPlayer.hpFixed - lossFixed)
        targetPlayer.hp = Math.ceil(targetPlayer.hpFixed / FIXED_ONE)
        this.emitPlayerVitals(targetPlayer)
      }
      for (const monster of this.monsters.values()) {
        if (monster.dead || monster.isNpc || monster.isVendor || monster.areaId !== areaId) {
          continue
        }
        if (!isWithinShrineActiveRoomNeighborhood113c(shrineX, shrineY, monster.x, monster.y, areaRooms)) {
          continue
        }
        const loss = Math.trunc((monster.hp * shrineMeta.arg0) / 100)
        monster.hp = Math.max(1, monster.hp - loss)
        this.broadcastToArea(areaId, {
          type: 'UnitStatUpdate',
          unitType: 'monster',
          unitId: monster.unitId,
          statId: 6,
          value: monster.hp,
        })
      }
      const slvl = Math.max(1, Math.min(8, Math.trunc(player.level / 5)))
      for (let offset = -20; offset <= 20; offset += 5) {
        this.spawnShrineMissile(player, shrineX, shrineY, areaId, 62, shrineX + offset, shrineY - 20, slvl)
        this.spawnShrineMissile(player, shrineX, shrineY, areaId, 62, shrineX + offset, shrineY + 20, slvl)
        this.spawnShrineMissile(player, shrineX, shrineY, areaId, 62, shrineX - 20, shrineY + offset, slvl)
        this.spawnShrineMissile(player, shrineX, shrineY, areaId, 62, shrineX + 20, shrineY + offset, slvl)
      }
      break
    }
    case 20: { // 0x6fc8b8a0 Monster Shrine: scans 3x3 active room neighborhood (D2Common.#10314 + 0x6fc8a440) and promotes nearest eligible normal monster in place (0x6fc44b70, bSpawnMinions=0) (#1953)
      const areaRooms = this.loadedAreas.get(areaId)?.roomRects
      let nearest: InternalMonsterRecord | undefined
      let bestDistSq = Number.POSITIVE_INFINITY
      for (const candidate of this.monsters.values()) {
        if (
          candidate.areaId !== areaId ||
          candidate.boneConstructOwnerPlayerId !== undefined ||
          !isEligibleMonsterShrineTarget113c(candidate) ||
          !isWithinShrineActiveRoomNeighborhood113c(shrineX, shrineY, candidate.x, candidate.y, areaRooms)
        ) {
          continue
        }
        const dx = candidate.x - shrineX
        const dy = candidate.y - shrineY
        const distSq = dx * dx + dy * dy
        if (distSq < bestDistSq) {
          bestDistSq = distSq
          nearest = candidate
        }
      }
      if (nearest !== undefined) {
        const diffName =
          this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal'
        const newRank: MonsterRank = this.rng.rand(100) < 20 ? 'champion' : 'unique'
        const rolledMods = rollEliteModifiers(newRank, this.rng, {
          difficulty: diffName,
          monster: {
            hcIdx: nearest.hcIdx,
            monType: nearest.monType,
            isMelee: !nearest.isRanged,
          },
        })
        const umodIds = [
          ...new Set([
            ...nearest.umodIds,
            ...resolveMonsterUModIds(rolledMods),
          ]),
        ]
        const kind = getMonsterKindByHcIdx(nearest.hcIdx, diffName)
        const resolved =
          kind !== undefined
            ? resolveMonsterStats(kind, {
                difficulty: diffName,
                rank: newRank,
                modifiers: rolledMods,
                playersCount: this.playersX,
                areaLevel: nearest.level,
              })
            : undefined
        const resolved1p =
          kind !== undefined
            ? resolveMonsterStats(kind, {
                difficulty: diffName,
                rank: newRank,
                modifiers: rolledMods,
                playersCount: 1,
                areaLevel: nearest.level,
              })
            : undefined
        const hpMult = newRank === 'unique'
          ? (this.difficulty === 2 ? 2 : this.difficulty === 1 ? 3 : 4)
          : (this.difficulty === 2 ? 2 : this.difficulty === 1 ? 2.5 : 3)
        const xpMult = newRank === 'unique' ? 5 : 3
        nearest.rank = newRank
        nearest.isBoss = newRank === 'unique'
        nearest.modifiers = [...rolledMods]
        nearest.umodIds = umodIds
        nearest.uncursable = isMonsterUncursable113c(umodIds, resolved?.uncursable ?? nearest.uncursable)
        nearest.alwaysRunAi = isAlwaysRunAiMonster113c(umodIds, nearest.alwaysRunAi)
        nearest.level = resolved?.level ?? (nearest.level + (newRank === 'unique' ? 3 : 2))
        nearest.maxHp = Math.max(nearest.maxHp + 1, resolved?.maxHp ?? Math.round(nearest.maxHp * hpMult))
        nearest.hp = nearest.maxHp
        nearest.baseXp = Math.max(nearest.baseXp + 1, resolved1p?.xp ?? nearest.baseXp * xpMult)
        nearest.experience = nearest.unscaledXp
          ? nearest.baseXp
          : Math.max(0, Math.floor((nearest.baseXp * (this.playersX + 1)) / 2))
        if (resolved !== undefined) {
          nearest.minDmg = Math.max(nearest.minDmg, resolved.attack1?.minDamage ?? resolved.damage ?? nearest.minDmg)
          nearest.maxDmg = Math.max(nearest.minDmg, resolved.attack1?.maxDamage ?? resolved.damage ?? nearest.maxDmg)
          nearest.ar = Math.max(nearest.ar, resolved.toHit ?? nearest.ar)
          nearest.ac = Math.max(nearest.ac, resolved.armor ?? nearest.ac)
          nearest.resistances = {
            phys: resolved.resistances?.physical ?? nearest.resistances.phys,
            magic: resolved.resistances?.magic ?? nearest.resistances.magic,
            fire: resolved.resistances?.fire ?? nearest.resistances.fire,
            light: resolved.resistances?.lightning ?? nearest.resistances.light,
            cold: resolved.resistances?.cold ?? nearest.resistances.cold,
            poison: resolved.resistances?.poison ?? nearest.resistances.poison,
          }
        }
        if (umodIds.includes(MON_UMOD.GHOSTLY)) {
          nearest.velocity = Math.max(1, Math.floor(nearest.velocity / 2))
          nearest.runSpeed = Math.max(1, Math.floor(nearest.runSpeed / 2))
        } else if (umodIds.includes(MON_UMOD.FAST) || umodIds.includes(MON_UMOD.FANATIC)) {
          nearest.velocity = nearest.velocity * 2
          nearest.runSpeed = nearest.runSpeed * 2
        }
        if (umodIds.includes(MON_UMOD.FAST)) {
          nearest.cooldownTicks = Math.max(1, Math.floor(nearest.cooldownTicks * 0.5))
        } else if (umodIds.includes(MON_UMOD.FANATIC)) {
          nearest.cooldownTicks = Math.max(1, Math.floor((nearest.cooldownTicks * 30) / 100))
        }
        if (umodIds.includes(MON_UMOD.AURA) && nearest.auraSkillId === undefined) {
          const enchantedAura = rollAuraEnchanted113c(
            nearest.level,
            nearest.hcIdx + nearest.areaId,
            undefined,
          )
          nearest.auraSkillId = enchantedAura.auraSkillId
          nearest.auraLevel = enchantedAura.auraLevel
        }
        this.broadcastToArea(areaId, {
          type: 'UnitAssign',
          unitType: 'monster',
          unitId: nearest.unitId,
          classId: nearest.classId,
          name: nearest.name,
          x: nearest.x,
          y: nearest.y,
          areaId: nearest.areaId,
          unit: {
            unitType: 1,
            id: nearest.unitId,
            classId: nearest.classId,
            name: nearest.name,
            x: nearest.x,
            y: nearest.y,
            mode: nearest.mode,
            lifePct: 128,
            ...(nearest.umodIds.length > 0 ? { bossMods: [...nearest.umodIds] } : {}),
          },
        })
      }
      break
    }
    case 21: // 0x6fc8c580 Exploding Shrine: drops 5..9 'opm' potions and launches 6 explosivepotion (45) missiles
    case 22: { // 0x6fc8c200 Poison Shrine: drops 5..9 'gpm' potions and launches 6 chokinggaspoition (48) missiles
      const potionCode = effectiveCode === 21 ? 'opm' : 'gpm'
      const missileClassId = effectiveCode === 21 ? 45 : 48
      const span = Math.max(0, shrineMeta.arg1 - shrineMeta.arg0)
      const count = shrineMeta.arg0 + (span > 0 ? this.rng.rand(span) : 0)
      for (let i = 0; i < count; i++) {
        this.dropShrineItem(potionCode, areaId, shrineX, shrineY)
      }
      // 0x6FC8C798..0x6FC8C7C4 (#1920): 6 distinct radial coordinate offsets at `slvl = clamp(clvl / 5, 1, 8)`.
      const slvl = computeShrineMissileSlvl113c(player.level)
      for (const [dx, dy] of EXPLODING_POISON_SHRINE_OFFSETS_113C) {
        this.spawnShrineMissile(
          player,
          shrineX,
          shrineY,
          areaId,
          missileClassId,
          shrineX + dx,
          shrineY + dy,
          slvl,
        )
      }
      break
    }
    default:
      break
  }
}



function consumeKey(this: GameInstanceHost, player: InternalPlayerRecord): boolean {
  // 1.13c PLR_UseKey: Assassins pick locks without spending a key.
  if (player.classId === 6) return true
  const key = player.items.find(
    (item) => item.location === 'inventory' && item.code.toLowerCase() === 'key',
  )
  if (!key) return false
  key.quantity -= 1
  if (key.rawItemData !== undefined) key.rawItemData = { ...key.rawItemData, quantity: key.quantity }
  if (key.quantity <= 0) {
    const keyDeletedBase = this.serverEntryToItemData(key)
    const keyDeletedFlags = ((keyDeletedBase.rawFlags ?? 0x10) | 0x20) >>> 0
    player.items = player.items.filter((item) => item !== key)
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'remove',
      itemId: key.unitId,
      code: key.code,
      x: key.x,
      y: key.y,
      container: 'inventory',
      item: {
        ...keyDeletedBase,
        flags: keyDeletedFlags,
        rawFlags: keyDeletedFlags,
      },
    })
  } else {
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'update',
      itemId: key.unitId,
      code: key.code,
      container: 'inventory',
      item: this.serverEntryToItemData(key),
    })
  }
  return true
}



/**
 * 1.13c `D2Game.dll` `0x6fc8cee0` (`OperateFn 22`), `0x6fc8a560` (`OBJECTS_UseWell`),
 * `0x6fc89de0` (pet/hireling heal + cure), and `0x6fcdc920` (`STATES_ClearCurableStates`):
 * - Returns immediately when `wellCharges <= 0` (`bInteractType == 0`).
 * - Restores `(max * Parm1) >> 8` (`50%` of max) to player HP (`Parm3 & 2`), Mana (`Parm3 & 1`),
 *   and Stamina (unconditional on `Parm3`).
 * - Cures `STATE_FREEZE (1)`, `STATE_POISON (2)`, and `States.txt` `curable == 1` curses
 *   (`9, 19, 55, 60, 61, 113, 114`) on the player and pets, and heals alive mercenaries/pets to 100% HP.
 * - If nothing was healed or cured (`bUsed == 0`), returns without consuming a charge or scheduling `Event 2`.
 * - Otherwise decrements `wellCharges`, updates mode (`2 -> 0`, `1 -> 1`, `0 -> 2`), and schedules
 *   `Object Event 2` (`0x6fc89ca0`) at `currentFrame + Parm0 + 1` (`currentFrame + 751`).
 */
function operateWell113c(this: GameInstanceHost, player: InternalPlayerRecord, obj: InternalObjectRecord): void {
  if (obj.wellCharges <= 0) return
  const objTxt =
    obj.classId >= 0 && obj.classId < OBJECTS_TXT_113C.length
      ? OBJECTS_TXT_113C[obj.classId]
      : undefined
  const parm0 = objTxt && objTxt.parm0 > 0 ? objTxt.parm0 : WELL_DEFAULT_PARMS_113C.parm0
  const parm1 = WELL_DEFAULT_PARMS_113C.parm1
  const parm2 = WELL_DEFAULT_PARMS_113C.parm2
  const parm3 = WELL_DEFAULT_PARMS_113C.parm3

  if (player.hp * FIXED_ONE < player.hpFixed) {
    player.hpFixed = Math.max(0, player.hp * FIXED_ONE)
  }
  if (player.mana * FIXED_ONE < player.manaFixed) {
    player.manaFixed = Math.max(0, player.mana * FIXED_ONE)
  }
  if (player.stamina * FIXED_ONE < player.staminaFixed) {
    player.staminaFixed = Math.max(0, player.stamina * FIXED_ONE)
  }

  const accruedMaxHpFixed = this.getPlayerAccruedMaxHpFixed(player)
  const accruedMaxManaFixed = this.getPlayerAccruedMaxManaFixed(player)
  const accruedMaxStaminaFixed = this.getPlayerAccruedMaxStaminaFixed(player)
  player.maxHp = Math.max(1, Math.floor(accruedMaxHpFixed / FIXED_ONE))
  player.maxMana = Math.max(0, Math.floor(accruedMaxManaFixed / FIXED_ONE))
  player.maxStamina = Math.max(1, Math.floor(accruedMaxStaminaFixed / FIXED_ONE))

  let bUsed = false

  if ((parm3 & 2) !== 0 && player.hpFixed < accruedMaxHpFixed) {
    const deltaHp = computeWellHealDeltaFixed113c(accruedMaxHpFixed, parm1)
    player.hpFixed = Math.min(accruedMaxHpFixed, player.hpFixed + deltaHp)
    player.hp = Math.min(player.maxHp, Math.ceil(player.hpFixed / FIXED_ONE))
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 6,
      value: player.hpFixed,
    })
    bUsed = true
  }

  if ((parm3 & 1) !== 0 && player.manaFixed < accruedMaxManaFixed) {
    const deltaMana = computeWellHealDeltaFixed113c(accruedMaxManaFixed, parm1)
    player.manaFixed = Math.min(accruedMaxManaFixed, player.manaFixed + deltaMana)
    player.mana = Math.min(player.maxMana, Math.floor(player.manaFixed / FIXED_ONE))
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 8,
      value: player.manaFixed,
    })
    bUsed = true
  }

  if (player.staminaFixed < accruedMaxStaminaFixed) {
    const deltaStamina = computeWellHealDeltaFixed113c(accruedMaxStaminaFixed, parm1)
    player.staminaFixed = Math.min(accruedMaxStaminaFixed, player.staminaFixed + deltaStamina)
    player.stamina = Math.min(player.maxStamina, Math.floor(player.staminaFixed / FIXED_ONE))
    if (player.staminaFixed * 4 >= accruedMaxStaminaFixed) {
      player.staminaExhausted = false
    }
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 10,
      value: player.staminaFixed,
    })
    bUsed = true
  }

  const combatCtx = this.playerCombat.get(player.unitId)
  for (const stateId of WELL_CURABLE_STATE_IDS_113C) {
    const hasState =
      player.states.has(stateId) || Boolean(combatCtx?.stateBus.hasState(stateId))
    if (hasState) {
      this.clearUnitState(
        player.states,
        player.stateTimers,
        'player',
        player.unitId,
        player.areaId,
        stateId,
      )
      combatCtx?.stateBus.removeState(stateId)
      bUsed = true
    }
  }

  for (const merc of this.mercenaries.values()) {
    if (merc.ownerPlayerId === player.unitId && merc.alive) {
      if (merc.hp < merc.maxHp) {
        merc.hp = merc.maxHp
        this.broadcastAllyHp(merc.areaId, merc.unitId, merc.hp)
        bUsed = true
      }
      if (this.cleanseMercenaryCurableStates113c(merc)) {
        bUsed = true
      }
    }
  }

  const mgr = this.summonManagers.get(player.unitId)
  if (mgr !== undefined) {
    for (const pet of mgr.getActivePets()) {
      if (pet.alive === false || pet.maxHp <= 0) continue
      if (pet.hp < pet.maxHp) {
        pet.hp = pet.maxHp
        const petUnitId = this.petUnitIds.get(pet.uid)
        if (petUnitId !== undefined) {
          this.broadcastAllyHp(player.areaId, petUnitId, pet.hp)
        }
        bUsed = true
      }
      for (const stateId of WELL_CURABLE_STATE_IDS_113C) {
        if (pet.stateBus.hasState(stateId)) {
          pet.stateBus.removeState(stateId)
          bUsed = true
        }
      }
    }
  }

  if (!bUsed) return

  this.emitPlayerVitals(player)
  obj.wellCharges = Math.max(0, obj.wellCharges - 1)
  const nextMode = computeWellModeForCharges113c(obj.wellCharges, parm2)
  if (nextMode !== undefined) {
    this.setObjectMode(obj, nextMode)
  }
  obj.wellRegenFrames.push(computeWellRegenFrame113c(this.currentFrame, parm0))
}



/**
 * 1.13c `D2Game.dll` `0x6fc8e0e0` (`OperateFn 30`: `250 a trap`, `454 explodingchest`),
 * `0x6fd142d0` (`SUNITDMG_ApplyObjectTrapDamage`), and `0x6fc8e150` (`Object Event 9`):
 * - Applies two sequential `0x6fd142d0` hits to `player`: physical (`nDamageType = 0`) then
 *   fire (`nDamageType = 1`), each rolling `[hp >> 5, hp >> 3]` scaled by `monLvl / 100`.
 * - For `454` (`explodingchest`), executes the `0x6fc8b570` chest item drop (`Event 9`).
 */
function operateTrapObject113c(this: GameInstanceHost, player: InternalPlayerRecord, obj: InternalObjectRecord): void {
  const monLvl = getLevelMonsterLevel113c(obj.areaId, this.difficulty)
  if (!player.dead) {
    const hp256BeforePhys =
      player.hp * FIXED_ONE < player.hpFixed
        ? Math.max(0, player.hp * FIXED_ONE)
        : player.hpFixed
    const physDmg256 = rollObjectTrapDamage256_113c(hp256BeforePhys, monLvl, this.rng)
    if (physDmg256 > 0) {
      this.applyPlayerElementalDamage(
        player,
        { phys: Math.max(1, Math.floor(physDmg256 / FIXED_ONE)) },
        { killerType: 'trap', killerUnitId: obj.unitId },
      )
    }
  }
  if (!player.dead && player.hpFixed > 0) {
    const fireDmg256 = rollObjectTrapDamage256_113c(player.hpFixed, monLvl, this.rng)
    if (fireDmg256 > 0) {
      this.applyPlayerElementalDamage(
        player,
        { fire: Math.max(1, Math.floor(fireDmg256 / FIXED_ONE)) },
        { killerType: 'trap', killerUnitId: obj.unitId },
      )
    }
  }
  if (obj.classId === 454) {
    this.rollContainerDrop(player, obj, 100)
  }
}



/**
 * 1.13c `D2Game.dll` `0x6fc8d740` (`OperateFn 7`, `11 BarrelExploding`), `0x6fc8ad60`,
 * and `0x6fc8ae60`:
 * - Transitions the exploding barrel through mode `1 -> 2`.
 * - Deals `0x6fd142d0` physical trap damage (`nDamageType = 0`) to all living players and
 *   killable monsters within Euclidean subtile distance `<= 3`.
 * - Chain-detonates any other neutral (`mode === 0`) exploding barrel within distance `<= 2`.
 */
function detonateExplodingBarrel113c(this: GameInstanceHost, 
  barrel: InternalObjectRecord,
  operator?: InternalPlayerRecord,
): void {
  this.setObjectMode(barrel, 1)
  this.setObjectMode(barrel, 2)
  const monLvl = getLevelMonsterLevel113c(barrel.areaId, this.difficulty)

  for (const targetPlayer of this.players.values()) {
    if (targetPlayer.dead || targetPlayer.areaId !== barrel.areaId) continue
    if (Math.hypot(targetPlayer.x - barrel.x, targetPlayer.y - barrel.y) > 3) continue
    const hp256 =
      targetPlayer.hp * FIXED_ONE < targetPlayer.hpFixed
        ? Math.max(0, targetPlayer.hp * FIXED_ONE)
        : targetPlayer.hpFixed
    const physDmg256 = rollObjectTrapDamage256_113c(hp256, monLvl, this.rng)
    if (physDmg256 > 0) {
      this.applyPlayerElementalDamage(
        targetPlayer,
        { phys: Math.max(1, Math.floor(physDmg256 / FIXED_ONE)) },
        { killerType: 'trap', killerUnitId: barrel.unitId },
      )
    }
  }

  for (const monster of this.monsters.values()) {
    if (
      monster.dead ||
      monster.isNpc ||
      monster.isVendor ||
      !monster.isKillable ||
      monster.areaId !== barrel.areaId
    ) {
      continue
    }
    if (Math.hypot(monster.x - barrel.x, monster.y - barrel.y) > 3) continue
    const physDmg256 = rollObjectTrapDamage256_113c(monster.hp * FIXED_ONE, monLvl, this.rng)
    const rawPhys = Math.max(1, Math.floor(physDmg256 / FIXED_ONE))
    const dealt =
      monster.resistances.phys >= 100
        ? 0
        : Math.max(1, Math.round((rawPhys * (100 - monster.resistances.phys)) / 100))
    if (dealt > 0) {
      monster.hp = Math.max(0, monster.hp - dealt)
      this.broadcastToArea(monster.areaId, {
        type: 'UnitStatUpdate',
        unitType: 'monster',
        unitId: monster.unitId,
        statId: 6,
        value: monster.hp,
      })
      if (monster.hp <= 0) {
        this.applyMonsterDeath(monster, operator, 'phys')
      }
    }
  }

  for (const other of this.objects.values()) {
    if (
      other.unitId === barrel.unitId ||
      other.areaId !== barrel.areaId ||
      other.mode !== 0 ||
      getObjectsTxtRecord113c(other.classId).operateFn !== 7
    ) {
      continue
    }
    if (Math.hypot(other.x - barrel.x, other.y - barrel.y) <= 2) {
      this.detonateExplodingBarrel113c(other, operator)
    }
  }
}



function isAncientsEncounterActive(this: GameInstanceHost, areaId: number): boolean {
  const activeAncients = [...this.monsters.values()].filter(
    (m) =>
      m.areaId === areaId &&
      m.superUniqueId !== undefined &&
      ANCIENT_BARBARIANS_113C.some((b) => b.superUniqueId === m.superUniqueId),
  )
  if (activeAncients.length === 0) return false
  const deaths = this.ancientDeaths.get(areaId)
  return (
    activeAncients.some((m) => !m.dead) ||
    (deaths?.size ?? 0) < ANCIENT_BARBARIANS_113C.length
  )
}



function relocatePlayerFollowersToPlayer(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  emitReassign: boolean,
): void {
  const px = Math.floor(player.x + 0.5)
  const py = Math.floor(player.y + 0.5)
  for (const merc of this.mercenaries.values()) {
    if (merc.ownerPlayerId !== player.unitId || !merc.alive) continue
    // 1.13c D2Game.dll 0x6fcb71f0..0x6fcb7317: unlink follower from old room, spawn in new room at MONMODE_NEUTRAL (1).
    this.areaPathWorld.removeMonster(merc.unitId)
    merc.areaId = player.areaId
    merc.x = player.x
    merc.y = player.y
    merc.mode = 1
    merc.state = 'idle'
    if (merc.oracleMercAi113c !== undefined) {
      merc.oracleMercAi113c.activeVelBonus = 0
      merc.oracleMercAi113c.ovPathType = 0
      merc.oracleMercAi113c.ovVelocity = 0
      merc.oracleMercAi113c.ovNewDist = 0
      merc.oracleMercAi113c.actionFrame = 0
      merc.oracleMercAi113c.animEndFrame = 0
      merc.oracleMercAi113c.pendingAction = undefined
    }
    this.areaPathWorld.spawnMonster(
      player.areaId,
      {
        unitId: merc.unitId,
        hcIdx: merc.classId,
        areaId: player.areaId,
        x: px,
        y: py,
        mode: 1,
        dead: false,
      },
      this.currentFrame,
    )
    if (emitReassign) {
      this.broadcastToArea(player.areaId, {
        type: 'UnitReassign',
        unitType: 1,
        id: merc.unitId,
        unitId: merc.unitId,
        at: { x: Math.round(merc.x), y: Math.round(merc.y) },
        x: merc.x,
        y: merc.y,
        snap: true,
        areaId: player.areaId,
      })
    }
  }
  const mgr = this.summonManagers.get(player.unitId)
  if (mgr !== undefined) {
    for (const pet of mgr.getActivePets()) {
      if (pet.alive === false || pet.hp <= 0) continue
      if (resolvePetAiProfile113c(pet).isStationary) continue
      const petUnitId = this.resolvePetUnitId(pet)
      this.areaPathWorld.removeMonster(petUnitId)
      pet.x = player.x
      pet.y = player.y
      pet.mode = 1
      if (pet.oracleAi113c !== undefined) {
        pet.oracleAi113c.ovPathType = 0
        pet.oracleAi113c.ovVelocity = 0
        pet.oracleAi113c.ovNewDist = 0
      }
      const petMeta = pet as unknown as { areaId?: number }
      petMeta.areaId = player.areaId
      this.areaPathWorld.spawnMonster(
        player.areaId,
        {
          unitId: petUnitId,
          hcIdx: pet.classId ?? 363,
          areaId: player.areaId,
          x: px,
          y: py,
          mode: 1,
          dead: false,
        },
        this.currentFrame,
      )
      if (emitReassign) {
        this.broadcastToArea(player.areaId, {
          type: 'UnitReassign',
          unitType: 1,
          id: petUnitId,
          unitId: petUnitId,
          at: { x: Math.round(pet.x), y: Math.round(pet.y) },
          x: pet.x,
          y: pet.y,
          snap: true,
          areaId: player.areaId,
        })
      }
    }
  }
}



function spawnEvilUrnAmbush113c(this: GameInstanceHost, urn: InternalObjectRecord): void {
  const members = planEvilUrnPack113c(urn.areaId, this.difficulty, this.rng)
  const hasLoadedArea = this.loadedAreas.has(urn.areaId)
  for (const m of members) {
    const targetX = urn.x + m.dx
    const targetY = urn.y + m.dy
    const stand = hasLoadedArea
      ? findStandableNear(
          (x, y) => this.isWorldWalkableForPlayer(urn.areaId, x, y),
          targetX,
          targetY,
          100,
        )
      : null
    if (hasLoadedArea && stand === null) continue
    const sx = stand?.x ?? targetX
    const sy = stand?.y ?? targetY
    this.spawnMonster({
      defId: m.defId,
      ...(m.hcIdx !== undefined ? { classId: m.hcIdx } : {}),
      x: sx,
      y: sy,
      areaId: urn.areaId,
      rank: m.rank,
      modifiers: [...m.modifiers],
      statSeed: this.rng.rand(0x7fffffff) || 1,
    })
  }
}



/**
 * Spawn a missile projectile emitted by an operated chest trap (`gpTrapFnTable 1..9`,
 * `D2Game.dll` `0x6FD27B8C`, #1918), owned by `obj.unitId` (`ownerType: 'monster'`) so
 * `stepMissiles` collides it against players and applies `killerType: 'trap'`.
 */
function spawnTrapProjectile113c(this: GameInstanceHost, spec: {
  readonly obj: InternalObjectRecord
  readonly missileId: number
  readonly vx: number
  readonly vy: number
  readonly frames: number
  readonly element: MissileDamageChannel
  readonly physDamage: number
  readonly elemDamage: number
  readonly elemDurationFrames?: number
  readonly pierce?: boolean
  readonly size?: number
}): number {
  const unitId = this.allocateUnitId(UNIT_TYPE_113C.missile)
  const row = this.registry.getMissileById(spec.missileId)
  const remainingFrames = Math.max(1, Math.trunc(spec.frames))
  const rec: InternalMissileRecord = {
    unitId,
    missileId: spec.missileId,
    skillId: 0,
    ownerType: 'monster',
    ownerId: spec.obj.unitId,
    ownerIsObject: true,
    areaId: spec.obj.areaId,
    x: spec.obj.x,
    y: spec.obj.y,
    vx: spec.vx,
    vy: spec.vy,
    damage: spec.physDamage + spec.elemDamage,
    remainingFrames,
    collideType: row?.collideType ?? 3,
    size: spec.size ?? row?.size ?? 1,
    pierce: spec.pierce ?? Boolean(row?.pierce),
    nextHit: Boolean(row?.nextHit),
    nextDelay: row?.nextDelay ?? 4,
    element: spec.element,
    physDamage: spec.physDamage,
    elemDamage: spec.elemDamage,
    elemDurationFrames: spec.elemDurationFrames ?? 0,
    hitCooldowns: new Map(),
    guaranteedHit: true,
  }
  rec.createdFrame = this.currentFrame
  this.missiles.set(unitId, rec)
  const sx = Math.round(rec.x)
  const sy = Math.round(rec.y)
  const tx = Math.round(rec.x + rec.vx * rec.remainingFrames)
  const ty = Math.round(rec.y + rec.vy * rec.remainingFrames)
  this.broadcastToArea(spec.obj.areaId, {
    type: 'CreateMissile',
    missileId: rec.unitId,
    missileClassId: rec.missileId,
    at: { x: sx, y: sy },
    target: { x: tx, y: ty },
    x: sx,
    y: sy,
    targetX: tx,
    targetY: ty,
    remainingFrames: rec.remainingFrames,
    skillId: 0,
    level: 1,
    ownerType: 'monster',
    ownerId: spec.obj.unitId,
    areaId: spec.obj.areaId,
  })
  return unitId
}



/**
 * Execute 1.13c `gpTrapFnTable[trapType]` (`1..9`, `D2Game.dll` `0x6FD27B8C`, #1918):
 * - Assassin (`classId === 6` / `'ass'`) automatically disarms container traps (`0x6FC8B5C0`).
 * - `1`: Exploding trap (`phys + fire` burst via `SUNITDMG_ApplyObjectTrapDamage`).
 * - `2`: Poison Gas Nova (`16` radial poison clouds, `missileId 120`).
 * - `3`: Needle / Dart (`missileId 55` aimed at operator).
 * - `4`: Fireball (`missileId 42` aimed at operator).
 * - `5`: Explosion Nova (`12` radial fire bolts, `missileId 41`).
 * - `6`: Frost Nova (`16` radial frost bolts, `missileId 76`, chills players).
 * - `7`: Charged Bolt (`5` lightning bolts, `missileId 38`).
 * - `8`: Poison Cloud (`missileId 120` aimed at operator).
 * - `9`: Fire Bolt (`missileId 41` aimed at operator).
 */
function triggerContainerTrap113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  obj: InternalObjectRecord,
): void {
  const trapType = obj.trapType
  if (trapType < 1 || trapType > 9) return
  obj.trapType = 0
  if (player.classId === 6 || player.classCode === 'ass') return

  const monLvl = Math.max(1, getLevelMonsterLevel113c(obj.areaId, this.difficulty, true))
  const baseElem = Math.max(4, Math.floor(monLvl * 1.5) + 4)
  const dx = player.x - obj.x
  const dy = player.y - obj.y
  const dist = Math.hypot(dx, dy)
  const dirX = dist > 0.01 ? dx / dist : 1
  const dirY = dist > 0.01 ? dy / dist : 0

  switch (trapType) {
    case 1: {
      // Exploding chest trap: immediate physical + fire blast.
      this.operateTrapObject113c(player, obj)
      break
    }
    case 2: {
      // Poison Gas Nova: 16 radial poison clouds.
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI * 2) / 16
        this.spawnTrapProjectile113c({
          obj,
          missileId: 120,
          vx: Math.cos(angle) * 0.75,
          vy: Math.sin(angle) * 0.75,
          frames: 24,
          element: 'pois',
          physDamage: 0,
          elemDamage: baseElem,
          elemDurationFrames: 75,
          pierce: true,
        })
      }
      break
    }
    case 3: {
      // Needle / Trap Dart aimed at player.
      this.spawnTrapProjectile113c({
        obj,
        missileId: 55,
        vx: dirX * 1.5,
        vy: dirY * 1.5,
        frames: 25,
        element: 'phys',
        physDamage: baseElem,
        elemDamage: 0,
      })
      break
    }
    case 4: {
      // Fireball aimed at player.
      this.spawnTrapProjectile113c({
        obj,
        missileId: 42,
        vx: dirX * 1.25,
        vy: dirY * 1.25,
        frames: 25,
        element: 'fire',
        physDamage: 0,
        elemDamage: baseElem + 4,
      })
      break
    }
    case 5: {
      // Explosion / Fire Nova: 12 radial fire projectiles.
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI * 2) / 12
        this.spawnTrapProjectile113c({
          obj,
          missileId: 41,
          vx: Math.cos(angle) * 1.1,
          vy: Math.sin(angle) * 1.1,
          frames: 22,
          element: 'fire',
          physDamage: 0,
          elemDamage: baseElem,
        })
      }
      break
    }
    case 6: {
      // Frost Nova: 16 radial cold projectiles that chill on hit.
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI * 2) / 16
        this.spawnTrapProjectile113c({
          obj,
          missileId: 76,
          vx: Math.cos(angle) * 1.0,
          vy: Math.sin(angle) * 1.0,
          frames: 18,
          element: 'cold',
          physDamage: 0,
          elemDamage: baseElem,
          elemDurationFrames: Math.max(25, monLvl * 2),
          pierce: true,
        })
      }
      break
    }
    case 7: {
      // Charged Bolt fan: 5 bolts centered toward player.
      const baseAngle = Math.atan2(dirY, dirX)
      for (let i = -2; i <= 2; i++) {
        const angle = baseAngle + i * 0.22
        this.spawnTrapProjectile113c({
          obj,
          missileId: 38,
          vx: Math.cos(angle) * 0.9,
          vy: Math.sin(angle) * 0.9,
          frames: 28,
          element: 'ltng',
          physDamage: 0,
          elemDamage: Math.max(3, Math.floor(baseElem * 0.85)),
        })
      }
      break
    }
    case 8: {
      // Poison Cloud aimed at player.
      this.spawnTrapProjectile113c({
        obj,
        missileId: 120,
        vx: dirX * 0.8,
        vy: dirY * 0.8,
        frames: 24,
        element: 'pois',
        physDamage: 0,
        elemDamage: baseElem,
        elemDurationFrames: 75,
        pierce: true,
      })
      break
    }
    case 9: {
      // Fire Bolt aimed at player.
      this.spawnTrapProjectile113c({
        obj,
        missileId: 41,
        vx: dirX * 1.35,
        vy: dirY * 1.35,
        frames: 25,
        element: 'fire',
        physDamage: 0,
        elemDamage: baseElem,
      })
      break
    }
    default:
      break
  }
}



/**
 * 1.13c Sarcophagus (`OperateFn 1`, `0x6FC8AEF0`) & Barrel (`OperateFn 5`, `0x6FC8B150`)
 * `18.08%` (`1808 / 10000`) monster ambush spawn (#1918): spawns one normal monster from
 * the level's `Levels.txt` monster pool instead of rolling container item loot.
 */
function spawnContainerAmbushMonster113c(this: GameInstanceHost, obj: InternalObjectRecord): number | undefined {
  if (TOWN_AREAS.has(obj.areaId)) return undefined
  const diffName =
    this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal'
  const plan = getLevelMonsterPlan113c(obj.areaId, diffName)
  const pool =
    plan !== null
      ? this.difficulty > 0 && plan.nightmarePool.length > 0
        ? plan.nightmarePool
        : plan.pool
      : []
  const defId =
    pool.length > 0 ? pool[this.rng.rand(pool.length)]! : 'skeleton1'
  const hasLoadedArea = this.loadedAreas.has(obj.areaId)
  const stand = hasLoadedArea
    ? findStandableNear(
        (x, y) => this.isWorldWalkableForPlayer(obj.areaId, x, y),
        obj.x + 1,
        obj.y + 1,
        32,
      )
    : null
  if (hasLoadedArea && stand === null) return undefined
  const sx = stand?.x ?? obj.x + 1
  const sy = stand?.y ?? obj.y + 1
  return this.spawnMonster({
    defId,
    x: sx,
    y: sy,
    areaId: obj.areaId,
    ...(plan !== null ? { areaLevel: plan.monsterLevel } : {}),
    statSeed: this.rng.rand(0x7fffffff) || 1,
  })
}



/**
 * 1.13c Chaos Sanctuary Diablo trigger (`D2Game.dll` `ACT4Q3_CheckSealCompletion`, `0x6FCDBD90`, #1928):
 * called BOTH when a seal object transitions to `OBJMODE_OPENED (2)` (including non-boss seals `393`/`395`)
 * AND when any of the 3 seal bosses dies. Once all 5 seals `392..396` are open (`mode === 2`) and all 3
 * seal bosses are dead, kills all remaining Chaos Sanctuary monsters and schedules Diablo (`#243`) spawn
 * after 125 frames (5 seconds at 25 Hz) at the Chaos Pentagram (`Objects.txt 255`) or seal centroid.
 */
function tryTriggerChaosDiabloSpawn113c(this: GameInstanceHost, areaId: number): void {
  if (this.diabloSpawnedAreas.has(areaId)) return
  const deaths = this.sealBossDeaths.get(areaId)
  if (deaths === undefined || deaths.size < 3) return
  const sealIds = [392, 393, 394, 395, 396] as const
  const openSealClasses = new Set<number>()
  const seals: InternalObjectRecord[] = []
  for (const obj of this.objects.values()) {
    if (obj.areaId === areaId && sealIds.includes(obj.classId as (typeof sealIds)[number]) && obj.mode === 2) {
      openSealClasses.add(obj.classId)
      seals.push(obj)
    }
  }
  if (openSealClasses.size < sealIds.length) return

  this.diabloSpawnedAreas.add(areaId)
  // D2Game.dll 0x6FCDBE10: purge remaining alive non-NPC monsters in Chaos Sanctuary.
  for (const mon of this.monsters.values()) {
    if (mon.areaId !== areaId || mon.dead || mon.isNpc || mon.defId === 'diablo') continue
    mon.hp = 0
    mon.dead = true
    mon.mode = 12
    this.broadcastToArea(areaId, {
      type: 'UnitMode',
      unitType: 1,
      id: mon.unitId,
      mode: 12,
      at: { x: Math.round(mon.x), y: Math.round(mon.y) },
      lifePct: 0,
    })
  }

  const pentagram = [...this.objects.values()].find(
    (obj) => obj.areaId === areaId && obj.classId === 255,
  )
  const spawnX =
    pentagram !== undefined
      ? pentagram.x
      : Math.round(seals.reduce((sum, s) => sum + s.x, 0) / Math.max(1, seals.length))
  const spawnY =
    pentagram !== undefined
      ? pentagram.y
      : Math.round(seals.reduce((sum, s) => sum + s.y, 0) / Math.max(1, seals.length))
  this.pendingDiabloSpawns.push({
    frame: this.currentFrame + 125,
    areaId,
    x: spawnX,
    y: spawnY,
  })
}



/** #1955: True when the player currently holds an item on the cursor buffer (`D2Common_GetCursorItem != NULL`). */
function hasCursorItem113c(this: GameInstanceHost, player: InternalPlayerRecord): boolean {
  return player.items.some((it) => it.location === 'cursor')
}



/**
 * #1954: Cleanse mercenary poison (`2`), freeze (`1`), chill (`11`), and all curable curses
 * (`WELL_CURABLE_STATE_IDS_113C`) with `UnitState` + `StateEnd` broadcasts.
 */
function cleanseMercenaryCurableStates113c(this: GameInstanceHost, merc: InternalMercenaryRecord): boolean {
  let cleansed = false
  const mercCombat = this.mercCombat.get(merc.unitId)
  const hasStateSet = merc.states instanceof Set && merc.stateTimers instanceof Map
  for (const stateId of [...WELL_CURABLE_STATE_IDS_113C, 11]) {
    const inSet = hasStateSet && merc.states.has(stateId)
    const inBus = Boolean(mercCombat?.stateBus.hasState(stateId))
    if (!inSet && !inBus) continue
    if (inSet) {
      this.clearUnitState(
        merc.states,
        merc.stateTimers,
        'monster',
        merc.unitId,
        merc.areaId,
        stateId,
      )
      mercCombat?.stateBus.removeState(stateId)
    } else {
      mercCombat?.stateBus.removeState(stateId)
      this.broadcastToArea(merc.areaId, {
        type: 'UnitState',
        unitType: 'monster',
        unitId: merc.unitId,
        state: stateId,
        active: false,
        areaId: merc.areaId,
      })
      this.broadcastToArea(merc.areaId, {
        type: 'StateEnd',
        unit: { unitType: 1, id: merc.unitId },
        state: stateId,
      })
    }
    cleansed = true
  }
  return cleansed
}



/**
 * #1960: 1.13c Act Boss Quest Drop (`Andarielq`..`Baalq`) predicate:
 * - Never repeats a quest drop twice in the same game room (`killedActBosses`).
 * - For `a1q6` (Andariel `#156`), talking to Warriv (`#155`) in the same game as Andariel's death
 *   sets `0x0001 | 0x0010` (`QUEST_FLAG_CUSTOM_4_113C`) without `0x8000`, permanently preserving
 *   `Andarielq` across subsequent rooms (1.13c Andariel Quest Drop rule).
 */
function isActBossFirstKillDrop113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  questId: string,
  bossKey: string,
): boolean {
  if (this.killedActBosses.has(bossKey)) return false
  if (questId === 'a1q6') {
    const idx = questWordIndex113c('a1q6')
    const bits = idx === undefined ? 0 : (player.questFlags[idx] ?? 0)
    if ((bits & 0x8000) !== 0) return false
    if ((bits & QUEST_FLAG_CUSTOM_4_113C) !== 0) return true
    if ((bits & (QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_PRIMARY_GOAL_DONE_113C)) !== 0) {
      return false
    }
    return true
  }
  return !hasQuestFlag113c(player.questFlags, questId, QUEST_FLAG_COMPLETED_113C)
}



/** #1960: Forward NPC travel quest gate (`a1q6` unlocks Warriv East immediately on `0x1000 | 0x2000` before `0x0001`). */
function hasNpcTravelQuestCleared113c(this: GameInstanceHost, player: InternalPlayerRecord, questId: string): boolean {
  if (questId === 'a1q6') {
    return hasQuestFlag113c(
      player.questFlags,
      'a1q6',
      QUEST_FLAG_COMPLETED_113C |
        QUEST_FLAG_REWARD_PENDING_113C |
        QUEST_FLAG_CUSTOM_4_113C |
        QUEST_FLAG_PRIMARY_GOAL_DONE_113C |
        QUEST_FLAG_COMPLETED_NOW_113C,
    )
  }
  return hasQuestFlag113c(player.questFlags, questId, QUEST_FLAG_COMPLETED_113C)
}



/** #1956: Normal bidirectional doors (`Op 8` etc.) refuse to close (`mode 2 -> 0`) when any unit or corpse occupies their footprint. */
function isDoorBlockedByUnit113c(this: GameInstanceHost, obj: InternalObjectRecord): boolean {
  const meta = CANONICAL_113C_OBJECTS[obj.classId]
  const sizeX = Math.max(1, meta?.sizeX ?? 1)
  const sizeY = Math.max(1, meta?.sizeY ?? 1)
  const minX = Math.round(obj.x) - Math.trunc(sizeX / 2)
  const minY = Math.round(obj.y) - Math.trunc(sizeY / 2)
  const overlaps = (ux: number, uy: number): boolean => {
    const rx = Math.round(ux)
    const ry = Math.round(uy)
    return rx >= minX && rx < minX + sizeX && ry >= minY && ry < minY + sizeY
  }
  for (const p of this.players.values()) {
    if (!p.dead && p.areaId === obj.areaId && overlaps(p.x, p.y)) return true
    if (
      p.corpseId !== undefined &&
      (p.corpseAreaId ?? p.areaId) === obj.areaId &&
      overlaps(p.corpseX, p.corpseY)
    ) {
      return true
    }
    if (
      p.extraCorpses?.some(
        (c) => c.areaId === obj.areaId && overlaps(c.x, c.y),
      )
    ) {
      return true
    }
    const mgr = this.summonManagers.get(p.unitId)
    if (p.areaId === obj.areaId && mgr !== undefined) {
      for (const pet of mgr.getActivePets()) {
        if (pet.alive !== false && pet.maxHp > 0 && overlaps(pet.x, pet.y)) {
          return true
        }
      }
    }
  }
  for (const merc of this.mercenaries.values()) {
    if (merc.alive && merc.areaId === obj.areaId && overlaps(merc.x, merc.y)) return true
  }
  for (const m of this.monsters.values()) {
    if (m.areaId !== obj.areaId) continue
    if (m.dead && m.corpseConsumed) continue
    if (overlaps(m.x, m.y)) return true
  }
  return false
}



/**
 * #1959: Act 1 Den of Evil (`A1Q1`, `areaId === 8`, `D2Game.dll` `0x6fc81d40`):
 * counts remaining hostile killable monsters in `areaId = 8`, emits `S2C 0x5D` (`QuestState` `kind: 'status'`,
 * `extra: remainingCount`) when `1 <= remainingCount <= 5`, and completes `a1q1` when `remainingCount === 0`.
 */
function syncDenOfEvilProgress113c(this: GameInstanceHost, 
  killer: InternalPlayerRecord | undefined,
  dyingUnitId?: number,
): void {
  let remainingCount = 0
  for (const m of this.monsters.values()) {
    if (m.dead || m.isNpc || !m.isKillable || m.areaId !== 8) continue
    if (dyingUnitId !== undefined && m.unitId === dyingUnitId) continue
    remainingCount++
  }
  const population = this.areaPopulations.get(8)
  const allRoomsVisited =
    population === undefined || population.populated.size >= population.rooms.length
  const questIndex = questWordIndex113c('a1q1')
  if (remainingCount >= 1 && remainingCount <= 5 && allRoomsVisited && questIndex !== undefined) {
    for (const p of this.players.values()) {
      if (p.dead || p.areaId !== 8) continue
      if (hasQuestFlag113c(p.questFlags, 'a1q1', QUEST_FLAG_COMPLETED_113C)) continue
      this.emitToPlayer(p.unitId, {
        type: 'QuestState',
        kind: 'status',
        source: 0x5d,
        quests: new Uint16Array([questIndex]),
        questStatus: {
          questId: questIndex,
          alertFlags: 0x20,
          filterStatus: 4,
          extra: remainingCount,
        },
      })
    }
    return
  }
  if (remainingCount === 0 && allRoomsVisited && killer !== undefined) {
    for (const recipient of this.getQuestEligiblePartyRecipients113c(killer, 8, {
      includeSameActTown: false,
    })) {
      if (hasQuestFlag113c(recipient.questFlags, 'a1q1', QUEST_FLAG_COMPLETED_113C)) continue
      this.setPlayerQuestFlag(recipient, 'a1q1', QUEST_FLAG_COMPLETED_113C)
    }
  }
}



/** #1962: Drain scheduled 20-frame Hellforge (`A4Q2`) gem & rune drop beats. */
function stepPendingHellforgeDrops113c(this: GameInstanceHost): void {
  if (this.pendingHellforgeDrops.length === 0) return
  for (let i = this.pendingHellforgeDrops.length - 1; i >= 0; i--) {
    const beat = this.pendingHellforgeDrops[i]!
    if (this.currentFrame < beat.frame) continue
    this.pendingHellforgeDrops.splice(i, 1)
    if (beat.items.length > 0) {
      this.spawnDroppedItems([...beat.items], beat.areaId, beat.x, beat.y)
    }
  }
}



/**
 * #1963: Step Shenk (`A5Q1`, `hcIdx = 479`) victory catapult bombardment (`D2Game.dll` `0x6FC7A9B0`):
 * spawns `catapult meteor ball` (`422`) + `catapult meteor fire` (`423`) around Shenk's corpse,
 * damaging ONLY alive hostile monsters and NEVER players, mercenaries, or allied pets.
 */
function stepShenkBombardments113c(this: GameInstanceHost): void {
  if (this.activeShenkBombardments.length === 0) return
  for (let i = this.activeShenkBombardments.length - 1; i >= 0; i--) {
    const state = this.activeShenkBombardments[i]!
    if (this.currentFrame > state.endFrame) {
      this.activeShenkBombardments.splice(i, 1)
      continue
    }
    if (this.currentFrame < state.nextStrikeFrame) continue
    state.nextStrikeFrame = this.currentFrame + 8
    const radius = 3 + this.rng.rand(10)
    const angle = (this.rng.rand(360) * Math.PI) / 180
    const targetX = Math.round(state.centerX + Math.cos(angle) * radius)
    const targetY = Math.round(state.centerY + Math.sin(angle) * radius)
    const startX = targetX - 4
    const startY = targetY - 8
    this.broadcastToArea(state.areaId, {
      type: 'CreateMissile',
      missileId: this.allocateUnitId(UNIT_TYPE_113C.missile),
      missileClassId: 422,
      at: { x: startX, y: startY },
      target: { x: targetX, y: targetY },
      x: startX,
      y: startY,
      targetX,
      targetY,
      level: 1,
      areaId: state.areaId,
    })
    this.broadcastToArea(state.areaId, {
      type: 'CreateMissile',
      missileId: this.allocateUnitId(UNIT_TYPE_113C.missile),
      missileClassId: 423,
      at: { x: targetX, y: targetY },
      target: { x: targetX, y: targetY },
      x: targetX,
      y: targetY,
      targetX,
      targetY,
      level: 1,
      areaId: state.areaId,
    })
    const ownerPlayer = this.players.get(state.ownerUnitId)
    const blastDmg = this.difficulty === 2 ? 400 : this.difficulty === 1 ? 200 : 80
    for (const m of this.monsters.values()) {
      if (m.dead || m.isNpc || !m.isKillable || m.areaId !== state.areaId) continue
      if (Math.hypot(m.x - targetX, m.y - targetY) > 3.5) continue
      m.hp = Math.max(0, m.hp - blastDmg)
      if (m.hp <= 0) {
        this.applyMonsterDeath(m, ownerPlayer, 'fire', 'other')
      } else {
        const lifePct = m.maxHp > 0 ? Math.max(1, Math.min(128, Math.floor((m.hp * 128) / m.maxHp))) : 0
        this.broadcastToArea(m.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: m.unitId,
          mode: m.mode,
          lifePct,
        })
      }
    }
  }
}

/**
 * 1.13c Act 1 Quest 4 (`a1q4`) Countess `towerchestspawner` (`Missiles.txt #332`, `D2Game.dll`
 * `MISSMODE_SrvDo18_TowerChestSpawner` @ `0x6FC608D0..0x6FC60B1D` + `OBJECTS_OpenTowerChest` @ `0x6FC8DBF0`, #1988):
 * - Spawned with `remainingFrames = 400` (`Range = 400`, `Param1 = 150`, `Param2 = 2`, `Param3 = 5`).
 * - At `remainingFrames === 250` (`400 - 150`, +150 frames / 6.0s after Countess death): opens `Objects.txt 371`
 *   (`0 -> 1 -> 2`), drops 3 forced-Magic (`nQuality = 4`) Chest TC items + 2 healing potions + 2 mana potions,
 *   and sets `armed = true` (`D2Common.#10588(pMissile, 1)`).
 * - While `armed && remainingFrames % 8 === 0` (`Param2 << 2 = 8`, frames `248, 240, ..., 8` -> 31 gold piles):
 *   spawns 1 gold pile at `(chest.x + rand(11) - 5, chest.y + rand(11) - 5)`.
 * - At `remainingFrames === 1`: emits `S2C 0x2C PlaySound` (`sound = 92` / `0x5C`) on `unitType: 2, id: chest.unitId`
 *   and removes the spawner.
 */
function stepTowerChestSpawners113c(this: GameInstanceHost): void {
  for (let i = 0; i < this.activeTowerChestSpawners.length; ) {
    const spawner = this.activeTowerChestSpawners[i]!
    const chest = this.objects.get(spawner.chestUnitId)
    if (chest === undefined || chest.areaId !== spawner.areaId) {
      this.activeTowerChestSpawners.splice(i, 1)
      continue
    }
    if (spawner.remainingFrames <= 1) {
      this.broadcastToArea(spawner.areaId, {
        type: 'PlaySound',
        unit: { unitType: 2, id: chest.unitId },
        sound: 92,
      })
      this.activeTowerChestSpawners.splice(i, 1)
      continue
    }
    const killerPlayer = this.players.get(spawner.killerUnitId)
    const playerMf = killerPlayer !== undefined ? this.sumPlayerItemStat(killerPlayer, 80) : 0
    const playerGf = killerPlayer !== undefined ? this.sumPlayerItemStat(killerPlayer, 79) : 0
    if (spawner.remainingFrames === 250) {
      if (chest.mode === 0) {
        const partyPlayers =
          killerPlayer !== undefined ? this.countPartyPlayersInArea(killerPlayer, spawner.areaId) : 1
        const drops = rollCountessTowerChestDrops113c({
          areaId: spawner.areaId,
          difficulty: this.difficulty,
          gamePlayers: this.playersX,
          partyPlayers,
          playerMf,
          playerGf,
          rng: this.rng,
          spawnedUniqueIds: this.spawnedUniqueIds,
        })
        if (drops.length > 0) {
          this.spawnDroppedItems(drops, spawner.areaId, chest.x, chest.y)
        }
        const opTicks = getObjectOperatingTicks113c(chest.classId)
        if (opTicks > 0) {
          this.setObjectMode(chest, 1)
          this.pendingObjectModeTransitions.push({
            frame: this.currentFrame + opTicks,
            unitId: chest.unitId,
            mode: 2,
          })
        } else {
          this.setObjectMode(chest, 2)
        }
      }
      spawner.armed = true
    }
    if (spawner.armed && spawner.remainingFrames % 8 === 0) {
      const dx = this.rng.rand(11) - 5
      const dy = this.rng.rand(11) - 5
      const areaLvl = Math.max(1, getLevelMonsterLevel113c(spawner.areaId, this.difficulty, true))
      const gold = createGoldPiles113c(1, areaLvl, playerGf, this.rng)
      if (gold.length > 0) {
        this.spawnDroppedItems(gold, spawner.areaId, chest.x + dx, chest.y + dy)
      }
    }
    spawner.remainingFrames -= 1
    i += 1
  }
}

export interface PlayerDeathAndShrinesMethods {
  applyDamageToPlayer(playerUnitIdOrRecord: number | InternalPlayerRecord, damage: number, options?: {
    readonly dmg256?: number | undefined
    readonly hitClass?: number | string | undefined
    readonly isPurePoison?: boolean | undefined
    readonly skipGetHit?: boolean | undefined
    readonly killerType?: DeathKillerKind113c
    readonly killerUnitId?: number | undefined
  }): void
  resolveKillerTypeForDeathPenalty(options?: {
  readonly killerType?: DeathKillerKind113c
  readonly killerUnitId?: number | undefined
}): DeathKillerKind113c
  resolveRootKillerPlayer113c(killerUnitId?: number): InternalPlayerRecord | undefined
  spawnPvpPlayerEar113c(victim: InternalPlayerRecord): number
  dropPlayerGoldPile(player: InternalPlayerRecord, amount: number): number | undefined
  killPlayer(player: InternalPlayerRecord, options?: {
    readonly killerType?: DeathKillerKind113c
    readonly killerUnitId?: number | undefined
  }): void
  handleRespawn(player: InternalPlayerRecord): void
  hasLivePrimaryCorpse113c(player: InternalPlayerRecord): boolean
  recoverPlayerCorpse(player: InternalPlayerRecord): void
  lootOtherPlayerCorpse(looter: InternalPlayerRecord, victim: InternalPlayerRecord): void
  applyPersistentUnitState(states: Set<number>, timers: Map<number, number>, unitType: 'player' | 'monster', unitId: number, areaId: number, stateId: number): void
  clearUnitState(states: Set<number>, timers: Map<number, number>, unitType: 'player' | 'monster', unitId: number, areaId: number, stateId: number): void
  applyUnitState(states: Set<number>, timers: Map<number, number>, unitType: 'player' | 'monster', unitId: number, areaId: number, stateId: number, durationFrames: number): void
  stepUnitStates(states: Set<number>, timers: Map<number, number>, unitType: 'player' | 'monster', unitId: number, areaId: number): void
  playerInObjectRange(player: InternalPlayerRecord, obj: InternalObjectRecord): boolean
  playerInNpcRange(player: InternalPlayerRecord, npc: InternalMonsterRecord): boolean
  consumeWarpCooldown(player: InternalPlayerRecord): boolean
  emitPlayerVitals(player: InternalPlayerRecord): void
  setObjectMode(obj: InternalObjectRecord, mode: number): void
  dropShrineItem(code: string, areaId: number, x: number, y: number): void
  spawnShrineMissile(player: InternalPlayerRecord, shrineX: number, shrineY: number, areaId: number, missileClassId: number, targetX: number, targetY: number, skillLevel: number): number
  applyShrineEffect(player: InternalPlayerRecord, code: number, shrineUnitId?: number | undefined): void
  consumeKey(player: InternalPlayerRecord): boolean
  operateWell113c(player: InternalPlayerRecord, obj: InternalObjectRecord): void
  operateTrapObject113c(player: InternalPlayerRecord, obj: InternalObjectRecord): void
  detonateExplodingBarrel113c(barrel: InternalObjectRecord, operator?: InternalPlayerRecord): void
  isAncientsEncounterActive(areaId: number): boolean
  relocatePlayerFollowersToPlayer(player: InternalPlayerRecord, emitReassign: boolean): void
  spawnEvilUrnAmbush113c(urn: InternalObjectRecord): void
  spawnTrapProjectile113c(spec: {
  readonly obj: InternalObjectRecord
  readonly missileId: number
  readonly vx: number
  readonly vy: number
  readonly frames: number
  readonly element: MissileDamageChannel
  readonly physDamage: number
  readonly elemDamage: number
  readonly elemDurationFrames?: number
  readonly pierce?: boolean
  readonly size?: number
}): number
  triggerContainerTrap113c(player: InternalPlayerRecord, obj: InternalObjectRecord): void
  spawnContainerAmbushMonster113c(obj: InternalObjectRecord): number | undefined
  tryTriggerChaosDiabloSpawn113c(areaId: number): void
  hasCursorItem113c(player: InternalPlayerRecord): boolean
  cleanseMercenaryCurableStates113c(merc: InternalMercenaryRecord): boolean
  isActBossFirstKillDrop113c(player: InternalPlayerRecord, questId: string, bossKey: string): boolean
  hasNpcTravelQuestCleared113c(player: InternalPlayerRecord, questId: string): boolean
  isDoorBlockedByUnit113c(obj: InternalObjectRecord): boolean
  syncDenOfEvilProgress113c(killer: InternalPlayerRecord | undefined, dyingUnitId?: number): void
  stepPendingHellforgeDrops113c(): void
  stepShenkBombardments113c(): void
  stepTowerChestSpawners113c(): void
}

export const playerDeathAndShrinesMethods: Record<keyof PlayerDeathAndShrinesMethods, unknown> = {
  applyDamageToPlayer,
  resolveKillerTypeForDeathPenalty,
  resolveRootKillerPlayer113c,
  spawnPvpPlayerEar113c,
  dropPlayerGoldPile,
  killPlayer,
  handleRespawn,
  hasLivePrimaryCorpse113c,
  recoverPlayerCorpse,
  lootOtherPlayerCorpse,
  applyPersistentUnitState,
  clearUnitState,
  applyUnitState,
  stepUnitStates,
  playerInObjectRange,
  playerInNpcRange,
  consumeWarpCooldown,
  emitPlayerVitals,
  setObjectMode,
  dropShrineItem,
  spawnShrineMissile,
  applyShrineEffect,
  consumeKey,
  operateWell113c,
  operateTrapObject113c,
  detonateExplodingBarrel113c,
  isAncientsEncounterActive,
  relocatePlayerFollowersToPlayer,
  spawnEvilUrnAmbush113c,
  spawnTrapProjectile113c,
  triggerContainerTrap113c,
  spawnContainerAmbushMonster113c,
  tryTriggerChaosDiabloSpawn113c,
  hasCursorItem113c,
  cleanseMercenaryCurableStates113c,
  isActBossFirstKillDrop113c,
  hasNpcTravelQuestCleared113c,
  isDoorBlockedByUnit113c,
  syncDenOfEvilProgress113c,
  stepPendingHellforgeDrops113c,
  stepShenkBombardments113c,
  stepTowerChestSpawners113c,
}
