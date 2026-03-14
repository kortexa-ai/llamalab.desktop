// Agent spawning — manages AI agents via tmux sessions

import fs from "node:fs";
import path from "node:path";
import type { AgentType, AgentInfo } from "../shared/types";
import { buildMission } from "./prompt-builder";
import { HOME, requireWorkspaceConfig } from "./config";

const AGENTS_DIR = path.join(HOME, ".config", "llamalab", "agents");
const AGENTS_LOG = path.join(AGENTS_DIR, "log");
const AGENTS_RUNS = path.join(AGENTS_DIR, "runs");

const AGENT_TYPES: AgentType[] = ["claude", "codex", "openclaw", "hermes"];

// Write the stream-json filter script that extracts readable text from claude's stream-json output
function ensureFilterScript(): void {
	const filterPath = path.join(AGENTS_DIR, "stream-filter.py");
	const script = `#!/usr/bin/env python3
"""Filter claude --output-format stream-json into human-readable text."""
import sys, json

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        d = json.loads(line)
    except json.JSONDecodeError:
        print(line, flush=True)
        continue
    t = d.get("type", "")
    if t == "assistant":
        for block in d.get("message", {}).get("content", []):
            if block.get("type") == "text":
                print(block["text"], end="", flush=True)
            elif block.get("type") == "tool_use":
                name = block.get("name", "")
                inp = block.get("input", {})
                # Show tool calls compactly
                if name == "Read":
                    print(f"\\n> Reading {inp.get('file_path', '?')}...", flush=True)
                elif name == "Edit":
                    print(f"\\n> Editing {inp.get('file_path', '?')}...", flush=True)
                elif name == "Write":
                    print(f"\\n> Writing {inp.get('file_path', '?')}...", flush=True)
                elif name == "Bash":
                    cmd = inp.get("command", "?")
                    if len(cmd) > 120:
                        cmd = cmd[:120] + "..."
                    print(f"\\n> $ {cmd}", flush=True)
                elif name == "Grep":
                    print(f"\\n> Searching for {inp.get('pattern', '?')}...", flush=True)
                elif name == "Glob":
                    print(f"\\n> Finding {inp.get('pattern', '?')}...", flush=True)
                else:
                    print(f"\\n> [{name}]", flush=True)
    elif t == "tool_result":
        # Skip large tool results, just note it happened
        pass
    elif t == "result":
        result = d.get("result", "")
        if result:
            print(f"\\n\\n--- Result ---\\n{result}", flush=True)
        cost = d.get("total_cost_usd")
        if cost:
            print(f"\\n[Cost: \${cost:.4f}]", flush=True)
    elif t == "system" and d.get("subtype") == "init":
        model = d.get("model", "?")
        print(f"[Model: {model}]", flush=True)
`;
	fs.mkdirSync(AGENTS_DIR, { recursive: true });
	fs.writeFileSync(filterPath, script, { mode: 0o755 });
}

// Write filter on module load
ensureFilterScript();

function buildAgentShellCmd(type: AgentType, missionPath: string, cwd: string): string {
	// Escape for embedding inside a bash script (single quotes are safest)
	const prompt = `Read ${missionPath} and complete the mission described within.`;
	const q = shellQuote(prompt);
	// Path to stream filter script (written by ensureFilterScript())
	const filter = path.join(AGENTS_DIR, "stream-filter.py");
	switch (type) {
		case "claude":
			// stream-json gives real-time output; plain -p buffers until done
			return `cd ${cwd} && claude --dangerously-skip-permissions --verbose --output-format stream-json -p ${q} | python3 ${filter}`;
		case "codex":
			return `cd ${cwd} && codex --yolo -q ${q}`;
		case "openclaw":
			return `cd ${cwd} && openclaw agent --prompt ${q}`;
		case "hermes":
			return `cd ${cwd} && hermes run --prompt ${q}`;
	}
}

/** Shell-quote a string for safe embedding in a bash script */
function shellQuote(s: string): string {
	return "'" + s.replace(/'/g, "'\\''") + "'";
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
	fs.mkdirSync(AGENTS_RUNS, { recursive: true });

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

	const logFile = path.join(AGENTS_RUNS, `${name}.log`);
	const scriptFile = path.join(AGENTS_RUNS, `${name}.sh`);
	const agentCmd = buildAgentShellCmd(opts.type, missionPath, cwd);

	// Write a shell script to disk — avoids all quoting hell with bash -c
	const script = `#!/bin/bash
echo "[llamalab] Agent ${name} (${opts.type}) starting at $(date)"
echo "[llamalab] CWD: ${cwd}"
echo "[llamalab] Mission: ${missionPath}"
echo "---"
${agentCmd}
echo ""
echo "[llamalab] Agent exited at $(date) with code $?"
`;
	fs.writeFileSync(scriptFile, script, { mode: 0o755 });

	console.log(`[agent] Spawning ${opts.type} agent "${name}"`);
	console.log(`[agent] Mission: ${missionPath}`);
	console.log(`[agent] CWD: ${cwd}`);
	console.log(`[agent] Cmd: ${agentCmd}`);
	console.log(`[agent] Log: ${logFile}`);
	console.log(`[agent] Script: ${scriptFile}`);

	// Spawn in tmux — run the script, pipe output to both terminal and log file
	// Using tmux pipe-pane to capture everything the pane outputs
	const tmuxCmd = [
		"tmux", "new-session", "-d", "-s", sessionId,
		"bash", scriptFile,
	];
	// After session starts, attach pipe-pane to capture output to log file
	const pipeCmd = [
		"tmux", "pipe-pane", "-t", sessionId, "-o", `cat >> ${logFile}`,
	];

	const proc = Bun.spawn(tmuxCmd, {
		stdout: "pipe",
		stderr: "pipe",
	});
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		console.error(`[agent] tmux spawn failed (exit ${exitCode}): ${stderr}`);
	} else {
		console.log(`[agent] tmux session "${sessionId}" started`);
		// Attach pipe-pane to capture all pane output to log file
		const pipeProc = Bun.spawn(pipeCmd, { stdout: "pipe", stderr: "pipe" });
		const pipeExit = await pipeProc.exited;
		if (pipeExit === 0) {
			console.log(`[agent] pipe-pane attached to ${logFile}`);
		} else {
			const pipeErr = await new Response(pipeProc.stderr).text();
			console.error(`[agent] pipe-pane failed: ${pipeErr}`);
		}
	}

	// Register in agents log
	const entry: AgentInfo = {
		name,
		type: opts.type,
		programId: opts.programId,
		task: opts.task,
		status: "running",
		startedAt: new Date().toISOString(),
		sessionId,
	};

	fs.appendFileSync(AGENTS_LOG, JSON.stringify(entry) + "\n", "utf-8");

	return { name, sessionId };
}

export async function listAgents(): Promise<AgentInfo[]> {
	if (!fs.existsSync(AGENTS_LOG)) return [];

	const lines = fs.readFileSync(AGENTS_LOG, "utf-8").trim().split("\n").filter(Boolean);
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
	const logFile = path.join(AGENTS_RUNS, `${name}.log`);
	try {
		if (!fs.existsSync(logFile)) {
			console.log(`[agent] Log not found: ${logFile}`);
			return { content: "(no log file yet — agent may still be starting)" };
		}
		const content = fs.readFileSync(logFile, "utf-8");
		// Return last 10000 chars to keep it manageable
		return { content: content.length > 10000 ? content.slice(-10000) : content };
	} catch (err) {
		console.error(`[agent] Error reading log for "${name}":`, err);
		return { content: `(error reading log: ${err})` };
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
