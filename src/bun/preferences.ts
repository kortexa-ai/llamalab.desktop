// App preferences — persisted to ~/.config/llamalab/preferences.json

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.HOME || "";
const PREFS_DIR = path.join(HOME, ".config", "llamalab");
const PREFS_FILE = path.join(PREFS_DIR, "preferences.json");

export interface AppPreferences {
	recentWorkspaces: { path: string; name: string; lastOpened: string }[];
	windowState?: {
		x: number;
		y: number;
		width: number;
		height: number;
		sidebarWidth: number;
		terminalHeight: number;
	};
	lastWorkspacePath?: string;
	defaultAgentType?: string;
}

const DEFAULT_PREFS: AppPreferences = {
	recentWorkspaces: [],
};

export function readPreferences(): AppPreferences {
	try {
		if (!fs.existsSync(PREFS_FILE)) return { ...DEFAULT_PREFS };
		const raw = fs.readFileSync(PREFS_FILE, "utf-8");
		return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
	} catch {
		return { ...DEFAULT_PREFS };
	}
}

export function writePreferences(prefs: AppPreferences): void {
	fs.mkdirSync(PREFS_DIR, { recursive: true });
	fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2), "utf-8");
}

export function addRecentWorkspace(wsPath: string, name: string): void {
	const prefs = readPreferences();
	// Remove if already exists
	prefs.recentWorkspaces = prefs.recentWorkspaces.filter(
		(w) => w.path !== wsPath,
	);
	// Add to front
	prefs.recentWorkspaces.unshift({
		path: wsPath,
		name,
		lastOpened: new Date().toISOString(),
	});
	// Keep max 10
	prefs.recentWorkspaces = prefs.recentWorkspaces.slice(0, 10);
	prefs.lastWorkspacePath = wsPath;
	writePreferences(prefs);
}

export function saveWindowState(state: AppPreferences["windowState"]): void {
	const prefs = readPreferences();
	prefs.windowState = state;
	writePreferences(prefs);
}

export function getDefaultAgentType(): string {
	const prefs = readPreferences();
	return prefs.defaultAgentType || "claude";
}

export function setDefaultAgentType(agentType: string): void {
	const prefs = readPreferences();
	prefs.defaultAgentType = agentType;
	writePreferences(prefs);
}
