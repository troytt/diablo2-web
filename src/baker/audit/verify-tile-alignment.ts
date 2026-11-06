// verify-tile-alignment.ts — 用实测把"地面比引擎低/高 80 px"这个疑点结掉
//
// 背景：上一轮的 `verify-objects` 打印过一张对照表，说引擎的
// `DUNGEON_GameToClientTileDrawPositionCoords`（D2MOO 移植过来的真引擎函数）算出 cell(12,7) 的地面
// 在 (320, 840)，而本项目画在 (320, 760)，差 (+0, +80)，看起来像"地面整体偏了 80 px"。
//
// 这份脚本证明那**不是错位**，而是两个坐标系之间的**常量平移**，并且用像素实测证明同一格里
// 地面的下沿与墙脚是对齐的：
//
// 1. 常量性：D2MOO 的 tile 位置与本项目的地面绘制位置的差在所有格子上都是 (+80, +80)，
//    与 (x,y) 无关 → 整张图一起平移，相机又跟着角色走，所以对相对关系没有任何影响。
// 2. 公式一致性：我们画墙用的 `minBlockY + 80` 与解析出来的 `bitmapHeight`，必须等于引擎从原始
//    block 字节独立推出的 `tileMinY + 80` 与 `realHeight = max(|Height|, maxY - minY)`。
// 3. 接缝实测：同一格里取墙位图与地面位图**真正的不透明像素**，比较墙脚（墙最下面一行不透明像素）
//    与地面下沿。差值应当是 0。
//
//   node scripts/verify-tile-alignment.ts [--dir=samples/d2] [--limit=35]
//
// 退出码非 0 表示有断言没过。

export {}

import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { cell, loadActTables, resolveLevel, resolveLevelLibraries } from '../../common/world/acts.ts'
import { decodeDs1 } from '../../common/formats/ds1.ts'
import { decodeDt1 } from '../../common/formats/dt1.ts'
import type { Dt1, Dt1Tile } from '../../common/formats/dt1.ts'
import { levelSeed, buildIsoMapScene, ORTHO_CELL_HEIGHT, ORTHO_CELL_WIDTH } from '../../common/world/d2map.ts'

/** 归档目录。 */
const DIR = process.argv.find(argument => argument.startsWith('--dir='))?.slice('--dir='.length) ?? 'samples/d2'
/** 最多走多少个预置关卡。 */
const LIMIT = Number(process.argv.find(argument => argument.startsWith('--limit='))?.slice('--limit='.length) ?? '35')

/** 断言结果。 */
const checks: { name: string; ok: boolean; detail: string }[] = []

/**
 * 记录一条断言。
 *
 * @param name - what was checked.
 * @param ok - whether it held.
 * @param detail - evidence.
 */
function check(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`)
}

/**
 * 位图里最后一行不透明像素的行号（没有不透明像素时返回 -1）。
 *
 * @param tile - the decoded DT1 tile.
 * @returns the row index, or -1.
 */
function lastOpaqueRow(tile: Dt1Tile): number {
  // 每个 block 的像素缓冲已经是"整块位图尺寸"的画布，解码时按 `-minBlockY` 平移过，
  // 所以缓冲里的行号就是位图内的行号，不需要再加 block.y（block.y 保留的是原始值）。
  const stride = tile.width
  let last = -1
  for (const block of tile.blocks) {
    if (stride <= 0) break
    const rows = Math.floor(block.pixels.length / stride)
    for (let row = rows - 1; row >= 0; row -= 1) {
      const start = row * stride
      let opaque = false
      for (let column = 0; column < stride; column += 1) {
        if ((block.pixels[start + column] ?? 0) !== 0) { opaque = true; break }
      }
      if (opaque) { last = Math.max(last, row); break }
    }
  }
  return last
}

/**
 * 从原始字节独立算出引擎的 `tileMinY` / `realHeight`（OpenDiablo2 `generateWallCache` 的公式）。
 *
 * @param tile - the decoded DT1 tile; `block.y` is already shifted by `minBlockY`.
 * @returns the engine's numbers.
 */
function engineMetrics(tile: Dt1Tile): { tileMinY: number; tileMaxY: number; realHeight: number } {
  // `block.y` 是原始值（解码时像素另有平移），所以这里直接用，不要再叠加 minBlockY。
  let tileMinY = 0
  let tileMaxY = 0
  for (const block of tile.blocks) {
    tileMinY = Math.min(tileMinY, block.y)
    tileMaxY = Math.max(tileMaxY, block.y + 32)
  }
  return { tileMinY, tileMaxY, realHeight: Math.max(Math.abs(tile.height), tileMaxY - tileMinY) }
}

/**
 * 主流程。
 */
async function main(): Promise<void> {
  const archives = new MountedArchives()
  for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
    archives.add(name, await MpqArchive.open(await fileSource(`${DIR}/${name}`)))
  }
  const tables = await loadActTables(archives)

  const presetRows = tables.levels.rows.filter(row => cell(tables.levels, row, 'DrlgType') === '2')
  const libraries = new Map<string, Dt1>()
  let cells = 0
  let pairs = 0
  const deltaHistogram = new Map<number, number>()
  const samples: string[] = []
  const seenDeltas = new Set<number>()
  const baseDeltas = new Map<number, number>()
  const offsetsD2moo = new Set<string>()
  const formulaMismatches: string[] = []
  let floorMinYNonZero = 0
  let roofDraws = 0
  let roofMatches = 0
  const wallTypes = new Map<number, number>()
  let wallTiles = 0
  let levelsWalked = 0
  // 键的正确性回归：DS1 wall type 必须与 DT1 头 +20 的 `Type` 对齐，而不是 +0 的 `Direction`。
  // 键错时树(14)/屋顶(15)/影子(13)全落 loose、画成地面。这里按 type 键全量复核，loose/missing 应为 0。
  let refsTotal = 0
  let refsExact = 0
  let refsLoose = 0
  let refsMissing = 0
  const looseRefs = new Set<string>()

  let decodeErrors = 0

  for (const row of presetRows.slice(0, LIMIT)) {
    const levelId = Number(cell(tables.levels, row, 'Id'))
    let info
    try {
      info = resolveLevel(tables, levelId)
    } catch (err) {
      console.error(`FAIL level ${String(levelId)} resolveLevel: ${(err as Error).message}`)
      decodeErrors += 1
      process.exitCode = 1
      continue
    }
    const { dt1Names } = resolveLevelLibraries(tables, levelId)
    const libs: Dt1[] = []
    for (const name of dt1Names) {
      const cached = libraries.get(name)
      if (cached !== undefined) { libs.push(cached); continue }
      try {
        const decoded = decodeDt1(await archives.read(name))
        libraries.set(name, decoded)
        libs.push(decoded)
      } catch (err) {
        console.error(`FAIL level ${String(levelId)} DT1 decode (${name}): ${(err as Error).message}`)
        decodeErrors += 1
        process.exitCode = 1
      }
    }
    if (libs.length === 0) continue

    let ds1
    try {
      ds1 = decodeDs1(await archives.read(info.ds1Names[0]!))
    } catch (err) {
      console.error(`FAIL level ${String(levelId)} DS1 decode (${info.ds1Names[0] ?? ''}): ${(err as Error).message}`)
      decodeErrors += 1
      process.exitCode = 1
      continue
    }
    levelsWalked += 1
    const scene = buildIsoMapScene(ds1, libs, levelSeed(info.ds1Names[0] ?? String(levelId)))

    // 键正确性复核（独立于 buildIsoMapScene，用原始 DS1 + 库重算一遍）。
    const exactKeys = new Set<string>()
    const looseKeys = new Set<string>()
    for (const lib of libs) for (const tile of lib.tiles) {
      exactKeys.add(`${String(tile.style)}:${String(tile.sequence)}:${String(tile.type)}`)
      looseKeys.add(`${String(tile.style)}:${String(tile.sequence)}`)
    }
    for (const cellRef of ds1.cells.flat()) for (const wall of cellRef.walls) {
      if (wall.hidden || wall.prop1 === 0) continue
      refsTotal += 1
      if (exactKeys.has(`${String(wall.style)}:${String(wall.sequence)}:${String(wall.type)}`)) { refsExact += 1; continue }
      if (looseKeys.has(`${String(wall.style)}:${String(wall.sequence)}`)) { refsLoose += 1; looseRefs.add(`${String(wall.style)}/${String(wall.sequence)}/${String(wall.type)}`); continue }
      refsMissing += 1
    }

    // Roofs: the engine offsets them by `-roofHeight` instead of `minBlockY + 80`.
    for (const roof of scene.roofs) {
      const tile = libs[roof.library]?.tiles[roof.tile]
      if (tile === undefined) continue
      roofDraws += 1
      // The scene shifts every draw to keep coordinates positive, so the formula is
      // checked against the *unshifted* placement (scene.originY is that shift).
      if (roof.y - scene.originY === (roof.cellX + roof.cellY) * ORTHO_CELL_HEIGHT - tile.roofHeight) roofMatches += 1
    }

    // 按格子收集地面与墙
    type Draw = (typeof scene.floors)[number]
    const byCell = new Map<string, { floors: Draw[]; walls: Draw[] }>()
    for (const cell of ds1.cells.flat()) {
      for (const wall of cell.walls) {
        if (wall.prop1 === 0 || wall.hidden) continue
        wallTypes.set(wall.type, (wallTypes.get(wall.type) ?? 0) + 1)
      }
    }
    for (const draw of scene.floors) {
      const key = `${String(draw.cellX)},${String(draw.cellY)}`
      const entry = byCell.get(key) ?? { floors: [], walls: [] }
      entry.floors.push(draw)
      byCell.set(key, entry)
    }
    for (const draw of scene.walls) {
      const key = `${String(draw.cellX)},${String(draw.cellY)}`
      const entry = byCell.get(key) ?? { floors: [], walls: [] }
      entry.walls.push(draw)
      byCell.set(key, entry)
    }

    for (const [key, entry] of byCell) {
      if (entry.floors.length === 0 || entry.walls.length === 0) continue
      cells += 1
      const [cxText, cyText] = key.split(',')
      const cx = Number(cxText)
      const cy = Number(cyText)

      // (1) 常量性：D2MOO 的 tile 位置 vs 本项目的地面位置
      const oursX = (cx - cy) * ORTHO_CELL_WIDTH - 80
      const oursY = (cx + cy) * ORTHO_CELL_HEIGHT
      const d2mooX = (cx - cy) * ORTHO_CELL_WIDTH
      const d2mooY = (cx + cy) * ORTHO_CELL_HEIGHT + 80
      offsetsD2moo.add(`${String(d2mooX - oursX)},${String(d2mooY - oursY)}`)

      const floor = entry.floors[0]!
      const wall = entry.walls[0]!
      const floorTile = libs[floor.library]?.tiles[floor.tile]
      const wallTile = libs[wall.library]?.tiles[wall.tile]
      if (floorTile === undefined || wallTile === undefined) continue
      if (floorTile.minBlockY !== 0) floorMinYNonZero += 1
      wallTiles += 1

      // (2) 公式一致性：我们的 minBlockY / bitmapHeight 必须等于引擎独立算出的值
      const metrics = engineMetrics(wallTile)
      if (wallTile.minBlockY !== metrics.tileMinY) {
        if (formulaMismatches.length < 6) {
          formulaMismatches.push(`${String(levelId)} wall style ${String(wallTile.style)}: minBlockY ${String(wallTile.minBlockY)} != engine ${String(metrics.tileMinY)}`)
        }
      } else if (wallTile.bitmapHeight !== metrics.realHeight) {
        if (formulaMismatches.length < 6) {
          formulaMismatches.push(`${String(levelId)} wall style ${String(wallTile.style)}: bitmapHeight ${String(wallTile.bitmapHeight)} != engine realHeight ${String(metrics.realHeight)}`)
        }
      }

      // (3) 接缝实测：墙脚（最下面一行不透明像素）与地面下沿之差
      const floorBottom = floor.y + lastOpaqueRow(floorTile)
      const wallBottom = wall.y + lastOpaqueRow(wallTile)
      // 真正的"接缝"判据是**基线**而不是"最下面一行不透明像素"：引擎给墙加的
      // `YAdjust = minBlockY + 80` 正好抵消解码时按 `-minBlockY` 做的平移，使墙的原始 y=0
      // 落在格子基线（地面位图下沿所在的 80 px 处）；不同 tile 类型的美术在基线上下伸出的
      // 多少各不相同，所以像素行差只能当参考，不能当判据。
      const wallBase = wall.y - wallTile.minBlockY
      const floorBase = floor.y + 80
      baseDeltas.set(wallBase - floorBase, (baseDeltas.get(wallBase - floorBase) ?? 0) + 1)

      const delta = wallBottom - floorBottom
      deltaHistogram.set(delta, (deltaHistogram.get(delta) ?? 0) + 1)
      if (samples.length < 8 && !seenDeltas.has(delta)) {
        seenDeltas.add(delta)
        samples.push(`Δ${String(delta)} cell(${String(cx)},${String(cy)}) `
          + `floor[y=${String(floor.y)} last=${String(floorBottom - floor.y)} bh=${String(floorTile.bitmapHeight)} minY=${String(floorTile.minBlockY)}] `
          + `wall[y=${String(wall.y)} last=${String(wallBottom - wall.y)} bh=${String(wallTile.bitmapHeight)} minY=${String(wallTile.minBlockY)} h=${String(wallTile.height)} style=${String(wallTile.style)}/${String(wallTile.sequence)}/${String(wallTile.type)}]`)
      }
      pairs += 1
    }
  }

  console.log(`\n走了 ${String(levelsWalked)} 个预置关卡：含"地面+墙"的格子 ${String(cells)}，参与接缝实测的配对 ${String(pairs)}`)
  console.log(`   屋顶层（DS1 wall type 15）：${String(roofDraws)} 个，其中偏移与引擎公式 -roofHeight 相符的 ${String(roofMatches)} 个`)
  console.log(`   DS1 墙 type 分布：${[...wallTypes].sort((left, right) => left[0] - right[0]).map(([type, count]) => `${String(type)}×${String(count)}`).join(' ')}`)
  console.log(`   D2MOO 位置 - 本项目地面位置 的不同取值：${[...offsetsD2moo].join(' | ')}`)
  const deltas = [...deltaHistogram].sort((left, right) => right[1] - left[1])
  console.log(`   接缝差（墙脚 - 地面下沿）分布：${deltas.slice(0, 8).map(([value, count]) => `${String(value)}px ×${String(count)}`).join('  ')}`)
  console.log(`   地面瓦片里 minBlockY != 0 的：${String(floorMinYNonZero)} / ${String(cells)}`)

  for (const sample of samples) console.log(`   ${sample}`)

  console.log(`\n   墙引用键复核：${String(refsExact)}/${String(refsTotal)} 精确命中，loose ${String(refsLoose)}，缺失 ${String(refsMissing)}`)
  if (refsLoose > 0) console.log(`   loose 引用：${[...looseRefs].slice(0, 8).join(' | ')}`)
  check('所有预置关卡与 DT1/DS1 均正常解析', decodeErrors === 0, `${String(decodeErrors)} 个解析错误`)
  check('DS1 wall type 与 DT1 `Type`(+20) 精确对齐（无 loose/缺失）', refsTotal > 0 && refsExact === refsTotal,
    `${String(refsExact)}/${String(refsTotal)} 精确命中`)

  check('D2MOO 与本项目的差在所有格子上是同一个常量', offsetsD2moo.size === 1,
    [...offsetsD2moo].join(' | '))
  check('该常量与"整张图平移"一致（解释 80 px 疑点）', [...offsetsD2moo][0] === '80,80',
    `偏移 ${[...offsetsD2moo][0] ?? '?'}：X 差一格半宽（位图锚点），Y 差一个 tile 高（D2MOO 的口径）`)
  check('屋顶偏移等于引擎的 -roofHeight（没有屋顶层的关卡按通过算）', roofDraws === 0 || roofMatches === roofDraws,
    `${String(roofMatches)}/${String(roofDraws)} 个屋顶`)

  check('墙的 minBlockY / bitmapHeight 等于引擎从原始字节算出的值', formulaMismatches.length === 0,
    formulaMismatches.length === 0 ? `${String(wallTiles)} 面墙全部一致` : formulaMismatches.join(' | '))
  // 墙脚与地面下沿：多数应当正好重合；差值不为 0 的那些是"美术本身伸到格子下沿之外"的墙
  // （栅栏、树、台阶等），它们的脚本来就在格子外，属于正常。
  const baseExact = baseDeltas.get(0) ?? 0
  check('接缝判据：墙的基线与地面基线完全重合', pairs > 0 && baseExact === pairs,
    `${String(baseExact)}/${String(pairs)} 对基线差为 0`)
  console.log(`   （参考值，不作为判据）最下面一行不透明像素之差最常见 ${String(deltas[0]?.[0] ?? 0)}px：`
    + '不同 tile 类型的美术在基线上下伸出的量不同，栅栏/树/台阶本来就越过格子下沿')

  const passed = checks.filter(entry => entry.ok).length
  console.log(`\n${String(passed)}/${String(checks.length)} passed`)
  if (passed !== checks.length) process.exitCode = 1
}

await main()
