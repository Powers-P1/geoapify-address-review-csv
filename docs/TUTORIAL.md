# From address CSV to a human-review queue

A geocoder returns plausible places. A useful review tool also makes uncertainty visible. This tutorial builds a small command-line workflow around [Geoapify](https://www.geoapify.com/) without choosing a winner for the user.

**Powered by [Geoapify](https://www.geoapify.com/). © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).** Consult the [official Geocoding API reference](https://apidocs.geoapify.com/docs/geocoding/) and your account allocation before live use.

## 1. Start with a reproducible example

Use Node.js 22+ and this package's source directory. Run `npm test`, then `npm run demo`. There is no dependency install and the demo needs no network or key. Open the resulting `demo-review.csv` as UTF-8 text or import it into a spreadsheet while treating original IDs/postcodes as text. Read the companion summary JSON too.

The five invented input records deliberately cover an exact candidate, street-level ambiguity, no match, a blank address and a repeated query with a conflicting expected postcode. Eight output rows represent all candidates plus visible placeholder rows. These are synthetic examples, not a performance benchmark. The postcode conflict matters: the second use of an address reuses the response but runs the input checks again.

### A worked review of three exported rows

These are actual selected fields from the synthetic demo export, not live provider results. Candidate 1 for `demo-1` and `demo-5` describes the same invented address with postcode `00001`; the two input records deliberately disagree about the expected postcode.

| input.id | candidate_rank | input.postcode | postcode | review_status | review_reasons |
| --- | --- | --- | --- | --- | --- |
| demo-1 | 1 | 00001 | 00001 | ready_for_review | human_confirmation_required |
| demo-5 | 1 | 99999 | 00001 | review_required | postcode_mismatch |
| demo-3 | (empty) | (empty) | (empty) | review_required | no_candidates |

For `demo-1`, a reviewer would compare candidate 1 with the original source and the other returned candidate, then record a choice only if independent context confirms it. For `demo-5`, defer the choice and resolve whether `99999` in the input or `00001` in the candidate is the correct intended postcode; reusing a response does not resolve that conflict. For `demo-3`, request a complete address or correct the source before a deliberate later lookup.

Record these dispositions in a separate private review sheet using the stable `input.id` to join back to the original records. For a selected candidate, also record its rank within that particular export. These are proposed human actions, not decisions performed by the demo or CLI: no row is automatically accepted and no source address is overwritten.

## 2. Preserve the input before asking the provider

`src/csv.js` handles quoted commas, doubled quotes and multiline cells. It rejects malformed rows rather than trying to repair them silently. `src/cli.js` validates UTF-8, the address column, numeric options, destination availability and input size before processing. `src/destination.js` checks parent directories and uses a temporary create/write/delete probe before any lookup; final exclusive writes still protect against overwrites. Choose a new output filename on every run; original input is never overwritten.

Keep a stable ID column so a reviewer can join a chosen candidate back to its source. Optional `country_code`, `postcode`, `city` and `housenumber` are expectations, not query parameters. Put enough locality information in `address` to make the free-text request meaningful.

## 3. Separate transport from review

`src/provider.js` builds a URL with `URLSearchParams` and sends a timed fetch to the fixed Geoapify search endpoint. JSON mode exposes a `results` array. English output and no country bias make the request explicit. Several candidates are requested instead of just taking element zero. The API key comes only from `GEOAPIFY_API_KEY`.

`src/run.js` accepts a geocode function. Offline mode supplies fictional responses; live mode supplies the HTTP adapter. This boundary lets tests simulate quotas, timeouts and malformed responses without spending requests. Consumed candidate fields, including nested rank/datasource values, must have the documented scalar/object types; malformed values create visible schema-error rows while retaining earlier successes. A per-run cap checks unique, trimmed, nonempty inputs before the first call. Sequential requests are spaced by at least one second. The implementation does not retry errors: an interrupted run tells the user which inputs were not requested.

## 4. Explain every candidate

`src/review.js` emits all candidates in provider order. A confidence below 0.90, coarse result, non-full match, invalid coordinates, mismatch with an expected field or similarly confident alternative adds a named reason. The 0.90 and 0.05 thresholds are project heuristics, not statistically validated acceptance criteria. The provider's confidence and matching level describe different aspects of a result; use both.

Even a candidate without these flags has `human_confirmation_required`. The tool does not validate deliverability, building existence or unit numbers, and it does not know the intended location of an ambiguous input. A reviewer compares alternatives and the original record before making a decision outside this CLI. House numbers retain meaningful internal punctuation and spaces: `12-14` cannot become `1214` during comparison. Only Unicode NFKC, lowercase and surrounding-whitespace trimming apply to that field. Transliteration and abbreviated city names can produce false-positive mismatch flags; these require judgment, not a lower threshold applied blindly.

## 5. Export safely with provenance

Each CSV row repeats original columns under an `input.` prefix, then adds candidate fields, status and reasons. Empty/error results remain visible. Formula-triggering cells are apostrophe-prefixed for safer spreadsheet import. This can make a negative longitude textual; convert it intentionally after review rather than stripping the protection from the entire file.

The export also retains datasource licence and attribution metadata where supplied, alongside Geoapify/OpenStreetMap notices. A companion summary records policy settings and counts. Code licensing and data licensing are separate: original code is MIT, while provider data remains subject to its source conditions.

## 6. Make a deliberately small live check

With a valid authorised key in a local ignored `.env`, run:

```sh
node --env-file=.env src/cli.js --input addresses.csv --output live-review.csv --max-requests 3
```

Use at most three unique test inputs for this command. Check your actual remaining allowance first: the option caps this run only. Do not upload customer addresses without authority. No key, full request URL or raw HTTP failure should appear in logs. On quota/auth errors, stop, examine the safe reason code and account configuration, then decide whether a later rerun is appropriate.

The private development smoke run used three invented address strings. The endpoint returned successfully and produced four rows, all requiring review. This checks the adapter and flags on those inputs, not geocoding accuracy or the remaining daily quota. Its live responses are deliberately excluded from this reproducible package.

## 7. Reproduce and review the implementation

`npm test` runs Node's built-in test runner. Tests cover parsing, injection protection, review reasons, deduplication with different expectations, preflight caps, stop-on-error behaviour, request shape, sanitised failures and CLI execution without a key. They make no network requests. Review [PROMPT_CORRECTION_LOG.md](PROMPT_CORRECTION_LOG.md) for the actual AI-assisted build decisions, and [THIRD_PARTY.md](../THIRD_PARTY.md) before redistributing output.

The next useful validation is independent review against intended user cases. An asynchronous Batch API or UI would require a separately reviewed extension; neither is needed to understand and run this core.
