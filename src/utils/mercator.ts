const EARTH_RADIUS = 6378137;

export type Bbox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

function mercatorMetersToLonLat(mx: number, my: number): { lon: number; lat: number } {
  const lon = (mx / EARTH_RADIUS) * (180 / Math.PI);
  const lat = (Math.atan(Math.sinh(my / EARTH_RADIUS)) * 180) / Math.PI;
  return { lon, lat };
}

function lonLatToMercatorMeters(lon: number, lat: number): { mx: number; my: number } {
  const mx = (lon * Math.PI / 180) * EARTH_RADIUS;
  const my = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * EARTH_RADIUS;
  return { mx, my };
}

/**
 * Expands a WGS84 bbox outward by paddingMeters on all sides.
 * Padding is applied in Web Mercator space for metric accuracy.
 */
export function expandBbox(bbox: Bbox, paddingMeters: number): Bbox {
  if (paddingMeters === 0) return bbox;
  const sw = lonLatToMercatorMeters(bbox.west, bbox.south);
  const ne = lonLatToMercatorMeters(bbox.east, bbox.north);
  return {
    south: mercatorMetersToLonLat(sw.mx, sw.my - paddingMeters).lat,
    west:  mercatorMetersToLonLat(sw.mx - paddingMeters, sw.my).lon,
    north: mercatorMetersToLonLat(ne.mx, ne.my + paddingMeters).lat,
    east:  mercatorMetersToLonLat(ne.mx + paddingMeters, ne.my).lon,
  };
}

export function tileIndexToBbox(x: number, y: number, res: number): Bbox {
  // Tile corner in Web Mercator meters (x, y are tile indices; tile size == res).
  const x0 = x * res;
  const y0 = y * res;
  const x1 = x0 + res;
  const y1 = y0 + res;

  const a = mercatorMetersToLonLat(x0, y0);
  const b = mercatorMetersToLonLat(x1, y1);

  return {
    south: Math.min(a.lat, b.lat),
    west: Math.min(a.lon, b.lon),
    north: Math.max(a.lat, b.lat),
    east: Math.max(a.lon, b.lon),
  };
}

