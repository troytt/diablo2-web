import { describe, expect, test } from 'vitest';
import { 
  FormatError, 
  TruncatedDataError, 
  InvalidFieldError, 
  ByteReader, 
  requireBytes 
} from '../src/common/formats/reader';
import { parseTable } from '../src/common/world/acts';

describe('ByteReader', () => {
  test('u8 reads correct value and advances', () => {
    const data = new Uint8Array([0x01, 0x02]);
    const reader = new ByteReader(data, 'test');
    expect(reader.u8('f1')).toBe(0x01);
    expect(reader.position).toBe(1);
    expect(reader.remaining).toBe(1);
    expect(reader.eof).toBe(false);
    expect(reader.u8('f2')).toBe(0x02);
    expect(reader.position).toBe(2);
    expect(reader.remaining).toBe(0);
    expect(reader.eof).toBe(true);
  });

  test('u8 throws TruncatedDataError at boundary', () => {
    const data = new Uint8Array([0x01]);
    const reader = new ByteReader(data, 'test');
    reader.u8('f1');
    try {
      reader.u8('f2');
      expect.fail('Should throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(TruncatedDataError);
      expect(e).toBeInstanceOf(FormatError);
      expect(e.format).toBe('test');
      expect(e.field).toBe('f2');
      expect(e.offset).toBe(1);
      expect(e.needed).toBe(1);
      expect(e.available).toBe(0);
      expect(e.message).toBe('test: truncated reading f2 at offset 0x1: need 1 bytes, only 0 available (buffer length 1)');
    }
  });

  test('u16le, u32le, i16le, i32le read correct values', () => {
    const data = new Uint8Array([0xFE, 0xFF, 0x01, 0x00, 0x00, 0x80]);
    // i16le of [0xFE, 0xFF] is -2
    // u16le of [0xFE, 0xFF] is 65534
    // i32le of [0x01, 0x00, 0x00, 0x80] is -2147483647
    const r1 = new ByteReader(data, 'test');
    expect(r1.i16le('f1')).toBe(-2);
    expect(r1.i32le('f2')).toBe(-2147483647);
    
    const r2 = new ByteReader(data, 'test');
    expect(r2.u16le('f3')).toBe(65534);
    r2.seek(2, 'f4');
    expect(r2.u32le('f5')).toBe(0x80000001);
  });

  test('throws precise TruncatedDataError across types', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03]);
    const r = new ByteReader(data, 'test');
    r.skip(2, 'skip');
    
    expect(() => r.u16le('u16')).toThrowError(
      'test: truncated reading u16 at offset 0x2: need 2 bytes, only 1 available (buffer length 3)'
    );
  });

  test('bytes() array methods', () => {
    const data = new Uint8Array([0, 1, 2, 3, 4]);
    const r = new ByteReader(data, 'test');
    
    expect(r.bytes(2, 'b1')).toEqual(new Uint8Array([0, 1]));
    expect(r.remaining).toBe(3);
    
    r.skip(1, 'skip');
    expect(r.position).toBe(3);
    
    expect(() => r.bytes(4, 'b2')).toThrow(TruncatedDataError);
    // test invalid lengths
    expect(() => r.bytes(-1, 'b3')).toThrow(InvalidFieldError);
  });

  test('seek and skip logic', () => {
    const data = new Uint8Array([0, 1, 2, 3]);
    const r = new ByteReader(data, 'test');
    
    r.seek(2, 'seek1');
    expect(r.position).toBe(2);
    
    r.seek(4, 'seek2');
    expect(r.position).toBe(4);
    
    expect(() => r.seek(5, 'seek3')).toThrow(TruncatedDataError);
  });
});

describe('requireBytes', () => {
  test('validates direct offsets', () => {
    const data = new Uint8Array(10);
    expect(() => requireBytes(data, 0, 10, 'fmt', 'f1')).not.toThrow();
    expect(() => requireBytes(data, 5, 5, 'fmt', 'f2')).not.toThrow();
    
    expect(() => requireBytes(data, 8, 3, 'fmt', 'f3')).toThrowError(
      'fmt: truncated reading f3 at offset 0x8: need 3 bytes, only 2 available (buffer length 10)'
    );
  });
});

describe('InvalidFieldError', () => {
  test('formats expected values', () => {
    const err = new InvalidFieldError('fmt', 'sig', 16, 0x1234, 0xABCD);
    expect(err.message).toBe('fmt: invalid field sig at offset 0x10 (got 0x1234, expected 0xABCD)');
    
    const err2 = new InvalidFieldError('fmt', 'type', 0, 'bad', 'good');
    expect(err2.message).toBe('fmt: invalid field type at offset 0x0 (got bad, expected good)');
  });
});

describe('parseTable', () => {
  test('throws explicit error on empty table data', () => {
    expect(() => parseTable(new Uint8Array([]))).toThrowError('parseTable: empty table data');
    expect(() => parseTable(new TextEncoder().encode('\n\r\n'))).toThrowError('parseTable: empty table data');
  });

  test('parses header and rows correctly on non-empty data', () => {
    const data = new TextEncoder().encode('col1\tcol2\nval1\tval2\n');
    const table = parseTable(data);
    expect(table.header).toEqual(['col1', 'col2']);
    expect(table.rows).toEqual([['val1', 'val2']]);
  });
});
