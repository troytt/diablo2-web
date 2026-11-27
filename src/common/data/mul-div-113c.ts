/**
 * Diablo II 1.13c integer mul-div helper, bit-exact with the original.
 *
 * The same body exists twice in the binaries: `D2Common.dll` `0x6FD511E0` and `D2Game.dll`
 * `0x6FC214D0`. Register convention: `eax = factor`, `edx = value`, `ecx = divisor`; result in eax.
 *
 * ```
 * if (ecx == 0) return 0
 * if (edx > 0x100000)                                     // signed compare
 *   return ecx > (edx >> 4) ? low32((int64)edx * eax / ecx) : (edx / ecx) * eax
 * if (eax > 0x10000)
 *   return ecx > (eax >> 4) ? low32((int64)edx * eax / ecx) : (eax / ecx) * edx
 * return (int32)(edx * eax) / ecx                         // 32-bit imul, idiv
 * ```
 *
 * The "shortcut" branches divide before multiplying and drop the remainder, e.g.
 * `mulDiv113c(9, 1_100_000, 100)` = `(1_100_000 / 100) * 9` = 99000 exactly, but
 * `mulDiv113c(9, 1_100_037, 100)` = 99000 too (exact would be 99003). The 64-bit branch calls the
 * CRT `lldiv` (`0x6FDD7080`) and keeps only the low dword.
 *
 * Verified against both binaries by the function oracle (tools/oracle/fn-sweep.ts, category
 * `primitives`, functions `muldiv` / `muldiv.game`).
 *
 * @param factor  value in `eax` (usually the percentage / ratio)
 * @param value   value in `edx` (usually the damage / experience being scaled)
 * @param divisor value in `ecx`
 */
export function mulDiv113c(factor: number, value: number, divisor: number): number {
  const eax = factor | 0
  const edx = value | 0
  const ecx = divisor | 0
  if (ecx === 0) return 0
  const wide = (): number => Number(BigInt.asIntN(32, (BigInt(edx) * BigInt(eax)) / BigInt(ecx)))
  if (edx > 0x100000) {
    return ecx > edx >> 4 ? wide() : Math.imul(Math.trunc(edx / ecx), eax)
  }
  if (eax > 0x10000) {
    return ecx > eax >> 4 ? wide() : Math.imul(Math.trunc(eax / ecx), edx)
  }
  return Math.trunc(Math.imul(edx, eax) / ecx) | 0
}
