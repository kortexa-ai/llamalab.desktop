import { useState, useEffect } from "react";
import { WorkspaceProvider, useWorkspace } from "./hooks/useWorkspace";
import { ActivityBar } from "./components/ActivityBar";
import { Sidebar } from "./components/Sidebar";
import { TabBar } from "./components/TabBar";
import { ContentPane } from "./components/ContentPane";
import { TerminalPanel } from "./components/TerminalPanel";
import { StatusBar } from "./components/StatusBar";
import { SpawnAgentDialog } from "./components/SpawnAgentDialog";
import { CommandPalette } from "./components/CommandPalette";
import { SetupWizard } from "./components/SetupWizard";
import { OpenWorkspaceDialog } from "./components/OpenWorkspaceDialog";
import { NewProgramDialog } from "./components/NewProgramDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { rpcRequest } from "./rpc";

type Dialog = "none" | "new-workspace" | "open-workspace" | "new-program" | "settings";

function AppShell() {
	const { state } = useWorkspace();

	return (
		<div className="flex flex-col h-screen bg-surface">
			<div className="flex flex-1 min-h-0">
				{state.sidebarVisible && <ActivityBar />}
				{state.sidebarVisible && (
					<div
						className="flex-shrink-0 h-full"
						style={{ width: state.sidebarWidth }}
					>
						<Sidebar />
					</div>
				)}
				<div className="flex flex-col flex-1 min-w-0">
					<TabBar />
					<div className="flex-1 min-h-0 overflow-hidden">
						<ContentPane />
					</div>
					<TerminalPanel />
				</div>
			</div>
			<StatusBar />
			<SpawnAgentDialog />
			<CommandPalette />
		</div>
	);
}

function App() {
	const [setupDone, setSetupDone] = useState<boolean | null>(null);
	const [dialog, setDialog] = useState<Dialog>("none");
	// Bump this to force WorkspaceProvider to remount after switching
	const [wsKey, setWsKey] = useState(0);

	useEffect(() => {
		rpcRequest
			.checkSetup({})
			.then((result) => setSetupDone(result.configured))
			.catch(() => setSetupDone(false));
	}, []);

	// Listen for dialog events from command palette and menu
	useEffect(() => {
		const wsHandler = (e: Event) => {
			const detail = (e as CustomEvent).detail as Dialog;
			if (detail === "new-workspace" || detail === "open-workspace" || detail === "new-program" || detail === "settings") {
				setDialog(detail);
			}
		};
		const menuHandler = (e: Event) => {
			const action = (e as CustomEvent).detail?.action;
			if (action === "new-workspace") setDialog("new-workspace");
			if (action === "open-workspace") setDialog("open-workspace");
			if (action === "new-program") setDialog("new-program");
			if (action === "settings") setDialog("settings");
		};
		window.addEventListener("workspace-dialog", wsHandler);
		window.addEventListener("menuAction", menuHandler);
		return () => {
			window.removeEventListener("workspace-dialog", wsHandler);
			window.removeEventListener("menuAction", menuHandler);
		};
	}, []);

	// Titlebar double-click to maximize/restore
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (target.closest(".titlebar-drag")) {
				rpcRequest.toggleMaximize({});
			}
		};
		window.addEventListener("dblclick", handler);
		return () => window.removeEventListener("dblclick", handler);
	}, []);

	function handleWorkspaceSwitch() {
		setDialog("none");
		// Remount WorkspaceProvider to reload all data
		setWsKey((k) => k + 1);
	}

	// Still checking
	if (setupDone === null) {
		return (
			<div className="flex items-center justify-center h-screen bg-stone-100 text-stone-400 text-sm">
				Loading...
			</div>
		);
	}

	// First run — show wizard (no cancel option)
	if (!setupDone) {
		return (
			<SetupWizard
				onComplete={() => {
					setSetupDone(true);
				}}
			/>
		);
	}

	return (
		<WorkspaceProvider key={wsKey}>
			<AppShell />
			{dialog === "new-workspace" && (
				<SetupWizard
					onComplete={handleWorkspaceSwitch}
					onCancel={() => setDialog("none")}
				/>
			)}
			{dialog === "open-workspace" && (
				<OpenWorkspaceDialog
					onComplete={handleWorkspaceSwitch}
					onCancel={() => setDialog("none")}
				/>
			)}
			{dialog === "new-program" && (
				<NewProgramDialog onClose={() => setDialog("none")} />
			)}
			{dialog === "settings" && (
				<SettingsDialog onClose={() => setDialog("none")} />
			)}
		</WorkspaceProvider>
	);
}

export default App;
