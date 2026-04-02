import * as d3 from "d3";

import type { OperatorDatum } from "../types";
import { colorFromMap, countryPalette, stagePalette } from "./palette";
import type { TooltipController } from "./tooltip";

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
	const width = 960;
	const height = 640;
	const bubbleData = data.slice(0, 10);
	const maxShare = d3.max(bubbleData, (item) => item.share) ?? 0.001;

	/* Area of disk ∝ share (market %) — radius ∝ sqrt(share) */
	const radius = d3.scaleLinear().domain([0, maxShare]).range([1, 100]);

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
	const packCenterX = 320;
	const packCenterY = 300;
	const offsetX = packCenterX - (extentX[0] + extentX[1]) / 2;
	const offsetY = packCenterY - (extentY[0] + extentY[1]) / 2;
	const nodes: BubbleNode[] = packedNodes.map((item) => ({
		...item,
		x: item.x + offsetX,
		y: item.y + offsetY,
	}));

	const listX = 618;
	const listTop = 118;
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

	const pctFmt = (share: number) => `${Math.round(share * 100)} %`;

	const highlight = (name: string | null) => {
		stage
			.selectAll<SVGGElement, BubbleNode>(".bubble-node")
			.style("opacity", (item) => {
				if (!name) {
					return 1;
				}
				return item.name === name ? 1 : 0.18;
			});

		svg
			.selectAll<SVGGElement, OperatorDatum>(".operator-item")
			.style("opacity", (item) => {
				if (!name) {
					return 1;
				}
				return item.name === name ? 1 : 0.28;
			});

		connectorRoot
			.selectAll<SVGLineElement, BubbleNode>(".operator-connector")
			.style("opacity", (item) => {
				if (!name) {
					return 0.55;
				}
				return item.name === name ? 0.9 : 0.1;
			});
	};

	connectorRoot
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

	stage
		.selectAll(".bubble-node")
		.data(nodes)
		.join("g")
		.attr("class", "bubble-node")
		.attr("transform", (item) => `translate(${item.x}, ${item.y})`)
		.on("pointerenter", (event, item) => {
			highlight(item.name);
			tooltip.show(
				`<strong>${item.name}</strong><br>${d3.format(",")(item.count).replace(/,/g, " ")} satellites<br>${pctFmt(item.share)} du parc actif`,
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => {
			highlight(null);
			tooltip.hide();
		})
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
				`<strong>${item.name}</strong><br>${d3.format(",")(item.count).replace(/,/g, " ")} satellites<br>${pctFmt(item.share)} du parc actif`,
				event,
			);
		})
		.on("pointermove", (event) => tooltip.move(event))
		.on("pointerleave", () => {
			highlight(null);
			tooltip.hide();
		});

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
		.attr("font-size", 11)
		.attr("font-weight", 600)
		.text((item) => truncateName(item.name, 24));

	list
		.append("text")
		.attr("x", listW - 10)
		.attr("y", 16)
		.attr("text-anchor", "end")
		.attr("fill", stagePalette.muted)
		.attr("font-size", 11)
		.attr("font-weight", 600)
		.text((item) => pctFmt(item.share));

	svg
		.append("text")
		.attr("x", 48)
		.attr("y", 52)
		.attr("fill", stagePalette.text)
		.attr("font-size", 26)
		.attr("font-weight", 700)
		.text("Un quasi-monopole des opérateurs");

	svg
		.append("text")
		.attr("x", 48)
		.attr("y", 80)
		.attr("fill", stagePalette.muted)
		.attr("font-size", 13)
		.text(
			"Surface de chaque bulle proportionnelle à sa part du parc (%). Couleurs = pays d'origine.",
		);
}
