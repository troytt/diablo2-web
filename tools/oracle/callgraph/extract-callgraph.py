#!/usr/bin/env python3
"""Deterministic static call-graph extractor for Diablo II v1.13c server kernel.

Performs x86 CFG-aware basic-block reachability and switch jump-table recovery
across D2Game.dll (0x6FC20000) and D2Common.dll (0x6FD50000), verifies complete
coverage of .rdata/.data code-pointer relocations against dispatch-tables-113c.json,
prunes non-kernel host/CRT/Realm infrastructure, computes Tarjan SCCs and
topological layers (Level 0 = leaf SCCs), and binds porting status strictly
1-to-1 against verified implementations in src/d2kern-113c/.
"""
import bisect
import json
import os
import re
import struct
import sys

try:
    import capstone
    import pefile
except ImportError:
    _venv_py = os.path.expanduser("~/.local/opt/d2oracle/venv/bin/python3")
    if os.path.exists(_venv_py) and os.path.abspath(sys.executable) != os.path.abspath(_venv_py):
        os.execv(_venv_py, [_venv_py] + sys.argv)
    raise

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
D2_DATA_DIR = os.environ.get("D2_DATA_DIR") or os.path.expanduser("~/d2-data")

# Non-CRT functions outside the 4,810-function K0 room-tick/packet server closure:
# 721 D2Game + 880 D2Common = 1,601 total functions, seeded by 350 exported entry points
# outside the 11-root server closure (349 D2Common.dll client/UI/table-compile exports not
# imported by D2Game.dll + 1 D2Game.#10040 0x6FC4E460 outer main-loop caller of #10008 0x6FC4E050)
# plus 1,251 internal helpers reachable only from those client/init/debug entry points.
OUTSIDE_CLOSURE_DESCRIPTION = (
    "Outside K0 room-tick/packet closure (350 unimported client/outer-loop exports: "
    "349 D2Common + D2Game.#10040 0x6FC4E460, plus init/shutdown, arena/client-notify/debug, and unreferenced helpers)"
)

# Authoritative 1-to-1 closure VA bindings in src/d2kern-113c/.
# Every entry is verified at extraction time against:
#   1. Exact closure function-start VA in D2Game.dll / D2Common.dll (never mid-function).
#   2. Existing kernFile under src/d2kern-113c/ containing both the exact hex VA and tsSymbol.
#   3. Globally unique symbol name across all mapped kernel functions.
#   4. Strict V8 execution provenance: status == "diff-verified" ONLY when directly executed
#      against real D2Game.dll / D2Common.dll outputs/snapshots/frames in tests/oracle/*.test.ts;
#      functions implemented in src/d2kern-113c/ without real-DLL differential execution are "ported".
KERN_BINDINGS_113C = [
    # --- src/d2kern-113c/prng.ts (2 diff-verified) ---
    {
        "module": "D2Game",
        "va": 0x6FC21180,
        "name": "SEED_RollLimitedRandomNumber",
        "kernFile": "src/d2kern-113c/prng.ts",
        "tsSymbol": "seedRoll",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vector-format.test.ts (10,000 prng-10k.d2tv real-DLL vectors); tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD510B0,
        "name": "SEED_RollRandomNumber",
        "kernFile": "src/d2kern-113c/prng.ts",
        "tsSymbol": "seedRoll",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vector-format.test.ts (10,000 prng-10k.d2tv real-DLL vectors); tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    # --- src/d2kern-113c/common/int-math.ts (2 diff-verified) ---
    {
        "module": "D2Common",
        "va": 0x6FD511E0,
        "name": "COMMON_MulDiv",
        "kernFile": "src/d2kern-113c/common/int-math.ts",
        "tsSymbol": "mulDiv113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (2,500 D2Common 0x6FD511E0 tuples); tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FC214D0,
        "name": "GAME_MulDiv",
        "kernFile": "src/d2kern-113c/common/int-math.ts",
        "tsSymbol": "mulDiv113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (2,500 D2Game 0x6FC214D0 tuples); tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    # --- src/d2kern-113c/common/statlist.ts (26 diff-verified, 2 ported) ---
    {
        "module": "D2Common",
        "va": 0x6FD882B0,
        "name": "STATLIST_FindStatIndex",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_FindStatIndex113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/route2-replay-setevent.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD88270,
        "name": "STATLIST_FindInsertPos",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_FindInsertPos113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/route2-replay-setevent.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD88640,
        "name": "STATLIST_InsertStatSlot",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "insertStatSlot",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/route2-replay-setevent.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD881A0,
        "name": "STATLIST_RemoveStatSlot",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "removeStatSlot",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD889E0,
        "name": "STATLIST_AddFullStatDelta",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "addFullStatDelta",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/route2-replay-setevent.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD88100,
        "name": "STATLIST_AllocStatList",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_AllocList113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (1,500 MULTILIST_STAT_CALL records)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD8AF00,
        "name": "STATLIST_AllocStatListEx",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_CreateEx113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (SNAP_CALL + MULTILIST_STAT_CALL + STATES_SEQ_CALL)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD87470,
        "name": "ENVIRONMENT_GetTimeOfDayAndAngle",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "ENVIRONMENT_GetTimeOfDayAndAngle113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (MULTILIST_STAT_CALL op 6/7 by-time stat evaluation)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD96330,
        "name": "ITEMS_CalcByTimeStat",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "ITEMS_CalcByTimeStat113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (MULTILIST_STAT_CALL op 6/7 by-time stat evaluation)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD88CD0,
        "name": "STATLIST_SumDirectAndSubLists",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_SumDirectAndSubLists113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/route2-replay-setevent.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD89530,
        "name": "EvalStatWithOps",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "EvalStatWithOps113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (op 1,2,4,5,6,7,8,9,11,13); tests/oracle/route2-replay-setevent.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD89CE0,
        "name": "STATLIST_RecomputeExStat",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_RecomputeExStat113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/route2-replay-setevent.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD89F70,
        "name": "STATLIST_PropagateDelta",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_PropagateDelta113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/route2-replay-setevent.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD8A280,
        "name": "STATLIST_SetStat",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_SetStat113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/route2-replay-setevent.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD8A7B0,
        "name": "STATLIST_SetStatIfListIsValid",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_SetStat113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (15,609 direct sub-list #10188 calls in MULTILIST_STAT_CALL)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD8A740,
        "name": "STATLIST_SetUnitStat",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_SetUnitStat113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/route2-replay-setevent.test.ts (80 live fnrec snapshots); tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD88A80,
        "name": "STATLIST_GetTotalStatWithMin",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_GetUnitStat113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD88B70,
        "name": "STATLIST_GetUnitStat",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_GetUnitStat113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD88B00,
        "name": "STATLIST_GetBaseStatWithMin",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_GetUnitBaseStat113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/route2-replay-setevent.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD88C20,
        "name": "STATLIST_GetUnitBaseStat",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_GetUnitBaseStat113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/route2-replay-setevent.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD8A7D0,
        "name": "STATLIST_MergeStatLists",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_MergeStatLists113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (1,500 MULTILIST_STAT_CALL records)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD8A5F0,
        "name": "STATLIST_UnlinkSubList",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_UnlinkSubList113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (2,140 sub-list unlinks in MULTILIST_STAT_CALL)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD8A3B0,
        "name": "STATLIST_UnlinkSubListInternal",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_RemoveSubList113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (2,140 sub-list unlinks in MULTILIST_STAT_CALL)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD83CD0,
        "name": "STATES_CheckState",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATES_CheckState113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/route2-replay-setevent.test.ts; tests/oracle/ab-eventwheel.test.ts; tests/oracle/vector-format.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD83C20,
        "name": "STATES_CheckStateMaskOnUnit",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATES_CheckStateMaskOnUnit113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (2,000 STATES_SEQ_CALL mask & disguise state checks)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD88730,
        "name": "STATES_ToggleState",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATES_ToggleState113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (2,000 STATES_SEQ_CALL sequences); tests/oracle/route2-replay-setevent.test.ts (39 live fnrec snapshots)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD84510,
        "name": "STATES_ToggleGfxStateFlag",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATES_ToggleGfxStateFlag113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (2,000 STATES_SEQ_CALL + 500 SUNIT_UNITROOM_CALL records)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD84450,
        "name": "STATES_ClearGfxStateFlag",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATES_ClearGfxStateFlag113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (2,000 STATES_SEQ_CALL records)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD88160,
        "name": "STATLIST_FindModStatInsertPos",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_FindModStatInsertPos113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (3,600 SNAP_CALL pModStat records)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD88550,
        "name": "STATLIST_RecordModStat",
        "kernFile": "src/d2kern-113c/common/statlist.ts",
        "tsSymbol": "STATLIST_RecordModStat113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (3,600 SNAP_CALL pModStat records)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD8A330,
        "name": "STATLIST_AddStat",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "STATLIST_AddStatMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD8A710,
        "name": "STATLIST_AddUnitStat",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "STATLIST_AddUnitStatMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD87F80,
        "name": "STATLIST_FindSubListByStateAndFlags",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "STATLIST_FindSubListByStateAndFlags113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vectors/fn-emitter-selftest.test.ts (18 real-DLL vectors via fn-emitter.c)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD88520,
        "name": "STATLIST_GetStatListFromUnitAndState",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "STATLIST_GetStatListFromUnitAndStateMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD8AE60,
        "name": "STATLIST_ExpireStateListsOnModeChange",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "STATLIST_ExpireStateListsOnModeChangeMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson)",
    },
    # --- src/d2kern-113c/common/unit.ts (9 diff-verified) ---
    {
        "module": "D2Common",
        "va": 0x6FD7F370,
        "name": "UNIT_Alloc",
        "kernFile": "src/d2kern-113c/common/unit.ts",
        "tsSymbol": "UNIT_Alloc113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (10,600 stateful 0xF4 D2UnitStrc records)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD51050,
        "name": "UNITS_GetX",
        "kernFile": "src/d2kern-113c/common/unit.ts",
        "tsSymbol": "UNITS_GetX113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (500 SUNIT_UNITROOM_CALL records) + tests/oracle/vectors/fn-emitter-selftest.test.ts (19 real-DLL vectors via fn-emitter.c)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD51080,
        "name": "UNITS_GetY",
        "kernFile": "src/d2kern-113c/common/unit.ts",
        "tsSymbol": "UNITS_GetY113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (500 SUNIT_UNITROOM_CALL records)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD891F0,
        "name": "UNIT_GetAlignment",
        "kernFile": "src/d2kern-113c/common/unit.ts",
        "tsSymbol": "UNIT_GetAlignment113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (500 SUNIT_UNITROOM_CALL allied monster alignment records)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD8B650,
        "name": "STATLIST_GetUnitAlignment",
        "kernFile": "src/d2kern-113c/common/unit.ts",
        "tsSymbol": "UNIT_GetAlignment113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (500 SUNIT_UNITROOM_CALL allied monster alignment records)",
    },
    {
        "module": "D2Common",
        "va": 0x6FDB63B0,
        "name": "UNITROOM_ClearUpdateQueue",
        "kernFile": "src/d2kern-113c/common/unit.ts",
        "tsSymbol": "UNITROOM_ClearUpdateQueue113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (STATES_SEQ_CALL + SUNIT_UNITROOM_CALL clear update queue)",
    },
    {
        "module": "D2Common",
        "va": 0x6FDB65C0,
        "name": "UNITROOM_RefreshUnit",
        "kernFile": "src/d2kern-113c/common/unit.ts",
        "tsSymbol": "UNITROOM_RefreshUnit113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (500 SUNIT_UNITROOM_CALL records)",
    },
    {
        "module": "D2Common",
        "va": 0x6FDB6800,
        "name": "UNITROOM_AddUnitToRoom",
        "kernFile": "src/d2kern-113c/common/unit.ts",
        "tsSymbol": "UNITROOM_AddUnitToRoom113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (500 SUNIT_UNITROOM_CALL records)",
    },
    {
        "module": "D2Common",
        "va": 0x6FDB6700,
        "name": "UNITROOM_RemoveUnitFromRoom",
        "kernFile": "src/d2kern-113c/common/unit.ts",
        "tsSymbol": "UNITROOM_RemoveUnitFromRoom113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (500 SUNIT_UNITROOM_CALL records)",
    },
    # --- src/d2kern-113c/game/game-strc.ts (4 diff-verified, 1 ported) ---
    {
        "module": "D2Game",
        "va": 0x6FC4A900,
        "name": "GAME_InitSeed",
        "kernFile": "src/d2kern-113c/game/game-strc.ts",
        "tsSymbol": "GAME_InitSeed113c",
        "status": "ported",
    },
    {
        "module": "D2Game",
        "va": 0x6FCFF9C0,
        "name": "SUNIT_GetNewUnitId",
        "kernFile": "src/d2kern-113c/game/game-strc.ts",
        "tsSymbol": "SUNIT_GetNewUnitId113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (500 SUNIT_UNITROOM_CALL sequential unit ID allocations)",
    },
    {
        "module": "D2Game",
        "va": 0x6FD00310,
        "name": "SUNIT_InsertServerUnit",
        "kernFile": "src/d2kern-113c/game/game-strc.ts",
        "tsSymbol": "SUNIT_InsertServerUnit113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (500 SUNIT_UNITROOM_CALL records)",
    },
    {
        "module": "D2Game",
        "va": 0x6FD003A0,
        "name": "SUNIT_GetServerUnit",
        "kernFile": "src/d2kern-113c/game/game-strc.ts",
        "tsSymbol": "SUNIT_GetServerUnit113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (500 SUNIT_UNITROOM_CALL records)",
    },
    {
        "module": "D2Game",
        "va": 0x6FD002A0,
        "name": "SUNIT_RemoveServerUnit",
        "kernFile": "src/d2kern-113c/game/game-strc.ts",
        "tsSymbol": "SUNIT_RemoveServerUnit113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (500 SUNIT_UNITROOM_CALL records)",
    },
    # --- src/d2kern-113c/game/timer-wheel.ts (13 diff-verified) ---
    {
        "module": "D2Game",
        "va": 0x6FCAE420,
        "name": "EVENT_AllocChunk",
        "kernFile": "src/d2kern-113c/game/timer-wheel.ts",
        "tsSymbol": "EVENT_AllocChunk113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vector-format.test.ts; tests/oracle/ab-eventwheel.test.ts; tests/oracle/kern-10k-diff.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FCAE630,
        "name": "EVENT_InitTimerQueue",
        "kernFile": "src/d2kern-113c/game/timer-wheel.ts",
        "tsSymbol": "EVENT_InitTimerQueue113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vector-format.test.ts; tests/oracle/ab-eventwheel.test.ts; tests/oracle/kern-10k-diff.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FCAE540,
        "name": "EVENT_AllocNode",
        "kernFile": "src/d2kern-113c/game/timer-wheel.ts",
        "tsSymbol": "EVENT_AllocNodeWithGrowth113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vector-format.test.ts; tests/oracle/ab-eventwheel.test.ts; tests/oracle/route2-replay-setevent.test.ts; tests/oracle/kern-10k-diff.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FCAE680,
        "name": "EVENT_CreateNode",
        "kernFile": "src/d2kern-113c/game/timer-wheel.ts",
        "tsSymbol": "EVENT_CreateNodeWithGrowth113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vector-format.test.ts; tests/oracle/ab-eventwheel.test.ts; tests/oracle/route2-replay-setevent.test.ts; tests/oracle/kern-10k-diff.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FCAE6F0,
        "name": "EVENT_FreeNode",
        "kernFile": "src/d2kern-113c/game/timer-wheel.ts",
        "tsSymbol": "EVENT_FreeNode113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vector-format.test.ts; tests/oracle/ab-eventwheel.test.ts; tests/oracle/route2-replay-setevent.test.ts; tests/oracle/kern-10k-diff.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FD009D0,
        "name": "SUNIT_GetLastAttacker",
        "kernFile": "src/d2kern-113c/game/timer-wheel.ts",
        "tsSymbol": "SUNIT_GetLastAttacker113c",
        "status": "ported",
        "diffEvidence": "EVENT_TIMER_SEQ_CALL exercises state 0x5C death attacker lookup; full pet/owner redirect chain pending",
    },
    {
        "module": "D2Game",
        "va": 0x6FD02240,
        "name": "MONSTER_SetUninterruptableAndClearAiEvents",
        "kernFile": "src/d2kern-113c/game/timer-wheel.ts",
        "tsSymbol": "MONSTER_RefreshAiEvent113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts (EVENT_TIMER_SEQ_CALL state 0x36 & 0x5C monster AI refresh/death)",
    },
    {
        "module": "D2Game",
        "va": 0x6FCAE810,
        "name": "EVENT_SetPersistentEvent",
        "kernFile": "src/d2kern-113c/game/timer-wheel.ts",
        "tsSymbol": "EVENT_SetPersistentEventFull113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vector-format.test.ts; tests/oracle/ab-eventwheel.test.ts; tests/oracle/kern-10k-diff.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FCAEA80,
        "name": "EVENT_SetEvent",
        "kernFile": "src/d2kern-113c/game/timer-wheel.ts",
        "tsSymbol": "EVENT_SetEventFull113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/route2-replay-setevent.test.ts (94 fnrec snapshots); tests/oracle/vector-format.test.ts; tests/oracle/ab-eventwheel.test.ts; tests/oracle/kern-10k-diff.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FCAE880,
        "name": "EVENT_RemoveUnitEvents",
        "kernFile": "src/d2kern-113c/game/timer-wheel.ts",
        "tsSymbol": "EVENT_RemoveUnitEvents113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vector-format.test.ts; tests/oracle/ab-eventwheel.test.ts; tests/oracle/kern-10k-diff.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FCAE8C0,
        "name": "EVENT_DeleteEventByType",
        "kernFile": "src/d2kern-113c/game/timer-wheel.ts",
        "tsSymbol": "EVENT_DeleteEventByType113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vector-format.test.ts; tests/oracle/ab-eventwheel.test.ts; tests/oracle/kern-10k-diff.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FCAE900,
        "name": "EVENT_DeleteEventByArg14",
        "kernFile": "src/d2kern-113c/game/timer-wheel.ts",
        "tsSymbol": "EVENT_DeleteEventByArg14_113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-10k-diff.test.ts; tests/oracle/route2-replay-setevent.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FCAE490,
        "name": "EVENT_GetNextEventFrame",
        "kernFile": "src/d2kern-113c/game/timer-wheel.ts",
        "tsSymbol": "EVENT_GetNextEventFrame113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/ab-eventwheel.test.ts (57,344 queries); tests/oracle/kern-10k-diff.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FCAF070,
        "name": "EVENT_UpdateTimers",
        "kernFile": "src/d2kern-113c/game/timer-wheel.ts",
        "tsSymbol": "EVENT_UpdateTimers113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vector-format.test.ts (256 scenarios / 45,101 events); tests/oracle/ab-eventwheel.test.ts; tests/oracle/kern-10k-diff.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    # --- src/d2kern-113c/game/monster-events.ts (10 diff-verified, 3 ported) ---
    {
        "module": "D2Game",
        "va": 0x6FC949A0,
        "name": "MONSTER_GetModeEntry",
        "kernFile": "src/d2kern-113c/game/monster-events.ts",
        "tsSymbol": "MONSTER_GetModeEntry113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC94F20,
        "name": "MONSTER_IsContinuousMode",
        "kernFile": "src/d2kern-113c/game/monster-events.ts",
        "tsSymbol": "MONSTER_IsContinuousMode113c",
        "status": "ported",
        "diffEvidence": "F786..F825 real-DLL replay exercises mode 0/2/3 entry; full mode 7/9/15 & wMoveFlags branches unit-tested in tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FCFFA90,
        "name": "SUNIT_IsDeadOrDying",
        "kernFile": "src/d2kern-113c/game/monster-events.ts",
        "tsSymbol": "SUNIT_IsDeadOrDying113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825)",
    },
    {
        "module": "D2Game",
        "va": 0x6FD00750,
        "name": "MONSTER_ClearModeEvents",
        "kernFile": "src/d2kern-113c/game/monster-events.ts",
        "tsSymbol": "MONSTER_ClearModeEvents113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/route2-replay-setevent.test.ts (75 live fnrec snapshots); tests/oracle/kern-10k-diff.test.ts; tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FC95320,
        "name": "MONSTER_ClearStepEvents",
        "kernFile": "src/d2kern-113c/game/monster-events.ts",
        "tsSymbol": "MONSTER_ClearStepEvents113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825)",
    },
    {
        "module": "D2Game",
        "va": 0x6FD00B40,
        "name": "MONSTER_RegisterContinuousModeEvent",
        "kernFile": "src/d2kern-113c/game/monster-events.ts",
        "tsSymbol": "MONSTER_RegisterContinuousModeEvent113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC952E0,
        "name": "MONSTER_Event0_ModeStep",
        "kernFile": "src/d2kern-113c/game/monster-events.ts",
        "tsSymbol": "MONSTER_Event0_ModeStep113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC952A0,
        "name": "MONSTER_Event1_ModeEnd",
        "kernFile": "src/d2kern-113c/game/monster-events.ts",
        "tsSymbol": "MONSTER_Event1_ModeEnd113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F821 #12 DT->DD)",
    },
    {
        "module": "D2Game",
        "va": 0x6FCBD3B0,
        "name": "AI_RunMonsterAI",
        "kernFile": "src/d2kern-113c/game/monster-events.ts",
        "tsSymbol": "AI_RunMonsterAI113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC969A0,
        "name": "MONSTER_DispatchEvent",
        "kernFile": "src/d2kern-113c/game/monster-events.ts",
        "tsSymbol": "MONSTER_DispatchEvent113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD803E0,
        "name": "SKILLS_SetUsedSkill",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "SKILLS_SetUsedSkillMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD83920,
        "name": "UNITS_ChangeAnimMode",
        "kernFile": "src/d2kern-113c/game/monster-events.ts",
        "tsSymbol": "UNITS_ChangeAnimMode113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825 mode transitions)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC94E60,
        "name": "MONSTER_StartNeutral",
        "kernFile": "src/d2kern-113c/game/monster-events.ts",
        "tsSymbol": "MONSTER_StartNeutral113c",
        "status": "ported",
    },
    {
        "module": "D2Game",
        "va": 0x6FC950F0,
        "name": "MONSTER_NullModeEventFallback",
        "kernFile": "src/d2kern-113c/game/monster-events.ts",
        "tsSymbol": "MONSTER_NullModeEventFallback113c",
        "status": "ported",
    },
    # --- src/d2kern-113c/game/fallen-ai-113c.ts ---
    {
        "module": "D2Game",
        "va": 0x6FCD08F0,
        "name": "UNITS_GetDistanceToCoordinates",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "UNITS_GetDistanceToCoordinates113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD8AFD0,
        "name": "ROOM_RecordMonsterDeath",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "ROOM_RecordMonsterDeath113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F801..F821 dwDeathRing[0]=12)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC40EC0,
        "name": "AIGENERAL_PopAiCommand",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "AIGENERAL_PopAiCommand113c",
        "status": "ported",
        "diffEvidence": "F786..F825 real-DLL replay exercises pCommandHead==0 early return; circular queue pop/free unit-tested in tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FC95260,
        "name": "MONSTER_SavePrevMode",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "MONSTER_SavePrevMode113c",
        "status": "ported",
        "diffEvidence": "F786..F825 transitions all start from prevMode==1; non-neutral prevMode & cur54>=16/13 branches unit-tested in tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FD122C0,
        "name": "AI_Stall",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "AI_Stall113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC95E10,
        "name": "MONSTER_StartMode",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "MONSTER_StartMode113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC94F90,
        "name": "MONSTER_StartMove",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "MONSTER_StartMode113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825)",
    },
    {
        "module": "D2Game",
        "va": 0x6FD12540,
        "name": "AI_ApproachTarget",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "AI_ApproachTarget113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825)",
    },
    {
        "module": "D2Game",
        "va": 0x6FD12D80,
        "name": "AI_FleeFrom",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "AI_FleeFrom113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F801..F825 Fallen ally-death flee)",
    },
    {
        "module": "D2Game",
        "va": 0x6FCA3130,
        "name": "AiFallen",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "AiFallen113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC96BF0,
        "name": "MONSTER_EndToAiOrNeutral",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "MONSTER_EndToAiOrNeutral113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F825 inline WL->AiFallen re-entry)",
    },
    {
        "module": "D2Game",
        "va": 0x6FD01930,
        "name": "MONSTER_StepPath",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "MONSTER_StepPath113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (113 WL continuous steps across F786..F825)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC97010,
        "name": "MONSTER_StepWalk",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "MONSTER_StepWalk113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (113 WL mode-2 steps across F786..F825)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC40D50,
        "name": "AIGENERAL_PromoteNextPackLeader",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "promotePackLeaderOnDeath113c",
        "status": "ported",
    },
    {
        "module": "D2Game",
        "va": 0x6FC96270,
        "name": "MONSTER_StartDeath",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "MONSTER_StartDeath113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F801 #12 -> DT mode 0)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC96040,
        "name": "MONSTER_EndDeath",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "MONSTER_EndDeath113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F821 #12 DT 0 -> DD 12)",
    },
    {
        "module": "D2Game",
        "va": 0x6FCFDE90,
        "name": "SUNITDMG_CheckToHit",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "SUNITDMG_CheckToHit113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/fn-snapshot-runner.test.ts (live fnharness GVA_HIT 0x6FCFDE90); tests/oracle/kern-fallen-f790-f821.test.ts (F801/F813 melee swings)",
    },
    {
        "module": "D2Common",
        "va": 0x6FDC19A0,
        "name": "DATATBLS_GetItemsTxtRecord",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "DATATBLS_GetItemsTxtRecordMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson); tests/oracle/kern-fallen-f790-f821.test.ts (Weapons/Armor/Misc D2ItemsTxt lookup)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD74430,
        "name": "ITEMS_CheckItemTypeId",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "ITEMS_CheckItemTypeIdMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson); tests/oracle/kern-fallen-f790-f821.test.ts (ItemTypes Equiv1/Equiv2 closure checks)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD73EF0,
        "name": "ITEMS_CheckNotBrokenOrUnequipping",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "ITEMS_CheckNotBrokenOrUnequipping113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vectors/fn-emitter-selftest.test.ts (23 real-DLL vectors via fn-emitter.c) + tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD729A0,
        "name": "ITEMS_GetStrBonus",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "ITEMS_GetStrBonusMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson); tests/oracle/kern-fallen-f790-f821.test.ts (D2Common.#10213 weapon StrBonus lookup)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD72970,
        "name": "ITEMS_GetDexBonus",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "ITEMS_GetDexBonusMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson); tests/oracle/kern-fallen-f790-f821.test.ts (D2Common.#10120 weapon DexBonus lookup)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD6E670,
        "name": "INVENTORY_GetItemFromBodyLoc",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "INVENTORY_GetItemFromBodyLocMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson); tests/oracle/kern-fallen-f790-f821.test.ts (D2Common.#11139 pGrids[0].ppItems[0..12] bodyLoc lookup)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD70320,
        "name": "INVENTORY_GetCompositWeapon",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "INVENTORY_GetCompositWeaponMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson); tests/oracle/kern-fallen-f790-f821.test.ts (D2Common.#10061 dwWeaponId composite weapon lookup)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD70700,
        "name": "INVENTORY_GetActiveWeapon",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "INVENTORY_GetActiveWeaponMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson); tests/oracle/kern-fallen-f790-f821.test.ts (D2Common.#10101 active weapon RARM/LARM scan)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD70830,
        "name": "INVENTORY_GetWeaponByHandSlot",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "INVENTORY_GetWeaponByHandSlotMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson); tests/oracle/kern-fallen-f790-f821.test.ts (D2Common.#10062 dual-wield slot 5/6 selection)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD80530,
        "name": "UNITS_CanDualWield",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "UNITS_CanDualWield113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vectors/fn-emitter-selftest.test.ts (36 real-DLL vectors with synthetic sgptDataTables via fn-emitter.c) + tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD803A0,
        "name": "SKILLS_GetUsedSkill",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "SKILLS_GetUsedSkillMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson); tests/oracle/kern-fallen-f790-f821.test.ts (D2Common.#10511 pSkills->pUsedSkill lookup)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC572C0,
        "name": "PLAYER_GetEquippedWeapon",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "PLAYER_GetEquippedWeapon113c",
        "status": "ported",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (0x6FC572C0 -> #10101 / #10747 / #10511 / #10062)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD9F640,
        "name": "SKILLS_GetWeaponMasteryBonus",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "SKILLS_GetWeaponMasteryBonusMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson); tests/oracle/kern-fallen-f790-f821.test.ts (D2Common.#10804 stats 342..347 weapon-type mastery)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD74C30,
        "name": "ITEMS_CheckIfThrowItem",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "ITEMS_CheckIfThrowItemMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson); tests/oracle/kern-fallen-f790-f821.test.ts (D2Common.#10711 ItemTypes.txt Throws check)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD6E1B0,
        "name": "INVENTORY_GetOrInitGrid",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "INVENTORY_GetOrInitGridMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson); tests/oracle/kern-fallen-f790-f821.test.ts (grid 0 lazy alloc + 13x1 validation)",
    },
    {
        "module": "D2Common",
        "va": 0x6FD9DE40,
        "name": "SKILLS_GetFlags",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "SKILLS_GetFlags113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/vectors/fn-emitter-selftest.test.ts (14 real-DLL vectors via fn-emitter.c) + tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Common",
        "va": 0x6FD8C390,
        "name": "DUNGEON_CheckRoomIsTown",
        "kernFile": "src/d2kern-113c/common/k0-d2common-memports.ts",
        "tsSymbol": "DUNGEON_CheckRoomIsTownMemPort113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/k1/laneD-ported29.test.ts (real-DLL vectors via k1r13-laneD-ported29-emitter.c -> k1r13-i14d-1.ndjson); tests/oracle/kern-fallen-f790-f821.test.ts (D2Common.#10057 pRoom->pRoomEx->pLevel->dwLevelNo town check)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC97BB0,
        "name": "PLAYER_DrainRunStamina",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "PLAYER_DrainRunStamina113c",
        "status": "ported",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F786..F794 Barbarian run drain + torso armor speed & stat 154)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC97CB0,
        "name": "PLAYER_UpdateHpRegen",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "PLAYER_UpdateHpRegen113c",
        "status": "ported",
        "diffEvidence": "F786..F825 real-DLL replay exercises full-HP early-return path; full hpregen formula unit-tested in tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FC97950,
        "name": "PLAYER_UpdateManaRegen",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "PLAYER_UpdateManaRegen113c",
        "status": "ported",
        "diffEvidence": "F786..F825 real-DLL replay exercises full-mana early-return path; full manarecovery formula unit-tested in tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FC97A50,
        "name": "PLAYER_UpdateStaminaRegen",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "PLAYER_UpdateStaminaRegen113c",
        "status": "ported",
        "diffEvidence": "F786..F825 real-DLL replay exercises running early-return / NU tick; mode 0/1/2/5/9/12/13/16/17 switch & staminarecoverybonus formula unit-tested in tests/oracle/kern-fallen-f790-f821.test.ts",
    },
    {
        "module": "D2Game",
        "va": 0x6FC99B10,
        "name": "PLAYER_Event3_RegenTick",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "PLAYER_Event3_RegenTick113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (40 Event-3 frames F786..F825)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC99A60,
        "name": "PLAYER_Event11_PeriodicTick",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "PLAYER_Event11_PeriodicTick113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F796, F826 +30 periodic ticks)",
    },
    {
        "module": "D2Game",
        "va": 0x6FCFF7B0,
        "name": "SUNIT_ScheduleModeAnimEvents",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "SUNIT_ScheduleModeAnimEvents113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F795/F807/F818 player A1 clip scheduling)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC987C0,
        "name": "PLAYER_StartModeAttackWithTarget",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "applyPlayerPacket113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (F795/F807/F816 C2S 0x03 RunToUnit -> A1 attack)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC4E050,
        "name": "GAME_UpdateGameFrame",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "stepFallenSliceFrame113c",
        "status": "diff-verified",
        "diffEvidence": "tests/oracle/kern-fallen-f790-f821.test.ts (40-frame F786..F825 D2Game.#10008 step loop)",
    },
    {
        "module": "D2Game",
        "va": 0x6FC40F30,
        "name": "AIGENERAL_AllocAiCommand",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "AIGENERAL_AllocAiCommand113c",
        "status": "ported",
    },
    {
        "module": "D2Game",
        "va": 0x6FC41290,
        "name": "AIGENERAL_InitAiCommand",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "AIGENERAL_CopyAiCommandParams113c",
        "status": "ported",
    },
    {
        "module": "D2Game",
        "va": 0x6FD11B10,
        "name": "AI_IdleWander",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "AI_IdleWander113c",
        "status": "ported",
    },
    {
        "module": "D2Game",
        "va": 0x6FCA38B0,
        "name": "AiZombie",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "AiZombie113c",
        "status": "ported",
    },
    {
        "module": "D2Game",
        "va": 0x6FC96FE0,
        "name": "MONSTER_StepRun",
        "kernFile": "src/d2kern-113c/game/fallen-ai-113c.ts",
        "tsSymbol": "MONSTER_StepRun113c",
        "status": "ported",
    },
]

# K1 per-batch binding files. KERN_BINDINGS_113C above is the FROZEN K0 list (its totals are pinned as
# K0_BASE in tests/oracle/callgraph.test.ts); every K1 binding lives in exactly one
# tools/oracle/callgraph/bindings/<batch>.json file so parallel batches never edit a shared Python list.
# Format and workflow: tools/oracle/callgraph/bindings/README.md.
BINDINGS_DIR = os.path.join(SCRIPT_DIR, "bindings")
_BINDING_FILE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*\.json$")
_BINDING_KEYS_REQ = {"module", "va", "name", "kernFile", "tsSymbol", "status"}
_BINDING_KEYS_OPT = {"diffEvidence"}
_VA_HEX_RE = re.compile(r"^0x[0-9A-Fa-f]{8}$")
K0_BINDINGS_SRC = "KERN_BINDINGS_113C"


def load_batch_bindings(bindings_dir: str = BINDINGS_DIR) -> list:
    """Loads bindings/*.json deterministically (files sorted by name, entries in file order).

    Each file is a non-empty JSON array of objects with exactly the keys
    module, va ("0x" + 8 hex digits), name, kernFile, tsSymbol, status [, diffEvidence],
    strictly ascending by va. Entries are returned with an int va and a "_src" tag and are then
    validated by build_verified_kern_registry exactly like KERN_BINDINGS_113C entries.
    """
    out = []
    if not os.path.isdir(bindings_dir):
        return out
    for fname in sorted(os.listdir(bindings_dir)):
        if fname == "README.md":
            continue
        if not _BINDING_FILE_RE.match(fname):
            raise ValueError(f"Unexpected file in bindings/: {fname}")
        src = f"bindings/{fname}"
        with open(os.path.join(bindings_dir, fname), "r", encoding="utf-8") as f:
            arr = json.load(f)
        if not isinstance(arr, list) or not arr:
            raise ValueError(f"{src}: must be a non-empty JSON array")
        prev_va = -1
        for i, e in enumerate(arr):
            if not isinstance(e, dict):
                raise ValueError(f"{src}[{i}]: entry must be a JSON object")
            keys = set(e)
            if not _BINDING_KEYS_REQ <= keys or keys - _BINDING_KEYS_REQ - _BINDING_KEYS_OPT:
                raise ValueError(f"{src}[{i}]: bad keys {sorted(keys)}")
            for k in keys:
                if not isinstance(e[k], str) or not e[k].strip():
                    raise ValueError(f"{src}[{i}]: '{k}' must be a non-empty string")
            if e["module"] not in ("D2Common", "D2Game"):
                raise ValueError(f"{src}[{i}]: bad module '{e['module']}'")
            if not _VA_HEX_RE.match(e["va"]):
                raise ValueError(f"{src}[{i}]: va must be '0x' + 8 hex digits, got '{e['va']}'")
            va = int(e["va"], 16)
            if va <= prev_va:
                raise ValueError(f"{src}[{i}]: entries must be strictly ascending by va")
            prev_va = va
            item = dict(e)
            item["va"] = va
            item["_src"] = src
            out.append(item)
    return out


def build_verified_kern_registry(starts_set_by_mod: dict, reachable_nodes: set) -> dict:
    """Validates every 1-to-1 src/d2kern-113c/ closure binding against disk & PE starts."""
    registry = {}
    seen_names = set()
    file_cache = {}
    re_oracle_test = re.compile(r"tests/oracle/[A-Za-z0-9_./-]+\.test\.ts")

    all_bindings = [dict(k, _src=K0_BINDINGS_SRC) for k in KERN_BINDINGS_113C] + load_batch_bindings()
    for item in all_bindings:
        mod = item["module"]
        va = item["va"]
        key = (mod, va)
        va_hex = f"0x{va:08X}"
        name = item["name"]
        rel_file = item["kernFile"]
        ts_sym = item["tsSymbol"]
        status = item["status"]
        src = item["_src"]

        if key in registry:
            raise ValueError(f"Duplicate KERN_BINDINGS_113C key {mod}:{va_hex} ({src})")
        if name in seen_names:
            raise ValueError(f"Duplicate symbol name '{name}' in KERN_BINDINGS_113C ({src})")
        seen_names.add(name)

        if va not in starts_set_by_mod[mod]:
            raise ValueError(f"{mod}:{va_hex} ({name}) is NOT a genuine CFG function start! ({src})")
        if key not in reachable_nodes:
            raise ValueError(f"{mod}:{va_hex} ({name}) is outside the reachable K0 closure! ({src})")
        if not rel_file.startswith("src/d2kern-113c/"):
            raise ValueError(f"Invalid kernFile '{rel_file}' for {mod}:{va_hex} ({src})")

        abs_file = os.path.join(REPO_ROOT, rel_file)
        if not os.path.isfile(abs_file):
            raise ValueError(f"Missing kernFile on disk: {rel_file} for {mod}:{va_hex} ({src})")

        if rel_file not in file_cache:
            with open(abs_file, "r", encoding="utf-8") as f:
                file_cache[rel_file] = f.read()
        src_text = file_cache[rel_file]

        if va_hex.lower() not in src_text.lower():
            raise ValueError(f"{rel_file} does not contain exact VA {va_hex} for {name} ({src})")
        if ts_sym not in src_text:
            raise ValueError(f"{rel_file} does not contain tsSymbol '{ts_sym}' for {mod}:{va_hex} ({src})")

        if status not in ("diff-verified", "ported"):
            raise ValueError(f"Invalid status '{status}' for {mod}:{va_hex} ({src})")

        rec = {
            "name": name,
            "status": status,
            "kernFile": rel_file,
            "tsSymbol": ts_sym,
            "tsReference": f"{ts_sym} ({rel_file})",
        }
        ev = item.get("diffEvidence", "").strip()
        if status == "diff-verified":
            test_paths = re_oracle_test.findall(ev)
            if not ev or not test_paths:
                raise ValueError(
                    f"diff-verified {mod}:{va_hex} ({name}) missing tests/oracle/*.test.ts evidence ({src})"
                )
            for tp in test_paths:
                if not os.path.isfile(os.path.join(REPO_ROOT, tp)):
                    raise ValueError(f"Missing oracle test file {tp} referenced by {mod}:{va_hex} ({src})")
            if src != K0_BINDINGS_SRC:
                # K1 JSON bindings only (K0 list is frozen): citation-only evidence is rejected; at least
                # one cited oracle test must itself name the exact VA it diff-verifies.
                cites_va = False
                for tp in test_paths:
                    with open(os.path.join(REPO_ROOT, tp), "r", encoding="utf-8") as f:
                        if va_hex.lower() in f.read().lower():
                            cites_va = True
                            break
                if not cites_va:
                    raise ValueError(
                        f"diff-verified {mod}:{va_hex} ({name}): no cited test file contains '{va_hex}' ({src})"
                    )
            rec["diffEvidence"] = ev
        elif ev:
            for tp in re_oracle_test.findall(ev):
                if not os.path.isfile(os.path.join(REPO_ROOT, tp)):
                    raise ValueError(f"Missing oracle test file {tp} referenced by {mod}:{va_hex} ({src})")
            rec["diffEvidence"] = ev

        registry[key] = rec

    return registry


def parse_legacy_refs_from_function_map(path: str) -> dict:
    """Extracts ONLY legacy non-kernel src/{server,common,client}/ references for unported rows.

    Never sets status to ported or diff-verified, and never zips comma-separated
    names across multi-VA rows.
    """
    legacy_map = {}
    if not os.path.exists(path):
        return legacy_map

    re_tok = re.compile(r"(D2Game|D2Common|D2Client|D2Net|Fog|0x[0-9A-Fa-f]{8})")
    re_range = re.compile(r"0x[0-9A-Fa-f]{8}\s*\.\.\s*0x[0-9A-Fa-f]{8}")

    with open(path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line.startswith("|") or not line.endswith("|"):
                continue
            cells = [c.strip() for c in re.split(r"(?<!\\)\|", line)[1:-1]]
            if len(cells) != 4:
                continue
            orig, name_col, ts_col, _status_col = cells
            if orig in ("Original (VA)", "---") or set(orig) <= {"-"}:
                continue
            if "src/d2kern-113c/" in ts_col:
                continue

            orig_clean = re_range.sub("", orig)
            tokens = re_tok.findall(orig_clean)
            cur_mod = None
            mod_vas = []
            for tok in tokens:
                if tok.lower().startswith("0x"):
                    va_int = int(tok, 16)
                    inferred = cur_mod
                    if inferred is None:
                        if 0x6FC20000 <= va_int < 0x6FD40000:
                            inferred = "D2Game"
                        elif 0x6FD50000 <= va_int < 0x6FE00000:
                            inferred = "D2Common"
                    if inferred in ("D2Game", "D2Common"):
                        mod_vas.append((inferred, va_int))
                else:
                    cur_mod = tok

            if not mod_vas or not ts_col or ts_col == "—":
                continue

            single_name = None
            if len(mod_vas) == 1:
                m_ident = re.match(r"^`([A-Za-z_][A-Za-z0-9_]*_[A-Za-z0-9_]+)`", name_col)
                if m_ident:
                    single_name = m_ident.group(1)

            for mod_name, va_int in mod_vas:
                prev = legacy_map.get((mod_name, va_int), {})
                entry = {"legacyRef": prev.get("legacyRef", ts_col)}
                if single_name and "fallbackName" not in prev:
                    entry["fallbackName"] = single_name
                legacy_map[(mod_name, va_int)] = entry

    return legacy_map


class ModuleAnalyzer:
    """CFG-aware function boundary and switch jump-table analyzer for a PE32 DLL."""

    def __init__(
        self,
        mod_name: str,
        pe: pefile.PE,
        pruned_code_ranges: list,
        pruned_callsite_ranges: list,
        pruned_fn_vas: set,
        cs_detail: capstone.Cs,
        cs_lite: capstone.Cs,
    ):
        self.mod_name = mod_name
        self.pe = pe
        self.base = pe.OPTIONAL_HEADER.ImageBase
        self.text_sec = [s for s in pe.sections if b".text" in s.Name][0]
        self.tstart = self.base + self.text_sec.VirtualAddress
        self.tend = self.tstart + self.text_sec.Misc_VirtualSize
        self.tdata = self.text_sec.get_data()

        self.pruned_code_ranges = pruned_code_ranges
        self.pruned_callsite_ranges = pruned_callsite_ranges
        self.pruned_fn_vas = set(pruned_fn_vas)
        self.cs_detail = cs_detail
        self.cs_lite = cs_lite

        self.iat = {}
        self.thunks = {}
        self.exports_by_ord = {}
        self.text_export_vas = set()
        self.pe_reloc_slots = set()
        self.text_relocs = {}
        self.non_text_code_relocs = {}
        self.data_code_ptrs = set()
        self.jt_data_bytes = set()
        self.jt_site_targets = {}
        self.cb_reloc_at_slot = {}
        self.fn_ptr_tables = {}
        self.vtable_call_targets = {}

        self.pruned_targets_hit = set()
        self.pruned_callsites_skipped = set()

        self._load_pe_tables()
        self._detect_jump_tables_and_callbacks()
        self._init_indirect_dispatch_tables()

    def _init_indirect_dispatch_tables(self) -> None:
        if self.mod_name == "D2Common":
            table_ranges = [
                (0x6FDEB244, 0x6FDEB25C),  # pathRayAndStepDirTable (6 entries)
                (0x6FDE9BE8, 0x6FDE9BF8),  # collisionSpanTables[0..3] (4 entries)
                (0x6FDE9BF8, 0x6FDE9C08),  # collisionSpanTables[4..7] (4 entries)
                (0x6FDE6178, 0x6FDE6184),  # drlgLevelAlgoTable (3 entries)
                (0x6FDE42F0, 0x6FDE4334),  # pathMovementTypeTable (17 entries)
                (0x6FDEB0C8, 0x6FDEB15C),  # itemsModFuncTable (37 entries)
                (0x6FDEA928, 0x6FDEB0C8),  # itemsPropertyAssignTable (244 entries * 8B)
            ]
            for lo, hi in table_ranges:
                targets = sorted(
                    {
                        val
                        for slot, val in self.non_text_code_relocs.items()
                        if lo <= slot < hi and self.tstart <= val < self.tend
                    }
                )
                if targets:
                    self.fn_ptr_tables[lo] = targets
            # D2DrlgSubstContextStrc vtable callback targets initialized in 0x6FD91AD0 / 0x6FD93120
            self.vtable_call_targets = {
                0x6FDD3990: [0x6FD90C20, 0x6FD922A0, 0x6FD922F0, 0x6FD92A70],
                0x6FDD3B30: [0x6FD90DB0, 0x6FD92270, 0x6FD92370],
            }

    def in_pruned_code_range(self, va: int) -> bool:
        for lo, hi, _ in self.pruned_code_ranges:
            if lo <= va < hi:
                return True
        return False

    def pruned_range_category(self, va: int):
        for lo, hi, cat in self.pruned_code_ranges:
            if lo <= va < hi:
                return cat
        return None

    def in_pruned_callsite(self, va: int) -> bool:
        for lo, hi in self.pruned_callsite_ranges:
            if lo <= va < hi:
                return True
        return False

    def is_pruned_fn(self, va: int) -> bool:
        return va in self.pruned_fn_vas or self.in_pruned_code_range(va)

    def _load_pe_tables(self) -> None:
        if hasattr(self.pe, "DIRECTORY_ENTRY_IMPORT"):
            for entry in self.pe.DIRECTORY_ENTRY_IMPORT:
                dll = entry.dll.decode().lower()
                for imp in entry.imports:
                    sym = imp.ordinal if imp.ordinal else (imp.name.decode() if imp.name else "")
                    self.iat[imp.address] = (dll, sym)

        for off in range(0, len(self.tdata) - 6):
            if self.tdata[off : off + 2] == b"\xff\x25":
                tgt = struct.unpack_from("<I", self.tdata, off + 2)[0]
                if tgt in self.iat:
                    self.thunks[self.tstart + off] = self.iat[tgt]

        if hasattr(self.pe, "DIRECTORY_ENTRY_EXPORT"):
            for exp in self.pe.DIRECTORY_ENTRY_EXPORT.symbols:
                va = self.base + exp.address
                if self.tstart <= va < self.tend:
                    self.exports_by_ord[exp.ordinal] = va
                    if not self.in_pruned_code_range(va) and va not in self.thunks:
                        self.text_export_vas.add(va)

        if hasattr(self.pe, "DIRECTORY_ENTRY_BASERELOC"):
            for br in self.pe.DIRECTORY_ENTRY_BASERELOC:
                for r in br.entries:
                    if r.type != 3:
                        continue
                    slot_va = self.base + r.rva
                    self.pe_reloc_slots.add(slot_va)
                    val = self.pe.get_dword_at_rva(r.rva)
                    if self.tstart <= slot_va < self.tend:
                        self.text_relocs[slot_va] = val
                    else:
                        if (
                            self.tstart <= val < self.tend
                            and not self.in_pruned_code_range(val)
                            and val not in self.thunks
                            and (val % 16 == 0)
                        ):
                            self.data_code_ptrs.add(val)
                            self.non_text_code_relocs[slot_va] = val

    def _detect_jump_tables_and_callbacks(self) -> None:
        # 1. Indexed switch jump instructions: FF 24 <SIB(scale=4 => bits 7..6 == 2, base=none => bits 2..0 == 5)> <disp32>
        jt_disp_operand_slots = set()
        for off in range(0, len(self.tdata) - 7):
            if self.tdata[off] == 0xFF and self.tdata[off + 1] == 0x24:
                sib = self.tdata[off + 2]
                if (sib >> 6) == 2 and (sib & 7) == 5:
                    ptbl = struct.unpack_from("<I", self.tdata, off + 3)[0]
                    if not (self.tstart <= ptbl < self.tend):
                        continue
                    jmp_va = self.tstart + off
                    jt_disp_operand_slots.add(jmp_va + 3)

                    ctx_ins = []
                    for back in range(64, 12, -1):
                        ctx_off = max(0, off - back)
                        cins = list(self.cs_detail.disasm(self.tdata[ctx_off : off + 7], self.tstart + ctx_off))
                        if cins and cins[-1].address == jmp_va:
                            ctx_ins = cins
                            break
                    if not ctx_ins:
                        continue

                    btbl = None
                    bound = None
                    reg_imm = {}
                    for ins in ctx_ins[:-1]:
                        if (
                            ins.mnemonic == "mov"
                            and len(ins.operands) == 2
                            and ins.operands[0].type == capstone.x86.X86_OP_REG
                            and ins.operands[1].type == capstone.x86.X86_OP_IMM
                        ):
                            reg_imm[ins.operands[0].reg] = ins.operands[1].imm
                        elif ins.mnemonic == "cmp" and len(ins.operands) == 2:
                            if ins.operands[1].type == capstone.x86.X86_OP_IMM:
                                bound = ins.operands[1].imm
                            elif ins.operands[1].type == capstone.x86.X86_OP_REG and ins.operands[1].reg in reg_imm:
                                bound = reg_imm[ins.operands[1].reg]
                        elif ins.mnemonic == "movzx" and len(ins.operands) == 2 and ins.operands[1].type == capstone.x86.X86_OP_MEM:
                            disp = ins.operands[1].mem.disp & 0xFFFFFFFF
                            if ptbl < disp < ptbl + 0x400:
                                btbl = disp
                                jt_disp_operand_slots.add(ins.address + 3)

                    cur = ptbl
                    if cur not in self.text_relocs and (cur + 4) in self.text_relocs:
                        cur = cur + 4

                    if btbl is not None:
                        max_ptrs = (btbl - cur) // 4
                    elif bound is not None and 0 < bound <= 512:
                        max_ptrs = bound + 1
                    else:
                        max_ptrs = 512

                    targets = []
                    cnt = 0
                    while (
                        cnt < max_ptrs
                        and cur in self.text_relocs
                        and self.tstart <= self.text_relocs[cur] < self.tend
                    ):
                        targets.append(self.text_relocs[cur])
                        for b in range(4):
                            self.jt_data_bytes.add(cur + b)
                        cur += 4
                        cnt += 1

                    if btbl is not None and bound is not None and 0 <= bound <= 1024:
                        for b in range(bound + 1):
                            self.jt_data_bytes.add(btbl + b)

                    if targets:
                        self.jt_site_targets[jmp_va] = sorted(set(targets))

        # 2. Any contiguous run (>=2) of .text -> .text relocated dwords is inline jump-table data
        sorted_trelocs = sorted(
            slot for slot, val in self.text_relocs.items() if self.tstart <= val < self.tend
        )
        i = 0
        while i < len(sorted_trelocs):
            j = i + 1
            while j < len(sorted_trelocs) and sorted_trelocs[j] == sorted_trelocs[j - 1] + 4:
                j += 1
            if j - i >= 2:
                for k in range(i, j):
                    for b in range(4):
                        self.jt_data_bytes.add(sorted_trelocs[k] + b)
            i = j

        # 3. Remaining 16B-aligned non-CRT .text -> .text relocated immediates are callback function pointers
        for slot_va, val in self.text_relocs.items():
            if not (self.tstart <= val < self.tend):
                continue
            if (
                slot_va in self.jt_data_bytes
                or slot_va in jt_disp_operand_slots
                or self.in_pruned_code_range(slot_va)
                or self.in_pruned_code_range(val)
                or val in self.jt_data_bytes
                or (val + 4) in self.jt_data_bytes
                or val in self.thunks
            ):
                continue
            off = slot_va - self.tstart
            if off >= 3 and self.tdata[off - 3] == 0xFF and self.tdata[off - 2] == 0x24:
                continue
            if off >= 3 and self.tdata[off - 3] == 0x0F and self.tdata[off - 2] == 0xB6:
                continue
            if val % 16 == 0:
                self.cb_reloc_at_slot[slot_va] = val

    def extract_functions(self, extra_seeds: list) -> tuple:
        """Discovers all genuine non-CRT functions and their call/tail-call/IAT edges."""
        known = set()
        if not self.in_pruned_code_range(self.tstart):
            known.add(self.tstart)
        known |= self.text_export_vas
        known |= self.data_code_ptrs
        known |= set(self.cb_reloc_at_slot.values())
        for va in extra_seeds:
            if self.tstart <= va < self.tend and not self.in_pruned_code_range(va) and va not in self.thunks:
                known.add(va)

        # Never allow a switch jump-table case target to seed a standalone function
        all_jt_targets = set(t for ts in self.jt_site_targets.values() for t in ts)
        known -= all_jt_targets

        non_code = set(self.jt_data_bytes)
        for th in self.thunks:
            for b in range(6):
                non_code.add(th + b)

        covered = bytearray(len(self.tdata))
        fn_edges = {}
        fn_end_va = {}

        def trace_fn(fstart: int, record_pruned: bool, upper_bound: int = 0) -> set:
            edges = set()
            bqueue = [fstart]
            bseen = set()
            max_addr = fstart + 1
            reg_iat = {}
            reg_fn_table = {}

            while bqueue:
                bva = bqueue.pop()
                if (
                    bva in bseen
                    or not (self.tstart <= bva < self.tend)
                    or self.in_pruned_code_range(bva)
                    or bva in non_code
                ):
                    continue
                if bva != fstart and (bva in known or (upper_bound and (bva < fstart or bva >= upper_bound))):
                    edges.add(("internal", bva))
                    continue
                bseen.add(bva)

                off = bva - self.tstart
                lim = min(len(self.tdata), off + 512)
                cur = off
                while cur < lim and (self.tstart + cur) not in non_code:
                    if cur > off and (self.tstart + cur) in known:
                        break
                    cur += 1
                if cur <= off:
                    continue

                terminated = False
                last_iend = None
                for iva, size, mnem, _ in self.cs_lite.disasm_lite(self.tdata[off:cur], bva):
                    iend = iva + size
                    last_iend = iend
                    if iend > max_addr:
                        max_addr = iend
                    ioff = iva - self.tstart
                    for k in range(ioff, ioff + size):
                        covered[k] = 1

                    b0 = self.tdata[ioff]
                    if b0 == 0xCC or mnem == "int3":
                        terminated = True
                        break

                    skip_site = self.in_pruned_callsite(iva)
                    if skip_site and record_pruned and mnem == "call":
                        self.pruned_callsites_skipped.add(iva)

                    # Check immediate callback function pointer operands inside instruction
                    if not skip_site and size >= 5:
                        for s in range(iva + 1, iend - 3):
                            cb_va = self.cb_reloc_at_slot.get(s)
                            if cb_va is not None:
                                edges.add(("call", cb_va))

                    if mnem == "mov" and not skip_site:
                        if b0 == 0xA1 and size == 5:
                            disp = struct.unpack_from("<I", self.tdata, ioff + 1)[0]
                            if disp in self.iat:
                                reg_iat[0] = self.iat[disp]
                        elif b0 == 0x8B and size == 6 and (self.tdata[ioff + 1] & 0xC7) == 0x05:
                            reg_idx = (self.tdata[ioff + 1] >> 3) & 0x07
                            disp = struct.unpack_from("<I", self.tdata, ioff + 2)[0]
                            if disp in self.iat:
                                reg_iat[reg_idx] = self.iat[disp]
                        elif (
                            b0 == 0x8B
                            and size == 7
                            and (self.tdata[ioff + 1] & 0xC7) == 0x04
                            and (self.tdata[ioff + 2] & 0x07) == 0x05
                        ):
                            reg_idx = (self.tdata[ioff + 1] >> 3) & 0x07
                            disp = struct.unpack_from("<I", self.tdata, ioff + 3)[0]
                            if disp in self.fn_ptr_tables:
                                reg_fn_table[reg_idx] = disp
                    elif mnem == "call":
                        if not skip_site:
                            if b0 == 0xE8 and size == 5:
                                rel = struct.unpack_from("<i", self.tdata, ioff + 1)[0]
                                tgt = (iend + rel) & 0xFFFFFFFF
                                if tgt != iend and self.tstart <= tgt < self.tend:
                                    edges.add(("call", tgt))
                            elif size == 6 and b0 == 0xFF and self.tdata[ioff + 1] == 0x15:
                                disp = struct.unpack_from("<I", self.tdata, ioff + 2)[0]
                                if disp in self.iat:
                                    edges.add(("iat", self.iat[disp][0], self.iat[disp][1]))
                                elif disp in self.non_text_code_relocs:
                                    edges.add(("call", self.non_text_code_relocs[disp]))
                                else:
                                    edges.add(("indirect_unknown", iva))
                            elif size == 7 and b0 == 0xFF and self.tdata[ioff + 1] == 0x14:
                                disp = struct.unpack_from("<I", self.tdata, ioff + 3)[0]
                                if disp in self.fn_ptr_tables:
                                    for t in self.fn_ptr_tables[disp]:
                                        edges.add(("call", t))
                                else:
                                    edges.add(("indirect_unknown", iva))
                            elif size == 2 and b0 == 0xFF and (self.tdata[ioff + 1] & 0xF8) == 0xD0:
                                reg_idx = self.tdata[ioff + 1] & 0x07
                                if reg_idx in reg_iat:
                                    edges.add(("iat", reg_iat[reg_idx][0], reg_iat[reg_idx][1]))
                                elif reg_idx in reg_fn_table:
                                    for t in self.fn_ptr_tables[reg_fn_table[reg_idx]]:
                                        edges.add(("call", t))
                                elif fstart in self.vtable_call_targets:
                                    for t in self.vtable_call_targets[fstart]:
                                        edges.add(("call", t))
                                else:
                                    edges.add(("indirect_unknown", iva))
                            elif fstart in self.vtable_call_targets:
                                for t in self.vtable_call_targets[fstart]:
                                    edges.add(("call", t))
                            else:
                                edges.add(("indirect_unknown", iva))
                    elif mnem == "jmp":
                        if b0 in (0xEB, 0xE9):
                            if b0 == 0xEB and size == 2:
                                rel = struct.unpack_from("<b", self.tdata, ioff + 1)[0]
                            else:
                                rel = struct.unpack_from("<i", self.tdata, ioff + 1)[0]
                            tgt = (iend + rel) & 0xFFFFFFFF
                            is_int3_fn_entry = (
                                b0 == 0xE9
                                and tgt != fstart
                                and self.tstart < tgt < self.tend
                                and (tgt % 16 == 0)
                                and tgt not in all_jt_targets
                                and (tgt - 1) not in non_code
                                and self.tdata[tgt - self.tstart - 1] == 0xCC
                            )
                            if tgt in self.thunks or self.in_pruned_code_range(tgt) or is_int3_fn_entry:
                                if not skip_site:
                                    edges.add(("call", tgt))
                            elif tgt != fstart and tgt in known:
                                if not skip_site:
                                    edges.add(("internal", tgt))
                            else:
                                bqueue.append(tgt)
                        elif iva in self.jt_site_targets:
                            for jtgt in self.jt_site_targets[iva]:
                                bqueue.append(jtgt)
                        elif size == 6 and b0 == 0xFF and self.tdata[ioff + 1] == 0x25:
                            disp = struct.unpack_from("<I", self.tdata, ioff + 2)[0]
                            if disp in self.iat and not skip_site:
                                edges.add(("iat", self.iat[disp][0], self.iat[disp][1]))
                            elif disp in self.non_text_code_relocs and not skip_site:
                                edges.add(("call", self.non_text_code_relocs[disp]))
                            elif not skip_site:
                                edges.add(("indirect_unknown", iva))
                        elif not skip_site:
                            edges.add(("indirect_unknown", iva))
                        terminated = True
                        break
                    elif mnem.startswith("j") or mnem in ("loop", "loope", "loopne", "jecxz"):
                        tgt = None
                        if size == 2:
                            rel = struct.unpack_from("<b", self.tdata, ioff + 1)[0]
                            tgt = (iend + rel) & 0xFFFFFFFF
                        elif size == 6 and b0 == 0x0F:
                            rel = struct.unpack_from("<i", self.tdata, ioff + 2)[0]
                            tgt = (iend + rel) & 0xFFFFFFFF
                        if tgt is not None:
                            bqueue.append(tgt)
                        bqueue.append(iend)
                        terminated = True
                        break
                    elif mnem in ("ret", "retn", "retf", "iret", "ud2"):
                        terminated = True
                        break

                if not terminated and last_iend is not None:
                    bqueue.append(last_iend)

            fn_edges[fstart] = edges
            fn_end_va[fstart] = max_addr
            return edges

        # Pass 1: Transitive E8 call-target discovery
        queue_fns = sorted(known)
        processed = set()
        idx = 0
        while idx < len(queue_fns):
            f = queue_fns[idx]
            idx += 1
            if f in processed:
                continue
            processed.add(f)
            edges = trace_fn(f, record_pruned=False)
            for kind, *rest in edges:
                if kind == "call":
                    tgt = rest[0]
                    if (
                        self.tstart <= tgt < self.tend
                        and not self.in_pruned_code_range(tgt)
                        and tgt not in self.thunks
                        and tgt not in all_jt_targets
                        and tgt not in known
                    ):
                        known.add(tgt)
                        queue_fns.append(tgt)

        # Pass 2: Monotonic O(N) inter-function 0xCC boundary sweep for unreferenced functions
        for off in range(len(self.tdata)):
            va = self.tstart + off
            if covered[off] or self.tdata[off] == 0xCC or va in non_code or self.in_pruned_code_range(va):
                continue
            prev_is_pad = (off == 0) or (self.tdata[off - 1] == 0xCC) or ((va - 1) in non_code)
            if prev_is_pad and (va % 16 == 0) and va not in known and va not in all_jt_targets:
                known.add(va)
                edges = trace_fn(va, record_pruned=False)
                subq = [
                    rest[0]
                    for kind, *rest in edges
                    if kind == "call"
                    and self.tstart <= rest[0] < self.tend
                    and not self.in_pruned_code_range(rest[0])
                    and rest[0] not in self.thunks
                    and rest[0] not in all_jt_targets
                    and rest[0] not in known
                ]
                while subq:
                    sf = subq.pop()
                    if sf in known:
                        continue
                    known.add(sf)
                    for kind, *rest in trace_fn(sf, record_pruned=False):
                        if kind == "call":
                            stgt = rest[0]
                            if (
                                self.tstart <= stgt < self.tend
                                and not self.in_pruned_code_range(stgt)
                                and stgt not in self.thunks
                                and stgt not in all_jt_targets
                                and stgt not in known
                            ):
                                subq.append(stgt)

        # Pass 3: Final clean CFG trace over finalized `known` entry set (resolving tail-call JMPs)
        covered = bytearray(len(self.tdata))
        fn_edges.clear()
        fn_end_va.clear()
        sorted_known = sorted(known)
        for idx_k, f in enumerate(sorted_known):
            ub = sorted_known[idx_k + 1] if idx_k + 1 < len(sorted_known) else self.tend
            trace_fn(f, record_pruned=True, upper_bound=ub)

        return sorted_known, fn_edges, fn_end_va


def tarjan_scc(nodes: list, adj: dict) -> list:
    """Deterministic Tarjan's strongly connected components algorithm."""
    sys.setrecursionlimit(max(10000, len(nodes) * 2))
    index = 0
    indices = {}
    lowlinks = {}
    on_stack = set()
    stack = []
    sccs = []

    def strongconnect(v):
        nonlocal index
        indices[v] = index
        lowlinks[v] = index
        index += 1
        stack.append(v)
        on_stack.add(v)

        for w in adj.get(v, []):
            if w not in indices:
                strongconnect(w)
                lowlinks[v] = min(lowlinks[v], lowlinks[w])
            elif w in on_stack:
                lowlinks[v] = min(lowlinks[v], indices[w])

        if lowlinks[v] == indices[v]:
            scc = []
            while True:
                w = stack.pop()
                on_stack.remove(w)
                scc.append(w)
                if w == v:
                    break
            sccs.append(sorted(scc))

    for node in sorted(nodes):
        if node not in indices:
            strongconnect(node)

    return sccs


def verify_rdata_data_dispatch_completeness(analyzers: dict, dispatch_meta: dict) -> None:
    """Asserts every non-CRT .rdata/.data code-pointer relocation is accounted for."""
    covered_slots = {"D2Game": set(), "D2Common": set()}
    for tbl in dispatch_meta.get("dispatchTables", []):
        if tbl.get("type") == "sequentialCalls":
            continue
        mod_name = tbl["module"]
        base_addr = int(tbl["baseAddress"], 16)
        stride = tbl["stride"]
        count = tbl["count"]
        for i in range(count):
            for poff in tbl.get("pointerOffsets", [0]):
                covered_slots[mod_name].add(base_addr + i * stride + poff)

    pruned_data = dispatch_meta.get("pruned_roots_and_funcs", {}).get("prunedDataTables", [])
    for pt in pruned_data:
        mod_name = pt["module"]
        if "baseAddress" in pt:
            base_addr = int(pt["baseAddress"], 16)
            stride = pt.get("stride", 4)
            count = pt["count"]
            for i in range(count):
                for poff in pt.get("pointerOffsets", [0]):
                    covered_slots[mod_name].add(base_addr + i * stride + poff)
        else:
            lo = int(pt["start"], 16)
            hi = int(pt["end"], 16)
            for slot_va in range(lo, hi, 4):
                covered_slots[mod_name].add(slot_va)

    # Also exclude CRT init/atexit table ranges inside .rdata/.data when target or slot is CRT
    # (already filtered by in_pruned_code_range(val), except CRT C-init pointer slots >= 0x6FD26000..0x6FD26300 / 0x6FDD5000..0x6FDD5300)
    uncovered = []
    for mod_name, an in analyzers.items():
        for slot_va, val in sorted(an.non_text_code_relocs.items()):
            if val in an.pruned_fn_vas:
                continue
            if slot_va not in covered_slots[mod_name]:
                uncovered.append(f"{mod_name}:slot=0x{slot_va:08X}->fn=0x{val:08X}")

    if uncovered:
        raise AssertionError(
            f"Uncovered .rdata/.data code-pointer relocations ({len(uncovered)}): "
            + ", ".join(uncovered[:12])
        )


def build_manifest() -> dict:
    """Runs the full deterministic extraction and returns the manifest dict (no file I/O on outputs)."""
    print(f"[callgraph] Using D2 data dir: {D2_DATA_DIR}")
    d2game_path = os.path.join(D2_DATA_DIR, "D2Game.dll")
    d2common_path = os.path.join(D2_DATA_DIR, "D2Common.dll")
    if not os.path.exists(d2game_path) or not os.path.exists(d2common_path):
        sys.exit(f"Error: Required DLLs not found in {D2_DATA_DIR}")

    dispatch_file = os.path.join(SCRIPT_DIR, "dispatch-tables-113c.json")
    with open(dispatch_file, "r", encoding="utf-8") as f:
        dispatch_meta = json.load(f)

    pruned_cfg = dispatch_meta.get("pruned_roots_and_funcs", {})
    code_ranges_by_mod = {"D2Game": [], "D2Common": []}
    for r in pruned_cfg.get("prunedCodeRanges", []):
        code_ranges_by_mod[r["module"]].append(
            (int(r["start"], 16), int(r["end"], 16), r.get("category", "pruned"))
        )

    callsite_ranges_by_mod = {"D2Game": [], "D2Common": []}
    for r in pruned_cfg.get("prunedCallSiteRanges", []):
        callsite_ranges_by_mod[r["module"]].append((int(r["start"], 16), int(r["end"], 16)))

    pruned_fns_by_mod = {"D2Game": {}, "D2Common": {}}
    for pf in pruned_cfg.get("prunedFunctions", []):
        va = int(pf["va"], 16)
        pruned_fns_by_mod[pf["module"]][va] = pf

    pe_game = pefile.PE(d2game_path)
    pe_comm = pefile.PE(d2common_path)

    cs_detail = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    cs_detail.detail = True
    cs_lite = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    cs_lite.detail = False

    mod_game = ModuleAnalyzer(
        "D2Game",
        pe_game,
        code_ranges_by_mod["D2Game"],
        callsite_ranges_by_mod["D2Game"],
        set(pruned_fns_by_mod["D2Game"].keys()),
        cs_detail,
        cs_lite,
    )
    mod_comm = ModuleAnalyzer(
        "D2Common",
        pe_comm,
        code_ranges_by_mod["D2Common"],
        callsite_ranges_by_mod["D2Common"],
        set(pruned_fns_by_mod["D2Common"].keys()),
        cs_detail,
        cs_lite,
    )
    analyzers = {"D2Game": mod_game, "D2Common": mod_comm}

    verify_rdata_data_dispatch_completeness(analyzers, dispatch_meta)

    # Extract explicit seed VAs from rootEntryPoints and dispatchTables
    extra_seeds = {"D2Game": set(), "D2Common": set()}
    seed_roots = set()

    def add_seed_target(mod_name: str, ptr: int, source_label: str) -> None:
        an = analyzers[mod_name]
        if ptr == 0:
            return
        if ptr in an.thunks:
            dll, sym = an.thunks[ptr]
            if "d2common" in dll and sym in mod_comm.exports_by_ord:
                cva = mod_comm.exports_by_ord[sym]
                if not mod_comm.is_pruned_fn(cva):
                    extra_seeds["D2Common"].add(cva)
                    seed_roots.add(("D2Common", cva))
            return
        if not (an.tstart <= ptr < an.tend):
            raise ValueError(f"Invalid dispatch pointer {ptr:#x} outside {mod_name} .text in {source_label}")
        if an.is_pruned_fn(ptr):
            an.pruned_targets_hit.add(ptr)
            return
        extra_seeds[mod_name].add(ptr)
        seed_roots.add((mod_name, ptr))

    for root in dispatch_meta.get("rootEntryPoints", []):
        add_seed_target(root["module"], int(root["va"], 16), f"root:{root['name']}")

    for tbl in dispatch_meta.get("dispatchTables", []):
        mod_name = tbl["module"]
        an = analyzers[mod_name]
        if tbl.get("type") == "sequentialCalls":
            for e in tbl["entries"]:
                add_seed_target(mod_name, int(e["va"], 16), f"{tbl['name']}[{e['index']}]")
        else:
            base_addr = int(tbl["baseAddress"], 16)
            stride = tbl["stride"]
            count = tbl["count"]
            ptr_offsets = tbl.get("pointerOffsets", [0])
            raw = an.pe.get_data(base_addr - an.base, stride * count)
            for i in range(count):
                row_off = i * stride
                for poff in ptr_offsets:
                    slot_va = base_addr + row_off + poff
                    val = struct.unpack_from("<I", raw, row_off + poff)[0]
                    if val == 0 or slot_va not in an.pe_reloc_slots:
                        continue
                    if an.tstart <= val < an.tend:
                        add_seed_target(mod_name, val, f"{tbl['name']}[{i}]+{poff}")

    game_starts, game_raw_edges, game_ends = mod_game.extract_functions(sorted(extra_seeds["D2Game"]))
    comm_starts, comm_raw_edges, comm_ends = mod_comm.extract_functions(sorted(extra_seeds["D2Common"]))
    starts_by_mod = {"D2Game": game_starts, "D2Common": comm_starts}
    starts_set_by_mod = {"D2Game": set(game_starts), "D2Common": set(comm_starts)}
    ends_by_mod = {"D2Game": game_ends, "D2Common": comm_ends}

    print(
        f"[callgraph] CFG boundaries: {len(game_starts)} D2Game fns "
        f"({len(mod_game.jt_site_targets)} JTs), "
        f"{len(comm_starts)} D2Common fns ({len(mod_comm.jt_site_targets)} JTs)."
    )

    def resolve_fn(mod_name: str, va: int):
        if va in starts_set_by_mod[mod_name]:
            return va
        slist = starts_by_mod[mod_name]
        idx = bisect.bisect_right(slist, va) - 1
        if idx >= 0:
            cand = slist[idx]
            if cand <= va < ends_by_mod[mod_name].get(cand, cand + 1):
                return cand
        return None

    pruned_encountered = set()  # (mod, va, category_or_reason)

    def normalize_edges(mod_name: str, fstart: int, raw_edges: set) -> tuple:
        an = analyzers[mod_name]
        internal = set()
        external = set()
        for kind, *rest in raw_edges:
            if kind in ("call", "internal"):
                tgt = rest[0]
                if tgt in an.thunks:
                    dll, sym = an.thunks[tgt]
                    if "d2common" in dll and sym in mod_comm.exports_by_ord:
                        cva = mod_comm.exports_by_ord[sym]
                        if mod_comm.is_pruned_fn(cva):
                            pruned_encountered.add(("D2Common", cva, "prunedFunction"))
                        else:
                            cfn = resolve_fn("D2Common", cva)
                            if cfn is not None:
                                internal.add(("D2Common", cfn))
                    else:
                        external.add((dll, str(sym)))
                elif an.in_pruned_code_range(tgt):
                    cat = an.pruned_range_category(tgt) or "libcmt"
                    pruned_encountered.add((mod_name, tgt, cat))
                    external.add((f"{mod_name.lower()}.{cat}", f"0x{tgt:08X}"))
                elif tgt in pruned_fns_by_mod[mod_name]:
                    pruned_encountered.add((mod_name, tgt, "prunedFunction"))
                else:
                    tfn = resolve_fn(mod_name, tgt)
                    if tfn is not None and tfn != fstart:
                        if tfn in pruned_fns_by_mod[mod_name]:
                            pruned_encountered.add((mod_name, tfn, "prunedFunction"))
                        else:
                            internal.add((mod_name, tfn))
            elif kind == "iat":
                dll, sym = rest[0], rest[1]
                if "d2common" in dll and sym in mod_comm.exports_by_ord:
                    cva = mod_comm.exports_by_ord[sym]
                    if mod_comm.is_pruned_fn(cva):
                        pruned_encountered.add(("D2Common", cva, "prunedFunction"))
                    else:
                        cfn = resolve_fn("D2Common", cva)
                        if cfn is not None:
                            internal.add(("D2Common", cfn))
                else:
                    external.add((dll, str(sym)))
        return sorted(internal), sorted(external)

    # Normalize seed_roots to exact function starts
    clean_roots = set()
    for mod_name, rva in sorted(seed_roots):
        if rva in pruned_fns_by_mod[mod_name] or analyzers[mod_name].in_pruned_code_range(rva):
            pruned_encountered.add((mod_name, rva, "prunedFunction"))
            continue
        rfn = resolve_fn(mod_name, rva)
        if rfn is not None and rfn not in pruned_fns_by_mod[mod_name]:
            clean_roots.add((mod_name, rfn))

    print(f"[callgraph] Verified kernel seed roots: {len(clean_roots)}")

    # BFS Reachability Closure
    reachable_nodes = set()
    internal_adj = {}
    external_deps = {}
    queue = sorted(clean_roots)
    q_idx = 0
    visited = set(queue)

    while q_idx < len(queue):
        curr = queue[q_idx]
        q_idx += 1
        reachable_nodes.add(curr)
        mod_name, addr = curr
        raw_e = game_raw_edges.get(addr, set()) if mod_name == "D2Game" else comm_raw_edges.get(addr, set())
        int_list, ext_list = normalize_edges(mod_name, addr, raw_e)
        internal_adj[curr] = int_list
        if ext_list:
            external_deps[curr] = ext_list
        for nxt in int_list:
            if nxt not in visited:
                visited.add(nxt)
                queue.append(nxt)

    # Record explicitly configured pruned roots/functions + CRT ranges encountered
    all_pruned_records = []
    seen_pruned_keys = set()
    for mod_name in ("D2Game", "D2Common"):
        for va, pf in sorted(pruned_fns_by_mod[mod_name].items()):
            key = (mod_name, va)
            seen_pruned_keys.add(key)
            all_pruned_records.append({
                "va": f"0x{va:08X}",
                "module": mod_name,
                "name": pf["name"],
                "category": "prunedHostOrRealm",
                "reason": pf["reason"],
                "evidence": pf["evidence"],
            })
    for mod_name, va, cat in sorted(pruned_encountered):
        if (mod_name, va) in seen_pruned_keys:
            continue
        seen_pruned_keys.add((mod_name, va))
        all_pruned_records.append({
            "va": f"0x{va:08X}",
            "module": mod_name,
            "name": f"{mod_name}_{cat}_{va:08X}",
            "category": cat,
            "reason": f"Static {cat} target referenced from reachable kernel code",
            "evidence": f"Excluded by prunedCodeRanges ({mod_name} 0x{va:08X})",
        })

    # Count non-CRT functions outside the K0 room-tick/packet closure across both DLLs
    outside_closure_d2game = sorted(
        va for va in game_starts
        if ("D2Game", va) not in reachable_nodes and va not in pruned_fns_by_mod["D2Game"]
    )
    outside_closure_d2common = sorted(
        va for va in comm_starts
        if ("D2Common", va) not in reachable_nodes and va not in pruned_fns_by_mod["D2Common"]
    )

    d2game_reach = [n for n in reachable_nodes if n[0] == "D2Game"]
    d2comm_reach = [n for n in reachable_nodes if n[0] == "D2Common"]
    print(f"[callgraph] Reachable kernel closure: {len(reachable_nodes)} functions.")
    print(f"  - D2Game:   {len(d2game_reach)}")
    print(f"  - D2Common: {len(d2comm_reach)}")
    print(f"  - Pruned host/CRT/Realm targets: {len(all_pruned_records)}")
    print(
        f"  - {OUTSIDE_CLOSURE_DESCRIPTION}: "
        f"{len(outside_closure_d2game)} D2Game + {len(outside_closure_d2common)} D2Common"
    )

    # Reverse adjacency
    callers = {node: [] for node in reachable_nodes}
    for u, v_list in internal_adj.items():
        for v in v_list:
            if v in callers:
                callers[v].append(u)
    for v in callers:
        callers[v].sort()

    # Tarjan SCCs & topological levels (0 = leaf SCC)
    sccs = tarjan_scc(sorted(reachable_nodes), internal_adj)
    node_to_scc = {}
    for scc_id, scc in enumerate(sccs):
        for node in scc:
            node_to_scc[node] = scc_id

    scc_adj = {scc_id: set() for scc_id in range(len(sccs))}
    for u, v_list in internal_adj.items():
        u_scc = node_to_scc[u]
        for v in v_list:
            v_scc = node_to_scc[v]
            if u_scc != v_scc:
                scc_adj[u_scc].add(v_scc)

    memo_lvl = {}

    def get_level(scc_id: int) -> int:
        if scc_id in memo_lvl:
            return memo_lvl[scc_id]
        targets = scc_adj[scc_id]
        lvl = 0 if not targets else 1 + max(get_level(t) for t in targets)
        memo_lvl[scc_id] = lvl
        return lvl

    scc_topo_level = {scc_id: get_level(scc_id) for scc_id in range(len(sccs))}
    max_level = max(scc_topo_level.values()) if scc_topo_level else 0
    print(f"[callgraph] SCC count: {len(sccs)}, Max topological level: {max_level}")

    kern_registry = build_verified_kern_registry(starts_set_by_mod, reachable_nodes)
    fn_map_path = os.path.join(REPO_ROOT, "docs", "oracle", "function-map.md")
    legacy_db = parse_legacy_refs_from_function_map(fn_map_path)

    manifest_entries = []
    for mod_name, addr in sorted(reachable_nodes, key=lambda x: (x[0], x[1])):
        end_va = ends_by_mod[mod_name].get(addr, addr + 1)
        fn_size = max(1, end_va - addr)
        scc_id = node_to_scc[(mod_name, addr)]
        topo_lvl = scc_topo_level[scc_id]

        kern_info = kern_registry.get((mod_name, addr))
        legacy_info = legacy_db.get((mod_name, addr), {})

        if kern_info is not None:
            fn_name = kern_info["name"]
            fn_status = kern_info["status"]
        else:
            fn_name = legacy_info.get("fallbackName") or f"{mod_name}_{addr:08X}"
            fn_status = "unported"

        raw_e = game_raw_edges.get(addr, set()) if mod_name == "D2Game" else comm_raw_edges.get(addr, set())
        has_indirect_unknown = any(kind == "indirect_unknown" for kind, *_ in raw_e)

        entry = {
            "va": f"0x{addr:08X}",
            "module": mod_name,
            "name": fn_name,
            "size": fn_size,
            "sccId": scc_id,
            "topoLevel": topo_lvl,
            "status": fn_status,
            "callees": [f"{m}:{v:08X}" for (m, v) in internal_adj.get((mod_name, addr), [])],
            "callers": [f"{m}:{u:08X}" for (m, u) in callers.get((mod_name, addr), [])],
            "externalDeps": [f"{dll}:{sym}" for (dll, sym) in external_deps.get((mod_name, addr), [])],
        }
        if has_indirect_unknown:
            entry["indirectUnknown"] = True
        if kern_info is not None:
            entry["kernFile"] = kern_info["kernFile"]
            entry["tsSymbol"] = kern_info["tsSymbol"]
            entry["tsReference"] = kern_info["tsReference"]
            if "diffEvidence" in kern_info:
                entry["diffEvidence"] = kern_info["diffEvidence"]
        elif "legacyRef" in legacy_info:
            entry["legacyRef"] = legacy_info["legacyRef"]
        manifest_entries.append(entry)

    diff_verified_cnt = sum(1 for e in manifest_entries if e["status"] == "diff-verified")
    ported_cnt = sum(1 for e in manifest_entries if e["status"] == "ported")
    unported_cnt = sum(1 for e in manifest_entries if e["status"] == "unported")
    legacy_ref_cnt = sum(1 for e in manifest_entries if "legacyRef" in e)

    implemented_keys = {
        f"{e['module']}:{e['va'][2:]}"
        for e in manifest_entries
        if e["status"] in ("diff-verified", "ported")
    }
    ready_entries = [
        e
        for e in manifest_entries
        if e["status"] == "unported"
        and not e.get("indirectUnknown", False)
        and all(c in implemented_keys for c in e["callees"])
    ]
    ready_pure_leaf_cnt = sum(
        1
        for e in ready_entries
        if len(e["callees"]) == 0 and len(e["externalDeps"]) == 0 and not e.get("indirectUnknown", False)
    )
    ready_host_import_cnt = sum(1 for e in ready_entries if len(e["externalDeps"]) > 0)
    ready_internal_composite_cnt = sum(
        1 for e in ready_entries if len(e["callees"]) > 0 and len(e["externalDeps"]) == 0
    )

    manifest = {
        "version": "1.13c",
        "generatedAt": "2026-11-06",
        "summary": {
            "totalReachable": len(manifest_entries),
            "d2GameReachable": len(d2game_reach),
            "d2CommonReachable": len(d2comm_reach),
            "sccCount": len(sccs),
            "maxTopoLevel": max_level,
            "prunedCount": len(all_pruned_records),
            "outsideClosureD2GameCount": len(outside_closure_d2game),
            "outsideClosureD2CommonCount": len(outside_closure_d2common),
            "outsideClosureNote": OUTSIDE_CLOSURE_DESCRIPTION,
            "legacyRefCount": legacy_ref_cnt,
            "readySummary": {
                "ready": len(ready_entries),
                "readyPureLeaf": ready_pure_leaf_cnt,
                "readyHostImport": ready_host_import_cnt,
                "readyInternalComposite": ready_internal_composite_cnt,
            },
            "statusBreakdown": {
                "diff-verified": diff_verified_cnt,
                "ported": ported_cnt,
                "unported": unported_cnt,
            },
        },
        "pruned": {
            "prunedCallSitesSkipped": [f"D2Game:0x{va:08X}" for va in sorted(mod_game.pruned_callsites_skipped)]
            + [f"D2Common:0x{va:08X}" for va in sorted(mod_comm.pruned_callsites_skipped)],
            "entries": all_pruned_records,
        },
        "functions": manifest_entries,
    }

    print(
        f"[callgraph] Built manifest: {len(manifest_entries)} kernel fns "
        f"(diff-verified={diff_verified_cnt}, ported={ported_cnt}, unported={unported_cnt}, "
        f"ready={len(ready_entries)} [pureLeaf={ready_pure_leaf_cnt}, hostImport={ready_host_import_cnt}, "
        f"internalComposite={ready_internal_composite_cnt}], "
        f"legacyRef={legacy_ref_cnt}, pruned={len(all_pruned_records)})"
    )
    return manifest


DEFAULT_MANIFEST_PATH = os.path.join(SCRIPT_DIR, "manifest-113c.json")


def serialize_manifest(manifest: dict) -> str:
    """Canonical byte form of the committed manifest (sorted keys, 2-space indent, trailing newline)."""
    return json.dumps(manifest, indent=2, sort_keys=True) + "\n"


def first_manifest_difference(old_text: str, new_text: str) -> str:
    """Human-readable description of the first differing function key (or summary/pruned section)."""
    try:
        old = json.loads(old_text)
    except ValueError:
        return "committed manifest is not valid JSON"
    new = json.loads(new_text)
    old_fns = {f"{f['module']}:{f['va']}": f for f in old.get("functions", [])}
    new_fns = {f"{f['module']}:{f['va']}": f for f in new.get("functions", [])}
    for key in sorted(set(old_fns) | set(new_fns)):
        if old_fns.get(key) != new_fns.get(key):
            a, b = old_fns.get(key), new_fns.get(key)
            sa = a.get("status") if a else "<absent>"
            sb = b.get("status") if b else "<absent>"
            return f"function {key} differs (committed status={sa}, regenerated status={sb})"
    for sect in sorted(set(old) | set(new)):
        if old.get(sect) != new.get(sect):
            return f"top-level section '{sect}' differs"
    return "byte formatting differs"


def main(argv=None) -> int:
    import argparse

    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", default=DEFAULT_MANIFEST_PATH, help="output path (default: committed manifest)")
    ap.add_argument(
        "--check",
        action="store_true",
        help="regenerate in memory and exit 1 if it differs byte-for-byte from --out (never writes)",
    )
    args = ap.parse_args(argv)

    text = serialize_manifest(build_manifest())
    if args.check:
        old_text = ""
        if os.path.isfile(args.out):
            with open(args.out, "r", encoding="utf-8") as f:
                old_text = f.read()
        if old_text != text:
            print(f"[callgraph] CHECK FAILED: {args.out} is stale: {first_manifest_difference(old_text, text)}")
            return 1
        print(f"[callgraph] CHECK OK: {args.out} is byte-identical to the regenerated manifest")
        return 0
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"[callgraph] Wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
