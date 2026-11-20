# Diablo (`DI`) and Baal (`42`) art: modes and atlas size (issue #921)

## 1.13c data (verified from the MPQ tables)

- `MonStats.txt` hcIdx **243** `diablo`, token `DI`, base weapon `hth`. `diabloclone` (333)
  and `uberdiablo` (705) share the same `di-hth` art.
- `MonStats2.txt` row `diablo` mode presence bits (`m*`):
  `DT NU WL A1 A2 BL SC S1 S2 S3 S4 DD SQ RN` (`DT` and `DD` 1 direction, the rest 8).
  **No `GH`/`KB` bit** — the issue body's mode list (with `GH`, without `BL`/`SQ`) was wrong.
  A `DIGHHTH.cof` still ships and is baked.
- COFs present in d2data.mpq: `di{dt,nu,wl,gh,a1,a2,bl,sc,s1,s2,s3,s4,dd,rn}hth.cof`.
  There is no `dikbhth.cof`, `dixxhth.cof` or `disqhth.cof`: MonMode 13 (`KB`) uses the `GH`
  token and MonMode 14 (`XX`, MonStats2 column `SQ`) is a MonSeq.txt sequence that replays
  frames of other modes, so neither has its own art.
- Death `DT` is 142 frames in 1 direction; layers 4-6 per mode; `sc`, `s2`, `s3`, `dt`
  carry an additive (glow) layer.

## Why the art never showed

The entity packer put every composited frame of every mode on one 4096-wide page with no
height cap: `monster-di-hth.r8` was 4096x27997 (3006 frames incl. glow), `monster-42-hth.r8`
(Baal) 4096x18260. Both exceed desktop WebGL2 `MAX_TEXTURE_SIZE` (16384), so
`SpriteRenderer.addIndexedAtlas` threw, the loader's `catch {}` swallowed it and the class
was marked missing. Frames are untrimmed DCC direction boxes (only ~13% of the old Diablo
page was opaque).

Entity packs are now paged at `ENTITY_ATLAS_MAX_PAGE_HEIGHT` (4096) rows: `pages[]` in the
JSON plus a 7th page index per frame tuple; page 0 keeps `<slug>.r8`, extra pages are
`<slug>.p<N>.r8`. Rebaked Diablo: 8 pages, Baal: 5 pages; every old frame is
pixel-identical in the new packs.
