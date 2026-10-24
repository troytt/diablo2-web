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
