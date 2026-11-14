export class FormatError extends Error {
  public format: string;
  public field: string;
  public offset: number;

  constructor(format: string, field: string, offset: number, message: string) {
    super(message);
    this.name = 'FormatError';
    this.format = format;
    this.field = field;
    this.offset = offset;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TruncatedDataError extends FormatError {
  public needed: number;
  public available: number;

  constructor(
    format: string,
    field: string,
    offset: number,
    needed: number,
    available: number,
    bufferLength: number
  ) {
    super(
      format,
      field,
      offset,
      `${format}: truncated reading ${field} at offset 0x${offset.toString(16).toUpperCase()}: need ${needed} bytes, only ${available} available (buffer length ${bufferLength})`
    );
    this.name = 'TruncatedDataError';
    this.needed = needed;
    this.available = available;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidFieldError extends FormatError {
  public got: unknown;
  public expected: unknown;

  constructor(
    format: string,
    field: string,
    offset: number,
    got: unknown,
    expected: unknown
  ) {
    const gotStr = typeof got === 'number' ? `0x${got.toString(16).toUpperCase()}` : String(got);
    const expStr = typeof expected === 'number' ? `0x${expected.toString(16).toUpperCase()}` : String(expected);
    super(
      format,
      field,
      offset,
      `${format}: invalid field ${field} at offset 0x${offset.toString(16).toUpperCase()} (got ${gotStr}, expected ${expStr})`
    );
    this.name = 'InvalidFieldError';
    this.got = got;
    this.expected = expected;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function requireBytes(
  data: Uint8Array,
  offset: number,
  length: number,
  format: string,
  field: string
): void {
  if (offset < 0 || offset + length > data.length) {
    const available = data.length - offset;
    throw new TruncatedDataError(
      format,
      field,
      Math.max(0, offset),
      length,
      Math.max(0, available),
      data.length
    );
  }
}

export class ByteReader {
  private view: DataView;
  private offset: number = 0;
  private format: string;
  private arr: Uint8Array;

  constructor(data: Uint8Array, format: string) {
    this.arr = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.format = format;
  }

  get remaining(): number {
    return this.arr.length - this.offset;
  }

  get eof(): boolean {
    return this.offset >= this.arr.length;
  }
  
  get position(): number {
    return this.offset;
  }

  private check(length: number, field: string): void {
    if (this.offset + length > this.arr.length || this.offset < 0) {
      throw new TruncatedDataError(
        this.format,
        field,
        this.offset,
        length,
        Math.max(0, this.arr.length - this.offset),
        this.arr.length
      );
    }
  }

  u8(field: string): number {
    this.check(1, field);
    const val = this.view.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  u16le(field: string): number {
    this.check(2, field);
    const val = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }

  u32le(field: string): number {
    this.check(4, field);
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  i16le(field: string): number {
    this.check(2, field);
    const val = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return val;
  }

  i32le(field: string): number {
    this.check(4, field);
    const val = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return val;
  }

  bytes(n: number, field: string): Uint8Array {
    if (n < 0) {
      throw new InvalidFieldError(this.format, field, this.offset, n, ">= 0");
    }
    this.check(n, field);
    const val = this.arr.subarray(this.offset, this.offset + n);
    this.offset += n;
    return val;
  }

  skip(n: number, field: string): void {
    if (n < 0) {
      throw new InvalidFieldError(this.format, field, this.offset, n, ">= 0");
    }
    this.check(n, field);
    this.offset += n;
  }

  seek(off: number, field: string): void {
    if (off < 0 || off > this.arr.length) {
      throw new TruncatedDataError(
        this.format,
        field,
        off,
        1,
        0,
        this.arr.length
      );
    }
    this.offset = off;
  }
}
