/**
 * Monster Resists (`monster-resists`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import { createTogglePlugin } from '../../src/client/plugin-host/api.ts'

export const monsterResistsPlugin = createTogglePlugin({
  id: 'monster-resists',
  author: 'David-Rodden',
  name: { zh: '怪物抗性', en: 'Monster Resists' },
  description: {
    zh: '悬停怪物时在血条下显示它的全部抗性。（作者：David-Rodden，感谢贡献！）',
    en: "Shows all of a monster's resistances under its health bar, not just immunities. (Author: David-Rodden — Special thanks for contributing!)",
  },
  port: (ctx) => ctx.monsterResists,
})
