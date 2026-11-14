# PL2 runtime layout (D2Win) and States.txt colorshift resolution (1.13c)

Ground truth: 1.13c binaries in `samples/d2/` (ImageBase D2Win `0x6F8E0000`, D2Client `0x6FAB0000`,
D2gfx `0x6FA80000`). Disassembled with `objdump -d -M intel`.

## 1. `pal.pl2` segments as copied by D2Win (`0x6F8EEF20`, `D2WinPalette.cpp`)

The loader reads the act `pal.pl2` and copies fixed byte ranges into globals with `rep movsd`
(`0x6F8EF01A..0x6F8EF0EF`). File offsets are therefore authoritative:

| File offset | Bytes | Tables | D2Win global | Meaning |
|---:|---:|---:|---|---|
| `0x00000` | 0x400 | – | `0x6F922338` | base palette, 256 × {R,G,B,0} |
| `0x00400` | 0x3100 | 49 | `0x6F932A38` | 32 light levels + 16 inverse colours + selected-unit shift (contiguous) |
| `0x02400` | 0x1000 | 16 | `0x6F934A38` | inverse colours (second copy of the same bytes) |
| `0x03400` | 0x100 | 1 | `0x6F935A38` | selected-unit shift |
| `0x03500` | 0x30000 | 768 | `0x6F93DB60` | alpha blend 3 × 256 (25/50/75 %) |
| `0x33500` | 0x10000 | 256 | `0x6F901630` | additive blend |
| `0x43500` | 0x10000 | 256 | `0x6F911630` | multiplicative blend |
| `0x53500` | 0x8000 | **128** | `0x6F935B60` | 111 hue variations + red/green/blue tones + 14 unknown, **one contiguous array** |
| `0x5B500` | 0x10000 | 256 | `0x6F922738` | max-component blend |
| `0x6B500` | 0x100 | 1 | `0x6F932838` | darkened shift |
| `0x6B600` | 39 | – | `0x6F935B38` | 13 text colours (R,G,B) |
| `0x6B627` | 0xD00 | 13 | `0x6F921638` | text colour shifts |

`pal.dat` (B,G,R triples) is converted to {R,G,B,0} by the byte-swapping loop at `0x6F8EEF40`
(byte 0 → entry+2, byte 1 → entry+1, byte 2 → entry+0).

`D2Win.dll #10164` (`0x6F8EEE50`): `return 0x6F935B60 + n * 256` — the n-th table of the 128-table
hue block at file offset `0x53500` (`hueVariations[n]`, n = 111..113 = red/green/blue tones).

## 2. States.txt `colorpri` / `colorshift` → unit palette shift (`D2Client 0x6FB22130`)

Called from the state-set (`0x6FB236C0`) and state-remove (`0x6FB2381D`) handlers whenever the
state's `colorshift` (`states.bin +0x21`) is non-zero.

```
best = -1; bestPri = 0
for s in 0 .. nStates-1 (stride 0x3C):            ; ascending state id
    if unit has s and states[s].colorpri (+0x20) > bestPri:   ; strict '>' (jbe skip): first max wins
        best = s; bestPri = colorpri
if best <= 0: unit+0x6C = 0                        ; 0x6FB2220B
else:
    if states[best].colorshift == 0x68 (104, poison) and unit == local player
       and D2gfx #10077() (render mode >= 4: Glide or Direct3D):  unit+0x6C = 0   ; 0x6FB221B8..0x6FB221D3
    else unit+0x6C = colorshift
    if unit == local player: light(unit+0x64).rgb (+0x25..+0x27) = states[best].light-r/g/b (+0x22..+0x24)
if no shift and unit == local player: light rgb = 255,255,255   ; 0x6FB22225
```

## 3. Draw-time use (`D2Client 0x6FB1C5F8`, unit gfx draw)

```
pal = 0
if unit+0x6C != 0: pal = D2Win#10164(unit+0x6C - 1)     ; hueVariations[colorshift - 1]
if pal == 0:       pal = 0x6FB03A30(unit)               ; monster palshift.dat / RandTransforms colormap (0x6FB1C6EC)
```

So a state colour shift always overrides the monster colormap, and `colorshift = N` selects
`hueVariations[N - 1]`:

| State (id) | colorpri | colorshift | Table | light-r/g/b (local player only) |
|---|---:|---:|---|---|
| freeze (1), cold (11), holywindcold (44), blue (90) | 100 | 108 | `hueVariations[107]` | 150,215,255 |
| poison (2) | 95 | 104 | `hueVariations[103]` (suppressed on the local player in 3D modes) | 128,255,128 |
| revive (96) | 85 | 73 | `hueVariations[72]` | 255,255,255 |
| red (91) | 70 | 100 | `hueVariations[99]` | 255,255,255 |
