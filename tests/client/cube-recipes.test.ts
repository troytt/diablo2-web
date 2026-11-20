import { describe, expect, it } from 'vitest'
import { readyRecipe } from '../../src/client/guide/cube-recipes.ts'
import { freeSpots } from '../../src/client/input/auto-loot.ts'
import type { ClientWorld } from '../../src/client/world/client-world.ts'

const holding = (inventory: string[], cube: string[] = [], stash: string[] = []) => {
  const map = (codes: string[], offset: number) => new Map(codes.map((code, i) => [offset + i, { id: offset + i, code }]))
  return { containers: { inventory: map(inventory, 1), cube: map(cube, 100), stash: map(stash, 200) } } as unknown as ClientWorld
}

describe('Horadric Cube quest recipes', () => {
  it('is ready once the cube, staff and amulet are all carried, wherever they sit', () => {
    expect(readyRecipe(holding(['box', 'msf ', 'vip']))?.name).toBe('Horadric Staff')
    expect(readyRecipe(holding(['box', 'msf'], ['vip']))?.name).toBe('Horadric Staff')
    expect(readyRecipe(holding(['msf', 'vip']))).toBeNull()
    expect(readyRecipe(holding(['box', 'msf', 'vip', 'hst']))).toBeNull()
    expect(readyRecipe(holding(['msf'], [], ['box', 'vip']))?.inStash).toEqual(['box', 'vip'])
  })

  it('finds room in the 3 by 4 cube grid', () => {
    expect(freeSpots([{ id: 1, gridX: 0, gridY: 0, invWidth: 1, invHeight: 4 }], 2, 4, 3, 4)).toEqual([{ x: 1, y: 0 }])
  })
})
