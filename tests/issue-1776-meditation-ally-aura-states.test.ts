/**
 * Issue #1776 — Mercenary Insight (`Meditation` #120) Ally Aura State (`48`), Mana Regen & Full 1.13c Aura Sweep.
 *
 * 1.13c Ground Truth (`Skills.txt`, `States.txt`, `D2Game.dll`):
 * - Every `aura = 1` skill in `Skills.txt` (`#98..#125`, `#296..#298`) classifies into:
 *   - Friendly `auratargetstate` (`aurafilter & 0x10000` != 0):
 *     Paladin (`3, 4, 5, 8, 33, 34, 36, 37, 40, 41, 42, 45, 48, 49`) + Druid Spirit Totems (`147, 148, 149`).
 *   - Caster-only `aurastate` (empty `auratargetstate`): `35` (`holyfire`), `46` (`holyshock`),
 *     `47` (`sanctuary`), `50` (`redemption`), plus caster-control states `43`, `161`, `162`, `163`.
 *   - Enemy-only `auratargetstate` (`aurafilter & 0x8000` != 0): `44` (`holywindcold`) and `28` (`conviction`).
 * - `#120` Meditation (`srvdofunc = 65` `SKILLS_SrvDo065` `0x6FCBA8D0`, `aurafilter = 73729` = `0x12001`):
 *   - `aurastate = meditation` (`48`), `auratargetstate = meditation` (`48`, `overlay1 = meditationfront`).
 *   - `aurastat1 = manarecoverybonus` (`statId = 27`), `aurastatcalc1 = ln34` (`300 + (slvl - 1) * 25`%).
 *   - `aurastat2 = hitpoints`, `aurastatcalc2 = stat('hitpoints'.accr) > 0 ? Skill('Prayer'.blvl) : 0` ("Double Prayer").
 *   - `aurafilter = 0x12001`: bit `0` (`0x1` players ONLY, bit `1` monsters = `0`), `0x2000` (skip in town),
 *     `0x10000` (allied units `0x6FD00570`).
 * - `SCMD_MercItem` (`0x61`, `D2Game.dll` `0x6FCF0BC0`): equips/unequips/swaps cursor item onto mercenary
 *   slots `1/3/4/5` and refreshes `STAT_ITEM_AURA` (`151`).
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import {
  ALL_CASTER_AURA_STATE_IDS_113C,
  CASTER_ONLY_AURA_STATE_IDS_113C,
  DRUID_SPIRIT_AURA_STATE_BY_SKILL_ID,
  DRUID_SPIRIT_AURA_TARGET_STATE_BY_SKILL_ID,
  ENEMY_AURA_TARGET_STATE_IDS_113C,
  FRIENDLY_AURA_TARGET_STATE_IDS_113C,
  PALADIN_AURA_SKILL_IDS,
  PALADIN_AURA_STATE_BY_SKILL_ID,
  PALADIN_AURA_TARGET_STATE_BY_SKILL_ID,
  PALADIN_FRIENDLY_AURA_TARGET_STATE_IDS_113C,
} from '../src/common/skills/paladin-auras.ts'
import { FIXED_ONE } from '../src/server/engine/stat-list.ts'
import { GameInstance } from '../src/server/engine/game-instance.ts'
import { LocalLoopbackAdapter } from '../src/server/loopback-adapter.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { STATE_OVERLAYS } from '../src/client/render/overlays-meta.ts'
import {
  buildSceneDrawables,
  resolveStateOverlayTokens113c,
} from '../src/client/view/unit-drawables.ts'
import type { ServerEvent } from '../src/netproto/index.ts'

function createAuraRunewordWeapon(opts: {
  unitId: number
  code?: string
  name?: string
  auraSkillId: number
  auraSlvl: number
  location?: 'cursor' | 'inventory' | 'equipped'
  bodyLoc?: number
  ownerId: number
  areaId: number
}) {
  const code = opts.code ?? 'vou'
  const loc = opts.location ?? 'cursor'
  const bodyLoc = opts.bodyLoc ?? (loc === 'equipped' ? 4 : 0)
  return {
    unitId: opts.unitId,
    code,
    name: opts.name ?? 'Insight',
    quality: 7,
    level: 85,
    location: loc,
    x: 0,
    y: 0,
    width: 2,
    height: 4,
    areaId: opts.areaId,
    ownerId: opts.ownerId,
    bodyLoc,
    storePage: loc === 'inventory' ? 1 : 0,
    cost: 1000,
    gamble: false,
    identified: true,
    ethereal: false,
    socketed: true,
    totalSockets: 4,
    durability: 50,
    maxDurability: 50,
    quantity: 1,
    stats: new Map<number, number>(),
    socketedItems: [],
    rawItemData: {
      id: opts.unitId,
      itemId: opts.unitId,
      code,
      name: opts.name ?? 'Insight',
      quality: 7,
      level: 85,
      identified: true,
      ethereal: false,
      socketed: true,
      sockets: 4,
      location: loc === 'cursor' ? 4 : loc === 'equipped' ? 1 : 0,
      bodyLoc,
      equippedSlot: bodyLoc,
      stats: [{ statId: 151, param: opts.auraSkillId, value: opts.auraSlvl }],
      runewordStats: [],
    } as any,
  }
}

describe('Issue #1776: 1.13c Friendly Aura Target State Table & Mercenary Insight Meditation', () => {
  it('exhaustively cross-checks all 23 aura=1 skills in 1.13c Skills.txt + States.txt against canonical aura state sets', async () => {
    const registry = await getSharedDataRegistry()
    const allAuraSkills = [
      ...PALADIN_AURA_SKILL_IDS,
      296,
      297,
      298,
    ]
    expect(allAuraSkills).toHaveLength(23)

    // Verify every real active aura skill in 1.13c Skills.txt (`aura = 1` with `srvDoFunc > 0` / non-empty `aurastate`;
    // rows 127..129 Sword/Axe/Mace Mastery are passive skills with `srvDoFunc = 0, aurastate = ''`) is covered.
    for (let id = 0; id < 400; id++) {
      const sk = registry.getSkillById(id)
      if (sk?.aura && sk.auraState !== '') {
        expect(allAuraSkills).toContain(id)
      } else if (sk?.aura) {
        expect([127, 128, 129]).toContain(id)
        expect(sk.passive).toBe(true)
        expect(sk.srvDoFunc).toBe(0)
      }
    }

    const expectedFriendlyTargetIds = new Set<number>()
    const expectedEnemyTargetIds = new Set<number>()
    const expectedCasterOnlyIds = new Set<number>()

    for (const skillId of allAuraSkills) {
      const skill = registry.getSkillById(skillId)!
      expect(skill).toBeDefined()
      expect(skill.aura).toBe(true)

      const casterState = registry.getStateByName(skill.auraState)!
      expect(casterState).toBeDefined()
      const mappedCasterId =
        PALADIN_AURA_STATE_BY_SKILL_ID[skillId] ?? DRUID_SPIRIT_AURA_STATE_BY_SKILL_ID[skillId]
      expect(mappedCasterId).toBe(casterState.id)
      expect(ALL_CASTER_AURA_STATE_IDS_113C.has(casterState.id)).toBe(true)

      if (!skill.auraTgtState) {
        // Caster-only radial/corpse aura: 102 Holy Fire (35), 118 Holy Shock (46), 119 Sanctuary (47), 124 Redemption (50)
        expect([102, 118, 119, 124]).toContain(skillId)
        expectedCasterOnlyIds.add(casterState.id)
        expect(PALADIN_AURA_TARGET_STATE_BY_SKILL_ID[skillId]).toBeUndefined()
        expect(FRIENDLY_AURA_TARGET_STATE_IDS_113C.has(casterState.id)).toBe(false)
      } else {
        const tgtState = registry.getStateByName(skill.auraTgtState)!
        expect(tgtState).toBeDefined()
        const mappedTgtId =
          PALADIN_AURA_TARGET_STATE_BY_SKILL_ID[skillId] ??
          DRUID_SPIRIT_AURA_TARGET_STATE_BY_SKILL_ID[skillId]
        expect(mappedTgtId).toBe(tgtState.id)

        if (casterState.id !== tgtState.id) {
          // Control state on caster differs from target state (114 Holy Freeze 43->44, Druid Spirits 161..163->149..147)
          expectedCasterOnlyIds.add(casterState.id)
        }

        const isEnemy = (skill.auraFilter & 0x8000) !== 0
        const isAlly = (skill.auraFilter & 0x10000) !== 0
        expect(isEnemy !== isAlly).toBe(true)
        if (isEnemy) {
          expectedEnemyTargetIds.add(tgtState.id)
          expect(ENEMY_AURA_TARGET_STATE_IDS_113C.has(tgtState.id)).toBe(true)
          expect(FRIENDLY_AURA_TARGET_STATE_IDS_113C.has(tgtState.id)).toBe(false)
        } else {
          expectedFriendlyTargetIds.add(tgtState.id)
          expect(FRIENDLY_AURA_TARGET_STATE_IDS_113C.has(tgtState.id)).toBe(true)
          expect(ENEMY_AURA_TARGET_STATE_IDS_113C.has(tgtState.id)).toBe(false)
        }
      }
    }

    expect([...FRIENDLY_AURA_TARGET_STATE_IDS_113C].sort((a, b) => a - b)).toEqual(
      [...expectedFriendlyTargetIds].sort((a, b) => a - b),
    )
    expect([...PALADIN_FRIENDLY_AURA_TARGET_STATE_IDS_113C].sort((a, b) => a - b)).toEqual([
      3, 4, 5, 8, 33, 34, 36, 37, 40, 41, 42, 45, 48, 49,
    ])
    expect([...ENEMY_AURA_TARGET_STATE_IDS_113C].sort((a, b) => a - b)).toEqual(
      [...expectedEnemyTargetIds].sort((a, b) => a - b),
    )
    expect([...CASTER_ONLY_AURA_STATE_IDS_113C].sort((a, b) => a - b)).toEqual(
      [...expectedCasterOnlyIds].sort((a, b) => a - b),
    )

    // Explicitly verify the old corrupt hardcoded whitelist bugs are eliminated:
    // - 38 (`thunderstorm`) and 39 (`lightningbolt`) are non-aura states (`aura=false` in States.txt), NOT Paladin resist auras!
    expect(registry.getStateById(38)?.state).toBe('thunderstorm')
    expect(registry.getStateById(38)?.aura).toBe(false)
    expect(registry.getStateById(39)?.state).toBe('lightningbolt')
    expect(registry.getStateById(39)?.aura).toBe(false)
    expect(FRIENDLY_AURA_TARGET_STATE_IDS_113C.has(38)).toBe(false)
    expect(FRIENDLY_AURA_TARGET_STATE_IDS_113C.has(39)).toBe(false)
    // - 35 (`holyfire`), 46 (`holyshock`), 47 (`sanctuary`), 50 (`redemption`) are caster-only
    for (const casterOnly of [35, 46, 47, 50]) {
      expect(FRIENDLY_AURA_TARGET_STATE_IDS_113C.has(casterOnly)).toBe(false)
      expect(CASTER_ONLY_AURA_STATE_IDS_113C.has(casterOnly)).toBe(true)
    }
    // - 3 (`resistfire`), 4 (`resistcold`), 5 (`resistlight`), 8 (`resistall` Salvation), and 48 (`meditation`) ARE friendly target states
    for (const friendly of [3, 4, 5, 8, 48]) {
      expect(FRIENDLY_AURA_TARGET_STATE_IDS_113C.has(friendly)).toBe(true)
    }
    // - States.txt overlay1..2 for Meditation (#48) and Salvation (#8)
    expect(STATE_OVERLAYS[48]).toEqual(['meditationfront', 'meditationback'])
    expect(STATE_OVERLAYS[8]).toEqual(['aura_resistall_front', 'aura_resistall_back'])
  })

  it('equips Insight via MercItem (0x61), syncs state 48 + meditationfront ring + +700% mana regen to player, and triggers Double Prayer', () => {
    // Baseline game without Insight to measure exact base 1.13c mana regen over 50 ticks
    const baseGame = new GameInstance({ seed: 1776, difficulty: 1, act: 1, areaId: 2 })
    const basePid = baseGame.connectPlayer({ name: 'BaseSorc', charClass: 'sor', level: 60, areaId: 2 })
    const basePlayers = (baseGame as unknown as {
      players: Map<number, { mana: number; manaFixed: number; maxManaFixed: number; hp: number; hpFixed: number }>
    }).players
    const baseRec = basePlayers.get(basePid)!
    baseRec.manaFixed = 10 * FIXED_ONE
    baseRec.mana = 10
    baseGame.stepFrames(50)
    const baseManaGainFixed = baseRec.manaFixed - 10 * FIXED_ONE
    expect(baseManaGainFixed).toBeGreaterThan(0)

    // Live Loopback + ClientWorld session in Blood Moor (areaId = 2)
    const game = new GameInstance({ seed: 1776, difficulty: 1, act: 1, areaId: 2 })
    const world = new ClientWorld()
    const receivedEvents: ServerEvent[] = []
    const adapter = new LocalLoopbackAdapter({
      game,
      charName: 'InsightSorc',
      charClass: 'sor',
      level: 60,
      difficulty: 1,
      areaId: 2,
    })
    adapter.onEvent((ev) => {
      receivedEvents.push(ev)
      world.apply(ev)
    })
    adapter.connect()

    const playerId = adapter.playerUnitId
    const pState0 = game.getPlayerState(playerId)!

    // Hire Act 2 Normal Combat mercenary (`subType = 6`, innate `Prayer` #99) right next to player
    const mercId = game.hireMercenary(playerId, {
      act: 2,
      difficulty: 1,
      subType: 6,
      level: 60,
      x: pState0.x + 1,
      y: pState0.y + 1,
    })
    // Summon an allied pet (Clay Golem #75) to verify Meditation aurafilter=73729 (0x12001) targets players ONLY
    const golemOut = game.summonPet(playerId, { skillId: 75, slvl: 10, x: pState0.x + 2, y: pState0.y })
    expect(golemOut.created).toBe(true)

    // Place lv17 Meditation `Insight` polearm (`ln34` = 300 + 16*25 = 700%) on player's cursor
    const playersMap = (game as unknown as {
      players: Map<
        number,
        {
          items: unknown[]
          mana: number
          manaFixed: number
          maxManaFixed: number
          hp: number
          hpFixed: number
          maxHpFixed: number
        }
      >
    }).players
    const pRec = playersMap.get(playerId)!
    pRec.manaFixed = 10 * FIXED_ONE
    pRec.mana = 10
    pRec.hpFixed = 20 * FIXED_ONE
    pRec.hp = 20
    pRec.items.push(
      createAuraRunewordWeapon({
        unitId: 7701,
        code: 'vou',
        name: 'Insight',
        auraSkillId: 120,
        auraSlvl: 17,
        location: 'cursor',
        ownerId: playerId,
        areaId: 2,
      }),
    )

    // Dispatch SCMD_MercItem (0x61, slot = 4) through the loopback adapter
    adapter.send({ type: 'MercItem', slot: 4 })
    adapter.stepFrames(1)

    // 1. ClientWorld merc equipment container holds Insight in slot 4; cursor is empty
    expect(world.containers.cursor).toBeNull()
    expect(world.containers.mercBySlot.get(4)?.id).toBe(7701)

    // 2. BOTH mercenary AND player carry state 48 (`meditation`) on server AND ClientWorld
    const mercAfterEquip = game.getMercenaryState(mercId)!
    const playerAfterEquip = game.getPlayerState(playerId)!
    expect(mercAfterEquip.states?.has(48)).toBe(true)
    expect(mercAfterEquip.states?.has(34)).toBe(true) // innate Prayer caster state
    expect(playerAfterEquip.states.has(48)).toBe(true)
    expect(playerAfterEquip.states.has(34)).toBe(true) // friendly Prayer target state

    // S2C StateSet for player state 48 includes statId 27 (`manarecoverybonus` = 700)
    const playerMeditationStateSet = receivedEvents.find(
      (ev): ev is Extract<ServerEvent, { type: 'StateSet' }> =>
        ev.type === 'StateSet' && ev.unit.unitType === 0 && ev.unit.id === playerId && ev.state === 48,
    )
    expect(playerMeditationStateSet).toBeDefined()
    expect(playerMeditationStateSet!.stats?.find((s) => s.statId === 27)?.value).toBe(700)

    const clientPlayer = world.getUnit('player', playerId)!
    const clientMerc = world.getUnit('monster', mercId)!
    expect(clientPlayer.states.has(48)).toBe(true)
    expect(clientMerc.states.has(48)).toBe(true)
    expect(resolveStateOverlayTokens113c(clientPlayer, 48)).toContain('meditationfront')
    expect(resolveStateOverlayTokens113c(clientMerc, 48)).toContain('meditationfront')

    // 3. Scene drawables emit `meditationfront` ring under BOTH player AND mercenary
    const scene = buildSceneDrawables([
      {
        id: playerId,
        kind: 'player',
        classId: 1,
        x: playerAfterEquip.x,
        y: playerAfterEquip.y,
        mode: 1,
        direction: 0,
        hpRatio: 1,
        isCorpse: false,
        states: clientPlayer.states,
      },
      {
        id: mercId,
        kind: 'monster',
        classId: mercAfterEquip.classId,
        x: mercAfterEquip.x,
        y: mercAfterEquip.y,
        mode: 1,
        direction: 0,
        hpRatio: 1,
        isCorpse: false,
        states: clientMerc.states,
      },
    ])
    const playerDraw = scene.unitDrawables.find((d) => d.id === playerId && d.unitKind === 'player')!
    const mercDraw = scene.unitDrawables.find((d) => d.id === mercId && d.unitKind === 'monster')!
    expect(playerDraw.overlays.some((o) => o.token === 'meditationfront')).toBe(true)
    expect(mercDraw.overlays.some((o) => o.token === 'meditationfront')).toBe(true)

    // 4. Allied summon pet receives Prayer (state 34) but NOT Meditation (state 48, aurafilter bit 1 = 0)
    const petVis = (game as unknown as {
      petVisualStates: Map<number, { states: Set<number> }>
    }).petVisualStates
    const golemUnitId = (golemOut.pet as unknown as { unitId: number }).unitId
    expect(petVis.get(golemUnitId)?.states.has(34)).toBe(true)
    expect(petVis.get(golemUnitId)?.states.has(48)).toBe(false)

    // 5. Measure actual 50-frame mana regeneration with lv17 Meditation (+700% -> 8x base mana regen)
    pRec.manaFixed = 10 * FIXED_ONE
    pRec.mana = 10
    const hpBeforeDoublePrayer = pRec.hpFixed
    adapter.stepFrames(50)
    const medManaGainFixed = pRec.manaFixed - 10 * FIXED_ONE
    // 100% + 700% = 800% (8x) within rounding of 50 integer division ticks
    expect(medManaGainFixed).toBeGreaterThanOrEqual(baseManaGainFixed * 7)
    expect(medManaGainFixed).toBeLessThanOrEqual(baseManaGainFixed * 9)

    // 6. Verify "Double Prayer": Prayer (#99) + Insight Meditation (#120) heals ~2x a standalone Prayer merc!
    const singlePrayerGame = new GameInstance({ seed: 1776, difficulty: 1, act: 1, areaId: 2 })
    const spPid = singlePrayerGame.connectPlayer({ name: 'PrayerOnly', charClass: 'sor', level: 60, areaId: 2 })
    const spPos = singlePrayerGame.getPlayerState(spPid)!
    const spRec = (singlePrayerGame as unknown as typeof game)['players' as never] as Map<
      number,
      { hp: number; hpFixed: number }
    >
    spRec.get(spPid)!.hpFixed = 20 * FIXED_ONE
    spRec.get(spPid)!.hp = 20
    singlePrayerGame.hireMercenary(spPid, {
      act: 2,
      difficulty: 1,
      subType: 6,
      level: 60,
      x: spPos.x + 1,
      y: spPos.y + 1,
    })
    const spHpAfterHire = spRec.get(spPid)!.hpFixed
    singlePrayerGame.stepFrames(50)
    const singlePrayerPulseHeal = spRec.get(spPid)!.hpFixed - spHpAfterHire
    const doublePrayerPulseHeal = pRec.hpFixed - hpBeforeDoublePrayer
    expect(singlePrayerPulseHeal).toBeGreaterThan(0)
    expect(doublePrayerPulseHeal).toBe(singlePrayerPulseHeal * 2)
  })

  it('cleans up state 48 and manarecoverybonus on unequip, walking out of range, merc death, and entering town (0x2000)', () => {
    const game = new GameInstance({ seed: 2776, difficulty: 1, act: 1, areaId: 2 })
    const world = new ClientWorld()
    const adapter = new LocalLoopbackAdapter({
      game,
      charName: 'CleanupPal',
      charClass: 'sor',
      level: 60,
      difficulty: 1,
      areaId: 2,
    })
    adapter.onEvent((ev) => world.apply(ev))
    adapter.connect()
    const playerId = adapter.playerUnitId
    const p0 = game.getPlayerState(playerId)!

    const mercId = game.hireMercenary(playerId, {
      act: 2,
      difficulty: 1,
      subType: 7, // Defiance
      level: 60,
      x: p0.x + 1,
      y: p0.y + 1,
    })

    const internalPlayers = (game as unknown as {
      players: Map<
        number,
        {
          items: unknown[]
          x: number
          y: number
          targetX: number
          targetY: number
          areaId: number
          mana: number
          manaFixed: number
        }
      >
      mercenaries: Map<number, { x: number; y: number; areaId: number; hp: number; alive: boolean }>
      playerCombatContext: (p: unknown) => { statList: { getAccruedStat: (s: string) => number } }
    })
    const pRec = internalPlayers.players.get(playerId)!
    const mRec = internalPlayers.mercenaries.get(mercId)!

    pRec.items.push(
      createAuraRunewordWeapon({
        unitId: 8801,
        code: 'vou',
        name: 'Insight',
        auraSkillId: 120,
        auraSlvl: 15,
        location: 'cursor',
        ownerId: playerId,
        areaId: 2,
      }),
    )
    adapter.send({ type: 'MercItem', slot: 4 })
    adapter.stepFrames(1)
    expect(game.getPlayerState(playerId)!.states.has(48)).toBe(true)
    expect(world.getUnit('player', playerId)!.states.has(48)).toBe(true)
    expect(internalPlayers.playerCombatContext(pRec).statList.getAccruedStat('manarecoverybonus')).toBe(
      300 + (15 - 1) * 25,
    )

    // Case A: Unequip Insight via MercItem (slot = 4, empty cursor) -> merc loses caster state 48 immediately;
    // player state 48 + manarecoverybonus expire within 1.13c perdelay=50 window (<= 55 frames)
    adapter.send({ type: 'MercItem', slot: 4 })
    adapter.stepFrames(1)
    expect(world.containers.cursor?.id).toBe(8801)
    expect(world.containers.mercBySlot.get(4)).toBeUndefined()
    expect(game.getMercenaryState(mercId)!.states?.has(48)).toBe(false)

    adapter.stepFrames(55)
    expect(game.getPlayerState(playerId)!.states.has(48)).toBe(false)
    expect(world.getUnit('player', playerId)!.states.has(48)).toBe(false)
    expect(internalPlayers.playerCombatContext(pRec).statList.getAccruedStat('manarecoverybonus')).toBe(0)

    // Re-equip Insight from cursor
    adapter.send({ type: 'MercItem', slot: 4 })
    adapter.stepFrames(1)
    expect(game.getPlayerState(playerId)!.states.has(48)).toBe(true)

    // Case B: Player separates beyond aura radius (at slvl=15, Meditation radius = 16 + 14*3 = 58 subtiles).
    // Move player 75 subtiles away (stationary targetX/targetY) while keeping merc pinned at savedMercX/Y.
    const savedMercX = mRec.x
    const savedMercY = mRec.y
    pRec.x = savedMercX + 75
    pRec.y = savedMercY + 75
    pRec.targetX = pRec.x
    pRec.targetY = pRec.y
    for (let i = 0; i < 60; i++) {
      mRec.x = savedMercX
      mRec.y = savedMercY
      adapter.stepFrames(1)
    }
    expect(game.getMercenaryState(mercId)!.states?.has(48)).toBe(true)
    expect(game.getPlayerState(playerId)!.states.has(48)).toBe(false)
    expect(internalPlayers.playerCombatContext(pRec).statList.getAccruedStat('manarecoverybonus')).toBe(0)

    // Walk BOTH player and merc 120 subtiles away from initial spawn -> AuraScanner.syncCasterPosition
    // tracks merc's new coordinates and re-pulses Meditation continuously across >60 frames!
    mRec.x = savedMercX + 120
    mRec.y = savedMercY + 120
    pRec.x = mRec.x + 1
    pRec.y = mRec.y + 1
    pRec.targetX = pRec.x
    pRec.targetY = pRec.y
    adapter.stepFrames(60)
    expect(game.getPlayerState(playerId)!.states.has(48)).toBe(true)
    expect(internalPlayers.playerCombatContext(pRec).statList.getAccruedStat('manarecoverybonus')).toBe(650)

    // Case C: Enter Town (areaId = 1, Rogue Encampment — aurafilter 0x2000 room skip!)
    // Verify AuraScanner k*d+1 does NOT extend expireFrame in town; state 48 expires cleanly within 55 frames!
    pRec.areaId = 1
    mRec.areaId = 1
    adapter.stepFrames(60)
    expect(game.getPlayerState(playerId)!.states.has(48)).toBe(false)
    expect(world.getUnit('player', playerId)!.states.has(48)).toBe(false)
    expect(internalPlayers.playerCombatContext(pRec).statList.getAccruedStat('manarecoverybonus')).toBe(0)

    // Step back into Blood Moor (areaId = 2) -> Meditation resumes automatically!
    pRec.areaId = 2
    mRec.areaId = 2
    adapter.stepFrames(2)
    expect(game.getPlayerState(playerId)!.states.has(48)).toBe(true)

    // Case D: Mercenary dies -> stopMercenaryAura clears merc states; player state 48 expires cleanly
    const killerMonId = game.spawnMonster({
      defId: 'fallen1',
      x: mRec.x + 1,
      y: mRec.y,
      areaId: 2,
      hp: 500,
      maxHp: 500,
    })
    ;(game as unknown as {
      applyDamageToMerc: (merc: unknown, dmg: number, areaId: number, mon?: unknown) => void
    }).applyDamageToMerc(mRec, 999999, 2, game.getMonster(killerMonId))
    expect(mRec.alive).toBe(false)
    adapter.stepFrames(60)
    expect(game.getPlayerState(playerId)!.states.has(48)).toBe(false)
    expect(internalPlayers.playerCombatContext(pRec).statList.getAccruedStat('manarecoverybonus')).toBe(0)
  })

  it('regression sweep: all 14 Paladin friendly auras, caster-only exclusions, party gating, player item_aura, Druid spirits, and monster Aura Enchanted', () => {
    const game = new GameInstance({ seed: 3776, difficulty: 1, act: 1, areaId: 2, maxPlayers: 4 })
    const palId = game.connectPlayer({
      name: 'AuraPaladin',
      charClass: 'pal',
      level: 70,
      areaId: 2,
      skills: Object.fromEntries(PALADIN_AURA_SKILL_IDS.map((id) => [id, 10])),
    })
    const allyId = game.connectPlayer({ name: 'PartiedDruid', charClass: 'dru', level: 70, areaId: 2 })
    const strangerId = game.connectPlayer({ name: 'UnpartiedBar', charClass: 'bar', level: 70, areaId: 2 })

    // Co-locate all 3 players in Blood Moor
    const internals = game as unknown as {
      players: Map<number, { x: number; y: number; items: unknown[] }>
      partyManager: { invite: (a: number, b: number) => void; accept: (b: number, a: number) => void }
    }
    const palPos = game.getPlayerState(palId)!
    internals.players.get(allyId)!.x = palPos.x + 2
    internals.players.get(allyId)!.y = palPos.y + 1
    internals.players.get(strangerId)!.x = palPos.x + 2
    internals.players.get(strangerId)!.y = palPos.y + 2

    // Party palId + allyId; leave strangerId unpartied
    internals.partyManager.invite(palId, allyId)
    internals.partyManager.accept(allyId, palId)

    // Hire mercenary for palId and summon a wolf for allyId
    const mercId = game.hireMercenary(palId, {
      act: 1,
      difficulty: 1,
      level: 60,
      x: palPos.x + 1,
      y: palPos.y + 1,
    })
    internals.players.get(allyId)
    const wolfOut = game.summonPet(allyId, { skillId: 227, slvl: 10, x: palPos.x + 1, y: palPos.y + 2 })
    const wolfUnitId = (wolfOut.pet as unknown as { unitId: number }).unitId
    const petVis = (game as unknown as {
      petVisualStates: Map<number, { states: Set<number> }>
    }).petVisualStates

    // 1. Sweep all 14 friendly Paladin aura skills: verify partied ally receives exact auratargetstate,
    // unpartied stranger NEVER receives it, and merc/pet receive all except player-only Meditation (#120 -> 48)
    const friendlySkillToTarget: ReadonlyArray<readonly [number, number]> = [
      [98, 33],   // Might
      [99, 34],   // Prayer
      [100, 3],   // Resist Fire
      [103, 36],  // Thorns
      [104, 37],  // Defiance
      [105, 4],   // Resist Cold
      [108, 40],  // Blessed Aim
      [109, 45],  // Cleansing
      [110, 5],   // Resist Lightning
      [113, 42],  // Concentration
      [115, 41],  // Vigor
      [120, 48],  // Meditation (players only!)
      [122, 49],  // Fanaticism
      [125, 8],   // Salvation
    ]
    for (const [skillId, expectedStateId] of friendlySkillToTarget) {
      game.enqueueCommand(palId, { type: 'SelectSkill', skillId, hand: 'right' })
      game.stepFrames(2)
      expect(game.getPlayerState(palId)!.states.has(expectedStateId)).toBe(true)
      expect(game.getPlayerState(allyId)!.states.has(expectedStateId)).toBe(true)
      expect(game.getPlayerState(strangerId)!.states.has(expectedStateId)).toBe(false)
      if (skillId === 120) {
        expect(game.getMercenaryState(mercId)!.states?.has(48)).toBe(false)
        expect(petVis.get(wolfUnitId)?.states.has(48)).toBe(false)
      } else {
        expect(game.getMercenaryState(mercId)!.states?.has(expectedStateId)).toBe(true)
        expect(petVis.get(wolfUnitId)?.states.has(expectedStateId)).toBe(true)
      }
      // Never falsely sets 38 (`playerbody`) or 39 (`ironmaiden`)
      expect(game.getPlayerState(allyId)!.states.has(38)).toBe(false)
      expect(game.getPlayerState(allyId)!.states.has(39)).toBe(false)
    }

    // 2. Sweep caster-only Paladin auras (102 Holy Fire->35, 118 Holy Shock->46, 119 Sanctuary->47, 124 Redemption->50):
    // caster gets aurastate, partied ally / merc / pet NEVER get caster-only state
    for (const [skillId, casterStateId] of [
      [102, 35],
      [118, 46],
      [119, 47],
      [124, 50],
    ] as const) {
      game.enqueueCommand(palId, { type: 'SelectSkill', skillId, hand: 'right' })
      game.stepFrames(2)
      expect(game.getPlayerState(palId)!.states.has(casterStateId)).toBe(true)
      expect(game.getPlayerState(allyId)!.states.has(casterStateId)).toBe(false)
      expect(game.getMercenaryState(mercId)!.states?.has(casterStateId)).toBe(false)
    }
    // Deselect Paladin right-hand aura
    game.enqueueCommand(palId, { type: 'SelectSkill', skillId: 0, hand: 'right' })
    game.stepFrames(60)

    // 3. Player-equipped STAT_ITEM_AURA (151): equip `Faith` (`Fanaticism` #122 -> state 49) on allyId,
    // verify weapon-swap (`SwapWeapons`) toggles it off/on, and `ItemUnequip` cleans it up!
    internals.players.get(allyId)!.items.push(
      createAuraRunewordWeapon({
        unitId: 9901,
        code: 'sbw',
        name: 'Faith',
        auraSkillId: 122,
        auraSlvl: 15,
        location: 'inventory',
        ownerId: allyId,
        areaId: 2,
      }),
    )
    game.enqueueCommand(allyId, { type: 'ItemEquip', itemId: 9901, slot: 4 })
    game.stepFrames(2)
    expect(game.getPlayerState(allyId)!.states.has(49)).toBe(true)
    expect(game.getPlayerState(palId)!.states.has(49)).toBe(true)
    expect(game.getMercenaryState(mercId)!.states?.has(49)).toBe(true)

    // SwapWeapons moves slot 4 -> 11 (inactive weapon set): caster state 49 clears immediately, ally expires
    game.enqueueCommand(allyId, { type: 'SwapWeapons' })
    game.stepFrames(60)
    expect(game.getPlayerState(allyId)!.states.has(49)).toBe(false)
    expect(game.getPlayerState(palId)!.states.has(49)).toBe(false)

    // SwapWeapons back -> slot 11 -> 4 re-activates Fanaticism!
    game.enqueueCommand(allyId, { type: 'SwapWeapons' })
    game.stepFrames(2)
    expect(game.getPlayerState(allyId)!.states.has(49)).toBe(true)
    expect(game.getPlayerState(palId)!.states.has(49)).toBe(true)

    game.enqueueCommand(allyId, { type: 'ItemUnequip', slot: 4 })
    game.stepFrames(60)
    expect(game.getPlayerState(allyId)!.states.has(49)).toBe(false)
    expect(game.getPlayerState(palId)!.states.has(49)).toBe(false)

    // 4. Druid Spirit Totem (#226 Oak Sage -> #298 aura: caster 161, ally target 149 + maxHp boost!)
    const baseMaxHp = game.getPlayerState(allyId)!.maxHp
    const oakOut = game.summonPet(allyId, { skillId: 226, slvl: 10, x: palPos.x + 2, y: palPos.y + 1 })
    const oakUnitId = (oakOut.pet as unknown as { unitId: number }).unitId
    game.stepFrames(2)
    expect(petVis.get(oakUnitId)?.states.has(161)).toBe(true)
    expect(game.getPlayerState(allyId)!.states.has(149)).toBe(true)
    expect(game.getPlayerState(palId)!.states.has(149)).toBe(true)
    expect(game.getPlayerState(strangerId)!.states.has(149)).toBe(false)
    expect(game.getPlayerState(allyId)!.maxHp).toBeGreaterThan(baseMaxHp)

    game.unsummonPetAt(allyId, oakOut.pet!.x, oakOut.pet!.y, 10)
    game.stepFrames(15)
    expect(game.getPlayerState(allyId)!.states.has(149)).toBe(false)
    expect(game.getPlayerState(allyId)!.maxHp).toBe(baseMaxHp)

    // 5. Monster `Aura Enchanted` (`MonUMod 30`): Might (#98 -> 33) buffs fellow monster (NOT players),
    // and Conviction (#123 -> 28) debuffs both players AND mercenaries!
    const leaderMonId = game.spawnMonster({
      defId: 'fallen1',
      x: palPos.x + 4,
      y: palPos.y,
      areaId: 2,
      level: 60,
      hp: 5000,
      maxHp: 5000,
    })
    const fellowMonId = game.spawnMonster({
      defId: 'fallen1',
      x: palPos.x + 5,
      y: palPos.y,
      areaId: 2,
      level: 60,
      hp: 5000,
      maxHp: 5000,
    })
    const monMap = (game as unknown as {
      monsters: Map<number, { auraSkillId?: number }>
    }).monsters
    monMap.get(leaderMonId)!.auraSkillId = 98 // Might
    game.stepFrames(26)
    expect(game.getMonster(leaderMonId)!.states.has(33)).toBe(true)
    expect(game.getMonster(fellowMonId)!.states.has(33)).toBe(true)
    expect(game.getPlayerState(palId)!.states.has(33)).toBe(false)

    monMap.get(leaderMonId)!.auraSkillId = 123 // Conviction
    game.stepFrames(26)
    expect(game.getPlayerState(palId)!.states.has(28)).toBe(true)
    expect(game.getMercenaryState(mercId)!.states?.has(28)).toBe(true)
  })
})
