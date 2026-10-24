/**
 * Stage observers of the DRLG port: the TypeScript counterpart of the oracle's link-time
 * `--wrap=DRLGOUTWILD_InitAct1OutdoorLevel` hook (tools/d2moo-oracle/src/main.cpp). The generator
 * calls {@link notifyLevelGrid} right after DRLGOUTWILD_InitAct1OutdoorLevel, before any room of the
 * level exists. Without an installed observer the call does nothing.
 */

import type { D2DrlgLevelStrc } from './drlg-types.ts'

export type LevelGridHook = (pLevel: D2DrlgLevelStrc) => void

let levelGridHook: LevelGridHook | null = null

/** Installs (or removes, with null) the level-grid observer. Returns the previous one. */
export function setLevelGridHook(hook: LevelGridHook | null): LevelGridHook | null {
  const previous = levelGridHook
  levelGridHook = hook
  return previous
}

export function notifyLevelGrid(pLevel: D2DrlgLevelStrc): void {
  if (levelGridHook) levelGridHook(pLevel)
}
