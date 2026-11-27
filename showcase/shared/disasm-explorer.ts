/**
 * Reusable 3-Column Function Disassembly / TS Source / Evidence Drawer
 * (`showcase/shared/disasm-explorer.ts`).
 */

import { escapeHtml, type SharedFnDetailResponse } from './types.ts'

export function renderFnDetailDrawer(
  container: HTMLElement,
  detail: SharedFnDetailResponse,
  onSelectFn?: (module: 'D2Common' | 'D2Game', va: string) => void,
): void {
  const statusPill =
    detail.status === 'diff-verified'
      ? 'd2ks-pill--ok'
      : detail.status === 'ported'
        ? 'd2ks-pill--warn'
        : 'd2ks-pill--err'

  const renderEdgeChips = (list: readonly { readonly key: string; readonly name: string; readonly status: string }[]): string => {
    if (list.length === 0) return '<span class="d2ks-muted">(none)</span>'
    return list
      .slice(0, 24)
      .map(
        (e) =>
          `<button type="button" class="d2ks-fn-chip" data-fn-key="${escapeHtml(e.key)}" title="${escapeHtml(e.name)} (${escapeHtml(e.status)})">${escapeHtml(e.key.split(':')[1] ?? e.key)} ${escapeHtml(e.name.slice(0, 22))}</button>`,
      )
      .join('')
  }

  container.innerHTML = `
    <div class="d2ks-panel">
      <div class="d2ks-panel__hdr">
        <h3 class="d2ks-panel__title d2ks-mono">${escapeHtml(detail.key)} · ${escapeHtml(detail.name)}</h3>
        <div class="d2ks-chip-wrap">
          <span class="d2ks-pill ${statusPill}">${escapeHtml(detail.status)}</span>
          <span class="d2ks-pill d2ks-pill--info">${escapeHtml(detail.subsystem)}</span>
          <span class="d2ks-badge d2ks-mono">${detail.size} B · topo L${detail.topoLevel}</span>
        </div>
      </div>

      <div class="d2ks-drawer-3col">
        <div class="d2ks-drawer-col">
          <div class="d2ks-drawer-col__hdr">
            <span>x86 Intel Disassembly (${escapeHtml(detail.disassembly.binaryName)})</span>
            <span class="d2ks-mono">${detail.disassembly.instructionCount} insns</span>
          </div>
          <pre class="d2ks-code-pre">${escapeHtml(detail.disassembly.text || '; (no disassembly)')}</pre>
        </div>

        <div class="d2ks-drawer-col">
          <div class="d2ks-drawer-col__hdr">
            <span>TypeScript 内核实现 (${escapeHtml(detail.tsSource.tsSymbol ?? '—')})</span>
            <span class="d2ks-mono">${
              detail.tsSource.startLine !== null ? `L${detail.tsSource.startLine}..L${detail.tsSource.endLine}` : '—'
            }</span>
          </div>
          <pre class="d2ks-code-pre">${escapeHtml(
            detail.tsSource.code ?? `// ${detail.kernFile ?? 'No kernFile bound'}\n// symbol: ${detail.tsSymbol ?? 'none'}`,
          )}</pre>
        </div>

        <div class="d2ks-drawer-col">
          <div class="d2ks-drawer-col__hdr">
            <span>元数据、差分证据与调用邻域</span>
            <span class="d2ks-mono">SCC #${detail.sccId}</span>
          </div>
          <div class="d2ks-evidence-box">
            <div><strong class="d2ks-gold">kernFile:</strong> <span class="d2ks-mono">${escapeHtml(detail.kernFile ?? '—')}</span></div>
            <div><strong class="d2ks-gold">tsSymbol:</strong> <span class="d2ks-mono">${escapeHtml(detail.tsSymbol ?? '—')}</span></div>
            <div><strong class="d2ks-gold">diffEvidence:</strong><div class="d2ks-muted">${escapeHtml(detail.diffEvidence ?? '(none)')}</div></div>
            <div><strong class="d2ks-gold">External Deps (${detail.externalDeps.length}):</strong><div class="d2ks-mono d2ks-muted">${escapeHtml(detail.externalDeps.join(', ') || '(pure)')}</div></div>
            <div><strong class="d2ks-gold">Callers (${detail.callers.length}):</strong><div class="d2ks-chip-wrap">${renderEdgeChips(detail.callers)}</div></div>
            <div><strong class="d2ks-gold">Callees (${detail.callees.length}):</strong><div class="d2ks-chip-wrap">${renderEdgeChips(detail.callees)}</div></div>
          </div>
        </div>
      </div>
    </div>
  `

  if (onSelectFn) {
    container.querySelectorAll<HTMLButtonElement>('[data-fn-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.fnKey ?? ''
        const [mod, va] = key.split(':')
        if ((mod === 'D2Common' || mod === 'D2Game') && va) {
          onSelectFn(mod, va)
        }
      })
    })
  }
}
