/**
 * Stash: Deposit All (`stash-deposit-all`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import { createTogglePlugin } from '../../src/client/plugin-host/api.ts'

export const stashDepositAllPlugin = createTogglePlugin({
  id: 'stash-deposit-all',
  author: 'David-Rodden',
  name: { zh: '一键存入仓库', en: 'Stash: Deposit All' },
  description: {
    zh: '在仓库添加“全部存入”按钮，存入背包物品和金币。护身符、卷轴书和方块留在背包。（作者：David-Rodden，感谢贡献！）',
    en: 'Adds a Deposit All button to the stash that moves your inventory and gold in. Charms, tomes and the Cube stay with you. (Author: David-Rodden — Special thanks for contributing!)',
  },
  port: (ctx) => ctx.stashDepositAll,
})
