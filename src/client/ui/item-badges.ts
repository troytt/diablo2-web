import type { UpgradeVerdict } from '../../common/items/item-comparison.ts'
import type { D2FontRenderer } from './font.ts'

export type ItemBadge =
  | { readonly kind: 'upgrade'; readonly verdict: UpgradeVerdict }
  | { readonly kind: 'sockets'; readonly count: number }
  | { readonly kind: 'ethereal' }
  | { readonly kind: 'level'; readonly level: number }

type BadgeOf<K extends ItemBadge['kind']> = Extract<ItemBadge, { readonly kind: K }>
interface BadgeArt<B extends ItemBadge> {
  readonly width: (badge: B, font: D2FontRenderer) => number
  readonly draw: (ctx: CanvasRenderingContext2D, badge: B, font: D2FontRenderer, x: number, cy: number) => void
}

const GAP = 6
const LEAD = 4
const EDGE = 'rgba(0, 0, 0, 0.85)'
const ARROW = { width: 8, pitch: 9 }
const SOLID_ARROW = ['#38d838', '#38d838', 0.6] as const
const ARROWS: Record<UpgradeVerdict, { readonly count: number; readonly ink: readonly [string | null, string, number] }> = {
  'much-better': { count: 2, ink: SOLID_ARROW },
  better: { count: 1, ink: SOLID_ARROW },
  unsure: { count: 1, ink: [null, '#d8b040', 1.2] },
}
const SOCKET = { pitch: 7, radius: 2.5, fill: '#0c0c0c', ring: '#b4b4b4' }
const ETHEREAL = { width: 8, fill: 'rgba(130, 190, 255, 0.4)', ring: '#a8d4ff' }
const LEVEL = { lead: 5, divider: 'rgba(200, 161, 90, 0.45)' }
const levelText = (level: number) => `ilvl ${level}`
const UPGRADE_SUFFIX: Record<UpgradeVerdict, string> = { 'much-better': ' '.repeat(3), better: ' '.repeat(2), unsure: ' '.repeat(2) }
const TOOLTIP_MARK_LIFT = 5

const polygon = (ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[]) => {
  ctx.beginPath()
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.closePath()
}

const paint = (ctx: CanvasRenderingContext2D, fill: string | null, stroke: string, lineWidth = 1) => {
  if (fill !== null) Object.assign(ctx, { fillStyle: fill }).fill()
  Object.assign(ctx, { strokeStyle: stroke, lineWidth }).stroke()
}

const ART: { readonly [K in ItemBadge['kind']]: BadgeArt<BadgeOf<K>> } = {
  upgrade: {
    width: ({ verdict }) => ARROW.pitch * ARROWS[verdict].count - (ARROW.pitch - ARROW.width),
    draw: (ctx, { verdict }, _font, x, cy) =>
      Array.from({ length: ARROWS[verdict].count }, (_, i) => x + i * ARROW.pitch).forEach((left) => {
        polygon(ctx, [[left, cy + 4], [left + ARROW.width / 2, cy - 4], [left + ARROW.width, cy + 4]])
        paint(ctx, null, EDGE, 2.5)
        paint(ctx, ...ARROWS[verdict].ink)
      }),
  },
  sockets: {
    width: ({ count }) => SOCKET.pitch * count - (SOCKET.pitch - SOCKET.radius * 2),
    draw: (ctx, { count }, _font, x, cy) =>
      Array.from({ length: count }, (_, i) => x + SOCKET.radius + i * SOCKET.pitch).forEach((center) => {
        ctx.beginPath()
        ctx.arc(center, cy, SOCKET.radius, 0, Math.PI * 2)
        paint(ctx, SOCKET.fill, SOCKET.ring)
      }),
  },
  ethereal: {
    width: () => ETHEREAL.width,
    draw: (ctx, _badge, _font, x, cy) => {
      polygon(ctx, [[x + ETHEREAL.width / 2, cy - 5], [x + ETHEREAL.width, cy], [x + ETHEREAL.width / 2, cy + 5], [x, cy]])
      paint(ctx, ETHEREAL.fill, ETHEREAL.ring)
    },
  },
  level: {
    width: ({ level }, font) => font.measureText(levelText(level), 'font8') + LEVEL.lead,
    draw: (ctx, { level }, font, x, cy) => {
      Object.assign(ctx, { fillStyle: LEVEL.divider }).fillRect(Math.round(x), Math.round(cy - 5), 1, 11)
      font.drawText(ctx, levelText(level), x + LEVEL.lead, cy + 4, { font: 'font8', color: 'tan', shadow: true })
    },
  },
}

const artOf = <B extends ItemBadge>(badge: B) => ART[badge.kind] as unknown as BadgeArt<B>

export const badgesWidth = (badges: readonly ItemBadge[], font: D2FontRenderer): number => badges.reduce((sum, badge) => sum + GAP + artOf(badge).width(badge, font), badges.length > 0 ? LEAD : 0)

export function drawBadges(ctx: CanvasRenderingContext2D, font: D2FontRenderer, badges: readonly ItemBadge[], x: number, cy: number): void {
  if (badges.length === 0) return
  ctx.save()
  ctx.lineJoin = 'round'
  badges.reduce((left, badge) => {
    artOf(badge).draw(ctx, badge, font, left + GAP, cy)
    return left + GAP + artOf(badge).width(badge, font)
  }, x + LEAD)
  ctx.restore()
}

export const upgradeSuffix = (verdict: UpgradeVerdict | null): string => (verdict ? UPGRADE_SUFFIX[verdict] : '')

export function drawUpgradeMarks(ctx: CanvasRenderingContext2D, font: D2FontRenderer, text: string, verdict: UpgradeVerdict | null, centerX: number, baselineY: number): void {
  const badges: ItemBadge[] = verdict ? [{ kind: 'upgrade', verdict }] : []
  drawBadges(ctx, font, badges, centerX + font.measureText(text, 'font16') / 2 - badgesWidth(badges, font), baselineY - TOOLTIP_MARK_LIFT)
}
