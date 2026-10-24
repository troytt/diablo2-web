/**
 * Quick Next Game (+1) Plugin (`plugins/next-game/index.ts`).
 *
 * Non-1.13c QoL enhancement: adds a "+1" button to the top toolbar that exits the
 * current D2GS game, increments the room name number by +1 (e.g. `baal-01` -> `baal-02`,
 * `mf1` -> `mf2`, `run` -> `run1`), and creates/joins the new room while keeping the
 * in-game viewport active — visually teleporting the player directly from their current
 * scene back to the current Act's town without returning to the lobby or door loading screen.
 */

import { Environment } from '../../src/common/world/environment.ts'
import type {
  D2OnlineFlow,
  GameCreateSpec,
  GameServerAdapter,
} from '../../src/netproto/index.ts'
import {
  type D2WebPlugin,
  type LocalizedText,
  type PluginContext,
  type PluginInstance,
  type PluginStatus,
  type ToolbarContributionHandle,
} from '../../src/client/plugin-host/api.ts'

export const NEXT_GAME_PLUGIN_ID = 'next-game'
export const NEXT_GAME_TOOLBAR_BUTTON_ID = 'd2-toolbar-plugin-next-game-step'
export const MAX_D2_GAME_NAME_LENGTH = 15

/**
 * Increments the trailing integer of a Diablo II room name by +1 while preserving
 * zero-padding and enforcing the 1.13c 15-character maximum (`MAX_D2_GAME_NAME_LENGTH`).
 *
 * Examples:
 * - `"baal-01"` -> `"baal-02"`
 * - `"baal-09"` -> `"baal-10"`
 * - `"mf1"` -> `"mf2"`
 * - `"cow"` -> `"cow1"`
 * - `"abcdefghijklm99"` (15 chars) -> `"abcdefghijkl100"` (15 chars)
 */
export function incrementGameName(rawName: string): string {
  const trimmed = rawName.trim()
  if (!trimmed) {
    return 'game1'
  }
  const match = /^(.*?)(\d+)$/.exec(trimmed)
  if (!match) {
    const suffix = '1'
    const maxPrefixLen = MAX_D2_GAME_NAME_LENGTH - suffix.length
    const prefix = trimmed.slice(0, Math.max(0, maxPrefixLen))
    return `${prefix}${suffix}`
  }

  const rawPrefix = match[1] ?? ''
  const digits = match[2] ?? '0'
  const nextValue = BigInt(digits) + 1n
  const rawNextDigits = nextValue.toString(10)
  const paddedNextDigits =
    rawNextDigits.length < digits.length
      ? rawNextDigits.padStart(digits.length, '0')
      : rawNextDigits

  if (paddedNextDigits.length >= MAX_D2_GAME_NAME_LENGTH) {
    return paddedNextDigits.slice(-MAX_D2_GAME_NAME_LENGTH)
  }

  const maxPrefixLen = MAX_D2_GAME_NAME_LENGTH - paddedNextDigits.length
  const prefix = rawPrefix.slice(0, Math.max(0, maxPrefixLen))
  return `${prefix}${paddedNextDigits}`
}

interface RuntimeFlowStateLike {
  gameName?: string
  gamePassword?: string
  gameDescription?: string
  difficulty?: 'normal' | 'nightmare' | 'hell'
  maxPlayers?: string
  charDifferenceEnabled?: boolean
  charDifference?: string
}

interface RuntimeOnlineSessionLike {
  readonly phase: string
  readonly world: {
    difficulty: 0 | 1 | 2
    readonly self: {
      name: string
      charClass: number
    }
    reset(): void
  }
  flow?: D2OnlineFlow | null
  gameAdapter?: GameServerAdapter | null
  activeGameNameValue?: string | null
  lastObjectLightBuildFrame?: number
  environmentValue?: Environment
  clientActLoaded?: boolean
  lastSyncedAreaId?: number
  readonly weather?: { onGameInit?(): void }
  readonly audioRuntime?: { gameInit?(): void }
  readonly questFx?: { resetForNewGame?(): void }
  readonly knownAreaIds?: Set<number>
  readonly predictor?: { setPosition?(x: number, y: number): void }
  readonly interpolator?: { clear?(): void }
  readonly hudModel?: {
    closeAllPanels?(): void
    syncFromWorld?(): void
  }
  readonly hudManager?: {
    closeAllPanels?(): void
  }
  readonly commandMapper?: {
    resetModifiers?(): void
  }
  stateListeners?: Set<(snap: unknown) => void>
  detachGameServerListeners?(): void
  acquireOrRefreshActiveCharLease?(gameName: string): void
  syncAudioSkillPacks?(): void
  attachGameServer?(adapter: GameServerAdapter): void
  emitState?(): void
  leaveGame?(): Promise<void>
  enterGame?(
    request:
      | { readonly mode: 'create'; readonly spec: GameCreateSpec }
      | { readonly mode: 'join'; readonly name: string; readonly password?: string | undefined },
  ): Promise<GameServerAdapter>
}

export interface NextGamePluginOptions {
  /**
   * Delay in ms after leaving the current D2GS room before joining the new room,
   * giving PvPGN `d2gs -> d2dbs` time to unlock the character (default: 120ms).
   */
  readonly settleDelayMs?: number | undefined
  /**
   * Retry delay in ms when `joinGame` encounters a transient character-lock (`0xB4` / `0x06`)
   * while `d2dbs` finishes saving the previous game (default: 220ms).
   */
  readonly retryDelayMs?: number | undefined
  /**
   * Maximum `joinGame` attempts on transient character lock (default: 5).
   */
  readonly maxJoinAttempts?: number | undefined
}

export interface NextGamePluginInstance extends PluginInstance {
  stepToNextGame(): Promise<string | null>
  isTransitioning(): boolean
  getLastTargetGameName(): string | null
}

function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isGameAlreadyExistsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /status=0x1f\b/i.test(msg) || /already exists/i.test(msg)
}

function isTransientCharLockedError(err: unknown): boolean {
  const pktId = (err as { packetId?: unknown })?.packetId
  if (pktId === 0xb4 || pktId === 0xb0 || pktId === 0x68) {
    return true
  }
  const msg = err instanceof Error ? err.message : String(err)
  return (
    /reason=0x06\b/i.test(msg) ||
    /state=logonSent\b/i.test(msg) ||
    /已经登录/.test(msg) ||
    /already in a game/i.test(msg)
  )
}

function resolveRuntimeFlowState(): RuntimeFlowStateLike | null {
  if (typeof window === 'undefined') return null
  const app = (
    window as unknown as {
      __d2Play?: { flowState?: RuntimeFlowStateLike }
      __d2PlayApp?: { flowState?: RuntimeFlowStateLike }
    }
  ).__d2Play ?? (
    window as unknown as {
      __d2PlayApp?: { flowState?: RuntimeFlowStateLike }
    }
  ).__d2PlayApp
  return app?.flowState ?? null
}

function hideInGameChatInputIfOpen(): void {
  if (typeof document === 'undefined') return
  const input = document.getElementById('d2-ingame-chat-input') as HTMLInputElement | null
  if (input && !input.hidden) {
    input.value = ''
    input.hidden = true
    input.blur?.()
  }
}

function buildNextGameSpec(
  ctx: PluginContext,
  runtimeSession: RuntimeOnlineSessionLike,
  nextName: string,
  lastSpec: GameCreateSpec | null,
): GameCreateSpec {
  const flowState = resolveRuntimeFlowState()
  const rawDifficulty = runtimeSession.world?.difficulty
  const difficulty: 0 | 1 | 2 =
    rawDifficulty === 0 || rawDifficulty === 1 || rawDifficulty === 2
      ? rawDifficulty
      : flowState?.difficulty === 'hell'
        ? 2
        : flowState?.difficulty === 'nightmare'
          ? 1
          : (lastSpec?.difficulty ?? 0)

  const password =
    typeof flowState?.gamePassword === 'string'
      ? flowState.gamePassword
      : (lastSpec?.password ?? '')
  const description =
    typeof flowState?.gameDescription === 'string'
      ? flowState.gameDescription
      : (lastSpec?.description ?? '')

  let maxPlayers = lastSpec?.maxPlayers ?? 8
  if (typeof flowState?.maxPlayers === 'string') {
    const parsedMax = Number.parseInt(flowState.maxPlayers.trim(), 10)
    if (Number.isFinite(parsedMax) && parsedMax >= 1 && parsedMax <= 8) {
      maxPlayers = parsedMax
    }
  }

  let levelDiff = lastSpec?.levelDiff ?? 0xff
  if (flowState && typeof flowState.charDifferenceEnabled === 'boolean') {
    if (flowState.charDifferenceEnabled && typeof flowState.charDifference === 'string') {
      const parsedDiff = Number.parseInt(flowState.charDifference.trim(), 10)
      levelDiff =
        Number.isFinite(parsedDiff) && parsedDiff >= 1 && parsedDiff <= 99 ? parsedDiff : 0xff
    } else {
      levelDiff = 0xff
    }
  }

  void ctx
  return {
    name: nextName,
    password,
    description,
    difficulty,
    maxPlayers,
    levelDiff,
  }
}

function formatToolbarTooltip(activeGameName: string | null): LocalizedText {
  if (activeGameName && activeGameName.trim().length > 0) {
    const nextName = incrementGameName(activeGameName)
    return {
      zh: `退出当前游戏并进入 ${nextName}（直接瞬移回当前幕城镇）`,
      en: `Exit current game and enter ${nextName} (teleport directly to current Act town)`,
    }
  }
  return {
    zh: '退出当前游戏并进入房间号+1的新房间（直接瞬移回当前幕城镇）',
    en: 'Exit current game and enter room +1 (teleport directly to current Act town)',
  }
}

export function createNextGamePlugin(options: NextGamePluginOptions = {}): D2WebPlugin {
  const settleDelayMs = options.settleDelayMs ?? 120
  const retryDelayMs = options.retryDelayMs ?? 220
  const maxJoinAttempts = Math.max(1, options.maxJoinAttempts ?? 5)

  return {
    id: NEXT_GAME_PLUGIN_ID,
    name: {
      zh: '快速下一房 (+1)',
      en: 'Quick Next Game (+1)',
    },
    description: {
      zh: '非 1.13c 增强：在顶部工具栏提供“+1”按钮。点击后底层自动退出当前游戏、将房间名尾号+1并创建进入新房间，但界面不返回大厅、不播放开门动画，视觉上直接从当前场景瞬移回当前幕的城镇出生点。',
      en: 'Non-1.13c enhancement: adds a "+1" button to the top toolbar. Clicking it exits the current game, increments the room number by +1, and enters the new game in the background while keeping the in-game view active — visually teleporting directly from the current scene back to the current Act town.',
    },
    defaultEnabled: true,
    actions: [
      {
        kind: 'button',
        id: 'step-next-game',
        label: {
          zh: '立即下一房 (+1)',
          en: 'Next Game (+1) Now',
        },
        run(ctx: PluginContext): void {
          const host = (
            typeof window !== 'undefined'
              ? (window as unknown as { __d2Play?: { plugins?: { getInstance?(id: string): NextGamePluginInstance | null } } })
                  .__d2Play?.plugins
              : undefined
          )
          const inst = host?.getInstance?.(NEXT_GAME_PLUGIN_ID)
          if (inst) {
            void inst.stepToNextGame()
          } else {
            ctx.notifyStatusChanged()
          }
        },
      },
    ],
    activate(ctx: PluginContext): NextGamePluginInstance {
      let disposed = false
      let transitioning = false
      let lastTargetGameName: string | null = null
      let lastSpec: GameCreateSpec | null = null
      let statusOverride: PluginStatus | null = null

      const getActiveGameName = (): string | null => {
        const snapName = ctx.session.getSnapshot()?.activeGameName
        if (typeof snapName === 'string' && snapName.trim().length > 0) {
          return snapName.trim()
        }
        const flowState = resolveRuntimeFlowState()
        if (typeof flowState?.gameName === 'string' && flowState.gameName.trim().length > 0) {
          return flowState.gameName.trim()
        }
        return null
      }

      const toolbarBtn: ToolbarContributionHandle = ctx.toolbar.addButton({
        id: 'step',
        label: { zh: '+1', en: '+1' },
        tooltip: formatToolbarTooltip(getActiveGameName()),
        onClick: () => {
          void stepToNextGame()
        },
      })

      const syncToolbarTooltip = (): void => {
        if (disposed) return
        toolbarBtn.update?.({
          label: { zh: '+1', en: '+1' },
          tooltip: formatToolbarTooltip(getActiveGameName()),
        })
      }

      const unsubState = ctx.session.onStateChange(() => {
        if (disposed) return
        if (!transitioning && ctx.session.phase === 'ingame') {
          statusOverride = null
        }
        syncToolbarTooltip()
        ctx.notifyStatusChanged()
      })

      const stepToNextGame = async (): Promise<string | null> => {
        if (disposed || transitioning) {
          return null
        }
        const runtimeSession = ctx.session as unknown as RuntimeOnlineSessionLike
        const currentGameName = getActiveGameName()
        if (ctx.session.phase !== 'ingame' || !currentGameName) {
          statusOverride = {
            level: 'warn',
            text: {
              zh: '需在游戏房间内使用 +1',
              en: 'Must be in a game to use +1',
            },
          }
          ctx.notifyStatusChanged()
          return null
        }

        const nextGameName = incrementGameName(currentGameName)
        const spec = buildNextGameSpec(ctx, runtimeSession, nextGameName, lastSpec)
        lastSpec = spec
        transitioning = true
        statusOverride = {
          level: 'ok',
          text: {
            zh: `正在切换至 ${nextGameName}...`,
            en: `Switching to ${nextGameName}...`,
          },
        }
        ctx.notifyStatusChanged()

        const flowState = resolveRuntimeFlowState()
        if (flowState) {
          flowState.gameName = nextGameName
        }

        hideInGameChatInputIfOpen()
        runtimeSession.commandMapper?.resetModifiers?.()
        runtimeSession.hudModel?.closeAllPanels?.()
        runtimeSession.hudManager?.closeAllPanels?.()

        const flow = runtimeSession.flow
        if (
          flow &&
          typeof flow.leaveToLobby === 'function' &&
          typeof flow.createGame === 'function' &&
          typeof flow.joinGame === 'function' &&
          typeof runtimeSession.attachGameServer === 'function'
        ) {
          try {
            // 1. Detach current D2GS listeners and close the old D2GS stream WITHOUT setting phase='lobby'
            //    or resetting ClientWorld yet, keeping the current scene rendered on screen.
            runtimeSession.detachGameServerListeners?.()
            runtimeSession.gameAdapter = null
            await flow.leaveToLobby()

            if (settleDelayMs > 0) {
              await sleepMs(settleDelayMs)
            }

            // 2. Create the +1 room on MCP (ignore 0x1F if the room already exists).
            try {
              await flow.createGame(spec)
            } catch (createErr) {
              if (!isGameAlreadyExistsError(createErr)) {
                throw createErr
              }
            }

            // 3. Join the +1 room on D2GS (retry on transient PvPGN d2dbs CHARLOCKED).
            let adapter: GameServerAdapter | null = null
            let lastJoinErr: unknown = null
            for (let attempt = 1; attempt <= maxJoinAttempts; attempt++) {
              try {
                adapter = await flow.joinGame(nextGameName, spec.password ?? '')
                break
              } catch (joinErr) {
                lastJoinErr = joinErr
                if (attempt < maxJoinAttempts && isTransientCharLockedError(joinErr)) {
                  await sleepMs(retryDelayMs)
                  continue
                }
                throw joinErr
              }
            }
            if (!adapter) {
              throw lastJoinErr ?? new Error(`Failed to join game "${nextGameName}"`)
            }

            // 4. Single-frame atomic world reset + attachGameServer(adapter):
            //    `D2gsAdapter` has already buffered S2C 0x01 GameFlags, 0x03 LoadAct, town rooms,
            //    and 0x15 ReassignPlayer (at the current Act's town spawn) during `flow.joinGame`.
            //    `attachGameServer` synchronously drains `earlyEvents`, so the very next frame
            //    renders the character standing in the current Act's town!
            const savedName = runtimeSession.world.self.name
            const savedClass = runtimeSession.world.self.charClass
            runtimeSession.world.reset()
            runtimeSession.lastObjectLightBuildFrame = 0
            runtimeSession.environmentValue = Environment.alloc()
            runtimeSession.clientActLoaded = false
            runtimeSession.weather?.onGameInit?.()
            runtimeSession.audioRuntime?.gameInit?.()
            runtimeSession.questFx?.resetForNewGame?.()
            runtimeSession.knownAreaIds?.clear?.()
            runtimeSession.lastSyncedAreaId = 0
            runtimeSession.world.self.name = savedName
            runtimeSession.world.self.charClass = savedClass
            runtimeSession.syncAudioSkillPacks?.()
            runtimeSession.predictor?.setPosition?.(0, 0)
            runtimeSession.interpolator?.clear?.()
            runtimeSession.hudModel?.syncFromWorld?.()

            runtimeSession.activeGameNameValue = nextGameName
            runtimeSession.acquireOrRefreshActiveCharLease?.(nextGameName)
            runtimeSession.attachGameServer(adapter)
            runtimeSession.emitState?.()

            lastTargetGameName = nextGameName
            statusOverride = {
              level: 'ok',
              text: {
                zh: `已进入 ${nextGameName}`,
                en: `Entered ${nextGameName}`,
              },
            }
            syncToolbarTooltip()
            ctx.notifyStatusChanged()
            return nextGameName
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            const enMsg =
              msg.replace(/[\u4e00-\u9fff，。（）“”]+/g, ' ').replace(/\s+/g, ' ').trim() ||
              'transition error'
            statusOverride = {
              level: 'error',
              text: {
                zh: `切换房间失败: ${msg}`,
                en: `Failed to switch game: ${enMsg}`,
              },
            }
            // Fallback to lobby cleanly if the old game was already left and new join failed.
            try {
              await runtimeSession.leaveGame?.()
            } catch {
              // Ignore secondary leave errors
            }
            ctx.notifyStatusChanged()
            return null
          } finally {
            transitioning = false
          }
        }

        // Fallback path for test harnesses that expose `leaveGame` + `enterGame` without `session.flow`
        if (
          typeof runtimeSession.leaveGame === 'function' &&
          typeof runtimeSession.enterGame === 'function'
        ) {
          const savedListeners = runtimeSession.stateListeners
            ? [...runtimeSession.stateListeners]
            : null
          try {
            if (runtimeSession.stateListeners) {
              runtimeSession.stateListeners.clear()
            }
            await runtimeSession.leaveGame()
          } finally {
            if (runtimeSession.stateListeners && savedListeners) {
              for (const fn of savedListeners) {
                runtimeSession.stateListeners.add(fn)
              }
            }
          }
          try {
            await runtimeSession.enterGame({
              mode: 'create',
              spec,
            })
            lastTargetGameName = nextGameName
            statusOverride = {
              level: 'ok',
              text: {
                zh: `已进入 ${nextGameName}`,
                en: `Entered ${nextGameName}`,
              },
            }
            syncToolbarTooltip()
            ctx.notifyStatusChanged()
            return nextGameName
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            const enMsg =
              msg.replace(/[\u4e00-\u9fff，。（）“”]+/g, ' ').replace(/\s+/g, ' ').trim() ||
              'transition error'
            statusOverride = {
              level: 'error',
              text: {
                zh: `切换房间失败: ${msg}`,
                en: `Failed to switch game: ${enMsg}`,
              },
            }
            ctx.notifyStatusChanged()
            return null
          } finally {
            transitioning = false
          }
        }

        transitioning = false
        return null
      }

      return {
        stepToNextGame,
        isTransitioning(): boolean {
          return transitioning
        },
        getLastTargetGameName(): string | null {
          return lastTargetGameName
        },
        getStatus(): PluginStatus {
          if (statusOverride) {
            return statusOverride
          }
          const activeName = getActiveGameName()
          if (ctx.session.phase === 'ingame' && activeName) {
            const nextName = incrementGameName(activeName)
            return {
              level: 'ok',
              text: {
                zh: `当前 ${activeName} → 下一房 ${nextName}`,
                en: `Current ${activeName} -> Next ${nextName}`,
              },
            }
          }
          return {
            level: 'ok',
            text: {
              zh: '就绪（游戏中点击 +1 瞬移下一房）',
              en: 'Ready (click +1 in-game for next room)',
            },
          }
        },
        deactivate(): void {
          disposed = true
          unsubState()
          toolbarBtn.dispose()
        },
      }
    },
  }
}

export const nextGamePlugin: D2WebPlugin = createNextGamePlugin()
