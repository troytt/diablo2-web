/**
 * Issue #1996 — 1.13c Accrued Max-Vitals (`D2Common.#10913` / `#10186` / `#10578`) Server Parity:
 * - Potions (`hp*`, `mp*`, `rvs`, `rvl`) and `xyz` (`Potion of Life`, `0x6FD0B120`) clamp/scale against accrued max pools.
 * - Shrines (`1..5`: Refilling, Health, Mana, Health Exchange, Mana Exchange) and Wells (`0x6FC8A560`) use accrued max pools.
 * - Town resurrect (`handleRespawn`) and respec (`executePlayerRespec113c`) preserve inventory charm / passive accrued max pools.
 * - Elemental Absorb pre-damage heal (`SUNITDMG_AddLife` `0x6FCFB570`) clamps at accrued `D2Common.#10913`.
 * - Hit-recovery stun threshold (`SUNITDMG_CheckHitRecovery` `0x6FCFB948`) divides accrued `D2Common.#10913`, not base `maxHpFixed`.
 * - Succubus / Baal curse AI (`#310 Blood Mana` vs `#309 Defense Curse`) compares accrued `maxMana >= maxHp`.
 */

import { describe, expect, it } from 'vitest'
import { QUEST_FLAG_CUSTOM_5_113C, setQuestFlag113c } from '../../src/server/engine/quests-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import type {
  InternalMonsterRecord,
  InternalObjectRecord,
  InternalPlayerRecord,
  ServerItemEntry,
} from '../../src/server/engine/game-instance/types.ts'

const FIXED_ONE = 256

interface TestGameInternals {
  players: Map<number, InternalPlayerRecord>
  monsters: Map<number, InternalMonsterRecord>
  objects: Map<number, InternalObjectRecord>
  getPlayerAccruedMaxHpFixed(player: InternalPlayerRecord): number
  getPlayerAccruedMaxManaFixed(player: InternalPlayerRecord): number
  getPlayerAccruedMaxStaminaFixed(player: InternalPlayerRecord): number
  refreshPlayerAccruedMaxPools(
    player: InternalPlayerRecord,
    opts?: {
      fillHpIfAtBaseMax?: boolean
      fillManaIfAtBaseMax?: boolean
      fillStaminaIfAtBaseMax?: boolean
    },
  ): void
  handleBeltUse(player: InternalPlayerRecord, itemId: number, useOnMerc?: boolean): void
  applyShrineEffect(player: InternalPlayerRecord, code: number, shrineUnitId?: number): void
  operateWell113c(player: InternalPlayerRecord, obj: InternalObjectRecord): void
  handleRespawn(player: InternalPlayerRecord): void
  executePlayerRespec113c(player: InternalPlayerRecord): void
  maybeEnterPlayerHitRecovery(
    player: InternalPlayerRecord,
    dealtDamage: number,
    options?: { dmg256?: number; hitClass?: number | string; isPurePoison?: boolean },
  ): void
  resolveMonsterAttackOnPlayer(
    monster: InternalMonsterRecord,
    player: InternalPlayerRecord,
    swing?: {
      minDmg?: number
      maxDmg?: number
      elementType?: 'fire' | 'ltng' | 'cold' | 'pois' | 'mag'
      elemMin?: number
      elemMax?: number
      fromMissile?: boolean
      autoHit?: boolean
    },
  ): void
  tryCastMonsterSkill(
    monster: InternalMonsterRecord,
    target: { x: number; y: number },
    distance: number,
  ): boolean
}

function makeInventoryItem(
  unitId: number,
  code: string,
  statsEntries: Array<[number, number]> = [],
  location: ServerItemEntry['location'] = 'inventory',
  bodyLoc = 0,
): ServerItemEntry {
  const stats = new Map<number, number>(statsEntries)
  return {
    unitId,
    code,
    name: code,
    quality: 4,
    level: 20,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    location,
    bodyLoc,
    storePage: location === 'inventory' ? 1 : 0,
    quantity: 1,
    identified: true,
    ethereal: false,
    sockets: 0,
    stats,
    rawItemData: {
      id: unitId,
      code,
      name: code,
      quality: 'magic',
      level: 20,
      identified: true,
      gridX: 0,
      gridY: 0,
      width: 1,
      height: 1,
      container: location === 'equipped' ? 'equipment' : location === 'belt' ? 'belt' : 'inventory',
      location: location === 'equipped' ? 1 : location === 'belt' ? 2 : 0,
      bodyLoc,
      storePage: location === 'inventory' ? 1 : 0,
      stats: statsEntries.map(([statId, value]) => ({ statId, value })),
    },
  } as unknown as ServerItemEntry
}

describe('Issue #1996 — 1.13c Accrued Max-Vitals (D2Common.#10913 / #10186 / #10578) parity', () => {
  it('clamps hp*, mp*, rvs (35% of accrued max), rvl, and xyz (Potion of Life) against accrued max pools', () => {
    const game = new GameInstance({ seed: 199601, difficulty: 0, areaId: 1 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'VitalSorc',
      level: 20,
      x: 10,
      y: 10,
      areaId: 1,
    })
    const g = game as unknown as TestGameInternals
    const player = g.players.get(pid)!

    player.maxHpFixed = 100 * FIXED_ONE
    player.maxManaFixed = 100 * FIXED_ONE
    // Small charm granting +100 Life (stat 7) and +100 Mana (stat 9) -> accrued 200 HP / 200 Mana
    player.items.push(
      makeInventoryItem(9001, 'cm1', [
        [7, 100 * FIXED_ONE],
        [9, 100 * FIXED_ONE],
      ]),
    )
    g.refreshPlayerAccruedMaxPools(player)
    expect(g.getPlayerAccruedMaxHpFixed(player)).toBe(200 * FIXED_ONE)
    expect(g.getPlayerAccruedMaxManaFixed(player)).toBe(200 * FIXED_ONE)

    // 1) Super Healing (`hp5`, +320) & Super Mana (`mp5`, +500) when already above base 100 -> heals to 200, never clamps down to 100
    player.hpFixed = 150 * FIXED_ONE
    player.hp = 150
    player.manaFixed = 150 * FIXED_ONE
    player.mana = 150
    player.items.push(makeInventoryItem(9002, 'hp5', [], 'belt'))
    player.items.push(makeInventoryItem(9003, 'mp5', [], 'belt'))
    g.handleBeltUse(player, 9002)
    g.handleBeltUse(player, 9003)
    expect(player.hpFixed).toBe(200 * FIXED_ONE)
    expect(player.hp).toBe(200)
    expect(player.manaFixed).toBe(200 * FIXED_ONE)
    expect(player.mana).toBe(200)

    // 2) Regular Rejuvenation (`rvs`) heals 35% of accrued 200 (= +70), not 35% of base 100 (= +35)
    player.hpFixed = 110 * FIXED_ONE
    player.hp = 110
    player.manaFixed = 110 * FIXED_ONE
    player.mana = 110
    player.items.push(makeInventoryItem(9004, 'rvs', [], 'belt'))
    g.handleBeltUse(player, 9004)
    expect(player.hpFixed).toBe(180 * FIXED_ONE)
    expect(player.manaFixed).toBe(180 * FIXED_ONE)

    // 3) Full Rejuvenation (`rvl`) restores 100% of accrued 200 HP / 200 Mana
    player.hpFixed = 40 * FIXED_ONE
    player.manaFixed = 25 * FIXED_ONE
    player.items.push(makeInventoryItem(9005, 'rvl', [], 'belt'))
    g.handleBeltUse(player, 9005)
    expect(player.hpFixed).toBe(200 * FIXED_ONE)
    expect(player.manaFixed).toBe(200 * FIXED_ONE)

    // 4) Potion of Life (`xyz`): adds +20 to base maxHpFixed (120) while keeping accrued maxHp = 220 (120 base + 100 charm)
    setQuestFlag113c(player.questFlags, 'a3q1', QUEST_FLAG_CUSTOM_5_113C)
    player.items.push(makeInventoryItem(9006, 'xyz'))
    game.drainEvents(pid)
    g.handleBeltUse(player, 9006)
    expect(player.maxHpFixed).toBe(120 * FIXED_ONE)
    expect(player.maxHp).toBe(220)
    expect(player.hpFixed).toBe(220 * FIXED_ONE)
    const events = game.drainEvents(pid)
    const baseMaxStatEvt = events.find(
      (e) => e.type === 'UnitStatUpdate' && e.statId === 7,
    ) as { value?: number } | undefined
    expect(baseMaxStatEvt?.value).toBe(120 * FIXED_ONE)
  })

  it('uses accrued max pools for Shrines 1..5, Wells, Town Respawn, and Respec', () => {
    const game = new GameInstance({ seed: 199602, difficulty: 0, areaId: 2 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'ShrineSorc',
      level: 20,
      x: 15,
      y: 15,
      areaId: 2,
    })
    const g = game as unknown as TestGameInternals
    const player = g.players.get(pid)!

    player.maxHpFixed = 100 * FIXED_ONE
    player.maxManaFixed = 100 * FIXED_ONE
    player.maxStaminaFixed = 100 * FIXED_ONE
    player.items.push(
      makeInventoryItem(9101, 'cm1', [
        [7, 100 * FIXED_ONE],
        [9, 100 * FIXED_ONE],
        [11, 100 * FIXED_ONE],
      ]),
    )
    g.refreshPlayerAccruedMaxPools(player)

    // Refilling Shrine (Code 1)
    player.hpFixed = 50 * FIXED_ONE
    player.manaFixed = 50 * FIXED_ONE
    g.applyShrineEffect(player, 1)
    expect(player.hpFixed).toBe(200 * FIXED_ONE)
    expect(player.manaFixed).toBe(200 * FIXED_ONE)

    // Health Shrine (Code 2) & Mana Shrine (Code 3)
    player.hpFixed = 120 * FIXED_ONE
    player.manaFixed = 120 * FIXED_ONE
    g.applyShrineEffect(player, 2)
    g.applyShrineEffect(player, 3)
    expect(player.hpFixed).toBe(200 * FIXED_ONE)
    expect(player.manaFixed).toBe(200 * FIXED_ONE)

    // Health Exchange Shrine (Code 4) & Mana Exchange Shrine (Code 5) clamp at accrued 200, not base 100
    player.hpFixed = 100 * FIXED_ONE
    player.manaFixed = 0
    g.applyShrineEffect(player, 4) // takes 50 HP, adds 250 Mana -> clamps at 200
    expect(player.manaFixed).toBe(200 * FIXED_ONE)

    player.manaFixed = 100 * FIXED_ONE
    player.hpFixed = 50 * FIXED_ONE
    g.applyShrineEffect(player, 5) // takes 50 Mana, adds 250 HP -> clamps at 200
    expect(player.hpFixed).toBe(200 * FIXED_ONE)

    // Well (`operateWell113c`): activates when 110 < accrued 200 (even though 110 > base 100!) and heals +50% of 200 (= +100 -> 200)
    player.hpFixed = 110 * FIXED_ONE
    player.hp = 110
    player.manaFixed = 110 * FIXED_ONE
    player.mana = 110
    player.staminaFixed = 110 * FIXED_ONE
    player.stamina = 110
    const wellObj: InternalObjectRecord = {
      unitId: 8001,
      classId: 15,
      areaId: 2,
      x: 15,
      y: 15,
      mode: 0,
      isWaypoint: false,
      isShrine: false,
      shrineType: 0,
      destAreaId: undefined,
      portalOwnerId: undefined,
      isLocked: false,
      isSparkling: false,
      trapType: 0,
      shrineResetFrame: 0,
      wellCharges: 2,
      wellRegenFrames: [],
      useCount: 0,
    }
    g.objects.set(wellObj.unitId, wellObj)
    g.operateWell113c(player, wellObj)
    expect(wellObj.wellCharges).toBe(1)
    expect(player.hpFixed).toBe(200 * FIXED_ONE)
    expect(player.manaFixed).toBe(200 * FIXED_ONE)
    expect(player.staminaFixed).toBe(200 * FIXED_ONE)

    // Softcore town resurrect (`handleRespawn`) restores full accrued pools with charm active
    player.dead = true
    player.hpFixed = 0
    player.hp = 0
    player.manaFixed = 0
    player.mana = 0
    player.staminaFixed = 0
    player.stamina = 0
    g.handleRespawn(player)
    expect(player.dead).toBe(false)
    expect(player.hpFixed).toBe(200 * FIXED_ONE)
    expect(player.hp).toBe(200)
    expect(player.manaFixed).toBe(200 * FIXED_ONE)
    expect(player.staminaFixed).toBe(200 * FIXED_ONE)

    // Respec (`executePlayerRespec113c`) keeps charm +100 Life in `player.maxHp`
    player.vitality += 10
    player.maxHpFixed += 20 * FIXED_ONE
    player.hpFixed = 220 * FIXED_ONE
    g.executePlayerRespec113c(player)
    expect(player.maxHpFixed).toBe(100 * FIXED_ONE)
    expect(player.maxHp).toBe(200)
    expect(player.hpFixed).toBe(200 * FIXED_ONE)
  })

  it('uses accrued max life/mana for Absorb pre-heal, Hit Recovery threshold, and Succubus Blood Mana curse AI', () => {
    const game = new GameInstance({ seed: 199603, difficulty: 0, areaId: 2 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'CombatSorc',
      level: 25,
      x: 20,
      y: 20,
      areaId: 2,
    })
    const g = game as unknown as TestGameInternals
    const player = g.players.get(pid)!

    // Base: 100 HP / 80 Mana; Charm: +220 HP / +150 Mana -> Accrued: 320 HP / 230 Mana
    player.maxHpFixed = 100 * FIXED_ONE
    player.maxManaFixed = 80 * FIXED_ONE
    player.items.push(
      makeInventoryItem(9201, 'cm1', [
        [7, 220 * FIXED_ONE],
        [9, 150 * FIXED_ONE],
      ]),
    )
    // Equipped amulet granting +15 flat Fire Absorb (stat 143)
    player.items.push(makeInventoryItem(9202, 'amu', [[143, 15]], 'equipped', 2))
    g.refreshPlayerAccruedMaxPools(player, {
      fillHpIfAtBaseMax: true,
      fillManaIfAtBaseMax: true,
    })
    expect(player.maxHp).toBe(320)

    // 1) Hit Recovery (`SUNITDMG_CheckHitRecovery` `0x6FCFB948`):
    // 15 damage is >= 1/8 of base 100 HP (would stun if dividing base!),
    // but < 1/16 of accrued 320 HP (320 / 16 = 20) -> MUST NOT enter hit recovery (`mode = 4`)!
    player.mode = 1
    for (let i = 0; i < 20; i++) {
      g.maybeEnterPlayerHitRecovery(player, 15)
      expect(player.mode).not.toBe(4)
    }

    // 2) Elemental Absorb pre-damage heal (`SUNITDMG_AddLife` `0x6FCFB570`):
    // Start at 250 / 320 HP (already > base 100 HP!). A 10-fire-damage hit with 15 flat fire absorb
    // heals +10 HP before subtracting 0 remaining fire damage -> 260 HP (never clamped down to base 100!).
    player.hpFixed = 250 * FIXED_ONE
    player.hp = 250
    const fireId = game.spawnMonster({
      defId: 'fallen1',
      level: 10,
      minDmg: 0,
      maxDmg: 0,
      hp: 200,
      maxHp: 200,
      x: 21,
      y: 20,
      areaId: 2,
    })
    const fireMon = g.monsters.get(fireId)!
    g.resolveMonsterAttackOnPlayer(fireMon, player, {
      minDmg: 0,
      maxDmg: 0,
      elementType: 'fire',
      elemMin: 10,
      elemMax: 10,
      fromMissile: true,
      autoHit: true,
    })
    expect(player.hpFixed).toBe(260 * FIXED_ONE)

    // 3) Succubus curse AI (`#310 Blood Mana` state 114 when accrued `maxMana >= maxHp`):
    // Base has `maxMana (80) < maxHp (100)`, so boost charm mana by +180 so accrued Mana = 410 >= accrued HP = 320!
    player.items.push(makeInventoryItem(9203, 'cm1', [[9, 180 * FIXED_ONE]]))
    g.refreshPlayerAccruedMaxPools(player)
    expect(g.getPlayerAccruedMaxManaFixed(player)).toBeGreaterThan(
      g.getPlayerAccruedMaxHpFixed(player),
    )

    const succubusId = game.spawnMonster({
      defId: 'succubus1',
      level: 30,
      hp: 300,
      maxHp: 300,
      x: 22,
      y: 20,
      areaId: 2,
    })
    const succubus = g.monsters.get(succubusId)!
    succubus.skillCooldown = 0
    ;(succubus as unknown as { aiParams: number[] }).aiParams = [
      100, 100, 100, 100, 100, 100, 100, 100,
    ]
    ;(succubus as unknown as { skills: unknown }).skills = [
      { skill: 'Defense Curse', skillId: 309, mode: 'SC', level: 5 },
      { skill: 'Blood Mana', skillId: 310, mode: 'SC', level: 5 },
    ]
    g.tryCastMonsterSkill(succubus, { x: player.x, y: player.y }, 2)
    expect(player.states.has(114)).toBe(true)
    expect(player.states.has(113)).toBe(false)
  })
})
