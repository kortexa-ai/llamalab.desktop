// Agent spawning — manages AI agents via tmux sessions

import fs from "node:fs";
import path from "node:path";
import type { AgentType, AgentInfo } from "../shared/types";
import { buildMission } from "./prompt-builder";
import { HOME, requireWorkspaceConfig } from "./config";

const HERD_DIR = path.join(HOME, ".claude-herd");
const HERD_LOG = path.join(HERD_DIR, "log");
const ANIMALS_DIR = path.join(HERD_DIR, "animals");

const AGENT_TYPES: AgentType[] = ["claude", "codex", "openclaw", "hermes"];

function buildAgentShellCmd(type: AgentType, missionPath: string, cwd: string): string {
	const prompt = `Read ${missionPath} and complete the mission described within.`;
	switch (type) {
		case "claude":
			return `cd ${cwd} && claude --dangerously-skip-permissions -p "${prompt}"`;
		case "codex":
			return `cd ${cwd} && codex --yolo -q "${prompt}"`;
		case "openclaw":
			return `cd ${cwd} && openclaw agent --prompt "${prompt}"`;
		case "hermes":
			return `cd ${cwd} && hermes run --prompt "${prompt}"`;
	}
}

function generateAnimalName(): string {
	const adjectives = [
		"swift", "bold", "keen", "wise", "calm", "dark", "pale",
		"wild", "cold", "warm", "deep", "high", "low", "far",
	];
	const animals = [
		"fox", "owl", "elk", "ram", "jay", "bee", "ant",
		"bat", "cod", "emu", "gnu", "hen", "yak", "asp",
	];
	const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
	const animal = animals[Math.floor(Math.random() * animals.length)];
	const num = Math.floor(Math.random() * 100);
	return `${adj}-${animal}-${num}`;
}

async function runCommand(cmd: string[]): Promise<string> {
	const proc = Bun.spawn(cmd, {
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdout = await new Response(proc.stdout).text();
	await proc.exited;
	return stdout.trim();
}

export async function checkAgentAvailability(): Promise<Record<AgentType, boolean>> {
	const result = {} as Record<AgentType, boolean>;
	for (const type of AGENT_TYPES) {
		try {
			const proc = Bun.spawn(["which", type], {
				stdout: "pipe",
				stderr: "pipe",
			});
			const code = await proc.exited;
			result[type] = code === 0;
		} catch {
			result[type] = false;
		}
	}
	return result;
}

export async function spawnAgent(opts: {
	type: AgentType;
	programId?: string;
	task: string;
}): Promise<{ name: string; sessionId: string }> {
	const name = generateAnimalName();
	const sessionId = `llamalab-${name}`;

	// Ensure directories exist
	fs.mkdirSync(ANIMALS_DIR, { recursive: true });

	// Build mission file
	const { missionPath } = buildMission({
		agentType: opts.type,
		programId: opts.programId,
		task: opts.task,
	});

	// Determine cwd: trackDir for program-scoped, codeRoot for workspace-scoped
	const config = requireWorkspaceConfig();
	const cwd = opts.programId
		? path.join(config.tracksDir, opts.programId)
		: config.codeRoot;

	const logFile = path.join(ANIMALS_DIR, `${name}.log`);
	const shellCmd = `${buildAgentShellCmd(opts.type, missionPath, cwd)} 2>&1 | tee ${logFile}`;

	// Spawn in tmux
	const tmuxCmd = [
		"tmux", "new-session", "-d", "-s", sessionId,
		"bash", "-c", shellCmd,
	];

	const proc = Bun.spawn(tmuxCmd, {
		stdout: "pipe",
		stderr: "pipe",
	});
	await proc.exited;

	// Register in herd log
	const entry: AgentInfo = {
		name,
		type: opts.type,
		programId: opts.programId,
		task: opts.task,
		status: "running",
		startedAt: new Date().toISOString(),
		sessionId,
	};

	// Append to log file (one JSON per line)
	fs.appendFileSync(HERD_LOG, JSON.stringify(entry) + "\n", "utf-8");

	return { name, sessionId };
}

export async function listAgents(): Promise<AgentInfo[]> {
	if (!fs.existsSync(HERD_LOG)) return [];

	const lines = fs.readFileSync(HERD_LOG, "utf-8").trim().split("\n").filter(Boolean);
	const agents: AgentInfo[] = [];

	// Get running tmux sessions
	let tmuxSessions = new Set<string>();
	try {
		const raw = await runCommand(["tmux", "list-sessions", "-F", "#{session_name}"]);
		tmuxSessions = new Set(raw.split("\n").filter(Boolean));
	} catch {
		// tmux not running or no sessions
	}

	for (const line of lines) {
		try {
			const agent = JSON.parse(line) as AgentInfo;
			// Only include llamalab agents
			if (!agent.sessionId?.startsWith("llamalab-")) continue;

			// Update status based on tmux
			if (agent.status === "running" && !tmuxSessions.has(agent.sessionId)) {
				agent.status = "completed";
			}
			agents.push(agent);
		} catch {
			// skip malformed lines
		}
	}

	// Deduplicate by name (keep latest)
	const byName = new Map<string, AgentInfo>();
	for (const a of agents) byName.set(a.name, a);
	return Array.from(byName.values()).reverse();
}

export async function getAgentLog(name: string): Promise<{ content: string }> {
	const logFile = path.join(ANIMALS_DIR, `${name}.log`);
	try {
		if (!fs.existsSync(logFile)) return { content: "(no log yet)" };
		const content = fs.readFileSync(logFile, "utf-8");
		// Return last 10000 chars to keep it manageable
		return { content: content.length > 10000 ? content.slice(-10000) : content };
	} catch {
		return { content: "(error reading log)" };
	}
}

export async function killAgent(name: string): Promise<void> {
	const sessionId = `llamalab-${name}`;
	try {
		const proc = Bun.spawn(["tmux", "kill-session", "-t", sessionId], {
			stdout: "pipe",
			stderr: "pipe",
		});
		await proc.exited;
	} catch {
		// session may already be dead
	}
}
