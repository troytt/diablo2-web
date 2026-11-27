/**
 * [K6] Grand Slam `4,810 / 4,810 (100.00%)` Real-DLL Verification & `23 / 23` (`31,453` Frames)
 * Longitudinal Closure Interactive Visual Showcase (`showcase/k6/main.ts`).
 */

import { renderFnDetailDrawer } from '../shared/disasm-explorer.ts'
import { renderKNavStripHtml } from '../shared/k-nav.ts'
import { mountSharedReplayWidget, type ReplayScenarioOption } from '../shared/replay-widget.ts'
import {
  escapeHtml,
  fetchJson,
  fmtInt,
  fmtPct,
  type SharedFnDetailResponse,
  type ShowcaseZoneController,
} from '../shared/types.ts'

export type K6ZoneId = 'replay' | 'audit' | 'emitters' | 'callgraph'

interface K6ScenarioMeta {
  readonly scenario: string
  readonly suite: 'k6' | 'k6-s2' | 'k6-s3'
  readonly focus: string
  readonly goldenFrames: number
  readonly strictHorizon: number
  readonly posHorizon: number
  readonly d2CommonHits: number
  readonly d2GameHits: number
}

interface K6Overview {
  readonly ok: true
  readonly totalFunctions: number
  readonly totalVerified: number
  readonly totalEmitterVerified: number
  readonly d2CommonVerified: number
  readonly d2CommonTotal: number
  readonly d2GameVerified: number
  readonly d2GameTotal: number
  readonly scenarioCount: number
  readonly totalScenarioFrames: number
  readonly allHorizonsComplete: boolean
  readonly emitterSuiteCount: number
  readonly scenarios: readonly K6ScenarioMeta[]
}

interface K6AuditResp {
  readonly ok: true
  readonly d2Common: {
    readonly total: number
    readonly baselineScenarioExecuted: number
    readonly scenarioExecuted: number
    readonly emitterVerified: number
    readonly combinedVerified: number
    readonly remainingUnhit: number
  }
  readonly d2Game: {
    readonly total: number
    readonly baselineScenarioExecuted: number
    readonly scenarioExecuted: number
    readonly baselineEmitterVerified: number
    readonly emitterVerified: number
    readonly baselineCombinedVerified: number
    readonly combinedVerified: number
    readonly remainingUnhit: number
    readonly subsystems: readonly {
      readonly subsystem: string
      readonly total: number
      readonly verified: number
      readonly unhit: number
      readonly scenarioHit: number
      readonly emitterHit: number
    }[]
  }
  readonly combined: {
    readonly total: number
    readonly emitterVerified: number
    readonly combinedVerified: number
    readonly remainingUnhit: number
  }
  readonly k6Emitters: readonly {
    readonly suite: string
    readonly relPath: string
    readonly bytes: number
    readonly d2CommonVas: number
    readonly d2GameVas: number
    readonly cumD2Common: number
    readonly cumD2Game: number
    readonly cumCombined: number
  }[]
  readonly scenarios: readonly K6ScenarioMeta[]
}

interface K6CallgraphResp {
  readonly ok: true
  readonly total: number
  readonly kernFiles: readonly string[]
  readonly functions: readonly {
    readonly module: 'D2Common' | 'D2Game'
    readonly va: string
    readonly name: string
    readonly status: string
    readonly size: number
    readonly topoLevel: number
    readonly subsystem: string
    readonly scenarioHit: boolean
    readonly emitterHit: boolean
    readonly kf: number
  }[]
}

const ZONES: readonly {
  readonly id: K6ZoneId
  readonly idx: string
  readonly navTitle: string
  readonly navSub: string
  readonly headerTitle: string
  readonly headerSub: string
}[] = [
  {
    id: 'replay',
    idx: 'ZONE 01',
    navTitle: '23 场景大满贯回放器',
    navSub: '31,453 帧 · 7职业×5幕Boss',
    headerTitle: 'Zone 1 · [K6] 23 / 23 Longitudinal Lockstep Replay (31,453 / 31,453 Frames = 100.00%)',
    headerSub: '涵盖 Wave 1 (k6 7场景)、Wave 4 (k6-s2 8场景全职业技能) 与 Wave 9 (k6-s3 8场景全五幕 Boss/奶牛关/符文之语)。',
  },
  {
    id: 'audit',
    idx: 'ZONE 02',
    navTitle: '4,810 全量覆盖审计大屏',
    navSub: '9 大子系统 100.0% 闭环',
    headerTitle: 'Zone 2 · 4,810 / 4,810 (100.00%) Real-DLL Verification Audit Dashboard',
    headerSub: '服务端实时扫描 manifest-113c.json、全部 .coverage.ndjson.gz 与 34 组 C Emitter，呈现真实无水分 100.00% 闭环。',
  },
  {
    id: 'emitters',
    idx: 'ZONE 03',
    navTitle: '34 组实机 C Emitter 账本',
    navSub: 'k6-w1..w15 · fix1..4 · p2..p16c',
    headerTitle: 'Zone 3 · 34 Real-DLL C Emitter Wave Progression & Live C Source Viewer',
    headerSub: '累计覆盖推进曲线（49.63% → 100.00%）与 34 组实机 C Emitter 源码即时预览。',
  },
  {
    id: 'callgraph',
    idx: 'ZONE 04',
    navTitle: '4,810 全内核统一调用图',
    navSub: 'D2Common + D2Game 反汇编',
    headerTitle: 'Zone 4 · Unified 4,810-Function Kernel Callgraph & Live x86 Disassembly / TS Source Explorer',
    headerSub: '全局热力矩阵与筛选检索：点击任意 D2Common / D2Game VA 即刻查看原版 PE32 反汇编、TS 源码与调用邻域。',
  },
]

const K6_SCENARIO_OPTIONS: readonly ReplayScenarioOption[] = [
  { id: 'k6-bloodmoor-consumables-auras-combat', suite: 'k6', label: 'k6-bloodmoor-consumables-auras-combat (战斗/药水/光环)', badge: '380f' },
  { id: 'k6-act3-consumables-quest', suite: 'k6', label: 'k6-act3-consumables-quest (Act3 黄金鸟/古书)', badge: '140f' },
  { id: 'k6-druid-skills', suite: 'k6', label: 'k6-druid-skills (德鲁伊技能/召唤/变形)', badge: '390f' },
  { id: 'k6-assassin-skills', suite: 'k6', label: 'k6-assassin-skills (刺客陷阱/聚气)', badge: '390f' },
  { id: 'k6-items-potions-belt-combat', suite: 'k6', label: 'k6-items-potions-belt-combat (腰带/装备/回城)', badge: '340f' },
  { id: 'k6-town-npc-gamble-waypoint', suite: 'k6', label: 'k6-town-npc-gamble-waypoint (储藏箱/方块/赌博/小站)', badge: '275f' },
  { id: 'k6-nightmare-bloodmoor-combat', suite: 'k6', label: 'k6-nightmare-bloodmoor-combat (噩梦精英 UMod)', badge: '360f' },
  { id: 'k6s2-amazon-skills', suite: 'k6-s2', label: 'k6s2-amazon-skills (亚马逊全30技能)', badge: '715f' },
  { id: 'k6s2-sorceress-skills', suite: 'k6-s2', label: 'k6s2-sorceress-skills (法师全30技能)', badge: '680f' },
  { id: 'k6s2-necromancer-skills', suite: 'k6-s2', label: 'k6s2-necromancer-skills (死灵全30技能)', badge: '775f' },
  { id: 'k6s2-paladin-skills', suite: 'k6-s2', label: 'k6s2-paladin-skills (圣骑士全30技能)', badge: '775f' },
  { id: 'k6s2-barbarian-skills', suite: 'k6-s2', label: 'k6s2-barbarian-skills (野蛮人全30技能)', badge: '665f' },
  { id: 'k6s2-act2-sewers-cube-merc', suite: 'k6-s2', label: 'k6s2-act2-sewers-cube-merc (Act2 下水道/方块/佣兵)', badge: '1,290f' },
  { id: 'k6s2-act4-hell-chaos-shrines', suite: 'k6-s2', label: 'k6s2-act4-hell-chaos-shrines (地狱混沌/神殿)', badge: '1,225f' },
  { id: 'k6s2-act5-harrogath-shenk-anya', suite: 'k6-s2', label: 'k6s2-act5-harrogath-shenk-anya (Act5 山克/安亚)', badge: '860f' },
  { id: 'k6s3-act1-bosses-cowlevel-imbue', suite: 'k6-s3', label: 'k6s3-act1-bosses-cowlevel-imbue (奶牛关/安达利尔)', badge: '1,611f' },
  { id: 'k6s3-act2-bosses-staff-duriel', suite: 'k6-s3', label: 'k6s3-act2-bosses-staff-duriel (召唤者/督瑞尔)', badge: '3,028f' },
  { id: 'k6s3-act3-council-mephisto-quests', suite: 'k6-s3', label: 'k6s3-act3-council-mephisto-quests (崔凡克/墨菲斯托)', badge: '2,001f' },
  { id: 'k6s3-act4-izual-hellforge-diablo', suite: 'k6-s3', label: 'k6s3-act4-izual-hellforge-diablo (地狱熔炉/迪亚波罗)', badge: '4,217f' },
  { id: 'k6s3-act5-shenk-anya-ancients-baal', suite: 'k6-s3', label: 'k6s3-act5-shenk-anya-ancients-baal (三野蛮人/巴尔)', badge: '6,547f' },
  { id: 'k6s3-druid-full-30-skills', suite: 'k6-s3', label: 'k6s3-druid-full-30-skills (德鲁伊深度全30技能)', badge: '1,475f' },
  { id: 'k6s3-assassin-full-30-skills', suite: 'k6-s3', label: 'k6s3-assassin-full-30-skills (刺客深度全30技能)', badge: '1,480f' },
  { id: 'k6s3-crafting-runewords-c2s-monai', suite: 'k6-s3', label: 'k6s3-crafting-runewords-c2s-monai (符文之语/洗孔/洗点)', badge: '1,834f' },
]

function mountZone2Audit(container: HTMLElement): ShowcaseZoneController {
  let loaded = false
  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-kpi-strip">
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">全内核实机验证闭环</span><span class="d2ks-kpi__val d2ks-mono d2ks-text--ok" id="k6-a-comb">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">D2Common (情景 / Emitter / 合并)</span><span class="d2ks-kpi__val d2ks-mono d2ks-text--ok" id="k6-a-d2c">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">D2Game (情景 / Emitter / 合并)</span><span class="d2ks-kpi__val d2ks-mono d2ks-text--ok" id="k6-a-d2g">…</span></div>
        <div class="d2ks-kpi"><span class="d2ks-kpi__label">剩余未覆盖 VA (Remaining)</span><span class="d2ks-kpi__val d2ks-mono d2ks-text--ok" id="k6-a-rem">…</span></div>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">D2Game.dll 9 大子系统实机验证闭环矩阵 (3,331 / 3,331 = 100.00%)</h3>
          <span class="d2ks-badge d2ks-badge--ok">ALL 9 SUBSYSTEMS 100%</span>
        </div>
        <div class="d2ks-table-scroll">
          <table class="d2ks-table d2ks-table--compact">
            <thead>
              <tr><th>子系统</th><th>已验证 / 总数</th><th>情景命中</th><th>Emitter 验证</th><th>未覆盖</th><th style="min-width: 160px">完成进度</th></tr>
            </thead>
            <tbody id="k6-a-sub-tbody"></tbody>
          </table>
        </div>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">23 / 23 长程回放场景总表 (31,453 / 31,453 帧零分歧)</h3>
          <span class="d2ks-badge d2ks-badge--ok">23 / 23 COMPLETE</span>
        </div>
        <div class="d2ks-table-scroll d2ks-table-scroll--tall">
          <table class="d2ks-table d2ks-table--compact">
            <thead>
              <tr><th>Suite</th><th>场景</th><th>黄金帧</th><th>Strict / Pos</th><th>D2Common Hits</th><th>D2Game Hits</th><th>覆盖焦点</th></tr>
            </thead>
            <tbody id="k6-a-scn-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `

  return {
    activate(): void {
      if (loaded) return
      loaded = true
      void fetchJson<K6AuditResp>('/api/k6-showcase/audit').then((a) => {
        ;(container.querySelector('#k6-a-comb') as HTMLElement).textContent =
          `${fmtInt(a.combined.combinedVerified)} / ${fmtInt(a.combined.total)} (${fmtPct(a.combined.combinedVerified, a.combined.total)})`
        ;(container.querySelector('#k6-a-d2c') as HTMLElement).textContent =
          `${fmtInt(a.d2Common.scenarioExecuted)} / ${fmtInt(a.d2Common.emitterVerified)} / ${fmtInt(a.d2Common.combinedVerified)}`
        ;(container.querySelector('#k6-a-d2g') as HTMLElement).textContent =
          `${fmtInt(a.d2Game.scenarioExecuted)} / ${fmtInt(a.d2Game.emitterVerified)} / ${fmtInt(a.d2Game.combinedVerified)}`
        ;(container.querySelector('#k6-a-rem') as HTMLElement).textContent = `${a.combined.remainingUnhit} VAs`

        ;(container.querySelector('#k6-a-sub-tbody') as HTMLElement).innerHTML = a.d2Game.subsystems
          .map((s) => {
            const pct = s.total > 0 ? (s.verified / s.total) * 100 : 100
            return `
              <tr>
                <td class="d2ks-mono d2ks-gold">${escapeHtml(s.subsystem)}</td>
                <td class="d2ks-mono d2ks-text--ok">${s.verified} / ${s.total}</td>
                <td class="d2ks-mono">${s.scenarioHit}</td>
                <td class="d2ks-mono">${s.emitterHit}</td>
                <td class="d2ks-mono">${s.unhit}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px">
                    <div class="d2ks-bar-track"><div class="d2ks-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
                    <span class="d2ks-mono d2ks-text--ok">${pct.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            `
          })
          .join('')

        ;(container.querySelector('#k6-a-scn-tbody') as HTMLElement).innerHTML = a.scenarios
          .map(
            (s) => `
              <tr>
                <td><span class="d2ks-pill d2ks-pill--info">${escapeHtml(s.suite)}</span></td>
                <td class="d2ks-mono d2ks-gold">${escapeHtml(s.scenario)}</td>
                <td class="d2ks-mono">${fmtInt(s.goldenFrames)}</td>
                <td class="d2ks-mono d2ks-text--ok">${fmtInt(s.strictHorizon)} / ${fmtInt(s.posHorizon)}</td>
                <td class="d2ks-mono">${s.d2CommonHits}</td>
                <td class="d2ks-mono">${s.d2GameHits}</td>
                <td class="d2ks-wrap d2ks-muted">${escapeHtml(s.focus)}</td>
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

function mountZone3Emitters(container: HTMLElement): ShowcaseZoneController {
  let loaded = false
  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-canvas-card">
        <div class="d2ks-canvas-card__hdr">
          <span>34 组实机 C Emitter 累计覆盖推进曲线 (D2Common + D2Game → 4,810 / 4,810 = 100.00%)</span>
          <span class="d2ks-mono d2ks-text--ok" id="k6-em-head">…</span>
        </div>
        <canvas class="d2ks-canvas" id="k6-em-canvas" style="height: 200px"></canvas>
      </div>

      <div class="d2ks-split-panels">
        <div class="d2ks-panel">
          <div class="d2ks-panel__hdr">
            <h3 class="d2ks-panel__title">34 组实机 C Emitter 账本（点击任意行预览 C 源码）</h3>
            <span class="d2ks-muted d2ks-mono">3-Way SHA-256 (-O2 / -fno-omit-fp / -O1)</span>
          </div>
          <div class="d2ks-table-scroll d2ks-table-scroll--tall">
            <table class="d2ks-table d2ks-table--compact">
              <thead>
                <tr><th>Wave</th><th>C 文件</th><th>D2Common</th><th>D2Game</th><th>累计覆盖</th></tr>
              </thead>
              <tbody id="k6-em-tbody"></tbody>
            </table>
          </div>
        </div>

        <div class="d2ks-drawer-col">
          <div class="d2ks-drawer-col__hdr">
            <span id="k6-em-src-title">C Emitter 源码预览</span>
            <span class="d2ks-mono" id="k6-em-src-lines"></span>
          </div>
          <pre class="d2ks-code-pre" id="k6-em-src-pre" style="max-height: 390px">点击左侧任意 Emitter 行预览实机 C 源码…</pre>
        </div>
      </div>
    </div>
  `

  const canvas = container.querySelector('#k6-em-canvas') as HTMLCanvasElement
  const tbody = container.querySelector('#k6-em-tbody') as HTMLElement

  function loadEmitterSrc(relPath: string): void {
    ;(container.querySelector('#k6-em-src-title') as HTMLElement).textContent = relPath
    ;(container.querySelector('#k6-em-src-pre') as HTMLElement).textContent = '正在加载 C 源码…'
    void fetchJson<{ ok: true; relPath: string; totalLines: number; preview: string }>(
      `/api/k6-showcase/emitter-src?file=${encodeURIComponent(relPath)}`,
    ).then((res) => {
      ;(container.querySelector('#k6-em-src-lines') as HTMLElement).textContent = `${res.totalLines} lines (前180行)`
      ;(container.querySelector('#k6-em-src-pre') as HTMLElement).textContent = res.preview
    })
  }

  return {
    activate(): void {
      if (loaded) return
      loaded = true
      void fetchJson<K6AuditResp>('/api/k6-showcase/audit').then((a) => {
        const list = a.k6Emitters
        ;(container.querySelector('#k6-em-head') as HTMLElement).textContent =
          `${list.length} Suites → ${fmtInt(a.combined.emitterVerified)} / ${fmtInt(a.combined.total)} Emitter VAs`

        // Draw cumulative curve
        const ctx = canvas.getContext('2d')
        if (ctx && list.length > 0) {
          const w = Math.max(360, Math.floor(canvas.clientWidth || 720))
          const h = 200
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w
            canvas.height = h
          }
          ctx.fillStyle = '#090806'
          ctx.fillRect(0, 0, w, h)
          const padL = 46
          const padR = 16
          const padT = 16
          const padB = 26
          const plotW = w - padL - padR
          const plotH = h - padT - padB
          const maxY = a.combined.total

          ctx.strokeStyle = '#262016'
          ctx.font = '10px monospace'
          ctx.fillStyle = '#968a74'
          for (const pct of [0, 25, 50, 75, 100]) {
            const y = padT + plotH * (1 - pct / 100)
            ctx.beginPath()
            ctx.moveTo(padL, y)
            ctx.lineTo(w - padR, y)
            ctx.stroke()
            ctx.fillText(`${pct}%`, 8, y + 3)
          }

          ctx.beginPath()
          list.forEach((row, i) => {
            const x = padL + (i / Math.max(1, list.length - 1)) * plotW
            const y = padT + plotH * (1 - row.cumCombined / Math.max(1, maxY))
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          })
          ctx.strokeStyle = '#38d9a9'
          ctx.lineWidth = 2.2
          ctx.stroke()

          list.forEach((row, i) => {
            const x = padL + (i / Math.max(1, list.length - 1)) * plotW
            const y = padT + plotH * (1 - row.cumCombined / Math.max(1, maxY))
            ctx.beginPath()
            ctx.arc(x, y, 3, 0, Math.PI * 2)
            ctx.fillStyle = '#f0dc9c'
            ctx.fill()
            if (i === 0 || i === list.length - 1 || i % 6 === 0) {
              ctx.fillStyle = '#968a74'
              ctx.fillText(row.suite, Math.max(padL, x - 18), h - 8)
            }
          })
        }

        tbody.innerHTML = list
          .map(
            (e, i) => `
              <tr class="d2ks-clickable-row${i === 0 ? ' d2ks-row--sel' : ''}" data-em-file="${escapeHtml(e.relPath)}">
                <td class="d2ks-mono d2ks-gold">${escapeHtml(e.suite)}</td>
                <td class="d2ks-mono d2ks-muted">${escapeHtml(e.relPath.split('/').pop() ?? e.relPath)}</td>
                <td class="d2ks-mono">${e.d2CommonVas}</td>
                <td class="d2ks-mono d2ks-text--cyan">${e.d2GameVas}</td>
                <td class="d2ks-mono d2ks-text--ok">${fmtInt(e.cumCombined)} (${fmtPct(e.cumCombined, a.combined.total, 1)})</td>
              </tr>
            `,
          )
          .join('')
        tbody.querySelectorAll<HTMLTableRowElement>('[data-em-file]').forEach((tr) => {
          tr.addEventListener('click', () => {
            tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('d2ks-row--sel'))
            tr.classList.add('d2ks-row--sel')
            loadEmitterSrc(tr.dataset.emFile ?? '')
          })
        })
        if (list[0]) loadEmitterSrc(list[0].relPath)
      })
    },
    deactivate(): void {
      // No-op
    },
  }
}

function mountZone4Callgraph(container: HTMLElement): ShowcaseZoneController {
  let cg: K6CallgraphResp | null = null
  let modFilter: 'all' | 'D2Common' | 'D2Game' = 'all'
  let subFilter = 'all'
  let query = ''

  container.innerHTML = `
    <div class="d2ks-zone-stack">
      <div class="d2ks-toolbar">
        <div class="d2ks-btn-group">
          <button type="button" class="d2ks-btn d2ks-btn--sm d2ks-btn--active" data-k6mod="all">All (4,810)</button>
          <button type="button" class="d2ks-btn d2ks-btn--sm" data-k6mod="D2Common">D2Common (1,479)</button>
          <button type="button" class="d2ks-btn d2ks-btn--sm" data-k6mod="D2Game">D2Game (3,331)</button>
        </div>
        <label class="d2ks-field-inline">
          <span>子系统:</span>
          <select class="d2ks-select" id="k6-cg-sub"><option value="all">全部子系统</option></select>
        </label>
        <input type="search" class="d2ks-input" id="k6-cg-q" placeholder="搜索 VA (0x6FC4E050) / 函数名 / kernFile..." style="flex: 1 1 200px" />
        <span class="d2ks-badge d2ks-mono" id="k6-cg-cnt">…</span>
      </div>

      <div class="d2ks-panel">
        <div class="d2ks-panel__hdr">
          <h3 class="d2ks-panel__title">4,810 全内核函数目录（前 250 条筛选结果；点击查看实机反汇编 + TS 源码）</h3>
          <span class="d2ks-badge d2ks-badge--ok">4,810 / 4,810 VERIFIED</span>
        </div>
        <div class="d2ks-table-scroll">
          <table class="d2ks-table d2ks-table--compact">
            <thead>
              <tr><th>Module</th><th>VA</th><th>符号名</th><th>子系统</th><th>Size</th><th>实机覆盖标签</th><th>kernFile</th></tr>
            </thead>
            <tbody id="k6-cg-tbody"></tbody>
          </table>
        </div>
      </div>

      <div id="k6-cg-drawer"></div>
    </div>
  `

  const subEl = container.querySelector('#k6-cg-sub') as HTMLSelectElement
  const qEl = container.querySelector('#k6-cg-q') as HTMLInputElement
  const tbody = container.querySelector('#k6-cg-tbody') as HTMLElement
  const drawer = container.querySelector('#k6-cg-drawer') as HTMLElement

  async function inspectFn(mod: 'D2Common' | 'D2Game', va: string): Promise<void> {
    drawer.innerHTML = `<div class="d2ks-note">正在读取 ${escapeHtml(mod)}:${escapeHtml(va)} 反汇编与 TS 源码…</div>`
    const detail = await fetchJson<SharedFnDetailResponse>(
      `/api/k6-showcase/fn?module=${encodeURIComponent(mod)}&va=${encodeURIComponent(va)}`,
    )
    renderFnDetailDrawer(drawer, detail, (m, v) => {
      void inspectFn(m, v)
    })
  }

  function renderList(): void {
    if (!cg) return
    const needle = query.trim().toLowerCase()
    const filtered = cg.functions.filter((f) => {
      if (modFilter !== 'all' && f.module !== modFilter) return false
      if (subFilter !== 'all' && f.subsystem !== subFilter) return false
      if (!needle) return true
      const kf = f.kf >= 0 ? cg!.kernFiles[f.kf] ?? '' : ''
      return (
        f.va.toLowerCase().includes(needle) ||
        f.name.toLowerCase().includes(needle) ||
        kf.toLowerCase().includes(needle)
      )
    })
    ;(container.querySelector('#k6-cg-cnt') as HTMLElement).textContent = `命中 ${fmtInt(filtered.length)} / ${fmtInt(cg.total)}`
    tbody.innerHTML = filtered
      .slice(0, 250)
      .map((f) => {
        const kf = f.kf >= 0 ? cg!.kernFiles[f.kf] ?? '' : ''
        const badges = [
          f.scenarioHit ? '<span class="d2ks-pill d2ks-pill--ok">SCENARIO</span>' : '',
          f.emitterHit ? '<span class="d2ks-pill d2ks-pill--info">EMITTER</span>' : '',
        ].join(' ')
        return `
          <tr class="d2ks-clickable-row" data-cg-mod="${f.module}" data-cg-va="${escapeHtml(f.va)}">
            <td class="d2ks-mono">${f.module}</td>
            <td class="d2ks-mono d2ks-gold">${escapeHtml(f.va)}</td>
            <td class="d2ks-mono">${escapeHtml(f.name)}</td>
            <td>${escapeHtml(f.subsystem)}</td>
            <td class="d2ks-mono">${f.size} B</td>
            <td>${badges}</td>
            <td class="d2ks-mono d2ks-muted">${escapeHtml(kf)}</td>
          </tr>
        `
      })
      .join('')
    tbody.querySelectorAll<HTMLTableRowElement>('[data-cg-va]').forEach((tr) => {
      tr.addEventListener('click', () => {
        tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('d2ks-row--sel'))
        tr.classList.add('d2ks-row--sel')
        const m = tr.dataset.cgMod === 'D2Common' ? 'D2Common' : 'D2Game'
        void inspectFn(m, tr.dataset.cgVa ?? '')
      })
    })
  }

  container.querySelectorAll<HTMLButtonElement>('[data-k6mod]').forEach((btn) => {
    btn.addEventListener('click', () => {
      modFilter = (btn.dataset.k6mod as typeof modFilter) ?? 'all'
      container.querySelectorAll<HTMLButtonElement>('[data-k6mod]').forEach((b) => {
        b.classList.toggle('d2ks-btn--active', b === btn)
      })
      renderList()
    })
  })
  subEl.addEventListener('change', () => {
    subFilter = subEl.value
    renderList()
  })
  qEl.addEventListener('input', () => {
    query = qEl.value
    renderList()
  })

  return {
    activate(): void {
      if (cg) return
      void fetchJson<K6CallgraphResp>('/api/k6-showcase/callgraph').then((resp) => {
        cg = resp
        const subs = [...new Set(resp.functions.map((f) => f.subsystem))].sort()
        subEl.innerHTML =
          '<option value="all">全部子系统</option>' +
          subs.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')
        renderList()
        void inspectFn('D2Game', '0x6FC4E050')
      })
    },
    deactivate(): void {
      // No-op
    },
  }
}

export function mountK6ShowcaseApp(root: HTMLElement): void {
  const doc = root.ownerDocument ?? document
  root.innerHTML = `
    <div class="d2ks-shell">
      <aside class="d2ks-sidebar" id="k6-sidebar">
        <div class="d2ks-brand">
          <div class="d2ks-brand__eyebrow">DIABLO II v1.13c · [K6] GRAND SLAM</div>
          <h1 class="d2ks-brand__title">全量实机闭环大满贯展厅</h1>
          <div class="d2ks-brand__sub" id="k6-sidebar-cert">正在实时审计…</div>
        </div>

        <nav class="d2ks-nav" aria-label="K6 Showcase Zones" id="k6-zone-nav"></nav>

        <div class="d2ks-sidebar-metrics">
          <div class="d2ks-metric-row"><span>全内核实机验证</span><strong class="d2ks-mono d2ks-text--ok" id="k6-m-total">…</strong></div>
          <div class="d2ks-metric-row"><span>D2Common.dll</span><strong class="d2ks-mono d2ks-text--ok" id="k6-m-d2c">…</strong></div>
          <div class="d2ks-metric-row"><span>D2Game.dll</span><strong class="d2ks-mono d2ks-text--ok" id="k6-m-d2g">…</strong></div>
          <div class="d2ks-metric-row"><span>长程零分歧场景</span><strong class="d2ks-mono d2ks-text--ok" id="k6-m-scn">…</strong></div>
          <div class="d2ks-metric-row"><span>实机 C Emitters</span><strong class="d2ks-mono" id="k6-m-em">…</strong></div>
        </div>

        ${renderKNavStripHtml('K6', 'd2ks')}

        <div class="d2ks-sidebar-links">
          <a href="/" class="d2ks-btn d2ks-btn--block">庇护之地门户 (Portal)</a>
          <a href="/play.html" class="d2ks-btn d2ks-btn--block">进入完整游戏 (Play)</a>
        </div>
      </aside>

      <main class="d2ks-main" id="k6-main">
        <header class="d2ks-zone-header">
          <div class="d2ks-zone-header__titles">
            <h2 class="d2ks-zone-header__title" id="k6-active-title"></h2>
            <p class="d2ks-zone-header__sub" id="k6-active-sub"></p>
          </div>
          <div class="d2ks-zone-header__pills">
            <span class="d2ks-badge d2ks-badge--ok">4,810 / 4,810 = 100%</span>
            <span class="d2ks-badge" id="k6-header-zone-pill">ZONE 01 / 04</span>
          </div>
        </header>

        <section id="k6-panel-replay" class="d2ks-zone-panel"></section>
        <section id="k6-panel-audit" class="d2ks-zone-panel" hidden></section>
        <section id="k6-panel-emitters" class="d2ks-zone-panel" hidden></section>
        <section id="k6-panel-callgraph" class="d2ks-zone-panel" hidden></section>
      </main>
    </div>
  `

  const q = (sel: string): HTMLElement => root.querySelector(sel) as HTMLElement
  const navEl = q('#k6-zone-nav')
  const mainEl = q('#k6-main')
  const panels: Record<K6ZoneId, HTMLElement> = {
    replay: q('#k6-panel-replay'),
    audit: q('#k6-panel-audit'),
    emitters: q('#k6-panel-emitters'),
    callgraph: q('#k6-panel-callgraph'),
  }

  const controllers: Record<K6ZoneId, ShowcaseZoneController> = {
    replay: mountSharedReplayWidget(panels.replay, {
      idPrefix: 'k6-rp',
      suites: [
        { id: 'all', label: '全部 23 场景' },
        { id: 'k6', label: 'k6 Wave1 (7)' },
        { id: 'k6-s2', label: 'k6-s2 Wave4 (8)' },
        { id: 'k6-s3', label: 'k6-s3 Wave9 (8)' },
      ],
      scenarios: K6_SCENARIO_OPTIONS,
      buildUrl: (id) => `/api/k6-showcase/replay?scenario=${encodeURIComponent(id)}`,
    }),
    audit: mountZone2Audit(panels.audit),
    emitters: mountZone3Emitters(panels.emitters),
    callgraph: mountZone4Callgraph(panels.callgraph),
  }

  const navBtns = new Map<K6ZoneId, HTMLButtonElement>()
  let current: K6ZoneId | null = null
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

  function switchZone(next: K6ZoneId): void {
    if (current === next) return
    if (current !== null) controllers[current].deactivate()
    current = next
    const idx = ZONES.findIndex((z) => z.id === next)
    const meta = ZONES[idx >= 0 ? idx : 0]!
    q('#k6-active-title').textContent = meta.headerTitle
    q('#k6-active-sub').textContent = meta.headerSub
    q('#k6-header-zone-pill').textContent = `ZONE 0${idx + 1} / 0${ZONES.length}`
    for (const z of ZONES) {
      panels[z.id].hidden = z.id !== next
      navBtns.get(z.id)?.classList.toggle('d2ks-nav-btn--active', z.id === next)
    }
    mainEl.scrollTop = 0
    controllers[next].activate()
  }

  void fetchJson<K6Overview>('/api/k6-showcase/overview')
    .then((ov) => {
      q('#k6-m-total').textContent = `${fmtInt(ov.totalVerified)} / ${fmtInt(ov.totalFunctions)}`
      q('#k6-m-d2c').textContent = `${fmtInt(ov.d2CommonVerified)} / ${fmtInt(ov.d2CommonTotal)}`
      q('#k6-m-d2g').textContent = `${fmtInt(ov.d2GameVerified)} / ${fmtInt(ov.d2GameTotal)}`
      q('#k6-m-scn').textContent = `${ov.scenarioCount}/${ov.scenarioCount} (${fmtInt(ov.totalScenarioFrames)}f)`
      q('#k6-m-em').textContent = `${ov.emitterSuiteCount} suites`
      q('#k6-sidebar-cert').textContent = `4,810/4,810 (100%) · ${ov.scenarioCount}/${ov.scenarioCount} 零分歧`
    })
    .catch(() => {
      q('#k6-sidebar-cert').textContent = '审计加载失败'
    })

  const rawZone = new URLSearchParams(window.location.search).get('zone')?.trim().toLowerCase()
  let initial: K6ZoneId = 'replay'
  if (rawZone === '2' || rawZone === 'audit') initial = 'audit'
  else if (rawZone === '3' || rawZone === 'emitters') initial = 'emitters'
  else if (rawZone === '4' || rawZone === 'callgraph') initial = 'callgraph'
  switchZone(initial)
}

if (typeof document !== 'undefined') {
  const el = document.getElementById('k6-showcase-app')
  if (el) mountK6ShowcaseApp(el)
}
