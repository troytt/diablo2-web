/**
 * P1 Wave 4 — 1.13c Monster AI, MonProp, MonEquip & Progression Parity Suite
 *
 * Covers all 11 P1 issues:
 * - #1891: Blood Raven (`#267`) & Greater Mummy (`#101..105`, `#229`) corpse resurrection (`#327` / `#183` / `#190`) + `0` repeat XP
 * - #1892: `monai-113c.ts` monster class IDs & stationary/spawner/charge AI (`MaggotEgg`, `Sarcophagus`, `VileMother`, `ArcaneTower`, `DesertTurret`, `ClawViperEx`)
 * - #1893: Act 5 `BaalThrone` (`#543`) `#285 Baal Corpse Explode` `40%` single-player corpse base HP (`50%` phys + `50%` fire) AoE damage
 * - #1894: Act 5 `Overseer` `#295` Whip (`35%` transform `minion1..8` -> `suicideminion1..8`), `PutridDefiler` `#300 Impregnate` (`painworm`), `Imp` `#330` SiegeBeast mount
 * - #1895: Non-missile monster skills (`SandMaggot` burrow/surface/egg-lay `#161..163`, `Regurgitator` `#214` Corpse Eat + `#213` Spit, `BloodLord` `#328` Frenzy)
 * - #1896: Monster healers (`ZakarumPriest`, `HighPriest`, `GreaterMummy`, `OblivionKnight`) `#179 ZakarumHeal` / `#182 Bestow` + PMH `state 52` check
 * - #1897: `MonProp.txt` innate monster & Revive pet properties (`blunderbore` Crushing Blow, Council `extra-fire`, Mephisto IAS/FCR, Blood Raven Knockback, `quillrat6..8` Thorns) + `El1Type = 'mana'` Ghost drain
 * - #1898: `MonEquip.txt` world monster (`bloodraven`, `flyingscimitar` + death `scm` drop) & pet (`Valkyrie`, `Shadow Warrior`, `Shadow Master`, `Raise Skeleton` 5% shield) loadouts
 * - #1921: Pre-`MonLvl.txt` `+2` Champion / `+3` Unique & Minion `mlvl` boost, `3x` / `5x` XP multipliers, and `xfer=1` boss modifier transfer to minions
 * - #1922: Unique boss pack `minion1`/`minion2` species, `+difficulty` (`+0/+1/+2`) minion count bonus, and normal pack `partyMin..partyMax` companions
 * - #1923: Multiplayer monster scaling (`N = 1..8`): `+(N - 1) * 50%` HP & XP and `+(N - 1) * 6.25%` (`(15 + N) / 16`) AR & damage
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { Rng } from '../../src/common/rng/d2-rng.ts'
import {
  MONAI_PROFILES_113C,
  monaiProfile113c,
} from '../../src/common/units/monai-113c.ts'
import {
  MONAI_113C_ROWS,
  MONLVL_113C_ROWS,
  MONSTATS_113C_ROWS,
} from '../../src/common/units/monstats-113c-data.ts'
import {
  filterTransferableEliteModifiers113c,
  getCanonicalMonsterKinds,
  getMonsterKindByHcIdx,
  planMonsterGroups,
  resolveMonsterStats,
  rollEliteGroup,
} from '../../src/common/units/monsters-data.ts'
import { getLevelMonsterPlan113c } from '../../src/common/world/level-monster-plans.ts'
import {
  computeSummonMonEquipIlvl113c,
  rollMonsterOrPetLoadout113c,
} from '../../src/server/ai/monequip-helper-113c.ts'
import {
  MON_PROP_ROWS_113C,
  resolveMonsterMonProps113c,
} from '../../src/server/ai/monprop-113c.ts'
import {
  planLevelPopulation113c,
  planRoomPopulation113c,
} from '../../src/server/ai/room-streamer.ts'
import { SummonManager } from '../../src/server/ai/summon-manager.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'

interface TestMonsterView {
  unitId: number
  hcIdx: number
  classId: number
  defId: string
  ai: string
  rank: string
  level: number
  x: number
  y: number
  areaId: number
  hp: number
  maxHp: number
  baseMaxHp: number
  unscaledMaxHp: number
  minDmg: number
  maxDmg: number
  baseMinDmg: number
  baseMaxDmg: number
  ar: number
  baseAr: number
  ac: number
  experience: number
  baseXp: number
  dead: boolean
  shattered: boolean
  submerged: boolean
  submergeAiState: number
  submergeTimerFrame: number
  spawnedChildren: number
  corpseAmmo: number
  wormsOnDeath: boolean
  mountedOnUnitId?: number
  mountedImpUnitId?: number
  frenzySpeedPct: number
  frenzyUntilFrame: number
  cooldown: number
  skillCooldown: number
  cooldownTicks: number
  alreadyGrantedKillRewards: boolean
  umodIds: number[]
  states: Set<number>
  monProps: {
    crushingBlowPct: number
    knockback: boolean
    extraFirePct: number
    iasPct: number
    fcrPct: number
    thornsFlat: number
    fadeLevel: number
    blindTarget: number
  }
  monEquipLoadout?: {
    primaryWeaponCode?: string
    equippedSpecs: readonly { itemCode: string; quality: string }[]
    weaponMinDamage: number
    weaponMaxDamage: number
  }
}

interface TestPlayerView {
  unitId: number
  x: number
  y: number
  areaId: number
  hp: number
  maxHp: number
  hpFixed: number
  maxHpFixed: number
  mana: number
  maxMana: number
  manaFixed: number
  maxManaFixed: number
  experience: number
  states: Set<number>
}

function getMonstersMap(game: GameInstance): Map<number, TestMonsterView> {
  return (game as unknown as { monsters: Map<number, TestMonsterView> }).monsters
}

function getPlayersMap(game: GameInstance): Map<number, TestPlayerView> {
  return (game as unknown as { players: Map<number, TestPlayerView> }).players
}

function getGroundItemsMap(
  game: GameInstance,
): Map<number, { unitId: number; code: string; x: number; y: number; areaId: number }> {
  return (
    game as unknown as {
      groundItems: Map<number, { unitId: number; code: string; x: number; y: number; areaId: number }>
    }
  ).groundItems
}

describe('P1 Wave 4 Monster AI, MonProp, MonEquip & Progression (#1891-#1898, #1921-#1923)', () => {
  describe('#1891: Blood Raven & Greater Mummy corpse resurrection & zero repeat XP', () => {
    it('lets Blood Raven (#267) resurrect cemetery zombie corpses with 0 XP and summon Hungry Dead (#6) when no corpse exists', () => {
      const game = new GameInstance({ seed: 189101, areaId: 17 })
      const playerId = game.connectPlayer({
        charClass: 'ama',
        name: 'Hero',
        x: 20,
        y: 20,
        areaId: 17,
        hp: 2000,
        maxHp: 2000,
      })
      const ravenId = game.spawnMonster({
        hcIdx: 267,
        defId: 'bloodraven',
        x: 30,
        y: 20,
        areaId: 17,
      })
      const corpseId = game.spawnMonster({
        hcIdx: 1,
        defId: 'zombie1',
        x: 32,
        y: 20,
        areaId: 17,
      })
      const monsters = getMonstersMap(game)
      const corpse = monsters.get(corpseId)!
      corpse.dead = true
      corpse.hp = 0

      for (let i = 0; i < 60 && corpse.dead; i += 1) {
        monsters.get(ravenId)!.cooldown = 0
        monsters.get(ravenId)!.skillCooldown = 0
        game.stepFrames(1)
      }
      expect(corpse.dead).toBe(false)
      expect(corpse.hp).toBe(corpse.maxHp)
      expect(corpse.experience).toBe(0)
      expect(corpse.baseXp).toBe(0)
      expect(corpse.alreadyGrantedKillRewards).toBe(true)

      // Kill the revived zombie again -> grants 0 repeat XP!
      const xpBefore = getPlayersMap(game).get(playerId)!.experience
      ;(
        game as unknown as {
          applyDamageToMonster: (
            p: TestPlayerView,
            m: TestMonsterView,
            dmg: number,
            skillId: number,
            elem: 'phys',
          ) => boolean
        }
      ).applyDamageToMonster(getPlayersMap(game).get(playerId)!, corpse, 99999, 0, 'phys')
      expect(corpse.dead).toBe(true)
      expect(getPlayersMap(game).get(playerId)!.experience).toBe(xpBefore)

      // Shatter corpse so no cemetery corpse remains -> Blood Raven summons Hungry Dead (`zombie2`, hcIdx 6)
      corpse.shattered = true
      for (let i = 0; i < 80; i += 1) {
        monsters.get(ravenId)!.cooldown = 0
        monsters.get(ravenId)!.skillCooldown = 0
        game.stepFrames(1)
        const hungryDead = [...monsters.values()].find((m) => m.hcIdx === 6)
        if (hungryDead) {
          expect(hungryDead.defId).toBe('zombie2')
          expect(hungryDead.experience).toBe(0)
          expect(hungryDead.alreadyGrantedKillRewards).toBe(true)
          break
        }
      }
      expect([...monsters.values()].some((m) => m.hcIdx === 6)).toBe(true)
    })

    it('lets Greater Mummy (unraveler1, #101) resurrect undead corpses (#327 Resurrect2) while refusing other Greater Mummies', () => {
      const game = new GameInstance({ seed: 189102, areaId: 66 })
      game.connectPlayer({
        charClass: 'pal',
        name: 'Templar',
        x: 10,
        y: 10,
        areaId: 66,
        hp: 2000,
        maxHp: 2000,
      })
      const mummyId = game.spawnMonster({
        hcIdx: 101,
        defId: 'unraveler1',
        x: 20,
        y: 10,
        areaId: 66,
      })
      const deadOtherMummyId = game.spawnMonster({
        hcIdx: 102,
        defId: 'unraveler2',
        x: 21,
        y: 10,
        areaId: 66,
      })
      const deadSkelId = game.spawnMonster({
        hcIdx: 11,
        defId: 'skeleton1',
        x: 22,
        y: 10,
        areaId: 66,
      })
      const monsters = getMonstersMap(game)
      monsters.get(deadOtherMummyId)!.dead = true
      monsters.get(deadOtherMummyId)!.hp = 0
      monsters.get(deadSkelId)!.dead = true
      monsters.get(deadSkelId)!.hp = 0

      for (let i = 0; i < 120 && monsters.get(deadSkelId)!.dead; i += 1) {
        monsters.get(mummyId)!.cooldown = 0
        monsters.get(mummyId)!.skillCooldown = 0
        game.stepFrames(1)
      }

      expect(monsters.get(deadSkelId)!.dead).toBe(false)
      expect(monsters.get(deadSkelId)!.experience).toBe(0)
      expect(monsters.get(deadSkelId)!.alreadyGrantedKillRewards).toBe(true)
      // Must NEVER resurrect another Greater Mummy!
      expect(monsters.get(deadOtherMummyId)!.dead).toBe(true)
    })
  })

  describe('#1892: monai-113c.ts monster class IDs, hatching/spawners, stationary turrets & ClawViper Charge', () => {
    it('verifies 100% of MONAI_PROFILES_113C AI names and child monster IDs exist in 1.13c MonAi.txt / MonStats.txt', () => {
      const validAiNames = new Set(MONAI_113C_ROWS.map((r) => r.ai))
      const validMonIds = new Set(MONSTATS_113C_ROWS.map((r) => r.id.toLowerCase()))
      expect(validMonIds.has('viledog1')).toBe(false)

      for (const profile of Object.values(MONAI_PROFILES_113C)) {
        expect(validAiNames.has(profile.name), `Unknown AI ${profile.name}`).toBe(true)
        if (profile.spawn !== undefined) {
          expect(
            validMonIds.has(profile.spawn.child.toLowerCase()),
            `${profile.name} spawn.child '${profile.spawn.child}' missing from MonStats.txt`,
          ).toBe(true)
        }
      }
      expect(monaiProfile113c('ArcaneTower').family).toBe('stationary')
      expect(monaiProfile113c('ArcaneTower').ranged).toBe(true)
      expect(monaiProfile113c('DesertTurret').family).toBe('stationary')
      expect(monaiProfile113c('DesertTurret').ranged).toBe(true)
      expect(monaiProfile113c('VileMother').spawn?.child).toBe('vilechild1')
      expect(monaiProfile113c('Sarcophagus').spawn?.child).toBe('mummy1')
    })

    it('hatches MaggotEgg (#190 -> maggotbaby1 #180), spawns Sarcophagus (#228 -> mummy1), keeps ArcaneTower (#371) stationary, and executes Tomb Viper (#597) Charge', () => {
      // 1. MaggotEgg hatching (`aip1 = 250` frames in Normal)
      const eggGame = new GameInstance({ seed: 189201, areaId: 62 })
      eggGame.connectPlayer({ charClass: 'bar', name: 'Hero', x: 10, y: 10, areaId: 62 })
      const eggId = eggGame.spawnMonster({ hcIdx: 190, defId: 'maggotegg1', x: 14, y: 10, areaId: 62 })
      eggGame.stepFrames(280)
      const eggMonsters = getMonstersMap(eggGame)
      expect(eggMonsters.get(eggId)!.dead).toBe(true)
      expect(eggMonsters.get(eggId)!.shattered).toBe(true)
      const hatched = [...eggMonsters.values()].filter((m) => m.hcIdx === 180)
      expect(hatched.length).toBeGreaterThan(0)
      expect(hatched[0]!.defId).toBe('maggotbaby1')
      expect(hatched[0]!.experience).toBe(0)

      // 2. Sarcophagus spawning mummy1 while remaining stationary
      const sarcGame = new GameInstance({ seed: 189202, areaId: 60 })
      sarcGame.connectPlayer({ charClass: 'bar', name: 'Hero', x: 10, y: 10, areaId: 60 })
      const sarcId = sarcGame.spawnMonster({ hcIdx: 228, defId: 'sarcophagus', x: 16, y: 10, areaId: 60 })
      sarcGame.stepFrames(160)
      const sarcMonsters = getMonstersMap(sarcGame)
      expect(sarcMonsters.get(sarcId)!.x).toBe(16)
      expect(sarcMonsters.get(sarcId)!.y).toBe(10)
      expect([...sarcMonsters.values()].some((m) => m.defId === 'mummy1')).toBe(true)

      // 3. ArcaneTower (`lightningspire` hcIdx 371) stays stationary and fires lightning
      const spireGame = new GameInstance({ seed: 189203, areaId: 74 })
      const spirePlayer = spireGame.connectPlayer({
        charClass: 'sor',
        name: 'Caster',
        x: 10,
        y: 10,
        areaId: 74,
        hp: 2000,
        maxHp: 2000,
      })
      const spireId = spireGame.spawnMonster({
        hcIdx: 371,
        defId: 'lightningspire',
        x: 18,
        y: 10,
        areaId: 74,
      })
      spireGame.drainEvents(spirePlayer)
      spireGame.stepFrames(50)
      const spire = getMonstersMap(spireGame).get(spireId)!
      expect(spire.x).toBe(18)
      expect(spire.y).toBe(10)
      const spireEvents = spireGame.drainEvents(spirePlayer)
      expect(spireEvents.some((e) => e.type === 'CreateMissile')).toBe(true)

      // 4. ClawViperEx (`clawviper9` Tomb Viper hcIdx 597) charges at player (`#107 Charge`)
      const viperGame = new GameInstance({ seed: 189204, areaId: 123 })
      const viperPlayer = viperGame.connectPlayer({
        charClass: 'bar',
        name: 'Target',
        x: 10,
        y: 10,
        areaId: 123,
        hp: 5000,
        maxHp: 5000,
      })
      const viperId = viperGame.spawnMonster({
        hcIdx: 597,
        defId: 'clawviper9',
        x: 17,
        y: 10,
        areaId: 123,
      })
      viperGame.drainEvents(viperPlayer)
      for (let i = 0; i < 30; i += 1) {
        viperGame.stepFrames(1)
      }
      const viper = getMonstersMap(viperGame).get(viperId)!
      expect(viper.x).toBeLessThan(15)
    })
  })

  describe('#1893: Act 5 BaalThrone (#543) #285 Baal Corpse Explode AoE damage', () => {
    it('consumes nearby monster corpses AND deals 40% single-player corpse base HP (50% phys + 50% fire) AoE damage', () => {
      const game = new GameInstance({ seed: 189301, areaId: 131 })
      const playerId = game.connectPlayer({
        charClass: 'bar',
        name: 'Challenger',
        x: 20,
        y: 25,
        areaId: 131,
        hp: 2000,
        maxHp: 2000,
      })
      const baalThroneId = game.spawnMonster({
        hcIdx: 543,
        defId: 'baalthrone',
        x: 20,
        y: 15,
        areaId: 131,
      })
      const corpseId = game.spawnMonster({
        hcIdx: 453,
        defId: 'minion1',
        x: 21,
        y: 25,
        areaId: 131,
        hp: 1000,
        maxHp: 1000,
        unscaledMaxHp: 1000,
      })
      const monsters = getMonstersMap(game)
      const corpse = monsters.get(corpseId)!
      corpse.dead = true
      corpse.hp = 0

      const bt = monsters.get(baalThroneId)!
      ;(bt as unknown as { baalThroneTimerFrame: number }).baalThroneTimerFrame = 0
      game.drainEvents(playerId)

      const hpBefore = getPlayersMap(game).get(playerId)!.hp
      game.stepFrames(1)
      const hpAfter = getPlayersMap(game).get(playerId)!.hp
      const events = game.drainEvents(playerId)

      expect(corpse.shattered).toBe(true)
      expect(corpse.states.has(104)).toBe(true)
      // 40% of 1000 single-player base HP = 400 total (200 phys + 200 fire)
      expect(hpBefore - hpAfter).toBe(400)
      expect(
        events.some(
          (e) => e.type === 'SkillCast' && (e as { skillId?: number }).skillId === 285,
        ),
      ).toBe(true)
      expect(
        events.some(
          (e) =>
            e.type === 'CreateMissile' &&
            (e as { missileClassId?: number }).missileClassId === 54,
        ),
      ).toBe(true)
    })
  })

  describe('#1894: Overseer Whip SuicideMinion transform, Putrid Defiler Impregnate & Imp SiegeBeast mount', () => {
    it('transforms whipped minion1 (#453) into suicideminion1 (#461) at ~35% rate while healing and applying state 140', () => {
      let transformedCount = 0
      const trials = 30
      for (let t = 0; t < trials; t += 1) {
        const game = new GameInstance({ seed: 189400 + t * 7919, areaId: 110 })
        game.connectPlayer({ charClass: 'bar', name: 'Target', x: 25, y: 10, areaId: 110 })
        const overseerId = game.spawnMonster({
          hcIdx: 479,
          defId: 'overseer1',
          x: 10,
          y: 10,
          areaId: 110,
        })
        const minionId = game.spawnMonster({
          hcIdx: 453,
          defId: 'minion1',
          x: 12,
          y: 10,
          areaId: 110,
          hp: 40,
          maxHp: 100,
        })
        const monsters = getMonstersMap(game)
        const overseer = monsters.get(overseerId)!
        const minion = monsters.get(minionId)!
        overseer.cooldown = 0
        overseer.skillCooldown = 0
        ;(
          game as unknown as {
            tryCastMonsterUtilitySkill: (
              m: TestMonsterView,
              tgt: { x: number; y: number },
              d: number,
              healOrWhipOnly?: boolean,
            ) => boolean
          }
        ).tryCastMonsterUtilitySkill(overseer, { x: 25, y: 10 }, 15, true)

        expect(minion.hp).toBeGreaterThan(40)
        expect(minion.states.has(140)).toBe(true)
        if (minion.hcIdx === 461) {
          expect(minion.defId).toBe('suicideminion1')
          expect(minion.ai).toBe('SuicideMinion')
          expect(minion.states.has(142)).toBe(true)
          transformedCount += 1
        }
      }
      expect(transformedCount).toBeGreaterThanOrEqual(4)
      expect(transformedCount).toBeLessThanOrEqual(22)
    })

    it('lets Putrid Defiler (#546) cast #300 Impregnate on an ally so host death spawns a Pain Worm (#551..555)', () => {
      const game = new GameInstance({ seed: 189450, areaId: 128 })
      const playerId = game.connectPlayer({
        charClass: 'bar',
        name: 'Slayer',
        x: 20,
        y: 10,
        areaId: 128,
        hp: 5000,
        maxHp: 5000,
      })
      const defilerId = game.spawnMonster({
        hcIdx: 546,
        defId: 'putriddefiler1',
        x: 10,
        y: 10,
        areaId: 128,
      })
      const hostId = game.spawnMonster({
        hcIdx: 453,
        defId: 'minion1',
        x: 12,
        y: 10,
        areaId: 128,
        hp: 100,
        maxHp: 100,
      })
      const monsters = getMonstersMap(game)
      const defiler = monsters.get(defilerId)!
      const host = monsters.get(hostId)!

      for (let i = 0; i < 40 && !host.wormsOnDeath; i += 1) {
        defiler.cooldown = 0
        defiler.skillCooldown = 0
        game.stepFrames(1)
      }
      expect(host.wormsOnDeath).toBe(true)
      expect(host.umodIds.includes(40)).toBe(true)

      ;(
        game as unknown as {
          applyDamageToMonster: (
            p: TestPlayerView,
            m: TestMonsterView,
            dmg: number,
            skillId: number,
            elem: 'phys',
            merc: undefined,
            opts: { attackKind: 'melee'; autoHit: boolean },
          ) => boolean
        }
      ).applyDamageToMonster(getPlayersMap(game).get(playerId)!, host, 5000, 0, 'phys', undefined, {
        attackKind: 'melee',
        autoHit: true,
      })

      expect(host.dead).toBe(true)
      const worm = [...monsters.values()].find((m) => m.hcIdx >= 551 && m.hcIdx <= 555)
      expect(worm).toBeDefined()
      expect(worm!.experience).toBe(0)
      expect(worm!.alreadyGrantedKillRewards).toBe(true)
    })

    it('lets Demon Imp (#492) cast #330 Imp Teleport to mount a Siege Beast (#441) and dismount when carrier dies', () => {
      const game = new GameInstance({ seed: 189480, areaId: 110 })
      const playerId = game.connectPlayer({
        charClass: 'bar',
        name: 'Target',
        x: 24,
        y: 10,
        areaId: 110,
        hp: 5000,
        maxHp: 5000,
      })
      const beastId = game.spawnMonster({
        hcIdx: 441,
        defId: 'siegebeast1',
        x: 16,
        y: 10,
        areaId: 110,
        hp: 500,
        maxHp: 500,
      })
      const impId = game.spawnMonster({
        hcIdx: 492,
        defId: 'imp1',
        x: 11,
        y: 10,
        areaId: 110,
      })
      const monsters = getMonstersMap(game)
      const imp = monsters.get(impId)!
      const beast = monsters.get(beastId)!

      for (let i = 0; i < 60 && imp.mountedOnUnitId === undefined; i += 1) {
        imp.cooldown = 0
        imp.skillCooldown = 0
        game.stepFrames(1)
      }
      expect(imp.mountedOnUnitId).toBe(beastId)
      expect(beast.mountedImpUnitId).toBe(impId)
      expect(imp.x).toBe(beast.x)
      expect(imp.y).toBe(beast.y)

      // Kill the Siege Beast -> Imp dismounts cleanly and survives
      ;(
        game as unknown as {
          applyDamageToMonster: (
            p: TestPlayerView,
            m: TestMonsterView,
            dmg: number,
            skillId: number,
            elem: 'mag',
            merc: undefined,
            opts: { attackKind: 'spell'; autoHit: boolean },
          ) => boolean
        }
      ).applyDamageToMonster(getPlayersMap(game).get(playerId)!, beast, 99999, 84, 'mag', undefined, {
        attackKind: 'spell',
        autoHit: true,
      })
      expect(beast.dead).toBe(true)
      expect(imp.dead).toBe(false)
      expect(imp.mountedOnUnitId).toBeUndefined()
    })
  })

  describe('#1895: SandMaggot burrow/surface/egg-lay, Regurgitator Corpse Eat/Spit & BloodLord Frenzy', () => {
    it('cycles SandMaggot (#68) through #162 MagottDown burrow -> #161 MagottUp surface -> #163 MagottLay egg laying', () => {
      const game = new GameInstance({ seed: 189501, areaId: 62 })
      const playerId = game.connectPlayer({
        charClass: 'bar',
        name: 'Delver',
        x: 10,
        y: 10,
        areaId: 62,
        hp: 3000,
        maxHp: 3000,
      })
      const maggotId = game.spawnMonster({
        hcIdx: 68,
        defId: 'sandmaggot1',
        x: 18,
        y: 10,
        areaId: 62,
      })
      const monsters = getMonstersMap(game)
      const maggot = monsters.get(maggotId)!
      game.drainEvents(playerId)

      let sawSubmerged = false
      let sawResurfaced = false
      for (let f = 0; f < 260; f += 1) {
        game.stepFrames(1)
        if (maggot.submerged) sawSubmerged = true
        if (sawSubmerged && !maggot.submerged) sawResurfaced = true
      }
      const eggs = [...monsters.values()].filter((m) => m.defId === 'maggotegg1')
      expect(eggs.length).toBeGreaterThan(0)
      expect(eggs.length).toBeLessThanOrEqual(2)
      expect(sawSubmerged || maggot.spawnedChildren > 0).toBe(true)
      if (sawSubmerged) {
        expect(sawResurfaced).toBe(true)
      }
    })

    it('lets Regurgitator (#307) eat a corpse (#214) to heal 35% maxHp and fire #213 CorpseSpit, and lets BloodLord (#506) stack #328 Frenzy', () => {
      // 1. Regurgitator Corpse Eat (#214) -> Corpse Spit (#213)
      const regGame = new GameInstance({ seed: 189502, areaId: 104 })
      const regPlayer = regGame.connectPlayer({
        charClass: 'bar',
        name: 'Hero',
        x: 10,
        y: 10,
        areaId: 104,
        hp: 4000,
        maxHp: 4000,
      })
      const regId = regGame.spawnMonster({
        hcIdx: 307,
        defId: 'regurgitator1',
        x: 17,
        y: 10,
        areaId: 104,
        hp: 100,
        maxHp: 300,
      })
      const foodId = regGame.spawnMonster({
        hcIdx: 1,
        defId: 'zombie1',
        x: 18,
        y: 10,
        areaId: 104,
      })
      const regMonsters = getMonstersMap(regGame)
      const reg = regMonsters.get(regId)!
      const food = regMonsters.get(foodId)!
      food.dead = true
      food.hp = 0
      regGame.drainEvents(regPlayer)

      for (let i = 0; i < 40 && !food.shattered; i += 1) {
        reg.cooldown = 0
        reg.skillCooldown = 0
        regGame.stepFrames(1)
      }
      expect(food.shattered).toBe(true)
      expect(reg.hp).toBeGreaterThanOrEqual(200)
      expect(reg.corpseAmmo).toBeGreaterThanOrEqual(1)

      // Next cast fires #213 CorpseSpit consuming corpseAmmo
      for (let i = 0; i < 20 && reg.corpseAmmo > 0; i += 1) {
        reg.cooldown = 0
        reg.skillCooldown = 0
        regGame.stepFrames(1)
      }
      expect(reg.corpseAmmo).toBe(0)
      const regEvents = regGame.drainEvents(regPlayer)
      expect(
        regEvents.some(
          (e) => e.type === 'CreateMissile' && (e as { skillId?: number }).skillId === 213,
        ),
      ).toBe(true)

      // 2. BloodLord (#506) #328 BloodLordFrenzy stacking haste on melee hits
      const lordGame = new GameInstance({ seed: 189503, areaId: 122 })
      lordGame.connectPlayer({
        charClass: 'bar',
        name: 'Tank',
        x: 10,
        y: 10,
        areaId: 122,
        hp: 10000,
        maxHp: 10000,
      })
      const lordId = lordGame.spawnMonster({
        hcIdx: 506,
        defId: 'bloodlord1',
        x: 11,
        y: 10,
        areaId: 122,
        ar: 50000,
      })
      const lord = getMonstersMap(lordGame).get(lordId)!
      lordGame.stepFrames(80)
      expect(lord.frenzySpeedPct).toBeGreaterThan(0)
      expect(lord.frenzyUntilFrame).toBeGreaterThan(0)
      expect(lord.states.has(141)).toBe(true)
    })
  })

  describe('#1896: Monster healers (ZakarumPriest, HighPriest, GreaterMummy, OblivionKnight) & PMH check', () => {
    it('heals wounded allies via #179 ZakarumHeal and #182 Bestow while skipping state 52 (Prevent Monster Heal)', () => {
      for (const spec of [
        { hcIdx: 238, defId: 'cantor1', expectedSkill: 179 },
        { hcIdx: 345, defId: 'councilmember1', expectedSkill: 179 },
        { hcIdx: 101, defId: 'unraveler1', expectedSkill: 182 },
        { hcIdx: 312, defId: 'doomknight3', expectedSkill: 182 },
      ]) {
        const game = new GameInstance({ seed: 189600 + spec.hcIdx, areaId: 83 })
        const playerId = game.connectPlayer({
          charClass: 'bar',
          name: 'Observer',
          x: 28,
          y: 10,
          areaId: 83,
          hp: 5000,
          maxHp: 5000,
        })
        const healerId = game.spawnMonster({
          hcIdx: spec.hcIdx,
          defId: spec.defId,
          x: 10,
          y: 10,
          areaId: 83,
        })
        const pmhAllyId = game.spawnMonster({
          hcIdx: 11,
          defId: 'skeleton1',
          x: 11,
          y: 10,
          areaId: 83,
          hp: 5,
          maxHp: 200,
        })
        const woundedAllyId = game.spawnMonster({
          hcIdx: 11,
          defId: 'skeleton1',
          x: 11,
          y: 11,
          areaId: 83,
          hp: 20,
          maxHp: 200,
        })
        const monsters = getMonstersMap(game)
        monsters.get(pmhAllyId)!.states.add(52) // Prevent Monster Heal
        game.drainEvents(playerId)

        monsters.get(healerId)!.cooldown = 0
        monsters.get(healerId)!.skillCooldown = 0
        ;(
          game as unknown as {
            tryCastMonsterUtilitySkill: (
              m: TestMonsterView,
              tgt: { x: number; y: number },
              d: number,
              healOrWhipOnly?: boolean,
            ) => boolean
          }
        ).tryCastMonsterUtilitySkill(monsters.get(healerId)!, { x: 28, y: 10 }, 18, true)

        expect(monsters.get(pmhAllyId)!.hp).toBe(5)
        expect(monsters.get(woundedAllyId)!.hp).toBeGreaterThan(20)
        const castEvents = game.drainEvents(playerId)
        expect(
          castEvents.some(
            (e) =>
              e.type === 'SkillCast' &&
              (e as { skillId?: number }).skillId === spec.expectedSkill,
          ),
        ).toBe(true)
      }
    })
  })

  describe('#1897: MonProp.txt innate properties & MonStats.txt El1Type Ghost mana drain', () => {
    it('loads all 13 canonical 1.13c MonProp.txt rows and resolves Normal / Nightmare / Hell properties accurately', () => {
      expect(MON_PROP_ROWS_113C).toHaveLength(13)
      expect(resolveMonsterMonProps113c(186, 'normal').crushingBlowPct).toBe(0)
      expect(resolveMonsterMonProps113c(186, 'nightmare').crushingBlowPct).toBe(15)
      expect(resolveMonsterMonProps113c(186, 'hell').crushingBlowPct).toBe(25)
      // hcIdx 185 is camel, NOT blunderbore!
      expect(resolveMonsterMonProps113c(185, 'hell').crushingBlowPct).toBe(0)
      // hcIdx 618..619 are blunderbore5..6
      expect(resolveMonsterMonProps113c(618, 'hell').crushingBlowPct).toBe(25)
      expect(resolveMonsterMonProps113c('councilmember1', 'hell').extraFirePct).toBe(100)
      expect(resolveMonsterMonProps113c('baalhighpriest', 'hell').extraFirePct).toBe(120)
      expect(resolveMonsterMonProps113c('mephisto', 'hell')).toMatchObject({
        iasPct: 30,
        fcrPct: 30,
      })
      expect(resolveMonsterMonProps113c('bloodraven', 'hell').knockback).toBe(true)
      const quillThorns = resolveMonsterMonProps113c(605, 'hell', () => 37)
      expect(quillThorns.thornsFlat).toBe(37)
      expect(resolveMonsterMonProps113c('irongolem', 'normal').fadeLevel).toBe(16)
      expect(resolveMonsterMonProps113c('druidhawk', 'normal').blindTarget).toBe(-1)
    })

    it('applies Hell Urdar (#186) 25% Crushing Blow to both world monsters and #95 Revive pets, QuillRat6 Thorns, Mephisto IAS/FCR, and Ghost mana drain', async () => {
      // 1. Hell world Urdar (`blunderbore1`, hcIdx 186) + Mephisto IAS/FCR + QuillRat6 Thorns
      const hellGame = new GameInstance({ seed: 189701, areaId: 106, difficulty: 2 })
      const pId = hellGame.connectPlayer({
        charClass: 'bar',
        name: 'Brawler',
        x: 10,
        y: 10,
        areaId: 106,
        hp: 4000,
        maxHp: 4000,
        mana: 500,
        maxMana: 500,
      })
      const urdarId = hellGame.spawnMonster({ hcIdx: 186, defId: 'blunderbore1', x: 11, y: 10, areaId: 106 })
      const mephId = hellGame.spawnMonster({ hcIdx: 242, defId: 'mephisto', x: 30, y: 30, areaId: 106 })
      const quillId = hellGame.spawnMonster({ hcIdx: 605, defId: 'quillrat6', x: 10, y: 11, areaId: 106, hp: 500, maxHp: 500 })
      const monsters = getMonstersMap(hellGame)

      expect(monsters.get(urdarId)!.monProps.crushingBlowPct).toBe(25)
      expect(monsters.get(mephId)!.monProps.iasPct).toBe(30)
      expect(monsters.get(mephId)!.monProps.fcrPct).toBe(30)
      expect(monsters.get(quillId)!.monProps.thornsFlat).toBeGreaterThanOrEqual(30)
      expect(monsters.get(quillId)!.monProps.thornsFlat).toBeLessThanOrEqual(40)

      // Striking QuillRat6 in melee reflects flat thorns damage back to the player!
      const playerRec = getPlayersMap(hellGame).get(pId)!
      const hpBeforeThorns = playerRec.hp
      ;(
        hellGame as unknown as {
          applyDamageToMonster: (
            p: TestPlayerView,
            m: TestMonsterView,
            dmg: number,
            skillId: number,
            elem: 'phys',
            merc: undefined,
            opts: { attackKind: 'melee'; autoHit: boolean },
          ) => boolean
        }
      ).applyDamageToMonster(playerRec, monsters.get(quillId)!, 25, 0, 'phys', undefined, {
        attackKind: 'melee',
        autoHit: true,
      })
      expect(playerRec.hp).toBeLessThan(hpBeforeThorns)

      // 2. Necromancer `#95 Revive` on Hell Urdar (`hcIdx 186`) inherits `item_crushingblow = 25`!
      const registry = await getSharedDataRegistry()
      const mgr = new SummonManager(registry)
      const ownerStats = new UnitStatList(registry, { level: 80, maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      const ownerBus = new StateBus(ownerStats, registry)
      const revOutcome = mgr.createPet({
        owner: {
          id: 'nec_1',
          name: 'Necro',
          unitType: 'player',
          statList: ownerStats,
          stateBus: ownerBus,
          x: 10,
          y: 10,
        },
        skillId: 95,
        slvl: 10,
        difficulty: 'hell',
        corpses: [
          {
            id: 'corpse_urdar',
            consumed: false,
            classId: 186,
            monId: 'blunderbore1',
            baseMaxHp: 2000,
            monsterLevel: 80,
          },
        ],
      })
      expect(revOutcome.created).toBe(true)
      expect(revOutcome.pet!.monProps?.crushingBlowPct).toBe(25)
      expect(revOutcome.pet!.statList.getAccruedStat('item_crushingblow')).toBe(25)

      // 3. Ghost (`wraith1`, hcIdx 38) `MonStats.txt` `El1Type = 'mana'` drains player mana on melee hit!
      const ghostGame = new GameInstance({ seed: 189702, areaId: 21, difficulty: 2 })
      const ghostTargetId = ghostGame.connectPlayer({
        charClass: 'sor',
        name: 'Mage',
        x: 10,
        y: 10,
        areaId: 21,
        hp: 10000,
        maxHp: 10000,
        mana: 500,
        maxMana: 2000,
      })
      ghostGame.spawnMonster({
        hcIdx: 38,
        defId: 'wraith1',
        x: 11,
        y: 10,
        areaId: 21,
        ar: 50000,
      })
      const manaBefore = getPlayersMap(ghostGame).get(ghostTargetId)!.manaFixed
      ghostGame.stepFrames(150)
      expect(getPlayersMap(ghostGame).get(ghostTargetId)!.manaFixed).toBeLessThan(manaBefore)
    })
  })

  describe('#1898: MonEquip.txt world monster & pet equipment loadouts', () => {
    it('equips Blood Raven (#267) with Rare Short Bow (sbw) and Flying Scimitar (#234) with Rare Scimitar (scm) that drops on death', () => {
      const game = new GameInstance({ seed: 189801, areaId: 51 })
      const playerId = game.connectPlayer({
        charClass: 'bar',
        name: 'Hero',
        x: 10,
        y: 10,
        areaId: 51,
      })
      const ravenId = game.spawnMonster({ hcIdx: 267, defId: 'bloodraven', x: 15, y: 10, areaId: 51 })
      const scimId = game.spawnMonster({ hcIdx: 234, defId: 'flyingscimitar', x: 12, y: 10, areaId: 51 })
      const monsters = getMonstersMap(game)

      const ravenEquip = monsters.get(ravenId)!.monEquipLoadout
      expect(ravenEquip).toBeDefined()
      expect(ravenEquip!.primaryWeaponCode).toBe('sbw')
      expect(ravenEquip!.equippedSpecs[0]?.quality).toBe('rare')
      expect(ravenEquip!.weaponMaxDamage).toBeGreaterThan(0)

      const scimEquip = monsters.get(scimId)!.monEquipLoadout
      expect(scimEquip).toBeDefined()
      expect(scimEquip!.primaryWeaponCode).toBe('scm')
      expect(scimEquip!.equippedSpecs[0]?.quality).toBe('rare')

      // Killing Flying Scimitar (#234) drops a Scimitar (`scm`) on the ground!
      ;(
        game as unknown as {
          applyDamageToMonster: (
            p: TestPlayerView,
            m: TestMonsterView,
            dmg: number,
            skillId: number,
            elem: 'phys',
            merc: undefined,
            opts: { attackKind: 'melee'; autoHit: boolean },
          ) => boolean
        }
      ).applyDamageToMonster(
        getPlayersMap(game).get(playerId)!,
        monsters.get(scimId)!,
        99999,
        0,
        'phys',
        undefined,
        { attackKind: 'melee', autoHit: true },
      )
      game.stepFrames(30)

      const groundCodes = [...getGroundItemsMap(game).values()].map((g) => g.code)
      expect(groundCodes).toContain('scm')
    })

    it('rolls MonEquip.txt gear for Valkyrie (#32), Shadow Warrior (#268), Shadow Master (#279), and Raise Skeleton (#70 5% shield) with 0 drops on pet death', async () => {
      const registry = await getSharedDataRegistry()
      const mgr = new SummonManager(registry)
      const ownerStats = new UnitStatList(registry, {
        level: 85,
        maxhp: 1500 * FIXED_ONE,
        hitpoints: 1500 * FIXED_ONE,
      })
      const ownerBus = new StateBus(ownerStats, registry)
      const ownerCtx = {
        id: 'ama_1',
        name: 'ValkOwner',
        unitType: 'player' as const,
        statList: ownerStats,
        stateBus: ownerBus,
        x: 10,
        y: 10,
      }

      // Valkyrie at slvl 17 (`ilvl = 25 + 3 * 16 = 73`): Rare War Pike (`7p7`) + Rare Sacred Armor (`uar`)
      expect(computeSummonMonEquipIlvl113c('valkyrie', 17)).toBe(73)
      const valk = mgr.createPet({
        owner: ownerCtx,
        skillId: 32,
        slvl: 17,
        monEquipSeed: 42,
      })
      expect(valk.created).toBe(true)
      expect(valk.pet!.monEquipLoadout?.primaryWeaponCode).toBe('7p7')
      expect(valk.pet!.monEquipLoadout?.torsoArmorCode).toBe('uar')
      expect(valk.pet!.monEquipLoadout?.weaponMaxDamage).toBeGreaterThan(100)

      // Shadow Warrior (#268) & Shadow Master (#279) at slvl 17
      const sw = mgr.createPet({ owner: ownerCtx, skillId: 268, slvl: 17, monEquipSeed: 77 })
      expect(sw.created).toBe(true)
      expect(sw.pet!.monEquipLoadout?.slots.length).toBeGreaterThanOrEqual(3)

      const sm = mgr.createPet({ owner: ownerCtx, skillId: 279, slvl: 17, monEquipSeed: 99 })
      expect(sm.created).toBe(true)
      expect(sm.pet!.monEquipLoadout?.slots.length).toBeGreaterThanOrEqual(5)
      expect(sm.pet!.monEquipLoadout?.equippedSpecs.some((s) => s.quality === 'rare')).toBe(true)

      // Raise Skeleton (#70) 5% shield roll
      const skelWithShield = mgr.createPet({
        owner: ownerCtx,
        skillId: 70,
        slvl: 10,
        monEquipSeed: 2, // 2 % 100 < 5 -> shield!
        corpses: [{ id: 'c1', consumed: false, classId: 0, monId: 'skeleton1' }],
      })
      const skelNoShield = mgr.createPet({
        owner: ownerCtx,
        skillId: 70,
        slvl: 10,
        monEquipSeed: 50, // 50 % 100 >= 5 -> no shield
        corpses: [{ id: 'c2', consumed: false, classId: 0, monId: 'skeleton1' }],
      })
      expect(skelWithShield.pet!.hasShield).toBe(true)
      expect(skelWithShield.pet!.statList.getAccruedStat('toblock')).toBe(20)
      expect(skelNoShield.pet!.hasShield).toBe(false)

      // Verify in GameInstance that killing a summoned Valkyrie drops ZERO items on ground
      const game = new GameInstance({ seed: 189802, areaId: 2 })
      const pId = game.connectPlayer({ charClass: 'ama', name: 'Zon', x: 10, y: 10, areaId: 2 })
      const gameValk = game.summonPet(pId, { skillId: 32, slvl: 17, x: 12, y: 10 })
      expect(gameValk.created).toBe(true)
      gameValk.pet!.hp = 0
      gameValk.pet!.alive = false
      game.stepFrames(5)
      expect(getGroundItemsMap(game).size).toBe(0)
    })

    it('rolls deterministic Rare items via rollMonsterOrPetLoadout113c', () => {
      const a = rollMonsterOrPetLoadout113c({ monster: 'valkyrie', level: 17, ilvl: 73, seed: 12345 })
      const b = rollMonsterOrPetLoadout113c({ monster: 'valkyrie', level: 17, ilvl: 73, seed: 12345 })
      expect(a.primaryWeaponCode).toBe('7p7')
      expect(a.weaponMinDamage).toBe(b.weaponMinDamage)
      expect(a.weaponMaxDamage).toBe(b.weaponMaxDamage)
      expect(a.defenseBonus).toBe(b.defenseBonus)
    })
  })

  describe('#1921: Elite pre-MonLvl +2/+3 mlvl boost, 3x/5x XP multipliers & xfer=1 modifier transfer', () => {
    it('adds +2 Champion and +3 Unique/Minion mlvl BEFORE MonLvl.txt lookup and applies 3x / 5x XP multipliers', () => {
      const fallenHell = getMonsterKindByHcIdx(0, 'hell')!
      const areaLevel = 67 // Hell Blood Moor

      const norm = resolveMonsterStats(fallenHell, {
        difficulty: 'hell',
        rank: 'normal',
        areaLevel,
        seed: 100,
      })
      const champ = resolveMonsterStats(fallenHell, {
        difficulty: 'hell',
        rank: 'champion',
        areaLevel,
        seed: 100,
      })
      const uniq = resolveMonsterStats(fallenHell, {
        difficulty: 'hell',
        rank: 'unique',
        areaLevel,
        seed: 100,
      })
      const minion = resolveMonsterStats(fallenHell, {
        difficulty: 'hell',
        rank: 'minion',
        areaLevel,
        seed: 100,
      })

      expect(norm.level).toBe(67)
      expect(champ.level).toBe(69)
      expect(uniq.level).toBe(70)
      expect(minion.level).toBe(70)

      const monLvlRow = (lvl: number) => MONLVL_113C_ROWS.find((r) => r.level === lvl)!
      const baseXp67 = Math.floor((fallenHell.experience * monLvlRow(67).lXp[2]) / 100)
      const baseXp69 = Math.floor((fallenHell.experience * monLvlRow(69).lXp[2]) / 100)
      const baseXp70 = Math.floor((fallenHell.experience * monLvlRow(70).lXp[2]) / 100)

      expect(norm.xp).toBe(baseXp67)
      expect(champ.xp).toBe(baseXp69 * 3)
      expect(uniq.xp).toBe(baseXp70 * 5)
      expect(minion.xp).toBe(baseXp70 * 5)
    })

    it('transfers xfer=1 boss modifiers to Unique & SuperUnique minions while excluding xfer=0 modifiers', () => {
      const bossMods = [
        'extra_strong', // id 5, xfer=1
        'extra_fast', // id 6, xfer=1
        'aura', // id 30, xfer=0
        'scarab', // id 20, xfer=0
        'poisonhit', // id 23, xfer=0
        'goboom', // id 31, xfer=0
        'cursed', // id 7, xfer=1
      ]
      const transferred = filterTransferableEliteModifiers113c(bossMods)
      expect(transferred).toEqual(['extra_strong', 'extra_fast', 'cursed'])

      // Verify SuperUnique pack spawning transfers xfer=1 umods to minions
      const game = new GameInstance({ seed: 192101, areaId: 4, difficulty: 2 })
      game.connectPlayer({ charClass: 'bar', name: 'Hero', x: 50, y: 50, areaId: 4 })
      // SuperUnique index 2 = Rakanishu (Lightning Enchanted + 2 random Hell mods)
      const spawnedIds = game.spawnSuperUnique({ superUniqueIndex: 2, x: 20, y: 20, areaId: 4 })
      expect(spawnedIds.length).toBeGreaterThan(1)
      const monsters = getMonstersMap(game)
      const boss = monsters.get(spawnedIds[0]!)!
      const minion = monsters.get(spawnedIds[1]!)!
      // Minion never inherits xfer=0 modifiers (e.g. Aura 30, Scarab 20, PoisonHit 23)
      for (const nonXfer of [20, 23, 30, 31, 34, 35, 40, 42]) {
        expect(minion.umodIds).not.toContain(nonXfer)
      }
      for (const mUmod of minion.umodIds) {
        expect(boss.umodIds).toContain(mUmod)
      }
    })
  })

  describe('#1922: Unique boss pack minion1/minion2 species, +difficulty minion count & normal pack companions', () => {
    it('spawns MonStats.txt minion1/minion2 species for Unique bosses and adds +0/+1/+2 difficulty bonus minions', () => {
      const normalKinds = getCanonicalMonsterKinds('normal')
      const shaman = normalKinds.get('fallenshaman1')!
      expect(shaman.minions).toEqual(['fallen1'])

      // Force Unique roll (`championChance = 20`, find seed rolling >= 20)
      let normPack = rollEliteGroup([shaman], new Rng(1), 0, 'normal', normalKinds)
      for (let s = 1; s < 50 && normPack.rank !== 'unique'; s += 1) {
        normPack = rollEliteGroup([shaman], new Rng(s), 0, 'normal', normalKinds)
      }
      expect(normPack.rank).toBe('unique')
      expect(normPack.minionKinds).toBeDefined()
      expect(normPack.minionKinds!.every((m) => m.id === 'fallen1')).toBe(true)

      // Check minion count ranges across Normal (3..6 -> total 4..7), NM (4..7 -> total 5..8), Hell (5..8 -> total 6..9)
      const fallen = normalKinds.get('fallen1')! // partyMin=0, partyMax=0 -> base 3..6
      for (let s = 1; s <= 40; s += 1) {
        const gNorm = rollEliteGroup([fallen], new Rng(s * 97), s, 'normal', normalKinds)
        if (gNorm.rank === 'unique') {
          expect(gNorm.count).toBeGreaterThanOrEqual(4)
          expect(gNorm.count).toBeLessThanOrEqual(7)
        }
        const gNm = rollEliteGroup([fallen], new Rng(s * 97), s, 'nightmare', normalKinds)
        if (gNm.rank === 'unique') {
          expect(gNm.count).toBeGreaterThanOrEqual(5)
          expect(gNm.count).toBeLessThanOrEqual(8)
        }
        const gHell = rollEliteGroup([fallen], new Rng(s * 97), s, 'hell', normalKinds)
        if (gHell.rank === 'unique') {
          expect(gHell.count).toBeGreaterThanOrEqual(6)
          expect(gHell.count).toBeLessThanOrEqual(9)
        }
      }
    })

    it('spawns partyMin..partyMax subordinate companions alongside normal Shaman / Overseer packs in room population', () => {
      const normalKinds = getCanonicalMonsterKinds('normal')
      const shaman = normalKinds.get('fallenshaman1')!
      expect(shaman.partyMin).toBeGreaterThan(0)
      expect(shaman.partyMax).toBeGreaterThanOrEqual(shaman.partyMin!)

      const plan = {
        ...getLevelMonsterPlan113c(2, 'normal')!,
        eliteMin: 0,
        eliteMax: 0,
        density: 10000,
      }
      const groups = planMonsterGroups(plan, [shaman], normalKinds, 6, new Rng(192201), {
        difficulty: 'normal',
      })
      const normalGroups = groups.filter((g) => g.rank === 'normal')
      expect(normalGroups.length).toBeGreaterThan(0)
      for (const g of normalGroups) {
        expect(g.companions).toBeDefined()
        expect(g.companions!.length).toBeGreaterThanOrEqual(shaman.partyMin!)
        expect(g.companions!.length).toBeLessThanOrEqual(shaman.partyMax!)
        expect(g.companions!.every((c) => c.id === 'fallen1')).toBe(true)
      }

      // Verify explicit dual-minion round-robin (`D2Game.dll` 0x6FD0E480: fetishshaman1 -> fetish1 + fetishblow1)
      const fetishShaman = normalKinds.get('fetishshaman1')!
      expect(fetishShaman.minions).toEqual(['fetish1', 'fetishblow1'])
      const dualGroups = planMonsterGroups(plan, [fetishShaman], normalKinds, 4, new Rng(192202), {
        difficulty: 'normal',
      })
      for (const g of dualGroups.filter((grp) => grp.rank === 'normal')) {
        expect(g.companions).toBeDefined()
        expect(g.companions![0]?.id).toBe('fetish1')
        expect(g.companions![1]?.id).toBe('fetishblow1')
      }

      // Also verify RoomStreamer emits the companions on walkable sub-tiles
      const rooms = Array.from({ length: 8 }, (_, idx) => ({
        index: idx,
        x: 100 + idx * 50,
        y: 100,
        w: 40,
        h: 40,
        seed: (0x1922 + idx * 7919) >>> 0,
      }))
      const lvlPlan = planLevelPopulation113c(3, 'normal', rooms, 0x1922)!
      const spawns = rooms.flatMap((r) => planRoomPopulation113c(lvlPlan, r, () => true))
      expect(spawns.length).toBeGreaterThan(0)
    })
  })

  describe('#1923: Multiplayer monster scaling (playersCount 1..8) for HP, XP, AR & Damage', () => {
    it('scales HP & XP by +(N - 1) * 50% and AR & Damage by +(N - 1) * 6.25% in resolveMonsterStats and GameInstance', () => {
      const bloodLord = getMonsterKindByHcIdx(506, 'hell')!
      const p1 = resolveMonsterStats(bloodLord, {
        difficulty: 'hell',
        areaLevel: 85,
        playersCount: 1,
        seed: 777,
      })
      const p8 = resolveMonsterStats(bloodLord, {
        difficulty: 'hell',
        areaLevel: 85,
        playersCount: 8,
        seed: 777,
      })

      expect(p8.maxHp).toBe(Math.floor((p1.maxHp! * 9) / 2))
      expect(p8.xp).toBe(Math.floor((p1.xp * 9) / 2))
      expect(p8.attack1!.minDamage).toBe(Math.floor((p1.attack1!.minDamage! * 23) / 16))
      expect(p8.attack1!.maxDamage).toBe(Math.floor((p1.attack1!.maxDamage! * 23) / 16))
      expect(p8.toHit).toBe(Math.floor((p1.toHit! * 23) / 16))

      // Verify GameInstance dynamic scaling via connectPlayer & setPlayersX
      const game = new GameInstance({ seed: 192301, areaId: 128, difficulty: 2, maxPlayers: 8 })
      game.connectPlayer({ charClass: 'bar', name: 'P1', x: 10, y: 10, areaId: 128 })
      const mId = game.spawnMonster({
        hcIdx: 506,
        defId: 'bloodlord1',
        x: 30,
        y: 30,
        areaId: 128,
        statSeed: 777,
      })
      const npcId = game.spawnMonster({
        hcIdx: 148,
        defId: 'akara',
        x: 5,
        y: 5,
        areaId: 128,
        isNpc: true,
        hp: 100,
        maxHp: 100,
      })
      const monsters = getMonstersMap(game)
      const mon = monsters.get(mId)!
      const npc = monsters.get(npcId)!

      const hp1 = mon.maxHp
      const xp1 = mon.experience
      const minDmg1 = mon.minDmg
      const maxDmg1 = mon.maxDmg
      const ar1 = mon.ar

      // Switch to /players 8 -> rescales HP, XP, Damage, AND AR dynamically!
      game.setPlayersX(8, { syncMonsterPlayerCount: true })
      expect(mon.maxHp).toBe(Math.floor((hp1 * 9) / 2))
      expect(mon.experience).toBe(Math.floor((xp1 * 9) / 2))
      expect(mon.minDmg).toBe(Math.floor((minDmg1 * 23) / 16))
      expect(mon.maxDmg).toBe(Math.floor((maxDmg1 * 23) / 16))
      expect(mon.ar).toBe(Math.floor((ar1 * 23) / 16))

      // NPCs never scale with player count
      expect(npc.maxHp).toBe(100)

      // Connecting a second real player when manualPlayersX is reset to 1 scales to N = 2
      game.setPlayersX(1)
      game.connectPlayer({ charClass: 'sor', name: 'P2', x: 11, y: 10, areaId: 128 })
      expect(game.playersX).toBe(2)
      expect(mon.maxHp).toBe(Math.floor((hp1 * 3) / 2))
      expect(mon.experience).toBe(Math.floor((xp1 * 3) / 2))
      expect(mon.ar).toBe(Math.floor((ar1 * 17) / 16))
    })
  })
})
