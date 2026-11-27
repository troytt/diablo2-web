import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import { getEmbeddedDropTables } from '../../../src/common/items/embedded-drop-tables.ts'
import {
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillLevel113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import { STATLIST_GetUnitStat113c } from '../../../src/d2kern-113c/common/statlist.ts'
import { UNITS_GetX113c, UNITS_GetY113c } from '../../../src/d2kern-113c/common/unit.ts'
import { D2UnitStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import {
  ClickButtonId,
  NpcActionId,
  type ItemData,
  type LocalAreaBootstrap,
  type LocalAreaBootstrapResolver,
  type ServerEvent,
} from '../../../src/netproto/index.ts'
import {
  LocalKernelD2gsAdapter113c,
  createDefaultNpcIntroData,
  createDefaultQuestData,
  createDefaultWaypointData,
  readD2sSave113c,
  writeD2sSave113c,
  type D2sItemInput,
} from '../../../src/server/index.ts'

const FIXED_ONE_113C = 256

function stepAll(
  adapter: LocalKernelD2gsAdapter113c,
  session: OnlineSession,
  clock: { nowMs: number },
  frames = 2,
): void {
  for (let i = 0; i < frames; i++) {
    clock.nowMs += 40
    adapter.stepFrame()
    session.tick(40, clock.nowMs)
  }
}

function attachSessionWithEventLog(
  adapter: LocalKernelD2gsAdapter113c,
  clock: { nowMs: number },
): {
  readonly session: OnlineSession
  readonly events: ServerEvent[]
  readonly getProtocolErrors: () => number
} {
  const events: ServerEvent[] = []
  const session = new OnlineSession()
  session.attachGameServer(adapter)
  adapter.onEvent((ev) => {
    events.push(ev)
  })
  session.tick(40, clock.nowMs)
  return {
    session,
    events,
    getProtocolErrors: () =>
      (adapter.stats.protocolErrors ?? 0) + adapter.d2gsAdapter.listenerErrors,
  }
}

function buildTestAreaResolver(): LocalAreaBootstrapResolver {
  const specs: Readonly<
    Record<
      number,
      {
        readonly originX: number
        readonly originY: number
        readonly monsters: readonly {
          readonly classId: number
          readonly dx: number
          readonly dy: number
          readonly isNpc?: boolean
          readonly isVendor?: boolean
        }[]
        readonly objects: readonly {
          readonly classId: number
          readonly dx: number
          readonly dy: number
          readonly isWaypoint?: boolean
        }[]
      }
    >
  > = {
    // Area 1: Rogue Encampment (town) with Akara (148), Charsi (154), Gheed (147), Stash (267), Waypoint (119)
    1: {
      originX: 5520,
      originY: 5880,
      monsters: [
        { classId: 148, dx: 23, dy: 20, isNpc: true, isVendor: true }, // Akara
        { classId: 154, dx: 20, dy: 23, isNpc: true, isVendor: true }, // Charsi
        { classId: 147, dx: 17, dy: 20, isNpc: true, isVendor: true }, // Gheed
        { classId: 146, dx: 21, dy: 18, isNpc: true, isVendor: false }, // Deckard Cain
      ],
      objects: [
        { classId: 119, dx: 22, dy: 22, isWaypoint: true },
        { classId: 267, dx: 20, dy: 17 }, // Bank / Stash
      ],
    },
    // Area 2: Blood Moor (non-town field)
    2: {
      originX: 5680,
      originY: 5880,
      monsters: [
        { classId: 19, dx: 24, dy: 20, isNpc: false }, // Fallen (fallen1, mlvl 1)
      ],
      objects: [],
    },
  }

  return (req): LocalAreaBootstrap | null => {
    const spec = specs[req.areaId]
    if (spec === undefined) return null
    const subW = 80
    const subH = 80
    const spawnX = spec.originX + 20
    const spawnY = spec.originY + 20
    const tileX = Math.trunc(spec.originX / 5)
    const tileY = Math.trunc(spec.originY / 5)
    const collision = new Uint16Array(subW * subH)
    for (let y = 0; y < subH; y++) {
      for (let x = 0; x < subW; x++) {
        if (x === 0 || y === 0 || x === subW - 1 || y === subH - 1) {
          collision[y * subW + x] = 0x0001
        }
      }
    }
    return {
      areaId: req.areaId,
      spawnX,
      spawnY,
      originX: spec.originX,
      originY: spec.originY,
      subWidth: subW,
      subHeight: subH,
      collision,
      rooms: [{ areaId: req.areaId, tileX, tileY }],
      roomRects: [{ index: 0, x: spec.originX, y: spec.originY, w: subW, h: subH, seed: 1 }],
      adjacentAreaIds: [],
      warps: [],
      monsters: spec.monsters.map((m) => ({
        classId: m.classId,
        x: spec.originX + m.dx,
        y: spec.originY + m.dy,
        areaId: req.areaId,
        ...(m.isNpc !== undefined ? { isNpc: m.isNpc } : {}),
        ...(m.isVendor !== undefined ? { isVendor: m.isVendor } : {}),
      })),
      objects: spec.objects.map((o) => ({
        classId: o.classId,
        x: spec.originX + o.dx,
        y: spec.originY + o.dy,
        areaId: req.areaId,
        isWaypoint: o.isWaypoint === true,
        mode: o.isWaypoint === true ? 2 : 0,
      })),
      isWalkable: (checkAreaId, sx, sy) => {
        if (checkAreaId !== req.areaId) return false
        const lx = sx - spec.originX
        const ly = sy - spec.originY
        return lx > 0 && ly > 0 && lx < subW - 1 && ly < subH - 1
      },
    }
  }
}

function makeSorceressTestD2s(opts: {
  readonly name?: string
  readonly level?: number
  readonly experience?: number
  readonly gold?: number
  readonly goldBank?: number
  readonly hp?: number
  readonly maxHp?: number
  readonly mana?: number
  readonly maxMana?: number
  readonly leftSkill?: number
  readonly rightSkill?: number
  readonly altLeftSkill?: number
  readonly altRightSkill?: number
  readonly skillOffsets?: Readonly<Record<number, number>>
  readonly items?: readonly D2sItemInput[]
} = {}): Uint8Array {
  const skills = new Uint8Array(30)
  if (opts.skillOffsets !== undefined) {
    for (const [k, v] of Object.entries(opts.skillOffsets)) {
      const idx = Number(k)
      if (idx >= 0 && idx < 30) skills[idx] = v & 0xff
    }
  }
  const maxHp = opts.maxHp ?? 80
  const hp = opts.hp ?? maxHp
  const maxMana = opts.maxMana ?? 120
  const mana = opts.mana ?? maxMana
  return writeD2sSave113c({
    name: opts.name ?? 'WaveThreeSorc',
    classId: 1, // Sorceress (skill base = 36)
    level: opts.level ?? 1,
    statusFlags: 0x20,
    progression: 0,
    activeWeapon: 0,
    leftSkill: opts.leftSkill ?? 36, // Fire Bolt
    rightSkill: opts.rightSkill ?? 54, // Teleport
    altLeftSkill: opts.altLeftSkill ?? 0,
    altRightSkill: opts.altRightSkill ?? 39, // Ice Bolt
    activeDifficulty: 0,
    activeAct: 0,
    mapSeed: 0x20260003,
    questsRaw: createDefaultQuestData(),
    waypointsRaw: createDefaultWaypointData(),
    npcIntro: createDefaultNpcIntroData(),
    attributes: {
      strength: 30,
      energy: 40,
      dexterity: 30,
      vitality: 20,
      statPts: 0,
      newSkills: 0,
      hitpointsFixed: hp * FIXED_ONE_113C,
      maxHpFixed: maxHp * FIXED_ONE_113C,
      manaFixed: mana * FIXED_ONE_113C,
      maxManaFixed: maxMana * FIXED_ONE_113C,
      staminaFixed: 74 * FIXED_ONE_113C,
      maxStaminaFixed: 74 * FIXED_ONE_113C,
      level: opts.level ?? 1,
      experience: opts.experience ?? 0,
      gold: opts.gold ?? 0,
      goldBank: opts.goldBank ?? 0,
    },
    skills,
    items: opts.items ?? [],
  })
}

function makeItemInput(overrides: Partial<ItemData> & { readonly code: string }): D2sItemInput {
  const trimmedCode = overrides.code.trim()
  const base = getEmbeddedDropTables().getBase(trimmedCode)
  const isCompact = Boolean(
    overrides.compact ?? (base?.kind === 'misc' && trimmedCode !== 'tbk' && trimmedCode !== 'ibk'),
  )
  return {
    id: 0,
    itemId: 0,
    opcode: 0x9c,
    action: 0,
    category: 0,
    ownerType: 0,
    ownerId: 0,
    flags: overrides.identified === false ? 0 : 0x10,
    rawFlags: overrides.identified === false ? 0 : 0x10,
    version: 101,
    location: 0,
    container: 'inventory',
    bodyLoc: 0,
    equippedSlot: 0,
    gridX: 0,
    gridY: 0,
    storePage: 1,
    storagePage: 1,
    worldX: 0,
    worldY: 0,
    x: 0,
    y: 0,
    rawCode: trimmedCode.padEnd(4, ' ').slice(0, 4),
    compact: isCompact,
    simple: isCompact,
    identified: true,
    socketed: false,
    ethereal: false,
    runeword: false,
    personalized: false,
    isEar: false,
    newItem: false,
    starterItem: false,
    broken: false,
    inSocket: false,
    equipped: false,
    socketedChildCount: 0,
    usedSockets: 0,
    totalSockets: 0,
    ilvl: 10,
    quality: 2,
    invWidth: base?.invWidth ?? 1,
    invHeight: base?.invHeight ?? 1,
    stats: [],
    setBonusStats: [],
    runewordStats: [],
    ...overrides,
    code: trimmedCode,
  }
}

describe('[K5] Wave 3 singleplayer combat, items, belt, weapon swap & vendor parity', () => {
  it('enforces InTown rejection in Area 1, casts #54 Teleport in Blood Moor, kills monsters with 0x0C/0x69, grants XP + level-up + drop, and picks up gold & items (0x16)', () => {
    const resolver = buildTestAreaResolver()
    const d2s = makeSorceressTestD2s({
      level: 1,
      experience: 490, // Sorceress level 2 threshold is 500 XP -> 1 Fallen kill levels up!
      maxMana: 200,
      mana: 200,
      leftSkill: 36, // Fire Bolt
      rightSkill: 54, // Teleport
      skillOffsets: {
        0: 3, // #36 Fire Bolt lvl 3
        11: 2, // #47 Fire Ball lvl 2
        18: 1, // #54 Teleport lvl 1 (24 mana)
      },
    })

    // Part A: Town rejection in Rogue Encampment (Area 1)
    const clock = { nowMs: 1000 }
    const townAdapter = new LocalKernelD2gsAdapter113c({
      d2s,
      areaId: 1,
      resolveAreaBootstrap: resolver,
    })
    const {
      session: townSession,
      events: townEvents,
      getProtocolErrors: getTownErrors,
    } = attachSessionWithEventLog(townAdapter, clock)
    stepAll(townAdapter, townSession, clock, 2)

    const pTownPlayer = townAdapter.handle.getPlayerPtr()
    const manaBeforeTownCast = STATLIST_GetUnitStat113c(townAdapter.bridge.m, pTownPlayer, 8, 0)
    const xBeforeTownCast = UNITS_GetX113c(townAdapter.bridge.m, pTownPlayer)
    const yBeforeTownCast = UNITS_GetY113c(townAdapter.bridge.m, pTownPlayer)

    townEvents.length = 0
    townSession.sendCommand({
      type: 'SkillAt',
      hand: 'right',
      at: { x: xBeforeTownCast + 5, y: yBeforeTownCast },
      hold: false,
    })
    stepAll(townAdapter, townSession, clock, 2)

    // #54 Teleport forbidden in Town (Area 1): S2C 0x2C sound 24 (notInTown1), 0 mana burn, position unchanged
    expect(townEvents.some((e) => e.type === 'PlaySound' && e.sound === 24)).toBe(true)
    expect(STATLIST_GetUnitStat113c(townAdapter.bridge.m, pTownPlayer, 8, 0)).toBe(manaBeforeTownCast)
    expect(UNITS_GetX113c(townAdapter.bridge.m, pTownPlayer)).toBe(xBeforeTownCast)
    expect(UNITS_GetY113c(townAdapter.bridge.m, pTownPlayer)).toBe(yBeforeTownCast)

    // Left combat skill (#36 Fire Bolt) also rejected in Town with sound 24 and 0 mana burn
    townEvents.length = 0
    townSession.sendCommand({
      type: 'SkillAt',
      hand: 'left',
      at: { x: xBeforeTownCast + 3, y: yBeforeTownCast },
      hold: false,
    })
    stepAll(townAdapter, townSession, clock, 2)
    expect(townEvents.some((e) => e.type === 'PlaySound' && e.sound === 24)).toBe(true)
    expect(STATLIST_GetUnitStat113c(townAdapter.bridge.m, pTownPlayer, 8, 0)).toBe(manaBeforeTownCast)
    expect(getTownErrors()).toBe(0)
    townAdapter.leave()

    // Part B: Blood Moor (Area 2) Teleport + Combat + Kill + Level-Up + Drop + Pickup
    const fieldAdapter = new LocalKernelD2gsAdapter113c({
      d2s,
      areaId: 2,
      resolveAreaBootstrap: resolver,
    })
    const {
      session: fieldSession,
      events: fieldEvents,
      getProtocolErrors: getFieldErrors,
    } = attachSessionWithEventLog(fieldAdapter, clock)
    stepAll(fieldAdapter, fieldSession, clock, 2)

    const pPlayer = fieldAdapter.handle.getPlayerPtr()
    const m = fieldAdapter.bridge.m
    const startX = UNITS_GetX113c(m, pPlayer)
    const startY = UNITS_GetY113c(m, pPlayer)
    const startMana256 = STATLIST_GetUnitStat113c(m, pPlayer, 8, 0)

    // 1. Cast #54 Teleport (C2S 0x0C) in Blood Moor to walkable subtile (+6, +2)
    fieldEvents.length = 0
    const tpDestX = startX + 6
    const tpDestY = startY + 2
    fieldSession.sendCommand({
      type: 'SkillAt',
      hand: 'right',
      at: { x: tpDestX, y: tpDestY },
      hold: false,
    })
    stepAll(fieldAdapter, fieldSession, clock, 2)

    expect(UNITS_GetX113c(m, pPlayer)).toBe(tpDestX)
    expect(UNITS_GetY113c(m, pPlayer)).toBe(tpDestY)
    expect(fieldSession.world.self.x).toBe(tpDestX)
    expect(fieldSession.world.self.y).toBe(tpDestY)
    // Level-1 Teleport costs 24 mana (`24 << 8 = 6144`) in 1.13c Skills.txt
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 8, 0)).toBe(startMana256 - (24 << 8))
    expect(fieldEvents.some((e) => e.type === 'SkillCast' && e.skill === 54)).toBe(true)
    expect(fieldEvents.some((e) => e.type === 'LifeMana')).toBe(true)

    // 2. Spawn a durable Blood Moor Zombie (`classId = 5`, `maxHp = 80`) to verify non-fatal S2C 0x0C hit
    const zombie = fieldAdapter.bridge.spawnMonsterInRoom({
      classId: 5,
      x: tpDestX + 2,
      y: tpDestY,
      maxHp: 80,
      hp: 80,
    })
    stepAll(fieldAdapter, fieldSession, clock, 1)

    fieldEvents.length = 0
    // Attack Zombie via LeftSkillTarget (`0x06`, #36 Fire Bolt)
    fieldSession.sendCommand({
      type: 'SkillOn',
      hand: 'left',
      target: { unitType: 1, id: zombie.unitId },
      shift: false,
      hold: false,
    })
    stepAll(fieldAdapter, fieldSession, clock, 2)

    const zombieHpAfter = STATLIST_GetUnitStat113c(m, zombie.pMonster, 6, 0) >> 8
    expect(zombieHpAfter).toBeLessThan(80)
    expect(zombieHpAfter).toBeGreaterThan(0)
    expect(
      fieldEvents.some(
        (e) =>
          e.type === 'UnitMode' &&
          e.unitType === 1 &&
          e.id === zombie.unitId &&
          e.hitClass !== undefined,
      ),
    ).toBe(true)

    // Also exercise shift + hold combat opcodes (`0x07`, `0x09`, `0x0A`) on the Zombie
    fieldSession.sendCommand({
      type: 'SkillOn',
      hand: 'left',
      target: { unitType: 1, id: zombie.unitId },
      shift: true,
      hold: false,
    })
    fieldSession.sendCommand({
      type: 'SkillOn',
      hand: 'left',
      target: { unitType: 1, id: zombie.unitId },
      shift: false,
      hold: true,
    })
    fieldSession.sendCommand({
      type: 'SkillOn',
      hand: 'left',
      target: { unitType: 1, id: zombie.unitId },
      shift: true,
      hold: true,
    })
    stepAll(fieldAdapter, fieldSession, clock, 2)
    expect(STATLIST_GetUnitStat113c(m, zombie.pMonster, 6, 0) >> 8).toBeLessThan(zombieHpAfter)

    // 3. Kill a Blood Moor Fallen (`classId = 19`) via RightSkillTarget (`0x0D`, #47 Fire Ball)
    fieldSession.sendCommand({ type: 'SelectSkill', hand: 'right', skill: 47 })
    stepAll(fieldAdapter, fieldSession, clock, 1)

    const fallen = fieldAdapter.bridge.spawnMonsterInRoom({
      classId: 19,
      x: tpDestX + 1,
      y: tpDestY + 1,
    })
    stepAll(fieldAdapter, fieldSession, clock, 1)

    const expBeforeKill = STATLIST_GetUnitStat113c(m, pPlayer, 13, 0) >>> 0
    fieldEvents.length = 0
    fieldSession.sendCommand({
      type: 'SkillOn',
      hand: 'right',
      target: { unitType: 1, id: fallen.unitId },
      shift: false,
      hold: false,
    })
    stepAll(fieldAdapter, fieldSession, clock, 2)

    // Monster died -> mode=12 in SparseMemory113c, S2C 0x69 death received by OnlineSession
    expect(STATLIST_GetUnitStat113c(m, fallen.pMonster, 6, 0)).toBe(0)
    expect(m.get(fallen.pMonster, D2UnitStrc.dwAnimMode)).toBe(12)
    expect(
      fieldEvents.some(
        (e) => e.type === 'UnitMode' && e.unitType === 1 && e.id === fallen.unitId && e.mode === 12,
      ),
    ).toBe(true)
    expect(fieldSession.world.getUnit('monster', fallen.unitId)?.dead).toBe(true)

    // XP gain + Level-up (490 + >=18 >= 500 -> Level 2, +5 statpts, +1 skillpt)
    const expAfterKill = STATLIST_GetUnitStat113c(m, pPlayer, 13, 0) >>> 0
    expect(expAfterKill).toBeGreaterThan(expBeforeKill)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 12, 0)).toBe(2)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 4, 0)).toBe(5)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 5, 0)).toBe(1)
    expect(fieldEvents.some((e) => e.type === 'Experience')).toBe(true)
    expect(fieldSession.world.self.level).toBe(2)

    // Ground drop spawned (`S2C 0x9C` groundSpawn)
    const groundDrops = fieldAdapter.bridge.getGroundItems()
    expect(groundDrops.length).toBeGreaterThanOrEqual(1)
    expect(fieldEvents.some((e) => e.type === 'ItemEvent' && e.container === 'ground')).toBe(true)

    // Spawn an explicit gold pile & an item right next to player and pick both up (`C2S 0x16`)
    const goldDrop = fieldAdapter.bridge.spawnGroundItemInRoom(
      { code: 'gld', goldAmount: 325, quantity: 325, compact: true, simple: true },
      tpDestX + 1,
      tpDestY,
      'groundSpawn',
    )
    const potionDrop = fieldAdapter.bridge.spawnGroundItemInRoom(
      { code: 'hp2', compact: true, simple: true },
      tpDestX,
      tpDestY + 1,
      'groundSpawn',
    )
    stepAll(fieldAdapter, fieldSession, clock, 1)

    const goldBeforePickup = STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0
    fieldSession.sendCommand({ type: 'ItemPickup', itemId: goldDrop.id, toCursor: false })
    fieldSession.sendCommand({ type: 'ItemPickup', itemId: potionDrop.id, toCursor: false })
    stepAll(fieldAdapter, fieldSession, clock, 2)

    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0).toBe(goldBeforePickup + 325)
    expect(fieldSession.world.self.gold).toBe(goldBeforePickup + 325)
    expect(fieldSession.world.containers.inventory.has(potionDrop.id)).toBe(true)
    expect(fieldAdapter.bridge.getGroundItems().some((g) => g.item.id === goldDrop.id)).toBe(false)
    expect(fieldAdapter.bridge.getGroundItems().some((g) => g.item.id === potionDrop.id)).toBe(false)

    // Verify exported `.d2s` persists level 2, XP, gold, and picked-up `hp2`!
    const exported = readD2sSave113c(fieldAdapter.exportD2s())
    expect(exported.level).toBe(2)
    expect(exported.attributes.experience).toBe(expAfterKill)
    expect(exported.attributes.statPts).toBe(5)
    expect(exported.attributes.skillPts).toBe(1)
    expect(exported.attributes.gold).toBe(goldBeforePickup + 325)
    expect(exported.items.some((i) => i.code.trim() === 'hp2' && i.location === 0)).toBe(true)

    expect(getFieldErrors()).toBe(0)
    fieldAdapter.leave()
  })

  it('handles inventory move/swap (0x19/0x18/0x1F), equip/unequip (+skill recompute 0x1C/0x1A), belt insert/remove/drink (0x23/0x24/0x26), potions/identify (0x20/0x27), drop gold (0x50), weapon swap (0x60), and .d2s round-trip', () => {
    const resolver = buildTestAreaResolver()
    const d2s = makeSorceressTestD2s({
      level: 10,
      gold: 4000,
      hp: 40,
      maxHp: 100,
      mana: 30,
      maxMana: 120,
      leftSkill: 36,
      rightSkill: 0,
      altLeftSkill: 39,
      altRightSkill: 0,
      items: [
        // Equipped Cap (bodyLoc 1)
        makeItemInput({
          code: 'cap',
          location: 1,
          container: 'equipment',
          bodyLoc: 1,
          equippedSlot: 1,
          equipped: true,
          storePage: 0,
          storagePage: 0,
          defense: 4,
          durability: 12,
          maxDurability: 12,
        }),
        // Equipped Short Staff (bodyLoc 4) with +2 Fire Bolt (stat 107 param 36)
        makeItemInput({
          code: 'sst',
          location: 1,
          container: 'equipment',
          bodyLoc: 4,
          equippedSlot: 4,
          equipped: true,
          storePage: 0,
          storagePage: 0,
          durability: 20,
          maxDurability: 20,
          stats: [{ statId: 107, param: 36, value: 2 }],
        }),
        // Equipped Sash (bodyLoc 8) -> 2 belt rows (8 slots)
        makeItemInput({
          code: 'lbl',
          location: 1,
          container: 'equipment',
          bodyLoc: 8,
          equippedSlot: 8,
          equipped: true,
          storePage: 0,
          storagePage: 0,
          defense: 2,
          durability: 12,
          maxDurability: 12,
        }),
        // Secondary weapon on swap slot 11: Wand with +1 Ice Bolt (stat 107 param 39)
        makeItemInput({
          code: 'wnd',
          location: 1,
          container: 'equipment',
          bodyLoc: 11,
          equippedSlot: 11,
          equipped: true,
          storePage: 0,
          storagePage: 0,
          durability: 15,
          maxDurability: 15,
          stats: [{ statId: 107, param: 39, value: 1 }],
        }),
        // Inventory items
        makeItemInput({ code: 'hp1', gridX: 0, gridY: 0, x: 0, y: 0 }),
        makeItemInput({ code: 'hp2', gridX: 1, gridY: 0, x: 1, y: 0 }),
        makeItemInput({ code: 'mp2', gridX: 2, gridY: 0, x: 2, y: 0 }),
        makeItemInput({ code: 'rvs', gridX: 3, gridY: 0, x: 3, y: 0 }),
        makeItemInput({ code: 'isc', gridX: 4, gridY: 0, x: 4, y: 0 }),
        makeItemInput({
          code: 'rin',
          gridX: 5,
          gridY: 0,
          x: 5,
          y: 0,
          quality: 4,
          identified: false,
          compact: false,
          simple: false,
          magicPrefixId: 1,
          magicSuffixId: 0,
          stats: [{ statId: 19, param: 0, value: 15 }],
        }),
        makeItemInput({ code: 'box', gridX: 6, gridY: 0, x: 6, y: 0, compact: false, simple: false }),
      ],
    })

    const clock = { nowMs: 2000 }
    const adapter = new LocalKernelD2gsAdapter113c({
      d2s,
      areaId: 1,
      resolveAreaBootstrap: resolver,
    })
    const { session, events, getProtocolErrors } = attachSessionWithEventLog(adapter, clock)
    stepAll(adapter, session, clock, 2)

    const m = adapter.bridge.m
    const pPlayer = adapter.handle.getPlayerPtr()

    const findInvItem = (code: string): ItemData => {
      const found = [...session.world.containers.inventory.values()].find(
        (i) => i.code.trim().toLowerCase() === code,
      )
      expect(found).toBeDefined()
      return found!
    }

    // 1. Inventory grid move (`0x19` -> cursor, `0x18` -> inventory (0, 2)) + Swap (`0x1F`)
    const hp1 = findInvItem('hp1')
    session.sendCommand({ type: 'ItemToCursor', itemId: hp1.id })
    stepAll(adapter, session, clock, 1)
    expect(session.world.containers.cursor?.id).toBe(hp1.id)

    session.sendCommand({ type: 'ItemPlace', itemId: hp1.id, x: 0, y: 2, buffer: 0 })
    stepAll(adapter, session, clock, 1)
    expect(session.world.containers.cursor).toBeNull()
    expect(session.world.containers.inventory.get(hp1.id)?.gridX).toBe(0)
    expect(session.world.containers.inventory.get(hp1.id)?.gridY).toBe(2)

    // Container swap (`0x1F`): pick `rvs` onto cursor and swap with `hp1` at (0, 2)
    const rvs = findInvItem('rvs')
    session.sendCommand({ type: 'ItemToCursor', itemId: rvs.id })
    stepAll(adapter, session, clock, 1)
    session.sendCommand({
      type: 'SwapContainerItem',
      cursorItemId: rvs.id,
      targetItemId: hp1.id,
      x: 0,
      y: 2,
    })
    stepAll(adapter, session, clock, 1)
    expect(session.world.containers.cursor?.id).toBe(hp1.id)
    expect(session.world.containers.inventory.get(rvs.id)?.gridX).toBe(0)
    expect(session.world.containers.inventory.get(rvs.id)?.gridY).toBe(2)
    // Put `hp1` back into inventory at (3, 0)
    session.sendCommand({ type: 'ItemPlace', itemId: hp1.id, x: 3, y: 0, buffer: 0 })
    stepAll(adapter, session, clock, 1)

    // 2. Equip / Unequip (`0x1C` / `0x1A`) with `+2 Fire Bolt` recomputation in `SparseMemory113c`
    const pFireBolt = SKILLS_GetSkillById113c(m, pPlayer, 36, -1)
    expect(pFireBolt).not.toBe(0)
    expect(SKILLS_GetSkillLevel113c(m, pPlayer, pFireBolt, 1)).toBe(2)

    const staff = session.world.containers.equipmentBySlot.get(4)
    expect(staff?.code.trim()).toBe('sst')

    session.sendCommand({ type: 'ItemUnequip', slot: 4 })
    stepAll(adapter, session, clock, 1)
    expect(session.world.containers.cursor?.id).toBe(staff!.id)
    expect(session.world.containers.equipmentBySlot.get(4)).toBeUndefined()
    // +2 Fire Bolt bonus removed cleanly in SparseMemory113c!
    expect(SKILLS_GetSkillLevel113c(m, pPlayer, pFireBolt, 1)).toBe(0)

    session.sendCommand({ type: 'ItemEquip', itemId: staff!.id, slot: 4 })
    stepAll(adapter, session, clock, 1)
    expect(session.world.containers.cursor).toBeNull()
    expect(session.world.containers.equipmentBySlot.get(4)?.id).toBe(staff!.id)
    expect(SKILLS_GetSkillLevel113c(m, pPlayer, pFireBolt, 1)).toBe(2)

    // 3. Belt insert (`0x23`), remove & shift (`0x24`), and belt potion drink (`0x26`)
    const hp2 = findInvItem('hp2')
    const mp2 = findInvItem('mp2')
    session.sendCommand({ type: 'ItemToCursor', itemId: hp1.id })
    session.sendCommand({ type: 'BeltPut', itemId: hp1.id, slot: 0 })
    session.sendCommand({ type: 'ItemToCursor', itemId: hp2.id })
    session.sendCommand({ type: 'BeltPut', itemId: hp2.id, slot: 4 }) // row 1 col 0 (Sash gives 2 rows!)
    session.sendCommand({ type: 'ItemToCursor', itemId: mp2.id })
    session.sendCommand({ type: 'BeltPut', itemId: mp2.id, slot: 1 })
    stepAll(adapter, session, clock, 2)

    expect(session.world.containers.belt.get(hp1.id)?.gridX).toBe(0)
    expect(session.world.containers.belt.get(hp2.id)?.gridX).toBe(4)
    expect(session.world.containers.belt.get(mp2.id)?.gridX).toBe(1)

    // Remove slot 0 (`hp1`) to cursor -> upper potion `hp2` (slot 4) shifts down to slot 0!
    session.sendCommand({ type: 'BeltRemove', itemId: hp1.id })
    stepAll(adapter, session, clock, 1)
    expect(session.world.containers.cursor?.id).toBe(hp1.id)
    expect(session.world.containers.belt.get(hp2.id)?.gridX).toBe(0)
    // Drop `hp1` onto ground (`0x17`) to free cursor
    session.sendCommand({ type: 'ItemDrop', itemId: hp1.id })
    stepAll(adapter, session, clock, 1)
    expect(session.world.containers.cursor).toBeNull()
    expect(adapter.bridge.getGroundItems().some((g) => g.item.id === hp1.id)).toBe(true)

    // Drink `hp2` (+60 HP) and `mp2` (+40 Mana) from belt (`0x26`)
    const hpBeforeDrink = STATLIST_GetUnitStat113c(m, pPlayer, 6, 0) >> 8
    const manaBeforeDrink = STATLIST_GetUnitStat113c(m, pPlayer, 8, 0) >> 8
    session.sendCommand({ type: 'BeltUse', itemId: hp2.id, shift: false })
    session.sendCommand({ type: 'BeltUse', itemId: mp2.id, shift: false })
    stepAll(adapter, session, clock, 2)

    expect(STATLIST_GetUnitStat113c(m, pPlayer, 6, 0) >> 8).toBe(Math.min(100, hpBeforeDrink + 60))
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 8, 0) >> 8).toBe(
      Math.min(120, manaBeforeDrink + 40),
    )
    expect(session.world.containers.belt.has(hp2.id)).toBe(false)
    expect(session.world.containers.belt.has(mp2.id)).toBe(false)

    // 4. Use inventory Horadric Cube (`0x20` -> `S2C 0x77 0x15`) + Identify Scroll (`0x27`)
    const box = findInvItem('box')
    session.sendCommand({ type: 'ItemUse', itemId: box.id, at: { x: box.gridX, y: box.gridY } })
    stepAll(adapter, session, clock, 1)
    expect(session.world.npcInteraction.cubeOpen).toBe(true)

    const isc = findInvItem('isc')
    const unidRing = findInvItem('rin')
    expect(unidRing.identified).toBe(false)
    session.sendCommand({ type: 'IdentifyItem', itemId: unidRing.id, scrollId: isc.id })
    stepAll(adapter, session, clock, 1)
    expect(session.world.containers.inventory.get(unidRing.id)?.identified).toBe(true)
    expect(session.world.containers.inventory.has(isc.id)).toBe(false)

    // 5. Drop Gold (`0x50`)
    const goldBeforeDrop = STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0
    session.sendCommand({ type: 'DropGold', unitId: adapter.playerUnitId, amount: 750 })
    stepAll(adapter, session, clock, 1)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0).toBe(goldBeforeDrop - 750)
    expect(
      adapter.bridge
        .getGroundItems()
        .some((g) => g.item.code === 'gld' && g.item.goldAmount === 750),
    ).toBe(true)

    // 6. Weapon Swap (`0x60` -> `S2C 0x97` + `S2C 0x9D 0x17` + skill bonus recomputation)
    events.length = 0
    session.sendCommand({ type: 'SwapWeapons' })
    stepAll(adapter, session, clock, 2)

    expect(events.some((e) => e.type === 'WeaponSwitch')).toBe(true)
    expect(session.world.containers.equipmentBySlot.get(4)?.code.trim()).toBe('wnd')
    expect(session.world.containers.equipmentBySlot.get(11)?.code.trim()).toBe('sst')
    // Active weapon is now `wnd` (+1 Ice Bolt); `sst` (+2 Fire Bolt) is inactive on swap!
    const pIceBolt = SKILLS_GetSkillById113c(m, pPlayer, 39, -1)
    expect(SKILLS_GetSkillLevel113c(m, pPlayer, pFireBolt, 1)).toBe(0)
    expect(SKILLS_GetSkillLevel113c(m, pPlayer, pIceBolt, 1)).toBe(1)

    // 7. Export `.d2s` and round-trip into a fresh LocalKernelD2gsAdapter113c!
    const exportedBytes = adapter.exportD2s()
    const reparsed = readD2sSave113c(exportedBytes)
    expect(reparsed.activeWeapon).toBe(1)
    expect(reparsed.attributes.gold).toBe(goldBeforeDrop - 750)
    expect(reparsed.items.some((i) => i.code.trim() === 'wnd' && i.bodyLoc === 4)).toBe(true)
    expect(reparsed.items.some((i) => i.code.trim() === 'sst' && i.bodyLoc === 11)).toBe(true)
    expect(reparsed.items.some((i) => i.code.trim() === 'rin' && i.identified)).toBe(true)
    expect(reparsed.items.some((i) => i.code.trim() === 'hp2')).toBe(false)
    expect(reparsed.items.some((i) => i.code.trim() === 'mp2')).toBe(false)
    expect(reparsed.items.some((i) => i.code.trim() === 'isc')).toBe(false)

    // Reload from exported `.d2s` and verify live session reflects every persisted mutation
    const reloadAdapter = new LocalKernelD2gsAdapter113c({
      d2s: exportedBytes,
      areaId: 1,
      resolveAreaBootstrap: resolver,
    })
    const { session: reloadSession, getProtocolErrors: getReloadErrors } = attachSessionWithEventLog(
      reloadAdapter,
      clock,
    )
    stepAll(reloadAdapter, reloadSession, clock, 2)
    expect(reloadSession.world.self.gold).toBe(goldBeforeDrop - 750)
    expect(reloadSession.world.containers.equipmentBySlot.get(4)?.code.trim()).toBe('wnd')
    expect(reloadSession.world.containers.equipmentBySlot.get(11)?.code.trim()).toBe('sst')

    expect(getProtocolErrors()).toBe(0)
    expect(getReloadErrors()).toBe(0)
    adapter.leave()
    reloadAdapter.leave()
  })

  it('handles vendor open (0x38), buy (0x32), sell (0x33), repair single & all (0x35), quest message (0x31), and stash gold deposit/withdraw/close (0x13/0x4F)', () => {
    const resolver = buildTestAreaResolver()
    const d2s = makeSorceressTestD2s({
      level: 10,
      gold: 20000,
      goldBank: 5000,
      items: [
        // Damaged equipped Short Staff (10/20 durability)
        makeItemInput({
          code: 'sst',
          location: 1,
          container: 'equipment',
          bodyLoc: 4,
          equippedSlot: 4,
          equipped: true,
          storePage: 0,
          storagePage: 0,
          durability: 10,
          curDurability: 10,
          maxDurability: 20,
        }),
        // Damaged equipped Cap (4/12 durability)
        makeItemInput({
          code: 'cap',
          location: 1,
          container: 'equipment',
          bodyLoc: 1,
          equippedSlot: 1,
          equipped: true,
          storePage: 0,
          storagePage: 0,
          defense: 4,
          durability: 4,
          curDurability: 4,
          maxDurability: 12,
        }),
        // Sellable Quilted Armor in inventory
        makeItemInput({
          code: 'qui',
          location: 0,
          container: 'inventory',
          storePage: 1,
          storagePage: 1,
          gridX: 0,
          gridY: 0,
          x: 0,
          y: 0,
          defense: 10,
          durability: 20,
          curDurability: 20,
          maxDurability: 20,
        }),
      ],
    })

    const clock = { nowMs: 3000 }
    const adapter = new LocalKernelD2gsAdapter113c({
      d2s,
      areaId: 1,
      resolveAreaBootstrap: resolver,
    })
    const { session, events, getProtocolErrors } = attachSessionWithEventLog(adapter, clock)
    stepAll(adapter, session, clock, 2)

    const m = adapter.bridge.m
    const pPlayer = adapter.handle.getPlayerPtr()

    const findNpcByClass = (classId: number): number => {
      for (const u of session.world.getUnitsByType('monster')) {
        if (u.classId === classId) return u.id
      }
      throw new Error(`NPC classId ${classId} not found in town`)
    }
    const charsiId = findNpcByClass(154)
    const akaraId = findNpcByClass(148)
    const stashObj = session.world.getUnitsByType('object').find((o) => o.classId === 267)
    expect(stashObj).toBeDefined()

    // 1. QuestMessage (`0x31`) to Akara -> emits S2C `0x27` NpcInfo
    events.length = 0
    session.sendCommand({ type: 'QuestMessage', npcId: akaraId, messageId: 1234 })
    stepAll(adapter, session, clock, 1)
    expect(
      events.some(
        (e) =>
          e.type === 'Npc' &&
          e.kind === 'info' &&
          e.npcId === akaraId &&
          e.messages?.some((msg) => msg.stringId === 1234),
      ),
    ).toBe(true)

    // 2. Vendor Open (`0x38` Trade=1) with Charsi -> emits S2C `0x9C` vendor stock + `0x27`
    events.length = 0
    session.sendCommand({
      type: 'NpcEntityAction',
      action: NpcActionId.Trade,
      npcId: charsiId,
      complement: 0,
    })
    stepAll(adapter, session, clock, 2)

    const shopItems = [...session.world.containers.shop.values()]
    expect(shopItems.length).toBeGreaterThan(0)
    expect(events.some((e) => e.type === 'ItemEvent' && e.container === 'shop')).toBe(true)
    expect(events.some((e) => e.type === 'Npc' && e.kind === 'info' && e.npcId === charsiId)).toBe(
      true,
    )

    // 3. BuyItem (`0x32`) from Charsi's vendor pool
    const itemToBuy = shopItems[0]!
    const goldBeforeBuy = STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0
    events.length = 0
    session.sendCommand({
      type: 'NpcBuy',
      npcId: charsiId,
      itemId: itemToBuy.id,
      itemMode: 0,
      gamble: false,
      shiftFill: false,
      cost: 0,
    })
    stepAll(adapter, session, clock, 2)

    const goldAfterBuy = STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0
    expect(goldAfterBuy).toBeLessThan(goldBeforeBuy)
    expect(events.some((e) => e.type === 'NpcTransaction' && e.result === 0)).toBe(true)
    const ownedAfterBuy = adapter.bridge.getPlayerOwnedItems(adapter.handle.clientId)
    expect(ownedAfterBuy.some((i) => i.code.trim() === itemToBuy.code.trim())).toBe(true)

    // 4. SellItem (`0x33`) selling Quilted Armor (`qui`) to Charsi
    const quiItem = [...session.world.containers.inventory.values()].find(
      (i) => i.code.trim() === 'qui',
    )
    expect(quiItem).toBeDefined()
    events.length = 0
    session.sendCommand({
      type: 'NpcSell',
      npcId: charsiId,
      itemId: quiItem!.id,
      itemMode: 0,
      cost: 0,
    })
    stepAll(adapter, session, clock, 2)

    const goldAfterSell = STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0
    expect(goldAfterSell).toBeGreaterThan(goldAfterBuy)
    expect(events.some((e) => e.type === 'NpcTransaction' && e.result === 1)).toBe(true)
    expect(session.world.containers.inventory.has(quiItem!.id)).toBe(false)

    // 5. RepairItem single (`0x35` on damaged Cap) + RepairAll (`0x35` `0x80000000` on remaining damaged Short Staff)
    const damagedCap = session.world.containers.equipmentBySlot.get(1)!
    const damagedStaff = session.world.containers.equipmentBySlot.get(4)!
    expect(damagedCap.curDurability ?? damagedCap.durability).toBe(4)
    expect(damagedStaff.curDurability ?? damagedStaff.durability).toBe(10)

    const goldBeforeRepairSingle = STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0
    session.sendCommand({
      type: 'NpcRepairItem',
      npcId: charsiId,
      itemId: damagedCap.id,
      itemMode: 1,
      durability: 4,
    })
    stepAll(adapter, session, clock, 2)

    const goldAfterRepairSingle = STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0
    expect(goldAfterRepairSingle).toBeLessThan(goldBeforeRepairSingle)
    const repairedCap = session.world.containers.equipmentBySlot.get(1)!
    expect(repairedCap.curDurability ?? repairedCap.durability).toBe(12)

    // Now RepairAll (`0x80000000`) -> repairs the remaining damaged Short Staff (10 -> 20)
    session.sendCommand({ type: 'NpcRepairAll', npcId: charsiId })
    stepAll(adapter, session, clock, 2)

    const goldAfterRepairAll = STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0
    expect(goldAfterRepairAll).toBeLessThan(goldAfterRepairSingle)
    const repairedStaff = session.world.containers.equipmentBySlot.get(4)!
    expect(repairedStaff.curDurability ?? repairedStaff.durability).toBe(20)

    // Close NPC chat (`0x30`)
    session.sendCommand({ type: 'NpcCancel', target: { unitType: 1, id: charsiId } })
    stepAll(adapter, session, clock, 1)

    // 6. Stash Interact (`0x13` -> `S2C 0x77 0x10`) + DepositGold (`0x4F 0x14`) + WithdrawGold (`0x4F 0x13`) + CloseStash (`0x4F 0x12`)
    session.sendCommand({ type: 'Interact', target: { unitType: 2, id: stashObj!.id } })
    stepAll(adapter, session, clock, 2)
    expect(session.world.npcInteraction.stashOpen).toBe(true)

    const invGoldBeforeDeposit = STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0
    const bankGoldBeforeDeposit = STATLIST_GetUnitStat113c(m, pPlayer, 15, 0) >>> 0

    session.sendCommand({ type: 'ClickButton', buttonId: ClickButtonId.DepositGold, amount: 3000 })
    stepAll(adapter, session, clock, 1)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0).toBe(invGoldBeforeDeposit - 3000)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 15, 0) >>> 0).toBe(bankGoldBeforeDeposit + 3000)

    session.sendCommand({ type: 'ClickButton', buttonId: ClickButtonId.WithdrawGold, amount: 1200 })
    stepAll(adapter, session, clock, 1)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0).toBe(invGoldBeforeDeposit - 1800)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 15, 0) >>> 0).toBe(bankGoldBeforeDeposit + 1800)
    expect(session.world.self.gold).toBe(invGoldBeforeDeposit - 1800)
    expect(session.world.self.stats.get(15)).toBe(bankGoldBeforeDeposit + 1800)

    session.sendCommand({ type: 'ClickButton', buttonId: ClickButtonId.CloseStash, amount: 0 })
    stepAll(adapter, session, clock, 1)
    expect(session.world.npcInteraction.stashOpen).toBe(false)

    // Verify `.d2s` export persists repaired durability, sold/bought items, and stash gold!
    const exported = readD2sSave113c(adapter.exportD2s())
    expect(exported.attributes.gold).toBe(invGoldBeforeDeposit - 1800)
    expect(exported.attributes.goldBank).toBe(bankGoldBeforeDeposit + 1800)
    expect(exported.items.some((i) => i.code.trim() === 'qui')).toBe(false)
    const savedStaff = exported.items.find((i) => i.code.trim() === 'sst' && i.bodyLoc === 4)
    expect(savedStaff?.curDurability ?? savedStaff?.durability).toBe(20)

    expect(getProtocolErrors()).toBe(0)
    adapter.leave()
  })

  it('handles location AoE skill cast (0x05/0x0C), SwapEquipped (0x1D), inventory potion & TP scroll + portal return (0x20/0x13), Horadric Cube transmute (0x2A/0x4F 0x18), Cain IdentifyAll (0x34), and Gamble (0x38/0x32)', () => {
    const resolver = buildTestAreaResolver()
    const d2s = makeSorceressTestD2s({
      level: 10,
      hp: 40,
      maxHp: 120,
      mana: 30,
      maxMana: 120,
      gold: 50000,
      skillOffsets: {
        0: 5, // #36 Fire Bolt lvl 5
        18: 1, // #54 Teleport lvl 1
      },
      items: [
        // Equipped Cap (bodyLoc 1)
        makeItemInput({
          code: 'cap',
          location: 1,
          container: 'equipment',
          bodyLoc: 1,
          equippedSlot: 1,
          equipped: true,
          storePage: 0,
          storagePage: 0,
          defense: 4,
          durability: 12,
          maxDurability: 12,
        }),
        // Replacement Skull Cap in inventory for 0x1D SwapEquippedItem
        makeItemInput({
          code: 'skp',
          location: 0,
          container: 'inventory',
          storePage: 1,
          storagePage: 1,
          gridX: 0,
          gridY: 0,
          x: 0,
          y: 0,
          defense: 9,
          durability: 18,
          maxDurability: 18,
        }),
        // Inventory Rejuvenation Potion (`rvs`) + Town Portal Scroll (`tsc`) + Horadric Cube (`box`)
        makeItemInput({ code: 'rvs', gridX: 2, gridY: 0, x: 2, y: 0 }),
        makeItemInput({ code: 'tsc', gridX: 3, gridY: 0, x: 3, y: 0 }),
        makeItemInput({ code: 'box', gridX: 4, gridY: 0, x: 4, y: 0, compact: false, simple: false }),
        // 3 Chipped Rubies (`gcr`) for authentic Cubemain.txt transmute -> Flawed Ruby (`gfr`)
        makeItemInput({ code: 'gcr', gridX: 6, gridY: 0, x: 6, y: 0 }),
        makeItemInput({ code: 'gcr', gridX: 7, gridY: 0, x: 7, y: 0 }),
        makeItemInput({ code: 'gcr', gridX: 8, gridY: 0, x: 8, y: 0 }),
        // Unidentified magic ring for Deckard Cain IdentifyAll (`0x34`)
        makeItemInput({
          code: 'rin',
          gridX: 9,
          gridY: 0,
          x: 9,
          y: 0,
          quality: 4,
          identified: false,
          compact: false,
          simple: false,
          magicPrefixId: 1,
          magicSuffixId: 0,
          stats: [{ statId: 19, param: 0, value: 12 }],
        }),
      ],
    })

    const clock = { nowMs: 4000 }
    const adapter = new LocalKernelD2gsAdapter113c({
      d2s,
      areaId: 2, // Start directly in Blood Moor
      resolveAreaBootstrap: resolver,
    })
    const { session, events, getProtocolErrors } = attachSessionWithEventLog(adapter, clock)
    stepAll(adapter, session, clock, 2)

    const m = adapter.bridge.m
    const pPlayer = adapter.handle.getPlayerPtr()

    const findInvItem = (code: string): ItemData => {
      const found = [...session.world.containers.inventory.values()].find(
        (i) => i.code.trim().toLowerCase() === code,
      )
      expect(found).toBeDefined()
      return found!
    }

    // 1. Cast location skill `#36 Fire Bolt` (`0x0C` RightSkillAt) toward a Blood Moor Zombie
    const plrX = UNITS_GetX113c(m, pPlayer) & 0xffff
    const plrY = UNITS_GetY113c(m, pPlayer) & 0xffff
    const targetZombie = adapter.bridge.spawnMonsterInRoom({
      classId: 5,
      x: plrX + 2,
      y: plrY,
      maxHp: 80,
      hp: 80,
    })
    stepAll(adapter, session, clock, 1)
    const zombieHpBefore = STATLIST_GetUnitStat113c(m, targetZombie.pMonster, 6, 0) >> 8

    session.sendCommand({ type: 'SelectSkill', hand: 'right', skillId: 36 })
    stepAll(adapter, session, clock, 1)
    events.length = 0
    session.sendCommand({
      type: 'SkillAt',
      hand: 'right',
      at: { x: plrX + 2, y: plrY },
      hold: false,
    })
    stepAll(adapter, session, clock, 2)

    expect(events.some((e) => e.type === 'SkillCast' && e.skill === 36)).toBe(true)
    const zombieHpAfter = STATLIST_GetUnitStat113c(m, targetZombie.pMonster, 6, 0) >> 8
    expect(zombieHpAfter).toBeLessThan(zombieHpBefore)

    // 2. SwapEquippedItem (`0x1D`): swap inventory `skp` onto equipped `cap` in bodyLoc 1
    const origCapId = session.world.containers.equipmentBySlot.get(1)!.id
    const skp = findInvItem('skp')
    session.sendCommand({ type: 'ItemToCursor', itemId: skp.id })
    stepAll(adapter, session, clock, 1)
    session.sendCommand({ type: 'ItemSwap', itemId: skp.id, slot: 1 })
    stepAll(adapter, session, clock, 1)
    expect(session.world.containers.equipmentBySlot.get(1)?.id).toBe(skp.id)
    expect(session.world.containers.cursor?.id).toBe(origCapId)
    // Put old `cap` back in inventory at (0, 0)
    session.sendCommand({ type: 'ItemPlace', itemId: origCapId, x: 0, y: 0, buffer: 0 })
    stepAll(adapter, session, clock, 1)
    expect(session.world.containers.cursor).toBeNull()

    // 3. Use inventory Rejuvenation Potion (`0x20` `rvs` restores 35% of maxHP and maxMana)
    const hpBeforeRvs = STATLIST_GetUnitStat113c(m, pPlayer, 6, 0) >> 8
    const manaBeforeRvs = STATLIST_GetUnitStat113c(m, pPlayer, 8, 0) >> 8
    const rvs = findInvItem('rvs')
    session.sendCommand({ type: 'ItemUse', itemId: rvs.id, at: { x: rvs.gridX, y: rvs.gridY } })
    stepAll(adapter, session, clock, 1)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 6, 0) >> 8).toBeGreaterThan(hpBeforeRvs)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 8, 0) >> 8).toBeGreaterThan(manaBeforeRvs)
    expect(session.world.containers.inventory.has(rvs.id)).toBe(false)

    // 4. Horadric Cube transmute (`0x2A` ItemToCube x3 + `0x4F 0x18` Transmute: 3 `gcr` -> 1 `gfr`)
    const box = findInvItem('box')
    const rubies = [...session.world.containers.inventory.values()].filter(
      (i) => i.code.trim().toLowerCase() === 'gcr',
    )
    expect(rubies).toHaveLength(3)
    for (const ruby of rubies) {
      session.sendCommand({ type: 'ItemToCursor', itemId: ruby.id })
      session.sendCommand({ type: 'ItemToCube', itemId: ruby.id, cubeId: box.id })
    }
    stepAll(adapter, session, clock, 2)
    expect(session.world.containers.cube.size).toBe(3)

    session.sendCommand({ type: 'ClickButton', buttonId: ClickButtonId.Transmute, amount: 0 })
    stepAll(adapter, session, clock, 2)
    const cubeAfter = [...session.world.containers.cube.values()]
    expect(cubeAfter).toHaveLength(1)
    expect(cubeAfter[0]!.code.trim().toLowerCase()).toBe('gfr')

    // 5. Use Town Portal scroll (`0x20` `tsc`) in Blood Moor -> spawns Portal (`classId=59`) -> Interact (`0x13`) -> warps to Rogue Encampment (Area 1)!
    const tsc = findInvItem('tsc')
    session.sendCommand({ type: 'ItemUse', itemId: tsc.id, at: { x: tsc.gridX, y: tsc.gridY } })
    stepAll(adapter, session, clock, 2)
    expect(session.world.containers.inventory.has(tsc.id)).toBe(false)
    const portalObj = session.world.getUnitsByType('object').find((o) => o.classId === 59)
    expect(portalObj).toBeDefined()

    session.sendCommand({ type: 'Interact', target: { unitType: 2, id: portalObj!.id } })
    stepAll(adapter, session, clock, 3)
    expect(adapter.bridge.currentAreaId).toBe(1)
    expect(session.world.areaId).toBe(1)

    // 6. Deckard Cain IdentifyAll (`0x34`) identifies the unidentified ring for free
    const cain = session.world.getUnitsByType('monster').find((u) => u.classId === 146)
    expect(cain).toBeDefined()
    const unidRing = findInvItem('rin')
    expect(unidRing.identified).toBe(false)
    const goldBeforeCain = STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0
    session.sendCommand({ type: 'NpcIdentifyAll', npcId: cain!.id })
    stepAll(adapter, session, clock, 2)
    expect(session.world.containers.inventory.get(unidRing.id)?.identified).toBe(true)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0).toBe(goldBeforeCain)

    // 7. Gheed Gamble (`0x38` Gamble=2 -> `0x32` gamble buy)
    const gheed = session.world.getUnitsByType('monster').find((u) => u.classId === 147)
    expect(gheed).toBeDefined()
    session.sendCommand({
      type: 'NpcEntityAction',
      action: NpcActionId.Gamble,
      npcId: gheed!.id,
      complement: 0,
    })
    stepAll(adapter, session, clock, 2)
    const gamblePool = [...session.world.containers.shop.values()]
    expect(gamblePool.length).toBeGreaterThan(0)

    const gambleTarget = gamblePool[0]!
    const goldBeforeGamble = STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0
    const invCountBeforeGamble = session.world.containers.inventory.size
    session.sendCommand({
      type: 'NpcGamble',
      npcId: gheed!.id,
      itemId: gambleTarget.id,
      cost: 0,
    })
    stepAll(adapter, session, clock, 2)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0).toBeLessThan(goldBeforeGamble)
    expect(session.world.containers.inventory.size).toBe(invCountBeforeGamble + 1)

    expect(getProtocolErrors()).toBe(0)
    adapter.leave()
  })
})
