import type { OverpassResponse, OverpassTags, OverpassWayElement } from '../services/overpass';

export type FacycleClassification =
  | 'designated'
  | 'low_risk'
  | 'acceptable'
  | 'adult_only'
  | 'not_suitable';

function asTagString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asTagNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasAnyValue(tags: OverpassTags | undefined, keys: string[], values: Set<string>): boolean {
  if (!tags) {
    return false;
  }

  for (const key of keys) {
    const value = tags[key];
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = value.trim().toLowerCase();
    if (values.has(normalized)) {
      return true;
    }
  }

  return false;
}

function hasCyclewayTrackLike(tags: OverpassTags | undefined): boolean {
  if (!tags) {
    return false;
  }

  const values = new Set(['track', 'separate']);
  return (
    hasAnyValue(tags, ['cycleway', 'cycleway:left', 'cycleway:right', 'cycleway:both'], values)
    || hasAnyValue(tags, ['cycleway:left:oneway', 'cycleway:right:oneway'], values)
  );
}

function isDesignated(tags: OverpassTags | undefined): boolean {
  if (!tags) {
    return false;
  }

  if (tags.highway === 'cycleway') {
    return true;
  }

  if (tags.bicycle === 'designated') {
    return true;
  }

  return hasCyclewayTrackLike(tags);
}

function isNotSuitable(tags: OverpassTags | undefined): boolean {
  if (!tags) {
    return false;
  }

  if (tags.bicycle === 'no') {
    return true;
  }

  if (tags.access === 'no' && tags.bicycle !== 'yes' && tags.bicycle !== 'designated') {
    return true;
  }

  if (tags.access === 'private') {
    return true;
  }

  if (tags.highway === 'motorway' || tags.highway === 'motorway_link') {
    return true;
  }

  if (tags.highway === 'steps') {
    return true;
  }

  if (tags.construction === 'yes' || tags.highway === 'construction') {
    return true;
  }

  const maxspeed = asTagNumber(tags.maxspeed);
  if (maxspeed !== null && maxspeed > 90) {
    return true;
  }

  return false;
}

function isLowRisk(tags: OverpassTags | undefined): boolean {
  if (!tags) {
    return false;
  }

  if (tags.highway === 'living_street') {
    return true;
  }

  if (tags.highway === 'residential' || tags.highway === 'service') {
    const maxspeed = asTagNumber(tags.maxspeed);
    if (maxspeed !== null && maxspeed <= 30) {
      return true;
    }

    if (tags.lit === 'yes' && tags.surface && tags.sidewalk === 'both') {
      return true;
    }
  }

  if (tags.highway === 'unclassified') {
    const maxspeed = asTagNumber(tags.maxspeed);
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

  const highway = tags.highway;
  const maxspeed = asTagNumber(tags.maxspeed);

  if (highway === 'residential' || highway === 'service' || highway === 'unclassified') {
    return true;
  }

  if (highway === 'tertiary' || highway === 'tertiary_link') {
    return maxspeed === null || maxspeed <= 50;
  }

  if (highway === 'secondary' || highway === 'secondary_link') {
    return maxspeed !== null && maxspeed <= 40;
  }

  return false;
}

function isAdultOnly(tags: OverpassTags | undefined): boolean {
  if (!tags) {
    return false;
  }

  const highway = tags.highway;
  const maxspeed = asTagNumber(tags.maxspeed);

  if (highway === 'primary' || highway === 'primary_link') {
    return true;
  }

  if (highway === 'secondary' || highway === 'secondary_link') {
    return maxspeed === null || maxspeed > 40;
  }

  if (highway === 'tertiary' || highway === 'tertiary_link') {
    return maxspeed !== null && maxspeed > 50;
  }

  if (maxspeed !== null && maxspeed > 50) {
    return true;
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
