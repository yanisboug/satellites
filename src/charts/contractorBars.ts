import * as d3 from "d3";

import type { ContractorDatum } from "../types";
import { styleAxis } from "./axis";
import {
	appendChartHeader,
	chartFrame,
	chartInteraction,
	chartMargins,
	chartTypography,
} from "./chartFrame";
import { formatCompactTick, formatCount, formatPercent } from "./formatters";
import { appendLegend } from "./legend";
import { colorFromMap, countryPalette, stagePalette } from "./palette";
import type { TooltipController } from "./tooltip";
import { buildTooltip } from "./tooltipContent";

export function renderContractorBars(
	container: HTMLElement,
	data: ContractorDatum[],
	tooltip: TooltipController,
) {
	const { width, height } = chartFrame;
	const margin = chartMargins.barLegendWide;
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
				.tickFormat((value) => formatCompactTick(Number(value))),
		)
		.call((axis) => styleAxis(axis, { hideDomain: true }));

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
				buildTooltip({
					title: item.name,
					rows: [
						{ label: "Satellites actifs", value: formatCount(item.count) },
						{ label: "Part du parc", value: formatPercent(item.share) },
					],
				}),
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
		.attr("font-size", chartTypography.rowLabel)
		.attr("font-weight", 600)
		.text((item) => item.name);

	rows
		.append("text")
		.attr("x", (item) => x(item.count) + 14)
		.attr("y", y.bandwidth() / 2 - 8)
		.attr("fill", stagePalette.text)
		.attr("dominant-baseline", "middle")
		.attr("font-size", chartTypography.rowValue)
		.attr("font-weight", 600)
		.text((item) => formatCount(item.count));

	rows
		.append("text")
		.attr("x", (item) => x(item.count) + 14)
		.attr("y", y.bandwidth() / 2 + 12)
		.attr("fill", stagePalette.muted)
		.attr("dominant-baseline", "middle")
		.attr("font-size", chartTypography.rowMeta)
		.text((item) => `${formatPercent(item.share)} du marché`);

	appendChartHeader(
		svg,
		"Les grands maîtres de la fabrication",
		"Top 5 des constructeurs mondiaux, avec une lecture absolue et relative.",
	);

	const countries = [...new Set(data.map((item) => item.country))];
	const legend = svg
		.append("g")
		.attr(
			"transform",
			`translate(${width - 150}, ${chartFrame.contentTop + 62})`,
		);

	const updateHighlight = (country: string | null) => {
		rows
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (item) => {
				if (!country) {
					return chartInteraction.idle;
				}
				return item.country === country
					? chartInteraction.idle
					: chartInteraction.muted;
			});
	};

	appendLegend(legend, {
		title: "Pays d'origine",
		x: 0,
		y: 0,
		items: countries.map((country) => ({
			label: country,
			color: colorFromMap(countryPalette, country, countryPalette.get("Autre")),
			onPointerEnter: () => updateHighlight(country),
			onPointerLeave: () => updateHighlight(null),
		})),
		rowGap: 34,
	});
}
