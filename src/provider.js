export class ProviderError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export function validateResponse(body) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const optional = (value, type) => value == null || typeof value === type;
  const strings = (value, fields) => fields.every(field => optional(value[field], 'string'));
  const validCandidate = c => object(c)
    && strings(c, ['formatted','country_code','postcode','city','housenumber','result_type'])
    && optional(c.lat, 'number') && optional(c.lon, 'number')
    && (c.rank == null || (object(c.rank) && optional(c.rank.confidence, 'number') && optional(c.rank.match_type, 'string')))
    && (c.datasource == null || (object(c.datasource) && strings(c.datasource, ['sourcename','attribution','license','url'])));
  if (!object(body) || !Array.isArray(body.results) || !body.results.every(validCandidate)) {
    throw new ProviderError('invalid_provider_response');
  }
  return body.results;
}
export function makeGeocoder({ apiKey, limit = 3, fetchImpl = fetch, timeoutMs = 15000 }) {
  if (!apiKey?.trim()) throw new ProviderError('missing_api_key');
  return async address => {
    const url = new URL('https://api.geoapify.com/v1/geocode/search');
    url.search = new URLSearchParams({
      text: address,
      format: 'json',
      lang: 'en',
      bias: 'countrycode:none',
      limit: String(limit),
      apiKey
    });
    let response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
    } catch {
      throw new ProviderError('network_or_timeout');
    }
    // Never expose provider bodies, fetch messages, or request URLs: they may contain secrets.
    if (!response.ok) throw new ProviderError(`http_${response.status}`);
    try {
      return validateResponse(await response.json()).slice(0, limit);
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError('invalid_provider_json');
    }
  };
}
