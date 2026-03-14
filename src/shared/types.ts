import type { RPCSchema } from "electrobun/bun";

// --- Sidebar view type ---

export type SidebarView = "research" | "explorer";

// --- Data types (ported from api.server) ---

export interface ProgramJson {
	id: string;
	name: string;
	status: string;
	description: string;
	findingsDoc?: string;
	script?: string;
	metric?: string;
	metricDirection?: string;
	baselineMetric?: number | null;
	relationships?: Array<{ target: string; type: string }>;
	createdAt?: string;
	tags?: string[];
	metrics?: Record<string, unknown>;
}

export interface QueueItem {
	label: string;
	config: Record<string, unknown>;
	priority?: number;
	budget_seconds?: number;
	env_overrides?: Record<string, string>;
}

export interface QueueJson {
	queue: QueueItem[];
	completed: string[];
}

export interface ProgramDetail extends ProgramJson {
	finding: string | null;
	track: TrackJson | null;
	results: ExperimentResult[];
	queue: QueueJson | null;
}

export interface TrackJson {
	id: string;
	name: string;
	script: string;
	eval_script?: string | null;
	metric: string;
	metric_direction: string;
	budget_seconds: number;
	baseline_metric: number | null;
	base_checkpoint?: string | null;
	config_space: Record<string, unknown>;
	fixed_args?: string[];
	env_overrides?: Record<string, string>;
	findings_doc?: string;
}

export interface ExperimentResult {
	track_id: string;
	experiment_id: string;
	config: Record<string, unknown>;
	metric_value: number;
	baseline_value: number;
	delta: number;
	status: string;
	duration_seconds: number;
	timestamp: string;
	machine?: string;
	checkpoint?: string;
	log_csv?: string;
	extras?: Record<string, unknown>;
}

export interface FileEntry {
	name: string;
	path: string;
	size: number;
	isDir: boolean;
	children?: FileEntry[];
}

export interface GraphNode {
	id: string;
	type: string;
	data: Record<string, unknown>;
	position: { x: number; y: number };
}

export interface GraphEdge {
	id: string;
	source: string;
	target: string;
	label?: string;
	data?: Record<string, unknown>;
}

export interface GraphData {
	nodes: GraphNode[];
	edges: GraphEdge[];
}

export interface WorkspaceDetail {
	name: string;
	codeRoot: string;
	tracksDir: string;
	readme: string | null;
	programMd: string | null;
	workspaceReadme: string | null;
}

export interface CreateProgramInput {
	id: string;
	name: string;
	description?: string;
	baseTrackId?: string; // existing program to branch from (copies track files)
	tags?: string[];
	metric?: string;
	metricDirection?: string;
}

// --- Chart types ---

export interface ChartMeta {
	id: string;
	label: string;
	source: "csv" | "tsv" | "json";
	filePath: string;
	columns: string[];
	defaultX: string;
	defaultY: string[];
	chartType: "line" | "bar";
}

export interface ChartPoint {
	x: number;
	y: number;
	label?: string;
}

export interface ChartSeries {
	label: string;
	points: ChartPoint[];
}

export interface ChartDataset {
	title: string;
	xLabel: string;
	yLabel: string;
	chartType: "line" | "bar";
	series: ChartSeries[];
	labels?: string[]; // for bar charts — category labels
}

export interface ExperimentSummary {
	label: string;
	metric?: number;
	paramsM?: number;
	tokensM?: number;
	mfu?: number;
	vramMb?: number;
	description: string;
	source: string;
}

// --- Git types ---

export interface GitStatus {
	branch: string;
	ahead: number;
	behind: number;
	staged: string[];
	unstaged: string[];
	untracked: string[];
}

export interface GitLogEntry {
	hash: string;
	shortHash: string;
	author: string;
	date: string;
	message: string;
}

// --- Agent types ---

export type AgentType = "claude" | "codex" | "openclaw" | "hermes";

export interface AgentInfo {
	name: string;
	type: AgentType;
	programId?: string;
	task: string;
	status: "spawning" | "running" | "completed" | "failed";
	startedAt: string;
	sessionId?: string;
}

// --- RPC Schema ---

export type AppRPC = {
	bun: RPCSchema<{
		requests: {
			// Programs
			getPrograms: { params: {}; response: ProgramJson[] };
			getProgram: { params: { id: string }; response: ProgramDetail };
			createProgram: {
				params: CreateProgramInput;
				response: ProgramJson;
			};
			updateProgram: {
				params: { id: string; updates: Partial<ProgramJson> };
				response: ProgramJson;
			};

			// Graph
			getGraph: { params: {}; response: GraphData };

			// Files
			getFileTree: {
				params: { programId: string };
				response: { trackFiles: FileEntry[]; configFiles: FileEntry[] };
			};
			readFile: {
				params: {
					programId: string;
					filePath: string;
					source: "track" | "config";
				};
				response: { content: string; size: number };
			};
			writeFile: {
				params: {
					programId: string;
					filePath: string;
					content: string;
					source: "track" | "config";
				};
				response: { ok: boolean };
			};

			// Workspace
			getWorkspace: { params: {}; response: WorkspaceDetail };
			getWorkspaceFiles: { params: {}; response: FileEntry[] };
			readWorkspaceFile: {
				params: { filePath: string };
				response: { content: string; size: number };
			};
			writeWorkspaceFile: {
				params: { filePath: string; content: string };
				response: { ok: boolean };
			};

			// Git
			gitStatus: {
				params: {};
				response: GitStatus;
			};
			gitLog: {
				params: { count: number };
				response: GitLogEntry[];
			};
			gitDiff: {
				params: { path?: string };
				response: string;
			};
			gitAdd: {
				params: { paths: string[] };
				response: void;
			};
			gitCommit: {
				params: { message: string };
				response: { hash: string };
			};
			gitPush: {
				params: {};
				response: void;
			};
			gitBranches: {
				params: {};
				response: { current: string; branches: string[] };
			};
			gitCheckout: {
				params: { branch: string };
				response: void;
			};

			// Charts
			listCharts: {
				params: {};
				response: ChartMeta[];
			};
			getChartData: {
				params: { id: string; xCol?: string; yCols?: string[] };
				response: ChartDataset;
			};
			getOverlayChart: {
				params: { logIds: string[]; xCol?: string; yCol?: string };
				response: ChartDataset;
			};
			getExperimentSummaries: {
				params: {};
				response: ExperimentSummary[];
			};

			// Terminal
			startTerminal: {
				params: { cwd?: string; cols: number; rows: number; name?: string };
				response: { sessionId: string };
			};
			resizeTerminal: {
				params: { sessionId: string; cols: number; rows: number };
				response: void;
			};
			killTerminal: {
				params: { sessionId: string };
				response: void;
			};

			// Agents
			spawnAgent: {
				params: { type: AgentType; programId?: string; task: string };
				response: { name: string; sessionId: string };
			};
			listAgents: {
				params: {};
				response: AgentInfo[];
			};
			getAgentLog: {
				params: { name: string };
				response: { content: string };
			};
			killAgent: {
				params: { name: string };
				response: void;
			};
			checkAgentAvailability: {
				params: {};
				response: Record<AgentType, boolean>;
			};
			getDefaultTask: {
				params: { programId: string };
				response: { task: string };
			};

			// Settings
			getSettings: {
				params: {};
				response: { defaultAgentType: AgentType; availableAgents: Record<AgentType, boolean> };
			};
			updateSettings: {
				params: { defaultAgentType?: AgentType };
				response: void;
			};

			// Window
			toggleMaximize: {
				params: {};
				response: { maximized: boolean };
			};

			// Setup / workspace management
			checkSetup: {
				params: {};
				response: { configured: boolean; workspacePath?: string };
			};
			setupWorkspace: {
				params: {
					workspacePath: string;
					workspaceName: string;
					repoUrl: string;
					clonePath: string;
				};
				response: { ok: boolean; error?: string };
			};
			openWorkspace: {
				params: { path: string };
				response: { ok: boolean; name: string; path: string };
			};
			getRecentWorkspaces: {
				params: {};
				response: { path: string; name: string; lastOpened: string }[];
			};

			// System
			revealInFinder: { params: { path: string }; response: void };
		};
		messages: {
			// Bun -> Renderer push notifications
			fileChanged: { programId: string; filePath: string };
			programsChanged: {};
			menuAction: { action: string };
			terminalOutput: { sessionId: string; data: string };
			terminalExit: { sessionId: string; code: number };
		};
	}>;
	webview: RPCSchema<{
		requests: {};
		messages: {
			// Renderer -> Bun fire-and-forget
			terminalInput: { sessionId: string; data: string };
		};
	}>;
};
