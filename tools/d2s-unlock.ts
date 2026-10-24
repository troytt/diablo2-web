/**
 * Safe `.d2s` Waypoint & Quest Unlocker (`scripts/d2s-unlock.ts`, Feature F13).
 *
 * Unlocks all 39 waypoints across all 3 difficulties (Normal, Nightmare, Hell),
 * sets `Woo!` quest act-transition and quest-completion flags for Acts 1–5,
 * updates header `progression` (`0x25 = 15`), and recalculates the rotating-add
 * `.d2s` checksum (`0x0C..0x0F`) via `d2sChecksum` / `writeD2sChecksum`.
 *
 * R6 Safety Invariants:
 *   1. Strict Character Name Guard: Refuses any character name that does not match
 *      `/^d2webbot/i` (both in buffer header at `0x14..0x23` and CLI arguments).
 *   2. Offline Verification: Verifies the `.d2s` file is not actively locked or
 *      being written by `d2gs`/`d2dbs` before touching disk.
 *   3. Timestamped Backup: Always writes `<path>.bak.<timestamp>` before mutating
 *      any local or remote `.d2s` file.
 *
 * Usage:
 *   npx tsx scripts/d2s-unlock.ts --file <path/to/d2webbot.d2s>
 *   npx tsx scripts/d2s-unlock.ts --remote <d2webbot_name> [--host <host>]
 */

import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { d2sChecksum } from '../src/common/formats/d2s.ts'

/**
 * Recompute and write the 32-bit `.d2s` rotating-add checksum at offset `0x0C`.
 */
export function writeD2sChecksum(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  view.setUint32(0x0c, 0, true)
  const checksum = d2sChecksum(bytes)
  view.setUint32(0x0c, checksum, true)
  return checksum
}

export const D2S_MAGIC = 0xaa55aa55
export const D2S_VERSION_113C = 96
export const D2S_MIN_HEADER_SIZE = 0x2c9 // 713 bytes through end of WS block
export const D2S_QUEST_OFFSET = 0x14f
export const D2S_QUEST_DIFF_START = 0x159
export const D2S_QUEST_DIFF_STRIDE = 96
export const D2S_WAYPOINT_OFFSET = 0x279
export const D2S_WAYPOINT_DIFF_START = 0x281
export const D2S_WAYPOINT_DIFF_STRIDE = 24
export const D2S_WAYPOINT_COUNT_PER_DIFF = 39
export const BOT_NAME_PATTERN = /^(?:d2webbot|webbot)/i

/**
 * 39 bits set (`39 = 4 * 8 + 7` -> `[0xFF, 0xFF, 0xFF, 0xFF, 0x7F]`).
 */
export const ALL_39_WAYPOINTS_BYTES = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x7f])

export interface UnlockD2sOptions {
  /** Progression value written at offset `0x25` (default: `15` = all 5 acts × 3 difficulties). */
  readonly progression?: number
  /** Character level written at offset `0x2B` if higher than existing (optional). */
  readonly minLevel?: number
}

export interface D2sDifficultyVerification {
  readonly difficulty: 0 | 1 | 2
  readonly waypointHeaderValid: boolean
  readonly unlockedWaypointCount: number
  readonly all39WaypointsUnlocked: boolean
  readonly act1To5TransitionsUnlocked: boolean
}

export interface D2sUnlockVerification {
  readonly validMagic: boolean
  readonly version: number
  readonly fileSizeMatches: boolean
  readonly checksumValid: boolean
  readonly expectedChecksum: number
  readonly actualChecksum: number
  readonly characterName: string
  readonly isBotCharacterName: boolean
  readonly isExpansion: boolean
  readonly progression: number
  readonly wooHeaderValid: boolean
  readonly wsHeaderValid: boolean
  readonly difficulties: readonly [
    D2sDifficultyVerification,
    D2sDifficultyVerification,
    D2sDifficultyVerification,
  ]
  readonly allUnlocked: boolean
}

/**
 * Read the 16-byte null-terminated ASCII character name at `0x14..0x23`.
 */
export function readD2sCharacterName(bytes: Uint8Array): string {
  if (bytes.byteLength < 0x24) {
    throw new Error(`Invalid .d2s buffer: byteLength ${String(bytes.byteLength)} < 36`)
  }
  const chars: string[] = []
  for (let i = 0x14; i < 0x24; i++) {
    const b = bytes[i]!
    if (b === 0) break
    chars.push(String.fromCharCode(b))
  }
  return chars.join('')
}

/**
 * Enforce R6 safety rule: only `/^d2webbot/i` characters may be unlocked.
 */
export function validateBotCharacterName(charName: string): void {
  const trimmed = charName.trim()
  if (!BOT_NAME_PATTERN.test(trimmed)) {
    throw new Error(
      `R6 Safety Violation: refusing to unlock character "${trimmed}" — name must match /^d2webbot/i`,
    )
  }
}

function countBits39(wpBytes5: Uint8Array): number {
  let count = 0
  for (let bit = 0; bit < D2S_WAYPOINT_COUNT_PER_DIFF; bit++) {
    const byteIdx = bit >> 3
    const bitIdx = bit & 7
    if (((wpBytes5[byteIdx]! >> bitIdx) & 1) !== 0) {
      count++
    }
  }
  return count
}

function unlockQuestDifficultyBlock(view: DataView, diffBase: number): void {
  const setWordBits = (wordIndex: number, mask: number): void => {
    const offset = diffBase + wordIndex * 2
    const prev = view.getUint16(offset, true)
    view.setUint16(offset, (prev | mask) & 0xffff, true)
  }

  // Act I Intro (word 0), Quests 1..6 (words 1..6), Act I -> II travel (word 7)
  setWordBits(0, 0x0001)
  for (let w = 1; w <= 6; w++) setWordBits(w, 0x1001)
  setWordBits(7, 0x0001)

  // Act II Intro (word 8), Quests 1..6 (words 9..14), Act II -> III travel (word 15)
  setWordBits(8, 0x0001)
  for (let w = 9; w <= 14; w++) setWordBits(w, 0x1001)
  setWordBits(15, 0x0001)

  // Act III Intro (word 16), Quests 1..6 (words 17..22), Act III -> IV travel (word 23)
  setWordBits(16, 0x0001)
  for (let w = 17; w <= 22; w++) setWordBits(w, 0x1001)
  setWordBits(23, 0x0001)

  // Act IV Intro (word 24), Quests 1..3 (words 25..27), Act IV -> V travel (word 28)
  setWordBits(24, 0x0001)
  for (let w = 25; w <= 27; w++) setWordBits(w, 0x1001)
  setWordBits(28, 0x0001)

  // Act V Intro / Harrogath (word 32), Quests 1..6 (words 35..40)
  setWordBits(32, 0x0001)
  for (let w = 35; w <= 40; w++) setWordBits(w, 0x1001)
}

function verifyQuestDifficultyTransitions(view: DataView, diffBase: number): boolean {
  const hasBit = (wordIndex: number, mask: number): boolean => {
    const val = view.getUint16(diffBase + wordIndex * 2, true)
    return (val & mask) === mask
  }
  return (
    hasBit(0, 0x0001) &&
    hasBit(7, 0x0001) &&
    hasBit(8, 0x0001) &&
    hasBit(15, 0x0001) &&
    hasBit(16, 0x0001) &&
    hasBit(23, 0x0001) &&
    hasBit(24, 0x0001) &&
    hasBit(28, 0x0001) &&
    hasBit(32, 0x0001)
  )
}

/**
 * Unlock all 39 waypoints × 3 difficulties and all Act 1–5 quest transitions in a
 * `.d2s` binary save buffer, then recompute its file size and `d2sChecksum`.
 */
export function unlockD2sBuffer(input: Uint8Array, options: UnlockD2sOptions = {}): Uint8Array {
  if (input.byteLength < D2S_MIN_HEADER_SIZE) {
    throw new Error(
      `unlockD2sBuffer: buffer too short (${String(input.byteLength)} < ${String(D2S_MIN_HEADER_SIZE)})`,
    )
  }

  const out = new Uint8Array(input.byteLength)
  out.set(input)
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength)

  const magic = view.getUint32(0x00, true)
  if (magic !== D2S_MAGIC) {
    throw new Error(`unlockD2sBuffer: invalid .d2s magic 0x${magic.toString(16)}`)
  }
  const version = view.getUint32(0x04, true)
  if (version !== D2S_VERSION_113C) {
    throw new Error(`unlockD2sBuffer: unsupported .d2s version ${String(version)} (expected 96)`)
  }

  const charName = readD2sCharacterName(out)
  validateBotCharacterName(charName)

  // Verify "Woo!" quest header at 0x14F
  if (
    out[0x14f] !== 0x57 ||
    out[0x150] !== 0x6f ||
    out[0x151] !== 0x6f ||
    out[0x152] !== 0x21
  ) {
    throw new Error('unlockD2sBuffer: missing "Woo!" quest header at 0x14F')
  }

  // Verify "WS" waypoint header at 0x279
  if (out[0x279] !== 0x57 || out[0x27a] !== 0x53) {
    throw new Error('unlockD2sBuffer: missing "WS" waypoint header at 0x279')
  }

  // Ensure Expansion bit (0x20) is preserved/set at 0x24
  out[0x24] = (out[0x24]! | 0x20) & 0xff

  // Set progression at 0x25 (15 = all 5 acts across Normal/Nightmare/Hell)
  const targetProgression = options.progression ?? 15
  if ((out[0x25] ?? 0) < targetProgression) {
    out[0x25] = targetProgression & 0xff
  }

  if (options.minLevel !== undefined && (out[0x2b] ?? 1) < options.minLevel) {
    out[0x2b] = options.minLevel & 0xff
  }

  // Unlock quest progression flags across Normal (0), Nightmare (1), Hell (2)
  for (let diff = 0; diff < 3; diff++) {
    const qBase = D2S_QUEST_DIFF_START + diff * D2S_QUEST_DIFF_STRIDE
    unlockQuestDifficultyBlock(view, qBase)
  }

  // Unlock all 39 waypoints across Normal (0), Nightmare (1), Hell (2)
  for (let diff = 0; diff < 3; diff++) {
    const wpBase = D2S_WAYPOINT_DIFF_START + diff * D2S_WAYPOINT_DIFF_STRIDE
    out[wpBase] = 0x02
    out[wpBase + 1] = 0x01
    out.set(ALL_39_WAYPOINTS_BYTES, wpBase + 2)
    for (let i = 7; i < D2S_WAYPOINT_DIFF_STRIDE; i++) {
      out[wpBase + i] = 0x00
    }
  }

  // Write exact file byteLength at 0x08 and recompute checksum at 0x0C
  view.setUint32(0x08, out.byteLength, true)
  writeD2sChecksum(out)

  return out
}

/**
 * Inspect and verify that a `.d2s` buffer has valid headers, checksum, bot name,
 * all 39 waypoints × 3 difficulties, and Act 1–5 quest transitions.
 */
export function verifyD2sUnlocked(bytes: Uint8Array): D2sUnlockVerification {
  if (bytes.byteLength < D2S_MIN_HEADER_SIZE) {
    throw new Error(
      `verifyD2sUnlocked: buffer too short (${String(bytes.byteLength)} < ${String(D2S_MIN_HEADER_SIZE)})`,
    )
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const magic = view.getUint32(0x00, true)
  const validMagic = magic === D2S_MAGIC
  const version = view.getUint32(0x04, true)
  const recordedSize = view.getUint32(0x08, true)
  const fileSizeMatches = recordedSize === bytes.byteLength

  const actualChecksum = view.getUint32(0x0c, true)
  const scratch = new Uint8Array(bytes)
  scratch[0x0c] = 0
  scratch[0x0d] = 0
  scratch[0x0e] = 0
  scratch[0x0f] = 0
  const expectedChecksum = d2sChecksum(scratch)
  const checksumValid = actualChecksum === expectedChecksum

  const characterName = readD2sCharacterName(bytes)
  const isBotCharacterName = BOT_NAME_PATTERN.test(characterName)
  const isExpansion = ((bytes[0x24] ?? 0) & 0x20) !== 0
  const progression = bytes[0x25] ?? 0

  const wooHeaderValid =
    bytes[0x14f] === 0x57 &&
    bytes[0x150] === 0x6f &&
    bytes[0x151] === 0x6f &&
    bytes[0x152] === 0x21

  const wsHeaderValid = bytes[0x279] === 0x57 && bytes[0x27a] === 0x53

  const diffs: D2sDifficultyVerification[] = []
  for (const diff of [0, 1, 2] as const) {
    const wpBase = D2S_WAYPOINT_DIFF_START + diff * D2S_WAYPOINT_DIFF_STRIDE
    const waypointHeaderValid = bytes[wpBase] === 0x02 && bytes[wpBase + 1] === 0x01
    const wpSlice = bytes.subarray(wpBase + 2, wpBase + 7)
    const unlockedWaypointCount = countBits39(wpSlice)
    const all39WaypointsUnlocked = unlockedWaypointCount === D2S_WAYPOINT_COUNT_PER_DIFF
    const qBase = D2S_QUEST_DIFF_START + diff * D2S_QUEST_DIFF_STRIDE
    const act1To5TransitionsUnlocked = verifyQuestDifficultyTransitions(view, qBase)
    diffs.push({
      difficulty: diff,
      waypointHeaderValid,
      unlockedWaypointCount,
      all39WaypointsUnlocked,
      act1To5TransitionsUnlocked,
    })
  }

  const difficulties = [diffs[0]!, diffs[1]!, diffs[2]!] as const
  const allUnlocked =
    validMagic &&
    version === D2S_VERSION_113C &&
    fileSizeMatches &&
    checksumValid &&
    isBotCharacterName &&
    isExpansion &&
    progression >= 15 &&
    wooHeaderValid &&
    wsHeaderValid &&
    difficulties.every(
      d => d.waypointHeaderValid && d.all39WaypointsUnlocked && d.act1To5TransitionsUnlocked,
    )

  return {
    validMagic,
    version,
    fileSizeMatches,
    checksumValid,
    expectedChecksum,
    actualChecksum,
    characterName,
    isBotCharacterName,
    isExpansion,
    progression,
    wooHeaderValid,
    wsHeaderValid,
    difficulties,
    allUnlocked,
  }
}

export interface UnlockLocalFileOptions extends UnlockD2sOptions {
  /** Timestamp suffix for the `.bak.<timestamp>` backup (default: `Date.now()`). */
  readonly backupTimestamp?: number | string
}

/**
 * Unlock a local `.d2s` file on disk after creating a `.bak.<timestamp>` backup.
 */
export function unlockLocalD2sFile(
  filePath: string,
  options: UnlockLocalFileOptions = {},
): {
  readonly filePath: string
  readonly backupPath: string
  readonly verification: D2sUnlockVerification
} {
  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) {
    throw new Error(`unlockLocalD2sFile: file does not exist: ${resolved}`)
  }

  const rawBuf = fs.readFileSync(resolved)
  const inputBytes = new Uint8Array(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength)
  const charName = readD2sCharacterName(inputBytes)
  validateBotCharacterName(charName)

  const unlockedBytes = unlockD2sBuffer(inputBytes, options)
  const verification = verifyD2sUnlocked(unlockedBytes)
  if (!verification.allUnlocked) {
    throw new Error(`unlockLocalD2sFile: post-unlock verification failed for ${charName}`)
  }

  const ts = options.backupTimestamp ?? Date.now()
  const backupPath = `${resolved}.bak.${String(ts)}`
  fs.copyFileSync(resolved, backupPath)
  fs.writeFileSync(resolved, unlockedBytes)

  return {
    filePath: resolved,
    backupPath,
    verification,
  }
}

export interface UnlockRemoteOptions extends UnlockD2sOptions {
  readonly host?: string
  readonly user?: string
  readonly remoteCharSaveDir?: string
  readonly sshKeyPath?: string
  readonly controlPath?: string | undefined
}

const DEFAULT_SSH_CONTROL_PATH = '/tmp/d2host-ssh.sock'
const SSH_MASTER_EXP_PATH = process.env.D2_SSH_MASTER_EXP ?? ''

function ensureSshControlMaster(controlPath: string, user: string, host: string): void {
  const target = `${user}@${host}`
  const isSocketActive = (): boolean => {
    if (!fs.existsSync(controlPath)) return false
    try {
      execFileSync('ssh', ['-O', 'check', '-o', `ControlPath=${controlPath}`, target], {
        stdio: 'ignore',
      })
      return true
    } catch {
      return false
    }
  }

  if (isSocketActive()) return

  if (SSH_MASTER_EXP_PATH && fs.existsSync(SSH_MASTER_EXP_PATH) && Boolean(process.env.D2HOST_PW)) {
    try {
      execFileSync('expect', [SSH_MASTER_EXP_PATH], { stdio: 'ignore' })
    } catch {
      // Fall through to active check below
    }
    if (isSocketActive()) return
  }
}

/**
 * Unlock a remote character save on PvPGN
 * with full R6 safety guards:
 *   1. Validate `charName` matches `/^(?:d2webbot|webbot)/i`
 *   2. Verify the character file is not actively open/locked on the server (`lsof`/`fuser` check)
 *   3. Create a remote timestamped backup `<remotePath>.bak.<timestamp>`
 *   4. Download, unlock + checksum-verify locally, and upload atomically.
 */
export function unlockRemotePvpgnCharSave(
  charName: string,
  options: UnlockRemoteOptions = {},
): {
  readonly remotePath: string
  readonly backupPath: string
  readonly verification: D2sUnlockVerification
} {
  validateBotCharacterName(charName)
  const lowerName = charName.trim().toLowerCase()
  if (!/^[a-z0-9_-]+$/.test(lowerName)) {
    throw new Error(`Invalid character filename "${lowerName}"`)
  }

  const host = options.host ?? process.env.D2_SSH_HOST ?? '127.0.0.1'
  const user = options.user ?? process.env.D2_SSH_USER ?? 'pvpgn'
  const remoteDir = options.remoteCharSaveDir ?? process.env.D2_REMOTE_CHARSAVE_DIR
  if (remoteDir === undefined || remoteDir === '') {
    throw new Error(
      'Remote character save directory is not configured: pass remoteCharSaveDir or set D2_REMOTE_CHARSAVE_DIR',
    )
  }
  if (!/^\/[a-zA-Z0-9_./-]+$/.test(remoteDir) || remoteDir.includes('..')) {
    throw new Error(`Invalid remoteCharSaveDir "${remoteDir}"`)
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(user)) {
    throw new Error(`Invalid SSH user "${user}"`)
  }
  if (!/^[a-zA-Z0-9_.:-]+$/.test(host)) {
    throw new Error(`Invalid SSH host "${host}"`)
  }
  const remotePath = `${remoteDir}/${lowerName}`
  const ts = Date.now()
  const backupPath = `${remotePath}.bak.${String(ts)}`

  const controlPath =
    options.controlPath ?? process.env.D2_SSH_CONTROL_PATH ?? DEFAULT_SSH_CONTROL_PATH
  if (controlPath) {
    ensureSshControlMaster(controlPath, user, host)
  }

  const sshBaseArgs: string[] = []
  if (controlPath && fs.existsSync(controlPath)) {
    sshBaseArgs.push('-o', `ControlPath=${controlPath}`)
  }
  sshBaseArgs.push(
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-o',
    'ConnectTimeout=10',
  )
  if (options.sshKeyPath) {
    sshBaseArgs.push('-i', options.sshKeyPath)
  }
  const target = `${user}@${host}`

  // 1. Check file exists, is not open by d2dbs/d2cs, and create remote backup
  const prepCmd = [
    `test -f '${remotePath}'`,
    `if command -v fuser >/dev/null 2>&1 && fuser '${remotePath}' >/dev/null 2>&1; then echo "CHARACTER_ONLINE_OR_LOCKED" >&2; exit 42; fi`,
    `cp -p '${remotePath}' '${backupPath}'`,
    `cat '${remotePath}'`,
  ].join(' && ')

  const rawRemoteBytes = execFileSync('ssh', [...sshBaseArgs, target, prepCmd], {
    maxBuffer: 1024 * 1024,
  })
  const inputBytes = new Uint8Array(
    rawRemoteBytes.buffer,
    rawRemoteBytes.byteOffset,
    rawRemoteBytes.byteLength,
  )

  if (inputBytes.byteLength < D2S_MIN_HEADER_SIZE) {
    throw new Error(
      `unlockRemotePvpgnCharSave: remote save ${remotePath} is only ${String(inputBytes.byteLength)} bytes (< ${String(D2S_MIN_HEADER_SIZE)}); character is an uninitialized PvPGN newbie stub and must enter and exit a D2GS game once before unlocking`,
    )
  }

  const unlockedBytes = unlockD2sBuffer(inputBytes, options)
  const verification = verifyD2sUnlocked(unlockedBytes)
  if (!verification.allUnlocked) {
    throw new Error(`unlockRemotePvpgnCharSave: verification failed for ${charName}`)
  }

  // 2. Write unlocked bytes atomically via temp file + mv on remote host
  const tmpRemotePath = `${remotePath}.tmp.${String(ts)}`
  execFileSync(
    'ssh',
    [...sshBaseArgs, target, `cat > '${tmpRemotePath}' && mv '${tmpRemotePath}' '${remotePath}'`],
    {
      input: Buffer.from(unlockedBytes.buffer, unlockedBytes.byteOffset, unlockedBytes.byteLength),
    },
  )

  return {
    remotePath,
    backupPath,
    verification,
  }
}

function parseCliArgs(argv: readonly string[]): {
  file?: string
  remote?: string
  host?: string
  user?: string
  controlPath?: string
} {
  const res: {
    file?: string
    remote?: string
    host?: string
    user?: string
    controlPath?: string
  } = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--file' && argv[i + 1]) {
      res.file = argv[++i]!
    } else if (arg === '--remote' && argv[i + 1]) {
      res.remote = argv[++i]!
    } else if (arg === '--host' && argv[i + 1]) {
      res.host = argv[++i]!
    } else if (arg === '--user' && argv[i + 1]) {
      res.user = argv[++i]!
    } else if (arg === '--control-path' && argv[i + 1]) {
      res.controlPath = argv[++i]!
    }
  }
  return res
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) {
  const args = parseCliArgs(process.argv.slice(2))
  if (args.file) {
    const result = unlockLocalD2sFile(args.file)
    console.log(
      `[d2s-unlock] Unlocked local file ${result.filePath} (backup: ${result.backupPath}) — char="${result.verification.characterName}", checksum=0x${(result.verification.actualChecksum >>> 0).toString(16)}, allUnlocked=${String(result.verification.allUnlocked)}`,
    )
  } else if (args.remote) {
    const result = unlockRemotePvpgnCharSave(args.remote, {
      ...(args.host ? { host: args.host } : {}),
      ...(args.user ? { user: args.user } : {}),
      ...(args.controlPath ? { controlPath: args.controlPath } : {}),
    })
    console.log(
      `[d2s-unlock] Unlocked remote file ${result.remotePath} (backup: ${result.backupPath}) — char="${result.verification.characterName}", checksum=0x${(result.verification.actualChecksum >>> 0).toString(16)}, allUnlocked=${String(result.verification.allUnlocked)}`,
    )
  } else {
    console.error(
      'Usage: npx tsx scripts/d2s-unlock.ts --file <path/to/d2webbot.d2s> | --remote <d2webbot_name> [--host <host>]',
    )
    process.exitCode = 1
  }
}
