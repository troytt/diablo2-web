/**
 * Saving and loading a game.
 *
 * Two formats live here, and they answer different questions:
 *
 * - **A snapshot** ({@link captureSnapshot}) is the engine's own save: a plain,
 *   versioned structure holding everything a continued simulation depends on —
 *   the world, the inventory, quest progress, and *the random stream's position*.
 *   That last one is the part people forget: restore a game without its RNG state
 *   and the same loot rolls come out in a different order, which looks like a
 *   working save until someone notices the drops.
 * - **`.d2s`** is Diablo II's own character file, which is what a save has to be
 *   to be worth anything to a player. Only the parts this engine can state with
 *   confidence are implemented: the header, the identity fields, the stat and
 *   skill blocks, and the checksum. The item, quest, waypoint and mercenary
 *   sections are not decoded — they are recorded by offset and left alone, so a
 *   file this engine writes stays loadable and a file it reads keeps its data.
 *
 * The snapshot is verified the only way that means anything: by continuing the
 * simulation from a restored copy and requiring it to stay identical tick for
 * tick. The `.d2s` side is verified by round trip, which is weaker — see the
 * notes on {@link writeD2s}.
 */
import { rebindPlayer } from '../ai/monster-ai.ts'
import type { CombatWorld, Monster } from '../../common/units/unit-types.ts'
import type { Inventory, Item, PlacedItem } from '../../common/items/items.ts'
import type { QuestLog, QuestProgress } from '../../common/world/quests.ts'
import type { Rng } from '../../common/rng/d2-rng.ts'

/** Snapshot format version; bumped whenever the shape changes. */
const SNAPSHOT_VERSION = 1

/** A saved game. */
export interface GameSnapshot {
  /** Format version. */
  readonly version: number
  /** Random stream low 32-bit position, so drops continue rather than restart. */
  readonly rngState: number
  /** Random stream high 32-bit carry position (64-bit D2Rng). */
  readonly rngHighState?: number | undefined
  /** Cast RNG low 32-bit state. */
  readonly castRngState?: number | undefined
  /** Cast RNG high 32-bit carry state. */
  readonly castRngHighState?: number | undefined
  /** Hydra sequence counter. */
  readonly hydraGroupSeqCounter?: number | undefined
  /** GroundItemManager sequential ID counter. */
  readonly groundItemIdCounter?: number | undefined
  /** The combat world, minus its per-tick event buffer. */
  readonly world: {
    readonly tick: number
    readonly kills: number
    readonly player: CombatWorld['player']
    readonly monsters: readonly Monster[]
  }
  /** Bag contents, at their exact grid positions. */
  readonly inventory: {
    readonly width: number
    readonly height: number
    readonly gold?: number | undefined
    readonly placed: readonly { readonly x: number; readonly y: number; readonly item: Item }[]
  }
  /** Quest progress. */
  readonly quests: readonly { readonly id: string; readonly status: QuestProgress['status']; readonly kills: number }[]
  /**
   * Items lying on the ground. Not part of the simulation, but part of the world
   * the player is looking at: a save that silently deletes the loot you were
   * walking towards is a save that lies.
   */
  readonly ground: readonly {
    readonly x: number
    readonly y: number
    readonly item: Item
    readonly groundItemId?: string | undefined
  }[]
}

/** Everything a snapshot is taken from. */
export interface SnapshotSources {
  /** The combat world. */
  readonly world: CombatWorld
  /** The loot random stream. */
  readonly rng: Rng
  /** Optional cast RNG stream. */
  readonly castRng?: Rng | undefined
  /** Optional Hydra sequence counter. */
  readonly hydraGroupSeqCounter?: number | undefined
  /** Optional GroundItemManager sequence counter. */
  readonly groundItemIdCounter?: number | undefined
  /** The player's inventory. */
  readonly inventory: Inventory
  /** The quest log. */
  readonly quests: QuestLog
  /** Items on the ground. */
  readonly ground: readonly {
    readonly x: number
    readonly y: number
    readonly item: Item
    readonly groundItemId?: string | undefined
  }[]
}

/**
 * Capture the current game.
 *
 * @param sources - the live state.
 * @returns the snapshot (a plain object, ready to serialize).
 */
export function captureSnapshot(sources: SnapshotSources): GameSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    rngState: sources.rng.seed,
    rngHighState: sources.rng.hi,
    ...(sources.castRng !== undefined ? { castRngState: sources.castRng.seed, castRngHighState: sources.castRng.hi } : {}),
    ...(sources.hydraGroupSeqCounter !== undefined ? { hydraGroupSeqCounter: sources.hydraGroupSeqCounter } : {}),
    ...(sources.groundItemIdCounter !== undefined ? { groundItemIdCounter: sources.groundItemIdCounter } : {}),
    world: {
      tick: sources.world.tick,
      kills: sources.world.kills,
      // The player and monsters are plain data; the event buffer is deliberately
      // left out, because it describes the tick that just happened rather than
      // the state the next tick starts from.
      player: { ...sources.world.player },
      monsters: sources.world.monsters.map(monster => ({ ...monster })),
    },
    inventory: {
      width: sources.inventory.width,
      height: sources.inventory.height,
      gold: sources.inventory.dedicatedGold,
      placed: sources.inventory.contents.map(entry => ({ x: entry.x, y: entry.y, item: entry.item })),
    },
    quests: sources.quests.all.map(entry => ({ id: entry.def.id, status: entry.status, kills: entry.kills })),
    ground: sources.ground.map(entry => ({
      x: entry.x,
      y: entry.y,
      item: entry.item,
      ...(entry.groundItemId !== undefined ? { groundItemId: entry.groundItemId } : {}),
    })),
  }
}

/**
 * Serialize a snapshot.
 *
 * @param snapshot - the snapshot.
 * @returns its JSON text.
 */
export function serializeSnapshot(snapshot: GameSnapshot): string {
  return JSON.stringify(snapshot)
}

/**
 * Parse a snapshot, rejecting anything that is not one.
 *
 * Validation is deliberate rather than trusting `JSON.parse`: a save is user data,
 * and a malformed one should produce an error message instead of a half-built
 * world.
 *
 * @param text - the JSON text.
 * @returns the parsed snapshot.
 */
function assertPlacedItem(value: unknown, index: number): asserts value is import('../../common/items/items.ts').PlacedItem {
  if (typeof value !== 'object' || value === null) throw new Error(`inventory placed item [${index}] is malformed`)
  if (!('x' in value) || typeof value.x !== 'number') throw new Error(`inventory placed item [${index}] has invalid x`)
  if (!('y' in value) || typeof value.y !== 'number') throw new Error(`inventory placed item [${index}] has invalid y`)
  if (!('item' in value) || typeof value.item !== 'object' || value.item === null) throw new Error(`inventory placed item [${index}] has no item`)
}

function assertSnapshot(value: unknown): asserts value is GameSnapshot {
  if (typeof value !== 'object' || value === null) throw new Error('save is not an object')
  if (!('version' in value) || value.version !== SNAPSHOT_VERSION) {
    throw new Error(`save version ${String('version' in value ? value.version : '?')} is not supported (expected ${String(SNAPSHOT_VERSION)})`)
  }
  if (!('rngState' in value) || typeof value.rngState !== 'number') throw new Error('save has no random state')
  if ('rngHighState' in value && value.rngHighState !== undefined && typeof value.rngHighState !== 'number') {
    throw new Error('save has invalid rngHighState')
  }
  
  if (!('world' in value) || typeof value.world !== 'object' || value.world === null) throw new Error('save has no world')
  if (!('tick' in value.world) || typeof value.world.tick !== 'number') throw new Error('save has no world')
  if (!('player' in value.world) || typeof value.world.player !== 'object' || value.world.player === null) throw new Error('save has no player')
  if (!('monsters' in value.world) || !Array.isArray(value.world.monsters)) throw new Error('save has no monster list')
  
  if (!('inventory' in value) || typeof value.inventory !== 'object' || value.inventory === null) throw new Error('save has no inventory bounds')
  if (!('width' in value.inventory) || typeof value.inventory.width !== 'number') throw new Error('save has no inventory bounds')
  if (!('height' in value.inventory) || typeof value.inventory.height !== 'number') throw new Error('save has no inventory bounds')
  if (!('placed' in value.inventory) || !Array.isArray(value.inventory.placed)) throw new Error('save has no inventory')
  
  for (const [index, entry] of Object.entries(value.inventory.placed)) {
    assertPlacedItem(entry, Number(index))
  }
  
  if (!('quests' in value) || !Array.isArray(value.quests)) throw new Error('save has no quest log')
  
  if ('ground' in value && value.ground !== undefined && !Array.isArray(value.ground)) {
    throw new Error('save has a malformed ground list')
  }
}

export function parseSnapshot(text: string): GameSnapshot {
  const parsed: unknown = JSON.parse(text)
  assertSnapshot(parsed)
  // Ensure ground is present if missing from older saves
  if (!('ground' in parsed) || parsed.ground === undefined) {
    return { ...parsed, ground: [] }
  }
  return parsed
}

/**
 * Restore a snapshot into live objects.
 *
 * @param snapshot - the snapshot.
 * @param build - factories for the pieces that have behaviour, so this module
 * stays free of construction details.
 * @returns the restored state.
 */
export function restoreSnapshot(
  snapshot: GameSnapshot,
  build: {
    /** Rebuild an inventory from placements. */
    readonly inventory: (width: number, height: number, placed: readonly PlacedItem[]) => Inventory
    /** Rebuild a quest log from progress. */
    readonly quests: (states: GameSnapshot['quests']) => QuestLog
  },
): {
  world: CombatWorld
  rngState: number
  rngHighState: number
  castRngState?: number | undefined
  castRngHighState?: number | undefined
  hydraGroupSeqCounter?: number | undefined
  groundItemIdCounter?: number | undefined
  inventory: Inventory
  quests: QuestLog
  ground: { x: number; y: number; item: Item; groundItemId?: string | undefined }[]
} {
  const inventory = build.inventory(snapshot.inventory.width, snapshot.inventory.height, snapshot.inventory.placed)
  if (typeof snapshot.inventory.gold === 'number') {
    inventory.dedicatedGold = snapshot.inventory.gold
  }
  return {
    // A save carries one player, so the restored world is a single-player one and
    // its player list is rebuilt rather than inherited: spreading a snapshot over a
    // live world would otherwise leave the previous player list in place.
    world: rebindPlayer({ ...snapshot.world, monsters: [...snapshot.world.monsters], players: [], events: [] }),
    rngState: snapshot.rngState >>> 0,
    rngHighState: (snapshot.rngHighState ?? 0) >>> 0,
    ...(snapshot.castRngState !== undefined ? { castRngState: snapshot.castRngState >>> 0 } : {}),
    ...(snapshot.castRngHighState !== undefined ? { castRngHighState: snapshot.castRngHighState >>> 0 } : {}),
    ...(snapshot.hydraGroupSeqCounter !== undefined ? { hydraGroupSeqCounter: snapshot.hydraGroupSeqCounter } : {}),
    ...(snapshot.groundItemIdCounter !== undefined ? { groundItemIdCounter: snapshot.groundItemIdCounter } : {}),
    inventory,
    quests: build.quests(snapshot.quests),
    ground: snapshot.ground.map(entry => ({
      x: entry.x,
      y: entry.y,
      item: entry.item,
      ...(entry.groundItemId !== undefined ? { groundItemId: entry.groundItemId } : {}),
    })),
  }
}

// --- Diablo II character files (.d2s) ---------------------------------------

export {
  D2S_ATTR_BITS,
  D2S_CHECKSUM_OFFSET,
  D2S_MAGIC,
  D2S_VERSION,
  computeD2sChecksum,
  d2sChecksum,
  decodeGfStatSection,
  encodeGfStatSection,
  verifyD2sChecksum,
  writeD2sChecksum,
  type D2sAttributes,
  type D2sAttributesInput,
  type D2sDecodedAttributes,
} from '../../common/formats/d2s.ts'
export * from './d2s-reader.ts'
export * from './d2s-writer.ts'

import {
  readD2sSave113c,
  type D2sCharacterData,
  type D2sCharacterSave,
  type D2sDecodedCharacterSave,
} from './d2s-reader.ts'
import { writeD2sSave113c } from './d2s-writer.ts'

export interface CharacterSaveStore {
  save(name: string, bytes: Uint8Array): void
  saveBytes?(name: string, bytes: Uint8Array): void
  load(name: string): Uint8Array | null
  loadBytes?(name: string): Uint8Array | null
  list(): string[]
  delete(name: string): boolean
}

export class InMemoryCharacterSaveStore implements CharacterSaveStore {
  private readonly files = new Map<string, { readonly name: string; readonly bytes: Uint8Array }>()

  save(name: string, bytes: Uint8Array): void {
    const key = name.trim().toLowerCase()
    this.files.set(key, { name: name.trim(), bytes: new Uint8Array(bytes) })
  }

  saveBytes(name: string, bytes: Uint8Array): void {
    this.save(name, bytes)
  }

  saveCharacter(
    nameOrSave: string | D2sCharacterSave | D2sCharacterData,
    maybeSave?: D2sCharacterSave | D2sCharacterData | Uint8Array,
  ): Uint8Array {
    if (typeof nameOrSave === 'string') {
      if (maybeSave instanceof Uint8Array) {
        this.save(nameOrSave, maybeSave)
        return maybeSave
      }
      const bytes = writeD2sSave113c(maybeSave!)
      this.save(nameOrSave, bytes)
      return bytes
    }
    const bytes = writeD2sSave113c(nameOrSave)
    this.save(nameOrSave.name, bytes)
    return bytes
  }

  load(name: string): Uint8Array | null {
    const entry = this.files.get(name.trim().toLowerCase())
    return entry ? new Uint8Array(entry.bytes) : null
  }

  loadBytes(name: string): Uint8Array | null {
    return this.load(name)
  }

  loadCharacter(name: string, _tables?: unknown): D2sDecodedCharacterSave | null {
    const bytes = this.load(name)
    return bytes ? readD2sSave113c(bytes) : null
  }

  list(): string[] {
    return Array.from(this.files.values(), (e) => e.name)
  }

  listNames(): string[] {
    return this.list()
  }

  has(name: string): boolean {
    return this.files.has(name.trim().toLowerCase())
  }

  delete(name: string): boolean {
    return this.files.delete(name.trim().toLowerCase())
  }
}

export {
  InMemoryCharacterSaveStore as InMemoryD2sCharacterStore,
  InMemoryCharacterSaveStore as D2sCharacterStoreImpl,
  InMemoryCharacterSaveStore as D2sCharacterStore,
}


