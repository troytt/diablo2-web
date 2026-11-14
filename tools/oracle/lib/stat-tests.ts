/**
 * Statistical fallback for oracle parity (P5.5).
 *
 * Only for probabilistic outcomes whose RNG draws cannot be aligned yet
 * (e.g. the replica lacks per-unit D2SeedStrc streams). A passing test here is
 * NOT parity: every use must be registered in docs/oracle/P5-statistical-fallback.md
 * with the RNG-alignment work item that will replace it.
 */

export interface KsResult {
  statistic: number
  pValue: number
  n: number
  m: number
}

/** Two-sample Kolmogorov–Smirnov test (asymptotic p-value). */
export function ksTwoSample(a: readonly number[], b: readonly number[]): KsResult {
  if (a.length === 0 || b.length === 0) throw new Error('ksTwoSample: empty sample')
  const x = [...a].sort((p, q) => p - q)
  const y = [...b].sort((p, q) => p - q)
  let i = 0
  let j = 0
  let d = 0
  while (i < x.length && j < y.length) {
    const v = Math.min(x[i]!, y[j]!)
    while (i < x.length && x[i]! <= v) i++
    while (j < y.length && y[j]! <= v) j++
    d = Math.max(d, Math.abs(i / x.length - j / y.length))
  }
  const n = x.length
  const m = y.length
  const en = Math.sqrt((n * m) / (n + m))
  return { statistic: d, pValue: kolmogorovQ((en + 0.12 + 0.11 / en) * d), n, m }
}

/** Survival function of the Kolmogorov distribution, Q_KS(lambda). */
function kolmogorovQ(lambda: number): number {
  if (lambda < 1e-6) return 1
  let sum = 0
  for (let k = 1; k <= 100; k++) {
    const term = 2 * (k % 2 ? 1 : -1) * Math.exp(-2 * k * k * lambda * lambda)
    sum += term
    if (Math.abs(term) < 1e-12) break
  }
  return Math.min(1, Math.max(0, sum))
}

export interface ChiSquareResult {
  statistic: number
  dof: number
  pValue: number
}

/**
 * Chi-square test of homogeneity for two categorical samples given as
 * category -> count maps. Categories with zero total are ignored.
 */
export function chiSquareHomogeneity(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): ChiSquareResult {
  const cats = [...new Set([...a.keys(), ...b.keys()])].filter((c) => (a.get(c) ?? 0) + (b.get(c) ?? 0) > 0)
  const na = cats.reduce((s, c) => s + (a.get(c) ?? 0), 0)
  const nb = cats.reduce((s, c) => s + (b.get(c) ?? 0), 0)
  if (na === 0 || nb === 0) throw new Error('chiSquareHomogeneity: empty sample')
  let stat = 0
  for (const c of cats) {
    const tot = (a.get(c) ?? 0) + (b.get(c) ?? 0)
    const ea = (tot * na) / (na + nb)
    const eb = (tot * nb) / (na + nb)
    stat += ((a.get(c) ?? 0) - ea) ** 2 / ea + ((b.get(c) ?? 0) - eb) ** 2 / eb
  }
  const dof = Math.max(1, cats.length - 1)
  return { statistic: stat, dof, pValue: chiSquareSurvival(stat, dof) }
}

/** P(X >= x) for X ~ chi-square(k): regularized upper incomplete gamma Q(k/2, x/2). */
export function chiSquareSurvival(x: number, k: number): number {
  return upperGammaQ(k / 2, x / 2)
}

function upperGammaQ(s: number, x: number): number {
  if (x <= 0) return 1
  if (x < s + 1) {
    // series for P, then Q = 1 - P
    let sum = 1 / s
    let term = sum
    for (let n = 1; n < 500; n++) {
      term *= x / (s + n)
      sum += term
      if (term < sum * 1e-14) break
    }
    return Math.max(0, 1 - sum * Math.exp(-x + s * Math.log(x) - logGamma(s)))
  }
  // continued fraction for Q (Lentz)
  let b = x + 1 - s
  let c = 1 / 1e-300
  let d = 1 / b
  let h = d
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - s)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c
    if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-14) break
  }
  return Math.min(1, Math.exp(-x + s * Math.log(x) - logGamma(s)) * h)
}

function logGamma(z: number): number {
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  z -= 1
  let x = c[0]!
  for (let i = 1; i < g + 2; i++) x += c[i]! / (z + i)
  const t = z + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}
