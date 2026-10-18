import { createTogglePlugin } from '../../src/client/plugin-host/api.ts'

export const monsterResistsPlugin = createTogglePlugin({
  id: 'monster-resists',
  name: { zh: '怪物抗性', en: 'Monster Resists' },
  description: {
    zh: '非 1.13c 增强：悬停怪物时在血条下显示它的全部抗性数值（含精英词缀加成），而不只是免疫。',
    en: "Non-1.13c enhancement: shows a monster's resistances under its health bar when you hover it, including boosts from champion and unique modifiers, not just its immunities.",
  },
  port: (ctx) => ctx.monsterResists,
})
