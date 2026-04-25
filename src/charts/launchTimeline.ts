import * as d3 from "d3";
import { styleAxis } from "../helpers/axis";
import {
	appendChartHeader,
	chartFrame,
	chartInteraction,
	chartMargins,
} from "../helpers/chartFrame";
import { formatCount } from "../helpers/formatters";
import { appendLegend } from "../helpers/legend";
import type { TooltipController } from "../helpers/tooltip";
import { buildTooltip } from "../helpers/tooltipContent";
import type { YearSiteDatum } from "../types";

interface LaunchTimelineData {
	sites: string[];
	data: YearSiteDatum[];
}

export function renderLaunchTimeline(
	container: HTMLElement,
	timeline: LaunchTimelineData,
	tooltip: TooltipController,
) {
	const { width, height } = chartFrame;
	const margin = { ...chartMargins.timeline, right: 250, bottom: 92 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const years = [...new Set(timeline.data.map((item) => item.year))].sort(
		(left, right) => left - right,
	);
	const axisYears = years.filter((year) => year >= 2000);
	const maxTickCount = Math.max(6, Math.floor(innerWidth / 48));
	const tickStep = Math.max(1, Math.ceil(axisYears.length / maxTickCount));
	const xTicks = axisYears.filter(
		(year, index) => index % tickStep === 0 || year === axisYears.at(-1),
	);
	if (
		xTicks.length >= 2 &&
		xTicks[xTicks.length - 1] - xTicks[xTicks.length - 2] < tickStep
	) {
		xTicks.splice(xTicks.length - 2, 1);
	}
	const siteLabels = new Map(
		timeline.data.map((item) => [item.site, item.label]),
	);
	const stackedRows = years.map((year) => {
		const row = { year } as Record<string, number>;
		for (const site of timeline.sites) {
			row[site] =
				timeline.data.find((item) => item.year === year && item.site === site)
					?.count ?? 0;
		}
		return row;
	});
	const stack = d3.stack<Record<string, number>>().keys(timeline.sites);
	const series = stack(stackedRows);
	const x = d3
		.scaleBand<number>()
		.domain(years)
		.range([0, innerWidth])
		.padding(0.16);
	const y = d3
		.scaleLinear()
		.domain([
			0,
			d3.max(stackedRows, (row) =>
				d3.sum(timeline.sites, (site) => row[site] ?? 0),
			) ?? 0,
		])
		.nice()
		.range([innerHeight, 0]);
	const color = d3
		.scaleOrdinal<string, string>()
		.domain(timeline.sites)
		.range(["#2a9d8f", "#457b9d", "#e76f51", "#7a5195", "#e9c46a", "#64748b"]);
	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.attr("role", "img")
		.attr("aria-label", "Evolution des lancements par site");
	const root = svg
		.append("g")
		.attr("transform", `translate(${margin.left}, ${margin.top})`);

	const xAxis = root
		.append("g")
		.attr("transform", `translate(0, ${innerHeight})`)
		.call(
			d3
				.axisBottom(x)
				.tickValues(xTicks)
				.tickFormat((value) => d3.format("d")(Number(value))),
		)
		.call((axis) => styleAxis(axis));

	xAxis
		.selectAll<SVGTextElement, number>("text")
		.attr("text-anchor", "end")
		.attr("transform", "translate(-8, 10) rotate(-35)");

	root
		.append("g")
		.call(d3.axisLeft(y).ticks(5))
		.call((axis) => styleAxis(axis));

	const bars = root
		.selectAll(".launch-series")
		.data(series)
		.join("g")
		.attr("fill", (item) => color(item.key))
		.selectAll("rect")
		.data((item) => item.map((segment) => ({ ...segment, key: item.key })))
		.join("rect")
		.attr("x", (item) => x(item.data.year) ?? 0)
		.attr("y", (item) => y(item[1]))
		.attr("width", x.bandwidth())
		.attr("height", (item) => y(item[0]) - y(item[1]))
		.on("pointerenter", (event, item) => {
			highlightSite(item.key);
			const count = item.data[item.key] ?? 0;
			tooltip.show(
				buildTooltip({
					title: siteLabels.get(item.key) ?? item.key,
					subtitle: `${item.data.year}`,
					rows: [{ label: "Satellites", value: formatCount(count) }],
				}),
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => {
			highlightSite(null);
			tooltip.hide();
		});

	function highlightSite(site: string | null) {
		bars
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (item) =>
				!site || item.key === site
					? chartInteraction.idle
					: chartInteraction.muted,
			);
	}

	const legend = svg
		.append("g")
		.attr(
			"transform",
			`translate(${width - 210}, ${chartFrame.contentTop - 14})`,
		);

	appendLegend(legend, {
		x: 0,
		y: 0,
		title: "Sites et rythme",
		items: [
			...timeline.sites.map((site) => ({
				label: siteLabels.get(site) ?? site,
				color: color(site),
				marker: { type: "rect" as const },
				onPointerEnter: () => highlightSite(site),
				onPointerLeave: () => highlightSite(null),
			})),
		],
	});

	appendChartHeader(
		svg,
		"Une accélération récente, tirée par quelques bases",
		"Les barres suivent les sites dominants et isolent la concentration récente des volumes.",
	);
}
