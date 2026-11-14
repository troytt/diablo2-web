import { describe, expect, it } from 'vitest'
import { decode0x27NpcInfo } from '../src/netproto/d2gs/s2c/npc.ts'
import {
  CANONICAL_NPC_MSG_ID_TO_TBL_KEY,
  CANONICAL_QUEST_SPEECH_MSG_TO_TITLE_KEY,
  isNpcIntroMessageId,
  resolveNpcMsgIdTblKey,
} from '../src/common/data/canonical-npc-dialog-table.ts'
import {
  NPC_SCROLL_SPEECH_SOUND_BY_STRING_ID_113C,
  NPC_TALK_TABLE_113C,
  doesNpcOwnDialogStringId113c,
  doesNpcOwnGossipStringId113c,
  doesNpcOwnIntroStringId113c,
  isForeignNpcTalkStringId113c,
  resolveNpcGossipStringId113c,
  resolveNpcGossipTblKey113c,
  resolveNpcIntroStringId113c,
  resolveNpcIntroTblKey113c,
  resolveNpcSpeechSoundId113c,
} from '../src/common/audio/npc-speech-113c.ts'
import { SOUNDS_113C } from '../src/common/audio/sounds-113c.ts'
import {
  NPC_CANONICAL_GOSSIP_KEYS,
  NPC_CANONICAL_INTRO_KEYS,
  TOWN_NPC_DESCRIPTORS,
  getTownNpcDescriptorByHcIdx,
  resolveNpcDialogueTblText,
} from '../src/common/units/npc-table.ts'
import { OnlineSession } from '../src/client/session/online-session.ts'
import { WorldPanelsHud } from '../src/client/ui/world-panels.ts'
import { GameInstance } from '../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_CUSTOM_8_113C,
  QUEST_FLAG_CUSTOM_9_113C,
  QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  hasQuestFlag113c,
} from '../src/server/engine/quests-113c.ts'

describe('Issue #1772 — Frozen Anya (hcIdx 527) S2C 0x27 Stack Padding & 5-Act Cross-NPC Dialog Sweep', () => {
  it('1. decode0x27NpcInfo strictly honors D2Common.#10485 (pkt[6] count, u8 nMenu at +0, u16LE wStringId at +2) despite D2Game stack garbage', () => {
    // Authentic D2Game.dll QUESTS_NPCMessage (0x6fc54b80 <- 0x6fc7cdb3) 40-byte stack buffer:
    // - pkt[0]=0x27, pkt[1]=0x02 (UNIT_OBJECT), pkt[2..5]=42 (Frozen Anya object id), pkt[6]=1 (count=1)
    // - pkt[7]=0xcc (uninitialized alignment byte — previously forced 3-byte fallback!)
    // - slot 0 (pkt[8..11]): nMenu=0x00, _pad1=0x02 (uninitialized!), wStringId=0x4EA3 (20131 = A5Q3FoundAnyaAnya)
    // - slot 1 (pkt[12..15], beyond count=1): residual stack dword 0x00000200 (512 = Town Anya hcIdx 'drehya',
    //   which the old word-swap heuristic turned into { menu: 0, stringId: 512 } = AlkorGossip10!)
    // - slots 2..7: arbitrary uninitialized stack bytes
    const pkt = new Uint8Array(40)
    pkt.fill(0xcc)
    pkt[0] = 0x27
    pkt[1] = 0x02 // UNIT_OBJECT (558 fana)
    pkt[2] = 42
    pkt[3] = 0
    pkt[4] = 0
    pkt[5] = 0
    pkt[6] = 1 // count = 1
    pkt[7] = 0xcc // uninitialized _pad7
    pkt[8] = 0x00 // slot 0: nMenu = 0
    pkt[9] = 0x02 // slot 0: uninitialized _pad1 (non-zero!)
    pkt[10] = 0xa3 // slot 0: wStringId = 0x4EA3 (20131)
    pkt[11] = 0x4e
    // Residual stack dword in slot 1 (off=12): word0 = 0x0200 (512), word1 = 0x0000 (0)
    pkt[12] = 0x00
    pkt[13] = 0x02
    pkt[14] = 0x00
    pkt[15] = 0x00

    const decoded = decode0x27NpcInfo(pkt)
    expect(decoded.type).toBe('Npc')
    if (decoded.type === 'Npc' && decoded.kind === 'info') {
      expect(decoded.unitType).toBe(2)
      expect(decoded.unitId).toBe(42)
      expect(decoded.count).toBe(1)
      expect(decoded.messages).toEqual([
        { menu: 0, stringId: 20131, msgId: 20131, menuIndex: 0 },
      ])
      expect(decoded.allMessages?.length).toBe(8)
      expect(decoded.allMessages?.[0]).toEqual({
        menu: 0,
        stringId: 20131,
        msgId: 20131,
        menuIndex: 0,
      })
    }

    // D2Game.dll 0x6fc68cd1 / 0x6fd118b0 overhead speech: unitType=1, count=1, nMenu=3, wStringId=20079
    const overheadPkt = new Uint8Array(40)
    overheadPkt.fill(0xaa)
    overheadPkt[0] = 0x27
    overheadPkt[1] = 0x01
    overheadPkt[2] = 99
    overheadPkt[3] = 0
    overheadPkt[4] = 0
    overheadPkt[5] = 0
    overheadPkt[6] = 1
    overheadPkt[8] = 3 // nMenu = 3 (overhead speech bubble)
    overheadPkt[9] = 0x7f // uninitialized _pad1
    overheadPkt[10] = 0x6f // 20079 = 0x4E6F (Shenk taunt)
    overheadPkt[11] = 0x4e

    const overheadDecoded = decode0x27NpcInfo(overheadPkt)
    expect(overheadDecoded.type).toBe('Npc')
    if (overheadDecoded.type === 'Npc' && overheadDecoded.kind === 'info') {
      expect(overheadDecoded.unitType).toBe(1)
      expect(overheadDecoded.count).toBe(1)
      expect(overheadDecoded.messages).toEqual([
        { menu: 3, stringId: 20079, msgId: 20079, menuIndex: 3 },
      ])
    }
  })

  it('2. isNpcIntroMessageId never misclassifies regular *Gossip* lines (such as 512 AlkorGossip10 or 513 AlkorGossip11) as intros', () => {
    expect(resolveNpcMsgIdTblKey(512)).toBe('AlkorGossip10')
    expect(resolveNpcMsgIdTblKey(513)).toBe('AlkorGossip11')
    expect(resolveNpcMsgIdTblKey(527)).toBe('A3Q4Init1CainAct3')
    expect(isNpcIntroMessageId(512)).toBe(false)
    expect(isNpcIntroMessageId(513)).toBe(false)
    expect(isNpcIntroMessageId(527)).toBe(false)
    expect(isNpcIntroMessageId(20015)).toBe(false) // AnyaGossip1
    expect(isNpcIntroMessageId(20131)).toBe(false) // A5Q3FoundAnyaAnya (quest speech, not intro)

    // True intros (including the 3 0x6fba37a8 intro-slot keys without "Intro" in their TBL key)
    expect(isNpcIntroMessageId(20014)).toBe(true) // AnyaAct5IntroGossip1
    expect(isNpcIntroMessageId(11)).toBe(true) // AkaraIntroGossip1
    expect(isNpcIntroMessageId(54)).toBe(true) // CainGossip1 (Act 1 Cain intro slot)
    expect(isNpcIntroMessageId(297)).toBe(true) // CainAct2Gossip1 (Act 2 Cain intro slot)
    expect(isNpcIntroMessageId(302)).toBe(true) // TyraelGossip1 (Act 2 Tyrael intro slot)

    // Across the entire canonical table, zero regular Gossip2..Gossip13 or quest lines match isNpcIntroMessageId
    for (const [idStr, key] of Object.entries(CANONICAL_NPC_MSG_ID_TO_TBL_KEY)) {
      const id = Number(idStr)
      if (!isNpcIntroMessageId(id)) continue
      expect(key).not.toMatch(/^A[1-5]Q[1-6]/i)
      const isNamedIntroOrGreet = /Intro|Greet/i.test(key)
      const isSpecialIntroSlot =
        key === 'CainGossip1' || key === 'CainAct2Gossip1' || key === 'TyraelGossip1'
      expect(
        isNamedIntroOrGreet || isSpecialIntroSlot,
        `Unexpected intro classification for msgId=${id} (${key})`,
      ).toBe(true)
    }
  })

  it('3. OnlineSession + WorldPanelsHud end-to-end: Frozen Anya (Object 558 & hcIdx 527) plays A5Q3FoundAnyaAnya (20131, sound 4406), re-opens on repeat click, and blocks foreign stringId 512 cross-talk', () => {
    const session = new OnlineSession()
    const playedSpeeches: number[] = []
    session.audioRuntime.playSpeech = (soundId: number) => {
      playedSpeeches.push(soundId)
      return true
    }

    session.handleServerEvent({ type: 'LoadAct', act: 4, mapSeed: 1, areaId: 114 })
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 6, name: 'Hero', x: 5000, y: 5000 },
    })
    // Spawn Frozen Anya object (Objects.txt 558 'fana') AND backing NPC (hcIdx 527 'drehyaiced')
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: 5580,
        classId: 558,
        mode: 0,
        x: 5004,
        y: 5004,
      },
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 5270,
        classId: 527,
        name: 'Anya',
        x: 5004,
        y: 5004,
        lifePct: 128,
        mode: 1,
      },
    })
    session.hudModel.syncFromWorld()

    // Feed authentic stack-polluted S2C 0x27 packet for Object 5580
    const raw0x27 = new Uint8Array(40)
    raw0x27.fill(0xcc)
    raw0x27[0] = 0x27
    raw0x27[1] = 2 // UNIT_OBJECT
    raw0x27[2] = 0xcc // 5580 = 0x15CC
    raw0x27[3] = 0x15
    raw0x27[4] = 0
    raw0x27[5] = 0
    raw0x27[6] = 1 // count = 1
    raw0x27[8] = 0 // menu = 0
    raw0x27[9] = 0x02 // uninitialized _pad1
    raw0x27[10] = 0xa3 // 20131 = 0x4EA3 (A5Q3FoundAnyaAnya)
    raw0x27[11] = 0x4e
    raw0x27[12] = 0x00 // slot 1 stack residue: 0x0200 = 512 (drehya hcIdx -> AlkorGossip10 if misread!)
    raw0x27[13] = 0x02
    raw0x27[14] = 0x00
    raw0x27[15] = 0x00

    session.hudManager.worldPanels.setLanguage('ENG')
    session.handleServerEvent(decode0x27NpcInfo(raw0x27))
    session.hudModel.syncFromWorld()

    expect(session.hudManager.worldPanels.npcSpeech?.stringId).toBe(20131)
    expect(session.hudManager.worldPanels.npcSpeech?.text).toContain('Malah')
    expect(session.hudManager.worldPanels.npcSpeech?.text).not.toContain('Kurast')
    expect(playedSpeeches).toEqual([4406]) // anya_act5_q3_init (never 3539 alkor_gossip10!)

    // Close the object scroll and click Frozen Anya a second time before getting Malah's potion:
    // D2Client.dll 0x6fb2df5c must re-open the scroll and replay 4406!
    session.hudManager.worldPanels.closeNpcSpeech()
    expect(session.hudManager.worldPanels.npcSpeech).toBeNull()

    session.handleServerEvent(decode0x27NpcInfo(raw0x27))
    session.hudModel.syncFromWorld()
    expect(session.hudManager.worldPanels.npcSpeech?.stringId).toBe(20131)
    expect(playedSpeeches).toEqual([4406, 4406])
    session.hudManager.worldPanels.closeNpcSpeech()

    // Defense-in-depth check: even if foreign stringId=512 (AlkorGossip10) or stringId=513 (AlkorGossip11)
    // is passed directly to openNpcSpeech or resolveNpcSpeechSoundId113c for Frozen Anya (527) or Town Anya (512),
    // both text AND voice strictly belong to Anya and NEVER leak Act 3 Alkor!
    const wp = new WorldPanelsHud()
    wp.setLanguage('ENG')
    const directSounds: number[] = []
    wp.onPlayNpcSpeech = (sId) => directSounds.push(sId)

    const frozenAnyaDesc = getTownNpcDescriptorByHcIdx(527)!
    const townAnyaDesc = getTownNpcDescriptorByHcIdx(512)!
    const alkorDesc = getTownNpcDescriptorByHcIdx(254)!

    wp.openNpcSpeech(frozenAnyaDesc, 'Poisoned Alkor text', 'gossip', 512)
    expect(wp.npcSpeech?.text).toBe(resolveNpcDialogueTblText('A5Q3FoundAnyaAnya', { lang: 'ENG' }))
    expect(directSounds.at(-1)).toBe(4406)

    wp.openNpcSpeech(frozenAnyaDesc, undefined, 'intro', 513)
    expect(wp.npcSpeech?.text).toBe(resolveNpcDialogueTblText('A5Q3FoundAnyaAnya', { lang: 'ENG' }))
    expect(directSounds.at(-1)).toBe(4406)

    wp.openNpcSpeech(townAnyaDesc, undefined, 'intro', 512)
    expect(wp.npcSpeech?.text).toBe(resolveNpcDialogueTblText('AnyaAct5IntroGossip1', { lang: 'ENG' }))
    expect(directSounds.at(-1)).toBe(4399)

    // Meanwhile Alkor (hcIdx 254) himself legitimately owns msgId 512 (AlkorGossip10 -> sound 3539)
    wp.openNpcSpeech(alkorDesc, undefined, 'gossip', 512)
    expect(wp.npcSpeech?.stringId).toBe(512)
    expect(wp.npcSpeech?.text).toContain('Ormus has been talking in riddles')
    expect(directSounds.at(-1)).toBe(3539)

    // S2C 0x27 overhead speech (unitType=1, count=1, menu=3) attaches unit.overheadText without clobbering NPC menus
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 5110,
        classId: 511, // Larzuk
        name: 'Larzuk',
        x: 5010,
        y: 5010,
        lifePct: 128,
        mode: 1,
      },
    })
    session.handleServerEvent({
      type: 'Npc',
      kind: 'info',
      unitType: 1,
      npcId: 5110,
      unitId: 5110,
      count: 1,
      messages: [{ menu: 0, stringId: 20003 }],
    })
    expect(session.world.getNpcMessages(5110)).toEqual([{ menu: 0, stringId: 20003 }])

    session.handleServerEvent({
      type: 'Npc',
      kind: 'info',
      unitType: 1,
      npcId: 5110,
      unitId: 5110,
      count: 1,
      messages: [{ menu: 3, stringId: 20079 }],
    })
    expect(session.world.getNpcMessages(5110)).toEqual([{ menu: 0, stringId: 20003 }])
    expect(session.world.getUnit('monster', 5110)?.overheadText?.length).toBeGreaterThan(0)
  })

  it('4. GameInstance A5Q3 (Prison of Ice) emits stringId 20131 before thawing and completes full Malah potion -> thaw -> Scroll of Resistance chain', () => {
    const game = new GameInstance({ seed: 1772, areaId: 114, act: 4, difficulty: 0 })
    const playerId = game.connectPlayer({
      name: 'Assassin',
      classId: 6,
      level: 35,
      areaId: 114,
      x: 5100,
      y: 5100,
    })
    const frozenObjId = game.spawnObject({
      classId: 558, // Frozen Anya object ('fana')
      areaId: 114,
      x: 5101,
      y: 5100,
    })
    const frozenNpcId = game.spawnMonster({
      hcIdx: 527, // drehyaiced
      areaId: 114,
      x: 5101,
      y: 5100,
      isNpc: true,
    })
    const malahId = game.spawnMonster({
      hcIdx: 513, // malah
      areaId: 114,
      x: 5102,
      y: 5100,
      isNpc: true,
    })
    const player = (game as any).players.get(playerId)!

    // Step 1: Click Frozen Anya object (558) without Malah's Potion ('ice') -> starts a5q3 AND emits stringId 20131
    game.enqueueCommand(playerId, {
      type: 'Interact',
      target: { unitType: 2, id: frozenObjId },
    })
    const step1Events = game.stepFrame().get(playerId) ?? []
    expect(hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_STARTED_113C)).toBe(true)
    const objNpcInfo = step1Events.find(
      (ev) => ev.type === 'Npc' && ev.kind === 'info' && ev.unitId === frozenObjId,
    )
    expect(objNpcInfo).toBeDefined()
    if (objNpcInfo?.type === 'Npc' && objNpcInfo.kind === 'info') {
      expect(objNpcInfo.unitType).toBe(2)
      expect(objNpcInfo.messages).toEqual([{ menu: 0, stringId: 20131 }])
    }

    // Step 1b: Direct NpcInit with Frozen Anya monster (hcIdx 527) before potion also emits stringId 20131
    game.enqueueCommand(playerId, {
      type: 'NpcInit',
      target: { unitType: 1, id: frozenNpcId },
    })
    const step1bEvents = game.stepFrame().get(playerId) ?? []
    const monNpcInfo = step1bEvents.find(
      (ev) => ev.type === 'Npc' && ev.kind === 'info' && ev.unitId === frozenNpcId,
    )
    expect(monNpcInfo).toBeDefined()
    if (monNpcInfo?.type === 'Npc' && monNpcInfo.kind === 'info') {
      expect(monNpcInfo.messages).toEqual([{ menu: 0, stringId: 20131 }])
    }

    // Step 2: Talk to Malah (hcIdx 513) -> receives Malah's Potion ('ice') and sets PRIMARY_GOAL_DONE
    game.enqueueCommand(playerId, {
      type: 'NpcInit',
      target: { unitType: 1, id: malahId },
    })
    game.stepFrame()
    expect(player.items.some((it: { code: string }) => it.code.trim() === 'ice')).toBe(true)
    expect(hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_PRIMARY_GOAL_DONE_113C)).toBe(true)

    // Step 3: Click Frozen Anya object (558) while holding 'ice' -> consumes 'ice' and sets REWARD_PENDING
    game.enqueueCommand(playerId, {
      type: 'Interact',
      target: { unitType: 2, id: frozenObjId },
    })
    game.stepFrame()
    expect(player.items.some((it: { code: string }) => it.code.trim() === 'ice')).toBe(false)
    expect(hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_REWARD_PENDING_113C)).toBe(true)

    // Step 4: Return to Malah (0x6FC7F7CB) -> receives Scroll of Resistance ('tr2'), sets CUSTOM_8, keeps REWARD_PENDING until Town Anya reward
    game.enqueueCommand(playerId, {
      type: 'NpcInit',
      target: { unitType: 1, id: malahId },
    })
    game.stepFrame()
    expect(player.items.some((it: { code: string }) => it.code.trim() === 'tr2')).toBe(true)
    expect(hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_CUSTOM_8_113C)).toBe(true)
    expect(hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_REWARD_PENDING_113C)).toBe(true)
    expect(hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_COMPLETED_113C)).toBe(false)

    // Step 5: Talk to Town Anya (hcIdx 512, 0x6FC7FA8E) -> grants class Rare item, sets CUSTOM_9, and finalizes COMPLETED
    const townAnyaId = game.spawnMonster({
      hcIdx: 512, // drehya (Town Anya)
      areaId: 114,
      x: 5102,
      y: 5101,
      isNpc: true,
    })
    game.enqueueCommand(playerId, {
      type: 'NpcInit',
      target: { unitType: 1, id: townAnyaId },
    })
    game.stepFrame()
    expect(hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_CUSTOM_9_113C)).toBe(true)
    expect(hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_REWARD_PENDING_113C)).toBe(false)
    expect(hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_COMPLETED_113C)).toBe(true)
  })

  it('5. Mandatory 5-Act Class-of-Bug Sweep: every NPC_TALK_TABLE_113C row (47 rows) and every talkable TOWN_NPC_DESCRIPTOR across all 7 player classes (0..6) and gossip indices (0..11) resolves strictly to its own text + Stream=1 speech sound without hcIdx/msgId confusion', () => {
    expect(NPC_TALK_TABLE_113C.length).toBe(47)

    // Sweep A: Every row in D2Client.dll 0x6fba37a8 (NPC_TALK_TABLE_113C) across all 7 classes & gossip indices 0..11
    let activeTalkRows = 0
    for (const row of NPC_TALK_TABLE_113C) {
      if (row.entries.length === 0) {
        // Silent 0x6fba37a8 rows (257 Halbu, 266 Flavie, 331 Kaelan, 405 Jamella, 408 Hadriel) have no Talk submenu
        expect(resolveNpcIntroStringId113c(row.hcIdx, row.act, 0)).toBeUndefined()
        expect(resolveNpcGossipStringId113c(row.hcIdx, { act: row.act, playerClass: 0 })).toBeUndefined()
        continue
      }
      activeTalkRows++
      const rowStringIds = new Set(row.entries.map((e) => e.stringId))

      for (let playerClass = 0; playerClass < 7; playerClass++) {
        const introId = resolveNpcIntroStringId113c(row.hcIdx, row.act, playerClass)
        const introKey = resolveNpcIntroTblKey113c(row.hcIdx, row.act, playerClass)
        expect(
          introId,
          `Missing intro stringId for hcIdx=${row.hcIdx} act=${row.act} class=${playerClass}`,
        ).toBeDefined()
        expect(rowStringIds.has(introId!)).toBe(true)
        expect(doesNpcOwnIntroStringId113c(row.hcIdx, introId!, row.act)).toBe(true)
        expect(doesNpcOwnDialogStringId113c(row.hcIdx, introId!, row.act)).toBe(true)
        expect(isForeignNpcTalkStringId113c(row.hcIdx, introId!, row.act)).toBe(false)
        expect(introKey).toBeTruthy()
        expect((resolveNpcDialogueTblText(introKey!, { lang: 'ENG' }) ?? '').length).toBeGreaterThan(0)
        expect((resolveNpcDialogueTblText(introKey!, { lang: 'CHI' }) ?? '').length).toBeGreaterThan(0)

        const introSoundId = resolveNpcSpeechSoundId113c({
          hcIdx: row.hcIdx,
          stringId: introId,
          topic: 'intro',
          act: row.act,
          playerClass,
        })
        expect(
          introSoundId,
          `Missing intro soundId for hcIdx=${row.hcIdx} act=${row.act} class=${playerClass} (stringId=${introId})`,
        ).toBeGreaterThan(0)
        expect(SOUNDS_113C[introSoundId]?.stream).toBe(true)

        for (let gossipIndex = 0; gossipIndex < 12; gossipIndex++) {
          const gossipId = resolveNpcGossipStringId113c(row.hcIdx, {
            act: row.act,
            playerClass,
            gossipIndex,
          })
          const gossipKey = resolveNpcGossipTblKey113c(row.hcIdx, {
            act: row.act,
            playerClass,
            gossipIndex,
          })
          expect(
            gossipId,
            `Missing gossip stringId for hcIdx=${row.hcIdx} act=${row.act} class=${playerClass} idx=${gossipIndex}`,
          ).toBeDefined()
          expect(rowStringIds.has(gossipId!)).toBe(true)
          expect(doesNpcOwnGossipStringId113c(row.hcIdx, gossipId!, row.act)).toBe(true)
          expect(isForeignNpcTalkStringId113c(row.hcIdx, gossipId!, row.act)).toBe(false)
          expect(gossipKey).toBeTruthy()
          expect((resolveNpcDialogueTblText(gossipKey!, { lang: 'ENG' }) ?? '').length).toBeGreaterThan(0)
          expect((resolveNpcDialogueTblText(gossipKey!, { lang: 'CHI' }) ?? '').length).toBeGreaterThan(0)

          const gossipSoundId = resolveNpcSpeechSoundId113c({
            hcIdx: row.hcIdx,
            stringId: gossipId,
            topic: 'gossip',
            act: row.act,
            playerClass,
            gossipIndex,
          })
          expect(
            gossipSoundId,
            `Missing gossip soundId for hcIdx=${row.hcIdx} act=${row.act} idx=${gossipIndex} (stringId=${gossipId})`,
          ).toBeGreaterThan(0)
          expect(SOUNDS_113C[gossipSoundId]?.stream).toBe(true)
        }
      }
    }

    // Sweep B: Every talkable TOWN_NPC_DESCRIPTOR (including quest/dungeon NPCs outside 0x6fba37a8
    // such as Tristram Cain 146, Tal Rasha Tyrael 251, Izual spirit 406, Frozen Anya 527, Tyrael3 521)
    // AND numeric hcIdx === msgId collision immunity check!
    for (const desc of TOWN_NPC_DESCRIPTORS) {
      if (desc.canTalk === false) continue
      const keyLower = desc.npcTxtKey.toLowerCase()
      const introKey =
        (desc.greetingKey && desc.greetingKey !== desc.npcTxtKey ? desc.greetingKey : undefined) ??
        NPC_CANONICAL_INTRO_KEYS[keyLower]
      const gossipKeys = NPC_CANONICAL_GOSSIP_KEYS[keyLower] ?? []
      expect(introKey, `Missing canonical intro key for ${desc.npcTxtKey} (${desc.hcIdx})`).toBeTruthy()
      expect(gossipKeys.length, `Missing canonical gossip keys for ${desc.npcTxtKey} (${desc.hcIdx})`).toBeGreaterThan(0)

      for (let playerClass = 0; playerClass < 7; playerClass++) {
        const introSound = resolveNpcSpeechSoundId113c({
          hcIdx: desc.hcIdx,
          npcTxtKey: desc.npcTxtKey,
          topic: 'intro',
          act: desc.actIndex,
          playerClass,
        })
        const gossipSound = resolveNpcSpeechSoundId113c({
          hcIdx: desc.hcIdx,
          npcTxtKey: desc.npcTxtKey,
          topic: 'gossip',
          act: desc.actIndex,
          playerClass,
          gossipIndex: 0,
        })
        expect(introSound, `Intro sound missing for ${desc.npcTxtKey} (${desc.hcIdx})`).toBeGreaterThan(0)
        expect(gossipSound, `Gossip sound missing for ${desc.npcTxtKey} (${desc.hcIdx})`).toBeGreaterThan(0)
        expect(SOUNDS_113C[introSound]?.stream).toBe(true)
        expect(SOUNDS_113C[gossipSound]?.stream).toBe(true)
      }

      // Critical hcIdx-vs-stringId numeric collision check:
      // Many NPCs (e.g. 146..527) have an hcIdx number that happens to equal a completely different NPC's
      // msgId in CANONICAL_NPC_MSG_ID_TO_TBL_KEY (512 drehya == 512 AlkorGossip10;
      // 511 larzuk == 511 AlkorGossip9; 513 malah == 513 AlkorGossip11; 514 nihlathak == 514 AshearaIntroGossip1;
      // 515 qual-kehk == 515 AshearaIntroPalGossip1; 254 alkor == 254 LysanderIntroNecGossip1; 255 ormus == 255 LysanderGossip1).
      // Passing stringId = desc.hcIdx when that msgId is a foreign Intro/Gossip MUST NEVER play the foreign NPC's voice!
      const collidingKey = CANONICAL_NPC_MSG_ID_TO_TBL_KEY[desc.hcIdx]
      if (
        collidingKey &&
        !CANONICAL_QUEST_SPEECH_MSG_TO_TITLE_KEY[desc.hcIdx] &&
        !/^A[1-5]Q[1-6]/i.test(collidingKey) &&
        !doesNpcOwnDialogStringId113c(desc.hcIdx, desc.hcIdx, desc.actIndex)
      ) {
        expect(isForeignNpcTalkStringId113c(desc.hcIdx, desc.hcIdx, desc.actIndex)).toBe(true)
        const collidingForeignSound = NPC_SCROLL_SPEECH_SOUND_BY_STRING_ID_113C[desc.hcIdx]
        const guardedIntroSound = resolveNpcSpeechSoundId113c({
          hcIdx: desc.hcIdx,
          npcTxtKey: desc.npcTxtKey,
          stringId: desc.hcIdx,
          topic: 'intro',
          act: desc.actIndex,
        })
        const guardedGossipSound = resolveNpcSpeechSoundId113c({
          hcIdx: desc.hcIdx,
          npcTxtKey: desc.npcTxtKey,
          stringId: desc.hcIdx,
          topic: 'gossip',
          act: desc.actIndex,
        })
        expect(guardedIntroSound).not.toBe(collidingForeignSound)
        expect(guardedGossipSound).not.toBe(collidingForeignSound)
      }
    }

    // Explicit pinpoint assertions for Issue #1772 & Act 3 / Act 5 neighbors:
    expect(NPC_CANONICAL_GOSSIP_KEYS.drehyaiced).toEqual(['A5Q3FoundAnyaAnya'])
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 527, topic: 'intro', act: 4 })).toBe(4406)
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 527, topic: 'gossip', act: 4 })).toBe(4406)
    expect(resolveNpcIntroStringId113c(512, 4, 0)).toBe(20014)
    expect(resolveNpcIntroTblKey113c(512, 4, 0)).toBe('AnyaAct5IntroGossip1')
    expect(resolveNpcSpeechSoundId113c({ hcIdx: 512, topic: 'intro', act: 4 })).toBe(4399)
    for (let i = 0; i < 10; i++) {
      expect(resolveNpcGossipStringId113c(512, { act: 4, gossipIndex: i })).toBe(20015 + i)
      expect(resolveNpcGossipTblKey113c(512, { act: 4, gossipIndex: i })).toBe(`AnyaGossip${i + 1}`)
      expect(resolveNpcSpeechSoundId113c({ hcIdx: 512, topic: 'gossip', act: 4, gossipIndex: i })).toBe(4389 + i)
    }
  })
})
