/**
 * Client entry point for the shared sub-tile A* pathfinder. The implementation lives in
 * `src/common/path/pathfind.ts` so the server (`GameInstance.stepPlayerMovement`, issue #1329)
 * runs the exact same path search as the client predictor.
 */
export * from '../../common/path/pathfind.ts'
