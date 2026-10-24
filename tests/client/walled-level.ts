import type { MapService } from '../../src/client/map/map-service.ts'

export const walledLevel = (gap?: readonly [number, number]) => {
  const [origin, size, wallX] = [80, 40, 104]
  const walkable = new Uint8Array(size * size).fill(1)
  for (let y = 0; y < size; y++) if (!gap || y + origin < gap[0] || y + origin > gap[1]) walkable[y * size + wallX - origin] = 0
  const view = { areaId: 8, levelId: 8, subOriginX: origin, subOriginY: origin, subWidth: size, subHeight: size, walkable }
  const inside = (x: number, y: number) => x >= origin && y >= origin && x < origin + size && y < origin + size
  return { getActiveLevelView: () => view, findLevelViewAtWorldSubTile: (x: number, y: number) => (inside(x, y) ? view : null) } as unknown as MapService
}
