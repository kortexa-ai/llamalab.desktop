// Workspace management — create, open, validate workspaces

import fs from "node:fs";
import path from "node:path";
import { addRecentWorkspace, readPreferences } from "./preferences";
import { HOME } from "./config";

interface MetaJson {
	version: number;
	name: string;
	programs: string[];
	codeRoot?: string;
	tracksDir?: string;
	findingsDir?: string;
	logsDir?: string;
}

export function createWorkspace(
	wsPath: string,
	name: string,
	codeRoot?: string,
): { ok: boolean; path: string } {
	const resolved = wsPath.startsWith("~/")
		? path.join(HOME, wsPath.slice(2))
		: path.resolve(wsPath);

	// Create directory structure (mkdirSync with recursive is safe — no-op if exists)
	fs.mkdirSync(resolved, { recursive: true });
	fs.mkdirSync(path.join(resolved, "programs"), { recursive: true });
	fs.mkdirSync(path.join(resolved, "findings"), { recursive: true });
	fs.mkdirSync(path.join(resolved, "logs"), { recursive: true });

	// Convert codeRoot to tilde notation for portability
	const codeRootTilde = codeRoot
		? (codeRoot.startsWith(HOME) ? "~/" + path.relative(HOME, codeRoot) : codeRoot)
		: undefined;
	const tracksTilde = codeRootTilde ? `${codeRootTilde}/tracks` : undefined;

	const metaPath = path.join(resolved, "meta.json");

	// If meta.json already exists, update it (preserve programs list) — don't overwrite
	if (fs.existsSync(metaPath)) {
		try {
			const existing = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as MetaJson;
			existing.name = name;
			if (codeRootTilde) existing.codeRoot = codeRootTilde;
			if (tracksTilde) existing.tracksDir = tracksTilde;
			fs.writeFileSync(metaPath, JSON.stringify(existing, null, 2));
			addRecentWorkspace(resolved, name);
			return { ok: true, path: resolved };
		} catch {
			// corrupt meta.json — fall through and create fresh
		}
	}

	// Create fresh meta.json
	const meta: MetaJson = {
		version: 1,
		name,
		programs: [],
		codeRoot: codeRootTilde,
		tracksDir: tracksTilde,
		findingsDir: "findings",
		logsDir: "logs",
	};
	fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

	addRecentWorkspace(resolved, name);
	return { ok: true, path: resolved };
}

export function openWorkspace(wsPath: string): {
	ok: boolean;
	name: string;
	path: string;
} {
	const resolved = wsPath.startsWith("~/")
		? path.join(HOME, wsPath.slice(2))
		: path.resolve(wsPath);

	const metaPath = path.join(resolved, "meta.json");
	if (!fs.existsSync(metaPath)) {
		throw new Error("Not a valid workspace: meta.json not found");
	}

	const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as MetaJson;
	addRecentWorkspace(resolved, meta.name);
	return { ok: true, name: meta.name, path: resolved };
}

export function getRecentWorkspaces(): {
	path: string;
	name: string;
	lastOpened: string;
}[] {
	const prefs = readPreferences();
	return prefs.recentWorkspaces;
}

// --- Setup wizard ---

export function checkSetup(): { configured: boolean; workspacePath?: string } {
	const prefs = readPreferences();
	if (!prefs.lastWorkspacePath) return { configured: false };

	const metaPath = path.join(prefs.lastWorkspacePath, "meta.json");
	if (!fs.existsSync(metaPath)) return { configured: false };

	return { configured: true, workspacePath: prefs.lastWorkspacePath };
}

export async function setupWorkspace(opts: {
	workspacePath: string;
	workspaceName: string;
	repoUrl: string;
	clonePath: string;
}): Promise<{ ok: boolean; error?: string }> {
	try {
		// Resolve paths
		const wsPath = opts.workspacePath.startsWith("~/")
			? path.join(HOME, opts.workspacePath.slice(2))
			: path.resolve(opts.workspacePath);
		const clonePath = opts.clonePath.startsWith("~/")
			? path.join(HOME, opts.clonePath.slice(2))
			: path.resolve(opts.clonePath);

		// Clone the repo if it doesn't exist
		if (!fs.existsSync(clonePath)) {
			fs.mkdirSync(path.dirname(clonePath), { recursive: true });
			const proc = Bun.spawn(["git", "clone", opts.repoUrl, clonePath], {
				stdout: "pipe",
				stderr: "pipe",
			});
			const exitCode = await proc.exited;
			if (exitCode !== 0) {
				const stderr = await new Response(proc.stderr).text();
				return { ok: false, error: `Git clone failed: ${stderr.trim()}` };
			}
		}

		// Create the workspace scaffolding
		createWorkspace(wsPath, opts.workspaceName, clonePath);

		return { ok: true };
	} catch (err) {
		return { ok: false, error: String(err) };
	}
}
