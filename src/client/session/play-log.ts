export type PlayLogDetail = Readonly<Record<string, unknown>>

const SAMPLE_MS = 500
const FLUSH_MS = 2000

export class PlayLog {
  private lines: PlayLogDetail[] = []
  private lastSample = Number.NEGATIVE_INFINITY
  private lastFlush = Number.NEGATIVE_INFINITY
  readonly session = `play-${new Date().toISOString().replace(/[:.]/g, '-')}`

  constructor(
    private readonly send: (body: string) => void,
    private readonly sample: () => PlayLogDetail | null,
  ) {}

  note(kind: string, detail: PlayLogDetail = {}): void {
    this.lines.push({ at: Date.now(), kind, ...detail })
  }

  tick(nowMs: number): void {
    if (nowMs - this.lastSample >= SAMPLE_MS) {
      this.lastSample = nowMs
      const snapshot = this.sample()
      if (snapshot) this.note('state', snapshot)
    }
    if (nowMs - this.lastFlush >= FLUSH_MS) this.flush(nowMs)
  }

  private flush(nowMs: number): void {
    this.lastFlush = nowMs
    if (this.lines.length === 0) return
    this.send(JSON.stringify({ session: this.session, lines: this.lines }))
    this.lines = []
  }
}
