/**
 * Objects.txt `OperateFn` classification used by the authoritative GameInstance.
 *
 * The 1.13c server dispatch table (D2Game.dll 0x6fd27bb8) has one function per OperateFn.
 * The web server groups them into the handful of observable behaviours it implements:
 * shrine, door, portal, stash, well, trap, destructible, container and a generic
 * mode-only operate. Classification is driven by the numeric `OperateFn` column (and
 * the numeric `isDoor` flag), never by English name substrings.
 */
import { CANONICAL_113C_OBJECTS, CANONICAL_113C_SHRINES, getShrineMeta113c } from './objects-meta.ts'
import { OBJECTS_TXT_113C, getObjectsTxtRecord113c } from './objects-txt-113c.ts'

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
  1: 'container', // Casket / Sarcophagus (0x6fc8ef40)
  2: 'shrine', // Shrine (0x6fc8da00)
  3: 'container', // Urn / Basket (0x6fc8ecd0)
  4: 'container', // Chest / Locked Chest / Sparkly Chest 397 & SpecialChest 455 (0x6fc8f040)
  5: 'destructible', // Barrel (0x6fc8d7b0)
  7: 'destructible', // Exploding Barrel (0x6fc8d900)
  8: 'door', // Door (0x6fc8c640)
  10: 'mode', // Cain's Gibbet 26 (0x6fc88fc0 / 0x6fc8cb90: quest release only, 0 container loot)
  14: 'container', // Crate / Corpse / Hollow Log (0x6fc8ec20)
  15: 'portal', // Portal (0x6fc8c090)
  16: 'door', // TrapDoor (0x6fc8ae00)
  18: 'door', // Secret Door (0x6fc8ad60)
  19: 'container', // Armor Stand (0x6fc8b2e0)
  20: 'container', // Weapon Rack (0x6fc8b280)
  22: 'well', // Well (0x6fc8cf10)
  23: 'portal', // Waypoint (0x6fc8cb40; also flagged `isWaypoint`)
  24: 'container', // Tainted Sun Altar 149 (0x6fce76b0)
  26: 'container', // Monastery Bookshelf 179/180 (0x6fc8b340)
  27: 'portal', // Arcane Sanctuary Teleportation Pad 192, 304..306 (0x6fc8be40)
  29: 'door', // Iron Grate Door (0x6fc8ac60)
  30: 'trap', // Ground Trap (0x6fc8ab40)
  31: 'container', // The Gidbinn Decoy 252 (0x6fd09c80)
  32: 'stash', // Personal Stash / Bank 267 (0x6fc91290 — ONLY personal stash UI in 1.13c)
  33: 'container', // Wirt's Body 268 (0x6fc8d960)
  34: 'portal', // Arcane Sanctuary Portal 298 (0x6fc8d620)
  39: 'container', // Horadric Cube Chest 354 (0x6fcea050)
  40: 'container', // Horadric Scroll Chest 355 (0x6fcea290)
  41: 'container', // Staff of Kings Chest 356 (0x6fcea170)
  43: 'portal', // Duriel's Lair 100 (0x6fce8950)
  44: 'portal', // Act 3 Sewer Stairs 366 (0x6fd09ee0)
  46: 'portal', // Mephisto Hellgate 342 -> Pandemonium Fortress 103 (0x6fc8cd40)
  47: 'portal', // Stair (0x6fc8b220)
  48: 'container', // Trapped Soul 380/381 (0x6fc8ce10)
  51: 'container', // Act 3 Jungle Stash / Hollow Log 185..188 (0x6fc8eb40: 75% chest TC drop, NOT stash UI)
  57: 'container', // Khalim's Chest 1 (Heart) 405 (0x6fd0a5f0)
  58: 'container', // Khalim's Chest 3 (Eye) 407 (0x6fd0a4c0)
  59: 'container', // Khalim's Chest 2 (Brain) 406 (0x6fd0a390)
  61: 'door', // Fortress Gate (0x6fc799e0)
  66: 'portal', // Ancients' Door 547 -> Worldstone Keep L1 128 (0x6fc7e2e0)
  68: 'container', // Act 5 Evil Urn 466 (0x6fc8edb0)
  70: 'portal', // Worldstone Chamber 563 (0x6fc7d600)
  71: 'door', // Arreat Summit Door 564 (0x6fc7d690: locked while Ancients encounter active)
  73: 'portal', // Harrogath Portal 566 (0x6fcdb550)
}

/**
 * 1.13c `Objects.txt` rows with `InitFn === 3` AND `Lockable === 1` (`D2Game.dll` `OBJECTS_Init03_Chest`
 * @ `0x6FC4ECB0..0x6FC4ED27`). ONLY these 43 chest classes roll runtime locked state (`bInteractType |= 0x80`);
 * quest chests (`354..356, 405..407`), Sparkly/Special chests (`397, 455`, `InitFn = 57`), and Mephisto's
 * `Hellgate` (`342`, `InitFn = 44, OperateFn = 46`) are NEVER locked even though `Objects.txt` sets `Lockable = 1`.
 */
export const INIT_FN_3_LOCKABLE_CLASS_IDS_113C: ReadonlySet<number> = new Set<number>([
  5, 6, 87, 88, 139, 140, 141, 144, 146, 147, 148, 176, 177, 181, 183, 198, 240, 241, 242, 243,
  329, 330, 331, 332, 333, 334, 335, 336, 387, 388, 389, 390, 391, 413, 420, 430, 431, 432, 433,
  501, 502, 504, 505,
])

/**
 * 1.13c `Objects.txt` rows with `InitFn === 57` (`D2Game.dll` `0x6FC4EF50`, setting `[pObject + 0x78] = 1`):
 * `397` (`SparklyChest`) and `455` (`SpecialChest` in Act 5 Glacial Trail / Drifter Cavern / Abaddon / Pit of Acheron / Infernal Pit).
 */
export const SPARKLY_CHEST_INIT57_CLASS_IDS_113C: ReadonlySet<number> = new Set<number>([397, 455])

/**
 * 1.13c one-way doors (`D2Game.dll` `0x6FC8AE00` TrapDoor `Op 16`, `0x6FC8AD60` Secret Door `Op 18`,
 * `0x6FC8AC60` Iron Grate / Slime Door `Op 29`, covering `Objects.txt` `74, 129, 229, 230`, etc.):
 * only operate when `mode === 0` (`OBJMODE_NEUTRAL`), permanently transitioning to `OBJMODE_OPENED (2)`
 * and never toggling back to `0` (#1956).
 */
export const ONE_WAY_DOOR_OPERATE_FNS_113C: ReadonlySet<number> = new Set<number>([16, 18, 29])

/**
 * 1.13c `Objects.txt` wall/gate barriers with `IsDoor === 0`, non-zero footprint (`SizeX >= 1`),
 * `HasCollision0 === 1`, and `HasCollision2 === 0` (`129` Secret Door, `153` Tyrael's Door,
 * `449` Act 5 Main Gate, `508` Act 5 Barricade Gate, #1982). Like `IsDoor === 1` doors, these
 * block sub-tile walk/ray collision while `HasCollision[mode] === 1` and clear when opened (`mode === 2`).
 */
export const NON_ISDOOR_GATE_CLASS_IDS_113C: ReadonlySet<number> = new Set<number>([
  129, 153, 449, 508,
])

export function isDoorOrGateObject113c(classId: number): boolean {
  return getObjectsTxtRecord113c(classId).isDoor === 1 || NON_ISDOOR_GATE_CLASS_IDS_113C.has(classId)
}

export function doesDoorOrGateBlockMode113c(classId: number, mode: number): boolean {
  if (mode === 2) return false
  const meta = CANONICAL_113C_OBJECTS[classId]
  const mask = meta?.hasCollisionMask
  if (mask === undefined) return true
  const bit = Math.max(0, Math.min(7, Math.trunc(mode)))
  return ((mask >>> bit) & 1) !== 0
}

/**
 * 1.13c Act 2 & Act 3 quest chests (`D2Game.dll` `0x6FCE76B0`, `0x6FCEA050..0x6FCEA290`, `0x6FD0A390..0x6FD0A5F0`)
 * that erupt `5..9` gold piles (`0x6FC8AFA0`) plus one forced-Magic (`nQuality = 4`) Chest TC drop (`0x6FC8B570`)
 * alongside their quest item on first open.
 */
export const QUEST_CHEST_OPERATE_FNS_113C: ReadonlySet<number> = new Set<number>([
  24, 39, 40, 41, 57, 58, 59,
])

/**
 * 1.13c `D2Game.dll` `OBJECTS_Init03_Chest` (`0x6FC4ECDA..0x6FC4ED18`):
 * Locked percentage = `Math.floor(areaLevel / 2) + 8` (capped to `[0, 100]`).
 */
export function computeChestLockChancePct113c(areaLevel: number): number {
  const lvl = Math.max(0, Math.trunc(areaLevel))
  return Math.min(100, Math.max(0, Math.floor(lvl / 2) + 8))
}

/**
 * 1.13c `D2Game.dll` `OBJECTS_Init03_Chest` (`0x6FC4ECB0`):
 * Rolls runtime `isLocked` ONLY when `Objects.txt` has `InitFn === 3 && Lockable === 1`.
 */
export function rollChestLocked113c(
  classId: number,
  areaLevel: number,
  rng: { rand(max: number): number },
): boolean {
  if (!INIT_FN_3_LOCKABLE_CLASS_IDS_113C.has(classId)) return false
  return rng.rand(100) < computeChestLockChancePct113c(areaLevel)
}

/**
 * 1.13c `Objects.txt` compiled rows (`0..572`) with `InitFn === 2` (`OBJECTS_Init02_Urn` `0x6FC4EB90`)
 * or `InitFn === 3` (`OBJECTS_Init03_Chest` `0x6FC4ECB0`), which roll container traps (`bInteractType` bits `0..6` = `1..9`).
 */
export const INIT_FN_2_OR_3_TRAP_CLASS_IDS_113C: ReadonlySet<number> = new Set<number>([
  4, 5, 6, 9, 52, 87, 88, 94, 95, 139, 140, 141, 144, 146, 147, 148, 171, 176, 177, 178, 179, 180,
  181, 183, 185, 186, 187, 188, 198, 208, 209, 223, 224, 240, 241, 242, 243, 244, 246, 247, 248,
  270, 329, 330, 331, 332, 333, 334, 335, 336, 363, 364, 372, 383, 384, 387, 388, 389, 390, 391,
  413, 416, 418, 420, 424, 425, 430, 431, 432, 433, 443, 444, 445, 448, 463, 466, 467, 468, 469,
  470, 471, 477, 485, 486, 487, 500, 501, 502, 504, 505, 516, 517, 518, 524, 525, 526, 529, 530,
  531, 532, 533, 534, 535, 540, 541, 544, 545, 556,
])

/**
 * 1.13c `Objects.txt` compiled rows (`0..572`) with `PreOperate === 1` (`60` rows).
 * `D2Game.dll` `OBJECTS_Init` (`0x6FC4F480`): if `!isLocked && PreOperate === 1 && rand(14) === 0`,
 * spawns in pre-opened `OBJMODE_OPENED (2)` decorative state (`1/14` = `7.14%`).
 */
export const PRE_OPERATE_CLASS_IDS_113C: ReadonlySet<number> = new Set<number>([
  4, 7, 9, 11, 13, 14, 15, 16, 28, 38, 46, 50, 51, 52, 53, 62, 63, 64, 94, 95, 125, 126, 127, 128,
  142, 143, 185, 186, 187, 188, 203, 204, 205, 208, 209, 222, 223, 224, 233, 290, 291, 292, 293,
  294, 295, 360, 362, 363, 372, 410, 443, 444, 445, 467, 468, 469, 470, 471, 518, 535,
])

/**
 * 1.13c `D2Game.dll` `OBJECTS_Init02_Urn` / `OBJECTS_Init03_Chest` (`0x6FC4EC20..0x6FC4ED60`):
 * Container trap percentage = `Math.floor(areaLevel / 8) + 5` (clamped to `[0, 100]`).
 */
export function computeChestTrapChancePct113c(areaLevel: number): number {
  const lvl = Math.max(0, Math.trunc(areaLevel))
  return Math.min(100, Math.max(0, (lvl >> 3) + 5))
}

/**
 * 1.13c `D2Game.dll` `gpTrapFnTable[1..9]` (`0x6FD27B8C`):
 * Rolls `1..9` when `InitFn` is `2` or `3` (or `isSparkling` / `397` / `455` SparklyChest), else `0`.
 */
export function rollChestTrapType113c(
  classId: number,
  areaLevel: number,
  isSparkling: boolean,
  rng: { rand(max: number): number },
): number {
  if (!isSparkling && !SPARKLY_CHEST_INIT57_CLASS_IDS_113C.has(classId) && !INIT_FN_2_OR_3_TRAP_CLASS_IDS_113C.has(classId)) {
    return 0
  }
  if (rng.rand(100) >= computeChestTrapChancePct113c(areaLevel)) {
    return 0
  }
  return 1 + rng.rand(9)
}

/**
 * 1.13c `D2Game.dll` `OBJECTS_Init` (`0x6FC4F480`):
 * Un-locked objects with `PreOperate === 1` have a `1/14` (`7.14%`) chance to spawn already opened (`mode = 2`).
 */
export function rollPreOperateOpen113c(
  classId: number,
  isLocked: boolean,
  rng: { rand(max: number): number },
): boolean {
  if (isLocked || !PRE_OPERATE_CLASS_IDS_113C.has(classId)) return false
  return rng.rand(14) === 0
}

/** Tracks bootstrap objects whose `PreOperate` (`1/14`) roll has already been evaluated in `buildAreaBootstrap`. */
export const PRE_OPERATE_ROLLED_OBJECTS_113C = new WeakSet<object>()

/**
 * 1.13c container drop chance (%) keyed by `Objects.txt` `OperateFn` (`D2Game.dll` `gpObjectOperateFnTable`):
 * - `1` Casket (`0x6fc8ef40`): `100%`
 * - `3` Urn / Basket (`0x6fc8ecd0`): `21%` (`rand(100) <= 20`)
 * - `4` Chest (`0x6fc8f040`): `75%` (`rand(100) >= 25`)
 * - `5` Barrel (`0x6fc8d7b0`): `21%` (`rand(100) <= 20`)
 * - `14` Crate / Corpse / Hollow Log (`0x6fc8ec20`): `100%`
 * - `48` Trapped Soul (`0x6fc8ce10`): `90%` (`rand(100) < 90`)
 * - `51` Act 3 Jungle Stash / Hollow Log (`0x6fc8eb40`): `75%` (`rand(100) >= 25`)
 * - `68` Act 5 Evil Urn (`0x6fc8edb0`): `100%`
 */
export function getContainerOperateDropChance113c(operateFn: number): number {
  switch (operateFn) {
    case 1:
    case 14:
    case 68:
      return 100
    case 3:
    case 5:
      return 21
    case 48:
      return 90
    case 4:
    case 51:
    default:
      return 75
  }
}

/** Classify one Objects.txt row by its canonical numeric OperateFn / door / shrine metadata. */
export function classifyObjectOperate113c(classId: number): ObjectOperateKind113c {
  const record = getObjectsTxtRecord113c(classId)
  const meta = CANONICAL_113C_OBJECTS[classId]
  if (record.isDoor === 1) return 'door'
  if (meta?.isShrine || record.operateFn === 2) return 'shrine'
  return OPERATE_FN_KIND_113C[record.operateFn] ?? 'mode'
}

/**
 * 1.13c `D2Game.dll` `OBJECTS_InitShrines` (`0x6fc2b9a0..0x6fc2bbe8`):
 * Scans `Shrines.txt` rows `0..22` in table order and appends each shrine `Code` (`1..22`)
 * into its `effectclass` (`1..4`) candidate list (`D2ShrinesRegionStrc`).
 */
export const SHRINES_BY_EFFECT_CLASS_113C: Readonly<Record<1 | 2 | 3 | 4, readonly number[]>> =
  Object.freeze({
    1: Object.freeze(
      Object.entries(CANONICAL_113C_SHRINES)
        .map(([k, v]) => [Number(k), v] as const)
        .filter(([code, v]) => code >= 1 && code <= 22 && v.effectclass === 1)
        .sort(([a], [b]) => a - b)
        .map(([code]) => code),
    ),
    2: Object.freeze(
      Object.entries(CANONICAL_113C_SHRINES)
        .map(([k, v]) => [Number(k), v] as const)
        .filter(([code, v]) => code >= 1 && code <= 22 && v.effectclass === 2)
        .sort(([a], [b]) => a - b)
        .map(([code]) => code),
    ),
    3: Object.freeze(
      Object.entries(CANONICAL_113C_SHRINES)
        .map(([k, v]) => [Number(k), v] as const)
        .filter(([code, v]) => code >= 1 && code <= 22 && v.effectclass === 3)
        .sort(([a], [b]) => a - b)
        .map(([code]) => code),
    ),
    4: Object.freeze(
      Object.entries(CANONICAL_113C_SHRINES)
        .map(([k, v]) => [Number(k), v] as const)
        .filter(([code, v]) => code >= 1 && code <= 22 && v.effectclass === 4)
        .sort(([a], [b]) => a - b)
        .map(([code]) => code),
    ),
  })

/**
 * 1.13c `D2Game.dll` `0x6fc4f089..0x6fc4f0b1`:
 * Remaps deprecated shrine codes before assigning `bInteractType`:
 * - `5` (Mana Exchange) -> `3` (Mana)
 * - `4` (Health Exchange) -> `2` (Health)
 * - `16` (Enirhs) -> `18` (Gem)
 */
export function remapShrineCode113c(code: number): number {
  if (code === 5) return 3
  if (code === 4) return 2
  if (code === 16) return 18
  return code
}

/**
 * 1.13c `D2Game.dll` Object `InitFn 1` (`0x6fc4ef90`) and `sub_6FC4ED70` (`0x6fc4ed70`):
 * Selects the shrine type (`Shrines.txt` `Code 1..22`) for a shrine object (`classId`) spawned in
 * `areaId` (`levelId`):
 * - `Parm0 === 0`: rolls `1 + rand(22)` up to 8 times until `levelId >= LevelMin`.
 * - `Parm0 === 1`: selects from `effectclass = 2` (`[2, 4]`), remapped to `2` (Health Shrine).
 * - `Parm0 === 2`: selects from `effectclass = 3` (`[3, 5]`), remapped to `3` (Mana Shrine).
 * - `Parm0 >= 3`: rolls `rand(10) === 0 ? 1 : 4` (10% `effectclass 1`, 90% `effectclass 4`),
 *   then rolls up to 8 times from that `effectclass` bucket until `levelId >= LevelMin`.
 * - Applies the `5 -> 3`, `4 -> 2`, `16 -> 18` remap (`0x6fc4f089`).
 */
export function rollShrineType113c(
  classId: number,
  areaId: number,
  rng: { rand(max: number): number },
): number {
  const objTxt =
    classId >= 0 && classId < OBJECTS_TXT_113C.length ? OBJECTS_TXT_113C[classId] : undefined
  const parm0 = objTxt?.parm0 ?? CANONICAL_113C_OBJECTS[classId]?.parm0 ?? 0
  const levelId = Math.max(1, Math.trunc(areaId || 1))

  if (parm0 === 0) {
    let code = 1
    for (let tries = 0; tries < 8; tries += 1) {
      code = 1 + rng.rand(22)
      const remapped = remapShrineCode113c(code)
      if (
        levelId >= (CANONICAL_113C_SHRINES[code]?.levelMin ?? 1) &&
        levelId >= (CANONICAL_113C_SHRINES[remapped]?.levelMin ?? 1)
      ) {
        return remapped
      }
    }
    const remapped = remapShrineCode113c(code)
    if (levelId >= (CANONICAL_113C_SHRINES[remapped]?.levelMin ?? 1)) {
      return remapped
    }
    return 1
  }

  const effectClass: 1 | 2 | 3 | 4 =
    parm0 === 1
      ? 2
      : parm0 === 2
        ? 3
        : rng.rand(10) === 0
          ? 1
          : 4
  const list = SHRINES_BY_EFFECT_CLASS_113C[effectClass]
  let code = list[0]!
  for (let tries = 0; tries < 8; tries += 1) {
    code = list[rng.rand(list.length)]!
    const remapped = remapShrineCode113c(code)
    if (
      levelId >= (CANONICAL_113C_SHRINES[code]?.levelMin ?? 1) &&
      levelId >= (CANONICAL_113C_SHRINES[remapped]?.levelMin ?? 1)
    ) {
      return remapped
    }
  }
  const remapped = remapShrineCode113c(code)
  if (levelId >= (CANONICAL_113C_SHRINES[remapped]?.levelMin ?? 1)) {
    return remapped
  }
  for (const candidate of list) {
    const candidateRemapped = remapShrineCode113c(candidate)
    if (levelId >= (CANONICAL_113C_SHRINES[candidateRemapped]?.levelMin ?? 1)) {
      return candidateRemapped
    }
  }
  return remapShrineCode113c(list[0]!)
}

/**
 * 1.13c `D2Game.dll` `0x6fc8da00` (`0x6fc8db50..0x6fc8db7e`):
 * Computes the server frame at which an operated shrine resets from `OBJMODE_OPENED (2)`
 * back to `OBJMODE_NEUTRAL (0)` (`EVENTTYPE_ENDANIM = 3`):
 * - `resetTimeMinutes > 0`: `currentFrame + resetTimeMinutes * 1200 + 1` (`imul ebx, 0x4b0; lea ecx, [eax+ebx+1]`).
 * - `resetTimeMinutes === 0`: `0` (one-shot shrine; never schedules a reset event).
 */
export function computeShrineResetFrame113c(code: number, currentFrame: number): number {
  const meta = CANONICAL_113C_SHRINES[code] ?? getShrineMeta113c(code)
  if (meta.resetTimeMinutes <= 0) return 0
  return currentFrame + meta.resetTimeMinutes * 1200 + 1
}

/**
 * Computes the `OBJMODE_OPERATING (1)` animation duration in 25 Hz game frames from
 * `Objects.txt` `FrameCnt1` (`+0xDC`) and `FrameDelta1` (`+0xFA`).
 */
export function getObjectOperatingTicks113c(classId: number): number {
  const rec = getObjectsTxtRecord113c(classId)
  const frameCnt1 = rec.frameCnt[1] ?? 0
  const frameDelta1 = rec.frameDelta[1] ?? 0
  if (frameCnt1 <= 0) return 0
  if (frameDelta1 <= 0) return frameCnt1
  return Math.round((frameCnt1 * 256) / frameDelta1)
}

/**
 * Canonical `Objects.txt` parameters shared by all 14 water wells (`OperateFn = 22`, `InitFn = 16`,
 * IDs `111, 113, 115, 118, 130, 132, 137, 138, 322, 426, 493, 498, 513, 519`):
 * - `Parm0 = 750` (regen timer frames per charge = 30s at 25fps)
 * - `Parm1 = 128` (`128 / 256 = 50%` max life/mana/stamina healed per charge)
 * - `Parm2 = 1` (`1` charge per mode stage -> `Parm2 << 1 = 2` max charges)
 * - `Parm3 = 3` (bitmask: `bit 1` = heal HP, `bit 0` = heal Mana)
 */
export const WELL_DEFAULT_PARMS_113C = Object.freeze({
  parm0: 750,
  parm1: 128,
  parm2: 1,
  parm3: 3,
} as const)

/**
 * States cured by 1.13c town healers (`0x6fcdcbe0` + `0x6fcdc920`) and water wells (`0x6fc8a560` + `0x6fcdc920`):
 * - `1` (`STATE_FREEZE`, `0x6fc8a669` / `0x6fcdcc39`)
 * - `2` (`STATE_POISON`, `0x6fc8a646` / `0x6fcdcc1b`)
 * - All 13 rows in `States.txt` where `curable === 1` (checked via D2Common ordinal #10590 in `0x6fcdc920`):
 *   `9` (`amplifydamage`), `19` (`weaken`), `23` (`dimvision`), `27` (`taunt`),
 *   `55` (`ironmaiden`), `56` (`terror`), `57` (`attract`), `58` (`lifetap`),
 *   `59` (`confuse`), `60` (`decrepify`), `61` (`lowerresist`), `113` (`defense_curse`), `114` (`blood_mana`).
 */
export const CURABLE_STATE_IDS_113C: readonly number[] = Object.freeze([
  1, 2, 9, 19, 23, 27, 55, 56, 57, 58, 59, 60, 61, 113, 114,
])

export const WELL_CURABLE_STATE_IDS_113C: readonly number[] = CURABLE_STATE_IDS_113C

/**
 * 1.13c `D2Game.dll` `0x6fc4e760` (`InitFn 16`):
 * `pObjectData->bInteractType = pObjectsTxt->dwParm[2] << 1` (`1 << 1 = 2` charges).
 */
export function computeWellInitialCharges113c(
  parm2: number = WELL_DEFAULT_PARMS_113C.parm2,
): number {
  return Math.max(0, Math.trunc(parm2)) << 1
}

/**
 * 1.13c `D2Game.dll` `0x6fc8cf4e..0x6fc8cf64` (`OperateFn 22`) and `0x6fc89d01..0x6fc89d15` (`Event 2`):
 * Maps remaining well charges `bl` to object animation mode (`0` full, `1` half-full, `2` empty)
 * when `bl <= (Parm2 << 1)` and `bl % Parm2 === 0`: `mode = 2 - (bl / Parm2)`.
 */
export function computeWellModeForCharges113c(
  charges: number,
  parm2: number = WELL_DEFAULT_PARMS_113C.parm2,
): number | undefined {
  const step = Math.trunc(parm2)
  const c = Math.trunc(charges)
  if (step <= 0 || c < 0 || c > step << 1 || c % step !== 0) return undefined
  return 2 - Math.trunc(c / step)
}

/**
 * 1.13c `D2Game.dll` `0x6fc8cf73..0x6fc8cf84` (`OperateFn 22`):
 * Schedules `Object Event 2` (`0x6fc89ca0`) at `currentFrame + Parm0 + 1` (`currentFrame + 751`).
 */
export function computeWellRegenFrame113c(
  currentFrame: number,
  parm0: number = WELL_DEFAULT_PARMS_113C.parm0,
): number {
  return Math.trunc(currentFrame) + Math.max(0, Math.trunc(parm0)) + 1
}

/**
 * 1.13c `D2Game.dll` `0x6fc8a5a1..0x6fc8a5aa` (`OBJECTS_UseWell`):
 * Computes `(maxFixed * Parm1) >> 8` (`50%` of `maxFixed` when `Parm1 = 128`).
 */
export function computeWellHealDeltaFixed113c(
  maxFixed: number,
  parm1: number = WELL_DEFAULT_PARMS_113C.parm1,
): number {
  if (maxFixed <= 0 || parm1 <= 0) return 0
  return Math.trunc((Math.trunc(maxFixed) * Math.trunc(parm1)) / 256)
}

/**
 * 1.13c `D2Game.dll` `0x6fd142d0` (`SUNITDMG_ApplyObjectTrapDamage`):
 * Rolls trap damage in `1/256` fixed-point HP against a target with current `currentHpFixed`:
 * - `minDmg256 = max(1, currentHpFixed >> 5)` (`1/32` of current life)
 * - `maxDmg256 = max(minDmg256 + 1, currentHpFixed >> 3)` (`1/8` of current life)
 * - Uniform roll in `[minDmg256, maxDmg256]` (`range = maxDmg256 - minDmg256 + 256`)
 * - Scaled by `monLvl / 100` (`D2Common.#10820`), clamped to at least `256` (`1` whole HP).
 */
export function rollObjectTrapDamage256_113c(
  currentHpFixed: number,
  monLvl: number,
  rng: { rand(max: number): number },
): number {
  const hp256 = Math.trunc(currentHpFixed)
  if (hp256 <= 0) return 0
  const minDmg256 = Math.max(1, hp256 >> 5)
  const maxDmg256 = Math.max(minDmg256 + 1, hp256 >> 3)
  const range256 = maxDmg256 - minDmg256 + 256
  const rolled256 = minDmg256 + (range256 > 0 ? rng.rand(range256) : 0)
  const effectiveMonLvl = monLvl > 0 ? Math.trunc(monLvl) : 100
  return Math.max(256, Math.trunc((rolled256 * effectiveMonLvl) / 100))
}
