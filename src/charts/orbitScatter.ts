import * as d3 from "d3";

import type { OrbitScatterDatum } from "../types";
import { styleAxis } from "./axis";
import {
	appendAxisLabel,
	appendChartHeader,
	chartFrame,
	chartInteraction,
	chartMargins,
	chartTypography,
} from "./chartFrame";
import { formatKm } from "./formatters";
import { appendLegend } from "./legend";
import { colorFromMap, orbitPalette, stagePalette } from "./palette";
import type { TooltipController } from "./tooltip";
import { buildTooltip } from "./tooltipContent";

export function renderOrbitScatter(
	container: HTMLElement,
	data: OrbitScatterDatum[],
	tooltip: TooltipController,
) {
	const { width, height } = chartFrame;
	const margin = chartMargins.scatter;
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
				.tickFormat((value) => formatKm(Number(value))),
		)
		.call((axis) => styleAxis(axis));

	root
		.append("g")
		.call(
			d3
				.axisLeft(y)
				.tickValues(tickValues)
				.tickFormat((value) => formatKm(Number(value))),
		)
		.call((axis) => styleAxis(axis));

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
		.attr("font-size", chartTypography.annotation)
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
				buildTooltip({
					title: item.name,
					subtitle: `${item.classOrbit} / ${item.typeOrbit}`,
					rows: [
						{ label: "Périgée", value: formatKm(item.perigee) },
						{ label: "Apogée", value: formatKm(item.apogee) },
					],
				}),
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => tooltip.hide());

	const updateHighlight = (orbitClass: string | null) => {
		points
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (item) => {
				if (!orbitClass) {
					return chartInteraction.pointIdle;
				}
				return item.classOrbit === orbitClass
					? chartInteraction.idle
					: chartInteraction.faint;
			});
	};

	const legend = svg
		.append("g")
		.attr(
			"transform",
			`translate(${width - 150}, ${chartFrame.contentTop + 32})`,
		);

	appendLegend(legend, {
		title: "Classes d'orbite",
		x: 0,
		y: 0,
		items: classes.map((orbitClass) => ({
			label: orbitClass,
			color: colorFromMap(orbitPalette, orbitClass),
			onPointerEnter: () => updateHighlight(orbitClass),
			onPointerLeave: () => updateHighlight(null),
		})),
		rowGap: 32,
	});

	appendChartHeader(
		svg,
		"L'espace est fortement concentré en orbite basse",
		"Les échelles logarithmiques révèlent à la fois l'encombrement LEO et les orbites plus lointaines.",
	);

	appendAxisLabel(root, "Périgée (km)", innerWidth / 2, innerHeight + 58);
	appendAxisLabel(root, "Apogée (km)", -innerHeight / 2, -60, {
		rotate: -90,
	});
}
