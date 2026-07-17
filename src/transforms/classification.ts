import type { OverpassResponse, OverpassTags, OverpassWayElement } from '../services/overpass';

export type FacycleClassification =
  | 'designated'
  | 'low_risk'
  | 'acceptable'
  | 'adult_only'
  | 'not_suitable';

const OFFROAD_HIGHWAYS = new Set(['path', 'track', 'footway', 'bridleway']);
const GOOD_SURFACES = new Set([
  'asphalt',
  'paved',
  'concrete',
  'concrete:lanes',
  'concrete:plates',
  'sett',
  'paving_stones',
]);
const ACCEPTABLE_SURFACES = new Set([
  'compacted',
  'fine_gravel',
  'gravel',
  'wood',
  'boardwalk',
]);
const ROUGH_SURFACES = new Set([
  'sand',
  'mud',
  'earth',
  'ground',
  'dirt',
  'grass',
]);

function tagValue(tags: OverpassTags | undefined, key: string): string | null {
  if (!tags) {
    return null;
  }

  const value = tags[key];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function tagValueLower(tags: OverpassTags | undefined, key: string): string | null {
  const value = tagValue(tags, key);
  return value ? value.toLowerCase() : null;
}

function parseNumberTag(tags: OverpassTags | undefined, key: string): number | null {
  const value = tagValue(tags, key);
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasAnyValue(tags: OverpassTags | undefined, keys: string[], values: Set<string>): boolean {
  for (const key of keys) {
    const value = tagValueLower(tags, key);
    if (value && values.has(value)) {
      return true;
    }
  }
  return false;
}

function highway(tags: OverpassTags | undefined): string | null {
  return tagValueLower(tags, 'highway');
}

function bicycleAccess(tags: OverpassTags | undefined): string | null {
  return tagValueLower(tags, 'bicycle');
}

function hasExplicitBikeAccess(tags: OverpassTags | undefined): boolean {
  return bicycleAccess(tags) === 'yes' || bicycleAccess(tags) === 'designated';
}

function hasGoodSurface(tags: OverpassTags | undefined): boolean {
  const value = tagValueLower(tags, 'surface');
  return value !== null && GOOD_SURFACES.has(value);
}

function hasAcceptableSurface(tags: OverpassTags | undefined): boolean {
  const value = tagValueLower(tags, 'surface');
  return value !== null && (GOOD_SURFACES.has(value) || ACCEPTABLE_SURFACES.has(value));
}

function hasRoughSurface(tags: OverpassTags | undefined): boolean {
  const value = tagValueLower(tags, 'surface');
  return value !== null && ROUGH_SURFACES.has(value);
}

function smoothnessScore(tags: OverpassTags | undefined): number | null {
  const value = tagValueLower(tags, 'smoothness');
  if (!value) {
    return null;
  }

  switch (value) {
    case 'excellent':
      return 0;
    case 'good':
      return 1;
    case 'intermediate':
      return 2;
    case 'bad':
      return 3;
    case 'very_bad':
      return 4;
    case 'horrible':
      return 5;
    case 'very_horrible':
      return 6;
    default:
      return null;
  }
}

function trackTypeGrade(tags: OverpassTags | undefined): number | null {
  const value = tagValueLower(tags, 'tracktype');
  if (!value || !value.startsWith('grade')) {
    return null;
  }

  const parsed = Number.parseInt(value.slice('grade'.length), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function mtbScale(tags: OverpassTags | undefined): number | null {
  return parseNumberTag(tags, 'mtb:scale');
}

function isNotSuitable(tags: OverpassTags | undefined): boolean {
  if (!tags) {
    return false;
  }

  if (bicycleAccess(tags) === 'no') {
    return true;
  }

  if (tagValueLower(tags, 'access') === 'no' && !hasExplicitBikeAccess(tags)) {
    return true;
  }

  if (tagValueLower(tags, 'access') === 'private') {
    return true;
  }

  const highwayTag = highway(tags);
  if (highwayTag === 'motorway' || highwayTag === 'motorway_link') {
    return true;
  }

  if (highwayTag === 'steps') {
    return true;
  }

  if (highwayTag === 'construction' || tagValueLower(tags, 'construction') === 'yes') {
    return true;
  }

  const maxspeed = parseNumberTag(tags, 'maxspeed');
  if (maxspeed !== null && maxspeed > 90) {
    return true;
  }

  if (highwayTag === 'footway' && !hasExplicitBikeAccess(tags)) {
    return true;
  }

  const trackGrade = trackTypeGrade(tags);
  if (trackGrade !== null && trackGrade >= 4) {
    return true;
  }

  const mtb = mtbScale(tags);
  if (mtb !== null && mtb >= 3) {
    return true;
  }

  const smooth = smoothnessScore(tags);
  if (smooth !== null && smooth >= 3) {
    return true;
  }

  if (hasRoughSurface(tags) && smooth === null) {
    return true;
  }

  return false;
}

function isDesignated(tags: OverpassTags | undefined): boolean {
  if (!tags) {
    return false;
  }

  const highwayTag = highway(tags);
  if (highwayTag === 'cycleway') {
    return true;
  }

  if (hasAnyValue(tags, ['cycleway', 'cycleway:left', 'cycleway:right', 'cycleway:both'], new Set(['track', 'separate']))) {
    return true;
  }

  if (bicycleAccess(tags) === 'designated' && highwayTag !== 'footway') {
    return true;
  }

  return false;
}

function classifyOffroad(tags: OverpassTags | undefined): FacycleClassification | null {
  const highwayTag = highway(tags);
  if (!highwayTag || !OFFROAD_HIGHWAYS.has(highwayTag)) {
    return null;
  }

  const hasBikeAccess = hasExplicitBikeAccess(tags);
  const trackGrade = trackTypeGrade(tags);
  const mtb = mtbScale(tags);
  const smooth = smoothnessScore(tags);
  const goodSurface = hasGoodSurface(tags);
  const acceptableSurface = hasAcceptableSurface(tags);

  if (highwayTag === 'footway') {
    if (!hasBikeAccess) {
      return 'not_suitable';
    }

    if (goodSurface && (smooth === null || smooth <= 1) && (mtb === null || mtb <= 1)) {
      return 'acceptable';
    }

    return 'adult_only';
  }

  if (highwayTag === 'track') {
    if (trackGrade !== null) {
      if (trackGrade <= 1 && goodSurface && (smooth === null || smooth <= 1) && (mtb === null || mtb <= 1)) {
        return 'low_risk';
      }

      if (trackGrade === 2 && acceptableSurface && (smooth === null || smooth <= 2) && (mtb === null || mtb <= 1)) {
        return 'acceptable';
      }

      if (trackGrade === 3) {
        return 'adult_only';
      }
    }

    if (goodSurface && (smooth === null || smooth <= 1) && (mtb === null || mtb <= 1)) {
      return 'low_risk';
    }

    if (acceptableSurface && (smooth === null || smooth <= 2) && (mtb === null || mtb <= 2)) {
      return 'acceptable';
    }

    return 'adult_only';
  }

  if (highwayTag === 'path' || highwayTag === 'bridleway') {
    if (trackGrade !== null && trackGrade >= 4) {
      return 'not_suitable';
    }

    if (hasBikeAccess && goodSurface && (smooth === null || smooth <= 1) && (mtb === null || mtb <= 1)) {
      return 'low_risk';
    }

    if (hasBikeAccess && acceptableSurface && (smooth === null || smooth <= 2) && (mtb === null || mtb <= 2)) {
      return 'acceptable';
    }

    if (goodSurface && (smooth === null || smooth <= 2) && (mtb === null || mtb <= 2)) {
      return 'adult_only';
    }

    if (acceptableSurface && (smooth === null || smooth <= 2)) {
      return 'adult_only';
    }

    if (hasRoughSurface(tags)) {
      return 'not_suitable';
    }

    return 'adult_only';
  }

  return null;
}

function isLowRisk(tags: OverpassTags | undefined): boolean {
  if (!tags) {
    return false;
  }

  const highwayTag = highway(tags);
  if (highwayTag === 'living_street') {
    return true;
  }

  if (highwayTag === 'residential' || highwayTag === 'service') {
    const maxspeed = parseNumberTag(tags, 'maxspeed');
    if (maxspeed !== null && maxspeed <= 30) {
      return true;
    }

    if (tagValueLower(tags, 'lit') === 'yes' && tagValueLower(tags, 'sidewalk') === 'both') {
      return true;
    }
  }

  if (highwayTag === 'unclassified') {
    const maxspeed = parseNumberTag(tags, 'maxspeed');
    if (maxspeed !== null && maxspeed <= 30) {
      return true;
    }
  }

  return false;
}

function isAcceptable(tags: OverpassTags | undefined): boolean {
  if (!tags) {
    return false;
  }

  const highwayTag = highway(tags);
  const maxspeed = parseNumberTag(tags, 'maxspeed');

  if (highwayTag === 'residential' || highwayTag === 'service' || highwayTag === 'unclassified') {
    return true;
  }

  if (highwayTag === 'tertiary' || highwayTag === 'tertiary_link') {
    return maxspeed === null || maxspeed <= 50;
  }

  if (highwayTag === 'secondary' || highwayTag === 'secondary_link') {
    return maxspeed !== null && maxspeed <= 50;
  }

  return false;
}

function isAdultOnly(tags: OverpassTags | undefined): boolean {
  if (!tags) {
    return false;
  }

  const highwayTag = highway(tags);
  const maxspeed = parseNumberTag(tags, 'maxspeed');

  if (highwayTag === 'primary' || highwayTag === 'primary_link') {
    return true;
  }

  if (highwayTag === 'secondary' || highwayTag === 'secondary_link') {
    return maxspeed === null || maxspeed > 50;
  }

  if (highwayTag === 'tertiary' || highwayTag === 'tertiary_link') {
    return maxspeed !== null && maxspeed > 50;
  }

  return false;
}

function classifyWay(tags: OverpassTags | undefined): FacycleClassification {
  if (isNotSuitable(tags)) {
    return 'not_suitable';
  }

  if (isDesignated(tags)) {
    return 'designated';
  }

  const offroadClassification = classifyOffroad(tags);
  if (offroadClassification) {
    return offroadClassification;
  }

  if (isLowRisk(tags)) {
    return 'low_risk';
  }

  if (isAcceptable(tags)) {
    return 'acceptable';
  }

  if (isAdultOnly(tags)) {
    return 'adult_only';
  }

  return 'adult_only';
}

export function annotateFacycleClassification(payload: OverpassResponse): OverpassResponse {
  for (const element of payload.elements) {
    if (element.type !== 'way') {
      continue;
    }

    const way = element as OverpassWayElement;
    way.tags = {
      ...(way.tags ?? {}),
      'facycle:classification': classifyWay(way.tags),
    };
  }

  return payload;
}
