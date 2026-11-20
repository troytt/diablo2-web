/**
 * Standalone Browser Entrypoint for the Diablo II v1.13c Trade Hall (`plugins/trade-hall/standalone.ts`).
 */

import {
  HudManager,
  type UiInventoryItem,
} from '../../src/client/plugin-host/api.ts'
import {
  TradeHallController,
  filterTradeRooms,
  getCharClassLabelZh,
  type TradeHallSnapshot,
} from './trade-hall-controller.ts'

declare global {
  interface Window {
    __d2TradeHall?: TradeHallController
  }
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderOfferItemHtml(item: UiInventoryItem): string {
  const qualityClass = `d2-offer-item--${item.quality || 'normal'}`
  const badges: string[] = []
  if (item.ethereal) badges.push('无形 (Eth)')
  if (item.identified === false) badges.push('未鉴定')
  if (item.sockets && item.sockets > 0) {
    badges.push(`凹槽 ${item.usedSockets ?? 0}/${item.sockets}`)
  }
  badges.push(`${item.invWidth}×${item.invHeight}格`)

  const metaParts: string[] = []
  if (item.defense !== undefined && item.defense > 0) {
    metaParts.push(`防御: ${item.defense}`)
  }
  if (item.damage) {
    metaParts.push(item.damage)
  }
  if (item.reqLevel) {
    metaParts.push(`需求等级: ${item.reqLevel}`)
  }

  const statLines = item.stats
    .slice(0, 8)
    .map((s) => `<li>${escapeHtml(s.text)}</li>`)
    .join('')

  return `
    <div class="d2-offer-item ${qualityClass}">
      <div class="d2-offer-item__title">
        <span>${escapeHtml(item.nameZh || item.name)}</span>
        <span style="font-size: 11px; font-weight: 400; color: var(--d2-muted)">${escapeHtml(badges.join(' · '))}</span>
      </div>
      ${
        metaParts.length > 0
          ? `<div class="d2-offer-item__meta">${escapeHtml(metaParts.join(' | '))}</div>`
          : ''
      }
      ${statLines ? `<ul class="d2-offer-item__stats">${statLines}</ul>` : ''}
    </div>
  `
}

function resolveJourneyActiveStep(snap: TradeHallSnapshot): number {
  if (!snap.inGame) {
    return snap.lobby.selectedChar ? 2 : 1
  }
  if (snap.movementStatus.active && snap.movementStatus.kind === 'stash') {
    return 3
  }
  if (snap.stashOpen) {
    return 3
  }
  if (snap.tradeActive) {
    if (snap.selfTradeItems.length > 0 || snap.partnerTradeItems.length > 0 || snap.selfTradeGold > 0 || snap.partnerTradeGold > 0) {
      return 6
    }
    return 5
  }
  if (snap.pendingModal !== null || (snap.movementStatus.active && snap.movementStatus.kind === 'partner')) {
    return 4
  }
  return 4
}

export async function mountTradeHallApp(): Promise<TradeHallController> {
  const hudCanvas = document.getElementById('d2-trade-hud-canvas') as HTMLCanvasElement | null
  const cursorCanvas = document.getElementById('d2-trade-cursor-canvas') as HTMLCanvasElement | null
  if (!hudCanvas || !cursorCanvas) {
    throw new Error('Missing #d2-trade-hud-canvas or #d2-trade-cursor-canvas')
  }

  const hudManager = new HudManager(hudCanvas, undefined, cursorCanvas)
  const controller = new TradeHallController({ hudManager })
  window.__d2TradeHall = controller

  // DOM Elements
  const phaseBadge = document.getElementById('d2-trade-phase-badge')!
  const charBadge = document.getElementById('d2-trade-char-badge')!
  const roomBadge = document.getElementById('d2-trade-room-badge')!
  const goldBadge = document.getElementById('d2-trade-gold-badge')!

  const toggleLobbyBtn = document.getElementById('d2-trade-toggle-lobby-btn') as HTMLButtonElement
  const closeLobbyBtn = document.getElementById('d2-trade-close-lobby-btn') as HTMLButtonElement
  const openStashBtn = document.getElementById('d2-trade-open-stash-btn') as HTMLButtonElement
  const returnCursorBtn = document.getElementById('d2-trade-return-cursor-btn') as HTMLButtonElement
  const reconnectBtn = document.getElementById('d2-trade-reconnect-btn') as HTMLButtonElement
  const leaveBtn = document.getElementById('d2-trade-leave-btn') as HTMLButtonElement

  const movementBanner = document.getElementById('d2-trade-movement-banner')!
  const movementTitle = document.getElementById('d2-trade-movement-title')!
  const movementDetail = document.getElementById('d2-trade-movement-detail')!
  const stageMovingPill = document.getElementById('d2-trade-stage-moving-pill')!

  const diffBanner = document.getElementById('d2-trade-diff-banner')!
  const diffText = document.getElementById('d2-trade-diff-text')!
  const diffDismissBtn = document.getElementById('d2-trade-diff-dismiss-btn') as HTMLButtonElement

  const noticeBanner = document.getElementById('d2-trade-notice-banner')!
  const noticeText = document.getElementById('d2-trade-notice-text')!
  const suggestRoomBtn = document.getElementById('d2-trade-suggest-room-btn') as HTMLButtonElement
  const retryStashBtn = document.getElementById('d2-trade-retry-stash-btn') as HTMLButtonElement

  const lobbyModal = document.getElementById('d2-trade-lobby-modal')!
  const loginForm = document.getElementById('d2-trade-login-form') as HTMLFormElement
  const hostInput = document.getElementById('d2-trade-host-input') as HTMLInputElement
  const userInput = document.getElementById('d2-trade-user-input') as HTMLInputElement
  const passInput = document.getElementById('d2-trade-pass-input') as HTMLInputElement
  const registerBtn = document.getElementById('d2-trade-register-btn') as HTMLButtonElement
  const charListEl = document.getElementById('d2-trade-char-list')!

  const refreshRoomsBtn = document.getElementById('d2-trade-refresh-rooms-btn') as HTMLButtonElement
  const roomSearchInput = document.getElementById('d2-trade-room-search-input') as HTMLInputElement
  const onlyTradeCheckbox = document.getElementById('d2-trade-only-trade-checkbox') as HTMLInputElement
  const roomsListEl = document.getElementById('d2-trade-rooms-list')!

  const roomForm = document.getElementById('d2-trade-room-form') as HTMLFormElement
  const roomNameInput = document.getElementById('d2-trade-room-name-input') as HTMLInputElement
  const roomPwdInput = document.getElementById('d2-trade-room-pwd-input') as HTMLInputElement
  const roomDescInput = document.getElementById('d2-trade-room-desc-input') as HTMLInputElement
  const roomDiffSelect = document.getElementById('d2-trade-room-diff-select') as HTMLSelectElement
  const joinRoomBtn = document.getElementById('d2-trade-join-room-btn') as HTMLButtonElement
  const createRoomBtn = document.getElementById('d2-trade-create-room-btn') as HTMLButtonElement

  const journeyList = document.getElementById('d2-trade-journey-list')!
  const playerCountEl = document.getElementById('d2-trade-player-count')!
  const playersListEl = document.getElementById('d2-trade-players-list')!
  const chatLogEl = document.getElementById('d2-trade-chat-log')!
  const chatForm = document.getElementById('d2-trade-chat-form') as HTMLFormElement
  const chatInput = document.getElementById('d2-trade-chat-input') as HTMLInputElement

  const capacityBadge = document.getElementById('d2-trade-capacity-badge')!
  const capacityDetail = document.getElementById('d2-trade-capacity-detail')!
  const partnerSummary = document.getElementById('d2-trade-partner-summary')!
  const partnerItemsEl = document.getElementById('d2-trade-partner-items')!
  const selfSummary = document.getElementById('d2-trade-self-summary')!
  const selfItemsEl = document.getElementById('d2-trade-self-items')!
  const receiptCountEl = document.getElementById('d2-trade-receipt-count')!
  const receiptsListEl = document.getElementById('d2-trade-receipts-list')!

  let manualLobbyOpen = true

  function renderRoomList(snap: TradeHallSnapshot): void {
    const filtered = filterTradeRooms(
      snap.lobby.games,
      roomSearchInput.value,
      onlyTradeCheckbox.checked,
    )
    if (filtered.length === 0) {
      roomsListEl.innerHTML = `<div style="font-size: 12px; color: var(--d2-muted)">暂无匹配的公开房间，可在下方直接创建新交易房。</div>`
      return
    }
    roomsListEl.innerHTML = filtered
      .map(
        (g) => `
        <div class="d2-trade-list-item">
          <div>
            <strong style="color: var(--d2-gold-bright)">${escapeHtml(g.name)}</strong>
            <span style="color: var(--d2-muted); margin-left: 6px">${escapeHtml(g.description || '无描述')}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px">
            <span style="font-size: 11px; color: var(--d2-muted)">${g.playerCount} 人</span>
            <button type="button" class="d2-trade-btn" data-join-room="${escapeHtml(g.name)}">加入</button>
          </div>
        </div>
      `,
      )
      .join('')
  }

  function renderUI(snap: TradeHallSnapshot): void {
    // 1. Topbar Badges & Buttons
    const phaseLabels: Record<string, string> = {
      idle: '待登录',
      connecting: '正在连接战网...',
      lobby: '战网大厅已连接',
      'entering-game': '正在进入交易房...',
      ingame: '交易房间在线',
      disconnected: '连接已断开',
      error: '连接异常',
    }
    phaseBadge.textContent = phaseLabels[snap.lobby.phase] ?? snap.lobby.phase
    phaseBadge.className = `d2-trade-badge ${snap.inGame ? 'd2-trade-badge--ok' : ''}`

    if (snap.lobby.selectedChar) {
      charBadge.hidden = false
      charBadge.textContent = `角色: ${snap.lobby.selectedChar}`
    } else {
      charBadge.hidden = true
    }

    if (snap.lobby.activeGameName) {
      roomBadge.hidden = false
      roomBadge.textContent = `房间: ${snap.lobby.activeGameName}`
    } else {
      roomBadge.hidden = true
    }

    if (snap.inGame) {
      goldBadge.hidden = false
      goldBadge.textContent = `随身金币: ${snap.selfGold.toLocaleString()} / ${snap.inventoryGoldLimit.toLocaleString()} | 储藏箱金币: ${snap.stashGold.toLocaleString()}`
    } else {
      goldBadge.hidden = true
    }

    openStashBtn.disabled = !snap.inGame || snap.tradeActive || snap.pendingModal !== null
    leaveBtn.disabled = !snap.inGame
    returnCursorBtn.hidden = !snap.cursorItem
    if (snap.cursorItem) {
      returnCursorBtn.textContent = `放回鼠标物品 [${snap.cursorItem.nameZh || snap.cursorItem.name}]`
    }
    reconnectBtn.hidden = snap.inGame || !snap.lastActiveGameName

    // Lobby overlay visibility
    closeLobbyBtn.hidden = !snap.inGame
    lobbyModal.hidden = snap.inGame && !manualLobbyOpen

    // 2. Movement Banner (`正在移动。。。。`)
    if (snap.movementStatus.active) {
      movementBanner.hidden = false
      movementTitle.textContent = snap.movementStatus.title
      movementDetail.textContent = snap.movementStatus.detail
      stageMovingPill.hidden = false
      stageMovingPill.textContent = `${snap.movementStatus.title} ${snap.movementStatus.detail}`
    } else {
      movementBanner.hidden = true
      stageMovingPill.hidden = true
    }

    // 3. Anti-Scam Diff Alert & 5s Red Lockout Banner
    if (snap.tradeDiffAlert || snap.acceptDisabled) {
      diffBanner.hidden = false
      const lockoutSec = Math.ceil(snap.lockoutRemainingMs / 1000)
      const lockoutSuffix = snap.acceptDisabled
        ? `（确认勾号红色防骗锁定中：剩余 ${Math.max(1, lockoutSec)} 秒）`
        : ''
      diffText.textContent =
        (snap.tradeDiffAlert?.summaryText ??
          '防骗保护：交易栏物品刚刚发生变动，确认按钮处于 5 秒红色锁定期。') + lockoutSuffix
    } else {
      diffBanner.hidden = true
    }

    // 4. Notice Banner
    if (snap.notice) {
      noticeBanner.hidden = false
      noticeBanner.className = `d2-trade-banner ${
        snap.notice.level === 'error'
          ? 'd2-trade-banner--danger'
          : snap.notice.level === 'warning'
            ? 'd2-trade-banner--warning'
            : snap.notice.level === 'success'
              ? 'd2-trade-banner--success'
              : ''
      }`
      noticeText.textContent = snap.notice.text
      if (snap.notice.suggestedRoomName) {
        suggestRoomBtn.hidden = false
        suggestRoomBtn.textContent = `改用 "${snap.notice.suggestedRoomName}"`
        suggestRoomBtn.dataset.suggestedName = snap.notice.suggestedRoomName
      } else {
        suggestRoomBtn.hidden = true
      }
      retryStashBtn.hidden = !snap.notice.canRetryStash
    } else {
      noticeBanner.hidden = true
    }

    // 5. Journey Steps
    const activeStep = resolveJourneyActiveStep(snap)
    for (const li of Array.from(journeyList.querySelectorAll<HTMLLIElement>('li[data-step]'))) {
      const stepNum = Number(li.dataset.step)
      li.classList.toggle('d2-journey-step--active', stepNum === activeStep)
      li.classList.toggle('d2-journey-step--done', stepNum < activeStep)
    }

    // 6. Character List & Room Browser in Lobby Modal
    const hasLobby = snap.lobby.phase === 'lobby' || snap.inGame
    refreshRoomsBtn.disabled = !hasLobby
    joinRoomBtn.disabled = !hasLobby || !snap.lobby.selectedChar
    createRoomBtn.disabled = !hasLobby || !snap.lobby.selectedChar

    if (snap.lobby.characters.length > 0) {
      charListEl.innerHTML = snap.lobby.characters
        .map((c) => {
          const isSelected = c.name === snap.lobby.selectedChar
          return `
            <div class="d2-trade-list-item" style="${isSelected ? 'border-color: var(--d2-gold-bright); background: rgba(199,179,119,0.12)' : ''}">
              <div>
                <strong style="color: var(--d2-gold-bright)">${escapeHtml(c.name)}</strong>
                <span style="color: var(--d2-muted); margin-left: 6px">Lv.${c.level} ${escapeHtml(getCharClassLabelZh(c.charClass))}</span>
              </div>
              <button type="button" class="d2-trade-btn ${isSelected ? 'd2-trade-btn--primary' : ''}" data-select-char="${escapeHtml(c.name)}">
                ${isSelected ? '已选择' : '选择角色'}
              </button>
            </div>
          `
        })
        .join('')
    }

    renderRoomList(snap)

    // 7. Room Players Roster
    playerCountEl.textContent = `${snap.roomPlayers.length} 人`
    if (!snap.inGame) {
      playersListEl.innerHTML = `<div style="font-size: 12px; color: var(--d2-muted)">进入交易房间后将在此显示同房玩家。</div>`
    } else if (snap.roomPlayers.length === 0) {
      playersListEl.innerHTML = `<div style="font-size: 12px; color: var(--d2-muted)">当前房间暂无其他玩家，等待交易伙伴加入...</div>`
    } else {
      playersListEl.innerHTML = snap.roomPlayers
        .map((p) => {
          const distLabel = p.distanceSubTiles !== null ? `距离 ${p.distanceSubTiles}` : '同城'
          const statusLabel = p.inTown ? `罗格营地 · ${distLabel}` : '城外区域'
          const btnLabel = p.inTown ? '发起交易' : '私聊邀回城'
          return `
            <div class="d2-trade-list-item">
              <div>
                <strong style="color: var(--d2-gold-bright)">${escapeHtml(p.name)}</strong>
                <div style="font-size: 11px; color: var(--d2-muted)">
                  Lv.${p.level} ${escapeHtml(p.classLabelZh)} · ${escapeHtml(statusLabel)}
                </div>
              </div>
              <button type="button" class="d2-trade-btn d2-trade-btn--primary" data-trade-player="${p.unitId}">
                ${btnLabel}
              </button>
            </div>
          `
        })
        .join('')
    }

    // 8. Right Sidebar: Capacity Pre-Check & Live Offer Affix Inspector
    const cap = snap.capacityEvaluation
    if (cap.blockingReasons.length === 0) {
      capacityBadge.className = 'd2-trade-badge d2-trade-badge--ok'
      capacityBadge.textContent = '可安全接收'
      capacityDetail.textContent = `随身背包 (10×4) 空间与角色金币上限 (${cap.inventoryGoldLimit.toLocaleString()}) 均满足对方当前报价。`
    } else {
      capacityBadge.className = 'd2-trade-badge'
      capacityBadge.style.color = '#ffd0d0'
      capacityBadge.style.borderColor = 'var(--d2-danger)'
      capacityBadge.textContent = '容量不足预警'
      capacityDetail.textContent = cap.blockingReasons.join('；')
    }

    partnerSummary.textContent = `${snap.partnerName ? `${snap.partnerName} · ` : ''}金币: ${snap.partnerTradeGold.toLocaleString()} ${snap.partnerAccepted ? '· [对方已点勾]' : ''}`
    if (snap.partnerTradeItems.length === 0) {
      partnerItemsEl.innerHTML = `<div style="font-size: 12px; color: var(--d2-muted)">暂无对方放入的交易物品。</div>`
    } else {
      partnerItemsEl.innerHTML = snap.partnerTradeItems.map(renderOfferItemHtml).join('')
    }

    selfSummary.textContent = `金币: ${snap.selfTradeGold.toLocaleString()} ${snap.selfAccepted ? '· [我方已点勾]' : ''}`
    if (snap.selfTradeItems.length === 0) {
      selfItemsEl.innerHTML = `<div style="font-size: 12px; color: var(--d2-muted)">暂无我方放入的交易物品。</div>`
    } else {
      selfItemsEl.innerHTML = snap.selfTradeItems.map(renderOfferItemHtml).join('')
    }

    // 9. Completed Trade Receipts
    receiptCountEl.textContent = `${snap.tradeReceipts.length} 笔`
    if (snap.tradeReceipts.length === 0) {
      receiptsListEl.innerHTML = `<div style="font-size: 12px; color: var(--d2-muted)">双方点击确认勾号完成交易后，将在此生成双边物品与词条流水记录。</div>`
    } else {
      receiptsListEl.innerHTML = snap.tradeReceipts
        .map(
          (r) => `
          <div class="d2-offer-item">
            <div class="d2-offer-item__title">
              <span style="color: var(--d2-gold-bright)">与 ${escapeHtml(r.partnerName)} 完成交易</span>
              <span style="font-size: 11px; color: var(--d2-muted)">房间 ${escapeHtml(r.roomName)}</span>
            </div>
            <div class="d2-offer-item__meta">
              收到: ${r.receivedItems.map((i) => escapeHtml(i.nameZh)).join('、') || '无物品'} (金币 +${r.receivedGold.toLocaleString()})
            </div>
            <div class="d2-offer-item__meta">
              付出: ${r.givenItems.map((i) => escapeHtml(i.nameZh)).join('、') || '无物品'} (金币 -${r.givenGold.toLocaleString()})
            </div>
          </div>
        `,
        )
        .join('')
    }
  }

  // Event Listeners
  controller.onChange((snap) => {
    if (snap.inGame && snap.movementStatus.active) {
      manualLobbyOpen = false
    }
    renderUI(snap)
  })

  controller.onChatMessage((entry) => {
    const div = document.createElement('div')
    div.textContent = entry.text
    if (entry.kind === 'whisper') {
      div.style.color = '#52e069'
    } else if (entry.kind === 'system') {
      div.style.color = 'var(--d2-gold)'
    }
    chatLogEl.appendChild(div)
    chatLogEl.scrollTop = chatLogEl.scrollHeight
  })

  toggleLobbyBtn.addEventListener('click', () => {
    manualLobbyOpen = !lobbyModal.hidden ? false : true
    lobbyModal.hidden = !manualLobbyOpen
  })

  closeLobbyBtn.addEventListener('click', () => {
    manualLobbyOpen = false
    lobbyModal.hidden = true
  })

  openStashBtn.addEventListener('click', () => {
    controller.beginAutoMoveToAct1Stash()
  })

  returnCursorBtn.addEventListener('click', () => {
    controller.returnCursorItemToSafety()
  })

  reconnectBtn.addEventListener('click', () => {
    void controller.reconnectLastTradeRoom().catch(() => {})
  })

  leaveBtn.addEventListener('click', () => {
    manualLobbyOpen = true
    void controller.leaveTradeRoom()
  })

  diffDismissBtn.addEventListener('click', () => {
    controller.clearTradeDiffAlert()
  })

  suggestRoomBtn.addEventListener('click', () => {
    const suggested = suggestRoomBtn.dataset.suggestedName
    if (suggested) {
      roomNameInput.value = suggested
      controller.setNotice(null)
    }
  })

  retryStashBtn.addEventListener('click', () => {
    controller.setNotice(null)
    controller.beginAutoMoveToAct1Stash()
  })

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const loginUser = userInput.value.trim()
    if (roomSearchInput.value.trim() === loginUser) {
      roomSearchInput.value = ''
    }
    void controller
      .login({
        host: hostInput.value.trim() || 'www.laiseek.xyz',
        username: loginUser,
        password: passInput.value,
      })
      .then(() => controller.listTradeRooms())
      .catch(() => {})
  })

  registerBtn.addEventListener('click', () => {
    const loginUser = userInput.value.trim()
    if (!loginUser || !passInput.value) return
    if (roomSearchInput.value.trim() === loginUser) {
      roomSearchInput.value = ''
    }
    void controller
      .createAccountAndLogin({
        host: hostInput.value.trim() || 'www.laiseek.xyz',
        username: loginUser,
        password: passInput.value,
      })
      .then(() => controller.listTradeRooms())
      .catch(() => {})
  })

  charListEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-select-char]')
    if (!btn || !btn.dataset.selectChar) return
    void controller
      .selectCharacter(btn.dataset.selectChar)
      .then(() => controller.listTradeRooms())
      .catch(() => {})
  })

  refreshRoomsBtn.addEventListener('click', () => {
    void controller.listTradeRooms().catch(() => {})
  })

  roomSearchInput.addEventListener('input', () => {
    renderRoomList(controller.getSnapshot())
  })

  onlyTradeCheckbox.addEventListener('change', () => {
    renderRoomList(controller.getSnapshot())
  })

  roomsListEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-join-room]')
    if (!btn || !btn.dataset.joinRoom) return
    roomNameInput.value = btn.dataset.joinRoom
    manualLobbyOpen = false
    void controller.joinTradeRoom(btn.dataset.joinRoom, roomPwdInput.value).catch(() => {
      manualLobbyOpen = true
      renderUI(controller.getSnapshot())
    })
  })

  joinRoomBtn.addEventListener('click', () => {
    const name = roomNameInput.value.trim()
    if (!name) return
    manualLobbyOpen = false
    void controller.joinTradeRoom(name, roomPwdInput.value).catch(() => {
      manualLobbyOpen = true
      renderUI(controller.getSnapshot())
    })
  })

  roomForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const name = roomNameInput.value.trim()
    if (!name) return
    const diff = Number(roomDiffSelect.value) as 0 | 1 | 2
    manualLobbyOpen = false
    void controller
      .createTradeRoom({
        name,
        password: roomPwdInput.value,
        description: roomDescInput.value.trim(),
        difficulty: diff,
        maxPlayers: 8,
      })
      .catch(() => {
        manualLobbyOpen = true
        renderUI(controller.getSnapshot())
      })
  })

  playersListEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-trade-player]')
    if (!btn || !btn.dataset.tradePlayer) return
    const unitId = Number.parseInt(btn.dataset.tradePlayer, 10)
    if (Number.isFinite(unitId) && unitId > 0) {
      controller.requestTradeWithPlayer(unitId)
    }
  })

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const raw = chatInput.value.trim()
    if (!raw) return
    if (controller.session.phase === 'ingame') {
      controller.session.submitChatInput(raw)
    } else if (controller.session.phase === 'lobby') {
      void controller.session.sendLobbyChat(raw).catch(() => {})
    }
    chatInput.value = ''
  })

  await controller.init('/ui')
  renderUI(controller.getSnapshot())

  // 25Hz simulation + rAF HUD canvas render loop
  let lastFrameMs = performance.now()
  let tickAccumMs = 0
  const frameLoop = (nowMs: number) => {
    const dtMs = Math.min(200, Math.max(0, nowMs - lastFrameMs))
    lastFrameMs = nowMs
    tickAccumMs += dtMs
    while (tickAccumMs >= 40) {
      controller.tick(40, nowMs)
      tickAccumMs -= 40
    }
    controller.hudManager.render(nowMs, false)
    requestAnimationFrame(frameLoop)
  }
  requestAnimationFrame(frameLoop)

  return controller
}

if (typeof document !== 'undefined' && document.getElementById('d2-trade-hud-canvas')) {
  void mountTradeHallApp()
}
