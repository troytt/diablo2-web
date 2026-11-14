/**
 * The global level connectivity graph.
 *
 * Diablo II's world is not stored anywhere as a graph. `Levels.txt` carries
 * `Vis0..7` (the destination level reachable through warp slot N) and `Warp0..7`
 * (the `LvlWarp.txt` row describing that slot's tile and hitbox), and the naive
 * reading is that those two columns *are* the world map. They are not, and the
 * gap is the single most expensive thing to discover here:
 *
 * - **`Act 1 - Town` has every `Vis` at 0 and every `Warp` at -1.** So does
 *   `Act 5 - Town`, and so do `Act 5 - Siege 1` and both Act 5 barricades.
 *   `Act 1 - Wilderness 1` (the Blood Moor) points only at `Act 1 - Cave 1`.
 * - Build the graph from `Vis`/`Warp` alone and you get a world where every
 *   cave, tomb and crypt is reachable but **no two outdoor zones connect** —
 *   you can enter the Den of Evil but you can never walk from the Blood Moor to
 *   the Cold Plains, and you can never leave town at all.
 *
 * The reason is that outdoor neighbours are not warps. Blizzard's outdoor DRLG
 * lays sibling levels out in one per-act coordinate space and the player walks
 * across the seam; the giveaway in the data is `OffsetX/OffsetY = -1`, a
 * sentinel meaning "the outdoor DRLG computes my origin at runtime", which is
 * set on exactly the levels that are stitched together (1, 2, 5, 6, 7, 17, the
 * Act 2 desert, the Act 3 jungle, the Act 4 mesas, the Act 5 barricades) while
 * self-contained dungeons get static parking slots 300 apart. That adjacency
 * lives in `D2Common.dll`, not in any table, so it has to be restated here.
 *
 * This module therefore merges four sources:
 *
 * 1. `Vis0..7` / `Warp0..7` — 236 populated slots collapsing to 187 unique
 *    ordered pairs, because one logical warp occupies several slots (a cave
 *    mouth has four, one per orientation). Slots whose `Warp` is -1 but whose
 *    `Vis` is set are *not* warps: they are openings you walk through inside a
 *    preset, and they are classified as {@link LinkKind} `seamless`.
 * 2. {@link SEAMLESS_ADJACENCY} — the outdoor stitching `Levels.txt` omits.
 * 3. {@link PORTAL_LINKS} — quest portals and act transitions, which are not in
 *    any table either; their destinations are recognisable by `Position = 1`.
 * 4. `Waypoint` — 39 waypoints, ids 0..38, contiguous.
 *
 * Everything is keyed on `Levels.txt` `Id`. **Never key on `Name`**: the
 * internal names are offset from the in-game ones by one, so `Act 1 - Cave 1`
 * is the Den of Evil (a single level with no descent), `Act 1 - Cave 2` is what
 * the player calls Cave Level 1, and `Act 1 - Cave 2 Treasure` is Cave Level 2.
 *
 * No `Math.random`, no Node builtins: this runs in the browser bundle and at
 * pack time, and every random choice is drawn from a caller-supplied
 * {@link Rng} so the same seed replays the same world.
 */
import type { D2Table } from './acts.ts'

/** How the player gets from one level to the next. */
export type LinkKind =
  /** A clickable stair, cave mouth or door described by an `LvlWarp.txt` row. */
  | 'warp'
  /** An opening the player walks through with no click and no loading screen. */
  | 'seamless'
  /** A quest portal or act transition, hard-coded because no table has it. */
  | 'portal'

/** Which edge of a level's rectangle an opening sits on. */
export type Side = 'north' | 'east' | 'south' | 'west'

/** The four sides, in a fixed order so iteration is deterministic. */
export const SIDES: readonly Side[] = ['north', 'east', 'south', 'west']

/**
 * The side facing a given side across a shared seam.
 *
 * Two levels abut only if the opening the player leaves through and the opening
 * they arrive at are on opposite edges: walk off A's east edge and you step onto
 * B's west edge.
 *
 * @param side - the side being left.
 * @returns the side being entered.
 */
export function oppositeSide(side: Side): Side {
  switch (side) {
    case 'north':
      return 'south'
    case 'south':
      return 'north'
    case 'east':
      return 'west'
    case 'west':
      return 'east'
  }
}

/** One row of `Levels.txt`, reduced to the columns connectivity needs. */
export interface LevelRow {
  /** `Levels.txt` `Id`. */
  readonly id: number
  /** `Act`, 0-based as stored. */
  readonly act: number
  /** `Name`, the internal name — see the module note about the off-by-one. */
  readonly name: string
  /** `DrlgType`: 1 preset, 2 outdoor, 3 maze (as this codebase reads it). */
  readonly drlgType: number
  /** `SizeX`/`SizeY` in cells; -1 means the generator decides at runtime. */
  readonly sizeX: number
  readonly sizeY: number
  /** `Waypoint`, 0..38, or 255 when the level has none. */
  readonly waypoint: number
  /** `Position`; 1 marks a level that is the destination of a portal. */
  readonly position: number
  /** `Portal`. */
  readonly portal: number
  /** `OffsetX`/`OffsetY`; -1 is the "outdoor DRLG places me" sentinel. */
  readonly offsetX: number
  readonly offsetY: number
  /** `Depend`; non-zero on exactly `27` (on 26) and `33` (on 32). */
  readonly depend: number
  /** `Vis0..7`, 0 meaning the slot is unused. */
  readonly vis: readonly number[]
  /** `Warp0..7`, -1 meaning the slot has no warp tile. */
  readonly warp: readonly number[]
}

/** A directed connection between two levels. */
export interface WorldEdge {
  /** Source level id. */
  readonly from: number
  /** Destination level id. */
  readonly to: number
  /** How the crossing works. */
  readonly kind: LinkKind
  /**
   * The `LvlWarp.txt` row ids that describe this crossing.
   *
   * Several, not one, because a cave mouth occupies four `Vis`/`Warp` slots —
   * one per orientation — and which one is used depends on how the generator
   * ends up facing the entrance.
   */
  readonly warps: readonly number[]
  /**
   * The `Warp0..7` slot indices this crossing occupies, in the same order as
   * {@link warps}.
   *
   * This is the join between the table and the artwork. A DS1 records a
   * staircase as a "special" tile — wall type 10 or 11 — whose `style` field is
   * the slot number, so a tile with `style` 3 is the staircase for whatever
   * `Vis3` points at. Without the slot there is no way to tell which of a
   * level's staircases leads where, and the packer has to guess from geometry.
   */
  readonly warpSlots: readonly number[]
  /** Which edge of `from` the opening sits on; only set for `seamless`. */
  readonly sideFrom: Side | null
  /** Which edge of `to` the opening sits on; always opposite `sideFrom`. */
  readonly sideTo: Side | null
  /** Where this edge came from, for diagnostics. */
  readonly source: 'vis' | 'adjacency' | 'portal'
}

/** The assembled world. */
export interface WorldGraph {
  /** Every level with `Id > 0`, keyed by id. */
  readonly levels: ReadonlyMap<number, LevelRow>
  /** Every directed edge. */
  readonly edges: readonly WorldEdge[]
  /** Waypoint id to the level that hosts it. */
  readonly waypoints: ReadonlyMap<number, number>
}

/**
 * Outdoor levels that walk into each other with no warp and no loading screen.
 *
 * Absent from `Levels.txt` in its entirety — see the module note. Listed as
 * unordered pairs; {@link buildWorldGraph} emits both directions.
 *
 * Deliberately **not** in this list, because each is a real warp that the data
 * does describe and mistaking it for adjacency would produce a door onto
 * nothing:
 *
 * - `6 -> 20` the Forgotten Tower (`Vis2 = 20`, `Warp2 = 10`): an 8x8 preset
 *   building standing beside one of the Black Marsh's roads, with a door.
 * - `106 -> 107` City of the Damned to River of Flame (`Vis1 = 107`,
 *   `Warp1 = 69`).
 * - `112 -> 113` Arreat Plateau to Crystalline Passage (`Warp2 = 71`).
 */
export const SEAMLESS_ADJACENCY: readonly (readonly [number, number])[] = [
  // Act 1. 1 Rogue Encampment, 2 Blood Moor, 3 Cold Plains, 4 Stony Field,
  // 5 Dark Wood, 6 Black Marsh, 7 Tamoe Highland, 17 Burial Grounds,
  // 26 Monastery Gate.
  //
  // D2 lays Act 1 out as two separate groups (DrlgOutPlace.cpp
  // gAct1WildernessDrlgLink @ D2Common.0x6FDCFE40: 4, 3, 2, 1, 17 around the
  // Stony Field at its Levels.txt offset 1000,1000; gAct1MonasteryDrlgLink @
  // 0x6FDCFF30: 26, 7, 6, 5 around the Monastery Gate at 3000,1000). The Stony
  // Field and the Dark Wood never touch: they are joined only through the
  // Underground Passage (level 10, a warp on both sides).
  [1, 2],
  [2, 3],
  [3, 4],
  [3, 17],
  [5, 6],
  [6, 7],
  [7, 26],

  // Act 2. 40 Lut Gholein, 41 Rocky Waste, 42 Dry Hills, 43 Far Oasis,
  // 44 Lost City, 45 Valley of Snakes.
  //
  // 46 (the Canyon of the Magi) is adjacent to nothing: it is reached only by
  // waypoint 17 or by the Summoner's portal from the Arcane Sanctuary.
  [40, 41],
  [41, 42],
  [42, 43],
  [43, 44],
  [44, 45],

  // Act 3. 75 Kurast Docks, 76 Spider Forest, 77 Great Marsh,
  // 78 Flayer Jungle, 79 Lower Kurast, 80 Kurast Bazaar, 81 Upper Kurast,
  // 82 Kurast Causeway, 83 Travincal.
  //
  // DRLGOUTPLACE_InitAct3OutdoorLevel (D2Common.0x6FDD0130) attaches Flayer
  // Jungle (78) either to Great Marsh (77, linear: 75->76->77->78->79) or
  // directly to Spider Forest (76, branching: 76->77 dead-end and 76->78->79).
  [75, 76],
  [76, 77],
  [76, 78],
  [77, 78],
  [78, 79],
  [79, 80],
  [80, 81],
  [81, 82],
  [82, 83],

  // Act 4. 103 Pandemonium Fortress, 104 Outer Steppes, 105 Plains of Despair,
  // 106 City of the Damned.
  [103, 104],
  [104, 105],
  [105, 106],

  // Act 5. 109 Harrogath, 110 Bloody Foothills, 111 Frigid Highlands,
  // 112 Arreat Plateau.
  //
  // 117 (the Frozen Tundra) is an outdoor island: it is entered by warp from
  // inside 115 and leaves by warp to 118, touching no outdoor level.
  [109, 110],
  [110, 111],
  [111, 112],
]

/**
 * Seams involving a preset or maze level whose side is fixed by hand-authored
 * DS1 geometry rather than chosen per seed by the outdoor DRLG placer.
 *
 * Outdoor-to-outdoor DRLG levels (`DrlgType === 3`) report their exact seam
 * sides and spans per seed from `pLevelLink` in `buildDrlgLevelMap`. Preset
 * (`DrlgType === 2`) and maze (`DrlgType === 1`) levels have fixed border
 * openings (with single-seam towns like `TownN1`/`TownE1`/`TownW1` overriding
 * their default side when a variant's border opening sits on another edge).
 *
 * Keyed `"lowId:highId"`; the value is the side belonging to the *lower* id.
 */
export const PRESET_SEAM_SIDES: ReadonlyMap<string, Side> = new Map([
  // Rogue Encampment default gate faces south (TownN1/E1/W1 override via inset 0 scan).
  ['1:2', 'south'],
  // Tamoe Highland (7) is south of Monastery Gate (26, facade1.ds1): 7->26 is north, 26->7 is south.
  ['7:26', 'north'],
  // Courtyard 1 sits 40 cells north of the Monastery Gate (`Depend = 26`).
  ['26:27', 'north'],
  // The Barracks gateway continues north out of the Outer Cloister.
  ['27:28', 'north'],
  // The Cathedral sits 34 cells north of the Inner Cloister (`Depend = 32`).
  ['32:33', 'north'],
  // Lut Gholein default gate faces west (TownN1 overrides via inset 0 scan).
  ['40:41', 'west'],
  // Kurast Docks opens north onto Spider Forest.
  ['75:76', 'north'],
  // Pandemonium Fortress opens east onto Outer Steppes.
  ['103:104', 'east'],
  // River of Flame (107) opens north onto Chaos Sanctuary (108).
  ['107:108', 'north'],
  // Harrogath gate faces west onto Bloody Foothills.
  ['109:110', 'west'],
])

/** A hard-coded portal, stair or act transition. */
export interface PortalLink {
  readonly from: number
  readonly to: number
  /** Why this link exists, for the generated graph's own documentation. */
  readonly note: string
  /** Whether the player can come back the same way. */
  readonly bidirectional: boolean
}

/**
 * Connections that exist in the game but in none of its tables.
 *
 * Quest portals, act transitions and the uber levels. Their destinations are
 * almost all flagged `Position = 1`, which is the closest thing the data has to
 * a "something teleports here" marker, and several of them (`121`, `125`,
 * `126`, `127`, `134`, `135`, `136`) are pointed at by nothing at all — without
 * this list they are unreachable islands.
 */
export const PORTAL_LINKS: readonly PortalLink[] = [
  { from: 4, to: 38, note: 'Cairn Stones open the red portal to Tristram', bidirectional: true },
  { from: 1, to: 39, note: 'Cow level, opened with the Horadric Cube', bidirectional: true },
  { from: 1, to: 40, note: 'Act 1 to Act 2, by caravan', bidirectional: true },
  { from: 40, to: 75, note: 'Act 2 to Act 3, by ship', bidirectional: true },
  { from: 54, to: 74, note: 'Palace Cellar 3 to the Arcane Sanctuary', bidirectional: true },
  { from: 74, to: 46, note: "The Summoner's portal to the Canyon of the Magi", bidirectional: true },
  { from: 66, to: 73, note: "Tal Rasha's true tomb to Duriel's Lair", bidirectional: true },
  { from: 67, to: 73, note: "Tal Rasha's true tomb to Duriel's Lair", bidirectional: true },
  { from: 68, to: 73, note: "Tal Rasha's true tomb to Duriel's Lair", bidirectional: true },
  { from: 69, to: 73, note: "Tal Rasha's true tomb to Duriel's Lair", bidirectional: true },
  { from: 70, to: 73, note: "Tal Rasha's true tomb to Duriel's Lair", bidirectional: true },
  { from: 71, to: 73, note: "Tal Rasha's true tomb to Duriel's Lair", bidirectional: true },
  { from: 72, to: 73, note: "Tal Rasha's true tomb to Duriel's Lair", bidirectional: true },
  { from: 102, to: 103, note: 'Act 3 to Act 4, through the Infernal Gate', bidirectional: true },
  { from: 103, to: 109, note: 'Act 4 to Act 5, by Tyrael', bidirectional: true },
  { from: 109, to: 121, note: "Harrogath to Nihlathak's Temple", bidirectional: true },
  { from: 111, to: 125, note: 'Frigid Highlands to Abaddon', bidirectional: true },
  { from: 112, to: 126, note: 'Arreat Plateau to the Pit of Acheron', bidirectional: true },
  { from: 117, to: 127, note: 'Frozen Tundra to the Infernal Pit', bidirectional: true },
  { from: 109, to: 133, note: 'Pandemonium Run 1', bidirectional: true },
  { from: 109, to: 134, note: 'Pandemonium Run 2', bidirectional: true },
  { from: 109, to: 135, note: 'Pandemonium Run 3', bidirectional: true },
  { from: 109, to: 136, note: 'Uber Tristram', bidirectional: true },
]

/**
 * `Vis` edges to discard.
 *
 * `133 Act 5 - Pandemonium 1` claims `Vis0 = 17 Act 1 - Graveyard` with
 * `Warp0 = 8`, and level 17 does not point back. Row 133 is `LevelType 4`, the
 * Act 1 crypt type, and its whole `Vis`/`Warp` block is byte-identical to row
 * `18 Act 1 - Crypt 1 A` — it is a copy-paste artifact from whoever authored
 * the expansion rows, not a wormhole from Hell to the Burial Grounds. It is the
 * only asymmetric `Vis` edge in the entire table.
 */
export const DROPPED_VIS_EDGES: readonly (readonly [number, number])[] = [[133, 17]]

/**
 * Levels that are deliberately unreachable on foot.
 *
 * Both are real: the Canyon of the Magi is entered only by waypoint or by the
 * Summoner's portal, and the Frozen Tundra hangs off two warps in the middle of
 * the Act 5 ice caves. Connectivity checks must not treat them as islands.
 */
export const OUTDOOR_ISLANDS: readonly number[] = [46, 117]

/** The value `Levels.txt` uses for "this level has no waypoint". */
const NO_WAYPOINT = 255

/**
 * Read a column by name, returning a number.
 *
 * Local rather than imported so this module keeps no runtime dependency on the
 * DS1/DT1/PL2 decoders that `acts.ts` pulls in.
 *
 * @param table - the table.
 * @param row - the row.
 * @param column - the column name.
 * @param fallback - value for a missing or unparsable cell.
 * @returns the number.
 */
function num(table: D2Table, row: readonly string[], column: string, fallback = 0): number {
  const index = table.header.indexOf(column)
  if (index === -1) return fallback
  const raw = row[index]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

/**
 * Read a column by name, returning a string.
 *
 * @param table - the table.
 * @param row - the row.
 * @param column - the column name.
 * @returns the cell, or an empty string.
 */
function str(table: D2Table, row: readonly string[], column: string): string {
  const index = table.header.indexOf(column)
  return index === -1 ? '' : (row[index] ?? '')
}

/**
 * Reduce `Levels.txt` to the rows and columns connectivity needs.
 *
 * Row `Id = 0` (`Null`) is dropped: it is a placeholder, and leaving it in makes
 * every unused `Vis` slot look like an edge to it.
 *
 * @param levels - the parsed `Levels.txt`.
 * @returns one entry per real level, in table order.
 */
export function parseLevelRows(levels: D2Table): LevelRow[] {
  const out: LevelRow[] = []
  for (const row of levels.rows) {
    const id = num(levels, row, 'Id', -1)
    if (id <= 0) continue
    const vis: number[] = []
    const warp: number[] = []
    for (let slot = 0; slot < 8; slot += 1) {
      vis.push(num(levels, row, `Vis${String(slot)}`, 0))
      warp.push(num(levels, row, `Warp${String(slot)}`, -1))
    }
    out.push({
      id,
      act: num(levels, row, 'Act', 0),
      name: str(levels, row, 'Name'),
      drlgType: num(levels, row, 'DrlgType', 0),
      sizeX: num(levels, row, 'SizeX', -1),
      sizeY: num(levels, row, 'SizeY', -1),
      waypoint: num(levels, row, 'Waypoint', NO_WAYPOINT),
      position: num(levels, row, 'Position', 0),
      portal: num(levels, row, 'Portal', 0),
      offsetX: num(levels, row, 'OffsetX', -1),
      offsetY: num(levels, row, 'OffsetY', -1),
      depend: num(levels, row, 'Depend', 0),
      vis,
      warp,
    })
  }
  return out
}

/** Key for an unordered level pair. */
function pairKey(a: number, b: number): string {
  return a < b ? `${String(a)}:${String(b)}` : `${String(b)}:${String(a)}`
}

/** Key for an ordered level pair. */
function edgeKey(from: number, to: number): string {
  return `${String(from)}->${String(to)}`
}

/**
 * Assemble the world graph.
 *
 * The three sources are merged in priority order — adjacency and portals win
 * over `Vis`, because where both describe the same pair the table's version is
 * the coarser one — and every edge is emitted in both directions.
 *
 * @param rows - the output of {@link parseLevelRows}.
 * @returns the graph, with `sideFrom`/`sideTo` populated for fixed preset/maze
 *   seams ({@link PRESET_SEAM_SIDES}) and null on outdoor DRLG seams (which
 *   come from the DRLG level link per seed).
 */
export function buildWorldGraph(rows: readonly LevelRow[]): WorldGraph {
  const levels = new Map<number, LevelRow>()
  for (const row of rows) levels.set(row.id, row)

  const dropped = new Set<string>()
  for (const [from, to] of DROPPED_VIS_EDGES) dropped.add(edgeKey(from, to))

  /** Ordered pair -> the warp ids seen for it, in slot order. */
  const visWarps = new Map<string, number[]>()
  /** Ordered pair -> the `Warp0..7` slots seen for it, parallel to `visWarps`. */
  const visSlots = new Map<string, number[]>()
  /** Ordered pair -> true when at least one slot had no warp tile. */
  const visWalkThrough = new Map<string, boolean>()

  for (const row of rows) {
    for (let slot = 0; slot < 8; slot += 1) {
      const destination = row.vis[slot] ?? 0
      if (destination === 0) continue
      if (!levels.has(destination)) continue
      const key = edgeKey(row.id, destination)
      if (dropped.has(key)) continue
      const warpId = row.warp[slot] ?? -1
      const seen = visWarps.get(key)
      if (seen === undefined) visWarps.set(key, warpId === -1 ? [] : [warpId])
      else if (warpId !== -1 && !seen.includes(warpId)) seen.push(warpId)
      if (warpId !== -1) {
        const slots = visSlots.get(key)
        if (slots === undefined) visSlots.set(key, [slot])
        else if (!slots.includes(slot)) slots.push(slot)
      }
      // A slot with a destination but no warp tile is an opening the player
      // walks through: the monastery gate, the barracks gateway, the cathedral
      // steps, the Chaos Sanctuary entrance. No click, no loading screen.
      if (warpId === -1) visWalkThrough.set(key, true)
    }
  }

  const adjacency = new Set<string>()
  for (const [a, b] of SEAMLESS_ADJACENCY) adjacency.add(pairKey(a, b))

  const edges: WorldEdge[] = []
  const emitted = new Set<string>()

  /** Record one direction, first writer wins. */
  const emit = (
    from: number,
    to: number,
    kind: LinkKind,
    warps: readonly number[],
    source: WorldEdge['source'],
    warpSlots: readonly number[] = [],
  ): void => {
    const key = edgeKey(from, to)
    if (emitted.has(key)) return
    emitted.add(key)
    let sideFrom: Side | null = null
    let sideTo: Side | null = null
    if (kind === 'seamless') {
      const presetSide = PRESET_SEAM_SIDES.get(pairKey(from, to))
      if (presetSide !== undefined) {
        sideFrom = from < to ? presetSide : oppositeSide(presetSide)
        sideTo = oppositeSide(sideFrom)
      }
    }
    edges.push({ from, to, kind, warps, warpSlots, sideFrom, sideTo, source })
  }

  // 1. Hard-coded outdoor stitching. Highest priority: where a pair is both
  //    adjacent and listed in `Vis` the adjacency is the truth.
  for (const [a, b] of SEAMLESS_ADJACENCY) {
    if (!levels.has(a) || !levels.has(b)) continue
    emit(a, b, 'seamless', [], 'adjacency')
    emit(b, a, 'seamless', [], 'adjacency')
  }

  // 2. Hard-coded portals.
  for (const link of PORTAL_LINKS) {
    if (!levels.has(link.from) || !levels.has(link.to)) continue
    if (!adjacency.has(pairKey(link.from, link.to))) {
      emit(link.from, link.to, 'portal', [], 'portal')
      if (link.bidirectional) emit(link.to, link.from, 'portal', [], 'portal')
    }
  }

  // 3. Whatever `Vis` describes that the first two did not.
  for (const [key, warps] of visWarps) {
    const [fromText, toText] = key.split('->')
    const from = Number(fromText)
    const to = Number(toText)
    const kind: LinkKind = visWalkThrough.get(key) === true && warps.length === 0 ? 'seamless' : 'warp'
    emit(from, to, kind, warps, 'vis', visSlots.get(key) ?? [])
  }

  const waypoints = new Map<number, number>()
  for (const row of rows) {
    if (row.waypoint === NO_WAYPOINT) continue
    waypoints.set(row.waypoint, row.id)
  }

  return { levels, edges, waypoints }
}

/**
 * Every undirected seam that needs an edge of the map assigned to it.
 *
 * @param graph - the graph.
 * @returns the pairs, low id first, in ascending order so the result does not
 *   depend on `Map` iteration order.
 */
export function seamlessPairs(graph: WorldGraph): (readonly [number, number])[] {
  const seen = new Set<string>()
  const pairs: (readonly [number, number])[] = []
  for (const edge of graph.edges) {
    if (edge.kind !== 'seamless') continue
    const key = pairKey(edge.from, edge.to)
    if (seen.has(key)) continue
    seen.add(key)
    pairs.push(edge.from < edge.to ? [edge.from, edge.to] : [edge.to, edge.from])
  }
  pairs.sort((left, right) => left[0] - right[0] || left[1] - right[1])
  return pairs
}

/**
 * The edges leaving one level.
 *
 * @param graph - the graph.
 * @param levelId - the level.
 * @returns its outgoing edges, in graph order.
 */
export function edgesFrom(graph: WorldGraph, levelId: number): WorldEdge[] {
  return graph.edges.filter(edge => edge.from === levelId)
}

/**
 * Every level reachable from a starting point.
 *
 * @param graph - the graph.
 * @param start - the level to start from.
 * @returns the reachable set, including `start`.
 */
export function reachableFrom(graph: WorldGraph, start: number): Set<number> {
  const outgoing = new Map<number, number[]>()
  for (const edge of graph.edges) {
    const list = outgoing.get(edge.from)
    if (list === undefined) outgoing.set(edge.from, [edge.to])
    else list.push(edge.to)
  }
  const seen = new Set<number>([start])
  const queue = [start]
  while (queue.length > 0) {
    const at = queue.shift()
    if (at === undefined) break
    for (const next of outgoing.get(at) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return seen
}

/* ------------------------------------------------------------------------- *
 * Warp geometry
 * ------------------------------------------------------------------------- */

/**
 * One row of `LvlWarp.txt`: where a warp's hitbox is and where it puts you.
 *
 * All the pixel values are relative to the bottom corner of the anchor
 * sub-tile, and all of them are negative or zero, because the hitbox is drawn
 * up and to the left of the tile the warp is anchored on.
 */
export interface WarpGeometry {
  /** `Id`, as referenced by `Levels.txt` `Warp0..7`. */
  readonly id: number
  /** `Direction`: `b` for every classic row, `l`/`r` for the Act 5 pairs. */
  readonly direction: string
  /** `Name`, for diagnostics. */
  readonly name: string
  /** Top-left of the mouse hitbox, in pixels; always <= 0. */
  readonly selectX: number
  readonly selectY: number
  /** Hitbox size in pixels. Zero on both axes means there is nothing to click. */
  readonly selectDX: number
  readonly selectDY: number
  /**
   * Where the player materialises, in sub-tiles relative to the anchor tile.
   *
   * Frequently negative, which is deliberate rather than a sign error: landing
   * *on* the warp tile would immediately re-trigger it, so the arrival point is
   * pushed into the tile before the anchor.
   */
  readonly offsetX: number
  readonly offsetY: number
  /**
   * How far the player is walked automatically after arriving, in sub-tiles.
   *
   * Only ever -5, -1, 0, 2, 3 or 5; plus or minus five is one whole tile. This
   * is what carries you clear of a doorway so the level behind you is not still
   * under your feet.
   */
  readonly exitWalkX: number
  readonly exitWalkY: number
  /** Whether the tile has a highlight-on-hover variant. */
  readonly litVersion: number
  /**
   * Value added to the DT1 tile sub-index to reach the lit variant.
   *
   * Two everywhere except ids 71 and 72 — the Act 5 barricades — where it is
   * four.
   */
  readonly tiles: number
}

/** Key for a warp row. */
function warpKey(id: number, direction: string): string {
  return `${String(id)}:${direction}`
}

/**
 * Index `LvlWarp.txt` by `(Id, Direction)`.
 *
 * Keying on `Id` alone silently drops half the Act 5 barricade warps: ids 71,
 * 73, 74, 81 and 82 each appear twice, once facing left and once facing right.
 * The `Expansion` separator row has no numeric id and is skipped.
 *
 * @param lvlwarp - the parsed `LvlWarp.txt`.
 * @returns the rows, keyed `"id:direction"`.
 */
export function parseWarpGeometry(lvlwarp: D2Table): Map<string, WarpGeometry> {
  const out = new Map<string, WarpGeometry>()
  for (const row of lvlwarp.rows) {
    const idText = str(lvlwarp, row, 'Id')
    if (idText === '') continue
    const id = Number(idText)
    if (!Number.isFinite(id)) continue
    const direction = str(lvlwarp, row, 'Direction') || 'b'
    out.set(warpKey(id, direction), {
      id,
      direction,
      name: str(lvlwarp, row, 'Name'),
      selectX: num(lvlwarp, row, 'SelectX'),
      selectY: num(lvlwarp, row, 'SelectY'),
      selectDX: num(lvlwarp, row, 'SelectDX'),
      selectDY: num(lvlwarp, row, 'SelectDY'),
      offsetX: num(lvlwarp, row, 'OffsetX'),
      offsetY: num(lvlwarp, row, 'OffsetY'),
      exitWalkX: num(lvlwarp, row, 'ExitWalkX'),
      exitWalkY: num(lvlwarp, row, 'ExitWalkY'),
      litVersion: num(lvlwarp, row, 'LitVersion'),
      tiles: num(lvlwarp, row, 'Tiles', 2),
    })
  }
  return out
}

/**
 * Look up a warp, preferring an exact direction and falling back to any.
 *
 * @param geometry - the output of {@link parseWarpGeometry}.
 * @param id - the `LvlWarp.txt` id.
 * @param direction - the wanted direction, if the caller has one.
 * @returns the row, or undefined.
 */
export function findWarpGeometry(
  geometry: ReadonlyMap<string, WarpGeometry>,
  id: number,
  direction?: string,
): WarpGeometry | undefined {
  if (direction !== undefined) {
    const exact = geometry.get(warpKey(id, direction))
    if (exact !== undefined) return exact
  }
  return (
    geometry.get(warpKey(id, 'b')) ??
    geometry.get(warpKey(id, 'l')) ??
    geometry.get(warpKey(id, 'r'))
  )
}

/**
 * Whether a warp has a hitbox the player can click.
 *
 * Ids 19, 50, 60, 61, 64, 79 and 80 have a zero-area hitbox. That is not
 * missing data: those crossings are walked into, or are driven by an object
 * rather than by a tile, so there is nothing for the cursor to find.
 *
 * @param warp - the geometry row.
 * @returns true when the warp is clickable.
 */
export function isClickableWarp(warp: WarpGeometry): boolean {
  return warp.selectDX > 0 && warp.selectDY > 0
}

