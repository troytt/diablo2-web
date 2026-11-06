/**
 * Wave 2 Act Bosses & Ancients P0 Regression Suite (#1825, #1826, #1827)
 *
 * Verifies 1.13c D2Game.dll & MPQ ground truth + 734-row non-missile monster skill sweep:
 * - #1825: Diablo (#243, #333, #705) Red Lightning Hose (#193, NM/Hell <4.5 blind spot),
 *   32-bolt radial Fire Nova (#195), Firestorm (#197), PrimeFirewall (#188), Cold Touch (#194),
 *   Four-Legged Charge (#198), 16-segment Bone Prison (#199) on players & Chaos Sanctuary TPs (#59),
 *   and Diablogeddon (#349) on Diablo Clone / Uber Diablo.
 * - #1826: Baal (#544, #570 Vile Effigy, #709 Uber Baal) Clone spawn cap, exact 2x incoming damage,
 *   zero XP/drops/quest credit on Clone, instant Clone + Tentacle despawn on real Baal death,
 *   stationary Festering Appendages (#315 -> #562..566), Defense Curse (#309) vs Blood Mana (#310),
 *   Hoarfrost expanding V-wedge (#318), Mana Rift 50% current Mana drain (#317), closing-distance
 *   Baal Teleport (#329/#331), and 32-bolt Incineration Nova (#316).
 * - #1827: Arreat Summit Ancients (#540 Talic Whirlwind #151, #541 Madawc Shout #138 +140% AC &
 *   Double Throw #140 -> #525, #542 Korlic Leap Attack #143) + non-missile monster skill class sweep
 *   (Duriel #10 Jab / #97 Smite / #107 Charge, Council #62 Hydra -> #351 -> #337, Nihlathak #351 CE
 *   10..20% base corpse HP + state 104 & #330 Imp Teleport, Blood Raven #167 Nest -> 0-XP zombie2).
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  MONAI_PROFILES_113C,
  isBaalTentacleHcIdx113c,
  isBonePrisonMonsterHcIdx113c,
  monaiProfile113c,
} from '../../src/common/units/monai-113c.ts'
import { executeActBossAi113c, STATIONARY_AI_SET } from '../../src/server/ai/monster-ai.ts'
import { questWordIndex113c, QUEST_FLAG_COMPLETED_113C } from '../../src/server/engine/quests-113c.ts'

interface InternalMonsterView {
  unitId: number
  hcIdx: number
  defId: string
  x: number
  y: number
  hp: number
  maxHp: number
  unscaledMaxHp: number
  baseMaxHp: number
  ac: number
  baseAcBeforeShout: number
  experience: number
  dead: boolean
  shattered: boolean
  cooldown: number
  skillCooldown: number
  nextAiFrame: number
  skillCursor: number
  baalCloneSpawnCount: number
  activeBaalCloneUnitId: number
  activeBossChannel?: unknown
  bossUnitId?: number
  states: Set<number>
  resistances: {
    phys: number
    magic: number
    fire: number
    light: number
    cold: number
    poison: number
  }
}

interface InternalPlayerView {
  unitId: number
  x: number
  y: number
  hp: number
  maxHp: number
  maxHpFixed: number
  mana: number
  maxMana: number
  manaFixed: number
  maxManaFixed: number
  experience: number
  dead: boolean
  states: Set<number>
  questFlags: Uint16Array
}

function viewGame(game: GameInstance): {
  monsters: Map<number, InternalMonsterView>
  players: Map<number, InternalPlayerView>
  groundItems: Map<number, unknown>
} {
  return game as unknown as {
    monsters: Map<number, InternalMonsterView>
    players: Map<number, InternalPlayerView>
    groundItems: Map<number, unknown>
  }
}

function readyAi(m: InternalMonsterView, skillCursor?: number): void {
  m.cooldown = 0
  m.skillCooldown = 0
  m.nextAiFrame = 0
  m.activeBossChannel = undefined
  if (skillCursor !== undefined) {
    m.skillCursor = skillCursor
  }
}

describe('Wave 2 Act Bosses, Ancients & Monster Combat/Summon Skill Sweep (#1825..#1827)', () => {
  describe('Issue #1825: Diablo (#243 diablo, #333 diabloclone, #705 uberdiablo) 1.13c AI & Skills', () => {
    it('#193 DiabLight hits point-blank in Normal but leaves the exact <4.5 sub-tile blind spot in Nightmare & Hell', () => {
      // 1) Normal (difficulty = 0): point-blank player at dist = 2.5 (< 4.5) takes full DiabLight hits
      const normGame = new GameInstance({ seed: 182501, areaId: 108, difficulty: 0 })
      const normPid = normGame.connectPlayer({
        charClass: 'bar',
        name: 'NormMelee',
        x: 52.5,
        y: 50,
        areaId: 108,
        hp: 4000,
        maxHp: 4000,
      })
      const normDiabloId = normGame.spawnMonster({
        defId: 'diablo',
        hcIdx: 243,
        classId: 243,
        x: 50,
        y: 50,
        areaId: 108,
        hp: 20000,
        maxHp: 20000,
      })
      const normView = viewGame(normGame)
      // Pre-set state 11 (chill) so close-range #194 Cold Touch does not preempt slot 0 (#193 DiabLight)
      normView.players.get(normPid)!.states.add(11)
      readyAi(normView.monsters.get(normDiabloId)!, 0)
      normGame.drainEvents(normPid)

      normGame.stepFrames(10)
      const normEvents = normGame.drainEvents(normPid)
      expect(
        normEvents.some(
          (e) => e.type === 'SkillCast' && (e as { skillId?: number }).skillId === 193,
        ),
      ).toBe(true)
      expect(
        normEvents.some(
          (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 172,
        ),
      ).toBe(true)
      expect(normView.players.get(normPid)!.hp).toBeLessThan(4000)

      // 2) Hell (difficulty = 2): point-blank player at dist = 2.5 (< 4.5) takes ZERO DiabLight damage,
      // while ranged player along the same beam at dist = 9.0 (>= 5.5) takes full DiabLight stream damage!
      const hellGame = new GameInstance({ seed: 182502, areaId: 108, difficulty: 2, maxPlayers: 4 })
      const blindSpotPid = hellGame.connectPlayer({
        charClass: 'bar',
        name: 'HugDiablo',
        x: 52.5,
        y: 50,
        areaId: 108,
        hp: 5000,
        maxHp: 5000,
      })
      const midRangePid = hellGame.connectPlayer({
        charClass: 'sor',
        name: 'InHoseBeam',
        x: 59,
        y: 50,
        areaId: 108,
        hp: 5000,
        maxHp: 5000,
      })
      const hellDiabloId = hellGame.spawnMonster({
        defId: 'diablo',
        hcIdx: 243,
        classId: 243,
        x: 50,
        y: 50,
        areaId: 108,
        hp: 80000,
        maxHp: 80000,
      })
      const hellView = viewGame(hellGame)
      hellView.players.get(blindSpotPid)!.states.add(11)
      readyAi(hellView.monsters.get(hellDiabloId)!, 0)

      hellGame.stepFrames(12)
      expect(hellView.players.get(blindSpotPid)!.hp).toBe(5000)
      expect(hellView.players.get(midRangePid)!.hp).toBeLessThan(5000)
    })

    it('executes #195 32-bolt radial Fire Nova, #197 Firestorm, #188 PrimeFirewall, #194 Cold Touch, #198 Charge, and #349 Diablogeddon', () => {
      const game = new GameInstance({ seed: 182503, areaId: 108, difficulty: 1 })
      const pid = game.connectPlayer({
        charClass: 'pal',
        name: 'ChaosTester',
        x: 58,
        y: 50,
        areaId: 108,
        hp: 8000,
        maxHp: 8000,
      })
      const diabloId = game.spawnMonster({
        defId: 'diablo',
        hcIdx: 243,
        classId: 243,
        x: 50,
        y: 50,
        areaId: 108,
        hp: 40000,
        maxHp: 40000,
      })
      const v = viewGame(game)
      const diablo = v.monsters.get(diabloId)!
      const player = v.players.get(pid)!

      // Slot 1 -> #195 DiabFire (32 radial #176 bolts)
      readyAi(diablo, 1)
      game.drainEvents(pid)
      game.stepFrames(1)
      const novaEvents = game.drainEvents(pid)
      const fireNovaMissiles = novaEvents.filter(
        (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 176,
      )
      expect(fireNovaMissiles).toHaveLength(32)

      // Slot 2 -> #197 DiabWall (Firestorm #180 tongues)
      readyAi(diablo, 2)
      game.drainEvents(pid)
      game.stepFrames(1)
      const wallEvents = game.drainEvents(pid)
      expect(
        wallEvents.filter(
          (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 180,
        ).length,
      ).toBeGreaterThanOrEqual(3)

      // Slot 3 -> #188 PrimeFirewall (1.13c `SrvDo024` `0x6FC637D0`: 2 perpendicular #130 makers + 1 center #131 patch, #1999)
      readyAi(diablo, 3)
      game.drainEvents(pid)
      game.stepFrames(1)
      const fwEvents = game.drainEvents(pid)
      expect(
        fwEvents.filter(
          (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 130,
        ),
      ).toHaveLength(2)
      expect(
        fwEvents.filter(
          (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 131,
        ),
      ).toHaveLength(1)

      // Slot 5 at dist >= 6 -> #198 DiabRun charge + knockback
      player.x = 60
      player.y = 50
      diablo.x = 50
      diablo.y = 50
      readyAi(diablo, 5)
      const hpBeforeCharge = player.hp
      game.stepFrames(1)
      expect(diablo.x).toBeGreaterThan(56)
      expect(player.hp).toBeLessThan(hpBeforeCharge)

      // Close-range unchilled -> #194 DiabCold Magic damage + state 11 chill
      player.states.delete(11)
      player.x = diablo.x + 2
      player.y = diablo.y
      readyAi(diablo, 4)
      const hpBeforeCold = player.hp
      game.stepFrames(1)
      expect(player.states.has(11)).toBe(true)
      expect(player.hp).toBeLessThan(hpBeforeCold)

      // #705 Uber Diablo -> #349 Diablogeddon (state 144 + #674 meteor impacts)
      diablo.cooldown = 9999
      diablo.skillCooldown = 9999
      const uberId = game.spawnMonster({
        defId: 'uberdiablo',
        hcIdx: 705,
        classId: 705,
        x: 50,
        y: 62,
        areaId: 108,
        hp: 100000,
        maxHp: 100000,
      })
      readyAi(v.monsters.get(uberId)!, 0)
      game.drainEvents(pid)
      game.stepFrames(15)
      const uberEvents = game.drainEvents(pid)
      expect(v.monsters.get(uberId)!.states.has(144)).toBe(true)
      expect(
        uberEvents.some(
          (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 674,
        ),
      ).toBe(true)
    })

    it('#199 DiabPrison hermetically cages ranged players (0 XP/drops, blocks walk until broken) AND traps Chaos Sanctuary Town Portals (#59)', () => {
      const game = new GameInstance({ seed: 182504, areaId: 108, difficulty: 1 })
      const pid = game.connectPlayer({
        charClass: 'sor',
        name: 'Sorceress',
        x: 60,
        y: 50,
        areaId: 108,
        hp: 5000,
        maxHp: 5000,
        mana: 1000,
        maxMana: 1000,
      })
      const diabloId = game.spawnMonster({
        defId: 'diablo',
        hcIdx: 243,
        classId: 243,
        x: 50,
        y: 50,
        areaId: 108,
        hp: 40000,
        maxHp: 40000,
      })
      const v = viewGame(game)
      const diablo = v.monsters.get(diabloId)!
      const player = v.players.get(pid)!

      // 1) Slot 6 cages player at (60, 50) with 16 boneprison1..4 (#340..343) segments
      readyAi(diablo, 6)
      game.stepFrames(1)

      const prisonSegs = [...v.monsters.values()].filter(
        (m) => !m.dead && isBonePrisonMonsterHcIdx113c(m.hcIdx),
      )
      expect(prisonSegs).toHaveLength(16)
      for (const seg of prisonSegs) {
        expect(seg.experience).toBe(0)
      }

      // Freeze Diablo AI so we isolate player walk-collision against the 16-segment Bone Prison ring
      diablo.cooldown = 9999
      diablo.skillCooldown = 9999
      diablo.nextAiFrame = 99999
      game.enqueueCommand(pid, { type: 'Move', x: 75, y: 50, run: true })
      game.stepFrames(25)
      expect(Math.hypot(player.x - 60, player.y - 50)).toBeLessThan(2.5)

      // Destroy the Bone Prison segments -> 0 XP, 0 drops, and player now walks freely out to (75, 50)!
      const xpBefore = player.experience
      const groundBefore = v.groundItems.size
      for (const seg of prisonSegs) {
        game.applyDamageToMonster(seg.unitId, 999999, pid)
      }
      expect(player.experience).toBe(xpBefore)
      expect(v.groundItems.size).toBe(groundBefore)

      game.enqueueCommand(pid, { type: 'Move', x: 75, y: 50, run: true })
      game.stepFrames(25)
      expect(Math.hypot(player.x - 60, player.y - 50)).toBeGreaterThan(6)

      // 2) Active Town Portal (classId = 59) in Chaos Sanctuary (areaId = 108) is automatically caged!
      player.x = 60
      player.y = 50
      const tpObjId = game.spawnObject({ classId: 59, x: 42, y: 50, areaId: 108 })
      expect(tpObjId).toBeGreaterThan(0)
      readyAi(diablo, 0)
      game.stepFrames(1)

      const tpPrisonSegs = [...v.monsters.values()].filter(
        (m) =>
          !m.dead &&
          isBonePrisonMonsterHcIdx113c(m.hcIdx) &&
          Math.hypot(m.x - 42, m.y - 50) <= 4.0,
      )
      expect(tpPrisonSegs).toHaveLength(16)
    })
  })

  describe('Issue #1826: Baal (#544 baalcrab, #570 baalclone, #709 uberbaal) 1.13c AI, Vile Effigy & Skills', () => {
    it('#570 baalclone takes exact 2x damage vs real Baal, never spawns sub-clones/tentacles, yields 0 XP/drops/a5q6, and despawns with tentacles when real Baal dies', () => {
      // Pure AI selector check: hcIdx 570 never selects vileeffigy or festeringappendages
      const fakeCloneUnit = {
        index: 1,
        hcIdx: 570,
        id: 'baalclone',
        ai: 'BaalCrabClone',
        x: 50,
        y: 50,
        hp: 10000,
        maxHp: 10000,
      }
      for (let r = 0; r < 12; r++) {
        const clonePick = executeActBossAi113c(
          fakeCloneUnit as never,
          { x: 60, y: 50 } as never,
          { tick: r * 15, difficulty: 'hell' } as never,
        )
        expect(clonePick?.skillId).not.toBe('vileeffigy')
        expect(clonePick?.skillId).not.toBe('festeringappendages')
      }

      const game = new GameInstance({ seed: 182601, areaId: 132, difficulty: 2 })
      const pid = game.connectPlayer({
        charClass: 'sor',
        name: 'Matriarch',
        x: 58,
        y: 50,
        areaId: 132,
        hp: 50000,
        maxHp: 50000,
      })
      const baalId = game.spawnMonster({
        defId: 'baalcrab',
        hcIdx: 544,
        classId: 544,
        x: 50,
        y: 50,
        areaId: 132,
        hp: 60000,
        maxHp: 60000,
        resistances: { phys: 50, magic: 0, fire: 50, light: 50, cold: 50, poison: 50 },
      })
      const v = viewGame(game)
      const baal = v.monsters.get(baalId)!
      const player = v.players.get(pid)!

      // Slot 0 -> spawns #570 baalclone (Vile Effigy)
      readyAi(baal, 0)
      game.stepFrames(1)

      const cloneId = baal.activeBaalCloneUnitId
      expect(cloneId).toBeGreaterThan(0)
      const clone = v.monsters.get(cloneId)!
      expect(clone).toBeDefined()
      expect(clone.hcIdx).toBe(570)
      expect(clone.experience).toBe(0)

      // Exact 2x incoming damage check across resistances (50% phys on Baal -> 0% on Clone; 0% magic on Baal -> -100% on Clone)
      const baalHp0 = baal.hp
      const cloneHp0 = clone.hp
      game.applyDamageToMonster(baalId, 1000, pid, undefined, 'phys')
      game.applyDamageToMonster(cloneId, 1000, pid, undefined, 'phys')
      const baalPhysLost = baalHp0 - baal.hp
      const clonePhysLost = cloneHp0 - clone.hp
      expect(baalPhysLost).toBe(500)
      expect(clonePhysLost).toBe(1000)
      expect(clonePhysLost).toBe(baalPhysLost * 2)

      const baalHp1 = baal.hp
      const cloneHp1 = clone.hp
      game.applyDamageToMonster(baalId, 600, pid, undefined, 'mag')
      game.applyDamageToMonster(cloneId, 600, pid, undefined, 'mag')
      expect(cloneHp1 - clone.hp).toBe((baalHp1 - baal.hp) * 2)

      // Stepping Clone through all 6 skillCursor slots never spawns a second clone or tentacles
      baal.cooldown = 9999
      baal.skillCooldown = 9999
      baal.nextAiFrame = 99999
      for (let slot = 0; slot < 6; slot++) {
        readyAi(clone, slot)
        game.stepFrames(1)
      }
      expect([...v.monsters.values()].filter((m) => !m.dead && m.hcIdx === 570)).toHaveLength(1)
      expect(
        [...v.monsters.values()].filter((m) => !m.dead && isBaalTentacleHcIdx113c(m.hcIdx)),
      ).toHaveLength(0)

      // Killing #570 baalclone yields 0 XP, 0 drops, and NEVER completes a5q6 or spawns Tyrael (#521)
      const xpBeforeCloneKill = player.experience
      const groundBeforeCloneKill = v.groundItems.size
      game.applyDamageToMonster(cloneId, 999999, pid)
      game.stepFrames(2)
      expect(player.experience).toBe(xpBeforeCloneKill)
      expect(v.groundItems.size).toBe(groundBeforeCloneKill)
      expect(player.questFlags[questWordIndex113c('a5q6')!]! & QUEST_FLAG_COMPLETED_113C).toBe(0)
      expect([...v.monsters.values()].some((m) => m.hcIdx === 521)).toBe(false)

      // Spawn 2nd clone + Festering Appendages tentacles on real Baal, then kill real Baal -> immediate despawn + a5q6 completed!
      readyAi(baal, 0)
      game.stepFrames(1)
      const secondCloneId = baal.activeBaalCloneUnitId
      expect(secondCloneId).toBeGreaterThan(0)

      readyAi(baal, 1)
      game.stepFrames(1)
      const tentaclesBeforeKill = [...v.monsters.values()].filter(
        (m) => !m.dead && isBaalTentacleHcIdx113c(m.hcIdx),
      )
      expect(tentaclesBeforeKill.length).toBeGreaterThanOrEqual(4)

      game.applyDamageToMonster(baalId, 9_999_999, pid)
      game.stepFrames(1)
      expect(v.monsters.has(secondCloneId)).toBe(false)
      expect(
        [...v.monsters.values()].filter((m) => isBaalTentacleHcIdx113c(m.hcIdx)),
      ).toHaveLength(0)
      expect(player.questFlags[questWordIndex113c('a5q6')!]! & QUEST_FLAG_COMPLETED_113C).toBe(
        QUEST_FLAG_COMPLETED_113C,
      )
    })

    it('executes stationary Tentacles (#315), Defense Curse (#309) vs Blood Mana (#310), Hoarfrost (#318), Mana Rift 50% Mana drain (#317), closing Teleport (#329), and 32-bolt Nova (#316)', () => {
      expect(MONAI_PROFILES_113C.baaltentacle?.family).toBe('stationary')
      expect(monaiProfile113c('BaalTentacle').family).toBe('stationary')
      expect(STATIONARY_AI_SET.has('BaalTentacle')).toBe(true)

      const game = new GameInstance({ seed: 182602, areaId: 132, difficulty: 1 })
      const tankPid = game.connectPlayer({
        charClass: 'bar',
        name: 'HighLifeBarb',
        x: 56,
        y: 50,
        areaId: 132,
        hp: 5000,
        maxHp: 5000,
        mana: 400,
        maxMana: 400,
      })
      const baalId = game.spawnMonster({
        defId: 'baalcrab',
        hcIdx: 544,
        classId: 544,
        x: 50,
        y: 50,
        areaId: 132,
        hp: 50000,
        maxHp: 50000,
      })
      const v = viewGame(game)
      const baal = v.monsters.get(baalId)!
      const tank = v.players.get(tankPid)!

      // 1) Slot 1 -> #315 Baal Tentacle: stationary (#562..566) rooted at spawn (x, y) while whipping player
      readyAi(baal, 1)
      game.stepFrames(1)
      const tentacles = [...v.monsters.values()].filter((m) => isBaalTentacleHcIdx113c(m.hcIdx))
      expect(tentacles.length).toBeGreaterThanOrEqual(3)
      const initialCoords = tentacles.map((t) => ({ id: t.unitId, x: t.x, y: t.y }))
      baal.cooldown = 9999
      baal.skillCooldown = 9999
      baal.nextAiFrame = 99999
      game.stepFrames(16)
      for (const init of initialCoords) {
        const cur = v.monsters.get(init.id)!
        expect(cur.x).toBe(init.x)
        expect(cur.y).toBe(init.y)
      }
      for (const t of tentacles) {
        game.applyDamageToMonster(t.unitId, 999999, tankPid)
      }

      // 2) Slot 2 -> #309 Defense Curse (state 113) when maxHp > maxMana, vs #310 Blood Mana (state 114) when maxMana >= maxHp
      readyAi(baal, 2)
      game.stepFrames(1)
      expect(tank.states.has(113)).toBe(true)
      expect(tank.states.has(114)).toBe(false)

      tank.states.clear()
      tank.maxMana = 6000
      tank.mana = 6000
      tank.maxManaFixed = 6000 * 256
      tank.manaFixed = 6000 * 256
      readyAi(baal, 2)
      game.stepFrames(1)
      expect(tank.states.has(114)).toBe(true)
      tank.states.clear()

      // 3) Slot 3 -> #318 Hoarfrost V-wedge (#589 center + #590 lateral waves + Cold damage + state 11 chill)
      tank.x = 56
      tank.y = 50
      const hpBeforeFrost = tank.hp
      readyAi(baal, 3)
      game.drainEvents(tankPid)
      game.stepFrames(8)
      const frostEvents = game.drainEvents(tankPid)
      expect(
        frostEvents.some(
          (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 589,
        ),
      ).toBe(true)
      expect(
        frostEvents.some(
          (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 590,
        ),
      ).toBe(true)
      expect(tank.states.has(11)).toBe(true)
      expect(tank.hp).toBeLessThan(hpBeforeFrost)

      // 4) Slot 4 -> #317 Baal Inferno (Mana Rift): Magic damage + drains 50% current Mana per hit!
      tank.x = 56
      tank.y = 50
      tank.maxMana = 400
      tank.maxManaFixed = 400 * 256
      tank.mana = 400
      tank.manaFixed = 400 * 256
      readyAi(baal, 4)
      game.stepFrames(3)
      expect(tank.mana).toBeLessThanOrEqual(201)
      expect(tank.mana).toBeGreaterThanOrEqual(199)
      baal.activeBossChannel = undefined

      // 5) Slot 5 at dist = 14 (>= 8) -> #329 Baal Teleport CLOSES distance toward player!
      tank.x = 64
      tank.y = 50
      baal.x = 50
      baal.y = 50
      readyAi(baal, 5)
      game.stepFrames(1)
      expect(Math.hypot(tank.x - baal.x, tank.y - baal.y)).toBeLessThan(6)

      // 6) Slot 5 at dist < 8 -> falls through to #316 Baal Nova (32 radial #555 bolts)
      baal.x = 50
      baal.y = 50
      tank.x = 55
      tank.y = 50
      readyAi(baal, 5)
      game.drainEvents(tankPid)
      game.stepFrames(1)
      const novaEvents = game.drainEvents(tankPid)
      expect(
        novaEvents.filter(
          (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 555,
        ),
      ).toHaveLength(32)
    })
  })

  describe('Issue #1827: Ancients (#540..542) & 734-Row Non-Missile Monster Skill Class Sweep', () => {
    it('resolves Ancient / AncientsWhirl / BaalClone / Hydra MONAI profiles while preserving exact 148 canonical keys', () => {
      expect(Object.keys(MONAI_PROFILES_113C)).toHaveLength(148)
      expect(monaiProfile113c('Ancient').boss).toBe(true)
      expect(monaiProfile113c('AncientsWhirl').boss).toBe(true)
      expect(monaiProfile113c('BaalClone').boss).toBe(true)
      expect(monaiProfile113c('Hydra')).toMatchObject({ family: 'stationary', ranged: true })
      expect(STATIONARY_AI_SET.has('Hydra')).toBe(true)
    })

    it('executes Talic #151 Whirlwind spin-through, Madawc #138 Shout (+140% AC) + #140 Double Throw (#525), and Korlic #143 Leap Attack', () => {
      const game = new GameInstance({ seed: 182701, areaId: 120, difficulty: 1 })
      const pid = game.connectPlayer({
        charClass: 'bar',
        name: 'ArreatChallenger',
        x: 60,
        y: 50,
        areaId: 120,
        hp: 9000,
        maxHp: 9000,
      })
      const talicId = game.spawnMonster({
        defId: 'ancientbarb1',
        hcIdx: 540,
        classId: 540,
        x: 54,
        y: 50,
        areaId: 120,
        hp: 15000,
        maxHp: 15000,
        ac: 500,
        minDmg: 40,
        maxDmg: 60,
      })
      const madawcId = game.spawnMonster({
        defId: 'ancientbarb2',
        hcIdx: 541,
        classId: 541,
        x: 50,
        y: 50,
        areaId: 120,
        hp: 15000,
        maxHp: 15000,
        ac: 400,
        minDmg: 35,
        maxDmg: 55,
      })
      const korlicId = game.spawnMonster({
        defId: 'ancientbarb3',
        hcIdx: 542,
        classId: 542,
        x: 50,
        y: 58,
        areaId: 120,
        hp: 15000,
        maxHp: 15000,
        ac: 450,
        minDmg: 50,
        maxDmg: 75,
      })
      const v = viewGame(game)
      const talic = v.monsters.get(talicId)!
      const madawc = v.monsters.get(madawcId)!
      const korlic = v.monsters.get(korlicId)!
      const player = v.players.get(pid)!

      readyAi(talic)
      readyAi(madawc)
      readyAi(korlic)
      game.drainEvents(pid)
      game.stepFrames(18)
      const events = game.drainEvents(pid)

      // 1) Madawc cast #138 Shout -> state 26 & +140% Defense (2.4x) on ALL 3 Ancients, then #140 Double Throw (2x #525 axes)!
      expect(talic.states.has(26)).toBe(true)
      expect(madawc.states.has(26)).toBe(true)
      expect(korlic.states.has(26)).toBe(true)
      expect(talic.ac).toBe(Math.round(500 * 2.4))
      expect(madawc.ac).toBe(Math.round(400 * 2.4))
      expect(korlic.ac).toBe(Math.round(450 * 2.4))
      expect(
        events.filter(
          (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 525,
        ).length,
      ).toBeGreaterThanOrEqual(2)

      // 2) Talic cast #151 Whirlwind and spun straight past x = 60!
      expect(
        events.some(
          (e) => e.type === 'SkillCast' && (e as { skillId?: number }).skillId === 151,
        ),
      ).toBe(true)
      expect(talic.x).toBeGreaterThan(60)

      // 3) Korlic cast #143 Leap Attack, leaping across the arena onto the player and dealing heavy physical damage!
      expect(
        events.some(
          (e) => e.type === 'SkillCast' && (e as { skillId?: number }).skillId === 143,
        ),
      ).toBe(true)
      expect(Math.hypot(korlic.x - 60, korlic.y - 50)).toBeLessThan(4.5)
      expect(player.hp).toBeLessThan(8700)
    })

    it('wires Duriel #10 Jab / #97 Smite / #107 Charge, Council #62 Hydra -> #337, Nihlathak #351 CE (10..20% base HP + state 104) & #330 Blink, and Blood Raven #167 Nest', () => {
      // 1) Duriel (#211): Charge (#107) at range, then Jab (#10) & Smite (#97 -> state 21 stun) in melee
      const durielGame = new GameInstance({ seed: 182702, areaId: 73, difficulty: 1 })
      const dPid = durielGame.connectPlayer({
        charClass: 'pal',
        name: 'TombRaider',
        x: 59,
        y: 50,
        areaId: 73,
        hp: 6000,
        maxHp: 6000,
      })
      const durielId = durielGame.spawnMonster({
        defId: 'duriel',
        hcIdx: 211,
        classId: 211,
        x: 50,
        y: 50,
        areaId: 73,
        hp: 30000,
        maxHp: 30000,
      })
      const dView = viewGame(durielGame)
      const duriel = dView.monsters.get(durielId)!
      const dPlayer = dView.players.get(dPid)!
      durielGame.drainEvents(dPid)
      // At dist = 9 (> MonAi Duriel charge maxDistance 5 -> reaches #107 Charge skill!)
      readyAi(duriel, 0)
      durielGame.stepFrames(1)
      expect(duriel.x).toBeGreaterThan(55)

      // Test Jab (#10, slot index 1) & Smite (#97, slot index 2 -> stun state 21) in melee
      dPlayer.x = duriel.x + 2
      dPlayer.y = duriel.y
      readyAi(duriel, 1)
      durielGame.stepFrames(1)

      dPlayer.x = duriel.x + 2
      dPlayer.y = duriel.y
      readyAi(duriel, 2)
      durielGame.stepFrames(1)

      const dEvents = durielGame.drainEvents(dPid)
      expect(
        dEvents.some((e) => e.type === 'SkillCast' && (e as { skillId?: number }).skillId === 107),
      ).toBe(true)
      expect(
        dEvents.some((e) => e.type === 'SkillCast' && (e as { skillId?: number }).skillId === 10),
      ).toBe(true)
      expect(
        dEvents.some((e) => e.type === 'SkillCast' && (e as { skillId?: number }).skillId === 97),
      ).toBe(true)
      expect(dPlayer.states.has(21)).toBe(true)

      // 2) Council Member (#345): casts #62 Hydra -> spawns 0-XP stationary hydra1 (#351) firing #337 -> #247 hydra firebolts
      const councilGame = new GameInstance({ seed: 182703, areaId: 83, difficulty: 1 })
      const cPid = councilGame.connectPlayer({
        charClass: 'sor',
        name: 'TravincalRunner',
        x: 58,
        y: 50,
        areaId: 83,
        hp: 5000,
        maxHp: 5000,
      })
      councilGame.spawnMonster({
        defId: 'councilmember1',
        hcIdx: 345,
        classId: 345,
        x: 50,
        y: 50,
        areaId: 83,
        hp: 5000,
        maxHp: 5000,
      })
      const cView = viewGame(councilGame)
      councilGame.drainEvents(cPid)
      councilGame.stepFrames(8)
      const cEvents = councilGame.drainEvents(cPid)
      const hydras = [...cView.monsters.values()].filter((m) => m.hcIdx === 351)
      expect(hydras).toHaveLength(1)
      expect(hydras[0]!.experience).toBe(0)
      expect(
        cEvents.some(
          (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 247,
        ),
      ).toBe(true)

      // 3) Nihlathak (#526): #351 NihlathakCorpseExplosion uses 10..20% UNMULTIPLIED base corpse HP + sets state 104,
      // and #330 Imp Teleport blinks away when player closes within <= 6 sub-tiles!
      const nihGame = new GameInstance({ seed: 182704, areaId: 124, difficulty: 2 })
      const nPid = nihGame.connectPlayer({
        charClass: 'nec',
        name: 'KeyRunner',
        x: 60,
        y: 50,
        areaId: 124,
        hp: 4000,
        maxHp: 4000,
      })
      // Spawn an elite corpse with unscaled base HP = 1000, inflated unique HP = 20000
      const corpseId = nihGame.spawnMonster({
        defId: 'fallen1',
        x: 59,
        y: 50,
        areaId: 124,
        hp: 1000,
        maxHp: 1000,
      })
      nihGame.applyDamageToMonster(corpseId, 99999, nPid)
      const nView = viewGame(nihGame)
      const corpse = nView.monsters.get(corpseId)!
      corpse.unscaledMaxHp = 1000
      corpse.baseMaxHp = 1000
      corpse.maxHp = 20000

      const nihId = nihGame.spawnMonster({
        defId: 'nihlathakboss',
        hcIdx: 526,
        classId: 526,
        x: 50,
        y: 50,
        areaId: 124,
        hp: 25000,
        maxHp: 25000,
      })
      const nih = nView.monsters.get(nihId)!
      const nPlayer = nView.players.get(nPid)!
      readyAi(nih, 0)
      nihGame.stepFrames(1)

      // 10..20% of 1000 base HP = 100..200 damage (NEVER 2000..4000 from 20000 unique HP!), and corpse has state 104!
      const ceDamageTaken = 4000 - nPlayer.hp
      expect(ceDamageTaken).toBeGreaterThanOrEqual(100)
      expect(ceDamageTaken).toBeLessThanOrEqual(210)
      expect(corpse.states.has(104)).toBe(true)
      expect(corpse.shattered).toBe(true)

      // Close into <= 6 sub-tiles -> Nihlathak casts #330 Imp Teleport escape blink!
      nPlayer.x = 53
      nPlayer.y = 50
      readyAi(nih, 1)
      nihGame.stepFrames(1)
      expect(Math.hypot(nih.x - 53, nih.y - 50)).toBeGreaterThan(7)

      // 4) Blood Raven (#267): casts #167 Nest -> spawns 0-XP zombie2 (#6 Hungry Dead)
      const brGame = new GameInstance({ seed: 182705, areaId: 17, difficulty: 0 })
      brGame.connectPlayer({
        charClass: 'dru',
        name: 'BurialHunter',
        x: 58,
        y: 50,
        areaId: 17,
        hp: 2000,
        maxHp: 2000,
      })
      const brId = brGame.spawnMonster({
        defId: 'bloodraven',
        hcIdx: 267,
        classId: 267,
        x: 50,
        y: 50,
        areaId: 17,
        hp: 2000,
        maxHp: 2000,
      })
      readyAi(viewGame(brGame).monsters.get(brId)!, 0)
      brGame.stepFrames(1)
      const zombies = [...viewGame(brGame).monsters.values()].filter(
        (m) => m.hcIdx === 6 && m.defId === 'zombie2',
      )
      expect(zombies).toHaveLength(1)
      expect(zombies[0]!.experience).toBe(0)
    })
  })
})
