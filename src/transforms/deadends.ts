import type { Bbox } from '../utils/mercator';
import type { OverpassNodeElement, OverpassResponse, OverpassWayElement } from '../services/overpass';

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
  return (way.tags?.access === 'no' && way.tags?.bicycle !== 'yes')
      || way.tags?.access === 'private'
      || way.tags?.bicycle === 'no';
}

function nodeConnectsToActiveNetwork(
  nodeId: number,
  selfWayId: number,
  waysByNodeId: Map<number, Set<number>>,
  forbiddenWayIds: Set<number>,
  deadendWayIds: Set<number>,
): boolean {
  const connectedWays = waysByNodeId.get(nodeId);
  if (!connectedWays || connectedWays.size === 0) {
    return false;
  }

  for (const connectedWayId of connectedWays) {
    if (connectedWayId === selfWayId) {
      continue;
    }

    if (!forbiddenWayIds.has(connectedWayId) && !deadendWayIds.has(connectedWayId)) {
      return true;
    }
  }

  return false;
}

function isTileRelevantDeadend(
  nodeIds: Set<number>,
  nodesById: Map<number, OverpassNodeElement>,
  tileBbox: Bbox,
  queryBbox: Bbox,
): boolean {
  let touchesTile = false;
  let touchesQuery = false;

  for (const nodeId of nodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }

    if (isInsideBbox(node, tileBbox)) {
      touchesTile = true;
    }

    if (isInsideBbox(node, queryBbox)) {
      touchesQuery = true;
    }

    if (touchesTile && touchesQuery) {
      return true;
    }
  }

  return false;
}

export function detectDeadendWayIds(payload: OverpassResponse, tileBbox: Bbox, queryBbox: Bbox): Set<number> {
  const nodesById = new Map<number, OverpassNodeElement>();
  const waysById = new Map<number, OverpassWayElement>();
  const waysByNodeId = new Map<number, Set<number>>();
  const nodeIdsByWayId = new Map<number, Set<number>>();

  for (const element of payload.elements) {
    if (isNodeElement(element)) {
      nodesById.set(element.id, element);
      continue;
    }

    if (!isWayElement(element)) {
      continue;
    }

    waysById.set(element.id, element);

    // Treat every node on a way as a potential junction point.
    const uniqueNodeIds = new Set(element.nodes);
    nodeIdsByWayId.set(element.id, uniqueNodeIds);

    for (const nodeId of uniqueNodeIds) {
      const connectedWays = waysByNodeId.get(nodeId) ?? new Set<number>();
      connectedWays.add(element.id);
      waysByNodeId.set(nodeId, connectedWays);
    }
  }

  const forbiddenWayIds = new Set<number>();

  for (const way of waysById.values()) {
    if (isForbiddenWay(way)) {
      forbiddenWayIds.add(way.id);
    }
  }

  const deadendWayIds = new Set<number>();
  let changed = true;

  while (changed) {
    changed = false;

    for (const [wayId, nodeIds] of nodeIdsByWayId) {
      if (forbiddenWayIds.has(wayId) || deadendWayIds.has(wayId)) {
        continue;
      }

      let connectedNodeCount = 0;
      for (const nodeId of nodeIds) {
        if (!nodeConnectsToActiveNetwork(nodeId, wayId, waysByNodeId, forbiddenWayIds, deadendWayIds)) {
          continue;
        }

        connectedNodeCount += 1;
        if (connectedNodeCount > 1) {
          break;
        }
      }

      // Iterative pruning rule: a way is a dead-end when it has at most one
      // node connected to the remaining non-forbidden, non-dead-end network.
      if (connectedNodeCount > 1) {
        continue;
      }

      deadendWayIds.add(wayId);
      changed = true;
    }
  }

  const relevantDeadendWayIds = new Set<number>();

  for (const wayId of deadendWayIds) {
    const nodeIds = nodeIdsByWayId.get(wayId);
    if (!nodeIds || nodeIds.size === 0) {
      continue;
    }

    if (isTileRelevantDeadend(nodeIds, nodesById, tileBbox, queryBbox)) {
      relevantDeadendWayIds.add(wayId);
    }
  }

  return relevantDeadendWayIds;
}
