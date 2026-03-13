import { Electroview } from "electrobun/view";
import type { AppRPC } from "../shared/types";

// Initialize Electroview RPC at module level (before React mounts).
// Messages from the bun process are dispatched as custom DOM events.
const rpc = Electroview.defineRPC<AppRPC>({
	handlers: {
		requests: {},
		messages: {
			programsChanged: () => {
				window.dispatchEvent(new CustomEvent("programsChanged"));
			},
			menuAction: (data) => {
				window.dispatchEvent(
					new CustomEvent("menuAction", { detail: data }),
				);
			},
			fileChanged: (data) => {
				window.dispatchEvent(
					new CustomEvent("fileChanged", { detail: data }),
				);
			},
			terminalOutput: (data) => {
				window.dispatchEvent(
					new CustomEvent("terminalOutput", { detail: data }),
				);
			},
			terminalExit: (data) => {
				window.dispatchEvent(
					new CustomEvent("terminalExit", { detail: data }),
				);
			},
		},
	},
});

export const electroview = new Electroview({ rpc });

// Export typed RPC request helper for use in React components
export const rpcRequest = rpc.request;
export const rpcSend = rpc.send;
