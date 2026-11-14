import { describe, expect, test } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { decodePal, decodeTrn, indicesToRgba } from '../src/common/formats/pal';
import { decodePcx } from '../src/common/formats/pcx';
import { decodeDc6 } from '../src/common/formats/dc6';
import { decodeSpriteFile } from '../src/common/formats/cel';
import { decodePl2 } from '../src/common/formats/pl2';
import { decodeDs1 } from '../src/common/formats/ds1';
import { decodeDt1 } from '../src/common/formats/dt1';
import { decodeCof, cofLayerOrder } from '../src/common/formats/cof';
import { decodeDcc } from '../src/common/formats/dcc';

import { TruncatedDataError, InvalidFieldError, FormatError } from '../src/common/formats/reader';

describe('Malformed binary formats fail loudly', () => {

  describe('pal', () => {
    test('truncated', () => {
      const data = new Uint8Array(700);
      expect(() => decodePal(data)).toThrowError(); 
      // original was PaletteError, check it fails safely
    });
    test('invalid trn', () => {
      expect(() => decodeTrn(new Uint8Array(100))).toThrowError();
    });
    test('indicesToRgba bounds checks', () => {
      const pal = { rgb: new Uint8Array(768), size: 256 };
      expect(() => indicesToRgba(new Uint8Array(10), new Uint8Array(5), pal)).toThrow(FormatError);
      expect(() => indicesToRgba(new Uint8Array(10), new Uint8Array(10), { rgb: new Uint8Array(100), size: 256 })).toThrow(FormatError);
      expect(() => indicesToRgba(new Uint8Array(10), new Uint8Array(10), pal, new Uint8Array(5))).toThrow(FormatError);
    });
  });

  describe('pcx', () => {
    test('truncated header', () => {
      expect(() => decodePcx(new Uint8Array(10))).toThrow(FormatError);
    });
    test('invalid manufacturer', () => {
      const data = new Uint8Array(1000);
      data[0] = 0xff; // Invalid
      expect(() => decodePcx(data)).toThrow(FormatError);
    });
    test('geometry bounds checks', () => {
      const data = new Uint8Array(1000);
      data[0] = 0x0a;
      data[3] = 8;
      data[65] = 1;
      const view = new DataView(data.buffer);
      view.setUint16(4, 0, true);
      view.setUint16(8, 0xffff, true); // Absurd width
      // A well-formed palette trailer, so `geometry` is the ONLY broken
      // invariant. Asserting the field name keeps this test honest: a coarse
      // `toThrow(FormatError)` would still pass via the palette-marker guard
      // even if the geometry guard were deleted outright.
      data[data.length - 769] = 0x0c;
      let caught: unknown;
      try {
        decodePcx(data);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(InvalidFieldError);
      expect((caught as InvalidFieldError).field).toBe('geometry');
    });
  });

  describe('dc6', () => {
    const valid = fs.readFileSync(path.join(__dirname, '../samples/fixtures/fixture.dc6'));
    
    test('valid decodes successfully', () => {
      const out = decodeDc6(valid);
      expect(out.header.version).toBe(6);
    });
    
    test('truncated file', () => {
      expect(() => decodeDc6(valid.subarray(0, 10))).toThrow(TruncatedDataError);
      expect(() => decodeDc6(valid.subarray(0, 24))).toThrow(TruncatedDataError);
    });

    test('absurd directions', () => {
      const bad = new Uint8Array(valid);
      new DataView(bad.buffer).setInt32(0x10, 1000000, true); // Absurd direction
      expect(() => decodeDc6(bad)).toThrow(FormatError);
    });
  });

  describe('pl2', () => {
    test('truncated file', () => {
      const expectedElements = 1024 + (32+16+1+256*3+256+256+111+1+1+1+14+256+1) * 256 + 39 + 13*256;
      expect(() => decodePl2(new Uint8Array(expectedElements - 100))).toThrow(TruncatedDataError);
    });
  });

  describe('ds1', () => {
    const valid = fs.readFileSync(path.join(__dirname, '../samples/fixtures/fixture.ds1'));
    test('valid decodes successfully', () => {
      const out = decodeDs1(valid);
      expect(out.version).toBe(16); // Check known fixture version
    });

    test('truncated file', () => {
      expect(() => decodeDs1(valid.subarray(0, 10))).toThrow(TruncatedDataError);
      expect(() => decodeDs1(valid.subarray(0, valid.length - 100))).toThrow(TruncatedDataError);
    });

    test('absurd size', () => {
      const bad = new Uint8Array(valid);
      new DataView(bad.buffer).setInt32(4, 0xffff, true); // Absurd width
      expect(() => decodeDs1(bad)).toThrow(FormatError);
    });
  });

  describe('dt1', () => {
    const valid = fs.readFileSync(path.join(__dirname, '../samples/fixtures/fixture.dt1'));
    test('valid decodes successfully', () => {
      const out = decodeDt1(valid);
      expect(out.versionMajor).toBe(7);
    });

    test('truncated file', () => {
      expect(() => decodeDt1(valid.subarray(0, 20))).toThrow(TruncatedDataError);
      expect(() => decodeDt1(valid.subarray(0, 50))).toThrow(TruncatedDataError);
    });

    test('absurd block offsets', () => {
      const bad = new Uint8Array(valid);
      new DataView(bad.buffer).setInt32(268 + 72 + 16, 0xffffff, true); new DataView(bad.buffer).setInt32(268 + 72 + 10, 100, true); // corrupt pointer
      expect(() => decodeDt1(bad)).toThrow(FormatError);
    });
  });

  describe('cof', () => {
    // `samples/d2/` holds the original MPQ *archives*, not an extracted tree,
    // so the presence of that directory says nothing about whether this loose
    // .cof exists. Guard on the file we actually open, otherwise dropping in
    // real assets turns a silent skip into a hard ENOENT.
    const realCofPath = path.join(__dirname, '../samples/d2/data/global/chars/so/co/sowaxlbh.cof');
    const hasRealCof = fs.existsSync(realCofPath);
    test.skipIf(!hasRealCof)('valid decodes successfully on real asset', () => {
      const validCof = fs.readFileSync(realCofPath);
      const out = decodeCof(validCof);
      expect(out.numberOfLayers).toBe(16);
    });

    test('truncated file', () => {
      expect(() => decodeCof(new Uint8Array(10))).toThrow(TruncatedDataError);
    });

    test('absurd priority tables sizes', () => {
      const header = new Uint8Array(28); // large enough for minimum headers
      header[0] = 50; // layers
      header[1] = 50; // frames
      header[2] = 50; // directions
      expect(() => decodeCof(header)).toThrow(TruncatedDataError);
    });
  });

  describe('dcc', () => {
    test('invalid signature', () => {
      const bad = new Uint8Array(100);
      bad[0] = 0x11;
      expect(() => decodeDcc(bad)).toThrow(/signature/);
    });
    
    test('absurd sizes', () => {
      const bad = new Uint8Array(100);
      bad[0] = 0x74;
      bad[1] = 1;
      bad[2] = 0xff; // directions = 255
      const dv = new DataView(bad.buffer);
      dv.setInt32(3, 0xffffff, true); // Frames per dir
      dv.setInt32(7, 1, true); // serialized = 1
      expect(() => decodeDcc(bad)).toThrow(/frames per direction/);
    });
  });
});
