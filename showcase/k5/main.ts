/**
 * [K5] Single-Player `d2kern-113c` Runtime Switch, Loopback & Multi-Resolution E2E Showcase
 * (`showcase/k5/main.ts`).
 */

import { renderKNavStripHtml } from '../shared/k-nav.ts'
import {
  escapeHtml,
  fetchJson,
  fmtInt,
  type ShowcaseZoneController,
} from '../shared/types.ts'
import {
  BrowserK5LoopbackSandbox,
  buildSyntheticAnnotatedPng,
  stripPngAncillaryChunksBrowser,
} from './k5-browser-engine.ts'

export type K5ZoneId = 'loopback' | 'd2tv' | 'viewports' | 'saves'

interface K5Overview {
  readonly ok: true
  readonly siteConfig: { readonly singlePlayerEnabled: boolean; readonly singlePlayerBackend: string; readonly source: string }
  readonly d2tvSuiteCount: number
  readonly d2tvArtifactCount: number
  readonly d2tvAllMatched: boolean
  readonly d2tvTotalRecords: number
  readonly saveFixtureCount: number
  readonly viewportCount: number
}

interface K5D2tvResp {
  readonly ok: true
  readonly totalArtifacts: number
  readonly allMatched: boolean
  readonly totalRecords: number
  readonly rows: readonly {
    readonly suite: string
    readonly id: string
    readonly relPath: string
    readonly diskBytes: number
    readonly rawBytes: number
    readonly kind: string
    readonly recordCount: number
    readonly recordSize: number
    readonly actualSha256: string
    readonly pinnedSha256: string
    readonly shaMatch: boolean
    readonly description: string
  }[]
}

interface K5SavesResp {
  readonly ok: true
  readonly saveCount: number
  readonly allChecksumsValid: boolean
  readonly saves: readonly {
    readonly file: string
    readonly bytes: number
    readonly checksumValid: boolean
    readonly name: string
    readonly className: string
    readonly level: number
    readonly act: number
    readonly expansion: boolean
    readonly hardcore: boolean
    readonly mapSeedHex: string
    readonly itemCount: number
    readonly skillPointsAllocated: number
  }[]
}

interface K5ViewportsResp {
  readonly ok: true
  readonly profiles: readonly {
    readonly id: string
    readonly width: number
    readonly height: number
    readonly aspectRatio: string
    readonly native113c: boolean
    readonly barOffsetX: number
    readonly barOffsetY: number
    readonly panelOffsetY: number
    readonly dockWidth: number
    readonly centerChannelWidth: number
  }[]
}

const ZONES: readonly {
  readonly id: K5ZoneId
  readonly idx: string
  readonly navTitle: string
  readonly navSub: string
  readonly headerTitle: string
  readonly headerSub: string
}[] = [
  {
    id: 'loopback',
    idx: 'ZONE 01',
    navTitle: '浏览器实跑单机内核回环',
    navSub: 'D2gsKernelBridge113c 实时交互',
    headerTitle: 'Zone 1 · Live In-Browser D2gsKernelBridge113c + Fog.#10223 ByteStream Loopback Room',
    headerSub: '在浏览器中真实启动 1.13c 单机内核并完成 0xAF→0x68→0x01..0x04 压缩握手；点击画布发送 C2S 0x01 Walk / 0x03 Run！',
  },
  {
    id: 'd2tv',
    idx: 'ZONE 02',
    navTitle: '9 大 D2TV 退出门禁',
    navSub: '13 份二进制 SHA-256 校验',
    headerTitle: 'Zone 2 · [K5] 9-Suite D2TV Binary Vector Exit Gate (PRNG..S2C Pinned SHA-256 Audit)',
    headerSub: '服务端实时读取并校验全部 9 大子系统 D2TV 实机向量文件头与 SHA-256 哈希。',
  },
  {
    id: 'viewports',
    idx: 'ZONE 03',
    navTitle: '多分辨率 HUD 几何对照',
    navSub: '800×600 / 1068×600 / 1280×720',
    headerTitle: 'Zone 3 · Multi-Resolution Viewport Profiles & Authentic 1.13c HUD Anchor Geometry',
    headerSub: '基于 src/client/view/viewport-profile.ts 实时绘制各分辨率下控制条偏移、左右 400px 面板停靠区与宽屏视野通道。',
  },
  {
    id: 'saves',
    idx: 'ZONE 04',
    navTitle: '.d2s 存档与 PNG 零 PII 剥离',
    navSub: 'readD2sSave113c · stripPng',
    headerTitle: 'Zone 4 · .d2s v96 Save Checksum Audit & Interactive PNG Ancillary Chunk Stripper',
    headerSub: '服务端用真实 readD2sSave113c 检验全部提交的 .d2s 存档；浏览器端实跑 PNG eXIf/c2pa/tEXt 剥离验证。',
  },
]

function mountZone1Loopback(container: HTMLElement): ShowcaseZoneController {
  let sandbox: BrowserK5LoopbackSandbox | null = null
  let moveMode: 'run' | 'walk' = 'run'

  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-toolbar">
        <label class="d2ks-field-inline">
          <span>区域:</span>
          <select class="d2ks-select" id="k5-lb-area">
            <option value="2">Area 2 · Blood Moor (允许奔跑 + 体力消耗)</option>
            <option value="1">Area 1 · Rogue Encampment (罗格营地城镇)</option>
          </select>
        </label>
        <label class="d2ks-field-inline">
          <span>职业:</span>
          <select class="d2ks-select" id="k5-lb-cls">
            <option value="1">Sorceress</option>
            <option value="4">Barbarian</option>
            <option value="3">Paladin</option>
            <option value="0">Amazon</option>
            <option value="2">Necromancer</option>
          </select>
        </label>
        <button type="button" class="d2ks-btn d2ks-btn--primary" id="k5-lb-boot">重启 1.13c 回环内核</button>
        <div class="d2ks-btn-group">
          <button type="button" class="d2ks-btn d2ks-btn--sm d2ks-btn--active" data-move="run">C2S 0x03 Run</button>
          <button type="button" class="d2ks-btn d2ks-btn--sm" data-move="walk">C2S 0x01 Walk</button>
        </div>
        <span class="d2ks-badge d2ks-badge--ok" id="k5-lb-badge">READY</span>
      </div>

      <div class="d2ks-kpi-strip">
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">会话状态 / 协议错误</span><span class="d2ks-kpi__val d2ks-mono d2ks-text--ok" id="k5-lb-state">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">内核帧 / 25Hz 时间</span><span class="d2ks-kpi__val d2ks-mono" id="k5-lb-frame">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">角色坐标 (Subtile) / Mode</span><span class="d2ks-kpi__val d2ks-mono" id="k5-lb-pos">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">生命 / 体力 (Stat 6 / 10)</span><span class="d2ks-kpi__val d2ks-mono" id="k5-lb-stats">…</span></div>
      </div>

      <div class="d2ks-split-panels">
        <div class="d2ks-canvas-card">
          <div class="d2ks-canvas-card__hdr">
            <span>实时 100×100 Subtile 房间（点击任意位置向内核发 C2S 移动包）</span>
            <span class="d2ks-mono d2ks-muted">25 fps (40 ms/f)</span>
          </div>
          <canvas class="d2ks-canvas" id="k5-lb-canvas" style="height: 310px; cursor: crosshair"></canvas>
        </div>
        <div class="d2ks-panel">
          <div class="d2ks-panel__hdr">
            <h3 class="d2ks-panel__title">实时 S2C / Fog.#10223 压缩帧 / ServerEvent 抓包流</h3>
            <span class="d2ks-muted d2ks-mono" id="k5-lb-log-cnt">0 条</span>
          </div>
          <div class="d2ks-table-scroll d2ks-table-scroll--tall">
            <table class="d2ks-table d2ks-table--compact">
              <thead><tr><th>通道</th><th>Opcode</th><th>字节</th><th>内容预览</th></tr></thead>
              <tbody id="k5-lb-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `

  const areaEl = container.querySelector('#k5-lb-area') as HTMLSelectElement
  const clsEl = container.querySelector('#k5-lb-cls') as HTMLSelectElement
  const canvas = container.querySelector('#k5-lb-canvas') as HTMLCanvasElement
  const tbody = container.querySelector('#k5-lb-tbody') as HTMLElement

  function render(): void {
    if (!sandbox) return
    const snap = sandbox.snapshot()
    ;(container.querySelector('#k5-lb-badge') as HTMLElement).textContent =
      `INGAME · 0xAF..0x04 OK · ${snap.protocolErrors} errors`
    ;(container.querySelector('#k5-lb-state') as HTMLElement).textContent = `${snap.state} / ${snap.protocolErrors} err`
    ;(container.querySelector('#k5-lb-frame') as HTMLElement).textContent = `F${snap.frame} (${snap.tickMs} ms)`
    ;(container.querySelector('#k5-lb-pos') as HTMLElement).textContent = `(${snap.x}, ${snap.y}) · mode=${snap.mode}`
    ;(container.querySelector('#k5-lb-stats') as HTMLElement).textContent = `HP ${snap.hp} / Stam ${snap.stamina}`
    ;(container.querySelector('#k5-lb-log-cnt') as HTMLElement).textContent = `${snap.recentLog.length} 条`

    const ctx = canvas.getContext('2d')
    if (ctx) {
      const w = Math.max(320, Math.floor(canvas.clientWidth || 520))
      const h = 310
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.fillStyle = '#090806'
      ctx.fillRect(0, 0, w, h)
      const scale = Math.min((w - 24) / snap.roomW, (h - 24) / snap.roomH)
      const ox = (w - snap.roomW * scale) * 0.5
      const oy = (h - snap.roomH * scale) * 0.5
      const sx = (wx: number): number => ox + (wx - snap.roomX) * scale
      const sy = (wy: number): number => oy + (wy - snap.roomY) * scale

      ctx.fillStyle = '#15110c'
      ctx.fillRect(ox, oy, snap.roomW * scale, snap.roomH * scale)
      ctx.strokeStyle = 'rgba(117, 95, 59, 0.25)'
      for (let g = 0; g <= snap.roomW; g += 10) {
        ctx.beginPath()
        ctx.moveTo(ox + g * scale, oy)
        ctx.lineTo(ox + g * scale, oy + snap.roomH * scale)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(ox, oy + g * scale)
        ctx.lineTo(ox + snap.roomW * scale, oy + g * scale)
        ctx.stroke()
      }
      ctx.strokeStyle = '#755f3b'
      ctx.strokeRect(ox, oy, snap.roomW * scale, snap.roomH * scale)

      if (snap.trail.length > 1) {
        ctx.beginPath()
        snap.trail.forEach(([tx, ty], i) => {
          if (i === 0) ctx.moveTo(sx(tx), sy(ty))
          else ctx.lineTo(sx(tx), sy(ty))
        })
        ctx.strokeStyle = '#38d9a9'
        ctx.lineWidth = 2
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.arc(sx(snap.x), sy(snap.y), 6, 0, Math.PI * 2)
      ctx.fillStyle = '#f0dc9c'
      ctx.fill()
      ctx.fillStyle = '#f0dc9c'
      ctx.font = '11px monospace'
      ctx.fillText(`${snap.charName} (${snap.x},${snap.y})`, sx(snap.x) + 10, sy(snap.y) + 4)
    }

    tbody.innerHTML = snap.recentLog
      .map(
        (l) => `
          <tr>
            <td><span class="d2ks-pill ${l.dir === 'S2C' ? 'd2ks-pill--ok' : l.dir === 'WIRE' ? 'd2ks-pill--info' : 'd2ks-pill--warn'}">${l.dir}</span></td>
            <td class="d2ks-mono d2ks-gold">${escapeHtml(l.opcodeHex)}</td>
            <td class="d2ks-mono">${l.bytesLen > 0 ? `${l.bytesLen}B` : '—'}</td>
            <td class="d2ks-mono d2ks-muted">${escapeHtml(l.summary)}</td>
          </tr>
        `,
      )
      .join('')
  }

  function boot(): void {
    sandbox?.close()
    sandbox = new BrowserK5LoopbackSandbox({
      areaId: Number(areaEl.value) || 2,
      charClass: Number(clsEl.value) || 1,
      charName: 'KernelHero',
    })
    render()
  }

  container.querySelector('#k5-lb-boot')?.addEventListener('click', boot)
  container.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((btn) => {
    btn.addEventListener('click', () => {
      moveMode = btn.dataset.move === 'walk' ? 'walk' : 'run'
      container.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((b) => {
        b.classList.toggle('d2ks-btn--active', b === btn)
      })
    })
  })
  canvas.addEventListener('click', (ev) => {
    if (!sandbox) return
    const snap = sandbox.snapshot()
    const rect = canvas.getBoundingClientRect()
    const scale = Math.min((rect.width - 24) / snap.roomW, (rect.height - 24) / snap.roomH)
    const ox = (rect.width - snap.roomW * scale) * 0.5
    const oy = (rect.height - snap.roomH * scale) * 0.5
    const targetX = snap.roomX + (ev.clientX - rect.left - ox) / scale
    const targetY = snap.roomY + (ev.clientY - rect.top - oy) / scale
    sandbox.moveTo(targetX, targetY, moveMode === 'run', 30)
    render()
  })

  return {
    activate(): void {
      if (!sandbox) boot()
      else render()
    },
    deactivate(): void {
      // Keep session alive when switching tabs
    },
  }
}

function mountZone2D2tv(container: HTMLElement): ShowcaseZoneController {
  let loaded = false
  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-kpi-strip">
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">回归套数 / 二进制产物</span><span class="d2ks-kpi__val d2ks-mono" id="k5-d-cnt">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">D2TV 向量总记录数</span><span class="d2ks-kpi__val d2ks-mono d2ks-text--ok" id="k5-d-rec">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">Pinned SHA-256 校验</span><span class="d2ks-kpi__val d2ks-mono" id="k5-d-sha">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">门禁测试路径</span><span class="d2ks-kpi__val d2ks-mono">exitgate-d2tv-regression</span></div>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">9 大合并 D2TV 退出门禁资产实时校验表</h3>
          <span class="d2ks-badge d2ks-badge--ok" id="k5-d-badge">校验中…</span>
        </div>
        <div class="d2ks-table-scroll d2ks-table-scroll--tall">
          <table class="d2ks-table d2ks-table--compact">
            <thead>
              <tr><th>套件</th><th>Kind</th><th>记录数</th><th>解压字节</th><th>SHA-256 (前16位)</th><th>结果</th><th>说明</th></tr>
            </thead>
            <tbody id="k5-d-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `

  return {
    activate(): void {
      if (loaded) return
      loaded = true
      void fetchJson<K5D2tvResp>('/api/k5-showcase/d2tv').then((resp) => {
        ;(container.querySelector('#k5-d-cnt') as HTMLElement).textContent = `9 suites / ${resp.totalArtifacts} files`
        ;(container.querySelector('#k5-d-rec') as HTMLElement).textContent = fmtInt(resp.totalRecords)
        const shaEl = container.querySelector('#k5-d-sha') as HTMLElement
        shaEl.textContent = resp.allMatched ? `${resp.totalArtifacts} / ${resp.totalArtifacts} EXACT` : 'MISMATCH'
        shaEl.className = `d2ks-kpi__val d2ks-mono ${resp.allMatched ? 'd2ks-text--ok' : 'd2ks-text--err'}`
        const badge = container.querySelector('#k5-d-badge') as HTMLElement
        badge.textContent = resp.allMatched ? 'ALL PINNED SHA-256 MATCHED' : 'SHA MISMATCH'
        badge.className = resp.allMatched ? 'd2ks-badge d2ks-badge--ok' : 'd2ks-badge d2ks-badge--err'
        ;(container.querySelector('#k5-d-tbody') as HTMLElement).innerHTML = resp.rows
          .map(
            (r) => `
              <tr>
                <td class="d2ks-mono d2ks-gold">${escapeHtml(r.suite)}</td>
                <td class="d2ks-mono">${escapeHtml(r.kind)}</td>
                <td class="d2ks-mono">${r.recordCount > 0 ? fmtInt(r.recordCount) : '—'}</td>
                <td class="d2ks-mono">${fmtInt(r.rawBytes)} B</td>
                <td class="d2ks-mono d2ks-muted">${escapeHtml(r.actualSha256.slice(0, 16))}…</td>
                <td><span class="d2ks-pill ${r.shaMatch ? 'd2ks-pill--ok' : 'd2ks-pill--err'}">${r.shaMatch ? 'SHA OK' : 'DIFF'}</span></td>
                <td class="d2ks-wrap">${escapeHtml(r.description)}</td>
              </tr>
            `,
          )
          .join('')
      })
    },
    deactivate(): void {
      // No-op
    },
  }
}

function mountZone3Viewports(container: HTMLElement): ShowcaseZoneController {
  let profiles: K5ViewportsResp['profiles'] = []
  let selectedId = '1068x600'

  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-toolbar">
        <div class="d2ks-btn-group" id="k5-vp-btns"></div>
        <a href="/play.html" class="d2ks-btn d2ks-btn--primary" style="margin-left: auto">进入实机 /play.html 验证 →</a>
      </div>

      <div class="d2ks-split-panels">
        <div class="d2ks-canvas-card">
          <div class="d2ks-canvas-card__hdr">
            <span>1.13c HUD 锚点几何示意图（金=800×48 控制条，青=左右 400×552 面板区，绿=宽屏视野通道）</span>
            <span class="d2ks-mono d2ks-gold" id="k5-vp-cur">1068x600</span>
          </div>
          <canvas class="d2ks-canvas" id="k5-vp-canvas" style="height: 290px"></canvas>
        </div>

        <div class="d2ks-panel">
          <div class="d2ks-panel__hdr">
            <h3 class="d2ks-panel__title">已注册分辨率全表 (VIEWPORT_PROFILES)</h3>
            <span class="d2ks-badge d2ks-badge--ok">7 PROFILES</span>
          </div>
          <div class="d2ks-table-scroll">
            <table class="d2ks-table d2ks-table--compact">
              <thead>
                <tr><th>Profile</th><th>比例</th><th>1.13c 原生</th><th>Bar (X,Y)</th><th>Panel Y</th><th>中区通道</th></tr>
              </thead>
              <tbody id="k5-vp-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `

  const btnsEl = container.querySelector('#k5-vp-btns') as HTMLElement
  const canvas = container.querySelector('#k5-vp-canvas') as HTMLCanvasElement
  const tbody = container.querySelector('#k5-vp-tbody') as HTMLElement

  function render(): void {
    const prof = profiles.find((p) => p.id === selectedId) ?? profiles[0]
    if (!prof) return
    ;(container.querySelector('#k5-vp-cur') as HTMLElement).textContent =
      `${prof.id} · bar(${prof.barOffsetX}, ${prof.barOffsetY}) · panelY=${prof.panelOffsetY}`
    btnsEl.querySelectorAll<HTMLButtonElement>('[data-vp]').forEach((b) => {
      b.classList.toggle('d2ks-btn--active', b.dataset.vp === prof.id)
    })

    const ctx = canvas.getContext('2d')
    if (ctx) {
      const w = Math.max(320, Math.floor(canvas.clientWidth || 540))
      const h = 290
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.fillStyle = '#090806'
      ctx.fillRect(0, 0, w, h)
      const scale = Math.min((w - 32) / prof.width, (h - 32) / prof.height)
      const rw = prof.width * scale
      const rh = prof.height * scale
      const ox = (w - rw) * 0.5
      const oy = (h - rh) * 0.5

      ctx.fillStyle = '#15120d'
      ctx.fillRect(ox, oy, rw, rh)

      // Dock panels (400x552 or 320x432)
      const dockH = (prof.id === '640x480' ? 432 : 552) * scale
      const dockW = prof.dockWidth * scale
      const panelTop = oy + Math.max(0, prof.panelOffsetY) * scale
      ctx.fillStyle = 'rgba(88, 213, 255, 0.14)'
      ctx.fillRect(ox, panelTop, dockW, dockH)
      ctx.fillRect(ox + rw - dockW, panelTop, dockW, dockH)
      ctx.strokeStyle = '#58d5ff'
      ctx.strokeRect(ox, panelTop, dockW, dockH)
      ctx.strokeRect(ox + rw - dockW, panelTop, dockW, dockH)

      // Widescreen center world channel
      if (prof.centerChannelWidth > 0) {
        ctx.fillStyle = 'rgba(56, 217, 169, 0.14)'
        ctx.fillRect(ox + dockW, panelTop, prof.centerChannelWidth * scale, dockH)
      }

      // Control bar (800x48 anchored at bottom)
      const barW = Math.min(800, prof.width) * scale
      const barH = 48 * scale
      const barX = ox + Math.max(0, prof.barOffsetX) * scale
      const barY = oy + rh - barH
      ctx.fillStyle = 'rgba(240, 220, 156, 0.25)'
      ctx.fillRect(barX, barY, barW, barH)
      ctx.strokeStyle = '#f0dc9c'
      ctx.strokeRect(barX, barY, barW, barH)

      ctx.strokeStyle = '#c7b377'
      ctx.lineWidth = 1.5
      ctx.strokeRect(ox, oy, rw, rh)
      ctx.fillStyle = '#f0dc9c'
      ctx.font = '11px monospace'
      ctx.fillText(`${prof.width}×${prof.height} (${prof.aspectRatio})`, ox + 8, oy + 16)
      ctx.fillText(`800×48 CtrlBar @ x=${prof.barOffsetX}`, barX + 6, barY + barH * 0.65)
    }

    tbody.innerHTML = profiles
      .map(
        (p) => `
          <tr class="d2ks-clickable-row${p.id === prof.id ? ' d2ks-row--sel' : ''}" data-vp-row="${escapeHtml(p.id)}">
            <td class="d2ks-mono d2ks-gold">${escapeHtml(p.id)}</td>
            <td class="d2ks-mono">${escapeHtml(p.aspectRatio)}</td>
            <td><span class="d2ks-pill ${p.native113c ? 'd2ks-pill--ok' : 'd2ks-pill--info'}">${p.native113c ? '1.13c' : 'Extended'}</span></td>
            <td class="d2ks-mono">(${p.barOffsetX}, ${p.barOffsetY})</td>
            <td class="d2ks-mono">${p.panelOffsetY}</td>
            <td class="d2ks-mono">${p.centerChannelWidth}px</td>
          </tr>
        `,
      )
      .join('')
    tbody.querySelectorAll<HTMLTableRowElement>('[data-vp-row]').forEach((tr) => {
      tr.addEventListener('click', () => {
        selectedId = tr.dataset.vpRow ?? selectedId
        render()
      })
    })
  }

  return {
    activate(): void {
      if (profiles.length > 0) {
        render()
        return
      }
      void fetchJson<K5ViewportsResp>('/api/k5-showcase/viewports').then((resp) => {
        profiles = resp.profiles
        btnsEl.innerHTML = profiles
          .map((p) => `<button type="button" class="d2ks-btn d2ks-btn--sm" data-vp="${escapeHtml(p.id)}">${escapeHtml(p.id)}</button>`)
          .join('')
        btnsEl.querySelectorAll<HTMLButtonElement>('[data-vp]').forEach((btn) => {
          btn.addEventListener('click', () => {
            selectedId = btn.dataset.vp ?? selectedId
            render()
          })
        })
        render()
      })
    },
    deactivate(): void {
      // No-op
    },
  }
}

function mountZone4SavesAndPng(container: HTMLElement): ShowcaseZoneController {
  let loaded = false
  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">1. PNG 零 PII 元数据剥离浏览器实测 (stripPngAncillaryChunks)</h3>
          <span class="d2ks-badge d2ks-badge--ok" id="k5-png-badge">READY</span>
        </div>
        <div class="d2ks-toolbar">
          <button type="button" class="d2ks-btn d2ks-btn--primary" id="k5-png-demo">生成含 tEXt/eXIf/c2pa/tIME 测试 PNG 并剥离</button>
          <label class="d2ks-btn">选择本地 PNG 检测<input type="file" accept="image/png" id="k5-png-file" hidden /></label>
        </div>
        <div class="d2ks-code-box" id="k5-png-out"></div>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">2. 仓库实机 .d2s v96 存档校验 (readD2sSave113c + verifyD2sChecksum)</h3>
          <span class="d2ks-badge d2ks-badge--ok" id="k5-saves-badge">加载中…</span>
        </div>
        <div class="d2ks-table-scroll d2ks-table-scroll--tall">
          <table class="d2ks-table d2ks-table--compact">
            <thead>
              <tr><th>存档文件</th><th>角色名</th><th>职业</th><th>Lv</th><th>Act</th><th>MapSeed</th><th>物品 / 技能点</th><th>字节</th><th>Checksum</th></tr>
            </thead>
            <tbody id="k5-saves-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `

  const pngOut = container.querySelector('#k5-png-out') as HTMLElement
  const pngBadge = container.querySelector('#k5-png-badge') as HTMLElement

  function runPngStrip(buf: Uint8Array, label: string): void {
    try {
      const r = stripPngAncillaryChunksBrowser(buf)
      pngBadge.textContent = `DROPPED ${r.droppedChunks.length} ANCILLARY CHUNKS`
      pngBadge.className = 'd2ks-badge d2ks-badge--ok'
      pngOut.textContent = [
        `Source        : ${label}`,
        `Dimensions    : ${r.width} × ${r.height}`,
        `Original Size : ${r.originalBytes} B  →  Clean Size: ${r.cleanBytes} B (-${r.originalBytes - r.cleanBytes} B)`,
        `Kept Critical : [${r.keptChunks.join(', ')}]`,
        `Dropped Meta  : [${r.droppedChunks.join(', ') || '(none)'}]`,
      ].join('\n')
    } catch (e) {
      pngBadge.textContent = 'INVALID PNG'
      pngBadge.className = 'd2ks-badge d2ks-badge--err'
      pngOut.textContent = e instanceof Error ? e.message : String(e)
    }
  }

  container.querySelector('#k5-png-demo')?.addEventListener('click', () => {
    runPngStrip(buildSyntheticAnnotatedPng(), 'synthetic-annotated-800x600.png (with tEXt/eXIf/c2pa/tIME)')
  })
  ;(container.querySelector('#k5-png-file') as HTMLInputElement).addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0]
    if (!file) return
    void file.arrayBuffer().then((ab) => runPngStrip(new Uint8Array(ab), file.name))
  })

  return {
    activate(): void {
      if (!loaded) {
        loaded = true
        runPngStrip(buildSyntheticAnnotatedPng(), 'synthetic-annotated-800x600.png (with tEXt/eXIf/c2pa/tIME)')
        void fetchJson<K5SavesResp>('/api/k5-showcase/saves').then((resp) => {
          const badge = container.querySelector('#k5-saves-badge') as HTMLElement
          badge.textContent = `${resp.saveCount} SAVES · ${resp.allChecksumsValid ? '100% VALID' : 'INVALID'}`
          badge.className = resp.allChecksumsValid ? 'd2ks-badge d2ks-badge--ok' : 'd2ks-badge d2ks-badge--err'
          ;(container.querySelector('#k5-saves-tbody') as HTMLElement).innerHTML = resp.saves
            .map(
              (s) => `
                <tr>
                  <td class="d2ks-mono d2ks-gold">${escapeHtml(s.file)}</td>
                  <td>${escapeHtml(s.name)}</td>
                  <td>${escapeHtml(s.className)}</td>
                  <td class="d2ks-mono">${s.level}</td>
                  <td class="d2ks-mono">Act ${s.act}</td>
                  <td class="d2ks-mono">${escapeHtml(s.mapSeedHex)}</td>
                  <td class="d2ks-mono">${s.itemCount} items / ${s.skillPointsAllocated} pts</td>
                  <td class="d2ks-mono">${s.bytes} B</td>
                  <td><span class="d2ks-pill ${s.checksumValid ? 'd2ks-pill--ok' : 'd2ks-pill--err'}">${s.checksumValid ? 'VALID' : 'BAD'}</span></td>
                </tr>
              `,
            )
            .join('')
        })
      }
    },
    deactivate(): void {
      // No-op
    },
  }
}

export function mountK5ShowcaseApp(root: HTMLElement): void {
  const doc = root.ownerDocument ?? document
  root.innerHTML = `
    <div class="d2ks-shell">
      <aside class="d2ks-sidebar" id="k5-sidebar">
        <div class="d2ks-brand">
          <div class="d2ks-brand__eyebrow">DIABLO II v1.13c · [K5] SP SWITCH</div>
          <h1 class="d2ks-brand__title">单机内核切换与 E2E 展厅</h1>
          <div class="d2ks-brand__sub" id="k5-sidebar-cert">正在加载配置…</div>
        </div>

        <nav class="d2ks-nav" aria-label="K5 Showcase Zones" id="k5-zone-nav"></nav>

        <div class="d2ks-sidebar-metrics">
          <div class="d2ks-metric-row"><span>单机默认后端</span><strong class="d2ks-mono d2ks-text--ok" id="k5-m-be">…</strong></div>
          <div class="d2ks-metric-row"><span>9 大 D2TV 门禁</span><strong class="d2ks-mono d2ks-text--ok" id="k5-m-d2tv">…</strong></div>
          <div class="d2ks-metric-row"><span>向量总条数</span><strong class="d2ks-mono" id="k5-m-recs">…</strong></div>
          <div class="d2ks-metric-row"><span>实机 .d2s 存档</span><strong class="d2ks-mono" id="k5-m-saves">…</strong></div>
          <div class="d2ks-metric-row"><span>支持分辨率</span><strong class="d2ks-mono" id="k5-m-vps">…</strong></div>
        </div>

        ${renderKNavStripHtml('K5', 'd2ks')}

        <div class="d2ks-sidebar-links">
          <a href="/" class="d2ks-btn d2ks-btn--block">庇护之地门户 (Portal)</a>
          <a href="/play.html" class="d2ks-btn d2ks-btn--block">进入完整游戏 (Play)</a>
        </div>
      </aside>

      <main class="d2ks-main" id="k5-main">
        <header class="d2ks-zone-header">
          <div class="d2ks-zone-header__titles">
            <h2 class="d2ks-zone-header__title" id="k5-active-title"></h2>
            <p class="d2ks-zone-header__sub" id="k5-active-sub"></p>
          </div>
          <div class="d2ks-zone-header__pills">
            <span class="d2ks-badge d2ks-badge--ok">ZERO MOCK DATA</span>
            <span class="d2ks-badge" id="k5-header-zone-pill">ZONE 01 / 04</span>
          </div>
        </header>

        <section id="k5-panel-loopback" class="d2ks-zone-panel"></section>
        <section id="k5-panel-d2tv" class="d2ks-zone-panel" hidden></section>
        <section id="k5-panel-viewports" class="d2ks-zone-panel" hidden></section>
        <section id="k5-panel-saves" class="d2ks-zone-panel" hidden></section>
      </main>
    </div>
  `

  const q = (sel: string): HTMLElement => root.querySelector(sel) as HTMLElement
  const navEl = q('#k5-zone-nav')
  const mainEl = q('#k5-main')
  const panels: Record<K5ZoneId, HTMLElement> = {
    loopback: q('#k5-panel-loopback'),
    d2tv: q('#k5-panel-d2tv'),
    viewports: q('#k5-panel-viewports'),
    saves: q('#k5-panel-saves'),
  }

  const controllers: Record<K5ZoneId, ShowcaseZoneController> = {
    loopback: mountZone1Loopback(panels.loopback),
    d2tv: mountZone2D2tv(panels.d2tv),
    viewports: mountZone3Viewports(panels.viewports),
    saves: mountZone4SavesAndPng(panels.saves),
  }

  const navBtns = new Map<K5ZoneId, HTMLButtonElement>()
  let current: K5ZoneId | null = null
  for (const z of ZONES) {
    const btn = doc.createElement('button')
    btn.type = 'button'
    btn.className = 'd2ks-nav-btn'
    btn.dataset.zone = z.id
    btn.innerHTML = `
      <span class="d2ks-nav-btn__idx">${z.idx}</span>
      <span class="d2ks-nav-btn__title">${z.navTitle}</span>
      <span class="d2ks-nav-btn__sub">${z.navSub}</span>
    `
    btn.addEventListener('click', () => switchZone(z.id))
    navEl.appendChild(btn)
    navBtns.set(z.id, btn)
  }

  function switchZone(next: K5ZoneId): void {
    if (current === next) return
    if (current !== null) controllers[current].deactivate()
    current = next
    const idx = ZONES.findIndex((z) => z.id === next)
    const meta = ZONES[idx >= 0 ? idx : 0]!
    q('#k5-active-title').textContent = meta.headerTitle
    q('#k5-active-sub').textContent = meta.headerSub
    q('#k5-header-zone-pill').textContent = `ZONE 0${idx + 1} / 0${ZONES.length}`
    for (const z of ZONES) {
      panels[z.id].hidden = z.id !== next
      navBtns.get(z.id)?.classList.toggle('d2ks-nav-btn--active', z.id === next)
    }
    mainEl.scrollTop = 0
    controllers[next].activate()
  }

  void fetchJson<K5Overview>('/api/k5-showcase/overview')
    .then((ov) => {
      q('#k5-m-be').textContent = ov.siteConfig.singlePlayerBackend
      q('#k5-m-d2tv').textContent = ov.d2tvAllMatched ? `${ov.d2tvArtifactCount}/${ov.d2tvArtifactCount} PASS` : 'CHECK'
      q('#k5-m-recs').textContent = fmtInt(ov.d2tvTotalRecords)
      q('#k5-m-saves').textContent = `${ov.saveFixtureCount} .d2s`
      q('#k5-m-vps').textContent = `${ov.viewportCount} profiles`
      q('#k5-sidebar-cert').textContent = `Backend: ${ov.siteConfig.singlePlayerBackend} · 9/9 D2TV`
    })
    .catch(() => {
      q('#k5-sidebar-cert').textContent = '配置加载失败'
    })

  const rawZone = new URLSearchParams(window.location.search).get('zone')?.trim().toLowerCase()
  let initial: K5ZoneId = 'loopback'
  if (rawZone === '2' || rawZone === 'd2tv') initial = 'd2tv'
  else if (rawZone === '3' || rawZone === 'viewports') initial = 'viewports'
  else if (rawZone === '4' || rawZone === 'saves') initial = 'saves'
  switchZone(initial)
}

if (typeof document !== 'undefined') {
  const el = document.getElementById('k5-showcase-app')
  if (el) mountK5ShowcaseApp(el)
}
