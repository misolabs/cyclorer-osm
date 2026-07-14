import type { OverpassElement, OverpassResponse, OverpassRelationElement, OverpassTagValue, OverpassTags, OverpassWayElement } from '../services/overpass';

function isWayElement(element: OverpassElement): element is OverpassWayElement {
  return element.type === 'way' && Array.isArray((element as OverpassWayElement).nodes);
}

function isRelationElement(element: OverpassElement): element is OverpassRelationElement {
  return element.type === 'relation' && Array.isArray((element as OverpassRelationElement).members);
}

function asTagString(value: OverpassTagValue | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getBicycleRouteRelationName(tags: OverpassTags | undefined): string {
  const candidates = [
    asTagString(tags?.name),
    asTagString(tags?.ref),
    asTagString(tags?.['name:en']),
    asTagString(tags?.['name:local']),
    asTagString(tags?.operator),
    asTagString(tags?.description),
    asTagString(tags?.network),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return 'PC unknown';
}

export function annotateBicycleRouteMembership(payload: OverpassResponse): OverpassResponse {
  const waysById = new Map<number, OverpassWayElement>();
  const routeNamesByWayId = new Map<number, Set<string>>();

  for (const element of payload.elements) {
    if (isWayElement(element)) {
      waysById.set(element.id, element);
      continue;
    }

    if (!isRelationElement(element)) {
      continue;
    }

    if (element.tags?.route !== 'bicycle') {
      continue;
    }

    const routeName = getBicycleRouteRelationName(element.tags);
    for (const member of element.members) {
      if (member.type !== 'way') {
        continue;
      }

      const routeNames = routeNamesByWayId.get(member.ref) ?? new Set<string>();
      routeNames.add(routeName);
      routeNamesByWayId.set(member.ref, routeNames);
    }
  }

  for (const [wayId, routeNames] of routeNamesByWayId) {
    const way = waysById.get(wayId);
    if (!way) {
      continue;
    }

    way.tags = {
      ...(way.tags ?? {}),
      'facycle:routes': Array.from(routeNames),
    };
  }

  return payload;
}

export function dropRelationElements(payload: OverpassResponse): OverpassResponse {
  return {
    ...payload,
    elements: payload.elements.filter((element) => element.type !== 'relation'),
  };
}
