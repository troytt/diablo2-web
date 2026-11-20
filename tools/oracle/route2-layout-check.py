#!/usr/bin/env python3
"""Check docs/oracle/route2-layout.json against 1.13c PE binaries and oracle `memdump` blocks.

Usage: route2-layout-check.py [<trace.ndjson[.gz]> [<live_layout.ndjson> ...]]

Every check compares a layout struct size or field offset against:
  1. Direct x86 instruction immediates and displacements in the 1.13c PE binaries
     (D2Common.dll, D2Game.dll, D2Client.dll) across all 18 structs and 279 fields.
  2. Live allocator hook sizes (Fog.#10042 / Fog.#10045) and independent D2Common
     ordinal getter outputs (#10331, #10561, #10826, #10057) from d2host-113c.exe.
  3. Cross-block invariants in recorded oracle traces.
Exits non-zero immediately on any failure.
"""
import gzip
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LAYOUT_PATH = os.environ.get(
    'ROUTE2_LAYOUT_JSON',
    os.path.join(HERE, '..', '..', 'docs', 'oracle', 'route2-layout.json'),
)
LAYOUT = json.load(open(LAYOUT_PATH, encoding='utf-8'))['structs']

TYPE_SIZES = {'u8': 1, 'u16': 2, 'u32': 4, 'ptr': 4}

STRUCT_SIZE_PE_PROBES = {
    'D2UnitStrc': ('D2Common.dll', 0x6FD7F383, 'ba', 1, 4, 1),
    'D2StatListStrc': ('D2Common.dll', 0x6FD88112, 'ba', 1, 4, 1),
    'D2StatListExStrc': ('D2Common.dll', 0x6FD8AF31, 'ba', 1, 4, 1),
    'D2MonsterDataStrc': ('D2Common.dll', 0x6FD7F3B4, 'ba', 1, 4, 1),
    'D2AiGeneralStrc': ('D2Game.dll', 0x6FCD037D, 'ba', 1, 4, 1),
    'D2AiCmdStrc': ('D2Game.dll', 0x6FC40F5E, 'ba', 1, 4, 1),
    'D2AiControlStrc': ('D2Game.dll', 0x6FCD03BA, 'ba', 1, 4, 1),
    'D2EventStrc': ('D2Game.dll', 0x6FCAE461, '8d48', 2, 1, 1),
    'D2TimerStrc': ('D2Game.dll', 0x6FCAE652, 'ba', 1, 4, 1),
    'D2GameStrc': ('D2Client.dll', 0x6FAB24D9, '05', 1, 4, 1),
    'D2ActiveRoomStrc': ('D2Common.dll', 0x6FD8C75A, 'ba', 1, 4, 1),
    'D2DynamicPathStrc': ('D2Common.dll', 0x6FD86045, 'ba', 1, 4, 1),
    'D2DamageStrc': ('D2Game.dll', 0x6FC9560A, 'b9', 1, 4, 4),
    'D2ActStrc': ('D2Common.dll', 0x6FD8CB40, 'ba', 1, 4, 1),
    'D2EnvironmentStrc': ('D2Common.dll', 0x6FD87BAE, 'ba', 1, 4, 1),
    'D2RoomExStrc': ('D2Common.dll', 0x6FD94BEC, 'ba', 1, 4, 1),
    'D2RoomCoordListStrc': ('D2Common.dll', 0x6FDD12A0, 'ba', 1, 4, 1),
    'D2RoomCollisionGridStrc': ('D2Common.dll', 0x6FD9D073, '8d7b', 2, 1, 1),
}

FIELD_PE_PROBES = {'D2UnitStrc': {'dwUnitType': ['D2Common.dll', 1876422656, 1, 0, '0000'], 'dwClassId': ['D2Common.dll', 1876422752, 3, 1, '8b4424'], 'pMemPool': ['D2Common.dll', 1876422890, 3, 1, '8b5424'], 'dwUnitId': ['D2Common.dll', 1876422760, 3, 1, '8b4c24'], 'dwAnimMode': ['D2Common.dll', 1876422924, 3, 1, '8d4c24'], 'pUnitData': ['D2Common.dll', 1876422961, 3, 1, '8b4424'], 'nAct': ['D2Common.dll', 1876423515, 2, 1, '8950'], 'pAct': ['D2Common.dll', 1876422929, 3, 1, '8b4c24'], 'seedLo': ['D2Common.dll', 1876422941, 3, 1, '8d4424'], 'seedHi': ['D2Common.dll', 1876428596, 3, 1, '8b5c24'], 'pPath': ['D2Common.dll', 1876423247, 2, 1, '8b40'], 'wAnimSpeed': ['D2Common.dll', 1876422756, 3, 1, '0fbf50'], 'wActionFrame': ['D2Common.dll', 1876422985, 2, 1, '8856'], 'pAnimData': ['D2Common.dll', 1876436222, 2, 1, '8b4e'], 'pStatListEx': ['D2Common.dll', 1876426239, 2, 1, '8b40'], 'pInventory': ['D2Common.dll', 1876426143, 2, 1, '8b40'], 'pGame': ['D2Common.dll', 1876424028, 2, 4, '8988'], 'pSkills': ['D2Common.dll', 1876427719, 2, 4, '8b80'], 'pCombat': ['D2Game.dll', 1875897680, 2, 4, '8b85'], 'dwFlags': ['D2Common.dll', 1876436082, 2, 4, '8b86'], 'dwFlags2': ['D2Common.dll', 1876425202, 2, 4, '8188'], 'pEventFirst': ['D2Common.dll', 1876442037, 2, 4, '8b80'], 'pRoomUpdateNext': ['D2Common.dll', 1876443141, 2, 4, '8b88'], 'pGameHashNext': ['D2Common.dll', 1876443109, 2, 4, '8b88'], 'pRoomUnitNext': ['D2Common.dll', 1876443077, 2, 4, '8b88']}, 'D2StatListStrc': {'pMemPool': ['D2Common.dll', 1876459842, 1, 0, '8932'], 'pUnit': ['D2Common.dll', 1876459280, 3, 1, '8b4424'], 'eOwnerType': ['D2Common.dll', 1876459295, 3, 1, '8b4c24'], 'dwOwnerId': ['D2Common.dll', 1876459659, 2, 1, '8b40'], 'dwFlags': ['D2Common.dll', 1876459299, 2, 1, '8548'], 'dwStateNo': ['D2Common.dll', 1876459424, 2, 1, '3950'], 'dwExpireFrame': ['D2Common.dll', 1876459531, 2, 1, '8b40'], 'nSkillNo': ['D2Common.dll', 1876459823, 3, 1, '8b4c24'], 'nSkillLevel': ['D2Common.dll', 1876464965, 3, 1, '897c24'], 'pStat': ['D2Common.dll', 1876459497, 2, 1, '8b40'], 'wStatCount': ['D2Common.dll', 1876459480, 3, 1, '0fbf50'], 'wStatCapacity': ['D2Common.dll', 1876382294, 3, 1, '0fbf56'], 'pPrevLink': ['D2Common.dll', 1876459266, 2, 1, '8b40'], 'pNextLink': ['D2Common.dll', 1876466949, 3, 1, '8b4424'], 'pParent': ['D2Common.dll', 1876467670, 2, 1, '8b5b'], 'fpRemove': ['D2Common.dll', 1876469159, 2, 1, '8b45']}, 'D2StatListExStrc': {'pMemPool': ['D2Common.dll', 1876459842, 1, 0, '8932'], 'pUnit': ['D2Common.dll', 1876459280, 3, 1, '8b4424'], 'eOwnerType': ['D2Common.dll', 1876459295, 3, 1, '8b4c24'], 'dwOwnerId': ['D2Common.dll', 1876459659, 2, 1, '8b40'], 'dwFlags': ['D2Common.dll', 1876459299, 2, 1, '8548'], 'dwStateNo': ['D2Common.dll', 1876459424, 2, 1, '3950'], 'dwExpireFrame': ['D2Common.dll', 1876459531, 2, 1, '8b40'], 'nSkillNo': ['D2Common.dll', 1876459823, 3, 1, '8b4c24'], 'nSkillLevel': ['D2Common.dll', 1876464965, 3, 1, '897c24'], 'pStat': ['D2Common.dll', 1876459497, 2, 1, '8b40'], 'wStatCount': ['D2Common.dll', 1876459480, 3, 1, '0fbf50'], 'wStatCapacity': ['D2Common.dll', 1876382294, 3, 1, '0fbf56'], 'pPrevLink': ['D2Common.dll', 1876459266, 2, 1, '8b40'], 'pNextLink': ['D2Common.dll', 1876466949, 3, 1, '8b4424'], 'pParent': ['D2Common.dll', 1876467670, 2, 1, '8b5b'], 'fpRemove': ['D2Common.dll', 1876469159, 2, 1, '8b45'], 'pMyLastList': ['D2Common.dll', 1876459349, 2, 1, '8b40'], 'pMyStats': ['D2Common.dll', 1876459344, 2, 1, '8b40'], 'pOwner': ['D2Common.dll', 1876462029, 2, 1, '8b53'], 'pFullStat': ['D2Common.dll', 1876460291, 2, 1, '8d68'], 'wFullStatCount': ['D2Common.dll', 1876459700, 3, 1, '0fbf40'], 'wFullStatCapacity': ['D2Common.dll', 1876341392, 2, 1, '8a47'], 'pModStat': ['D2Common.dll', 1876460985, 2, 1, '8d73'], 'wModStatCount': ['D2Common.dll', 1876461007, 3, 1, '663943'], 'wModStatCapacity': ['D2Common.dll', 1876461003, 3, 1, '668b43'], 'pStateFlags': ['D2Common.dll', 1876460688, 2, 1, '8b49'], 'fpStatChanged': ['D2Common.dll', 1876459688, 2, 1, '8b40'], 'pGame': ['D2Common.dll', 1876462033, 2, 1, '8b4b']}, 'D2MonsterDataStrc': {'pMonStatsTxt': ['D2Common.dll', 1876423584, 1, 0, '8906'], 'pAiGeneral': ['D2Game.dll', 1875706794, 2, 1, '8953'], 'pAiControl': ['D2Common.dll', 1876423652, 2, 1, '8b50'], 'dwAlwaysChaseField': ['D2Game.dll', 1875708914, 2, 1, '8b40']}, 'D2AiGeneralStrc': {'pfnThink': ['D2Game.dll', 1875706826, 2, 1, '894a'], 'dwFlags': ['D2Game.dll', 1875706829, 2, 1, '894a'], 'bAfraid': ['D2Game.dll', 1875706660, 3, 1, '8b7424'], 'pCommandHead': ['D2Game.dll', 1875706848, 2, 1, '894a'], 'pCommandTail': ['D2Game.dll', 1875707369, 3, 1, '895424'], 'pGroup': ['D2Game.dll', 1875706794, 2, 1, '8953'], 'dwLeaderId': ['D2Game.dll', 1875706782, 2, 1, '894a'], 'dwLeaderType': ['D2Game.dll', 1875706785, 2, 1, '8942'], 'pMinionList': ['D2Game.dll', 1875707384, 3, 1, '895424']}, 'D2AiCmdStrc': {'pNext': ['D2Game.dll', 1875119925, 1, 0, '8338'], 'pPrev': ['D2Game.dll', 1875119888, 3, 1, '8b4424'], 'dwCmdType': ['D2Game.dll', 1875119950, 3, 1, '8b4424'], 'dwParam1': ['D2Game.dll', 1875119988, 2, 1, '894a'], 'dwParam2': ['D2Game.dll', 1875119991, 2, 1, '894a'], 'dwParam3': ['D2Game.dll', 1875119930, 2, 1, '8b40'], 'dwParam4': ['D2Game.dll', 1875119997, 2, 1, '894a']}, 'D2AiControlStrc': {'dwPathTypeOverride': ['D2Game.dll', 1875706841, 2, 1, '894a'], 'dwVelocityOverride': ['D2Game.dll', 1875706675, 3, 1, '8b4424'], 'bNewDistOverride': ['D2Game.dll', 1875706848, 2, 1, '894a']}, 'D2EventStrc': {'nType': ['D2Game.dll', 1875567616, 1, 0, '8b0a'], 'fFlags': ['D2Game.dll', 1875568328, 2, 1, '8060'], 'dwFrame': ['D2Game.dll', 1875567791, 2, 1, '8b49'], 'pUnit': ['D2Game.dll', 1875568274, 2, 1, '8978'], 'dwUnitId': ['D2Game.dll', 1875568332, 2, 1, '8978'], 'dwUnitType': ['D2Game.dll', 1875568320, 2, 1, '8948'], 'dwArg14': ['D2Game.dll', 1875568687, 2, 1, '8948'], 'dwArg18': ['D2Game.dll', 1875568703, 2, 1, '8950'], 'pWheelNewer': ['D2Game.dll', 1875567620, 2, 1, '8948'], 'pWheelOlder': ['D2Game.dll', 1875567623, 2, 1, 'c740'], 'pUnitNext': ['D2Game.dll', 1875567786, 2, 1, '8b51'], 'pUnitPrev': ['D2Game.dll', 1875568296, 2, 1, '8941'], 'pfnHandler': ['D2Game.dll', 1875568706, 2, 1, '8948']}, 'D2TimerStrc': {'nCurrentSlot': ['D2Game.dll', 1875567616, 1, 0, '8b0a'], 'pSlotTail': ['D2Game.dll', 1875567791, 2, 1, '8b49'], 'pSlotHead': ['D2Game.dll', 1875568092, 3, 4, '8d8491'], 'pPersistentHead': ['D2Game.dll', 1875568130, 3, 4, '8d8482'], 'pSavedNext': ['D2Game.dll', 1875568395, 2, 4, '3b83'], 'pPool': ['D2Game.dll', 1875567835, 2, 4, '8b93']}, 'D2GameStrc': {'nDifficulty': ['D2Game.dll', 1875166180, 2, 1, '8853'], 'bExpansion': ['D2Game.dll', 1875163589, 2, 1, '8b48'], 'dwInitSeed': ['D2Game.dll', 1875159394, 2, 1, '8947'], 'dwSeedOverride': ['D2Game.dll', 1875159316, 2, 4, 'c787'], 'pClientList': ['D2Game.dll', 1875159936, 2, 4, '8b88'], 'dwLastUnitId': ['D2Game.dll', 1875162545, 2, 4, '8b8b'], 'dwGameFrame': ['D2Game.dll', 1875162879, 2, 4, '8b8b'], 'pTimer': ['D2Game.dll', 1875905445, 2, 4, '8b97'], 'pAct': ['D2Game.dll', 1875165120, 3, 4, '8b8c86'], 'seedLo': ['D2Game.dll', 1875159332, 2, 4, '8db7'], 'seedHi': ['D2Game.dll', 1875180288, 2, 4, '8bb5'], 'pUnitHash': ['D2Game.dll', 1875161023, 2, 4, '8d90'], 'pTileList': ['D2Game.dll', 1875903143, 2, 4, '8d8a'], 'dwMonSpawnCount': ['D2Game.dll', 1875162816, 2, 4, '8dbb'], 'dwMonSpawnTotal': ['D2Game.dll', 1875162669, 2, 4, '8b83'], 'dwUberStateEnd': ['D2Game.dll', 1875167057, 2, 4, '89ae']}, 'D2ActiveRoomStrc': {'ppRoomsNear': ['D2Common.dll', 1876478116, 1, 0, '8b08'], 'pCoords': ['D2Common.dll', 1876477505, 3, 1, '8b7424'], 'pRoomEx': ['D2Common.dll', 1876477581, 2, 1, '8b72'], 'bDeathRingIdx': ['D2Common.dll', 1876477600, 3, 1, '8b4424'], 'pUpdateList': ['D2Common.dll', 1876477796, 3, 1, '8b7424'], 'pCollisionGrid': ['D2Common.dll', 1876477800, 3, 1, '8b5424'], 'nRoomsNear': ['D2Common.dll', 1876477821, 3, 1, '8b4c24'], 'nPlayers': ['D2Common.dll', 1876477817, 3, 1, '8b4424'], 'pAct': ['D2Common.dll', 1876477874, 2, 1, '896b'], 'dwFlags': ['D2Common.dll', 1876477825, 2, 1, '8943'], 'dwDeathRing': ['D2Common.dll', 1876482853, 3, 1, '8b6c24'], 'nSubtileX': ['D2Common.dll', 1876477845, 2, 1, '8d7b'], 'nSubtileY': ['D2Common.dll', 1876478699, 2, 1, '8b4b'], 'nSubtileWidth': ['D2Common.dll', 1876477867, 2, 1, 'c745'], 'nSubtileHeight': ['D2Common.dll', 1876478004, 2, 1, '8b71'], 'nTileX': ['D2Common.dll', 1876477768, 2, 1, '8b4d'], 'nTileY': ['D2Common.dll', 1876478705, 2, 1, '8947'], 'nTileWidth': ['D2Common.dll', 1876650710, 3, 1, '894424'], 'nTileHeight': ['D2Common.dll', 1876482376, 3, 1, '8b7c95'], 'seedLo': ['D2Common.dll', 1876477832, 2, 1, '894b'], 'seedHi': ['D2Common.dll', 1876477835, 2, 1, 'c743'], 'pUnitFirst': ['D2Common.dll', 1876477550, 2, 1, '8b46'], 'pRoomNext': ['D2Common.dll', 1876477861, 2, 1, '894b']}, 'D2DynamicPathStrc': {'wOffsetX': ['D2Common.dll', 1876451468, 1, 0, '890e'], 'wPosX': ['D2Common.dll', 1876451707, 3, 1, '0fbf48'], 'wOffsetY': ['D2Common.dll', 1876451376, 3, 1, '8b4c24'], 'wPosY': ['D2Common.dll', 1876452029, 3, 1, '668b4d'], 'dwClientCoordX': ['D2Common.dll', 1876451859, 2, 1, '8956'], 'dwClientCoordY': ['D2Common.dll', 1876451862, 2, 1, '894e'], 'wTargetX': ['D2Common.dll', 1876452048, 3, 1, '895424'], 'wTargetY': ['D2Common.dll', 1876452129, 3, 1, '66837d'], 'wPrevTargetX': ['D2Common.dll', 1876451330, 4, 1, '663b4424'], 'wPrevTargetY': ['D2Common.dll', 1876452163, 4, 1, '668b5424'], 'wFinalTargetX': ['D2Common.dll', 1876451347, 3, 1, '8b4424'], 'wFinalTargetY': ['D2Common.dll', 1876452437, 3, 1, '668955'], 'pRoom': ['D2Common.dll', 1876451453, 3, 1, '8b4424'], 'pPreviousRoom': ['D2Common.dll', 1876451470, 3, 1, '8b4c24'], 'dwCurrentPointIdx': ['D2Common.dll', 1876451420, 3, 1, '8b7c24'], 'dwPathPoints': ['D2Common.dll', 1876451848, 3, 1, '8b4424'], 'pUnit': ['D2Common.dll', 1876451428, 2, 1, '897e'], 'dwFlags': ['D2Common.dll', 1876451587, 2, 1, '8b56'], 'dwPathType': ['D2Common.dll', 1876451605, 2, 1, 'c746'], 'dwPrevPathType': ['D2Common.dll', 1876451590, 2, 1, '8b46'], 'dwUnitSize': ['D2Common.dll', 1876451438, 2, 1, '8946'], 'dwCollisionPattern': ['D2Common.dll', 1876451450, 2, 1, '8946'], 'nFootprintCollisionMask': ['D2Common.dll', 1876451553, 2, 1, '895e'], 'nMoveTestCollisionMask': ['D2Common.dll', 1876451556, 2, 1, '895e'], 'wCollidedWithMask': ['D2Common.dll', 1876451981, 3, 1, '66c745'], 'pTargetUnit': ['D2Common.dll', 1876451976, 2, 1, '8b75'], 'dwTargetType': ['D2Common.dll', 1876578216, 3, 1, 'c74424'], 'dwTargetId': ['D2Common.dll', 1876578224, 3, 1, '897424'], 'nDirection': ['D2Common.dll', 1876578228, 3, 1, '895c24'], 'nNewDirection': ['D2Common.dll', 1876284304, 2, 1, '3a4e'], 'nDiffDirection': ['D2Common.dll', 1876284329, 2, 1, '884e'], 'dwVelocity': ['D2Common.dll', 1876451495, 2, 1, 'c746'], 'nPreviousVelocity': ['D2Common.dll', 1876579085, 3, 4, '89b424'], 'dwMaxVelocity': ['D2Common.dll', 1876578256, 3, 4, 'c78424'], 'dwAcceleration': ['D2Common.dll', 1876578267, 3, 4, '89bc24'], 'nDist': ['D2Common.dll', 1876578281, 3, 4, 'c78424'], 'nDistMax': ['D2Common.dll', 1876451738, 2, 4, 'c686'], 'nIDAStarInitFScore': ['D2Common.dll', 1876451802, 2, 4, 'c686'], 'nStepNum': ['D2Common.dll', 1876451505, 2, 4, '889e'], 'nDistance': ['D2Common.dll', 1876578292, 3, 4, '899c24'], 'wPathPoints': ['D2Common.dll', 1876578310, 3, 4, '89b424'], 'nSavedStepsCount': ['D2Common.dll', 1876451511, 2, 4, 'c786'], 'wSavedSteps': ['D2Common.dll', 1876451485, 3, 4, '668986']}, 'D2DamageStrc': {'dwHitFlags': ['D2Game.dll', 1875465472, 1, 0, '0000'], 'wResultFlags': ['D2Game.dll', 1875465496, 2, 1, '8b7e'], 'wExtra': ['D2Game.dll', 1875257507, 3, 1, '0fbf47'], 'dwPhysDamage': ['D2Game.dll', 1875465786, 2, 1, '8b7d'], 'dwEnhDmgPct': ['D2Game.dll', 1875465781, 3, 1, '804c24'], 'dwFireDamage': ['D2Game.dll', 1875465701, 2, 1, '837e'], 'dwBurnDamage': ['D2Game.dll', 1875465765, 4, 1, '66c74424'], 'dwBurnLen': ['D2Game.dll', 1875465761, 3, 1, '894424'], 'dwLtngDamage': ['D2Game.dll', 1875465860, 3, 1, '8b5c24'], 'dwMagDamage': ['D2Game.dll', 1875466004, 3, 1, '8b5424'], 'dwColdDamage': ['D2Game.dll', 1875466251, 3, 1, '8b4c24'], 'dwPoisDamage': ['D2Game.dll', 1875466391, 3, 1, '8b5c24'], 'dwPoisLen': ['D2Game.dll', 1875465512, 2, 1, '8b6f'], 'dwColdLen': ['D2Game.dll', 1875466171, 3, 1, '8b4424'], 'dwFrzLen': ['D2Game.dll', 1875469652, 3, 1, '8b4424'], 'dwLifeLeech': ['D2Game.dll', 1875247443, 2, 1, '8b6a'], 'dwManaLeech': ['D2Game.dll', 1875469477, 2, 1, '8b45'], 'dwStamLeech': ['D2Game.dll', 1875466418, 3, 1, '8b5424'], 'dwStunLen': ['D2Game.dll', 1875247508, 2, 1, '3b41'], 'dwAbsorbLife': ['D2Game.dll', 1875247653, 3, 1, '894424'], 'dwDmgTotal': ['D2Game.dll', 1875247668, 3, 1, '895424'], 'dwPiercePct': ['D2Game.dll', 1875247676, 3, 1, '894c24'], 'dwDamageRate': ['D2Game.dll', 1875469012, 2, 1, '8b40'], 'dwHitClass': ['D2Game.dll', 1875256862, 2, 1, '8b57'], 'bHitClassActiveSet': ['D2Game.dll', 1875247415, 2, 1, '8b4e'], 'eConvType': ['D2Game.dll', 1875412857, 2, 1, '8a47'], 'dwConvPct': ['D2Game.dll', 1875469632, 3, 1, '8d5424'], 'nOverlays': ['D2Game.dll', 1875249900, 3, 1, '894c24']}, 'D2ActStrc': {'pEnvironment': ['D2Common.dll', 1876478913, 2, 1, '8943'], 'dwTownId': ['D2Common.dll', 1876478889, 2, 1, '894b'], 'dwMapSeed': ['D2Common.dll', 1876478823, 2, 1, '8943'], 'pRoom1': ['D2Common.dll', 1876478796, 3, 1, '8a5424'], 'nAct': ['D2Common.dll', 1876478819, 3, 1, '8b4424'], 'pDrlg': ['D2Common.dll', 1876478905, 2, 1, '8943'], 'pfnActCallBack': ['D2Common.dll', 1876478826, 2, 1, '894b'], 'bInitialized': ['D2Common.dll', 1876235070, 2, 1, '8b50'], 'pMemPool': ['D2Common.dll', 1876478737, 2, 1, '8b4b']}, 'D2EnvironmentStrc': {'dwCycleIndex': ['D2Common.dll', 1876458440, 1, 0, 'c706'], 'nTimeOfDay': ['D2Common.dll', 1876458266, 2, 1, '8b70'], 'dwTicks': ['D2Common.dll', 1876458485, 2, 1, '894e'], 'dwIntensity': ['D2Common.dll', 1876459223, 3, 1, '8b5424'], 'dwInitTick': ['D2Common.dll', 1876458283, 2, 1, '8b40'], 'nLastLight': ['D2Common.dll', 1876458269, 3, 1, '8b4424'], 'bRed': ['D2Common.dll', 1876458353, 2, 1, 'c646'], 'bGreen': ['D2Common.dll', 1876458357, 2, 1, 'c646'], 'bBlue': ['D2Common.dll', 1876458361, 2, 1, 'c646'], 'dwCyclePeriod': ['D2Common.dll', 1876458458, 2, 1, '894e'], 'dwTimeRateIndex': ['D2Common.dll', 1876458437, 2, 1, '8b46'], 'bEclipse': ['D2Common.dll', 1876458453, 2, 1, '8b46'], 'dwPrevTicks': ['D2Common.dll', 1876459135, 2, 1, '8b48']}, 'D2RoomExStrc': {'dwInitSeed': ['D2Common.dll', 1876511520, 3, 1, '8b4424'], 'seedLo': ['D2Common.dll', 1876511538, 2, 1, '8b77'], 'seedHi': ['D2Common.dll', 1876511804, 2, 1, 'c746'], 'pStatusPrev': ['D2Common.dll', 1876513513, 3, 1, '837c24'], 'pTypeData': ['D2Common.dll', 1876511897, 2, 1, '8956'], 'dwFlags': ['D2Common.dll', 1876511833, 2, 1, '814e'], 'pRoom1': ['D2Common.dll', 1876512121, 2, 1, '8b40'], 'nTileXPos': ['D2Common.dll', 1876512262, 2, 1, '8b47'], 'nTileYPos': ['D2Common.dll', 1876512288, 2, 1, '8b47'], 'nTileWidth': ['D2Common.dll', 1876512272, 2, 1, '2b4f'], 'nTileHeight': ['D2Common.dll', 1876512298, 2, 1, '2b4f'], 'nRoomStatus': ['D2Common.dll', 1876511753, 2, 1, 'c646'], 'nType': ['D2Common.dll', 1876511750, 2, 1, '896e'], 'pLevel': ['D2Common.dll', 1876511747, 2, 1, '895e'], 'pLogicalRoomInfo': ['D2Common.dll', 1876237882, 2, 1, '8b78'], 'pStatusNext': ['D2Common.dll', 1876304277, 2, 4, '8bb6']}, 'D2RoomCoordListStrc': {'nBox0PosX': ['D2Common.dll', 1876758727, 1, 0, 'f600'], 'nBox0PosY': ['D2Common.dll', 1876758582, 2, 1, '8946'], 'nEndGameX': ['D2Common.dll', 1876758660, 3, 1, '8b4424'], 'nEndGameY': ['D2Common.dll', 1876758754, 3, 1, '8b5424'], 'nBox1PosX': ['D2Common.dll', 1876758858, 3, 1, '8b4c24'], 'nBox1PosY': ['D2Common.dll', 1876758984, 2, 1, '8951'], 'nEndTileX': ['D2Common.dll', 1876758820, 3, 1, '894c24'], 'nEndTileY': ['D2Common.dll', 1876758762, 2, 1, '8b50'], 'bNode': ['D2Common.dll', 1876758743, 2, 1, '8b70'], 'nIndex': ['D2Common.dll', 1876758930, 2, 1, '8948'], 'pNext': ['D2Common.dll', 1876759265, 2, 1, '8956']}, 'D2RoomCollisionGridStrc': {'nSubtileX': ['D2Common.dll', 1876545671, 1, 0, '8b12'], 'nSubtileY': ['D2Common.dll', 1876545747, 2, 1, '8b50'], 'nSubtileWidth': ['D2Common.dll', 1876545552, 3, 1, '8b4424'], 'nSubtileHeight': ['D2Common.dll', 1876545710, 2, 1, '8b50'], 'nTileX': ['D2Common.dll', 1876545571, 3, 1, '8d4c24'], 'nTileY': ['D2Common.dll', 1876545775, 2, 1, '8b48'], 'nTileWidth': ['D2Common.dll', 1876545592, 4, 1, '0faf6c24'], 'nTileHeight': ['D2Common.dll', 1876545582, 3, 1, '8b4424'], 'pMapStart': ['D2Common.dll', 1876545648, 2, 1, '895a']}}

# Inventory / item / player / Txt-record structs used by the lane A B002+B005+B008+B014 ports
# (record sizes come from the `imul eax, eax, imm32` strides of the D2Common lookups).
STRUCT_SIZE_PE_PROBES.update({
    'D2InventoryStrc': ('D2Common.dll', 0x6FD6E731, 'ba', 1, 4, 1),
    'D2InventoryGridStrc': ('D2Common.dll', 0x6FD6E26E, '8d55', 2, 1, 1),
    'D2CorpseStrc': ('D2Common.dll', 0x6FD6DDF4, 'ba', 1, 4, 1),
    'D2InventoryNodeStrc': ('D2Common.dll', 0x6FD6E53B, 'ba', 1, 4, 1),
    'D2ItemDataStrc': ('D2Common.dll', 0x6FD73C8E, 'ba', 1, 4, 1),
    'D2PlayerDataStrc': ('D2Common.dll', 0x6FD809B8, 'ba', 1, 4, 1),
    'D2MonStatsTxt': ('D2Common.dll', 0x6FD512B8, '69c0', 2, 4, 1),
    'D2MonStats2Txt': ('D2Common.dll', 0x6FD513E5, '69c0', 2, 4, 1),
    'D2SkillsTxt': ('D2Common.dll', 0x6FD51268, '69c0', 2, 4, 1),
    'D2MissilesTxt': ('D2Common.dll', 0x6FD51168, '69c0', 2, 4, 1),
    'D2CharStatsTxt': ('D2Common.dll', 0x6FD512E8, '69c0', 2, 4, 1),
    'D2ItemTypesTxt': ('D2Common.dll', 0x6FD51318, '69c0', 2, 4, 1),
})
FIELD_PE_PROBES.update({
    'D2InventoryStrc': {
        'dwSignature': ['D2Common.dll', 0x6FD6E751, 1, 0, 'c702'],
        'pFirstItem': ['D2Common.dll', 0x6FD6F6D0, 2, 1, '894e'],
        'pLastItem': ['D2Common.dll', 0x6FD6F6A9, 2, 1, '8b46'],
        'pCursorItem': ['D2Common.dll', 0x6FD6DFC5, 2, 1, '8b40'],
        'dwLeftItemGuid': ['D2Common.dll', 0x6FD6DE66, 2, 1, '8b40'],
        'dwItemCount': ['D2Common.dll', 0x6FD6DEA5, 2, 1, '8b40'],
        'pFirstNode': ['D2Common.dll', 0x6FD6DF85, 2, 1, '8b40'],
        'pLastNode': ['D2Common.dll', 0x6FD6DF65, 2, 1, 'c747'],
        'pFirstCorpse': ['D2Common.dll', 0x6FD6DD35, 2, 1, '8b40'],
        'pLastCorpse': ['D2Common.dll', 0x6FD6DD09, 2, 1, 'c747'],
        'nCorpseCount': ['D2Common.dll', 0x6FD6DCC5, 2, 1, '8b40'],
    },
    'D2InventoryGridStrc': {
        'pFirstItem': ['D2Common.dll', 0x6FD6F678, 1, 0, '890e'],
        'pLastItem': ['D2Common.dll', 0x6FD6F651, 2, 1, '8b46'],
        'nGridWidth': ['D2Common.dll', 0x6FD6E37C, 3, 1, '0fb647'],
        'nGridHeight': ['D2Common.dll', 0x6FD6E11E, 3, 1, '0fb67b'],
        'ppItems': ['D2Common.dll', 0x6FD6E38A, 2, 1, '8b4f'],
    },
    'D2CorpseStrc': {
        'bCountAsCorpse': ['D2Common.dll', 0x6FD6DC4B, 1, 0, '8b00'],
        'dwUnitId': ['D2Common.dll', 0x6FD6DC7B, 2, 1, '8b40'],
        'eClass': ['D2Common.dll', 0x6FD6DC5B, 2, 1, '8b40'],
        'pNextCorpse': ['D2Common.dll', 0x6FD6DC9B, 2, 1, '8b40'],
    },
    'D2InventoryNodeStrc': {
        'dwItemId': ['D2Common.dll', 0x6FD6DEBB, 1, 0, '8b00'],
        'pNext': ['D2Common.dll', 0x6FD6DECB, 2, 1, '8b40'],
    },
    'D2ItemDataStrc': {
        'wRarePrefix': ['D2Common.dll', 0x6FD739D9, 3, 1, '668948'],
        'wRareSuffix': ['D2Common.dll', 0x6FD73989, 3, 1, '668948'],
        'wMagicPrefix': ['D2Common.dll', 0x6FD73ADD, 4, 1, '66895448'],
        'wMagicSuffix': ['D2Common.dll', 0x6FD73A2D, 4, 1, '66895448'],
        'nBodyLoc': ['D2Common.dll', 0x6FD73C64, 2, 1, '8a40'],
        'nInvPage': ['D2Common.dll', 0x6FD737B8, 2, 1, '8848'],
        'pExtraOwnerInventory': ['D2Common.dll', 0x6FD6E89F, 2, 1, '83c0'],
    },
    'D2PlayerDataStrc': {
        'dwField150': ['D2Common.dll', 0x6FD51010, 2, 4, 'c781'],
        'dwField154': ['D2Common.dll', 0x6FD51021, 2, 4, '898a'],
        'dwField158': ['D2Common.dll', 0x6FD5102E, 2, 4, '898a'],
        'dwField15C': ['D2Common.dll', 0x6FD5103B, 2, 4, '8982'],
    },
    'D2MonStatsTxt': {
        'wMonStatsEx': ['D2Common.dll', 0x6FD513CE, 4, 1, '0fbf4402'],
    },
    'D2MonStats2Txt': {
        'dwFlags': ['D2Common.dll', 0x6FD514BB, 4, 1, '0fb65402'],
        'dwModeFlags': ['D2Common.dll', 0x6FD5144B, 4, 4, '0fb69402'],
    },
    'D2SkillsTxt': {
        'wMaxLvl': ['D2Common.dll', 0x6FD514EE, 4, 4, '0fbf8401'],
        'dwParam1': ['D2Common.dll', 0x6FD51577, 2, 4, '8b80'],
        'dwParam2': ['D2Common.dll', 0x6FD515A7, 2, 4, '8b80'],
        'dwParam3': ['D2Common.dll', 0x6FD515D7, 2, 4, '8b80'],
        'wSkillDesc': ['D2Common.dll', 0x6FD51524, 3, 4, '0fbf80'],
    },
})

# Lane C (k1r2 B001/B007) additions. Kept as separate statements so parallel lanes can append without
# touching the frozen one-line table above. Each probe cites the instruction whose immediate/displacement is read.
STRUCT_SIZE_PE_PROBES.update({
    'D2DrlgLevelStrc': ('D2Common.dll', 0x6FD7D9CA, 'ba', 1, 4, 1),    # mov edx, 0x230
    'D2DrlgMapStrc': ('D2Common.dll', 0x6FD5BC83, 'ba', 1, 4, 1),      # mov edx, 0x58
    'D2DrlgCoordStrc': ('D2Common.dll', 0x6FD59CF9, '83c1', 2, 1, 1),  # add ecx, 0x10 (pPopsLocation stride)
    'D2LvlPrestTxt': ('D2Common.dll', 0x6FDBC983, '69c0', 2, 4, 1),    # imul eax, eax, 0x1b0
})
FIELD_PE_PROBES['D2DynamicPathStrc'].update({
    'tDirectionVectorX': ['D2Common.dll', 0x6FD5CF11, 2, 1, '8b50'],   # mov edx, [eax+0x6a]
    'tDirectionVectorY': ['D2Common.dll', 0x6FD5CF23, 2, 1, '8b50'],   # mov edx, [eax+0x6e]
    'tVelocityVectorX': ['D2Common.dll', 0x6FD5CF20, 2, 1, '8950'],    # mov [eax+0x72], edx
    'tVelocityVectorY': ['D2Common.dll', 0x6FD5CF2C, 2, 1, '8950'],    # mov [eax+0x76], edx
    'nAccelStepCounter': ['D2Common.dll', 0x6FD5CEC6, 2, 4, '8b90'],   # mov edx, [eax+0x8c]
})
FIELD_PE_PROBES['D2DrlgLevelStrc'] = {
    'nLevelId': ['D2Common.dll', 0x6FD8C011, 2, 4, '8b81'],            # mov eax, [ecx+0x1d0]
}
FIELD_PE_PROBES['D2DrlgMapStrc'] = {
    'nPosX': ['D2Common.dll', 0x6FD59CB9, 2, 1, '8b5e'],               # mov ebx, [esi+0x10]
    'nPosY': ['D2Common.dll', 0x6FD59CC2, 2, 1, '8b6e'],               # mov ebp, [esi+0x14]
    'nPops': ['D2Common.dll', 0x6FD59C6C, 2, 1, '8946'],               # mov [esi+0x40], eax
    'pPopsIndex': ['D2Common.dll', 0x6FD59CDC, 2, 1, '8b46'],          # mov eax, [esi+0x44]
    'pPopsLocation': ['D2Common.dll', 0x6FD59C84, 2, 1, '8b46'],       # mov eax, [esi+0x50]
}
FIELD_PE_PROBES['D2DrlgCoordStrc'] = {
    'nPosX': ['D2Common.dll', 0x6FD59CC0, 1, 0, '89'],                 # mov [eax], ebx (no displacement)
    'nPosY': ['D2Common.dll', 0x6FD59CCB, 2, 1, '8968'],               # mov [eax+0x4], ebp
    'nWidth': ['D2Common.dll', 0x6FD59CD5, 2, 1, '8950'],              # mov [eax+0x8], edx
    'nHeight': ['D2Common.dll', 0x6FD59CD9, 2, 1, '8948'],             # mov [eax+0xc], ecx
}
FIELD_PE_PROBES['D2LvlPrestTxt'] = {
    'dwLevelId': ['D2Common.dll', 0x6FDBC969, 2, 1, '8d4f'],           # lea ecx, [edi+0x4]
}

# Lane B (k1r2 B003/B006) additions.
STRUCT_SIZE_PE_PROBES.update({
    'D2SkillListStrc': ('D2Common.dll', 0x6FD9E401, 'ba', 1, 4, 1),     # mov edx, 0x18
    'D2SkillStrc': ('D2Common.dll', 0x6FD9EF58, 'ba', 1, 4, 1),         # mov edx, 0x40
    'D2LvlTypesTxt': ('D2Common.dll', 0x6FDBC9AC, '69c0', 2, 4, 1),     # imul eax, eax, 0x1b0
    'D2LevelDefBin': ('D2Common.dll', 0x6FDBCB3A, '69c0', 2, 4, 1),     # imul eax, eax, 0x9c
    'D2LevelsTxt': ('D2Common.dll', 0x6FDBCCDC, '69c0', 2, 4, 1),       # imul eax, eax, 0x220
    'D2AStarNodeStrc': ('D2Common.dll', 0x6FDCB125, '6bc9', 2, 1, 1),   # imul ecx, ecx, 0x38
})
FIELD_PE_PROBES['D2RoomExStrc'].update({
    'ppRoomsNear': ['D2Common.dll', 0x6FDCBB31, 2, 1, '8b45'],          # mov eax, [ebp+0x8]
    'wStatusCount': ['D2Common.dll', 0x6FDCBB3E, 4, 1, '66ff4c46'],     # dec word [esi+eax*2+0xc]
    'nRoomsNear': ['D2Common.dll', 0x6FDCBB24, 2, 1, '8b45'],           # mov eax, [ebp+0x2c]
})
FIELD_PE_PROBES['D2SkillsTxt'].update({
    'wSkillId': ['D2Common.dll', 0x6FD9E1DD, 2, 0, '0fbf'],             # movsx eax, word [eax]
})
FIELD_PE_PROBES['D2MissilesTxt'] = {
    'nSubLoop': ['D2Common.dll', 0x6FDCC4CE, 3, 4, '0fb689'],           # movzx ecx, byte [ecx+0x9a]
    'nSubStart': ['D2Common.dll', 0x6FDCC4C2, 3, 4, '0fb681'],          # movzx eax, byte [ecx+0x9b]
}
FIELD_PE_PROBES['D2DrlgLevelStrc'].update({
    'pDrlg': ['D2Common.dll', 0x6FDCBBB1, 2, 4, '8b89'],                # mov ecx, [ecx+0x1b4]
})
FIELD_PE_PROBES['D2SkillListStrc'] = {
    'pMemPool': ['D2Common.dll', 0x6FD9E411, 1, 0, '89'],               # mov [edx], ecx
    'pFirstSkill': ['D2Common.dll', 0x6FD9E3DB, 2, 1, '8b40'],          # mov eax, [eax+0x4]
    'pLeftSkill': ['D2Common.dll', 0x6FD9E18B, 2, 1, '8b40'],           # mov eax, [eax+0x8]
    'pRightSkill': ['D2Common.dll', 0x6FD9E419, 2, 1, '894a'],          # mov [edx+0xc], ecx
    'pUsedSkill': ['D2Common.dll', 0x6FD9E41C, 2, 1, '894a'],           # mov [edx+0x10], ecx
    'dwFlags': ['D2Common.dll', 0x6FD9E41F, 2, 1, '894a'],              # mov [edx+0x14], ecx
}
FIELD_PE_PROBES['D2SkillStrc'] = {
    'pSkillsTxt': ['D2Common.dll', 0x6FD9E1DB, 1, 0, '8b'],             # mov eax, [eax]
    'pNextSkill': ['D2Common.dll', 0x6FD9E3BB, 2, 1, '8b40'],           # mov eax, [eax+0x4]
    'nSlotIndex': ['D2Common.dll', 0x6FD9E1B5, 2, 1, '8941'],           # mov [ecx+0x8], eax
    'nSkillLevel': ['D2Common.dll', 0x6FD9E4B6, 2, 1, '8b79'],          # mov edi, [ecx+0x28]
    'nOwnerItemGuid': ['D2Common.dll', 0x6FD9E4AC, 2, 1, '3951'],       # cmp [ecx+0x34], edx
    'dwFlags': ['D2Common.dll', 0x6FD9E4A1, 2, 1, '8b79'],              # mov edi, [ecx+0x3c]
}
FIELD_PE_PROBES['D2LevelDefBin'] = {
    'dwLayer': ['D2Common.dll', 0x6FDBCB6F, 2, 4, '8d8d'],              # lea ecx, [ebp+0x8c]
}
FIELD_PE_PROBES['D2LevelsTxt'] = {
    'nAct': ['D2Common.dll', 0x6FDBCCB2, 3, 1, '8a4401'],               # mov al, [ecx+eax+0x5]
    'nTeleport': ['D2Common.dll', 0x6FDBCC52, 3, 1, '8a4401'],          # mov al, [ecx+eax+0x6]
    'nRain': ['D2Common.dll', 0x6FDBCC82, 3, 1, '8a4401'],              # mov al, [ecx+eax+0x7]
}

# Lane C (k1r2 B004/B016) additions.
STRUCT_SIZE_PE_PROBES.update({
    'D2DrlgOrthStrc': ('D2Common.dll', 0x6FD94986, 'ba', 1, 4, 1),     # mov edx, 0x18
    'D2DrlgTileGridStrc': ('D2Common.dll', 0x6FDB8143, 'ba', 1, 4, 1), # mov edx, 0x2c
    'D2DrlgTileLinkStrc': ('D2Common.dll', 0x6FDB996C, 'ba', 1, 4, 1), # mov edx, 0x0c
    'D2DrlgTileDataStrc': ('D2Common.dll', 0x6FDB9340, '83c6', 2, 1, 1), # add esi, 0x30
    'D2IdaStarNodeStrc': ('D2Common.dll', 0x6FDC0773, '6bc0', 2, 1, 1), # imul eax, eax, 0x1c
    'D2AStarNodeStrc': ('D2Common.dll', 0x6FDCAC22, '6bd2', 2, 1, 1),   # imul edx, edx, 0x38
})
FIELD_PE_PROBES['D2DynamicPathStrc'].update({
    'dwVelocityChangeCounter': ['D2Common.dll', 0x6FD84D51, 2, 1, 'c740'], # mov dword [eax+0x38], 0xf
})
FIELD_PE_PROBES['D2RoomExStrc'].update({
    'pRoomNext': ['D2Common.dll', 0x6FD94F02, 2, 1, '8b52'],           # mov edx, [edx+0x24]
    'pTileGrid': ['D2Common.dll', 0x6FDB81A0, 2, 1, '8b46'],           # mov eax, [esi+0x54]
})
FIELD_PE_PROBES['D2MonStatsTxt'].update({
    'nBitField1': ['D2Common.dll', 0x6FD8513F, 2, 1, '8a40'],          # mov al, [eax+0xc]
    'nBitField2': ['D2Common.dll', 0x6FD85131, 2, 1, '8a50'],          # mov dl, [eax+0xd]
})
FIELD_PE_PROBES['D2DrlgLevelStrc'].update({
    'pFirstRoomEx': ['D2Common.dll', 0x6FD94EB0, 2, 1, '8b50'],        # mov edx, [eax+0x10]
})
FIELD_PE_PROBES['D2DrlgOrthStrc'] = {
    'nDirection': ['D2Common.dll', 0x6FD94870, 2, 1, '8b41'],          # mov eax, [ecx+0x4]
    'pBox': ['D2Common.dll', 0x6FD94889, 2, 1, '8b42'],                # mov eax, [edx+0x10]
}
FIELD_PE_PROBES['D2DrlgTileGridStrc'] = {
    'pMapLinks': ['D2Common.dll', 0x6FDB81E5, 1, 0, '8b38'],           # mov edi, [eax]
    'nWallCapacity': ['D2Common.dll', 0x6FDB8B72, 2, 1, '8b56'],       # mov edx, [esi+0x18]
    'nFloorCapacity': ['D2Common.dll', 0x6FDB8054, 2, 1, '8b46'],      # mov eax, [esi+0x20]
    'nRoofCapacity': ['D2Common.dll', 0x6FDB82CA, 2, 1, '3946'],       # cmp [esi+0x28], eax
}
FIELD_PE_PROBES['D2DrlgTileLinkStrc'] = {
    'bFloor': ['D2Common.dll', 0x6FDB9976, 1, 0, 'c700'],              # mov dword [eax], 1
    'pTileData': ['D2Common.dll', 0x6FDB81F6, 2, 1, '8b47'],           # mov eax, [edi+0x4]
    'pNext': ['D2Common.dll', 0x6FDB8269, 2, 1, '8b7f'],               # mov edi, [edi+0x8]
}
FIELD_PE_PROBES['D2DrlgTileDataStrc'] = {
    'nPosX': ['D2Common.dll', 0x6FDB8210, 2, 1, '8b48'],               # mov ecx, [eax+0x8]
    'nPosY': ['D2Common.dll', 0x6FDB821D, 2, 1, '8b68'],               # mov ebp, [eax+0xc]
    'dwFlags': ['D2Common.dll', 0x6FDB8240, 2, 1, '8b48'],             # mov ecx, [eax+0x14]
    'nTileType': ['D2Common.dll', 0x6FDB822B, 2, 1, '8b48'],           # mov ecx, [eax+0x1c]
    'pNext': ['D2Common.dll', 0x6FDB825E, 2, 1, '8b40'],               # mov eax, [eax+0x20]
}
FIELD_PE_PROBES['D2IdaStarNodeStrc'] = {
    'wPosX': ['D2Common.dll', 0x6FDC0696, 3, 1, '0fb751'],             # movzx edx, word [ecx+0x8]
    'wPosY': ['D2Common.dll', 0x6FDC06A0, 3, 1, '0fb771'],             # movzx esi, word [ecx+0xa]
    'pBestDirection': ['D2Common.dll', 0x6FDC0809, 2, 1, '8b4e'],      # mov ecx, [esi+0xc]
    'nNextNeighborIndex': ['D2Common.dll', 0x6FDC080E, 2, 1, '8b4e'],  # mov ecx, [esi+0x10]
    'pParent': ['D2Common.dll', 0x6FDC0685, 2, 1, '8b51'],             # mov edx, [ecx+0x14]
}
FIELD_PE_PROBES['D2AStarNodeStrc'] = {
    'wPosX': ['D2Common.dll', 0x6FDCAB95, 2, 0, '0fb711'],             # movzx edx, word [ecx]
    'wPosY': ['D2Common.dll', 0x6FDCAB9E, 3, 1, '0fb771'],             # movzx esi, word [ecx+0x2]
    'wFScore': ['D2Common.dll', 0x6FDCAE54, 3, 1, '0fbf46'],           # movsx eax, word [esi+0x4]
    'wHScore': ['D2Common.dll', 0x6FDCACC4, 3, 1, '668b7a'],           # mov di, [edx+0x6]
    'wGScore': ['D2Common.dll', 0x6FDCACB7, 3, 1, '668b71'],           # mov si, [ecx+0x8]
    'pParent': ['D2Common.dll', 0x6FDCAB85, 2, 1, '8b51'],             # mov edx, [ecx+0xc]
    'pChildren': ['D2Common.dll', 0x6FDCB088, 2, 1, '8b4b'],           # mov ecx, [ebx+0x10]
    'pHashNext': ['D2Common.dll', 0x6FDCAE4E, 2, 1, '8956'],           # mov [esi+0x30], edx
    'pBestNext': ['D2Common.dll', 0x6FDCAE6A, 2, 1, '8b49'],           # mov ecx, [ecx+0x34]
}

# Iteration 3 (Lane A B011/B017 + Lane B B009/B012 + Lane C B010/B013) additions.
STRUCT_SIZE_PE_PROBES.update({
    'D2HoverTextStrc': ('D2Common.dll', 0x6FD682BE, 'ba', 1, 4, 1),          # mov edx, 0x110
    'D2DrlgWarpStrc': ('D2Common.dll', 0x6FD7D786, 'ba', 1, 4, 1),           # mov edx, 0x48
    'D2AnimSeqTxt': ('D2Common.dll', 0x6FD7E77B, '83c2', 2, 1, 1),           # add edx, 0x6
    'D2ObjectDataStrc': ('D2Game.dll', 0x6FC4FC4D, 'ba', 1, 4, 1),           # mov edx, 0x38
    'D2ObjectsTxt': ('D2Common.dll', 0x6FD8E9BC, '69c0', 2, 4, 1),           # imul eax, eax, 0x1c0
    'D2DrlgVertexStrc': ('D2Common.dll', 0x6FD8D99C, 'ba', 1, 4, 1),         # mov edx, 0x14
    'D2DrlgStrc': ('D2Common.dll', 0x6FD7E3F7, 'ba', 1, 4, 1),               # mov edx, 0x48c
    'D2DrlgLevelLinkDataStrc': ('D2Common.dll', 0x6FD62895, '81ec', 2, 4, 1), # sub esp, 0x1f4
    'D2DrlgOutdoorInfoStrc': ('D2Common.dll', 0x6FD7DA8E, 'ba', 1, 4, 1),     # mov edx, 0x268
    'D2HirelingTxt': ('D2Common.dll', 0x6FDA30AB, '69c0', 2, 4, 1),           # imul eax, eax, 0x118
    'D2SuperUniquesTxt': ('D2Common.dll', 0x6FDA3387, '6bc0', 2, 1, 1),       # imul eax, eax, 0x34
    'D2TreasureClassExStrc': ('D2Common.dll', 0x6FDA343D, '6bc0', 2, 1, 1),   # imul eax, eax, 0x2c
    'D2StaticPathStrc': ('D2Common.dll', 0x6FD8D99C, 'ba', 1, 4, 1),          # mov edx, 0x14
    'D2DrlgGridStrc': ('D2Common.dll', 0x6FD5A4BC, '83c6', 2, 1, 1),          # add esi, 0x14
    'D2PresetUnitStrc': ('D2Common.dll', 0x6FD5A54C, 'ba', 1, 4, 1),          # mov edx, 0x20
    'D2RoomLogicalInfoStrc': ('D2Common.dll', 0x6FDD1CD5, 'ba', 1, 4, 1),     # mov edx, 0x34
})
FIELD_PE_PROBES['D2RoomExStrc'].update({
    'pPresetUnits': ['D2Common.dll', 0x6FD5A416, 2, 1, '8b53'],               # mov edx, [ebx+0x5c]
})
FIELD_PE_PROBES['D2MonStatsTxt'].update({
    'nSubClassCount': ['D2Common.dll', 0x6FDA3877, 4, 1, '0fb65432'],         # movzx edx, byte [edx+esi+0x4a]
    'nSubClassIndex': ['D2Common.dll', 0x6FDA3894, 4, 1, '0fb65432'],         # movzx edx, byte [edx+esi+0x4b]
})
FIELD_PE_PROBES['D2SkillsTxt'].update({
    'nCharClass': ['D2Common.dll', 0x6FD9E8E8, 2, 1, '8a40'],                 # mov al, [eax+0xc]
    'wPassiveState': ['D2Common.dll', 0x6FD9F108, 3, 4, '668b80'],            # mov ax, [eax+0x94]
    'wReqLevel': ['D2Common.dll', 0x6FD9EB30, 3, 4, '0fbf80'],                # movsx eax, word [eax+0x174]
    'nManaShift': ['D2Common.dll', 0x6FD9EA43, 2, 4, '8a89'],                 # mov cl, [ecx+0x188]
    'wMana': ['D2Common.dll', 0x6FD9EA3C, 3, 4, '0fbf91'],                    # movsx edx, word [ecx+0x18a]
    'wLvlMana': ['D2Common.dll', 0x6FD9EA2D, 3, 4, '0fbf81'],                 # movsx eax, word [ecx+0x18c]
})
FIELD_PE_PROBES['D2MissilesTxt'].update({
    'dwELen': ['D2Common.dll', 0x6FDB9DF5, 2, 4, '8b80'],                     # mov eax, [eax+0x11c]
    'dwELevLen1': ['D2Common.dll', 0x6FDB9E16, 2, 4, '8b90'],                 # mov edx, [eax+0x120]
    'dwELevLen2': ['D2Common.dll', 0x6FDB9E03, 2, 4, '8b90'],                 # mov edx, [eax+0x124]
    'dwELevLen3': ['D2Common.dll', 0x6FDB9E0C, 3, 4, '0faf88'],               # imul ecx, [eax+0x128]
})
FIELD_PE_PROBES['D2DrlgLevelStrc'].update({
    'nRooms': ['D2Common.dll', 0x6FD7D420, 2, 1, '8b42'],                     # mov eax, [edx+0x8]
    'pOutdoors': ['D2Common.dll', 0x6FD92270, 2, 1, '8b41'],                  # mov eax, [ecx+0x14]
    'nPosX': ['D2Common.dll', 0x6FD7D700, 2, 1, '8b75'],                      # mov esi, [ebp+0x1c]
    'nPosY': ['D2Common.dll', 0x6FD7D70D, 2, 1, '8b75'],                      # mov esi, [ebp+0x20]
    'nWidth': ['D2Common.dll', 0x6FD7D6BA, 2, 1, '8b75'],                     # mov esi, [ebp+0x24]
    'nHeight': ['D2Common.dll', 0x6FD7D6D5, 2, 1, '8b7d'],                    # mov edi, [ebp+0x28]
    'pNextLevel': ['D2Common.dll', 0x6FD7D5E0, 2, 4, '8b80'],                 # mov eax, [eax+0x1ac]
    'sSeed': ['D2Common.dll', 0x6FD92466, 2, 4, '8b86'],                      # mov eax, [esi+0x1c4]
    'pRoomWarpFlags': ['D2Common.dll', 0x6FD7D427, 2, 4, '8b82'],             # mov eax, [edx+0x22c]
})
FIELD_PE_PROBES['D2DrlgMapStrc'].update({
    'pPresetUnit': ['D2Common.dll', 0x6FD5A3A0, 2, 1, '8b45'],                # mov eax, [ebp+0x38]
})
FIELD_PE_PROBES['D2LevelDefBin'].update({
    'dwOffsetX': ['D2Common.dll', 0x6FD90F98, 2, 1, '8b70'],                  # mov esi, [eax+0x24]
    'dwOffsetY': ['D2Common.dll', 0x6FD90FA8, 2, 1, '8b40'],                  # mov eax, [eax+0x28]
})
FIELD_PE_PROBES['D2LevelsTxt'].update({
    'nWaypoint': ['D2Common.dll', 0x6FDB7E82, 4, 4, '660fb680'],             # movzx ax, byte [eax+0xe4]
})
FIELD_PE_PROBES['D2DrlgTileGridStrc'].update({
    'pWalls': ['D2Common.dll', 0x6FDD1A2E, 2, 1, '83c0'],                     # add eax, 0x14
})
FIELD_PE_PROBES['D2DrlgTileDataStrc'].update({
    'pRoomCoordList': ['D2Common.dll', 0x6FDD1A95, 2, 1, '8948'],             # mov [eax+0x10], ecx
})
FIELD_PE_PROBES['D2HoverTextStrc'] = {
    'dwDisplayTime': ['D2Common.dll', 0x6FD68254, 1, 0, '8b00'],             # mov eax, [eax]
    'dwExpireTime': ['D2Common.dll', 0x6FD68244, 2, 1, '8b40'],              # mov eax, [eax+0x4]
    'nLangId': ['D2Common.dll', 0x6FD681F4, 2, 1, '8a40'],                   # mov al, [eax+0x8]
    'bUsed': ['D2Common.dll', 0x6FD68214, 2, 1, '8b40'],                     # mov eax, [eax+0xc]
    'szMsg': ['D2Common.dll', 0x6FD68228, 2, 1, '83c0'],                     # add eax, 0x10
}
FIELD_PE_PROBES['D2DrlgWarpStrc'] = {
    'nLevel': ['D2Common.dll', 0x6FD7D790, 1, 0, '8918'],                    # mov [eax], ebx
    'nVis': ['D2Common.dll', 0x6FD7D216, 2, 1, '8d50'],                      # lea edx, [eax+0x4]
    'nWarp': ['D2Common.dll', 0x6FD7D23D, 2, 1, '8d50'],                     # lea edx, [eax+0x24]
    'pNext': ['D2Common.dll', 0x6FD7D7FE, 2, 1, '8948'],                     # mov [eax+0x44], ecx
}
FIELD_PE_PROBES['D2AnimSeqTxt'] = {
    'wSequence': ['D2Common.dll', 0x6FDA53BE, 2, 0, '0fbf02'],                # movsx eax, word [edx]
    'nMode': ['D2Common.dll', 0x6FD7E71A, 3, 1, '0fb64a'],                   # movzx ecx, byte [edx+0x2]
    'nFrame': ['D2Common.dll', 0x6FD7E720, 3, 1, '0fb64a'],                  # movzx ecx, byte [edx+0x3]
    'nDir': ['D2Common.dll', 0x6FD7E72A, 3, 1, '0fb64a'],                    # movzx ecx, byte [edx+0x4]
    'nEvent': ['D2Common.dll', 0x6FD7E73C, 3, 1, '0fb652'],                  # movzx edx, byte [edx+0x5]
}
FIELD_PE_PROBES['D2ObjectDataStrc'] = {
    'pObjectTxt': ['D2Common.dll', 0x6FD7ED3C, 1, 0, '8b08'],                # mov ecx, [eax]
}
FIELD_PE_PROBES['D2ObjectsTxt'] = {
    'nSubClass': ['D2Common.dll', 0x6FD7ED3E, 2, 4, '8a91'],                 # mov dl, [ecx+0x167]
}
FIELD_PE_PROBES['D2DrlgVertexStrc'] = {
    'nPosX': ['D2Common.dll', 0x6FD8D4A0, 1, 0, '8b02'],                     # mov eax, [edx]
    'nPosY': ['D2Common.dll', 0x6FD8D4A8, 2, 1, '8b42'],                     # mov eax, [edx+0x4]
    'nDirection': ['D2Common.dll', 0x6FD8D4B1, 3, 1, '0fb652'],              # movzx edx, byte [edx+0x8]
    'dwFlags': ['D2Common.dll', 0x6FD8D9B2, 2, 1, '894a'],                   # mov [edx+0xc], ecx
    'pNext': ['D2Common.dll', 0x6FD8D9B5, 2, 1, '894a'],                     # mov [edx+0x10], ecx
}
FIELD_PE_PROBES['D2DrlgStrc'] = {
    'dwFlags': ['D2Common.dll', 0x6FD7E43D, 2, 4, '8996'],                   # mov [esi+0x8c], edx
    'nBossTombLevel': ['D2Common.dll', 0x6FD8B08F, 2, 4, '8b80'],            # mov eax, [eax+0x94]
    'pWarpList0Prev': ['D2Common.dll', 0x6FDCB8D6, 2, 4, '8988'],            # mov [eax+0xbc], ecx
    'nWarpAct0': ['D2Common.dll', 0x6FDCB90C, 2, 4, 'c680'],                 # mov byte [eax+0xe4], 0
    'pWarpList0Next': ['D2Common.dll', 0x6FDCB8DC, 2, 4, '8988'],            # mov [eax+0x188], ecx
    'pMemPool': ['D2Common.dll', 0x6FD7E422, 2, 4, '8986'],                  # mov [esi+0x478], eax
    'pLevel': ['D2Common.dll', 0x6FD7D5B0, 2, 4, '8b80'],                    # mov eax, [eax+0x47c]
}
FIELD_PE_PROBES['D2DrlgLevelLinkDataStrc'] = {
    'seedLo': ['D2Common.dll', 0x6FD90E25, 1, 0, '8b01'],                     # mov eax, [ecx]
    'seedHi': ['D2Common.dll', 0x6FD90E27, 2, 1, '8b79'],                     # mov edi, [ecx+0x4]
    'nPosX': ['D2Common.dll', 0x6FD90EDD, 3, 1, '897408'],                    # mov [eax+ecx+0x8], esi
    'nPosY': ['D2Common.dll', 0x6FD90EEF, 3, 1, '895408'],                    # mov [eax+ecx+0xc], edx
    'nWidth': ['D2Common.dll', 0x6FD90EC1, 3, 1, 'c74408'],                   # mov dword [eax+ecx+0x10], 0
    'nHeight': ['D2Common.dll', 0x6FD90EC9, 3, 1, 'c74408'],                  # mov dword [eax+ecx+0x14], 0
    'pLink': ['D2Common.dll', 0x6FD90E81, 2, 4, '8b91'],                      # mov edx, [ecx+0xf8]
    'nRand0': ['D2Common.dll', 0x6FD90E53, 3, 4, '899481'],                   # mov [ecx+eax*4+0xfc], edx
    'nRand1': ['D2Common.dll', 0x6FD90E18, 3, 4, '8b84b1'],                   # mov eax, [ecx+esi*4+0x138]
    'nIteration': ['D2Common.dll', 0x6FD90E12, 2, 4, '8bb1'],                 # mov esi, [ecx+0x1ec]
    'nCurrentLevel': ['D2Common.dll', 0x6FD90F68, 2, 4, '8b81'],              # mov eax, [ecx+0x1f0]
}
FIELD_PE_PROBES['D2DrlgOutdoorInfoStrc'] = {
    'dwFlags': ['D2Common.dll', 0x6FDCE9C0, 1, 0, '830f'],                    # or dword [edi], 2
    'pGrid0Cells': ['D2Common.dll', 0x6FDCEA5A, 2, 1, '8b51'],                # mov edx, [ecx+0x4]
    'pGrid0RowOffsets': ['D2Common.dll', 0x6FDCEA53, 2, 1, '8b69'],           # mov ebp, [ecx+0x8]
    'pGrid2Cells': ['D2Common.dll', 0x6FDCEA06, 2, 1, '8b68'],                # mov ebp, [eax+0x2c]
    'pGrid2RowOffsets': ['D2Common.dll', 0x6FDCEA00, 2, 1, '8b78'],           # mov edi, [eax+0x30]
    'nGridWidth': ['D2Common.dll', 0x6FDCEA46, 2, 1, '8b71'],                 # mov esi, [ecx+0x5c]
    'nGridHeight': ['D2Common.dll', 0x6FDCE9F5, 2, 1, '8b70'],                # mov esi, [eax+0x60]
    'pVertex': ['D2Common.dll', 0x6FDCE8CA, 2, 1, '8b47'],                    # mov eax, [edi+0x64]
}
FIELD_PE_PROBES['D2HirelingTxt'] = {
    'wVersion': ['D2Common.dll', 0x6FDA30C9, 2, 0, '663908'],                 # cmp [eax], cx
    'dwSubTypeId': ['D2Common.dll', 0x6FDA3320, 2, 1, '8b51'],                # mov edx, [ecx+0x4]
    'dwClass': ['D2Common.dll', 0x6FDA31E2, 2, 1, '3958'],                    # cmp [eax+0x8], ebx
    'dwDifficulty': ['D2Common.dll', 0x6FDA30B1, 3, 1, '8d5418'],             # lea edx, [eax+ebx+0x10]
    'dwHirelingLevel': ['D2Common.dll', 0x6FDA3090, 2, 1, '8b77'],            # mov esi, [edi+0x1c]
    'wNameFirst': ['D2Common.dll', 0x6FDA978C, 4, 4, '6689840f'],             # mov [edi+ecx+0x114], ax
    'wNameLast': ['D2Common.dll', 0x6FDA3271, 3, 4, '8d8418'],                # lea eax, [eax+ebx+0x116]
}
FIELD_PE_PROBES['D2SuperUniquesTxt'] = {}
FIELD_PE_PROBES['D2TreasureClassExStrc'] = {
    'wGroup': ['D2Common.dll', 0x6FDA344B, 2, 0, '668b10'],                   # mov dx, [eax]
    'wLevel': ['D2Common.dll', 0x6FDA3460, 3, 1, '0fbf51'],                   # movsx edx, word [ecx+0x2]
}
FIELD_PE_PROBES['D2StaticPathStrc'] = {
    'nPosX': ['D2Common.dll', 0x6FDCF60A, 2, 1, '8b72'],                      # mov esi, [edx+0xc]
    'nPosY': ['D2Common.dll', 0x6FDCF636, 2, 1, '8b52'],                      # mov edx, [edx+0x10]
}
FIELD_PE_PROBES['D2DrlgGridStrc'] = {
    'pCells': ['D2Common.dll', 0x6FD8680D, 1, 0, '89'],                       # mov [ecx], edx
    'pRowOffsets': ['D2Common.dll', 0x6FD86813, 2, 1, '8951'],                # mov [ecx+0x4], edx
    'nWidth': ['D2Common.dll', 0x6FD867F3, 2, 1, '8951'],                     # mov [ecx+0x8], edx
    'nHeight': ['D2Common.dll', 0x6FD867F9, 2, 1, '8951'],                    # mov [ecx+0xc], edx
    'bInitialized': ['D2Common.dll', 0x6FD86832, 2, 1, 'c741'],               # mov dword [ecx+0x10], 1
}
FIELD_PE_PROBES['D2PresetUnitStrc'] = {
    'nUnitType': ['D2Common.dll', 0x6FD5A597, 1, 0, 'c700'],                  # mov dword [eax], 0
    'nIndex': ['D2Common.dll', 0x6FD5A579, 2, 1, '8948'],                     # mov [eax+0x4], ecx
    'nXpos': ['D2Common.dll', 0x6FD5A3C0, 2, 1, '8b48'],                      # mov ecx, [eax+0x8]
    'pNext': ['D2Common.dll', 0x6FD5A431, 2, 1, '8b40'],                      # mov eax, [eax+0xc]
    'nMode': ['D2Common.dll', 0x6FD5A590, 2, 1, 'c740'],                      # mov dword [eax+0x14], 2
    'nYpos': ['D2Common.dll', 0x6FD5A3C9, 2, 1, '8b50'],                      # mov edx, [eax+0x18]
    'dwFlags': ['D2Common.dll', 0x6FD5A583, 2, 1, '8b48'],                    # mov ecx, [eax+0x1c]
}
FIELD_PE_PROBES['D2RoomLogicalInfoStrc'] = {
    'dwFlags': ['D2Common.dll', 0x6FDD1D02, 1, 0, '8b13'],                    # mov edx, [ebx]
    'pIndexCells': ['D2Common.dll', 0x6FDD1A8F, 2, 1, '8b56'],                # mov edx, [esi+0x1c]
    'pIndexRowOffsets': ['D2Common.dll', 0x6FDD1A85, 2, 1, '8b7e'],           # mov edi, [esi+0x20]
    'pCoordList': ['D2Common.dll', 0x6FDD197B, 2, 1, '8b41'],                 # mov eax, [ecx+0x30]
}

# Iteration 4 Lane A (B020 + B023) additions.
STRUCT_SIZE_PE_PROBES.update({
    'D2StatesTxt': ('D2Common.dll', 0x6FD51788, '6bc0', 2, 1, 1),             # imul eax, eax, 0x3c
    'D2ItemStatCostTxt': ('D2Common.dll', 0x6FD517B8, '69c0', 2, 4, 1),       # imul eax, eax, 0x144
    'D2SetsTxt': ('D2Common.dll', 0x6FD517E8, '69c0', 2, 4, 1),               # imul eax, eax, 0x128
    'D2SetItemsTxt': ('D2Common.dll', 0x6FD51818, '69c0', 2, 4, 1),           # imul eax, eax, 0x1b8
    'D2UniqueItemsTxt': ('D2Common.dll', 0x6FD51848, '69c0', 2, 4, 1),        # imul eax, eax, 0x14c
    'D2MissileDataStrc': ('D2Common.dll', 0x6FDBA3B2, 'ba', 1, 4, 1),         # mov edx, 0x34
    'D2MissileDamageDataStrc': ('D2Common.dll', 0x6FDBBAAB, 'b9', 1, 4, 4),   # mov ecx, 0x1f; rep stosd
})
FIELD_PE_PROBES['D2MonStatsTxt'].update({
    'wBaseId': ['D2Common.dll', 0x6FD51891, 3, 1, '0fbf40'],                  # movsx eax, word [eax+0x2]
    'wNextInClass': ['D2Common.dll', 0x6FD51966, 3, 1, '0fbf41'],             # movsx eax, word [ecx+0x4]
})
FIELD_PE_PROBES['D2SkillsTxt'].update({
    'dwParam4': ['D2Common.dll', 0x6FD51607, 2, 4, '8b80'],                   # mov eax, [eax+0x154]
    'dwParam5': ['D2Common.dll', 0x6FD51637, 2, 4, '8b80'],                   # mov eax, [eax+0x158]
    'dwParam6': ['D2Common.dll', 0x6FD51667, 2, 4, '8b80'],                   # mov eax, [eax+0x15c]
    'dwParam7': ['D2Common.dll', 0x6FD51767, 2, 4, '0381'],                   # add eax, [ecx+0x160]
    'dwParam8': ['D2Common.dll', 0x6FD51760, 3, 4, '0faf81'],                 # imul eax, [ecx+0x164]
})
FIELD_PE_PROBES['D2MissilesTxt'].update({
    'dwMissileFlags': ['D2Common.dll', 0x6FDBA174, 2, 1, '8a40'],             # mov al, [eax+0x4]
    'nActivate': ['D2Common.dll', 0x6FDBA084, 3, 4, '0fb680'],                # movzx eax, byte [eax+0x94]
    'nHitShift': ['D2Common.dll', 0x6FDB9E9D, 2, 4, '8a80'],                  # mov al, [eax+0xe4]
})
FIELD_PE_PROBES['D2StatesTxt'] = {}
FIELD_PE_PROBES['D2ItemStatCostTxt'] = {}
FIELD_PE_PROBES['D2SetsTxt'] = {}
FIELD_PE_PROBES['D2SetItemsTxt'] = {}
FIELD_PE_PROBES['D2UniqueItemsTxt'] = {}
FIELD_PE_PROBES['D2MissileDataStrc'] = {
    'nAdditionalFrames': ['D2Common.dll', 0x6FDBA0F4, 3, 1, '0fbf40'],         # movsx eax, word [eax+0x4]
    'nLatestFrame': ['D2Common.dll', 0x6FDBA0B4, 3, 1, '0fbf40'],              # movsx eax, word [eax+0x6]
    'nActivateFrame': ['D2Common.dll', 0x6FDBA044, 3, 1, '0fbf40'],            # movsx eax, word [eax+0x8]
    'nSkill': ['D2Common.dll', 0x6FDBA2C4, 3, 1, '0fbf40'],                    # movsx eax, word [eax+0xa]
    'nLevel': ['D2Common.dll', 0x6FDBA2E4, 3, 1, '0fbf40'],                    # movsx eax, word [eax+0xc]
    'nTotalFrames': ['D2Common.dll', 0x6FDBA2A4, 3, 1, '0fbf40'],              # movsx eax, word [eax+0xe]
    'nRemainingFrames': ['D2Common.dll', 0x6FDBA284, 3, 1, '0fbf40'],          # movsx eax, word [eax+0x10]
    'dwStreamFlags': ['D2Common.dll', 0x6FDBA344, 2, 1, '8b40'],               # mov eax, [eax+0x14]
    'nOwnerType': ['D2Common.dll', 0x6FDBA18B, 2, 1, '3948'],                  # cmp [eax+0x18], ecx
    'dwOwnerId': ['D2Common.dll', 0x6FDBA193, 2, 1, '3948'],                   # cmp [eax+0x1c], ecx
    'nTargetX': ['D2Common.dll', 0x6FDB9FA4, 2, 1, '8b40'],                    # mov eax, [eax+0x28]
    'nTargetY': ['D2Common.dll', 0x6FDB9F64, 2, 1, '8b40'],                    # mov eax, [eax+0x2c]
}
FIELD_PE_PROBES['D2MissileDamageDataStrc'] = {
    'nFireMinDamage': ['D2Common.dll', 0x6FDB9C6C, 2, 1, '8b41'],             # mov eax, [ecx+0xc]
    'nFireMaxDamage': ['D2Common.dll', 0x6FDB9C7E, 2, 1, '8b41'],             # mov eax, [ecx+0x10]
    'nLtngMinDamage': ['D2Common.dll', 0x6FDB9C90, 2, 1, '8b41'],             # mov eax, [ecx+0x18]
    'nLtngMaxDamage': ['D2Common.dll', 0x6FDB9CA2, 2, 1, '8b41'],             # mov eax, [ecx+0x1c]
    'nMagMinDamage': ['D2Common.dll', 0x6FDB9CB4, 2, 1, '8b41'],              # mov eax, [ecx+0x20]
    'nMagMaxDamage': ['D2Common.dll', 0x6FDB9CC6, 2, 1, '8b41'],              # mov eax, [ecx+0x24]
    'nColdMinDamage': ['D2Common.dll', 0x6FDB9CD8, 2, 1, '8b41'],             # mov eax, [ecx+0x28]
    'nColdMaxDamage': ['D2Common.dll', 0x6FDB9CEA, 2, 1, '8b41'],             # mov eax, [ecx+0x2c]
    'nColdLength': ['D2Common.dll', 0x6FDB9CFC, 2, 1, '8b41'],                # mov eax, [ecx+0x30]
    'nPoisMinDamage': ['D2Common.dll', 0x6FDB9D0E, 2, 1, '8b41'],             # mov eax, [ecx+0x34]
    'nPoisMaxDamage': ['D2Common.dll', 0x6FDB9D20, 2, 1, '8b41'],             # mov eax, [ecx+0x38]
    'nPoisCount': ['D2Common.dll', 0x6FDB9D32, 2, 1, '8b41'],                 # mov eax, [ecx+0x40]
    'nLifeDrainMinDamage': ['D2Common.dll', 0x6FDB9D44, 2, 1, '8b41'],        # mov eax, [ecx+0x44]
    'nManaDrainMinDamage': ['D2Common.dll', 0x6FDB9D56, 2, 1, '8b41'],        # mov eax, [ecx+0x4c]
    'nBurningMin': ['D2Common.dll', 0x6FDB9D68, 2, 1, '8b41'],                # mov eax, [ecx+0x60]
    'nBurningMax': ['D2Common.dll', 0x6FDB9D7A, 2, 1, '8b41'],                # mov eax, [ecx+0x64]
    'nBurnLength': ['D2Common.dll', 0x6FDB9D8C, 2, 1, '8b41'],                # mov eax, [ecx+0x68]
}

# Iteration 4 (Lane B B015/B018) additions.
STRUCT_SIZE_PE_PROBES.update({
    'D2ItemsTxt': ('D2Common.dll', 0x6FDC19DA, '69c0', 2, 4, 1),              # imul eax, eax, 0x1a8
    'D2DrlgPresetRoomStrc': ('D2Common.dll', 0x6FD94C81, 'ba', 1, 4, 1),      # mov edx, 0xf8
})
FIELD_PE_PROBES['D2ItemDataStrc'].update({
    'dwItemFlags': ['D2Common.dll', 0x6FD73895, 2, 1, '8950'],                # mov [eax+0x14], edx
    'dwCommandFlags': ['D2Common.dll', 0x6FD738F4, 2, 1, '8b40'],             # mov eax, [eax+0x18]
    'dwActionStamp': ['D2Common.dll', 0x6FD725BB, 2, 1, '8b50'],              # mov edx, [eax+0x1c]
    'dwFileIndex': ['D2Common.dll', 0x6FD725C4, 2, 1, '8b50'],                # mov edx, [eax+0x20]
    'dwItemLevel': ['D2Common.dll', 0x6FD73802, 2, 1, '8948'],                # mov [eax+0x2c], ecx
    'bCmdFlags': ['D2Common.dll', 0x6FD73778, 2, 1, '8848'],                  # mov [eax+0x46], cl
    'bNodePage': ['D2Common.dll', 0x6FD73738, 2, 1, '8848'],                  # mov [eax+0x47], cl
    'bEarLevel': ['D2Common.dll', 0x6FD736A8, 2, 1, '8848'],                  # mov [eax+0x48], cl
    'bVarGfxIndex': ['D2Common.dll', 0x6FD73668, 2, 1, '8848'],               # mov [eax+0x49], cl
    'szPlayerName': ['D2Common.dll', 0x6FD73714, 2, 1, '83c0'],               # add eax, 0x4a
})
FIELD_PE_PROBES['D2ItemTypesTxt'] = {
    'wShoots': ['D2Common.dll', 0x6FD735FD, 3, 1, '0fbf40'],                  # movsx eax, word [eax+0xe]
    'nNormal': ['D2Common.dll', 0x6FD72FAD, 3, 1, '0fb640'],                  # movzx eax, byte [eax+0x10]
}
FIELD_PE_PROBES['D2DrlgLevelStrc'].update({
    'nDrlgType': ['D2Common.dll', 0x6FD63FD0, 1, 0, '8339'],                  # cmp dword [ecx], 3
    'nLevelType': ['D2Common.dll', 0x6FD5E700, 2, 4, '8b81'],                 # mov eax, [ecx+0x1c0]
})
FIELD_PE_PROBES['D2ItemsTxt'] = {
    'nLevelReq': ['D2Common.dll', 0x6FD72FE3, 3, 1, '0fb649'],                # movzx ecx, byte [ecx+0x65]
    'nClass': ['D2Common.dll', 0x6FD72FC7, 2, 1, '8a51'],                     # mov dl, [ecx+0x67]
    'nClassLevelReq': ['D2Common.dll', 0x6FD72FDD, 3, 1, '0fb649'],           # movzx ecx, byte [ecx+0x68]
}
FIELD_PE_PROBES['D2DrlgPresetRoomStrc'] = {
    'nLevelPrest': ['D2Common.dll', 0x6FD5E446, 1, 0, '3931'],                # cmp [ecx], esi
    'nOrientation': ['D2Common.dll', 0x6FD5E463, 2, 1, '8951'],               # mov [ecx+0x4], edx
    'dwFlags': ['D2Common.dll', 0x6FD5E43A, 2, 1, '8b51'],                    # mov edx, [ecx+0xc]
}

# Iteration 4 (Lane C B019/B022/B025) additions.
FIELD_PE_PROBES['D2MonStatsTxt'].update({
    'wBaseId': ['D2Common.dll', 0x6FD6A7F6, 3, 1, '0fbf41'],                  # movsx eax, word [ecx+0x2]
    'wNextInClass': ['D2Common.dll', 0x6FD6A87E, 3, 1, '0fbf56'],             # movsx edx, word [esi+0x4]
    'wLevel': ['D2Common.dll', 0x6FD6A8D7, 3, 4, '0fbfa9'],                   # movsx ebp, word [ecx+0xaa]
})
FIELD_PE_PROBES['D2LevelsTxt'].update({
    'nNumMon': ['D2Common.dll', 0x6FD6A7B9, 2, 1, '8a45'],                    # mov al, byte [ebp+0x33]
    'wMon': ['D2Common.dll', 0x6FD6A840, 2, 1, '83c3'],                       # add ebx, 0x36
})
FIELD_PE_PROBES['D2DrlgLevelLinkDataStrc'].update({
    'nRand2': ['D2Common.dll', 0x6FD64AD2, 3, 4, '8b84a9'],                   # mov eax, [ecx+ebp*4+0x174]
    'nRand3': ['D2Common.dll', 0x6FD64FFA, 3, 4, '898491'],                   # mov [ecx+edx*4+0x1b0], eax
})
FIELD_PE_PROBES['D2DrlgOutdoorInfoStrc'].update({
    'nWidth': ['D2Common.dll', 0x6FD67C98, 2, 1, '8b51'],                     # mov edx, [ecx+0x54]
    'nHeight': ['D2Common.dll', 0x6FD67CA0, 2, 1, '8b79'],                    # mov edi, [ecx+0x58]
})

# Iteration 5 Lane A (B026 + B029) additions.
STRUCT_SIZE_PE_PROBES.update({
    'D2UnitFindDataStrc': ('D2Game.dll', 0x6FCBE58D, 'ba', 1, 4, 1),          # mov edx, 0x2c
    'D2TextHeaderStrc': ('D2Common.dll', 0x6FD8D28E, 'ba', 1, 4, 1),          # mov edx, 0x0c
    'D2TextNodeStrc': ('D2Common.dll', 0x6FD8D224, 'ba', 1, 4, 1),            # mov edx, 0x0c
})
FIELD_PE_PROBES['D2UnitStrc'].update({
    'pAnimSeq': ['D2Common.dll', 0x6FD7F1C6, 2, 1, '8b48'],                   # mov ecx, [eax+0x30]
    'dwSeqMode': ['D2Common.dll', 0x6FD7F1CD, 2, 1, '8b40'],                  # mov eax, [eax+0x40]
    'dwFramePrecise': ['D2Common.dll', 0x6FD7EE84, 2, 1, '8b50'],             # mov edx, [eax+0x44]
    'dwFrameCountPrecise': ['D2Common.dll', 0x6FD7EEAE, 2, 1, '8b40'],        # mov eax, [eax+0x48]
})
FIELD_PE_PROBES['D2ItemDataStrc'].update({
    'dwItemCell': ['D2Common.dll', 0x6FD72635, 2, 1, '8948'],                 # mov [eax+0x28], ecx
})
FIELD_PE_PROBES['D2MonStatsTxt'].update({
    'wVelocity': ['D2Common.dll', 0x6FD80D7B, 3, 1, '0fbf40'],                # movsx eax, word [eax+0x32]
    'wSeqVelocity': ['D2Common.dll', 0x6FD7FB46, 3, 1, '0fbf40'],             # movsx eax, word [eax+0x36]
    'wRun': ['D2Common.dll', 0x6FD7FB4B, 3, 1, '0fbf40'],                     # movsx eax, word [eax+0x38]
})
FIELD_PE_PROBES['D2CharStatsTxt'] = {
    'nWalkSpeed': ['D2Common.dll', 0x6FD80DAF, 2, 1, '8a68'],                 # mov ch, [eax+0x40]
    'nRunSpeed': ['D2Common.dll', 0x6FD82EB4, 3, 1, '0fb643'],                # movzx eax, byte [ebx+0x41]
}
FIELD_PE_PROBES['D2DrlgLevelStrc'].update({
    'pTileSubtypes': ['D2Common.dll', 0x6FD8B1CD, 1, 4, '05'],                # add eax, 0x1e0
})
FIELD_PE_PROBES['D2ObjectsTxt'].update({
    'dwFrameCnt': ['D2Common.dll', 0x6FD7EE95, 3, 4, '8b9491'],               # mov edx, [ecx+edx*4+0xd8]
})
FIELD_PE_PROBES['D2UnitFindDataStrc'] = {
    'pMemPool': ['D2Common.dll', 0x6FD62010, 1, 0, '8b0e'],                   # mov ecx, [esi]
    'pUnitsArray': ['D2Common.dll', 0x6FD62009, 2, 1, '8b56'],                # mov edx, [esi+0x4]
    'pRoom': ['D2Common.dll', 0x6FD620B9, 2, 1, '8946'],                      # mov [esi+0x8], eax
    'pfnCallback': ['D2Common.dll', 0x6FD620DC, 2, 1, '894e'],                # mov [esi+0xc], ecx
    'pFilterUnit': ['D2Common.dll', 0x6FD620DF, 2, 1, '8956'],                # mov [esi+0x10], edx
    'dwFlags': ['D2Common.dll', 0x6FD620B2, 2, 1, '8946'],                    # mov [esi+0x14], eax
    'nIndex': ['D2Common.dll', 0x6FD620AF, 2, 1, '8946'],                     # mov [esi+0x18], eax
    'nMaxCount': ['D2Common.dll', 0x6FD62119, 2, 1, '8b7e'],                  # mov edi, [esi+0x1c]
    'nX': ['D2Common.dll', 0x6FD620C0, 2, 1, '894e'],                         # mov [esi+0x20], ecx
    'nY': ['D2Common.dll', 0x6FD620C7, 2, 1, '8956'],                         # mov [esi+0x24], edx
    'dwSize': ['D2Common.dll', 0x6FD620D9, 2, 1, '8946'],                     # mov [esi+0x28], eax
}
FIELD_PE_PROBES['D2TextHeaderStrc'] = {
    'pMemPool': ['D2Common.dll', 0x6FD8D215, 1, 0, '8b0e'],                   # mov ecx, [esi]
    'wCount': ['D2Common.dll', 0x6FD8D240, 3, 1, '66ff46'],                   # inc word [esi+0x4]
    'pFirstNode': ['D2Common.dll', 0x6FD8D218, 2, 1, '8b7e'],                 # mov edi, [esi+0x8]
}
FIELD_PE_PROBES['D2TextNodeStrc'] = {
    'wStringId': ['D2Common.dll', 0x6FD8D23A, 2, 0, '668908'],                # mov [eax], cx
    'nMenuIndex': ['D2Common.dll', 0x6FD8D23D, 2, 1, '8950'],                 # mov [eax+0x4], edx
    'pNext': ['D2Common.dll', 0x6FD8D237, 2, 1, '8978'],                      # mov [eax+0x8], edi
}

# Iteration 5 (Lane B B021/B024) additions.
STRUCT_SIZE_PE_PROBES.update({
    'D2ShrinesTxt': ('D2Common.dll', 0x6FD8E972, '6bc0', 2, 1, 1),              # imul eax, eax, 0x34
    'D2MonLvlTxt': ('D2Common.dll', 0x6FDB03E0, '6bc0', 2, 1, 1),               # imul eax, eax, 0x58
})
FIELD_PE_PROBES['D2ItemDataStrc'].update({
    'dwQuality': ['D2Common.dll', 0x6FD73B38, 1, 0, '8908'],                    # mov [eax], ecx
    'dwSeedLo': ['D2Common.dll', 0x6FD73BF4, 2, 1, 'c740'],                     # mov dword [eax+0x4], 1
    'dwSeedHi': ['D2Common.dll', 0x6FD73BFB, 2, 1, 'c740'],                     # mov dword [eax+0x8], 0x29a
    'dwOwnerGuid': ['D2Common.dll', 0x6FD73BD4, 2, 1, '8b40'],                  # mov eax, [eax+0x10]
    'wAutoAffix': ['D2Common.dll', 0x6FD73A89, 3, 1, '668948'],                 # mov [eax+0x36], cx
})
FIELD_PE_PROBES['D2LevelsTxt'].update({
    'wMonLv1': ['D2Common.dll', 0x6FDBE11A, 4, 1, '0fbf4450'],                  # movsx eax, word [eax+edx*2+0x10]
    'wMonLvEx1': ['D2Common.dll', 0x6FDBE10E, 4, 1, '0fbf4448'],                # movsx eax, word [eax+ecx*2+0x16]
})
FIELD_PE_PROBES['D2ShrinesTxt'] = {}
FIELD_PE_PROBES['D2MonLvlTxt'] = {}

# Iteration 5 (Lane C B028/B031) additions.
STRUCT_SIZE_PE_PROBES.update({
    'D2CubemainTxt': ('D2Common.dll', 0x6FD6B8CC, '69c0', 2, 4, 1),            # imul eax, eax, 0x148
})
FIELD_PE_PROBES['D2ActiveRoomStrc'].update({
    'nIdleCounter': ['D2Common.dll', 0x6FD8B385, 2, 1, '8b40'],                # mov eax, [eax+0xc]
    'pPortalNodes': ['D2Common.dll', 0x6FD8B497, 2, 1, '8b40'],                # mov eax, [eax+0x18]
    'pClientList': ['D2Common.dll', 0x6FD8B3A9, 2, 1, '8b49'],                 # mov ecx, [ecx+0x48]
    'nNumClients': ['D2Common.dll', 0x6FD8B377, 2, 1, '8b48'],                 # mov ecx, [eax+0x78]
})
FIELD_PE_PROBES['D2DrlgTileGridStrc'].update({
    'nRoofs': ['D2Common.dll', 0x6FDB7FF7, 2, 1, '8b4e'],                      # mov ecx, [esi+0x10]
    'pRoofs': ['D2Common.dll', 0x6FDB7FD7, 2, 1, '8b56'],                      # mov edx, [esi+0x24]
})
FIELD_PE_PROBES['D2DrlgStrc'].update({
    'nDifficulty': ['D2Common.dll', 0x6FD5E411, 3, 4, '0fb691'],               # movzx edx, byte [ecx+0x450]
    'pfnAutomapInit': ['D2Common.dll', 0x6FD5CD84, 2, 4, '8b90'],             # mov edx, [eax+0x454]
    'nAct': ['D2Common.dll', 0x6FD60CAE, 2, 4, '80b9'],                       # cmp byte [ecx+0x480], 4
    'pfnErrorCallback': ['D2Common.dll', 0x6FD5CE4F, 2, 4, '8baa'],           # mov ebp, [edx+0x488]
})
FIELD_PE_PROBES['D2CubemainTxt'] = {}

# Iteration 9 (k1r3 Lane B I9B-B) AnimData.d2 table structs.
STRUCT_SIZE_PE_PROBES.update({
    'D2AnimDataRecordStrc': ('D2Common.dll', 0x6FD91E2D, '81c7', 2, 4, 1),   # add edi, 0xa0
    'D2AnimDataTableStrc': ('D2Common.dll', 0x6FD91E64, 'ba', 1, 4, 1),      # mov edx, 0x4a4
})
FIELD_PE_PROBES['D2AnimDataRecordStrc'] = {
    'dwFramesPerDirection': ['D2Common.dll', 0x6FD91EFE, 2, 1, '8b48'],        # mov ecx, [eax+0x8]
    'dwAnimSpeed': ['D2Common.dll', 0x6FD91F07, 2, 1, '8b48'],                 # mov ecx, [eax+0xc]
    'bFrameEvents': ['D2Common.dll', 0x6FD91F28, 3, 1, '8a5c01'],              # mov bl, [ecx+eax+0x10]
}
FIELD_PE_PROBES['D2AnimDataTableStrc'] = {
    'pAnimDataFile': ['D2Common.dll', 0x6FD91EA8, 1, 0, '89'],                 # mov [esi], eax
    'pHashBuckets': ['D2Common.dll', 0x6FD91E12, 3, 1, '8b4486'],              # mov eax, [esi+eax*4+0x4]
    'dwDefaultFramesPerDirection': ['D2Common.dll', 0x6FD91EC7, 2, 4, 'c786'], # mov dword [esi+0x40c], 0x800
    'dwDefaultAnimSpeed': ['D2Common.dll', 0x6FD91ED1, 2, 4, 'c786'],          # mov dword [esi+0x410], 0x100
}

# Iteration 6 (Lane B B027/B030) additions.
FIELD_PE_PROBES['D2ItemDataStrc'].update({
    'dwInitSeed': ['D2Common.dll', 0x6FD73CC9, 2, 1, 'c742'],                  # mov dword [edx+0xc], 0xffffffff
    'wItemFormat': ['D2Common.dll', 0x6FD72201, 3, 1, '668b40'],               # mov ax, word [eax+0x30]
})
FIELD_PE_PROBES['D2ItemTypesTxt'].update({
    'nRarity': ['D2Common.dll', 0x6FD74396, 2, 1, '8078'],                     # cmp byte [eax+0x21], 7
})
FIELD_PE_PROBES['D2ItemStatCostTxt'].update({
    'bValShift': ['D2Common.dll', 0x6FD79E8F, 2, 1, '8a4e'],                   # mov cl, [esi+0x18]
    'nSaveBits': ['D2Common.dll', 0x6FD79D9F, 4, 1, '0fb67c06'],               # movzx edi, byte [esi+eax+0x19]
    'dwSaveAdd': ['D2Common.dll', 0x6FD79D95, 3, 1, '8b5c86'],                 # mov ebx, [esi+eax*4+0x1c]
    'dwSaveParamBits': ['D2Common.dll', 0x6FD79D90, 3, 1, '8b5486'],           # mov edx, [esi+eax*4+0x24]
})
FIELD_PE_PROBES['D2ItemsTxt'].update({
    'dwCode': ['D2Common.dll', 0x6FD732D7, 2, 4, '8b80'],                      # mov eax, [eax+0x80]
    'dwAlternateGfx': ['D2Common.dll', 0x6FD7302C, 2, 4, '8b88'],              # mov ecx, [eax+0x84]
    'nMinAc': ['D2Common.dll', 0x6FD79FD5, 2, 4, '8bbb'],                      # mov edi, [ebx+0xd0]
    'dwBitField1': ['D2Common.dll', 0x6FD72806, 2, 4, '8b80'],                 # mov eax, [eax+0xdc]
    'dwCost': ['D2Common.dll', 0x6FD74ACA, 2, 4, '8b80'],                      # mov eax, [eax+0xe0]
    'dwGambleCost': ['D2Common.dll', 0x6FD72B16, 2, 4, '8b80'],                # mov eax, [eax+0xe4]
    'dwSpeed': ['D2Common.dll', 0x6FD72BB6, 2, 4, '8b80'],                     # mov eax, [eax+0xe8]
    'dwBitField2': ['D2Common.dll', 0x6FD72B66, 2, 4, '8b80'],                 # mov eax, [eax+0xec]
    'nMinDam': ['D2Common.dll', 0x6FD7A0BA, 2, 4, '8a83'],                     # mov al, [ebx+0xfe]
    'nMaxDam': ['D2Common.dll', 0x6FD7A015, 2, 4, '8a83'],                     # mov al, [ebx+0xff]
    'nMinMisDam': ['D2Common.dll', 0x6FD7A11F, 2, 4, '8a83'],                  # mov al, [ebx+0x100]
    'nMaxMisDam': ['D2Common.dll', 0x6FD7A07E, 2, 4, '8a83'],                  # mov al, [ebx+0x101]
    'n2HandMinDam': ['D2Common.dll', 0x6FD7A0E0, 2, 4, '8a83'],                # mov al, [ebx+0x102]
    'n2HandMaxDam': ['D2Common.dll', 0x6FD7A03B, 2, 4, '8a83'],                # mov al, [ebx+0x103]
    'wType1': ['D2Common.dll', 0x6FD730E6, 3, 4, '0fbf80'],                    # movsx eax, word [eax+0x11e]
    'wType2': ['D2Common.dll', 0x6FD744B7, 3, 4, '668b80'],                    # mov ax, word [eax+0x120]
    'nComponent': ['D2Common.dll', 0x6FD72C07, 3, 4, '0fb680'],                # movzx eax, byte [eax+0x12a]
    'nTwoHanded': ['D2Common.dll', 0x6FD72E59, 3, 4, '0fb680'],                # movzx eax, byte [eax+0x132]
    'nSubType': ['D2Common.dll', 0x6FD72964, 3, 4, '0fb680'],                  # movzx eax, byte [eax+0x137]
    'bBelt': ['D2Common.dll', 0x6FD72914, 2, 4, '8a80'],                       # mov al, [eax+0x138]
    'bQuest': ['D2Common.dll', 0x6FD723C7, 2, 4, '8a80'],                      # mov al, [eax+0x13c]
    'nGemApplyType': ['D2Common.dll', 0x6FD728C6, 3, 4, '0fb680'],             # movzx eax, byte [eax+0x13e]
    'nDropSound': ['D2Common.dll', 0x6FD722FE, 3, 4, '0fb680'],                # movzx eax, byte [eax+0x143]
})

# Iteration 6 (Lane C B034/B037/B042) additions.
FIELD_PE_PROBES['D2DynamicPathStrc'].update({
    'nStepAttr': ['D2Common.dll', 0x6FD8E0C0, 3, 1, '0fb646'],                  # movzx eax, byte [esi+0x33]
    'nPathTypeDirOffset': ['D2Common.dll', 0x6FD84FEA, 2, 4, '8988'],         # mov [eax+0x98], ecx
    'pfnPathfind': ['D2Common.dll', 0x6FD84FEA, 2, 4, '8988'],                  # mov [eax+0x1f8], ecx
})
FIELD_PE_PROBES['D2RoomExStrc'].update({
    'pDrlgOrth': ['D2Common.dll', 0x6FD94953, 1, 0, '8b06'],                    # mov eax, [esi]
    'dwDT1Mask': ['D2Common.dll', 0x6FDB8440, 2, 1, '8b5e'],                    # mov ebx, [esi+0x40]
})
FIELD_PE_PROBES['D2DrlgLevelStrc'].update({
    'dwFlags': ['D2Common.dll', 0x6FD94C53, 2, 1, 'f643'],                      # test byte [ebx+0x04], 0x20
    'pWarp': ['D2Common.dll', 0x6FD94CE0, 2, 4, '8b80'],                        # mov eax, [eax+0x1b4]
    'pCurrentMap': ['D2Common.dll', 0x6FD5BD49, 2, 4, '8b90'],                  # mov edx, [eax+0x1bc]
})
FIELD_PE_PROBES['D2DrlgMapStrc'].update({
    'nLevelPrest': ['D2Common.dll', 0x6FD5BCC3, 1, 0, '892e'],                  # mov [esi], ebp
    'nPickedFile': ['D2Common.dll', 0x6FD5BD04, 2, 1, '8956'],                  # mov [esi+0x04], edx
    'pLvlPrestTxt': ['D2Common.dll', 0x6FD5BCC0, 2, 1, '8946'],                 # mov [esi+0x08], eax
    'pFile': ['D2Common.dll', 0x6FD5A461, 2, 1, '8b48'],                        # mov ecx, [eax+0x0c]
    'nWidth': ['D2Common.dll', 0x6FD5AF20, 2, 1, '8b46'],                       # mov eax, [esi+0x18]
    'nHeight': ['D2Common.dll', 0x6FD5AF34, 2, 1, '8b46'],                      # mov eax, [esi+0x1c]
    'bInited': ['D2Common.dll', 0x6FD5BD42, 2, 1, 'c746'],                      # mov dword [esi+0x20], 1
    'pNext': ['D2Common.dll', 0x6FD5BD4F, 2, 1, '8956'],                        # mov [esi+0x68], edx
})
FIELD_PE_PROBES['D2LvlPrestTxt'].update({
    'nSizeX': ['D2Common.dll', 0x6FD5BD19, 2, 1, '8b48'],                       # mov ecx, [eax+0x38]
    'nSizeY': ['D2Common.dll', 0x6FD5BD20, 2, 1, '8b78'],                       # mov edi, [eax+0x3c]
    'dwFiles': ['D2Common.dll', 0x6FD5BCC5, 2, 1, '8b48'],                      # mov ecx, [eax+0x48]
})
FIELD_PE_PROBES['D2DrlgOrthStrc'].update({
    'pRoomEx': ['D2Common.dll', 0x6FD94960, 1, 0, '3938'],                      # cmp [eax], edi
    'bInit': ['D2Common.dll', 0x6FD949B8, 2, 1, 'c740'],                        # mov dword [eax+0x0c], 0
    'pNext': ['D2Common.dll', 0x6FD94964, 2, 1, '8b40'],                        # mov eax, [eax+0x14]
})
FIELD_PE_PROBES['D2ObjectsTxt'].update({
    'nOperateFn': ['D2Common.dll', 0x6FD8519B, 3, 4, '0fb6be'],                 # movzx edi, byte [esi+0x144]
    'nDoor': ['D2Common.dll', 0x6FD851C9, 2, 4, '80be'],                        # cmp byte [esi+0x168], 0
})
FIELD_PE_PROBES['D2PresetUnitStrc'].update({
    'pSaveChain': ['D2Common.dll', 0x6FD59FE3, 2, 1, '8b73'],                   # mov esi, [ebx+0x10]
})
FIELD_PE_PROBES['D2RoomLogicalInfoStrc'].update({
    'pGrid0Cells': ['D2Common.dll', 0x6FDD0FB2, 2, 1, '896f'],                  # mov [edi+0x04], ebp
    'pGrid0RowOffsets': ['D2Common.dll', 0x6FDD0F99, 2, 1, '8b57'],             # mov edx, [edi+0x08]
})
FIELD_PE_PROBES['D2DrlgPresetRoomStrc'].update({
    'pMap': ['D2Common.dll', 0x6FD5A456, 2, 1, '8b46'],                         # mov eax, [esi+0x04]
    'pWall0Cells': ['D2Common.dll', 0x6FD5AAD6, 2, 1, '8b46'],                  # mov eax, [esi+0x28]
    'pWall0RowOffsets': ['D2Common.dll', 0x6FD5AAD0, 2, 1, '8b46'],             # mov eax, [esi+0x2c]
    'pCellGridCells': ['D2Common.dll', 0x6FD5A528, 2, 4, '89b8'],               # mov [eax+0xd8], edi
    'pCellGridRowOffsets': ['D2Common.dll', 0x6FD5A507, 2, 4, '8b96'],          # mov edx, [esi+0xdc]
    'pTombCoords': ['D2Common.dll', 0x6FD5AA89, 2, 4, '8b86'],                  # mov eax, [esi+0x104]
    'nTombCoords': ['D2Common.dll', 0x6FD5AB39, 2, 4, '89be'],                  # mov [esi+0x108], edi
})

# Iteration 7 (Lane A B038/B041) additions.
FIELD_PE_PROBES['D2UnitStrc'].update({
    'dwSeqFramePrecise': ['D2Common.dll', 0x6FD7F0E7, 2, 1, '8b48'],             # mov ecx, [eax+0x38]
    'dwField7C': ['D2Common.dll', 0x6FD7E983, 2, 1, '8b41'],                     # mov eax, [ecx+0x7c]
    'dwOwnerType': ['D2Common.dll', 0x6FD7F9E3, 2, 4, '8990'],                   # mov [eax+0x9c], edx
    'dwOwnerId': ['D2Common.dll', 0x6FD7F9EC, 2, 4, '8988'],                     # mov [eax+0xa0], ecx
})
FIELD_PE_PROBES['D2PlayerDataStrc'].update({
    'dwActiveWeaponFlags': ['D2Common.dll', 0x6FD7EB26, 2, 1, '8b40'],           # mov eax, [eax+0x2c]
    'dwLeftTargetVal': ['D2Common.dll', 0x6FD7F84B, 2, 1, '8b50'],               # mov edx, [eax+0x70]
    'dwRightTargetVal': ['D2Common.dll', 0x6FD7F7EB, 2, 1, '8b50'],              # mov edx, [eax+0x74]
    'dwLeftTargetGuid': ['D2Common.dll', 0x6FD7F854, 2, 1, '8b50'],              # mov edx, [eax+0x78]
    'dwRightTargetGuid': ['D2Common.dll', 0x6FD7F7F4, 2, 1, '8b50'],             # mov edx, [eax+0x7c]
    'dwLeftSubtargetType': ['D2Common.dll', 0x6FD7F60B, 2, 4, '8b90'],           # mov edx, [eax+0x80]
    'dwRightSubtargetType': ['D2Common.dll', 0x6FD7F67B, 2, 4, '8b90'],          # mov edx, [eax+0x84]
    'dwLeftSubtargetGuid': ['D2Common.dll', 0x6FD7F617, 2, 4, '8b90'],           # mov edx, [eax+0x88]
    'dwRightSubtargetGuid': ['D2Common.dll', 0x6FD7F687, 2, 4, '8b90'],          # mov edx, [eax+0x8c]
    'dwInteractItemGuid': ['D2Common.dll', 0x6FD7F4A1, 2, 4, '8b80'],            # mov eax, [eax+0x90]
    'dwInteractType': ['D2Common.dll', 0x6FD7F711, 2, 4, '8990'],                # mov [eax+0x94], edx
})
FIELD_PE_PROBES['D2CharStatsTxt'].update({
    'nToHitFactor': ['D2Common.dll', 0x6FD81F7F, 2, 1, '8b40'],                  # mov eax, [eax+0x3c]
})
FIELD_PE_PROBES['D2ObjectDataStrc'].update({
    'nPortalFlags': ['D2Common.dll', 0x6FD7EAA6, 2, 1, '8a40'],                  # mov al, [eax+0x5]
    'pShrineTxt': ['D2Common.dll', 0x6FD7ECC7, 2, 1, '8b40'],                    # mov eax, [eax+0x8]
})
FIELD_PE_PROBES['D2ObjectsTxt'].update({
    'bBlocksVis': ['D2Common.dll', 0x6FD7FF8D, 2, 4, '8a88'],                    # mov cl, [eax+0x13b]
    'bBlocksLight': ['D2Common.dll', 0x6FD7FF9D, 2, 4, '8a80'],                  # mov al, [eax+0x1b6]
})
# Iteration 7 (Lane B B033/B036) additions.
FIELD_PE_PROBES['D2SkillStrc'].update({
    'dwParam0C': ['D2Common.dll', 0x6FD9DE8B, 2, 1, '8948'],                    # mov [eax+0xc], ecx
    'dwParam1': ['D2Common.dll', 0x6FD9E057, 2, 1, '8b40'],                     # mov eax, [eax+0x18]
    'dwParam2': ['D2Common.dll', 0x6FD9E027, 2, 1, '8b40'],                     # mov eax, [eax+0x1c]
    'dwParam3': ['D2Common.dll', 0x6FD9DFF7, 2, 1, '8b40'],                     # mov eax, [eax+0x20]
    'dwParam4': ['D2Common.dll', 0x6FD9DFC7, 2, 1, '8b40'],                     # mov eax, [eax+0x24]
    'nQuantity': ['D2Common.dll', 0x6FD9DD97, 2, 1, '8b40'],                    # mov eax, [eax+0x30]
    'nCharges': ['D2Common.dll', 0x6FD9E2A2, 2, 1, '8b49'],                     # mov ecx, [ecx+0x38]
})
FIELD_PE_PROBES['D2ItemsTxt'].update({
    'dw2HandedWClass': ['D2Common.dll', 0x6FD73327, 2, 4, '8b80'],              # mov eax, [eax+0xc4]
    'nLevel': ['D2Common.dll', 0x6FD73097, 2, 4, '8a80'],                       # mov al, [eax+0xfd]
    'nUseable': ['D2Common.dll', 0x6FD72CB9, 3, 4, '0fb680'],                   # movzx eax, byte [eax+0x11d]
    'nUnique': ['D2Common.dll', 0x6FD72C67, 3, 4, '0fb680'],                    # movzx eax, byte [eax+0x129]
})
FIELD_PE_PROBES['D2ItemTypesTxt'].update({
    'nBody': ['D2Common.dll', 0x6FD74413, 3, 1, '0fb640'],                      # movzx eax, byte [eax+0x9]
    'nBodyLoc1': ['D2Common.dll', 0x6FD73178, 2, 1, '8a50'],                    # mov dl, [eax+0xa]
    'nBodyLoc2': ['D2Common.dll', 0x6FD73181, 2, 1, '8a50'],                    # mov dl, [eax+0xb]
    'wQuiver': ['D2Common.dll', 0x6FD74EE7, 3, 1, '0fbf40'],                    # movsx eax, word [eax+0xc]
    'nReload': ['D2Common.dll', 0x6FD73577, 3, 1, '0fb640'],                    # movzx eax, byte [eax+0x11]
    'nReEquip': ['D2Common.dll', 0x6FD73527, 3, 1, '0fb640'],                   # movzx eax, byte [eax+0x12]
    'nAutoStack': ['D2Common.dll', 0x6FD74E47, 3, 1, '0fb640'],                 # movzx eax, byte [eax+0x13]
    'nMagic': ['D2Common.dll', 0x6FD733E7, 3, 1, '0fb640'],                     # movzx eax, byte [eax+0x14]
    'nRare': ['D2Common.dll', 0x6FD73437, 3, 1, '0fb640'],                      # movzx eax, byte [eax+0x15]
    'nNormalAllowed': ['D2Common.dll', 0x6FD73397, 3, 1, '0fb640'],             # movzx eax, byte [eax+0x16]
    'nBeltable': ['D2Common.dll', 0x6FD74BD7, 3, 1, '0fb640'],                  # movzx eax, byte [eax+0x19]
    'nMaxSock1': ['D2Common.dll', 0x6FD74668, 3, 1, '0fb647'],                  # movzx eax, byte [edi+0x1a]
    'nMaxSock25': ['D2Common.dll', 0x6FD74673, 3, 1, '0fb647'],                 # movzx eax, byte [edi+0x1b]
    'nMaxSock40': ['D2Common.dll', 0x6FD74679, 3, 1, '0fb647'],                 # movzx eax, byte [edi+0x1c]
    'nStaffMods': ['D2Common.dll', 0x6FD746D7, 3, 1, '0fb640'],                 # movzx eax, byte [eax+0x1f]
    'nStorePage': ['D2Common.dll', 0x6FD734D7, 2, 1, '8a40'],                   # mov al, [eax+0x22]
    'nVarInvGfx': ['D2Common.dll', 0x6FD73487, 2, 1, '8a40'],                   # mov al, [eax+0x23]
})

# Iteration 9 (k1r4 Lane A B051/B048) additions.
FIELD_PE_PROBES['D2InventoryStrc'].update({
    'pMemPool': ['D2Common.dll', 0x6FD6E52D, 2, 1, '8b4e'],                     # mov ecx, [esi+0x4]
    'pOwner': ['D2Common.dll', 0x6FD6FE24, 2, 1, '8b43'],                       # mov eax, [ebx+0x8]
    'pGrids': ['D2Common.dll', 0x6FD6E1BE, 2, 1, '8b4b'],                       # mov ecx, [ebx+0x14]
    'nGridCount': ['D2Common.dll', 0x6FD6E1B4, 2, 1, '3973'],                   # cmp [ebx+0x18], esi
    'dwWeaponGuid': ['D2Common.dll', 0x6FD6FCB7, 2, 1, '3943'],                 # cmp [ebx+0x1c], eax
})
FIELD_PE_PROBES['D2MonStats2Txt'].update({
    'nSizeX': ['D2Common.dll', 0x6FD80FAA, 3, 1, '0fbe40'],                     # movsx eax, byte [eax+0x8]
    'nSizeY': ['D2Common.dll', 0x6FD80F29, 3, 1, '0fbe40'],                     # movsx eax, byte [eax+0x9]
})
FIELD_PE_PROBES['D2SkillsTxt'].update({
    'nFlags2': ['D2Common.dll', 0x6FD80C5E, 3, 1, '0fb640'],                    # movzx eax, byte [eax+0x6]
    'nAnim': ['D2Common.dll', 0x6FD80BB9, 2, 1, '8078'],                        # cmp byte [eax+0x12], 0xa
    'wSummon': ['D2Common.dll', 0x6FD6A4AC, 3, 4, '668b86'],                    # mov ax, word [esi+0xbc]
    'nSummode': ['D2Common.dll', 0x6FD6A4EF, 3, 4, '0fbe86'],                   # movsx eax, byte [esi+0xbf]
})
FIELD_PE_PROBES['D2MissilesTxt'].update({
    'nSize': ['D2Common.dll', 0x6FD80FD3, 3, 4, '0fb680'],                      # movzx eax, byte [eax+0x18a]
})
FIELD_PE_PROBES['D2ObjectsTxt'].update({
    'dwSizeX': ['D2Common.dll', 0x6FD80FB6, 2, 4, '8b81'],                      # mov eax, [ecx+0xd0]
    'dwSizeY': ['D2Common.dll', 0x6FD80F35, 2, 4, '8b81'],                      # mov eax, [ecx+0xd4]
})
FIELD_PE_PROBES['D2HirelingTxt'].update({
    'dwAct': ['D2Common.dll', 0x6FD7CA00, 2, 1, '8b40'],                        # mov eax, [eax+0xc]
})
FIELD_PE_PROBES['D2StatesTxt'].update({
    'nGfxType': ['D2Common.dll', 0x6FDA02A3, 3, 1, '0fb648'],                   # movzx ecx, byte [eax+0x2d]
    'wGfxClass': ['D2Common.dll', 0x6FDA02DD, 3, 1, '0fbf40'],                  # movsx eax, word [eax+0x2e]
})
# Iteration 9 (k1r4 Lane C B061/B066') additions.
STRUCT_SIZE_PE_PROBES.update({
    'D2PathInfoStrc': ('D2Common.dll', 0x6FD86230, '83ec', 2, 1, 1),             # sub esp, 0x34
})
FIELD_PE_PROBES['D2IdaStarNodeStrc'].update({
    'nVisitCount': ['D2Common.dll', 0x6FDC084A, 3, 1, '66395e'],                 # cmp word [esi+0x6], bx
})
FIELD_PE_PROBES['D2PathInfoStrc'] = {
    'startX': ['D2Common.dll', 0x6FD85706, 2, 0, '668b06'],                      # mov ax, word [esi]
    'startY': ['D2Common.dll', 0x6FD856FE, 3, 1, '668b4e'],                      # mov cx, word [esi+0x2]
    'targetX': ['D2Common.dll', 0x6FD85702, 3, 1, '668b56'],                     # mov dx, word [esi+0x4]
    'targetY': ['D2Common.dll', 0x6FD85711, 3, 1, '0fb76e'],                     # movzx ebp, word [esi+0x6]
    'pStartRoom': ['D2Common.dll', 0x6FD85735, 2, 1, '8b46'],                    # mov eax, [esi+0x8]
    'pTargetRoom': ['D2Common.dll', 0x6FD856F7, 2, 1, '8b46'],                   # mov eax, [esi+0xc]
    'pDynamicPath': ['D2Common.dll', 0x6FD85471, 2, 1, '8b77'],                  # mov esi, [edi+0x30]
}
# Iteration 10 (k1r7 Lane A I10A-1/I10A-2) additions.
FIELD_PE_PROBES['D2UnitStrc'].update({
    'dwSourceUnitType': ['D2Common.dll', 0x6FD82CB7, 2, 4, '8987'],              # mov [edi+0x94], eax
    'dwSourceUnitId': ['D2Common.dll', 0x6FD82CBD, 2, 4, '898f'],                # mov [edi+0x98], ecx
})
FIELD_PE_PROBES['D2MonStatsTxt'].update({
    'bAlign': ['D2Common.dll', 0x6FD6B20D, 2, 1, '8078'],                        # cmp byte [eax+0x4c], 1
})
FIELD_PE_PROBES['D2DrlgLevelStrc'].update({
    'nJungleInterlink': ['D2Common.dll', 0x6FDD551C, 2, 4, '8b8e'],              # mov ecx, [esi+0x1b8]
    'pJungleDefs': ['D2Common.dll', 0x6FDD5552, 2, 4, '8b86'],                   # mov eax, [esi+0x1bc]
})
FIELD_PE_PROBES['D2LevelDefBin'].update({
    'dwSizeX0': ['D2Common.dll', 0x6FDBDA1D, 4, 4, 'c7442448'],                  # mov dword [esp+0x48], 0xc
    'dwSizeX1': ['D2Common.dll', 0x6FDBDA55, 4, 4, 'c7442470'],                  # mov dword [esp+0x70], 0x10
    'dwSizeX2': ['D2Common.dll', 0x6FDBDA9F, 7, 4, 'c7842498000000'],            # mov dword [esp+0x98], 0x14
    'dwSizeY0': ['D2Common.dll', 0x6FDBDA39, 4, 4, 'c744245c'],                  # mov dword [esp+0x5c], 0x18
    'dwSizeY1': ['D2Common.dll', 0x6FDBDA74, 7, 4, 'c7842484000000'],            # mov dword [esp+0x84], 0x1c
    'dwSizeY2': ['D2Common.dll', 0x6FDBDACA, 7, 4, 'c78424ac000000'],            # mov dword [esp+0xac], 0x20
})
FIELD_PE_PROBES['D2StatesTxt'].update({
    'nStateFlags2': ['D2Common.dll', 0x6FD82D55, 2, 1, '8a40'],                  # mov al, [eax+0x12]
})
FIELD_PE_PROBES['D2ItemStatCostTxt'].update({
    'dwFlags': ['D2Common.dll', 0x6FD8A0C5, 2, 1, '8a48'],                       # mov cl, [eax+0x4]
    'dwMinAccr': ['D2Common.dll', 0x6FD88AE1, 2, 1, '8b56'],                     # mov edx, [esi+0x2c]
    'bKeepZero': ['D2Common.dll', 0x6FD8897D, 2, 1, '8a51'],                     # mov dl, [ecx+0x50]
    'bIsBaseOfOtherStat': ['D2Common.dll', 0x6FD89FE0, 2, 1, '8a46'],            # mov al, [esi+0x51]
    'bHasOpApplyingToThis': ['D2Common.dll', 0x6FD89580, 2, 1, '8a4e'],          # mov cl, [esi+0x52]
    'bHasDynamicOp': ['D2Common.dll', 0x6FD88997, 2, 1, '8a48'],                 # mov cl, [eax+0x53]
    'bOp': ['D2Common.dll', 0x6FD89BE7, 2, 1, '8a48'],                           # mov cl, [eax+0x54]
    'wOpStat1': ['D2Common.dll', 0x6FDC3B1D, 7, 4, 'c78424f8030000'],            # mov dword [esp+0x3f8], 0x58
    'wOpStat2': ['D2Common.dll', 0x6FDC3B48, 7, 4, 'c784240c040000'],            # mov dword [esp+0x40c], 0x5a
    'wOpStat3': ['D2Common.dll', 0x6FDC3B73, 7, 4, 'c7842420040000'],            # mov dword [esp+0x420], 0x5c
})
# Iteration 10 (k1r7 Lane B I10B-1/I10B-2) additions.
FIELD_PE_PROBES['D2ItemsTxt'].update({
    'dwUberCode': ['D2Common.dll', 0x6FD74D6A, 2, 4, '3986'],                    # cmp [esi+0x88], eax
    'dwUltraCode': ['D2Common.dll', 0x6FD74D72, 2, 4, '3986'],                   # cmp [esi+0x8c], eax
    'wReqStr': ['D2Common.dll', 0x6FD76E30, 3, 4, '0fb788'],                     # movzx ecx, word [eax+0x10a]
    'wReqDex': ['D2Common.dll', 0x6FD76E37, 3, 4, '0fb790'],                     # movzx edx, word [eax+0x10c]
    'nInvWidth': ['D2Common.dll', 0x6FD7A406, 2, 4, '8a98'],                     # mov bl, [eax+0x10f]
    'nInvHeight': ['D2Common.dll', 0x6FD7A40C, 2, 4, '8a80'],                    # mov al, [eax+0x110]
    'bStackable': ['D2Common.dll', 0x6FD74B68, 2, 4, '8a88'],                    # mov cl, [eax+0x131]
    'nItemLevelReq': ['D2Common.dll', 0x6FD7652D, 3, 4, '0fb680'],               # movzx eax, byte [eax+0x13f]
})
FIELD_PE_PROBES['D2SetItemsTxt'].update({
    'wLvlReq': ['D2Common.dll', 0x6FD764D8, 3, 1, '0fbf40'],                     # movsx eax, word [eax+0x32]
})
FIELD_PE_PROBES['D2UniqueItemsTxt'].update({
    'wLvlReq': ['D2Common.dll', 0x6FD7649F, 3, 1, '0fbf46'],                     # movsx eax, word [esi+0x36]
})
FIELD_PE_PROBES['D2SkillStrc'].update({
    'nSkillPoints': ['D2Common.dll', 0x6FD9FCFA, 2, 1, '8b4b'],                  # mov ecx, [ebx+0x2c]
})
FIELD_PE_PROBES['D2SkillsTxt'].update({
    'bFlags4': ['D2Common.dll', 0x6FDA0959, 2, 1, '8a50'],                       # mov dl, [eax+0x8]
    'nSeqNum': ['D2Common.dll', 0x6FD9EC64, 3, 1, '0fb640'],                     # movzx eax, byte [eax+0x13]
    'wITypeA': ['D2Common.dll', 0x6FDA0636, 3, 1, '668b46'],                     # mov ax, [esi+0x18]
    'wITypeB': ['D2Common.dll', 0x6FDA064C, 3, 1, '66837e'],                     # cmp word [esi+0x1e], 0
    'wETypeA': ['D2Common.dll', 0x6FDA0625, 4, 1, '66396cbe'],                   # cmp [esi+edi*4+0x24], bp
    'wSrvDoFunc': ['D2Common.dll', 0x6FDA0BEB, 3, 1, '66837b'],                  # cmp word [ebx+0x2e], 0x74
    'wStartMana': ['D2Common.dll', 0x6FD9FDE4, 3, 4, '668bb2'],                  # mov si, [edx+0x184]
    'nEType': ['D2Common.dll', 0x6FD9FD89, 2, 4, '8a82'],                        # mov al, [edx+0x1dc]
    'nRestrict': ['D2Common.dll', 0x6FD9F5A3, 3, 4, '0fb686'],                   # movzx eax, byte [esi+0x228]
    'wState': ['D2Common.dll', 0x6FD9F5C9, 2, 4, '81c6'],                        # add esi, 0x22a
})
FIELD_PE_PROBES['D2MonStatsTxt'].update({
    'nBitField3': ['D2Common.dll', 0x6FD81246, 2, 1, '8a56'],                    # mov dl, [esi+0xe]
    'wSkill': ['D2Common.dll', 0x6FD9EC82, 2, 4, '8d90'],                        # lea edx, [eax+0x170]
    'wSkMode': ['D2Common.dll', 0x6FD9ECA5, 4, 4, '0fbf8448'],                   # movsx eax, word [eax+ecx*2+0x188]
})
# Iteration 10 (k1r7 Lane C I10C-1 / I10C-2) additions.
FIELD_PE_PROBES['D2PathInfoStrc'].update({
    'nTargetTypeStatus': ['D2Common.dll', 0x6FDC0B89, 3, 1, '0fb648'],           # movzx ecx, byte [eax+0x14]
    'dwCollisionPattern': ['D2Common.dll', 0x6FD686D1, 2, 1, '8b58'],            # mov ebx, [eax+0x28]
    'nMoveTestCollisionMask': ['D2Common.dll', 0x6FD686D5, 2, 1, '8b68'],        # mov ebp, [eax+0x2c]
})
FIELD_PE_PROBES['D2IdaStarNodeStrc'].update({
    'wFScore': ['D2Common.dll', 0x6FDC0AF5, 2, 0, '6689'],                       # mov [esi], dx
    'wHScore': ['D2Common.dll', 0x6FDC0AFE, 3, 1, '668946'],                     # mov [esi+0x2], ax
    'wGScore': ['D2Common.dll', 0x6FDC0AED, 3, 1, '66894e'],                     # mov [esi+0x4], cx
    'pChild': ['D2Common.dll', 0x6FDC0A93, 2, 1, '8b5e'],                        # mov ebx, [esi+0x18]
})
FIELD_PE_PROBES['D2DrlgPresetRoomStrc'].update({
    'pMazeGrid': ['D2Common.dll', 0x6FD5AE61, 2, 4, '89b9'],                     # mov [ecx+0xec], edi
})
FIELD_PE_PROBES['D2DrlgTileGridStrc'].update({
    'nFloorCount': ['D2Common.dll', 0x6FDB9177, 2, 1, '8b51'],                   # mov edx, [ecx+0xc]
    'pFloors': ['D2Common.dll', 0x6FDB917D, 2, 1, '8b51'],                       # mov edx, [ecx+0x1c]
})
FIELD_PE_PROBES['D2DrlgOutdoorInfoStrc'].update({
    'dwOutdoorFlags': ['D2Common.dll', 0x6FD8E027, 2, 1, '8d47'],                # lea eax, [edi+0x68]
    'aOutdoorRooms': ['D2Common.dll', 0x6FD8D5E5, 3, 4, '8d8c8f'],               # lea ecx, [edi+ecx*4+0x80]
    'nOutdoorRooms': ['D2Common.dll', 0x6FD8D5D9, 2, 4, '8b8f'],                 # mov ecx, [edi+0x260]
    'pOutdoorLevelLinks': ['D2Common.dll', 0x6FD8D5AB, 2, 4, '8bb7'],            # mov esi, [edi+0x264]
})

# Iteration 14 (k1r13 Lane C) additions.
STRUCT_SIZE_PE_PROBES.update({
    'D2RunesTxt': ('D2Common.dll', 0x6FD76D12, '81c5', 2, 4, 1),                 # add ebp, 0x120
})
FIELD_PE_PROBES['D2RunesTxt'] = {
    'props': ['D2Common.dll', 0x6FD967E8, 2, 4, '8db8'],                         # lea edi, [eax+0xb0]
}
FIELD_PE_PROBES['D2DrlgStrc'].update({
    'bRoomStatusFlag': ['D2Common.dll', 0x6FDCC3AA, 2, 4, '888f'],               # mov [edi+0x45c], cl
})
FIELD_PE_PROBES['D2MonStats2Txt'].update({
    'nComponentCounts': ['D2Common.dll', 0x6FDD4CA5, 4, 1, '0fb64c30'],          # movzx ecx, byte [eax+esi+0x15]
    'nComponentVariants': ['D2Common.dll', 0x6FDD4CC1, 4, 1, '0fb64c18'],        # movzx ecx, byte [eax+ebx+0x26]
})
FIELD_PE_PROBES['D2CharStatsTxt'].update({
    'wStartSkill': ['D2Common.dll', 0x6FDA2A48, 2, 4, '81c6'],                   # add esi, 0xae
})
FIELD_PE_PROBES['D2SetItemsTxt'].update({
    'wSetId': ['D2Common.dll', 0x6FD95FDC, 3, 1, '0fbf40'],                      # movsx eax, word [eax+0x2c]
    'nAddFunc': ['D2Common.dll', 0x6FD961F7, 2, 4, '8a89'],                      # mov cl, [ecx+0x87]
    'baseProps': ['D2Common.dll', 0x6FD96182, 2, 4, '81c7'],                     # add edi, 0x88
    'addProps': ['D2Common.dll', 0x6FD961E7, 2, 4, '81c7'],                      # add edi, 0x118
})
FIELD_PE_PROBES['D2UniqueItemsTxt'].update({
    'props': ['D2Common.dll', 0x6FD9612B, 2, 4, '8db8'],                         # lea edi, [eax+0x8c]
})
FIELD_PE_PROBES['D2SetsTxt'] = {
    'nItems': ['D2Common.dll', 0x6FD96063, 2, 1, '3b4f'],                        # cmp ecx, [edi+0xc]
    'pCode': ['D2Common.dll', 0x6FD9602E, 2, 1, '83c7'],                         # add edi, 0x10
    'fCode': ['D2Common.dll', 0x6FD9606B, 2, 4, '81c7'],                         # add edi, 0x90
}


def field(struct_name, name):
    for f in LAYOUT[struct_name]['fields']:
        if f['name'] == name or name in f.get('aliases', []):
            return f
    raise KeyError(f'{struct_name}.{name}')


def rd(block, struct_name, name, index=0):
    f = field(struct_name, name)
    size = TYPE_SIZES[f['type']]
    off = f['off'] + index * size
    raw = bytes.fromhex(block['h'])[off:off + size]
    if len(raw) != size:
        return -1
    return int.from_bytes(raw, 'little')


fails = 0
checks = 0


def check(ok, msg):
    global fails, checks
    checks += 1
    if not ok:
        fails += 1
    print(('ok   ' if ok else 'FAIL ') + msg)


def resolve_d2_data_dir():
    for cand in (
        os.environ.get('D2_DATA_DIR'),
        os.path.join(os.path.expanduser('~'), 'd2-data'),
        os.path.join(HERE, '..', '..', 'samples', 'd2'),
    ):
        if cand and os.path.isfile(os.path.join(cand, 'D2Game.dll')):
            return cand
    raise FileNotFoundError('Could not locate 1.13c DLL directory (D2_DATA_DIR or ~/d2-data)')


def load_pe(path):
    with open(path, 'rb') as f:
        raw = f.read()
    e_lfanew = struct.unpack_from('<I', raw, 0x3C)[0]
    num_sec = struct.unpack_from('<H', raw, e_lfanew + 6)[0]
    opt_size = struct.unpack_from('<H', raw, e_lfanew + 20)[0]
    img_base = struct.unpack_from('<I', raw, e_lfanew + 52)[0]
    sec_off = e_lfanew + 24 + opt_size
    secs = []
    for i in range(num_sec):
        vsize, rva, raw_size, raw_ptr = struct.unpack_from('<IIII', raw, sec_off + i * 40 + 8)
        secs.append((rva, max(vsize, raw_size), raw_ptr))
    return raw, img_base, secs


def va_to_off(pe, va):
    raw, img_base, secs = pe
    rva = va - img_base
    for sec_rva, sec_len, raw_ptr in secs:
        if sec_rva <= rva < sec_rva + sec_len:
            return raw_ptr + (rva - sec_rva)
    raise ValueError(f'VA {va:#x} not mapped in PE sections')


def verify_binary_struct_layouts():
    d2_dir = resolve_d2_data_dir()
    pes = {
        dll: load_pe(os.path.join(d2_dir, dll))
        for dll in ('D2Common.dll', 'D2Game.dll', 'D2Client.dll')
    }
    check(set(LAYOUT.keys()) == set(STRUCT_SIZE_PE_PROBES.keys()),
          f'PE probe table covers all {len(STRUCT_SIZE_PE_PROBES)} structs')

    for sname, sdef in LAYOUT.items():
        probe = STRUCT_SIZE_PE_PROBES.get(sname)
        if probe is None:
            check(False, f'PE size probe missing for {sname}')
            continue
        dll, va, pfx_hex, disp_pos, disp_len, scale = probe
        pe = pes[dll]
        foff = va_to_off(pe, va)
        raw = pe[0]
        pfx = bytes.fromhex(pfx_hex)
        pfx_ok = raw[foff:foff + len(pfx)] == pfx
        pe_size = int.from_bytes(raw[foff + disp_pos:foff + disp_pos + disp_len], 'little') * scale
        check(pfx_ok and sdef['size'] == pe_size and bool(sdef.get('allocEvidence')),
              f'PE sizeof({sname}) == {sdef["size"]} ({pe_size:#x}) at {dll}@{va:#x}')

        fprobes = FIELD_PE_PROBES.get(sname, {})
        occupied = []
        for f in sdef['fields']:
            fname = f['name']
            foff_decl = f['off']
            fsize = TYPE_SIZES[f['type']] * int(f.get('count', 1))
            in_bounds = 0 <= foff_decl and (foff_decl + fsize) <= sdef['size']
            overlap = any(not (foff_decl + fsize <= a or foff_decl >= b) for a, b in occupied)
            occupied.append((foff_decl, foff_decl + fsize))
            fprobe = fprobes.get(fname)
            if fprobe is None:
                check(False, f'PE field probe missing for {sname}.{fname}')
                continue
            fdll, fva, fdisp_pos, fdisp_len, fpfx_hex = fprobe
            fpe = pes[fdll]
            insn_off = va_to_off(fpe, fva)
            fraw = fpe[0]
            fpfx = bytes.fromhex(fpfx_hex)
            fpfx_ok = fraw[insn_off:insn_off + len(fpfx)] == fpfx
            if fdisp_len == 0:
                modrm = fraw[insn_off + fdisp_pos]
                pe_off = 0 if ((modrm & 0xC0) == 0x00 and (modrm & 0x07) not in (4, 5)) else -1
            else:
                pe_off = int.from_bytes(
                    fraw[insn_off + fdisp_pos:insn_off + fdisp_pos + fdisp_len],
                    'little',
                )
            check(in_bounds and (not overlap) and fpfx_ok and foff_decl == pe_off,
                  f'PE {sname}.{fname} +{foff_decl:#x} == {fdll}@{fva:#x} (+{pe_off:#x})')


def verify_trace(path):
    opener = gzip.open if path.endswith('.gz') else open
    for raw_line in opener(path, 'rt', encoding='utf-8'):
        try:
            o = json.loads(raw_line)
        except Exception:
            continue
        if 'mem' not in o:
            continue
        frame = o['frame']
        rows = {(0, r[0]): r for r in o.get('t0', [])}
        rows.update({(1, r[0]): r for r in o.get('t1', [])})
        dmg_entries = o.get('dmg', [])
        oracle_meta = o.get('oracle')
        alloc_sizes = o.get('alloc_sizes')

        frame_unit_addrs = set()
        for d0 in o['mem']:
            for b0 in d0['blocks']:
                if b0['n'] == 'unit' and b0['h'] is not None:
                    frame_unit_addrs.add(b0['a'])

        for dump in o['mem']:
            blocks = {}
            events = []
            child_lists = []
            adj_rooms = []
            room_units = []
            for b in dump['blocks']:
                if b['h'] is None:
                    continue
                if b['n'] == 'event':
                    events.append(b)
                elif b['n'] == 'childstatlist':
                    child_lists.append(b)
                elif b['n'] == 'adjroom':
                    adj_rooms.append(b)
                elif b['n'] == 'roomunit':
                    room_units.append(b)
                elif b['n'] not in ('aiminion', 'childstats'):
                    blocks[b['n']] = b
            tag = f"F{frame} {dump['type']}:{dump['id']}"
            game, timer, unit = blocks.get('game'), blocks.get('timer'), blocks.get('unit')

            if alloc_sizes is not None:
                for sname in (
                    'D2GameStrc', 'D2TimerStrc', 'D2UnitStrc', 'D2DynamicPathStrc',
                    'D2StatListExStrc', 'D2StatListStrc', 'D2ActStrc', 'D2EnvironmentStrc',
                    'D2ActiveRoomStrc', 'D2RoomExStrc', 'D2RoomCoordListStrc',
                    'D2MonsterDataStrc', 'D2AiGeneralStrc', 'D2AiControlStrc',
                ):
                    actual_alloc = alloc_sizes.get(sname, 0)
                    check(actual_alloc > 0 and actual_alloc == LAYOUT[sname]['size'],
                          f'{tag} Fog alloc_size({sname}) == {actual_alloc} == layout {LAYOUT[sname]["size"]}')
                ev_chunk = alloc_sizes.get('D2EventPoolChunk', 0)
                check(ev_chunk == 600 * LAYOUT['D2EventStrc']['size'] + 8,
                      f'{tag} Fog alloc_size(D2EventPoolChunk) == {ev_chunk} == 600 * {LAYOUT["D2EventStrc"]["size"]} + 8')

            check(rd(game, 'D2GameStrc', 'dwGameFrame') == frame, f'{tag} game.dwGameFrame == trace frame')
            check(rd(game, 'D2GameStrc', 'pTimer') == timer['a'], f'{tag} game.pTimer == timer block')
            check(rd(timer, 'D2TimerStrc', 'nCurrentSlot') == frame % 64, f'{tag} timer.nCurrentSlot == frame & 63')
            game_raw_len = len(bytes.fromhex(game['h']))
            if game_raw_len >= LAYOUT['D2GameStrc']['size'] or alloc_sizes is not None:
                check(game_raw_len == LAYOUT['D2GameStrc']['size'],
                      f'{tag} full D2GameStrc size == {LAYOUT["D2GameStrc"]["size"]} (0x1DF4)')
                spawn_sum = sum(rd(game, 'D2GameStrc', 'dwMonSpawnCount', k) for k in range(1, 17))
                spawn_total = rd(game, 'D2GameStrc', 'dwMonSpawnTotal')
                check(spawn_total == spawn_sum,
                      f'{tag} game.dwMonSpawnTotal (+0x1DB4) == sum(dwMonSpawnCount[1..16] +0x1D74..+0x1DB0)')
                if alloc_sizes is not None:
                    check(spawn_total > 0 and rd(game, 'D2GameStrc', 'dwMonSpawnCount', 0) > 0,
                          f'{tag} live game.dwMonSpawnTotal ({spawn_total}) > 0 and dwMonSpawnCount[0] > 0')
                check(rd(game, 'D2GameStrc', 'dwUberStateEnd') in (0, 1),
                      f'{tag} game.dwUberStateEnd (+0x1DF0) in {{0,1}}')
            gs = o.get('gs')
            if gs:
                check([rd(game, 'D2GameStrc', 'seedLo'), rd(game, 'D2GameStrc', 'seedHi')] == gs,
                      f'{tag} game seed == trace gs')
            if unit is None:
                check(False, f'{tag} unit found')
                continue
            if alloc_sizes is not None:
                check(len(bytes.fromhex(unit['h'])) == LAYOUT['D2UnitStrc']['size'],
                      f'{tag} unit block size == {LAYOUT["D2UnitStrc"]["size"]} (0xF4)')
            row = rows.get((dump['type'], dump['id']))
            check(rd(unit, 'D2UnitStrc', 'dwUnitType') == dump['type'], f'{tag} unit.dwUnitType')
            check(rd(unit, 'D2UnitStrc', 'dwUnitId') == dump['id'], f'{tag} unit.dwUnitId')
            check(rd(unit, 'D2UnitStrc', 'pGame') == game['a'], f'{tag} unit.pGame == game block')
            unit_act = rd(unit, 'D2UnitStrc', 'pAct')
            unit_act_no = rd(unit, 'D2UnitStrc', 'nAct')
            check(unit_act != 0 and rd(game, 'D2GameStrc', 'pAct', unit_act_no) == unit_act,
                  f'{tag} game.pAct[{unit_act_no}] == unit.pAct')
            if row is not None:
                check(rd(unit, 'D2UnitStrc', 'dwClassId') == row[1], f'{tag} unit.dwClassId == trace class')
                check(rd(unit, 'D2UnitStrc', 'dwAnimMode') == row[2], f'{tag} unit.dwAnimMode == trace mode')
                check([rd(unit, 'D2UnitStrc', 'seedLo'), rd(unit, 'D2UnitStrc', 'seedHi')] == [row[5], row[6]],
                      f'{tag} unit seed == trace seed')
            data = blocks.get('data')
            check(data is not None and rd(unit, 'D2UnitStrc', 'pUnitData') == data['a'], f'{tag} unit.pUnitData == data block')

            path_blk = blocks.get('path')
            check(path_blk is not None and rd(unit, 'D2UnitStrc', 'pPath') == path_blk['a'], f'{tag} unit.pPath == path block')
            if path_blk is not None and row is not None:
                check(rd(path_blk, 'D2DynamicPathStrc', 'wPosX') == row[3], f'{tag} path.wPosX == trace x')
                check(rd(path_blk, 'D2DynamicPathStrc', 'wPosY') == row[4], f'{tag} path.wPosY == trace y')
                check(rd(path_blk, 'D2DynamicPathStrc', 'pUnit') == unit['a'], f'{tag} path.pUnit == unit')

            slex = blocks.get('statlistex')
            check(slex is not None and rd(unit, 'D2UnitStrc', 'pStatListEx') == slex['a'],
                  f'{tag} unit.pStatListEx == statlistex block')
            if slex is not None:
                check(rd(slex, 'D2StatListExStrc', 'eOwnerType') == dump['type'], f'{tag} slex.eOwnerType')
                check(rd(slex, 'D2StatListExStrc', 'dwOwnerId') == dump['id'], f'{tag} slex.dwOwnerId')
                check((rd(slex, 'D2StatListExStrc', 'dwFlags') & 0x80000000) != 0, f'{tag} slex.dwFlags EXTENDED')
                check(rd(slex, 'D2StatListExStrc', 'pOwner') == unit['a'], f'{tag} slex.pOwner == unit')
                check(rd(slex, 'D2StatListExStrc', 'pGame') == game['a'], f'{tag} slex.pGame == game')
                sf = blocks.get('stateflags')
                check(sf is not None and rd(slex, 'D2StatListExStrc', 'pStateFlags') == sf['a'],
                      f'{tag} slex.pStateFlags == stateflags block')
                mystats = blocks.get('mystats')
                if mystats is not None:
                    check(rd(slex, 'D2StatListExStrc', 'pStat') == mystats['a'], f'{tag} slex.pStat == mystats')
                    my_cnt = rd(slex, 'D2StatListExStrc', 'wStatCount')
                    my_cap = rd(slex, 'D2StatListExStrc', 'wStatCapacity')
                    check(0 <= my_cnt <= my_cap and my_cnt * 8 == len(bytes.fromhex(mystats['h'])),
                          f'{tag} slex.wStatCount/wStatCapacity ({my_cnt}/{my_cap})')
                fullstats = blocks.get('fullstats')
                if fullstats is not None:
                    check(rd(slex, 'D2StatListExStrc', 'pFullStat') == fullstats['a'],
                          f'{tag} slex.pFullStat == fullstats')
                    f_cnt = rd(slex, 'D2StatListExStrc', 'wFullStatCount')
                    f_cap = rd(slex, 'D2StatListExStrc', 'wFullStatCapacity')
                    check(0 <= f_cnt <= f_cap and f_cnt * 8 == len(bytes.fromhex(fullstats['h'])),
                          f'{tag} slex.wFullStatCount/wFullStatCapacity ({f_cnt}/{f_cap})')
                last_sub = rd(slex, 'D2StatListExStrc', 'pMyLastList')
                check((last_sub == 0) == (len(child_lists) == 0) and (not child_lists or child_lists[0]['a'] == last_sub),
                      f'{tag} slex.pMyLastList == first childstatlist ({len(child_lists)} sublists)')
                for ci, cl in enumerate(child_lists):
                    check(rd(cl, 'D2StatListStrc', 'pParent') == slex['a'], f'{tag} childstatlist[{ci}].pParent == slex')
                    check(rd(cl, 'D2StatListStrc', 'pUnit') == unit['a'], f'{tag} childstatlist[{ci}].pUnit == unit')
                    exp_prev = child_lists[ci + 1]['a'] if ci + 1 < len(child_lists) else 0
                    check(rd(cl, 'D2StatListStrc', 'pPrevLink') == exp_prev, f'{tag} childstatlist[{ci}].pPrevLink chain')
                    if ci > 0:
                        check(rd(cl, 'D2StatListStrc', 'pNextLink') == child_lists[ci - 1]['a'],
                              f'{tag} childstatlist[{ci}].pNextLink chain')

            dmg_blk = blocks.get('damage')
            if dmg_blk is not None:
                check(len(bytes.fromhex(dmg_blk['h'])) == LAYOUT['D2DamageStrc']['size'],
                      f'{tag} D2DamageStrc block size == 112')
                match_dmg = next((d for d in dmg_entries if d['def'] == [dump['type'], dump['id']]), None)
                check(match_dmg is not None, f'{tag} trace dmg entry present for D2DamageStrc')
                if match_dmg is not None:
                    raw = match_dmg['raw']
                    check(rd(dmg_blk, 'D2DamageStrc', 'dwHitFlags') == raw[0], f'{tag} dmg.dwHitFlags == raw[0]')
                    check(rd(dmg_blk, 'D2DamageStrc', 'wResultFlags') == raw[1], f'{tag} dmg.wResultFlags == raw[1]')
                    check(rd(dmg_blk, 'D2DamageStrc', 'dwPhysDamage') == raw[2], f'{tag} dmg.dwPhysDamage == raw[2]')
                    check(rd(dmg_blk, 'D2DamageStrc', 'dwDmgTotal') == match_dmg['ret'],
                          f'{tag} dmg.dwDmgTotal == dmg.ret ({match_dmg["ret"]})')

            if dump['type'] == 1 and data is not None:
                ag, ac = blocks.get('aigeneral'), blocks.get('aicontrol')
                check(ag is not None and rd(data, 'D2MonsterDataStrc', 'pAiGeneral') == ag['a'], f'{tag} data.pAiGeneral')
                check(ac is not None and rd(data, 'D2MonsterDataStrc', 'pAiControl') == ac['a'], f'{tag} data.pAiControl')
                check(rd(data, 'D2MonsterDataStrc', 'pMonStatsTxt') != 0, f'{tag} data.pMonStatsTxt non-null')

            monunit = blocks.get('monunit')
            mondata = blocks.get('mondata')
            if monunit is not None and mondata is not None:
                ag, ac = blocks.get('aigeneral'), blocks.get('aicontrol')
                check(rd(monunit, 'D2UnitStrc', 'dwUnitType') == 1, f'{tag} monunit.dwUnitType == 1')
                check(rd(monunit, 'D2UnitStrc', 'pUnitData') == mondata['a'], f'{tag} monunit.pUnitData == mondata')
                check(ag is not None and rd(mondata, 'D2MonsterDataStrc', 'pAiGeneral') == ag['a'], f'{tag} mondata.pAiGeneral')
                check(ac is not None and rd(mondata, 'D2MonsterDataStrc', 'pAiControl') == ac['a'], f'{tag} mondata.pAiControl')
                check(rd(mondata, 'D2MonsterDataStrc', 'pMonStatsTxt') != 0, f'{tag} mondata.pMonStatsTxt non-null')

            first = rd(unit, 'D2UnitStrc', 'pEventFirst')
            check((first == 0) == (len(events) == 0) and (not events or events[0]['a'] == first),
                  f'{tag} unit.pEventFirst == first event block ({len(events)} events)')
            for i, ev in enumerate(events):
                check(rd(ev, 'D2EventStrc', 'pUnit') == unit['a'], f'{tag} event[{i}].pUnit == unit')
                check(rd(ev, 'D2EventStrc', 'dwUnitId') == dump['id'], f'{tag} event[{i}].dwUnitId')
                check(rd(ev, 'D2EventStrc', 'dwUnitType') == dump['type'], f'{tag} event[{i}].dwUnitType')
                nxt = rd(ev, 'D2EventStrc', 'pUnitNext')
                exp = events[i + 1]['a'] if i + 1 < len(events) else 0
                check(nxt == exp, f'{tag} event[{i}].pUnitNext chain')
                if i > 0:
                    check(rd(ev, 'D2EventStrc', 'pUnitPrev') == events[i - 1]['a'], f'{tag} event[{i}].pUnitPrev chain')
                fr = rd(ev, 'D2EventStrc', 'dwFrame')
                part = {0: 0, 1: 1, 2: 3, 3: 2, 4: 4}[dump['type']]
                if fr == 0xFFFFFFFF:
                    continue
                slot = part * 64 + (fr & 63)
                head = rd(timer, 'D2TimerStrc', 'pSlotHead', slot)
                tail = rd(timer, 'D2TimerStrc', 'pSlotTail', slot)
                check(head != 0 and tail != 0, f'{tag} event[{i}] type {rd(ev, "D2EventStrc", "nType")} frame {fr}: wheel slot {slot} populated')
                if head == ev['a']:
                    check(rd(ev, 'D2EventStrc', 'pWheelNewer') == 0, f'{tag} event[{i}] is slot head -> no newer node')
                if tail == ev['a']:
                    check(rd(ev, 'D2EventStrc', 'pWheelOlder') == 0, f'{tag} event[{i}] is slot tail -> no older node')

            room = blocks.get('room')
            if room is not None:
                check(len(bytes.fromhex(room['h'])) == LAYOUT['D2ActiveRoomStrc']['size'],
                      f'{tag} D2ActiveRoomStrc size == 128')
                if path_blk is not None:
                    check(rd(path_blk, 'D2DynamicPathStrc', 'pRoom') == room['a'], f'{tag} path.pRoom == room')
                if oracle_meta is not None:
                    check(oracle_meta['unitRoom'] == room['a'],
                          f'{tag} D2Common.#10331(unit) == room block')
                    rc = oracle_meta['roomCoords']
                    check([
                        rd(room, 'D2ActiveRoomStrc', 'nSubtileX'),
                        rd(room, 'D2ActiveRoomStrc', 'nSubtileY'),
                        rd(room, 'D2ActiveRoomStrc', 'nSubtileWidth'),
                        rd(room, 'D2ActiveRoomStrc', 'nSubtileHeight'),
                        rd(room, 'D2ActiveRoomStrc', 'nTileX'),
                        rd(room, 'D2ActiveRoomStrc', 'nTileY'),
                        rd(room, 'D2ActiveRoomStrc', 'nTileWidth'),
                        rd(room, 'D2ActiveRoomStrc', 'nTileHeight'),
                    ] == rc, f'{tag} room coords match D2Common.#10561(room)')
                check(rd(room, 'D2ActiveRoomStrc', 'pAct') == unit_act, f'{tag} room.pAct == unit.pAct')
                check(rd(room, 'D2ActiveRoomStrc', 'pRoomEx') != 0, f'{tag} room.pRoomEx non-null')
                check(rd(room, 'D2ActiveRoomStrc', 'pCoords') != 0, f'{tag} room.pCoords non-null')
                check(rd(room, 'D2ActiveRoomStrc', 'pCollisionGrid') != 0, f'{tag} room.pCollisionGrid non-null')
                check(rd(room, 'D2ActiveRoomStrc', 'nRoomsNear') == 1 + len(adj_rooms),
                      f'{tag} room.nRoomsNear == 1 + adjrooms ({1 + len(adj_rooms)})')
                check(rd(room, 'D2ActiveRoomStrc', 'nSubtileX') == rd(room, 'D2ActiveRoomStrc', 'nTileX') * 5,
                      f'{tag} room.nSubtileX == nTileX * 5')
                check(rd(room, 'D2ActiveRoomStrc', 'nSubtileY') == rd(room, 'D2ActiveRoomStrc', 'nTileY') * 5,
                      f'{tag} room.nSubtileY == nTileY * 5')
                check(rd(room, 'D2ActiveRoomStrc', 'nSubtileWidth') == rd(room, 'D2ActiveRoomStrc', 'nTileWidth') * 5,
                      f'{tag} room.nSubtileWidth == nTileWidth * 5')
                check(rd(room, 'D2ActiveRoomStrc', 'nSubtileHeight') == rd(room, 'D2ActiveRoomStrc', 'nTileHeight') * 5,
                      f'{tag} room.nSubtileHeight == nTileHeight * 5')

                head = rd(room, 'D2ActiveRoomStrc', 'pUnitFirst')
                nxt = rd(unit, 'D2UnitStrc', 'pRoomUnitNext')
                check(head != 0, f'{tag} room.pUnitFirst non-null')
                if room_units:
                    check(room_units[0]['a'] == head, f'{tag} room.pUnitFirst == roomunit[0]')
                    check(any(ru['a'] == unit['a'] for ru in room_units),
                          f'{tag} unit reachable from room.pUnitFirst chain ({len(room_units)} units)')
                    for ri, ru in enumerate(room_units):
                        exp_ru_next = room_units[ri + 1]['a'] if ri + 1 < len(room_units) else 0
                        check(rd(ru, 'D2UnitStrc', 'pRoomUnitNext') == exp_ru_next,
                              f'{tag} roomunit[{ri}].pRoomUnitNext chain')
                else:
                    check(head == unit['a'] or nxt != 0,
                          f'{tag} room list link non-tautological (head {head:#x}, next {nxt:#x})')
                if head == unit['a'] and len(frame_unit_addrs) > 1 and nxt in frame_unit_addrs:
                    check(nxt != unit['a'], f'{tag} room head pRoomUnitNext links to peer unit {nxt:#x}')
                idx = rd(room, 'D2ActiveRoomStrc', 'bDeathRingIdx')
                check(idx < 4, f'{tag} room.bDeathRingIdx in 0..3 ({idx})')

            act_blk = blocks.get('act')
            env_blk = blocks.get('env')
            if act_blk is not None:
                check(len(bytes.fromhex(act_blk['h'])) == LAYOUT['D2ActStrc']['size'],
                      f'{tag} D2ActStrc size == 96 (0x60)')
                check(act_blk['a'] == unit_act, f'{tag} act block == unit.pAct')
                check(rd(act_blk, 'D2ActStrc', 'nAct') == unit_act_no, f'{tag} act.nAct == unit.nAct')
                if oracle_meta is not None:
                    check(rd(act_blk, 'D2ActStrc', 'dwTownId') == oracle_meta['roomLevelId'],
                          f'{tag} act.dwTownId == D2Common.#10826(room)')
                else:
                    check(rd(act_blk, 'D2ActStrc', 'dwTownId') >= 1, f'{tag} act.dwTownId >= 1')
                check(rd(act_blk, 'D2ActStrc', 'pRoom1') != 0, f'{tag} act.pRoom1 non-null')
                check(rd(act_blk, 'D2ActStrc', 'pDrlg') != 0, f'{tag} act.pDrlg non-null')
                if env_blk is not None:
                    check(rd(act_blk, 'D2ActStrc', 'pEnvironment') == env_blk['a'],
                          f'{tag} act.pEnvironment == env block')
            if env_blk is not None:
                check(len(bytes.fromhex(env_blk['h'])) == LAYOUT['D2EnvironmentStrc']['size'],
                      f'{tag} D2EnvironmentStrc size == 56 (0x38)')
                check(rd(env_blk, 'D2EnvironmentStrc', 'dwCycleIndex') < 6, f'{tag} env.dwCycleIndex < 6')
                check(rd(env_blk, 'D2EnvironmentStrc', 'dwCyclePeriod') > 0, f'{tag} env.dwCyclePeriod > 0')
                check(rd(env_blk, 'D2EnvironmentStrc', 'dwIntensity') > 0, f'{tag} env.dwIntensity > 0')
                check(rd(env_blk, 'D2EnvironmentStrc', 'bRed') > 0 and rd(env_blk, 'D2EnvironmentStrc', 'bGreen') > 0
                      and rd(env_blk, 'D2EnvironmentStrc', 'bBlue') > 0,
                      f'{tag} env RGB channels initialized')

            roomex = blocks.get('roomex')
            if roomex is not None and room is not None:
                check(len(bytes.fromhex(roomex['h'])) == LAYOUT['D2RoomExStrc']['size'],
                      f'{tag} D2RoomExStrc size == 236 (0xEC)')
                check(rd(room, 'D2ActiveRoomStrc', 'pRoomEx') == roomex['a'], f'{tag} room.pRoomEx == roomex block')
                check(rd(roomex, 'D2RoomExStrc', 'pRoom1') == room['a'], f'{tag} roomex.pRoom1 == room block')
                check(rd(roomex, 'D2RoomExStrc', 'nTileXPos') == rd(room, 'D2ActiveRoomStrc', 'nTileX'),
                      f'{tag} roomex.nTileXPos == room.nTileX')
                check(rd(roomex, 'D2RoomExStrc', 'nTileYPos') == rd(room, 'D2ActiveRoomStrc', 'nTileY'),
                      f'{tag} roomex.nTileYPos == room.nTileY')
                check(rd(roomex, 'D2RoomExStrc', 'nTileWidth') == rd(room, 'D2ActiveRoomStrc', 'nTileWidth'),
                      f'{tag} roomex.nTileWidth == room.nTileWidth')
                check(rd(roomex, 'D2RoomExStrc', 'nTileHeight') == rd(room, 'D2ActiveRoomStrc', 'nTileHeight'),
                      f'{tag} roomex.nTileHeight == room.nTileHeight')
                check(rd(roomex, 'D2RoomExStrc', 'nRoomStatus') < 4,
                      f'{tag} roomex.nRoomStatus in 0..3')
                check(rd(roomex, 'D2RoomExStrc', 'pLevel') != 0, f'{tag} roomex.pLevel non-null')
                check(rd(roomex, 'D2RoomExStrc', 'pLogicalRoomInfo') != 0, f'{tag} roomex.pLogicalRoomInfo non-null')

            collgrid = blocks.get('collgrid')
            if collgrid is not None and room is not None:
                check(len(bytes.fromhex(collgrid['h'])) == LAYOUT['D2RoomCollisionGridStrc']['size'],
                      f'{tag} D2RoomCollisionGridStrc size == 36 (0x24)')
                check(rd(room, 'D2ActiveRoomStrc', 'pCollisionGrid') == collgrid['a'],
                      f'{tag} room.pCollisionGrid == collgrid block')
                sw = rd(collgrid, 'D2RoomCollisionGridStrc', 'nSubtileWidth')
                sh = rd(collgrid, 'D2RoomCollisionGridStrc', 'nSubtileHeight')
                check(rd(collgrid, 'D2RoomCollisionGridStrc', 'nSubtileX') == rd(room, 'D2ActiveRoomStrc', 'nSubtileX'),
                      f'{tag} collgrid.nSubtileX == room.nSubtileX')
                check(rd(collgrid, 'D2RoomCollisionGridStrc', 'nSubtileY') == rd(room, 'D2ActiveRoomStrc', 'nSubtileY'),
                      f'{tag} collgrid.nSubtileY == room.nSubtileY')
                check(sw == rd(room, 'D2ActiveRoomStrc', 'nSubtileWidth'),
                      f'{tag} collgrid.nSubtileWidth == room.nSubtileWidth')
                check(sh == rd(room, 'D2ActiveRoomStrc', 'nSubtileHeight'),
                      f'{tag} collgrid.nSubtileHeight == room.nSubtileHeight')
                check(rd(collgrid, 'D2RoomCollisionGridStrc', 'nTileX') == rd(room, 'D2ActiveRoomStrc', 'nTileX'),
                      f'{tag} collgrid.nTileX == room.nTileX')
                check(rd(collgrid, 'D2RoomCollisionGridStrc', 'nTileY') == rd(room, 'D2ActiveRoomStrc', 'nTileY'),
                      f'{tag} collgrid.nTileY == room.nTileY')
                check(rd(collgrid, 'D2RoomCollisionGridStrc', 'nTileWidth') == rd(room, 'D2ActiveRoomStrc', 'nTileWidth'),
                      f'{tag} collgrid.nTileWidth == room.nTileWidth')
                check(rd(collgrid, 'D2RoomCollisionGridStrc', 'nTileHeight') == rd(room, 'D2ActiveRoomStrc', 'nTileHeight'),
                      f'{tag} collgrid.nTileHeight == room.nTileHeight')
                check(rd(collgrid, 'D2RoomCollisionGridStrc', 'pMapStart') == collgrid['a'] + LAYOUT['D2RoomCollisionGridStrc']['size'],
                      f'{tag} collgrid.pMapStart == collgrid + sizeof(D2RoomCollisionGridStrc)')
                if alloc_sizes is not None:
                    cg_alloc = alloc_sizes.get('D2RoomCollisionGridAlloc', 0)
                    check(cg_alloc - (2 * sw * sh + 4 * sh) == LAYOUT['D2RoomCollisionGridStrc']['size'],
                          f'{tag} Fog alloc_size(D2RoomCollisionGridStrc) header == {LAYOUT["D2RoomCollisionGridStrc"]["size"]}')

            coordlist = blocks.get('coordlist')
            if coordlist is not None and room is not None:
                check(len(bytes.fromhex(coordlist['h'])) == LAYOUT['D2RoomCoordListStrc']['size'],
                      f'{tag} D2RoomCoordListStrc size == 48 (0x30)')
                tx = rd(room, 'D2ActiveRoomStrc', 'nTileX')
                ty = rd(room, 'D2ActiveRoomStrc', 'nTileY')
                tw = rd(room, 'D2ActiveRoomStrc', 'nTileWidth')
                th = rd(room, 'D2ActiveRoomStrc', 'nTileHeight')
                check(tx <= rd(coordlist, 'D2RoomCoordListStrc', 'nBox0PosX')
                      < rd(coordlist, 'D2RoomCoordListStrc', 'nEndGameX') <= tx + tw,
                      f'{tag} coordlist.pBox[0] X within room tile bounds')
                check(ty <= rd(coordlist, 'D2RoomCoordListStrc', 'nBox0PosY')
                      < rd(coordlist, 'D2RoomCoordListStrc', 'nEndGameY') <= ty + th,
                      f'{tag} coordlist.pBox[0] Y within room tile bounds')
                check(tx <= rd(coordlist, 'D2RoomCoordListStrc', 'nBox1PosX')
                      < rd(coordlist, 'D2RoomCoordListStrc', 'nEndTileX') <= tx + tw,
                      f'{tag} coordlist.pBox[1] X within room tile bounds')
                check(ty <= rd(coordlist, 'D2RoomCoordListStrc', 'nBox1PosY')
                      < rd(coordlist, 'D2RoomCoordListStrc', 'nEndTileY') <= ty + th,
                      f'{tag} coordlist.pBox[1] Y within room tile bounds')
                check(rd(coordlist, 'D2RoomCoordListStrc', 'nIndex') >= 1,
                      f'{tag} coordlist.nIndex >= 1')


def main():
    verify_binary_struct_layouts()
    paths = sys.argv[1:] or [
        os.path.join(HERE, '..', '..', 'tests', 'fixtures', 'oracle', 'route2', 'a1c-memdump-f820.ndjson.gz'),
    ]
    for p in paths:
        verify_trace(p)
    print(f'Summary: {checks - fails}/{checks} checks passed, {fails} failed')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
