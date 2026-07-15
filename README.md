# cyclorer-osm

TypeScript Fastify API for serving tile-based OSM data as GeoJSON.

## Endpoints

- `GET /version`
- `GET /tiles/highways/:x/:y/:res`
  - `x`, `y`: tile index components derived from Web Mercator corner coordinates (`cornerMeters / res`)
  - `res`: tile edge size in meters

## Behavior

- Computes bbox in WGS84 from Web Mercator tile indices
- Queries Overpass for `way[highway]` plus node geometry
- The Overpass service caches raw query responses in `CACHE_DIR/overpass/` for 60 days before post-processing
- A highways pipeline applies post-processing to raw OSM data before GeoJSON conversion
- The pipeline adds `facycle:routes` arrays to member ways for `route=bicycle` relations
- The pipeline adds `facycle:classification` to highway ways using a mutually exclusive ordered scheme
- The pipeline strips relation elements before `osmtogeojson` to avoid relation geometry in the output
- Converts OSM JSON to GeoJSON via `osmtogeojson`
- Marks detected dead-ends touching the core tile with `properties.deadend = true`
- Caches final GeoJSON response to local files under `CACHE_DIR/geojson/`

## Tile coordinate model

- `res` is both the tile size and the index unit in Web Mercator meters
- Tile origin: `(x * res, y * res)` meters
- Tile extent: `res × res` meters
- `x` and `y` may be negative; `res` must be positive

## Overpass bbox padding

`OVERPASS_BBOX_PADDING_METERS` expands the Overpass query bbox outward on all sides **in Web Mercator space**. Because Mercator exaggerates distances at higher latitudes, the on-the-ground distance is smaller than the configured value:

```
ground_metres ≈ configured_metres × cos(latitude)
```

| Latitude | 1000 m Mercator → ground |
|----------|--------------------------|
| 0° (equator) | 1000 m |
| 49.5° (Luxembourg) | ~650 m |
| 60° | ~500 m |

To target a specific ground distance: `configured = target_metres / cos(latitude_radians)`.

After conversion, a final crop step is applied: a feature is kept only if its geometry **starts or ends** inside the core tile bbox.

## Dead-end tagging

- Dead-end detection runs on the padded Overpass result before GeoJSON conversion
- A returned way is tagged with `deadend: true` when it is part of an iteratively pruned terminal branch and has at least one endpoint inside the core tile (including fully in-tile dead-ends)
- For now, ways with `access=no` are treated as forbidden during pruning

## Env

- `OVERPASS_URLS` accepts a comma-separated list of interpreter endpoints
- First successful endpoint wins; failures fall through to the next endpoint
- Raw Overpass responses are cached inside the Overpass service and expire after 60 days unless invalidated by a query change

## Run

```bash
npm install
npm run dev
```

## Fly.io Deployment

The repo is set up to run on Fly.io with a persistent cache volume mounted at `/app/cache`.

1. Log in and create the app:

```bash
fly auth login
fly apps create cyclorer-osm
```

2. Create the volume in the app region:

```bash
fly volumes create cache_vol --app cyclorer-osm --region lhr --size 1
```

3. Set runtime configuration:

```bash
fly secrets set \
  OVERPASS_URLS="https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter" \
  CORS_ORIGIN="http://localhost:5173,https://misolabs.github.io"
```

4. Deploy:

```bash
fly deploy
```

The container uses `CACHE_DIR=/app/cache`, so the mounted volume is used automatically for both raw Overpass responses and GeoJSON cache files.

`CORS_ORIGIN` accepts a comma-separated allowlist of origins. Use `*` for open CORS.

## Quick test

```bash
curl "http://localhost:3000/version"
curl "http://localhost:3000/tiles/highways/0/0/1000"
```
