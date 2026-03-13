import { useEffect, useState } from "react";
import {
	Circle,
	ArrowDown,
	ArrowUp,
	Clock,
	Tag,
	Play,
	Terminal,
	Robot,
} from "@phosphor-icons/react";
import type { ProgramDetail, ExperimentResult } from "../../shared/types";
import { rpcRequest } from "../rpc";
import { useWorkspace } from "../hooks/useWorkspace";

const STATUS_COLORS: Record<string, string> = {
	active: "text-amber-600",
	running: "text-sky-600",
	planning: "text-stone-500",
	queued: "text-stone-400",
	complete: "text-sky-700",
	archived: "text-stone-300",
};

export function ProgramOverview({ programId }: { programId: string }) {
	const [detail, setDetail] = useState<ProgramDetail | null>(null);
	const [error, setError] = useState<string | null>(null);
	const { openTerminal, dispatch } = useWorkspace();

	useEffect(() => {
		loadDetail();
	}, [programId]);

	async function loadDetail() {
		try {
			const d = await rpcRequest.getProgram({ id: programId });
			setDetail(d);
			setError(null);
		} catch (err: any) {
			setError(err.message || "Failed to load program");
		}
	}

	if (error) {
		return (
			<div className="p-4 text-sm text-red-700">
				{error}
			</div>
		);
	}

	if (!detail) {
		return (
			<div className="p-4 text-sm text-stone-400">Loading...</div>
		);
	}

	const isMinimize = detail.metricDirection === "minimize";

	return (
		<div className="p-4 overflow-y-auto h-full">
			{/* Header */}
			<div className="mb-4">
				<div className="flex items-center gap-2 mb-1">
					<h2 className="text-base font-semibold text-stone-900">
						{detail.name}
					</h2>
					<span className="flex items-center gap-1 text-2xs uppercase tracking-wider">
						<Circle
							size={6}
							weight="fill"
							className={STATUS_COLORS[detail.status] || "text-stone-400"}
						/>
						<span className="text-stone-500">{detail.status}</span>
					</span>
				</div>
				<p className="text-xs text-stone-500 font-mono">{detail.id}</p>
			</div>

			{/* Description */}
			{detail.description && (
				<div className="mb-4">
					<p className="text-sm text-stone-700 leading-relaxed">
						{detail.description}
					</p>
				</div>
			)}

			{/* Action buttons */}
			<div className="flex flex-wrap gap-2 mb-4">
				{detail.trackDir && (
					<>
						<button
							onClick={() =>
								openTerminal(`${detail.id}`, detail.trackDir)
							}
							className="flex items-center gap-1 px-2 py-1 text-xs bg-surface-raised border border-border rounded hover:bg-surface-sunken transition-colors text-stone-700"
						>
							<Terminal size={12} />
							Open Terminal Here
						</button>
						<button
							onClick={() =>
								openTerminal(
									`run: ${detail.id}`,
									detail.trackDir,
								)
							}
							className="flex items-center gap-1 px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent/90 transition-colors"
						>
							<Play size={12} />
							Run Experiment
						</button>
					</>
				)}
				<button
					onClick={() => dispatch({ type: "SHOW_SPAWN_DIALOG" })}
					className="flex items-center gap-1 px-2 py-1 text-xs bg-surface-raised border border-border rounded hover:bg-surface-sunken transition-colors text-stone-700"
				>
					<Robot size={12} />
					Spawn Agent
				</button>
			</div>

			{/* Metric + Tags row */}
			<div className="flex flex-wrap gap-3 mb-4 text-xs">
				{detail.metric && (
					<div className="flex items-center gap-1 text-stone-600">
						{isMinimize ? (
							<ArrowDown size={12} className="text-sky-600" />
						) : (
							<ArrowUp size={12} className="text-amber-600" />
						)}
						<span className="font-mono">{detail.metric}</span>
						{detail.baselineMetric != null && (
							<span className="text-stone-400 ml-1">
								baseline: {detail.baselineMetric}
							</span>
						)}
					</div>
				)}
				{detail.tags && detail.tags.length > 0 && (
					<div className="flex items-center gap-1 text-stone-500">
						<Tag size={12} />
						{detail.tags.map((tag) => (
							<span
								key={tag}
								className="px-1 py-0.5 bg-surface-sunken rounded-sm text-2xs"
							>
								{tag}
							</span>
						))}
					</div>
				)}
			</div>

			{/* Track config summary */}
			{detail.track && (
				<div className="mb-4 border border-border rounded p-3">
					<h3 className="text-xs font-semibold text-stone-700 mb-2 uppercase tracking-wider">
						Track Config
					</h3>
					<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
						<span className="text-stone-500">Script</span>
						<span className="font-mono text-stone-700">
							{detail.track.script}
						</span>
						<span className="text-stone-500">Metric</span>
						<span className="font-mono text-stone-700">
							{detail.track.metric} ({detail.track.metric_direction})
						</span>
						<span className="text-stone-500">Budget</span>
						<span className="font-mono text-stone-700">
							{detail.track.budget_seconds}s
						</span>
					</div>
					{Object.keys(detail.track.config_space).length > 0 && (
						<div className="mt-2 pt-2 border-t border-border">
							<span className="text-2xs uppercase tracking-wider text-stone-400 font-medium">
								Config Space
							</span>
							<div className="mt-1 text-xs font-mono text-stone-600">
								{Object.entries(detail.track.config_space).map(
									([key, val]) => (
										<div key={key}>
											<span className="text-stone-500">{key}:</span>{" "}
											{JSON.stringify(val)}
										</div>
									),
								)}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Experiment results */}
			{detail.results.length > 0 && (
				<div className="mb-4">
					<h3 className="text-xs font-semibold text-stone-700 mb-2 uppercase tracking-wider">
						Experiments ({detail.results.length})
					</h3>
					<div className="border border-border rounded overflow-hidden">
						<table className="w-full text-xs">
							<thead>
								<tr className="bg-surface-raised text-stone-500 text-left">
									<th className="px-2 py-1 font-medium">ID</th>
									<th className="px-2 py-1 font-medium">Metric</th>
									<th className="px-2 py-1 font-medium">Delta</th>
									<th className="px-2 py-1 font-medium">Status</th>
									<th className="px-2 py-1 font-medium">
										<Clock size={10} className="inline" />
									</th>
								</tr>
							</thead>
							<tbody>
								{detail.results.map((r) => (
									<ResultRow key={r.experiment_id} result={r} />
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Finding (markdown) */}
			{detail.finding && (
				<div className="mb-4">
					<h3 className="text-xs font-semibold text-stone-700 mb-2 uppercase tracking-wider">
						Findings
					</h3>
					<div className="border border-border rounded p-3 text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
						{detail.finding}
					</div>
				</div>
			)}
		</div>
	);
}

function ResultRow({ result }: { result: ExperimentResult }) {
	const deltaColor =
		result.delta < 0
			? "text-emerald-700"
			: result.delta > 0
				? "text-red-700"
				: "text-stone-500";

	const statusColor =
		result.status === "keep"
			? "text-emerald-700"
			: result.status === "error"
				? "text-red-700"
				: "text-stone-500";

	return (
		<tr className="border-t border-border hover:bg-surface-sunken transition-colors">
			<td className="px-2 py-1 font-mono text-stone-700">
				{result.experiment_id}
			</td>
			<td className="px-2 py-1 font-mono">{result.metric_value.toFixed(4)}</td>
			<td className={`px-2 py-1 font-mono ${deltaColor}`}>
				{result.delta > 0 ? "+" : ""}
				{result.delta.toFixed(4)}
			</td>
			<td className={`px-2 py-1 ${statusColor}`}>{result.status}</td>
			<td className="px-2 py-1 text-stone-400">
				{Math.round(result.duration_seconds)}s
			</td>
		</tr>
	);
}
