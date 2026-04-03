import * as d3 from "d3";

import type { OperatorDatum } from "../types";
import {
	appendChartHeader,
	chartFrame,
	chartInteraction,
	chartTypography,
} from "./chartFrame";
import { formatCount, formatPercent } from "./formatters";
import { appendLegend } from "./legend";
import { colorFromMap, countryPalette, stagePalette } from "./palette";
import type { TooltipController } from "./tooltip";
import { buildTooltip } from "./tooltipContent";

interface BubbleNode extends OperatorDatum {
	r: number;
	x: number;
	y: number;
}

function truncateName(name: string, maxLen: number) {
	const short = name.replace(/\s+\(.*/, "").trim();
	if (short.length <= maxLen) {
		return short;
	}
	return `${short.slice(0, maxLen - 1)}…`;
}

function operatorColor(country: string) {
	return colorFromMap(countryPalette, country, countryPalette.get("Autre"));
}

export function renderOperatorBubbles(
	container: HTMLElement,
	data: OperatorDatum[],
	tooltip: TooltipController,
) {
	const { width, height } = chartFrame;
	const bubbleData = data.slice(0, 10);
	const countries = [...new Set(bubbleData.map((item) => item.country))];
	const maxShare = d3.max(bubbleData, (item) => item.share) ?? 0.001;

	/* Area of disk ∝ share (market %) — radius ∝ sqrt(share) */
	const radius = d3.scaleLinear().domain([0, maxShare]).range([8, 112]);

	const packedNodes = d3.packSiblings(
		bubbleData.map((item) => ({
			...item,
			r: radius(item.share),
			x: 0,
			y: 0,
		})),
	);
	const extentX = d3.extent(
		packedNodes.flatMap((item) => [item.x - item.r, item.x + item.r]),
	) as [number, number];
	const extentY = d3.extent(
		packedNodes.flatMap((item) => [item.y - item.r, item.y + item.r]),
	) as [number, number];
	const packCenterX = 340;
	const packCenterY = chartFrame.contentTop + 176;
	const offsetX = packCenterX - (extentX[0] + extentX[1]) / 2;
	const offsetY = packCenterY - (extentY[0] + extentY[1]) / 2;
	const nodes: BubbleNode[] = packedNodes.map((item) => ({
		...item,
		x: item.x + offsetX,
		y: item.y + offsetY,
	}));

	const listX = 618;
	const legendX = chartFrame.headerX;
	const legendTop = chartFrame.contentTop + 2;
	const listTop = chartFrame.contentTop + 58;
	const listRowH = 34;
	const listAnchorX = listX + 7;
	const listAnchorY = (index: number) => listTop + index * listRowH + 12;

	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.attr("role", "img")
		.attr("aria-label", "Bulles proportionnelles des opérateurs de satellites");

	const connectorRoot = svg.append("g").attr("class", "operator-connectors");

	const stage = svg.append("g").attr("transform", "translate(0, 0)");

	const pctFmt = (share: number) => formatPercent(share);

	const connectorSelection = connectorRoot
		.selectAll<SVGLineElement, BubbleNode>(".operator-connector")
		.data(nodes)
		.join("line")
		.attr("class", "operator-connector")
		.attr("stroke-linecap", "round")
		.attr("stroke-width", 1.35)
		.attr("stroke", (item) => operatorColor(item.country))
		.attr("stroke-opacity", 0.55)
		.each(function (item, index) {
			const tx = listAnchorX;
			const ty = listAnchorY(index);
			const dx = tx - item.x;
			const dy = ty - item.y;
			const len = Math.hypot(dx, dy) || 1;
			const sx = item.x + (dx / len) * item.r;
			const sy = item.y + (dy / len) * item.r;
			d3.select(this)
				.attr("x1", sx)
				.attr("y1", sy)
				.attr("x2", tx)
				.attr("y2", ty);
		});

	const bubbleGroups = stage
		.selectAll(".bubble-node")
		.data(nodes)
		.join("g")
		.attr("class", "bubble-node")
		.attr("transform", (item) => `translate(${item.x}, ${item.y})`)
		.on("pointerenter", (event, item) => {
			highlight(item.name);
			tooltip.show(
				buildTooltip({
					title: item.name,
					rows: [
						{ label: "Satellites actifs", value: formatCount(item.count) },
						{ label: "Part du parc", value: pctFmt(item.share) },
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

	bubbleGroups
		.append("circle")
		.attr("r", (item) => item.r)
		.attr("fill", (item) => operatorColor(item.country))
		.attr("fill-opacity", 0.86)
		.attr("stroke", "rgba(255,255,255,0.28)")
		.attr("stroke-width", 1.2);

	const listW = width - listX - 20;
	const list = svg
		.append("g")
		.attr("transform", `translate(${listX}, ${listTop})`)
		.selectAll<SVGGElement, OperatorDatum>(".operator-item")
		.data(bubbleData)
		.join("g")
		.attr("class", "operator-item")
		.attr("transform", (_, index) => `translate(0, ${index * listRowH})`)
		.style("cursor", "pointer")
		.on("pointerenter", (event, item) => {
			highlight(item.name);
			tooltip.show(
				buildTooltip({
					title: item.name,
					rows: [
						{ label: "Satellites actifs", value: formatCount(item.count) },
						{ label: "Part du parc", value: pctFmt(item.share) },
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

	const legend = svg
		.append("g")
		.attr("transform", `translate(${legendX}, ${legendTop})`);

	appendLegend(legend, {
		title: "Pays d'origine",
		x: 0,
		y: 0,
		items: countries.map((country) => ({
			label: country,
			color: operatorColor(country),
			onPointerEnter: () => highlight(null, country),
			onPointerLeave: () => highlight(null, null),
		})),
	});

	function highlight(name: string | null, country: string | null = null) {
		bubbleGroups
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (item) => {
				if (name) {
					return item.name === name
						? chartInteraction.idle
						: chartInteraction.muted;
				}
				if (country) {
					return item.country === country
						? chartInteraction.idle
						: chartInteraction.faint;
				}
				return chartInteraction.idle;
			});

		list
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (item) => {
				if (name) {
					return item.name === name
						? chartInteraction.idle
						: chartInteraction.softMuted;
				}
				if (country) {
					return item.country === country
						? chartInteraction.idle
						: chartInteraction.muted;
				}
				return chartInteraction.idle;
			});

		connectorSelection
			.interrupt()
			.transition()
			.duration(chartInteraction.duration)
			.style("opacity", (item) => {
				if (name) {
					return item.name === name
						? chartInteraction.active
						: chartInteraction.lineMuted;
				}
				if (country) {
					return item.country === country
						? chartInteraction.active
						: chartInteraction.lineFaint;
				}
				return chartInteraction.lineIdle;
			});
	}

	list
		.append("rect")
		.attr("width", listW)
		.attr("height", 24)
		.attr("rx", 12)
		.attr("fill", (item) => {
			const base = d3.color(operatorColor(item.country));
			return (
				base?.copy({ opacity: 0.16 }).formatRgb() ?? "rgba(168, 218, 220, 0.16)"
			);
		});

	list
		.append("circle")
		.attr("r", 7)
		.attr("cx", 7)
		.attr("cy", 12)
		.attr("fill", (item) => operatorColor(item.country));

	list
		.append("text")
		.attr("x", 22)
		.attr("y", 16)
		.attr("fill", stagePalette.text)
		.attr("font-size", chartTypography.listLabel)
		.attr("font-weight", 600)
		.text((item) => truncateName(item.name, 24));

	list
		.append("text")
		.attr("x", listW - 10)
		.attr("y", 16)
		.attr("text-anchor", "end")
		.attr("fill", stagePalette.muted)
		.attr("font-size", chartTypography.listLabel)
		.attr("font-weight", 600)
		.text((item) => pctFmt(item.share));

	appendChartHeader(
		svg,
		"Un quasi-monopole des opérateurs",
		"Surface de chaque bulle proportionnelle à sa part du parc (%). Couleur = pays d'origine. Survolez la légende pour filtrer.",
	);
}
