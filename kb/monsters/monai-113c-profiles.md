# MonAi 1.13c behavior profiles (`monai-113c.ts`)

The canonical 148-row function table is documented in
[`d2game-monai-dispatch-table-113c.md`](./d2game-monai-dispatch-table-113c.md)
(`D2Game.dll` VA `0x6FD274A8`, dispatch site `0x6FC4F3D2`).

`src/common/units/monai-113c.ts` is the single source of truth used by both
`GameInstance.stepMonsterAi` and the legacy `GameEngine` harness:

- `MONAI_PROFILES_113C`: one profile for every `MonAi.txt` row (`0..147`);
- `MonAiProfile113c`: behavior family plus the 0-based `aip1..aip8` slots
  that carry each semantic value;
- `monaiProfile113c` / `monaiParam113c`: strict lookup and parameter reader.

## Families

| Family | Rows / examples | Runtime behavior |
|--------|-----------------|------------------|
| `stationary` | NPCs, `MaggotEgg`, `Sarcophagus`, nests, traps, turrets | hold the spawn anchor; still cast/fire |
| `melee` | `Skeleton`, `Zombie`, `Brute`, `Mummy`, `ThornHulk`, prime evils | chase and swing `A1/A2/S1` |
| `ranged` | `Bighead`, `QuillRat`, `SkeletonMage`, `Mephisto` | fire the MonStats `MissA1/A2/S1/C` column |
| `kiter` | `CorruptArcher`, `SkeletonBow`, `Vampire`, `Succubus` | back away inside the profile's comfort distance |
| `charger` | `SandRaider`, `ClawViper`, `BloodHawk`, `ReanimatedHorde`, `SiegeBeast`, `Duriel` | burst movement from mid range, paced by the row's charge slot |
| `leaper` | `SandLeaper` | leap burst |
| `spawner` | `VileMother`, `SandMaggot`, `SandMaggotQueen`, nests, `Sarcophagus` | create children with `aip` max/batch/interval caps |
| `resurrector` | `FallenShaman`, `GreaterMummy`, `FetishShaman` | raise same-race / undead corpses |
| `curse` | Oblivion/Doom/Abyss Knight, `Summoner`, `Nihlathak` | 1.13c curse pool |
| `flee` | `Fallen`, `Fetish`, `Wussie` | morale flee |
| `suicide` | `SuicideMinion` | contact detonation |
| `boss` | act bosses, ubers | boss flag (skills still come from `MonStats Skill1..8`) |

`Overseer` is a melee whip/rally row and `HighPriest` is a ranged
healer/caster; neither is a corpse resurrector.

## Implemented per-row mechanics

| Row | Mechanic | `aip` slots |
|-----|----------|--------------|
| 4 `Bighead` | A2 lightning gated by hurt % and healthy/hurt fire chances | `aip1`, `aip3`, `aip4` |
| 5 `BloodHawk` | charge burst | fixed 60-frame delay |
| 8 `SandRaider` | charge delay | `aip5` |
| 15 `SandMaggot` | egg laying (max 2, batch 2) | `aip3`, `aip5` |
| 16/142 `ClawViper` | charge + shoot distance | `aip2`, `aip5` |
| 17 `SandLeaper` | leap burst | fixed 45-frame delay |
| 23 `Vulture` | prefers targets below the wounded threshold | `aip4` |
| 24 `Mosquito` | life drain on a successful hit | profile drain |
| 26 `Arach` | retreat below hurt % to run distance | `aip5`, `aip4` |
| 27 `ThornHulk` | frenzy after consecutive A2 swings | `aip4`, `aip5`, `aip6` |
| 28 `Vampire` | life drain + kiting | profile drain/kite |
| 29 `BatDemon` | life drain | profile drain |
| 44 `Duriel` | charge | fixed 150-frame delay |
| 68 `VileMother` | VileDog spawn cap and batch | `aip1`, `aip2`, `aip3` |
| 85 `HighPriest` | heals the most wounded ally in range before casting Hydra | `aip6` |
| 114 `ReanimatedHorde` | charge | fixed 90-frame delay |
| 115 `SiegeBeast` | charge | fixed 120-frame delay |
| 117 `SuicideMinion` | contact detonation | `aip1` |
| 120 `Overseer` | `Cry Help` rally + `Healing Vortex` ally heal | `aip5` |
| 19 `Swarm` / 25 `WillOWisp` | stamina / mana drain | profile drain |

Legacy `src/server/ai/monster-ai.ts` remains only as the `GameEngine`
compatibility harness; its stationary/kiter classification now queries the
shared profile table. `GameInstance` is the authoritative monster runtime.