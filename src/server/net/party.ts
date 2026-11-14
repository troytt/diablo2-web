/**
 * Multiplayer Party & Roster Management (`src/server/net/party.ts`).
 *
 * Manages 1.13c party invitations, acceptance, leave, hostility flags, and shared XP/gold roster queries.
 * Strictly isomorphic: zero DOM globals, zero Node built-ins, zero `Math.random()` or wall-clock calls.
 */

import { partyExpPool113c, partyExpShare113c } from '../../common/progression/experience-113c.ts'
import type { ServerEvent } from '../../netproto/index.ts'

export type PartyRelState = 'none' | 'invited' | 'partied' | 'hostile'

export interface PartyPlayerEntry {
  readonly unitId: number
  readonly name: string
  readonly classId: number
  level: number
  areaId: number
  partyId: number
}

export function buildRosterJoinEvent(
  unitId: number,
  name: string,
  classId: number,
  level = 1,
  areaId = 1,
  partyId = 0xffff,
): ServerEvent {
  return {
    type: 'Party',
    kind: 'roster',
    action: 'join',
    source: 0x5b,
    unitId,
    playerId: unitId,
    charName: name,
    charClass: classId,
    charLevel: level,
    partyId,
    areaId,
    members: [
      {
        playerUnitId: unitId,
        charName: name,
        classId,
        level,
        areaId,
        partyId,
      },
    ],
  }
}

export function buildRosterLeaveEvent(unitId: number): ServerEvent {
  return {
    type: 'Party',
    kind: 'roster',
    action: 'leave',
    source: 0x5c,
    unitId,
    playerId: unitId,
    partyId: 0xffff,
  }
}

export class PartyManager {
  private nextPartyId = 1
  private readonly members = new Map<number, PartyPlayerEntry>()
  private readonly pendingInvites = new Map<string, { readonly inviterId: number; readonly inviteeId: number }>()
  private readonly hostilePairs = new Set<string>()
  private readonly mutedPairs = new Set<string>()
  private readonly lootPermitPairs = new Set<string>()
  private readonly onPartyIdChanged: ((unitId: number, partyId: number) => void) | undefined

  constructor(onPartyIdChanged?: (unitId: number, partyId: number) => void) {
    this.onPartyIdChanged = onPartyIdChanged
  }

  private pairKey(a: number, b: number): string {
    return `${a}->${b}`
  }

  private setMemberPartyId(member: PartyPlayerEntry, partyId: number): void {
    member.partyId = partyId
    this.onPartyIdChanged?.(member.unitId, partyId)
  }

  registerPlayer(unitId: number, name = `Player${unitId}`, classId = 0, level = 1, areaId = 1): ServerEvent[] {
    return this.addPlayer(unitId, name, classId, level, areaId)
  }

  addPlayer(unitId: number, name = `Player${unitId}`, classId = 0, level = 1, areaId = 1): ServerEvent[] {
    const entry: PartyPlayerEntry = {
      unitId,
      name,
      classId,
      level,
      areaId,
      partyId: 0xffff,
    }
    this.members.set(unitId, entry)
    this.onPartyIdChanged?.(unitId, 0xffff)
    return [buildRosterJoinEvent(unitId, name, classId, level, areaId, 0xffff)]
  }

  updatePlayer(unitId: number, patch: { readonly level?: number; readonly areaId?: number }): void {
    const member = this.members.get(unitId)
    if (!member) return
    if (patch.level !== undefined) member.level = patch.level
    if (patch.areaId !== undefined) member.areaId = patch.areaId
  }

  removePlayer(unitId: number): ServerEvent[] {
    const leaveEvents = this.leaveParty(unitId)
    this.members.delete(unitId)
    for (const key of Array.from(this.pendingInvites.keys())) {
      if (key.startsWith(`${unitId}->`) || key.endsWith(`->${unitId}`)) {
        this.pendingInvites.delete(key)
      }
    }
    for (const key of Array.from(this.hostilePairs.values())) {
      if (key.startsWith(`${unitId}->`) || key.endsWith(`->${unitId}`)) {
        this.hostilePairs.delete(key)
      }
    }
    return [...leaveEvents, buildRosterLeaveEvent(unitId)]
  }

  hasPendingInvite(inviterId: number, inviteeId: number): boolean {
    return this.pendingInvites.has(this.pairKey(inviterId, inviteeId))
  }

  invite(inviterId: number, inviteeId: number): ServerEvent[] {
    const inviter = this.members.get(inviterId)
    const invitee = this.members.get(inviteeId)
    if (!inviter || !invitee || inviterId === inviteeId) {
      return []
    }
    if (inviter.partyId !== 0xffff && inviter.partyId === invitee.partyId) {
      return []
    }
    this.pendingInvites.set(this.pairKey(inviterId, inviteeId), { inviterId, inviteeId })
    return [
      {
        type: 'Party',
        kind: 'relation',
        source: 0x8b,
        unitId: inviteeId,
        playerId: inviteeId,
        otherId: inviterId,
        relation: 4,
      },
      {
        type: 'Party',
        kind: 'relation',
        source: 0x8b,
        unitId: inviterId,
        playerId: inviterId,
        otherId: inviteeId,
        relation: 2,
      },
    ]
  }

  /**
   * 1.13c C2S `0x5E` action `0x07` (`D2Game.dll` `0x6FD10900`): cancel a pending invitation
   * previously sent by `inviterId` (`state === 4`) to `inviteeId` (`state === 2`).
   * Never removes `inviterId` from an existing party (`partyId` is unchanged).
   */
  cancelInvite(inviterId: number, inviteeId: number): ServerEvent[] {
    const inviter = this.members.get(inviterId)
    const invitee = this.members.get(inviteeId)
    if (!inviter || !invitee || inviterId === inviteeId) {
      return []
    }
    const key = this.pairKey(inviterId, inviteeId)
    if (!this.pendingInvites.has(key)) {
      return []
    }
    this.pendingInvites.delete(key)
    return [
      {
        type: 'Party',
        kind: 'relation',
        source: 0x8b,
        unitId: inviteeId,
        playerId: inviteeId,
        otherId: inviterId,
        relation: invitee.partyId !== 0xffff ? 1 : 0,
      },
      {
        type: 'Party',
        kind: 'relation',
        source: 0x8b,
        unitId: inviterId,
        playerId: inviterId,
        otherId: inviteeId,
        relation: inviter.partyId !== 0xffff ? 1 : 0,
      },
    ]
  }

  getPendingInvitesFor(inviteeId: number): number[] {
    const out: number[] = []
    for (const entry of this.pendingInvites.values()) {
      if (entry.inviteeId === inviteeId) {
        out.push(entry.inviterId)
      }
    }
    return out
  }

  acceptInvite(inviteeId: number, inviterId: number): number {
    this.accept(inviteeId, inviterId)
    return this.getPartyId(inviteeId)
  }

  /**
   * 1.13c C2S `0x5E` action `0x08` (`D2Game.dll` `0x6FD10D50`): accept a pending party invitation
   * from `inviterId` to `inviteeId`. Requires `hasPendingInvite(inviterId, inviteeId)`.
   */
  accept(inviteeId: number, inviterId: number): ServerEvent[] {
    const inviter = this.members.get(inviterId)
    const invitee = this.members.get(inviteeId)
    if (!inviter || !invitee || inviterId === inviteeId) return []
    if (!this.hasPendingInvite(inviterId, inviteeId)) return []

    this.pendingInvites.delete(this.pairKey(inviterId, inviteeId))
    this.pendingInvites.delete(this.pairKey(inviteeId, inviterId))
    this.hostilePairs.delete(this.pairKey(inviterId, inviteeId))
    this.hostilePairs.delete(this.pairKey(inviteeId, inviterId))

    let partyId = inviter.partyId
    if (partyId === 0xffff) {
      partyId = invitee.partyId !== 0xffff ? invitee.partyId : this.nextPartyId++
      this.setMemberPartyId(inviter, partyId)
    }
    this.setMemberPartyId(invitee, partyId)

    return [
      {
        type: 'Party',
        kind: 'roster',
        action: 'update',
        source: 0x8d,
        unitId: inviterId,
        playerId: inviterId,
        partyId,
      },
      {
        type: 'Party',
        kind: 'roster',
        action: 'update',
        source: 0x8d,
        unitId: inviteeId,
        playerId: inviteeId,
        partyId,
      },
    ]
  }

  /**
   * 1.13c C2S `0x5E` action `0x09` (`D2Game.dll` `0x6FD110F0` -> `0x6FCBC840` -> `0x6FCBC930`):
   * remove `unitId` from their party (`0xFFFF`). If the remaining party has `<= 1` member, disband
   * the party and reset the lone remaining member's `partyId` to `0xFFFF` as well.
   */
  leaveParty(unitId: number): ServerEvent[] {
    const member = this.members.get(unitId)
    if (!member || member.partyId === 0xffff) return []
    const oldPartyId = member.partyId
    this.setMemberPartyId(member, 0xffff)
    const events: ServerEvent[] = [
      {
        type: 'Party',
        kind: 'roster',
        action: 'update',
        source: 0x8d,
        unitId,
        playerId: unitId,
        partyId: 0xffff,
      },
    ]

    const remaining = Array.from(this.members.values()).filter((m) => m.partyId === oldPartyId)
    if (remaining.length <= 1) {
      for (const lone of remaining) {
        this.setMemberPartyId(lone, 0xffff)
        events.push({
          type: 'Party',
          kind: 'roster',
          action: 'update',
          source: 0x8d,
          unitId: lone.unitId,
          playerId: lone.unitId,
          partyId: 0xffff,
        })
      }
    }
    return events
  }

  setMuted(listenerId: number, targetId: number, muted: boolean): ServerEvent[] {
    const key = this.pairKey(listenerId, targetId)
    if (muted) {
      this.mutedPairs.add(key)
    } else {
      this.mutedPairs.delete(key)
    }
    return [
      {
        type: 'Party',
        kind: 'relation',
        source: 0x8c,
        unitId: listenerId,
        playerId: listenerId,
        otherId: targetId,
        relation: muted ? 1 : 0,
      },
    ]
  }

  isMuted(listenerId: number, targetId: number): boolean {
    return this.mutedPairs.has(this.pairKey(listenerId, targetId))
  }

  setLootPermission(ownerId: number, targetId: number, allow: boolean): ServerEvent[] {
    const key = this.pairKey(ownerId, targetId)
    if (allow) {
      this.lootPermitPairs.add(key)
    } else {
      this.lootPermitPairs.delete(key)
    }
    return [
      {
        type: 'Party',
        kind: 'relation',
        source: 0x8c,
        unitId: ownerId,
        playerId: ownerId,
        otherId: targetId,
        relation: allow ? 2 : 0,
      },
    ]
  }

  hasLootPermission(ownerId: number, targetId: number): boolean {
    if (ownerId === targetId) return true
    return this.lootPermitPairs.has(this.pairKey(ownerId, targetId))
  }

  setHostile(playerId: number, targetId: number, hostile: boolean, button = 4): ServerEvent[] {
    const keyAB = this.pairKey(playerId, targetId)
    const keyBA = this.pairKey(targetId, playerId)
    const leaveEvents: ServerEvent[] = []
    if (hostile) {
      const a = this.members.get(playerId)
      const b = this.members.get(targetId)
      if (a && b && a.partyId !== 0xffff && a.partyId === b.partyId) {
        leaveEvents.push(...this.leaveParty(playerId))
      }
      this.hostilePairs.add(keyAB)
      this.hostilePairs.add(keyBA)
      this.pendingInvites.delete(keyAB)
      this.pendingInvites.delete(keyBA)
    } else {
      this.hostilePairs.delete(keyAB)
      this.hostilePairs.delete(keyBA)
    }
    const relationBit = button === 3 ? 4 : 8
    return [
      ...leaveEvents,
      {
        type: 'Party',
        kind: 'relation',
        source: 0x8c,
        unitId: playerId,
        playerId,
        otherId: targetId,
        relation: hostile ? relationBit : 0,
      },
    ]
  }

  areHostile(playerA: number, playerB: number): boolean {
    if (playerA === playerB) return false
    return (
      this.hostilePairs.has(this.pairKey(playerA, playerB)) ||
      this.hostilePairs.has(this.pairKey(playerB, playerA))
    )
  }

  isHostile(playerA: number, playerB: number): boolean {
    return this.areHostile(playerA, playerB)
  }

  canDamagePlayer(attackerId: number, targetId: number): boolean {
    if (attackerId === targetId) return false
    return this.areHostile(attackerId, targetId)
  }

  areAllied(playerA: number, playerB: number): boolean {
    if (playerA === playerB) return true
    if (this.areHostile(playerA, playerB)) return false
    const a = this.members.get(playerA)
    const b = this.members.get(playerB)
    if (!a || !b) return false
    return a.partyId !== 0xffff && a.partyId === b.partyId
  }

  getPartyId(unitId: number): number {
    return this.members.get(unitId)?.partyId ?? 0xffff
  }

  getPartyMembers(unitId: number): readonly number[] {
    const m = this.members.get(unitId)
    if (!m || m.partyId === 0xffff) return [unitId]
    const out: number[] = []
    for (const entry of this.members.values()) {
      if (entry.partyId === m.partyId) {
        out.push(entry.unitId)
      }
    }
    return out
  }

  splitExperience(
    killerId: number,
    totalExp: number,
    candidates: readonly { readonly unitId: number; readonly areaId: number; readonly level: number }[],
  ): Map<number, number> {
    const result = new Map<number, number>()
    if (totalExp <= 0) return result

    const killer = candidates.find((c) => c.unitId === killerId)
    const killerArea = killer?.areaId ?? this.members.get(killerId)?.areaId ?? 1
    const eligible = candidates.filter(
      (c) =>
        c.areaId === killerArea &&
        (c.unitId === killerId || this.areAllied(killerId, c.unitId)),
    )

    if (eligible.length <= 1) {
      result.set(killerId, Math.floor(totalExp))
      return result
    }

    const pool = partyExpPool113c(Math.floor(totalExp), eligible.length)
    const totalLevels = eligible.reduce((sum, c) => sum + Math.max(1, c.level), 0)
    for (const c of eligible) {
      const share = Math.max(1, partyExpShare113c(pool, Math.max(1, c.level), totalLevels))
      result.set(c.unitId, share)
    }
    return result
  }

  /**
   * 1.13c `D2Game.dll` `0x6FCF6C80` (`ITEMS_PickUpGold`):
   * Splits picked-up ground gold equally across all alive allied party members in the same
   * `areaId` (`floor(amount / N)`), giving `amount % N` remainder to `pickerId`, capping each
   * recipient's absorbed gold at `clvl * 10000 - currentGold` (`D2Common.#10049`), and returning
   * any unabsorbable excess in `overflowGold` to remain / respawn as a ground `'gld'` pile (#1860).
   */
  splitGold(
    pickerId: number,
    totalGold: number,
    candidates: readonly {
      readonly unitId: number
      readonly areaId: number
      readonly level: number
      readonly currentGold?: number | undefined
      readonly maxGold?: number | undefined
      readonly dead?: boolean | undefined
    }[],
  ): {
    readonly shares: Map<number, number>
    readonly overflowGold: number
  } {
    const shares = new Map<number, number>()
    const cleanTotal = Math.max(0, Math.trunc(totalGold))
    if (cleanTotal <= 0) {
      return { shares, overflowGold: 0 }
    }

    const picker = candidates.find((c) => c.unitId === pickerId)
    const pickerArea = picker?.areaId ?? this.members.get(pickerId)?.areaId ?? 1
    const eligibleRaw = candidates.filter(
      (c) =>
        !c.dead &&
        c.areaId === pickerArea &&
        (c.unitId === pickerId || this.areAllied(pickerId, c.unitId)),
    )
    if (eligibleRaw.length === 0) {
      const fallbackCap =
        picker?.maxGold !== undefined
          ? Math.max(0, Math.trunc(picker.maxGold))
          : Math.max(1, Math.trunc(picker?.level ?? 1)) * 10_000
      const fallbackCur = Math.max(0, Math.trunc(picker?.currentGold ?? 0))
      const accepted = Math.min(cleanTotal, Math.max(0, fallbackCap - fallbackCur))
      if (accepted > 0) shares.set(pickerId, accepted)
      return { shares, overflowGold: cleanTotal - accepted }
    }

    // Order picker first so picker receives integer division remainder (`amount % N`).
    const eligible = [
      ...eligibleRaw.filter((c) => c.unitId === pickerId),
      ...eligibleRaw.filter((c) => c.unitId !== pickerId),
    ]
    const count = eligible.length
    const baseShare = Math.floor(cleanTotal / count)
    const remainder = cleanTotal - baseShare * count

    let overflowGold = 0
    for (let i = 0; i < count; i++) {
      const c = eligible[i]!
      const rawShare = baseShare + (c.unitId === pickerId ? remainder : i === 0 && !eligible.some((x) => x.unitId === pickerId) ? remainder : 0)
      const cap =
        c.maxGold !== undefined
          ? Math.max(0, Math.trunc(c.maxGold))
          : Math.max(1, Math.trunc(c.level)) * 10_000
      const current = Math.max(0, Math.trunc(c.currentGold ?? 0))
      const room = Math.max(0, cap - current)
      const accepted = Math.min(rawShare, room)
      if (accepted > 0) {
        shares.set(c.unitId, accepted)
      }
      overflowGold += rawShare - accepted
    }

    return { shares, overflowGold }
  }
}
