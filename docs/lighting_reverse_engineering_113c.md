# Diablo II v1.13c Reverse Engineering Specification: `dLightMap.c` Lighting Pipeline

> [!WARNING]
> **Superseded** by [`lighting_grid_113c.md`](./lighting_grid_113c.md) (issue #830). Several claims below are wrong
> (cell scale, "obstacle factor", bilinear sampling, radii, flicker); the corrections are listed in §9 of that
> document. Kept for history only — do not port from this file.

> **Ground Truth Binary**: `samples/d2/D2Client.dll` (v1.13c, PE ImageBase `0x6fab0000`, file timestamp 2010-03-09).  
> **Source File Origin**: `..\Source\D2Client\DRAW\dLightMap.c` (string located at VA `0x6fb84104`).  
> **Target Assembly Range**: `0x6fb58000` – `0x6fb5a000` (dLightMap.c), `0x6faef000` – `0x6faefee0` (light debug & map tile interface), `0x6fb10000` – `0x6fb10500` (floor tile rasterizer).

---

## 1. Light Grid Architecture & Topography

### 1.1 Dimensions & Coordinate Space
- **Grid Dimensions**: Exactly **48 × 48 cells** (2,304 cells total, hex `0x900`).
  - Column index $x \in [0, 47]$ (`cmp ecx, 0x30`).
  - Row index $y \in [0, 47]$ (`cmp eax, 0x30`).
  - Linear address mapping: `index = 48 * y + x` (`lea eax, [eax + eax*2]; shl eax, 4; add eax, ecx`).
- **Spatial Resolution & Scale**:
  - The lighting grid steps by **8 sub-tiles** per cell (`sar ecx, 3` / `add esi, 8`).
  - World sub-tile coordinates $(x_{\text{sub}}, y_{\text{sub}})$ are converted to grid coordinates by:
    $$x_{\text{grid}} = (x_{\text{sub}} \gg 3) - x_{\text{origin}}$$
    $$y_{\text{grid}} = (y_{\text{sub}} \gg 3) - y_{\text{origin}}$$
    Where $(x_{\text{origin}}, y_{\text{origin}})$ are the grid origin sub-tile offsets (`ds:0x6fbb4df0`, `ds:0x6fbb4df4`).

### 1.2 Cell Memory Layout (8 Bytes per Cell)
The primary lighting array is located at base address `0x6fbb5208` with an 8-byte stride per cell (`ecx * 8 + 0x6fbb5208`):
```c
struct D2LightCellStrc {
    uint8_t nFlags;          // +0x00: Obstacle / cell flag
    uint8_t pad[3];          // +0x01..+0x03
    uint8_t nIntensity;      // +0x04: Clamped intensity [0..255]
    uint8_t nRed;            // +0x05: Red color channel [0..255]
    uint8_t nGreen;          // +0x06: Green color channel [0..255]
    uint8_t nBlue;           // +0x07: Blue color channel [0..255]
};
```

---

## 2. Mathematical Formulas (Decompiled from Assembly)

### 2.1 Fast Euclidean Distance Approximation (Alpha Max Plus Beta Min)
In `0x6fb597b4` – `0x6fb597d9`, Blizzard avoids floating-point square root `sqrt(dx^2 + dy^2)` using an integer approximation:
```assembly
6fb597b4: cmp ecx, eax
6fb597b6: jl 0x6fb597cb
6fb597b8: imul ecx, ecx, 0x3d7 ; 983
6fb597be: imul eax, eax, 0x197 ; 407
6fb597c4: add ecx, eax
6fb597c6: shr ecx, 0xa         ; >> 10 (1024)
```
Mathematical representation:
$$\text{dist}(dx, dy) = \frac{983 \cdot \max(|dx|, |dy|) + 407 \cdot \min(|dx|, |dy|)}{1024}$$
Where:
- $\frac{983}{1024} \approx 0.95996$
- $\frac{407}{1024} \approx 0.39746$
- Maximum theoretical error across all angles is $\le 3.96\%$.

### 2.2 Light Falloff & Obstacle Attenuation Formula
In `0x6fb597de` – `0x6fb597fa`:
```assembly
6fb597de: mov edx, [esi+0x18]  ; Light Radius R
6fb597e1: sub edx, ecx         ; (R - dist)
6fb597e3: imul edx, [esp+0x3c] ; * intensitySlope (16.16 fixed point)
6fb597f1: sar edx, 16          ; >> 16
6fb597e8: sar edi, 1           ; edi = obstacle factor
6fb597ea: mov eax, 8
6fb597ef: sub eax, edi         ; (8 - obstacle)
6fb597f4: imul eax, edx        ; (8 - obstacle) * attenuated
6fb597f7: sar eax, 3           ; >> 3 (/ 8)
```
Mathematical representation:
$$\text{IntensitySlope} = \frac{\text{BaseIntensity} \ll 16}{R}$$
$$\text{Attenuated} = \max\left(0, \frac{(R - \text{dist}) \cdot \text{IntensitySlope}}{65536}\right)$$
$$\text{FinalCellIntensity} = \frac{(8 - \text{ObstacleFactor}) \cdot \text{Attenuated}}{8}$$
- When $\text{ObstacleFactor} = 0$: Light transmits at $100\%$ ($\frac{8-0}{8} = 1.0$).
- When $\text{ObstacleFactor} \ge 16$: Light is completely blocked (`cmp edi, 0x10; jge skip`).

### 2.3 Multi-Source Color Blending (Weighted Energy Conservation)
In `0x6fb58a91` – `0x6fb58b45`:
When multiple lights illuminate the same grid cell, their colors are combined via intensity-weighted averaging:
```assembly
6fb58a91: lea ecx, [esi+edx*1] ; newIntensity = existing + incoming
6fb58a94: cmp ecx, 0xff
...
6fb58abd: mov edi, [ebx*4 + 0x6fbb4e00] ; 65536 / newIntensity table lookup
6fb58ac4: imul ecx, esi        ; existingRed * existingIntensity
6fb58acd: imul ebp, edx        ; incomingRed * incomingIntensity
6fb58ad0: add ecx, ebp
6fb58ad2: imul ecx, edi        ; sum * (65536 / newIntensity)
6fb58ad5: shr ecx, 0x10        ; >> 16
```
Mathematical representation:
$$I_{\text{total}} = \min(255, I_{\text{existing}} + I_{\text{incoming}})$$
$$R_{\text{blended}} = \min\left(255, \frac{R_{\text{existing}} \cdot I_{\text{existing}} + R_{\text{incoming}} \cdot I_{\text{incoming}}}{I_{\text{total}}}\right)$$
$$G_{\text{blended}} = \min\left(255, \frac{G_{\text{existing}} \cdot I_{\text{existing}} + G_{\text{incoming}} \cdot I_{\text{incoming}}}{I_{\text{total}}}\right)$$
$$B_{\text{blended}} = \min\left(255, \frac{B_{\text{existing}} \cdot I_{\text{existing}} + B_{\text{incoming}} \cdot I_{\text{incoming}}}{I_{\text{total}}}\right)$$

### 2.4 Sub-Tile Bilinear Interpolation (8.8 Fixed Point)
In `0x6fb58373` – `0x6fb58385`:
```assembly
mov ebx, 0x100       ; 256
sub ebx, eax         ; 256 - factor
imul eax, edx        ; factor * L2
imul ebx, edi        ; (256 - factor) * L1
add ebx, eax
sar ebx, 0x8         ; >> 8
```
Interpolates smoothly between neighboring cells using fixed-point factor $f \in [0, 256]$:
$$\text{Sample} = \frac{(256 - f) \cdot L_1 + f \cdot L_2}{256}$$

---

## 3. Light Sources & Defaults

- **Player Base Light Radius**: Default is radius 10–13 sub-tiles adjusted by item `STAT_LIGHTRADIUS` (`CUnit.c` / `dLightMap.c`).
- **Monster Default Radius**: 8 sub-tiles (`mov ebx, 0x8` at `0x6fb59894`).
- **Missile Lights**: Read directly from `Missiles.txt` `Light`, `Red`, `Green`, `Blue` columns.
- **Flicker**: Perturbation index updated every logic frame (25Hz) modifying radius by $\pm 1$ sub-tile.
- **2D Software Mode Fallback**: When `bColoredLighting` is false (`ds:0x6fb8e830 == 0`), $R=G=B=I$ and the intensity directly drives the 32-level PL2 colormap row.
