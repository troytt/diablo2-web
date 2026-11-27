import { describe, test, expect as vitestExpect } from 'vitest'
import * as fs from 'fs'
// verify-collision-orientation.ts — 永久断言 DT1 子格阻挡标志位的行序与 OpenDiablo2 / D2MOO 完全一致
//
// 事故与背景（Issue #4）：
// DT1 每张瓦片记录末尾有 25 个字节的子格碰撞标志。在原始文件里是「自下而上」存储的：
// 文件顺序的第 0..4 字节是这一格 5×5 足迹的最下面一行（subY=4），第 20..24 字节是最上面一行（subY=0）。
// 之前解码器按 0..24 顺序存入 subTileFlags，导致每个格子内部的阻挡带被上下镜像。
//
// 两个官方/引擎逆向实现互相印证：
// 1. OpenDiablo2 `reference/opendiablo2/d2core/d2map/d2mapengine/map_tile.go:17`:
//    var subtileLookup = [5][5]int{
//        {20, 21, 22, 23, 24},   // 房间子格 (x, 0) —— 最上面一行，读文件 20..24
//        {15, 16, 17, 18, 19},
//        {10, 11, 12, 13, 14},
//        {5, 6, 7, 8, 9},
//        {0, 1, 2, 3, 4},        // 最下面一行，读文件 0..4
//    }
// 2. D2MOO `D2Collision.cpp:93 sub_6FD411F0`:
//    `pTmp = &v5[5 * (nY - nCappedY + 4) - nX];` 配合循环 `pTmp -= 5;`，对房间第 r 行取文件第 (4-r) 行。
//
// 本脚本作为永久验收测试，确保：
// 1. 解码后的 `subTileFlags[subY * 5 + subX].raw` 严格等于 OpenDiablo2 的 `subtileLookup[subY][subX]`；
// 2. 严格等于 D2MOO 的 `(4 - subY) * 5 + subX` 逆向公式；
// 3. 只有最下行阻挡的文件（0..4=1），解出后只在 subY=4 阻挡；
// 4. 只有最上行阻挡的文件（20..24=1），解出后只在 subY=0 阻挡。
//
// 运行：npx tsx scripts/verify-collision-orientation.ts

import { decodeDt1, SUB_TILE_GRID } from '../src/common/formats/dt1.ts'
const isSkip = false && !fs.existsSync('samples/d2');
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

/**
 * OpenDiablo2 canonical 5×5 lookup table.
 * `reference/opendiablo2/d2core/d2map/d2mapengine/map_tile.go:17`
 */
const OD2_SUBTILE_LOOKUP = [
  [20, 21, 22, 23, 24], // 房间子格 (x, 0) —— 最上面一行，读文件 20..24
  [15, 16, 17, 18, 19],
  [10, 11, 12, 13, 14],
  [5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4],        // 房间子格 (x, 4) —— 最下面一行，读文件 0..4
] as const

/**
 * D2MOO canonical formula: `(4 - subY) * 5 + subX`.
 */
function d2mooLookup(subX: number, subY: number): number {
  return (4 - subY) * 5 + subX
}

/**
 * 构造一个仅包含头部和一个瓦片记录的最小合法 DT1 二进制字节数组。
 * 瓦片的 25 字节 subTileFlags 按其在文件中的偏移填入 0..24。
 */
function createSyntheticDt1(customFlags?: (fileIndex: number) => number): Uint8Array {
  const tileDataStart = 276
  const tileRecordSize = 96
  const blockHeaderSize = 20
  const blockDataStart = tileDataStart + tileRecordSize + blockHeaderSize
  const totalLength = blockDataStart + 32
  const buf = new Uint8Array(totalLength)
  const view = new DataView(buf.buffer)

  view.setInt32(0, 7, true)
  view.setInt32(4, 6, true)
  view.setInt32(268, 1, true) // 1 tile
  view.setInt32(272, tileDataStart, true)

  const at = tileDataStart
  view.setInt32(at + 0, 0, true) // direction
  view.setInt16(at + 4, 0, true) // roof height
  view.setUint16(at + 6, 0, true) // material flags
  view.setInt32(at + 8, -80, true) // height
  view.setInt32(at + 12, 160, true) // width
  view.setInt32(at + 20, 0, true) // type
  view.setInt32(at + 24, 1, true) // style
  view.setInt32(at + 28, 0, true) // sequence
  view.setInt32(at + 32, 0, true) // rarity

  // 25 字节 flags 在 at + 40
  for (let i = 0; i < 25; i += 1) {
    buf[at + 40 + i] = customFlags ? customFlags(i) : i
  }

  const blockHeaderPointer = tileDataStart + tileRecordSize
  view.setInt32(at + 72, blockHeaderPointer, true)
  view.setInt32(at + 76, blockHeaderSize, true)
  view.setInt32(at + 80, 1, true) // 1 block

  // Block header
  view.setInt16(blockHeaderPointer + 0, 0, true) // x
  view.setInt16(blockHeaderPointer + 2, 0, true) // y
  buf[blockHeaderPointer + 6] = 0 // gridX
  buf[blockHeaderPointer + 7] = 0 // gridY
  view.setInt16(blockHeaderPointer + 8, 0, true) // format (RLE)
  view.setInt32(blockHeaderPointer + 10, 4, true) // length
  view.setInt32(blockHeaderPointer + 16, blockDataStart - blockHeaderPointer, true)

  return buf
}

const checks: { name: string; ok: boolean; detail: string }[] = []

function __check_disabled(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`)
}

function main(): void {
  console.log('== DT1 Collision Orientation Verification ==\n')

  // 1. OD2 lookup table vs D2MOO formula equivalence
  let od2EqualsD2moo = true
  for (let subY = 0; subY < 5; subY += 1) {
    for (let subX = 0; subX < 5; subX += 1) {
      if (OD2_SUBTILE_LOOKUP[subY][subX] !== d2mooLookup(subX, subY)) {
        od2EqualsD2moo = false
      }
    }
  }
  check(
    'reference parity',
    od2EqualsD2moo,
    'OpenDiablo2 subtileLookup and D2MOO formula (4-subY)*5+subX produce identical indices for all 25 sub-tiles',
  )

  // 2. Decode synthetic DT1 with sequential file bytes 0..24
  const dt1Bytes = createSyntheticDt1()
  const decoded = decodeDt1(dt1Bytes)
  check('synthetic decode', decoded.tiles.length === 1, 'decoded 1 synthetic tile')

  const tile = decoded.tiles[0]!
  let mismatchCount = 0
  const mismatches: string[] = []

  for (let subY = 0; subY < SUB_TILE_GRID; subY += 1) {
    for (let subX = 0; subX < SUB_TILE_GRID; subX += 1) {
      const actualRaw = tile.subTileFlags[subY * SUB_TILE_GRID + subX]?.raw
      const expectedFileIndex = OD2_SUBTILE_LOOKUP[subY][subX]
      if (actualRaw !== expectedFileIndex) {
        mismatchCount += 1
        mismatches.push(`subTile(${subX}, ${subY}): actual=${String(actualRaw)}, expected=${String(expectedFileIndex)}`)
      }
    }
  }

  check(
    'row order matches OD2 subtileLookup',
    mismatchCount === 0,
    mismatchCount === 0
      ? 'all 25 sub-tiles mapped from file index to room grid row-order correctly'
      : `${String(mismatchCount)} sub-tiles mismatched: ${mismatches.join(', ')}`,
  )

  // 3. Verify top row (subY = 0) specifically gets file bytes 20..24
  const topRowActual = [0, 1, 2, 3, 4].map(x => tile.subTileFlags[0 * 5 + x]?.raw)
  const topRowExpected = [20, 21, 22, 23, 24]
  check(
    'top row mapping (subY=0)',
    JSON.stringify(topRowActual) === JSON.stringify(topRowExpected),
    `room row 0 (top) reads file bytes [${topRowActual.join(', ')}], expected [${topRowExpected.join(', ')}]`,
  )

  // 4. Verify bottom row (subY = 4) specifically gets file bytes 0..4
  const bottomRowActual = [0, 1, 2, 3, 4].map(x => tile.subTileFlags[4 * 5 + x]?.raw)
  const bottomRowExpected = [0, 1, 2, 3, 4]
  check(
    'bottom row mapping (subY=4)',
    JSON.stringify(bottomRowActual) === JSON.stringify(bottomRowExpected),
    `room row 4 (bottom) reads file bytes [${bottomRowActual.join(', ')}], expected [${bottomRowExpected.join(', ')}]`,
  )

  // 5. Semantic directional test: only file bottom row (0..4) blocked -> decoded subY=4 must block, subY=0 must NOT block
  const fileBottomBlockedDt1 = createSyntheticDt1(fileIdx => (fileIdx < 5 ? 1 : 0))
  const decodedBottomBlocked = decodeDt1(fileBottomBlockedDt1).tiles[0]!
  const subY4Blocked = [0, 1, 2, 3, 4].every(x => decodedBottomBlocked.subTileFlags[4 * 5 + x]?.blockWalk === true)
  const subY0Unblocked = [0, 1, 2, 3, 4].every(x => decodedBottomBlocked.subTileFlags[0 * 5 + x]?.blockWalk === false)
  check(
    'file bottom row is room bottom row',
    subY4Blocked && subY0Unblocked,
    `file bytes 0..4 blocked -> decoded subY=4 blocked: ${String(subY4Blocked)}, subY=0 unblocked: ${String(subY0Unblocked)}`,
  )

  // 6. Semantic directional test: only file top row (20..24) blocked -> decoded subY=0 must block, subY=4 must NOT block
  const fileTopBlockedDt1 = createSyntheticDt1(fileIdx => (fileIdx >= 20 ? 1 : 0))
  const decodedTopBlocked = decodeDt1(fileTopBlockedDt1).tiles[0]!
  const subY0Blocked = [0, 1, 2, 3, 4].every(x => decodedTopBlocked.subTileFlags[0 * 5 + x]?.blockWalk === true)
  const subY4Unblocked = [0, 1, 2, 3, 4].every(x => decodedTopBlocked.subTileFlags[4 * 5 + x]?.blockWalk === false)
  check(
    'file top row is room top row',
    subY0Blocked && subY4Unblocked,
    `file bytes 20..24 blocked -> decoded subY=0 blocked: ${String(subY0Blocked)}, subY=4 unblocked: ${String(subY4Unblocked)}`,
  )

  console.log()
    if ((checks as any).filter((c:any) => !c.ok).length === 0) {
    console.log(`ALL ${String(checks.length)} CHECKS PASSED — DT1 sub-tile orientation verified against OpenDiablo2 and D2MOO`)
    // disabled exit: 0)
  } else {
    console.error(`${String(((checks as any).filter((c:any) => !c.ok).length))} of ${String(checks.length)} CHECKS FAILED`)
    // disabled exit: 1)
  }
}

main()

  suiteCompleted = true;
}
describe('verify-collision-orientation.ts', () => {
  test.skipIf(isSkip)('evaluates script successfully', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
  });
  test.skipIf(isSkip)('reference parity', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('reference parity'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('synthetic decode', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('synthetic decode'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('row order matches OD2 subtileLookup', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('row order matches OD2 subtileLookup'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('top row mapping (subY=0)', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('top row mapping (subY=0)'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('bottom row mapping (subY=4)', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('bottom row mapping (subY=4)'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('file bottom row is room bottom row', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('file bottom row is room bottom row'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
  test.skipIf(isSkip)('file top row is room top row', () => {
    vitestExpect(suiteCompleted, 'Suite failed to complete').toBe(true);
    let resKey = _results.findIndex(x => x.desc.startsWith('file top row is room top row'));
    if (resKey !== -1) vitestExpect(_results[resKey].cond, _results[resKey].detail || _results[resKey].desc).toBe(true);
    else vitestExpect(true).toBe(true);
  });
});