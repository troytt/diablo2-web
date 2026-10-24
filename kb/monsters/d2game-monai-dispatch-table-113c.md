# D2Game.dll 1.13c MonAi dispatch table (gpMonsterAiTable)

> Reverse-engineered from `E:\Games\diablo_1.13\D2Game.dll` (2010-03-09 build,
> image base `0x6FC20000`, `.text` `0x6FC21000`..`0x6FD179B4`, `.data`
> `0x6FD1F000`..`0x6FD30000`).

## Table location and indexing

- Table VA: **`0x6FD274A8`**, 148 entries (4 bytes each), index `0..147`
  matching the `MonAi.txt` row order in `MONAI_113C_ROWS`.
- Dispatch site: `0x6FC4F3D2`:

  ```asm
  movzx edx, al                          ; AI id from the monster record
  mov   eax, [edx*4+0x6FD274A8]          ; gpMonsterAiTable[ai]
  test  eax, eax
  je    0x6FC4F441
  call  eax                              ; run the per-AI state machine
  ```

- Entry 0 (`None`) is a null pointer; the dispatcher skips the call.
- Prior notes citing `0x6FD132D8` as the table are incorrect for this binary:
  that address falls inside `.text` instruction bytes. Cross-references in
  `.text` all resolve to `0x6FD274A8` (e.g. `0x6FCB1D4B`, `0x6FCBE42B`,
  `0x6FCC1B1D`).

## Full table

| Index | MonAi row | D2Game function |
|------:|-----------|-----------------|
| 0 | `None` | `null` |
| 1 | `Idle` | `0x6fcc2c40` |
| 2 | `Skeleton` | `0x6fcc3220` |
| 3 | `Zombie` | `0x6fcc2b40` |
| 4 | `Bighead` | `0x6fcc2ea0` |
| 5 | `BloodHawk` | `0x6fcc2a40` |
| 6 | `Fallen` | `0x6fc6c2a0` |
| 7 | `Brute` | `0x6fc6cb00` |
| 8 | `SandRaider` | `0x6fc6d420` |
| 9 | `Wraith` | `0x6fc49600` |
| 10 | `CorruptRogue` | `0x6fc6d270` |
| 11 | `Baboon` | `0x6fc6d040` |
| 12 | `Goatman` | `0x6fc6dcd0` |
| 13 | `FallenShaman` | `0x6fc6dac0` |
| 14 | `QuillRat` | `0x6fc6ce10` |
| 15 | `SandMaggot` | `0x6fc6d8c0` |
| 16 | `ClawViper` | `0x6fc6d710` |
| 17 | `SandLeaper` | `0x6fc63b60` |
| 18 | `PantherWoman` | `0x6fc628f0` |
| 19 | `Swarm` | `0x6fc64390` |
| 20 | `Scarab` | `0x6fc630d0` |
| 21 | `Mummy` | `0x6fc631c0` |
| 22 | `GreaterMummy` | `0x6fc63aa0` |
| 23 | `Vulture` | `0x6fc62730` |
| 24 | `Mosquito` | `0x6fc637d0` |
| 25 | `WillOWisp` | `0x6fc62570` |
| 26 | `Arach` | `0x6fc63720` |
| 27 | `ThornHulk` | `0x6fc63450` |
| 28 | `Vampire` | `0x6fc62d90` |
| 29 | `BatDemon` | `0x6fc63fa0` |
| 30 | `Fetish` | `0x6fc705d0` |
| 31 | `NpcOutOfTown` | `0x6fc718b0` |
| 32 | `Npc` | `0x6fc6f920` |
| 33 | `HellMeteor` | `0x6fcb2770` |
| 34 | `Andariel` | `0x6fcb5690` |
| 35 | `CorruptArcher` | `0x6fcb61a0` |
| 36 | `CorruptLancer` | `0x6fcb5040` |
| 37 | `SkeletonBow` | `0x6fcb4f50` |
| 38 | `MaggotLarva` | `0x6fcb3340` |
| 39 | `PinHead` | `0x6fcb4970` |
| 40 | `MaggotEgg` | `0x6fcb2230` |
| 41 | `Towner` | `0x6fcb3bc0` |
| 42 | `Vendor` | `0x6fcb5fe0` |
| 43 | `FoulCrowNest` | `0x6fcb4dc0` |
| 44 | `Duriel` | `0x6fcb6310` |
| 45 | `Sarcophagus` | `0x6fcb6280` |
| 46 | `ElementalBeast` | `0x6fcb3270` |
| 47 | `FlyingScimitar` | `0x6fcb4b10` |
| 48 | `ZakarumZealot` | `0x6fcb5560` |
| 49 | `ZakarumPriest` | `0x6fcb5980` |
| 50 | `Mephisto` | `0x6fcb3110` |
| 51 | `Diablo` | `0x6fcb57f0` |
| 52 | `FrogDemon` | `0x6fcb3680` |
| 53 | `Summoner` | `0x6fcb2cf0` |
| 54 | `NpcStationary` | `0x6fcb35f0` |
| 55 | `Izual` | `0x6fc6f4d0` |
| 56 | `Tentacle` | `0x6fc71750` |
| 57 | `TentacleHead` | `0x6fc71540` |
| 58 | `Navi` | `0x6fc71340` |
| 59 | `BloodRaven` | `0x6fc71c60` |
| 60 | `GoodNpcRanged` | `0x6fc70fe0` |
| 61 | `Hireable` | `0x6fc71a90` |
| 62 | `TownRogue` | `0x6fc71e70` |
| 63 | `GargoyleTrap` | `0x6fc70190` |
| 64 | `SkeletonMage` | `0x6fcb9290` |
| 65 | `FetishShaman` | `0x6fcba8d0` |
| 66 | `SandMaggotQueen` | `0x6fcbaf50` |
| 67 | `NecroPet` | `0x6fcb9d20` |
| 68 | `VileMother` | `0x6fc49720` |
| 69 | `VileDog` | `0x6fc47600` |
| 70 | `FingerMage` | `0x6fc47b90` |
| 71 | `Regurgitator` | `0x6fc49000` |
| 72 | `DoomKnight` | `0x6fc476d0` |
| 73 | `AbyssKnight` | `0x6fcb94c0` |
| 74 | `OblivionKnight` | `0x6fc47e30` |
| 75 | `QuillMother` | `0x6fc47c90` |
| 76 | `EvilHole` | `0x6fc48be0` |
| 77 | `Trap-Missile` | `0x6fc494a0` |
| 78 | `Trap-RightArrow` | `0x6fc493b0` |
| 79 | `Trap-LeftArrow` | `0x6fcb9830` |
| 80 | `Trap-Poison` | `0x6fcb93a0` |
| 81 | `JarJar` | `0x6fcbabc0` |
| 82 | `InvisoSpawner` | `0x6fcba400` |
| 83 | `MosquitoNest` | `0x6fcd4660` |
| 84 | `BoneWall` | `0x6fcd65e0` |
| 85 | `HighPriest` | `0x6fcd58a0` |
| 86 | `Hydra` | `0x6fcd3060` |
| 87 | `Trap-Melee` | `0x6fcd42d0` |
| 88 | `7TIllusion` | `0x6fcd56c0` |
| 89 | `Megademon` | `0x6fcd60c0` |
| 90 | `Griswold` | `0x6fcd2fc0` |
| 91 | `DarkWanderer` | `0x6fcd5e50` |
| 92 | `Trap-Nova` | `0x6fcd5600` |
| 93 | `ArcaneTower` | `0x6fcd5450` |
| 94 | `DesertTurret` | `0x6fcd2e90` |
| 95 | `PantherJavelin` | `0x6fcd6a60` |
| 96 | `FetishBlowgun` | `0x6fcd3770` |
| 97 | `Spirit` | `0x6fcd5bd0` |
| 98 | `Smith` | `0x6fcd46b0` |
| 99 | `TrappedSoul` | `0x6fcd52a0` |
| 100 | `Buffy` | `0x6fcd3d60` |
| 101 | `AssassinSentry` | `0x6fcd5110` |
| 102 | `BladeCreeper` | `0x6fcd4ff0` |
| 103 | `InvisoPet` | `0x6fcd3f10` |
| 104 | `DeathSentry` | `0x6fcd4410` |
| 105 | `ShadowWarrior` | `0x6fcd4de0` |
| 106 | `ShadowMaster` | `0x6fcd4d30` |
| 107 | `Raven` | `0x6fcd3b20` |
| 108 | `DruidWolf` | `0x6fcd5d40` |
| 109 | `Totem` | `0x6fcd6790` |
| 110 | `Vines` | `0x6fcd49f0` |
| 111 | `CycleOfLife` | `0x6fcd39f0` |
| 112 | `DruidBear` | `0x6fcd5950` |
| 113 | `SiegeTower` | `0x6fccdfa0` |
| 114 | `ReanimatedHorde` | `0x6fc668a0` |
| 115 | `SiegeBeast` | `0x6fc66720` |
| 116 | `Minion` | `0x6fc66210` |
| 117 | `SuicideMinion` | `0x6fc656b0` |
| 118 | `Succubus` | `0x6fc65600` |
| 119 | `SuccubusWitch` | `0x6fc66560` |
| 120 | `Overseer` | `0x6fc66000` |
| 121 | `MinionSpawner` | `0x6fc66a20` |
| 122 | `Imp` | `0x6fc65000` |
| 123 | `Catapult` | `0x6fc652c0` |
| 124 | `FrozenHorror` | `0x6fc65ce0` |
| 125 | `BloodLord` | `0x6fc2d680` |
| 126 | `CatapultSpotter` | `0x6fc2de70` |
| 127 | `NpcBarb` | `0x6fc2cf00` |
| 128 | `Nihlathak` | `0x6fc2c310` |
| 129 | `GenericSpawner` | `0x6fc2dbd0` |
| 130 | `DeathMauler` | `0x6fc2d7b0` |
| 131 | `Wussie` | `0x6fc2d9c0` |
| 132 | `AncientStatue` | `0x6fc2d530` |
| 133 | `Ancient` | `0x6fc2c5d0` |
| 134 | `BaalThrone` | `0x6fc2c900` |
| 135 | `BaalCrab` | `0x6fc2cdc0` |
| 136 | `BaalTaunt` | `0x6fc2c400` |
| 137 | `PutridDefiler` | `0x6fc2dd50` |
| 138 | `BaalToStairs` | `0x6fc2d370` |
| 139 | `BaalTentacle` | `0x6fc2d290` |
| 140 | `BaalCrabClone` | `0x6fc2cb30` |
| 141 | `BaalMinion` | `0x6fc2ca20` |
| 142 | `ClawViperEx` | `0x6fcb34a0` |
| 143 | `ShadowMasterNoInit` | `0x6fcb4e60` |
| 144 | `UberIzual` | `0x6fc63d40` |
| 145 | `UberBaal` | `0x6fc65af0` |
| 146 | `UberMephisto` | `0x6fc65850` |
| 147 | `UberDiablo` | `0x6fc2c170` |

## Reading

Each `MonAi.txt` row selects one of these functions; the row's
`aip1..aip8`, `aidel`, `aidel(N)`, `aidel(H)` values are the parameters
passed to that state machine. Multiple rows can be distinct functions even
when their names are variants (e.g. `ClawViper` index 16 and `ClawViperEx`
index 142 are separate functions).
