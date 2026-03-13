import { useState, useEffect } from "react";
import { rpcRequest } from "../rpc";
import {
	Folder,
	FolderOpen,
	Clock,
	CircleNotch,
} from "@phosphor-icons/react";

interface OpenWorkspaceDialogProps {
	onComplete: () => void;
	onCancel: () => void;
}

export function OpenWorkspaceDialog({
	onComplete,
	onCancel,
}: OpenWorkspaceDialogProps) {
	const [wsPath, setWsPath] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [recents, setRecents] = useState<
		{ path: string; name: string; lastOpened: string }[]
	>([]);

	useEffect(() => {
		rpcRequest
			.getRecentWorkspaces({})
			.then(setRecents)
			.catch(() => {});
	}, []);

	async function handleOpen(pathToOpen: string) {
		setLoading(true);
		setError(null);
		try {
			await rpcRequest.openWorkspace({ path: pathToOpen });
			onComplete();
		} catch (err) {
			setError(String(err));
			setLoading(false);
		}
	}

	function formatDate(iso: string): string {
		try {
			const d = new Date(iso);
			const now = new Date();
			const diffMs = now.getTime() - d.getTime();
			const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
			if (diffDays === 0) return "today";
			if (diffDays === 1) return "yesterday";
			if (diffDays < 7) return `${diffDays}d ago`;
			return d.toLocaleDateString();
		} catch {
			return "";
		}
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
			onClick={onCancel}
		>
			<div
				className="bg-surface rounded-xl shadow-2xl border border-border w-[480px] max-w-[90vw] overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="px-6 pt-6 pb-3">
					<h1 className="text-lg font-semibold text-stone-800 flex items-center gap-2">
						<FolderOpen size={18} />
						Open Workspace
					</h1>
				</div>

				{/* Path input */}
				<div className="px-6 pb-3">
					<label className="text-xs text-stone-500 block mb-1">
						Workspace path (folder containing meta.json)
					</label>
					<div className="flex gap-2">
						<input
							type="text"
							value={wsPath}
							onChange={(e) => setWsPath(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && wsPath.trim()) {
									handleOpen(wsPath.trim());
								}
							}}
							className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-surface-sunken outline-none focus:border-accent"
							placeholder="~/path/to/workspace"
							autoFocus
						/>
						<button
							onClick={() => handleOpen(wsPath.trim())}
							disabled={!wsPath.trim() || loading}
							className="px-4 py-2 text-sm bg-accent text-white rounded-md hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1"
						>
							{loading && (
								<CircleNotch
									size={14}
									className="animate-spin"
								/>
							)}
							Open
						</button>
					</div>
				</div>

				{/* Error */}
				{error && (
					<div className="px-6 pb-2">
						<div className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">
							{error}
						</div>
					</div>
				)}

				{/* Recent workspaces */}
				{recents.length > 0 && (
					<div className="px-6 pb-4">
						<div className="text-xs text-stone-400 uppercase tracking-wider font-medium flex items-center gap-1 mb-2">
							<Clock size={10} />
							Recent
						</div>
						<div className="space-y-0.5 max-h-[200px] overflow-y-auto">
							{recents.map((ws) => (
								<button
									key={ws.path}
									onClick={() => handleOpen(ws.path)}
									disabled={loading}
									className="w-full text-left px-3 py-2 rounded-md hover:bg-surface-sunken transition-colors flex items-center gap-2 group disabled:opacity-50"
								>
									<Folder
										size={14}
										className="text-stone-400 flex-shrink-0"
									/>
									<div className="flex-1 min-w-0">
										<div className="text-sm text-stone-700 truncate">
											{ws.name}
										</div>
										<div className="text-2xs text-stone-400 truncate">
											{ws.path}
										</div>
									</div>
									<span className="text-2xs text-stone-400 flex-shrink-0">
										{formatDate(ws.lastOpened)}
									</span>
								</button>
							))}
						</div>
					</div>
				)}

				{/* Footer */}
				<div className="px-6 py-3 border-t border-border flex justify-end">
					<button
						onClick={onCancel}
						className="px-4 py-1.5 text-sm text-stone-500 hover:text-stone-700"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}
