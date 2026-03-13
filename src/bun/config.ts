// Centralized workspace configuration — single source of truth for all paths
//
// Reads from preferences (lastWorkspacePath) → meta.json → resolved paths.
// All backend modules import from here instead of hardcoding paths.

import fs from "node:fs";
import path from "node:path";

export const HOME = process.env.HOME || "";

interface MetaJson {
	version: number;
	name: string;
	programs: string[];
	codeRoot?: string;
	tracksDir?: string;
	findingsDir?: string;
	logsDir?: string;
}

export interface WorkspaceConfig {
	researchDir: string; // absolute path to workspace (meta.json location)
	codeRoot: string; // absolute path to source code repo
	tracksDir: string; // absolute path to tracks dir (usually inside codeRoot)
	logsDir: string; // absolute path to logs dir (CSV step logs)
	findingsDir: string; // absolute path to findings dir
	name: string;
}

export function resolveTilde(p: string): string {
	if (p.startsWith("~/")) return path.join(HOME, p.slice(2));
	return p;
}

function readPrefsLastWorkspace(): string | null {
	try {
		const prefsFile = path.join(HOME, ".config", "llamalab", "preferences.json");
		if (!fs.existsSync(prefsFile)) return null;
		const prefs = JSON.parse(fs.readFileSync(prefsFile, "utf-8"));
		return prefs.lastWorkspacePath || null;
	} catch {
		return null;
	}
}

function readMeta(researchDir: string): MetaJson | null {
	try {
		const metaPath = path.join(researchDir, "meta.json");
		if (!fs.existsSync(metaPath)) return null;
		return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as MetaJson;
	} catch {
		return null;
	}
}

// Returns null if no workspace is configured yet (triggers setup wizard)
export function getWorkspaceConfig(): WorkspaceConfig | null {
	const researchDir = readPrefsLastWorkspace();
	if (!researchDir) return null;
	if (!fs.existsSync(path.join(researchDir, "meta.json"))) return null;

	const meta = readMeta(researchDir);
	if (!meta) return null;

	const codeRoot = resolveTilde(meta.codeRoot || "");
	if (!codeRoot) return null;

	return {
		researchDir,
		codeRoot,
		tracksDir: meta.tracksDir
			? resolveTilde(meta.tracksDir)
			: path.join(codeRoot, "tracks"),
		logsDir: meta.logsDir
			? path.resolve(researchDir, meta.logsDir)
			: path.join(codeRoot, "logs"),
		findingsDir: meta.findingsDir
			? path.resolve(researchDir, meta.findingsDir)
			: path.join(researchDir, "findings"),
		name: meta.name || "Research Workspace",
	};
}

// Require a configured workspace or throw
export function requireWorkspaceConfig(): WorkspaceConfig {
	const config = getWorkspaceConfig();
	if (!config) throw new Error("No workspace configured. Run the setup wizard first.");
	return config;
}
