import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

export interface VecRow {
  va: string
  name: string
  case: string
  args: number[]
  ret: number
  exc: number
  out: number[]
}

export const ADDR_BITMASKS = 0x20000000
export const ADDR_OUT0 = 0x20000100
export const ADDR_OUT1 = 0x20000180
export const ADDR_OUT_COMP = 0x20000200
export const ADDR_OUT_COLOR = 0x20000240
export const ADDR_LVLMAZE_TXT = 0x20000400
export const ADDR_LVLSUB_IDX = 0x20000800
export const ADDR_DATATABLES = 0x20001000
export const ADDR_ITEMS_TXT = 0x20002000
export const ADDR_ITEMTYPES_EQ = 0x20006000
export const ADDR_SETITEMS_TXT = 0x2000a000
export const ADDR_SETS_TXT = 0x2000b000
export const ADDR_CHARSTATS_TXT = 0x2000c000
export const ADDR_ISC_TXT = 0x2000e000
export const ADDR_LEVEL_DEFS = 0x20010000
export const ADDR_OBJECTS_TXT = 0x20016000
export const ADDR_COLLMAP_BUF = 0x20040000
export const ADDR_MONSTATS_TXT = 0x20050000
export const ADDR_LVLTYPES_TXT = 0x20060000
export const ADDR_ITEMTYPES_TXT = 0x20068000
export const ADDR_LVLSUB_TXT = 0x20070000
export const ADDR_LVLWARP_TXT = 0x20078000
export const ADDR_LVLPREST_TXT = 0x20080000

export const ADDR_ACT = 0x20020000
export const ADDR_DRLG = 0x20020200
export const ADDR_LVL0 = 0x20020800
export const ADDR_LVL1 = 0x20020b00
export const ADDR_LVL2 = 0x20020e00
export const ADDR_OUTDOORS = 0x20021100
export const ADDR_RX0 = 0x20021500
export const ADDR_RX1 = 0x20021700
export const ADDR_RX2 = 0x20021900
export const ADDR_ROOM0 = 0x20021b00
export const ADDR_ROOM1 = 0x20021d00
export const ADDR_NEAR_ARR = 0x20021f00
export const ADDR_GRID0_CELLS = 0x20022000
export const ADDR_GRID0_ROWS = 0x20022400
export const ADDR_GRID1_CELLS = 0x20022500
export const ADDR_GRID1_ROWS = 0x20022900
export const ADDR_GRID2_CELLS = 0x20022a00
export const ADDR_GRID2_ROWS = 0x20022e00
export const ADDR_GRID3_CELLS = 0x20022f00
export const ADDR_GRID3_ROWS = 0x20023300
export const ADDR_V0 = 0x20023400
export const ADDR_V1 = 0x20023440
export const ADDR_V2 = 0x20023480
export const ADDR_V3 = 0x200234c0
export const ADDR_ORTH0 = 0x20023500
export const ADDR_ORTH1 = 0x20023540
export const ADDR_PRESET0 = 0x20023600
export const ADDR_RT0 = 0x20023700
export const ADDR_MAZEGRID = 0x20023800
export const ADDR_MGRID_CELLS = 0x20023900
export const ADDR_MGRID_ROWS = 0x20023d00
export const ADDR_RECT = 0x20023e00
export const ADDR_UNIT0 = 0x20024000
export const ADDR_INV0 = 0x20024200
export const ADDR_ITEM0 = 0x20024300
export const ADDR_ITEMDATA0 = 0x20024500
export const ADDR_SLISTEX = 0x20024600
export const ADDR_SLIST0 = 0x20024700
export const ADDR_STATS0 = 0x20024800
export const ADDR_CTX = 0x20030000

const __dirname = dirname(fileURLToPath(import.meta.url))

export function loadVectors(batch: 1 | 2 | 3): VecRow[] {
  const p = resolve(__dirname, `../../fixtures/oracle/k1/i14b-${batch}-vectors.ndjson`)
  return readFileSync(p, 'utf8')
    .trim()
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as VecRow)
}

function isOutdoorLinkLevel(lid: number): boolean {
  if (lid >= 1 && lid <= 8) return true
  if (lid === 17 || lid === 26 || lid === 27 || lid === 28 || lid === 32 || lid === 33 || lid === 39) return true
  if (lid >= 40 && lid <= 46) return true
  if (lid >= 75 && lid <= 83) return true
  if (lid >= 103 && lid <= 112) return true
  if (lid === 117 || lid === 134 || lid === 136) return true
  return false
}

export function createArenaMem(): SparseMemory113c {
  const m = new SparseMemory113c()
  // Map arena at 0x20000000 (covering ADDR_LVLPREST_TXT + 1000 * 0x1b0) and D2Common globals
  m.loadBlock(0x20000000, new Uint8Array(0x140000))
  m.loadBlock(0x6fdd9000, new Uint8Array(0x20000))
  resetArena(m)
  return m
}

export function resetArena(m: SparseMemory113c): void {
  m.fill(0x20000000, 0x130000, 0)
  for (let i = 0; i < 32; i++) {
    m.setU32((ADDR_BITMASKS + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(0x6fdd90b0, ADDR_BITMASKS)
  m.setU32(0x6fde9e1c, ADDR_DATATABLES)
  m.setU32(0x6fdefb94, 16)
  m.setU32(0x6fdefb98, ADDR_ITEMS_TXT)
  m.setU32(0x6fdefbbc, ADDR_LVLWARP_TXT)
  m.setU32(0x6fdefbc0, 16)
  m.setU32(0x6fdf0b38, ADDR_LEVEL_DEFS)
  m.setU32(0x6fdf0b3c, ADDR_LVLPREST_TXT)
  // D2Common .data 0x6FDED378: body-loc grid 0 definition { nGridX = 13, nGridY = 1 } (read by 0x6FD6E1B0)
  m.setU8(0x6fded378, 13)
  m.setU8(0x6fded379, 1)
  m.setU32(0x6fdf0b94, ADDR_OBJECTS_TXT)
  m.setU32(0x6fdf0b98, 64)
  m.setU32(0x6fdf142c, ADDR_LVLTYPES_TXT)
  m.setU32(0x6fdf1430, 40)
  m.setU32(0x6fdf1434, ADDR_LVLMAZE_TXT)
  m.setU32(0x6fdf1438, 16)
  m.setU32(0x6fdf143c, ADDR_LVLSUB_TXT)
  m.setU32(0x6fdf1440, 16)
  m.setU32(0x6fdf1444, ADDR_LVLSUB_IDX)

  m.setU32(ADDR_LVLMAZE_TXT, 2)
  m.setU8(ADDR_LVLMAZE_TXT + 0x05, 1)
  m.setU8(ADDR_LVLMAZE_TXT + 0x2c, 0x62)
  m.setU32(ADDR_LVLMAZE_TXT + 0x30, 0)
  m.setU8(ADDR_LVLMAZE_TXT + 0x30 + 0x2c, 0x62)

  m.setU32(ADDR_ITEMS_TXT, 2)
  m.setU8(ADDR_ITEMS_TXT + 0x05, 1)
  m.setU32(ADDR_ITEMS_TXT + 0x30, 0)
  m.setU8(ADDR_ITEMS_TXT + 0x30 + 0x2c, 0x62)

  for (let i = 0; i < 16; i++) {
    m.setU32((ADDR_LVLSUB_TXT + i * 0x15c) >>> 0, 0xffffffff)
  }
  for (let i = 0; i < 1000; i++) {
    const p = (ADDR_LVLPREST_TXT + i * 0x1b0) >>> 0
    m.setU32(p, i >>> 0)
    m.setU32(p + 0x28, 8)
    m.setU32(p + 0x2c, 8)
    m.setU32(p + 0x40, 2)
  }

  m.setU32(0x6fddcab8, 0x03020100)
  m.setU32(0x6fddcab8 + 4, 0x01010100)
  m.setU32(0x6fddcab8 + 8, 0x02010203)
  m.setU32(0x6fddcab8 + 12, 0x01020300)

  m.setU32(ADDR_DATATABLES + 0xa78, ADDR_MONSTATS_TXT)
  m.setU32(ADDR_DATATABLES + 0xa80, 512)
  m.setU32(ADDR_DATATABLES + 0xbc4, ADDR_CHARSTATS_TXT)
  m.setU32(ADDR_DATATABLES + 0xbc8, 7)
  m.setU32(ADDR_DATATABLES + 0xbcc, ADDR_ISC_TXT)
  m.setU32(ADDR_DATATABLES + 0xbd4, 32)
  m.setU32(ADDR_DATATABLES + 0xbf8, ADDR_ITEMTYPES_TXT)
  m.setU32(ADDR_DATATABLES + 0xbfc, 80)
  m.setU32(ADDR_DATATABLES + 0xc00, 4)
  m.setU32(ADDR_DATATABLES + 0xc04, ADDR_ITEMTYPES_EQ)
  m.setU32(ADDR_DATATABLES + 0xc08, ADDR_SETITEMS_TXT)
  m.setU32(ADDR_DATATABLES + 0xc0c, ADDR_SETS_TXT)
  m.setU32(ADDR_DATATABLES + 0xc10, 4)
  m.setU32(ADDR_DATATABLES + 0xc14, ADDR_SETS_TXT)
  m.setU32(ADDR_DATATABLES + 0xc18, ADDR_SETITEMS_TXT)
  m.setU32(ADDR_DATATABLES + 0xc1c, 4)
  m.setU32(ADDR_DATATABLES + 0xc5c, 137)
  m.setU32(ADDR_DATATABLES + 0xc64, ADDR_LVLPREST_TXT)
  m.setU32(ADDR_DATATABLES + 0xc68, 1000)

  for (let lid = 0; lid < 137; lid++) {
    const base = (ADDR_LEVEL_DEFS + lid * 0x9c) >>> 0
    const sz = lid >= 0x4b && lid <= 0x53 ? 80 : 16
    m.setU32(base + 0x0c, sz)
    m.setU32(base + 0x10, sz + 8)
    m.setU32(base + 0x14, sz + 16)
    m.setU32(base + 0x18, sz)
    m.setU32(base + 0x1c, sz + 8)
    m.setU32(base + 0x20, sz + 16)
    m.setU32(base + 0x24, (100 + (lid % 16) * 128) >>> 0)
    m.setU32(base + 0x28, (200 + Math.floor(lid / 16) * 128) >>> 0)
    m.setU32(base + 0x38, 0xffffffff)
    m.setU32(base + 0x3c, 0xffffffff)
    if (isOutdoorLinkLevel(lid)) {
      m.setU32(base + 0x30, 3)
    }
  }
}

export function setupGrid(m: SparseMemory113c, rows: number, w: number, h: number): void {
  for (let y = 0; y < h; y++) {
    m.setU32((rows + y * 4) >>> 0, (y * w) >>> 0)
  }
}

export function setupOutdoorsBasic(
  m: SparseMemory113c,
  levelId: number,
  levelType: number,
  gw: number,
  gh: number,
): void {
  m.setU32(ADDR_LVL0 + 0x00, 3)
  m.setU32(ADDR_LVL0 + 0x14, ADDR_OUTDOORS)
  m.setU32(ADDR_LVL0 + 0x1c, 100)
  m.setU32(ADDR_LVL0 + 0x20, 200)
  m.setU32(ADDR_LVL0 + 0x24, (gw * 8) >>> 0)
  m.setU32(ADDR_LVL0 + 0x28, (gh * 8) >>> 0)
  m.setU32(ADDR_LVL0 + 0x1b4, ADDR_DRLG)
  m.setU32(ADDR_LVL0 + 0x1c0, levelType >>> 0)
  m.setU32(ADDR_LVL0 + 0x1c4, 0x12345678)
  m.setU32(ADDR_LVL0 + 0x1c8, 0x29a)
  m.setU32(ADDR_LVL0 + 0x1d0, levelId >>> 0)

  m.setU32(ADDR_DRLG + 0x00, 0x12345678)
  m.setU32(ADDR_DRLG + 0x04, 0x29a)
  m.setU32(ADDR_DRLG + 0x454, 0x12345678)
  m.setU32(ADDR_DRLG + 0x458, 0x9abcdef0)
  m.setU32(ADDR_DRLG + 0x46c, ADDR_ACT)
  m.setU32(ADDR_DRLG + 0x470, 0x1111)
  m.setU32(ADDR_DRLG + 0x47c, ADDR_LVL0)

  m.setU32(ADDR_OUTDOORS + 0x04, ADDR_GRID0_CELLS)
  m.setU32(ADDR_OUTDOORS + 0x08, ADDR_GRID0_ROWS)
  m.setU32(ADDR_OUTDOORS + 0x0c, gw >>> 0)
  m.setU32(ADDR_OUTDOORS + 0x10, gh >>> 0)
  m.setU32(ADDR_OUTDOORS + 0x18, ADDR_GRID1_CELLS)
  m.setU32(ADDR_OUTDOORS + 0x1c, ADDR_GRID1_ROWS)
  m.setU32(ADDR_OUTDOORS + 0x20, gw >>> 0)
  m.setU32(ADDR_OUTDOORS + 0x24, gh >>> 0)
  m.setU32(ADDR_OUTDOORS + 0x2c, ADDR_GRID2_CELLS)
  m.setU32(ADDR_OUTDOORS + 0x30, ADDR_GRID2_ROWS)
  m.setU32(ADDR_OUTDOORS + 0x34, gw >>> 0)
  m.setU32(ADDR_OUTDOORS + 0x38, gh >>> 0)
  m.setU32(ADDR_OUTDOORS + 0x40, ADDR_GRID3_CELLS)
  m.setU32(ADDR_OUTDOORS + 0x44, ADDR_GRID3_ROWS)
  m.setU32(ADDR_OUTDOORS + 0x48, gw >>> 0)
  m.setU32(ADDR_OUTDOORS + 0x4c, gh >>> 0)
  m.setU32(ADDR_OUTDOORS + 0x5c, gw >>> 0)
  m.setU32(ADDR_OUTDOORS + 0x60, gh >>> 0)
  m.setU32(ADDR_OUTDOORS + 0x64, ADDR_V0)
  setupGrid(m, ADDR_GRID0_ROWS, gw, gh)
  setupGrid(m, ADDR_GRID1_ROWS, gw, gh)
  setupGrid(m, ADDR_GRID2_ROWS, gw, gh)
  setupGrid(m, ADDR_GRID3_ROWS, gw, gh)

  m.setU32(ADDR_V0 + 0x00, 1); m.setU32(ADDR_V0 + 0x04, 1); m.setU8(ADDR_V0 + 0x08, 0); m.setU32(ADDR_V0 + 0x0c, 2); m.setU32(ADDR_V0 + 0x10, ADDR_V1)
  m.setU32(ADDR_V1 + 0x00, 5); m.setU32(ADDR_V1 + 0x04, 1); m.setU8(ADDR_V1 + 0x08, 0); m.setU32(ADDR_V1 + 0x0c, 2); m.setU32(ADDR_V1 + 0x10, ADDR_V2)
  m.setU32(ADDR_V2 + 0x00, 5); m.setU32(ADDR_V2 + 0x04, 5); m.setU8(ADDR_V2 + 0x08, 0); m.setU32(ADDR_V2 + 0x0c, 2); m.setU32(ADDR_V2 + 0x10, ADDR_V3)
  m.setU32(ADDR_V3 + 0x00, 1); m.setU32(ADDR_V3 + 0x04, 5); m.setU8(ADDR_V3 + 0x08, 0); m.setU32(ADDR_V3 + 0x0c, 2); m.setU32(ADDR_V3 + 0x10, ADDR_V0)
}
