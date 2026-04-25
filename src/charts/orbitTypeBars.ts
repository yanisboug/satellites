import * as d3 from "d3";
import {
	appendDataTable,
	appendFigureDescription,
	bindTooltipInteractions,
} from "../helpers/a11y";
import { styleAxis } from "../helpers/axis";
import {
	appendChartHeader,
	chartFrame,
	chartInteraction,
	chartMargins,
	chartTypography,
} from "../helpers/chartFrame";
import {
	formatCompactTick,
	formatCount,
	formatPercent,
} from "../helpers/formatters";
import { appendLegend } from "../helpers/legend";
import { stagePalette } from "../helpers/palette";
import type { TooltipController } from "../helpers/tooltip";
import { buildTooltip } from "../helpers/tooltipContent";
import type { OrbitMissionDatum } from "../types";

const BAR_RADIUS = 12;
const COLORS = {
	commercial: "#fdba74",
	other: "#475569",
} as const;
const STRIPE_PATTERN_ID = "orbit-type-stripes";

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
	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`);

	const totalCommercial = d3.sum(data, (item) => item.commercial);
	const totalAll = d3.sum(data, (item) => item.total) || 1;
	const sortedByShare = [...data].sort(
		(left, right) =>
			right.commercial / Math.max(1, right.total) -
			left.commercial / Math.max(1, left.total),
	);
	const topShare = sortedByShare[0];
	const bottomShare = sortedByShare.at(-1);
	const description =
		topShare && bottomShare
			? `Sur ${data.length} types d'orbite, les missions commerciales représentent ${formatPercent(totalCommercial / totalAll)} de l'ensemble. La part commerciale culmine à ${formatPercent(topShare.commercial / Math.max(1, topShare.total))} pour ${topShare.typeOrbit} et descend à ${formatPercent(bottomShare.commercial / Math.max(1, bottomShare.total))} pour ${bottomShare.typeOrbit}.`
			: "Répartition des missions commerciales et autres par type d'orbite.";

	appendFigureDescription({
		svg,
		title: "Missions commerciales et autres par type d'orbite",
		description,
	});

	const defs = svg.append("defs");
	const pattern = defs
		.append("pattern")
		.attr("id", STRIPE_PATTERN_ID)
		.attr("patternUnits", "userSpaceOnUse")
		.attr("width", 6)
		.attr("height", 6)
		.attr("patternTransform", "rotate(45)");
	pattern
		.append("rect")
		.attr("width", 6)
		.attr("height", 6)
		.attr("fill", COLORS.other);
	pattern
		.append("line")
		.attr("x1", 0)
		.attr("x2", 0)
		.attr("y1", 0)
		.attr("y2", 6)
		.attr("stroke", "rgba(226, 232, 240, 0.55)")
		.attr("stroke-width", 1.4);

	const root = svg
		.append("g")
		.attr("transform", `translate(${margin.left}, ${margin.top})`);

	root
		.append("g")
		.attr("aria-hidden", "true")
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
		.attr("aria-hidden", "true")
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
		.attr(
			"fill",
			(seriesItem) =>
				(seriesItem.key === "commercial"
					? COLORS.commercial
					: `url(#${STRIPE_PATTERN_ID})`) as string,
		)
		.selectAll<
			SVGPathElement,
			{
				bounds: d3.SeriesPoint<OrbitMissionDatum>;
				key: keyof typeof COLORS;
				datum: OrbitMissionDatum;
			}
		>("path")
		.data((seriesItem) =>
			seriesItem.map((item, index) => ({
				bounds: item,
				key: seriesItem.key as keyof typeof COLORS,
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
		.attr("tabindex", 0)
		.attr("role", "button")
		.attr("aria-describedby", tooltip.id)
		.attr("aria-label", (item) =>
			item.key === "commercial"
				? `${item.datum.typeOrbit}, missions commerciales : ${formatCount(item.datum.commercial)} satellites (${formatPercent(item.datum.commercial / Math.max(1, item.datum.total))} du type)`
				: `${item.datum.typeOrbit}, autres missions : ${formatCount(item.datum.other)} satellites (${formatPercent(item.datum.other / Math.max(1, item.datum.total))} du type)`,
		)
		.style("cursor", "pointer");

	const showSegmentTooltip = (
		event: PointerEvent | MouseEvent,
		item: { datum: OrbitMissionDatum },
	) => {
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
	};

	bindTooltipInteractions(segments, {
		show: (event, item) => showSegmentTooltip(event, item),
		move: (event) => tooltip.move(event),
		hide: () => {
			highlight(null);
			tooltip.hide();
		},
	});

	const shareLabels = root
		.selectAll(".orbit-share-label")
		.data(data)
		.join("text")
		.attr("aria-hidden", "true")
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
				color: COLORS.commercial,
				marker: { type: "rect" },
			},
			{
				label: "Autres missions (hachures)",
				color: COLORS.other,
				marker: { type: "rect" },
			},
		],
	});

	appendChartHeader(
		svg,
		"Les missions commerciales privilégient quelques orbites",
		"Les orbites non polaires inclinées, polaires et héliosynchrones portent l'essentiel du marché.",
	);

	appendDataTable({
		container,
		caption: "Missions commerciales et autres par type d'orbite",
		summary: description,
		columns: [
			{
				header: "Type d'orbite",
				accessor: (row: OrbitMissionDatum) => row.typeOrbit,
			},
			{
				header: "Commercial",
				accessor: (row: OrbitMissionDatum) => formatCount(row.commercial),
			},
			{
				header: "Autres missions",
				accessor: (row: OrbitMissionDatum) => formatCount(row.other),
			},
			{
				header: "Total",
				accessor: (row: OrbitMissionDatum) => formatCount(row.total),
			},
			{
				header: "Part commerciale",
				accessor: (row: OrbitMissionDatum) =>
					formatPercent(row.commercial / Math.max(1, row.total)),
			},
		],
		rows: data,
	});
}
