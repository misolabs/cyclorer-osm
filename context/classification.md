# facycle:classification

Ordered, mutually exclusive classification for highway ways.
First match wins.

## Order

1. `not_suitable`
   - bicycle forbidden or effectively unusable
   - `bicycle=no`
   - `access=no` unless bicycle access is explicitly allowed
   - `access=private`
   - `highway=motorway` or `highway=motorway_link`
   - `highway=steps`
   - `highway=construction` or `construction=yes`
   - `maxspeed > 90`
   - `highway=footway` without explicit bicycle access
   - `tracktype=grade4` or `grade5`
   - `mtb:scale >= 3`
   - `smoothness=bad` or worse
   - rough `path`/`track`/`bridleway` surfaces such as sand or mud when there is no better evidence

2. `designated`
   - dedicated cycling infrastructure
   - `highway=cycleway`
   - `bicycle=designated`
   - `cycleway=track`
   - `cycleway=separate`

3. `low_risk`
   - family-friendly and calm
   - `highway=living_street`
   - `highway=residential` or `highway=service` with `maxspeed <= 30`
   - `highway=unclassified` with `maxspeed <= 30`
   - `track` with `tracktype=grade1` or good paved surface, smoothness good/excellent, and low MTB difficulty
   - `path` or `bridleway` with explicit bicycle access plus good paved surface and smoothness good/excellent

4. `acceptable`
   - legal and usable, but not calm enough to count as low risk
   - `highway=residential`, `service`, or `unclassified` without stronger low-risk evidence
   - `highway=tertiary` or `highway=tertiary_link` with `maxspeed <= 50` or no maxspeed
   - `highway=secondary` or `highway=secondary_link` with `maxspeed <= 50`
   - `track` with `tracktype=grade2` and reasonable surface/smoothness
   - `footway` with explicit bicycle access and good paved surface
   - `path` or `bridleway` with explicit bicycle access and compacted/gravel-like surface

5. `adult_only`
   - default for remaining bike-legal ways
   - `highway=primary` or `highway=primary_link`
   - `highway=secondary` or `secondary_link` above the acceptable threshold
   - `highway=tertiary` or `tertiary_link` above the acceptable threshold
   - `track` with `tracktype=grade3`
   - remaining `path`/`track`/`bridleway` ways that are still bike-legal but not family-friendly

## Notes

- `cycleway=lane` and `cycleway=shared_lane` are not designated.
- `facycle:routes` is a supporting signal for signed routes, not a classification category by itself.
- Relation processing should happen before relation elements are dropped from the raw OSM payload.
- `surface` and `smoothness` are preferred tie-breakers for offroad ways; `tracktype` and `mtb:scale` cap roughness.
