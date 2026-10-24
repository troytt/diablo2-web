/**
 * HUD World Synchronization (`src/client/ui-model/hud-world-sync.ts`).
 *
 * Synchronizes `ClientWorld` state into `HudManager` (`syncFromWorldImpl`, `syncNpcInteractionImpl`,
 * `refreshHoveredItemsImpl`, `decoratePlayerItemPricesImpl`, fast-path monster & vitals updates,
 * auto-party handling, and quest flag application).
 *
 * Zero imports from `src/netproto/{bncs,mcp,d2gs,crypto}/**` — consumes only `src/netproto/index.ts`.
 */

import {
  CANONICAL_NPC_MSG_ID_TO_TBL_KEY,
  isNpcIntroMessageId,
  resolveNpcIntroMsgIdByTblKey,
  resolveQuestTitleKeyForMsgId,
} from '../../common/data/canonical-npc-dialog-table.ts'
import {
  resolveNpcIntroStringId113c,
  resolveNpcIntroTblKey113c,
} from '../../common/audio/npc-speech-113c.ts'
import { SKILLS_BY_ID } from '../../common/data/skills-catalog.ts'
import {
  calculateDetailedDamage,
  calculateManaCost,
  createInitialState,
  evaluateLevelBand,
} from '../../common/skills/skill-calc-engine.ts'
import {
  canUseSkillWithWeapon,
  getSkillName,
  getSkillTableMeta,
} from '../../common/skills/skills-meta.ts'
import { CANONICAL_CHARSTATS } from '../../common/units/classes.ts'
import { resolveHirelingCandidates, resolveHirelingName } from '../../common/units/hireling-table.ts'
import { getMonsterKindByHcIdx } from '../../common/units/monsters-data.ts'
import {
  isTownNpcHcIdx,
  NPC_CANONICAL_INTRO_KEYS,
  resolveNpcDialogueTblText,
  type TownNpcServiceDescriptor,
} from '../../common/units/npc-table.ts'
import {
  resolveMercPortraitIcon,
  resolvePetPortraitInfo,
  resolvePlayerClassPortraitIcon,
} from '../../common/units/pet-type-table.ts'
import { resolveOverheadBubbleText113c } from '../../common/chat/chat-113c.ts'
import type { ItemData } from '../../netproto/index.ts'
import { lookupTbl, requireTbl } from '../i18n/lang.ts'
import { BELT_COLS, BELT_ROWS, itemToBeltPotion } from '../ui/belt.ts'
import type { D2ColorCode } from '../ui/font.ts'
import {
  createCanonicalGenericSkillEntry,
  isAuraSkill,
  isLeftUsableSkill,
  isPassiveSkill,
} from '../ui/hotkeys.ts'
import type { HudManager } from '../ui/hud-manager.ts'
import type { EquipSlotId, GridPlacement, UiInventoryItem } from '../ui/inventory.ts'
import { computeNpcMenuAnchor } from '../ui/world-panels.ts'
import {
  VIEWPORT_800x600,
  computePanelCameraShift,
  panelDockWidth,
  subTileToScreen,
} from '../view/viewport-profile.ts'
import type { NpcInteractionState } from '../world/client-world.ts'
import { D2StatId } from '../world/stat-list.ts'
import {
  computeActiveWeaponStatGainInfo,
  computeCombatStats,
  type CombatSpellDamageBreakdown,
} from './combat-stats.ts'
import { computeEffectiveMercenaryStats } from './derived-stats.ts'
import { NPC_SELL_SOUND_ID, npcTransactionMessageKey } from './hud-command-actions.ts'
import {
  clientUnitToMonsterTargetInfo,
  computeEquippedItemsSignature,
  nextLevelExperience,
  resolveClassCode,
} from './hud-item-adapter.ts'
import {
  BODY_LOC_TO_EQUIP_SLOT,
  CLASS_ID_TO_NAMES,
  computeTotalSkillBonus,
  preaggregateEquipmentSkillBonuses,
  resolvePreaggregatedSkillBonus,
} from './hud-skill-bonuses.ts'
import {
  aggregateUnit,
  getIscRow,
  itemCodeIsA,
  stateColorFlags,
} from './stat-engine.ts'
import type { VendorPriceContext, VendorPriceFn } from './vendor-price.ts'

export const NPC_STATE_CLOSED: NpcInteractionState = {
  npcId: null,
  window: 'none',
  stashOpen: false,
  cubeOpen: false,
}

const EMPTY_HIRE_CANDIDATES: readonly any[] = []

function hashPlayerSkillsAndStates(self: any, skillHotkeys: ReadonlyMap<number, any> | undefined): number {
  let h = 2166136261 >>> 0
  if (self.states) {
    for (const st of self.states) {
      h = Math.imul(h ^ (st | 0), 16777619) >>> 0
    }
  }
  h = Math.imul(h ^ 0x9e3779b9, 16777619) >>> 0
  if (self.skills) {
    for (const [id, lvl] of self.skills.entries()) {
      h = Math.imul(h ^ (id | 0), 16777619) >>> 0
      h = Math.imul(h ^ (lvl | 0), 16777619) >>> 0
    }
  }
  h = Math.imul(h ^ 0x85ebca6b, 16777619) >>> 0
  if (self.skillEntries) {
    for (const [id, sl] of self.skillEntries.entries()) {
      h = Math.imul(h ^ (id | 0), 16777619) >>> 0
      h = Math.imul(h ^ ((sl.baseLevel ?? sl.level ?? 0) | 0), 16777619) >>> 0
      h = Math.imul(h ^ ((sl.bonus ?? 0) | 0), 16777619) >>> 0
    }
  }
  h = Math.imul(h ^ 0xc2b2ae35, 16777619) >>> 0
  if (self.skillCharges) {
    for (const [id, ch] of self.skillCharges.entries()) {
      h = Math.imul(h ^ (id | 0), 16777619) >>> 0
      h = Math.imul(h ^ (ch | 0), 16777619) >>> 0
    }
  }
  h = Math.imul(h ^ 0x27d4eb2f, 16777619) >>> 0
  if (skillHotkeys) {
    for (const [slot, b] of skillHotkeys.entries()) {
      h = Math.imul(h ^ (slot | 0), 16777619) >>> 0
      h = Math.imul(h ^ (b.hand === 'left' ? 1 : 2), 16777619) >>> 0
      h = Math.imul(h ^ (b.skill | 0), 16777619) >>> 0
    }
  }
  return h >>> 0
}

function hashWaypointsSet(waypoints: Iterable<number> | undefined): number {
  let h = 2166136261 >>> 0
  if (waypoints) {
    for (const wp of waypoints) {
      h = Math.imul(h ^ (wp | 0), 16777619) >>> 0
    }
  }
  return h >>> 0
}

function hashQuestState(world: any): number {
  let h = 2166136261 >>> 0
  const q1 = world.quests as ArrayLike<number> | undefined
  if (q1) {
    for (let i = 0; i < q1.length; i++) {
      h = Math.imul(h ^ (q1[i] ?? 0), 16777619) >>> 0
    }
  }
  h = Math.imul(h ^ 0x9e3779b9, 16777619) >>> 0
  const q2 = world.gameQuests as ArrayLike<number> | undefined
  if (q2) {
    for (let i = 0; i < q2.length; i++) {
      h = Math.imul(h ^ (q2[i] ?? 0), 16777619) >>> 0
    }
  }
  h = Math.imul(h ^ 0x85ebca6b, 16777619) >>> 0
  const q3 = world.questStatusBytes as ArrayLike<number> | undefined
  if (q3) {
    for (let i = 0; i < q3.length; i++) {
      h = Math.imul(h ^ (q3[i] ?? 0), 16777619) >>> 0
    }
  }
  h = Math.imul(h ^ ((world.denMonstersRemaining ?? 0) | 0), 16777619) >>> 0
  h = Math.imul(h ^ ((world.questBarbsRemaining ?? 0) | 0), 16777619) >>> 0
  h = Math.imul(h ^ ((world.questLog?.tombOffset ?? -1) | 0), 16777619) >>> 0
  return h >>> 0
}

export function handleAutoPartyEventImpl(model: any, ev: any): void {
  if (!ev || ev.type !== 'Party') return
  if (ev.source === 0x65 || ev.source === 0x5c) return
  if (ev.kind === 'memberState' && ev.isPlayer === false) return
  const rawUnitId = ev.unitId ?? ev.playerId ?? ev.id
  const rawOtherId = ev.otherId ?? ev.targetId
  const pid =
    model.world.selfId !== 0 && rawUnitId === model.world.selfId && rawOtherId !== undefined
      ? Number(rawOtherId)
      : Number(rawUnitId ?? rawOtherId ?? 0)
  if (!Number.isFinite(pid) || pid <= 0) return

  if (model.world.selfId !== 0 && pid === model.world.selfId) return
  if (model.world.selfId === 0) {
    if (ev.charName && model.world.self.name && ev.charName === model.world.self.name) return
    if (pid === 1 && (!model.world.self.name || model.world.self.name === 'Hero') && model.world.party.size <= 1) {
      return
    }
  }

  const member = model.world.party.get(pid)
  if (!member) return

  const rawRel = ev.relation !== undefined ? Number(ev.relation) : undefined
  const inPartyHi = rawRel !== undefined ? (rawRel >>> 16) & 0xffff : 0
  const relLo = rawRel !== undefined ? rawRel & 0xffff : 0
  const evPartyState = ev.partyState

  const isIncomingInvite =
    evPartyState === 2 ||
    evPartyState === 3 ||
    evPartyState === 'invited_me' ||
    evPartyState === 'invited_by' ||
    (ev.kind === 'relation' && rawOtherId === undefined && (rawRel === 2 || rawRel === 3)) ||
    (ev.kind === 'roster' &&
      (inPartyHi === 2 ||
        inPartyHi === 3 ||
        ((ev.partyId === undefined || ev.partyId === 0xffff) && (relLo === 2 || relLo === 3)))) ||
    member.partyState === 2 ||
    member.partyState === 3

  if (isIncomingInvite) {
    member.partyState = 1
    if (member.partyId === undefined || member.partyId === 0xffff) {
      const selfParty = model.world.selfId !== 0 ? model.world.party.get(model.world.selfId)?.partyId : undefined
      member.partyId = selfParty !== undefined && selfParty !== 0xffff ? selfParty : 1
    }
    model.emitCommand({
      type: 'PartyAction',
      action: 0x08,
      targetPlayerId: pid >>> 0,
    })
    return
  }

  const isRosterJoinOrSync =
    ev.kind === 'roster' &&
    ev.source !== 0x8d &&
    (ev.partyId === 0xffff || ev.partyState === 0 || ev.partyState === 'none') &&
    member.partyState !== 1
  const isUnpartiedRelation =
    ev.kind === 'relation' &&
    rawOtherId === undefined &&
    rawRel === 0 &&
    member.partyState !== 1

  if (isRosterJoinOrSync || isUnpartiedRelation) {
    model.emitCommand({
      type: 'PartyAction',
      action: 0x06,
      targetPlayerId: pid >>> 0,
    })
  }
}

export function isFastPathMonsterEventImpl(
  model: any,
  ev:
    | {
        readonly type?: string | undefined
        readonly kind?: string | undefined
        readonly unitType?: unknown
        readonly id?: number | undefined
        readonly unitId?: number | undefined
        readonly npcId?: number | undefined
        readonly npcUnitId?: number | undefined
        readonly isSelf?: boolean | undefined
        readonly unit?: { readonly unitType?: unknown; readonly id?: number | undefined } | undefined
      }
    | undefined,
): boolean {
  if (!ev) {
    return false
  }
  const type = ev.type
  if (
    type === 'PlaySound' ||
    type === 'Pong' ||
    type === 'Warden' ||
    type === 'SaveChunk' ||
    type === 'Opaque' ||
    type === 'EnvironmentSync' ||
    type === 'GameLoading' ||
    type === 'GameFlags' ||
    type === 'UseSpecialItem'
  ) {
    return true
  }
  const activeNpcId = model.world.npcInteraction.npcId
  const uType = ev.unitType ?? ev.unit?.unitType
  const id = Number(
    ev.id ?? ev.unitId ?? ev.npcId ?? ev.npcUnitId ?? ev.unit?.id ?? 0,
  )
  if (activeNpcId !== null && id > 0 && id === activeNpcId) {
    return false
  }
  const isMercOrPet = (): boolean => {
    if (id <= 0) return false
    const mercId =
      model.world.merc?.mercId ?? (model.world.merc as { unitId?: number } | null)?.unitId
    if (mercId !== undefined && id === mercId) return true
    if (model.world.pets && model.world.pets.has(id)) return true
    return false
  }
  if (type === 'Npc') {
    if (ev.kind === 'heal' || ev.kind === 'wantsInteract') {
      return id > 0 && !isMercOrPet()
    }
    return false
  }
  if (
    type === 'UnitMove' ||
    type === 'UnitMode' ||
    type === 'UnitOverlay' ||
    type === 'StateSet' ||
    type === 'StateEnd' ||
    type === 'StatSet' ||
    type === 'UnitReassign' ||
    type === 'SkillCast' ||
    type === 'UnitSkillEvent'
  ) {
    if (uType !== 'monster' && uType !== 1) {
      return false
    }
    return !isMercOrPet()
  }
  if (type === 'UnitAssign') {
    if (ev.isSelf) return false
    if (uType === 'monster' || uType === 1) {
      return !isMercOrPet()
    }
    return (
      uType === 'object' ||
      uType === 2 ||
      uType === 'missile' ||
      uType === 3 ||
      uType === 'tile' ||
      uType === 5
    )
  }
  if (type === 'UnitRemove') {
    if (uType === 'monster' || uType === 1) {
      return !isMercOrPet()
    }
    if (uType === 'object' || uType === 2) {
      return !model.world.npcInteraction.stashOpen && model.hudManager?.leftPanel !== 'stash'
    }
    return (
      uType === 'missile' ||
      uType === 3 ||
      uType === 'item' ||
      uType === 4 ||
      uType === 'tile' ||
      uType === 5
    )
  }
  return false
}

export function isFastPathVitalsEventImpl(
  model: any,
  ev:
    | {
        readonly type?: string | undefined
        readonly stat?: number | undefined
        readonly value?: number | undefined
        readonly life?: number | undefined
        readonly at?: { readonly x?: number | undefined; readonly y?: number | undefined } | undefined
        readonly unit?: { readonly unitType?: unknown; readonly id?: number | undefined } | undefined
      }
    | undefined,
): boolean {
  if (!ev) return false
  const hud = model.hudManager
  if (!hud || hud.maxHp <= 0) return false
  if (model.world.isDead || Boolean((hud as { isDead?: boolean }).isDead)) {
    return false
  }
  if (ev.type === 'LifeMana') {
    if ((ev.life ?? model.world.self.life) <= 0) return false
    const moved = Boolean(ev.at && ((ev.at.x ?? 0) !== 0 || (ev.at.y ?? 0) !== 0))
    if (
      moved &&
      (model.world.npcInteraction.npcId !== null ||
        Boolean(hud.worldPanels.npcMenu) ||
        hud.overheadSpeechBubbles.length > 0)
    ) {
      return false
    }
    return true
  }
  if (ev.type === 'StatSet') {
    const isSelfUnit =
      !ev.unit ||
      ((ev.unit.unitType === 'player' || ev.unit.unitType === 0) &&
        (ev.unit.id === model.world.selfId || model.world.selfId === 0))
    if (!isSelfUnit) return false
    const stat = ev.stat
    if (stat === 6) {
      if ((ev.value ?? 0) <= 0) return false
      return true
    }
    return stat === 8 || stat === 10 || stat === 26 || stat === 74
  }
  return false
}

export function syncVitalsFromWorldImpl(model: any): void {
  const hud = model.hudManager
  if (!hud) return
  const self = model.world.self
  const stats = self.stats
  if (self.charClass === null) {
    hud.maxHp = self.maxLife
    hud.maxMana = self.maxMana
    hud.maxStamina = self.maxStamina
  }
  const maxHp = hud.maxHp > 0 ? hud.maxHp : self.maxLife
  const maxMana = hud.maxMana > 0 ? hud.maxMana : self.maxMana
  const maxStamina = hud.maxStamina > 0 ? hud.maxStamina : self.maxStamina
  hud.hp = Math.max(0, Math.min(maxHp, self.life))
  hud.mana = Math.max(0, Math.min(maxMana, self.mana))
  if (hud.hotkeys && (self.hasManaState || maxMana > 0 || self.mana > 0)) {
    hud.hotkeys.currentMana = hud.mana
  }
  hud.stamina = Math.max(0, Math.min(maxStamina, self.stamina))
  hud.isStaminaBlue = Boolean(self.states.has(136) || self.states.has(180))
  hud.poisoned = self.states.has(2 /* STATE_POISON */)
  hud.healthPotActive = self.states.has(100 /* STATE_HEALTHPOT */)
  hud.potionLifePercent = stats.getBase(74 /* STAT_HPREGEN */)
  hud.manaPotActive = self.states.has(106 /* STATE_MANAPOT */)
  hud.potionManaPercent = stats.getBase(26 /* STAT_MANARECOVERY */)
  ;(hud as any).isDead = model.world.isDead
  ;(hud.worldPanels as any).isDead = model.world.isDead
  hud.syncPublishedState()
}

export function applyQuestEventToPlayerQuestsImpl(
  model: any,
  ev: {
    readonly type?: string | undefined
    readonly source?: number | undefined
    readonly updateType?: number | undefined
    readonly unitId?: number | undefined
    readonly quests?: ArrayLike<number> | undefined
    readonly flags?: ArrayLike<number> | number | undefined
  },
): void {
  if (!ev || ev.type !== 'QuestState') return
  if (ev.source !== undefined && ev.source !== 0x28) return
  if (ev.source === 0x28 && ev.updateType !== undefined && ev.updateType !== 6) {
    const uType = ev.updateType === 4 || ev.updateType === 5 ? 'object' : 'monster'
    if (ev.unitId === undefined || !model.world.getUnit(uType, ev.unitId)) return
  }
  const incoming = (typeof ev.flags === 'object' && ev.flags !== null ? ev.flags : undefined) ?? ev.quests
  if (!incoming) return
  const copy = new Uint16Array(Math.max(48, model._playerQuests.length, incoming.length))
  copy.set(model._playerQuests)
  for (let i = 0; i < incoming.length; i++) {
    copy[i] = (incoming[i] ?? 0) & 0xffff
  }
  model._playerQuests = copy
}

export function syncFromWorldImpl(model: any, hud: HudManager): void {
  const self = model.world.self
  const stats = self.stats

  // 0. Class: not ready until the server assigns it. No class-dependent panel state is synthesized before that.
  if (self.charClass !== null) {
    hud.setCharacterClass(resolveClassCode(self.charClass))
    const classNames = CLASS_ID_TO_NAMES[self.charClass as keyof typeof CLASS_ID_TO_NAMES]
    hud.charSheet.attrs.classNameEn = classNames.en
    hud.charSheet.attrs.classNameZh = classNames.zh
  }
  // #940 R2: mirror the container revision so the HUD repaint skip-gate can
  // tell "nothing any drawer reads has changed" without walking containers.
  hud.hudRevision =
    (model.world.containers as { hudRevision?: number }).hudRevision ??
    (model.world.containers as { revision?: number }).revision ??
    -1
  hud.inventory.updatePlayerContext({
    level: self.level,
    str: stats.get(D2StatId.Strength),
    dex: stats.get(D2StatId.Dexterity),
    classCode: self.charClass !== null ? resolveClassCode(self.charClass) : undefined,
  })

  // 1. Vitals (globes & stamina bar): verbatim server values (0x18 / 0x95 / stats 6-11), absent = 0.
  hud.maxHp = self.maxLife
  hud.hp = Math.max(0, Math.min(self.maxLife, self.life))
  hud.maxMana = self.maxMana
  hud.mana = Math.max(0, Math.min(self.maxMana, self.mana))
  if (hud.hotkeys && (self.hasManaState || self.maxMana > 0 || self.mana > 0)) {
    hud.hotkeys.currentMana = hud.mana
  }
  hud.maxStamina = self.maxStamina
  hud.stamina = Math.max(0, Math.min(self.maxStamina, self.stamina))
  hud.isStaminaBlue = Boolean(self.states.has(136) || self.states.has(180))
  hud.poisoned = self.states.has(2 /* STATE_POISON */)
  hud.healthPotActive = self.states.has(100 /* STATE_HEALTHPOT */)
  hud.potionLifePercent = stats.getBase(74 /* STAT_HPREGEN */)
  hud.manaPotActive = self.states.has(106 /* STATE_MANAPOT */)
  hud.potionManaPercent = stats.getBase(26 /* STAT_MANARECOVERY */)

  // 2. Gold (stat 14 inventory gold, stat 15 stash gold).
  hud.inventory.gold = stats.get(D2StatId.Gold)
  hud.worldPanels.stashGold = stats.get(D2StatId.GoldBank)

  // 3. Containers (equipment, inventory, stash, cube, belt, cursor, merc equipment, trade items):
  // #940: Only rebuild container arrays/maps when container revision, in-place item digest,
  // player level, weapon swap set, artisan slot state, or store state actually changed.
  const containersRev =
    (model.world.containers as { hudRevision?: number; revision?: number }).hudRevision ??
    (model.world.containers as { revision?: number }).revision ??
    -1
  const containersDigest = model.computeHudContainersDigest()
  const isArtisanPanelOpen =
    hud.leftPanel === 'imbue' ||
    hud.leftPanel === 'add_sockets' ||
    hud.leftPanel === 'personalize' ||
    hud.leftPanel === 'orifice' ||
    (hud.worldPanels as any).activePanel === 'imbue' ||
    (hud.worldPanels as any).activePanel === 'add_sockets' ||
    (hud.worldPanels as any).activePanel === 'personalize' ||
    (hud.worldPanels as any).activePanel === 'orifice'
  const activeSlotItem = (hud.worldPanels as any).questRewardItem as UiInventoryItem | null
  const questRewardId = activeSlotItem ? activeSlotItem.id : null
  const npcInteractionForContainers = model.world.npcInteraction
  const npcWinForContainers = (
    npcInteractionForContainers.window !== 'none'
      ? npcInteractionForContainers.window
      : (npcInteractionForContainers.activeWindow ?? 'none')
  ) as string
  const storeOpen =
    npcInteractionForContainers.npcId !== null &&
    (npcWinForContainers === 'trade' || npcWinForContainers === 'gamble')
  const containersDirty =
    model.lastSyncedHudRef !== hud ||
    containersRev < 0 ||
    containersRev !== model.lastSyncedContainersRev ||
    containersDigest !== model.lastSyncedContainersDigest ||
    self.level !== model.lastSyncedPlayerLevel ||
    self.weaponSet !== model.lastSyncedWeaponSet ||
    isArtisanPanelOpen !== model.lastSyncedArtisanOpen ||
    questRewardId !== model.lastSyncedQuestRewardId ||
    storeOpen !== model.lastSyncedStoreOpen ||
    hud.inventory.gridItems !== model.lastSyncedGridItemsRef ||
    hud.worldPanels.stashItems !== model.lastSyncedStashItemsRef ||
    hud.worldPanels.cubeItems !== model.lastSyncedCubeItemsRef ||
    hud.inventory.cursorItem !== model.lastSyncedCursorItemRef ||
    model.cachedMercEquipped === null ||
    model.cachedMercEquipment === null

  if (containersDirty) {
    hud.inventory.weaponSwapSet = self.weaponSet === 1 ? 1 : 0
    for (const key of Object.keys(hud.inventory.equipped) as EquipSlotId[]) {
      delete hud.inventory.equipped[key]
    }
    hud.inventory.swapWeapons.weapon1 = null
    hud.inventory.swapWeapons.weapon2 = null
    for (const item of model.world.containers.equipment.values()) {
      const bodyLoc = item.bodyLoc || item.equippedSlot
      if (bodyLoc === 11) {
        hud.inventory.swapWeapons.weapon1 = model.toUiItem(item)
        continue
      }
      if (bodyLoc === 12) {
        hud.inventory.swapWeapons.weapon2 = model.toUiItem(item)
        continue
      }
      const slot = BODY_LOC_TO_EQUIP_SLOT[bodyLoc]
      if (slot) {
        hud.inventory.equipped[slot] = model.toUiItem(item)
      }
    }

    const placements: GridPlacement[] = [...model.world.containers.inventory.values()].map((item: ItemData) => ({
      item: model.toUiItem(item),
      col: item.gridX ?? item.x ?? 0,
      row: item.gridY ?? item.y ?? 0,
    }))
    hud.inventory.gridItems = placements
    model.lastSyncedGridItemsRef = placements
    model.lastSyncedVendorKey = null
  }

  // 4. Character Sheet attributes (server StatList + equipped armor & charm defense; absent stat = 0 in 1.13c).
  const attrs = hud.charSheet.attrs
  attrs.name = self.name
  attrs.level = self.level
  attrs.xp = self.experience
  attrs.nextLevelXp = nextLevelExperience(self.level)

  const predSnap = model.predictor?.getSnapshot()
  const isActivelyRunning = Boolean(
    (self.moving &&
      self.mode !== 2 &&
      (self.mode === 3 ||
        (model.hudManager ? model.hudManager.isRunning : self.runMode) ||
        self.mode === 1)) ||
      (predSnap?.moving && predSnap.running),
  )
  const combatStatRev =
    (stats as { combatRevision?: number; revision?: number }).combatRevision ??
    (stats as { revision?: number }).revision ??
    -1
  const statesAndSkillsHash = hashPlayerSkillsAndStates(self, model.world.skillHotkeys)
  const eqW1 = hud.inventory.equipped.weapon1
  const eqW2 = hud.inventory.equipped.weapon2
  const combatSkillsDirty =
    containersDirty ||
    model.lastCombatSyncedHudRef !== hud ||
    combatStatRev < 0 ||
    model.lastCombatSyncedStatRev !== combatStatRev ||
    model.lastCombatSyncedCharClass !== self.charClass ||
    model.lastCombatSyncedLevel !== self.level ||
    model.lastCombatSyncedMaxLife !== self.maxLife ||
    model.lastCombatSyncedMaxMana !== self.maxMana ||
    model.lastCombatSyncedMaxStamina !== self.maxStamina ||
    model.lastCombatSyncedWeaponSet !== self.weaponSet ||
    model.lastCombatSyncedLeftSkill !== self.leftSkill ||
    model.lastCombatSyncedRightSkill !== self.rightSkill ||
    model.lastCombatSyncedDifficulty !== model.world.difficulty ||
    model.lastCombatSyncedRunning !== isActivelyRunning ||
    model.lastCombatSyncedLang !== hud.charSheet.lang ||
    model.lastCombatSyncedStatesSkillsHash !== statesAndSkillsHash ||
    model.lastCombatSyncedEqW1 !== eqW1 ||
    model.lastCombatSyncedEqW2 !== eqW2 ||
    hud.hotkeys.leftSkillId !== self.leftSkill ||
    hud.hotkeys.rightSkillId !== self.rightSkill ||
    hud.skillTree.characterLevel !== self.level ||
    hud.skillTree.unspentSkillPoints !== stats.get(D2StatId.NewSkills) ||
    (self.skillEntries.size > 0 && hud.hotkeys.availableSkills.length === 0)

  if (!combatSkillsDirty) {
    if (self.charClass !== null) {
      const hpBase = (attrs.maxHp ?? 0) > 0 ? (attrs.maxHp ?? self.maxLife) : self.maxLife
      const manaBase = (attrs.maxMana ?? -1) >= 0 ? (attrs.maxMana ?? self.maxMana) : self.maxMana
      const stamBase = (attrs.maxStamina ?? -1) >= 0 ? (attrs.maxStamina ?? self.maxStamina) : self.maxStamina
      hud.maxHp = hpBase
      hud.hp = Math.max(0, Math.min(hpBase, self.life))
      hud.maxMana = manaBase
      hud.mana = Math.max(0, Math.min(manaBase, self.mana))
      hud.maxStamina = stamBase
      hud.stamina = Math.max(0, Math.min(stamBase, self.stamina))
    }
    if (self.states.has(121)) {
      const remMs =
        model.world.getSkillCooldownRemainingMs(self.rightSkill) ||
        model.world.getSkillCooldownRemainingMs(self.leftSkill) ||
        1000
      hud.hotkeys.setGlobalSkillDelay(remMs)
    } else {
      hud.hotkeys.setGlobalSkillDelay(0)
    }
  } else {
  attrs.str = stats.get(D2StatId.Strength)
  attrs.baseStr = stats.getBase(D2StatId.Strength)
  attrs.dex = stats.get(D2StatId.Dexterity)
  attrs.baseDex = stats.getBase(D2StatId.Dexterity)
  attrs.vit = stats.get(D2StatId.Vitality)
  attrs.baseVit = stats.getBase(D2StatId.Vitality)
  attrs.ene = stats.get(D2StatId.Energy)
  attrs.baseEne = stats.getBase(D2StatId.Energy)
  attrs.statPoints = stats.get(D2StatId.StatPts)
  const rawBaseMaxHp = stats.getBase(D2StatId.MaxHp)
  attrs.baseMaxHp = rawBaseMaxHp > 0 ? Math.floor(rawBaseMaxHp / 256) : self.maxLife
  const rawBaseMaxMana = stats.getBase(D2StatId.MaxMana)
  attrs.baseMaxMana = rawBaseMaxMana > 0 ? Math.floor(rawBaseMaxMana / 256) : self.maxMana
  const rawBaseMaxStamina = stats.getBase(D2StatId.MaxStamina)
  attrs.baseMaxStamina = rawBaseMaxStamina > 0 ? Math.floor(rawBaseMaxStamina / 256) : self.maxStamina

  const classCode = self.charClass === null ? null : resolveClassCode(self.charClass)
  if (self.charClass !== null) {
    const selfColorFlags = stateColorFlags(self.states)
    const hardSkillLevels = new Map<number, number>()
    for (const [id, lvl] of self.skills.entries()) {
      if (lvl > 0) hardSkillLevels.set(id, lvl)
    }
    for (const [id, sl] of self.skillEntries.entries()) {
      const b = Math.max(0, Number((sl as any).baseLevel ?? sl.level ?? 0))
      if (b > 0) hardSkillLevels.set(id, b)
      else hardSkillLevels.delete(id)
    }
    const playerAgg = aggregateUnit({
      kind: 'player',
      stats: self.stats,
      level: self.level > 0 ? self.level : undefined,
      activeStates: self.states,
      classId: self.charClass!,
      hardSkillLevels,
      containers: model.world.containers,
    })

    const tot = (id: number) => playerAgg.total(id)
    const wost = (id: number) => playerAgg.withoutStates(id)
    const base = (id: number) => (typeof playerAgg.base === 'function' ? playerAgg.base(id) : ((self as any).stats?.getBase?.(id) ?? tot(id)))

    attrs.str = tot(0)
    attrs.baseStr = base(0)
    attrs.dex = tot(2)
    attrs.baseDex = base(2)
    attrs.vit = tot(3)
    attrs.baseVit = base(3)
    attrs.ene = tot(1)
    attrs.baseEne = base(1)

    const baseRawHp = base(7)
    attrs.baseMaxHp = baseRawHp > 0 ? Math.floor(baseRawHp / 256) : self.maxLife
    const hpBase =
      baseRawHp > 0
        ? Math.max(1, Math.floor(tot(7) / 256))
        : self.maxLife + Math.max(0, Math.floor(tot(7) / 256))
    attrs.maxHp = hpBase
    const baseRawMana = base(9)
    attrs.baseMaxMana = baseRawMana > 0 ? Math.floor(baseRawMana / 256) : self.maxMana
    const manaBase =
      baseRawMana > 0
        ? Math.max(0, Math.floor(tot(9) / 256))
        : self.maxMana + Math.max(0, Math.floor(tot(9) / 256))
    attrs.maxMana = manaBase
    const baseRawStamina = base(11)
    attrs.baseMaxStamina = baseRawStamina > 0 ? Math.floor(baseRawStamina / 256) : self.maxStamina
    const stamBase =
      baseRawStamina > 0
        ? Math.max(0, Math.floor(tot(11) / 256))
        : self.maxStamina + Math.max(0, Math.floor(tot(11) / 256))
    attrs.maxStamina = stamBase

    // 1.13c D2Client.dll 0x6fad7bd0 (DrawLifeGlobe -> D2Common #10913 GetMaxLifeFromUnit),
    // 0x6fad7a90 (DrawManaGlobe -> D2Common #10186 GetMaxManaFromUnit), and stamina bar
    // (D2Common #10578 GetMaxStaminaFromUnit): bottom globes and runtime vitals read the same
    // StatOpEngine unit-aggregated maximums as the Character Sheet (never unequipped base stats).
    hud.maxHp = hpBase
    hud.hp = Math.max(0, Math.min(hpBase, self.life))
    hud.maxMana = manaBase
    hud.mana = Math.max(0, Math.min(manaBase, self.mana))
    hud.maxStamina = stamBase
    hud.stamina = Math.max(0, Math.min(stamBase, self.stamina))

    const finalBaseDef = tot(31) + Math.floor(attrs.dex / 4)

    let injectedSkinArmorPct = 0
    if (self.states.has(101)) {
      const list = self.stats.getStateStats(101) || []
      const lvl = list.find((s: any) => s.statId === 351)?.value || self.skillEntries?.get(117)?.level || 1
      const dLvl = self.skillEntries?.get(104)?.baseLevel || 0
      injectedSkinArmorPct = 25 + 15 * (lvl - 1) + dLvl * 15
    }

    const hasShield = playerAgg.equipment.some((x) => x.bodyLoc === 5)
    if (!hasShield && self.states.has(101) && self.charClass === 3) injectedSkinArmorPct = 0
    const totalPct = injectedSkinArmorPct + tot(171)
    const overridePct = tot(182)

    let finalDef = finalBaseDef + Math.trunc((finalBaseDef * totalPct) / 100)
    if (overridePct < 0) {
      finalDef = finalDef + Math.trunc((finalDef * overridePct) / 100)
    }
    if (isActivelyRunning) finalDef = 0
    attrs.defense = Math.max(0, finalDef)

    attrs.defenseColor = selfColorFlags.has('armblue') ? 'blue' : selfColorFlags.has('armred') ? 'red' : 'white'
    attrs.baseDefense = wost(31) + Math.floor((attrs.baseDex ?? 0) / 4)

    const diffPenalty = model.world.difficulty === 2 ? -100 : model.world.difficulty === 1 ? -40 : 0
    attrs.maxFireRes = Math.min(95, 75 + tot(40))
    attrs.maxLightRes = Math.min(95, 75 + tot(42))
    attrs.maxColdRes = Math.min(95, 75 + tot(44))
    attrs.maxPoisonRes = Math.min(95, 75 + tot(46))

    attrs.fireRes = Math.max(-100, Math.min(tot(39) + diffPenalty, attrs.maxFireRes))
    attrs.coldRes = Math.max(-100, Math.min(tot(43) + diffPenalty, attrs.maxColdRes))
    attrs.lightRes = Math.max(-100, Math.min(tot(41) + diffPenalty, attrs.maxLightRes))
    attrs.poisRes = Math.max(-100, Math.min(tot(45) + diffPenalty, attrs.maxPoisonRes))
    attrs.uncappedFireRes = tot(39) + diffPenalty
    attrs.uncappedColdRes = tot(43) + diffPenalty
    attrs.uncappedLightRes = tot(41) + diffPenalty
    attrs.uncappedPoisonRes = tot(45) + diffPenalty
    attrs.poisonLengthPct = Math.max(25, 100 - diffPenalty - tot(110))
    attrs.curseRes = tot(109)
    attrs.maxCurseRes = 50
    attrs.curseLengthPct = Math.max(25, 100 - tot(109))
    attrs.baseFireRes = wost(39) + diffPenalty
    attrs.baseColdRes = wost(43) + diffPenalty
    attrs.baseLightRes = wost(41) + diffPenalty
    attrs.basePoisonRes = wost(45) + diffPenalty

    const setAttrColor = (stat: number, isBaseAttr: boolean): 'blue' | 'red' | 'white' => {
      const t = tot(stat)
      const w = isBaseAttr ? base(stat) : wost(stat)
      return t > w ? 'blue' : t < w ? 'red' : 'white'
    }

    attrs.fireResColor = selfColorFlags.has('rfred') ? 'red' : selfColorFlags.has('rfblue') ? 'blue' : undefined
    attrs.coldResColor = selfColorFlags.has('rcred') ? 'red' : selfColorFlags.has('rcblue') ? 'blue' : undefined
    attrs.lightResColor = selfColorFlags.has('rlred') ? 'red' : selfColorFlags.has('rlblue') ? 'blue' : undefined
    attrs.poisResColor = selfColorFlags.has('rpred') ? 'red' : selfColorFlags.has('rpblue') ? 'blue' : undefined
    attrs.strColor = setAttrColor(0, true)
    attrs.dexColor = setAttrColor(2, true)
    attrs.vitColor = setAttrColor(3, true)
    attrs.eneColor = setAttrColor(1, true)
    attrs.maxHpColor = setAttrColor(7, true)
    attrs.maxManaColor = setAttrColor(9, true)
    attrs.maxStaminaColor = setAttrColor(11, true)

    const buildArm = (loc: number): any => {
      const e = playerAgg.equipment.find((x) => x.bodyLoc === loc)
      if (!e) return null
      let weapon = null
      if (e.baseTable === 'weapons') {
        const r = e.row
        weapon = {
          code: e.item.code,
          minDam: Number(r.text('mindam')) || 0,
          maxDam: Number(r.text('maxdam')) || 0,
          twoHandMinDam: Number(r.text('2handmindam')) || 0,
          twoHandMaxDam: Number(r.text('2handmaxdam')) || 0,
          minMisDam: Number(r.text('minmisdam')) || 0,
          maxMisDam: Number(r.text('maxmisdam')) || 0,
          strBonus: Number(r.text('StrBonus')) || 0,
          dexBonus: Number(r.text('DexBonus')) || 0,
          twoHanded: r.text('2handed') === '1',
          oneOrTwoHanded: r.text('1or2handed') === '1',
          throwable:
            itemCodeIsA(e.item.code, 'tpot') ||
            itemCodeIsA(e.item.code, 'taxe') ||
            itemCodeIsA(e.item.code, 'tkni') ||
            itemCodeIsA(e.item.code, 'jave'),
          weaponClass: r.text('wclass'),
        }
      }
      return {
        weapon,
        component: loc === 4 ? 5 : loc === 5 ? 6 : 7,
        ethereal: Boolean(e.item.ethereal || (e.item.rawFlags && e.item.rawFlags & 0x400000)),
        canBeEquipped: true,
        isType: (tc: string) => itemCodeIsA(e.item.code, tc),
        localRaw: (statId: number) => {
          let sum = 0
          for (const st of e.localStats) {
            if (st.statId === statId && (st.param ?? 0) === 0) sum += st.value
          }
          return sum
        },
      }
    }

    const getHardLvl = (id: number): number => {
      const entry = self.skillEntries?.get(id)
      if (entry !== undefined) {
        return Math.max(0, Number(entry.baseLevel ?? entry.level ?? 0))
      }
      return Math.max(0, Number(self.skills?.get(id) ?? 0))
    }

    const isGenericAttackSkill = (id: number): boolean =>
      id === 0 || id === 1 || id === 2 || id === 4 || id === 5

    const resolveEffectiveSkillLvl = (id: number): number => {
      if (isGenericAttackSkill(id)) return 1
      const sl = playerAgg.effectiveSkillLevel(id)
      const serverBonus = Number(self.skillEntries?.get(id)?.bonus ?? 0)
      return Math.max(sl.effective ?? 0, (sl.hard ?? 0) + Math.max(0, serverBonus))
    }

    const buildSkill = (skillId: number): any => {
      const lvl = resolveEffectiveSkillLvl(skillId)
      const def = SKILLS_BY_ID[skillId] as any
      const meta = getSkillTableMeta(skillId)
      let toHitPercent =
        lvl > 0 && def && typeof def.toHit === 'number'
          ? def.toHit + (lvl - 1) * (typeof def.toHitLev === 'number' ? def.toHitLev : 0)
          : 0
      let damagePercent = 0
      let skillPhysical256 = { min: 0, max: 0 }
      let flatPhysMin = 0
      let flatPhysMax = 0
      let skillElemMin = 0
      let skillElemMax = 0
      let skillElemType: string | undefined = undefined
      let magicConversionPct = 0

      if (lvl > 0) {
        if (skillId === 6) {
          // #6 Magic Arrow: +10 + 9*(lvl-1)% AR, +lvl flat physical damage
          toHitPercent = 10 + 9 * (lvl - 1)
          flatPhysMin = lvl
          flatPhysMax = lvl
          skillPhysical256 = { min: lvl << 8, max: lvl << 8 }
        } else if (skillId === 7) {
          // #7 Fire Arrow: +10 + 9*(lvl-1)% AR
          toHitPercent = 10 + 9 * (lvl - 1)
        } else if (skillId === 10) {
          // #10 Jab: +10 + 9*(lvl-1)% AR, -15 + 3*(lvl-1)% ED
          toHitPercent = 10 + 9 * (lvl - 1)
          damagePercent = 3 * (lvl - 1) - 15
        } else if (skillId === 11) {
          // #11 Cold Arrow: +10 + 9*(lvl-1)% AR
          toHitPercent = 10 + 9 * (lvl - 1)
        } else if (skillId === 14) {
          // #14 Power Strike: +20 + 18*(lvl-1)% AR
          toHitPercent = 20 + 18 * (lvl - 1)
        } else if (skillId === 16) {
          // #16 Exploding Arrow: +20 + 9*(lvl-1)% AR
          toHitPercent = 20 + 9 * (lvl - 1)
        } else if (skillId === 19) {
          // #19 Impale: +100 + 25*(lvl-1)% AR, +300 + 25*(lvl-1)% ED
          toHitPercent = 100 + 25 * (lvl - 1)
          damagePercent = 300 + 25 * (lvl - 1)
        } else if (skillId === 21) {
          // #21 Ice Arrow: +20 + 9*(lvl-1)% AR
          toHitPercent = 20 + 9 * (lvl - 1)
        } else if (skillId === 22) {
          // #22 Guided Arrow: +5*(lvl-1)% ED
          damagePercent = 5 * (lvl - 1)
        } else if (skillId === 24) {
          // #24 Charged Strike: weapon melee + charged bolts
          toHitPercent = 0
        } else if (skillId === 25) {
          // #25 Plague Javelin: +30 + 9*(lvl-1)% AR
          toHitPercent = 30 + 9 * (lvl - 1)
        } else if (skillId === 26) {
          // #26 Strafe: +5*lvl % ED (srcDam = 96)
          damagePercent = 5 * lvl
        } else if (skillId === 27) {
          // #27 Immolation Arrow: +30 + 9*(lvl-1)% AR
          toHitPercent = 30 + 9 * (lvl - 1)
        } else if (skillId === 30) {
          // #30 Fend: +40 + 10*(lvl-1)% AR, +70 + 10*(lvl-1)% ED
          toHitPercent = 40 + 10 * (lvl - 1)
          damagePercent = 70 + 10 * (lvl - 1)
        } else if (skillId === 31) {
          // #31 Freezing Arrow: +40 + 9*(lvl-1)% AR
          toHitPercent = 40 + 9 * (lvl - 1)
        } else if (skillId === 34 || skillId === 35) {
          // #34 Lightning Strike / #35 Lightning Fury
          toHitPercent = 0
        } else if (skillId === 73) {
          // #73 Poison Dagger: +30 + 20*(lvl-1)% AR
          toHitPercent = 30 + 20 * (lvl - 1)
        } else if (skillId === 96) {
          // #96 Sacrifice: +20 + 7*(lvl-1)% AR, +180 + 15*(lvl-1) + 15*Redemption + 5*Fanaticism % ED
          toHitPercent = 20 + 7 * (lvl - 1)
          damagePercent = 180 + 15 * (lvl - 1) + 15 * getHardLvl(124) + 5 * getHardLvl(122)
        } else if (skillId === 97) {
          // #97 Smite: +15*lvl % ED; shield smite damage + Holy Shield flat damage when state 101 active
          damagePercent = 15 * lvl
          const shieldEq = playerAgg.equipment.find((x) => x.bodyLoc === 5 && x.baseTable === 'armor')
          const shMin = shieldEq ? Number(shieldEq.row.text('mindam')) || 0 : 0
          const shMax = shieldEq ? Number(shieldEq.row.text('maxdam')) || 0 : 0
          let hsMin = 0
          let hsMax = 0
          if (self.states.has(101)) {
            const list101 = self.stats.getStateStats(101) || []
            const hsLvl = Math.max(
              1,
              list101.find((s: any) => s.statId === 351)?.value ||
                resolveEffectiveSkillLvl(117) ||
                1,
            )
            // Holy Shield 5-band Smite bonus: base (2, 5), bands (+1, +2, +3, +4, +4)
            const bandAdd =
              Math.min(Math.max(0, hsLvl - 1), 7) * 1 +
              Math.min(Math.max(0, hsLvl - 8), 8) * 2 +
              Math.min(Math.max(0, hsLvl - 16), 6) * 3 +
              Math.min(Math.max(0, hsLvl - 22), 6) * 4 +
              Math.max(0, hsLvl - 28) * 4
            hsMin = 2 + bandAdd
            hsMax = 5 + bandAdd
          }
          if (shMin > 0 || shMax > 0 || hsMin > 0 || hsMax > 0) {
            skillPhysical256 = { min: (shMin + hsMin) << 8, max: (shMax + hsMax) << 8 }
          }
        } else if (skillId === 106) {
          // #106 Zeal: +10*lvl % AR, +6*max(0, lvl-4) + 12*Sacrifice % ED
          toHitPercent = 10 * lvl
          damagePercent = (lvl > 4 ? 6 * (lvl - 4) : 0) + 12 * getHardLvl(96)
        } else if (skillId === 107) {
          // #107 Charge: +50 + 15*(lvl-1)% AR, +100 + 25*(lvl-1) + 20*(Vigor + Might) % ED
          toHitPercent = 50 + 15 * (lvl - 1)
          damagePercent = 100 + 25 * (lvl - 1) + 20 * (getHardLvl(115) + getHardLvl(98))
        } else if (skillId === 111) {
          // #111 Vengeance: +20 + 10*(lvl-1)% AR, tri-elemental % of base weapon damage
          toHitPercent = 20 + 10 * (lvl - 1)
          const baseElem = 70 + 6 * (lvl - 1)
          const salvSynergy = 2 * getHardLvl(125)
          const firePct = baseElem + 10 * getHardLvl(100) + salvSynergy
          const coldPct = baseElem + 10 * getHardLvl(105) + salvSynergy
          const ltngPct = baseElem + 10 * getHardLvl(110) + salvSynergy
          damagePercent = firePct + coldPct + ltngPct
        } else if (skillId === 116) {
          // #116 Conversion: melee attack (SrcDam=128)
          toHitPercent = 0
          damagePercent = 0
        } else if (skillId === 126) {
          // #126 Bash: +20 + 5*(lvl-1) + 5*Concentrate % AR, +50 + 5*(lvl-1) + 5*Stun % ED, +lvl flat phys
          toHitPercent = 20 + 5 * (lvl - 1) + 5 * getHardLvl(144)
          damagePercent = 50 + 5 * (lvl - 1) + 5 * getHardLvl(139)
          skillPhysical256 = { min: lvl << 8, max: lvl << 8 }
        } else if (skillId === 133) {
          // #133 Double Swing: +15 + 5*(lvl-1)% AR, +10*Bash % ED
          toHitPercent = 15 + 5 * (lvl - 1)
          damagePercent = 10 * getHardLvl(126)
        } else if (skillId === 139) {
          // #139 Stun: +15 + 5*(lvl-1) + 5*Concentrate % AR, +8*Bash % ED
          toHitPercent = 15 + 5 * (lvl - 1) + 5 * getHardLvl(144)
          damagePercent = 8 * getHardLvl(126)
        } else if (skillId === 140) {
          // #140 Double Throw: +20 + 10*(lvl-1)% AR, +8*Double Swing % ED
          toHitPercent = 20 + 10 * (lvl - 1)
          damagePercent = 8 * getHardLvl(133)
        } else if (skillId === 143) {
          // #143 Leap Attack: +50 + 15*(lvl-1)% AR, +100 + 30*(lvl-1) + 10*Leap % ED
          toHitPercent = 50 + 15 * (lvl - 1)
          damagePercent = 100 + 30 * (lvl - 1) + 10 * getHardLvl(132)
        } else if (skillId === 144) {
          // #144 Concentrate: +60 + 10*(lvl-1)% AR, +70 + 5*(lvl-1) + 5*Bash + 10*Battle Orders % ED, +1*Berserk % magic conv
          toHitPercent = 60 + 10 * (lvl - 1)
          damagePercent = 70 + 5 * (lvl - 1) + 5 * getHardLvl(126) + 10 * getHardLvl(149)
          magicConversionPct = Math.min(100, getHardLvl(152))
        } else if (skillId === 147) {
          // #147 Frenzy: +100 + 7*(lvl-1)% AR, +90 + 5*(lvl-1) + 8*(Double Swing + Taunt) % ED, +1*Berserk % magic conv
          toHitPercent = 100 + 7 * (lvl - 1)
          damagePercent = 90 + 5 * (lvl - 1) + 8 * (getHardLvl(133) + getHardLvl(137))
          magicConversionPct = Math.min(100, getHardLvl(152))
        } else if (skillId === 151) {
          // #151 Whirlwind: +5*(lvl-1)% AR, -50 + 8*(lvl-1) % ED
          toHitPercent = 5 * (lvl - 1)
          damagePercent = -50 + 8 * (lvl - 1)
        } else if (skillId === 152) {
          // #152 Berserk: +100 + 15*(lvl-1)% AR, +150 + 15*(lvl-1) + 10*(Howl + Shout) % ED, 100% magic conv
          toHitPercent = 100 + 15 * (lvl - 1)
          damagePercent = 150 + 15 * (lvl - 1) + 10 * (getHardLvl(130) + getHardLvl(138))
          magicConversionPct = 100
        } else if (skillId === 232) {
          // #232 Feral Rage: +20 + 10*(lvl-1)% AR, +50 + 5*(lvl-1)% ED
          toHitPercent = 20 + 10 * (lvl - 1)
          damagePercent = 50 + 5 * (lvl - 1)
        } else if (skillId === 233) {
          // #233 Maul: +20 + 10*(lvl-1)% AR (charge ED comes from state 117)
          toHitPercent = 20 + 10 * (lvl - 1)
        } else if (skillId === 238) {
          // #238 Rabies: +50 + 7*(lvl-1)% AR
          toHitPercent = 50 + 7 * (lvl - 1)
        } else if (skillId === 239) {
          // #239 Fire Claws: +50 + 15*(lvl-1)% AR
          toHitPercent = 50 + 15 * (lvl - 1)
        } else if (skillId === 242) {
          // #242 Hunger: +50 + 10*(lvl-1)% AR, -75% ED (Skills.txt par1=-75)
          toHitPercent = 50 + 10 * (lvl - 1)
          damagePercent = -75
        } else if (skillId === 248) {
          // #248 Fury: +50 + 7*(lvl-1)% AR, +100 + 17*(lvl-1)% ED
          toHitPercent = 50 + 7 * (lvl - 1)
          damagePercent = 100 + 17 * (lvl - 1)
        } else if (skillId === 254) {
          // #254 Tiger Strike: +15 + 7*(lvl-1)% AR (charge ED comes from state 147 on finisher release)
          toHitPercent = 15 + 7 * (lvl - 1)
          damagePercent = 0
        } else if (skillId === 255) {
          // #255 Dragon Talon: +20 + 35*(lvl-1)% AR, +5 + 7*(lvl-1)% Kick ED
          toHitPercent = 20 + 35 * (lvl - 1)
          damagePercent = 5 + 7 * (lvl - 1)
        } else if (skillId === 259) {
          // #259 Fists of Fire: +15 + 7*(lvl-1)% AR
          toHitPercent = 15 + 7 * (lvl - 1)
          damagePercent = 0
        } else if (skillId === 260) {
          // #260 Dragon Claw: +40 + 25*(lvl-1)% AR, +50 + 5*(lvl-1) + 4*ClawMastery.blvl % ED
          toHitPercent = 40 + 25 * (lvl - 1)
          damagePercent = 50 + 5 * (lvl - 1) + 4 * getHardLvl(252)
        } else if (skillId === 265) {
          // #265 Cobra Strike: +15 + 7*(lvl-1)% AR
          toHitPercent = 15 + 7 * (lvl - 1)
          damagePercent = 0
        } else if (skillId === 269) {
          // #269 Claws of Thunder: +15 + 7*(lvl-1)% AR
          toHitPercent = 15 + 7 * (lvl - 1)
          damagePercent = 0
        } else if (skillId === 270) {
          // #270 Dragon Tail: +20 + 15*(lvl-1)% AR, +50 + 10*(lvl-1)% Fire Explosion (kick physical ED = 0)
          toHitPercent = 20 + 15 * (lvl - 1)
          damagePercent = 50 + 10 * (lvl - 1)
        } else if (skillId === 274) {
          // #274 Blades of Ice: +15 + 7*(lvl-1)% AR
          toHitPercent = 15 + 7 * (lvl - 1)
          damagePercent = 0
        } else if (skillId === 275) {
          // #275 Dragon Flight: +60 + 25*(lvl-1)% AR, +100 + 25*(lvl-1)% Kick ED
          toHitPercent = 60 + 25 * (lvl - 1)
          damagePercent = 100 + 25 * (lvl - 1)
        } else if (skillId === 280) {
          // #280 Phoenix Strike: +15 + 7*(lvl-1)% AR
          toHitPercent = 15 + 7 * (lvl - 1)
          damagePercent = 0
        }
      }

      const isKick = skillId === 1 || skillId === 255 || skillId === 270 || skillId === 275
      let srcDam =
        skillId === 12 || skillId === 15 || skillId === 20 || skillId === 26
          ? 96
          : isGenericAttackSkill(skillId) || skillId === 97
            ? 128
            : def
              ? def.srcDamage || 0
              : 0
      if (lvl > 0 && (skillId === 257 || skillId === 266 || skillId === 277) && def) {
        const flatMin = evaluateLevelBand(def.minDam || 0, def.minLevDam || [0, 0, 0, 0, 0], lvl)
        const flatMax = evaluateLevelBand(def.maxDam || 0, def.maxLevDam || [0, 0, 0, 0, 0], lvl)
        flatPhysMin = flatMin
        flatPhysMax = flatMax
        skillPhysical256 = { min: flatMin << 8, max: flatMax << 8 }
        if (skillId === 257 || skillId === 266) {
          const rArm = buildArm(4)
          const lArm = buildArm(5)
          const mainWep = rArm?.weapon ?? lArm?.weapon
          if (mainWep?.twoHanded && !(mainWep.oneOrTwoHanded && rArm?.weapon && lArm?.weapon)) {
            srcDam = Math.floor(srcDam / 2)
          }
        }
      }
      const itypeA1 = meta ? meta.itypea1 || '' : ''
      const isWeapon = isKick || srcDam > 0 || itypeA1 !== ''

      if (isWeapon && lvl > 0 && def) {
        const elemStatMap: Record<string, number> = {
          fire: 329,
          ltng: 330,
          cold: 331,
          pois: 332,
          mag: 357,
        }
        if (skillId === 280) {
          // #280 Phoenix Strike: Charge 1 meteor fire damage + Fists of Fire (#259) 10%/blvl synergy
          const fofSyn = 10 * getHardLvl(259)
          const rawMin = evaluateLevelBand(20, [10, 19, 29, 38, 46], lvl)
          const rawMax = evaluateLevelBand(40, [10, 21, 33, 42, 50], lvl)
          const equipFirePct = playerAgg.flatSum(329, 0, ['item', 'charm', 'state'])
          skillElemMin = Math.floor(
            (Math.floor((rawMin * (100 + fofSyn)) / 100) * (100 + equipFirePct)) / 100,
          )
          skillElemMax = Math.floor(
            (Math.floor((rawMax * (100 + fofSyn)) / 100) * (100 + equipFirePct)) / 100,
          )
          skillElemType = 'fire'
        } else if (def.eType && def.eType !== '') {
          const calcState = createInitialState(
            (resolveClassCode(self.charClass) ?? def.classCode ?? 'ama') as any,
          )
          for (const id of hardSkillLevels.keys()) {
            const h = getHardLvl(id)
            if (h > 0) calcState.hardPoints[id] = h
          }
          const dmg = calculateDetailedDamage(calcState, def, lvl)
          if (dmg.hasDamage && dmg.finalMax > 0) {
            const masteryBonusPct = dmg.masteryMultiplier > 1 ? dmg.masteryBonusPct : 0
            const elemStatId = elemStatMap[def.eType]
            const equipSpellDamagePct =
              elemStatId !== undefined
                ? playerAgg.flatSum(elemStatId, 0, ['item', 'charm', 'state'])
                : 0
            skillElemMin = Math.floor(
              (dmg.withSynergyMin * (100 + masteryBonusPct + equipSpellDamagePct)) / 100,
            )
            skillElemMax = Math.floor(
              (dmg.withSynergyMax * (100 + masteryBonusPct + equipSpellDamagePct)) / 100,
            )
            skillElemType = def.eType
          }
        }
      }

      let spellDamage: { min: number; max: number } | null = null
      let spellBreakdown: CombatSpellDamageBreakdown | null = null
      if (!isWeapon && lvl > 0) {
        if (skillId === 154) {
          // #154 War Cry: 1.13c Skills.txt piecewise physical damage (HitShift=8, +6/+7/+8/+9/+10, +6% per hard level of Howl #130 + Taunt #137 + Battle Cry #146)
          let baseMin = 20
          let baseMax = 30
          for (let i = 2; i <= lvl; i++) {
            const step = i <= 8 ? 6 : i <= 16 ? 7 : i <= 22 ? 8 : i <= 28 ? 9 : 10
            baseMin += step
            baseMax += step
          }
          const synergyPct = 6 * (getHardLvl(130) + getHardLvl(137) + getHardLvl(146))
          const withSynergyMin = Math.floor((baseMin * (100 + synergyPct)) / 100)
          const withSynergyMax = Math.floor((baseMax * (100 + synergyPct)) / 100)
          spellDamage = { min: withSynergyMin, max: withSynergyMax }
          spellBreakdown = {
            spellType: 'physical',
            baseMin,
            baseMax,
            synergyBonusPct: synergyPct,
            withSynergyMin,
            withSynergyMax,
            masteryBonusPct: 0,
            equipSpellDamagePct: 0,
            auraBonusPct: 0,
            finalMin: withSynergyMin,
            finalMax: withSynergyMax,
          }
        } else if (def && def.descdam) {
          const calcState = createInitialState((resolveClassCode(self.charClass) ?? def.classCode ?? 'sor') as any)
          for (const id of hardSkillLevels.keys()) {
            const h = getHardLvl(id)
            if (h > 0) calcState.hardPoints[id] = h
          }
          if (def.classCode === 'sor') {
            for (const mId of [61, 63]) {
              const h = getHardLvl(mId)
              if (h > 0) {
                calcState.hardPoints[mId] = h
                calcState.specificSoftPoints[mId] = Math.max(0, resolveEffectiveSkillLvl(mId) - h)
              }
            }
          }
          const dmg = calculateDetailedDamage(calcState, def, lvl)
          if (dmg.hasDamage && dmg.finalMax > 0) {
            const masteryBonusPct = dmg.masteryMultiplier > 1 ? dmg.masteryBonusPct : 0
            const elemStatMap: Record<string, number> = {
              fire: 329,
              ltng: 330,
              cold: 331,
              pois: 332,
              mag: 357,
            }
            const elemStatId = def.eType ? elemStatMap[def.eType] : undefined
            const equipSpellDamagePct =
              elemStatId !== undefined ? playerAgg.flatSum(elemStatId, 0, ['item', 'charm', 'state']) : 0
            let auraBonusPct = 0
            if (skillId === 112 && (self.states.has(42) || self.rightSkill === 113)) {
              const list42 = self.stats.getStateStats(42) || []
              const state42Ed = list42.find((s: any) => s.statId === 25)?.value
              if (typeof state42Ed === 'number' && state42Ed > 0) {
                auraBonusPct = Math.floor(state42Ed / 2)
              } else {
                const concLvl = resolveEffectiveSkillLvl(113) || (self.states.has(42) ? 1 : 0)
                if (concLvl > 0) {
                  auraBonusPct = Math.floor((60 + 15 * (concLvl - 1)) / 2)
                }
              }
            }
            const afterMasteryMin = Math.floor(
              (dmg.withSynergyMin * (100 + masteryBonusPct + equipSpellDamagePct)) / 100,
            )
            const afterMasteryMax = Math.floor(
              (dmg.withSynergyMax * (100 + masteryBonusPct + equipSpellDamagePct)) / 100,
            )
            const finalMin = Math.floor((afterMasteryMin * (100 + auraBonusPct)) / 100)
            const finalMax = Math.floor((afterMasteryMax * (100 + auraBonusPct)) / 100)
            spellDamage = { min: finalMin, max: finalMax }
            spellBreakdown = {
              spellType: dmg.type,
              baseMin: dmg.baseMin,
              baseMax: dmg.baseMax,
              synergyBonusPct: dmg.synergyBonusPct,
              withSynergyMin: dmg.withSynergyMin,
              withSynergyMax: dmg.withSynergyMax,
              masteryBonusPct,
              equipSpellDamagePct,
              auraBonusPct,
              finalMin,
              finalMax,
            }
          }
        }
      }

      const defaultRange =
        skillId === 2 || skillId === 4
          ? 'rng'
          : isGenericAttackSkill(skillId)
            ? 'both'
            : 'none'

      return {
        id: skillId,
        level: lvl,
        weapSel: meta ? meta.weapsel || 0 : 0,
        kick: isKick,
        srcDam,
        itypeA1,
        itypeA1IsThrown: skillId === 2 || skillId === 4 || (meta ? meta.itypea1 === 'thro' : false),
        range: def && def.range ? def.range : defaultRange,
        toHitPercent,
        damagePercent,
        skillPhysical256,
        flatPhysMin,
        flatPhysMax,
        skillElemMin,
        skillElemMax,
        skillElemType,
        spellDamage,
        spellBreakdown,
        magicConversionPct,
      }
    }

    const masteryDefs: ReadonlyArray<{
      readonly skillId: number
      readonly itemType: string
      readonly arStatId: 342 | 345
      readonly dmgStatId: 343 | 346
      readonly critStatId?: 344 | 347
      readonly arBase: number
      readonly arPerLvl: number
      readonly dmgBase: number
      readonly dmgPerLvl: number
      readonly critMin?: number
      readonly critMax?: number
    }> = [
      { skillId: 127, itemType: 'swor', arStatId: 342, dmgStatId: 343, arBase: 28, arPerLvl: 8, dmgBase: 28, dmgPerLvl: 5 },
      { skillId: 128, itemType: 'axe', arStatId: 342, dmgStatId: 343, arBase: 28, arPerLvl: 8, dmgBase: 28, dmgPerLvl: 5 },
      { skillId: 129, itemType: 'blun', arStatId: 342, dmgStatId: 343, arBase: 28, arPerLvl: 8, dmgBase: 28, dmgPerLvl: 5 },
      { skillId: 134, itemType: 'pole', arStatId: 342, dmgStatId: 343, arBase: 30, arPerLvl: 8, dmgBase: 28, dmgPerLvl: 5 },
      { skillId: 135, itemType: 'thro', arStatId: 345, dmgStatId: 346, arBase: 30, arPerLvl: 8, dmgBase: 28, dmgPerLvl: 5 },
      { skillId: 136, itemType: 'spea', arStatId: 342, dmgStatId: 343, arBase: 30, arPerLvl: 8, dmgBase: 28, dmgPerLvl: 5 },
      { skillId: 252, itemType: 'h2h', arStatId: 342, dmgStatId: 343, critStatId: 344, arBase: 30, arPerLvl: 10, dmgBase: 35, dmgPerLvl: 4, critMin: 0, critMax: 25 },
      { skillId: 252, itemType: 'h2h2', arStatId: 342, dmgStatId: 343, critStatId: 344, arBase: 30, arPerLvl: 10, dmgBase: 35, dmgPerLvl: 4, critMin: 0, critMax: 25 },
    ]
    const masteries: Array<{ statId: 342 | 343 | 344 | 345 | 346 | 347; itemType: string; value: number }> = []
    for (const m of masteryDefs) {
      if ((hardSkillLevels.get(m.skillId) ?? 0) <= 0) continue
      const mLvl = resolveEffectiveSkillLvl(m.skillId)
      if (mLvl <= 0) continue
      masteries.push({
        statId: m.arStatId,
        itemType: m.itemType,
        value: m.arBase + m.arPerLvl * (mLvl - 1),
      })
      masteries.push({
        statId: m.dmgStatId,
        itemType: m.itemType,
        value: m.dmgBase + m.dmgPerLvl * (mLvl - 1),
      })
      if (m.critStatId !== undefined && m.critMax !== undefined) {
        const cMin = m.critMin ?? 0
        const cVal = Math.min(
          m.critMax,
          cMin + Math.trunc(Math.trunc(((m.critMax - cMin) * 110 * mLvl) / (mLvl + 6)) / 100),
        )
        masteries.push({
          statId: m.critStatId,
          itemType: m.itemType,
          value: cVal,
        })
      }
    }

    const bootsEq = playerAgg.equipment.find((x) => x.bodyLoc === 9 && x.baseTable === 'armor')
    const boots = bootsEq
      ? {
          minDam: Number(bootsEq.row.text('mindam')) || 0,
          maxDam: Number(bootsEq.row.text('maxdam')) || 0,
          strBonus: Number(bootsEq.row.text('StrBonus')) || 120,
          dexBonus: Number(bootsEq.row.text('DexBonus')) || 0,
        }
      : null

    const combatLists = playerAgg.sources
      .filter((s) => !(s.kind === 'item' && (s.detail === 4 || s.detail === 5)))
      .map((s) => {
        const cKind = s.kind === 'charm' ? 'item' : s.kind === 'passive' ? 'other' : s.kind
        return { kind: cKind, get: (st: number) => s.stats.get(st) }
      })
    if (self.states.has(31) && !combatLists.some((l) => l.kind === 'state' && l.get(101) > 0 && l.get(58) > 0)) {
      const venomLvl = Math.max(1, resolveEffectiveSkillLvl(278) || 1)
      const bandAdd =
        Math.min(Math.max(0, venomLvl - 1), 7) * 6 +
        Math.min(Math.max(0, venomLvl - 8), 8) * 8 +
        Math.min(Math.max(0, venomLvl - 16), 6) * 10 +
        Math.min(Math.max(0, venomLvl - 22), 6) * 12 +
        Math.max(0, venomLvl - 28) * 14
      const vMinRate = (24 + bandAdd) << 6
      const vMaxRate = (32 + bandAdd) << 6
      combatLists.push({
        kind: 'state',
        get: (st: number) => (st === 57 ? vMinRate : st === 58 ? vMaxRate : st === 101 ? 10 : 0),
      })
    }

    const cInput: any = {
      charClass: resolveClassCode(self.charClass),
      clvl: playerAgg.level,
      toHitFactor: CANONICAL_CHARSTATS[resolveClassCode(self.charClass)]?.toHitFactor ?? 0,
      strength: tot(0),
      dexterity: tot(2),
      dexterityWithoutStates: wost(2),
      lists: combatLists,
      rightArm: buildArm(4),
      leftArm: buildArm(5),
      primaryArm: buildArm(4)?.weapon ? 'right' : buildArm(5)?.weapon ? 'left' : null,
      boots,
      masteries,
      isDamageRelated: (statId: number) => {
        try {
          return getIscRow(statId).damageRelated
        } catch {
          return statId >= 17 && statId <= 24
        }
      },
      hasStateColorFlag: (flag: any) => selfColorFlags.has(flag),
      leftSkill: buildSkill(self.leftSkill),
      rightSkill: buildSkill(self.rightSkill),
    }

    const cStats = computeCombatStats(cInput)
    const statGainInfo = computeActiveWeaponStatGainInfo(cInput)

    attrs.weaponStrBonus = statGainInfo.strBonus
    attrs.weaponDexBonus = statGainInfo.dexBonus
    attrs.weaponPhysBaseMin = statGainInfo.basePhysMin
    attrs.weaponPhysBaseMax = statGainInfo.basePhysMax
    attrs.weaponIsRanged = statGainInfo.isRanged
    attrs.arPctBonus = statGainInfo.arPctBonus

    attrs.leftSkillDmg = cStats.left.damageText
    attrs.leftSkillDmgColor = cStats.left.damageColor
    attrs.leftDamageFormula = cStats.left.formulaBreakdown
    attrs.leftAR = cStats.left.attackRating
    attrs.leftARColor = cStats.left.attackRatingColor

    attrs.rightSkillDmg = cStats.right.damageText
    attrs.rightSkillDmgColor = cStats.right.damageColor
    attrs.rightDamageFormula = cStats.right.formulaBreakdown
    attrs.rightAR = cStats.right.attackRating
    attrs.rightARColor = cStats.right.attackRatingColor

    attrs.leftSkillId = self.leftSkill
    attrs.rightSkillId = self.rightSkill
    attrs.attackRating = cStats?.left?.attackRating ?? 0
    attrs.leftAttackRating = cStats?.left?.attackRating ?? 0
    attrs.baseAttackRating = cStats?.left?.baseAttackRating ?? 0
    attrs.rightAttackRating = cStats?.right?.attackRating ?? 0
    attrs.baseRightAttackRating = cStats?.right?.baseAttackRating ?? 0

    // 1.13c Block Chance (`D2Common.dll #10918` `UNITS_GetBlockRate` @ `0x6FD87BE0` & `0x6FB6C430` Weapon Block `#263`)
    const shieldEq = playerAgg.equipment.find(
      (x) => (x.bodyLoc === 4 || x.bodyLoc === 5) && x.baseTable === 'armor',
    )
    if (shieldEq) {
      const classBlockFactor = CANONICAL_CHARSTATS[resolveClassCode(self.charClass)]?.blockFactor ?? 20
      const armorBlock = Number(shieldEq.row.text('block')) || 0
      let holyShieldBlock = 0
      if (self.states.has(101)) {
        const hsLvl = Math.max(1, resolveEffectiveSkillLvl(117) || 1)
        holyShieldBlock = 10 + Math.trunc((30 * Math.trunc((110 * hsLvl) / (hsLvl + 6))) / 100)
      }
      const totalShieldBlock = Math.min(75, armorBlock + classBlockFactor) + tot(20) + holyShieldBlock
      const clvl = Math.max(1, playerAgg.level || 1)
      attrs.shieldBaseBlock = totalShieldBlock
      attrs.blockChance = Math.min(
        75,
        Math.max(0, Math.floor((totalShieldBlock * Math.max(0, attrs.dex - 15)) / (clvl * 2))),
      )
    } else {
      attrs.shieldBaseBlock = 0
      const rWep = cInput.rightArm
      const lWep = cInput.leftArm
      const isDualClaw =
        Boolean(rWep && (rWep.isType('h2h') || rWep.isType('h2h2'))) &&
        Boolean(lWep && (lWep.isType('h2h') || lWep.isType('h2h2')))
      const wbLvl = isDualClaw && (hardSkillLevels.get(263) ?? 0) > 0 ? resolveEffectiveSkillLvl(263) : 0
      if (wbLvl > 0) {
        const wbPct = Math.min(75, 20 + Math.trunc((45 * Math.trunc((110 * wbLvl) / (wbLvl + 6))) / 100))
        attrs.weaponBlockChance = wbPct
        attrs.blockChance = wbPct
      } else {
        attrs.weaponBlockChance = 0
        attrs.blockChance = 0
      }
    }

    // Advanced Character Stats (`hud-enhancements` / `StatsDisplay::Draw`)
    attrs.fireAbsorbFlat = tot(143)
    attrs.fireAbsorbPct = tot(142)
    attrs.coldAbsorbFlat = tot(149)
    attrs.coldAbsorbPct = tot(148)
    attrs.lightAbsorbFlat = tot(145)
    attrs.lightAbsorbPct = tot(144)
    attrs.magicAbsorbFlat = tot(147)
    attrs.magicAbsorbPct = tot(146)

    attrs.drFlat = tot(34)
    attrs.drPct = tot(36)
    attrs.mdrFlat = tot(35)
    attrs.mdrPct = tot(37)
    attrs.atdPhys = tot(78)
    attrs.atdLight = tot(128)

    attrs.fireMasteryPct = tot(329)
    attrs.coldMasteryPct = tot(331)
    attrs.lightMasteryPct = tot(330)
    attrs.poisonMasteryPct = tot(332)
    attrs.magicMasteryPct = tot(357)
    attrs.firePiercePct = tot(333)
    attrs.coldPiercePct = tot(335)
    attrs.lightPiercePct = tot(334)
    attrs.poisonPiercePct = tot(336)
    attrs.magicPiercePct = tot(358)

    const toHitFactor = CANONICAL_CHARSTATS[resolveClassCode(self.charClass)]?.toHitFactor ?? 0
    attrs.baseArDex = Math.max(0, (attrs.dex - 7) * 5 + toHitFactor)
    attrs.baseArEquip = tot(19)
    attrs.baseDefDex = Math.floor(attrs.dex / 4)
    attrs.baseDefEquip = tot(31)
    attrs.baseDmg1hMin = tot(21)
    attrs.baseDmg1hMax = tot(22)
    attrs.baseDmg2hMin = tot(23)
    attrs.baseDmg2hMax = tot(24)

    attrs.fcr = tot(105)
    attrs.fbr = tot(102) + (self.states.has(101) ? 50 : 0)
    attrs.fhr = tot(99)
    attrs.frw = tot(96)
    attrs.arPct = tot(119)
    attrs.ias = tot(93)

    const activeWeaponEq = playerAgg.equipment.find(
      (x) => (x.bodyLoc === 4 || x.bodyLoc === 5) && x.baseTable === 'weapons',
    )
    const hitClass = activeWeaponEq ? (activeWeaponEq.row.text('hit class') || '').trim().toLowerCase() : ''
    attrs.weaponWsm = activeWeaponEq ? Number(activeWeaponEq.row.text('speed')) || 0 : 0
    attrs.weaponClass = activeWeaponEq ? (activeWeaponEq.row.text('wclass') || '').trim().toLowerCase() : ''
    attrs.isOneHandSwinging = hitClass === '1hss' || hitClass === '1hsl'
    attrs.isSpearOrStaff = activeWeaponEq
      ? itemCodeIsA(activeWeaponEq.item.code, 'spea') || itemCodeIsA(activeWeaponEq.item.code, 'staf')
      : false
    attrs.werewolfState = self.states.has(139)
    attrs.werebearState = self.states.has(140)
    attrs.vampireState = self.states.has(65)
    attrs.skillEias = tot(68)

    attrs.crushingBlow = tot(136)
    attrs.openWounds = tot(135)
    attrs.openWoundsFlat = 0
    attrs.deadlyStrike = tot(141)

    const csLvl = (hardSkillLevels.get(9) ?? 0) > 0 ? resolveEffectiveSkillLvl(9) : 0
    const amaCrit =
      csLvl > 0 ? Math.min(80, 5 + Math.trunc((75 * Math.trunc((110 * csLvl) / (csLvl + 6))) / 100)) : 0
    let masteryCrit = 0
    if (activeWeaponEq) {
      for (const m of masteries) {
        if ((m.statId === 344 || m.statId === 347) && itemCodeIsA(activeWeaponEq.item.code, m.itemType)) {
          masteryCrit = Math.max(masteryCrit, m.value)
        }
      }
    }
    attrs.criticalStrike = amaCrit + Math.trunc(((100 - amaCrit) * masteryCrit) / 100)

    attrs.lifeLeech = tot(60)
    attrs.manaLeech = tot(62)
    const pierceLvl = (hardSkillLevels.get(23) ?? 0) > 0 ? resolveEffectiveSkillLvl(23) : 0
    const amaPierce =
      pierceLvl > 0
        ? Math.min(100, 10 + Math.trunc((90 * Math.trunc((110 * pierceLvl) / (pierceLvl + 6))) / 100))
        : 0
    attrs.projectilePierce = tot(156) + amaPierce
    attrs.lifeAfterKill = tot(86)
    attrs.manaAfterKill = tot(138)

    attrs.addedPhysDmg = tot(111)
    attrs.addedMagicMin = tot(52)
    attrs.addedMagicMax = tot(53)
    attrs.addedFireMin = tot(48)
    attrs.addedFireMax = tot(49)
    attrs.addedColdMin = tot(54)
    attrs.addedColdMax = tot(55)
    attrs.addedLightMin = tot(50)
    attrs.addedLightMax = tot(51)
    const poisMinRate = tot(57)
    const poisMaxRate = tot(58)
    const poisLenFrames = tot(59)
    const poisCount = Math.max(1, tot(326))
    const avgPoisFrames = poisLenFrames > 0 ? Math.trunc(poisLenFrames / poisCount) : 0
    attrs.addedPoisonMin = avgPoisFrames > 0 ? Math.trunc((poisMinRate * avgPoisFrames + 128) / 256) : 0
    attrs.addedPoisonMax = avgPoisFrames > 0 ? Math.trunc((poisMaxRate * avgPoisFrames + 128) / 256) : 0
    attrs.addedPoisonSec = avgPoisFrames > 0 ? Number((avgPoisFrames / 25).toFixed(1)) : 0

    attrs.magicFind = tot(80)
    attrs.goldFind = tot(79)
    attrs.stashGold = stats.get(D2StatId.GoldBank)
  } else {
    attrs.weaponStrBonus = 100
    attrs.weaponDexBonus = 0
    attrs.weaponPhysBaseMin = 1
    attrs.weaponPhysBaseMax = 2
    attrs.weaponIsRanged = false
    attrs.arPctBonus = 0
    attrs.defense = 0
    attrs.baseDefense = 0
    attrs.attackRating = 0
    attrs.baseAttackRating = 0
    attrs.rightAttackRating = 0
    attrs.baseRightAttackRating = 0
    attrs.fireRes = 0
    attrs.coldRes = 0
    attrs.lightRes = 0
    attrs.poisRes = 0
    attrs.maxFireRes = Math.min(95, 75 + stats.get(40))
    attrs.maxLightRes = Math.min(95, 75 + stats.get(42))
    attrs.maxColdRes = Math.min(95, 75 + stats.get(44))
    attrs.maxPoisonRes = Math.min(95, 75 + stats.get(46))
  }
  const eqW1 = hud.inventory.equipped.weapon1
  const eqW2 = hud.inventory.equipped.weapon2
  const weaponState = {
    rightHandCode: eqW1?.code ?? null,
    rightHandType: ((eqW1 as any)?.rawItem?.base?.type ?? (eqW1 as any)?.subType ?? null) as string | null,
    leftHandCode: eqW2?.code ?? null,
    leftHandType: ((eqW2 as any)?.rawItem?.base?.type ?? (eqW2 as any)?.subType ?? null) as string | null,
  }

  if (containersDirty) {
    const scrollCounts = new Map<number, number>()
    for (const item of model.world.containers.inventory.values()) {
      const code = (item.code ?? '').trim().toLowerCase()
      const scrollSkillId =
        code === 'isc' ? 217 : code === 'ibk' ? 218 : code === 'tsc' ? 219 : code === 'tbk' ? 220 : null
      if (scrollSkillId === null) continue
      const statQty = item.stats?.find((s: any) => (s.statId ?? (s as any).id) === 70)?.value
      const qty =
        typeof (item as any).quantity === 'number'
          ? (item as any).quantity
          : typeof (item as any).stack === 'number'
            ? (item as any).stack
            : statQty !== undefined
              ? statQty
              : 1
      if (qty > 0) {
        scrollCounts.set(scrollSkillId, (scrollCounts.get(scrollSkillId) ?? 0) + qty)
      }
    }
    model.cachedScrollCounts = scrollCounts
  }
  const scrollCounts: Map<number, number> = model.cachedScrollCounts

  hud.skillTree.unspentSkillPoints = stats.get(D2StatId.NewSkills)
  hud.skillTree.characterLevel = self.level
  hud.skillTree.hardPoints.clear()
  hud.skillTree.bonusLevels.clear()
  hud.hotkeys.setAvailableSkills([])
  hud.hotkeys.weaponEquipState = weaponState
  hud.hotkeys.setActiveStates?.(self.states)
  hud.hotkeys.clearWeaponUsability?.()
  const preaggSkillBonuses =
    classCode && self.skillEntries.size > 0
      ? preaggregateEquipmentSkillBonuses(
          model.world.containers,
          stats,
          self.weaponSet === 1 ? 1 : 0,
          self.level,
          classCode,
        )
      : null
  for (const [skillId, sl] of self.skillEntries.entries()) {
    const tableMeta = getSkillTableMeta(skillId)
    if (!tableMeta || !tableMeta.skilldesc) {
      throw new Error(`[hud-model] Missing canonical skills.txt/skilldesc.txt metadata for skillId=${skillId}`)
    }
    const hard = Math.max(0, sl.baseLevel ?? sl.level)
    const equipBonus =
      classCode && preaggSkillBonuses
        ? resolvePreaggregatedSkillBonus(skillId, classCode, preaggSkillBonuses, stats)
        : 0
    const bonus = computeTotalSkillBonus(sl.bonus, equipBonus)
    if (hard > 0) hud.skillTree.hardPoints.set(skillId, hard)
    if (bonus > 0) hud.skillTree.bonusLevels.set(skillId, bonus)
    if (isPassiveSkill(skillId) || tableMeta.listRow < 0) continue
    const weaponOnlyUsable = canUseSkillWithWeapon(skillId, weaponState)
    const weaponUsable = canUseSkillWithWeapon(skillId, weaponState, self.states)
    hud.hotkeys.setSkillWeaponUsable?.(skillId, weaponUsable)
    if ((skillId === 2 || skillId === 4) && !weaponOnlyUsable) continue
    const effSkillLevel = hard + bonus
    const charges = self.skillCharges?.get(skillId) ?? scrollCounts.get(skillId)
    if (effSkillLevel <= 0 && charges === undefined) continue
    const genericEntry = createCanonicalGenericSkillEntry(skillId, charges)
    if (genericEntry) {
      hud.hotkeys.addOrUpdateSkill(genericEntry)
      if (charges !== undefined) {
        hud.hotkeys.setSkillCharges(skillId, charges)
      }
      continue
    }
    const catalogEntry = SKILLS_BY_ID[skillId]
    if (!catalogEntry) continue
    hud.hotkeys.addOrUpdateSkill({
      skillId,
      name: getSkillName(skillId, 'ENG'),
      nameZh: getSkillName(skillId, 'CHI'),
      level: effSkillLevel,
      manaCost: effSkillLevel > 0 ? calculateManaCost(catalogEntry, effSkillLevel) : 0,
      leftUsable: isLeftUsableSkill(skillId),
      rightUsable: true,
      isAura: isAuraSkill(skillId),
      listRow: tableMeta.listRow,
      reqlevel: catalogEntry.reqlevel,
      ...(charges !== undefined ? { charges } : {}),
    })
    if (charges !== undefined) {
      hud.hotkeys.setSkillCharges(skillId, charges)
    }
  }

  const hasEquippedThrowing =
    Boolean(weaponState.rightHandCode || weaponState.leftHandCode) &&
    canUseSkillWithWeapon(2, weaponState)
  if (self.skillEntries.size > 0 || scrollCounts.size > 0 || hasEquippedThrowing) {
    if (!hud.hotkeys.availableSkills.some((s) => s.skillId === 0)) {
      const atkEntry = createCanonicalGenericSkillEntry(0)
      if (atkEntry) hud.hotkeys.addOrUpdateSkill(atkEntry)
    }
    if (hasEquippedThrowing && !hud.hotkeys.availableSkills.some((s) => s.skillId === 2)) {
      const throwEntry = createCanonicalGenericSkillEntry(2)
      if (throwEntry) hud.hotkeys.addOrUpdateSkill(throwEntry)
    }
    if (
      self.charClass === 4 &&
      Boolean(weaponState.leftHandCode) &&
      canUseSkillWithWeapon(4, weaponState) &&
      !hud.hotkeys.availableSkills.some((s) => s.skillId === 4)
    ) {
      const lhtEntry = createCanonicalGenericSkillEntry(4)
      if (lhtEntry) hud.hotkeys.addOrUpdateSkill(lhtEntry)
    }
    for (const [scrollSkillId, qty] of scrollCounts.entries()) {
      const scrollEntry = createCanonicalGenericSkillEntry(scrollSkillId, qty)
      if (scrollEntry) {
        hud.hotkeys.addOrUpdateSkill(scrollEntry)
        hud.hotkeys.setSkillCharges(scrollSkillId, qty)
      }
    }
  }

  if (model.world.skillHotkeys.size > 0 || model.hadWorldSkillHotkeys) {
    model.hadWorldSkillHotkeys = true
    hud.hotkeys.bindings.clear()
    for (const [slot, binding] of model.world.skillHotkeys.entries()) {
      const fKey = slot < 8 ? `F${slot + 1}` : `SKILL${slot + 1}`
      hud.hotkeys.bindHotkey(fKey, binding.hand, binding.skill)
    }
  }
  hud.hotkeys.leftSkillId = self.leftSkill
  hud.hotkeys.rightSkillId = self.rightSkill
  hud.hotkeys.setSkillWeaponUsable?.(0, canUseSkillWithWeapon(0, weaponState, self.states))
  hud.hotkeys.setSkillWeaponUsable?.(self.leftSkill, canUseSkillWithWeapon(self.leftSkill, weaponState, self.states))
  hud.hotkeys.setSkillWeaponUsable?.(self.rightSkill, canUseSkillWithWeapon(self.rightSkill, weaponState, self.states))
  if (self.states.has(121)) {
    const remMs = model.world.getSkillCooldownRemainingMs(self.rightSkill) || model.world.getSkillCooldownRemainingMs(self.leftSkill) || 1000
    hud.hotkeys.setGlobalSkillDelay(remMs)
  } else {
    hud.hotkeys.setGlobalSkillDelay(0)
  }

  const tblLang = (hud.charSheet.lang as string) === 'en' || hud.charSheet.lang === 'ENG' ? 'ENG' : 'CHI'
  attrs.leftSkillName = getSkillName(self.leftSkill, tblLang)
  attrs.rightSkillName = getSkillName(self.rightSkill, tblLang)
  if (!attrs.leftSkillDmg || attrs.leftSkillDmg === '--') {
    attrs.leftSkillDmg = model.computeSkillDamageString(self.leftSkill, hud)
  }
  if (!attrs.rightSkillDmg || attrs.rightSkillDmg === '--') {
    attrs.rightSkillDmg = model.computeSkillDamageString(self.rightSkill, hud)
  }
  model.lastCombatSyncedHudRef = hud
  model.lastCombatSyncedStatRev = combatStatRev
  model.lastCombatSyncedCharClass = self.charClass
  model.lastCombatSyncedLevel = self.level
  model.lastCombatSyncedMaxLife = self.maxLife
  model.lastCombatSyncedMaxMana = self.maxMana
  model.lastCombatSyncedMaxStamina = self.maxStamina
  model.lastCombatSyncedWeaponSet = self.weaponSet
  model.lastCombatSyncedLeftSkill = self.leftSkill
  model.lastCombatSyncedRightSkill = self.rightSkill
  model.lastCombatSyncedDifficulty = model.world.difficulty
  model.lastCombatSyncedRunning = isActivelyRunning
  model.lastCombatSyncedLang = hud.charSheet.lang
  model.lastCombatSyncedStatesSkillsHash = statesAndSkillsHash
  model.lastCombatSyncedEqW1 = eqW1
  model.lastCombatSyncedEqW2 = eqW2
  }

  if (containersDirty) {
    const nextStashItems: GridPlacement[] = [...model.world.containers.stash.values()].map((item: ItemData) => ({
      item: model.toUiItem(item),
      col: item.gridX ?? item.x ?? 0,
      row: item.gridY ?? item.y ?? 0,
    }))
    hud.worldPanels.stashItems = nextStashItems
    model.lastSyncedStashItemsRef = nextStashItems

    const nextCubeItems: GridPlacement[] = [...model.world.containers.cube.values()].map((item: ItemData) => ({
      item: model.toUiItem(item),
      col: item.gridX ?? item.x ?? 0,
      row: item.gridY ?? item.y ?? 0,
    }))
    hud.worldPanels.cubeItems = nextCubeItems
    model.lastSyncedCubeItemsRef = nextCubeItems
  }

  const pendingStackable = model.world.consumePendingUseStackableItem?.()
  if (pendingStackable) {
    if (
      pendingStackable.cursorAction === 0xff ||
      pendingStackable.itemId === 0xffffffff ||
      pendingStackable.itemId === 0
    ) {
      if (hud.pendingIdentifyScrollId !== null || hud.inventory.isIdentifyMode()) {
        hud.pendingIdentifyScrollId = null
        hud.inventory.cancelIdentifyMode()
      }
    } else if (pendingStackable.itemId > 0) {
      const matchPlaced = hud.inventory.gridItems.find(
        (p) =>
          String(p.item.id) === String(pendingStackable.itemId) ||
          (p.item as { serverId?: number }).serverId === pendingStackable.itemId,
      )
      if (matchPlaced && hud.inventory.startIdentifyMode(matchPlaced.item, 'inventory')) {
        hud.pendingIdentifyScrollId = pendingStackable.itemId
        if (hud.rightPanel !== 'inv') {
          hud.toggleRightPanel('inv')
        }
      }
    }
  }

  if (containersDirty) {
    for (let r = 0; r < BELT_ROWS; r++) {
      for (let c = 0; c < BELT_COLS; c++) {
        hud.belt.grid[r]![c] = null
      }
    }
    for (const item of model.world.containers.belt.values()) {
      const slotIndex = item.gridX ?? item.x ?? 0
      if (slotIndex < 0 || slotIndex >= BELT_ROWS * BELT_COLS) continue
      const row = Math.floor(slotIndex / BELT_COLS)
      const col = slotIndex % BELT_COLS
      const pot = itemToBeltPotion({ id: String(item.id), code: item.code }) ?? {
        id: String(item.id),
        code: item.code,
        name: item.code.toUpperCase(),
        nameZh: item.code.toUpperCase(),
        kind: 'hp' as const,
        healHp: 0,
        healMana: 0,
        invFile: 'invpotr',
      }
      hud.belt.grid[row]![col] = pot
    }

    const cursorItem = model.world.containers.cursor
    if (
      isArtisanPanelOpen &&
      cursorItem &&
      activeSlotItem &&
      String(activeSlotItem.id) === String(cursorItem.id)
    ) {
      ;(hud.worldPanels as any).questRewardItem = model.toUiItem(cursorItem)
      hud.inventory.cursorItem = null
    } else {
      hud.inventory.cursorItem = cursorItem ? model.toUiItem(cursorItem) : null
    }
    model.lastSyncedCursorItemRef = hud.inventory.cursorItem
  }

  // 5b. Death state
  ;(hud as any).isDead = model.world.isDead
  ;(hud.worldPanels as any).isDead = model.world.isDead
  if (model.world.isDead) {
    model.world.questLog.notePlayerDead()
  }

  // 5c. Mercenary state & equipment (slots 1=head/helm, 3=torso/armor, 4=rightHand/weapon1, 5=leftHand/weapon2)
  const mercRaw = model.world.merc as any
  const mUnit = model.world.getUnit ? model.world.getUnit('monster', mercRaw?.mercId) : undefined
  const mercStats = mUnit?.stats ?? (mercRaw?.stats ?? { get: () => 0, getBase: () => 0, has: () => false, entries: () => [] })
  const mercIconKey = resolveMercPortraitIcon(model.world.merc?.classId ?? mercRaw?.classId)
  const mercLang = hud.lang === 'ENG' ? 'ENG' : 'CHI'
  const effectiveMerc = model.world.merc ? computeEffectiveMercenaryStats(model.world, mercLang) : null
  const mercUnitLevel = Math.max(
    1,
    Math.trunc(
      Number(
        effectiveMerc?.level ||
          (typeof mercStats.get === 'function' ? mercStats.get(12) : 0) ||
          mercRaw?.level ||
          model.world.self.level ||
          (model.world.self as any).stats?.get?.(12) ||
          1,
      ) || 1,
    ),
  )

  if (
    containersDirty ||
    !model.cachedMercEquipped ||
    !model.cachedMercEquipment ||
    model.lastSyncedMercLevel !== mercUnitLevel
  ) {
    const findMercSlotItem = (slotNum: number): ItemData | undefined => {
      const bySlot = model.world.containers.mercBySlot?.get(slotNum) ?? model.world.containers.merc.get(slotNum)
      if (bySlot && (bySlot.bodyLoc || bySlot.equippedSlot || slotNum) === slotNum) {
        return bySlot
      }
      for (const it of model.world.containers.merc.values()) {
        if ((it.bodyLoc || it.equippedSlot) === slotNum) return it
      }
      return undefined
    }
    const rawMerc1 = findMercSlotItem(1)
    const rawMerc3 = findMercSlotItem(3)
    const rawMerc4 = findMercSlotItem(4)
    const rawMerc5 = findMercSlotItem(5)
    const mercEquippedRawItems = [rawMerc1, rawMerc3, rawMerc4, rawMerc5].filter(
      (x): x is ItemData => Boolean(x),
    )
    const mercEquippedSig = 'merc:' + computeEquippedItemsSignature(mercEquippedRawItems)
    const mercUiOpts = {
      unitLevel: mercUnitLevel,
      equippedItems: mercEquippedRawItems,
      equippedSig: mercEquippedSig,
    }
    const uiMerc1 = rawMerc1 ? model.toUiItem(rawMerc1, mercUiOpts) : null
    const uiMerc3 = rawMerc3 ? model.toUiItem(rawMerc3, mercUiOpts) : null
    const uiMerc4 = rawMerc4 ? model.toUiItem(rawMerc4, mercUiOpts) : null
    const uiMerc5 = rawMerc5 ? model.toUiItem(rawMerc5, mercUiOpts) : null
    const mapMercNumericItem = (ui: UiInventoryItem | null, it: ItemData | undefined) =>
      ui && it ? { ...ui, id: it.id as unknown as string } : null
    const mapMercStringItem = (ui: UiInventoryItem | null, it: ItemData | undefined) =>
      ui && it ? { ...ui, id: String(it.id) } : null
    const mercHeadNum = mapMercNumericItem(uiMerc1, rawMerc1)
    const mercTorsoNum = mapMercNumericItem(uiMerc3, rawMerc3)
    const mercRightNum = mapMercNumericItem(uiMerc4, rawMerc4)
    const mercLeftNum = mapMercNumericItem(uiMerc5, rawMerc5)
    model.cachedMercEquipped = {
      head: mercHeadNum,
      helm: mercHeadNum,
      torso: mercTorsoNum,
      armor: mercTorsoNum,
      rightHand: mercRightNum,
      weapon1: mercRightNum,
      leftHand: mercLeftNum,
      weapon2: mercLeftNum,
    }
    const mercHeadUi = mapMercStringItem(uiMerc1, rawMerc1)
    const mercTorsoUi = mapMercStringItem(uiMerc3, rawMerc3)
    const mercRightUi = mapMercStringItem(uiMerc4, rawMerc4)
    const mercLeftUi = mapMercStringItem(uiMerc5, rawMerc5)
    model.cachedMercEquipment = {
      head: mercHeadUi,
      helm: mercHeadUi,
      torso: mercTorsoUi,
      armor: mercTorsoUi,
      rightHand: mercRightUi,
      weapon1: mercRightUi,
      leftHand: mercLeftUi,
      weapon2: mercLeftUi,
    }
    model.lastSyncedMercLevel = mercUnitLevel
  }
  const mercEquipped = model.cachedMercEquipped!
  const mercEquipment = model.cachedMercEquipment!
  const mercHeadUi = mercEquipment.head
  const mercTorsoUi = mercEquipment.torso
  const mercRightUi = mercEquipment.rightHand
  const mercLeftUi = mercEquipment.leftHand

  const rawMercClassId = Number(mercRaw?.classId ?? mercRaw?.hcIdx ?? 0)
  const normMercClassId = rawMercClassId === 560 ? 561 : (rawMercClassId || 338)
  const hasMercNameId =
    typeof mercRaw?.nameId === 'number' &&
    mercRaw.nameId >= 0 &&
    (rawMercClassId > 0 || mercRaw.nameId >= 1000)
  const tblMercNameEn = hasMercNameId
    ? resolveHirelingName(normMercClassId, mercRaw.nameId, 'ENG')
    : ''
  const tblMercNameZh = hasMercNameId
    ? resolveHirelingName(normMercClassId, mercRaw.nameId, 'CHI')
    : ''
  const isRealMercName = (s: unknown): s is string =>
    typeof s === 'string' && s.length > 0 && !s.startsWith('Mercenary #') && !s.startsWith('Merc #')
  const mercNameEn: string | undefined =
    (isRealMercName(mercRaw?.name) ? mercRaw.name : undefined) ||
    (isRealMercName(tblMercNameEn) ? tblMercNameEn : undefined)
  const mercNameZh: string | undefined =
    (isRealMercName(mercRaw?.nameZh) ? mercRaw.nameZh : undefined) ||
    (isRealMercName(tblMercNameZh) ? tblMercNameZh : undefined)

  if (model.world.merc && mercStats.has(12) && mercStats.has(0) && mercStats.has(2)) {
    const mercAgg = aggregateUnit({
      kind: 'merc',
      stats: mercStats as any,
      activeStates: mUnit?.states ?? (mercRaw?.states ?? new Set<number>()),
      classId: null as any,
      hardSkillLevels: null as any,
      containers: model.world.containers,
    })

    const mercLifePct = Number(mercRaw?.lifePct ?? 0)
    const isMercDead = Boolean(mercRaw?.isDead || mercLifePct <= 0 || mercRaw?.mode === 12 || (mercRaw?.mode === 0 && mercLifePct === 0))

    const aggMaxHp = Math.floor(mercAgg.total(7) / 256)
    const aggHp = Math.floor(mercAgg.total(6) / 256)
    const hasExplicitMercHpStats = mercAgg.base(7) > 0 && mercStats.has(6)
    const mercMaxHp = isMercDead
      ? 0
      : hasExplicitMercHpStats
        ? aggMaxHp
        : (effectiveMerc?.maxHp ?? aggMaxHp)
    const mercHp = isMercDead
      ? 0
      : hasExplicitMercHpStats
        ? aggHp
        : (effectiveMerc?.hp ?? aggHp)

    const diffPenalty = model.world.difficulty === 2 ? -100 : model.world.difficulty === 1 ? -40 : 0
    const fireRes = Math.min(mercAgg.total(40) + 75, mercAgg.total(39) + diffPenalty)
    const lightRes = Math.min(mercAgg.total(42) + 75, mercAgg.total(41) + diffPenalty)
    const coldRes = Math.min(mercAgg.total(44) + 75, mercAgg.total(43) + diffPenalty)
    const poisonRes = Math.min(mercAgg.total(46) + 75, mercAgg.total(45) + diffPenalty)

    const mercName =
      mercLang === 'CHI'
        ? (mercNameZh ||
            effectiveMerc?.name ||
            mercNameEn ||
            (mercRaw?.mercId ? `佣兵 #${mercRaw.mercId}` : '佣兵'))
        : (mercNameEn ||
            effectiveMerc?.name ||
            (mercRaw?.mercId ? `Merc #${mercRaw.mercId}` : 'Mercenary'))

    const getColor = (id: number): D2ColorCode => {
      const total = (id === 6 || id === 7) ? Math.floor(mercAgg.total(id) / 256) : mercAgg.total(id)
      const base = (id === 6 || id === 7) ? Math.floor(mercAgg.base(id) / 256) : mercAgg.base(id)
      if (total > base) return 'blue'
      if (total < base) return 'red'
      return 'white'
    }
    const getResColor = (val: number, maxCap: number): D2ColorCode => (val < 0 ? 'red' : val >= maxCap ? 'gold' : 'white')
    const mercActiveStates = mUnit?.states ?? (mercRaw?.states ?? new Set<number>())
    const mercColorFlags = stateColorFlags(mercActiveStates)
    const hasFlag = (flag: string): boolean => mercColorFlags.has(flag as any)

    const syncedMerc = {
      ...model.world.merc,
      unitId: mercRaw.unitId ?? model.world.merc.mercId,
      iconKey: mercIconKey,
      name: mercName,
      ...(mercNameEn !== undefined ? { nameEn: mercNameEn } : {}),
      ...(mercNameZh !== undefined ? { nameZh: mercNameZh } : {}),
      level: mercAgg.total(12),
      hp: mercHp,
      maxHp: mercMaxHp,
      life: mercHp,
      maxLife: mercMaxHp,
      lifePct: isMercDead ? 0 : mercLifePct,
      isDead: isMercDead,
      experience: mercStats.has(13) ? mercAgg.total(13) : (effectiveMerc?.experience ?? 0),
      nextExp: mercStats.has(30) ? mercAgg.total(30) : (effectiveMerc?.nextLevelXp ?? 0),
      hpColor: hasFlag('hpred') ? 'red' : hasFlag('hpblue') ? 'blue' : getColor(7),
      strength: mercAgg.total(0),
      baseStrength: mercAgg.base(0),
      dexterity: mercAgg.total(2),
      baseDexterity: mercAgg.base(2),
      strengthColor: getColor(0),
      dexterityColor: getColor(2),
      minDamage: effectiveMerc ? effectiveMerc.minDamage : (mercAgg.total(21) || 0),
      maxDamage: effectiveMerc ? effectiveMerc.maxDamage : (mercAgg.total(22) || 0),
      damageColor: hasFlag('damblue') ? 'blue' : hasFlag('damred') ? 'red' : (effectiveMerc?.damageColor ?? (mercAgg.total(21) > mercAgg.base(21) ? 'blue' : 'white')),
      defense: effectiveMerc ? effectiveMerc.defense : (mercAgg.total(31) || 0),
      defenseColor: getColor(31) !== 'white' ? getColor(31) : (effectiveMerc?.defenseColor ?? 'white'),
      fireResist: fireRes,
      lightResist: lightRes,
      coldResist: coldRes,
      poisonResist: poisonRes,
      fireResistColor: hasFlag('rfred') ? 'red' : hasFlag('rfblue') ? 'blue' : getResColor(fireRes, mercAgg.total(40) + 75),
      lightResistColor: hasFlag('rlred') ? 'red' : hasFlag('rlblue') ? 'blue' : getResColor(lightRes, mercAgg.total(42) + 75),
      coldResistColor: hasFlag('rcred') ? 'red' : hasFlag('rcblue') ? 'blue' : getResColor(coldRes, mercAgg.total(44) + 75),
      poisonResistColor: hasFlag('rpred') ? 'red' : hasFlag('rpblue') ? 'blue' : getResColor(poisonRes, mercAgg.total(46) + 75),
      equipped: mercEquipment,
      equipment: mercEquipped,
      headItem: mercHeadUi,
      bodyItem: mercTorsoUi,
      weaponItem: mercRightUi,
      shieldItem: mercLeftUi,
      stats: mercStats,
    }
    ;(hud as any).merc = syncedMerc
    ;(hud.worldPanels as any).merc = syncedMerc
  } else if (model.world.merc && effectiveMerc) {
    const mercLifePct = Number(mercRaw?.lifePct ?? effectiveMerc.lifePct ?? 128)
    const isMercDead = Boolean(mercRaw?.isDead || mercLifePct <= 0 || mercRaw?.mode === 12 || (mercRaw?.mode === 0 && mercLifePct === 0))
    const mercActiveStates = mUnit?.states ?? (mercRaw?.states ?? new Set<number>())
    const mercColorFlags = stateColorFlags(mercActiveStates)
    const hasFlag = (flag: string): boolean => mercColorFlags.has(flag as any)
    const fallbackMercName =
      mercLang === 'CHI'
        ? (mercNameZh || effectiveMerc.name || mercNameEn || '佣兵')
        : (mercNameEn || effectiveMerc.name || 'Mercenary')
    const syncedMerc = {
      ...model.world.merc,
      unitId: mercRaw.unitId ?? model.world.merc.mercId,
      iconKey: mercIconKey,
      name: fallbackMercName,
      ...(mercNameEn !== undefined ? { nameEn: mercNameEn } : {}),
      ...(mercNameZh !== undefined ? { nameZh: mercNameZh } : {}),
      level: effectiveMerc.level,
      hp: isMercDead ? 0 : effectiveMerc.hp,
      maxHp: isMercDead ? 0 : effectiveMerc.maxHp,
      life: isMercDead ? 0 : effectiveMerc.hp,
      maxLife: isMercDead ? 0 : effectiveMerc.maxHp,
      lifePct: isMercDead ? 0 : mercLifePct,
      isDead: isMercDead,
      experience: effectiveMerc.experience,
      nextExp: effectiveMerc.nextLevelXp,
      hpColor: hasFlag('hpred') ? 'red' : hasFlag('hpblue') ? 'blue' : 'white',
      strength: effectiveMerc.str,
      baseStrength: effectiveMerc.baseStr,
      dexterity: effectiveMerc.dex,
      baseDexterity: effectiveMerc.baseDex,
      strengthColor: effectiveMerc.strColor,
      dexterityColor: effectiveMerc.dexColor,
      minDamage: effectiveMerc.minDamage,
      maxDamage: effectiveMerc.maxDamage,
      damageColor: hasFlag('damblue') ? 'blue' : hasFlag('damred') ? 'red' : effectiveMerc.damageColor,
      defense: effectiveMerc.defense,
      baseDefense: effectiveMerc.baseDefense,
      defenseColor: effectiveMerc.defenseColor,
      fireResist: effectiveMerc.fireResist,
      lightResist: effectiveMerc.lightResist,
      coldResist: effectiveMerc.coldResist,
      poisonResist: effectiveMerc.poisonResist,
      fireResistColor: hasFlag('rfred') ? 'red' : hasFlag('rfblue') ? 'blue' : effectiveMerc.fireResistColor,
      lightResistColor: hasFlag('rlred') ? 'red' : hasFlag('rlblue') ? 'blue' : effectiveMerc.lightResistColor,
      coldResistColor: hasFlag('rcred') ? 'red' : hasFlag('rcblue') ? 'blue' : effectiveMerc.coldResistColor,
      poisonResistColor: hasFlag('rpred') ? 'red' : hasFlag('rpblue') ? 'blue' : effectiveMerc.poisonResistColor,
      equipped: mercEquipment,
      equipment: mercEquipped,
      headItem: mercHeadUi,
      bodyItem: mercTorsoUi,
      weaponItem: mercRightUi,
      shieldItem: mercLeftUi,
      stats: mercStats,
    }
    ;(hud as any).merc = syncedMerc
    ;(hud.worldPanels as any).merc = syncedMerc
  } else {
    ;(hud as any).merc = null
    ;(hud.worldPanels as any).merc = null
  }
  if (!model.world.merc || Boolean((hud as any).merc?.isDead)) {
    if ((hud.leftPanel as string) === 'merc') {
      hud.leftPanel = 'none'
    }
  }

  // 5c2. Summoned Minions (PetType.txt & Hireables.cpp)
  const summonPortraits: Array<{
    readonly petType: number
    readonly iconKey: string
    readonly label: string
    readonly count: number
    readonly lifePct: number
    readonly drawHp: boolean
    readonly iconType: number
  }> = []

  if (model.world.pets && model.world.pets.size > 0) {
    const activePets = [...model.world.pets.values()].filter(
      (p: any) => !p.isDead && (p.ownerId === model.world.selfId || model.world.selfId === 0),
    )
    const byType = new Map<number, typeof activePets>()
    for (const p of activePets) {
      if (p.petType === 7) continue // Mercenary handled separately
      const arr = byType.get(p.petType) ?? []
      arr.push(p)
      byType.set(p.petType, arr)
    }
    for (const [petTypeIdx, pets] of byType.entries()) {
      const first = pets[0]!
      const portInfo = resolvePetPortraitInfo(petTypeIdx, first.classId)
      if (!portInfo) continue
      const count = pets.length
      const avgLifePct = Math.round(
        pets.reduce((sum: number, p: any) => {
          const rawPct = typeof p.lifePct === 'number' ? p.lifePct : 100
          const scale =
            p.lifePctScale === 100
              ? 100
              : p.lifePctScale === 128 || rawPct > 100
                ? 128
                : 100
          const pct100 = Math.max(0, Math.min(100, Math.round((rawPct * 100) / scale)))
          return sum + pct100
        }, 0) / count,
      )
      summonPortraits.push({
        petType: petTypeIdx,
        iconKey: portInfo.iconKey,
        label: ((hud as any).lang === 'CHI' || (hud as any)._lang === 'CHI') ? portInfo.nameZh : portInfo.nameEn,
        count,
        lifePct: avgLifePct,
        drawHp: portInfo.meta.drawHp,
        iconType: portInfo.meta.iconType,
      })
    }
  }
  ;(hud as any).summonPortraits = summonPortraits

  const rawHireList =
    (model.world.mercHireList && model.world.mercHireList.length > 0
      ? model.world.mercHireList
      : (model.world.merc as any)?.hireList) ?? []
  const playerLevel = Math.max(1, model.world.self.level ?? (model.world.self as any).stats?.get?.(12) ?? 1)
  const difficulty = model.world.difficulty ?? 0
  const activeNpcDesc = (hud.worldPanels as any).npcMenu?.descriptor ?? (model.world.npcInteraction.npcId ? model.tryNpcDescriptor(model.world.npcInteraction.npcId) : undefined)
  const actIndex = activeNpcDesc ? activeNpcDesc.actIndex : model.world.act ?? 0
  const hireLang = (hud.lang === 'ENG' || (hud as any).language === 'en') ? 'ENG' : 'CHI'
  const hireCandidates =
    rawHireList.length > 0
      ? resolveHirelingCandidates(
          rawHireList,
          playerLevel,
          difficulty,
          actIndex,
          model.world.expansion ?? true,
          hireLang,
        )
      : EMPTY_HIRE_CANDIDATES
  ;(hud as any).hireList = hireCandidates
  ;(hud as any).mercHireList = hireCandidates
  ;(hud.worldPanels as any).hireList = hireCandidates
  ;(hud.worldPanels as any).mercHireList = hireCandidates
  ;(hud.worldPanels as any).playerGold = model.world.self.gold ?? 0
  ;(hud.worldPanels as any).stashGold = model.world.self.stashGold ?? 0
  ;(hud.worldPanels as any).hireMercPanel = {
    open: (hud.leftPanel as string) === 'hire' || (hud.worldPanels as any).activePanel === 'hire',
    candidates: hireCandidates,
  }
  const hasDeadMercenary = Boolean(model.world.merc?.isDead && (model.world.merc?.reviveCost ?? 0) > 0)
  const deadMercenaryReviveCost = model.world.merc?.reviveCost ?? 0
  ;(hud.worldPanels as any).hasDeadMercenary = hasDeadMercenary
  ;(hud.worldPanels as any).deadMercenaryReviveCost = deadMercenaryReviveCost
  const deadMercName =
    hireLang === 'ENG'
      ? (model.world.merc?.name ??
          (model.world.merc?.nameId !== undefined
            ? resolveHirelingName(model.world.merc?.classId ?? 0, model.world.merc.nameId, 'ENG')
            : undefined))
      : (model.world.merc?.nameZh ??
          (model.world.merc?.nameId !== undefined
            ? resolveHirelingName(model.world.merc?.classId ?? 0, model.world.merc.nameId, 'CHI')
            : undefined))
  ;(hud.worldPanels as any).deadMercenaryName = deadMercName
  if (containersDirty) {
    model.cachedHasUnidentifiedItems = model.hasUnidentifiedItems()
  }
  ;(hud.worldPanels as any).hasUnidentifiedItems = model.cachedHasUnidentifiedItems

  // 5d. Party state
  const selfRoster = model.world.selfId !== 0 ? model.world.party.get(model.world.selfId) : undefined
  let selfPartyId =
    selfRoster?.partyId !== undefined && selfRoster.partyId !== 0xffff && selfRoster.partyId > 0
      ? selfRoster.partyId
      : 0xffff
  if (selfPartyId === 0xffff) {
    for (const m of model.world.party.values()) {
      const pid = m.unitId ?? (m as any).playerId ?? 0
      if (pid === 0 || (model.world.selfId !== 0 && pid === model.world.selfId)) continue
      if (
        (m.partyState === 1 ||
          (m as any).partyState === 'in_party' ||
          (m as any).relationship === 'in_party') &&
        m.partyId !== undefined &&
        m.partyId !== 0xffff &&
        m.partyId > 0
      ) {
        selfPartyId = m.partyId
        break
      }
    }
  }
  ;(hud.worldPanels as any).localPlayerId = model.world.selfId || 1
  ;(hud.worldPanels as any).localPlayerName =
    selfRoster?.charName || model.world.self.name || hud.charSheet?.attrs?.name || 'Hero'
  ;(hud.worldPanels as any).localPlayerClass =
    selfRoster?.charClass ?? model.world.self.charClass ?? 0
  ;(hud.worldPanels as any).localPlayerLevel =
    selfRoster?.charLevel ?? Math.max(1, model.world.self.level || 1)
  ;(hud.worldPanels as any).localPartyId = selfPartyId

  const prevPartyUiById = new Map<number, any>()
  for (const prevEntry of ((hud.worldPanels as any).partyMembers ?? []) as any[]) {
    const id = prevEntry?.unitId ?? prevEntry?.playerId ?? 0
    if (id > 0) prevPartyUiById.set(id, prevEntry)
  }

  const partyList = [...model.world.party.values()]
    .filter((m: any) => {
      const pid = m.unitId ?? m.playerId ?? 0
      if (pid === 0) return false
      if (model.world.selfId !== 0 && pid === model.world.selfId) return false
      return true
    })
    .map((m: any) => {
      const pid = m.unitId ?? m.playerId ?? 0
      const prevUi = prevPartyUiById.get(pid)
      const playerUnit = model.world.getUnit('player', pid)
      const prevValidName =
        typeof prevUi?.charName === 'string' &&
        prevUi.charName.length > 0 &&
        !prevUi.charName.startsWith('Player #')
          ? prevUi.charName
          : typeof prevUi?.name === 'string' &&
              prevUi.name.length > 0 &&
              !prevUi.name.startsWith('Player #')
            ? prevUi.name
            : undefined
      const resolvedName =
        m.name || m.charName || playerUnit?.name || prevValidName || `Player #${pid}`
      const unitClass =
        playerUnit && playerUnit.classId >= 0 && playerUnit.classId <= 6
          ? playerUnit.classId
          : undefined
      const resolvedClass = m.charClass ?? unitClass ?? prevUi?.charClass ?? 0
      const unitLevel = playerUnit?.stats?.get(12)
      const resolvedLevel =
        m.level ??
        m.charLevel ??
        (unitLevel !== undefined && unitLevel > 0 ? unitLevel : undefined) ??
        prevUi?.charLevel ??
        prevUi?.level ??
        1
      const defaultPartyId = selfPartyId !== 0xffff ? selfPartyId : 1
      const resolvedPartyId =
        m.partyId !== undefined && m.partyId !== 0xffff
          ? m.partyId
          : m.partyState === 1 || m.partyState === 'in_party' || m.relationship === 'in_party'
            ? defaultPartyId
            : m.partyId !== undefined
              ? m.partyId
              : m.partyState === 0 || m.partyState === 'none' || m.relationship === 'none'
                ? 0xffff
                : defaultPartyId
      let normalizedState: string
      if (typeof m.partyState === 'string' && m.partyState.length > 0) {
        normalizedState = m.partyState === 'hostile' ? 'none' : m.partyState
      } else if (typeof m.relationship === 'string' && m.relationship.length > 0) {
        normalizedState = m.relationship === 'hostile' ? 'none' : m.relationship
      } else if (m.partyState === 2 || m.partyState === 3) {
        normalizedState = 'invited_me'
      } else if (m.partyState === 4) {
        normalizedState = 'invited'
      } else if (m.partyState === 1) {
        normalizedState =
          selfPartyId !== 0xffff && resolvedPartyId !== 0xffff && resolvedPartyId !== selfPartyId
            ? 'none'
            : 'in_party'
      } else if (m.partyState === 0) {
        normalizedState =
          selfPartyId !== 0xffff && resolvedPartyId === selfPartyId ? 'in_party' : 'none'
      } else {
        normalizedState =
          resolvedPartyId !== 0xffff &&
          (selfPartyId === 0xffff || resolvedPartyId === selfPartyId)
            ? 'in_party'
            : 'none'
      }
      const resolvedPartyState = normalizedState
      const resolvedRelationship = normalizedState
      const mx = m.x ?? playerUnit?.x ?? prevUi?.x ?? 0
      const my = m.y ?? playerUnit?.y ?? prevUi?.y ?? 0
      let resolvedAreaId = m.levelId ?? m.areaId ?? 0
      if (!resolvedAreaId || resolvedAreaId === 0) {
        if (mx > 0 || my > 0) {
          const roomArea = model.world.resolveAreaFromRevealedRooms(mx, my)
          if (roomArea > 0) {
            resolvedAreaId = roomArea
          }
        }
        if ((!resolvedAreaId || resolvedAreaId === 0) && playerUnit && model.world.areaId > 0) {
          resolvedAreaId = model.world.areaId
        }
        if (!resolvedAreaId || resolvedAreaId === 0) {
          resolvedAreaId = prevUi?.areaId ?? prevUi?.levelId ?? 0
        }
      }
      const lootFlag = Boolean(m.lootPermit ?? m.lootAllowed ?? prevUi?.lootAllowed ?? prevUi?.lootPermit)
      const mutedFlag = Boolean(m.muted ?? m.squelched ?? prevUi?.muted ?? prevUi?.squelched)
      const ignoredFlag = Boolean(m.ignored ?? prevUi?.ignored)
      return {
        unitId: pid,
        playerId: pid,
        name: resolvedName,
        charName: resolvedName,
        charClass: resolvedClass,
        portraitIcon: resolvePlayerClassPortraitIcon(resolvedClass),
        level: resolvedLevel,
        charLevel: resolvedLevel,
        partyId: resolvedPartyId,
        relationship: resolvedRelationship,
        partyState: resolvedPartyState,
        // Issue #909 R3: PvP / Hostility disabled globally
        hostile: false,
        lootPermit: lootFlag,
        lootAllowed: lootFlag,
        muted: mutedFlag,
        squelched: mutedFlag,
        ignored: ignoredFlag,
        lifePct: m.lifePct ?? 100,
        areaId: resolvedAreaId,
        levelId: resolvedAreaId,
        x: mx,
        y: my,
      }
    })
  ;(hud as any).partyMembers = partyList
  ;(hud.worldPanels as any).partyMembers = partyList

  // 5d-2. 1.13c Chat Overlay, Message Log (`M`), and Unit Overhead Speech Bubbles
  model.world.expireChatAndOverhead()
  hud.chatOverlayMessages = model.world.activeChatOverlayEntries
  hud.messageLogEntries = model.world.messageLogEntries
  hud.worldPanels.messageLogEntries = model.world.messageLogEntries
  const predSnapForBubbles = model.predictor?.getSnapshot()
  const selfUnitForBubbles =
    model.world.selfId !== 0 ? model.world.getUnit('player', model.world.selfId) : undefined
  const camSubXForBubbles =
    predSnapForBubbles && (predSnapForBubbles.x !== 0 || predSnapForBubbles.y !== 0)
      ? predSnapForBubbles.x
      : model.world.self.x !== 0 || model.world.self.y !== 0
        ? model.world.self.x
        : (selfUnitForBubbles?.x ?? 0)
  const camSubYForBubbles =
    predSnapForBubbles && (predSnapForBubbles.x !== 0 || predSnapForBubbles.y !== 0)
      ? predSnapForBubbles.y
      : model.world.self.x !== 0 || model.world.self.y !== 0
        ? model.world.self.y
        : (selfUnitForBubbles?.y ?? 0)
  const bubbleProfile = hud.viewportProfile ?? VIEWPORT_800x600
  const bubblePanelShiftX = computePanelCameraShift(
    hud.leftPanel !== 'none',
    hud.rightPanel !== 'none',
    panelDockWidth(bubbleProfile),
  )
  const bubbleLang = hud.lang === 'ENG' ? 'ENG' : 'CHI'
  const overheadBubbles: Array<{
    readonly unitType: string
    readonly unitId: number
    readonly unitKey: string
    readonly screenX: number
    readonly screenY: number
    readonly text: string
    readonly color?: number | undefined
  }> = []
  for (const unit of model.world.units.values()) {
    if (unit.overheadText && unit.overheadText.length > 0 && !unit.dead) {
      const resolvedText = resolveOverheadBubbleText113c(
        unit.overheadText,
        unit.unitType,
        bubbleLang,
      )
      if (!resolvedText) continue
      const screenPos = subTileToScreen(
        unit.x,
        unit.y,
        camSubXForBubbles,
        camSubYForBubbles,
        bubbleProfile,
        bubblePanelShiftX,
      )
      overheadBubbles.push({
        unitType: unit.unitType,
        unitId: unit.id,
        unitKey: `${unit.unitType}:${unit.id}`,
        screenX: screenPos.x,
        screenY: screenPos.y,
        text: resolvedText,
        ...(unit.overheadColor !== undefined ? { color: unit.overheadColor } : {}),
      })
    }
  }
  hud.overheadSpeechBubbles = overheadBubbles

  // 5e. Player-to-player Trade state
  if (containersDirty) {
    model.cachedSelfTradeItems =
      model.world.containers.tradeSelf.size > 0
        ? model.world.containers.tradeGrid.map((item: ItemData) => model.toUiItem(item))
        : []
    model.cachedPartnerTradeItems =
      model.world.containers.tradePartner.size > 0
        ? model.world.containers.partnerTradeGrid.map((item: ItemData) => model.toUiItem(item))
        : []
    model.lastSyncedHudRef = hud
    model.lastSyncedContainersRev = containersRev
    model.lastSyncedContainersDigest = containersDigest
    model.lastSyncedPlayerLevel = self.level
    model.lastSyncedWeaponSet = self.weaponSet
    model.lastSyncedArtisanOpen = isArtisanPanelOpen
    model.lastSyncedQuestRewardId = questRewardId
    model.lastSyncedStoreOpen = storeOpen
  }
  const selfTradeItems = model.cachedSelfTradeItems
  const partnerTradeItems = model.cachedPartnerTradeItems
  const selfGold = Number((model.world.trade as any).selfGold ?? (model.world.trade as any).myGold ?? 0) || 0
  const partnerGold = Number(model.world.trade.partnerGold ?? 0) || 0
  const selfAccepted = Boolean((model.world.trade as any).selfAccepted ?? (model.world.trade as any).myAccepted)
  const partnerAccepted = Boolean(model.world.trade.partnerAccepted)
  const pendingModal = model.world.trade.pendingModal ?? null
  const tradeState = {
    ...model.world.trade,
    pendingModal,
    selfName: model.world.self.name || 'Player',
    selfGold,
    myGold: selfGold,
    partnerGold,
    selfAccepted,
    myAccepted: selfAccepted,
    partnerAccepted,
    selfItems: selfTradeItems,
    myItems: selfTradeItems,
    partnerItems: partnerTradeItems,
  }
  ;(hud as any).trade = tradeState
  ;(hud.worldPanels as any).trade = tradeState
  const tradeUiOpen = Boolean(model.world.trade.active || pendingModal)
  const tradeSessionActive = Boolean(model.world.trade.active)
  if (tradeSessionActive) {
    hud.leftPanel = 'trade' as any
    ;(hud.worldPanels as any).activePanel = 'trade'
    hud.rightPanel = 'inv'
    hud.inventory.visible = true
  } else if (pendingModal) {
    hud.leftPanel = 'trade' as any
    ;(hud.worldPanels as any).activePanel = 'trade'
  } else if (model.prevTradeActive && (hud.leftPanel as string) === 'trade') {
    hud.leftPanel = 'none'
    ;(hud.worldPanels as any).activePanel = 'none'
    if (model.prevTradeSessionActive) {
      // D2Client.dll 0x6fb09740: Closing an active trade session closes both PANEL_TRADE and PANEL_INVENTORY
      hud.rightPanel = 'none'
      hud.inventory.visible = false
      if (hud.goldDialog?.mode === 2) {
        hud.goldDialog = null
      }
    }
  }
  model.prevTradeActive = tradeUiOpen
  model.prevTradeSessionActive = tradeSessionActive

  // 6. Area, Waypoints & Quests
  if (model.world.areaId > 0) {
    hud.worldPanels.setCurrentLevel(model.world.areaId)
    if (model.prevAct !== model.world.act) {
      hud.worldPanels.selectedActTab = model.resolveActTabForArea(model.world.areaId, model.world.act)
      model.prevAct = model.world.act
    }
  }
  const waypointsHash = hashWaypointsSet(model.world.waypoints)
  if (
    model.lastSyncedWaypointsHudRef !== hud ||
    model.lastSyncedWaypointsHash !== waypointsHash ||
    hud.worldPanels.waypointUnlockedOverrides.size === 0
  ) {
    hud.worldPanels.setUnlockedWaypoints([...model.world.waypoints])
    model.lastSyncedWaypointsHudRef = hud
    model.lastSyncedWaypointsHash = waypointsHash
  }
  if (model.world.waypointMenuSeq !== model.handledWaypointMenuSeq) {
    model.handledWaypointMenuSeq = model.world.waypointMenuSeq
    if (model.world.waypointOpen && model.world.waypointUnitId !== null) {
      model.activeWaypointUnitId = model.world.waypointUnitId
      model.waypointPacketSent = false
      hud.worldPanels.selectedActTab = model.resolveActTabForArea(model.world.areaId, model.world.act)
      if (model.world.areaId > 0) {
        hud.worldPanels.setCurrentLevel(model.world.areaId)
      }
      if (hud.leftPanel !== 'waypoint') {
        hud.openLeftPanel('waypoint')
      }
    }
  } else if (model.activeWaypointUnitId !== null && !model.world.waypointOpen) {
    // `ClientWorld` dropped the waypoint menu (e.g. the player walked into another level with the
    // UI open). 1.13c closes the waypoint UI through `0x6fb5a380` on every path: unless 0x49 was
    // already sent (`0x6fbacdd5`), it sends `0x49 { [0x6fbacdcd] waypoint, level 0 }` — the stored
    // GUID survives level changes. Closing silently left D2Game's waypoint interact info set
    // (`SUNIT_SetInteractInfo` in the waypoint operate fn), so `PLAYER_IsBusy` kept refusing every
    // ground pick-up (0x16) and object operate (0x13) while walking still worked (#920).
    model.closeWaypoint()
  }
  const selReq = model.world.questLog.selectRequest
  let fallbackSelectAct: number | null = null
  if (selReq && selReq.seq !== model.handledQuestSelectSeq) {
    model.handledQuestSelectSeq = selReq.seq
    if (hud.worldPanels.selectedActTab - 1 === selReq.act) {
      if (selReq.local >= 0) {
        hud.worldPanels.selectedQuestIdx = selReq.local
      } else {
        // `0x6facda90` icon-animation-flag fallback (second half): the `S2C 0x52` reply after
        // `RequestQuestData` consumes the highlights and returns -1, which would clobber the
        // default selection made when the panel opened. Defer to after the status refresh and
        // re-select the act's first started, unfinished quest.
        fallbackSelectAct = selReq.act
      }
    }
  }
  const questStateHash = hashQuestState(model.world)
  if (
    model.lastSyncedQuestHudRef !== hud ||
    model.lastSyncedQuestStateHash !== questStateHash ||
    !hud.worldPanels.hasServerQuestState ||
    hud.worldPanels.questStatuses.size === 0 ||
    fallbackSelectAct !== null
  ) {
    hud.worldPanels.applyServerQuestState({
      quests: model.world.quests,
      gameQuests: model.world.gameQuests,
      questStatusBytes: model.world.questStatusBytes,
      denMonstersRemaining: model.world.denMonstersRemaining,
      questBarbsRemaining: model.world.questBarbsRemaining,
      tombOffset: model.world.questLog.tombOffset,
    })
    model.lastSyncedQuestHudRef = hud
    model.lastSyncedQuestStateHash = questStateHash
  }
  if (fallbackSelectAct !== null && hud.worldPanels.selectedActTab - 1 === fallbackSelectAct) {
    hud.worldPanels.selectedQuestIdx = model.firstActiveQuestIndex(fallbackSelectAct)
  }
  hud.worldPanels.cairnStoneOrder = model.world.questLog.cairnStoneOrder

  // 7. Target monster plaque
  model.syncHoveredMonsterTarget()

  // 8. NPC menu / store / stash panels and S2C 0x2A replies.
  model.syncNpcInteraction(hud)

  // 9. Refresh hovered items AFTER syncNpcInteraction so vendor-decorated player prices
  // (`sellCost`, `sellPrice`, `repairCost`) and vendor shop items (`buyCost`) are preserved.
  model.refreshHoveredItems(hud)

  hud.syncPublishedState()
}

export function refreshHoveredItemsImpl(hud: HudManager): void {
  const findFreshUiItem = (prevItem: UiInventoryItem): UiInventoryItem | null => {
    const prevId = String(prevItem.id)
    const prevServerId = (prevItem as { serverId?: number }).serverId
    const matchId = (cand: UiInventoryItem): boolean => {
      if (String(cand.id) === prevId) return true
      const candSid = (cand as { serverId?: number }).serverId
      return prevServerId !== undefined && candSid !== undefined && candSid === prevServerId
    }
    const rawPrev = prevItem.rawItem as
      | { gridX?: number; gridY?: number; x?: number; y?: number; storePage?: number; container?: string }
      | undefined
    const isShopItem = rawPrev?.container === 'shop' || prevItem.buyCost !== undefined
    if (isShopItem) {
      for (const p of hud.worldPanels.getActiveVendorPlacements()) {
        if (matchId(p.item)) return p.item
      }
      return null
    }
    for (const p of hud.inventory.gridItems) {
      if (matchId(p.item)) return p.item
    }
    for (const eq of Object.values(hud.inventory.equipped)) {
      if (eq && typeof eq === 'object' && matchId(eq)) return eq
    }
    if (hud.inventory.swapWeapons.weapon1 && matchId(hud.inventory.swapWeapons.weapon1)) {
      return hud.inventory.swapWeapons.weapon1
    }
    if (hud.inventory.swapWeapons.weapon2 && matchId(hud.inventory.swapWeapons.weapon2)) {
      return hud.inventory.swapWeapons.weapon2
    }
    if (hud.worldPanels.merc?.equipped) {
      for (const eq of Object.values(
        hud.worldPanels.merc.equipped as Record<string, UiInventoryItem | null | undefined>,
      )) {
        if (eq && typeof eq === 'object' && matchId(eq)) return eq
      }
    }
    if (hud.worldPanels.merc?.equipment) {
      for (const eq of Object.values(
        hud.worldPanels.merc.equipment as Record<string, UiInventoryItem | null | undefined>,
      )) {
        if (eq && typeof eq === 'object' && matchId(eq)) return eq
      }
    }
    for (const p of hud.worldPanels.stashItems) {
      if (matchId(p.item)) return p.item
    }
    for (const p of hud.worldPanels.cubeItems) {
      if (matchId(p.item)) return p.item
    }
    for (const p of hud.worldPanels.getActiveVendorPlacements()) {
      if (matchId(p.item)) return p.item
    }
    const prevCol = rawPrev?.gridX ?? rawPrev?.x
    const prevRow = rawPrev?.gridY ?? rawPrev?.y
    if (typeof prevCol === 'number' && typeof prevRow === 'number') {
      const list =
        rawPrev?.container === 'stash' || rawPrev?.storePage === 5
          ? hud.worldPanels.stashItems
          : rawPrev?.container === 'cube' || rawPrev?.storePage === 4
            ? hud.worldPanels.cubeItems
            : hud.inventory.gridItems
      const slotMatch = list.find(
        (p) => p.col === prevCol && p.row === prevRow && p.item.code === prevItem.code,
      )
      if (slotMatch) return slotMatch.item
    }
    return null
  }
  if (hud.inventory.hoveredItem) {
    const fresh = findFreshUiItem(hud.inventory.hoveredItem.item)
    if (fresh) {
      hud.inventory.hoveredItem = { ...hud.inventory.hoveredItem, item: fresh }
    }
  }
  if (hud.worldPanels.hoveredVendorItem) {
    const fresh = findFreshUiItem(hud.worldPanels.hoveredVendorItem.item)
    if (fresh) {
      hud.worldPanels.hoveredVendorItem = { ...hud.worldPanels.hoveredVendorItem, item: fresh }
    }
  }
  if (hud.worldPanels.hoveredStashItem) {
    const fresh = findFreshUiItem(hud.worldPanels.hoveredStashItem.item)
    if (fresh) {
      hud.worldPanels.hoveredStashItem = { ...hud.worldPanels.hoveredStashItem, item: fresh }
    }
  }
  if (hud.worldPanels.hoveredCubeItem) {
    const fresh = findFreshUiItem(hud.worldPanels.hoveredCubeItem.item)
    if (fresh) {
      hud.worldPanels.hoveredCubeItem = { ...hud.worldPanels.hoveredCubeItem, item: fresh }
    }
  }
  if (hud.worldPanels.hoveredMercItem) {
    const fresh = findFreshUiItem(hud.worldPanels.hoveredMercItem.item)
    if (fresh) {
      hud.worldPanels.hoveredMercItem = { ...hud.worldPanels.hoveredMercItem, item: fresh }
    }
  }
  if (hud.worldPanels.hoveredQuestRewardItem) {
    const fresh =
      findFreshUiItem(hud.worldPanels.hoveredQuestRewardItem.item) ??
      (hud.worldPanels.questRewardItem &&
      hud.worldPanels.questRewardItem.id === hud.worldPanels.hoveredQuestRewardItem.item.id
        ? hud.worldPanels.questRewardItem
        : null)
    if (fresh) {
      hud.worldPanels.hoveredQuestRewardItem = {
        ...hud.worldPanels.hoveredQuestRewardItem,
        item: fresh,
      }
    }
  }
  const wpAny = hud.worldPanels as {
    hoveredItem?: { item: UiInventoryItem; x: number; y: number } | null
  }
  if (wpAny.hoveredItem) {
    const fresh = findFreshUiItem(wpAny.hoveredItem.item)
    if (fresh) {
      wpAny.hoveredItem = { ...wpAny.hoveredItem, item: fresh }
    }
  }
}

export function resolveNpcScreenPositionImpl(
  model: any,
  npcId: number,
  hud: HudManager | null = model.hudManager,
): { x: number; y: number } | null {
  const npcUnit = model.world.getUnit('monster', npcId)
  if (!npcUnit || (npcUnit.x === 0 && npcUnit.y === 0)) {
    return null
  }
  const predSnap = model.predictor?.getSnapshot()
  const selfUnit =
    model.world.selfId !== 0 ? model.world.getUnit('player', model.world.selfId) : undefined
  const camSubX =
    predSnap && (predSnap.x !== 0 || predSnap.y !== 0)
      ? predSnap.x
      : model.world.self.x !== 0 || model.world.self.y !== 0
        ? model.world.self.x
        : (selfUnit?.x ?? 0)
  const camSubY =
    predSnap && (predSnap.x !== 0 || predSnap.y !== 0)
      ? predSnap.y
      : model.world.self.x !== 0 || model.world.self.y !== 0
        ? model.world.self.y
        : (selfUnit?.y ?? 0)
  if (camSubX === 0 && camSubY === 0) {
    return null
  }
  const profile = hud?.viewportProfile ?? VIEWPORT_800x600
  const tradeState = (hud as any)?.trade ?? (hud?.worldPanels as any)?.trade
  const isPendingTradeOnly =
    hud?.leftPanel === 'trade' &&
    !tradeState?.active &&
    (tradeState?.pendingModal === 'wait' || tradeState?.pendingModal === 'request')
  const leftOpen = hud ? hud.leftPanel !== 'none' && !isPendingTradeOnly : false
  const rightOpen = hud ? hud.rightPanel !== 'none' : false
  const panelShiftX = computePanelCameraShift(leftOpen, rightOpen, panelDockWidth(profile))
  return subTileToScreen(npcUnit.x, npcUnit.y, camSubX, camSubY, profile, panelShiftX)
}

export function syncNpcInteractionImpl(model: any, hud: HudManager): void {
  const pendingGambleIds = model.world.consumePendingGambleIdentifyItems()
  for (const gambleItemId of pendingGambleIds) {
    model.emitCommand({ type: 'NpcIdentifyGamble', itemId: gambleItemId >>> 0 })
  }
  const npc = model.world.npcInteraction
  const prev = model.prevNpc
  model.prevNpc = npc
  const wp = hud.worldPanels

  if (npc.npcId !== prev.npcId || npc.npcId === null || (!wp.npcMenu && !wp.npcSpeech)) {
    model.playedAutoQuestStringIds.clear()
  }

  const npcMessages =
    (npc.npcId !== null ? model.world.getNpcMessages(npc.npcId) : undefined) ?? npc.messages

  const activeWin = npc.activeWindow ?? npc.window
  const isHireOpen = ((hud.leftPanel as string) === 'hire' || (wp as any).activePanel === 'hire') && activeWin === 'hire'
  const isArtisanOpenOrPending =
    hud.leftPanel === 'imbue' ||
    hud.leftPanel === 'add_sockets' ||
    hud.leftPanel === 'personalize' ||
    hud.leftPanel === 'orifice' ||
    model.pendingArtisanConfirmNpcId !== null ||
    (model.world as any).awaitingArtisanConfirmNpcId != null
  if (activeWin === 'none') {
    if ((hud.leftPanel as string) === 'hire') hud.leftPanel = 'none'
    if ((wp as any).activePanel === 'hire') (wp as any).activePanel = 'none'
  }

  // a. NpcInit noted without a window: open the NPC menu for service NPCs (npc-table descriptors).
  if (
    npc.npcId !== null &&
    activeWin === 'none' &&
    !isHireOpen &&
    !isArtisanOpenOrPending &&
    (npc.npcId !== prev.npcId || !wp.npcMenu || wp.npcMenu.npcId === npc.npcId)
  ) {
    const desc = model.tryNpcDescriptor(npc.npcId)
    const npcScreen = model.resolveNpcScreenPosition(npc.npcId, hud)
    if (desc && npcScreen) {
      const anchor = computeNpcMenuAnchor(npcScreen.x, npcScreen.y)
      const hasDeadMercenary = Boolean(model.world.merc?.isDead && (model.world.merc?.reviveCost ?? 0) > 0)
      const deadMercenaryReviveCost = model.world.merc?.reviveCost ?? 0
      const unidentifiedItemCount = model.getUnidentifiedItemCount()
      const deadMercLang = (hud.lang === 'ENG' || (hud as any).language === 'en') ? 'ENG' : 'CHI'
      const deadMercenaryName =
        deadMercLang === 'ENG'
          ? (model.world.merc?.name ??
              (model.world.merc?.nameId !== undefined
                ? resolveHirelingName(model.world.merc?.classId ?? 0, model.world.merc.nameId, 'ENG')
                : ''))
          : (model.world.merc?.nameZh ??
              (model.world.merc?.nameId !== undefined
                ? resolveHirelingName(model.world.merc?.classId ?? 0, model.world.merc.nameId, 'CHI')
                : ''))
      const playerLevel = Math.max(1, model.world.self.level ?? (model.world.self as any).stats?.get?.(12) ?? 1)
      const hasUnid = model.hasUnidentifiedItems()
      const introPlayed = model.world.hasNpcIntroPlayed(model.world.act, desc.hcIdx)
      const hasAutoNpcMsg =
        npcMessages?.some(
          (m: any) =>
            m &&
            m.menu === 0 &&
            m.stringId > 0 &&
            ((isNpcIntroMessageId(m.stringId) && !introPlayed) ||
              (!isNpcIntroMessageId(m.stringId) &&
                resolveQuestTitleKeyForMsgId(m.stringId) !== undefined)) &&
            !model.playedAutoQuestStringIds.has(m.stringId),
        ) === true
      const willAutoPopSpeech =
        hasAutoNpcMsg || !introPlayed || Boolean((model.world as any).npcInitWantsInteract)
      const menuCtx = {
        unidentifiedItemCount,
        hasUnidentifiedItems: hasUnid,
        hasMerc: Boolean(model.world.merc && !model.world.merc.isDead),
        hasDeadMercenary,
        deadMercenaryReviveCost,
        deadMercenaryName,
        playerLevel,
        playerClass: model.world.self.charClass ?? model.world.self.classId ?? undefined,
        act: model.world.act,
        suppressGreeting: willAutoPopSpeech,
        questFlags: model.world.quests,
        questMessages: npcMessages,
        introPlayed,
        canGoToAct: (act: number) => model.world.canGoToAct(act),
        expansion: model.world.expansion,
        respecAvailable:
          (model.world as any).respecAvailable ??
          (((model.world.quests[1] ?? 0) & 1) !== 0 &&
            ((model.world.quests[41] ?? 0) & 1) === 0 &&
            ((model.world.quests[41] ?? 0) === 0 || ((model.world.quests[41] ?? 0) & 2) !== 0)),
      }
      if (wp.npcMenu && wp.npcMenu.npcId === npc.npcId && npc.npcId === prev.npcId) {
        wp.npcMenu.x = anchor.x
        wp.npcMenu.y = anchor.y
        wp.npcMenu.questMessages = npcMessages ? [...npcMessages] : []
        ;(wp.npcMenu as any).context = menuCtx
        if (typeof (wp as any).buildNpcMenuOptions === 'function') {
          const nextPrimaryOptions = (wp as any).buildNpcMenuOptions(desc, menuCtx)
          wp.npcMenu.primaryOptions = nextPrimaryOptions
          if (!wp.npcMenu.talking && wp.npcMenu.submenu !== 'respec') {
            // The Akara respec confirm submenu (D2Client.dll 0x6faf9c80) owns its options until confirm/cancel.
            const nextOptions =
              wp.npcMenu.submenu === 'talk' && typeof (wp as any).buildNpcTalkSubmenuOptions === 'function'
                ? (wp as any).buildNpcTalkSubmenuOptions(desc, menuCtx)
                : nextPrimaryOptions
            wp.npcMenu.options = nextOptions
            if ((wp.npcMenu.hoveredOptionIdx ?? -1) >= nextOptions.length) {
              wp.npcMenu.hoveredOptionIdx = Math.max(-1, nextOptions.length - 1)
            }
          }
        }
      } else {
        ;(wp as any).openNpcMenu(desc, anchor.x, anchor.y, npc.npcId, menuCtx)
      }
    }
  }

  // D2Client.dll 0x6fafba20 -> 0x6faf5ff0 / 0x6fafb230:
  // Auto-pop speech on menu === 0 from S2C 0x27 and dispatch C2S 0x31 (+ 0x40 for quest topics).
  const isAutoQuestMessage = (m: { readonly menu: number; readonly stringId: number }): boolean =>
    m.menu === 0 &&
    m.stringId > 0 &&
    !isNpcIntroMessageId(m.stringId) &&
    resolveQuestTitleKeyForMsgId(m.stringId) !== undefined
  const isAutoIntroMessage = (m: { readonly menu: number; readonly stringId: number }): boolean =>
    m.menu === 0 && m.stringId > 0 && isNpcIntroMessageId(m.stringId)
  const playNextAutoNpcSpeech = (npcUnitId: number, desc: TownNpcServiceDescriptor): void => {
    const currentMsgs = model.world.getNpcMessages(npcUnitId) ?? model.world.npcInteraction.messages
    const introPlayed = model.world.hasNpcIntroPlayed(model.world.act, desc.hcIdx)
    const nextMsg =
      !introPlayed
        ? currentMsgs?.find(
            (m: any) => isAutoIntroMessage(m) && !model.playedAutoQuestStringIds.has(m.stringId),
          )
        : undefined
    const nextQuestMsg = currentMsgs?.find(
      (m: any) => isAutoQuestMessage(m) && !model.playedAutoQuestStringIds.has(m.stringId),
    )
    const chainClose = (): void => {
      if (model.world.npcInteraction.npcId === npcUnitId) {
        playNextAutoNpcSpeech(npcUnitId, desc)
      }
    }
    if (nextMsg) {
      ;(wp as any).activeNpcId = npcUnitId
      const stringId = nextMsg.stringId
      model.playedAutoQuestStringIds.add(stringId)
      model.world.markNpcIntroPlayed(model.world.act, desc.hcIdx)
      model.questMessage(npcUnitId, stringId)
      const introText = resolveNpcDialogueTblText(desc, {
        topic: 'quest',
        questStringId: stringId,
        lang: wp.lang,
      })
      wp.openNpcSpeech(desc, introText, 'intro', stringId, chainClose)
      return
    }
    if (nextQuestMsg) {
      ;(wp as any).activeNpcId = npcUnitId
      const stringId = nextQuestMsg.stringId
      model.playedAutoQuestStringIds.add(stringId)
      model.questMessage(npcUnitId, stringId)
      model.requestQuestData()
      wp.openNpcSpeech(desc, undefined, 'quest', stringId, chainClose)
    }
  }
  if (
    npc.npcId !== null &&
    activeWin === 'none' &&
    !isHireOpen &&
    !isArtisanOpenOrPending &&
    (wp.npcSpeech === null || !wp.npcMenu?.talking)
  ) {
    const desc = model.tryNpcDescriptor(npc.npcId)
    const introPlayed = desc
      ? model.world.hasNpcIntroPlayed(model.world.act, desc.hcIdx)
      : true
    const hasPendingAutoNpcMessage =
      npcMessages?.some(
        (m: any) =>
          ((isAutoIntroMessage(m) && !introPlayed) || isAutoQuestMessage(m)) &&
          !model.playedAutoQuestStringIds.has(m.stringId),
      ) === true
    if (desc && hasPendingAutoNpcMessage) {
      playNextAutoNpcSpeech(npc.npcId, desc)
    } else if (
      desc &&
      !hasPendingAutoNpcMessage &&
      (model.world.consumeNpcInitWantsInteract() || !introPlayed)
    ) {
      const playerClass = model.world.self.charClass ?? model.world.self.classId ?? undefined
      const classIntroStrId = resolveNpcIntroStringId113c(desc.hcIdx, model.world.act, playerClass)
      const introTblKey =
        resolveNpcIntroTblKey113c(desc.hcIdx, model.world.act, playerClass, desc.npcTxtKey) ??
        NPC_CANONICAL_INTRO_KEYS[desc.npcTxtKey] ??
        desc.npcTxtKey
      const introText =
        resolveNpcDialogueTblText(introTblKey, { lang: wp.lang }) ??
        resolveNpcDialogueTblText(desc, { topic: 'intro', lang: wp.lang })
      const c2sIntroMsgId = resolveNpcIntroMsgIdByTblKey(
        NPC_CANONICAL_INTRO_KEYS[desc.npcTxtKey] ?? desc.npcTxtKey,
      )
      const speechIntroMsgId =
        classIntroStrId !== undefined && classIntroStrId > 0 ? classIntroStrId : c2sIntroMsgId
      model.world.markNpcIntroPlayed(model.world.act, desc.hcIdx)
      if (c2sIntroMsgId !== undefined) {
        model.questMessage(npc.npcId, c2sIntroMsgId)
      }
      ;(wp as any).activeNpcId = npc.npcId
      wp.openNpcSpeech(desc, introText, 'intro', speechIntroMsgId, undefined)
    }
  }

  // D2Client.dll 0x6fafba20 -> 0x6fb21460 -> 0x6fb212c0:
  // Object speech boxes (`unitType === 2`, e.g. Tower Tome `127`, Horadric Orifice `396`, Ancients Altar `20002`, etc.)
  if (
    npc.unitType === 2 &&
    npc.npcId !== null &&
    (wp.npcSpeech === null || !wp.npcMenu?.talking)
  ) {
    const objId = npc.npcId
    const nextObjMsg = npcMessages?.find((m: any) => m.stringId > 0 && !model.playedAutoQuestStringIds.has(m.stringId))
    if (nextObjMsg) {
      const stringId = nextObjMsg.stringId
      model.playedAutoQuestStringIds.add(stringId)
      const tblKey = CANONICAL_NPC_MSG_ID_TO_TBL_KEY[stringId]
      const text =
        (tblKey ? lookupTbl(tblKey, wp.lang) : undefined) ??
        lookupTbl(`string#${stringId}`, wp.lang) ??
        ''
      if (text) {
        wp.openStandaloneSpeech('', text, {
          stringId,
          onClose: () => {
            model.world.clearObjectNpcInteraction(objId)
            if (stringId > 0) {
              // D2Client.dll 0x6fb212c0 (ScrollSpeech_Close) & 0x6faf4f20 (Send0x31_QuestMessage):
              // Closing an object scroll speech sends C2S 0x31 QuestMessage(0xffffffff, stringId).
              model.questMessage(0xffffffff, stringId)
            }
          },
        })
      } else {
        model.world.clearObjectNpcInteraction(objId)
      }
    }
  }

  if ((npc.npcId === null || isHireOpen) && wp.npcMenu && wp.npcMenu.npcId !== null) {
    if (npc.npcId === null || isHireOpen) {
      wp.npcMenu = null
    }
  }
  if (npc.npcId === null && prev.npcId !== null) {
    if (wp.npcSpeech && wp.npcSpeech.npcId === prev.npcId) {
      wp.npcSpeech = null
    }
    ;(wp as any).activeNpcId = null
  }

  // b. Trade / gamble window: store items come from 0x9C AddToShop (`containers.shop`).
  const npcWin = (npc.window !== 'none' ? npc.window : (npc.activeWindow ?? 'none')) as string
  const prevWin = (prev.window !== 'none' ? prev.window : (prev.activeWindow ?? 'none')) as string
  if ((npcWin === 'trade' || npcWin === 'gamble') && npc.npcId !== null) {
    const npcId = npc.npcId
    const desc = model.npcDescriptor(npcId)
    if (!desc) throw new Error(`HudModel: store opened for NPC #${npcId} without a service descriptor`)
    let questHash = 0
    const qArr = model.world.quests
    if (Array.isArray(qArr)) {
      for (let i = 0; i < qArr.length; i++) {
        questHash = ((questHash * 31) + (qArr[i] ?? 0)) | 0
      }
    }
    const vendorKey = `${npcId}:${npcWin}:${model.lastSyncedContainersRev}:${model.lastSyncedContainersDigest}:${model.world.self.level}:${model.world.self.weaponSet}:${model.world.difficulty}:${model.world.self.stats.get(87)}:${questHash}`
    if (model.lastSyncedVendorKey !== vendorKey) {
      const ctx = model.priceContext(npcId)
      const price = model.requireVendorPrice()
      const gamble = npcWin === 'gamble'
      const items = [...model.world.containers.shop.values()].map((item: ItemData) => ({
        storePage: item.storePage,
        placement: {
          item: { ...model.toUiItem(item), buyCost: price(item, gamble ? 2 : 0, ctx) },
          col: item.gridX,
          row: item.gridY,
        },
      }))
      wp.setVendorShop({ npcId, descriptor: desc, mode: npcWin as 'trade' | 'gamble', items })
      const canRepair = desc.canRepair && !gamble
      wp.vendorRepairAllCost = canRepair ? model.requireVendorRepairAll()(ctx) : null
      model.decoratePlayerItemPrices(hud, price, ctx, canRepair)
      model.lastSyncedVendorKey = vendorKey
    }
    if (prevWin !== npcWin || prev.npcId !== npcId) hud.showVendorPanel()
  } else if (
    npc.npcId !== null &&
    (npcWin === 'hire' ||
      activeWin === 'hire' ||
      npcWin === 'imbue' ||
      npcWin === 'add_sockets' ||
      npcWin === 'personalize' ||
      npcWin === 'orifice')
  ) {
    const targetWin = (npcWin === 'hire' || activeWin === 'hire') ? 'hire' : npcWin
    hud.leftPanel = targetWin as any
    ;(wp as any).activePanel = targetWin
    if (targetWin === 'hire') {
      wp.npcMenu = null
    }
    if (
      targetWin === 'imbue' ||
      targetWin === 'add_sockets' ||
      targetWin === 'personalize' ||
      targetWin === 'orifice'
    ) {
      hud.rightPanel = 'inv'
      hud.inventory.visible = true
    }
  } else if (prevWin !== 'none' || (npc.npcId === null && prev.npcId !== null)) {
    if (
      prevWin === 'trade' ||
      prevWin === 'gamble' ||
      (npc.npcId === null && prev.npcId !== null && hud.leftPanel === 'vendor')
    ) {
      model.lastSyncedVendorKey = null
      wp.clearVendorShop()
      hud.hideLeftPanelFromWorld('vendor')
    } else if (
      (prevWin !== 'none' && (hud.leftPanel as string) === prevWin) ||
      (npc.npcId === null &&
        prev.npcId !== null &&
        (hud.leftPanel === 'hire' ||
          hud.leftPanel === 'imbue' ||
          hud.leftPanel === 'add_sockets' ||
          hud.leftPanel === 'personalize' ||
          hud.leftPanel === 'orifice'))
    ) {
      if ((wp as any).questRewardItem) {
        if (!hud.inventory.cursorItem) {
          hud.inventory.cursorItem = (wp as any).questRewardItem
        } else {
          hud.inventory.autoPlaceInGrid((wp as any).questRewardItem)
        }
        ;(wp as any).questRewardItem = null
      }
      ;(wp as any).hoveredQuestRewardItem = null
      const keepInvOpenForArtisanCursor =
        (prevWin === 'imbue' || prevWin === 'add_sockets' || prevWin === 'personalize') &&
        hud.inventory.cursorItem !== null
      hud.leftPanel = 'none'
      ;(wp as any).activePanel = 'none'
      if (hud.rightPanel === 'inv' && !keepInvOpenForArtisanCursor) {
        hud.rightPanel = 'none'
        hud.inventory.visible = false
      }
      hud.syncPublishedState()
    }
  }

  // c. Stash: opened by S2C 0x77 action 0x10, closed when 0x4F 0x12 is sent.
  if (npc.stashOpen && !prev.stashOpen) hud.showStashPanel()
  else if (!npc.stashOpen && prev.stashOpen) hud.hideLeftPanelFromWorld('stash')

  // c2. Horadric Cube: opened by S2C 0x77 action 0x15 (UPDATEUI_OPENCUBE), closed when 0x4F 0x17 is sent.
  if (npc.cubeOpen && !prev.cubeOpen) hud.showCubePanel()
  else if (!npc.cubeOpen && prev.cubeOpen) hud.hideLeftPanelFromWorld('cube')

  // d. S2C 0x2A NPCTransaction: react once per reply.
  const txn = model.world.lastNpcTransaction
  if (txn && txn.seq !== model.handledNpcTransactionSeq) {
    model.handledNpcTransactionSeq = txn.seq
    const msgKey = npcTransactionMessageKey(txn.result)
    if (msgKey !== null) {
      const text = requireTbl(msgKey, hud.lang)
      model.lastNpcTransactionMessage = { tblKey: msgKey, text }
      wp.showVendorStatus(text, 'white')
    } else if (txn.result === 1) {
      model.uiSound?.(NPC_SELL_SOUND_ID)
    } else if (txn.result === 0) {
      // D2Client.dll 0x6fafb694..0x6fafb6ae: buy success plays [0x6fbc9753] (the bought item's dropsound,
      // stored by the 0x32 request) and clears it (#991).
      const buySound = model.pendingVendorBuySoundId
      model.pendingVendorBuySoundId = 0
      if (buySound > 0) model.uiSound?.(buySound)
    }
  }
}

export function decoratePlayerItemPricesImpl(
  model: any,
  hud: HudManager,
  price: VendorPriceFn,
  ctx: VendorPriceContext,
  canRepair: boolean,
): void {
  const decorate = (ui: UiInventoryItem, raw: ItemData): UiInventoryItem => {
    const sellCost = price(raw, 1, ctx)
    const canRepairItem =
      canRepair &&
      raw.maxDurability !== undefined &&
      raw.maxDurability > 0 &&
      !raw.ethereal &&
      ((raw.rawFlags ?? 0) & 0x400000) === 0 &&
      (typeof raw.flags !== 'number' || (raw.flags & 0x400000) === 0)
    const curDur = raw.curDurability ?? raw.durability ?? 0
    const repCost = canRepairItem && curDur < raw.maxDurability ? price(raw, 3, ctx) : 0
    return {
      ...ui,
      sellCost,
      sellPrice: sellCost,
      ...(canRepairItem ? { repairCost: repCost } : {}),
    }
  }
  hud.inventory.gridItems = hud.inventory.gridItems.map((pl) => {
    const raw = model.world.containers.inventory.get(Number(pl.item.id))
    if (!raw) throw new Error(`HudModel: inventory item ${pl.item.id} missing from ClientWorld`)
    return { ...pl, item: decorate(pl.item, raw) }
  })
  for (const raw of model.world.containers.equipment.values()) {
    const bodyLoc = raw.bodyLoc || raw.equippedSlot
    if (bodyLoc === 11) {
      if (hud.inventory.swapWeapons.weapon1) {
        hud.inventory.swapWeapons.weapon1 = decorate(hud.inventory.swapWeapons.weapon1, raw)
      }
      continue
    }
    if (bodyLoc === 12) {
      if (hud.inventory.swapWeapons.weapon2) {
        hud.inventory.swapWeapons.weapon2 = decorate(hud.inventory.swapWeapons.weapon2, raw)
      }
      continue
    }
    const slot = BODY_LOC_TO_EQUIP_SLOT[bodyLoc]
    const ui = slot ? hud.inventory.equipped[slot] : undefined
    if (slot && ui) hud.inventory.equipped[slot] = decorate(ui, raw)
  }
  if (model.world.containers.cursor && hud.inventory.cursorItem) {
    hud.inventory.cursorItem = decorate(hud.inventory.cursorItem, model.world.containers.cursor)
  }
  model.lastSyncedGridItemsRef = hud.inventory.gridItems
  model.lastSyncedCursorItemRef = hud.inventory.cursorItem
}

export function syncHoveredMonsterTargetImpl(model: any): void {
  const hud = model.hudManager
  if (!hud) return
  if (model.hoveredMonsterId === null) {
    hud.targetMonster = null
    hud.worldPanels.hoveredMonster = null
    return
  }
  const unit = model.world.getUnit('monster', model.hoveredMonsterId)
  if (
    !unit ||
    unit.isNpc ||
    isTownNpcHcIdx(unit.classId) ||
    unit.lifePct <= 0 ||
    unit.mode === 0 ||
    unit.mode === 12
  ) {
    hud.targetMonster = null
    hud.worldPanels.hoveredMonster = null
    return
  }
  // D2Client.dll 0x6fb708a3..0x6fb708c4: skip town NPCs, non-killable units, and empty NameStr
  const kind = getMonsterKindByHcIdx(unit.classId, model.world.difficulty)
  if (kind && (kind.inTown || kind.npc || kind.interact || !kind.killable || !kind.nameKey)) {
    hud.targetMonster = null
    hud.worldPanels.hoveredMonster = null
    return
  }
  hud.targetMonster = clientUnitToMonsterTargetInfo(unit, model.world.difficulty)
  hud.worldPanels.hoveredMonster = hud.targetMonster
}
