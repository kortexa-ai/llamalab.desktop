import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "Llama Lab",
		identifier: "com.kortexa.llamalab",
		version: "0.1.0",
	},
	runtime: {
		// Keep app alive when window is closed (for tray icon)
		exitOnLastWindowClosed: false,
	},
	build: {
		// Vite builds to dist/, we copy from there
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
		},
		// Ignore Vite output in watch mode — HMR handles view rebuilds separately
		watchIgnore: ["dist/**"],
		mac: {
			bundleCEF: false,
			codesign: true,
			notarize: true,
		},
		linux: {
			bundleCEF: false,
		},
		win: {
			bundleCEF: false,
		},
	},
} satisfies ElectrobunConfig;
