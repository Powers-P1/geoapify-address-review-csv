#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseCsv, writeCsv } from './csv.js';
import { RESULT_HEADERS, ATTRIBUTION } from './review.js';
import { makeGeocoder, validateResponse, ProviderError } from './provider.js';
import { processRecords } from './run.js';
import { preflightDestinations } from './destination.js';
import { readInput, readFixture } from './files.js';

const HELP = `Address Review CSV - Powered by Geoapify https://www.geoapify.com/
Usage: node src/cli.js --input addresses.csv --output review.csv [options]
  --offline responses.json   Use synthetic responses; never access the network
  --address-column NAME      Free-text address column (default: address)
  --max-requests N           Unique-address safety cap (default: 10; maximum: 1000)
  --limit N                  Candidates requested per address (default: 3; range 1-5)
  --interval-ms N            Delay between requests (default/minimum: 1000)
  --help                     Show help
Live mode requires GEOAPIFY_API_KEY in the process environment.
Outputs never overwrite files. All candidates require human confirmation.
© OpenStreetMap contributors https://www.openstreetmap.org/copyright`;
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  if (args.length === 1 && args[0] === '--help') {
    console.log(HELP);
    return;
  }
  const allowed = new Set(['input','output','offline','address-column','max-requests','limit','interval-ms']);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].slice(2);
    if (!args[i].startsWith('--') || !allowed.has(key) || options[key] !== undefined
      || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error('Invalid or repeated option; use --help');
    }
    options[key] = args[i + 1];
  }
  if (!options.input || !options.output) throw new Error('--input and --output are required');
  const integer = (key, fallback, min, max) => {
    const value = options[key] === undefined ? fallback : Number(options[key]);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`Invalid --${key}`);
    }
    return value;
  };
  const maxRequests = integer('max-requests', 10, 1, 1000);
  const limit = integer('limit', 3, 1, 5);
  const intervalMs = integer('interval-ms', 1000, 1000, 60000);
  const inputPath = resolve(options.input);
  const outputPath = resolve(options.output);
  const summaryPath = outputPath + '.summary.json';
  if (inputPath === outputPath || resolve(options.offline ?? options.input) === outputPath) {
    throw new Error('Output must differ from input/fixture');
  }
  await preflightDestinations([outputPath, summaryPath]);
  const { headers, records } = parseCsv(await readInput(inputPath));
  const addressColumn = options['address-column'] ?? 'address';
  if (!headers.includes(addressColumn)) throw new Error('Address column not found');
  let geocode;
  if (options.offline) {
    const fixtures = await readFixture(options.offline);
    if (fixtures.fixture_type !== 'synthetic' || !fixtures.responses || typeof fixtures.responses !== 'object') {
      throw new Error('Offline file must declare fixture_type synthetic and responses');
    }
    geocode = async address => {
      if (!Object.hasOwn(fixtures.responses, address)) {
        throw new ProviderError('missing_offline_fixture');
      }
      return validateResponse(fixtures.responses[address]).slice(0, limit);
    };
  } else {
    geocode = makeGeocoder({ apiKey: process.env.GEOAPIFY_API_KEY, limit });
  }
  const { results, summary } = await processRecords(records, {
    geocode,
    addressColumn,
    maxRequests,
    intervalMs: options.offline ? 0 : intervalMs
  });
  summary.mode = options.offline ? 'synthetic_offline' : 'live_geoapify';
  Object.assign(summary, ATTRIBUTION);
  summary.candidates_limit = limit;
  await writeFile(outputPath, writeCsv([...headers.map(h => `input.${h}`), ...RESULT_HEADERS], results), { flag: 'wx' });
  await writeFile(summaryPath, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(summary));
  if (summary.provider_error_stopped_run) process.exitCode = 2;
}
main().catch(e => {
  const safeMessages = new Set([
    'Malformed CSV quoting',
    'Unterminated CSV quote',
    'Address column not found',
    '--input and --output are required',
    'Invalid or repeated option; use --help',
    'Invalid --limit',
    'Invalid --max-requests',
    'Invalid --interval-ms',
    'Output must differ from input/fixture',
    'Output already exists; choose a new output filename',
    'Output parent must exist and be a writable directory',
    'Input file not found',
    'Offline fixture file not found',
    'Input exceeds 10 MiB limit',
    'Unique address count exceeds --max-requests; no requests were sent',
    'Offline file must declare fixture_type synthetic and responses',
    'missing_api_key'
  ]);
  const safe = safeMessages.has(e.message) || /^CSV /.test(e.message ?? "");
  console.error(safe ? `Address Review CSV: ${e.message}` : 'Address Review CSV failed. Check UTF-8 input, fixtures and file permissions. Use --help. Sensitive error details are suppressed.');
  process.exitCode = 1;
});
