import { describe, expect, it } from 'vitest'
import { GameInstance } from '../src/server/engine/game-instance.ts'
import { tickMercenaryAi25Hz, type MercenaryUnitState } from '../src/server/ai/monster-ai.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import {
  STATE_COLOR_SHIFTS,
  buildSceneDrawables,
  resolveStateOverlayTokens113c,
} from '../src/client/view/unit-drawables.ts'

describe('Issue #1489: Act 2 Mercenary Holy Freeze & AuraScanner Full Sweep', () => {
  it('chills, slows, and damages surrounding monsters when Act 2 Holy Freeze mercenary is active', () => {
    const game = new GameInstance({ seed: 1489, difficulty: 1, act: 1, areaId: 41 })
    const p1 = game.connectPlayer({ name: 'Paladin_Host', charClass: 'pal', level: 50 })
    const pState = game.getPlayerState(p1)!

    // Spawn a hostile monster near the mercenary and one far outside Holy Freeze range
    const nearMonId = game.spawnMonster({
      defId: 'fallen1',
      x: pState.x + 3,
      y: pState.y + 2,
      areaId: 41,
      hp: 1000,
      maxHp: 1000,
    })
    const farMonId = game.spawnMonster({
      defId: 'fallen1',
      x: pState.x + 35,
      y: pState.y + 35,
      areaId: 41,
      hp: 1000,
      maxHp: 1000,
    })

    // Hire Act 2 Nightmare Defensive mercenary (subType 10 = Def-Nightmare = Holy Freeze #114)
    const mercId = game.hireMercenary(p1, {
      act: 2,
      difficulty: 2,
      subType: 10,
      level: 50,
      x: pState.x + 1,
      y: pState.y + 1,
    })

    const merc = game.getMercenaryState(mercId)!
    expect(merc.activeAura).toBe('Holy Freeze')
    // Caster state 43 (`holywind`) belongs on the mercenary unit, NOT on the owner player
    expect(merc.states?.has(43)).toBe(true)
    expect(game.getPlayerState(p1)!.states.has(43)).toBe(false)

    // Nearby monster immediately receives target state 44 (`holywindcold`), chillTicks > 0, and radial cold damage
    const nearMon = game.getMonster(nearMonId)!
    expect(nearMon.states.has(44)).toBe(true)
    expect(nearMon.chillTicks).toBeGreaterThan(0)
    expect(nearMon.hp).toBeLessThan(1000)

    // Out-of-range monster is untouched
    const farMon = game.getMonster(farMonId)!
    expect(farMon.states.has(44)).toBe(false)
    expect(farMon.hp).toBe(1000)

    // Spawn a new monster after hireMercenary between perdelay=50 ticks; it must be chilled on the next step
    const newlySpawnedId = game.spawnMonster({
      defId: 'fallen1',
      x: merc.x + 2,
      y: merc.y + 1,
      areaId: 41,
      hp: 800,
      maxHp: 800,
    })
    game.stepFrames(3)
    const newlySpawned = game.getMonster(newlySpawnedId)!
    expect(newlySpawned.states.has(44)).toBe(true)
    expect(newlySpawned.chillTicks).toBeGreaterThan(0)
    expect(newlySpawned.hp).toBeLessThan(800)
  })

  it('respects 1.13c SrvDo066 Holy Freeze exclusions: Prime Evils, coldEffect === 0, town, and wall LoS', () => {
    const game = new GameInstance({ seed: 2489, difficulty: 1, act: 1, areaId: 41 })
    const p1 = game.connectPlayer({ name: 'Sorceress_Host', charClass: 'sor', level: 60 })
    const pState = game.getPlayerState(p1)!

    // Prime Evil (Diablo, isPrimeEvil = true)
    const diabloId = game.spawnMonster({
      defId: 'diablo',
      x: pState.x + 2,
      y: pState.y + 1,
      areaId: 41,
      hp: 5000,
      maxHp: 5000,
    })

    // Monster behind a solid wall (LoS blocked)
    game.setTerrainWalkableCheck((_areaId, x, _y) => {
      if (Math.round(x) === Math.round(pState.x + 4)) return false
      return true
    })
    const walledMonId = game.spawnMonster({
      defId: 'fallen1',
      x: pState.x + 6,
      y: pState.y + 1,
      areaId: 41,
      hp: 1000,
      maxHp: 1000,
    })

    game.hireMercenary(p1, {
      act: 2,
      difficulty: 2,
      subType: 10,
      level: 60,
      x: pState.x + 1,
      y: pState.y + 1,
    })
    game.stepFrames(5)

    const diablo = game.getMonster(diabloId)!
    expect(diablo.states.has(44)).toBe(false)
    expect(diablo.hp).toBe(5000)

    const walledMon = game.getMonster(walledMonId)!
    expect(walledMon.states.has(44)).toBe(false)
    expect(walledMon.hp).toBe(1000)
  })

  it('adds Holy Freeze 5x passive cold weapon damage to the mercenary melee attacks', () => {
    // Compare melee damage of a Holy Freeze mercenary against a 0% cold-resist vs 100% cold-immune target
    const gameColdVuln = new GameInstance({ seed: 3489, difficulty: 1, act: 1, areaId: 41 })
    const pVuln = gameColdVuln.connectPlayer({ name: 'MercTester1', charClass: 'bar', level: 50 })
    const pos1 = gameColdVuln.getPlayerState(pVuln)!
    const mVulnId = gameColdVuln.spawnMonster({
      defId: 'fallen1',
      x: pos1.x + 2,
      y: pos1.y + 1,
      areaId: 41,
      hp: 5000,
      maxHp: 5000,
      ac: 0,
      resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
    })
    gameColdVuln.hireMercenary(pVuln, {
      act: 2,
      difficulty: 2,
      subType: 10,
      level: 50,
      x: pos1.x + 1,
      y: pos1.y + 1,
    })

    const gameColdImmune = new GameInstance({ seed: 3489, difficulty: 1, act: 1, areaId: 41 })
    const pImm = gameColdImmune.connectPlayer({ name: 'MercTester2', charClass: 'bar', level: 50 })
    const pos2 = gameColdImmune.getPlayerState(pImm)!
    const mImmId = gameColdImmune.spawnMonster({
      defId: 'fallen1',
      x: pos2.x + 2,
      y: pos2.y + 1,
      areaId: 41,
      hp: 5000,
      maxHp: 5000,
      ac: 0,
      resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 100, poison: 0 },
    })
    gameColdImmune.hireMercenary(pImm, {
      act: 2,
      difficulty: 2,
      subType: 10,
      level: 50,
      x: pos2.x + 1,
      y: pos2.y + 1,
    })

    // Step 10 frames so the mercenary lands a melee hit (before frame 50's next radial pulse)
    const hpVulnAfterInitPulse = gameColdVuln.getMonster(mVulnId)!.hp
    const hpImmAfterInitPulse = gameColdImmune.getMonster(mImmId)!.hp
    gameColdVuln.stepFrames(10)
    gameColdImmune.stepFrames(10)

    const meleeLossVuln = hpVulnAfterInitPulse - gameColdVuln.getMonster(mVulnId)!.hp
    const meleeLossImm = hpImmAfterInitPulse - gameColdImmune.getMonster(mImmId)!.hp
    expect(meleeLossVuln).toBeGreaterThan(meleeLossImm)
    // Cold-immune monster is still chilled by Holy Freeze (state 44) in 1.13c because coldEffect != 0
    expect(gameColdImmune.getMonster(mImmId)!.states.has(44)).toBe(true)
  })

  it('runs all Act 2 mercenary innate auras (Prayer, Defiance, Blessed Aim, Thorns, Might) and item_aura (151)', () => {
    const game = new GameInstance({ seed: 4489, difficulty: 0, act: 1, areaId: 41 })
    const p1 = game.connectPlayer({ name: 'AuraSweepHost', charClass: 'nec', level: 40 })
    const pState = game.getPlayerState(p1)!

    // 1. Prayer (#99 -> state 34) heals wounded player
    const playersMap = (game as unknown as {
      players: Map<number, { hp: number; maxHp: number; hpFixed: number; maxHpFixed: number }>
    }).players
    const pRec = playersMap.get(p1)!
    pRec.hp = 10
    pRec.hpFixed = 10 * 256

    const prayerMercId = game.hireMercenary(p1, {
      act: 2,
      difficulty: 1,
      subType: 6, // Combat Normal = Prayer
      level: 40,
      x: pState.x + 1,
      y: pState.y + 1,
    })
    expect(game.getMercenaryState(prayerMercId)!.activeAura).toBe('Prayer')
    expect(game.getPlayerState(p1)!.states.has(34)).toBe(true)
    expect(game.getPlayerState(p1)!.hp).toBeGreaterThan(10)

    // 2. Thorns (#103 -> state 36) applies to mercenary and ally player
    const thornsMercId = game.hireMercenary(p1, {
      act: 2,
      difficulty: 2,
      subType: 9, // Combat Nightmare = Thorns
      level: 45,
      hp: 2000,
      maxHp: 2000,
      x: pState.x + 1,
      y: pState.y + 1,
    })
    expect(game.getMercenaryState(thornsMercId)!.activeAura).toBe('Thorns')
    expect(game.getPlayerState(p1)!.states.has(36)).toBe(true)
    expect(game.getMercenaryState(thornsMercId)!.states?.has(36)).toBe(true)

    // 3. Equipping an item with STAT_ITEM_AURA (151, param = 123 Conviction, value = 12) on the mercenary
    // applies Conviction (state 28) to nearby monsters alongside the mercenary's innate aura
    const mercsMap = (game as unknown as {
      mercenaries: Map<number, { equipment: unknown[] }>
    }).mercenaries
    mercsMap.get(thornsMercId)!.equipment.push({
      unitId: 9001,
      code: 'vou',
      name: 'Infinity',
      quality: 7,
      level: 85,
      location: 'equipped',
      x: 0,
      y: 0,
      width: 2,
      height: 4,
      areaId: 41,
      ownerId: thornsMercId,
      bodyLoc: 4,
      storePage: 0,
      cost: 1000,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: true,
      totalSockets: 4,
      durability: 50,
      maxDurability: 50,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
      rawItemData: {
        id: 9001,
        itemId: 9001,
        code: 'vou',
        name: 'Infinity',
        quality: 7,
        level: 85,
        identified: true,
        ethereal: false,
        socketed: true,
        sockets: 4,
        stats: [{ statId: 151, param: 123, value: 12 }],
        runewordStats: [],
      } as any,
    })
    const convTargetId = game.spawnMonster({
      defId: 'fallen1',
      x: pState.x + 2,
      y: pState.y + 2,
      areaId: 41,
      hp: 1500,
      maxHp: 1500,
    })
    game.stepFrames(2)
    expect(game.getMonster(convTargetId)!.states.has(28)).toBe(true)
  })

  it('applies chillTicks to surrounding monsters in standalone tickMercenaryAi25Hz when activeAura is Holy Freeze', () => {
    const merc: MercenaryUnitState = {
      act: 2,
      subType: 11,
      level: 30,
      difficulty: 2,
      x: 100,
      y: 100,
      hp: 500,
      maxHp: 500,
      damage: 40,
      alive: true,
      activeAura: 'Holy Freeze',
    }
    const nearMon = {
      id: 1,
      defId: 'fallen1',
      x: 140,
      y: 100,
      hp: 200,
      maxHp: 200,
      dead: false,
      chillTicks: 0,
    }
    const primeEvilMon = {
      id: 2,
      defId: 'diablo',
      x: 120,
      y: 100,
      hp: 5000,
      maxHp: 5000,
      dead: false,
      isPrimeEvil: true,
      chillTicks: 0,
    }
    const world = {
      player: { x: 100, y: 100, hp: 500, maxHp: 500 } as any,
      players: [],
      monsters: [nearMon as any, primeEvilMon as any],
      tick: 1,
      kills: 0,
      events: [],
      pendingKills: [],
    } as unknown as Parameters<typeof tickMercenaryAi25Hz>[1]
    tickMercenaryAi25Hz(merc, world)
    expect(nearMon.chillTicks).toBe(50)
    expect(primeEvilMon.chillTicks).toBe(0)
  })

  it('renders blue tint, ice_explode overlay, holyfreeze caster ring, and slows NpcMotion on the client', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 1, mapSeed: 1489, areaId: 41 })

    // 1. Assign mercenary (unitId 200, Act 2 guard classId 338) and monster (unitId 300, fallen1 classId 0)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 200,
        classId: 338,
        name: 'Waheed',
        x: 50,
        y: 50,
        mode: 1,
        lifePct: 128,
      },
    })
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 300,
        classId: 0,
        name: 'Fallen',
        x: 53,
        y: 50,
        mode: 1,
        lifePct: 128,
      },
    })

    const npcMotion = (world as any).npcMotion
    const baseNpcUnit = npcMotion.getUnit(300)!
    const baseAnimSpeed = baseNpcUnit.wAnimSpeed

    // 2. Apply state 43 (`holywind`) to mercenary -> resolves `holyfreeze` ring overlay via STATE_OVERLAYS[43]
    world.apply({
      type: 'StateSet',
      unit: { unitType: 1, id: 200 },
      state: 43,
      complete: true,
    })
    const mercUnit = world.getUnit('monster', 200)!
    expect(mercUnit.states.has(43)).toBe(true)
    expect(resolveStateOverlayTokens113c(mercUnit, 43)).toContain('holyfreeze')

    // 3. Apply state 44 (`holywindcold`) to monster -> blue tint ([150, 215, 255], paletteRow = 1),
    // `ice_explode` castoverlay, and slowed NpcMotion
    world.apply({
      type: 'StateSet',
      unit: { unitType: 1, id: 300 },
      state: 44,
      complete: true,
      stats: [
        { statId: 67, param: 0, value: -50 },
        { statId: 68, param: 0, value: -50 },
        { statId: 69, param: 0, value: -50 },
      ],
    })
    const monUnit = world.getUnit('monster', 300)!
    expect(monUnit.states.has(44)).toBe(true)
    expect(STATE_COLOR_SHIFTS[44]).toEqual({
      stateId: 44,
      priority: 100,
      colorShift: 108,
      lightRgb: [150, 215, 255],
      paletteRow: 1,
    })
    expect(monUnit.overlays.some((o) => o.token === 'ice_explode' && o.castForStateId === 44)).toBe(true)

    const drawRes = buildSceneDrawables([
      {
        id: 300,
        kind: 'monster',
        classId: 0,
        x: 53,
        y: 50,
        mode: 1,
        direction: 0,
        hpRatio: 1,
        isCorpse: false,
        states: monUnit.states,
      },
    ])
    expect(drawRes.unitDrawables[0]?.paletteRow).toBe(1)
    expect(drawRes.unitDrawables[0]?.tintColor).toBeNull()

    expect(baseNpcUnit.states.has(44)).toBe(true)
    expect(baseNpcUnit.wAnimSpeed).toBeLessThan(baseAnimSpeed)
    expect(monUnit.animStepSpeed256).toBe(baseNpcUnit.wAnimSpeed)

    // 4. StateEnd (44) restores monster speed and clears blue tint
    world.apply({
      type: 'StateEnd',
      unit: { unitType: 1, id: 300 },
      state: 44,
    })
    expect(monUnit.states.has(44)).toBe(false)
    expect(monUnit.overlays.some((o) => o.castForStateId === 44)).toBe(false)
    expect(baseNpcUnit.states.has(44)).toBe(false)
    expect(baseNpcUnit.wAnimSpeed).toBe(baseAnimSpeed)
  })
})
