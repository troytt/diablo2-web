import type { D2WebPlugin } from '../../src/client/plugin-host/api.ts'
import { formatRunSummary, RunTimer } from './run-timer.ts'

export const runTimerPlugin: D2WebPlugin = {
  id: 'run-timer',
  name: { zh: '计时器', en: 'Run Timer' },
  description: {
    zh: '非 1.13c 增强：在顶部工具栏显示本局用时、平均每局用时和每小时局数。每进入一个新游戏（包括 +1）算一局，点击可清零。',
    en: 'Non-1.13c enhancement: shows how long the current game has run, your average run time and runs per hour in the top toolbar. Every new game counts as a run, including +1. Click it to reset.',
  },
  defaultEnabled: true,
  activate(ctx) {
    const timer = new RunTimer()
    const observe = () => timer.observe(ctx.session.phase === 'ingame' ? ctx.session.getSnapshot().activeGameName : null, Date.now())
    const label = () => {
      const summary = timer.summary(Date.now())
      return { zh: formatRunSummary(summary, 'zh'), en: formatRunSummary(summary, 'en') }
    }
    const tooltip = { zh: '点击清零', en: 'Click to reset' }
    observe()
    const button = ctx.toolbar.addButton({ id: 'timer', label: label(), tooltip, onClick: () => (timer.reset(Date.now()), refresh()) })
    const refresh = () => {
      observe()
      button.update?.({ label: label(), tooltip })
      ctx.notifyStatusChanged()
    }
    const unsubscribe = ctx.session.onStateChange(refresh)
    const interval = setInterval(refresh, 1000)
    return {
      getStatus: () => ({ level: 'ok', text: label() }),
      deactivate: () => (clearInterval(interval), unsubscribe(), button.dispose()),
    }
  },
}
