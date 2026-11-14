import { describe, expect, it } from 'vitest'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { HudModel } from '../src/client/ui-model/hud-model.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import type { ItemData } from '../src/netproto/index.ts'

describe('Issue #1015: Character Sheet damage and Attack Rating include skill, charm, set, and socket bonuses', () => {
  it('computes 2H weapon damage & AR with socketed Ohm runes, Full Immortal King set, charms, Mace Mastery (#129), and Berserk (#152)', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 1
    ;(world.self as any).charClass = 4 // Barbarian ('bar')
    ;(world.self as any).level = 99
    ;(world.self as any).stats.set(0, 232) // Str 232
    ;(world.self as any).stats.set(2, 20)  // Dex 20
    ;(world.self as any).stats.set(3, 200) // Vit 200
    ;(world.self as any).stats.set(1, 10)  // Ene 10
    ;(world.self as any).stats.set(12, 99) // Level 99

    const skills: ReadonlyArray<readonly [number, number]> = [
      [0, 1],
      [129, 20], // Mace Mastery
      [130, 1],  // Howl (Berserk synergy)
      [138, 20], // Shout (Berserk synergy)
      [149, 20], // Battle Orders
      [151, 20], // Whirlwind
      [152, 1],  // Berserk
      [155, 1],  // Battle Command
    ]
    for (const [id, lvl] of skills) {
      ;(world.self as any).skills.set(id, lvl)
      ;(world.self as any).skillEntries.set(id, {
        skillId: id,
        baseLevel: lvl,
        bonus: 0,
        level: lvl,
        charges: 0,
        ownerType: 0,
        ownerId: 1,
      })
    }

    ;(world.self as any).leftSkill = 152 // Berserk on left click
    ;(world.self as any).rightSkill = 0  // Attack on right click

    // Full Immortal King's set (6 pieces: ba5, xar, 7m7, zhb, xhb, xhg)
    const ikHelm: ItemData = {
      id: 101,
      code: 'ba5',
      name: "Immortal King's Will",
      quality: 5,
      identified: true,
      bodyLoc: 1,
      defense: 175,
      stats: [{ statId: 188, param: 34, value: 2 }], // +2 Warcries
      runewordStats: [],
      setBonusStats: [],
      flags: { identified: true } as any,
    } as any

    const ikArmor: ItemData = {
      id: 102,
      code: 'xar',
      name: "Immortal King's Soul Cage",
      quality: 5,
      identified: true,
      bodyLoc: 3,
      defense: 1001,
      stats: [{ statId: 188, param: 32, value: 2 }], // +2 Combat Skills (Barbarian)
      runewordStats: [],
      setBonusStats: [
        { index: 0, stats: [{ statId: 16, param: 0, value: 50 }] }, // +50% Enhanced Defense (2+ items)
      ],
      flags: { identified: true } as any,
    } as any

    // Immortal King's Stone Crusher (7m7, Ogre Maul: 2handmindam=77, 2handmaxdam=106, StrBonus=110)
    // Base +200% ED + 2x socketed Ohm runes (r27, +50% ED each via gemSocketStats -> +300% total weapon ED -> 308-424 weapon damage)
    const ikMaul: ItemData = {
      id: 103,
      code: '7m7',
      name: "Immortal King's Stone Crusher",
      quality: 5,
      identified: true,
      bodyLoc: 4,
      stats: [
        { statId: 17, param: 0, value: 200 },
        { statId: 18, param: 0, value: 200 },
      ],
      runewordStats: [],
      setBonusStats: [
        { index: 0, stats: [{ statId: 48, param: 0, value: 204 }, { statId: 49, param: 0, value: 204 }] },
        { index: 1, stats: [{ statId: 50, param: 0, value: 7 }, { statId: 51, param: 0, value: 477 }] },
        { index: 2, stats: [{ statId: 54, param: 0, value: 127 }, { statId: 55, param: 0, value: 364 }, { statId: 56, param: 0, value: 150 }] },
        { index: 3, stats: [{ statId: 57, param: 0, value: 342 }, { statId: 58, param: 0, value: 342 }, { statId: 59, param: 0, value: 150 }] },
        { index: 4, stats: [{ statId: 52, param: 0, value: 250 }, { statId: 53, param: 0, value: 361 }] },
      ],
      flags: { identified: true } as any,
    } as any

    const ohm1: ItemData = {
      id: 201,
      code: 'r27',
      name: 'Ohm Rune',
      quality: 2,
      identified: true,
      stats: [], // Empty wire stats: resolved via Gems.txt gemSocketStats
      runewordStats: [],
      setBonusStats: [],
    } as any

    const ohm2: ItemData = {
      id: 202,
      code: 'r27',
      name: 'Ohm Rune',
      quality: 2,
      identified: true,
      stats: [],
      runewordStats: [],
      setBonusStats: [],
    } as any

    const ikBelt: ItemData = {
      id: 104,
      code: 'zhb',
      name: "Immortal King's Detail",
      quality: 5,
      identified: true,
      bodyLoc: 8,
      defense: 89,
      stats: [{ statId: 0, param: 0, value: 25 }], // +25 Strength
      runewordStats: [],
      setBonusStats: [],
      flags: { identified: true } as any,
    } as any

    const ikBoots: ItemData = {
      id: 105,
      code: 'xhb',
      name: "Immortal King's Pillar",
      quality: 5,
      identified: true,
      bodyLoc: 9,
      defense: 118,
      stats: [{ statId: 19, param: 0, value: 110 }], // +110 Attack Rating
      runewordStats: [],
      setBonusStats: [],
      flags: { identified: true } as any,
    } as any

    const ikGloves: ItemData = {
      id: 106,
      code: 'xhg',
      name: "Immortal King's Forge",
      quality: 5,
      identified: true,
      bodyLoc: 10,
      defense: 108,
      stats: [
        { statId: 0, param: 0, value: 20 }, // +20 Strength
        { statId: 2, param: 0, value: 20 }, // +20 Dexterity
      ],
      runewordStats: [],
      setBonusStats: [],
      flags: { identified: true } as any,
    } as any

    // Grand Charm of Maiming (+3 Min Damage, +10 Max Damage, +76 Attack Rating) stored as statId 21/22/19
    const grandCharm: ItemData = {
      id: 301,
      code: 'cm3',
      name: 'Sharp Grand Charm of Maiming',
      quality: 4,
      identified: true,
      container: 'inventory',
      stats: [
        { statId: 21, param: 0, value: 3 },  // +3 Min Damage (MINDAMAGE)
        { statId: 22, param: 0, value: 10 }, // +10 Max Damage (MAXDAMAGE)
        { statId: 19, param: 0, value: 76 }, // +76 Attack Rating
      ],
      runewordStats: [],
      setBonusStats: [],
      flags: { identified: true } as any,
    } as any

    const rawContainers = world.containers as unknown as {
      equipment: Map<number, any>
      equipmentBySlot: Map<number, any>
      sockets: Map<number, any[]>
      inventory: Map<number, any>
    }
    for (const eq of [ikHelm, ikArmor, ikMaul, ikBelt, ikBoots, ikGloves]) {
      rawContainers.equipment.set(eq.id, eq)
      rawContainers.equipmentBySlot.set(eq.bodyLoc!, eq)
    }
    rawContainers.sockets.set(ikMaul.id, [ohm1, ohm2])
    rawContainers.inventory.set(grandCharm.id, grandCharm)

    const hud = new HudManager()
    const hudModel = new HudModel({ world, hudManager: hud })
    hudModel.syncFromWorld()
    const attrs = hud.charSheet.attrs

    // Verify 2H weapon base damage includes 2x Ohm Rune (+100% ED on top of +200% base ED) AND +3/+10 flat charm damage!
    // Base 7m7: 77-106. With +300% ED = 308-424. Plus charm +3/+10 = 311-434!
    expect(attrs.weaponPhysBaseMin).toBe(311)
    expect(attrs.weaponPhysBaseMax).toBe(434)

    // Verify Full Immortal King set grants +3 Barbarian Skills -> Mace Mastery is lvl 23 (20 hard + 3 bonus)
    // and Berserk is lvl 6 (1 hard + 3 IK full set + 2 IK armor Combat Skills = 5 bonus)
    expect((hud.skillTree.hardPoints.get(129) ?? 0) + (hud.skillTree.bonusLevels.get(129) ?? 0)).toBe(23)
    expect((hud.skillTree.hardPoints.get(152) ?? 0) + (hud.skillTree.bonusLevels.get(152) ?? 0)).toBe(6)

    // Left skill (Berserk #152) and Right skill (Attack #0) must have distinct Attack Ratings:
    // Attack (#0) has Mace Mastery (+204% AR at lvl 23), while Berserk (#152) adds +175% AR at lvl 6 (+379% total AR)!
    expect(attrs.rightAttackRating).toBeGreaterThan(2000)
    expect(attrs.attackRating).toBeGreaterThan(attrs.rightAttackRating ?? 0)

    // Left skill damage (Berserk) and Right skill damage (Attack) must be way higher than raw weapon + elemental damage
    const parseDmgRange = (txt: string): [number, number] => {
      const m = txt.match(/(\d+)-(\d+)/)
      return m ? [Number(m[1]), Number(m[2])] : [0, 0]
    }
    const [leftMin, leftMax] = parseDmgRange(attrs.leftSkillDmg ?? '')
    const [rightMin, rightMax] = parseDmgRange(attrs.rightSkillDmg ?? '')
    expect(rightMin).toBeGreaterThan(2300)
    expect(rightMax).toBeGreaterThan(3900)
    expect(leftMin).toBeGreaterThan(rightMin)
    expect(leftMax).toBeGreaterThan(rightMax)

    // Immortal King's Soul Cage item-specific set bonus (+50% Enhanced Defense on 1001 base = 1501) applies with owner: 'item'
    // Total defense: 175 (helm) + 1501 (armor w/ +50% set ED) + 89 (belt) + 118 (boots) + 108 (gloves) + 10 (dex 40 / 4) = 2001
    expect(attrs.defense).toBe(2001)
  })
})
