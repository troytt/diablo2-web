import { describe, test, expect as vitestExpect } from 'vitest'
import * as fs from 'fs'
// verify-tiles.ts — 验收"每个槽位画的是不是它该有的那种瓦片"
//
// 这份脚本存在的原因是一次真实事故：地面引用在 `buildIsoMapScene()` 里以 `type = null` 走
// **类型无关**的兜底池，池子里混着地面、墙、柱子、影子、树、屋顶。加上"按 RarityFrameIndex
// 加权随机选变体"之后，地面槽位会随机挑到石墙/柱子瓦片，而地面绘制不做墙那套
// `minBlockY + 80` 补偿 —— 于是画面里出现"悬在地面上的暗色方块"（35 关实测 1,918/28,704
// 个地面槽位画错类型，修道院大教堂 28.2%、地下墓穴 4 层 41.5%）。
//
// 现在地面按 DT1 `type 0` 解析，这里把当年的普查变成永久断言：
//   1. 地面槽位画出的瓦片 `type` 必须是 0；
//   2. 墙/屋顶槽位不得画出地面瓦片（type 0）；
//   3. `looseRefs == 0`（没有任何引用走类型无关兜底）与 `missingTiles == 0`——
//      这两条合起来保证"画出的类型 == 引用的类型"；
//   4. 位置自洽：地面 `y == (cx+cy)*40` 且瓦片 `minBlockY == 0`；
//      墙 `y == (cx+cy)*40 + minBlockY + 80`；屋顶 `y == (cx+cy)*40 - roofHeight`；
//   5. 顶角（DS1 `type 3`）必须连带画出左半（`type 4`）——引擎在
//      `DRLGROOMTILE_InitWallTileData` 里就是这么做的，DS1 自己从不列左半。
//      漏掉它时墙角会缺一块，看起来像"渲染不正常"。
//
//   node scripts/verify-tiles.ts [--dir=samples/d2] [--limit=35]
//
// 退出码非 0 表示有断言没过。

export {}

import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { decodeDs1 } from '../src/common/formats/ds1.ts'
import { decodeDt1 } from '../src/common/formats/dt1.ts'
import type { Dt1 } from '../src/common/formats/dt1.ts'
import { cell, loadActTables, resolveLevel, resolveLevelLibraries } from '../src/common/world/acts.ts'
import { buildIsoMapScene, levelSeed, ORTHO_CELL_HEIGHT } from '../src/common/world/d2map.ts'
const isSkip = true && !fs.existsSync('samples/d2');
const _results: any[] = [];
let suiteCompleted = false;
let problems: string[] = [];
let checks: any[] = [];
function expect(condition: boolean, description: string) { _results.push({cond: condition, desc: description}); if (!condition) problems.push(description); }
function check(nameOrOk: any, okOrMessage: any, detail?: string) { 
  if (typeof nameOrOk === 'string') {
    _results.push({cond: okOrMessage, desc: nameOrOk, detail}); if (!okOrMessage) checks.push({name: nameOrOk, ok: okOrMessage});
  } else {
    _results.push({cond: nameOrOk, desc: okOrMessage}); if (!nameOrOk) checks.push({name: okOrMessage, ok: nameOrOk});
  }
}
if (!isSkip) {

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
function __check_disabled(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`)
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
  // 解码出来的 DT1 库很占内存（每个瓦片的块像素是 width×bitmapHeight 的 Uint8Array，
  // 一个库几十 MB），无限缓存跑完 35 关会涨到数 GB。跟打包器一样加个上限：
  // 16 个库比任何单一关卡类型用到的都多，所以一关之内不会重复解码，内存曲线保持平坦。
  const libraryCache = new Map<string, Dt1>()
  /** 同时保留解码结果的 DT1 库上限。 */
  const LIBRARY_CACHE_LIMIT = 16

  let levels = 0
  let floors = 0
  let walls = 0
  let roofs = 0
  let wrongFloorType = 0
  let floorAsWall = 0
  let looseRefs = 0
  let missingTiles = 0
  let positionMismatch = 0
  let cornerRefs = 0
  let cornerPairs = 0
  let missingCornerPairs = 0
  const worst: [number, string][] = []

  for (const row of tables.levels.rows) {
    if (cell(tables.levels, row, 'DrlgType') !== '2') continue
    const levelId = Number(cell(tables.levels, row, 'Id'))
    let info
    try {
      info = resolveLevel(tables, levelId)
    } catch { continue }
    const { dt1Names } = resolveLevelLibraries(tables, levelId)
    const libs: Dt1[] = []
    for (const name of dt1Names) {
      const cached = libraryCache.get(name)
      if (cached !== undefined) { libs.push(cached); continue }
      try {
        const decoded = decodeDt1(await archives.read(name))
        libraryCache.set(name, decoded)
        if (libraryCache.size > LIBRARY_CACHE_LIMIT) {
          const oldest = libraryCache.keys().next().value
          if (oldest !== undefined && oldest !== name) libraryCache.delete(oldest)
        }
        libs.push(decoded)
      } catch { /* 缺库时 verify:acts 会报 */ }
    }
    if (libs.length === 0) continue
    let ds1
    try {
      ds1 = decodeDs1(await archives.read(info.ds1Names[0]!))
    } catch { continue }
    if (levels >= LIMIT) break
    levels += 1

    const seed = levelSeed(info.ds1Names[0]!)
    const scene = buildIsoMapScene(ds1, libs, seed)
    for (const cellRef of ds1.cells.flat()) {
      for (const wall of cellRef.walls) {
        if (!wall.hidden && wall.prop1 !== 0 && wall.type === 3) cornerRefs += 1
      }
    }
    cornerPairs += scene.cornerPairs
    missingCornerPairs += scene.missingCornerPairs
    looseRefs += scene.looseRefs
    missingTiles += scene.missingTiles

    let badHere = 0
    for (const draw of scene.floors) {
      const tile = libs[draw.library]?.tiles[draw.tile]
      if (tile === undefined) continue
      floors += 1
      // (1) 地面槽位只能是 type 0 的瓦片
      if (tile.type !== 0) { wrongFloorType += 1; badHere += 1 }
      // (4) 地面位置：不带动画块补偿，且地面瓦片本身不该有块位移
      if (draw.y - scene.originY !== (draw.cellX + draw.cellY) * ORTHO_CELL_HEIGHT || tile.minBlockY !== 0) positionMismatch += 1
    }
    for (const draw of scene.walls) {
      const tile = libs[draw.library]?.tiles[draw.tile]
      if (tile === undefined) continue
      walls += 1
      // (2) 墙槽位不该画出地面瓦片
      if (tile.type === 0) floorAsWall += 1
      // (4) 墙位置 = 格子基线 + 该瓦片自己的块位移 + 一格高
      if (draw.y - scene.originY !== (draw.cellX + draw.cellY) * ORTHO_CELL_HEIGHT + tile.minBlockY + 80) positionMismatch += 1
    }
    for (const draw of scene.roofs) {
      const tile = libs[draw.library]?.tiles[draw.tile]
      if (tile === undefined) continue
      roofs += 1
      if (draw.y - scene.originY !== (draw.cellX + draw.cellY) * ORTHO_CELL_HEIGHT - tile.roofHeight) positionMismatch += 1
    }
    if (scene.floors.length > 0) worst.push([100 * badHere / scene.floors.length, info.levelName])
  }

  worst.sort((left, right) => right[0] - left[0])
  console.log(`\n走了 ${String(levels)} 个预置关卡：地面 ${String(floors)} 槽、墙 ${String(walls)} 槽、屋顶 ${String(roofs)} 槽`)

  check('地面槽位画出的瓦片类型都是 0（无错配方块）', wrongFloorType === 0,
    `${String(wrongFloorType)} 个错类型 / ${String(floors)} 个地面槽`)
  check('墙/屋顶槽位没有画出地面瓦片', floorAsWall === 0, `${String(floorAsWall)} 个`)
  check('没有任何引用走类型无关兜底', looseRefs === 0, `looseRefs ${String(looseRefs)}`)
  check('没有解析不到的引用', missingTiles === 0, `missingTiles ${String(missingTiles)}`)
  check('地面/墙/屋顶的位置公式自洽', positionMismatch === 0, `${String(positionMismatch)} 个不符`)
  check('每个顶角右半都画出了左半伙伴', cornerRefs > 0 && cornerPairs === cornerRefs,
    `${String(cornerPairs)}/${String(cornerRefs)} 个 type-3 墙带了 type-4 伙伴`)
  check('没有解析不到的顶角伙伴', missingCornerPairs === 0, `${String(missingCornerPairs)} 个`)
  if (worst.length > 0 && worst[0]![0] > 0) console.log(`   最严重：${worst.slice(0, 5).map(([pct, name]) => `${name} ${pct.toFixed(1)}%`).join('，')}`)

  const passed = checks.filter((entry: any) => entry.ok).length
  console.log(`\n${String(passed)}/${String(checks.length)} passed`)
  if (passed !== checks.length) {}
}

await main()

  suiteCompleted = true;
}
describe('verify-tiles.ts', () => {
  test.skipIf(isSkip)('evaluates script successfully', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
  });
  test.skipIf(isSkip)('地面槽位画出的瓦片类型都是 0（无错配方块）', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('地面槽位画出的瓦片类型都是 0（无错配方块）'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('墙/屋顶槽位没有画出地面瓦片', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('墙/屋顶槽位没有画出地面瓦片'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('没有任何引用走类型无关兜底', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('没有任何引用走类型无关兜底'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('没有解析不到的引用', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('没有解析不到的引用'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('地面/墙/屋顶的位置公式自洽', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('地面/墙/屋顶的位置公式自洽'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('每个顶角右半都画出了左半伙伴', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('每个顶角右半都画出了左半伙伴'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('没有解析不到的顶角伙伴', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('没有解析不到的顶角伙伴'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
});