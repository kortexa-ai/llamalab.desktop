/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/mainview/**/*.{html,js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				// Warm instrument palette
				surface: {
					DEFAULT: "#FAFAF8",
					raised: "#F3F2EF",
					sunken: "#E8E6E1",
				},
				border: {
					DEFAULT: "#D4D1CC",
					subtle: "#E8E6E1",
				},
				accent: {
					DEFAULT: "#C2410C",
					hover: "#9A3412",
					subtle: "#FFF7ED",
				},
			},
			fontFamily: {
				sans: [
					"-apple-system",
					"BlinkMacSystemFont",
					"SF Pro Text",
					"Segoe UI",
					"system-ui",
					"sans-serif",
				],
				mono: [
					"SF Mono",
					"Fira Code",
					"JetBrains Mono",
					"ui-monospace",
					"monospace",
				],
			},
			fontSize: {
				"2xs": ["10px", "14px"],
			},
		},
	},
	plugins: [],
};
