/**
 * Draws the 1.13c level entry title ("Entering The Blood Moor", `D2Client.dll` `0x6fb6f0d0`) on the HUD.
 *
 * State and timing live in `src/common/world/level-entry-title-113c.ts`; this module only resolves the baked
 * atlas rect and blits it at the `D2Win #10138` centred position (`x = W/2 - (w >> 1) - 1`,
 * bottom edge `H/2 - 0x8c`). The atlas already carries the `textShifts[1]` palette shift.
 */

import {
  computeLevelEntryTitlePlacement,
  type LevelEntryTitle113c,
  type LevelEntryTitleLayout,
  type LevelEntryTitleQuestSource,
} from '../../common/world/level-entry-title-113c.ts'
import { LEVEL_ENTRY_TITLE_RECTS } from '../../common/world/level-entry-titles-113c.ts'

/** Quest source used before `OnlineSession` wires `g_QuestAvail`: reading it is the 1.13c FatalAssert 0x60. */
const UNWIRED_QUEST_SOURCE: LevelEntryTitleQuestSource = {
  getQuestAvailability(questId: number): number {
    throw new Error(`level entry title: g_QuestAvail[${String(questId)}] read with no quest source (FatalAssert 0x60)`)
  },
}

/**
 * Layout of a title key in native HUD coordinates.
 *
 * @param titleKey - baked atlas key.
 * @param screenWidth - native HUD width.
 * @param screenHeight - native HUD height.
 */
export function layoutLevelEntryTitle(titleKey: string, screenWidth: number, screenHeight: number): LevelEntryTitleLayout {
  const rect = LEVEL_ENTRY_TITLE_RECTS[titleKey]
  if (rect === undefined) throw new Error(`level entry title: '${titleKey}' is not in the baked atlas`)
  const { x, y } = computeLevelEntryTitlePlacement(screenWidth, screenHeight, rect.w, rect.h)
  return { titleKey, x, y, width: rect.w, height: rect.h }
}

/** Failures already reported (one console.error per distinct message, not one per frame). */
const reportedFailures = new Set<string>()

/** Report a title failure loudly but once; the HUD frame must keep its save/restore stack balanced. */
function reportLevelEntryTitleFailure(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  if (reportedFailures.has(message)) return
  reportedFailures.add(message)
  console.error(`[level-entry-title] ${message}`)
}

/**
 * Run one `0x6fb6f0d0` frame and draw the title when visible.
 *
 * Errors (1.13c FatalAssert mirrors, a level without a baked title, a missing atlas once the HUD finished loading)
 * are reported with `console.error` once per distinct message and the title is skipped: this runs inside
 * `renderHudFrame`'s `ctx.save()` block, so it must never throw.
 *
 * @param ctx - HUD context already scaled to native coordinates.
 * @param title - per-client title state.
 * @param levelId - local player's room level (`null` when there is no player / room).
 * @param quests - `g_QuestAvail` reader, or `null` when not wired.
 * @param atlas - loaded `level-entry-titles.png`, or `null`.
 * @param assetsReady - whether the HUD finished loading its images (a missing atlas is then an error).
 * @param nowMs - current time.
 * @param screenWidth - native HUD width.
 * @param screenHeight - native HUD height.
 * @returns the drawn layout, or `null`.
 */
export function renderLevelEntryTitle113c(
  ctx: CanvasRenderingContext2D,
  title: LevelEntryTitle113c,
  levelId: number | null,
  quests: LevelEntryTitleQuestSource | null,
  atlas: CanvasImageSource | null,
  assetsReady: boolean,
  nowMs: number,
  screenWidth: number,
  screenHeight: number,
): LevelEntryTitleLayout | null {
  try {
    const titleKey = title.update(levelId, nowMs, quests ?? UNWIRED_QUEST_SOURCE)
    if (titleKey === null) return null
    const layout = layoutLevelEntryTitle(titleKey, screenWidth, screenHeight)
    if (atlas === null) {
      if (assetsReady) {
        throw new Error('ui/level-entry-titles.png is missing (run npm run pack:level-entry-titles)')
      }
      return null
    }
    const rect = LEVEL_ENTRY_TITLE_RECTS[titleKey]!
    ctx.drawImage(atlas, rect.x, rect.y, rect.w, rect.h, layout.x, layout.y, rect.w, rect.h)
    return layout
  } catch (err) {
    reportLevelEntryTitleFailure(err)
    return null
  }
}
