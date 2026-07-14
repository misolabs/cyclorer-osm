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

4. `acceptable`
   - legal and usable, but not calm enough to count as low risk
   - `highway=residential`, `service`, or `unclassified` without stronger low-risk evidence
   - `highway=tertiary` or `highway=tertiary_link` with `maxspeed <= 50` or no maxspeed
   - `highway=secondary` or `highway=secondary_link` with `maxspeed <= 40`

5. `adult_only`
   - default for remaining bike-legal ways
   - `highway=primary` or `highway=primary_link`
   - `highway=secondary` or `secondary_link` above the acceptable threshold
   - `highway=tertiary` or `tertiary_link` above the acceptable threshold
   - anything else that is still bike-legal

## Notes

- `cycleway=lane` and `cycleway=shared_lane` are not designated.
- `facycle:routes` is a supporting signal for signed routes, not a classification category by itself.
- Relation processing should happen before relation elements are dropped from the raw OSM payload.
