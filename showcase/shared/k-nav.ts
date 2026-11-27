/**
 * Unified K0–K6 Milestone Showcase Cross-Navigation (`showcase/shared/k-nav.ts`).
 *
 * Rendered inside every showcase sidebar (`K0` through `K6`) for instant switching across the
 * full Diablo II v1.13c Isomorphic Kernel milestone ladder.
 */

export type KMilestoneId = 'K0' | 'K1' | 'K2' | 'K3' | 'K4' | 'K5' | 'K6'

export interface KShowcaseCatalogEntry {
  readonly id: KMilestoneId
  readonly href: string
  readonly shortTitle: string
  readonly fullTitle: string
}

export const K_SHOWCASE_CATALOG: readonly KShowcaseCatalogEntry[] = [
  { id: 'K0', href: '/k0-showcase.html', shortTitle: '底座门禁', fullTitle: '[K0] Phase 0 底座与 Go/No-Go' },
  { id: 'K1', href: '/k1-showcase.html', shortTitle: 'D2Common', fullTitle: '[K1] D2Common 1,479 同构内核' },
  { id: 'K2', href: '/k2-showcase.html', shortTitle: 'D2Game回放', fullTitle: '[K2] D2Game 回放收敛闭环' },
  { id: 'K3', href: '/k3-showcase.html', shortTitle: '技能召唤', fullTitle: '[K3] 9场景职业技能/召唤/光环/佣兵' },
  { id: 'K4', href: '/k4-showcase.html', shortTitle: '五幕任务', fullTitle: '[K4] Act 1–5 城镇 NPC AI 与任务状态机' },
  { id: 'K5', href: '/k5-showcase.html', shortTitle: '单机切换', fullTitle: '[K5] 单机内核切换、回环与多分辨率 E2E' },
  { id: 'K6', href: '/k6-showcase.html', shortTitle: '全量收官', fullTitle: '[K6] 4,810/4,810 实机闭环与 23 场景大满贯' },
] as const

export function renderKNavStripHtml(activeId: KMilestoneId, variant: 'd2ks' | 'k1' | 'k2' = 'd2ks'): string {
  const clsPrefix = variant === 'd2ks' ? 'd2ks' : variant
  const pills = K_SHOWCASE_CATALOG.map((entry) => {
    const active = entry.id === activeId ? ` ${clsPrefix}-k-pill--active` : ''
    const aria = entry.id === activeId ? ' aria-current="page"' : ''
    return `<a href="${entry.href}" class="${clsPrefix}-k-pill${active}" title="${entry.fullTitle}"${aria}>${entry.id}</a>`
  }).join('')

  return `
    <div class="${clsPrefix}-k-nav" aria-label="K0–K6 Milestone Showcases">
      <div class="${clsPrefix}-k-nav__label">K0–K6 里程碑成果展厅</div>
      <div class="${clsPrefix}-k-grid">${pills}</div>
    </div>
  `
}
