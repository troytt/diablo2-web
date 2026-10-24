/**
 * Auto-Fight (`auto-combat`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import type { D2WebPlugin } from '../../src/client/plugin-host/api.ts'

const KEYS = ['E', 'D', 'F', 'G', 'X', 'SPACE'] as const

export const autoCombatPlugin: D2WebPlugin = {
  id: 'auto-combat',
  author: 'David-Rodden',
  name: { zh: '自动战斗', en: 'Auto-Fight' },
  description: {
    zh: '按设定的按键开关。开启后自动攻击画面内最近、能走到的敌人，绕开墙后的怪物，路上遇到关着的门会先打开。会按你的职业和加点挑技能：避开怪物免疫的元素，保持护甲、战吼、光环和召唤物。（作者：David-Rodden，感谢贡献！）',
    en: "Press the hotkey to switch it on or off. While it's on, you attack the nearest monster you can walk to, skip ones behind walls, and open doors on the way. It picks skills for your build: your strongest attack each monster isn't immune to, and it keeps your armors, warcries, auras and summons up. (Author: David-Rodden — Special thanks for contributing!)",
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
    {
      kind: 'select',
      key: 'skills',
      label: { zh: '技能', en: 'Skills' },
      default: 'smart',
      options: [
        { value: 'smart', label: { zh: '按我的职业和加点挑选', en: 'Best for my build' } },
        { value: 'mine', label: { zh: '只用我选好的技能', en: 'Only the ones I picked' } },
      ],
    },
  ],
  activate(ctx) {
    const apply = () => {
      ctx.autoCombat.setKey(String(ctx.settings.get('key') || 'E'))
      ctx.smartSkills.setEnabled(ctx.settings.get('skills') !== 'mine')
    }
    apply()
    const unsubscribe = ctx.settings.subscribe(apply)
    return {
      getStatus: () => {
        const key = ctx.autoCombat.getKey()
        return key ? { level: 'ok', text: { zh: `按 ${key} 开关`, en: `Press ${key} to toggle` } } : { level: 'warn', text: { zh: '未开启', en: 'Inactive' } }
      },
      deactivate: () => {
        unsubscribe()
        ctx.autoCombat.setKey(null)
        ctx.smartSkills.setEnabled(false)
      },
    }
  },
}
