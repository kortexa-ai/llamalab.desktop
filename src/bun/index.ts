import {
	BrowserWindow,
	BrowserView,
	Tray,
	ApplicationMenu,
	Updater,
} from "electrobun/bun";
import Electrobun from "electrobun/bun";
import type { AppRPC } from "../shared/types";
import {
	getAllPrograms,
	getProgramDetail,
	createProgram,
	updateProgram,
	buildGraph,
	getFileTree,
	readProgramFile,
	writeProgramFile,
	getWorkspace,
	getWorkspaceFiles,
	readWorkspaceFile,
	writeWorkspaceFile,
	watchResearchDir,
} from "./research";
import { TerminalManager } from "./terminal";
import {
	gitStatus,
	gitLog,
	gitDiff,
	gitAdd,
	gitCommit,
	gitPush,
	gitBranches,
	gitCheckout,
} from "./git";
import {
	spawnAgent,
	listAgents,
	getAgentLog,
	killAgent,
} from "./agents";
import {
	listExperimentLogs,
	getChartData,
	getOverlayChart,
	getExperimentSummaries,
} from "./charts";
import {
	checkSetup,
	setupWorkspace,
	openWorkspace,
	getRecentWorkspaces,
} from "./workspace";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

// --- Terminal manager ---
const terminalManager = new TerminalManager();

// --- RPC handlers ---
const rpc = BrowserView.defineRPC<AppRPC>({
	handlers: {
		requests: {
			// Programs
			getPrograms: async () => getAllPrograms(),
			getProgram: async ({ id }) => {
				const detail = getProgramDetail(id);
				if (!detail) throw new Error("Program not found");
				return detail;
			},
			createProgram: async (params) => createProgram(params),
			updateProgram: async ({ id, updates }) => updateProgram(id, updates),

			// Graph
			getGraph: async () => buildGraph(),

			// Files
			getFileTree: async ({ programId }) => getFileTree(programId),
			readFile: async ({ programId, filePath, source }) =>
				readProgramFile(programId, filePath, source),
			writeFile: async ({ programId, filePath, content, source }) =>
				writeProgramFile(programId, filePath, content, source),

			// Workspace
			getWorkspace: async () => getWorkspace(),
			getWorkspaceFiles: async () => getWorkspaceFiles(),
			readWorkspaceFile: async ({ filePath }) => readWorkspaceFile(filePath),
			writeWorkspaceFile: async ({ filePath, content }) =>
				writeWorkspaceFile(filePath, content),

			// Git
			gitStatus: async () => gitStatus(),
			gitLog: async ({ count }) => gitLog(count),
			gitDiff: async ({ path }) => gitDiff(path),
			gitAdd: async ({ paths }) => { await gitAdd(paths); },
			gitCommit: async ({ message }) => gitCommit(message),
			gitPush: async () => { await gitPush(); },
			gitBranches: async () => gitBranches(),
			gitCheckout: async ({ branch }) => { await gitCheckout(branch); },

			// Charts
			listCharts: async () => listExperimentLogs(),
			getChartData: async (params) => getChartData(params),
			getOverlayChart: async (params) => getOverlayChart(params),
			getExperimentSummaries: async () => getExperimentSummaries(),

			// Terminal
			startTerminal: async (params) => terminalManager.start(params),
			resizeTerminal: async ({ sessionId, cols, rows }) => {
				terminalManager.resize(sessionId, cols, rows);
			},
			killTerminal: async ({ sessionId }) => {
				terminalManager.kill(sessionId);
			},

			// Agents
			spawnAgent: async (params) => spawnAgent(params),
			listAgents: async () => listAgents(),
			getAgentLog: async ({ name }) => getAgentLog(name),
			killAgent: async ({ name }) => { await killAgent(name); },

			// Setup / workspace management
			checkSetup: async () => checkSetup(),
			setupWorkspace: async (params) => setupWorkspace(params),
			openWorkspace: async ({ path: p }) => openWorkspace(p),
			getRecentWorkspaces: async () => getRecentWorkspaces(),

			// System
			revealInFinder: async ({ path: filePath }) => {
				// Use macOS 'open -R' to reveal in Finder
				Bun.spawn(["open", "-R", filePath]);
			},
		},
		messages: {
			terminalInput: ({ sessionId, data }) => {
				terminalManager.input(sessionId, data);
			},
		},
	},
});

// --- Create window ---
const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
	title: "Llama Lab",
	url,
	frame: {
		width: 1200,
		height: 800,
		x: 100,
		y: 100,
	},
	titleBarStyle: "hiddenInset",
	rpc,
});

// --- Wire terminal RPC messages ---
terminalManager.onOutput = (sessionId, data) => {
	mainWindow.webview.rpc.send.terminalOutput({ sessionId, data });
};
terminalManager.onExit = (sessionId, code) => {
	mainWindow.webview.rpc.send.terminalExit({ sessionId, code });
};

// --- File watcher (only if workspace is configured) ---
import { getWorkspaceConfig } from "./config";

let watchDebounce: ReturnType<typeof setTimeout> | null = null;
if (getWorkspaceConfig()) {
	watchResearchDir((_event, _filename) => {
		// Debounce: batch filesystem changes
		if (watchDebounce) clearTimeout(watchDebounce);
		watchDebounce = setTimeout(() => {
			mainWindow.webview.rpc.send.programsChanged({});
		}, 500);
	});
}

// --- System Tray ---
const tray = new Tray({
	title: "Llama Lab",
});

tray.setMenu([
	{ type: "normal", label: "Show App", action: "show" },
	{ type: "normal", label: "Hide App", action: "hide" },
	{ type: "divider" },
	{ type: "normal", label: "Quit", action: "quit" },
]);

tray.on("tray-clicked", (event: any) => {
	const action = event.data?.action;
	switch (action) {
		case "show":
			mainWindow.focus();
			break;
		case "hide":
			mainWindow.minimize();
			break;
		case "quit":
			terminalManager.killAll();
			tray.remove();
			process.exit(0);
			break;
	}
});

// --- Application Menu ---
ApplicationMenu.setApplicationMenu([
	{
		submenu: [
			{ label: "About Llama Lab", role: "about" },
			{ type: "separator" },
			{ label: "Hide", role: "hide", accelerator: "h" },
			{ label: "Hide Others", role: "hideOthers", accelerator: "Alt+h" },
			{ label: "Show All", role: "showAll" },
			{ type: "separator" },
			{ label: "Quit Llama Lab", role: "quit", accelerator: "q" },
		],
	},
	{
		label: "File",
		submenu: [
			{
				label: "New Workspace...",
				action: "new-workspace",
				accelerator: "CommandOrControl+Shift+N",
			},
			{
				label: "Open Workspace...",
				action: "open-workspace",
				accelerator: "CommandOrControl+Shift+O",
			},
			{ type: "separator" },
			{
				label: "New Program",
				action: "new-program",
				accelerator: "CommandOrControl+N",
			},
			{ type: "separator" },
			{
				label: "Close Tab",
				action: "close-tab",
				accelerator: "CommandOrControl+W",
			},
		],
	},
	{
		label: "View",
		submenu: [
			{
				label: "Toggle Sidebar",
				action: "toggle-sidebar",
				accelerator: "CommandOrControl+B",
			},
			{
				label: "Toggle Terminal",
				action: "toggle-terminal",
				accelerator: "Control+`",
			},
			{ type: "separator" },
			{
				label: "Graph View",
				action: "open-graph",
				accelerator: "CommandOrControl+Shift+G",
			},
		],
	},
	{
		label: "Edit",
		submenu: [
			{ role: "undo" },
			{ role: "redo" },
			{ type: "separator" },
			{ role: "cut" },
			{ role: "copy" },
			{ role: "paste" },
			{ role: "selectAll" },
		],
	},
]);

// Handle menu actions — forward to renderer
Electrobun.events.on("application-menu-clicked", (event: any) => {
	const action = event.data?.action;
	if (action) {
		mainWindow.webview.rpc.send.menuAction({ action });
	}
});

console.log("Llama Lab started!");
