import { describe, expect, it } from 'vitest'
import {
  applyRealmGamesToFlowState,
  confirmCharacterSelect,
  createInitialFlowState,
  formatJoinGameDetailLines,
  getRecentRealmGameNames,
  isRealmGameInfoOpen,
  isRealmGameStatusCompatibleWithCharacter,
  JOIN_GAME_LIST_REFRESH_INTERVAL_MS,
  recordRecentRealmGameName,
  removeRecentRealmGameName,
  resetLobbyGameFormState,
} from '../../src/client/frontend/flow-state.ts'
import {
  formatLobbyGameEnterError,
  formatMcpCreateGameStatusError,
  formatMcpJoinGameStatusError,
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
})
