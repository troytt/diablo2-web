import { describe, expect, it, vi } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { NpcMotion } from '../../src/client/motion/npc-motion.ts'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import { SpriteRenderer } from '../../src/client/render/renderer.ts'

function createMockWebGL2Canvas(): {
  canvas: any
  stats: {
    bufferDataCalls: number
    bufferSubDataCalls: number
    drawElementsCalls: number
    blendFuncCalls: number
    lastUploadedFloats: Float32Array | null
  }
} {
  const stats = {
    bufferDataCalls: 0,
    bufferSubDataCalls: 0,
    drawElementsCalls: 0,
    blendFuncCalls: 0,
    lastUploadedFloats: null as Float32Array | null,
  }
  let nextId = 1
  const gl: any = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    MAX_TEXTURE_SIZE: 3379,
    MAX_TEXTURE_IMAGE_UNITS: 34930,
    TEXTURE_2D: 3553,
    RGBA: 6408,
    RGBA8: 32856,
    R8: 33321,
    RED: 6403,
    UNSIGNED_BYTE: 5121,
    UNSIGNED_INT: 5125,
    FLOAT: 5126,
    ARRAY_BUFFER: 34962,
    ELEMENT_ARRAY_BUFFER: 34963,
    DYNAMIC_DRAW: 35048,
    STATIC_DRAW: 35044,
    TRIANGLES: 4,
    TEXTURE_MIN_FILTER: 10241,
    TEXTURE_MAG_FILTER: 10240,
    TEXTURE_WRAP_S: 10242,
    TEXTURE_WRAP_T: 10243,
    CLAMP_TO_EDGE: 33071,
    NEAREST: 9728,
    UNPACK_ALIGNMENT: 3317,
    BLEND: 3042,
    SRC_ALPHA: 770,
    ONE_MINUS_SRC_ALPHA: 771,
    ONE: 1,
    ZERO: 0,
    DST_COLOR: 774,
    SRC_COLOR: 768,
    DEPTH_TEST: 2929,
    COLOR_BUFFER_BIT: 16384,
    TEXTURE0: 33984,
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
    isContextLost: () => false,
    createProgram: () => ({ id: nextId++ }),
    deleteProgram: () => {},
    attachShader: () => {},
    detachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    useProgram: () => {},
    createShader: () => ({ id: nextId++ }),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: () => {},
    createVertexArray: () => ({ id: nextId++ }),
    deleteVertexArray: () => {},
    bindVertexArray: () => {},
    createBuffer: () => ({ id: nextId++ }),
    deleteBuffer: () => {},
    bindBuffer: () => {},
    bufferData: (target: number) => {
      if (target === 34962) {
        stats.bufferDataCalls += 1
      }
    },
    bufferSubData: (_target: number, _dstByteOffset: number, srcData: Float32Array, srcOffset: number, length: number) => {
      stats.bufferSubDataCalls += 1
      stats.lastUploadedFloats = srcData.slice(srcOffset, srcOffset + length)
    },
    getAttribLocation: (_p: any, name: string) =>
      name === 'a_position' ? 0 : name === 'a_uv' ? 1 : name === 'a_tint' ? 2 : name === 'a_unit' ? 3 : 4,
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    createTexture: () => ({ id: nextId++ }),
    deleteTexture: () => {},
    bindTexture: () => {},
    texParameteri: () => {},
    pixelStorei: () => {},
    texStorage2D: () => {},
    texSubImage2D: () => {},
    texImage2D: () => {},
    getParameter: (param: number) => (param === 3379 ? 4096 : param === 34930 ? 16 : 0),
    getUniformLocation: (_p: any, name: string) => ({ name }),
    uniform2f: () => {},
    uniform1f: () => {},
    uniform1i: () => {},
    uniform1iv: () => {},
    uniform4f: () => {},
    enable: () => {},
    disable: () => {},
    blendFunc: () => {
      stats.blendFuncCalls += 1
    },
    viewport: () => {},
    clearColor: () => {},
    clear: () => {},
    activeTexture: () => {},
    drawElements: () => {
      stats.drawElementsCalls += 1
    },
  }
  const canvas: any = {
    getContext: (type: string) => (type === 'webgl2' ? gl : null),
    addEventListener: () => {},
    removeEventListener: () => {},
    width: 800,
    height: 600,
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
  }
  return { canvas, stats }
}

describe('Issue #811: High monster density combat performance fixes', () => {
  it('skips redundant 14,400-cell NpcRoomStore obstacle rescans when collisionRevision is unchanged, and refreshes immediately when setSubTileBlocked mutates obstacles', () => {
    const world = new ClientWorld()
    let collisionQueries = 0
    world.setCollisionChecker(() => {
      collisionQueries += 1
      return false
    })

    // Spawn 20 monsters in the same neighborhood
    for (let i = 1; i <= 20; i++) {
      world.apply({
        type: 'UnitAssign',
        isSelf: false,
        unit: {
          unitType: 'monster',
          id: 100 + i,
          classId: 1, // Fallen
          x: 50 + (i % 5),
          y: 50 + Math.floor(i / 5),
          lifePct: 128,
          mode: 1,
        },
      })
    }

    const queriesAfterSpawn = collisionQueries
    expect(queriesAfterSpawn).toBeGreaterThan(0)

    // Issue 20 move commands and step 25 simulation ticks (1 full second at 25Hz).
    // Without collisionRevision caching, 20 move commands + 25 ticks would rescan
    // 9x1600 = 14,400 cells 45 times = 648,000 collision queries!
    for (let i = 1; i <= 20; i++) {
      world.apply({
        type: 'UnitMove',
        unitType: 'monster',
        id: 100 + i,
        mode: 'walk',
        from: { x: 50 + (i % 5), y: 50 + Math.floor(i / 5) },
        to: { x: 60 + (i % 5), y: 60 + Math.floor(i / 5) },
      })
    }
    for (let tick = 1; tick <= 25; tick++) {
      world.tick(40, tick * 40)
    }

    // Zero additional synthetic room rescans should have occurred since collisionRevision did not change
    expect(collisionQueries).toBe(queriesAfterSpawn)

    // Now dynamically block a sub-tile via setSubTileBlocked -> collisionRevision increments -> next tick refreshes
    const prevRev = world.collisionRevision
    world.setSubTileBlocked(55, 55, true)
    expect(world.collisionRevision).toBe(prevRev + 1)

    world.tick(40, 26 * 40)
    expect(collisionQueries).toBeGreaterThan(queriesAfterSpawn)
    const room = world.npcMotion.findOrCreateRoomAt(55, 55)
    expect((room!.grid!.get(55, 55) & 0x0001) !== 0).toBe(true)
  })

  it('queries getAnimMetrics once per mode change with unitId for O(1) monster lookup', () => {
    const getAnimMetrics = vi.fn((_classId: number, _mode: number, _unitId?: number) => ({
      frameCount: 10,
      animSpeed: 256,
    }))
    const motion = new NpcMotion({ getAnimMetrics })

    motion.spawnMonster({
      unitId: 777,
      classId: 5,
      x: 40,
      y: 40,
      mode: 1,
    })

    expect(getAnimMetrics).toHaveBeenCalledTimes(1)
    expect(getAnimMetrics).toHaveBeenCalledWith(5, 1, 777)
  })

  it('flushes VBO via gl.bufferSubData without reallocating gl.bufferData on every draw call, and batches normal/trans25/trans50/trans75 quads together', () => {
    const { canvas, stats } = createMockWebGL2Canvas()
    const renderer = new SpriteRenderer(canvas)
    const atlas = renderer.addAtlas({
      pixels: new Uint8ClampedArray(32 * 32 * 4),
      width: 32,
      height: 32,
    })
    const frame = { x: 0, y: 0, width: 16, height: 16 }

    // 1 bufferData call on ARRAY_BUFFER during constructor initialization
    expect(stats.bufferDataCalls).toBe(1)

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    const initialDrawCalls = stats.drawElementsCalls

    // Interleave monster shadow ('trans50') and opaque body ('normal') + ghost ('trans25', 'trans75') across 30 monsters
    for (let i = 0; i < 30; i++) {
      renderer.draw(frame, i * 10, 0, { atlas, blendMode: 'trans50' })
      renderer.draw(frame, i * 10, 0, { atlas, blendMode: 'normal' })
      renderer.draw(frame, i * 10, 0, { atlas, blendMode: 'trans25' })
      renderer.draw(frame, i * 10, 0, { atlas, blendMode: 'trans75' })
    }
    renderer.end()

    // All 120 quads share the same GPU alpha blend state and are submitted in 1 draw call
    expect(renderer.quadsSubmitted).toBe(120)
    expect(stats.drawElementsCalls - initialDrawCalls).toBe(1)
    expect(renderer.drawCalls).toBe(1)
    // flush() must NOT have called gl.bufferData again
    expect(stats.bufferDataCalls).toBe(1)
    expect(stats.bufferSubDataCalls).toBe(1)

    // Verify per-vertex alpha values for the first 4 quads: trans50 (0.5), normal (1.0), trans25 (0.25), trans75 (0.75)
    // Each quad is 4 vertices * 10 floats = 40 floats; alpha is at offset +7 of each vertex
    const uploaded = stats.lastUploadedFloats!
    expect(uploaded[7]).toBeCloseTo(0.5)
    expect(uploaded[40 + 7]).toBeCloseTo(1.0)
    expect(uploaded[80 + 7]).toBeCloseTo(0.25)
    expect(uploaded[120 + 7]).toBeCloseTo(0.75)

    // Switching between 'normal' and 'additive' now batches in 1 draw call via unified PMA,
    // while 'modulate' still flushes into a separate draw call
    renderer.begin({ x: 0, y: 0, zoom: 1 })
    renderer.draw(frame, 0, 0, { atlas, blendMode: 'normal' })
    renderer.draw(frame, 10, 0, { atlas, blendMode: 'additive' })
    renderer.end()
    expect(renderer.drawCalls).toBe(1)

    renderer.begin({ x: 0, y: 0, zoom: 1 })
    renderer.draw(frame, 0, 0, { atlas, blendMode: 'normal' })
    renderer.draw(frame, 10, 0, { atlas, blendMode: 'modulate' })
    renderer.end()
    expect(renderer.drawCalls).toBe(2)

    renderer.dispose()
  })

  it('fast-paths non-self monster UnitMove and UnitMode packets in OnlineSession without running full HudModel.syncFromWorld', () => {
    const session = new OnlineSession()
    ;(session as any).handleServerEvent({
      type: 'LoadAct',
      act: 0,
      mapSeed: 0x1234,
      areaId: 2,
    })
    ;(session as any).handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Hero',
        x: 100,
        y: 100,
        lifePct: 128,
        mode: 1,
      },
    })
    ;(session as any).handleServerEvent({
      type: 'UnitAssign',
      isSelf: false,
      unit: {
        unitType: 'monster',
        id: 500,
        classId: 1,
        x: 105,
        y: 105,
        lifePct: 128,
        mode: 1,
      },
    })

    const syncFromWorldSpy = vi.spyOn(session.hudModel, 'syncFromWorld')
    const syncTargetSpy = vi.spyOn(session.hudModel, 'syncTargetMonsterFromWorld')

    // Hover monster 500 so its HP bar is tracked on HUD
    session.hudModel.setHoveredMonster(500)
    expect(session.hudManager.targetMonster?.unitId).toBe(500)
    expect(session.hudManager.targetMonster?.hp).toBe(128)

    syncFromWorldSpy.mockClear()
    syncTargetSpy.mockClear()

    // Dispatch 20 monster UnitMove and UnitMode packets
    for (let i = 0; i < 20; i++) {
      ;(session as any).handleServerEvent({
        type: 'UnitMove',
        unitType: 'monster',
        id: 500,
        mode: 'walk',
        from: { x: 105, y: 105 },
        to: { x: 102, y: 102 },
      })
    }
    ;(session as any).handleServerEvent({
      type: 'UnitMode',
      unitType: 'monster',
      id: 500,
      mode: 3,
      lifePct: 64,
    })

    // Full syncFromWorld must not have been called for monster movement/mode packets
    expect(syncFromWorldSpy).toHaveBeenCalledTimes(0)
    expect(syncTargetSpy).toHaveBeenCalledTimes(21)
    // Hovered monster's HP bar on HUD must still be updated in real time!
    expect(session.hudManager.targetMonster?.hp).toBe(64)

    session.destroy()
  })
})
