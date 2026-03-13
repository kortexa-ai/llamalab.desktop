import { useCallback, useEffect, useRef, useState } from "react";
import {
	Background,
	BackgroundVariant,
	Controls,
	type Edge,
	type Node,
	ReactFlow,
	ReactFlowProvider,
	useEdgesState,
	useNodesState,
	useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { rpcRequest } from "../rpc";
import { getLayoutedElements } from "../utils/layout";
import { nodeTypes } from "./nodes/ResearchNodes";
import { useWorkspace } from "../hooks/useWorkspace";

// Edge colors by relationship type — warm palette, no purple
const EDGE_COLORS: Record<string, string> = {
	contains: "#C2410C",         // accent (workspace -> program)
	base_model: "#0891B2",       // cyan
	uses_base_model: "#0891B2",  // cyan
	enables: "#059669",          // emerald
	provides_vision: "#0284C7",  // sky
	receives_vision: "#0284C7",  // sky
	extends: "#D97706",          // amber
	feeds_into: "#C2410C",       // accent
	composition: "#BE185D",      // pink
	can_be_conditioned_by: "#78716C", // stone
};

const LABEL_TYPES = new Set(["base_model", "enables", "feeds_into"]);
const PRIMARY_TYPES = new Set(["base_model", "enables", "feeds_into", "provides_vision", "contains"]);

function styleEdges(edges: Edge[]): Edge[] {
	return edges.map(edge => {
		const edgeType = (edge.data as Record<string, unknown>)?.type as string | undefined;
		const color = (edgeType && EDGE_COLORS[edgeType]) || "#A8A29E";
		const isPrimary = !edgeType || PRIMARY_TYPES.has(edgeType);
		const isSecondary = !isPrimary;
		const showLabel = edgeType ? LABEL_TYPES.has(edgeType) : true;
		return {
			...edge,
			type: "smoothstep",
			label: showLabel ? edge.label : undefined,
			style: {
				stroke: color,
				strokeWidth: isSecondary ? 1 : 1.5,
				strokeDasharray: isSecondary ? "4 4" : undefined,
				opacity: isSecondary ? 0.5 : 1,
			},
			animated: false,
		};
	});
}

function GraphInner() {
	const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
	const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { setCenter } = useReactFlow();
	const { openProgram, state } = useWorkspace();
	const containerRef = useRef<HTMLDivElement>(null);

	const loadGraph = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await rpcRequest.getGraph({});
			const newNodes = data.nodes as Node[];
			const newEdges = data.edges as Edge[];
			const { nodes: layoutedNodes } = getLayoutedElements(newNodes, newEdges);
			setNodes(layoutedNodes);
			setEdges(styleEdges(newEdges));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load graph");
		} finally {
			setLoading(false);
		}
	}, [setNodes, setEdges]);

	useEffect(() => {
		loadGraph();
	}, [loadGraph]);

	// Reload when programs change
	useEffect(() => {
		const handler = () => loadGraph();
		window.addEventListener("programsChanged", handler);
		return () => window.removeEventListener("programsChanged", handler);
	}, [loadGraph]);

	// Click a node -> open its program tab
	const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
		const programId = (node.data as Record<string, unknown>)?.programId as string | undefined;
		if (programId) {
			const program = state.programs.find(p => p.id === programId);
			if (program) openProgram(program);
		}
		setCenter(node.position.x + 130, node.position.y + 75, { zoom: 1.2, duration: 400 });
	}, [setCenter, openProgram, state.programs]);

	return (
		<div ref={containerRef} className="w-full h-full relative">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onNodeClick={handleNodeClick}
				nodeTypes={nodeTypes}
				fitView
				fitViewOptions={{ padding: 0.3 }}
				defaultEdgeOptions={{
					type: "smoothstep",
					animated: false,
					style: { stroke: "#A8A29E", strokeWidth: 1.5 },
				}}
				proOptions={{ hideAttribution: true }}
			>
				<Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#D4D1CC" />
				<Controls showInteractive={false} />
			</ReactFlow>

			{/* Refresh button */}
			<button
				onClick={loadGraph}
				disabled={loading}
				className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-white border border-border rounded text-xs text-stone-600 hover:bg-surface-raised transition-colors"
			>
				<ArrowsClockwise size={12} className={loading ? "animate-spin" : ""} />
				Refresh
			</button>

			{error && (
				<div className="absolute top-3 left-3 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
					{error}
				</div>
			)}
		</div>
	);
}

export function GraphView() {
	return (
		<ReactFlowProvider>
			<GraphInner />
		</ReactFlowProvider>
	);
}
