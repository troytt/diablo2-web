import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { MON_UMOD } from '../../src/common/units/monster-death-fx.ts'
import { CLOSED_REALM_POLICY, GameInstance, type ServerItemEntry } from '../../src/server/engine/game-instance.ts'
import type { GameInstanceHost } from '../../src/server/engine/game-instance/host.ts'

function makeEquippedItem(
  unitId: number,
  ownerId: number,
  code: string,
  bodyLoc: number,
  statPairs: readonly (readonly [number, number])[] = [],
): ServerItemEntry {
  return {
    unitId,
    code,
    name: code,
    quality: 4,
    level: 30,
    location: 'equipped',
    x: 0,
    y: 0,
    width: 2,
    height: 2,
    areaId: 1,
    ownerId,
    bodyLoc,
    storePage: 0,
    cost: 100,
    gamble: false,
    identified: true,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: 40,
    maxDurability: 40,
    quantity: 0,
    stats: new Map(statPairs),
    socketedItems: [],
  }
}

describe('Issue #2017: 1.13c Missiles.txt GetHit/SoftHit/KnockBack, DamageRate, NoMultiShot/NoUniqueMod, and SrvDo148', () => {
  const registry = getSharedDataRegistry()

  it('parses GetHit, SoftHit, KnockBack, DamageRate, NoMultiShot, and NoUniqueMod accurately from Missiles.txt', () => {
    const megaInferno = registry.getMissileById(675) // megademoninferno
    expect(megaInferno).toBeDefined()
    expect(megaInferno!.getHit).toBe(false)
    expect(megaInferno!.damageRate).toBe(82)
    expect(megaInferno!.noUniqueMod).toBe(true)

    const diabLight = registry.getMissileById(172) // diablight
    expect(diabLight).toBeDefined()
    expect(diabLight!.getHit).toBe(false)
    expect(diabLight!.damageRate).toBe(82)

    const diabFire = registry.getMissileById(176) // diabfire
    expect(diabFire).toBeDefined()
    expect(diabFire!.getHit).toBe(false)

    const diabWall = registry.getMissileById(180) // diabwall
    expect(diabWall).toBeDefined()
    expect(diabWall!.getHit).toBe(false)
    expect(diabWall!.damageRate).toBe(41)

    const baalInferno = registry.getMissileById(554) // baal inferno
    expect(baalInferno).toBeDefined()
    expect(baalInferno!.getHit).toBe(true)

    const chargedBolt = registry.getMissileById(56) // chargedbolt
    expect(chargedBolt).toBeDefined()
    expect(chargedBolt!.getHit).toBe(true)

    const baalColdMaker = registry.getMissileById(589) // baal cold maker
    expect(baalColdMaker).toBeDefined()
    expect(baalColdMaker!.knockBack).toBe(75)
  })

  it('suppresses player GetHit stunlock (mode 4) and scales flat MDR by DamageRate/1024 on megademoninferno (#675)', () => {
    const game = new GameInstance({ policy: CLOSED_REALM_POLICY, mapSeed: 201701, difficulty: 0, registry })
    const host = game as unknown as GameInstanceHost
    const pId = game.connectPlayer({ name: 'Sorc', classId: 1, level: 26, areaId: 108, x: 50, y: 50 })
    const pRec = host.players.get(pId)!
    pRec.maxHp = 160
    pRec.maxHpFixed = 160 * 256
    pRec.hp = 160
    pRec.hpFixed = 160 * 256
    pRec.mode = 1

    // Equip an amulet granting +20 integer Magic Damage Reduced (`stat 35`):
    // Without DamageRate scaling (`82 / 1024`), +20 MDR would subtract 20 full HP (`40 - 20 = 20`).
    // With 1.13c DamageRate = 82 (`mulDiv(82, 20 * 256, 1024) = 410` -> 1.60 HP), 38 HP fire damage lands (`160 - 38 = 122`)!
    pRec.items.push(makeEquippedItem(9001, pId, 'amu', 2, [[35, 20]]))

    const monId = game.spawnMonster({
      defId: 'megademon3',
      name: 'Venom Lord',
      hcIdx: 310,
      areaId: 108,
      x: 53,
      y: 50,
      level: 30,
      hp: 500,
      maxHp: 500,
    })
    const mon = host.monsters.get(monId)!

    const hit = host.resolveMonsterAttackOnPlayer(mon, pRec, {
      minDmg: 0,
      maxDmg: 0,
      skillMode: 'S1',
      attackKind: 'missile',
      skillId: 239,
      missileId: 675,
      elementType: 'fire',
      elemMin: 40,
      elemMax: 40,
      fromMissile: true,
      autoHit: true,
    })
    expect(hit).toBe(true)
    expect(pRec.hp).toBe(122)
    // GetHit == 0 on #675 megademoninferno prevents entering PLRMODE_GETHIT (mode 4)!
    expect(pRec.mode).not.toBe(4)
    expect(pRec.hitRecoveryUntilFrame).toBeLessThanOrEqual(host.currentFrame)

    // Contrast: #56 chargedbolt (`GetHit = 1`, `DamageRate = 0`) applies full +20 MDR AND triggers mode 4!
    pRec.hp = 80
    pRec.hpFixed = 80 * 256
    pRec.mode = 1
    const boltHit = host.resolveMonsterAttackOnPlayer(mon, pRec, {
      minDmg: 0,
      maxDmg: 0,
      skillMode: 'S1',
      attackKind: 'missile',
      skillId: 38,
      missileId: 56,
      elementType: 'ltng',
      elemMin: 65,
      elemMax: 65,
      fromMissile: true,
      autoHit: true,
    })
    expect(boltHit).toBe(true)
    expect(pRec.hp).toBe(35) // 65 - 20 full MDR = 45 damage -> 80 - 45 = 35 HP
    expect(pRec.mode).toBe(4) // PLRMODE_GETHIT triggered
  })

  it('suppresses PLRMODE_BLOCK (mode 9) when blocking a GetHit=0 && KnockBack=0 physical stream missile', () => {
    const game = new GameInstance({ policy: CLOSED_REALM_POLICY, mapSeed: 201702, difficulty: 0, registry })
    const host = game as unknown as GameInstanceHost
    const pId = game.connectPlayer({ name: 'Pal', classId: 3, level: 30, dexterity: 300, areaId: 108, x: 50, y: 50 })
    const pRec = host.players.get(pId)!
    pRec.mode = 1
    pRec.items.push(makeEquippedItem(9002, pId, 'tow', 5))

    const monId = game.spawnMonster({
      defId: 'diablo',
      name: 'Diablo',
      hcIdx: 243,
      areaId: 108,
      x: 54,
      y: 50,
      level: 40,
      hp: 2000,
      maxHp: 2000,
    })
    const mon = host.monsters.get(monId)!

    let blockedCount = 0
    for (let i = 0; i < 30; i++) {
      pRec.hp = 500
      pRec.hpFixed = 500 * 256
      pRec.mode = 1
      const landed = host.resolveMonsterAttackOnPlayer(mon, pRec, {
        minDmg: 20,
        maxDmg: 20,
        skillMode: 'S1',
        attackKind: 'missile',
        skillId: 193,
        missileId: 172,
        fromMissile: true,
        autoHit: true,
        unblockable: false,
      })
      if (!landed) {
        blockedCount += 1
        expect(pRec.mode).toBe(1)
      }
    }
    expect(blockedCount).toBeGreaterThan(0)
  })

  it('spawns all 4 elemental/unholy variants (#323..#326) for SKILLS_SrvDo148 (#335 DoomKnightMissile)', () => {
    const game = new GameInstance({ policy: CLOSED_REALM_POLICY, mapSeed: 201703, difficulty: 0, registry })
    const host = game as unknown as GameInstanceHost
    const pId = game.connectPlayer({ name: 'Sorc', classId: 1, level: 28, areaId: 108, x: 50, y: 50 })
    const pRec = host.players.get(pId)!

    const dkId = game.spawnMonster({
      defId: 'doomknight3',
      name: 'Oblivion Knight',
      hcIdx: 312,
      areaId: 108,
      x: 58,
      y: 50,
      level: 30,
      hp: 600,
      maxHp: 600,
    })
    const dk = host.monsters.get(dkId)!
    expect(dk.skills.some((s) => s.skillId === 335)).toBe(true)

    const spawnedIds = new Set<number>()
    const spawnedElements = new Set<string>()
    for (let i = 0; i < 64; i++) {
      dk.skillCooldown = 0
      dk.cooldown = 0
      host.missiles.clear()
      const casted = host.tryCastMonsterSkill(dk, { x: pRec.x, y: pRec.y }, 8, { forcedSkillId: 335 })
      expect(casted).toBe(true)
      for (const m of host.missiles.values()) {
        if (m.missileId !== undefined) spawnedIds.add(m.missileId)
        spawnedElements.add(m.element)
      }
    }
    expect([...spawnedIds].sort((a, b) => a - b)).toEqual([323, 324, 325, 326])
    expect(spawnedElements).toEqual(new Set(['pois', 'fire', 'cold', 'phys']))
  })

  it('enforces Missiles.txt NoMultiShot in spawnMonsterMissile and NoUniqueMod on hit riders', () => {
    const game = new GameInstance({ policy: CLOSED_REALM_POLICY, mapSeed: 201704, difficulty: 0, registry })
    const host = game as unknown as GameInstanceHost
    const pId = game.connectPlayer({ name: 'Sorc', classId: 1, level: 28, areaId: 108, x: 50, y: 50 })
    const pRec = host.players.get(pId)!
    pRec.maxHp = 500
    pRec.maxHpFixed = 500 * 256
    pRec.hp = 500
    pRec.hpFixed = 500 * 256
    pRec.maxMana = 300
    pRec.maxManaFixed = 300 * 256
    pRec.mana = 300
    pRec.manaFixed = 300 * 256

    const bossId = game.spawnMonster({
      defId: 'doomknight3',
      name: 'Unique Oblivion Knight',
      hcIdx: 312,
      areaId: 108,
      x: 56,
      y: 50,
      level: 30,
      hp: 800,
      maxHp: 800,
      rank: 'unique',
      umodIds: [MON_UMOD.MULTISHOT, MON_UMOD.MANahit, MON_UMOD.CURSE],
    })
    const boss = host.monsters.get(bossId)!

    // #556 fistsoffireexplode has NoMultiShot = 1 and is not in the static set; must spawn 1, not 3!
    host.missiles.clear()
    host.spawnMonsterMissile(boss, pRec.x, pRec.y, 20, 556, 0, {})
    expect(host.missiles.size).toBe(1)

    // #675 megademoninferno has NoUniqueMod = 1: must not proc Mana Burn or Cursed Amplify Damage!
    const hit = host.resolveMonsterAttackOnPlayer(boss, pRec, {
      minDmg: 25,
      maxDmg: 25,
      skillMode: 'A1',
      attackKind: 'missile',
      skillId: 0,
      missileId: 675,
      fromMissile: true,
      autoHit: true,
    })
    expect(hit).toBe(true)
    expect(pRec.manaFixed).toBe(300 * 256)
    expect(pRec.states.has(9)).toBe(false)
  })
})
