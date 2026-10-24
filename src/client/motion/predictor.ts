/**
 * Client entry point for the local player movement predictor. The implementation lives in
 * `src/common/path/movement-predictor.ts` so the server (`GameInstance.stepPlayerMovement`,
 * issue #1329) steps players with the exact same 1.13c velocity / path / collision rules.
 */
export * from '../../common/path/movement-predictor.ts'
