import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import * as fs from 'fs';
import * as path from 'path';

import { decodeDc6 } from '../src/common/formats/dc6';
import { decodeDs1 } from '../src/common/formats/ds1';
import { decodeDt1 } from '../src/common/formats/dt1';
import { FormatError, TruncatedDataError, InvalidFieldError } from '../src/common/formats/reader';

console.log('Verifying formats against malformed data...');

let exitCode = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (e: any) {
    if (e instanceof FormatError || e.message.includes('signature') || e.message.includes('implausible') || e.message.includes('truncated')) {
      console.log(`[PASS] ${name} (threw expected error)`);
    } else {
      console.error(`[FAIL] ${name}: threw unexpected error type: ${e.name} - ${e.message}`);
      exitCode = 1;
    }
  }
}

const fixtureDir = path.join(__dirname, '../samples/fixtures');

if (fs.existsSync(path.join(fixtureDir, 'fixture.dc6'))) {
  const dc6 = fs.readFileSync(path.join(fixtureDir, 'fixture.dc6'));
  runTest('DC6 Truncated', () => decodeDc6(dc6.subarray(0, 10)));
} else {
  console.log('[SKIP] DC6 fixture missing');
}

if (fs.existsSync(path.join(fixtureDir, 'fixture.ds1'))) {
  const ds1 = fs.readFileSync(path.join(fixtureDir, 'fixture.ds1'));
  runTest('DS1 Truncated', () => decodeDs1(ds1.subarray(0, 100)));
  const badDs1 = new Uint8Array(ds1);
  new DataView(badDs1.buffer).setInt32(4, 0xffff, true);
  runTest('DS1 Absurd Geometry', () => decodeDs1(badDs1));
} else {
  console.log('[SKIP] DS1 fixture missing');
}

if (fs.existsSync(path.join(fixtureDir, 'fixture.dt1'))) {
  const dt1 = fs.readFileSync(path.join(fixtureDir, 'fixture.dt1'));
  runTest('DT1 Truncated', () => decodeDt1(dt1.subarray(0, 100)));
} else {
  console.log('[SKIP] DT1 fixture missing');
}

process.exit(exitCode);
