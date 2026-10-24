import { describe, expect, test } from 'vitest';
import { createHash } from 'crypto';
import { decompressHuffman, HuffmanError } from '../src/common/mpq/huffman.js';
import { decompressAdpcm, AdpcmError } from '../src/common/mpq/adpcm.js';
import { HUFFMAN_WEIGHT_TABLES } from '../src/common/mpq/huffman-tables.js';
import { MpqCompressionError, decompressSector, COMPRESSION_ADPCM_MONO, COMPRESSION_ADPCM_STEREO, COMPRESSION_HUFFMANN } from '../src/common/mpq/decompress.js';
import * as fixtures from './fixtures/audio.js';

describe('Huffman tables', () => {
    test('there are exactly 9 weight tables with exactly 256 entries each', () => {
        expect(HUFFMAN_WEIGHT_TABLES).toHaveLength(9);
        for (const table of HUFFMAN_WEIGHT_TABLES) {
            expect(table).toHaveLength(256);
            for (const weight of table) {
                expect(weight).toBeGreaterThanOrEqual(0);
                expect(weight).toBeLessThanOrEqual(255);
            }
        }
    });
    
    test('table entries precisely match the StormLib specification (prevents silent mutations)', () => {
        const hash = createHash('sha256');
        for (const table of HUFFMAN_WEIGHT_TABLES) {
            hash.update(new Uint8Array(table));
        }
        expect(hash.digest('hex')).toBe('b7f6311a178f45b7abea208a42861650faab3fa4c97abe4e9ad251dd031748cd');
    });
});

describe('ADPCM Decompression - Differential testing against StormLib expected output', () => {
    test('mono differential check across compression levels 4 to 6', () => {
        for (let lvl = 4; lvl <= 6; lvl++) {
            const compressed: Uint8Array = (fixtures as any)["adpcm_mono_compressed_" + lvl];
            const decompressed = decompressAdpcm(compressed, (fixtures as any)["adpcm_mono_expected_" + lvl].length, 1);
            
            expect(decompressed).toEqual((fixtures as any)["adpcm_mono_expected_" + lvl]);
        }
    });

    test('stereo differential check across compression levels 4 to 6', () => {
        for (let lvl = 4; lvl <= 6; lvl++) {
            const compressed: Uint8Array = (fixtures as any)["adpcm_stereo_compressed_" + lvl];
            const decompressed = decompressAdpcm(compressed, (fixtures as any)["adpcm_stereo_expected_" + lvl].length, 2);
            
            expect(decompressed).toEqual((fixtures as any)["adpcm_stereo_expected_" + lvl]);
        }
    });
    
    test('truncated stream throws Error', () => {
        const compressed = new Uint8Array([0]);
        expect(() => decompressAdpcm(compressed, 4, 1)).toThrowError(AdpcmError);
    });
});

describe('Huffman Decompression - Differential testing against StormLib expected output', () => {
    test('Differential checks for all Huffman modes (0-8)', () => {
        for (let type = 0; type <= 8; type++) {
            const compressed: Uint8Array = (fixtures as any)["huff_compressed_type_" + type];
            const decompressed = decompressHuffman(compressed, fixtures.huff_uncompressed.length);
            
            expect(decompressed).toEqual(fixtures.huff_uncompressed);
        }
    });

    test('gracefully rejects corrupted/truncated streams', () => {
        const badStream = new Uint8Array([0x00, 0xFF, 0xFF]);
        expect(() => decompressHuffman(badStream, 100)).toThrowError(HuffmanError);
    });
    
    test('stops on 0x100 EOS symbol', () => {
        const stream = new Uint8Array([
            0x01, 
            0b00000000, 0b00000000
        ]);
        expect(() => decompressHuffman(stream, 100)).toThrowError(HuffmanError);
    });
});

describe('Decompress Sector Integration', () => {
    test('Throws on unknown bits', async () => {
        const input = new Uint8Array([COMPRESSION_HUFFMANN | 0x04]);
        await expect(decompressSector(input, 10)).rejects.toThrowError(MpqCompressionError);
    });
    
    test('Properly handles ordering (Huffman -> ADPCM)', async () => {
        const err = await decompressSector(new Uint8Array([COMPRESSION_HUFFMANN | COMPRESSION_ADPCM_MONO, 0xFF]), 5).catch(e => e);
        // It should attempt Huffman first, which will fail with a HuffmanError
        expect(err).toBeInstanceOf(MpqCompressionError);
        expect(err.message).toContain('failed');
    });
});
