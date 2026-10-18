import { createTogglePlugin } from '../../src/client/plugin-host/api.ts'

export const autoGoldPickupPlugin = createTogglePlugin({
  id: 'auto-gold-pickup',
  name: { zh: '自动拾取金币', en: 'Auto Gold Pickup' },
  description: {
    zh: '非 1.13c 增强：自动拾取附近的地面金币，无需点击。身边的金币直接拾取；稍远的金币（约 4 个地砖内）会在你空闲时（没有走动、没有按住鼠标、自动战斗没有目标）走过去捡起。身上金币已满或打开仓库、商店等窗口时暂停。关闭插件即恢复原版行为。',
    en: "Non-1.13c enhancement: picks up gold near you without clicking. Gold within arm's reach is grabbed instantly; gold a little further away (about 4 tiles) is walked to and picked up whenever you're idle — not walking, not holding a mouse button, and with no Auto-Fight target. It pauses while you're carrying the maximum gold or a stash, vendor or similar window is open. Disabling restores vanilla behavior.",
  },
  defaultEnabled: false,
  port: (ctx) => ctx.autoGoldPickup,
})
