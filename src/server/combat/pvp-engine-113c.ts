/**
 * 1.13c Hostile PvP Rules, `C2S 0x5D` Relationship Gates, Town Portal Lockout,
 * PvP Damage Scaling, Personalized Ear Drop & `S2C 0x5A` Kill Broadcast (`#1784`, `#1858`).
 *
 * Ground truth (`D2Game.dll` v1.13c):
 * - `0x6FD11060..0x6FD112B9` (`Packet_0x5D_PlayerRelation`):
 *   - `button === 0x01`: Squelch / Mute toggle (`relation` bit 1).
 *   - `button === 0x02`: Hardcore-only Corpse Loot permit toggle (`relation` bit 2; rejected in Softcore).
 *   - `button === 0x03 | 0x04`: Hostility toggle (`relation` bit 4/8):
 *     - Initiator must currently stand in a Town area (`0x6FD11146` `DUNGEON_IsTown`).
 *     - Both initiator and target must have `STAT_LEVEL >= 9` (`0x6FD11153..0x6FD11177`).
 *     - Enabling hostility auto-leaves any shared party (`0x6FCBC840`), immediately destroys the
 *       initiator's active blue Town Portal (`0x6FD11225 -> 0x6FC586F0`), and stamps a 60-second
 *       (`1500` frames at 25Hz) portal + waypoint lockout on the initiator (`[pPlayerData + 0x160]`).
 * - `0x6FC8D176` (Portal `OperateFn`) & `0x6FCF0D61` (`Packet_0x49_WaypointGo`):
 *   - Reject portal entry (blue TP `59` and red portal `60`) and waypoint travel while within the
 *     1500-frame hostility lockout period.
 *   - Player-owned blue Town Portals (`59`) additionally require `portalOwnerId === player.unitId`
 *     or active party alliance (`areAllied`).
 * - `0x6FCFAC10` (`SUNITDMG_GetDamagePercentModifier`, table @ `0x6FD28140`):
 *   - Player, Mercenary, or Player-Owned Minion -> Player defender: `17%` (`1/6`).
 *   - Mercenary -> Mercenary defender: `25%` (`1/4`).
 *   - Player / Minion -> Mercenary or Minion defender: `100%`.
 * - `0x6FC99E40..0x6FC99FA2`, `0x6FC32AF0`, `0x6FCEC370` (PvP Victim Death):
 *   - Zero experience penalty (`killerType: 'player' | 'player_pet'`).
 *   - PK gold pile drop + equipped corpse spawn.
 *   - Personalized compact `'ear '` (`IFLAG_EAR | IFLAG_COMPACT | IFLAG_IDENTIFIED`) dropped at victim's
 *     death coordinates with `earClass`, `earLevel`, and `earName = victim.name`.
 *   - `S2C 0x5A` (`eventType = 0x06`, `color = 4`, `name1 = victim`, `name2 = killerOwner`) broadcast to
 *     all players in the game (resolving pet/mercenary kills to their owning player).
 *
 * Pure isomorphic module: zero `node:*`, zero `Math.random()`, zero wall-clock calls, zero DOM globals.
 */

import type { CharClassId, ItemData, ItemQuality, ServerEvent, UnitId } from '../../netproto/index.ts'

/** Canonical 1.13c `C2S 0x5D` (`PlayerRelation`) button codes (`D2Client.dll` Party screen + `D2Game.dll` `0x6FD11060`). */
export const D2GS_0X5D_BUTTON_113C = {
  MUTE: 0x01,
  LOOT_PERMIT: 0x02,
  HOSTILE_ALT: 0x03,
  HOSTILE: 0x04,
} as const

/** Minimum character level required on BOTH players to declare hostility (`D2Game.dll` `0x6FD11153..0x6FD11177`). */
export const PVP_MIN_HOSTILE_LEVEL_113C = 9

/** 60-second (`60,000 ms` = `1500` ticks @ 25Hz) TP + Waypoint lockout after declaring hostility (`D2Game.dll` `0x6FC8D176`, `0x6FCF0D61`). */
export const PVP_HOSTILE_PORTAL_LOCKOUT_FRAMES_113C = 1500

/** Canonical 5-Act Town `Levels.txt` IDs (`Rogue Encampment=1`, `Lut Gholein=40`, `Kurast Docks=75`, `Pandemonium Fortress=103`, `Harrogath=109`). */
export const PVP_TOWN_AREAS_113C: ReadonlySet<number> = new Set([1, 40, 75, 103, 109])

/** 1.13c `SUNITDMG_GetDamagePercentModifier` (`0x6FCFAC10`) PvP multipliers. */
export const PVP_PLAYER_DAMAGE_PERCENT_113C = 17
export const PVP_MERC_VS_MERC_DAMAGE_PERCENT_113C = 25

/** Item bitstream flags for a dropped player ear (`IFLAG_IDENTIFIED | IFLAG_EAR | IFLAG_COMPACT`). */
const EAR_ITEM_RAW_FLAGS_113C = 0x00210010

export type PvpUnitCategory113c = 'player' | 'mercenary' | 'minion'

export type PlayerRelation0x5DValidation113c =
  | {
      readonly kind: 'reject'
      readonly reason:
        | 'self_target'
        | 'invalid_button'
        | 'loot_requires_hardcore'
        | 'pvp_disabled'
        | 'not_in_town'
        | 'below_level_9'
    }
  | {
      readonly kind: 'mute'
      readonly muted: boolean
    }
  | {
      readonly kind: 'loot_permit'
      readonly permitted: boolean
    }
  | {
      readonly kind: 'hostile'
      readonly hostile: boolean
      readonly button: 3 | 4
      readonly closeInitiatorTownPortal: boolean
      readonly portalLockoutFrames: number
    }

/** `DUNGEON_IsTown`: returns true iff `areaId` is one of the 5 Act towns. */
export function isTownArea113c(areaId: number): boolean {
  return PVP_TOWN_AREAS_113C.has(areaId)
}

/** Returns true iff the player record has Hardcore status (`isHardcore === true` or `statusFlags & 0x04`). */
export function isPlayerHardcore113c(player: {
  readonly isHardcore?: boolean | undefined
  readonly statusFlags?: number | undefined
}): boolean {
  return player.isHardcore === true || ((player.statusFlags ?? 0) & 0x04) !== 0
}

/**
 * Validate a `C2S 0x5D` (`SetPlayerRelationship`) request against 1.13c `D2Game.dll` `0x6FD11060..0x6FD112B9`.
 */
export function validatePlayerRelation0x5D113c(params: {
  readonly allowPvpHostile: boolean
  readonly actorPlayerId: number
  readonly actorAreaId: number
  readonly actorLevel: number
  readonly actorIsHardcore: boolean
  readonly targetPlayerId: number
  readonly targetLevel: number
  readonly targetIsHardcore: boolean
  readonly state: boolean
  readonly button?: number | undefined
}): PlayerRelation0x5DValidation113c {
  if (params.actorPlayerId === params.targetPlayerId) {
    return { kind: 'reject', reason: 'self_target' }
  }
  const btn = params.button ?? D2GS_0X5D_BUTTON_113C.HOSTILE
  if (btn === D2GS_0X5D_BUTTON_113C.MUTE) {
    return { kind: 'mute', muted: params.state }
  }
  if (btn === D2GS_0X5D_BUTTON_113C.LOOT_PERMIT) {
    if (!params.actorIsHardcore || !params.targetIsHardcore) {
      return { kind: 'reject', reason: 'loot_requires_hardcore' }
    }
    return { kind: 'loot_permit', permitted: params.state }
  }
  if (btn === D2GS_0X5D_BUTTON_113C.HOSTILE_ALT || btn === D2GS_0X5D_BUTTON_113C.HOSTILE) {
    if (!params.allowPvpHostile) {
      return { kind: 'reject', reason: 'pvp_disabled' }
    }
    if (!isTownArea113c(params.actorAreaId)) {
      return { kind: 'reject', reason: 'not_in_town' }
    }
    if (
      params.actorLevel < PVP_MIN_HOSTILE_LEVEL_113C ||
      params.targetLevel < PVP_MIN_HOSTILE_LEVEL_113C
    ) {
      return { kind: 'reject', reason: 'below_level_9' }
    }
    return {
      kind: 'hostile',
      hostile: params.state,
      button: btn === 3 ? 3 : 4,
      closeInitiatorTownPortal: params.state,
      portalLockoutFrames: params.state ? PVP_HOSTILE_PORTAL_LOCKOUT_FRAMES_113C : 0,
    }
  }
  return { kind: 'reject', reason: 'invalid_button' }
}

/** True while `currentFrame` is strictly before `hostilePortalLockUntilFrame` (`1500` frames after declaring hostility). */
export function isHostilePortalLocked113c(
  currentFrame: number,
  hostilePortalLockUntilFrame: number | undefined,
): boolean {
  return hostilePortalLockUntilFrame !== undefined && currentFrame < hostilePortalLockUntilFrame
}

/**
 * 1.13c Portal entry eligibility (`D2Game.dll` `0x6FC8D176`):
 * - Blocks Town Portal (`classId === 59` / `portalOwnerId !== undefined`) and Permanent/Red Portal (`classId === 60`)
 *   while the player's 60-second (`1500`-frame) hostility lockout is active.
 * - Blocks player-owned blue Town Portals (`portalOwnerId > 0`) unless the player is the owner or currently allied
 *   in the same party (`areAllied`).
 */
export function canEnterPortalInPvp113c(params: {
  readonly currentFrame: number
  readonly playerUnitId: number
  readonly hostilePortalLockUntilFrame?: number | undefined
  readonly portalClassId: number
  readonly portalOwnerId?: number | undefined
  readonly isAlliedWithOwner: boolean
}): boolean {
  const isPortalObject =
    params.portalOwnerId !== undefined ||
    params.portalClassId === 59 ||
    params.portalClassId === 60
  if (isPortalObject && isHostilePortalLocked113c(params.currentFrame, params.hostilePortalLockUntilFrame)) {
    return false
  }
  if (params.portalOwnerId !== undefined && params.portalOwnerId > 0) {
    if (params.portalOwnerId !== params.playerUnitId && !params.isAlliedWithOwner) {
      return false
    }
  }
  return true
}

/** 1.13c Waypoint travel eligibility (`D2Game.dll` `0x6FCF0D61`): blocked during the 1500-frame hostility lockout. */
export function canUseWaypointInPvp113c(
  currentFrame: number,
  hostilePortalLockUntilFrame?: number | undefined,
): boolean {
  return !isHostilePortalLocked113c(currentFrame, hostilePortalLockUntilFrame)
}

/** 1.13c Hardcore Corpse Loot gate: both victim and looter must be Hardcore and `victim -> looter` loot permission set. */
export function canLootPlayerCorpse113c(params: {
  readonly looterUnitId: number
  readonly victimUnitId: number
  readonly looterIsHardcore: boolean
  readonly victimIsHardcore: boolean
  readonly hasLootPermission: boolean
}): boolean {
  return (
    params.looterUnitId !== params.victimUnitId &&
    params.looterIsHardcore &&
    params.victimIsHardcore &&
    params.hasLootPermission
  )
}

/**
 * 1.13c Hostile PvP combat gate (`D2Game.dll` `SUNITDMG_IsHitAllowed` / `PLAYER_AreUnitsHostile`):
 * - Both root player owners must be distinct and mutually hostile (`PartyManager.areHostile`).
 * - Neither attacker nor defender may stand inside a Town area (`DUNGEON_IsTown` immunity).
 * - Room policy must allow hostile PvP (`policy.allowPvpHostile`).
 */
export function isHostilePvpCombatAllowed113c(params: {
  readonly allowPvpHostile: boolean
  readonly attackerOwnerPlayerId: number
  readonly attackerAreaId: number
  readonly defenderOwnerPlayerId: number
  readonly defenderAreaId: number
  readonly areHostile: boolean
  readonly sameAreaOrSeamAdjacent?: boolean | undefined
}): boolean {
  if (!params.allowPvpHostile) return false
  if (params.attackerOwnerPlayerId <= 0 || params.defenderOwnerPlayerId <= 0) return false
  if (params.attackerOwnerPlayerId === params.defenderOwnerPlayerId) return false
  if (!params.areHostile) return false
  if (isTownArea113c(params.attackerAreaId) || isTownArea113c(params.defenderAreaId)) return false
  if (params.sameAreaOrSeamAdjacent === false) return false
  return true
}

/** 1.13c `SUNITDMG_GetDamagePercentModifier` (`0x6FCFAC10`) percentage (`17`, `25`, or `100`). */
export function computePvpDamagePercent113c(
  attackerKind: PvpUnitCategory113c,
  defenderKind: PvpUnitCategory113c,
): number {
  if (defenderKind === 'player') {
    return PVP_PLAYER_DAMAGE_PERCENT_113C
  }
  if (attackerKind === 'mercenary' && defenderKind === 'mercenary') {
    return PVP_MERC_VS_MERC_DAMAGE_PERCENT_113C
  }
  return 100
}

/** Scale an integer/fixed damage value by the 1.13c PvP modifier when not routed through `executeSUnitDmg`. */
export function scalePvpDamageValue113c(
  rawDamage: number,
  attackerKind: PvpUnitCategory113c,
  defenderKind: PvpUnitCategory113c,
): number {
  if (rawDamage <= 0) return 0
  const pct = computePvpDamagePercent113c(attackerKind, defenderKind)
  if (pct === 100) return Math.floor(rawDamage)
  return Math.max(1, Math.floor((rawDamage * pct) / 100))
}

function sanitizeEarName113c(name: string): string {
  // 7-bit item bitstream string allows up to 15 printable ASCII characters (`0x20..0x7E`).
  let out = ''
  for (let i = 0; i < name.length && out.length < 15; i++) {
    const code = name.charCodeAt(i)
    if (code >= 0x20 && code <= 0x7e) {
      out += name[i]!
    }
  }
  return out.length > 0 ? out : 'Player'
}

/**
 * Build canonical 1.13c compact `'ear '` `ItemData` (`D2Game.dll` `0x6FC99E40` -> `0x6FC32AF0` / `S2C 0x9C`).
 */
export function buildPvpPlayerEarItemData113c(params: {
  readonly itemId: number
  readonly victimClassId: CharClassId
  readonly victimLevel: number
  readonly victimName: string
  readonly x: number
  readonly y: number
}): ItemData {
  const earName = sanitizeEarName113c(params.victimName)
  const earClass = ((params.victimClassId ?? 0) & 0x07) as number
  const earLevel = Math.max(1, Math.min(99, Math.trunc(params.victimLevel || 1)))
  const wx = Math.round(params.x)
  const wy = Math.round(params.y)
  return {
    id: params.itemId as UnitId,
    itemId: params.itemId as UnitId,
    opcode: 0x9c,
    action: 0,
    category: 0,
    ownerType: 0,
    ownerId: 0 as UnitId,
    flags: EAR_ITEM_RAW_FLAGS_113C,
    rawFlags: EAR_ITEM_RAW_FLAGS_113C,
    version: 101,
    location: 3,
    container: 'ground',
    bodyLoc: 0,
    equippedSlot: 0,
    gridX: wx,
    gridY: wy,
    storePage: 0,
    storagePage: 0,
    worldX: wx,
    worldY: wy,
    x: wx,
    y: wy,
    code: 'ear',
    rawCode: 'ear ',
    compact: true,
    simple: true,
    identified: true,
    socketed: false,
    ethereal: false,
    runeword: false,
    personalized: false,
    isEar: true,
    newItem: false,
    starterItem: false,
    broken: false,
    inSocket: false,
    equipped: false,
    socketedChildCount: 0,
    usedSockets: 0,
    totalSockets: 0,
    ilvl: earLevel,
    quality: 2 as ItemQuality,
    graphicIndex: 0,
    durability: 0,
    curDurability: 0,
    maxDurability: 0,
    quantity: 1,
    invWidth: 1,
    invHeight: 1,
    earClass,
    earLevel,
    earName,
    personalizedName: earName,
    stats: [],
    setBonusStats: [],
    runewordStats: [],
  }
}

/**
 * Build canonical 1.13c `S2C 0x5A` (`EVENT_SLAIN`, `eventType = 0x06`, `color = 4`) PvP kill broadcast
 * (`D2Game.dll` `0x6FCEC370`, resolving pet/mercenary kills to `killerPlayerName`).
 */
export function buildPvpSlainEvent0x5A113c(params: {
  readonly victimName: string
  readonly victimLevel: number
  readonly victimIsHardcore: boolean
  readonly killerPlayerUnitId: number
  readonly killerPlayerName: string
}): ServerEvent {
  const baseText = `${params.victimName} was slain by ${params.killerPlayerName}`
  return {
    type: 'Chat',
    kind: 'event',
    eventType: 0x06,
    color: 4,
    subType: 0x00,
    arg: params.victimIsHardcore ? params.victimLevel : params.killerPlayerUnitId,
    name1: params.victimName,
    name2: params.killerPlayerName,
    text: params.victimIsHardcore
      ? `${baseText}. Your deeds of valor will be remembered.`
      : baseText,
  }
}

/**
 * Build canonical 1.13c `S2C 0x5A` (`EVENT_RELATION`, `eventType = 0x07`, `subType = 0x03 | 0x04`)
 * hostility announcement (`<actor> has expressed hostility towards <target>`).
 */
export function buildHostileRelationEvent0x5A113c(params: {
  readonly actorPlayerUnitId: number
  readonly actorName: string
  readonly targetName: string
  readonly hostile: boolean
}): ServerEvent {
  return {
    type: 'Chat',
    kind: 'event',
    eventType: 0x07,
    color: params.hostile ? 8 : 2,
    subType: params.hostile ? 0x03 : 0x04,
    arg: params.actorPlayerUnitId,
    name1: params.actorName,
    name2: params.targetName,
    text: params.hostile
      ? `${params.actorName} has expressed hostility towards ${params.targetName}.`
      : `${params.actorName} is no longer hostile towards ${params.targetName}.`,
  }
}
