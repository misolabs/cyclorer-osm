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
  waysByNodeId: Map<number, Set<number>>,
  forbiddenWayIds: Set<number>,
  deadendWayIds: Set<number>,
): boolean {
  const connectedWayIds = waysByNodeId.get(nodeId);
  if (!connectedWayIds || connectedWayIds.size === 0) {
    return true;
  }

  for (const connectedWayId of connectedWayIds) {
    if (connectedWayId === selfWayId) {
      continue;
    }

    if (!forbiddenWayIds.has(connectedWayId) && !deadendWayIds.has(connectedWayId)) {
      return false;
    }
  }

  return true;
}

function isBoundaryCrossingDeadend(
  endpointInfo: EndpointInfo,
  tileBbox: Bbox,
  queryBbox: Bbox,
): boolean {
  if (!endpointInfo.startNode || !endpointInfo.endNode) {
    return false;
  }

  const startInTile = isInsideBbox(endpointInfo.startNode, tileBbox);
  const endInTile = isInsideBbox(endpointInfo.endNode, tileBbox);

  if (!startInTile && !endInTile) {
    return false;
  }

  return isInsideBbox(endpointInfo.startNode, queryBbox) && isInsideBbox(endpointInfo.endNode, queryBbox);
}

export function detectDeadendWayIds(payload: OverpassResponse, tileBbox: Bbox, queryBbox: Bbox): Set<number> {
  const nodesById = new Map<number, OverpassNodeElement>();
  const waysById = new Map<number, OverpassWayElement>();
  const waysByNodeId = new Map<number, Set<number>>();

  for (const element of payload.elements) {
    if (isNodeElement(element)) {
      nodesById.set(element.id, element);
      continue;
    }

    if (!isWayElement(element)) {
      continue;
    }

    waysById.set(element.id, element);

    for (const nodeId of element.nodes) {
      const wayIds = waysByNodeId.get(nodeId) ?? new Set<number>();
      wayIds.add(element.id);
      waysByNodeId.set(nodeId, wayIds);
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

  const boundaryDeadendWayIds = new Set<number>();

  for (const wayId of deadendWayIds) {
    const endpointInfo = endpointInfoByWayId.get(wayId);
    if (!endpointInfo) {
      continue;
    }

    if (isBoundaryCrossingDeadend(endpointInfo, tileBbox, queryBbox)) {
      boundaryDeadendWayIds.add(wayId);
    }
  }

  return boundaryDeadendWayIds;
}

