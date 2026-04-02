import * as d3 from "d3";
import type { SummaryMetric } from "../types";
import { stagePalette } from "./palette";

export function renderIntroScene(
	container: HTMLElement,
	summary: SummaryMetric,
) {
	const width = 960;
	const height = 640;
	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.attr("role", "img")
		.attr("aria-label", "Introduction sur l'occupation de l'espace orbital");

	svg
		.append("rect")
		.attr("width", width)
		.attr("height", height)
		.attr("rx", 28)
		.attr("fill", "url(#intro-gradient)");

	const defs = svg.append("defs");
	const gradient = defs
		.append("linearGradient")
		.attr("id", "intro-gradient")
		.attr("x1", "0%")
		.attr("y1", "0%")
		.attr("x2", "100%")
		.attr("y2", "100%");

	gradient.append("stop").attr("offset", "0%").attr("stop-color", "#081120");
	gradient.append("stop").attr("offset", "100%").attr("stop-color", "#111b35");

	const orbitGroup = svg.append("g").attr("transform", "translate(282, 322)");

	orbitGroup
		.append("circle")
		.attr("r", 76)
		.attr("fill", "#1d4ed8")
		.attr("opacity", 0.9);

	orbitGroup
		.append("circle")
		.attr("r", 38)
		.attr("fill", "#38bdf8")
		.attr("opacity", 0.38);

	[130, 178, 226].forEach((radius, index) => {
		orbitGroup
			.append("circle")
			.attr("r", radius)
			.attr("fill", "none")
			.attr("stroke", stagePalette.line)
			.attr("stroke-width", 1.2)
			.attr("stroke-dasharray", index === 1 ? "10 10" : "4 8");
	});

	const orbitLabels = [
		{ radius: 130, label: "LEO", x: 92, y: -96 },
		{ radius: 178, label: "MEO", x: 126, y: -138 },
		{ radius: 226, label: "GEO", x: 165, y: -184 },
	];

	orbitLabels.forEach((item) => {
		orbitGroup
			.append("text")
			.attr("x", item.x)
			.attr("y", item.y)
			.attr("fill", stagePalette.muted)
			.attr("font-size", 13)
			.attr("letter-spacing", "0.14em")
			.attr("text-transform", "uppercase")
			.text(item.label);
	});

	const stats = [
		{
			label: "Satellites actifs",
			value: d3.format(",")(summary.totalSatellites).replace(/,/g, " "),
		},
		{
			label: "Part commerciale",
			value: `${Math.round(summary.commercialShare * 100)} %`,
		},
		{
			label: "Leader opérateur",
			value: `${summary.dominantOperator.name}`,
			subvalue: `${Math.round(summary.dominantOperator.share * 100)} % de la flotte`,
		},
		{
			label: "Site de lancement n° 1",
			value: summary.topLaunchSite.name,
			subvalue: `${d3.format(",")(summary.topLaunchSite.count).replace(/,/g, " ")} satellites`,
		},
	];

	const cards = svg.append("g").attr("transform", "translate(558, 164)");

	cards
		.selectAll("g")
		.data(stats)
		.join("g")
		.attr("transform", (_, index) => `translate(0, ${index * 112})`)
		.call((groups) => {
			groups
				.append("rect")
				.attr("width", 280)
				.attr("height", 86)
				.attr("rx", 18)
				.attr("fill", "rgba(15, 23, 42, 0.84)")
				.attr("stroke", "rgba(125, 211, 252, 0.15)");

			groups
				.append("text")
				.attr("x", 20)
				.attr("y", 28)
				.attr("fill", stagePalette.muted)
				.attr("font-size", 13)
				.attr("letter-spacing", "0.08em")
				.text((item) => item.label.toUpperCase());

			groups
				.append("text")
				.attr("x", 20)
				.attr("y", 58)
				.attr("fill", stagePalette.text)
				.attr("font-size", 26)
				.attr("font-weight", 700)
				.text((item) => item.value);

			groups
				.filter((item) => typeof item.subvalue === "string")
				.append("text")
				.attr("x", 20)
				.attr("y", 76)
				.attr("fill", stagePalette.highlight)
				.attr("font-size", 12)
				.text((item) => item.subvalue ?? "");
		});

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 80)
		.attr("fill", stagePalette.highlight)
		.attr("font-size", 15)
		.attr("letter-spacing", "0.18em")
		.text("RÉCIT VISUEL");

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 122)
		.attr("fill", stagePalette.text)
		.attr("font-size", 38)
		.attr("font-weight", 700)
		.text("Dynamiques et rapports");

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 162)
		.attr("fill", stagePalette.text)
		.attr("font-size", 38)
		.attr("font-weight", 700)
		.text("de force en orbite");
}
