import { useEffect, useState } from "react";
import { rpcRequest } from "../rpc";

export function DiffViewer({ path }: { path?: string }) {
	const [diff, setDiff] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		loadDiff();
	}, [path]);

	async function loadDiff() {
		try {
			const raw = await rpcRequest.gitDiff({ path });
			setDiff(raw);
			setError(null);
		} catch (err: any) {
			setError(err.message || "Failed to load diff");
		}
	}

	if (error) {
		return <div className="p-4 text-sm text-red-700">{error}</div>;
	}

	if (diff === null) {
		return <div className="p-4 text-sm text-stone-400">Loading...</div>;
	}

	if (!diff.trim()) {
		return <div className="p-4 text-sm text-stone-400">No changes</div>;
	}

	return (
		<div className="h-full overflow-auto">
			<pre className="p-4 text-xs font-mono leading-relaxed">
				{diff.split("\n").map((line, i) => (
					<DiffLine key={i} line={line} />
				))}
			</pre>
		</div>
	);
}

function DiffLine({ line }: { line: string }) {
	let className = "text-stone-700";

	if (line.startsWith("+++") || line.startsWith("---")) {
		className = "text-stone-500 font-semibold";
	} else if (line.startsWith("+")) {
		className = "text-emerald-700 bg-emerald-50";
	} else if (line.startsWith("-")) {
		className = "text-red-700 bg-red-50";
	} else if (line.startsWith("@@")) {
		className = "text-sky-600 bg-sky-50";
	} else if (line.startsWith("diff ")) {
		className = "text-stone-900 font-semibold border-t border-border pt-2 mt-2";
	}

	return (
		<div className={className}>
			{line}
			{"\n"}
		</div>
	);
}
