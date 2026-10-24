/**
 * Low-Life Warning (`low-life-warning`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import { createTogglePlugin } from '../../src/client/plugin-host/api.ts'

export const lowLifeWarningPlugin = createTogglePlugin({
  id: 'low-life-warning',
  author: 'David-Rodden',
  name: { zh: '低血量警告', en: 'Low-Life Warning' },
  description: {
    zh: '生命低于 40% 时屏幕边缘泛起红光，血越少脉动越快。（作者：David-Rodden，感谢贡献！）',
    en: 'The screen edges glow red when your life drops below 40%, pulsing faster the lower it gets. (Author: David-Rodden — Special thanks for contributing!)',
  },
  port: (ctx) => ctx.lowLifeWarning,
})
