/**
 * GameInstance Subsystem: Item Serialization, Equipment/Set/Charm Stat Aggregation & Loot Drop Rolling (`src/server/engine/game-instance/item-stats-and-drops.ts`).
 */

import { getEmbeddedDropTables } from '../../../common/items/embedded-drop-tables.ts'
import type { Item } from '../../../common/items/items.ts'
import { generateGambleInventory, generateVendorStoreInventory, VENDOR_TAB_KEYS } from '../../../common/items/vendor-generator.ts'
import { getMonsterModeBaseFrameCount113c } from '../../../common/path/monster-anim-metrics-113c.ts'
import { getMonsterModeBaseAnimSpeed256 } from '../../../common/path/units.ts'
import { resolveWeaponBase113c } from '../../../common/units/char-anim-speed.ts'
import { QUEST_FLAG_COMPLETED_113C, QUEST_FLAG_COMPLETED_NOW_113C, QUEST_FLAG_PRIMARY_GOAL_DONE_113C, QUEST_FLAG_STARTED_113C, getVendorQuestDiscountPct113c } from '../quests-113c.ts'
import { createDroppedItem } from '../../../common/items/drop-tables.ts'
import { D2Rng } from '../../../common/rng/d2-rng.ts'
import { MONSTATS_113C_ROWS } from '../../../common/units/monstats-113c-data.ts'
import { getTownNpcDescriptorByHcIdx } from '../../../common/units/npc-table.ts'
import { getSuperUniqueIndexById } from '../../../common/units/monsters-data.ts'
import { MONSTATS2_COMP_BIT_WIDTHS_BY_HCIDX, type ItemData, type ItemQuality, type ServerEvent, type UnitId, type ItemStat } from '../../../netproto/index.ts'
import { executePendingMonsterDrop113c, executeDropPipeline, resolveMonsterDropPending113c } from '../../items/drop-pipeline.ts'
import { computeWornSetSiblingMasks113c, domainItemToItemData113c, finalizeDroppedItem113c, isSetBonusSlotActive113c, makeDeterministicSetBonusRng113c, resolveChestDropContext113c, rollSetBonusPropIfNeeded } from '../../items/server-item-data.ts'
import type { SUnitDmgOutcome } from '../combat-pipeline.ts'
import { FIXED_ONE } from '../stat-list.ts'
import { computeTransactionCost113c, getCanonicalTransactionCostTables, type TransactionCostContext, type TransactionCostInput, type TransactionCostStat } from '../../../common/items/transaction-cost.ts'
import { resolveOnlineItemReqLevel } from '../../../common/items/item-bridge.ts'
import { resolveActiveSetBonuses, type SetBonusProp } from '../../../common/items/set-items.ts'
import { resolveGemSocketItemStats113c } from '../../items/cube-engine-113c.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMercenaryRecord, InternalMonsterRecord, InternalObjectRecord, InternalPlayerRecord, ServerItemEntry } from './types.ts'
import { ACT_BOSS_QUEST_113C, BODYLOC_LEFT_ARM, BODYLOC_RIGHT_ARM, MONSTER_DEATH_DROP_DELAY_FRAMES, PER_LEVEL_STAT_MAP_113C, findChargedSkill, lookupBaseInfo, playerWirePosition, requireBaseInfo, statsMapMatchesItemStats, toItemContainer, UNIT_TYPE_113C } from './constants-and-helpers.ts'


function itemDataToServerEntry(this: GameInstanceHost, 
  itemData: ItemData,
  ownerId: number,
  areaId: number,
  allocateFreshId = false,
): ServerItemEntry {
  const info = lookupBaseInfo(itemData.code)
  const locNum = itemData.location
  let location: ServerItemEntry['location'] = 'inventory'
  if (locNum === 3 || locNum === 5 || itemData.container === 'ground') location = 'ground'
  else if (locNum === 1 || itemData.container === 'equipment') location = 'equipped'
  else if (locNum === 2 || itemData.container === 'belt') location = 'belt'
  else if (locNum === 4 || itemData.container === 'cursor') location = 'cursor'
  else if (locNum === 6 || itemData.container === 'socket') location = 'socket'
  else if (itemData.container === 'stash' || itemData.storePage === 5) location = 'stash'
  else if (itemData.container === 'cube' || itemData.storePage === 4) location = 'cube'
  else if (
    itemData.container === 'tradeSelf' ||
    itemData.container === 'tradePartner' ||
    itemData.container === 'trade' ||
    itemData.storePage === 3 ||
    itemData.storePage === 2
  ) {
    location = 'trade'
  }

  const stats = new Map<number, number>()
  for (const st of itemData.stats ?? []) {
    stats.set(st.statId, (stats.get(st.statId) ?? 0) + st.value)
  }
  for (const st of itemData.runewordStats ?? []) {
    stats.set(st.statId, (stats.get(st.statId) ?? 0) + st.value)
  }
  for (const child of itemData.socketedItems ?? []) {
    for (const st of resolveGemSocketItemStats113c(child, itemData.code)) {
      stats.set(st.statId, (stats.get(st.statId) ?? 0) + st.value)
    }
  }

  const rawId = Number(itemData.id ?? 0)
  const unitId =
    !allocateFreshId && rawId > 0 && !this.isItemUnitIdInUse(rawId)
      ? rawId
      : this.allocateUnitId(UNIT_TYPE_113C.item)
  // Keep the item id counter ahead of ids adopted from item data (item unit type only).
  if (unitId >= this.nextUnitIdByType[UNIT_TYPE_113C.item]!) {
    this.nextUnitIdByType[UNIT_TYPE_113C.item] = unitId + 1
  }

  const resolvedStorePage =
    location === 'stash'
      ? 5
      : location === 'cube'
        ? 4
        : location === 'trade'
          ? itemData.storePage === 2
            ? 2
            : 3
          : location === 'inventory'
            ? 1
            : 0

  const socketedEntries = (itemData.socketedItems ?? []).map((child) =>
    this.itemDataToServerEntry(child, ownerId, areaId, allocateFreshId),
  )

  const syncedRawItemData: ItemData = {
    ...itemData,
    id: unitId as UnitId,
    itemId: unitId as UnitId,
    ownerId: ownerId as UnitId,
    ...(socketedEntries.length > 0
      ? {
          socketedItems: socketedEntries.map((c) => this.serverEntryToItemData(c)),
        }
      : {}),
  }

  return {
    unitId,
    code: itemData.code.trim(),
    name: info.name,
    quality: itemData.quality ?? 2,
    level: itemData.ilvl ?? 1,
    location,
    x: itemData.x ?? 0,
    y: itemData.y ?? 0,
    width: info.width,
    height: info.height,
    areaId,
    ownerId,
    bodyLoc: itemData.bodyLoc ?? 0,
    storePage: itemData.storePage ?? resolvedStorePage,
    cost: info.cost,
    gamble: false,
    identified: itemData.identified ?? true,
    ethereal: itemData.ethereal ?? false,
    socketed: (itemData.socketed ?? false) || socketedEntries.length > 0,
    totalSockets: Math.max(itemData.totalSockets ?? 0, socketedEntries.length),
    durability: itemData.durability ?? info.maxDurability,
    maxDurability: itemData.maxDurability ?? info.maxDurability,
    quantity: itemData.quantity ?? 1,
    stats,
    socketedItems: socketedEntries,
    rawItemData: syncedRawItemData,
  }
}



function serverEntryToItemData(this: GameInstanceHost, entry: ServerItemEntry): ItemData {
  const isGround = entry.location === 'ground'
  let location = 0
  let storePage = entry.storePage
  if (isGround) {
    location = 3
    storePage = 0
  } else if (entry.location === 'equipped') {
    location = 1
    storePage = 0
  } else if (entry.location === 'belt') {
    location = 2
    storePage = 0
  } else if (entry.location === 'cursor') {
    location = 4
    storePage = 0
  } else if (entry.location === 'socket') {
    location = 6
    storePage = 0
  } else if (entry.location === 'stash') {
    location = 0
    storePage = 5
  } else if (entry.location === 'cube') {
    location = 0
    storePage = 4
  } else if (entry.location === 'trade') {
    location = 0
    storePage = entry.storePage === 2 ? 2 : 3
  } else if (entry.location === 'vendor') {
    // Store items carry their store tab (1..4: armor, weapons1, weapons2, misc) as the bitstream page.
    location = 0
    storePage = entry.storePage
  } else {
    location = 0
    storePage = 1
  }

  const baseRaw = entry.rawItemData
  const entryStats = entry.stats ?? new Map<number, number>()
  const socketedItems = entry.socketedItems ?? []
  const hasCustomStats = entryStats.size > 0
  const hasSocketOrRunewordExtras =
    baseRaw !== undefined &&
    (socketedItems.length > 0 || Boolean(baseRaw.runeword))
  // Keep the packet stat list (with params) when the gameplay map is just its statId -> value fold,
  // or when socketed/runeword children are folded into `entry.stats` while `baseRaw.stats` stores own stats.
  const statsList = hasSocketOrRunewordExtras
    ? (baseRaw.stats ?? [])
    : baseRaw?.stats &&
        baseRaw.stats.length > 0 &&
        (!hasCustomStats || statsMapMatchesItemStats(entryStats, baseRaw.stats))
      ? baseRaw.stats
      : Array.from(entryStats.entries()).map(([statId, value]) => ({
          statId,
          param: 0,
          value,
        }))

  const trimmedCode = entry.code.trim()
  const codePadded = entry.code.padEnd(4, ' ').slice(0, 4)
  const baseSize = lookupBaseInfo(trimmedCode)
  const normalizedQuality = this.normalizeItemQualityCode113c(
    baseRaw?.quality ?? entry.quality,
  ) as ItemQuality
  const isSocketed = Boolean(entry.socketed) || socketedItems.length > 0
  const totalSockets = Math.max(entry.totalSockets ?? 0, socketedItems.length)
  const isRuneword = Boolean(baseRaw?.runeword)
  const isPersonalized = Boolean(baseRaw?.personalized)
  const baseRawFlags =
    typeof baseRaw?.rawFlags === 'number'
      ? baseRaw.rawFlags
      : typeof baseRaw?.flags === 'number'
        ? baseRaw.flags
        : 0x00000010
  const isGoldItem = trimmedCode === 'gld'
  const isEar =
    trimmedCode === 'ear' ||
    Boolean(baseRaw?.isEar) ||
    (baseRawFlags & 0x00010000) !== 0
  const hasExtendedStats = statsList.some(
    (s) => s.statId !== 356 && (!isGoldItem || s.statId !== 14),
  )
  const isIdentified = entry.identified ?? true
  const isEthereal = Boolean(entry.ethereal)
  const entryX = entry.x ?? 0
  const entryY = entry.y ?? 0
  const canBeCompact =
    isGoldItem ||
    isEar ||
    (baseSize.compactSave &&
      !baseSize.stackable &&
      trimmedCode !== 'tbk' &&
      trimmedCode !== 'ibk' &&
      !hasExtendedStats &&
      !isSocketed &&
      totalSockets === 0 &&
      !isEthereal &&
      !isRuneword &&
      (baseRaw?.runewordStats?.length ?? 0) === 0 &&
      (baseRaw?.setBonusStats?.length ?? 0) === 0 &&
      !isPersonalized &&
      !baseRaw?.isGambleMystery &&
      isIdentified &&
      normalizedQuality === 2)
  const isSimple =
    isGoldItem || isEar
      ? true
      : !canBeCompact
        ? false
        : Boolean(baseRaw?.simple ?? true)
  const isCompact =
    isGoldItem || isEar
      ? true
      : !canBeCompact
        ? false
        : Boolean(baseRaw?.compact ?? isSimple)
  const beltLinearSlot =
    entry.location === 'belt'
      ? (entryY > 0 ? entryY * 4 + (entryX & 3) : entryX) & 0x0f
      : entryX

  let rawFlagsNum = baseRawFlags
  rawFlagsNum &= ~0x00000020
  if (isIdentified) rawFlagsNum |= 0x00000010
  else rawFlagsNum &= ~0x00000010
  if (isSocketed || totalSockets > 0) rawFlagsNum |= 0x00000800
  if (isEthereal) rawFlagsNum |= 0x00400000
  if (isRuneword) rawFlagsNum |= 0x04000000
  if (isPersonalized) rawFlagsNum |= 0x01000000
  if (isEar) rawFlagsNum |= 0x00210000
  else if (isCompact) rawFlagsNum |= 0x00200000
  else rawFlagsNum &= ~0x00200000
  rawFlagsNum = rawFlagsNum >>> 0

  return {
    ...(baseRaw ?? {}),
    id: entry.unitId as UnitId,
    itemId: entry.unitId as UnitId,
    opcode: isGround ? 0x9c : (baseRaw?.opcode ?? 0x9c),
    action: isGround
      ? (baseRaw?.action === 0x02 ? 0x02 : 0x00)
      : (baseRaw?.action ?? (entry.location === 'vendor' ? 0x0b : 0)),
    category: baseRaw?.category ?? 0,
    ownerType: isGround ? 0 : (baseRaw?.ownerType ?? (entry.location === 'vendor' ? 1 : 0)),
    ownerId: (isGround ? 0 : (entry.ownerId ?? 0)) as UnitId,
    flags: rawFlagsNum,
    rawFlags: rawFlagsNum,
    version: baseRaw?.version ?? 101,
    location,
    container: toItemContainer(entry.location),
    bodyLoc: isGround ? 0 : (entry.bodyLoc ?? 0),
    equippedSlot: isGround ? 0 : (entry.bodyLoc ?? 0),
    gridX: isGround ? 0 : beltLinearSlot,
    gridY: isGround || entry.location === 'belt' ? 0 : entryY,
    storePage,
    storagePage: storePage,
    worldX: isGround ? entryX : 0,
    worldY: isGround ? entryY : 0,
    x: entry.location === 'belt' ? beltLinearSlot : entryX,
    y: entry.location === 'belt' ? 0 : entryY,
    code: trimmedCode,
    rawCode: codePadded,
    compact: isCompact,
    simple: isSimple,
    identified: isIdentified,
    socketed: isSocketed,
    ethereal: isEthereal,
    runeword: isRuneword,
    personalized: isPersonalized,
    isEar,
    newItem: baseRaw?.newItem ?? false,
    starterItem: baseRaw?.starterItem ?? false,
    broken: baseRaw?.broken ?? false,
    inSocket: entry.location === 'socket',
    equipped: entry.location === 'equipped',
    socketedChildCount: socketedItems.length,
    usedSockets: socketedItems.length,
    totalSockets,
    ilvl: entry.level ?? 1,
    quality: normalizedQuality,
    graphicIndex: baseRaw?.graphicIndex ?? 0,
    durability: entry.durability ?? 0,
    curDurability: entry.durability ?? 0,
    maxDurability: entry.maxDurability ?? 0,
    quantity: entry.quantity ?? 1,
    ...(entry.code.trim() === 'gld' ? { goldAmount: entry.quantity } : {}),
    invWidth: entry.width ?? baseSize.width,
    invHeight: entry.height ?? baseSize.height,
    stats: statsList,
    setBonusStats: baseRaw?.setBonusStats ?? [],
    runewordStats: baseRaw?.runewordStats ?? [],
    ...(socketedItems.length > 0
      ? {
          socketedItems: socketedItems.map((c) =>
            this.serverEntryToItemData(c),
          ),
        }
      : {}),
  }
}



function emitInitialPlayerStats(this: GameInstanceHost, player: InternalPlayerRecord): void {
  const statPairs: ReadonlyArray<readonly [number, number]> = [
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
    [12, player.level],
    [13, player.experience],
    [14, player.gold],
    [15, player.goldBank],
  ]
  for (const [statId, value] of statPairs) {
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
  this.emitToPlayer(player.unitId, {
    type: 'LifeMana',
    life: player.hp,
    mana: player.mana,
    stamina: player.stamina,
    at: playerWirePosition(player),
    vx: 0,
    vy: 0,
  })

  for (const [skillId, slvl] of player.skills.entries()) {
    this.emitToPlayer(player.unitId, {
      type: 'SkillUpdate',
      unitId: player.unitId,
      skillId,
      level: slvl,
    })
  }

  for (const item of player.items) {
    this.emitToPlayer(player.unitId, {
      type: 'ItemEvent',
      action: 'add',
      itemId: item.unitId,
      code: item.code,
      x: item.x,
      y: item.y,
      container: toItemContainer(item.location),
      item: this.serverEntryToItemData(item),
    })
    this.emitSocketChildrenToPlayer(player.unitId, item, 0x13)
  }
}



function emitSavedPlayerHotkeys(this: GameInstanceHost, player: InternalPlayerRecord): void {
  if (player.weaponSet === 1) {
    this.emitToPlayer(player.unitId, {
      type: 'WeaponSwitch',
    })
  }
  this.validatePlayerActiveSkills(player)
  if (
    player.leftSkill !== 0 &&
    (player.leftSkillItemId === undefined || player.leftSkillItemId === 0xffffffff)
  ) {
    const leftDef = this.registry.getSkillById(player.leftSkill)
    if (leftDef && this.resolvePlayerSkillLevel(player, leftDef) <= 0) {
      const charged = findChargedSkill(player.items, player.leftSkill)
      if (charged) player.leftSkillItemId = charged.item.unitId
    }
  }
  if (
    player.rightSkill !== 0 &&
    (player.rightSkillItemId === undefined || player.rightSkillItemId === 0xffffffff)
  ) {
    const rightDef = this.registry.getSkillById(player.rightSkill)
    if (rightDef && this.resolvePlayerSkillLevel(player, rightDef) <= 0) {
      const charged = findChargedSkill(player.items, player.rightSkill)
      if (charged) player.rightSkillItemId = charged.item.unitId
    }
  }
  if (player.leftSkill !== 0) {
    this.emitToPlayer(player.unitId, {
      type: 'ActiveSkill',
      unitId: player.unitId,
      hand: 'left',
      skill: player.leftSkill,
      itemId: player.leftSkillItemId ?? 0xffffffff,
    })
  }
  if (player.rightSkill !== 0) {
    this.emitToPlayer(player.unitId, {
      type: 'ActiveSkill',
      unitId: player.unitId,
      hand: 'right',
      skill: player.rightSkill,
      itemId: player.rightSkillItemId ?? 0xffffffff,
    })
  }
  for (let slot = 0; slot < 16; slot++) {
    const raw = (player.hotkeys[slot] ?? 0xffff) & 0xffff
    if (raw === 0xffff) continue
    const skillId = raw & 0x7fff
    if (skillId === 0x7fff || skillId > 357) continue
    const hand: 'left' | 'right' = (raw & 0x8000) !== 0 ? 'left' : 'right'
    this.emitToPlayer(player.unitId, {
      type: 'ActiveSkill',
      isHotkey: true,
      unitId: slot,
      slot,
      hand,
      skill: skillId,
      itemId: player.hotkeyItemIds[slot] ?? 0xffffffff,
    })
  }
}



function buildMonsterUnitAssignEvent(this: GameInstanceHost, m: InternalMonsterRecord): ServerEvent {
  const superUniqueIndex =
    typeof m.superUniqueId === 'number'
      ? m.superUniqueId
      : m.superUniqueId !== undefined
        ? getSuperUniqueIndexById(m.superUniqueId)
        : undefined
  const isSuperUnique = superUniqueIndex !== undefined
  const isChampion = m.rank === 'champion'
  const isUnique = !isSuperUnique && m.rank === 'unique'
  const isMinion = m.rank === 'minion'
  const flags =
    (isChampion ? 0x04 | 0x08 : 0) |
    (isUnique || isSuperUnique ? 0x08 : 0) |
    (isSuperUnique ? 0x02 : 0) |
    (isMinion ? 0x10 : 0)
  const visibleMods = m.umodIds.filter(
    (id) => id > 0 && id <= 255,
  )
  const hasMonsterFlags = flags !== 0 || visibleMods.length > 0
  // 1.13c `D2Game.dll` `0x6FC97060` (`S2C 0xAC` `lifePct`): dead -> 0; `maxHp <= 0 || hp >= maxHp` -> 128 (`0x80`).
  const lifePct = m.dead
    ? 0
    : m.maxHp <= 0 || m.hp >= m.maxHp
      ? 128
      : m.hp <= 0
        ? 0
        : Math.max(1, Math.min(128, Math.round((m.hp / m.maxHp) * 128)))
  const mode = m.dead ? 12 : m.mode
  return {
    type: 'UnitAssign',
    unitType: 'monster',
    unitId: m.unitId,
    classId: m.classId,
    name: m.name,
    x: m.x,
    y: m.y,
    areaId: m.areaId,
    unit: {
      unitType: 1,
      id: m.unitId,
      classId: m.classId,
      name: m.name,
      ...(m.level > 0 ? { level: m.level } : {}),
      x: m.x,
      y: m.y,
      mode,
      lifePct,
      flags,
      ...(isChampion ? { isChampion: true } : {}),
      ...(isUnique ? { isUnique: true } : {}),
      ...(isSuperUnique ? { isSuperUnique: true, superUniqueId: superUniqueIndex } : {}),
      ...(isMinion ? { isMinion: true } : {}),
      ...(visibleMods.length > 0 ? { bossMods: [...visibleMods] } : {}),
      ...(hasMonsterFlags ? { nameSeed: m.nameSeed } : {}),
      ...(m.compVariants !== undefined ? { compVariants: m.compVariants } : {}),
    },
  }
}



/**
 * Build an authoritative `UnitAssign` snapshot for a live world monster (including summoned pets)
 * or object when a viewer's AOI reveals a previously culled unit (`RoomHost.deliverEventWithAoi`).
 */
function buildUnitAssignEvent(this: GameInstanceHost, unitType: 'monster' | 'object', unitId: number): ServerEvent | undefined {
  if (unitType === 'monster') {
    const m = this.monsters.get(unitId)
    if (m) return this.buildMonsterUnitAssignEvent(m)
    for (const [ownerId, mgr] of this.summonManagers.entries()) {
      for (const pet of mgr.getActivePets()) {
        if (this.petUnitIds.get(pet.uid) === unitId && pet.alive !== false && pet.hp > 0) {
          const petMeta = pet as unknown as { areaId?: number }
          const owner = this.players.get(ownerId)
          const areaId = petMeta.areaId ?? owner?.areaId ?? this.defaultAreaId ?? 1
          const classId = pet.classId ?? 363
          const petCompWidths = MONSTATS2_COMP_BIT_WIDTHS_BY_HCIDX[classId]
          const petCompVariants = petCompWidths?.map((w, idx) =>
            w > 1 ? ((Math.imul(unitId ^ (idx * 37), 0x9e3779b1) >>> 16) & ((1 << w) - 1)) : 0,
          )
          const lifePct =
            pet.maxHp > 0
              ? Math.max(1, Math.min(128, Math.round((pet.hp / pet.maxHp) * 128)))
              : 128
          return {
            type: 'UnitAssign',
            unitType: 'monster',
            unitId,
            classId,
            name: pet.name,
            x: pet.x,
            y: pet.y,
            areaId,
            unit: {
              unitType: 1,
              id: unitId,
              classId,
              name: pet.name,
              x: pet.x,
              y: pet.y,
              mode: 1,
              lifePct,
              ownerType: 0,
              ownerId,
              ...(petCompVariants !== undefined ? { compVariants: petCompVariants } : {}),
            },
          }
        }
      }
    }
    return undefined
  }
  const obj = this.objects.get(unitId)
  if (!obj) return undefined
  return {
    type: 'UnitAssign',
    unitType: 'object',
    unitId: obj.unitId,
    classId: obj.classId,
    x: obj.x,
    y: obj.y,
    areaId: obj.areaId,
    unit: {
      unitType: 2,
      id: obj.unitId,
      classId: obj.classId,
      x: obj.x,
      y: obj.y,
      mode: obj.mode,
    },
  }
}



function emitAreaSnapshotToPlayer(this: GameInstanceHost, player: InternalPlayerRecord): void {
  for (const ent of this.getAoiWorldEntities()) {
    if (ent.unitType === 'missile') continue
    if (ent.unitType === 'player' && ent.unitId === player.unitId) continue
    if (!this.isPointInViewerAoi113c(player, ent.areaId, ent.x, ent.y)) continue
    for (const ev of this.buildEntityEnterAoiEvents(ent.unitType, ent.unitId)) {
      this.emitToPlayer(player.unitId, ev)
    }
  }
}



function buildPlayerCorpseEvents113c(this: GameInstanceHost, owner: InternalPlayerRecord): readonly ServerEvent[] {
  if (owner.corpseId === undefined || !this.hasLivePrimaryCorpse113c(owner)) return []
  return this.buildPlayerCorpseEventsForSet113c(
    owner,
    owner.corpseId,
    owner.corpseAreaId ?? owner.areaId,
    owner.corpseX,
    owner.corpseY,
    owner.corpseItems,
  )
}



function buildPlayerCorpseEventsForSet113c(this: GameInstanceHost, 
  owner: InternalPlayerRecord,
  corpseId: number,
  areaId: number,
  corpseX: number,
  corpseY: number,
  items: readonly ServerItemEntry[],
): readonly ServerEvent[] {
  const cx = Math.round(corpseX)
  const cy = Math.round(corpseY)
  const events: ServerEvent[] = [
    {
      type: 'UnitAssign',
      unitType: 'player',
      unitId: corpseId,
      classId: owner.classId,
      name: owner.name,
      x: cx,
      y: cy,
      areaId,
      unit: {
        unitType: 0,
        id: corpseId,
        classId: owner.classId,
        name: owner.name,
        x: cx,
        y: cy,
        mode: 17,
      },
    },
    {
      type: 'UnitMode',
      unitType: 0,
      id: corpseId,
      mode: 17,
      at: { x: cx, y: cy },
      lifePct: 0,
    },
    {
      type: 'CorpseAssign',
      assign: 1,
      ownerId: owner.unitId,
      corpseId,
    },
  ]
  for (const ci of items) {
    events.push({
      type: 'ItemEvent',
      action: 0x06,
      itemId: ci.unitId,
      code: ci.code,
      x: ci.x,
      y: ci.y,
      container: 'equipment',
      item: {
        ...this.serverEntryToItemData(ci),
        opcode: 0x9d,
        action: 0x06,
        ownerType: 0,
        ownerId: corpseId as UnitId,
        location: 1,
        bodyLoc: ci.bodyLoc,
        equippedSlot: ci.bodyLoc,
        container: 'equipment',
      },
    })
  }
  return events
}



/**
 * Server entry for an item made by a canonical 1.13c generator (TreasureClassEx drop pipeline, store or
 * gamble generator). The full `ItemData` (affix / unique / set / rare ids, stat list with params, rolled
 * defense, durability, quantity) is kept as `rawItemData`; `stats` is its statId -> value fold for gameplay.
 */
function createServerEntryFromItem(this: GameInstanceHost, 
  item: Item,
  placement: {
    readonly location: ServerItemEntry['location']
    readonly x: number
    readonly y: number
    readonly areaId: number
    readonly ownerId: number
    readonly storePage: number
    readonly gamble: boolean
  },
): ServerItemEntry {
  const preAllocId = (item as { preAllocatedUnitId113c?: number }).preAllocatedUnitId113c
  const unitId = preAllocId ?? this.allocateUnitId(UNIT_TYPE_113C.item)
  const code = (item.code ?? item.base.id).trim()
  const info = requireBaseInfo(code)
  const data = domainItemToItemData113c(item, getEmbeddedDropTables(), {
    unitId,
    compactSave: info.compactSave,
  })
  const stats = new Map<number, number>()
  for (const st of data.stats) stats.set(st.statId, st.value)
  if (code === 'gld' && (data.quantity ?? 1) > 0) {
    stats.set(14, data.quantity ?? 1)
  }
  return {
    unitId,
    code,
    name: item.name,
    quality: data.quality ?? 2,
    level: data.ilvl ?? item.level,
    location: placement.location,
    x: placement.x,
    y: placement.y,
    width: info.width,
    height: info.height,
    areaId: placement.areaId,
    ownerId: placement.ownerId,
    bodyLoc: 0,
    storePage: placement.storePage,
    cost: info.cost,
    gamble: placement.gamble,
    identified: data.identified,
    ethereal: data.ethereal,
    socketed: data.socketed,
    totalSockets: data.totalSockets,
    durability: data.durability ?? 0,
    maxDurability: data.maxDurability ?? 0,
    quantity: data.quantity ?? 1,
    stats,
    socketedItems: [],
    permStore: Boolean(
      (item as { permStore?: boolean }).permStore ??
        (item.base as { permStoreItem?: boolean }).permStoreItem,
    ),
    rawItemData: data,
  }
}



/** 1.13c #10107 pricing input from a server item entry (raw packet data when present). */
function transactionInputFromEntry(this: GameInstanceHost, entry: ServerItemEntry): TransactionCostInput {
  const item = entry.rawItemData
  if (!item) {
    const stats: TransactionCostStat[] = [
      { statId: 70, param: 0, value: Math.max(1, entry.quantity), base: Math.max(1, entry.quantity) },
      { statId: 72, param: 0, value: entry.durability, base: entry.durability },
      { statId: 73, param: 0, value: entry.maxDurability, base: entry.maxDurability },
    ]
    for (const [statId, value] of entry.stats) {
      if (statId === 70 || statId === 72 || statId === 73) continue
      stats.push({ statId, param: 0, value, base: 0 })
    }
    const lowerCode = entry.code.trim().toLowerCase()
    const bookId = lowerCode === 'tbk' ? 0 : lowerCode === 'ibk' ? 1 : undefined
    const quality = Math.min(
      9,
      Math.max(1, this.normalizeItemQualityCode113c(entry.quality)),
    ) as TransactionCostInput['quality']
    return {
      code: entry.code.trim(),
      itemFormat: 1,
      quality,
      identified: entry.identified || quality < 4,
      ethereal: entry.ethereal,
      starterItem: false,
      isEar: false,
      ...(bookId !== undefined ? { bookId } : {}),
      magicPrefixId: 0,
      magicSuffixId: 0,
      uniqueItemId: -1,
      setItemId: -1,
      rarePrefixIds: [0, 0, 0],
      rareSuffixIds: [0, 0, 0],
      stats,
      socketedChildCodes: entry.socketedItems
        .map((socketed) => (socketed.rawItemData?.code ?? socketed.code).trim())
        .filter((c) => c.length > 0),
    }
  }
  const acc = new Map<string, { statId: number; param: number; value: number; base: number }>()
  const add = (statId: number, param: number, value: number, isBase: boolean): void => {
    const k = `${statId}:${param}`
    const cur = acc.get(k) ?? { statId, param, value: 0, base: 0 }
    cur.value += value
    if (isBase) cur.base += value
    acc.set(k, cur)
  }
  const maxDur = entry.maxDurability > 0 ? entry.maxDurability : item.maxDurability
  const curDur =
    entry.maxDurability > 0 || item.curDurability !== undefined || item.durability !== undefined
      ? entry.durability
      : undefined
  const qty = entry.quantity > 1 || item.quantity !== undefined ? entry.quantity : undefined
  if (item.defense !== undefined) add(31, 0, item.defense, true)
  if (maxDur !== undefined) add(73, 0, maxDur, true)
  if (curDur !== undefined) add(72, 0, curDur, true)
  if (qty !== undefined) add(70, 0, qty, true)
  for (const s of item.stats) {
    if (s.statId === 72 && curDur !== undefined) continue
    if (s.statId === 73 && maxDur !== undefined) continue
    if (s.statId === 70 && qty !== undefined) continue
    add(s.statId, s.param, s.value, false)
  }
  for (const s of item.runewordStats ?? []) add(s.statId, s.param, s.value, false)
  const chargedSkills = (item as {
    readonly chargedSkills?: readonly {
      readonly skillId?: number
      readonly level?: number
      readonly charges?: number
      readonly maxCharges?: number
    }[]
  }).chargedSkills
  if (Array.isArray(chargedSkills)) {
    for (const cs of chargedSkills) {
      const maxCharges = (cs.maxCharges ?? 0) & 0xff
      const charges = Math.min(maxCharges, Math.max(0, cs.charges ?? 0)) & 0xff
      const skillId = cs.skillId ?? 54
      const level = Math.max(1, cs.level ?? 1) & 0x3f
      const param = (skillId << 6) | level
      if (maxCharges > 0 && !acc.has(`204:${param}`)) {
        add(204, param, (maxCharges << 8) | charges, false)
      }
    }
  }
  const ra = item.rareAffixes
  const rarePrefixIds: readonly [number, number, number] =
    ra !== undefined && ra.length >= 6 ? [ra[0] ?? 0, ra[2] ?? 0, ra[4] ?? 0] : [0, 0, 0]
  const rareSuffixIds: readonly [number, number, number] =
    ra !== undefined && ra.length >= 6 ? [ra[1] ?? 0, ra[3] ?? 0, ra[5] ?? 0] : [0, 0, 0]
  let bookId = item.tomeData
  const code = (item.code ?? entry.code ?? '').trim().toLowerCase()
  if (bookId === undefined && code === 'tbk') bookId = 0
  if (bookId === undefined && code === 'ibk') bookId = 1
  const quality = this.normalizeItemQualityCode113c(
    item.quality ?? entry.quality,
  ) as TransactionCostInput['quality']
  return {
    code: (item.code ?? entry.code).trim(),
    itemFormat: item.version,
    quality,
    identified: entry.identified || (quality < 4 && item.identified !== false),
    ethereal: entry.ethereal || item.ethereal,
    starterItem: item.starterItem,
    isEar: item.isEar,
    earLevel: item.earLevel ?? 0,
    bodyPartMonsterClass: item.bodyPartMonsterClass ?? 0,
    ...(bookId !== undefined ? { bookId } : {}),
    magicPrefixId: item.magicPrefixId ?? 0,
    magicSuffixId: item.magicSuffixId ?? 0,
    ...(item.autoAffixId !== undefined ? { autoAffixId: item.autoAffixId } : {}),
    uniqueItemId:
      item.uniqueItemId !== undefined && item.uniqueItemId !== 0xfff ? item.uniqueItemId : -1,
    setItemId: item.setItemId !== undefined && item.setItemId !== 0xfff ? item.setItemId : -1,
    rarePrefixIds,
    rareSuffixIds,
    stats: [...acc.values()],
    socketedChildCodes: entry.socketedItems
      .map((socketed) => (socketed.rawItemData?.code ?? socketed.code).trim())
      .filter((c) => c.length > 0),
  }
}



function transactionCostContext(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npcClass: number,
): TransactionCostContext {
  const itemReduced = (entry: ServerItemEntry): number => {
    let sum = entry.stats.get(87) ?? 0
    if (sum === 0 && entry.rawItemData?.stats) {
      for (const s of entry.rawItemData.stats) {
        if (s.statId === 87) sum += s.value
      }
    }
    if (entry.rawItemData?.runewordStats) {
      for (const s of entry.rawItemData.runewordStats) {
        if (s.statId === 87) sum += s.value
      }
    }
    return sum
  }
  let reduced = 0
  const equipped = player.items.filter((item) => item.location === 'equipped')
  // Client parity: price reductions come from the active weapon set only.
  // BodyLoc 4/5 is the primary set, 11/12 the swap set; if both exist the
  // primary set is active (the runtime has no explicit swap state yet).
  const hasPrimary = equipped.some((item) => item.bodyLoc === 4 || item.bodyLoc === 5)
  for (const item of equipped) {
    if (hasPrimary && (item.bodyLoc === 11 || item.bodyLoc === 12)) continue
    if (!hasPrimary && (item.bodyLoc === 4 || item.bodyLoc === 5)) continue
    reduced += itemReduced(item)
    for (const socketed of item.socketedItems) reduced += itemReduced(socketed)
  }
  // D2Common.dll 0x6FD9B940 & client `transactionCostContextFromWorld`:
  // carried identified charms (cm1/cm2/cm3) within reqLvl, with unique charms
  // (quality === 7, uniqueId !== 0xfff) deduplicated by UniqueItems.txt id.
  const seenCharmIds = new Set<number>()
  for (const item of player.items) {
    if (item.location !== 'inventory') continue
    if (!item.identified || item.rawItemData?.identified === false) continue
    const code = item.code.trim().toLowerCase()
    if (code !== 'cm1' && code !== 'cm2' && code !== 'cm3') continue
    if (item.rawItemData && player.level > 0) {
      const reqLvl = resolveOnlineItemReqLevel(item.rawItemData)
      if (reqLvl > 0 && player.level < reqLvl) continue
    }
    const quality = item.rawItemData?.quality ?? item.quality
    const uniqueId = item.rawItemData?.uniqueItemId
    if (quality === 7 && uniqueId !== undefined && uniqueId >= 0 && uniqueId !== 0xfff) {
      if (seenCharmIds.has(uniqueId)) continue
      seenCharmIds.add(uniqueId)
    }
    reduced += itemReduced(item)
    for (const socketed of item.socketedItems) reduced += itemReduced(socketed)
  }
  return {
    playerLevel: player.level,
    playerReducedPricesPct: reduced,
    difficulty: this.difficulty as 0 | 1 | 2,
    npcClass,
    isQuestFlagSet: (questId, state) =>
      questId === 41 ? false : (((player.questFlags[questId] ?? 0) >> state) & 1) !== 0,
    questDiscountPct: getVendorQuestDiscountPct113c(player.questFlags, npcClass),
    tables: getCanonicalTransactionCostTables(),
  }
}



/** D2Common #10107 server-side price: 0 buy, 1 sell, 2 gamble, 3 repair. */
function serverItemPrice113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  npcClass: number,
  entry: ServerItemEntry,
  type: 0 | 1 | 2 | 3,
): number {
  const cost = computeTransactionCost113c(
    this.transactionInputFromEntry(entry),
    this.transactionCostContext(player, npcClass),
    type,
  )
  return type === 3 ? Math.max(0, cost) : Math.max(1, cost)
}



/** The player's copy of a bought store item: same rolled `ItemData`, new unit id, placed in the inventory. */
function cloneVendorEntryForPlayer(this: GameInstanceHost, 
  vItem: ServerItemEntry,
  player: InternalPlayerRecord,
  cell: { readonly x: number; readonly y: number },
  location: 'inventory' | 'belt' = 'inventory',
): ServerItemEntry {
  const unitId = this.allocateUnitId(UNIT_TYPE_113C.item)
  const raw = vItem.rawItemData
  return {
    ...vItem,
    unitId,
    location,
    x: cell.x,
    y: cell.y,
    areaId: player.areaId,
    ownerId: player.unitId,
    storePage: 1,
    stats: new Map(vItem.stats),
    socketedItems: [],
    rawItemData: raw ? { ...raw, id: unitId, itemId: unitId } : undefined,
  }
}



/**
 * 1.13c store (`D2GAME_NPC_FillStoreInventory_6FCC7100`) or gamble (`D2GAME_NPC_FillGamble_6FCC73E0`)
 * inventory of a town vendor for `player`, from the Armor/Weapons/Misc.txt `<Npc>Min/Max/MagicMin/
 * MagicMax/MagicLvl` columns of the NPC's vendor (`src/common/items/vendor-generator.ts`). Store items
 * keep their tab (1..4) and grid cell; NPCs without that Npc service sell nothing.
 */
function createVendorStorePool(this: GameInstanceHost, 
  npc: InternalMonsterRecord,
  player: InternalPlayerRecord,
  gamble: boolean,
): ServerItemEntry[] {
  const descriptor = getTownNpcDescriptorByHcIdx(npc.hcIdx)
  if (!descriptor || descriptor.vendorId === null) return []
  if (gamble ? !descriptor.canGamble : !descriptor.canTrade) return []
  const tables = getEmbeddedDropTables()
  const rng = new D2Rng(this.rng.rand(0x7fffffff) || 1)
  const pool: ServerItemEntry[] = []
  if (gamble) {
    const grid = generateGambleInventory({ vendorId: descriptor.vendorId, cLvl: player.level, tables, rng })
    for (const placed of grid.items) {
      const entry = this.createServerEntryFromItem(placed.item, {
        location: 'vendor',
        x: placed.x,
        y: placed.y,
        areaId: npc.areaId,
        ownerId: npc.unitId,
        storePage: 1,
        gamble: true,
      })
      this.gambleSourceItems.set(entry.unitId, placed.item)
      entry.cost = this.serverItemPrice113c(player, npc.hcIdx, entry, 2)
      pool.push(entry)
    }
    return pool
  }
  const store = generateVendorStoreInventory({
    vendorId: descriptor.vendorId,
    difficulty: this.difficulty,
    cLvl: player.level,
    actIndex: descriptor.actIndex,
    tables,
    rng,
  })
  VENDOR_TAB_KEYS.forEach((tab, tabIndex) => {
    for (const placed of store.tabs[tab].items) {
      const entry = this.createServerEntryFromItem(placed.item, {
        location: 'vendor',
        x: placed.x,
        y: placed.y,
        areaId: npc.areaId,
        ownerId: npc.unitId,
        storePage: tabIndex + 1,
        gamble: false,
      })
      entry.cost = this.serverItemPrice113c(player, npc.hcIdx, entry, 0)
      pool.push(entry)
    }
  })
  return pool
}



/**
 * Spawns the items of one 1.13c TreasureClassEx drop at `(x, y)`, spiraling outward across
 * walkable, unoccupied sub-tiles (`findDropPosition`) and flagging each newly spawned item
 * with `IFLAG_NEWITEM (0x2000)` so the client plays the mode-5 flippy animation and drop SFX.
 */
function spawnDroppedItems(this: GameInstanceHost, items: readonly Item[], areaId: number, x: number, y: number): number[] {
  const ids: number[] = []
  const used = new Set<string>()
  items.forEach((dropped) => {
    const position = this.findDropPosition(areaId, x, y, used)
    const item = finalizeDroppedItem113c(dropped)
    const entry = this.createServerEntryFromItem(item, {
      location: 'ground',
      x: position.x,
      y: position.y,
      areaId,
      ownerId: 0,
      storePage: 0,
      gamble: false,
    })
    this.registerGroundItem113c(entry)
    used.add(`${entry.x}:${entry.y}`)
    const itemData = this.serverEntryToItemData(entry)
    const dropFlags = ((itemData.rawFlags ?? itemData.flags ?? 0x00000010) | 0x00002000) >>> 0
    this.broadcastToArea(areaId, {
      type: 'ItemEvent',
      action: 'groundSpawn',
      itemId: entry.unitId,
      code: entry.code,
      x: entry.x,
      y: entry.y,
      container: 'ground',
      item: {
        ...itemData,
        action: 0x00,
        flags: dropFlags,
        rawFlags: dropFlags,
        newItem: true,
      },
    })
    this.emitSocketChildrenToArea(areaId, entry, 0x13)
    ids.push(entry.unitId)
  })
  return ids
}



/**
 * 1.13c item drop placement: spiral outward from the kill/container cell and take the
 * first walkable, unoccupied sub-tile. Never places items inside walls/void; if all
 * walkable cells within the spiral are already occupied, falls back to the nearest
 * walkable cell rather than an unwalkable origin.
 */
function findDropPosition(this: GameInstanceHost, 
  areaId: number,
  originX: number,
  originY: number,
  used: ReadonlySet<string>,
): { readonly x: number; readonly y: number } {
  const ox = Math.round(originX)
  const oy = Math.round(originY)
  let firstWalkable: { readonly x: number; readonly y: number } | undefined
  for (let radius = 0; radius <= 16; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
        const x = ox + dx
        const y = oy + dy
        if (!this.isWorldWalkableForPlayer(areaId, x, y)) continue
        firstWalkable ??= { x, y }
        const key = `${x}:${y}`
        if (used.has(key)) continue
        let occupied = false
        for (const existing of this.groundItems.values()) {
          if (existing.areaId === areaId && existing.x === x && existing.y === y) {
            occupied = true
            break
          }
        }
        if (!occupied) return { x, y }
      }
    }
  }
  return firstWalkable ?? { x: ox, y: oy }
}



/** Full item stat (statId) a player carries on active equipped items, sockets, charms, set bonuses, and per-level stats (#1629). */
function sumEquippedItemStat(this: GameInstanceHost, player: InternalPlayerRecord, statId: number): number {
  return this.sumPlayerItemStat(player, statId)
}



/**
 * ItemStatCost `lifedrainmindam` (60) / `manadrainmindam` (62) of a player: worn items, sockets
 * and set bonuses (`sumPlayerItemStat`) plus skill / state modifiers on the persistent combat
 * stat list. These are the stats the 1.13c damage filler (D2Game 0x6FCFD6FB) copies into the
 * steal fields read at 0x6FCFBA40.
 */
function playerStealPct(this: GameInstanceHost, player: InternalPlayerRecord, statId: 60 | 62): number {
  const statName = statId === 60 ? 'lifedrainmindam' : 'manadrainmindam'
  const modifiers = this.playerCombat.get(player.unitId)?.statList.getModifierBonus(statName) ?? 0
  return this.sumPlayerItemStat(player, statId) + Math.trunc(modifiers)
}



/**
 * Write the life / mana an `executeSUnitDmg` hit gave its player attacker (life / mana steal,
 * Life Tap) back to the authoritative record, clamped to max life / max mana as 0x6FCFB570 /
 * 0x6FCFAE70 do, and notify the client (stats 6 / 8).
 */
function applyPlayerStealOutcome(this: GameInstanceHost, player: InternalPlayerRecord, out: SUnitDmgOutcome): void {
  const life256 = out.attackerHealed256 ?? 0
  const mana256 = out.attackerManaLeeched256 ?? 0
  if (life256 > 0 && player.hpFixed > 0) {
    const maxHp256 = this.getPlayerAccruedMaxHpFixed(player)
    const hp256 = Math.min(maxHp256, player.hpFixed + life256)
    if (hp256 !== player.hpFixed) {
      player.hpFixed = hp256
      player.hp = Math.max(0, Math.ceil(hp256 / FIXED_ONE))
      this.emitToPlayer(player.unitId, { type: 'UnitStatUpdate', unitType: 'player', unitId: player.unitId, statId: 6, value: player.hpFixed })
    }
  }
  if (mana256 > 0) {
    const maxMana256 = this.getPlayerAccruedMaxManaFixed(player)
    const next256 = Math.min(maxMana256, player.manaFixed + mana256)
    if (next256 !== player.manaFixed) {
      player.manaFixed = next256
      player.mana = Math.floor(next256 / FIXED_ONE)
      this.emitToPlayer(player.unitId, { type: 'UnitStatUpdate', unitType: 'player', unitId: player.unitId, statId: 8, value: player.manaFixed })
    }
  }
}



/** Living party members of `player` (itself included) in `areaId`: the drop pipeline's `partyPlayers`. */
function countPartyPlayersInArea(this: GameInstanceHost, player: InternalPlayerRecord, areaId: number): number {
  let count = 0
  for (const p of this.players.values()) {
    if (p.dead || p.areaId !== areaId) continue
    if (p.unitId === player.unitId || (player.partyId !== 0xffff && p.partyId === player.partyId)) count++
  }
  return Math.max(1, count)
}



/** Distinct worn SetItems per set (duplicate rings count once). */
function wornSetPieceCounts(this: GameInstanceHost, worn: readonly ServerItemEntry[]): Map<string, number> {
  const tables = getEmbeddedDropTables()
  const counts = new Map<string, number>()
  const seen = new Set<number>()
  for (const item of worn) {
    const setId = item.rawItemData?.setItemId
    if (setId === undefined || setId < 0 || setId === 0xfff || seen.has(setId)) continue
    const setItem = tables.sets.items.getById(setId)
    if (setItem === undefined) continue
    seen.add(setId)
    counts.set(setItem.set, (counts.get(setItem.set) ?? 0) + 1)
  }
  return counts
}

/**
 * 1.13c `ITEMS_UpdateSets` (`D2Game.dll` `0x6FCF51A0..0x6FCF555C` -> `D2Common.#10600` `0x6FD7C630`):
 * `0x6FDDCA08` maps up to 6 distinct equipped sets (`Sets.txt` `wSetId`, scanned across unbroken
 * active body locations `1..10`) onto unit states `165..170` (`itemset1..itemset6`), toggling
 * `165 .. 165 + min(K, 6) - 1` on and clearing `165 + min(K, 6) .. 170`.
 */
function syncPlayerEquippedSetStates113c(this: GameInstanceHost, player: InternalPlayerRecord): void {
  const tables = getEmbeddedDropTables()
  const activeWorn = player.items
    .filter(
      (it) =>
        it.location === 'equipped' &&
        it.bodyLoc !== undefined &&
        it.bodyLoc >= 1 &&
        it.bodyLoc <= 10 &&
        it.identified !== false &&
        it.rawItemData?.identified !== false &&
        it.rawItemData?.broken !== true &&
        (it.maxDurability <= 0 || it.durability > 0),
    )
    .sort((a, b) => (a.bodyLoc ?? 0) - (b.bodyLoc ?? 0))
  const distinctSets = new Set<string>()
  for (const item of activeWorn) {
    const setId = item.rawItemData?.setItemId
    if (setId === undefined || setId < 0 || setId === 0xfff) continue
    const setItem = tables.sets.items.getById(setId)
    if (setItem === undefined) continue
    distinctSets.add(setItem.set)
    if (distinctSets.size >= 6) break
  }
  const slotCount = Math.min(6, distinctSets.size)
  for (let i = 0; i < 6; i++) {
    const stateId = 165 + i
    if (i < slotCount) {
      player.states.add(stateId)
    } else {
      player.states.delete(stateId)
      player.stateTimers.delete(stateId)
    }
  }
}



/** Resolve set-bonus stats across active worn equipment (`ITEMS_UpdateSetBonuses` 0x6FD96A40, #1629, #1630). */
function sumEquippedSetBonusStat(this: GameInstanceHost, 
  worn: readonly ServerItemEntry[],
  statId: number,
  level: number,
): number {
  if (
    worn.length === 0 ||
    !worn.some(
      (it) =>
        it.quality === 5 ||
        (it.rawItemData?.setItemId !== undefined &&
          it.rawItemData.setItemId >= 0 &&
          it.rawItemData.setItemId !== 0xfff),
    )
  ) {
    return 0
  }
  const perLvlRule = PER_LEVEL_STAT_MAP_113C[statId]
  const perLevelStatId = perLvlRule?.perLevelStatId
  const perLevelShift = perLvlRule?.shift ?? 3
  const tables = getEmbeddedDropTables()
  if (!tables.properties || !tables.itemStatCost) return 0
  // Worn piece count uses distinct SetItems.txt ids; duplicate set rings count once toward set count.
  const counts = this.wornSetPieceCounts(worn)
  const siblingMasks = computeWornSetSiblingMasks113c(worn, tables.sets.items)
  let total = 0
  const addProps = (
    props: readonly SetBonusProp[],
    rngKey: string,
  ): void => {
    const propRng = makeDeterministicSetBonusRng113c(this.mapSeed, rngKey)
    for (const rawProp of props) {
      const prop = rollSetBonusPropIfNeeded(rawProp, propRng)
      const param = typeof prop.par === 'number' ? prop.par : Number(prop.par ?? 0) || 0
      for (const resolved of tables.properties!.resolveProperty(
        prop.code,
        param,
        prop.min,
        prop.max,
        tables.itemStatCost!,
      )) {
        if (resolved.statId === statId) {
          total += resolved.value
        } else if (perLevelStatId !== undefined && resolved.statId === perLevelStatId) {
          total += (resolved.value * level) >> perLevelShift
        }
      }
    }
  }
  const hasItemOwnPrimaryStat = (entry: ServerItemEntry, targetStatId: number): boolean =>
    entry.stats?.has(targetStatId) === true ||
    entry.rawItemData?.stats?.some((s) => s.statId === targetStatId) === true
  const seenSets = new Set<string>()
  for (const item of worn) {
    const setId = item.rawItemData?.setItemId
    if (setId === undefined || setId < 0 || setId === 0xfff) continue
    const setItem = tables.sets.items.getById(setId)
    if (setItem === undefined) continue
    const setDef = tables.sets.sets.get(setItem.set)
    if (setDef === undefined) continue
    const wornCount = counts.get(setItem.set) ?? 1
    const siblingMask = siblingMasks.get(setItem.set) ?? 0
    const bonuses = resolveActiveSetBonuses(setItem, setDef, wornCount, {
      siblingMask,
      setItemsTable: tables.sets.items,
      rng: makeDeterministicSetBonusRng113c(this.mapSeed, `set:${setItem.set}`),
    })
    // Real generated items already folded `props` into item.stats / rawItemData.stats;
    // synthetic set items without that stat still receive the single-piece property.
    const hasOwnStat =
      hasItemOwnPrimaryStat(item, statId) ||
      (perLevelStatId !== undefined && hasItemOwnPrimaryStat(item, perLevelStatId))
    if (!hasOwnStat) addProps(bonuses.props, `item:${item.unitId}:props`)
    // Green item-specific set bonuses (`aprop1a..aprop5b`) apply on EACH worn set item
    // (so wearing 2x Angelic Halo rings with 3 Angelic pieces grants +50% MF from each ring).
    // Use the item's rolled `setBonusStats` lists when present (#1651 / #1652 / #1831 / #1910).
    const storedLists = item.rawItemData?.setBonusStats as
      | readonly ({ readonly index: number; readonly stats: readonly ItemStat[] } | ItemStat)[]
      | undefined
    if (Array.isArray(storedLists) && storedLists.length > 0) {
      for (const listOrStat of storedLists) {
        if ('stats' in listOrStat && Array.isArray(listOrStat.stats)) {
          if (
            !isSetBonusSlotActive113c(
              setItem,
              listOrStat.index,
              wornCount,
              siblingMask,
              tables.sets.items,
            )
          ) {
            continue
          }
          for (const st of listOrStat.stats) {
            if (setItem.addFunc === 0 && hasItemOwnPrimaryStat(item, st.statId)) continue
            if (st.statId === statId) {
              total += st.value
            } else if (perLevelStatId !== undefined && st.statId === perLevelStatId) {
              total += (st.value * level) >> perLevelShift
            }
          }
        } else if ('statId' in listOrStat && typeof listOrStat.statId === 'number') {
          if (setItem.addFunc === 0 && hasItemOwnPrimaryStat(item, listOrStat.statId)) continue
          if (listOrStat.statId === statId) {
            total += listOrStat.value
          } else if (perLevelStatId !== undefined && listOrStat.statId === perLevelStatId) {
            total += (listOrStat.value * level) >> perLevelShift
          }
        }
      }
    } else if (setItem.addFunc === 0) {
      // 1.13c SetItems.txt `add func == 0` (`Civerb's Cudgel` #2, `Trang-Oul's Claws` #88):
      // `aprop*` rolls unconditionally onto the item at 1+ worn pieces (#1831).
      const propRng = makeDeterministicSetBonusRng113c(this.mapSeed, `item:${item.unitId}:aprops0`)
      for (const rawProp of setItem.aprops) {
        const prop = rollSetBonusPropIfNeeded(rawProp, propRng)
        const param = typeof prop.par === 'number' ? prop.par : Number(prop.par ?? 0) || 0
        for (const resolved of tables.properties!.resolveProperty(
          prop.code,
          param,
          prop.min,
          prop.max,
          tables.itemStatCost!,
        )) {
          if (hasItemOwnPrimaryStat(item, resolved.statId)) continue
          if (resolved.statId === statId) {
            total += resolved.value
          } else if (perLevelStatId !== undefined && resolved.statId === perLevelStatId) {
            total += (resolved.value * level) >> perLevelShift
          }
        }
      }
    } else {
      addProps(bonuses.aprops, `item:${item.unitId}:aprops`)
    }
    if (!seenSets.has(setItem.set)) {
      seenSets.add(setItem.set)
      // Gold partial/full-set bonuses (`PCode2a..FCode8`) apply once per set, never per piece.
      addProps(bonuses.pCodes, `set:${setItem.set}:pcodes`)
      addProps(bonuses.fCodes, `set:${setItem.set}:fcodes`)
    }
  }
  return total
}



/** Full player item stat: active weapon set (excluding swap 11/12), inventory charms, sockets, set bonuses, and per-level stats (#1629, #1630). */
function sumPlayerItemStat(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  statId: number,
  options?: {
    readonly excludeWeaponHands?: boolean
    readonly weaponHand?: 'left' | 'right' | undefined
  },
): number {
  const perLvlRule = PER_LEVEL_STAT_MAP_113C[statId]
  const perLevelStatId = perLvlRule?.perLevelStatId
  const perLevelShift = perLvlRule?.shift ?? 3
  const addEntryStats = (entry: ServerItemEntry, level: number): number => {
    const stats = entry.stats
    if (stats && stats.size > 0) {
      let value = stats.get(statId) ?? 0
      if (perLevelStatId !== undefined) {
        value += ((stats.get(perLevelStatId) ?? 0) * level) >> perLevelShift
      }
      return value
    }
    if (entry.rawItemData) {
      let value = 0
      const lists = [entry.rawItemData.stats ?? [], entry.rawItemData.runewordStats ?? []]
      for (const list of lists) {
        for (const st of list) {
          if (st.statId === statId) value += st.value
          else if (perLevelStatId !== undefined && st.statId === perLevelStatId) {
            value += (st.value * level) >> perLevelShift
          }
        }
      }
      return value
    }
    return 0
  }
  let total = 0
  const seenUniqueCharms = new Set<number>()
  const worn: ServerItemEntry[] = []
  for (const item of player.items) {
    // Inactive weapon-swap slots (bodyLoc 11 = rarm2, 12 = larm2) never contribute stats or set bonuses.
    if (item.location === 'equipped') {
      if (item.bodyLoc === 11 || item.bodyLoc === 12) continue
      worn.push(item)
      if (
        options?.excludeWeaponHands &&
        (item.bodyLoc === BODYLOC_RIGHT_ARM || item.bodyLoc === BODYLOC_LEFT_ARM) &&
        resolveWeaponBase113c(item.code) !== undefined
      ) {
        continue
      }
      const skipWeaponSlot =
        options?.weaponHand === 'left'
          ? BODYLOC_RIGHT_ARM
          : options?.weaponHand === 'right'
            ? BODYLOC_LEFT_ARM
            : undefined
      if (
        skipWeaponSlot !== undefined &&
        item.bodyLoc === skipWeaponSlot &&
        resolveWeaponBase113c(item.code) !== undefined
      ) {
        continue
      }
    } else if (item.location === 'inventory') {
      if (!this.isActiveInventoryCharm113c(player, item, seenUniqueCharms)) continue
    } else {
      continue
    }
    total += addEntryStats(item, player.level)
    if (Array.isArray(item.socketedItems)) {
      for (const socketed of item.socketedItems) total += addEntryStats(socketed, player.level)
    }
  }
  total += this.sumEquippedSetBonusStat(worn, statId, player.level)
  return total
}



/**
 * 1.13c active charm check (`D2Common.dll` `0x6FD98340`, #1864):
 * Only identified `cm1`/`cm2`/`cm3` charms inside the main `10x4` inventory grid (never stash/cube/belt)
 * whose level requirement is met (`clvl >= reqLvl`) contribute passive stats, deduplicating unique charms.
 */
function isActiveInventoryCharm113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  item: ServerItemEntry,
  seenUniqueCharms: Set<number>,
): boolean {
  if (item.location !== 'inventory') return false
  if (item.storePage === 3 || item.storePage === 4) return false
  const code = (item.code ?? '').toLowerCase()
  if (code !== 'cm1' && code !== 'cm2' && code !== 'cm3') return false
  if (item.identified === false || item.rawItemData?.identified === false) return false
  const charmH = code === 'cm1' ? 1 : code === 'cm2' ? 2 : 3
  if (Number.isFinite(item.x) && Number.isFinite(item.y)) {
    if (item.x < 0 || item.x + 1 > 10 || item.y < 0 || item.y + charmH > 4) return false
  }
  const explicitReqLvl =
    (item as { readonly levelReq?: number }).levelReq ??
    (item.rawItemData as { readonly levelReq?: number } | undefined)?.levelReq
  if (explicitReqLvl !== undefined && explicitReqLvl > 0 && player.level < explicitReqLvl) {
    return false
  }
  const uniqueId =
    item.rawItemData?.uniqueItemId ??
    (item.rawItemData as { readonly uniqueId?: number } | undefined)?.uniqueId ??
    (item as { readonly uniqueItemId?: number }).uniqueItemId ??
    (item as { readonly uniqueId?: number }).uniqueId
  if (uniqueId !== undefined && uniqueId >= 0 && uniqueId !== 0xfff) {
    if (seenUniqueCharms.has(uniqueId)) return false
    seenUniqueCharms.add(uniqueId)
  }
  return true
}



function effectivePlayerCount113c(this: GameInstanceHost): number {
  return Math.max(1, Math.max(this.playersX ?? 1, this.players.size))
}



/**
 * Collect individual poison sources (`bitrate256`, `frames`) across active worn equipment,
 * socketed gems/runes/jewels, and `10x4` inventory charms so multi-source poison averages
 * duration (`totalLen / poisonCount`) and sums bitrates (`stat 326 poison_count`, #1871, #1873).
 */
function collectPlayerWeaponPoisonSources113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  options?: { readonly weaponHand?: 'left' | 'right' | undefined },
): readonly { readonly bitrate256: number; readonly frames: number }[] {
  const readEntryPoison = (
    entry: ServerItemEntry,
    level: number,
  ): { readonly bitrate256: number; readonly frames: number } | undefined => {
    let pMin = 0
    let pMax = 0
    let pLen = 0
    if (entry.stats && entry.stats.size > 0) {
      pMin = entry.stats.get(57) ?? 0
      pMax = (entry.stats.get(58) ?? 0) + (((entry.stats.get(229) ?? 0) * level) >> 3)
      pLen = entry.stats.get(59) ?? 0
    } else if (entry.rawItemData) {
      const lists = [entry.rawItemData.stats ?? [], entry.rawItemData.runewordStats ?? []]
      for (const list of lists) {
        for (const st of list) {
          if (st.statId === 57) pMin += st.value
          else if (st.statId === 58) pMax += st.value
          else if (st.statId === 229) pMax += (st.value * level) >> 3
          else if (st.statId === 59) pLen += st.value
        }
      }
    }
    const hi = Math.max(pMin, pMax)
    if (hi <= 0 || pLen <= 0) return undefined
    return { bitrate256: this.rollInclusive(pMin, hi), frames: pLen }
  }

  const sources: { readonly bitrate256: number; readonly frames: number }[] = []
  const seenUniqueCharms = new Set<number>()
  const otherWeaponLoc =
    options?.weaponHand === 'left'
      ? BODYLOC_RIGHT_ARM
      : options?.weaponHand === 'right'
        ? BODYLOC_LEFT_ARM
        : undefined
  for (const item of player.items) {
    if (item.location === 'equipped') {
      if (item.bodyLoc === 11 || item.bodyLoc === 12) continue
      if (
        otherWeaponLoc !== undefined &&
        item.bodyLoc === otherWeaponLoc &&
        resolveWeaponBase113c(item.code) !== undefined
      ) {
        continue
      }
    } else if (item.location === 'inventory') {
      if (!this.isActiveInventoryCharm113c(player, item, seenUniqueCharms)) continue
    } else {
      continue
    }
    // In 1.13c, socketed Emeralds/Tal runes inside a single item merge into that item's stat list
    // (`poison_count = 1` per poison-bearing item unless separate items/charms contribute).
    let itemRate = 0
    let itemLen = 0
    let itemCount = 0
    const baseSrc = readEntryPoison(item, player.level)
    if (baseSrc !== undefined) {
      itemRate += baseSrc.bitrate256
      itemLen += baseSrc.frames
      itemCount += 1
    }
    if (Array.isArray(item.socketedItems)) {
      for (const sock of item.socketedItems) {
        const sockSrc = readEntryPoison(sock, player.level)
        if (sockSrc !== undefined) {
          itemRate += sockSrc.bitrate256
          itemLen += sockSrc.frames
          itemCount += 1
        }
      }
    }
    if (itemRate > 0 && itemLen > 0) {
      sources.push({
        bitrate256: itemRate,
        frames: itemCount > 1 ? Math.floor(itemLen / itemCount) : itemLen,
      })
    }
  }
  return sources
}



function normalizePoolStat256(this: GameInstanceHost, val: number): number {
  if (val === 0) return 0
  return Math.abs(val) < FIXED_ONE || (val & 0xff) !== 0 ? val * FIXED_ONE : val
}



/**
 * Sum a 1/256 fixed-point item pool stat (`7 maxhp`, `9 maxmana`, `11 maxstamina`,
 * `216 item_hp_perlevel`, `217 item_mana_perlevel`, `242 item_stamina_perlevel`) across active
 * equipment (excluding swap 11/12), charms, sockets, and set bonuses without pre-folding
 * per-level stats into flat pool stats (so `EvalStatWithOps` `op 11` `%maxhp`/`%maxmana` scales
 * flat pool stats before `op 2` `+pool/lvl` is added, per `D2Common.dll` `0x6FD89530`, #1667).
 */
function sumPlayerItemPoolStat256(this: GameInstanceHost, player: InternalPlayerRecord, statId: number): number {
  const readEntryStat256 = (entry: ServerItemEntry): number => {
    const stats = entry.stats
    if (stats && stats.size > 0) {
      return this.normalizePoolStat256(stats.get(statId) ?? 0)
    }
    if (entry.rawItemData) {
      let value = 0
      const lists = [entry.rawItemData.stats ?? [], entry.rawItemData.runewordStats ?? []]
      for (const list of lists) {
        for (const st of list) {
          if (st.statId === statId) value += this.normalizePoolStat256(st.value)
        }
      }
      return value
    }
    return 0
  }
  let total = 0
  const seenUniqueCharms = new Set<number>()
  const worn: ServerItemEntry[] = []
  for (const item of player.items) {
    if (item.location === 'equipped') {
      if (item.bodyLoc === 11 || item.bodyLoc === 12) continue
      worn.push(item)
    } else if (item.location === 'inventory') {
      if (!this.isActiveInventoryCharm113c(player, item, seenUniqueCharms)) continue
    } else {
      continue
    }
    total += readEntryStat256(item)
    if (Array.isArray(item.socketedItems)) {
      for (const socketed of item.socketedItems) total += readEntryStat256(socketed)
    }
  }
  if (
    worn.length > 0 &&
    worn.some(
      (it) =>
        it.quality === 5 ||
        (it.rawItemData?.setItemId !== undefined &&
          it.rawItemData.setItemId >= 0 &&
          it.rawItemData.setItemId !== 0xfff),
    )
  ) {
    const tables = getEmbeddedDropTables()
    if (tables.properties && tables.itemStatCost) {
      const counts = this.wornSetPieceCounts(worn)
      const siblingMasks = computeWornSetSiblingMasks113c(worn, tables.sets.items)
      const addProps = (
        props: readonly SetBonusProp[],
        rngKey: string,
      ): void => {
        const propRng = makeDeterministicSetBonusRng113c(this.mapSeed, rngKey)
        for (const rawProp of props) {
          const prop = rollSetBonusPropIfNeeded(rawProp, propRng)
          const param = typeof prop.par === 'number' ? prop.par : Number(prop.par ?? 0) || 0
          for (const resolved of tables.properties!.resolveProperty(
            prop.code,
            param,
            prop.min,
            prop.max,
            tables.itemStatCost!,
          )) {
            if (resolved.statId === statId) {
              total += this.normalizePoolStat256(resolved.value)
            }
          }
        }
      }
      const seenSets = new Set<string>()
      for (const item of worn) {
        const setId = item.rawItemData?.setItemId
        if (setId === undefined || setId < 0 || setId === 0xfff) continue
        const setItem = tables.sets.items.getById(setId)
        if (setItem === undefined) continue
        const setDef = tables.sets.sets.get(setItem.set)
        if (setDef === undefined) continue
        const wornCount = counts.get(setItem.set) ?? 1
        const siblingMask = siblingMasks.get(setItem.set) ?? 0
        const bonuses = resolveActiveSetBonuses(setItem, setDef, wornCount, {
          siblingMask,
          setItemsTable: tables.sets.items,
          rng: makeDeterministicSetBonusRng113c(this.mapSeed, `set:${setItem.set}`),
        })
        const hasOwnPoolStat =
          item.stats?.has(statId) === true ||
          item.rawItemData?.stats?.some((s) => s.statId === statId) === true
        if (!hasOwnPoolStat) addProps(bonuses.props, `item:${item.unitId}:props`)
        const storedLists = item.rawItemData?.setBonusStats as
          | readonly ({ readonly index: number; readonly stats: readonly ItemStat[] } | ItemStat)[]
          | undefined
        if (Array.isArray(storedLists) && storedLists.length > 0) {
          for (const listOrStat of storedLists) {
            if ('stats' in listOrStat && Array.isArray(listOrStat.stats)) {
              if (
                !isSetBonusSlotActive113c(
                  setItem,
                  listOrStat.index,
                  wornCount,
                  siblingMask,
                  tables.sets.items,
                )
              ) {
                continue
              }
              for (const st of listOrStat.stats) {
                if (
                  setItem.addFunc === 0 &&
                  (item.stats?.has(st.statId) === true ||
                    item.rawItemData?.stats?.some((s) => s.statId === st.statId) === true)
                ) {
                  continue
                }
                if (st.statId === statId) total += this.normalizePoolStat256(st.value)
              }
            } else if ('statId' in listOrStat && typeof listOrStat.statId === 'number') {
              if (
                setItem.addFunc === 0 &&
                (item.stats?.has(listOrStat.statId) === true ||
                  item.rawItemData?.stats?.some((s) => s.statId === listOrStat.statId) === true)
              ) {
                continue
              }
              if (listOrStat.statId === statId) {
                total += this.normalizePoolStat256(listOrStat.value)
              }
            }
          }
        } else if (setItem.addFunc === 0) {
          if (!hasOwnPoolStat) addProps(setItem.aprops, `item:${item.unitId}:aprops0`)
        } else {
          addProps(bonuses.aprops, `item:${item.unitId}:aprops`)
        }
        if (!seenSets.has(setItem.set)) {
          seenSets.add(setItem.set)
          addProps(bonuses.pCodes, `set:${setItem.set}:pcodes`)
          addProps(bonuses.fCodes, `set:${setItem.set}:fcodes`)
        }
      }
    }
  }
  return total
}



/** Mercenary gear stat (helmet / armor / weapon + sockets + set bonuses), including per-level stats (#1629, #1630, #1818, #1831). */
function sumMercItemStat(this: GameInstanceHost, 
  merc: InternalMercenaryRecord,
  statId: number,
  options?: { readonly excludeWeaponHands?: boolean },
): number {
  const perLvlRule = PER_LEVEL_STAT_MAP_113C[statId]
  const perLevelStatId = perLvlRule?.perLevelStatId
  const perLevelShift = perLvlRule?.shift ?? 3
  const addEntryStats = (entry: ServerItemEntry): number => {
    const stats = entry.stats
    if (stats && stats.size > 0) {
      let value = stats.get(statId) ?? 0
      if (perLevelStatId !== undefined) {
        value += ((stats.get(perLevelStatId) ?? 0) * merc.level) >> perLevelShift
      }
      return value
    }
    if (entry.rawItemData) {
      let value = 0
      const lists = [entry.rawItemData.stats ?? [], entry.rawItemData.runewordStats ?? []]
      for (const list of lists) {
        for (const st of list) {
          if (st.statId === statId) value += st.value
          else if (perLevelStatId !== undefined && st.statId === perLevelStatId) {
            value += (st.value * merc.level) >> perLevelShift
          }
        }
      }
      return value
    }
    return 0
  }
  const rawMercEquip =
    merc.equipment ??
    (merc as { readonly items?: readonly ServerItemEntry[] }).items ??
    []
  const eligibleItems = rawMercEquip.filter((item) => {
    if (item.identified === false || item.rawItemData?.identified === false) return false
    if (
      (item as { readonly broken?: boolean }).broken === true ||
      item.rawItemData?.broken === true
    ) {
      return false
    }
    if (
      options?.excludeWeaponHands &&
      (item.bodyLoc === BODYLOC_RIGHT_ARM || item.bodyLoc === BODYLOC_LEFT_ARM) &&
      resolveWeaponBase113c(item.code) !== undefined
    ) {
      return false
    }
    return true
  })
  let total = 0
  for (const item of eligibleItems) {
    total += addEntryStats(item)
    if (Array.isArray(item.socketedItems)) {
      for (const socketed of item.socketedItems) total += addEntryStats(socketed)
    }
  }
  total += this.sumEquippedSetBonusStat(eligibleItems, statId, merc.level)
  return total
}



function actBossQuestId(this: GameInstanceHost, defId: string, hcIdx?: number): string | undefined {
  if (hcIdx === 156) return 'a1q6'
  if (hcIdx === 211) return 'a2q6'
  if (hcIdx === 242) return 'a3q6'
  if (hcIdx === 243) return 'a4q3'
  if (hcIdx === 544) return 'a5q6'
  const id = defId.trim().toLowerCase()
  return ACT_BOSS_QUEST_113C[id]
}



/** Death animation action/completion frame (`{code}DTHTH`), falling back to compiled 1.13c AnimData DT metrics. */
function monsterDeathDropDelayFrames(this: GameInstanceHost, monster: InternalMonsterRecord): number {
  const code = MONSTATS_113C_ROWS[monster.hcIdx]?.code?.trim().toUpperCase()
  if (code !== undefined && code !== '') {
    const record = this.registry.getAnimDataRecord(`${code}DTHTH`)
    if (record !== undefined && record.framesPerDirection > 0 && record.hasSpeed) {
      const event = record.events.find((entry) => entry.code !== 0)
      const frame = event !== undefined ? event.frame + 1 : record.framesPerDirection
      return Math.max(
        1,
        Math.floor((frame * 256) / Math.max(1, record.animationSpeed)),
      )
    }
  }
  if (monster.hcIdx >= 0 && monster.hcIdx < MONSTATS_113C_ROWS.length) {
    const fpd = getMonsterModeBaseFrameCount113c(monster.hcIdx, 0)
    const speed = getMonsterModeBaseAnimSpeed256(monster.hcIdx, 0)
    if (fpd > 0 && speed > 0) {
      return Math.max(1, Math.floor((fpd * 256) / speed))
    }
  }
  return MONSTER_DEATH_DROP_DELAY_FRAMES
}



/**
 * Creates a 1.13c quest drop item (`D2Game_CreateQuestItem` @ `0x6FC31A70` / `sub_6FC95DF0`):
 * uses the `UniqueItems.txt` entry (`ITEMQUAL_UNIQUE`) for quest uniques (`vip`, `msf`, `hst`,
 * `hfh`, `qf1`, `qf2`) and `ITEMQUAL_NORMAL` for `Misc.txt` / non-unique quest items (`bks`,
 * `hdm`, `bbb`, `j34`, `g33`, `box`, `tr1`, `qhr`, `qbr`, `qey`, `ass`, `mss`).
 */
function createQuestDropItem(this: GameInstanceHost, code: string, ilvl = 1): Item | undefined {
  const tables = getEmbeddedDropTables()
  const base = tables.getBase(code)
  if (!base) return undefined
  const seed = this.rng.rand(0x7fffffff) >>> 0
  const itemRng = new D2Rng(seed || 1)
  const uniqueItem = tables.uniques.getEnabledByCode(base.id)[0]
  if (uniqueItem) {
    return createDroppedItem(base, 'unique', {
      uniqueItem,
      ethereal: false,
      sockets: 0,
      itemTypes: tables.itemTypes,
      ilvl,
      dwInitSeed: seed,
      itemRng,
    })
  }
  return createDroppedItem(base, 'normal', {
    itemTypes: tables.itemTypes,
    ilvl,
    dwInitSeed: seed,
    itemRng,
  })
}



function rollMonsterDeathDrop(this: GameInstanceHost, killer: InternalPlayerRecord, monster: InternalMonsterRecord): number[] {
  // 1.13c `D2Game.dll` (`0x6FCD0C40`): summoned Uber Tristram minions yield 0 XP and 0 item drops (#1841).
  if (monster.isUberSummonedMinion) return []
  const tables = getEmbeddedDropTables()
  // 1.13c World Event (`#333 diabloclone`): guaranteed Unique Small Charm `#381 Annihilus` (`cm1`, ilvl 110) (#1842).
  if (
    monster.hcIdx === 333 ||
    monster.classId === 333 ||
    monster.defId === 'diabloclone'
  ) {
    const cm1Base = tables.getBase('cm1')
    const anniUnique = tables.uniques
      .getEnabledByCode('cm1')
      .find((u) => u.id === 381 || u.index === 'Annihilus')
    if (cm1Base && anniUnique) {
      const seed = (this.rng.rand(0x7fffffff) || 1) >>> 0
      const itemRng = new D2Rng(seed)
      const anniItem = createDroppedItem(cm1Base, 'unique', {
        uniqueItem: anniUnique,
        ethereal: false,
        sockets: 0,
        itemTypes: tables.itemTypes,
        ilvl: 110,
        dwInitSeed: seed,
        itemRng,
      })
      this.spawnedUniqueIds.add(anniUnique.id)
      monster.pendingDropItems = [anniItem]
      monster.pendingDropFrame = this.currentFrame + this.monsterDeathDropDelayFrames(monster)
      return []
    }
  }
  const difficulty = this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal'
  const questId = this.actBossQuestId(monster.defId, monster.hcIdx)
  const bossKey = `${monster.defId}:${difficulty}`
  const firstKill =
    questId !== undefined
      ? this.isActBossFirstKillDrop113c(killer, questId, bossKey)
      : !this.killedActBosses.has(bossKey)
  const merc = monster.lastHitByMerc
    ? [...this.mercenaries.values()].find(
        (entry) => entry.ownerPlayerId === killer.unitId && entry.areaId === monster.areaId,
      )
    : undefined
  const mercMf = merc === undefined ? 0 : this.sumMercItemStat(merc, 80)
  const mercGf = merc === undefined ? 0 : this.sumMercItemStat(merc, 79)
  const pending = resolveMonsterDropPending113c(
    undefined,
    {
      kind: 'kill',
      x: monster.x,
      y: monster.y,
      subjectId: monster.defId,
      monsterIndex: monster.unitId,
      monsterLevel: monster.level,
      monsterRank: monster.rank,
      ...(monster.superUniqueId !== undefined ? { superUniqueId: monster.superUniqueId } : {}),
    },
    {
      dropTables: tables,
      difficulty,
      wasBossAlreadyKilled: !firstKill,
      onMarkBossFirstKill: (subjectId, diff) => {
        this.killedActBosses.add(`${subjectId}:${diff}`)
        if (questId !== undefined) {
          this.setPlayerQuestFlag(
            killer,
            questId,
            questId === 'a1q6'
              ? QUEST_FLAG_PRIMARY_GOAL_DONE_113C | QUEST_FLAG_COMPLETED_NOW_113C
              : questId === 'a2q6'
                ? QUEST_FLAG_STARTED_113C | QUEST_FLAG_PRIMARY_GOAL_DONE_113C
                : QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
          )
        }
      },
      playerMf: this.sumPlayerItemStat(killer, 80) + mercMf,
      playerGf: this.sumPlayerItemStat(killer, 79) + mercGf,
      gamePlayers: this.playersX,
      partyPlayers: this.countPartyPlayersInArea(killer, monster.areaId),
      monsterPlayerCount: monster.monsterPlayerCount,
    },
  )
  const equippedDeathDrops =
    monster.hcIdx === 234 && monster.monEquipLoadout !== undefined && monster.monEquipLoadout.slots.length > 0
      ? monster.monEquipLoadout.slots.map((s) => s.item)
      : []
  if (!pending) {
    if (equippedDeathDrops.length > 0) {
      if (this.drlgRoomPopulator !== null) {
        return this.spawnDroppedItems(equippedDeathDrops, monster.areaId, monster.x, monster.y)
      }
      monster.pendingDropItems = equippedDeathDrops
      monster.pendingDropFrame = this.currentFrame + this.monsterDeathDropDelayFrames(monster)
    }
    return []
  }
  if (this.drlgRoomPopulator !== null) {
    const mSeed = this.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${monster.unitId}`)
    if (mSeed !== undefined) {
      const monRng = new D2Rng({ lo: mSeed.lo, hi: mSeed.hi })
      const rolledDrops = executeDropPipeline(tables, {
        tcName: pending.tcName,
        nLevel: pending.monsterLevel,
        monsterType: pending.monsterType,
        difficulty,
        gamePlayers: pending.killerContext.gamePlayers,
        partyPlayers: pending.killerContext.partyPlayers,
        ...(pending.killerContext.monsterPlayerCount !== undefined
          ? { monsterPlayerCount: pending.killerContext.monsterPlayerCount }
          : {}),
        playerMf: pending.killerContext.playerMf,
        playerGf: pending.killerContext.playerGf,
        isBoss: pending.isBoss,
        isNoRatio: pending.isNoRatio,
        monsterRng: monRng,
        spawnedUniqueIds: this.spawnedUniqueIds,
        allocItemRng113c: () => {
          const preAllocatedUnitId = this.allocateUnitId(UNIT_TYPE_113C.item)
          const iSeed = this.unitSeeds.get(`${UNIT_TYPE_113C.item}:${preAllocatedUnitId}`)!
          const itemRng = new D2Rng({ lo: iSeed.lo, hi: iSeed.hi })
          return {
            preAllocatedUnitId,
            dwInitSeed: iSeed.lo >>> 0,
            itemRng,
            syncBack: () => {
              const s = itemRng.getSeed()
              iSeed.lo = s.lo
              iSeed.hi = s.hi
            },
          }
        },
      })
      const ms = monRng.getSeed()
      mSeed.lo = ms.lo
      mSeed.hi = ms.hi
      const syncItems = [...equippedDeathDrops, ...rolledDrops]
      return syncItems.length > 0
        ? this.spawnDroppedItems(syncItems, monster.areaId, monster.x, monster.y)
        : []
    }
  }
  const items = [
    ...equippedDeathDrops,
    ...executePendingMonsterDrop113c(
      tables,
      pending,
      difficulty,
      this.rng.rand(0x7fffffff) || 1,
      this.spawnedUniqueIds,
    ),
  ]
  if (items.length > 0) {
    monster.pendingDropItems = items
    monster.pendingDropFrame = this.currentFrame + this.monsterDeathDropDelayFrames(monster)
  }
  return []
}



/**
 * Objects.txt `OperateFn` container drop (D2Game.dll 0x6fc8b570 via the operate functions listed in
 * `CONTAINER_OPERATE_DROP_CHANCE_113C`): one chance roll, then one `Act N Chest A|B|C` TreasureClassEx
 * drop at the level monster level with the operator's MF/GF.
 */
function rollContainerDrop(this: GameInstanceHost, player: InternalPlayerRecord, obj: InternalObjectRecord, dropChance: number): number[] {
  if (obj.isSparkling) return this.rollSparklingChestDrop(player, obj)
  // D2Game.dll 0x6fc8f0f3 & 0x6fc8f3f0: locked chests roll two guaranteed (100%) Chest TC drops.
  const rolls = obj.isLocked ? 2 : 1
  const effectiveChance = obj.isLocked ? 100 : dropChance
  const dropped: Item[] = []
  for (let roll = 0; roll < rolls; roll++) {
    if (this.rng.rand(100) >= effectiveChance) continue
    const tables = getEmbeddedDropTables()
    const ctx = resolveChestDropContext113c(obj.areaId, this.difficulty)
    dropped.push(...executeDropPipeline(tables, {
      tcName: ctx.tcName,
      nLevel: ctx.monsterLevel,
      // Sparkling chests force the higher-quality (unique-tier) drop path.
      monsterType: obj.isSparkling ? 3 : 1,
      difficulty: this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal',
      gamePlayers: this.playersX,
      partyPlayers: this.countPartyPlayersInArea(player, obj.areaId),
      playerMf: this.sumPlayerItemStat(player, 80),
      playerGf: this.sumPlayerItemStat(player, 79),
      monsterRng: new D2Rng(this.rng.rand(0x7fffffff) || 1),
      spawnedUniqueIds: this.spawnedUniqueIds,
    }))
  }
  return dropped.length > 0
    ? this.spawnDroppedItems(dropped, obj.areaId, obj.x, obj.y)
    : []
}



/** 1.13c Sparkling Chest roll thresholds (`D2Game.dll` 0x6FC8E8B0). */
function sparklingChestPlan(this: GameInstanceHost, roll: number): {
  readonly quality?: number
  readonly attempts: number
  readonly magic: number
  readonly normal: number
  readonly gold: number
  readonly potions: number
} {
  if (roll < 200) return { quality: 7, attempts: 2, magic: 0, normal: 0, gold: 0, potions: 0 }
  if (roll < 600) return { quality: 5, attempts: 2, magic: 0, normal: 0, gold: 0, potions: 0 }
  if (roll < 1200) return { quality: 6, attempts: 2, magic: 0, normal: 0, gold: 0, potions: 0 }
  if (roll < 3200) return { attempts: 0, magic: 3, normal: 0, gold: 0, potions: 0 }
  if (roll < 6200) return { attempts: 0, magic: 2, normal: 1, gold: 7, potions: 0 }
  return { attempts: 0, magic: 1, normal: 4, gold: 5, potions: 4 }
}



/** 1.13c Sparkling Chest (OperateFn 58) quality sequence. */
function rollSparklingChestDrop(this: GameInstanceHost, player: InternalPlayerRecord, obj: InternalObjectRecord): number[] {
  const roll = this.rng.rand(10000)
  const tables = getEmbeddedDropTables()
  const ctx = resolveChestDropContext113c(obj.areaId, this.difficulty)
  const difficulty =
    this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal'
  const dropped: Item[] = []
  const playerMf = this.sumPlayerItemStat(player, 80)
  const playerGf = this.sumPlayerItemStat(player, 79)
  const rollOnce = (forcedQuality?: number): Item[] =>
    executeDropPipeline(tables, {
      tcName: ctx.tcName,
      nLevel: ctx.monsterLevel,
      monsterType: 3,
      difficulty,
      gamePlayers: this.playersX,
      partyPlayers: this.countPartyPlayersInArea(player, obj.areaId),
      playerMf,
      playerGf,
      monsterRng: new D2Rng(this.rng.rand(0x7fffffff) || 1),
      spawnedUniqueIds: this.spawnedUniqueIds,
      ...(forcedQuality !== undefined ? { forcedQuality } : {}),
    })
  const takeQuality = (quality: number, attempts: number): Item | undefined => {
    for (let i = 0; i < attempts; i++) {
      const rolled = rollOnce(quality)
      const match = rolled.find((item) => Number(item.quality ?? 2) === quality)
      if (match !== undefined) return match
    }
    return undefined
  }
  const takeMagic = (count: number): void => {
    let got = 0
    for (let i = 0; i < 10 && got < count; i++) {
      const rolled = rollOnce(4)
      const match = rolled.find((item) => Number(item.quality ?? 2) === 4)
      if (match !== undefined) {
        dropped.push(match)
        got++
      }
    }
  }
  const takeAny = (): void => {
    const rolled = rollOnce()
    if (rolled[0] !== undefined) dropped.push(rolled[0])
  }
  const addGold = (piles: number): void => {
    const base = tables.getBase('gld')
    if (base === undefined) return
    const lvl = Math.max(1, ctx.monsterLevel)
    for (let i = 0; i < piles; i++) {
      const seed = this.rng.rand(0x7fffffff) >>> 0
      const itemRng = new D2Rng(seed || 1)
      const item = createDroppedItem(base, 'normal', {
        itemTypes: tables.itemTypes,
        ilvl: lvl,
        dwInitSeed: seed,
        itemRng,
      })
      // D2Game!0x6FC8F240 / 0x6FC8F3A5 -> 0x6FC8AFA0 -> 0x6FC31490 -> 0x6FC31070:
      // Gold amount is rolled from the gold item's own seed (`pItem->pSeed`), not the object/game RNG.
      let amount = Math.max(1, itemRng.rand(5 * lvl) + lvl)
      if (playerGf !== 0) {
        amount = Math.max(0, Math.trunc((amount * (100 + playerGf)) / 100))
      }
      dropped.push({ ...item, stack: amount })
    }
  }
  const addPotion = (code: string): void => {
    const base = tables.getBase(code)
    if (base === undefined) return
    const seed = this.rng.rand(0x7fffffff) >>> 0
    dropped.push(
      createDroppedItem(base, 'normal', {
        itemTypes: tables.itemTypes,
        ilvl: Math.max(1, ctx.monsterLevel),
        dwInitSeed: seed,
        itemRng: new D2Rng(seed || 1),
      }),
    )
  }
  const fallbackLow = (): void => {
    takeMagic(1)
    for (let i = 0; i < 4; i++) takeAny()
    addGold(5)
    addPotion('hp3')
    addPotion('hp3')
    addPotion('mp3')
    addPotion('mp3')
  }

  const plan = this.sparklingChestPlan(roll)
  if (plan.quality !== undefined) {
    const item = takeQuality(plan.quality, plan.attempts)
    if (item !== undefined) dropped.push(item)
    else fallbackLow()
  } else {
    takeMagic(plan.magic)
    for (let i = 0; i < plan.normal; i++) takeAny()
    addGold(plan.gold)
    for (let i = 0; i < plan.potions; i++) addPotion(i % 2 === 0 ? 'hp3' : 'mp3')
  }
  return dropped.length > 0 ? this.spawnDroppedItems(dropped, obj.areaId, obj.x, obj.y) : []
}

export interface ItemStatsAndDropsMethods {
  itemDataToServerEntry(itemData: ItemData, ownerId: number, areaId: number, allocateFreshId?: boolean | undefined): ServerItemEntry
  serverEntryToItemData(entry: ServerItemEntry): ItemData
  emitInitialPlayerStats(player: InternalPlayerRecord): void
  emitSavedPlayerHotkeys(player: InternalPlayerRecord): void
  buildMonsterUnitAssignEvent(m: InternalMonsterRecord): ServerEvent
  buildUnitAssignEvent(unitType: 'monster' | 'object', unitId: number): ServerEvent | undefined
  emitAreaSnapshotToPlayer(player: InternalPlayerRecord): void
  buildPlayerCorpseEvents113c(owner: InternalPlayerRecord): readonly ServerEvent[]
  buildPlayerCorpseEventsForSet113c(owner: InternalPlayerRecord, corpseId: number, areaId: number, corpseX: number, corpseY: number, items: readonly ServerItemEntry[]): readonly ServerEvent[]
  createServerEntryFromItem(item: Item, placement: {
    readonly location: ServerItemEntry['location']
    readonly x: number
    readonly y: number
    readonly areaId: number
    readonly ownerId: number
    readonly storePage: number
    readonly gamble: boolean
  }): ServerItemEntry
  transactionInputFromEntry(entry: ServerItemEntry): TransactionCostInput
  transactionCostContext(player: InternalPlayerRecord, npcClass: number): TransactionCostContext
  serverItemPrice113c(player: InternalPlayerRecord, npcClass: number, entry: ServerItemEntry, type: 0 | 1 | 2 | 3): number
  cloneVendorEntryForPlayer(vItem: ServerItemEntry, player: InternalPlayerRecord, cell: { readonly x: number; readonly y: number }, location?: 'inventory' | 'belt' | undefined): ServerItemEntry
  createVendorStorePool(npc: InternalMonsterRecord, player: InternalPlayerRecord, gamble: boolean): ServerItemEntry[]
  spawnDroppedItems(items: readonly Item[], areaId: number, x: number, y: number): number[]
  findDropPosition(areaId: number, originX: number, originY: number, used: ReadonlySet<string>): { readonly x: number; readonly y: number }
  sumEquippedItemStat(player: InternalPlayerRecord, statId: number): number
  playerStealPct(player: InternalPlayerRecord, statId: 60 | 62): number
  applyPlayerStealOutcome(player: InternalPlayerRecord, out: SUnitDmgOutcome): void
  countPartyPlayersInArea(player: InternalPlayerRecord, areaId: number): number
  wornSetPieceCounts(worn: readonly ServerItemEntry[]): Map<string, number>
  syncPlayerEquippedSetStates113c(player: InternalPlayerRecord): void
  sumEquippedSetBonusStat(worn: readonly ServerItemEntry[], statId: number, level: number): number
  sumPlayerItemStat(player: InternalPlayerRecord, statId: number, options?: {
    readonly excludeWeaponHands?: boolean
    readonly weaponHand?: 'left' | 'right' | undefined
  }): number
  isActiveInventoryCharm113c(player: InternalPlayerRecord, item: ServerItemEntry, seenUniqueCharms: Set<number>): boolean
  effectivePlayerCount113c(): number
  collectPlayerWeaponPoisonSources113c(player: InternalPlayerRecord, options?: { readonly weaponHand?: 'left' | 'right' | undefined }): readonly { readonly bitrate256: number; readonly frames: number }[]
  normalizePoolStat256(val: number): number
  sumPlayerItemPoolStat256(player: InternalPlayerRecord, statId: number): number
  sumMercItemStat(merc: InternalMercenaryRecord, statId: number, options?: { readonly excludeWeaponHands?: boolean }): number
  actBossQuestId(defId: string, hcIdx?: number): string | undefined
  monsterDeathDropDelayFrames(monster: InternalMonsterRecord): number
  createQuestDropItem(code: string, ilvl?: number | undefined): Item | undefined
  rollMonsterDeathDrop(killer: InternalPlayerRecord, monster: InternalMonsterRecord): number[]
  rollContainerDrop(player: InternalPlayerRecord, obj: InternalObjectRecord, dropChance: number): number[]
  sparklingChestPlan(roll: number): {
  readonly quality?: number
  readonly attempts: number
  readonly magic: number
  readonly normal: number
  readonly gold: number
  readonly potions: number
}
  rollSparklingChestDrop(player: InternalPlayerRecord, obj: InternalObjectRecord): number[]
}

export const itemStatsAndDropsMethods: Record<keyof ItemStatsAndDropsMethods, unknown> = {
  itemDataToServerEntry,
  serverEntryToItemData,
  emitInitialPlayerStats,
  emitSavedPlayerHotkeys,
  buildMonsterUnitAssignEvent,
  buildUnitAssignEvent,
  emitAreaSnapshotToPlayer,
  buildPlayerCorpseEvents113c,
  buildPlayerCorpseEventsForSet113c,
  createServerEntryFromItem,
  transactionInputFromEntry,
  transactionCostContext,
  serverItemPrice113c,
  cloneVendorEntryForPlayer,
  createVendorStorePool,
  spawnDroppedItems,
  findDropPosition,
  sumEquippedItemStat,
  playerStealPct,
  applyPlayerStealOutcome,
  countPartyPlayersInArea,
  wornSetPieceCounts,
  syncPlayerEquippedSetStates113c,
  sumEquippedSetBonusStat,
  sumPlayerItemStat,
  isActiveInventoryCharm113c,
  effectivePlayerCount113c,
  collectPlayerWeaponPoisonSources113c,
  normalizePoolStat256,
  sumPlayerItemPoolStat256,
  sumMercItemStat,
  actBossQuestId,
  monsterDeathDropDelayFrames,
  createQuestDropItem,
  rollMonsterDeathDrop,
  rollContainerDrop,
  sparklingChestPlan,
  rollSparklingChestDrop,
}
