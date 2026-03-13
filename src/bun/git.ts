// Git operations — shells out to git CLI via Bun.spawn

import type { GitStatus, GitLogEntry } from "../shared/types";
import { requireWorkspaceConfig } from "./config";

function getRepoDir(): string {
	return requireWorkspaceConfig().codeRoot;
}

async function runGit(
	args: string[],
	cwd?: string,
): Promise<string> {
	const proc = Bun.spawn(["git", ...args], {
		cwd: cwd || getRepoDir(),
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdout = await new Response(proc.stdout).text();
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(stderr.trim() || `git ${args[0]} failed with code ${exitCode}`);
	}
	return stdout.trim();
}

export async function gitStatus(): Promise<GitStatus> {
	const cwd = getRepoDir();

	// Branch name
	let branch = "HEAD";
	try {
		branch = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
	} catch {
		// detached HEAD or not a repo
	}

	// Ahead/behind
	let ahead = 0;
	let behind = 0;
	try {
		const revList = await runGit(
			["rev-list", "--left-right", "--count", `HEAD...@{upstream}`],
			cwd,
		);
		const [a, b] = revList.split(/\s+/);
		ahead = parseInt(a) || 0;
		behind = parseInt(b) || 0;
	} catch {
		// no upstream tracking
	}

	// Porcelain status
	const porcelain = await runGit(["status", "--porcelain=v1"], cwd);
	const staged: string[] = [];
	const unstaged: string[] = [];
	const untracked: string[] = [];

	for (const line of porcelain.split("\n")) {
		if (!line) continue;
		const x = line[0]; // index status
		const y = line[1]; // worktree status
		const file = line.slice(3);

		if (x === "?" && y === "?") {
			untracked.push(file);
		} else {
			if (x !== " " && x !== "?") staged.push(file);
			if (y !== " " && y !== "?") unstaged.push(file);
		}
	}

	return { branch, ahead, behind, staged, unstaged, untracked };
}

export async function gitLog(count: number): Promise<GitLogEntry[]> {
	const raw = await runGit([
		"log",
		`-${count}`,
		"--format=%H%n%h%n%an%n%ai%n%s%n---",
	]);
	const entries: GitLogEntry[] = [];
	const blocks = raw.split("\n---\n");
	for (const block of blocks) {
		const lines = block.trim().split("\n");
		if (lines.length < 5) continue;
		entries.push({
			hash: lines[0],
			shortHash: lines[1],
			author: lines[2],
			date: lines[3],
			message: lines[4],
		});
	}
	return entries;
}

export async function gitDiff(filePath?: string): Promise<string> {
	const args = ["diff"];
	if (filePath) args.push("--", filePath);
	// Show both staged and unstaged
	const unstaged = await runGit(args);
	const stagedArgs = ["diff", "--cached"];
	if (filePath) stagedArgs.push("--", filePath);
	const staged = await runGit(stagedArgs);

	const parts: string[] = [];
	if (staged) parts.push(staged);
	if (unstaged) parts.push(unstaged);
	return parts.join("\n");
}

export async function gitAdd(paths: string[]): Promise<void> {
	await runGit(["add", ...paths]);
}

export async function gitCommit(
	message: string,
): Promise<{ hash: string }> {
	await runGit(["commit", "-m", message]);
	const hash = await runGit(["rev-parse", "HEAD"]);
	return { hash };
}

export async function gitPush(): Promise<void> {
	await runGit(["push"]);
}

export async function gitBranches(): Promise<{
	current: string;
	branches: string[];
}> {
	const raw = await runGit(["branch", "--format=%(refname:short)"]);
	const branches = raw.split("\n").filter(Boolean);
	let current = "";
	try {
		current = await runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
	} catch {
		current = branches[0] || "";
	}
	return { current, branches };
}

export async function gitCheckout(branch: string): Promise<void> {
	await runGit(["checkout", branch]);
}
