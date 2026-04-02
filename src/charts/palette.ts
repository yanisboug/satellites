export const countryPalette = new Map<string, string>([
	["USA", "#2a9d8f"],
	["United Kingdom", "#457b9d"],
	["China", "#e76f51"],
	["Russia", "#8d99ae"],
	["France/Italy", "#f4a261"],
	["Autre", "#a8dadc"],
]);

export const orbitPalette = new Map<string, string>([
	["LEO", "#2a9d8f"],
	["MEO", "#e9c46a"],
	["GEO", "#e76f51"],
	["Elliptical", "#7a5195"],
	["Non précisée", "#90a4ae"],
]);

export const usagePalette = new Map<string, string>([
	["Commercial", "#2a9d8f"],
	["Militaire", "#e76f51"],
	["Autre", "#577590"],
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
