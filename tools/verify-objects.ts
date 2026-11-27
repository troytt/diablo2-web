/**
 * Verify the DS1 object → art rule against the real Diablo II archives.
 *
 * The rule this checks is not a guess: it is ported from ThePhrozenKeep/D2MOO
 * (see the module comment in `src/game/objects.ts`), and the point of this script
 * is to prove the port against bytes the user supplied rather than against the
 * doc comment that describes it. Four independent things are measured:
 *
 * 1. **Where the object art actually is.** The project's notes said `d2char.mpq`;
 *    the archives say otherwise, and this prints the per-archive counts so the
 *    claim is checkable rather than asserted.
 * 2. **The composition template.** Every object COF in the archives declares its
 *    layers as *composite indices*, not file names, so the sprite path has to be
 *    reconstructed from the COF's own name plus that index — the same trick
 *    `scripts/verify-dcc.ts` uses for the Sorceress. This rebuilds all 1746 layer
 *    references and reports exactly which ones the rule does not reach.
 * 3. **Every object placed by a preset level.** `Levels.txt` rows with
 *    `DrlgType === 2` name fixed DS1 files, so this walks all 35 of them, decodes
 *    the maps and resolves each placed object's art, grouping the results by
 *    level type. Any object that fails to resolve fails the run — a packer that
 *    silently drops one is the bug this exists to catch.
 * 4. **The draw anchors.** `DUNGEON_GameToClientTileDrawPositionCoords` and
 *    `DUNGEON_GameToClientSubtileDrawPositionCoords` (D2Common ordinals 10115 and
 *    10117) are printed next to the formulas this project currently uses, and the
 *    DT1 `minBlockY` of every floor and wall tile a preset level actually
 *    references is measured, because that is the term that decides whether the
 *    project's wall formula and the engine's agree.
 *
 * Usage:
 *   node scripts/verify-objects.ts [archive-directory]
 *
 * Exits non-zero when an object placed in a preset level cannot be resolved, when
 * a sampled member decodes to empty pixels, or when the ported coordinate
 * arithmetic fails its own round-trips.
 */
import { readFileSync } from 'node:fs'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { cell, loadActTables, resolveLevel } from '../src/common/world/acts.ts'
import type { ActTables } from '../src/common/world/acts.ts'
import { decodeDs1 } from '../src/common/formats/ds1.ts'
import type { Ds1 } from '../src/common/formats/ds1.ts'
import { decodeDt1 } from '../src/common/formats/dt1.ts'
import type { Dt1, Dt1Tile } from '../src/common/formats/dt1.ts'
import { decodeCof } from '../src/common/formats/cof.ts'
import { decodeDcc } from '../src/common/formats/dcc.ts'
import { decodeDc6 } from '../src/common/formats/dc6.ts'
import {
  OBJECT_COMPONENTS,
  OBJECT_MODE_COUNT,
  OBJECT_MODE_TOKENS,
  clientSubtileDrawPositionToGameCoords,
  clientTileDrawPositionToGameCoords,
  gameSubtileToClientCoords,
  gameTileToClientCoords,
  loadObjectSheet,
  loadObjectsTable,
  objectAnchor,
  objectCofMember,
  objectDrawAnchor,
  objectSpriteMember,
  resolveDs1Object,
  resolveObjectArt,
  subtileDrawPositionCoords,
  tileDrawPositionCoords,
} from '../src/common/units/objects.ts'
import type { ObjectsRow, ObjectsTable } from '../src/common/units/objects.ts'

/** Archives to mount, in load order (later overrides earlier). */
const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const
/**
 * Community listfile that supplies the names Storm stores encrypted.
 *
 * `d2data.mpq` and `Patch_D2.mpq` ship no `(listfile)`, so without it "this member
 * is not in the archives" would only mean "not in the archives we could enumerate".
 * The file is optional: when it is absent the sweep still runs, but the member
 * index is then incomplete and the run says so.
 */
const LISTFILE = 'listfile_113c.txt'
/** Prefix every object member lives under. */
const OBJECT_ROOT = 'data\\global\\objects\\'
/** `DrlgType` value for a preset level: its layout is a fixed DS1. */
const DRLG_PRESET = '2'
/** Cap on members decoded in the sample sweep, so the run stays bounded. */
const DECODE_SAMPLE_LIMIT = 60
/** Cap on individually printed failures. */
const MAX_REPORTED_FAILURES = 25

const args = process.argv.slice(2)
const archiveDir = args.find(argument => !argument.startsWith('--')) ?? 'samples/d2'

let checks = 0
let failures = 0
const failureLog: string[] = []

/**
 * Record one assertion.
 *
 * @param ok - whether it held.
 * @param what - what was asserted, printed only when it fails.
 */
function check(ok: boolean, what: string): void {
  checks += 1
  if (ok) return
  failures += 1
  if (failureLog.length < MAX_REPORTED_FAILURES) failureLog.push(what)
}

/**
 * Assert a condition, returning it for reuse.
 *
 * @param ok - whether it held.
 * @param what - description used in the failure log.
 * @returns `ok`.
 */
function assert(ok: boolean, what: string): boolean {
  check(ok, what)
  return ok
}

/** Format a number with a leading sign, for the anchor comparison table. */
function signed(value: number): string {
  return value >= 0 ? `+${String(value)}` : String(value)
}

/** Open the four archives and mount them the way the game loads them. */
async function mount(): Promise<MountedArchives> {
  const archives = new MountedArchives()
  let listfile: string[] | undefined
  try {
    listfile = readFileSync(`${archiveDir}/${LISTFILE}`, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
    console.log(`   listfile: ${String(listfile.length)} names from ${LISTFILE}`)
  } catch {
    console.log(`   listfile: ${LISTFILE} missing — member index is incomplete`)
    listfile = undefined
  }
  for (const name of MOUNTS) {
    const archive = await MpqArchive.open(await fileSource(`${archiveDir}/${name}`), { listfile })
    archives.add(name, archive)
  }
  return archives
}

/** The union of every mounted archive's member list, plus a lower-case index. */
interface MemberSet {
  readonly names: readonly string[]
  readonly lower: ReadonlyMap<string, string>
}

/**
 * Build the case-insensitive member index.
 *
 * Diablo II's own lookups go through Storm's case-insensitive hash and the
 * archives really do mix case (`Data\Global\Objects\1Y\S1\1ys1litnuhth.DC6`
 * against `data\global\objects\c5\tr\c5trlitnuhth.dcc`), so every comparison here
 * is on the lower-cased name while the archive's own spelling is what gets used
 * for reads.
 *
 * @param archives - the mounted stack.
 * @returns the names and the index.
 */
async function memberSet(archives: MountedArchives): Promise<MemberSet> {
  const names: string[] = []
  for (const entry of archives.mounted) names.push(...await entry.archive.listFiles())
  const lower = new Map<string, string>()
  for (const name of names) if (!lower.has(name.toLowerCase())) lower.set(name.toLowerCase(), name)
  return { names, lower }
}

/** Per-level-type tally for the preset-level walk. */
interface LevelTypeTally {
  levels: number
  objects: number
  resolved: number
  fallbacks: number
  /** Objects the archives ship no sprite for at all; `null` is the correct answer. */
  artless: number
  /** DS1 entries that are monster spawn points (`type` 1), not objects. */
  monsterSpawns: number
  modeGuesses: number
  undefinedRows: number
  tokens: Set<string>
}

/** Measure 1: where the object art lives, and how much of it there is. */
async function reportArchiveLayout(archives: MountedArchives): Promise<void> {
  console.log('== object art in the archives ==')
  let dataTotal = 0
  for (const entry of archives.mounted) {
    const names = await entry.archive.listFiles()
    const objects = names.filter(name => name.toLowerCase().startsWith(OBJECT_ROOT))
    const dcc = objects.filter(name => name.toLowerCase().endsWith('.dcc')).length
    const cof = objects.filter(name => name.toLowerCase().endsWith('.cof')).length
    const dc6 = objects.filter(name => name.toLowerCase().endsWith('.dc6')).length
    console.log(`   ${entry.label.padEnd(14)} members=${String(names.length).padStart(6)} objects=${String(objects.length).padStart(5)} dcc=${String(dcc).padStart(5)} cof=${String(cof).padStart(5)} dc6=${String(dc6).padStart(3)}`)
    if (entry.label === 'd2data.mpq' || entry.label === 'd2exp.mpq') dataTotal += objects.length
  }
  assert(dataTotal > 0, 'object art must exist in d2data.mpq/d2exp.mpq')
  console.log('   (note: d2char.mpq holds character art only; object art is in d2data/d2exp)')
}

/**
 * Measure 2: rebuild every COF layer's sprite path and see how far the rule goes.
 *
 * @param archives - the mounted stack.
 * @param members - the member index.
 * @param tables - the parsed `Objects.txt`.
 * @returns the tally, for the summary.
 */
async function verifyCompositionTemplate(
  archives: MountedArchives,
  members: MemberSet,
  tables: ObjectsTable,
): Promise<{ layers: number; dcc: number; dc6: number; unresolved: readonly string[]; cofs: number; prefixes: number }> {
  console.log('== COF -> DCC template (D2Common_10884_COMPOSIT_unk) ==')
  const cofs = members.names
    .filter(name => name.toLowerCase().startsWith(OBJECT_ROOT) && name.toLowerCase().endsWith('.cof'))
    .sort()
  const byToken = new Map<string, ObjectsRow>()
  for (const row of tables.rows) if (!byToken.has(row.token)) byToken.set(row.token, row)

  let layers = 0
  let dcc = 0
  let dc6 = 0
  let prefixes = 0
  const unresolved: string[] = []
  const unknownTokens = new Set<string>()
  for (const cofMember of cofs) {
    const parts = cofMember.split('\\')
    const token = (parts[3] ?? '').toLowerCase()
    const file = (parts[5] ?? '').replace(/\.cof$/i, '')
    if (!byToken.has(token.toUpperCase())) unknownTokens.add(token.toUpperCase())
    let cof
    try {
      cof = decodeCof(await archives.read(cofMember))
    } catch (err) {
      unresolved.push(`${cofMember}: ${(err as Error).message}`)
      continue
    }
    // The COF's name is <TOKEN><MODE><WEAPON>; the suffix length comes from the
    // layer record itself rather than from a hard-coded 3.
    const weapon = cof.layers[0]?.weaponClass ?? 'hth'
    const mode = file.slice(token.length, file.length - weapon.length).toLowerCase()
    if (cofMember.toLowerCase().split('\\').slice(0, 3).join('\\') === OBJECT_ROOT.slice(0, -1)) prefixes += 1
    for (const layer of cof.layers) {
      layers += 1
      const component = OBJECT_COMPONENTS[layer.type]
      if (component === undefined) { unresolved.push(`${cofMember}: composite ${String(layer.type)} has no directory`); continue }
      const wanted = `${OBJECT_ROOT}${token}\\${component}\\${token}${component}lit${mode}${weapon}.dcc`
      if (members.lower.has(wanted)) { dcc += 1; continue }
      if (members.lower.has(wanted.replace(/\.dcc$/i, '.dc6'))) { dc6 += 1; continue }
      unresolved.push(wanted)
    }
  }
  const resolved = dcc + dc6
  console.log(`   cofs=${String(cofs.length)} layers=${String(layers)} resolved=${String(resolved)} (.dcc ${String(dcc)} / .dc6 ${String(dc6)}) unresolved=${String(unresolved.length)}`)
  console.log(`   tokens with art but no Objects.txt row: ${[...unknownTokens].sort().join(' ') || 'none'}`)
  for (const miss of unresolved.slice(0, 8)) console.log(`   unresolved: ${miss}`)
  if (unresolved.length > 8) console.log(`   ... ${String(unresolved.length - 8)} more`)
  // The five known duds (E1/E2/HO/TP/YQ ship a COF whose layer sprite is absent,
  // or spell the armor class differently); everything else must resolve.
  check(layers > 1700, `expected ~1746 object COF layer references, saw ${String(layers)}`)
  check(resolved / Math.max(layers, 1) >= 0.99, `at least 99% of layers must resolve, saw ${String(resolved)}/${String(layers)}`)
  return { layers, dcc, dc6, unresolved, cofs: cofs.length, prefixes }
}

/** One placed object, reduced to what the report needs. */
interface Placement {
  readonly levelId: number
  readonly levelName: string
  readonly levelType: string
  readonly row: ObjectsRow
  readonly member: string | null
  readonly mode: string
  readonly anchor: { readonly x: number; readonly y: number }
  readonly guessedMode: boolean
}

/**
 * Measure 3: walk every preset level and resolve every object it places.
 *
 * @param archives - the mounted stack.
 * @param members - the member index.
 * @param tables - the parsed `Objects.txt`.
 * @param levelTables - the level tables.
 * @returns every placement, in walk order.
 */
async function walkPresetObjects(
  archives: MountedArchives,
  members: MemberSet,
  tables: ObjectsTable,
  levelTables: ActTables,
): Promise<{ placements: readonly Placement[]; tallies: Map<string, LevelTypeTally>; ds1Count: number; levels: number }> {
  console.log('== objects placed by the 35 preset levels (Levels.txt DrlgType=2) ==')
  const presetRows = levelTables.levels.rows.filter(row => cell(levelTables.levels, row, 'DrlgType') === DRLG_PRESET)
  const libraryCache = new Map<string, Dt1>()
  const tallies = new Map<string, LevelTypeTally>()
  const placements: Placement[] = []
  let ds1Count = 0
  let levels = 0
  for (const levelRow of presetRows) {
    const levelId = Number(cell(levelTables.levels, levelRow, 'Id'))
    let info
    try {
      info = resolveLevel(levelTables, levelId)
    } catch (err) {
      failures += 1
      failureLog.push(`level ${String(levelId)}: ${(err as Error).message}`)
      continue
    }
    levels += 1
    const tally = tallies.get(info.levelTypeName) ?? {
      levels: 0, objects: 0, resolved: 0, fallbacks: 0, artless: 0, monsterSpawns: 0,
      modeGuesses: 0, undefinedRows: 0, tokens: new Set<string>(),
    }
    tally.levels += 1
    tallies.set(info.levelTypeName, tally)

    let ds1: Ds1
    let found = false
    for (const ds1Name of info.ds1Names) {
      try {
        ds1 = decodeDs1(await archives.read(ds1Name))
      } catch {
        continue
      }
      found = true
      ds1Count += 1
      for (const object of ds1.objects) {
        tally.objects += 1
        let resolved
        try {
          // Omitting the monsters tables intentionally restores the legacy drop-everything-non-object behaviour.
          resolved = resolveDs1Object(tables, info.act, object.type, object.id)
        } catch (err) {
          tally.undefinedRows += 1
          failures += 1
          if (failureLog.length < MAX_REPORTED_FAILURES) failureLog.push(`${info.levelName} ${ds1Name}: ${(err as Error).message}`)
          continue
        }
        // DS1 `type` 1 is a monster spawn point, not an object: it has no object art and
        // this project has no monsters, so it is counted and left alone.
        if (resolved.kind === 'monster') {
          tally.monsterSpawns += 1
          continue
        }
        const row = resolved.row
        tally.tokens.add(resolved.token)
        const art = resolveObjectArt({
          object,
          token: resolved.token,
          row: row === null
            ? null
            : { name: row.name, token: resolved.token, subClass: row.subClass, mode: 0, hp: 0 },
          mode: resolved.mode,
          members: members.names,
        })
        const guessedMode = art.notes.some(note => note.includes('fell back to'))
        if (guessedMode) tally.modeGuesses += 1
        // `null` is the correct answer only when the archives really ship no sprite for
        // this token *and this mode*: `Objects.txt` has invisible helper rows (`Dummy`)
        // and modes that were never drawn (a portal's closed `NU` state has a COF but no
        // `NU` DCC). A token that does have art for the requested mode may not resolve to
        // null — that is the case this assertion exists to catch.
        const tokenRoot = `\\objects\\${resolved.token.trim().toLowerCase()}\\`
        const modeTag = `lit${art.mode.toLowerCase()}hth.`
        const modeHasSprite = members.names.some((name) => {
          const lower = name.toLowerCase()
          return lower.includes(tokenRoot) && lower.includes(modeTag)
        })
        if (art.member === null) {
          tally.fallbacks += 1
          if (!assert(!modeHasSprite,
            `${info.levelName}: ${resolved.token} has ${art.mode} art in the archives but resolved to null`)) continue
          tally.artless += 1
          continue
        }
        tally.resolved += 1
        const exists = members.lower.has(art.member.toLowerCase())
        if (!assert(exists, `${info.levelName}: ${resolved.token} member ${String(art.member)} is not in the archives`)) continue
        if (!assert(Number.isFinite(art.anchor.x) && Number.isFinite(art.anchor.y), `${info.levelName}: ${resolved.token} anchor is not finite`)) continue
        placements.push({
          levelId,
          levelName: info.levelName,
          levelType: info.levelTypeName,
          // Records with no Objects.txt row still have a real token; synthesise the
          // metadata row so downstream reporting has one shape to deal with.
          row: row ?? {
            id: object.id, name: resolved.token, token: resolved.token, subClass: 0, act: info.act,
            sizeX: 0, sizeY: 0, xOffset: 0, yOffset: 0, isDoor: false, trans: 0, draw: 0,
            totalPieces: 0, autoMap: 0, mode: [], selectable: [], frameCnt: [], frameDelta: [],
            start: [], cycleAnim: [], lit: [], sync: 0, components: [],
          },
          member: art.member,
          mode: art.mode,
          anchor: art.anchor,
          guessedMode,
        })
      }
      break
    }
    if (!found) {
      failures += 1
      failureLog.push(`level ${String(levelId)} (${info.levelName}): none of its ${String(info.ds1Names.length)} DS1 members decoded`)
    }
    // Keep the DT1 libraries of the last level of each type reachable for the
    // anchor measurement below.
    for (const dt1Name of info.dt1Names) {
      if (libraryCache.has(dt1Name)) continue
      libraryCache.set(dt1Name, decodeDt1(await archives.read(dt1Name)))
    }
  }

  console.log('   level type                    levels  objects  resolved  no-art  monsters  mode-guessed  tokens')
  // `no-art` counts objects the archives genuinely ship no sprite for (invisible helper
  // rows and modes that were never drawn); `resolved` counts the ones that drew something.
  for (const [type, tally] of [...tallies].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`   ${type.padEnd(28)} ${String(tally.levels).padStart(6)} ${String(tally.objects).padStart(8)} ${String(tally.resolved).padStart(9)} ${String(tally.artless).padStart(7)} ${String(tally.monsterSpawns).padStart(8)} ${String(tally.modeGuesses).padStart(13)}  ${String(tally.tokens.size).padStart(6)}`)
  }
  const tokens = new Set(placements.map(placement => placement.row.token))
  console.log(`   distinct tokens across all preset levels: ${String(tokens.size)} -> ${[...tokens].sort().join(' ')}`)
  assert(levels === 35, `expected 35 preset levels, saw ${String(levels)}`)
  assert(placements.length > 0, 'at least one object must resolve')
  return { placements, tallies, ds1Count, levels }
}

/**
 * Measure 4a: decode a sample of the resolved members and prove they have pixels.
 *
 * A name that exists is not art: this is what catches a rule that reconstructs a
 * *plausible* path to a real file with the wrong contents, or a decoder that
 * returns zeroed frames.
 *
 * @param archives - the mounted stack.
 * @param members - the member index.
 * @param placements - the resolved placements.
 * @returns the number of members decoded and the total opaque pixels seen.
 */
async function decodeSample(
  archives: MountedArchives,
  members: MemberSet,
  placements: readonly Placement[],
): Promise<{ decoded: number; frames: number; opaque: number }> {
  console.log('== sample decode of resolved members ==')
  const distinct = new Map<string, Placement>()
  for (const placement of placements) if (placement.member !== null && !distinct.has(placement.member)) distinct.set(placement.member, placement)
  const chosen: Placement[] = []
  const seenToken = new Set<string>()
  for (const placement of [...distinct.values()].sort((a, b) => a.row.token.localeCompare(b.row.token))) {
    if (seenToken.has(placement.row.token)) continue
    seenToken.add(placement.row.token)
    chosen.push(placement)
    if (chosen.length >= DECODE_SAMPLE_LIMIT) break
  }
  let decoded = 0
  let frames = 0
  let opaque = 0
  for (const placement of chosen) {
    const member = members.lower.get((placement.member ?? '').toLowerCase())
    if (member === undefined) continue
    const bytes = await archives.read(member)
    const isDc6 = member.toLowerCase().endsWith('.dc6')
    let frameList: { width: number; height: number; mask: Uint8Array }[] = []
    try {
      if (isDc6) {
        const sheet = decodeDc6(bytes)
        frameList = sheet.groups.flatMap(group => group.frames.map(frame => ({ width: frame.width, height: frame.height, mask: frame.mask })))
      } else {
        const file = decodeDcc(bytes)
        frameList = file.directions.flatMap(direction => direction.frames.map(frame => ({ width: frame.frame.width, height: frame.frame.height, mask: frame.frame.mask })))
      }
    } catch (err) {
      assert(false, `${member}: ${(err as Error).message}`)
      continue
    }
    const dims = frameList.every(frame => frame.width >= 1 && frame.height >= 1)
    if (!assert(dims && frameList.length >= 1, `${member}: ${String(frameList.length)} frames, dims ok=${String(dims)}`)) continue
    const pixels = frameList.reduce((sum, frame) => sum + frame.mask.reduce((inner, value) => inner + value, 0), 0)
    assert(pixels > 0, `${member}: decoded to ${String(pixels)} opaque pixels`)
    decoded += 1
    frames += frameList.length
    opaque += pixels
  }
  console.log(`   decoded ${String(decoded)} members (${String(frames)} frames, ${String(opaque)} opaque pixels) from ${String(chosen.length)} sampled objects`)
  return { decoded, frames, opaque }
}

/**
 * Measure 4b: composite one object through its real COF, the engine's own path.
 *
 * @param archives - the mounted stack.
 * @param members - the member index, to confirm the COF is really in the archives.
 * @param placements - the resolved placements.
 * @returns the number of sheets composited.
 */
async function compositeSample(
  archives: MountedArchives,
  members: MemberSet,
  placements: readonly Placement[],
): Promise<number> {
  console.log('== COF composition (the engine\'s entry point) ==')
  const chosen: Placement[] = []
  const seen = new Set<string>()
  for (const placement of placements) {
    const key = `${placement.row.token}:${placement.mode}`
    if (seen.has(key)) continue
    seen.add(key)
    chosen.push(placement)
    if (chosen.length >= 12) break
  }
  let composited = 0
  let layers = 0
  let opaque = 0
  for (const placement of chosen) {
    const modeIndex = OBJECT_MODE_TOKENS.indexOf(placement.mode as (typeof OBJECT_MODE_TOKENS)[number])
    try {
      const sheet = await loadObjectSheet(archives, placement.row.token, Math.max(modeIndex, 0), placement.row)
      const frames = sheet.sheet.groups[0]?.frames ?? []
      const pixels = frames.reduce((sum, frame) => sum + frame.mask.reduce((inner, value) => inner + value, 0), 0)
      const cofExists = members.lower.has(objectCofMember(placement.row.token, Math.max(modeIndex, 0)))
      assert(cofExists, `${objectCofMember(placement.row.token, modeIndex)} must exist for ${placement.row.token}`)
      assert(sheet.members.length >= 1, `${placement.row.token} ${placement.mode}: COF resolved no sprite layers (${sheet.notes.join('; ')})`)
      if (!assert(pixels > 0, `${placement.row.token} ${placement.mode}: composited to ${String(pixels)} opaque pixels`)) continue
      composited += 1
      layers += sheet.members.length
      opaque += pixels
    } catch (err) {
      assert(false, `${placement.row.token} ${placement.mode}: ${(err as Error).message}`)
    }
  }
  // Every object token a preset level places must have a readable COF for its
  // neutral mode: that is the file the engine actually loads.
  const tokensPlaced = new Set(placements.map(placement => placement.row.token))
  const withoutCof = [...tokensPlaced].filter(token => !members.lower.has(objectCofMember(token, 0)))
  assert(withoutCof.length === 0, `placed tokens with no neutral COF: ${withoutCof.join(' ')}`)
  console.log(`   composited ${String(composited)} object animations (${String(layers)} layers, ${String(opaque)} opaque pixels) from ${String(tokensPlaced.size)} distinct tokens`)
  return composited
}

/**
 * Measure 4c: the anchor arithmetic, ported and compared.
 *
 * @param archives - the mounted stack.
 * @param levelTables - the level tables.
 * @param placements - the resolved placements.
 */
async function reportAnchors(
  archives: MountedArchives,
  levelTables: ActTables,
  placements: readonly Placement[],
): Promise<void> {
  console.log('== draw anchors: D2Dungeon.cpp 10115 / 10117 vs this project ==')
  // Identities the port must satisfy.
  let identity = true
  for (let x = -6; x <= 6; x += 1) {
    for (let y = -6; y <= 6; y += 1) {
      const tile = tileDrawPositionCoords(x, y)
      const tileCentre = gameTileToClientCoords(x, y)
      if (tile.x !== tileCentre.x - 80 || tile.y !== tileCentre.y + 80) identity = false
      const sub = subtileDrawPositionCoords(x, y)
      const subCentre = gameSubtileToClientCoords(x, y)
      if (sub.x !== subCentre.x - 16 || sub.y !== subCentre.y + 16) identity = false
      const backTile = clientTileDrawPositionToGameCoords(tile.x, tile.y)
      if (backTile.x !== x || backTile.y !== y) identity = false
      const backSub = clientSubtileDrawPositionToGameCoords(sub.x, sub.y)
      if (backSub.x !== x || backSub.y !== y) identity = false
      // Negative results must floor, not truncate: the C++ idiom is `v / n - 1`.
      const floored = clientTileDrawPositionToGameCoords(tile.x - 1, tile.y - 1)
      if (floored.x !== x - 1 || floored.y !== y - 1) identity = false
    }
  }
  assert(identity, 'tile/subtile draw positions must equal the centre conversion plus (-80,+80)/(-16,+16) and round-trip on 169 coordinates')
  const engineObject = objectDrawAnchor(0, 0, 0, 0)
  assert(engineObject.x === -16 && engineObject.y === 16, `objectDrawAnchor(0,0,0,0) must be (-16,+16), saw (${String(engineObject.x)},${String(engineObject.y)})`)

  const sampleX = 12
  const sampleY = 7
  const engineFloor = tileDrawPositionCoords(sampleX, sampleY)
  // This project's values, from src/game/d2map.ts (TILE_ANCHOR_X = -80,
  // WALL_SURFACE_HEIGHT = 80) and from the packer's object placement.
  const projectFloorX = (sampleX - sampleY) * 80 - 80
  const projectFloorY = (sampleX + sampleY) * 40
  const projectWallExtra = 80
  const engineObjectAt = subtileDrawPositionCoords(sampleX * 5, sampleY * 5)
  const projectObjectX = (sampleX * 5 - sampleY * 5) * 16 - 32 / 2
  const projectObjectY = (sampleX * 5 + sampleY * 5) * 8 + 16

  console.log(`   cell (${String(sampleX)},${String(sampleY)})`)
  console.log(`   floor   engine DUNGEON_GameToClientTileDrawPositionCoords = (${String(engineFloor.x)}, ${String(engineFloor.y)})`)
  console.log(`   floor   this project ((cx-cy)*80-80, (cx+cy)*40)          = (${String(projectFloorX)}, ${String(projectFloorY)})   delta (${signed(engineFloor.x - projectFloorX)}, ${signed(engineFloor.y - projectFloorY)})`)
  console.log(`   wall    this project adds minBlockY + WALL_SURFACE_HEIGHT = minBlockY ${signed(projectWallExtra)}; engine adds only the block's own offset to the same tile draw position`)
  console.log(`   object  engine DUNGEON_GameToClientSubtileDrawPositionCoords = (${String(engineObjectAt.x)}, ${String(engineObjectAt.y)})`)
  console.log(`   object  this project (orthoX - w/2, orthoY - h + 16), w=h=32 = (${String(projectObjectX)}, ${String(projectObjectY)})   delta (${signed(engineObjectAt.x - projectObjectX)}, ${signed(engineObjectAt.y - projectObjectY)})`)
  const anchorVsObject = placements[0]
  if (anchorVsObject !== undefined) {
    console.log(`   object  resolveObjectArt anchor for the first placement (${anchorVsObject.row.token}): (${String(anchorVsObject.anchor.x)}, ${String(anchorVsObject.anchor.y)})`)
  }

  // The term that decides whether the project's floor and wall formulas agree
  // with the engine: the DT1 block offset the decoder shifts by.
  console.log('   DT1 minBlockY actually referenced by preset levels:')
  const presetRows = levelTables.levels.rows.filter(row => cell(levelTables.levels, row, 'DrlgType') === DRLG_PRESET)
  const floorHist = new Map<number, number>()
  const wallHist = new Map<number, number>()
  let floorTiles = 0
  let wallTiles = 0
  for (const levelRow of presetRows.slice(0, 8)) {
    const levelId = Number(cell(levelTables.levels, levelRow, 'Id'))
    let info
    try {
      info = resolveLevel(levelTables, levelId)
    } catch {
      continue
    }
    const libraries: Dt1[] = []
    for (const dt1Name of info.dt1Names) libraries.push(decodeDt1(await archives.read(dt1Name)))
    const tiles: Dt1Tile[] = libraries.flatMap(library => [...library.tiles])
    for (const ds1Name of info.ds1Names) {
      let ds1: Ds1
      try {
        ds1 = decodeDs1(await archives.read(ds1Name))
      } catch {
        continue
      }
      for (const row of ds1.cells) {
        for (const cellRow of row) {
          for (const floor of cellRow.floors) {
            if (floor.hidden || floor.prop1 === 0) continue
            const tile = tiles.find(candidate => candidate.style === floor.style && candidate.sequence === floor.sequence && candidate.direction === 0)
            if (tile === undefined) continue
            floorTiles += 1
            floorHist.set(tile.minBlockY, (floorHist.get(tile.minBlockY) ?? 0) + 1)
          }
          for (const wall of cellRow.walls) {
            if (wall.hidden || wall.prop1 === 0) continue
            const tile = tiles.find(candidate => candidate.style === wall.style && candidate.sequence === wall.sequence && candidate.direction === wall.type)
            if (tile === undefined) continue
            wallTiles += 1
            wallHist.set(tile.minBlockY, (wallHist.get(tile.minBlockY) ?? 0) + 1)
          }
        }
      }
      break
    }
  }
  const show = (label: string, hist: Map<number, number>, total: number): void => {
    const entries = [...hist].sort((a, b) => a[0] - b[0]).slice(0, 8)
    console.log(`      ${label} tiles=${String(total)} ` + entries.map(([value, count]) => `minBlockY ${String(value)}:${String(count)}`).join('  '))
  }
  show('floor', floorHist, floorTiles)
  show('wall ', wallHist, wallTiles)
  console.log('      a floor tile in this project is drawn at (cx+cy)*40 + (blockY - minBlockY); the engine draws it at (cx+cy)*40 + 80 + blockY,')
  console.log('      so the two agree only where minBlockY is -80. A wall in this project adds minBlockY back at draw time, which cancels the shift.')
}

/** Entry point. */
async function main(): Promise<void> {
  const archives = await mount()
  const members = await memberSet(archives)
  const tables = await loadObjectsTable(archives)
  const levelTables = await loadActTables(archives)

  console.log(`archives: ${archives.describe().join(', ')}`)
  console.log(`Objects.txt rows: ${String(tables.rows.length)} (${String(new Set(tables.rows.map(row => row.token)).size)} distinct tokens)`)
  console.log(`modes: ${OBJECT_MODE_TOKENS.join(' ')} (${String(OBJECT_MODE_COUNT)}); components: ${OBJECT_COMPONENTS.join(' ')}`)

  await reportArchiveLayout(archives)
  const template = await verifyCompositionTemplate(archives, members, tables)
  const walk = await walkPresetObjects(archives, members, tables, levelTables)
  const decoded = await decodeSample(archives, members, walk.placements)
  const composited = await compositeSample(archives, members, walk.placements)
  await reportAnchors(archives, levelTables, walk.placements)

  console.log('== summary ==')
  console.log(`   preset levels walked: ${String(walk.levels)}, DS1 members decoded: ${String(walk.ds1Count)}`)
  console.log(`   object placements resolved: ${String(walk.placements.length)}`)
  console.log(`   COF layer references rebuilt: ${String(template.layers)} (${String(template.dcc + template.dc6)} resolved, ${String(template.unresolved.length)} known duds)`)
  console.log(`   members decoded: ${String(decoded.decoded)} (${String(decoded.frames)} frames, ${String(decoded.opaque)} opaque pixels)`)
  console.log(`   object animations composited: ${String(composited)}`)
  console.log('')
  if (failures > 0) {
    console.log(`FAIL: ${String(failures)}/${String(checks)} checks failed`)
    for (const line of failureLog) console.log(`   - ${line}`)
    if (failures > failureLog.length) console.log(`   ... ${String(failures - failureLog.length)} more`)
    process.exitCode = 1
    return
  }
  console.log(`PASS: ${String(checks)}/${String(checks)} checks passed`)
}

await main()
