import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { createMemoryStreamPair } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  AnimDispatcher,
  computeEffectiveFbr,
  computeEffectiveFcr,
  computeEffectiveFhr,
  computeEffectiveIas,
} from '../../src/server/engine/anim-dispatcher.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import { UnitStatList } from '../../src/server/engine/stat-list.ts'
import { LocalLoopbackAdapter } from '../../src/server/loopback-adapter.ts'
import { MultiClientRoomHost } from '../../src/server/room-host.ts'
import { computeWhirlwindWeaponHitInterval113c } from '../../src/server/skills/whirlwind-113c.ts'

interface InternalItemView {
  unitId: number
  code: string
  location: string
  bodyLoc: number
  x: number
  y: number
  quantity: number
  durability: number
  maxDurability: number
  quality: number
  stats: Map<number, number>
}

interface InternalPlayerView {
  unitId: number
  x: number
  y: number
  mode: number
  hp: number
  maxHp: number
  hpFixed: number
  maxHpFixed: number
  mana: number
  maxMana: number
  manaFixed: number
  maxManaFixed: number
  dexterity: number
  strength: number
  leftSkill: number
  rightSkill: number
  skills: Map<number, number>
  states: Set<number>
  stateTimers: Map<number, number>
  hitRecoveryUntilFrame?: number
  blockRecoveryUntilFrame?: number
  items: InternalItemView[]
}

interface InternalMonsterView {
  unitId: number
  defId: string
  x: number
  y: number
  hp: number
  maxHp: number
  dead: boolean
  isBoss: boolean
  isPrimeEvil: boolean
  ac: number
  toBlock: number
  level: number
  states: Set<number>
  stateTimers: Map<number, number>
  resistances: {
    phys: number
    magic: number
    fire: number
    light: number
    cold: number
    poison: number
  }
}

interface InternalGameView {
  readonly currentFrame: number
  readonly animActionWindupEnabled: boolean
  readonly players: Map<number, InternalPlayerView>
  readonly monsters: Map<number, InternalMonsterView>
  readonly missiles: Map<number, { unitId: number; ownerId: number; skillId: number }>
  maybeEnterPlayerHitRecovery(
    player: InternalPlayerView,
    dealtDamage: number,
    options?: { dmg256?: number; hitClass?: number | string },
  ): void
  interruptPendingPlayerAnimAction113c(player: InternalPlayerView, mode: 'GH' | 'BL'): void
  playerBlockRecoveryFrames(player: InternalPlayerView): number
}

function viewOf(game: GameInstance): InternalGameView {
  return game as unknown as InternalGameView
}

function makeEquippedItem(
  unitId: number,
  code: string,
  bodyLoc: number,
  statPairs: readonly (readonly [number, number])[],
  opts?: { quantity?: number; durability?: number; maxDurability?: number },
): InternalItemView {
  return {
    unitId,
    code,
    location: 'equipped',
    bodyLoc,
    x: 0,
    y: 0,
    quantity: opts?.quantity ?? 0,
    durability: opts?.durability ?? 40,
    maxDurability: opts?.maxDurability ?? 40,
    quality: 4,
    stats: new Map(statPairs),
  }
}

describe('Wave 3 P0/P1: #1789 AnimDispatcher 25Hz Integration, #1862 Multi-Hit Rollback & WW IAS, #1877 Global STATE_SKILLDELAY', () => {
  describe('#1789 GameInstance 25Hz AnimDispatcher Windup, Frame-Lock & GH/BL Interruption', () => {
    it('matches exact 1.13c Sorceress 0% FCR (13f, action tick 7) vs 105% FCR (8f, action tick 5) continuous Fire Ball & Teleport breakpoints and rejects spam while locked', () => {
      // 1) 0% FCR Sorceress: SOSCHTH (14 frames, speed 256, actionFrame 7) -> release at +7, complete at +13
      {
        const game = new GameInstance({ seed: 178901, areaId: 2, animActionWindup: true })
        const sorcId = game.connectPlayer({
          charClass: 'sor',
          name: 'SorcZeroFcr',
          x: 100,
          y: 100,
          areaId: 2,
          level: 80,
          skills: { 47: 20, 54: 20 },
        })
        const v = viewOf(game)
        const p = v.players.get(sorcId)!
        p.maxMana = 1000
        p.maxManaFixed = 1000 * 256
        p.mana = 1000
        p.manaFixed = 1000 * 256

        // Enqueue Cast #1 at frame 0 (processed at start of stepFrame #1 -> currentFrame = 1)
        game.enqueueCommand(sorcId, {
          type: 'CastSkillAtLocation',
          skillId: 47,
          x: 115,
          y: 100,
          hand: 'right',
        })
        // Ticks 1..6: still in windup! Zero missiles spawned, mana untouched, spam casts rejected!
        for (let t = 1; t <= 6; t++) {
          if (t === 3) {
            // Spam another Fire Ball mid-windup -> must be rejected by anim_locked!
            game.enqueueCommand(sorcId, {
              type: 'CastSkillAtLocation',
              skillId: 47,
              x: 115,
              y: 100,
              hand: 'right',
            })
          }
          game.stepFrame()
          expect(v.missiles.size).toBe(0)
          expect(p.manaFixed).toBe(1000 * 256)
        }

        // Tick 7 (ActionFlag = 1): Fire Ball missile spawns and mana is deducted!
        game.stepFrame()
        expect(v.missiles.size).toBe(1)
        expect(p.manaFixed).toBeLessThan(1000 * 256)

        // Ticks 8..12: follow-through frame-lock still active -> early cast rejected!
        game.enqueueCommand(sorcId, {
          type: 'CastSkillAtLocation',
          skillId: 54,
          x: 110,
          y: 100,
          hand: 'right',
        })
        for (let t = 8; t <= 12; t++) {
          game.stepFrame()
          expect(p.x).toBe(100)
        }

        // Tick 13: animation completes! Next cast queued now starts cleanly on tick 14
        game.stepFrame()
        expect(game.getPlayerAnimDispatcher(sorcId)?.isActionLocked()).toBe(false)

        game.enqueueCommand(sorcId, {
          type: 'CastSkillAtLocation',
          skillId: 54,
          x: 108,
          y: 100,
          hand: 'right',
        })
        for (let t = 1; t <= 6; t++) {
          game.stepFrame()
          expect(p.x).toBe(100)
        }
        // Tick +7 of Teleport: relocates on ActionFlag = 1!
        game.stepFrame()
        expect(Math.round(p.x)).toBe(108)
      }

      // 2) 105% FCR Sorceress: EFCR = floor(120*105/225) = 56 -> stepSpeed256 = 399 -> release at +5, complete at +8!
      {
        const game = new GameInstance({ seed: 178902, areaId: 2, animActionWindup: true })
        const sorcId = game.connectPlayer({
          charClass: 'sor',
          name: 'Sorc105Fcr',
          x: 100,
          y: 100,
          areaId: 2,
          level: 80,
          skills: { 54: 20 },
        })
        const v = viewOf(game)
        const p = v.players.get(sorcId)!
        p.maxMana = 1000
        p.maxManaFixed = 1000 * 256
        p.mana = 1000
        p.manaFixed = 1000 * 256
        p.items.push(makeEquippedItem(9001, 'uap', 1, [[105, 105]])) // +105% FCR

        // Continuous Teleport #1 -> #2 -> verify exact 8-tick cycle and tick-5 release
        game.enqueueCommand(sorcId, {
          type: 'CastSkillAtLocation',
          skillId: 54,
          x: 106,
          y: 100,
          hand: 'right',
        })
        for (let t = 1; t <= 4; t++) {
          game.stepFrame()
          expect(p.x).toBe(100)
        }
        // Tick 5: ActionFlag = 1 relocates to x = 106!
        game.stepFrame()
        expect(Math.round(p.x)).toBe(106)
        expect(game.getPlayerAnimDispatcher(sorcId)?.isActionLocked()).toBe(true)

        // Ticks 6..7: follow-through locked
        game.stepFrame()
        expect(game.getPlayerAnimDispatcher(sorcId)?.isActionLocked()).toBe(true)
        game.stepFrame()
        expect(game.getPlayerAnimDispatcher(sorcId)?.isActionLocked()).toBe(true)

        // Tick 8: completed! Immediate second Teleport executes on ticks 9..16 (release at tick 13 = 5 + 8)!
        game.stepFrame()
        expect(game.getPlayerAnimDispatcher(sorcId)?.isActionLocked()).toBe(false)

        game.enqueueCommand(sorcId, {
          type: 'CastSkillAtLocation',
          skillId: 54,
          x: 112,
          y: 100,
          hand: 'right',
        })
        for (let t = 1; t <= 4; t++) {
          game.stepFrame()
          expect(Math.round(p.x)).toBe(106)
        }
        game.stepFrame()
        expect(Math.round(p.x)).toBe(112)
      }
    })

    it('interrupts pre-ActionFlag casts on GH (GetHit) and BL (Shield Block) with 0 missiles & 0 mana spent, while #144 Concentrate is uninterruptible', () => {
      // 1) Pre-ActionFlag GH cancels Sorceress Fire Ball
      {
        const game = new GameInstance({ seed: 178903, areaId: 2, animActionWindup: true })
        const sorcId = game.connectPlayer({
          charClass: 'sor',
          name: 'InterruptedSorc',
          x: 100,
          y: 100,
          areaId: 2,
          level: 80,
          skills: { 47: 20 },
        })
        const v = viewOf(game)
        const p = v.players.get(sorcId)!
        p.maxHp = 400
        p.maxHpFixed = 400 * 256
        p.hp = 400
        p.hpFixed = 400 * 256
        p.maxMana = 500
        p.maxManaFixed = 500 * 256
        p.mana = 500
        p.manaFixed = 500 * 256

        game.enqueueCommand(sorcId, {
          type: 'CastSkillAtLocation',
          skillId: 47,
          x: 115,
          y: 100,
          hand: 'right',
        })
        // Advance 3 ticks into windup (actionFrame 7 not reached yet)
        game.stepFrames(3)
        expect(v.missiles.size).toBe(0)

        // Heavy hit (>= 25% maxHp => 100% GH guarantee in 1.13c 0x6FCFD0FC)
        v.maybeEnterPlayerHitRecovery(p, 120)
        expect(p.mode).toBe(4) // PLRMODE_GETHIT

        // Step past original actionFrame 7..15 -> 0 missiles ever spawn and mana stays 100% full!
        game.stepFrames(15)
        expect(v.missiles.size).toBe(0)
        expect(p.manaFixed).toBe(500 * 256)
      }

      // 2) Pre-ActionFlag BL (Shield Block) cancels interruptible cast and scales recovery by FBR + Holy Shield
      {
        const game = new GameInstance({ seed: 178904, areaId: 2, animActionWindup: true })
        const palId = game.connectPlayer({
          charClass: 'pal',
          name: 'BlockPally',
          x: 100,
          y: 100,
          areaId: 2,
          level: 80,
          skills: { 101: 20 }, // Holy Bolt (interruptible SC)
        })
        const v = viewOf(game)
        const p = v.players.get(palId)!
        p.maxMana = 500
        p.maxManaFixed = 500 * 256
        p.mana = 500
        p.manaFixed = 500 * 256
        p.items.length = 0
        p.items.push(makeEquippedItem(9101, 'pab', 5, [[102, 0]])) // Sacred Targe 0% FBR

        const baseBlockNoHs = v.playerBlockRecoveryFrames(p) // 5f without Holy Shield
        p.states.add(101) // Holy Shield active -> 2-frame block!
        const fastBlockWithHs = v.playerBlockRecoveryFrames(p)
        expect(fastBlockWithHs).toBeLessThan(baseBlockNoHs)
        expect(fastBlockWithHs).toBe(2)

        game.enqueueCommand(palId, {
          type: 'CastSkillAtLocation',
          skillId: 101,
          x: 112,
          y: 100,
          hand: 'right',
        })
        game.stepFrames(2)
        v.interruptPendingPlayerAnimAction113c(p, 'BL')
        p.mode = 9
        p.blockRecoveryUntilFrame = v.currentFrame + fastBlockWithHs
        game.stepFrames(12)
        expect(v.missiles.size).toBe(0)
        expect(p.manaFixed).toBe(500 * 256)
      }

      // 3) Barbarian #144 Concentrate (`interrupt = 0`) ignores >= 25% maxHp hit mid-swing and lands full damage!
      {
        const game = new GameInstance({ seed: 178905, areaId: 2, animActionWindup: true })
        const barbId = game.connectPlayer({
          charClass: 'bar',
          name: 'ConcentrateBarb',
          x: 100,
          y: 100,
          areaId: 2,
          level: 85,
          skills: { 144: 20 },
        })
        const v = viewOf(game)
        const p = v.players.get(barbId)!
        p.strength = 250
        p.dexterity = 200
        p.maxHp = 1000
        p.maxHpFixed = 1000 * 256
        p.hp = 1000
        p.hpFixed = 1000 * 256
        p.maxMana = 300
        p.maxManaFixed = 300 * 256
        p.mana = 300
        p.manaFixed = 300 * 256
        p.items.length = 0
        p.items.push(
          makeEquippedItem(9201, '7cr', 4, [
            [111, 200],
            [115, 1],
            [19, 10000],
          ]),
        )

        const dummyId = game.spawnMonster({
          defId: 'hellbovine',
          x: 101,
          y: 100,
          areaId: 2,
          hp: 50000,
          maxHp: 50000,
          ac: 0,
          toBlock: 0,
        })
        const dummy = v.monsters.get(dummyId)!
        dummy.resistances.phys = 0

        game.enqueueCommand(barbId, {
          type: 'CastSkillOnTarget',
          skillId: 144,
          targetType: 'monster',
          targetId: dummyId,
        })
        game.stepFrames(2)
        // Concentrate defense buff state 15 is active during swing!
        expect(p.states.has(15)).toBe(true)

        // Deal 400 damage (40% of max HP!) mid-windup -> MUST NOT enter GH (mode 4)!
        v.maybeEnterPlayerHitRecovery(p, 400)
        expect(p.mode).not.toBe(4)

        // Finish swing -> Concentrate strike lands full damage and cleans up temporary state 15!
        game.stepFrames(15)
        expect(dummy.hp).toBeLessThan(50000)
        expect(p.states.has(15)).toBe(false)
      }
    })

    it('verifies diminishing-returns EIAS / EFCR / EFHR / EFBR formulas across character classes', async () => {
      expect(computeEffectiveFcr(0)).toBe(0)
      expect(computeEffectiveFcr(63)).toBe(41)
      expect(computeEffectiveFcr(105)).toBe(56)
      expect(computeEffectiveFcr(200)).toBe(75)
      expect(computeEffectiveFhr(86)).toBe(50)
      expect(computeEffectiveFbr(86)).toBe(50)
      expect(computeEffectiveIas({ itemIas: 60, skillIas: 35, weaponWsm: -30 })).toBe(75)

      const registry = await getSharedDataRegistry()
      for (const [token, skillId, expectedTicksZero] of [
        ['AM', 31, 19], // Amazon Freezing Arrow / SC
        ['NE', 84, 15], // Necromancer Bone Spear (NESCHTH: 16f @ 256 -> 15 ticks)
        ['PA', 112, 15], // Paladin Blessed Hammer (PASCHTH: 16f @ 256 -> 15 ticks)
        ['BA', 138, 13], // Barbarian Shout (BASCHTH: 14f @ 256 -> 13 ticks)
        ['DZ', 245, 18], // Druid Tornado (DZSCHTH: 19f @ 256 -> 18 ticks)
      ] as const) {
        const st = new UnitStatList(registry, { level: 80, maxmana: 500 * 256, mana: 500 * 256 })
        const sb = new StateBus(st, registry)
        const disp = new AnimDispatcher({
          registry,
          statList: st,
          stateBus: sb,
          charToken: token,
          weaponClass: '1HS',
          enforceFrameLock: true,
        })
        const sk = registry.getSkillById(skillId)!
        if ((sk.anim || 'SC').toUpperCase() === 'SC') {
          const res = disp.startSkillAnimation({ skill: sk, slvl: 20, currentTick: 0 })
          expect(res.allowed).toBe(true)
          let ticks = 0
          while (!disp.getCurrentAnimation()?.completed && ticks < 40) {
            ticks += 1
            disp.tick(ticks, () => {})
          }
          expect(ticks).toBe(expectedTicksZero)
        }
      }
    })
  })

  describe('#1862 Multi-Hit Rollback, SequenceTbls (SQ) & #151 Whirlwind Pure Weapon IAS', () => {
    it('executes max-IAS Paladin 5-hit #106 Zeal at exact 4/4/4/4/8 frame intervals (ticks 4, 8, 12, 16, 20, complete at 24)', () => {
      const game = new GameInstance({ seed: 186201, areaId: 2, animActionWindup: true })
      const palId = game.connectPlayer({
        charClass: 'pal',
        name: 'Zealot',
        x: 100,
        y: 100,
        areaId: 2,
        level: 85,
        skills: { 106: 20 },
      })
      const v = viewOf(game)
      const p = v.players.get(palId)!
      p.strength = 250
      p.dexterity = 200
      p.maxMana = 200
      p.maxManaFixed = 200 * 256
      p.mana = 200
      p.manaFixed = 200 * 256
      p.items.length = 0
      // Phase Blade ('7cr', WSM -30, 1HS) + +120% IAS -> EIAS = min(75, 60 - (-30)) = 75!
      p.items.push(
        makeEquippedItem(9301, '7cr', 4, [
          [93, 120],
          [111, 100],
          [115, 1],
          [19, 10000],
        ]),
      )

      const bossId = game.spawnMonster({
        defId: 'hellbovine',
        x: 101,
        y: 100,
        areaId: 2,
        hp: 100000,
        maxHp: 100000,
        ac: 0,
        toBlock: 0,
      })
      const boss = v.monsters.get(bossId)!
      boss.resistances.phys = 0

      game.enqueueCommand(palId, {
        type: 'CastSkillOnTarget',
        skillId: 106,
        targetType: 'monster',
        targetId: bossId,
      })

      const hitTicks: number[] = []
      let completionTick = -1
      let prevHp = boss.hp
      for (let tick = 1; tick <= 30; tick++) {
        game.stepFrame()
        if (boss.hp < prevHp) {
          hitTicks.push(tick)
          prevHp = boss.hp
        }
        if (completionTick === -1 && !game.getPlayerAnimDispatcher(palId)?.isActionLocked()) {
          completionTick = tick
          break
        }
      }

      // 4/4/4/4/8 Paladin Zeal: strikes at 4, 8, 12, 16, 20; finishes follow-through at tick 24!
      expect(hitTicks).toEqual([4, 8, 12, 16, 20])
      expect(completionTick).toBe(24)
    })

    it('executes #248 Fury (5-hit 70% rollback), #26 Strafe (50% rollback per-arrow), #10 Jab (3 SQ hits), #133 Double Swing (+50 skill IAS 2 SQ hits), #147 Frenzy, #140 Double Throw, #255 Dragon Talon & #260 Dragon Claw', () => {
      // 1) Werewolf Druid #248 Fury: 5 hits with 70% rollback
      {
        // Seed picked so none of the 5 swings rolls the 1.13c 5% minimum miss (95% hit-chance cap);
        // `stat 111` (+damage) now feeds both min & max, so the weapon roll consumes RNG.
        const game = new GameInstance({ seed: 186204, areaId: 2, animActionWindup: true })
        const druId = game.connectPlayer({
          charClass: 'dru',
          name: 'FuryDruid',
          x: 100,
          y: 100,
          areaId: 2,
          level: 85,
          skills: { 223: 20, 248: 20 },
        })
        const v = viewOf(game)
        const p = v.players.get(druId)!
        p.strength = 250
        p.dexterity = 200
        p.maxHp = 50000
        p.maxHpFixed = 50000 * 256
        p.hp = 50000
        p.hpFixed = 50000 * 256
        p.maxMana = 300
        p.maxManaFixed = 300 * 256
        p.mana = 300
        p.manaFixed = 300 * 256
        p.states.add(139) // Werewolf form
        p.items.length = 0
        p.items.push(
          makeEquippedItem(9310, '7cr', 4, [
            [93, 80],
            [111, 100],
            [115, 1],
            [19, 10000],
          ]),
        )
        const mId = game.spawnMonster({
          defId: 'hellbovine',
          x: 101,
          y: 100,
          areaId: 2,
          hp: 100000,
          maxHp: 100000,
          ac: 0,
          toBlock: 0,
        })
        v.monsters.get(mId)!.resistances.phys = 0

        game.enqueueCommand(druId, {
          type: 'CastSkillOnTarget',
          skillId: 248,
          targetType: 'monster',
          targetId: mId,
        })
        const furyHitTicks: number[] = []
        let prevHp = 100000
        for (let t = 1; t <= 45; t++) {
          game.stepFrame()
          const anim = game.getPlayerAnimDispatcher(druId)?.getCurrentAnimation()

          const curHp = v.monsters.get(mId)!.hp
          if (curHp < prevHp) {
            furyHitTicks.push(t)
            prevHp = curHp
          }
          if (furyHitTicks.length === 5 && !game.getPlayerAnimDispatcher(druId)?.isActionLocked()) break
        }
        expect(furyHitTicks.length).toBe(5)
      }

      // 2) Amazon #10 Jab (3 SQ spear hits) & #26 Strafe (per-rollback arrow shots)
      {
        const game = new GameInstance({ seed: 186204, areaId: 2, animActionWindup: true })
        const amaId = game.connectPlayer({
          charClass: 'ama',
          name: 'JavBowZon',
          x: 100,
          y: 100,
          areaId: 2,
          level: 85,
          skills: { 10: 20, 26: 20 },
        })
        const v = viewOf(game)
        const p = v.players.get(amaId)!
        p.strength = 200
        p.dexterity = 250
        p.maxHp = 50000
        p.maxHpFixed = 50000 * 256
        p.hp = 50000
        p.hpFixed = 50000 * 256
        p.maxMana = 400
        p.maxManaFixed = 400 * 256
        p.mana = 400
        p.manaFixed = 400 * 256
        p.items.length = 0
        p.items.push(
          makeEquippedItem(9320, 'jav', 4, [
            [93, 60],
            [111, 100],
            [115, 1],
            [19, 10000],
          ], { quantity: 80 }),
        )
        const mId = game.spawnMonster({
          defId: 'hellbovine',
          x: 101,
          y: 100,
          areaId: 2,
          hp: 100000,
          maxHp: 100000,
          ac: 0,
          toBlock: 0,
        })
        v.monsters.get(mId)!.resistances.phys = 0

        game.enqueueCommand(amaId, {
          type: 'CastSkillOnTarget',
          skillId: 10,
          targetType: 'monster',
          targetId: mId,
        })
        const jabHitTicks: number[] = []
        let prevHp = 100000
        for (let t = 1; t <= 30; t++) {
          game.stepFrame()
          const curHp = v.monsters.get(mId)!.hp
          if (curHp < prevHp) {
            jabHitTicks.push(t)
            prevHp = curHp
          }
          if (!game.getPlayerAnimDispatcher(amaId)?.isActionLocked()) break
        }
        expect(jabHitTicks.length).toBe(3)

        // Switch to bow ('amb') + spawn a second target at x=108 for Strafe multi-shot rollback!
        p.items.length = 0
        p.items.push(makeEquippedItem(9321, 'amb', 4, [[93, 60]]))
        const m2Id = game.spawnMonster({
          defId: 'hellbovine',
          x: 112,
          y: 100,
          areaId: 2,
          hp: 100000,
          maxHp: 100000,
          ac: 0,
          toBlock: 0,
        })
        expect(m2Id).toBeGreaterThan(0)
        game.drainEvents(amaId)

        game.enqueueCommand(amaId, {
          type: 'CastSkillAtLocation',
          skillId: 26,
          x: 112,
          y: 100,
          hand: 'right',
        })
        const strafeSpawnTicks: number[] = []
        for (let t = 1; t <= 60; t++) {
          game.stepFrame()
          for (const ev of game.drainEvents(amaId)) {
            if (ev.type === 'CreateMissile') {
              strafeSpawnTicks.push(t)
            }
          }
          if (!game.getPlayerAnimDispatcher(amaId)?.isActionLocked()) break
        }
        // slvl 20 Strafe vs 2 monsters: minShots = 2 + floor(20/4) = 7 arrows fired on distinct rollback ticks!
        expect(strafeSpawnTicks.length).toBe(7)
        expect(new Set(strafeSpawnTicks).size).toBe(7)
      }

      // 3) Barbarian #133 Double Swing (+50 skill IAS, 2 SQ hits), #147 Frenzy (2 SQ hits + state 94), & #140 Double Throw
      {
        const game = new GameInstance({ seed: 186204, areaId: 2, animActionWindup: true })
        const barbId = game.connectPlayer({
          charClass: 'bar',
          name: 'DualBarb',
          x: 100,
          y: 100,
          areaId: 2,
          level: 85,
          skills: { 133: 20, 147: 20, 140: 20 },
        })
        const v = viewOf(game)
        const p = v.players.get(barbId)!
        p.strength = 250
        p.dexterity = 250
        p.maxHp = 50000
        p.maxHpFixed = 50000 * 256
        p.hp = 50000
        p.hpFixed = 50000 * 256
        p.maxMana = 300
        p.maxManaFixed = 300 * 256
        p.mana = 300
        p.manaFixed = 300 * 256
        p.items.length = 0
        p.items.push(
          makeEquippedItem(9330, 'bkf', 4, [[111, 80], [115, 1], [19, 10000]], { quantity: 50 }),
          makeEquippedItem(9331, 'bkf', 5, [[111, 80], [115, 1], [19, 10000]], { quantity: 50 }),
        )
        const mId = game.spawnMonster({
          defId: 'hellbovine',
          x: 101,
          y: 100,
          areaId: 2,
          hp: 100000,
          maxHp: 100000,
          ac: 0,
          toBlock: 0,
        })
        v.monsters.get(mId)!.resistances.phys = 0

        // #133 Double Swing: 2 sequence strikes
        game.enqueueCommand(barbId, {
          type: 'CastSkillOnTarget',
          skillId: 133,
          targetType: 'monster',
          targetId: mId,
        })
        const dsTicks: number[] = []
        let prevHp = 100000
        for (let t = 1; t <= 25; t++) {
          game.stepFrame()
          const curHp = v.monsters.get(mId)!.hp
          if (curHp < prevHp) {
            dsTicks.push(t)
            prevHp = curHp
          }
          if (!game.getPlayerAnimDispatcher(barbId)?.isActionLocked()) break
        }
        expect(dsTicks.length).toBe(2)

        // #147 Frenzy: 2 sequence strikes + applies state 94 (`frenzy`)
        game.enqueueCommand(barbId, {
          type: 'CastSkillOnTarget',
          skillId: 147,
          targetType: 'monster',
          targetId: mId,
        })
        for (let t = 1; t <= 25; t++) {
          game.stepFrame()
          if (!game.getPlayerAnimDispatcher(barbId)?.isActionLocked()) break
        }
        expect(p.states.has(94)).toBe(true)

        // #140 Double Throw: 2 sequence throws deducting 1 stack from right hand then 1 from left hand
        game.enqueueCommand(barbId, {
          type: 'CastSkillAtLocation',
          skillId: 140,
          x: 112,
          y: 100,
          hand: 'right',
        })
        for (let t = 1; t <= 25; t++) {
          game.stepFrame()
          if (!game.getPlayerAnimDispatcher(barbId)?.isActionLocked()) break
        }
        expect(p.items[0]!.quantity).toBe(49)
        expect(p.items[1]!.quantity).toBe(49)
      }

      // 4) Assassin #255 Dragon Talon (4 kicks at slvl 18) & #260 Dragon Claw (2 SQ claw strikes)
      {
        const game = new GameInstance({ seed: 186202, areaId: 2, animActionWindup: true })
        const assId = game.connectPlayer({
          charClass: 'ass',
          name: 'KickClawSin',
          x: 100,
          y: 100,
          areaId: 2,
          level: 85,
          skills: { 255: 18, 260: 20 },
        })
        const v = viewOf(game)
        const p = v.players.get(assId)!
        p.strength = 220
        p.dexterity = 220
        p.maxHp = 50000
        p.maxHpFixed = 50000 * 256
        p.hp = 50000
        p.hpFixed = 50000 * 256
        p.maxMana = 300
        p.maxManaFixed = 300 * 256
        p.mana = 300
        p.manaFixed = 300 * 256
        p.items.length = 0
        p.items.push(
          makeEquippedItem(9340, '9tw', 4, [[93, 60], [111, 80], [115, 1], [19, 50000]]),
          makeEquippedItem(9341, '9tw', 5, [[93, 60], [111, 80], [115, 1], [19, 50000]]),
          makeEquippedItem(9342, 'uhb', 9, []), // Myrmidon Greaves
        )
        const bossId = game.spawnMonster({
          defId: 'hellbovine',
          x: 101,
          y: 100,
          areaId: 2,
          hp: 100000,
          maxHp: 100000,
          ac: 0,
          toBlock: 0,
        })
        const boss = v.monsters.get(bossId)!
        boss.isBoss = true // keep in place after final kick so #260 Dragon Claw remains in melee range
        boss.level = 1
        boss.states.add(1) // stationary dummy
        boss.stateTimers.set(1, 500)
        boss.resistances.phys = 0

        // #255 Dragon Talon at slvl 18 -> 1 + floor(18/6) = 4 rollback kicks at exact 3/3/3/7 cadence (`[3, 6, 9, 12]`)!
        game.enqueueCommand(assId, {
          type: 'CastSkillOnTarget',
          skillId: 255,
          targetType: 'monster',
          targetId: bossId,
        })
        const kickTicks: number[] = []
        for (let t = 1; t <= 40; t++) {
          const prevHp = boss.hp
          game.stepFrame()
          if (boss.hp < prevHp) {
            kickTicks.push(t)
          }
          if (!game.getPlayerAnimDispatcher(assId)?.isActionLocked()) break
        }
        expect(kickTicks).toEqual([3, 6, 9, 12])

        // #260 Dragon Claw -> 2 SQ claw hits!
        game.enqueueCommand(assId, {
          type: 'CastSkillOnTarget',
          skillId: 260,
          targetType: 'monster',
          targetId: bossId,
        })
        const clawTicks: number[] = []
        for (let t = 1; t <= 30; t++) {
          const prevHp = boss.hp
          game.stepFrame()
          if (boss.hp < prevHp) {
            clawTicks.push(t)
          }
          if (!game.getPlayerAnimDispatcher(assId)?.isActionLocked()) break
        }
        expect(clawTicks.length).toBe(2)
      }
    })

    it('enforces #151 Whirlwind pure weapon-local IAS: armor/gloves IAS is ignored, while Grief Phase Blade (-30 WSM + 35% weapon IAS -> effIas 65 >= 34) hits every 4 frames', () => {
      // Pure breakpoint check
      // Thunder Maul ('7gm', 2H non-sword, WSM +20) with 0% weapon IAS -> effIas = -20 -> 14-frame interval!
      expect(computeWhirlwindWeaponHitInterval113c(0, 20, true)).toBe(14)
      // Grief Phase Blade ('7cr', WSM -30) with +35% weapon IAS -> effIas = 65 >= 34 -> 4-frame interval!
      expect(computeWhirlwindWeaponHitInterval113c(35, -30, false)).toBe(4)

      const runWhirlwindPass = (seed: number, weaponCode: string, weaponIas: number, armorIas: number): number[] => {
        const game = new GameInstance({ seed, areaId: 2, animActionWindup: true })
        const barbId = game.connectPlayer({
          charClass: 'bar',
          name: 'WWBarb',
          x: 100,
          y: 100,
          areaId: 2,
          level: 90,
          skills: { 151: 20 },
        })
        const v = viewOf(game)
        const p = v.players.get(barbId)!
        p.strength = 250
        p.dexterity = 250
        p.maxHp = 50000
        p.maxHpFixed = 50000 * 256
        p.hp = 50000
        p.hpFixed = 50000 * 256
        p.maxMana = 300
        p.maxManaFixed = 300 * 256
        p.mana = 300
        p.manaFixed = 300 * 256
        p.items.length = 0
        p.items.push(
          makeEquippedItem(9401, weaponCode, 4, [
            ...(weaponIas > 0 ? ([[93, weaponIas]] as const) : []),
            [111, 150],
            [115, 1],
            [19, 10000],
          ]),
        )
        if (armorIas > 0) {
          // +120% off-weapon IAS on body armor (`bodyLoc 3`) & gloves (`bodyLoc 10`) -> MUST BE IGNORED by WW!
          p.items.push(
            makeEquippedItem(9402, 'utp', 3, [[93, armorIas]]),
            makeEquippedItem(9403, 'ulg', 10, [[93, armorIas]]),
          )
        }
        // Line of stationary dummies along x = 101..111 so every check frame is in melee reach
        const dummyIds: number[] = []
        for (let dx = 101; dx <= 111; dx += 2) {
          const mid = game.spawnMonster({
            defId: 'hellbovine',
            x: dx,
            y: 100,
            areaId: 2,
            hp: 100000,
            maxHp: 100000,
            ac: 0,
            toBlock: 0,
          })
          v.monsters.get(mid)!.resistances.phys = 0
          dummyIds.push(mid)
        }

        const totalMonsterHp = (): number =>
          dummyIds.reduce((sum, id) => sum + v.monsters.get(id)!.hp, 0)

        game.enqueueCommand(barbId, {
          type: 'CastSkillAtLocation',
          skillId: 151,
          x: 112,
          y: 100,
          hand: 'right',
        })
        const hitFramesRelativeToStart: number[] = []
        // `startWhirlwind` runs inside `processCommands` at `startFrame = v.currentFrame` (`0`)
        const startFrame = v.currentFrame
        game.stepFrame()
        for (let step = 1; step <= 32; step++) {
          const prevTotal = totalMonsterHp()
          game.stepFrame()
          const curTotal = totalMonsterHp()
          if (curTotal < prevTotal) {
            hitFramesRelativeToStart.push(v.currentFrame - startFrame)
          }
          if (!p.states.has(174)) break
        }
        return hitFramesRelativeToStart
      }

      // 1) Slow Thunder Maul (`7gm`, 2H non-sword, WSM +20, 0% weapon IAS -> 14f interval) WITHOUT armor IAS vs WITH +120% armor/gloves IAS:
      //    Both MUST produce the exact same 14-frame follow-up schedule (`4, 18, 32`)!
      const slowNoArmorIas = runWhirlwindPass(186210, '7gm', 0, 0)
      const slowWithArmorIas = runWhirlwindPass(186210, '7gm', 0, 120)
      expect(slowWithArmorIas).toEqual(slowNoArmorIas)
      expect(slowNoArmorIas.slice(0, 2)).toEqual([4, 18])

      // 2) Grief Phase Blade (`7cr`, WSM -30, +35% on-weapon IAS -> effIas = +65 >= 34 -> 4f interval):
      //    Checks strictly every 4 frames (`4, 8, 12, 16, 20, 24, ...`); union two seeds so a 5% 1.13c
      //    95%-to-hit-cap miss roll on an individual check frame never masks an active 4-frame slot.
      const griefHitsA = runWhirlwindPass(186211, '7cr', 35, 0)
      const griefHitsB = runWhirlwindPass(186212, '7cr', 35, 0)
      for (const f of [...griefHitsA, ...griefHitsB]) {
        expect(f % 4).toBe(0)
      }
      const observedCheckSlots = [...new Set([...griefHitsA, ...griefHitsB])]
        .filter((f) => f <= 24)
        .sort((a, b) => a - b)
      expect(observedCheckSlots).toEqual([4, 8, 12, 16, 20, 24])
    })
  })

  describe('#1877 Global STATE_SKILLDELAY (state 121) Shared Across All 23 Delay Skills', () => {
    it('audits all 23 canonical 1.13c delay > 0 player skills in Skills.txt', async () => {
      const registry = await getSharedDataRegistry()
      const delayIds: number[] = []
      for (let id = 0; id < 360; id++) {
        const sk = registry.getSkillById(id)
        if (sk && sk.delay && sk.delay !== '' && sk.delay !== '0') {
          delayIds.push(sk.id)
        }
      }
      expect(delayIds).toEqual([
        15, 25, 27, 32, 51, 56, 59, 62, 64, 121, 223, 225, 228, 229, 234, 244, 249, 250, 256, 257,
        268, 275, 279,
      ])
    })

    it('casting #59 Blizzard (45f) applies state 121, blocks #64 Frozen Orb / #56 Meteor for 44 ticks while allowing #54 Teleport / #55 Glacial Spike / #47 Fire Ball, and unlocks on tick +45', () => {
      const game = new GameInstance({ seed: 187701, areaId: 2 })
      const sorcId = game.connectPlayer({
        charClass: 'sor',
        name: 'BlizzOrbSorc',
        x: 100,
        y: 100,
        areaId: 2,
        level: 85,
        skills: {
          42: 20, // Static Field (delay 0)
          47: 20, // Fire Ball (delay 0)
          54: 20, // Teleport (delay 0)
          55: 20, // Glacial Spike (delay 0)
          56: 20, // Meteor (delay 30)
          59: 20, // Blizzard (delay 45)
          64: 20, // Frozen Orb (delay 25)
        },
      })
      const v = viewOf(game)
      const p = v.players.get(sorcId)!
      p.maxMana = 2000
      p.maxManaFixed = 2000 * 256
      p.mana = 2000
      p.manaFixed = 2000 * 256

      // Frame 1: Cast #59 Blizzard (45-frame global casting delay)
      game.enqueueCommand(sorcId, {
        type: 'CastSkillAtLocation',
        skillId: 59,
        x: 108,
        y: 100,
        hand: 'right',
      })
      const f1Events = game.stepFrame().get(sorcId) ?? []
      expect(p.states.has(121)).toBe(true)
      expect(
        f1Events.some(
          (ev) =>
            (ev.type === 'StateSet' && ev.state === 121) ||
            (ev.type === 'UnitState' &&
              ((ev as { state?: number }).state === 121 ||
                (ev as { stateId?: number }).stateId === 121) &&
              ev.active),
        ),
      ).toBe(true)

      // Frame 2 (1 tick into 45f delay):
      // Attempt #64 Frozen Orb (delay 25) and #56 Meteor (delay 30) -> BOTH BLOCKED by global state 121!
      p.mana = 2000
      p.manaFixed = 2000 * 256
      const missilesBeforeBlocked = v.missiles.size
      game.enqueueCommand(sorcId, {
        type: 'CastSkillAtLocation',
        skillId: 64,
        x: 110,
        y: 100,
        hand: 'right',
      })
      game.enqueueCommand(sorcId, {
        type: 'CastSkillAtLocation',
        skillId: 56,
        x: 110,
        y: 100,
        hand: 'right',
      })
      const f2Events = game.stepFrame().get(sorcId) ?? []
      expect(
        f2Events.some(
          (ev) => ev.type === 'SkillCast' && (ev.skill === 64 || ev.skill === 56),
        ),
      ).toBe(false)
      expect(v.missiles.size).toBe(missilesBeforeBlocked)
      expect(p.manaFixed).toBe(2000 * 256)
      expect(p.states.has(121)).toBe(true)

      // Frames 3..5 (still inside 45f delay):
      // Non-delay skills (#55 Glacial Spike, #47 Fire Ball, #54 Teleport) MUST succeed freely!
      game.enqueueCommand(sorcId, {
        type: 'CastSkillAtLocation',
        skillId: 55,
        x: 112,
        y: 100,
        hand: 'right',
      })
      const f3Events = game.stepFrame().get(sorcId) ?? []
      expect(f3Events.some((ev) => ev.type === 'SkillCast' && ev.skill === 55)).toBe(true)

      game.enqueueCommand(sorcId, {
        type: 'CastSkillAtLocation',
        skillId: 47,
        x: 112,
        y: 100,
        hand: 'right',
      })
      const f4Events = game.stepFrame().get(sorcId) ?? []
      expect(f4Events.some((ev) => ev.type === 'SkillCast' && ev.skill === 47)).toBe(true)

      game.enqueueCommand(sorcId, {
        type: 'CastSkillAtLocation',
        skillId: 54,
        x: 105,
        y: 100,
        hand: 'right',
      })
      const f5Events = game.stepFrame().get(sorcId) ?? []
      expect(f5Events.some((ev) => ev.type === 'SkillCast' && ev.skill === 54)).toBe(true)
      expect(Math.round(p.x)).toBe(105)
      expect(p.states.has(121)).toBe(true)

      // Advance up to tick +44 since Blizzard cast (we already stepped 4 frames after frame 1 -> step 40 more = +44 total):
      // State 121 MUST still be active at +44!
      game.stepFrames(40)
      expect(p.states.has(121)).toBe(true)

      // Tick +45: State 121 expires, emits StateEnd(121), and #64 Frozen Orb is immediately castable!
      const f46Events = game.stepFrame().get(sorcId) ?? []
      expect(p.states.has(121)).toBe(false)
      expect(
        f46Events.some(
          (ev) =>
            (ev.type === 'StateEnd' && ev.state === 121) ||
            (ev.type === 'UnitState' &&
              ((ev as { state?: number }).state === 121 ||
                (ev as { stateId?: number }).stateId === 121) &&
              !ev.active),
        ),
      ).toBe(true)

      p.mana = 2000
      p.manaFixed = 2000 * 256
      game.enqueueCommand(sorcId, {
        type: 'CastSkillAtLocation',
        skillId: 64,
        x: 115,
        y: 100,
        hand: 'right',
      })
      const f47Events = game.stepFrame().get(sorcId) ?? []
      expect(f47Events.some((ev) => ev.type === 'SkillCast' && ev.skill === 64)).toBe(true)
      expect(p.states.has(121)).toBe(true)
      expect(p.stateTimers.get(121)).toBe(25)
    })
  })

  describe('Production Room Entry Points, #43 Telekinesis / #90 Iron Golem Windup & Mid-Swing Frame-Lock', () => {
    it('enables 25Hz AnimDispatcher windup & rollback by default in both MultiClientRoomHost and LocalLoopbackAdapter', () => {
      // 1) Default MultiClientRoomHost (no animActionWindup option passed)
      const host = new MultiClientRoomHost({ mapSeed: 178911, areaId: 2 })
      expect(viewOf(host.game).animActionWindupEnabled).toBe(true)
      const [_clientStream, serverStream] = createMemoryStreamPair()
      const sorcId = host.connectClient(serverStream, {
        charClass: 'sor',
        name: 'RoomSorc',
        x: 100,
        y: 100,
        areaId: 2,
        level: 40,
        skills: { 47: 10 },
      })
      const hv = viewOf(host.game)
      const hp = hv.players.get(sorcId)!
      hp.maxMana = 500
      hp.maxManaFixed = 500 * 256
      hp.mana = 500
      hp.manaFixed = 500 * 256
      const manaStart = hp.manaFixed

      host.game.enqueueCommand(sorcId, {
        type: 'CastSkillAtLocation',
        skillId: 47,
        x: 112,
        y: 100,
        hand: 'right',
      })
      // SOSCHTH @ 0 FCR: actionFrame = 7 -> ticks 1..6 windup (0 mana spent, 0 missiles), tick 7 releases!
      for (let t = 1; t <= 6; t++) {
        host.stepFrame()
        expect(hv.missiles.size).toBe(0)
        expect(hp.manaFixed).toBe(manaStart)
      }
      host.stepFrame()
      expect(hv.missiles.size).toBeGreaterThanOrEqual(1)
      expect(hp.manaFixed).toBeLessThan(manaStart)

      // 2) Default LocalLoopbackAdapter (no animActionWindup option passed)
      const adapter = new LocalLoopbackAdapter({
        charClass: 'pal',
        charName: 'SpZealot',
        level: 85,
        areaId: 2,
        x: 100,
        y: 100,
        mapSeed: 186201,
      })
      expect(viewOf(adapter.game).animActionWindupEnabled).toBe(true)
      const av = viewOf(adapter.game)
      const ap = av.players.get(adapter.playerUnitId)!
      ap.skills.set(106, 20)
      ap.strength = 250
      ap.dexterity = 200
      ap.maxMana = 200
      ap.maxManaFixed = 200 * 256
      ap.mana = 200
      ap.manaFixed = 200 * 256
      ap.items.length = 0
      ap.items.push(
        makeEquippedItem(9501, '7cr', 4, [
          [93, 120],
          [111, 100],
          [115, 1],
          [19, 10000],
        ]),
      )
      const bossId = adapter.game.spawnMonster({
        defId: 'hellbovine',
        x: 101,
        y: 100,
        areaId: 2,
        hp: 100000,
        maxHp: 100000,
        ac: 0,
        toBlock: 0,
      })
      const boss = av.monsters.get(bossId)!
      boss.resistances.phys = 0

      adapter.send({
        type: 'CastSkillOnTarget',
        skillId: 106,
        targetType: 'monster',
        targetId: bossId,
      })
      const hitTicks: number[] = []
      let prevHp = boss.hp
      for (let tick = 1; tick <= 24; tick++) {
        adapter.stepFrame()
        if (boss.hp < prevHp) {
          hitTicks.push(tick)
          prevHp = boss.hp
        }
      }
      expect(hitTicks).toEqual([4, 8, 12, 16, 20])
    })

    it('routes #43 Telekinesis and #90 Iron Golem through 25Hz ActionFlag windup and allows GH pre-ActionFlag cancel', () => {
      // 1) Sorceress #43 Telekinesis: deferred item pickup until ActionFlag=1 & pre-action GH cancel
      {
        const game = new GameInstance({ seed: 178921, areaId: 2, animActionWindup: true })
        const sorcId = game.connectPlayer({
          charClass: 'sor',
          name: 'TkSorc',
          x: 100,
          y: 100,
          areaId: 2,
          level: 30,
          skills: { 43: 5 },
          hp: 500,
          maxHp: 500,
        })
        const v = viewOf(game)
        const p = v.players.get(sorcId)!
        p.maxMana = 300
        p.maxManaFixed = 300 * 256
        p.mana = 300
        p.manaFixed = 300 * 256
        const manaBefore = p.manaFixed

        const potId = (
          game as unknown as {
            spawnGroundItem: (spec: { code: string; x: number; y: number; areaId: number }) => number
          }
        ).spawnGroundItem({ code: 'hp1', x: 110, y: 100, areaId: 2 })

        // Cast #1: Interrupted at tick 3 by >=25% maxHp GH hit -> potion remains on ground. Telekinesis has
        // `srvstfunc` 12 (`0x6FC62360`, succeeds for a valid target) and no `usemanaondo`, so 1.13c
        // `SKILLS_DoSkillStart` (`0x6FCBFE69..0x6FCBFE87` -> `0x6FCBF850`) pays the mana at cast start and the
        // GH cancel does not refund it.
        game.enqueueCommand(sorcId, {
          type: 'CastSkillOnTarget',
          skillId: 43,
          targetType: 'item',
          targetId: potId,
        })
        game.stepFrames(3)
        expect((game as unknown as { groundItems: Map<number, unknown> }).groundItems.has(potId)).toBe(true)
        const manaAfterStart = p.manaFixed
        expect(manaAfterStart).toBeLessThan(manaBefore)

        v.maybeEnterPlayerHitRecovery(p, 150)
        expect(p.mode).toBe(4)
        game.stepFrames(20)
        expect((game as unknown as { groundItems: Map<number, unknown> }).groundItems.has(potId)).toBe(true)
        expect(p.manaFixed).toBeLessThan(manaBefore)

        // Cast #2: Uninterrupted -> ticks 1..6 windup leaves potion on ground; tick 7 picks it up!
        game.enqueueCommand(sorcId, {
          type: 'CastSkillOnTarget',
          skillId: 43,
          targetType: 'item',
          targetId: potId,
        })
        const manaBeforeCast2 = p.manaFixed
        for (let t = 1; t <= 6; t++) {
          game.stepFrame()
          expect((game as unknown as { groundItems: Map<number, unknown> }).groundItems.has(potId)).toBe(true)
          expect(p.manaFixed).toBeLessThan(manaBeforeCast2)
        }
        game.stepFrame()
        expect((game as unknown as { groundItems: Map<number, unknown> }).groundItems.has(potId)).toBe(false)
        expect(p.manaFixed).toBeLessThan(manaBeforeCast2)
      }

      // 2) Necromancer #90 Iron Golem: deferred metal item consumption & golem spawn until ActionFlag=1
      {
        const game = new GameInstance({ seed: 178922, areaId: 2, animActionWindup: true })
        const necId = game.connectPlayer({
          charClass: 'nec',
          name: 'IronNecro',
          x: 100,
          y: 100,
          areaId: 2,
          level: 40,
          skills: { 90: 10 },
        })
        const v = viewOf(game)
        const p = v.players.get(necId)!
        p.maxMana = 400
        p.maxManaFixed = 400 * 256
        p.mana = 400
        p.manaFixed = 400 * 256
        const manaBefore = p.manaFixed

        const swordId = (
          game as unknown as {
            spawnGroundItem: (spec: { code: string; x: number; y: number; areaId: number }) => number
          }
        ).spawnGroundItem({ code: 'bsd', x: 103, y: 100, areaId: 2 })

        game.enqueueCommand(necId, {
          type: 'CastSkillOnTarget',
          skillId: 90,
          targetType: 'item',
          targetId: swordId,
        })
        // NESC1HS @ 0 FCR: 16 frames, actionFrame = 8 -> ticks 1..7 windup (sword still on ground, 0 pets), tick 8 releases!
        for (let t = 1; t <= 7; t++) {
          game.stepFrame()
          expect((game as unknown as { groundItems: Map<number, unknown> }).groundItems.has(swordId)).toBe(true)
          expect(game.getPetsForOwner(necId).length).toBe(0)
          // `srvstfunc` 20 (`0x6FC6EDD0`) succeeds on a metal item, so the mana is paid at cast start.
          expect(p.manaFixed).toBeLessThan(manaBefore)
        }
        // Tick 8 (ActionFlag=1): consumes sword, spawns Iron Golem!
        game.stepFrame()
        expect((game as unknown as { groundItems: Map<number, unknown> }).groundItems.has(swordId)).toBe(false)
        expect(game.getPetsForOwner(necId).some((pet) => pet.sourceSkillId === 90)).toBe(true)
        expect(p.manaFixed).toBeLessThan(manaBefore)
      }
    })

    it('rejects Move / Interact / TownPortal during skill frame-lock while allowing Move to cancel active post-ActionFlag #41 Inferno channeling', () => {
      const game = new GameInstance({ seed: 178923, areaId: 2, animActionWindup: true })
      const sorcId = game.connectPlayer({
        charClass: 'sor',
        name: 'FrameLockSorc',
        x: 100,
        y: 100,
        areaId: 2,
        level: 40,
        skills: { 41: 10, 47: 10 },
      })
      const v = viewOf(game)
      const p = v.players.get(sorcId)!
      p.maxMana = 600
      p.maxManaFixed = 600 * 256
      p.mana = 600
      p.manaFixed = 600 * 256
      // Give a Town Portal scroll ('tsc') in inventory so TownPortal would succeed when unlocked
      p.items.push(makeEquippedItem(9601, 'tsc', 0, [], { quantity: 1 }))
      p.items[p.items.length - 1]!.location = 'inventory'

      // 1) Cast #47 Fire Ball (13 ticks @ 0 FCR): mid-cast Move & TownPortal at tick 3 and follow-through tick 9 MUST be rejected!
      game.enqueueCommand(sorcId, {
        type: 'CastSkillAtLocation',
        skillId: 47,
        x: 112,
        y: 100,
        hand: 'right',
      })
      game.stepFrames(2)
      const castMode = p.mode
      game.enqueueCommand(sorcId, { type: 'Move', x: 120, y: 100, run: true })
      game.enqueueCommand(sorcId, { type: 'TownPortal' })
      game.stepFrame() // tick 3 (windup)
      expect(p.mode).toBe(castMode)
      expect(Math.round(p.x)).toBe(100)
      expect([...(game as unknown as { objects: Map<number, { classId: number }> }).objects.values()].some((o) => o.classId === 59)).toBe(false)

      game.stepFrames(5) // tick 8 (post-ActionFlag follow-through, still locked until tick 13)
      game.enqueueCommand(sorcId, { type: 'RunToLocation', x: 120, y: 100 })
      game.stepFrame() // tick 9
      expect(p.mode).toBe(castMode)
      expect(Math.round(p.x)).toBe(100)

      // Finish remaining 4 follow-through ticks -> unlocked!
      game.stepFrames(4)
      expect(game.getPlayerAnimDispatcher(sorcId)?.isActionLocked()).toBe(false)

      // 2) Cast #41 Inferno (channeling startMana > 0): once ActionFlag=1 fires, Move cancels channeling (state 12) and starts running!
      game.enqueueCommand(sorcId, {
        type: 'CastSkillAtLocation',
        skillId: 41,
        x: 112,
        y: 100,
        hand: 'right',
      })
      // Advance past ActionFlag=1 (SOSCHTH / S1 actionFrame <= 8) while still inside animation duration
      let triggered = false
      for (let t = 1; t <= 12; t++) {
        game.stepFrame()
        const cur = game.getPlayerAnimDispatcher(sorcId)?.getCurrentAnimation()
        if (cur?.actionTriggered && !cur.completed) {
          triggered = true
          break
        }
      }
      expect(triggered).toBe(true)
      expect(p.states.has(12)).toBe(true)

      game.enqueueCommand(sorcId, { type: 'Move', x: 115, y: 100, run: true })
      game.stepFrame()
      expect(p.states.has(12)).toBe(false)
      expect(game.getPlayerAnimDispatcher(sorcId)?.isActionLocked()).toBe(false)
    })
  })
})
