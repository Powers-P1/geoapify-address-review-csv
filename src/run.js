import { reviewCandidates, POLICY, ATTRIBUTION } from './review.js';
import { validateResponse } from './provider.js';

export async function processRecords(records, { geocode, addressColumn = 'address', maxRequests = 10, intervalMs = 1000, sleep = ms => new Promise(r => setTimeout(r, ms)) }) {
  const queries = [...new Set(records.map(r => r[addressColumn]?.trim()).filter(Boolean))];
  if (queries.length > maxRequests) throw new Error('Unique address count exceeds --max-requests; no requests were sent');
  const cache = new Map(), results = []; let requests = 0, stopped = false;
  for (const [i, input] of records.entries()) {
    const address = input[addressColumn]?.trim(); let candidates = [], reason;
    if (!address) reason = 'empty_address';
    else if (cache.has(address)) ({ candidates, reason } = cache.get(address));
    else if (stopped) reason = 'not_requested_after_provider_error';
    else {
      if (requests) await sleep(intervalMs);
      requests++;
      try { candidates = validateResponse({ results: await geocode(address) }); if (!candidates.length) reason = 'no_candidates'; }
      catch (e) { reason = /^http_\d{3}$|^(network_or_timeout|invalid_provider_response|invalid_provider_json|missing_offline_fixture)$/.test(e.code ?? '') ? e.code : 'provider_error'; stopped = true; }
      cache.set(address, { candidates, reason });
    }
    const reviewed = reason ? [{ review_status: 'review_required', review_reasons: reason }] : reviewCandidates(input, candidates);
    for (const r of reviewed) results.push({ ...Object.fromEntries(Object.entries(input).map(([k,v]) => [`input.${k}`,v])), record_number: i + 2, ...ATTRIBUTION, ...r });
  }
  return { results, summary: { input_records: records.length, output_rows: results.length, requests_attempted: requests, provider_error_stopped_run: stopped, review_required_rows: results.filter(r => r.review_status === 'review_required').length, ready_for_review_rows: results.filter(r => r.review_status === 'ready_for_review').length, policy: POLICY, automatically_accepted: 0 } };
}
