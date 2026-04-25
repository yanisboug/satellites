import * as d3 from "d3";
import {
	appendChartHeader,
	chartFrame,
	chartInteraction,
	chartTypography,
} from "../helpers/chartFrame";
import { formatCount } from "../helpers/formatters";
import { stagePalette } from "../helpers/palette";
import type { TooltipController } from "../helpers/tooltip";
import { buildTooltip } from "../helpers/tooltipContent";
import type { FlowLinkDatum, FlowNodeDatum } from "../types";

interface FlowData {
	contractors: FlowNodeDatum[];
	sites: FlowNodeDatum[];
	links: FlowLinkDatum[];
}

interface MatrixCell {
	contractor: FlowNodeDatum;
	site: FlowNodeDatum;
	value: number;
}

function truncateLabel(value: string, maxLen: number) {
	const trimmed = value.trim();
	if (trimmed.length <= maxLen) {
		return trimmed;
	}
	if (maxLen < 2) {
		return "…";
	}
	return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}

const matrixMargin = {
	top: chartFrame.contentTop + 132,
	right: 80,
	bottom: 96,
	left: 328,
};

const rowLabelMaxChars = 40;
const columnLabelMaxChars = 20;
const columnLabelRotation = -55;

const cellPadding = 0.06;
const cellEmptyFill = "#152033";
const cellHighFill = "#7dd3fc";
const cellBorder = "rgba(148, 163, 184, 0.18)";
const cellFocusStroke = "#fde68a";
const bubbleFill = "#0f172a";
const bubbleStroke = "rgba(186, 230, 253, 0.75)";
const bubbleMinRadius = 2.5;
const legendGradientId = "contractor-flow-legend-gradient";
const legendWidth = 220;
const legendHeight = 8;

export function renderContractorFlow(
	container: HTMLElement,
	flow: FlowData,
	tooltip: TooltipController,
) {
	const { width, height } = chartFrame;
	const innerWidth = width - matrixMargin.left - matrixMargin.right;
	const innerHeight = height - matrixMargin.top - matrixMargin.bottom;
	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.style("overflow", "visible")
		.attr("role", "img")
		.attr(
			"aria-label",
			"Matrice de correspondance entre constructeurs et sites de lancement",
		);

	const valueLookup = new Map<string, number>();
	for (const link of flow.links) {
		valueLookup.set(`${link.source}__${link.target}`, link.value);
	}

	const cells: MatrixCell[] = [];
	for (const contractor of flow.contractors) {
		for (const site of flow.sites) {
			cells.push({
				contractor,
				site,
				value: valueLookup.get(`${contractor.id}__${site.id}`) ?? 0,
			});
		}
	}

	const maxValue = d3.max(cells, (cell) => cell.value) ?? 0;
	const x = d3
		.scaleBand<string>()
		.domain(flow.sites.map((site) => site.id))
		.range([0, innerWidth])
		.padding(cellPadding);
	const y = d3
		.scaleBand<string>()
		.domain(flow.contractors.map((contractor) => contractor.id))
		.range([0, innerHeight])
		.padding(cellPadding);
	const cellWidth = x.bandwidth();
	const cellHeight = y.bandwidth();
	const radiusScale = d3
		.scaleSqrt()
		.domain([0, maxValue])
		.range([0, Math.min(cellWidth, cellHeight) / 2 - 5]);
	const intensityScale = d3
		.scaleSqrt()
		.domain([0, maxValue])
		.range([0, 1])
		.clamp(true);
	const intensityColor = (value: number) =>
		d3.interpolateRgb(cellEmptyFill, cellHighFill)(intensityScale(value));

	svg
		.append("defs")
		.append("linearGradient")
		.attr("id", legendGradientId)
		.attr("x1", "0%")
		.attr("x2", "100%")
		.call((gradient) => {
			gradient
				.append("stop")
				.attr("offset", "0%")
				.attr("stop-color", cellEmptyFill);
			gradient
				.append("stop")
				.attr("offset", "100%")
				.attr("stop-color", cellHighFill);
		});

	const matrix = svg
		.append("g")
		.attr("transform", `translate(${matrixMargin.left}, ${matrixMargin.top})`);

	matrix
		.append("g")
		.selectAll("g.row-label")
		.data(flow.contractors)
		.join("g")
		.attr("class", "row-label")
		.attr(
			"transform",
			(contractor) =>
				`translate(0, ${(y(contractor.id) ?? 0) + cellHeight / 2})`,
		)
		.each(function (contractor) {
			const g = d3.select(this);
			const short = truncateLabel(contractor.label, rowLabelMaxChars);
			g.append("text")
				.attr("x", -16)
				.attr("y", 0)
				.attr("text-anchor", "end")
				.attr("dominant-baseline", "middle")
				.attr("fill", stagePalette.text)
				.attr("font-size", chartTypography.legendLabel)
				.attr("font-weight", 600)
				.text(short);
			if (short !== contractor.label) {
				g.append("title").text(contractor.label);
			}
		});

	matrix
		.append("g")
		.selectAll("g.col-label")
		.data(flow.sites)
		.join("g")
		.attr("class", "col-label")
		.attr(
			"transform",
			(site) =>
				`translate(${(x(site.id) ?? 0) + cellWidth / 2}, -12) rotate(${columnLabelRotation})`,
		)
		.each(function (site) {
			const g = d3.select(this);
			const short = truncateLabel(site.label, columnLabelMaxChars);
			g.append("text")
				.attr("x", 0)
				.attr("y", 0)
				.attr("text-anchor", "start")
				.attr("dominant-baseline", "middle")
				.attr("fill", stagePalette.text)
				.attr("font-size", chartTypography.axisTick)
				.attr("font-weight", 600)
				.text(short);
			if (short !== site.label) {
				g.append("title").text(site.label);
			}
		});

	const cellGroups = matrix
		.append("g")
		.selectAll<SVGGElement, MatrixCell>("g.matrix-cell")
		.data(cells)
		.join("g")
		.attr("class", "matrix-cell")
		.attr(
			"transform",
			(cell) =>
				`translate(${x(cell.site.id) ?? 0}, ${y(cell.contractor.id) ?? 0})`,
		)
		.attr("tabindex", (cell) => (cell.value > 0 ? 0 : -1))
		.attr("role", "img")
		.attr(
			"aria-label",
			(cell) =>
				`${cell.contractor.label} vers ${cell.site.label}: ${formatCount(cell.value)} satellites`,
		)
		.style("cursor", "pointer")
		.style("outline", "none");

	cellGroups
		.append("title")
		.text(
			(cell) =>
				`${cell.contractor.label} → ${cell.site.label} : ${formatCount(cell.value)} satellites`,
		);

	cellGroups
		.append("rect")
		.attr("width", cellWidth)
		.attr("height", cellHeight)
		.attr("fill", (cell) => intensityColor(cell.value))
		.attr("stroke", cellBorder)
		.attr("stroke-width", 1);

	cellGroups
		.append("circle")
		.attr("cx", cellWidth / 2)
		.attr("cy", cellHeight / 2)
		.attr("r", (cell) =>
			cell.value === 0 ? 0 : Math.max(bubbleMinRadius, radiusScale(cell.value)),
		)
		.attr("fill", bubbleFill)
		.attr("fill-opacity", 0.9)
		.attr("stroke", bubbleStroke)
		.attr("stroke-width", 1);

	const highlight = (active: MatrixCell | null) => {
		cellGroups
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (cell) => {
				if (!active) {
					return chartInteraction.idle;
				}
				if (
					cell.contractor.id === active.contractor.id ||
					cell.site.id === active.site.id
				) {
					return chartInteraction.idle;
				}
				return chartInteraction.muted;
			});

		cellGroups
			.select<SVGRectElement>("rect")
			.attr("stroke", (cell) =>
				active && cell === active ? cellFocusStroke : cellBorder,
			)
			.attr("stroke-width", (cell) => (active && cell === active ? 2 : 1));
	};

	const presentCell = (cell: MatrixCell, event: PointerEvent | MouseEvent) => {
		highlight(cell);
		tooltip.show(
			buildTooltip({
				title: `${cell.contractor.label} → ${cell.site.label}`,
				rows: [{ label: "Satellites lancés", value: formatCount(cell.value) }],
			}),
			event,
		);
	};

	cellGroups
		.on("pointerenter", (event, cell) => presentCell(cell, event))
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => {
			highlight(null);
			tooltip.hide();
		})
		.on("focus", function handleFocus(_event, cell) {
			const node = this as SVGGElement;
			const rect = node.getBoundingClientRect();
			const synthetic = new MouseEvent("focus", {
				clientX: rect.left + rect.width / 2,
				clientY: rect.top + rect.height / 2,
			});
			presentCell(cell, synthetic);
		})
		.on("blur", () => {
			highlight(null);
			tooltip.hide();
		});

	appendChartHeader(
		svg,
		"Des chaînes logistiques fortement concentrées",
		"La taille des bulles et l'éclat des cellules signalent les routes les plus chargées entre constructeurs et sites de lancement.",
	);

	const axisLabelY = matrixMargin.top + innerHeight + 30;

	svg
		.append("text")
		.attr("x", matrixMargin.left + innerWidth / 2)
		.attr("y", axisLabelY)
		.attr("text-anchor", "middle")
		.attr("fill", stagePalette.text)
		.attr("font-size", chartTypography.axisLabel)
		.attr("font-weight", 600)
		.text("Site de lancement");

	const legendX = width - matrixMargin.right - legendWidth;
	const legendY = axisLabelY + 20;

	const legend = svg
		.append("g")
		.attr("transform", `translate(${legendX}, ${legendY})`);

	legend
		.append("rect")
		.attr("width", legendWidth)
		.attr("height", legendHeight)
		.attr("rx", 4)
		.attr("fill", `url(#${legendGradientId})`)
		.attr("stroke", cellBorder);

	legend
		.append("text")
		.attr("x", 0)
		.attr("y", legendHeight + 16)
		.attr("fill", stagePalette.muted)
		.attr("font-size", chartTypography.annotation)
		.text("Faible volume");

	legend
		.append("text")
		.attr("x", legendWidth)
		.attr("y", legendHeight + 16)
		.attr("text-anchor", "end")
		.attr("fill", stagePalette.muted)
		.attr("font-size", chartTypography.annotation)
		.text("Volume élevé");
}
