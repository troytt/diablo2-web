export interface SteadyLightSource {
  readonly playerSubX: number
  readonly playerSubY: number
  readonly lightSubX?: number | undefined
  readonly lightSubY?: number | undefined
}

export const steadyLightSub = (st: SteadyLightSource, local: { readonly x: number; readonly y: number }): { readonly x: number; readonly y: number } =>
  st.lightSubX === undefined || st.lightSubY === undefined ? local : { x: local.x + st.lightSubX - st.playerSubX, y: local.y + st.lightSubY - st.playerSubY }
