# AI assistance and actual correction log

Date: 22 October 2026. This is a concise record of the real instructions and corrections during development, not a fabricated verbatim transcript or time sheet. No client data, credentials, private programme email or unrelated project context is included.

## Task instructions, condensed

1. Accept ownership of Address Review CSV and wait until the coordinator confirms actual subscription allowance renewal. No implementation or API access during the hold.
2. After verified release, build an original Node.js CSV/CLI core: show candidates and explicit reasons for human review, with offline synthetic fixtures/tests, reproducible README, MIT originals and a tutorial linking to Geoapify. No web UI; optional Batch API deferred.
3. Research official current API documentation and licensing. Use the environment key for at most five synthetic-address smoke requests total. Do not publish a repository, send messages, purchase resources or expose credentials. Deliver locally for independent coordinator review.

## Verbatim project-only repair prompt excerpt

The following excerpt is copied verbatim from the actual coordinator repair instruction used for the revisions below. Internal paths, coordination identifiers and unrelated operational context before/after this excerpt are omitted. The initial numbered instructions above remain a condensed summary, not a verbatim transcript.

> Findings: (1) nested provider candidate housenumber:{toString:null} passes validateResponse then crashes review with exit1/no CSV after1stubrequest: must validate shape/types safely, fail as explicit provider-schema error and visible review/error rows, without raw payload/secret leak. (2) nonexistent output parent currently consumes a request then fails: preflight output/summary destination parent existence/type/usability before any API call; preserve non-overwrite/race-safe file behavior. (3) housenumber12-14 currently compares equal1214 under punctuation normalisation: compare house numbers conservatively so meaningful ranges/separators never silently collapse; document exact normalisation and add meaningful regression.

## Implementation choices

- Used Node.js built-ins and no third-party dependencies so a clean copy can run offline immediately.
- Kept CSV parsing, HTTP transport, record orchestration and review rules in separate modules. The transport is injectable for offline error tests.
- Kept every candidate rather than treating the first as accepted. Field conflicts are checked against each input row, including duplicate queries with different expectations.
- Chose conservative, explicitly uncalibrated review thresholds and retained attribution in the export. Original fixtures are fictional schema examples, not copied provider responses.

## Actual corrections during review

1. **Attribution on placeholder rows:** initial candidate rows retained attribution but empty/error rows did not. Moved baseline Geoapify/OSM notices into record output so every exported row retains them; added an end-to-end assertion.
2. **Request reproducibility:** added explicit English output and `bias=countrycode:none` rather than relying on implicit location/language defaults.
3. **Strict encoding:** replaced permissive UTF-8 reading with a fatal decoder; added an invalid-byte CLI case. Bad encoding fails before API calls.
4. **Test file scope:** the initial integration test used the OS temporary directory. It was changed to a removable `.test-tmp-*` directory inside the package. The initial temporary test directory was already removed by its test cleanup; no persistent files outside the package are required.
5. **Candidate/output bounds:** the adapter now slices validated responses to the requested candidate limit even if a server returns more.
6. **Actionable, safe failures:** missing fixture entries now have their own reason code. The CLI reveals allowlisted validation messages while continuing to suppress raw filesystem/network/provider errors and request URLs.
7. **Local verification command:** an initial attempt to inspect the live export used a root-relative path while the working directory was the package, so the read failed. The API request was not repeated; the export was subsequently inspected by its correct path.
8. **Explicit data licence link:** after checking OSM's data-form attribution guidance, added an ODbL name/direct link on every CSV row and in the summary. Centralised baseline attribution so candidate and placeholder rows cannot diverge. The already completed live run predates this local attribution-only change and was not repeated.
9. **Independent QA: malformed nested candidate fields:** added type checks for every consumed scalar and nested rank/datasource field before review and CSV coercion. Regressions confirm earlier successes survive a later malformed response and that CLI exits 2 with visible schema-error/skipped rows without leaking payloads.
10. **Independent QA: unusable output parent:** added parent existence/type and actual create/write/delete preflight. A fake-fetch CLI regression proves missing/file parents consume zero requests; exclusive final writes still refuse existing output.
11. **Independent QA: house-number ranges:** house numbers now use only NFKC, lowercase and outer trimming. Tests preserve meaningful hyphens, slashes, periods and internal spaces, so `12-14` is distinct from `1214`.
12. **Factual review wording and regression harness:** replaced an unsupported statement about human code review with independent review. The new fake-fetch CLI test initially used a Windows absolute preload path unsupported by Node ESM; converted it to a file URL, then all 16 offline tests passed. That initial harness failure did not make a live request.
13. **Fresh delivery review: local data hygiene:** expanded Git ignore rules to cover common local CSV and summary names, plus private working directories; explicitly retained the reviewed synthetic CSV. Added a real `git check-ignore` regression in an isolated temporary repository, using only dummy paths and no real data or secret.
14. **Fresh delivery review: onboarding failures:** added distinct safe missing-input and missing-fixture messages. A disabled-network CLI regression checks both messages, exit code 1, no output and zero fetch calls without revealing private-looking filenames or a fake key.
15. **Fresh delivery review: teaching and maintenance:** added a three-row worked example and proposed human dispositions outside the CLI. Expanded dense source/test statements for readability without changing the review policy or adding runtime dependencies. Added a Windows/Linux, Node 22/24 offline test/demo workflow with verified SHA-pinned official actions, read-only permissions and no configured secrets or cache. Actual hosted CI results must be observed after the coordinator pushes it; no CI success is claimed here.
16. **Formatting correction caught before release:** the first post-polish test run caught a CLI syntax error introduced while expanding the old error-message regular expression. Replaced its leftover lines with the intended readable message allowlist and reran the offline suite. No provider request occurred during that failed run.

## Verification record

- Initial 13 offline tests passed. They were run again after encoding, attribution and scope corrections; all passed. Later changes are subject to the final test evidence delivered to the coordinator.
- One bounded live run made **3 requests total** with invented address strings. The CLI completed without a provider failure; 3 inputs produced 4 review rows, with zero automatically accepted results. No retries or other live calls were made.
- Clean-copy verification, package inventory and final test evidence are provided separately to the coordinator. A local clean copy is not a claim that a public repository already exists or has been cloned.

After corrections 9-12, independent agent re-review passed and the coordinator verified a real remote fresh clone, then published that reviewed revision. A subsequent fresh professional review found no material code blocker and identified the delivery polish addressed in corrections 13-15. Those new changes require the coordinator's final verification and push; configured hosted CI is not yet an observed result. The earlier pre-publication review-pending state is historical. No human code review or approval is claimed. AI assistance is disclosed here; no measured hours, client acceptance, sponsorship earnings or accuracy results are claimed.
## Release corrections - 23 October 2026

The complete earlier log above is preserved as historical evidence. Its statements that hosted CI was still pending describe that earlier point in development. Subsequently, the prior revision's 18 offline tests and four Windows/Linux, Node.js 22/24 CI jobs were observed passing on 22 October 2026 at 18:13:48 UTC. That historical result does not verify the changes below.

### Actual project-only repair instruction

> Please add a hard limit of 10,000 data records, excluding the header, and enforce it while parsing before any geocoding request. Count blank records and duplicate addresses toward the limit. Reject an oversized file with a clear, safe error and no output or provider call. Add bounded regression tests for the exact limit, one record above it, and the command-line zero-request failure. Document the record limit alongside the existing byte limit.

### Corrections and verification status

- Added the parser's fixed 10,000-data-record limit alongside the existing 10 MiB input limit, with a safe command-line error. The header is excluded; blank and duplicate records count. Added bounded regressions for the exact boundary, excess records and a fake-fetch CLI failure with no provider calls or exports.
- Corrected the confidence table: nonnumeric provider values are schema failures (`invalid_provider_response`); missing/null or out-of-range numeric values produce `confidence_missing_or_invalid`.
- Documented candidate row multiplication and memory limitations, and added a stable tutorial link to `main` while retaining relative documentation links.

Local verification on 23 October 2026 passed all 21 offline tests, including the three new bounded regressions, and the synthetic demo produced 8 review rows from 5 input records with zero automatically accepted results. No live API requests were made. Hosted CI, the final public revision and the main-branch tutorial link are release checks recorded in the dated verification update below; local checks alone do not establish those remote results. Organizer review and final acceptance remain pending.

### Release verification - 23 October 2026

The corrected functional revision `56109e97a56808bbf32619ebcdec37d08658fb75` is published on `main`, now the repository's default branch. Existing commits and the original journal are preserved. The README links to the [main-branch tutorial](https://github.com/Powers-P1/geoapify-address-review-csv/blob/main/docs/TUTORIAL.md); its public URL and contents were verified on 23 October 2026.

[Hosted verification run 39942589782](https://github.com/Powers-P1/geoapify-address-review-csv/actions/runs/39942589782) completed successfully at 2026-10-23T10:57:07Z. All four combinations of Ubuntu/Windows and Node.js 22/24 passed all 21 offline tests with zero failures or skips. Each also ran the synthetic demo: 5 input records, 8 review rows and zero automatically accepted results. These checks made no live Geoapify requests. This dated evidence note is a documentation-only follow-up to that tested functional revision.

Organizer review is in progress. These technical checks do not constitute final program acceptance, a sponsorship award or an invoice.
