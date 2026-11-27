import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

describe('Diablo II 1.13c Map Object Animations (Issue #387)', () => {

  describe('Ground truth 1.13c baked pack validation', () => {
    const sceneJsonPath = join(process.cwd(), 'public/packs/act1/1-act-1-town-var1/scene.json')

    it('has baked animatedFrames and 1.13c timing in Act 1 town pack', () => {
      if (!existsSync(sceneJsonPath)) {
        console.warn(`Skipping pack validation test: ${sceneJsonPath} does not exist`)
        return
      }

      const scene = JSON.parse(readFileSync(sceneJsonPath, 'utf8'))
      expect(scene.objects).toBeDefined()
      expect(Array.isArray(scene.objects)).toBe(true)

      // Check Campfire (RB)
      const campfires = scene.objects.filter((o: any) => o.token === 'RB')
      expect(campfires.length).toBeGreaterThan(0)
      for (const fire of campfires) {
        expect(fire.mode).toBe('ON')
        expect(fire.animatedFrames).toBeDefined()
        expect(fire.animatedFrames.length).toBe(20)
        expect(fire.frameDelta).toBe(256) // 25 FPS
        expect(fire.frameDurationMs).toBe(40)
        expect(fire.cycleAnim).toBe(true)
        expect(fire.sync).toBe(false)
      }

      // Check Torches (TO)
      const torches = scene.objects.filter((o: any) => o.token === 'TO')
      expect(torches.length).toBeGreaterThan(0)
      for (const torch of torches) {
        expect(torch.mode).toBe('ON')
        expect(torch.animatedFrames).toBeDefined()
        expect(torch.animatedFrames.length).toBe(20)
        expect(torch.frameDelta).toBe(200) // ~19.5 FPS
        expect(torch.frameDurationMs).toBe(51.2)
        expect(torch.cycleAnim).toBe(true)
        expect(torch.sync).toBe(false)
      }

      // Check Flags (N1, N2)
      const flagsN1 = scene.objects.filter((o: any) => o.token === 'N1')
      const flagsN2 = scene.objects.filter((o: any) => o.token === 'N2')
      expect(flagsN1.length).toBeGreaterThan(0)
      expect(flagsN2.length).toBeGreaterThan(0)
      for (const flag of [...flagsN1, ...flagsN2]) {
        expect(flag.mode).toBe('NU')
        expect(flag.animatedFrames).toBeDefined()
        expect(flag.animatedFrames.length).toBe(10)
        expect(flag.frameDelta).toBe(128) // 12.5 FPS
        expect(flag.frameDurationMs).toBe(80)
        expect(flag.cycleAnim).toBe(true)
        expect(flag.sync).toBe(false)
      }

      // Check Waypoint (WP)
      const waypoints = scene.objects.filter((o: any) => o.token === 'WP')
      expect(waypoints.length).toBeGreaterThan(0)
      for (const wp of waypoints) {
        expect(wp.mode).toBe('ON')
        expect(wp.animatedFrames).toBeDefined()
        expect(wp.animatedFrames.length).toBe(15)
        expect(wp.frameDelta).toBe(200)
        expect(wp.cycleAnim).toBe(true)
        expect(wp.sync).toBe(true)
      }

      // Check Stash (B6)
      const stashes = scene.objects.filter((o: any) => o.token === 'B6')
      expect(stashes.length).toBeGreaterThan(0)
      for (const stash of stashes) {
        expect(stash.token).toBe('B6')
        // Static object has no animatedFrames
        expect(stash.animatedFrames).toBeUndefined()
        // Single frame is preserved
        expect(stash.frame).toBeDefined()
      }
    })
  })
})
