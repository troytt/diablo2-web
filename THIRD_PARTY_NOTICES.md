# Third-party notices

## StormLib (reference for MPQ format semantics)

`src/mpq/crypt.ts` and `src/mpq/decompress.ts` implement algorithms whose
semantics were ported from the public StormLib reference so that behaviour
matches real archives exactly (hash selectors, the block cipher, the
plain-name file key, and the fixed codec order of a combined compression
mask). The TypeScript code here is an independent implementation; no C++
source is copied verbatim.

StormLib — <https://github.com/ladislav-zezula/StormLib>
Copyright (c) Ladislav Zezula — MIT License.

## D2MOO (reference for 1.10f symbol and struct naming)

Symbol and structure naming conventions documented in
`kb/d2moo-113c-reference-index.md` (and corresponding `113c` kernel identifiers
where aligned) consult the public D2MOO decompilation project strictly as a
read-only naming and structural reference. All behavioral logic, ABI layouts,
offsets, and constants in this repository are independently verified against
Diablo II: Lord of Destruction v1.13c binaries and MPQ tables; no D2MOO C/C++
source files are included in this repository.

D2MOO — <https://github.com/ThePhrozenKeep/D2MOO>
Copyright (c) 2020-2025 The Phrozen Keep community — MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
