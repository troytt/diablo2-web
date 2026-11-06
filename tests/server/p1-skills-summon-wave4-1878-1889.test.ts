import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { resolveWeaponBase113c } from '../../src/common/units/char-anim-speed.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import { AuraScanner } from '../../src/server/engine/aura-scanner.ts'
import {
  MissileEngine,
  calculateBoneWallStats,
  calculateBonePrisonStats,
} from '../../src/server/engine/missile-engine.ts'
import { evaluateSkill113c, executeSkill113c } from '../../src/server/skills/registry.ts'
import { GameInstance, type ServerItemEntry } from '../../src/server/engine/game-instance.ts'
import {
  calculateConversionStats,
  calculateVengeanceStats,
} from '../../src/server/skills/paladin-combat.ts'
import {
  STATE_SLOWMISSILES_113C,
  STATE_CONVERSION_113C,
  STATE_CONVERSION_SAVE_113C,
  STATE_TERROR_113C,
  STATE_RABIES_113C,
  STATE_BLADESHIELD_113C,
  STATE_DELERIUM_113C,
} from '../../src/server/skills/p1-wave4-skills-113c.ts'

function makeEquippedItem(spec: {
  unitId: number
  ownerId: number
  code: string
  bodyLoc: number
  areaId?: number
  ethereal?: boolean
  durability?: number
  maxDurability?: number
  stats?: ReadonlyArray<{ statId: number; param?: number; value: number }>
}): ServerItemEntry {
  const mapStats = new Map<number, number>()
  const rawStats: Array<{ statId: number; param: number; value: number }> = []
  for (const s of spec.stats ?? []) {
    if ((s.param ?? 0) === 0) {
      mapStats.set(s.statId, (mapStats.get(s.statId) ?? 0) + s.value)
    }
    rawStats.push({ statId: s.statId, param: s.param ?? 0, value: s.value })
  }
  return {
    unitId: spec.unitId,
    code: spec.code,
    name: spec.code,
    quality: 4,
    level: 85,
    location: 'equipped',
    x: 0,
    y: 0,
    width: 1,
    height: 3,
    areaId: spec.areaId ?? 2,
    ownerId: spec.ownerId,
    bodyLoc: spec.bodyLoc,
    storePage: 0,
    cost: 1000,
    gamble: false,
    identified: true,
    ethereal: spec.ethereal ?? false,
    socketed: false,
    totalSockets: 0,
    durability: spec.durability ?? 40,
    maxDurability: spec.maxDurability ?? 40,
    quantity: 1,
    stats: mapStats,
    socketedItems: [],
    rawItemData: {
      identified: true,
      ethereal: spec.ethereal ?? false,
      stats: rawStats,
    } as unknown as ServerItemEntry['rawItemData'],
  }
}

describe('Wave 4 P1 Player Skills & Summons Parity (#1878-#1889)', () => {
  it('#1878: Blessed Hammer (#112) spirals outward from NW, snapshots 50% Concentration (#113) at cast time, and respects 1.13c Magic Immunity on Undead', async () => {
    const registry = await getSharedDataRegistry()

    const runHammerTrial = (opts: {
      withConcentration: boolean
      clearConcMidFlight?: boolean
      isUndead?: boolean
      magicResist?: number
    }): number => {
      const game = new GameInstance({ registry, areaId: 2, seed: 187801 })
      const pid = game.addPlayer({
        name: 'Hammerdin',
        classId: 3,
        level: 80,
        x: 100,
        y: 100,
        areaId: 2,
        mana: 500,
        maxMana: 500,
        skills: { 112: 20, 113: 20 },
      })
      const internal = game as unknown as {
        players: Map<number, any>
        monsters: Map<number, any>
        playerActiveAuraState: Map<number, any>
        playerCombat: Map<number, any>
      }
      const p = internal.players.get(pid)!
      if (opts.withConcentration) {
        game.enqueueCommand(pid, { type: 'SelectSkill', skillId: 113, hand: 'right' })
        game.stepFrames(2)
        expect(p.states.has(42)).toBe(true) // States.txt #42 = concentration
      }

      const mid = game.spawnMonster({
        hcIdx: opts.isUndead ? 0 : 19, // 0 = skeleton1 (Undead), 19 = fallen1 (Demon)
        x: 100,
        y: 99, // Classic Hammerdin sweetspot on turn 1 (NW -> N arc), hit at k=8!
        areaId: 2,
        hp: 5000,
        maxHp: 5000,
        aiDisabled: true,
      })
      const m = internal.monsters.get(mid)!
      m.damageRegen = 0
      m.isUndead = Boolean(opts.isUndead)
      m.resistances.magic = opts.magicResist ?? 0

      // Second monster on outward turn 2 at (95, 100) (5 sub-tiles west, hit at k=32) to prove multi-turn outward spiral!
      const outerId = game.spawnMonster({
        hcIdx: 19,
        x: 95,
        y: 100,
        areaId: 2,
        hp: 5000,
        maxHp: 5000,
        aiDisabled: true,
      })
      const outerMon = internal.monsters.get(outerId)!
      outerMon.damageRegen = 0

      // Cast Blessed Hammer in-place (tx === player.x, ty === player.y) -> must still spiral outward starting NW!
      game.enqueueCommand(pid, {
        type: 'CastSkillAtLocation',
        skillId: 112,
        x: 100,
        y: 100,
      })
      game.stepFrame()

      if (opts.clearConcMidFlight) {
        p.states.delete(42)
        internal.playerActiveAuraState.delete(pid)
        internal.playerCombat.get(pid)?.stateBus?.removeState(42)
        internal.playerCombat.get(pid)?.stateBus?.removeState('concentration')
      }

      game.stepFrames(55)
      if (!opts.isUndead) {
        expect(5000 - outerMon.hp).toBeGreaterThan(150)
      }
      return 5000 - m.hp
    }

    const baseDmg = runHammerTrial({ withConcentration: false })
    expect(baseDmg).toBeGreaterThan(150)

    // slvl 20 Concentration = 60 + 15 * 19 = 345% ED -> floor(345 / 2) = +172% (2.72x)!
    const concDmg = runHammerTrial({ withConcentration: true })
    expect(concDmg).toBeGreaterThanOrEqual(Math.floor(baseDmg * 2.65))
    expect(concDmg).toBeLessThanOrEqual(Math.ceil(baseDmg * 2.78))

    // Switching off Concentration mid-flight keeps the cast-time snapshotted damage!
    const snapDmg = runHammerTrial({ withConcentration: true, clearConcMidFlight: true })
    expect(snapDmg).toBe(concDmg)

    // Non-magic-immune Undead takes 1.5x (+50% Undead bonus)
    const undeadDmg = runHammerTrial({ withConcentration: false, isUndead: true, magicResist: 0 })
    expect(undeadDmg).toBeGreaterThanOrEqual(Math.floor(baseDmg * 1.45))

    // 1.13c: Magic-immune Undead (magicResist >= 100) takes 0 damage!
    const immuneUndeadDmg = runHammerTrial({
      withConcentration: true,
      isUndead: true,
      magicResist: 100,
    })
    expect(immuneUndeadDmg).toBe(0)
  })

  it('#1879: Conversion (#116) rolls dm34(0, 50), applies 400f state 53 even vs physical-immune normal monsters, blocks Boss/Unique/Champion, and scales/restores clvl < mlvl (state 109)', async () => {
    const registry = await getSharedDataRegistry()
    expect(calculateConversionStats(1).chancePct).toBe(7)
    expect(calculateConversionStats(10).chancePct).toBe(34)
    expect(calculateConversionStats(20).chancePct).toBe(42)

    const game = new GameInstance({ registry, areaId: 2, seed: 187901 })
    const pid = game.addPlayer({
      name: 'Converter',
      classId: 3,
      level: 20, // clvl 20 < mlvl 80
      x: 100,
      y: 100,
      areaId: 2,
      ar: 50000,
      mana: 500,
      maxMana: 500,
      skills: { 116: 20 },
    })
    const internal = game as unknown as {
      players: Map<number, any>
      monsters: Map<number, any>
    }
    const p = internal.players.get(pid)!
    p.items.push(
      makeEquippedItem({ unitId: 9001, ownerId: pid, code: 'lsd', bodyLoc: 4 }),
    )

    // Physical-immune normal monster with mlvl 80 > clvl 20
    const normalId = game.spawnMonster({
      hcIdx: 1,
      x: 101,
      y: 100,
      areaId: 2,
      level: 80,
      hp: 800,
      maxHp: 800,
      ac: 0,
      aiDisabled: true,
    })
    const normalMon = internal.monsters.get(normalId)!
    normalMon.resistances.phys = 100
    normalMon.toBlock = 0

    // Unique monster must NEVER convert
    const uniqueId = game.spawnMonster({
      hcIdx: 1,
      x: 100,
      y: 101,
      areaId: 2,
      level: 80,
      hp: 5000,
      maxHp: 5000,
      ac: 0,
      rank: 'unique',
      aiDisabled: true,
    })
    const uniqueMon = internal.monsters.get(uniqueId)!
    uniqueMon.toBlock = 0

    for (let i = 0; i < 30; i++) {
      p.manaFixed = 500 * FIXED_ONE
      game.enqueueCommand(pid, {
        type: 'CastSkillOnTarget',
        skillId: 116,
        targetId: uniqueId,
        targetType: 1,
      })
      game.stepFrame()
    }
    expect(uniqueMon.states.has(STATE_CONVERSION_113C)).toBe(false)

    let converted = false
    for (let i = 0; i < 30; i++) {
      p.manaFixed = 500 * FIXED_ONE
      game.enqueueCommand(pid, {
        type: 'CastSkillOnTarget',
        skillId: 116,
        targetId: normalId,
        targetType: 1,
      })
      game.stepFrame()
      if (normalMon.states.has(STATE_CONVERSION_113C)) {
        converted = true
        break
      }
    }
    expect(converted).toBe(true)
    expect(normalMon.states.has(STATE_CONVERSION_SAVE_113C)).toBe(true)
    expect(normalMon.level).toBe(20)
    expect(normalMon.maxHp).toBe(200)
    expect(normalMon.hp).toBe(200)

    // Advance 401 frames -> conversion expires and restores mlvl 80 & maxHp 800!
    game.stepFrames(401)
    expect(normalMon.states.has(STATE_CONVERSION_113C)).toBe(false)
    expect(normalMon.states.has(STATE_CONVERSION_SAVE_113C)).toBe(false)
    expect(normalMon.level).toBe(80)
    expect(normalMon.maxHp).toBe(800)
    expect(normalMon.hp).toBe(800)
  })

  it('#1880: Vengeance (#111) scales Fire+Cold+Lightning from weapon base physical damage only (excluding Grief stat 111 & off-weapon %ED) and synergies #100/#105/#110/#125 (.blvl only)', async () => {
    const registry = await getSharedDataRegistry()
    const vStats = calculateVengeanceStats(20, {
      resistFire: 10,
      resistCold: 10,
      resistLightning: 10,
      salvation: 0,
    })
    expect(vStats.firePct).toBe(284)
    expect(vStats.coldPct).toBe(284)
    expect(vStats.ltngPct).toBe(284)

    const measureVengeanceElemVsPhysImmune = (extraStats: {
      griefFlat?: number
      armorOffWeaponEd?: number
      softAllSkills?: number
      onWeaponEd?: number
    }): { dmg: number; chilled: boolean } => {
      const game = new GameInstance({ registry, areaId: 2, seed: 188001 })
      const pid = game.addPlayer({
        name: 'Avenger',
        classId: 3,
        level: 85,
        x: 100,
        y: 100,
        areaId: 2,
        strength: 100,
        ar: 50000,
        mana: 500,
        maxMana: 500,
        skills: { 111: 20, 100: 10, 105: 10, 110: 10, 125: 0 },
      })
      const internal = game as unknown as {
        players: Map<number, any>
        monsters: Map<number, any>
      }
      const p = internal.players.get(pid)!
      // Phase Blade ('7cr'): mindam = 31, maxdam = 35 -> pin +4 min so base = 35..35!
      const weaponStats: Array<{ statId: number; value: number }> = [{ statId: 21, value: 4 }]
      if (extraStats.onWeaponEd) weaponStats.push({ statId: 17, value: extraStats.onWeaponEd })
      if (extraStats.griefFlat) weaponStats.push({ statId: 111, value: extraStats.griefFlat })
      p.items.push(
        makeEquippedItem({
          unitId: 9101,
          ownerId: pid,
          code: '7cr',
          bodyLoc: 4,
          stats: weaponStats,
        }),
      )
      const armorStats: Array<{ statId: number; value: number }> = []
      if (extraStats.armorOffWeaponEd) armorStats.push({ statId: 17, value: extraStats.armorOffWeaponEd })
      if (extraStats.softAllSkills) armorStats.push({ statId: 127, value: extraStats.softAllSkills })
      if (armorStats.length > 0) {
        p.items.push(
          makeEquippedItem({
            unitId: 9102,
            ownerId: pid,
            code: 'uar',
            bodyLoc: 3,
            stats: armorStats,
          }),
        )
      }

      const mid = game.spawnMonster({
        hcIdx: 1,
        x: 101,
        y: 100,
        areaId: 2,
        hp: 10000,
        maxHp: 10000,
        ac: 0,
        aiDisabled: true,
      })
      const m = internal.monsters.get(mid)!
      m.resistances = { phys: 100, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 }
      m.toBlock = 0

      game.enqueueCommand(pid, {
        type: 'CastSkillOnTarget',
        skillId: 111,
        targetId: mid,
        targetType: 1,
      })
      game.stepFrame()
      return { dmg: 10000 - m.hp, chilled: m.states.has(11) }
    }

    const baseline = measureVengeanceElemVsPhysImmune({})
    // 35 base * 284% = 99.4 per element -> ~298 total elemental damage, + chill!
    expect(baseline.dmg).toBeGreaterThanOrEqual(295)
    expect(baseline.dmg).toBeLessThanOrEqual(302)
    expect(baseline.chilled).toBe(true)

    // Grief +400 Damage (stat 111) & +300% off-weapon armor ED must NOT change elemental damage!
    const withGriefAndFort = measureVengeanceElemVsPhysImmune({
      griefFlat: 400,
      armorOffWeaponEd: 300,
    })
    expect(withGriefAndFort.dmg).toBe(baseline.dmg)

    // On-weapon +100% ED doubles weapon base (31*2+4 = 66 .. 35*2 = 70) -> roughly doubles elemental damage!
    const withOnWeaponEd = measureVengeanceElemVsPhysImmune({ onWeaponEd: 100 })
    expect(withOnWeaponEd.dmg).toBeGreaterThanOrEqual(550)

    // Soft +5 All Skills raises Vengeance slvl 20->25 (+30% per elem), NEVER synergy blvl (+50% per elem)!
    const withSoftSkills = measureVengeanceElemVsPhysImmune({ softAllSkills: 5 })
    // slvl 25 + 100% syn = 70 + 6*24 + 100 = 314% per element -> floor(35 * 3.14) * 3 ~ 329 (NOT 364% -> 382)
    expect(withSoftSkills.dmg).toBeGreaterThanOrEqual(325)
    expect(withSoftSkills.dmg).toBeLessThanOrEqual(335)
  })

  it('#1881: Grim Ward (#150) consumes non-boss corpse, spawns 1000f totem, pulses state 56 (terror) every 25f within 3+(slvl-1) sub-tiles causing normal monsters to flee away from ward, and despawns at 1000f', async () => {
    const registry = await getSharedDataRegistry()
    const game = new GameInstance({ registry, areaId: 2, seed: 188101 })
    const pid = game.addPlayer({
      name: 'WardBarb',
      classId: 4,
      level: 60,
      x: 90,
      y: 100,
      areaId: 2,
      mana: 200,
      maxMana: 200,
      skills: { 150: 10 }, // radius = 3 + 9 = 12 sub-tiles
    })
    const internal = game as unknown as {
      players: Map<number, any>
      monsters: Map<number, any>
    }
    const p = internal.players.get(pid)!
    p.states.add(85) // nomanaregen

    // Empty ground cast spends 0 mana and spawns 0 wards
    const manaBefore = p.manaFixed
    game.enqueueCommand(pid, { type: 'CastSkillAtLocation', skillId: 150, x: 100, y: 100 })
    game.stepFrame()
    expect(p.manaFixed).toBe(manaBefore)
    expect(game.getActiveGrimWards113c()).toHaveLength(0)

    // Non-soft skeleton corpse (hcIdx 0 `skeleton1`, MonStats2.soft === 0) must be rejected with 0 mana spent!
    const skelCorpseId = game.spawnMonster({ hcIdx: 0, x: 99, y: 100, areaId: 2, hp: 100, maxHp: 100 })
    const skelCorpse = internal.monsters.get(skelCorpseId)!
    skelCorpse.dead = true
    skelCorpse.hp = 0
    game.enqueueCommand(pid, {
      type: 'CastSkillOnTarget',
      skillId: 150,
      targetId: skelCorpseId,
      targetType: 1,
    })
    game.stepFrame()
    expect(skelCorpse.shattered).toBe(false)
    expect(p.manaFixed).toBe(manaBefore)
    expect(game.getActiveGrimWards113c()).toHaveLength(0)

    // Spawn a soft flesh corpse (hcIdx 19 `fallen1`, MonStats2.soft === 1) at (100, 100),
    // a normal monster at (104, 100) (east of ward, whereas player is west at 90,100!),
    // and a unique monster at (102, 100).
    const corpseId = game.spawnMonster({ hcIdx: 19, x: 100, y: 100, areaId: 2, hp: 100, maxHp: 100 })
    const corpse = internal.monsters.get(corpseId)!
    corpse.dead = true
    corpse.hp = 0

    const normalId = game.spawnMonster({ hcIdx: 19, x: 104, y: 100, areaId: 2, hp: 500, maxHp: 500 })
    const normalMon = internal.monsters.get(normalId)!

    const uniqueId = game.spawnMonster({
      hcIdx: 19,
      x: 102,
      y: 100,
      areaId: 2,
      hp: 500,
      maxHp: 500,
      rank: 'unique',
    })
    const uniqueMon = internal.monsters.get(uniqueId)!

    game.enqueueCommand(pid, {
      type: 'CastSkillOnTarget',
      skillId: 150,
      targetId: corpseId,
      targetType: 1,
    })
    game.stepFrame()

    expect(corpse.shattered).toBe(true)
    expect(corpse.states.has(104)).toBe(true)
    expect(corpse.states.has(118)).toBe(true)
    expect(game.getActiveGrimWards113c()).toHaveLength(1)
    expect(normalMon.states.has(STATE_TERROR_113C)).toBe(true)
    expect(uniqueMon.states.has(STATE_TERROR_113C)).toBe(false)

    // Normal monster at x=104 (with ward at x=100 and player at x=90) must flee EAST (> 104) away from ward!
    game.stepFrames(20)
    expect(normalMon.x).toBeGreaterThan(104)

    // Bring another fresh normal monster into radius at frame +24 -> next 25f pulse terrifies it!
    const newcomerId = game.spawnMonster({ hcIdx: 19, x: 103, y: 100, areaId: 2, hp: 500, maxHp: 500 })
    const newcomer = internal.monsters.get(newcomerId)!
    expect(newcomer.states.has(STATE_TERROR_113C)).toBe(false)
    game.stepFrames(10)
    expect(newcomer.states.has(STATE_TERROR_113C)).toBe(true)

    // Advance past 1000 total frames -> Grim Ward expires and despawns!
    game.stepFrames(980)
    expect(game.getActiveGrimWards113c()).toHaveLength(0)
  })

  it('#1882: Corpse Explosion (#74 & #276 Death Sentry) scales strictly from /players 1 normal unscaledMaxHp (ignoring Unique 4x & /players 8 4.5x), split 50% phys + 50% fire with spell hit rules', async () => {
    const registry = await getSharedDataRegistry()
    const game = new GameInstance({ registry, areaId: 2, seed: 188201, playersX: 8, maxPlayers: 8 })
    const pid = game.addPlayer({
      name: 'NecroCE',
      classId: 2,
      level: 80,
      x: 100,
      y: 100,
      areaId: 2,
      mana: 500,
      maxMana: 500,
      skills: { 74: 20, 66: 10 },
    })
    const internal = game as unknown as {
      players: Map<number, any>
      monsters: Map<number, any>
    }
    const p = internal.players.get(pid)!
    p.hp = 100
    p.maxHp = 500
    p.hpFixed = 100 * FIXED_ONE
    p.maxHpFixed = 500 * FIXED_ONE
    // Equip +500% ED, 100% Deadly Strike, 100% Crushing Blow, 50% Life Steal -> NONE may boost CE!
    p.items.push(
      makeEquippedItem({
        unitId: 9201,
        ownerId: pid,
        code: 'uar',
        bodyLoc: 3,
        stats: [
          { statId: 17, value: 500 },
          { statId: 141, value: 100 },
          { statId: 136, value: 100 },
          { statId: 60, value: 50 },
        ],
      }),
    )

    // Spawn Unique corpse in /players 8: unscaledMaxHp = 200, baseMaxHp = 800, maxHp = 3600!
    const corpseId = game.spawnMonster({
      hcIdx: 1,
      x: 102,
      y: 100,
      areaId: 2,
      rank: 'unique',
      aiDisabled: true,
    })
    const corpse = internal.monsters.get(corpseId)!
    corpse.unscaledMaxHp = 200
    corpse.baseMaxHp = 800
    corpse.maxHp = 3600
    corpse.hp = 0
    corpse.dead = true

    const victimId = game.spawnMonster({
      hcIdx: 1,
      x: 103,
      y: 100,
      areaId: 2,
      hp: 10000,
      maxHp: 10000,
      ac: 99999,
      aiDisabled: true,
    })
    const victim = internal.monsters.get(victimId)!
    victim.damageRegen = 0
    victim.resistances = { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 }
    victim.toBlock = 75 // Spell CE must be unblockable & autoHit!

    // Also place a 100% phys-immune + 0% fire-resist victim to verify 50/50 split!
    const physImmuneId = game.spawnMonster({
      hcIdx: 1,
      x: 101,
      y: 101,
      areaId: 2,
      hp: 10000,
      maxHp: 10000,
      aiDisabled: true,
    })
    const physImmune = internal.monsters.get(physImmuneId)!
    physImmune.damageRegen = 0
    physImmune.resistances = { phys: 100, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 }

    game.enqueueCommand(pid, {
      type: 'CastSkillOnTarget',
      skillId: 74,
      targetId: corpseId,
      targetType: 1,
    })
    game.stepFrame()

    const dealtFull = 10000 - victim.hp
    const dealtFireOnly = 10000 - physImmune.hp
    // 70%..120% of 200 = 140..240 total (70..120 phys + 70..120 fire), NEVER 2520..4320 or CB 2500!
    expect(dealtFull).toBeGreaterThanOrEqual(140)
    expect(dealtFull).toBeLessThanOrEqual(240)
    expect(dealtFireOnly).toBeGreaterThanOrEqual(70)
    expect(dealtFireOnly).toBeLessThanOrEqual(120)
    expect(Math.abs(dealtFull - dealtFireOnly * 2)).toBeLessThanOrEqual(2)
    // Zero life leech on spell CE
    expect(p.hpFixed).toBe(100 * FIXED_ONE)

    // Verify Death Sentry (#276 -> #312 mon death sentry) ALSO uses unscaled 1P normal baseMaxHp at 40%..80% (80..160 on 200 HP)!
    const sm = game.getSummonManager(pid)
    const ownerCtx = {
      id: 'ds_owner',
      name: 'DSOwner',
      unitType: 'player' as const,
      statList: new UnitStatList(registry),
      stateBus: new StateBus(new UnitStatList(registry), registry),
      x: 100,
      y: 100,
    }
    sm.createPet({ owner: ownerCtx, skillId: 276, slvl: 10, x: 100, y: 100 })
    const dsEnemyStats = new UnitStatList(registry, {
      maxhp: 10000 * FIXED_ONE,
      hitpoints: 10000 * FIXED_ONE,
    })
    const dsEnemy = {
      id: 'ds_enemy',
      name: 'DSEnemy',
      unitType: 'monster' as const,
      statList: dsEnemyStats,
      stateBus: new StateBus(dsEnemyStats, registry),
      x: 102,
      y: 100,
    }
    const dsRes = sm.tickPets({
      currentTick: 50,
      owner: ownerCtx,
      enemies: [dsEnemy],
      enemyPositions: new Map([['ds_enemy', { x: 102, y: 100 }]]),
      corpses: [{ id: 'c_ds', consumed: false, baseMaxHp: 200, x: 101, y: 100 }],
      missileEngine: new MissileEngine(registry),
      auraScanner: new AuraScanner(registry),
    })
    expect(dsRes.corpsesConsumedByPets).toBe(1)
    expect(dsRes.damageDealt).toBeGreaterThanOrEqual(80)
    expect(dsRes.damageDealt).toBeLessThanOrEqual(160)
  })

  it('#1883: Bone Wall (#78) & Bone Prison (#88) spawn collision-blocking bonewall segments with 1.13c synergy HP (noRatio in /players 8) and clear collision cells after 600f or death', async () => {
    const registry = await getSharedDataRegistry()
    const game = new GameInstance({ registry, areaId: 2, seed: 188301, playersX: 8, maxPlayers: 8 })
    const pid = game.addPlayer({
      name: 'Bonemancer',
      classId: 2,
      level: 75,
      x: 100,
      y: 100,
      areaId: 2,
      mana: 500,
      maxMana: 500,
      skills: { 68: 10, 78: 10, 88: 10 },
    })
    const internal = game as unknown as {
      players: Map<number, any>
      monsters: Map<number, any>
    }
    const p = internal.players.get(pid)!
    p.states.add(85)

    // 1. Bone Prison on empty ground must be rejected with 0 mana spent!
    const mana0 = p.manaFixed
    game.enqueueCommand(pid, { type: 'CastSkillAtLocation', skillId: 88, x: 110, y: 100 })
    game.stepFrame()
    expect(p.manaFixed).toBe(mana0)

    // 2. Bone Wall at (105, 100) spawns 9 perpendicular segments with exact 1.13c HP (uninflated by /players 8!)
    const expectedWallHp = calculateBoneWallStats(10, { boneArmor: 10, bonePrison: 10 }, 0).hp113c
    game.enqueueCommand(pid, { type: 'CastSkillAtLocation', skillId: 78, x: 105, y: 100 })
    game.stepFrame()

    const wallSegments = [...internal.monsters.values()].filter(
      (m) => m.boneConstructOwnerPlayerId === pid && !m.dead,
    )
    expect(wallSegments.length).toBeGreaterThanOrEqual(7)
    expect(wallSegments[0]!.maxHp).toBe(expectedWallHp)
    expect((game as any).isBlockedByBonePrison(2, 105, 100)).toBe(true)

    // Advance past skill delay, spawn target monster at (115, 100), cast Bone Prison on it -> 12-segment ring!
    game.stepFrames(35)
    const targetId = game.spawnMonster({
      hcIdx: 1,
      x: 115,
      y: 100,
      areaId: 2,
      hp: 2000,
      maxHp: 2000,
      aiDisabled: true,
    })
    const expectedPrisonHp = calculateBonePrisonStats(10, { boneArmor: 10, boneWall: 10 }, 0).hp113c
    game.enqueueCommand(pid, {
      type: 'CastSkillOnTarget',
      skillId: 88,
      targetId: targetId,
      targetType: 1,
    })
    game.stepFrame()

    const allBoneSegments = [...internal.monsters.values()].filter(
      (m) => m.boneConstructOwnerPlayerId === pid && !m.dead,
    )
    const prisonSeg = allBoneSegments.find((m) => Math.hypot(m.x - 115, m.y - 100) <= 5.5)
    expect(prisonSeg).toBeDefined()
    expect(prisonSeg!.maxHp).toBe(expectedPrisonHp)

    // Advance 600 frames -> both Bone Wall and Bone Prison expire, despawn completely, and free collision!
    game.stepFrames(605)
    const remainingConstructs = [...internal.monsters.values()].filter(
      (m) => m.boneConstructOwnerPlayerId === pid,
    )
    expect(remainingConstructs).toHaveLength(0)
    expect((game as any).isBlockedByBonePrison(2, 105, 100)).toBe(false)
  })

  it('#1884: Blade Fury (#266 3/4 1H vs 3/8 2H, 5f cadence, startmana+usemanaondo, onHit CtC, 0 dur loss), Blade Shield (#277 1/4 + dur loss), and Blade Sentinel (#257 3/8 1H shuttle + 5-trap FIFO)', async () => {
    const registry = await getSharedDataRegistry()

    // A. Blade Fury 1H vs 2H weapon damage + 5f cadence + usemanaondo + onHit CtC + 0 durability loss
    const runBladeFuryTest = (weaponCode: string): {
      dmgPerShot: number
      manaSpent: number
      durabilityAfter: number
      ampTriggered: boolean
      onAttackTriggered: boolean
    } => {
      const game = new GameInstance({ registry, areaId: 2, seed: 188401 })
      const pid = game.addPlayer({
        name: 'Bladesin',
        classId: 6,
        level: 80,
        x: 100,
        y: 100,
        areaId: 2,
        strength: 100,
        dexterity: 100,
        ar: 50000,
        mana: 100,
        maxMana: 100,
        skills: { 266: 1 },
      })
      const internal = game as unknown as {
        players: Map<number, any>
        monsters: Map<number, any>
      }
      const p = internal.players.get(pid)!
      p.states.add(85) // nomanaregen
      // 100% CtC slvl 5 Amplify Damage (#66) onHit (stat 198) + 100% CtC slvl 5 Weaken (#72) onAttack (stat 195)
      // Also pin both 1H and 2H weapons to exact 100..100 base weapon damage so 3/4 vs 3/8 ratio is exact!
      const wb = resolveWeaponBase113c(weaponCode)!
      const is2H = Boolean(wb.twoHanded && !wb.oneOrTwoHanded)
      const baseMin = is2H ? (wb.twoHandedMindam ?? wb.mindam) : wb.mindam
      const baseMax = is2H ? (wb.twoHandedMaxdam ?? wb.maxdam) : wb.maxdam
      const weapon = makeEquippedItem({
        unitId: 9401,
        ownerId: pid,
        code: weaponCode,
        bodyLoc: 4,
        durability: 30,
        maxDurability: 30,
        stats: [
          { statId: is2H ? 23 : 21, value: 100 - baseMin },
          { statId: is2H ? 24 : 22, value: 100 - baseMax },
          { statId: 198, param: (66 << 6) | 5, value: 100 },
          { statId: 195, param: (72 << 6) | 5, value: 100 },
        ],
      })
      p.items.push(weapon)

      const mid = game.spawnMonster({
        hcIdx: 19,
        x: 106,
        y: 100,
        areaId: 2,
        hp: 5000,
        maxHp: 5000,
        ac: 0,
        aiDisabled: true,
      })
      const m = internal.monsters.get(mid)!
      m.damageRegen = 0
      m.toBlock = 0

      const manaStart = p.manaFixed
      // Cast with hold: true -> fires initial shot + another shot after 5 frames!
      game.enqueueCommand(pid, {
        type: 'CastSkillAtLocation',
        skillId: 266,
        x: 106,
        y: 100,
        hold: true,
      })
      game.stepFrames(6) // 2 shots launched (frame 0 and frame 5)
      game.enqueueCommand(pid, { type: 'Move', x: 100, y: 100 }) // stop channeling
      game.stepFrames(15)

      return {
        dmgPerShot: (5000 - m.hp) / 2,
        manaSpent: (manaStart - p.manaFixed) / FIXED_ONE,
        durabilityAfter: weapon.durability,
        ampTriggered: m.states.has(9), // Amplify Damage = state 9
        onAttackTriggered: m.states.has(19), // Weaken = state 19 (must NOT fire on Blade Fury!)
      }
    }

    // Compare identical 100..100 base damage on 1H ('7cr' Phase Blade) vs 2H ('bax' Broad Axe):
    // 1H weapon portion = 3/4 (75 + Str/Dex ED + 8..10 flat), 2H weapon portion = 3/8 (37 + Str/Dex ED + unscaled 8..10 flat)!
    const oneHandRes = runBladeFuryTest('7cr')
    const twoHandRes = runBladeFuryTest('bax')
    expect(oneHandRes.dmgPerShot).toBeGreaterThan(twoHandRes.dmgPerShot * 1.55)
    expect(oneHandRes.manaSpent).toBe(2) // slvl 1 Blade Fury costs 1.0 mana per shot * 2 shots = 2 mana!
    expect(oneHandRes.durabilityAfter).toBe(30) // 0 durability loss!
    expect(twoHandRes.durabilityAfter).toBe(30) // 0 durability loss!
    expect(oneHandRes.ampTriggered).toBe(true) // onHit CtC fires!
    expect(oneHandRes.onAttackTriggered).toBe(false) // onAttack CtC does NOT fire!

    // B. Blade Shield (#277) + Blade Sentinel (#257) 5-trap FIFO cap & shuttle
    const game2 = new GameInstance({ registry, areaId: 2, seed: 188402 })
    const pid2 = game2.addPlayer({
      name: 'Trapsin',
      classId: 6,
      level: 80,
      x: 100,
      y: 100,
      areaId: 2,
      strength: 100,
      dexterity: 100,
      ar: 50000,
      mana: 1000,
      maxMana: 1000,
      skills: { 277: 10, 257: 25, 271: 10 }, // slvl 25 Sentinel = 100 + 12*24 = 388f (> 6 * 51f cooldown!)
    })
    const internal2 = game2 as unknown as {
      players: Map<number, any>
      monsters: Map<number, any>
      missiles: Map<number, any>
    }
    const p2 = internal2.players.get(pid2)!
    const claw = makeEquippedItem({
      unitId: 9402,
      ownerId: pid2,
      code: '7ar', // Suwayyah
      bodyLoc: 4,
      durability: 40,
      maxDurability: 40,
    })
    p2.items.push(claw)

    const adjId = game2.spawnMonster({
      hcIdx: 19,
      x: 102,
      y: 100,
      areaId: 2,
      hp: 5000,
      maxHp: 5000,
      ac: 0,
      aiDisabled: true,
    })
    const adjMon = internal2.monsters.get(adjId)!
    adjMon.damageRegen = 0
    adjMon.toBlock = 0

    // Activate Blade Shield (#277) -> state 158, pulses every 25 frames within 6 sub-tiles and degrades weapon durability!
    game2.enqueueCommand(pid2, { type: 'CastSkillAtLocation', skillId: 277, x: 100, y: 100 })
    game2.stepFrame()
    expect(p2.states.has(STATE_BLADESHIELD_113C)).toBe(true)
    game2.stepFrames(150) // 6 pulses
    expect(adjMon.hp).toBeLessThan(5000)
    expect(claw.durability).toBeLessThan(40)

    // Cast 4 Lightning Sentries (#271) + 2 Blade Sentinels (#257, 50f skill delay) -> shared 5-trap 'assassintrap' FIFO cap keeps 5 active & evicts the 1st #271!
    for (let i = 0; i < 4; i++) {
      p2.manaFixed = 1000 * FIXED_ONE
      game2.enqueueCommand(pid2, {
        type: 'CastSkillAtLocation',
        skillId: 271,
        x: 106,
        y: 98 + i,
      })
      game2.stepFrame()
    }
    const firstTrapUid = game2.getSummonManager(pid2).getActivePets().find((pt) => pt.petType === 'assassintrap')!.uid
    for (let i = 0; i < 2; i++) {
      p2.manaFixed = 1000 * FIXED_ONE
      game2.enqueueCommand(pid2, {
        type: 'CastSkillAtLocation',
        skillId: 257,
        x: 108,
        y: 100 + i,
      })
      game2.stepFrames(i === 0 ? 51 : 1)
    }
    const activeSentinels = [...internal2.missiles.values()].filter((m) => m.skillId === 257)
    expect(activeSentinels).toHaveLength(2)
    const activeTraps = game2.getSummonManager(pid2).getActivePets().filter((pt) => pt.petType === 'assassintrap')
    expect(activeTraps).toHaveLength(5)
    expect(activeTraps.some((pt) => pt.uid === firstTrapUid)).toBe(false)
  })

  it('#1885: Slow Missiles (#17) applies state 87 (slowmissiles) within 20 sub-tiles and cuts monster projectile velocity to 33%', async () => {
    const registry = await getSharedDataRegistry()
    const game = new GameInstance({ registry, areaId: 2, seed: 188501 })
    const pid = game.addPlayer({
      name: 'ZonSlow',
      classId: 0,
      level: 50,
      x: 100,
      y: 100,
      areaId: 2,
      mana: 200,
      maxMana: 200,
      skills: { 17: 5 }, // 300 + 150*4 = 900 frames, radius 20
    })
    const internal = game as unknown as {
      monsters: Map<number, any>
      missiles: Map<number, any>
    }

    const archerNormalId = game.spawnMonster({
      hcIdx: 5, // skeleton archer
      x: 130, // 30 sub-tiles away (> 20 radius -> unaffected)
      y: 100,
      areaId: 2,
      hp: 500,
      maxHp: 500,
      aiDisabled: true,
    })
    const archerSlowId = game.spawnMonster({
      hcIdx: 5,
      x: 112, // 12 sub-tiles away (<= 20 radius -> afflicted!)
      y: 100,
      areaId: 2,
      hp: 500,
      maxHp: 500,
      aiDisabled: true,
    })
    const archerNormal = internal.monsters.get(archerNormalId)!
    const archerSlow = internal.monsters.get(archerSlowId)!

    game.enqueueCommand(pid, { type: 'CastSkillAtLocation', skillId: 17, x: 100, y: 100 })
    game.stepFrame()

    expect(archerSlow.states.has(STATE_SLOWMISSILES_113C)).toBe(true)
    expect(archerNormal.states.has(STATE_SLOWMISSILES_113C)).toBe(false)
    expect(archerSlow.stateTimers.get(STATE_SLOWMISSILES_113C)).toBe(899)

    ;(game as any).spawnMonsterMissile(archerNormal, 100, 100, 10, 'arrow')
    ;(game as any).spawnMonsterMissile(archerSlow, 100, 100, 10, 'arrow')

    const msls = [...internal.missiles.values()]
    expect(msls).toHaveLength(2)
    const speedNormal = Math.hypot(msls[0]!.vx, msls[0]!.vy)
    const speedSlow = Math.hypot(msls[1]!.vx, msls[1]!.vy)
    expect(speedSlow / speedNormal).toBeCloseTo(0.33, 2)
  })

  it('#1886: Rabies (#238) Werewolf melee bite infects target (state 112 + #222 .blvl synergy) and cascades every 4 frames within 7 sub-tiles while skipping poison-immune monsters', async () => {
    const registry = await getSharedDataRegistry()
    const game = new GameInstance({ registry, areaId: 2, seed: 188601 })
    const pid = game.addPlayer({
      name: 'RabiesDruid',
      classId: 5,
      level: 80,
      x: 100,
      y: 100,
      areaId: 2,
      ar: 50000,
      mana: 300,
      maxMana: 300,
      skills: { 223: 10, 238: 15, 222: 20 },
    })
    const internal = game as unknown as {
      players: Map<number, any>
      monsters: Map<number, any>
    }
    const p = internal.players.get(pid)!
    p.items.push(makeEquippedItem({ unitId: 9601, ownerId: pid, code: '7cr', bodyLoc: 4 }))

    // Morph into Werewolf (#223) first
    game.enqueueCommand(pid, { type: 'CastSkillAtLocation', skillId: 223, x: 100, y: 100 })
    game.stepFrames(26)
    expect(p.states.has(139)).toBe(true)

    // Chain of 3 monsters spaced 5 sub-tiles apart (<= 7 contagion radius) + 1 poison-immune monster!
    const m1Id = game.spawnMonster({ hcIdx: 1, x: 101, y: 100, areaId: 2, hp: 5000, maxHp: 5000, ac: 0, aiDisabled: true })
    const m2Id = game.spawnMonster({ hcIdx: 1, x: 106, y: 100, areaId: 2, hp: 5000, maxHp: 5000, ac: 0, aiDisabled: true })
    const m3Id = game.spawnMonster({ hcIdx: 1, x: 111, y: 100, areaId: 2, hp: 5000, maxHp: 5000, ac: 0, aiDisabled: true })
    const mImmuneId = game.spawnMonster({ hcIdx: 1, x: 103, y: 101, areaId: 2, hp: 5000, maxHp: 5000, ac: 0, aiDisabled: true })

    const m1 = internal.monsters.get(m1Id)!
    const m2 = internal.monsters.get(m2Id)!
    const m3 = internal.monsters.get(m3Id)!
    const mImmune = internal.monsters.get(mImmuneId)!
    for (const m of [m1, m2, m3]) {
      m.resistances.poison = 0
      m.toBlock = 0
    }
    mImmune.resistances.poison = 100

    // Bite m1 with Rabies (#238)
    game.enqueueCommand(pid, {
      type: 'CastSkillOnTarget',
      skillId: 238,
      targetId: m1Id,
      targetType: 1,
    })
    game.stepFrame()
    expect(m1.states.has(STATE_RABIES_113C)).toBe(true)
    expect(m1.poisonRemainingFrames).toBeGreaterThan(200)

    // Step 12 frames -> Rabies cascades m1 -> m2 -> m3 on 4-frame ticks, skipping mImmune!
    game.stepFrames(12)
    expect(m2.states.has(STATE_RABIES_113C)).toBe(true)
    expect(m3.states.has(STATE_RABIES_113C)).toBe(true)
    expect(m2.hp).toBeLessThan(5000)
    expect(m3.hp).toBeLessThan(5000)
    expect(mImmune.states.has(STATE_RABIES_113C)).toBe(false)
    expect(mImmune.hp).toBe(5000)
  })

  it('#1887: All Skills.txt .blvl synergy formulas strictly read hard base points (0..20) and are never inflated by +Skills soft levels', async () => {
    const registry = await getSharedDataRegistry()

    // Full-table sweep across every player skill with EDmgSymPerCalc / DmgSymPerCalc / ELenSymPerCalc referencing .blvl
    let checkedSkills = 0
    for (let skillId = 1; skillId <= 280; skillId++) {
      const skill = registry.getSkillById(skillId)
      if (!skill) continue
      const synExprs = [skill.dmgSymPerCalc, skill.eDmgSymPerCalc, skill.eLenSymPerCalc]
        .filter((s) => s && s.includes('.blvl'))
      if (synExprs.length === 0) continue
      checkedSkills++

      const hardOnly = new UnitStatList(registry)
      const withSoftPlus15 = new UnitStatList(registry)
      for (let id = 1; id <= 280; id++) {
        hardOnly.setBaseSkillLevel(id, 5)
        withSoftPlus15.setBaseSkillLevel(id, 5)
        withSoftPlus15.setBonusSkillLevel(id, 15) // slvl = 20, blvl = 5!
      }
      withSoftPlus15.setAllSkillsBonus(15)

      // Evaluate at identical cast slvl = 20 so only synergy contribution could differ
      const evHard = evaluateSkill113c({
        registry,
        skill,
        slvl: 20,
        blvl: 5,
        statList: hardOnly,
      })
      const evSoft = evaluateSkill113c({
        registry,
        skill,
        slvl: 20,
        blvl: 5,
        statList: withSoftPlus15,
      })

      expect(evSoft.minElemDmg256, `Skill #${skillId} (${skill.name}) minElemDmg256`).toBe(evHard.minElemDmg256)
      expect(evSoft.maxElemDmg256, `Skill #${skillId} (${skill.name}) maxElemDmg256`).toBe(evHard.maxElemDmg256)
      expect(evSoft.physDamagePct, `Skill #${skillId} (${skill.name}) physDamagePct`).toBe(evHard.physDamagePct)
      expect(evSoft.durationFrames, `Skill #${skillId} (${skill.name}) durationFrames`).toBe(evHard.durationFrames)
    }
    expect(checkedSkills).toBeGreaterThan(60)
  })

  it('#1888: GameInstance.summonPet snapshots full effective soft slvl (+Skills) for Druid #227/#237/#247 cross-bonuses and Necromancer #69/#79/#89 masteries without polluting baseSkillLevel or uninvested 0-point skills', async () => {
    const registry = await getSharedDataRegistry()

    // 1. Druid Summon Grizzly (#247) with 1 hard point each in #227, #237, #247: compare +0 vs +10 All Skills
    const spawnGrizzly = (skills: Record<number, number>, allSkillsBonus: number) => {
      const game = new GameInstance({ registry, areaId: 2, seed: 188801 })
      const pid = game.addPlayer({
        name: 'SummonDruid',
        classId: 5,
        level: 70,
        x: 100,
        y: 100,
        areaId: 2,
        skills,
      })
      const p = (game as any).players.get(pid)!
      if (allSkillsBonus > 0) {
        p.items.push(
          makeEquippedItem({
            unitId: 9801,
            ownerId: pid,
            code: 'uar',
            bodyLoc: 3,
            stats: [{ statId: 127, value: allSkillsBonus }],
          }),
        )
      }
      const out = game.summonPet(pid, { skillId: 247, slvl: 11 })
      return out.pet!
    }

    const gBase1 = spawnGrizzly({ 227: 1, 237: 1, 247: 1 }, 0)
    const gSoft11 = spawnGrizzly({ 227: 1, 237: 1, 247: 1 }, 10)
    const gUninvestedFenris = spawnGrizzly({ 227: 0, 237: 0, 247: 1 }, 10)

    // Dire Wolf slvl 11 grants +50 + 25*(11-1) = +300% max HP vs slvl 1 (+50% max HP)!
    expect(gSoft11.maxHp).toBeGreaterThan(Math.floor(gBase1.maxHp * 2.2))
    // 0 hard points in #227/#237 + +10 All Skills must NOT unlock passive cross-bonuses!
    expect(gUninvestedFenris.maxHp).toBeLessThan(gBase1.maxHp)

    // 2. Necromancer Skeleton Mastery (#69), Golem Mastery (#79), Summon Resist (#89) with +10 Tab/Class Skills
    const summonNecroPets = (skills: Record<number, number>, necroSkillsBonus: number) => {
      const game = new GameInstance({ registry, areaId: 2, seed: 188802 })
      const pid = game.addPlayer({
        name: 'SummonNecro',
        classId: 2,
        level: 70,
        x: 100,
        y: 100,
        areaId: 2,
        skills,
      })
      const internal = game as any
      const p = internal.players.get(pid)!
      if (necroSkillsBonus > 0) {
        p.items.push(
          makeEquippedItem({
            unitId: 9802,
            ownerId: pid,
            code: 'uar',
            bodyLoc: 3,
            stats: [{ statId: 83, param: 2, value: necroSkillsBonus }], // +Necromancer Skill Levels
          }),
        )
      }
      const cid = game.spawnMonster({ hcIdx: 1, x: 101, y: 100, areaId: 2, hp: 100, maxHp: 100 })
      const c = internal.monsters.get(cid)!
      c.dead = true
      c.hp = 0

      const skel = game.summonPet(pid, { skillId: 70, slvl: 11 }).pet!
      const golem = game.summonPet(pid, { skillId: 75, slvl: 11 }).pet!
      return { skel, golem }
    }

    const nec0 = summonNecroPets({ 70: 1, 69: 1, 75: 1, 79: 1, 89: 1 }, 0)
    const nec10 = summonNecroPets({ 70: 1, 69: 1, 75: 1, 79: 1, 89: 1 }, 10)
    expect(nec10.skel.maxHp).toBeGreaterThan(nec0.skel.maxHp + 80)
    expect(nec10.golem.maxHp).toBeGreaterThan(nec0.golem.maxHp * 2)
    expect(nec10.golem.statList.getAccruedStat('fireresist')).toBeGreaterThan(
      nec0.golem.statList.getAccruedStat('fireresist'),
    )
  })

  it('#1889: STATE_DELERIUM (state 177) enforces morph cast restrictions (blocks restrict=0 spells & restrict=2 wolf/bear skills, allows #0 Attack & restrict=1 skills, and clears on #223/#228 morph)', async () => {
    const registry = await getSharedDataRegistry()

    // 1. Direct executeSkill113c gate check
    const statList = new UnitStatList(registry)
    statList.setMana256(500 * FIXED_ONE)
    statList.setBaseSkillLevel(54, 5) // Teleport (restrict = 0)
    statList.setBaseSkillLevel(238, 5) // Rabies (restrict = 2, wolf-only)
    statList.setBaseSkillLevel(249, 5) // Armageddon (restrict = 1)
    const stateBus = new StateBus(statList, registry)
    stateBus.applyState({ stateNameOrId: STATE_DELERIUM_113C, slvl: 1, durationFrames: 1500 })
    const caster = {
      id: 'delerium_caster',
      name: 'Delirious',
      charClass: 'dru' as const,
      unitType: 'player' as const,
      statList,
      stateBus,
    }

    for (const blockedId of [54, 238]) {
      const sk = registry.getSkillById(blockedId)!
      const ev = evaluateSkill113c({ registry, skill: sk, slvl: 5, blvl: 5, statList })
      const out = executeSkill113c({
        registry,
        skill: sk,
        evalResult: ev,
        caster,
        targets: [],
        targetPositions: new Map(),
        corpses: [],
        missileEngine: new MissileEngine(registry),
        auraScanner: {} as any,
        summonManager: {} as any,
        targetX: 100,
        targetY: 100,
        currentTick: 10,
      })
      expect(out.executed, `Skill #${blockedId} must be blocked in delerium`).toBe(false)
      expect(out.error).toBe('invalid_form')
    }

    // 2. GameInstance end-to-end check: state 177 blocks #54 Teleport, #112 Blessed Hammer, and #238 Rabies,
    // allows #0 Attack and #249 Armageddon, and casting #223 Werewolf clears state 177!
    const game = new GameInstance({ registry, areaId: 2, seed: 188901 })
    const pid = game.addPlayer({
      name: 'FetishHero',
      classId: 5,
      level: 70,
      x: 100,
      y: 100,
      areaId: 2,
      ar: 50000,
      mana: 500,
      maxMana: 500,
      skills: { 54: 5, 112: 5, 238: 5, 249: 5, 223: 5, 245: 5 },
    })
    const internal = game as unknown as {
      players: Map<number, any>
      monsters: Map<number, any>
      missiles: Map<number, any>
    }
    const p = internal.players.get(pid)!
    p.states.add(85)
    p.states.add(STATE_DELERIUM_113C)
    p.stateTimers.set(STATE_DELERIUM_113C, 1500)

    const mid = game.spawnMonster({
      hcIdx: 1,
      x: 101,
      y: 100,
      areaId: 2,
      hp: 1000,
      maxHp: 1000,
      ac: 0,
      aiDisabled: true,
    })
    const m = internal.monsters.get(mid)!
    m.toBlock = 0

    // Teleport (#54) blocked!
    game.enqueueCommand(pid, { type: 'CastSkillAtLocation', skillId: 54, x: 115, y: 100 })
    game.stepFrame()
    expect(p.x).toBe(100)

    // Blessed Hammer (#112) blocked!
    game.enqueueCommand(pid, { type: 'CastSkillAtLocation', skillId: 112, x: 100, y: 100 })
    game.stepFrame()
    expect(internal.missiles.size).toBe(0)

    // Rabies (#238, wolf-only restrict=2) blocked in Bone Fetish form!
    game.enqueueCommand(pid, {
      type: 'CastSkillOnTarget',
      skillId: 238,
      targetId: mid,
      targetType: 1,
    })
    game.stepFrame()
    expect(m.states.has(STATE_RABIES_113C)).toBe(false)

    // Normal Attack (#0) allowed in Bone Fetish form!
    game.enqueueCommand(pid, {
      type: 'CastSkillOnTarget',
      skillId: 0,
      targetId: mid,
      targetType: 1,
    })
    game.stepFrame()
    expect(m.hp).toBeLessThan(1000)

    // Armageddon (#249, restrict=1) allowed in Bone Fetish form!
    game.enqueueCommand(pid, { type: 'CastSkillAtLocation', skillId: 249, x: 100, y: 100 })
    game.stepFrame()
    expect(internal.missiles.size).toBeGreaterThan(0)

    // Casting Werewolf (#223) clears STATE_DELERIUM (177) and transitions cleanly into wolf (139)!
    game.stepFrames(160)
    game.enqueueCommand(pid, { type: 'CastSkillAtLocation', skillId: 223, x: 100, y: 100 })
    game.stepFrame()
    expect(p.states.has(STATE_DELERIUM_113C)).toBe(false)
    expect(p.states.has(139)).toBe(true)
  })
})
