import * as d3 from "d3";

import type { OrbitScatterDatum } from "../types";
import { colorFromMap, orbitPalette, stagePalette } from "./palette";
import type { TooltipController } from "./tooltip";

export function renderOrbitScatter(
	container: HTMLElement,
	data: OrbitScatterDatum[],
	tooltip: TooltipController,
) {
	const width = 960;
	const height = 640;
	const margin = { top: 92, right: 170, bottom: 86, left: 98 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const x = d3.scaleLog().domain([100, 400000]).range([0, innerWidth]);
	const y = d3.scaleLog().domain([100, 400000]).range([innerHeight, 0]);
	const classes = [...new Set(data.map((item) => item.classOrbit))];
	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.attr("role", "img")
		.attr("aria-label", "Nuage de points sur les altitudes d'orbite");
	const root = svg
		.append("g")
		.attr("transform", `translate(${margin.left}, ${margin.top})`);
	const tickValues = [100, 300, 1000, 3000, 10000, 36000, 100000];

	root
		.append("g")
		.attr("transform", `translate(0, ${innerHeight})`)
		.call(
			d3
				.axisBottom(x)
				.tickValues(tickValues)
				.tickFormat(
					(value) => `${d3.format(",")(Number(value)).replace(/,/g, " ")} km`,
				),
		)
		.call((axis) => axis.select(".domain").attr("stroke", stagePalette.line))
		.call((axis) => axis.selectAll("line").attr("stroke", stagePalette.line))
		.call((axis) =>
			axis
				.selectAll("text")
				.attr("fill", stagePalette.muted)
				.attr("font-size", 12),
		);

	root
		.append("g")
		.call(
			d3
				.axisLeft(y)
				.tickValues(tickValues)
				.tickFormat(
					(value) => `${d3.format(",")(Number(value)).replace(/,/g, " ")} km`,
				),
		)
		.call((axis) => axis.select(".domain").attr("stroke", stagePalette.line))
		.call((axis) => axis.selectAll("line").attr("stroke", stagePalette.line))
		.call((axis) =>
			axis
				.selectAll("text")
				.attr("fill", stagePalette.muted)
				.attr("font-size", 12),
		);

	root
		.append("line")
		.attr("x1", x(100))
		.attr("y1", y(100))
		.attr("x2", x(400000))
		.attr("y2", y(400000))
		.attr("stroke", "rgba(255,255,255,0.35)")
		.attr("stroke-dasharray", "8 6");

	root
		.append("text")
		.attr("x", x(120000))
		.attr("y", y(180000))
		.attr("fill", stagePalette.muted)
		.attr("font-size", 12)
		.text("apogée = périgée");

	const points = root
		.append("g")
		.selectAll("circle")
		.data(data)
		.join("circle")
		.attr("cx", (item) => x(item.perigee))
		.attr("cy", (item) => y(item.apogee))
		.attr("r", 2.6)
		.attr("fill", (item) => colorFromMap(orbitPalette, item.classOrbit))
		.attr("fill-opacity", 0.54)
		.on("pointerenter", (event, item) => {
			tooltip.show(
				`<strong>${item.name}</strong><br>${item.classOrbit} / ${item.typeOrbit}<br>Périgée: ${d3.format(",")(item.perigee).replace(/,/g, " ")} km<br>Apogée: ${d3.format(",")(item.apogee).replace(/,/g, " ")} km`,
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => tooltip.hide());

	const updateHighlight = (orbitClass: string | null) => {
		points.style("opacity", (item) => {
			if (!orbitClass) {
				return 0.82;
			}
			return item.classOrbit === orbitClass ? 1 : 0.12;
		});
	};

	const legend = svg
		.append("g")
		.attr("transform", `translate(${width - 150}, 168)`);

	legend
		.selectAll("g")
		.data(classes)
		.join("g")
		.attr("transform", (_, index) => `translate(0, ${index * 32})`)
		.style("cursor", "pointer")
		.on("pointerenter", (_, orbitClass) => updateHighlight(orbitClass))
		.on("pointerleave", () => updateHighlight(null))
		.call((groups) => {
			groups
				.append("circle")
				.attr("cx", 6)
				.attr("cy", 6)
				.attr("r", 6)
				.attr("fill", (orbitClass) => colorFromMap(orbitPalette, orbitClass));

			groups
				.append("text")
				.attr("x", 20)
				.attr("y", 10)
				.attr("fill", stagePalette.text)
				.attr("font-size", 13)
				.text((orbitClass) => orbitClass);
		});

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 60)
		.attr("fill", stagePalette.text)
		.attr("font-size", 30)
		.attr("font-weight", 700)
		.text("L'espace est fortement concentré en orbite basse");

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 92)
		.attr("fill", stagePalette.muted)
		.attr("font-size", 15)
		.text(
			"Les échelles logarithmiques révèlent à la fois l'encombrement LEO et les orbites plus lointaines.",
		);

	root
		.append("text")
		.attr("x", innerWidth / 2)
		.attr("y", innerHeight + 58)
		.attr("text-anchor", "middle")
		.attr("fill", stagePalette.muted)
		.attr("font-size", 13)
		.text("Périgée (km)");

	root
		.append("text")
		.attr("transform", "rotate(-90)")
		.attr("x", -innerHeight / 2)
		.attr("y", -60)
		.attr("text-anchor", "middle")
		.attr("fill", stagePalette.muted)
		.attr("font-size", 13)
		.text("Apogée (km)");
}
