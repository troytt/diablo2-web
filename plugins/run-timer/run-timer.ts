export interface RunSummary {
  readonly currentMs: number | null
  readonly runs: number
  readonly averageMs: number | null
  readonly perHour: number | null
}

export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const [hours, minutes, seconds] = [Math.floor(totalSeconds / 3600), Math.floor(totalSeconds / 60) % 60, totalSeconds % 60]
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

export class RunTimer {
  private current: { readonly game: string; startMs: number } | null = null
  private readonly durations: number[] = []
  private firstStartMs: number | null = null

  observe(game: string | null, nowMs: number): void {
    if ((this.current?.game ?? null) === game) return
    if (this.current) this.durations.push(nowMs - this.current.startMs)
    this.current = game ? { game, startMs: nowMs } : null
    this.firstStartMs ??= this.current?.startMs ?? null
  }

  reset(nowMs: number): void {
    this.durations.length = 0
    if (this.current) this.current.startMs = nowMs
    this.firstStartMs = this.current ? nowMs : null
  }

  summary(nowMs: number): RunSummary {
    const runs = this.durations.length
    const elapsedHours = this.firstStartMs === null ? 0 : (nowMs - this.firstStartMs) / 3_600_000
    return {
      currentMs: this.current ? nowMs - this.current.startMs : null,
      runs,
      averageMs: runs > 0 ? this.durations.reduce((a, b) => a + b, 0) / runs : null,
      perHour: runs > 0 && elapsedHours > 0 ? runs / elapsedHours : null,
    }
  }
}

export const formatRunSummary = ({ currentMs, runs, averageMs, perHour }: RunSummary, lang: 'zh' | 'en'): string => {
  const isEnglish = lang === 'en'
  const parts = [
    currentMs !== null && `${isEnglish ? `Run ${runs + 1}` : `第${runs + 1}局`} · ${formatDuration(currentMs)}`,
    averageMs !== null && `${isEnglish ? 'avg' : '平均'} ${formatDuration(averageMs)}`,
    perHour !== null && `${perHour.toFixed(1)}${isEnglish ? '/hr' : '局/小时'}`,
  ]
  return parts.filter(Boolean).join(' · ') || (isEnglish ? 'No runs yet' : '暂无记录')
}
