/**
 * `[K5]` Single-Player `LocalKernelD2gsAdapter113c` & `D2gsKernelBridge113c`
 * `.d2s` Skills, Hotkeys, `playersX`, and Items Round-Trip Parity Suite.
 */

import { describe, expect, it } from 'vitest'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import {
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillLevel113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { GAME_GetEffectivePlayerCount113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  encodeC2sAddSkillPoint,
  encodeC2sAssignSkillHotkey,
  encodeC2sChat,
  encodeC2sSelectSkill,
  type CharClassId,
} from '../../../src/netproto/index.ts'
import {
  CLASS_SKILL_BASE_113C,
  LocalKernelD2gsAdapter113c,
  LocalLobbyProvider,
  getServerItemDataTables,
  readD2sSave113c,
  writeD2sSave113c,
  type D2sItemInput,
} from '../../../src/server/index.ts'

describe('[K5] Single-Player .d2s Skills, Hotkeys, playersX & Items Round-Trip Parity', () => {
  it('hydrates all 7 character classes .d2s 30-byte skill sections into SparseMemory113c, streams S2C 0x94 BaseSkillLevels, and exports losslessly', () => {
    const classCases: ReadonlyArray<{
      readonly classId: CharClassId
      readonly name: string
      readonly expectedBase: number
      readonly rightIdx: number
    }> = [
      { classId: 0, name: 'AmaRound', expectedBase: 6, rightIdx: 29 }, // 35 Lightning Fury
      { classId: 1, name: 'SorRound', expectedBase: 36, rightIdx: 28 }, // 64 Frozen Orb (65 Cold Mastery is passive)
      { classId: 2, name: 'NecRound', expectedBase: 66, rightIdx: 29 }, // 95 Revive
      { classId: 3, name: 'PalRound', expectedBase: 96, rightIdx: 29 }, // 125 Salvation
      { classId: 4, name: 'BarRound', expectedBase: 126, rightIdx: 28 }, // 154 War Cry (155 Natural Resistance is passive)
      { classId: 5, name: 'DruRound', expectedBase: 221, rightIdx: 29 }, // 250 Hurricane
      { classId: 6, name: 'AssRound', expectedBase: 251, rightIdx: 29 }, // 280 Phoenix Strike
    ]

    for (const tc of classCases) {
      expect(CLASS_SKILL_BASE_113C[tc.classId]).toBe(tc.expectedBase)

      const skillBytes = new Uint8Array(30)
      skillBytes[0] = 3
      skillBytes[5] = 7
      skillBytes[14] = 12
      skillBytes[tc.rightIdx] = 18
      skillBytes[29] = 20
      const nonZeroCount = tc.rightIdx === 29 ? 4 : 5

      const hotkeys = new Array<number>(16).fill(0xffff)
      hotkeys[0] = (tc.expectedBase + 0) | 0x8000 // F1 left hand
      hotkeys[3] = tc.expectedBase + tc.rightIdx // F4 right hand

      const rawD2s = writeD2sSave113c(
        {
          name: tc.name,
          classId: tc.classId,
          level: 45,
          statusFlags: 0x20,
          progression: 5,
          activeDifficulty: 0,
          activeAct: 0,
          mapSeed: 0x13572468 + tc.classId,
          hotkeys,
          leftSkill: tc.expectedBase + 0,
          rightSkill: tc.expectedBase + tc.rightIdx,
          attributes: {
            strength: 60,
            energy: 50,
            dexterity: 55,
            vitality: 70,
            statPts: 10,
            newSkills: 4,
            hitpointsFixed: 220 * 256,
            maxHpFixed: 220 * 256,
            manaFixed: 150 * 256,
            maxManaFixed: 150 * 256,
            staminaFixed: 160 * 256,
            maxStaminaFixed: 160 * 256,
            level: 45,
            experience: 1234567,
            gold: 5000,
            goldBank: 25000,
          },
          skills: skillBytes,
          items: [],
        },
        getServerItemDataTables(),
      )

      const adapter = new LocalKernelD2gsAdapter113c({ d2s: rawD2s })
      const session = new OnlineSession()
      session.attachGameServer(adapter)
      session.tick(40, 1000)

      expect(adapter.stats.protocolErrors).toBe(0)
      expect(session.phase).toBe('ingame')

      // Verify S2C 0x94 BaseSkillLevels was emitted during handshake
      const s2c94 = adapter.bridge
        .drainUncompressedS2CPackets(adapter.handle.clientId)
        .filter((p) => p.opcode === 0x94)
      expect(s2c94.length).toBe(1)
      expect(s2c94[0]!.bytes.byteLength).toBe(6 + nonZeroCount * 3)

      // Verify SparseMemory113c pPlayer->pSkills matches exact hard points
      const pPlayer = adapter.handle.getPlayerPtr()
      for (const [idx, expectedLvl] of [
        [0, 3],
        [5, 7],
        [14, 12],
        [29, 20],
      ] as const) {
        const skId = tc.expectedBase + idx
        const pSk = SKILLS_GetSkillById113c(adapter.bridge.m, pPlayer, skId, -1)
        expect(pSk).not.toBe(0)
        expect(SKILLS_GetSkillLevel113c(adapter.bridge.m, pPlayer, pSk, 0)).toBe(expectedLvl)
        expect(session.world.self.skills.get(skId)).toBe(expectedLvl)
      }

      // Verify active left/right skills & hotkeys hydrated into OnlineSession
      expect(session.world.self.leftSkill).toBe(tc.expectedBase + 0)
      expect(session.world.self.rightSkill).toBe(tc.expectedBase + tc.rightIdx)
      expect(session.world.skillHotkeys.get(0)).toMatchObject({
        hand: 'left',
        skill: tc.expectedBase + 0,
      })
      expect(session.world.skillHotkeys.get(3)).toMatchObject({
        hand: 'right',
        skill: tc.expectedBase + tc.rightIdx,
      })

      const exported = readD2sSave113c(adapter.exportD2s())
      expect(Array.from(exported.skillLevels)).toEqual(Array.from(skillBytes))
      expect(exported.leftSkill).toBe(tc.expectedBase + 0)
      expect(exported.rightSkill).toBe(tc.expectedBase + tc.rightIdx)
      expect(exported.hotkeys[0]).toBe(((tc.expectedBase + 0) | 0x8000) >>> 0)
      expect(exported.hotkeys[3]).toBe((tc.expectedBase + tc.rightIdx) >>> 0)

      session.leaveGame()
    }
  })

  it('preserves baseLevel=0 on starter +1 Fire Bolt staff, validates 0x3B prereqs/reqlevel, and persists spent skills, 0x3C active skills & 0x51 hotkeys across leave/re-enter', async () => {
    const lobby = new LocalLobbyProvider({
      defaultMapSeed: 0x33445566,
      backend: 'd2kern-113c',
    })
    await lobby.createCharacter({
      name: 'SkillPersistSor',
      classId: 1, // Sorceress (base skill ID = 36)
      expansion: true,
      hardcore: false,
      ladder: false,
    })

    // Game 1: verify starter Short Staff (+1 Fire Bolt, skill 36) gives effective level 1 but hard baseLevel = 0
    const adapter1 = await lobby.enterKernelGame({ charName: 'SkillPersistSor' })
    const pPlayer1 = adapter1.handle.getPlayerPtr()
    const pFireBolt1 = SKILLS_GetSkillById113c(adapter1.bridge.m, pPlayer1, 36, -1)
    expect(pFireBolt1).not.toBe(0)
    expect(SKILLS_GetSkillLevel113c(adapter1.bridge.m, pPlayer1, pFireBolt1, 0)).toBe(0)
    expect(SKILLS_GetSkillLevel113c(adapter1.bridge.m, pPlayer1, pFireBolt1, 1)).toBe(1)

    // Leave Game 1 without spending points -> skillLevels must remain all 0s!
    adapter1.leave()
    const afterGame1 = readD2sSave113c(lobby.getCharacterD2s('SkillPersistSor')!)
    expect(Array.from(afterGame1.skillLevels)).toEqual(new Array(30).fill(0))
    expect(afterGame1.rightSkill).toBe(36)

    // Game 2: grant level 6 & 4 skill points, spend points via 0x3B, select left/right skills via 0x3C, bind hotkeys via 0x51
    const adapter2 = await lobby.enterKernelGame({ charName: 'SkillPersistSor' })
    const session2 = new OnlineSession()
    session2.attachGameServer(adapter2)
    let nowMs = 2000
    const step40 = (s: OnlineSession): void => {
      nowMs += 40
      s.tick(40, nowMs)
    }
    step40(session2)

    const pPlayer2 = adapter2.handle.getPlayerPtr()
    STATLIST_SetUnitStat113c(adapter2.bridge.m, pPlayer2, 12, 6, 0) // STAT_LEVEL = 6
    adapter2.bridge.setPlayerStatAndSync(adapter2.handle.clientId, 5, 4) // STAT_NEWSKILLS = 4
    step40(session2)
    expect(session2.world.self.stats.get(5)).toBe(4)

    // Attempt invalid allocations:
    // - Fire Ball (47) requires level 12 & Fire Bolt (36) hard point -> must be rejected
    // - Ice Blast (45) requires prereq Ice Bolt (39) hard point -> must be rejected
    adapter2.clientStream.write(encodeC2sAddSkillPoint(47))
    adapter2.clientStream.write(encodeC2sAddSkillPoint(45))
    step40(session2)
    expect(STATLIST_GetUnitStat113c(adapter2.bridge.m, pPlayer2, 5, 0)).toBe(4)

    // Spend 4 valid skill points:
    // 1. Ice Bolt (39, reqlevel 1) -> base 1
    // 2. Ice Blast (45, reqlevel 6, prereq 39) -> base 1
    // 3. Static Field (42, reqlevel 6) -> base 1
    // 4. Warmth (37, reqlevel 1) -> base 1
    adapter2.clientStream.write(encodeC2sAddSkillPoint(39))
    adapter2.clientStream.write(encodeC2sAddSkillPoint(45))
    adapter2.clientStream.write(encodeC2sAddSkillPoint(42))
    adapter2.clientStream.write(encodeC2sAddSkillPoint(37))
    step40(session2)

    expect(STATLIST_GetUnitStat113c(adapter2.bridge.m, pPlayer2, 5, 0)).toBe(0)
    expect(session2.world.self.stats.get(5)).toBe(0)
    expect(session2.world.self.skills.get(39)).toBe(1)
    expect(session2.world.self.skills.get(45)).toBe(1)
    expect(session2.world.self.skills.get(42)).toBe(1)
    expect(session2.world.self.skills.get(37)).toBe(1)

    // Select Ice Blast (45) on left hand & Static Field (42) on right hand via C2S 0x3C
    adapter2.clientStream.write(encodeC2sSelectSkill('left', 45, 0xffffffff))
    adapter2.clientStream.write(encodeC2sSelectSkill('right', 42, 0xffffffff))
    // Bind F1 (slot 0) -> right Static Field (42), F2 (slot 1) -> left Ice Blast (45) via C2S 0x51
    adapter2.clientStream.write(encodeC2sAssignSkillHotkey(0, 'right', 42, 0xffffffff))
    adapter2.clientStream.write(encodeC2sAssignSkillHotkey(1, 'left', 45, 0xffffffff))
    step40(session2)

    expect(session2.world.self.leftSkill).toBe(45)
    expect(session2.world.self.rightSkill).toBe(42)
    expect(session2.world.skillHotkeys.get(0)?.skill).toBe(42)
    expect(session2.world.skillHotkeys.get(0)?.hand).toBe('right')
    expect(session2.world.skillHotkeys.get(1)?.skill).toBe(45)
    expect(session2.world.skillHotkeys.get(1)?.hand).toBe('left')
    expect(adapter2.stats.protocolErrors).toBe(0)

    // Leave Game 2 -> auto-saves .d2s into LocalLobbyProvider
    session2.leaveGame()

    const savedBytes = lobby.getCharacterD2s('SkillPersistSor')!
    const parsedSaved = readD2sSave113c(savedBytes)
    expect(parsedSaved.attributes.skillPts).toBe(0)
    expect(parsedSaved.skillLevels[39 - 36]).toBe(1) // Ice Bolt
    expect(parsedSaved.skillLevels[45 - 36]).toBe(1) // Ice Blast
    expect(parsedSaved.skillLevels[42 - 36]).toBe(1) // Static Field
    expect(parsedSaved.skillLevels[37 - 36]).toBe(1) // Warmth
    expect(parsedSaved.skillLevels[36 - 36]).toBe(0) // Fire Bolt remained +1 item bonus only
    expect(parsedSaved.leftSkill).toBe(45)
    expect(parsedSaved.rightSkill).toBe(42)
    expect(parsedSaved.hotkeys[0]).toBe(42)
    expect(parsedSaved.hotkeys[1]).toBe((45 | 0x8000) >>> 0)

    // Game 3: re-enter from saved .d2s and verify OnlineSession immediately receives 0x94 + 0x7B + 0x23
    const adapter3 = await lobby.enterKernelGame({ charName: 'SkillPersistSor' })
    const session3 = new OnlineSession()
    session3.attachGameServer(adapter3)
    step40(session3)

    expect(session3.phase).toBe('ingame')
    expect(session3.world.self.skills.get(39)).toBe(1)
    expect(session3.world.self.skills.get(45)).toBe(1)
    expect(session3.world.self.skills.get(42)).toBe(1)
    expect(session3.world.self.skills.get(37)).toBe(1)
    expect(session3.world.self.leftSkill).toBe(45)
    expect(session3.world.self.rightSkill).toBe(42)
    expect(session3.world.skillHotkeys.get(0)?.skill).toBe(42)
    expect(session3.world.skillHotkeys.get(1)?.skill).toBe(45)
    expect(adapter3.stats.protocolErrors).toBe(0)

    session3.leaveGame()
  })

  it('wires initialPlayersX, setPlayersX(1..8), and /players N chat into D2GameStrc (+0x1D20 & 0x6FD31C1C)', async () => {
    const lobby = new LocalLobbyProvider({
      defaultMapSeed: 0x778899aa,
      backend: 'd2kern-113c',
    })
    await lobby.createCharacter({
      name: 'PlayersXBarb',
      classId: 4,
      expansion: true,
      hardcore: false,
      ladder: false,
    })

    const adapter = await lobby.enterKernelGame({
      charName: 'PlayersXBarb',
      playersX: 5,
    })
    const { bridge } = adapter

    expect(adapter.getPlayersX()).toBe(5)
    expect(bridge.m.u32((bridge.pGame + 0x1d20) >>> 0)).toBe(5)
    expect(bridge.m.u32(0x6fd31c1c)).toBe(5)
    expect(GAME_GetEffectivePlayerCount113c(bridge.m, bridge.pGame)).toBe(5)

    // Programmatic setPlayersX clamps to 1..8 and updates kernel D2GameStrc + callback
    expect(adapter.setPlayersX(8)).toBe(8)
    expect(GAME_GetEffectivePlayerCount113c(bridge.m, bridge.pGame)).toBe(8)
    expect(lobby.getPersistedPlayersX()).toBe(8)

    expect(adapter.setPlayersX(99)).toBe(8)
    expect(adapter.setPlayersX(0)).toBe(1)
    expect(GAME_GetEffectivePlayerCount113c(bridge.m, bridge.pGame)).toBe(1)

    // In-game `/players 6` and `"players set to 7"` C2S 0x15 chat commands
    const session = new OnlineSession()
    const chatMessages: string[] = []
    adapter.onEvent((ev) => {
      if (ev.type === 'Chat' && ev.kind === 'system') {
        chatMessages.push(ev.text)
      }
    })
    session.attachGameServer(adapter)
    session.tick(40, 3000)

    adapter.clientStream.write(encodeC2sChat('/players 6'))
    session.tick(40, 3040)
    expect(adapter.getPlayersX()).toBe(6)
    expect(GAME_GetEffectivePlayerCount113c(bridge.m, bridge.pGame)).toBe(6)
    expect(lobby.getPersistedPlayersX()).toBe(6)
    expect(chatMessages).toContain('players set to 6')

    adapter.clientStream.write(encodeC2sChat('players set to 7'))
    session.tick(40, 3080)
    expect(adapter.getPlayersX()).toBe(7)
    expect(GAME_GetEffectivePlayerCount113c(bridge.m, bridge.pGame)).toBe(7)
    expect(lobby.getPersistedPlayersX()).toBe(7)
    expect(chatMessages).toContain('players set to 7')
    expect(adapter.stats.protocolErrors).toBe(0)

    session.leaveGame()

    // Next Single-Player game inherits persisted playersX = 7 from LocalLobbyProvider
    const nextAdapter = await lobby.enterKernelGame({ charName: 'PlayersXBarb' })
    expect(nextAdapter.getPlayersX()).toBe(7)
    expect(GAME_GetEffectivePlayerCount113c(nextAdapter.bridge.m, nextAdapter.bridge.pGame)).toBe(7)
    nextAdapter.leave()
  })

  it('streams .d2s equipped, belt, inventory, and stash items via 0x9C/0x9D into OnlineSession and preserves all items on exportD2s()', () => {
    const tables = getServerItemDataTables()
    const customItems: D2sItemInput[] = [
      {
        id: 1,
        code: 'cap',
        location: 1,
        bodyLoc: 1, // Head
        gridX: 0,
        gridY: 0,
        storePage: 0,
        quality: 2,
        ilvl: 12,
        identified: true,
        compact: false,
        defense: 5,
        durability: 12,
        maxDurability: 12,
        stats: [],
      },
      {
        id: 2,
        code: 'sst',
        location: 1,
        bodyLoc: 4, // Right arm
        gridX: 0,
        gridY: 0,
        storePage: 0,
        quality: 2,
        ilvl: 1,
        identified: true,
        compact: false,
        durability: 20,
        maxDurability: 20,
        stats: [{ statId: 107, param: 36, value: 2 }],
      },
      {
        id: 3,
        code: 'hp1',
        location: 2, // Belt
        bodyLoc: 0,
        gridX: 0,
        gridY: 0,
        storePage: 0,
        quality: 2,
        ilvl: 1,
        identified: true,
        compact: true,
        stats: [],
      },
      {
        id: 4,
        code: 'tsc',
        location: 0, // Inventory
        bodyLoc: 0,
        gridX: 2,
        gridY: 1,
        storePage: 1,
        quality: 2,
        ilvl: 1,
        identified: true,
        compact: true,
        stats: [],
      },
      {
        id: 5,
        code: 'box',
        location: 0, // Stash
        bodyLoc: 0,
        gridX: 0,
        gridY: 0,
        storePage: 5,
        quality: 2,
        ilvl: 15,
        identified: true,
        compact: true,
        stats: [],
      },
    ]

    const d2sIn = writeD2sSave113c(
      {
        name: 'ItemVaultSor',
        classId: 1,
        level: 15,
        statusFlags: 0x20,
        progression: 3,
        activeDifficulty: 0,
        activeAct: 0,
        mapSeed: 0x55667788,
        leftSkill: 0,
        rightSkill: 36,
        attributes: {
          strength: 25,
          energy: 45,
          dexterity: 25,
          vitality: 30,
          statPts: 0,
          newSkills: 0,
          hitpointsFixed: 90 * 256,
          maxHpFixed: 90 * 256,
          manaFixed: 80 * 256,
          maxManaFixed: 80 * 256,
          staminaFixed: 95 * 256,
          maxStaminaFixed: 95 * 256,
          level: 15,
          experience: 22000,
          gold: 1200,
          goldBank: 8000,
        },
        skills: new Uint8Array(30),
        items: customItems,
      },
      tables,
    )

    const adapter = new LocalKernelD2gsAdapter113c({ d2s: d2sIn })
    const session = new OnlineSession()
    session.attachGameServer(adapter)
    session.tick(40, 4000)

    expect(adapter.stats.protocolErrors).toBe(0)
    expect(session.phase).toBe('ingame')

    // Verify S2C 0x9D (equipped) and 0x9C (belt/inventory/stash) packets arrived cleanly
    const itemOpcodes = adapter.bridge
      .drainUncompressedS2CPackets(adapter.handle.clientId)
      .filter((p) => p.opcode === 0x9c || p.opcode === 0x9d)
      .map((p) => p.opcode)
    expect(itemOpcodes.filter((op) => op === 0x9d).length).toBe(2)
    expect(itemOpcodes.filter((op) => op === 0x9c).length).toBe(3)

    expect(session.world.containers.equipment.size).toBe(2)
    expect(session.world.containers.belt.size).toBe(1)
    expect(session.world.containers.inventory.size).toBe(1)
    expect(session.world.containers.stash.size).toBe(1)

    // Verify equipped +2 Fire Bolt bonus is active in SparseMemory113c while hard points remain 0
    const pPlayer = adapter.handle.getPlayerPtr()
    const pFb = SKILLS_GetSkillById113c(adapter.bridge.m, pPlayer, 36, -1)
    expect(SKILLS_GetSkillLevel113c(adapter.bridge.m, pPlayer, pFb, 0)).toBe(0)
    expect(SKILLS_GetSkillLevel113c(adapter.bridge.m, pPlayer, pFb, 1)).toBe(2)

    // Verify exportD2s() preserves all 5 items losslessly
    const exported = readD2sSave113c(adapter.exportD2s(), tables)
    expect(exported.items.length).toBe(5)
    expect(exported.items.map((it) => it.code.trim())).toEqual(['cap', 'sst', 'hp1', 'tsc', 'box'])

    session.leaveGame()
  })
})
