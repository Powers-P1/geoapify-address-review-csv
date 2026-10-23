import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseCsv } from '../src/csv.js';

const recordLimitMessage = 'Input exceeds 10000 data record limit';

test('CSV accepts exactly 10000 data records, excluding the header', () => {
  for (const record of ['Repeated address', '']) {
    for (const ending of ['\n', '\r\n']) {
      const parsed = parseCsv('address' + ending + (record + ending).repeat(10_000));
      assert.deepEqual(parsed.headers, ['address']);
      assert.equal(parsed.records.length, 10_000);
      assert.equal(parsed.records[9_999].address, record);
    }
  }
  const multiline = parseCsv('address\n' + '"line one\nline two"\n'.repeat(10_000));
  assert.equal(multiline.records.length, 10_000);
  assert.equal(multiline.records[9_999].address, 'line one\nline two');
});

test('CSV rejects record 10001, counting duplicates and blank records incrementally', () => {
  for (const record of ['Repeated address', '']) {
    assert.throws(
      () => parseCsv('address\n' + (record + '\n').repeat(10_001)),
      { message: recordLimitMessage }
    );
  }
  // A malformed tail cannot make the parser keep collecting after the limit.
  assert.throws(
    () => parseCsv('address\n' + 'Repeated address\n'.repeat(10_001) + '"unfinished'),
    { message: recordLimitMessage }
  );
  // The final record also counts when it has no terminating newline.
  assert.throws(
    () => parseCsv('address\n' + 'Repeated address\n'.repeat(10_000) + 'Repeated address'),
    { message: recordLimitMessage }
  );
});

test('oversized CSV fails in live CLI before fetch, with no exports or sensitive details', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const dir = await mkdtemp(join(root, '.test-tmp-'));
  const input = join(dir, 'input.csv');
  const output = join(dir, 'review.csv');
  const counter = join(dir, 'requests.txt');
  const preload = join(dir, 'preload.mjs');
  try {
    await writeFile(counter, '');
    await writeFile(preload, `
      import { appendFileSync } from 'node:fs';
      globalThis.fetch = async () => {
        appendFileSync(process.env.STUB_COUNTER, '1');
        throw new Error('SECRET_PAYLOAD');
      };
    `);
    for (const record of ['SECRET_ADDRESS', '']) {
      await writeFile(input, 'address\n' + (record + '\n').repeat(10_001));
      const result = spawnSync(process.execPath, [
        '--import', pathToFileURL(preload).href, join(root, 'src/cli.js'),
        '--input', input, '--output', output
      ], {
        encoding: 'utf8',
        timeout: 10_000,
        env: {...process.env, GEOAPIFY_API_KEY: 'SECRET_KEY', STUB_COUNTER: counter}
      });
      assert.ifError(result.error);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr.trim(), 'Address Review CSV: ' + recordLimitMessage);
      assert.equal(await readFile(counter, 'utf8'), '');
      await assert.rejects(access(output));
      await assert.rejects(access(output + '.summary.json'));
      assert.ok(![result.stdout, result.stderr].join('').includes('SECRET'));
    }
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
