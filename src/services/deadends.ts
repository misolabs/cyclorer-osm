import type { Bbox } from '../utils/mercator';
import type { OverpassNodeElement, OverpassResponse, OverpassWayElement } from './overpass';

type EndpointInfo = {
  startNodeId: number;
  endNodeId: number;
  startNode?: OverpassNodeElement;
  endNode?: OverpassNodeElement;
};

function isWayElement(element: OverpassResponse['elements'][number]): element is OverpassWayElement {
  return element.type === 'way' && Array.isArray((element as OverpassWayElement).nodes);
}

function isNodeElement(element: OverpassResponse['elements'][number]): element is OverpassNodeElement {
  return element.type === 'node'
    && typeof (element as OverpassNodeElement).id === 'number'
    && typeof (element as OverpassNodeElement).lat === 'number'
    && typeof (element as OverpassNodeElement).lon === 'number';
}

function isInsideBbox(node: OverpassNodeElement, bbox: Bbox): boolean {
  return node.lon >= bbox.west
    && node.lon <= bbox.east
    && node.lat >= bbox.south
    && node.lat <= bbox.north;
}

function isForbiddenWay(way: OverpassWayElement): boolean {
  return way.tags?.access === 'no';
}

function getEndpointInfo(way: OverpassWayElement, nodesById: Map<number, OverpassNodeElement>): EndpointInfo | null {
  if (way.nodes.length < 2) {
    return null;
  }

  const startNodeId = way.nodes[0];
  const endNodeId = way.nodes[way.nodes.length - 1];

  if (startNodeId === endNodeId) {
    return null;
  }

  return {
    startNodeId,
    endNodeId,
    startNode: nodesById.get(startNodeId),
    endNode: nodesById.get(endNodeId),
  };
}

function endpointIsTerminal(
  nodeId: number,
  selfWayId: number,
  waysByNodeId: Map<number, Map<number, 'endpoint' | 'inner'>>,
  forbiddenWayIds: Set<number>,
  deadendWayIds: Set<number>,
): boolean {
  const connectedWays = waysByNodeId.get(nodeId);
  if (!connectedWays || connectedWays.size === 0) {
    return true;
  }

  for (const [connectedWayId, role] of connectedWays) {
    if (connectedWayId === selfWayId) {
      continue;
    }

    // Endpoint touching the interior of another non-forbidden way is a junction,
    // even if that other way is later classified as dead-end.
    if (role === 'inner' && !forbiddenWayIds.has(connectedWayId)) {
      return false;
    }

    if (!forbiddenWayIds.has(connectedWayId) && !deadendWayIds.has(connectedWayId)) {
      return false;
    }
  }

  return true;
}

function isTileRelevantDeadend(
  endpointInfo: EndpointInfo,
  tileBbox: Bbox,
  queryBbox: Bbox,
): boolean {
  if (!endpointInfo.startNode || !endpointInfo.endNode) {
    return false;
  }

  const startInQuery = isInsideBbox(endpointInfo.startNode, queryBbox);
  const endInQuery = isInsideBbox(endpointInfo.endNode, queryBbox);

  if (!startInQuery || !endInQuery) {
    return false;
  }

  const startInTile = isInsideBbox(endpointInfo.startNode, tileBbox);
  const endInTile = isInsideBbox(endpointInfo.endNode, tileBbox);

  // Keep dead-ends that touch the core tile at either endpoint, including fully in-tile ways.
  return startInTile || endInTile;
}

export function detectDeadendWayIds(payload: OverpassResponse, tileBbox: Bbox, queryBbox: Bbox): Set<number> {
  const nodesById = new Map<number, OverpassNodeElement>();
  const waysById = new Map<number, OverpassWayElement>();
  const waysByNodeId = new Map<number, Map<number, 'endpoint' | 'inner'>>();

  for (const element of payload.elements) {
    if (isNodeElement(element)) {
      nodesById.set(element.id, element);
      continue;
    }

    if (!isWayElement(element)) {
      continue;
    }

    waysById.set(element.id, element);

    const lastIndex = element.nodes.length - 1;
    for (const [index, nodeId] of element.nodes.entries()) {
      const role: 'endpoint' | 'inner' = index === 0 || index === lastIndex ? 'endpoint' : 'inner';
      const wayRoles = waysByNodeId.get(nodeId) ?? new Map<number, 'endpoint' | 'inner'>();
      const previousRole = wayRoles.get(element.id);

      // If a node appears multiple times on a way, preserve inner classification.
      if (previousRole !== 'inner') {
        wayRoles.set(element.id, role);
      }

      waysByNodeId.set(nodeId, wayRoles);
    }
  }

  const endpointInfoByWayId = new Map<number, EndpointInfo>();
  const forbiddenWayIds = new Set<number>();

  for (const way of waysById.values()) {
    const endpointInfo = getEndpointInfo(way, nodesById);
    if (endpointInfo) {
      endpointInfoByWayId.set(way.id, endpointInfo);
    }

    if (isForbiddenWay(way)) {
      forbiddenWayIds.add(way.id);
    }
  }

  const deadendWayIds = new Set<number>();
  let changed = true;

  while (changed) {
    changed = false;

    for (const [wayId, endpointInfo] of endpointInfoByWayId) {
      if (forbiddenWayIds.has(wayId) || deadendWayIds.has(wayId)) {
        continue;
      }

      const startTerminal = endpointIsTerminal(
        endpointInfo.startNodeId,
        wayId,
        waysByNodeId,
        forbiddenWayIds,
        deadendWayIds,
      );
      const endTerminal = endpointIsTerminal(
        endpointInfo.endNodeId,
        wayId,
        waysByNodeId,
        forbiddenWayIds,
        deadendWayIds,
      );

      if (!startTerminal && !endTerminal) {
        continue;
      }

      deadendWayIds.add(wayId);
      changed = true;
    }
  }

  const relevantDeadendWayIds = new Set<number>();

  for (const wayId of deadendWayIds) {
    const endpointInfo = endpointInfoByWayId.get(wayId);
    if (!endpointInfo) {
      continue;
    }

    if (isTileRelevantDeadend(endpointInfo, tileBbox, queryBbox)) {
      relevantDeadendWayIds.add(wayId);
    }
  }

  return relevantDeadendWayIds;
}
