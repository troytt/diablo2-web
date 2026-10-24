/**
 * Diablo II 1.13c D2Common export ordinal map (`#10xxx`) for the dynamic-path and collision
 * functions ported in `src/common/path/` (Refs #808).
 *
 * Every entry maps a 1.13c `D2Common.dll` (ImageBase 0x6FD50000) ordinal to its ported function.
 */

import {
  COLLISION_CheckAnyCollisionWithPattern,
  COLLISION_CheckMask,
  COLLISION_CheckMaskWithPattern,
  COLLISION_CheckMaskWithSize,
  COLLISION_CheckMaskWithSizeXY,
  COLLISION_ResetMask,
  COLLISION_ResetMaskWithPattern,
  COLLISION_ResetMaskWithSize,
  COLLISION_ResetMaskWithSizeXY,
  COLLISION_SetMask,
  COLLISION_SetMaskWithPattern,
  COLLISION_SetMaskWithSize,
  COLLISION_SetMaskWithSizeXY,
  COLLISION_SetUnitCollisionMask,
  COLLISION_TryMoveUnitCollisionMask,
  COLLISION_TrySetUnitCollisionMask,
  COLLISION_TryTeleportUnitCollisionMask,
  DUNGEON_GetRoomAtPosition,
} from './collision.ts'
import {
  PATH_ComputeDirection,
  PATH_ComputeDirectionFromPreciseCoords_6FDAC760,
} from './direction.ts'
import {
  D2COMMON_10160_PathUpdateDirection,
  D2COMMON_10170_PathSetTargetPos,
  D2COMMON_10175_PathGetFirstPointX,
  D2COMMON_10176_PathGetFirstPointY,
  D2COMMON_10177_PATH_GetLastPointX,
  D2COMMON_10178_PATH_GetLastPointY,
  D2COMMON_10190_PATH_SetDistance,
  D2COMMON_10191_PATH_GetDistance,
  D2COMMON_10193_PATH_AdjustDirection,
  D2COMMON_10198_PathGetSaveStep,
  D2COMMON_10199_PathGetSaveX,
  D2COMMON_10200_PathGetSaveY,
  D2COMMON_10203_PATH_SetRotateFlag,
  D2COMMON_10204_PATH_ClearPoint2,
  D2COMMON_10208_PathSetPathingFlag,
  D2COMMON_10209_PathCheckPathingFlag,
  D2COMMON_10212_PATH_SetMoveFlags,
  D2Common_10153,
  D2Common_10155,
  D2Common_10201,
  D2Common_10202,
  D2Common_10207,
  D2Common_10214,
  D2Common_10216,
  D2Common_10224,
  D2Common_10225,
  D2Common_10228,
  D2Common_10234,
  D2Common_10235_PATH_UpdateRiderPath,
  D2Common_10237,
  D2Common_11281_CollisionPatternFromSize,
  PATH_AddCollisionFootprintForOptionalUnit,
  PATH_AddCollisionFootprintForUnit,
  PATH_AddToDistance,
  PATH_AllocDynamicPath,
  PATH_ClearNextRoom,
  PATH_ComputeSquaredDistance,
  PATH_FreeDynamicPath,
  PATH_GetAcceleration,
  PATH_GetClientCoordX,
  PATH_GetClientCoordY,
  PATH_GetCollisionPatternFromMonStats2Txt,
  PATH_GetDirection,
  PATH_GetDistance,
  PATH_GetFootprintCollisionMask,
  PATH_GetMaxDistance,
  PATH_GetMaxVelocity,
  PATH_GetMoveTestCollisionMask,
  PATH_GetNewDirection,
  PATH_GetNextRoom,
  PATH_GetNumberOfPathPoints,
  PATH_GetPathPoints,
  PATH_GetPrecisionX,
  PATH_GetPrecisionY,
  PATH_GetRoom,
  PATH_GetStepNum,
  PATH_GetTargetTypeAndGUID,
  PATH_GetTargetUnit,
  PATH_GetType,
  PATH_GetUnitCollisionPattern,
  PATH_GetUnusedFlag_0x00004,
  PATH_GetVelocity,
  PATH_GetXPosition,
  PATH_GetYPosition,
  PATH_IsCurrentRoomInvalid,
  PATH_RecacheRoomIfNeeded,
  PATH_RemoveCollisionFootprintForUnit,
  PATH_ResetToPreviousType,
  PATH_SetAcceleration,
  PATH_SetClientCoordX,
  PATH_SetClientCoordY,
  PATH_SetCurrentRoomInvalid,
  PATH_SetDirection,
  PATH_SetDistance,
  PATH_SetFootprintCollisionMask,
  PATH_SetIDAStarInitFScore,
  PATH_SetMaxVelocity,
  PATH_SetMoveTestCollisionMask,
  PATH_SetNewDistance,
  PATH_SetNumberOfPathPoints,
  PATH_SetPrecisionX,
  PATH_SetPrecisionY,
  PATH_SetRoom,
  PATH_SetStepNum,
  PATH_SetTargetUnit,
  PATH_SetType,
  PATH_SetUnitAliveCollision,
  PATH_SetUnitCollisionPattern,
  PATH_SetUnitDeadCollision,
  PATH_SetUnusedFlag_0x00004,
  PATH_SetVelocity,
} from './path.ts'
import { D2Common_10142 } from './path-compute.ts'
import {
  D2Common_10213,
  D2Common_10226,
  D2Common_10227,
  D2Common_10229,
  D2Common_10230,
  D2Common_10231,
  D2Common_10232,
  D2Common_10236,
  D2Common_10399,
  D2Common_10434_FaceSubtile,
} from './step.ts'
import {
  UNITS_GetRoom,
  UNITS_GetUnitSizeX,
  UNITS_IsDoor,
} from './units.ts'

/**
 * Lookup table mapping 1.13c `D2Common.dll` ordinal strings (`'#10xxx'`) to their ported TypeScript
 * implementations.
 */
export const D2COMMON_ORDINALS_113C = Object.freeze({
  /** 0x6FD84630 ≡ D2MOO #10217 PATH_SetDistance */
  '#10022': PATH_SetDistance,
  /** 0x6FD84EE0 ≡ D2MOO #10212 D2COMMON_10212_PATH_SetMoveFlags */
  '#10054': D2COMMON_10212_PATH_SetMoveFlags,
  /** 0x6FD5E1A0 ≡ D2MOO #10231 D2Common_10231 */
  '#10075': D2Common_10231,
  /** 0x6FD85C40 ≡ D2MOO #10143 PATH_SetUnitDeadCollision */
  '#10084': PATH_SetUnitDeadCollision,
  /** 0x6FD9CE90 ≡ D2MOO #10119 COLLISION_CheckMaskWithPattern */
  '#10114': COLLISION_CheckMaskWithPattern,
  /** 0x6FD85360 ≡ D2MOO #11281 D2Common_11281_CollisionPatternFromSize */
  '#10122': D2Common_11281_CollisionPatternFromSize,
  /** 0x6FD9C7B0 ≡ D2MOO #10126 COLLISION_SetMaskWithSizeXY */
  '#10123': COLLISION_SetMaskWithSizeXY,
  /** 0x6FD84CB0 ≡ D2MOO #10153 D2Common_10153 */
  '#10159': D2Common_10153,
  /** 0x6FD84F50 ≡ D2MOO #10188 PATH_SetNewDistance */
  '#10168': PATH_SetNewDistance,
  /** 0x6FD84AC0 ≡ D2MOO #10164 PATH_GetXPosition */
  '#10178': PATH_GetXPosition,
  /** 0x6FD9C640 ≡ D2MOO #10121 COLLISION_ResetMaskWithSize */
  '#10201': COLLISION_ResetMaskWithSize,
  /** 0x6FD84BF0 ≡ D2MOO #10157 PATH_GetPathPoints */
  '#10211': PATH_GetPathPoints,
  /** 0x6FD847C0 ≡ D2MOO #10198 D2COMMON_10198_PathGetSaveStep */
  '#10214': D2COMMON_10198_PathGetSaveStep,
  /** 0x6FD84670 ≡ D2MOO #10207 D2Common_10207 */
  '#10219': D2Common_10207,
  /** 0x6FD84D00 ≡ D2MOO #10147 PATH_GetVelocity */
  '#10220': PATH_GetVelocity,
  /** 0x6FD84690 ≡ D2MOO #10206 PATH_GetStepNum */
  '#10229': PATH_GetStepNum,
  /** 0x6FD84B80 ≡ D2MOO #10160 PATH_SetDirection */
  '#10248': PATH_SetDirection,
  /** 0x6FD84770 ≡ D2MOO #10199 D2COMMON_10199_PathGetSaveX */
  '#10253': D2COMMON_10199_PathGetSaveX,
  /** 0x6FD84BE0 ≡ D2MOO #10158 PATH_GetDirection */
  '#10269': PATH_GetDirection,
  /** 0x6FD85070 ≡ D2MOO #10186 PATH_ResetToPreviousType */
  '#10282': PATH_ResetToPreviousType,
  /** 0x6FD849D0 ≡ D2MOO #10170 D2COMMON_10170_PathSetTargetPos */
  '#10286': D2COMMON_10170_PathSetTargetPos,
  /** 0x6FD9CDD0 ≡ D2MOO #10133 COLLISION_TryTeleportUnitCollisionMask */
  '#10310': COLLISION_TryTeleportUnitCollisionMask,
  /** 0x6FD845E0 ≡ D2MOO #10219 PATH_AddToDistance */
  '#10311': PATH_AddToDistance,
  /** 0x6FD84BA0 ≡ D2MOO #10159 PATH_GetNewDirection */
  '#10324': PATH_GetNewDirection,
  /** 0x6FD7FE10 ≡ D2MOO #10342 UNITS_GetRoom */
  '#10331': UNITS_GetRoom,
  /** 0x6FD86230 ≡ D2MOO #10142 D2Common_10142 */
  '#10334': D2Common_10142,
  /** 0x6FD85040 ≡ D2MOO #10179 PATH_SetTargetUnit */
  '#10336': PATH_SetTargetUnit,
  /** 0x6FD86650 ≡ D2MOO #10213 D2Common_10213 */
  '#10340': D2Common_10213,
  /** 0x6FD5E230 ≡ D2MOO #10226 D2Common_10226 */
  '#10342': D2Common_10226,
  /** 0x6FD9C5B0 ≡ D2MOO #10122 COLLISION_ResetMaskWithSizeXY */
  '#10349': COLLISION_ResetMaskWithSizeXY,
  /** 0x6FD84810 ≡ D2MOO #10192 PATH_SetIDAStarInitFScore */
  '#10359': PATH_SetIDAStarInitFScore,
  /** 0x6FD5D3D0 ≡ D2MOO #10227 D2Common_10227 */
  '#10369': D2Common_10227,
  /** 0x6FD84990 ≡ D2MOO #10173 PATH_SetCurrentRoomInvalid */
  '#10390': PATH_SetCurrentRoomInvalid,
  /** 0x6FD848F0 ≡ D2MOO #10180 PATH_GetTargetUnit */
  '#10392': PATH_GetTargetUnit,
  /** 0x6FD84A60 ≡ D2MOO #10166 PATH_GetRoom */
  '#10398': PATH_GetRoom,
  /** 0x6FD9CD90 ≡ D2MOO #10133 COLLISION_SetUnitCollisionMask */
  '#10402': COLLISION_SetUnitCollisionMask,
  /** 0x6FDCFCD0 ≡ D2MOO #10399 D2Common_10399 */
  '#10407': D2Common_10399,
  /** 0x6FD85270 ≡ D2MOO #10160 D2COMMON_10160_PathUpdateDirection */
  '#10425': D2COMMON_10160_PathUpdateDirection,
  /** 0x6FD817F0 ≡ D2MOO UNITS_SetTargetUnitForDynamicUnit (orientation face toward sub-tile) */
  '#10434': D2Common_10434_FaceSubtile,
  /** 0x6FD84A00 ≡ D2MOO #10169 PATH_ClearNextRoom */
  '#10451': PATH_ClearNextRoom,
  /** 0x6FD849C0 ≡ D2MOO #10172 PATH_IsCurrentRoomInvalid */
  '#10462': PATH_IsCurrentRoomInvalid,
  /** 0x6FD9C990 ≡ D2MOO #10127 COLLISION_SetMask */
  '#10468': COLLISION_SetMask,
  /** 0x6FD84720 ≡ D2MOO #10200 D2COMMON_10200_PathGetSaveY */
  '#10477': D2COMMON_10200_PathGetSaveY,
  /** 0x6FD9C9D0 ≡ D2MOO #10118 COLLISION_CheckMask */
  '#10482': COLLISION_CheckMask,
  /** 0x6FD84AA0 ≡ D2MOO #10165 PATH_GetYPosition */
  '#10483': PATH_GetYPosition,
  /** 0x6FD84D40 ≡ D2MOO #10146 PATH_SetVelocity */
  '#10488': PATH_SetVelocity,
  /** 0x6FD848E0 ≡ D2MOO #10181 PATH_GetFootprintCollisionMask */
  '#10492': PATH_GetFootprintCollisionMask,
  /** 0x6FD84880 ≡ D2MOO #10190 D2COMMON_10190_PATH_SetDistance */
  '#10527': D2COMMON_10190_PATH_SetDistance,
  /** 0x6FD5E100 ≡ D2MOO #10229 D2Common_10229 */
  '#10533': D2Common_10229,
  /** 0x6FD84C30 ≡ D2MOO #10209 D2COMMON_10209_PathCheckPathingFlag */
  '#10573': D2COMMON_10209_PathCheckPathingFlag,
  /** 0x6FD80F80 ≡ D2MOO #10336 UNITS_GetUnitSizeX */
  '#10589': UNITS_GetUnitSizeX,
  /** 0x6FD84D70 ≡ D2MOO #10193 D2COMMON_10193_PATH_AdjustDirection */
  '#10603': D2COMMON_10193_PATH_AdjustDirection,
  /** 0x6FD9CC10 ≡ D2MOO #10128 COLLISION_SetMaskWithSize */
  '#10615': COLLISION_SetMaskWithSize,
  /** 0x6FD84F80 ≡ D2MOO #10185 PATH_SetType */
  '#10647': PATH_SetType,
  /** 0x6FD84A10 ≡ D2MOO #10168 PATH_GetNextRoom */
  '#10666': PATH_GetNextRoom,
  /** 0x6FD84CD0 ≡ D2MOO #10150 PATH_SetAcceleration */
  '#10676': PATH_SetAcceleration,
  /** 0x6FD84A90 ≡ D2MOO #10177 D2Common_10224 */
  '#10690': D2Common_10224,
  /** 0x6FD846D0 ≡ D2MOO #10204 D2COMMON_10204_PATH_ClearPoint2 */
  '#10723': D2COMMON_10204_PATH_ClearPoint2,
  /** 0x6FD84620 ≡ D2MOO #10218 PATH_GetDistance */
  '#10730': PATH_GetDistance,
  /** 0x6FD853D0 ≡ D2MOO #11282 PATH_GetCollisionPatternFromMonStats2Txt */
  '#10762': PATH_GetCollisionPatternFromMonStats2Txt,
  /** 0x6FD9D020 ≡ D2MOO #10131 COLLISION_TrySetUnitCollisionMask */
  '#10764': COLLISION_TrySetUnitCollisionMask,
  /** 0x6FD5DB40 ≡ D2MOO #10224 PATH_RecacheRoomIfNeeded */
  '#10770': PATH_RecacheRoomIfNeeded,
  /** 0x6FD5E200 ≡ D2MOO #10232 D2Common_10232 */
  '#10778': D2Common_10232,
  /** 0x6FD9CE00 ≡ D2MOO #10120 COLLISION_CheckAnyCollisionWithPattern */
  '#10796': COLLISION_CheckAnyCollisionWithPattern,
  /** 0x6FD5D820 ≡ D2MOO #10236 D2Common_10236 */
  '#10831': D2Common_10236,
  /** 0x6FD848B0 ≡ D2MOO #10183 PATH_GetMoveTestCollisionMask */
  '#10847': PATH_GetMoveTestCollisionMask,
  /** 0x6FD84890 ≡ D2MOO #10184 PATH_SetMoveTestCollisionMask */
  '#10848': PATH_SetMoveTestCollisionMask,
  /** 0x6FD84C70 ≡ D2MOO #10154 PATH_GetNumberOfPathPoints */
  '#10858': PATH_GetNumberOfPathPoints,
  /** 0x6FD9C940 ≡ D2MOO #10123 COLLISION_ResetMask */
  '#10870': COLLISION_ResetMask,
  /** 0x6FD84550 ≡ D2MOO #10237 D2Common_10237 */
  '#10877': D2Common_10237,
  /** 0x6FD84960 ≡ D2MOO #10145 PATH_SetUnusedFlag_0x00004 */
  '#10888': PATH_SetUnusedFlag_0x00004,
  /** 0x6FD5E150 ≡ D2MOO #10230 D2Common_10230 */
  '#10906': D2Common_10230,
  /** 0x6FD9C710 ≡ D2MOO #10124 COLLISION_ResetMaskWithPattern */
  '#10907': COLLISION_ResetMaskWithPattern,
  /** 0x6FD85BE0 ≡ D2MOO #10144 PATH_SetUnitAliveCollision */
  '#10938': PATH_SetUnitAliveCollision,
  /** 0x6FD84A60 ≡ D2MOO #10177 D2COMMON_10177_PATH_GetLastPointX */
  '#10976': D2COMMON_10177_PATH_GetLastPointX,
  /** 0x6FD84870 ≡ D2MOO #10191 D2COMMON_10191_PATH_GetDistance */
  '#10981': D2COMMON_10191_PATH_GetDistance,
  /** 0x6FD84AB0 ≡ D2MOO #10175 D2COMMON_10175_PathGetFirstPointX */
  '#10983': D2COMMON_10175_PathGetFirstPointX,
  /** 0x6FD84A30 ≡ D2MOO #10167 PATH_SetRoom */
  '#10991': PATH_SetRoom,
  /** 0x6FD851E0 ≡ D2MOO #10156 PATH_FreeDynamicPath */
  '#10996': PATH_FreeDynamicPath,
  /** 0x6FD84A80 ≡ D2MOO #10225 D2Common_10225 */
  '#10999': D2Common_10225,
  /** 0x6FD84A40 ≡ D2MOO #10178 D2COMMON_10178_PATH_GetLastPointY */
  '#11001': D2COMMON_10178_PATH_GetLastPointY,
  /** 0x6FD86030 ≡ D2MOO #10152 PATH_AllocDynamicPath */
  '#11003': PATH_AllocDynamicPath,
  /** 0x6FD846A0 ≡ D2MOO #10205 PATH_SetStepNum */
  '#11005': PATH_SetStepNum,
  /** 0x6FD848D0 ≡ D2MOO #10182 PATH_SetFootprintCollisionMask */
  '#11007': PATH_SetFootprintCollisionMask,
  /** 0x6FD85CF0 ≡ D2MOO #10214 D2Common_10214 */
  '#11011': D2Common_10214,
  /** 0x6FD7EDA0 ≡ D2MOO UNITS_IsDoor */
  '#11020': UNITS_IsDoor,
  /** 0x6FD51330 ≡ D2MOO #10135 DUNGEON_GetRoomAtPosition */
  '#11022': DUNGEON_GetRoomAtPosition,
  /** 0x6FD5D4D0 ≡ D2MOO #10215 PATH_ComputeDirection */
  '#11044': PATH_ComputeDirection,
  /** 0x6FD84CC0 ≡ D2MOO #10151 PATH_GetAcceleration */
  '#11056': PATH_GetAcceleration,
  /** 0x6FD84860 ≡ D2MOO #10189 PATH_GetMaxDistance */
  '#11058': PATH_GetMaxDistance,
  /** 0x6FD9CFC0 ≡ D2MOO #10130 COLLISION_CheckMaskWithSizeXY */
  '#11066': COLLISION_CheckMaskWithSizeXY,
  /** 0x6FD852F0 ≡ D2MOO #10216 D2Common_10216 */
  '#11076': D2Common_10216,
  /** 0x6FD84950 ≡ D2MOO #10174 PATH_GetUnusedFlag_0x00004 */
  '#11130': PATH_GetUnusedFlag_0x00004,
  /** 0x6FD84910 ≡ D2MOO #10171 PATH_GetTargetTypeAndGUID */
  '#11163': PATH_GetTargetTypeAndGUID,
  /** 0x6FD9CF70 ≡ D2MOO #10129 COLLISION_CheckMaskWithSize */
  '#11166': COLLISION_CheckMaskWithSize,
  /** 0x6FD9CD40 ≡ D2MOO #10132 COLLISION_TryMoveUnitCollisionMask */
  '#11172': COLLISION_TryMoveUnitCollisionMask,
  /** 0x6FD9CB20 ≡ D2MOO #10125 COLLISION_SetMaskWithPattern */
  '#11176': COLLISION_SetMaskWithPattern,
  /** 0x6FD85800 ≡ D2MOO #10223 PATH_RemoveCollisionFootprintForUnit */
  '#11203': PATH_RemoveCollisionFootprintForUnit,
  /** 0x6FD859D0 ≡ D2MOO #10222 PATH_AddCollisionFootprintForUnit */
  '#11231': PATH_AddCollisionFootprintForUnit,
  /** 0x6FD84C00 ≡ D2MOO #10155 D2Common_10155 */
  '#11245': D2Common_10155,
  /** 0x6FD84CF0 ≡ D2MOO #10148 PATH_SetMaxVelocity */
  '#11258': PATH_SetMaxVelocity,
  /** 0x6FD84CE0 ≡ D2MOO #10149 PATH_GetMaxVelocity */
  '#11270': PATH_GetMaxVelocity,
  /** 0x6FD85CD0 ≡ D2MOO #10228 D2Common_10228 */
  '#11280': D2Common_10228,
  /** 0x6FD84C50 ≡ D2MOO #11291 PATH_SetNumberOfPathPoints */
  '#11292': PATH_SetNumberOfPathPoints,
  /** 0x6FD848B0 / 0x6FD848A0 ≡ D2MOO #10187 PATH_GetType */
  '#11302': PATH_GetType,
  /** 0x6FD84C40 ≡ D2MOO #10208 D2COMMON_10208_PathSetPathingFlag */
  '#11321': D2COMMON_10208_PathSetPathingFlag,
  // Extra 1.13c getters/setters:
  PATH_GetPrecisionX,
  PATH_GetPrecisionY,
  PATH_SetPrecisionX,
  PATH_SetPrecisionY,
  PATH_GetClientCoordX,
  PATH_GetClientCoordY,
  PATH_SetClientCoordX,
  PATH_SetClientCoordY,
  PATH_ComputeSquaredDistance,
  PATH_ComputeDirectionFromPreciseCoords_6FDAC760,
  PATH_AddCollisionFootprintForOptionalUnit,
  PATH_GetUnitCollisionPattern,
  PATH_SetUnitCollisionPattern,
  D2COMMON_10176_PathGetFirstPointY,
  D2COMMON_10203_PATH_SetRotateFlag,
  D2Common_10201,
  D2Common_10202,
  D2Common_10234,
  D2Common_10235_PATH_UpdateRiderPath,
})
