import { createTogglePlugin } from '../../src/client/plugin-host/api.ts'

export const stashDepositAllPlugin = createTogglePlugin({
  id: 'stash-deposit-all',
  name: { zh: '一键存入仓库', en: 'Stash: Deposit All' },
  description: {
    zh: '非 1.13c 增强：在仓库面板添加“全部存入”按钮，将背包中的物品逐件存入仓库空位，并存入身上的金币。护身符、卷轴书与赫拉迪克方块保留在背包中。每件物品都按原版拾取/放置流程由服务器确认。关闭插件即移除按钮。',
    en: 'Non-1.13c enhancement: adds a Deposit All button to the stash panel that moves every inventory item into free stash space and banks your carried gold. Charms, tomes and the Horadric Cube stay in your inventory. Each item goes through the vanilla pick-up/place sequence and waits for the server to confirm it. Disabling removes the button.',
  },
  port: (ctx) => ctx.stashDepositAll,
})
