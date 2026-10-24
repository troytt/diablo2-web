/**
 * Standalone Diablo II v1.13c Trade Hall Controller (`plugins/trade-hall/trade-hall-controller.ts`).
 *
 * Orchestrates the online-only Trade Hall user journey:
 * 1. Minimal art asset initialization (`HudManager.init('/ui', { tradeHallOnly: true })`) — loads only
 *    Inventory (`invchar6.dc6`), Stash (`TradeStash.dc6`), Trade (`trade.dc6`), Cube (`supertransmogrifier.dc6`),
 *    buttons/borders, item atlas (`items-atlas.png`), sockets (`gemsocket.png`), cursor, and bitmap fonts.
 *    Skips all `.ds1`/`.dt1` map tiles, `.dcc`/`.cof` paperdoll animations, monsters, missiles, skill trees,
 *    and `.wav` audio packs.
 * 2. Real BNCS -> MCP -> D2GS online authentication, character selection (with cross-tab lease protection),
 *    and trade room discovery / creation / joining (with room-name collision auto-increment suggestion).
 * 3. Auto-move to Act 1 Stash (`classId = 267`, `Bank`) immediately upon entering a D2GS room, surfacing
 *    a prominent `正在移动。。。。` UI status banner, walking to the Stash, and sending `C2S 0x13 Interact`
 *    to open the Stash (`S2C 0x77 0x10`) side-by-side with the Inventory (`invchar6.dc6`).
 * 4. Room player roster & 1-click Trade Initiation (`requestTradeWithPlayer`), with `cursorItem` safety lock,
 *    automatic Stash/Cube close (`C2S 0x4F 0x12` / `0x17`), auto-approach with `正在移动。。。。` banner,
 *    and out-of-town trade whisper fallback (`/w <name> ...`).
 * 5. Live Offer Affix Inspector, Anti-Scam Partner Modification Diff Auditor (`S2C 0x77 0x0E` 5-second red
 *    accept lockout + exact diff of removed items / lowered gold), Pre-Accept 2D Grid Capacity & Gold Cap
 *    Verification, Cursor-Item 1-Click Safety Recovery, and Completed Trade Receipt Log (`S2C 0x77 0x0D`).
 */

import {
  ClickButtonId,
  type CharSummary,
  type ClientCommand,
  type GameCreateSpec,
  type GameListEntry,
  type GameServerAdapter,
  type ItemData,
  type ServerEvent,
} from '../../src/netproto/index.ts'
import { isObjectInInteractRange113c } from '../../src/common/world/objects-meta.ts'
import { isTownLevel } from '../../src/common/world/scene-population.ts'
import {
  DuplicateCharacterLoginError,
  HudManager,
  INV_COLS,
  INV_ROWS,
  OnlineSession,
  findFreeGridSlot,
  formatLobbyGameEnterError,
  getInventoryGoldLimit,
  getStashGoldLimit,
  parseMcpGameErrorStatus,
  type ChatLogEntry,
  type GridPlacement,
  type OnlineSessionLobbySnapshot,
  type OnlineSessionLoginParams,
  type OnlineSessionOptions,
  type UiInventoryItem,
} from '../../src/client/plugin-host/api.ts'

export const ACT1_ROGUE_ENCAMPMENT_AREA_ID = 1
export const STASH_BANK_OBJECT_CLASS_ID = 267
export const STASH_COLS_113C = 6
export const STASH_ROWS_113C = 8
export const TRADE_ACCEPT_LOCKOUT_MS = 5_000
export const AUTO_MOVE_TIMEOUT_MS = 8_000

const CLASS_NAMES_ZH: Readonly<Record<number, string>> = {
  0: '亚马逊 (Amazon)',
  1: '法师 (Sorceress)',
  2: '死灵法师 (Necromancer)',
  3: '圣骑士 (Paladin)',
  4: '野蛮人 (Barbarian)',
  5: '德鲁伊 (Druid)',
  6: '刺客 (Assassin)',
}

export function getCharClassLabelZh(charClass: number | null | undefined): string {
  if (charClass === null || charClass === undefined) return '未知职业'
  return CLASS_NAMES_ZH[charClass] ?? `职业 #${charClass}`
}

/**
 * Suggests the next available trade room name when `MCP_CREATEGAME (0x03)` fails with `0x1F`
 * (Game name already exists), e.g. `trade-01` -> `trade-02`, `shako` -> `shako-02`.
 */
export function suggestNextTradeRoomName(rawName: string): string {
  const trimmed = rawName.trim().slice(0, 15)
  if (!trimmed) return 'trade-01'
  const match = /^(.*?)(\d+)$/.exec(trimmed)
  if (match) {
    const prefix = match[1]!
    const digits = match[2]!
    const nextNum = Number.parseInt(digits, 10) + 1
    const padded = String(nextNum).padStart(digits.length, '0')
    const candidate = `${prefix}${padded}`
    if (candidate.length <= 15) return candidate
  }
  const base = trimmed.replace(/-+$/, '').slice(0, 12)
  return `${base}-02`
}

/**
 * Filter and sort lobby games for the Trade Hall room browser.
 */
export function filterTradeRooms(
  games: readonly GameListEntry[],
  searchQuery = '',
  onlyTradeRooms = false,
): GameListEntry[] {
  const q = searchQuery.trim().toLowerCase()
  const tradeKeywords = ['trade', 'trd', 'o ', 'n ', 'offer', 'need', '交易', '换', '出', '收', '买', '卖']
  const isTradeTagged = (g: GameListEntry): boolean => {
    const text = `${g.name} ${g.description ?? ''}`.toLowerCase()
    return tradeKeywords.some((kw) => text.includes(kw))
  }

  return games
    .filter((g) => {
      if (!g.name || g.playerCount <= 0) return false
      if (onlyTradeRooms && !isTradeTagged(g)) return false
      if (!q) return true
      const haystack = `${g.name} ${g.description ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
    .sort((a, b) => {
      const aTrade = isTradeTagged(a) ? 1 : 0
      const bTrade = isTradeTagged(b) ? 1 : 0
      if (aTrade !== bTrade) return bTrade - aTrade
      return b.playerCount - a.playerCount
    })
}

export interface TradeHallMovementStatus {
  readonly active: boolean
  readonly kind: 'none' | 'stash' | 'partner'
  /** Primary user-facing status banner text (e.g. `正在移动。。。。`). */
  readonly title: string
  /** Secondary descriptive detail (e.g. `正在自动前往 A1 储藏箱旁...`). */
  readonly detail: string
  readonly targetUnitId: number | null
  readonly targetX: number | null
  readonly targetY: number | null
  readonly startedAtMs: number
}

export interface TradeHallRoomPlayer {
  readonly unitId: number
  readonly name: string
  readonly charClass: number
  readonly classLabelZh: string
  readonly level: number
  readonly areaId: number
  readonly inTown: boolean
  readonly x: number
  readonly y: number
  readonly distanceSubTiles: number | null
  readonly inInteractRange: boolean
}

export interface TradeDiffAlert {
  readonly id: number
  readonly timestampMs: number
  readonly partnerName: string
  readonly removedItems: readonly {
    readonly id: string
    readonly nameZh: string
    readonly nameEn: string
    readonly quality: string
  }[]
  readonly previousGold: number
  readonly currentGold: number
  readonly summaryText: string
}

export interface TradeCapacityEvaluation {
  readonly canFitAllItems: boolean
  readonly missingSlotsForItems: readonly string[]
  readonly canFitGold: boolean
  readonly goldOverflowAmount: number
  readonly inventoryGoldLimit: number
  readonly blockingReasons: readonly string[]
}

export interface TradeReceipt {
  readonly id: number
  readonly completedAtIso: string
  readonly roomName: string
  readonly partnerName: string
  readonly givenItems: readonly {
    readonly id: string
    readonly nameZh: string
    readonly quality: string
    readonly statsSummary: readonly string[]
  }[]
  readonly receivedItems: readonly {
    readonly id: string
    readonly nameZh: string
    readonly quality: string
    readonly statsSummary: readonly string[]
  }[]
  readonly givenGold: number
  readonly receivedGold: number
}

export interface TradeHallNotice {
  readonly level: 'info' | 'warning' | 'error' | 'success'
  readonly text: string
  readonly suggestedRoomName?: string | undefined
  readonly canReconnect?: boolean | undefined
  readonly canRetryStash?: boolean | undefined
}

export interface TradeHallSnapshot {
  readonly lobby: OnlineSessionLobbySnapshot
  readonly inGame: boolean
  readonly areaId: number
  readonly stashOpen: boolean
  readonly cubeOpen: boolean
  readonly tradeActive: boolean
  readonly pendingModal: 'wait' | 'request' | null
  readonly partnerName: string
  readonly selfGold: number
  readonly stashGold: number
  readonly inventoryGoldLimit: number
  readonly stashGoldLimit: number
  readonly selfTradeGold: number
  readonly partnerTradeGold: number
  readonly selfAccepted: boolean
  readonly partnerAccepted: boolean
  readonly acceptDisabled: boolean
  readonly lockoutRemainingMs: number
  readonly cursorItem: UiInventoryItem | null
  readonly selfTradeItems: readonly UiInventoryItem[]
  readonly partnerTradeItems: readonly UiInventoryItem[]
  readonly movementStatus: TradeHallMovementStatus
  readonly roomPlayers: readonly TradeHallRoomPlayer[]
  readonly capacityEvaluation: TradeCapacityEvaluation
  readonly tradeDiffAlert: TradeDiffAlert | null
  readonly tradeReceipts: readonly TradeReceipt[]
  readonly notice: TradeHallNotice | null
  readonly lastActiveGameName: string | null
  readonly lastActiveGamePassword: string
}

interface ActiveTradeOfferSnapshot {
  partnerName: string
  selfItems: UiInventoryItem[]
  partnerItems: UiInventoryItem[]
  selfGold: number
  partnerGold: number
}

const IDLE_MOVEMENT_STATUS: TradeHallMovementStatus = {
  active: false,
  kind: 'none',
  title: '',
  detail: '',
  targetUnitId: null,
  targetX: null,
  targetY: null,
  startedAtMs: 0,
}

export interface TradeHallControllerOptions extends OnlineSessionOptions {
  readonly uiBaseUrl?: string | undefined
}

export class TradeHallController {
  readonly hudManager: HudManager
  readonly session: OnlineSession
  private readonly uiBaseUrl: string
  private readonly listeners = new Set<(snap: TradeHallSnapshot) => void>()

  private movementStatusValue: TradeHallMovementStatus = IDLE_MOVEMENT_STATUS
  private pendingStashInteractSent = false
  private pendingPartnerInteractSent = false
  private autoStashCompletedForCurrentGame = false

  private lastActiveTradeSnapshot: ActiveTradeOfferSnapshot | null = null
  private tradeDiffAlertValue: TradeDiffAlert | null = null
  private nextDiffAlertId = 1
  private lockoutStartedAtMs: number | null = null
  private readonly tradeReceiptsValue: TradeReceipt[] = []
  private nextReceiptId = 1
  private noticeValue: TradeHallNotice | null = null
  private lastActiveGameNameValue: string | null = null
  private lastActiveGamePasswordValue = ''
  private lastLoginParams: OnlineSessionLoginParams | null = null

  constructor(options: TradeHallControllerOptions = {}) {
    this.uiBaseUrl = options.uiBaseUrl ?? '/ui'
    this.hudManager = options.hudManager ?? new HudManager()
    this.hudManager.tradeHallMode = true
    this.hudManager.rightPanel = 'inv'
    this.hudManager.inventory.visible = true
    this.hudManager.tradeHallIdleHint = {
      title: '暗黑破坏神 II · 1.13c 交易大厅',
      subtitle: '进入房间后将自动前往 A1 储藏箱旁，从储藏箱取物至背包，再放入交易栏完成交易',
    }

    this.session = new OnlineSession({
      ...options,
      hudManager: this.hudManager,
      mapService: null,
    })
    this.hudManager.resize(800, 600)
    this.session.camera.resize(this.hudManager.getViewportProfile())

    // In Trade Hall mode, no .ds1/.dt1 map tiles are loaded. Allow local movement prediction
    // (RunToLocation / RunToTarget to the A1 Stash or trade partner) to step smoothly in town.
    this.session.world.setCollisionChecker(() => false, () => null)
    this.session.world.setMissileCollisionChecker(() => false)
    this.session.predictor.setCollisionChecker(() => false)
    this.session.interpolator.setCollisionChecker(() => false)

    this.session.onStateChange((lobbySnap) => {
      if (lobbySnap.activeGameName) {
        this.lastActiveGameNameValue = lobbySnap.activeGameName
      }
      if (lobbySnap.phase !== 'ingame') {
        this.clearMovementStatus()
        this.autoStashCompletedForCurrentGame = false
        this.lastActiveTradeSnapshot = null
      }
      this.syncTradeHallIdleHint()
      this.emitChange()
    })

    this.session.onDisconnect((reason) => {
      this.clearMovementStatus()
      this.noticeValue = {
        level: 'error',
        text: `连接已断开：${reason}`,
        canReconnect: Boolean(this.lastActiveGameNameValue),
      }
      this.emitChange()
    })

    this.session.onServerEvent((ev) => {
      this.handleServerEvent(ev)
    })
  }

  /**
   * Initialize only the minimal UI panel, item icon, font, and cursor assets required for Trade Hall.
   */
  async init(baseUrl = this.uiBaseUrl): Promise<void> {
    await this.hudManager.init(baseUrl, { tradeHallOnly: true })
    this.hudManager.tradeHallMode = true
    this.hudManager.rightPanel = 'inv'
    this.hudManager.inventory.visible = true
    this.syncTradeHallIdleHint()
    this.emitChange()
  }

  onChange(cb: (snap: TradeHallSnapshot) => void): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  onChatMessage(cb: (entry: ChatLogEntry) => void): () => void {
    return this.session.onChatMessage(cb)
  }

  setNotice(notice: TradeHallNotice | null): void {
    this.noticeValue = notice
    this.emitChange()
  }

  clearTradeDiffAlert(): void {
    this.tradeDiffAlertValue = null
    this.emitChange()
  }

  // ─── Step 1 & 2: Online Auth, Character Selection & Trade Room Lobby ───

  private async ensureLobbySession(preferredChar?: string): Promise<void> {
    if (
      (this.session.phase === 'disconnected' || this.session.phase === 'error') &&
      this.lastLoginParams
    ) {
      const targetChar = preferredChar || this.session.selectedChar || undefined
      const res = await this.session.login(this.lastLoginParams)
      const charToLogon =
        (targetChar &&
          res.characters.find((c) => c.name.toLowerCase() === targetChar.toLowerCase())?.name) ||
        res.characters[0]?.name
      if (charToLogon) {
        await this.session.selectCharacter(charToLogon)
      }
      this.noticeValue = null
    }
  }

  async login(params: OnlineSessionLoginParams): Promise<{
    readonly realms: readonly unknown[]
    readonly characters: readonly CharSummary[]
  }> {
    this.noticeValue = null
    this.lastLoginParams = { ...params }
    const res = await this.session.login(params)
    if (res.characters.length > 0) {
      const targetChar = this.session.selectedChar || res.characters[0]!.name
      await this.session.selectCharacter(targetChar)
    }
    this.emitChange()
    return res
  }

  async createAccountAndLogin(params: OnlineSessionLoginParams): Promise<{
    readonly realms: readonly unknown[]
    readonly characters: readonly CharSummary[]
  }> {
    this.noticeValue = null
    this.lastLoginParams = { ...params }
    const res = await this.session.createAccountAndLogin(params)
    if (res.characters.length > 0) {
      const targetChar = this.session.selectedChar || res.characters[0]!.name
      await this.session.selectCharacter(targetChar)
    }
    this.emitChange()
    return res
  }

  async selectCharacter(charName: string): Promise<void> {
    if (
      (this.session.phase === 'disconnected' || this.session.phase === 'error') &&
      this.lastLoginParams
    ) {
      await this.ensureLobbySession(charName)
    } else {
      await this.session.selectCharacter(charName)
    }
    this.hudManager.rightPanel = 'inv'
    this.hudManager.inventory.visible = true
    this.noticeValue = null
    this.emitChange()
  }

  async listTradeRooms(filter = ''): Promise<readonly GameListEntry[]> {
    await this.ensureLobbySession()
    const games = await this.session.listGames(filter)
    this.emitChange()
    return games
  }

  async createTradeRoom(spec: GameCreateSpec): Promise<GameServerAdapter> {
    const roomName = spec.name.trim()
    const password = spec.password ?? ''
    try {
      this.noticeValue = null
      await this.ensureLobbySession()
      const adapter = await this.session.enterGame({
        mode: 'create',
        spec: {
          ...spec,
          name: roomName,
          password,
        },
      })
      this.lastActiveGameNameValue = roomName
      this.lastActiveGamePasswordValue = password
      this.beginAutoMoveToAct1Stash()
      this.emitChange()
      return adapter
    } catch (err) {
      this.handleLobbyEnterError(err, 'create', roomName)
      throw err
    }
  }

  async joinTradeRoom(name: string, password = ''): Promise<GameServerAdapter> {
    const roomName = name.trim()
    try {
      this.noticeValue = null
      await this.ensureLobbySession()
      const adapter = await this.session.enterGame({
        mode: 'join',
        name: roomName,
        password,
      })
      this.lastActiveGameNameValue = roomName
      this.lastActiveGamePasswordValue = password
      this.beginAutoMoveToAct1Stash()
      this.emitChange()
      return adapter
    } catch (err) {
      this.handleLobbyEnterError(err, 'join', roomName)
      throw err
    }
  }

  /**
   * 1-click reconnect to the most recent trade room after an unexpected disconnect.
   */
  async reconnectLastTradeRoom(): Promise<GameServerAdapter | null> {
    const roomName = this.lastActiveGameNameValue
    if (!roomName) return null
    return await this.joinTradeRoom(roomName, this.lastActiveGamePasswordValue)
  }

  async leaveTradeRoom(): Promise<void> {
    this.clearMovementStatus()
    await this.session.leaveGame()
    this.emitChange()
  }

  private handleLobbyEnterError(
    err: unknown,
    mode: 'create' | 'join',
    attemptedRoomName: string,
  ): void {
    const charName = this.session.selectedChar ?? this.session.world.self.name
    if (err instanceof DuplicateCharacterLoginError) {
      this.noticeValue = {
        level: 'error',
        text: `该角色 (${charName}) 已在另一个浏览器标签页的房间中处于活跃状态，请先关闭或退出另一标签页。`,
      }
      this.emitChange()
      return
    }
    const parsedErr = parseMcpGameErrorStatus(err)
    const formatted = formatLobbyGameEnterError(err, charName)
    if (mode === 'create' && parsedErr?.status === 0x1f) {
      const suggested = suggestNextTradeRoomName(attemptedRoomName)
      this.noticeValue = {
        level: 'warning',
        text: `房间名 "${attemptedRoomName}" 已存在 (${formatted})，建议改用 "${suggested}"`,
        suggestedRoomName: suggested,
      }
    } else {
      this.noticeValue = {
        level: 'error',
        text: formatted,
      }
    }
    this.emitChange()
  }

  // ─── Step 3: Auto-Move to Act 1 Stash (`正在移动。。。。`) ─────────────

  /**
   * Initiates automatic movement to the Act 1 Stash (`classId = 267`, `Bank`) and opens it.
   * Called automatically on room entry and available as a 1-click manual button in the Trade Hall UI.
   */
  beginAutoMoveToAct1Stash(nowMs = performance.now()): boolean {
    if (this.session.phase !== 'ingame') return false
    if (this.hasCursorItem()) {
      this.noticeValue = {
        level: 'warning',
        text: '鼠标手上正拿着物品，请先将物品放回背包或储藏箱后再移动。',
      }
      this.emitChange()
      return false
    }
    if (this.session.world.trade.active || this.session.world.trade.pendingModal) {
      this.noticeValue = {
        level: 'warning',
        text: '当前正在进行玩家交易，请先完成或取消交易后再打开储藏箱。',
      }
      this.emitChange()
      return false
    }
    if (this.session.world.npcInteraction.stashOpen) {
      this.hudManager.leftPanel = 'stash'
      this.hudManager.rightPanel = 'inv'
      this.hudManager.inventory.visible = true
      this.clearMovementStatus()
      this.emitChange()
      return true
    }

    const stashObj = this.findStashObject()
    this.pendingStashInteractSent = false
    this.movementStatusValue = {
      active: true,
      kind: 'stash',
      title: '正在移动。。。。',
      detail: stashObj
        ? `正在前往罗格营地 (A1) 储藏箱 (${Math.round(stashObj.x)}, ${Math.round(stashObj.y)})...`
        : '正在定位并前往罗格营地 (A1) 储藏箱旁...',
      targetUnitId: stashObj?.id ?? null,
      targetX: stashObj ? Math.round(stashObj.x) : null,
      targetY: stashObj ? Math.round(stashObj.y) : null,
      startedAtMs: nowMs,
    }
    this.syncTradeHallIdleHint()
    if (stashObj) {
      this.driveMoveTowardStash(stashObj, nowMs)
    }
    this.emitChange()
    return true
  }

  private findStashObject() {
    const objects = this.session.world.getUnitsByType('object')
    for (const obj of objects) {
      if (obj.classId === STASH_BANK_OBJECT_CLASS_ID) {
        return obj
      }
    }
    return null
  }

  private getSelfPos(): { readonly x: number; readonly y: number } {
    const pred = this.session.predictor.getSnapshot()
    if (pred.x !== 0 || pred.y !== 0) {
      return { x: pred.x, y: pred.y }
    }
    const self = this.session.world.self
    if (self.x !== 0 || self.y !== 0) {
      return { x: self.x, y: self.y }
    }
    const selfUnit =
      this.session.world.selfId !== 0
        ? this.session.world.getUnit('player', this.session.world.selfId)
        : undefined
    return { x: selfUnit?.x ?? 0, y: selfUnit?.y ?? 0 }
  }

  private driveMoveTowardStash(
    stashObj: { readonly id: number; readonly x: number; readonly y: number },
    nowMs: number,
  ): void {
    const selfPos = this.getSelfPos()
    const hasSelfPos = selfPos.x !== 0 || selfPos.y !== 0
    const hasStashPos = stashObj.x !== 0 || stashObj.y !== 0

    const initPredSnap = this.session.predictor.getSnapshot()
    if (!hasSelfPos && hasStashPos) {
      this.session.predictor.setPosition(stashObj.x, stashObj.y)
      this.session.world.self.x = stashObj.x
      this.session.world.self.y = stashObj.y
    } else if (hasSelfPos && initPredSnap.x === 0 && initPredSnap.y === 0) {
      this.session.predictor.setPosition(selfPos.x, selfPos.y)
    }

    const curSelfPos = this.getSelfPos()
    const inRange =
      !hasStashPos ||
      isObjectInInteractRange113c(
        Math.round(curSelfPos.x),
        Math.round(curSelfPos.y),
        2,
        Math.round(stashObj.x),
        Math.round(stashObj.y),
        STASH_BANK_OBJECT_CLASS_ID,
      )

    if (!inRange) {
      const predSnap = this.session.predictor.getSnapshot()
      const goalX = Math.round(stashObj.x)
      const goalY = Math.round(stashObj.y)
      const curWp = predSnap.currentWaypoint
      if (!predSnap.moving || !curWp || Math.hypot(curWp.x - goalX, curWp.y - goalY) > 1) {
        this.session.predictor.setPath([{ x: goalX, y: goalY }], true)
        this.session.dispatchCommand(
          {
            type: 'RunToTarget',
            unitKind: 'object',
            unitId: stashObj.id,
          },
          nowMs,
        )
      }
      return
    }

    if (!this.pendingStashInteractSent) {
      this.pendingStashInteractSent = true
      this.session.predictor.stop()
      this.session.dispatchCommand(
        {
          type: 'RunToTarget',
          unitKind: 'object',
          unitId: stashObj.id,
        },
        nowMs,
      )
      this.session.dispatchCommand(
        {
          type: 'Interact',
          target: { unitType: 'object', id: stashObj.id },
        },
        nowMs,
      )
    }
  }

  // ─── Step 4: Room Player Roster & 1-Click Trade Initiation ─────────────

  getRoomPlayers(): TradeHallRoomPlayer[] {
    const world = this.session.world
    const selfId = world.selfId
    const selfPos = this.getSelfPos()
    const hasSelfPos = selfPos.x !== 0 || selfPos.y !== 0

    const byId = new Map<number, TradeHallRoomPlayer>()

    for (const member of world.party.values()) {
      const pid = member.unitId
      if (!pid || (selfId !== 0 && pid === selfId)) continue
      const unit = world.getUnit('player', pid)
      const px = unit?.x || member.x || 0
      const py = unit?.y || member.y || 0
      const areaId = member.areaId || member.levelId || (unit ? world.areaId : 0) || 0
      const inTown = areaId > 0 ? isTownLevel(areaId) : true
      const dist =
        hasSelfPos && (px !== 0 || py !== 0)
          ? Math.round(Math.hypot(px - selfPos.x, py - selfPos.y) * 10) / 10
          : null
      const charClass = member.charClass ?? unit?.classId ?? 0
      byId.set(pid, {
        unitId: pid,
        name: member.charName || unit?.name || `Player #${pid}`,
        charClass,
        classLabelZh: getCharClassLabelZh(charClass),
        level: member.charLevel ?? unit?.stats?.get(12) ?? 1,
        areaId,
        inTown,
        x: px,
        y: py,
        distanceSubTiles: dist,
        inInteractRange: dist !== null ? dist <= 6 : true,
      })
    }

    for (const unit of world.getUnitsByType('player')) {
      if (!unit.id || (selfId !== 0 && unit.id === selfId)) continue
      if (byId.has(unit.id)) continue
      const px = unit.x
      const py = unit.y
      const areaId = world.areaId || ACT1_ROGUE_ENCAMPMENT_AREA_ID
      const inTown = areaId > 0 ? isTownLevel(areaId) : true
      const dist =
        hasSelfPos && (px !== 0 || py !== 0)
          ? Math.round(Math.hypot(px - selfPos.x, py - selfPos.y) * 10) / 10
          : null
      byId.set(unit.id, {
        unitId: unit.id,
        name: unit.name || `Player #${unit.id}`,
        charClass: unit.classId,
        classLabelZh: getCharClassLabelZh(unit.classId),
        level: unit.stats?.get(12) || 1,
        areaId,
        inTown,
        x: px,
        y: py,
        distanceSubTiles: dist,
        inInteractRange: dist !== null ? dist <= 6 : true,
      })
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * 1-click trade request with a player in the room:
   * - Guards against holding a `cursorItem`.
   * - Automatically closes Stash (`C2S 0x4F 0x12`) or Cube (`C2S 0x4F 0x17`) if open.
   * - If target player is outside town, sends a whisper (`/w <name> ...`) instead of `0x13`.
   * - Otherwise displays `正在移动。。。。`, walks toward the target player (`RunToTarget`), and sends `C2S 0x13 Interact`.
   */
  requestTradeWithPlayer(targetPlayerId: number, nowMs = performance.now()): boolean {
    if (this.session.phase !== 'ingame') return false
    if (this.hasCursorItem()) {
      this.noticeValue = {
        level: 'warning',
        text: '鼠标手上正拿着物品，请先放回背包或储藏箱后再发起交易！',
      }
      this.emitChange()
      return false
    }
    if (this.session.world.trade.active || this.session.world.trade.pendingModal) {
      this.noticeValue = {
        level: 'warning',
        text: '当前已有正在进行的交易请求或会话。',
      }
      this.emitChange()
      return false
    }

    const players = this.getRoomPlayers()
    const target = players.find((p) => p.unitId === targetPlayerId)
    const targetName = target?.name ?? `Player #${targetPlayerId}`

    if (target && !target.inTown) {
      this.session.submitChatInput(
        `/w ${targetName} 我在罗格营地(A1)储藏箱旁，请回城交易`,
        nowMs,
      )
      this.noticeValue = {
        level: 'info',
        text: `${targetName} 当前不在城镇内，已自动向对方发送私聊邀请回 A1 储藏箱旁交易。`,
      }
      this.emitChange()
      return false
    }

    // Automatically close open Stash or Cube before initiating player trade
    if (
      this.session.world.npcInteraction.stashOpen ||
      this.hudManager.leftPanel === 'stash'
    ) {
      this.session.hudModel.closeStash()
      this.hudManager.hideLeftPanelFromWorld('stash')
    }
    if (
      this.session.world.npcInteraction.cubeOpen ||
      this.hudManager.leftPanel === 'cube'
    ) {
      this.session.hudModel.closeCube()
      this.hudManager.hideLeftPanelFromWorld('cube')
    }

    this.pendingPartnerInteractSent = false
    this.movementStatusValue = {
      active: true,
      kind: 'partner',
      title: '正在移动。。。。',
      detail: `正在靠近交易对象 ${targetName} 并请求交易...`,
      targetUnitId: targetPlayerId,
      targetX: target && (target.x !== 0 || target.y !== 0) ? Math.round(target.x) : null,
      targetY: target && (target.x !== 0 || target.y !== 0) ? Math.round(target.y) : null,
      startedAtMs: nowMs,
    }
    this.syncTradeHallIdleHint()
    this.driveMoveTowardPartner(targetPlayerId, target, nowMs)
    this.emitChange()
    return true
  }

  private driveMoveTowardPartner(
    targetPlayerId: number,
    target: TradeHallRoomPlayer | undefined,
    nowMs: number,
  ): void {
    const selfPos = this.getSelfPos()
    const hasSelfPos = selfPos.x !== 0 || selfPos.y !== 0
    const initPredSnap = this.session.predictor.getSnapshot()
    if (hasSelfPos && initPredSnap.x === 0 && initPredSnap.y === 0) {
      this.session.predictor.setPosition(selfPos.x, selfPos.y)
    }
    const hasTargetPos = Boolean(target && (target.x !== 0 || target.y !== 0))
    const dist =
      hasSelfPos && hasTargetPos && target
        ? Math.hypot(target.x - selfPos.x, target.y - selfPos.y)
        : 0

    if (hasSelfPos && hasTargetPos && target && dist > 4) {
      const predSnap = this.session.predictor.getSnapshot()
      const goalX = Math.round(target.x)
      const goalY = Math.round(target.y)
      const curWp = predSnap.currentWaypoint
      if (!predSnap.moving || !curWp || Math.hypot(curWp.x - goalX, curWp.y - goalY) > 1) {
        this.session.predictor.setPath([{ x: goalX, y: goalY }], true)
        this.session.dispatchCommand(
          {
            type: 'RunToTarget',
            unitKind: 'player',
            unitId: targetPlayerId,
          },
          nowMs,
        )
      }
      return
    }

    if (!this.pendingPartnerInteractSent) {
      this.pendingPartnerInteractSent = true
      this.session.predictor.stop()
      this.session.dispatchCommand(
        {
          type: 'RunToTarget',
          unitKind: 'player',
          unitId: targetPlayerId,
        },
        nowMs,
      )
      this.session.dispatchCommand(
        {
          type: 'Interact',
          target: { unitType: 'player', id: targetPlayerId },
        },
        nowMs,
      )
    }
  }

  // ─── Step 5 & 6: Trade Actions, Capacity Check & Cursor Safety ───

  hasCursorItem(): boolean {
    return Boolean(this.session.world.containers.cursor || this.hudManager.inventory.cursorItem)
  }

  getCursorItem(): UiInventoryItem | null {
    if (this.hudManager.inventory.cursorItem) {
      return this.hudManager.inventory.cursorItem
    }
    const raw = this.session.world.containers.cursor
    return raw ? this.session.hudModel.toUiItem(raw) : null
  }

  /**
   * 1-Click safety recovery when an item is held on the cursor (`cursorItem`):
   * Finds the first available 2D slot in the 10×4 Inventory (`buffer = 0`) — or if full and Stash
   * is open, in the 6×8 Stash (`buffer = 4`) — and sends `C2S 0x18 ItemToBuffer`.
   */
  returnCursorItemToSafety(nowMs = performance.now()): boolean {
    const cursorUi = this.getCursorItem()
    const rawCursor = this.session.world.containers.cursor
    if (!cursorUi && !rawCursor) return false

    const itemId = rawCursor?.id ?? Number.parseInt(String(cursorUi?.id ?? '0'), 10)
    if (!Number.isFinite(itemId) || itemId <= 0) return false
    const w = cursorUi?.invWidth ?? rawCursor?.invWidth ?? 1
    const h = cursorUi?.invHeight ?? rawCursor?.invHeight ?? 1

    const invFree = findFreeGridSlot(this.hudManager.inventory.gridItems, w, h, INV_COLS, INV_ROWS)
    if (invFree) {
      this.session.dispatchCommand(
        {
          type: 'ItemPlace',
          itemId,
          x: invFree.col,
          y: invFree.row,
          buffer: 0,
        },
        nowMs,
      )
      this.noticeValue = {
        level: 'success',
        text: `已请求将鼠标上的 [${cursorUi?.nameZh ?? cursorUi?.name ?? `#${itemId}`}] 放回随身背包 (${invFree.col}, ${invFree.row})。`,
      }
      this.emitChange()
      return true
    }

    if (this.session.world.npcInteraction.stashOpen) {
      const stashFree = findFreeGridSlot(
        this.hudManager.worldPanels.stashItems,
        w,
        h,
        STASH_COLS_113C,
        STASH_ROWS_113C,
      )
      if (stashFree) {
        this.session.dispatchCommand(
          {
            type: 'ItemPlace',
            itemId,
            x: stashFree.col,
            y: stashFree.row,
            buffer: 4,
          },
          nowMs,
        )
        this.noticeValue = {
          level: 'success',
          text: `随身背包已满，已请求将 [${cursorUi?.nameZh ?? cursorUi?.name ?? `#${itemId}`}] 放回储藏箱 (${stashFree.col}, ${stashFree.row})。`,
        }
        this.emitChange()
        return true
      }
    }

    this.noticeValue = {
      level: 'error',
      text: `随身背包没有足够的 ${w}×${h} 连续空格存放 [${cursorUi?.nameZh ?? cursorUi?.name ?? `#${itemId}`}]，请先整理背包或打开储藏箱。`,
    }
    this.emitChange()
    return false
  }

  /**
   * Evaluates whether the local player's 10×4 Inventory has enough 2D grid space and gold capacity
   * to receive all items and gold currently offered by the trade partner.
   */
  evaluateTradeCapacity(): TradeCapacityEvaluation {
    const simulatedPlacements: GridPlacement[] = [...this.hudManager.inventory.gridItems]
    const partnerItems = (this.hudManager.trade?.partnerItems ?? []) as readonly UiInventoryItem[]
    const missingSlotsForItems: string[] = []

    for (const item of partnerItems) {
      const w = Math.max(1, item.invWidth || 1)
      const h = Math.max(1, item.invHeight || 1)
      const slot = findFreeGridSlot(simulatedPlacements, w, h, INV_COLS, INV_ROWS)
      if (!slot) {
        missingSlotsForItems.push(`${item.nameZh || item.name} (${w}×${h})`)
      } else {
        simulatedPlacements.push({
          item,
          col: slot.col,
          row: slot.row,
        })
      }
    }

    const playerLevel = Math.max(1, this.session.world.self.level || 1)
    const invGoldLimit = getInventoryGoldLimit(playerLevel)
    const currentGold = this.session.world.self.gold || 0
    const partnerGold = this.session.world.trade.partnerGold || 0
    const goldOverflowAmount = Math.max(0, currentGold + partnerGold - invGoldLimit)
    const canFitGold = goldOverflowAmount === 0
    const canFitAllItems = missingSlotsForItems.length === 0

    const blockingReasons: string[] = []
    if (!canFitAllItems) {
      blockingReasons.push(
        `随身背包 (10×4) 空间不足，无法容纳对方提供的：${missingSlotsForItems.join('、')}`,
      )
    }
    if (!canFitGold) {
      blockingReasons.push(
        `随身金币将超出角色等级上限 (${invGoldLimit.toLocaleString()})，超出 ${goldOverflowAmount.toLocaleString()} 金币`,
      )
    }

    return {
      canFitAllItems,
      missingSlotsForItems,
      canFitGold,
      goldOverflowAmount,
      inventoryGoldLimit: invGoldLimit,
      blockingReasons,
    }
  }

  /**
   * Step 25Hz frame tick: advances local movement predictor, auto-stash walk, and partner approach.
   */
  tick(dtMs = 40, nowMs = performance.now()): void {
    this.session.tick(dtMs, nowMs)
    const world = this.session.world

    if (world.trade.active) {
      if (this.movementStatusValue.active) {
        this.clearMovementStatus()
      }
      if (world.npcInteraction.stashOpen) {
        ;(world.npcInteraction as { stashOpen?: boolean }).stashOpen = false
      }
      if (world.npcInteraction.cubeOpen) {
        ;(world.npcInteraction as { cubeOpen?: boolean }).cubeOpen = false
      }
      if (this.hudManager.leftPanel !== 'trade') {
        this.hudManager.leftPanel = 'trade'
        this.hudManager.rightPanel = 'inv'
        this.hudManager.inventory.visible = true
      }
      this.captureActiveTradeSnapshot()
      this.emitChange()
    } else if (world.npcInteraction.stashOpen) {
      this.autoStashCompletedForCurrentGame = true
      if (this.movementStatusValue.kind === 'stash') {
        this.clearMovementStatus()
      }
      if (this.hudManager.leftPanel !== 'stash') {
        this.hudManager.leftPanel = 'stash'
        this.hudManager.rightPanel = 'inv'
        this.hudManager.inventory.visible = true
      }
    }

    if (this.movementStatusValue.active) {
      const elapsed = nowMs - this.movementStatusValue.startedAtMs
      if (this.movementStatusValue.kind === 'stash') {
        if (this.session.world.npcInteraction.stashOpen) {
          this.clearMovementStatus()
        } else if (elapsed > AUTO_MOVE_TIMEOUT_MS) {
          this.clearMovementStatus()
          this.noticeValue = {
            level: 'warning',
            text: '自动打开 A1 储藏箱超时，请点击上方「前往并打开 A1 储藏箱」重试。',
            canRetryStash: true,
          }
          this.emitChange()
        } else {
          const stashObj = this.findStashObject()
          if (stashObj) {
            this.driveMoveTowardStash(stashObj, nowMs)
          }
        }
      } else if (this.movementStatusValue.kind === 'partner') {
        if (
          this.session.world.trade.active ||
          this.session.world.trade.pendingModal !== null
        ) {
          this.clearMovementStatus()
        } else if (elapsed > AUTO_MOVE_TIMEOUT_MS) {
          this.clearMovementStatus()
          this.noticeValue = {
            level: 'warning',
            text: '靠近交易对象超时，请确认对方仍在罗格营地 (A1) 内并重试。',
          }
          this.emitChange()
        } else if (this.movementStatusValue.targetUnitId !== null) {
          const target = this.getRoomPlayers().find(
            (p) => p.unitId === this.movementStatusValue.targetUnitId,
          )
          this.driveMoveTowardPartner(this.movementStatusValue.targetUnitId, target, nowMs)
        }
      }
    }

    if (
      this.lockoutStartedAtMs !== null &&
      nowMs - this.lockoutStartedAtMs >= TRADE_ACCEPT_LOCKOUT_MS &&
      !this.session.world.trade.acceptDisabled
    ) {
      this.lockoutStartedAtMs = null
    }
  }

  private handleServerEvent(ev: ServerEvent): void {
    const nowMs = performance.now()
    const world = this.session.world

    // Trigger initial auto-walk to Act 1 Stash when entering Act 1 Town (`areaId === 1`) or when Stash spawns
    if (
      this.session.phase === 'ingame' &&
      !this.autoStashCompletedForCurrentGame &&
      !world.npcInteraction.stashOpen &&
      !world.trade.active &&
      !world.trade.pendingModal
    ) {
      if (
        ev.type === 'LoadAct' ||
        ev.type === 'GameLogonAck' ||
        ev.type === 'PlayerAssign' ||
        (ev.type === 'UnitAssign' &&
          ev.unit.unitType === 'object' &&
          ev.unit.classId === STASH_BANK_OBJECT_CLASS_ID)
      ) {
        if (!this.movementStatusValue.active) {
          this.beginAutoMoveToAct1Stash(nowMs)
        } else if (this.movementStatusValue.kind === 'stash') {
          const stashObj = this.findStashObject()
          if (stashObj) {
            this.driveMoveTowardStash(stashObj, nowMs)
          }
        }
      }
    }

    // Detect Trade modal / session opened -> clear partner approach movement banner and prioritize Trade panel
    if (world.trade.active || world.trade.pendingModal !== null) {
      if (this.movementStatusValue.kind === 'partner') {
        this.clearMovementStatus()
      }
      if (world.trade.active) {
        if (world.npcInteraction.stashOpen) {
          ;(world.npcInteraction as { stashOpen?: boolean }).stashOpen = false
        }
        if (world.npcInteraction.cubeOpen) {
          ;(world.npcInteraction as { cubeOpen?: boolean }).cubeOpen = false
        }
        this.hudManager.leftPanel = 'trade'
        this.hudManager.rightPanel = 'inv'
        this.hudManager.inventory.visible = true
      }
    } else if (world.npcInteraction.stashOpen) {
      // Detect Stash opened (`S2C 0x77 0x10`) when not in an active player trade
      this.autoStashCompletedForCurrentGame = true
      if (this.movementStatusValue.kind === 'stash') {
        this.clearMovementStatus()
      }
      this.hudManager.leftPanel = 'stash'
      this.hudManager.rightPanel = 'inv'
      this.hudManager.inventory.visible = true
    }

    // Handle `S2C 0x77` Trade ButtonActions
    if (ev.type === 'Trade') {
      const action = ev.action ?? 0
      if (action === 0x02) {
        this.noticeValue = { level: 'warning', text: '对方拒绝了交易请求 (Partner Declined)。' }
      } else if (action === 0x03 || action === 0x0c) {
        this.noticeValue = { level: 'info', text: '交易已取消，双方物品与金币已原路退回。' }
      } else if (action === 0x07) {
        this.noticeValue = { level: 'error', text: '交易失败：你的随身背包空间不足 (SellerNoRoom)！' }
      } else if (action === 0x08) {
        this.noticeValue = { level: 'error', text: '交易失败：对方的随身背包空间不足 (BuyerNoRoom)！' }
      } else if (action === 0x09) {
        this.noticeValue = { level: 'error', text: '交易失败：你的随身金币将超出角色等级上限 (NotEnoughGold)！' }
      } else if (action === 0x0a) {
        this.noticeValue = { level: 'error', text: '交易失败：对方的随身金币将超出角色等级上限 (PartnerNotEnoughGold)！' }
      } else if (action === 0x0e) {
        this.lockoutStartedAtMs = nowMs
        this.recordPartnerDiffAlertIfChanged(nowMs, true)
      } else if (action === 0x0f) {
        this.lockoutStartedAtMs = null
      } else if (action === 0x0d) {
        // 0x0D TradeCompleted: record receipt from the cached active trade snapshot
        if (this.lastActiveTradeSnapshot) {
          const snap = this.lastActiveTradeSnapshot
          this.tradeReceiptsValue.unshift({
            id: this.nextReceiptId++,
            completedAtIso: new Date().toISOString(),
            roomName: this.session.getSnapshot().activeGameName ?? this.lastActiveGameNameValue ?? 'TradeRoom',
            partnerName: snap.partnerName,
            givenItems: snap.selfItems.map((it) => ({
              id: it.id,
              nameZh: it.nameZh || it.name,
              quality: it.quality,
              statsSummary: it.stats.slice(0, 6).map((s) => s.text),
            })),
            receivedItems: snap.partnerItems.map((it) => ({
              id: it.id,
              nameZh: it.nameZh || it.name,
              quality: it.quality,
              statsSummary: it.stats.slice(0, 6).map((s) => s.text),
            })),
            givenGold: snap.selfGold,
            receivedGold: snap.partnerGold,
          })
          this.lastActiveTradeSnapshot = null
        }
        this.tradeDiffAlertValue = null
        this.lockoutStartedAtMs = null
        this.noticeValue = {
          level: 'success',
          text: '交易已完成！收到的装备与金币已存入你的随身背包。',
        }
      }
    }

    // Track active trade offer snapshot and detect partner item removal / gold reduction
    if (world.trade.active) {
      this.recordPartnerDiffAlertIfChanged(nowMs, false)
      this.captureActiveTradeSnapshot()
    } else if (ev.type === 'Trade' && (ev.action === 0x02 || ev.action === 0x03 || ev.action === 0x0c)) {
      this.lastActiveTradeSnapshot = null
      this.tradeDiffAlertValue = null
      this.lockoutStartedAtMs = null
    }

    this.syncTradeHallIdleHint()
    this.emitChange()
  }

  private recordPartnerDiffAlertIfChanged(nowMs: number, forceLockoutNotice: boolean): void {
    const prev = this.lastActiveTradeSnapshot
    if (!prev) {
      if (forceLockoutNotice) {
        const partnerName = this.session.world.trade.partnerName || '对方'
        this.tradeDiffAlertValue = {
          id: this.nextDiffAlertId++,
          timestampMs: nowMs,
          partnerName,
          removedItems: [],
          previousGold: 0,
          currentGold: this.session.world.trade.partnerGold || 0,
          summaryText: `警告：交易栏物品发生变动，确认按钮已进入 5 秒红色防骗锁定，请重新核对词条！`,
        }
      }
      return
    }

    const currentPartnerItems = (this.hudManager.trade?.partnerItems ?? []) as readonly UiInventoryItem[]
    const currentPartnerIds = new Set(currentPartnerItems.map((it) => String(it.id)))
    const removedItems = prev.partnerItems
      .filter((it) => !currentPartnerIds.has(String(it.id)))
      .map((it) => ({
        id: String(it.id),
        nameZh: it.nameZh || it.name,
        nameEn: it.name,
        quality: it.quality,
      }))

    const currentGold = this.session.world.trade.partnerGold || 0
    const goldLowered = currentGold < prev.partnerGold

    if (removedItems.length > 0 || goldLowered || forceLockoutNotice) {
      const partnerName = this.session.world.trade.partnerName || prev.partnerName || '对方'
      const parts: string[] = []
      if (removedItems.length > 0) {
        parts.push(`移除了物品 [${removedItems.map((r) => r.nameZh).join('、')}]`)
      }
      if (goldLowered) {
        parts.push(
          `将交易金币从 ${prev.partnerGold.toLocaleString()} 下调为 ${currentGold.toLocaleString()}`,
        )
      }
      if (parts.length === 0) {
        parts.push('调整了交易栏物品')
      }
      this.tradeDiffAlertValue = {
        id: this.nextDiffAlertId++,
        timestampMs: nowMs,
        partnerName,
        removedItems,
        previousGold: prev.partnerGold,
        currentGold,
        summaryText: `防骗警示：${partnerName} ${parts.join('，')}！请仔细核对上方报价栏后再点击确认勾号。`,
      }
    }
  }

  private captureActiveTradeSnapshot(): void {
    const trade = this.hudManager.trade
    const selfItems = [...((trade?.selfItems ?? []) as readonly UiInventoryItem[])]
    const partnerItems = [...((trade?.partnerItems ?? []) as readonly UiInventoryItem[])]
    this.lastActiveTradeSnapshot = {
      partnerName: this.session.world.trade.partnerName || trade?.partnerName || '交易伙伴',
      selfItems,
      partnerItems,
      selfGold: this.session.world.trade.selfGold || 0,
      partnerGold: this.session.world.trade.partnerGold || 0,
    }
  }

  private clearMovementStatus(): void {
    if (!this.movementStatusValue.active && this.movementStatusValue.kind === 'none') return
    this.movementStatusValue = IDLE_MOVEMENT_STATUS
    this.pendingStashInteractSent = false
    this.pendingPartnerInteractSent = false
    this.syncTradeHallIdleHint()
  }

  private syncTradeHallIdleHint(): void {
    if (this.movementStatusValue.active) {
      this.hudManager.tradeHallIdleHint = {
        title: this.movementStatusValue.title,
        subtitle: this.movementStatusValue.detail,
      }
      return
    }
    if (this.session.phase === 'ingame') {
      this.hudManager.tradeHallIdleHint = {
        title: '左半屏工作区待命',
        subtitle: '点击上方「前往并打开 A1 储藏箱」取物，或在左侧玩家列表点击「发起交易」',
      }
      return
    }
    this.hudManager.tradeHallIdleHint = {
      title: '暗黑破坏神 II · 1.13c 交易大厅',
      subtitle: '请先登录并进入交易房间，进入后将自动移动到 A1 储藏箱旁',
    }
  }

  getSnapshot(nowMs = performance.now()): TradeHallSnapshot {
    const lobby = this.session.getSnapshot()
    const world = this.session.world
    const selfLevel = Math.max(1, world.self.level || 1)
    const lockoutRemainingMs =
      world.trade.acceptDisabled && this.lockoutStartedAtMs !== null
        ? Math.max(0, TRADE_ACCEPT_LOCKOUT_MS - Math.round(nowMs - this.lockoutStartedAtMs))
        : world.trade.acceptDisabled
          ? TRADE_ACCEPT_LOCKOUT_MS
          : 0

    return {
      lobby,
      inGame: lobby.phase === 'ingame',
      areaId: world.areaId,
      stashOpen: Boolean(world.npcInteraction.stashOpen || this.hudManager.leftPanel === 'stash'),
      cubeOpen: Boolean(world.npcInteraction.cubeOpen || this.hudManager.leftPanel === 'cube'),
      tradeActive: world.trade.active,
      pendingModal: world.trade.pendingModal ?? null,
      partnerName: world.trade.partnerName || '',
      selfGold: world.self.gold || 0,
      stashGold: world.self.stashGold || 0,
      inventoryGoldLimit: getInventoryGoldLimit(selfLevel),
      stashGoldLimit: getStashGoldLimit(selfLevel),
      selfTradeGold: world.trade.selfGold || 0,
      partnerTradeGold: world.trade.partnerGold || 0,
      selfAccepted: world.trade.selfAccepted,
      partnerAccepted: world.trade.partnerAccepted,
      acceptDisabled: world.trade.acceptDisabled,
      lockoutRemainingMs,
      cursorItem: this.getCursorItem(),
      selfTradeItems: [...((this.hudManager.trade?.selfItems ?? []) as readonly UiInventoryItem[])],
      partnerTradeItems: [...((this.hudManager.trade?.partnerItems ?? []) as readonly UiInventoryItem[])],
      movementStatus: this.movementStatusValue,
      roomPlayers: this.getRoomPlayers(),
      capacityEvaluation: this.evaluateTradeCapacity(),
      tradeDiffAlert: this.tradeDiffAlertValue,
      tradeReceipts: [...this.tradeReceiptsValue],
      notice: this.noticeValue,
      lastActiveGameName: this.lastActiveGameNameValue,
      lastActiveGamePassword: this.lastActiveGamePasswordValue,
    }
  }

  private emitChange(): void {
    const snap = this.getSnapshot()
    for (const listener of this.listeners) {
      listener(snap)
    }
  }
}
