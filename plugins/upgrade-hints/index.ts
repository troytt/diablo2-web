/**
 * Upgrade Markers (`upgrade-hints`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import { createTogglePlugin } from '../../src/client/plugin-host/api.ts'

export const upgradeHintsPlugin = createTogglePlugin({
  id: 'upgrade-hints',
  author: 'David-Rodden',
  name: { zh: '装备提升标记', en: 'Upgrade Markers' },
  description: {
    zh: '与当前装备比较：绿色箭头表示更好，两个箭头表示好得多，黄色空心箭头表示有得有失或未鉴定。（作者：David-Rodden，感谢贡献！）',
    en: "Compares items with what you're wearing: a green arrow means better, two arrows much better, and a hollow yellow arrow means it's a trade-off or unidentified. (Author: David-Rodden — Special thanks for contributing!)",
  },
  port: (ctx) => ctx.upgradeHints,
})
