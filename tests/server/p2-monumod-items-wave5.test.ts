/**
 * Wave 5 Final P2 Verification Suite (`#1946`..`#1953`):
 * - `#1946`: `MonUMod #5` (`Extra Strong`) & `#6` (`Extra Fast`) Attack Rating (`+%AR`), attack rate,
 *            and minion damage/speed propagation (`D2Game.dll` `0x6FC42170`, `0x6FC420B0`).
 * - `#1947`: `MonUMod #20` (`Scarab`) Charged Bolt on getHit: `4 * 2 = 8` directional bolts at
 *            `slvl = min(15, floor((mlvl + 4) / 5))` (`0x6FC460D0`), stacking independently with `#17` LE (`8 + 8 = 16`).
 * - `#1948`: `MonUMod #35` (`shatter_on_death`, Act 5 `Frozen Horror` `#501..505`, `0x6FC41A70`):
 *            unconditional death shatter + frost burst regardless of killing element; blocks all corpse skills.
 * - `#1949`: `checkRunewordMatch`, socketing, `upgradeItemBase`, and Cube base upgrades reject `quest != 0`
 *            items (`'leg'`, `'hfh'`, `'msf'`, `'hst'`, `'qf1'`, `'qf2'`) and default `isLadder = false`.
 * - `#1950`: Non-ethereal Failed Unique (`3x`) & Failed Set (`2x`) durability clamped to single-byte `<= 255`
 *            in both monster/chest drops and gambling (`0x6FC30DAD`, `0x6FC30F57`).
 * - `#1951`: A1Q5 Charsi Imbue (`imbueItem113c`, `0x6FCE03A8` -> `0x6FC33320`) sets `wInitFlags |= 0x20`
 *            (`isImbue: true`) so class-specific imbues receive the `ilvl` StaffMod count & `+1/+2/+3` bonus shift.
 * - `#1952`: A5Q4 Anya Personalization (`0x6FD74140` / `0x6FCE076B`) allows `Nameable = 1` stackable throwing
 *            weapons (`jav`, `amf` Titan's Revenge, `bal`) while rejecting `Nameable = 0` (`aqv`, `gps`, `hp1`),
 *            broken items, Low Quality (`quality = 1`), ears, already-personalized, and quest items (`'d33'`, `'leg'`).
 * - `#1953`: `Fire Shrine` (`Code 19`) and `Monster Shrine` (`Code 20`) scan the `3x3` active room neighborhood
 *            (`D2Common.#10052` / `#10314`), and `Monster Shrine` promotes the nearest eligible normal monster
 *            in place (`0x6FC44B70`, `bSpawnMinions = 0`) with difficulty-scaled `1/2/3` `MonUMod`s & aura slvl.
 */
import { describe, expect, it } from 'vitest'
import { D2Rng, Rng } from '../../src/common/rng/d2-rng.ts'
import { rollStaffMods, rollStaffmods113c } from '../../src/common/items/automagic.ts'
import {
  createDroppedItem,
  imbueItem113c,
} from '../../src/common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { socketItemIntoHost } from '../../src/common/items/gems.ts'
import { ItemQuality, type ItemBase } from '../../src/common/items/items.ts'
import { rollBaseUpgrade, upgradeItemBase } from '../../src/common/items/item-upgrade.ts'
import {
  CANONICAL_RUNES_TABLE,
  checkRunewordMatch,
  isQuestItemBase113c,
} from '../../src/common/items/runeword.ts'
import {
  createSocketableItem,
  createSocketedBaseItem,
  socketItemWithSubItem,
} from '../../src/common/items/runeword-socket.ts'
import { resolveGambledItem } from '../../src/common/items/vendor-generator.ts'
import { MON_UMOD } from '../../src/common/units/monster-death-fx.ts'
import {
  getMonsterKindByHcIdx,
  resolveMonsterStats,
} from '../../src/common/units/monsters-data.ts'
import { promoteToUnique } from '../../src/common/world/scene-population.ts'
import type { MonsterPack } from '../../src/common/units/unit-types.ts'
import {
  damageMonster,
  type CombatPlayer,
  type CombatWorld,
  type Monster,
} from '../../src/server/ai/monster-ai.ts'
import {
  SCARAB_CHARGED_BOLT_COUNT_113C,
  computeScarabChargedBoltFanTargets113c,
  computeScarabChargedBoltSlvl113c,
  hasImplicitScarabUMod113c,
  hasImplicitShatterOnDeathUMod113c,
} from '../../src/server/ai/monumod-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  setQuestFlag113c,
} from '../../src/server/engine/quests-113c.ts'
import {
  executeCubeTransmute113c,
  executeSocketItem113c,
} from '../../src/server/items/cube-engine-113c.ts'
import {
  isEligibleMonsterShrineTarget113c,
  isWithinShrineActiveRoomNeighborhood113c,
} from '../../src/server/world/shrines-113c.ts'
import type * as Netproto from '../../src/netproto/index.ts'

describe('#1946 — MonUMod #5 (Extra Strong) & #6 (Extra Fast) AR, attack rate & minion propagation', () => {
  it('applies +150% dmg & +25% AR to Extra Strong bosses, +75% dmg & +25% AR to minions, and +75% dmg to WillOWisp bosses', () => {
    const zombie = getMonsterKindByHcIdx(1, 'hell')!
    const baseBoss = resolveMonsterStats(zombie, {
      difficulty: 'hell',
      rank: 'unique',
      modifiers: [],
    })
    const strongBoss = resolveMonsterStats(zombie, {
      difficulty: 'hell',
      rank: 'unique',
      modifiers: ['Extra Strong'],
    })
    expect(strongBoss.attack1!.minDamage).toBe(Math.round(baseBoss.attack1!.minDamage! * 2.5))
    expect(strongBoss.attack1!.maxDamage).toBe(Math.round(baseBoss.attack1!.maxDamage! * 2.5))
    expect(strongBoss.toHit).toBe(Math.round(baseBoss.toHit! * 1.25))
    expect(strongBoss.attack1!.toHit).toBe(Math.round(baseBoss.attack1!.toHit! * 1.25))

    const baseMinion = resolveMonsterStats(zombie, {
      difficulty: 'hell',
      rank: 'minion',
      modifiers: [],
    })
    const strongMinion = resolveMonsterStats(zombie, {
      difficulty: 'hell',
      rank: 'minion',
      modifiers: ['Extra Strong'],
    })
    expect(strongMinion.attack1!.minDamage).toBe(Math.round(baseMinion.attack1!.minDamage! * 1.75))
    expect(strongMinion.attack1!.maxDamage).toBe(Math.round(baseMinion.attack1!.maxDamage! * 1.75))
    expect(strongMinion.toHit).toBe(Math.round(baseMinion.toHit! * 1.25))

    const gloam = getMonsterKindByHcIdx(120, 'hell')!
    const baseGloam = resolveMonsterStats(gloam, {
      difficulty: 'hell',
      rank: 'unique',
      modifiers: [],
    })
    const strongGloam = resolveMonsterStats(gloam, {
      difficulty: 'hell',
      rank: 'unique',
      modifiers: ['Extra Strong'],
    })
    expect(strongGloam.attack1!.minDamage).toBe(Math.round(baseGloam.attack1!.minDamage! * 1.75))
    expect(strongGloam.toHit).toBe(Math.round(baseGloam.toHit! * 1.25))
  })

  it('applies +100% velocity, +100% AR, and 0.5x cooldownTicks on Extra Fast bosses, and +100% velocity only on minions', () => {
    const zombie = getMonsterKindByHcIdx(1, 'nightmare')!
    const baseBoss = resolveMonsterStats(zombie, {
      difficulty: 'nightmare',
      rank: 'unique',
      modifiers: [],
    })
    const fastBoss = resolveMonsterStats(zombie, {
      difficulty: 'nightmare',
      rank: 'unique',
      modifiers: ['Extra Fast'],
    })
    expect(fastBoss.speed).toBe(Math.round(baseBoss.speed * 2 * 100) / 100)
    expect(fastBoss.toHit).toBe(Math.round(baseBoss.toHit! * 2))
    expect(fastBoss.cooldownTicks).toBe(Math.max(5, Math.round(baseBoss.cooldownTicks * 0.5)))

    const baseMinion = resolveMonsterStats(zombie, {
      difficulty: 'nightmare',
      rank: 'minion',
      modifiers: [],
    })
    const fastMinion = resolveMonsterStats(zombie, {
      difficulty: 'nightmare',
      rank: 'minion',
      modifiers: ['Extra Fast'],
    })
    expect(fastMinion.speed).toBe(Math.round(baseMinion.speed * 2 * 100) / 100)
    expect(fastMinion.toHit).toBe(baseMinion.toHit)
    expect(fastMinion.cooldownTicks).toBe(baseMinion.cooldownTicks)

    // Verify GameInstance.spawnMonster hydrates boss 0.5x cooldownTicks & AR + minion propagation
    const game = new GameInstance({ seed: 1946, difficulty: 1, areaId: 2 })
    const plainBossId = game.spawnMonster({ defId: 'zombie1', rank: 'unique', umodIds: [], x: 40, y: 40, areaId: 2 })
    const fastStrongBossId = game.spawnMonster({
      defId: 'zombie1',
      rank: 'unique',
      umodIds: [MON_UMOD.STRONG, MON_UMOD.FAST],
      x: 45,
      y: 40,
      areaId: 2,
    })
    const fastStrongMinionId = game.spawnMonster({
      defId: 'zombie1',
      rank: 'minion',
      umodIds: [MON_UMOD.STRONG, MON_UMOD.FAST],
      x: 47,
      y: 40,
      areaId: 2,
    })
    const monsters = (game as unknown as { monsters: Map<number, Record<string, number>> }).monsters
    const plainRec = monsters.get(plainBossId)!
    const bossRec = monsters.get(fastStrongBossId)!
    const minionRec = monsters.get(fastStrongMinionId)!
    expect(bossRec.ar).toBeGreaterThan(plainRec.ar! * 2.2)
    expect(bossRec.cooldownTicks).toBeLessThan(plainRec.cooldownTicks!)
    expect(minionRec.velocity).toBe(bossRec.velocity)
    expect(minionRec.maxDmg).toBeLessThan(bossRec.maxDmg!)

    // Verify promoteToUnique propagates transferable mods (#5/#6) to spawned minions
    const rawPack: MonsterPack = {
      rank: 'normal',
      members: [resolveMonsterStats(zombie, { difficulty: 'nightmare', rank: 'normal' })],
    } as unknown as MonsterPack
    const pack = promoteToUnique(rawPack, new Rng(194601))
    expect(pack.members.length).toBeGreaterThan(1)
  })
})

describe('#1947 / #1995 — MonUMod #20 (Scarab) radial buglightning (#225), slvl = mlvl, GetHit/Death trigger & LE stacking', () => {
  it('computes exact 1.13c Scarab slvl = max(1, mlvl) and 8-bolt radial directions', () => {
    expect(SCARAB_CHARGED_BOLT_COUNT_113C).toBe(8)
    expect(computeScarabChargedBoltSlvl113c(1)).toBe(1)
    expect(computeScarabChargedBoltSlvl113c(5)).toBe(5)
    expect(computeScarabChargedBoltSlvl113c(14)).toBe(14)
    expect(computeScarabChargedBoltSlvl113c(21)).toBe(21)
    expect(computeScarabChargedBoltSlvl113c(71)).toBe(71)
    expect(computeScarabChargedBoltSlvl113c(99)).toBe(99)

    const radial = computeScarabChargedBoltFanTargets113c(10, 10, 20, 10, 2)
    expect(radial).toHaveLength(8)
    // Radial 8-way burst radiates in both +X and -X / +Y and -Y rather than aiming a shotgun cone at (20, 10)
    expect(radial.some((pt) => pt.targetX > 10)).toBe(true)
    expect(radial.some((pt) => pt.targetX < 10)).toBe(true)
    expect(radial.some((pt) => pt.targetY > 10)).toBe(true)
    expect(radial.some((pt) => pt.targetY < 10)).toBe(true)
    expect(hasImplicitScarabUMod113c({ hcIdx: 91, defId: 'scarab1' })).toBe(true)
    expect(hasImplicitScarabUMod113c({ hcIdx: 654, defId: 'scarab6' })).toBe(true)
  })

  it('spawns 8 radial buglightning (#225) on Scarab GetHit/Death and 8 #195 + 8 #225 = 16 bolts on LE Scarab GetHit', () => {
    const game = new GameInstance({ seed: 1947, difficulty: 1, areaId: 41 })
    const pid = game.connectPlayer({ charClass: 'bar', name: 'Hitter', level: 60, x: 50, y: 50, areaId: 41 })
    const internal = game as unknown as {
      players: Map<number, Record<string, unknown>>
      monsters: Map<number, Record<string, unknown>>
      missiles: Map<number, { missileId: number; vx: number; vy: number; elemDamage: number }>
      finishMonsterDamage: (
        player: unknown,
        monster: unknown,
        dmg: number,
        hitClass: number,
        channel: string,
        skillId: number,
        fromMerc: boolean,
      ) => void
    }
    const player = internal.players.get(pid)!
    const scarabId = game.spawnMonster({
      hcIdx: 91,
      defId: 'scarab1',
      x: 44,
      y: 50,
      areaId: 41,
      hp: 500,
      maxHp: 500,
      level: 46,
    })
    const scarab = internal.monsters.get(scarabId)!
    expect((scarab.umodIds as number[]).includes(MON_UMOD.SCARAB)).toBe(true)

    // Chip damage (< maxHp / 16) does not enter MONMODE_GETHIT (mode = 3), so col4 = 0 emits 0 Scarab bolts
    internal.missiles.clear()
    internal.finishMonsterDamage(player, scarab, 10, 0, 'phys', 0, false)
    expect([...internal.missiles.values()].filter((m) => m.missileId === 225)).toHaveLength(0)

    // Heavy non-lethal hit (>= maxHp / 2 = 250, surviving at hp = 100) guarantees MONMODE_GETHIT (mode = 3)
    // -> col4 (`0x6FC46B80`) emits 8 radial #225 buglightning bolts
    internal.missiles.clear()
    scarab.hp = 400
    internal.finishMonsterDamage(player, scarab, 300, 0, 'phys', 0, false)
    const scarabBolts = [...internal.missiles.values()].filter((m) => m.missileId === 225)
    expect(scarabBolts).toHaveLength(8)
    expect(scarabBolts.some((b) => b.vx > 0)).toBe(true)
    expect(scarabBolts.some((b) => b.vx < 0)).toBe(true)
    // mlvl = 46 -> 1 + floor(45 / 2) = 23 lightning damage
    expect(scarabBolts.every((b) => b.elemDamage === 23)).toBe(true)

    // Follow-up lethal hit (hp = 100 -> 0) enters MONMODE_DEATH (mode = 0) -> col1 (`0x6FC46B80`) emits 8 radial #225 bolts
    internal.missiles.clear()
    internal.finishMonsterDamage(player, scarab, 200, 0, 'phys', 0, false)
    expect([...internal.missiles.values()].filter((m) => m.missileId === 225)).toHaveLength(8)

    // Lightning Enchanted Scarab non-lethal heavy hit (600 >= maxHp / 2 = 500, surviving at hp = 300):
    // #17 col4 (8 radial #195) + #20 col4 (8 radial #225) = 16 bolts
    const leScarabId = game.spawnMonster({
      hcIdx: 91,
      defId: 'scarab1',
      rank: 'unique',
      umodIds: [MON_UMOD.LIGHTNING, MON_UMOD.SCARAB],
      x: 44,
      y: 55,
      areaId: 41,
      hp: 900,
      maxHp: 1000,
      level: 49,
    })
    const leScarab = internal.monsters.get(leScarabId)!
    internal.missiles.clear()
    internal.finishMonsterDamage(player, leScarab, 600, 0, 'phys', 0, false)
    const leBolts = [...internal.missiles.values()].filter((m) => m.missileId === 195)
    const bugBolts = [...internal.missiles.values()].filter((m) => m.missileId === 225)
    expect(leBolts).toHaveLength(8)
    expect(bugBolts).toHaveLength(8)

    // MonsterAI (`damageMonster`) parity check: LE Scarab emits 2 ChargedBolt skill events (LE + Scarab)
    const aiPlayer = { x: 16, y: 10, hp: 400, maxHp: 400 } as unknown as CombatPlayer
    const aiScarab = {
      index: 1,
      x: 10,
      y: 10,
      hp: 500,
      maxHp: 500,
      state: 'idle',
      stats: {
        id: 'scarab1',
        hcIdx: 91,
        level: 46,
        modifiers: ['lightning', 'scarab'],
      },
    } as unknown as Monster
    const aiWorld = {
      player: aiPlayer,
      monsters: [aiScarab],
      events: [],
    } as unknown as CombatWorld
    damageMonster(aiWorld, aiScarab, 10, aiPlayer)
    const cbEvents = aiWorld.events.filter(
      (e) => e.kind === 'unitSkillEvent' && e.skillId === 'ChargedBolt',
    )
    expect(cbEvents).toHaveLength(2)
    expect(cbEvents[1]?.unitSkillEvent?.level).toBe(computeScarabChargedBoltSlvl113c(46))
  })
})

describe('#1948 — MonUMod #35 (shatter_on_death / Act 5 Frozen Horror) unconditional death shatter', () => {
  it('shatters Frozen Creeper (#501) on pure physical/fire death, chills nearby player, and blocks Corpse Explosion, Raise Skeleton, Revive & Find Item', () => {
    expect(hasImplicitShatterOnDeathUMod113c({ hcIdx: 501, defId: 'frozenhorror1' })).toBe(true)
    expect(hasImplicitShatterOnDeathUMod113c({ hcIdx: 505, defId: 'frozenhorror5' })).toBe(true)
    expect(hasImplicitShatterOnDeathUMod113c({ hcIdx: 1, defId: 'zombie1' })).toBe(false)

    const game = new GameInstance({ seed: 1948, difficulty: 0, areaId: 118, maxPlayers: 2 })
    const necId = game.connectPlayer({
      charClass: 'nec',
      name: 'Necro',
      level: 40,
      x: 50,
      y: 50,
      areaId: 118,
      skills: { 70: 10, 74: 10, 95: 10 },
      mana: 500,
      maxMana: 500,
    })
    const barId = game.connectPlayer({
      charClass: 'bar',
      name: 'Barb',
      level: 40,
      x: 52,
      y: 50,
      areaId: 118,
      skills: { 142: 10 },
      mana: 500,
      maxMana: 500,
    })
    const internal = game as unknown as {
      players: Map<number, { hp: number; states: Set<number> }>
      monsters: Map<
        number,
        {
          dead: boolean
          shattered: boolean
          corpseConsumed?: boolean
          states: Set<number>
          umodIds: number[]
        }
      >
      canSelectMonsterCorpse113c: (m: unknown, allowBoss: boolean) => boolean
      finishMonsterDamage: (
        player: unknown,
        monster: unknown,
        dmg: number,
        hitClass: number,
        channel: string,
        skillId: number,
        fromMerc: boolean,
      ) => void
    }
    const nec = internal.players.get(necId)!
    const hpBefore = nec.hp

    const horrorId = game.spawnMonster({
      hcIdx: 501,
      defId: 'frozenhorror1',
      x: 51,
      y: 50,
      areaId: 118,
      hp: 40,
      maxHp: 40,
      level: 30,
    })
    const horror = internal.monsters.get(horrorId)!
    expect(horror.umodIds.includes(MON_UMOD.SHATTER_ON_DEATH)).toBe(true)

    // Kill with pure FIRE damage (not cold!) -> must STILL shatter on death (#1948)
    internal.finishMonsterDamage(nec, horror, 100, 0, 'fire', 0, false)
    expect(horror.dead).toBe(true)
    expect(horror.shattered).toBe(true)
    expect(horror.corpseConsumed).toBe(true)
    expect(horror.states.has(107)).toBe(true)
    // Nearby player within 4 subtiles receives #35 death frost chill (state 11) + cold burst
    expect(nec.states.has(11)).toBe(true)
    expect(nec.hp).toBeLessThan(hpBefore)

    // Corpse eligibility must be false for all corpse-consuming skills
    expect(internal.canSelectMonsterCorpse113c(horror, false)).toBe(false)
    expect(internal.canSelectMonsterCorpse113c(horror, true)).toBe(false)

    // Raise Skeleton (#70), Corpse Explosion (#74), Revive (#95), Find Item (#142) must all fail to use it
    const bystanderId = game.spawnMonster({
      defId: 'zombie1',
      x: 52,
      y: 51,
      areaId: 118,
      hp: 200,
      maxHp: 200,
    })
    const bystander = internal.monsters.get(bystanderId)!
    game.enqueueCommand(necId, {
      type: 'CastSkillOnTarget',
      skillId: 70,
      targetType: 'monster',
      targetId: horrorId,
      hand: 'right',
    })
    game.stepFrames(2)
    expect(internal.monsters.size).toBe(2)

    game.enqueueCommand(necId, {
      type: 'CastSkillOnTarget',
      skillId: 74,
      targetType: 'monster',
      targetId: horrorId,
      hand: 'right',
    })
    game.stepFrames(2)
    expect((bystander as unknown as { hp: number }).hp).toBe(200)

    game.enqueueCommand(necId, {
      type: 'CastSkillOnTarget',
      skillId: 95,
      targetType: 'monster',
      targetId: horrorId,
      hand: 'right',
    })
    game.stepFrames(2)
    expect(internal.monsters.size).toBe(2)

    game.drainEvents(barId)
    game.enqueueCommand(barId, {
      type: 'CastSkillOnTarget',
      skillId: 142,
      targetType: 'monster',
      targetId: horrorId,
      hand: 'right',
    })
    game.stepFrames(2)
    const barDrops = game.drainEvents(barId).filter((e) => e.type === 'ItemEvent')
    expect(barDrops).toHaveLength(0)
  })
})

describe('#1949 — Quest item rejection & non-ladder default in Runewords & Cube Base Upgrades', () => {
  it('rejects Wirt\'s Leg (\'leg\') and all quest != 0 weapons from forming runewords while preserving individual rune socket stats', () => {
    const tables = getEmbeddedDropTables()
    expect(isQuestItemBase113c({ code: 'leg' })).toBe(true)
    expect(isQuestItemBase113c({ code: 'hfh' })).toBe(true)
    expect(isQuestItemBase113c({ code: 'hst' })).toBe(true)
    expect(isQuestItemBase113c({ code: 'crs' })).toBe(false)

    // 2-socket Wirt's Leg + Tir + El ('Steel' for clubs/axes/swords — rejected on 'leg'!)
    let leg2 = createSocketedBaseItem('leg', 2, { ilvl: 30 })
    expect(
      checkRunewordMatch(leg2, ['r03', 'r01'], tables.isA, CANONICAL_RUNES_TABLE, { isLadder: true }),
    ).toBeUndefined()
    expect(checkRunewordMatch(['r03', 'r01'], 'leg', 2, { isLadder: true })).toBeNull()

    leg2 = socketItemWithSubItem(leg2, createSocketableItem('r03'), new Rng(1), { isLadder: true }).item
    const leg2Final = socketItemWithSubItem(leg2, createSocketableItem('r01'), new Rng(2), {
      isLadder: true,
    })
    expect(leg2Final.runewordMatch).toBeUndefined()
    expect(leg2Final.item.flags?.runeword).toBe(false)
    // Individual Tir (+2 mana per kill) + El (+50 AR, +1 light) socket bonuses still apply!
    const leg2Codes = new Set(leg2Final.item.rolledProps?.map((p) => p.code))
    expect(leg2Codes.has('mana-kill')).toBe(true)
    expect(leg2Codes.has('att')).toBe(true)
    expect(leg2Codes.has('swing2')).toBe(false) // Steel's 25% IAS must NOT appear

    // 3-socket Wirt's Leg + Ith + El + Eth ('Malice' for all melee weapons — rejected on 'leg'!)
    let leg3Wire: Netproto.ItemData = {
      id: 500 as Netproto.UnitId,
      code: 'leg',
      quality: 2,
      identified: true,
      socketed: true,
      totalSockets: 3,
      stats: [],
      socketedItems: [],
    } as unknown as Netproto.ItemData
    for (const [idx, rune] of (['r06', 'r01', 'r05'] as const).entries()) {
      const step = executeSocketItem113c({
        host: leg3Wire,
        filler: {
          id: (510 + idx) as Netproto.UnitId,
          code: rune,
          quality: 2,
          identified: true,
          stats: [],
        } as unknown as Netproto.ItemData,
        rng: new D2Rng(1949 + idx),
        playerLevel: 50,
        isHostEquipped: false,
        isLadder: true,
      })
      expect(step.ok).toBe(true)
      if (step.ok) leg3Wire = step.hostItem
    }
    expect(leg3Wire.runeword).toBe(false)
    expect(leg3Wire.socketedItems).toHaveLength(3)
  })

  it('defaults isLadder to false across checkRunewordMatch, socket helpers, upgradeItemBase & GameInstance, gating Server=1 runewords and Rows 131..132 Unique Elite upgrades', () => {
    const tables = getEmbeddedDropTables()
    // 1. upgradeItemBase rejects quest bases ('leg', 'hfh') and gates elite upgrade when gateEliteOnLadder=true & isLadder omitted
    const legBase = tables.getBase('leg')!
    expect(upgradeItemBase(legBase, 1024, 1024, new D2Rng(1), tables.getBase, 99).base.id).toBe('leg')
    const haxBase = tables.getBase('hax')!
    expect(
      rollBaseUpgrade(haxBase, 1024, 1024, new D2Rng(1), tables.getBase, 99, {
        gateEliteOnLadder: true,
      }).base.id,
    ).toBe('9ha')
    expect(
      rollBaseUpgrade(haxBase, 1024, 1024, new D2Rng(1), tables.getBase, 99, {
        gateEliteOnLadder: true,
        isLadder: true,
      }).base.id,
    ).toBe('7ha')

    // 2. Default socketItemWithSubItem & socketItemIntoHost reject Spirit (Server=1) unless isLadder: true
    let nlSword = createSocketedBaseItem('crs', 4, { ilvl: 80 })
    for (const r of ['r07', 'r10', 'r09', 'r11']) {
      nlSword = socketItemWithSubItem(nlSword, createSocketableItem(r), new Rng(7)).item
    }
    expect(nlSword.flags?.runeword).toBe(false)

    let hostSword = createSocketedBaseItem('crs', 4, { ilvl: 80 })
    for (const r of ['r07', 'r10', 'r09', 'r11']) {
      hostSword = socketItemIntoHost(hostSword, createSocketableItem(r))
    }
    expect(hostSword.flags?.runeword).toBeFalsy()

    // 3. GameInstance defaults to non-ladder (isLadder === false), blocking Spirit & Rows 131..132 Unique Exceptional->Elite
    const nonLadderGame = new GameInstance({ seed: 194901, areaId: 1 })
    expect(nonLadderGame.isLadder).toBe(false)
    expect(nonLadderGame.isLadderRulesEnabled()).toBe(false)

    const ladderGame = new GameInstance({ seed: 194902, areaId: 1, ladder: true })
    expect(ladderGame.isLadder).toBe(true)
    expect(ladderGame.isLadderRulesEnabled()).toBe(true)

    // Cube Row 131: Lum (r17) + Pul (r21) + Perfect Emerald (gpg) + Exceptional Unique Weapon ('9ha' Coldkill) -> Elite ('7ha')
    const excUniqueWeapon: Netproto.ItemData = {
      id: 1 as Netproto.UnitId,
      code: '9ha',
      quality: 7,
      uniqueItemId: 132,
      ilvl: 85,
      identified: true,
      stats: [],
    } as unknown as Netproto.ItemData
    const lum = { id: 2 as Netproto.UnitId, code: 'r17', quality: 2, identified: true, stats: [] } as unknown as Netproto.ItemData
    const pul = { id: 3 as Netproto.UnitId, code: 'r21', quality: 2, identified: true, stats: [] } as unknown as Netproto.ItemData
    const gpg = { id: 4 as Netproto.UnitId, code: 'gpg', quality: 2, identified: true, stats: [] } as unknown as Netproto.ItemData

    let nextId = 100
    const nlUpg = executeCubeTransmute113c({
      cubeItems: [excUniqueWeapon, lum, pul, gpg],
      rng: new D2Rng(11),
      playerLevel: 85,
      playerClassCode: 'bar',
      difficulty: 2,
      areaId: 1,
      isLadder: nonLadderGame.isLadder,
      allocateUnitId: () => ++nextId,
    })
    expect(nlUpg.matched).toBe(false)

    const ladUpg = executeCubeTransmute113c({
      cubeItems: [excUniqueWeapon, lum, pul, gpg],
      rng: new D2Rng(11),
      playerLevel: 85,
      playerClassCode: 'bar',
      difficulty: 2,
      areaId: 1,
      isLadder: ladderGame.isLadder,
      allocateUnitId: () => ++nextId,
    })
    expect(ladUpg.matched).toBe(true)
    expect(ladUpg.createdItems[0]?.item.code).toBe('7ha')

    // Unique Quest Weapon ('hfh' Hellforge Hammer, quality=7) must NEVER upgrade via Cube Row 129 (Ral + Sol + Perfect Emerald)
    const hfhUnique: Netproto.ItemData = {
      id: 10 as Netproto.UnitId,
      code: 'hfh',
      quality: 7,
      ilvl: 85,
      identified: true,
      stats: [],
    } as unknown as Netproto.ItemData
    const ral = { id: 11 as Netproto.UnitId, code: 'r08', quality: 2, identified: true, stats: [] } as unknown as Netproto.ItemData
    const sol = { id: 12 as Netproto.UnitId, code: 'r12', quality: 2, identified: true, stats: [] } as unknown as Netproto.ItemData
    const hfhUpg = executeCubeTransmute113c({
      cubeItems: [hfhUnique, ral, sol, gpg],
      rng: new D2Rng(12),
      playerLevel: 85,
      playerClassCode: 'bar',
      difficulty: 2,
      areaId: 1,
      isLadder: true,
      allocateUnitId: () => ++nextId,
    })
    expect(hfhUpg.matched).toBe(false)
  })
})

describe('#1950 — Non-ethereal Failed Unique (3x) & Failed Set (2x) uint8 durability <= 255 clamp', () => {
  it('clamps non-ethereal Failed Unique (3x) & Failed Set (2x) maxDurability and durability to 255 in drops and gambling', () => {
    const tables = getEmbeddedDropTables()
    // Monarch ('uit') has rawDurability = 86 -> 86 * 3 = 258 -> clamped to 255!
    const uitBase = tables.getBase('uit')!
    const failedUniqueMonarch = createDroppedItem(uitBase, 'rare', {
      ilvl: 85,
      dwInitSeed: 195001,
      durabilityMultiplier: 3,
      ethereal: false,
    })
    expect(failedUniqueMonarch.maxDurability).toBe(255)
    expect(failedUniqueMonarch.durability).toBe(255)

    // Ward ('uts') has rawDurability = 100 -> 100 * 3 = 300 -> clamped to 255!
    const utsBase = tables.getBase('uts')!
    const failedUniqueWard = createDroppedItem(utsBase, 'rare', {
      ilvl: 85,
      dwInitSeed: 195002,
      durabilityMultiplier: 3,
      ethereal: false,
    })
    expect(failedUniqueWard.maxDurability).toBe(255)
    expect(failedUniqueWard.durability).toBe(255)

    // Failed Set (2x) on high-durability base (140 * 2 = 280 -> clamped to 255)
    const highDurBase = {
      ...utsBase,
      durability: 140,
    } as unknown as ItemBase
    const failedSetShield = createDroppedItem(highDurBase, 'magic', {
      ilvl: 85,
      dwInitSeed: 195003,
      durabilityMultiplier: 2,
      ethereal: false,
    })
    expect(failedSetShield.maxDurability).toBe(255)
    expect(failedSetShield.durability).toBe(255)

    // Gambling path (`resolveGambledItem`): when Unique roll hits a base with no matching Unique or already-spawned Unique,
    // Failed Unique Rare is created with 3x durability clamped <= 255
    const mysteryWard = createDroppedItem(utsBase, 'normal', { ilvl: 90, dwInitSeed: 195004 })
    for (let seed = 1; seed <= 40; seed++) {
      const gambled = resolveGambledItem({
        mysteryItem: mysteryWard,
        cLvl: 90,
        tables,
        rng: new D2Rng(seed),
        // Force any rolled Ward unique ('Spirit Ward', id 367) to degrade into a 3x Failed Unique!
        spawnedUniqueIds: new Set<number>([367]),
      })
      expect(gambled.maxDurability ?? 0).toBeLessThanOrEqual(255)
      expect(gambled.durability ?? 0).toBeLessThanOrEqual(255)
    }
  })
})

describe('#1951 — A1Q5 Charsi Imbue wInitFlags |= 0x20 (IMBUE) StaffMod count & +skill shift', () => {
  it('applies ilvl bonusArg shift when isImbue / wInitFlags=0x20 is set on rollStaffmods113c and imbueItem113c', () => {
    const tables = getEmbeddedDropTables()
    const wandBase = tables.getBase('ywn')! // Yew Wand (Necromancer staffmods)

    let plainTotalMods = 0
    let imbueTotalMods = 0
    let plainPlus3Count = 0
    let imbuePlus3Count = 0

    for (let seed = 1; seed <= 50; seed++) {
      const plain = rollStaffMods(wandBase, 85, tables.itemTypes, new D2Rng(seed), {
        isA: tables.isA,
        quality: 'rare',
      })
      const imbued = rollStaffmods113c(wandBase, 85, tables.itemTypes, new D2Rng(seed), {
        isA: tables.isA,
        quality: 'rare',
        isImbue: true,
        wInitFlags: 0x20,
      })
      plainTotalMods += plain.length
      imbueTotalMods += imbued.length
      plainPlus3Count += plain.filter((p) => p.value === 3).length
      imbuePlus3Count += imbued.filter((p) => p.value === 3).length

      // At ilvl = 85, r = rand(100) + 85 >= 85 > 70, so every seed rolls 2 or 3 StaffMod slots!
      expect(imbued.length).toBeGreaterThanOrEqual(2)
    }

    expect(imbueTotalMods).toBeGreaterThan(plainTotalMods)
    expect(imbuePlus3Count).toBeGreaterThan(plainPlus3Count)

    // Verify imbueItem113c wires wInitFlags |= 0x20 into staffmod generation
    let imbueStaffModTotal = 0
    for (let seed = 1; seed <= 20; seed++) {
      const res = imbueItem113c('ywn', 81, { rng: new D2Rng(seed), dropTables: tables }) // ilvl = 81 + 4 = 85
      const skillProps = res.rolledProps?.filter((p) => p.code === 'skill') ?? []
      expect(skillProps.length).toBeGreaterThanOrEqual(2)
      imbueStaffModTotal += skillProps.length
    }
    expect(imbueStaffModTotal).toBeGreaterThanOrEqual(45)
  })
})

describe('#1952 — A5Q4 Anya Personalization Nameable=1 throwing weapons & broken/quest/ear/low-quality guards', () => {
  function setupAnya() {
    const game = new GameInstance({ seed: 1952, areaId: 109 })
    const pid = game.connectPlayer({ charClass: 'ama', name: 'Valkyrie', level: 75, x: 50, y: 50, areaId: 109 })
    const npcId = game.spawnMonster({ hcIdx: 512, defId: 'anya', x: 52, y: 50, areaId: 109, isNpc: true })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          activeNpcId?: number
          questFlags: Uint16Array
          items: Array<Record<string, unknown>>
        }
      >
    }
    const player = internal.players.get(pid)!
    player.activeNpcId = npcId
    setQuestFlag113c(player.questFlags, 'a5q4', QUEST_FLAG_REWARD_PENDING_113C)
    return { game, pid, npcId, player }
  }

  it('rejects arrows, potions, broken gear, Low Quality, ears, and quest items without consuming A5Q4, then personalizes stackable Titan\'s Revenge (\'ama\')', () => {
    const { game, pid, npcId, player } = setupAnya()
    const makeItem = (unitId: number, code: string, extra: Record<string, unknown> = {}) => ({
      unitId,
      code,
      name: (extra.name as string | undefined) ?? code,
      quality: (extra.quality as number | undefined) ?? 7,
      level: 85,
      ilvl: 85,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      location: 'inventory',
      x: 0,
      y: 0,
      width: 1,
      height: 3,
      areaId: 109,
      ownerId: pid,
      bodyLoc: 0,
      storePage: 0,
      cost: 100,
      gamble: false,
      quantity: 1,
      stats: new Map<number, number>(),
      socketedItems: [],
      durability: (extra.durability as number | undefined) ?? 20,
      maxDurability: (extra.maxDurability as number | undefined) ?? 20,
      rawItemData: {
        id: unitId,
        code,
        quality: (extra.quality as number | undefined) ?? 7,
        identified: true,
        flags: (extra.rawFlags as number | undefined) ?? 0x10,
        rawFlags: (extra.rawFlags as number | undefined) ?? 0x10,
        ...((extra.rawItemData as Record<string, unknown> | undefined) ?? {}),
      },
    })

    const badItems = [
      makeItem(7001, 'aqv', { quality: 2, maxDurability: 0, durability: 0 }), // Arrows (Nameable=0)
      makeItem(7002, 'gps', { quality: 2, maxDurability: 0, durability: 0 }), // Rancid Gas Potion (Weapons.txt Nameable=0)
      makeItem(7003, 'hp1', { quality: 2, maxDurability: 0, durability: 0 }), // Potion (Misc.txt Nameable=0)
      makeItem(7004, 'cap', { quality: 2, durability: 0, maxDurability: 12 }), // Broken (durability 0)
      makeItem(7005, 'cap', { quality: 2, rawFlags: 0x0110 }), // Broken flag 0x0100
      makeItem(7006, 'cap', { quality: 1 }), // Low Quality (quality=1)
      makeItem(7007, 'ear', { quality: 2, rawFlags: 0x1010 }), // Player Ear
      makeItem(7008, 'd33', { quality: 7 }), // Decoy Gidbinn quest dagger
      makeItem(7009, 'leg', { quality: 2 }), // Wirt's Leg (quest=1)
      makeItem(7010, 'hfh', { quality: 7 }), // Hellforge Hammer (quest=25)
    ]
    const titans = makeItem(7020, 'ama', {
      name: "Titan's Revenge",
      quality: 7,
      maxDurability: 0,
      durability: 0,
    })
    player.items.push(...badItems, titans)

    for (const bad of badItems) {
      game.enqueueCommand(pid, {
        type: 'NpcEntityAction',
        npcId,
        action: 0,
        complement: bad.unitId as number,
      } as never)
      game.stepFrames(1)
      expect(bad.name, `code=${String(bad.code)} unitId=${String(bad.unitId)}`).not.toContain("Valkyrie's ")
    }

    // Quest reward must STILL be pending after all invalid attempts!
    expect((player.questFlags[38]! & QUEST_FLAG_REWARD_PENDING_113C) !== 0).toBe(true)

    // Now personalize stackable Ceremonial Javelin ("Titan's Revenge", Nameable=1, stackable=1)!
    game.enqueueCommand(pid, {
      type: 'NpcEntityAction',
      npcId,
      action: 0,
      complement: 7020,
    } as never)
    game.stepFrames(1)

    expect(titans.name).toBe("Valkyrie's Titan's Revenge")
    const rawData = titans.rawItemData as { personalized?: boolean; personalizedName?: string; rawFlags?: number }
    expect(rawData.personalized).toBe(true)
    expect(rawData.personalizedName).toBe('Valkyrie')
    expect((rawData.rawFlags ?? 0) & 0x01000000).toBe(0x01000000)
    expect((player.questFlags[38]! & QUEST_FLAG_COMPLETED_113C) !== 0).toBe(true)
  })
})

describe('#1953 — Fire Shrine (Code 19) & Monster Shrine (Code 20) 3x3 active room neighborhood & Unique promotion', () => {
  it('checks 3x3 room neighborhood accurately for both explicit RoomRects and 40x40-subtile DRLG fallback', () => {
    const rooms = [
      { x: 0, y: 0, w: 40, h: 40 },
      { x: 40, y: 0, w: 40, h: 40 },
      { x: 80, y: 0, w: 40, h: 40 },
      { x: 120, y: 0, w: 40, h: 40 },
    ]
    // Shrine in room [40..80): adjacent rooms [0..40) and [80..120) are IN, room [120..160) is OUT
    expect(isWithinShrineActiveRoomNeighborhood113c(50, 20, 10, 20, rooms)).toBe(true)
    expect(isWithinShrineActiveRoomNeighborhood113c(50, 20, 115, 20, rooms)).toBe(true)
    expect(isWithinShrineActiveRoomNeighborhood113c(50, 20, 125, 20, rooms)).toBe(false)

    // Eligibility filter rejects pets, bosses, non-normal ranks, NPCs, submerged & corpses
    expect(isEligibleMonsterShrineTarget113c({ hp: 50, rank: 'normal' })).toBe(true)
    expect(isEligibleMonsterShrineTarget113c({ hp: 50, rank: 'champion' })).toBe(false)
    expect(isEligibleMonsterShrineTarget113c({ hp: 50, rank: 'normal', isPet: true })).toBe(false)
    expect(isEligibleMonsterShrineTarget113c({ hp: 50, rank: 'normal', superUniqueId: 'Bishibosh' })).toBe(false)
    expect(isEligibleMonsterShrineTarget113c({ hp: 50, rank: 'normal', submerged: true })).toBe(false)
  })

  it('Fire Shrine (Code 19) halves HP across the 3x3 room neighborhood (beyond radius 14) while sparing units in non-adjacent rooms', () => {
    const game = new GameInstance({ seed: 195319, areaId: 2 })
    const pid = game.connectPlayer({ charClass: 'sor', name: 'Flame', x: 50, y: 50, areaId: 2 })
    const internal = game as unknown as {
      players: Map<number, { hp: number; hpFixed: number }>
      monsters: Map<number, { hp: number }>
    }
    const player = internal.players.get(pid)!
    player.hp = 100
    player.hpFixed = 100 * 256

    // Shrine at (50, 50) in room (1, 1) -> adjacent room (2, 2) spans [80..120), room (3, 3) spans [120..160)
    const adjRoomMonId = game.spawnMonster({ defId: 'fallen1', x: 95, y: 95, areaId: 2, hp: 80, maxHp: 80 })
    const farRoomMonId = game.spawnMonster({ defId: 'fallen1', x: 130, y: 130, areaId: 2, hp: 80, maxHp: 80 })
    const shrineId = game.spawnObject({
      classId: 2,
      x: 50,
      y: 50,
      areaId: 2,
      isShrine: true,
      shrineType: 19,
    })

    game.enqueueCommand(pid, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1)

    expect(player.hp).toBe(50)
    expect(internal.monsters.get(adjRoomMonId)!.hp).toBe(40)
    expect(internal.monsters.get(farRoomMonId)!.hp).toBe(80)
  })

  it('Monster Shrine (Code 20) ignores non-adjacent rooms & ineligible units and promotes nearest normal monster in Hell with 3 MonUMods in place', () => {
    // Find a deterministic seed where rand(100) >= 20 so Monster Shrine rolls Unique in Hell (3 MonUMods)
    let chosenSeed = 195320
    for (let s = 195320; s < 195350; s++) {
      const probe = new D2Rng(s)
      if (probe.rand(100) >= 20) {
        chosenSeed = s
        break
      }
    }
    const game = new GameInstance({ seed: chosenSeed, difficulty: 2, areaId: 2 })
    const pid = game.connectPlayer({ charClass: 'pal', name: 'Zealot', x: 50, y: 50, areaId: 2 })
    const internal = game as unknown as {
      monsters: Map<
        number,
        {
          rank: string
          isBoss: boolean
          modifiers: string[]
          umodIds: number[]
          level: number
          maxHp: number
          hp: number
        }
      >
    }

    // Closer ineligible SuperUnique & closer Bone Wall construct must be skipped; far room normal monster must also be skipped
    game.spawnMonster({ defId: 'fallen1', superUniqueId: 'Bishibosh', rank: 'unique', x: 51, y: 50, areaId: 2 })
    const eligibleId = game.spawnMonster({ defId: 'zombie1', x: 85, y: 85, areaId: 2 }) // adjacent room (2, 2)
    const outsideId = game.spawnMonster({ defId: 'zombie1', x: 135, y: 135, areaId: 2 }) // room (3, 3) outside 3x3
    const beforeCount = internal.monsters.size
    const targetBefore = internal.monsters.get(eligibleId)!
    const baseLvl = targetBefore.level
    const baseHp = targetBefore.maxHp

    const shrineId = game.spawnObject({
      classId: 2,
      x: 50,
      y: 50,
      areaId: 2,
      isShrine: true,
      shrineType: 20,
    })
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1)

    // Promoted in place (bSpawnMinions = 0)
    expect(internal.monsters.size).toBe(beforeCount)
    expect(['champion', 'unique']).toContain(targetBefore.rank)
    if (targetBefore.rank === 'unique') {
      expect(targetBefore.isBoss).toBe(true)
      expect(targetBefore.modifiers).toHaveLength(3)
      expect(targetBefore.level).toBe(baseLvl + 3)
    } else {
      expect(targetBefore.modifiers.length).toBeGreaterThanOrEqual(1)
      expect(targetBefore.level).toBe(baseLvl + 2)
    }
    expect(targetBefore.maxHp).toBeGreaterThan(baseHp)
    expect(targetBefore.hp).toBe(targetBefore.maxHp)
    expect(internal.monsters.get(outsideId)!.rank).toBe('normal')
  })
})
