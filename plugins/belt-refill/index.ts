/**
 * Belt Refill (`belt-refill`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import { createTogglePlugin } from '../../src/client/plugin-host/api.ts'

export const beltRefillPlugin = createTogglePlugin({
  id: 'belt-refill',
  author: 'David-Rodden',
  name: { zh: '自动补充腰带', en: 'Belt Refill' },
  description: {
    zh: '腰带有空位时，从背包里拿药补上。每一列补回原来那种药，空着的列先放腰带里缺的药。（作者：David-Rodden，感谢贡献！）',
    en: 'Refills your belt from the inventory. Each column gets back the kind of potion it held, and an empty column takes whatever kind the belt is missing. (Author: David-Rodden — Special thanks for contributing!)',
  },
  defaultEnabled: false,
  port: (ctx) => ctx.beltRefill,
})
