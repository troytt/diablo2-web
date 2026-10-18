import type { D2WebPlugin } from '../../src/client/plugin-host/api.ts'

const KEYS = ['E', 'D', 'F', 'G', 'X', 'SPACE'] as const

export const autoCombatPlugin: D2WebPlugin = {
  id: 'auto-combat',
  name: { zh: '自动战斗', en: 'Auto-Fight' },
  description: {
    zh: '非 1.13c 增强：按设定的按键开启/关闭自动战斗（法力球上方显示开/关状态）。开启后无需任何操作，角色会自动用左键技能攻击画面内最近的敌人——锁定当前目标直到其死亡或离开画面，再切换到下一个；超出近战距离时先走过去再攻击，与按住鼠标攻击怪物完全一致。按住鼠标时以你的操作为准；打开仓库、商店等窗口时暂停。关闭插件即移除。',
    en: "Non-1.13c enhancement: press the chosen key to switch Auto-Fight on or off (shown above the mana orb). While it's on you don't need to do anything: your left skill attacks the nearest enemy on screen, sticking with it until it dies or leaves the screen, then moving to the next. Out-of-range targets are walked to and attacked exactly as when you hold the mouse on a monster. Holding the mouse takes over while held, and it pauses while a stash, vendor or similar window is open. Disabling removes it.",
  },
  defaultEnabled: false,
  settings: [
    {
      kind: 'select',
      key: 'key',
      label: { zh: '按键', en: 'Key' },
      default: 'E',
      options: KEYS.map((key) => ({ value: key, label: key === 'SPACE' ? { zh: '空格', en: 'Space' } : { zh: key, en: key } })),
    },
  ],
  activate(ctx) {
    const apply = () => ctx.autoCombat.setKey(String(ctx.settings.get('key') || 'E'))
    apply()
    const unsubscribe = ctx.settings.subscribe(apply)
    return {
      getStatus: () => {
        const key = ctx.autoCombat.getKey()
        return key ? { level: 'ok', text: { zh: `按 ${key} 开关`, en: `Press ${key} to toggle` } } : { level: 'warn', text: { zh: '未开启', en: 'Inactive' } }
      },
      deactivate: () => (unsubscribe(), ctx.autoCombat.setKey(null)),
    }
  },
}
