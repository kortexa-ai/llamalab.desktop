import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// Initialize Electroview RPC before React mounts
import "./rpc";
import App from "./App";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
