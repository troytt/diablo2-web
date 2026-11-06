/**
 * Issue #1999 — 1.13c Monster Ground Fire (`SrvDo05` / `SrvDmg03`), `SKILLS_SrvDo024_FireWall` (`0x6FC637D0`),
 * Zero-Damage Spawner/Controller Carriers, and `1/256` Fixed-Point Resistance Scaling.
 */

import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { MON_UMOD } from '../../src/common/units/monster-death-fx.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'

const registry = getSharedDataRegistry()

interface TestPlayerView {
  x: number
  y: number
  hp: number
  hpFixed: number
  maxHp: number
  mode: number
  hitRecoveryUntilFrame: number
  items: Array<{
    unitId: number
    code: string
    location: string
    bodyLoc: number
    identified: boolean
    stats: Map<number, number>
    socketedItems: never[]
  }>
}

interface TestMonsterView {
  unitId: number
  x: number
  y: number
  hp: number
  maxHp: number
  minDmg: number
  maxDmg: number
  cooldown: number
  skillCooldown: number
  skills: Array<{ skillId?: number; mode?: string; level: number }>
}

interface TestMissileView {
  unitId: number
  missileId: number
  skillId: number
  ownerType: 'player' | 'monster'
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  physDamage: number
  elemDamage: number
  pierce: boolean
  collideType: number
  carrier?: 'none' | 'groundfire'
  groundFire256?: { readonly min: number; readonly max: number }
}

interface TestGameView {
  players: Map<number, TestPlayerView>
  monsters: Map<number, TestMonsterView>
  missiles: Map<number, TestMissileView>
  tryCastMonsterSkill(
    monster: TestMonsterView,
    target: { readonly x: number; readonly y: number },
    distance: number,
  ): boolean
}

describe('Issue #1999 — 1.13c Monster Ground Fire, SrvDo024 FireWall & Zero-Damage Carriers', () => {
  it('parses exact 1.13c Missiles.txt HitShift, GetHit=0, and DamageRate=41 on monster ground-fire rows', () => {
    const vfwMaker = registry.getMissileById(130)!
    expect(vfwMaker.name).toBe('vampirefirewallmaker')
    expect(vfwMaker.pSrvDoFunc).toBe(6)
    expect(vfwMaker.pSrvHitFunc).toBe(0)
    expect(vfwMaker.eMin).toBe(0)

    const vfw = registry.getMissileById(131)!
    expect(vfw.name).toBe('vampirefirewall')
    expect(vfw.pSrvDoFunc).toBe(5)
    expect(vfw.pSrvDmgFunc).toBe(3)
    expect(vfw.hitShift).toBe(2)
    expect(vfw.damageRate).toBe(41)

    const cfwMaker = registry.getMissileById(653)!
    expect(cfwMaker.name).toBe('countessfirewallmaker')
    expect(cfwMaker.pSrvDoFunc).toBe(6)
    expect(cfwMaker.subMissile1).toBe('countessfirewall')

    const cfw = registry.getMissileById(331)!
    expect(cfw.name).toBe('countessfirewall')
    expect(cfw.pSrvDoFunc).toBe(5)
    expect(cfw.pSrvDmgFunc).toBe(0)
    expect(cfw.hitShift).toBe(1)
    expect(cfw.damageRate).toBe(41)

    const vmf = registry.getMissileById(681)!
    expect(vmf.name).toBe('vampiremeteorfire')
    expect(vmf.pSrvDoFunc).toBe(5)
    expect(vmf.pSrvDmgFunc).toBe(3)
    expect(vmf.hitShift).toBe(3)
    expect(vmf.damageRate).toBe(41)
  })

  it('#170 VampireFirewall launches SrvDo024 perpendicular makers with 0 maker contact damage and per-frame 1/256 burning without GetHit stunlock', () => {
    const game = new GameInstance({ seed: 199901, difficulty: 0, areaId: 74 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'ArcaneRunner',
      level: 19,
      hp: 200,
      maxHp: 200,
      x: 40,
      y: 30,
      areaId: 74,
    })
    const ghoulId = game.spawnMonster({
      hcIdx: 191,
      defId: 'vampire2',
      rank: 'boss',
      umodIds: [MON_UMOD.MULTISHOT],
      level: 19,
      hp: 300,
      maxHp: 300,
      minDmg: 25,
      maxDmg: 45,
      x: 30,
      y: 30,
      areaId: 74,
    })

    const view = game as unknown as TestGameView
    const player = view.players.get(pid)!
    const ghoul = view.monsters.get(ghoulId)!
    ghoul.skills = [{ skillId: 170, mode: 'S1', level: 3 }]
    ghoul.cooldown = 0
    ghoul.skillCooldown = 0

    const casted = view.tryCastMonsterSkill(ghoul, { x: player.x, y: player.y }, 10)
    expect(casted).toBe(true)

    const initialMissiles = [...view.missiles.values()]
    const makers = initialMissiles.filter((m) => m.missileId === 130)
    const centerPatches = initialMissiles.filter((m) => m.missileId === 131)

    // SrvDo024 spawns 2 perpendicular makers from target (40, 30) along +/-Y (since dX = -10, dY = 0)
    // and never duplicates zero-damage makers via Multishot (#29).
    expect(makers).toHaveLength(2)
    expect(centerPatches).toHaveLength(1)
    for (const m of makers) {
      expect(m.x).toBe(40)
      expect(m.y).toBe(30)
      expect(m.vx).toBeCloseTo(0, 6)
      expect(Math.abs(m.vy)).toBeGreaterThan(0.5)
      expect(m.carrier).toBe('none')
      expect(m.damage).toBe(0)
      expect(m.physDamage).toBe(0)
      expect(m.elemDamage).toBe(0)
    }
    expect(makers[0]!.vy * makers[1]!.vy).toBeLessThan(0)

    const center = centerPatches[0]!
    expect(center.carrier).toBe('groundfire')
    expect(center.pierce).toBe(true)
    expect(center.damage).toBe(0)
    // #131 slvl=3: EMin = 2 + 2*2 = 6, EMax = 3 + 2*2 = 7, HitShift = 2 (<< 2 => 24..28 / 256 per frame)
    expect(center.groundFire256).toEqual({ min: 24, max: 28 })

    // Step 25 frames (1 second) while standing on (40, 30):
    // Makers drop perpendicular wall patches without dealing 25..45 melee fallback hits,
    // and burning never triggers PLRMODE_GETHIT (mode 4 / hitRecoveryUntilFrame).
    const hpStart = player.hp
    let enteredGetHit = false
    for (let f = 0; f < 25; f++) {
      game.stepFrames(1)
      if (player.mode === 4 || player.hitRecoveryUntilFrame > 0) {
        enteredGetHit = true
      }
      // Keep ghoul on skill cooldown so it does not cast another spell mid-window
      ghoul.skillCooldown = 100
      ghoul.cooldown = 100
    }
    expect(enteredGetHit).toBe(false)

    // Expected 1-second burn from center + overlapping neighbour patch at (40, 30) is ~2..9 HP,
    // NEVER a 100+ HP melee-fallback / 18x25-burst one-shot!
    const lostHp = hpStart - player.hp
    expect(lostHp).toBeGreaterThanOrEqual(2)
    expect(lostHp).toBeLessThanOrEqual(15)

    // Verify perpendicular #131 patches formed along x=40, y!=30
    const wallPatches = [...view.missiles.values()].filter((m) => m.missileId === 131)
    expect(wallPatches.length).toBeGreaterThanOrEqual(5)
    expect(wallPatches.some((m) => m.y < 29)).toBe(true)
    expect(wallPatches.some((m) => m.y > 31)).toBe(true)
  })

  it('#321 CountessFirewall spawns #653 makers -> #331 countessfirewall ground-fire patches (pSrvDoFunc=5, pSrvDmgFunc=0)', () => {
    const game = new GameInstance({ seed: 199902, difficulty: 0, areaId: 25 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'TowerClimber',
      level: 14,
      hp: 150,
      maxHp: 150,
      x: 35,
      y: 30,
      areaId: 25,
    })
    const countessId = game.spawnMonster({
      hcIdx: 45,
      defId: 'corruptrogue5',
      rank: 'boss',
      level: 14,
      hp: 250,
      maxHp: 250,
      minDmg: 12,
      maxDmg: 22,
      x: 28,
      y: 30,
      areaId: 25,
    })

    const view = game as unknown as TestGameView
    const player = view.players.get(pid)!
    const countess = view.monsters.get(countessId)!
    countess.skills = [{ skillId: 321, mode: 'S1', level: 2 }]

    expect(view.tryCastMonsterSkill(countess, { x: player.x, y: player.y }, 7)).toBe(true)
    countess.skillCooldown = 200
    countess.cooldown = 200

    game.stepFrames(10)
    const cfwPatches = [...view.missiles.values()].filter((m) => m.missileId === 331)
    expect(cfwPatches.length).toBeGreaterThanOrEqual(5)
    for (const p of cfwPatches) {
      expect(p.carrier).toBe('groundfire')
      expect(p.pierce).toBe(true)
      // #331 slvl=2: EMin = 3 + 4 = 7, EMax = 5 + 4 = 9, HitShift = 1 (<< 1 => 14..18)
      expect(p.groundFire256).toEqual({ min: 14, max: 18 })
    }
  })

  it('#171 VampireMeteor (#133 -> 18x #681) deals single impact blast + gentle 1/256 per-frame burn instead of 18x 1-second burst', () => {
    const game = new GameInstance({ seed: 199903, difficulty: 0, areaId: 74 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'MeteorSurvivor',
      level: 19,
      hp: 300,
      maxHp: 300,
      x: 30,
      y: 30,
      areaId: 74,
    })
    const ghoulId = game.spawnMonster({
      hcIdx: 191,
      defId: 'vampire2',
      level: 19,
      hp: 300,
      maxHp: 300,
      minDmg: 25,
      maxDmg: 45,
      x: 20,
      y: 30,
      areaId: 74,
    })

    const view = game as unknown as TestGameView
    const player = view.players.get(pid)!
    const ghoul = view.monsters.get(ghoulId)!
    ghoul.skills = [{ skillId: 171, mode: 'S1', level: 3 }]

    expect(view.tryCastMonsterSkill(ghoul, { x: 30, y: 30 }, 10)).toBe(true)
    ghoul.skillCooldown = 500
    ghoul.cooldown = 500

    // #133 vampiremeteorcenter waits 60 frames before exploding
    const centers = [...view.missiles.values()].filter((m) => m.missileId === 133)
    expect(centers).toHaveLength(1)
    game.stepFrames(59)
    expect(player.hp).toBe(300)

    // Frame 60: meteor lands -> splash impact + 18 #681 vampiremeteorfire patches
    game.stepFrames(1)
    const hpAfterImpact = player.hp
    expect(hpAfterImpact).toBeLessThan(300)
    expect(hpAfterImpact).toBeGreaterThan(260)

    const firePatches = [...view.missiles.values()].filter((m) => m.missileId === 681)
    expect(firePatches.length).toBeGreaterThanOrEqual(10)
    for (const p of firePatches) {
      expect(p.carrier).toBe('groundfire')
      expect(p.damage).toBe(0)
      expect(p.pierce).toBe(true)
    }

    // Step 5 frames in the overlapping meteor fire pool: should burn gradually (~10..20 HP),
    // NOT instant 18 * 13 = 234 HP burst on frame 61!
    const recoveryAfterImpact = player.hitRecoveryUntilFrame ?? 0
    player.hitRecoveryUntilFrame = 0
    player.mode = 1
    game.stepFrames(5)
    const burnIn5Frames = hpAfterImpact - player.hp
    expect(burnIn5Frames).toBeGreaterThanOrEqual(3)
    expect(burnIn5Frames).toBeLessThan(40)
    expect(player.mode).not.toBe(4)
    expect(player.hitRecoveryUntilFrame ?? 0).toBeLessThanOrEqual(recoveryAfterImpact)
  })

  it('scales monster ground fire by 1/256 fixed-point Fire Resistance (preserving 40% fire resist on sub-1-HP/frame ticks)', () => {
    const runBurn = (fireResStat: number): number => {
      const game = new GameInstance({ seed: 199904, difficulty: 0, areaId: 74 })
      const pid = game.connectPlayer({
        charClass: 'sor',
        name: 'ResTester',
        level: 20,
        hp: 200,
        maxHp: 200,
        x: 30,
        y: 30,
        areaId: 74,
      })
      const ghoulId = game.spawnMonster({
        hcIdx: 191,
        defId: 'vampire2',
        level: 20,
        hp: 300,
        maxHp: 300,
        x: 20,
        y: 30,
        areaId: 74,
      })
      const view = game as unknown as TestGameView
      const player = view.players.get(pid)!
      if (fireResStat > 0) {
        player.items.push({
          unitId: 9001,
          code: 'rin',
          location: 'equipped',
          bodyLoc: 6,
          identified: true,
          stats: new Map([[39, fireResStat]]),
          socketedItems: [],
        })
      }
      const ghoul = view.monsters.get(ghoulId)!
      ghoul.skillCooldown = 500
      ghoul.cooldown = 500

      // Spawn a single stationary #131 vampirefirewall patch directly on the player with fixed 64/256 (0.25 HP/frame)
      const patchRow = registry.getMissileById(131)!
      ;(game as unknown as {
        spawnMonsterMissile: (
          m: TestMonsterView,
          tx: number,
          ty: number,
          dmg: number,
          clsId: number,
          skId: number,
          opts: Record<string, unknown>,
        ) => number
      }).spawnMonsterMissile(ghoul, 30, 30, 0, 131, 170, {
        missile: patchRow,
        skillLevel: 1,
        groundFire256: { min: 64, max: 64 },
      })

      game.stepFrames(80)
      return 200 * FIXED_ONE - player.hpFixed
    }

    const unresistedLoss256 = runBurn(0) // 80 * 64 = 5120 (20 HP)
    const res40Loss256 = runBurn(40) // 80 * floor(64 * 0.6) = 80 * 38 = 3040 (11 HP => 11 * 256 = 2816)
    expect(unresistedLoss256).toBe(20 * FIXED_ONE)
    expect(res40Loss256).toBe(11 * FIXED_ONE)
  })

  it('#205 MonBlizzard (#106 monblizcenter -> #107 monbliz1) uses zero-damage spawner + own child cold damage without melee fallback', () => {
    const game = new GameInstance({ seed: 199905, difficulty: 0, areaId: 83 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'TravincalVisitor',
      level: 24,
      hp: 300,
      maxHp: 300,
      x: 30,
      y: 30,
      areaId: 83,
    })
    const hieroId = game.spawnMonster({
      hcIdx: 279,
      defId: 'zealot2',
      level: 24,
      hp: 400,
      maxHp: 400,
      minDmg: 40,
      maxDmg: 60,
      x: 20,
      y: 30,
      areaId: 83,
    })

    const view = game as unknown as TestGameView
    const hiero = view.monsters.get(hieroId)!
    hiero.skills = [{ skillId: 205, mode: 'S1', level: 4 }]

    expect(view.tryCastMonsterSkill(hiero, { x: 30, y: 30 }, 10)).toBe(true)
    hiero.skillCooldown = 500
    hiero.cooldown = 500

    const center = [...view.missiles.values()].find((m) => m.missileId === 106)!
    expect(center).toBeDefined()
    expect(center.carrier).toBe('none')
    expect(center.damage).toBe(0)

    game.stepFrames(15)
    const shards = [...view.missiles.values()].filter((m) => m.missileId === 107)
    expect(shards.length).toBeGreaterThan(0)
    for (const shard of shards) {
      expect(shard.carrier).toBeUndefined()
      expect(shard.elemDamage).toBeGreaterThan(0)
      // #107 monbliz1 own physical (MinDamage=1..2, +4/lvl => 13..14 at slvl=4), NOT 40..60 monster melee fallback!
      expect(shard.physDamage).toBeGreaterThanOrEqual(13)
      expect(shard.physDamage).toBeLessThanOrEqual(14)
    }
  })
})
