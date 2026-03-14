// Mission file builder — generates AGENT_MISSION.md files that tell agents WHERE to look, not WHAT data contains

import fs from "node:fs";
import path from "node:path";
import type { ExperimentResult, QueueItem, QueueJson } from "../shared/types";
import { getProgram } from "./research";
import { requireWorkspaceConfig } from "./config";

function safeReadJson<T>(filePath: string): T | null {
	try {
		if (!fs.existsSync(filePath)) return null;
		return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
	} catch {
		return null;
	}
}

function bestResult(results: ExperimentResult[], direction: string): { value: number; id: string } | null {
	if (results.length === 0) return null;
	const sorted = [...results].sort((a, b) =>
		direction === "minimize" ? a.metric_value - b.metric_value : b.metric_value - a.metric_value,
	);
	return { value: sorted[0].metric_value, id: sorted[0].experiment_id };
}

function nextQueueItem(trackDir: string): QueueItem | null {
	const queue = safeReadJson<QueueJson>(path.join(trackDir, "queue.json"));
	if (!queue || !queue.queue || queue.queue.length === 0) return null;
	return queue.queue[0];
}

function formatConfig(config: Record<string, unknown>): string {
	return Object.entries(config)
		.map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
		.join("\n");
}

function buildNextExperimentBlock(item: QueueItem | null): string {
	if (!item) {
		return "No experiments are queued. Review the current results and propose what to try next.";
	}
	let block = `The next queued experiment is **${item.label}** with config:\n${formatConfig(item.config)}`;
	if (item.budget_seconds) {
		block += `\n  budget_seconds: ${item.budget_seconds}`;
	}
	if (item.env_overrides && Object.keys(item.env_overrides).length > 0) {
		block += `\n  env overrides: ${Object.entries(item.env_overrides).map(([k, v]) => `${k}=${v}`).join(", ")}`;
	}
	block += `\n\nRun this experiment, then move "${item.label}" from queue.queue[] to queue.completed[] in queue.json.`;
	return block;
}

const PROGRAM_MISSION_TEMPLATE = `# Mission: {programName}

## Objective
{task}

## Workspace Map
| What | Where |
|------|-------|
| Code repo | {codeRoot}/ |
| Program metadata | {researchDir}/programs/{programId}/program.json |
| Track directory | {trackDir}/ |
| Track config | {trackDir}/track.json |
| Experiment results | {trackDir}/results.json |
| Experiment queue | {trackDir}/queue.json |
| Findings doc | {findingsPath} |
| Training script | {scriptPath} |

## Context
- **Program**: {programName} ({status})
- **Description**: {description}
- **Metric**: {metric} ({metricDirection}), baseline: {baselineMetric}
- **Best result**: {bestResultValue} ({bestResultId})
- **Experiments**: {experimentCount} completed, {queuedCount} queued

## Next Experiment
{nextExperimentBlock}

## Orientation
Read these files first, in order:
1. \`{trackDir}/track.json\` — experiment config, metric, budget, hyperparameter space
2. \`{trackDir}/queue.json\` — queued experiments to run next
3. \`{trackDir}/results.json\` — what's been tried and results
4. \`{findingsPath}\` — analysis and conclusions so far
5. \`{scriptPath}\` — the training script

## Constraints
- Budget: {budgetSeconds}s per experiment
- Run: \`cd {codeRoot} && uv run track_runner.py run --track {programId}\`
- After running, move the experiment label from queue.queue[] to queue.completed[]
- Update findings when you discover something noteworthy
{agentAddendum}`;

const WORKSPACE_MISSION_TEMPLATE = `# Mission: Workspace Task

## Objective
{task}

## Workspace Map
| What | Where |
|------|-------|
| Code repo | {codeRoot}/ |
| Research metadata | {researchDir}/ |
| Tracks directory | {tracksDir}/ |

## Context
- **Workspace**: {workspaceName}

## Orientation
Explore the workspace structure to understand the codebase before making changes.
{agentAddendum}`;

export function buildMission(opts: {
	agentType: string;
	programId?: string;
	task: string;
}): { missionPath: string; content: string } {
	const config = requireWorkspaceConfig();
	let content: string;
	let missionPath: string;

	if (opts.programId) {
		const program = getProgram(opts.programId);
		const trackDir = path.join(config.tracksDir, opts.programId);
		const results = safeReadJson<ExperimentResult[]>(path.join(trackDir, "results.json")) || [];
		const queue = safeReadJson<QueueJson>(path.join(trackDir, "queue.json"));
		const direction = program?.metricDirection || "minimize";
		const best = bestResult(results, direction);
		const nextItem = nextQueueItem(trackDir);

		const findingsPath = program?.findingsDoc
			? path.join(config.researchDir, program.findingsDoc)
			: "(no findings doc)";
		const scriptPath = program?.script
			? path.join(config.codeRoot, program.script)
			: "(no script)";

		// Read budget from track.json
		const trackJson = safeReadJson<{ budget_seconds?: number }>(path.join(trackDir, "track.json"));
		const budgetSeconds = trackJson?.budget_seconds || 300;

		const vars: Record<string, string> = {
			programName: program?.name || opts.programId,
			programId: opts.programId,
			task: opts.task,
			codeRoot: config.codeRoot,
			researchDir: config.researchDir,
			trackDir,
			findingsPath,
			scriptPath,
			status: program?.status || "unknown",
			description: program?.description || "",
			metric: program?.metric || "loss",
			metricDirection: direction,
			baselineMetric: program?.baselineMetric != null ? String(program.baselineMetric) : "none",
			bestResultValue: best ? String(best.value) : "none",
			bestResultId: best ? best.id : "none",
			experimentCount: String(results.length),
			queuedCount: String(queue?.queue?.length || 0),
			nextExperimentBlock: buildNextExperimentBlock(nextItem),
			budgetSeconds: String(budgetSeconds),
			agentAddendum: "",
		};

		content = PROGRAM_MISSION_TEMPLATE.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
		missionPath = path.join(trackDir, "AGENT_MISSION.md");
	} else {
		const vars: Record<string, string> = {
			task: opts.task,
			codeRoot: config.codeRoot,
			researchDir: config.researchDir,
			tracksDir: config.tracksDir,
			workspaceName: config.name,
			agentAddendum: "",
		};

		content = WORKSPACE_MISSION_TEMPLATE.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
		missionPath = path.join(config.codeRoot, "AGENT_MISSION.md");
	}

	// Write the mission file
	fs.mkdirSync(path.dirname(missionPath), { recursive: true });
	fs.writeFileSync(missionPath, content, "utf-8");

	return { missionPath, content };
}

/** Returns the default task for a program based on queue state */
export function getDefaultTask(programId: string): string {
	const config = requireWorkspaceConfig();
	const trackDir = path.join(config.tracksDir, programId);
	const nextItem = nextQueueItem(trackDir);
	if (nextItem) {
		return `Run the next queued experiment: ${nextItem.label}`;
	}
	return "Review results and propose the next experiment to run.";
}
