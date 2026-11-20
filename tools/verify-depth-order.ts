/**
 * Check for the actor depth-insertion rule.
 *
 * Painter's order without a depth buffer is easy to get subtly wrong and hard to
 * eyeball — on a small map the actor's insertion point may not move at all while
 * an actor walks around. So the rule is exercised directly instead: for a wall
 * grid, an actor in each cell must land between the walls that are behind it and
 * the walls that are in front of it.
 *
 * Usage: node scripts/verify-depth-order.ts
 */
import { depthInsertIndex } from '../src/common/world/map.ts'

const problems: string[] = []
const size = 4
const walls = [] as { cellX: number; cellY: number }[]
for (let cellY = 0; cellY < size; cellY += 1) {
  for (let cellX = 0; cellX < size; cellX += 1) walls.push({ cellX, cellY })
}
// Painter's order: far (small x+y) first.
walls.sort((a, b) => (a.cellY + a.cellX) - (b.cellY + b.cellX) || a.cellY - b.cellY)

let checked = 0
for (let cellY = 0; cellY < size; cellY += 1) {
  for (let cellX = 0; cellX < size; cellX += 1) {
    const at = depthInsertIndex(walls, cellX, cellY)
    const depth = cellX + cellY
    // Everything before the insertion point must be strictly nearer the camera
    // (smaller depth), everything after strictly further — ties are allowed to
    // fall either way, which is why the check is "never further before".
    for (let index = 0; index < at; index += 1) {
      const wall = walls[index]!
      if (wall.cellX + wall.cellY > depth) problems.push(`cell ${String(cellX)},${String(cellY)}: wall at index ${String(index)} is nearer but was drawn before the actor`)
    }
    for (let index = at; index < walls.length; index += 1) {
      const wall = walls[index]!
      if (wall.cellX + wall.cellY < depth) problems.push(`cell ${String(cellX)},${String(cellY)}: wall at index ${String(index)} is further but was drawn after the actor`)
    }
    checked += 1
  }
}
if (depthInsertIndex([], 0, 0) !== 0) problems.push('empty wall list must insert at 0')
if (depthInsertIndex(walls, size - 1, size - 1) !== walls.length) problems.push('nearest actor must be drawn last')

console.log(`walls      ${String(walls.length)} in painter's order`)
console.log(`positions  ${String(checked)} checked`)
console.log(`problems   ${String(problems.length)}`)
for (const problem of problems.slice(0, 8)) console.log(`  - ${problem}`)
console.log(problems.length === 0 ? 'RESULT     the actor is always inserted between the walls behind and in front of it' : 'RESULT     FAILED')
process.exit(problems.length === 0 ? 0 : 1)
