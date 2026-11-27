/**
 * GameInstance Subsystem: Socket/Cube Transmute, Player Trade, Stat/Skill/Respec, Party/Hostile/Chat & Broadcast (`src/server/engine/game-instance/trade-party-and-progression.ts`).
 */

import { PANDEMONIUM_AREA_IDS_113C, findFreePortalCoordNear113c } from '../../world/pandemonium-113c.ts'
import { QUEST_FLAG_COMPLETED_113C, hasQuestFlag113c } from '../quests-113c.ts'
import { buildHostileRelationEvent0x5A113c, isPlayerHardcore113c, validatePlayerRelation0x5D113c } from '../../combat/pvp-engine-113c.ts'
import { CANONICAL_CHARSTATS } from '../../../common/units/classes.ts'
import type { ItemContainer, ServerEvent, UnitId } from '../../../netproto/index.ts'
import { FIXED_ONE } from '../stat-list.ts'
import { getInventoryGoldLimit } from '../../../common/items/inventory-model.ts'
import { executeCubeTransmute113c, executeSocketItem113c } from '../../items/cube-engine-113c.ts'
import { TRADE_INTERACT_RANGE_SUBTILES_113C, planInventoryPlacements113c, type ActiveTradeSession113c, type PlayerDirectedTradeEvent } from '../../net/trade-manager-113c.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalPlayerRecord, ServerItemEntry } from './types.ts'
import { LEGACY_TEST_GRID_SPAWN, PARTY_PULSE_INTERVAL_FRAMES, TOWN_AREAS, lookupBaseInfo, toItemContainer, UNIT_TYPE_113C, type UnitType113c } from './constants-and-helpers.ts'


/** 1.13c untradable items: `Misc.txt` `quest != 0` and the Horadric Cube (`box`). */
function isUntradableQuestItem113c(this: GameInstanceHost, item: ServerItemEntry): boolean {
  const code = item.code.trim().toLowerCase()
  return code === 'box' || lookupBaseInfo(item.code).quest
}



function buildSocketChildEvents(this: GameInstanceHost, item: ServerItemEntry, action: number): ServerEvent[] {
  const events: ServerEvent[] = []
  for (const child of item.socketedItems ?? []) {
    const childData = this.serverEntryToItemData(child)
    events.push({
      type: 'ItemEvent',
      action,
      itemId: child.unitId,
      code: child.code,
      x: child.x,
      y: 0,
      container: 'socket',
      ownerId: item.unitId,
      item: {
        ...childData,
        opcode: 0x9d,
        action,
        ownerType: 4,
        ownerId: item.unitId as UnitId,
        location: 6,
        container: 'socket',
        inSocket: true,
      },
    })
  }
  return events
}



/** Sends `0x9D` socket children (`ownerType = 4`, `ownerId = host`) of `item` to `playerId`. */
function emitSocketChildrenToPlayer(this: GameInstanceHost, 
  playerId: number,
  item: ServerItemEntry,
  action: number,
): void {
  for (const ev of this.buildSocketChildEvents(item, action)) {
    this.emitToPlayer(playerId, ev)
  }
}



/** Broadcasts `0x9D` socket children (`ownerType = 4`, `ownerId = host`) of ground `item` to `areaId`. */
function emitSocketChildrenToArea(this: GameInstanceHost, 
  areaId: number,
  item: ServerItemEntry,
  action: number,
): void {
  for (const ev of this.buildSocketChildEvents(item, action)) {
    this.broadcastToArea(areaId, ev)
  }
}



function computePlayerPartyLifePct100(this: GameInstanceHost, player: InternalPlayerRecord): number {
  if (player.dead || player.hp <= 0 || player.maxHp <= 0) return 0
  return Math.min(100, Math.max(1, Math.round((player.hp * 100) / player.maxHp)))
}



function emitPartyMemberPulsesForPlayer(this: GameInstanceHost, player: InternalPlayerRecord): void {
  this.partyManager.updatePlayer(player.unitId, {
    level: player.level,
    areaId: player.areaId,
  })
  if (this.partyManager.getPartyId(player.unitId) === 0xffff) return
  const lifePct = this.computePlayerPartyLifePct100(player)
  const px = Math.round(player.x)
  const py = Math.round(player.y)
  for (const other of this.players.values()) {
    if (other.unitId === player.unitId) continue
    if (!this.partyManager.areAllied(player.unitId, other.unitId)) continue
    this.emitToPlayer(other.unitId, {
      type: 'Party',
      kind: 'memberState',
      source: 0x7f,
      isPlayer: true,
      relation: 1,
      unitId: player.unitId,
      playerId: player.unitId,
      lifePct,
      areaId: player.areaId,
    })
    if (other.areaId === player.areaId) {
      this.emitToPlayer(other.unitId, {
        type: 'Party',
        kind: 'memberPos',
        source: 0x90,
        unitId: player.unitId,
        playerId: player.unitId,
        areaId: player.areaId,
        at: { x: px, y: py },
      })
    }
  }
}



function stepPartyMemberPulses(this: GameInstanceHost): void {
  if (this.currentFrame % PARTY_PULSE_INTERVAL_FRAMES !== 0) return
  for (const player of this.players.values()) {
    this.emitPartyMemberPulsesForPlayer(player)
  }
}



function emitTradeEvents(this: GameInstanceHost, events: readonly PlayerDirectedTradeEvent[]): void {
  for (const e of events) {
    if (!this.players.has(e.playerId)) continue
    this.emitToPlayer(e.playerId, e.event)
  }
}



/** Mirrors `item` into `partnerId`'s partner trade grid (`0x9C action=0x04`, `storePage = 2`). */
function emitPartnerTradeItemAdd(this: GameInstanceHost, partnerId: number, item: ServerItemEntry): void {
  if (!this.players.has(partnerId)) return
  const data = this.serverEntryToItemData(item)
  this.emitToPlayer(partnerId, {
    type: 'ItemEvent',
    action: 0x04,
    itemId: item.unitId,
    code: item.code,
    x: item.x,
    y: item.y,
    container: 'tradePartner',
    item: {
      ...data,
      opcode: 0x9c,
      action: 0x04,
      ownerType: 0,
      ownerId: 0 as UnitId,
      location: 0,
      container: 'tradePartner',
      gridX: item.x,
      gridY: item.y,
      x: item.x,
      y: item.y,
      storePage: 2,
      storagePage: 2,
    },
  })
  this.emitSocketChildrenToPlayer(partnerId, item, 0x13)
}



/** Removes `item` from `partnerId`'s partner trade grid (`0x9C action=0x05`, `IFLAG_DELETED`). */
function emitPartnerTradeItemRemove(this: GameInstanceHost, 
  partnerId: number,
  item: ServerItemEntry,
  x: number = item.x,
  y: number = item.y,
): void {
  if (!this.players.has(partnerId)) return
  const data = this.serverEntryToItemData(item)
  const deletedFlags = ((Number(data.rawFlags ?? 0x10) | 0x20) >>> 0)
  this.emitToPlayer(partnerId, {
    type: 'ItemEvent',
    action: 0x05,
    itemId: item.unitId,
    code: item.code,
    x,
    y,
    container: 'tradePartner',
    item: {
      ...data,
      opcode: 0x9c,
      action: 0x05,
      flags: deletedFlags,
      rawFlags: deletedFlags,
      ownerType: 0,
      ownerId: 0 as UnitId,
      location: 0,
      container: 'tradePartner',
      gridX: x,
      gridY: y,
      x,
      y,
      storePage: 2,
      storagePage: 2,
    },
  })
}



/** Deletes `item` from `playerId`'s client container (`action = 0x05`, `IFLAG_DELETED`). */
function emitItemDeleted(this: GameInstanceHost, 
  playerId: number,
  item: ServerItemEntry,
  container: ItemContainer,
): void {
  const data = this.serverEntryToItemData(item)
  const deletedFlags = ((Number(data.rawFlags ?? 0x10) | 0x20) >>> 0)
  this.emitToPlayer(playerId, {
    type: 'ItemEvent',
    action: 0x05,
    itemId: item.unitId,
    code: item.code,
    x: item.x,
    y: item.y,
    container,
    item: { ...data, container, flags: deletedFlags, rawFlags: deletedFlags },
  })
}



/** Re-homes `item` into `location` grid cell `(x, y)` (keeping `rawItemData` in sync). */
function placeServerItem113c(this: GameInstanceHost, 
  item: ServerItemEntry,
  location: 'inventory' | 'stash' | 'cube' | 'cursor',
  x: number,
  y: number,
  ownerId: number,
): void {
  const storePage =
    location === 'stash' ? 5 : location === 'cube' ? 4 : location === 'cursor' ? 0 : 1
  item.location = location
  item.x = x
  item.y = y
  item.storePage = storePage
  item.ownerId = ownerId
  for (const child of item.socketedItems ?? []) child.ownerId = ownerId
  if (item.rawItemData !== undefined) {
    const cleanFlags = Number(item.rawItemData.rawFlags ?? item.rawItemData.flags ?? 0x10) & ~0x20
    item.rawItemData = {
      ...item.rawItemData,
      ownerId: ownerId as UnitId,
      location: location === 'cursor' ? 4 : 0,
      container: location,
      gridX: x,
      gridY: y,
      x,
      y,
      storePage,
      storagePage: storePage,
      flags: cleanFlags,
      rawFlags: cleanFlags,
    }
  }
}



function emitPlayerGoldStat(this: GameInstanceHost, player: InternalPlayerRecord): void {
  this.emitToPlayer(player.unitId, {
    type: 'UnitStatUpdate',
    unitType: 'player',
    unitId: player.unitId,
    statId: 14,
    value: player.gold,
  })
  this.emitToPlayer(player.unitId, {
    type: 'StatSet',
    stat: 14,
    value: player.gold,
  })
}



/**
 * 1.13c `C2S 0x28` (`SocketItem`, `D2Game.dll` `0x6FCF4A70`): inserts the cursor gem / rune / jewel into
 * `hostId`'s next free socket, applying `Gems.txt` `gemapplytype` mods and completing `Runes.txt` runewords.
 */
function handleSocketItem(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  fillerId: number,
  hostId: number,
): void {
  if (fillerId === hostId) return
  const filler = player.items.find(
    (candidate) => candidate.unitId === fillerId && candidate.location === 'cursor',
  )
  const host = player.items.find(
    (candidate) =>
      candidate.unitId === hostId &&
      (candidate.location === 'inventory' ||
        candidate.location === 'stash' ||
        candidate.location === 'cube' ||
        candidate.location === 'equipped'),
  )
  if (!filler || !host) return

  const res = executeSocketItem113c({
    host: this.serverEntryToItemData(host),
    filler: this.serverEntryToItemData(filler),
    rng: this.rng,
    playerLevel: player.level,
    isHostEquipped: host.location === 'equipped',
    isLadder: this.isLadderRulesEnabled(),
  })
  if (!res.ok) {
    this.emitToPlayer(player.unitId, {
      type: 'PlaySound',
      unit: { unitType: 0, id: player.unitId },
      sound: 19,
    })
    return
  }

  const fillerIdx = player.items.indexOf(filler)
  if (fillerIdx !== -1) player.items.splice(fillerIdx, 1)

  const prevChildren = new Map(host.socketedItems.map((c) => [c.unitId, c] as const))
  const nextChildren: ServerItemEntry[] = []
  for (const childData of res.hostItem.socketedItems ?? []) {
    const childId = Number(childData.id ?? 0)
    const prev = prevChildren.get(childId)
    const entry: ServerItemEntry =
      prev ??
      (childId === filler.unitId
        ? filler
        : this.itemDataToServerEntry(childData, player.unitId, player.areaId))
    entry.location = 'socket'
    entry.storePage = 0
    entry.ownerId = player.unitId
    entry.rawItemData = { ...childData, location: 6, inSocket: true, container: 'socket' }
    if (entry === filler) {
      entry.x = res.socketIndex
      entry.y = 0
    }
    nextChildren.push(entry)
  }

  host.rawItemData = res.hostItem
  host.socketed = true
  host.identified = true
  host.totalSockets = Math.max(host.totalSockets, res.hostItem.totalSockets ?? 0)
  host.socketedItems = nextChildren
  host.stats = new Map(res.combinedStatsMap)

  this.emitToPlayer(player.unitId, {
    type: 'CursorClear',
    unitType: 'player',
    id: player.unitId,
  })
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x0a,
    itemId: filler.unitId,
    code: filler.code,
    x: res.socketIndex,
    y: 0,
    container: 'socket',
    ownerId: host.unitId,
    item: {
      ...res.socketChild,
      opcode: 0x9d,
      action: 0x0a,
      ownerType: 4,
      ownerId: host.unitId as UnitId,
      location: 6,
      container: 'socket',
      inSocket: true,
    },
  })
  this.emitToPlayer(player.unitId, {
    type: 'ItemEvent',
    action: 0x15,
    itemId: host.unitId,
    code: host.code,
    x: host.x,
    y: host.y,
    container: toItemContainer(host.location),
    item: this.serverEntryToItemData(host),
  })

  if (host.location === 'equipped') {
    this.validatePlayerActiveSkills(player)
    this.syncPlayerItemAuras113c(player, true)
    this.refreshPlayerAccruedMaxPools(player)
  }
}



/**
 * 1.13c `C2S 0x4F` `buttonId = 0x18` (`CUBEMAIN_Transmute`, `D2Game.dll` `0x6FC90AE0`):
 * evaluates the 146 `enabled=1` `Cubemain.txt` recipes against the Horadric Cube contents.
 */
function handleCubeTransmute(this: GameInstanceHost, player: InternalPlayerRecord): void {
  const hasCube = player.items.some(
    (item) =>
      item.code.trim().toLowerCase() === 'box' &&
      (item.location === 'inventory' || item.location === 'stash'),
  )
  if (!hasCube) return
  const cubeEntries = player.items.filter((item) => item.location === 'cube')
  if (cubeEntries.length === 0) return

  const openedPortalDestAreas = new Set<number>(this.openedPandemoniumAreas)
  let hasActiveCowPortal = false
  for (const obj of this.objects.values()) {
    if (obj.classId !== 60 || obj.destAreaId === undefined) continue
    if (obj.destAreaId === 39) hasActiveCowPortal = true
    if (obj.areaId === player.areaId) openedPortalDestAreas.add(obj.destAreaId)
  }

  const res = executeCubeTransmute113c({
    cubeItems: cubeEntries.map((item) => this.serverEntryToItemData(item)),
    rng: this.rng,
    playerLevel: player.level,
    playerClassCode: player.classCode,
    difficulty: this.difficulty,
    areaId: player.areaId,
    isExpansion: ((player.statusFlags ?? 0x20) & 0x20) !== 0,
    isLadder: this.isLadderRulesEnabled(),
    hasCompletedBaal: hasQuestFlag113c(player.questFlags, 'a5q6', QUEST_FLAG_COMPLETED_113C),
    hasActiveCowPortal,
    openedPortalDestAreas,
    allocateUnitId: () => this.allocateUnitId(UNIT_TYPE_113C.item),
  })
  if (!res.matched) {
    this.emitToPlayer(player.unitId, {
      type: 'PlaySound',
      unit: { unitType: 0, id: player.unitId },
      sound: 19,
    })
    return
  }

  const consumed = new Set(res.consumedItemIds.map((id) => Number(id)))
  const removed: ServerItemEntry[] = []
  player.items = player.items.filter((item) => {
    if (item.location === 'cube' && consumed.has(item.unitId)) {
      removed.push(item)
      return false
    }
    return true
  })
  for (const item of removed) {
    this.emitItemDeleted(player.unitId, item, 'cube')
  }

  for (const placed of res.createdItems) {
    const entry = this.itemDataToServerEntry(placed.item, player.unitId, player.areaId)
    this.placeServerItem113c(entry, 'cube', placed.x, placed.y, player.unitId)
    player.items.push(entry)
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 0x04,
      itemId: entry.unitId,
      code: entry.code,
      x: entry.x,
      y: entry.y,
      container: 'cube',
      item: this.serverEntryToItemData(entry),
    })
    this.emitSocketChildrenToPlayer(player.unitId, entry, 0x13)
  }

  if (res.portalToSpawn !== undefined) {
    const destAreaId = res.portalToSpawn.destAreaId
    if (PANDEMONIUM_AREA_IDS_113C.has(destAreaId)) {
      this.openedPandemoniumAreas.add(destAreaId)
    }
    const portalPos = findFreePortalCoordNear113c({
      originX: player.x,
      originY: player.y,
      existingPortals: [...this.objects.values()].filter(
        (o) => o.areaId === player.areaId && (o.classId === 59 || o.classId === 60),
      ),
      isWalkable: (x, y) => this.isWorldWalkableForPlayer(player.areaId, x, y),
    })
    const townPortalObjId = this.spawnObject({
      classId: res.portalToSpawn.classId,
      x: portalPos.x,
      y: portalPos.y,
      areaId: player.areaId,
      mode: 2,
      destAreaId,
    })
    const destArea = this.loadArea(destAreaId)
    let returnObj = [...this.objects.values()].find(
      (o) =>
        o.areaId === destAreaId &&
        o.classId === res.portalToSpawn!.classId &&
        o.destAreaId === player.areaId,
    )
    if (returnObj === undefined) {
      const returnOriginX = destArea ? destArea.spawnX : LEGACY_TEST_GRID_SPAWN
      const returnOriginY = destArea ? destArea.spawnY : LEGACY_TEST_GRID_SPAWN
      const returnPos = findFreePortalCoordNear113c({
        originX: returnOriginX,
        originY: returnOriginY,
        existingPortals: [...this.objects.values()].filter(
          (o) => o.areaId === destAreaId && (o.classId === 59 || o.classId === 60),
        ),
        isWalkable: (x, y) => this.isWorldWalkableForPlayer(destAreaId, x, y),
      })
      const returnPortalObjId = this.spawnObject({
        classId: res.portalToSpawn.classId,
        x: returnPos.x,
        y: returnPos.y,
        areaId: destAreaId,
        mode: 2,
        destAreaId: player.areaId,
      })
      returnObj = this.objects.get(returnPortalObjId)
    }
    const townObj = this.objects.get(townPortalObjId)
    if (townObj !== undefined && returnObj !== undefined) {
      townObj.linkedPortalId = returnObj.unitId
      returnObj.linkedPortalId = townObj.unitId
    }
  }
}



/**
 * 1.13c `C2S 0x13` on `unitType = 0` (another player): town-only face-to-face trade request. Walks into
 * `TRADE_INTERACT_RANGE_SUBTILES_113C` first, then sends `0x77 0x00` / `0x01` (or opens `0x78`).
 */
function handlePlayerTradeInteract(this: GameInstanceHost, player: InternalPlayerRecord, targetId: number): void {
  if (!this.policy.allowPlayerTrade) return
  const target = this.players.get(targetId)
  if (
    target === undefined ||
    target.unitId === player.unitId ||
    player.dead ||
    target.dead ||
    target.areaId !== player.areaId ||
    !TOWN_AREAS.has(player.areaId)
  ) {
    return
  }
  if (Math.hypot(player.x - target.x, player.y - target.y) > TRADE_INTERACT_RANGE_SUBTILES_113C) {
    if (player.pendingInteraction === undefined) {
      player.pendingInteraction = { kind: 'player', id: targetId }
      player.pendingInteractionSteps = 0
    }
    return
  }
  player.pendingInteraction = undefined
  player.pendingInteractionSteps = 0
  const res = this.tradeManager.requestTrade(
    { unitId: player.unitId, name: player.name },
    { unitId: target.unitId, name: target.name },
  )
  this.emitTradeEvents(res.events)
}



/** 1.13c `C2S 0x4F` trade buttons (`0x02` cancel, `0x03` accept invite, `0x04` ok, `0x07` unaccept, `0x08` gold). */
function handleTradeButton(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  buttonId: number,
  amount: number,
): void {
  if (buttonId === 0x02) {
    this.abortPlayerTrade(player.unitId)
    return
  }
  if (buttonId === 0x03) {
    if (!this.policy.allowPlayerTrade || !TOWN_AREAS.has(player.areaId)) return
    const res = this.tradeManager.acceptInvite(
      { unitId: player.unitId, name: player.name },
      (unitId) => {
        const other = this.players.get(unitId)
        if (other === undefined || other.dead || other.areaId !== player.areaId) return undefined
        return { unitId: other.unitId, name: other.name }
      },
    )
    this.emitTradeEvents(res.events)
    return
  }
  if (buttonId === 0x04) {
    const res = this.tradeManager.accept(player.unitId, this.currentFrame)
    this.emitTradeEvents(res.events)
    if (res.bothAccepted && res.session !== undefined) {
      this.commitTradeSession(res.session)
    }
    return
  }
  if (buttonId === 0x07) {
    this.emitTradeEvents(this.tradeManager.unaccept(player.unitId))
    return
  }
  if (buttonId === 0x08) {
    this.emitTradeEvents(
      this.tradeManager.setGoldOffer(player.unitId, player.gold, amount, this.currentFrame),
    )
  }
}



/**
 * Atomic 1.13c trade commit: verifies gold ownership, the `clvl * 10000` inventory gold cap and a full
 * `10x4` dry-run placement into BOTH recipients' inventories before mutating any item or gold.
 */
function commitTradeSession(this: GameInstanceHost, session: ActiveTradeSession113c): void {
  const a = this.players.get(session.playerA)
  const b = this.players.get(session.playerB)
  if (a === undefined || b === undefined) {
    this.abortPlayerTrade(session.playerA)
    return
  }
  const goldA = Math.max(0, Math.trunc(session.offeredGoldA))
  const goldB = Math.max(0, Math.trunc(session.offeredGoldB))
  if (goldA > a.gold) {
    this.emitTradeEvents(this.tradeManager.rejectCommitGoldOverflow(session, a.unitId))
    return
  }
  if (goldB > b.gold) {
    this.emitTradeEvents(this.tradeManager.rejectCommitGoldOverflow(session, b.unitId))
    return
  }
  if (a.gold - goldA + goldB > getInventoryGoldLimit(a.level)) {
    this.emitTradeEvents(this.tradeManager.rejectCommitGoldOverflow(session, a.unitId))
    return
  }
  if (b.gold - goldB + goldA > getInventoryGoldLimit(b.level)) {
    this.emitTradeEvents(this.tradeManager.rejectCommitGoldOverflow(session, b.unitId))
    return
  }

  const offeredA = a.items.filter((item) => item.location === 'trade')
  const offeredB = b.items.filter((item) => item.location === 'trade')
  const inventoryBoxes = (p: InternalPlayerRecord) =>
    p.items
      .filter((item) => item.location === 'inventory')
      .map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height }))
  const toIncoming = (items: readonly ServerItemEntry[]) =>
    items.map((item) => ({ unitId: item.unitId, width: item.width, height: item.height }))
  const planForB = planInventoryPlacements113c(inventoryBoxes(b), toIncoming(offeredA))
  if (planForB === null) {
    this.emitTradeEvents(this.tradeManager.rejectCommitNoRoom(session, b.unitId))
    return
  }
  const planForA = planInventoryPlacements113c(inventoryBoxes(a), toIncoming(offeredB))
  if (planForA === null) {
    this.emitTradeEvents(this.tradeManager.rejectCommitNoRoom(session, a.unitId))
    return
  }

  // --- Commit (no failure paths below) ---
  a.gold = a.gold - goldA + goldB
  b.gold = b.gold - goldB + goldA
  const transfer = (
    from: InternalPlayerRecord,
    to: InternalPlayerRecord,
    items: readonly ServerItemEntry[],
    plan: ReadonlyMap<number, { readonly x: number; readonly y: number }>,
  ): void => {
    const moving = new Set(items)
    from.items = from.items.filter((item) => !moving.has(item))
    for (const item of items) {
      this.emitItemDeleted(from.unitId, item, 'tradeSelf')
      const pos = plan.get(item.unitId)!
      this.placeServerItem113c(item, 'inventory', pos.x, pos.y, to.unitId)
      item.areaId = to.areaId
      to.items.push(item)
      this.emitToPlayer(to.unitId, {
        type: 'ItemEvent',
        action: 0x04,
        itemId: item.unitId,
        code: item.code,
        x: item.x,
        y: item.y,
        container: 'inventory',
        item: this.serverEntryToItemData(item),
      })
      this.emitSocketChildrenToPlayer(to.unitId, item, 0x13)
    }
  }
  transfer(a, b, offeredA, planForB)
  transfer(b, a, offeredB, planForA)
  this.emitPlayerGoldStat(a)
  this.emitPlayerGoldStat(b)
  this.refreshPlayerAccruedMaxPools(a)
  this.refreshPlayerAccruedMaxPools(b)
  this.emitTradeEvents(this.tradeManager.completeSession(session))
}



/**
 * Cancels `playerId`'s active trade (or pending invitation) and losslessly returns every offered item of
 * BOTH participants to their own containers (`0x77 0x0C`). Called on cancel, disconnect, death and area change.
 */
function abortPlayerTrade(this: GameInstanceHost, playerId: number): void {
  if (!this.tradeManager.hasPendingOrActiveTrade(playerId)) return
  const res = this.tradeManager.cancelOrDecline(playerId)
  if (res.abortedSession !== undefined) {
    for (const id of [res.abortedSession.playerA, res.abortedSession.playerB]) {
      const p = this.players.get(id)
      if (p !== undefined) this.returnPlayerTradeItemsToInventory(p)
    }
  }
  this.emitTradeEvents(res.events)
}



function returnPlayerTradeItemsToInventory(this: GameInstanceHost, player: InternalPlayerRecord): void {
  const offered = player.items.filter((item) => item.location === 'trade')
  if (offered.length === 0) return
  const boxesOf = (loc: ServerItemEntry['location']) =>
    player.items
      .filter((item) => item.location === loc)
      .map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height }))
  let remaining = offered
  const invPlan = planInventoryPlacements113c(
    boxesOf('inventory'),
    remaining.map((item) => ({ unitId: item.unitId, width: item.width, height: item.height })),
  )
  const placements: { item: ServerItemEntry; loc: 'inventory' | 'stash' | 'cursor'; x: number; y: number }[] = []
  if (invPlan !== null) {
    for (const item of remaining) {
      const pos = invPlan.get(item.unitId)!
      placements.push({ item, loc: 'inventory', x: pos.x, y: pos.y })
    }
    remaining = []
  } else {
    // Place one by one into the inventory, then the 6x8 stash, then the cursor (lossless fallback).
    const invBoxes = boxesOf('inventory')
    const stashBoxes = boxesOf('stash')
    let cursorFree = !player.items.some((item) => item.location === 'cursor')
    for (const item of remaining) {
      const incoming = [{ unitId: item.unitId, width: item.width, height: item.height }]
      const inv = planInventoryPlacements113c(invBoxes, incoming)
      if (inv !== null) {
        const pos = inv.get(item.unitId)!
        invBoxes.push({ x: pos.x, y: pos.y, width: item.width, height: item.height })
        placements.push({ item, loc: 'inventory', x: pos.x, y: pos.y })
        continue
      }
      const stash = planInventoryPlacements113c(stashBoxes, incoming, 6, 8)
      if (stash !== null) {
        const pos = stash.get(item.unitId)!
        stashBoxes.push({ x: pos.x, y: pos.y, width: item.width, height: item.height })
        placements.push({ item, loc: 'stash', x: pos.x, y: pos.y })
        continue
      }
      if (cursorFree) {
        cursorFree = false
        placements.push({ item, loc: 'cursor', x: 0, y: 0 })
        continue
      }
      placements.push({ item, loc: 'inventory', x: 0, y: 0 })
    }
    remaining = []
  }
  for (const { item, loc, x, y } of placements) {
    this.emitItemDeleted(player.unitId, item, 'tradeSelf')
    this.placeServerItem113c(item, loc, x, y, player.unitId)
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: loc === 'cursor' ? 0x12 : 0x04,
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: loc,
      item: this.serverEntryToItemData(item),
    })
    this.emitSocketChildrenToPlayer(player.unitId, item, 0x13)
  }
  this.refreshPlayerAccruedMaxPools(player)
}



function handleAllocateStat(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  statId: number,
  amount: number,
): void {
  if (player.statPts <= 0) return
  if (statId < 0 || statId > 3) return
  const spend = Math.min(player.statPts, Math.max(1, amount))
  player.statPts -= spend
  const base = CANONICAL_CHARSTATS[player.classCode]

  // 1.13c `D2Game.dll` `0x6FC97340` (`PACKET_AddStatPoint`, #1666):
  // Allocating Vitality (`statId === 3`) or Energy (`statId === 1`) adds the exact 1/256 fixed-point
  // increment to BOTH the max pool and the current pool (`STATLIST_AddUnitStat`), never full-refilling
  // missing HP, Mana, or Stamina and never clearing `staminaExhausted`.
  if (statId === 0) {
    player.strength += spend
  } else if (statId === 1) {
    player.energy += spend
    const manaAddFixed = Math.round(base.perStatPoint.manaPerEnergy * spend * FIXED_ONE)
    player.maxManaFixed += manaAddFixed
    const accruedMaxManaFixed = this.getPlayerAccruedMaxManaFixed(player)
    player.manaFixed = Math.min(accruedMaxManaFixed, player.manaFixed + manaAddFixed)
    player.maxMana = Math.max(0, Math.floor(accruedMaxManaFixed / FIXED_ONE))
    player.mana = Math.max(0, Math.floor(player.manaFixed / FIXED_ONE))
  } else if (statId === 2) {
    player.dexterity += spend
  } else if (statId === 3) {
    player.vitality += spend
    const lifeAddFixed = Math.round(base.perStatPoint.lifePerVitality * spend * FIXED_ONE)
    const stamAddFixed = Math.round(base.perStatPoint.staminaPerVitality * spend * FIXED_ONE)
    player.maxHpFixed += lifeAddFixed
    player.maxStaminaFixed += stamAddFixed
    const accruedMaxHpFixed = this.getPlayerAccruedMaxHpFixed(player)
    const accruedMaxStaminaFixed = this.getPlayerAccruedMaxStaminaFixed(player)
    player.hpFixed = Math.min(accruedMaxHpFixed, player.hpFixed + lifeAddFixed)
    player.maxHp = Math.max(1, Math.floor(accruedMaxHpFixed / FIXED_ONE))
    player.hp = Math.max(0, Math.floor(player.hpFixed / FIXED_ONE))

    player.staminaFixed = Math.min(accruedMaxStaminaFixed, player.staminaFixed + stamAddFixed)
    player.maxStamina = Math.max(1, Math.floor(accruedMaxStaminaFixed / FIXED_ONE))
    player.stamina = player.staminaExhausted
      ? 0
      : Math.max(0, Math.floor(player.staminaFixed / FIXED_ONE))
  }

  const updatedVal =
    statId === 0
      ? player.strength
      : statId === 1
        ? player.energy
        : statId === 2
          ? player.dexterity
          : player.vitality
  this.emitToPlayer(player.unitId, {
    type: 'UnitStatUpdate',
    unitType: 'player',
    unitId: player.unitId,
    statId,
    value: updatedVal,
  })
  this.emitToPlayer(player.unitId, {
    type: 'UnitStatUpdate',
    unitType: 'player',
    unitId: player.unitId,
    statId: 4,
    value: player.statPts,
  })
  if (statId === 1) {
    for (const [poolStatId, poolVal] of [
      [8, player.manaFixed],
      [9, player.maxManaFixed],
    ] as const) {
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: poolStatId,
        value: poolVal,
      })
      this.emitToPlayer(player.unitId, {
        type: 'StatSet',
        stat: poolStatId,
        value: poolVal,
      })
    }
    this.emitPlayerVitals(player)
  } else if (statId === 3) {
    for (const [poolStatId, poolVal] of [
      [6, player.hpFixed],
      [7, player.maxHpFixed],
      [10, player.staminaFixed],
      [11, player.maxStaminaFixed],
    ] as const) {
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: poolStatId,
        value: poolVal,
      })
      this.emitToPlayer(player.unitId, {
        type: 'StatSet',
        stat: poolStatId,
        value: poolVal,
      })
    }
    this.emitPlayerVitals(player)
  }
}



/**
 * 1.13c `C2S 0x3B` (`AddSkillPoint`, `D2Game.dll` `0x6FCEDA20` -> `D2Common_CheckSkillPrerequisites`):
 * Enforces class ownership (`Skills.txt.charclass`), hard-point cap (`maxlvl`, 20),
 * character level requirement (`player.level >= reqlevel + curBaseLvl`), and hard-point
 * prerequisites (`reqskill1..3 >= 1` base points).
 */
function handleAllocateSkill(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  skillId: number,
): void {
  if (player.newSkills <= 0) return
  if (!Number.isInteger(skillId) || skillId < 0 || skillId > 350) return

  const skill = this.registry.getSkillById(skillId)
  if (!skill || skill.charClass !== player.classCode) return

  const maxLvlRaw = Number(skill.raw.maxlvl)
  const maxLvl = Number.isFinite(maxLvlRaw) && maxLvlRaw > 0 ? Math.trunc(maxLvlRaw) : 20
  const curBase = player.skills.get(skillId) ?? 0
  if (curBase >= maxLvl) return

  const reqLvl = Math.max(1, Math.trunc(skill.reqLevel || 1))
  if (player.level < reqLvl + curBase) return

  for (const reqName of [skill.reqSkill1, skill.reqSkill2, skill.reqSkill3]) {
    const trimmed = reqName.trim()
    if (trimmed.length === 0) continue
    const reqSkill = this.registry.getSkillByName(trimmed)
    if (!reqSkill || (player.skills.get(reqSkill.id) ?? 0) < 1) {
      return
    }
  }

  player.newSkills -= 1
  const nextLvl = curBase + 1
  player.skills.set(skillId, nextLvl)

  this.emitToPlayer(player.unitId, {
    type: 'SkillUpdate',
    unitId: player.unitId,
    skillId,
    level: nextLvl,
  })
  this.emitToPlayer(player.unitId, {
    type: 'UnitStatUpdate',
    unitType: 'player',
    unitId: player.unitId,
    statId: 5,
    value: player.newSkills,
  })
}



/**
 * 1.13c Akara Reset Stat/Skill Points (`D2Game.dll` `0x6fce0504` -> `0x6fcc1280` + `0x6fd0af80` + `0x6fc83bb0`).
 * Triggered by `C2S 0x38 NpcEntityAction(action=0, npcId=akara, complement=0)`.
 */
function handleAkaraRespec(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npcId: number,
): boolean {
  const npc = this.resolveServiceNpc(player, npcId) ?? this.monsters.get(npcId)
  const isAkara = npc !== undefined ? npc.hcIdx === 148 : npcId === 148
  if (!isAkara) return false

  const q1 = player.questFlags[1] ?? 0
  if ((q1 & QUEST_FLAG_COMPLETED_113C) === 0) return false

  let q41 = player.questFlags[41] ?? 0
  if ((q41 & 1) !== 0) return false
  if (q41 === 0) {
    q41 = 0x2002
    player.questFlags[41] = q41
  }
  if ((q41 & 2) === 0) return false

  this.executePlayerRespec113c(player)

  // 3. Consume Quest 41 (0x29) respec token (D2Game.dll 0x6fc83bb0: set bit 0 = 0x0001, clear bit 1 = 0x0002).
  player.questFlags[41] = (q41 & ~0x0002) | 0x2001
  this.emitQuestLog(player)
  this.emitToPlayer(player.unitId, {
    type: 'QuestState',
    kind: 'update',
    source: 0x28,
    quests: new Uint16Array(player.questFlags),
    flags: Array.from(player.questFlags),
  })
  return true
}



/**
 * 1.13c shared player skill & stat reset (`D2Game.dll` `0x6fcc1280` `SKILLS_RespecPlayerSkills` +
 * `0x6fd0af80` `PLR_RespecPlayerStats`), invoked by both Akara Respec (`0x6fce0575`) and
 * Token of Absolution (`toa`, `0x6fcf9f55`).
 */
function executePlayerRespec113c(this: GameInstanceHost, player: InternalPlayerRecord): void {
  // 1. Skill Reset (D2Game.dll 0x6fcc1280): refund all hard skill points to stat 5 (newskills) and zero hard levels.
  const learnedSkillIds = [...player.skills.keys()]
  for (const skillId of learnedSkillIds) {
    const slvl = player.skills.get(skillId) ?? 0
    if (slvl > 0) {
      player.newSkills += slvl
    }
    this.emitToPlayer(player.unitId, {
      type: 'SkillUpdate',
      unitId: player.unitId,
      skillId,
      level: 0,
    })
  }
  player.skills.clear()
  if (player.d2sTemplate?.skills) {
    player.d2sTemplate.skills.fill(0)
  }
  for (let slot = 0; slot < 16; slot++) {
    const raw = player.hotkeys[slot] ?? 0xffff
    const skillId = raw & 0x7fff
    const hand: 'left' | 'right' = (raw & 0x8000) !== 0 ? 'left' : 'right'
    const itemId = player.hotkeyItemIds[slot] ?? 0xffffffff
    if (
      raw !== 0xffff &&
      skillId !== 0x7fff &&
      !this.isPlayerSkillSelectable(player, skillId, hand, itemId)
    ) {
      player.hotkeys[slot] = 0xffff
      player.hotkeyItemIds[slot] = 0xffffffff
      this.emitToPlayer(player.unitId, {
        type: 'ActiveSkill',
        unitId: player.unitId,
        hand,
        skill: 0xffff,
        slot,
        isHotkey: true,
        itemId: 0xffffffff,
      })
    }
  }
  if (player.d2sTemplate?.hotkeys) {
    const mutableHotkeys = player.d2sTemplate.hotkeys as number[]
    for (let slot = 0; slot < Math.min(16, mutableHotkeys.length); slot++) {
      mutableHotkeys[slot] = player.hotkeys[slot] ?? 0xffff
    }
  }
  if (player.leftSkill !== 0 && !this.isPlayerSkillSelectable(player, player.leftSkill, 'left')) {
    player.leftSkill = 0
    this.emitToPlayer(player.unitId, {
      type: 'ActiveSkill',
      unitId: player.unitId,
      hand: 'left',
      skill: 0,
      itemId: 0xffffffff,
    })
  }
  if (player.rightSkill !== 0 && !this.isPlayerSkillSelectable(player, player.rightSkill, 'right')) {
    player.rightSkill = 0
    this.emitToPlayer(player.unitId, {
      type: 'ActiveSkill',
      unitId: player.unitId,
      hand: 'right',
      skill: 0,
      itemId: 0xffffffff,
    })
  }

  // 2. Stat Reset (D2Game.dll 0x6fd0af80): reset Str/Dex/Ene/Vit to CharStats base values and refund to stat 4 (statpts).
  const base = CANONICAL_CHARSTATS[player.classCode]
  const strDiff = base.baseAttributes.strength - player.strength
  if (strDiff !== 0) {
    player.statPts -= strDiff
    player.strength = base.baseAttributes.strength
  }
  const dexDiff = base.baseAttributes.dexterity - player.dexterity
  if (dexDiff !== 0) {
    player.statPts -= dexDiff
    player.dexterity = base.baseAttributes.dexterity
  }
  const eneDiff = base.baseAttributes.energy - player.energy
  if (eneDiff !== 0) {
    player.statPts -= eneDiff
    player.energy = base.baseAttributes.energy
    const manaDeltaFixed = Math.round(
      base.perStatPoint.manaPerEnergy * eneDiff * FIXED_ONE,
    )
    player.maxManaFixed = Math.max(0, player.maxManaFixed + manaDeltaFixed)
  }
  const vitDiff = base.baseAttributes.vitality - player.vitality
  if (vitDiff !== 0) {
    player.statPts -= vitDiff
    player.vitality = base.baseAttributes.vitality
    const lifeDeltaFixed = Math.round(
      base.perStatPoint.lifePerVitality * vitDiff * FIXED_ONE,
    )
    const stamDeltaFixed = Math.round(
      base.perStatPoint.staminaPerVitality * vitDiff * FIXED_ONE,
    )
    player.maxHpFixed = Math.max(FIXED_ONE, player.maxHpFixed + lifeDeltaFixed)
    player.maxStaminaFixed = Math.max(FIXED_ONE, player.maxStaminaFixed + stamDeltaFixed)
  }
  this.refreshPlayerAccruedMaxPools(player)

  for (const [statId, val] of [
    [0, player.strength],
    [1, player.energy],
    [2, player.dexterity],
    [3, player.vitality],
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
      value: val,
    })
    this.emitToPlayer(player.unitId, {
      type: 'StatSet',
      stat: statId,
      value: val,
    })
  }
  this.emitPlayerVitals(player)
}



/**
 * 1.13c C2S `0x5E` Party Button dispatcher (`D2Game.dll` `0x6FD10100` -> `0x6FD1A3B0`):
 * - `0x06` (`'invite'`, `0x6FD10870`): send party invitation (`player -> target`), emit `S2C 0x8B`
 *   (`relation: 4` to inviter, `relation: 2` to invitee) without changing `partyId`.
 * - `0x07` (`'cancel'`, `0x6FD10900`): cancel pending invitation (`player -> target`, `state === 4`),
 *   emit `S2C 0x8B` (`relation: 0` or `1`) and never remove `player` from their existing party.
 * - `0x08` (`'accept'` / `'join'`, `0x6FD10D50`): accept pending invitation (`target -> player`),
 *   join `target`'s party (or allocate a new party ID), broadcast `S2C 0x8D` (`AssignPlayerToParty`),
 *   and emit `S2C 0x8B` (`relation: 1`) between party members.
 * - `0x09` (`'leave'`, `0x6FD110F0` -> `0x6FCBC840` -> `0x6FCBC930`): leave current party (`0xFFFF`),
 *   disband the party if `<= 1` member remains, and broadcast `S2C 0x8D` (`0xFFFF`) + `S2C 0x8B` (`relation: 0`).
 */
function handlePartyCommand(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  action: number | string,
  targetPlayerId: number,
): void {
  if (action === 0x09 || action === 'leave') {
    if (player.partyId === 0xffff) return
    const formerPartyMembers = Array.from(this.players.values()).filter(
      (p) => p.partyId === player.partyId && p.unitId !== player.unitId,
    )
    const leaveEvents = this.partyManager.leaveParty(player.unitId)
    for (const ev of leaveEvents) {
      for (const p of this.players.values()) {
        this.emitToPlayer(p.unitId, ev)
      }
    }
    for (const former of formerPartyMembers) {
      this.emitToPlayer(player.unitId, {
        type: 'Party',
        kind: 'relation',
        source: 0x8b,
        unitId: former.unitId,
        playerId: former.unitId,
        relation: 0,
      })
      this.emitToPlayer(former.unitId, {
        type: 'Party',
        kind: 'relation',
        source: 0x8b,
        unitId: player.unitId,
        playerId: player.unitId,
        relation: 0,
      })
    }
    return
  }

  const target = this.players.get(targetPlayerId)
  if (!target || target.unitId === player.unitId) return

  if (action === 0x06 || action === 'invite') {
    if (player.partyId !== 0xffff && player.partyId === target.partyId) return
    const events = this.partyManager.invite(player.unitId, target.unitId)
    if (events.length === 0) return
    this.emitToPlayer(player.unitId, {
      type: 'Party',
      kind: 'relation',
      source: 0x8b,
      unitId: target.unitId,
      playerId: target.unitId,
      relation: 4,
    })
    this.emitToPlayer(target.unitId, {
      type: 'Party',
      kind: 'relation',
      source: 0x8b,
      unitId: player.unitId,
      playerId: player.unitId,
      relation: 2,
    })
  } else if (action === 0x07 || action === 'cancel') {
    const events = this.partyManager.cancelInvite(player.unitId, target.unitId)
    if (events.length === 0) return
    this.emitToPlayer(player.unitId, {
      type: 'Party',
      kind: 'relation',
      source: 0x8b,
      unitId: target.unitId,
      playerId: target.unitId,
      relation: target.partyId !== 0xffff ? 1 : 0,
    })
    this.emitToPlayer(target.unitId, {
      type: 'Party',
      kind: 'relation',
      source: 0x8b,
      unitId: player.unitId,
      playerId: player.unitId,
      relation: player.partyId !== 0xffff ? 1 : 0,
    })
  } else if (action === 0x08 || action === 'accept' || action === 'join') {
    if (!this.partyManager.hasPendingInvite(target.unitId, player.unitId)) return
    const rosterEvents = this.partyManager.accept(player.unitId, target.unitId)
    if (rosterEvents.length === 0) return
    for (const ev of rosterEvents) {
      for (const p of this.players.values()) {
        this.emitToPlayer(p.unitId, ev)
      }
    }
    for (const member of this.players.values()) {
      if (member.partyId === player.partyId && member.unitId !== player.unitId) {
        this.emitToPlayer(player.unitId, {
          type: 'Party',
          kind: 'relation',
          source: 0x8b,
          unitId: member.unitId,
          playerId: member.unitId,
          relation: 1,
        })
        this.emitToPlayer(member.unitId, {
          type: 'Party',
          kind: 'relation',
          source: 0x8b,
          unitId: player.unitId,
          playerId: player.unitId,
          relation: 1,
        })
      }
    }
    for (const member of this.players.values()) {
      if (member.partyId === player.partyId) {
        this.emitPartyMemberPulsesForPlayer(member)
      }
    }
  }
}



/**
 * 1.13c C2S `0x5D` Player Relationship (`D2Game.dll` `0x6FD10AC6` dispatch table `0x6FD1A3B0`):
 * Button 1 (`0x6FD10F40`): Squelch / Mute toggle (bit 1 `0x01`). Suppresses chat from target.
 * Button 2 (`0x6FD10EE0`): Allow Loot / Corpse Loot permit (bit 2 `0x02`). Permits looting corpse items.
 * Button 3 (`0x6FD10E80`): Hostile (bit 4 `0x04`).
 * Button 4 (`0x6FD11130`): Hostility toggle (bit 8 `0x08`). Gated by `policy.allowPvpHostile`.
 * Requires both `player.level >= 9` and `target.level >= 9` per `0x6fd11153..0x6fd11177`.
 * When hostile is enabled, leaves shared party (`0x6FCBC840`) and broadcasts `S2C 0x8C`.
 */
function handleHostileCommand(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  targetPlayerId: number,
  hostile: boolean,
  button?: number,
): void {
  const target = this.players.get(targetPlayerId)
  if (!target || target.unitId === player.unitId) return

  const decision = validatePlayerRelation0x5D113c({
    allowPvpHostile: Boolean(this.policy.allowPvpHostile),
    actorPlayerId: player.unitId,
    actorAreaId: player.areaId,
    actorLevel: player.level,
    actorIsHardcore: isPlayerHardcore113c(player),
    targetPlayerId: target.unitId,
    targetLevel: target.level,
    targetIsHardcore: isPlayerHardcore113c(target),
    state: hostile,
    button,
  })
  if (decision.kind === 'reject') return

  let events: ServerEvent[] = []
  if (decision.kind === 'mute') {
    events = this.partyManager.setMuted(player.unitId, target.unitId, decision.muted)
  } else if (decision.kind === 'loot_permit') {
    events = this.partyManager.setLootPermission(player.unitId, target.unitId, decision.permitted)
  } else {
    const wasHostile = this.partyManager.areHostile(player.unitId, target.unitId)
    events = [
      ...this.partyManager.setHostile(
        player.unitId,
        target.unitId,
        decision.hostile,
        decision.button,
      ),
    ]
    if (decision.closeInitiatorTownPortal) {
      this.closeTownPortal(player)
      player.hostilePortalLockUntilFrame = this.currentFrame + decision.portalLockoutFrames
    }
    if (decision.hostile !== wasHostile || decision.hostile) {
      events.push(
        buildHostileRelationEvent0x5A113c({
          actorPlayerUnitId: player.unitId,
          actorName: player.name,
          targetName: target.name,
          hostile: decision.hostile,
        }),
      )
    }
  }

  for (const ev of events) {
    for (const p of this.players.values()) {
      this.emitToPlayer(p.unitId, ev)
    }
  }
}



function handleChatCommand(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  text: string,
  whisperTo?: string,
): void {
  const trimmed = text.trim()
  const playersSetMatch = /^players set to (-?\d+)$/i.exec(trimmed)
  const slashPlayersMatch = /^\/players(.*)$/i.exec(trimmed)
  const barePlayersMatch = /^players(?:\s+(?:set\s+)?|\s*:\s*)(-?\d+)$/i.exec(trimmed)
  if (playersSetMatch || slashPlayersMatch || barePlayersMatch) {
    if (this.policy.allowPlayersXCommand) {
      // The 1.13c client sends `/players N` as the chat line "players set to N" (D2Client 0x6fb20aa2).
      let val: number
      if (playersSetMatch) {
        val = Number(playersSetMatch[1])
      } else if (slashPlayersMatch) {
        const atoiMatch = /^[\t\n\v\f\r :]*([+-]?\d+)/.exec(slashPlayersMatch[1] ?? '')
        val = atoiMatch ? Number.parseInt(atoiMatch[1]!, 10) : 1
      } else {
        val = Number(barePlayersMatch![1])
      }
      this.setPlayersX(val, { syncMonsterPlayerCount: this.currentFrame <= 1 })
      this.emitToPlayer(player.unitId, {
        type: 'Chat',
        kind: 'system',
        from: 'Server',
        text: `players set to ${this.playersX}`,
      })
    }
    return
  }

  if (whisperTo) {
    let targetPlayer: InternalPlayerRecord | undefined
    for (const p of this.players.values()) {
      if (p.name.toLowerCase() === whisperTo.toLowerCase()) {
        targetPlayer = p
        break
      }
    }
    if (targetPlayer && targetPlayer.unitId !== player.unitId) {
      if (!this.partyManager.isMuted(targetPlayer.unitId, player.unitId)) {
        this.emitToPlayer(targetPlayer.unitId, {
          type: 'Chat',
          kind: 'whisper',
          eventType: 0x02,
          from: player.name,
          unit: { unitType: 0, id: player.unitId },
          text,
        })
      }
    }
    // 1.13c D2Game.dll 0x6FCEDBB0: sender receives whisper confirmation (`chatType = 0x06`, `from = targetName`).
    this.emitToPlayer(player.unitId, {
      type: 'Chat',
      kind: 'whisper',
      eventType: 0x06,
      from: targetPlayer ? targetPlayer.name : whisperTo,
      unit: { unitType: 0, id: player.unitId },
      text,
    })
  } else {
    const sayEv: ServerEvent = {
      type: 'Chat',
      kind: 'say',
      eventType: 0x01,
      from: player.name,
      unit: { unitType: 0, id: player.unitId },
      text,
    }
    for (const p of this.players.values()) {
      if (p.unitId !== player.unitId && this.partyManager.isMuted(p.unitId, player.unitId)) {
        continue
      }
      this.emitToPlayer(p.unitId, sayEv)
    }
  }
}



/**
 * 1.13c `C2S 0x14` (`OverheadMessage`, `D2Game.dll` `0x6FCF00A0`):
 * Broadcasts `S2C 0x26` (`chatType = 0x05`, `unitType = 0`, `unitId = player.unitId`) to players
 * in the speaker's area, or `S2C 0x76` (`UnitHoverTextClear`) when cleared with an empty string.
 */
function handleOverheadChatCommand(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  rawText: string,
): void {
  const sanitized = rawText.replace(/[\x00-\x1f]/g, '').slice(0, 255)
  if (sanitized.trim().length === 0) {
    this.broadcastToArea(player.areaId, {
      type: 'UnitHoverTextClear',
      rawUnitType: 0,
      id: player.unitId,
    })
    return
  }
  const ev: ServerEvent = {
    type: 'Chat',
    kind: 'overhead',
    eventType: 0x05,
    from: player.name,
    unit: { unitType: 0, id: player.unitId },
    text: sanitized,
  }
  for (const p of this.players.values()) {
    if (p.areaId !== player.areaId) continue
    if (p.unitId !== player.unitId && this.partyManager.isMuted(p.unitId, player.unitId)) {
      continue
    }
    this.emitToPlayer(p.unitId, ev)
  }
}



/** Event `unitType` field (`0..5` or a `UnitTypeName`) -> 1.13c unit type; undefined when absent. */
function eventUnitType113c(raw: unknown): UnitType113c | undefined {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 0 && raw <= 5 ? (raw as UnitType113c) : undefined
  }
  if (typeof raw === 'string' && raw in UNIT_TYPE_113C) {
    return UNIT_TYPE_113C[raw as keyof typeof UNIT_TYPE_113C]
  }
  return undefined
}



function findUnitPosition(this: GameInstanceHost, 
  unitId: number,
  areaId?: number,
  unitType?: UnitType113c,
): { x: number; y: number } | undefined {
  // 1.13c unit ids are unique only within a unit type (`SUNIT_GetNewUnitId` 0x6FCFF9C0). With a type,
  // only that type's containers are searched; without one, the legacy any-kind order is kept.
  const isType = (t: UnitType113c): boolean => unitType === undefined || unitType === t
  const inArea = (a: number): boolean => areaId === undefined || a === areaId
  if (isType(UNIT_TYPE_113C.player)) {
    const p = this.players.get(unitId)
    if (p && inArea(p.areaId)) return { x: p.x, y: p.y }
  }
  if (isType(UNIT_TYPE_113C.monster)) {
    const m = this.monsters.get(unitId)
    if (m && inArea(m.areaId)) return { x: m.x, y: m.y }
    const merc = this.mercenaries.get(unitId)
    if (merc && merc.alive && inArea(merc.areaId)) {
      return { x: merc.x, y: merc.y }
    }
    const mp = this.findMercOrPetRecord(unitId)
    if (mp !== undefined) {
      if (mp.kind === 'merc') {
        if (inArea(mp.merc.areaId)) return { x: mp.merc.x, y: mp.merc.y }
      } else if (inArea(mp.areaId)) {
        return { x: mp.x, y: mp.y }
      }
    }
  }
  if (isType(UNIT_TYPE_113C.object)) {
    const o = this.objects.get(unitId)
    if (o && inArea(o.areaId)) return { x: o.x, y: o.y }
  }
  if (isType(UNIT_TYPE_113C.item)) {
    const g = this.groundItems.get(unitId)
    if (g && inArea(g.areaId)) return { x: g.x, y: g.y }
  }
  if (isType(UNIT_TYPE_113C.tile)) {
    const w = this.warpTiles.get(unitId)
    if (w && inArea(w.areaId)) return { x: w.x, y: w.y }
  }
  if (isType(UNIT_TYPE_113C.missile)) {
    const mis = this.missiles.get(unitId)
    if (mis && inArea(mis.areaId)) return { x: mis.x, y: mis.y }
  }
  if (!isType(UNIT_TYPE_113C.player)) return undefined
  // Player corpses are UNIT_PLAYER units.
  for (const owner of this.players.values()) {
    if (owner.corpseId === unitId && this.hasLivePrimaryCorpse113c(owner)) {
      const cArea = owner.corpseAreaId ?? owner.areaId
      if (inArea(cArea)) {
        return { x: owner.corpseX, y: owner.corpseY }
      }
    }
    for (const extra of owner.extraCorpses ?? []) {
      if (extra.corpseId === unitId && (extra.items.length > 0 || (extra.lostExp ?? 0) > 0)) {
        if (inArea(extra.areaId)) {
          return { x: extra.x, y: extra.y }
        }
      }
    }
  }
  return undefined
}



function extractEventPosition113c(this: GameInstanceHost, 
  areaId: number,
  ev: ServerEvent,
): { readonly x: number; readonly y: number } | undefined {
  const rec = ev as unknown as Record<string, unknown>
  if (rec['type'] === 'ItemEvent' && rec['container'] && rec['container'] !== 'ground') {
    const ownerId =
      typeof (rec['item'] as Record<string, unknown> | undefined)?.['ownerId'] === 'number'
        ? Number((rec['item'] as Record<string, unknown>)['ownerId'])
        : undefined
    if (ownerId !== undefined && ownerId > 0) {
      const item = rec['item'] as Record<string, unknown>
      const ownerType =
        eventUnitType113c(item['ownerType']) ??
        (rec['container'] === 'merc' ? UNIT_TYPE_113C.monster : UNIT_TYPE_113C.player)
      return this.findUnitPosition(ownerId, areaId, ownerType)
    }
  }
  if (typeof rec['x'] === 'number' && typeof rec['y'] === 'number') {
    return { x: rec['x'], y: rec['y'] }
  }
  const at = rec['at'] as { readonly x?: unknown; readonly y?: unknown } | undefined
  if (at && typeof at.x === 'number' && typeof at.y === 'number') {
    return { x: at.x, y: at.y }
  }
  const from = rec['from'] as { readonly x?: unknown; readonly y?: unknown } | undefined
  if (from && typeof from.x === 'number' && typeof from.y === 'number') {
    return { x: from.x, y: from.y }
  }
  const unit = rec['unit'] as
    | { readonly x?: unknown; readonly y?: unknown; readonly id?: unknown }
    | undefined
  if (unit && typeof unit.x === 'number' && typeof unit.y === 'number') {
    return { x: unit.x, y: unit.y }
  }
  // Ids are per unit type in 1.13c: resolve the id together with the type the event names.
  const typedKeys: readonly (readonly [string, UnitType113c | undefined])[] = [
    ['unitId', undefined],
    ['id', undefined],
    ['itemId', UNIT_TYPE_113C.item],
    ['portalId', UNIT_TYPE_113C.object],
    ['missileId', UNIT_TYPE_113C.missile],
    ['mercId', UNIT_TYPE_113C.monster],
    ['corpseId', UNIT_TYPE_113C.player],
  ]
  const declaredType = eventUnitType113c(rec['unitType'])
  for (const [key, keyType] of typedKeys) {
    const candidateId = rec[key]
    if (typeof candidateId !== 'number') continue
    const t = keyType ?? declaredType
    return this.findUnitPosition(candidateId, areaId, t) ?? this.findUnitPosition(candidateId, undefined, t)
  }
  if (unit && typeof unit.id === 'number') {
    const t = eventUnitType113c((unit as Record<string, unknown>)['unitType']) ?? declaredType
    return this.findUnitPosition(unit.id, areaId, t) ?? this.findUnitPosition(unit.id, undefined, t)
  }
  return undefined
}



function shouldDeliverAreaEventToViewer113c(this: GameInstanceHost, 
  viewer: InternalPlayerRecord,
  areaId: number,
  ev: ServerEvent,
  pos: { readonly x: number; readonly y: number } | undefined,
): boolean {
  if (viewer.areaId !== areaId && !this.isAreaSeamAdjacent(viewer.areaId, areaId)) {
    return false
  }
  if (pos !== undefined) {
    return this.isPointInViewerAoi113c(viewer, areaId, pos.x, pos.y)
  }
  if (viewer.areaId === areaId) return true
  return ev.type === 'UnitRemove' || ev.type === 'CorpseAssign'
}



function emitToPlayer(this: GameInstanceHost, playerUnitId: number, ev: ServerEvent): void {
  const queue = this.outbox.get(playerUnitId)
  if (queue) {
    queue.push(ev)
  }
}



function broadcastToArea(this: GameInstanceHost, areaId: number, ev: ServerEvent): void {
  const pos = this.extractEventPosition113c(areaId, ev)
  for (const p of this.players.values()) {
    if (this.shouldDeliverAreaEventToViewer113c(p, areaId, ev, pos)) {
      this.emitToPlayer(p.unitId, ev)
    }
  }
}



/** {@link broadcastToArea} without `exceptPlayerUnitId` (e.g. the moving player's own client). */
function broadcastToAreaExcept(this: GameInstanceHost, areaId: number, exceptPlayerUnitId: number, ev: ServerEvent): void {
  const pos = this.extractEventPosition113c(areaId, ev)
  for (const p of this.players.values()) {
    if (
      p.unitId !== exceptPlayerUnitId &&
      this.shouldDeliverAreaEventToViewer113c(p, areaId, ev, pos)
    ) {
      this.emitToPlayer(p.unitId, ev)
    }
  }
}

export interface TradePartyAndProgressionMethods {
  isUntradableQuestItem113c(item: ServerItemEntry): boolean
  buildSocketChildEvents(item: ServerItemEntry, action: number): ServerEvent[]
  emitSocketChildrenToPlayer(playerId: number, item: ServerItemEntry, action: number): void
  emitSocketChildrenToArea(areaId: number, item: ServerItemEntry, action: number): void
  computePlayerPartyLifePct100(player: InternalPlayerRecord): number
  emitPartyMemberPulsesForPlayer(player: InternalPlayerRecord): void
  stepPartyMemberPulses(): void
  emitTradeEvents(events: readonly PlayerDirectedTradeEvent[]): void
  emitPartnerTradeItemAdd(partnerId: number, item: ServerItemEntry): void
  emitPartnerTradeItemRemove(partnerId: number, item: ServerItemEntry, x?: number | undefined, y?: number | undefined): void
  emitItemDeleted(playerId: number, item: ServerItemEntry, container: ItemContainer): void
  placeServerItem113c(item: ServerItemEntry, location: 'inventory' | 'stash' | 'cube' | 'cursor', x: number, y: number, ownerId: number): void
  emitPlayerGoldStat(player: InternalPlayerRecord): void
  handleSocketItem(player: InternalPlayerRecord, fillerId: number, hostId: number): void
  handleCubeTransmute(player: InternalPlayerRecord): void
  handlePlayerTradeInteract(player: InternalPlayerRecord, targetId: number): void
  handleTradeButton(player: InternalPlayerRecord, buttonId: number, amount: number): void
  commitTradeSession(session: ActiveTradeSession113c): void
  abortPlayerTrade(playerId: number): void
  returnPlayerTradeItemsToInventory(player: InternalPlayerRecord): void
  handleAllocateStat(player: InternalPlayerRecord, statId: number, amount: number): void
  handleAllocateSkill(player: InternalPlayerRecord, skillId: number): void
  handleAkaraRespec(player: InternalPlayerRecord, npcId: number): boolean
  executePlayerRespec113c(player: InternalPlayerRecord): void
  handlePartyCommand(player: InternalPlayerRecord, action: number | string, targetPlayerId: number): void
  handleHostileCommand(player: InternalPlayerRecord, targetPlayerId: number, hostile: boolean, button?: number): void
  handleChatCommand(player: InternalPlayerRecord, text: string, whisperTo?: string): void
  handleOverheadChatCommand(player: InternalPlayerRecord, rawText: string): void
  findUnitPosition(unitId: number, areaId?: number, unitType?: UnitType113c): { x: number; y: number } | undefined
  extractEventPosition113c(areaId: number, ev: ServerEvent): { readonly x: number; readonly y: number } | undefined
  shouldDeliverAreaEventToViewer113c(viewer: InternalPlayerRecord, areaId: number, ev: ServerEvent, pos: { readonly x: number; readonly y: number } | undefined): boolean
  emitToPlayer(playerUnitId: number, ev: ServerEvent): void
  broadcastToArea(areaId: number, ev: ServerEvent): void
  broadcastToAreaExcept(areaId: number, exceptPlayerUnitId: number, ev: ServerEvent): void
}

export const tradePartyAndProgressionMethods: Record<keyof TradePartyAndProgressionMethods, unknown> = {
  isUntradableQuestItem113c,
  buildSocketChildEvents,
  emitSocketChildrenToPlayer,
  emitSocketChildrenToArea,
  computePlayerPartyLifePct100,
  emitPartyMemberPulsesForPlayer,
  stepPartyMemberPulses,
  emitTradeEvents,
  emitPartnerTradeItemAdd,
  emitPartnerTradeItemRemove,
  emitItemDeleted,
  placeServerItem113c,
  emitPlayerGoldStat,
  handleSocketItem,
  handleCubeTransmute,
  handlePlayerTradeInteract,
  handleTradeButton,
  commitTradeSession,
  abortPlayerTrade,
  returnPlayerTradeItemsToInventory,
  handleAllocateStat,
  handleAllocateSkill,
  handleAkaraRespec,
  executePlayerRespec113c,
  handlePartyCommand,
  handleHostileCommand,
  handleChatCommand,
  handleOverheadChatCommand,
  findUnitPosition,
  extractEventPosition113c,
  shouldDeliverAreaEventToViewer113c,
  emitToPlayer,
  broadcastToArea,
  broadcastToAreaExcept,
}
