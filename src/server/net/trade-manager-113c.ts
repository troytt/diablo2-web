/**
 * 1.13c Player-to-Player Safe Trade State Machine (`src/server/net/trade-manager-113c.ts`).
 *
 * Implements `D2Game.dll` `0x6FC92700..0x6FC938F0` (`TRADE_*`) and `D2Client.dll` `0x6FB0A3A1..0x6FB0A520`:
 * - Town-only 2-player invitation (`0x77 0x00` wait / `0x77 0x01` request, `0x78` open session).
 * - Dual `10x4` trade offer grids (`storePage = 3` self, `storePage = 2` partner), gold offers (`0x79`),
 *   and green checkmark synchronization (`0x77 0x04/0x05/0x06`).
 * - Anti-scam red button lockout (`0x77 0x0E` -> 75 frames / 3s @ 25Hz -> `0x77 0x0F`) whenever an offered
 *   item is removed/swapped or gold is lowered / modified after a checkmark.
 * - Atomic dry-run `10x4` inventory placement & `clvl * 10000` gold-cap pre-check (`0x77 0x07..0x0A`)
 *   plus lossless rollback on cancel, disconnect, death, or leaving town (`0x77 0x0C`).
 *
 * Strictly isomorphic & deterministic: zero DOM/Node globals, zero `Math.random()` or `Date.now()`.
 */

import type { ServerEvent } from '../../netproto/index.ts'

export const TRADE_GRID_WIDTH_113C = 10
export const TRADE_GRID_HEIGHT_113C = 4
/** 1.13c anti-scam accept lockout: 75 frames = 3.0 seconds at 25 Hz (`D2Game.dll` `0x6FC92E80`). */
export const TRADE_ACCEPT_LOCKOUT_FRAMES_113C = 75
/** Sub-tile distance within which two town players can initiate/maintain face-to-face trade. */
export const TRADE_INTERACT_RANGE_SUBTILES_113C = 6

export interface PlayerDirectedTradeEvent {
  readonly playerId: number
  readonly event: ServerEvent
}

export interface TradeParticipantRef113c {
  readonly unitId: number
  readonly name: string
}

export interface ActiveTradeSession113c {
  readonly playerA: number
  readonly playerB: number
  readonly nameA: string
  readonly nameB: string
  offeredGoldA: number
  offeredGoldB: number
  acceptedA: boolean
  acceptedB: boolean
  acceptDisabledUntilFrame: number
}

export interface GridBox113c {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface IncomingGridItem113c {
  readonly unitId: number
  readonly width: number
  readonly height: number
}

/**
 * Pure 2D `10x4` dry-run packer used both for atomic trade commit pre-check and trade rollback.
 * Returns `null` if any incoming item cannot fit alongside `existingItems` without overlap.
 */
export function planInventoryPlacements113c(
  existingItems: readonly GridBox113c[],
  incomingItems: readonly IncomingGridItem113c[],
  gridW = TRADE_GRID_WIDTH_113C,
  gridH = TRADE_GRID_HEIGHT_113C,
): ReadonlyMap<number, { readonly x: number; readonly y: number }> | null {
  if (incomingItems.length === 0) return new Map()

  const occupied = new Uint8Array(gridW * gridH)
  for (const box of existingItems) {
    const w = Math.max(1, box.width)
    const h = Math.max(1, box.height)
    for (let dy = 0; dy < h; dy++) {
      const py = box.y + dy
      if (py < 0 || py >= gridH) continue
      for (let dx = 0; dx < w; dx++) {
        const px = box.x + dx
        if (px < 0 || px >= gridW) continue
        occupied[py * gridW + px] = 1
      }
    }
  }

  // Pack larger footprints first so multi-cell items + 1x1 items never fail due to ordering,
  // while keeping stable deterministic tie-breaking by original array index.
  const indexed = incomingItems.map((item, index) => ({ item, index }))
  indexed.sort((a, b) => {
    const areaDiff = b.item.width * b.item.height - a.item.width * a.item.height
    if (areaDiff !== 0) return areaDiff
    const hDiff = b.item.height - a.item.height
    if (hDiff !== 0) return hDiff
    return a.index - b.index
  })

  const placements = new Map<number, { readonly x: number; readonly y: number }>()
  for (const { item } of indexed) {
    const w = Math.max(1, item.width)
    const h = Math.max(1, item.height)
    if (w > gridW || h > gridH) return null

    let placed = false
    for (let y = 0; y <= gridH - h && !placed; y++) {
      for (let x = 0; x <= gridW - w; x++) {
        let collision = false
        for (let dy = 0; dy < h && !collision; dy++) {
          for (let dx = 0; dx < w; dx++) {
            if (occupied[(y + dy) * gridW + (x + dx)] !== 0) {
              collision = true
              break
            }
          }
        }
        if (!collision) {
          for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
              occupied[(y + dy) * gridW + (x + dx)] = 1
            }
          }
          placements.set(item.unitId, { x, y })
          placed = true
          break
        }
      }
    }
    if (!placed) return null
  }

  return placements
}

export class TradeManager113c {
  /** `requesterId -> targetId` for unanswered trade invitations. */
  private readonly pendingInvites = new Map<number, number>()
  /** `playerId -> ActiveTradeSession113c` (both participants point to the same session record). */
  private readonly activeSessions = new Map<number, ActiveTradeSession113c>()

  hasActiveTrade(playerId: number): boolean {
    return this.activeSessions.has(playerId)
  }

  hasPendingOrActiveTrade(playerId: number): boolean {
    if (this.activeSessions.has(playerId) || this.pendingInvites.has(playerId)) {
      return true
    }
    return this.findIncomingRequester(playerId) !== undefined
  }

  getSession(playerId: number): ActiveTradeSession113c | undefined {
    return this.activeSessions.get(playerId)
  }

  getPartnerId(playerId: number): number | undefined {
    const session = this.activeSessions.get(playerId)
    if (!session) return undefined
    return session.playerA === playerId ? session.playerB : session.playerA
  }

  getOfferedGold(playerId: number): number {
    const session = this.activeSessions.get(playerId)
    if (!session) return 0
    return session.playerA === playerId ? session.offeredGoldA : session.offeredGoldB
  }

  findIncomingRequester(targetPlayerId: number): number | undefined {
    for (const [requesterId, targetId] of this.pendingInvites.entries()) {
      if (targetId === targetPlayerId) return requesterId
    }
    return undefined
  }

  private clearAllInvitesInvolving(
    playerId: number,
    eventsOut?: PlayerDirectedTradeEvent[],
    skipPartnerId?: number,
  ): void {
    const prevTarget = this.pendingInvites.get(playerId)
    if (prevTarget !== undefined) {
      this.pendingInvites.delete(playerId)
      if (eventsOut && prevTarget !== skipPartnerId) {
        eventsOut.push({
          playerId: prevTarget,
          event: { type: 'Trade', action: 0x03 },
        })
      }
    }
    for (const [reqId, tgtId] of [...this.pendingInvites.entries()]) {
      if (tgtId === playerId) {
        this.pendingInvites.delete(reqId)
        if (eventsOut && reqId !== skipPartnerId) {
          eventsOut.push({
            playerId: reqId,
            event: { type: 'Trade', action: 0x02 },
          })
        }
      }
    }
  }

  private openSessionInternal(
    a: TradeParticipantRef113c,
    b: TradeParticipantRef113c,
    eventsOut: PlayerDirectedTradeEvent[],
  ): ActiveTradeSession113c {
    this.clearAllInvitesInvolving(a.unitId, eventsOut, b.unitId)
    this.clearAllInvitesInvolving(b.unitId, eventsOut, a.unitId)
    const session: ActiveTradeSession113c = {
      playerA: a.unitId,
      playerB: b.unitId,
      nameA: a.name,
      nameB: b.name,
      offeredGoldA: 0,
      offeredGoldB: 0,
      acceptedA: false,
      acceptedB: false,
      acceptDisabledUntilFrame: 0,
    }
    this.activeSessions.set(a.unitId, session)
    this.activeSessions.set(b.unitId, session)
    eventsOut.push(
      {
        playerId: a.unitId,
        event: {
          type: 'Trade',
          action: 0x78,
          partnerId: b.unitId,
          partnerName: b.name,
        },
      },
      {
        playerId: b.unitId,
        event: {
          type: 'Trade',
          action: 0x78,
          partnerId: a.unitId,
          partnerName: a.name,
        },
      },
    )
    return session
  }

  /**
   * Initiates a trade request (`C2S 0x13` on `unitType = 0` in town).
   * If `target` is already waiting on `requester`, immediately opens the active trade session (`0x78`).
   */
  requestTrade(
    requester: TradeParticipantRef113c,
    target: TradeParticipantRef113c,
  ): {
    readonly opened: boolean
    readonly session?: ActiveTradeSession113c | undefined
    readonly events: readonly PlayerDirectedTradeEvent[]
  } {
    if (
      requester.unitId === target.unitId ||
      this.activeSessions.has(requester.unitId) ||
      this.activeSessions.has(target.unitId)
    ) {
      return { opened: false, events: [] }
    }

    const events: PlayerDirectedTradeEvent[] = []
    if (this.pendingInvites.get(target.unitId) === requester.unitId) {
      const session = this.openSessionInternal(target, requester, events)
      return { opened: true, session, events }
    }

    // Reject if target is already waiting on someone else
    if (
      this.pendingInvites.has(target.unitId) ||
      (this.findIncomingRequester(target.unitId) !== undefined &&
        this.findIncomingRequester(target.unitId) !== requester.unitId)
    ) {
      return { opened: false, events: [] }
    }

    if (this.pendingInvites.get(requester.unitId) === target.unitId) {
      return { opened: false, events: [] }
    }

    this.clearAllInvitesInvolving(requester.unitId, events, target.unitId)
    this.pendingInvites.set(requester.unitId, target.unitId)
    events.push(
      {
        playerId: requester.unitId,
        event: {
          type: 'Trade',
          action: 0x00,
          partnerId: target.unitId,
          partnerName: target.name,
        },
      },
      {
        playerId: target.unitId,
        event: {
          type: 'Trade',
          action: 0x01,
          partnerId: requester.unitId,
          partnerName: requester.name,
        },
      },
    )
    return { opened: false, events }
  }

  /**
   * Target clicks Accept on the trade invitation dialog (`C2S 0x4F` `buttonId = 0x03`).
   */
  acceptInvite(
    accepter: TradeParticipantRef113c,
    resolvePlayer: (unitId: number) => TradeParticipantRef113c | undefined,
  ): {
    readonly opened: boolean
    readonly session?: ActiveTradeSession113c | undefined
    readonly events: readonly PlayerDirectedTradeEvent[]
  } {
    if (this.activeSessions.has(accepter.unitId)) {
      return { opened: false, events: [] }
    }
    const requesterId = this.findIncomingRequester(accepter.unitId)
    if (requesterId === undefined || this.activeSessions.has(requesterId)) {
      return { opened: false, events: [] }
    }
    const requester = resolvePlayer(requesterId)
    if (!requester) {
      this.pendingInvites.delete(requesterId)
      return { opened: false, events: [] }
    }
    const events: PlayerDirectedTradeEvent[] = []
    const session = this.openSessionInternal(requester, accepter, events)
    return { opened: true, session, events }
  }

  /**
   * Cancels an active trade window or declines/cancels a pending trade invite (`0x4F 0x02`,
   * disconnect, death, or area transition).
   */
  cancelOrDecline(actorId: number): {
    readonly abortedSession?: ActiveTradeSession113c | undefined
    readonly events: readonly PlayerDirectedTradeEvent[]
  } {
    const active = this.activeSessions.get(actorId)
    if (active) {
      this.activeSessions.delete(active.playerA)
      this.activeSessions.delete(active.playerB)
      return {
        abortedSession: active,
        events: [
          { playerId: active.playerA, event: { type: 'Trade', action: 0x0c } },
          { playerId: active.playerB, event: { type: 'Trade', action: 0x0c } },
        ],
      }
    }

    const events: PlayerDirectedTradeEvent[] = []
    const outTarget = this.pendingInvites.get(actorId)
    if (outTarget !== undefined) {
      this.pendingInvites.delete(actorId)
      events.push(
        { playerId: actorId, event: { type: 'Trade', action: 0x0c } },
        { playerId: outTarget, event: { type: 'Trade', action: 0x03 } },
      )
    }

    const inRequester = this.findIncomingRequester(actorId)
    if (inRequester !== undefined) {
      this.pendingInvites.delete(inRequester)
      events.push(
        { playerId: actorId, event: { type: 'Trade', action: 0x0c } },
        { playerId: inRequester, event: { type: 'Trade', action: 0x02 } },
      )
    }

    return { events }
  }

  /**
   * Updates `playerId`'s gold offer (`C2S 0x4F` `buttonId = 0x08`).
   * Lowering gold or editing gold while either side has accepted triggers the 75-frame anti-scam lockout (`0x0E`).
   */
  setGoldOffer(
    playerId: number,
    playerGold: number,
    rawAmount: number,
    currentFrame: number,
  ): readonly PlayerDirectedTradeEvent[] {
    const session = this.activeSessions.get(playerId)
    if (!session) return []
    const amount = Math.trunc(rawAmount)
    if (!Number.isFinite(amount) || amount < 0 || amount > playerGold) {
      return []
    }

    const isA = session.playerA === playerId
    const partnerId = isA ? session.playerB : session.playerA
    const prevGold = isA ? session.offeredGoldA : session.offeredGoldB
    if (amount === prevGold) return []

    const hadCheckmark = session.acceptedA || session.acceptedB
    if (isA) session.offeredGoldA = amount
    else session.offeredGoldB = amount
    session.acceptedA = false
    session.acceptedB = false

    const events: PlayerDirectedTradeEvent[] = []
    if (amount < prevGold || hadCheckmark) {
      session.acceptDisabledUntilFrame = currentFrame + TRADE_ACCEPT_LOCKOUT_FRAMES_113C
      events.push(
        { playerId: session.playerA, event: { type: 'Trade', action: 0x0e } },
        { playerId: session.playerB, event: { type: 'Trade', action: 0x0e } },
      )
    } else {
      events.push(
        { playerId: session.playerA, event: { type: 'Trade', action: 0x06 } },
        { playerId: session.playerB, event: { type: 'Trade', action: 0x06 } },
      )
    }

    events.push(
      { playerId, event: { type: 'Trade', action: 0x7901, gold: amount } },
      { playerId: partnerId, event: { type: 'Trade', action: 0x7900, gold: amount } },
    )
    return events
  }

  /**
   * Called when `playerId` places an item into their `10x4` trade buffer (`0x18` `buffer = 2`).
   * Clears both players' green checkmarks (`0x77 0x06`).
   */
  notifyItemAdded(playerId: number): readonly PlayerDirectedTradeEvent[] {
    const session = this.activeSessions.get(playerId)
    if (!session) return []
    session.acceptedA = false
    session.acceptedB = false
    return [
      { playerId: session.playerA, event: { type: 'Trade', action: 0x06 } },
      { playerId: session.playerB, event: { type: 'Trade', action: 0x06 } },
    ]
  }

  /**
   * Called when `playerId` removes (`0x19`) or swaps (`0x1F`) an item in their trade buffer.
   * Immediately unchecks both sides and engages the 75-frame anti-scam accept lockout (`0x77 0x0E`).
   */
  notifyItemRemovedOrSwapped(
    playerId: number,
    currentFrame: number,
  ): readonly PlayerDirectedTradeEvent[] {
    const session = this.activeSessions.get(playerId)
    if (!session) return []
    session.acceptedA = false
    session.acceptedB = false
    session.acceptDisabledUntilFrame = currentFrame + TRADE_ACCEPT_LOCKOUT_FRAMES_113C
    return [
      { playerId: session.playerA, event: { type: 'Trade', action: 0x0e } },
      { playerId: session.playerB, event: { type: 'Trade', action: 0x0e } },
    ]
  }

  /**
   * Unchecks the green trade accept button (`C2S 0x4F` `buttonId = 0x07`).
   */
  unaccept(playerId: number): readonly PlayerDirectedTradeEvent[] {
    const session = this.activeSessions.get(playerId)
    if (!session) return []
    session.acceptedA = false
    session.acceptedB = false
    return [
      { playerId: session.playerA, event: { type: 'Trade', action: 0x06 } },
      { playerId: session.playerB, event: { type: 'Trade', action: 0x06 } },
    ]
  }

  /**
   * Clicks the trade accept checkmark (`C2S 0x4F` `buttonId = 0x04`).
   * Ignored while the anti-scam lockout (`acceptDisabledUntilFrame`) is active.
   */
  accept(
    playerId: number,
    currentFrame: number,
  ): {
    readonly bothAccepted: boolean
    readonly session?: ActiveTradeSession113c | undefined
    readonly events: readonly PlayerDirectedTradeEvent[]
  } {
    const session = this.activeSessions.get(playerId)
    if (!session) return { bothAccepted: false, events: [] }
    if (
      session.acceptDisabledUntilFrame > 0 &&
      currentFrame < session.acceptDisabledUntilFrame
    ) {
      return { bothAccepted: false, events: [] }
    }

    const isA = session.playerA === playerId
    const partnerId = isA ? session.playerB : session.playerA
    if (isA) {
      if (session.acceptedA) return { bothAccepted: false, events: [] }
      session.acceptedA = true
    } else {
      if (session.acceptedB) return { bothAccepted: false, events: [] }
      session.acceptedB = true
    }

    const events: PlayerDirectedTradeEvent[] = [
      { playerId, event: { type: 'Trade', action: 0x04 } },
      { playerId: partnerId, event: { type: 'Trade', action: 0x05 } },
    ]
    const bothAccepted = session.acceptedA && session.acceptedB
    return {
      bothAccepted,
      ...(bothAccepted ? { session } : {}),
      events,
    }
  }

  rejectCommitNoRoom(
    session: ActiveTradeSession113c,
    fullPlayerId: number,
  ): readonly PlayerDirectedTradeEvent[] {
    session.acceptedA = false
    session.acceptedB = false
    const otherId =
      session.playerA === fullPlayerId ? session.playerB : session.playerA
    return [
      { playerId: fullPlayerId, event: { type: 'Trade', action: 0x07 } },
      { playerId: otherId, event: { type: 'Trade', action: 0x08 } },
    ]
  }

  rejectCommitGoldOverflow(
    session: ActiveTradeSession113c,
    overflowPlayerId: number,
  ): readonly PlayerDirectedTradeEvent[] {
    session.acceptedA = false
    session.acceptedB = false
    const otherId =
      session.playerA === overflowPlayerId ? session.playerB : session.playerA
    return [
      { playerId: overflowPlayerId, event: { type: 'Trade', action: 0x09 } },
      { playerId: otherId, event: { type: 'Trade', action: 0x0a } },
    ]
  }

  completeSession(session: ActiveTradeSession113c): readonly PlayerDirectedTradeEvent[] {
    this.activeSessions.delete(session.playerA)
    this.activeSessions.delete(session.playerB)
    return [
      { playerId: session.playerA, event: { type: 'Trade', action: 0x0d } },
      { playerId: session.playerB, event: { type: 'Trade', action: 0x0d } },
    ]
  }

  /**
   * 25Hz tick hook: re-enables the trade accept button (`0x77 0x0F`) once `acceptDisabledUntilFrame` expires.
   */
  tick(currentFrame: number): readonly PlayerDirectedTradeEvent[] {
    if (this.activeSessions.size === 0) return []
    const seen = new Set<ActiveTradeSession113c>()
    const events: PlayerDirectedTradeEvent[] = []
    for (const session of this.activeSessions.values()) {
      if (seen.has(session)) continue
      seen.add(session)
      if (
        session.acceptDisabledUntilFrame > 0 &&
        currentFrame >= session.acceptDisabledUntilFrame
      ) {
        session.acceptDisabledUntilFrame = 0
        events.push(
          { playerId: session.playerA, event: { type: 'Trade', action: 0x0f } },
          { playerId: session.playerB, event: { type: 'Trade', action: 0x0f } },
        )
      }
    }
    return events
  }
}
