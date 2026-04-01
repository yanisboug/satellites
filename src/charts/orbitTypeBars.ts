import * as d3 from "d3";

import type { OrbitMissionDatum } from "../types";
import { stagePalette } from "./palette";
import type { TooltipController } from "./tooltip";

export function renderOrbitTypeBars(
	container: HTMLElement,
	data: OrbitMissionDatum[],
	tooltip: TooltipController,
) {
	const width = 960;
	const height = 640;
	const margin = { top: 96, right: 130, bottom: 64, left: 220 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const y = d3
		.scaleBand<string>()
		.domain(data.map((item) => item.typeOrbit))
		.range([0, innerHeight])
		.padding(0.24);
	const x = d3
		.scaleLinear()
		.domain([0, d3.max(data, (item) => item.total) ?? 0])
		.range([0, innerWidth]);
	const stack = d3.stack<OrbitMissionDatum>().keys(["commercial", "other"]);
	const series = stack(data);
	const colors = {
		commercial: "#f4a261",
		other: "#64748b",
	};
	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.attr("role", "img")
		.attr(
			"aria-label",
			"Barres empilees par type d'orbite et mission commerciale",
		);
	const root = svg
		.append("g")
		.attr("transform", `translate(${margin.left}, ${margin.top})`);

	root
		.append("g")
		.call(d3.axisLeft(y).tickSize(0))
		.call((axis) => axis.select(".domain").remove())
		.call((axis) =>
			axis
				.selectAll("text")
				.attr("fill", stagePalette.text)
				.attr("font-size", 14),
		);

	root
		.append("g")
		.attr("transform", `translate(0, ${innerHeight})`)
		.call(
			d3
				.axisBottom(x)
				.ticks(5)
				.tickFormat((value) =>
					d3.format(".2s")(Number(value)).replace("G", "Md"),
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
		.selectAll(".stack")
		.data(series)
		.join("g")
		.attr("fill", (seriesItem) => colors[seriesItem.key as keyof typeof colors])
		.selectAll("rect")
		.data((seriesItem) =>
			seriesItem.map((item, index) => ({
				bounds: item,
				key: seriesItem.key as keyof typeof colors,
				datum: data[index],
			})),
		)
		.join("rect")
		.attr("x", (item) => x(item.bounds[0]))
		.attr("y", (item) => y(item.datum.typeOrbit) ?? 0)
		.attr("width", (item) => x(item.bounds[1]) - x(item.bounds[0]))
		.attr("height", y.bandwidth())
		.attr("rx", 12)
		.on("pointerenter", (event, item) => {
			tooltip.show(
				`<strong>${item.datum.typeOrbit}</strong><br>Commercial: ${d3.format(",")(item.datum.commercial).replace(/,/g, " ")}<br>Autres missions: ${d3.format(",")(item.datum.other).replace(/,/g, " ")}`,
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => tooltip.hide());

	root
		.selectAll(".orbit-share-label")
		.data(data)
		.join("text")
		.attr("x", (item) => x(item.total) + 12)
		.attr("y", (item) => (y(item.typeOrbit) ?? 0) + y.bandwidth() / 2 + 5)
		.attr("fill", stagePalette.text)
		.attr("font-size", 13)
		.text(
			(item) =>
				`${Math.round((item.commercial / item.total) * 100)} % commercial`,
		);

	const legend = svg.append("g").attr("transform", "translate(690, 150)");

	[
		{ label: "Commercial", color: colors.commercial },
		{ label: "Autres missions", color: colors.other },
	].forEach((item, index) => {
		const group = legend
			.append("g")
			.attr("transform", `translate(0, ${index * 30})`);
		group
			.append("rect")
			.attr("width", 14)
			.attr("height", 14)
			.attr("rx", 4)
			.attr("fill", item.color);
		group
			.append("text")
			.attr("x", 22)
			.attr("y", 11)
			.attr("fill", stagePalette.text)
			.attr("font-size", 13)
			.text(item.label);
	});

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 60)
		.attr("fill", stagePalette.text)
		.attr("font-size", 30)
		.attr("font-weight", 700)
		.text("Les missions commerciales privilegient quelques orbites");

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 92)
		.attr("fill", stagePalette.muted)
		.attr("font-size", 15)
		.text(
			"Les orbites non polaires inclinees, polaires et heliosynchrones portent l'essentiel du marche.",
		);
}
