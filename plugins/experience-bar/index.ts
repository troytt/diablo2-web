import { createTogglePlugin } from '../../src/client/plugin-host/api.ts'

export const experienceBarPlugin = createTogglePlugin({
  id: 'experience-bar',
  name: { zh: '经验条', en: 'Experience Bar' },
  description: {
    zh: '非 1.13c 增强：在游戏画面顶部居中显示经验条，标出当前等级与升到下一级的进度百分比。打开侧边面板时自动隐藏。关闭插件即移除。',
    en: 'Non-1.13c enhancement: shows an experience bar at the top centre of the game view with your level and the percentage towards the next one. It hides while a side panel is open. Disabling removes it.',
  },
  port: (ctx) => ctx.xpBar,
})
