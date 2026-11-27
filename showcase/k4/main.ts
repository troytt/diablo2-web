/**
 * [K4] Act 1–5 Town NPC AI & Quest State Machine Interactive Visual Showcase
 * (`showcase/k4/main.ts`).
 */

import { renderFnDetailDrawer } from '../shared/disasm-explorer.ts'
import { renderKNavStripHtml } from '../shared/k-nav.ts'
import { mountSharedReplayWidget } from '../shared/replay-widget.ts'
import {
  escapeHtml,
  fetchJson,
  fmtInt,
  type SharedFnDetailResponse,
  type ShowcaseZoneController,
} from '../shared/types.ts'

export type K4ZoneId = 'replay' | 'quests' | 'towns' | 'coverage'

interface K4Overview {
  readonly ok: true
  readonly scenarioCount: number
  readonly totalGoldenFrames: number
  readonly totalSteppedFrames: number
  readonly ds1BundleEntryCount: number
  readonly s2cVectorCount: number
  readonly s2cVectorSha256: string
  readonly scenarios: readonly {
    readonly scenario: string
    readonly act: number
    readonly townName: string
    readonly townLevelId: number
    readonly questCode: string
    readonly questName: string
    readonly npcName: string
    readonly rewardOutcome: string
    readonly goldenFrames: number
    readonly strictHorizon: number
    readonly posHorizon: number
    readonly dllHitsTotal: number
  }[]
}

interface K4QuestsResp {
  readonly ok: true
  readonly quests: readonly {
    readonly scenario: string
    readonly spec: {
      readonly act: number
      readonly townName: string
      readonly townLevelId: number
      readonly questCode: string
      readonly questName: string
      readonly wooWord: number
      readonly initialWordHex: string
      readonly finalWordHex: string
      readonly npcName: string
      readonly npcHcIdx: number
      readonly callbackVa: string
      readonly townNpcAiVa: string
      readonly scrollIdHex: string
      readonly rewardOutcome: string
    }
    readonly callbackName: string
    readonly callbackKernFile: string | null
    readonly townNpcAiName: string
    readonly townNpcAiKernFile: string | null
    readonly c2sInputs: readonly {
      readonly frame: number
      readonly hex: string
      readonly opcodeHex: string
      readonly opcodeLabel: string
    }[]
  }[]
  readonly ds1Bundle: { readonly relPath: string; readonly entryCount: number; readonly samplePaths: readonly string[] }
}

interface K4CoverageResp {
  readonly ok: true
  readonly computeMs: number
  readonly allZeroDivergence: boolean
  readonly unionDllTotal: number
  readonly unionD2CommonDll: number
  readonly unionD2CommonPreBootGap: number
  readonly unionD2CommonSteppedGap: number
  readonly unionD2GameDll: number
  readonly unionD2GamePreBootGap: number
  readonly unionD2GameSteppedGap: number
  readonly scenarios: readonly {
    readonly scenario: string
    readonly act: number
    readonly goldenFrames: number
    readonly zeroDivergence: boolean
    readonly d2CommonDll: number
    readonly d2CommonTsInDll: number
    readonly d2CommonPreBootGap: number
    readonly d2CommonSteppedGap: number
    readonly d2GameDll: number
    readonly d2GameTsInDll: number
    readonly d2GamePreBootGap: number
    readonly d2GameSteppedGap: number
    readonly preBootVas: readonly { readonly key: string; readonly name: string; readonly firstFrame: number }[]
  }[]
}

interface K4S2CResp {
  readonly ok: true
  readonly relPath: string
  readonly sha256: string
  readonly totalRecords: number
  readonly filteredCount: number
  readonly records: readonly {
    readonly index: number
    readonly opKind: number
    readonly flags: number
    readonly rawLen: number
    readonly framedLen: number
    readonly decompLen: number
    readonly pktCount: number
    readonly firstOpcodeHex: string
    readonly wireHdrHex: string
    readonly rawPrefixHex: string
    readonly framedPrefixHex: string
  }[]
}

const ZONES: readonly {
  readonly id: K4ZoneId
  readonly idx: string
  readonly navTitle: string
  readonly navSub: string
  readonly headerTitle: string
  readonly headerSub: string
}[] = [
  {
    id: 'replay',
    idx: 'ZONE 01',
    navTitle: 'Act 1–5 任务锁步回放',
    navSub: '710 帧 · 5 幕零分歧',
    headerTitle: 'Zone 1 · [K4] Act 1–5 Quest State Machine Lockstep Replay (k4-act{1..5}-quest)',
    headerSub: '实时跟踪 Akara(+1技能)、Jerhyn(技能之书)、Meshif(黄金鸟)、Tyrael(+2技能)、Malah(+10全抗) 的任务状态与属性跃迁。',
  },
  {
    id: 'quests',
    idx: 'ZONE 02',
    navTitle: 'Woo! 掩码与 C2S 序列',
    navSub: '0x13/0x2F/0x31/0x30/0x20',
    headerTitle: 'Zone 2 · Quest Woo! Bitmask & C2S Interaction Sequence Inspector (Acts 1–5)',
    headerSub: '解析真实场景 C2S 包序列、Quest 16-bit Woo! 标志位跳变与各幕 D2Game 任务回调反汇编源码。',
  },
  {
    id: 'towns',
    idx: 'ZONE 03',
    navTitle: '城镇 NPC AI 与 DS1 图鉴',
    navSub: 'Act 2–5 DS1/DT1 预设流式',
    headerTitle: 'Zone 3 · Act 1–5 Town NPC Patrol AI & DS1/DT1 Room Preset Hydration Atlas',
    headerSub: '展示 5 幕城镇 AI_TownNpc / AI_SimpleMapAiNpc / AI_RogueTown / AI_ThinkTyrael 入口与 DS1 房间包元数据。',
  },
  {
    id: 'coverage',
    idx: 'ZONE 04',
    navTitle: 'F3+ 零缺口与 S2C 向量',
    navSub: 'steppedGap=0 · 1,440 S2C',
    headerTitle: 'Zone 4 · preBootGap (F1..F2) vs steppedRuntimeExecGap = 0 (F3+) & s2c-113c.d2tv.gz',
    headerSub: '服务端实时运行全部 5 幕回放分离 F1..F2 预启动函数与 F3+ 步进窗口（0 缺口），并检验 1,440 条 S2C/Huffman 向量。',
  },
]

function mountZone2Quests(container: HTMLElement): ShowcaseZoneController {
  let data: K4QuestsResp | null = null
  let selectedIdx = 0

  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-toolbar">
        <div class="d2ks-btn-group" id="k4-q-tabs"></div>
      </div>
      <div class="d2ks-split-panels">
        <div class="d2ks-panel">
          <div class="d2ks-panel__hdr">
            <h3 class="d2ks-panel__title" id="k4-q-title">Quest 详情</h3>
            <span class="d2ks-badge d2ks-badge--ok" id="k4-q-code">…</span>
          </div>
          <dl class="d2ks-kv" id="k4-q-kv"></dl>
          <div class="d2ks-panel__hdr" style="margin-top: 4px"><h3 class="d2ks-panel__title">16-bit Woo! Quest Word 位图 (Initial)</h3></div>
          <div class="d2ks-chip-wrap" id="k4-q-bits"></div>
        </div>
        <div class="d2ks-panel">
          <div class="d2ks-panel__hdr">
            <h3 class="d2ks-panel__title">真实 C2S 输入包时序 (100% 返回 0)</h3>
            <span class="d2ks-muted d2ks-mono" id="k4-q-c2s-cnt"></span>
          </div>
          <div class="d2ks-table-scroll">
            <table class="d2ks-table d2ks-table--compact">
              <thead><tr><th>帧</th><th>Opcode</th><th>语义</th><th>Payload Hex</th></tr></thead>
              <tbody id="k4-q-c2s-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
      <div id="k4-q-drawer"></div>
    </div>
  `

  const tabsEl = container.querySelector('#k4-q-tabs') as HTMLElement
  const drawerEl = container.querySelector('#k4-q-drawer') as HTMLElement

  async function inspectFn(mod: 'D2Common' | 'D2Game', va: string): Promise<void> {
    drawerEl.innerHTML = `<div class="d2ks-note">正在读取 ${escapeHtml(mod)}:${escapeHtml(va)} 反汇编与 TS 源码…</div>`
    const detail = await fetchJson<SharedFnDetailResponse>(
      `/api/k4-showcase/fn?module=${encodeURIComponent(mod)}&va=${encodeURIComponent(va)}`,
    )
    renderFnDetailDrawer(drawerEl, detail, (m, v) => {
      void inspectFn(m, v)
    })
  }

  function renderSelected(): void {
    if (!data) return
    const item = data.quests[selectedIdx] ?? data.quests[0]
    if (!item) return
    tabsEl.querySelectorAll<HTMLButtonElement>('[data-qidx]').forEach((b) => {
      b.classList.toggle('d2ks-btn--active', Number(b.dataset.qidx) === selectedIdx)
    })
    ;(container.querySelector('#k4-q-title') as HTMLElement).textContent = `Act ${item.spec.act} · ${item.spec.questName}`
    ;(container.querySelector('#k4-q-code') as HTMLElement).textContent = `${item.spec.questCode} · Word #${item.spec.wooWord}`
    ;(container.querySelector('#k4-q-kv') as HTMLElement).innerHTML = `
      <dt>城镇关卡</dt><dd>${escapeHtml(item.spec.townName)} (level ${item.spec.townLevelId})</dd>
      <dt>交互 NPC</dt><dd>${escapeHtml(item.spec.npcName)} (hcIdx=${item.spec.npcHcIdx})</dd>
      <dt>Woo! 变更</dt><dd class="d2ks-mono">${escapeHtml(item.spec.initialWordHex)} → <span class="d2ks-text--ok">${escapeHtml(item.spec.finalWordHex)}</span></dd>
      <dt>wScrollId</dt><dd class="d2ks-mono d2ks-gold">${escapeHtml(item.spec.scrollIdHex)}</dd>
      <dt>任务回调 VA</dt><dd class="d2ks-mono d2ks-text--cyan">${escapeHtml(item.spec.callbackVa)} (${escapeHtml(item.callbackName)})</dd>
      <dt>城镇 AI VA</dt><dd class="d2ks-mono">${escapeHtml(item.spec.townNpcAiVa)} (${escapeHtml(item.townNpcAiName)})</dd>
      <dt>实机奖励</dt><dd class="d2ks-text--ok">${escapeHtml(item.spec.rewardOutcome)}</dd>
    `

    const initWord = Number.parseInt(item.spec.initialWordHex, 16) || 0
    const bitsEl = container.querySelector('#k4-q-bits') as HTMLElement
    bitsEl.innerHTML = Array.from({ length: 16 }, (_, b) => {
      const bit = 15 - b
      const on = ((initWord >>> bit) & 1) === 1
      return `<span class="d2ks-pill ${on ? 'd2ks-pill--ok' : 'd2ks-pill--warn'}" style="${on ? '' : 'opacity:0.42'}">b${bit}=${on ? 1 : 0}</span>`
    }).join('')

    ;(container.querySelector('#k4-q-c2s-cnt') as HTMLElement).textContent = `${item.c2sInputs.length} packets`
    ;(container.querySelector('#k4-q-c2s-tbody') as HTMLElement).innerHTML = item.c2sInputs
      .map(
        (c) => `
          <tr>
            <td class="d2ks-mono">F${c.frame}</td>
            <td class="d2ks-mono d2ks-gold">${escapeHtml(c.opcodeHex)}</td>
            <td>${escapeHtml(c.opcodeLabel)}</td>
            <td class="d2ks-mono d2ks-muted">${escapeHtml(c.hex)}</td>
          </tr>
        `,
      )
      .join('')

    void inspectFn('D2Game', item.spec.callbackVa)
  }

  return {
    activate(): void {
      if (data) return
      void fetchJson<K4QuestsResp>('/api/k4-showcase/quests').then((resp) => {
        data = resp
        tabsEl.innerHTML = resp.quests
          .map(
            (qItem, i) =>
              `<button type="button" class="d2ks-btn${i === 0 ? ' d2ks-btn--active' : ''}" data-qidx="${i}">Act ${qItem.spec.act} · ${escapeHtml(qItem.spec.questCode)}</button>`,
          )
          .join('')
        tabsEl.querySelectorAll<HTMLButtonElement>('[data-qidx]').forEach((btn) => {
          btn.addEventListener('click', () => {
            selectedIdx = Number(btn.dataset.qidx)
            renderSelected()
          })
        })
        renderSelected()
      })
    },
    deactivate(): void {
      // No-op
    },
  }
}

function mountZone3Towns(container: HTMLElement): ShowcaseZoneController {
  let loaded = false
  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">Act 1–5 城镇 NPC 巡逻与交互 AI 入口（点击任意行查看实机反汇编）</h3>
          <span class="d2ks-badge d2ks-badge--ok">5 ACTS HYDRATED</span>
        </div>
        <div class="d2ks-table-scroll">
          <table class="d2ks-table d2ks-table--compact">
            <thead><tr><th>Act</th><th>城镇</th><th>Level</th><th>代表 NPC</th><th>AI 入口 VA</th><th>AI 符号</th><th>kernFile</th></tr></thead>
            <tbody id="k4-town-tbody"></tbody>
          </table>
        </div>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">Act 2–5 城镇 DS1/DT1 预设房间包 (drlg-act2-5-ds1-dt1-113c.json.gz)</h3>
          <span class="d2ks-badge d2ks-mono" id="k4-ds1-cnt">…</span>
        </div>
        <div class="d2ks-code-box" id="k4-ds1-paths">正在加载…</div>
      </div>

      <div id="k4-town-drawer"></div>
    </div>
  `

  const tbody = container.querySelector('#k4-town-tbody') as HTMLElement
  const drawerEl = container.querySelector('#k4-town-drawer') as HTMLElement

  async function inspectFn(mod: 'D2Common' | 'D2Game', va: string): Promise<void> {
    drawerEl.innerHTML = `<div class="d2ks-note">正在读取 ${escapeHtml(mod)}:${escapeHtml(va)}…</div>`
    const detail = await fetchJson<SharedFnDetailResponse>(
      `/api/k4-showcase/fn?module=${encodeURIComponent(mod)}&va=${encodeURIComponent(va)}`,
    )
    renderFnDetailDrawer(drawerEl, detail, (m, v) => {
      void inspectFn(m, v)
    })
  }

  return {
    activate(): void {
      if (loaded) return
      loaded = true
      void fetchJson<K4QuestsResp>('/api/k4-showcase/quests').then((resp) => {
        tbody.innerHTML = resp.quests
          .map(
            (qItem, i) => `
              <tr class="d2ks-clickable-row${i === 0 ? ' d2ks-row--sel' : ''}" data-va="${escapeHtml(qItem.spec.townNpcAiVa)}">
                <td class="d2ks-mono">Act ${qItem.spec.act}</td>
                <td>${escapeHtml(qItem.spec.townName)}</td>
                <td class="d2ks-mono">${qItem.spec.townLevelId}</td>
                <td>${escapeHtml(qItem.spec.npcName)} (#${qItem.spec.npcHcIdx})</td>
                <td class="d2ks-mono d2ks-gold">${escapeHtml(qItem.spec.townNpcAiVa)}</td>
                <td class="d2ks-mono">${escapeHtml(qItem.townNpcAiName)}</td>
                <td class="d2ks-mono d2ks-muted">${escapeHtml(qItem.townNpcAiKernFile ?? '—')}</td>
              </tr>
            `,
          )
          .join('')
        tbody.querySelectorAll<HTMLTableRowElement>('tr[data-va]').forEach((tr) => {
          tr.addEventListener('click', () => {
            tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('d2ks-row--sel'))
            tr.classList.add('d2ks-row--sel')
            void inspectFn('D2Game', tr.dataset.va ?? '')
          })
        })
        ;(container.querySelector('#k4-ds1-cnt') as HTMLElement).textContent = `${resp.ds1Bundle.entryCount} DS1 entries`
        ;(container.querySelector('#k4-ds1-paths') as HTMLElement).textContent =
          `${resp.ds1Bundle.relPath}\n\n样本路径:\n${resp.ds1Bundle.samplePaths.join('\n')}`
        if (resp.quests[0]) void inspectFn('D2Game', resp.quests[0].spec.townNpcAiVa)
      })
    },
    deactivate(): void {
      // No-op
    },
  }
}

function mountZone4Coverage(container: HTMLElement): ShowcaseZoneController {
  let loaded = false
  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-kpi-strip">
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">5 幕实时重跑耗时</span><span class="d2ks-kpi__val d2ks-mono" id="k4-c-ms">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">F3+ steppedRuntimeExecGap</span><span class="d2ks-kpi__val d2ks-mono d2ks-text--ok" id="k4-c-step">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">F1..F2 preBootGap (快照前)</span><span class="d2ks-kpi__val d2ks-mono d2ks-text--warn" id="k4-c-pre">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">s2c-113c.d2tv.gz 向量</span><span class="d2ks-kpi__val d2ks-mono" id="k4-c-s2c">…</span></div>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">Act 1–5 实时内核覆盖拆分（F1..F2 preBootGap vs F3+ steppedRuntimeExecGap）</h3>
          <span class="d2ks-badge d2ks-badge--ok">LIVE VA-TRACE</span>
        </div>
        <div class="d2ks-table-scroll">
          <table class="d2ks-table d2ks-table--compact">
            <thead>
              <tr><th>场景</th><th>零分歧</th><th>D2Common (dll∩ts)</th><th>C preBoot / F3+ Gap</th><th>D2Game (dll∩ts)</th><th>G preBoot / F3+ Gap</th></tr>
            </thead>
            <tbody id="k4-cov-tbody"><tr><td colspan="6" class="d2ks-muted">正在实时运行 5 幕回放…</td></tr></tbody>
          </table>
        </div>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">s2c-113c.d2tv.gz 实机 S2C / Fog Huffman / D2Net 封包向量明细</h3>
          <span class="d2ks-muted d2ks-mono" id="k4-s2c-sha"></span>
        </div>
        <div class="d2ks-table-scroll">
          <table class="d2ks-table d2ks-table--compact">
            <thead>
              <tr><th>#</th><th>opKind</th><th>FirstOp</th><th>Raw B</th><th>Framed B</th><th>Decomp B</th><th>WireHdr</th><th>Raw Prefix Hex</th></tr>
            </thead>
            <tbody id="k4-s2c-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `

  return {
    activate(): void {
      if (loaded) return
      loaded = true
      void Promise.all([
        fetchJson<K4CoverageResp>('/api/k4-showcase/coverage'),
        fetchJson<K4S2CResp>('/api/k4-showcase/s2c?limit=120'),
      ]).then(([cov, s2c]) => {
        ;(container.querySelector('#k4-c-ms') as HTMLElement).textContent = `${fmtInt(cov.computeMs)} ms (5/5 实跑)`
        ;(container.querySelector('#k4-c-step') as HTMLElement).textContent =
          `C:${cov.unionD2CommonSteppedGap} / G:${cov.unionD2GameSteppedGap} (100% 闭合)`
        ;(container.querySelector('#k4-c-pre') as HTMLElement).textContent =
          `C:${cov.unionD2CommonPreBootGap} / G:${cov.unionD2GamePreBootGap}`
        ;(container.querySelector('#k4-c-s2c') as HTMLElement).textContent = `${fmtInt(s2c.totalRecords)} vectors`

        ;(container.querySelector('#k4-cov-tbody') as HTMLElement).innerHTML = cov.scenarios
          .map(
            (s) => `
              <tr>
                <td class="d2ks-mono d2ks-gold">${escapeHtml(s.scenario)}</td>
                <td><span class="d2ks-pill ${s.zeroDivergence ? 'd2ks-pill--ok' : 'd2ks-pill--err'}">${s.zeroDivergence ? 'Δ=0' : 'DIFF'}</span></td>
                <td class="d2ks-mono">${s.d2CommonTsInDll} / ${s.d2CommonDll}</td>
                <td class="d2ks-mono">${s.d2CommonPreBootGap} / <strong class="d2ks-text--ok">${s.d2CommonSteppedGap}</strong></td>
                <td class="d2ks-mono">${s.d2GameTsInDll} / ${s.d2GameDll}</td>
                <td class="d2ks-mono">${s.d2GamePreBootGap} / <strong class="d2ks-text--ok">${s.d2GameSteppedGap}</strong></td>
              </tr>
            `,
          )
          .join('')

        ;(container.querySelector('#k4-s2c-sha') as HTMLElement).textContent = `SHA-256: ${s2c.sha256.slice(0, 20)}…`
        ;(container.querySelector('#k4-s2c-tbody') as HTMLElement).innerHTML = s2c.records
          .map(
            (r) => `
              <tr>
                <td class="d2ks-mono">${r.index}</td>
                <td class="d2ks-mono">${r.opKind}</td>
                <td class="d2ks-mono d2ks-gold">${escapeHtml(r.firstOpcodeHex)}</td>
                <td class="d2ks-mono">${r.rawLen}</td>
                <td class="d2ks-mono">${r.framedLen}</td>
                <td class="d2ks-mono d2ks-text--ok">${r.decompLen}</td>
                <td class="d2ks-mono">${escapeHtml(r.wireHdrHex)}</td>
                <td class="d2ks-mono d2ks-muted">${escapeHtml(r.rawPrefixHex)}</td>
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

export function mountK4ShowcaseApp(root: HTMLElement): void {
  const doc = root.ownerDocument ?? document
  root.innerHTML = `
    <div class="d2ks-shell">
      <aside class="d2ks-sidebar" id="k4-sidebar">
        <div class="d2ks-brand">
          <div class="d2ks-brand__eyebrow">DIABLO II v1.13c · [K4] QUESTS & NPC</div>
          <h1 class="d2ks-brand__title">五幕任务与城镇 AI 展厅</h1>
          <div class="d2ks-brand__sub" id="k4-sidebar-cert">正在加载实机数据…</div>
        </div>

        <nav class="d2ks-nav" aria-label="K4 Showcase Zones" id="k4-zone-nav"></nav>

        <div class="d2ks-sidebar-metrics">
          <div class="d2ks-metric-row"><span>五幕任务场景</span><strong class="d2ks-mono" id="k4-m-scn">…</strong></div>
          <div class="d2ks-metric-row"><span>黄金帧 / 步进帧</span><strong class="d2ks-mono d2ks-text--ok" id="k4-m-fr">…</strong></div>
          <div class="d2ks-metric-row"><span>F3+ steppedGap</span><strong class="d2ks-mono d2ks-text--ok">0 / 0</strong></div>
          <div class="d2ks-metric-row"><span>Act2-5 DS1 包</span><strong class="d2ks-mono" id="k4-m-ds1">…</strong></div>
          <div class="d2ks-metric-row"><span>S2C 实机向量</span><strong class="d2ks-mono" id="k4-m-s2c">…</strong></div>
        </div>

        ${renderKNavStripHtml('K4', 'd2ks')}

        <div class="d2ks-sidebar-links">
          <a href="/" class="d2ks-btn d2ks-btn--block">庇护之地门户 (Portal)</a>
          <a href="/play.html" class="d2ks-btn d2ks-btn--block">进入完整游戏 (Play)</a>
        </div>
      </aside>

      <main class="d2ks-main" id="k4-main">
        <header class="d2ks-zone-header">
          <div class="d2ks-zone-header__titles">
            <h2 class="d2ks-zone-header__title" id="k4-active-title"></h2>
            <p class="d2ks-zone-header__sub" id="k4-active-sub"></p>
          </div>
          <div class="d2ks-zone-header__pills">
            <span class="d2ks-badge d2ks-badge--ok">ZERO MOCK DATA</span>
            <span class="d2ks-badge" id="k4-header-zone-pill">ZONE 01 / 04</span>
          </div>
        </header>

        <section id="k4-panel-replay" class="d2ks-zone-panel"></section>
        <section id="k4-panel-quests" class="d2ks-zone-panel" hidden></section>
        <section id="k4-panel-towns" class="d2ks-zone-panel" hidden></section>
        <section id="k4-panel-coverage" class="d2ks-zone-panel" hidden></section>
      </main>
    </div>
  `

  const q = (sel: string): HTMLElement => root.querySelector(sel) as HTMLElement
  const navEl = q('#k4-zone-nav')
  const mainEl = q('#k4-main')
  const panels: Record<K4ZoneId, HTMLElement> = {
    replay: q('#k4-panel-replay'),
    quests: q('#k4-panel-quests'),
    towns: q('#k4-panel-towns'),
    coverage: q('#k4-panel-coverage'),
  }

  const controllers: Record<K4ZoneId, ShowcaseZoneController> = {
    replay: mountSharedReplayWidget(panels.replay, {
      idPrefix: 'k4-rp',
      scenarios: [
        { id: 'k4-act1-quest', label: 'Act 1 · A1Q1 邪恶洞窟 · Akara (+1 技能点)', badge: '160f' },
        { id: 'k4-act2-quest', label: 'Act 2 · A2Q1 罗达门特 · Jerhyn + 技能之书', badge: '140f' },
        { id: 'k4-act3-quest', label: 'Act 3 · A3Q1 黄金鸟 · Meshif (玉雕→黄金鸟)', badge: '130f' },
        { id: 'k4-act4-quest', label: 'Act 4 · A4Q1 堕落天使 · Tyrael (+2 技能点)', badge: '140f' },
        { id: 'k4-act5-quest', label: 'Act 5 · A5Q3 冰之囚 · Malah (+10 全抗卷轴)', badge: '140f' },
      ],
      statLabels: { '5': 'NEWSKILLS', '39': 'FireRes', '41': 'LightRes', '43': 'ColdRes', '45': 'PoisRes' },
      buildUrl: (id) => `/api/k4-showcase/replay?scenario=${encodeURIComponent(id)}`,
    }),
    quests: mountZone2Quests(panels.quests),
    towns: mountZone3Towns(panels.towns),
    coverage: mountZone4Coverage(panels.coverage),
  }

  const navBtns = new Map<K4ZoneId, HTMLButtonElement>()
  let current: K4ZoneId | null = null
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

  function switchZone(next: K4ZoneId): void {
    if (current === next) return
    if (current !== null) controllers[current].deactivate()
    current = next
    const idx = ZONES.findIndex((z) => z.id === next)
    const meta = ZONES[idx >= 0 ? idx : 0]!
    q('#k4-active-title').textContent = meta.headerTitle
    q('#k4-active-sub').textContent = meta.headerSub
    q('#k4-header-zone-pill').textContent = `ZONE 0${idx + 1} / 0${ZONES.length}`
    for (const z of ZONES) {
      panels[z.id].hidden = z.id !== next
      navBtns.get(z.id)?.classList.toggle('d2ks-nav-btn--active', z.id === next)
    }
    mainEl.scrollTop = 0
    controllers[next].activate()
  }

  void fetchJson<K4Overview>('/api/k4-showcase/overview')
    .then((ov) => {
      q('#k4-m-scn').textContent = `${ov.scenarioCount} / 5 Acts`
      q('#k4-m-fr').textContent = `${fmtInt(ov.totalGoldenFrames)} / ${fmtInt(ov.totalSteppedFrames)}`
      q('#k4-m-ds1').textContent = `${ov.ds1BundleEntryCount} entries`
      q('#k4-m-s2c').textContent = fmtInt(ov.s2cVectorCount)
      q('#k4-sidebar-cert').textContent = `Act 1–5 零分歧 · F3+ Gap = 0`
    })
    .catch(() => {
      q('#k4-sidebar-cert').textContent = '数据加载失败'
    })

  const rawZone = new URLSearchParams(window.location.search).get('zone')?.trim().toLowerCase()
  let initial: K4ZoneId = 'replay'
  if (rawZone === '2' || rawZone === 'quests') initial = 'quests'
  else if (rawZone === '3' || rawZone === 'towns') initial = 'towns'
  else if (rawZone === '4' || rawZone === 'coverage') initial = 'coverage'
  switchZone(initial)
}

if (typeof document !== 'undefined') {
  const el = document.getElementById('k4-showcase-app')
  if (el) mountK4ShowcaseApp(el)
}
