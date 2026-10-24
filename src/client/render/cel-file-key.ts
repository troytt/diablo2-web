/**
 * 1.13c `Missiles.txt` `CelFile` / `Overlay.txt` `Filename` art keys.
 *
 * The tables name DCCs with backslash paths relative to `data\global\missiles` / `data\global\overlays`
 * (`expansion\FireTraumaMissile`, `Expansion\ShockField`), while the baker (`pack-missiles` / `pack-overlays`)
 * writes `meta.celFile` with forward slashes (`expansion/FireTraumaMissile`). The game resolves the file
 * case-insensitively through the MPQ, so every art-map registration and lookup must go through the same key:
 * lowercase, `\` -> `/` (Issue #1043).
 */
export function normalizeCelFileKey(celFile: string): string {
  return celFile.trim().replace(/\\/g, '/').toLowerCase()
}

/**
 * Art-map key of a DCC. Kept in its own `cel:` namespace so a CelFile can never collide with a missile / overlay
 * row name (Missiles.txt `handofgod` draws `LightningBolt`, while the row `lightningbolt` draws `LightningStrike`).
 */
export function celFileArtKey(celFile: string): string {
  return `cel:${normalizeCelFileKey(celFile)}`
}

/** `CelFile` / `Filename` values that name no sprite (the row draws nothing). */
export function isNullCelFile(celFile: string | undefined): boolean {
  if (celFile === undefined) return true
  const key = celFile.trim().toLowerCase()
  return key === '' || key === 'null'
}

/**
 * Resolves the baked atlas of a `Missiles.txt` row strictly by its `CelFile` (the DCC the game draws).
 * The normalised `CelFile` key is tried first; a missile-name key is only accepted when its atlas was baked
 * from the same DCC, so an atlas registered under a row name but baked from another row's art is never used
 * as a substitute.
 */
export function resolveArtByCelFile<A extends { readonly meta: { readonly celFile?: string | undefined } }>(
  map: ReadonlyMap<string, A> | undefined,
  missileKey: string,
  celFile: string,
): A | undefined {
  if (map === undefined || isNullCelFile(celFile)) return undefined
  const celKey = normalizeCelFileKey(celFile)
  const byCel = map.get(celFileArtKey(celFile))
  if (byCel !== undefined) return byCel
  for (const key of [missileKey, missileKey.toLowerCase()]) {
    const art = map.get(key)
    const artCel = art?.meta.celFile
    if (art !== undefined && artCel !== undefined && normalizeCelFileKey(artCel) === celKey) return art
  }
  return undefined
}
