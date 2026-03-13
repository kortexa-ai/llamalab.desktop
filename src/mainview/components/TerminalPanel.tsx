import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal, X, Plus } from "@phosphor-icons/react";
import { useWorkspace, type TerminalSession } from "../hooks/useWorkspace";
import { rpcRequest, rpcSend } from "../rpc";

export function TerminalPanel() {
	const { state, dispatch, openTerminal } = useWorkspace();
	const [dragging, setDragging] = useState(false);

	// Resize handle
	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			setDragging(true);
			const startY = e.clientY;
			const startHeight = state.terminalHeight;

			const onMove = (ev: MouseEvent) => {
				const delta = startY - ev.clientY;
				const newHeight = Math.max(100, Math.min(600, startHeight + delta));
				dispatch({ type: "SET_TERMINAL_HEIGHT", height: newHeight });
			};

			const onUp = () => {
				setDragging(false);
				document.removeEventListener("mousemove", onMove);
				document.removeEventListener("mouseup", onUp);
			};

			document.addEventListener("mousemove", onMove);
			document.addEventListener("mouseup", onUp);
		},
		[state.terminalHeight, dispatch],
	);

	if (!state.terminalVisible) return null;

	const sessions = state.terminalSessions;

	return (
		<div
			className="flex flex-col border-t border-border bg-[#1C1917]"
			style={{ height: state.terminalHeight }}
		>
			{/* Resize handle */}
			<div
				onMouseDown={handleMouseDown}
				className={`h-1 cursor-ns-resize hover:bg-accent/30 transition-colors flex-shrink-0 ${
					dragging ? "bg-accent/50" : ""
				}`}
			/>

			{/* Terminal header with tabs */}
			<div className="flex items-center bg-surface-raised border-b border-border flex-shrink-0">
				<div className="flex items-center flex-1 overflow-x-auto">
					{sessions.map((session, index) => (
						<div
							key={session.id}
							className={`flex items-center gap-1 px-2 py-0.5 text-2xs cursor-pointer border-r border-border transition-colors ${
								index === state.activeTerminalIndex
									? "bg-[#1C1917] text-stone-300"
									: "text-stone-500 hover:text-stone-400 hover:bg-surface-sunken"
							}`}
							onClick={() =>
								dispatch({ type: "SET_ACTIVE_TERMINAL", index })
							}
						>
							<Terminal size={10} />
							<span className="truncate max-w-[100px]">{session.name}</span>
							{session.status === "exited" && (
								<span className="text-stone-600 text-2xs">exited</span>
							)}
							<button
								onClick={(e) => {
									e.stopPropagation();
									dispatch({ type: "REMOVE_TERMINAL_SESSION", id: session.id });
								}}
								className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
							>
								<X size={8} />
							</button>
						</div>
					))}

					{/* New terminal button */}
					<button
						onClick={() => openTerminal()}
						className="px-2 py-0.5 text-stone-500 hover:text-stone-300 transition-colors"
						title="New terminal"
					>
						<Plus size={10} />
					</button>
				</div>

				<button
					onClick={() => dispatch({ type: "TOGGLE_TERMINAL" })}
					className="px-2 py-0.5 text-stone-400 hover:text-stone-300 transition-colors flex-shrink-0"
				>
					<X size={10} />
				</button>
			</div>

			{/* Terminal content — one per session */}
			{sessions.length === 0 ? (
				<div className="flex-1 flex items-center justify-center text-stone-600 text-xs">
					<button
						onClick={() => openTerminal()}
						className="flex items-center gap-1 hover:text-stone-400 transition-colors"
					>
						<Plus size={12} />
						New Terminal
					</button>
				</div>
			) : (
				<div className="flex-1 min-h-0 relative">
					{sessions.map((session, index) => (
						<TerminalInstance
							key={session.id}
							session={session}
							visible={index === state.activeTerminalIndex}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function TerminalInstance({
	session,
	visible,
}: {
	session: TerminalSession;
	visible: boolean;
}) {
	const { dispatch } = useWorkspace();
	const termRef = useRef<HTMLDivElement>(null);
	const xtermRef = useRef<any>(null);
	const initializedRef = useRef(false);

	useEffect(() => {
		if (!termRef.current || initializedRef.current) return;
		initializedRef.current = true;

		let cleanup: (() => void) | undefined;

		(async () => {
			const { Terminal: XTerminal } = await import("@xterm/xterm");
			const { FitAddon } = await import("@xterm/addon-fit");
			await import("@xterm/xterm/css/xterm.css");

			if (!termRef.current) return;

			const term = new XTerminal({
				fontFamily: '"SF Mono", "Fira Code", "JetBrains Mono", ui-monospace, monospace',
				fontSize: 12,
				lineHeight: 1.4,
				cursorBlink: true,
				scrollback: 5000,
				theme: {
					background: "#1C1917",
					foreground: "#E7E5E4",
					cursor: "#C2410C",
					selectionBackground: "#44403C",
					black: "#1C1917",
					red: "#DC2626",
					green: "#16A34A",
					yellow: "#D97706",
					blue: "#2563EB",
					magenta: "#9333EA",
					cyan: "#0891B2",
					white: "#E7E5E4",
					brightBlack: "#57534E",
					brightRed: "#EF4444",
					brightGreen: "#22C55E",
					brightYellow: "#F59E0B",
					brightBlue: "#3B82F6",
					brightMagenta: "#A855F7",
					brightCyan: "#06B6D4",
					brightWhite: "#FAFAF9",
				},
			});

			const fit = new FitAddon();
			term.loadAddon(fit);
			term.open(termRef.current);
			fit.fit();

			xtermRef.current = term;

			// Start a terminal session
			const { sessionId: sid } = await rpcRequest.startTerminal({
				cwd: session.cwd,
				cols: term.cols,
				rows: term.rows,
				name: session.name,
			});
			// Update session id from pending to real
			dispatch({
				type: "UPDATE_TERMINAL_SESSION",
				id: session.id,
				updates: { id: sid },
			});

			// Forward input
			term.onData((data) => {
				rpcSend.terminalInput({ sessionId: sid, data });
			});

			// Listen for output
			const outputHandler = (e: Event) => {
				const detail = (e as CustomEvent).detail;
				if (detail.sessionId === sid) {
					term.write(detail.data);
				}
			};
			window.addEventListener("terminalOutput", outputHandler);

			// Listen for exit
			const exitHandler = (e: Event) => {
				const detail = (e as CustomEvent).detail;
				if (detail.sessionId === sid) {
					term.write(`\r\n[Process exited with code ${detail.code}]\r\n`);
					dispatch({
						type: "UPDATE_TERMINAL_SESSION",
						id: sid,
						updates: { status: "exited", exitCode: detail.code },
					});
				}
			};
			window.addEventListener("terminalExit", exitHandler);

			// Handle resize
			const resizeObs = new ResizeObserver(() => {
				fit.fit();
				if (sid) {
					rpcRequest.resizeTerminal({
						sessionId: sid,
						cols: term.cols,
						rows: term.rows,
					});
				}
			});
			resizeObs.observe(termRef.current);

			cleanup = () => {
				window.removeEventListener("terminalOutput", outputHandler);
				window.removeEventListener("terminalExit", exitHandler);
				resizeObs.disconnect();
				term.dispose();
				if (sid) {
					rpcRequest.killTerminal({ sessionId: sid });
				}
			};
		})();

		return () => cleanup?.();
	}, []);

	// Re-fit when becoming visible
	useEffect(() => {
		if (visible && xtermRef.current) {
			// Slight delay to ensure container is laid out
			setTimeout(() => {
				xtermRef.current?.refresh?.(0, xtermRef.current.rows - 1);
			}, 50);
		}
	}, [visible]);

	return (
		<div
			ref={termRef}
			className="absolute inset-0"
			style={{ display: visible ? "block" : "none" }}
		/>
	);
}
