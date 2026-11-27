# 1.13c Per-Level Scripted, DS1-Preset, SuperUnique & Boss-Wave Monster Preload (`#1775`)

## Root Cause Analysis (`Levels.txt` vs Runtime Spawns)

In Diablo II: Lord of Destruction v1.13c (`samples/d2`), `Levels.txt` columns `mon1..mon10`, `nmon1..nmon10`, and `umon1..umon10` define **only** the random room-density monster pool (`D2Game` room population). They omit four major categories of monsters that spawn dynamically or from DS1 presets:

1. **Boss Wave & Quest Event Scripts (`D2Game.dll`)**:
   - **Area `131` (`Throne of Destruction`)**: `wthrone.ds1` places only `baalthrone` (`hcIdx 543`). Baal's 5 waves (`SuperUniques.txt` `#61..65`) are spawned dynamically via `#286 Baal Monster Spawn`:
     - Wave 1 (`#61` Colenzo): `62` (`fallenshaman5`) + `23, 642` (`fallen5/6`)
     - Wave 2 (`#62` Achmel): `105` (`unraveler5`) + `381` (`skmage_cold3`)
     - Wave 3 (`#63` Bartuc): `557` (`baalhighpriest`) + `351` (`hydra1`)
     - Wave 4 (`#64` Ventar): `558` (`venomlord`)
     - Wave 5 (`#65` Lister): `571` (`baalminion1`, `monster-43-hth.r8` **16.4 MB**)
     - Stairs transition: `559` (`baalcrabstairs`, `monster-42-hth.r8`)
   - **Area `132` (`The Worldstone Chamber`)**: `Levels.txt` has empty `mon1..10`; spawns `544` (`baalcrab`), `570` (`baalclone`), `562..566` (`baaltentacle1..5`), `521` (`tyrael3`), and `574` (`worldstoneeffect`).
   - **Area `108` (`Chaos Sanctuary`)**: 5 seal objects (`392..396`) spawn Grand Vizier (`306`), Lord De Seis (`312` + `310, 699`), Infector of Souls (`362`), and Diablo (`243`, `monster-di-hth.r8` + `.p1..p6.r8` **>100 MB**) + Bone Prison (`340..343`).
   - **Area `120` (`Arreat Summit`)**: Altar (`546`) transforms statues (`537..539`) into Talic (`540`), Madawc (`541`), and Korlic (`542`).
   - **Area `124` (`Halls of Vaught`)**: Preset `#462` spawns Nihlathak (`526`) + Ice Spawn (`453`) + Frenzied Ice Spawn (`461`).
   - **Areas `133..136` (`Pandemonium` & `Uber Tristram`)**: Lilith (`707`), Uber Duriel (`708` + `227`), Uber Izual (`706` + `724`), and Uber Mephisto / Uber Diablo / Uber Baal (`704, 705, 709`) + summoned skeletons/mages (`725..730`), Pit Lords (`712`), Dark Lords (`731`), and Specters (`732`).
2. **DS1 Preset Monsters (`type === 1` in `LvlPrest.txt`, `LvlMaze.txt`, and `LvlSub.txt`)**:
   - Act bosses (`156` Andariel in `37`, `211` Duriel + `251` Tyrael in `73`, `250` Summoner + `371` Lightning Spire in `74`, `242` Mephisto in `102`, `256` Izual + `406` spirit in `105`), Town NPCs (`1, 40, 50, 75, 103, 109`), Gargoyle/Wall/Fire Traps (`273, 327, 328, 372`), Mummy Sarcophagi (`228 -> 96`), Water Watchers (`258..263`), and Act 5 siege presets (`497, 498, 522, 528 -> 492`).
3. **All 66 `SuperUniques.txt` Bosses + Minion Companion Packs (`MonStats.txt` `minion1`/`minion2`)**.
4. **Transitive `MonStats.txt` `spawn` & `Skills.txt` `summon` Chains** (e.g. Maggot Queen -> Sand Maggot -> Egg -> Young; Putrid Defiler -> Pain Worm; Demon Spawner/Hole -> Pit Lord).

## Architecture (`src/common/drlg/level-scripted-monsters-113c.ts`)

- `LEVEL_SCRIPTED_MONSTERS_113C`, `SUPERUNIQUE_MONSTER_HCINDICES_113C`, `MONSTER_RELATED_SPAWNS_113C`, and `LEVEL_PORTAL_NEIGHBOR_AREAS_113C` are wired into `MapWorkerEngine.getLevelPreloadPlan` (`src/client/map/map-worker.ts`).
- Note on `neighborAreaIds` seam invariant (`#1335`): `LEVEL_PORTAL_NEIGHBOR_AREAS_113C` (`4 -> 38`, `54 -> 74`, `66..72 -> 73`, `109 -> 121`, `131 -> 132`) populates **only** `neighborMonsterHcIndices` and never modifies `neighborAreaIds` used by `map-service-area-source.ts` for outdoor DRLG seam stitching.
- `EntityArtCache` (`src/client/scene/entity-art-loader.ts`) separates `'urgent'` live-unit fetches from bounded background `preloadEntities` (`maxBackgroundConcurrency = 2`, `'preload-current'` ahead of `'preload-neighbor'`) and promotes queued background tasks in-place when a live unit spawns on screen.
- `drawLoadingMonsterPlaceholder113c` (`src/client/scene/world-renderer.ts`) renders a COF-box-sized ground shadow + translucent spectral silhouette while `'loading'` (skipping corpses, `STATE_INVIS = 146`, and `K9`/`9A` invisible controllers) and records diagnostics in `window.__d2PreloadMisses` without polluting `window.__d2MissingArt`.
