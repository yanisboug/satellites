import * as d3 from "d3";
import {
	appendChartHeader,
	appendSectionLabel,
	chartFrame,
	chartInteraction,
	chartTypography,
} from "../helpers/chartFrame";
import { formatCount, formatPercent } from "../helpers/formatters";
import { colorFromMap, stagePalette, usagePalette } from "../helpers/palette";
import type { TooltipController } from "../helpers/tooltip";
import { buildTooltip } from "../helpers/tooltipContent";
import type { ShareDatum } from "../types";

export function renderUsageDonut(
	container: HTMLElement,
	data: ShareDatum[],
	tooltip: TooltipController,
) {
	const { width, height } = chartFrame;
	const radius = 184;
	const pie = d3
		.pie<ShareDatum>()
		.sort(null)
		.value((item) => item.count);
	const arcs = pie(data);
	const arc = d3
		.arc<d3.PieArcDatum<ShareDatum>>()
		.innerRadius(150)
		.outerRadius(radius);
	const labelArc = d3
		.arc<d3.PieArcDatum<ShareDatum>>()
		.innerRadius(radius + 34)
		.outerRadius(radius + 34);
	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.attr("role", "img")
		.attr("aria-label", "Répartition des satellites selon leur usage");
	const stage = svg
		.append("g")
		.attr("transform", `translate(${width / 2}, ${height / 2 + 16})`);

	const slices = stage
		.selectAll("path")
		.data(arcs)
		.join("path")
		.attr("d", arc)
		.attr("fill", (item) => colorFromMap(usagePalette, item.data.label))
		.attr("stroke", "#081120")
		.attr("stroke-width", 2)
		.on("pointerenter", (event, item) => {
			highlight(item.data.label);
			tooltip.show(
				buildTooltip({
					title: item.data.label,
					rows: [
						{ label: "Satellites", value: formatCount(item.data.count) },
						{ label: "Part du total", value: formatPercent(item.data.share) },
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

	const labels = stage
		.selectAll(".donut-label")
		.data(arcs)
		.join("text")
		.attr("class", "donut-label")
		.attr("transform", (item) => `translate(${labelArc.centroid(item)})`)
		.attr("text-anchor", "middle")
		.attr("fill", stagePalette.text)
		.attr("font-size", chartTypography.dataLabel)
		.attr("font-weight", 600)
		.text((item) => `${item.data.label} ${formatPercent(item.data.share)}`);

	function highlight(label: string | null) {
		slices
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (item) =>
				!label || item.data.label === label
					? chartInteraction.idle
					: chartInteraction.muted,
			);

		labels
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (item) =>
				!label || item.data.label === label
					? chartInteraction.idle
					: chartInteraction.softMuted,
			);
	}

	appendSectionLabel(stage, "Usages", 0, -10, { anchor: "middle" });

	stage
		.append("text")
		.attr("text-anchor", "middle")
		.attr("y", 24)
		.attr("fill", stagePalette.text)
		.attr("font-size", chartTypography.centerValue)
		.attr("font-weight", 700)
		.text(formatPercent(data[0]?.share ?? 0));

	stage
		.append("text")
		.attr("text-anchor", "middle")
		.attr("y", 52)
		.attr("fill", stagePalette.muted)
		.attr("font-size", chartTypography.centerCaption)
		.text("de la flotte est d'abord commerciale");

	appendChartHeader(
		svg,
		"L'orbite sert d'abord le marché",
		"Les usages commerciaux écrasent largement les segments militaires et mixtes.",
	);
}
