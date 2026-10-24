/**
 * Experience Bar (`experience-bar`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import { createTogglePlugin } from '../../src/client/plugin-host/api.ts'

export const experienceBarPlugin = createTogglePlugin({
  id: 'experience-bar',
  author: 'David-Rodden',
  name: { zh: '经验条', en: 'Experience Bar' },
  description: {
    zh: '在画面顶部显示经验条、每小时经验和升级所需时间，获得经验时会飘出 +xp。（作者：David-Rodden，感谢贡献！）',
    en: 'An XP bar at the top of the screen with experience per hour, time to the next level, and a floating +xp each time you gain some. (Author: David-Rodden — Special thanks for contributing!)',
  },
  port: (ctx) => ctx.xpBar,
})
