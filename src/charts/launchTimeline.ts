import * as d3 from "d3";

import type { ClusterMetric, YearSiteDatum } from "../types";
import { stagePalette } from "./palette";
import type { TooltipController } from "./tooltip";

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
	const width = 960;
	const height = 640;
	const margin = { top: 96, right: 90, bottom: 66, left: 78 };
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
		.call(d3.axisLeft(y).ticks(5))
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
		.attr("transform", `translate(${innerWidth}, 0)`)
		.call(d3.axisRight(clusterScale).ticks(4))
		.call((axis) => axis.select(".domain").attr("stroke", stagePalette.line))
		.call((axis) => axis.selectAll("line").attr("stroke", stagePalette.line))
		.call((axis) =>
			axis
				.selectAll("text")
				.attr("fill", stagePalette.highlight)
				.attr("font-size", 12),
		);

	root
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
			const count = item.data[item.key] ?? 0;
			tooltip.show(
				`<strong>${siteLabels.get(item.key) ?? item.key}</strong><br>${item.data.year}<br>${d3.format(",")(count).replace(/,/g, " ")} satellites`,
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => tooltip.hide());

	const line = d3
		.line<ClusterMetric>()
		.x((item) => (x(item.year) ?? 0) + x.bandwidth() / 2)
		.y((item) => clusterScale(item.avgSatellitesPerLaunchDate))
		.curve(d3.curveMonotoneX);

	root
		.append("path")
		.datum(timeline.clusters.filter((item) => item.year >= years[0]))
		.attr("fill", "none")
		.attr("stroke", stagePalette.highlight)
		.attr("stroke-width", 3)
		.attr("d", line);

	root
		.selectAll(".cluster-point")
		.data(timeline.clusters)
		.join("circle")
		.attr("class", "cluster-point")
		.attr("cx", (item) => (x(item.year) ?? 0) + x.bandwidth() / 2)
		.attr("cy", (item) => clusterScale(item.avgSatellitesPerLaunchDate))
		.attr("r", 4.5)
		.attr("fill", stagePalette.highlight)
		.on("pointerenter", (event, item) => {
			tooltip.show(
				`<strong>${item.year}</strong><br>${item.avgSatellitesPerLaunchDate.toFixed(1)} satellites par date de lancement<br>Pic journalier: ${item.maxSatellitesOnSingleDate}`,
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => tooltip.hide());

	const legend = svg.append("g").attr("transform", "translate(620, 122)");

	timeline.sites.forEach((site, index) => {
		const group = legend
			.append("g")
			.attr("transform", `translate(0, ${index * 28})`);
		group
			.append("rect")
			.attr("width", 14)
			.attr("height", 14)
			.attr("rx", 4)
			.attr("fill", color(site));
		group
			.append("text")
			.attr("x", 22)
			.attr("y", 11)
			.attr("fill", stagePalette.text)
			.attr("font-size", 12)
			.text(siteLabels.get(site) ?? site);
	});

	legend
		.append("line")
		.attr("x1", 0)
		.attr("x2", 18)
		.attr("y1", timeline.sites.length * 28 + 12)
		.attr("y2", timeline.sites.length * 28 + 12)
		.attr("stroke", stagePalette.highlight)
		.attr("stroke-width", 3);

	legend
		.append("text")
		.attr("x", 24)
		.attr("y", timeline.sites.length * 28 + 16)
		.attr("fill", stagePalette.highlight)
		.attr("font-size", 12)
		.text("Satellites par date de lancement");

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 60)
		.attr("fill", stagePalette.text)
		.attr("font-size", 30)
		.attr("font-weight", 700)
		.text("Une accélération récente, tirée par quelques bases");

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 92)
		.attr("fill", stagePalette.muted)
		.attr("font-size", 15)
		.text(
			"Les barres suivent les sites dominants; la ligne souligne l'essor des lancements groupés.",
		);
}
