/**
 * @file src/d2kern-113c/game/k3-p52-sorc-handlers-113c.ts
 * Clean-room 1:1 binary dispatch helpers for Milestone 34 (`[K3]`) Sorceress
 * longitudinal golden replays (`p52-sorceress-elemental`, `p52-sorceress-fire-dot`).
 *
 * Strictly pure `src/d2kern-113c/` imports only (zero legacy common or host imports).
 */

import { ANIMSEQ_GetEventAtFrame113c } from '../common/composit.ts'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetSkillIdFromSkill113c,
} from '../common/skills.ts'
import { STATES_CheckState113c } from '../common/statlist.ts'
import {
  UNITS_GetAnimStartFrame113c,
  UNITS_GetRoom113c,
  UNITS_SetSeqFrameFromLowByte113c,
} from '../common/unit.ts'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint.ts'
import { D2UnitStrc } from '../mem/layout.generated.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  SKILLS_DoUsedSkillAction113c,
  SKILLS_StartUsedSkill113c,
} from './a1c-post150-f786-f1040-113c.ts'
import { SUNITDMG_FreeAttackerCombatList113c } from './ai-fallen-113c.ts'
import {
  C2S_Packet0C_RightSkillOnLocation113c,
  C2S_Packet0D_RightSkillOnUnit113c,
  type C2SPacketCallees113c,
} from './c2s-packet-113c.ts'
import { MONSTER_SetLastHitModeField54_113c } from './k2-gap-itemdef-113c.ts'
import {
  type K2GapMeleeDotHooks113c,
  MISSILES_GetTxtRecordFast113c,
  MISSILE_SrvDo01_FastcallThunk113c,
  MONSTER_StartGetHitMode113c,
  SKILLS_SrvDo_NovaRing113c,
} from './k2-gap-melee-dot-113c.ts'
import { MONUMOD_DispatchOnKillEvent5_113c } from './k2-items-tc-w1-113c.ts'
import { MISSILES_SrvHit_RollKnockbackResult_6FC59670_113c } from './k2-laneK-0x6fc5-w1-113c.ts'
import { SKILLS_SrvSt15_CheckRevivableCorpseOutsideTown_6FC6EF20_113c } from './k2-laneL-0x6fc6-w1-113c.ts'
import {
  PLAYER_StartModeDispatch113c,
  SUNITDMG_CheckMonTypeFlag113c,
  SUNITDMG_ClampManaBurnByMonsterSkill113c,
  SUNITDMG_RollDodgeAvoidEvadeBlock113c,
  SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c,
  type SUnitDmgHooks113c,
} from './k2-real-s2c-combat-113c.ts'
import {
  MISSILES_ConvertPhysToElemDamageByCalc_6FC59CE0_113c,
  MISSILES_SrvDmg12B_Nova64RingOnExpire_6FC5C850_113c,
} from './k2-w3b3-113c.ts'
import {
  MISSILE_SrvDo_CollisionPatternAndAnimFrame_6FC61980_113c,
  MISSILE_SrvDo_RadialRingSubMissile_6FC60CA0_113c,
  MISSILE_SrvDo_SpiralPath_6FC60BD0_113c,
  MISSILE_SrvDo_TrailVerifiedOwnerSubMissile_6FC61850_113c,
} from './k2-w3b4-113c.ts'
import { SKILLS_SrvDo_ApplyRadiusAuraStatList_6FC6C2A0_113c } from './k2-w4b2-113c.ts'
import { SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c } from './k2-w4b6-113c.ts'
import { MISSILES_SrvHit_ChainBounceProjectile_6FC5D020_113c } from './k2-w5b1-113c.ts'
import { STATES_RemoveMorphStateAndClampVitals_6FCB8450_113c } from './k2-w5b2-113c.ts'
import { SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c } from './k2-w5b3-113c.ts'
import { SUNITDMG_OnFreezeStateExpiredCallback_6FCFB4C0_113c } from './k2-w5b7-113c.ts'
import {
  MISSILE_SrvHit_RadialETypeDamageByCalc1_6FC5B990_113c,
  SKILLS_SrvDo_FireWallPerpendicularControllers_6FC637D0_113c,
} from './k2-w6b1-113c.ts'
import { SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c } from './k2-w6b2-113c.ts'
import { SKILLS_SrvDo043_SpawnSrvMissileWithRange_6FC63720_113c } from './k2-w7b1-113c.ts'
import { SKILLS_SrvDo120_LaunchSkillOrWeaponMissile_6FCD49F0_113c } from './k2-w7b3-113c.ts'
import {
  MISSILE_DefaultSrvHitFlagsK3_113c,
  MISSMODE_SrvDmg07_WarcryShockWaveK3_113c,
  MISSMODE_SrvHit18_ShoutBattleOrdersCommandK3_113c,
  SKILLS_SrvDo068_BasicShoutK3_113c,
} from './k3-p52-handlers-113c.ts'
import { dispatchSummonOrCurseDoFuncK3_113c } from './k3-summon-curse-replay-113c.ts'
import {
  MONSTER_ClearModeEvents113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events.ts'
import {
  SKILLS_GetRecordPtrFast113c,
  SUNIT_InitUnitAnimData113c,
  SUNIT_ValidatePathTargetUnit113c,
} from './regpop-spawn-113c.ts'
import { SUNIT_ScheduleModeAnimEvents113c } from './replay-kernel-113c.ts'
import type { PureCharAnimClip113c } from './tables-bootstrap-113c.ts'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel.ts'

let k3SorcScratchSp = 0x7ef70000

function sx16(v: number): number {
  return (v << 16) >> 16
}

/**
 * `@va D2Game:0x6FCFF7B0`: schedules mode step (`0`) and mode end (`1`) events for both
 * `AnimData` modes and `PLRMODE_SEQUENCE (18)` (`pUnit + 0x30` `D2AnimSeqTxt*`), delegating
 * standard clips directly to canonical `SUNIT_ScheduleModeAnimEvents113c` (`0x6FCFF7B0`).
 */
export function PLAYER_ScheduleModeAnimEventsK3_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): void {
  const u = pUnit >>> 0
  const g = pGame >>> 0
  const startFrame = UNITS_GetAnimStartFrame113c(m, u) | 0
  const pSeq = m.u32((u + 0x30) >>> 0)
  const stepFp8 = pSeq !== 0 ? (m.u32((u + 0x3c) >>> 0) | 0) : sx16(m.u16((u + 0x4c) >>> 0))
  const endFp8 = pSeq !== 0 ? (m.u32((u + 0x34) >>> 0) | 0) : (m.u32((u + 0x48) >>> 0) | 0)
  if (stepFp8 === 0) {
    SUNIT_ScheduleModeAnimEvents113c(m, g, u, { frames: 0, speed: 0, events: [] }, startFrame, 0)
    return
  }

  const pAnimData = m.u32((u + 0x50) >>> 0)
  if (stepFp8 > 0 && (endFp8 & 0xff) === 0) {
    const frames = endFp8 >> 8
    const events: { f: number; c: number }[] = []
    let hasCode4 = false
    const savedSp = k3SorcScratchSp
    const pEventScratch = savedSp
    k3SorcScratchSp = (savedSp + 16) >>> 0
    try {
      for (let f = startFrame; f < frames && f < 0x90; f++) {
        let evCode = 0
        if (pSeq !== 0) {
          m.setU32(pEventScratch, 0)
          ANIMSEQ_GetEventAtFrame113c(m, pSeq, (f << 8) >>> 0, pEventScratch)
          evCode = m.u32(pEventScratch) | 0
        } else if (pAnimData !== 0) {
          evCode = m.u8((pAnimData + f + 0x10) >>> 0)
        }
        if (evCode >= 1 && evCode <= 4) {
          if (evCode === 4) hasCode4 = true
          events.push({ f, c: evCode })
        }
      }
    } finally {
      k3SorcScratchSp = savedSp
    }
    if (!hasCode4) {
      const clip: PureCharAnimClip113c = { frames, speed: stepFp8, events }
      SUNIT_ScheduleModeAnimEvents113c(m, g, u, clip, startFrame, stepFp8)
      m.setU32((u + 0x44) >>> 0, (m.u32((g + 0xa8) >>> 0) << 8) >>> 0)
      return
    }
  }

  let ebx = m.u32((g + 0xa8) >>> 0) | 0
  let curFp8 = (startFrame << 8) | 0
  let edi = curFp8 >> 8
  curFp8 = (curFp8 + stepFp8) | 0
  let stepIdx = 0
  const savedSp = k3SorcScratchSp
  const pEventScratch = savedSp
  k3SorcScratchSp = (savedSp + 16) >>> 0
  try {
    while (curFp8 < endFp8) {
      const nextFrameIdx = curFp8 >> 8
      ebx = (ebx + 1) | 0
      while (edi <= nextFrameIdx && edi < 0x90) {
        let evCode = 0
        const curSeq = m.u32((u + 0x30) >>> 0)
        if (curSeq !== 0) {
          m.setU32(pEventScratch, 0)
          ANIMSEQ_GetEventAtFrame113c(m, curSeq, (edi << 8) >>> 0, pEventScratch)
          evCode = m.u32(pEventScratch) | 0
        } else if (pAnimData !== 0) {
          evCode = m.u8((pAnimData + edi + 0x10) >>> 0)
        }
        if (evCode === 1 || evCode === 2 || evCode === 4) {
          EVENT_SetEventFull113c(m, g, u, 0, ebx, 0, evCode, stepIdx)
          stepIdx = (stepIdx + 1) | 0
        } else if (evCode === 3) {
          EVENT_SetEventFull113c(m, g, u, 0, ebx, 0, 3, 0)
        }
        edi = (edi + 1) | 0
      }
      curFp8 = (curFp8 + stepFp8) | 0
    }
  } finally {
    k3SorcScratchSp = savedSp
  }
  const gameFrame = m.u32((g + 0xa8) >>> 0) | 0
  if (ebx === gameFrame) {
    ebx = (ebx + 1) | 0
  }
  ebx = (ebx + 1) | 0
  EVENT_SetEventFull113c(m, g, u, 1, ebx, 0, 0, 0)
  m.setU32((u + 0x44) >>> 0, (m.u32((g + 0xa8) >>> 0) << 8) >>> 0)
}

/**
 * `@va D2Game:0x6FC987C0`: starts unit-targeted cast / sequence mode (`10` or `18`),
 * binds `pTargetUnit` via `D2Common.#11129`, initializes anim / sequence data (`0x6FCFFF10`),
 * schedules mode events (`0x6FCFF7B0`), clears `dwFlags & 0x40`, and runs `0x6FCC0830`.
 */
export function PLAYER_StartCastSkillOnUnitK3_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  nMode: number,
  pTargetUnit: number,
): void {
  const game = pGame >>> 0
  const plr = pPlayer >>> 0
  SUNITDMG_FreeAttackerCombatList113c(m, plr, game)
  UNITS_ChangeAnimMode113c(m, plr, nMode | 0)
  UNITS_SetTargetUnitForDynamicUnit113c(m, plr, pTargetUnit >>> 0)
  SUNIT_InitUnitAnimData113c(m, plr)
  MONSTER_ClearModeEvents113c(m, game, plr)
  PLAYER_ScheduleModeAnimEventsK3_113c(m, game, plr)
  m.setU32((plr + 0xc4) >>> 0, (m.u32((plr + 0xc4) >>> 0) & 0xffffffbf) >>> 0)
  SUNIT_ValidatePathTargetUnit113c(m, plr, game)
  SKILLS_StartUsedSkill113c(m, plr, game, (mem, stIdx, pg, pu, skId, skLvl) =>
    stIdx === 15
      ? SKILLS_SrvSt15_CheckRevivableCorpseOutsideTown_6FC6EF20_113c(mem, pg, pu, skId, skLvl)
      : 1,
  )
}

/**
 * `@va D2Game:0x6FCEE520` (`0x0C` right skill on location) + `@va D2Game:0x6FCEE870` (`0x0D` right skill on unit):
 * Enforces the exact `50`-subtile (`0x32`) coordinate delta guard (`0x6FCEBF50` / `0x6FCED630` -> `0x6FCECFE0` -> `0x6FCEB690`),
 * `D2Common.#10787` (`SKILLS_GetSkillUseFailReason113c` mana/delay gate), and `D2Common.#10952` (`SKILLS_GetSkillSlotIndex113c`
 * `PLRMODE_CAST = 10` vs `PLRMODE_SEQUENCE = 18`).
 */
export function PLAYER_HandleC2SRightSkillK3_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  packetBytes: Uint8Array,
  resolveUnit: (targetType: number, targetId: number) => number,
  syncPathUnit?: (mode: number, flags: number) => void,
): number {
  if (packetBytes.length === 0 || pPlayer === 0) return 0
  const op = packetBytes[0]!
  const view = new DataView(packetBytes.buffer, packetBytes.byteOffset, packetBytes.byteLength)

  if (UNITS_GetRoom113c(m, pPlayer) === 0) return 0
  const curMode = m.get(pPlayer, D2UnitStrc.dwAnimMode)
  if (curMode === 0 || curMode === 0x11) return 0
  if (
    m.get(pPlayer, D2UnitStrc.pStatListEx) !== 0 &&
    STATES_CheckState113c(m, pPlayer, 1) !== 0
  ) {
    return 0
  }

  const savedSp = k3SorcScratchSp
  const pPkt = savedSp
  k3SorcScratchSp = (savedSp + 16) >>> 0
  try {
    for (let i = 0; i < packetBytes.length && i < 16; i++) {
      m.setU8((pPkt + i) >>> 0, packetBytes[i]!)
    }
    const callees: C2SPacketCallees113c = {
      findServerUnit(_mem, _pg, dwUnitType, dwUnitId) {
        return resolveUnit(dwUnitType, dwUnitId) >>> 0
      },
      onStartAttackOnUnit(mem, pg, plr, tgt, mode) {
        PLAYER_StartCastSkillOnUnitK3_113c(mem, pg, plr, mode, tgt)
      },
      onAfterModeStarted(mem, plr) {
        if (syncPathUnit !== undefined) {
          syncPathUnit(mem.get(plr, D2UnitStrc.dwAnimMode), mem.get(plr, D2UnitStrc.dwFlags))
        }
      },
    }

    if (op === 0x0c && packetBytes.length >= 5) {
      const x = view.getUint16(1, true)
      const y = view.getUint16(3, true)
      if (x === 0 || y === 0) return 0
      const rc = C2S_Packet0C_RightSkillOnLocation113c(m, pGame, pPlayer, pPkt, 5, callees)
      return rc === 0 ? 1 : 0
    }

    if (op === 0x0d && packetBytes.length >= 9) {
      const rc = C2S_Packet0D_RightSkillOnUnit113c(m, pGame, pPlayer, pPkt, 9, callees)
      return rc === 0 ? 1 : 0
    }
  } finally {
    k3SorcScratchSp = savedSp
  }

  return 0
}

/**
 * `@va D2Game:0x6FCC2060` -> `@va D2Game:0x6FCC19A0`:
 * Executes `pUnit`'s used skill action through canonical manifest-bound `SrvDo` handlers
 * (`0x6FC6C2A0`, `0x6FC637D0`, `0x6FC63720`, `0x6FC49720`, `0x6FCD49F0`, summon/curse `SrvDo`),
 * `0x6FCC1790` (`decquant`), and `0x6FCBFF70` (`STATE_SKILLDELAY`).
 */
export function SKILLS_DoUsedSkillActionK3_113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  hooks: K2GapMeleeDotHooks113c,
): number {
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0
  if (pSkill === 0) return 0
  const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0) | 0
  if (nSkillId < 0) return 0
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) return 0

  const pRoom = UNITS_GetRoom113c(m, pUnit)
  if (pRoom === 0) return 0
  if ((m.u8((pSkillsTxt + 0x06) >>> 0) & 0x20) === 0) {
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) return 0
  }

  const effLevel = SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1) | 0
  const srvDo2e = sx16(m.u16((pSkillsTxt + 0x2e) >>> 0))
  const wDoFuncIdx = srvDo2e !== 0 ? srvDo2e : sx16(m.u16((pSkillsTxt + 0x0a) >>> 0))
  const wSrvMissile = sx16(m.u16((pSkillsTxt + 0x46) >>> 0))
  if (wDoFuncIdx <= 0 && wSrvMissile >= 0 && MISSILES_GetTxtRecordFast113c(m, wSrvMissile) !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
    const pMis =
      SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
        m,
        pGame >>> 0,
        wSrvMissile,
        pUnit >>> 0,
        nSkillId,
        effLevel,
        0,
        0,
        0,
        0,
        0,
      ) >>> 0
    if (pMis !== 0) {
      MONUMOD_DispatchOnKillEvent5_113c(m, pMis, pUnit, pGame)
    }
  }

  const rc = SKILLS_DoUsedSkillAction113c(m, pUnit, pGame, (doIdx, skId, effLvl) => {
    if (doIdx === 6) {
      return SKILLS_SrvDo_ApplyRadiusAuraStatList_6FC6C2A0_113c(m, pGame, pUnit, skId, effLvl)
    }
    if (doIdx === 22) {
      return SKILLS_SrvDo_NovaRing113c(m, pGame, pUnit, skId, effLvl, hooks)
    }
    if (doIdx === 24) {
      const r = SKILLS_SrvDo_FireWallPerpendicularControllers_6FC637D0_113c(m, pGame, pUnit, skId, effLvl)
      if (r !== 0) MONUMOD_DispatchOnKillEvent5_113c(m, pUnit, pUnit, pGame)
      return r
    }
    if (doIdx === 26) {
      const r = SKILLS_SrvDo043_SpawnSrvMissileWithRange_6FC63720_113c(m, pGame, pUnit, skId, effLvl)
      if (r !== 0) MONUMOD_DispatchOnKillEvent5_113c(m, pUnit, pUnit, pGame)
      return r
    }
    if (doIdx === 68) {
      const r = SKILLS_SrvDo068_BasicShoutK3_113c(m, pGame, pUnit, skId, effLvl, hooks)
      if (r !== 0) MONUMOD_DispatchOnKillEvent5_113c(m, pUnit, pUnit, pGame)
      return r
    }
    if (doIdx === 110) {
      const r = SKILLS_SrvDo120_LaunchSkillOrWeaponMissile_6FCD49F0_113c(m, pGame, pUnit, skId, effLvl)
      if (r !== 0) MONUMOD_DispatchOnKillEvent5_113c(m, pUnit, pUnit, pGame)
      return r
    }
    if (doIdx === 16 || doIdx === 30 || doIdx === 31 || doIdx === 56) {
      return dispatchSummonOrCurseDoFuncK3_113c(m, pGame, pUnit, doIdx, skId, effLvl)
    }
    return 1
  })

  if (rc !== 0) {
    // 0x6FCC1C8F..0x6FCC1CA3: `decquant` (`Skills.txt.dwFlags[0] & 0x01`) -> `0x6FCC1790`
    if ((m.u8((pSkillsTxt + 0x04) >>> 0) & 0x01) !== 0) {
      SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c(m, pUnit, pGame)
    }

    // 0x6FCC1CCF..0x6FCC1CEE: `STATE_SKILLDELAY (121)` via canonical `0x6FCBFF70`
    const delayCalc = m.u32((pSkillsTxt + 0x190) >>> 0)
    const delay = SKILLS_EvalCalcByOffset113c(m, pUnit, delayCalc, nSkillId, effLevel) | 0
    if (
      delay > 0 &&
      (m.u32(pUnit >>> 0) | 0) === 0 &&
      (m.u8((pSkillsTxt + 0x10) >>> 0) !== 0x12 || (m.u32((pUnit + 0x38) >>> 0) & 0xffffff00) === 0)
    ) {
      const expireFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + delay) >>> 0
      for (let ev = m.u32((pUnit + 0xdc) >>> 0) >>> 0; ev !== 0; ) {
        const nextEv = m.u32((ev + 0x24) >>> 0) >>> 0
        if (m.u8(ev) === 0x0c && (m.u32((ev + 0x10) >>> 0) >>> 0) === expireFrame) {
          EVENT_FreeNode113c(m, pGame, ev)
          break
        }
        ev = nextEv
      }
      SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c(m, delay, pUnit, pGame)
    }
  }

  return rc
}

/**
 * `@va D2Game:0x6FC99170`: player mode-step handler for `PLRMODE_CAST (10)` and non-melee
 * `PLRMODE_SEQUENCE (18)` skills (`Chain Lightning` `#53`).
 */
export function PLAYER_StepSkillKeyframeK3_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  arg14: number,
  arg18: number,
  hooks: K2GapMeleeDotHooks113c,
): void {
  if (pPlayer === 0 || m.u32((pPlayer + 0x2c) >>> 0) === 0) return
  if (m.u32((pPlayer + 0x30) >>> 0) !== 0) {
    UNITS_SetSeqFrameFromLowByte113c(m, pPlayer, arg18 | 0)
  }
  PLAYER_StartModeDispatch113c(m, pGame, pPlayer, arg14, arg18, '1HS', (mem, pg, plr) =>
    SKILLS_DoUsedSkillActionK3_113c(mem, plr, pg, hooks),
  )
}

/**
 * Returns `true` when `pPlayer` in `PLRMODE_SEQUENCE (18)` is executing a spell/non-melee skill
 * (`skillId > 0` and `wSrvDoFunc !== 1`).
 */
export function PLAYER_IsNonMeleeSequenceSkillK3_113c(m: Memory113c, pPlayer: number): boolean {
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pPlayer) >>> 0
  if (pSkill === 0) return false
  const skillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0) | 0
  if (skillId <= 0) return false
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId)
  if (pSkillsTxt === 0) return false
  const wSrvDo = sx16(m.u16((pSkillsTxt + 0x2e) >>> 0))
  return wSrvDo !== 1
}

/**
 * Builds the `[K3]` `K2GapMeleeDotHooks113c` dispatch table routing missile `SrvDo` / `SrvHit` / `SrvDmg`
 * directly to canonical manifest-bound `D2Game` functions (`0x6FC61980`, `0x6FC61850`, `0x6FC60CA0`,
 * `0x6FC60BD0`, `0x6FC5B990`, `0x6FC5D020`, `0x6FC5EA60`, `0x6FC5C850`, `0x6FC59CE0`, `0x6FC59670`,
 * `0x6FC59600`).
 */
export function MISSILE_BuildK3Hooks113c(
  onKillUnit: (m: Memory113c, pGame: number, pDefender: number, pAttacker: number) => void,
): K2GapMeleeDotHooks113c {
  const radialCombatHooks: SUnitDmgHooks113c = {
    suppressDirectS2c: true,
    onKillUnit(m, pGame, pDefender, pAttacker) {
      SUNITDMG_CheckMonTypeFlag113c(m, pDefender, 0x08)
      SUNITDMG_ClampManaBurnByMonsterSkill113c(m, pAttacker, 0)
      onKillUnit(m, pGame, pDefender, pAttacker)
    },
    onMonsterStartMode(m, pGame, pDefender, mode) {
      if (mode === 3) {
        const savedSp = k3SorcScratchSp
        const pModeScratch = savedSp
        k3SorcScratchSp = (savedSp + 0x24) >>> 0
        try {
          m.fill(pModeScratch, 0x24, 0)
          m.setU32(pModeScratch, 3)
          m.setU32((pModeScratch + 4) >>> 0, pDefender >>> 0)
          MONSTER_StartGetHitMode113c(m, pGame, pModeScratch)
        } finally {
          k3SorcScratchSp = savedSp
        }
      }
    },
  }

  const hooks: K2GapMeleeDotHooks113c = {
    srvDoMissile(m, wSrvDoIdx, _fnVa, pGame, pMissile) {
      if (wSrvDoIdx === 1) {
        return MISSILE_SrvDo01_FastcallThunk113c(m, pGame, pMissile, hooks)
      }
      if (wSrvDoIdx === 5) {
        return MISSILE_SrvDo_CollisionPatternAndAnimFrame_6FC61980_113c(m, pGame, pMissile, hooks)
      }
      if (wSrvDoIdx === 6) {
        return MISSILE_SrvDo_TrailVerifiedOwnerSubMissile_6FC61850_113c(m, pGame, pMissile, hooks)
      }
      if (wSrvDoIdx === 15) {
        return MISSILE_SrvDo_RadialRingSubMissile_6FC60CA0_113c(m, pGame, pMissile, hooks)
      }
      if (wSrvDoIdx === 16) {
        return MISSILE_SrvDo_SpiralPath_6FC60BD0_113c(m, pGame, pMissile, hooks)
      }
      return 1
    },
    srvHitMissile(m, wSrvHitIdx, _fnVa, pGame, pMissile, pTarget) {
      if (wSrvHitIdx === 1) {
        return MISSILE_SrvHit_RadialETypeDamageByCalc1_6FC5B990_113c(
          m,
          pGame,
          pMissile,
          pTarget,
          radialCombatHooks,
        )
      }
      if (wSrvHitIdx === 12) {
        return MISSILES_SrvHit_ChainBounceProjectile_6FC5D020_113c(m, pGame, pMissile, pTarget)
      }
      if (wSrvHitIdx === 18) {
        return MISSMODE_SrvHit18_ShoutBattleOrdersCommandK3_113c(m, pGame, pMissile, pTarget)
      }
      if (wSrvHitIdx === 29) {
        return MISSILES_SrvDmg12B_Nova64RingOnExpire_6FC5C850_113c(
          m,
          pGame,
          pMissile,
          pTarget,
          hooks,
        )
      }
      return MISSILE_DefaultSrvHitFlagsK3_113c(m, pMissile)
    },
    srvDmgMissile(m, wSrvDmgIdx, _fnVa, pGame, pMissile, pTarget, pDamage) {
      if (wSrvDmgIdx === 1) {
        MISSILES_ConvertPhysToElemDamageByCalc_6FC59CE0_113c(m, pGame, pMissile, pTarget, pDamage)
      } else if (wSrvDmgIdx === 3) {
        SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c(m, 0, pGame, 1)
        SUNITDMG_RollDodgeAvoidEvadeBlock113c(m, 0, pTarget, 0)
        MONSTER_SetLastHitModeField54_113c(m, pTarget, 3)
        MISSILES_SrvHit_RollKnockbackResult_6FC59670_113c(m, pGame, pMissile, pTarget, pDamage)
      } else if (wSrvDmgIdx === 7) {
        MISSMODE_SrvDmg07_WarcryShockWaveK3_113c(m, pGame, pMissile, pDamage)
      }
    },
    onStatRemoveProc(m, fnVa, pUnit, nState, pStatList) {
      if (fnVa === 0x6fcb8450) {
        STATES_RemoveMorphStateAndClampVitals_6FCB8450_113c(m, pUnit, nState, pStatList)
      } else if (fnVa === 0x6fcfb4c0) {
        SUNITDMG_OnFreezeStateExpiredCallback_6FCFB4C0_113c(m, pUnit, nState, pStatList)
      }
    },
    killUnit(m, pGame, pDefender, pAttacker) {
      SUNITDMG_CheckMonTypeFlag113c(m, pDefender, 0x08)
      SUNITDMG_ClampManaBurnByMonsterSkill113c(m, pAttacker, 0)
      onKillUnit(m, pGame, pDefender, pAttacker)
    },
  }
  return hooks
}
