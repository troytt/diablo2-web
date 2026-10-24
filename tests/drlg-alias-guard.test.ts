import { describe, expect, test } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import * as levelLinks from "../src/common/world/level-links.ts"
import * as drlgMap from "../src/common/drlg/drlg-map.ts"

describe("DRLG Export and Alias Guard (Issue #81)", () => {
  const getDrlgExports = (mod: Record<string, unknown>): string[] => {
    return Object.keys(mod).filter((name) => name.startsWith("DRLG"))
  }

  test("legacy src/game/wilderness*.ts, maze*.ts, preset.ts, rng.ts, and world-placement.ts have been removed in favor of src/game/drlg", () => {
    expect(existsSync(resolve(__dirname, "../src/game/wilderness.ts"))).toBe(false)
    expect(existsSync(resolve(__dirname, "../src/game/wilderness-acts.ts"))).toBe(false)
    expect(existsSync(resolve(__dirname, "../src/game/wilderness-jungles.ts"))).toBe(false)
    expect(existsSync(resolve(__dirname, "../src/game/wilderness-siege.ts"))).toBe(false)
    expect(existsSync(resolve(__dirname, "../src/game/world-placement.ts"))).toBe(false)
    expect(existsSync(resolve(__dirname, "../src/game/maze.ts"))).toBe(false)
    expect(existsSync(resolve(__dirname, "../src/game/preset.ts"))).toBe(false)
    expect(existsSync(resolve(__dirname, "../src/game/maze-special-passes.ts"))).toBe(false)
    expect(existsSync(resolve(__dirname, "../src/game/maze-objects.ts"))).toBe(false)
    expect(existsSync(resolve(__dirname, "../src/game/rng.ts"))).toBe(false)
  })

  test("src/game/level-links.ts does not export duplicate DRLGOUTDOORS_SpawnAct12Waypoint", () => {
    const exports = getDrlgExports(levelLinks as Record<string, unknown>)
    expect(exports).not.toContain("DRLGOUTDOORS_SpawnAct12Waypoint")
    expect(exports).not.toContain("DRLGROOMTILE_ComputeNeighborMask")
    expect(exports).not.toContain("DRLGROOMTILE_ApplyTransitions")

    // findWaypointSpot remains exported as a local helper
    expect(typeof levelLinks.findWaypointSpot).toBe("function")
  })

  test("src/game/drlg/drlg-map.ts does not export fake Blizzard DRLG aliases", () => {
    const exports = [
      ...getDrlgExports(drlgMap as Record<string, unknown>),
    ]
    expect(exports).not.toContain("DRLGROOMTILE_ComputeNeighborMask")
    expect(exports).not.toContain("DRLGROOMTILE_ApplyTransitions")
  })

  test("Static source check: no fake DRLG export statements in source files", () => {
    const files = [
      resolve(__dirname, "../src/common/world/level-links.ts"),
      resolve(__dirname, "../src/common/drlg/drlg-map.ts"),
    ]

    for (const filePath of files) {
      const source = readFileSync(filePath, "utf-8")
      expect(source).not.toMatch(/export\s+(?:const|function|let|var)\s+DRLGROOMTILE_ComputeNeighborMask\b/)
      expect(source).not.toMatch(/export\s+(?:const|function|let|var)\s+DRLGROOMTILE_ApplyTransitions\b/)
    }

    // Ensure level-links.ts does not export DRLGOUTDOORS_SpawnAct12Waypoint
    const levelLinksSource = readFileSync(resolve(__dirname, "../src/common/world/level-links.ts"), "utf-8")
    expect(levelLinksSource).not.toMatch(/export\s+(?:const|function|let|var)\s+DRLGOUTDOORS_SpawnAct12Waypoint\b/)
  })
})
