import * as d3 from "d3";
import { styleAxis } from "../helpers/axis";
import {
	appendChartHeader,
	chartFrame,
	chartMargins,
} from "../helpers/chartFrame";
import { formatCount, formatDecimal } from "../helpers/formatters";
import { appendLegend } from "../helpers/legend";
import { stagePalette } from "../helpers/palette";
import type { TooltipController } from "../helpers/tooltip";
import { buildTooltip } from "../helpers/tooltipContent";
import type { ClusterMetric } from "../types";

interface LaunchCadenceData {
	clusters: ClusterMetric[];
}

interface CadenceSeries {
	id: "totalLaunchDates" | "groupedLaunchDates";
	label: string;
	color: string;
	values: { year: number; value: number; datum: ClusterMetric }[];
}

export function renderLaunchCadence(
	container: HTMLElement,
	timeline: LaunchCadenceData,
	tooltip: TooltipController,
) {
	const { width, height } = chartFrame;
	const margin = { ...chartMargins.timeline, right: 270, bottom: 82 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const data = timeline.clusters
		.filter((item) => item.totalLaunchDates > 0)
		.sort((left, right) => left.year - right.year);
	const years = data.map((item) => item.year);
	const xExtent = d3.extent(years) as [number, number];
	const x = d3.scaleLinear().domain(xExtent).range([0, innerWidth]);
	const y = d3
		.scaleLinear()
		.domain([
			0,
			d3.max(data, (item) =>
				Math.max(item.totalLaunchDates, item.groupedLaunchDates),
			) ?? 0,
		])
		.nice()
		.range([innerHeight, 0]);
	const series: CadenceSeries[] = [
		{
			id: "totalLaunchDates",
			label: "Lancements",
			color: stagePalette.highlight,
			values: data.map((datum) => ({
				year: datum.year,
				value: datum.totalLaunchDates,
				datum,
			})),
		},
		{
			id: "groupedLaunchDates",
			label: "Lancements groupés",
			color: "#e76f51",
			values: data.map((datum) => ({
				year: datum.year,
				value: datum.groupedLaunchDates,
				datum,
			})),
		},
	];
	const line = d3
		.line<CadenceSeries["values"][number]>()
		.x((item) => x(item.year))
		.y((item) => y(item.value))
		.curve(d3.curveMonotoneX);
	const tickCount = Math.max(5, Math.floor(innerWidth / 100));
	const xTicks = x.ticks(tickCount).filter((year) => Number.isInteger(year));

	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.attr("role", "img")
		.attr("aria-label", "Evolution des lancements et des lancements groupés");
	const root = svg
		.append("g")
		.attr("transform", `translate(${margin.left}, ${margin.top})`);

	root
		.append("g")
		.attr("class", "cadence-grid")
		.call(
			d3
				.axisLeft(y)
				.ticks(5)
				.tickSize(-innerWidth)
				.tickFormat(() => ""),
		)
		.call((axis) =>
			axis
				.selectAll("line")
				.attr("stroke", stagePalette.line)
				.attr("stroke-dasharray", "3 8"),
		)
		.call((axis) => axis.select(".domain").remove());

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

	const paths = root
		.selectAll<SVGPathElement, CadenceSeries>(".cadence-line")
		.data(series)
		.join("path")
		.attr("class", "cadence-line")
		.attr("fill", "none")
		.attr("stroke", (item) => item.color)
		.attr("stroke-width", 3)
		.attr("stroke-linecap", "round")
		.attr("stroke-linejoin", "round")
		.attr("d", (item) => line(item.values))
		.style("pointer-events", "none");

	const points = root
		.selectAll<
			SVGCircleElement,
			CadenceSeries["values"][number] & { series: CadenceSeries }
		>(".cadence-point")
		.data(
			series.flatMap((item) =>
				item.values.map((value) => ({ ...value, series: item })),
			),
		)
		.join("circle")
		.attr("class", "cadence-point")
		.attr("cx", (item) => x(item.year))
		.attr("cy", (item) => y(item.value))
		.attr("r", 4)
		.attr("fill", (item) => item.series.color)
		.attr("stroke", stagePalette.background)
		.attr("stroke-width", 1.5)
		.style("cursor", "pointer")
		.on("pointerenter", function handlePointerEnter(event, item) {
			highlightSeries(item.series.id, this);
			tooltip.show(
				buildTooltip({
					title: `${item.year}`,
					rows: [
						{
							label: "Lancements",
							value: formatCount(item.datum.totalLaunchDates),
						},
						{
							label: "Lancements groupés",
							value: formatCount(item.datum.groupedLaunchDates),
						},
						{
							label: "Satellites / lancement",
							value: formatDecimal(item.datum.avgSatellitesPerLaunchDate),
						},
					],
				}),
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => {
			highlightSeries(null);
			tooltip.hide();
		});

	function highlightSeries(
		seriesId: CadenceSeries["id"] | null,
		activePoint?: SVGCircleElement,
	) {
		paths
			.interrupt()
			.style("opacity", (item) =>
				!seriesId || item.id === seriesId ? 1 : 0.14,
			);

		points
			.interrupt()
			.attr("r", function setPointRadius() {
				return this === activePoint ? 5.5 : 4;
			})
			.attr("stroke-width", function setPointStroke() {
				return this === activePoint ? 2 : 1.5;
			})
			.style("opacity", (item) =>
				!seriesId || item.series.id === seriesId ? 1 : 0.22,
			);

		if (activePoint) {
			d3.select(activePoint).raise();
		}
	}

	const latest = data.at(-1);
	if (latest) {
		root
			.append("text")
			.attr("x", x(latest.year) + 10)
			.attr("y", y(latest.groupedLaunchDates) - 8)
			.attr("fill", "#e76f51")
			.attr("font-size", 12)
			.attr("font-weight", 600)
			.text(`${formatCount(latest.groupedLaunchDates)} groupées`);
	}

	appendLegend(svg, {
		x: width - 236,
		y: chartFrame.contentTop - 14,
		title: "Rythme annuel",
		items: series.map((item) => ({
			label: item.label,
			color: item.color,
			marker: { type: "line" as const, length: 22, strokeWidth: 3 },
		})),
	});

	appendChartHeader(
		svg,
		"Les lancements groupés deviennent la norme",
		"Deux courbes séparent le rythme des lancements et leur densification.",
	);
}
