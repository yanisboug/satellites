import * as d3 from "d3";

import type { ShareDatum } from "../types";
import { colorFromMap, stagePalette, usagePalette } from "./palette";
import type { TooltipController } from "./tooltip";

export function renderUsageDonut(
	container: HTMLElement,
	data: ShareDatum[],
	tooltip: TooltipController,
) {
	const width = 960;
	const height = 640;
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
		.attr("transform", `translate(${width / 2}, ${height / 2 + 10})`);

	stage
		.selectAll("path")
		.data(arcs)
		.join("path")
		.attr("d", arc)
		.attr("fill", (item) => colorFromMap(usagePalette, item.data.label))
		.attr("stroke", "#081120")
		.attr("stroke-width", 2)
		.on("pointerenter", (event, item) => {
			tooltip.show(
				`<strong>${item.data.label}</strong><br>${d3.format(",")(item.data.count).replace(/,/g, " ")} satellites<br>${Math.round(item.data.share * 100)} % du total`,
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => tooltip.hide());

	stage
		.selectAll(".donut-label")
		.data(arcs)
		.join("text")
		.attr("class", "donut-label")
		.attr("transform", (item) => `translate(${labelArc.centroid(item)})`)
		.attr("text-anchor", "middle")
		.attr("fill", stagePalette.text)
		.attr("font-size", 13)
		.attr("font-weight", 600)
		.text(
			(item) => `${item.data.label} ${Math.round(item.data.share * 100)} %`,
		);

	stage
		.append("text")
		.attr("text-anchor", "middle")
		.attr("y", -10)
		.attr("fill", stagePalette.highlight)
		.attr("font-size", 15)
		.text("USAGES");

	stage
		.append("text")
		.attr("text-anchor", "middle")
		.attr("y", 24)
		.attr("fill", stagePalette.text)
		.attr("font-size", 44)
		.attr("font-weight", 700)
		.text(`${Math.round(data[0]?.share ? data[0].share * 100 : 0)} %`);

	stage
		.append("text")
		.attr("text-anchor", "middle")
		.attr("y", 52)
		.attr("fill", stagePalette.muted)
		.attr("font-size", 15)
		.text("de la flotte est d'abord commerciale");

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 60)
		.attr("fill", stagePalette.text)
		.attr("font-size", 30)
		.attr("font-weight", 700)
		.text("L'orbite sert d'abord le marché");

	svg
		.append("text")
		.attr("x", 70)
		.attr("y", 92)
		.attr("fill", stagePalette.muted)
		.attr("font-size", 15)
		.text(
			"Les usages commerciaux écrasent largement les segments militaires et mixtes.",
		);
}
