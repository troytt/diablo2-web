/**
 * @file src/d2kern-113c/game/k3-p52-handlers-113c.ts
 * Clean-room 1:1 binary dispatch helpers for Milestone 34 (`[K3]`) longitudinal
 * golden replays (`p52-paladin-auras`, `p52-barbarian-warcries`, `p52-amazon-defense`).
 *
 * Strictly pure `src/d2kern-113c/` imports only (zero legacy common or host imports).
 */

import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import { PATH_GetPosX113c, PATH_GetPosY113c, PATH_SetTargetUnit113c } from '../common/path.ts'
import { UNITS_GetLeftSkill113c, UNITS_GetRightSkill113c } from '../common/quest-record.ts'
import {
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillSlotIndex113c,
  SKILLS_GetSkillUseFailReason113c,
  SKILLS_RefreshPassiveAuraSkills113c,
  SKILLS_SetParam0C113c,
} from '../common/skills.ts'
import {
  STATLIST_ExpireStateListsOnModeChange113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  UNITS_GetRoom113c,
  UNITS_SetUnitAnimMode113c,
  UNITS_UpdateAnimFrame113c,
} from '../common/unit.ts'
import { D2GameStrc, D2SkillStrc, D2UnitStrc } from '../mem/layout.generated.ts'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  NET_SendUnitTargetedSkillAction113c,
  PLAYER_Event0C_ExpireTimedStats113c,
  SUNIT_AreUnitsInSamePartyOrAligned113c,
} from './k2-gap-itemdef-113c.ts'
import {
  MISSILES_GetTxtRecordFast113c,
  MONSTER_Event12_ExpireTimedStats113c,
  type K2GapMeleeDotHooks113c,
} from './k2-gap-melee-dot-113c.ts'
import { MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c } from './k2-laneH-0x6fc2-w1-113c.ts'
import { SKILLS_ApplyTimedSkillAuraToTarget_6FC49240_113c } from './k2-w10b1-113c.ts'
import {
  MISSILE_ApplyFriendlyOwnerTimedSkillAura_6FC5EA60_113c,
  SKILLS_SrvDo045_NovaAndTimedAura_6FC49720_113c,
} from './k2-w11b1-113c.ts'
import { MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c } from './k2-w2b1-113c.ts'
import { SKILLS_RefreshPassiveSkillsAndIconsOnUnit_6FCBE370_113c } from './k2-w2b4-113c.ts'
import { PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c } from './k2-w9b1-113c.ts'
import {
  MONSTER_ClearModeEvents113c,
  SKILLS_SetUsedSkill113c,
} from './monster-events.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
} from './regpop-spawn-113c.ts'
import {
  AITHINK_CanPlayerStartSkillOrCast113c,
  AITHINK_CanPlayerSwitchToMode113c,
} from './town-runtime-gap-113c.ts'

/**
 * `@va D2Game:0x6FC98340` + `@va D2Game:0x6FC97FA0`:
 * Combined `AITHINK_CanPlayerSwitchToMode` + `AITHINK_CanPlayerStartSkillOrCast` guard
 * invoked by `PLAYER_StartModeOnUnit` (`0x6FC98430`) and `PLAYER_StartModeAtCoords` (`0x6FC98550`)
 * when `bForce == 0` (all C2S movement/attack/cast packets).
 */
export function PLAYER_CanStartModeAndSkillK3_113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
  nTargetMode: number,
  pTargetSkill: number,
  onResetNeutralWhenMode1?: () => void,
): number {
  if (AITHINK_CanPlayerSwitchToMode113c(m, pPlayer, pGame, nTargetMode) === 0) {
    return 0
  }
  return AITHINK_CanPlayerStartSkillOrCast113c(
    m,
    pPlayer,
    pGame,
    nTargetMode,
    1,
    pTargetSkill >>> 0,
    onResetNeutralWhenMode1 !== undefined ? onResetNeutralWhenMode1 : () => {},
  )
}

/**
 * `@va D2Game:0x6FC9852B`: bind left-hand skill into `pPlayer->pSkills->pUsedSkill`
 * when entering `PLRMODE_ATTACK1` via `0x06` or queued melee arrival.
 */
export function PLAYER_BindLeftSkillAsUsedK3_113c(m: Memory113c, pPlayer: number): void {
  const pLeftSkill = UNITS_GetLeftSkill113c(m, pPlayer) >>> 0
  if (pLeftSkill !== 0) {
    SKILLS_SetUsedSkill113c(m, pPlayer, pLeftSkill)
  }
}

/**
 * `@va D2Game:0x6FCFD1CE..0x6FCFD26C` -> `@va D2Game:0x6FC98430` -> `@va D2Game:0x6FC987C0`:
 * Start `PLRMODE_SPECIAL1` (`13`) on player defender when `wResultFlags & 0x80` (`STATE_DODGE = 65`)
 * or `wResultFlags & 0x100` (`STATE_AVOID = 66`) triggered in `SUNITDMG_ExecuteDamageResult`.
 */
export function PLAYER_TryStartDodgeOrAvoidModeK3_113c(
  m: Memory113c,
  pGame: number,
  pDefender: number,
  pAttacker: number,
  wResultFlags: number,
  scheduleAnimEvents: (m: Memory113c, pGame: number, pPlayer: number) => void,
  syncPathUnit?: (mode: number, flags: number) => void,
): number {
  const stateId = (wResultFlags & 0x80) !== 0 ? 0x41 : (wResultFlags & 0x100) !== 0 ? 0x42 : 0
  if (stateId === 0 || pGame === 0 || pDefender === 0) return 0
  const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pDefender, stateId)
  if (pStatList === 0) return 0
  const nSkillId = STATLIST_GetStatValue113c(m, pStatList, 0x15e, 0) | 0
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pDefender, nSkillId) >>> 0
  if (pSkill === 0) return 0
  SKILLS_SetParam0C113c(m, pSkill, (m.get(pSkill, D2SkillStrc.dwParam0C) | 4) >>> 0)

  if (PLAYER_CanStartModeAndSkillK3_113c(m, pDefender, pGame, 13, pSkill) === 0) {
    return 0
  }
  const pPlayerData = m.get(pDefender, D2UnitStrc.pUnitData) >>> 0
  if (pPlayerData !== 0) {
    m.setU32((pPlayerData + 0x150) >>> 0, 0)
    m.setU32((pPlayerData + 0x154) >>> 0, 0)
  }
  SKILLS_SetUsedSkill113c(m, pDefender, pSkill)

  const pPath = m.get(pDefender, D2UnitStrc.pPath) >>> 0
  if (pPath !== 0) {
    const isDeadMonsterCorpse =
      pAttacker !== 0 &&
      m.get(pAttacker, D2UnitStrc.dwUnitType) === 1 &&
      m.get(pAttacker, D2UnitStrc.dwAnimMode) === 12
    PATH_SetTargetUnit113c(m, pPath, isDeadMonsterCorpse ? 0 : pAttacker)
  }
  if (m.get(pDefender, D2UnitStrc.dwAnimMode) !== 13) {
    STATLIST_ExpireStateListsOnModeChange113c(m, pDefender, 0)
  }
  m.set(pDefender, D2UnitStrc.dwAnimMode, 13)
  UNITS_SetUnitAnimMode113c(m, pDefender, 0, 0)
  UNITS_UpdateAnimFrame113c(m, pDefender)
  MONSTER_ClearModeEvents113c(m, pGame, pDefender)
  scheduleAnimEvents(m, pGame, pDefender)
  const nextFlags = (m.get(pDefender, D2UnitStrc.dwFlags) & ~0x40) >>> 0
  m.set(pDefender, D2UnitStrc.dwFlags, nextFlags)
  const rawClient = pPlayerData !== 0 ? (m.u32((pPlayerData + 0x9c) >>> 0) >>> 0) : 0
  const pClient = rawClient !== 0 ? rawClient : (m.u32((pGame + 0x88) >>> 0) >>> 0)
  if (pClient !== 0) {
    const defId = m.u32((pDefender + 0x0c) >>> 0) >>> 0
    if (m.u32((pClient + 0x174) >>> 0) === 0) {
      m.setU32((pClient + 0x16c) >>> 0, 0)
      m.setU32((pClient + 0x170) >>> 0, defId)
      m.setU32((pClient + 0x174) >>> 0, pDefender >>> 0)
    }
    if (m.u32((pClient + 0x1a8) >>> 0) === 0) {
      m.setU32((pClient + 0x1a8) >>> 0, pGame >>> 0)
    }
    NET_SendUnitTargetedSkillAction113c(
      m,
      pClient,
      0,
      0,
      defId,
      pAttacker !== 0 ? m.u32(pAttacker) & 0xff : 1,
      pAttacker !== 0 ? m.u32((pAttacker + 0x0c) >>> 0) : 0xffffffff,
      nSkillId & 0xffff,
      0,
      1,
    )
  }
  if (syncPathUnit !== undefined) {
    syncPathUnit(13, nextFlags)
  }
  return 1
}

/**
 * `@va D2Game:0x6FCF957D..0x6FCF9635`: proportional `fild/fdivp/fmulp/__ftol` scaling of current
 * `hitpoints (6)`, `mana (8)`, and `stamina (10)` when `maxhp (7)`, `maxmana (9)`, or `maxstamina (11)` changes.
 */
function scaleResourceOnMaxChangedK3_113c(
  m: Memory113c,
  pUnit: number,
  curStatId: number,
  oldMax: number,
  newMax: number,
): void {
  if (newMax === oldMax || oldMax <= 0) return
  const curVal = STATLIST_GetUnitStat113c(m, pUnit, curStatId, 0) | 0
  if (curVal <= 0) return
  const denom = oldMax > 0x100 ? oldMax : 0x100
  let scaled = Math.trunc((curVal / denom) * newMax)
  if (scaled <= 1) scaled = 1
  if (scaled >= newMax) scaled = newMax
  STATLIST_SetUnitStat113c(m, pUnit, curStatId, scaled, 0)
  if (curStatId === 6 && m.u32(pUnit >>> 0) === 1) {
    let pMonTxt = MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c(m, pUnit) >>> 0
    if (pMonTxt === 0) {
      const classId = m.u32((pUnit + 0x04) >>> 0) | 0
      const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
      const pDataTables = pSgptPtr !== 0 ? (m.u32(pSgptPtr) >>> 0) : 0
      if (classId >= 0 && pDataTables !== 0 && classId < (m.u32((pDataTables + 0xa80) >>> 0) | 0)) {
        pMonTxt = (m.u32((pDataTables + 0xa78) >>> 0) + Math.imul(classId, 0x1a8)) >>> 0
      }
    }
    if (pMonTxt !== 0) {
      const nLifeRegen = m.u32((pMonTxt + 0x1a0) >>> 0) | 0
      if (nLifeRegen !== 0) {
        const regenVal = (Math.imul(newMax >> 8, nLifeRegen) >> 4) | 0
        STATLIST_SetUnitStat113c(m, pUnit, 0x4a, regenVal, 0)
      }
    }
  }
}

function syncDerivedMaxAndSkillStatsK3_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  oldMaxHp: number,
  oldMaxMana: number,
  oldMaxStam: number,
  oldAllSkills: number,
): void {
  if (pGame === 0 || pUnit === 0) return
  const newMaxHp = STATLIST_GetUnitStat113c(m, pUnit, 7, 0) | 0
  if (newMaxHp !== oldMaxHp) {
    scaleResourceOnMaxChangedK3_113c(m, pUnit, 6, oldMaxHp, newMaxHp)
  }
  const newMaxMana = STATLIST_GetUnitStat113c(m, pUnit, 9, 0) | 0
  if (newMaxMana !== oldMaxMana) {
    scaleResourceOnMaxChangedK3_113c(m, pUnit, 8, oldMaxMana, newMaxMana)
  }
  const newMaxStam = STATLIST_GetUnitStat113c(m, pUnit, 11, 0) | 0
  if (newMaxStam !== oldMaxStam) {
    scaleResourceOnMaxChangedK3_113c(m, pUnit, 10, oldMaxStam, newMaxStam)
  }
  const newAllSkills = STATLIST_GetUnitStat113c(m, pUnit, 127, 0) | 0
  if (newAllSkills !== oldAllSkills) {
    SKILLS_RefreshPassiveSkillsAndIconsOnUnit_6FCBE370_113c(m, pUnit)
    SKILLS_RefreshPassiveAuraSkills113c(m, pUnit)
  }
}

function ensureUnitGamePtrBoundK3_113c(m: Memory113c, pUnit: number, pGame: number): void {
  if (pUnit !== 0 && pGame !== 0 && m.u32((pUnit + 0x80) >>> 0) === 0) {
    m.setU32((pUnit + 0x80) >>> 0, pGame >>> 0)
  }
}

/**
 * `@va D2Game:0x6FC49240` (`SKILLS_ApplyTimedSkillAuraToTarget`) + `@va D2Game:0x6FCF9470`:
 * Routes timed skill buffs (`Battle Orders` `#149`, `Battle Command` `#155`, `Shout` `#138`)
 * directly through canonical `SKILLS_ApplyTimedSkillAuraToTarget_6FC49240_113c` (`0x6FC49240` ->
 * `0x6FC648E0` + `0x6FCB6FA0`) and fires `D2StatListEx.fpStatChanged` (`0x6FCF9470`).
 */
export function SKILLS_ApplyTimedSkillAuraWithStatSyncK3_113c(
  m: Memory113c,
  pTargetUnit: number,
  pGame: number,
  pCasterUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  if (pTargetUnit === 0 || pGame === 0 || (nSkillId | 0) < 0) return 0
  ensureUnitGamePtrBoundK3_113c(m, pTargetUnit, pGame)
  const oldMaxHp = STATLIST_GetUnitStat113c(m, pTargetUnit, 7, 0) | 0
  const oldMaxMana = STATLIST_GetUnitStat113c(m, pTargetUnit, 9, 0) | 0
  const oldMaxStam = STATLIST_GetUnitStat113c(m, pTargetUnit, 11, 0) | 0
  const oldAllSkills = STATLIST_GetUnitStat113c(m, pTargetUnit, 127, 0) | 0

  const rc = SKILLS_ApplyTimedSkillAuraToTarget_6FC49240_113c(
    m as SparseMemory113c,
    pTargetUnit,
    pGame,
    pCasterUnit,
    nSkillId,
    nSkillLevel,
  )
  if (rc !== 0) {
    syncDerivedMaxAndSkillStatsK3_113c(
      m,
      pGame,
      pTargetUnit,
      oldMaxHp,
      oldMaxMana,
      oldMaxStam,
      oldAllSkills,
    )
  }
  return rc
}

/**
 * `@va D2Game:0x6FC97820` + `@va D2Game:0x6FCF9470`:
 * Runs `PLAYER_Event0C_ExpireTimedStats113c`, invokes canonical `0x6FCB6FA0` when any player
 * timed state with `fpRemove === 0x6FCBF7A0` expires, and triggers `0x6FCF9470` resource/skill scaling.
 */
export function PLAYER_Event0C_ExpireTimedStatsWithSyncK3_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  arg14: number,
  arg18: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  if (pUnit === 0 || pGame === 0) return
  ensureUnitGamePtrBoundK3_113c(m, pUnit, pGame)
  const oldMaxHp = STATLIST_GetUnitStat113c(m, pUnit, 7, 0) | 0
  const oldMaxMana = STATLIST_GetUnitStat113c(m, pUnit, 9, 0) | 0
  const oldMaxStam = STATLIST_GetUnitStat113c(m, pUnit, 11, 0) | 0
  const oldAllSkills = STATLIST_GetUnitStat113c(m, pUnit, 127, 0) | 0

  let hadTimedStateRemove0x6FCBF7A0 = false
  if (m.u32(pUnit >>> 0) === 0) {
    const nFrame = m.u32(((pGame >>> 0) + 0xa8) >>> 0) | 0
    const pEx = m.u32((pUnit + 0x5c) >>> 0) >>> 0
    if (pEx !== 0 && (m.u32((pEx + 0x10) >>> 0) | 0) < 0) {
      for (let listOff = 0x3c; listOff <= 0x40 && !hadTimedStateRemove0x6FCBF7A0; listOff += 4) {
        let sub = m.u32((pEx + listOff) >>> 0) >>> 0
        while (sub !== 0) {
          const flags = m.u32((sub + 0x10) >>> 0)
          if (
            (flags & 0x02) !== 0 &&
            (nFrame === 0 || (m.u32((sub + 0x18) >>> 0) | 0) <= nFrame) &&
            m.u32((sub + 0x38) >>> 0) === 0x6fcbf7a0
          ) {
            hadTimedStateRemove0x6FCBF7A0 = true
            break
          }
          sub = m.u32((sub + 0x2c) >>> 0) >>> 0
        }
      }
    }
  }

  MONSTER_Event12_ExpireTimedStats113c(m, pGame, pUnit, arg14, arg18, hooks)
  PLAYER_Event0C_ExpireTimedStats113c(m, pGame, pUnit, arg14, arg18)
  if (hadTimedStateRemove0x6FCBF7A0) {
    PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(
      m as SparseMemory113c,
      pGame,
      pUnit,
    )
  }
  syncDerivedMaxAndSkillStatsK3_113c(
    m,
    pGame,
    pUnit,
    oldMaxHp,
    oldMaxMana,
    oldMaxStam,
    oldAllSkills,
  )
}

/**
 * `@va D2Game:0x6FC49720` (`SKILLS_SrvDo068_BasicShout`, `wSrvDoFunc = 68`):
 * Delegates directly to canonical `SKILLS_SrvDo045_NovaAndTimedAura_6FC49720_113c` + `0x6FCF9470` stat sync.
 */
export function SKILLS_SrvDo068_BasicShoutK3_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  if (pUnit === 0 || pGame === 0) return 0
  ensureUnitGamePtrBoundK3_113c(m, pUnit, pGame)
  const oldMaxHp = STATLIST_GetUnitStat113c(m, pUnit, 7, 0) | 0
  const oldMaxMana = STATLIST_GetUnitStat113c(m, pUnit, 9, 0) | 0
  const oldMaxStam = STATLIST_GetUnitStat113c(m, pUnit, 11, 0) | 0
  const oldAllSkills = STATLIST_GetUnitStat113c(m, pUnit, 127, 0) | 0

  const rc = SKILLS_SrvDo045_NovaAndTimedAura_6FC49720_113c(
    m as SparseMemory113c,
    pGame,
    pUnit,
    nSkillId,
    nSkillLevel,
    hooks,
  )
  if (rc !== 0) {
    syncDerivedMaxAndSkillStatsK3_113c(
      m,
      pGame,
      pUnit,
      oldMaxHp,
      oldMaxMana,
      oldMaxStam,
      oldAllSkills,
    )
  }
  return rc
}

/**
 * `@va D2Game:0x6FC5EA60` (`MISSMODE_SrvHit18_Shout_BattleCommand_BattleOrders`, `wSrvHit = 18`):
 * Delegates directly to canonical `MISSILE_ApplyFriendlyOwnerTimedSkillAura_6FC5EA60_113c` + `0x6FCF9470` stat sync.
 */
export function MISSMODE_SrvHit18_ShoutBattleOrdersCommandK3_113c(
  m: Memory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit: number,
): number {
  let alignedTarget = false
  let oldMaxHp = 0
  let oldMaxMana = 0
  let oldMaxStam = 0
  let oldAllSkills = 0
  if (
    pMissile !== 0 &&
    pTargetUnit !== 0 &&
    pGame !== 0 &&
    ((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) !== 0
  ) {
    const pOwner = SUNIT_GetServerUnit113c(
      m,
      pGame,
      m.u32((pMissile + 0x94) >>> 0),
      m.u32((pMissile + 0x98) >>> 0),
    )
    if (pOwner !== 0 && SUNIT_AreUnitsInSamePartyOrAligned113c(m, pTargetUnit, pOwner) !== 0) {
      alignedTarget = true
      ensureUnitGamePtrBoundK3_113c(m, pTargetUnit, pGame)
      oldMaxHp = STATLIST_GetUnitStat113c(m, pTargetUnit, 7, 0) | 0
      oldMaxMana = STATLIST_GetUnitStat113c(m, pTargetUnit, 9, 0) | 0
      oldMaxStam = STATLIST_GetUnitStat113c(m, pTargetUnit, 11, 0) | 0
      oldAllSkills = STATLIST_GetUnitStat113c(m, pTargetUnit, 127, 0) | 0
    }
  }
  const rc = MISSILE_ApplyFriendlyOwnerTimedSkillAura_6FC5EA60_113c(
    m as SparseMemory113c,
    pGame,
    pMissile,
    pTargetUnit,
  )
  if (alignedTarget) {
    syncDerivedMaxAndSkillStatsK3_113c(
      m,
      pGame,
      pTargetUnit,
      oldMaxHp,
      oldMaxMana,
      oldMaxStam,
      oldAllSkills,
    )
  }
  return rc
}

/**
 * `@va D2Game:0x6FC59600` (`MISSMODE_SrvDmg07_Warcry_ShockWave`, `wSrvDmg = 7`):
 * Delegates directly to canonical `MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c`.
 */
export function MISSMODE_SrvDmg07_WarcryShockWaveK3_113c(
  m: Memory113c,
  pGame: number,
  pMissile: number,
  pDamage: number,
): void {
  MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c(m, pMissile, pGame, pDamage)
}

/**
 * Default `hitFlags` preservation for `MISSILE_ProcessTargetCollisionHit113c` (`0x6FC5EDE0`)
 * when `hooks.srvHitMissile` is installed and `wSrvHitIdx` is not a custom-dispatched K3 entry.
 */
export function MISSILE_DefaultSrvHitFlagsK3_113c(m: Memory113c, pMissile: number): number {
  if (pMissile === 0) return 2
  const pMisTxt = MISSILES_GetTxtRecordFast113c(m, m.u32((pMissile + 0x04) >>> 0) | 0)
  if (pMisTxt === 0) return 2
  const gdwBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const mask2 = gdwBitMasks !== 0 ? m.u8((gdwBitMasks + 0x08) >>> 0) : 0x04
  let hitFlags = (m.u8((pMisTxt + 0x04) >>> 0) & mask2) !== 0 ? 0 : 2
  if (m.u8((pMisTxt + 0x186) >>> 0) !== 0) {
    hitFlags |= 1
  }
  return hitFlags
}

/**
 * `@va D2Game:0x6FCEE520` -> `0x6FCEBF50` -> `0x6FCEB690` -> `0x6FCEDF30` -> `@va D2Common:0x6FDA2340`:
 * Validates C2S `0x0C` (`RightSkillOnLocation`) 50-subtile target distance, town restriction,
 * `SKILLS_GetSkillUseFailReason113c` (`D2Common.#10787` OOM/charges/skilldelay abort, e.g. `F1070`),
 * `SKILLS_GetSkillSlotIndex113c` (`D2Common.#10952`), and `PLAYER_CanStartModeAndSkillK3_113c`.
 */
export function PLAYER_ValidatePacket0CLocationCastK3_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  nX: number,
  nY: number,
): { readonly pSkill: number; readonly nMode: number } | null {
  if (pGame === 0 || pPlayer === 0) return null
  const pPlayerData = m.get(pPlayer, D2UnitStrc.pUnitData) >>> 0
  if (pPlayerData === 0) return null

  const pPath = m.get(pPlayer, D2UnitStrc.pPath) >>> 0
  const px = pPath !== 0 ? (PATH_GetPosX113c(m, pPath) | 0) : 0
  const py = pPath !== 0 ? (PATH_GetPosY113c(m, pPath) | 0) : 0
  if (Math.abs(px - (nX | 0)) > 50 || Math.abs(py - (nY | 0)) > 50) {
    return null
  }
  m.setU32((pPlayerData + 0x168) >>> 0, m.get(pGame, D2GameStrc.dwGameFrame) >>> 0)

  const pRightSkill = UNITS_GetRightSkill113c(m, pPlayer) >>> 0
  if (pRightSkill === 0) return null

  const nextCastCnt = ((STATLIST_GetUnitStat113c(m, pPlayer, 0x148, 0) | 0) + 1) | 0
  STATLIST_SetUnitStat113c(m, pPlayer, 0x148, nextCastCnt, 0)

  const curMode = m.get(pPlayer, D2UnitStrc.dwAnimMode) >>> 0
  if (curMode === 0 || curMode === 0x11) return null

  let pSkill = pRightSkill
  let failReason = SKILLS_GetSkillUseFailReason113c(m, pPlayer, pSkill) | 0
  const pSkillsTxt = m.u32(pSkill) >>> 0
  if (pSkillsTxt === 0) return null

  const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
  if (pRoom !== 0 && DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
    const skillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0xba) | 0
    if (skillId > 0 && (m.u8((pSkillsTxt + 0x06) >>> 0) & 0x20) === 0) {
      return null
    }
  }

  if (failReason > 0 && (failReason <= 2 || failReason === 4)) {
    const gdwBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
    const mask4 = gdwBitMasks !== 0 ? m.u8((gdwBitMasks + 0x10) >>> 0) : 0x10
    if ((m.u8((pSkillsTxt + 0x07) >>> 0) & mask4) !== 0) {
      pSkill = SKILLS_GetSkillById113c(m, pPlayer, 0, -1) >>> 0
      if (pSkill === 0) return null
      failReason = SKILLS_GetSkillUseFailReason113c(m, pPlayer, pSkill) | 0
    }
  }

  const slotMode = SKILLS_GetSkillSlotIndex113c(m, pPlayer, pSkill) | 0
  if (slotMode === 0 || failReason !== 0) {
    return null
  }

  const targetMode = slotMode === 18 ? 18 : slotMode === 7 || slotMode === 8 ? slotMode : 10
  if (PLAYER_CanStartModeAndSkillK3_113c(m, pPlayer, pGame, targetMode, pSkill) === 0) {
    return null
  }
  return { pSkill, nMode: targetMode }
}
