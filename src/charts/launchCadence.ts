import * as d3 from "d3";
import {
	appendDataTable,
	appendFigureDescription,
	focusEventFromElement,
} from "../helpers/a11y";
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

const SECONDARY_COLOR = "#fda4af";

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
			color: SECONDARY_COLOR,
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
		.attr("viewBox", `0 0 ${width} ${height}`);

	const peakDatum = data.reduce<ClusterMetric | null>((acc, item) => {
		if (!acc || item.totalLaunchDates > acc.totalLaunchDates) {
			return item;
		}
		return acc;
	}, null);
	const firstYear = data[0]?.year;
	const lastDatum = data.at(-1);
	const description =
		firstYear !== undefined && lastDatum && peakDatum
			? `Entre ${firstYear} et ${lastDatum.year}, les lancements annuels passent de ${formatCount(data[0]?.totalLaunchDates ?? 0)} à ${formatCount(lastDatum.totalLaunchDates)}, dont ${formatCount(lastDatum.groupedLaunchDates)} en lancements groupés. Le pic annuel est atteint en ${peakDatum.year} avec ${formatCount(peakDatum.totalLaunchDates)} lancements.`
			: "Évolution annuelle des lancements et des lancements groupés.";

	appendFigureDescription({
		svg,
		title: "Évolution annuelle des lancements et des lancements groupés",
		description,
	});

	const root = svg
		.append("g")
		.attr("transform", `translate(${margin.left}, ${margin.top})`);

	root
		.append("g")
		.attr("class", "cadence-grid")
		.attr("aria-hidden", "true")
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
				.attr("stroke", "rgba(148, 163, 184, 0.45)")
				.attr("stroke-dasharray", "3 8"),
		)
		.call((axis) => axis.select(".domain").remove());

	const xAxis = root
		.append("g")
		.attr("aria-hidden", "true")
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
		.attr("aria-hidden", "true")
		.call(d3.axisLeft(y).ticks(5))
		.call((axis) => styleAxis(axis));

	const paths = root
		.selectAll<SVGPathElement, CadenceSeries>(".cadence-line")
		.data(series)
		.join("path")
		.attr("class", "cadence-line")
		.attr("aria-hidden", "true")
		.attr("fill", "none")
		.attr("stroke", (item) => item.color)
		.attr("stroke-width", 3)
		.attr("stroke-linecap", "round")
		.attr("stroke-linejoin", "round")
		.attr("stroke-dasharray", (item) =>
			item.id === "groupedLaunchDates" ? "8 6" : null,
		)
		.attr("d", (item) => line(item.values))
		.style("pointer-events", "none");

	const pointData = series.flatMap((item) =>
		item.values.map((value) => ({ ...value, series: item })),
	);

	const points = root
		.selectAll<SVGCircleElement, (typeof pointData)[number]>(".cadence-point")
		.data(pointData)
		.join("circle")
		.attr("class", "cadence-point")
		.attr("cx", (item) => x(item.year))
		.attr("cy", (item) => y(item.value))
		.attr("r", 4)
		.attr("fill", (item) => item.series.color)
		.attr("stroke", stagePalette.background)
		.attr("stroke-width", 1.5)
		.attr("tabindex", 0)
		.attr("role", "button")
		.attr("aria-describedby", tooltip.id)
		.attr("aria-label", (item) =>
			item.series.id === "totalLaunchDates"
				? `${item.year} : ${formatCount(item.datum.totalLaunchDates)} lancements, dont ${formatCount(item.datum.groupedLaunchDates)} groupés`
				: `${item.year} : ${formatCount(item.datum.groupedLaunchDates)} lancements groupés sur ${formatCount(item.datum.totalLaunchDates)} lancements`,
		)
		.style("cursor", "pointer");

	const showPointTooltip = (
		event: PointerEvent | MouseEvent,
		item: (typeof pointData)[number],
		element: SVGCircleElement,
	) => {
		highlightSeries(item.series.id, element);
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
	};

	points
		.on("pointerenter", function handlePointerEnter(event, item) {
			showPointTooltip(event, item, this);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => {
			highlightSeries(null);
			tooltip.hide();
		})
		.on("focus", function handleFocus(_event, item) {
			showPointTooltip(focusEventFromElement(this), item, this);
		})
		.on("blur", () => {
			highlightSeries(null);
			tooltip.hide();
		})
		.on("keydown", function handleKeydown(event, item) {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				showPointTooltip(focusEventFromElement(this), item, this);
			}
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

	if (lastDatum) {
		root
			.append("text")
			.attr("aria-hidden", "true")
			.attr("x", x(lastDatum.year) + 10)
			.attr("y", y(lastDatum.groupedLaunchDates) - 8)
			.attr("fill", SECONDARY_COLOR)
			.attr("font-size", 12)
			.attr("font-weight", 600)
			.text(`${formatCount(lastDatum.groupedLaunchDates)} groupées`);
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

	appendDataTable({
		container,
		caption:
			"Évolution annuelle des lancements totaux et des lancements groupés",
		summary: description,
		columns: [
			{ header: "Année", accessor: (row: ClusterMetric) => row.year },
			{
				header: "Lancements",
				accessor: (row: ClusterMetric) => formatCount(row.totalLaunchDates),
			},
			{
				header: "Lancements groupés",
				accessor: (row: ClusterMetric) => formatCount(row.groupedLaunchDates),
			},
			{
				header: "Satellites par lancement (moyenne)",
				accessor: (row: ClusterMetric) =>
					formatDecimal(row.avgSatellitesPerLaunchDate),
			},
		],
		rows: data,
	});
}
