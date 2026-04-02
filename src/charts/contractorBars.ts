import * as d3 from "d3";

import type { ContractorDatum } from "../types";
import { colorFromMap, countryPalette, stagePalette } from "./palette";
import type { TooltipController } from "./tooltip";

export function renderContractorBars(
	container: HTMLElement,
	data: ContractorDatum[],
	tooltip: TooltipController,
) {
	const width = 960;
	const height = 640;
	const margin = { top: 86, right: 220, bottom: 48, left: 210 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const x = d3
		.scaleLinear()
		.domain([0, d3.max(data, (item) => item.count) ?? 0])
		.range([0, innerWidth]);
	const y = d3
		.scaleBand<string>()
		.domain(data.map((item) => item.name))
		.range([0, innerHeight])
		.padding(0.22);
	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.attr("role", "img")
		.attr("aria-label", "Top 5 des constructeurs de satellites");
	const root = svg
		.append("g")
		.attr("transform", `translate(${margin.left}, ${margin.top})`);

	root
		.append("g")
		.attr("class", "grid")
		.call(
			d3
				.axisTop(x)
				.ticks(5)
				.tickSize(-innerHeight)
				.tickFormat((value) =>
					d3.format(".2s")(Number(value)).replace("G", "Md"),
				),
		)
		.call((axis) => axis.select(".domain").remove())
		.call((axis) => axis.selectAll("line").attr("stroke", stagePalette.line))
		.call((axis) =>
			axis
				.selectAll("text")
				.attr("fill", stagePalette.muted)
				.attr("font-size", 12),
		);

	const rows = root
		.selectAll(".contractor-row")
		.data(data)
		.join("g")
		.attr("class", "contractor-row")
		.attr("transform", (item) => `translate(0, ${y(item.name) ?? 0})`);

	rows
		.append("rect")
		.attr("class", "bar-backdrop")
		.attr("width", innerWidth)
		.attr("height", y.bandwidth())
		.attr("rx", 14)
		.attr("fill", "rgba(148, 163, 184, 0.08)");

	rows
		.append("rect")
		.attr("class", "bar-fill")
		.attr("width", (item) => x(item.count))
		.attr("height", y.bandwidth())
		.attr("rx", 14)
		.attr("fill", (item) =>
			colorFromMap(countryPalette, item.country, countryPalette.get("Autre")),
		)
		.on("pointerenter", (event, item) => {
			tooltip.show(
				`<strong>${item.name}</strong><br>${d3.format(",")(item.count).replace(/,/g, " ")} satellites<br>${Math.round(item.share * 100)} % du parc actif`,
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => tooltip.hide());

	rows
		.append("text")
		.attr("x", -18)
		.attr("y", y.bandwidth() / 2)
		.attr("text-anchor", "end")
		.attr("dominant-baseline", "middle")
		.attr("fill", stagePalette.text)
		.attr("font-size", 16)
		.attr("font-weight", 600)
		.text((item) => item.name);

	rows
		.append("text")
		.attr("x", (item) => x(item.count) + 14)
		.attr("y", y.bandwidth() / 2 - 8)
		.attr("fill", stagePalette.text)
		.attr("dominant-baseline", "middle")
		.attr("font-size", 15)
		.attr("font-weight", 600)
		.text((item) => d3.format(",")(item.count).replace(/,/g, " "));

	rows
		.append("text")
		.attr("x", (item) => x(item.count) + 14)
		.attr("y", y.bandwidth() / 2 + 12)
		.attr("fill", stagePalette.muted)
		.attr("dominant-baseline", "middle")
		.attr("font-size", 12)
		.text((item) => `${Math.round(item.share * 100)} % du marché`);

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 60)
		.attr("fill", stagePalette.text)
		.attr("font-size", 30)
		.attr("font-weight", 700)
		.text("Les grands maîtres de la fabrication");

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 92)
		.attr("fill", stagePalette.muted)
		.attr("font-size", 15)
		.text(
			"Top 5 des constructeurs mondiaux, avec une lecture absolue et relative.",
		);

	const countries = [...new Set(data.map((item) => item.country))];
	const legend = svg
		.append("g")
		.attr("transform", `translate(${width - 190}, 170)`);

	const updateHighlight = (country: string | null) => {
		rows
			.transition()
			.duration(180)
			.style("opacity", (item) => {
				if (!country) {
					return 1;
				}
				return item.country === country ? 1 : 0.22;
			});
	};

	legend
		.selectAll("g")
		.data(countries)
		.join("g")
		.attr("transform", (_, index) => `translate(0, ${index * 34})`)
		.style("cursor", "pointer")
		.on("pointerenter", (_, country) => updateHighlight(country))
		.on("pointerleave", () => updateHighlight(null))
		.call((groups) => {
			groups
				.append("circle")
				.attr("r", 7)
				.attr("cx", 7)
				.attr("cy", 7)
				.attr("fill", (country) =>
					colorFromMap(countryPalette, country, countryPalette.get("Autre")),
				);

			groups
				.append("text")
				.attr("x", 24)
				.attr("y", 12)
				.attr("fill", stagePalette.text)
				.attr("font-size", 13)
				.text((country) => country);
		});

	legend
		.append("text")
		.attr("x", 0)
		.attr("y", -18)
		.attr("fill", stagePalette.highlight)
		.attr("font-size", 12)
		.attr("letter-spacing", "0.12em")
		.text("PAYS D'ORIGINE");
}
