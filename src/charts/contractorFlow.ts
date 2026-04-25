import * as d3 from "d3";
import {
	appendDataTable,
	appendFigureDescription,
	focusEventFromElement,
} from "../helpers/a11y";
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
	columnLabelChars: 16,
};

const colors = {
	emptyCell: "#101a2c",
	lowCell: "#1e2c44",
	highCell: stagePalette.highlight,
	cellBorder: "rgba(148, 163, 184, 0.18)",
	activeStroke: "#fde68a",
};

const legendGradientId = "contractor-flow-volume-gradient";
const legendWidth = 210;
const legendHeight = 8;
const flowLabelFontSize = 12;
const cellAnnotationThreshold = 0.18;

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
	const cells: MatrixCell[] = flow.contractors.flatMap((contractor, row) =>
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
	const annotationColor = (value: number) =>
		intensityScale(value) > 0.55 ? "#0b1220" : stagePalette.text;

	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.style("overflow", "visible");

	const dominantContractor = [...flow.contractors].sort(
		(left, right) => right.value - left.value,
	)[0];
	const topCell = [...cells].sort((left, right) => right.value - left.value)[0];
	const description =
		dominantContractor && topCell
			? `Matrice ${flow.contractors.length} constructeurs × ${flow.sites.length} sites de lancement, total ${formatCount(totalSatellites)} satellites. Constructeur le plus actif : ${dominantContractor.label} avec ${formatCount(dominantContractor.value)} satellites. Couplage le plus fort : ${topCell.contractor.label} → ${topCell.site.label} avec ${formatCount(topCell.value)} satellites (${formatPercent(topCell.value / totalSatellites, 1)} du total).`
			: "Matrice de correspondance entre constructeurs et sites de lancement.";

	appendFigureDescription({
		svg,
		title: "Constructeurs × sites de lancement (matrice de flux)",
		description,
	});

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
		"Sites de lancement",
		matrixMargin.left + innerWidth / 2,
		matrixMargin.top - 122,
		{ anchor: "middle" },
	);

	const rowLabels = matrix
		.append("g")
		.attr("aria-hidden", "true")
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
		.attr("aria-hidden", "true")
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
		.attr("role", "button")
		.attr("aria-describedby", tooltip.id)
		.style("cursor", "pointer")
		.style("outline", "none")
		.attr("aria-label", (cell) =>
			cell.value > 0
				? `${cell.contractor.label} vers ${cell.site.label} : ${formatCount(cell.value)} satellites (${formatPercent(cell.value / Math.max(1, cell.contractor.value), 1)} du constructeur)`
				: `${cell.contractor.label} vers ${cell.site.label} : aucun satellite`,
		);

	cellGroups
		.append("rect")
		.attr("aria-hidden", "true")
		.attr("width", cellWidth)
		.attr("height", cellHeight)
		.attr("rx", 4)
		.attr("fill", (cell) => cellColor(cell.value))
		.attr("fill-opacity", (cell) => (cell.value > 0 ? 0.88 : 0.54))
		.attr("stroke", colors.cellBorder)
		.attr("stroke-width", 1);

	cellGroups
		.filter(
			(cell) =>
				cell.value > 0 && intensityScale(cell.value) >= cellAnnotationThreshold,
		)
		.append("text")
		.attr("aria-hidden", "true")
		.attr("x", cellWidth / 2)
		.attr("y", cellHeight / 2)
		.attr("text-anchor", "middle")
		.attr("dominant-baseline", "central")
		.attr("font-size", flowLabelFontSize)
		.attr("font-weight", 600)
		.attr("fill", (cell) => annotationColor(cell.value))
		.text((cell) => formatCount(cell.value));

	const rowTotals = matrix
		.append("g")
		.attr("aria-hidden", "true")
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
		.attr("aria-hidden", "true")
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
		.on("pointerleave", () => {
			highlight(null);
			tooltip.hide();
		})
		.on("focus", function handleFocus(_event, cell) {
			presentCell(cell, focusEventFromElement(this));
		})
		.on("blur", () => {
			highlight(null);
			tooltip.hide();
		})
		.on("keydown", function handleKeydown(event, cell) {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				presentCell(cell, focusEventFromElement(this));
			}
		});

	const legend = svg
		.append("g")
		.attr(
			"transform",
			`translate(${matrixMargin.left + innerWidth - legendWidth}, ${matrixMargin.top + innerHeight + 66})`,
		);

	legend
		.append("rect")
		.attr("aria-hidden", "true")
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
		.attr("aria-hidden", "true")
		.attr("x", (label) => label.x)
		.attr("y", legendHeight + 16)
		.attr("text-anchor", (label) => label.anchor)
		.attr("fill", stagePalette.muted)
		.attr("font-size", flowLabelFontSize)
		.text((label) => label.label);

	interface ContractorRow {
		contractor: FlowNodeDatum;
		bySite: Record<string, number>;
	}

	const contractorRows: ContractorRow[] = flow.contractors.map((contractor) => {
		const bySite: Record<string, number> = {};
		for (const site of flow.sites) {
			bySite[site.id] = valueByRoute.get(`${contractor.id}__${site.id}`) ?? 0;
		}
		return { contractor, bySite };
	});

	appendDataTable({
		container,
		caption: "Satellites lancés par constructeur et site de lancement",
		summary: description,
		columns: [
			{
				header: "Constructeur",
				accessor: (row: ContractorRow) => row.contractor.label,
			},
			...flow.sites.map((site) => ({
				header: site.label,
				accessor: (row: ContractorRow) => formatCount(row.bySite[site.id] ?? 0),
			})),
			{
				header: "Total constructeur",
				accessor: (row: ContractorRow) => formatCount(row.contractor.value),
			},
		],
		rows: contractorRows,
	});
}
