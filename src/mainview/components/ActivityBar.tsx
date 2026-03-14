import { Flask, FolderSimple } from "@phosphor-icons/react";
import { useWorkspace } from "../hooks/useWorkspace";
import type { SidebarView } from "../../shared/types";

const VIEWS: { id: SidebarView; icon: typeof Flask; label: string }[] = [
	{ id: "research", icon: Flask, label: "Research" },
	{ id: "explorer", icon: FolderSimple, label: "Explorer" },
];

export function ActivityBar() {
	const { state, dispatch } = useWorkspace();

	return (
		<div className="flex flex-col h-full w-10 bg-surface-raised border-r border-border select-none flex-shrink-0">
			{/* Drag region at top */}
			<div className="h-9 flex-shrink-0 electrobun-webkit-app-region-drag" />

			{/* View icons */}
			<div className="flex flex-col items-center gap-1 pt-1">
				{VIEWS.map(({ id, icon: Icon, label }) => {
					const active = state.activeSidebarView === id;
					return (
						<button
							key={id}
							onClick={() => dispatch({ type: "SET_SIDEBAR_VIEW", view: id })}
							title={label}
							className={`relative w-10 h-9 flex items-center justify-center transition-colors ${
								active ? "text-accent" : "text-stone-400 hover:text-stone-600"
							}`}
						>
							{active && (
								<div className="absolute left-0 top-1 bottom-1 w-0.5 bg-accent rounded-r" />
							)}
							<Icon size={20} weight={active ? "fill" : "regular"} />
						</button>
					);
				})}
			</div>
		</div>
	);
}
