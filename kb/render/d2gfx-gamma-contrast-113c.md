# D2gfx Gamma / Contrast options (1.13c)

Ground truth: `samples/d2/D2gfx.dll` (ImageBase `0x6FA80000`), `samples/d2/D2Direct3D.dll` (`0x6F880000`),
`samples/d2/Fog.dll` (`0x6FF50000`).

- `D2gfx 0x6FA8AEE0` reads two registry values through `0x6FA87830` (key string `0x6FA8E52C`):
  - `"Contrast"` (`0x6FA8E538`), default `(renderMode == 4 /* Glide */) ? 0 : 100` (`sete al; dec eax; and eax, 0x64`),
    forwarded as option 11 via `[gfxInterface+0x30](11, contrast)`;
  - `"Gamma"` (`0x6FA8E524`), default `0x9B` (155), stored at `0x6FA90BEC`, then `[gfxInterface+0x58]()` applies it.
- D2Direct3D option handler `0x6F88A640`: option 11 is stored at `0x6F897E88`.
- D2Direct3D `0x6F88AE00`: when the device exposes gamma control, builds a 256-entry 16-bit ramp with
  `Fog #10198(double value = [0x6F897E88], 2, 256, 0xFFFF, buf)` (`0x6F88AE1E..0x6F88AE3A`), copies it to the
  G and B ramps and calls the gamma-control `SetGammaRamp` (`[vtbl+0x10]`, error string "Failed to set gamma ramp").
- `Fog #10198` = `0x6FF712C0` (`__fastcall(ecx = gamma, edx = outBuf, double contrast, int elemBytes, int count, int maxVal)`):
  - Constants in `.rdata`: `0x6FF79028 = 0.01`, `0x6FF79040 = 1.0`, `0x6FF79048 = 100.0`, `0x6FF79050 = 0.0`.
  - Validates `elemBytes ∈ {1, 2, 4}` (`0x6FF712CD..0x6FF712E0`), `gamma >= 0` (`0x6FF71311`), and `0.0 <= contrast <= 100.0` (`0x6FF71344..0x6FF71366`).
  - Precomputes `invRange = 1.0 / (count - 1.0)`, `gammaScale = gamma * 0.01`, `gammaExp = 100.0 / gamma`, and `oneMinusContrast = 100.0 - contrast`.
  - For each entry `i = 0 .. count - 1` (`x = i * invRange`):
    - `lin = min(maxVal, x * maxVal * gammaScale)` (`0x6FF71410..0x6FF71431`)
    - `powTerm = pow(x, gammaExp) * maxVal * oneMinusContrast` (`0x6FF71435..0x6FF7144A`, `_CIpow` at `0x6FF728B0`)
    - `out[i] = _ftol((powTerm + lin * contrast) * 0.01)` (`0x6FF7144E..0x6FF71462`, `_ftol` at `0x6FF7159C`).
- `D2gfx #10023 SetGamma` (`0x6FA8B1E0`): if `gamma != 0`, updates `[0x6FA90BEC] = gamma`; if `gamma == 0`, keeps `[0x6FA90BEC]` and invokes `[gfxInterface+0x58](ecx = [0x6FA90BEC])` to rebuild the ramp after a contrast change.
- `D2DDraw.dll` (`0x6F8C7FF0`, `0x6F8C89B0`, `0x6F8C80C0..0x6F8C81A8`): stores option 11 (`contrast`) at `0x6F8CEB90` and `gamma` at `0x6F8CEB94`, calls `Fog #10198(gamma, ramp, (double)contrast, 1, 256, 255)`, and remaps every RGB byte of the 256-entry palette through `ramp[byte]`.
- D2Client exposes 21-step (`0..20`, `[row+0x120] = 21`) "Gamma" / "Contrast" sliders in the video options (strings at D2Client `0x6FB851C8` / `0x6FB851BC`, helpers `0x6FB13620` step-to-value and `0x6FB136A0` value-to-step):
  - Gamma (`0x6FB14150` / `0x6FB14890`): `minVal = 0x37` (55), `maxVal = 0xFF` (255), default `0x9B` (155, step 10), `gamma = 55 + step * 10`.
  - Contrast (`0x6FB14110` / `0x6FB14810`): `minVal = 0`, `maxVal = 0x64` (100), default `(renderMode == 4) ? 0 : 100`, `contrast = step * 5`.

Render-mode numbering (`0x6FA91258`, driver-name table `0x6FA90C18`, 7 × u32 string pointers):
0 none, 1 `D2Gdi.dll`, 2 none, 3 `D2DDraw.dll`, 4 `D2Glide.dll`, 5 none, 6 `D2Direct3D.dll`.
`D2gfx #10077` (`0x6FA8B2D0`) returns `renderMode >= 4` (hardware 3D: Glide / Direct3D).
