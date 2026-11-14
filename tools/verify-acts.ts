/**
 * Resolve and build all five act towns from the real archives.
 *
 * This runs the exact data chain the browser page uses — mount, tables, DS1,
 * DT1, palette, isometric scene — and reports numbers instead of impressions:
 * which DS1 quadrants each town has, whether every tile reference resolved,
 * how much of the map is walkable, and whether a spawn point exists. It is the
 * check that says the geometry is self-consistent before anything is drawn.
 *
 * Usage:
 *   node scripts/verify-acts.ts [directory]
 */
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { loadActTables, loadActTown } from '../src/common/world/acts.ts'
import { levelSeed, buildIsoMapScene, findIsoSpawn, isBlockedAt } from '../src/common/world/d2map.ts'
import { SUB_TILES_PER_TILE } from '../src/common/world/map.ts'

const dir = process.argv[2] ?? 'samples/d2'
/** Mount order: later archives override earlier ones, exactly as the game loads them. */
const MOUNTS = ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']
const CHARACTER_ARCHIVE = 'd2char.mpq'

let checks = 0
let failures = 0

/**
 * Assert one expectation.
 *
 * @param ok - whether it held.
 * @param message - what was checked.
 */
function check(ok: boolean, message: string): void {
  checks += 1
  if (!ok) failures += 1
  console.log(`   ${ok ? 'ok  ' : 'FAIL'} ${message}`)
}

const archives = new MountedArchives()
for (const name of [...MOUNTS, CHARACTER_ARCHIVE]) {
  try {
    archives.add(name, await MpqArchive.open(await fileSource(`${dir}/${name}`)))
  } catch (err) {
    console.log(`skip ${name}: ${String(err)}`)
  }
}
if (archives.size === 0) {
  console.log(`no archives found in ${dir}`)
  process.exit(2)
}
console.log(`== mounted ${String(archives.size)} archives ==`)
for (const line of archives.describe()) console.log(`   ${line}`)

const tables = await loadActTables(archives)
console.log(`\n== tables ==`)
console.log(`   levels.txt   ${String(tables.levels.rows.length)} rows, ${String(tables.levels.header.length)} columns`)
console.log(`   lvltypes.txt ${String(tables.lvltypes.rows.length)} rows`)
console.log(`   lvlprest.txt ${String(tables.lvlprest.rows.length)} rows`)

for (let act = 1; act <= 5; act += 1) {
  console.log(`\n-- Act ${String(act)}`)
  const loaded = await loadActTown(archives, tables, act)
  const { town } = loaded
  console.log(`   level    ${town.levelName} (Id ${String(town.levelId)}, ${String(town.sizeX)}x${String(town.sizeY)} cells, level type "${town.levelTypeName}")`)
  console.log(`   palette  ${town.paletteName} (${String(loaded.palette.rgb.length / 3)} colours, ${String(loaded.palette.lightLevels.length)} light tables)`)
  console.log(`   ds1      ${town.ds1Names.map(name => name.split('\\').pop()).join(', ')}`)
  console.log(`   dt1      ${String(town.dt1Names.length)} libraries, mask 0x${town.dt1Mask.toString(16)}`)
  check(town.ds1Names.length > 0, `Act ${String(act)}: has at least one DS1`)
  check(town.dt1Names.length > 0, `Act ${String(act)}: has at least one DT1 library`)
  check(loaded.levels.every(level => level.version >= 8), `Act ${String(act)}: DS1 versions carry the act field`)

  let scene = null as ReturnType<typeof buildIsoMapScene> | null
  let quadrant = ''
  for (const level of loaded.levels) {
    // The largest quadrant is the one the page opens; smaller ones are corridors.
    const built = buildIsoMapScene(level, loaded.libraries)
    if (scene === null || built.frames.length > scene.frames.length) {
      scene = built
      quadrant = `${String(level.width)}x${String(level.height)}`
    }
  }
  if (scene === null) { check(false, `Act ${String(act)}: built a scene`); continue }

  let blocked = 0
  for (const value of scene.blocked) if (value === 1) blocked += 1
  const walkable = 1 - blocked / scene.blocked.length
  const spawn = findIsoSpawn(scene)
  console.log(`   scene    ${String(scene.widthPx)}x${String(scene.heightPx)} px, ${String(scene.floors.length)} floors, ${String(scene.walls.length)} walls, ${String(scene.frames.length)} distinct frames`)
  console.log(`   collision ${String(scene.gridWidth)}x${String(scene.gridHeight)} sub-tiles, walkable ${(walkable * 100).toFixed(1)}%`)
  console.log(`   warnings missing=${String(scene.missingTiles)} clipped=${String(scene.clippedTiles)} duplicate-refs=${String(scene.duplicateRefs)}`)
  // A handful of unresolved references is a quirk of the shipped DS1 data (the
  // game draws nothing there); a broken chain produces hundreds, so the bound is
  // tight in relative terms and the offenders are always printed.
  const references = scene.floors.length + scene.walls.length + scene.missingTiles
  const missingShare = scene.missingTiles / Math.max(1, references)
  check(
    missingShare <= 0.002,
    `Act ${String(act)}: ${String(scene.missingTiles)}/${String(references)} references unresolved (${(missingShare * 100).toFixed(2)}%)`,
  )
  for (const ref of scene.missingRefs.slice(0, 3)) console.log(`   note     unresolved: ${ref}`)
  // A town is mostly open ground; Act 4's fortress courtyard is 92% walkable, so
  // the bound only rejects maps that are entirely one or the other.
  check(walkable > 0.1 && walkable < 0.99, `Act ${String(act)}: walkable share ${(walkable * 100).toFixed(1)}% is a map, not a wall`)
  check(spawn !== null, `Act ${String(act)}: a walkable spawn exists`)
  if (spawn !== null) {
    check(!isBlockedAt(scene, spawn.x, spawn.y), `Act ${String(act)}: spawn is on a walkable sub-tile`)
    // Walk a short straight line and confirm the collision grid answers.
    let reached = 0
    for (let step = 0; step < 40; step += 1) {
      if (!isBlockedAt(scene, spawn.x + step * 4, spawn.y)) reached += 1
    }
    console.log(`   probe     ${String(reached)}/40 four-pixel steps east of spawn are walkable`)
  }
  check(scene.frames.length > 0, `Act ${String(act)}: scene references at least one frame`)
  console.log(`   note     ${String(scene.clippedTiles)} tiles needed a bitmap taller than their declared height`)
  void SUB_TILES_PER_TILE
}

console.log(`\n${String(checks - failures)}/${String(checks)} checks passed`)
if (failures > 0) process.exit(1)
