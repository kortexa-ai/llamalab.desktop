// Graph node renderers — ported from mirabile, restyled to warm palette with Phosphor icons

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
	Microscope,
	CheckCircle,
	BookOpen,
	Flask,
	Archive,
	Buildings,
	Circle,
} from "@phosphor-icons/react";
import type { Node } from "@xyflow/react";

type ResearchNodeData = Node<{
	label: string;
	status?: string;
	description?: string;
	programId?: string;
	bpb?: number;
	deltaBpb?: number;
	tags?: string[];
	metric?: string;
	baselineMetric?: number;
	metrics?: Record<string, unknown>;
	[key: string]: unknown;
}>;

// Warm palette status colors — no purple, no violet
const statusColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
	active:   { bg: "bg-amber-50",   border: "border-amber-300",   text: "text-amber-700",   dot: "bg-amber-500" },
	planning: { bg: "bg-stone-100",  border: "border-stone-300",   text: "text-stone-600",   dot: "bg-stone-400" },
	queued:   { bg: "bg-sky-50",     border: "border-sky-300",     text: "text-sky-700",     dot: "bg-sky-400" },
	running:  { bg: "bg-sky-50",     border: "border-sky-400",     text: "text-sky-800",     dot: "bg-sky-500" },
	complete: { bg: "bg-teal-50",    border: "border-teal-300",    text: "text-teal-700",    dot: "bg-teal-500" },
	archived: { bg: "bg-stone-50",   border: "border-stone-200",   text: "text-stone-400",   dot: "bg-stone-300" },
};

function StatusBadge({ status }: { status: string }) {
	const colors = statusColors[status] || statusColors.planning;
	return (
		<span className={`inline-flex items-center gap-1 text-[10px] font-medium ${colors.text}`}>
			<Circle size={6} weight="fill" className={colors.text} />
			{status}
		</span>
	);
}

export function ProgramNode({ data, selected }: NodeProps<ResearchNodeData>) {
	const d = data as unknown as ResearchNodeData["data"];
	const colors = statusColors[d.status || "planning"] || statusColors.planning;
	const baseline = d.baselineMetric as number | undefined;
	const metric = d.metric as string | undefined;
	const metrics = d.metrics as Record<string, unknown> | undefined;
	const isComplete = d.status === "complete";

	return (
		<div className={`px-4 py-3 rounded border-2 min-w-[180px] max-w-[240px] transition-colors ${colors.bg} ${colors.border} ${isComplete ? "opacity-70" : ""} ${selected ? "ring-2 ring-accent shadow-md" : ""}`}>
			<Handle type="target" position={Position.Top} className="!bg-stone-400 !w-2 !h-2" />
			<div className="flex items-center gap-2 mb-1">
				{isComplete ? (
					<CheckCircle size={14} weight="bold" className={`${colors.text} shrink-0`} />
				) : (
					<Microscope size={14} className={`${colors.text} shrink-0`} />
				)}
				<span className={`font-semibold text-sm leading-tight ${isComplete ? "text-stone-500" : "text-stone-800"}`}>
					{d.label}
				</span>
			</div>
			<div className="flex items-center gap-2 flex-wrap">
				{d.status && <StatusBadge status={d.status} />}
				{baseline != null && metric && (
					<span className="text-[10px] text-stone-500 font-mono">
						{metric}: {baseline}
					</span>
				)}
			</div>
			{metrics && Object.keys(metrics).length > 0 && (
				<div className="mt-1.5 pt-1.5 border-t border-stone-200/60 flex flex-wrap gap-x-3 gap-y-0.5">
					{Object.entries(metrics).slice(0, 3).map(([k, v]) => (
						<span key={k} className="text-[9px] text-stone-400 font-mono">{k}: {String(v)}</span>
					))}
				</div>
			)}
			<Handle type="source" position={Position.Bottom} className="!bg-stone-400 !w-2 !h-2" />
		</div>
	);
}

export function FindingNode({ data, selected }: NodeProps<ResearchNodeData>) {
	const d = data as unknown as ResearchNodeData["data"];

	return (
		<div className={`px-4 py-3 rounded border-2 min-w-[160px] max-w-[200px] transition-colors bg-orange-50 border-orange-200 ${selected ? "ring-2 ring-accent shadow-md" : ""}`}>
			<Handle type="target" position={Position.Top} className="!bg-stone-400 !w-2 !h-2" />
			<div className="flex items-center gap-2">
				<BookOpen size={14} className="text-orange-600 shrink-0" />
				<span className="font-medium text-sm text-stone-700 leading-tight">{d.label}</span>
			</div>
			<Handle type="source" position={Position.Bottom} className="!bg-stone-400 !w-2 !h-2" />
		</div>
	);
}

export function ExperimentNode({ data, selected }: NodeProps<ResearchNodeData>) {
	const d = data as unknown as ResearchNodeData["data"];
	const isArchived = d.status === "archived";
	const colors = statusColors[d.status || "queued"] || statusColors.queued;

	return (
		<div className={`px-3 py-2.5 rounded border min-w-[150px] max-w-[200px] transition-colors ${colors.bg} ${colors.border} ${isArchived ? "opacity-60" : ""} ${selected ? "ring-2 ring-accent shadow-md" : ""}`}>
			<Handle type="target" position={Position.Top} className="!bg-stone-400 !w-2 !h-2" />
			<div className="flex items-center gap-2 mb-1">
				{isArchived ? (
					<Archive size={12} className={`${colors.text} shrink-0`} />
				) : (
					<Flask size={12} className={`${colors.text} shrink-0`} />
				)}
				<span className="font-medium text-xs text-stone-700 leading-tight">{d.label}</span>
			</div>
			<div className="flex items-center gap-2">
				{d.status && <StatusBadge status={d.status} />}
				{d.bpb != null && (
					<span className="text-[10px] text-stone-500 font-mono">
						bpb: {(d.bpb as number).toFixed(4)}
					</span>
				)}
			</div>
			<Handle type="source" position={Position.Bottom} className="!bg-stone-400 !w-2 !h-2" />
		</div>
	);
}

export function WorkspaceNode({ data, selected }: NodeProps<ResearchNodeData>) {
	const d = data as unknown as ResearchNodeData["data"];

	return (
		<div className={`px-5 py-4 rounded border-2 min-w-[220px] max-w-[280px] transition-colors bg-orange-50 border-orange-300 ${selected ? "ring-2 ring-accent shadow-md" : ""}`}>
			<div className="flex items-center gap-2.5">
				<Buildings size={18} weight="duotone" className="text-accent shrink-0" />
				<span className="font-bold text-base text-stone-900 leading-tight">{d.label}</span>
			</div>
			<Handle type="source" position={Position.Bottom} className="!bg-accent !w-2.5 !h-2.5" />
		</div>
	);
}

export const nodeTypes = {
	workspace: WorkspaceNode,
	program: ProgramNode,
	finding: FindingNode,
	experiment: ExperimentNode,
};
