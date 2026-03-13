import { useEffect, useState, useCallback } from "react";
import {
	CaretDown,
	CaretRight,
	Flask,
	FileText,
	FolderSimple,
	Circle,
	MagnifyingGlass,
	GitBranch,
	Plus,
	Minus,
	DotsThree,
	Robot,
	ChartLine,
} from "@phosphor-icons/react";
import { useWorkspace } from "../hooks/useWorkspace";
import { rpcRequest } from "../rpc";
import type { FileEntry } from "../../shared/types";

const STATUS_ORDER = ["active", "running", "planning", "queued", "complete", "archived"];
const STATUS_COLORS: Record<string, string> = {
	active: "text-amber-600",
	running: "text-sky-600",
	planning: "text-stone-500",
	queued: "text-stone-400",
	complete: "text-sky-700",
	archived: "text-stone-300",
};

export function Sidebar() {
	const { state, dispatch, openProgram, openGraph, openFile } = useWorkspace();
	const [sourceFiles, setSourceFiles] = useState<FileEntry[]>([]);
	const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

	// Load programs and workspace on mount and when they change
	useEffect(() => {
		loadPrograms();
		loadWorkspace();
		loadSourceFiles();

		const handler = () => loadPrograms();
		window.addEventListener("programsChanged", handler);
		return () => window.removeEventListener("programsChanged", handler);
	}, []);

	async function loadPrograms() {
		try {
			const programs = await rpcRequest.getPrograms({});
			dispatch({ type: "SET_PROGRAMS", programs });
		} catch (err) {
			console.error("Failed to load programs:", err);
		}
	}

	async function loadWorkspace() {
		try {
			const ws = await rpcRequest.getWorkspace({});
			dispatch({ type: "SET_WORKSPACE_NAME", name: ws.name });
		} catch (err) {
			console.error("Failed to load workspace:", err);
		}
	}

	async function loadSourceFiles() {
		try {
			const files = await rpcRequest.getWorkspaceFiles({});
			setSourceFiles(files);
		} catch (err) {
			console.error("Failed to load source files:", err);
		}
	}

	const toggleDir = useCallback((path: string) => {
		setExpandedDirs((prev) => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	}, []);

	const handleFileClick = useCallback(
		(entry: FileEntry) => {
			if (entry.isDir) {
				toggleDir(entry.path);
			} else {
				const label = entry.name;
				openFile("", entry.path, "workspace", label);
			}
		},
		[toggleDir, openFile],
	);

	// Group programs by status
	const grouped = new Map<string, typeof state.programs>();
	for (const p of state.programs) {
		const status = p.status || "planning";
		if (!grouped.has(status)) grouped.set(status, []);
		grouped.get(status)!.push(p);
	}

	// Filter by search
	const filter = state.searchFilter.toLowerCase();
	const filteredGrouped = new Map<string, typeof state.programs>();
	for (const [status, programs] of grouped) {
		const filtered = filter
			? programs.filter(
					(p) =>
						p.name.toLowerCase().includes(filter) ||
						p.id.toLowerCase().includes(filter) ||
						p.tags?.some((t) => t.toLowerCase().includes(filter)),
				)
			: programs;
		if (filtered.length > 0) filteredGrouped.set(status, filtered);
	}

	const isCollapsed = (section: string) =>
		state.collapsedSections.has(section);

	return (
		<div className="flex flex-col h-full bg-surface-raised border-r border-border select-none">
			{/* Drag region at top for title bar */}
			<div className="titlebar-drag h-9 flex-shrink-0" />

			{/* Search */}
			<div className="px-2 pb-2 titlebar-no-drag">
				<div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-border rounded text-xs">
					<MagnifyingGlass size={12} className="text-stone-400 flex-shrink-0" />
					<input
						type="text"
						placeholder="Filter..."
						value={state.searchFilter}
						onChange={(e) =>
							dispatch({
								type: "SET_SEARCH_FILTER",
								filter: e.target.value,
							})
						}
						className="bg-transparent outline-none w-full text-stone-800 placeholder:text-stone-400"
					/>
				</div>
			</div>

			{/* Scrollable content */}
			<div className="flex-1 overflow-y-auto overflow-x-hidden px-1 titlebar-no-drag">
				{/* Programs section */}
				<SectionHeader
					label="Programs"
					count={state.programs.length}
					collapsed={isCollapsed("programs")}
					onToggle={() =>
						dispatch({ type: "TOGGLE_SECTION", section: "programs" })
					}
				/>
				{!isCollapsed("programs") && (
					<div className="mb-2">
						{STATUS_ORDER.filter((s) => filteredGrouped.has(s)).map(
							(status) => (
								<div key={status}>
									<div className="flex items-center gap-1 px-3 py-0.5">
										<Circle
											size={6}
											weight="fill"
											className={STATUS_COLORS[status] || "text-stone-400"}
										/>
										<span className="text-2xs uppercase tracking-wider text-stone-400 font-medium">
											{status}
										</span>
									</div>
									{filteredGrouped.get(status)!.map((program) => (
										<button
											key={program.id}
											onClick={() => openProgram(program)}
											className={`w-full text-left px-4 py-1 text-xs truncate hover:bg-surface-sunken transition-colors ${
												state.selectedSidebarItem === program.id
													? "bg-accent-subtle text-accent font-medium"
													: "text-stone-700"
											}`}
										>
											{program.name}
										</button>
									))}
								</div>
							),
						)}
					</div>
				)}

				{/* Source tree section */}
				<SectionHeader
					label="Source"
					count={sourceFiles.length}
					collapsed={isCollapsed("source")}
					onToggle={() =>
						dispatch({ type: "TOGGLE_SECTION", section: "source" })
					}
				/>
				{!isCollapsed("source") && (
					<div className="mb-2">
						<FileTree
							entries={sourceFiles}
							expandedDirs={expandedDirs}
							onFileClick={handleFileClick}
							depth={0}
						/>
					</div>
				)}

				{/* Source Control section */}
				<SectionHeader
					label="Source Control"
					collapsed={isCollapsed("git")}
					onToggle={() =>
						dispatch({ type: "TOGGLE_SECTION", section: "git" })
					}
					icon={<GitBranch size={10} className="text-stone-400" />}
				/>
				{!isCollapsed("git") && (
					<div className="mb-2">
						<SourceControlSection />
					</div>
				)}

				{/* Agents section */}
				<SectionHeader
					label="Agents"
					collapsed={isCollapsed("agents")}
					onToggle={() =>
						dispatch({ type: "TOGGLE_SECTION", section: "agents" })
					}
					icon={<Robot size={10} className="text-stone-400" />}
				/>
				{!isCollapsed("agents") && (
					<div className="mb-2">
						<AgentsSection />
					</div>
				)}

				{/* Views section */}
				<SectionHeader
					label="Views"
					collapsed={isCollapsed("views")}
					onToggle={() =>
						dispatch({ type: "TOGGLE_SECTION", section: "views" })
					}
				/>
				{!isCollapsed("views") && (
					<div className="mb-2">
						<button
							onClick={openGraph}
							className="w-full text-left px-3 py-1 text-xs text-stone-700 hover:bg-surface-sunken transition-colors flex items-center gap-1.5"
						>
							<Flask size={12} className="text-stone-400" />
							Dependency Graph
						</button>
						<button
							onClick={() =>
								dispatch({
									type: "OPEN_TAB",
									tab: {
										id: "charts-browser",
										type: "charts-browser",
										label: "Charts",
										data: {},
									},
								})
							}
							className="w-full text-left px-3 py-1 text-xs text-stone-700 hover:bg-surface-sunken transition-colors flex items-center gap-1.5"
						>
							<ChartLine size={12} className="text-stone-400" />
							Experiment Charts
						</button>
					</div>
				)}
			</div>

			{/* Workspace name + branch at bottom */}
			<div className="px-3 py-1.5 border-t border-border text-2xs text-stone-400 flex-shrink-0 titlebar-no-drag truncate flex items-center gap-2">
				<span className="truncate">{state.workspaceName || "Research Workspace"}</span>
				{state.gitBranch && (
					<span className="flex items-center gap-0.5 text-stone-500">
						<GitBranch size={9} />
						{state.gitBranch}
						{state.gitDirty && <span className="text-amber-600">*</span>}
					</span>
				)}
			</div>
		</div>
	);
}

function SectionHeader({
	label,
	count,
	collapsed,
	onToggle,
	icon,
}: {
	label: string;
	count?: number;
	collapsed: boolean;
	onToggle: () => void;
	icon?: React.ReactNode;
}) {
	return (
		<button
			onClick={onToggle}
			className="w-full flex items-center gap-1 px-2 py-1 text-2xs uppercase tracking-wider text-stone-500 font-semibold hover:text-stone-700 transition-colors"
		>
			{collapsed ? <CaretRight size={10} /> : <CaretDown size={10} />}
			{icon}
			{label}
			{count !== undefined && (
				<span className="text-stone-400 font-normal ml-auto">{count}</span>
			)}
		</button>
	);
}

// --- File Tree ---

function FileTree({
	entries,
	expandedDirs,
	onFileClick,
	depth,
}: {
	entries: FileEntry[];
	expandedDirs: Set<string>;
	onFileClick: (entry: FileEntry) => void;
	depth: number;
}) {
	// Sort: dirs first, then files, alphabetical
	const sorted = [...entries].sort((a, b) => {
		if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
		return a.name.localeCompare(b.name);
	});

	return (
		<>
			{sorted.map((entry) => (
				<div key={entry.path}>
					<button
						onClick={() => onFileClick(entry)}
						className="w-full text-left py-0.5 text-xs text-stone-700 hover:bg-surface-sunken transition-colors flex items-center gap-1 truncate"
						style={{ paddingLeft: `${12 + depth * 12}px` }}
					>
						{entry.isDir ? (
							<>
								{expandedDirs.has(entry.path) ? (
									<CaretDown size={8} className="text-stone-400 flex-shrink-0" />
								) : (
									<CaretRight size={8} className="text-stone-400 flex-shrink-0" />
								)}
								<FolderSimple size={12} className="text-amber-600 flex-shrink-0" />
							</>
						) : (
							<>
								<span className="w-2 flex-shrink-0" />
								<FileText size={12} className="text-stone-400 flex-shrink-0" />
							</>
						)}
						<span className="truncate">{entry.name}</span>
					</button>
					{entry.isDir && expandedDirs.has(entry.path) && entry.children && (
						<FileTree
							entries={entry.children}
							expandedDirs={expandedDirs}
							onFileClick={onFileClick}
							depth={depth + 1}
						/>
					)}
				</div>
			))}
		</>
	);
}

// --- Source Control Section ---

function SourceControlSection() {
	const { state, dispatch } = useWorkspace();
	const [commitMsg, setCommitMsg] = useState("");
	const [committing, setCommitting] = useState(false);

	useEffect(() => {
		loadGitStatus();
		const interval = setInterval(loadGitStatus, 10000);
		return () => clearInterval(interval);
	}, []);

	async function loadGitStatus() {
		try {
			const status = await rpcRequest.gitStatus({});
			dispatch({ type: "SET_GIT_STATUS", gitStatus: status });
		} catch {
			// git not available or not a repo — that's fine
		}
	}

	async function handleStage(paths: string[]) {
		try {
			await rpcRequest.gitAdd({ paths });
			loadGitStatus();
		} catch (err) {
			console.error("git add failed:", err);
		}
	}

	async function handleCommit() {
		if (!commitMsg.trim() || committing) return;
		setCommitting(true);
		try {
			await rpcRequest.gitCommit({ message: commitMsg.trim() });
			setCommitMsg("");
			loadGitStatus();
		} catch (err) {
			console.error("git commit failed:", err);
		} finally {
			setCommitting(false);
		}
	}

	const openDiff = (filePath: string) => {
		const tab = {
			id: `diff-${filePath}`,
			type: "diff" as const,
			label: `diff: ${filePath.split("/").pop()}`,
			data: { filePath },
		};
		dispatch({ type: "OPEN_TAB", tab });
	};

	const gs = state.gitStatus;
	if (!gs) {
		return (
			<div className="px-3 py-1 text-2xs text-stone-400">Loading git status...</div>
		);
	}

	const hasChanges = gs.staged.length > 0 || gs.unstaged.length > 0 || gs.untracked.length > 0;

	return (
		<div className="text-xs">
			{/* Branch info */}
			<div className="px-3 py-0.5 text-2xs text-stone-500 flex items-center gap-1">
				<GitBranch size={9} />
				<span className="font-mono">{gs.branch}</span>
				{(gs.ahead > 0 || gs.behind > 0) && (
					<span className="text-stone-400">
						{gs.ahead > 0 && `+${gs.ahead}`}
						{gs.behind > 0 && `-${gs.behind}`}
					</span>
				)}
			</div>

			{/* Commit input */}
			{hasChanges && (
				<div className="px-3 py-1">
					<div className="flex gap-1">
						<input
							type="text"
							value={commitMsg}
							onChange={(e) => setCommitMsg(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleCommit();
							}}
							placeholder="Commit message..."
							className="flex-1 px-1.5 py-0.5 text-2xs bg-white border border-border rounded outline-none focus:border-accent text-stone-800 placeholder:text-stone-400"
						/>
						<button
							onClick={handleCommit}
							disabled={!commitMsg.trim() || committing}
							className="px-1.5 py-0.5 text-2xs bg-accent text-white rounded disabled:opacity-40 hover:bg-accent/90"
						>
							Commit
						</button>
					</div>
				</div>
			)}

			{/* Staged */}
			{gs.staged.length > 0 && (
				<div>
					<div className="px-3 py-0.5 text-2xs text-stone-400 uppercase tracking-wider">
						Staged ({gs.staged.length})
					</div>
					{gs.staged.map((f) => (
						<button
							key={`s-${f}`}
							onClick={() => openDiff(f)}
							className="w-full text-left px-4 py-0.5 text-xs text-emerald-700 hover:bg-surface-sunken truncate flex items-center gap-1"
						>
							<Plus size={8} className="flex-shrink-0" />
							<span className="truncate">{f}</span>
						</button>
					))}
				</div>
			)}

			{/* Unstaged */}
			{gs.unstaged.length > 0 && (
				<div>
					<div className="px-3 py-0.5 text-2xs text-stone-400 uppercase tracking-wider">
						Modified ({gs.unstaged.length})
					</div>
					{gs.unstaged.map((f) => (
						<button
							key={`u-${f}`}
							onClick={() => openDiff(f)}
							className="w-full text-left px-4 py-0.5 text-xs text-amber-700 hover:bg-surface-sunken truncate flex items-center gap-1"
						>
							<Minus size={8} className="flex-shrink-0" />
							<span className="truncate">{f}</span>
						</button>
					))}
				</div>
			)}

			{/* Untracked */}
			{gs.untracked.length > 0 && (
				<div>
					<div className="px-3 py-0.5 text-2xs text-stone-400 uppercase tracking-wider flex items-center justify-between">
						<span>Untracked ({gs.untracked.length})</span>
						<button
							onClick={() => handleStage(gs.untracked)}
							className="text-stone-500 hover:text-accent"
							title="Stage all untracked"
						>
							<Plus size={8} />
						</button>
					</div>
					{gs.untracked.map((f) => (
						<div
							key={`ut-${f}`}
							className="flex items-center px-4 py-0.5 text-xs text-stone-500 truncate gap-1"
						>
							<DotsThree size={8} className="flex-shrink-0" />
							<span className="truncate">{f}</span>
							<button
								onClick={() => handleStage([f])}
								className="ml-auto text-stone-400 hover:text-accent flex-shrink-0"
								title="Stage file"
							>
								<Plus size={8} />
							</button>
						</div>
					))}
				</div>
			)}

			{!hasChanges && (
				<div className="px-3 py-1 text-2xs text-stone-400">Clean working tree</div>
			)}
		</div>
	);
}

// --- Agents Section ---

function AgentsSection() {
	const { state, dispatch } = useWorkspace();

	useEffect(() => {
		loadAgents();
		const interval = setInterval(loadAgents, 5000);
		return () => clearInterval(interval);
	}, []);

	async function loadAgents() {
		try {
			const agents = await rpcRequest.listAgents({});
			dispatch({ type: "SET_AGENTS", agents });
		} catch {
			// agents not available
		}
	}

	const openAgentLog = (agent: { name: string }) => {
		const tab = {
			id: `agent-${agent.name}`,
			type: "agent-log" as const,
			label: agent.name,
			data: { agentName: agent.name },
		};
		dispatch({ type: "OPEN_TAB", tab });
	};

	const handleSpawn = () => {
		dispatch({ type: "SHOW_SPAWN_DIALOG" });
	};

	const agents = state.agents || [];

	return (
		<div className="text-xs">
			<button
				onClick={handleSpawn}
				className="w-full text-left px-3 py-1 text-xs text-stone-600 hover:bg-surface-sunken transition-colors flex items-center gap-1.5"
			>
				<Robot size={12} className="text-stone-400" />
				Spawn Agent...
			</button>
			{agents.map((agent) => (
				<button
					key={agent.name}
					onClick={() => openAgentLog(agent)}
					className="w-full text-left px-3 py-1 text-xs text-stone-700 hover:bg-surface-sunken transition-colors flex items-center gap-1.5"
				>
					<Circle
						size={6}
						weight="fill"
						className={
							agent.status === "running"
								? "text-emerald-500"
								: agent.status === "completed"
									? "text-sky-500"
									: "text-red-500"
						}
					/>
					<span className="truncate">{agent.name}</span>
					<span className="ml-auto text-2xs text-stone-400">{agent.type}</span>
				</button>
			))}
		</div>
	);
}
