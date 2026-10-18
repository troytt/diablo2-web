import { createTogglePlugin } from '../../src/client/plugin-host/api.ts'

export const upgradeHintsPlugin = createTogglePlugin({
  id: 'upgrade-hints',
  name: { zh: '装备提升标记', en: 'Upgrade Markers' },
  description: {
    zh: '非 1.13c 增强：在地面物品名称和物品悬停提示的名称后，与该部位当前装备比较：绿色 + 表示确定更好，绿色 ++ 表示好得多（伤害或防御高出一半以上，或该部位为空），紫色 ? 表示有得有失或未鉴定。无法装备或更差的物品不显示标记。',
    en: "Non-1.13c enhancement: compares items with what you're wearing in that slot and marks their name on the ground label and in the hover tooltip — a green + when it's clearly better, a green ++ when it's much better (half again the damage or defence, or the slot is empty), and a purple ? when it trades one stat for another or is unidentified. Items you can't use, or that are worse, get no mark.",
  },
  port: (ctx) => ctx.upgradeHints,
})
