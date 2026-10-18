/**
 * Built-in plugins registry (`plugins/index.ts`).
 */

import type { D2WebPlugin } from '../src/client/plugin-host/api.ts'
import { autoCombatPlugin } from './auto-combat/index.ts'
import { autoPotionPlugin } from './auto-potion/index.ts'
import { autoGoldPickupPlugin } from './auto-gold-pickup/index.ts'
import { automapRevealPlugin } from './automap-reveal/index.ts'
import { dragInteractPlugin } from './drag-interact/index.ts'
import { dropTrackerPlugin } from './drop-tracker/index.ts'
import { experienceBarPlugin } from './experience-bar/index.ts'
import { extendedViewportsPlugin } from './extended-viewports/index.ts'
import { groundItemBeamPlugin } from './ground-item-beam/index.ts'
import { hudEnhancementsPlugin } from './hud-enhancements/index.ts'
import { itemInfoPlugin } from './item-info/index.ts'
import { killStatsPlugin } from './kill-stats/index.ts'
import { monsterResistsPlugin } from './monster-resists/index.ts'
import { nextGamePlugin } from './next-game/index.ts'
import { quickCastPlugin } from './quick-cast/index.ts'
import { runTimerPlugin } from './run-timer/index.ts'
import { stashDepositAllPlugin } from './stash-deposit-all/index.ts'
import { upgradeHintsPlugin } from './upgrade-hints/index.ts'

export const BUILTIN_PLUGINS: readonly D2WebPlugin[] = [
  killStatsPlugin,
  dropTrackerPlugin,
  automapRevealPlugin,
  extendedViewportsPlugin,
  hudEnhancementsPlugin,
  groundItemBeamPlugin,
  quickCastPlugin,
  nextGamePlugin,
  dragInteractPlugin,
  stashDepositAllPlugin,
  experienceBarPlugin,
  autoGoldPickupPlugin,
  autoCombatPlugin,
  autoPotionPlugin,
  upgradeHintsPlugin,
  itemInfoPlugin,
  monsterResistsPlugin,
  runTimerPlugin,
]
