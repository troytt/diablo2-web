/**
 * Run Timer (`run-timer`) plugin.
 * Author: David-Rodden (https://github.com/David-Rodden/diablo2-browser)
 * Special thanks to David-Rodden for contributing this plugin! / 感谢 David-Rodden 贡献此插件！
 */
import type { D2WebPlugin } from '../../src/client/plugin-host/api.ts'
import { formatRunSummary, RunTimer } from './run-timer.ts'

const HOURGLASS_SVG =
  '<svg class="d2-toolbar__icon-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><path d="M4 2.5h8M4 13.5h8M5 2.5c0 3 6 3.5 6 5.5s-6 2.5-6 5.5M11 2.5c0 3-6 3.5-6 5.5s6 2.5 6 5.5"/></svg>'

export const runTimerPlugin: D2WebPlugin = {
  id: 'run-timer',
  author: 'David-Rodden',
  name: { zh: '计时器', en: 'Run Timer' },
  description: {
    zh: '在工具栏显示本局用时、平均用时和每小时局数。点击清零。（作者：David-Rodden，感谢贡献！）',
    en: 'Shows the current run time, average run time and runs per hour in the toolbar. Click to reset. (Author: David-Rodden — Special thanks for contributing!)',
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
    const button = ctx.toolbar.addButton({
      id: 'timer',
      label: label(),
      tooltip,
      iconSvg: HOURGLASS_SVG,
      onClick: () => {
        timer.reset(Date.now())
        refresh()
      },
    })
    const refresh = () => {
      observe()
      button.update?.({ label: label(), tooltip })
      ctx.notifyStatusChanged()
    }
    const unsubscribe = ctx.session.onStateChange(refresh)
    const interval = setInterval(refresh, 1000)
    return {
      getStatus: () => ({ level: 'ok', text: label() }),
      deactivate: () => {
        clearInterval(interval)
        unsubscribe()
        button.dispose()
      },
    }
  },
}
