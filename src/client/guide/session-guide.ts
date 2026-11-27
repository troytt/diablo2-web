import type { OnlineSession } from '../session/online-session.ts'
import type { Minimap } from '../ui/minimap.ts'
import { PathGuide, type PathGuideHost } from './path-guide.ts'

export const createSessionGuide = (session: OnlineSession, minimap: Minimap): PathGuide => new PathGuide(sessionGuideHost(session, minimap))

export function sessionGuideHost(session: OnlineSession, minimap: Pick<Minimap, 'visible' | 'lastRenderStats'>): PathGuideHost {
  const world = () => session.world
  const carried = () => {
    const { inventory, cube, stash, equipment, cursor } = world().containers
    return new Set([...inventory.values(), ...cube.values(), ...stash.values(), ...equipment.values(), ...(cursor ? [cursor] : [])].map((item) => item.code.trim()))
  }
  return {
    areaId: () => world().areaId,
    self: () => ({ x: world().self.x, y: world().self.y, isDead: world().isDead }),
    character: () => `${world().self.name}:${world().difficulty}`,
    quests: () => ({ words: world().quests, gameWords: world().gameQuests, status: world().questStatusBytes, den: world().denMonstersRemaining, barbs: world().questBarbsRemaining, tomb: world().questTombOffset }),
    carries: (code) => carried().has(code),
    waypoints: () => world().waypoints,
    levelView: () => session.mapService?.getLoadedLevelView(world().areaId) ?? null,
    walkable: (view) => session.commandMapper.assists.walkableWithDoorsOpen(view),
    objects: () => world().getUnitsByType(2),
    monsters: () => world().getUnitsByType(1),
    toScreen: (x, y) => session.camera.subtileToScreen(x, y),
    coveredByHud: (x, y) => session.hudManager.isPointInterceptedByHud(x, y),
    automap: () => ({ visible: minimap.visible, viewport: minimap.lastRenderStats.viewport }),
  }
}
