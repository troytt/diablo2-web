import { describe, expect, it } from 'vitest'
import { formatDuration, formatRunSummary, RunTimer } from '../../plugins/run-timer/run-timer.ts'

const MIN = 60_000

describe('run timer', () => {
  it('counts each new game as a run, including +1 hops without leaving in-game', () => {
    const timer = new RunTimer()
    timer.observe('baal1', 0)
    timer.observe('baal1', MIN)
    timer.observe('baal2', 2 * MIN)
    timer.observe(null, 6 * MIN)
    expect(timer.summary(6 * MIN)).toEqual({ currentMs: null, runs: 2, averageMs: 3 * MIN, perHour: 20 })
  })

  it('times the current run and resets everything on demand', () => {
    const timer = new RunTimer()
    timer.observe('cows1', 0)
    timer.observe('cows2', 2 * MIN)
    expect(timer.summary(3 * MIN)).toMatchObject({ currentMs: MIN, runs: 1 })
    timer.reset(3 * MIN)
    expect(timer.summary(4 * MIN)).toEqual({ currentMs: MIN, runs: 0, averageMs: null, perHour: null })
  })

  it('formats durations and summaries', () => {
    expect([formatDuration(65_000), formatDuration(3_725_000), formatDuration(-5)]).toEqual(['1:05', '1:02:05', '0:00'])
    expect(formatRunSummary({ currentMs: 83_000, runs: 4, averageMs: 130_000, perHour: 18 }, 'en')).toBe('Run 5 1:23 · avg 2:10 · 18.0/hr')
    expect(formatRunSummary({ currentMs: null, runs: 0, averageMs: null, perHour: null }, 'en')).toBe('No runs yet')
  })
})
