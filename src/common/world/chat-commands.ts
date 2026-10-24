/**
 * Processes chat and console commands for ActScene (e.g. "/players <1-8>").
 *
 * Ground truth rules (1.13c parity):
 * - Accepts "/players N" or "players N" where N is an integer between 1 and 8.
 * - Calling without a number queries the current setting.
 * - Out-of-range numbers display an error notification.
 */

export interface ChatCommandEngine {
  setPlayers: (players: number, partyPlayers?: number) => void
  gamePlayers: number
}

export interface SceneChatCommandResult {
  readonly handled: boolean
  readonly message: string | null
}

export type ChatCommandOutcome = SceneChatCommandResult

/**
 * Pure simulation helper for scene chat commands (`/players <1-8>`).
 */
export function executeSceneChatCommand(
  rawCommand: string,
  engine: ChatCommandEngine,
): SceneChatCommandResult {
  const trimmed = rawCommand.trim()
  const match = trimmed.match(/^\/?players(?:\s+(\d+))?$/i)
  if (match) {
    if (match[1] !== undefined) {
      const n = parseInt(match[1], 10)
      if (n >= 1 && n <= 8) {
        engine.setPlayers(n)
        return {
          handled: true,
          message: `Players set to ${engine.gamePlayers}`,
        }
      }
      return {
        handled: false,
        message: `Invalid players count: ${n}. Range is 1-8.`,
      }
    }
    return {
      handled: true,
      message: `Players currently set to ${engine.gamePlayers}`,
    }
  }
  return { handled: false, message: null }
}

/**
 * Processes chat and console commands for ActScene (e.g. "/players <1-8>").
 *
 * Ground truth rules (1.13c parity):
 * - Accepts "/players N" or "players N" where N is an integer between 1 and 8.
 * - Calling without a number queries the current setting.
 * - Out-of-range numbers display an error notification.
 *
 * @param rawCommand - The input command string.
 * @param engine - GameEngine instance.
 * @param statusEl - Optional status notification sink.
 * @returns True if command was recognized and handled; false otherwise.
 */
export function handleActSceneChatCommand(
  rawCommand: string,
  engine: { setPlayers: (players: number, partyPlayers?: number) => void; gamePlayers: number },
  statusEl?: { textContent: string | null } | null,
): boolean {
  const res = executeSceneChatCommand(rawCommand, engine)
  if (res.message !== null && statusEl) {
    statusEl.textContent = res.message
  }
  return res.handled
}
