/**
 * Diablo II v1.13c level entry title ("Entering The Blood Moor") — client state machine.
 *
 * Ground truth: `D2Client.dll` 1.13c `0x6fb6f0d0`, called once per UI draw frame from `0x6fb73aa1`.
 *
 * Per frame:
 * 1. `pPlayer = g_pPlayerUnit (0x6fbcbbfc)`; no unit or no room (`D2Common #10331`) → free the cached
 *    title cell file (`0x6fbaad54`) and return. Neither the last level nor the frame counter changes.
 * 2. `levelId = D2Common #10826(pRoom)`. When it differs from `g_nLastLevel (0x6fbd3410)`:
 *    free the cached cell file, then `g_nFrames (0x6fbd340c) = (g_nLastLevel != 0) ? 0 : 0x78`
 *    (`setne / dec / and 0x78` @ `0x6fb6f1a8-b6`) and `g_nLastLevel = levelId`.
 *    The very first level after process start therefore never shows a title. `g_nLastLevel` has no
 *    other writer in `D2Client.dll`, so it is NOT reset between games.
 * 3. `g_nFrames >= 0x78` → free the cell file and return; otherwise `++g_nFrames`.
 * 4. Path: `"%s\UI\%s\%s\%s"` = `DATA\LOCAL\UI\<LNG>\<folder>\<EntryFile>` (`0x6fb8348c`), where
 *    `folder = levelId >= 0x6d ? "EXPANSION" (0x6fb834b0) : "ACT%d" (0x6fb834a8) % (act + 1)` and
 *    `EntryFile` is the Levels.txt column (`D2Common #10014` record `+0x145`).
 * 5. Quest override table `0x6fb8be88` (13-byte records `{levelId, questId, char[5]}`, count
 *    `0x6fb8bea0 = 2`): if `levelId` matches and `g_QuestAvail[questId] (0x6fbc5590)` is non-zero, the
 *    path becomes `"%s\UI\%s\ACT1\%s"` (`0x6fb83478`). Reading `g_QuestAvail` before the first S2C 0x5E
 *    (`g_bQuestAvailRecv 0x6fbcc0a0 == 0`) or with `questId >= 0x25` is a FatalAssert (`0x6fb6f2d5-f0`).
 * 6. Draw: `D2Win #10138(pCell, x = screenW / 2, y = screenH / 2 - 0x8c, align = 1, drawMode = 5,
 *    paletteShift = 1)` → centred at `x - (totalWidth >> 1) - 1`, frames advance 256 px, `y` is the
 *    bottom edge; palette shift 1 selects the PL2 `textShifts[1]` remap (baked into the atlas).
 *
 * The 120 draw frames run at the fixed 25 Hz client frame rate (40 ms each), i.e. 4.8 s on screen.
 *
 * The client keeps the whole title on screen only while `g_nFrames < 0x78`; this module reproduces
 * the counter from wall-clock time so a throttled HUD repaint cannot stretch or shorten it.
 */

/** `cmp g_nFrames, 0x78` @ `0x6fb6f1c6`: frames a title stays on screen. */
export const LEVEL_ENTRY_TITLE_FRAMES = 0x78
/** One 1.13c client draw frame at the fixed 25 Hz rate. */
export const LEVEL_ENTRY_TITLE_FRAME_MS = 1000 / 25
/** First level id whose titles live in the `EXPANSION` folder (`cmp edi, 0x6d` @ `0x6fb6f21a`). */
export const LEVEL_ENTRY_TITLE_EXPANSION_FIRST_LEVEL = 0x6d
/** `sub eax, 0x8c` @ `0x6fb6f345`: title bottom edge relative to the screen's vertical centre. */
export const LEVEL_ENTRY_TITLE_CENTER_Y_OFFSET = 0x8c
/** D2Win #10138 advances `esi += 0x100` per frame (`0x6f8f1864`). */
export const LEVEL_ENTRY_TITLE_FRAME_STRIDE = 0x100
/** `g_QuestAvail` size checked by the override read (`cmp eax, 0x25` @ `0x6fb6f2bb`). */
export const LEVEL_ENTRY_TITLE_QUEST_LIMIT = 0x25

/** One record of the quest override table `0x6fb8be88`. */
export interface LevelEntryTitleQuestOverride {
  /** Levels.txt id the record applies to. */
  readonly levelId: number
  /** `g_QuestAvail` index that must be non-zero. */
  readonly questId: number
  /** Atlas key of the replacement title (always under `ACT1`). */
  readonly titleKey: string
}

/** `0x6fb8be88` (`count = 2` @ `0x6fb8bea0`): Den of Evil → `A1Q1`, Forgotten Tower → `A1Q5`. */
export const LEVEL_ENTRY_TITLE_QUEST_OVERRIDES: readonly LevelEntryTitleQuestOverride[] = Object.freeze([
  Object.freeze({ levelId: 8, questId: 1, titleKey: 'act1/a1q1' }),
  Object.freeze({ levelId: 20, questId: 5, titleKey: 'act1/a1q5' }),
])

/**
 * Folder segment of `DATA\LOCAL\UI\<LNG>\<folder>\<EntryFile>` for a level (lower-cased atlas form).
 *
 * @param levelId - Levels.txt id.
 * @param act - zero-based act of the level (Levels.txt `Act`, via `D2Common #10459`).
 */
export function levelEntryTitleFolder(levelId: number, act: number): string {
  if (levelId >= LEVEL_ENTRY_TITLE_EXPANSION_FIRST_LEVEL) return 'expansion'
  return `act${String(act + 1)}`
}

/**
 * Atlas key `<folder>/<entryfile>` for a Levels.txt row.
 *
 * @param levelId - Levels.txt id.
 * @param act - zero-based act.
 * @param entryFile - Levels.txt `EntryFile`.
 */
export function levelEntryTitleKey(levelId: number, act: number, entryFile: string): string {
  const file = entryFile.trim()
  if (file === '') throw new Error(`Levels.txt Id=${String(levelId)} has an empty EntryFile`)
  return `${levelEntryTitleFolder(levelId, act)}/${file.toLowerCase()}`
}

/** Read access to `g_QuestAvail` / `g_bQuestAvailRecv` (owned by the quest FX state). */
export interface LevelEntryTitleQuestSource {
  /** `0x6fb12de0`-style read: asserts the first S2C 0x5E arrived and `questId < 0x25`. */
  getQuestAvailability(questId: number): number
}

/** Placement of a visible title in native HUD coordinates. */
export interface LevelEntryTitleLayout {
  readonly titleKey: string
  /** Left edge of the first frame. */
  readonly x: number
  /** Top edge (bottom edge minus height). */
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * D2Win #10138 centred placement (`align = 1`): `x - (w >> 1) - 1`, `y` is the bottom edge.
 *
 * @param screenWidth - native HUD width (`0x6fb8bc48`).
 * @param screenHeight - native HUD height (`0x6fb8bc4c`).
 * @param width - total title width (sum of frame widths).
 * @param height - title height.
 */
export function computeLevelEntryTitlePlacement(
  screenWidth: number,
  screenHeight: number,
  width: number,
  height: number,
): { readonly x: number; readonly y: number } {
  const anchorX = Math.trunc(screenWidth / 2)
  const bottomY = Math.trunc(screenHeight / 2) - LEVEL_ENTRY_TITLE_CENTER_Y_OFFSET
  return { x: anchorX - (width >>> 1) - 1, y: bottomY - height }
}

/** Per-client (not per-game) level entry title state, mirroring `0x6fbd3410` / `0x6fbd340c` / `0x6fbaad54`. */
export class LevelEntryTitle113c {
  /** `g_nLastLevel` 0x6fbd3410 (never reset by the game init). */
  private lastLevelId = 0
  /** Time the counter was (re)started at 0; `null` means `g_nFrames` is pinned at `0x78`. */
  private startMs: number | null = null
  /** Cached title key (`0x6fbaad54` loaded cell file). */
  private cachedKey: string | null = null

  /**
   * @param titleKeyByLevel - Levels.txt id → baked title key (generated from `EntryFile`).
   */
  constructor(private readonly titleKeyByLevel: Readonly<Record<number, string>>) {}

  /**
   * Run one `0x6fb6f0d0` frame.
   *
   * @param levelId - the local player's room level, or `null` when there is no unit / room.
   * @param nowMs - current time.
   * @param quests - `g_QuestAvail` reader (only consulted for the override levels).
   * @returns the title key to draw this frame, or `null`.
   */
  update(levelId: number | null, nowMs: number, quests: LevelEntryTitleQuestSource): string | null {
    if (levelId === null || levelId <= 0) {
      this.cachedKey = null
      return null
    }
    if (levelId !== this.lastLevelId) {
      this.cachedKey = null
      this.startMs = this.lastLevelId !== 0 ? nowMs : null
      this.lastLevelId = levelId
    }
    if (this.startMs === null) {
      this.cachedKey = null
      return null
    }
    const frames = Math.floor((nowMs - this.startMs) / LEVEL_ENTRY_TITLE_FRAME_MS)
    if (frames >= LEVEL_ENTRY_TITLE_FRAMES) {
      this.cachedKey = null
      this.startMs = null
      return null
    }
    if (this.cachedKey === null) {
      this.cachedKey = this.resolveTitleKey(levelId, quests)
    }
    return this.cachedKey
  }

  /** Whether a title is currently being shown (repaint-skip guard). */
  get active(): boolean {
    return this.startMs !== null
  }

  /** `g_nLastLevel`, for repaint signatures and tests. */
  get lastLevel(): number {
    return this.lastLevelId
  }

  private resolveTitleKey(levelId: number, quests: LevelEntryTitleQuestSource): string {
    const base = this.titleKeyByLevel[levelId]
    if (base === undefined) {
      throw new Error(`LevelEntryTitle113c: level ${String(levelId)} has no baked EntryFile title`)
    }
    for (const rec of LEVEL_ENTRY_TITLE_QUEST_OVERRIDES) {
      if (rec.levelId !== levelId) continue
      if (quests.getQuestAvailability(rec.questId) !== 0) return rec.titleKey
      break
    }
    return base
  }
}
