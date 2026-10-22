export const POLICY = Object.freeze({ confidence: 0.9, closeCandidateGap: 0.05, version: '1' });
export const ATTRIBUTION = Object.freeze({
  provider_attribution: 'Powered by Geoapify - https://www.geoapify.com/',
  osm_attribution: '© OpenStreetMap contributors - https://www.openstreetmap.org/copyright',
  osm_license: 'Open Database License (ODbL) - https://opendatacommons.org/licenses/odbl/1-0/'
});
const norm = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('en').replace(/[\s.,-]+/gu, '');
const houseNorm = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('en').trim();
const confidence = c => typeof c?.rank?.confidence === 'number'
  && Number.isFinite(c.rank.confidence)
  && c.rank.confidence >= 0 && c.rank.confidence <= 1 ? c.rank.confidence : null;
const coordsValid = c => typeof c.lat === 'number' && typeof c.lon === 'number'
  && Number.isFinite(c.lat) && Number.isFinite(c.lon)
  && Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180;

export function reviewCandidates(input, candidates) {
  return candidates.map((candidate, index) => {
    const c = candidate ?? {};
    const reasons = [];
    const score = confidence(c);
    if (score === null) reasons.push('confidence_missing_or_invalid');
    else if (score < POLICY.confidence) reasons.push('low_confidence');
    if (!coordsValid(c)) reasons.push('coordinates_missing_or_invalid');
    if (!['building', 'amenity'].includes(c.result_type)) reasons.push('coarse_result');
    if (c.rank?.match_type !== 'full_match') reasons.push('not_full_match');
    for (const field of ['country_code', 'postcode', 'city', 'housenumber']) {
      if (!input[field]?.trim()) continue;
      if (!c[field]) reasons.push(`${field}_missing`);
      else {
        const compare = field === 'housenumber' ? houseNorm : norm;
        if (compare(input[field]) !== compare(c[field])) reasons.push(`${field}_mismatch`);
      }
    }
    const similarAlternative = candidates.some((other, j) => j !== index
      && score !== null && confidence(other) !== null
      && Math.abs(score - confidence(other)) <= POLICY.closeCandidateGap + Number.EPSILON);
    if (similarAlternative) reasons.push('similar_confidence_candidates');
    return {
      candidate_rank: index + 1,
      review_status: reasons.length ? 'review_required' : 'ready_for_review',
      review_reasons: reasons.length ? reasons.join(';') : 'human_confirmation_required',
      formatted: typeof c.formatted === 'string' ? c.formatted : '',
      lat: c.lat ?? '',
      lon: c.lon ?? '',
      confidence: score ?? '',
      match_type: c.rank?.match_type ?? '',
      result_type: c.result_type ?? '',
      country_code: c.country_code ?? '',
      postcode: c.postcode ?? '',
      city: c.city ?? '',
      housenumber: c.housenumber ?? '',
      datasource_name: c.datasource?.sourcename ?? '',
      datasource_attribution: c.datasource?.attribution ?? '',
      datasource_license: c.datasource?.license ?? '',
      datasource_url: c.datasource?.url ?? '',
      ...ATTRIBUTION
    };
  });
}

export const RESULT_HEADERS = [
  'record_number', 'candidate_rank', 'review_status', 'review_reasons',
  'formatted', 'lat', 'lon', 'confidence', 'match_type', 'result_type',
  'country_code', 'postcode', 'city', 'housenumber', 'datasource_name',
  'datasource_attribution', 'datasource_license', 'datasource_url',
  'provider_attribution', 'osm_attribution', 'osm_license'
];
