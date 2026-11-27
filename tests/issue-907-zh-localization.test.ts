import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CANONICAL_FRONTEND_STRINGS_CHI,
  agreeTermsOfUse,
  applyCreateAccountServerError,
  confirmCharacterSelect,
  createInitialFlowState,
  enterCharCreate,
  formatJoinGameDetailLines,
  openTermsOfUse,
  resolveStringByTblId,
  selectCampfireClass,
  setBnetConnectStage,
  submitCharacterCreate,
  submitCreateAccountForm,
  toggleChatGem,
  validateNewAccountInputs,
} from '../src/client/frontend/flow-state.ts'
import {
  FrontendRenderer,
  type FrontendManifest,
} from '../src/client/frontend/frontend-renderer.ts'
import { setLang } from '../src/client/i18n/lang.ts'
import { WorldPanelsHud } from '../src/client/ui/world-panels.ts'
import { ClientUnit } from '../src/client/world/client-unit.ts'
import {
  getTownNpcDescriptorByHcIdx,
  getNpcDisplayNameByHcIdx,
} from '../src/common/units/npc-table.ts'
import { BncsCreateAccountStatus } from '../src/netproto/index.ts'

describe('Issue #907 — Chinese Localization for Battle.net Login, Character Select/Create, Game Lobby & In-Game NPC Names', () => {
  const manifestPath = join(process.cwd(), 'public', 'ui', 'frontend', 'manifest.json')
  const metricsPath = join(process.cwd(), 'public', 'ui', 'frontend', 'fonts', 'metrics.json')
  const fullManifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as FrontendManifest
  const fontMetas = JSON.parse(readFileSync(metricsPath, 'utf8'))

  afterEach(() => {
    setLang(null)
  })

  function createMockRenderer(state = createInitialFlowState()) {
    const fillTextCalls: { text: string; x: number; y: number; font: string; fillStyle: string }[] = []
    const drawImageCalls: { img: unknown; dx: number; dy: number }[] = []
    const fakeCtx = {
      font: '16px sans-serif',
      fillStyle: '#fff',
      textBaseline: 'top',
      globalCompositeOperation: 'source-over',
      imageSmoothingEnabled: false,
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
      fillRect: () => {},
      fillText: (text: string, x: number, y: number) => {
        if (fakeCtx.fillStyle !== '#080604') {
          fillTextCalls.push({ text, x, y, font: fakeCtx.font, fillStyle: fakeCtx.fillStyle })
        }
      },
      drawImage: (
        img: unknown,
        sx: number,
        sy: number,
        _sw?: number,
        _sh?: number,
        dx?: number,
        dy?: number,
      ) => {
        drawImageCalls.push({ img, dx: dx ?? sx, dy: dy ?? sy })
      },
    }
    const fakeCanvas = {
      getContext: () => fakeCtx,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLCanvasElement

    const renderer = new FrontendRenderer(fakeCanvas, state)
    renderer.manifest = fullManifest
    renderer.fontMetas = fontMetas
    renderer.ready = true
    for (const imgName of [
      'bg-trademark.png',
      'bg-game-select.png',
      'bg-bnet-connection.png',
      'bg-login.png',
      'terms-of-use-bg.png',
      'create-account-bg.png',
      'please-read-bg.png',
      'popup-ok-bg.png',
      'bg-char-create.png',
      'bg-char-select.png',
      'bg-waiting-room.png',
      'create-game-bg.png',
      'join-game-bg.png',
      'gembutton.png',
      'scrollbar.png',
      'checkbox.png',
      'radiobutton.png',
      'inputbox-charname.png',
      'btn-wide.png',
      'btn-medium.png',
      'btn-short.png',
      'btn-3wide.png',
      'btn-narrow.png',
      'btn-popup-small.png',
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
    for (const clsMap of Object.values(fullManifest.campfireClasses)) {
      for (const strip of Object.values(clsMap)) {
        if (strip && typeof strip === 'object' && 'file' in strip) {
          renderer.images.set(
            strip.file,
            { id: strip.file, width: strip.width, height: strip.height } as unknown as HTMLImageElement,
          )
        }
      }
    }
    for (const fn of Object.keys(fontMetas)) {
      for (const c of [0, 1, 2, 3, 4, 5, 7, 8, 9]) {
        renderer.images.set(
          `fonts/${fn}-c${c}.png`,
          { id: `fonts/${fn}-c${c}.png`, width: 256, height: 256 } as unknown as HTMLImageElement,
        )
      }
    }
    return { renderer, state, fillTextCalls, drawImageCalls }
  }

  it('switches all pre-game & Battle.net screens (Main Menu, Login, Terms, Create Account, Campfire, Character Select, Lobby) to canonical 1.13c Chinese when lang is zh', () => {
    setLang('zh')
    const { renderer, state, fillTextCalls } = createMockRenderer()

    // 1. Main Menu (`main_menu`)
    renderer.render(100)
    const mainMenuButtons = renderer.getActiveButtons()
    const mainMenuLabels = mainMenuButtons.map((b) => b.label)
    expect(mainMenuLabels).toEqual([
      '單一玩者',
      'BATTLE.NET',
      '其他多人連線',
      '製作群',
      '動畫片斷',
      '離開暗黑破壞神II',
    ])
    // Single Player and Other Multiplayer are disabled (grayed out) even when asyncHandlers.onSinglePlayer is provided; other main menu stone buttons are active with engraved black (#0c0c08) CJK labels
    expect(
      mainMenuButtons.filter((b) => b.disabled).map((b) => b.id),
    ).toEqual(['single_player', 'other_multiplayer'])
    renderer.setAsyncHandlers({ onSinglePlayer: () => {} })
    expect(
      renderer.getActiveButtons().filter((b) => b.disabled).map((b) => b.id),
    ).toEqual(['single_player', 'other_multiplayer'])
    renderer.setAsyncHandlers({})
    const singlePlayerChar = fillTextCalls.find((c) => c.text === '單')
    expect(singlePlayerChar).toBeDefined()
    expect(singlePlayerChar?.fillStyle).toBe('#0c0c08')

    // 2. Battle.net Connecting (`bnet_connecting`)
    state.stage = 'bnet_connecting'
    setBnetConnectStage(state, 0, renderer.getLocalizedStrings())
    expect(state.statusText).toBe('連接到Battle.net')
    setBnetConnectStage(state, 2, renderer.getLocalizedStrings())
    expect(state.statusText).toBe('連接到最快速的伺服器')
    expect(renderer.getActiveButtons().map((b) => b.label)).toEqual(['取消'])

    // 3. Battle.net Login (`bnet_login`)
    state.stage = 'bnet_login'
    fillTextCalls.length = 0
    renderer.render(200)
    const loginLabels = renderer.getActiveButtons().map((b) => b.label)
    expect(loginLabels).toEqual(['登錄', '帳號設定', '創造新帳戶', '取消'])
    const renderedLoginChars = fillTextCalls.map((c) => c.text).join('')
    expect(renderedLoginChars).toContain('帳戶名稱')
    expect(renderedLoginChars).toContain('密碼')
    // Stone button "登錄" uses engraved black (#0c0c08), while gold label "帳戶名稱" uses sky/pal.pl2 gold (#c0a080)
    expect(fillTextCalls.some((c) => c.text === '登' && c.fillStyle === '#0c0c08')).toBe(true)
    expect(fillTextCalls.some((c) => c.text === '帳' && c.fillStyle === '#c0a080')).toBe(true)

    // 4. Terms of Use (`bnet_terms_of_use`)
    openTermsOfUse(state)
    fillTextCalls.length = 0
    renderer.render(300)
    expect(renderer.getActiveButtons().map((b) => b.label)).toEqual(['不同意', '同意'])
    expect(fillTextCalls.map((c) => c.text).join('')).toContain('使用宣告')

    // 5. Create New Account (`bnet_create_account`) & Validation
    agreeTermsOfUse(state)
    fillTextCalls.length = 0
    renderer.render(400)
    expect(renderer.getActiveButtons().map((b) => b.label)).toEqual(['離開', '好'])
    const renderedCreateAcctChars = fillTextCalls.map((c) => c.text).join('')
    expect(renderedCreateAcctChars).toContain('請為你的新帳戶輸入一個名字和密碼')
    expect(renderedCreateAcctChars).toContain('帳戶名稱')
    expect(renderedCreateAcctChars).toContain('核對密碼')

    state.accountName = 'a'
    state.accountPassword = 'pass'
    state.accountVerifyPassword = 'pass'
    const shortErr = validateNewAccountInputs(
      state,
      renderer.getLocalizedStrings() as unknown as Record<string, unknown>,
    )
    expect(shortErr.valid).toBe(false)
    if (!shortErr.valid) {
      expect(shortErr.message).toBe('帳戶名稱至少要輸入二個字。')
    }

    applyCreateAccountServerError(
      state,
      BncsCreateAccountStatus.ALREADY_EXISTS,
      renderer.getLocalizedStrings() as unknown as Record<string, unknown>,
    )
    expect(state.popupModal?.message).toContain('你所選擇的名字已經有其他的帳戶使用了')
    state.popupModal = null

    // 6. Please Read (`bnet_please_read`)
    state.accountName = 'TestHero'
    state.accountPassword = 'secret'
    state.accountVerifyPassword = 'secret'
    submitCreateAccountForm(
      state,
      renderer.getLocalizedStrings() as unknown as Record<string, unknown>,
    )
    expect(state.stage).toBe('bnet_please_read')
    fillTextCalls.length = 0
    renderer.render(500)
    expect(fillTextCalls.map((c) => c.text).join('')).toContain('請寫下你的密碼')

    // 7. Character Creation Campfire (`char_create`)
    enterCharCreate(state)
    selectCampfireClass(state, 'so')
    fillTextCalls.length = 0
    renderer.render(600)
    expect(renderer.getActiveButtons().map((b) => b.label)).toEqual(['離開', '好'])
    const renderedCampfireChars = fillTextCalls.map((c) => c.text).join('')
    expect(renderedCampfireChars).toContain('選擇英雄的職業')
    expect(renderedCampfireChars).toContain('法師')
    expect(renderedCampfireChars).toContain('人物名稱')
    expect(renderedCampfireChars).toContain('資料片人物')
    expect(renderedCampfireChars).toContain('專家級')
    expect(renderedCampfireChars).toContain('天梯人物')

    // 8. Character Selection (`char_select`)
    state.charName = 'Isendra'
    state.isExpansion = true
    state.isHardcore = true
    submitCharacterCreate(state)
    expect(state.stage).toBe('char_select')
    fillTextCalls.length = 0
    renderer.render(700)
    expect(renderer.getActiveButtons().map((b) => b.label)).toEqual([
      '創造新人物',
      '轉換為資料片人物',
      '刪除人物',
      '離開',
      '好',
    ])
    const renderedSelectChars = fillTextCalls.map((c) => c.text).join('')
    expect(renderedSelectChars).toContain('選擇人物')
    expect(renderedSelectChars).toContain('等級')
    expect(renderedSelectChars).toContain('法師')
    expect(renderedSelectChars).toContain('資料片人物')

    // 9. Battle.net Waiting Room Lobby (`bnet_lobby` - Create & Join sub-panels)
    confirmCharacterSelect(state)
    expect(state.stage).toBe('bnet_lobby')
    state.lobbySubPanel = 'create'
    fillTextCalls.length = 0
    renderer.render(800)
    expect(renderer.getActiveButtons().map((b) => b.label)).toEqual([
      '發送',
      '耳語',
      '求助',
      '緘默',
      '解除緘默',
      '行動',
      '開創',
      '加入',
      '頻道',
      '天梯',
      '結束',
      '取消',
      '創造遊戲',
    ])
    const renderedCreateLobbyChars = fillTextCalls.map((c) => c.text).join('')
    expect(renderedCreateLobbyChars).toContain('創造遊戲')
    expect(renderedCreateLobbyChars).toContain('遊戲名稱')
    expect(renderedCreateLobbyChars).toContain('遊戲說明')
    expect(renderedCreateLobbyChars).toContain('人物差別')
    expect(renderedCreateLobbyChars).toContain('最多加入人數')
    expect(renderedCreateLobbyChars).toContain('普通')
    expect(renderedCreateLobbyChars).toContain('惡夢')
    expect(renderedCreateLobbyChars).toContain('地獄')

    // Chat Gem toggle in Chinese
    const gemMsgOn = toggleChatGem(state, renderer.getLocalizedStrings().lobby)
    expect(gemMsgOn?.text).toBe('寶石啟用')
    const gemMsgOff = toggleChatGem(state, renderer.getLocalizedStrings().lobby)
    expect(gemMsgOff?.text).toBe('寶石停用')

    // Join Game sub-panel (`lobbySubPanel = 'join'`)
    state.lobbySubPanel = 'join'
    state.selectedGameInfo = {
      name: 'BaalRun-01',
      status: 0,
      uptimeSec: 185,
      creatorLevel: 80,
      levelDiff: 10,
      maxPlayers: 6,
      description: 'Fast',
      players: [{ name: 'Isendra', charClass: 1, level: 80 }],
    }
    fillTextCalls.length = 0
    renderer.render(900)
    expect(renderer.getActiveButtons().map((b) => b.label)).toEqual([
      '發送',
      '耳語',
      '求助',
      '緘默',
      '解除緘默',
      '行動',
      '開創',
      '加入',
      '頻道',
      '天梯',
      '結束',
      '取消',
      '加入遊戲',
    ])
    const renderedJoinLobbyChars = fillTextCalls.map((c) => c.text).join('')
    expect(renderedJoinLobbyChars).toContain('加入遊戲')
    expect(renderedJoinLobbyChars).toContain('遊戲名稱')
    expect(renderedJoinLobbyChars).toContain('玩者')

    const detailLines = formatJoinGameDetailLines(
      state.selectedGameInfo,
      renderer.getLocalizedStrings() as unknown as Record<string, unknown>,
    )
    expect(detailLines.some((l) => l.text.includes('已進行時間：0:03:05'))).toBe(true)
    expect(detailLines.some((l) => l.text.includes('等級 70 到 90'))).toBe(true)
    expect(detailLines.some((l) => l.text.includes('最多 6 位玩者'))).toBe(true)
    expect(detailLines.some((l) => l.text.includes('等級 80') && l.text.includes('法師'))).toBe(true)

    // 10. Switching back to English (`setLang('en')`) restores English labels immediately
    setLang('en')
    expect(resolveStringByTblId(fullManifest.strings as unknown as Record<string, unknown>, 5151)).toBe(
      'JOIN GAME',
    )
    expect(renderer.getActiveButtons().map((b) => b.label)).toEqual([
      'SEND',
      'WHISPER',
      'HELP',
      'SQUELCH',
      'UNSQUELCH',
      'EMOTE',
      'CREATE',
      'JOIN',
      'CHANNEL',
      'LADDER',
      'QUIT',
      'CANCEL',
      'JOIN GAME',
    ])
    expect(CANONICAL_FRONTEND_STRINGS_CHI.lobby.joinGameTitle).toBe('加入遊戲')
  })

  it('resolves in-game NPC names in Chinese (CHI) across npc-table, ClientUnit snapshots, and WorldPanelsHud', () => {
    setLang('zh')

    // 1. Canonical 1.13c NPC table resolution with 'CHI' vs 'ENG'
    expect(getNpcDisplayNameByHcIdx(148, 'CHI')).toBe('阿卡拉')
    expect(getNpcDisplayNameByHcIdx(154, 'CHI')).toBe('恰西')
    expect(getNpcDisplayNameByHcIdx(150, 'CHI')).toBe('卡夏')
    expect(getNpcDisplayNameByHcIdx(147, 'CHI')).toBe('基得')
    expect(getNpcDisplayNameByHcIdx(155, 'CHI')).toBe('瓦瑞夫')
    expect(getNpcDisplayNameByHcIdx(244, 'CHI')).toBe('迪卡．凱恩')
    expect(getNpcDisplayNameByHcIdx(265, 'CHI')).toBe('迪卡．凱恩')

    expect(getNpcDisplayNameByHcIdx(148, 'ENG')).toBe('Akara')
    expect(getNpcDisplayNameByHcIdx(154, 'ENG')).toBe('Charsi')

    // 2. ClientUnit constructor and updateFromSnapshot populate nameZh and name for Town NPCs
    const akaraUnit = new ClientUnit({
      id: 101,
      unitType: 1,
      classId: 0,
      x: 5000,
      y: 5000,
    })
    akaraUnit.updateFromSnapshot({
      id: 101,
      unitType: 1,
      classId: 148,
      x: 5000,
      y: 5000,
      mode: 1,
      lifePct: 128,
    })
    expect(akaraUnit.isNpc).toBe(true)
    expect(akaraUnit.name).toBe('Akara')
    expect(akaraUnit.nameZh).toBe('阿卡拉')

    // 3. WorldPanelsHud NPC interaction menu title updates on openNpcMenu and setLanguage
    const worldPanels = new WorldPanelsHud()
    worldPanels.setLanguage('CHI')
    const akaraDesc = getTownNpcDescriptorByHcIdx(148)
    expect(akaraDesc).toBeDefined()
    worldPanels.openNpcMenu(101, akaraDesc!, 320, 200)
    expect(worldPanels.npcMenu?.npcName).toBe('阿卡拉')

    // Live language toggle while NPC menu is open updates npcName immediately
    worldPanels.setLanguage('ENG')
    expect(worldPanels.npcMenu?.npcName).toBe('Akara')
    worldPanels.setLanguage('CHI')
    expect(worldPanels.npcMenu?.npcName).toBe('阿卡拉')
  })
})
