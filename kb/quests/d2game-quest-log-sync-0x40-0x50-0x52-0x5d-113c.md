# 1.13c Quest Log Request (`C2S 0x40`) & Quest Status Sync (`S2C 0x28`, `0x50`, `0x52`, `0x5D`)

## Binary Ground Truth

- **`D2Game.dll` (1.13c, base `0x6fc20000`)**:
  - `0x6fd1a078 + 0x40 * 8` -> `0x6fcebd30` (`PACKET_Recv40_QuestLogRequest`): invokes `0x6fc55640` (`QUESTS_SendLogUpdate`).
  - `0x6fc54c00` (`QUESTS_SendPlayerQuestFlags`): constructs `103`-byte `S2C 0x28` (`QuestInfo`) with `updateType = 6` (`0x6fc54c41: mov byte [esp+0x19], 6`), `unitId = 0`, `timer = 0`, and the `48` player quest flag words (`96` bytes). Using `updateType = 6, unitId = 0` avoids `D2Client.dll` `0x6fafb8a0`'s NPC interaction handshake branch (`0 <= updateType <= 5 && unitId > 0`).
  - `0x6fc53a30` (`QUESTS_DefaultStatusFilter`): resolves the default `0..13` quest status byte from player/game quest records (`QFLAG_COMPLETEDNOW = bit 13`, `QFLAG_REWARDGRANTED = bit 0`, `bActive` / `fState`).
  - `0x6fc554f0..0x6fc5563c` (`QUESTS_StatusCallback`): constructs `6`-byte `S2C 0x5D` (`QuestStatus`):
    - `pkt5D[0] = 0x5d`
    - `pkt5D[1] = pQuest->nQuest` (`0x6fc55579`: canonical protocol ID `0x01..0x06`, `0x08..0x0d`, `0x0f..0x14`, `0x16..0x18`, `0x1f..0x24`, **not** `nSeqId` `1..40`)
    - `pkt5D[2] = pQuest->fAlertFlags` (`0x6fc55561`: `0x20` on `A1Q1` Den of Evil and `A5Q2` Mount Arreat counter updates)
    - `pkt5D[3] = filterStatus` (`0x6fc5559e` / `0x6fc555e8`)
    - `pkt5D[4..5] = extra` (`0x6fc555fa..0x6fc55622`: `denRemaining` when `nSeqId == 1`, `ACT5Q2_GetRemainingSoldiers` when `nSeqId == 36` / `0x24`, else `0`).
  - `0x6fc55640..0x6fc55880` (`QUESTS_SendLogUpdate`):
    1. Calls `0x6fc54c00` (`S2C 0x28` with `updateType = 6, unitId = 0`).
    2. Zeroes `pkt52[1..41]` (`41` status filter bytes indexed by `nSeqId = 0..40`, matching `QUEST_LOG_DESCRIPTORS` row and `.d2s` quest word index) and populates each active quest via `pfnStatusFilter` (`[esi+0xe8]`) or `0x6fc53a30`.
    3. Builds `15`-byte `S2C 0x50` type `1` (`[1, den, tombOffset, barbs, 0, 0, 0]`):
       - `0x6fc55732..0x6fc557a7`: if `statusBytes[1] !== 0` (`A1Q1`), sets `words[1] = denRemaining`, `bSend50 = 1`.
       - `0x6fc557ac..0x6fc557df`: if `statusBytes[36] !== 0` (`A5Q2`, `nQuest == 0x20`), calls `0x6fc76b80` (`ACT5Q2_GetRemainingSoldiers`: `+5` per unopened cage `Objects.txt 473` + uncaged unrescued soldiers) into `words[3]`, `bSend50 = 1`.
       - `0x6fc557e4..0x6fc55820`: checks `QUESTRECORD_GetQuestState(pPlayerQuests, 12, 0)` or `(..., 12, 13)` (`word 12 = a2q4` Arcane Sanctuary, `(questFlags[12] & 0x2001) !== 0`). When set, calls `0x6fc2ab9e` (`DUNGEON_GetHoradricStaffTombLevelId(pAct[1])`, `66..72`) and writes `staffTombLevel - 66` (`0..6`) into `words[2]`, unconditionally sending `S2C 0x50` type `1`.
    4. Sends `42`-byte `S2C 0x52` (`0x6fc5586b..0x6fc55872`).

- **`D2Client.dll` (1.13c, base `0x6fab0000`)**:
  - `0x6fba8188`: `41`-row `QUEST_LOG_DESCRIPTORS` table; `0x6facc890` (`questLogRowIndex`) scans `+0x08` (`questId = nQuest`) to map `S2C 0x5D` `pkt5D[1]` to row `0..40`.
  - `0x6facc740`: `S2C 0x50` handler (`type == 1` stores `den`, `tombOffset`, `barbs`).
  - `0x6facdd50`: `S2C 0x52` handler (`memcpy` `41` status bytes into `0x6fbd2496` + `selectForActTab(actTab, 1)`).
  - `0x6face160`: `S2C 0x5D` handler (`(flags & 0x20) !== 0` updates `barbs` when `q == 0x20` and `den` + `statusBytes[1]` when `q == 0x01`).
  - `0x6faccf1d`: `A2Q6` (`row 14`) Quest Log page resolver returns slot `7` (`qstsa2q61a`, rendering `invps.dc6` frame `tombOffset`) when `(playerWords[12] & 0x2001) !== 0 && s == 1`.

## Canonical `wordIndex` (`nSeqId`) vs `protocolId` (`nQuest`) Table

| Act | Quest IDs | `wordIndex` (`S2C 0x28`/`0x29`/`0x52` row) | `protocolId` (`S2C 0x5D` `nQuest`) |
| --- | --- | --- | --- |
| I | `a1q1..a1q6` | `1..6` | `0x01..0x06` (`wordIndex`) |
| II | `a2q1..a2q6` | `9..14` | `0x08..0x0d` (`wordIndex - 1`) |
| III | `a3q1..a3q6` | `17..22` | `0x0f..0x14` (`wordIndex - 2`) |
| IV | `a4q1..a4q3` | `25..27` | `0x16..0x18` (`wordIndex - 3`) |
| V | `a5q1..a5q6` | `35..40` | `0x1f..0x24` (`wordIndex - 4`) |
