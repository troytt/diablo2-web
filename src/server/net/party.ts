/**
 * Multiplayer Party & Roster Management (`src/server/net/party.ts`).
 *
 * Manages 1.13c party invitations, acceptance, leave, hostility flags, and shared XP/gold roster queries.
 * Strictly isomorphic: zero DOM globals, zero Node built-ins, zero `Math.random()` or wall-clock calls.
 */

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

  private pairKey(a: number, b: number): string {
    return `${a}->${b}`
  }

  registerPlayer(unitId: number, name = `Player${unitId}`, classId = 0, level = 1, areaId = 1): ServerEvent[] {
    return this.addPlayer(unitId, name, classId, level, areaId)
  }

  addPlayer(unitId: number, name = `Player${unitId}`, classId = 0, level = 1, areaId = 1): ServerEvent[] {
    this.members.set(unitId, {
      unitId,
      name,
      classId,
      level,
      areaId,
      partyId: 0xffff,
    })
    return [buildRosterJoinEvent(unitId, name, classId, level, areaId, 0xffff)]
  }

  removePlayer(unitId: number): ServerEvent[] {
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
    return [buildRosterLeaveEvent(unitId)]
  }

  invite(inviterId: number, inviteeId: number): ServerEvent[] {
    if (!this.members.has(inviterId) || !this.members.has(inviteeId) || inviterId === inviteeId) {
      return []
    }
    this.pendingInvites.set(this.pairKey(inviterId, inviteeId), { inviterId, inviteeId })
    return [
      {
        type: 'Party',
        kind: 'relation',
        unitId: inviterId,
        playerId: inviterId,
        otherId: inviteeId,
        relation: 2,
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

  accept(inviteeId: number, inviterId: number): ServerEvent[] {
    const inviter = this.members.get(inviterId)
    const invitee = this.members.get(inviteeId)
    if (!inviter || !invitee) return []

    this.pendingInvites.delete(this.pairKey(inviterId, inviteeId))
    this.pendingInvites.delete(this.pairKey(inviteeId, inviterId))
    this.hostilePairs.delete(this.pairKey(inviterId, inviteeId))
    this.hostilePairs.delete(this.pairKey(inviteeId, inviterId))

    let partyId = inviter.partyId
    if (partyId === 0xffff) {
      partyId = invitee.partyId !== 0xffff ? invitee.partyId : this.nextPartyId++
      inviter.partyId = partyId
    }
    invitee.partyId = partyId

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

  leaveParty(unitId: number): ServerEvent[] {
    const member = this.members.get(unitId)
    if (!member) return []
    member.partyId = 0xffff
    return [
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
  }

  setHostile(playerId: number, targetId: number, hostile: boolean): ServerEvent[] {
    const keyAB = this.pairKey(playerId, targetId)
    const keyBA = this.pairKey(targetId, playerId)
    if (hostile) {
      this.hostilePairs.add(keyAB)
      this.hostilePairs.add(keyBA)
      if (this.areAllied(playerId, targetId)) {
        this.leaveParty(playerId)
      }
    } else {
      this.hostilePairs.delete(keyAB)
      this.hostilePairs.delete(keyBA)
    }
    return [
      {
        type: 'Party',
        kind: 'relation',
        source: 0x8c,
        unitId: playerId,
        playerId,
        otherId: targetId,
        relation: hostile ? 8 : 0,
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

    const totalLevels = eligible.reduce((sum, c) => sum + Math.max(1, c.level), 0)
    for (const c of eligible) {
      const share = Math.max(1, Math.floor((totalExp * Math.max(1, c.level)) / totalLevels))
      result.set(c.unitId, share)
    }
    return result
  }
}
