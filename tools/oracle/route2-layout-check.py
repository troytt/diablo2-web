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
