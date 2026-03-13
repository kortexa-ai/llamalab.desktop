import { useEffect, useState, useMemo } from "react";
import { ArrowsClockwise, ChartLine, ChartBar } from "@phosphor-icons/react";
import { rpcRequest } from "../rpc";
import { useWorkspace } from "../hooks/useWorkspace";
import type { ChartMeta, ChartDataset } from "../../shared/types";

// --- Color palette for chart lines (warm, accessible) ---
const COLORS = [
	"#C2410C", // orange-700 (accent)
	"#0891B2", // cyan-600
	"#059669", // emerald-600
	"#D97706", // amber-600
	"#2563EB", // blue-600
	"#DC2626", // red-600
	"#7C3AED", // violet-600
	"#DB2777", // pink-600
	"#0D9488", // teal-600
	"#CA8A04", // yellow-600
	"#4F46E5", // indigo-600
	"#16A34A", // green-600
];

// --- Charts Browser (list of available charts) ---

export function ChartsBrowser() {
	const { dispatch } = useWorkspace();
	const [charts, setCharts] = useState<ChartMeta[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadCharts();
	}, []);

	async function loadCharts() {
		setLoading(true);
		try {
			const result = await rpcRequest.listCharts({});
			setCharts(result);
		} catch (err) {
			console.error("Failed to load charts:", err);
		} finally {
			setLoading(false);
		}
	}

	function openChart(chart: ChartMeta) {
		dispatch({
			type: "OPEN_TAB",
			tab: {
				id: `chart-${chart.id}`,
				type: "chart" as any,
				label: chart.label,
				data: { chartId: chart.id },
			},
		});
	}

	if (loading) {
		return <div className="p-4 text-sm text-stone-400">Loading charts...</div>;
	}

	const csvCharts = charts.filter((c) => c.source === "csv");
	const summaryCharts = charts.filter((c) => c.source !== "csv");

	return (
		<div className="p-4 overflow-y-auto h-full">
			<h2 className="text-base font-semibold text-stone-900 mb-4">Experiment Charts</h2>

			{/* Summary charts */}
			{summaryCharts.length > 0 && (
				<div className="mb-6">
					<h3 className="text-xs font-semibold text-stone-700 mb-2 uppercase tracking-wider">
						Summary Results
					</h3>
					<div className="grid gap-2">
						{summaryCharts.map((chart) => (
							<button
								key={chart.id}
								onClick={() => openChart(chart)}
								className="text-left p-3 border border-border rounded hover:bg-surface-sunken transition-colors"
							>
								<div className="flex items-center gap-2 text-sm text-stone-800">
									<ChartBar size={14} className="text-accent" />
									{chart.label}
								</div>
								<div className="text-2xs text-stone-400 mt-0.5">
									Columns: {chart.columns.join(", ")}
								</div>
							</button>
						))}
					</div>
				</div>
			)}

			{/* Step logs */}
			{csvCharts.length > 0 ? (
				<div>
					<h3 className="text-xs font-semibold text-stone-700 mb-2 uppercase tracking-wider">
						Step Logs ({csvCharts.length})
					</h3>
					<div className="grid gap-2">
						{csvCharts.map((chart) => (
							<button
								key={chart.id}
								onClick={() => openChart(chart)}
								className="text-left p-3 border border-border rounded hover:bg-surface-sunken transition-colors"
							>
								<div className="flex items-center gap-2 text-sm text-stone-800">
									<ChartLine size={14} className="text-accent" />
									{chart.label}
								</div>
								<div className="text-2xs text-stone-400 mt-0.5">
									{chart.defaultY.join(", ")} vs {chart.defaultX}
								</div>
							</button>
						))}
					</div>
				</div>
			) : (
				<div className="text-sm text-stone-400 border border-dashed border-border rounded p-4 text-center">
					<p>No step logs yet.</p>
					<p className="text-2xs mt-1">
						Run experiments with <code className="font-mono">--log-csv</code> to generate per-step CSVs in logs/
					</p>
				</div>
			)}
		</div>
	);
}

// --- Single Chart View (renders when you open a chart tab) ---

export function ChartPanel({ chartId }: { chartId: string }) {
	const [dataset, setDataset] = useState<ChartDataset | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [xCol] = useState<string | undefined>();
	const [yCol] = useState<string | undefined>();

	useEffect(() => {
		loadData();
	}, [chartId, xCol, yCol]);

	async function loadData() {
		setLoading(true);
		setError(null);
		try {
			const result = await rpcRequest.getChartData({
				id: chartId,
				xCol,
				yCols: yCol ? [yCol] : undefined,
			});
			setDataset(result);
		} catch (err: any) {
			setError(err.message || "Failed to load chart data");
		} finally {
			setLoading(false);
		}
	}

	if (error) {
		return <div className="p-4 text-sm text-red-700">{error}</div>;
	}

	if (loading || !dataset) {
		return <div className="p-4 text-sm text-stone-400">Loading chart...</div>;
	}

	return (
		<div className="h-full flex flex-col">
			{/* Toolbar */}
			<div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-raised flex-shrink-0">
				<span className="text-sm font-semibold text-stone-800">{dataset.title}</span>
				<button
					onClick={loadData}
					className="flex items-center gap-1 text-2xs text-stone-500 hover:text-stone-700"
				>
					<ArrowsClockwise size={10} />
					Refresh
				</button>
			</div>

			{/* Chart */}
			<div className="flex-1 min-h-0 p-4">
				{dataset.chartType === "bar" ? (
					<BarChart dataset={dataset} />
				) : (
					<LineChart dataset={dataset} />
				)}
			</div>
		</div>
	);
}

// --- SVG Line Chart ---

const CHART_PAD = { top: 20, right: 30, bottom: 50, left: 65 };

function LineChart({ dataset }: { dataset: ChartDataset }) {
	const width = 900;
	const height = 500;
	const plotW = width - CHART_PAD.left - CHART_PAD.right;
	const plotH = height - CHART_PAD.top - CHART_PAD.bottom;

	const { xMin, xMax, yMin, yMax } = useMemo(() => {
		let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
		for (const s of dataset.series) {
			for (const p of s.points) {
				if (p.x < xMin) xMin = p.x;
				if (p.x > xMax) xMax = p.x;
				if (p.y < yMin) yMin = p.y;
				if (p.y > yMax) yMax = p.y;
			}
		}
		// Add 5% padding
		const yPad = (yMax - yMin) * 0.05 || 0.1;
		return { xMin, xMax, yMin: yMin - yPad, yMax: yMax + yPad };
	}, [dataset]);

	function scaleX(v: number) {
		return CHART_PAD.left + ((v - xMin) / (xMax - xMin || 1)) * plotW;
	}
	function scaleY(v: number) {
		return CHART_PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
	}

	// Grid lines
	const yTicks = niceTicksNum(yMin, yMax, 6);
	const xTicks = niceTicksNum(xMin, xMax, 8);

	return (
		<svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" style={{ maxHeight: "100%" }}>
			{/* Background */}
			<rect x={CHART_PAD.left} y={CHART_PAD.top} width={plotW} height={plotH} fill="#1C1917" rx={4} />

			{/* Grid lines */}
			{yTicks.map((tick) => (
				<g key={`y-${tick}`}>
					<line
						x1={CHART_PAD.left}
						y1={scaleY(tick)}
						x2={CHART_PAD.left + plotW}
						y2={scaleY(tick)}
						stroke="#44403C"
						strokeWidth={0.5}
					/>
					<text
						x={CHART_PAD.left - 8}
						y={scaleY(tick)}
						textAnchor="end"
						dominantBaseline="middle"
						className="text-2xs fill-stone-500"
						fontSize={10}
					>
						{formatNum(tick)}
					</text>
				</g>
			))}
			{xTicks.map((tick) => (
				<g key={`x-${tick}`}>
					<line
						x1={scaleX(tick)}
						y1={CHART_PAD.top}
						x2={scaleX(tick)}
						y2={CHART_PAD.top + plotH}
						stroke="#44403C"
						strokeWidth={0.5}
					/>
					<text
						x={scaleX(tick)}
						y={CHART_PAD.top + plotH + 16}
						textAnchor="middle"
						className="text-2xs fill-stone-500"
						fontSize={10}
					>
						{formatNum(tick)}
					</text>
				</g>
			))}

			{/* Series lines */}
			{dataset.series.map((series, si) => {
				const color = COLORS[si % COLORS.length];
				const sorted = [...series.points].sort((a, b) => a.x - b.x);
				if (sorted.length === 0) return null;

				const pathD = sorted
					.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x)} ${scaleY(p.y)}`)
					.join(" ");

				return (
					<g key={si}>
						<path d={pathD} fill="none" stroke={color} strokeWidth={1.5} opacity={0.9} />
					</g>
				);
			})}

			{/* Axis labels */}
			<text
				x={CHART_PAD.left + plotW / 2}
				y={height - 8}
				textAnchor="middle"
				className="fill-stone-400"
				fontSize={11}
			>
				{dataset.xLabel}
			</text>
			<text
				x={14}
				y={CHART_PAD.top + plotH / 2}
				textAnchor="middle"
				transform={`rotate(-90, 14, ${CHART_PAD.top + plotH / 2})`}
				className="fill-stone-400"
				fontSize={11}
			>
				{dataset.yLabel}
			</text>

			{/* Legend */}
			{dataset.series.length > 1 && (
				<g>
					{dataset.series.map((series, si) => {
						const color = COLORS[si % COLORS.length];
						const lx = CHART_PAD.left + 10;
						const ly = CHART_PAD.top + 14 + si * 16;
						return (
							<g key={si}>
								<line x1={lx} y1={ly} x2={lx + 16} y2={ly} stroke={color} strokeWidth={2} />
								<text x={lx + 22} y={ly} dominantBaseline="middle" className="fill-stone-400" fontSize={10}>
									{series.label}
								</text>
							</g>
						);
					})}
				</g>
			)}
		</svg>
	);
}

// --- SVG Bar Chart ---

function BarChart({ dataset }: { dataset: ChartDataset }) {
	const labels = dataset.labels || [];
	const n = labels.length;
	if (n === 0) return <div className="text-sm text-stone-400 p-4">No data</div>;

	const width = Math.max(900, n * 30);
	const height = 500;
	const plotW = width - CHART_PAD.left - CHART_PAD.right;
	const plotH = height - CHART_PAD.top - CHART_PAD.bottom;

	const { yMin, yMax } = useMemo(() => {
		let yMin = Infinity, yMax = -Infinity;
		for (const s of dataset.series) {
			for (const p of s.points) {
				if (p.y < yMin) yMin = p.y;
				if (p.y > yMax) yMax = p.y;
			}
		}
		const yPad = (yMax - yMin) * 0.05 || 0.1;
		return { yMin: Math.min(0, yMin), yMax: yMax + yPad };
	}, [dataset]);

	const barWidth = (plotW / n) * 0.7;
	const barGap = (plotW / n) * 0.3;
	const seriesCount = dataset.series.length;

	function scaleY(v: number) {
		return CHART_PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
	}

	const yTicks = niceTicksNum(yMin, yMax, 6);

	return (
		<div className="overflow-x-auto h-full">
			<svg viewBox={`0 0 ${width} ${height}`} className="h-full" style={{ minWidth: width }}>
				{/* Background */}
				<rect x={CHART_PAD.left} y={CHART_PAD.top} width={plotW} height={plotH} fill="#1C1917" rx={4} />

				{/* Grid */}
				{yTicks.map((tick) => (
					<g key={`y-${tick}`}>
						<line
							x1={CHART_PAD.left}
							y1={scaleY(tick)}
							x2={CHART_PAD.left + plotW}
							y2={scaleY(tick)}
							stroke="#44403C"
							strokeWidth={0.5}
						/>
						<text
							x={CHART_PAD.left - 8}
							y={scaleY(tick)}
							textAnchor="end"
							dominantBaseline="middle"
							className="text-2xs fill-stone-500"
							fontSize={10}
						>
							{formatNum(tick)}
						</text>
					</g>
				))}

				{/* Bars */}
				{dataset.series.map((series, si) => {
					const color = COLORS[si % COLORS.length];
					const subBarW = barWidth / seriesCount;

					return (
						<g key={si}>
							{series.points.map((p, i) => {
								const x =
									CHART_PAD.left +
									i * (barWidth + barGap) +
									barGap / 2 +
									si * subBarW;
								const barH = ((p.y - yMin) / (yMax - yMin || 1)) * plotH;
								return (
									<g key={i}>
										<rect
											x={x}
											y={scaleY(p.y)}
											width={subBarW - 1}
											height={barH}
											fill={color}
											opacity={0.85}
											rx={1}
										/>
										{/* Value label on top of bar (for reasonable counts) */}
										{n <= 40 && (
											<text
												x={x + subBarW / 2}
												y={scaleY(p.y) - 4}
												textAnchor="middle"
												className="fill-stone-400"
												fontSize={8}
											>
												{formatNum(p.y)}
											</text>
										)}
									</g>
								);
							})}
						</g>
					);
				})}

				{/* X-axis labels */}
				{labels.map((label, i) => {
					const x =
						CHART_PAD.left +
						i * (barWidth + barGap) +
						barGap / 2 +
						barWidth / 2;
					return (
						<text
							key={i}
							x={x}
							y={CHART_PAD.top + plotH + 12}
							textAnchor="end"
							transform={`rotate(-45, ${x}, ${CHART_PAD.top + plotH + 12})`}
							className="fill-stone-500"
							fontSize={9}
						>
							{label.length > 20 ? label.slice(0, 18) + "..." : label}
						</text>
					);
				})}

				{/* Y axis label */}
				<text
					x={14}
					y={CHART_PAD.top + plotH / 2}
					textAnchor="middle"
					transform={`rotate(-90, 14, ${CHART_PAD.top + plotH / 2})`}
					className="fill-stone-400"
					fontSize={11}
				>
					{dataset.yLabel}
				</text>

				{/* Legend */}
				{seriesCount > 1 && (
					<g>
						{dataset.series.map((series, si) => {
							const color = COLORS[si % COLORS.length];
							const lx = CHART_PAD.left + 10;
							const ly = CHART_PAD.top + 14 + si * 16;
							return (
								<g key={si}>
									<rect x={lx} y={ly - 5} width={12} height={10} fill={color} rx={1} />
									<text x={lx + 18} y={ly} dominantBaseline="middle" className="fill-stone-400" fontSize={10}>
										{series.label}
									</text>
								</g>
							);
						})}
					</g>
				)}
			</svg>
		</div>
	);
}

// --- Helpers ---

function formatNum(v: number): string {
	if (Math.abs(v) >= 1000) return v.toFixed(0);
	if (Math.abs(v) >= 1) return v.toFixed(2);
	if (Math.abs(v) >= 0.01) return v.toFixed(4);
	return v.toExponential(2);
}

function niceTicksNum(min: number, max: number, targetCount: number): number[] {
	const range = max - min;
	if (range === 0) return [min];

	const roughStep = range / targetCount;
	const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
	let step: number;

	const normalized = roughStep / mag;
	if (normalized <= 1.5) step = mag;
	else if (normalized <= 3) step = 2 * mag;
	else if (normalized <= 7) step = 5 * mag;
	else step = 10 * mag;

	const ticks: number[] = [];
	let tick = Math.ceil(min / step) * step;
	while (tick <= max) {
		ticks.push(tick);
		tick += step;
	}
	return ticks;
}
