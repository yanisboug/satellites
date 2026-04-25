import * as d3 from "d3";
import {
	appendAxisLabel,
	appendChartHeader,
	appendSectionLabel,
	chartFrame,
	chartInteraction,
	chartTypography,
} from "../helpers/chartFrame";
import { formatCount, formatPercent } from "../helpers/formatters";
import { stagePalette } from "../helpers/palette";
import type { TooltipController } from "../helpers/tooltip";
import { buildTooltip } from "../helpers/tooltipContent";
import type { DerivedMetrics, FlowNodeDatum } from "../types";

type FlowData = DerivedMetrics["flow"];

interface MatrixCell {
	contractor: FlowNodeDatum;
	site: FlowNodeDatum;
	row: number;
	column: number;
	value: number;
}

const matrixMargin = {
	top: chartFrame.contentTop + 116,
	right: 126,
	bottom: 88,
	left: 300,
};

const layout = {
	cellGap: 5,
	columnLabelRotation: -48,
	rowTotalOffset: 24,
	rowLabelChars: 34,
	columnLabelChars: 22,
};

const colors = {
	emptyCell: "#101a2c",
	lowCell: "#162338",
	highCell: stagePalette.highlight,
	cellBorder: "rgba(148, 163, 184, 0.18)",
	activeStroke: "#fde68a",
};

const bubbleMinRadius = 2.5;
const legendGradientId = "contractor-flow-volume-gradient";
const legendWidth = 210;
const legendHeight = 8;
const flowLabelFontSize = 12;

function truncateLabel(value: string, maxLen: number) {
	const trimmed = value.trim();
	if (trimmed.length <= maxLen) {
		return trimmed;
	}
	return maxLen < 2 ? "…" : `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}

export function renderContractorFlow(
	container: HTMLElement,
	flow: FlowData,
	tooltip: TooltipController,
) {
	const { width, height } = chartFrame;
	const innerWidth = width - matrixMargin.left - matrixMargin.right;
	const innerHeight = height - matrixMargin.top - matrixMargin.bottom;
	const columnCount = Math.max(1, flow.sites.length);
	const rowCount = Math.max(1, flow.contractors.length);
	const cellWidth =
		(innerWidth - layout.cellGap * Math.max(0, columnCount - 1)) / columnCount;
	const cellHeight =
		(innerHeight - layout.cellGap * Math.max(0, rowCount - 1)) / rowCount;
	const stepX = cellWidth + layout.cellGap;
	const stepY = cellHeight + layout.cellGap;
	const valueByRoute = new Map(
		flow.links.map((link) => [`${link.source}__${link.target}`, link.value]),
	);
	const cells = flow.contractors.flatMap((contractor, row) =>
		flow.sites.map((site, column) => ({
			contractor,
			site,
			row,
			column,
			value: valueByRoute.get(`${contractor.id}__${site.id}`) ?? 0,
		})),
	);
	const totalSatellites =
		d3.sum(flow.contractors, (contractor) => contractor.value) || 1;
	const maxValue = d3.max(cells, (cell) => cell.value) ?? 0;
	const radiusScale = d3
		.scaleSqrt()
		.domain([0, maxValue])
		.range([0, Math.max(0, Math.min(cellWidth, cellHeight) / 2 - 5)]);
	const intensityScale = d3
		.scaleSqrt()
		.domain([0, maxValue])
		.range([0, 1])
		.clamp(true);
	const cellColor = (value: number) =>
		value === 0
			? colors.emptyCell
			: d3.interpolateRgb(
					colors.lowCell,
					colors.highCell,
				)(intensityScale(value));

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

	const gradient = svg
		.append("defs")
		.append("linearGradient")
		.attr("id", legendGradientId)
		.attr("x1", "0%")
		.attr("x2", "100%");
	for (const [offset, color] of [
		["0%", colors.lowCell],
		["100%", colors.highCell],
	] as const) {
		gradient.append("stop").attr("offset", offset).attr("stop-color", color);
	}

	appendChartHeader(
		svg,
		"Des chaînes logistiques fortement concentrées",
		"Chaque ligne suit un constructeur; chaque colonne montre où ses satellites sont lancés.",
	);

	const matrix = svg
		.append("g")
		.attr("transform", `translate(${matrixMargin.left}, ${matrixMargin.top})`);

	appendSectionLabel(
		svg,
		"Constructeurs",
		matrixMargin.left - 16,
		matrixMargin.top - 36,
		{ anchor: "end" },
	);
	appendSectionLabel(
		svg,
		"Sites de lancement",
		matrixMargin.left + innerWidth / 2,
		matrixMargin.top - 122,
		{ anchor: "middle" },
	);

	const rowLabels = matrix
		.append("g")
		.selectAll<SVGTextElement, FlowNodeDatum>(".flow-row-label")
		.data(flow.contractors)
		.join("text")
		.attr("class", "flow-row-label")
		.attr("x", -16)
		.attr("y", (_contractor, index) => index * stepY + cellHeight / 2)
		.attr("dominant-baseline", "middle")
		.attr("text-anchor", "end")
		.attr("fill", stagePalette.text)
		.attr("font-size", chartTypography.dataLabel)
		.attr("font-weight", 600)
		.text((contractor) =>
			truncateLabel(contractor.label, layout.rowLabelChars),
		);
	rowLabels.append("title").text((contractor) => contractor.label);

	const columnLabels = matrix
		.append("g")
		.selectAll<SVGTextElement, FlowNodeDatum>(".flow-column-label")
		.data(flow.sites)
		.join("text")
		.attr("class", "flow-column-label")
		.attr(
			"transform",
			(_site, index) =>
				`translate(${index * stepX + cellWidth / 2}, -12) rotate(${layout.columnLabelRotation})`,
		)
		.attr("dominant-baseline", "middle")
		.attr("text-anchor", "start")
		.attr("fill", stagePalette.text)
		.attr("font-size", flowLabelFontSize)
		.attr("font-weight", 600)
		.text((site) => truncateLabel(site.label, layout.columnLabelChars));
	columnLabels.append("title").text((site) => site.label);

	const cellGroups = matrix
		.append("g")
		.selectAll<SVGGElement, MatrixCell>(".matrix-cell")
		.data(cells)
		.join("g")
		.attr("class", "matrix-cell")
		.attr(
			"transform",
			(cell) => `translate(${cell.column * stepX}, ${cell.row * stepY})`,
		)
		.attr("tabindex", 0)
		.attr("role", "img")
		.style("cursor", "pointer")
		.style("outline", "none")
		.attr(
			"aria-label",
			(cell) =>
				`${cell.contractor.label} vers ${cell.site.label}: ${formatCount(cell.value)} satellites`,
		);

	cellGroups
		.append("title")
		.text(
			(cell) =>
				`${cell.contractor.label} → ${cell.site.label}: ${formatCount(cell.value)} satellites`,
		);

	cellGroups
		.append("rect")
		.attr("width", cellWidth)
		.attr("height", cellHeight)
		.attr("rx", 4)
		.attr("fill", (cell) => cellColor(cell.value))
		.attr("fill-opacity", (cell) => (cell.value > 0 ? 0.88 : 0.54))
		.attr("stroke", colors.cellBorder)
		.attr("stroke-width", 1);

	cellGroups
		.append("circle")
		.attr("cx", cellWidth / 2)
		.attr("cy", cellHeight / 2)
		.attr("r", (cell) =>
			cell.value === 0 ? 0 : Math.max(bubbleMinRadius, radiusScale(cell.value)),
		)
		.attr("fill", "#081120")
		.attr("fill-opacity", 0.92)
		.attr("stroke", "rgba(226, 232, 240, 0.66)")
		.attr("stroke-width", 1);

	const rowTotals = matrix
		.append("g")
		.selectAll<SVGTextElement, FlowNodeDatum>(".flow-row-total")
		.data(flow.contractors)
		.join("text")
		.attr("class", "flow-row-total")
		.attr("x", innerWidth + layout.rowTotalOffset)
		.attr("y", (_contractor, index) => index * stepY + cellHeight / 2 + 4)
		.attr("fill", stagePalette.muted)
		.attr("font-size", flowLabelFontSize)
		.attr("font-weight", 600)
		.text((contractor) => formatCount(contractor.value));

	const siteTotals = matrix
		.append("g")
		.selectAll<SVGTextElement, FlowNodeDatum>(".flow-column-total")
		.data(flow.sites)
		.join("text")
		.attr("class", "flow-column-total")
		.attr("x", (_site, index) => index * stepX + cellWidth / 2)
		.attr("y", innerHeight + 23)
		.attr("text-anchor", "middle")
		.attr("fill", stagePalette.muted)
		.attr("font-size", flowLabelFontSize)
		.attr("font-weight", 600)
		.text((site) => formatCount(site.value));

	appendAxisLabel(matrix, "Total par site", innerWidth / 2, innerHeight + 50);
	appendAxisLabel(
		matrix,
		"Total par constructeur",
		innerWidth + layout.rowTotalOffset,
		-20,
		{ anchor: "start" },
	);

	const highlight = (active: MatrixCell | null) => {
		cellGroups
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (cell) => {
				if (!active) {
					return cell.value > 0
						? chartInteraction.idle
						: chartInteraction.faint;
				}
				return cell.contractor.id === active.contractor.id ||
					cell.site.id === active.site.id
					? chartInteraction.idle
					: chartInteraction.muted;
			});

		const fade = (
			selection: d3.Selection<
				SVGTextElement,
				FlowNodeDatum,
				SVGGElement,
				unknown
			>,
			activeId: string | undefined,
		) => {
			selection
				.interrupt()
				.transition()
				.duration(chartInteraction.duration)
				.style("opacity", (node) =>
					!activeId || node.id === activeId
						? chartInteraction.idle
						: chartInteraction.softMuted,
				);
		};
		fade(rowLabels, active?.contractor.id);
		fade(rowTotals, active?.contractor.id);
		fade(columnLabels, active?.site.id);
		fade(siteTotals, active?.site.id);

		cellGroups
			.select<SVGRectElement>("rect")
			.style("stroke", (cell) =>
				active && cell === active ? colors.activeStroke : colors.cellBorder,
			)
			.style("stroke-width", (cell) => (active && cell === active ? 2 : 1));
	};

	const presentCell = (cell: MatrixCell, event: PointerEvent | MouseEvent) => {
		highlight(cell);
		tooltip.show(
			buildTooltip({
				title: `${cell.contractor.label} → ${cell.site.label}`,
				rows: [
					{ label: "Satellites lancés", value: formatCount(cell.value) },
					{
						label: "Part du constructeur",
						value: formatPercent(
							cell.value / Math.max(1, cell.contractor.value),
							1,
						),
					},
					{
						label: "Part du total",
						value: formatPercent(cell.value / totalSatellites, 1),
					},
				],
			}),
			event,
		);
	};

	cellGroups
		.on("pointerenter", (event, cell) => presentCell(cell, event))
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave blur", () => {
			highlight(null);
			tooltip.hide();
		})
		.on("focus", function handleFocus(_event, cell) {
			const rect = this.getBoundingClientRect();
			presentCell(
				cell,
				new MouseEvent("focus", {
					clientX: rect.left + rect.width / 2,
					clientY: rect.top + rect.height / 2,
				}),
			);
		});

	const legend = svg
		.append("g")
		.attr(
			"transform",
			`translate(${matrixMargin.left + innerWidth - legendWidth}, ${matrixMargin.top + innerHeight + 66})`,
		);

	legend
		.append("rect")
		.attr("width", legendWidth)
		.attr("height", legendHeight)
		.attr("rx", 4)
		.attr("fill", `url(#${legendGradientId})`)
		.attr("stroke", colors.cellBorder)
		.attr("stroke-width", 1);

	legend
		.selectAll("text")
		.data([
			{ label: "Faible volume", x: 0, anchor: "start" },
			{ label: "Volume élevé", x: legendWidth, anchor: "end" },
		] as const)
		.join("text")
		.attr("x", (label) => label.x)
		.attr("y", legendHeight + 16)
		.attr("text-anchor", (label) => label.anchor)
		.attr("fill", stagePalette.muted)
		.attr("font-size", flowLabelFontSize)
		.text((label) => label.label);
}
