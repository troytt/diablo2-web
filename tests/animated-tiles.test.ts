import { describe, expect, test } from 'vitest'
import {
  advanceFrameIndex,
  computeFrameIndexFromTick,
  computeFrameIndexFromTime,
  DEFAULT_ANIMATED_TILE_FRAME_DURATION_MS,
  DEFAULT_TICKS_PER_ANIMATED_FRAME,
  updateAnimatableTile,
  updateAnimatableTiles,
} from '../src/common/world/animated-tiles.ts'
import type { AnimatableTile } from '../src/common/world/animated-tiles.ts'
import { decodeDt1, isAnimatedTile, subTileFlagsOf } from '../src/common/formats/dt1.ts'
import type { Dt1, Dt1Tile } from '../src/common/formats/dt1.ts'
import { buildIsoMapScene } from '../src/common/world/d2map.ts'
import type { Ds1 } from '../src/common/formats/ds1.ts'

describe('Animated Tiles (Issue #43)', () => {
  describe('DT1 Animated Tile Detection', () => {
    test('isAnimatedTile correctly identifies animated flag byte', () => {
      expect(isAnimatedTile({ animated: 0 })).toBe(false)
      expect(isAnimatedTile({})).toBe(false)
      expect(isAnimatedTile({ animated: 1 })).toBe(true)
      expect(isAnimatedTile({ animated: 3 })).toBe(true)
      expect(isAnimatedTile({ animated: 0x81 })).toBe(true)
    })

    test('only TILE_FLAGS_LAVA (0x100 = bit 0 of byte +7) animates; snow 0x400 does not (issue #923)', () => {
      // 1.13c D2Common 0x6fd62f20 / 0x6fd62ff0: D2CMP.#10051 (u16 flags at +6) then `test ah, 0x1`.
      expect(isAnimatedTile({ animated: 0x400 >> 8 })).toBe(false) // Act 5 siege\snow.dt1 / cliff.dt1 snow floors
      expect(isAnimatedTile({ animated: 2 })).toBe(false)
      expect(isAnimatedTile({ animated: 0x80 })).toBe(false)
      expect(isAnimatedTile({ animated: 0x100 >> 8 })).toBe(true) // Act 4 lava\floor.dt1 River of Flame lava
      expect(isAnimatedTile({ animated: 5 })).toBe(true)
    })

    test('decodeDt1 parses animated flag at offset +7', () => {
      // Construct a minimal valid DT1 buffer with 1 tile
      // DT1 header:
      // 0..3: magic1 (7)
      // 4..7: magic2 (6)
      // 8..267: unused header bytes (260 bytes zeros)
      // 268..271: tileCount (1)
      // 272..275: tileOffset (276)
      // Tile header at 276:
      // +0: direction (i32: 1)
      // +4: roofHeight (i16: 0)
      // +6: materialFlags (u16: 0)
      // +7: animated (u8: 1)  <-- tested byte
      // +8: height (i32: -80)
      // +12: width (i32: 160)
      // +16: unused (4 bytes)
      // +20: type (i32: 0)
      // +24: style (i32: 1)
      // +28: sequence (i32: 2)
      // +32: rarityFrameIndex (i32: 0)
      // +36..+59: subTileFlags (20 bytes)
      // +60..+79: unused (20 bytes)
      // +80: blockHeaderPointer (i32: 0)
      // +84: blockDataOffset (i32: 0)
      // +88: blockCount (i32: 0)
      // Total tile header size = 96 bytes.
      const buffer = new Uint8Array(276 + 96)
      const view = new DataView(buffer.buffer)
      view.setInt32(0, 7, true)
      view.setInt32(4, 6, true)
      view.setInt32(268, 1, true)
      view.setInt32(272, 276, true)

      const tileAt = 276
      view.setInt32(tileAt + 0, 1, true) // direction
      view.setInt16(tileAt + 4, 0, true) // roofHeight
      view.setUint16(tileAt + 6, 0, true) // materialFlags
      buffer[tileAt + 7] = 1 // animated flag
      view.setInt32(tileAt + 8, -80, true) // height
      view.setInt32(tileAt + 12, 160, true) // width
      view.setInt32(tileAt + 20, 0, true) // type
      view.setInt32(tileAt + 24, 1, true) // style
      view.setInt32(tileAt + 28, 2, true) // sequence
      view.setInt32(tileAt + 32, 0, true) // rarityFrameIndex (frame 0)

      const dt1 = decodeDt1(buffer)
      expect(dt1.tiles.length).toBe(1)
      const tile = dt1.tiles[0]!
      expect(tile.animated).toBe(1)
      expect(isAnimatedTile(tile)).toBe(true)
      expect(tile.rarityFrameIndex).toBe(0)
    })
  })

  describe('Frame Advancement & Timing', () => {
    test('computeFrameIndexFromTime handles millisecond time advancement', () => {
      const frameCount = 4
      const duration = DEFAULT_ANIMATED_TILE_FRAME_DURATION_MS // 128ms (Diablo II 1.13c speed 80)

      expect(computeFrameIndexFromTime(0, frameCount, duration)).toBe(0)
      expect(computeFrameIndexFromTime(64, frameCount, duration)).toBe(0)
      expect(computeFrameIndexFromTime(128, frameCount, duration)).toBe(1)
      expect(computeFrameIndexFromTime(255, frameCount, duration)).toBe(1)
      expect(computeFrameIndexFromTime(256, frameCount, duration)).toBe(2)
      expect(computeFrameIndexFromTime(400, frameCount, duration)).toBe(3)
    })

    test('computeFrameIndexFromTime supports custom duration', () => {
      const frameCount = 5
      const duration = 50 // 50ms per frame = 20 FPS

      expect(computeFrameIndexFromTime(0, frameCount, duration)).toBe(0)
      expect(computeFrameIndexFromTime(49, frameCount, duration)).toBe(0)
      expect(computeFrameIndexFromTime(50, frameCount, duration)).toBe(1)
      expect(computeFrameIndexFromTime(150, frameCount, duration)).toBe(3)
    })

    test('computeFrameIndexFromTime gracefully handles single-frame or invalid frame count', () => {
      expect(computeFrameIndexFromTime(1000, 1)).toBe(0)
      expect(computeFrameIndexFromTime(1000, 0)).toBe(0)
      expect(computeFrameIndexFromTime(-500, 4)).toBe(0)
    })

    test('computeFrameIndexFromTick handles 25Hz game ticks', () => {
      const frameCount = 4
      const ticksPerFrame = DEFAULT_TICKS_PER_ANIMATED_FRAME // 2.5 ticks / frame

      expect(computeFrameIndexFromTick(0, frameCount, ticksPerFrame)).toBe(0)
      expect(computeFrameIndexFromTick(2, frameCount, ticksPerFrame)).toBe(0) // 2 / 2.5 = 0.8 -> 0
      expect(computeFrameIndexFromTick(3, frameCount, ticksPerFrame)).toBe(1) // 3 / 2.5 = 1.2 -> 1
      expect(computeFrameIndexFromTick(5, frameCount, ticksPerFrame)).toBe(2) // 5 / 2.5 = 2.0 -> 2
      expect(computeFrameIndexFromTick(7, frameCount, ticksPerFrame)).toBe(2) // 7 / 2.5 = 2.8 -> 2
      expect(computeFrameIndexFromTick(8, frameCount, ticksPerFrame)).toBe(3) // 8 / 2.5 = 3.2 -> 3
    })

    test('advanceFrameIndex manual frame increment and wrapping', () => {
      expect(advanceFrameIndex(0, 4)).toBe(1)
      expect(advanceFrameIndex(1, 4)).toBe(2)
      expect(advanceFrameIndex(2, 4)).toBe(3)
      expect(advanceFrameIndex(3, 4)).toBe(0) // Wrap!
      expect(advanceFrameIndex(0, 4, 5)).toBe(1) // Advance 5 frames: 5 % 4 = 1
      expect(advanceFrameIndex(2, 1)).toBe(0)
    })
  })

  describe('Cycle Wrapping (Continuous Loop Playback)', () => {
    test('time-based cycling loops indefinitely without drift', () => {
      const frameCount = 3
      const duration = 100 // ms

      // Cycle 0: 0..299ms
      expect(computeFrameIndexFromTime(0, frameCount, duration)).toBe(0)
      expect(computeFrameIndexFromTime(100, frameCount, duration)).toBe(1)
      expect(computeFrameIndexFromTime(200, frameCount, duration)).toBe(2)

      // Cycle 1: 300..599ms
      expect(computeFrameIndexFromTime(300, frameCount, duration)).toBe(0)
      expect(computeFrameIndexFromTime(400, frameCount, duration)).toBe(1)
      expect(computeFrameIndexFromTime(500, frameCount, duration)).toBe(2)

      // Cycle 100: 30000ms
      expect(computeFrameIndexFromTime(30000, frameCount, duration)).toBe(0)
      expect(computeFrameIndexFromTime(30150, frameCount, duration)).toBe(1)
      expect(computeFrameIndexFromTime(30250, frameCount, duration)).toBe(2)
    })

    test('tick-based cycling loops indefinitely', () => {
      const frameCount = 4
      const ticksPerFrame = 2.5 // total cycle = 10 ticks

      // Cycle 0: ticks 0..9
      expect(computeFrameIndexFromTick(0, frameCount, ticksPerFrame)).toBe(0)
      expect(computeFrameIndexFromTick(3, frameCount, ticksPerFrame)).toBe(1)
      expect(computeFrameIndexFromTick(5, frameCount, ticksPerFrame)).toBe(2)
      expect(computeFrameIndexFromTick(8, frameCount, ticksPerFrame)).toBe(3)

      // Cycle 1: ticks 10..19
      expect(computeFrameIndexFromTick(10, frameCount, ticksPerFrame)).toBe(0)
      expect(computeFrameIndexFromTick(13, frameCount, ticksPerFrame)).toBe(1)
      expect(computeFrameIndexFromTick(15, frameCount, ticksPerFrame)).toBe(2)
      expect(computeFrameIndexFromTick(18, frameCount, ticksPerFrame)).toBe(3)
    })
  })

  describe('AnimatableTile Mutator Functions', () => {
    test('updateAnimatableTile updates frame and page in-place', () => {
      const frame0 = { x: 0, y: 0, width: 160, height: 80 }
      const frame1 = { x: 160, y: 0, width: 160, height: 80 }
      const frame2 = { x: 320, y: 0, width: 160, height: 80 }

      const tile: AnimatableTile = {
        frame: frame0,
        page: 0,
        animatedFrames: [
          { frame: frame0, page: 0 },
          { frame: frame1, page: 0 },
          { frame: frame2, page: 1 },
        ],
      }

      // At 0ms -> frame0, page 0
      updateAnimatableTile(tile, 0, 'time', 100)
      expect(tile.frame).toBe(frame0)
      expect(tile.page).toBe(0)

      // At 150ms -> frame1, page 0
      updateAnimatableTile(tile, 150, 'time', 100)
      expect(tile.frame).toBe(frame1)
      expect(tile.page).toBe(0)

      // At 250ms -> frame2, page 1
      updateAnimatableTile(tile, 250, 'time', 100)
      expect(tile.frame).toBe(frame2)
      expect(tile.page).toBe(1)

      // At 350ms -> wraps back to frame0, page 0
      updateAnimatableTile(tile, 350, 'time', 100)
      expect(tile.frame).toBe(frame0)
      expect(tile.page).toBe(0)
    })

    test('updateAnimatableTiles updates an array of animatable tiles', () => {
      const f0 = { x: 0, y: 0, width: 160, height: 80 }
      const f1 = { x: 160, y: 0, width: 160, height: 80 }

      const tileA: AnimatableTile = {
        frame: f0,
        page: 0,
        animatedFrames: [{ frame: f0, page: 0 }, { frame: f1, page: 0 }],
      }
      const tileB: AnimatableTile = {
        frame: f0,
        page: 0,
        animatedFrames: [{ frame: f0, page: 0 }, { frame: f1, page: 0 }],
      }
      const staticTile: AnimatableTile = {
        frame: f0,
        page: 0,
      }

      const list = [tileA, tileB, staticTile]

      updateAnimatableTiles(list, 150, 'time', 100)
      expect(tileA.frame).toBe(f1)
      expect(tileB.frame).toBe(f1)
      expect(staticTile.frame).toBe(f0) // Unchanged
    })
  })

  describe('d2map buildIsoMapScene Animated Sequence Resolution', () => {
    test('resolves multi-frame animated tiles into sequential animatedFrames', () => {
      // Create 3 DT1 tiles with same style, sequence, type, with animated flag = 1
      // and frame indices 0, 1, 2
      const makeTile = (frameIndex: number): Dt1Tile => ({
        direction: 1,
        roofHeight: 0,
        materialFlags: 0,
        animated: 1,
        height: -80,
        width: 160,
        type: 0, // floor
        style: 5,
        sequence: 1,
        rarityFrameIndex: frameIndex,
        subTileFlags: Array.from({ length: 25 }, () => subTileFlagsOf(0)),
        blocks: [],
        minBlockY: 0,
        bitmapHeight: 80,
      })

      // Provide tiles out of order to ensure sorting by frameIndex works: [frame 2, frame 0, frame 1]
      const dt1Library: Dt1 = {
        versionMajor: 7,
        versionMinor: 6,
        tiles: [makeTile(2), makeTile(0), makeTile(1)],
        warnings: [],
      }

      // Create a minimal 1x1 DS1 referencing style 5, sequence 1
      const ds1: Ds1 = {
        version: 18,
        width: 1,
        height: 1,
        act: 1,
        substitutionType: 0,
        wallLayers: 1,
        floorLayers: 1,
        cells: [[{
          floors: [{ style: 5, sequence: 1, prop1: 1, hidden: false, unknown1: 0, unknown2: 0 }],
          walls: [],
          shadows: [],
          substitutions: [],
        }]],
        objects: [],
        npcPathOffset: null,
      }

      const scene = buildIsoMapScene(ds1, [dt1Library])

      expect(scene.animatedTileCount).toBe(1)
      expect(scene.floors.length).toBe(1)
      const floorDraw = scene.floors[0]!

      // animatedFrames should exist and have 3 frames
      expect(floorDraw.animatedFrames).toBeDefined()
      expect(floorDraw.animatedFrames?.length).toBe(3)

      // The base frame index should be the first frame (frameIndex 0)
      const frameIndices = floorDraw.animatedFrames!
      expect(frameIndices.length).toBe(3)
      // All 3 frames should be distinct frame indices in scene.frames
      expect(new Set(frameIndices).size).toBe(3)
      // Base frame should be frame 0
      expect(floorDraw.frameIndex).toBe(frameIndices[0])
    })
  })
})
