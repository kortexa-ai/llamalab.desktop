// Prompt builder — generates contextualized prompts for AI agents

import fs from "node:fs";
import path from "node:path";
import type { AgentType } from "../shared/types";
import { getProgram } from "./research";
import { requireWorkspaceConfig, resolveTilde } from "./config";

function safeReadFile(filePath: string): string | null {
	try {
		if (!fs.existsSync(filePath)) return null;
		return fs.readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
}

export function buildPrompt(opts: {
	agentType: AgentType;
	programId?: string;
	task: string;
}): { prompt: string; promptFile: string } {
	const sections: string[] = [];

	sections.push(`# Task\n\n${opts.task}`);

	const config = requireWorkspaceConfig();

	// Workspace context
	sections.push(`# Workspace\n\n- Code repo: ${config.codeRoot}\n- Research metadata: ${config.researchDir}`);

	// Program context (if scoped to a program)
	if (opts.programId) {
		const program = getProgram(opts.programId);
		if (program) {
			sections.push(`# Program: ${program.name}\n`);
			sections.push(`- ID: ${program.id}`);
			sections.push(`- Status: ${program.status}`);
			sections.push(`- Description: ${program.description}`);

			if (program.metric) {
				sections.push(`- Metric: ${program.metric} (${program.metricDirection || "minimize"})`);
			}
			if (program.baselineMetric != null) {
				sections.push(`- Baseline: ${program.baselineMetric}`);
			}

			// Track config
			if (program.trackDir) {
				const trackDir = resolveTilde(program.trackDir);
				const trackJson = safeReadFile(path.join(trackDir, "track.json"));
				if (trackJson) {
					sections.push(`\n## Track Config\n\n\`\`\`json\n${trackJson}\n\`\`\``);
				}

				// Results
				const results = safeReadFile(path.join(trackDir, "results.json"));
				if (results) {
					// Truncate if too long
					const trimmed = results.length > 5000 ? results.slice(0, 5000) + "\n... (truncated)" : results;
					sections.push(`\n## Recent Results\n\n\`\`\`json\n${trimmed}\n\`\`\``);
				}
			}

			// Findings doc
			if (program.findingsDoc) {
				const findingsPath = path.join(config.researchDir, program.findingsDoc);
				const findings = safeReadFile(findingsPath);
				if (findings) {
					sections.push(`\n## Current Findings\n\n${findings}`);
				}
			}

			// Training script
			if (program.script) {
				const scriptPath = path.join(config.codeRoot, program.script);
				const script = safeReadFile(scriptPath);
				if (script) {
					const trimmed = script.length > 10000 ? script.slice(0, 10000) + "\n# ... (truncated)" : script;
					sections.push(`\n## Training Script (${program.script})\n\n\`\`\`python\n${trimmed}\n\`\`\``);
				}
			}
		}
	}

	// Agent-specific instructions
	switch (opts.agentType) {
		case "claude":
			sections.push(`\n# Instructions\n\nYou are working on the ${config.name} codebase at ${config.codeRoot}. Make changes directly. Test your changes before finishing.`);
			break;
		case "codex":
			sections.push(`\n# Instructions\n\nFocus on the specific coding task. Make minimal, targeted changes.`);
			break;
		case "openclaw":
			sections.push(`\n# Instructions\n\nUse the OpenClaw platform tools available to you. Report findings through messaging.`);
			break;
		case "hermes":
			sections.push(`\n# Instructions\n\nYou are Hermes, multi-channel agent. Complete the task and report through your configured channels.`);
			break;
	}

	const prompt = sections.join("\n\n");
	const name = `llamalab-${opts.programId || "workspace"}-${Date.now()}`;
	const promptFile = `/tmp/${name}.md`;
	fs.writeFileSync(promptFile, prompt, "utf-8");

	return { prompt, promptFile };
}
