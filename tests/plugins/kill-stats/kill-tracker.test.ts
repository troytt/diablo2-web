import { describe, expect, it, vi } from 'vitest'
import type { PluginSessionView } from '../../../src/client/plugin-host/api.ts'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import {
  computeCharKey,
  type KillCharacterProfile,
  type KillStatsBroadcastMessage,
} from '../../../plugins/kill-stats/kill-stats-model.ts'
import {
  KillTracker,
  resolveSessionIdentity,
  type BroadcastChannelLike,
  type KillTrackerScheduler,
  type KillTrackerWindowLike,
} from '../../../plugins/kill-stats/kill-tracker.ts'
import type {
  ClientCommand,
  CloseReason,
  GameServerAdapter,
  GameServerStats,
  ServerEvent,
} from '../../../src/netproto/index.ts'
import { MemoryKillStatsRepository } from './memory-repository.ts'

class FakeGameServerAdapter implements GameServerAdapter {
  state: 'loading' | 'ingame' | 'closed' = 'ingame'
  readonly sent: ClientCommand[] = []
  private readonly eventListeners = new Set<(ev: ServerEvent) => void>()
  private readonly closeListeners = new Set<(reason: CloseReason) => void>()

  readonly stats: GameServerStats = {
    unknownPackets: 0,
    opaquePackets: 0,
    rttMs: 25,
    bytesIn: 0,
    bytesOut: 0,
  }

  send(cmd: ClientCommand): void {
    this.sent.push(cmd)
  }

  onEvent(cb: (ev: ServerEvent) => void): () => void {
    this.eventListeners.add(cb)
    return () => {
      this.eventListeners.delete(cb)
    }
  }

  onClose(cb: (reason: CloseReason) => void): () => void {
    this.closeListeners.add(cb)
    return () => {
      this.closeListeners.delete(cb)
    }
  }

  emit(ev: ServerEvent): void {
    for (const cb of this.eventListeners) {
      cb(ev)
    }
  }

  leave(): void {
    this.state = 'closed'
    for (const cb of this.closeListeners) {
      cb({ kind: 'local' })
    }
  }
}

class FakeScheduler implements KillTrackerScheduler {
  private nextHandle = 1
  readonly timers = new Map<number, { readonly cb: () => void; readonly delayMs: number }>()

  setTimeout(cb: () => void, delayMs: number): unknown {
    const id = this.nextHandle++
    this.timers.set(id, { cb, delayMs })
    return id
  }

  clearTimeout(handle: unknown): void {
    if (typeof handle === 'number') {
      this.timers.delete(handle)
    }
  }

  pendingDelays(): number[] {
    return [...this.timers.values()].map((t) => t.delayMs)
  }

  fireNext(): boolean {
    const first = this.timers.entries().next()
    if (first.done) return false
    const [id, entry] = first.value
    this.timers.delete(id)
    entry.cb()
    return true
  }
}

class FakeWindow implements KillTrackerWindowLike {
  private readonly winListeners = new Map<string, Set<() => void>>()
  private readonly docListeners = new Map<string, Set<() => void>>()
  visibilityState = 'visible'

  readonly document = {
    get visibilityState(): string {
      return this.outer.visibilityState
    },
    addEventListener: (type: string, listener: () => void): void => {
      let set = this.docListeners.get(type)
      if (!set) {
        set = new Set()
        this.docListeners.set(type, set)
      }
      set.add(listener)
    },
    removeEventListener: (type: string, listener: () => void): void => {
      this.docListeners.get(type)?.delete(listener)
    },
    outer: this,
  }

  addEventListener(type: string, listener: () => void): void {
    let set = this.winListeners.get(type)
    if (!set) {
      set = new Set()
      this.winListeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(type: string, listener: () => void): void {
    this.winListeners.get(type)?.delete(listener)
  }

  dispatchVisibilityChange(nextState: 'visible' | 'hidden'): void {
    this.visibilityState = nextState
    for (const cb of this.docListeners.get('visibilitychange') ?? []) {
      cb()
    }
  }

  dispatchPageHide(): void {
    for (const cb of this.winListeners.get('pagehide') ?? []) {
      cb()
    }
  }
}

function makeDefaultProfile(): KillCharacterProfile {
  const host = 'www.laiseek.xyz'
  const realm = 'D2CS'
  const account = 'testacct'
  const charName = 'TestSorc'
  return {
    charKey: computeCharKey(host, realm, account, charName),
    host,
    realm,
    account,
    charName,
    charClass: 1,
    level: 85,
    hardcore: true,
    expansion: true,
    ladder: true,
  }
}

function setupHarness(options?: {
  readonly identity?: (() => KillCharacterProfile | null) | undefined
}) {
  let nowMs = 10000
  const session = new OnlineSession()
  const adapter = new FakeGameServerAdapter()
  const repository = new MemoryKillStatsRepository({
    initialReplicaId: '11111111-1111-4111-8111-111111111111',
    now: () => nowMs,
  })
  const scheduler = new FakeScheduler()
  const windowLike = new FakeWindow()
  const broadcastMessages: KillStatsBroadcastMessage[] = []
  const channel: BroadcastChannelLike = {
    postMessage(msg) {
      broadcastMessages.push(msg as KillStatsBroadcastMessage)
    },
    close() {},
  }
  const defaultProfile = makeDefaultProfile()

  const tracker = new KillTracker({
    session,
    repository,
    resolveIdentity: options?.identity ?? (() => defaultProfile),
    now: () => nowMs,
    scheduler,
    channelFactory: () => channel,
    windowLike,
  })

  session.attachGameServer(adapter)

  const sendGameFlags = (difficulty: 0 | 1 | 2 = 2): void => {
    adapter.emit({
      type: 'GameFlags',
      difficulty,
      hardcore: true,
      expansion: true,
      ladder: true,
    })
    adapter.emit({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: defaultProfile.charName,
        x: 5000,
        y: 5000,
      },
    })
  }

  return {
    session,
    adapter,
    repository,
    scheduler,
    windowLike,
    broadcastMessages,
    tracker,
    defaultProfile,
    advanceTime: (delta: number): void => {
      nowMs += delta
    },
    sendGameFlags,
  }
}

describe('KillTracker: Per-GUID State Machine, Exclusions & Revives', () => {
  it('counts 1 kill across back-to-back 0x08 dying (mode 0) + 0x09 dead (mode 12) and ignores corpse UnitAssign', async () => {
    const h = setupHarness()
    h.sendGameFlags(2)

    // 1. Live Fallen (hcIdx = 19) spawns, takes 0x0C damage (mode: undefined), then dies (mode 0 -> mode 12)
    h.adapter.emit({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 100,
        classId: 19,
        x: 5010,
        y: 5010,
        lifePct: 128,
        mode: 1,
      },
    })
    // 0x0C NPCGetHit emits UnitMode with mode === undefined -> must not transition or count
    h.adapter.emit({
      type: 'UnitMode',
      unitType: 1,
      id: 100,
      lifePct: 64,
      hitClass: 2,
    })
    expect(h.tracker.getStatus().pendingKills).toBe(0)

    // 0x08 dying -> mode = 0 (counts once)
    h.adapter.emit({
      type: 'UnitMode',
      unitType: 1,
      id: 100,
      mode: 0,
      lifePct: 0,
    })
    // 0x09 dead -> mode = 12 (already dead, must not double-count)
    h.adapter.emit({
      type: 'UnitMode',
      unitType: 1,
      id: 100,
      mode: 12,
      lifePct: 0,
    })
    expect(h.tracker.getStatus().pendingKills).toBe(1)

    // 2. Pre-existing corpse UnitAssign (lifePct = 0, mode = 12) followed by UnitMode(12) -> 0 count
    h.adapter.emit({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 101,
        classId: 19,
        x: 5020,
        y: 5020,
        lifePct: 0,
        mode: 12,
      },
    })
    h.adapter.emit({
      type: 'UnitMode',
      unitType: 1,
      id: 101,
      mode: 12,
      lifePct: 0,
    })
    expect(h.tracker.getStatus().pendingKills).toBe(1)

    await h.tracker.flushNow()
    const snap = await h.repository.loadAll()
    expect(snap.tallies).toHaveLength(1)
    expect(snap.tallies[0]?.subject).toBe(19)
    expect(snap.tallies[0]?.count).toBe(1)
    expect(snap.tallies[0]?.soloCount).toBe(1)
    h.tracker.destroy()
  })

  it('re-arms dead monsters when revived (alive mode 1..15 != 12) and counts a second kill on re-death, and forgets on UnitRemove', async () => {
    const h = setupHarness()
    h.sendGameFlags(1)

    h.adapter.emit({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 200,
        classId: 19, // fallen1
        x: 5000,
        y: 5000,
        lifePct: 128,
        mode: 1,
      },
    })
    // First kill
    h.adapter.emit({
      type: 'UnitMode',
      unitType: 'monster',
      id: 200,
      mode: 0,
    })
    expect(h.tracker.getStatus().pendingKills).toBe(1)

    // Shaman revives Fallen -> mode = 1 (NU)
    h.adapter.emit({
      type: 'UnitMode',
      unitType: 'monster',
      id: 200,
      mode: 1,
      lifePct: 128,
    })
    // Killed a second time -> counts 2
    h.advanceTime(500)
    h.adapter.emit({
      type: 'UnitMode',
      unitType: 'monster',
      id: 200,
      mode: 12,
    })
    expect(h.tracker.getStatus().pendingKills).toBe(2)

    // Unit 201 spawns, leaves view via UnitRemove, then a late UnitMode arrives -> not counted
    h.adapter.emit({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 201,
        classId: 19,
        x: 5000,
        y: 5000,
        lifePct: 128,
        mode: 1,
      },
    })
    h.adapter.emit({
      type: 'UnitRemove',
      unitType: 'monster',
      id: 201,
    })
    h.adapter.emit({
      type: 'UnitMode',
      unitType: 'monster',
      id: 201,
      mode: 0,
    })
    expect(h.tracker.getStatus().pendingKills).toBe(2)

    await h.tracker.flushNow()
    const snap = await h.repository.loadAll()
    expect(snap.tallies).toHaveLength(1)
    expect(snap.tallies[0]?.difficulty).toBe(1)
    expect(snap.tallies[0]?.count).toBe(2)
    h.tracker.destroy()
  })

  it('excludes mercs (0x81), summons (0x7A), 0xAC ownerId units, Align !== 0 (363, 338), and neverCount (340)', async () => {
    const h = setupHarness()
    h.sendGameFlags(2)

    // 1. 0x81 AssignMerc (mercId = 300)
    h.adapter.emit({
      type: 'Merc',
      kind: 'assign',
      ownerId: 1,
      mercId: 300,
      classId: 338,
    })
    h.adapter.emit({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 300,
        classId: 19, // even if classId were countable, Merc ownership excludes GUID 300
        x: 5000,
        y: 5000,
        lifePct: 128,
        mode: 1,
      },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 300, mode: 0 })

    // 2. 0x7A SummonAction (mercId = 301, sticky even after unsummon action = 0)
    h.adapter.emit({
      type: 'Merc',
      kind: 'assign',
      ownerId: 1,
      mercId: 301,
      classId: 363,
      isSummonAction: true,
      summonAction: 1,
    })
    h.adapter.emit({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 301,
        classId: 19,
        x: 5000,
        y: 5000,
        lifePct: 128,
        mode: 1,
      },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 301, mode: 0 })

    // 3. 0xAC UnitAssign with ownerId (id = 302)
    h.adapter.emit({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 302,
        classId: 19,
        x: 5000,
        y: 5000,
        lifePct: 128,
        mode: 1,
        ownerId: 1,
      },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 302, mode: 0 })

    // 4. Align !== 0 (363 = necroskeleton, 338 = act2hire) and neverCount !== 0 (340 = boneprison1)
    for (const [idx, classId] of [
      [303, 363],
      [304, 338],
      [305, 340],
    ] as const) {
      h.adapter.emit({
        type: 'UnitAssign',
        unit: {
          unitType: 1,
          id: idx,
          classId,
          x: 5000,
          y: 5000,
          lifePct: 128,
          mode: 1,
        },
      })
      h.adapter.emit({ type: 'UnitMode', unitType: 1, id: idx, mode: 0 })
    }

    expect(h.tracker.getStatus().pendingKills).toBe(0)
    await h.tracker.flushNow()
    const snap = await h.repository.loadAll()
    expect(snap.tallies).toHaveLength(0)
    h.tracker.destroy()
  })
})

describe('KillTracker: Boss / SuperUnique Classification, Solo vs Party, Guards & Flush Retry', () => {
  it('classifies Boss (monster + boss), SuperUnique (monster + superunique), and logs out-of-range superUniqueId', async () => {
    const h = setupHarness()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    h.sendGameFlags(2)

    // 1. Andariel (hcIdx = 156, boss = true) -> emits monster/156 + boss/156
    h.adapter.emit({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 400,
        classId: 156,
        x: 5000,
        y: 5000,
        lifePct: 128,
        mode: 1,
      },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 400, mode: 0 })

    // 2. Pindleskin (hcIdx = 440 reanimatedhorde5, isSuperUnique = true, superUniqueId = 52) -> monster/440 + superunique/52
    h.adapter.emit({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 401,
        classId: 440,
        x: 5000,
        y: 5000,
        lifePct: 128,
        mode: 1,
        isSuperUnique: true,
        superUniqueId: 52,
      },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 401, mode: 0 })

    // 3. Radament (hcIdx = 229 boss=true AND isSuperUnique=true, superUniqueId = 10) -> monster/229 + superunique/10 (NOT boss/229)
    h.adapter.emit({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 402,
        classId: 229,
        x: 5000,
        y: 5000,
        lifePct: 128,
        mode: 1,
        isSuperUnique: true,
        superUniqueId: 10,
      },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 402, mode: 0 })

    // 4. Out-of-range superUniqueId (99) -> emits monster/440 only and logs console.error
    h.adapter.emit({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 403,
        classId: 440,
        x: 5000,
        y: 5000,
        lifePct: 128,
        mode: 1,
        isSuperUnique: true,
        superUniqueId: 99,
      },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 403, mode: 0 })
    expect(errSpy).toHaveBeenCalled()
    expect(h.tracker.getStatus().lastError).toContain('99')

    await h.tracker.flushNow()
    const snap = await h.repository.loadAll()
    const summary = snap.tallies.map((t) => `${t.kind}:${t.subject}=${t.count}`).sort()
    expect(summary).toEqual([
      'boss:156=1',
      'monster:156=1',
      'monster:229=1',
      'monster:440=2',
      'superunique:10=1',
      'superunique:52=1',
    ])

    errSpy.mockRestore()
    h.tracker.destroy()
  })

  it('tracks soloCount accurately from world.party (0x5B PlayerInGame / 0x5C PlayerLeftGame)', async () => {
    const h = setupHarness()
    h.sendGameFlags(2)

    // Self in roster (unitId = 1) -> still solo
    h.adapter.emit({
      type: 'Party',
      kind: 'roster',
      unitId: 1,
      charName: 'TestSorc',
      charClass: 1,
      charLevel: 85,
      partyId: 0xffff,
    })

    // Kill #1 while solo -> count = 1, soloCount = 1
    h.adapter.emit({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 500, classId: 19, x: 5000, y: 5000, lifePct: 128, mode: 1 },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 500, mode: 0 })

    // Second player enters game (0x5B, unitId = 2) -> multiplayer
    h.adapter.emit({
      type: 'Party',
      kind: 'roster',
      unitId: 2,
      charName: 'TeammatePal',
      charClass: 3,
      charLevel: 90,
      partyId: 1,
    })

    // Kill #2 while another player is in game -> count = 2, soloCount = 1
    h.adapter.emit({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 501, classId: 19, x: 5000, y: 5000, lifePct: 128, mode: 1 },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 501, mode: 0 })

    // Second player leaves game (0x5C, unitId = 2, partyId = 0xffff, no charName) -> solo again
    h.adapter.emit({
      type: 'Party',
      kind: 'roster',
      unitId: 2,
      partyId: 0xffff,
    })

    // Kill #3 after other player left -> count = 3, soloCount = 2
    h.adapter.emit({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 502, classId: 19, x: 5000, y: 5000, lifePct: 128, mode: 1 },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 502, mode: 0 })

    await h.tracker.flushNow()
    const snap = await h.repository.loadAll()
    expect(snap.tallies).toHaveLength(1)
    expect(snap.tallies[0]?.count).toBe(3)
    expect(snap.tallies[0]?.soloCount).toBe(2)
    h.tracker.destroy()
  })

  it('skips counting before GameFlags, when identity is incomplete, or during replay phase, and resets per-game', async () => {
    let currentIdentity: KillCharacterProfile | null = makeDefaultProfile()
    const h = setupHarness({ identity: () => currentIdentity })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // 1. Before GameFlags -> warns once and skips
    h.adapter.emit({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 600, classId: 19, x: 5000, y: 5000, lifePct: 128, mode: 1 },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 600, mode: 0 })
    h.adapter.emit({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 601, classId: 19, x: 5000, y: 5000, lifePct: 128, mode: 1 },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 601, mode: 0 })
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(h.tracker.getStatus().pendingKills).toBe(0)

    // 2. GameFlags arrives, but identity is null -> warns once and skips
    currentIdentity = null
    h.sendGameFlags(0)
    h.adapter.emit({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 602, classId: 19, x: 5000, y: 5000, lifePct: 128, mode: 1 },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 602, mode: 0 })
    expect(warnSpy).toHaveBeenCalledTimes(2)
    expect(h.tracker.getStatus().pendingKills).toBe(0)

    // 3. New GameFlags resets units from previous game so old unit 603 doesn't carry over
    currentIdentity = makeDefaultProfile()
    h.adapter.emit({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 603, classId: 19, x: 5000, y: 5000, lifePct: 128, mode: 1 },
    })
    h.sendGameFlags(1) // new game resets units
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 603, mode: 0 })
    expect(h.tracker.getStatus().pendingKills).toBe(0)

    // 4. Replay phase is ignored
    h.session.loadD2CapReplay('')
    expect(h.session.phase).toBe('replay')
    h.adapter.emit({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 604, classId: 19, x: 5000, y: 5000, lifePct: 128, mode: 1 },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 604, mode: 0 })
    expect(h.tracker.getStatus().pendingKills).toBe(0)

    warnSpy.mockRestore()
    h.tracker.destroy()
  })

  it('flushes on 2000ms timer, visibilitychange(hidden), pagehide, leaving ingame, retries with exponential backoff, and isolates listener errors', async () => {
    let throwInIdentity = false
    const defaultProfile = makeDefaultProfile()
    const h = setupHarness({
      identity: () => {
        if (throwInIdentity) {
          throw new Error('Injected identity failure')
        }
        return defaultProfile
      },
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    h.sendGameFlags(2)

    // 1. Schedule 2000ms timer on first kill
    h.adapter.emit({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 700, classId: 19, x: 5000, y: 5000, lifePct: 128, mode: 1 },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 700, mode: 0 })
    expect(h.scheduler.pendingDelays()).toEqual([2000])

    // Simulate 2 repository write failures -> backoff 2000ms then 4000ms
    h.repository.failNextApplyCount = 2
    h.scheduler.fireNext()
    await Promise.resolve()
    await Promise.resolve()
    expect(h.tracker.getStatus().pendingKills).toBe(1)
    expect(h.scheduler.pendingDelays()).toEqual([2000])

    h.scheduler.fireNext()
    await Promise.resolve()
    await Promise.resolve()
    expect(h.tracker.getStatus().pendingKills).toBe(1)
    expect(h.scheduler.pendingDelays()).toEqual([4000])

    // Third attempt succeeds and broadcasts 'updated'
    h.scheduler.fireNext()
    await Promise.resolve()
    await Promise.resolve()
    expect(h.tracker.getStatus().pendingKills).toBe(0)
    expect(h.broadcastMessages).toHaveLength(1)
    expect(h.broadcastMessages[0]?.type).toBe('updated')

    // 2. visibilitychange('hidden') triggers immediate flush
    h.adapter.emit({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 701, classId: 19, x: 5000, y: 5000, lifePct: 128, mode: 1 },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 701, mode: 0 })
    expect(h.tracker.getStatus().pendingKills).toBe(1)
    h.windowLike.dispatchVisibilityChange('hidden')
    await Promise.resolve()
    await Promise.resolve()
    expect(h.tracker.getStatus().pendingKills).toBe(0)
    expect(h.broadcastMessages).toHaveLength(2)

    // 3. pagehide triggers immediate flush
    h.adapter.emit({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 702, classId: 19, x: 5000, y: 5000, lifePct: 128, mode: 1 },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 702, mode: 0 })
    h.windowLike.dispatchPageHide()
    await Promise.resolve()
    await Promise.resolve()
    expect(h.tracker.getStatus().pendingKills).toBe(0)
    expect(h.broadcastMessages).toHaveLength(3)

    // 4. Listener error isolation: throwing inside KillTracker never breaks subsequent session listeners
    let downstreamListenerCalled = false
    h.session.onServerEvent(() => {
      downstreamListenerCalled = true
    })
    throwInIdentity = true
    h.adapter.emit({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 703, classId: 19, x: 5000, y: 5000, lifePct: 128, mode: 1 },
    })
    expect(() => {
      h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 703, mode: 0 })
    }).not.toThrow()
    expect(downstreamListenerCalled).toBe(true)
    expect(h.tracker.getStatus().lastError).toContain('Injected identity failure')

    // 5. Leaving ingame flushes any remaining kills
    throwInIdentity = false
    h.adapter.emit({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 704, classId: 19, x: 5000, y: 5000, lifePct: 128, mode: 1 },
    })
    h.adapter.emit({ type: 'UnitMode', unitType: 1, id: 704, mode: 0 })
    expect(h.tracker.getStatus().pendingKills).toBe(1)
    await h.session.disconnect('test exit')
    await Promise.resolve()
    await Promise.resolve()
    expect(h.tracker.getStatus().pendingKills).toBe(0)

    const snap = await h.repository.loadAll()
    expect(snap.tallies[0]?.count).toBe(4)

    errSpy.mockRestore()
    h.tracker.destroy()
  })

  it('resolveSessionIdentity fails fast (never defaults to Amazon Lv1 SC) when 4-tuple, hasGameFlags, charClass, or level is missing', async () => {
    const emptySession = new OnlineSession()
    expect(resolveSessionIdentity(emptySession)).toEqual({
      ok: false,
      reason: 'incomplete character identity (host, realm, account, charName)',
    })

    const baseSnapshot = emptySession.getSnapshot()
    const makeMockSessionView = (overrides: {
      charClass?: number | null
      matchedCharClass?: number | undefined
      level?: number | null
      matchedLevel?: number | undefined
    }): PluginSessionView => {
      const eventCbs = new Set<(ev: ServerEvent) => void>()
      return {
        phase: 'ingame',
        loginHost: 'www.laiseek.xyz',
        getSnapshot: () => ({
          ...baseSnapshot,
          phase: 'ingame',
          username: 'DeckardCain',
          selectedRealm: {
            id: 1,
            title: 'D2CS',
            description: 'Realm',
          },
          realms: [],
          characters: [
            {
              name: 'SorcHero',
              charClass: overrides.matchedCharClass as never,
              level: overrides.matchedLevel as never,
              act: 1,
              difficulty: 2,
              hardcore: true,
              expansion: true,
              ladder: true,
              dead: false,
              expiresAt: 0,
              equipmentGraphics: new Uint8Array(0),
              rawStatString: new Uint8Array(0),
            },
          ],
          selectedChar: 'SorcHero',
        }),
        world: {
          difficulty: 2,
          hardcore: true,
          expansion: true,
          ladder: true,
          self: {
            unitId: 1,
            charClass: (overrides.charClass ?? null) as never,
            level: (overrides.level ?? null) as never,
            name: 'SorcHero',
          },
          party: new Map(),
        } as never,
        onServerEvent: (cb) => {
          eventCbs.add(cb)
          return () => eventCbs.delete(cb)
        },
        onStateChange: () => () => {},
      }
    }

    // 1. hasGameFlags === false -> fails fast
    const validView = makeMockSessionView({ charClass: 1, level: 88 })
    expect(resolveSessionIdentity(validView, false)).toEqual({
      ok: false,
      reason: 'GameFlags (0x01) difficulty has not been received in this game',
    })

    // 2. Missing charClass (both self.charClass === null and matchedChar.charClass === undefined) -> fails fast
    const missingClassView = makeMockSessionView({
      charClass: null,
      matchedCharClass: undefined,
      level: 88,
    })
    expect(resolveSessionIdentity(missingClassView, true)).toEqual({
      ok: false,
      reason: 'missing or invalid character class (expected integer 0..6)',
    })

    // 3. Missing level (both self.level === null and matchedChar.level === 0) -> fails fast
    const missingLevelView = makeMockSessionView({
      charClass: 1,
      level: null,
      matchedLevel: 0,
    })
    expect(resolveSessionIdentity(missingLevelView, true)).toEqual({
      ok: false,
      reason: 'missing or invalid character level (expected finite integer >= 1)',
    })

    // 4. Valid authoritative metadata -> succeeds with exact profile
    const resolved = resolveSessionIdentity(validView, true)
    expect(resolved).toEqual({
      ok: true,
      profile: {
        charKey: computeCharKey('www.laiseek.xyz', 'D2CS', 'DeckardCain', 'SorcHero'),
        host: 'www.laiseek.xyz',
        realm: 'D2CS',
        account: 'DeckardCain',
        charName: 'SorcHero',
        charClass: 1,
        level: 88,
        hardcore: true,
        expansion: true,
        ladder: true,
      },
    })

    // 5. KillTracker with missing charClass skips recording, logs once via log.warn, and sets lastSkipReason
    const warnCalls: unknown[][] = []
    const repo = new MemoryKillStatsRepository()
    let emitEvent: ((ev: ServerEvent) => void) | null = null
    const viewWithMissingClass: PluginSessionView = {
      ...missingClassView,
      onServerEvent: (cb) => {
        emitEvent = cb
        return () => {}
      },
    }
    const tracker = new KillTracker({
      session: viewWithMissingClass,
      repository: repo,
      log: {
        info: () => {},
        warn: (...args) => warnCalls.push(args),
        error: () => {},
      },
    })
    emitEvent!({
      type: 'GameFlags',
      difficulty: 2,
      hardcore: true,
      expansion: true,
      ladder: true,
    })
    emitEvent!({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 901, classId: 19, x: 5000, y: 5000, lifePct: 128, mode: 1 },
    })
    emitEvent!({ type: 'UnitMode', unitType: 1, id: 901, mode: 0 })
    expect(warnCalls).toHaveLength(1)
    expect(tracker.getStatus().pendingKills).toBe(0)
    expect(tracker.getStatus().lastSkipReason).toContain('character class')
    await tracker.flushNow()
    expect((await repo.loadAll()).characters).toHaveLength(0)
    tracker.destroy()
  })
})
