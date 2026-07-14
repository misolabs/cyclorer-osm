import type { Bbox } from '../utils/mercator';
import { detectDeadendWayIds } from '../transforms/deadends';
import { annotateBicycleRouteMembership, dropRelationElements } from '../transforms/overpass';
import { overpassToGeoJson } from '../services/geojson';
import type { OverpassResponse } from '../services/overpass';

export function buildHighwaysFeatureCollection(
  payload: OverpassResponse,
  tileBbox: Bbox,
  queryBbox: Bbox,
) {
  const annotated = annotateBicycleRouteMembership(payload);
  const withoutRelations = dropRelationElements(annotated);
  const deadendWayIds = detectDeadendWayIds(withoutRelations, tileBbox, queryBbox);
  return overpassToGeoJson(withoutRelations, tileBbox, deadendWayIds);
}
