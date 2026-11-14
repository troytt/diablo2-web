/**
 * Diablo II: Lord of Destruction v1.13c CheckRevision constants (`SID_AUTH_CHECK` `0x51`).
 *
 * Verified against PvPGN `versioncheck.json` for Diablo II v1.13c:
 * - `archTag`: `"IX86"`
 * - `clientTag`: `"D2XP"`
 * - `versionByte`: `0x0d`
 * - `exeVersion`: `0x01000d00` (`1.0.13.0`)
 * - `exeHash`: `0x7686beca`
 * - `exeInfo`: `"Game.exe 03/09/10 04:10:51 61440"`
 */

export interface VersionCheckResult {
  readonly versionByte: number
  readonly exeVersion: number
  readonly exeHash: number
  readonly exeInfo: string
}

export const D2XP_113C_VERSION_CHECK: VersionCheckResult = {
  versionByte: 0x0d,
  exeVersion: 0x01000d00,
  exeHash: 0x7686beca,
  exeInfo: 'Game.exe 03/09/10 04:10:51 61440',
} as const

export function getCheckRevision113c(
  override?: Partial<VersionCheckResult>,
): VersionCheckResult {
  if (!override) return D2XP_113C_VERSION_CHECK
  return {
    versionByte: override.versionByte ?? D2XP_113C_VERSION_CHECK.versionByte,
    exeVersion: override.exeVersion ?? D2XP_113C_VERSION_CHECK.exeVersion,
    exeHash: override.exeHash ?? D2XP_113C_VERSION_CHECK.exeHash,
    exeInfo: override.exeInfo ?? D2XP_113C_VERSION_CHECK.exeInfo,
  }
}
