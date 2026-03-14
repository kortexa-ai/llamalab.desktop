import { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
	const containerRef = useRef<HTMLDivElement>(null);
	const [hover, setHover] = useState<{ x: number; svgX: number; points: { label: string; value: number; color: string }[] } | null>(null);

	const width = 900;
	const height = 500;
	const plotW = width - CHART_PAD.left - CHART_PAD.right;
	const plotH = height - CHART_PAD.top - CHART_PAD.bottom;
	const legendH = dataset.series.length > 1 ? 30 : 0;
	const totalH = height + legendH;

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

	// Pre-sort series points
	const sortedSeries = useMemo(() =>
		dataset.series.map((s) => ({
			...s,
			sorted: [...s.points].sort((a, b) => a.x - b.x),
		})),
	[dataset]);

	function scaleX(v: number) {
		return CHART_PAD.left + ((v - xMin) / (xMax - xMin || 1)) * plotW;
	}
	function scaleY(v: number) {
		return CHART_PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
	}
	function unscaleX(px: number) {
		return xMin + ((px - CHART_PAD.left) / plotW) * (xMax - xMin || 1);
	}

	// Build smooth monotone cubic bezier path
	function smoothPath(pts: { x: number; y: number }[]): string {
		if (pts.length === 0) return "";
		if (pts.length === 1) return `M ${scaleX(pts[0].x)} ${scaleY(pts[0].y)}`;

		const scaled = pts.map((p) => ({ x: scaleX(p.x), y: scaleY(p.y) }));

		// Monotone cubic Hermite interpolation (Fritsch-Carlson)
		const n = scaled.length;
		const dx: number[] = [];
		const dy: number[] = [];
		const m: number[] = [];

		for (let i = 0; i < n - 1; i++) {
			dx.push(scaled[i + 1].x - scaled[i].x);
			dy.push(scaled[i + 1].y - scaled[i].y);
			m.push(dy[i] / (dx[i] || 1));
		}

		const tangents: number[] = [m[0]];
		for (let i = 1; i < n - 1; i++) {
			if (m[i - 1] * m[i] <= 0) {
				tangents.push(0);
			} else {
				tangents.push((m[i - 1] + m[i]) / 2);
			}
		}
		tangents.push(m[n - 2]);

		// Clamp tangents for monotonicity
		for (let i = 0; i < n - 1; i++) {
			if (Math.abs(m[i]) < 1e-10) {
				tangents[i] = 0;
				tangents[i + 1] = 0;
			} else {
				const alpha = tangents[i] / m[i];
				const beta = tangents[i + 1] / m[i];
				const s = alpha * alpha + beta * beta;
				if (s > 9) {
					const t = 3 / Math.sqrt(s);
					tangents[i] = t * alpha * m[i];
					tangents[i + 1] = t * beta * m[i];
				}
			}
		}

		let d = `M ${scaled[0].x} ${scaled[0].y}`;
		for (let i = 0; i < n - 1; i++) {
			const t = dx[i] / 3;
			const cp1x = scaled[i].x + t;
			const cp1y = scaled[i].y + t * tangents[i];
			const cp2x = scaled[i + 1].x - t;
			const cp2y = scaled[i + 1].y - t * tangents[i + 1];
			d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${scaled[i + 1].x} ${scaled[i + 1].y}`;
		}
		return d;
	}

	const showDots = useMemo(() => {
		return sortedSeries.every((s) => s.sorted.length < 100);
	}, [sortedSeries]);

	const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
		const svg = e.currentTarget;
		const rect = svg.getBoundingClientRect();
		const svgX = ((e.clientX - rect.left) / rect.width) * width;

		if (svgX < CHART_PAD.left || svgX > CHART_PAD.left + plotW) {
			setHover(null);
			return;
		}

		const dataX = unscaleX(svgX);

		// Find nearest point in each series
		const points: { label: string; value: number; color: string }[] = [];
		for (let si = 0; si < sortedSeries.length; si++) {
			const sorted = sortedSeries[si].sorted;
			if (sorted.length === 0) continue;

			// Binary search for nearest x
			let lo = 0, hi = sorted.length - 1;
			while (lo < hi) {
				const mid = (lo + hi) >> 1;
				if (sorted[mid].x < dataX) lo = mid + 1;
				else hi = mid;
			}
			// Check adjacent points for closest
			let best = lo;
			if (lo > 0 && Math.abs(sorted[lo - 1].x - dataX) < Math.abs(sorted[lo].x - dataX)) {
				best = lo - 1;
			}

			points.push({
				label: sortedSeries[si].label,
				value: sorted[best].y,
				color: COLORS[si % COLORS.length],
			});
		}

		setHover({ x: dataX, svgX, points });
	}, [sortedSeries, width, plotW]);

	const handleMouseLeave = useCallback(() => setHover(null), []);

	// Grid lines
	const yTicks = niceTicksNum(yMin, yMax, 6);
	const xTicks = niceTicksNum(xMin, xMax, 8);

	return (
		<div ref={containerRef} className="relative w-full h-full">
			<svg
				viewBox={`0 0 ${width} ${totalH}`}
				className="w-full h-full"
				style={{ maxHeight: "100%" }}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
			>
				{/* Background */}
				<rect x={CHART_PAD.left} y={CHART_PAD.top} width={plotW} height={plotH} fill="#FAFAF8" rx={4} stroke="#E8E6E1" strokeWidth={1} />

				{/* Grid lines */}
				{yTicks.map((tick) => (
					<g key={`y-${tick}`}>
						<line
							x1={CHART_PAD.left}
							y1={scaleY(tick)}
							x2={CHART_PAD.left + plotW}
							y2={scaleY(tick)}
							stroke="#E8E6E1"
							strokeWidth={0.5}
							strokeDasharray="4 4"
						/>
						<text
							x={CHART_PAD.left - 8}
							y={scaleY(tick)}
							textAnchor="end"
							dominantBaseline="middle"
							fill="#78716C"
							fontSize={11}
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
							stroke="#E8E6E1"
							strokeWidth={0.5}
							strokeDasharray="4 4"
						/>
						<text
							x={scaleX(tick)}
							y={CHART_PAD.top + plotH + 16}
							textAnchor="middle"
							fill="#78716C"
							fontSize={11}
						>
							{formatNum(tick)}
						</text>
					</g>
				))}

				{/* Series lines — smooth cubic bezier */}
				{sortedSeries.map((series, si) => {
					const color = COLORS[si % COLORS.length];
					if (series.sorted.length === 0) return null;

					const pathD = smoothPath(series.sorted);

					return (
						<g key={si}>
							<path
								d={pathD}
								fill="none"
								stroke={color}
								strokeWidth={2}
								strokeLinecap="round"
								strokeLinejoin="round"
								opacity={0.9}
							/>
							{/* Data point dots (only for small datasets) */}
							{showDots && series.sorted.map((p, pi) => (
								<circle
									key={pi}
									cx={scaleX(p.x)}
									cy={scaleY(p.y)}
									r={2.5}
									fill={color}
									opacity={0.8}
								/>
							))}
						</g>
					);
				})}

				{/* Hover vertical guideline */}
				{hover && (
					<line
						x1={hover.svgX}
						y1={CHART_PAD.top}
						x2={hover.svgX}
						y2={CHART_PAD.top + plotH}
						stroke="#78716C"
						strokeWidth={1}
						strokeDasharray="3 3"
						opacity={0.5}
					/>
				)}

				{/* Axis labels */}
				<text
					x={CHART_PAD.left + plotW / 2}
					y={height - 8}
					textAnchor="middle"
					fill="#78716C"
					fontSize={11}
				>
					{dataset.xLabel}
				</text>
				<text
					x={14}
					y={CHART_PAD.top + plotH / 2}
					textAnchor="middle"
					transform={`rotate(-90, 14, ${CHART_PAD.top + plotH / 2})`}
					fill="#78716C"
					fontSize={11}
				>
					{dataset.yLabel}
				</text>

				{/* Legend — below chart, horizontal */}
				{dataset.series.length > 1 && (
					<g>
						{dataset.series.map((series, si) => {
							const color = COLORS[si % COLORS.length];
							const lx = CHART_PAD.left + si * 140;
							const ly = height + 14;
							return (
								<g key={si}>
									<line x1={lx} y1={ly} x2={lx + 16} y2={ly} stroke={color} strokeWidth={2} strokeLinecap="round" />
									<text x={lx + 22} y={ly} dominantBaseline="middle" fill="#78716C" fontSize={11}>
										{series.label}
									</text>
								</g>
							);
						})}
					</g>
				)}
			</svg>

			{/* HTML tooltip overlay — positioned absolutely, sibling of SVG */}
			{hover && containerRef.current && (
				<div
					className="absolute pointer-events-none bg-white border border-border rounded shadow-sm px-2.5 py-1.5 text-xs"
					style={{
						left: `${(hover.svgX / width) * 100}%`,
						top: `${((CHART_PAD.top + 8) / totalH) * 100}%`,
						transform: hover.svgX > width * 0.7 ? "translateX(-110%)" : "translateX(10px)",
					}}
				>
					<div className="text-stone-500 text-2xs mb-0.5">{dataset.xLabel}: {formatNum(hover.x)}</div>
					{hover.points.map((p, i) => (
						<div key={i} className="flex items-center gap-1.5">
							<span className="w-2 h-0.5 rounded-full" style={{ backgroundColor: p.color }} />
							<span className="text-stone-600">{p.label}:</span>
							<span className="font-mono text-stone-800">{formatNum(p.value)}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// --- SVG Bar Chart ---

function BarChart({ dataset }: { dataset: ChartDataset }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [hoverIdx, setHoverIdx] = useState<number | null>(null);

	const labels = dataset.labels || [];
	const n = labels.length;
	if (n === 0) return <div className="text-sm text-stone-400 p-4">No data</div>;

	const width = Math.max(900, n * 30);
	const height = 500;
	const plotW = width - CHART_PAD.left - CHART_PAD.right;
	const plotH = height - CHART_PAD.top - CHART_PAD.bottom;
	const legendH = dataset.series.length > 1 ? 30 : 0;
	const totalH = height + legendH;

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

	const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
		const svg = e.currentTarget;
		const rect = svg.getBoundingClientRect();
		const svgX = ((e.clientX - rect.left) / rect.width) * width;

		if (svgX < CHART_PAD.left || svgX > CHART_PAD.left + plotW) {
			setHoverIdx(null);
			return;
		}

		const idx = Math.floor((svgX - CHART_PAD.left) / (plotW / n));
		setHoverIdx(Math.max(0, Math.min(n - 1, idx)));
	}, [width, plotW, n]);

	const handleMouseLeave = useCallback(() => setHoverIdx(null), []);

	return (
		<div ref={containerRef} className="relative overflow-x-auto h-full">
			<svg
				viewBox={`0 0 ${width} ${totalH}`}
				className="h-full"
				style={{ minWidth: width }}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
			>
				{/* Background */}
				<rect x={CHART_PAD.left} y={CHART_PAD.top} width={plotW} height={plotH} fill="#FAFAF8" rx={4} stroke="#E8E6E1" strokeWidth={1} />

				{/* Grid */}
				{yTicks.map((tick) => (
					<g key={`y-${tick}`}>
						<line
							x1={CHART_PAD.left}
							y1={scaleY(tick)}
							x2={CHART_PAD.left + plotW}
							y2={scaleY(tick)}
							stroke="#E8E6E1"
							strokeWidth={0.5}
							strokeDasharray="4 4"
						/>
						<text
							x={CHART_PAD.left - 8}
							y={scaleY(tick)}
							textAnchor="end"
							dominantBaseline="middle"
							fill="#78716C"
							fontSize={11}
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
									<rect
										key={i}
										x={x}
										y={scaleY(p.y)}
										width={subBarW - 1}
										height={barH}
										fill={color}
										opacity={hoverIdx === i ? 1 : 0.9}
										rx={3}
									/>
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
							fill="#78716C"
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
					fill="#78716C"
					fontSize={11}
				>
					{dataset.yLabel}
				</text>

				{/* Legend — below chart, horizontal */}
				{seriesCount > 1 && (
					<g>
						{dataset.series.map((series, si) => {
							const color = COLORS[si % COLORS.length];
							const lx = CHART_PAD.left + si * 140;
							const ly = height + 14;
							return (
								<g key={si}>
									<rect x={lx} y={ly - 5} width={12} height={10} fill={color} rx={3} />
									<text x={lx + 18} y={ly} dominantBaseline="middle" fill="#78716C" fontSize={11}>
										{series.label}
									</text>
								</g>
							);
						})}
					</g>
				)}
			</svg>

			{/* HTML tooltip overlay for bar chart */}
			{hoverIdx !== null && containerRef.current && (
				<div
					className="absolute pointer-events-none bg-white border border-border rounded shadow-sm px-2.5 py-1.5 text-xs"
					style={{
						left: `${((CHART_PAD.left + hoverIdx * (plotW / n) + (plotW / n) / 2) / width) * 100}%`,
						top: `${((CHART_PAD.top + 8) / totalH) * 100}%`,
						transform: hoverIdx > n * 0.7 ? "translateX(-110%)" : "translateX(10px)",
					}}
				>
					<div className="text-stone-500 text-2xs mb-0.5">{labels[hoverIdx]}</div>
					{dataset.series.map((series, si) => {
						const point = series.points[hoverIdx];
						if (!point) return null;
						return (
							<div key={si} className="flex items-center gap-1.5">
								<span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[si % COLORS.length] }} />
								<span className="text-stone-600">{series.label}:</span>
								<span className="font-mono text-stone-800">{formatNum(point.y)}</span>
							</div>
						);
					})}
				</div>
			)}
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
