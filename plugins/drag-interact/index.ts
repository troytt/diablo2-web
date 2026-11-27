/**
 * Hold-and-Drag Interact (`drag-interact`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import { createTogglePlugin } from '../../src/client/plugin-host/api.ts'

export const dragInteractPlugin = createTogglePlugin({
  id: 'drag-interact',
  author: 'David-Rodden',
  name: { zh: '按住拖动即交互', en: 'Hold-and-Drag Interact' },
  description: {
    zh: '按住左键拖动时，经过的敌人会被攻击，经过的物品会被拾取。NPC、传送点和箱子仍需单独点击。（作者：David-Rodden，感谢贡献！）',
    en: 'Hold the left button and drag: monsters you pass over get attacked and items get picked up. NPCs, waypoints and chests still need their own click. (Author: David-Rodden — Special thanks for contributing!)',
  },
  port: (ctx) => ctx.dragInteract,
})
