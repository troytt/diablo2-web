# D2Game.dll 1.13c MonAi dispatch table (gpMonsterAiTable)

> Reverse-engineered from `E:\Games\diablo_1.13\D2Game.dll` (2010-03-09 build,
> image base `0x6FC20000`, `.text` `0x6FC21000`..`0x6FD179B4`, `.data`
> `0x6FD1F000`..`0x6FD30000`).

## Table location and indexing

> **Correction Note (Issue #1466)**: `0x6FD274A8` is `gpSkillSrvDoFuncTable` (dispatched at `0x6FC4F3D2` by skill `srvdofunc`). The actual `MonAI.txt` 148-entry table (`gpMonsterAiFunctionTable`, 16-byte stride `{ dwAiFlag, pfnAiInit, pfnAiThink, pfnAiExtra }`) is at **`0x6FD2E788`**, indexed by `D2MonStatsTxt.wAI` (`+0x01C`) in `AIGENERAL_SetAiFunction` (`0x6FCC03D0`). See `kb/monsters/d2game-pet-hireable-ai-113c.md` for the exact `pfnAiThink` VAs of all pet and hireling AI rows.

- Table VA: **`0x6FD2E788`**, 148 entries of 16 bytes `{ dwAiFlag, pfnAiInit, pfnAiThink, pfnAiExtra }`,
  index `0..147` = `MonStats.txt` `AI` (`MonAI.txt` row order, `MONAI_113C_ROWS`).
- The table below was regenerated from the binary (2026-11-05). The previous version listed the
  `gpSkillSrvDoFuncTable` entries (`0x6FD274A8`) under the MonAI names, so its addresses were skill
  functions, not AI thinks. Verified rows: `Zombie` think `0x6FCA38B0`
  ([`d2game-zombie-ai-113c.md`](./d2game-zombie-ai-113c.md)), `Fallen` think `0x6FCA3130`
  ([`d2game-fallen-ai-113c.md`](./d2game-fallen-ai-113c.md)).
- `dwAiFlag` selects the driver's target search (`0x6FCBD160`, jump table `0x6FCBD20C`); flag 1 is the
  "skip the think while no player is inside `aidist`" tick (kb zombie §6).

## Full table

| Index | MonAi row | dwAiFlag | pfnAiInit | pfnAiThink | pfnAiExtra |
|------:|-----------|---:|---|---|---|
| 0 | `None` | 0 | `null` | `0x6fcbc990` | `null` |
| 1 | `Idle` | 0 | `null` | `0x6fcbcb00` | `null` |
| 2 | `Skeleton` | 1 | `null` | `0x6fca3ac0` | `null` |
| 3 | `Zombie` | 1 | `null` | `0x6fca38b0` | `null` |
| 4 | `Bighead` | 1 | `null` | `0x6fca74a0` | `null` |
| 5 | `BloodHawk` | 1 | `null` | `0x6fca3550` | `null` |
| 6 | `Fallen` | 1 | `null` | `0x6fca3130` | `null` |
| 7 | `Brute` | 1 | `null` | `0x6fca3ce0` | `null` |
| 8 | `SandRaider` | 1 | `null` | `0x6fca4a90` | `null` |
| 9 | `Wraith` | 1 | `null` | `0x6fc9d7c0` | `null` |
| 10 | `CorruptRogue` | 1 | `null` | `0x6fca2ec0` | `null` |
| 11 | `Baboon` | 1 | `null` | `0x6fca2990` | `null` |
| 12 | `Goatman` | 1 | `null` | `0x6fca2570` | `null` |
| 13 | `FallenShaman` | 1 | `null` | `0x6fca90a0` | `null` |
| 14 | `QuillRat` | 1 | `null` | `0x6fca26b0` | `null` |
| 15 | `SandMaggot` | 4 | `null` | `0x6fca7010` | `0x6fc9d670` |
| 16 | `ClawViper` | 1 | `null` | `0x6fca8d80` | `null` |
| 17 | `SandLeaper` | 1 | `null` | `0x6fca8810` | `null` |
| 18 | `PantherWoman` | 1 | `null` | `0x6fca4800` | `null` |
| 19 | `Swarm` | 1 | `null` | `0x6fca2430` | `null` |
| 20 | `Scarab` | 1 | `null` | `0x6fca20d0` | `null` |
| 21 | `Mummy` | 1 | `null` | `0x6fca1f50` | `null` |
| 22 | `GreaterMummy` | 1 | `null` | `0x6fca8380` | `null` |
| 23 | `Vulture` | 1 | `null` | `0x6fca9c30` | `null` |
| 24 | `Mosquito` | 1 | `null` | `0x6fca1c80` | `null` |
| 25 | `WillOWisp` | 1 | `null` | `0x6fca0f20` | `null` |
| 26 | `Arach` | 1 | `null` | `0x6fca0b00` | `null` |
| 27 | `ThornHulk` | 1 | `null` | `0x6fca08a0` | `null` |
| 28 | `Vampire` | 1 | `null` | `0x6fca6900` | `null` |
| 29 | `BatDemon` | 1 | `null` | `0x6fca0450` | `0x6fc9d550` |
| 30 | `Fetish` | 1 | `null` | `0x6fca00c0` | `null` |
| 31 | `NpcOutOfTown` | 0 | `null` | `0x6fc3bf60` | `null` |
| 32 | `Npc` | 0 | `null` | `0x6fc3db40` | `null` |
| 33 | `HellMeteor` | 1 | `null` | `0x6fc9d400` | `null` |
| 34 | `Andariel` | 1 | `null` | `0x6fc9fe60` | `null` |
| 35 | `CorruptArcher` | 1 | `null` | `0x6fca64a0` | `null` |
| 36 | `CorruptLancer` | 1 | `null` | `0x6fc9fb30` | `null` |
| 37 | `SkeletonBow` | 1 | `null` | `0x6fca6280` | `null` |
| 38 | `MaggotLarva` | 1 | `null` | `0x6fc9f9a0` | `null` |
| 39 | `PinHead` | 1 | `null` | `0x6fc9f760` | `null` |
| 40 | `MaggotEgg` | 1 | `null` | `0x6fc9d310` | `null` |
| 41 | `Towner` | 0 | `null` | `0x6fc3bc60` | `null` |
| 42 | `Vendor` | 0 | `null` | `0x6fcc58d0` | `null` |
| 43 | `FoulCrowNest` | 1 | `0x6fc9b4f0` | `0x6fc9d170` | `null` |
| 44 | `Duriel` | 1 | `null` | `0x6fca9430` | `null` |
| 45 | `Sarcophagus` | 1 | `0x6fc9b4f0` | `0x6fc9cfd0` | `null` |
| 46 | `ElementalBeast` | 1 | `null` | `0x6fc9f5a0` | `null` |
| 47 | `FlyingScimitar` | 1 | `null` | `0x6fc9f370` | `null` |
| 48 | `ZakarumZealot` | 1 | `null` | `0x6fc9ed90` | `null` |
| 49 | `ZakarumPriest` | 1 | `null` | `0x6fca7e60` | `null` |
| 50 | `Mephisto` | 1 | `null` | `0x6fca5b60` | `null` |
| 51 | `Diablo` | 1 | `null` | `0x6fcc9610` | `0x6fcc59b0` |
| 52 | `FrogDemon` | 5 | `null` | `0x6fca9870` | `0x6fc9ce40` |
| 53 | `Summoner` | 1 | `null` | `0x6fca5780` | `null` |
| 54 | `NpcStationary` | 0 | `null` | `0x6fc39880` | `null` |
| 55 | `Izual` | 1 | `null` | `0x6fc9ea10` | `null` |
| 56 | `Tentacle` | 2 | `null` | `0x6fc9cb10` | `null` |
| 57 | `TentacleHead` | 2 | `null` | `0x6fca5500` | `null` |
| 58 | `Navi` | 0 | `null` | `0x6fcc80c0` | `null` |
| 59 | `BloodRaven` | 1 | `0x6fc35520` | `0x6fc39e70` | `null` |
| 60 | `GoodNpcRanged` | 0 | `null` | `0x6fc39740` | `null` |
| 61 | `Hireable` | 0 | `null` | `0x6fc3dd40` | `0x6fc36060` |
| 62 | `TownRogue` | 1 | `null` | `0x6fcc8350` | `null` |
| 63 | `GargoyleTrap` | 1 | `null` | `0x6fc9c910` | `null` |
| 64 | `SkeletonMage` | 1 | `null` | `0x6fca51e0` | `null` |
| 65 | `FetishShaman` | 1 | `null` | `0x6fca7bb0` | `0x6fc9c8c0` |
| 66 | `SandMaggotQueen` | 0 | `null` | `0x6fca7a60` | `null` |
| 67 | `NecroPet` | 0 | `null` | `0x6fc3e900` | `null` |
| 68 | `VileMother` | 1 | `null` | `0x6fca43f0` | `null` |
| 69 | `VileDog` | 1 | `null` | `0x6fc9e4d0` | `null` |
| 70 | `FingerMage` | 1 | `null` | `0x6fc9e070` | `null` |
| 71 | `Regurgitator` | 1 | `null` | `0x6fca3fe0` | `null` |
| 72 | `DoomKnight` | 1 | `null` | `0x6fc9df00` | `null` |
| 73 | `AbyssKnight` | 1 | `null` | `0x6fc9db70` | `null` |
| 74 | `OblivionKnight` | 1 | `null` | `0x6fca4db0` | `null` |
| 75 | `QuillMother` | 1 | `null` | `0x6fc9d910` | `null` |
| 76 | `EvilHole` | 1 | `null` | `0x6fca77b0` | `null` |
| 77 | `Trap-Missile` | 2 | `null` | `0x6fc9c580` | `null` |
| 78 | `Trap-RightArrow` | 1 | `null` | `0x6fc9c460` | `null` |
| 79 | `Trap-LeftArrow` | 1 | `null` | `0x6fc9c340` | `null` |
| 80 | `Trap-Poison` | 2 | `null` | `0x6fc9c1d0` | `null` |
| 81 | `JarJar` | 0 | `null` | `0x6fc3b950` | `null` |
| 82 | `InvisoSpawner` | 1 | `null` | `0x6fc3bca0` | `null` |
| 83 | `MosquitoNest` | 0 | `null` | `0x6fc364a0` | `null` |
| 84 | `BoneWall` | 0 | `0x6fc356c0` | `0x6fc36410` | `null` |
| 85 | `HighPriest` | 1 | `null` | `0x6fc39080` | `null` |
| 86 | `Hydra` | 2 | `null` | `0x6fcc57e0` | `null` |
| 87 | `Trap-Melee` | 1 | `null` | `0x6fc9bf50` | `null` |
| 88 | `7TIllusion` | 1 | `null` | `0x6fcc4b90` | `null` |
| 89 | `Megademon` | 1 | `null` | `0x6fc38ce0` | `null` |
| 90 | `Griswold` | 1 | `null` | `0x6fc372b0` | `null` |
| 91 | `DarkWanderer` | 1 | `null` | `0x6fcc6e60` | `null` |
| 92 | `Trap-Nova` | 1 | `null` | `0x6fc9c060` | `null` |
| 93 | `ArcaneTower` | 1 | `null` | `0x6fc36270` | `null` |
| 94 | `DesertTurret` | 1 | `null` | `0x6fc3c1e0` | `null` |
| 95 | `PantherJavelin` | 1 | `null` | `0x6fc3b780` | `null` |
| 96 | `FetishBlowgun` | 1 | `null` | `0x6fc3b2f0` | `null` |
| 97 | `Spirit` | 1 | `null` | `0x6fc360b0` | `null` |
| 98 | `Smith` | 1 | `null` | `0x6fc376b0` | `null` |
| 99 | `TrappedSoul` | 1 | `null` | `0x6fcc5580` | `null` |
| 100 | `Buffy` | 0 | `null` | `0x6fcc5d40` | `null` |
| 101 | `AssassinSentry` | 0 | `0x6fcc39b0` | `0x6fcc7dc0` | `null` |
| 102 | `BladeCreeper` | 0 | `0x6fcc3990` | `0x6fcc6b70` | `null` |
| 103 | `InvisoPet` | 0 | `null` | `0x6fcc5350` | `null` |
| 104 | `DeathSentry` | 0 | `0x6fcc39b0` | `0x6fcc7c20` | `null` |
| 105 | `ShadowWarrior` | 2 | `0x6fcc4450` | `0x6fccc410` | `null` |
| 106 | `ShadowMaster` | 2 | `0x6fcc4320` | `0x6fccb580` | `null` |
| 107 | `Raven` | 2 | `0x6fcc3c30` | `0x6fcca1d0` | `null` |
| 108 | `DruidWolf` | 0 | `null` | `0x6fccc8e0` | `null` |
| 109 | `Totem` | 0 | `null` | `0x6fcca4d0` | `null` |
| 110 | `Vines` | 2 | `0x6fcc3980` | `0x6fccb360` | `null` |
| 111 | `CycleOfLife` | 2 | `0x6fcc3980` | `0x6fccb070` | `null` |
| 112 | `DruidBear` | 0 | `null` | `0x6fcc9e80` | `null` |
| 113 | `SiegeTower` | 1 | `null` | `0x6fc389e0` | `null` |
| 114 | `ReanimatedHorde` | 1 | `null` | `0x6fc38a90` | `null` |
| 115 | `SiegeBeast` | 1 | `null` | `0x6fc38730` | `null` |
| 116 | `Minion` | 1 | `null` | `0x6fc38480` | `null` |
| 117 | `SuicideMinion` | 1 | `null` | `0x6fc38360` | `null` |
| 118 | `Succubus` | 1 | `null` | `0x6fc3af80` | `null` |
| 119 | `SuccubusWitch` | 1 | `null` | `0x6fc3a9f0` | `null` |
| 120 | `Overseer` | 1 | `null` | `0x6fc37cb0` | `null` |
| 121 | `MinionSpawner` | 1 | `0x6fc9b4f0` | `0x6fc37bc0` | `null` |
| 122 | `Imp` | 1 | `0x6fc35530` | `0x6fc3a550` | `null` |
| 123 | `Catapult` | 1 | `null` | `0x6fc36190` | `null` |
| 124 | `FrozenHorror` | 1 | `null` | `0x6fc379a0` | `null` |
| 125 | `BloodLord` | 1 | `null` | `0x6fc377e0` | `null` |
| 126 | `CatapultSpotter` | 1 | `null` | `0x6fcc4fd0` | `null` |
| 127 | `NpcBarb` | 2 | `0x6fcc3930` | `0x6fcc66e0` | `null` |
| 128 | `Nihlathak` | 2 | `0x6fcc3920` | `0x6fcc7580` | `0x6fc36060` |
| 129 | `GenericSpawner` | 1 | `0x6fc35540` | `0x6fc35e00` | `null` |
| 130 | `DeathMauler` | 1 | `null` | `0x6fcc6530` | `null` |
| 131 | `Wussie` | 2 | `null` | `0x6fcc7a10` | `null` |
| 132 | `AncientStatue` | 0 | `null` | `0x6fcc4f40` | `null` |
| 133 | `Ancient` | 2 | `null` | `0x6fcc7530` | `null` |
| 134 | `BaalThrone` | 2 | `0x6fcc3880` | `0x6fcc8430` | `null` |
| 135 | `BaalCrab` | 0 | `null` | `0x6fcd8610` | `0x6fcd78a0` |
| 136 | `BaalTaunt` | 1 | `null` | `0x6fcc9d40` | `null` |
| 137 | `PutridDefiler` | 1 | `null` | `0x6fcc7290` | `null` |
| 138 | `BaalToStairs` | 1 | `null` | `0x6fcc7410` | `null` |
| 139 | `BaalTentacle` | 1 | `null` | `0x6fcc4d10` | `null` |
| 140 | `BaalCrabClone` | 0 | `null` | `0x6fcd8460` | `0x6fcd78a0` |
| 141 | `BaalMinion` | 1 | `null` | `0x6fcc5d70` | `null` |
| 142 | `ClawViperEx` | 1 | `null` | `0x6fca8a70` | `null` |
| 143 | `ShadowMasterNoInit` | 2 | `0x6fcc4260` | `0x6fccb580` | `null` |
| 144 | `UberIzual` | 1 | `null` | `0x6fc9e640` | `null` |
| 145 | `UberBaal` | 1 | `null` | `0x6fcd6c80` | `0x6fcd78a0` |
| 146 | `UberMephisto` | 1 | `null` | `0x6fc9b4e0` | `null` |
| 147 | `UberDiablo` | 1 | `null` | `0x6fcc39d0` | `0x6fcc59b0` |

## Reading

Each `MonAi.txt` row selects one of these functions; the row's
`aip1..aip8`, `aidel`, `aidel(N)`, `aidel(H)` values are the parameters
passed to that state machine. Multiple rows can be distinct functions even
when their names are variants (e.g. `ClawViper` index 16 and `ClawViperEx`
index 142 are separate functions).
