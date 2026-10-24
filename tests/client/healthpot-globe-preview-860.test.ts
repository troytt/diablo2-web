/**
 * Diablo II v1.13c Life Globe `STATE_HEALTHPOT (100)` 25%-Alpha Red Healing Preview Overlay Tests (Issue #860).
 *
 * Ground Truth:
 * - `D2Game.dll 0x6FC82360` (`PlrMsg.cpp:287-299, 335-338`):
 *   - While `STATE_HEALTHPOT (100)` is active, server computes target life percentage `nPotionLifePercent` (`0..100`)
 *     and sends `S2C 0x18 HPMPUpdate` (15B bitstream carrying 7-bit `lifeRegen` and `manaRegen`).
 *   - Subsequent ticks where target percentage is unchanged send `S2C 0x95 HPMPPotUpdate` (13B, no `lifeRegen`/`manaRegen`).
 * - `D2Client.dll 0x6FB5ECA0` (`S2C 0x18 HPMPUpdate` handler):
 *   - `0x6fb5ecf7..0x6fb5ed02`: writes 7-bit `lifeRegen` into `STAT_HPREGEN` (`stat = 74` / `0x4A`).
 *   - `0x6fb5ed07..0x6fb5ed12`: writes 7-bit `manaRegen` into `STAT_MANARECOVERY` (`stat = 26` / `0x1A`).
 *   - `S2C 0x95 HPMPPotUpdate` (`0x6fb5ebe0`) updates life/mana/stamina without touching stat `74` or `26`.
 * - `D2Client.dll 0x6FAD7BD0` (`UI_DrawLifeGlobe`):
 *   - `0x6fad7c04..0x6fad7c2c`: `currentClipH = clamp(trunc(hp * 80 / maxHp), 2, 80)` when `hp > 0`.
 *   - `0x6fad7c37..0x6fad7cbd`: when `STATES_CheckState(pPlayer, 100)` (`STATE_HEALTHPOT`) is true:
 *     - Reads `nPotionLifePercent = STATLIST_UnitGetStatValue(pPlayer, 74, 0)` (`STAT_HPREGEN`).
 *     - `targetClipH = min(80, trunc((nPotionLifePercent * 80) / 100))`.
 *     - If `targetClipH > currentClipH`, draws ONLY the incremental band `[currentClipH .. targetClipH]`
 *       (`srcY = 80 - targetClipH`, `bandH = targetClipH - currentClipH`) using `Hlthmana.dc6` frame 0
 *       (`assets.lifeImg`, ALWAYS red even when poisoned `STATE_POISON = 2` per `0x6fad7c43`!)
 *       with `eDrawMode = 0` (`DRAWMODE_TRANS25`, `64/255 = 0.25` alpha).
 *   - `0x6fad7cc7..0x6fad7d18`: draws `[0 .. currentClipH]` opaque (`eDrawMode = 5`, `alpha = 1.0`)
 *     using poison green (`frame 2`) if `STATE_POISON (2)` is active, else red (`frame 0`).
 */

import { describe, expect, it, vi } from 'vitest'
import { AutomapView } from '../../src/client/automap/automap-view.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import type { D2FontRenderer } from '../../src/client/ui/font.ts'
import { GlobesHud, LIFE_GLOBE_BOUNDS, LIFE_GLOBE_BOUNDS_640 } from '../../src/client/ui/globes.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { STAT_HPREGEN, STAT_MANARECOVERY } from '../../src/client/world/self.ts'
import { D2StatId } from '../../src/client/world/stat-list.ts'
import { BitWriter } from '../../src/netproto/core/bit-writer.ts'
import { decode0x96WalkVerify } from '../../src/netproto/d2gs/s2c/movement.ts'
import { decode0x18LifeManaRegen, decode0x95LifeMana } from '../../src/netproto/d2gs/s2c/stats.ts'

interface RecordedDrawCall {
  readonly img: unknown
  readonly args: readonly number[]
  readonly alpha: number
}

function createTrackingCanvasCtx(): {
  ctx: CanvasRenderingContext2D
  draws: RecordedDrawCall[]
} {
  const draws: RecordedDrawCall[] = []
  const alphaStack: number[] = []
  const ctx = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    save: vi.fn(function (this: { globalAlpha: number }) {
      alphaStack.push(this.globalAlpha)
    }),
    restore: vi.fn(function (this: { globalAlpha: number }) {
      if (alphaStack.length > 0) {
        this.globalAlpha = alphaStack.pop()!
      }
    }),
    translate: vi.fn(),
    drawImage: vi.fn(function (this: { globalAlpha: number }, img: unknown, ...args: number[]) {
      draws.push({ img, args, alpha: this.globalAlpha })
    }),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
  } as unknown as CanvasRenderingContext2D
  return { ctx, draws }
}

function createMockFont(): D2FontRenderer {
  return {
    drawText: vi.fn(),
    measureText: vi.fn((text: string) => text.length * 6),
  } as unknown as D2FontRenderer
}

function createMockImg(name: string, width: number, height: number): HTMLImageElement {
  return {
    name,
    width,
    height,
    complete: true,
    naturalWidth: width,
    naturalHeight: height,
  } as unknown as HTMLImageElement
}

function build0x18Packet(params: {
  life: number
  mana: number
  stamina: number
  lifeRegen: number
  manaRegen: number
  x: number
  y: number
  vx?: number
  vy?: number
}): Uint8Array {
  const bw = new BitWriter()
  bw.writeBits(0x18, 8)
  bw.writeBits(params.life, 15)
  bw.writeBits(params.mana, 15)
  bw.writeBits(params.stamina, 15)
  bw.writeBits(params.lifeRegen, 7)
  bw.writeBits(params.manaRegen, 7)
  bw.writeBits(params.x, 16)
  bw.writeBits(params.y, 16)
  bw.writeSignedBits(params.vx ?? 0, 8)
  bw.writeSignedBits(params.vy ?? 0, 8)
  bw.alignToByte()
  return bw.toUint8Array()
}

function build0x95Packet(params: {
  life: number
  mana: number
  stamina: number
  x: number
  y: number
  vx?: number
  vy?: number
}): Uint8Array {
  const bw = new BitWriter()
  bw.writeBits(0x95, 8)
  bw.writeBits(params.life, 15)
  bw.writeBits(params.mana, 15)
  bw.writeBits(params.stamina, 15)
  bw.writeBits(params.x, 16)
  bw.writeBits(params.y, 16)
  bw.writeSignedBits(params.vx ?? 0, 8)
  bw.writeSignedBits(params.vy ?? 0, 8)
  bw.alignToByte()
  return bw.toUint8Array()
}

function build0x96Packet(params: {
  stamina: number
  x: number
  y: number
  vx?: number
  vy?: number
}): Uint8Array {
  const bw = new BitWriter()
  bw.writeBits(0x96, 8)
  bw.writeBits(params.stamina, 15)
  bw.writeBits(params.x, 16)
  bw.writeBits(params.y, 16)
  bw.writeSignedBits(params.vx ?? 0, 8)
  bw.writeSignedBits(params.vy ?? 0, 8)
  bw.alignToByte()
  return bw.toUint8Array()
}

describe('Diablo II v1.13c Life Globe STATE_HEALTHPOT (100) Healing Preview Overlay (Issue #860)', () => {
  it('decodes S2C 0x18 HPMPUpdate into STAT_HPREGEN (74) and STAT_MANARECOVERY (26) and preserves them across S2C 0x95 / 0x96', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Sorceress',
        x: 5000,
        y: 5000,
        lifePct: 128,
        mode: 1,
      },
    })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxHp, value: 200 << 8 })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxMana, value: 120 << 8 })

    // 1. S2C 0x18 HPMPUpdate (15B): life=60, mana=30, stamina=90, lifeRegen=85 (target 85%), manaRegen=70 (target 70%)
    const pkt18 = build0x18Packet({
      life: 60,
      mana: 30,
      stamina: 90,
      lifeRegen: 85,
      manaRegen: 70,
      x: 5004,
      y: 5008,
    })
    expect(pkt18.byteLength).toBe(15)
    const ev18 = decode0x18LifeManaRegen(pkt18)
    expect(ev18).toMatchObject({
      type: 'LifeMana',
      life: 60,
      mana: 30,
      stamina: 90,
      lifeRegen: 85,
      manaRegen: 70,
    })

    world.apply(ev18)
    expect(world.self.life).toBe(60)
    expect(world.self.mana).toBe(30)
    expect(world.self.stats.getBase(STAT_HPREGEN)).toBe(85)
    expect(world.self.stats.getBase(STAT_MANARECOVERY)).toBe(70)
    expect(world.units.get('player:1')?.stats.getBase(STAT_HPREGEN)).toBe(85)
    expect(world.units.get('player:1')?.stats.getBase(STAT_MANARECOVERY)).toBe(70)

    // 2. Subsequent S2C 0x95 HPMPPotUpdate (13B): life ticks up to 92, lifeRegen/manaRegen are undefined on wire
    const pkt95 = build0x95Packet({
      life: 92,
      mana: 45,
      stamina: 88,
      x: 5006,
      y: 5008,
    })
    expect(pkt95.byteLength).toBe(13)
    const ev95 = decode0x95LifeMana(pkt95)
    expect(ev95.type).toBe('LifeMana')
    if (ev95.type === 'LifeMana') {
      expect(ev95.lifeRegen).toBeUndefined()
      expect(ev95.manaRegen).toBeUndefined()
    }

    world.apply(ev95)
    expect(world.self.life).toBe(92)
    expect(world.self.mana).toBe(45)
    // Must NOT overwrite STAT_HPREGEN (74) or STAT_MANARECOVERY (26)!
    expect(world.self.stats.getBase(STAT_HPREGEN)).toBe(85)
    expect(world.self.stats.getBase(STAT_MANARECOVERY)).toBe(70)

    // 3. Subsequent S2C 0x96 WalkVerify (9B): stamina updates, life/mana/regen percentages preserved
    const pkt96 = build0x96Packet({ stamina: 84, x: 5008, y: 5010 })
    expect(pkt96.byteLength).toBe(9)
    const ev96 = decode0x96WalkVerify(pkt96)
    world.apply(ev96)
    expect(world.self.life).toBe(92)
    expect(world.self.stamina).toBe(84)
    expect(world.self.stats.getBase(STAT_HPREGEN)).toBe(85)
    expect(world.self.stats.getBase(STAT_MANARECOVERY)).toBe(70)
  })

  it('draws 25%-alpha incremental red healing preview band [currentClipH .. targetClipH] via HudModel -> HudManager -> GlobesHud when STATE_HEALTHPOT (100) is active', () => {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const predictor = new LocalMovementPredictor({ initialX: 5000, initialY: 5000 })
    const automap = new AutomapView()
    const hudModel = new HudModel({
      world,
      hudManager,
      predictor,
      automap,
      onCommand: () => {},
    })

    // Assign self player: maxHp = 200, hp = 50 (25% -> currentClipH = 20px)
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Sorceress',
        x: 5000,
        y: 5000,
        lifePct: 32,
        mode: 1,
      },
    })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxHp, value: 200 << 8 })
    world.apply({ type: 'StatSet', stat: D2StatId.HitPoints, value: 50 << 8 })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxMana, value: 100 << 8 })
    world.apply({ type: 'StatSet', stat: D2StatId.Mana, value: 100 << 8 })

    // Server sets STATE_HEALTHPOT (100) and sends S2C 0x18 with lifeRegen = 75 (targetClipH = trunc(75 * 80 / 100) = 60px)
    world.apply({
      type: 'StateSet',
      unit: { unitType: 0, id: 1 },
      state: 100, // STATE_HEALTHPOT
      // Even if 0xA8 carries per-tick regen in state stats, getBase(74) must read the 0x18 target percentage!
      stats: [{ statId: STAT_HPREGEN, param: 0, value: 512 }],
    })
    world.apply(
      decode0x18LifeManaRegen(
        build0x18Packet({
          life: 50,
          mana: 100,
          stamina: 100,
          lifeRegen: 75,
          manaRegen: 0,
          x: 5000,
          y: 5000,
        }),
      ),
    )

    hudModel.syncFromWorld()
    expect(hudManager.hp).toBe(50)
    expect(hudManager.maxHp).toBe(200)
    expect(hudManager.healthPotActive).toBe(true)
    expect(hudManager.potionLifePercent).toBe(75)
    expect(hudManager.poisoned).toBe(false)

    const { ctx, draws } = createTrackingCanvasCtx()
    const font = createMockFont()
    const lifeImg = createMockImg('globe-life', 80, 80)
    const manaImg = createMockImg('globe-mana', 80, 80)
    const poisonImg = createMockImg('globe-poison', 80, 80)
    const overlapLeftImg = createMockImg('overlap-left', 82, 88)
    const overlapRightImg = createMockImg('overlap-right', 82, 88)

    hudManager.globes.is640 = false
    hudManager.globes.draw(
      ctx,
      {
        hp: hudManager.hp,
        maxHp: hudManager.maxHp,
        mana: hudManager.mana,
        maxMana: hudManager.maxMana,
        poisoned: hudManager.poisoned,
        healthPotActive: hudManager.healthPotActive,
        potionLifePercent: hudManager.potionLifePercent,
      },
      { lifeImg, manaImg, poisonImg, overlapLeftImg, overlapRightImg },
      font,
    )

    // Expected geometry at 800x600 (LIFE_GLOBE_BOUNDS = { x: 29, y: 507, width: 80, height: 80 }):
    // currentClipH = 20 (srcY = 60, dstY = 567)
    // targetClipH = 60 (bandTop = 80 - 60 = 20, bandH = 60 - 20 = 40, dstY = 507 + 20 = 527)
    const lifeDraws = draws.filter((d) => d.img === lifeImg)
    expect(lifeDraws).toHaveLength(2)

    // 1st life draw: incremental preview band [20 .. 60] at globalAlpha = 0.25 (DRAWMODE_TRANS25)
    expect(lifeDraws[0]).toEqual({
      img: lifeImg,
      args: [0, 20, 80, 40, LIFE_GLOBE_BOUNDS.x, LIFE_GLOBE_BOUNDS.y + 20, 80, 40],
      alpha: 0.25,
    })

    // 2nd life draw: opaque current HP [0 .. 20] at globalAlpha = 1.0 (DRAWMODE_NORMAL)
    expect(lifeDraws[1]).toEqual({
      img: lifeImg,
      args: [0, 60, 80, 20, LIFE_GLOBE_BOUNDS.x, LIFE_GLOBE_BOUNDS.y + 60, 80, 20],
      alpha: 1,
    })

    // Verify zero overlap / double-draw between preview band and solid liquid:
    // preview band ends at srcY = 20 + 40 = 60, which equals solid liquid's srcY = 60.
    expect(lifeDraws[0]!.args[1]! + lifeDraws[0]!.args[3]!).toBe(lifeDraws[1]!.args[1])
    expect(ctx.globalAlpha).toBe(1)

    // Verify overlapLeftImg is drawn AFTER both the preview band and solid liquid
    const previewIdx = draws.findIndex((d) => d === lifeDraws[0])
    const solidIdx = draws.findIndex((d) => d === lifeDraws[1])
    const overlapIdx = draws.findIndex((d) => d.img === overlapLeftImg)
    expect(previewIdx).toBeLessThan(solidIdx)
    expect(solidIdx).toBeLessThan(overlapIdx)
  })

  it('always uses red lifeImg (Hlthmana.dc6 frame 0) for the 25%-alpha preview band even when poisoned (STATE_POISON = 2) renders green poisonImg for current HP', () => {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const predictor = new LocalMovementPredictor({ initialX: 5000, initialY: 5000 })
    const automap = new AutomapView()
    const hudModel = new HudModel({
      world,
      hudManager,
      predictor,
      automap,
      onCommand: () => {},
    })

    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Sorceress',
        x: 5000,
        y: 5000,
        lifePct: 64,
        mode: 1,
      },
    })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxHp, value: 160 << 8 })
    // Activate both STATE_POISON (2) and STATE_HEALTHPOT (100)
    world.apply({ type: 'StateSet', unit: { unitType: 0, id: 1 }, state: 2 })
    world.apply({ type: 'StateSet', unit: { unitType: 0, id: 1 }, state: 100 })
    // Current HP = 80/160 (50% -> currentClipH = 40), target = 90% (targetClipH = trunc(90*80/100) = 72)
    world.apply(
      decode0x18LifeManaRegen(
        build0x18Packet({
          life: 80,
          mana: 50,
          stamina: 100,
          lifeRegen: 90,
          manaRegen: 0,
          x: 5000,
          y: 5000,
        }),
      ),
    )

    hudModel.syncFromWorld()
    expect(hudManager.poisoned).toBe(true)
    expect(hudManager.healthPotActive).toBe(true)
    expect(hudManager.potionLifePercent).toBe(90)

    const { ctx, draws } = createTrackingCanvasCtx()
    const font = createMockFont()
    const lifeImg = createMockImg('globe-life', 80, 80)
    const manaImg = createMockImg('globe-mana', 80, 80)
    const poisonImg = createMockImg('globe-poison', 80, 80)
    const overlapLeftImg = createMockImg('overlap-left', 82, 88)
    const overlapRightImg = createMockImg('overlap-right', 82, 88)

    hudManager.globes.draw(
      ctx,
      {
        hp: hudManager.hp,
        maxHp: hudManager.maxHp,
        mana: hudManager.mana,
        maxMana: hudManager.maxMana,
        poisoned: hudManager.poisoned,
        healthPotActive: hudManager.healthPotActive,
        potionLifePercent: hudManager.potionLifePercent,
      },
      { lifeImg, manaImg, poisonImg, overlapLeftImg, overlapRightImg },
      font,
    )

    // Preview band [40 .. 72] (srcY = 80 - 72 = 8, bandH = 32) MUST use red `lifeImg` at alpha 0.25 (0x6fad7c43)
    const redDraws = draws.filter((d) => d.img === lifeImg)
    expect(redDraws).toEqual([
      {
        img: lifeImg,
        args: [0, 8, 80, 32, LIFE_GLOBE_BOUNDS.x, LIFE_GLOBE_BOUNDS.y + 8, 80, 32],
        alpha: 0.25,
      },
    ])

    // Current HP [0 .. 40] (srcY = 40, clipH = 40) MUST use green `poisonImg` at alpha 1.0 (0x6fad7cc7)
    const greenDraws = draws.filter((d) => d.img === poisonImg)
    expect(greenDraws).toEqual([
      {
        img: poisonImg,
        args: [0, 40, 80, 40, LIFE_GLOBE_BOUNDS.x, LIFE_GLOBE_BOUNDS.y + 40, 80, 40],
        alpha: 1,
      },
    ])
  })

  it('omits the preview band when STATE_HEALTHPOT (100) is cleared (StateEnd) or when targetClipH <= currentClipH', () => {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const predictor = new LocalMovementPredictor({ initialX: 5000, initialY: 5000 })
    const automap = new AutomapView()
    const hudModel = new HudModel({
      world,
      hudManager,
      predictor,
      automap,
      onCommand: () => {},
    })

    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Sorceress',
        x: 5000,
        y: 5000,
        lifePct: 64,
        mode: 1,
      },
    })
    world.apply({ type: 'StatSet', stat: D2StatId.MaxHp, value: 200 << 8 })
    world.apply({ type: 'StateSet', unit: { unitType: 0, id: 1 }, state: 100 })
    world.apply(
      decode0x18LifeManaRegen(
        build0x18Packet({
          life: 100,
          mana: 100,
          stamina: 100,
          lifeRegen: 80,
          manaRegen: 0,
          x: 5000,
          y: 5000,
        }),
      ),
    )

    const lifeImg = createMockImg('globe-life', 80, 80)
    const manaImg = createMockImg('globe-mana', 80, 80)
    const poisonImg = createMockImg('globe-poison', 80, 80)
    const overlapLeftImg = createMockImg('overlap-left', 82, 88)
    const overlapRightImg = createMockImg('overlap-right', 82, 88)
    const assets = { lifeImg, manaImg, poisonImg, overlapLeftImg, overlapRightImg }
    const font = createMockFont()

    // Case A: StateEnd(100) clears STATE_HEALTHPOT -> no 0.25-alpha preview band drawn even though STAT_HPREGEN is 80
    world.apply({ type: 'StateEnd', unit: { unitType: 0, id: 1 }, state: 100 })
    hudModel.syncFromWorld()
    expect(hudManager.healthPotActive).toBe(false)

    const trackA = createTrackingCanvasCtx()
    hudManager.globes.draw(
      trackA.ctx,
      {
        hp: hudManager.hp,
        maxHp: hudManager.maxHp,
        mana: hudManager.mana,
        maxMana: hudManager.maxMana,
        healthPotActive: hudManager.healthPotActive,
        potionLifePercent: hudManager.potionLifePercent,
      },
      assets,
      font,
    )
    expect(trackA.draws.filter((d) => d.alpha === 0.25)).toHaveLength(0)
    expect(trackA.draws.filter((d) => d.img === lifeImg)).toHaveLength(1)

    // Case B: STATE_HEALTHPOT (100) active, but hp >= target (hp = 170/200 -> currentClipH = 68, potionLifePercent = 80 -> targetClipH = 64 <= 68)
    world.apply({ type: 'StateSet', unit: { unitType: 0, id: 1 }, state: 100 })
    world.apply(
      decode0x95LifeMana(
        build0x95Packet({
          life: 170,
          mana: 100,
          stamina: 100,
          x: 5000,
          y: 5000,
        }),
      ),
    )
    hudModel.syncFromWorld()
    expect(hudManager.healthPotActive).toBe(true)
    expect(hudManager.potionLifePercent).toBe(80)

    const trackB = createTrackingCanvasCtx()
    hudManager.globes.draw(
      trackB.ctx,
      {
        hp: hudManager.hp,
        maxHp: hudManager.maxHp,
        mana: hudManager.mana,
        maxMana: hudManager.maxMana,
        healthPotActive: hudManager.healthPotActive,
        potionLifePercent: hudManager.potionLifePercent,
      },
      assets,
      font,
    )
    expect(trackB.draws.filter((d) => d.alpha === 0.25)).toHaveLength(0)

    // Case C: Full HP (hp = 200/200 -> currentClipH = 80, potionLifePercent = 100 -> targetClipH = 80 <= 80)
    const trackC = createTrackingCanvasCtx()
    hudManager.globes.draw(
      trackC.ctx,
      {
        hp: 200,
        maxHp: 200,
        mana: 100,
        maxMana: 100,
        healthPotActive: true,
        potionLifePercent: 100,
      },
      assets,
      font,
    )
    expect(trackC.draws.filter((d) => d.alpha === 0.25)).toHaveLength(0)
  })

  it('respects the #863 2px minimum alive clamp and 640x480 globe bounds when computing the incremental preview band', () => {
    const globes = new GlobesHud()
    globes.is640 = true
    const { ctx, draws } = createTrackingCanvasCtx()
    const font = createMockFont()
    const lifeImg = createMockImg('globe-life', 80, 80)
    const manaImg = createMockImg('globe-mana', 80, 80)
    const overlapLeftImg = createMockImg('overlap-left', 82, 88)
    const overlapRightImg = createMockImg('overlap-right', 82, 88)

    // At hp = 1, maxHp = 500, currentClipH is clamped to 2px (0x6fad7c21).
    // With potionLifePercent = 50 (targetClipH = 40), bandH = 40 - 2 = 38, bandTop = 80 - 40 = 40.
    globes.draw(
      ctx,
      {
        hp: 1,
        maxHp: 500,
        mana: 100,
        maxMana: 100,
        healthPotActive: true,
        potionLifePercent: 50,
      },
      { lifeImg, manaImg, poisonImg: null, overlapLeftImg, overlapRightImg },
      font,
    )

    const lifeDraws = draws.filter((d) => d.img === lifeImg)
    expect(lifeDraws).toEqual([
      {
        img: lifeImg,
        args: [0, 40, 80, 38, LIFE_GLOBE_BOUNDS_640.x, LIFE_GLOBE_BOUNDS_640.y + 40, 80, 38],
        alpha: 0.25,
      },
      {
        img: lifeImg,
        args: [0, 78, 80, 2, LIFE_GLOBE_BOUNDS_640.x, LIFE_GLOBE_BOUNDS_640.y + 78, 80, 2],
        alpha: 1,
      },
    ])
  })
})
