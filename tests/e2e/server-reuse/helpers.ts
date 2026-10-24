/**
 * Shared Opaque-Box Test Harness & Fixture Builders for the 4-Tier Server-Reuse E2E Suite
 * (`tests/e2e/server-reuse/helpers.ts`).
 *
 * Operates strictly across the public contracts defined in `PROJECT.md § Interface Contracts`:
 * - `src/server/index.ts`
 * - `src/netproto/index.ts`
 * - `src/client/session/online-session.ts`
 * - `src/baker/mpq-archive-source.ts`
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getSharedDataRegistry,
  getSharedMountedArchives,
  type D2DataRegistry,
} from '../../../src/baker/mpq-archive-source.ts'
import { FIXED_ONE } from '../../../src/server/engine/stat-list.ts'
import type {
  ByteStream,
  CharClassId,
  ClientCommand,
  GameServerAdapter,
  ServerEvent,
} from '../../../src/netproto/index.ts'
import type { D2sCharacterData } from '../../../src/server/index.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT_DIR = resolve(__dirname, '../../..')
export const SRC_DIR = resolve(ROOT_DIR, 'src')
export const TESTS_DIR = resolve(ROOT_DIR, 'tests')
export const TOOLS_DIR = resolve(ROOT_DIR, 'tools')

export const RETIRED_LEGACY_FILES = [
  'src/server/engine/engine.ts',
  'src/server/engine/combat.ts',
  'src/server/scene/skill-caster.ts',
  'src/server/scene/weapon-combat.ts',
] as const

export { getSharedDataRegistry, getSharedMountedArchives, FIXED_ONE, type D2DataRegistry }

/**
 * #1327: give a map-less `GameInstance` a 3x3 grid of outdoor DRLG rooms
 * (8x8 tiles = 40x40 sub-tiles each, centred on `(cx, cy)`) and an all-walkable
 * terrain check, so its 1.13c `Levels.txt` room population has room bounds and
 * legal cells to work with (the old "spawn a Fallen anywhere" stub is gone).
 */
export function installOutdoorRoomGrid(
  game: {
    setTerrainWalkableCheck(fn: (areaId: number, x: number, y: number) => boolean): void
    setAreaRoomProvider(
      fn: (areaId: number) => readonly { index: number; x: number; y: number; w: number; h: number; seed: number }[] | null,
    ): void
  },
  areaId: number,
  cx: number,
  cy: number,
): void {
  const rooms: { index: number; x: number; y: number; w: number; h: number; seed: number }[] = []
  const x0 = Math.floor(cx) - 60
  const y0 = Math.floor(cy) - 60
  for (let ry = 0; ry < 3; ry++) {
    for (let rx = 0; rx < 3; rx++) {
      const index = ry * 3 + rx
      rooms.push({ index, x: x0 + rx * 40, y: y0 + ry * 40, w: 40, h: 40, seed: (0x5eed + index * 0x9e3779b1) >>> 0 })
    }
  }
  game.setTerrainWalkableCheck(() => true)
  game.setAreaRoomProvider((id) => (id === areaId ? rooms : null))
}

/**
 * Build a complete, canonical 1.13c v96 `D2sCharacterData` fixture conforming to
 * `PROJECT.md § Interface Contracts #2`.
 */
export function createSampleD2sCharacterData(
  overrides: Partial<D2sCharacterData> & {
    readonly attributesOverrides?: Partial<D2sCharacterData['attributes']>
    readonly mercOverrides?: Partial<D2sCharacterData['merc']>
  } = {},
): D2sCharacterData {
  const level = overrides.level ?? overrides.attributesOverrides?.level ?? 24
  const activeDifficulty: 0 | 1 | 2 = overrides.activeDifficulty ?? 0
  const activeAct: 0 | 1 | 2 | 3 | 4 = overrides.activeAct ?? 0

  const defaultTowns: [number, number, number] = [
    activeDifficulty === 0 ? (0x80 | activeAct) : 0,
    activeDifficulty === 1 ? (0x80 | activeAct) : 0,
    activeDifficulty === 2 ? (0x80 | activeAct) : 0,
  ]

  const quests: [Uint16Array, Uint16Array, Uint16Array] = overrides.quests
    ? [
        new Uint16Array(overrides.quests[0]),
        new Uint16Array(overrides.quests[1]),
        new Uint16Array(overrides.quests[2]),
      ]
    : [new Uint16Array(48), new Uint16Array(48), new Uint16Array(48)]

  const makeDefaultWaypoints = (): Uint8Array => {
    const wp = new Uint8Array(24)
    wp[0] = 0x02
    wp[1] = 0x01
    wp[2] = 0x01 // Rogue Encampment waypoint active by default
    return wp
  }

  const waypoints: [Uint8Array, Uint8Array, Uint8Array] = overrides.waypoints
    ? [
        new Uint8Array(overrides.waypoints[0]),
        new Uint8Array(overrides.waypoints[1]),
        new Uint8Array(overrides.waypoints[2]),
      ]
    : [makeDefaultWaypoints(), makeDefaultWaypoints(), makeDefaultWaypoints()]

  const appearance = overrides.appearance
    ? new Uint8Array(overrides.appearance)
    : new Uint8Array(32).fill(0xff)

  const npcIntros = overrides.npcIntros
    ? new Uint8Array(overrides.npcIntros)
    : new Uint8Array(52)

  const skillLevels = overrides.skillLevels
    ? new Uint8Array(overrides.skillLevels)
    : (() => {
        const s = new Uint8Array(30)
        s[0] = 5
        s[1] = 3
        s[2] = 1
        return s
      })()

  const hotkeys =
    overrides.hotkeys ??
    Array.from({ length: 16 }, (_, i) => (i === 0 ? 36 : i === 1 ? 42 : 0xffff))

  return {
    name: overrides.name ?? 'SorceressHero',
    charClass: overrides.charClass ?? 1, // 1 = Sorceress
    level,
    statusFlags: overrides.statusFlags ?? 0x20, // Expansion
    progression: overrides.progression ?? 5,
    activeWeapon: overrides.activeWeapon ?? 0,
    timestampSec: overrides.timestampSec ?? 1700000000,
    hotkeys,
    leftRightSkills: overrides.leftRightSkills ?? [36, 42, 0, 0],
    appearance,
    difficultyTowns: overrides.difficultyTowns ?? defaultTowns,
    activeDifficulty,
    activeAct,
    mapSeed: (overrides.mapSeed ?? 0x13572468) >>> 0,
    merc: {
      dead: false,
      seed: 0x00c0ffee,
      nameId: 3,
      typeId: 11,
      experience: 12500,
      items: [],
      ...(overrides.merc ?? {}),
      ...(overrides.mercOverrides ?? {}),
    },
    quests,
    waypoints,
    npcIntros,
    attributes: {
      strength: 45,
      energy: 85,
      dexterity: 40,
      vitality: 70,
      statPts: 10,
      skillPts: 4,
      hitpointsFixed: 240 * FIXED_ONE,
      maxHpFixed: 240 * FIXED_ONE,
      manaFixed: 310 * FIXED_ONE,
      maxManaFixed: 310 * FIXED_ONE,
      staminaFixed: 180 * FIXED_ONE,
      maxStaminaFixed: 180 * FIXED_ONE,
      level,
      experience: 125000,
      gold: 15000,
      goldBank: 50000,
      ...(overrides.attributes ?? {}),
      ...(overrides.attributesOverrides ?? {}),
    },
    skillLevels,
    items: overrides.items ?? [],
    corpseItems: overrides.corpseItems ?? [],
  }
}

/**
 * Attach an event recorder to a `GameServerAdapter` and return the live array of
 * received `ServerEvent`s plus an unsubscribe callback.
 */
export function recordAdapterEvents(adapter: GameServerAdapter): {
  readonly events: ServerEvent[]
  readonly stop: () => void
  readonly clear: () => void
} {
  const events: ServerEvent[] = []
  const stop = adapter.onEvent((ev) => {
    events.push(ev)
  })
  return {
    events,
    stop,
    clear: () => {
      events.length = 0
    },
  }
}

/**
 * Recursively collect all `.ts` files under `dir`.
 */
export function collectTsFilesRecursive(dir: string): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      results.push(...collectTsFilesRecursive(full))
    } else if (entry.endsWith('.ts')) {
      results.push(full)
    }
  }
  return results
}

/**
 * Read a file relative to repository root.
 */
export function readRepoFile(relPath: string): string {
  return readFileSync(resolve(ROOT_DIR, relPath), 'utf8')
}

/**
 * Check if a path relative to repository root exists.
 */
export function repoPathExists(relPath: string): boolean {
  return existsSync(resolve(ROOT_DIR, relPath))
}

/**
 * Convert absolute path to forward-slash path relative to `ROOT_DIR`.
 */
export function toRepoRelative(absPath: string): string {
  return relative(ROOT_DIR, absPath).replace(/\\/g, '/')
}

/**
 * Normalize class ID (0..6) to 3-letter class code.
 */
export function classIdToCode(classId: number): string {
  const codes: readonly string[] = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass']
  return codes[classId] ?? 'sor'
}

export type { ByteStream, CharClassId, ClientCommand, D2sCharacterData, GameServerAdapter, ServerEvent }
