/**
 * Objects.txt `OperateFn` classification used by the authoritative GameInstance.
 *
 * The 1.13c server dispatch table (D2Game.dll 0x6fd27bb8) has one function per OperateFn.
 * The web server groups them into the handful of observable behaviours it implements:
 * shrine, door, portal, stash, well, trap, destructible, container and a generic
 * mode-only operate. Classification is driven by the numeric `OperateFn` column (and
 * the numeric `isDoor` flag), never by English name substrings.
 */
import { CANONICAL_113C_OBJECTS } from './objects-meta.ts'
import { getObjectsTxtRecord113c } from './objects-txt-113c.ts'

export type ObjectOperateKind113c =
  | 'shrine'
  | 'door'
  | 'portal'
  | 'stash'
  | 'well'
  | 'trap'
  | 'destructible'
  | 'container'
  | 'mode'

/**
 * 1.13c `gpObjectOperateFnTable` behaviour groups, keyed by the numeric
 * `Objects.txt` `OperateFn`. Only rows whose function has a distinct observable
 * behaviour are listed; everything else falls back to `'mode'`.
 */
const OPERATE_FN_KIND_113C: Readonly<Record<number, ObjectOperateKind113c>> = {
  1: 'container', // Casket / Sarcophagus
  2: 'shrine', // Shrine
  3: 'container', // Urn / Basket
  4: 'container', // Chest / Locked Chest
  5: 'destructible', // Barrel
  6: 'container', // Tower Tome / Wirt's body
  7: 'destructible', // Exploding Barrel
  8: 'door', // Door
  10: 'destructible', // Gibbet
  14: 'container', // Crate / Corpse / Hollow Log
  15: 'portal', // Portal
  16: 'door', // TrappDoor
  18: 'door', // Door
  19: 'container', // Armor Stand
  20: 'container', // Weapon Rack
  22: 'well', // Well
  23: 'portal', // Waypoint (also flagged `isWaypoint`)
  26: 'container', // Bookshelf
  27: 'portal', // Teleport Pad
  29: 'door', // Door
  30: 'trap', // Trap / Exploding Chest
  31: 'container', // Gidbinn / Armor Stand
  32: 'stash', // Bank
  33: 'container', // Wirt's Body
  34: 'portal', // Portal
  36: 'stash', // Guild Vault
  37: 'container', // Trophy Case
  39: 'container', // Chest
  40: 'container', // Chest
  41: 'container', // Chest
  42: 'container', // Tome
  43: 'portal', // Duriel's Lair / Guild Portal
  44: 'portal', // Sewer Stairs
  46: 'portal', // Portal / Siege Control
  47: 'portal', // Stair
  48: 'container', // Trapped Soul
  51: 'stash', // Stash
  57: 'container', // Chest
  58: 'container', // Sparkling Chest
  59: 'container', // Chest
  61: 'door', // Gate
  66: 'portal', // To The Worldstone Keep
  68: 'container', // Evil Urn
  70: 'portal', // Worldstone Chamber / Throne
  71: 'portal', // Glacial Caves
  73: 'portal', // Harrogath
}

/** Classify one Objects.txt row by its canonical numeric OperateFn / door / shrine metadata. */
export function classifyObjectOperate113c(classId: number): ObjectOperateKind113c {
  const record = getObjectsTxtRecord113c(classId)
  const meta = CANONICAL_113C_OBJECTS[classId]
  if (record.isDoor === 1) return 'door'
  if (meta?.isShrine || record.operateFn === 2) return 'shrine'
  return OPERATE_FN_KIND_113C[record.operateFn] ?? 'mode'
}