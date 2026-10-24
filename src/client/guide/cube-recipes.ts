import type { ItemData } from '../../netproto/index.ts'
import { freeSpots } from '../input/auto-loot.ts'
import type { HudModel } from '../ui-model/hud-model.ts'
import { waitFor } from '../ui-model/stash-deposit.ts'
import type { HudManager } from '../ui/hud-manager.ts'
import type { ClientWorld } from '../world/client-world.ts'
import RECIPES from './data/cube-recipes.json'

const CUBE = 'box'
const CUBE_BUFFER = 3
const CUBE_COLUMNS = 3
const CUBE_ROWS = 4
const INVENTORY_BUFFER = 0
const STEP_MS = 3000

export interface CubeHost {
  readonly world: ClientWorld
  readonly hudManager: HudManager
  readonly hudModel: HudModel
}

type Recipe = (typeof RECIPES)[keyof typeof RECIPES]

const codeOf = (item: ItemData) => item.code.trim()
const carried = (world: ClientWorld) => [...world.containers.inventory.values(), ...world.containers.cube.values()]
const owned = (world: ClientWorld) => [...carried(world), ...world.containers.stash.values()]

export interface ReadyRecipe {
  readonly name: string
  readonly recipe: Recipe
  readonly inStash: readonly string[]
}

export function readyRecipe(world: ClientWorld): ReadyRecipe | null {
  const codes = new Set(owned(world).map(codeOf))
  const onHand = new Set(carried(world).map(codeOf))
  const found = codes.has(CUBE) ? Object.entries(RECIPES).find(([, recipe]) => !codes.has(recipe.makes) && recipe.inputs.every((code) => codes.has(code))) : undefined
  return found ? { name: found[0], recipe: found[1], inStash: [CUBE, ...found[1].inputs].filter((code) => !onHand.has(code)) } : null
}

export async function withdraw(host: CubeHost, codes: readonly string[]): Promise<boolean> {
  const { stash, inventory } = host.world.containers
  for (const item of [...stash.values()].filter((stored) => codes.includes(codeOf(stored)))) if (!(await move(host, item, INVENTORY_BUFFER, inventory))) return false
  return true
}

async function move(host: CubeHost, item: ItemData, buffer: number, container: ReadonlyMap<number, ItemData>, grid: readonly [number, number] | [] = []): Promise<boolean> {
  const { world, hudModel } = host
  const spot = freeSpots(container.values(), item.invWidth, item.invHeight, ...grid)[0]
  if (!spot) return false
  hudModel.pickupItemToCursor(item.id)
  if (!(await waitFor(() => world.containers.cursor?.id === item.id, STEP_MS))) return false
  hudModel.placeCursorItem(item.id, spot.x, spot.y, buffer)
  return waitFor(() => world.containers.cursor === null && container.has(item.id), STEP_MS)
}

export async function transmute(host: CubeHost, recipe: Recipe): Promise<boolean> {
  const { world, hudManager, hudModel } = host
  const { inventory, cube } = world.containers
  const box = [...inventory.values()].find((item) => codeOf(item) === CUBE)
  if (!box) return false
  hudModel.useItem(box.id)
  if (!(await waitFor(() => hudManager.leftPanel === 'cube', STEP_MS))) return false
  for (const stray of [...cube.values()].filter((item) => !recipe.inputs.includes(codeOf(item)))) if (!(await move(host, stray, INVENTORY_BUFFER, inventory))) return false
  for (const code of recipe.inputs) {
    const item = [...inventory.values()].find((owned) => codeOf(owned) === code)
    if (item && !(await move(host, item, CUBE_BUFFER, cube, [CUBE_COLUMNS, CUBE_ROWS]))) return false
  }
  hudModel.transmuteCube()
  const made = await waitFor(() => [...cube.values()].some((item) => codeOf(item) === recipe.makes), STEP_MS)
  const result = [...cube.values()].find((item) => codeOf(item) === recipe.makes)
  if (result) await move(host, result, INVENTORY_BUFFER, inventory)
  hudModel.closeCube()
  return made
}

export async function takeOut(host: CubeHost, code: string): Promise<boolean> {
  const { world, hudManager, hudModel } = host
  const { inventory, cube } = world.containers
  const item = [...cube.values()].find((stored) => codeOf(stored) === code)
  const box = [...inventory.values()].find((owned) => codeOf(owned) === CUBE)
  if (!item) return true
  if (!box) return false
  hudModel.useItem(box.id)
  if (!(await waitFor(() => hudManager.leftPanel === 'cube', STEP_MS))) return false
  const moved = await move(host, item, INVENTORY_BUFFER, inventory)
  hudModel.closeCube()
  return moved
}
