import { BADGE_BASELINE_Y, drawFramedBadge } from './framed-badge.ts'
import type { D2FontRenderer } from './font.ts'

const CENTER_X = 65

export type PotionShortageKind = 'life' | 'mana'

export const potionShortageLabel = (kind: PotionShortageKind, lang: 'ENG' | 'CHI'): string =>
  lang === 'ENG' ? `No ${kind === 'life' ? 'healing' : 'mana'} potions` : `没有${kind === 'life' ? '治疗' : '法力'}药剂`

export const drawPotionShortageBadge = (ctx: CanvasRenderingContext2D, font: D2FontRenderer, kind: PotionShortageKind, offsetX: number, offsetY: number, lang: 'ENG' | 'CHI'): void =>
  drawFramedBadge(ctx, font, potionShortageLabel(kind, lang), offsetX + CENTER_X, offsetY + BADGE_BASELINE_Y, '#8c3030', 'red')
