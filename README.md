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
- Converts OSM JSON to GeoJSON via `osmtogeojson`
- Caches final GeoJSON response to local files under `CACHE_DIR`

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

Cropping the returned GeoJSON to the tile bbox after padding is **not yet implemented** — features from the padded margin will be present in the response.

## Env

- `OVERPASS_URLS` accepts a comma-separated list of interpreter endpoints
- First successful endpoint wins; failures fall through to the next endpoint

## Run

```bash
npm install
npm run dev
```

## Quick test

```bash
curl "http://localhost:3000/version"
curl "http://localhost:3000/tiles/highways/0/0/1000"
```

