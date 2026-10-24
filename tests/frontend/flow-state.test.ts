import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CAMPFIRE_ANIM_RATES,
  CAMPFIRE_CLASS_ORDER,
  FRONTEND_MAX_CATCHUP_TICKS,
  FRONTEND_TICK_MS,
  HERO_TN_ANIM_SPECS,
  HERO_TOKENS,
  canSubmitCreateGame,
  canSubmitJoinGame,
  cancelConnecting,
  charSummaryToRosterCharacter,
  clickBattleNetButton,
  completeBnetConnect,
  confirmCharacterSelect,
  createInitialFlowState,
  enterCharCreate,
  formatJoinGameDetailLines,
  getAnimImageLoopFrame,
  getCharacterMaxDifficulty,
  hoverCampfireClass,
  isDifficultyUnlocked,
  isValidCharacterName,
  returnToLoginAfterSessionLoss,
  resolveStringByTblId,
  selectCampfireClass,
  stepFlowByDeltaMs,
  stepFlowFrame,
  stepFlowTick,
  submitBattleNetLogin,
  submitCharacterCreate,
  submitCreateGame,
  toggleChatGem,
} from '../../src/client/frontend/flow-state.ts'
import { FrontendRenderer, type FrontendManifest } from '../../src/client/frontend/frontend-renderer.ts'
import { parseMcpCharStatString } from '../../src/netproto/mcp/packets.ts'

describe('Diablo II v1.13c Front-End & Battle.net Flow State Machine', () => {
  it('validates character names according to D2Launch.dll rules', () => {
    expect(isValidCharacterName('A')).toBe(false)
    expect(isValidCharacterName('Isendra')).toBe(true)
    expect(isValidCharacterName('Dark_Wanderer')).toBe(true)
    expect(isValidCharacterName('Two_Under_Score')).toBe(false)
    expect(isValidCharacterName('NoDigits1')).toBe(false)
    expect(isValidCharacterName('-Invalid')).toBe(false)
    expect(isValidCharacterName('Invalid-')).toBe(false)
    expect(isValidCharacterName('In--valid')).toBe(false)
    expect(isValidCharacterName('TooLongCharacterName')).toBe(false)
  })

  it('walks through all 7 stages from Main Menu to Act 1 Rogue Encampment', () => {
    const state = createInitialFlowState()
    expect(state.stage).toBe('main_menu')
    // Never prefill gameName or gameDescription per D2Multi.dll 0x6f9e4bc0
    expect(state.gameName).toBe('')
    expect(state.gameDescription).toBe('')

    // Stage 1 -> Stage 2 Connecting Modal
    clickBattleNetButton(state)
    expect(state.stage).toBe('bnet_connecting')

    // Can cancel back to main menu
    cancelConnecting(state)
    expect(state.stage).toBe('main_menu')

    // Re-click Battle.net: stays on bnet_connecting across ticks until BNCS handshake completes (#699)
    clickBattleNetButton(state)
    for (let i = 0; i < 25; i++) {
      stepFlowTick(state)
    }
    expect(state.stage).toBe('bnet_connecting')
    completeBnetConnect(state)
    expect(state.stage).toBe('bnet_login')
    expect(state.activeInput).toBe('accountName')

    // Stage 2: Authentication transitions to char_create when roster is empty
    state.accountName = 'any_user_123'
    state.accountPassword = 'any_password_456'
    expect(submitBattleNetLogin(state)).toBe(true)

    // With empty initial roster, transitions directly to Stage 3 (7-Class Campfire)
    expect(state.stage).toBe('char_create')

    // Stage 3: Hover Amazon ('am') -> transitions from 'nu1' to 'nu2'
    hoverCampfireClass(state, 'am')
    expect(state.campfireClasses.am.phase).toBe('nu2')

    // Click Sorceress ('so') -> walks forward ('fw' -> 'nu3', ending at fwCount - 2 per 0x6f8f09d7)
    selectCampfireClass(state, 'so')
    expect(state.selectedClass).toBe('so')
    expect(state.campfireClasses.so.phase).toBe('fw')
    expect(state.activeInput).toBe('charName')

    const fwEnd = state.campfireClasses.so.frameCount.fw - 2
    for (let i = 0; i < fwEnd; i++) {
      stepFlowTick(state)
    }
    expect(state.campfireClasses.so.phase).toBe('nu3')

    // Switching to Necromancer ('ne') causes Sorceress to walk backward ('bw' -> 'nu1', ending at bwCount - 2)
    selectCampfireClass(state, 'ne')
    expect(state.selectedClass).toBe('ne')
    expect(state.campfireClasses.so.phase).toBe('bw')
    expect(state.campfireClasses.ne.phase).toBe('fw')

    const bwEnd = state.campfireClasses.so.frameCount.bw - 2
    for (let i = 0; i < bwEnd; i++) {
      stepFlowTick(state)
    }
    expect(state.campfireClasses.so.phase).toBe('nu1')

    // Enter character name and click OK -> transitions to Stage 4 (8-Slot Character Selection)
    state.charName = 'XulNecro'
    state.isExpansion = true
    state.isHardcore = false
    const created = submitCharacterCreate(state)
    expect(created).not.toBeNull()
    expect(created?.name).toBe('XulNecro')
    expect(created?.heroToken).toBe('ne')
    expect(created?.progression).toBe(0)
    expect(state.stage).toBe('char_select')
    expect(state.roster).toHaveLength(1)
    expect(state.selectedSlotIndex).toBe(0)

    // Stage 4 -> Stage 5 (Battle.net Lobby & Create Game Room)
    expect(confirmCharacterSelect(state)).toBe(true)
    expect(state.stage).toBe('bnet_lobby')
    expect(state.lobbySubPanel).toBe('create')
    // Confirming character select must NOT prefill gameName or gameDescription
    expect(state.gameName).toBe('')
    expect(state.gameDescription).toBe('')
    expect(canSubmitCreateGame(state)).toBe(false)

    // Toggle Chat Gem in Lobby
    toggleChatGem(state)
    expect(state.gemActivated).toBe(true)
    expect(state.chatMessages.at(-1)).toBe('Gem Activated')
    toggleChatGem(state)
    expect(state.gemActivated).toBe(false)
    expect(state.chatMessages.at(-1)).toBe('Gem Deactivated')

    // Fresh Level 1 character only has Normal unlocked; Nightmare and Hell are locked
    state.gameName = 'Sanctuary1'
    state.gamePassword = '123'
    state.difficulty = 'nightmare'
    expect(canSubmitCreateGame(state)).toBe(false)
    expect(submitCreateGame(state)).toBe(false)

    // Selecting Normal difficulty succeeds -> transitions to Stage 6 (Door Opening Loading)
    state.difficulty = 'normal'
    expect(canSubmitCreateGame(state)).toBe(true)
    expect(submitCreateGame(state)).toBe(true)
    expect(state.stage).toBe('door_loading')
    expect(state.doorFrame).toBe(0)

    // Stage 6: Step through all 10 frames (0..9) of Loadingscreen.dc6
    for (let i = 0; i < 27; i++) {
      stepFlowTick(state)
    }
    expect(state.doorFrame).toBe(9)
    // Does not enter game until sceneReady is true
    expect(state.stage).toBe('door_loading')

    state.sceneReady = true
    for (let i = 0; i < 5; i++) {
      stepFlowTick(state)
    }
    // Stage 7: Act 1 Rogue Encampment active!
    expect(state.stage).toBe('in_game')
  })

  it('unlocks Nightmare and Hell difficulties strictly per 1.13c D2Multi.dll progression thresholds', () => {
    // Expansion (5 acts per difficulty): Nightmare >= 5, Hell >= 10
    expect(getCharacterMaxDifficulty({ isExpansion: true, progression: 0 })).toBe('normal')
    expect(getCharacterMaxDifficulty({ isExpansion: true, progression: 4 })).toBe('normal')
    expect(getCharacterMaxDifficulty({ isExpansion: true, progression: 5 })).toBe('nightmare')
    expect(getCharacterMaxDifficulty({ isExpansion: true, progression: 9 })).toBe('nightmare')
    expect(getCharacterMaxDifficulty({ isExpansion: true, progression: 10 })).toBe('hell')
    expect(isDifficultyUnlocked({ isExpansion: true, progression: 5 }, 'nightmare')).toBe(true)
    expect(isDifficultyUnlocked({ isExpansion: true, progression: 5 }, 'hell')).toBe(false)
    expect(isDifficultyUnlocked({ isExpansion: true, progression: 10 }, 'hell')).toBe(true)

    // Classic (4 acts per difficulty): Nightmare >= 4, Hell >= 8
    expect(getCharacterMaxDifficulty({ isExpansion: false, progression: 3 })).toBe('normal')
    expect(getCharacterMaxDifficulty({ isExpansion: false, progression: 4 })).toBe('nightmare')
    expect(getCharacterMaxDifficulty({ isExpansion: false, progression: 7 })).toBe('nightmare')
    expect(getCharacterMaxDifficulty({ isExpansion: false, progression: 8 })).toBe('hell')

    // Verify 33-byte MCP statString progression parsing ((statBytes[27] >>> 1) & 0x1f per Fog.#10085)
    const stat = new Uint8Array(33).fill(0xff)
    stat[0] = 0x84
    stat[1] = 0x80
    stat[13] = 0x04 // Paladin (3 + 1)
    stat[25] = 65
    stat[26] = 0xe0 // EXPANSION | LADDER | 0x80

    stat[27] = 0x80 | (3 << 1) // 0x86: progression = 3 (Normal Act 3, must NOT unlock Nightmare)
    const summaryNorm3 = parseMcpCharStatString('PalNorm3', 99999, stat)
    expect(summaryNorm3.progression).toBe(3)
    expect(summaryNorm3.difficulty).toBe(0)
    const rosterNorm3 = charSummaryToRosterCharacter(summaryNorm3)
    expect(isDifficultyUnlocked(rosterNorm3, 'normal')).toBe(true)
    expect(isDifficultyUnlocked(rosterNorm3, 'nightmare')).toBe(false)
    expect(isDifficultyUnlocked(rosterNorm3, 'hell')).toBe(false)

    stat[27] = 0x80 | (5 << 1) // 0x8a: progression = 5 (Slayer, Nightmare unlocked, Hell locked)
    const summaryNm = parseMcpCharStatString('PalSlayer', 99999, stat)
    expect(summaryNm.progression).toBe(5)
    expect(summaryNm.difficulty).toBe(1)
    const rosterNm = charSummaryToRosterCharacter(summaryNm)
    expect(isDifficultyUnlocked(rosterNm, 'normal')).toBe(true)
    expect(isDifficultyUnlocked(rosterNm, 'nightmare')).toBe(true)
    expect(isDifficultyUnlocked(rosterNm, 'hell')).toBe(false)

    stat[27] = 0x80 | (10 << 1) // 0x94: progression = 10 (Champion, Hell unlocked)
    const summaryHell = parseMcpCharStatString('PalChamp', 99999, stat)
    expect(summaryHell.progression).toBe(10)
    expect(summaryHell.difficulty).toBe(2)
    const rosterHell = charSummaryToRosterCharacter(summaryHell)
    expect(isDifficultyUnlocked(rosterHell, 'hell')).toBe(true)

    stat[27] = 0x80 | (15 << 1) // 0x9e: progression = 15 (Patriarch, all difficulties unlocked)
    const summaryPatriarch = parseMcpCharStatString('PalPat', 99999, stat)
    expect(summaryPatriarch.progression).toBe(15)
    expect(summaryPatriarch.difficulty).toBe(2)
    const rosterPatriarch = charSummaryToRosterCharacter({
      name: 'PalPatRaw',
      classId: 3,
      level: 80,
      expansion: true,
      rawStatString: stat,
    })
    expect(rosterPatriarch.progression).toBe(15)
    expect(isDifficultyUnlocked(rosterPatriarch, 'hell')).toBe(true)
  })

  it('validates maxPlayers (1..8) and charDifference (1..99 when enabled) in Create Game', () => {
    const state = createInitialFlowState()
    state.stage = 'bnet_lobby'
    state.gameName = 'TestRoom1'

    state.maxPlayers = '0'
    expect(canSubmitCreateGame(state)).toBe(false)
    expect(submitCreateGame(state)).toBe(false)

    state.maxPlayers = '9'
    expect(canSubmitCreateGame(state)).toBe(false)
    expect(submitCreateGame(state)).toBe(false)

    state.maxPlayers = '4'
    state.charDifferenceEnabled = true
    state.charDifference = ''
    expect(canSubmitCreateGame(state)).toBe(false)
    expect(submitCreateGame(state)).toBe(false)

    state.charDifference = '10'
    expect(canSubmitCreateGame(state)).toBe(true)
    expect(submitCreateGame(state)).toBe(true)
    expect(state.stage).toBe('door_loading')
    expect(state.maxPlayers).toBe('4')
    expect(state.charDifference).toBe('10')
  })

  it('supports mouse and keyboard editing of maxPlayers, charDifference, and progression-gated difficulty radio buttons in FrontendRenderer', () => {
    const state = createInitialFlowState()
    enterCharCreate(state)
    selectCampfireClass(state, 'pa')
    state.charName = 'TTO'
    submitCharacterCreate(state)
    confirmCharacterSelect(state)

    const fakeCanvas = {
      getContext: () => ({ imageSmoothingEnabled: false }),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLCanvasElement
    const renderer = new FrontendRenderer(fakeCanvas, state)

    // 1. Game Name and Description are initially empty
    expect(state.gameName).toBe('')
    expect(state.gameDescription).toBe('')

    // 2. Click maxPlayers editbox (665, 290) and edit via digits & arrow keys
    renderer.handleMouseUp(665, 290)
    expect(state.activeInput).toBe('maxPlayers')
    renderer.handleKeyDown({ key: '4', preventDefault: () => {} } as unknown as KeyboardEvent)
    expect(state.maxPlayers).toBe('4')
    renderer.handleKeyDown({ key: 'ArrowUp', preventDefault: () => {} } as unknown as KeyboardEvent)
    expect(state.maxPlayers).toBe('5')
    renderer.handleKeyDown({ key: 'ArrowDown', preventDefault: () => {} } as unknown as KeyboardEvent)
    expect(state.maxPlayers).toBe('4')

    // 3. Click charDifference checkbox (440, 330) -> enables and focuses charDifference
    expect(state.charDifferenceEnabled).toBe(false)
    renderer.handleMouseUp(440, 330)
    expect(state.charDifferenceEnabled).toBe(true)
    expect(state.activeInput).toBe('charDifference')
    renderer.handleKeyDown({ key: '1', preventDefault: () => {} } as unknown as KeyboardEvent)
    expect(state.charDifference).toBe('1')
    renderer.handleKeyDown({ key: '5', preventDefault: () => {} } as unknown as KeyboardEvent)
    expect(state.charDifference).toBe('15')
    renderer.handleKeyDown({ key: 'ArrowUp', preventDefault: () => {} } as unknown as KeyboardEvent)
    expect(state.charDifference).toBe('16')

    // 4. Level 1 Paladin (progression = 0) cannot select Nightmare (565, 372) or Hell (705, 372)
    renderer.handleMouseUp(565, 372)
    expect(state.difficulty).toBe('normal')
    renderer.handleMouseUp(705, 372)
    expect(state.difficulty).toBe('normal')

    // 5. Unlock Nightmare (progression = 5) -> Nightmare is selectable, Hell remains locked
    state.roster[0]!.progression = 5
    state.roster[0]!.maxDifficulty = 'nightmare'
    renderer.handleMouseUp(565, 372)
    expect(state.difficulty).toBe('nightmare')
    renderer.handleMouseUp(705, 372)
    expect(state.difficulty).toBe('nightmare')

    // 6. Unlock Hell (progression = 10) -> Hell becomes selectable
    state.roster[0]!.progression = 10
    state.roster[0]!.maxDifficulty = 'hell'
    renderer.handleMouseUp(705, 372)
    expect(state.difficulty).toBe('hell')
  })

  it('maps Assassin campfire class id "as" to in-game hero token "ai"', () => {
    const state = createInitialFlowState()
    enterCharCreate(state)
    expect(CAMPFIRE_CLASS_ORDER).toHaveLength(7)
    selectCampfireClass(state, 'as')
    state.charName = 'Natalya'
    const created = submitCharacterCreate(state)
    expect(created?.classId).toBe('as')
    expect(created?.heroToken).toBe('ai')
    expect(created?.className).toBe('Assassin')
  })

  it('decouples front-end tick progression from display refresh rate (25 ticks/sec across 60Hz, 120Hz, 144Hz) and clamps large frame deltas', () => {
    expect(FRONTEND_TICK_MS).toBe(40)
    expect(FRONTEND_MAX_CATCHUP_TICKS).toBe(5)

    for (const refreshHz of [60, 120, 144]) {
      const state = createInitialFlowState()
      // First frame anchors lastFrameTimeMs at t = 0ms
      expect(stepFlowFrame(state, 0)).toBe(0)
      expect(state.globalTick).toBe(0)

      for (let i = 1; i <= refreshHz; i++) {
        stepFlowFrame(state, (i * 1000) / refreshHz)
      }
      expect(state.globalTick).toBe(25)
      expect(state.stageTicks).toBe(25)
    }

    // Also verify delta-based stepping across 60Hz, 120Hz, 144Hz, and 240Hz
    for (const refreshHz of [60, 120, 144, 240]) {
      const state = createInitialFlowState()
      const dtMs = 1000 / refreshHz
      for (let i = 0; i < refreshHz; i++) {
        stepFlowByDeltaMs(state, dtMs)
      }
      expect(state.globalTick).toBe(25)
    }

    // Verify bounded catch-up clamp (e.g. 5000ms tab switch clamps to 5 ticks = 200ms)
    const pausedState = createInitialFlowState()
    expect(stepFlowFrame(pausedState, 100)).toBe(0)
    const catchupSteps = stepFlowFrame(pausedState, 5100)
    expect(catchupSteps).toBe(FRONTEND_MAX_CATCHUP_TICKS)
    expect(pausedState.globalTick).toBe(FRONTEND_MAX_CATCHUP_TICKS)
    expect(pausedState.tickAccumulatorMs).toBe(0)

    // Non-positive or non-finite timestamps/deltas must be true no-ops that do not rewind lastFrameTimeMs
    expect(stepFlowFrame(pausedState, 5050)).toBe(0)
    expect(pausedState.lastFrameTimeMs).toBe(5100)
    expect(stepFlowFrame(pausedState, 5116)).toBe(0)
    expect(pausedState.tickAccumulatorMs).toBe(16)
    expect(stepFlowFrame(pausedState, Number.NaN)).toBe(0)
    expect(stepFlowByDeltaMs(pausedState, -16)).toBe(0)
    expect(stepFlowByDeltaMs(pausedState, Number.NaN)).toBe(0)
    expect(pausedState.globalTick).toBe(FRONTEND_MAX_CATCHUP_TICKS)
  })

  it('wraps AnimImage looping controls (burning logos & campfire flame) at framesPerDir - 1 with rate = 1 per D2Win.dll (0x6f8f0ac6)', () => {
    // 30-frame DC6 animations (D2logoBlackLeft/Right, D2logoFireLeft/Right, D2logoBlackBnet, D2logoBnet, fire.dc6)
    // loop over frames 0..28 (29 frames) and wrap to 0 at tick 29
    for (let t = 0; t <= 28; t++) {
      expect(getAnimImageLoopFrame(t, 30, 1)).toBe(t)
    }
    expect(getAnimImageLoopFrame(29, 30, 1)).toBe(0)
    expect(getAnimImageLoopFrame(30, 30, 1)).toBe(1)
    expect(getAnimImageLoopFrame(57, 30, 1)).toBe(28)
    expect(getAnimImageLoopFrame(58, 30, 1)).toBe(0)
  })

  it('advances 7-class campfire animations at exact 1.13c D2Launch.dll (0x6fa60c08) per-class, per-phase rates and wraps looping phases at framesPerDir - 1', () => {
    // Verify table against 1.13c D2Launch.dll @ 0x6fa60c08
    expect(CAMPFIRE_ANIM_RATES).toEqual({
      as: { nu1: 3, nu2: 3, fw: 1, nu3: 2, bw: 1 },
      dz: { nu1: 2, nu2: 2, fw: 1, nu3: 2, bw: 1 },
      am: { nu1: 3, nu2: 3, fw: 1, nu3: 2, bw: 1 },
      ne: { nu1: 3, nu2: 3, fw: 1, nu3: 2, bw: 1 },
      ba: { nu1: 2, nu2: 2, fw: 1, nu3: 1, bw: 1 },
      so: { nu1: 2, nu2: 2, fw: 1, nu3: 1, bw: 1 },
      pa: { nu1: 2, nu2: 2, fw: 1, nu3: 2, bw: 1 },
    })

    const state = createInitialFlowState()
    enterCharCreate(state)

    // 1. Back idle ('nu1'):
    // - Amazon ('am'): rate = 3 (120ms/frame), frameCount = 26 -> loops 0..24 (25 frames, wraps at tick 75)
    // - Barbarian ('ba'): rate = 2 (80ms/frame), frameCount = 16 -> loops 0..14 (15 frames, wraps at tick 30)
    stepFlowTick(state) // tick 1
    expect(state.campfireClasses.am.frameIndex).toBe(0)
    expect(state.campfireClasses.ba.frameIndex).toBe(0)

    stepFlowTick(state) // tick 2
    expect(state.campfireClasses.am.frameIndex).toBe(0)
    expect(state.campfireClasses.ba.frameIndex).toBe(1)

    stepFlowTick(state) // tick 3
    expect(state.campfireClasses.am.frameIndex).toBe(1)
    expect(state.campfireClasses.ba.frameIndex).toBe(1)

    // Step to tick 28 -> Barbarian at frame 14 (last frame before wrap at framesPerDir - 1 = 15)
    for (let t = 4; t <= 28; t++) {
      stepFlowTick(state)
    }
    expect(state.campfireClasses.ba.frameIndex).toBe(14)
    stepFlowTick(state) // tick 29
    expect(state.campfireClasses.ba.frameIndex).toBe(14)
    stepFlowTick(state) // tick 30 -> wraps to 0 (never reaches frame 15)
    expect(state.campfireClasses.ba.frameIndex).toBe(0)

    // Step to tick 72 -> Amazon at frame 24 (last frame before wrap at framesPerDir - 1 = 25)
    for (let t = 31; t <= 72; t++) {
      stepFlowTick(state)
    }
    expect(state.campfireClasses.am.frameIndex).toBe(24)
    stepFlowTick(state) // tick 73
    stepFlowTick(state) // tick 74
    expect(state.campfireClasses.am.frameIndex).toBe(24)
    stepFlowTick(state) // tick 75 -> wraps to 0 (never reaches frame 25)
    expect(state.campfireClasses.am.frameIndex).toBe(0)

    // 2. Hover ('nu2') and Select ('fw' -> 'nu3'):
    // At tick 75, Assassin ('as', nu1 rate=3, frameCount=31 -> loop 30) is at frame (75/3)%30 = 25;
    // hoverCampfireClass preserves continuous frameIndex = 25 per D2Win.dll 0x6f8f0966 (#703)
    hoverCampfireClass(state, 'as')
    expect(state.campfireClasses.as.phase).toBe('nu2')
    expect(state.campfireClasses.as.frameIndex).toBe(25)
    // Assassin nu2 has rate = 3
    stepFlowTick(state)
    stepFlowTick(state)
    expect(state.campfireClasses.as.frameIndex).toBe(25)
    stepFlowTick(state)
    expect(state.campfireClasses.as.frameIndex).toBe(26)

    // Select Paladin ('pa'): fw has rate = 1 (80 frames -> ends at 80 - 2 = 78 ticks), then nu3 has rate = 2 (9 frames -> wraps at 8)
    selectCampfireClass(state, 'pa')
    expect(state.campfireClasses.pa.phase).toBe('fw')
    for (let i = 0; i < 78; i++) {
      stepFlowTick(state)
    }
    expect(state.campfireClasses.pa.phase).toBe('nu3')
    expect(state.campfireClasses.pa.frameIndex).toBe(0)

    // Paladin nu3 advances 1 frame every 2 ticks and wraps at 9 - 1 = 8
    stepFlowTick(state)
    expect(state.campfireClasses.pa.frameIndex).toBe(0)
    stepFlowTick(state)
    expect(state.campfireClasses.pa.frameIndex).toBe(1)
    for (let i = 0; i < 12; i++) {
      stepFlowTick(state)
    }
    expect(state.campfireClasses.pa.frameIndex).toBe(7)
    stepFlowTick(state)
    expect(state.campfireClasses.pa.frameIndex).toBe(7)
    stepFlowTick(state)
    expect(state.campfireClasses.pa.frameIndex).toBe(0)
  })

  it('advances Character Selection & Lobby TN HTH hero avatars via 1.13c D2Win.dll (0x6f8ee81b) 8.8 fixed-point COF animRate accumulator', () => {
    expect(HERO_TN_ANIM_SPECS).toEqual({
      am: { frameCount: 16, animRate: 80 },
      so: { frameCount: 16, animRate: 80 },
      ne: { frameCount: 16, animRate: 80 },
      pa: { frameCount: 16, animRate: 128 },
      ba: { frameCount: 16, animRate: 80 },
      dz: { frameCount: 10, animRate: 96 },
      ai: { frameCount: 12, animRate: 64 },
    })

    const state = createInitialFlowState()
    for (const token of HERO_TOKENS) {
      expect(state.avatarAnims[token].acc).toBe(0)
      expect(state.avatarAnims[token].frameIndex).toBe(0)
    }

    // Tick 1:
    // am: acc=80 -> frame 0; pa: acc=128 -> frame 0; dz: acc=96 -> frame 0; ai: acc=64 -> frame 0
    stepFlowTick(state)
    expect(state.avatarAnims.am.frameIndex).toBe(0)
    expect(state.avatarAnims.pa.frameIndex).toBe(0)
    expect(state.avatarAnims.dz.frameIndex).toBe(0)
    expect(state.avatarAnims.ai.frameIndex).toBe(0)

    // Tick 2:
    // pa: acc=256 -> frame 1; others still at frame 0
    stepFlowTick(state)
    expect(state.avatarAnims.pa.frameIndex).toBe(1)
    expect(state.avatarAnims.am.frameIndex).toBe(0)
    expect(state.avatarAnims.dz.frameIndex).toBe(0)
    expect(state.avatarAnims.ai.frameIndex).toBe(0)

    // Tick 3:
    // dz: acc=288 -> frame 1; am: acc=240 -> frame 0; ai: acc=192 -> frame 0
    stepFlowTick(state)
    expect(state.avatarAnims.dz.frameIndex).toBe(1)
    expect(state.avatarAnims.am.frameIndex).toBe(0)
    expect(state.avatarAnims.ai.frameIndex).toBe(0)

    // Tick 4:
    // am: acc=320 -> frame 1; ai: acc=256 -> frame 1; pa: acc=512 -> frame 2
    stepFlowTick(state)
    expect(state.avatarAnims.am.frameIndex).toBe(1)
    expect(state.avatarAnims.so.frameIndex).toBe(1)
    expect(state.avatarAnims.ne.frameIndex).toBe(1)
    expect(state.avatarAnims.ba.frameIndex).toBe(1)
    expect(state.avatarAnims.ai.frameIndex).toBe(1)
    expect(state.avatarAnims.pa.frameIndex).toBe(2)

    // Advance to tick 24 -> Druid (dz: frameCount=10, wrapFrame=9, animRate=96) reaches 24*96 = 2304 (2304>>8 = 9 >= 9) -> wraps to 0
    for (let t = 5; t <= 23; t++) {
      stepFlowTick(state)
    }
    expect(state.avatarAnims.dz.frameIndex).toBe(8)
    stepFlowTick(state) // tick 24
    expect(state.avatarAnims.dz.frameIndex).toBe(0)
    expect(state.avatarAnims.dz.acc).toBe(0)

    // Advance to tick 30 -> Paladin (pa: frameCount=16, wrapFrame=15, animRate=128) reaches 30*128 = 3840 (3840>>8 = 15 >= 15) -> wraps to 0
    for (let t = 25; t <= 29; t++) {
      stepFlowTick(state)
    }
    expect(state.avatarAnims.pa.frameIndex).toBe(14)
    stepFlowTick(state) // tick 30
    expect(state.avatarAnims.pa.frameIndex).toBe(0)
    expect(state.avatarAnims.pa.acc).toBe(0)

    // Advance to tick 44 -> Assassin (ai: frameCount=12, wrapFrame=11, animRate=64) reaches 44*64 = 2816 (2816>>8 = 11 >= 11) -> wraps to 0
    for (let t = 31; t <= 43; t++) {
      stepFlowTick(state)
    }
    expect(state.avatarAnims.ai.frameIndex).toBe(10)
    stepFlowTick(state) // tick 44
    expect(state.avatarAnims.ai.frameIndex).toBe(0)
    expect(state.avatarAnims.ai.acc).toBe(0)

    // Advance to tick 48 -> Amazon/Sorceress/Necromancer/Barbarian (frameCount=16, wrapFrame=15, animRate=80) reach 48*80 = 3840 (3840>>8 = 15 >= 15) -> wrap to 0
    for (let t = 45; t <= 47; t++) {
      stepFlowTick(state)
    }
    expect(state.avatarAnims.am.frameIndex).toBe(14)
    stepFlowTick(state) // tick 48
    expect(state.avatarAnims.am.frameIndex).toBe(0)
    expect(state.avatarAnims.so.frameIndex).toBe(0)
    expect(state.avatarAnims.ne.frameIndex).toBe(0)
    expect(state.avatarAnims.ba.frameIndex).toBe(0)
  })

  it('keeps public/ui/frontend/manifest.json and FrontendRenderer aligned on 1.13c rates and wrapped frame indices', () => {
    const manifestPath = join(process.cwd(), 'public', 'ui', 'frontend', 'manifest.json')
    const metricsPath = join(process.cwd(), 'public', 'ui', 'frontend', 'fonts', 'metrics.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as FrontendManifest
    const fontMetas = JSON.parse(readFileSync(metricsPath, 'utf8'))

    // 1. Verify manifest animStrips rates
    expect(manifest.animStrips.logoMainBlack?.rate).toBe(1)
    expect(manifest.animStrips.logoMainFire?.rate).toBe(1)
    expect(manifest.animStrips.logoBnetBlack?.rate).toBe(1)
    expect(manifest.animStrips.logoBnetFire?.rate).toBe(1)
    expect(manifest.animStrips.campfireFlame?.rate).toBe(1)
    expect(manifest.animStrips.loadingDoor?.rate).toBe(3)

    // 2. Verify manifest campfireClasses rates
    for (const clsId of CAMPFIRE_CLASS_ORDER) {
      for (const phase of ['nu1', 'nu2', 'fw', 'nu3', 'bw'] as const) {
        expect(manifest.campfireClasses[clsId]?.[phase]?.rate).toBe(
          CAMPFIRE_ANIM_RATES[clsId][phase],
        )
      }
    }

    // 3. Verify manifest charAvatars animRates & frameCounts
    for (const token of HERO_TOKENS) {
      expect(manifest.charAvatars[token]?.frameCount).toBe(HERO_TN_ANIM_SPECS[token].frameCount)
      expect(manifest.charAvatars[token]?.animRate).toBe(HERO_TN_ANIM_SPECS[token].animRate)
    }

    // 4. Verify FrontendRenderer draws wrapped logo/flame frames and COF-accumulated avatar frames
    const state = createInitialFlowState()
    const drawCalls: { img: unknown; sx: number; sy: number; dx: number; dy: number }[] = []
    const fakeCtx = {
      imageSmoothingEnabled: false,
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      fillRect: () => {},
      drawImage: (
        img: unknown,
        sx: number,
        sy: number,
        _sw?: number,
        _sh?: number,
        dx?: number,
        dy?: number,
      ) => {
        drawCalls.push({ img, sx, sy, dx: dx ?? sx, dy: dy ?? sy })
      },
    }
    const fakeCanvas = {
      getContext: () => fakeCtx,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLCanvasElement

    const renderer = new FrontendRenderer(fakeCanvas, state)
    renderer.manifest = manifest
    renderer.fontMetas = fontMetas
    renderer.ready = true
    for (const strip of Object.values(manifest.animStrips)) {
      renderer.images.set(strip.file, { id: strip.file, width: strip.width, height: strip.height } as unknown as HTMLImageElement)
    }
    for (const strip of Object.values(manifest.charAvatars)) {
      renderer.images.set(strip.file, { id: strip.file, width: strip.width, height: strip.height } as unknown as HTMLImageElement)
    }
    for (const fn of Object.keys(fontMetas)) {
      for (const c of [0, 1, 2, 3, 4, 5, 7, 8, 9]) {
        renderer.images.set(`fonts/${fn}-c${c}.png`, { id: `fonts/${fn}-c${c}.png`, width: 256, height: 256 } as unknown as HTMLImageElement)
      }
    }

    // At globalTick = 29, 30-frame main menu logo wraps to frame 0 (not frame 29)
    state.stage = 'main_menu'
    state.globalTick = 29
    drawCalls.length = 0
    renderer.render(1000)
    const logoCall = drawCalls.find(
      (c) => (c.img as { id?: string })?.id === 'logo-main-black.png',
    )
    expect(logoCall).toBeDefined()
    const logoFrame0 = manifest.animStrips.logoMainBlack!.frames[0]!
    expect(logoCall?.sx).toBe(logoFrame0.x)
    expect(logoCall?.sy).toBe(logoFrame0.y)

    // In char_select after 2 ticks, Sorceress (animRate=80) is still on frame 0 (160>>8 = 0), not frame 2
    state.roster = [
      {
        id: 'so-1',
        name: 'Isendra',
        classId: 'so',
        heroToken: 'so',
        className: 'Sorceress',
        level: 1,
        isExpansion: true,
        isHardcore: false,
        isLadder: true,
        progression: 0,
        maxDifficulty: 'normal',
        createdAt: 0,
      },
    ]
    state.stage = 'char_select'
    state.globalTick = 0
    state.avatarAnims.so.acc = 0
    state.avatarAnims.so.frameIndex = 0
    stepFlowTick(state)
    stepFlowTick(state)
    expect(state.globalTick).toBe(2)
    expect(state.avatarAnims.so.frameIndex).toBe(0)

    drawCalls.length = 0
    renderer.render(1080)
    const avatarCallAtTick2 = drawCalls.find(
      (c) => (c.img as { id?: string })?.id === 'avatars/char-so-tn.png',
    )
    const soFrame0 = manifest.charAvatars.so!.frames[0]!
    expect(avatarCallAtTick2?.sx).toBe(soFrame0.x)
    expect(avatarCallAtTick2?.sy).toBe(soFrame0.y)

    // After 2 more ticks (tick 4 -> acc = 320 -> 320>>8 = 1), Sorceress advances to frame 1
    stepFlowTick(state)
    stepFlowTick(state)
    expect(state.avatarAnims.so.frameIndex).toBe(1)
    drawCalls.length = 0
    renderer.render(1160)
    const avatarCallAtTick4 = drawCalls.find(
      (c) => (c.img as { id?: string })?.id === 'avatars/char-so-tn.png',
    )
    const soFrame1 = manifest.charAvatars.so!.frames[1]!
    expect(avatarCallAtTick4?.sx).toBe(soFrame1.x)
    expect(avatarCallAtTick4?.sy).toBe(soFrame1.y)
  })

  it('resets lastFrameTimeMs and tickAccumulatorMs when entering in_game or returning after session loss to prevent catch-up bursts', () => {
    const state = createInitialFlowState()
    state.stage = 'door_loading'
    state.doorFrame = 9
    state.stageTicks = 29
    state.sceneReady = true

    // Anchor at 1000ms and advance 65ms (1 tick + 25ms leftover in tickAccumulatorMs)
    expect(stepFlowFrame(state, 1000)).toBe(0)
    expect(stepFlowFrame(state, 1065)).toBe(1)
    expect(state.stage).toBe('in_game')
    expect(state.tickAccumulatorMs).toBe(0)
    expect(state.lastFrameTimeMs).toBeNull()

    // Simulate a stale timestamp/accumulator right before a background session disconnect
    state.lastFrameTimeMs = 2000
    state.tickAccumulatorMs = 35
    state.avatarAnims.so.acc = 512
    state.avatarAnims.so.frameIndex = 2

    returnToLoginAfterSessionLoss(state, 'Connection lost')
    expect(state.stage).toBe('bnet_login')
    expect(state.stageTicks).toBe(0)
    expect(state.tickAccumulatorMs).toBe(0)
    expect(state.lastFrameTimeMs).toBeNull()
    expect(state.avatarAnims.so.acc).toBe(0)
    expect(state.avatarAnims.so.frameIndex).toBe(0)

    // First front-end frame after 30s background disconnect must anchor (0 ticks), not burst 5 catch-up ticks
    const tickBefore = state.globalTick
    expect(stepFlowFrame(state, 32000)).toBe(0)
    expect(state.globalTick).toBe(tickBefore)
    expect(stepFlowFrame(state, 32040)).toBe(1)
    expect(state.globalTick).toBe(tickBefore + 1)

    // Subsequent game creation after a prior in_game session must reset sceneReady = false
    state.stage = 'bnet_lobby'
    state.gameName = 'SecondRoom'
    state.maxPlayers = '8'
    state.sceneReady = true
    expect(submitCreateGame(state)).toBe(true)
    expect(state.stage).toBe('door_loading')
    expect(state.sceneReady).toBe(false)
    for (let i = 0; i < 35; i++) {
      stepFlowTick(state)
    }
    expect(state.doorFrame).toBe(9)
    expect(state.stage).toBe('door_loading')
  })

  it('resets stageTicks and avatarAnims across FrontendRenderer Escape key transitions and offline character deletion', () => {
    const manifestPath = join(process.cwd(), 'public', 'ui', 'frontend', 'manifest.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as FrontendManifest
    const state = createInitialFlowState()
    const fakeCtx = {
      imageSmoothingEnabled: false,
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      fillRect: () => {},
      drawImage: () => {},
    }
    const fakeCanvas = {
      getContext: () => fakeCtx,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLCanvasElement

    const renderer = new FrontendRenderer(fakeCanvas, state)
    renderer.manifest = manifest
    renderer.ready = true

    const makeEscapeEvent = (): KeyboardEvent =>
      ({
        key: 'Escape',
        preventDefault: () => {},
      }) as unknown as KeyboardEvent

    // 1. Escape on bnet_login -> main_menu resets stageTicks
    state.stage = 'bnet_login'
    state.stageTicks = 12
    renderer.handleKeyDown(makeEscapeEvent())
    expect(state.stage).toBe('main_menu')
    expect(state.stageTicks).toBe(0)

    // 2. Escape on char_create (empty roster) -> bnet_login resets stageTicks
    state.roster = []
    enterCharCreate(state)
    stepFlowTick(state)
    stepFlowTick(state)
    expect(state.stageTicks).toBe(2)
    renderer.handleKeyDown(makeEscapeEvent())
    expect(state.stage).toBe('bnet_login')
    expect(state.stageTicks).toBe(0)

    // 3. Escape on char_create (non-empty roster) -> char_select resets stageTicks and avatarAnims
    enterCharCreate(state)
    selectCampfireClass(state, 'pa')
    state.charName = 'Roland'
    submitCharacterCreate(state)
    enterCharCreate(state)
    for (let i = 0; i < 6; i++) stepFlowTick(state)
    expect(state.stageTicks).toBe(6)
    expect(state.avatarAnims.pa.frameIndex).toBeGreaterThan(0)
    renderer.handleKeyDown(makeEscapeEvent())
    expect(state.stage).toBe('char_select')
    expect(state.stageTicks).toBe(0)
    expect(state.avatarAnims.pa.acc).toBe(0)
    expect(state.avatarAnims.pa.frameIndex).toBe(0)

    // 4. Escape on bnet_lobby -> char_select resets stageTicks and avatarAnims
    confirmCharacterSelect(state)
    for (let i = 0; i < 6; i++) stepFlowTick(state)
    expect(state.stage).toBe('bnet_lobby')
    expect(state.stageTicks).toBe(6)
    expect(state.avatarAnims.pa.frameIndex).toBeGreaterThan(0)
    renderer.handleKeyDown(makeEscapeEvent())
    expect(state.stage).toBe('char_select')
    expect(state.stageTicks).toBe(0)
    expect(state.avatarAnims.pa.acc).toBe(0)
    expect(state.avatarAnims.pa.frameIndex).toBe(0)

    // 5. Offline char_select_delete button resets avatarAnims
    for (let i = 0; i < 6; i++) stepFlowTick(state)
    expect(state.avatarAnims.pa.frameIndex).toBeGreaterThan(0)
    const deleteBtn = renderer.getActiveButtons().find((b) => b.id === 'char_select_delete')
    expect(deleteBtn).toBeDefined()
    deleteBtn!.onClick()
    expect(state.roster).toHaveLength(0)
    expect(state.avatarAnims.pa.acc).toBe(0)
    expect(state.avatarAnims.pa.frameIndex).toBe(0)

    // 6. Escape on char_select -> main_menu resets stageTicks
    state.stageTicks = 9
    renderer.handleKeyDown(makeEscapeEvent())
    expect(state.stage).toBe('main_menu')
    expect(state.stageTicks).toBe(0)
  })

  it('renders and interacts with the 1.13c Lobby Join Game sub-panel (join-game-bg.png, side-by-side editboxes, 2-col game list, and MCP_GAMEINFO details)', () => {
    const manifestPath = join(process.cwd(), 'public', 'ui', 'frontend', 'manifest.json')
    const metricsPath = join(process.cwd(), 'public', 'ui', 'frontend', 'fonts', 'metrics.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as FrontendManifest
    const fontMetas = JSON.parse(readFileSync(metricsPath, 'utf8'))

    // 1. Verify canSubmitJoinGame (`D2Multi.dll` `0x6f9e1870`)
    const state = createInitialFlowState()
    expect(canSubmitJoinGame(state)).toBe(false)
    state.gameName = '   '
    expect(canSubmitJoinGame(state)).toBe(false)
    state.gameName = 'BaalRun-01'
    expect(canSubmitJoinGame(state)).toBe(true)
    state.gameName = 'SixteenCharsName'
    expect(canSubmitJoinGame(state)).toBe(false)
    state.gameName = ''

    // 2. Verify formatJoinGameDetailLines (`D2Multi.dll` `0x6f9e3280`)
    const sRecord = manifest.strings as unknown as Record<string, unknown>
    const detailLines = formatJoinGameDetailLines(
      {
        name: 'BaalRun-01',
        status: 0,
        uptimeSec: 3725, // 1:02:05
        creatorLevel: 45,
        levelDiff: 10,
        maxPlayers: 4,
        description: 'Fast Chaos',
        players: [
          { name: 'Isendra', charClass: 1, level: 45 },
          { name: 'Roland', charClass: 3, level: 50 },
        ],
      },
      sRecord,
    )
    expect(detailLines).toEqual([
      { text: 'Fast Chaos', color: 0 },
      { text: '', color: 0 },
      { text: 'Elapsed Time: 1:02:05', color: 0 },
      { text: 'Level 35 to 55', color: 0 },
      { text: 'Up to 4 Players', color: 0 },
      { text: '', color: 0 },
      { text: 'Isendra', color: 0 },
      { text: 'Level 45 Sorceress', color: 5 },
      { text: 'Roland', color: 0 },
      { text: 'Level 50 Paladin', color: 5 },
    ])

    // 3. Verify FrontendRenderer Join Game rendering & interactions
    enterCharCreate(state)
    selectCampfireClass(state, 'so')
    state.charName = 'Isendra'
    submitCharacterCreate(state)
    confirmCharacterSelect(state)
    expect(state.stage).toBe('bnet_lobby')

    const drawCalls: { img: unknown; dx: number; dy: number }[] = []
    const fakeCtx = {
      imageSmoothingEnabled: false,
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
      fillRect: () => {},
      drawImage: (
        img: unknown,
        sx: number,
        sy: number,
        _sw?: number,
        _sh?: number,
        dx?: number,
        dy?: number,
      ) => {
        drawCalls.push({ img, dx: dx ?? sx, dy: dy ?? sy })
      },
    }
    const fakeCanvas = {
      getContext: () => fakeCtx,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLCanvasElement

    const renderer = new FrontendRenderer(fakeCanvas, state)
    renderer.manifest = manifest
    renderer.fontMetas = fontMetas
    renderer.ready = true
    for (const imgName of [
      'bg-waiting-room.png',
      'create-game-bg.png',
      'join-game-bg.png',
      'gembutton.png',
      'scrollbar.png',
      'btn-chatleft.png',
      'btn-chatrighttop.png',
      'btn-chatright.png',
      'btn-create-cancel.png',
      'btn-game.png',
    ]) {
      renderer.images.set(imgName, { id: imgName, width: 373, height: 373 } as unknown as HTMLImageElement)
    }
    for (const strip of Object.values(manifest.animStrips)) {
      renderer.images.set(strip.file, { id: strip.file, width: strip.width, height: strip.height } as unknown as HTMLImageElement)
    }
    for (const strip of Object.values(manifest.charAvatars)) {
      renderer.images.set(strip.file, { id: strip.file, width: strip.width, height: strip.height } as unknown as HTMLImageElement)
    }
    for (const fn of Object.keys(fontMetas)) {
      for (const c of [0, 1, 2, 3, 4, 5, 7, 8, 9]) {
        renderer.images.set(`fonts/${fn}-c${c}.png`, { id: `fonts/${fn}-c${c}.png`, width: 256, height: 256 } as unknown as HTMLImageElement)
      }
    }

    const selectedGames: string[] = []
    const joinedGames: { name: string; pass: string }[] = []
    renderer.setAsyncHandlers({
      onSelectJoinGame: async (_st, gameName) => {
        selectedGames.push(gameName)
      },
      onJoinGame: async (_st, gameName, gamePass) => {
        joinedGames.push({ name: gameName, pass: gamePass })
      },
    })

    // Click JOIN tab button (`x=653..772, y=449..469`)
    renderer.handleMouseDown(700, 458, 1000)
    renderer.handleMouseUp(700, 458, 1010)
    expect(state.lobbySubPanel).toBe('join')

    state.realmGames = [
      { index: 0, name: 'BaalRun-01', description: 'Fast', playerCount: 5, flags: 0 },
      { index: 1, name: 'TradeHere', description: 'Shako 4 Ist', playerCount: 2, flags: 0 },
    ]
    state.selectedGameInfo = {
      name: 'BaalRun-01',
      status: 0,
      uptimeSec: 185,
      creatorLevel: 80,
      levelDiff: 0xff,
      maxPlayers: 8,
      description: 'Fast',
      players: [{ name: 'Isendra', charClass: 1, level: 80 }],
    }

    drawCalls.length = 0
    renderer.render(1020)
    // Verify join-game-bg.png is drawn at (415, 74) and create-game-bg.png is NOT drawn
    expect(
      drawCalls.some(
        (c) => (c.img as { id?: string })?.id === 'join-game-bg.png' && c.dx === 415 && c.dy === 74,
      ),
    ).toBe(true)
    expect(drawCalls.some((c) => (c.img as { id?: string })?.id === 'create-game-bg.png')).toBe(
      false,
    )

    // Verify submit button label is "JOIN GAME" (5151) and disabled while gameName is empty
    const submitBtnBefore = renderer.getActiveButtons().find((b) => b.id === 'create_game_submit')
    expect(submitBtnBefore?.label).toBe('JOIN GAME')
    expect(submitBtnBefore?.disabled).toBe(true)

    // Click side-by-side Password editbox (`x=599..767, y=123..148`) and Game Name editbox (`x=425..592, y=123..148`)
    renderer.handleMouseUp(650, 135, 1050)
    expect(state.activeInput).toBe('gamePassword')
    renderer.handleMouseUp(480, 135, 1060)
    expect(state.activeInput).toBe('gameName')

    // Click first game row (`BaalRun-01` at y=220..235) -> selects row, populates gameName, fires onSelectJoinGame
    renderer.handleMouseUp(480, 225, 2000)
    expect(state.selectedGameName).toBe('BaalRun-01')
    expect(state.gameName).toBe('BaalRun-01')
    expect(selectedGames).toEqual(['BaalRun-01'])

    const submitBtnAfter = renderer.getActiveButtons().find((b) => b.id === 'create_game_submit')
    expect(submitBtnAfter?.disabled).toBe(false)

    // Typing manually in gameName clears list selection (`0x6f9e1f60`)
    renderer.handleKeyDown({ key: 'X', preventDefault: () => {} } as unknown as KeyboardEvent)
    expect(state.gameName).toBe('BaalRun-01X')
    expect(state.selectedGameName).toBe('')
    expect(state.selectedGameInfo).toBeNull()

    // Double-clicking the second game row (`TradeHere` at y=235..250) within 500ms joins immediately (`0x6f9e4730`)
    renderer.handleMouseUp(480, 240, 3000)
    expect(state.selectedGameName).toBe('TradeHere')
    expect(state.gameName).toBe('TradeHere')
    expect(joinedGames).toHaveLength(0)
    renderer.handleMouseUp(480, 240, 3250)
    expect(joinedGames).toEqual([{ name: 'TradeHere', pass: '' }])
  })

  it('resolves 1.13c Join Game .tbl IDs (5150, 5151, 5275) without freezing when a stale manifest.strings is cached (#842)', () => {
    const manifestPath = join(process.cwd(), 'public', 'ui', 'frontend', 'manifest.json')
    const metricsPath = join(process.cwd(), 'public', 'ui', 'frontend', 'fonts', 'metrics.json')
    const fullManifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as FrontendManifest
    const fontMetas = JSON.parse(readFileSync(metricsPath, 'utf8'))

    // Simulate a stale pre-#832 manifest.strings returned from Cache Storage
    const staleStrings = structuredClone(
      fullManifest.strings as unknown as Record<string, unknown>,
    )
    delete staleStrings['5150']
    delete staleStrings['5151']
    delete staleStrings['5275']
    const staleLobby = staleStrings.lobby as Record<string, unknown>
    delete staleLobby.joinGameTitle
    delete staleLobby.joinGameBtn
    delete staleLobby.joinGameListHeader

    expect(resolveStringByTblId(staleStrings, 5150, 'lobby.createGameBtn')).toBe('CREATE GAME')
    expect(resolveStringByTblId(staleStrings, 5151, 'lobby.joinGameTitle')).toBe('JOIN GAME')
    expect(resolveStringByTblId(staleStrings, 5275, 'lobby.joinGameListHeader')).toBe(
      'Game Name Players',
    )
    // Unknown non-canonical .tbl IDs still fail fast (Anti-Silent-Failure)
    expect(() => resolveStringByTblId(staleStrings, 999999, 'lobby.nonExistent')).toThrow(
      /Missing required \.tbl string #999999/,
    )

    // Verify full Join Game render + buttons complete without throwing under stale manifest
    const state = createInitialFlowState()
    enterCharCreate(state)
    selectCampfireClass(state, 'so')
    state.charName = 'Isendra'
    submitCharacterCreate(state)
    confirmCharacterSelect(state)
    state.lobbySubPanel = 'join'

    const drawCalls: { img: unknown; dx: number; dy: number }[] = []
    const fakeCtx = {
      imageSmoothingEnabled: false,
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
      fillRect: () => {},
      drawImage: (
        img: unknown,
        sx: number,
        sy: number,
        _sw?: number,
        _sh?: number,
        dx?: number,
        dy?: number,
      ) => {
        drawCalls.push({ img, dx: dx ?? sx, dy: dy ?? sy })
      },
    }
    const fakeCanvas = {
      getContext: () => fakeCtx,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLCanvasElement

    const renderer = new FrontendRenderer(fakeCanvas, state)
    renderer.manifest = {
      ...fullManifest,
      strings: staleStrings as unknown as FrontendManifest['strings'],
    }
    renderer.fontMetas = fontMetas
    renderer.ready = true
    for (const imgName of [
      'bg-waiting-room.png',
      'join-game-bg.png',
      'gembutton.png',
      'scrollbar.png',
      'btn-chatleft.png',
      'btn-chatrighttop.png',
      'btn-chatright.png',
      'btn-create-cancel.png',
      'btn-game.png',
      'cursor.png',
    ]) {
      renderer.images.set(
        imgName,
        { id: imgName, width: 373, height: 373 } as unknown as HTMLImageElement,
      )
    }
    for (const strip of Object.values(fullManifest.animStrips)) {
      renderer.images.set(
        strip.file,
        { id: strip.file, width: strip.width, height: strip.height } as unknown as HTMLImageElement,
      )
    }
    for (const strip of Object.values(fullManifest.charAvatars)) {
      renderer.images.set(
        strip.file,
        { id: strip.file, width: strip.width, height: strip.height } as unknown as HTMLImageElement,
      )
    }
    for (const fn of Object.keys(fontMetas)) {
      for (const c of [0, 1, 2, 3, 4, 5, 7, 8, 9]) {
        renderer.images.set(
          `fonts/${fn}-c${c}.png`,
          { id: `fonts/${fn}-c${c}.png`, width: 256, height: 256 } as unknown as HTMLImageElement,
        )
      }
    }

    expect(() => renderer.render(1000)).not.toThrow()
    // Verify scrollbars, bottom character lineup avatar, and lobby buttons completed rendering
    expect(drawCalls.some((c) => (c.img as { id?: string })?.id === 'scrollbar.png')).toBe(true)
    expect(
      drawCalls.some((c) => (c.img as { id?: string })?.id === 'avatars/char-so-tn.png'),
    ).toBe(true)
    expect(drawCalls.some((c) => (c.img as { id?: string })?.id === 'btn-create-cancel.png')).toBe(
      true,
    )
    expect(drawCalls.some((c) => (c.img as { id?: string })?.id === 'btn-game.png')).toBe(true)
    const joinSubmitBtn = renderer.getActiveButtons().find((b) => b.id === 'create_game_submit')
    expect(joinSubmitBtn?.label).toBe('JOIN GAME')
  })
})
