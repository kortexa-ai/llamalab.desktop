import { useState, useEffect, useRef, useMemo } from "react";
import {
	MagnifyingGlass,
	Flask,
	FileText,
	Terminal,
	Robot,
	Eye,
	Folder,
	FolderOpen,
} from "@phosphor-icons/react";
import { useWorkspace } from "../hooks/useWorkspace";
import { rpcRequest } from "../rpc";
import type { FileEntry } from "../../shared/types";

interface Command {
	id: string;
	label: string;
	category: string;
	icon?: React.ReactNode;
	action: () => void;
}

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [workspaceFiles, setWorkspaceFiles] = useState<FileEntry[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);
	const { state, dispatch, openProgram, openGraph, openFile, openTerminal } =
		useWorkspace();

	// Listen for Cmd+P
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "p") {
				e.preventDefault();
				setOpen((prev) => !prev);
				setQuery("");
				setSelectedIndex(0);
			}
			if (e.key === "Escape" && open) {
				setOpen(false);
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open]);

	// Focus input when opening
	useEffect(() => {
		if (open) {
			inputRef.current?.focus();
			// Load workspace files for file search
			rpcRequest.getWorkspaceFiles({}).then(setWorkspaceFiles).catch(() => {});
		}
	}, [open]);

	// Build command list
	const commands = useMemo(() => {
		const cmds: Command[] = [];

		// Programs
		for (const program of state.programs) {
			cmds.push({
				id: `program-${program.id}`,
				label: program.name,
				category: "Programs",
				icon: <Flask size={12} className="text-amber-600" />,
				action: () => openProgram(program),
			});
		}

		// Files (flatten)
		function flattenFiles(entries: FileEntry[], prefix = ""): void {
			for (const entry of entries) {
				if (!entry.isDir) {
					cmds.push({
						id: `file-${entry.path}`,
						label: prefix ? `${prefix}/${entry.name}` : entry.name,
						category: "Files",
						icon: <FileText size={12} className="text-stone-400" />,
						action: () => openFile("", entry.path, "workspace", entry.name),
					});
				}
				if (entry.children) {
					flattenFiles(
						entry.children,
						prefix ? `${prefix}/${entry.name}` : entry.name,
					);
				}
			}
		}
		flattenFiles(workspaceFiles);

		// Built-in commands
		cmds.push({
			id: "cmd-charts",
			label: "Experiment Charts",
			category: "Commands",
			icon: <Eye size={12} className="text-stone-400" />,
			action: () =>
				dispatch({
					type: "OPEN_TAB",
					tab: {
						id: "charts-browser",
						type: "charts-browser" as any,
						label: "Charts",
						data: {},
					},
				}),
		});
		cmds.push({
			id: "cmd-graph",
			label: "Open Dependency Graph",
			category: "Commands",
			icon: <Eye size={12} className="text-stone-400" />,
			action: () => openGraph(),
		});
		cmds.push({
			id: "cmd-terminal",
			label: "New Terminal",
			category: "Commands",
			icon: <Terminal size={12} className="text-stone-400" />,
			action: () => openTerminal(),
		});
		cmds.push({
			id: "cmd-toggle-sidebar",
			label: "Toggle Sidebar",
			category: "Commands",
			action: () => dispatch({ type: "TOGGLE_SIDEBAR" }),
		});
		cmds.push({
			id: "cmd-toggle-terminal",
			label: "Toggle Terminal",
			category: "Commands",
			icon: <Terminal size={12} className="text-stone-400" />,
			action: () => dispatch({ type: "TOGGLE_TERMINAL" }),
		});
		cmds.push({
			id: "cmd-spawn-agent",
			label: "Spawn Agent...",
			category: "Commands",
			icon: <Robot size={12} className="text-stone-400" />,
			action: () => dispatch({ type: "SHOW_SPAWN_DIALOG" }),
		});
		cmds.push({
			id: "cmd-new-program",
			label: "New Program...",
			category: "Commands",
			icon: <Flask size={12} className="text-amber-600" />,
			action: () => window.dispatchEvent(new CustomEvent("workspace-dialog", { detail: "new-program" })),
		});
		cmds.push({
			id: "cmd-new-workspace",
			label: "New Workspace...",
			category: "Workspace",
			icon: <Folder size={12} className="text-stone-400" />,
			action: () => window.dispatchEvent(new CustomEvent("workspace-dialog", { detail: "new-workspace" })),
		});
		cmds.push({
			id: "cmd-open-workspace",
			label: "Open Workspace...",
			category: "Workspace",
			icon: <FolderOpen size={12} className="text-stone-400" />,
			action: () => window.dispatchEvent(new CustomEvent("workspace-dialog", { detail: "open-workspace" })),
		});

		return cmds;
	}, [state.programs, workspaceFiles, openProgram, openGraph, openFile, openTerminal, dispatch]);

	// Filter by query
	const filtered = useMemo(() => {
		if (!query.trim()) return commands.slice(0, 50);
		const q = query.toLowerCase();
		return commands
			.filter(
				(cmd) =>
					cmd.label.toLowerCase().includes(q) ||
					cmd.category.toLowerCase().includes(q),
			)
			.slice(0, 50);
	}, [commands, query]);

	// Clamp selected index
	useEffect(() => {
		setSelectedIndex(0);
	}, [query]);

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setSelectedIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (filtered[selectedIndex]) {
				filtered[selectedIndex].action();
				setOpen(false);
			}
		}
	}

	if (!open) return null;

	// Group by category
	const grouped = new Map<string, typeof filtered>();
	for (const cmd of filtered) {
		if (!grouped.has(cmd.category)) grouped.set(cmd.category, []);
		grouped.get(cmd.category)!.push(cmd);
	}

	let globalIdx = 0;

	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/20"
			onClick={() => setOpen(false)}
		>
			<div
				className="bg-surface rounded-lg shadow-xl border border-border w-[500px] max-w-[90vw] max-h-[60vh] flex flex-col"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Search input */}
				<div className="flex items-center gap-2 px-3 py-2 border-b border-border">
					<MagnifyingGlass size={14} className="text-stone-400 flex-shrink-0" />
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Search programs, files, commands..."
						className="flex-1 text-sm bg-transparent outline-none text-stone-800 placeholder:text-stone-400"
					/>
				</div>

				{/* Results */}
				<div className="flex-1 overflow-y-auto py-1">
					{filtered.length === 0 && (
						<div className="px-3 py-4 text-sm text-stone-400 text-center">
							No results
						</div>
					)}
					{Array.from(grouped.entries()).map(([category, items]) => (
						<div key={category}>
							<div className="px-3 py-0.5 text-2xs uppercase tracking-wider text-stone-400 font-medium">
								{category}
							</div>
							{items.map((cmd) => {
								const idx = globalIdx++;
								return (
									<button
										key={cmd.id}
										onClick={() => {
											cmd.action();
											setOpen(false);
										}}
										className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
											idx === selectedIndex
												? "bg-accent-subtle text-accent"
												: "text-stone-700 hover:bg-surface-sunken"
										}`}
									>
										{cmd.icon}
										<span className="truncate">{cmd.label}</span>
									</button>
								);
							})}
						</div>
					))}
				</div>

				{/* Footer hint */}
				<div className="px-3 py-1.5 border-t border-border text-2xs text-stone-400 flex gap-3">
					<span>↑↓ navigate</span>
					<span>↵ open</span>
					<span>esc close</span>
				</div>
			</div>
		</div>
	);
}
