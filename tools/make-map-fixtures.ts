/**
 * Map fixture generator: encode a DT1 tile library and a DS1 map that
 * references it.
 *
 * Written strictly to the published layouts so that an *independent* decoder
 * (the Go reference packages) can read them: if it agrees with this project's
 * TypeScript decoder field by field, the format understanding is confirmed, and
 * if it disagrees the fixtures say exactly which field drifted.
 *
 * Usage: node scripts/make-map-fixtures.ts <output-directory>
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Bytes per DT1 tile record. */
const DT1_TILE_RECORD = 96
/** Bytes per DT1 block header. */
const DT1_BLOCK_HEADER = 20
/** Tile edge in pixels: a Diablo II tile is 5x5 sub-tiles of 32x32. */
const TILE = 160
/** Bytes of fixed preamble before the DT1 tile count. */
const DT1_HEADER_PREFIX = 8 + 260

/**
 * Encode an RLE block body: `(skip, count)` pairs then literals, `(0, 0)`
 * ending a row.
 *
 * @param width - tile width.
 * @param height - tile height.
 * @param base - first palette index used.
 * @returns the run stream.
 */
function encodeBlockRle(width: number, height: number, base: number): Uint8Array {
  const bytes: number[] = []
  for (let y = 0; y < height; y += 1) {
    const start = y % 4
    const count = width - start - (y % 3)
    bytes.push(start, count)
    for (let i = 0; i < count; i += 1) bytes.push(((base + y * 7 + i) & 0xff) || 1)
    bytes.push(0, 0)
  }
  return new Uint8Array(bytes)
}

/**
 * Encode an isometric block body: exactly 256 bytes for the fixed diamond.
 *
 * @param base - first palette index used.
 * @returns the block bytes.
 */
function encodeBlockIsometric(base: number): Uint8Array {
  const bytes = new Uint8Array(256)
  for (let i = 0; i < bytes.byteLength; i += 1) bytes[i] = ((base + i) & 0xff) || 1
  return bytes
}

/**
 * Build a DT1 file with one RLE tile and one isometric tile.
 *
 * @returns the encoded library.
 */
function encodeDt1(): Uint8Array {
  const tiles = [
    { rle: true, type: 0, style: 1, sequence: 0, material: 0x0020, width: TILE, height: -TILE },
    { rle: true, type: 0, style: 1, sequence: 1, material: 0x0008, width: TILE, height: -TILE },
    { rle: false, type: 0, style: 2, sequence: 0, material: 0x0040, width: TILE, height: -TILE },
    { rle: false, type: 0, style: 2, sequence: 1, material: 0x0002, width: TILE, height: -TILE },
  ]
  const tileDataStart = DT1_HEADER_PREFIX + 8
  // Wall tiles store a *negative* height (they grow upward from their anchor), so
  // the encoder has to work from the magnitude.
  const bodies = tiles.map((tile, index) => (tile.rle
    ? encodeBlockRle(tile.width, Math.abs(tile.height), 9 + index * 40)
    : encodeBlockIsometric(70 + index * 40)))

  let bodyOffset = tileDataStart + tiles.length * DT1_TILE_RECORD
  const blockHeaderStart = bodyOffset
  bodyOffset += tiles.length * DT1_BLOCK_HEADER
  const blockDataOffsets: number[] = []
  for (const body of bodies) {
    blockDataOffsets.push(bodyOffset)
    bodyOffset += body.byteLength
  }

  const out = new Uint8Array(bodyOffset)
  const view = new DataView(out.buffer)
  view.setInt32(0, 7, true)
  view.setInt32(4, 6, true)
  view.setInt32(DT1_HEADER_PREFIX, tiles.length, true)
  view.setInt32(DT1_HEADER_PREFIX + 4, tileDataStart, true)

  tiles.forEach((tile, index) => {
    const at = tileDataStart + index * DT1_TILE_RECORD
    view.setInt32(at + 0, 0, true)                    // direction
    view.setInt16(at + 4, 0, true)                    // roof height
    view.setUint16(at + 6, tile.material, true)       // material flags
    view.setInt32(at + 8, tile.height, true)
    view.setInt32(at + 12, tile.width, true)
    view.setInt32(at + 20, tile.type, true)
    view.setInt32(at + 24, tile.style, true)
    view.setInt32(at + 28, tile.sequence, true)
    view.setInt32(at + 32, 0, true)                   // rarity frame index
    // 25 sub-tile flags: a deterministic blocking pattern.
    for (let sub = 0; sub < 25; sub += 1) out[at + 40 + sub] = sub % 3 === 0 ? 0x01 : sub % 5 === 0 ? 0x23 : 0
    view.setInt32(at + 72, blockHeaderStart + index * DT1_BLOCK_HEADER, true)
    view.setInt32(at + 76, DT1_BLOCK_HEADER, true)
    view.setInt32(at + 80, 1, true)                   // one block
    const headerAt = blockHeaderStart + index * DT1_BLOCK_HEADER
    // Block header (20 bytes): X, Y, 2 unused, GridX, GridY, Format, Length,
    // 2 unused, FileOffset — and the offset is relative to this header.
    view.setInt16(headerAt + 0, 0, true)              // block x
    view.setInt16(headerAt + 2, 0, true)              // block y
    out[headerAt + 6] = 0                             // grid x
    out[headerAt + 7] = 0                             // grid y
    view.setInt16(headerAt + 8, tile.rle ? 0 : 1, true)
    view.setInt32(headerAt + 10, bodies[index]!.byteLength, true)
    // The offset is relative to this tile's own block header pointer (each tile
    // has its own), not to the start of the whole block header section.
    view.setInt32(headerAt + 16, blockDataOffsets[index]! - headerAt, true)
    out.set(bodies[index]!, blockDataOffsets[index]!)
  })
  return out
}

/**
 * Build a DS1 map referencing the fixture tiles.
 *
 * Uses version 16 so the file exercises act, wall *and* floor layer counts, the
 * interleaved wall/orientation streams and the object list — and, unlike
 * versions 9..13, carries no unknown byte block.
 *
 * @returns the encoded map.
 */
function encodeDs1(): Uint8Array {
  const version = 16
  const width = 3
  const height = 3
  const wallLayers = 1
  const floorLayers = 1
  const layerOrder: { kind: 'wall' | 'orientation' | 'floor' | 'shadow' }[] = [
    { kind: 'wall' }, { kind: 'orientation' }, { kind: 'floor' }, { kind: 'shadow' },
  ]
  const cellCount = width * height
  const objects = [
    { type: 2, id: 1, x: 1, y: 1, flags: 0 },
    { type: 5, id: 0, x: 2, y: 0, flags: 0x8 },
  ]
  const total = 4 * 3 // version, width-1, height-1
    + 4 // act
    + 4 // substitution type
    + 4 // embedded file count
    + 4 + 4 // wall layers, floor layers
    + layerOrder.length * cellCount * 4
    + 4 + objects.length * 20
    + 4 // NPC count (version 14+ carries NPC paths after the objects)
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  let at = 0
  view.setInt32(at, version, true); at += 4
  view.setInt32(at, width - 1, true); at += 4
  view.setInt32(at, height - 1, true); at += 4
  view.setInt32(at, 2, true); at += 4            // act
  view.setInt32(at, 0, true); at += 4            // substitution type
  view.setInt32(at, 0, true); at += 4            // embedded file count
  view.setInt32(at, wallLayers, true); at += 4
  view.setInt32(at, floorLayers, true); at += 4

  for (const layer of layerOrder) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const seed = (y * width + x) & 0xff
        let bits: number
        switch (layer.kind) {
          case 'wall':
            // Style 2 holds the two wall tiles; sequence picks between them.
            bits = (seed | (((x + y) % 2) << 8) | (2 << 20)) >>> 0
            break
          case 'orientation':
            bits = 0
            break
          case 'floor':
            // Style 1 holds the two floor tiles.
            bits = ((seed + 1) | (((x * 3 + y) % 2) << 8) | (1 << 20)) >>> 0
            break
          case 'shadow':
            bits = (seed % 8) >>> 0
            break
        }
        view.setUint32(at, bits >>> 0, true); at += 4
      }
    }
  }

  view.setInt32(at, objects.length, true); at += 4
  for (const object of objects) {
    view.setInt32(at, object.type, true); at += 4
    view.setInt32(at, object.id, true); at += 4
    view.setInt32(at, object.x, true); at += 4
    view.setInt32(at, object.y, true); at += 4
    view.setInt32(at, object.flags, true); at += 4
  }
  // No NPC paths in the fixture: the section's count is zero, which is what
  // version 14+ readers look for after the objects.
  view.setInt32(at, 0, true); at += 4
  return out
}

const outDir = process.argv[2]
if (outDir === undefined) {
  console.error('usage: node scripts/make-map-fixtures.ts <output-directory>')
  process.exit(2)
}
await mkdir(outDir, { recursive: true })
const dt1 = encodeDt1()
const ds1 = encodeDs1()
await writeFile(join(outDir, 'fixture.dt1'), dt1)
await writeFile(join(outDir, 'fixture.ds1'), ds1)

/**
 * The pixel grid each fixture tile is expected to decode to, computed from the
 * same parameters the encoder used. Independent of the decoder under test —
 * which is the point: it turns "the decoder did not throw" into "the decoder put
 * every pixel where the encoder put it".
 */
const tileWidth = TILE
const tileHeight = TILE
const expectedTiles: { format: number; base: number; pixels: number[] }[] = []
for (const [index, rle] of [true, true, false, false].entries()) {
  const base = rle ? 9 + index * 40 : 70 + index * 40
  const pixels = new Array<number>(tileWidth * tileHeight).fill(0)
  if (rle) {
    for (let y = 0; y < tileHeight; y += 1) {
      const start = y % 4
      const count = tileWidth - start - (y % 3)
      for (let i = 0; i < count; i += 1) pixels[y * tileWidth + start + i] = ((base + y * 7 + i) & 0xff) || 1
    }
  } else {
    const jump = [14, 12, 10, 8, 6, 4, 2, 0, 2, 4, 6, 8, 10, 12, 14]
    const run = [4, 8, 12, 16, 20, 24, 28, 32, 28, 24, 20, 16, 12, 8, 4]
    let at = 0
    for (let row = 0; row < jump.length; row += 1) {
      for (let i = 0; i < run[row]!; i += 1) {
        pixels[row * tileWidth + jump[row]! + i] = ((base + at) & 0xff) || 1
        at += 1
      }
    }
  }
  expectedTiles.push({ format: rle ? 0 : 1, base, pixels })
}
await writeFile(join(outDir, 'expected-dt1.json'), JSON.stringify({ width: tileWidth, height: tileHeight, tiles: expectedTiles }))

console.log(`wrote ${join(outDir, 'fixture.dt1')} (${String(dt1.byteLength)} bytes)`)
console.log(`wrote ${join(outDir, 'fixture.ds1')} (${String(ds1.byteLength)} bytes)`)
console.log(`wrote ${join(outDir, 'expected-dt1.json')}`)
