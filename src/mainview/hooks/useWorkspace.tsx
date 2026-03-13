import {
	createContext,
	useContext,
	useReducer,
	useCallback,
	useEffect,
	type ReactNode,
} from "react";
import type { ProgramJson, GitStatus, AgentInfo } from "../../shared/types";

// --- Tab types ---

export type TabType =
	| "program-overview"
	| "markdown"
	| "file-viewer"
	| "program-edit"
	| "graph"
	| "diff"
	| "agent-log"
	| "chart"
	| "charts-browser";

export interface Tab {
	id: string;
	type: TabType;
	label: string;
	// Context data for the tab content
	data: {
		programId?: string;
		filePath?: string;
		fileSource?: "track" | "config" | "workspace";
		content?: string;
		agentName?: string;
		chartId?: string;
	};
}

// --- Terminal session ---

export interface TerminalSession {
	id: string;
	name: string;
	cwd?: string;
	status: "running" | "exited";
	exitCode?: number;
}

// --- State ---

interface WorkspaceState {
	// Sidebar
	sidebarVisible: boolean;
	sidebarWidth: number;
	selectedSidebarItem: string | null;
	collapsedSections: Set<string>;
	searchFilter: string;

	// Tabs
	tabs: Tab[];
	activeTabIndex: number;

	// Terminal
	terminalVisible: boolean;
	terminalHeight: number;
	terminalSessions: TerminalSession[];
	activeTerminalIndex: number;

	// Git
	gitBranch: string | null;
	gitDirty: boolean;
	gitStatus: GitStatus | null;

	// Agents
	agents: AgentInfo[];
	showSpawnDialog: boolean;

	// Data
	programs: ProgramJson[];
	workspaceName: string;
}

const initialState: WorkspaceState = {
	sidebarVisible: true,
	sidebarWidth: 240,
	selectedSidebarItem: null,
	collapsedSections: new Set(),
	searchFilter: "",
	tabs: [],
	activeTabIndex: -1,
	terminalVisible: false,
	terminalHeight: 200,
	terminalSessions: [],
	activeTerminalIndex: -1,
	gitBranch: null,
	gitDirty: false,
	gitStatus: null,
	agents: [],
	showSpawnDialog: false,
	programs: [],
	workspaceName: "Research Workspace",
};

// --- Actions ---

type Action =
	| { type: "TOGGLE_SIDEBAR" }
	| { type: "SET_SIDEBAR_WIDTH"; width: number }
	| { type: "SELECT_SIDEBAR_ITEM"; id: string }
	| { type: "TOGGLE_SECTION"; section: string }
	| { type: "SET_SEARCH_FILTER"; filter: string }
	| { type: "OPEN_TAB"; tab: Tab }
	| { type: "CLOSE_TAB"; index: number }
	| { type: "SET_ACTIVE_TAB"; index: number }
	| { type: "TOGGLE_TERMINAL" }
	| { type: "SET_TERMINAL_HEIGHT"; height: number }
	| { type: "ADD_TERMINAL_SESSION"; session: TerminalSession }
	| { type: "REMOVE_TERMINAL_SESSION"; id: string }
	| { type: "SET_ACTIVE_TERMINAL"; index: number }
	| { type: "UPDATE_TERMINAL_SESSION"; id: string; updates: Partial<TerminalSession> }
	| { type: "SET_PROGRAMS"; programs: ProgramJson[] }
	| { type: "SET_WORKSPACE_NAME"; name: string }
	| { type: "SET_GIT_STATUS"; gitStatus: GitStatus }
	| { type: "SET_AGENTS"; agents: AgentInfo[] }
	| { type: "SHOW_SPAWN_DIALOG" }
	| { type: "HIDE_SPAWN_DIALOG" };

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
	switch (action.type) {
		case "TOGGLE_SIDEBAR":
			return { ...state, sidebarVisible: !state.sidebarVisible };

		case "SET_SIDEBAR_WIDTH":
			return { ...state, sidebarWidth: action.width };

		case "SELECT_SIDEBAR_ITEM":
			return { ...state, selectedSidebarItem: action.id };

		case "TOGGLE_SECTION": {
			const next = new Set(state.collapsedSections);
			if (next.has(action.section)) next.delete(action.section);
			else next.add(action.section);
			return { ...state, collapsedSections: next };
		}

		case "SET_SEARCH_FILTER":
			return { ...state, searchFilter: action.filter };

		case "OPEN_TAB": {
			// If tab with same id already exists, just focus it
			const existing = state.tabs.findIndex(
				(t) => t.id === action.tab.id,
			);
			if (existing >= 0) {
				return { ...state, activeTabIndex: existing };
			}
			const tabs = [...state.tabs, action.tab];
			return { ...state, tabs, activeTabIndex: tabs.length - 1 };
		}

		case "CLOSE_TAB": {
			const tabs = state.tabs.filter((_, i) => i !== action.index);
			let activeTabIndex = state.activeTabIndex;
			if (action.index <= activeTabIndex) {
				activeTabIndex = Math.max(0, activeTabIndex - 1);
			}
			if (tabs.length === 0) activeTabIndex = -1;
			return { ...state, tabs, activeTabIndex };
		}

		case "SET_ACTIVE_TAB":
			return { ...state, activeTabIndex: action.index };

		case "TOGGLE_TERMINAL":
			return { ...state, terminalVisible: !state.terminalVisible };

		case "SET_TERMINAL_HEIGHT":
			return { ...state, terminalHeight: action.height };

		case "ADD_TERMINAL_SESSION": {
			const sessions = [...state.terminalSessions, action.session];
			return {
				...state,
				terminalSessions: sessions,
				activeTerminalIndex: sessions.length - 1,
				terminalVisible: true,
			};
		}

		case "REMOVE_TERMINAL_SESSION": {
			const sessions = state.terminalSessions.filter((s) => s.id !== action.id);
			let activeTerminalIndex = state.activeTerminalIndex;
			const removedIdx = state.terminalSessions.findIndex((s) => s.id === action.id);
			if (removedIdx <= activeTerminalIndex) {
				activeTerminalIndex = Math.max(0, activeTerminalIndex - 1);
			}
			if (sessions.length === 0) activeTerminalIndex = -1;
			return { ...state, terminalSessions: sessions, activeTerminalIndex };
		}

		case "SET_ACTIVE_TERMINAL":
			return { ...state, activeTerminalIndex: action.index };

		case "UPDATE_TERMINAL_SESSION": {
			const sessions = state.terminalSessions.map((s) =>
				s.id === action.id ? { ...s, ...action.updates } : s,
			);
			return { ...state, terminalSessions: sessions };
		}

		case "SET_PROGRAMS":
			return { ...state, programs: action.programs };

		case "SET_WORKSPACE_NAME":
			return { ...state, workspaceName: action.name };

		case "SET_GIT_STATUS": {
			const gs = action.gitStatus;
			return {
				...state,
				gitStatus: gs,
				gitBranch: gs.branch,
				gitDirty: gs.staged.length > 0 || gs.unstaged.length > 0 || gs.untracked.length > 0,
			};
		}

		case "SET_AGENTS":
			return { ...state, agents: action.agents };

		case "SHOW_SPAWN_DIALOG":
			return { ...state, showSpawnDialog: true };

		case "HIDE_SPAWN_DIALOG":
			return { ...state, showSpawnDialog: false };

		default:
			return state;
	}
}

// --- Context ---

interface WorkspaceContext {
	state: WorkspaceState;
	dispatch: React.Dispatch<Action>;
	openProgram: (program: ProgramJson) => void;
	openGraph: () => void;
	openFile: (
		programId: string,
		filePath: string,
		source: "track" | "config" | "workspace",
		label: string,
	) => void;
	openMarkdown: (id: string, label: string, content: string) => void;
	openTerminal: (name?: string, cwd?: string) => void;
}

const Ctx = createContext<WorkspaceContext | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(reducer, initialState);

	const openProgram = useCallback(
		(program: ProgramJson) => {
			const tab: Tab = {
				id: `program-${program.id}`,
				type: "program-overview",
				label: program.name,
				data: { programId: program.id },
			};
			dispatch({ type: "OPEN_TAB", tab });
			dispatch({ type: "SELECT_SIDEBAR_ITEM", id: program.id });
		},
		[dispatch],
	);

	const openGraph = useCallback(() => {
		const tab: Tab = {
			id: "graph",
			type: "graph",
			label: "Graph",
			data: {},
		};
		dispatch({ type: "OPEN_TAB", tab });
	}, [dispatch]);

	const openFile = useCallback(
		(
			programId: string,
			filePath: string,
			source: "track" | "config" | "workspace",
			label: string,
		) => {
			const tab: Tab = {
				id: `file-${source}-${programId}-${filePath}`,
				type: "file-viewer",
				label,
				data: { programId, filePath, fileSource: source },
			};
			dispatch({ type: "OPEN_TAB", tab });
		},
		[dispatch],
	);

	const openMarkdown = useCallback(
		(id: string, label: string, content: string) => {
			const tab: Tab = {
				id: `md-${id}`,
				type: "markdown",
				label,
				data: { content },
			};
			dispatch({ type: "OPEN_TAB", tab });
		},
		[dispatch],
	);

	const openTerminal = useCallback(
		(name?: string, cwd?: string) => {
			// This is a signal — the actual session creation happens in TerminalPanel
			const sessionName = name || `Terminal ${state.terminalSessions.length + 1}`;
			dispatch({
				type: "ADD_TERMINAL_SESSION",
				session: {
					id: `pending-${Date.now()}`,
					name: sessionName,
					cwd,
					status: "running",
				},
			});
		},
		[dispatch, state.terminalSessions.length],
	);

	// Listen for keyboard shortcuts
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const meta = e.metaKey || e.ctrlKey;

			// Cmd+B: toggle sidebar
			if (meta && e.key === "b") {
				e.preventDefault();
				dispatch({ type: "TOGGLE_SIDEBAR" });
			}
			// Ctrl+`: toggle terminal
			if (e.ctrlKey && e.key === "`") {
				e.preventDefault();
				dispatch({ type: "TOGGLE_TERMINAL" });
			}
			// Cmd+W: close tab
			if (meta && e.key === "w") {
				e.preventDefault();
				if (state.activeTabIndex >= 0) {
					dispatch({ type: "CLOSE_TAB", index: state.activeTabIndex });
				}
			}
			// Cmd+Shift+G: open graph
			if (meta && e.shiftKey && e.key === "G") {
				e.preventDefault();
				openGraph();
			}
			// Cmd+P: handled by CommandPalette component directly
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [state.activeTabIndex, openGraph]);

	return (
		<Ctx.Provider
			value={{ state, dispatch, openProgram, openGraph, openFile, openMarkdown, openTerminal }}
		>
			{children}
		</Ctx.Provider>
	);
}

export function useWorkspace(): WorkspaceContext {
	const ctx = useContext(Ctx);
	if (!ctx) throw new Error("useWorkspace must be inside WorkspaceProvider");
	return ctx;
}
