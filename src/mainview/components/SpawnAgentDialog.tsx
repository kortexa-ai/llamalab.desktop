import { useState } from "react";
import { X, Robot } from "@phosphor-icons/react";
import { rpcRequest } from "../rpc";
import { useWorkspace } from "../hooks/useWorkspace";
import type { AgentType } from "../../shared/types";

const AGENT_TYPES: { value: AgentType; label: string; desc: string }[] = [
	{ value: "claude", label: "Claude", desc: "Most capable, full codebase access" },
	{ value: "codex", label: "Codex", desc: "Focused coding tasks" },
	{ value: "openclaw", label: "OpenClaw", desc: "Custom platform, messaging" },
	{ value: "hermes", label: "Hermes", desc: "Multi-channel, persistent persona" },
];

export function SpawnAgentDialog() {
	const { state, dispatch } = useWorkspace();
	const [agentType, setAgentType] = useState<AgentType>(state.defaultAgentType || "claude");
	const [programId, setProgramId] = useState<string>("");
	const [task, setTask] = useState("");
	const [spawning, setSpawning] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!state.showSpawnDialog) return null;

	async function handleSpawn() {
		if (!task.trim()) return;
		setSpawning(true);
		setError(null);
		try {
			const result = await rpcRequest.spawnAgent({
				type: agentType,
				programId: programId || undefined,
				task: task.trim(),
			});
			// Open agent log tab
			dispatch({
				type: "OPEN_TAB",
				tab: {
					id: `agent-${result.name}`,
					type: "agent-log",
					label: result.name,
					data: { agentName: result.name },
				},
			});
			dispatch({ type: "HIDE_SPAWN_DIALOG" });
			setTask("");
		} catch (err: any) {
			setError(err.message || "Failed to spawn agent");
		} finally {
			setSpawning(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
			<div className="bg-surface rounded-lg shadow-xl border border-border w-[480px] max-w-[90vw]">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-border">
					<div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
						<Robot size={16} className="text-accent" />
						Spawn Agent
					</div>
					<button
						onClick={() => dispatch({ type: "HIDE_SPAWN_DIALOG" })}
						className="text-stone-400 hover:text-stone-600"
					>
						<X size={14} />
					</button>
				</div>

				{/* Body */}
				<div className="px-4 py-3 space-y-3">
					{/* Agent type */}
					<div>
						<label className="block text-2xs uppercase tracking-wider text-stone-500 font-medium mb-1">
							Agent Type
						</label>
						<div className="grid grid-cols-2 gap-1.5">
							{AGENT_TYPES.map((at) => (
								<button
									key={at.value}
									onClick={() => setAgentType(at.value)}
									className={`text-left px-2 py-1.5 rounded border text-xs transition-colors ${
										agentType === at.value
											? "border-accent bg-accent-subtle text-accent"
											: "border-border text-stone-600 hover:border-stone-400"
									}`}
								>
									<div className="font-medium">{at.label}</div>
									<div className="text-2xs text-stone-400">{at.desc}</div>
								</button>
							))}
						</div>
					</div>

					{/* Program scope */}
					<div>
						<label className="block text-2xs uppercase tracking-wider text-stone-500 font-medium mb-1">
							Program (optional)
						</label>
						<select
							value={programId}
							onChange={(e) => setProgramId(e.target.value)}
							className="w-full px-2 py-1 text-xs border border-border rounded bg-white text-stone-700 outline-none focus:border-accent"
						>
							<option value="">Entire workspace</option>
							{state.programs.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
								</option>
							))}
						</select>
					</div>

					{/* Task */}
					<div>
						<label className="block text-2xs uppercase tracking-wider text-stone-500 font-medium mb-1">
							Task Description
						</label>
						<textarea
							value={task}
							onChange={(e) => setTask(e.target.value)}
							placeholder="What should this agent do?"
							rows={3}
							className="w-full px-2 py-1 text-xs border border-border rounded bg-white text-stone-700 outline-none focus:border-accent resize-none"
						/>
					</div>

					{error && (
						<div className="text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
							{error}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
					<button
						onClick={() => dispatch({ type: "HIDE_SPAWN_DIALOG" })}
						className="px-3 py-1 text-xs text-stone-600 hover:text-stone-800 transition-colors"
					>
						Cancel
					</button>
					<button
						onClick={handleSpawn}
						disabled={!task.trim() || spawning}
						className="px-3 py-1 text-xs bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 transition-colors"
					>
						{spawning ? "Spawning..." : "Spawn"}
					</button>
				</div>
			</div>
		</div>
	);
}
