import { useState } from "react";
import { rpcRequest } from "../rpc";
import {
	Folder,
	GitBranch,
	RocketLaunch,
	CircleNotch,
} from "@phosphor-icons/react";

interface SetupWizardProps {
	onComplete: () => void;
	onCancel?: () => void; // present when launched from within the app
}

export function SetupWizard({ onComplete, onCancel }: SetupWizardProps) {
	const [step, setStep] = useState(0);
	const [workspacePath, setWorkspacePath] = useState("~/src/research");
	const [workspaceName, setWorkspaceName] = useState("Research Workspace");
	const [repoUrl, setRepoUrl] = useState(
		"https://github.com/karpathy/autoresearch",
	);
	const [clonePath, setClonePath] = useState("~/src/autoresearch");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleFinish() {
		setLoading(true);
		setError(null);
		try {
			const result = await rpcRequest.setupWorkspace({
				workspacePath,
				workspaceName,
				repoUrl,
				clonePath,
			});
			if (result.ok) {
				onComplete();
			} else {
				setError(result.error || "Setup failed");
				setLoading(false);
			}
		} catch (err) {
			setError(String(err));
			setLoading(false);
		}
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-stone-100"
			onClick={onCancel ? () => onCancel() : undefined}
		>
			<div
				className="bg-surface rounded-xl shadow-2xl border border-border w-[520px] max-w-[90vw] overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="px-8 pt-8 pb-4">
					<h1 className="text-xl font-semibold text-stone-800">
						{onCancel ? "New Workspace" : "Welcome to Llama Lab"}
					</h1>
					<p className="text-sm text-stone-500 mt-1">
						{onCancel
							? "Create a new research workspace."
							: "Let's set up your research workspace."}
					</p>
				</div>

				{/* Step indicators */}
				<div className="px-8 pb-4 flex gap-2">
					{[0, 1, 2].map((i) => (
						<div
							key={i}
							className={`h-1 flex-1 rounded-full transition-colors ${
								i <= step ? "bg-accent" : "bg-stone-200"
							}`}
						/>
					))}
				</div>

				{/* Step content */}
				<div className="px-8 py-4 min-h-[200px]">
					{step === 0 && (
						<div className="space-y-4">
							<div className="flex items-center gap-2 text-sm font-medium text-stone-700">
								<Folder size={16} />
								Workspace Location
							</div>
							<p className="text-xs text-stone-500">
								Where should we store your research metadata? This
								directory will contain program definitions, findings,
								and configuration.
							</p>
							<input
								type="text"
								value={workspacePath}
								onChange={(e) => setWorkspacePath(e.target.value)}
								className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface-sunken outline-none focus:border-accent"
								placeholder="~/src/research"
							/>
							<div className="pt-2">
								<label className="text-xs text-stone-500 block mb-1">
									Workspace name
								</label>
								<input
									type="text"
									value={workspaceName}
									onChange={(e) =>
										setWorkspaceName(e.target.value)
									}
									className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface-sunken outline-none focus:border-accent"
									placeholder="Research Workspace"
								/>
							</div>
						</div>
					)}

					{step === 1 && (
						<div className="space-y-4">
							<div className="flex items-center gap-2 text-sm font-medium text-stone-700">
								<GitBranch size={16} />
								Source Code Repository
							</div>
							<p className="text-xs text-stone-500">
								URL of the git repository containing your research
								code. This will be cloned if it doesn't exist
								locally.
							</p>
							<input
								type="text"
								value={repoUrl}
								onChange={(e) => setRepoUrl(e.target.value)}
								className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface-sunken outline-none focus:border-accent"
								placeholder="https://github.com/user/repo"
							/>
						</div>
					)}

					{step === 2 && (
						<div className="space-y-4">
							<div className="flex items-center gap-2 text-sm font-medium text-stone-700">
								<RocketLaunch size={16} />
								Clone Location
							</div>
							<p className="text-xs text-stone-500">
								Where should the repository be cloned to? If the
								directory already exists, we'll use it as-is.
							</p>
							<input
								type="text"
								value={clonePath}
								onChange={(e) => setClonePath(e.target.value)}
								className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface-sunken outline-none focus:border-accent"
								placeholder="~/src/autoresearch"
							/>

							{/* Summary */}
							<div className="mt-4 p-3 bg-surface-sunken rounded-md text-xs text-stone-600 space-y-1">
								<div>
									<span className="text-stone-400">
										Workspace:{" "}
									</span>
									{workspacePath}
								</div>
								<div>
									<span className="text-stone-400">Repo: </span>
									{repoUrl}
								</div>
								<div>
									<span className="text-stone-400">
										Clone to:{" "}
									</span>
									{clonePath}
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Error */}
				{error && (
					<div className="px-8 pb-2">
						<div className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">
							{error}
						</div>
					</div>
				)}

				{/* Footer */}
				<div className="px-8 py-4 border-t border-border flex justify-between">
					<div className="flex gap-2">
						{onCancel && (
							<button
								onClick={onCancel}
								disabled={loading}
								className="px-4 py-1.5 text-sm text-stone-500 hover:text-stone-700 disabled:opacity-30"
							>
								Cancel
							</button>
						)}
						<button
							onClick={() => setStep((s) => Math.max(0, s - 1))}
							disabled={step === 0 || loading}
							className="px-4 py-1.5 text-sm text-stone-500 hover:text-stone-700 disabled:opacity-30"
						>
							Back
						</button>
					</div>
					<div className="flex gap-2">
						{step < 2 ? (
							<button
								onClick={() => setStep((s) => s + 1)}
								className="px-4 py-1.5 text-sm bg-accent text-white rounded-md hover:bg-accent/90"
							>
								Next
							</button>
						) : (
							<button
								onClick={handleFinish}
								disabled={loading}
								className="px-4 py-1.5 text-sm bg-accent text-white rounded-md hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
							>
								{loading && (
									<CircleNotch
										size={14}
										className="animate-spin"
									/>
								)}
								{loading ? "Setting up..." : "Create Workspace"}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
