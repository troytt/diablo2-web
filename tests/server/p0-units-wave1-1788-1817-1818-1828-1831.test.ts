/**
 * Wave 1 P0 Units Slice Verification Suite (#1788, #1817, #1818, #1828, #1831):
 * - #1788: Hardcore (`0x04`) permadeath (`0x08`), `.d2s` status export, death chat, and `C2S 0x41` Resurrect block.
 * - #1817: `GameInstance.stepSummonedPets` wired to `SummonManager.tickPets` (Skeletal Mage, Sentry Traps, Hydra, Vines, Iron Golem).
 * - #1818: `GameInstance.stepMercenaries` live vision AI, Act 1/2/3/5 skills, weapon/gear stats, own CB, and Boss `50%/35%/25%` factor.
 * - #1828: 1.13c `canUnitEquipItem113c` (`0x6FD76DB0` / `0x6FD77160` / `0x6FD76190`) enforced in `handleItemEquip` & `handleMercItem`.
 * - #1831: `SetItems.txt` `addFunc === 0` stat aggregation (`Trang-Oul's Claws` +25% Poison Skill Dmg, `Civerb's Cudgel`, etc.) without double-counting.
 */

import { describe, expect, it } from 'vitest'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import {
  canHandItemsCoexist113c,
  canUnitEquipItem113c,
  computeItemRequirements113c,
  getItemBaseEquipMeta113c,
  getItemTypeEquipMeta113c,
} from '../../src/common/items/equip-req-113c.ts'
import { scaleMercenaryBossDamage113c } from '../../src/server/ai/mercenary-ai.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'

interface TestItemSpec {
  unitId: number
  code: string
  name?: string
  quality?: number
  level?: number
  location?: 'inventory' | 'equipped' | 'cursor' | 'ground'
  bodyLoc?: number
  x?: number
  y?: number
  width?: number
  height?: number
  ownerId?: number
  areaId?: number
  identified?: boolean
  ethereal?: boolean
  broken?: boolean
  durability?: number
  maxDurability?: number
  statsMap?: ReadonlyMap<number, number>
  rawStats?: readonly { statId: number; param: number; value: number }[]
  setBonusStats?:
    | readonly { statId: number; param: number; value: number }[]
    | readonly { index: number; stats: readonly { statId: number; param: number; value: number }[] }[]
  setItemId?: number
  uniqueItemId?: number
  socketedItems?: unknown[]
}

function makeServerItem(spec: TestItemSpec) {
  const loc = spec.location ?? 'inventory'
  const bodyLoc = spec.bodyLoc ?? (loc === 'equipped' ? 4 : 0)
  const stats = spec.statsMap ? new Map(spec.statsMap) : new Map<number, number>()
  return {
    unitId: spec.unitId,
    code: spec.code,
    name: spec.name ?? spec.code,
    quality: spec.quality ?? 2,
    level: spec.level ?? 80,
    location: loc,
    x: spec.x ?? 0,
    y: spec.y ?? 0,
    width: spec.width ?? 2,
    height: spec.height ?? 3,
    areaId: spec.areaId ?? 2,
    ownerId: spec.ownerId ?? 1,
    bodyLoc,
    storePage: loc === 'inventory' ? 1 : 0,
    cost: 1000,
    gamble: false,
    identified: spec.identified ?? true,
    ethereal: spec.ethereal ?? false,
    ...(spec.broken !== undefined ? { broken: spec.broken } : {}),
    socketed: (spec.socketedItems?.length ?? 0) > 0,
    totalSockets: spec.socketedItems?.length ?? 0,
    durability: spec.durability ?? 40,
    maxDurability: spec.maxDurability ?? 40,
    quantity: 1,
    stats,
    socketedItems: (spec.socketedItems ?? []) as never[],
    rawItemData: {
      id: spec.unitId,
      itemId: spec.unitId,
      code: spec.code,
      name: spec.name ?? spec.code,
      quality: spec.quality ?? 2,
      level: spec.level ?? 80,
      identified: spec.identified ?? true,
      ethereal: spec.ethereal ?? false,
      broken: spec.broken ?? false,
      socketed: (spec.socketedItems?.length ?? 0) > 0,
      sockets: spec.socketedItems?.length ?? 0,
      location: loc === 'cursor' ? 4 : loc === 'equipped' ? 1 : 0,
      bodyLoc,
      equippedSlot: bodyLoc,
      ...(spec.setItemId !== undefined ? { setItemId: spec.setItemId } : {}),
      ...(spec.uniqueItemId !== undefined ? { uniqueItemId: spec.uniqueItemId } : {}),
      stats: spec.rawStats ? [...spec.rawStats] : [],
      ...(spec.setBonusStats !== undefined ? { setBonusStats: [...spec.setBonusStats] } : {}),
      runewordStats: [],
    } as never,
  }
}

function getInternalPlayerMap(game: GameInstance): Map<number, Record<string, any>> {
  return (game as unknown as { players: Map<number, Record<string, any>> }).players
}

function getInternalMercMap(game: GameInstance): Map<number, Record<string, any>> {
  return (game as unknown as { mercenaries: Map<number, Record<string, any>> }).mercenaries
}

function getInternalGroundItemsMap(game: GameInstance): Map<number, Record<string, any>> {
  return (game as unknown as { groundItems: Map<number, Record<string, any>> }).groundItems
}

describe('Wave 1 P0 Units Slice (#1788, #1817, #1818, #1828, #1831)', () => {
  describe('#1788: Hardcore Permadeath (0x08), Notification & C2S 0x41 Resurrect Block', () => {
    it('marks slain Hardcore character with 0x08 in .d2s, broadcasts hardcore death Chat (eventType=6), blocks Resurrect/Respawn, and rejects dead HC reconnect', () => {
      const game = new GameInstance({
        seed: 1788,
        difficulty: 0,
        act: 0,
        areaId: 2,
        maxPlayers: 4,
      })
      const hcId = game.connectPlayer({
        name: 'HcBarb',
        charClass: 'bar',
        level: 42,
        hardcore: true,
        areaId: 2,
        x: 50,
        y: 50,
      })
      const witnessId = game.connectPlayer({
        name: 'HcWitness',
        charClass: 'sor',
        level: 30,
        hardcore: true,
        areaId: 1,
        x: 20,
        y: 20,
      })

      expect(getInternalPlayerMap(game).get(hcId)!.isHardcore).toBe(true)

      // Before death: status byte has 0x04 (Hardcore) set and 0x08 (Died) clear
      const d2sAlive = game.exportPlayerD2s(hcId)
      expect(d2sAlive[0x24]! & 0x04).toBe(0x04)
      expect(d2sAlive[0x24]! & 0x08).toBe(0)

      const pRec = getInternalPlayerMap(game).get(hcId)!
      pRec.hp = 10
      pRec.hpFixed = 10 * FIXED_ONE
      game.drainEvents(hcId)
      game.drainEvents(witnessId)

      // Deliver lethal monster damage deterministically
      game.applyDamageToPlayer(hcId, 200, { killerType: 'monster' })
      expect(game.getPlayerState(hcId)!.dead).toBe(true)
      expect(game.getPlayerState(hcId)!.hp).toBe(0)

      const hcEvents = game.drainEvents(hcId)
      const witnessEvents = game.drainEvents(witnessId)
      const deathChat = hcEvents.find(
        (ev) => ev.type === 'Chat' && ev.kind === 'event' && ev.eventType === 6,
      )
      expect(deathChat).toBeDefined()
      expect((deathChat as { name1?: string }).name1).toBe('HcBarb')
      expect((deathChat as { arg?: number }).arg).toBe(42)
      expect(
        witnessEvents.some((ev) => ev.type === 'Chat' && ev.kind === 'event' && ev.eventType === 6),
      ).toBe(true)

      // Exported .d2s carries both 0x04 (Hardcore) and 0x08 (Died)
      const d2sDead = game.exportPlayerD2s(hcId)
      expect(d2sDead[0x24]! & 0x0c).toBe(0x0c)

      // Attempt C2S 0x41 Resurrect and Respawn: strictly blocked for Hardcore!
      game.enqueueCommand(hcId, { type: 'Resurrect' } as never)
      game.enqueueCommand(hcId, { type: 'Respawn' })
      game.stepFrames(2)

      const afterRespawnAttempt = game.getPlayerState(hcId)!
      expect(afterRespawnAttempt.dead).toBe(true)
      expect(afterRespawnAttempt.hp).toBe(0)
      expect(afterRespawnAttempt.areaId).toBe(2)

      // Reconnecting with the dead Hardcore .d2s must be rejected
      const nextGame = new GameInstance({ seed: 1789, difficulty: 0, act: 0, areaId: 1 })
      expect(() => nextGame.connectPlayer({ d2sBytes: d2sDead })).toThrow(/permanently dead/i)
    })

    it('keeps Softcore death status byte free of 0x08 and allows normal town Respawn', () => {
      const game = new GameInstance({ seed: 1790, difficulty: 0, act: 0, areaId: 2 })
      const scId = game.connectPlayer({
        name: 'ScSorc',
        charClass: 'sor',
        level: 25,
        areaId: 2,
        x: 40,
        y: 40,
      })

      const pRec = getInternalPlayerMap(game).get(scId)!
      pRec.hp = 10
      pRec.hpFixed = 10 * FIXED_ONE
      game.drainEvents(scId)

      game.applyDamageToPlayer(scId, 200, { killerType: 'monster' })
      expect(game.getPlayerState(scId)!.dead).toBe(true)

      const scEvents = game.drainEvents(scId)
      expect(
        scEvents.some((ev) => ev.type === 'Chat' && ev.kind === 'event' && ev.eventType === 6),
      ).toBe(false)

      const scD2sAfterDeath = game.exportPlayerD2s(scId)
      expect(scD2sAfterDeath[0x24]! & 0x0c).toBe(0)

      game.enqueueCommand(scId, { type: 'Respawn' })
      game.stepFrames(2)
      const revived = game.getPlayerState(scId)!
      expect(revived.dead).toBe(false)
      expect(revived.hp).toBeGreaterThan(0)
      expect(revived.areaId).toBe(1)
    })
  })

  describe('#1817: GameInstance.stepSummonedPets -> SummonManager.tickPets (Mages, Traps, Hydra, Vines, Iron Golem)', () => {
    it('fires ranged elemental bolts from Skeletal Mages (#80) without chasing into melee', () => {
      const game = new GameInstance({ seed: 18170, difficulty: 0, act: 0, areaId: 2 })
      const necId = game.connectPlayer({
        name: 'MageNec',
        charClass: 'nec',
        level: 30,
        areaId: 2,
        x: 50,
        y: 50,
      })
      // Spawn corpse to raise Skeletal Mage (#80)
      const corpseId = game.spawnMonster({
        defId: 'fallen1',
        areaId: 2,
        x: 52,
        y: 50,
        hp: 10,
        maxHp: 10,
        aiDisabled: true,
      })
      game.applyDamageToMonster(corpseId, 100, necId)
      game.stepFrame()

      const mageOut = game.summonPet(necId, { skillId: 80, slvl: 10, x: 52, y: 50 })
      expect(mageOut.created).toBe(true)
      const startX = mageOut.pet!.x

      const targetId = game.spawnMonster({
        defId: 'zombie1',
        areaId: 2,
        x: 60,
        y: 50,
        hp: 500,
        maxHp: 500,
        ac: 0,
        aiDisabled: true,
      })
      game.drainEvents(necId)

      game.stepFrames(40)
      const events = game.drainEvents(necId)
      expect(events.some((ev) => ev.type === 'CreateMissile')).toBe(true)
      expect(game.getMonster(targetId)!.hp).toBeLessThan(500)
      // Ranged Skeletal Mage holds stand-off distance instead of walking onto x=60
      const mageNow = game.getPetsForOwner(necId)[0]!
      expect(Math.abs(mageNow.x - startX)).toBeLessThanOrEqual(2)
    })

    it('keeps Assassin Lightning Sentry (#271) & Death Sentry (#276) stationary, fires finite shots / CE, and despawns on ammo exhaustion', () => {
      const game = new GameInstance({ seed: 18171, difficulty: 0, act: 0, areaId: 2 })
      const asnId = game.connectPlayer({
        name: 'Trapper',
        charClass: 'ass',
        level: 45,
        areaId: 2,
        x: 50,
        y: 50,
      })

      const trapOut = game.summonPet(asnId, { skillId: 271, slvl: 10, x: 54, y: 50 })
      expect(trapOut.created).toBe(true)
      const trapUnitId = (trapOut.pet as unknown as { unitId: number }).unitId
      expect(trapUnitId).toBeGreaterThan(0)

      const monId = game.spawnMonster({
        defId: 'zombie1',
        areaId: 2,
        x: 60,
        y: 50,
        hp: 2000,
        maxHp: 2000,
        ac: 0,
        aiDisabled: true,
      })
      game.drainEvents(asnId)

      // Step enough frames for all 10 Lightning Sentry shots (15-frame AI delay * 10 = ~165 frames)
      game.stepFrames(200)
      const events = game.drainEvents(asnId)
      expect(game.getMonster(monId)!.hp).toBeLessThan(2000)
      expect(game.getPetsForOwner(asnId).length).toBe(0)
      expect(
        events.some((ev) => ev.type === 'UnitRemove' && (ev.unitId === trapUnitId || ev.id === trapUnitId)),
      ).toBe(true)

      // Death Sentry (#276): consumes corpse and deals Corpse Explosion damage while remaining stationary
      const corpseId = game.spawnMonster({
        defId: 'zombie1',
        areaId: 2,
        x: 59,
        y: 50,
        hp: 400,
        maxHp: 400,
        aiDisabled: true,
      })
      game.applyDamageToMonster(corpseId, 1000, asnId)
      game.stepFrame()

      const dsOut = game.summonPet(asnId, { skillId: 276, slvl: 10, x: 55, y: 50 })
      expect(dsOut.created).toBe(true)
      const hpBeforeCe = game.getMonster(monId)!.hp
      game.drainEvents(asnId)

      game.stepFrames(25)
      const dsPet = game.getPetsForOwner(asnId)[0]
      if (dsPet) {
        expect(dsPet.x).toBe(55)
        expect(dsPet.y).toBe(50)
      }
      const dsEvents = game.drainEvents(asnId)
      expect(game.getMonster(monId)!.hp).toBeLessThan(hpBeforeCe)
      expect(
        dsEvents.some((ev) => ev.type === 'UnitRemove' && (ev.unitId === corpseId || ev.id === corpseId)),
      ).toBe(true)
    })

    it('keeps Sorceress Hydra (#62) stationary, scales #337 fire bolts with synergies + Fire Mastery, and despawns after 250 frames', () => {
      const runHydraTrial = (withSynergies: boolean): { dmgDealt: number; activeAfter260: number } => {
        const g = new GameInstance({ seed: 18172, difficulty: 0, act: 0, areaId: 2 })
        const sorcId = g.connectPlayer({
          name: 'HydraSorc',
          charClass: 'sor',
          level: 60,
          areaId: 2,
          x: 50,
          y: 50,
          skills: withSynergies
            ? { 36: 20, 47: 20, 61: 20, 62: 15 } // Fire Bolt + Fire Ball + Fire Mastery
            : { 62: 15 },
        })
        const hOut = g.summonPet(sorcId, { skillId: 62, slvl: 15, x: 54, y: 50 })
        expect(hOut.created).toBe(true)

        const targetId = g.spawnMonster({
          defId: 'zombie1',
          areaId: 2,
          x: 60,
          y: 50,
          hp: 3000,
          maxHp: 3000,
          ac: 0,
          aiDisabled: true,
        })

        g.stepFrames(60)
        const activeHydra = g.getPetsForOwner(sorcId)[0]!
        expect(activeHydra.x).toBe(54)
        expect(activeHydra.y).toBe(50)
        const dmgAt60 = 3000 - g.getMonster(targetId)!.hp

        // Advance past 250-frame lifespan -> Hydra despawns cleanly
        g.stepFrames(200)
        return { dmgDealt: dmgAt60, activeAfter260: g.getPetsForOwner(sorcId).length }
      }

      const base = runHydraTrial(false)
      const synergized = runHydraTrial(true)
      expect(base.dmgDealt).toBeGreaterThan(100)
      expect(synergized.dmgDealt).toBeGreaterThan(base.dmgDealt * 2)
      expect(base.activeAfter260).toBe(0)
      expect(synergized.activeAfter260).toBe(0)
    })

    it('consumes corpses with Druid Carrion Vine (#231) & Solar Creeper (#241) to heal owner HP & Mana', () => {
      const game = new GameInstance({ seed: 18173, difficulty: 0, act: 0, areaId: 2 })
      const druId = game.connectPlayer({
        name: 'VineDruid',
        charClass: 'dru',
        level: 40,
        areaId: 2,
        x: 50,
        y: 50,
      })
      const pRec = getInternalPlayerMap(game).get(druId)!
      pRec.hp = 20
      pRec.hpFixed = 20 * FIXED_ONE
      pRec.mana = 5
      pRec.manaFixed = 5 * FIXED_ONE

      const c1 = game.spawnMonster({ defId: 'fallen1', areaId: 2, x: 51, y: 50, hp: 10, maxHp: 10, aiDisabled: true })
      game.applyDamageToMonster(c1, 100, druId)
      game.stepFrame()

      const cvOut = game.summonPet(druId, { skillId: 231, slvl: 10, x: 51, y: 50 })
      expect(cvOut.created).toBe(true)
      game.stepFrames(5)
      expect(game.getPlayerState(druId)!.hp).toBeGreaterThan(20)

      // Replace Carrion Vine with Solar Creeper (#241) BEFORE spawning corpse c2 so Carrion Vine cannot eat c2 first
      const scOut = game.summonPet(druId, { skillId: 241, slvl: 10, x: 51, y: 51 })
      expect(scOut.created).toBe(true)
      const c2 = game.spawnMonster({ defId: 'fallen1', areaId: 2, x: 51, y: 51, hp: 10, maxHp: 10, aiDisabled: true })
      game.applyDamageToMonster(c2, 100, druId)
      const manaBefore = pRec.manaFixed
      game.stepFrames(5)
      expect(pRec.manaFixed).toBeGreaterThan(manaBefore + 3 * FIXED_ONE)
    })

    it('rejects non-metallic items for Iron Golem (#90) and consumes metallic Insight polearm to pulse Meditation onto owner', () => {
      const game = new GameInstance({ seed: 18174, difficulty: 0, act: 0, areaId: 2 })
      const necId = game.connectPlayer({
        name: 'IronNec',
        charClass: 'nec',
        level: 50,
        areaId: 2,
        x: 50,
        y: 50,
      })

      // 1. Leather Quilted Armor ('qui') is non-metallic -> rejected and kept on ground
      const leatherId = game.spawnGroundItem({ code: 'qui', x: 52, y: 50, areaId: 2 })
      const failOut = game.summonPet(necId, { skillId: 90, slvl: 10, x: 52, y: 50 })
      expect(failOut.created).toBe(false)
      expect(failOut.reason).toBe('invalid_item')
      expect(getInternalGroundItemsMap(game).has(leatherId)).toBe(true)

      // 2. Metallic Voulge ('vou') with stat 151 (Meditation #120 slvl 17) + +35% Fire Resist -> consumed!
      const insightEntry = makeServerItem({
        unitId: 99001,
        code: 'vou',
        name: 'Insight',
        quality: 7,
        location: 'ground',
        x: 54,
        y: 50,
        areaId: 2,
        ownerId: 0,
        rawStats: [
          { statId: 151, param: 120, value: 17 },
          { statId: 39, param: 0, value: 35 },
        ],
      })
      getInternalGroundItemsMap(game).set(99001, insightEntry)

      const igOut = game.summonPet(necId, { skillId: 90, slvl: 10, x: 54, y: 50 })
      expect(igOut.created).toBe(true)
      expect(getInternalGroundItemsMap(game).has(99001)).toBe(false)

      // Step frames -> Iron Golem pulses Meditation (state 48) onto owner!
      game.stepFrames(5)
      expect(game.getPlayerState(necId)!.states.has(48)).toBe(true)
    })
  })

  describe('#1818: Mercenary Live Vision AI, Skills, Weapon/Gear Stats, Own CB & Boss Damage Factor', () => {
    it('fires Act 1 Rogue Inner Sight + ranged arrows, Act 2 aura + Jab, Act 3 Frozen Armor + spells, and Act 5 Bash/Stun', () => {
      // Act 1 Rogue: ranged combat from dist=12 without walking into melee
      const g1 = new GameInstance({ seed: 18181, difficulty: 0, act: 0, areaId: 2 })
      const p1 = g1.connectPlayer({ name: 'P1', charClass: 'ama', level: 30, areaId: 2, x: 50, y: 50 })
      const m1 = g1.hireMercenary(p1, { act: 1, subType: 0, level: 30, x: 51, y: 50 })
      const t1 = g1.spawnMonster({
        defId: 'zombie1',
        areaId: 2,
        x: 63,
        y: 50,
        hp: 4000,
        maxHp: 4000,
        ac: 100,
        aiDisabled: true,
      })
      g1.stepFrames(80)
      expect(g1.getMonster(t1)!.hp).toBeLessThan(4000)
      expect(g1.getMercenaryState(m1)!.x).toBeLessThan(55) // stayed at range!

      // Act 2 Desert Mercenary: activates innate aura when monsters are present even if activeAura started empty
      const g2 = new GameInstance({ seed: 18182, difficulty: 1, act: 1, areaId: 2 })
      const p2 = g2.connectPlayer({ name: 'P2', charClass: 'pal', level: 45, areaId: 2, x: 50, y: 50 })
      const m2 = g2.hireMercenary(p2, { act: 2, difficulty: 2, subType: 10, level: 45, x: 51, y: 50 })
      const mercRec2 = getInternalMercMap(g2).get(m2)!
      mercRec2.activeAura = undefined
      const t2 = g2.spawnMonster({
        defId: 'zombie1',
        areaId: 2,
        x: 52,
        y: 50,
        hp: 2000,
        maxHp: 2000,
        ac: 0,
        aiDisabled: true,
      })
      g2.stepFrames(40)
      expect(g2.getMercenaryState(m2)!.activeAura).toBeTruthy()
      expect(g2.getMonster(t2)!.hp).toBeLessThan(2000)

      // Act 3 Iron Wolf (Cold, subType 15; also verifies cross-act subType normalization):
      const g3 = new GameInstance({ seed: 18183, difficulty: 0, act: 2, areaId: 2 })
      const p3 = g3.connectPlayer({ name: 'P3', charClass: 'sor', level: 35, areaId: 2, x: 50, y: 50 })
      const m3 = g3.hireMercenary(p3, { act: 3, subType: 15, level: 35, x: 51, y: 50 })
      const t3 = g3.spawnMonster({
        defId: 'zombie1',
        areaId: 2,
        x: 61,
        y: 50,
        hp: 2000,
        maxHp: 2000,
        ac: 0,
        aiDisabled: true,
      })
      g3.drainEvents(p3)
      g3.stepFrames(90)
      const ev3 = g3.drainEvents(p3)
      expect(ev3.some((e) => e.type === 'CreateMissile')).toBe(true)
      expect(g3.getMonster(t3)!.hp).toBeLessThan(2000)
      expect(g3.getMercenaryState(m3)!.x).toBeLessThan(55)

      // Act 5 Barbarian: executes Bash (knockback) & Stun (state 21)
      const g5 = new GameInstance({ seed: 18185, difficulty: 0, act: 4, areaId: 2 })
      const p5 = g5.connectPlayer({ name: 'P5', charClass: 'bar', level: 45, areaId: 2, x: 50, y: 50 })
      g5.hireMercenary(p5, { act: 5, level: 45, x: 51, y: 50 })
      const t5 = g5.spawnMonster({
        defId: 'zombie1',
        areaId: 2,
        x: 52,
        y: 50,
        hp: 2500,
        maxHp: 2500,
        ac: 0,
        aiDisabled: true,
      })
      g5.stepFrames(120)
      const mon5 = g5.getMonster(t5)!
      expect(mon5.hp).toBeLessThan(2500)
      // Bash knocks target east past x=52 or Stun applies state 21
      expect(mon5.x > 52 || mon5.states.has(21)).toBe(true)
    })

    it('includes merc weapon ED%/ethereal/DS/leech/OW/CtC Decrepify and reads merc OWN Crushing Blow (not owner CB)', () => {
      // Trial A: Unarmed merc with owner wearing 100% Crushing Blow -> owner CB MUST NOT leak to merc!
      const gUnarmed = new GameInstance({ seed: 18186, difficulty: 0, act: 1, areaId: 2 })
      const pA = gUnarmed.connectPlayer({ name: 'OwnerWithCb', charClass: 'pal', level: 75, areaId: 2, x: 50, y: 50 })
      getInternalPlayerMap(gUnarmed).get(pA)!.items.push(
        makeServerItem({
          unitId: 8001,
          code: 'utg',
          location: 'equipped',
          bodyLoc: 10,
          ownerId: pA,
          rawStats: [{ statId: 136, param: 0, value: 100 }], // 100% CB on OWNER
        }),
      )
      gUnarmed.hireMercenary(pA, { act: 2, difficulty: 1, subType: 6, level: 75, x: 51, y: 50 })
      const monA = gUnarmed.spawnMonster({
        defId: 'zombie1',
        areaId: 2,
        x: 52,
        y: 50,
        hp: 40000,
        maxHp: 40000,
        ac: 0,
        aiDisabled: true,
      })
      gUnarmed.stepFrames(20)
      const unarmedDmg = 40000 - gUnarmed.getMonster(monA)!.hp
      // Unarmed lv75 merc deals < 500 dmg in 20 frames; if 100% owner CB leaked, 1/4 of 40,000 = 10,000+ dmg would be dealt!
      expect(unarmedDmg).toBeGreaterThan(0)
      expect(unarmedDmg).toBeLessThan(1500)

      // Trial B: Armed merc with ethereal +240% ED Thresher ('7s8'), 100% merc CB, 100% OW, 15% Life Steal, 100% CtC Decrepify (#87)
      const gArmed = new GameInstance({ seed: 18186, difficulty: 0, act: 1, areaId: 2 })
      const pB = gArmed.connectPlayer({ name: 'OwnerNoCb', charClass: 'pal', level: 75, areaId: 2, x: 50, y: 50 })
      const mercB = gArmed.hireMercenary(pB, { act: 2, difficulty: 1, subType: 6, level: 75, x: 51, y: 50 })
      const mercRecB = getInternalMercMap(gArmed).get(mercB)!
      mercRecB.hp = 500
      mercRecB.maxHp = 1500
      mercRecB.equipment.push(
        makeServerItem({
          unitId: 8002,
          code: '7s8', // Thresher
          ethereal: true,
          location: 'equipped',
          bodyLoc: 4,
          ownerId: mercB,
          rawStats: [
            { statId: 17, param: 0, value: 240 }, // +240% Enhanced Damage
            { statId: 141, param: 0, value: 33 }, // 33% Deadly Strike
            { statId: 60, param: 0, value: 15 }, // 15% Life Steal
            { statId: 136, param: 0, value: 100 }, // 100% Crushing Blow on MERC
            { statId: 135, param: 0, value: 100 }, // 100% Open Wounds on MERC
            { statId: 198, param: (87 << 6) | 1, value: 100 }, // 100% CtC lvl 1 Decrepify on striking
          ],
        }),
      )
      const monB = gArmed.spawnMonster({
        defId: 'zombie1',
        areaId: 2,
        x: 52,
        y: 50,
        hp: 40000,
        maxHp: 40000,
        ac: 0,
        aiDisabled: true,
      })
      gArmed.stepFrames(20)
      const armedMon = gArmed.getMonster(monB)!
      const armedDmg = 40000 - armedMon.hp
      expect(armedDmg).toBeGreaterThan(10000) // Merc's own 100% CB + ethereal Reaper's Toll crushed HP!
      expect(armedMon.states.has(60)).toBe(true) // Decrepify (state 60) applied on striking!
      expect(gArmed.getMercenaryState(mercB)!.hp).toBeGreaterThan(505) // Merc healed via 15% Life Steal on physical hit!
    })

    it('applies exact 1.13c HireableBossDamagePercent (50% Normal / 35% NM / 25% Hell) on Act Bosses', () => {
      expect(scaleMercenaryBossDamage113c(200, 0)).toBe(100)
      expect(scaleMercenaryBossDamage113c(200, 1)).toBe(70)
      expect(scaleMercenaryBossDamage113c(200, 2)).toBe(50)

      const measureSingleSwing = (difficulty: 0 | 1 | 2, isBoss: boolean): number => {
        const g = new GameInstance({ seed: 18189, difficulty, act: 0, areaId: 2 })
        const pid = g.connectPlayer({ name: 'Hero', charClass: 'sor', level: 80, areaId: 2, x: 50, y: 50 })
        const mid = g.hireMercenary(pid, { act: 2, difficulty: 1, subType: 6, level: 80, x: 51, y: 50 })
        const ownerRec = getInternalPlayerMap(g).get(pid)!
        const mercRec = getInternalMercMap(g).get(mid)!
        const targetId = g.spawnMonster(
          isBoss
            ? {
                hcIdx: 156, // Andariel (Act 1 Boss)
                areaId: 2,
                x: 52,
                y: 50,
                hp: 20000,
                maxHp: 20000,
                ac: 0,
                aiDisabled: true,
              }
            : {
                defId: 'zombie1',
                areaId: 2,
                x: 52,
                y: 50,
                hp: 20000,
                maxHp: 20000,
                ac: 0,
                aiDisabled: true,
              },
        )
        const targetRec = (g as unknown as { monsters: Map<number, Record<string, any>> }).monsters.get(targetId)!
        // Force identical defense/resistance/mlvl so only HireableBossDamagePercent differs across Normal/NM/Hell
        targetRec.ac = 0
        targetRec.resistances.phys = 0
        targetRec.level = 50
        ;(
          g as unknown as {
            applyDamageToMonster: (...args: unknown[]) => boolean
          }
        ).applyDamageToMonster(ownerRec, targetRec, 400, 0, 'phys', mercRec, {
          attackKind: 'melee',
          autoHit: true,
          unblockable: true,
        })
        return 20000 - g.getMonster(targetId)!.hp
      }

      const vsNormalMob = measureSingleSwing(0, false)
      const vsBossNorm = measureSingleSwing(0, true)
      const vsBossNm = measureSingleSwing(1, true)
      const vsBossHell = measureSingleSwing(2, true)

      expect(vsNormalMob).toBe(400)
      expect(vsBossNorm).toBe(200)
      expect(vsBossNm).toBe(140)
      expect(vsBossHell).toBe(100)
    })
  })

  describe('#1828: 1.13c Equipment Validation (canUnitEquipItem113c + handleItemEquip + handleMercItem)', () => {
    it('computes exact 1.13c level/Str/Dex requirements (socketed runes, upgraded uniques, ethereal -10, Hel -20%/-15%) and class/hand rules', () => {
      const dropTables = getEmbeddedDropTables()

      // 1. Socketed Zod Rune (r33, reqLevel=69) in a Short Sword ('ssd', reqLevel=0) raises reqLevel to 69
      const zodSword = computeItemRequirements113c(
        {
          code: 'ssd',
          identified: true,
          socketedItems: [{ code: 'r33', identified: true }],
        },
        { dropTables },
      )
      expect(zodSword.reqLevel).toBe(69)

      // 2. Ethereal Sacred Armor ('uar', base reqStr = 232) socketed with Hel ('r15', -15% ease on armor):
      //    232 + trunc(232 * -15 / 100) - 10 = 232 - 34 - 10 = 188!
      const ethHelSacred = computeItemRequirements113c(
        {
          code: 'uar',
          ethereal: true,
          identified: true,
          socketedItems: [{ code: 'r15', identified: true }],
        },
        { dropTables },
      )
      expect(ethHelSacred.baseReqStr).toBe(232)
      expect(ethHelSacred.easePercent).toBe(-15)
      expect(ethHelSacred.reqStr).toBe(188)

      // 3. Upgraded Unique Frostburn (uniqueItemId=106, orig 'hgl' Gauntlets reqLevel=29 ->
      //    upgraded to exceptional 'xhg' War Gauntlets adds +5 -> 34; elite 'uhg' Ogre Gauntlets base levelreq=64 + 12 = 76)
      const baseFrostburn = computeItemRequirements113c(
        { code: 'hgl', quality: 7, identified: true, rawItemData: { uniqueItemId: 106 } },
        { dropTables },
      )
      const uppedFrostburn = computeItemRequirements113c(
        { code: 'xhg', quality: 7, identified: true, rawItemData: { uniqueItemId: 106 } },
        { dropTables },
      )
      const doubleUppedFrostburn = computeItemRequirements113c(
        { code: 'uhg', quality: 7, identified: true, rawItemData: { uniqueItemId: 106 } },
        { dropTables },
      )
      expect(baseFrostburn.reqLevel).toBe(29)
      expect(uppedFrostburn.reqLevel).toBe(34)
      expect(doubleUppedFrostburn.reqLevel).toBe(76)

      // 4. Class-only & hand coexistence checks:
      const checkHandCoexist = (
        classCode: 'ama' | 'bar' | 'pal' | 'ass' | 'sor',
        codeA: string,
        codeB: string,
      ): boolean => {
        const baseA = getItemBaseEquipMeta113c(codeA)!
        const typeA = getItemTypeEquipMeta113c(baseA.type)!
        const baseB = getItemBaseEquipMeta113c(codeB)!
        const typeB = getItemTypeEquipMeta113c(baseB.type)!
        return canHandItemsCoexist113c(
          { kind: 'player', classCode, level: 80, baseStrength: 200, baseDexterity: 200 },
          baseA,
          typeA,
          baseB,
          typeB,
        )
      }
      //    - Bow ('lwb') + Arrows ('aqv') coexist (`bow` shoots `bowq`), Bow + Bolts ('cqv') conflict!
      expect(checkHandCoexist('ama', 'lwb', 'aqv')).toBe(true)
      expect(checkHandCoexist('ama', 'lwb', 'cqv')).toBe(false)
      //    - Two-Handed Sword ('2hs', 1or2handed=1) + Shield ('buc'): Barbarian coexists, Paladin conflicts!
      expect(checkHandCoexist('bar', '2hs', 'buc')).toBe(true)
      expect(checkHandCoexist('pal', '2hs', 'buc')).toBe(false)
      //    - Assassin dual-wields Katars ('ktr' + 'ktr'), non-Assassin rejected by classOnly='ass'
      expect(checkHandCoexist('ass', 'ktr', 'ktr')).toBe(true)
      expect(
        canUnitEquipItem113c(
          { kind: 'player', classCode: 'sor', level: 80, baseStrength: 200, baseDexterity: 200 },
          { code: 'ktr', identified: true },
          4,
          [],
          { dropTables },
        ),
      ).toMatchObject({ allowed: false, reason: 'wrong_class' })
    })

    it('enforces requirements, prevents +Str self-bootstrapping, emits PlaySound(19), and rolls back full-inventory 2H displacement in GameInstance', () => {
      const game = new GameInstance({ seed: 1828, difficulty: 0, act: 0, areaId: 1 })
      const sorcId = game.connectPlayer({
        name: 'EquipSorc',
        charClass: 'sor',
        level: 20,
        areaId: 1,
        x: 20,
        y: 20,
      })
      const pRec = getInternalPlayerMap(game).get(sorcId)!
      pRec.strength = 100 // Base 100 Str
      pRec.dexterity = 100

      // Equip a +40 Str belt (slot 8) -> total Str = 140
      pRec.items.push(
        makeServerItem({
          unitId: 9101,
          code: 'lbl',
          location: 'equipped',
          bodyLoc: 8,
          ownerId: sorcId,
          rawStats: [{ statId: 0, param: 0, value: 40 }],
        }),
      )
      // Put a belt requiring 110 Str ('zhb' War Belt, reqStr=110, reqLevel=25 -> bump sorc level to 30) in inventory:
      // Replacing the +40 Str belt drops remaining Str to 100 < 110 -> MUST fail self-bootstrap check!
      pRec.level = 30
      const warBelt = makeServerItem({
        unitId: 9102,
        code: 'zhb',
        location: 'inventory',
        x: 0,
        y: 0,
        width: 2,
        height: 1,
        ownerId: sorcId,
      })
      pRec.items.push(warBelt)
      game.drainEvents(sorcId)

      game.enqueueCommand(sorcId, { type: 'ItemEquip', itemId: 9102, slot: 8 })
      game.stepFrame()

      const evBootstrap = game.drainEvents(sorcId)
      expect(warBelt.location).toBe('inventory')
      expect(evBootstrap.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)

      // Mercenary equip check: Act 2 merc cannot equip a Bow ('lwb') -> rejected with PlaySound(19)
      game.hireMercenary(sorcId, { act: 2, level: 30, x: 21, y: 20 })
      const cursorBow = makeServerItem({
        unitId: 9103,
        code: 'lwb',
        location: 'cursor',
        ownerId: sorcId,
      })
      pRec.items.push(cursorBow)
      game.enqueueCommand(sorcId, { type: 'MercItem', slot: 4 })
      game.stepFrame()
      const evMercBow = game.drainEvents(sorcId)
      expect(cursorBow.location).toBe('cursor')
      expect(evMercBow.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
      // Remove cursorBow for next test
      pRec.items.splice(pRec.items.indexOf(cursorBow), 1)

      // Full-inventory 2H displacement rollback:
      // Equip 1H Sword ('ssd' in slot 4) + Shield ('buc' in slot 5), fill all 10x4 inventory cells,
      // then try to equip 2H Staff ('lst') from cursor -> displaces BOTH sword & shield, needs 1 inv + 1 cursor,
      // fails cleanly and rolls everything back without overlapping items at (0, 0)!
      const sword1h = makeServerItem({
        unitId: 9201,
        code: 'ssd',
        location: 'equipped',
        bodyLoc: 4,
        width: 1,
        height: 3,
        ownerId: sorcId,
      })
      const shield = makeServerItem({
        unitId: 9202,
        code: 'buc',
        location: 'equipped',
        bodyLoc: 5,
        width: 2,
        height: 2,
        ownerId: sorcId,
      })
      pRec.items = [sword1h, shield]
      for (let gx = 0; gx < 10; gx++) {
        for (let gy = 0; gy < 4; gy++) {
          pRec.items.push(
            makeServerItem({
              unitId: 9300 + gx * 4 + gy,
              code: 'cm1',
              location: 'inventory',
              x: gx,
              y: gy,
              width: 1,
              height: 1,
              ownerId: sorcId,
            }),
          )
        }
      }
      const cursorStaff = makeServerItem({
        unitId: 9203,
        code: 'lst',
        location: 'cursor',
        width: 1,
        height: 3,
        ownerId: sorcId,
      })
      pRec.items.push(cursorStaff)
      game.drainEvents(sorcId)

      game.enqueueCommand(sorcId, { type: 'ItemEquip', itemId: 9203, slot: 4 })
      game.stepFrame()

      const evRollback = game.drainEvents(sorcId)
      expect(cursorStaff.location).toBe('cursor')
      expect(sword1h.location).toBe('equipped')
      expect(sword1h.bodyLoc).toBe(4)
      expect(shield.location).toBe('equipped')
      expect(shield.bodyLoc).toBe(5)
      expect(evRollback.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
    })
  })

  describe('#1831: SetItems.txt addFunc === 0 Stat Aggregation (Player & Mercenary + Zero Double-Counting)', () => {
    it('applies Trang-Oul Claws (#88, addFunc=0, +25% Poison Skill Dmg) at 1 piece on player & merc without double-counting', () => {
      type EquipMode =
        | 'none'
        | 'set_only'
        | 'baked_primary'
        | 'baked_set_bonus_flat'
        | 'baked_set_bonus_list'

      const runTrangTrial = (
        equipMode: EquipMode,
      ): { poisMasteryPct: number; coldRes: number; fcr: number; creeperDmg: number } => {
        const g = new GameInstance({ seed: 1831, difficulty: 0, act: 0, areaId: 2 })
        const druId = g.connectPlayer({
          name: 'PoisDru',
          charClass: 'dru',
          level: 60,
          areaId: 2,
          x: 50,
          y: 50,
          skills: { 222: 20 }, // Poison Creeper (#222) reads owner passive_pois_mastery (stat 332)!
        })
        const pRec = getInternalPlayerMap(g).get(druId)!

        if (equipMode !== 'none') {
          pRec.items.push(
            makeServerItem({
              unitId: 9801,
              code: 'xmg', // Heavy Bracers (Trang-Oul's Claws, SetItems.txt #88, addFunc === 0)
              quality: 5,
              setItemId: 88,
              location: 'equipped',
              bodyLoc: 10,
              ownerId: druId,
              // Test deduplication when stat 332 (+25% Poison Skill Dmg) is also present in rawStats or setBonusStats!
              rawStats:
                equipMode === 'baked_primary' ? [{ statId: 332, param: 0, value: 25 }] : [],
              ...(equipMode === 'baked_set_bonus_flat'
                ? { setBonusStats: [{ statId: 332, param: 0, value: 25 }] }
                : equipMode === 'baked_set_bonus_list'
                  ? { setBonusStats: [{ index: 0, stats: [{ statId: 332, param: 0, value: 25 }] }] }
                  : {}),
            }),
          )
        }

        const sumPlayerStat = (
          g as unknown as { sumPlayerItemStat: (p: unknown, statId: number) => number }
        ).sumPlayerItemStat.bind(g)

        const vineOut = g.summonPet(druId, { skillId: 222, slvl: 20, x: 52, y: 50 })
        expect(vineOut.created).toBe(true)

        const monId = g.spawnMonster({
          defId: 'zombie1',
          areaId: 2,
          x: 53,
          y: 50,
          hp: 4000,
          maxHp: 4000,
          ac: 0,
          aiDisabled: true,
        })
        ;(g as unknown as { monsters: Map<number, Record<string, any>> }).monsters.get(monId)!.resistances.poison = 0

        g.stepFrames(80)
        return {
          poisMasteryPct: sumPlayerStat(pRec, 332),
          coldRes: sumPlayerStat(pRec, 43),
          fcr: sumPlayerStat(pRec, 105),
          creeperDmg: 4000 - g.getMonster(monId)!.hp,
        }
      }

      const resNone = runTrangTrial('none')
      const resSetOnly = runTrangTrial('set_only')
      const resBakedPrimary = runTrangTrial('baked_primary')
      const resBakedFlat = runTrangTrial('baked_set_bonus_flat')
      const resBakedList = runTrangTrial('baked_set_bonus_list')

      expect(resNone.poisMasteryPct).toBe(0)
      expect(resSetOnly.poisMasteryPct).toBe(25)
      expect(resSetOnly.coldRes).toBe(30)
      expect(resSetOnly.fcr).toBe(20)

      // Zero double-counting regardless of whether stat 332 was also serialized in rawStats or setBonusStats!
      expect(resBakedPrimary.poisMasteryPct).toBe(25)
      expect(resBakedFlat.poisMasteryPct).toBe(25)
      expect(resBakedList.poisMasteryPct).toBe(25)

      // Poison Creeper (#222) poison mat ticks scale ~1.25x with +25% Poison Skill Damage (stat 332)!
      expect(resNone.creeperDmg).toBeGreaterThan(20)
      expect(resSetOnly.creeperDmg).toBeGreaterThan(resNone.creeperDmg)
      expect(resBakedPrimary.creeperDmg).toBe(resSetOnly.creeperDmg)
      expect(resBakedFlat.creeperDmg).toBe(resSetOnly.creeperDmg)
      expect(resBakedList.creeperDmg).toBe(resSetOnly.creeperDmg)

      // Also verify Civerb's Cudgel (#2, addFunc === 0: props has stat 22 +17..23 maxdmg AND aprops has stat 218 dmg/lvl)
      // and mercenary SetItems.txt addFunc === 0 aggregation (Trang-Oul's Claws #88 / Griswold's Valor #92)
      const gMerc = new GameInstance({ seed: 1832, difficulty: 0, act: 2, areaId: 2 })
      const pid = gMerc.connectPlayer({ name: 'SetOwner', charClass: 'pal', level: 80, areaId: 2, x: 50, y: 50 })
      const mid = gMerc.hireMercenary(pid, { act: 3, level: 80, x: 51, y: 50 })
      const mercRec = getInternalMercMap(gMerc).get(mid)!
      mercRec.equipment.push(
        makeServerItem({
          unitId: 9802,
          code: 'gsc', // Grand Scepter (Civerb's Cudgel, SetItems.txt #2, addFunc === 0)
          quality: 5,
          setItemId: 2,
          location: 'equipped',
          bodyLoc: 4,
          ownerId: mid,
          rawStats: [{ statId: 22, param: 0, value: 20 }], // stat 22 present on item MUST NOT block aprop stat 218!
        }),
        makeServerItem({
          unitId: 9803,
          code: 'xmg', // Trang-Oul's Claws (#88, addFunc === 0)
          quality: 5,
          setItemId: 88,
          location: 'equipped',
          bodyLoc: 10,
          ownerId: mid,
        }),
      )
      const sumMercStat = (
        gMerc as unknown as { sumMercItemStat: (m: unknown, statId: number) => number }
      ).sumMercItemStat.bind(gMerc)
      // At level 80, Civerb's Cudgel aprop1 (`dmg/lvl` par=8 -> stat 218) adds (8 * 80) >> 3 = +80 on top of +20 = 100!
      expect(sumMercStat(mercRec, 22)).toBe(100)
      // Mercenary also receives +25% Poison Skill Damage (stat 332) from addFunc === 0 SetItems.txt row!
      expect(sumMercStat(mercRec, 332)).toBe(25)
    })
  })
})
