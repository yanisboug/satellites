import * as d3 from "d3";
import { styleAxis } from "../helpers/axis";
import {
	appendChartHeader,
	chartFrame,
	chartInteraction,
	chartMargins,
} from "../helpers/chartFrame";
import { formatCount, formatDecimal } from "../helpers/formatters";
import { appendLegend } from "../helpers/legend";
import { stagePalette } from "../helpers/palette";
import type { TooltipController } from "../helpers/tooltip";
import { buildTooltip } from "../helpers/tooltipContent";
import type { ClusterMetric, YearSiteDatum } from "../types";

interface LaunchTimelineData {
	sites: string[];
	data: YearSiteDatum[];
	clusters: ClusterMetric[];
}

export function renderLaunchTimeline(
	container: HTMLElement,
	timeline: LaunchTimelineData,
	tooltip: TooltipController,
) {
	const { width, height } = chartFrame;
	const margin = chartMargins.timeline;
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const years = [...new Set(timeline.data.map((item) => item.year))].sort(
		(left, right) => left - right,
	);
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
	const clusterScale = d3
		.scaleLinear()
		.domain([
			0,
			d3.max(timeline.clusters, (item) => item.avgSatellitesPerLaunchDate) ?? 0,
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

	root
		.append("g")
		.attr("transform", `translate(0, ${innerHeight})`)
		.call(d3.axisBottom(x).tickValues(years.filter((year) => year >= 2000)))
		.call((axis) => styleAxis(axis));

	root
		.append("g")
		.call(d3.axisLeft(y).ticks(5))
		.call((axis) => styleAxis(axis));

	root
		.append("g")
		.attr("transform", `translate(${innerWidth}, 0)`)
		.call(d3.axisRight(clusterScale).ticks(4))
		.call((axis) => styleAxis(axis, { textColor: stagePalette.highlight }));

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

	const line = d3
		.line<ClusterMetric>()
		.x((item) => (x(item.year) ?? 0) + x.bandwidth() / 2)
		.y((item) => clusterScale(item.avgSatellitesPerLaunchDate))
		.curve(d3.curveMonotoneX);

	const clusterPath = root
		.append("path")
		.datum(timeline.clusters.filter((item) => item.year >= years[0]))
		.attr("fill", "none")
		.attr("stroke", stagePalette.highlight)
		.attr("stroke-width", 3)
		.attr("d", line);

	const clusterPoints = root
		.selectAll(".cluster-point")
		.data(timeline.clusters)
		.join("circle")
		.attr("class", "cluster-point")
		.attr("cx", (item) => (x(item.year) ?? 0) + x.bandwidth() / 2)
		.attr("cy", (item) => clusterScale(item.avgSatellitesPerLaunchDate))
		.attr("r", 4.5)
		.attr("fill", stagePalette.highlight)
		.on("pointerenter", (event, item) => {
			highlightCluster(true);
			tooltip.show(
				buildTooltip({
					title: `${item.year}`,
					rows: [
						{
							label: "Satellites / date",
							value: formatDecimal(item.avgSatellitesPerLaunchDate),
						},
						{
							label: "Pic journalier",
							value: formatCount(item.maxSatellitesOnSingleDate),
						},
					],
				}),
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => {
			highlightCluster(false);
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

	function highlightCluster(active: boolean) {
		clusterPath
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style(
				"opacity",
				active ? chartInteraction.active : chartInteraction.idle,
			);

		clusterPoints
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style(
				"opacity",
				active ? chartInteraction.active : chartInteraction.idle,
			);
	}

	const legend = svg
		.append("g")
		.attr("transform", `translate(620, ${chartFrame.contentTop - 14})`);

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
			{
				label: "Satellites par date de lancement",
				color: stagePalette.highlight,
				marker: { type: "line" as const },
				onPointerEnter: () => highlightCluster(true),
				onPointerLeave: () => highlightCluster(false),
			},
		],
	});

	appendChartHeader(
		svg,
		"Une accélération récente, tirée par quelques bases",
		"Les barres suivent les sites dominants; la ligne souligne l'essor des lancements groupés.",
	);
}
