# Address Review CSV

Turn a list of addresses into a review queue containing geocoding candidates and explicit reasons to check them. This Node.js command-line tool uses [Geoapify](https://www.geoapify.com/). It never silently accepts the first result, changes the input file or declares an address deliverable.

**Powered by [Geoapify](https://www.geoapify.com/). © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).** Each exported row and the summary retain these notices; available provider datasource attribution, licence and URL are carried through as well.

## Try it offline

Requires Node.js 22 or newer and npm. No dependencies, installation, account or API key are needed for the offline example. From a fresh checkout, enter this directory and run:

```sh
node --version
npm test
npm run demo
```

The demo writes `demo-review.csv` and `demo-review.csv.summary.json`. Expect 5 input records, 8 output rows and 3 unique synthetic lookups. One input row has no address; another repeats an address but expects a different postcode. The fixtures describe invented places with arbitrary coordinates, not provider data or evidence of geocoding accuracy. Re-running requires a different output name or moving the previous output; files are never overwritten.

## Your CSV

Use comma-separated UTF-8 CSV with a header. The required column is `address`, or name another column with `--address-column`. Optional `country_code`, `postcode`, `city` and `housenumber` columns provide independent expectations used to check each candidate. Include country and locality in the free-text address itself: these expectation columns are **not** appended to the query and do not filter the provider search.

```csv
id,address,country_code,postcode,city,housenumber
demo-1,"12 Example Road, Sampletown",zz,00001,Sampletown,12
```

Other columns are preserved as `input.<original header>` in every candidate row. Postcodes and IDs remain strings. A record number starts at 2 and counts logical CSV records, including quoted multiline fields; it is not a physical line number. Quoted commas, quotes, newlines, CRLF, LF and a UTF-8 BOM are supported. Duplicate or empty headers, incorrect field counts, invalid quotes, NUL and invalid UTF-8 fail before any API call. Blank records are subject to the same strict field-count check. Maximum input size is 10 MiB. Semicolon/TSV, XLSX, automatic delimiter detection and structured geocoding are outside this version.

## Live use

Obtain a key and confirm your plan's current limits in [Geoapify MyProjects](https://myprojects.geoapify.com/). Set `GEOAPIFY_API_KEY` in your process environment using your normal secret manager. Alternatively put it in a local, ignored `.env` file and use Node's built-in environment loader:

```sh
node --env-file=.env src/cli.js --input addresses.csv --output first-review.csv --max-requests 3
```

`.env.example` documents the variable but contains no working credential. Never paste a real key into source, screenshots, logs, issue reports or public tutorials. The tool does not create an account, buy a plan or enable billing. Its request cap is per invocation, not a provider-enforced daily or financial limit. Check aggregate usage across every process/project before running; stop rather than increase usage if the available allocation is uncertain.

Requests run sequentially with a minimum one-second gap, a 15-second timeout and no retries. Redirects are rejected. The fixed endpoint is `https://api.geoapify.com/v1/geocode/search`, using `format=json`, `lang=en`, `bias=countrycode:none` and a candidate limit of 3. Addresses are trimmed for lookup and deduplicated exactly, case sensitively, within one run. Original input values remain attached to each row. No persistent response cache is written.

The default cap is 10 unique, nonempty addresses. A larger file fails before sending anything unless an appropriate `--max-requests` is explicitly provided (1-1000). This is a guardrail, not permission to spend or exceed an account allocation. `--limit` accepts 1-5 candidates; reducing it can conceal alternative matches. The provider can return fewer candidates than requested.

```sh
node src/cli.js --help
node src/cli.js --input addresses.csv --address-column shipping_address --output second-review.csv --max-requests 10 --limit 3 --interval-ms 1500
```

Live input addresses are sent to Geoapify. Use only data you are authorised to process. Input/output files can contain personal data: store them privately, restrict access and follow an appropriate retention policy. Included examples contain no client data.

Local `*.csv` inputs, `*.summary.json` exports and the `local-data/` and `output/` directories are ignored by Git. The reviewed `examples/addresses.csv` is explicitly retained, along with the synthetic response fixture. Prefer keeping private working data under `local-data/`; create that directory yourself before using it as an output parent. Ignore rules reduce accidental additions but do not protect already tracked files or `git add --force`. Check the staged files before every publication. Never replace a tracked synthetic example with client data.

Missing files produce distinct `Input file not found` and `Offline fixture file not found` messages without echoing paths. Both stop before network activity. Encoding, JSON syntax and permission failures continue to use a generic safe message.

## Reading the queue

Each candidate gets its own row in provider order. `candidate_rank` describes that order, not an endorsement. An empty address, empty result or failed lookup produces one visible review row instead of disappearing.

| Signal | Reason emitted |
| --- | --- |
| Overall confidence below 0.90 | `low_confidence` |
| Missing, nonnumeric or out-of-range confidence | `confidence_missing_or_invalid` |
| Missing or out-of-range latitude/longitude | `coordinates_missing_or_invalid` |
| Result type other than building or amenity | `coarse_result` |
| Match type other than full match | `not_full_match` |
| Supplied expectation absent/different in candidate | `<field>_missing` / `<field>_mismatch` |
| Another returned candidate within 0.05 confidence | `similar_confidence_candidates` |
| Empty address / no returned candidates | `empty_address` / `no_candidates` |

Country, postcode and city comparisons normalise Unicode (NFKC), letter case, spaces, periods, commas and hyphens. House-number comparisons use only NFKC, lowercase and trimming of surrounding whitespace: internal spaces, periods, commas, hyphens and slashes remain meaningful. Thus `12-14` differs from `1214`, while ` 12A ` matches `12a`. Comparisons do not reconcile abbreviations, translated city names or postal conventions. This conservative check can flag legitimate variations. Confidence thresholds are documented application heuristics, not a calibrated probability, provider recommendation or claim of correctness. `match_type` indicates the matching level and must not substitute for confidence or field checks.

Candidates with flags have `review_status=review_required`. Candidates without flags have `ready_for_review` and the reason `human_confirmation_required`. **Neither status is acceptance.** Check the original address, alternative candidates and independent context before choosing a result. Missing optional expectations reduce what the tool can check. With an ambiguous free-text input, even a high-confidence candidate may be wrong. The CSV does not implement reviewer decisions or write corrected addresses back.

The summary records counts, attempted lookups, mode, candidate limit, attribution, policy version and thresholds; `automatically_accepted` is always zero. Offline lookup counts are fixture lookups, not network traffic. The CLI prints only the summary. An HTTP/network/schema failure stops further new lookups, creates explicit error/not-requested rows and returns exit code 2. Already fetched addresses can still be reused. There are no automatic retries, including for 429. Fix the cause and deliberately rerun with a new output name; that consumes new requests. Missing fixture entries similarly stop an offline run.

Before processing, destination checks reject existing files (including symlinks) and verify that each parent exists and is a directory. A temporary exclusive-create/write/delete probe checks basic usability without leaving a file on success. Final output writes still use exclusive creation to prevent overwrites if another process creates a destination later. A later permission, storage or directory change can still cause a write failure.

Consumed provider fields are type-checked before review/export. A nested object in a string/number field, malformed rank or malformed datasource becomes `invalid_provider_response`; earlier successes are retained, the failed input remains visible and further new lookups stop. Missing/null optional fields are allowed and yield appropriate missing-data review flags; unknown unconsumed provider fields are ignored.

Exit codes: 0 = completed, including records needing review; 1 = invalid configuration/input or local file failure; 2 = interrupted provider/fixture processing with a review export. Check both files after any local write error: the CSV may already exist if writing the summary failed. Files use exclusive creation but the two-file write is not a transaction. Error messages suppress raw URLs, provider bodies and fetch exceptions to avoid credential disclosure.

Cells beginning with spreadsheet formula triggers, including whitespace before `=`, `+`, `-` or `@`, are prefixed with an apostrophe on export. This includes negative coordinates: import them explicitly as numbers after review if needed. Preserve the original CSV separately when byte-exact values matter. CSV quoting alone does not prevent spreadsheet formula execution.

## Licence and provenance

Original source, hand-authored synthetic fixtures and documentation are [MIT licensed](LICENSE). The licence does not relicense Geoapify responses, OpenStreetMap data or third-party sources. Live results stay outside this package; preserve their returned datasource notices and comply with applicable upstream terms when sharing data. See [THIRD_PARTY.md](THIRD_PARTY.md) for the official sources consulted and [the tutorial](docs/TUTORIAL.md) for the build walkthrough. The [prompt and correction log](docs/PROMPT_CORRECTION_LOG.md) records AI assistance and actual implementation decisions.

This version is a CLI core, with no web UI or asynchronous Batch API integration. Live smoke checks establish transport/schema compatibility only; they do not measure accuracy, account balance, daily quota or future availability. Review public package contents before publication; do not publish real `.env`, customer CSVs or live output.

## Continuous integration

The included GitHub Actions workflow is configured for Windows/Linux and Node.js 22/24. Each job runs the offline suite and synthetic demo with read-only repository permissions, SHA-pinned official actions, no configured secrets and no dependency cache. It uses standard hosted runners, with no paid or larger runner configuration. The checkout and Node setup need GitHub/network access; the tests and demo make no provider requests. Configuration alone is not evidence of successful runs: inspect the repository's Actions results after a push. The optional Git ignore-regression test is skipped if Git is unavailable; the CLI itself requires only Node.
