import * as d3 from "d3";

import type { OrbitMissionDatum } from "../types";
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
import { stagePalette } from "./palette";
import type { TooltipController } from "./tooltip";
import { buildTooltip } from "./tooltipContent";

const BAR_RADIUS = 12;

function horizontalStackSegmentPath(
	x0: number,
	x1: number,
	y: number,
	h: number,
	r: number,
	roundLeft: boolean,
	roundRight: boolean,
): string {
	const w = x1 - x0;
	if (w <= 0) {
		return "";
	}
	const maxR = Math.min(r, h / 2, w / 2);
	const rl = roundLeft ? maxR : 0;
	const rr = roundRight ? maxR : 0;

	if (rl === 0 && rr === 0) {
		return `M${x0},${y}H${x1}V${y + h}H${x0}Z`;
	}
	if (rl > 0 && rr === 0) {
		return [
			`M${x0 + rl},${y}`,
			`H${x1}`,
			`V${y + h}`,
			`H${x0 + rl}`,
			`A${rl} ${rl} 0 0 1 ${x0},${y + h - rl}`,
			`V${y + rl}`,
			`A${rl} ${rl} 0 0 1 ${x0 + rl},${y}`,
			`Z`,
		].join("");
	}
	if (rl === 0 && rr > 0) {
		return [
			`M${x0},${y}`,
			`H${x1 - rr}`,
			`A${rr} ${rr} 0 0 1 ${x1},${y + rr}`,
			`V${y + h - rr}`,
			`A${rr} ${rr} 0 0 1 ${x1 - rr},${y + h}`,
			`H${x0}`,
			`V${y}`,
			`Z`,
		].join("");
	}
	return [
		`M${x0 + rl},${y}`,
		`H${x1 - rr}`,
		`A${rr} ${rr} 0 0 1 ${x1},${y + rr}`,
		`V${y + h - rr}`,
		`A${rr} ${rr} 0 0 1 ${x1 - rr},${y + h}`,
		`H${x0 + rl}`,
		`A${rl} ${rl} 0 0 1 ${x0},${y + h - rl}`,
		`V${y + rl}`,
		`A${rl} ${rl} 0 0 1 ${x0 + rl},${y}`,
		`Z`,
	].join("");
}

export function renderOrbitTypeBars(
	container: HTMLElement,
	data: OrbitMissionDatum[],
	tooltip: TooltipController,
) {
	const { width, height } = chartFrame;
	const margin = chartMargins.stackedBars;
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
			"Barres empilées par type d'orbite et mission commerciale",
		);
	const root = svg
		.append("g")
		.attr("transform", `translate(${margin.left}, ${margin.top})`);

	root
		.append("g")
		.call(d3.axisLeft(y).tickSize(0))
		.call((axis) =>
			styleAxis(axis, {
				hideDomain: true,
				hideTickLines: true,
				fontSize: 14,
				textColor: stagePalette.text,
			}),
		);

	root
		.append("g")
		.attr("transform", `translate(0, ${innerHeight})`)
		.call(
			d3
				.axisBottom(x)
				.ticks(5)
				.tickFormat((value) => formatCompactTick(Number(value))),
		)
		.call((axis) => styleAxis(axis));

	const segments = root
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
		.join("path")
		.attr("d", (item) => {
			const x0 = x(item.bounds[0]);
			const x1 = x(item.bounds[1]);
			const y0 = y(item.datum.typeOrbit) ?? 0;
			const h = y.bandwidth();
			const d = item.datum;
			if (item.key === "commercial") {
				return horizontalStackSegmentPath(
					x0,
					x1,
					y0,
					h,
					BAR_RADIUS,
					true,
					d.other === 0,
				);
			}
			return horizontalStackSegmentPath(
				x0,
				x1,
				y0,
				h,
				BAR_RADIUS,
				d.commercial === 0,
				true,
			);
		})
		.attr("shape-rendering", "geometricPrecision")
		.on("pointerenter", (event, item) => {
			highlight(item.datum.typeOrbit);
			tooltip.show(
				buildTooltip({
					title: item.datum.typeOrbit,
					rows: [
						{ label: "Commercial", value: formatCount(item.datum.commercial) },
						{ label: "Autres missions", value: formatCount(item.datum.other) },
						{
							label: "Part commerciale",
							value: formatPercent(item.datum.commercial / item.datum.total),
						},
					],
				}),
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => {
			highlight(null);
			tooltip.hide();
		});

	const shareLabels = root
		.selectAll(".orbit-share-label")
		.data(data)
		.join("text")
		.attr("x", (item) => x(item.total) + 12)
		.attr("y", (item) => (y(item.typeOrbit) ?? 0) + y.bandwidth() / 2 + 5)
		.attr("fill", stagePalette.text)
		.attr("font-size", chartTypography.dataLabel)
		.text(
			(item) => `${formatPercent(item.commercial / item.total)} commercial`,
		);

	function highlight(typeOrbit: string | null) {
		segments
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (item) =>
				!typeOrbit || item.datum.typeOrbit === typeOrbit
					? chartInteraction.idle
					: chartInteraction.muted,
			);

		shareLabels
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (item) =>
				!typeOrbit || item.typeOrbit === typeOrbit
					? chartInteraction.idle
					: chartInteraction.softMuted,
			);
	}

	const legend = svg
		.append("g")
		.attr(
			"transform",
			`translate(${margin.left}, ${margin.top + innerHeight + 30})`,
		);

	appendLegend(legend, {
		x: 0,
		y: 0,
		direction: "horizontal",
		items: [
			{
				label: "Commercial",
				color: colors.commercial,
				marker: { type: "rect" },
			},
			{
				label: "Autres missions",
				color: colors.other,
				marker: { type: "rect" },
			},
		],
	});

	appendChartHeader(
		svg,
		"Les missions commerciales privilégient quelques orbites",
		"Les orbites non polaires inclinées, polaires et héliosynchrones portent l'essentiel du marché.",
	);
}
