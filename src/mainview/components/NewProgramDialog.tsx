import { useState, useEffect, useMemo } from "react";
import { rpcRequest } from "../rpc";
import { useWorkspace } from "../hooks/useWorkspace";
import {
	Flask,
	GitBranch,
	Tag,
	CircleNotch,
	ArrowRight,
} from "@phosphor-icons/react";
import type { ProgramJson } from "../../shared/types";

interface NewProgramDialogProps {
	onClose: () => void;
}

export function NewProgramDialog({ onClose }: NewProgramDialogProps) {
	const { state, dispatch, openProgram } = useWorkspace();
	const [step, setStep] = useState(0);

	// Form fields
	const [name, setName] = useState("");
	const [id, setId] = useState("");
	const [idManuallyEdited, setIdManuallyEdited] = useState(false);
	const [description, setDescription] = useState("");
	const [baseTrackId, setBaseTrackId] = useState<string>("");
	const [metric, setMetric] = useState("loss");
	const [metricDirection, setMetricDirection] = useState("minimize");
	const [tags, setTags] = useState("");

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Auto-generate id from name unless manually edited
	useEffect(() => {
		if (!idManuallyEdited) {
			setId(
				name
					.toLowerCase()
					.replace(/[^a-z0-9\s-]/g, "")
					.replace(/\s+/g, "-")
					.replace(/-+/g, "-")
					.replace(/^-|-$/g, ""),
			);
		}
	}, [name, idManuallyEdited]);

	// Group programs by status for the base track picker
	const programsByStatus = useMemo(() => {
		const groups: Record<string, ProgramJson[]> = {};
		for (const p of state.programs) {
			const status = p.status || "unknown";
			if (!groups[status]) groups[status] = [];
			groups[status].push(p);
		}
		return groups;
	}, [state.programs]);

	// When base track is selected, inherit its metric settings
	useEffect(() => {
		if (baseTrackId) {
			const base = state.programs.find((p) => p.id === baseTrackId);
			if (base) {
				if (base.metric) setMetric(base.metric);
				if (base.metricDirection) setMetricDirection(base.metricDirection);
			}
		}
	}, [baseTrackId, state.programs]);

	async function handleCreate() {
		if (!name.trim() || !id.trim()) {
			setError("Name and ID are required");
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const tagList = tags
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean);

			const program = await rpcRequest.createProgram({
				id,
				name: name.trim(),
				description: description.trim(),
				baseTrackId: baseTrackId || undefined,
				tags: tagList,
				metric,
				metricDirection,
			});
			// Refresh programs list
			dispatch({ type: "SET_PROGRAMS", programs: await rpcRequest.getPrograms({}) });
			// Open the new program
			openProgram(program);
			onClose();
		} catch (err) {
			setError(String(err));
			setLoading(false);
		}
	}

	const canAdvance = step === 0 ? name.trim().length > 0 && id.trim().length > 0 : true;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
			onClick={onClose}
		>
			<div
				className="bg-surface rounded-xl shadow-2xl border border-border w-[500px] max-w-[90vw] overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="px-6 pt-6 pb-3">
					<h1 className="text-lg font-semibold text-stone-800 flex items-center gap-2">
						<Flask size={18} className="text-amber-600" />
						New Program
					</h1>
					<p className="text-xs text-stone-500 mt-1">
						{step === 0
							? "Name and describe your research program."
							: "Choose a starting point and metrics."}
					</p>
				</div>

				{/* Step indicators */}
				<div className="px-6 pb-3 flex gap-2">
					{[0, 1].map((i) => (
						<div
							key={i}
							className={`h-1 flex-1 rounded-full transition-colors ${
								i <= step ? "bg-accent" : "bg-stone-200"
							}`}
						/>
					))}
				</div>

				{/* Step 0: Name & Description */}
				{step === 0 && (
					<div className="px-6 py-4 space-y-4">
						<div>
							<label className="text-xs text-stone-500 block mb-1">
								Program name
							</label>
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface-sunken outline-none focus:border-accent"
								placeholder="e.g. Vision LoRA Experiments"
								autoFocus
							/>
						</div>
						<div>
							<label className="text-xs text-stone-500 block mb-1">
								ID{" "}
								<span className="text-stone-400">
									(lowercase, used for folders)
								</span>
							</label>
							<input
								type="text"
								value={id}
								onChange={(e) => {
									setId(e.target.value);
									setIdManuallyEdited(true);
								}}
								className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface-sunken outline-none focus:border-accent font-mono"
								placeholder="vision-lora-experiments"
							/>
						</div>
						<div>
							<label className="text-xs text-stone-500 block mb-1">
								Description
							</label>
							<textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								rows={3}
								className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface-sunken outline-none focus:border-accent resize-none"
								placeholder="What are you investigating?"
							/>
						</div>
					</div>
				)}

				{/* Step 1: Base track, metric, tags */}
				{step === 1 && (
					<div className="px-6 py-4 space-y-4">
						{/* Base track */}
						<div>
							<label className="text-xs text-stone-500 block mb-1 flex items-center gap-1">
								<GitBranch size={10} />
								Branch from existing program
								<span className="text-stone-400">(optional)</span>
							</label>
							<select
								value={baseTrackId}
								onChange={(e) => setBaseTrackId(e.target.value)}
								className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface-sunken outline-none focus:border-accent"
							>
								<option value="">Start from scratch</option>
								{Object.entries(programsByStatus).map(
									([status, programs]) => (
										<optgroup
											key={status}
											label={status}
										>
											{programs.map((p) => (
												<option
													key={p.id}
													value={p.id}
												>
													{p.name}
												</option>
											))}
										</optgroup>
									),
								)}
							</select>
							{baseTrackId && (
								<p className="text-2xs text-stone-400 mt-1">
									Track files will be copied as a starting point. Results will not be inherited.
								</p>
							)}
						</div>

						{/* Metric */}
						<div className="flex gap-3">
							<div className="flex-1">
								<label className="text-xs text-stone-500 block mb-1">
									Metric
								</label>
								<input
									type="text"
									value={metric}
									onChange={(e) => setMetric(e.target.value)}
									className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface-sunken outline-none focus:border-accent font-mono"
									placeholder="loss"
								/>
							</div>
							<div className="w-[140px]">
								<label className="text-xs text-stone-500 block mb-1">
									Direction
								</label>
								<select
									value={metricDirection}
									onChange={(e) =>
										setMetricDirection(e.target.value)
									}
									className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface-sunken outline-none focus:border-accent"
								>
									<option value="minimize">minimize</option>
									<option value="maximize">maximize</option>
								</select>
							</div>
						</div>

						{/* Tags */}
						<div>
							<label className="text-xs text-stone-500 block mb-1 flex items-center gap-1">
								<Tag size={10} />
								Tags
								<span className="text-stone-400">
									(comma-separated)
								</span>
							</label>
							<input
								type="text"
								value={tags}
								onChange={(e) => setTags(e.target.value)}
								className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface-sunken outline-none focus:border-accent"
								placeholder="vision, lora, architecture"
							/>
						</div>

						{/* Summary */}
						<div className="p-3 bg-surface-sunken rounded-md text-xs text-stone-600 space-y-1">
							<div className="font-medium text-stone-700">
								{name || "Untitled"}
							</div>
							<div>
								<span className="text-stone-400">ID: </span>
								<span className="font-mono">{id}</span>
							</div>
							{baseTrackId && (
								<div>
									<span className="text-stone-400">
										Branched from:{" "}
									</span>
									{state.programs.find(
										(p) => p.id === baseTrackId,
									)?.name || baseTrackId}
								</div>
							)}
							<div>
								<span className="text-stone-400">
									Metric:{" "}
								</span>
								{metric} ({metricDirection})
							</div>
						</div>
					</div>
				)}

				{/* Error */}
				{error && (
					<div className="px-6 pb-2">
						<div className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">
							{error}
						</div>
					</div>
				)}

				{/* Footer */}
				<div className="px-6 py-4 border-t border-border flex justify-between">
					<div className="flex gap-2">
						<button
							onClick={onClose}
							disabled={loading}
							className="px-4 py-1.5 text-sm text-stone-500 hover:text-stone-700 disabled:opacity-30"
						>
							Cancel
						</button>
						{step > 0 && (
							<button
								onClick={() => setStep(0)}
								disabled={loading}
								className="px-4 py-1.5 text-sm text-stone-500 hover:text-stone-700 disabled:opacity-30"
							>
								Back
							</button>
						)}
					</div>
					{step === 0 ? (
						<button
							onClick={() => setStep(1)}
							disabled={!canAdvance}
							className="px-4 py-1.5 text-sm bg-accent text-white rounded-md hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1"
						>
							Next
							<ArrowRight size={12} />
						</button>
					) : (
						<button
							onClick={handleCreate}
							disabled={loading || !id.trim()}
							className="px-4 py-1.5 text-sm bg-accent text-white rounded-md hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
						>
							{loading && (
								<CircleNotch
									size={14}
									className="animate-spin"
								/>
							)}
							{loading ? "Creating..." : "Create Program"}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
