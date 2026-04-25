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
import { colorFromMap, countryPalette, stagePalette } from "../helpers/palette";
import type { TooltipController } from "../helpers/tooltip";
import { buildTooltip } from "../helpers/tooltipContent";
import type { ContractorDatum } from "../types";

const ROW_LABEL_MAX_CHARS = 24;

function truncateLabel(value: string, maxLen: number) {
	const trimmed = value.trim();
	if (trimmed.length <= maxLen) {
		return trimmed;
	}
	return maxLen < 2 ? "…" : `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}

export function renderContractorBars(
	container: HTMLElement,
	data: ContractorDatum[],
	tooltip: TooltipController,
) {
	const { width, height } = chartFrame;
	const margin = chartMargins.barLegendWide;
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;
	const x = d3
		.scaleLinear()
		.domain([0, d3.max(data, (item) => item.count) ?? 0])
		.range([0, innerWidth]);
	const y = d3
		.scaleBand<string>()
		.domain(data.map((item) => item.name))
		.range([0, innerHeight])
		.padding(0.22);
	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`);

	const top = data[0];
	const bottom = data.at(-1);
	const description =
		top && bottom
			? `Top ${data.length} des constructeurs. ${top.name} (${top.country}) arrive en tête avec ${formatCount(top.count)} satellites actifs (${formatPercent(top.share)} du parc), suivi à la dernière place du classement par ${bottom.name} avec ${formatCount(bottom.count)} satellites (${formatPercent(bottom.share)}).`
			: "Top des constructeurs de satellites par nombre d'unités actives.";

	appendFigureDescription({
		svg,
		title: "Top constructeurs de satellites actifs",
		description,
	});

	const root = svg
		.append("g")
		.attr("transform", `translate(${margin.left}, ${margin.top})`);

	root
		.append("g")
		.attr("class", "grid")
		.attr("aria-hidden", "true")
		.call(
			d3
				.axisTop(x)
				.ticks(5)
				.tickSize(-innerHeight)
				.tickFormat((value) => formatCompactTick(Number(value))),
		)
		.call((axis) => styleAxis(axis, { hideDomain: true }));

	const rows = root
		.selectAll(".contractor-row")
		.data(data)
		.join("g")
		.attr("class", "contractor-row")
		.attr("transform", (item) => `translate(0, ${y(item.name) ?? 0})`);

	rows
		.append("rect")
		.attr("class", "bar-backdrop")
		.attr("aria-hidden", "true")
		.attr("width", innerWidth)
		.attr("height", y.bandwidth())
		.attr("rx", 14)
		.attr("fill", "rgba(148, 163, 184, 0.12)");

	const showRowTooltip = (
		event: PointerEvent | MouseEvent,
		item: ContractorDatum,
	) => {
		updateHighlight(item.country);
		tooltip.show(
			buildTooltip({
				title: item.name,
				subtitle: item.country,
				rows: [
					{ label: "Satellites actifs", value: formatCount(item.count) },
					{ label: "Part du parc", value: formatPercent(item.share) },
				],
			}),
			event,
		);
	};

	rows
		.append("rect")
		.attr("class", "bar-fill")
		.attr("width", (item) => x(item.count))
		.attr("height", y.bandwidth())
		.attr("rx", 14)
		.attr("fill", (item) =>
			colorFromMap(countryPalette, item.country, countryPalette.get("Autre")),
		)
		.attr("tabindex", 0)
		.attr("role", "button")
		.attr("aria-describedby", tooltip.id)
		.attr(
			"aria-label",
			(item) =>
				`${item.name}, ${item.country} : ${formatCount(item.count)} satellites actifs (${formatPercent(item.share)} du parc)`,
		)
		.style("cursor", "pointer")
		.on("pointerenter", (event, item) => showRowTooltip(event, item))
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => {
			updateHighlight(null);
			tooltip.hide();
		})
		.on("focus", function handleFocus(_event, item) {
			showRowTooltip(focusEventFromElement(this), item);
		})
		.on("blur", () => {
			updateHighlight(null);
			tooltip.hide();
		})
		.on("keydown", function handleKeydown(event, item) {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				showRowTooltip(focusEventFromElement(this), item);
			}
		});

	const rowLabels = rows
		.append("text")
		.attr("aria-hidden", "true")
		.attr("x", -18)
		.attr("y", y.bandwidth() / 2)
		.attr("text-anchor", "end")
		.attr("dominant-baseline", "middle")
		.attr("fill", stagePalette.text)
		.attr("font-size", chartTypography.rowLabel)
		.attr("font-weight", 600)
		.text((item) => truncateLabel(item.name, ROW_LABEL_MAX_CHARS));

	rowLabels.append("title").text((item) => item.name);

	rows
		.append("text")
		.attr("aria-hidden", "true")
		.attr("x", (item) => x(item.count) + 14)
		.attr("y", y.bandwidth() / 2 - 8)
		.attr("fill", stagePalette.text)
		.attr("dominant-baseline", "middle")
		.attr("font-size", chartTypography.rowValue)
		.attr("font-weight", 600)
		.text((item) => formatCount(item.count));

	rows
		.append("text")
		.attr("aria-hidden", "true")
		.attr("x", (item) => x(item.count) + 14)
		.attr("y", y.bandwidth() / 2 + 12)
		.attr("fill", stagePalette.muted)
		.attr("dominant-baseline", "middle")
		.attr("font-size", chartTypography.rowMeta)
		.text((item) => `${formatPercent(item.share)} du marché`);

	appendChartHeader(
		svg,
		"Les grands maîtres de la fabrication",
		"Top 5 des constructeurs mondiaux, avec une lecture absolue et relative.",
	);

	const countries = [...new Set(data.map((item) => item.country))];
	const legend = svg
		.append("g")
		.attr(
			"transform",
			`translate(${width - 150}, ${chartFrame.contentTop + 62})`,
		);

	const updateHighlight = (country: string | null) => {
		rows
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (item) => {
				if (!country) {
					return chartInteraction.idle;
				}
				return item.country === country
					? chartInteraction.idle
					: chartInteraction.muted;
			});
	};

	appendLegend(legend, {
		title: "Pays d'origine",
		x: 0,
		y: 0,
		items: countries.map((country) => ({
			label: country,
			color: colorFromMap(countryPalette, country, countryPalette.get("Autre")),
			onPointerEnter: () => updateHighlight(country),
			onPointerLeave: () => updateHighlight(null),
		})),
		rowGap: 34,
	});

	appendDataTable({
		container,
		caption: "Top constructeurs de satellites actifs",
		summary: description,
		columns: [
			{
				header: "Constructeur",
				accessor: (row: ContractorDatum) => row.name,
			},
			{
				header: "Pays d'origine",
				accessor: (row: ContractorDatum) => row.country,
			},
			{
				header: "Satellites actifs",
				accessor: (row: ContractorDatum) => formatCount(row.count),
			},
			{
				header: "Part du parc",
				accessor: (row: ContractorDatum) => formatPercent(row.share),
			},
		],
		rows: data,
	});
}
