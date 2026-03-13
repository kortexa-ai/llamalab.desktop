import { useEffect, useState } from "react";
import { rpcRequest } from "../rpc";

export function FileViewer({
	programId,
	filePath,
	source,
}: {
	programId: string;
	filePath: string;
	source: "track" | "config" | "workspace";
}) {
	const [content, setContent] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		loadFile();
	}, [programId, filePath, source]);

	async function loadFile() {
		try {
			let result: { content: string; size: number };
			if (source === "workspace") {
				result = await rpcRequest.readWorkspaceFile({ filePath });
			} else {
				result = await rpcRequest.readFile({
					programId,
					filePath,
					source,
				});
			}
			setContent(result.content);
			setError(null);
		} catch (err: any) {
			setError(err.message || "Failed to load file");
		}
	}

	if (error) {
		return (
			<div className="p-4 text-sm text-red-700">{error}</div>
		);
	}

	if (content === null) {
		return (
			<div className="p-4 text-sm text-stone-400">Loading...</div>
		);
	}

	return (
		<div className="h-full overflow-auto">
			<pre className="p-4 text-xs font-mono leading-relaxed text-stone-800 whitespace-pre">
				{content}
			</pre>
		</div>
	);
}
