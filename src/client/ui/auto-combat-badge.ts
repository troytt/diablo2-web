import { BADGE_BASELINE_Y, drawFramedBadge, type FramedBadge } from './framed-badge.ts'
import type { D2FontRenderer } from './font.ts'

const CENTER_X = 735
const ON_PIP = '#52d84a'

export interface AutoCombatBadge {
  readonly on: boolean
  readonly key: string
}

export const autoCombatBadgeLook = ({ on, key }: AutoCombatBadge, lang: 'ENG' | 'CHI'): FramedBadge => ({
  label: lang === 'ENG' ? `Auto-Fight ${on ? 'on' : 'off'}` : `自动战斗 ${on ? '开' : '关'}`,
  hint: key === 'SPACE' ? (lang === 'ENG' ? 'Space' : '空格') : key,
  color: on ? 'white' : 'gray',
  pip: on ? ON_PIP : null,
})

export const drawAutoCombatBadge = (ctx: CanvasRenderingContext2D, font: D2FontRenderer, badge: AutoCombatBadge, offsetX: number, offsetY: number, lang: 'ENG' | 'CHI'): void =>
  drawFramedBadge(ctx, font, autoCombatBadgeLook(badge, lang), offsetX + CENTER_X, offsetY + BADGE_BASELINE_Y)
