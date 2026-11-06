import { describe, expect, it } from 'vitest'
import {
  NPC_GREETING_ROWS_BY_HCIDX_113C,
  NPC_SCROLL_SPEECH_SOUND_BY_STRING_ID_113C,
  NPC_SCROLL_SPEECH_SOUND_BY_TBL_KEY_113C,
  resolveNpcGossipStringId113c,
  resolveNpcGossipTblKey113c,
  resolveNpcGreetingSoundId113c,
  resolveNpcIntroStringId113c,
  resolveNpcIntroTblKey113c,
  resolveNpcSpeechSoundId113c,
} from '../../src/common/audio/npc-speech-113c.ts'
import { SOUNDS_113C } from '../../src/common/audio/sounds-113c.ts'
import { TOWN_NPC_DESCRIPTORS, getTownNpcDescriptorByHcIdx, resolveNpcDialogueTblText } from '../../src/common/units/npc-table.ts'
import { WorldPanelsHud } from '../../src/client/ui/world-panels.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'

describe('Issue #990 — 1.13c Town NPC Greeting & Scrolling Speech Audio Parity', () => {
  it('1. maps all 38 1.13c NPC greeting table rows (0x6fb8f0dc..0x6fb8f37c) and resolves 0x6fb4cce0 greeting sound IDs', () => {
    expect(Object.keys(NPC_GREETING_ROWS_BY_HCIDX_113C).length).toBe(38)

    // Act 1 Akara (148), Charsi (154), Warriv (155), Kashya (150), Gheed (147), Cain (265)
    expect(NPC_GREETING_ROWS_BY_HCIDX_113C[148]).toEqual({
      greetingId: 3480,
      greetingInactiveId: 3482,
      greetingTimeId: 3485,
      greetingReturnId: 3484,
    })
    expect(NPC_GREETING_ROWS_BY_HCIDX_113C[154]).toEqual({
      greetingId: 3737,
      greetingInactiveId: 3739,
      greetingTimeId: 3743,
      greetingReturnId: 3742,
    })
    expect(NPC_GREETING_ROWS_BY_HCIDX_113C[155]).toEqual({
      greetingId: 0,
      greetingInactiveId: 4320,
      greetingTimeId: 4324,
      greetingReturnId: 4323,
    })
    expect(NPC_GREETING_ROWS_BY_HCIDX_113C[265]).toEqual({
      greetingId: 3644,
      greetingInactiveId: 3647,
      greetingTimeId: 3649,
      greetingReturnId: 3644,
    })

    // Act 5 Larzuk (511), Anya (512/527), Malah (513), Nihlathak (514), Qual-Kehk (515), Cain5 (520)
    expect(resolveNpcGreetingSoundId113c(511, { rng: () => 0.9 })).toBe(4449)
    expect(resolveNpcGreetingSoundId113c(512, { rng: () => 0.9 })).toBe(4382)
    expect(resolveNpcGreetingSoundId113c(513, { rng: () => 0.9 })).toBe(4489)
    expect(resolveNpcGreetingSoundId113c(514, { rng: () => 0.9 })).toBe(4533)
    expect(resolveNpcGreetingSoundId113c(515, { rng: () => 0.9 })).toBe(4563)
    expect(resolveNpcGreetingSoundId113c(520, { rng: () => 0.9 })).toBe(3644)

    // mode = 2 (return greeting)
    expect(resolveNpcGreetingSoundId113c(148, { mode: 2 })).toBe(3484)
    // mode = 0 with time-of-day roll hitting (< 1/3) and timeOfDay = 1 (day)
    expect(resolveNpcGreetingSoundId113c(148, { mode: 0, timeOfDay: 1, rng: () => 0.1 })).toBe(3486)
    // mode = 0 with time-of-day roll missing (>= 1/3)
    expect(resolveNpcGreetingSoundId113c(148, { mode: 0, rng: () => 0.9 })).toBe(3480)

    // Tyrael (367) unshipped sound guard (0x6fb4cb90: 4306..4308 are skipped so 4305/4303 is kept)
    expect(resolveNpcGreetingSoundId113c(367, { mode: 0, timeOfDay: 0, rng: () => 0.1 })).toBe(4305)
  })

  it('2. maps all 863 1.13c scrolling speech sound IDs (0x6fb8f398) and resolves intro/gossip/quest/object speeches across Acts 1-5', () => {
    expect(Object.keys(NPC_SCROLL_SPEECH_SOUND_BY_STRING_ID_113C).length).toBe(863)

    // Every talkable Town NPC descriptor resolves a valid Stream=1 speech soundId for both intro and gossip
    for (const desc of TOWN_NPC_DESCRIPTORS) {
      if (desc.canTalk === false) continue
      const introSoundId = resolveNpcSpeechSoundId113c({
        hcIdx: desc.hcIdx,
        npcTxtKey: desc.npcTxtKey,
        topic: 'intro',
        act: desc.actIndex,
      })
      const gossipSoundId = resolveNpcSpeechSoundId113c({
        hcIdx: desc.hcIdx,
        npcTxtKey: desc.npcTxtKey,
        topic: 'gossip',
        act: desc.actIndex,
      })
      expect(introSoundId, `Missing intro speech soundId for ${desc.npcTxtKey} (hcIdx=${desc.hcIdx})`).toBeGreaterThan(0)
      expect(gossipSoundId, `Missing gossip speech soundId for ${desc.npcTxtKey} (hcIdx=${desc.hcIdx})`).toBeGreaterThan(0)
      expect(SOUNDS_113C[introSoundId]?.stream, `Expected Stream=1 for intro soundId=${introSoundId}`).toBe(true)
      expect(SOUNDS_113C[gossipSoundId]?.stream, `Expected Stream=1 for gossip soundId=${gossipSoundId}`).toBe(true)
    }

    // Class-specific introductions (0x6faf9130 -> 0x6fba37a8)
    expect(resolveNpcIntroStringId113c(148, 0, 1)).toBe(12) // Akara + Sorceress -> AkaraIntroSorGossip1
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 148, topic: 'intro', act: 0, playerClass: 1 })).toBe(3500)
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 154, topic: 'intro', act: 0, playerClass: 4 })).toBe(3754) // Charsi + Barbarian
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 177, topic: 'intro', act: 1, playerClass: 1 })).toBe(3796) // Drognan + Sorceress
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 255, topic: 'intro', act: 2, playerClass: 3 })).toBe(4267) // Ormus + Paladin
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 511, topic: 'intro', act: 4, playerClass: 0 })).toBe(4467) // Larzuk + Amazon
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 513, topic: 'intro', act: 4, playerClass: 1 })).toBe(4511) // Malah + Sorceress
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 513, topic: 'intro', act: 4, playerClass: 4 })).toBe(4510) // Malah + Barbarian
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 514, topic: 'intro', act: 4, playerClass: 6 })).toBe(4550) // Nihlathak + Assassin
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 514, topic: 'intro', act: 4, playerClass: 2 })).toBe(4551) // Nihlathak + Necromancer
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 515, topic: 'intro', act: 4, playerClass: 5 })).toBe(4580) // Qual-Kehk + Druid
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 515, topic: 'intro', act: 4, playerClass: 3 })).toBe(4581) // Qual-Kehk + Paladin

    // Warriv Act 1 stringId=1 C2S 0x31 normalization -> 4336 (non-Paladin) vs 4337 (Paladin)
    expect(resolveNpcSpeechSoundId113c({ stringId: 1, hcIdx: 155, topic: 'intro', playerClass: 1 })).toBe(4336)
    expect(resolveNpcSpeechSoundId113c({ stringId: 1, hcIdx: 155, topic: 'intro', playerClass: 3 })).toBe(4337)

    // Standalone object scroll speeches (Tower Tome 127, Horadric Orifice 396, Ancients Altar 20002)
    expect(resolveNpcSpeechSoundId113c({ stringId: 127, topic: 'quest' })).toBe(4215)
    expect(resolveNpcSpeechSoundId113c({ stringId: 396, topic: 'quest' })).toBe(4216)
    expect(resolveNpcSpeechSoundId113c({ stringId: 20002, topic: 'quest' })).toBe(4378)
    expect(NPC_SCROLL_SPEECH_SOUND_BY_TBL_KEY_113C['A1Q1InitAkara']).toBe(3503)
  })

  it('3. wires WorldPanelsHud & OnlineSession to play NPC greetings, auto-pop speeches, Talk submenu topics, Quest Log replay, and stop on close', () => {
    const wp = new WorldPanelsHud()
    const playedSpeechIds: number[] = []
    let closeCount = 0
    wp.onPlayNpcSpeech = (soundId) => playedSpeechIds.push(soundId)
    wp.onCloseNpcSpeech = () => {
      closeCount++
    }

    const akara = getTownNpcDescriptorByHcIdx(148)!
    // 1) Opening NPC menu plays Akara's short greeting (3480..3487) once per session
    wp.openNpcMenu(akara, 400, 300, 5)
    expect(playedSpeechIds.length).toBe(1)
    expect([3480, 3482, 3484, 3485, 3486, 3487]).toContain(playedSpeechIds[0])

    // Re-syncing the same open NPC menu does NOT re-trigger the greeting
    wp.openNpcMenu(akara, 400, 300, 5)
    expect(playedSpeechIds.length).toBe(1)

    // 2) Clicking Talk opens the submenu silently, then clicking Introduction / Gossip / Quest plays the scroll speech
    playedSpeechIds.length = 0
    wp.npcMenu!.questMessages = [{ stringId: 64, menu: 2 }]
    expect(wp.clickNpcMenuOption('talk')).toBe(true)
    expect(playedSpeechIds).toEqual([])

    expect(wp.clickNpcMenuOption('talk_intro')).toBe(true)
    expect(playedSpeechIds).toEqual([3499]) // AkaraIntroGossip1 (3499) or AkaraIntroSorGossip1 (3500) when localPlayerClass=1
    wp.closeNpcSpeech()
    expect(closeCount).toBe(1)

    playedSpeechIds.length = 0
    expect(wp.clickNpcMenuOption('talk_gossip')).toBe(true)
    expect(playedSpeechIds).toEqual([3498]) // AkaraGossip1 -> 3498
    wp.closeNpcSpeech()
    expect(closeCount).toBe(2)

    playedSpeechIds.length = 0
    expect(wp.clickNpcMenuOption('talk_gossip')).toBe(true)
    expect(playedSpeechIds).toEqual([3488]) // AkaraGossip2 -> 3488 (cycled gossip index 1)
    wp.closeNpcSpeech()
    expect(closeCount).toBe(3)

    playedSpeechIds.length = 0
    expect(wp.clickNpcMenuOption('talk_quest:64')).toBe(true)
    expect(playedSpeechIds).toEqual([3503]) // A1Q1InitAkara -> 3503
    wp.closeNpcSpeech()
    expect(closeCount).toBe(4)

    // 3) Standalone object scroll speech & Quest Log replay speech
    playedSpeechIds.length = 0
    wp.openStandaloneSpeech('', 'The Countess...', { stringId: 127 })
    expect(playedSpeechIds).toEqual([4215]) // book_of_lore
    wp.closeNpcSpeech()

    playedSpeechIds.length = 0
    wp.openStandaloneSpeech('', 'There is a place of great evil...', { tblKey: 'A1Q1InitAkara' })
    expect(playedSpeechIds).toEqual([3503])
    wp.closeNpcSpeech()

    // 4) OnlineSession integration: auto-pop intro suppresses duplicate short greeting, then subsequent visit plays greeting
    const session = new OnlineSession()
    const sessionSpeeches: number[] = []
    let activeSpeechId: number | null = null
    let sessionDialogCloses = 0
    session.audioRuntime.playSpeech = (soundId: number) => {
      sessionSpeeches.push(soundId)
      activeSpeechId = soundId
      return true
    }
    session.audioRuntime.onNpcDialogClose = () => {
      sessionDialogCloses++
      activeSpeechId = null
    }

    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 1 })
    sessionDialogCloses = 0
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 },
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 5, classId: 148, name: 'Akara', x: 5002, y: 5000, lifePct: 128, mode: 1 },
    })
    session.handleServerEvent({
      type: 'Npc',
      kind: 'info',
      unitType: 1,
      npcId: 5,
      unitId: 5,
      count: 2,
      messages: [
        { menu: 0, stringId: 11 },
        { menu: 0, stringId: 64 },
      ],
      allMessages: [
        { menu: 0, stringId: 11 },
        { menu: 0, stringId: 64 },
      ],
      raw: new Uint8Array(34),
    })

    // First interaction auto-pops intro (11 -> 3499) without playing a short greeting first
    session.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: 5 } })
    session.hudModel.syncFromWorld()
    expect(sessionSpeeches).toEqual([3499])
    expect(activeSpeechId).toBe(3499)

    // S2C 0x2C PlaySound(18) arriving while NPC speech is active must not clobber 3499
    session.handleServerEvent({
      type: 'PlaySound',
      unit: { unitType: 1, id: 5 },
      sound: 18,
    })
    expect(sessionSpeeches).toEqual([3499])
    expect(activeSpeechId).toBe(3499)

    // Closing intro chains into auto-pop quest offer (64 -> 3503) and keeps 3503 active
    session.hudManager.worldPanels.closeNpcSpeech()
    expect(sessionDialogCloses).toBe(1)
    expect(sessionSpeeches).toEqual([3499, 3503])
    expect(activeSpeechId).toBe(3503)

    // Closing quest offer stops speech and reveals main menu
    session.hudManager.worldPanels.closeNpcSpeech()
    expect(sessionDialogCloses).toBe(2)
    expect(activeSpeechId).toBeNull()

    // Close NPC session and re-open with S2C 0x27 where quest 66 is now in Talk submenu (menu: 1):
    // Akara plays her short greeting (3480..3487) instead of auto-popping a speech box
    session.hudManager.closeAllPanels()
    sessionSpeeches.length = 0
    session.handleServerEvent({
      type: 'Npc',
      kind: 'info',
      unitType: 1,
      npcId: 5,
      unitId: 5,
      count: 1,
      messages: [{ menu: 1, stringId: 66 }],
      allMessages: [{ menu: 1, stringId: 66 }],
      raw: new Uint8Array(34),
    })
    session.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: 5 } })
    session.hudModel.syncFromWorld()
    expect(sessionSpeeches.length).toBe(1)
    expect([3480, 3482, 3484, 3485, 3486, 3487]).toContain(sessionSpeeches[0])
  })

  it('4. Issue #1232: synchronizes class-specific NPC Introduction voice and .tbl scroll text across Talk submenu and auto-pop fallback', () => {
    expect(resolveNpcIntroTblKey113c(148, 0, 1)).toBe('AkaraIntroSorGossip1')
    expect(resolveNpcIntroTblKey113c(148, 0, 0)).toBe('AkaraIntroGossip1')
    expect(resolveNpcIntroTblKey113c(154, 0, 4)).toBe('CharsiIntroBarGossip1')
    expect(resolveNpcIntroTblKey113c(155, 0, 0)).toBe('WarrivAct1IntroGossip1')
    expect(resolveNpcIntroTblKey113c(155, 0, 3)).toBe('WarrivAct1IntroPalGossip1')
    expect(resolveNpcIntroTblKey113c(511, 4, 0)).toBe('LarzukAct5IntroAmaGossip1')

    const wp = new WorldPanelsHud()
    wp.setLanguage('ENG')
    const played: number[] = []
    wp.onPlayNpcSpeech = (id) => played.push(id)

    const akara = getTownNpcDescriptorByHcIdx(148)!
    wp.openNpcMenu(akara, 400, 300, 5, { playerClass: 1, act: 0, suppressGreeting: true })
    expect(wp.clickNpcMenuOption('talk_intro')).toBe(true)
    expect(played).toEqual([3500]) // akara_act1_intro_sor
    expect(wp.npcSpeech?.stringId).toBe(12)
    expect(wp.npcSpeech?.text).toBe(resolveNpcDialogueTblText('AkaraIntroSorGossip1', { lang: 'ENG' }))
    wp.closeNpcSpeech()

    // Auto-pop fallback (without S2C 0x27 message slots) uses local player's charClass for both voice & text
    const session = new OnlineSession()
    const sessionSpeeches: number[] = []
    session.audioRuntime.playSpeech = (soundId: number) => {
      sessionSpeeches.push(soundId)
      return true
    }
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 1 })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 4, name: 'Barb', x: 5000, y: 5000 }, // Barbarian
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 8, classId: 154, name: 'Charsi', x: 5002, y: 5000, lifePct: 128, mode: 1 },
    })
    session.handleServerEvent({
      type: 'Npc',
      kind: 'wantsInteract',
      unitType: 1,
      npcId: 8,
      unitId: 8,
    })
    session.world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: 8 } })
    session.hudModel.syncFromWorld()
    expect(sessionSpeeches).toEqual([3754]) // charsi_act1_intro_bar
    expect(session.hudManager.worldPanels.npcSpeech?.stringId).toBe(37)
    const charsiLang = session.hudManager.worldPanels.lang
    expect(session.hudManager.worldPanels.npcSpeech?.text).toBe(
      resolveNpcDialogueTblText('CharsiIntroBarGossip1', { lang: charsiLang }),
    )
  })

  it('5. Issue #1233: filters NPC Gossip by playerClass and act (0x6faf91e0 -> 0x6faf6910) even when gossipIndex is provided', () => {
    // Akara (hcIdx=148, act=0): stringId=13 (AkaraGossip1 -> 3498) has classMatch=1 (Sorceress only)
    // Non-Sorceress (Amazon playerClass=0) at gossipIndex=0 must skip stringId=13 and pick stringId=14 (AkaraGossip2 -> 3488)
    expect(resolveNpcGossipStringId113c(148, { act: 0, playerClass: 0, gossipIndex: 0 })).toBe(14)
    expect(resolveNpcGossipTblKey113c(148, { act: 0, playerClass: 0, gossipIndex: 0 })).toBe('AkaraGossip2')
    expect(
      resolveNpcSpeechSoundId113c({
        hcIdx: 148,
        topic: 'gossip',
        act: 0,
        playerClass: 0,
        gossipIndex: 0,
      }),
    ).toBe(3488)

    // Sorceress (playerClass=1) at gossipIndex=0 picks stringId=13 (AkaraGossip1 -> 3498), then gossipIndex=1 picks 14 (3488)
    expect(resolveNpcGossipStringId113c(148, { act: 0, playerClass: 1, gossipIndex: 0 })).toBe(13)
    expect(resolveNpcGossipTblKey113c(148, { act: 0, playerClass: 1, gossipIndex: 0 })).toBe('AkaraGossip1')
    expect(
      resolveNpcSpeechSoundId113c({
        hcIdx: 148,
        topic: 'gossip',
        act: 0,
        playerClass: 1,
        gossipIndex: 0,
      }),
    ).toBe(3498)

    // WorldPanelsHud talk_gossip synchronizes both .tbl text and speech audio for non-Sorceress vs Sorceress
    const wp = new WorldPanelsHud()
    wp.setLanguage('ENG')
    const played: number[] = []
    wp.onPlayNpcSpeech = (id) => played.push(id)

    const akara = getTownNpcDescriptorByHcIdx(148)!
    wp.openNpcMenu(akara, 400, 300, 5, { playerClass: 0, act: 0, suppressGreeting: true })
    expect(wp.clickNpcMenuOption('talk_gossip')).toBe(true)
    expect(played).toEqual([3488]) // AkaraGossip2
    expect(wp.npcSpeech?.stringId).toBe(14)
    expect(wp.npcSpeech?.text).toBe(resolveNpcDialogueTblText('AkaraGossip2', { lang: 'ENG' }))
    wp.closeNpcSpeech()
  })
})
