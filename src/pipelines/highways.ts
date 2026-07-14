import type { Bbox } from '../utils/mercator';
import { detectDeadendWayIds } from '../transforms/deadends';
import { annotateFacycleClassification } from '../transforms/classification';
import { annotateBicycleRouteMembership, dropRelationElements } from '../transforms/overpass';
import { overpassToGeoJson } from '../services/geojson';
import type { OverpassResponse } from '../services/overpass';

export function buildHighwaysFeatureCollection(
  payload: OverpassResponse,
  tileBbox: Bbox,
  queryBbox: Bbox,
) {
  const annotated = annotateBicycleRouteMembership(payload);
  const classified = annotateFacycleClassification(annotated);
  const withoutRelations = dropRelationElements(classified);
  const deadendWayIds = detectDeadendWayIds(withoutRelations, tileBbox, queryBbox);
  return overpassToGeoJson(withoutRelations, tileBbox, deadendWayIds);
}
