import test from 'node:test';
import assert from 'node:assert/strict';
import { access, copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('missing input and fixture produce distinct safe messages before any network call', async () => {
  const dir = await mkdtemp(join(root, '.test-tmp-'));
  const preload = join(dir, 'no-network.mjs');
  const counter = join(dir, 'calls.txt');
  try {
    await writeFile(preload, `
      import { appendFileSync } from 'node:fs';
      globalThis.fetch = async () => {
        appendFileSync(process.env.STUB_COUNTER, '1');
        throw new Error('unexpected network');
      };
    `);
    const cases = [
      {
        input: join(dir, 'PRIVATE-input.csv'),
        fixture: join(root, 'examples/synthetic-responses.json'),
        message: 'Input file not found'
      },
      {
        input: join(root, 'examples/addresses.csv'),
        fixture: join(dir, 'PRIVATE-fixture.json'),
        message: 'Offline fixture file not found'
      }
    ];
    for (const scenario of cases) {
      const result = spawnSync(process.execPath, [
        '--import', pathToFileURL(preload).href,
        join(root, 'src/cli.js'), '--input', scenario.input,
        '--output', join(dir, 'review.csv'), '--offline', scenario.fixture
      ], {
        encoding: 'utf8',
        env: { ...process.env, GEOAPIFY_API_KEY: 'TEST_SECRET', STUB_COUNTER: counter }
      });
      assert.equal(result.status, 1);
      assert.equal(result.stderr.trim(), `Address Review CSV: ${scenario.message}`);
      assert.ok(![result.stdout, result.stderr].join('').includes('PRIVATE'));
      assert.ok(![result.stdout, result.stderr].join('').includes('TEST_SECRET'));
      await assert.rejects(access(counter));
      await assert.rejects(access(join(dir, 'review.csv')));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Git ignores common local inputs/exports while keeping reviewed synthetic examples', async t => {
  if (spawnSync('git', ['--version']).status !== 0) {
    t.skip('Optional Git hygiene check requires Git; runtime and remaining tests do not');
    return;
  }
  const dir = await mkdtemp(join(root, '.test-tmp-'));
  try {
    await copyFile(join(root, '.gitignore'), join(dir, '.gitignore'));
    const init = spawnSync('git', ['init', '--quiet'], { cwd: dir, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    const ignored = [
      'addresses.csv', 'review.csv', 'review.csv.summary.json',
      'other.summary.json', 'nested/client.csv', 'local-data/customer.json',
      'output/candidates.json', '.env', '.env.local'
    ];
    const retained = [
      'examples/addresses.csv', 'examples/synthetic-responses.json',
      '.env.example', 'README.md'
    ];
    const check = spawnSync('git', [
      '-c', 'core.excludesFile=', 'check-ignore', '--no-index', '--stdin'
    ], { cwd: dir, encoding: 'utf8', input: [...ignored, ...retained].join('\n') + '\n' });
    assert.equal(check.status, 0, check.stderr);
    assert.deepEqual(check.stdout.trim().split(/\r?\n/).sort(), [...ignored].sort());
    assert.ok((await readFile(join(dir, '.gitignore'), 'utf8')).includes('!examples/addresses.csv'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
