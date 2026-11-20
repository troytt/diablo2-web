import { describe, expect, it } from 'vitest'
import {
  applyRealmGamesToFlowState,
  confirmCharacterSelect,
  createInitialFlowState,
  dismissPopupModal,
  formatJoinGameDetailLines,
  getRecentRealmGameNames,
  isRealmGameInfoOpen,
  isRealmGameStatusCompatibleWithCharacter,
  JOIN_GAME_LIST_REFRESH_INTERVAL_MS,
  openPopupModal,
  recordRecentRealmGameName,
  removeRecentRealmGameName,
  resetLobbyGameFormState,
} from '../../src/client/frontend/flow-state.ts'
import {
  formatBnetLoginError,
  formatCharacterActionError,
  formatCharacterCreateError,
  formatLobbyGameEnterError,
  formatLoginScreenErrorForDisplay,
  formatMcpCreateGameStatusError,
  formatMcpJoinGameStatusError,
  isRawTechnicalErrorString,
  parseMcpGameErrorStatus,
} from '../../src/client/session/active-char-lock.ts'

describe('Lobby Join Game list population, selection preservation & refresh interval (#931)', () => {
  it('defines 1.13c D2Multi.dll (0x6f9ddf3b) 15,000 ms (0x3a98) refresh interval', () => {
    expect(JOIN_GAME_LIST_REFRESH_INTERVAL_MS).toBe(15_000)
  })

  it('formats MCP_GAMEINFO (0x06) details when live d2cs returns non-zero open game status bitmask (0x00300004)', () => {
    const lines = formatJoinGameDetailLines({
      name: 'j931o9zn',
      status: 0x00300004,
      uptimeSec: 65,
      creatorLevel: 1,
      levelDiff: 0xff,
      maxPlayers: 8,
      description: 'issue 931 verify',
      players: [{ name: 'WebBotOne', charClass: 1, level: 1 }],
    })
    expect(lines).toEqual([
      { text: 'issue 931 verify', color: 0 },
      { text: '', color: 0 },
      { text: 'Elapsed Time: 0:01:05', color: 0 },
      { text: '', color: 0 },
      { text: 'WebBotOne', color: 0 },
      { text: 'Level 1 Sorceress', color: 5 },
    ])

    // Closed game status without GAME_STAT_OPEN (0x04) returns empty lines
    expect(
      formatJoinGameDetailLines({
        name: 'closed1',
        status: 0x00300000,
        uptimeSec: 10,
        maxPlayers: 8,
        players: [],
      }),
    ).toEqual([])
  })

  it('decodes MCP_GAMEINFO (0x06) 0-based classes without clamping >= 7 to Assassin and formats charClass > 6 as "Level %d" per D2Multi.dll 0x6f9e33ed (#1764)', async () => {
    const { ByteWriter } = await import('../../src/netproto/core/byte-writer.ts')
    const { decodeMcpS2cPacket, McpOpcode } = await import('../../src/netproto/mcp/packets.ts')
    const w = new ByteWriter()
    w.u16LE(7) // requestId
    w.u32LE(0x00300004) // status (open)
    w.u32LE(120) // uptimeSec
    w.u8(50) // creatorLevel
    w.u8(0xff) // levelDiff
    w.u8(8) // maxPlayers
    w.u8(3) // count
    const classes = new Uint8Array(16)
    classes[0] = 0 // Amazon (0-based)
    classes[1] = 6 // Assassin (0-based)
    classes[2] = 7 // Out-of-range (> 6) -> must NOT be clamped to 6 (Assassin)
    w.bytes(classes)
    const levels = new Uint8Array(16)
    levels[0] = 80
    levels[1] = 85
    levels[2] = 90
    w.bytes(levels)
    w.cstring('Test Desc')
    w.cstring('AmaHero')
    w.cstring('AsnHero')
    w.cstring('MysteryHero')

    const payload = w.toUint8Array()
    const decoded = decodeMcpS2cPacket({ id: McpOpcode.MCP_GAMEINFO, payload, raw: payload })
    expect(decoded.type).toBe('MCP_GAMEINFO')
    if (decoded.type === 'MCP_GAMEINFO') {
      expect(decoded.info.players).toEqual([
        { name: 'AmaHero', charClass: 0, level: 80 },
        { name: 'AsnHero', charClass: 6, level: 85 },
        { name: 'MysteryHero', charClass: 7, level: 90 },
      ])
      const lines = formatJoinGameDetailLines({
        ...decoded.info,
        name: 'test-room',
      })
      expect(lines.slice(-6)).toEqual([
        { text: 'AmaHero', color: 0 },
        { text: 'Level 80 Amazon', color: 5 },
        { text: 'AsnHero', color: 0 },
        { text: 'Level 85 Assassin', color: 5 },
        { text: 'MysteryHero', color: 0 },
        { text: 'Level 90', color: 5 },
      ])
    }
  })

  it('retains open 0-player rooms (GAME_STAT_OPEN = 0x04), skips closed rooms, and auto-selects the first game', () => {
    const st = createInitialFlowState()
    st.stage = 'bnet_lobby'
    st.lobbySubPanel = 'join'
    st.gameName = ''
    st.selectedGameName = ''

    const res = applyRealmGamesToFlowState(st, [
      { index: 1, name: 'ClosedRoom', description: '', playerCount: 2, status: 0x00300000 },
      { index: 2, name: 'BaalRun01', description: 'fast', playerCount: 4, status: 0x00302004 },
      { index: 3, name: 'EmptyOpenRoom', description: 'idle', playerCount: 0, status: 0x00300004 },
      { index: 4, name: 'Tristram02', description: 'walk', playerCount: 2, status: 0x00300004 },
    ])

    expect(st.realmGames).toHaveLength(3)
    expect(st.realmGames.map((g) => `${g.name}:${g.playerCount}`)).toEqual([
      'BaalRun01:4',
      'EmptyOpenRoom:0',
      'Tristram02:2',
    ])
    expect(st.selectedGameName).toBe('BaalRun01')
    expect(st.gameName).toBe('BaalRun01')
    expect(res).toEqual({
      selectedGameName: 'BaalRun01',
      shouldFetchGameInfo: true,
    })
  })

  it('preserves selectedGameName across refreshes per D2Multi.dll (0x6f9e1f80) and avoids flicker during streaming', () => {
    const st = createInitialFlowState()
    st.stage = 'bnet_lobby'
    st.lobbySubPanel = 'join'

    applyRealmGamesToFlowState(st, [
      { index: 10, name: 'GameAlpha', description: 'a', playerCount: 1, status: 0x00300004 },
      { index: 11, name: 'GameBeta', description: 'b', playerCount: 2, status: 0x00302004 },
    ])

    // User clicks GameBeta
    st.selectedGameName = 'GameBeta'
    st.gameName = 'GameBeta'

    // Periodic refresh starts: first packet only has GameAlpha so far (finalized: false)
    const midRes = applyRealmGamesToFlowState(
      st,
      [{ index: 10, name: 'GameAlpha', description: 'a', playerCount: 3, status: 0x00300004 }],
      { finalized: false },
    )
    expect(st.realmGames.map((g) => `${g.name}:${g.playerCount}`)).toEqual([
      'GameAlpha:3',
      'GameBeta:2',
    ])
    expect(st.selectedGameName).toBe('GameBeta')
    expect(midRes.shouldFetchGameInfo).toBe(false)

    // Refresh completes with both games (finalized: true)
    const finalRes = applyRealmGamesToFlowState(
      st,
      [
        { index: 10, name: 'GameAlpha', description: 'a', playerCount: 3, status: 0x00300004 },
        { index: 11, name: 'GameBeta', description: 'b', playerCount: 5, status: 0x00302004 },
      ],
      { finalized: true },
    )
    expect(st.realmGames.map((g) => `${g.name}:${g.playerCount}`)).toEqual([
      'GameAlpha:3',
      'GameBeta:5',
    ])
    expect(st.selectedGameName).toBe('GameBeta')
    expect(st.gameName).toBe('GameBeta')
    expect(finalRes.shouldFetchGameInfo).toBe(true)
  })

  it('clears vanished selectedGameName on finalized refresh and selects remaining first game unless user typed custom gameName', () => {
    const st = createInitialFlowState()
    st.stage = 'bnet_lobby'
    st.lobbySubPanel = 'join'
    st.selectedGameName = 'OldClosedGame'
    st.gameName = 'OldClosedGame'

    const res = applyRealmGamesToFlowState(
      st,
      [{ index: 20, name: 'NewOpenGame', description: 'fresh', playerCount: 1, status: 0x00300004 }],
      { finalized: true },
    )
    expect(st.selectedGameName).toBe('NewOpenGame')
    expect(st.gameName).toBe('NewOpenGame')
    expect(res.shouldFetchGameInfo).toBe(true)

    // When user manually typed a custom gameName (selectedGameName === ''), refresh does not overwrite gameName
    st.selectedGameName = ''
    st.gameName = 'CustomPrivate1'
    const customRes = applyRealmGamesToFlowState(
      st,
      [{ index: 20, name: 'NewOpenGame', description: 'fresh', playerCount: 2, status: 0x00300004 }],
      { finalized: true },
    )
    expect(st.selectedGameName).toBe('')
    expect(st.gameName).toBe('CustomPrivate1')
    expect(customRes.shouldFetchGameInfo).toBe(false)

    // When the typed gameName matches a room in the refreshed list, it selects that room and fetches details
    const matchedRes = applyRealmGamesToFlowState(
      st,
      [
        { index: 20, name: 'NewOpenGame', description: 'fresh', playerCount: 2, status: 0x00300004 },
        { index: 21, name: 'customprivate1', description: 'found', playerCount: 0, status: 0x00300004 },
      ],
      { finalized: true },
    )
    expect(st.selectedGameName).toBe('customprivate1')
    expect(st.gameName).toBe('customprivate1')
    expect(matchedRes.shouldFetchGameInfo).toBe(true)
  })

  it('resets stale gameName and gamePassword when entering bnet_lobby via confirmCharacterSelect / resetLobbyGameFormState', () => {
    const st = createInitialFlowState()
    st.stage = 'char_select'
    st.playMode = 'bnet'
    st.roster = [
      {
        id: 'char-1',
        name: 'VerifyPlayBot',
        classId: 'so',
        heroToken: 'so',
        className: 'Sorceress',
        level: 18,
        isExpansion: true,
        isHardcore: false,
        isLadder: true,
        createdAt: 0,
      },
    ]
    st.selectedSlotIndex = 0
    st.gameName = '1'
    st.gamePassword = 'secret'
    st.gameDescription = 'old desc'
    st.selectedGameName = '1'

    expect(confirmCharacterSelect(st)).toBe(true)
    expect(st.stage).toBe('bnet_lobby')
    expect(st.lobbySubPanel).toBe('create')
    expect(st.gameName).toBe('')
    expect(st.gamePassword).toBe('')
    expect(st.gameDescription).toBe('')
    expect(st.selectedGameName).toBe('')
    expect(st.selectedGameInfo).toBeNull()

    st.gameName = 'room2'
    st.gamePassword = 'pw2'
    resetLobbyGameFormState(st)
    expect(st.gameName).toBe('')
    expect(st.gamePassword).toBe('')
  })

  it('tracks recent realm room names and validates open status & character mode compatibility', () => {
    const host = 'test-realm.example.com'
    const now = 1_700_000_000_000
    recordRecentRealmGameName('1', host, now)
    recordRecentRealmGameName('BaalRun', host, now + 100)
    expect(getRecentRealmGameNames(host, now + 200)).toEqual(['BaalRun', '1'])

    removeRecentRealmGameName('1', host, now + 300)
    expect(getRecentRealmGameNames(host, now + 400)).toEqual(['BaalRun'])

    expect(
      isRealmGameInfoOpen({
        name: '1',
        status: 0x00300004,
        uptimeSec: 703,
        maxPlayers: 8,
        players: [],
      }),
    ).toBe(true)
    expect(
      isRealmGameInfoOpen({
        name: 'missing',
        status: 0xffffffff,
        uptimeSec: 0,
        maxPlayers: 0,
        players: [],
      }),
    ).toBe(false)

    // Softcore Expansion character matches status 0x00300004 (Expansion | Ladder | Open)
    expect(
      isRealmGameStatusCompatibleWithCharacter(0x00300004, {
        isHardcore: false,
        isExpansion: true,
      }),
    ).toBe(true)
    // Hardcore character does not match Softcore game 0x00300004
    expect(
      isRealmGameStatusCompatibleWithCharacter(0x00300004, {
        isHardcore: true,
        isExpansion: true,
      }),
    ).toBe(false)
  })

  it('translates MCP_JOINGAME (0x04) and MCP_CREATEGAME (0x03) status codes to authentic 1.13c .tbl strings', () => {
    const err29 = new Error('[ProtocolError conn=mcp packet=0x04] MCP_JOINGAME failed for "1" with status=0x29')
    expect(parseMcpGameErrorStatus(err29)).toEqual({ kind: 'join', status: 0x29 })
    expect(formatLobbyGameEnterError(err29, 'Hero', 'zh')).toBe('遊戲名稱及密碼不符。')
    expect(formatLobbyGameEnterError(err29, 'Hero', 'en')).toBe("Game name and password don't match.")

    expect(formatMcpJoinGameStatusError(0x2a, 'zh')).toBe('遊戲並不存在。')
    expect(formatMcpJoinGameStatusError(0x2a, 'en')).toBe('Game does not exist.')
    expect(formatMcpJoinGameStatusError(0x2b, 'zh')).toBe('遊戲人數已滿。')
    expect(formatMcpJoinGameStatusError(0x2c, 'zh')).toBe('你未達到這個遊戲的等級限制。')
    expect(formatMcpJoinGameStatusError(0x71, 'zh')).toBe('專家級和一般級人物不能在同一個遊戲中。')
    expect(formatMcpJoinGameStatusError(0x73, 'zh')).toBe(
      '無法進入遊戲。你的人物必須殺死巴爾才能進入惡夢級的遊戲。',
    )
    expect(formatMcpJoinGameStatusError(0x74, 'zh')).toBe(
      '無法進入遊戲。你的人物必須殺死惡夢級的巴爾才能進入地獄級的遊戲。',
    )
    expect(formatMcpJoinGameStatusError(0x78, 'zh')).toBe(
      '無法進入遊戲。暗黑破壞神 II 的人物無法加入由資料片人物所開創的遊戲。',
    )
    expect(formatMcpJoinGameStatusError(0x79, 'zh')).toBe(
      '無法進入遊戲。資料片的人物無法加入由暗黑破壞神 II 人物所開創的遊戲。',
    )
    expect(formatMcpJoinGameStatusError(0x7d, 'zh')).toBe(
      '無法進入遊戲。非天梯人物無法加入由天梯人物所開創的遊戲。',
    )
    expect(formatMcpJoinGameStatusError(0xff, 'zh')).toBe('加入失敗')

    const err1f = new Error('[ProtocolError conn=mcp packet=0x03] MCP_CREATEGAME failed for "1" with status=0x1f')
    expect(parseMcpGameErrorStatus(err1f)).toEqual({ kind: 'create', status: 0x1f })
    expect(formatLobbyGameEnterError(err1f, 'Hero', 'zh')).toBe('已經有相同名稱的遊戲存在')
    expect(formatLobbyGameEnterError(err1f, 'Hero', 'en')).toBe('A Game Already Exists With That Name')
    expect(formatMcpCreateGameStatusError(0x1e, 'zh')).toBe('無效的遊戲名稱')
    expect(formatMcpCreateGameStatusError(0x20, 'zh')).toBe('伺服器停機')
    expect(formatMcpCreateGameStatusError(0x99, 'zh')).toBe('開創遊戲錯誤')
  })

  it('intercepts raw protocol/code error strings across login, character, and lobby screens (#72)', () => {
    // 1. BNCS SID_LOGONRESPONSE2 (0x3A)
    const errAcctMissing = new Error(
      '[ProtocolError bncs#0x3a] BNCS SID_LOGONRESPONSE2 failed for "ghost" with status=0x1',
    )
    expect(formatBnetLoginError(errAcctMissing, 'zh')).toContain('這個帳戶並不存在')
    expect(formatBnetLoginError(errAcctMissing, 'en')).toContain('That account does not exist.')

    const errBadPass = new Error(
      '[ProtocolError bncs#0x3a] BNCS SID_LOGONRESPONSE2 failed for "hero" with status=0x2',
    )
    expect(formatBnetLoginError(errBadPass, 'zh')).toBe('你所輸入的密碼並不正確，請重試一次。')
    expect(formatBnetLoginError(errBadPass, 'en')).toBe(
      'The password you have entered is incorrect. Please try again.',
    )

    // 2. MCP_CHARCREATE (0x02)
    const errCharTaken = new Error(
      '[ProtocolError mcp#0x02] MCP_CHARCREATE failed for "Hero" with status=0x14',
    )
    expect(formatCharacterCreateError(errCharTaken, 'zh')).toBe(
      '這個人物的名稱已經有人使用了，請輸入另一個名字。',
    )
    expect(formatCharacterCreateError(errCharTaken, 'en')).toBe(
      'That character name is already taken. Try another.',
    )

    const errCharIllegal = new Error(
      '[ProtocolError mcp#0x02] MCP_CHARCREATE failed for "Hero!" with status=0x15',
    )
    expect(formatCharacterCreateError(errCharIllegal, 'zh')).toBe(
      '你的使用者名稱包括了一個或一個以上的非法字元。',
    )

    // 3. MCP_CHARLOGON (0x07) & MCP_CHARDELETE (0x0A)
    const errCharNotFound = new Error(
      '[ProtocolError mcp#0x07] MCP_CHARLOGON failed for "Hero" with status=0x46',
    )
    expect(formatCharacterActionError(errCharNotFound, 'logon', 'zh')).toBe('找不到玩者')
    expect(formatCharacterActionError(errCharNotFound, 'logon', 'en')).toBe('Player Not Found')

    const errCharExpired = new Error(
      '[ProtocolError mcp#0x07] MCP_CHARLOGON failed for "Hero" with status=0x7b',
    )
    expect(formatCharacterActionError(errCharExpired, 'logon', 'zh')).toBe('人物失效')
    expect(formatCharacterActionError(errCharExpired, 'logon', 'en')).toBe('Character Expired')

    // 4. Raw technical strings & difficulty lock in lobby
    const errDiffLocked = new Error(
      'Difficulty "nightmare" is not unlocked for character "Hero" (progression=0)',
    )
    expect(formatLobbyGameEnterError(errDiffLocked, 'Hero', 'zh')).toBe(
      '無法進入遊戲。你的人物必須殺死巴爾才能進入惡夢級的遊戲。',
    )
    const errHandshake = new Error(
      '[ProtocolError d2gs#0x68] D2GS handshake failed (state=waitCharInfo)',
    )
    expect(isRawTechnicalErrorString(errHandshake.message)).toBe(true)
    expect(formatLobbyGameEnterError(errHandshake, 'Hero', 'zh')).toBe('加入失敗')
    expect(formatLobbyGameEnterError(errHandshake, 'Hero', 'en')).toBe('Join Failed')

    // 5. Session-loss technical suffix stripping on bnet_login
    expect(
      formatLoginScreenErrorForDisplay(
        'Your connection to Battle.net has been lost. (BNCS connection closed)',
        'zh',
      ),
    ).toBe('你和battle.net的連線已經中斷了。')
    expect(
      formatLoginScreenErrorForDisplay(
        'Timed out waiting for response. (BNCS SID_LOGONREALMEX (0x3e) timed out after 10000ms)',
        'zh',
      ),
    ).toBe('等候回應時間超過。')

    // 6. Dismissing popupModal clears residual error fields
    const st = createInitialFlowState()
    st.stage = 'bnet_lobby'
    st.createGameError = '已經有相同名稱的遊戲存在'
    st.lastError = '已經有相同名稱的遊戲存在'
    openPopupModal(st, '已經有相同名稱的遊戲存在', 'bnet_lobby')
    dismissPopupModal(st)
    expect(st.popupModal).toBeNull()
    expect(st.createGameError).toBeNull()
    expect(st.lastError).toBeNull()
  })
})
