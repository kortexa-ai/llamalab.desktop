// Charts — discover, parse, and serve experiment log data for charting

import fs from "node:fs";
import path from "node:path";
import type { ChartDataset, ChartMeta, ExperimentSummary } from "../shared/types";
import { requireWorkspaceConfig } from "./config";

// --- Known CSV schemas with default chart axes ---
// Auto-detected from headers, but these provide good defaults

// Columns that are typically y-axis values (loss-like)
const Y_CANDIDATES = ["loss", "vloss", "mse", "tloss", "val_bpb", "bpb_improvement"];
// Columns that are typically x-axis values
const X_CANDIDATES = ["elapsed_s", "step", "epoch", "tokens_M"];

function parseCSV(text: string): { headers: string[]; rows: Record<string, number>[] } {
	const lines = text.trim().split("\n");
	if (lines.length < 2) return { headers: [], rows: [] };

	const headers = lines[0].split(",").map((h) => h.trim());
	const rows: Record<string, number>[] = [];

	for (let i = 1; i < lines.length; i++) {
		const vals = lines[i].split(",");
		if (vals.length !== headers.length) continue;
		const row: Record<string, number> = {};
		for (let j = 0; j < headers.length; j++) {
			const v = parseFloat(vals[j]);
			if (!isNaN(v)) row[headers[j]] = v;
		}
		rows.push(row);
	}

	return { headers, rows };
}

function parseTSV(text: string): { headers: string[]; rows: Record<string, string | number>[] } {
	const lines = text.trim().split("\n");
	if (lines.length < 2) return { headers: [], rows: [] };

	const headers = lines[0].split("\t").map((h) => h.trim());
	const rows: Record<string, string | number>[] = [];

	for (let i = 1; i < lines.length; i++) {
		const vals = lines[i].split("\t");
		const row: Record<string, string | number> = {};
		for (let j = 0; j < headers.length; j++) {
			const v = parseFloat(vals[j]);
			row[headers[j]] = isNaN(v) ? (vals[j] || "").trim() : v;
		}
		rows.push(row);
	}

	return { headers, rows };
}

function detectAxes(headers: string[]): { xCol: string; yCols: string[] } {
	// Find best y columns
	const yCols = headers.filter((h) => Y_CANDIDATES.includes(h));
	if (yCols.length === 0) {
		// Fallback: any numeric column that isn't step/time
		const skip = new Set(["step", "elapsed_s", "epoch", "tokens_M", "lr"]);
		for (const h of headers) {
			if (!skip.has(h)) yCols.push(h);
		}
	}

	// Find best x column
	let xCol = "step";
	for (const candidate of X_CANDIDATES) {
		if (headers.includes(candidate)) {
			xCol = candidate;
			break;
		}
	}

	return { xCol, yCols: yCols.slice(0, 3) }; // max 3 y-series
}

// --- Public API ---

export function listExperimentLogs(): ChartMeta[] {
	const config = requireWorkspaceConfig();
	const results: ChartMeta[] = [];

	// CSV step logs
	if (fs.existsSync(config.logsDir)) {
		const files = fs.readdirSync(config.logsDir).filter((f) => f.endsWith(".csv"));
		for (const file of files) {
			const filePath = path.join(config.logsDir, file);
			const label = file.replace(".csv", "");

			// Peek at headers to detect schema
			try {
				const firstLine = fs.readFileSync(filePath, "utf-8").split("\n")[0];
				const headers = firstLine.split(",").map((h) => h.trim());
				const { xCol, yCols } = detectAxes(headers);

				results.push({
					id: `log-${label}`,
					label,
					source: "csv",
					filePath: path.relative(config.codeRoot, filePath),
					columns: headers,
					defaultX: xCol,
					defaultY: yCols,
					chartType: "line",
				});
			} catch {
				// skip unreadable files
			}
		}
	}

	// Auto-discover TSV summary files in codeRoot
	try {
		const rootFiles = fs.readdirSync(config.codeRoot);
		for (const file of rootFiles) {
			if (!file.endsWith(".tsv")) continue;
			const filePath = path.join(config.codeRoot, file);
			try {
				const firstLine = fs.readFileSync(filePath, "utf-8").split("\n")[0];
				const headers = firstLine.split("\t").map((h) => h.trim());
				if (headers.length < 2) continue;
				const label = file.replace(".tsv", "").replace(/_/g, " ");
				results.push({
					id: `summary-${file.replace(".tsv", "")}`,
					label,
					source: "tsv",
					filePath: file,
					columns: headers,
					defaultX: headers.includes("label") ? "label" : headers[0],
					defaultY: headers.filter((h) => Y_CANDIDATES.includes(h)).slice(0, 1)
						.concat(headers.length > 1 && !Y_CANDIDATES.includes(headers[1]) ? [headers[1]] : [])
						.slice(0, 1),
					chartType: "bar",
				});
			} catch {
				// skip unreadable
			}
		}

		// Auto-discover JSON summary files in codeRoot
		for (const file of rootFiles) {
			if (!file.endsWith("_results.json") && !file.endsWith("_summary.json")) continue;
			const filePath = path.join(config.codeRoot, file);
			try {
				const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
				if (!Array.isArray(data) || data.length === 0) continue;
				const headers = Object.keys(data[0]);
				const label = file.replace(".json", "").replace(/_/g, " ");
				results.push({
					id: `summary-${file.replace(".json", "")}`,
					label,
					source: "json",
					filePath: file,
					columns: headers,
					defaultX: headers.includes("label") ? "label" : headers[0],
					defaultY: headers.filter((h) => Y_CANDIDATES.includes(h)).slice(0, 1)
						.concat(headers.length > 1 ? [headers[1]] : [])
						.filter((h) => h !== (headers.includes("label") ? "label" : headers[0]))
						.slice(0, 1),
					chartType: "bar",
				});
			} catch {
				// skip unreadable
			}
		}
	} catch {
		// codeRoot may not exist yet
	}

	return results;
}

export function getChartData(opts: {
	id: string;
	xCol?: string;
	yCols?: string[];
}): ChartDataset {
	const metas = listExperimentLogs();
	const meta = metas.find((m) => m.id === opts.id);
	if (!meta) throw new Error(`Chart not found: ${opts.id}`);

	const config = requireWorkspaceConfig();
	const xCol = opts.xCol || meta.defaultX;
	const yCols = opts.yCols || meta.defaultY;
	const filePath = path.join(config.codeRoot, meta.filePath);

	if (meta.source === "csv") {
		return loadCSVChart(filePath, meta.label, xCol, yCols);
	} else if (meta.source === "tsv") {
		return loadTSVChart(filePath, xCol, yCols);
	} else if (meta.source === "json") {
		return loadJSONChart(filePath, xCol, yCols);
	}

	throw new Error(`Unknown source type: ${meta.source}`);
}

function loadCSVChart(
	filePath: string,
	label: string,
	xCol: string,
	yCols: string[],
): ChartDataset {
	const text = fs.readFileSync(filePath, "utf-8");
	const { rows } = parseCSV(text);

	const series = yCols.map((yCol) => ({
		label: `${label} — ${yCol}`,
		points: rows
			.filter((r) => r[xCol] !== undefined && r[yCol] !== undefined)
			.map((r) => ({ x: r[xCol], y: r[yCol] })),
	}));

	return {
		title: label,
		xLabel: xCol,
		yLabel: yCols.join(" / "),
		chartType: "line",
		series,
	};
}

function loadTSVChart(
	filePath: string,
	xCol: string,
	yCols: string[],
): ChartDataset {
	const text = fs.readFileSync(filePath, "utf-8");
	const { rows } = parseTSV(text);

	// For bar charts with label x-axis, we create one series per yCol
	const series = yCols.map((yCol) => ({
		label: yCol,
		points: rows
			.filter((r) => r[yCol] !== undefined && r[yCol] !== "")
			.map((r, i) => ({
				x: typeof r[xCol] === "string" ? i : (r[xCol] as number),
				y: typeof r[yCol] === "number" ? r[yCol] : 0,
				label: typeof r[xCol] === "string" ? (r[xCol] as string) : undefined,
			})),
	}));

	return {
		title: path.basename(filePath, path.extname(filePath)),
		xLabel: xCol,
		yLabel: yCols.join(" / "),
		chartType: "bar",
		series,
		labels: rows
			.filter((r) => r[yCols[0]] !== undefined && r[yCols[0]] !== "")
			.map((r) => (typeof r[xCol] === "string" ? (r[xCol] as string) : String(r[xCol]))),
	};
}

function loadJSONChart(
	filePath: string,
	xCol: string,
	yCols: string[],
): ChartDataset {
	const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>[];

	const series = yCols.map((yCol) => ({
		label: yCol,
		points: data
			.filter((r) => r[yCol] !== undefined)
			.map((r, i) => ({
				x: typeof r[xCol] === "string" ? i : (r[xCol] as number),
				y: r[yCol] as number,
				label: typeof r[xCol] === "string" ? (r[xCol] as string) : undefined,
			})),
	}));

	return {
		title: path.basename(filePath, path.extname(filePath)),
		xLabel: xCol,
		yLabel: yCols.join(" / "),
		chartType: "bar",
		series,
		labels: data.map((r) =>
			typeof r[xCol] === "string" ? (r[xCol] as string) : String(r[xCol]),
		),
	};
}

// --- Multi-log overlay (for comparing experiments) ---

export function getOverlayChart(opts: {
	logIds: string[];
	xCol?: string;
	yCol?: string;
}): ChartDataset {
	const allSeries: ChartDataset["series"] = [];
	let xLabel = opts.xCol || "elapsed_s";
	let yLabel = opts.yCol || "loss";

	for (const id of opts.logIds) {
		try {
			const data = getChartData({ id, xCol: opts.xCol, yCols: opts.yCol ? [opts.yCol] : undefined });
			allSeries.push(...data.series);
			xLabel = data.xLabel;
			yLabel = data.yLabel;
		} catch {
			// skip missing logs
		}
	}

	return {
		title: `Comparison (${opts.logIds.length} experiments)`,
		xLabel,
		yLabel,
		chartType: "line",
		series: allSeries,
	};
}

// --- Summary data for ProgramOverview ---

export function getExperimentSummaries(): ExperimentSummary[] {
	const config = requireWorkspaceConfig();
	const results: ExperimentSummary[] = [];

	// Auto-discover TSV summary files
	try {
		const rootFiles = fs.readdirSync(config.codeRoot);
		for (const file of rootFiles) {
			if (!file.endsWith(".tsv")) continue;
			const filePath = path.join(config.codeRoot, file);
			try {
				const { rows } = parseTSV(fs.readFileSync(filePath, "utf-8"));
				const source = file.replace(".tsv", "").replace(/_/g, " ");
				for (const row of rows) {
					results.push({
						label: String(row.label || row.name || row.experiment || ""),
						metric: typeof row.metric === "number" ? row.metric
							: typeof row.val_bpb === "number" ? row.val_bpb : undefined,
						paramsM: typeof row.params_M === "number" ? row.params_M : undefined,
						tokensM: typeof row.tokens_M === "number" ? row.tokens_M : undefined,
						mfu: typeof row.mfu === "number" ? row.mfu : undefined,
						vramMb: typeof row.vram_mb === "number" ? row.vram_mb : undefined,
						description: String(row.description || row.desc || ""),
						source,
					});
				}
			} catch {
				// skip unreadable
			}
		}

		// Auto-discover JSON summary files
		for (const file of rootFiles) {
			if (!file.endsWith("_results.json") && !file.endsWith("_summary.json")) continue;
			const filePath = path.join(config.codeRoot, file);
			try {
				const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>[];
				if (!Array.isArray(data)) continue;
				const source = file.replace(".json", "").replace(/_/g, " ");
				for (const row of data) {
					results.push({
						label: String(row.label || row.experiment || row.name || ""),
						metric: typeof row.val_bpb === "number" ? row.val_bpb
							: typeof row.metric === "number" ? row.metric : undefined,
						paramsM: typeof row.num_params_M === "number" ? row.num_params_M
							: typeof row.params_M === "number" ? row.params_M : undefined,
						tokensM: typeof row.total_tokens_M === "number" ? row.total_tokens_M
							: typeof row.tokens_M === "number" ? row.tokens_M : undefined,
						vramMb: typeof row.peak_vram_mb === "number" ? row.peak_vram_mb
							: typeof row.vram_mb === "number" ? row.vram_mb : undefined,
						description: String(row.desc || row.description || ""),
						source,
					});
				}
			} catch {
				// skip unreadable
			}
		}
	} catch {
		// codeRoot may not exist yet
	}

	return results;
}
