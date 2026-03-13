import { X } from "@phosphor-icons/react";
import { useWorkspace } from "../hooks/useWorkspace";

export function TabBar() {
	const { state, dispatch } = useWorkspace();

	if (state.tabs.length === 0) return null;

	return (
		<div className="flex items-center bg-surface-raised border-b border-border overflow-x-auto flex-shrink-0">
			{state.tabs.map((tab, index) => (
				<div
					key={tab.id}
					className={`group flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer border-r border-border transition-colors min-w-0 ${
						index === state.activeTabIndex
							? "bg-surface text-stone-900 border-b-2 border-b-accent -mb-px"
							: "text-stone-500 hover:text-stone-700 hover:bg-surface-sunken"
					}`}
					onClick={() =>
						dispatch({ type: "SET_ACTIVE_TAB", index })
					}
				>
					<span className="truncate max-w-[120px]">{tab.label}</span>
					<button
						onClick={(e) => {
							e.stopPropagation();
							dispatch({ type: "CLOSE_TAB", index });
						}}
						className="opacity-0 group-hover:opacity-100 hover:text-accent transition-opacity flex-shrink-0"
					>
						<X size={10} />
					</button>
				</div>
			))}
		</div>
	);
}
