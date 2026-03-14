// Research data layer — direct filesystem access (ported from api.server/routes/research.ts)

import fs from "node:fs";
import path from "node:path";
import type {
	ProgramJson,
	ProgramDetail,
	TrackJson,
	ExperimentResult,
	QueueJson,
	FileEntry,
	GraphNode,
	GraphEdge,
	GraphData,
	WorkspaceDetail,
	CreateProgramInput,
} from "../shared/types";
import { requireWorkspaceConfig } from "./config";

// --- File reading helpers ---

interface MetaJson {
	version: number;
	name?: string;
	programs: string[];
	codeRoot?: string;
	tracksDir?: string;
	findingsDir?: string;
	logsDir?: string;
}

function readJson<T>(filePath: string): T | null {
	try {
		if (!fs.existsSync(filePath)) return null;
		return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
	} catch {
		return null;
	}
}

function readMeta(): MetaJson | null {
	const { researchDir } = requireWorkspaceConfig();
	return readJson<MetaJson>(path.join(researchDir, "meta.json"));
}

// --- Public API ---

export function getAllPrograms(): ProgramJson[] {
	const meta = readMeta();
	if (!meta) return [];

	const programs: ProgramJson[] = [];
	const { researchDir } = requireWorkspaceConfig();
	for (const relPath of meta.programs) {
		const prog = readJson<ProgramJson>(path.join(researchDir, relPath));
		if (prog) programs.push(prog);
	}
	return programs;
}

export function getProgram(id: string): ProgramJson | null {
	const { researchDir } = requireWorkspaceConfig();
	return readJson<ProgramJson>(
		path.join(researchDir, "programs", id, "program.json"),
	);
}

function readFinding(program: ProgramJson): string | null {
	if (!program.findingsDoc) return null;
	const { researchDir } = requireWorkspaceConfig();
	const findingPath = path.join(researchDir, program.findingsDoc);
	try {
		if (!fs.existsSync(findingPath)) return null;
		return fs.readFileSync(findingPath, "utf-8");
	} catch {
		return null;
	}
}

function getTrackDir(programId: string): string {
	const config = requireWorkspaceConfig();
	return path.join(config.tracksDir, programId);
}

function readTrack(program: ProgramJson): TrackJson | null {
	const trackDir = getTrackDir(program.id);
	if (!fs.existsSync(trackDir)) return null;
	return readJson<TrackJson>(path.join(trackDir, "track.json"));
}

function readResults(program: ProgramJson): ExperimentResult[] {
	const trackDir = getTrackDir(program.id);
	const results = readJson<ExperimentResult[]>(
		path.join(trackDir, "results.json"),
	);
	return results || [];
}

function readQueue(program: ProgramJson): QueueJson | null {
	const trackDir = getTrackDir(program.id);
	return readJson<QueueJson>(path.join(trackDir, "queue.json"));
}

export function getProgramDetail(id: string): ProgramDetail | null {
	const program = getProgram(id);
	if (!program) return null;

	return {
		...program,
		finding: readFinding(program),
		track: readTrack(program),
		results: readResults(program),
		queue: readQueue(program),
	};
}

// --- Program creation/update ---

export function createProgram(input: CreateProgramInput): ProgramJson {
	const { id, name, description, baseTrackId, tags, metric, metricDirection } =
		input;
	const config = requireWorkspaceConfig();

	if (!id || !name) throw new Error("id and name are required");
	if (!/^[a-z0-9-]+$/.test(id))
		throw new Error("id must be lowercase alphanumeric with dashes");

	const programDir = path.join(config.researchDir, "programs", id);
	if (fs.existsSync(path.join(programDir, "program.json")))
		throw new Error("Program already exists");

	const relationships: Array<{ target: string; type: string }> = [];
	if (baseTrackId) {
		relationships.push({ target: baseTrackId, type: "uses_base_model" });
	}

	const program: ProgramJson = {
		id,
		name,
		status: "planning",
		description: description || "",
		findingsDoc: `findings/${id}.md`,
		script: `${id.replace(/-/g, "_")}_train.py`,
		metric: metric || "loss",
		metricDirection: metricDirection || "minimize",
		baselineMetric: null,
		relationships,
		createdAt: new Date().toISOString().split("T")[0],
		tags: tags || [],
	};

	// Write program.json
	fs.mkdirSync(programDir, { recursive: true });
	fs.writeFileSync(
		path.join(programDir, "program.json"),
		JSON.stringify(program, null, 2),
	);

	// Create track directory (track ID = program ID)
	const trackDir = path.join(config.tracksDir, id);
	fs.mkdirSync(trackDir, { recursive: true });

	// If branching from a base track, copy its files as a starting point
	if (baseTrackId) {
		const baseDir = getTrackDir(baseTrackId);
		if (fs.existsSync(baseDir)) {
			copyDirRecursive(baseDir, trackDir);
		}
	}

	// Write track.json (overwrites any copied one with new program's config)
	const track: TrackJson = {
		id,
		name,
		script: program.script || "train.py",
		eval_script: null,
		metric: program.metric || "loss",
		metric_direction: program.metricDirection || "minimize",
		budget_seconds: 300,
		baseline_metric: null,
		base_checkpoint: null,
		config_space: {},
		fixed_args: [],
		findings_doc: `findings/${id}.md`,
	};
	fs.writeFileSync(
		path.join(trackDir, "track.json"),
		JSON.stringify(track, null, 2),
	);

	// Update meta.json
	const meta = readMeta();
	if (meta) {
		const relPath = `programs/${id}/program.json`;
		if (!meta.programs.includes(relPath)) {
			meta.programs.push(relPath);
			fs.writeFileSync(
				path.join(config.researchDir, "meta.json"),
				JSON.stringify(meta, null, 2),
			);
		}
	}

	return program;
}

export function updateProgram(
	id: string,
	updates: Partial<ProgramJson>,
): ProgramJson {
	const program = getProgram(id);
	if (!program) throw new Error("Program not found");

	const { researchDir } = requireWorkspaceConfig();
	const merged = { ...program, ...updates, id: program.id };
	const programPath = path.join(
		researchDir,
		"programs",
		id,
		"program.json",
	);
	fs.writeFileSync(programPath, JSON.stringify(merged, null, 2));
	return merged;
}

// --- Graph builder ---

const RELATIONSHIP_LABELS: Record<string, string> = {
	base_model: "base model",
	uses_base_model: "uses base model",
	enables: "enables",
	provides_vision: "provides vision",
	receives_vision: "receives vision",
	extends: "extends",
	feeds_into: "feeds into",
	composition: "composition",
	can_be_conditioned_by: "conditioned by",
};

export function buildGraph(): GraphData {
	const nodes: GraphNode[] = [];
	const edges: GraphEdge[] = [];
	const programs = getAllPrograms();
	const programIds = new Set(programs.map((p) => p.id));
	const meta = readMeta();

	const config = requireWorkspaceConfig();
	// Workspace root node
	nodes.push({
		id: "workspace",
		type: "workspace",
		data: {
			label: config.name,
			codeRoot: meta?.codeRoot || config.codeRoot,
		},
		position: { x: 0, y: 0 },
	});

	const hierarchyTargets = new Set<string>();

	for (const program of programs) {
		const programNodeId = `program-${program.id}`;

		nodes.push({
			id: programNodeId,
			type: "program",
			data: {
				label: program.name,
				status: program.status,
				description: program.description,
				programId: program.id,
				tags: program.tags,
				metric: program.metric,
				baselineMetric: program.baselineMetric,
				metrics: program.metrics,
			},
			position: { x: 0, y: 0 },
		});

		if (program.relationships) {
			for (const rel of program.relationships) {
				const targetNodeId = `program-${rel.target}`;
				if (!programIds.has(rel.target)) continue;

				const edgeId = `rel-${program.id}-${rel.target}-${rel.type}`;
				if (edges.some((e) => e.id === edgeId)) continue;

				edges.push({
					id: edgeId,
					source: programNodeId,
					target: targetNodeId,
					label:
						RELATIONSHIP_LABELS[rel.type] || rel.type.replace(/_/g, " "),
					data: { type: rel.type },
				});

				if (
					["base_model", "enables", "provides_vision", "feeds_into"].includes(
						rel.type,
					)
				) {
					hierarchyTargets.add(rel.target);
				}
			}
		}
	}

	// Connect workspace to root programs
	for (const program of programs) {
		if (!hierarchyTargets.has(program.id)) {
			edges.push({
				id: `workspace-${program.id}`,
				source: "workspace",
				target: `program-${program.id}`,
				data: { type: "contains" },
			});
		}
	}

	return { nodes, edges };
}

// --- File operations ---

const SKIP_DIRS = new Set([".git", "__pycache__", ".venv", "node_modules"]);
// Files to skip when branching a track (results are per-experiment, not inherited)
const SKIP_BRANCH_FILES = new Set(["results.json"]);

function copyDirRecursive(src: string, dest: string): void {
	const entries = fs.readdirSync(src, { withFileTypes: true });
	for (const entry of entries) {
		if (SKIP_DIRS.has(entry.name)) continue;
		if (SKIP_BRANCH_FILES.has(entry.name)) continue;
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			fs.mkdirSync(destPath, { recursive: true });
			copyDirRecursive(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_READ_SIZE = 2 * 1024 * 1024;
const MAX_DEPTH = 5;

function listFilesRecursive(
	dir: string,
	base: string,
	depth: number,
): FileEntry[] {
	if (depth > MAX_DEPTH) return [];
	const entries: FileEntry[] = [];
	let dirents: fs.Dirent[];
	try {
		dirents = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	for (const dirent of dirents) {
		const fullPath = path.join(dir, dirent.name);
		const relPath = path.join(base, dirent.name);
		if (dirent.isDirectory()) {
			if (SKIP_DIRS.has(dirent.name)) continue;
			const children = listFilesRecursive(fullPath, relPath, depth + 1);
			entries.push({
				name: dirent.name,
				path: relPath,
				size: 0,
				isDir: true,
				children,
			});
		} else {
			try {
				const stat = fs.statSync(fullPath);
				if (stat.size > MAX_FILE_SIZE) continue;
				entries.push({
					name: dirent.name,
					path: relPath,
					size: stat.size,
					isDir: false,
				});
			} catch {
				// Skip files we can't stat
			}
		}
	}
	return entries;
}

function isPathSafe(resolvedPath: string, baseDir: string): boolean {
	const normalized = path.resolve(resolvedPath);
	const normalizedBase = path.resolve(baseDir);
	return (
		normalized.startsWith(normalizedBase + path.sep) ||
		normalized === normalizedBase
	);
}

function resolveSourceDir(
	programId: string,
	source: string,
): string | null {
	if (source === "config") {
		const { researchDir } = requireWorkspaceConfig();
		return path.join(researchDir, "programs", programId);
	}
	return getTrackDir(programId);
}

export function getFileTree(
	programId: string,
): { trackFiles: FileEntry[]; configFiles: FileEntry[] } {
	const program = getProgram(programId);
	if (!program) throw new Error("Program not found");

	let trackFiles: FileEntry[] = [];
	const trackDir = getTrackDir(programId);
	if (fs.existsSync(trackDir)) {
		trackFiles = listFilesRecursive(trackDir, "", 0);
	}

	const { researchDir } = requireWorkspaceConfig();
	const configDir = path.join(researchDir, "programs", programId);
	let configFiles: FileEntry[] = [];
	if (fs.existsSync(configDir)) {
		configFiles = listFilesRecursive(configDir, "", 0);
	}

	return { trackFiles, configFiles };
}

export function readProgramFile(
	programId: string,
	filePath: string,
	source: "track" | "config",
): { content: string; size: number } {
	const baseDir = resolveSourceDir(programId, source);
	if (!baseDir) throw new Error("Cannot resolve base directory");

	const resolvedPath = path.resolve(baseDir, filePath);
	if (!isPathSafe(resolvedPath, baseDir))
		throw new Error("Path traversal not allowed");

	if (!fs.existsSync(resolvedPath)) throw new Error("File not found");

	const stat = fs.statSync(resolvedPath);
	if (stat.size > MAX_READ_SIZE) throw new Error("File too large (max 2MB)");

	const content = fs.readFileSync(resolvedPath, "utf-8");
	return { content, size: stat.size };
}

export function writeProgramFile(
	programId: string,
	filePath: string,
	content: string,
	source: "track" | "config",
): { ok: boolean } {
	const baseDir = resolveSourceDir(programId, source);
	if (!baseDir) throw new Error("Cannot resolve base directory");

	const resolvedPath = path.resolve(baseDir, filePath);
	if (!isPathSafe(resolvedPath, baseDir))
		throw new Error("Path traversal not allowed");

	fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
	fs.writeFileSync(resolvedPath, content, "utf-8");
	return { ok: true };
}

// --- Workspace ---

export function getWorkspace(): WorkspaceDetail {
	const config = requireWorkspaceConfig();

	let readme: string | null = null;
	let programMd: string | null = null;
	try {
		const readmePath = path.join(config.codeRoot, "README.md");
		if (fs.existsSync(readmePath))
			readme = fs.readFileSync(readmePath, "utf-8");
	} catch {
		/* skip */
	}
	try {
		const programMdPath = path.join(config.codeRoot, "program.md");
		if (fs.existsSync(programMdPath))
			programMd = fs.readFileSync(programMdPath, "utf-8");
	} catch {
		/* skip */
	}

	return {
		name: config.name,
		codeRoot: config.codeRoot,
		tracksDir: config.tracksDir,
		readme,
		programMd,
	};
}

export function getWorkspaceFiles(): FileEntry[] {
	const config = requireWorkspaceConfig();

	if (fs.existsSync(config.codeRoot)) {
		return listFilesRecursive(config.codeRoot, "", 0);
	}
	return [];
}

export function readWorkspaceFile(
	filePath: string,
): { content: string; size: number } {
	const { codeRoot } = requireWorkspaceConfig();

	const resolvedPath = path.resolve(codeRoot, filePath);
	if (!isPathSafe(resolvedPath, codeRoot))
		throw new Error("Path traversal not allowed");

	if (!fs.existsSync(resolvedPath)) throw new Error("File not found");

	const stat = fs.statSync(resolvedPath);
	if (stat.size > MAX_READ_SIZE) throw new Error("File too large (max 2MB)");

	const content = fs.readFileSync(resolvedPath, "utf-8");
	return { content, size: stat.size };
}

export function writeWorkspaceFile(
	filePath: string,
	content: string,
): { ok: boolean } {
	const { codeRoot } = requireWorkspaceConfig();

	const resolvedPath = path.resolve(codeRoot, filePath);
	if (!isPathSafe(resolvedPath, codeRoot))
		throw new Error("Path traversal not allowed");

	fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
	fs.writeFileSync(resolvedPath, content, "utf-8");
	return { ok: true };
}

// --- File watcher ---

export function watchResearchDir(
	onChange: (event: string, filename: string | null) => void,
): fs.FSWatcher | null {
	const config = requireWorkspaceConfig();
	try {
		return fs.watch(config.researchDir, { recursive: true }, onChange);
	} catch {
		console.warn("Could not watch research directory:", config.researchDir);
		return null;
	}
}
