const wong = {
	sky: "#56B4E9",
	blue: "#0072B2",
	green: "#009E73",
	orange: "#E69F00",
	vermillion: "#D55E00",
	purple: "#CC79A7",
	yellow: "#F0E442",
	grey: "#999999",
} as const;

export const countryPalette = new Map<string, string>([
	["USA", wong.sky],
	["United Kingdom", wong.blue],
	["China", wong.vermillion],
	["Russia", wong.purple],
	["France/Italy", wong.orange],
	["Autre", wong.grey],
]);

export const orbitPalette = new Map<string, string>([
	["LEO", wong.green],
	["MEO", wong.yellow],
	["GEO", wong.vermillion],
	["Elliptical", wong.purple],
	["Non précisée", "#cbd5e1"],
]);

export const usagePalette = new Map<string, string>([
	["Commercial", wong.sky],
	["Militaire", wong.vermillion],
	["Autre", wong.grey],
]);

export const stagePalette = {
	background: "#050816",
	panel: "#0f172a",
	line: "rgba(148, 163, 184, 0.22)",
	text: "#e2e8f0",
	muted: "#94a3b8",
	highlight: "#7dd3fc",
	expired: "#ef4444",
};

export function colorFromMap(
	map: Map<string, string>,
	label: string,
	fallback = "#94a3b8",
) {
	return map.get(label) ?? fallback;
}
