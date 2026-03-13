import { useEffect, useState, useRef } from "react";
import { ArrowsClockwise, Stop } from "@phosphor-icons/react";
import { rpcRequest } from "../rpc";

export function AgentLog({ agentName }: { agentName: string }) {
	const [content, setContent] = useState<string>("Loading...");
	const [autoRefresh, setAutoRefresh] = useState(true);
	const contentRef = useRef<HTMLPreElement>(null);

	useEffect(() => {
		loadLog();
		if (!autoRefresh) return;
		const interval = setInterval(loadLog, 3000);
		return () => clearInterval(interval);
	}, [agentName, autoRefresh]);

	async function loadLog() {
		try {
			const result = await rpcRequest.getAgentLog({ name: agentName });
			setContent(result.content);
			// Auto-scroll to bottom
			if (contentRef.current) {
				const parent = contentRef.current.parentElement;
				if (parent) parent.scrollTop = parent.scrollHeight;
			}
		} catch (err: any) {
			setContent(`Error: ${err.message}`);
		}
	}

	async function handleKill() {
		try {
			await rpcRequest.killAgent({ name: agentName });
			loadLog();
		} catch (err: any) {
			console.error("Failed to kill agent:", err);
		}
	}

	return (
		<div className="flex flex-col h-full">
			{/* Toolbar */}
			<div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-surface-raised flex-shrink-0">
				<span className="text-2xs font-mono text-stone-500 truncate flex-1">
					Agent: {agentName}
				</span>
				<button
					onClick={loadLog}
					className="flex items-center gap-1 px-2 py-0.5 text-2xs text-stone-500 hover:text-stone-700 transition-colors"
				>
					<ArrowsClockwise size={10} />
					Refresh
				</button>
				<label className="flex items-center gap-1 text-2xs text-stone-500">
					<input
						type="checkbox"
						checked={autoRefresh}
						onChange={(e) => setAutoRefresh(e.target.checked)}
						className="rounded"
					/>
					Auto
				</label>
				<button
					onClick={handleKill}
					className="flex items-center gap-1 px-2 py-0.5 text-2xs text-red-600 hover:text-red-700 transition-colors"
				>
					<Stop size={10} />
					Kill
				</button>
			</div>

			{/* Log content */}
			<div className="flex-1 overflow-auto bg-[#1C1917]">
				<pre
					ref={contentRef}
					className="p-4 text-xs font-mono leading-relaxed text-stone-300 whitespace-pre-wrap"
				>
					{content}
				</pre>
			</div>
		</div>
	);
}
