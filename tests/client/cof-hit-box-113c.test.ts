import * as fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fileSource } from '../../src/baker/io/file-source.ts'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { ClientUnit } from '../../src/client/world/client-unit.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { decodeCof } from '../../src/common/formats/cof.ts'
import { MpqArchive } from '../../src/common/mpq/archive.ts'
import {
  CHAR_COF_BOXES_113C,
  MONSTER_COF_BOXES_113C,
  cofBoxToHitBox113c,
  getMonsterCofHitBox113c,
  getObjectCofHitBox113c,
  getPlayerCofHitBox113c,
} from '../../src/common/units/cof-boxes-113c.ts'
import { getObjectHitBox113c } from '../../src/common/world/objects-meta.ts'

describe('1.13c COF header bounding box & 0x6FB1A550 unit hit-test (#1714)', () => {
  it('decodes signed int32le xMin/xMax/yMin/yMax from COF header +0x08..+0x17', () => {
    const buf = new Uint8Array(28 + 9 + 1 + 1)
    const dv = new DataView(buf.buffer)
    buf[0] = 1 // numberOfLayers
    buf[1] = 1 // framesPerDirection
    buf[2] = 1 // numberOfDirections
    dv.setInt32(0x08, -179, true)
    dv.setInt32(0x0c, 128, true)
    dv.setInt32(0x10, -150, true)
    dv.setInt32(0x14, 62, true)
    dv.setInt32(0x18, 256, true) // speed
    buf[28 + 0] = 1 // tr
    buf[28 + 1] = 1 // shadow
    buf[28 + 2] = 1 // selectable
    buf[28 + 3] = 0 // transparent
    buf[28 + 4] = 5 // drawEffect
    buf.set([0x68, 0x74, 0x68, 0x00], 28 + 5) // 'hth\0'
    buf[37] = 0 // animationFrames[0]
    buf[38] = 1 // priority[0][0][0]

    const cof = decodeCof(buf)
    expect(cof.xMin).toBe(-179)
    expect(cof.xMax).toBe(128)
    expect(cof.yMin).toBe(-150)
    expect(cof.yMax).toBe(62)
    expect(cofBoxToHitBox113c([cof.xMin, cof.xMax, cof.yMin, cof.yMax])).toEqual({
      left: -195,
      top: -166,
      width: 339,
      height: 244,
    })
  })

  it.skipIf(!fs.existsSync('samples/d2/d2data.mpq'))(
    'matches exact MPQ COF header boxes for ZMNUHTH, DINUHTH, and SKNU1HS',
    async () => {
      const archive = await MpqArchive.open(await fileSource('samples/d2/d2data.mpq'))
      const readBox = async (member: string) => {
        const entry = archive.find(member)
        expect(entry).toBeDefined()
        const cof = decodeCof(await archive.read(entry!))
        return [cof.xMin, cof.xMax, cof.yMin, cof.yMax] as const
      }
      expect(await readBox('data\\global\\monsters\\zm\\cof\\zmnuhth.cof')).toEqual([
        -30, 18, -61, 5,
      ])
      expect(await readBox('data\\global\\monsters\\di\\cof\\dinuhth.cof')).toEqual([
        -179, 128, -150, 62,
      ])
      expect(await readBox('data\\global\\monsters\\sk\\cof\\sknu1hs.cof')).toEqual([
        -55, 46, -75, 15,
      ])
    },
  )

  it('ClientUnit.getHitBox() returns 0x6FB1A550 COF ±16 px boxes for monsters and players', () => {
    // Zombie (#5, code 'zm', baseW 'hth'): [-30, 18, -61, 5] -> [-46, -77, 80, 98]
    const zombie = new ClientUnit({ unitType: 1, id: 10, classId: 5, x: 100, y: 100, mode: 1 })
    expect(zombie.getHitBox()).toEqual({
      left: -46,
      top: -77,
      width: 80,
      height: 98,
    })

    // Skeleton (#0, code 'sk', baseW '1hs'): [-55, 46, -75, 15] -> [-71, -91, 133, 122]
    const skeleton = new ClientUnit({ unitType: 1, id: 11, classId: 0, x: 100, y: 100, mode: 1 })
    expect(skeleton.getHitBox()).toEqual({
      left: -71,
      top: -91,
      width: 133,
      height: 122,
    })

    // Diablo (#243, code 'di', baseW 'hth'): [-179, 128, -150, 62] -> [-195, -166, 339, 244]
    const diablo = new ClientUnit({ unitType: 1, id: 12, classId: 243, x: 100, y: 100, mode: 1 })
    expect(diablo.getHitBox()).toEqual({
      left: -195,
      top: -166,
      width: 339,
      height: 244,
    })

    // Mephisto (#242, code 'mp', baseW 'hth'): [-94, 94, -177, 10] -> [-110, -193, 220, 219]
    const mephisto = new ClientUnit({ unitType: 1, id: 13, classId: 242, x: 100, y: 100, mode: 1 })
    expect(mephisto.getHitBox()).toEqual({
      left: -110,
      top: -193,
      width: 220,
      height: 219,
    })

    // Monster with noGfxHitTest == 1 (Izual #406) still uses MonStats2 BoxLeft..BoxHeight
    const izual = new ClientUnit({ unitType: 1, id: 14, classId: 406, x: 100, y: 100, mode: 1 })
    expect(izual.getHitBox()).toEqual({
      left: -22,
      top: -150,
      width: 44,
      height: 100,
    })

    // Player (Amazon #0, mode 1 NU, hth) and Werewolf morph (state 139 -> token '40')
    const player = new ClientUnit({ unitType: 0, id: 1, classId: 0, x: 100, y: 100, mode: 1 })
    expect(player.getHitBox()).toEqual(getPlayerCofHitBox113c(0, 1, 'hth'))
    expect(CHAR_COF_BOXES_113C['amnuhth']).toBeDefined()

    player.states.add(139)
    expect(player.getHitBox()).toEqual(cofBoxToHitBox113c(MONSTER_COF_BOXES_113C['40nuhth']!))
    expect(getMonsterCofHitBox113c(243, 1)).toEqual({
      left: -195,
      top: -166,
      width: 339,
      height: 244,
    })
  })

  it('findUnitAtScreenPoint enforces exclusive right/bottom edges (0x6FB1A677 jge / PtInRect)', () => {
    const world = new ClientWorld()
    world.selfId = 1
    ;(world.self as { x: number; y: number }).x = 100
    ;(world.self as { x: number; y: number }).y = 100
    const selfUnit = new ClientUnit({ unitType: 0, id: 1, classId: 0, x: 100, y: 100, mode: 1 })
    const mon = new ClientUnit({ unitType: 1, id: 2, classId: 1, x: 105, y: 105, mode: 1 })
    world.units.set('player:1', selfUnit)
    world.units.set('monster:2', mon)
    world.monsters.set(2, mon)

    const mapper = new CommandMapper({ world })
    const shiftX = (mapper as any).syncCameraState()
    const pos = (mapper as any).cameraSubtileToScreen(mon.x, mon.y, shiftX)
    const hb = mon.getHitBox()

    // Inclusive left/top edge hits
    expect(mapper.findUnitAtScreenPoint(pos.x + hb.left, pos.y + hb.top)).toBe(mon)
    // Interior just inside right/bottom edge hits
    expect(
      mapper.findUnitAtScreenPoint(
        pos.x + hb.left + hb.width - 1,
        pos.y + hb.top + hb.height - 1,
      ),
    ).toBe(mon)
    // Exclusive right edge misses (x == left + width -> jge miss)
    expect(
      mapper.findUnitAtScreenPoint(pos.x + hb.left + hb.width, pos.y + hb.top),
    ).toBeNull()
    // Exclusive bottom edge misses (y == top + height -> jge miss)
    expect(
      mapper.findUnitAtScreenPoint(pos.x + hb.left, pos.y + hb.top + hb.height),
    ).toBeNull()
  })

  it('getObjectHitBox113c enforces 0x6FB56B15..0x6FB56B52 COF ±16 prefilter gate for non-door objects without CollisionSubst (#1715)', () => {
    // Object #1 (Casket6, token 'c5', isDoor=0, collisionSubst=0):
    // COF 'c5nuhth' = [-103, 60, -66, 31] -> ±16 px = { left: -119, top: -82, width: 195, height: 129 } (right=76, bottom=47)
    // Frame bounds fb = { left: -83, top: -61, width: 139, height: 121 } (right=56, bottom=60)
    // Intersection = { left: -83, top: -61, width: 139, height: 108 }
    expect(getObjectCofHitBox113c('c5', 0)).toEqual({
      left: -119,
      top: -82,
      width: 195,
      height: 129,
    })
    expect(getObjectHitBox113c(1, 0)).toEqual({
      left: -83,
      top: -61,
      width: 139,
      height: 108,
    })

    // Open door (classId #13 DoorWoodenLeft, isDoor=1, mode 2) uses 0x6FB55720 Left/Top/Width/Height directly
    expect(getObjectHitBox113c(13, 2)).toEqual({
      left: -20,
      top: -80,
      width: 40,
      height: 40,
    })
  })

  it('resolvePointerTarget selects units strictly via findUnitAtScreenPoint without radial pickUnitAtSubtile fallback (#1715)', () => {
    const world = new ClientWorld()
    world.selfId = 1
    ;(world.self as { x: number; y: number }).x = 100
    ;(world.self as { x: number; y: number }).y = 100
    const selfUnit = new ClientUnit({ unitType: 0, id: 1, classId: 0, x: 100, y: 100, mode: 1 })
    const mon = new ClientUnit({ unitType: 1, id: 2, classId: 5, x: 105, y: 105, mode: 1 })
    world.units.set('player:1', selfUnit)
    world.units.set('monster:2', mon)
    world.monsters.set(2, mon)

    const mapper = new CommandMapper({ world })
    const shiftX = (mapper as any).syncCameraState()
    const pos = (mapper as any).cameraSubtileToScreen(mon.x, mon.y, shiftX)
    const hb = mon.getHitBox()

    // Inside screen hit-box -> returns mon
    expect(mapper.resolvePointerTarget(pos.x, pos.y - 20).hoveredUnit).toBe(mon)
    // 2 px outside right edge of screen hit-box (still within 2.5 subtiles radially!) -> must NOT select mon
    expect(
      mapper.resolvePointerTarget(pos.x + hb.left + hb.width + 2, pos.y).hoveredUnit,
    ).toBeNull()
  })
})
