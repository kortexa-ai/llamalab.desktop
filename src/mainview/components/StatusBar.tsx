import { GitBranch, CloudArrowUp } from "@phosphor-icons/react";
import { useWorkspace } from "../hooks/useWorkspace";
import { rpcRequest } from "../rpc";

export function StatusBar() {
	const { state } = useWorkspace();

	const activeTab =
		state.activeTabIndex >= 0 ? state.tabs[state.activeTabIndex] : null;

	async function handlePush() {
		try {
			await rpcRequest.gitPush({});
		} catch (err) {
			console.error("git push failed:", err);
		}
	}

	const gs = state.gitStatus;

	return (
		<div className="flex items-center justify-between px-3 py-0.5 bg-surface-raised border-t border-border text-2xs text-stone-400 flex-shrink-0">
			<div className="flex items-center gap-3">
				{/* Git branch */}
				{state.gitBranch && (
					<span className="flex items-center gap-1 text-stone-500">
						<GitBranch size={10} />
						<span className="font-mono">{state.gitBranch}</span>
						{state.gitDirty && <span className="text-amber-500">*</span>}
					</span>
				)}
				{/* Ahead/behind */}
				{gs && (gs.ahead > 0 || gs.behind > 0) && (
					<span className="text-stone-500">
						{gs.ahead > 0 && (
							<span className="text-emerald-600">{gs.ahead}↑</span>
						)}
						{gs.behind > 0 && (
							<span className="text-sky-600 ml-0.5">{gs.behind}↓</span>
						)}
					</span>
				)}
				{/* Push button */}
				{gs && gs.ahead > 0 && (
					<button
						onClick={handlePush}
						className="flex items-center gap-0.5 text-stone-500 hover:text-accent transition-colors"
						title="Push to remote"
					>
						<CloudArrowUp size={10} />
						Push
					</button>
				)}
				<span>{state.programs.length} programs</span>
				{activeTab && (
					<span className="text-stone-500">{activeTab.label}</span>
				)}
			</div>
			<div className="flex items-center gap-3">
				{state.agents.filter((a) => a.status === "running").length > 0 && (
					<span className="text-emerald-600">
						{state.agents.filter((a) => a.status === "running").length} agents running
					</span>
				)}
				<span>Llama Lab</span>
			</div>
		</div>
	);
}
