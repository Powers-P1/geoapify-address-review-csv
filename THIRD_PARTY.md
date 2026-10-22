# Provider data and attribution

Research date: 22 October 2026. Primary sources consulted:

- [Geoapify Geocoding API reference](https://apidocs.geoapify.com/docs/geocoding/): endpoint, JSON results, query parameters, confidence, match type and datasource metadata.
- [Geoapify Geocoding API product page](https://www.geoapify.com/geocoding-api/): attribution guidance.
- [Geoapify terms](https://www.geoapify.com/terms-and-conditions/): current page identifies version 5, 2 February 2024. Free-plan usage requires Geoapify attribution and the terms require OpenStreetMap attribution; additional source requirements can apply. Plan limits and overage provisions must be checked for the actual account/agreement.
- [OpenStreetMap copyright and licence information](https://www.openstreetmap.org/copyright): linked attribution destination. The project carries the link; the implementation does not fetch OSM data directly.

Do not infer a universal no-overage guarantee or unlimited licence from this project. The programme allocation used for the bounded private smoke check was separately confirmed by its organiser as no-cost; public users must check their own plan. Current terms and the applicable agreement take precedence over a README summary.

Original project code, documentation and `examples/synthetic-responses.json` are MIT licensed. The synthetic response objects were hand-authored from the documented field schema; no provider examples or production payloads were copied. Invented names and arbitrary ocean coordinates are demonstrative only.

Provider data is not placed under MIT. CSV output retains Geoapify/OpenStreetMap notices, an explicit [ODbL licence link](https://opendatacommons.org/licenses/odbl/1-0/), plus returned `datasource.sourcename`, `attribution`, `license` and `url` fields. Do not strip those fields when redistributing results. A returned source may impose further conditions; investigate those before a separate data publication. No live provider payload is bundled as a fixture.
