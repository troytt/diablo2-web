/**
 * Wave 4 P1 Combat, Stats, S2C Pool/Stat Wire & Missile Parity Suite
 * (`#1856`, `#1863`, `#1864`, `#1865`, `#1866`, `#1867`, `#1868`, `#1869`,
 *  `#1870`, `#1871`, `#1872`, `#1873`, `#1874`, `#1875`, `#1876`).
 *
 * Ground truth: Diablo II: Lord of Destruction v1.13c (`D2Game.dll`, `D2Common.dll`,
 * `D2Client.dll`, and MPQ `Skills.txt`, `Missiles.txt`, `ItemStatCost.txt`, `Weapons.txt`).
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import {
  decodePacket,
  encode0x18LifeManaRegen,
  encode0x1D_0x1E_0x1FStat,
  encode0x95LifeMana,
  encode0x95LifeManaPot,
  serverEventToS2cPackets,
} from '../../src/netproto/index.ts'
import { SummonManager } from '../../src/server/ai/summon-manager.ts'
import { AuraScanner } from '../../src/server/engine/aura-scanner.ts'
import {
  calculateCrushingBlow113c,
  calculateOpenWounds113c,
  computeToHitChance,
  evaluateAvoidanceAndBlock,
  executeSUnitDmg,
  resolveWeaponAttrFactors113c,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { MissileEngine } from '../../src/server/engine/missile-engine.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import {
  FIXED_ONE,
  UnitStatList,
  getEffectiveWeaponPoison113c,
} from '../../src/server/engine/stat-list.ts'

type AnyRec = Record<string, any>

const registry = getSharedDataRegistry()
let nextItemId = 40_000

function makeItem(
  code: string,
  bodyLoc: number,
  rawStats: { statId: number; param?: number; value: number }[] = [],
  extra: AnyRec = {},
): AnyRec {
  const statsMap = new Map<number, number>()
  for (const st of rawStats) {
    statsMap.set(st.statId, (statsMap.get(st.statId) ?? 0) + st.value)
  }
  return {
    unitId: nextItemId++,
    code,
    name: code,
    quality: 4,
    level: 85,
    location: 'equipped',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    bodyLoc,
    identified: true,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: 20,
    maxDurability: 20,
    quantity: 1,
    stats: statsMap,
    socketedItems: [],
    rawItemData: {
      identified: true,
      ethereal: false,
      stats: rawStats.map((s) => ({ statId: s.statId, param: s.param ?? 0, value: s.value })),
      runewordStats: [],
    },
    ...extra,
  }
}

function makeUnitCtx(
  id: string,
  unitType: NonNullable<CombatUnitContext['unitType']>,
  charClass?: string,
  extra: Partial<CombatUnitContext> = {},
): CombatUnitContext {
  const statList = new UnitStatList(
    registry,
    undefined,
    unitType === 'player'
      ? { ownerType: 'player', ...(charClass !== undefined ? { charClass } : {}) }
      : { ownerType: 'monster' },
  )
  statList.setBaseStat('level', 80)
  statList.setBaseStat('maxhp', 4000 * FIXED_ONE)
  statList.setHp256(4000 * FIXED_ONE)
  const stateBus = new StateBus(statList, registry)
  return {
    id,
    name: id,
    ...(charClass !== undefined ? { charClass } : {}),
    statList,
    stateBus,
    x: 50,
    y: 50,
    ...extra,
    unitType,
  }
}

function setupRoom(
  seed: number,
  charClass: string,
  skills: Record<number, number> = {},
  difficulty: 0 | 1 | 2 = 0,
): { game: GameInstance; g: AnyRec; pid: number; player: AnyRec } {
  const game = new GameInstance({ seed, difficulty, areaId: 2 })
  const pid = game.connectPlayer({
    charClass,
    name: `W4${charClass}`,
    x: 50,
    y: 50,
    areaId: 2,
    skills,
  })
  const g = game as unknown as AnyRec
  const player = g.players.get(pid)
  player.level = 80
  player.maxHp = 3000
  player.hp = 3000
  player.maxHpFixed = 3000 * FIXED_ONE
  player.hpFixed = 3000 * FIXED_ONE
  player.maxMana = 1000
  player.mana = 1000
  player.maxManaFixed = 1000 * FIXED_ONE
  player.manaFixed = 1000 * FIXED_ONE
  player.strength = 100
  player.dexterity = 100
  player.ar = 50_000
  game.drainEvents(pid)
  return { game, g, pid, player }
}

function spawnDummy(
  game: GameInstance,
  g: AnyRec,
  defId = 'fallen1',
  x = 52,
  y = 50,
  hp = 50_000,
): AnyRec {
  const monId = game.spawnMonster({ defId, x, y, areaId: 2, hp, maxHp: hp, aiDisabled: true })
  const mon = g.monsters.get(monId)
  mon.ac = 0
  mon.toBlock = 0
  mon.damageRegen = 0
  mon.resistances = { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 }
  return mon
}

describe('#1856 S2C 0x1D/0x1E/0x1F signed negative stat encoding & 0x95 LifeManaPot high-pool wire', () => {
  it('encodes negative player stats as 6-byte signed 0x1F (never unsigned 0x1D/0x1E wraparound) and round-trips', () => {
    for (const neg of [-1, -40, -100, -500]) {
      const pkt = encode0x1D_0x1E_0x1FStat(39, neg)
      expect(pkt[0]).toBe(0x1f)
      expect(pkt.byteLength).toBe(6)
      const decoded = decodePacket(pkt, 'S2C')
      expect(decoded.ok).toBe(true)
      expect(decoded.event).toMatchObject({ type: 'StatSet', stat: 39, value: neg })
    }

    const posByte = encode0x1D_0x1E_0x1FStat(39, 75)
    expect(posByte[0]).toBe(0x1d)
    expect(posByte.byteLength).toBe(3)

    const posWord = encode0x1D_0x1E_0x1FStat(7, 12800)
    expect(posWord[0]).toBe(0x1e)
    expect(posWord.byteLength).toBe(4)

    const goldDelta = encode0x1D_0x1E_0x1FStat(14, 200, 1)
    expect(goldDelta[0]).toBe(0x19)
    expect(goldDelta.byteLength).toBe(2)

    // Mercenary negative stat uses 0xA0 (10B signed i32), never 0x9E/0x9F
    const mercPkts = serverEventToS2cPackets({
      type: 'Merc',
      kind: 'stat',
      mercId: 777,
      stat: 39,
      value: -65,
    })
    expect(mercPkts).toHaveLength(1)
    expect(mercPkts[0]![0]).toBe(0xa0)
    expect(mercPkts[0]!.byteLength).toBe(10)
    expect(decodePacket(mercPkts[0]!, 'S2C').event).toMatchObject({
      type: 'Merc',
      kind: 'stat',
      mercId: 777,
      stat: 39,
      value: -65,
    })
  })

  it('encodes high-HP/Mana (> 4096 up to 32767) via 13-byte S2C 0x95 LifeManaPot and 15-byte 0x18 when regen is present', () => {
    const potPkt = encode0x95LifeManaPot({
      life: 6200,
      mana: 4800,
      stamina: 2500,
      x: 5123,
      y: 5456,
      vx: -5,
      vy: 7,
    })
    expect(potPkt[0]).toBe(0x95)
    expect(potPkt.byteLength).toBe(13)
    const dec95 = decodePacket(potPkt, 'S2C')
    expect(dec95.ok).toBe(true)
    expect(dec95.event).toMatchObject({
      type: 'LifeMana',
      life: 6200,
      mana: 4800,
      stamina: 2500,
      at: { x: 5123, y: 5456 },
      vx: -5,
      vy: 7,
    })

    const dispatched95 = serverEventToS2cPackets({
      type: 'LifeMana',
      life: 5400,
      mana: 3300,
      stamina: 1900,
      at: { x: 100, y: 200 },
      vx: 0,
      vy: 0,
    })
    expect(dispatched95).toHaveLength(1)
    expect(dispatched95[0]![0]).toBe(0x95)

    const regenPkt = encode0x18LifeManaRegen({
      life: 5400,
      mana: 3300,
      stamina: 1900,
      lifeRegen: 12,
      manaRegen: 8,
      x: 100,
      y: 200,
    })
    expect(regenPkt[0]).toBe(0x18)
    expect(regenPkt.byteLength).toBe(15)
  })
})

describe('#1863 Server player base defense floor(totalDex / 4) in ToHit & panel calculation', () => {
  it('includes base + gear + charm + buff dexterity in computePlayerDefense without double-counting in ToHit', () => {
    const { g, player } = setupRoom(0x1863, 'pal')
    player.dexterity = 60 // 15 def
    player.items.push(
      makeItem('rin', 6, [{ statId: 2, value: 20 }]), // +20 gear dex -> 80 (+5 def)
      makeItem('cm1', 0, [{ statId: 2, value: 12 }], { location: 'inventory', x: 0, y: 0 }), // +12 charm dex -> 92 (+3 def)
    )
    const combat = g.playerCombatContext(player)
    combat.stateBus.applyState({
      stateNameOrId: 'shrine_dex',
      sourceUnitId: `player_${player.unitId}`,
      sourceSkillId: 0,
      slvl: 1,
      durationFrames: 500,
      currentFrame: 0,
      stats: { dexterity: 8 }, // +8 buff dex -> totalDex = 100 -> floor(100 / 4) = 25
    })
    expect(g.computePlayerBaseDefense(player)).toBe(25)
    expect(g.computePlayerDefense(player)).toBe(25)

    // Verify UnitStatList.getDefense() vs armorClassIncludesDex guard
    const unit = makeUnitCtx('p1', 'player', 'pal', { armorClassIncludesDex: true })
    unit.statList.setBaseStat('dexterity', 100)
    unit.statList.setBaseStat('armorclass', 25)
    expect(unit.statList.getDefense()).toBe(50) // raw statList adds dex/4 when armorclass was armor-only
    expect(unit.statList.getDefense({ includeDexterityBonus: !unit.armorClassIncludesDex })).toBe(25)
  })
})

describe('#1864 Main 10x4 inventory charms (cm1/cm2/cm3) apply resistances & passive stats; stash/cube excluded', () => {
  it('counts identified 10x4 charms with clvl >= reqLvl and ignores stash, cube, unidentified, and duplicate unique charms', () => {
    const { g, player } = setupRoom(0x1864, 'sor')
    player.level = 75
    player.items.push(
      // Valid 10x4 small charm: +11% Fire Res, +5% Max Fire Res, +10 Fire Absorb
      makeItem(
        'cm1',
        0,
        [
          { statId: 39, value: 11 },
          { statId: 40, value: 5 },
          { statId: 143, value: 10 },
        ],
        { location: 'inventory', x: 0, y: 0, width: 1, height: 1 },
      ),
      // Valid 10x4 grand charm: +30% Poison Res, +1 All Skills
      makeItem(
        'cm3',
        0,
        [
          { statId: 45, value: 30 },
          { statId: 127, value: 1 },
        ],
        { location: 'inventory', x: 1, y: 0, width: 1, height: 3 },
      ),
      // Stash charm -> MUST be ignored
      makeItem('cm1', 0, [{ statId: 39, value: 50 }], { location: 'stash', x: 0, y: 0 }),
      // Cube charm -> MUST be ignored
      makeItem('cm1', 0, [{ statId: 39, value: 50 }], { location: 'cube', x: 0, y: 0 }),
      // Unidentified inventory charm -> MUST be ignored
      makeItem('cm1', 0, [{ statId: 39, value: 50 }], {
        location: 'inventory',
        x: 5,
        y: 0,
        identified: false,
      }),
      // Duplicate unique Annihilus (`cm1`, quality 7, uniqueId 381) -> only first copy counts
      makeItem('cm1', 0, [{ statId: 43, value: 20 }], {
        location: 'inventory',
        x: 6,
        y: 0,
        quality: 7,
        rawItemData: {
          identified: true,
          ethereal: false,
          uniqueId: 381,
          stats: [{ statId: 43, param: 0, value: 20 }],
          runewordStats: [],
        },
      }),
      makeItem('cm1', 0, [{ statId: 43, value: 20 }], {
        location: 'inventory',
        x: 7,
        y: 0,
        quality: 7,
        rawItemData: {
          identified: true,
          ethereal: false,
          uniqueId: 381,
          stats: [{ statId: 43, param: 0, value: 20 }],
          runewordStats: [],
        },
      }),
    )

    expect(g.playerResistPct(player, 'fire')).toBe(11)
    expect(g.playerResistPct(player, 'poison')).toBe(30)
    expect(g.playerResistPct(player, 'cold')).toBe(20)
    expect(g.playerElementalAbsorb(player, 'fire')).toEqual({ pct: 0, flat: 10 })
    expect(g.sumPlayerItemStat(player, 127)).toBe(1)
  })
})

describe('#1865 Running (PLRMODE_RUN) vs ranged projectiles & shield block penalty', () => {
  it('auto-hits running player on melee ONLY, while ranged missile still rolls ToHit with 0 AC & 1/3 block cap 25%', () => {
    const mon = makeUnitCtx('mon', 'monster')
    mon.statList.setBaseStat('level', 80)
    mon.statList.setBaseStat('tohit', 100) // low AR vs lvl 80 -> hit chance < 95% even with 0 AC
    const runner = makeUnitCtx('plr', 'player', 'pal', {
      isRunning: true,
      isMoving: true,
      hasShield: true,
    })
    runner.statList.setBaseStat('level', 80)
    runner.statList.setBaseStat('dexterity', 200)
    runner.statList.setBaseStat('armorclass', 5000)
    runner.statList.setBaseStat('toblock', 75)

    // Melee auto-hits even when roll100 === 99 (bypasses ToHit completely)
    const testRng = new D2Rng(0x1865)
    const meleeRes = executeSUnitDmg(mon, runner, {
      skillId: 0,
      rng: testRng,
      attackKind: 'melee',
      flatPhysMin256: 100 * FIXED_ONE,
      flatPhysMax256: 100 * FIXED_ONE,
      roll100: 99,
      blockRoll100: 99,
    })
    expect(meleeRes.hit).toBe(true)

    // Ranged projectile MUST roll ToHit (`[5%, 95%]` clamped -> roll100 = 96 misses!)
    const mslMiss = executeSUnitDmg(mon, runner, {
      skillId: 0,
      rng: testRng,
      attackKind: 'missile',
      flatPhysMin256: 100 * FIXED_ONE,
      flatPhysMax256: 100 * FIXED_ONE,
      roll100: 96,
      blockRoll100: 99,
    })
    expect(mslMiss.hit).toBe(false)
    expect(mslMiss.avoidedReason).toBe('miss')

    // Shield block while running is min(25, floor(effBlock / 3)): roll 24 blocks, roll 25 does NOT block
    const rng = new D2Rng(0x1865)
    runner.statList.setBaseStat('dexterity', 400) // ensures raw effective block reaches 75% -> 75 / 3 = 25%
    expect(
      evaluateAvoidanceAndBlock({ defender: runner, attackKind: 'missile', rng, roll100: 24 }).avoided,
    ).toBe(true)
    expect(
      evaluateAvoidanceAndBlock({ defender: runner, attackKind: 'missile', rng, roll100: 25 }).avoided,
    ).toBe(false)

    // Walking keeps full 75% block
    const walker = makeUnitCtx('plr_walk', 'player', 'pal', {
      isWalking: true,
      isMoving: true,
      hasShield: true,
    })
    walker.statList.setBaseStat('level', 80)
    walker.statList.setBaseStat('dexterity', 400)
    walker.statList.setBaseStat('toblock', 75)
    expect(
      evaluateAvoidanceAndBlock({ defender: walker, attackKind: 'missile', rng, roll100: 74 }).avoided,
    ).toBe(true)
  })
})

describe('#1866 Ignore Target Defense (stat 115) & -% Target Defense (stat 116) monster rank masks', () => {
  it('allows ITD only on normal/minion, and halves -% Target Defense only on Boss/SuperUnique/Player/Merc', () => {
    const base = {
      attackerAr: 1000,
      defenderDef: 2000,
      attackerLvl: 80,
      defenderLvl: 80,
      skillArBonusPct: 0,
      itemArBonusPct: 0,
    }
    // Normal / Minion: ITD works -> 95%
    expect(
      computeToHitChance({
        ...base,
        ignoreTargetAc: true,
        blocksIgnoreTargetDefense: false,
      }),
    ).toBe(95)

    // Champion / Random Unique: ITD blocked (`blocksIgnoreTargetDefense = true`),
    // BUT -100% Target Defense (`fractionalTargetAc = -100`) applies at FULL 100% -> 0 def -> 95%!
    const atk = makeUnitCtx('atk', 'player', 'bar')
    atk.statList.setBaseStat('tohit', 1000)
    atk.statList.setBaseStat('item_ignoretargetac', 1)
    const champ = makeUnitCtx('champ', 'monster', undefined, { rank: 'champion', isChampion: true })
    champ.statList.setBaseStat('armorclass', 2000)
    const itdRng = new D2Rng(0x1866)
    const itdVsChamp = executeSUnitDmg(atk, champ, {
      skillId: 0,
      rng: itdRng,
      attackKind: 'melee',
      flatPhysMin256: 50 * FIXED_ONE,
      flatPhysMax256: 50 * FIXED_ONE,
      roll100: 50, // 1000 / 3000 = 33% hit chance -> roll 50 misses because ITD is blocked on Champion!
    })
    expect(itdVsChamp.hit).toBe(false)

    atk.statList.setBaseStat('item_ignoretargetac', 0)
    atk.statList.setBaseStat('item_fractionaltargetac', 100)
    const uniq = makeUnitCtx('uniq', 'monster', undefined, { rank: 'unique' })
    uniq.statList.setBaseStat('armorclass', 2000)
    const fracVsUnique = executeSUnitDmg(atk, uniq, {
      skillId: 0,
      rng: itdRng,
      attackKind: 'melee',
      flatPhysMin256: 50 * FIXED_ONE,
      flatPhysMax256: 50 * FIXED_ONE,
      roll100: 94,
    })
    expect(fracVsUnique.hit).toBe(true) // -100% NOT halved on Random Unique -> 0 def -> 95%

    // SuperUnique / Boss / Player: -100% IS halved to -50% -> 2000 -> 1000 def -> 50% hit chance
    const boss = makeUnitCtx('boss', 'monster', undefined, { isBoss: true })
    boss.statList.setBaseStat('armorclass', 2000)
    const fracVsBoss = executeSUnitDmg(atk, boss, {
      skillId: 0,
      rng: itdRng,
      attackKind: 'melee',
      flatPhysMin256: 50 * FIXED_ONE,
      flatPhysMax256: 50 * FIXED_ONE,
      roll100: 60, // 50% hit chance -> roll 60 misses!
    })
    expect(fracVsBoss.hit).toBe(false)
  })
})

describe('#1867 Weapon StrBonus/DexBonus factors & -90% total %ED floor', () => {
  it('resolves exact 1.13c Weapons.txt StrBonus/DexBonus across weapon classes and clamps total %ED >= -90%', () => {
    const dummy = makeUnitCtx('p', 'player', 'ama')
    expect(resolveWeaponAttrFactors113c({ ...dummy, weaponItemType: 'bow' }, 'missile')).toEqual({
      strBonus: 0,
      dexBonus: 100,
    })
    expect(resolveWeaponAttrFactors113c({ ...dummy, weaponItemType: 'ajav' }, 'melee')).toEqual({
      strBonus: 80,
      dexBonus: 50,
    })
    expect(resolveWeaponAttrFactors113c({ ...dummy, weaponItemType: 'aspe' }, 'melee')).toEqual({
      strBonus: 80,
      dexBonus: 50,
    })
    expect(resolveWeaponAttrFactors113c({ ...dummy, weaponItemType: 'hamm' }, 'melee')).toEqual({
      strBonus: 110,
      dexBonus: 0,
    })
    expect(resolveWeaponAttrFactors113c({ ...dummy, weaponItemType: 'h2h' }, 'melee')).toEqual({
      strBonus: 75,
      dexBonus: 75,
    })
    expect(resolveWeaponAttrFactors113c({ ...dummy, weaponItemType: 'knif' }, 'melee')).toEqual({
      strBonus: 75,
      dexBonus: 75,
    })
    expect(resolveWeaponAttrFactors113c({ ...dummy, weaponItemType: 'taxe' }, 'missile')).toEqual({
      strBonus: 75,
      dexBonus: 75,
    })
    expect(resolveWeaponAttrFactors113c({ ...dummy, weaponCode: 'hdm', weaponItemType: 'hamm' }, 'melee')).toEqual({
      strBonus: 100,
      dexBonus: 0,
    })

    // -90% total %ED floor (Weaken/Decrepify -250% -> 10% minimum multiplier, never 0)
    const atk = makeUnitCtx('atk', 'player', 'bar', { weaponMinPhys: 100, weaponMaxPhys: 100, weaponItemType: 'swor' })
    atk.statList.setBaseStat('strength', 0)
    atk.stateBus.applyState({
      stateNameOrId: 'decrepify',
      sourceUnitId: 'mon_1',
      sourceSkillId: 87,
      slvl: 10,
      durationFrames: 200,
      currentFrame: 0,
      stats: { damagepercent: -250 },
    })
    const def = makeUnitCtx('def', 'monster')
    const out = executeSUnitDmg(atk, def, {
      skillId: 0,
      rng: new D2Rng(0x1867),
      attackKind: 'melee',
      srcDam: 128,
      autoHit: true,
      unblockable: true,
    })
    expect(out.totalDamage).toBe(10) // 100 * (100 - 90) / 100 = 10
  })
})

describe('#1868 Grief +Damage (stat 111) on #97 Smite & excluded from #111 Vengeance conversion', () => {
  it('adds Grief stat 111 to Smite shield base BEFORE %ED while excluding Demon %ED, +Max, CS/DS, and regular leech', () => {
    const pal = makeUnitCtx('pal', 'player', 'pal', {
      hasShield: true,
      smiteMinDam: 46,
      smiteMaxDam: 46, // Zakarum Shield
    })
    pal.statList.setBaseStat('strength', 100) // +100% ED
    pal.statList.setBaseStat('item_normaldamage', 400) // Grief +400
    pal.statList.setBaseStat('maxdamage', 50) // +50 Max Damage charm -> MUST be ignored by Smite!
    pal.statList.setBaseStat('item_demondamage_percent', 350) // Laying of Hands -> MUST be ignored by Smite!
    pal.statList.setBaseStat('item_deadlystrike', 100) // 100% DS -> MUST NOT crit on Smite!
    pal.statList.setBaseStat('lifedrainmindam', 20) // 20% LL -> MUST NOT leech on Smite!
    pal.statList.setBaseStat('firemindam', 200)
    pal.statList.setBaseStat('firemaxdam', 200) // Weapon fire rider -> MUST NOT apply on Smite!
    pal.statList.setHp256(1000 * FIXED_ONE)

    const demon = makeUnitCtx('demon', 'monster', undefined, { isDemon: true, drain: 100 })
    const smiteRng = new D2Rng(0x1868)
    // Smite slvl 20 = +300% ED; total ED = 100 (Str) + 300 (Smite) = +400% -> 5x multiplier
    // Base = 46 + 400 = 446 -> 446 * 5 = 2230
    const smiteOut = executeSUnitDmg(pal, demon, {
      skillId: 97,
      slvl: 20,
      rng: smiteRng,
      physDamagePct: 300,
      attackKind: 'melee',
      autoHit: true,
      unblockable: true,
    })
    expect(smiteOut.physDamage256).toBe(2230 * FIXED_ONE)
    expect(smiteOut.elemDamage256).toBe(0)
    expect(smiteOut.isCritical).toBeFalsy()
    expect(smiteOut.attackerHealed256 ?? 0).toBe(0)

    // #82 Life Tap (state 25) on full-HP defender DOES heal Smite 50%!
    demon.statList.setHp256(4000 * FIXED_ONE)
    demon.stateBus.applyState({
      stateNameOrId: 25,
      sourceUnitId: 'pal',
      sourceSkillId: 82,
      slvl: 5,
      durationFrames: 200,
      currentFrame: 0,
    })
    const smiteLifeTap = executeSUnitDmg(pal, demon, {
      skillId: 97,
      slvl: 20,
      rng: smiteRng,
      physDamagePct: 300,
      attackKind: 'melee',
      autoHit: true,
      unblockable: true,
    })
    expect(smiteLifeTap.attackerHealed256).toBe(1115 * FIXED_ONE)
  })

  it('includes Grief stat 111 in #111 Vengeance physical hit while excluding it from Fire/Cold/Light conversion', () => {
    const { game, g, player } = setupRoom(0x1868, 'pal', { 111: 1 })
    player.strength = 0
    player.dexterity = 0
    // Phase Blade (`7cr`, 31-35 base; force +4 min so base = 35..35) with Grief +400 (`stat 111`)
    player.items.push(
      makeItem('7cr', 4, [
        { statId: 21, value: 4 },
        { statId: 111, value: 400 },
        { statId: 19, value: 25_000 },
        { statId: 115, value: 1 },
      ]),
    )
    const convBase = g.resolvePlayerWeaponDamage(player, 0, {
      excludeNormalDamage: true,
      baseOnlyWithoutOffWeaponEd: true,
    })
    expect(convBase).toEqual({ min: 35, max: 35 }) // Grief +400 excluded!

    const fullWeap = g.resolvePlayerWeaponDamage(player, 0)
    expect(fullWeap).toEqual({ min: 435, max: 435 }) // Grief +400 included in physical!

    // Live Vengeance strike on Physical-Immune monster: only converted Fire + Cold + Light land (`3 * floor(35 * 70 / 100) = 3 * 24 = 72`), NOT 3 * floor(435 * 0.7) = 912!
    const mon = spawnDummy(game, g, 'fallen1', 51, 50, 10_000)
    mon.resistances.phys = 100
    g.executeSkillOnTarget(player, 111, mon.unitId)
    const lostHp = 10_000 - mon.hp
    expect(lostHp).toBe(72)
  })
})

describe('#1869 Crushing Blow (stat 136): /players N scaling, rank/ranged divisors, & negative physRes clamp', () => {
  it('matches 1.13c 0x6FCF6C10 across ranks, ranged, /players 8, positive DR%, and negative Amplify Damage', () => {
    // Normal / Champion melee = 1/4, ranged = 1/8
    expect(
      calculateCrushingBlow113c({
        defenderHp: 1800,
        unitType: 'monster',
        rank: 'normal',
        playerCount: 1,
        isRanged: false,
        physResPct: 0,
      }).damage,
    ).toBe(450)
    expect(
      calculateCrushingBlow113c({
        defenderHp: 1800,
        unitType: 'monster',
        rank: 'champion',
        playerCount: 1,
        isRanged: false,
        physResPct: 0,
      }).damage,
    ).toBe(450)

    // Boss / Unique / SuperUnique melee = 1/8, ranged = 1/16
    expect(
      calculateCrushingBlow113c({
        defenderHp: 1600,
        unitType: 'monster',
        rank: 'unique',
        playerCount: 1,
        isRanged: false,
        physResPct: 0,
      }).damage,
    ).toBe(200)
    expect(
      calculateCrushingBlow113c({
        defenderHp: 1600,
        unitType: 'monster',
        isBoss: true,
        playerCount: 1,
        isRanged: true,
        physResPct: 0,
      }).damage,
    ).toBe(100)

    // PvP melee = 1/10, ranged = 1/20
    expect(
      calculateCrushingBlow113c({
        defenderHp: 2000,
        unitType: 'player',
        playerCount: 1,
        isRanged: false,
        physResPct: 0,
      }).damage,
    ).toBe(200)
    expect(
      calculateCrushingBlow113c({
        defenderHp: 2000,
        unitType: 'player',
        playerCount: 1,
        isRanged: true,
        physResPct: 0,
      }).damage,
    ).toBe(100)

    // /players 8 normal melee: divisor = 4 + trunc(4 * 7 * 50 / 100) = 18 -> 1800 / 18 = 100
    expect(
      calculateCrushingBlow113c({
        defenderHp: 1800,
        unitType: 'monster',
        rank: 'normal',
        playerCount: 8,
        isRanged: false,
        physResPct: 0,
      }).damage,
    ).toBe(100)

    // Positive 50% DR halves CB, whereas -100% Amplify Damage does NOT boost CB above raw fraction!
    expect(
      calculateCrushingBlow113c({
        defenderHp: 1600,
        unitType: 'monster',
        rank: 'normal',
        playerCount: 1,
        isRanged: false,
        physResPct: 50,
      }).damage,
    ).toBe(200)
    expect(
      calculateCrushingBlow113c({
        defenderHp: 1600,
        unitType: 'monster',
        rank: 'normal',
        playerCount: 1,
        isRanged: false,
        physResPct: -100,
      }).damage,
    ).toBe(400)
  })
})

describe('#1870 Open Wounds (stat 135) 200-frame bleed, 5-band clvl formula, regen block & player-only PMH', () => {
  it('computes exact 5-band clvl Open Wounds tick256 and PvP/Boss divisors', () => {
    const owRate = (clvl: number, opts?: { isBoss?: boolean; isPlayer?: boolean; isRanged?: boolean }) =>
      calculateOpenWounds113c({
        attackerLvl: clvl,
        isRanged: opts?.isRanged,
        defender: {
          unitType: opts?.isPlayer ? 'player' : 'monster',
          ...(opts?.isBoss ? { isBoss: true } : {}),
        },
      }).bitrate256
    expect(owRate(10)).toBe(9 * 10 + 31) // 121
    expect(owRate(25)).toBe(18 * 25 - 104) // 346
    expect(owRate(40)).toBe(27 * 40 - 374) // 706
    expect(owRate(55)).toBe(36 * 55 - 779) // 1201
    expect(owRate(85)).toBe(45 * 85 - 1319) // 2506
    expect(owRate(85, { isBoss: true })).toBe(1253)
    expect(owRate(85, { isPlayer: true, isRanged: false })).toBe(Math.floor(2506 / 4))
    expect(owRate(85, { isPlayer: true, isRanged: true })).toBe(Math.floor(2506 / 8))
  })

  it('bleeds monsters over 200 frames in GameInstance, suppresses natural regen, and restricts PMH to players & non-Ubers', () => {
    const { game, g, player } = setupRoom(0x1870, 'bar')
    player.level = 85 // tick256 = 2506 -> over 200 frames: floor(2506 * 200 / 256) = 1957 HP!
    player.items.push(
      makeItem('7cr', 4, [
        { statId: 135, value: 100 }, // 100% Open Wounds
        { statId: 117, value: 1 }, // PMH (item_preventheal = 117)
        { statId: 19, value: 25_000 },
        { statId: 115, value: 1 },
      ]),
    )
    const mon = spawnDummy(game, g, 'fallen1', 51, 50, 20_000)
    mon.damageRegen = 64 // high natural regen that MUST be suppressed!

    g.applyDamageToMonster(player, mon, 10, 0, 'phys', 'player', { autoHit: true, unblockable: true })
    const hpAfterHit = mon.hp
    expect(mon.states.has(62)).toBe(true) // Open Wounds state
    expect(mon.states.has(52)).toBe(true) // PMH state

    game.stepFrames(200)
    expect(hpAfterHit - mon.hp).toBe(Math.floor((2506 * 200) / 256))

    // Uber Prime Evil (`hcIdx = 705` Uber Baal) ignores PMH (`stat 117`)
    const uber = spawnDummy(game, g, 'fallen1', 53, 50, 20_000)
    uber.hcIdx = 705
    g.applyMonsterPreventHeal113c(uber)
    expect(uber.states.has(52)).toBe(false)
  })
})

describe('#1871 Multi-source Poison concurrency, #278 Venom 10-frame clamp + #73 Poison Dagger, & PLR', () => {
  it('sums bitrates & averages durations on multi-source poison, clamps item/charm poison to 10f under Venom, and extends #73 Poison Dagger + 10f', () => {
    const rng = new D2Rng(0x1871)
    // 2 sources without Venom: (100 rate, 100f) + (300 rate, 200f) -> rate = 400, len = floor(300 / 2) = 150f
    const multi = getEffectiveWeaponPoison113c(
      [
        { minBitrate256: 100, maxBitrate256: 100, lengthFrames: 100 },
        { minBitrate256: 300, maxBitrate256: 300, lengthFrames: 200 },
      ],
      false,
      0,
      0,
      rng,
    )
    expect(multi).toEqual({ bitrate256: 400, lengthFrames: 150 })

    // With #278 Venom (state 31, 500 rate over 10f): item/charm durations clamp to 10f, bitrates sum -> 900 over 10f!
    const withVenom = getEffectiveWeaponPoison113c(
      [
        { minBitrate256: 100, maxBitrate256: 100, lengthFrames: 150 },
        { minBitrate256: 300, maxBitrate256: 300, lengthFrames: 250 },
      ],
      true,
      500,
      500,
      rng,
    )
    expect(withVenom).toEqual({ bitrate256: 900, lengthFrames: 10 })

    // #73 Poison Dagger + #278 Venom + 10x4 Poison Small Charm in GameInstance: duration = skillFrames + 10!
    const { game, g, player } = setupRoom(0x1871a, 'nec', { 73: 5 })
    player.items.push(
      makeItem('dgr', 4, [
        { statId: 19, value: 25_000 },
        { statId: 115, value: 1 },
      ]),
      makeItem(
        'cm1',
        0,
        [
          { statId: 57, value: 256 },
          { statId: 58, value: 256 },
          { statId: 59, value: 200 },
        ],
        { location: 'inventory', x: 0, y: 0 },
      ),
    )
    player.states.add(31)
    g.playerCombatContext(player).stateBus.applyState({
      stateNameOrId: 31,
      sourceUnitId: `player_${player.unitId}`,
      sourceSkillId: 278,
      slvl: 10,
      durationFrames: 4000,
      currentFrame: 0,
      stats: { poisonmindam: 512, poisonmaxdam: 512, poisonlength: 10 },
    })
    const cast73 = g.resolvePlayerSkillCast(player, 73)
    const mon = spawnDummy(game, g, 'fallen1', 51, 50, 50_000)
    g.executeSkillOnTarget(player, 73, mon.unitId)
    expect(mon.poisonRemainingFrames).toBe(cast73.evalResult.durationFrames + 10)
    expect(mon.poisonBitrate256).toBeGreaterThanOrEqual(cast73.evalResult.minElemDmg256 + 256 + 512)

    // Defender PLR (`stat 110`) with Hell -100 penalty: 75% gear PLR -> -25% effective -> 100f * 125 / 100 = 125f
    const poisAtk = makeUnitCtx('m_pois', 'monster')
    const hellDef = makeUnitCtx('p_hell', 'player', 'pal', { resistPenalty: -100 })
    hellDef.statList.setBaseStat('item_poisonlengthresist', 75)
    const plrOut = executeSUnitDmg(poisAtk, hellDef, {
      skillId: 0,
      rng: new D2Rng(0x1871b),
      attackKind: 'spell',
      elemType: 'pois',
      elemMin256: 256,
      elemMax256: 256,
      elemDurationFrames: 100,
      autoHit: true,
      unblockable: true,
    })
    expect(plrOut.poisonDurationFrames).toBe(125)
  })
})

describe('#1872 Life/Mana Leech, #82 Life Tap & Thorns/Iron Maiden clamp to min(finalPhys, targetCurHp)', () => {
  it('clamps leech, Life Tap, and Iron Maiden reflection to remaining target HP instead of overkill damage', () => {
    const atk = makeUnitCtx('atk', 'player', 'bar', {
      lifeStealDivisor: 1,
      manaStealDivisor: 1,
    })
    atk.statList.setBaseStat('lifedrainmindam', 100) // 100% life steal
    atk.statList.setBaseStat('manadrainmindam', 100) // 100% mana steal
    atk.statList.setHp256(500 * FIXED_ONE)
    atk.statList.setBaseStat('maxmana', 1000 * FIXED_ONE)
    atk.statList.setMana256(100 * FIXED_ONE)
    // Iron Maiden 200% on player attacker (1.13c 0x6FD13E90 divides player returnPct by 4 -> 50%)
    atk.stateBus.applyState({
      stateNameOrId: 55,
      sourceUnitId: 'mon_obliv',
      sourceSkillId: 76,
      slvl: 1,
      durationFrames: 500,
      currentFrame: 0,
      stats: { thorns_percent: 200 },
    })

    // Defender has ONLY 10 HP left, hit for 1000 physical damage!
    const lowHpMon = makeUnitCtx('low_mon', 'monster', undefined, { drain: 100 })
    lowHpMon.statList.setHp256(10 * FIXED_ONE)
    const leechRng = new D2Rng(0x1872)
    const out = executeSUnitDmg(atk, lowHpMon, {
      skillId: 0,
      rng: leechRng,
      attackKind: 'melee',
      flatPhysMin256: 1000 * FIXED_ONE,
      flatPhysMax256: 1000 * FIXED_ONE,
      autoHit: true,
      unblockable: true,
    })
    expect(out.attackerHealed256).toBe(10 * FIXED_ONE)
    expect(out.attackerManaLeeched256).toBe(10 * FIXED_ONE)
    expect(out.reflectedPhys256).toBe(5 * FIXED_ONE) // floor(200/4)% = 50% of clamped 10 HP = 5, NEVER 500!

    // #82 Life Tap heals 50% of clamped 10 HP (= 5 HP) even against Drain=0 Skeleton in Hell!
    const skel = makeUnitCtx('skel', 'monster', undefined, { drain: 0 })
    skel.statList.setHp256(10 * FIXED_ONE)
    skel.stateBus.applyState({
      stateNameOrId: 25,
      sourceUnitId: 'atk',
      sourceSkillId: 82,
      slvl: 5,
      durationFrames: 300,
      currentFrame: 0,
    })
    const hellAtk = makeUnitCtx('hell_atk', 'player', 'pal', {
      lifeStealDivisor: 3,
      manaStealDivisor: 3,
    })
    hellAtk.statList.setHp256(500 * FIXED_ONE)
    const ltOut = executeSUnitDmg(hellAtk, skel, {
      skillId: 0,
      rng: leechRng,
      attackKind: 'melee',
      flatPhysMin256: 1000 * FIXED_ONE,
      flatPhysMax256: 1000 * FIXED_ONE,
      autoHit: true,
      unblockable: true,
    })
    expect(ltOut.attackerHealed256).toBe(5 * FIXED_ONE)
  })
})

describe('#1873 Weapon-carrying projectiles (SrcDamage > 0): weapon/charm riders, 3/4 scaling, CS/DS & CB/OW', () => {
  it('carries 96/128 (3/4) weapon/charm fire & poison, Deadly Strike 2x, and ranged 1/8 CB on Multiple Shot & Guided Arrow', () => {
    const { game, g, player } = setupRoom(0x1873, 'ama', { 12: 5, 22: 5 })
    player.strength = 0
    player.dexterity = 0
    player.items.push(
      makeItem('6lb', 4, [
        { statId: 19, value: 50_000 },
        { statId: 115, value: 1 },
        { statId: 48, value: 100 }, // +100 Fire Min
        { statId: 49, value: 100 }, // +100 Fire Max
        { statId: 136, value: 100 }, // 100% Crushing Blow
        { statId: 135, value: 100 }, // 100% Open Wounds
        { statId: 141, value: 100 }, // 100% Deadly Strike
      ]),
      makeItem(
        'cm1',
        0,
        [
          { statId: 50, value: 100 }, // +100 Light Min charm
          { statId: 51, value: 100 }, // +100 Light Max charm
          { statId: 57, value: 256 }, // Poison charm
          { statId: 58, value: 256 },
          { statId: 59, value: 100 },
        ],
        { location: 'inventory', x: 0, y: 0 },
      ),
    )

    // Multiple Shot (#12, SrcDamage = 96 -> 3/4):
    // Physical = 40 * 2 (100% DS) = 80; Fire = 100 * 96/128 = 75; Light = 100 * 96/128 = 75 -> 230
    // + Ranged CB (1/8 of 8000 = 1000) -> total instant loss = 1230, plus Poison & Open Wounds armed!
    const mon = spawnDummy(game, g, 'fallen1', 54, 50, 8000)
    mon.armour = 0
    const msCast = g.resolvePlayerSkillCast(player, 12)
    g.launchPlayerSkillMissile(player, msCast, msCast.missile!, 56, 50, 40)
    game.stepFrames(8)
    expect(8000 - mon.hp).toBeGreaterThanOrEqual(1230)
    expect(mon.poisonRemainingFrames).toBeGreaterThan(0)
    expect(mon.states.has(62)).toBe(true)

    // Guided Arrow (#22, Missiles.txt SrcDamage = '' -> inherits Skills.txt SrcDam = 128 = 100%, AlwaysHit = 1)
    const monGa = spawnDummy(game, g, 'fallen1', 54, 52, 8000)
    const gaCast = g.resolvePlayerSkillCast(player, 22)
    player.y = 52
    g.launchPlayerSkillMissile(player, gaCast, gaCast.missile!, 56, 52, 50)
    game.stepFrames(8)
    // Physical = 50 * 2 (DS) = 100; Fire = 100; Light = 100 -> 300 + 1000 (1/8 ranged CB) = 1300!
    expect(8000 - monGa.hp).toBeGreaterThanOrEqual(1300)

    // CS (100%) + DS (100%) are mutually exclusive -> 2x physical, NEVER 4x!
    const amaCtx = makeUnitCtx('ama_cs_ds', 'player', 'ama')
    amaCtx.statList.setBaseStat('passive_critical_strike', 100)
    amaCtx.statList.setBaseStat('item_deadlystrike', 100)
    const critOut = executeSUnitDmg(amaCtx, makeUnitCtx('m', 'monster'), {
      skillId: 22,
      rng: new D2Rng(0x1873c),
      attackKind: 'missile',
      srcDam: 0,
      riderSrcDam: 128,
      flatPhysMin256: 100 * FIXED_ONE,
      flatPhysMax256: 100 * FIXED_ONE,
      autoHit: true,
      unblockable: false,
    })
    expect(critOut.physDamage256).toBe(200 * FIXED_ONE)
  })
})

describe('#1874 Missiles.txt ApplyMastery column & Assassin sentry trap pet mastery isolation', () => {
  it('applies Fire Mastery (329) to meteorfire (ApplyMastery=1) & firewall (Skill!=""), NOT immolationfire (ApplyMastery=0)', () => {
    expect(registry.getMissileByName('meteorfire')?.applyMastery).toBe(true)
    expect(registry.getMissileByName('immolationfire')?.applyMastery).toBe(false)

    const { game, g, player } = setupRoom(0x1874, 'sor')
    // +100% Fire Skill Damage (stat 329)
    player.items.push(makeItem('oba', 4, [{ statId: 329, value: 100 }]))

    const mMeteor = spawnDummy(game, g, 'fallen1', 60, 60, 10_000)
    const meteorPatch: AnyRec = {
      missileId: registry.getMissileByName('meteorfire')!.id,
      skillId: 56,
      groundFire256: { min: 100 * FIXED_ONE, max: 100 * FIXED_ONE },
      hitCooldowns: new Map(),
    }
    g.applyOnlineGroundFireTick113c(player, mMeteor, meteorPatch)
    expect(10_000 - mMeteor.hp).toBe(200) // +100% mastery applied!

    const mImmo = spawnDummy(game, g, 'fallen1', 62, 60, 10_000)
    const immoPatch: AnyRec = {
      missileId: registry.getMissileByName('immolationfire')!.id,
      skillId: 27,
      groundFire256: { min: 100 * FIXED_ONE, max: 100 * FIXED_ONE },
      hitCooldowns: new Map(),
    }
    g.applyOnlineGroundFireTick113c(player, mImmo, immoPatch)
    expect(10_000 - mImmo.hp).toBe(100) // ApplyMastery=0 & Skill='' -> NO mastery!
  })

  it('isolates Assassin sentry traps from owner stats 329..336 while keeping Sorceress Hydra Fire Mastery', () => {
    const asnOwner = makeUnitCtx('asn', 'player', 'ass')
    asnOwner.statList.setBaseStat('passive_ltng_mastery', 100) // +100% Griffon/Facet
    asnOwner.statList.setBaseStat('passive_ltng_pierce', 50) // -50% Enemy Light Res

    const trapTarget = makeUnitCtx('trap_t', 'monster')
    trapTarget.statList.setBaseStat('lightresist', 50)

    const mgr = new SummonManager(registry)
    const engine = new MissileEngine(registry)
    const auraScanner = new AuraScanner(registry)
    const enemyPositions = new Map([[trapTarget.id, { x: 52, y: 50 }]])
    mgr.createPet({
      owner: asnOwner,
      skillId: 271,
      slvl: 10,
      x: 50,
      y: 50,
    })
    mgr.tickPets({
      currentTick: 50,
      owner: asnOwner,
      enemies: [trapTarget],
      enemyPositions,
      missileEngine: engine,
      auraScanner,
    })
    const activeMsls = engine.getActiveMissiles()
    expect(activeMsls.length).toBeGreaterThan(0)
    // Trap missile owner is the trap pet (0% mastery, 0% pierce), NOT the Assassin!
    expect(activeMsls[0]!.owner.statList.getAccruedStat('passive_ltng_mastery')).toBe(0)
    expect(activeMsls[0]!.owner.statList.getAccruedStat('passive_ltng_pierce')).toBe(0)

    // Sorceress Hydra (#62) DOES inherit owner Fire Mastery (`329`)!
    const sorOwner = makeUnitCtx('sor', 'player', 'sor')
    sorOwner.statList.setBaseStat('passive_fire_mastery', 100)
    const hydraMgr = new SummonManager(registry)
    const hydraEngine = new MissileEngine(registry)
    hydraMgr.createPet({
      owner: sorOwner,
      skillId: 62,
      slvl: 10,
      x: 50,
      y: 50,
    })
    hydraMgr.tickPets({
      currentTick: 50,
      owner: sorOwner,
      enemies: [trapTarget],
      enemyPositions,
      missileEngine: hydraEngine,
      auraScanner,
    })
    expect(hydraEngine.getActiveMissiles()[0]!.owner.statList.getAccruedStat('passive_fire_mastery')).toBe(100)
  })
})

describe('#1875 ItemStatCost.txt derived op 2/4/5/8/9/11, resist-per-level 230..233, & dead bytime op 6/7', () => {
  it('evaluates op 2/4/5 shift, op 8/9 bonus-only Vit/Ene, op 11 BO %maxhp excluding gear +Vit & Shako /lvl, and resist/lvl 230..233', () => {
    // Barbarian: base Vit = 25 (hpPerVit = 4 -> 100 HP), baseHp = 55 * 256
    const bar = new UnitStatList(registry, undefined, { ownerType: 'player', charClass: 'bar' })
    bar.setBaseStat('level', 80)
    bar.setBaseStat('vitality', 25)
    bar.setBaseStat('maxhp', (55 + 100) * FIXED_ONE) // 155 base+hardVit HP

    // Add +20 gear Vitality (op 8 -> +80 HP NOT scaled by BO!), +100 flat Life (scaled by BO!),
    // Shako `item_hp_perlevel` stat 216 = 12 (op 2, op_param 3 -> (12 * 80) >> 3 = 120 whole HP = 120*256, NOT scaled by BO!),
    // and +100% Battle Orders (`item_maxhp_percent` = 100, op 11)!
    bar.addOrUpdateModifier({
      id: 'gear',
      stateName: 'gear',
      stateId: 0,
      sourceUnitId: 'bar',
      sourceSkillId: 0,
      slvl: 1,
      expireFrame: 0,
      stats: {
        vitality: 20,
        maxhp: 100 * FIXED_ONE,
        item_hp_perlevel: 12 * FIXED_ONE,
      },
    })
    bar.addOrUpdateModifier({
      id: 'battle_orders',
      stateName: 'battleorders',
      stateId: 32,
      sourceUnitId: 'bar',
      sourceSkillId: 149,
      slvl: 20,
      expireFrame: 0,
      stats: { item_maxhp_percent: 100 },
    })
    // BO scales (155 + 100) = 255 -> +255 HP; gear +20 Vit adds +80 HP; Shako adds +120 HP -> total = 255 + 255 + 80 + 120 = 710 HP!
    expect(Math.floor(bar.getAccruedStat('maxhp') / FIXED_ONE)).toBe(710)

    // op=2 with op_param=1 (`item_tohit_perlevel` stat 224 -> (10 * 80) >> 1 = 400 AR) vs
    // op=4 with op_param=3 (`item_armor_perlevel` stat 214 -> (10 * 80) >> 3 = 100 AC)
    bar.setBaseStat('armorclass', 500)
    bar.addOrUpdateModifier({
      id: 'perlevel_ops',
      stateName: 'perlevel_ops',
      stateId: 0,
      sourceUnitId: 'bar',
      sourceSkillId: 0,
      slvl: 1,
      expireFrame: 0,
      stats: {
        item_tohit_perlevel: 10,
        item_armor_perlevel: 10,
      },
    })
    expect(bar.getAccruedStat('armorclass')).toBe(600) // 500 + ((10 * 80) >> 3)
    expect(bar.getAccruedStat('tohit')).toBeGreaterThanOrEqual(400) // +((10 * 80) >> 1) = +400 AR

    // GameInstance PER_LEVEL_STAT_MAP_113C: 230=Fire, 231=Cold, 232=Light, 233=Poison (`(val * clvl) >> 3`)
    const { g, player } = setupRoom(0x1875, 'pal')
    player.level = 80
    player.items.push(
      makeItem('hlm', 1, [
        { statId: 230, value: 4 }, // Fire -> 40
        { statId: 231, value: 8 }, // Cold -> 80
        { statId: 232, value: 6 }, // Light -> 60
        { statId: 233, value: 2 }, // Poison -> 20
      ]),
    )
    expect(g.playerResistPct(player, 'cold')).toBe(75) // 80 capped at 75
    expect(g.playerResistPct(player, 'fire')).toBe(40)
    expect(g.playerResistPct(player, 'light')).toBe(60)
    expect(g.playerResistPct(player, 'poison')).toBe(20)
  })
})

describe('#1876 GameInstance.stepMissiles Pierce: CollideKill=1 Pierce% roll (max 4 pierces = 5 hits) vs CollideKill=0', () => {
  it('stops Pierce=1 arrows/javelins on 1st hit when Pierce% is 0%, caps 100% Pierce at 5 hits (4 pierces), and lets CollideKill=0 pass >5 targets', () => {
    // Use `magicarrow` with `toHit: false` (`CollideKill=1, Pierce=1`, no radial secondary bolts) to verify pure main-shaft pierce!
    const { game, g, player } = setupRoom(0x1876, 'ama', { 35: 5 })
    const lfCast = g.resolvePlayerSkillCast(player, 35)
    const pierceTestRow = { ...registry.getMissileByName('magicarrow')!, toHit: false }

    // 1) 0% Pierce: stops on 1st monster, 2nd monster untouched!
    const m1 = spawnDummy(game, g, 'fallen1', 54, 50, 5000)
    const m2 = spawnDummy(game, g, 'fallen1', 64, 50, 5000)
    g.launchPlayerSkillMissile(player, lfCast, pierceTestRow, 75, 50, 200)
    game.stepFrames(25)
    expect(m1.hp).toBeLessThan(5000)
    expect(m2.hp).toBe(5000)

    // 2) 100% Pierce (`stat 156 = 100`): pierces 4 times -> hits monsters 1..5 and stops BEFORE monster 6!
    const { game: g100Game, g: g100, player: ama100 } = setupRoom(0x1876a, 'ama', { 35: 5 })
    ama100.items.push(makeItem('zlb', 8, [{ statId: 156, value: 100 }]))
    const lfCast100 = g100.resolvePlayerSkillCast(ama100, 35)
    const line: AnyRec[] = []
    for (let i = 0; i < 6; i++) {
      line.push(spawnDummy(g100Game, g100, 'fallen1', 53 + i * 3, 50, 5000))
    }
    g100.launchPlayerSkillMissile(ama100, lfCast100, pierceTestRow, 80, 50, 150)
    g100Game.stepFrames(30)
    for (let i = 0; i < 5; i++) {
      expect(line[i]!.hp).toBeLessThan(5000)
    }
    expect(line[5]!.hp).toBe(5000) // 6th monster untouched (max 4 pierces = 5 hits)!

    // 3) CollideKill=0 (`bonespear`) unconditionally passes through all 6 monsters even with 0% Pierce!
    const { game: g2Game, g: g2, player: nec } = setupRoom(0x1876b, 'nec', { 84: 10 })
    const spearRow = registry.getMissileByName('bonespear')!
    const spearCast = g2.resolvePlayerSkillCast(nec, 84)
    const spearLine: AnyRec[] = []
    for (let i = 0; i < 6; i++) {
      spearLine.push(spawnDummy(g2Game, g2, 'fallen1', 54 + i * 3, 50, 5000))
    }
    g2.launchPlayerSkillMissile(nec, spearCast, spearRow, 80, 50, 200)
    g2Game.stepFrames(30)
    for (let i = 0; i < 6; i++) {
      expect(spearLine[i]!.hp).toBeLessThan(5000)
    }
  })
})
