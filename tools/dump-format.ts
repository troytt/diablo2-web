/**
 * Canonical dumper: print a decoded Diablo II format file as the same JSON shape
 * the Go reference dumper emits, so the two can be diffed field by field.
 *
 * Usage: node scripts/dump-format.ts <dc6|dt1|ds1> <file>
 */
import { readFile } from 'node:fs/promises'
import { decodeDc6 } from '../src/common/formats/dc6.ts'
import { decodeDt1 } from '../src/common/formats/dt1.ts'
import { decodeDs1 } from '../src/common/formats/ds1.ts'
import { decodePl2 } from '../src/common/formats/pl2.ts'

const [format, path] = process.argv.slice(2)
if (format === undefined || path === undefined) {
  console.error('usage: node scripts/dump-format.ts <dc6|dt1|ds1> <file>')
  process.exit(2)
}
const data = new Uint8Array(await readFile(path))

let output: unknown
switch (format) {
  case 'dc6': {
    const sheet = decodeDc6(data)
    output = {
      format: 'dc6',
      directions: sheet.header.directions,
      framesPerDirection: sheet.header.framesPerDirection,
      frames: sheet.groups.map(group => group.frames.map(frame => ({
        width: frame.width,
        height: frame.height,
        offsetX: frame.offsetX,
        offsetY: frame.offsetY,
        indices: [...frame.indices],
      }))),
    }
    break
  }
  case 'dt1': {
    const library = decodeDt1(data)
    output = {
      format: 'dt1',
      tiles: library.tiles.map(tile => ({
        direction: tile.direction,
        height: tile.height,
        width: tile.width,
        type: tile.type,
        style: tile.style,
        sequence: tile.sequence,
        materialFlags: tile.materialFlags,
        subTileFlags: tile.subTileFlags.map(flag => flag.raw),
        blocks: tile.blocks.map(block => ({
          x: block.x,
          y: block.y,
          gridX: block.gridX,
          gridY: block.gridY,
          format: block.format,
          pixels: [...block.pixels],
        })),
      })),
    }
    break
  }
  case 'ds1': {
    const level = decodeDs1(data)
    output = {
      format: 'ds1',
      version: level.version,
      width: level.width,
      height: level.height,
      act: level.act,
      wallLayers: level.wallLayers,
      floorLayers: level.floorLayers,
      cells: level.cells.map(row => row.map(cell => ({
        walls: cell.walls.map(wall => ({
          prop1: wall.prop1, sequence: wall.sequence, style: wall.style, type: wall.type,
          unknown1: wall.unknown1, unknown2: wall.unknown2, hidden: wall.hidden,
        })),
        floors: cell.floors.map(floor => ({
          prop1: floor.prop1, sequence: floor.sequence, style: floor.style,
          unknown1: floor.unknown1, unknown2: floor.unknown2, hidden: floor.hidden,
        })),
        shadows: cell.shadows.map(shadow => ({
          prop1: shadow.prop1, sequence: shadow.sequence, style: shadow.style,
          unknown1: shadow.unknown1, unknown2: shadow.unknown2, hidden: shadow.hidden,
        })),
      }))),
      objects: level.objects.map(object => ({
        type: object.type, id: object.id, x: object.x, y: object.y, flags: object.flags,
      })),
    }
    break
  }
  case 'pl2': {
    const palette = decodePl2(data)
    // Same digest and grouping as the reference dumper, so the two can be
    // compared array for array.
    const digest = (table: Uint8Array): number => {
      let hash = 2166136261
      for (const byte of table) {
        hash ^= byte
        hash = Math.imul(hash, 16777619) >>> 0
      }
      return hash >>> 0
    }
    const digests = (tables: readonly Uint8Array[]): number[] => tables.map(digest)
    output = {
      format: 'pl2',
      size: data.byteLength,
      base: [...palette.rgb],
      text: [...palette.textRgb],
      groups: {
        lightLevels: digests(palette.lightLevels),
        inverseColors: digests(palette.inverseColors),
        selectedUnitShift: digests([palette.selectedUnitShift]),
        alphaBlend: digests(palette.alphaBlend.flat()),
        additiveBlend: digests(palette.additiveBlend),
        multiplyBlend: digests(palette.multiplyBlend),
        hueVariations: digests(palette.hueVariations),
        redTones: digests([palette.redTones]),
        greenTones: digests([palette.greenTones]),
        blueTones: digests([palette.blueTones]),
        unknownVariations: digests(palette.unknownVariations),
        maxComponentBlend: digests(palette.maxComponentBlend),
        darkenedShift: digests([palette.darkenedShift]),
        textShifts: digests(palette.textShifts),
      },
    }
    break
  }
  default: {
    console.error(`unknown format: ${format}`)
    process.exit(2)
  }
}
console.log(JSON.stringify(output, null, 2))
