import { BADGE_BASELINE_Y, drawFramedBadge } from './framed-badge.ts'
import type { D2FontRenderer } from './font.ts'

const CENTER_X = 735
const WIDTH = 112

export interface AutoCombatBadge {
  readonly on: boolean
  readonly key: string
}

export const autoCombatBadgeLabel = ({ on, key }: AutoCombatBadge, lang: 'ENG' | 'CHI'): string => {
  const keyLabel = key === 'SPACE' ? (lang === 'ENG' ? 'Space' : '空格') : key
  return lang === 'ENG' ? `Auto-Fight ${on ? 'ON' : 'OFF'} (${keyLabel})` : `自动战斗 ${on ? '开' : '关'} (${keyLabel})`
}

export const drawAutoCombatBadge = (ctx: CanvasRenderingContext2D, font: D2FontRenderer, badge: AutoCombatBadge, offsetX: number, offsetY: number, lang: 'ENG' | 'CHI'): void =>
  drawFramedBadge(ctx, font, autoCombatBadgeLabel(badge, lang), offsetX + CENTER_X, offsetY + BADGE_BASELINE_Y, badge.on ? '#3c8c3c' : '#4a3e2c', badge.on ? 'green' : 'gray', WIDTH)
