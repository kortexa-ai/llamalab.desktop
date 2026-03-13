// Hierarchical graph layout — ported from mirabile, no changes needed (pure algorithm)

import type { Edge, Node } from "@xyflow/react";

const PROGRAM_W = 260;
const PROGRAM_H = 150;
const LAYER_GAP = 60;
const NODE_GAP = 100;

// Edge types that define hierarchy (parent -> child)
const HIERARCHY_TYPES = new Set([
	"base_model", "enables", "provides_vision", "feeds_into", "contains",
]);

/**
 * Custom hierarchical layout:
 * 1. Top-down longest-path layering from hierarchy edges
 * 2. Barycenter ordering to minimize edge crossings
 * 3. Single-node layers centered above their children
 */
export function getLayoutedElements(
	nodes: Node[],
	edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
	if (nodes.length === 0) return { nodes, edges };

	const programNodes = nodes.filter(n => n.type === "program" || n.type === "workspace");
	const programNodeIds = new Set(programNodes.map(n => n.id));

	// Build adjacency for hierarchy edges only
	const children = new Map<string, string[]>();
	const inDegree = new Map<string, number>();
	for (const n of programNodes) {
		children.set(n.id, []);
		inDegree.set(n.id, 0);
	}

	for (const e of edges) {
		if (!programNodeIds.has(e.source) || !programNodeIds.has(e.target)) continue;
		const edgeType = (e.data as Record<string, unknown>)?.type as string | undefined;
		if (!edgeType || !HIERARCHY_TYPES.has(edgeType)) continue;
		children.get(e.source)!.push(e.target);
		inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
	}

	// Assign layers top-down
	const layerOf = new Map<string, number>();
	const roots = programNodes.filter(n => (inDegree.get(n.id) || 0) === 0);

	const queue = [...roots.map(n => n.id)];
	for (const r of queue) layerOf.set(r, 0);

	while (queue.length > 0) {
		const nodeId = queue.shift()!;
		const parentLayer = layerOf.get(nodeId)!;
		for (const childId of children.get(nodeId) || []) {
			const prevLayer = layerOf.get(childId) ?? -1;
			const newLayer = parentLayer + 1;
			if (newLayer > prevLayer) {
				layerOf.set(childId, newLayer);
				queue.push(childId);
			}
		}
	}

	// Handle disconnected nodes
	for (const n of programNodes) {
		if (!layerOf.has(n.id)) layerOf.set(n.id, 0);
	}

	// Group by layer
	const layers: string[][] = [];
	for (const [id, layer] of layerOf) {
		while (layers.length <= layer) layers.push([]);
		layers[layer].push(id);
	}

	// Reverse adjacency for crossing minimization
	const parents = new Map<string, string[]>();
	for (const n of programNodes) parents.set(n.id, []);
	for (const [parentId, kids] of children) {
		for (const childId of kids) {
			parents.get(childId)!.push(parentId);
		}
	}

	// Position nodes with barycenter ordering
	const positionMap = new Map<string, { x: number; y: number }>();
	const programCenterX = new Map<string, number>();

	for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
		const layer = layers[layerIdx];

		if (layerIdx > 0) {
			layer.sort((a, b) => {
				const aParents = parents.get(a) || [];
				const bParents = parents.get(b) || [];
				const aAvg = aParents.length > 0
					? aParents.reduce((sum, p) => sum + (programCenterX.get(p) || 0), 0) / aParents.length
					: 0;
				const bAvg = bParents.length > 0
					? bParents.reduce((sum, p) => sum + (programCenterX.get(p) || 0), 0) / bParents.length
					: 0;
				return aAvg - bAvg;
			});
		}

		const totalWidth = layer.length * PROGRAM_W + (layer.length - 1) * NODE_GAP;
		const maxWidth = Math.max(totalWidth, ...layers.map(l =>
			l.length * PROGRAM_W + (l.length - 1) * NODE_GAP
		));

		const y = layerIdx * (PROGRAM_H + LAYER_GAP);
		let x = (maxWidth - totalWidth) / 2;

		for (const programId of layer) {
			positionMap.set(programId, { x, y });
			programCenterX.set(programId, x + PROGRAM_W / 2);
			x += PROGRAM_W + NODE_GAP;
		}
	}

	// Center single-node layers above children
	for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
		const layer = layers[layerIdx];
		if (layer.length !== 1) continue;

		const nodeId = layer[0];
		const nextLayer = layerIdx + 1;
		const kids = (children.get(nodeId) || []).filter(id => layerOf.get(id) === nextLayer);
		if (kids.length === 0) continue;

		const currentCenter = programCenterX.get(nodeId)!;
		const childAvgCenter = kids.reduce((sum, k) => sum + (programCenterX.get(k) || 0), 0) / kids.length;
		const shift = childAvgCenter - currentCenter;

		if (Math.abs(shift) < 5) continue;

		const programPos = positionMap.get(nodeId);
		if (programPos) {
			programPos.x += shift;
			programCenterX.set(nodeId, currentCenter + shift);
		}
	}

	const layoutedNodes = nodes.map(node => {
		const pos = positionMap.get(node.id);
		if (!pos) return node;
		return { ...node, position: pos };
	});

	return { nodes: layoutedNodes, edges };
}
