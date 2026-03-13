import { useWorkspace } from "../hooks/useWorkspace";
import { ProgramOverview } from "./ProgramOverview";
import { FileEditor } from "./FileEditor";
import { MarkdownViewer } from "./MarkdownViewer";
import { DiffViewer } from "./DiffViewer";
import { AgentLog } from "./AgentLog";
import { ChartPanel, ChartsBrowser } from "./ChartView";
import { GraphView } from "./GraphView";
import { Flask } from "@phosphor-icons/react";

export function ContentPane() {
	const { state } = useWorkspace();

	const activeTab =
		state.activeTabIndex >= 0 ? state.tabs[state.activeTabIndex] : null;

	if (!activeTab) {
		return <EmptyState />;
	}

	switch (activeTab.type) {
		case "program-overview":
			return (
				<ProgramOverview programId={activeTab.data.programId!} />
			);

		case "file-viewer":
			return (
				<FileEditor
					programId={activeTab.data.programId!}
					filePath={activeTab.data.filePath!}
					source={activeTab.data.fileSource!}
				/>
			);

		case "diff":
			return <DiffViewer path={activeTab.data.filePath} />;

		case "agent-log":
			return <AgentLog agentName={activeTab.data.agentName!} />;

		case "chart":
			return <ChartPanel chartId={activeTab.data.chartId!} />;

		case "charts-browser":
			return <ChartsBrowser />;

		case "markdown":
			return <MarkdownViewer content={activeTab.data.content!} />;

		case "graph":
			return <GraphView />;

		case "program-edit":
			return (
				<div className="p-4 text-sm text-stone-500">
					Editor coming soon
				</div>
			);

		default:
			return <EmptyState />;
	}
}

function EmptyState() {
	return (
		<div className="flex items-center justify-center h-full text-stone-400">
			<div className="text-center">
				<Flask size={32} weight="duotone" className="mx-auto mb-2 text-stone-300" />
				<p className="text-sm">Select a program from the sidebar</p>
				<p className="text-2xs mt-1 text-stone-300">
					or press Cmd+Shift+G for the graph view
				</p>
			</div>
		</div>
	);
}
