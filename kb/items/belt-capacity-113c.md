# Belt capacity (1.13c) — `Armor.txt` `belt` → `Belts.txt` `numboxes`

Source: 1.13c `d2exp.mpq` `data\global\excel\Belts.txt` and `Patch_D2.mpq` `data\global\excel\Armor.txt`
(verified by `tests/client/belt-rows-113c-parity.test.ts`, issue #913).

- `Belts.txt` has two 7-row sets separated by an `Expansion` row: set 0 carries 640x480 box coordinates
  (`box1left=343, box1top=442`), set 1 (`belt2`, `sash2`, …) 800x600 coordinates (`box1left=423, box1top=562`).
  `numboxes` is identical in both sets.
- `Armor.txt` `belt` column is the row index into a set. Capacity = `numboxes`; rows = `numboxes / 4`.

| idx | Belts.txt name | numboxes | rows | Armor.txt codes |
|-----|----------------|----------|------|-----------------|
| 0 | belt | 12 | 3 | mbl (Belt) |
| 1 | sash | 8 | 2 | lbl (Sash) |
| 2 | default | 4 | 1 | — no belt equipped |
| 3 | girdle | 16 | 4 | hbl (Girdle / Plated Belt) |
| 4 | light belt | 8 | 2 | vbl (Light Belt) |
| 5 | heavy belt | 12 | 3 | tbl (Heavy Belt) |
| 6 | uber belt | 16 | 4 | all exceptional + elite belts (zlb zvb zmb ztb zhb ulc uvc umc utc uhc) |

Pitfall: exceptional/elite belts reuse the normal-tier inventory art (`invlbl/invvbl/invmbl/invtbl/invhbl`),
so a Mesh Belt (`zmb`, 16 boxes) looks exactly like a Belt (`mbl`, 12 boxes). Never infer capacity from the icon.

In the web client the server (real D2GS) is authoritative for storage/auto-pickup; the client `BeltModel`
only mirrors `numboxes` for drawing, hit-testing and local prediction, and reads the belt body-location item live.
